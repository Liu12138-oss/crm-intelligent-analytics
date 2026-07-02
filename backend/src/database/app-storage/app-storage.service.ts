import { Injectable } from '@nestjs/common';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';
import { createDefaultAppStorageState } from '../../shared/mock/sample-data';
import type { AppStorageState } from '../../shared/types/domain';

@Injectable()
export class AppStorageService {
  private stateValue: AppStorageState;
  private readonly persistenceEnabled: boolean;
  private readonly storageFilePath: string;
  private storageFileSignature?: string;
  private shouldPersistMergedState = false;

  constructor(
    private readonly localRuntimeConfigService: LocalRuntimeConfigService,
  ) {
    this.persistenceEnabled = process.env.NODE_ENV !== 'test';
    this.storageFilePath = join(
      this.localRuntimeConfigService.getRepoRoot(),
      '.runtime',
      'app-storage.json',
    );
    this.stateValue = this.loadInitialState();
    if (this.shouldPersistMergedState) {
      this.persist();
      this.shouldPersistMergedState = false;
    }
    this.storageFileSignature = this.readStorageFileSignature();
  }

  /**
   * 对外继续暴露统一状态对象，但在每次读取前按文件签名懒刷新。
   *
   * 设计原因：
   * 1. 管理后台和企业微信机器人可能运行在不同进程；
   * 2. 旧实现只在构造时加载一次，会导致一个进程改完权限，另一个进程仍拿旧内存；
   * 3. 改成访问前对比文件签名，可在不改动各仓储调用方式的前提下同步最新快照。
   */
  get state(): AppStorageState {
    this.reloadStateIfNeeded();
    return this.stateValue;
  }

  /**
   * 将当前内存态同步刷盘，保证企业微信会话在进程重启后仍可恢复。
   *
   * 设计原因：
   * 1. 当前仓库大量仓储仍基于内存态实现，开发态进程重启会直接丢掉上下文；
   * 2. 企业微信候选选择、跟进写回确认、日报整理都依赖会话连续性，不能只靠单进程内存；
   * 3. 采用整包快照写入 `.runtime/app-storage.json`，实现简单、便于本地联调排障。
   */
  persist(): void {
    if (!this.persistenceEnabled) {
      return;
    }

    try {
      mkdirSync(dirname(this.storageFilePath), { recursive: true });
      const tempFilePath = `${this.storageFilePath}.tmp`;
      writeFileSync(tempFilePath, JSON.stringify(this.stateValue, null, 2), 'utf8');
      renameSync(tempFilePath, this.storageFilePath);
      this.storageFileSignature = this.readStorageFileSignature();
    } catch (error) {
      console.warn(
        '[AppStorageService] 持久化本地应用状态失败：',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private loadInitialState(): AppStorageState {
    const defaultState = createDefaultAppStorageState();
    return this.readPersistedState(defaultState) ?? defaultState;
  }

  /**
   * 当其他进程已写入更新后的状态文件时，当前进程应在下一次访问前自动换成最新快照。
   */
  private reloadStateIfNeeded(): void {
    if (!this.persistenceEnabled) {
      return;
    }

    const latestSignature = this.readStorageFileSignature();
    if (!latestSignature || latestSignature === this.storageFileSignature) {
      return;
    }

    const nextState = this.readPersistedState(this.stateValue);
    if (!nextState) {
      return;
    }

    this.stateValue = nextState;
    this.storageFileSignature = latestSignature;
  }

  private readPersistedState(defaultState: AppStorageState): AppStorageState | undefined {
    if (!this.persistenceEnabled || !existsSync(this.storageFilePath)) {
      return undefined;
    }

    try {
      const persistedState = JSON.parse(
        readFileSync(this.storageFilePath, 'utf8'),
      ) as Partial<AppStorageState>;
      return {
        ...defaultState,
        ...persistedState,
        policy: this.mergePersistedAccessPolicy(
          defaultState.policy,
          persistedState.policy,
        ),
        queryTemplates: this.mergePersistedQueryTemplates(
          defaultState.queryTemplates,
          persistedState.queryTemplates,
        ),
      };
    } catch (error) {
      console.warn(
        '[AppStorageService] 读取本地应用状态失败，已回退默认内存态：',
        error instanceof Error ? error.message : String(error),
      );
      return undefined;
    }
  }

  /**
   * 为旧版 `.runtime` 快照补齐新内置模板，但保留用户已有模板和既有修改。
   *
   * 设计原因：
   * 1. 查询模板列表会长期保存在共享 `.runtime/app-storage.json` 中；
   * 2. 新版本仅靠浅合并会被旧数组整包覆盖，导致新增内置模板永远不会出现在运行态；
   * 3. 这里采用“保留持久化项 + 追加缺失内置模板”的策略，既不抹掉用户历史，也能让新模板立即可见。
   */
  private mergePersistedQueryTemplates(
    defaultTemplates: AppStorageState['queryTemplates'],
    persistedTemplates: AppStorageState['queryTemplates'] | undefined,
  ): AppStorageState['queryTemplates'] {
    if (!Array.isArray(persistedTemplates) || persistedTemplates.length === 0) {
      return defaultTemplates.map((item) => ({ ...item }));
    }

    const defaultTemplateMap = new Map(
      defaultTemplates.map((item) => [item.id, item] as const),
    );
    const mergedTemplates = persistedTemplates.map((item) => {
      const defaultTemplate = defaultTemplateMap.get(String(item.id ?? ''));
      if (
        !defaultTemplate ||
        (
          item.sqlVersion === defaultTemplate.sqlVersion &&
          item.sqlText === defaultTemplate.sqlText
        )
      ) {
        if (
          defaultTemplate &&
          this.shouldRefreshBuiltInTemplateDescription(item, defaultTemplate)
        ) {
          this.shouldPersistMergedState = true;
          return {
            ...item,
            description: defaultTemplate.description,
          };
        }

        return { ...item };
      }

      // 内置模板 SQL、展示配置或版本发生变化时，应把运行态快照推进到当前默认模板。
      // 否则旧进程或生产共享 `.runtime` 会继续把过期 SQL 暴露给常用查询入口。
      this.shouldPersistMergedState = true;
      return {
        ...item,
        ...defaultTemplate,
        visibleRoleIds: item.visibleRoleIds ?? defaultTemplate.visibleRoleIds,
        displayOrder: item.displayOrder ?? defaultTemplate.displayOrder,
        clickCount7d: item.clickCount7d ?? defaultTemplate.clickCount7d,
        hitRatePercent: item.hitRatePercent ?? defaultTemplate.hitRatePercent,
        optimizationStatus:
          item.optimizationStatus ?? defaultTemplate.optimizationStatus,
        status: item.status ?? defaultTemplate.status,
        validationSnapshot: defaultTemplate.validationSnapshot,
        lastValidatedAt: defaultTemplate.lastValidatedAt,
      };
    });
    const existingTemplateIds = new Set(
      mergedTemplates.map((item) => String(item.id ?? '')),
    );

    for (const defaultTemplate of defaultTemplates) {
      if (existingTemplateIds.has(defaultTemplate.id)) {
        continue;
      }

      this.shouldPersistMergedState = true;
      mergedTemplates.push({ ...defaultTemplate });
    }

    return mergedTemplates;
  }

  /**
   * 判断已落盘的内置模板说明是否仍停留在历史看板来源句式。
   *
   * 参数说明：
   * - `persistedTemplate`：从 `.runtime` 读取的模板快照，可能带有管理员历史配置。
   * - `defaultTemplate`：当前版本内置模板，用于提供最新业务用途说明。
   *
   * 返回值：需要刷新时返回 `true`。只刷新仍包含“源自/来源于”的内置旧说明，
   * 避免覆盖管理员自行维护的正常业务说明。
   */
  private shouldRefreshBuiltInTemplateDescription(
    persistedTemplate: AppStorageState['queryTemplates'][number],
    defaultTemplate: AppStorageState['queryTemplates'][number],
  ): boolean {
    if (persistedTemplate.description === defaultTemplate.description) {
      return false;
    }

    return /源自|来源于/.test(String(persistedTemplate.description ?? ''));
  }

  /**
   * 为旧版 `.runtime` 中的治理白名单补齐当前系统默认依赖的表与字段。
   *
   * 设计原因：
   * 1. 早期运行态快照只持久化了少量表，升级后不会自动带上新模板依赖的 departments /
   *    field_values / *_assets 等表；
   * 2. 查询模板执行时会先命中白名单校验，导致“已开通超级管理员授权或历史全量分析权限”的用户仍被更前面的
   *    SQL 白名单拦截；
   * 3. 这里采用“保留持久化配置 + 追加默认缺失项”的方式，只修复历史缺口，不覆盖管理员
   *    已调整的阈值、菜单、渠道等其它治理配置。
   */
  private mergePersistedAccessPolicy(
    defaultPolicy: AppStorageState['policy'],
    persistedPolicy: AppStorageState['policy'] | undefined,
  ): AppStorageState['policy'] {
    if (!persistedPolicy) {
      return {
        ...defaultPolicy,
        allowedTables: [...defaultPolicy.allowedTables],
        allowedFields: structuredClone(defaultPolicy.allowedFields),
        maskedFields: structuredClone(defaultPolicy.maskedFields),
      };
    }

    const allowedTables = Array.from(
      new Set([
        ...(persistedPolicy.allowedTables ?? []),
        ...defaultPolicy.allowedTables,
      ]),
    );
    const persistedAllowedTableSet = new Set(persistedPolicy.allowedTables ?? []);
    const hasMissingDefaultTable = defaultPolicy.allowedTables.some(
      (tableName) => !persistedAllowedTableSet.has(tableName),
    );
    const allowedFieldTables = new Set([
      ...Object.keys(defaultPolicy.allowedFields ?? {}),
      ...Object.keys(persistedPolicy.allowedFields ?? {}),
    ]);
    const allowedFields = Object.fromEntries(
      [...allowedFieldTables].map((tableName) => [
        tableName,
        Array.from(
          new Set([
            ...((persistedPolicy.allowedFields?.[tableName] as string[] | undefined) ?? []),
            ...((defaultPolicy.allowedFields?.[tableName] as string[] | undefined) ?? []),
          ]),
        ),
      ]),
    );
    const hasMissingDefaultField = Object.entries(defaultPolicy.allowedFields ?? {}).some(
      ([tableName, fieldNames]) => {
        const persistedFields = new Set(persistedPolicy.allowedFields?.[tableName] ?? []);
        return fieldNames.some((fieldName) => !persistedFields.has(fieldName));
      },
    );
    const maskedFieldTables = new Set([
      ...Object.keys(defaultPolicy.maskedFields ?? {}),
      ...Object.keys(persistedPolicy.maskedFields ?? {}),
    ]);
    const maskedFields = Object.fromEntries(
      [...maskedFieldTables].map((tableName) => [
        tableName,
        Array.from(
          new Set([
            ...((persistedPolicy.maskedFields?.[tableName] as string[] | undefined) ?? []),
            ...((defaultPolicy.maskedFields?.[tableName] as string[] | undefined) ?? []),
          ]),
        ),
      ]),
    );
    const hasMissingDefaultMaskedField = Object.entries(defaultPolicy.maskedFields ?? {}).some(
      ([tableName, fieldNames]) => {
        const persistedFields = new Set(persistedPolicy.maskedFields?.[tableName] ?? []);
        return fieldNames.some((fieldName) => !persistedFields.has(fieldName));
      },
    );

    if (hasMissingDefaultTable || hasMissingDefaultField || hasMissingDefaultMaskedField) {
      this.shouldPersistMergedState = true;
    }

    return {
      ...defaultPolicy,
      ...persistedPolicy,
      allowedTables,
      allowedFields,
      maskedFields,
    };
  }

  private readStorageFileSignature(): string | undefined {
    if (!this.persistenceEnabled || !existsSync(this.storageFilePath)) {
      return undefined;
    }

    try {
      const fileStat = statSync(this.storageFilePath);
      return `${fileStat.mtimeMs}:${fileStat.size}`;
    } catch (error) {
      console.warn(
        '[AppStorageService] 读取本地应用状态文件签名失败：',
        error instanceof Error ? error.message : String(error),
      );
      return undefined;
    }
  }
}

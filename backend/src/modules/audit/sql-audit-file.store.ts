import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';
import type { SqlAuditRecord } from '../../shared/types/domain';

export interface SqlAuditFileStoreConfig {
  enabled: boolean;
  filePath: string;
}

export interface SqlAuditFileStoreListFilters {
  actorId?: string;
  moduleKey?: string;
  databaseRole?: string;
  stage?: string;
  operationType?: string;
  status?: string;
  tableName?: string;
  requestId?: string;
  sessionId?: string;
  startAt?: string;
  endAt?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class SqlAuditFileStore {
  constructor(
    @Optional()
    @Inject(LocalRuntimeConfigService)
    private readonly runtimeConfigOrStaticConfig?:
      | LocalRuntimeConfigService
      | SqlAuditFileStoreConfig,
  ) {}

  /**
   * 判断独立 SQL 审计文件存储是否启用。
   *
   * @returns 启用时返回 `true`。
   * @throws 不抛出异常；配置缺失时按未启用处理。
   */
  isEnabled(): boolean {
    return this.resolveConfig().enabled;
  }

  /**
   * 将单条 SQL 审计追加到独立 JSONL 文件。
   *
   * @param record 已完成脱敏摘要、指纹和上下文补齐的 SQL 审计记录。
   * @returns 已写入的审计记录。
   * @throws 文件写入异常会向上抛出，由调用方进入审计降级路径。
   */
  create(record: SqlAuditRecord): SqlAuditRecord {
    const config = this.resolveConfig();
    if (!config.enabled) {
      return record;
    }

    mkdirSync(dirname(config.filePath), { recursive: true });
    appendFileSync(config.filePath, `${JSON.stringify(record)}\n`, 'utf8');
    return record;
  }

  /**
   * 按条件读取独立 SQL 审计文件，并按创建时间倒序分页。
   *
   * @param filters 查询过滤条件和分页参数。
   * @returns 分页结果；`items` 为当前页，`total` 为过滤后总数。
   * @throws JSON 行损坏时会跳过该行，避免单条坏记录阻断审计中心。
   */
  list(filters: SqlAuditFileStoreListFilters = {}): {
    items: SqlAuditRecord[];
    total: number;
  } {
    const records = this.readAll()
      .filter((item) => (filters.actorId ? item.actorId === filters.actorId : true))
      .filter((item) => (filters.moduleKey ? item.moduleKey === filters.moduleKey : true))
      .filter((item) =>
        filters.databaseRole ? item.databaseRole === filters.databaseRole : true,
      )
      .filter((item) => (filters.stage ? item.stage === filters.stage : true))
      .filter((item) =>
        filters.operationType ? item.operationType === filters.operationType : true,
      )
      .filter((item) => (filters.status ? item.status === filters.status : true))
      .filter((item) =>
        filters.tableName
          ? item.tables.some((table) => table.includes(filters.tableName as string))
          : true,
      )
      .filter((item) => (filters.requestId ? item.requestId === filters.requestId : true))
      .filter((item) => (filters.sessionId ? item.sessionId === filters.sessionId : true))
      .filter((item) => (filters.startAt ? item.createdAt >= filters.startAt : true))
      .filter((item) => (filters.endAt ? item.createdAt <= filters.endAt : true))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    const page = Math.max(filters.page ?? 1, 1);
    const requestedPageSize = filters.pageSize ?? (records.length || 1);
    const pageSize = Math.max(Math.min(requestedPageSize, 500), 1);
    const start = (page - 1) * pageSize;
    return {
      items: records.slice(start, start + pageSize),
      total: records.length,
    };
  }

  /**
   * 按主键读取单条 SQL 审计记录。
   *
   * @param id SQL 审计 ID。
   * @returns 命中记录；未命中时返回 `undefined`。
   * @throws 不抛出异常；损坏行由 `readAll` 跳过。
   */
  findById(id: string): SqlAuditRecord | undefined {
    return this.readAll().find((item) => item.id === id);
  }

  /**
   * 返回独立存储文件中的全部记录。
   *
   * @returns 按文件顺序读取到的记录数组。
   * @throws 不抛出异常；未启用或文件不存在时返回空数组。
   */
  readAll(): SqlAuditRecord[] {
    const config = this.resolveConfig();
    if (!config.enabled || !existsSync(config.filePath)) {
      return [];
    }

    return readFileSync(config.filePath, 'utf8')
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as SqlAuditRecord];
        } catch {
          return [];
        }
      });
  }

  private resolveConfig(): SqlAuditFileStoreConfig {
    const staticConfig = this.runtimeConfigOrStaticConfig as
      | SqlAuditFileStoreConfig
      | undefined;
    if (staticConfig && typeof staticConfig.enabled === 'boolean' && staticConfig.filePath) {
      return staticConfig;
    }

    const runtimeConfig = this.runtimeConfigOrStaticConfig as
      | LocalRuntimeConfigService
      | undefined;
    const repoRoot = runtimeConfig?.getRepoRoot?.() ?? process.cwd();
    return {
      enabled: process.env.SQL_AUDIT_INDEPENDENT_STORE_ENABLED === 'true',
      filePath:
        process.env.SQL_AUDIT_FILE_STORE_PATH ??
        join(repoRoot, '.runtime', 'sql-audit-records.jsonl'),
    };
  }
}

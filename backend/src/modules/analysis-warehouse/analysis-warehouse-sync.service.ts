import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { LianruanCrmOpenApiAdapterService } from '../crm-standard-api/lianruan-crm-openapi.adapter.service';
import { LianruanCrmConnectionConfigService } from '../governance/lianruan-crm-connection-config.service';
import { PermissionEnforcementService } from '../governance/permission-enforcement.service';
import { AnalysisWarehouseRepository } from './analysis-warehouse.repository';
import type {
  AnalysisWarehouseRawRecord,
  AnalysisWarehouseResource,
  AnalysisWarehouseResourceSyncSnapshot,
  AnalysisWarehouseSyncMode,
  AnalysisWarehouseSyncRunRecord,
  AnalysisWarehouseSyncSourceType,
  CrmUser,
} from '../../shared/types/domain';
import type {
  LianruanCrmOpenApiListQuery,
  LianruanCrmOpenApiResource,
} from '../crm-standard-api/lianruan-crm-openapi.types';
import { AnalysisWarehouseSqliteSnapshotImporterService } from './analysis-warehouse-sqlite-snapshot-importer.service';

const OPENAPI_RESOURCES: LianruanCrmOpenApiResource[] = [
  'users',
  'partners',
  'customers',
  'registrations',
  'opportunities',
  'quotes',
  'orders',
];

const WAREHOUSE_RESOURCES: AnalysisWarehouseResource[] = [
  'dictionaries',
  'rolePermissions',
  ...OPENAPI_RESOURCES,
  'permissions',
];

const SUPPORTED_SOURCE_TYPES: AnalysisWarehouseSyncSourceType[] = [
  'OPENAPI',
  'SQLITE_SNAPSHOT',
  'FILE_EXPORT',
];

const SENSITIVE_FIELD_PATTERN =
  /(token|secret|password|passwd|authorization|cookie|mobile|phone|email|身份证|证件|密钥|密码)/i;

export interface RunAnalysisWarehouseSyncRequest {
  sourceType?: AnalysisWarehouseSyncSourceType;
  mode?: AnalysisWarehouseSyncMode;
  resources?: string[];
  dryRun?: boolean;
  pageSize?: number;
  maxPages?: number;
}

@Injectable()
export class AnalysisWarehouseSyncService {
  constructor(
    private readonly repository: AnalysisWarehouseRepository,
    private readonly permissionEnforcementService: PermissionEnforcementService,
    private readonly lianruanCrmConnectionConfigService: LianruanCrmConnectionConfigService,
    private readonly lianruanCrmOpenApiAdapterService: LianruanCrmOpenApiAdapterService,
    @Optional()
    private readonly sqliteSnapshotImporterService?: AnalysisWarehouseSqliteSnapshotImporterService,
  ) {}

  /**
   * 读取智能分析数据仓库同步概览。
   *
   * 参数说明：`user` 为当前登录用户。
   * 返回值说明：返回同步配置状态、最近运行记录和资源快照数量。
   * 调用注意事项：该入口只做治理诊断，不返回业务明细数据。
   */
  async getOverview(user: CrmUser): Promise<Record<string, unknown>> {
    this.ensureAccess(user);
    const runtimeConfig =
      this.lianruanCrmConnectionConfigService.getEffectiveRuntimeConfig();
    const overview = await this.repository.getOverview();

    return {
      sourceStatus: this.buildSourceStatus(),
      openApi: {
        enabled: this.lianruanCrmOpenApiAdapterService.isEnabled(),
        baseUrl: runtimeConfig.baseUrl,
        timeoutMs: runtimeConfig.timeoutMs,
      },
      supportedResources: WAREHOUSE_RESOURCES,
      ...overview,
    };
  }

  /**
   * 触发一次数据仓库同步。
   *
   * 参数说明：
   * - `user`：当前治理操作者。
   * - `request`：同步来源、资源、分页和 dry-run 参数。
   * 返回值说明：返回本次同步运行记录。
   * 调用注意事项：OpenAPI 是正式主同步源；SQLite 只读取显式配置的只读快照目录，不直接读取生产库文件。
   */
  async runSync(
    user: CrmUser,
    request: RunAnalysisWarehouseSyncRequest = {},
  ): Promise<AnalysisWarehouseSyncRunRecord> {
    this.ensureAccess(user);

    const sourceType = this.normalizeSourceType(request.sourceType ?? 'OPENAPI');
    const resources = this.normalizeResources(request.resources);
    const mode = request.mode ?? 'INCREMENTAL';
    const startedAt = new Date().toISOString();
    const run: AnalysisWarehouseSyncRunRecord = {
      id: `warehouse_sync_${randomUUID()}`,
      sourceType,
      mode,
      dryRun: request.dryRun ?? false,
      status: 'RUNNING',
      requestedBy: user.id,
      requestedByName: user.name,
      resources,
      resourceResults: [],
      startedAt,
      configSnapshot: this.buildConfigSnapshot(sourceType),
    };

    await this.repository.saveRun(run);

    try {
      if (sourceType === 'SQLITE_SNAPSHOT') {
        return await this.runSqliteSnapshotSync(run, {
          pageSize: this.normalizePageSize(request.pageSize),
          maxPages: this.normalizeMaxPages(request.maxPages),
        });
      }

      if (sourceType !== 'OPENAPI') {
        return await this.finishSkippedRun(run, `${sourceType} 来源已纳入兼容规划，当前版本尚未启用自动抽取。`);
      }

      if (!this.lianruanCrmOpenApiAdapterService.isEnabled()) {
        return await this.finishFailedRun(run, '联软标准 OpenAPI 尚未启用，无法执行同步。');
      }

      const results: AnalysisWarehouseResourceSyncSnapshot[] = [];
      for (const resource of resources) {
        results.push(
          await this.syncOpenApiResource(run, resource, {
            pageSize: this.normalizePageSize(request.pageSize),
            maxPages: this.normalizeMaxPages(request.maxPages),
          }),
        );
      }

      return await this.finishRunWithResults(run, results);
    } catch (error) {
      return await this.finishFailedRun(
        run,
        error instanceof Error ? error.message : '数据仓库同步任务执行失败。',
      );
    }
  }

  /**
   * 执行 SQLite 只读快照同步。
   *
   * 参数说明：
   * - `run`：当前同步运行记录。
   * - `options`：单资源读取上限。
   * 返回值说明：返回本次同步运行最终状态。
   * 调用注意事项：该路径只读取快照副本目录，不读取联软生产 SQLite；未配置时明确跳过而不是猜测路径。
   */
  private async runSqliteSnapshotSync(
    run: AnalysisWarehouseSyncRunRecord,
    options: { pageSize: number; maxPages: number },
  ): Promise<AnalysisWarehouseSyncRunRecord> {
    if (!this.sqliteSnapshotImporterService?.isConfigured()) {
      return await this.finishSkippedRun(
        run,
        'SQLite 只读快照未启用或未配置快照目录，已跳过同步。',
      );
    }

    const results: AnalysisWarehouseResourceSyncSnapshot[] = [];
    for (const resource of run.resources) {
      results.push(await this.syncSqliteSnapshotResource(run, resource, options));
    }

    return await this.finishRunWithResults(run, results);
  }

  /**
   * 同步单个 SQLite 快照资源。
   *
   * 参数说明：
   * - `run`：当前同步运行记录。
   * - `resource`：目标资源。
   * - `options`：读取上限。
   * 返回值说明：返回资源级同步结果。
   * 调用注意事项：元数据资源不从 SQLite 快照读取，仍以 OpenAPI 权限和字典为准。
   */
  private async syncSqliteSnapshotResource(
    run: AnalysisWarehouseSyncRunRecord,
    resource: AnalysisWarehouseResource,
    options: { pageSize: number; maxPages: number },
  ): Promise<AnalysisWarehouseResourceSyncSnapshot> {
    if (
      resource === 'dictionaries' ||
      resource === 'rolePermissions' ||
      resource === 'permissions'
    ) {
      return {
        resource,
        status: 'SKIPPED',
        fetchedCount: 0,
        storedCount: 0,
        failureReason: 'SQLite 快照不承载字典和权限元数据，请继续通过标准 OpenAPI 同步。',
      };
    }

    try {
      const checkpoint = this.repository.getCheckpoint(run.sourceType, resource);
      const imported = await this.sqliteSnapshotImporterService!.importResource({
        resource,
        mode: run.mode,
        pageSize: options.pageSize,
        maxPages: options.maxPages,
        checkpointCursor: checkpoint?.cursor ?? checkpoint?.lastSyncedAt,
      });
      const records = imported.rows.map((row) =>
        this.buildRawRecord(run, resource, row.payload, row.sourceObjectId),
      );

      if (!run.dryRun && records.length > 0) {
        await this.repository.upsertRawRecords(records);
        await this.repository.saveCheckpoint({
          id: `warehouse_checkpoint_${run.sourceType}_${resource}`,
          sourceType: run.sourceType,
          resource,
          lastRunId: run.id,
          lastSyncedAt: new Date().toISOString(),
          cursor: imported.latestUpdatedAt,
          observedTotal: imported.total,
        });
      }

      return {
        resource,
        status: records.length > 0 ? 'SUCCEEDED' : 'EMPTY',
        fetchedCount: records.length,
        storedCount: run.dryRun ? 0 : records.length,
        total: imported.total,
        requestId: imported.snapshotFile
          ? `sqlite:${imported.snapshotFile}:${imported.tableName ?? resource}`
          : undefined,
        checkpointAt: imported.latestUpdatedAt,
      };
    } catch (error) {
      return {
        resource,
        status: 'FAILED',
        fetchedCount: 0,
        storedCount: 0,
        failureReason:
          error instanceof Error ? error.message : 'SQLite 快照资源同步失败。',
      };
    }
  }

  /**
   * 同步单个 OpenAPI 资源。
   *
   * 参数说明：
   * - `run`：当前同步运行记录。
   * - `resource`：目标资源。
   * - `options`：分页大小与页数上限。
   * 返回值说明：返回该资源同步结果快照。
   * 调用注意事项：字典和权限资源来自元数据接口；业务对象来自标准分页接口。
   */
  private async syncOpenApiResource(
    run: AnalysisWarehouseSyncRunRecord,
    resource: AnalysisWarehouseResource,
    options: { pageSize: number; maxPages: number },
  ): Promise<AnalysisWarehouseResourceSyncSnapshot> {
    try {
      if (
        resource === 'dictionaries' ||
        resource === 'rolePermissions' ||
        resource === 'permissions'
      ) {
        return await this.syncOpenApiMetadataResource(run, resource);
      }

      let total = 0;
      let requestId: string | undefined;
      const records: AnalysisWarehouseRawRecord[] = [];

      // 第一版限制页数，避免误把治理手动同步变成重型全量拉取；后续定时任务再开放完整增量。
      for (let pageNo = 1; pageNo <= options.maxPages; pageNo += 1) {
        const query = this.buildListQuery(run, resource, pageNo, options.pageSize);
        const page = await this.lianruanCrmOpenApiAdapterService.listResource(
          resource,
          query,
        );
        total = Number(page.total ?? total);
        requestId = page.requestId ?? requestId;

        for (const item of page.items) {
          records.push(this.buildRawRecord(run, resource, item));
        }

        if (page.items.length < options.pageSize) {
          break;
        }
      }

      if (!run.dryRun && records.length > 0) {
        const latestUpdatedAt = this.resolveLatestUpdatedAt(records);
        await this.repository.upsertRawRecords(records);
        await this.repository.saveCheckpoint({
          id: `warehouse_checkpoint_${run.sourceType}_${resource}`,
          sourceType: run.sourceType,
          resource,
          lastRunId: run.id,
          lastSyncedAt: new Date().toISOString(),
          cursor: latestUpdatedAt,
          observedTotal: total,
        });
      }

      return {
        resource,
        status: records.length > 0 ? 'SUCCEEDED' : 'EMPTY',
        fetchedCount: records.length,
        storedCount: run.dryRun ? 0 : records.length,
        total,
        requestId,
        checkpointAt: run.dryRun ? undefined : new Date().toISOString(),
      };
    } catch (error) {
      return {
        resource,
        status: 'FAILED',
        fetchedCount: 0,
        storedCount: 0,
        failureReason:
          error instanceof Error ? error.message : '联软标准 OpenAPI 资源同步失败。',
      };
    }
  }

  /**
   * 同步 OpenAPI 元数据资源。
   *
   * 参数说明：
   * - `run`：当前同步运行记录。
   * - `resource`：`dictionaries`、`rolePermissions` 或 `permissions`。
   * 返回值说明：返回元数据同步结果。
   * 调用注意事项：元数据不分页，但仍按资源粒度保存，便于后续语义层读取中文枚举和权限范围。
   */
  private async syncOpenApiMetadataResource(
    run: AnalysisWarehouseSyncRunRecord,
    resource: Extract<
      AnalysisWarehouseResource,
      'dictionaries' | 'rolePermissions' | 'permissions'
    >,
  ): Promise<AnalysisWarehouseResourceSyncSnapshot> {
    const snapshot = await this.lianruanCrmOpenApiAdapterService.getBootstrapSnapshot();
    const payload = await this.resolveMetadataPayload(resource, snapshot);
    const rawRecord = this.buildRawRecord(run, resource, payload, resource);

    if (!run.dryRun) {
      await this.repository.upsertRawRecords([rawRecord]);
      await this.repository.saveCheckpoint({
        id: `warehouse_checkpoint_${run.sourceType}_${resource}`,
        sourceType: run.sourceType,
        resource,
        lastRunId: run.id,
        lastSyncedAt: new Date().toISOString(),
        observedTotal: 1,
      });
    }

    return {
      resource,
      status: 'SUCCEEDED',
      fetchedCount: 1,
      storedCount: run.dryRun ? 0 : 1,
      total: 1,
      checkpointAt: run.dryRun ? undefined : new Date().toISOString(),
    };
  }

  /**
   * 构造联软 OpenAPI 列表查询参数。
   *
   * 参数说明：
   * - `run`：当前同步任务。
   * - `resource`：业务资源。
   * - `pageNo`：当前页码。
   * - `pageSize`：每页数量。
   * 返回值说明：返回分页、排序和增量过滤参数。
   * 调用注意事项：增量游标来自上一轮检查点，只用于缩小同步范围，不作为权限裁剪依据。
   */
  private buildListQuery(
    run: AnalysisWarehouseSyncRunRecord,
    resource: AnalysisWarehouseResource,
    pageNo: number,
    pageSize: number,
  ): LianruanCrmOpenApiListQuery {
    const query: LianruanCrmOpenApiListQuery = {
      pageNo,
      pageSize,
      sortBy: 'updatedAt',
      sortOrder: 'asc',
    };

    if (run.mode !== 'INCREMENTAL') {
      return query;
    }

    const checkpoint = this.repository.getCheckpoint(run.sourceType, resource);
    const updatedAfter = checkpoint?.cursor ?? checkpoint?.lastSyncedAt;
    if (updatedAfter) {
      query.updatedAfter = updatedAfter;
    }

    return query;
  }

  /**
   * 解析 OpenAPI 元数据同步载荷。
   *
   * 参数说明：
   * - `resource`：元数据资源名。
   * - `snapshot`：启动快照，包含字典和当前 client 权限。
   * 返回值说明：返回可写入仓库快照的普通对象。
   * 调用注意事项：角色权限矩阵使用独立接口读取，避免只保存当前 token 权限而缺少角色口径。
   */
  private async resolveMetadataPayload(
    resource: Extract<
      AnalysisWarehouseResource,
      'dictionaries' | 'rolePermissions' | 'permissions'
    >,
    snapshot: {
      dictionaries: unknown;
      permissionScope: unknown;
    },
  ): Promise<Record<string, unknown>> {
    if (resource === 'dictionaries') {
      return snapshot.dictionaries as Record<string, unknown>;
    }

    if (resource === 'rolePermissions') {
      return await this.lianruanCrmOpenApiAdapterService.getRolePermissions();
    }

    return snapshot.permissionScope as Record<string, unknown>;
  }

  /**
   * 构建可落库的原始快照记录。
   *
   * 参数说明：
   * - `run`：当前同步运行记录。
   * - `resource`：资源名。
   * - `payload`：远端返回的业务对象。
   * - `fallbackId`：无主键对象的兜底 ID。
   * 返回值说明：返回已脱敏并计算指纹的快照记录。
   * 调用注意事项：这里会屏蔽敏感字段，避免治理运行态文件泄露凭证或联系方式。
   */
  private buildRawRecord(
    run: AnalysisWarehouseSyncRunRecord,
    resource: AnalysisWarehouseResource,
    payload: Record<string, unknown>,
    fallbackId?: string,
  ): AnalysisWarehouseRawRecord {
    const sanitizedPayload = this.sanitizePayload(payload);
    const sourceObjectId = String(
      payload.id ??
        payload.userId ??
        payload.customerId ??
        payload.partnerId ??
        fallbackId ??
        randomUUID(),
    );
    const payloadJson = JSON.stringify(sanitizedPayload);

    return {
      id: `warehouse_raw_${run.sourceType}_${resource}_${sourceObjectId}`,
      sourceType: run.sourceType,
      resource,
      sourceObjectId,
      syncRunId: run.id,
      payload: sanitizedPayload,
      payloadFieldNames: Object.keys(sanitizedPayload).sort(),
      payloadHash: createHash('sha256').update(payloadJson).digest('hex'),
      syncedAt: new Date().toISOString(),
      updatedAt: this.extractUpdatedAt(payload),
    };
  }

  /**
   * 对同步快照做字段级脱敏。
   *
   * 参数说明：`payload` 为远端返回对象。
   * 返回值说明：返回脱敏后的浅层对象。
   * 调用注意事项：第一版只保存分析建模所需样本，不保存 token、secret、手机号、邮箱等敏感值。
   */
  private sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
    const sanitizedEntries = Object.entries(payload).map(([key, value]) => {
      if (SENSITIVE_FIELD_PATTERN.test(key)) {
        return [key, '[已脱敏]'] as const;
      }
      return [key, value] as const;
    });
    return Object.fromEntries(sanitizedEntries);
  }

  /**
   * 提取业务对象更新时间。
   *
   * 参数说明：`payload` 为远端业务对象。
   * 返回值说明：存在更新时间则返回字符串，否则返回 `undefined`。
   * 调用注意事项：仅用于后续增量同步候选，不用于权限判断。
   */
  private extractUpdatedAt(payload: Record<string, unknown>): string | undefined {
    const value = payload.updatedAt ?? payload.updateTime ?? payload.modifiedAt;
    return typeof value === 'string' ? value : undefined;
  }

  /**
   * 从本次同步记录中提取最新更新时间游标。
   *
   * 参数说明：`records` 为已构建的仓库原始快照。
   * 返回值说明：返回最大 `updatedAt`，没有则返回 `undefined`。
   * 调用注意事项：仅用于下一轮增量请求的候选条件，不能代表数据完整性校验结果。
   */
  private resolveLatestUpdatedAt(records: AnalysisWarehouseRawRecord[]): string | undefined {
    return records
      .map((record) => record.updatedAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1);
  }

  /**
   * 根据资源结果结束同步任务。
   *
   * 参数说明：
   * - `run`：当前同步运行记录。
   * - `results`：各资源同步结果。
   * 返回值说明：返回最终运行记录。
   * 调用注意事项：部分资源失败时标记为 `PARTIAL_FAILED`，不掩盖已成功资源。
   */
  private async finishRunWithResults(
    run: AnalysisWarehouseSyncRunRecord,
    results: AnalysisWarehouseResourceSyncSnapshot[],
  ): Promise<AnalysisWarehouseSyncRunRecord> {
    const failedCount = results.filter((item) => item.status === 'FAILED').length;
    const succeededOrEmptyCount = results.filter(
      (item) => item.status === 'SUCCEEDED' || item.status === 'EMPTY',
    ).length;

    run.resourceResults = results;
    run.status =
      failedCount === 0
        ? 'SUCCEEDED'
        : succeededOrEmptyCount > 0
          ? 'PARTIAL_FAILED'
          : 'FAILED';
    run.failureReason =
      failedCount > 0 ? `${failedCount} 类资源同步失败，请查看 resourceResults。` : undefined;
    return await this.finishRun(run);
  }

  /**
   * 将同步任务结束为跳过状态。
   *
   * 参数说明：
   * - `run`：当前同步运行记录。
   * - `reason`：跳过原因。
   * 返回值说明：返回最终运行记录。
   * 调用注意事项：SQLite / 文件来源未启用时用跳过表达兼容状态，避免误判为系统故障。
   */
  private async finishSkippedRun(
    run: AnalysisWarehouseSyncRunRecord,
    reason: string,
  ): Promise<AnalysisWarehouseSyncRunRecord> {
    run.status = 'SKIPPED';
    run.failureReason = reason;
    run.resourceResults = run.resources.map((resource) => ({
      resource,
      status: 'SKIPPED',
      fetchedCount: 0,
      storedCount: 0,
      failureReason: reason,
    }));
    return await this.finishRun(run);
  }

  /**
   * 将同步任务结束为失败状态。
   *
   * 参数说明：
   * - `run`：当前同步运行记录。
   * - `reason`：失败原因。
   * 返回值说明：返回最终运行记录。
   * 调用注意事项：失败记录保留在运行态，便于治理页和联调记录追溯。
   */
  private async finishFailedRun(
    run: AnalysisWarehouseSyncRunRecord,
    reason: string,
  ): Promise<AnalysisWarehouseSyncRunRecord> {
    run.status = 'FAILED';
    run.failureReason = reason;
    return await this.finishRun(run);
  }

  /**
   * 统一补齐同步任务结束时间和耗时。
   *
   * 参数说明：`run` 为当前同步运行记录。
   * 返回值说明：返回最终运行记录。
   * 调用注意事项：所有结束路径都必须经过这里，确保运行记录可审计。
   */
  private async finishRun(
    run: AnalysisWarehouseSyncRunRecord,
  ): Promise<AnalysisWarehouseSyncRunRecord> {
    run.finishedAt = new Date().toISOString();
    run.durationMs = Math.max(
      new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime(),
      0,
    );
    return await this.repository.updateRun(run);
  }

  /**
   * 校验治理同步权限。
   *
   * 参数说明：`user` 为当前登录用户。
   * 返回值说明：无返回值；无权限时直接抛错。
   * 调用注意事项：复用治理策略管理权限，避免给数仓同步另开绕过入口。
   */
  private ensureAccess(user: CrmUser): void {
    this.permissionEnforcementService.ensureAction(
      user,
      'governance.policy.manage',
      '当前用户无权管理智能分析数据仓库同步。',
      {
        channel: 'web-console',
        resourceType: 'analysis-warehouse-sync',
      },
    );
  }

  /**
   * 标准化同步来源类型。
   *
   * 参数说明：`sourceType` 为请求传入的来源类型。
   * 返回值说明：返回受支持的来源枚举。
   * 调用注意事项：非法来源直接阻断，避免调用方构造未知抽取链路。
   */
  private normalizeSourceType(
    sourceType: AnalysisWarehouseSyncSourceType,
  ): AnalysisWarehouseSyncSourceType {
    if (!SUPPORTED_SOURCE_TYPES.includes(sourceType)) {
      throw new BadRequestException(
        `当前仅支持以下同步来源：${SUPPORTED_SOURCE_TYPES.join(', ')}`,
      );
    }
    return sourceType;
  }

  /**
   * 标准化资源列表。
   *
   * 参数说明：`resources` 为请求传入资源名数组。
   * 返回值说明：返回受支持资源列表；未传时默认同步全部标准资源和元数据。
   * 调用注意事项：资源白名单是同步链路第一道边界，不能让任意表名进入后续 SQL 能力。
   */
  private normalizeResources(resources?: string[]): AnalysisWarehouseResource[] {
    if (!Array.isArray(resources) || resources.length === 0) {
      return [...WAREHOUSE_RESOURCES];
    }

    const normalizedResources = resources
      .map((item) => this.normalizeResourceAlias(item))
      .filter(Boolean);
    const invalidResources = normalizedResources.filter(
      (item) => !WAREHOUSE_RESOURCES.includes(item as AnalysisWarehouseResource),
    );
    if (invalidResources.length > 0) {
      throw new BadRequestException(
        `暂不支持这些同步资源：${invalidResources.join(', ')}`,
      );
    }

    return Array.from(new Set(normalizedResources)) as AnalysisWarehouseResource[];
  }

  /**
   * 兼容联软文档中的接口路径命名和我方内部资源名。
   *
   * 参数说明：`resource` 为请求传入的资源名或接口片段。
   * 返回值说明：返回内部资源名。
   * 调用注意事项：只做明确别名映射，不允许任意路径进入同步链路。
   */
  private normalizeResourceAlias(resource: string): string {
    const normalizedValue = resource.trim();
    const aliasMap: Record<string, AnalysisWarehouseResource> = {
      'meta/dictionaries': 'dictionaries',
      dictionaries: 'dictionaries',
      'meta/role-permissions': 'rolePermissions',
      'role-permissions': 'rolePermissions',
      rolePermissions: 'rolePermissions',
      'meta/permission-scope': 'permissions',
      'permission-scope': 'permissions',
      permissions: 'permissions',
    };

    return aliasMap[normalizedValue] ?? normalizedValue;
  }

  /**
   * 标准化分页大小。
   *
   * 参数说明：`pageSize` 为请求传入分页大小。
   * 返回值说明：返回 1 到 200 之间的分页大小。
   * 调用注意事项：按联软 P0 回传规则限制单页最大 200，避免治理入口对联软服务造成突发压力。
   */
  private normalizePageSize(pageSize?: number): number {
    const value = Number(pageSize ?? 200);
    if (!Number.isFinite(value)) {
      return 200;
    }
    return Math.min(Math.max(Math.trunc(value), 1), 200);
  }

  /**
   * 标准化最大同步页数。
   *
   * 参数说明：`maxPages` 为请求传入页数上限。
   * 返回值说明：返回 1 到 20 之间的页数上限。
   * 调用注意事项：第一版手动同步先限流，后续定时增量任务再放开更大批次。
   */
  private normalizeMaxPages(maxPages?: number): number {
    const value = Number(maxPages ?? 1);
    if (!Number.isFinite(value)) {
      return 1;
    }
    return Math.min(Math.max(Math.trunc(value), 1), 20);
  }

  /**
   * 读取同步来源状态。
   *
   * 参数说明：无。
   * 返回值说明：返回三种来源当前是否可自动同步。
   * 调用注意事项：SQLite 与文件来源先作为兼容入口展示，不默认读取生产 SQLite。
   */
  private buildSourceStatus(): Record<string, unknown> {
    return {
      openApi: {
        enabled: this.lianruanCrmOpenApiAdapterService.isEnabled(),
        statusLabel: '标准 OpenAPI',
      },
      sqliteSnapshot: {
        ...(this.sqliteSnapshotImporterService?.getStatus() ?? {
          enabled: process.env.LIANRUAN_CRM_SQLITE_SNAPSHOT_ENABLED === 'true',
          snapshotDirConfigured: Boolean(process.env.LIANRUAN_CRM_SQLITE_SNAPSHOT_DIR),
          statusLabel: 'SQLite 只读快照',
        }),
        statusLabel: 'SQLite 只读快照',
      },
      fileExport: {
        enabled: process.env.LIANRUAN_CRM_FILE_EXPORT_ENABLED === 'true',
        importDirConfigured: Boolean(process.env.LIANRUAN_CRM_FILE_EXPORT_DIR),
        statusLabel: '文件导出导入',
      },
    };
  }

  /**
   * 构建本次同步配置快照。
   *
   * 参数说明：`sourceType` 为本次同步来源。
   * 返回值说明：返回只含布尔状态的配置快照。
   * 调用注意事项：快照严禁保存 Base URL 之外的敏感凭证，尤其不能保存 Secret 或 token。
   */
  private buildConfigSnapshot(sourceType: AnalysisWarehouseSyncSourceType) {
    const openApiEnabled = this.lianruanCrmOpenApiAdapterService.isEnabled();
    const sqliteSnapshotEnabled =
      process.env.LIANRUAN_CRM_SQLITE_SNAPSHOT_ENABLED === 'true' &&
      Boolean(process.env.LIANRUAN_CRM_SQLITE_SNAPSHOT_DIR);
    const fileExportEnabled =
      process.env.LIANRUAN_CRM_FILE_EXPORT_ENABLED === 'true' &&
      Boolean(process.env.LIANRUAN_CRM_FILE_EXPORT_DIR);

    return {
      sourceConfigured:
        sourceType === 'OPENAPI'
          ? openApiEnabled
          : sourceType === 'SQLITE_SNAPSHOT'
            ? sqliteSnapshotEnabled
            : fileExportEnabled,
      openApiEnabled,
      sqliteSnapshotEnabled,
      fileExportEnabled,
    };
  }
}

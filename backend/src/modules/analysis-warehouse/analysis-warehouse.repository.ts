import { Injectable, Optional } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import { AnalysisWarehouseMysqlService } from '../../database/analysis-warehouse/analysis-warehouse-mysql.service';
import type {
  AnalysisWarehouseRawRecord,
  AnalysisWarehouseResource,
  AnalysisWarehouseSyncCheckpointRecord,
  AnalysisWarehouseSyncRunRecord,
  AnalysisWarehouseSyncSourceType,
} from '../../shared/types/domain';

@Injectable()
export class AnalysisWarehouseRepository {
  constructor(
    private readonly appStorageService: AppStorageService,
    @Optional()
    private readonly analysisWarehouseMysqlService?: AnalysisWarehouseMysqlService,
  ) {}

  /**
   * 读取数据仓库同步概览。
   *
   * 参数说明：无。
   * 返回值说明：返回最近同步记录、资源快照数量和同步检查点。
   * 调用注意事项：当前第一版基于 AppStorage 保存同步元数据，后续可平滑替换为正式仓库表。
   */
  async getOverview(): Promise<{
    lastRun?: AnalysisWarehouseSyncRunRecord;
    rawRecordCountByResource: Record<string, number>;
    checkpoints: AnalysisWarehouseSyncCheckpointRecord[];
    mysqlWarehouse?: Record<string, unknown>;
  }> {
    const runs = this.listRuns(1);
    const rawRecordCountByResource: Record<string, number> = {};

    // 统计每个资源已缓存的原始快照数量，用于治理页判断数仓是否已有可分析底座。
    for (const record of this.appStorageService.state.analysisWarehouseRawRecords) {
      rawRecordCountByResource[record.resource] =
        (rawRecordCountByResource[record.resource] ?? 0) + 1;
    }

    return {
      lastRun: runs[0],
      rawRecordCountByResource,
      checkpoints: [...this.appStorageService.state.analysisWarehouseSyncCheckpoints],
      mysqlWarehouse: await this.analysisWarehouseMysqlService?.getOverview(),
    };
  }

  /**
   * 按时间倒序读取同步运行记录。
   *
   * 参数说明：`limit` 为最大返回条数。
   * 返回值说明：返回最近的同步运行记录。
   * 调用注意事项：只返回内存态浅拷贝，避免调用方意外修改运行态状态。
   */
  listRuns(limit = 20): AnalysisWarehouseSyncRunRecord[] {
    return [...this.appStorageService.state.analysisWarehouseSyncRuns]
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
      .slice(0, limit)
      .map((item) => ({
        ...item,
        resources: [...item.resources],
        resourceResults: item.resourceResults.map((result) => ({ ...result })),
        configSnapshot: { ...item.configSnapshot },
      }));
  }

  /**
   * 保存新的同步运行记录。
   *
   * 参数说明：`run` 为完整同步运行记录。
   * 返回值说明：返回已保存记录。
   * 调用注意事项：运行记录只保存配置状态，不保存凭证明文。
   */
  async saveRun(run: AnalysisWarehouseSyncRunRecord): Promise<AnalysisWarehouseSyncRunRecord> {
    this.appStorageService.state.analysisWarehouseSyncRuns.unshift(run);
    this.trimRuns();
    this.appStorageService.persist();
    await this.analysisWarehouseMysqlService?.upsertSyncRun(run);
    return run;
  }

  /**
   * 更新已有同步运行记录。
   *
   * 参数说明：`run` 为需要覆盖的运行记录。
   * 返回值说明：返回已更新记录。
   * 调用注意事项：如果记录不存在则追加，避免异常中断后丢失审计线索。
   */
  async updateRun(run: AnalysisWarehouseSyncRunRecord): Promise<AnalysisWarehouseSyncRunRecord> {
    const runs = this.appStorageService.state.analysisWarehouseSyncRuns;
    const index = runs.findIndex((item) => item.id === run.id);
    if (index >= 0) {
      runs[index] = run;
    } else {
      runs.unshift(run);
    }
    this.trimRuns();
    this.appStorageService.persist();
    await this.analysisWarehouseMysqlService?.upsertSyncRun(run);
    return run;
  }

  /**
   * 批量写入或更新资源原始快照。
   *
   * 参数说明：`records` 为已脱敏、已计算指纹的资源快照。
   * 返回值说明：返回实际写入数量。
   * 调用注意事项：以 `sourceType + resource + sourceObjectId` 作为幂等键，避免重复同步撑爆运行态文件。
   */
  async upsertRawRecords(records: AnalysisWarehouseRawRecord[]): Promise<number> {
    const stateRecords = this.appStorageService.state.analysisWarehouseRawRecords;

    // 对每条业务对象做幂等覆盖，保留最新一次同步运行来源，便于后续追溯。
    for (const record of records) {
      const existingIndex = stateRecords.findIndex(
        (item) =>
          item.sourceType === record.sourceType &&
          item.resource === record.resource &&
          item.sourceObjectId === record.sourceObjectId,
      );
      if (existingIndex >= 0) {
        stateRecords[existingIndex] = record;
      } else {
        stateRecords.push(record);
      }
    }

    this.appStorageService.persist();
    await this.analysisWarehouseMysqlService?.upsertRawRecords(records);
    return records.length;
  }

  /**
   * 保存资源同步检查点。
   *
   * 参数说明：`checkpoint` 为资源同步完成后的游标与时间。
   * 返回值说明：返回已保存检查点。
   * 调用注意事项：检查点不参与权限放行，只用于增量同步和新鲜度提示。
   */
  saveCheckpoint(
    checkpoint: AnalysisWarehouseSyncCheckpointRecord,
  ): Promise<AnalysisWarehouseSyncCheckpointRecord> {
    const checkpoints = this.appStorageService.state.analysisWarehouseSyncCheckpoints;
    const index = checkpoints.findIndex(
      (item) =>
        item.sourceType === checkpoint.sourceType &&
        item.resource === checkpoint.resource,
    );
    if (index >= 0) {
      checkpoints[index] = checkpoint;
    } else {
      checkpoints.push(checkpoint);
    }
    this.appStorageService.persist();
    return this.analysisWarehouseMysqlService
      ?.saveCheckpoint(checkpoint)
      .then(() => checkpoint) ?? Promise.resolve(checkpoint);
  }

  /**
   * 读取单资源检查点。
   *
   * 参数说明：
   * - `sourceType`：同步来源类型。
   * - `resource`：资源名。
   * 返回值说明：存在则返回检查点，否则返回 `undefined`。
   * 调用注意事项：只用于同步任务判断增量边界，不能作为数据权限依据。
   */
  getCheckpoint(
    sourceType: AnalysisWarehouseSyncSourceType,
    resource: AnalysisWarehouseResource,
  ): AnalysisWarehouseSyncCheckpointRecord | undefined {
    const checkpoint = this.appStorageService.state.analysisWarehouseSyncCheckpoints.find(
      (item) => item.sourceType === sourceType && item.resource === resource,
    );
    return checkpoint ? { ...checkpoint } : undefined;
  }

  /**
   * 控制本地运行记录数量。
   *
   * 参数说明：无。
   * 返回值说明：无返回值。
   * 调用注意事项：AppStorage 是轻量运行态，不适合无限增长；正式审计后续应进入专门审计表。
   */
  private trimRuns(): void {
    const runs = this.appStorageService.state.analysisWarehouseSyncRuns;
    if (runs.length <= 100) {
      return;
    }
    this.appStorageService.state.analysisWarehouseSyncRuns = runs.slice(0, 100);
  }
}

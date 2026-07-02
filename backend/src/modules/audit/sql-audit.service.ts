import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type {
  RiskLevel,
  SqlAuditDatabaseRole,
  SqlAuditModuleKey,
  SqlAuditOperationType,
  SqlAuditRecord,
  SqlAuditStage,
  SqlAuditStatus,
} from '../../shared/types/domain';
import { buildEntityId } from '../../shared/utils/id.util';
import {
  SqlAuditContextService,
} from './sql-audit-context.service';
import { SqlAuditRepository } from './sql-audit.repository';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';

interface ExecuteSqlAuditOptions<TResult> {
  sql: string;
  params?: unknown[];
  databaseRole: SqlAuditDatabaseRole;
  execute: () => Promise<TResult>;
  suppressAudit?: boolean;
  stage?: Exclude<SqlAuditStage, 'BLOCKED' | 'PREPARED'>;
  timeoutMs?: number;
  moduleKey?: SqlAuditModuleKey;
  programName?: string;
}

interface RecordBlockedSqlAuditOptions {
  sql: string;
  params?: unknown[];
  databaseRole: SqlAuditDatabaseRole;
  blockedReason: string;
  moduleKey?: SqlAuditModuleKey;
  programName?: string;
}

@Injectable()
export class SqlAuditService {
  private readonly asyncEnabled =
    process.env.SQL_AUDIT_ASYNC_ENABLED === 'true';
  private readonly asyncFlushIntervalMs = Number(
    process.env.SQL_AUDIT_ASYNC_FLUSH_INTERVAL_MS ?? '1000',
  );
  private readonly asyncQueueMaxRecords = Number(
    process.env.SQL_AUDIT_ASYNC_QUEUE_MAX_RECORDS ?? '5000',
  );
  private readonly asyncQueue: SqlAuditRecord[] = [];
  private asyncFlushTimer?: NodeJS.Timeout;
  private asyncFlushInProgress?: Promise<void>;

  constructor(
    private readonly sqlAuditRepository: SqlAuditRepository,
    private readonly sqlAuditContextService: SqlAuditContextService,
    private readonly analysisLoggerService: AnalysisLoggerService = {
      logStep: () => undefined,
      logWarn: () => undefined,
    } as never,
  ) {}

  /**
   * 包裹真实 SQL 执行过程，参数为 SQL 元数据与真实执行器，返回原始执行结果。
   */
  async execute<TResult>(
    options: ExecuteSqlAuditOptions<TResult>,
  ): Promise<TResult> {
    if (options.suppressAudit) {
      return await options.execute();
    }

    const startedAt = Date.now();

    try {
      const result = await options.execute();
      const metrics = this.extractExecutionMetrics(result);
      this.writeRecord(
        this.buildRecord({
          sql: options.sql,
          params: options.params,
          databaseRole: options.databaseRole,
          stage: options.stage ?? this.resolveStage(options.sql),
          status: 'SUCCEEDED',
          durationMs: Date.now() - startedAt,
          timeoutMs: options.timeoutMs,
          rowCount: metrics.rowCount,
          affectedRows: metrics.affectedRows,
          moduleKey: options.moduleKey,
          programName: options.programName,
        }),
      );
      return result;
    } catch (error) {
      this.writeRecord(
        this.buildRecord({
          sql: options.sql,
          params: options.params,
          databaseRole: options.databaseRole,
          stage: 'FAILED',
          status: 'FAILED',
          durationMs: Date.now() - startedAt,
          timeoutMs: options.timeoutMs,
          errorMessage: error instanceof Error ? error.message : 'unknown',
          moduleKey: options.moduleKey,
          programName: options.programName,
        }),
      );
      throw error;
    }
  }

  /**
   * 为执行前被阻断的候选 SQL 生成审计记录，参数为 SQL 文本、参数和阻断原因。
   */
  recordBlocked(options: RecordBlockedSqlAuditOptions): SqlAuditRecord {
    const record = this.buildRecord({
        sql: options.sql,
        params: options.params,
        databaseRole: options.databaseRole,
        stage: 'BLOCKED',
        status: 'BLOCKED',
        blockedReason: options.blockedReason,
        errorMessage: options.blockedReason,
        moduleKey: options.moduleKey,
        programName: options.programName,
      });
    this.writeRecord(record);
    return record;
  }

  /**
   * 测试与进程退出前使用的显式刷盘入口。
   *
   * @returns 队列刷新完成后 resolve。
   * @throws 不向上抛出单条写入异常，异常会进入告警日志。
   */
  async flushAsyncQueueForTest(): Promise<void> {
    await this.flushAsyncQueue();
  }

  /**
   * 将完整参数解析成前端 reveal 可消费的 JSON 值。
   */
  parseParams(record: SqlAuditRecord): unknown[] {
    if (!record.paramsJson.trim()) {
      return [];
    }

    try {
      const parsed = JSON.parse(record.paramsJson) as unknown[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * 构造统一 SQL 审计实体，避免不同入口重复实现指纹、脱敏和上下文补全逻辑。
   */
  private buildRecord(params: {
    sql: string;
    params?: unknown[];
    databaseRole: SqlAuditDatabaseRole;
    stage: SqlAuditStage;
    status: SqlAuditStatus;
    durationMs?: number;
    timeoutMs?: number;
    rowCount?: number;
    affectedRows?: number;
    blockedReason?: string;
    errorMessage?: string;
    moduleKey?: SqlAuditModuleKey;
    programName?: string;
  }): SqlAuditRecord {
    const currentContext = this.sqlAuditContextService.getContext();
    const context = this.sqlAuditContextService.resolveContext();
    const normalizedSql = this.normalizeSql(params.sql);
    const operationType = this.resolveOperationType(normalizedSql);
    const tables = this.extractTables(normalizedSql);
    const serializedParams = this.safeJsonStringify(params.params ?? []);

    return {
      id: buildEntityId('sql_audit'),
      createdAt: new Date().toISOString(),
      stage: params.stage,
      status: params.status,
      riskLevel: this.resolveRiskLevel({
        databaseRole: params.databaseRole,
        status: params.status,
        operationType,
      }),
      actorId: context.actorId,
      actorRoleIds: [...context.actorRoleIds],
      channel: context.channel,
      sessionId: context.sessionId,
      requestId: context.requestId,
      moduleKey:
        currentContext?.moduleKey ?? params.moduleKey ?? context.moduleKey ?? 'system',
      programName:
        currentContext?.programName ?? params.programName ?? context.programName ?? 'system',
      databaseRole: params.databaseRole,
      operationType,
      tables,
      sqlText: params.sql,
      sqlSummary: this.buildSqlSummary(normalizedSql),
      paramsJson: serializedParams,
      paramSummary: this.buildParamSummary(params.params ?? []),
      normalizedSql,
      sqlFingerprint: this.buildSqlFingerprint(normalizedSql),
      rowCount: params.rowCount,
      affectedRows: params.affectedRows,
      durationMs: params.durationMs,
      timeoutMs: params.timeoutMs,
      executionMode: context.executionMode,
      executionSource: context.executionSource,
      matchedAdapter: context.matchedAdapter,
      fallbackReason: context.fallbackReason,
      blockedReason: params.blockedReason,
      errorMessage: params.errorMessage,
    };
  }

  /**
   * 写入 SQL 审计记录，普通只读成功记录可进入异步队列，高风险记录保持同步。
   *
   * @param record 标准化后的 SQL 审计记录。
   * @returns 无返回值。
   * @throws 同步高风险写入失败时向上抛出；异步低风险写入失败仅记录降级日志。
   */
  private writeRecord(record: SqlAuditRecord): void {
    if (this.shouldWriteAsync(record)) {
      this.enqueueAsyncRecord(record);
      return;
    }

    const startedAt = Date.now();
    this.sqlAuditRepository.create(record);
    this.analysisLoggerService.logStep('SQL 审计同步持久化完成。', {
      auditId: record.id,
      moduleKey: record.moduleKey,
      databaseRole: record.databaseRole,
      status: record.status,
      durationMs: Date.now() - startedAt,
    });
  }

  private shouldWriteAsync(record: SqlAuditRecord): boolean {
    return (
      this.asyncEnabled &&
      (record.databaseRole === 'CRM_READONLY' ||
        record.databaseRole === 'ANALYSIS_WAREHOUSE') &&
      record.status === 'SUCCEEDED' &&
      record.riskLevel === 'LOW' &&
      record.stage !== 'BLOCKED'
    );
  }

  private enqueueAsyncRecord(record: SqlAuditRecord): void {
    if (
      Number.isFinite(this.asyncQueueMaxRecords) &&
      this.asyncQueueMaxRecords > 0 &&
      this.asyncQueue.length >= this.asyncQueueMaxRecords
    ) {
      this.analysisLoggerService.logWarn('SQL 审计异步队列已满，低风险只读审计进入降级。', {
        queueLength: this.asyncQueue.length,
        maxRecords: this.asyncQueueMaxRecords,
        moduleKey: record.moduleKey,
        programName: record.programName,
      });
      return;
    }

    this.asyncQueue.push(record);
    this.analysisLoggerService.logStep('SQL 审计已进入异步队列。', {
      auditId: record.id,
      moduleKey: record.moduleKey,
      queueLength: this.asyncQueue.length,
      maxRecords: this.asyncQueueMaxRecords,
    });
    this.scheduleAsyncFlush();
  }

  private scheduleAsyncFlush(): void {
    if (this.asyncFlushTimer) {
      return;
    }

    const delayMs =
      Number.isFinite(this.asyncFlushIntervalMs) && this.asyncFlushIntervalMs > 0
        ? this.asyncFlushIntervalMs
        : 1000;
    this.asyncFlushTimer = setTimeout(() => {
      this.asyncFlushTimer = undefined;
      void this.flushAsyncQueue();
    }, delayMs);
    this.asyncFlushTimer.unref?.();
  }

  private async flushAsyncQueue(): Promise<void> {
    if (this.asyncFlushTimer) {
      clearTimeout(this.asyncFlushTimer);
      this.asyncFlushTimer = undefined;
    }

    if (this.asyncFlushInProgress) {
      await this.asyncFlushInProgress;
      return;
    }

    this.asyncFlushInProgress = (async () => {
      const startedAt = Date.now();
      let flushedCount = 0;
      while (this.asyncQueue.length > 0) {
        const record = this.asyncQueue.shift();
        if (!record) {
          continue;
        }

        try {
          this.sqlAuditRepository.create(record);
          flushedCount += 1;
        } catch (error) {
          this.analysisLoggerService.logWarn('SQL 审计异步刷盘失败。', {
            auditId: record.id,
            moduleKey: record.moduleKey,
            reason: error instanceof Error ? error.message : 'unknown',
          });
        }
      }

      if (flushedCount > 0) {
        this.analysisLoggerService.logStep('SQL 审计异步刷盘完成。', {
          flushedCount,
          durationMs: Date.now() - startedAt,
          queueLength: this.asyncQueue.length,
        });
      }
    })().finally(() => {
      this.asyncFlushInProgress = undefined;
    });

    await this.asyncFlushInProgress;
  }

  /**
   * 从 mysql 查询结果中提取行数与影响行数，兼容 SELECT 与写操作返回结构。
   */
  private extractExecutionMetrics(result: unknown): {
    rowCount?: number;
    affectedRows?: number;
  } {
    if (!Array.isArray(result) || result.length === 0) {
      return {};
    }

    const payload = result[0] as unknown;
    if (Array.isArray(payload)) {
      return {
        rowCount: payload.length,
      };
    }

    if (payload && typeof payload === 'object') {
      const affectedRows = (payload as { affectedRows?: unknown }).affectedRows;
      if (typeof affectedRows === 'number') {
        return {
          affectedRows,
        };
      }
    }

    return {};
  }

  /**
   * 统一规范 SQL 文本，便于做指纹、摘要和按表聚合。
   */
  private normalizeSql(sql: string): string {
    return sql.replace(/\s+/gu, ' ').trim();
  }

  /**
   * 根据 SQL 前缀识别执行类型，预检 SQL 单独归入 EXPLAIN。
   */
  private resolveOperationType(sql: string): SqlAuditOperationType {
    const normalized = sql.trim().toUpperCase();
    if (normalized.startsWith('EXPLAIN ')) {
      return 'EXPLAIN';
    }
    if (normalized.startsWith('SELECT ')) {
      return 'SELECT';
    }
    if (normalized.startsWith('INSERT ')) {
      return 'INSERT';
    }
    if (normalized.startsWith('UPDATE ')) {
      return 'UPDATE';
    }
    if (normalized.startsWith('DELETE ')) {
      return 'DELETE';
    }
    return 'UNKNOWN';
  }

  /**
   * 根据 SQL 文本推断默认阶段，预检 SQL 固定落入 PREFLIGHT，其余默认为 EXECUTED。
   */
  private resolveStage(sql: string): Exclude<SqlAuditStage, 'BLOCKED' | 'PREPARED'> {
    return this.resolveOperationType(sql) === 'EXPLAIN' ? 'PREFLIGHT' : 'EXECUTED';
  }

  /**
   * 从 SQL 文本中提取命中表名集合，优先覆盖 SELECT、JOIN、INSERT、UPDATE 和 DELETE 入口。
   */
  private extractTables(sql: string): string[] {
    const tables = new Set<string>();
    const tablePattern =
      /\b(?:FROM|JOIN|UPDATE|INTO|DELETE\s+FROM)\s+([`"a-zA-Z0-9_.]+)/giu;
    for (const match of sql.matchAll(tablePattern)) {
      const rawTable = String(match[1] ?? '').trim();
      if (!rawTable) {
        continue;
      }

      tables.add(rawTable.replace(/[`"]/gu, ''));
    }

    return [...tables];
  }

  /**
   * 为 SQL 生成稳定指纹，避免前端和统计查询直接依赖完整 SQL 文本。
   */
  private buildSqlFingerprint(normalizedSql: string): string {
    return createHash('sha256')
      .update(normalizedSql)
      .digest('hex')
      .slice(0, 16);
  }

  /**
   * 构造脱敏 SQL 摘要，移除明显字面量并限制长度，避免摘要接口直接暴露敏感值。
   */
  private buildSqlSummary(normalizedSql: string): string {
    const maskedSql = normalizedSql
      .replace(/'[^']*'/gu, "'***'")
      .replace(/\b\d+\b/gu, '?');
    if (maskedSql.length <= 240) {
      return maskedSql;
    }

    return `${maskedSql.slice(0, 237)}...`;
  }

  /**
   * 仅保留参数个数、类型和简短摘要，避免普通详情接口直接下发完整参数值。
   */
  private buildParamSummary(params: unknown[]): string {
    if (params.length === 0) {
      return '无参数';
    }

    return params
      .map((item, index) => {
        const type = Array.isArray(item) ? 'array' : typeof item;
        if (item === null) {
          return `参数${index + 1}:null`;
        }

        if (type === 'string') {
          return `参数${index + 1}:string(${String(item).length})`;
        }

        if (type === 'object') {
          const keys = Object.keys(item as Record<string, unknown>).length;
          return `参数${index + 1}:object(${keys})`;
        }

        return `参数${index + 1}:${type}`;
      })
      .join('，');
  }

  /**
   * 统一给 SQL 审计分配风险等级，写库与失败/阻断记录会自动上调风险。
   */
  private resolveRiskLevel(params: {
    databaseRole: SqlAuditDatabaseRole;
    status: SqlAuditStatus;
    operationType: SqlAuditOperationType;
  }): RiskLevel {
    if (params.databaseRole === 'CRM_WRITEBACK') {
      return 'HIGH';
    }

    if (params.status === 'FAILED' || params.status === 'BLOCKED') {
      return 'MEDIUM';
    }

    if (params.operationType === 'EXPLAIN') {
      return 'LOW';
    }

    return 'LOW';
  }

  /**
   * 将任意参数安全序列化为 JSON 文本，避免 BigInt 或循环结构直接导致审计写入失败。
   */
  private safeJsonStringify(value: unknown): string {
    try {
      return JSON.stringify(this.normalizeJsonValue(value));
    } catch {
      return '[]';
    }
  }

  /**
   * 递归归一化参数值，保证 reveal 时仍能拿到稳定 JSON 结构。
   */
  private normalizeJsonValue(value: unknown): unknown {
    if (value === undefined) {
      return null;
    }

    if (typeof value === 'bigint') {
      return value.toString();
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeJsonValue(item));
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [
          key,
          this.normalizeJsonValue(item),
        ]),
      );
    }

    return value;
  }
}

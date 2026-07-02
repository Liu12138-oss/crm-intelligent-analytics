import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import mysql, {
  type Pool,
  type ResultSetHeader,
  type RowDataPacket,
} from 'mysql2/promise';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import { SqlAuditService } from '../../modules/audit/sql-audit.service';
import type {
  AnalysisWarehouseRawRecord,
  AnalysisWarehouseSyncCheckpointRecord,
  AnalysisWarehouseSyncRunRecord,
} from '../../shared/types/domain';
import {
  buildAnalysisWarehouseSemanticFieldSeeds,
  buildAnalysisWarehouseSemanticMetricSeeds,
} from './analysis-warehouse-semantic-seeds';

export interface AnalysisWarehouseUserScopeHint {
  userId: string;
  username?: string;
  roleCode?: string;
  roleName?: string;
  region?: string;
  bigRegion?: string;
  partnerId?: string;
  partnerName?: string;
  permissionScopeType?: string;
  permissionRegions: string[];
  permissionBigRegions: string[];
  permissionPartnerIds: string[];
  permissionUserIds: string[];
  permissionOwnerIds: string[];
  permissionManagedUserIds: string[];
  permissionDepartmentIds: string[];
  permissionOrganizationIds: string[];
  includeChildPartners?: boolean;
}

@Injectable()
export class AnalysisWarehouseMysqlService implements OnModuleDestroy {
  private pool?: Pool;
  private poolInitialized = false;
  private schemaInitialized = false;
  private initializationPromise?: Promise<boolean>;
  private initializationRetryAfter = 0;
  private readonly connectTimeoutMs = Number(
    process.env.ANALYSIS_WAREHOUSE_DB_CONNECT_TIMEOUT_MS ?? '8000',
  );
  private readonly initializationFailureCooldownMs = Number(
    process.env.ANALYSIS_WAREHOUSE_DB_FAILURE_COOLDOWN_MS ?? '60000',
  );

  constructor(
    private readonly localRuntimeConfigService: LocalRuntimeConfigService,
    private readonly analysisLoggerService: AnalysisLoggerService,
    private readonly sqlAuditService: SqlAuditService,
  ) {}

  /**
   * 关闭分析库连接池。
   *
   * 参数说明：无。
   * 返回值说明：无返回值。
   * 调用注意事项：Nest 应用关闭、本地验证脚本退出或测试进程结束时都会触发，避免 MySQL 连接池句柄残留。
   */
  async onModuleDestroy(): Promise<void> {
    await this.closePool();
  }

  /**
   * 判断分析库配置是否完整。
   *
   * 参数说明：无。
   * 返回值说明：配置完整返回 `true`。
   * 调用注意事项：这里只看配置，不发起连接；真正连接由 `ensureReady` 串行完成。
   */
  isConfigured(): boolean {
    return this.localRuntimeConfigService.getAnalysisWarehouseDbConfig().enabled;
  }

  /**
   * 读取分析库运行状态。
   *
   * 参数说明：无。
   * 返回值说明：返回配置、连接池和 schema 初始化状态。
   * 调用注意事项：不包含密码、用户名等敏感信息。
   */
  getStatus(): Record<string, unknown> {
    const config = this.localRuntimeConfigService.getAnalysisWarehouseDbConfig();
    return {
      configured: config.enabled,
      host: config.host,
      port: config.port ?? 3306,
      database: config.database,
      poolInitialized: this.poolInitialized,
      schemaInitialized: this.schemaInitialized,
    };
  }

  /**
   * 保存同步运行记录到 MySQL ODS。
   *
   * 参数说明：`run` 为同步任务完整记录。
   * 返回值说明：写入成功返回 `true`，未配置或失败返回 `false`。
   * 调用注意事项：只保存配置状态和结果摘要，不保存 OpenAPI Secret 或 token。
   */
  async upsertSyncRun(run: AnalysisWarehouseSyncRunRecord): Promise<boolean> {
    if (!(await this.ensureReady())) {
      return false;
    }

    await this.pool!.execute(
      `INSERT INTO ods_lianruan_sync_runs (
         id, source_type, sync_mode, dry_run, status, requested_by, requested_by_name,
         resources_json, resource_results_json, config_snapshot_json, started_at,
         finished_at, duration_ms, failure_reason
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         resource_results_json = VALUES(resource_results_json),
         config_snapshot_json = VALUES(config_snapshot_json),
         finished_at = VALUES(finished_at),
         duration_ms = VALUES(duration_ms),
         failure_reason = VALUES(failure_reason)`,
      [
        run.id,
        run.sourceType,
        run.mode,
        run.dryRun ? 1 : 0,
        run.status,
        run.requestedBy,
        run.requestedByName ?? null,
        JSON.stringify(run.resources),
        JSON.stringify(run.resourceResults),
        JSON.stringify(run.configSnapshot),
        this.toMysqlDate(run.startedAt),
        this.toMysqlDate(run.finishedAt),
        run.durationMs ?? null,
        run.failureReason ?? null,
      ],
    );
    return true;
  }

  /**
   * 批量写入 OpenAPI 原始快照到 ODS。
   *
   * 参数说明：`records` 为已脱敏的资源快照。
   * 返回值说明：返回实际尝试写入数量；未配置时返回 0。
   * 调用注意事项：以来源、资源、对象 ID 做幂等键，避免重复同步产生多份业务对象。
   */
  async upsertRawRecords(records: AnalysisWarehouseRawRecord[]): Promise<number> {
    if (records.length === 0 || !(await this.ensureReady())) {
      return 0;
    }

    for (const record of records) {
      await this.pool!.execute(
        `INSERT INTO ods_lianruan_raw_records (
           id, source_type, resource, source_object_id, sync_run_id, payload_json,
           payload_field_names_json, payload_hash, synced_at, source_updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           id = VALUES(id),
           sync_run_id = VALUES(sync_run_id),
           payload_json = VALUES(payload_json),
           payload_field_names_json = VALUES(payload_field_names_json),
           payload_hash = VALUES(payload_hash),
           synced_at = VALUES(synced_at),
           source_updated_at = VALUES(source_updated_at)`,
        [
          record.id,
          record.sourceType,
          record.resource,
          record.sourceObjectId,
          record.syncRunId,
          JSON.stringify(record.payload),
          JSON.stringify(record.payloadFieldNames),
          record.payloadHash,
          this.toMysqlDate(record.syncedAt),
          this.toMysqlDate(record.updatedAt),
        ],
      );
      await this.upsertStandardModelRecord(record);
    }

    return records.length;
  }

  /**
   * 保存同步检查点到 ODS。
   *
   * 参数说明：`checkpoint` 为资源同步游标。
   * 返回值说明：写入成功返回 `true`。
   * 调用注意事项：检查点只用于增量同步，不参与运行时权限判断。
   */
  async saveCheckpoint(
    checkpoint: AnalysisWarehouseSyncCheckpointRecord,
  ): Promise<boolean> {
    if (!(await this.ensureReady())) {
      return false;
    }

    await this.pool!.execute(
      `INSERT INTO ods_lianruan_sync_checkpoints (
         id, source_type, resource, last_run_id, last_synced_at, cursor_value, observed_total
       ) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         last_run_id = VALUES(last_run_id),
         last_synced_at = VALUES(last_synced_at),
         cursor_value = VALUES(cursor_value),
         observed_total = VALUES(observed_total)`,
      [
        checkpoint.id,
        checkpoint.sourceType,
        checkpoint.resource,
        checkpoint.lastRunId,
        this.toMysqlDate(checkpoint.lastSyncedAt),
        checkpoint.cursor ?? null,
        checkpoint.observedTotal ?? null,
      ],
    );
    return true;
  }

  /**
   * 执行受控只读 SQL。
   *
   * 参数说明：
   * - `sql`：已通过安全校验的 SELECT SQL。
   * - `params`：参数化绑定值。
   * - `timeoutMs`：执行超时时间。
   * 返回值说明：返回 MySQL 行对象数组。
   * 调用注意事项：该方法只负责执行和审计；SQL 安全校验必须在调用前完成。
   */
  async executeSelect<T extends Record<string, unknown>>(
    sql: string,
    params: unknown[],
    timeoutMs: number,
  ): Promise<T[]> {
    if (!(await this.ensureReady())) {
      throw new Error('AI-agent 分析库尚未配置或连接不可用。');
    }

    const [rows] = await this.sqlAuditService.execute({
      sql,
      params,
      timeoutMs,
      databaseRole: 'ANALYSIS_WAREHOUSE',
      moduleKey: 'analysis-workbench',
      programName: 'AnalysisWarehouseMysqlService.executeSelect',
      execute: () =>
        this.withTimeout(this.pool!.query(sql, params), timeoutMs),
    });

    return rows as T[];
  }

  /**
   * 读取分析库内的当前用户权限提示。
   *
   * 参数说明：`identifiers` 包含 CRM 用户 ID、登录账号和企业微信 userid 候选值。
   * 返回值说明：命中分析库用户维度时返回区域、服务商和权限桥表范围；未配置或未命中返回 `null`。
   * 调用注意事项：该查询只读取已同步的用户维度和权限桥表，不读取 ODS 原始 JSON；用于后续 SQL 行级条件收敛，
   * 不能单独作为权限放行依据，仍需与当前登录会话的 `ScopeSnapshot` 合并判断。
   */
  async getUserScopeHint(identifiers: {
    userId: string;
    username?: string;
    wecomUserid?: string;
  }): Promise<AnalysisWarehouseUserScopeHint | null> {
    if (!(await this.ensureReady())) {
      return null;
    }

    const sql = `
      SELECT
        u.user_id,
        u.username,
        u.role_code,
        u.role_name,
        u.region,
        u.big_region,
        u.partner_id,
        u.partner_name,
        p.scope_type,
        p.regions_json,
        p.big_regions_json,
        p.partner_ids_json,
        p.user_ids_json,
        p.owner_ids_json,
        p.managed_user_ids_json,
        p.department_ids_json,
        p.organization_ids_json,
        p.include_child_partners
      FROM dim_lianruan_user u
      LEFT JOIN bridge_lianruan_user_permission p
        ON p.crm_user_id = u.user_id
      WHERE u.user_id = ?
         OR u.username = ?
         OR u.wecom_userid = ?
      LIMIT 1
    `;
    const params = [
      identifiers.userId,
      identifiers.username ?? identifiers.userId,
      identifiers.wecomUserid ?? '',
    ];
    const [rows] = await this.sqlAuditService.execute({
      sql,
      params,
      timeoutMs: 3000,
      databaseRole: 'ANALYSIS_WAREHOUSE',
      moduleKey: 'analysis-workbench',
      programName: 'AnalysisWarehouseMysqlService.getUserScopeHint',
      execute: () => this.withTimeout(this.pool!.query(sql, params), 3000),
    });

    const row = (rows as Array<RowDataPacket & Record<string, unknown>>)[0];
    if (!row) {
      return null;
    }

    return {
      userId: this.getString(row, 'user_id') ?? identifiers.userId,
      username: this.getString(row, 'username') ?? undefined,
      roleCode: this.getString(row, 'role_code') ?? undefined,
      roleName: this.getString(row, 'role_name') ?? undefined,
      region: this.getString(row, 'region') ?? undefined,
      bigRegion: this.getString(row, 'big_region') ?? undefined,
      partnerId: this.getString(row, 'partner_id') ?? undefined,
      partnerName: this.getString(row, 'partner_name') ?? undefined,
      permissionScopeType: this.getString(row, 'scope_type') ?? undefined,
      permissionRegions: this.parseStringArray(row.regions_json),
      permissionBigRegions: this.parseStringArray(row.big_regions_json),
      permissionPartnerIds: this.parseStringArray(row.partner_ids_json),
      permissionUserIds: this.parseStringArray(row.user_ids_json),
      permissionOwnerIds: this.parseStringArray(row.owner_ids_json),
      permissionManagedUserIds: this.parseStringArray(row.managed_user_ids_json),
      permissionDepartmentIds: this.parseStringArray(row.department_ids_json),
      permissionOrganizationIds: this.parseStringArray(row.organization_ids_json),
      includeChildPartners: this.toOptionalBoolean(row.include_child_partners),
    };
  }

  /**
   * 读取 MySQL ODS 概览统计。
   *
   * 参数说明：无。
   * 返回值说明：返回资源快照数量和最近同步批次。
   * 调用注意事项：未配置时返回空对象，避免治理页不可用。
   */
  async getOverview(): Promise<Record<string, unknown>> {
    if (!(await this.ensureReady())) {
      return {
        enabled: false,
      };
    }

    const [rawCountRows] = await this.pool!.query<
      Array<RowDataPacket & { resource: string; count_value: number }>
    >(
      `SELECT resource, COUNT(*) AS count_value
         FROM ods_lianruan_raw_records
        GROUP BY resource`,
    );
    const [runRows] = await this.pool!.query<
      Array<RowDataPacket & { id: string; status: string; started_at: Date }>
    >(
      `SELECT id, status, started_at
         FROM ods_lianruan_sync_runs
        ORDER BY started_at DESC
        LIMIT 1`,
    );

    return {
      enabled: true,
      rawRecordCountByResource: Object.fromEntries(
        rawCountRows.map((row) => [row.resource, Number(row.count_value)]),
      ),
      lastRun: runRows[0]
        ? {
            id: runRows[0].id,
            status: runRows[0].status,
            startedAt: this.fromMysqlDate(runRows[0].started_at),
          }
        : undefined,
    };
  }

  /**
   * 确保分析库连接和 schema 已就绪。
   *
   * 参数说明：无。
   * 返回值说明：可用返回 `true`，未配置或连接失败返回 `false`。
   * 调用注意事项：该方法串行初始化，避免同步任务并发建表。
   */
  private async ensureReady(): Promise<boolean> {
    if (process.env.NODE_ENV === 'test' && !this.isConfigured()) {
      return false;
    }

    if (this.pool && this.schemaInitialized) {
      return true;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    if (this.initializationRetryAfter > Date.now()) {
      return false;
    }

    this.initializationPromise = this.initialize().finally(() => {
      this.initializationPromise = undefined;
    });
    return this.initializationPromise;
  }

  /**
   * 初始化 MySQL 连接池和 schema。
   *
   * 参数说明：无。
   * 返回值说明：成功返回 `true`。
   * 调用注意事项：失败只记录告警并返回 `false`，不影响 OpenAPI 同步继续写入 AppStorage 兜底。
   */
  private async initialize(): Promise<boolean> {
    const config = this.localRuntimeConfigService.getAnalysisWarehouseDbConfig();
    if (!config.enabled || !config.host || !config.database || !config.user || !config.password) {
      return false;
    }

    try {
      this.pool = mysql.createPool({
        host: config.host,
        port: config.port ?? 3306,
        database: config.database,
        user: config.user,
        password: config.password,
        connectionLimit: 4,
        waitForConnections: true,
        charset: 'utf8mb4',
        connectTimeout: this.connectTimeoutMs,
      });

      const connection = await this.pool.getConnection();
      connection.release();
      this.poolInitialized = true;
      await this.ensureSchema();
      this.schemaInitialized = true;
      this.analysisLoggerService.logStep('AI-agent 分析库已连接并完成 schema 检查。', {
        host: config.host,
        database: config.database,
      });
      return true;
    } catch (error) {
      await this.closePool();
      // 连接失败时短时熔断，避免生产配置错误时每次问数都重复建连接并刷屏告警。
      this.initializationRetryAfter =
        Date.now() + Math.max(this.initializationFailureCooldownMs, 1000);
      this.analysisLoggerService.logWarn('AI-agent 分析库连接或建表失败，已停止本次分析库诊断同步。', {
        reason: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * 安全释放 MySQL 连接池。
   *
   * 参数说明：无。
   * 返回值说明：无返回值。
   * 调用注意事项：释放失败只写告警，不能反向影响应用关闭或 OpenAPI 兜底链路。
   */
  private async closePool(): Promise<void> {
    const pool = this.pool;
    this.pool = undefined;
    this.poolInitialized = false;
    this.schemaInitialized = false;
    if (!pool) {
      return;
    }

    try {
      await pool.end();
    } catch (error) {
      this.analysisLoggerService.logWarn('AI-agent 分析库连接池关闭失败。', {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 创建数仓基础表并写入语义层种子。
   *
   * 参数说明：无。
   * 返回值说明：无返回值。
   * 调用注意事项：只执行 `CREATE TABLE IF NOT EXISTS` 和幂等种子写入，不删除任何已有数据。
   */
  private async ensureSchema(): Promise<void> {
    const schemaSql = this.readSchemaSql();
    for (const statement of this.splitSqlStatements(schemaSql)) {
      await this.pool!.execute(statement);
    }

    await this.ensureSchemaEvolution();
    await this.seedSemanticCatalog();
  }

  /**
   * 为已存在的本地分析库执行兼容性补列。
   *
   * 参数说明：无。
   * 返回值说明：无返回值。
   * 调用注意事项：`CREATE TABLE IF NOT EXISTS` 不会修改已有表结构，因此新增 P3 字段必须显式补列；
   * 这里只做加列，不删除、不改类型、不清空数据，避免影响现有同步快照。
   */
  private async ensureSchemaEvolution(): Promise<void> {
    await this.ensureColumn('fact_lianruan_quote', 'assigned_partner_id', 'VARCHAR(128) NULL');
    await this.ensureColumn('fact_lianruan_quote', 'parent_partner_id', 'VARCHAR(128) NULL');
    await this.ensureColumn('fact_lianruan_quote', 'region', 'VARCHAR(128) NULL');
    await this.ensureColumn('fact_lianruan_quote', 'big_region', 'VARCHAR(128) NULL');
    await this.ensureColumn('fact_lianruan_registration', 'big_region', 'VARCHAR(128) NULL');
    await this.ensureColumn('fact_lianruan_order', 'region', 'VARCHAR(128) NULL');
    await this.ensureColumn('fact_lianruan_order', 'big_region', 'VARCHAR(128) NULL');
    await this.ensureColumn('bridge_lianruan_user_permission', 'big_regions_json', 'LONGTEXT NULL');
    await this.ensureColumn('bridge_lianruan_user_permission', 'owner_ids_json', 'LONGTEXT NULL');
    await this.ensureColumn('bridge_lianruan_user_permission', 'managed_user_ids_json', 'LONGTEXT NULL');
    await this.ensureColumn('bridge_lianruan_user_permission', 'department_ids_json', 'LONGTEXT NULL');
    await this.ensureColumn('bridge_lianruan_user_permission', 'organization_ids_json', 'LONGTEXT NULL');
    await this.ensureColumn('bridge_lianruan_user_permission', 'include_child_partners', 'TINYINT(1) NULL');
  }

  /**
   * 仅当字段不存在时为分析库表补列。
   *
   * 参数说明：`tableName` 为目标表，`columnName` 为目标列，`definition` 为列定义。
   * 返回值说明：无返回值。
   * 调用注意事项：表名和列名都来自固定代码常量，不接受用户输入；避免把动态 SQL 暴露给外部。
   */
  private async ensureColumn(
    tableName: string,
    columnName: string,
    definition: string,
  ): Promise<void> {
    const [rows] = await this.pool!.query<Array<RowDataPacket & { exists_value: number }>>(
      `SELECT COUNT(*) AS exists_value
         FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND column_name = ?`,
      [tableName, columnName],
    );
    if (Number(rows[0]?.exists_value ?? 0) > 0) {
      return;
    }

    await this.pool!.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }

  /**
   * 读取随代码发布的数仓 schema SQL。
   */
  private readSchemaSql(): string {
    const schemaPath = join(__dirname, 'schema.sql');
    if (existsSync(schemaPath)) {
      return readFileSync(schemaPath, 'utf8');
    }

    return readFileSync(
      join(
        this.localRuntimeConfigService.getRepoRoot(),
        'backend',
        'src',
        'database',
        'analysis-warehouse',
        'schema.sql',
      ),
      'utf8',
    );
  }

  /**
   * 将 schema SQL 拆成单条语句。
   *
   * 参数说明：`sql` 为完整 schema 文件内容。
   * 返回值说明：返回非空 SQL 语句数组。
   * 调用注意事项：当前 schema 不包含存储过程，按分号拆分足够安全。
   */
  private splitSqlStatements(sql: string): string[] {
    return sql
      .split(/;\s*(?:\r?\n|$)/u)
      .map((statement) => statement.trim())
      .filter(Boolean);
  }

  /**
   * 写入第一批语义字段和指标种子。
   *
   * 参数说明：无。
   * 返回值说明：无返回值。
   * 调用注意事项：种子只用于 P0 语义层起步，联软回传最终字段口径后可继续增补。
   */
  private async seedSemanticCatalog(): Promise<void> {
    for (const field of buildAnalysisWarehouseSemanticFieldSeeds()) {
      await this.pool!.execute<ResultSetHeader>(
        `INSERT INTO semantic_field_catalog (
           id, table_name, field_name, field_label, business_meaning, data_type,
           resource, sensitive_level, dictionary_key
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           field_label = VALUES(field_label),
           business_meaning = VALUES(business_meaning),
           data_type = VALUES(data_type),
           resource = VALUES(resource),
           sensitive_level = VALUES(sensitive_level),
           dictionary_key = VALUES(dictionary_key)`,
        [
          `${field.tableName}.${field.fieldName}`,
          field.tableName,
          field.fieldName,
          field.fieldLabel,
          field.businessMeaning,
          field.dataType,
          field.resource ?? null,
          field.sensitiveLevel ?? 'NORMAL',
          field.dictionaryKey ?? null,
        ],
      );
    }

    for (const metric of buildAnalysisWarehouseSemanticMetricSeeds()) {
      await this.pool!.execute<ResultSetHeader>(
        `INSERT INTO semantic_metric_catalog (
           id, metric_key, metric_label, metric_formula, default_table, business_meaning
         ) VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           metric_label = VALUES(metric_label),
           metric_formula = VALUES(metric_formula),
           default_table = VALUES(default_table),
           business_meaning = VALUES(business_meaning)`,
        [
          `metric.${metric.metricKey}`,
          metric.metricKey,
          metric.metricLabel,
          metric.metricFormula,
          metric.defaultTable,
          metric.businessMeaning,
        ],
      );
    }
  }

  /**
   * 将 ODS 原始快照同步上卷到 DWD 标准明细模型。
   *
   * 参数说明：`record` 为单条已脱敏原始快照。
   * 返回值说明：无返回值。
   * 调用注意事项：当前只做 P0 对象的幂等 upsert；字段最终口径以后续联软回传为准继续补齐。
   */
  private async upsertStandardModelRecord(
    record: AnalysisWarehouseRawRecord,
  ): Promise<void> {
    switch (record.resource) {
      case 'users':
        await this.upsertUserDimension(record);
        return;
      case 'partners':
        await this.upsertPartnerDimension(record);
        return;
      case 'customers':
        await this.upsertCustomerDimension(record);
        return;
      case 'registrations':
        await this.upsertRegistrationFact(record);
        return;
      case 'opportunities':
        await this.upsertOpportunityFact(record);
        return;
      case 'quotes':
        await this.upsertQuoteFact(record);
        return;
      case 'orders':
        await this.upsertOrderFact(record);
        return;
      case 'permissions':
        await this.upsertPermissionBridge(record);
        return;
      default:
        return;
    }
  }

  /**
   * 写入用户维度。
   */
  private async upsertUserDimension(record: AnalysisWarehouseRawRecord): Promise<void> {
    const payload = record.payload;
    await this.pool!.execute(
      `INSERT INTO dim_lianruan_user (
         user_id, username, user_name, role_code, role_name, wecom_userid,
         department_id, department_name, region, big_region, partner_id, partner_name,
         status, source_updated_at, synced_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         username = VALUES(username),
         user_name = VALUES(user_name),
         role_code = VALUES(role_code),
         role_name = VALUES(role_name),
         wecom_userid = VALUES(wecom_userid),
         department_id = VALUES(department_id),
         department_name = VALUES(department_name),
         region = VALUES(region),
         big_region = VALUES(big_region),
         partner_id = VALUES(partner_id),
         partner_name = VALUES(partner_name),
         status = VALUES(status),
         source_updated_at = VALUES(source_updated_at),
         synced_at = VALUES(synced_at)`,
      [
        this.getString(payload, 'id', record.sourceObjectId),
        this.getString(payload, 'username'),
        this.getString(payload, 'name'),
        this.getString(payload, 'role'),
        this.getString(payload, 'roleName'),
        this.getString(payload, 'wecomUserId'),
        this.getString(payload, 'departmentId'),
        this.getString(payload, 'departmentName'),
        this.getString(payload, 'region'),
        this.getString(payload, 'bigRegion'),
        this.getString(payload, 'partnerId'),
        this.getString(payload, 'partnerName'),
        this.getString(payload, 'status'),
        this.toMysqlDate(record.updatedAt),
        this.toMysqlDate(record.syncedAt),
      ],
    );
  }

  /**
   * 写入服务商维度。
   */
  private async upsertPartnerDimension(record: AnalysisWarehouseRawRecord): Promise<void> {
    const payload = record.payload;
    await this.pool!.execute(
      `INSERT INTO dim_lianruan_partner (
         partner_id, partner_name, short_name, partner_level, partner_level_name,
         is_technical_service_provider, technical_service_provider_type, parent_partner_id,
         region, big_region, status, created_at, source_updated_at, synced_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         partner_name = VALUES(partner_name),
         short_name = VALUES(short_name),
         partner_level = VALUES(partner_level),
         partner_level_name = VALUES(partner_level_name),
         is_technical_service_provider = VALUES(is_technical_service_provider),
         technical_service_provider_type = VALUES(technical_service_provider_type),
         parent_partner_id = VALUES(parent_partner_id),
         region = VALUES(region),
         big_region = VALUES(big_region),
         status = VALUES(status),
         created_at = VALUES(created_at),
         source_updated_at = VALUES(source_updated_at),
         synced_at = VALUES(synced_at)`,
      [
        this.getString(payload, 'id', record.sourceObjectId),
        this.getString(payload, 'name'),
        this.getString(payload, 'shortName'),
        this.getString(payload, 'partnerLevel'),
        this.getString(payload, 'partnerLevelName'),
        this.getBooleanNumber(payload, 'isTechnicalServiceProvider'),
        this.getString(payload, 'technicalServiceProviderType'),
        this.getString(payload, 'parentPartnerId'),
        this.getString(payload, 'region'),
        this.getString(payload, 'bigRegion'),
        this.getString(payload, 'status'),
        this.toMysqlDate(this.getString(payload, 'createdAt')),
        this.toMysqlDate(record.updatedAt),
        this.toMysqlDate(record.syncedAt),
      ],
    );
  }

  /**
   * 写入客户维度。
   */
  private async upsertCustomerDimension(record: AnalysisWarehouseRawRecord): Promise<void> {
    const payload = record.payload;
    await this.pool!.execute(
      `INSERT INTO dim_lianruan_customer (
         customer_id, customer_name, customer_id_rule, status, status_name, category,
         category_name, owner_id, owner_name, assigned_staff_id, assigned_staff_name,
         partner_id, partner_name, region, big_region, registration_count,
         opportunity_count, quote_count, order_count, latest_activity_at, created_at,
         source_updated_at, synced_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         customer_name = VALUES(customer_name),
         customer_id_rule = VALUES(customer_id_rule),
         status = VALUES(status),
         status_name = VALUES(status_name),
         category = VALUES(category),
         category_name = VALUES(category_name),
         owner_id = VALUES(owner_id),
         owner_name = VALUES(owner_name),
         assigned_staff_id = VALUES(assigned_staff_id),
         assigned_staff_name = VALUES(assigned_staff_name),
         partner_id = VALUES(partner_id),
         partner_name = VALUES(partner_name),
         region = VALUES(region),
         big_region = VALUES(big_region),
         registration_count = VALUES(registration_count),
         opportunity_count = VALUES(opportunity_count),
         quote_count = VALUES(quote_count),
         order_count = VALUES(order_count),
         latest_activity_at = VALUES(latest_activity_at),
         created_at = VALUES(created_at),
         source_updated_at = VALUES(source_updated_at),
         synced_at = VALUES(synced_at)`,
      [
        this.getString(payload, 'id', this.getString(payload, 'customerId', record.sourceObjectId)),
        this.getString(payload, 'name', this.getString(payload, 'customer')),
        this.getString(payload, 'customerIdRule'),
        this.getString(payload, 'status'),
        this.getString(payload, 'statusName'),
        this.getString(payload, 'category'),
        this.getString(payload, 'categoryName'),
        this.getString(payload, 'ownerId'),
        this.getString(payload, 'ownerName'),
        this.getString(payload, 'assignedStaffId'),
        this.getString(payload, 'assignedStaffName'),
        this.getString(payload, 'partnerId'),
        this.getString(payload, 'partnerName'),
        this.getString(payload, 'region'),
        this.getString(payload, 'bigRegion'),
        this.getNumber(payload, 'registrationCount'),
        this.getNumber(payload, 'opportunityCount'),
        this.getNumber(payload, 'quoteCount'),
        this.getNumber(payload, 'orderCount'),
        this.toMysqlDate(this.getString(payload, 'latestActivityAt')),
        this.toMysqlDate(this.getString(payload, 'createdAt')),
        this.toMysqlDate(record.updatedAt),
        this.toMysqlDate(record.syncedAt),
      ],
    );
  }

  /**
   * 写入报备事实。
   */
  private async upsertRegistrationFact(record: AnalysisWarehouseRawRecord): Promise<void> {
    const payload = record.payload;
    await this.pool!.execute(
      `INSERT INTO fact_lianruan_registration (
         registration_id, customer_id, customer_name, status, created_by, created_by_name,
         assigned_staff_id, assigned_staff_name, partner_id, region, big_region, created_at,
         source_updated_at, synced_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         customer_id = VALUES(customer_id),
         customer_name = VALUES(customer_name),
         status = VALUES(status),
         created_by = VALUES(created_by),
         created_by_name = VALUES(created_by_name),
         assigned_staff_id = VALUES(assigned_staff_id),
         assigned_staff_name = VALUES(assigned_staff_name),
         partner_id = VALUES(partner_id),
         region = VALUES(region),
         big_region = VALUES(big_region),
         created_at = VALUES(created_at),
         source_updated_at = VALUES(source_updated_at),
         synced_at = VALUES(synced_at)`,
      [
        this.getString(payload, 'id', record.sourceObjectId),
        this.getString(payload, 'customerId'),
        this.getString(payload, 'customer'),
        this.getString(payload, 'status'),
        this.getString(payload, 'createdBy'),
        this.getString(payload, 'createdByName'),
        this.getString(payload, 'assignedStaffId'),
        this.getString(payload, 'assignedStaffName'),
        this.getString(payload, 'partnerId'),
        this.getString(payload, 'region'),
        this.getString(payload, 'bigRegion'),
        this.toMysqlDate(this.getString(payload, 'createdAt')),
        this.toMysqlDate(record.updatedAt),
        this.toMysqlDate(record.syncedAt),
      ],
    );
  }

  /**
   * 写入商机事实。
   */
  private async upsertOpportunityFact(record: AnalysisWarehouseRawRecord): Promise<void> {
    const payload = record.payload;
    await this.pool!.execute(
      `INSERT INTO fact_lianruan_opportunity (
         opportunity_id, opportunity_name, customer_id, customer_name, stage, stage_name,
         status, amount, owner_id, owner_name, assigned_staff_id, assigned_staff_name,
         partner_id, partner_name, assigned_partner_id, region, big_region, registration_id,
         quote_id, expected_close_at, created_at, source_updated_at, synced_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         opportunity_name = VALUES(opportunity_name),
         customer_id = VALUES(customer_id),
         customer_name = VALUES(customer_name),
         stage = VALUES(stage),
         stage_name = VALUES(stage_name),
         status = VALUES(status),
         amount = VALUES(amount),
         owner_id = VALUES(owner_id),
         owner_name = VALUES(owner_name),
         assigned_staff_id = VALUES(assigned_staff_id),
         assigned_staff_name = VALUES(assigned_staff_name),
         partner_id = VALUES(partner_id),
         partner_name = VALUES(partner_name),
         assigned_partner_id = VALUES(assigned_partner_id),
         region = VALUES(region),
         big_region = VALUES(big_region),
         registration_id = VALUES(registration_id),
         quote_id = VALUES(quote_id),
         expected_close_at = VALUES(expected_close_at),
         created_at = VALUES(created_at),
         source_updated_at = VALUES(source_updated_at),
         synced_at = VALUES(synced_at)`,
      [
        this.getString(payload, 'id', record.sourceObjectId),
        this.getString(payload, 'name'),
        this.getString(payload, 'customerId'),
        this.getString(payload, 'customer'),
        this.getString(payload, 'stage'),
        this.getString(payload, 'stageName'),
        this.getString(payload, 'status'),
        this.getNumber(payload, 'amount'),
        this.getString(payload, 'ownerId'),
        this.getString(payload, 'ownerName'),
        this.getString(payload, 'assignedStaffId'),
        this.getString(payload, 'assignedStaffName'),
        this.getString(payload, 'partnerId'),
        this.getString(payload, 'partnerName'),
        this.getString(payload, 'assignedPartnerId'),
        this.getString(payload, 'region'),
        this.getString(payload, 'bigRegion'),
        this.getString(payload, 'regId'),
        this.getString(payload, 'quoteId'),
        this.toMysqlDate(this.getString(payload, 'expectedClose')),
        this.toMysqlDate(this.getString(payload, 'createdAt')),
        this.toMysqlDate(record.updatedAt),
        this.toMysqlDate(record.syncedAt),
      ],
    );
  }

  /**
   * 写入报价事实。
   */
  private async upsertQuoteFact(record: AnalysisWarehouseRawRecord): Promise<void> {
    const payload = record.payload;
    await this.pool!.execute(
      `INSERT INTO fact_lianruan_quote (
         quote_id, customer_id, customer_name, opportunity_id, partner_id, assigned_partner_id,
         parent_partner_id, assigned_staff_id, assigned_staff_name, owner_id, owner_name,
         amount, status, region, big_region, created_at, source_updated_at, synced_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         customer_id = VALUES(customer_id),
         customer_name = VALUES(customer_name),
         opportunity_id = VALUES(opportunity_id),
         partner_id = VALUES(partner_id),
         assigned_partner_id = VALUES(assigned_partner_id),
         parent_partner_id = VALUES(parent_partner_id),
         assigned_staff_id = VALUES(assigned_staff_id),
         assigned_staff_name = VALUES(assigned_staff_name),
         owner_id = VALUES(owner_id),
         owner_name = VALUES(owner_name),
         amount = VALUES(amount),
         status = VALUES(status),
         region = VALUES(region),
         big_region = VALUES(big_region),
         created_at = VALUES(created_at),
         source_updated_at = VALUES(source_updated_at),
         synced_at = VALUES(synced_at)`,
      [
        this.getString(payload, 'id', record.sourceObjectId),
        this.getString(payload, 'customerId'),
        this.getString(payload, 'customerName', this.getString(payload, 'customer')),
        this.getString(payload, 'oppId'),
        this.getString(payload, 'partnerId'),
        this.getString(payload, 'assignedPartnerId'),
        this.getString(payload, 'parentPartnerId'),
        this.getString(payload, 'assignedStaffId'),
        this.getString(payload, 'assignedStaffName'),
        this.getString(payload, 'ownerId'),
        this.getString(payload, 'ownerName'),
        this.getNumber(payload, 'amount', this.getNumber(payload, 'totalAmount')),
        this.getString(payload, 'status'),
        this.getString(payload, 'region'),
        this.getString(payload, 'bigRegion'),
        this.toMysqlDate(this.getString(payload, 'createdAt')),
        this.toMysqlDate(record.updatedAt),
        this.toMysqlDate(record.syncedAt),
      ],
    );
  }

  /**
   * 写入订单事实。
   */
  private async upsertOrderFact(record: AnalysisWarehouseRawRecord): Promise<void> {
    const payload = record.payload;
    await this.pool!.execute(
      `INSERT INTO fact_lianruan_order (
         order_id, customer_id, customer_name, partner_id, parent_partner_id,
         assigned_partner_id, assigned_staff_id, assigned_staff_name, owner_id, owner_name,
         amount, status, region, big_region, deal_at, created_at, source_updated_at, synced_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         customer_id = VALUES(customer_id),
         customer_name = VALUES(customer_name),
         partner_id = VALUES(partner_id),
         parent_partner_id = VALUES(parent_partner_id),
         assigned_partner_id = VALUES(assigned_partner_id),
         assigned_staff_id = VALUES(assigned_staff_id),
         assigned_staff_name = VALUES(assigned_staff_name),
         owner_id = VALUES(owner_id),
         owner_name = VALUES(owner_name),
         amount = VALUES(amount),
         status = VALUES(status),
         region = VALUES(region),
         big_region = VALUES(big_region),
         deal_at = VALUES(deal_at),
         created_at = VALUES(created_at),
         source_updated_at = VALUES(source_updated_at),
         synced_at = VALUES(synced_at)`,
      [
        this.getString(payload, 'id', record.sourceObjectId),
        this.getString(payload, 'customerId'),
        this.getString(payload, 'customerName', this.getString(payload, 'customer')),
        this.getString(payload, 'partnerId'),
        this.getString(payload, 'parentPartnerId'),
        this.getString(payload, 'assignedPartnerId'),
        this.getString(payload, 'assignedStaffId'),
        this.getString(payload, 'assignedStaffName'),
        this.getString(payload, 'ownerId'),
        this.getString(payload, 'ownerName'),
        this.getNumber(payload, 'amount', this.getNumber(payload, 'totalAmount')),
        this.getString(payload, 'status'),
        this.getString(payload, 'region'),
        this.getString(payload, 'bigRegion'),
        this.toMysqlDate(this.getString(payload, 'dealAt')),
        this.toMysqlDate(this.getString(payload, 'createdAt')),
        this.toMysqlDate(record.updatedAt),
        this.toMysqlDate(record.syncedAt),
      ],
    );
  }

  /**
   * 写入当前 client 权限桥表快照。
   */
  private async upsertPermissionBridge(record: AnalysisWarehouseRawRecord): Promise<void> {
    const payload = record.payload;
    const user = payload.user as Record<string, unknown> | undefined;
    const crmUserId = this.getString(user ?? {}, 'id', record.sourceObjectId);
    await this.pool!.execute(
      `INSERT INTO bridge_lianruan_user_permission (
         id, crm_user_id, role_code, scope_type, regions_json, partner_ids_json,
         user_ids_json, big_regions_json, owner_ids_json, managed_user_ids_json,
         department_ids_json, organization_ids_json, include_child_partners,
         raw_payload_json, synced_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         role_code = VALUES(role_code),
         scope_type = VALUES(scope_type),
         regions_json = VALUES(regions_json),
         partner_ids_json = VALUES(partner_ids_json),
         user_ids_json = VALUES(user_ids_json),
         big_regions_json = VALUES(big_regions_json),
         owner_ids_json = VALUES(owner_ids_json),
         managed_user_ids_json = VALUES(managed_user_ids_json),
         department_ids_json = VALUES(department_ids_json),
         organization_ids_json = VALUES(organization_ids_json),
         include_child_partners = VALUES(include_child_partners),
         raw_payload_json = VALUES(raw_payload_json),
         synced_at = VALUES(synced_at)`,
      [
        `permission_${crmUserId}`,
        crmUserId,
        this.getString(user ?? {}, 'role'),
        this.getString(payload, 'scopeType', 'unknown'),
        JSON.stringify(payload.regions ?? []),
        JSON.stringify(payload.partnerIds ?? []),
        JSON.stringify(payload.userIds ?? []),
        JSON.stringify(payload.bigRegions ?? []),
        JSON.stringify(payload.ownerIds ?? []),
        JSON.stringify(payload.managedUserIds ?? []),
        JSON.stringify(payload.departmentIds ?? []),
        JSON.stringify(payload.organizationIds ?? []),
        this.getBooleanNumber(payload, 'includeChildPartners'),
        JSON.stringify(payload),
        this.toMysqlDate(record.syncedAt),
      ],
    );
  }

  /**
   * 为查询添加超时保护。
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`AI-agent 分析库查询超过 ${timeoutMs}ms，已中断等待。`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  /**
   * 将 ISO 时间转换为 MySQL DATETIME 字符串。
   */
  private toMysqlDate(value?: string | null): string | null {
    if (!value?.trim()) {
      return null;
    }

    return value.slice(0, 23).replace('T', ' ');
  }

  /**
   * 将 MySQL 日期对象转换为 ISO 字符串。
   */
  private fromMysqlDate(value: Date | string): string {
    if (value instanceof Date) {
      return value.toISOString();
    }

    return String(value).replace(' ', 'T');
  }

  /**
   * 安全解析权限桥表中的 JSON 字符串数组。
   *
   * 参数说明：`value` 为 MySQL 返回的 JSON 文本或已解析值。
   * 返回值说明：返回去空后的字符串数组；格式异常时返回空数组。
   * 调用注意事项：权限范围解析失败时必须走保守空范围，不能把异常当作全量范围。
   */
  private parseStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map((item) => String(item)).filter((item) => item.trim());
    }

    if (typeof value !== 'string' || !value.trim()) {
      return [];
    }

    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed)
        ? parsed.map((item) => String(item)).filter((item) => item.trim())
        : [];
    } catch {
      return [];
    }
  }

  /**
   * 将数据库布尔兼容值转换为可选布尔。
   *
   * 参数说明：`value` 为 MySQL TINYINT、布尔或字符串。
   * 返回值说明：可识别时返回布尔值；空值或未知值返回 `undefined`。
   * 调用注意事项：无法识别时不默认视为包含下级渠道，避免渠道权限被放大。
   */
  private toOptionalBoolean(value: unknown): boolean | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (Number(value) === 1) {
      return true;
    }
    if (Number(value) === 0) {
      return false;
    }

    const normalizedValue = String(value).trim().toLowerCase();
    if (['true', 'yes', '是'].includes(normalizedValue)) {
      return true;
    }
    if (['false', 'no', '否'].includes(normalizedValue)) {
      return false;
    }
    return undefined;
  }

  /**
   * 从原始载荷中读取字符串字段。
   */
  private getString(
    payload: Record<string, unknown>,
    key: string,
    fallback?: string | null,
  ): string | null {
    const value = payload[key];
    if (value === undefined || value === null || value === '') {
      return fallback ?? null;
    }
    return String(value);
  }

  /**
   * 从原始载荷中读取数值字段。
   */
  private getNumber(
    payload: Record<string, unknown>,
    key: string,
    fallback?: number | null,
  ): number | null {
    const value = payload[key];
    if (value === undefined || value === null || value === '') {
      return fallback ?? null;
    }

    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback ?? null;
  }

  /**
   * 将布尔字段转换为 MySQL TINYINT。
   */
  private getBooleanNumber(
    payload: Record<string, unknown>,
    key: string,
  ): number | null {
    const value = payload[key];
    if (value === undefined || value === null || value === '') {
      return null;
    }

    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }

    const normalizedValue = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', '是'].includes(normalizedValue)) {
      return 1;
    }
    if (['false', '0', 'no', '否'].includes(normalizedValue)) {
      return 0;
    }

    return null;
  }
}

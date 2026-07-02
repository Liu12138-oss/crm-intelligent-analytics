import { Injectable } from '@nestjs/common';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';
import { SqlAuditService } from '../audit/sql-audit.service';
import { RealDataUnavailableError } from './analysis.errors';
import { CrmSqliteReadonlySqlGuardService } from './crm-sqlite-readonly-sql-guard.service';

type CrmSqliteResource =
  | 'users'
  | 'customers'
  | 'partners'
  | 'registrations'
  | 'opportunities'
  | 'quotes'
  | 'orders';

type CrmSqliteAnalysisView =
  | 'v_business_overview'
  | 'v_sales_funnel'
  | 'v_partner_contribution'
  | 'v_customer_lifecycle'
  | 'v_open_risks';

type SqliteRow = Record<string, unknown>;

interface SqliteStatement {
  all: (...params: unknown[]) => SqliteRow[];
  get: (...params: unknown[]) => SqliteRow | undefined;
}

interface SqliteDatabase {
  prepare: (sql: string) => SqliteStatement;
  close: () => void;
}

interface SqliteRuntimeModule {
  DatabaseSync: new (
    filename: string,
    options?: { readOnly?: boolean; timeout?: number },
  ) => SqliteDatabase;
}

const runtimeRequire = createRequire(__filename);

const RESOURCE_TABLE_CANDIDATES: Record<CrmSqliteResource, string[]> = {
  users: ['dim_users', 'users', 'crm_users', 'lianruan_users'],
  customers: ['dim_customers', 'customers', 'crm_customers', 'lianruan_customers'],
  partners: ['dim_partners', 'partners', 'crm_partners', 'lianruan_partners'],
  registrations: [
    'fact_registrations',
    'registrations',
    'customer_registrations',
    'crm_registrations',
    'lianruan_registrations',
  ],
  opportunities: [
    'fact_opportunities',
    'opportunities',
    'crm_opportunities',
    'lianruan_opportunities',
  ],
  quotes: ['fact_quotes', 'quotes', 'crm_quotes', 'lianruan_quotes'],
  orders: ['fact_orders', 'orders', 'crm_orders', 'lianruan_orders'],
};

const ANALYSIS_MIRROR_VIEW_NAMES = new Set<CrmSqliteAnalysisView>([
  'v_business_overview',
  'v_sales_funnel',
  'v_partner_contribution',
  'v_customer_lifecycle',
  'v_open_risks',
]);

@Injectable()
export class CrmSqliteReadonlyService {
  constructor(
    private readonly localRuntimeConfigService: LocalRuntimeConfigService,
    private readonly crmSqliteReadonlySqlGuardService: CrmSqliteReadonlySqlGuardService,
    private readonly sqlAuditService: SqlAuditService,
  ) {}

  /**
   * 判断 SQLite 只读库是否具备执行条件。
   *
   * 参数说明：无。
   * 返回值说明：开关启用、路径存在且文件大小符合限制时返回 true。
   * 调用注意事项：该方法只做轻量判断，正式执行前仍会调用 `assertAvailable` 输出明确原因。
   */
  canUseReadonlyDatabase(): boolean {
    const config = this.localRuntimeConfigService.getCrmSqliteReadonlyAnalysisConfig();
    try {
      return Boolean(
        config.enabled &&
          config.dbPath?.trim() &&
          existsSync(this.resolveDatabaseFilePath(config.dbPath)),
      );
    } catch {
      return false;
    }
  }

  /**
   * 按资源读取 CRM SQLite 只读库中的真实记录。
   *
   * 参数说明：`resource` 为标准业务资源名，例如 `opportunities` 或 `orders`。
   * 返回值说明：返回 JSON 解析后的业务记录数组，最多不超过配置的 `maxRows`。
   * 可能抛出的异常：数据库未启用、路径不存在、文件过大或资源表缺失。
   * 调用注意事项：优先读取 `analysis-mirror` 中的 `fact_* / dim_*` 表；旧 `entities` 只作为历史快照兼容。
   */
  async readResource(resource: CrmSqliteResource): Promise<SqliteRow[]> {
    this.assertAvailable();
    const config = this.localRuntimeConfigService.getCrmSqliteReadonlyAnalysisConfig();
    const db = this.openReadonlyDatabase();
    try {
      const tables = this.listDatabaseObjects(db, 'table');
      const tableName = this.resolveResourceTableName(resource, tables);
      if (tableName) {
        return await this.readDirectResourceTable(db, resource, tableName, config.maxRows);
      }

      if (tables.has('entities')) {
        const countRow = db
          .prepare('SELECT COUNT(1) AS total FROM "entities" WHERE "entity_name" = ?')
          .get(resource);
        if (Number(countRow?.total ?? 0) > 0) {
          return await this.readEntitiesResource(db, resource, config.maxRows);
        }
      }

      throw new RealDataUnavailableError(
        `CRM SQLite 只读库中未找到 ${resource} 对应的白名单资源表。`,
      );
    } finally {
      db.close();
    }
  }

  /**
   * 读取 `analysis-mirror` 预聚合视图。
   *
   * 参数说明：
   * - `viewName`：联软镜像库提供的固定分析视图名，只允许读取白名单视图。
   * - `maxRows`：可选行数上限；不传时使用 SQLite 路线全局上限。
   * 返回值说明：返回视图原始行，字段保持联软镜像库命名，供业务执行器做中文化呈现。
   * 可能抛出的异常：数据库不可用、视图不存在或视图名不在白名单时抛出。
   * 调用注意事项：该入口只拼接受控视图名和 LIMIT，不接收用户自由 SQL。
   */
  async readAnalysisView(
    viewName: CrmSqliteAnalysisView,
    maxRows?: number,
  ): Promise<SqliteRow[]> {
    this.assertAvailable();
    if (!ANALYSIS_MIRROR_VIEW_NAMES.has(viewName)) {
      throw new RealDataUnavailableError('CRM SQLite 只读库分析视图未在白名单中。');
    }

    const config = this.localRuntimeConfigService.getCrmSqliteReadonlyAnalysisConfig();
    const limit = Math.min(Math.max(Math.floor(maxRows ?? config.maxRows), 1), config.maxRows);
    const db = this.openReadonlyDatabase();
    try {
      const views = this.listDatabaseObjects(db, 'view');
      if (!views.has(viewName)) {
        throw new RealDataUnavailableError(`CRM SQLite 只读库中未找到分析视图 ${viewName}。`);
      }

      const sql = `SELECT * FROM ${this.quoteIdentifier(viewName)} LIMIT ?`;
      const auditedResult = await this.sqlAuditService.execute<[SqliteRow[]]>({
        sql,
        params: [limit],
        databaseRole: 'CRM_READONLY',
        timeoutMs: config.queryTimeoutMs,
        moduleKey: 'analysis-workbench',
        programName: 'CrmSqliteReadonlyService.readAnalysisView',
        execute: async () => [db.prepare(sql).all(limit)],
      });
      return auditedResult[0];
    } finally {
      db.close();
    }
  }

  /**
   * 执行已经过 SQLite Guard 校验的只读 SELECT。
   *
   * 参数说明：
   * - `sql/params`：候选 SQL 和绑定参数。
   * - `options`：默认 LIMIT、最大 LIMIT 与审计程序名。
   * 返回值说明：返回查询行数组。
   * 可能抛出的异常：SQL Guard 未通过、数据库不可用或底层读取失败。
   * 调用注意事项：该入口为后续受控 Text-to-SQL 预留；当前业务主链优先走固定模板。
   */
  async executeSelect(
    sql: string,
    params: unknown[] = [],
    options: {
      defaultLimit?: number;
      maxLimit?: number;
      programName?: string;
    } = {},
  ): Promise<SqliteRow[]> {
    this.assertAvailable();
    const config = this.localRuntimeConfigService.getCrmSqliteReadonlyAnalysisConfig();
    const validated = this.crmSqliteReadonlySqlGuardService.validateAndNormalize(sql, {
      defaultLimit: options.defaultLimit ?? Math.min(config.maxRows, 100),
      maxLimit: options.maxLimit ?? config.maxRows,
    });
    const db = this.openReadonlyDatabase();
    try {
      const auditedResult = await this.sqlAuditService.execute<[SqliteRow[]]>({
        sql: validated.normalizedSql,
        params,
        databaseRole: 'CRM_READONLY',
        timeoutMs: config.queryTimeoutMs,
        moduleKey: 'analysis-workbench',
        programName: options.programName ?? 'CrmSqliteReadonlyService.executeSelect',
        execute: async () => [db.prepare(validated.normalizedSql).all(...params)],
      });
      return auditedResult[0];
    } finally {
      db.close();
    }
  }

  /**
   * 校验 SQLite 只读库配置是否可用。
   */
  private assertAvailable(): void {
    const config = this.localRuntimeConfigService.getCrmSqliteReadonlyAnalysisConfig();
    if (!config.enabled) {
      throw new RealDataUnavailableError('CRM SQLite 只读库路线未启用。');
    }

    if (!config.dbPath?.trim()) {
      throw new RealDataUnavailableError('CRM SQLite 只读库未配置数据库路径。');
    }

    const resolvedPath = this.resolveDatabaseFilePath(config.dbPath);
    if (!existsSync(resolvedPath)) {
      throw new RealDataUnavailableError('CRM SQLite 只读库文件不存在，请检查路径配置。');
    }

    const stats = statSync(resolvedPath);
    if (!stats.isFile()) {
      throw new RealDataUnavailableError('CRM SQLite 只读库路径未解析到有效数据库文件。');
    }

    if (config.maxBytes && stats.size > config.maxBytes) {
      throw new RealDataUnavailableError('CRM SQLite 只读库文件超过配置大小上限，系统已停止读取。');
    }
  }

  /**
   * 以只读方式打开 SQLite 数据库。
   */
  private openReadonlyDatabase(): SqliteDatabase {
    const config = this.localRuntimeConfigService.getCrmSqliteReadonlyAnalysisConfig();
    const sqliteRuntime = runtimeRequire('node:sqlite') as SqliteRuntimeModule;
    return new sqliteRuntime.DatabaseSync(this.resolveDatabaseFilePath(config.dbPath), {
      readOnly: true,
      timeout: config.queryTimeoutMs,
    });
  }

  /**
   * 列出当前 SQLite 数据库中的表或视图。
   */
  private listDatabaseObjects(db: SqliteDatabase, type: 'table' | 'view'): Set<string> {
    const rows = db
      .prepare('SELECT name FROM sqlite_master WHERE type = ?')
      .all(type);
    return new Set(
      rows
        .map((row) => String(row.name ?? '').trim())
        .filter((name) => name && !name.startsWith('sqlite_')),
    );
  }

  /**
   * 从联软 `entities` JSON 资源表读取记录。
   */
  private async readEntitiesResource(
    db: SqliteDatabase,
    resource: CrmSqliteResource,
    maxRows: number,
  ): Promise<SqliteRow[]> {
    const sql = [
      'SELECT "id", "data_json", "updated_at"',
      'FROM "entities"',
      'WHERE "entity_name" = ?',
      'ORDER BY "updated_at" DESC',
      'LIMIT ?',
    ].join(' ');
    const auditedResult = await this.sqlAuditService.execute<[SqliteRow[]]>({
      sql,
      params: [resource, maxRows],
      databaseRole: 'CRM_READONLY',
      timeoutMs:
        this.localRuntimeConfigService.getCrmSqliteReadonlyAnalysisConfig()
          .queryTimeoutMs,
      moduleKey: 'analysis-workbench',
      programName: 'CrmSqliteReadonlyService.readEntitiesResource',
      execute: async () => [
        db
          .prepare(sql)
          .all(resource, maxRows)
          .map((row) => this.parseEntityRow(resource, row)),
      ],
    });

    return auditedResult[0];
  }

  /**
   * 从 fact/dim 明细表读取记录。
   */
  private async readDirectResourceTable(
    db: SqliteDatabase,
    resource: CrmSqliteResource,
    tableName: string,
    maxRows: number,
  ): Promise<SqliteRow[]> {
    const sql = `SELECT * FROM ${this.quoteIdentifier(tableName)} LIMIT ?`;
    const auditedResult = await this.sqlAuditService.execute<[SqliteRow[]]>({
      sql,
      params: [maxRows],
      databaseRole: 'CRM_READONLY',
      timeoutMs:
        this.localRuntimeConfigService.getCrmSqliteReadonlyAnalysisConfig()
          .queryTimeoutMs,
      moduleKey: 'analysis-workbench',
      programName: 'CrmSqliteReadonlyService.readDirectResourceTable',
      execute: async () => [
        db.prepare(sql).all(maxRows).map((row) => ({
          ...row,
          __resource: resource,
        })),
      ],
    });

    return auditedResult[0];
  }

  /**
   * 将 `entities.data_json` 解析为普通对象。
   */
  private parseEntityRow(resource: CrmSqliteResource, row: SqliteRow): SqliteRow {
    const rawJson = String(row.data_json ?? '').trim();
    let payload: SqliteRow = {};
    try {
      const parsed = JSON.parse(rawJson) as unknown;
      payload = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as SqliteRow)
        : {};
    } catch {
      payload = {};
    }

    return {
      id: payload.id ?? row.id,
      ...payload,
      __resource: resource,
      __sourceUpdatedAt: row.updated_at,
    };
  }

  /**
   * 根据资源名解析可读取的 fact/dim 明细表。
   */
  private resolveResourceTableName(
    resource: CrmSqliteResource,
    tables: Set<string>,
  ): string | undefined {
    return RESOURCE_TABLE_CANDIDATES[resource].find((tableName) =>
      tables.has(tableName),
    );
  }

  /**
   * 安全转义固定白名单表名。
   */
  private quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/gu, '""')}"`;
  }

  /**
   * 将配置路径解析为实际 SQLite 数据库文件。
   *
   * 参数说明：`configuredPath` 可以是具体 `.db/.sqlite/.sqlite3` 文件，也可以是 `analysis-mirror` 目录。
   * 返回值说明：返回可直接传给 SQLite 的文件路径。
   * 可能抛出的异常：目录中不存在可读取的镜像库文件时抛出。
   * 调用注意事项：目录模式优先使用 `analysis_mirror_latest.db`，避免服务重启后仍读旧批次。
   */
  private resolveDatabaseFilePath(configuredPath?: string): string {
    const trimmedPath = String(configuredPath ?? '').trim();
    const resolvedPath = resolve(trimmedPath);
    if (!existsSync(resolvedPath)) {
      return resolvedPath;
    }

    const stats = statSync(resolvedPath);
    if (stats.isFile()) {
      return resolvedPath;
    }

    if (!stats.isDirectory()) {
      return resolvedPath;
    }

    const latestPath = join(resolvedPath, 'analysis_mirror_latest.db');
    if (existsSync(latestPath) && statSync(latestPath).isFile()) {
      return latestPath;
    }

    const candidates = readdirSync(resolvedPath)
      .map((name) => join(resolvedPath, name))
      .filter((filePath) => {
        if (!/\.(db|sqlite|sqlite3)$/iu.test(filePath)) {
          return false;
        }
        return existsSync(filePath) && statSync(filePath).isFile();
      })
      .map((filePath) => ({
        filePath,
        mtimeMs: statSync(filePath).mtimeMs,
      }))
      .sort((left, right) => right.mtimeMs - left.mtimeMs);

    if (!candidates.length) {
      throw new RealDataUnavailableError('CRM SQLite 只读库目录中未找到可读取的数据库文件。');
    }

    return candidates[0].filePath;
  }
}

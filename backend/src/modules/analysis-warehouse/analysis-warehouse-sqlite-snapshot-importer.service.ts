import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, join, resolve, sep } from 'node:path';
import initSqlJs from 'sql.js';
import type { Database, QueryExecResult, SqlJsStatic, SqlValue } from 'sql.js';
import type {
  AnalysisWarehouseResource,
  AnalysisWarehouseSyncMode,
} from '../../shared/types/domain';

export interface SqliteSnapshotImportedRow {
  payload: Record<string, unknown>;
  sourceObjectId?: string;
}

export interface ImportSqliteSnapshotResourceOptions {
  resource: AnalysisWarehouseResource;
  mode: AnalysisWarehouseSyncMode;
  pageSize: number;
  maxPages: number;
  checkpointCursor?: string;
}

export interface SqliteSnapshotResourceImportResult {
  resource: AnalysisWarehouseResource;
  rows: SqliteSnapshotImportedRow[];
  tableName?: string;
  snapshotFile?: string;
  snapshotHash?: string;
  latestUpdatedAt?: string;
  total?: number;
}

interface SqliteSnapshotReadResult {
  rows: Record<string, unknown>[];
  total: number;
  latestUpdatedAt?: string;
}

interface SnapshotManifest {
  snapshotDb?: string;
  latestDb?: string;
  sha256?: string;
  latestSha256?: string;
}

interface RecordCountsFile {
  snapshotCounts?: Array<{
    entity_name?: string;
    count?: number;
  }>;
}

const SQLITE_SNAPSHOT_EXTENSIONS = new Set(['.db', '.sqlite', '.sqlite3']);
const SQLITE_METADATA_RESOURCES = new Set<AnalysisWarehouseResource>([
  'dictionaries',
  'rolePermissions',
  'permissions',
]);
const UPDATED_AT_CANDIDATES = [
  'updatedAt',
  'updateTime',
  'modifiedAt',
  'updated_at',
  'update_time',
  'modified_at',
  'source_updated_at',
];
const RESOURCE_ID_CANDIDATES: Record<AnalysisWarehouseResource, string[]> = {
  users: ['id', 'userId', 'user_id', 'userid', 'crm_user_id'],
  customers: ['id', 'customerId', 'customer_id'],
  partners: ['id', 'partnerId', 'partner_id'],
  registrations: ['id', 'registrationId', 'registration_id'],
  opportunities: ['id', 'opportunityId', 'opportunity_id'],
  quotes: ['id', 'quoteId', 'quote_id'],
  orders: ['id', 'orderId', 'order_id'],
  dictionaries: ['id'],
  rolePermissions: ['id'],
  permissions: ['id'],
};
const RESOURCE_TABLE_CANDIDATES: Record<AnalysisWarehouseResource, string[]> = {
  users: ['users', 'crm_users', 'lianruan_users'],
  customers: ['customers', 'crm_customers', 'lianruan_customers'],
  partners: ['partners', 'crm_partners', 'lianruan_partners'],
  registrations: [
    'registrations',
    'customer_registrations',
    'crm_registrations',
    'lianruan_registrations',
  ],
  opportunities: ['opportunities', 'crm_opportunities', 'lianruan_opportunities'],
  quotes: ['quotes', 'crm_quotes', 'lianruan_quotes'],
  orders: ['orders', 'crm_orders', 'lianruan_orders'],
  dictionaries: ['dictionaries'],
  rolePermissions: ['role_permissions'],
  permissions: ['permissions'],
};

@Injectable()
export class AnalysisWarehouseSqliteSnapshotImporterService {
  private sqlJsPromise?: Promise<SqlJsStatic>;

  /**
   * 读取 SQLite 快照来源状态。
   *
   * 参数说明：无。
   * 返回值说明：返回快照开关、目录、文件配置和最近可导入文件摘要。
   * 调用注意事项：该方法只返回治理诊断元数据，不读取业务表内容。
   */
  getStatus(): Record<string, unknown> {
    const enabled = this.isEnabled();
    const snapshotDir = process.env.LIANRUAN_CRM_SQLITE_SNAPSHOT_DIR;
    const snapshotFile = process.env.LIANRUAN_CRM_SQLITE_SNAPSHOT_FILE;

    return {
      enabled,
      snapshotDirConfigured: Boolean(snapshotDir),
      snapshotFileConfigured: Boolean(snapshotFile),
      latestSnapshotFile: enabled ? this.tryResolveLatestSnapshotFileName() : undefined,
      statusLabel: 'SQLite 只读快照',
    };
  }

  /**
   * 判断 SQLite 快照同步是否具备最低配置。
   *
   * 参数说明：无。
   * 返回值说明：true 表示允许同步服务尝试读取快照副本。
   * 调用注意事项：必须同时开启显式开关和目录配置，避免误读联软生产运行库。
   */
  isConfigured(): boolean {
    return this.isEnabled() && Boolean(process.env.LIANRUAN_CRM_SQLITE_SNAPSHOT_DIR);
  }

  /**
   * 从 SQLite 只读快照导入单个资源。
   *
   * 参数说明：`options` 包含资源名、同步模式、分页限制和增量游标。
   * 返回值说明：返回资源对应的业务行、快照文件摘要和最新更新时间。
   * 调用注意事项：只允许读取资源白名单映射表；不接受用户传入任意表名或 SQL。
   */
  async importResource(
    options: ImportSqliteSnapshotResourceOptions,
  ): Promise<SqliteSnapshotResourceImportResult> {
    if (SQLITE_METADATA_RESOURCES.has(options.resource)) {
      return {
        resource: options.resource,
        rows: [],
        total: 0,
      };
    }

    const snapshotPath = this.resolveSnapshotPath();
    const snapshotBuffer = readFileSync(snapshotPath);
    const maxBytes = this.resolveMaxSnapshotBytes();
    if (snapshotBuffer.byteLength > maxBytes) {
      throw new Error(
        `SQLite 快照文件超过允许大小 ${maxBytes} 字节，请先提供更小的只读副本或分批导出。`,
      );
    }

    const sqlJs = await this.loadSqlJs();
    const database = new sqlJs.Database(snapshotBuffer);
    try {
      const snapshotHash = createHash('sha256').update(snapshotBuffer).digest('hex');
      this.validateSnapshotHash(snapshotPath, snapshotHash);
      const tableName = this.resolveResourceTableName(database, options.resource);
      const queryResult = this.readResourceRows(database, {
        resource: options.resource,
        tableName,
        checkpointCursor: options.mode === 'INCREMENTAL' ? options.checkpointCursor : undefined,
        limit: this.resolveLimit(options.pageSize, options.maxPages),
      });
      if (options.mode === 'FULL') {
        this.validateRecordCount(snapshotPath, options.resource, queryResult.total);
      }
      const rows = queryResult.rows.map((payload) => ({
        payload,
        sourceObjectId: this.resolveSourceObjectId(options.resource, payload),
      }));

      return {
        resource: options.resource,
        rows,
        tableName,
        snapshotFile: basename(snapshotPath),
        snapshotHash,
        latestUpdatedAt:
          queryResult.latestUpdatedAt ??
          this.resolveLatestUpdatedAt(rows.map((row) => row.payload)),
        total: queryResult.total,
      };
    } finally {
      database.close();
    }
  }

  /**
   * 判断环境变量是否显式启用 SQLite 快照。
   *
   * 参数说明：无。
   * 返回值说明：true 表示允许读取只读快照目录。
   * 调用注意事项：生产 SQLite 直连不应通过该开关表达；该开关只代表快照副本导入。
   */
  private isEnabled(): boolean {
    return process.env.LIANRUAN_CRM_SQLITE_SNAPSHOT_ENABLED === 'true';
  }

  /**
   * 加载 sql.js 运行时。
   *
   * 参数说明：无。
   * 返回值说明：返回已初始化的 sql.js 静态对象。
   * 调用注意事项：显式定位 WASM 文件，避免生产启动目录变化导致快照导入失败。
   */
  private async loadSqlJs(): Promise<SqlJsStatic> {
    if (!this.sqlJsPromise) {
      const sqlJsDistDir = dirname(require.resolve('sql.js/dist/sql-wasm.js'));
      this.sqlJsPromise = initSqlJs({
        locateFile: (fileName) => join(sqlJsDistDir, fileName),
      });
    }

    return await this.sqlJsPromise;
  }

  /**
   * 解析本次应读取的 SQLite 快照文件。
   *
   * 参数说明：无。
   * 返回值说明：返回已解析并确认位于快照目录内的文件绝对路径。
   * 调用注意事项：只允许 `.db`、`.sqlite`、`.sqlite3` 后缀，避免把任意文件读入进程。
   */
  private resolveSnapshotPath(): string {
    if (!this.isConfigured()) {
      throw new Error('SQLite 只读快照未启用或未配置快照目录。');
    }

    const snapshotDir = this.resolveSnapshotDir();
    const configuredFile = process.env.LIANRUAN_CRM_SQLITE_SNAPSHOT_FILE?.trim();
    const snapshotPath = configuredFile
      ? this.resolveConfiguredSnapshotFile(snapshotDir, configuredFile)
      : this.resolveLatestSnapshotFile(snapshotDir);

    this.ensureAllowedSnapshotPath(snapshotDir, snapshotPath);
    return snapshotPath;
  }

  /**
   * 解析快照目录。
   *
   * 参数说明：无。
   * 返回值说明：返回快照目录绝对路径。
   * 调用注意事项：目录不存在时直接阻断，避免静默回退到生产库路径。
   */
  private resolveSnapshotDir(): string {
    const snapshotDir = process.env.LIANRUAN_CRM_SQLITE_SNAPSHOT_DIR?.trim();
    if (!snapshotDir) {
      throw new Error('缺少 LIANRUAN_CRM_SQLITE_SNAPSHOT_DIR 配置。');
    }

    const resolvedDir = resolve(snapshotDir);
    if (!existsSync(resolvedDir) || !statSync(resolvedDir).isDirectory()) {
      throw new Error('SQLite 只读快照目录不存在或不可访问。');
    }

    return resolvedDir;
  }

  /**
   * 解析显式指定的快照文件。
   *
   * 参数说明：`snapshotDir` 为白名单目录，`configuredFile` 为环境变量中的文件名或路径。
   * 返回值说明：返回快照文件绝对路径。
   * 调用注意事项：即使传入绝对路径，也必须落在快照目录内，不能越界读取生产文件。
   */
  private resolveConfiguredSnapshotFile(
    snapshotDir: string,
    configuredFile: string,
  ): string {
    return isAbsolute(configuredFile)
      ? resolve(configuredFile)
      : resolve(snapshotDir, configuredFile);
  }

  /**
   * 自动选择目录中最新的 SQLite 快照文件。
   *
   * 参数说明：`snapshotDir` 为快照目录。
   * 返回值说明：返回最新快照文件绝对路径。
   * 调用注意事项：按修改时间排序，仅用于只读快照目录，不扫描子目录。
   */
  private resolveLatestSnapshotFile(snapshotDir: string): string {
    const candidates = readdirSync(snapshotDir)
      .map((fileName) => resolve(snapshotDir, fileName))
      .filter((filePath) => this.isAllowedSnapshotFile(filePath))
      .map((filePath) => ({ filePath, mtimeMs: statSync(filePath).mtimeMs }))
      .sort((left, right) => right.mtimeMs - left.mtimeMs);

    if (candidates.length === 0) {
      throw new Error('SQLite 只读快照目录中未找到 .db/.sqlite/.sqlite3 文件。');
    }

    return candidates[0].filePath;
  }

  /**
   * 尝试读取最新快照文件名。
   *
   * 参数说明：无。
   * 返回值说明：成功时返回文件名，失败时返回 undefined。
   * 调用注意事项：仅供治理概览展示，不影响同步主流程。
   */
  private tryResolveLatestSnapshotFileName(): string | undefined {
    try {
      return basename(this.resolveSnapshotPath());
    } catch {
      return undefined;
    }
  }

  /**
   * 校验快照路径边界。
   *
   * 参数说明：`snapshotDir` 为允许目录，`snapshotPath` 为待读取文件路径。
   * 返回值说明：无返回值；非法路径直接抛错。
   * 调用注意事项：防止通过环境变量把同步链路指向联软生产 SQLite 文件。
   */
  private ensureAllowedSnapshotPath(snapshotDir: string, snapshotPath: string): void {
    if (!snapshotPath.startsWith(`${snapshotDir}${sep}`) && snapshotPath !== snapshotDir) {
      throw new Error('SQLite 快照文件必须位于配置的只读快照目录内。');
    }

    if (!this.isAllowedSnapshotFile(snapshotPath)) {
      throw new Error('SQLite 快照文件不存在、不是普通文件或后缀不受支持。');
    }
  }

  /**
   * 判断文件是否为允许的 SQLite 快照。
   *
   * 参数说明：`filePath` 为候选文件绝对路径。
   * 返回值说明：true 表示后缀和文件类型均符合要求。
   * 调用注意事项：不跟随目录递归，减少误读和越权读取风险。
   */
  private isAllowedSnapshotFile(filePath: string): boolean {
    return (
      SQLITE_SNAPSHOT_EXTENSIONS.has(extname(filePath).toLowerCase()) &&
      existsSync(filePath) &&
      statSync(filePath).isFile()
    );
  }

  /**
   * 解析单次允许读取的快照最大字节数。
   *
   * 参数说明：无。
   * 返回值说明：返回字节数，默认 512MB。
   * 调用注意事项：sql.js 会把快照读入内存，因此必须限制文件大小。
   */
  private resolveMaxSnapshotBytes(): number {
    const value = Number(process.env.LIANRUAN_CRM_SQLITE_SNAPSHOT_MAX_BYTES);
    if (Number.isFinite(value) && value > 0) {
      return Math.trunc(value);
    }

    return 512 * 1024 * 1024;
  }

  /**
   * 校验 SQLite 快照 SHA256。
   *
   * 参数说明：`snapshotPath` 为快照文件路径，`actualHash` 为本次计算出的 SHA256。
   * 返回值说明：无返回值；不一致时直接抛错。
   * 调用注意事项：优先使用显式环境变量，其次读取同目录 `snapshot-manifest.json`，避免篡改快照进入分析库。
   */
  private validateSnapshotHash(snapshotPath: string, actualHash: string): void {
    const expectedHash = (
      process.env.LIANRUAN_CRM_SQLITE_SNAPSHOT_SHA256 ??
      this.resolveManifestHash(snapshotPath)
    )?.toLowerCase();
    if (!expectedHash) {
      return;
    }

    if (actualHash.toLowerCase() !== expectedHash) {
      throw new Error('SQLite 快照 SHA256 校验失败，请重新获取联软只读快照。');
    }
  }

  /**
   * 从 manifest 中解析当前快照的期望 hash。
   *
   * 参数说明：`snapshotPath` 为快照文件路径。
   * 返回值说明：命中时返回 hash，否则返回 undefined。
   * 调用注意事项：manifest 文件只作为校验辅助，不作为快照路径来源。
   */
  private resolveManifestHash(snapshotPath: string): string | undefined {
    const manifest = this.readJsonFile<SnapshotManifest>(
      join(dirname(snapshotPath), 'snapshot-manifest.json'),
    );
    if (!manifest) {
      return undefined;
    }

    const fileName = basename(snapshotPath);
    if (manifest.snapshotDb === fileName) {
      return manifest.sha256;
    }

    if (manifest.latestDb === fileName) {
      return manifest.latestSha256;
    }

    return undefined;
  }

  /**
   * 校验资源记录数。
   *
   * 参数说明：`snapshotPath` 为快照路径，`resource` 为资源名，`actualTotal` 为快照内读取到的资源总数。
   * 返回值说明：无返回值；记录数不一致时抛错。
   * 调用注意事项：只在全量同步时校验，用于发现快照生成、传输或解析过程中的数据缺口。
   */
  private validateRecordCount(
    snapshotPath: string,
    resource: AnalysisWarehouseResource,
    actualTotal: number,
  ): void {
    const counts = this.readJsonFile<RecordCountsFile>(
      join(dirname(snapshotPath), 'record-counts.json'),
    );
    const expectedTotal = counts?.snapshotCounts?.find(
      (item) => item.entity_name === resource,
    )?.count;
    if (typeof expectedTotal !== 'number') {
      return;
    }

    if (actualTotal !== expectedTotal) {
      throw new Error(
        `SQLite 快照资源 ${resource} 记录数校验失败，期望 ${expectedTotal} 条，实际 ${actualTotal} 条。`,
      );
    }
  }

  /**
   * 读取同目录 JSON 校验文件。
   *
   * 参数说明：`filePath` 为 JSON 文件路径。
   * 返回值说明：文件存在且 JSON 合法时返回对象，否则返回 undefined。
   * 调用注意事项：该方法只读取快照目录下的交付校验文件，不读取业务明细。
   */
  private readJsonFile<T extends object>(filePath: string): T | undefined {
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      return undefined;
    }

    try {
      return JSON.parse(readFileSync(filePath, 'utf8')) as T;
    } catch {
      throw new Error(`${basename(filePath)} 不是合法 JSON 文件。`);
    }
  }

  /**
   * 解析资源对应的 SQLite 表名。
   *
   * 参数说明：`database` 为已打开快照，`resource` 为同步资源。
   * 返回值说明：返回命中的表名。
   * 调用注意事项：只从环境变量映射和内置候选表中选择，不允许用户请求任意表。
   */
  private resolveResourceTableName(
    database: Database,
    resource: AnalysisWarehouseResource,
  ): string {
    const existingTables = new Set(this.listTableNames(database));
    const configuredTable = this.resolveConfiguredTableMap()[resource];
    const candidates = [
      ...(configuredTable ? [configuredTable] : []),
      ...RESOURCE_TABLE_CANDIDATES[resource],
    ];
    const tableName = candidates.find((candidate) => existingTables.has(candidate));
    if (tableName) {
      return tableName;
    }

    if (existingTables.has('entities') && this.hasEntityRows(database, resource)) {
      return 'entities';
    }

    throw new Error(`SQLite 快照中未找到资源 ${resource} 对应的白名单表。`);
  }

  /**
   * 读取环境变量中的资源表映射。
   *
   * 参数说明：无。
   * 返回值说明：返回资源名到表名的映射。
   * 调用注意事项：仅接受 JSON 对象；表名后续仍会经过快照表存在性校验。
   */
  private resolveConfiguredTableMap(): Partial<Record<AnalysisWarehouseResource, string>> {
    const rawMap = process.env.LIANRUAN_CRM_SQLITE_TABLE_MAP;
    if (!rawMap) {
      return {};
    }

    try {
      const parsed = JSON.parse(rawMap) as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(parsed).filter(
          (entry): entry is [AnalysisWarehouseResource, string] =>
            typeof entry[1] === 'string' &&
            Object.prototype.hasOwnProperty.call(RESOURCE_TABLE_CANDIDATES, entry[0]),
        ),
      ) as Partial<Record<AnalysisWarehouseResource, string>>;
    } catch {
      throw new Error('LIANRUAN_CRM_SQLITE_TABLE_MAP 必须是合法 JSON 对象。');
    }
  }

  /**
   * 读取 SQLite 快照中的所有业务表名。
   *
   * 参数说明：`database` 为已打开快照。
   * 返回值说明：返回普通表名集合。
   * 调用注意事项：过滤 SQLite 系统表，避免后续资源映射误命中内部表。
   */
  private listTableNames(database: Database): string[] {
    const result = database.exec(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    )[0];
    if (!result) {
      return [];
    }

    return result.values
      .map((row) => String(row[0] ?? '').trim())
      .filter(Boolean);
  }

  /**
   * 读取表字段列表。
   *
   * 参数说明：`database` 为已打开快照，`tableName` 为白名单命中表。
   * 返回值说明：返回字段名列表。
   * 调用注意事项：字段名只来自 SQLite 元数据，不接受外部输入。
   */
  private readTableColumns(database: Database, tableName: string): string[] {
    const result = database.exec(`PRAGMA table_info(${this.quoteIdentifier(tableName)})`)[0];
    if (!result) {
      return [];
    }

    const nameIndex = result.columns.indexOf('name');
    return result.values
      .map((row) => String(row[nameIndex] ?? '').trim())
      .filter(Boolean);
  }

  /**
   * 读取资源表数据。
   *
   * 参数说明：包含表名、字段、增量游标和读取上限。
   * 返回值说明：返回普通对象行和估算总数。
   * 调用注意事项：SQL 由程序固定生成，只拼接已校验标识符，值统一参数化。
   */
  private readResourceRows(
    database: Database,
    options: {
      resource: AnalysisWarehouseResource;
      tableName: string;
      checkpointCursor?: string;
      limit: number;
    },
  ): SqliteSnapshotReadResult {
    const columns = this.readTableColumns(database, options.tableName);
    if (this.isEntitiesModelTable(options.tableName, columns)) {
      return this.readEntityResourceRows(database, options);
    }

    const updatedAtColumn = columns.find((column) =>
      UPDATED_AT_CANDIDATES.includes(column),
    );
    const whereSql =
      updatedAtColumn && options.checkpointCursor
        ? ` WHERE ${this.quoteIdentifier(updatedAtColumn)} > ?`
        : '';
    const orderSql = updatedAtColumn
      ? ` ORDER BY ${this.quoteIdentifier(updatedAtColumn)} ASC`
      : '';
    const checkpointCursor =
      typeof options.checkpointCursor === 'string' && options.checkpointCursor
        ? options.checkpointCursor
        : undefined;
    const usesCheckpoint = Boolean(updatedAtColumn && checkpointCursor);
    const params: SqlValue[] = usesCheckpoint
      ? [checkpointCursor!, options.limit]
      : [options.limit];
    const sql = `SELECT * FROM ${this.quoteIdentifier(options.tableName)}${whereSql}${orderSql} LIMIT ?`;
    const result = database.exec(sql, params)[0];
    const rows = result ? this.toObjectRows(result) : [];
    const totalResult = database.exec(
      `SELECT COUNT(1) AS total FROM ${this.quoteIdentifier(options.tableName)}${whereSql}`,
      usesCheckpoint ? [checkpointCursor!] : undefined,
    )[0];
    const total = Number(totalResult?.values?.[0]?.[0] ?? rows.length);

    return {
      rows,
      total: Number.isFinite(total) ? total : rows.length,
    };
  }

  /**
   * 判断快照是否使用联软通用实体表模型。
   *
   * 参数说明：`tableName` 为命中的表名，`columns` 为表字段。
   * 返回值说明：true 表示可按 `entity_name + data_json` 解析业务对象。
   * 调用注意事项：该模式是联软当前 SQLite 快照的主模型，不能把 `entities` 当作普通明细表直接落库。
   */
  private isEntitiesModelTable(tableName: string, columns: string[]): boolean {
    return (
      tableName === 'entities' &&
      columns.includes('entity_name') &&
      columns.includes('id') &&
      columns.includes('data_json')
    );
  }

  /**
   * 判断通用实体表里是否存在目标资源。
   *
   * 参数说明：`database` 为已打开快照，`resource` 为同步资源。
   * 返回值说明：true 表示该资源可从 `entities` 表导入。
   * 调用注意事项：只用参数化查询读取固定实体名，不接受任意表名。
   */
  private hasEntityRows(
    database: Database,
    resource: AnalysisWarehouseResource,
  ): boolean {
    const result = database.exec(
      'SELECT COUNT(1) AS total FROM "entities" WHERE "entity_name" = ?',
      [resource],
    )[0];
    return Number(result?.values?.[0]?.[0] ?? 0) > 0;
  }

  /**
   * 从联软通用实体表读取业务资源。
   *
   * 参数说明：资源名、读取上限和可选更新时间游标。
   * 返回值说明：返回解析后的 JSON 行、资源总数和最新更新时间。
   * 调用注意事项：`data_json` 是联软脱敏快照交付的业务对象 JSON；解析失败应阻断，避免脏数据进入分析库。
   */
  private readEntityResourceRows(
    database: Database,
    options: {
      resource: AnalysisWarehouseResource;
      checkpointCursor?: string;
      limit: number;
    },
  ): SqliteSnapshotReadResult {
    const checkpointCursor =
      typeof options.checkpointCursor === 'string' && options.checkpointCursor
        ? options.checkpointCursor
        : undefined;
    const whereSql = checkpointCursor ? ' AND "updated_at" > ?' : '';
    const params: SqlValue[] = checkpointCursor
      ? [options.resource, checkpointCursor, options.limit]
      : [options.resource, options.limit];
    const result = database.exec(
      `SELECT "id", "data_json", "updated_at"
         FROM "entities"
        WHERE "entity_name" = ?${whereSql}
        ORDER BY "updated_at" ASC
        LIMIT ?`,
      params,
    )[0];
    const countResult = database.exec(
      'SELECT COUNT(1) AS total FROM "entities" WHERE "entity_name" = ?',
      [options.resource],
    )[0];
    const rows = (result?.values ?? []).map((row) =>
      this.parseEntityPayload({
        resource: options.resource,
        id: String(row[0] ?? ''),
        dataJson: String(row[1] ?? '{}'),
        updatedAt: typeof row[2] === 'string' ? row[2] : undefined,
      }),
    );

    return {
      rows,
      total: Number(countResult?.values?.[0]?.[0] ?? rows.length),
      latestUpdatedAt: this.resolveLatestUpdatedAt(rows),
    };
  }

  /**
   * 解析联软实体表中的业务 JSON。
   *
   * 参数说明：资源名、实体主键、JSON 文本和实体更新时间。
   * 返回值说明：返回可写入 ODS 的业务对象。
   * 调用注意事项：保留业务 JSON 字段原貌，只在缺少 `id` 或更新时间时补齐同步所需字段。
   */
  private parseEntityPayload(params: {
    resource: AnalysisWarehouseResource;
    id: string;
    dataJson: string;
    updatedAt?: string;
  }): Record<string, unknown> {
    try {
      const parsed = JSON.parse(params.dataJson) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('data_json 不是对象');
      }
      const payload = { ...(parsed as Record<string, unknown>) };
      if (!payload.id && params.id) {
        payload.id = params.id;
      }
      if (!this.resolveLatestUpdatedAt([payload]) && params.updatedAt) {
        payload.updatedAt = params.updatedAt;
      }
      return payload;
    } catch (error) {
      const reason = error instanceof Error ? error.message : '未知解析错误';
      throw new Error(
        `SQLite 快照资源 ${params.resource} 的实体 ${params.id} JSON 解析失败：${reason}`,
      );
    }
  }

  /**
   * 将 sql.js 查询结果转换为普通对象。
   *
   * 参数说明：`result` 为 sql.js 返回的单结果集。
   * 返回值说明：返回字段名到字段值的对象数组。
   * 调用注意事项：二进制字段不进入分析库原始 JSON，避免误存附件或敏感文件内容。
   */
  private toObjectRows(result: QueryExecResult): Record<string, unknown>[] {
    return result.values.map((row) =>
      Object.fromEntries(
        result.columns.map((column, index) => [
          column,
          this.normalizeSqliteValue(row[index]),
        ]),
      ),
    );
  }

  /**
   * 标准化 SQLite 字段值。
   *
   * 参数说明：`value` 为 sql.js 读取出的字段值。
   * 返回值说明：返回可安全 JSON 序列化的字段值。
   * 调用注意事项：BLOB 暂不导入，后续如确需附件摘要，应走单独脱敏链路。
   */
  private normalizeSqliteValue(value: SqlValue): unknown {
    if (value instanceof Uint8Array) {
      return '[二进制字段已跳过]';
    }

    return value;
  }

  /**
   * 解析业务对象主键。
   *
   * 参数说明：`resource` 为资源名，`payload` 为 SQLite 行对象。
   * 返回值说明：返回可用于幂等写入的业务主键；缺失时返回 undefined。
   * 调用注意事项：只从资源主键候选字段读取，不用整行 hash 替代真实业务主键。
   */
  private resolveSourceObjectId(
    resource: AnalysisWarehouseResource,
    payload: Record<string, unknown>,
  ): string | undefined {
    for (const fieldName of RESOURCE_ID_CANDIDATES[resource]) {
      const value = payload[fieldName];
      if (value !== undefined && value !== null && String(value).trim()) {
        return String(value).trim();
      }
    }

    return undefined;
  }

  /**
   * 解析本批次最新更新时间。
   *
   * 参数说明：`payloads` 为已读取的 SQLite 行对象。
   * 返回值说明：返回最新更新时间字符串；没有更新时间字段时返回 undefined。
   * 调用注意事项：该值仅用于下次增量候选游标，不代表快照完整性校验结论。
   */
  private resolveLatestUpdatedAt(payloads: Array<Record<string, unknown>>): string | undefined {
    return payloads
      .flatMap((payload) =>
        UPDATED_AT_CANDIDATES.map((fieldName) => payload[fieldName])
          .filter((value): value is string => typeof value === 'string' && Boolean(value)),
      )
      .sort()
      .at(-1);
  }

  /**
   * 解析资源读取上限。
   *
   * 参数说明：`pageSize` 和 `maxPages` 沿用治理同步入口限制。
   * 返回值说明：返回本次最多读取行数。
   * 调用注意事项：手动导入先保持限流，避免一次性把大快照读爆内存。
   */
  private resolveLimit(pageSize: number, maxPages: number): number {
    return Math.max(1, Math.trunc(pageSize) * Math.max(1, Math.trunc(maxPages)));
  }

  /**
   * 引用 SQLite 标识符。
   *
   * 参数说明：`identifier` 为来自白名单或 SQLite 元数据的表字段名。
   * 返回值说明：返回双引号包裹后的 SQLite 标识符。
   * 调用注意事项：虽然表字段不来自用户输入，仍统一转义双引号，避免特殊名称破坏 SQL。
   */
  private quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/gu, '""')}"`;
  }
}

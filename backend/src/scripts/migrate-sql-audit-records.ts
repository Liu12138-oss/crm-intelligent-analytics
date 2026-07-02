import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { SqlAuditFileStore } from '../modules/audit/sql-audit-file.store';
import type { AppStorageState, SqlAuditRecord } from '../shared/types/domain';

export interface MigrateRuntimeSqlAuditRecordsParams {
  storageFilePath: string;
  targetFilePath: string;
  checkpointFilePath?: string;
  batchSize?: number;
}

export interface MigrateRuntimeSqlAuditRecordsResult {
  totalCount: number;
  migratedCount: number;
  skippedCount: number;
  lastMigratedId?: string;
}

export interface SqlAuditStoreFieldMismatch {
  id: string;
  field: keyof SqlAuditRecord;
  runtimeValue: unknown;
  independentValue: unknown;
}

export interface SqlAuditStoreReconcileResult {
  runtimeCount: number;
  independentCount: number;
  missingInIndependentCount: number;
  extraInIndependentCount: number;
  fieldMismatchCount: number;
  missingInIndependentIds: string[];
  extraInIndependentIds: string[];
  fieldMismatches: SqlAuditStoreFieldMismatch[];
}

interface SqlAuditMigrationCheckpoint {
  lastMigratedId?: string;
  migratedIds: string[];
  updatedAt: string;
}

/**
 * 将运行态 SQL 审计迁移到独立 JSONL 存储，支持断点续跑。
 *
 * @param params 运行态文件、目标审计文件、断点文件和批量大小。
 * @returns 迁移总数、写入数、跳过数和最后迁移 ID。
 * @throws 运行态文件不存在、字段缺失或文件写入失败时抛出错误。
 */
export function migrateRuntimeSqlAuditRecords(
  params: MigrateRuntimeSqlAuditRecordsParams,
): MigrateRuntimeSqlAuditRecordsResult {
  if (!existsSync(params.storageFilePath)) {
    throw new Error(`运行态文件不存在：${params.storageFilePath}`);
  }

  const state = JSON.parse(
    readFileSync(params.storageFilePath, 'utf8'),
  ) as AppStorageState;
  const records = Array.isArray(state.sqlAuditRecords) ? state.sqlAuditRecords : [];
  const checkpointPath =
    params.checkpointFilePath ?? `${params.targetFilePath}.checkpoint.json`;
  const checkpoint = readCheckpoint(checkpointPath);
  const existingIds = new Set(
    new SqlAuditFileStore({ enabled: true, filePath: params.targetFilePath })
      .readAll()
      .map((item) => item.id),
  );
  const migratedIds = new Set([...checkpoint.migratedIds, ...existingIds]);
  const batchSize = normalizeBatchSize(params.batchSize);
  const store = new SqlAuditFileStore({ enabled: true, filePath: params.targetFilePath });
  let migratedCount = 0;
  let skippedCount = 0;
  let lastMigratedId = checkpoint.lastMigratedId;

  for (let index = 0; index < records.length; index += batchSize) {
    const batch = records.slice(index, index + batchSize);
    for (const record of batch) {
      validateSqlAuditRecord(record);

      // 断点和目标文件都参与去重，避免重跑时重复追加同一条审计。
      if (migratedIds.has(record.id)) {
        skippedCount += 1;
        continue;
      }

      store.create(record);
      migratedIds.add(record.id);
      migratedCount += 1;
      lastMigratedId = record.id;
    }

    // 每批更新断点；中途失败时下一次只会补未写入的记录。
    writeCheckpoint(checkpointPath, {
      lastMigratedId,
      migratedIds: [...migratedIds],
      updatedAt: new Date().toISOString(),
    });
  }

  if (records.length === 0) {
    writeCheckpoint(checkpointPath, {
      lastMigratedId,
      migratedIds: [...migratedIds],
      updatedAt: new Date().toISOString(),
    });
  }

  return {
    totalCount: records.length,
    migratedCount,
    skippedCount,
    lastMigratedId,
  };
}

/**
 * 对账运行态保留区和独立审计存储，输出灰度双写差异。
 *
 * @param params 运行态记录和独立审计文件路径。
 * @returns 数量差异、缺失记录和关键字段不一致明细。
 * @throws 不抛出异常；独立文件不存在时按空存储处理。
 */
export function reconcileSqlAuditStores(params: {
  runtimeRecords: SqlAuditRecord[];
  targetFilePath: string;
}): SqlAuditStoreReconcileResult {
  const independentRecords = new SqlAuditFileStore({
    enabled: true,
    filePath: params.targetFilePath,
  }).readAll();
  const runtimeRecordMap = new Map(params.runtimeRecords.map((item) => [item.id, item]));
  const independentRecordMap = new Map(independentRecords.map((item) => [item.id, item]));
  const missingInIndependentIds = params.runtimeRecords
    .filter((item) => !independentRecordMap.has(item.id))
    .map((item) => item.id);
  const extraInIndependentIds = independentRecords
    .filter((item) => !runtimeRecordMap.has(item.id))
    .map((item) => item.id);
  const fieldMismatches: SqlAuditStoreFieldMismatch[] = [];
  const compareFields: Array<keyof SqlAuditRecord> = [
    'createdAt',
    'actorId',
    'moduleKey',
    'databaseRole',
    'operationType',
    'status',
    'stage',
    'riskLevel',
    'requestId',
    'sessionId',
    'sqlFingerprint',
  ];

  for (const runtimeRecord of params.runtimeRecords) {
    const independentRecord = independentRecordMap.get(runtimeRecord.id);
    if (!independentRecord) {
      continue;
    }

    for (const field of compareFields) {
      if (!isSameComparableValue(runtimeRecord[field], independentRecord[field])) {
        fieldMismatches.push({
          id: runtimeRecord.id,
          field,
          runtimeValue: runtimeRecord[field],
          independentValue: independentRecord[field],
        });
      }
    }
  }

  return {
    runtimeCount: params.runtimeRecords.length,
    independentCount: independentRecords.length,
    missingInIndependentCount: missingInIndependentIds.length,
    extraInIndependentCount: extraInIndependentIds.length,
    fieldMismatchCount: fieldMismatches.length,
    missingInIndependentIds,
    extraInIndependentIds,
    fieldMismatches,
  };
}

/**
 * 读取迁移断点文件，文件不存在或损坏时按空断点处理。
 *
 * @param checkpointFilePath 断点文件路径。
 * @returns 已迁移记录 ID 和最后迁移 ID。
 * @throws 不抛出异常；断点损坏时依赖目标文件去重继续迁移。
 */
function readCheckpoint(checkpointFilePath: string): SqlAuditMigrationCheckpoint {
  if (!existsSync(checkpointFilePath)) {
    return { migratedIds: [], updatedAt: new Date(0).toISOString() };
  }

  try {
    const checkpoint = JSON.parse(
      readFileSync(checkpointFilePath, 'utf8'),
    ) as Partial<SqlAuditMigrationCheckpoint>;
    return {
      lastMigratedId: checkpoint.lastMigratedId,
      migratedIds: Array.isArray(checkpoint.migratedIds)
        ? checkpoint.migratedIds.filter((item): item is string => typeof item === 'string')
        : [],
      updatedAt: checkpoint.updatedAt ?? new Date(0).toISOString(),
    };
  } catch {
    return { migratedIds: [], updatedAt: new Date(0).toISOString() };
  }
}

/**
 * 写入迁移断点，先确保目录存在，避免生产共享目录首次执行失败。
 *
 * @param checkpointFilePath 断点文件路径。
 * @param checkpoint 最新断点内容。
 * @returns 无返回值。
 * @throws 文件写入失败时抛出错误，由调用方停止迁移。
 */
function writeCheckpoint(
  checkpointFilePath: string,
  checkpoint: SqlAuditMigrationCheckpoint,
): void {
  mkdirSync(dirname(checkpointFilePath), { recursive: true });
  writeFileSync(checkpointFilePath, JSON.stringify(checkpoint, null, 2), 'utf8');
}

/**
 * 规范化批量大小，避免非法参数造成死循环或单批过大。
 *
 * @param batchSize 外部传入的批量大小。
 * @returns 1 到 1000 之间的整数。
 * @throws 不抛出异常；非法值回退到 500。
 */
function normalizeBatchSize(batchSize?: number): number {
  if (!Number.isFinite(batchSize) || !batchSize) {
    return 500;
  }

  return Math.max(1, Math.min(Math.floor(batchSize), 1000));
}

/**
 * 比较对账字段值，数组字段按稳定 JSON 字符串比较。
 *
 * @param left 运行态字段值。
 * @param right 独立存储字段值。
 * @returns 字段语义一致时返回 `true`。
 * @throws 不抛出异常。
 */
function isSameComparableValue(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
  }

  return left === right;
}

/**
 * 校验迁移所需的审计关键字段，避免把不完整流水写入独立存储。
 *
 * @param record 待迁移的 SQL 审计记录。
 * @returns 无返回值。
 * @throws 缺少关键字段时抛出错误，便于运维先修复源数据。
 */
function validateSqlAuditRecord(record: SqlAuditRecord): void {
  const requiredFields: Array<keyof SqlAuditRecord> = [
    'id',
    'createdAt',
    'stage',
    'status',
    'riskLevel',
    'actorId',
    'moduleKey',
    'programName',
    'databaseRole',
    'operationType',
    'tables',
    'sqlSummary',
    'normalizedSql',
    'sqlFingerprint',
  ];
  const missingFields = requiredFields.filter((field) => {
    const value = record[field];
    return Array.isArray(value) ? value.length === 0 : value === undefined || value === '';
  });

  if (missingFields.length > 0) {
    throw new Error(
      `SQL 审计记录 ${record.id ?? '未知 ID'} 缺少关键字段：${missingFields.join(', ')}`,
    );
  }
}

if (require.main === module) {
  const storageFilePath =
    process.env.APP_STORAGE_FILE_PATH ?? resolveDefaultRuntimeFilePath('app-storage.json');
  const targetFilePath =
    process.env.SQL_AUDIT_FILE_STORE_PATH ??
    join(dirname(storageFilePath), 'sql-audit-records.jsonl');
  const checkpointFilePath =
    process.env.SQL_AUDIT_MIGRATION_CHECKPOINT_PATH ??
    `${targetFilePath}.checkpoint.json`;
  const result = migrateRuntimeSqlAuditRecords({
    storageFilePath,
    targetFilePath,
    checkpointFilePath,
    batchSize: Number(process.env.SQL_AUDIT_MIGRATION_BATCH_SIZE ?? '500'),
  });

  console.log(
    JSON.stringify(
      {
        message: 'SQL 审计独立存储迁移完成。',
        totalCount: result.totalCount,
        migratedCount: result.migratedCount,
        skippedCount: result.skippedCount,
        lastMigratedId: result.lastMigratedId,
        targetFilePath,
        checkpointFilePath,
      },
      null,
      2,
    ),
  );
}

/**
 * 解析发布环境默认运行态路径，兼容从 release 根目录或 backend 子目录执行脚本。
 *
 * @param fileName 运行态文件名。
 * @returns 优先存在的运行态文件路径；都不存在时返回当前目录下的默认路径。
 * @throws 不抛出异常。
 */
function resolveDefaultRuntimeFilePath(fileName: string): string {
  const currentDirectoryPath = join(process.cwd(), '.runtime', fileName);
  const parentDirectoryPath = join(process.cwd(), '..', '.runtime', fileName);
  if (existsSync(currentDirectoryPath)) {
    return currentDirectoryPath;
  }

  if (existsSync(parentDirectoryPath)) {
    return parentDirectoryPath;
  }

  return currentDirectoryPath;
}

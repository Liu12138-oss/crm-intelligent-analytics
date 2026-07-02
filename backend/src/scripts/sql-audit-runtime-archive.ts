import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { AppStorageState, SqlAuditRecord } from '../shared/types/domain';

export interface SqlAuditRuntimeArchiveOptions {
  keepRecentCount: number;
  archivedAt?: string;
  archiveBefore?: string;
}

export interface SqlAuditRuntimeArchiveResult {
  nextState: AppStorageState;
  archivedRecords: SqlAuditRecord[];
  keptRecords: SqlAuditRecord[];
  archivedAt: string;
}

/**
 * 归档运行态中的 SQL 审计记录，只允许修改 `sqlAuditRecords` 集合。
 *
 * @param state 当前完整运行态快照。
 * @param options 归档保留策略。
 * @returns 新运行态和被归档的 SQL 审计记录。
 * @throws 当保留数量非法时抛出错误，避免误删全部审计。
 */
export function archiveSqlAuditRuntimeState(
  state: AppStorageState,
  options: SqlAuditRuntimeArchiveOptions,
): SqlAuditRuntimeArchiveResult {
  const keepRecentCount = Math.max(Math.floor(options.keepRecentCount), 0);
  if (!Number.isFinite(keepRecentCount)) {
    throw new Error('SQL 审计保留条数必须是有效数字。');
  }

  const archivedAt = options.archivedAt ?? new Date().toISOString();
  const sortedRecords = [...state.sqlAuditRecords].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
  const keptByCount = sortedRecords.slice(0, keepRecentCount);
  const keptIds = new Set(keptByCount.map((item) => item.id));
  if (options.archiveBefore) {
    for (const record of sortedRecords) {
      if (record.createdAt >= options.archiveBefore) {
        keptIds.add(record.id);
      }
    }
  }

  const keptRecords = state.sqlAuditRecords.filter((item) => keptIds.has(item.id));
  const archivedRecords = state.sqlAuditRecords.filter((item) => !keptIds.has(item.id));
  return {
    nextState: {
      ...state,
      sqlAuditRecords: keptRecords,
    },
    archivedRecords,
    keptRecords,
    archivedAt,
  };
}

/**
 * 读取、备份、归档并原子替换运行态文件。
 *
 * @param params 运行态文件、归档目录和保留策略。
 * @returns 归档统计信息。
 * @throws 文件不存在、JSON 解析失败或写入失败时抛出错误。
 */
export function archiveSqlAuditRuntimeFile(params: {
  storageFilePath: string;
  archiveDirectory: string;
  keepRecentCount: number;
  archiveBefore?: string;
  archivedAt?: string;
}): {
  backupFilePath: string;
  archiveFilePath: string;
  archivedCount: number;
  keptCount: number;
} {
  if (!existsSync(params.storageFilePath)) {
    throw new Error(`运行态文件不存在：${params.storageFilePath}`);
  }

  const archivedAt = params.archivedAt ?? new Date().toISOString();
  const safeTimestamp = archivedAt.replace(/[:.]/gu, '-');
  mkdirSync(params.archiveDirectory, { recursive: true });
  const backupFilePath = join(params.archiveDirectory, `app-storage-${safeTimestamp}.bak.json`);
  const archiveFilePath = join(
    params.archiveDirectory,
    `sql-audit-records-${safeTimestamp}.json`,
  );

  const state = JSON.parse(
    readFileSync(params.storageFilePath, 'utf8'),
  ) as AppStorageState;
  writeFileSync(backupFilePath, JSON.stringify(state, null, 2), 'utf8');

  const result = archiveSqlAuditRuntimeState(state, {
    keepRecentCount: params.keepRecentCount,
    archiveBefore: params.archiveBefore,
    archivedAt,
  });
  writeFileSync(
    archiveFilePath,
    JSON.stringify(
      {
        archivedAt: result.archivedAt,
        archivedCount: result.archivedRecords.length,
        records: result.archivedRecords,
      },
      null,
      2,
    ),
    'utf8',
  );

  const tempFilePath = `${params.storageFilePath}.tmp`;
  mkdirSync(dirname(params.storageFilePath), { recursive: true });
  writeFileSync(tempFilePath, JSON.stringify(result.nextState, null, 2), 'utf8');
  renameSync(tempFilePath, params.storageFilePath);

  return {
    backupFilePath,
    archiveFilePath,
    archivedCount: result.archivedRecords.length,
    keptCount: result.keptRecords.length,
  };
}

if (require.main === module) {
  const storageFilePath =
    process.env.APP_STORAGE_FILE_PATH ??
    resolveDefaultRuntimeFilePath('app-storage.json');
  const archiveDirectory =
    process.env.SQL_AUDIT_ARCHIVE_DIR ??
    join(dirname(storageFilePath), 'sql-audit-archive');
  const keepRecentCount = Number(process.env.SQL_AUDIT_ARCHIVE_KEEP_RECENT ?? '5000');
  const result = archiveSqlAuditRuntimeFile({
    storageFilePath,
    archiveDirectory,
    keepRecentCount,
    archiveBefore: process.env.SQL_AUDIT_ARCHIVE_BEFORE,
  });
  console.log(
    JSON.stringify(
      {
        message: 'SQL 审计运行态归档完成。',
        archivedCount: result.archivedCount,
        keptCount: result.keptCount,
        backupFilePath: result.backupFilePath,
        archiveFilePath: result.archiveFilePath,
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

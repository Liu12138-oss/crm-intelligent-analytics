import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { SqlAuditFileStore } from '../modules/audit/sql-audit-file.store';
import type { AppStorageState } from '../shared/types/domain';

export interface ProductionPerformanceInspectionParams {
  storageFilePath: string;
  sqlAuditFilePath?: string;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
}

export interface ProductionPerformanceInspectionReport {
  inspectedAt: string;
  runtime: {
    storageFilePath: string;
    exists: boolean;
    sizeBytes: number;
    sqlAuditRecordCount: number;
    sqlAuditRuntimeMaxRecords: number;
  };
  independentSqlAudit: {
    filePath?: string;
    exists: boolean;
    sizeBytes: number;
    recordCount: number;
  };
  auditQueue: {
    asyncEnabled: boolean;
    maxRecords: number;
    flushIntervalMs: number;
  };
  eventLoop: {
    sampleAvailable: boolean;
    delayMs: number;
  };
  sensitiveConfig: Array<{
    name: string;
    present: boolean;
    value: '[REDACTED]' | '[NOT_SET]';
  }>;
}

const SENSITIVE_ENV_NAMES = [
  'CRM_READONLY_DB_PASSWORD',
  'CRM_WRITEBACK_DB_PASSWORD',
  'CRM_OPEN_API_SECRET',
  'WECOM_CORP_SECRET',
  'WECOM_BOT_TOKEN',
  'AI_API_KEY',
  'OPENAI_API_KEY',
];

/**
 * 构建只读生产性能巡检报告，不读取或输出敏感配置值。
 *
 * @param params 运行态文件、独立审计文件和环境变量来源。
 * @returns 文件体积、审计数量、队列配置和敏感配置占位信息。
 * @throws 运行态 JSON 损坏时抛出错误，提示运维先修复或恢复备份。
 */
export function buildProductionPerformanceInspectionReport(
  params: ProductionPerformanceInspectionParams,
): ProductionPerformanceInspectionReport {
  const env = params.env ?? process.env;
  const runtimeState = readRuntimeState(params.storageFilePath);
  const sqlAuditFilePath =
    params.sqlAuditFilePath ??
    env.SQL_AUDIT_FILE_STORE_PATH ??
    join(dirname(params.storageFilePath), 'sql-audit-records.jsonl');
  const independentRecords = new SqlAuditFileStore({
    enabled: true,
    filePath: sqlAuditFilePath,
  }).readAll();

  return {
    inspectedAt: new Date().toISOString(),
    runtime: {
      storageFilePath: params.storageFilePath,
      exists: existsSync(params.storageFilePath),
      sizeBytes: readFileSize(params.storageFilePath),
      sqlAuditRecordCount: runtimeState?.sqlAuditRecords.length ?? 0,
      sqlAuditRuntimeMaxRecords: Number(env.SQL_AUDIT_RUNTIME_MAX_RECORDS ?? '0'),
    },
    independentSqlAudit: {
      filePath: sqlAuditFilePath,
      exists: existsSync(sqlAuditFilePath),
      sizeBytes: readFileSize(sqlAuditFilePath),
      recordCount: independentRecords.length,
    },
    auditQueue: {
      asyncEnabled: env.SQL_AUDIT_ASYNC_ENABLED === 'true',
      maxRecords: Number(env.SQL_AUDIT_ASYNC_QUEUE_MAX_RECORDS ?? '5000'),
      flushIntervalMs: Number(env.SQL_AUDIT_ASYNC_FLUSH_INTERVAL_MS ?? '1000'),
    },
    eventLoop: {
      sampleAvailable: false,
      delayMs: 0,
    },
    sensitiveConfig: SENSITIVE_ENV_NAMES.map((name) => ({
      name,
      present: Boolean(env[name]),
      value: env[name] ? '[REDACTED]' : '[NOT_SET]',
    })),
  };
}

/**
 * 构建包含事件循环延迟采样的巡检报告。
 *
 * @param params 运行态文件、独立审计文件和环境变量来源。
 * @param sampleDurationMs 采样窗口，默认 100 毫秒。
 * @returns 带事件循环延迟毫秒值的巡检报告。
 * @throws 运行态 JSON 损坏时抛出错误。
 */
export async function buildProductionPerformanceInspectionReportWithEventLoopSample(
  params: ProductionPerformanceInspectionParams,
  sampleDurationMs = 100,
): Promise<ProductionPerformanceInspectionReport> {
  const histogram = monitorEventLoopDelay({ resolution: 10 });
  histogram.enable();
  await new Promise((resolve) => setTimeout(resolve, Math.max(sampleDurationMs, 10)));
  histogram.disable();

  const report = buildProductionPerformanceInspectionReport(params);
  const delayMs = Number.isFinite(histogram.mean)
    ? Math.round(histogram.mean / 1_000_000)
    : 0;
  return {
    ...report,
    eventLoop: {
      sampleAvailable: true,
      delayMs,
    },
  };
}

/**
 * 读取运行态文件；文件不存在时按空状态处理。
 *
 * @param storageFilePath 运行态文件路径。
 * @returns 运行态快照或 `undefined`。
 * @throws JSON 解析失败时抛出错误，避免隐藏运行态损坏风险。
 */
function readRuntimeState(storageFilePath: string): AppStorageState | undefined {
  if (!existsSync(storageFilePath)) {
    return undefined;
  }

  return JSON.parse(readFileSync(storageFilePath, 'utf8')) as AppStorageState;
}

/**
 * 安全读取文件大小，文件不存在时返回 0。
 *
 * @param filePath 文件路径。
 * @returns 文件大小字节数。
 * @throws 不抛出异常；读取失败按 0 处理。
 */
function readFileSize(filePath: string): number {
  try {
    return existsSync(filePath) ? statSync(filePath).size : 0;
  } catch {
    return 0;
  }
}

if (require.main === module) {
  void (async () => {
    const storageFilePath =
      process.env.APP_STORAGE_FILE_PATH ?? resolveDefaultRuntimeFilePath('app-storage.json');
    const report = await buildProductionPerformanceInspectionReportWithEventLoopSample({
      storageFilePath,
      sqlAuditFilePath: process.env.SQL_AUDIT_FILE_STORE_PATH,
    });
    console.log(JSON.stringify(report, null, 2));
  })();
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

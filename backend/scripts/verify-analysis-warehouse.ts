import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppStorageService } from '../src/database/app-storage/app-storage.service';
import { AnalysisWarehouseMysqlService } from '../src/database/analysis-warehouse/analysis-warehouse-mysql.service';
import { QueryRiskGuardService } from '../src/modules/analysis/query-risk-guard.service';
import { AuditEventRepository } from '../src/modules/audit/audit-event.repository';
import { SqlAuditContextService } from '../src/modules/audit/sql-audit-context.service';
import { SqlAuditFileStore } from '../src/modules/audit/sql-audit-file.store';
import { SqlAuditRepository } from '../src/modules/audit/sql-audit.repository';
import { SqlAuditService } from '../src/modules/audit/sql-audit.service';
import { AnalysisWarehouseQueryExecutorService } from '../src/modules/analysis-warehouse/analysis-warehouse-query-executor.service';
import { AnalysisWarehouseRepository } from '../src/modules/analysis-warehouse/analysis-warehouse.repository';
import { AnalysisWarehouseSqlGuardService } from '../src/modules/analysis-warehouse/analysis-warehouse-sql-guard.service';
import { AnalysisWarehouseSyncService } from '../src/modules/analysis-warehouse/analysis-warehouse-sync.service';
import { UserScopeService } from '../src/modules/auth/user-scope.service';
import { LianruanCrmOpenApiAdapterService } from '../src/modules/crm-standard-api/lianruan-crm-openapi.adapter.service';
import { LianruanCrmOpenApiClient } from '../src/modules/crm-standard-api/lianruan-crm-openapi.client';
import { AccessDecisionService } from '../src/modules/governance/access-decision.service';
import { AccessPolicyRepository } from '../src/modules/governance/access-policy.repository';
import { ApplicationSuperAdminPolicyRepository } from '../src/modules/governance/application-super-admin-policy.repository';
import { DataScopeGrantRepository } from '../src/modules/governance/data-scope-grant.repository';
import { LianruanCrmConnectionConfigService } from '../src/modules/governance/lianruan-crm-connection-config.service';
import { PermissionEnforcementService } from '../src/modules/governance/permission-enforcement.service';
import { RolePermissionRepository } from '../src/modules/governance/role-permission.repository';
import { WecomPilotPolicyRepository } from '../src/modules/governance/wecom-pilot-policy.repository';
import { LocalRuntimeConfigService } from '../src/shared/config/local-runtime-config.service';
import { AnalysisLoggerService } from '../src/shared/logging/analysis-logger.service';
import type {
  AnalysisWarehouseResource,
  CrmUser,
} from '../src/shared/types/domain';

interface VerifyOptions {
  resources: AnalysisWarehouseResource[];
  pageSize: number;
  maxPages: number;
  executeQueries: boolean;
}

const DEFAULT_RESOURCES: AnalysisWarehouseResource[] = [
  'dictionaries',
  'users',
  'partners',
  'registrations',
  'opportunities',
  'quotes',
  'orders',
  'permissions',
];

const CONTRACT_PENDING_RESOURCES: AnalysisWarehouseResource[] = [
  'rolePermissions',
  'customers',
];

@Module({
  providers: [
    LocalRuntimeConfigService,
    AnalysisLoggerService,
    AppStorageService,
    SqlAuditContextService,
    SqlAuditFileStore,
    SqlAuditRepository,
    SqlAuditService,
    AuditEventRepository,
    UserScopeService,
    AccessPolicyRepository,
    RolePermissionRepository,
    WecomPilotPolicyRepository,
    DataScopeGrantRepository,
    ApplicationSuperAdminPolicyRepository,
    AccessDecisionService,
    PermissionEnforcementService,
    LianruanCrmConnectionConfigService,
    LianruanCrmOpenApiClient,
    LianruanCrmOpenApiAdapterService,
    AnalysisWarehouseMysqlService,
    AnalysisWarehouseRepository,
    AnalysisWarehouseSyncService,
    QueryRiskGuardService,
    AnalysisWarehouseSqlGuardService,
    AnalysisWarehouseQueryExecutorService,
  ],
})
class AnalysisWarehouseVerifierModule {}

/**
 * 执行分析库 P0 落库验证。
 *
 * 参数说明：无，命令行参数由 `parseOptions` 读取。
 * 返回值说明：成功时进程退出码为 0，缺少分析库配置或落库失败时返回非 0。
 * 调用注意事项：该脚本复用 Nest 服务链路，不读取或输出任何 OpenAPI 密钥、Token 或数据库密码。
 */
async function main(): Promise<void> {
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';

  const options = parseOptions(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(AnalysisWarehouseVerifierModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const warehouseMysqlService = app.get(AnalysisWarehouseMysqlService);
    const warehouseSyncService = app.get(AnalysisWarehouseSyncService);
    const queryExecutorService = app.get(AnalysisWarehouseQueryExecutorService);
    const warehouseStatus = warehouseMysqlService.getStatus();

    printSection('分析库配置检查');
    printJsonWithoutSecrets(warehouseStatus);
    if (warehouseStatus.configured !== true) {
      console.error(
        '分析库未配置，无法执行 ODS/DWD/语义层真实落库测试。请先配置 ANALYSIS_WAREHOUSE_DB_HOST、PORT、NAME、USER、PASSWORD。',
      );
      process.exitCode = 2;
      return;
    }

    printSection('OpenAPI 同步并落库');
    const run = await warehouseSyncService.runSync(buildVerifierUser(), {
      sourceType: 'OPENAPI',
      mode: 'FULL',
      dryRun: false,
      pageSize: options.pageSize,
      maxPages: options.maxPages,
      resources: options.resources,
    });
    printJsonWithoutSecrets({
      id: run.id,
      status: run.status,
      durationMs: run.durationMs,
      resources: run.resourceResults.map((item) => ({
        resource: item.resource,
        status: item.status,
        fetchedCount: item.fetchedCount,
        storedCount: item.storedCount,
        total: item.total,
        failureReason: item.failureReason,
      })),
    });

    printSection('落库概览');
    const overview = await warehouseSyncService.getOverview(buildVerifierUser());
    printJsonWithoutSecrets(overview.mysqlWarehouse ?? overview);

    if (options.executeQueries) {
      printSection('受控 SQL 抽样验证');
      await runControlledQuery(queryExecutorService, '服务商数量验证', {
        sql: 'SELECT COUNT(DISTINCT partner_id) AS partner_count FROM dim_lianruan_partner',
      });
      await runControlledQuery(queryExecutorService, '商机数量和金额验证', {
        sql: 'SELECT COUNT(DISTINCT opportunity_id) AS opportunity_count, COALESCE(SUM(amount), 0) AS opportunity_amount FROM fact_lianruan_opportunity',
      });
      await runControlledQuery(queryExecutorService, '语义字段目录验证', {
        sql: 'SELECT table_name, COUNT(id) AS field_count FROM semantic_field_catalog GROUP BY table_name ORDER BY field_count DESC',
      });
    }

    if (run.status === 'FAILED') {
      process.exitCode = 1;
      return;
    }

    if (run.status === 'PARTIAL_FAILED') {
      console.warn('同步存在部分失败资源，请结合上方资源结果和联软 404 接口确认项继续处理。');
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

/**
 * 解析命令行参数。
 *
 * 参数说明：`args` 为 `process.argv` 去掉 node 与脚本路径后的参数。
 * 返回值说明：返回本次验证使用的资源、分页和查询执行配置。
 * 调用注意事项：默认跳过联软当前未通过的客户视图和角色权限矩阵，避免影响可用资源落库验证。
 */
function parseOptions(args: string[]): VerifyOptions {
  const resourceArg = readArgValue(args, '--resources');
  const includeContractPending = args.includes('--include-contract-pending');
  const skipQueries = args.includes('--skip-queries');
  const resources = resourceArg
    ? normalizeResources(resourceArg.split(','))
    : includeContractPending
      ? [...DEFAULT_RESOURCES, ...CONTRACT_PENDING_RESOURCES]
      : DEFAULT_RESOURCES;

  return {
    resources,
    pageSize: normalizeInteger(readArgValue(args, '--page-size'), 50, 1, 200),
    maxPages: normalizeInteger(readArgValue(args, '--max-pages'), 2, 1, 100),
    executeQueries: !skipQueries,
  };
}

/**
 * 读取 `--key=value` 或 `--key value` 形式的命令行参数。
 *
 * 参数说明：
 * - `args`：命令行参数数组。
 * - `key`：参数名。
 * 返回值说明：命中时返回字符串值，否则返回 `undefined`。
 * 调用注意事项：仅用于非敏感参数，敏感配置仍从环境变量读取。
 */
function readArgValue(args: string[], key: string): string | undefined {
  const withEquals = args.find((item) => item.startsWith(`${key}=`));
  if (withEquals) {
    return withEquals.slice(key.length + 1);
  }

  const index = args.indexOf(key);
  if (index >= 0) {
    return args[index + 1];
  }

  return undefined;
}

/**
 * 标准化资源参数。
 *
 * 参数说明：`values` 为逗号拆分后的资源名。
 * 返回值说明：返回合法的分析库资源名数组。
 * 调用注意事项：非法资源直接阻断，避免误把任意表名带入同步链路。
 */
function normalizeResources(values: string[]): AnalysisWarehouseResource[] {
  const allowed = new Set<AnalysisWarehouseResource>([
    ...DEFAULT_RESOURCES,
    ...CONTRACT_PENDING_RESOURCES,
  ]);
  const resources = values
    .map((item) => item.trim())
    .filter(Boolean) as AnalysisWarehouseResource[];
  const invalidResources = resources.filter((item) => !allowed.has(item));
  if (invalidResources.length > 0) {
    throw new Error(`不支持的分析库同步资源：${invalidResources.join(', ')}`);
  }
  return Array.from(new Set(resources));
}

/**
 * 标准化整数参数。
 *
 * 参数说明：`value` 为命令行原始值，`fallback/min/max` 为默认值和边界。
 * 返回值说明：返回落在边界内的整数。
 * 调用注意事项：分页参数会影响联软接口压力，默认保持小批量验证。
 */
function normalizeInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

/**
 * 构造本地验证操作者。
 *
 * 参数说明：无。
 * 返回值说明：返回拥有治理同步和 SQL 联调权限的虚拟 CRM 用户。
 * 调用注意事项：该用户只存在于脚本进程内，不写入登录会话，不替代真实用户权限链路。
 */
function buildVerifierUser(): CrmUser {
  return {
    id: 'local-analysis-warehouse-verifier',
    name: '本地分析库验证脚本',
    roleIds: ['local-admin'],
    roleNames: ['本地治理验证员'],
    organizationIds: [],
    departmentIds: [],
    ownerIds: [],
    isAdmin: true,
    exportAllowed: false,
    channels: ['web-console'],
    identitySource: 'mock',
  };
}

/**
 * 执行一条受控 SQL 抽样查询。
 *
 * 参数说明：
 * - `queryExecutorService`：分析库受控 SQL 执行服务。
 * - `label`：验证项中文名称。
 * - `request`：待执行的受控 SELECT。
 * 返回值说明：无返回值，结果打印到终端。
 * 调用注意事项：查询仍经过 SQL Guard，禁止访问 ODS 原始 JSON 和未授权表字段。
 */
async function runControlledQuery(
  queryExecutorService: AnalysisWarehouseQueryExecutorService,
  label: string,
  request: { sql: string; params?: unknown[] },
): Promise<void> {
  const result = await queryExecutorService.execute(buildVerifierUser(), {
    ...request,
    dryRun: false,
    timeoutMs: 5000,
  });
  printJsonWithoutSecrets({
    label,
    status: result.status,
    rowCount: result.rowCount,
    rows: result.rows,
  });
}

/**
 * 输出终端分节标题。
 *
 * 参数说明：`title` 为中文标题。
 * 返回值说明：无返回值。
 * 调用注意事项：只用于提升本地验证输出可读性。
 */
function printSection(title: string): void {
  console.log(`\n## ${title}`);
}

/**
 * 打印已脱敏 JSON。
 *
 * 参数说明：`value` 为待打印对象。
 * 返回值说明：无返回值。
 * 调用注意事项：字段名包含密钥、密码或 Token 时统一隐藏，避免终端日志泄露敏感信息。
 */
function printJsonWithoutSecrets(value: unknown): void {
  console.log(JSON.stringify(maskSecrets(value), null, 2));
}

/**
 * 递归隐藏敏感字段。
 *
 * 参数说明：`value` 为任意待输出值。
 * 返回值说明：返回脱敏后的结构。
 * 调用注意事项：仅用于日志输出，不改变真实运行对象。
 */
function maskSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => maskSecrets(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        /(password|secret|token|appKey|authorization)/iu.test(key)
          ? '[已隐藏]'
          : maskSecrets(item),
      ]),
    );
  }

  return value;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

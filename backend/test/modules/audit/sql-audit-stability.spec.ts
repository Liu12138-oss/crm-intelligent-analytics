import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDefaultAppStorageState } from '../../../src/shared/mock/sample-data';
import { SqlAuditContextService } from '../../../src/modules/audit/sql-audit-context.service';
import { SqlAuditFileStore } from '../../../src/modules/audit/sql-audit-file.store';
import { SqlAuditRepository } from '../../../src/modules/audit/sql-audit.repository';
import { SqlAuditService } from '../../../src/modules/audit/sql-audit.service';
import { archiveSqlAuditRuntimeState } from '../../../src/scripts/sql-audit-runtime-archive';
import {
  migrateRuntimeSqlAuditRecords,
  reconcileSqlAuditStores,
} from '../../../src/scripts/migrate-sql-audit-records';
import {
  buildProductionPerformanceInspectionReport,
  buildProductionPerformanceInspectionReportWithEventLoopSample,
} from '../../../src/scripts/inspect-production-performance';
import type { AppStorageState, SqlAuditRecord } from '../../../src/shared/types/domain';

function buildSqlAuditRecord(
  id: string,
  overrides: Partial<SqlAuditRecord> = {},
): SqlAuditRecord {
  return {
    id,
    createdAt: `2026-05-22T00:00:0${id.slice(-1)}.000Z`,
    stage: 'EXECUTED',
    status: 'SUCCEEDED',
    riskLevel: 'LOW',
    actorId: 'user_sales_director',
    actorRoleIds: ['role_sales_director'],
    moduleKey: 'analysis-workbench',
    programName: 'AnalysisWorkflowOrchestrator.run',
    databaseRole: 'CRM_READONLY',
    operationType: 'SELECT',
    tables: ['opportunities'],
    sqlText: 'SELECT 1',
    sqlSummary: 'SELECT 1',
    paramsJson: '[]',
    paramSummary: '无参数',
    normalizedSql: 'SELECT 1',
    sqlFingerprint: `fingerprint_${id}`,
    ...overrides,
  };
}

function createAppStorageStub(state: AppStorageState = createDefaultAppStorageState()) {
  return {
    state,
    persist: jest.fn(),
  };
}

describe('SQL 审计性能稳定治理', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.useRealTimers();
  });

  it('运行态 SQL 审计超过上限时只保留最新记录', () => {
    process.env.SQL_AUDIT_RUNTIME_MAX_RECORDS = '2';
    const appStorage = createAppStorageStub();
    const repository = new SqlAuditRepository(appStorage as never);

    repository.create(buildSqlAuditRecord('sql_audit_001'));
    repository.create(buildSqlAuditRecord('sql_audit_002'));
    repository.create(buildSqlAuditRecord('sql_audit_003'));

    expect(repository.list().map((item) => item.id)).toEqual([
      'sql_audit_003',
      'sql_audit_002',
    ]);
    expect(appStorage.persist).toHaveBeenCalledTimes(3);
  });

  it('归档运行态 SQL 审计时不得修改其它运行态集合', () => {
    const sourceState = createDefaultAppStorageState();
    sourceState.authSessions.push({
      id: 'auth_session_keep',
      requesterId: 'user_admin',
      source: 'password-login',
      sessionStatus: 'ACTIVE',
      userSnapshot: {
        id: 'user_admin',
        name: '管理员',
        roleIds: ['role_admin'],
        roleNames: ['系统管理员'],
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        isAdmin: true,
        exportAllowed: true,
        channels: ['web-console'],
      },
      lastAccessAt: '2026-05-22T00:00:00.000Z',
      expiresAt: '2026-05-22T12:00:00.000Z',
      createdAt: '2026-05-22T00:00:00.000Z',
      updatedAt: '2026-05-22T00:00:00.000Z',
    });
    sourceState.sqlAuditRecords = [
      buildSqlAuditRecord('sql_audit_old_1', {
        createdAt: '2026-05-20T00:00:00.000Z',
      }),
      buildSqlAuditRecord('sql_audit_old_2', {
        createdAt: '2026-05-21T00:00:00.000Z',
      }),
      buildSqlAuditRecord('sql_audit_keep_3', {
        createdAt: '2026-05-22T00:00:00.000Z',
      }),
    ];

    const result = archiveSqlAuditRuntimeState(sourceState, {
      keepRecentCount: 1,
      archivedAt: '2026-05-22T01:00:00.000Z',
    });

    expect(result.nextState.sqlAuditRecords.map((item) => item.id)).toEqual([
      'sql_audit_keep_3',
    ]);
    expect(result.archivedRecords.map((item) => item.id)).toEqual([
      'sql_audit_old_1',
      'sql_audit_old_2',
    ]);
    expect(result.nextState.authSessions).toEqual(sourceState.authSessions);
    expect(result.nextState.queryTemplates).toEqual(sourceState.queryTemplates);
  });

  it('普通只读 SQL 审计启用异步后不阻塞主链路，高风险审计仍同步写入', async () => {
    process.env.SQL_AUDIT_ASYNC_ENABLED = 'true';
    process.env.SQL_AUDIT_ASYNC_FLUSH_INTERVAL_MS = '60000';
    const appStorage = createAppStorageStub();
    const repository = new SqlAuditRepository(appStorage as never);
    const service = new SqlAuditService(
      repository,
      new SqlAuditContextService(),
      {
        logStep: jest.fn(),
        logWarn: jest.fn(),
      } as never,
    );

    await service.execute({
      sql: 'SELECT 1',
      databaseRole: 'CRM_READONLY',
      execute: async () => [[{ ok: 1 }], []],
    });

    expect(repository.list()).toEqual([]);

    await service.flushAsyncQueueForTest();
    expect(repository.list()).toHaveLength(1);

    await service.execute({
      sql: 'UPDATE wx_users SET name = ? WHERE id = ?',
      params: ['张三', 1],
      databaseRole: 'CRM_WRITEBACK',
      execute: async () => [{ affectedRows: 1 }],
    });

    expect(repository.list()[0]).toEqual(
      expect.objectContaining({
        databaseRole: 'CRM_WRITEBACK',
        operationType: 'UPDATE',
      }),
    );
  });

  it('独立 SQL 审计文件存储应支持写入、列表、详情和分页', () => {
    const runtimeDir = mkdtempSync(join(tmpdir(), 'crm-sql-audit-store-'));

    try {
      const store = new SqlAuditFileStore({
        enabled: true,
        filePath: join(runtimeDir, 'sql-audit-records.jsonl'),
      });
      store.create(buildSqlAuditRecord('sql_audit_001'));
      store.create(buildSqlAuditRecord('sql_audit_002', { actorId: 'user_admin' }));

      expect(existsSync(join(runtimeDir, 'sql-audit-records.jsonl'))).toBe(true);
      expect(store.list({ actorId: 'user_admin' }).items).toEqual([
        expect.objectContaining({ id: 'sql_audit_002' }),
      ]);
      expect(store.findById('sql_audit_001')).toEqual(
        expect.objectContaining({ id: 'sql_audit_001' }),
      );
      expect(store.list({ page: 1, pageSize: 1 }).total).toBe(2);
      expect(readFileSync(join(runtimeDir, 'sql-audit-records.jsonl'), 'utf8')).not.toContain(
        'CRM_READONLY_DB_PASSWORD',
      );
    } finally {
      rmSync(runtimeDir, { recursive: true, force: true });
    }
  });

  it('仓储启用独立存储时应双写运行态与独立文件', () => {
    const runtimeDir = mkdtempSync(join(tmpdir(), 'crm-sql-audit-dual-write-'));

    try {
      const appStorage = createAppStorageStub();
      const fileStore = new SqlAuditFileStore({
        enabled: true,
        filePath: join(runtimeDir, 'sql-audit-records.jsonl'),
      });
      const repository = new SqlAuditRepository(appStorage as never, fileStore);

      repository.create(buildSqlAuditRecord('sql_audit_dual_write'));

      expect(appStorage.state.sqlAuditRecords.map((item) => item.id)).toEqual([
        'sql_audit_dual_write',
      ]);
      expect(fileStore.findById('sql_audit_dual_write')).toEqual(
        expect.objectContaining({ id: 'sql_audit_dual_write' }),
      );
    } finally {
      rmSync(runtimeDir, { recursive: true, force: true });
    }
  });

  it('迁移脚本应从运行态批量写入独立存储并支持断点续跑', () => {
    const runtimeDir = mkdtempSync(join(tmpdir(), 'crm-sql-audit-migrate-'));
    const storageFilePath = join(runtimeDir, 'app-storage.json');
    const targetFilePath = join(runtimeDir, 'sql-audit-records.jsonl');
    const checkpointFilePath = join(runtimeDir, 'checkpoint.json');
    const state = createDefaultAppStorageState();
    state.sqlAuditRecords = [
      buildSqlAuditRecord('sql_audit_migrate_001'),
      buildSqlAuditRecord('sql_audit_migrate_002'),
    ];

    try {
      writeFileSync(storageFilePath, JSON.stringify(state, null, 2), 'utf8');

      const firstResult = migrateRuntimeSqlAuditRecords({
        storageFilePath,
        targetFilePath,
        checkpointFilePath,
        batchSize: 1,
      });
      const secondResult = migrateRuntimeSqlAuditRecords({
        storageFilePath,
        targetFilePath,
        checkpointFilePath,
        batchSize: 1,
      });

      expect(firstResult.migratedCount).toBe(2);
      expect(secondResult.migratedCount).toBe(0);
      expect(new SqlAuditFileStore({ enabled: true, filePath: targetFilePath }).list().total).toBe(
        2,
      );
      expect(readFileSync(checkpointFilePath, 'utf8')).toContain(
        'sql_audit_migrate_002',
      );
    } finally {
      rmSync(runtimeDir, { recursive: true, force: true });
    }
  });

  it('双写对账应输出数量、失败数量和关键字段差异', () => {
    const runtimeDir = mkdtempSync(join(tmpdir(), 'crm-sql-audit-reconcile-'));
    const targetFilePath = join(runtimeDir, 'sql-audit-records.jsonl');
    const runtimeRecord = buildSqlAuditRecord('sql_audit_reconcile_001', {
      sqlFingerprint: 'fingerprint_runtime',
    });
    const fileStore = new SqlAuditFileStore({
      enabled: true,
      filePath: targetFilePath,
    });

    try {
      fileStore.create(
        buildSqlAuditRecord('sql_audit_reconcile_001', {
          sqlFingerprint: 'fingerprint_independent',
        }),
      );
      fileStore.create(buildSqlAuditRecord('sql_audit_reconcile_extra'));

      const result = reconcileSqlAuditStores({
        runtimeRecords: [runtimeRecord, buildSqlAuditRecord('sql_audit_reconcile_missing')],
        targetFilePath,
      });

      expect(result).toEqual(
        expect.objectContaining({
          runtimeCount: 2,
          independentCount: 2,
          missingInIndependentCount: 1,
          extraInIndependentCount: 1,
          fieldMismatchCount: 1,
        }),
      );
      expect(result.fieldMismatches).toEqual([
        expect.objectContaining({
          id: 'sql_audit_reconcile_001',
          field: 'sqlFingerprint',
          runtimeValue: 'fingerprint_runtime',
          independentValue: 'fingerprint_independent',
        }),
      ]);
    } finally {
      rmSync(runtimeDir, { recursive: true, force: true });
    }
  });

  it('生产性能巡检报告应只输出只读性能指标且不得泄露敏感配置值', () => {
    const runtimeDir = mkdtempSync(join(tmpdir(), 'crm-performance-inspect-'));
    const storageFilePath = join(runtimeDir, 'app-storage.json');
    const sqlAuditFilePath = join(runtimeDir, 'sql-audit-records.jsonl');
    const state = createDefaultAppStorageState();
    state.sqlAuditRecords = [buildSqlAuditRecord('sql_audit_inspect_001')];

    try {
      writeFileSync(storageFilePath, JSON.stringify(state, null, 2), 'utf8');
      new SqlAuditFileStore({ enabled: true, filePath: sqlAuditFilePath }).create(
        buildSqlAuditRecord('sql_audit_inspect_002'),
      );

      const report = buildProductionPerformanceInspectionReport({
        storageFilePath,
        sqlAuditFilePath,
        env: {
          CRM_READONLY_DB_PASSWORD: 'should-not-leak',
          WECOM_BOT_TOKEN: 'token-should-not-leak',
          SQL_AUDIT_ASYNC_QUEUE_MAX_RECORDS: '100',
          SQL_AUDIT_RUNTIME_MAX_RECORDS: '5000',
        },
      });
      const serialized = JSON.stringify(report);

      expect(report.runtime.sqlAuditRecordCount).toBe(1);
      expect(report.independentSqlAudit.recordCount).toBe(1);
      expect(report.auditQueue.maxRecords).toBe(100);
      expect(serialized).not.toContain('should-not-leak');
      expect(serialized).not.toContain('token-should-not-leak');
      expect(serialized).toContain('CRM_READONLY_DB_PASSWORD');
      expect(serialized).toContain('WECOM_BOT_TOKEN');
    } finally {
      rmSync(runtimeDir, { recursive: true, force: true });
    }
  });

  it('生产性能巡检应支持事件循环延迟采样', async () => {
    const runtimeDir = mkdtempSync(join(tmpdir(), 'crm-performance-event-loop-'));
    const storageFilePath = join(runtimeDir, 'app-storage.json');

    try {
      writeFileSync(
        storageFilePath,
        JSON.stringify(createDefaultAppStorageState(), null, 2),
        'utf8',
      );

      const report = await buildProductionPerformanceInspectionReportWithEventLoopSample(
        {
          storageFilePath,
          sqlAuditFilePath: join(runtimeDir, 'sql-audit-records.jsonl'),
          env: {},
        },
        10,
      );

      expect(report.eventLoop.sampleAvailable).toBe(true);
      expect(report.eventLoop.delayMs).toBeGreaterThanOrEqual(0);
    } finally {
      rmSync(runtimeDir, { recursive: true, force: true });
    }
  });
});

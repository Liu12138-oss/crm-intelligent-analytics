import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CrmSqliteReadonlyService } from '../../../src/modules/analysis/crm-sqlite-readonly.service';
import { CrmSqliteReadonlySqlGuardService } from '../../../src/modules/analysis/crm-sqlite-readonly-sql-guard.service';

interface TestSqliteDatabase {
  exec: (sql: string) => void;
  close: () => void;
}

interface TestSqliteRuntime {
  DatabaseSync: new (filename: string) => TestSqliteDatabase;
}

const runtimeRequire = createRequire(__filename);

describe('CrmSqliteReadonlyService', () => {
  let tempDir: string;

  /**
   * 为每个用例创建独立 mirror 目录，避免不同测试之间共享 SQLite 文件状态。
   */
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'crm-sqlite-readonly-'));
    createMirrorDatabase(join(tempDir, 'analysis_mirror_latest.db'));
  });

  /**
   * 清理临时库文件，避免测试运行后残留本地数据库。
   */
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('配置为 analysis-mirror 目录时应自动读取 latest 库中的 fact 明细', async () => {
    const service = createService(tempDir);

    const rows = await service.readResource('opportunities');

    expect(rows).toEqual([
      expect.objectContaining({
        opportunity_id: 'opp_001',
        opportunity_name: '真实商机A',
        customer_name: '真实客户A',
        partner_name: '真实渠道商A',
        __resource: 'opportunities',
      }),
    ]);
  });

  it('受控 SELECT 应允许读取 mirror 业务总览视图', async () => {
    const service = createService(tempDir);

    const rows = await service.executeSelect('SELECT * FROM v_business_overview');

    expect(rows).toEqual([
      expect.objectContaining({
        metric: 'opportunities',
        count_value: 1,
        amount_value: 120000,
      }),
    ]);
  });
});

/**
 * 构造服务实例，所有数据库读取都会经过审计执行器包装。
 */
function createService(dbPath: string): CrmSqliteReadonlyService {
  const localRuntimeConfigService = {
    getCrmSqliteReadonlyAnalysisConfig: jest.fn(() => ({
      enabled: true,
      dbPath,
      defaultRoute: 'SQLITE_READONLY',
      queryTimeoutMs: 1000,
      maxRows: 50,
      maxBytes: 1024 * 1024,
    })),
  };
  const sqlGuard = new CrmSqliteReadonlySqlGuardService({
    ensureQuerySafe: jest.fn(),
  } as never);
  const sqlAuditService = {
    execute: jest.fn(async (params: { execute: () => Promise<unknown> }) =>
      params.execute(),
    ),
  };

  return new CrmSqliteReadonlyService(
    localRuntimeConfigService as never,
    sqlGuard,
    sqlAuditService as never,
  );
}

/**
 * 创建最小可用的 analysis-mirror 测试库。
 */
function createMirrorDatabase(filePath: string): void {
  const sqliteRuntime = runtimeRequire('node:sqlite') as TestSqliteRuntime;
  const db = new sqliteRuntime.DatabaseSync(filePath);
  try {
    db.exec(`
      CREATE TABLE fact_opportunities (
        opportunity_id TEXT PRIMARY KEY,
        opportunity_name TEXT,
        customer_name TEXT,
        partner_id TEXT,
        partner_name TEXT,
        owner_id TEXT,
        amount REAL,
        created_at TEXT
      );
      INSERT INTO fact_opportunities (
        opportunity_id,
        opportunity_name,
        customer_name,
        partner_id,
        partner_name,
        owner_id,
        amount,
        created_at
      ) VALUES (
        'opp_001',
        '真实商机A',
        '真实客户A',
        'partner_001',
        '真实渠道商A',
        'A030',
        120000,
        '2026-06-01'
      );
      CREATE VIEW v_business_overview AS
      SELECT 'opportunities' AS metric, 1 AS count_value, 120000 AS amount_value;
    `);
  } finally {
    db.close();
  }
}

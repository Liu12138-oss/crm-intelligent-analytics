import mysql from 'mysql2/promise';
import { createDefaultAppStorageState } from '../../../src/shared/mock/sample-data';
import { SqlAuditContextService } from '../../../src/modules/audit/sql-audit-context.service';
import { SqlAuditRepository } from '../../../src/modules/audit/sql-audit.repository';
import { SqlAuditService } from '../../../src/modules/audit/sql-audit.service';
import { CrmReadonlyService } from '../../../src/database/crm-readonly/crm-readonly.service';
import { CrmPhoneConfirmationRepairService } from '../../../src/modules/auth/crm-phone-confirmation-repair.service';

jest.mock('mysql2/promise', () => ({
  __esModule: true,
  default: {
    createPool: jest.fn(),
  },
}));

describe('SQL 审计采集底座', () => {
  const createPoolMock = mysql.createPool as jest.Mock;

  function createSqlAuditFixture() {
    const appStorage = {
      state: createDefaultAppStorageState(),
      persist: jest.fn(),
    };
    const sqlAuditRepository = new SqlAuditRepository(appStorage as never);
    const sqlAuditContextService = new SqlAuditContextService();
    const sqlAuditService = new SqlAuditService(
      sqlAuditRepository,
      sqlAuditContextService,
    );

    return {
      appStorage,
      sqlAuditRepository,
      sqlAuditContextService,
      sqlAuditService,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应为分析直查 SQL 与预检 SQL 记录关联审计上下文', async () => {
    const {
      sqlAuditRepository,
      sqlAuditContextService,
      sqlAuditService,
    } = createSqlAuditFixture();
    const queryMock = jest
      .fn()
      .mockResolvedValueOnce([[{ id: 1, name: '张三' }], []])
      .mockResolvedValueOnce([[{ id: 1, select_type: 'SIMPLE' }], []]);
    const service = new CrmReadonlyService(
      {} as never,
      {
        logWarn: jest.fn(),
        logStep: jest.fn(),
      } as never,
      {
        state: createDefaultAppStorageState(),
      } as never,
      sqlAuditService,
    );

    service['rawPool'] = {
      query: queryMock,
    } as never;
    service['pool'] = {
      query: queryMock,
    } as never;
    service['ensurePool'] = jest.fn().mockResolvedValue(true);

    await sqlAuditContextService.run(
      {
        actorId: 'user_sales_director',
        actorRoleIds: ['role_sales_director'],
        channel: 'web-console',
        requestId: 'query_001',
        sessionId: 'session_001',
        moduleKey: 'analysis-workbench',
        programName: 'AnalysisWorkflowOrchestrator.run',
        executionMode: 'GUARDED_DIRECT_QUERY',
        executionSource: 'GUARDED_READONLY_SQL',
        matchedAdapter: 'opportunity-owner-ranking',
      },
      async () => {
        await service.executeQuery(
          'SELECT id, name FROM users WHERE id = ?',
          ['1'],
          { timeoutMs: 3000 },
        );
        await service.preflightQuery(
          'SELECT id, name FROM users WHERE id = ?',
          ['1'],
          { timeoutMs: 3000 },
        );
      },
    );

    expect(sqlAuditRepository.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requestId: 'query_001',
          sessionId: 'session_001',
          actorId: 'user_sales_director',
          moduleKey: 'analysis-workbench',
          databaseRole: 'CRM_READONLY',
          operationType: 'SELECT',
          stage: 'EXECUTED',
          executionMode: 'GUARDED_DIRECT_QUERY',
          executionSource: 'GUARDED_READONLY_SQL',
          matchedAdapter: 'opportunity-owner-ranking',
        }),
        expect.objectContaining({
          requestId: 'query_001',
          moduleKey: 'analysis-workbench',
          databaseRole: 'CRM_READONLY',
          operationType: 'EXPLAIN',
          stage: 'PREFLIGHT',
        }),
      ]),
    );
  });

  it('应为登录兜底修复的 users 读写记录写库 SQL 审计', async () => {
    const {
      sqlAuditRepository,
      sqlAuditContextService,
      sqlAuditService,
    } = createSqlAuditFixture();
    const queryMock = jest
      .fn()
      .mockResolvedValueOnce([[{ id: 1, confirmed_phone_at: null }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    createPoolMock.mockReturnValue({
      query: queryMock,
    });

    const service = new CrmPhoneConfirmationRepairService(
      {
        getCrmWritebackDbConfig: () => ({
          enabled: true,
          host: '127.0.0.1',
          port: 3306,
          database: 'crm',
          user: 'root',
          password: 'password',
        }),
      } as never,
      {
        logStep: jest.fn(),
        logWarn: jest.fn(),
      } as never,
      sqlAuditService,
      sqlAuditContextService,
    );

    await expect(service.repairIfMissing('18503081052')).resolves.toBe(true);

    expect(sqlAuditRepository.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          moduleKey: 'auth-phone-repair',
          databaseRole: 'CRM_WRITEBACK',
          operationType: 'SELECT',
          actorId: 'system:auth-phone-repair',
        }),
        expect.objectContaining({
          moduleKey: 'auth-phone-repair',
          databaseRole: 'CRM_WRITEBACK',
          operationType: 'UPDATE',
          actorId: 'system:auth-phone-repair',
        }),
      ]),
    );
  });

  it('被标记为展示辅助查询的 SQL 不应写入 SQL 审计', async () => {
    const { sqlAuditRepository, sqlAuditService } = createSqlAuditFixture();

    await expect(
      sqlAuditService.execute({
        sql: 'SELECT id, name FROM users WHERE id IN (?)',
        params: [['user_sales_director']],
        databaseRole: 'CRM_READONLY',
        suppressAudit: true,
        execute: async () => [[{ id: 'user_sales_director', name: '销售总监' }], []],
      }),
    ).resolves.toEqual([[{ id: 'user_sales_director', name: '销售总监' }], []]);

    expect(sqlAuditRepository.list()).toEqual([]);
  });
});

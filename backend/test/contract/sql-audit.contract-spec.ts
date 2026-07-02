import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loginAs } from '../auth-test.helper';
import { createTestApp } from '../test-app';
import { SqlAuditRepository } from '../../src/modules/audit/sql-audit.repository';
import { AnalysisRequestRepository } from '../../src/modules/analysis/analysis-request.repository';
import { RolePermissionRepository } from '../../src/modules/governance/role-permission.repository';
import { CrmReadonlyService } from '../../src/database/crm-readonly/crm-readonly.service';
import { AppStorageService } from '../../src/database/app-storage/app-storage.service';
import type { SqlAuditRecord } from '../../src/shared/types/domain';

function buildSqlAuditRecord(
  overrides: Partial<SqlAuditRecord> = {},
): SqlAuditRecord {
  return {
    id: 'sql_audit_001',
    createdAt: '2026-05-08T10:00:00.000Z',
    stage: 'EXECUTED',
    status: 'SUCCEEDED',
    riskLevel: 'HIGH',
    actorId: 'system_sync',
    actorRoleIds: [],
    moduleKey: 'wecom-directory-sync',
    programName: 'WecomDirectorySyncService.runSync',
    databaseRole: 'CRM_WRITEBACK',
    operationType: 'UPDATE',
    tables: ['wx_users'],
    sqlText: 'UPDATE wx_users SET name = ? WHERE id = ?',
    sqlSummary: 'UPDATE wx_users SET name = ? WHERE id = ?',
    paramsJson: '["张三",1001]',
    paramSummary: '参数1:string(2)，参数2:number',
    normalizedSql: 'UPDATE wx_users SET name = ? WHERE id = ?',
    sqlFingerprint: 'fingerprint_001',
    affectedRows: 1,
    durationMs: 35,
    ...overrides,
  };
}

describe('sql audit contract', () => {
  let app: INestApplication;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
    process.env = { ...originalEnv };
  });

  it('管理员应可获取 SQL 审计摘要、列表、详情与 reveal', async () => {
    const sqlAuditRepository = app.get(SqlAuditRepository);
    const analysisRequestRepository = app.get(AnalysisRequestRepository);
    const crmReadonlyService = app.get(CrmReadonlyService);
    const fullUserLookupSpy = jest.spyOn(crmReadonlyService, 'getUserById');
    analysisRequestRepository.saveRequest({
      id: 'query_test_001',
      questionText: '请分析今年二月份商机情况',
      requesterId: 'user_sales_director',
      requesterRoleIds: ['role_sales_director'],
      sessionId: 'session_001',
      entryChannel: 'web-console',
      querySource: 'FREE_TEXT',
      organizationScope: ['org_north'],
      departmentScope: ['dept_sales'],
      ownerScope: [],
      intentDomain: 'opportunity-analysis',
      metrics: ['商机数量'],
      dimensions: ['月份'],
      filters: {
        timeRange: '2026年2月',
      },
      missingConditions: [],
      status: 'RETURNED',
      executionSnapshot: {
        executionMode: 'PLAN_EXECUTION',
        executionSource: 'GUARDED_READONLY_SQL',
        preferredSource: 'CRM_OFFICIAL_API',
        scopeSnapshot: {
          organizationIds: ['org_north'],
          departmentIds: ['dept_sales'],
          ownerIds: [],
          scopeSummary: '销售部',
        },
        taskSnapshots: [
          {
            taskId: 'task_001',
            taskTitle: '商机数量趋势分析',
            executionSource: 'GUARDED_READONLY_SQL',
            rowLimit: 100,
            timeoutMs: 3000,
            tables: ['opportunities'],
          },
        ],
        createdAt: '2026-05-08T10:00:00.000Z',
      },
      createdAt: '2026-05-08T10:00:00.000Z',
      completedAt: '2026-05-08T10:00:02.000Z',
    });
    sqlAuditRepository.create(
      buildSqlAuditRecord(),
    );
    sqlAuditRepository.create(
      buildSqlAuditRecord({
        id: 'sql_audit_002',
        stage: 'BLOCKED',
        status: 'BLOCKED',
        riskLevel: 'MEDIUM',
        actorId: 'user_sales_director',
        actorRoleIds: ['role_sales_director'],
        moduleKey: 'analysis-workbench',
        programName: 'AnalysisWorkflowOrchestrator.blockedTask',
        requestId: 'query_test_001',
        sessionId: 'session_001',
        databaseRole: 'CRM_READONLY',
        operationType: 'SELECT',
        tables: ['users'],
        sqlText: 'SELECT * FROM users WHERE deleted_at IS NULL',
        sqlSummary: 'SELECT * FROM users WHERE deleted_at IS NULL',
        paramsJson: '[]',
        paramSummary: '无参数',
        normalizedSql: 'SELECT * FROM users WHERE deleted_at IS NULL',
        sqlFingerprint: 'fingerprint_002',
        blockedReason: '执行前预检失败，当前查询缺少必要的权限或时间范围限制。',
      }),
    );

    const cookies = await loginAs(app, 'user_admin');
    const summary = await request(app.getHttpServer())
      .get('/api/v1/audit-events/sql/summary')
      .set('Cookie', cookies)
      .expect(200);

    expect(summary.body).toEqual(
      expect.objectContaining({
        totalCount: 2,
        writeCount: 1,
        blockedCount: 1,
        highRiskCount: 1,
        canRevealSensitive: true,
      }),
    );

    const list = await request(app.getHttpServer())
      .get('/api/v1/audit-events/sql')
      .query({
        pageSize: 20,
      })
      .set('Cookie', cookies)
      .expect(200);

    expect(list.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          auditId: 'sql_audit_001',
          actorName: '企业微信目录同步任务',
          moduleKey: 'wecom-directory-sync',
          databaseRole: 'CRM_WRITEBACK',
        }),
        expect.objectContaining({
          auditId: 'sql_audit_002',
          actorName: '销售总监',
          moduleKey: 'analysis-workbench',
          status: 'BLOCKED',
        }),
      ]),
    );
    expect(fullUserLookupSpy).not.toHaveBeenCalled();
    fullUserLookupSpy.mockRestore();

    const detail = await request(app.getHttpServer())
      .get('/api/v1/audit-events/sql/sql_audit_001')
      .set('Cookie', cookies)
      .expect(200);

    expect(detail.body).toEqual(
      expect.objectContaining({
        auditId: 'sql_audit_001',
        actorName: '企业微信目录同步任务',
        sqlSummary: 'UPDATE wx_users SET name = ? WHERE id = ?',
        canRevealSensitive: true,
      }),
    );

    const analysisDetail = await request(app.getHttpServer())
      .get('/api/v1/audit-events/sql/sql_audit_002')
      .set('Cookie', cookies)
      .expect(200);

    expect(analysisDetail.body.behaviorContext).toEqual(
      expect.objectContaining({
        title: '智能分析问数',
        summary: '请分析今年二月份商机情况',
        originalQuestion: '请分析今年二月份商机情况',
        requestStatus: 'RETURNED',
        temporalLabel: '2026年2月',
        taskTitles: ['商机数量趋势分析'],
      }),
    );

    const reveal = await request(app.getHttpServer())
      .post('/api/v1/audit-events/sql/sql_audit_001/reveal')
      .set('Cookie', cookies)
      .expect(201);

    expect(reveal.body).toEqual(
      expect.objectContaining({
        auditId: 'sql_audit_001',
        sqlText: 'UPDATE wx_users SET name = ? WHERE id = ?',
        params: ['张三', 1001],
      }),
    );

    const auditEvents = await request(app.getHttpServer())
      .get('/api/v1/audit-events')
      .query({
        eventType: 'SQL_AUDIT_RAW_VIEWED',
        pageSize: 20,
      })
      .set('Cookie', cookies)
      .expect(200);

    expect(auditEvents.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: 'SQL_AUDIT_RAW_VIEWED',
          resourceId: 'sql_audit_001',
        }),
      ]),
    );
  });

  it('仅具备 audit.view 的用户不得访问 SQL 审计接口', async () => {
    const rolePermissionRepository = app.get(RolePermissionRepository);
    const salesDirectorRole = rolePermissionRepository.findByRoleId('role_sales_director');
    expect(salesDirectorRole).toBeTruthy();

    rolePermissionRepository.save({
      ...salesDirectorRole!,
      visibleMenus: Array.from(new Set([...(salesDirectorRole?.visibleMenus ?? []), 'audit-center'])),
      actionKeys: Array.from(new Set([...(salesDirectorRole?.actionKeys ?? []), 'audit.view'])),
    });

    const cookies = await loginAs(app, 'user_sales_director');

    await request(app.getHttpServer())
      .get('/api/v1/audit-events')
      .set('Cookie', cookies)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/audit-events/sql')
      .set('Cookie', cookies)
      .expect(403);
  });

  it('SQL 审计列表应批量解析用户姓名，并在 CRM 查名失败时降级返回', async () => {
    const sqlAuditRepository = app.get(SqlAuditRepository);
    const crmReadonlyService = app.get(CrmReadonlyService);
    const fullUserLookupSpy = jest.spyOn(crmReadonlyService, 'getUserById');

    sqlAuditRepository.create(
      buildSqlAuditRecord({
        id: 'sql_audit_user_display_name',
        actorId: 'user_sales_director',
        actorRoleIds: ['role_sales_director'],
        moduleKey: 'analysis-workbench',
        databaseRole: 'CRM_READONLY',
        operationType: 'SELECT',
        tables: ['opportunities'],
        sqlText: 'SELECT * FROM opportunities LIMIT 1',
        sqlSummary: 'SELECT * FROM opportunities LIMIT 1',
        normalizedSql: 'SELECT * FROM opportunities LIMIT 1',
      }),
    );

    const cookies = await loginAs(app, 'user_admin');
    const list = await request(app.getHttpServer())
      .get('/api/v1/audit-events/sql')
      .query({
        pageSize: 20,
      })
      .set('Cookie', cookies)
      .expect(200);

    expect(list.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          auditId: 'sql_audit_user_display_name',
          actorName: '销售总监',
        }),
      ]),
    );
    expect(fullUserLookupSpy).not.toHaveBeenCalled();
    fullUserLookupSpy.mockRestore();

    jest
      .spyOn(crmReadonlyService, 'listUserDisplayNamesByIdentifiers')
      .mockRejectedValueOnce(new Error('Pool is closed.'));

    const fallbackList = await request(app.getHttpServer())
      .get('/api/v1/audit-events/sql')
      .query({
        pageSize: 20,
      })
      .set('Cookie', cookies)
      .expect(200);

    expect(fallbackList.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          auditId: 'sql_audit_user_display_name',
          actorName: 'user_sales_director',
        }),
      ]),
    );
  });

  it('SQL 审计列表应为历史系统身份解析记录回显真实 CRM 用户名', async () => {
    const sqlAuditRepository = app.get(SqlAuditRepository);
    const crmReadonlyService = app.get(CrmReadonlyService);
    const fullUserLookupSpy = jest.spyOn(crmReadonlyService, 'getUserById');

    sqlAuditRepository.create(
      buildSqlAuditRecord({
        id: 'sql_audit_legacy_identity_user',
        actorId: 'system:crm-intelligent-analytics',
        actorRoleIds: [],
        moduleKey: 'crm-identity',
        programName: 'CrmReadonlyService.getUserById',
        databaseRole: 'CRM_READONLY',
        operationType: 'SELECT',
        tables: ['users', 'wx_user_maps', 'wx_users'],
        sqlText:
          'SELECT u.id, u.name FROM users u LEFT JOIN wx_user_maps m ON m.user_id = u.id WHERE u.id = ? LIMIT 1',
        sqlSummary:
          'SELECT u.id, u.name FROM users u LEFT JOIN wx_user_maps m ON m.user_id = u.id WHERE u.id = ? LIMIT 1',
        paramsJson: '["user_sales_director"]',
        paramSummary: '参数1:string(19)',
        normalizedSql:
          'SELECT u.id, u.name FROM users u LEFT JOIN wx_user_maps m ON m.user_id = u.id WHERE u.id = ? LIMIT 1',
      }),
    );

    const cookies = await loginAs(app, 'user_admin');
    const list = await request(app.getHttpServer())
      .get('/api/v1/audit-events/sql')
      .query({
        moduleKey: 'crm-identity',
        pageSize: 20,
      })
      .set('Cookie', cookies)
      .expect(200);

    expect(list.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          auditId: 'sql_audit_legacy_identity_user',
          actorId: 'system:crm-intelligent-analytics',
          actorName: '销售总监',
        }),
      ]),
    );

    const detail = await request(app.getHttpServer())
      .get('/api/v1/audit-events/sql/sql_audit_legacy_identity_user')
      .set('Cookie', cookies)
      .expect(200);

    expect(detail.body).toEqual(
      expect.objectContaining({
        auditId: 'sql_audit_legacy_identity_user',
        actorName: '销售总监',
      }),
    );
    expect(fullUserLookupSpy).not.toHaveBeenCalled();
    fullUserLookupSpy.mockRestore();
  });

  it('SQL 审计默认列表应隐藏内部身份解析与审计中心辅助记录', async () => {
    const sqlAuditRepository = app.get(SqlAuditRepository);

    sqlAuditRepository.create(
      buildSqlAuditRecord({
        id: 'sql_audit_business_query',
        actorId: 'user_sales_director',
        actorRoleIds: ['role_sales_director'],
        moduleKey: 'analysis-workbench',
        databaseRole: 'CRM_READONLY',
        operationType: 'SELECT',
        tables: ['opportunities'],
        sqlText: 'SELECT * FROM opportunities LIMIT 1',
        sqlSummary: 'SELECT * FROM opportunities LIMIT 1',
        normalizedSql: 'SELECT * FROM opportunities LIMIT 1',
      }),
    );
    sqlAuditRepository.create(
      buildSqlAuditRecord({
        id: 'sql_audit_internal_identity',
        actorId: 'system:crm-intelligent-analytics',
        actorRoleIds: [],
        moduleKey: 'crm-identity',
        programName: 'CrmReadonlyService.getUserById',
        databaseRole: 'CRM_READONLY',
        operationType: 'SELECT',
        tables: ['users'],
        sqlText: 'SELECT * FROM users WHERE id = ?',
        sqlSummary: 'SELECT * FROM users WHERE id = ?',
        paramsJson: '["user_sales_director"]',
        normalizedSql: 'SELECT * FROM users WHERE id = ?',
      }),
    );
    sqlAuditRepository.create(
      buildSqlAuditRecord({
        id: 'sql_audit_internal_audit_center',
        actorId: 'user_admin',
        actorRoleIds: ['role_admin'],
        moduleKey: 'audit-center',
        programName: 'AuditController.listAuditEvents',
        databaseRole: 'CRM_READONLY',
        operationType: 'SELECT',
        tables: ['users'],
        sqlText: 'SELECT id, name FROM users WHERE id IN (?)',
        sqlSummary: 'SELECT id, name FROM users WHERE id IN (?)',
        normalizedSql: 'SELECT id, name FROM users WHERE id IN (?)',
      }),
    );
    sqlAuditRepository.create(
      buildSqlAuditRecord({
        id: 'sql_audit_internal_crm_readonly',
        actorId: 'system:crm-intelligent-analytics',
        actorRoleIds: [],
        moduleKey: 'crm-readonly',
        programName: 'CrmReadonlyService.pool.query',
        databaseRole: 'CRM_READONLY',
        operationType: 'SELECT',
        tables: ['wx_user_maps', 'wx_users'],
        sqlText:
          'SELECT w.userid FROM wx_user_maps m INNER JOIN wx_users w ON w.id = m.wx_user_id WHERE m.user_id = ? LIMIT ?',
        sqlSummary:
          'SELECT w.userid FROM wx_user_maps m INNER JOIN wx_users w ON w.id = m.wx_user_id WHERE m.user_id = ? LIMIT ?',
        paramsJson: '["user_sales_director"]',
        normalizedSql:
          'SELECT w.userid FROM wx_user_maps m INNER JOIN wx_users w ON w.id = m.wx_user_id WHERE m.user_id = ? LIMIT ?',
      }),
    );

    const cookies = await loginAs(app, 'user_admin');
    const list = await request(app.getHttpServer())
      .get('/api/v1/audit-events/sql')
      .query({
        pageSize: 20,
      })
      .set('Cookie', cookies)
      .expect(200);

    expect(list.body.total).toBe(1);
    expect(list.body.summary.totalCount).toBe(1);
    expect(list.body.items).toEqual([
      expect.objectContaining({
        auditId: 'sql_audit_business_query',
        moduleKey: 'analysis-workbench',
      }),
    ]);

    const internalList = await request(app.getHttpServer())
      .get('/api/v1/audit-events/sql')
      .query({
        moduleKey: 'crm-identity',
        pageSize: 20,
      })
      .set('Cookie', cookies)
      .expect(200);

    expect(internalList.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          auditId: 'sql_audit_internal_identity',
          actorName: '销售总监',
        }),
      ]),
    );
  });

  it('独立 SQL 审计存储启用后控制器应优先读取新存储并保持 reveal 兼容', async () => {
    await app.close();
    const runtimeDir = mkdtempSync(join(tmpdir(), 'crm-sql-audit-controller-store-'));
    process.env.SQL_AUDIT_INDEPENDENT_STORE_ENABLED = 'true';
    process.env.SQL_AUDIT_FILE_STORE_PATH = join(runtimeDir, 'sql-audit-records.jsonl');
    app = await createTestApp();

    try {
      const sqlAuditRepository = app.get(SqlAuditRepository);
      const appStorageService = app.get(AppStorageService);
      sqlAuditRepository.create(
        buildSqlAuditRecord({
          id: 'sql_audit_independent_controller',
          actorId: 'user_admin',
          actorRoleIds: ['role_admin'],
          moduleKey: 'analysis-workbench',
          databaseRole: 'CRM_READONLY',
          operationType: 'SELECT',
          tables: ['opportunities'],
          sqlText: 'SELECT * FROM opportunities WHERE owner_id = ?',
          sqlSummary: 'SELECT * FROM opportunities WHERE owner_id = ?',
          paramsJson: '["user_admin"]',
          normalizedSql: 'SELECT * FROM opportunities WHERE owner_id = ?',
        }),
      );
      appStorageService.state.sqlAuditRecords.splice(0);

      const cookies = await loginAs(app, 'user_admin');
      const list = await request(app.getHttpServer())
        .get('/api/v1/audit-events/sql')
        .query({ pageSize: 20 })
        .set('Cookie', cookies)
        .expect(200);

      expect(list.body.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            auditId: 'sql_audit_independent_controller',
            moduleKey: 'analysis-workbench',
          }),
        ]),
      );

      const reveal = await request(app.getHttpServer())
        .post('/api/v1/audit-events/sql/sql_audit_independent_controller/reveal')
        .set('Cookie', cookies)
        .expect(201);

      expect(reveal.body).toEqual(
        expect.objectContaining({
          auditId: 'sql_audit_independent_controller',
          params: ['user_admin'],
        }),
      );
    } finally {
      rmSync(runtimeDir, { recursive: true, force: true });
    }
  });
});

import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { loginAs } from '../auth-test.helper';
import { createTestApp } from '../test-app';
import { AppStorageService } from '../../src/database/app-storage/app-storage.service';
import { CrmReadonlyService } from '../../src/database/crm-readonly/crm-readonly.service';

describe('governance and audit contract', () => {
  let app: INestApplication;
  let appStorageService: AppStorageService;
  let crmReadonlyService: CrmReadonlyService;

  beforeAll(async () => {
    app = await createTestApp();
    appStorageService = app.get(AppStorageService);
    crmReadonlyService = app.get(CrmReadonlyService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('管理员应可获取治理策略与审计列表', async () => {
    const cookies = await loginAs(app, 'user_admin');
    const userCookies = await loginAs(app, 'user_sales_director');
    const policy = await request(app.getHttpServer())
      .get('/api/v1/governance/policies/current')
      .set('Cookie', cookies)
      .expect(200);

    expect(policy.body.policyId).toBeTruthy();

    const created = await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', userCookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '本月各销售负责人新增商机金额排名',
      })
      .expect(201);

    appStorageService.state.auditEvents.unshift({
      id: 'audit_contract_wecom_query',
      eventType: 'QUERY_SUCCEEDED',
      actorId: 'user_sales_director',
      actorRoleIds: ['role_sales_director'],
      actorType: 'crm-user',
      actorDisplayName: '销售总监',
      actorBindingStatus: 'BOUND_CRM',
      channel: 'wecom-bot',
      actionSummary: '提交企业微信智能问数查询。',
      targetType: 'analysis-query',
      targetId: 'query_contract_wecom',
      targetSummary: '企业微信查询占比测试',
      scopeSnapshot: {
        organizationIds: ['org_north'],
        departmentIds: ['dept_sales'],
        ownerIds: [],
        scopeSummary: '销售部',
      },
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome: '查询成功',
      createdAt: '2026-05-18T00:00:00.000Z',
    });
    appStorageService.state.auditEvents.unshift({
      id: 'audit_contract_wecom_query_2',
      eventType: 'QUERY_SUCCEEDED',
      actorId: 'user_sales_director',
      actorRoleIds: ['role_sales_director'],
      actorType: 'crm-user',
      actorDisplayName: '销售总监',
      actorBindingStatus: 'BOUND_CRM',
      channel: 'wecom-bot',
      actionSummary: '提交企业微信智能问数查询。',
      targetType: 'analysis-query',
      targetId: 'query_contract_wecom_2',
      targetSummary: '企业微信查询占比测试二号样例',
      scopeSnapshot: {
        organizationIds: ['org_north'],
        departmentIds: ['dept_sales'],
        ownerIds: [],
        scopeSummary: '销售部',
      },
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome: '查询成功',
      createdAt: '2026-05-18T00:00:00.500Z',
    });
    appStorageService.state.auditEvents.unshift({
      id: 'audit_contract_legacy',
      eventType: 'EXPORT_SUCCEEDED',
      actorId: 'user_sales_director',
      actorRoleIds: ['role_sales_director'],
      scopeSnapshot: {
        organizationIds: ['org_north'],
        departmentIds: ['dept_sales'],
        ownerIds: [],
        scopeSummary: '销售部',
      },
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome: '历史导出成功',
      createdAt: '2026-05-18T00:00:01.000Z',
    });

    const audit = await request(app.getHttpServer())
      .get('/api/v1/audit-events')
      .query({
        eventType: 'QUERY_SUCCEEDED',
        pageSize: 200,
      })
      .set('Cookie', cookies)
      .expect(200);

    expect(audit.body.summary).toBeTruthy();
    expect(audit.body.summary).toEqual(
      expect.objectContaining({
        todayAiEntryCount: expect.any(Number),
        todayAiFallbackCount: expect.any(Number),
        todayAiFallbackRatePercent: expect.any(Number),
        todayWecomEntryCount: expect.any(Number),
        analysisExecutionSourceBreakdown: expect.any(Array),
        analysisKnowledgeHitBreakdown: expect.any(Array),
        entrySceneBreakdown: expect.any(Array),
        entryLanguageBreakdown: expect.any(Array),
        entryTargetWorkflowBreakdown: expect.any(Array),
        entryFallbackReasonBreakdown: expect.any(Array),
        entryDailyTrend: expect.any(Array),
        entrySceneDailyTrend: expect.any(Array),
        entryFallbackReasonDailyTrend: expect.any(Array),
        aiGovernanceSuggestions: expect.any(Array),
        aiGovernanceAlerts: expect.any(Array),
        wecomQueryRatioPercent: expect.any(Number),
      }),
    );
    expect(audit.body.summary.wecomQueryRatioPercent).not.toBe(50);
    expect(Array.isArray(audit.body.items)).toBe(true);
    const targetItem = audit.body.items.find(
      (item: { queryId?: string; originalQuestion?: string }) =>
        item.queryId === created.body.queryId ||
        item.originalQuestion === '本月各销售负责人新增商机金额排名',
    );
    expect(targetItem).toEqual(
      expect.objectContaining({
        eventId: expect.any(String),
        eventType: 'QUERY_SUCCEEDED',
        actorName: '销售总监',
        actorType: 'crm-user',
        actorBindingStatus: 'BOUND_CRM',
        channel: 'web-console',
        actionSummary: expect.any(String),
        targetType: 'analysis-query',
        entryScene: 'WEB_ANALYSIS_QUERY',
        entryLanguage: 'zh-CN',
        entryTargetWorkflow: 'ANALYSIS_QUERY_EXECUTION',
        workflowTargetWorkflow: 'ANALYSIS_QUERY_EXECUTION',
        executionTraceSummary: expect.objectContaining({
          normalizedQuestion: expect.any(String),
          taskSummaries: expect.any(Array),
        }),
        sessionSnapshot: expect.anything(),
      }),
    );

    const legacyAudit = await request(app.getHttpServer())
      .get('/api/v1/audit-events')
      .query({
        eventType: 'EXPORT_SUCCEEDED',
        actorId: '销售总监',
        pageSize: 200,
      })
      .set('Cookie', cookies)
      .expect(200);

    expect(legacyAudit.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventId: 'audit_contract_legacy',
          actorName: '销售总监',
          outcome: '历史导出成功',
        }),
      ]),
    );
  });

  it('缺少 audit.view 的用户不得访问审计列表', async () => {
    const userCookies = await loginAs(app, 'user_sales_director');

    await request(app.getHttpServer())
      .get('/api/v1/audit-events')
      .set('Cookie', userCookies)
      .expect(403);
  });

  it('审计列表补全历史行为人失败时应降级返回，避免分页请求 500', async () => {
    const cookies = await loginAs(app, 'user_admin');
    const originalAuditEvents = [...appStorageService.state.auditEvents];
    const userLookupSpy = jest
      .spyOn(crmReadonlyService, 'getUserById')
      .mockRejectedValue(new Error('Pool is closed.'));

    appStorageService.state.auditEvents = [
      ...Array.from({ length: 10 }, (_, index) => ({
        id: `audit_contract_actor_lookup_page_1_${index}`,
        eventType: 'QUERY_SUCCEEDED' as const,
        actorId: `user_page_1_${index}`,
        actorRoleIds: ['role_sales_director'],
        actorDisplayName: `第一页用户${index + 1}`,
        scopeSnapshot: {
          organizationIds: ['org_north'],
          departmentIds: ['dept_sales'],
          ownerIds: [],
          scopeSummary: '销售部',
        },
        riskLevel: 'LOW' as const,
        reviewStatus: 'CONFIRMED' as const,
        outcome: '查询成功',
        createdAt: `2026-05-18T00:00:0${index % 10}.000Z`,
      })),
      {
        id: 'audit_contract_actor_lookup_fallback',
        eventType: 'QUERY_SUCCEEDED',
        actorId: 'user_sales_director',
        actorRoleIds: ['role_sales_director'],
        scopeSnapshot: {
          organizationIds: ['org_north'],
          departmentIds: ['dept_sales'],
          ownerIds: [],
          scopeSummary: '销售部',
        },
        riskLevel: 'LOW',
        reviewStatus: 'CONFIRMED',
        outcome: '查询成功',
        createdAt: '2026-05-18T00:00:02.000Z',
      },
    ];

    try {
      const response = await request(app.getHttpServer())
        .get('/api/v1/audit-events')
        .query({
          page: 2,
          pageSize: 10,
        })
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            eventId: 'audit_contract_actor_lookup_fallback',
            actorName: '销售总监',
          }),
        ]),
      );
      expect(userLookupSpy).not.toHaveBeenCalled();
    } finally {
      userLookupSpy.mockRestore();
      appStorageService.state.auditEvents = originalAuditEvents;
    }
  });
});

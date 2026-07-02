import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { loginAs } from '../auth-test.helper';
import { createTestApp } from '../test-app';

describe('governance audit integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('治理策略更新后应立即生效', async () => {
    const cookies = await loginAs(app, 'user_admin');
    const updated = await request(app.getHttpServer())
      .put('/api/v1/governance/policies/current')
      .set('Cookie', cookies)
      .send({
        enabledRoleIds: ['role_sales_director', 'role_region_manager', 'role_admin'],
        exportRoleIds: ['role_admin'],
        enabledChannels: ['web-console', 'wecom-bot'],
        allowedDomains: ['opportunity-analysis', 'contract-conversion', 'customer-relationship'],
        allowedTables: ['opportunities', 'contracts', 'customers', 'users'],
        allowedFields: {
          opportunities: ['id', 'user_id', 'department_id', 'expect_amount', 'organization_id'],
          contracts: ['id', 'user_id', 'total_amount', 'organization_id'],
          customers: ['id', 'name', 'category', 'organization_id'],
        },
        maskedFields: {
          customers: ['mobile', 'email'],
        },
        exportRowLimit: 1000,
        exportDailyLimit: 3,
        maxOnlineSessions: 200,
        maxConcurrentQueries: 50,
        heartbeatIntervalSeconds: 30,
        idleTimeoutSeconds: 120,
        historyRetentionDays: 30,
      })
      .expect(200);

    expect(updated.body.exportRoleIds).toEqual(['role_admin']);
  });

  it('被授予 governance.policy.manage 的非管理员也应可访问治理策略接口', async () => {
    const adminCookies = await loginAs(app, 'user_admin');
    const userCookies = await loginAs(app, 'user_sales_director');

    await request(app.getHttpServer())
      .put('/api/v1/governance/role-permissions/role_sales_director')
      .set('Cookie', adminCookies)
      .send({
        roleNameSnapshot: '销售总监',
        status: 'ACTIVE',
        visibleMenus: ['analysis-workbench', 'permission-center'],
        actionKeys: ['analysis.use', 'analysis.follow_up', 'governance.policy.manage'],
        webConsoleEnabled: true,
        wecomBotEligible: true,
        exportAllowed: false,
        templateManageAllowed: false,
        contractReviewUploadAllowed: false,
        contractReviewCrossViewAllowed: false,
        contractReviewCrossDownloadAllowed: false,
        changeReason: '用于验证系统级治理动作委派',
      })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/governance/policies/current')
      .set('Cookie', userCookies)
      .expect(200);
  });

  it('审计列表应展开统一入口理解快照与程序路由快照字段', async () => {
    const userCookies = await loginAs(app, 'user_sales_director');
    const adminCookies = await loginAs(app, 'user_admin');

    const created = await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', userCookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '本月各销售负责人新增商机金额排名',
      })
      .expect(201);

    const audit = await request(app.getHttpServer())
      .get('/api/v1/audit-events')
      .query({
        eventType: 'QUERY_BLOCKED',
        pageSize: 200,
      })
      .set('Cookie', adminCookies)
      .expect(200);

    const targetItem = audit.body.items.find(
      (item: { queryId?: string; originalQuestion?: string }) =>
        item.queryId === created.body.queryId ||
        item.originalQuestion === '本月各销售负责人新增商机金额排名',
    );

    expect(targetItem).toBeTruthy();
    expect(targetItem.queryId).toBeTruthy();
    expect(targetItem.entryInterpretationSnapshot).toMatchObject({
      scene: 'WEB_ANALYSIS_QUERY',
      targetWorkflow: 'ANALYSIS_QUERY_EXECUTION',
      language: 'zh-CN',
    });
    expect(targetItem.workflowRoutingSnapshot).toMatchObject({
      targetWorkflow: 'ANALYSIS_BLOCKED',
      gateResult: 'BLOCKED',
    });
    expect(targetItem.entryScene).toBe('WEB_ANALYSIS_QUERY');
    expect(targetItem.entryLanguage).toBe('zh-CN');
    expect(targetItem.entryTargetWorkflow).toBe('ANALYSIS_QUERY_EXECUTION');
    expect(targetItem.workflowTargetWorkflow).toBe('ANALYSIS_BLOCKED');
    expect(audit.body.summary.todayAiEntryCount).toBeGreaterThan(0);
    expect(audit.body.summary.todayAiFallbackCount).toBeGreaterThanOrEqual(0);
    expect(audit.body.summary.todayAiFallbackRatePercent).toBeGreaterThanOrEqual(0);
    expect(audit.body.summary.todayWecomEntryCount).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(audit.body.summary.entrySceneBreakdown)).toBe(true);
    expect(Array.isArray(audit.body.summary.entryLanguageBreakdown)).toBe(true);
    expect(Array.isArray(audit.body.summary.entryTargetWorkflowBreakdown)).toBe(true);
    expect(Array.isArray(audit.body.summary.entryFallbackReasonBreakdown)).toBe(true);
    expect(Array.isArray(audit.body.summary.entryDailyTrend)).toBe(true);
    expect(Array.isArray(audit.body.summary.entrySceneDailyTrend)).toBe(true);
    expect(Array.isArray(audit.body.summary.entryFallbackReasonDailyTrend)).toBe(true);
    expect(Array.isArray(audit.body.summary.aiGovernanceSuggestions)).toBe(true);
    expect(Array.isArray(audit.body.summary.aiGovernanceAlerts)).toBe(true);
  });

  it('审计列表应支持按入口理解与程序路由字段过滤', async () => {
    const userCookies = await loginAs(app, 'user_sales_director');
    const adminCookies = await loginAs(app, 'user_admin');

    await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', userCookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '今天天气怎么样',
      })
      .expect(201);

    const filteredAudit = await request(app.getHttpServer())
      .get('/api/v1/audit-events')
      .query({
        eventType: 'QUERY_BLOCKED',
        entryScene: 'WEB_ANALYSIS_QUERY',
        entryLanguage: 'zh-CN',
        entryTargetWorkflow: 'ANALYSIS_BLOCKED',
        workflowTargetWorkflow: 'ANALYSIS_BLOCKED',
        pageSize: 200,
      })
      .set('Cookie', adminCookies)
      .expect(200);

    expect(filteredAudit.body.items.length).toBeGreaterThan(0);
    expect(
      filteredAudit.body.items.every(
        (item: {
          entryScene?: string;
          entryLanguage?: string;
          entryTargetWorkflow?: string;
          workflowTargetWorkflow?: string;
        }) =>
          item.entryScene === 'WEB_ANALYSIS_QUERY' &&
          item.entryLanguage === 'zh-CN' &&
          item.entryTargetWorkflow === 'ANALYSIS_BLOCKED' &&
          item.workflowTargetWorkflow === 'ANALYSIS_BLOCKED',
      ),
    ).toBe(true);
    expect(
      filteredAudit.body.summary.entrySceneBreakdown.some(
        (item: { scene?: string }) => item.scene === 'WEB_ANALYSIS_QUERY',
      ),
    ).toBe(true);
    expect(
      filteredAudit.body.summary.entryDailyTrend.every(
        (item: { aiEntryCount?: number; aiFallbackCount?: number }) =>
          typeof item.aiEntryCount === 'number' &&
          typeof item.aiFallbackCount === 'number',
      ),
    ).toBe(true);
    expect(
      filteredAudit.body.summary.entryLanguageBreakdown.some(
        (item: { language?: string }) => item.language === 'zh-CN',
      ),
    ).toBe(true);
    expect(
      filteredAudit.body.summary.aiGovernanceSuggestions.every(
        (item: { title?: string; action?: string }) =>
          typeof item.title === 'string' && typeof item.action === 'string',
      ),
    ).toBe(true);
    expect(
      filteredAudit.body.summary.aiGovernanceAlerts.every(
        (item: { title?: string; level?: string }) =>
          typeof item.title === 'string' && typeof item.level === 'string',
      ),
    ).toBe(true);
  });
});

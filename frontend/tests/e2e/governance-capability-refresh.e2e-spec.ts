import { expect, test } from '@playwright/test';

test('connection policy save should refresh capabilities and allow next navigation to use new menu result', async ({
  page,
}) => {
  let capabilityRequestCount = 0;

  await page.route('**/api/v1/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        sessionId: 'auth_session_governance_refresh',
        source: 'password-login',
        expiresAt: '2026-04-24T10:00:00.000Z',
        user: {
          id: 'user_admin',
          name: '系统管理员',
          roleNames: ['系统管理员'],
          channels: ['web-console'],
          organizationIds: ['org_all'],
          departmentIds: ['dept_all'],
        },
      }),
    });
  });

  await page.route('**/api/v1/analysis/capabilities', async (route) => {
    capabilityRequestCount += 1;
    const includeManagementReport = capabilityRequestCount >= 2;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        serviceStatus: 'ONLINE',
        scopeSummary: '当前管理员可查看已授权的全部组织范围。',
        roleNames: ['系统管理员'],
        channels: ['web-console'],
        domains: ['opportunity-analysis'],
        metrics: ['新增商机金额'],
        dimensions: ['销售负责人'],
        exportAllowed: true,
        exportRowLimit: 1000,
        exportDailyLimit: 3,
        remainingDailyExports: 3,
        historyEnabled: true,
        templateCount: 1,
        dataFreshnessAt: '2026-04-17T09:00:00.000Z',
        visibleMenus: [
          'analysis-workbench',
          ...(includeManagementReport ? ['management-report'] : []),
          'permission-center',
          'connection-policy',
          'audit-center',
        ],
        actionKeys: [
          'analysis.use',
          ...(includeManagementReport
            ? ['management.report.view', 'management.report.export']
            : []),
          'governance.policy.manage',
          'audit.view',
        ],
        contractWorkspaceAllowed: false,
        wecomBotAccessState: 'ALLOWED',
        templateViewAllowed: true,
        followUpAllowed: true,
        contractPermissions: {
          uploadAllowed: false,
          crossViewAllowed: false,
          crossDownloadAllowed: false,
        },
      }),
    });
  });

  await page.route('**/api/v1/governance/policies/current', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          policyId: 'policy_current',
          enabledRoleIds: ['role_admin'],
          exportRoleIds: ['role_admin'],
          enabledChannels: ['web-console'],
          allowedDomains: ['opportunity-analysis'],
          allowedTables: ['crm_opportunities'],
          allowedFields: {},
          maskedFields: {},
          exportRowLimit: 1000,
          exportDailyLimit: 3,
          maxOnlineSessions: 200,
          maxConcurrentQueries: 50,
          heartbeatIntervalSeconds: 30,
          idleTimeoutSeconds: 120,
          historyRetentionDays: 30,
          status: 'ACTIVE',
          updatedAt: '2026-04-17T09:00:00.000Z',
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        policyId: 'policy_current',
        enabledRoleIds: ['role_admin'],
        exportRoleIds: ['role_admin'],
        enabledChannels: ['web-console'],
        allowedDomains: ['opportunity-analysis'],
        allowedTables: ['crm_opportunities'],
        allowedFields: {},
        maskedFields: {},
        exportRowLimit: 1000,
        exportDailyLimit: 3,
        maxOnlineSessions: 200,
        maxConcurrentQueries: 50,
        heartbeatIntervalSeconds: 30,
        idleTimeoutSeconds: 120,
        historyRetentionDays: 30,
        status: 'ACTIVE',
        updatedAt: '2026-04-17T09:10:00.000Z',
      }),
    });
  });

  await page.route('**/api/v1/management-report/options', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        scopeSummary: '当前展示销售团队授权范围。',
        presets: [{ key: 'q1', label: '当年 Q1' }],
        departments: [{ id: 'all-company', label: '全公司', selectable: true }],
        defaultFilter: {
          departmentId: 'all-company',
          presetKey: 'q1',
          startDate: '2026-01-01',
          endDate: '2026-03-31',
        },
      }),
    });
  });

  await page.route('**/api/v1/management-report/snapshot', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        reportId: 'report_capability_refresh',
        meta: {
          departmentId: 'all-company',
          departmentLabel: '全公司',
          presetKey: 'q1',
          startDate: '2026-01-01',
          endDate: '2026-03-31',
          scopeSummary: '当前展示销售团队授权范围。',
          generatedAt: '2026-04-24T10:00:00.000Z',
        },
        overview: {
          sectionKey: 'overview',
          title: '总览',
          summary: '测试摘要',
          metricCards: [],
          blocks: [],
          footnotes: [],
          sourceNotes: [],
        },
        executiveSummary: {
          sectionKey: 'executive-summary',
          title: '经营摘要',
          summary: '测试摘要',
          metricCards: [],
          blocks: [],
          footnotes: [],
          sourceNotes: [],
        },
        sections: [],
      }),
    });
  });

  await page.goto('/governance/connections');

  await expect(page.getByRole('link', { name: /经营报表/ })).toHaveCount(0);
  await page.getByRole('button', { name: /保存连接策略/ }).click();

  await expect(page.getByRole('link', { name: /经营报表/ })).toBeVisible();
  await page.getByRole('link', { name: /经营报表/ }).click();
  await expect(page.getByRole('heading', { name: '经营报表' })).toBeVisible();
  expect(capabilityRequestCount).toBe(2);
});

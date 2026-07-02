import { expect, test } from '@playwright/test';

test('hot navigation should not re-request session or capabilities on protected menu switches', async ({
  page,
}) => {
  let sessionRequestCount = 0;
  let capabilityRequestCount = 0;

  await page.route('**/api/v1/auth/session', async (route) => {
    sessionRequestCount += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        sessionId: 'auth_session_nav_perf',
        source: 'password-login',
        expiresAt: '2026-04-24T10:00:00.000Z',
        user: {
          id: 'user_sales_director',
          name: '销售总监',
          roleNames: ['销售总监'],
          channels: ['web-console'],
          organizationIds: ['org_north'],
          departmentIds: ['dept_sales'],
        },
      }),
    });
  });

  await page.route('**/api/v1/analysis/capabilities', async (route) => {
    capabilityRequestCount += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        serviceStatus: 'ONLINE',
        scopeSummary: '当前展示销售团队授权范围。',
        roleNames: ['销售总监'],
        channels: ['web-console'],
        domains: ['opportunity-analysis'],
        metrics: ['新增线索'],
        dimensions: ['部门'],
        exportAllowed: true,
        exportRowLimit: 1000,
        exportDailyLimit: 3,
        remainingDailyExports: 3,
        historyEnabled: true,
        templateCount: 0,
        dataFreshnessAt: '2026-04-24T10:00:00.000Z',
        visibleMenus: ['analysis-workbench', 'management-report', 'contract-review'],
        actionKeys: [
          'analysis.use',
          'analysis.export',
          'management.report.view',
          'management.report.export',
          'contract.review.upload',
        ],
        followUpAllowed: true,
        templateViewAllowed: true,
        contractWorkspaceAllowed: true,
        wecomBotAccessState: 'ALLOWED',
        contractPermissions: {
          uploadAllowed: true,
          crossViewAllowed: false,
          crossDownloadAllowed: false,
        },
      }),
    });
  });

  await page.route('**/api/v1/analysis/templates', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    });
  });

  await page.route('**/api/v1/analysis/histories?page=1&pageSize=10', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [],
        page: 1,
        pageSize: 10,
        total: 0,
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
        reportId: 'report_nav_perf',
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

  await page.route('**/api/v1/contract-reviews/contracts/pending-approval', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            contractId: 'con_perf_001',
            contractCode: 'HT-2026-001',
            contractName: '联软科技年度服务合同',
            customerName: '联软科技集团',
            ownerName: '张琳',
            totalAmount: 680000,
            submitApplyingAt: '2026-04-17T09:00:00.000Z',
            approveStatus: '待审批',
            pendingStep: 1,
          },
        ],
      }),
    });
  });

  await page.route('**/api/v1/contract-reviews/contracts/con_perf_001', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        contractId: 'con_perf_001',
        contractCode: 'HT-2026-001',
        contractName: '联软科技年度服务合同',
        customerName: '联软科技集团',
        ownerId: 'owner_zhang',
        ownerName: '张琳',
        organizationId: 'org_north',
        departmentId: 'dept_sales',
        departmentName: '销售部',
        totalAmount: 680000,
        specialTermBlocks: [],
        approvalHistory: [],
        approveStatus: '待审批',
        pendingStep: 1,
        sourceSummary: '合同名称：联软科技年度服务合同；客户：联软科技集团；负责人：张琳。',
      }),
    });
  });

  await page.route('**/api/v1/contract-reviews/tasks', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    });
  });

  await page.goto('/analysis');
  await expect(page.getByRole('heading', { name: '智能分析' })).toBeVisible();

  await page.getByRole('link', { name: /经营报表/ }).click();
  await expect(page.getByRole('heading', { name: '经营报表' })).toBeVisible();

  await page.getByRole('link', { name: /智能合同/ }).click();
  await expect(page.getByText('CRM合同列表')).toBeVisible();

  await page.getByRole('link', { name: /智能分析/ }).click();
  await expect(page.getByRole('heading', { name: '智能分析' })).toBeVisible();

  expect(sessionRequestCount).toBe(1);
  expect(capabilityRequestCount).toBe(1);
});

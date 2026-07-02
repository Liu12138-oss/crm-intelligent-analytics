import { expect, test, type Page } from '@playwright/test';

async function mockAuthenticatedManagementReport(page: Page) {
  let sectionRequestCount = 0;
  await page.route('**/api/v1/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        sessionId: 'auth_session_management',
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
        visibleMenus: ['analysis-workbench', 'management-report'],
        actionKeys: ['analysis.use', 'management.report.view', 'management.report.export'],
        followUpAllowed: true,
        templateViewAllowed: true,
        contractWorkspaceAllowed: false,
        wecomBotAccessState: 'ALLOWED',
        contractPermissions: {
          uploadAllowed: false,
          crossViewAllowed: false,
          crossDownloadAllowed: false,
        },
      }),
    });
  });

  await page.route('**/api/v1/management-report/options', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        scopeSummary: '当前展示销售团队授权范围。',
        presets: [
          { key: 'q1', label: '当年 Q1' },
          { key: 'custom', label: '自定义时间范围' },
        ],
        departments: [
          {
            id: 'all-company',
            label: '全公司',
            selectable: true,
            children: [{ id: 'dept_sales', label: '销售部', selectable: true }],
          },
        ],
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
        reportId: 'report_q1',
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
          summary: '首屏优先返回统一筛选上下文下的核心经营指标。',
          metricCards: [
            { key: 'leadCount', label: '新增线索', value: '18' },
            { key: 'customerCount', label: '新增客户', value: '6' },
            { key: 'opportunityAmount', label: '新增商机金额', value: '294 万元' },
            { key: 'contractAmount', label: '签约金额', value: '134 万元' },
            { key: 'receivedAmount', label: '期内回款', value: '50 万元' },
            { key: 'riskCount', label: '风险对象', value: '4' },
          ],
          blocks: [
            {
              blockId: 'overview-funnel',
              blockType: 'funnel',
              title: '线索-客户-商机漏斗',
              description: '统一观察筛选期内线索、客户和商机的承接关系。',
              size: 'wide',
              stages: [
                { label: '线索', value: 18 },
                { label: '客户', value: 6 },
                { label: '商机', value: 5 },
              ],
            },
            {
              blockId: 'overview-consistency',
              blockType: 'insight-table',
              title: '核心口径摘要',
              size: 'compact',
              rows: [
                { label: '口径', value: '期间发生 + 截面混合' },
                { label: '风险对象', value: '4 个' },
              ],
            },
          ],
          footnotes: [],
          sourceNotes: [
            {
              key: 'leadCount',
              label: '新增线索',
              sourceTables: ['leads'],
              sourceFields: ['id', 'created_at'],
              timeField: 'leads.created_at',
              aggregation: 'count',
              description: '统计筛选期内新增线索数。',
            },
          ],
        },
        executiveSummary: {
          sectionKey: 'executive-summary',
          title: '经营摘要',
          summary: '经营摘要用于管理层快速判断本期经营节奏与下一步动作。',
          metricCards: [
            { key: 'receivedAmount', label: '期内回款', value: '50 万元' },
            { key: 'overdueAmount', label: '逾期应收', value: '25 万元' },
            { key: 'leadConversionRate', label: '线索转客户率', value: '50.0%' },
            { key: 'customerActivationRate', label: '客户激活率', value: '66.7%' },
          ],
          blocks: [
            {
              blockId: 'executive-conclusion',
              blockType: 'insight-table',
              title: '一句话经营结论',
              size: 'compact',
              rows: [{ label: '商机', value: '高阶段商机集中在华东销售部。' }],
            },
            {
              blockId: 'executive-actions',
              blockType: 'detail-table',
              title: '本周经营动作',
              size: 'wide',
              columns: [
                { key: 'topic', label: '行动项' },
                { key: 'action', label: '建议' },
              ],
              rows: [{ topic: '收款', action: '优先催收逾期应收金额高的项目。' }],
            },
            {
              blockId: 'executive-risks',
              blockType: 'detail-table',
              title: '核心经营风险',
              size: 'wide',
              columns: [
                { key: 'risk', label: '风险类别' },
                { key: 'value', label: '当前值' },
              ],
              rows: [{ risk: '逾期应收', value: '25 万元' }],
            },
            {
              blockId: 'executive-kpis',
              blockType: 'metric-strip',
              title: '关键经营指标',
              size: 'full',
              items: [
                { label: '线索总数', value: '18' },
                { label: '客户总数', value: '6' },
                { label: '商机总数', value: '5' },
              ],
            },
          ],
          footnotes: [],
          sourceNotes: [
            {
              key: 'receivedAmount',
              label: '期内回款',
              sourceTables: ['received_payments'],
              sourceFields: ['amount', 'receive_date'],
              timeField: 'received_payments.receive_date',
              aggregation: 'sum',
              description: '统计筛选期内实际回款金额。',
            },
          ],
        },
        sections: [
          {
            sectionKey: 'collections',
            title: '收款情况',
            loadMode: 'lazy',
            available: true,
            state: 'ready',
            summary: '统一查看回款、应收状态与逾期项目。',
            timeBasis: '收款按 received_payments.receive_date 统计。',
          },
        ],
      }),
    });
  });

  await page.route('**/api/v1/management-report/sections/collections', async (route) => {
    sectionRequestCount += 1;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        reportId: 'report_q1',
        sectionKey: 'collections',
        generatedAt: '2026-04-24T10:00:00.000Z',
        timeBasis: '收款按 received_payments.receive_date 统计。',
        scopeBasis: '当前展示销售团队授权范围。',
        section: {
          sectionKey: 'collections',
          title: '收款情况',
          summary: '收款专题只使用合同、应收计划和实际回款三类 CRM 口径。',
          metricCards: [],
          blocks: [
            {
              blockId: 'collections-metrics',
              blockType: 'metric-strip',
              title: '收款摘要',
              size: 'full',
              items: [
                { label: '期内回款', value: '126 万元' },
                { label: '逾期应收', value: '21 万元' },
                { label: '计划应收', value: '168 万元' },
              ],
            },
            {
              blockId: 'collections-sales',
              blockType: 'detail-table',
              title: '销售收款情况',
              size: 'wide',
              columns: [
                { key: 'ownerName', label: '销售' },
                { key: 'receivedAmount', label: '期内回款' },
              ],
              rows: Array.from({ length: 18 }, (_, index) => ({
                ownerName: `销售${index + 1}`,
                receivedAmount: `${Number((58 - index * 1.2).toFixed(2)).toLocaleString('zh-CN')} 万元`,
              })),
            },
            {
              blockId: 'collections-city-ranking',
              blockType: 'bar-ranking',
              title: '城市作战图',
              size: 'wide',
              rows: Array.from({ length: 18 }, (_, index) => ({
                label: `城市${index + 1}`,
                value: 2200000 - index * 95000,
                secondaryValue: '保持项目跟进频率',
              })),
            },
            {
              blockId: 'collections-trend',
              blockType: 'trend',
              title: '月度回款趋势',
              size: 'wide',
              points: [
                { label: '2026-01', value: 120000 },
                { label: '2026-02', value: 180000 },
                { label: '2026-03', value: 240000 },
                { label: '2026-04', value: 320000 },
              ],
            },
            {
              blockId: 'collections-status',
              blockType: 'detail-table',
              title: '应收状态',
              size: 'compact',
              columns: [
                { key: 'status', label: '状态' },
                { key: 'amount', label: '金额' },
              ],
              rows: [{ status: '已逾期', amount: '21 万元' }],
            },
            {
              blockId: 'collections-overdue',
              blockType: 'detail-table',
              title: '逾期项目',
              size: 'wide',
              columns: [
                { key: 'customerName', label: '客户' },
                { key: 'amount', label: '逾期金额' },
              ],
              rows: Array.from({ length: 12 }, (_, index) => ({
                customerName: `客户${index + 1}`,
                amount: `${Number((12 - index * 0.35).toFixed(2)).toLocaleString('zh-CN')} 万元`,
              })),
            },
          ],
          footnotes: ['部门归属统一通过合同部门归属做汇总。'],
          sourceNotes: [
            {
              key: 'receivedAmount',
              label: '期内回款',
              sourceTables: ['received_payments'],
              sourceFields: ['amount', 'receive_date'],
              timeField: 'received_payments.receive_date',
              aggregation: 'sum',
              description: '统计筛选期内实际回款金额。',
            },
          ],
        },
      }),
    });
  });

  await page.route('**/api/v1/management-report/export', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        reportId: 'report_q1',
        fileName: '经营报表-2026-01-01-2026-03-31.csv',
        mimeType: 'text/csv;charset=utf-8',
        format: 'csv',
        content: '经营报表,当前值',
      }),
    });
  });

  return {
    getSectionRequestCount: () => sectionRequestCount,
  };
}

test('management report should render thick first-screen sections, lazy-load blocks and call export', async ({
  page,
}) => {
  const requestTracker = await mockAuthenticatedManagementReport(page);
  await page.goto('/management-report');

  await expect(page.getByRole('heading', { name: '经营报表' })).toBeVisible();
  await expect(page.getByText('经营驾驶舱')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '总览' })).toBeVisible();
  await expect(page.getByText('线索-客户-商机漏斗')).toBeVisible();
  await expect(page.getByText('一句话经营结论')).toHaveCount(0);
  expect(requestTracker.getSectionRequestCount()).toBe(0);

  const overviewMetricBlock = page
    .locator('.management-section-canvas__block')
    .filter({ has: page.getByRole('heading', { name: '核心指标' }) });
  const overviewFunnelBlock = page
    .locator('.management-section-canvas__block')
    .filter({ has: page.getByRole('heading', { name: '线索-客户-商机漏斗' }) });
  const [overviewMetricBox, overviewFunnelBox] = await Promise.all([
    overviewMetricBlock.boundingBox(),
    overviewFunnelBlock.boundingBox(),
  ]);

  expect((overviewFunnelBox?.height ?? 0) - (overviewMetricBox?.height ?? 0)).toBeGreaterThan(80);

  const refreshButton = page.getByRole('button', { name: '查询' });
  const exportButton = page.getByRole('button', { name: '导出报表' });
  await expect(refreshButton).toBeVisible();
  await expect(exportButton).toBeVisible();

  await page.getByRole('button', { name: '经营摘要' }).click();
  await expect(page.getByText('一句话经营结论')).toBeVisible();
  await expect(page.getByText('本周经营动作')).toBeVisible();
  await expect(page.getByText('关键经营指标')).toBeVisible();
  await expect(page.getByText('线索-客户-商机漏斗')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '查看口径' })).toBeVisible();
  await expect(page.getByText('统计筛选期内实际回款金额。')).toBeHidden();

  const executiveMetricBlock = page
    .locator('.management-section-canvas__block')
    .filter({ has: page.getByRole('heading', { name: '关键经营指标' }) });
  const executiveActionBlock = page
    .locator('.management-section-canvas__block')
    .filter({ has: page.getByRole('heading', { name: '本周经营动作' }) });
  const [executiveMetricBox, executiveActionBox] = await Promise.all([
    executiveMetricBlock.boundingBox(),
    executiveActionBlock.boundingBox(),
  ]);

  expect((executiveActionBox?.height ?? 0) - (executiveMetricBox?.height ?? 0)).toBeGreaterThan(80);

  const sectionRequest = page.waitForRequest('**/api/v1/management-report/sections/collections');
  await page.getByRole('button', { name: /收款情况/ }).click();
  await sectionRequest;
  expect(requestTracker.getSectionRequestCount()).toBe(1);

  await expect(page.getByRole('heading', { name: '收款摘要' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '销售收款情况' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '城市作战图' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '月度回款趋势' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '应收状态' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '逾期项目' })).toBeVisible();

  const collectionMetricBlock = page
    .locator('.management-section-canvas__block')
    .filter({ has: page.getByRole('heading', { name: '收款摘要' }) });

  const salesBlock = page
    .locator('.management-section-canvas__block')
    .filter({ has: page.getByRole('heading', { name: '销售收款情况' }) });
  const rankingBlock = page
    .locator('.management-section-canvas__block')
    .filter({ has: page.getByRole('heading', { name: '城市作战图' }) });
  const salesScroll = salesBlock.locator('.detail-table-block__scroll');
  const rankingScroll = rankingBlock.locator('.bar-ranking-block__rows');

  const [collectionMetricBox, salesBox, rankingBox, salesScrollMetrics, rankingScrollMetrics] = await Promise.all([
    collectionMetricBlock.boundingBox(),
    salesBlock.boundingBox(),
    rankingBlock.boundingBox(),
    salesScroll.evaluate((node) => {
      const style = window.getComputedStyle(node);

      return {
        overflowY: style.overflowY,
        clientHeight: node.clientHeight,
        scrollHeight: node.scrollHeight,
      };
    }),
    rankingScroll.evaluate((node) => {
      const style = window.getComputedStyle(node);

      return {
        overflowY: style.overflowY,
        clientHeight: node.clientHeight,
        scrollHeight: node.scrollHeight,
      };
    }),
  ]);

  expect((salesBox?.height ?? 0) - (collectionMetricBox?.height ?? 0)).toBeGreaterThan(80);
  expect(salesBox?.y).toBe(rankingBox?.y);
  expect(Math.abs((salesBox?.height ?? 0) - (rankingBox?.height ?? 0))).toBeLessThanOrEqual(4);
  expect(salesScrollMetrics.overflowY).toBe('auto');
  expect(salesScrollMetrics.scrollHeight).toBeGreaterThan(salesScrollMetrics.clientHeight);
  expect(rankingScrollMetrics.overflowY).toBe('auto');
  expect(rankingScrollMetrics.scrollHeight).toBeGreaterThan(rankingScrollMetrics.clientHeight);

  const exportRequest = page.waitForRequest('**/api/v1/management-report/export');
  await exportButton.click();
  await exportRequest;
});

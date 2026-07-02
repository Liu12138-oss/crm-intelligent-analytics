import { test, expect, type Page } from '@playwright/test';

async function mockWorkbenchBootstrap(page: Page) {
  await page.route('**/api/v1/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        sessionId: 'auth_session_001',
        source: 'password-login',
        expiresAt: '2026-03-26T10:00:00.000Z',
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
        scopeSummary: '当前账号仅可查看 销售总监 所授权的数据。',
        roleNames: ['销售总监'],
        channels: ['web-console'],
        domains: ['opportunity-analysis', 'contract-conversion', 'customer-relationship'],
        metrics: ['新增商机金额', '商机数量', '赢单率'],
        dimensions: ['销售负责人', '区域', '月份'],
        exportAllowed: true,
        exportRowLimit: 1000,
        exportDailyLimit: 3,
        remainingDailyExports: 3,
        historyEnabled: true,
        templateCount: 2,
        templateViewAllowed: true,
        dataFreshnessAt: '2026-03-24T09:00:00.000Z',
        visibleMenus: ['analysis-workbench', 'contract-review'],
        actionKeys: ['analysis.use', 'analysis.export', 'template.view'],
        wecomBotAccessState: 'ALLOWED',
        contractPermissions: {
          uploadAllowed: true,
          crossViewAllowed: false,
          crossDownloadAllowed: false,
        },
      }),
    });
  });

  await page.route('**/api/v1/analysis/templates**', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (/\/api\/v1\/analysis\/templates\/[^/]+$/.test(requestUrl.pathname)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          templateId: 'tpl_owner_ranking',
          name: '负责人新增商机排名',
          description: '查看本月销售负责人新增商机金额排名。',
          defaultQuestionText: '本月各销售负责人新增商机金额排名',
          defaultFilters: {},
          tags: ['内置模板', '常用查询', '负责人', '排名'],
          ownerUserId: 'user_sales_director',
          ownerName: '张琳',
          defaultViewType: 'TABLE',
          sqlText: 'SELECT owner_name, SUM(amount) FROM opportunities GROUP BY owner_name',
          visibleRoleIds: ['role_sales_director'],
          displayOrder: 1,
          clickCount7d: 10,
          usageCountTotal: 10,
          hitRatePercent: 95,
          optimizationStatus: 'HEALTHY',
          status: 'ACTIVE',
          updatedAt: '2026-03-24T09:00:00.000Z',
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        page: 1,
        pageSize: 20,
        total: 1,
        tags: ['负责人', '排名'],
        items: [
          {
            templateId: 'tpl_owner_ranking',
            name: '负责人新增商机排名长标题验证右侧图标按钮不会遮挡列表文字内容',
            description: '查看本月销售负责人新增商机金额排名。',
            defaultQuestionText: '本月各销售负责人新增商机金额排名',
            defaultFilters: {},
            tags: ['内置模板', '常用查询', '负责人', '排名'],
            ownerUserId: 'user_sales_director',
            ownerName: '张琳',
            visibleRoleIds: ['role_sales_director'],
            displayOrder: 1,
            clickCount7d: 10,
            usageCountTotal: 10,
            hitRatePercent: 95,
            optimizationStatus: 'HEALTHY',
            status: 'ACTIVE',
            updatedAt: '2026-03-24T09:00:00.000Z',
          },
        ],
      }),
    });
  });

  await page.route('**/api/v1/analysis/histories?page=1&pageSize=10', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            historyId: 'history_001',
            questionText: '上月合同金额趋势',
            lastUsedChannel: 'web-console',
            resultSummary: '共命中 3 个时间分组。',
            status: 'SUCCEEDED',
            lastUsedAt: '2026-03-24T09:00:00.000Z',
          },
        ],
        page: 1,
        pageSize: 10,
        total: 1,
      }),
    });
  });
}

async function mockUnauthenticatedSession(page: Page) {
  await page.route('**/api/v1/auth/session', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'text/plain',
      body: '当前未登录。',
    });
  });
}

test('analysis workbench should render query box and show common queries directly on the page', async ({ page }) => {
  await mockWorkbenchBootstrap(page);
  await page.setViewportSize({ width: 900, height: 800 });
  await page.goto('/analysis');

  const input = page.locator('.search-region__textarea textarea');
  const recentDrawerButton = page.getByRole('button', { name: '最近查询', exact: true });
  const recentDrawer = page.getByRole('dialog', { name: '最近查询抽屉' });
  const mainColumn = page.locator('.analysis-main-column');
  const pageCommonPanel = page.locator('.analysis-common-sidebar .common-query-panel');

  await expect(page.getByRole('heading', { name: '智能分析' })).toBeVisible();
  await expect(input).toBeVisible();
  await expect(page.getByRole('button', { name: '常用查询', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '查看常用查询', exact: true })).toHaveCount(0);
  await expect(recentDrawerButton).toBeVisible();
  await expect(pageCommonPanel).toBeVisible();
  await expect(pageCommonPanel.getByText('负责人新增商机排名长标题验证右侧图标按钮不会遮挡列表文字内容')).toBeVisible();
  await expect(page.getByText('权限与执行状态')).toHaveCount(0);
  await expect(page.getByText('结果入口：')).toHaveCount(0);
  await expect(page.locator('.page__eyebrow')).toHaveCount(0);
  await expect(page.locator('.page__description')).toHaveCount(0);
  await expect(page.locator('.section-eyebrow')).toHaveCount(0);
  await expect(page.locator('.search-region__subtitle')).toHaveCount(0);
  await expect(page.locator('.result-region__subtitle')).toHaveCount(0);
  await expect(mainColumn.getByRole('heading', { name: '查询资产', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '复用入口摘要', exact: true })).toHaveCount(0);
  await expect(mainColumn.getByRole('heading', { name: '常用查询', exact: true })).toHaveCount(0);
  await expect(mainColumn.getByRole('heading', { name: '最近查询', exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: '常用查询抽屉' })).toHaveCount(0);
  await expect(pageCommonPanel).toBeVisible();
  await expect(pageCommonPanel.getByText('主分类')).toHaveCount(0);

  await recentDrawerButton.click();
  await expect(recentDrawer).toBeVisible();
  await expect(page.locator('.analysis-assets-drawer .el-drawer__title').filter({ hasText: '最近查询' })).toBeVisible();
});

test('common query panel should keep icon actions compact and show template SQL detail', async ({ page }) => {
  await mockWorkbenchBootstrap(page);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/analysis');

  const sidebarToggle = page.getByRole('button', { name: '收起常用查询' });
  await expect(sidebarToggle).toBeVisible();

  const toggleMetrics = await page.evaluate(() => {
    const layout = document.querySelector('.analysis-layout--with-assets');
    const sidebar = document.querySelector('.analysis-common-sidebar');
    const toggle = document.querySelector('.analysis-common-sidebar__toggle');
    const main = document.querySelector('.analysis-main-column');
    if (
      !(layout instanceof HTMLElement) ||
      !(sidebar instanceof HTMLElement) ||
      !(toggle instanceof HTMLElement) ||
      !(main instanceof HTMLElement)
    ) {
      return null;
    }

    const sidebarRect = sidebar.getBoundingClientRect();
    const toggleRect = toggle.getBoundingClientRect();
    const mainRect = main.getBoundingClientRect();

    return {
      layoutGap: Number.parseFloat(window.getComputedStyle(layout).columnGap),
      toggleWidth: toggleRect.width,
      toggleHeight: toggleRect.height,
      borderTopLeftRadius: window.getComputedStyle(toggle).borderTopLeftRadius,
      borderTopRightRadius: window.getComputedStyle(toggle).borderTopRightRadius,
      borderBottomLeftRadius: window.getComputedStyle(toggle).borderBottomLeftRadius,
      borderBottomRightRadius: window.getComputedStyle(toggle).borderBottomRightRadius,
      leftDelta: Math.abs(toggleRect.left - sidebarRect.right),
      rightDelta: Math.abs(toggleRect.right - mainRect.left),
    };
  });

  expect(toggleMetrics).toEqual(
    expect.objectContaining({
      layoutGap: 18,
      toggleWidth: 18,
      toggleHeight: 46,
      borderTopLeftRadius: '8px',
      borderTopRightRadius: '0px',
      borderBottomLeftRadius: '8px',
      borderBottomRightRadius: '0px',
      leftDelta: 0,
      rightDelta: 0,
    }),
  );

  await sidebarToggle.click();
  await expect(page.getByRole('button', { name: '展开常用查询' })).toBeVisible();
  await page.getByRole('button', { name: '展开常用查询' }).click();

  const templateCard = page.locator('.common-query-card').first();
  const templateTags = templateCard.locator('.common-query-card__tags');
  await expect(templateCard).toBeVisible();
  await expect(templateCard.getByText('张琳')).toBeVisible();
  await expect(templateTags.getByText('负责人', { exact: true })).toBeVisible();
  await expect(templateTags.getByText('排名', { exact: true })).toBeVisible();
  await expect(templateCard.getByText('内置模板')).toHaveCount(0);
  await expect(templateCard.getByText('常用查询')).toHaveCount(0);

  const layoutMetrics = await templateCard.evaluate((element) => {
    const actions = element.querySelector('.common-query-card__actions');
    const title = element.querySelector('h4');
    const meta = element.querySelector('.common-query-card__meta');
    const identityRow = element.querySelector('.common-query-card__identity-row');
    const owner = element.querySelector('.common-query-card__owner');
    const tags = element.querySelector('.common-query-card__tags');
    const buttons = [...element.querySelectorAll('.el-button')];
    const cardRect = element.getBoundingClientRect();
    const actionsRect = actions?.getBoundingClientRect();
    const titleRect = title?.getBoundingClientRect();
    const metaRect = meta?.getBoundingClientRect();
    const identityRowRect = identityRow?.getBoundingClientRect();
    const ownerRect = owner?.getBoundingClientRect();
    const tagsRect = tags?.getBoundingClientRect();
    const buttonStyles = buttons.map((button) => {
      const style = window.getComputedStyle(button);
      const rect = button.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        borderTopWidth: style.borderTopWidth,
        backgroundColor: style.backgroundColor,
        boxShadow: style.boxShadow,
        marginLeft: style.marginLeft,
      };
    });

    return {
      cardContainsMeta: Boolean(metaRect) && metaRect!.bottom <= cardRect.bottom,
      identityOneLine:
        Boolean(identityRowRect && ownerRect && tagsRect) &&
        Math.abs(ownerRect!.top - tagsRect!.top) <= 1 &&
        Math.abs(ownerRect!.bottom - tagsRect!.bottom) <= 4,
      actionCenterDelta: actionsRect
        ? Math.abs((actionsRect.top + actionsRect.height / 2) - (cardRect.top + cardRect.height / 2))
        : 999,
      flexValue: window.getComputedStyle(element).flex,
      overlapsActions:
        Boolean(titleRect && actionsRect) &&
        titleRect!.right > actionsRect!.left &&
        titleRect!.top < actionsRect!.bottom,
      identityOverlapsActions:
        Boolean(identityRowRect && actionsRect) &&
        identityRowRect!.right > actionsRect!.left &&
        identityRowRect!.top < actionsRect!.bottom,
      actionGap: actions ? window.getComputedStyle(actions).gap : '',
      buttonStyles,
    };
  });

  expect(layoutMetrics.flexValue).toBe('0 0 auto');
  expect(layoutMetrics.cardContainsMeta).toBe(true);
  expect(layoutMetrics.identityOneLine).toBe(true);
  expect(layoutMetrics.actionCenterDelta).toBeLessThanOrEqual(1);
  expect(layoutMetrics.overlapsActions).toBe(false);
  expect(layoutMetrics.identityOverlapsActions).toBe(false);
  expect(layoutMetrics.actionGap).toBe('8px');
  expect(
    layoutMetrics.buttonStyles.every(
      (button) =>
        button.width === 18 &&
        button.height === 18 &&
        button.borderTopWidth === '0px' &&
        button.backgroundColor === 'rgba(0, 0, 0, 0)' &&
        button.boxShadow === 'none' &&
        button.marginLeft === '0px',
    ),
  ).toBe(true);

  await page.getByRole('button', { name: '查看模板内容' }).first().click();

  await expect(page.getByRole('dialog', { name: '模板内容抽屉' })).toBeVisible();
  await expect(page.getByText('查询 SQL')).toBeVisible();
  await expect(page.getByText('SELECT owner_name, SUM(amount) FROM opportunities')).toBeVisible();
});

test('analysis workbench should highlight results and detailed stream blocks', async ({ page }) => {
  await mockWorkbenchBootstrap(page);
  await page.route('**/api/v1/analysis/queries', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        queryId: 'query_demo',
        status: 'RETURNED',
        createdAt: '2026-03-25T05:00:00.000Z',
      }),
    });
  });
  await page.route('**/api/v1/analysis/queries/query_demo', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        queryId: 'query_demo',
        status: 'RETURNED',
        title: '销售负责人新增商机金额排名',
        summary: '在当前授权范围内，共命中 2 条记录，形成 2 个分析分组。',
        report: {
          variant: 'ranking',
          reportTitle: '新增商机金额排名报告',
          executiveSummary: '在当前授权范围内，共命中 2 条记录，形成 2 个分析分组。',
          analysisConfidence: 'MEDIUM',
          trendInsight: {
            status: 'READY',
            direction: 'UP',
            drivers: ['近四期趋势延续'],
            summary: '整体趋势上行。',
          },
          forecastInsight: {
            status: 'READY',
            horizonLabel: '下一周期',
            predictedValue: 760000,
            predictedRangeLow: 720000,
            predictedRangeHigh: 800000,
            confidenceLevel: 'MEDIUM',
            drivers: ['近四期趋势延续'],
            caveats: ['当前预测仅供短期参考。'],
            summary: '预计下一周期大概率落在 720000 到 800000 之间。',
          },
          anomalyInsights: [],
          riskInsights: [],
          recommendations: [
            {
              priority: 'HIGH',
              title: '提前排布头部项目推进',
              action: '提前锁定头部项目推进节奏。',
              reason: '趋势继续上行。',
              evidenceKeys: ['forecast-range'],
            },
          ],
          keyFindings: [
            {
              title: '关键发现 1',
              detail: '王敏在当前授权范围内排名第一。',
              tone: 'positive',
              datasetId: 'dataset_001',
            },
          ],
          metricCards: [
            { name: '新增商机金额', value: '1,270,000' },
            { name: '记录数', value: 2 },
            { name: '分组数量', value: 2 },
          ],
          chartBlocks: [
            {
              blockId: 'chart_001',
              title: '负责人新增商机金额对比',
              viewType: 'BAR_CHART',
              series: [
                { label: '王敏', value: 730000 },
                { label: '李浩', value: 540000 },
              ],
              datasetId: 'dataset_001',
            },
          ],
          tableBlocks: [
            {
              blockId: 'table_001',
              title: '新增商机金额明细',
              rows: [
                { ownerId: 'owner_wang', ownerName: '王敏', amount: 730000, count: 1 },
                { ownerId: 'owner_li', ownerName: '李浩', amount: 540000, count: 1 },
              ],
              datasetId: 'dataset_001',
            },
          ],
          datasetReferences: [
            {
              datasetId: 'dataset_001',
              taskId: 'task_001',
              taskTitle: '新增商机金额排名',
              purpose: 'primary-summary',
              rowCount: 2,
            },
          ],
          scopeSummary: '当前仅展示销售总监角色可访问的组织与部门范围。',
          appliedFilters: [],
          explanation: '当前结果基于统一数据集生成。',
          detailMarkdown:
            '## 执行摘要\n在当前授权范围内，共命中 2 条记录，形成 2 个分析分组。\n## 趋势预测\n预计下一周期大概率落在 720000 到 800000 之间。\n## 经营建议\n- 提前排布头部项目推进：提前锁定头部项目推进节奏。',
          availableActions: [{ actionType: 'EXPORT', enabled: true }],
        },
        keyFindings: [
          {
            title: '关键发现 1',
            detail: '王敏在当前授权范围内排名第一。',
            tone: 'positive',
            datasetId: 'dataset_001',
          },
        ],
        scopeSummary: '当前仅展示销售总监角色可访问的组织与部门范围。',
        metricCards: [
          { name: '新增商机金额', value: '1,270,000' },
          { name: '记录数', value: 2 },
          { name: '分组数量', value: 2 },
        ],
        primaryView: {
          viewType: 'BAR_CHART',
          title: '负责人新增商机金额对比',
          series: [
            { label: '王敏', value: 730000 },
            { label: '李浩', value: 540000 },
          ],
        },
        tableRows: [
          { ownerId: 'owner_wang', ownerName: '王敏', amount: 730000, count: 1 },
          { ownerId: 'owner_li', ownerName: '李浩', amount: 540000, count: 1 },
        ],
        streamBlocks: [
          { sequence: 0, blockType: 'PROCESSING_NOTICE', content: '已识别问题：本月各销售负责人新增商机金额排名' },
          { sequence: 1, blockType: 'EXPLANATION', content: '已完成查询计划编译：opportunity-analysis / owner-ranking' },
          { sequence: 2, blockType: 'EXPLANATION', content: '已完成 SQL 只读校验与白名单校验' },
          { sequence: 3, blockType: 'SUMMARY', content: '在当前授权范围内，共命中 2 条记录，形成 2 个分析分组。' },
          { sequence: 4, blockType: 'TABLE_SEGMENT', content: '结果预览：王敏：730000；李浩：540000' },
          { sequence: 5, blockType: 'COMPLETE', content: '结果已完成整理，并通过只读、权限和一致性校验。' },
        ],
        dataFreshnessAt: '2026-03-24T09:00:00.000Z',
        explanation: '当前结果基于受控只读查询生成，摘要、图表、表格与导出共享同一一致性标识。',
      }),
    });
  });

  await page.goto('/analysis');
  await page.locator('.search-region__textarea textarea').fill('本月各销售负责人新增商机金额排名');
  await page.getByRole('button', { name: '开始分析' }).click();

  await expect(page.getByRole('heading', { name: '新增商机金额排名报告' })).toBeVisible();
  await expect(page.getByText('新增商机金额排名报告')).toBeVisible();
  await expect(page.getByText('关键发现 1')).toBeVisible();
  await expect(page.getByText('新增商机金额明细')).toBeVisible();
  await expect(page.getByText('趋势预测')).toBeVisible();
  await expect(page.getByText('经营建议')).toBeVisible();
  await expect(page.getByRole('button', { name: '查看详情' })).toBeVisible();
});

test('analysis workbench should show friendly hint for out-of-scope question', async ({ page }) => {
  await mockWorkbenchBootstrap(page);
  await page.route('**/api/v1/analysis/queries', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        queryId: 'query_blocked',
        status: 'BLOCKED',
        clarificationPrompt: '当前仅支持 CRM 智能分析相关问题，请改为商机、合同、客户等经营分析问题。',
        createdAt: '2026-03-25T05:00:00.000Z',
      }),
    });
  });

  await page.goto('/analysis');
  await page.locator('.search-region__textarea textarea').fill('今天天气怎么样');
  await page.getByRole('button', { name: '开始分析' }).click();

  await expect(page.getByText('当前仅支持 CRM 智能分析相关问题')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'AI 分析报告' })).toBeVisible();
});

test('analysis result detail should show grounded insight and execution snapshot', async ({ page }) => {
  await mockWorkbenchBootstrap(page);
  await page.route('**/api/v1/analysis/queries/query_grounded', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        queryId: 'query_grounded',
        status: 'RETURNED',
        title: '新增商机金额排名报告',
        summary: '测试摘要',
        scopeSummary: '测试权限',
        groundedExplanation: '仅基于本次结果包可确认：王敏暂列第一。',
        nextBestQuestions: ['继续按月份看趋势变化'],
        executionMode: 'GUARDED_DIRECT_QUERY',
        executionSource: 'GUARDED_READONLY_SQL',
        matchedAdapter: 'guarded-readonly-sql.aggregate-query',
        gapReason: '官方 API 暂不覆盖当前聚合维度。',
        executionSnapshot: {
          taskSnapshots: [
            {
              timeoutMs: 3000,
            },
          ],
        },
        appliedFilters: [],
        metricCards: [],
        tableRows: [],
        streamBlocks: [
          { sequence: 0, blockType: 'PROCESSING_NOTICE', content: '已进入受控查询。' },
        ],
        availableActions: [{ actionType: 'EXPORT', enabled: true }],
      }),
    });
  });

  await page.goto('/analysis/results/query_grounded');

  await expect(page.locator('.page__eyebrow')).toHaveCount(0);
  await expect(page.locator('.page__description')).toHaveCount(0);
  await expect(page.getByText('返回工作台')).toHaveCount(0);
  await expect(page.getByText('查询 ID：query_grounded')).toHaveCount(0);
  await expect(page.getByText('仅基于本次结果包可确认')).toBeVisible();
  await expect(page.getByRole('button', { name: '继续按月份看趋势变化' })).toBeVisible();
  await expect(page.getByText('执行模式：受控直查')).toBeVisible();
  await expect(page.getByText('执行来源：受控只读 SQL')).toBeVisible();
  await expect(page.getByText('处理提示')).toBeVisible();
  await expect(page.getByText('导出结果')).toBeVisible();
  await expect(page.getByText('GUARDED_DIRECT_QUERY')).not.toBeVisible();
  await expect(page.getByText('GUARDED_READONLY_SQL')).not.toBeVisible();
  await expect(page.getByText('PROCESSING_NOTICE')).not.toBeVisible();
  await expect(page.getByText('EXPORT')).not.toBeVisible();
  await expect(page.getByText('命中适配器：guarded-readonly-sql.aggregate-query')).toBeVisible();
});

test('protected analysis route should redirect to login when session is missing', async ({ page }) => {
  await mockUnauthenticatedSession(page);

  await page.goto('/analysis');

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: '登录 CRM 智能业务平台' })).toBeVisible();
});

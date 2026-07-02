import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { analysisService } from '@/services/analysis.service';
import { triggerBrowserDownload } from '@/utils/browser-download';
import { useAuthStore } from '@/stores/auth.store';
import { useAnalysisQueryStore } from '@/stores/analysis-query.store';

vi.mock('@/utils/browser-download', () => ({
  triggerBrowserDownload: vi.fn(),
}));

describe('analysis query store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());

    const authStore = useAuthStore();
    authStore.session = {
      authenticated: true,
      sessionId: 'auth_session_analysis_bootstrap',
      source: 'password-login',
      expiresAt: '2026-03-24T09:00:00.000Z',
      user: {
        id: 'user_sales_director',
        name: '销售总监',
        roleNames: ['销售总监'],
        channels: ['web-console'],
        organizationIds: ['org_north'],
        departmentIds: ['dept_sales'],
      },
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('bootstrap 应拉取能力、模板和历史记录', async () => {
    vi.spyOn(analysisService, 'getCapabilities').mockResolvedValue({
      serviceStatus: 'ONLINE',
      scopeSummary: '测试范围',
      roleNames: ['销售总监'],
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
      dataFreshnessAt: '2026-03-24T09:00:00.000Z',
      visibleMenus: ['analysis-workbench', 'contract-review'],
      actionKeys: ['analysis.use', 'analysis.export'],
      followUpAllowed: true,
      templateViewAllowed: true,
      contractWorkspaceAllowed: true,
      wecomBotAccessState: 'ALLOWED',
      queryAssetSummary: {
        timeSlot: 'MONTH_END',
        recommendedTemplates: [
          {
            templateId: 'tpl_001',
            name: '模板A',
            description: '说明',
            recommendationReason: '临近月底，猜你会先看这个',
          },
        ],
      },
      contractPermissions: {
        uploadAllowed: true,
        crossViewAllowed: false,
        crossDownloadAllowed: false,
      },
    });
    vi.spyOn(analysisService, 'listTemplates').mockResolvedValue({
      items: [
        {
          templateId: 'tpl_001',
          name: '模板A',
          description: '说明',
          defaultQuestionText: '本月各销售负责人新增商机金额排名',
          defaultFilters: {},
          queryMode: 'FIXED_SQL',
          sqlVersion: '2026.05.11',
          renderConfig: {
            primaryViewType: 'RANKING_TABLE',
            primaryTitle: '负责人新增商机金额排名',
          },
          recommendationReason: '临近月底，猜你会先看这个',
          visibleRoleIds: ['role_sales_director'],
          displayOrder: 1,
          clickCount7d: 10,
          hitRatePercent: 90,
          optimizationStatus: 'HEALTHY',
          status: 'ACTIVE',
          updatedAt: '2026-03-24T09:00:00.000Z',
        },
      ],
    });
    vi.spyOn(analysisService, 'listRecentQueries').mockResolvedValue({
      items: [
        {
          historyId: 'history_001',
          questionText: '本月新增商机金额排名',
          lastUsedChannel: 'web-console',
          sourceType: 'TEMPLATE_QUERY',
          renderSnapshot: {
            primaryViewType: 'RANKING_TABLE',
            primaryTitle: '负责人新增商机金额排名',
          },
          resultSummary: '测试摘要',
          status: 'SUCCEEDED',
          lastUsedAt: '2026-03-24T09:00:00.000Z',
        },
      ],
      page: 1,
      pageSize: 10,
      total: 1,
    });

    const store = useAnalysisQueryStore();
    await store.bootstrap();

    expect(store.capabilities?.scopeSummary).toBe('测试范围');
    expect(
      store.capabilities?.queryAssetSummary?.recommendedTemplates[0]?.recommendationReason,
    ).toContain('月底');
    expect(store.templates).toHaveLength(1);
    expect(store.histories).toHaveLength(1);
    expect(store.templates[0]?.queryMode).toBe('FIXED_SQL');
    expect(store.histories[0]?.sourceType).toBe('TEMPLATE_QUERY');
  });

  it('重复 bootstrap 时应优先复用已初始化结果', async () => {
    vi.spyOn(analysisService, 'getCapabilities').mockResolvedValue({
      serviceStatus: 'ONLINE',
      scopeSummary: '测试范围',
      roleNames: ['销售总监'],
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
      dataFreshnessAt: '2026-03-24T09:00:00.000Z',
      visibleMenus: ['analysis-workbench'],
      actionKeys: ['analysis.use'],
      followUpAllowed: true,
      templateViewAllowed: true,
      contractWorkspaceAllowed: true,
      wecomBotAccessState: 'ALLOWED',
      contractPermissions: {
        uploadAllowed: true,
        crossViewAllowed: false,
        crossDownloadAllowed: false,
      },
    });
    vi.spyOn(analysisService, 'listTemplates').mockResolvedValue({
      items: [],
    });
    vi.spyOn(analysisService, 'listRecentQueries').mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
    });

    const store = useAnalysisQueryStore();
    await store.bootstrap();
    await store.bootstrap();

    expect(analysisService.getCapabilities).toHaveBeenCalledTimes(1);
    expect(analysisService.listTemplates).toHaveBeenCalledTimes(1);
    expect(analysisService.listRecentQueries).toHaveBeenCalledTimes(1);
  });

  it('空白问题提交时应给出提示并阻止请求', async () => {
    const createQuerySpy = vi.spyOn(analysisService, 'createQuery');
    const store = useAnalysisQueryStore();

    await store.submitQuery('   ');

    expect(createQuerySpy).not.toHaveBeenCalled();
    expect(store.feedbackMessage).toContain('请输入要分析的 CRM 问题');
    expect(store.feedbackTone).toBe('warning');
  });

  it('被拦截的问题应清空旧结果并展示错误反馈', async () => {
    vi.spyOn(analysisService, 'createQuery').mockResolvedValue({
      queryId: 'query_blocked',
      status: 'BLOCKED',
      clarificationPrompt: '当前仅支持 CRM 智能分析相关问题。',
    });

    const store = useAnalysisQueryStore();
    store.currentResult = {
      queryId: 'query_old',
      status: 'RETURNED',
      title: '旧结果',
      summary: '旧摘要',
    };

    await store.submitQuery('今天天气怎么样');

    expect(store.currentResult?.status).toBe('BLOCKED');
    expect(store.viewState).toBe('blocked');
    expect(store.feedbackTone).toBe('error');
    expect(store.feedbackMessage).toContain('CRM 智能分析');
  });

  it('成功返回报告后应进入 reported 状态', async () => {
    vi.spyOn(analysisService, 'createQuery').mockResolvedValue({
      queryId: 'query_reported',
      status: 'RETURNED',
    });
    vi.spyOn(analysisService, 'getQuery').mockResolvedValue({
      queryId: 'query_reported',
      status: 'RETURNED',
      title: '新增商机金额排名报告',
      summary: '测试摘要',
      report: {
        variant: 'ranking',
        reportTitle: '新增商机金额排名报告',
        executiveSummary: '测试摘要',
        keyFindings: [],
        metricCards: [{ name: '新增商机金额', value: '1,270,000' }],
        chartBlocks: [],
        tableBlocks: [],
        sections: [],
        datasetReferences: [],
        scopeSummary: '测试范围',
        appliedFilters: [],
        availableActions: [],
      },
    });
    vi.spyOn(analysisService, 'listRecentQueries').mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
    });

    const store = useAnalysisQueryStore();
    await store.submitQuery('本月各销售负责人新增商机金额排名');

    expect(store.viewState).toBe('reported');
    expect(store.currentResult?.report?.reportTitle).toContain('报告');
    expect(store.feedbackTone).toBe('success');
  });

  it('首页追问应沿用当前结果 queryId 并刷新为追问后的结果', async () => {
    vi.spyOn(analysisService, 'createQuery').mockResolvedValue({
      queryId: 'query_follow_up',
      status: 'RETURNED',
    });
    vi.spyOn(analysisService, 'getQuery').mockResolvedValue({
      queryId: 'query_follow_up',
      status: 'RETURNED',
      title: '近三个月趋势追问结果',
      summary: '已按近三个月重新生成趋势结果。',
      report: {
        variant: 'trend',
        reportTitle: '近三个月趋势追问结果',
        executiveSummary: '已按近三个月重新生成趋势结果。',
        keyFindings: [],
        metricCards: [],
        chartBlocks: [],
        tableBlocks: [],
        sections: [],
        datasetReferences: [],
        scopeSummary: '测试范围',
        appliedFilters: [],
        availableActions: [],
      },
    });
    vi.spyOn(analysisService, 'listRecentQueries').mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
    });

    const store = useAnalysisQueryStore();
    store.currentResult = {
      queryId: 'query_source',
      status: 'RETURNED',
      title: '原始结果',
      summary: '原始摘要',
    };
    store.viewState = 'reported';
    store.followUpText = '把时间范围改成近三个月';

    await store.submitFollowUp();

    expect(analysisService.createQuery).toHaveBeenCalledWith({
      querySource: 'FREE_TEXT',
      channel: 'web-console',
      questionText: '把时间范围改成近三个月',
      followUpQueryId: 'query_source',
    });
    expect(store.currentResult?.queryId).toBe('query_follow_up');
    expect(store.followUpText).toBe('');
    expect(store.viewState).toBe('reported');
  });

  it('首页追问请求进行中应保留第一次查询结果和 reported 状态', async () => {
    let resolveCreateQuery:
      | ((value: { queryId: string; status: 'RETURNED' }) => void)
      | undefined;
    const createQueryPromise = new Promise<{ queryId: string; status: 'RETURNED' }>(
      (resolve) => {
        resolveCreateQuery = resolve;
      },
    );
    vi.spyOn(analysisService, 'createQuery').mockReturnValue(createQueryPromise);
    vi.spyOn(analysisService, 'getQuery').mockResolvedValue({
      queryId: 'query_follow_up',
      status: 'RETURNED',
      title: '追问后的结果',
      summary: '追问后的摘要',
    });
    vi.spyOn(analysisService, 'listRecentQueries').mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
    });

    const store = useAnalysisQueryStore();
    store.currentResult = {
      queryId: 'query_source',
      status: 'RETURNED',
      title: '原始结果',
      summary: '原始摘要',
    };
    store.viewState = 'reported';
    store.followUpText = '把时间范围改成近三个月';

    const submitPromise = store.submitFollowUp();
    await Promise.resolve();

    expect(store.isSubmittingFollowUp).toBe(true);
    expect(store.viewState).toBe('reported');
    expect(store.currentResult?.queryId).toBe('query_source');
    expect(store.currentResult?.summary).toBe('原始摘要');

    resolveCreateQuery?.({ queryId: 'query_follow_up', status: 'RETURNED' });
    await submitPromise;

    expect(store.currentResult?.queryId).toBe('query_follow_up');
    expect(store.viewState).toBe('reported');
  });

  it('首页追问被拦截时应保留第一次查询结果', async () => {
    vi.spyOn(analysisService, 'createQuery').mockResolvedValue({
      queryId: 'query_follow_up_blocked',
      status: 'BLOCKED',
      clarificationPrompt: '追问包含不支持的操作，请调整查询条件后重试。',
    });

    const store = useAnalysisQueryStore();
    store.currentResult = {
      queryId: 'query_source',
      status: 'RETURNED',
      title: '原始结果',
      summary: '原始摘要',
    };
    store.viewState = 'reported';
    store.followUpText = '请把实际改成一月份';

    await store.submitFollowUp();

    expect(analysisService.createQuery).toHaveBeenCalledWith({
      querySource: 'FREE_TEXT',
      channel: 'web-console',
      questionText: '请把实际改成一月份',
      followUpQueryId: 'query_source',
    });
    expect(store.currentResult?.queryId).toBe('query_source');
    expect(store.currentResult?.summary).toBe('原始摘要');
    expect(store.viewState).toBe('reported');
    expect(store.feedbackTone).toBe('error');
    expect(store.feedbackMessage).toContain('不支持的操作');
  });

  it('Markdown 结果字段不应影响当前结果缓存与导出入口', async () => {
    vi.spyOn(analysisService, 'createQuery').mockResolvedValue({
      queryId: 'query_markdown',
      status: 'RETURNED',
    });
    vi.spyOn(analysisService, 'getQuery').mockResolvedValue({
      queryId: 'query_markdown',
      status: 'RETURNED',
      title: '新增商机金额排名报告',
      summary: '测试摘要',
      groundedMarkdown: '## 执行摘要\n- 本月新增商机金额排名已生成。',
      report: {
        variant: 'ranking',
        reportTitle: '新增商机金额排名报告',
        executiveSummary: '测试摘要',
        keyFindings: [],
        metricCards: [{ name: '新增商机金额', value: '1,270,000' }],
        chartBlocks: [],
        tableBlocks: [],
        sections: [],
        datasetReferences: [],
        scopeSummary: '测试范围',
        appliedFilters: [],
        groundedMarkdown: '## 执行摘要\n- 本月新增商机金额排名已生成。',
        availableActions: [],
      },
    });
    const exportSpy = vi
      .spyOn(analysisService, 'createExport')
      .mockResolvedValue({
        exportId: 'export_markdown',
        status: 'COMPLETED',
        rowCount: 1,
        fileName: 'query_markdown.csv',
        mimeType: 'text/csv;charset=utf-8',
        content: '标题,值',
      });
    vi.spyOn(analysisService, 'listRecentQueries').mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
    });

    const store = useAnalysisQueryStore();
    await store.submitQuery('本月各销售负责人新增商机金额排名');
    await store.exportCurrentResult();

    expect(store.currentResult?.groundedMarkdown).toContain('执行摘要');
    expect(exportSpy).toHaveBeenCalledWith('query_markdown', 'csv');
    expect(triggerBrowserDownload).toHaveBeenCalledWith({
      fileName: 'query_markdown.csv',
      mimeType: 'text/csv;charset=utf-8',
      content: '标题,值',
    });
  });

  it('显式强制刷新 bootstrap 时应重新拉取模板与最近查询', async () => {
    vi.spyOn(analysisService, 'getCapabilities').mockResolvedValue({
      serviceStatus: 'ONLINE',
      scopeSummary: '测试范围',
      roleNames: ['销售总监'],
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
      dataFreshnessAt: '2026-03-24T09:00:00.000Z',
      visibleMenus: ['analysis-workbench'],
      actionKeys: ['analysis.use'],
      followUpAllowed: true,
      templateViewAllowed: true,
      contractWorkspaceAllowed: true,
      wecomBotAccessState: 'ALLOWED',
      contractPermissions: {
        uploadAllowed: true,
        crossViewAllowed: false,
        crossDownloadAllowed: false,
      },
    });
    vi.spyOn(analysisService, 'listTemplates').mockResolvedValue({
      items: [],
    });
    vi.spyOn(analysisService, 'listRecentQueries').mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
    });

    const store = useAnalysisQueryStore();
    await store.bootstrap();
    await store.bootstrap(true);

    expect(analysisService.listTemplates).toHaveBeenCalledTimes(2);
    expect(analysisService.listRecentQueries).toHaveBeenCalledTimes(2);
  });

  it('刷新模板列表期间应暴露加载状态', async () => {
    let resolveTemplates: ((value: { items: [] }) => void) | undefined;
    const listTemplatesSpy = vi.spyOn(analysisService, 'listTemplates').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveTemplates = resolve as (value: { items: [] }) => void;
        }),
    );

    const store = useAnalysisQueryStore();
    const refreshPromise = store.refreshTemplates({ scope: 'others' });

    expect(store.isTemplateListLoading).toBe(true);

    resolveTemplates?.({ items: [] });
    await refreshPromise;

    expect(store.isTemplateListLoading).toBe(false);
    listTemplatesSpy.mockResolvedValue({ items: [] });
  });

  it('runTemplate 应执行模板后再统一拉取 query detail，不能在前端手拼模板报告', async () => {
    vi.spyOn(analysisService, 'executeTemplate').mockResolvedValue({
      queryId: 'query_template_001',
      templateId: 'tpl_001',
      queryMode: 'FIXED_SQL',
      sqlVersion: '2026.05.11',
      resultBundle: {
        metricCards: [{ name: '全年目标', value: 44000 }],
        primaryBlock: {
          viewType: 'BAR_CHART',
          title: '2026 各团队完成率预测',
          series: [{ team_name: '大北区-北区金融部', completion_rate: 0.8 }],
        },
      },
      insightBundle: {
        status: 'PENDING',
      },
      executedAt: '2026-05-11T08:00:00.000Z',
    });
    vi.spyOn(analysisService, 'getQuery')
      .mockResolvedValue({
        queryId: 'query_template_001',
        status: 'RETURNED',
        title: '2026 各团队完成预测',
        summary: '2026 各团队完成预测 已生成数据结果。',
        report: {
          variant: 'trend',
          reportTitle: '2026 各团队完成预测',
          executiveSummary: '2026 各团队完成预测 已生成数据结果。',
          keyFindings: [],
          metricCards: [{ name: '全年目标', value: 44000 }],
          chartBlocks: [],
          tableBlocks: [],
          sections: [],
          datasetReferences: [],
          scopeSummary: '模板查询结果',
          appliedFilters: [],
          availableActions: [],
        },
      });
    vi.spyOn(analysisService, 'getQueryReport').mockResolvedValue({
      queryId: 'query_template_001',
      status: 'READY',
      report: {
        variant: 'trend',
        reportTitle: '2026 各团队完成预测',
        executiveSummary: '2026 各团队完成预测 已生成数据结果。',
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
          predictedValue: 5600,
          predictedRangeLow: 5400,
          predictedRangeHigh: 5800,
          confidenceLevel: 'MEDIUM',
          drivers: ['近四期趋势延续'],
          caveats: ['当前预测仅供短期参考。'],
          summary: '预计下一周期大概率落在 5400 到 5800 之间。',
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
        keyFindings: [],
        metricCards: [{ name: '全年目标', value: 44000 }],
        chartBlocks: [],
        tableBlocks: [],
        sections: [],
        datasetReferences: [],
        scopeSummary: '模板查询结果',
        appliedFilters: [],
        detailMarkdown: '## 执行摘要\n2026 各团队完成预测 已生成数据结果。\n## 趋势预测\n预计下一周期大概率落在 5400 到 5800 之间。',
        availableActions: [],
      },
    });
    vi.spyOn(analysisService, 'listRecentQueries').mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
    });

    const store = useAnalysisQueryStore();
    store.templates = [
      {
        templateId: 'tpl_001',
        name: '2026 各团队完成预测',
        description: '查看全年目标、有效收入、承诺商机与完成率预测。',
        defaultQuestionText: '2026 各团队完成预测',
        defaultFilters: { year: 2026 },
        queryMode: 'FIXED_SQL',
        sqlVersion: '2026.05.11',
        renderConfig: {
          primaryViewType: 'BAR_CHART',
          primaryTitle: '2026 各团队完成率预测',
        },
        visibleRoleIds: ['role_sales_director'],
        displayOrder: 1,
        clickCount7d: 10,
        hitRatePercent: 98,
        optimizationStatus: 'HEALTHY',
        status: 'ACTIVE',
        updatedAt: '2026-05-11T08:00:00.000Z',
      },
    ];

    await store.runTemplate('tpl_001');
    await Promise.resolve();
    await Promise.resolve();

    expect(analysisService.executeTemplate).toHaveBeenCalledWith('tpl_001', {
      parameters: { year: 2026 },
      includeAiReport: true,
    });
    expect(analysisService.getQuery).toHaveBeenCalledWith('query_template_001');
    expect(analysisService.getQueryReport).toHaveBeenCalledWith('query_template_001', {
      waitMs: 55000,
    });
    expect(store.currentResult?.queryId).toBe('query_template_001');
    expect(store.currentResult?.report?.detailMarkdown ?? '').toContain('## 趋势预测');
    expect(store.currentResult?.report?.recommendations?.[0]?.title).toContain('提前排布');
  });

  it('模板执行后导出应使用后端返回的真实 queryId', async () => {
    vi.spyOn(analysisService, 'executeTemplate').mockResolvedValue({
      queryId: 'query_template_export_001',
      templateId: 'tpl_001',
      queryMode: 'FIXED_SQL',
      sqlVersion: '2026.05.11',
      resultBundle: {
        metricCards: [{ name: '全年目标', value: 44000 }],
        primaryBlock: {
          viewType: 'BAR_CHART',
          title: '2026 各团队完成率预测',
          series: [{ team_name: '大北区-北区金融部', completion_rate: 0.8 }],
        },
      },
      insightBundle: {
        status: 'SKIPPED',
      },
      executedAt: '2026-05-11T08:00:00.000Z',
    });
    vi.spyOn(analysisService, 'getQuery').mockResolvedValue({
      queryId: 'query_template_export_001',
      status: 'RETURNED',
      title: '2026 各团队完成预测',
      summary: '2026 各团队完成预测 已生成数据结果。',
      report: {
        variant: 'trend',
        reportTitle: '2026 各团队完成预测',
        executiveSummary: '2026 各团队完成预测 已生成数据结果。',
        keyFindings: [],
        metricCards: [{ name: '全年目标', value: 44000 }],
        chartBlocks: [],
        tableBlocks: [],
        sections: [],
        datasetReferences: [],
        scopeSummary: '模板查询结果',
        appliedFilters: [],
        availableActions: [],
      },
    });
    vi.spyOn(analysisService, 'getQueryReport').mockResolvedValue({
      queryId: 'query_template_export_001',
      status: 'PENDING',
    });
    const exportSpy = vi
      .spyOn(analysisService, 'createExport')
      .mockResolvedValue({
        exportId: 'export_template',
        status: 'COMPLETED',
        rowCount: 1,
        fileName: 'export_template.csv',
        mimeType: 'text/csv;charset=utf-8',
        content: '标题,值',
      });

    const store = useAnalysisQueryStore();
    store.templates = [
      {
        templateId: 'tpl_001',
        name: '2026 各团队完成预测',
        description: '查看全年目标、有效收入、承诺商机与完成率预测。',
        defaultQuestionText: '2026 各团队完成预测',
        defaultFilters: { year: 2026 },
        queryMode: 'FIXED_SQL',
        sqlVersion: '2026.05.11',
        renderConfig: {
          primaryViewType: 'BAR_CHART',
          primaryTitle: '2026 各团队完成率预测',
        },
        visibleRoleIds: ['role_sales_director'],
        displayOrder: 1,
        clickCount7d: 10,
        hitRatePercent: 98,
        optimizationStatus: 'HEALTHY',
        status: 'ACTIVE',
        updatedAt: '2026-05-11T08:00:00.000Z',
      },
    ];

    await store.runTemplate('tpl_001');
    await store.exportCurrentResult();

    expect(analysisService.getQuery).toHaveBeenCalledWith('query_template_export_001');
    expect(exportSpy).toHaveBeenCalledWith('query_template_export_001', 'csv');
    expect(triggerBrowserDownload).toHaveBeenCalledWith({
      fileName: 'export_template.csv',
      mimeType: 'text/csv;charset=utf-8',
      content: '标题,值',
    });
  });

  it('右上角提示应在 3 秒后自动消失', () => {
    const store = useAnalysisQueryStore();

    store.setFeedback('导出文件已开始下载。', 'success');
    expect(store.feedbackMessage).toBe('导出文件已开始下载。');

    vi.advanceTimersByTime(2999);
    expect(store.feedbackMessage).toBe('导出文件已开始下载。');

    vi.advanceTimersByTime(1);
    expect(store.feedbackMessage).toBe('');
  });
});

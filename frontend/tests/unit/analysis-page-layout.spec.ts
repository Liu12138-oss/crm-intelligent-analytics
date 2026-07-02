import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, h, nextTick } from 'vue';
import AnalysisWorkbenchPage from '@/pages/analysis/AnalysisWorkbenchPage.vue';
import AnalysisResultDetailPage from '@/pages/analysis/AnalysisResultDetailPage.vue';
import { analysisService } from '@/services/analysis.service';
import { useAuthStore } from '@/stores/auth.store';
import { useAnalysisQueryStore } from '@/stores/analysis-query.store';
import type { AnalysisCapability } from '@/types/analysis';

const pushMock = vi.fn();
const mockRoute = {
  path: '/analysis',
  params: {} as Record<string, string>,
  query: {} as Record<string, string>,
};

vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock('@/services/analysis.service', () => ({
  analysisService: {
    getCapabilities: vi.fn(),
    listTemplates: vi.fn(),
    listRecentQueries: vi.fn(),
    getQuery: vi.fn(),
    getTemplate: vi.fn(),
    createExport: vi.fn(),
    createQuery: vi.fn(),
    rerunHistory: vi.fn(),
    getQueryReport: vi.fn(),
    saveQueryAsTemplate: vi.fn(),
    copyTemplateToMine: vi.fn(),
    deleteMyTemplate: vi.fn(),
    updateMyTemplate: vi.fn(),
    executeTemplate: vi.fn(),
    validateGovernanceTemplate: vi.fn(),
    createGovernanceTemplate: vi.fn(),
  },
}));

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await nextTick();
  await Promise.resolve();
  await nextTick();
}

const ElInputTextareaStub = defineComponent({
  name: 'ElInputTextareaStub',
  props: {
    modelValue: {
      type: String,
      default: '',
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:modelValue'],
  setup(props, { attrs, emit }) {
    return () =>
      h('textarea', {
        ...attrs,
        disabled: props.disabled || undefined,
        value: props.modelValue,
        onInput: (event: Event) => {
          emit('update:modelValue', (event.target as HTMLTextAreaElement).value);
        },
      });
  },
});

const ElButtonStub = defineComponent({
  name: 'ElButtonStub',
  props: {
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['click'],
  setup(props, { attrs, emit, slots }) {
    return () =>
      h(
        'button',
        {
          ...attrs,
          disabled: props.disabled,
          onClick: (event: MouseEvent) => {
            emit('click', event);
          },
        },
        slots.default?.(),
      );
  },
});

const pageMountOptions = {
  global: {
    stubs: {
      ElInput: {
        template: '<div class="el-input-stub"><slot /></div>',
      },
      ElButton: ElButtonStub,
      ElTag: {
        template: '<span class="el-tag-stub"><slot /></span>',
      },
      ElPopover: {
        template:
          '<div class="el-popover-stub"><slot name="reference" /><slot /></div>',
      },
    },
  },
};

const pageMountOptionsWithTextareaInput = {
  global: {
    stubs: {
      ...pageMountOptions.global.stubs,
      ElInput: ElInputTextareaStub,
    },
  },
};

describe('analysis page layout', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const authStore = useAuthStore();
    authStore.session = {
      authenticated: true,
      sessionId: 'auth_session_analysis_page',
      source: 'password-login',
      expiresAt: '2026-04-18T09:00:00.000Z',
      user: {
        id: 'user_sales_director',
        name: '销售总监',
        roleNames: ['销售总监'],
        channels: ['web-console'],
        organizationIds: ['org_north'],
        departmentIds: ['dept_sales'],
      },
    };
    pushMock.mockReset();
    mockRoute.path = '/analysis';
    mockRoute.params = {};
    mockRoute.query = {};

    vi.mocked(analysisService.getCapabilities).mockReset();
    vi.mocked(analysisService.listTemplates).mockReset();
    vi.mocked(analysisService.listRecentQueries).mockReset();
    vi.mocked(analysisService.getQuery).mockReset();
    vi.mocked(analysisService.getTemplate).mockReset();
    vi.mocked(analysisService.createExport).mockReset();
    vi.mocked(analysisService.createQuery).mockReset();
    vi.mocked(analysisService.rerunHistory).mockReset();
    vi.mocked(analysisService.getQueryReport).mockReset();
    vi.mocked(analysisService.saveQueryAsTemplate).mockReset();
    vi.mocked(analysisService.copyTemplateToMine).mockReset();
    vi.mocked(analysisService.deleteMyTemplate).mockReset();
    vi.mocked(analysisService.updateMyTemplate).mockReset();
    vi.mocked(analysisService.executeTemplate).mockReset();
    vi.mocked(analysisService.validateGovernanceTemplate).mockReset();
    vi.mocked(analysisService.createGovernanceTemplate).mockReset();
  });

  it('智能分析工作台应移除页头迁移内容，只保留原生业务区标题', async () => {
    vi.mocked(analysisService.getCapabilities).mockResolvedValue({
      serviceStatus: 'ONLINE',
      scopeSummary: '当前仅可查看销售总监授权数据。',
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
      dataFreshnessAt: '2026-04-18T09:00:00.000Z',
      visibleMenus: ['analysis-workbench', 'contract-review'],
      actionKeys: ['analysis.use', 'analysis.export'],
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
    vi.mocked(analysisService.listTemplates).mockResolvedValue({
      items: [
        {
          templateId: 'tpl_001',
          name: '负责人排名',
          description: '查看本月销售负责人新增商机金额排名。',
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
          hitRatePercent: 98,
          optimizationStatus: 'HEALTHY',
          status: 'ACTIVE',
          updatedAt: '2026-04-18T09:00:00.000Z',
        },
      ],
    });
    vi.mocked(analysisService.listRecentQueries).mockResolvedValue({
      items: [
        {
          historyId: 'history_001',
          questionText: '上月新增商机金额趋势',
          lastUsedChannel: 'web-console',
          resultSummary: '共命中 3 个分组。',
          status: 'SUCCEEDED',
          lastUsedAt: '2026-04-18T09:00:00.000Z',
        },
      ],
      page: 1,
      pageSize: 10,
      total: 1,
    });

    const store = useAnalysisQueryStore();
    store.capabilities = {
      serviceStatus: 'ONLINE',
      scopeSummary: '当前仅可查看销售总监授权数据。',
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
      dataFreshnessAt: '2026-04-18T09:00:00.000Z',
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
            name: '负责人排名',
            description: '查看本月销售负责人新增商机金额排名。',
            recommendationReason: '临近月底，猜你会先看这个',
          },
        ],
      },
      contractPermissions: {
        uploadAllowed: true,
        crossViewAllowed: false,
        crossDownloadAllowed: false,
      },
    };
    store.templates = [
      {
        templateId: 'tpl_001',
        name: '负责人排名',
        description: '查看本月销售负责人新增商机金额排名。',
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
        hitRatePercent: 98,
        optimizationStatus: 'HEALTHY',
        status: 'ACTIVE',
        updatedAt: '2026-04-18T09:00:00.000Z',
      },
    ];
    store.histories = [
      {
        historyId: 'history_001',
        questionText: '上月新增商机金额趋势',
        lastUsedChannel: 'web-console',
        sourceType: 'AI_QUERY',
        resultSummary: '共命中 3 个分组。',
        status: 'SUCCEEDED',
        lastUsedAt: '2026-04-18T09:00:00.000Z',
      },
    ];

    const wrapper = mount(AnalysisWorkbenchPage, pageMountOptions);
    await flushPromises();

    expect(wrapper.find('.page-header--compact').exists()).toBe(false);
    expect(wrapper.get('.search-region .panel__header').text()).toContain('智能分析');
    expect(wrapper.text()).toContain('最近查询');
    expect(wrapper.text()).not.toContain('查看常用查询');
    expect(wrapper.text()).not.toContain('查询资产');
    expect(wrapper.text()).not.toContain('复用入口摘要');
    expect(wrapper.text()).not.toContain('把自然语言问数放进可信经营上下文');
    expect(wrapper.text()).not.toContain('Web Console');
  });

  it('工作台输入框按下 Enter 时应直接触发分析查询', async () => {
    vi.mocked(analysisService.getCapabilities).mockResolvedValue({
      serviceStatus: 'ONLINE',
      scopeSummary: '当前仅可查看销售总监授权数据。',
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
      dataFreshnessAt: '2026-04-18T09:00:00.000Z',
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
            name: '负责人排名',
            description: '查看本月销售负责人新增商机金额排名。',
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
    vi.mocked(analysisService.listTemplates).mockResolvedValue({ items: [] });
    vi.mocked(analysisService.listRecentQueries).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
    });
    vi.mocked(analysisService.createQuery).mockResolvedValue({
      queryId: 'query_enter_001',
      status: 'RETURNED',
    });
    vi.mocked(analysisService.getQuery).mockResolvedValue({
      queryId: 'query_enter_001',
      status: 'RETURNED',
      title: '新增商机金额排名报告',
      summary: '最近三个月负责人排名已生成。',
      scopeSummary: '当前仅展示销售总监权限范围。',
      explanation: '当前结果基于统一结果包生成。',
      dataFreshnessAt: '2026-04-18T09:00:00.000Z',
      metricCards: [{ name: '累计金额', value: '39,000,000' }],
      tableRows: [],
      streamBlocks: [],
      availableActions: [],
    });

    const wrapper = mount(AnalysisWorkbenchPage, pageMountOptionsWithTextareaInput);
    await flushPromises();

    const textarea = wrapper.get('textarea.search-region__textarea');
    await textarea.setValue('最近三个月各销售负责人新增商机金额排名');
    await textarea.trigger('keydown', { key: 'Enter' });
    await flushPromises();

    expect(analysisService.createQuery).toHaveBeenCalledTimes(1);
    expect(analysisService.createQuery).toHaveBeenCalledWith({
      querySource: 'FREE_TEXT',
      channel: 'web-console',
      questionText: '最近三个月各销售负责人新增商机金额排名',
    });
  });

  it('工作台仅在已有分析结果后显示一行追问区并沿用当前 queryId', async () => {
    vi.mocked(analysisService.getCapabilities).mockResolvedValue({
      serviceStatus: 'ONLINE',
      scopeSummary: '当前仅可查看销售总监授权数据。',
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
      dataFreshnessAt: '2026-04-18T09:00:00.000Z',
      visibleMenus: ['analysis-workbench', 'contract-review'],
      actionKeys: ['analysis.use', 'analysis.follow_up', 'analysis.export'],
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
    vi.mocked(analysisService.listTemplates).mockResolvedValue({ items: [] });
    vi.mocked(analysisService.listRecentQueries).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
    });
    vi.mocked(analysisService.createQuery).mockResolvedValue({
      queryId: 'query_follow_up_home',
      status: 'RETURNED',
    });
    vi.mocked(analysisService.getQuery).mockResolvedValue({
      queryId: 'query_follow_up_home',
      status: 'RETURNED',
      title: '近三个月趋势追问结果',
      summary: '已按近三个月重新生成趋势结果。',
      tableRows: [],
      streamBlocks: [],
      availableActions: [],
    });

    const store = useAnalysisQueryStore();
    store.viewState = 'reported';
    store.currentResult = {
      queryId: 'query_source_home',
      status: 'RETURNED',
      title: '新增商机金额趋势分析',
      summary: '第一轮结果已生成。',
      tableRows: [],
      streamBlocks: [],
      availableActions: [],
    };

    const wrapper = mount(AnalysisWorkbenchPage, pageMountOptionsWithTextareaInput);
    await flushPromises();

    expect(wrapper.find('.analysis-follow-up-bar').exists()).toBe(true);
    expect(wrapper.text()).toContain('追问当前结果');

    expect(wrapper.find('textarea.analysis-follow-up-bar__input').exists()).toBe(true);
    store.followUpText = '把时间范围改成近三个月';
    await nextTick();
    expect(store.followUpText).toBe('把时间范围改成近三个月');
    expect(wrapper.get('button.analysis-follow-up-bar__button').attributes('disabled')).toBeUndefined();
    await wrapper.get('button.analysis-follow-up-bar__button').trigger('click');
    await flushPromises();

    expect(analysisService.createQuery).toHaveBeenCalledWith({
      querySource: 'FREE_TEXT',
      channel: 'web-console',
      questionText: '把时间范围改成近三个月',
      followUpQueryId: 'query_source_home',
    });
  });

  it('首页追问进行中应继续展示原结果和追问区域', async () => {
    vi.mocked(analysisService.getCapabilities).mockResolvedValue({
      serviceStatus: 'ONLINE',
      scopeSummary: '当前仅可查看销售总监授权数据。',
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
      dataFreshnessAt: '2026-04-18T09:00:00.000Z',
      visibleMenus: ['analysis-workbench', 'contract-review'],
      actionKeys: ['analysis.use', 'analysis.follow_up', 'analysis.export'],
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
    vi.mocked(analysisService.listTemplates).mockResolvedValue({ items: [] });
    vi.mocked(analysisService.listRecentQueries).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
    });

    const store = useAnalysisQueryStore();
    store.capabilities = {
      serviceStatus: 'ONLINE',
      scopeSummary: '当前仅可查看销售总监授权数据。',
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
      dataFreshnessAt: '2026-04-18T09:00:00.000Z',
      visibleMenus: ['analysis-workbench', 'contract-review'],
      actionKeys: ['analysis.use', 'analysis.follow_up', 'analysis.export'],
      followUpAllowed: true,
      templateViewAllowed: true,
      contractWorkspaceAllowed: true,
      wecomBotAccessState: 'ALLOWED',
      contractPermissions: {
        uploadAllowed: true,
        crossViewAllowed: false,
        crossDownloadAllowed: false,
      },
    };
    store.bootstrapped = true;
    store.bootstrapHydratedAt = Date.now();
    store.viewState = 'reported';
    store.isSubmittingFollowUp = true;
    store.followUpText = '把时间范围改成近三个月';
    store.currentResult = {
      queryId: 'query_source_home',
      status: 'RETURNED',
      title: '新增商机金额负责人排名报告',
      summary: '第一轮结果已生成。',
      tableRows: [],
      streamBlocks: [],
      availableActions: [],
    };

    const wrapper = mount(AnalysisWorkbenchPage, pageMountOptionsWithTextareaInput);
    await flushPromises();

    expect(wrapper.find('.analysis-follow-up-bar').exists()).toBe(true);
    expect(wrapper.text()).toContain('新增商机金额负责人排名报告');
    expect(wrapper.text()).toContain('第一轮结果已生成。');
    expect(wrapper.find('.result-region__loading').exists()).toBe(false);
    expect(wrapper.find('.result-region__empty').exists()).toBe(false);
    expect(wrapper.get('textarea.analysis-follow-up-bar__input').attributes('disabled')).toBeUndefined();
    expect(wrapper.get('button.analysis-follow-up-bar__button').attributes('disabled')).toBeDefined();
  });

  it('工作台提示框应使用带可访问标签的紧凑关闭图标按钮', async () => {
    vi.mocked(analysisService.getCapabilities).mockResolvedValue({
      serviceStatus: 'ONLINE',
      scopeSummary: '当前仅可查看销售总监授权数据。',
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
      dataFreshnessAt: '2026-04-18T09:00:00.000Z',
      visibleMenus: ['analysis-workbench', 'contract-review'],
      actionKeys: ['analysis.use', 'analysis.export'],
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
    vi.mocked(analysisService.listTemplates).mockResolvedValue({ items: [] });
    vi.mocked(analysisService.listRecentQueries).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
    });

    const wrapper = mount(AnalysisWorkbenchPage, pageMountOptions);
    await flushPromises();

    const store = useAnalysisQueryStore();
    store.setFeedback('请求超时，请稍后重试。', 'error');
    await nextTick();

    const closeButton = wrapper.get('.analysis-toast__close');

    expect(closeButton.attributes('aria-label')).toBe('关闭提示');
    expect(closeButton.text().trim()).toBe('');
  });

  it('仅返回表格结果时，结果区应切换为单列全宽布局', async () => {
    vi.mocked(analysisService.getCapabilities).mockResolvedValue({
      serviceStatus: 'ONLINE',
      scopeSummary: '当前仅可查看销售总监授权数据。',
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
      templateCount: 0,
      dataFreshnessAt: '2026-04-18T09:00:00.000Z',
      visibleMenus: ['analysis-workbench'],
      actionKeys: ['analysis.use', 'analysis.export'],
      followUpAllowed: true,
      templateViewAllowed: true,
      contractWorkspaceAllowed: false,
      wecomBotAccessState: 'ALLOWED',
      contractPermissions: {
        uploadAllowed: false,
        crossViewAllowed: false,
        crossDownloadAllowed: false,
      },
    });
    vi.mocked(analysisService.listTemplates).mockResolvedValue({ items: [] });
    vi.mocked(analysisService.listRecentQueries).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
    });

    const store = useAnalysisQueryStore();
    store.viewState = 'reported';
    store.currentResult = {
      queryId: 'query_table_only',
      status: 'RETURNED',
      title: '近一周新增商机明细',
      summary: '当前结果仅返回明细表。',
      tableRows: [
        {
          team_name: '大东区-江苏区',
          customer_name: '盛合晶微半导体',
        },
      ],
      primaryView: {
        title: '近一周新增商机明细',
        viewType: 'TABLE',
        columns: [
          { key: 'team_name', label: '团队' },
          { key: 'customer_name', label: '最终客户' },
        ],
      },
      report: {
        variant: 'summary',
        reportTitle: '近一周新增商机明细',
        executiveSummary: '当前结果仅返回明细表。',
        keyFindings: [],
        metricCards: [],
        chartBlocks: [],
        tableBlocks: [
          {
            title: '近一周新增商机明细',
            rows: [
              {
                team_name: '大东区-江苏区',
                customer_name: '盛合晶微半导体',
              },
            ],
            columns: [
              { key: 'team_name', label: '团队' },
              { key: 'customer_name', label: '最终客户' },
            ],
          },
        ],
        sections: [],
      },
      availableActions: [],
    } as any;

    const wrapper = mount(AnalysisWorkbenchPage, pageMountOptions);
    await flushPromises();

    expect(wrapper.find('.result-region__content-grid--single').exists()).toBe(true);
  });

  it('工作台结果区遇到多列表格时应切换为全宽布局', async () => {
    vi.mocked(analysisService.getCapabilities).mockResolvedValue({
      serviceStatus: 'ONLINE',
      scopeSummary: '当前仅可查看销售总监授权数据。',
      roleNames: ['销售总监'],
      channels: ['web-console'],
      domains: ['opportunity-analysis'],
      metrics: ['新增商机数量'],
      dimensions: ['团队', '月份'],
      exportAllowed: true,
      exportRowLimit: 1000,
      exportDailyLimit: 3,
      remainingDailyExports: 3,
      historyEnabled: true,
      templateCount: 1,
      dataFreshnessAt: '2026-04-18T09:00:00.000Z',
      visibleMenus: ['analysis-workbench', 'contract-review'],
      actionKeys: ['analysis.use', 'analysis.export'],
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
    vi.mocked(analysisService.listTemplates).mockResolvedValue({ items: [] });
    vi.mocked(analysisService.listRecentQueries).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
    });

    const monthColumns = Array.from({ length: 12 }, (_, index) => {
      const month = String(index + 1).padStart(2, '0');
      return { key: `m${month}`, label: `${month}月` };
    });
    const wideColumns = [{ key: 'team_name', label: '团队' }, ...monthColumns];
    const wideRows = [
      Object.fromEntries([
        ['team_name', '大东区-江苏区'],
        ...monthColumns.map((column, index) => [column.key, index + 1] as const),
      ]),
    ];

    const store = useAnalysisQueryStore();
    store.viewState = 'reported';
    store.currentResult = {
      queryId: 'query_monthly_distribution',
      status: 'RETURNED',
      title: '2026 各团队新增商机月度分布',
      summary: '按团队和月份展示新增商机分布。',
      tableRows: wideRows,
      primaryView: {
        title: '2026 各团队新增商机月度分布',
        viewType: 'TABLE',
        rows: wideRows,
        columns: wideColumns,
      },
      report: {
        variant: 'distribution',
        reportTitle: '2026 各团队新增商机月度分布',
        executiveSummary: '按团队和月份展示新增商机分布。',
        keyFindings: [],
        metricCards: [],
        chartBlocks: [
          {
            blockId: 'chart_001',
            title: '新增商机月度分布',
            viewType: 'BAR_CHART',
            datasetId: 'dataset_001',
            series: [
              { label: '01月', value: 8 },
              { label: '02月', value: 12 },
            ],
          },
        ],
        tableBlocks: [
          {
            blockId: 'table_001',
            title: '2026 各团队新增商机月度分布',
            datasetId: 'dataset_001',
            rows: wideRows,
            columns: wideColumns,
          },
        ],
        sections: [],
        datasetReferences: [],
        scopeSummary: '当前仅展示销售总监权限范围。',
        appliedFilters: [],
        availableActions: [],
      },
      availableActions: [],
    } as any;

    const wrapper = mount(AnalysisWorkbenchPage, pageMountOptions);
    await flushPromises();

    expect(wrapper.find('.result-region__content-grid--wide-table').exists()).toBe(true);
  });

  it('工作台同时展示图表和表格时应改为上下全宽布局并转置明细表', async () => {
    vi.mocked(analysisService.getCapabilities).mockResolvedValue({
      serviceStatus: 'ONLINE',
      scopeSummary: '当前仅可查看销售总监授权数据。',
      roleNames: ['销售总监'],
      channels: ['web-console'],
      domains: ['opportunity-analysis'],
      metrics: ['新增商机金额'],
      dimensions: ['季度'],
      exportAllowed: true,
      exportRowLimit: 1000,
      exportDailyLimit: 3,
      remainingDailyExports: 3,
      historyEnabled: true,
      templateCount: 1,
      dataFreshnessAt: '2026-04-18T09:00:00.000Z',
      visibleMenus: ['analysis-workbench', 'contract-review'],
      actionKeys: ['analysis.use', 'analysis.export'],
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
    vi.mocked(analysisService.listTemplates).mockResolvedValue({ items: [] });
    vi.mocked(analysisService.listRecentQueries).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
    });

    const store = useAnalysisQueryStore();
    store.viewState = 'reported';
    store.currentResult = {
      queryId: 'query_company_ten_percent',
      status: 'RETURNED',
      title: '10%+ 商机新增趋势',
      summary: '10%+ 商机新增趋势已生成数据结果。',
      report: {
        variant: 'summary',
        reportTitle: '10%+ 商机新增趋势',
        executiveSummary: '10%+ 商机新增趋势已生成数据结果。',
        keyFindings: [],
        metricCards: [],
        chartBlocks: [
          {
            blockId: 'chart_001',
            title: '10%+ 商机新增趋势',
            viewType: 'BAR_CHART',
            datasetId: 'dataset_001',
            series: [
              { label: '2022Q2', value: 3969.39, quarter_label: '2022Q2', opportunity_amount: 3969.39 },
              { label: '2022Q3', value: 10625.83, quarter_label: '2022Q3', opportunity_amount: 10625.83 },
            ],
          },
        ],
        tableBlocks: [
          {
            blockId: 'table_001',
            title: '10%+ 商机新增趋势',
            datasetId: 'dataset_001',
            rows: [
              { quarter_label: '2022Q2', opportunity_amount: 3969.39 },
              { quarter_label: '2022Q3', opportunity_amount: 10625.83 },
            ],
            columns: [
              { key: 'quarter_label', label: '季度' },
              { key: 'opportunity_amount', label: '新增商机金额（万元）' },
            ],
          },
        ],
        sections: [],
        datasetReferences: [],
        scopeSummary: '当前仅展示销售总监权限范围。',
        appliedFilters: [],
        availableActions: [],
      },
      tableRows: [
        { quarter_label: '2022Q2', opportunity_amount: 3969.39 },
        { quarter_label: '2022Q3', opportunity_amount: 10625.83 },
      ],
      streamBlocks: [],
      availableActions: [],
    } as any;

    const wrapper = mount(AnalysisWorkbenchPage, pageMountOptions);
    await flushPromises();

    expect(wrapper.find('.result-region__content-grid--stacked-visuals').exists()).toBe(true);
    expect(wrapper.find('.chart-horizontal-list').exists()).toBe(true);
    expect(wrapper.find('.transposed-table').exists()).toBe(true);
    expect(wrapper.html().indexOf('table-panel__title')).toBeLessThan(
      wrapper.html().indexOf('chart-panel__title'),
    );
  });

  it('工作台遇到区域维度较多的模板结果时应纵向展示表格和榜单图表', async () => {
    vi.mocked(analysisService.getCapabilities).mockResolvedValue({
      serviceStatus: 'ONLINE',
      scopeSummary: '当前仅可查看销售总监授权数据。',
      roleNames: ['销售总监'],
      channels: ['web-console'],
      domains: ['opportunity-analysis'],
      metrics: ['新增商机金额', '赢单率', '环比变化'],
      dimensions: ['区域'],
      exportAllowed: true,
      exportRowLimit: 1000,
      exportDailyLimit: 3,
      remainingDailyExports: 3,
      historyEnabled: true,
      templateCount: 1,
      dataFreshnessAt: '2026-04-18T09:00:00.000Z',
      visibleMenus: ['analysis-workbench', 'contract-review'],
      actionKeys: ['analysis.use', 'analysis.export'],
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
    vi.mocked(analysisService.listTemplates).mockResolvedValue({ items: [] });
    vi.mocked(analysisService.listRecentQueries).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
    });

    const rows = Array.from({ length: 12 }, (_, index) => ({
      region_name: `区域${index + 1}`,
      opportunity_amount: 1200 - index * 60,
      win_rate: 68 - index,
      mom_change: `${index % 2 === 0 ? '+' : '-'}${index + 1}%`,
    }));

    const store = useAnalysisQueryStore();
    store.viewState = 'reported';
    store.currentResult = {
      queryId: 'query_quarter_region_health',
      status: 'RETURNED',
      title: '季度商机健康度总览',
      summary: '本季度各区域新增商机金额、赢单率和环比变化已生成。',
      report: {
        variant: 'risk-overview',
        reportTitle: '季度商机健康度总览',
        executiveSummary: '本季度各区域新增商机金额、赢单率和环比变化已生成。',
        keyFindings: [],
        metricCards: [],
        chartBlocks: [
          {
            blockId: 'chart_001',
            title: '本季度各区域新增商机金额排名',
            viewType: 'BAR_CHART',
            datasetId: 'dataset_001',
            series: rows.map((row) => ({
              label: row.region_name,
              value: row.opportunity_amount,
            })),
          },
        ],
        tableBlocks: [
          {
            blockId: 'table_001',
            title: '本季度各区域新增商机金额、赢单率和环比变化',
            datasetId: 'dataset_001',
            rows,
            columns: [
              { key: 'region_name', label: '区域' },
              { key: 'opportunity_amount', label: '新增商机金额（万元）' },
              { key: 'win_rate', label: '赢单率（%）' },
              { key: 'mom_change', label: '环比变化' },
            ],
          },
        ],
        sections: [],
        datasetReferences: [],
        scopeSummary: '当前仅展示销售总监权限范围。',
        appliedFilters: [],
        availableActions: [],
      },
      tableRows: rows,
      streamBlocks: [],
      availableActions: [],
    } as any;

    const wrapper = mount(AnalysisWorkbenchPage, pageMountOptions);
    await flushPromises();

    expect(wrapper.find('.result-region__content-grid--stacked-visuals').exists()).toBe(true);
    expect(wrapper.find('.transposed-table').exists()).toBe(false);
    expect(wrapper.find('.el-table').exists()).toBe(true);
    expect(wrapper.find('.chart-ranking-list').exists()).toBe(true);
    expect(wrapper.findAll('.chart-ranking-item')).toHaveLength(12);
    expect(wrapper.find('.chart-horizontal-list').exists()).toBe(false);
  });

  it('分析结果详情应提供返回工作台按钮且不展示查询元信息', async () => {
    mockRoute.path = '/analysis/results/query_001';
    mockRoute.params = { queryId: 'query_001' };

    vi.mocked(analysisService.getQuery).mockResolvedValue({
      queryId: 'query_001',
      status: 'RETURNED',
      title: '新增商机金额排名报告',
      summary: '在当前授权范围内形成 2 个分组。',
      scopeSummary: '当前仅展示销售总监权限范围。',
      explanation: '当前结果基于统一结果包生成。',
      dataFreshnessAt: '2026-04-18T09:00:00.000Z',
      appliedFilters: [
        {
          label: '时间范围',
          value: '本月',
        },
      ],
      metricCards: [
        { name: '新增商机金额', value: '1,270,000' },
      ],
      tableRows: [],
      streamBlocks: [],
      availableActions: [
        {
          actionType: 'EXPORT',
          enabled: true,
        },
      ],
    });

    const wrapper = mount(AnalysisResultDetailPage, pageMountOptions);
    await flushPromises();

    expect(wrapper.find('.page-header--compact').exists()).toBe(false);
    expect(wrapper.text()).toContain('返回工作台');
    await wrapper.get('.analysis-detail-back-button').trigger('click');
    expect(pushMock).toHaveBeenCalledWith({ name: 'analysis' });
    expect(wrapper.text()).not.toContain('查询 ID：query_001');
    expect(wrapper.text()).not.toContain('时间范围：本月');
  });

  it('结果详情中被撤销的导出动作应呈现为禁用状态', async () => {
    mockRoute.path = '/analysis/results/query_002';
    mockRoute.params = { queryId: 'query_002' };

    vi.mocked(analysisService.getQuery).mockResolvedValue({
      queryId: 'query_002',
      status: 'RETURNED',
      title: '新增商机金额排名报告',
      summary: '在当前授权范围内形成 2 个分组。',
      scopeSummary: '当前仅展示销售总监权限范围。',
      explanation: '当前结果基于统一结果包生成。',
      dataFreshnessAt: '2026-04-18T09:00:00.000Z',
      metricCards: [{ name: '新增商机金额', value: '1,270,000' }],
      tableRows: [],
      streamBlocks: [],
      availableActions: [
        {
          actionType: 'EXPORT',
          enabled: false,
          reason: '当前用户无导出权限。',
        },
      ],
    });

    const wrapper = mount(AnalysisResultDetailPage, pageMountOptions);
    await flushPromises();

    const exportButton = wrapper
      .findAll('button')
      .find((item) => item.text().includes('导出当前结果'));

    expect(exportButton).toBeTruthy();
    expect(exportButton?.attributes('disabled')).toBeDefined();
  });

  it('分析结果详情应通过 richer report 面板提供完整阅读稿', async () => {
    mockRoute.path = '/analysis/results/query_003';
    mockRoute.params = { queryId: 'query_003' };

    vi.mocked(analysisService.getQuery).mockResolvedValue({
      queryId: 'query_003',
      status: 'RETURNED',
      title: '新增商机金额排名报告',
      summary: '在当前授权范围内形成 2 个分组。',
      scopeSummary: '当前仅展示销售总监权限范围。',
      explanation: '当前结果基于统一结果包生成。',
      groundedMarkdown: '## 执行摘要\n- 本月新增商机金额排名已生成。',
      report: {
        variant: 'ranking',
        reportTitle: '新增商机金额排名报告',
        executiveSummary: '在当前授权范围内形成 2 个分组。',
        analysisConfidence: 'MEDIUM',
        trendInsight: {
          status: 'UNAVAILABLE',
          drivers: [],
          summary: '当前结果仅支持事实摘要。',
        },
        forecastInsight: {
          status: 'UNAVAILABLE',
          horizonLabel: '下一周期',
          confidenceLevel: 'LOW',
          drivers: [],
          caveats: ['当前时间序列点数不足，暂不输出预测区间。'],
          summary: '当前结果仅支持趋势判断，暂不具备预测条件。',
        },
        anomalyInsights: [],
        riskInsights: [],
        recommendations: [],
        keyFindings: [],
        metricCards: [{ name: '新增商机金额', value: '1,270,000' }],
        chartBlocks: [],
        tableBlocks: [],
        sections: [],
        datasetReferences: [],
        scopeSummary: '当前仅展示销售总监权限范围。',
        appliedFilters: [],
        detailMarkdown: '## 执行摘要\n本月新增商机金额排名已生成。',
        availableActions: [],
      },
      dataFreshnessAt: '2026-04-18T09:00:00.000Z',
      metricCards: [{ name: '新增商机金额', value: '1,270,000' }],
      tableRows: [],
      streamBlocks: [],
      availableActions: [],
    });

    const wrapper = mount(AnalysisResultDetailPage, pageMountOptions);
    await flushPromises();

    expect(wrapper.find('.analysis-rich-report').exists()).toBe(true);
    expect(wrapper.text()).toContain('本月新增商机金额排名已生成');
  });

  it('工作台应移除右侧权限与执行状态侧栏，让主内容区独占布局', async () => {
    vi.mocked(analysisService.getCapabilities).mockResolvedValue({
      serviceStatus: 'ONLINE',
      scopeSummary: '当前仅可查看销售总监授权数据。',
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
      dataFreshnessAt: '2026-04-18T09:00:00.000Z',
      visibleMenus: ['analysis-workbench', 'contract-review'],
      actionKeys: ['analysis.use', 'analysis.export'],
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
    vi.mocked(analysisService.listTemplates).mockResolvedValue({ items: [] });
    vi.mocked(analysisService.listRecentQueries).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
    });

    const wrapper = mount(AnalysisWorkbenchPage, pageMountOptions);
    await flushPromises();

    expect(wrapper.find('.analysis-side-column').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('权限与执行状态');
    expect(wrapper.text()).not.toContain('结果入口');
  });

  it('分析结果详情应复用 richer report 面板展示趋势预测与经营建议', async () => {
    mockRoute.path = '/analysis/results/query_003_rich';
    mockRoute.params = { queryId: 'query_003_rich' };

    vi.mocked(analysisService.getQuery).mockResolvedValue({
      queryId: 'query_003_rich',
      status: 'RETURNED',
      title: '新增商机金额趋势报告',
      summary: '最近四个月山东区新增商机金额趋势已生成。',
      scopeSummary: '当前仅展示销售总监权限范围。',
      explanation: '当前结果基于统一结果包生成。',
      groundedMarkdown: '## 执行摘要\n- 最近四个月山东区新增商机金额趋势已生成。',
      report: {
        variant: 'trend',
        reportTitle: '新增商机金额趋势报告',
        executiveSummary: '最近四个月山东区新增商机金额趋势已生成。',
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
          predictedValue: 162,
          predictedRangeLow: 150,
          predictedRangeHigh: 175,
          confidenceLevel: 'MEDIUM',
          drivers: ['近四期趋势延续'],
          caveats: ['当前预测仅供短期参考。'],
          summary: '预计下一周期大概率落在 150 到 175 之间。',
        },
        anomalyInsights: [],
        riskInsights: [
          {
            riskType: 'RESULT_RISK',
            title: '样本长度有限',
            detail: '当前结果仅包含 4 个时间点。',
            severity: 'MEDIUM',
          },
        ],
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
        metricCards: [{ name: '新增商机金额', value: '1,270,000' }],
        chartBlocks: [],
        tableBlocks: [],
        sections: [],
        datasetReferences: [],
        scopeSummary: '当前仅展示销售总监权限范围。',
        appliedFilters: [],
        detailMarkdown:
          '## 执行摘要\n最近四个月山东区新增商机金额趋势已生成。\n## 趋势预测\n预计下一周期大概率落在 150 到 175 之间。\n## 经营建议\n- 提前排布头部项目推进：提前锁定头部项目推进节奏。',
        availableActions: [],
      },
      dataFreshnessAt: '2026-04-18T09:00:00.000Z',
      metricCards: [{ name: '新增商机金额', value: '1,270,000' }],
      tableRows: [],
      streamBlocks: [],
      availableActions: [],
    });

    const wrapper = mount(AnalysisResultDetailPage, pageMountOptions);
    await flushPromises();

    expect(wrapper.find('.analysis-rich-report').exists()).toBe(true);
    expect(wrapper.text()).toContain('趋势预测');
    expect(wrapper.text()).toContain('经营建议');
    expect(wrapper.text()).toContain('150 到 175');
  });

  it('分析结果详情同时存在表格和图表时应优先展示表格', async () => {
    mockRoute.path = '/analysis/results/query_table_first';
    mockRoute.params = { queryId: 'query_table_first' };

    vi.mocked(analysisService.getQuery).mockResolvedValue({
      queryId: 'query_table_first',
      status: 'RETURNED',
      title: '价值客户历史提单趋势',
      summary: '价值客户历史提单趋势已生成。',
      scopeSummary: '当前仅展示销售总监权限范围。',
      explanation: '当前结果基于统一结果包生成。',
      dataFreshnessAt: '2026-04-18T09:00:00.000Z',
      primaryView: {
        title: '价值客户历史提单趋势图',
        viewType: 'BAR_CHART',
        series: [
          { label: '2024', value: 30243.96 },
          { label: '2025', value: 37111.54 },
        ],
      },
      tableRows: [
        { year_label: '2024', contract_count: 2769, contract_amount: 30243.96 },
        { year_label: '2025', contract_count: 2933, contract_amount: 37111.54 },
      ],
      streamBlocks: [],
      availableActions: [],
    });

    const wrapper = mount(AnalysisResultDetailPage, pageMountOptions);
    await flushPromises();

    expect(wrapper.find('.table-panel__title').exists()).toBe(true);
    expect(wrapper.find('.chart-panel__title').exists()).toBe(true);
    expect(wrapper.html().indexOf('table-panel__title')).toBeLessThan(
      wrapper.html().indexOf('chart-panel__title'),
    );
  });

  it('分析结果详情应展示执行依据摘要与区块口径说明', async () => {
    mockRoute.path = '/analysis/results/query_003_trace';
    mockRoute.params = { queryId: 'query_003_trace' };

    vi.mocked(analysisService.getQuery).mockResolvedValue({
      queryId: 'query_003_trace',
      status: 'RETURNED',
      title: '新增商机金额趋势报告',
      summary: '最近四个月山东区新增商机金额趋势已生成。',
      scopeSummary: '当前仅展示销售总监权限范围。',
      explanation: '当前结果基于统一结果包生成。',
      groundedMarkdown: '## 执行摘要\n- 最近四个月山东区新增商机金额趋势已生成。',
      report: {
        variant: 'trend',
        reportTitle: '新增商机金额趋势报告',
        executiveSummary: '最近四个月山东区新增商机金额趋势已生成。',
        keyFindings: [],
        metricCards: [{ name: '新增商机金额', value: '1,270,000' }],
        chartBlocks: [],
        tableBlocks: [],
        sections: [
          {
            sectionType: 'summary',
            title: '执行摘要',
            summary: '最近四个月山东区新增商机金额趋势已生成。',
            footnotes: ['当前结果中的摘要、图表、表格共用同一份一致性标识。'],
          },
          {
            sectionType: 'metric-strip',
            title: '关键指标',
            metricCards: [{ name: '新增商机金额', value: '1,270,000' }],
            sourceNotes: [
              {
                key: 'analysis-scope',
                label: '分析范围',
                description: '当前仅展示销售总监权限范围。',
              },
            ],
          },
        ],
        datasetReferences: [
          {
            datasetId: 'dataset_001',
            taskId: 'task_001',
            taskTitle: '新增商机金额趋势',
            purpose: 'trend-series',
            rowCount: 4,
          },
        ],
        scopeSummary: '当前仅展示销售总监权限范围。',
        appliedFilters: [],
        sourceNotes: [
          {
            key: 'analysis-scope',
            label: '分析范围',
            description: '当前仅展示销售总监权限范围。',
          },
        ],
        footnotes: ['当前结果中的摘要、图表、表格共用同一份一致性标识。'],
        executionTraceSummary: {
          normalizedQuestion: '最近四个月山东区新增商机金额趋势',
          consistencyToken: 'token_001',
          knowledgeHits: [
            {
              assetId: 'semantic_alias_001',
              assetType: 'ALIAS',
              source: 'PUBLISHED_ASSET',
              name: '商机额别名',
            },
          ],
          taskSummaries: [
            {
              taskId: 'task_001',
              taskTitle: '新增商机金额趋势',
              resultKind: 'time-trend',
              executionSource: 'GUARDED_READONLY_SQL',
            },
          ],
          datasetReferences: [
            {
              datasetId: 'dataset_001',
              taskId: 'task_001',
              taskTitle: '新增商机金额趋势',
              purpose: 'trend-series',
              rowCount: 4,
            },
          ],
          createdAt: '2026-05-07T16:00:00.000Z',
        },
        availableActions: [],
      },
      executionTraceSummary: {
        normalizedQuestion: '最近四个月山东区新增商机金额趋势',
        consistencyToken: 'token_001',
        knowledgeHits: [
          {
            assetId: 'semantic_alias_001',
            assetType: 'ALIAS',
            source: 'PUBLISHED_ASSET',
            name: '商机额别名',
          },
        ],
        taskSummaries: [
          {
            taskId: 'task_001',
            taskTitle: '新增商机金额趋势',
            resultKind: 'time-trend',
            executionSource: 'GUARDED_READONLY_SQL',
          },
        ],
        datasetReferences: [
          {
            datasetId: 'dataset_001',
            taskId: 'task_001',
            taskTitle: '新增商机金额趋势',
            purpose: 'trend-series',
            rowCount: 4,
          },
        ],
        createdAt: '2026-05-07T16:00:00.000Z',
      },
      dataFreshnessAt: '2026-04-18T09:00:00.000Z',
      metricCards: [{ name: '新增商机金额', value: '1,270,000' }],
      tableRows: [],
      streamBlocks: [],
      availableActions: [],
    });

    const wrapper = mount(AnalysisResultDetailPage, pageMountOptions);
    await flushPromises();

    expect(wrapper.text()).toContain('执行依据摘要');
    expect(wrapper.text()).toContain('商机额别名');
    expect(wrapper.text()).toContain('当前结果中的摘要、图表、表格共用同一份一致性标识');
    expect(wrapper.text()).toContain('查看口径');
    expect(wrapper.find('.management-section-canvas').exists()).toBe(true);
  });

  it('工作台在排名结果条目较多时应展示表格和纵向榜单图表', async () => {
    vi.mocked(analysisService.getCapabilities).mockResolvedValue({
      serviceStatus: 'ONLINE',
      scopeSummary: '当前仅可查看销售总监授权数据。',
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
      dataFreshnessAt: '2026-04-18T09:00:00.000Z',
      visibleMenus: ['analysis-workbench', 'contract-review'],
      actionKeys: ['analysis.use', 'analysis.export'],
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
    vi.mocked(analysisService.listTemplates).mockResolvedValue({ items: [] });
    vi.mocked(analysisService.listRecentQueries).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
    });
    const store = useAnalysisQueryStore();
    store.capabilities = {
      serviceStatus: 'ONLINE',
      scopeSummary: '当前仅展示销售总监权限范围。',
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
      dataFreshnessAt: '2026-04-18T09:00:00.000Z',
      visibleMenus: ['analysis-workbench', 'contract-review'],
      actionKeys: ['analysis.use', 'analysis.export'],
      followUpAllowed: true,
      templateViewAllowed: true,
      contractWorkspaceAllowed: true,
      wecomBotAccessState: 'ALLOWED',
      contractPermissions: {
        uploadAllowed: true,
        crossViewAllowed: false,
        crossDownloadAllowed: false,
      },
    };
    store.currentResult = {
      queryId: 'query_dense_001',
      status: 'RETURNED',
      title: '新增商机金额排名报告',
      summary: '最近三个月负责人排名已生成。',
      scopeSummary: '当前仅展示销售总监权限范围。',
      explanation: '当前结果基于统一结果包生成。',
      dataFreshnessAt: '2026-04-18T09:00:00.000Z',
      report: {
        variant: 'ranking',
        reportTitle: '新增商机金额排名报告',
        executiveSummary: '最近三个月负责人排名已生成。',
        keyFindings: [],
        metricCards: [{ name: '累计金额', value: '39,000,000' }],
        chartBlocks: [
          {
            blockId: 'chart_001',
            title: '新增商机金额负责人排名',
            viewType: 'BAR_CHART',
            datasetId: 'dataset_001',
            series: Array.from({ length: 10 }, (_, index) => ({
              label: `负责人${index + 1}`,
              value: 3900000 - index * 100000,
            })),
          },
        ],
        tableBlocks: [
          {
            blockId: 'table_001',
            title: '新增商机金额负责人排名明细',
            datasetId: 'dataset_001',
            rows: Array.from({ length: 10 }, (_, index) => ({
              ownerName: `负责人${index + 1}`,
              amount: 3900000 - index * 100000,
            })),
          },
        ],
        sections: [],
        datasetReferences: [
          {
            datasetId: 'dataset_001',
            taskId: 'task_001',
            taskTitle: '新增商机金额负责人排名',
            purpose: 'primary-summary',
            rowCount: 10,
          },
        ],
        scopeSummary: '当前仅展示销售总监权限范围。',
        appliedFilters: [],
        availableActions: [],
      },
      metricCards: [{ name: '累计金额', value: '39,000,000' }],
      tableRows: Array.from({ length: 10 }, (_, index) => ({
        ownerName: `负责人${index + 1}`,
        amount: 3900000 - index * 100000,
      })),
      streamBlocks: [],
      availableActions: [],
    };
    store.viewState = 'reported';

    const wrapper = mount(AnalysisWorkbenchPage, pageMountOptions);
    await flushPromises();

    expect(wrapper.text()).toContain('新增商机金额负责人排名明细');
    expect(wrapper.find('.chart-panel__title').exists()).toBe(true);
    expect(wrapper.find('.chart-ranking-list').exists()).toBe(true);
    expect(wrapper.find('.chart-horizontal-list').exists()).toBe(false);
  });

  it('工作台查询页应直接展示 richer report 的趋势预测与经营建议', async () => {
    const capabilities: AnalysisCapability = {
      serviceStatus: 'ONLINE',
      scopeSummary: '当前仅可查看销售总监授权数据。',
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
      dataFreshnessAt: '2026-04-18T09:00:00.000Z',
      visibleMenus: ['analysis-workbench', 'contract-review'],
      actionKeys: ['analysis.use', 'analysis.export'],
      followUpAllowed: true,
      templateViewAllowed: true,
      contractWorkspaceAllowed: true,
      wecomBotAccessState: 'ALLOWED',
      contractPermissions: {
        uploadAllowed: true,
        crossViewAllowed: false,
        crossDownloadAllowed: false,
      },
    };
    vi.mocked(analysisService.getCapabilities).mockResolvedValue(capabilities);
    vi.mocked(analysisService.listTemplates).mockResolvedValue({ items: [] });
    vi.mocked(analysisService.listRecentQueries).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
    });

    const store = useAnalysisQueryStore();
    store.capabilities = capabilities;
    store.currentResult = {
      queryId: 'query_rich_001',
      status: 'RETURNED',
      title: '新增商机金额趋势分析',
      summary: '最近四个月新增商机金额趋势已生成。',
      report: {
        variant: 'trend',
        reportTitle: '新增商机金额趋势分析',
        executiveSummary: '最近四个月新增商机金额趋势已生成。',
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
          predictedValue: 162,
          predictedRangeLow: 150,
          predictedRangeHigh: 175,
          confidenceLevel: 'MEDIUM',
          drivers: ['近四期趋势延续'],
          caveats: ['当前预测仅供短期参考。'],
          summary: '预计下一周期大概率落在 150 到 175 之间。',
        },
        anomalyInsights: [],
        riskInsights: [
          {
            riskType: 'RESULT_RISK',
            title: '样本长度有限',
            detail: '当前结果仅包含 4 个时间点。',
            severity: 'MEDIUM',
          },
        ],
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
        metricCards: [{ name: '累计金额', value: '565' }],
        chartBlocks: [],
        tableBlocks: [],
        sections: [],
        datasetReferences: [],
        scopeSummary: '当前仅展示销售总监权限范围。',
        appliedFilters: [],
        detailMarkdown: '## 执行摘要\n最近四个月新增商机金额趋势已生成。\n## 趋势预测\n预计下一周期大概率落在 150 到 175 之间。',
        availableActions: [],
      },
      metricCards: [{ name: '累计金额', value: '565' }],
      tableRows: [
        { bucket_label: '2026-01', amount: 120, count: 2 },
        { bucket_label: '2026-02', amount: 135, count: 2 },
        { bucket_label: '2026-03', amount: 148, count: 3 },
        { bucket_label: '2026-04', amount: 162, count: 3 },
      ],
      streamBlocks: [],
      availableActions: [],
    };
    store.viewState = 'reported';

    const wrapper = mount(AnalysisWorkbenchPage, pageMountOptions);
    await flushPromises();

    expect(wrapper.text()).toContain('趋势预测');
    expect(wrapper.text()).toContain('经营建议');
    expect(wrapper.text()).toContain('150 到 175');
    expect(wrapper.find('.analysis-rich-report__markdown-toggle').exists()).toBe(true);
  });

  it('排名结果条目较多时，详情页应展示表格和纵向榜单图表', async () => {
    mockRoute.path = '/analysis/results/query_004';
    mockRoute.params = { queryId: 'query_004' };

    vi.mocked(analysisService.getQuery).mockResolvedValue({
      queryId: 'query_004',
      status: 'RETURNED',
      title: '新增商机金额排名报告',
      summary: '最近三个月负责人排名已生成。',
      scopeSummary: '当前仅展示销售总监权限范围。',
      explanation: '当前结果基于统一结果包生成。',
      dataFreshnessAt: '2026-04-18T09:00:00.000Z',
      report: {
        variant: 'ranking',
        reportTitle: '新增商机金额排名报告',
        executiveSummary: '最近三个月负责人排名已生成。',
        keyFindings: [],
        metricCards: [{ name: '累计金额', value: '39,000,000' }],
        chartBlocks: [
          {
            blockId: 'chart_001',
            title: '新增商机金额负责人排名',
            viewType: 'BAR_CHART',
            datasetId: 'dataset_001',
            series: Array.from({ length: 10 }, (_, index) => ({
              label: `负责人${index + 1}`,
              value: 3900000 - index * 100000,
            })),
          },
        ],
        tableBlocks: [
          {
            blockId: 'table_001',
            title: '新增商机金额负责人排名明细',
            datasetId: 'dataset_001',
            rows: Array.from({ length: 10 }, (_, index) => ({
              ownerName: `负责人${index + 1}`,
              amount: 3900000 - index * 100000,
            })),
          },
        ],
        sections: [],
        datasetReferences: [
          {
            datasetId: 'dataset_001',
            taskId: 'task_001',
            taskTitle: '新增商机金额负责人排名',
            purpose: 'primary-summary',
            rowCount: 10,
          },
        ],
        scopeSummary: '当前仅展示销售总监权限范围。',
        appliedFilters: [],
        availableActions: [],
      },
      metricCards: [{ name: '累计金额', value: '39,000,000' }],
      tableRows: Array.from({ length: 10 }, (_, index) => ({
        ownerName: `负责人${index + 1}`,
        amount: 3900000 - index * 100000,
      })),
      streamBlocks: [],
      availableActions: [],
    });

    const wrapper = mount(AnalysisResultDetailPage, pageMountOptions);
    await flushPromises();

    expect(wrapper.find('.table-panel__title').exists()).toBe(true);
    expect(wrapper.find('.chart-panel__title').exists()).toBe(true);
    expect(wrapper.find('.chart-ranking-list').exists()).toBe(true);
    expect(wrapper.find('.chart-horizontal-list').exists()).toBe(false);
  });

  it('工作台模板结果摘要和关键结论应高亮数值并区分语义颜色', async () => {
    const capabilities: AnalysisCapability = {
      serviceStatus: 'ONLINE',
      scopeSummary: '当前仅可查看销售总监授权数据。',
      roleNames: ['销售总监'],
      channels: ['web-console'],
      domains: ['opportunity-analysis'],
      metrics: ['全年完成预测'],
      dimensions: ['团队'],
      exportAllowed: true,
      exportRowLimit: 1000,
      exportDailyLimit: 3,
      remainingDailyExports: 3,
      historyEnabled: true,
      templateCount: 1,
      dataFreshnessAt: '2026-04-18T09:00:00.000Z',
      visibleMenus: ['analysis-workbench'],
      actionKeys: ['analysis.use', 'analysis.export'],
      followUpAllowed: true,
      templateViewAllowed: true,
      contractWorkspaceAllowed: false,
      wecomBotAccessState: 'ALLOWED',
      contractPermissions: {
        uploadAllowed: false,
        crossViewAllowed: false,
        crossDownloadAllowed: false,
      },
    };

    vi.mocked(analysisService.getCapabilities).mockResolvedValue(capabilities);
    vi.mocked(analysisService.listTemplates).mockResolvedValue({ items: [] });
    vi.mocked(analysisService.listRecentQueries).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
    });

    const authStore = useAuthStore();
    authStore.capabilities = capabilities;
    authStore.capabilitiesHydratedAt = Date.now();

    const store = useAnalysisQueryStore();
    store.bootstrapped = true;
    store.bootstrapHydratedAt = Date.now();
    store.capabilities = capabilities;
    store.viewState = 'reported';
    store.currentResult = {
      queryId: 'query_colored_numbers',
      status: 'RETURNED',
      title: '全年完成预测总览',
      summary:
        '全年完成预测总览显示，当前有效收入6,112.03，承诺商机16,578.63，短期预测区间18,152.53-27,228.79。',
      keyFindings: [
        {
          title: '短期预测区间宽幅运行',
          detail: '预测区间宽度达9,076.26，离散度较高。',
          tone: 'risk',
          datasetId: 'dataset_forecast',
        },
      ],
      metricCards: [{ name: '有效收入', value: '6,112.03' }],
      tableRows: [],
      streamBlocks: [],
      availableActions: [],
    };

    const wrapper = mount(AnalysisWorkbenchPage, pageMountOptions);
    await flushPromises();

    expect(wrapper.find('.result-region__summary .number-tone[data-tone="success"]').text()).toBe('6,112.03');
    expect(wrapper.findAll('.finding-card .number-tone[data-tone="danger"]').map((item) => item.text())).toContain(
      '9,076.26',
    );
    expect(wrapper.find('.result-region__summary .number-tone[data-tone="normal"]').exists()).toBe(true);
  });

  it('模板内容抽屉应优先展示归属用户姓名而不是用户 ID', async () => {
    const capabilities: AnalysisCapability = {
      serviceStatus: 'ONLINE',
      scopeSummary: '当前仅可查看销售总监授权数据。',
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
      dataFreshnessAt: '2026-04-18T09:00:00.000Z',
      visibleMenus: ['analysis-workbench'],
      actionKeys: ['analysis.use', 'template.view'],
      followUpAllowed: true,
      templateViewAllowed: true,
      contractWorkspaceAllowed: false,
      wecomBotAccessState: 'ALLOWED',
      contractPermissions: {
        uploadAllowed: false,
        crossViewAllowed: false,
        crossDownloadAllowed: false,
      },
    };
    const template = {
      templateId: 'tpl_owner_name',
      name: '新增商机金额负责人排名报告',
      description: '查看新增商机金额负责人排名。',
      defaultQuestionText: '新增商机金额负责人排名',
      defaultFilters: {},
      queryMode: 'FIXED_SQL',
      sqlText: 'SELECT 1 AS value',
      sqlVersion: '2026.05.28',
      ownerUserId: '2224755',
      ownerName: '王亮2',
      visibleRoleIds: ['role_sales_director'],
      displayOrder: 1,
      clickCount7d: 0,
      hitRatePercent: 98,
      optimizationStatus: 'HEALTHY',
      status: 'ACTIVE',
      updatedAt: '2026-05-28T09:00:00.000Z',
    } as any;

    vi.mocked(analysisService.getCapabilities).mockResolvedValue(capabilities);
    vi.mocked(analysisService.listTemplates).mockResolvedValue({ items: [template] });
    vi.mocked(analysisService.listRecentQueries).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
    });
    vi.mocked(analysisService.getTemplate).mockResolvedValue(template);

    const authStore = useAuthStore();
    authStore.capabilities = capabilities;
    authStore.capabilitiesHydratedAt = Date.now();

    const store = useAnalysisQueryStore();
    store.bootstrapped = true;
    store.bootstrapHydratedAt = Date.now();
    store.capabilities = capabilities;
    store.templates = [template];

    const wrapper = mount(AnalysisWorkbenchPage, pageMountOptions);
    await flushPromises();

    await (wrapper.vm as any).openTemplateDetail('tpl_owner_name');
    await flushPromises();

    const detailText = document.body.textContent ?? '';
    expect(detailText).toContain('归属用户');
    expect(detailText).toContain('王亮2');
    expect(detailText).not.toContain('2224755');
  });

  it('我的模板内容抽屉应支持编辑基础信息并保存', async () => {
    const capabilities: AnalysisCapability = {
      serviceStatus: 'ONLINE',
      scopeSummary: '当前仅可查看销售总监授权数据。',
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
      dataFreshnessAt: '2026-04-18T09:00:00.000Z',
      visibleMenus: ['analysis-workbench'],
      actionKeys: ['analysis.use', 'template.view'],
      followUpAllowed: true,
      templateViewAllowed: true,
      contractWorkspaceAllowed: false,
      wecomBotAccessState: 'ALLOWED',
      contractPermissions: {
        uploadAllowed: false,
        crossViewAllowed: false,
        crossDownloadAllowed: false,
      },
    };
    const template = {
      templateId: 'tpl_mine_edit',
      name: '新增商机金额趋势分析报告',
      description: '查看新增商机金额趋势。',
      tags: ['商机'],
      defaultQuestionText: '新增商机金额趋势',
      defaultFilters: {},
      defaultViewType: 'LINE_CHART',
      queryMode: 'FIXED_SQL',
      sqlText: 'SELECT 1 AS value',
      sqlVersion: '2026.05.28',
      ownerUserId: 'user_sales_director',
      ownerName: '销售总监',
      visibleRoleIds: [],
      displayOrder: 1,
      clickCount7d: 0,
      hitRatePercent: 98,
      optimizationStatus: 'HEALTHY',
      status: 'ACTIVE',
      updatedAt: '2026-05-28T09:00:00.000Z',
    } as any;
    const updatedTemplate = {
      ...template,
      name: '第一季度商机金额趋势分析报告',
      description: '查看第一季度新增商机金额趋势。',
      defaultQuestionText: '第一季度商机金额趋势',
      defaultViewType: 'BAR_CHART',
      tags: ['商机', '趋势'],
      updatedAt: '2026-05-29T09:00:00.000Z',
    };

    vi.mocked(analysisService.getCapabilities).mockResolvedValue(capabilities);
    vi.mocked(analysisService.listTemplates).mockResolvedValue({ items: [updatedTemplate] });
    vi.mocked(analysisService.listRecentQueries).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
    });
    vi.mocked(analysisService.getTemplate).mockResolvedValue(template);
    vi.mocked(analysisService.updateMyTemplate).mockResolvedValue(updatedTemplate);

    const authStore = useAuthStore();
    authStore.capabilities = capabilities;
    authStore.capabilitiesHydratedAt = Date.now();

    const store = useAnalysisQueryStore();
    store.bootstrapped = true;
    store.bootstrapHydratedAt = Date.now();
    store.capabilities = capabilities;
    store.templates = [template];
    store.templateListMeta = {
      scope: 'mine',
      page: 1,
      pageSize: 20,
      total: 1,
      tags: ['商机', '趋势'],
    };

    const wrapper = mount(AnalysisWorkbenchPage, pageMountOptions);
    await flushPromises();

    await (wrapper.vm as any).openTemplateDetail('tpl_mine_edit');
    await flushPromises();

    const form = (wrapper.vm as any).templateDetailForm;
    form.name = '第一季度商机金额趋势分析报告';
    form.description = '查看第一季度新增商机金额趋势。';
    form.defaultQuestionText = '第一季度商机金额趋势';
    form.defaultViewType = 'BAR_CHART';
    form.tags = ['商机', '趋势'];

    await (wrapper.vm as any).saveTemplateDetail();
    await flushPromises();

    expect(analysisService.updateMyTemplate).toHaveBeenCalledWith('tpl_mine_edit', {
      name: '第一季度商机金额趋势分析报告',
      description: '查看第一季度新增商机金额趋势。',
      defaultQuestionText: '第一季度商机金额趋势',
      defaultViewType: 'BAR_CHART',
      tags: ['商机', '趋势'],
    });
    expect((wrapper.vm as any).selectedTemplateSnapshot.name).toBe('第一季度商机金额趋势分析报告');
    expect((wrapper.vm as any).templateDetailDrawerVisible).toBe(false);
  });

  it('模板详情编辑区应过滤系统来源标签，保存时只提交业务标签', async () => {
    const capabilities: AnalysisCapability = {
      serviceStatus: 'ONLINE',
      scopeSummary: '当前仅可查看销售总监授权数据。',
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
      dataFreshnessAt: '2026-04-18T09:00:00.000Z',
      visibleMenus: ['analysis-workbench'],
      actionKeys: ['analysis.use', 'template.view'],
      followUpAllowed: true,
      templateViewAllowed: true,
      contractWorkspaceAllowed: false,
      wecomBotAccessState: 'ALLOWED',
      contractPermissions: {
        uploadAllowed: false,
        crossViewAllowed: false,
        crossDownloadAllowed: false,
      },
    };
    const template = {
      templateId: 'tpl_system_tags',
      name: '近一周新增商机明细',
      description: '查看近一周新增商机明细。',
      tags: ['内置模板', '常用查询', '商机跟进'],
      defaultQuestionText: '近一周新增商机明细',
      defaultFilters: {},
      defaultViewType: 'DETAIL_TABLE',
      queryMode: 'FIXED_SQL',
      sqlText: 'SELECT 1 AS value',
      sqlVersion: '2026.05.28',
      ownerUserId: 'user_sales_director',
      ownerName: '销售总监',
      visibleRoleIds: [],
      displayOrder: 1,
      clickCount7d: 0,
      hitRatePercent: 98,
      optimizationStatus: 'HEALTHY',
      status: 'ACTIVE',
      updatedAt: '2026-05-29T09:00:00.000Z',
    } as any;
    const updatedTemplate = {
      ...template,
      tags: ['商机跟进'],
    };

    vi.mocked(analysisService.getCapabilities).mockResolvedValue(capabilities);
    vi.mocked(analysisService.listTemplates).mockResolvedValue({ items: [updatedTemplate] });
    vi.mocked(analysisService.listRecentQueries).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
    });
    vi.mocked(analysisService.getTemplate).mockResolvedValue(template);
    vi.mocked(analysisService.updateMyTemplate).mockResolvedValue(updatedTemplate);

    const authStore = useAuthStore();
    authStore.capabilities = capabilities;
    authStore.capabilitiesHydratedAt = Date.now();

    const store = useAnalysisQueryStore();
    store.bootstrapped = true;
    store.bootstrapHydratedAt = Date.now();
    store.capabilities = capabilities;
    store.templates = [template];
    store.templateListMeta = {
      scope: 'mine',
      page: 1,
      pageSize: 20,
      total: 1,
      tags: ['内置模板', '常用查询', '商机跟进'],
    };

    const wrapper = mount(AnalysisWorkbenchPage, pageMountOptions);
    await flushPromises();

    await (wrapper.vm as any).openTemplateDetail('tpl_system_tags');
    await flushPromises();

    expect((wrapper.vm as any).templateDetailForm.tags).toEqual(['商机跟进']);
    expect((wrapper.vm as any).visibleTemplateDetailTagOptions).toEqual(['商机跟进']);

    await (wrapper.vm as any).saveTemplateDetail();
    await flushPromises();

    expect(analysisService.updateMyTemplate).toHaveBeenCalledWith(
      'tpl_system_tags',
      expect.objectContaining({
        tags: ['商机跟进'],
      }),
    );
  });

  it('模板内容抽屉执行模板完成后应自动关闭', async () => {
    const capabilities: AnalysisCapability = {
      serviceStatus: 'ONLINE',
      scopeSummary: '当前仅可查看销售总监授权数据。',
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
      dataFreshnessAt: '2026-04-18T09:00:00.000Z',
      visibleMenus: ['analysis-workbench'],
      actionKeys: ['analysis.use', 'template.view'],
      followUpAllowed: true,
      templateViewAllowed: true,
      contractWorkspaceAllowed: false,
      wecomBotAccessState: 'ALLOWED',
      contractPermissions: {
        uploadAllowed: false,
        crossViewAllowed: false,
        crossDownloadAllowed: false,
      },
    };
    const template = {
      templateId: 'tpl_run_close',
      name: '近一周新增商机明细',
      description: '查看近一周新增商机明细。',
      defaultQuestionText: '近一周新增商机明细',
      defaultFilters: {},
      defaultViewType: 'DETAIL_TABLE',
      queryMode: 'FIXED_SQL',
      sqlText: 'SELECT 1 AS value',
      sqlVersion: '2026.05.28',
      ownerUserId: 'user_sales_director',
      ownerName: '销售总监',
      visibleRoleIds: [],
      displayOrder: 1,
      clickCount7d: 0,
      hitRatePercent: 98,
      optimizationStatus: 'HEALTHY',
      status: 'ACTIVE',
      updatedAt: '2026-05-29T09:00:00.000Z',
    } as any;

    vi.mocked(analysisService.getCapabilities).mockResolvedValue(capabilities);
    vi.mocked(analysisService.listTemplates).mockResolvedValue({ items: [template] });
    vi.mocked(analysisService.listRecentQueries).mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
    });
    vi.mocked(analysisService.getTemplate).mockResolvedValue(template);
    vi.mocked(analysisService.executeTemplate).mockResolvedValue({
      queryId: 'query_run_close',
      templateId: 'tpl_run_close',
      queryMode: 'FIXED_SQL',
      sqlVersion: '2026.05.28',
      resultBundle: {},
      insightBundle: {},
      executedAt: '2026-05-29T09:00:00.000Z',
    });
    vi.mocked(analysisService.getQuery).mockResolvedValue({
      queryId: 'query_run_close',
      status: 'RETURNED',
      title: '近一周新增商机明细',
      summary: '已返回近一周新增商机明细。',
      tableRows: [],
      streamBlocks: [],
      availableActions: [],
    });

    const authStore = useAuthStore();
    authStore.capabilities = capabilities;
    authStore.capabilitiesHydratedAt = Date.now();

    const store = useAnalysisQueryStore();
    store.bootstrapped = true;
    store.bootstrapHydratedAt = Date.now();
    store.capabilities = capabilities;
    store.templates = [template];

    const wrapper = mount(AnalysisWorkbenchPage, pageMountOptions);
    await flushPromises();

    await (wrapper.vm as any).openTemplateDetail('tpl_run_close');
    await flushPromises();
    expect((wrapper.vm as any).templateDetailDrawerVisible).toBe(true);

    await (wrapper.vm as any).runSelectedTemplateFromDetail();
    await flushPromises();

    expect(analysisService.executeTemplate).toHaveBeenCalledWith('tpl_run_close', {
      parameters: {},
      includeAiReport: true,
    });
    expect((wrapper.vm as any).templateDetailDrawerVisible).toBe(false);
  });
});

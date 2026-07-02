import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { appRoutes } from '@/router';
import { useAuthStore } from '@/stores/auth.store';
import ManagementReportPage from '@/pages/management-report/ManagementReportPage.vue';
import ManagementReportFilters from '@/components/management-report/ManagementReportFilters.vue';
import { managementReportService } from '@/services/management-report.service';

vi.mock('@/services/management-report.service', () => ({
  managementReportService: {
    getOptions: vi.fn(),
    getSnapshot: vi.fn(),
    getSection: vi.fn(),
    exportReport: vi.fn(),
  },
}));

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await nextTick();
  await Promise.resolve();
  await nextTick();
}

function mountPage() {
  return mount(ManagementReportPage, {
    global: {
      stubs: {
        'el-tree-select': true,
        'el-select': true,
        'el-option': true,
        'el-date-picker': true,
        'el-button': {
          template: '<button><slot /></button>',
        },
        'el-icon': true,
        'el-popover': {
          template: '<div><slot name="reference" /></div>',
        },
      },
    },
  });
}

describe('management report page', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const authStore = useAuthStore();
    authStore.capabilities = {
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
    };

    vi.mocked(managementReportService.getOptions).mockResolvedValue({
      scopeSummary: '当前展示销售团队授权范围。',
      presets: [
        { key: 'q1', label: '当年 Q1' },
        { key: 'custom', label: '自定义' },
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
    });
    vi.mocked(managementReportService.getSnapshot).mockResolvedValue({
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
        summary: '核心经营指标已完成汇总。',
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
        summary: '本期经营节奏稳定，回款优先级最高。',
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
            rows: [
              { label: '商机', value: '高阶段商机集中在华东销售部。' },
            ],
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
          summary: '回款与应收状态已就绪。',
          timeBasis: '收款按 received_payments.receive_date 聚合。',
        },
        {
          sectionKey: 'risks',
          title: '经营风险与建议',
          loadMode: 'lazy',
          available: true,
          state: 'ready',
          summary: '汇总高风险对象并给出优先动作建议。',
          timeBasis: '风险专题按 endDate 截面统计。',
        },
        {
          sectionKey: 'products',
          title: '产品方案',
          loadMode: 'lazy',
          available: true,
          state: 'degraded',
          summary: '围绕产品方案、行业方案和关键词热度查看方案经营。',
          timeBasis: '产品方案当前基于商机产品方案字段和行业方案字段统计。',
        },
      ],
    });
    vi.mocked(managementReportService.getSection).mockResolvedValue({
      reportId: 'report_q1',
      sectionKey: 'collections',
      generatedAt: '2026-04-24T10:00:00.000Z',
      timeBasis: '实际回款按 received_payments.receive_date 聚合。',
      scopeBasis: '当前展示销售团队授权范围。',
      section: {
        sectionKey: 'collections',
        title: '收款情况',
        summary: '本期应收与已回款已完成对账。',
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
            rows: [{ ownerName: '张琳', receivedAmount: '58 万元' }],
          },
          {
            blockId: 'collections-trend',
            blockType: 'trend',
            title: '月度回款趋势',
            size: 'wide',
            points: [
              { label: '2026-01', value: 120000 },
              { label: '2026-02', value: 180000 },
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
            rows: [{ customerName: '山东农信', amount: '12 万元' }],
          },
        ],
        footnotes: ['按合同归属负责人汇总。'],
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
    });
    vi.mocked(managementReportService.exportReport).mockResolvedValue({
      reportId: 'report_q1',
      fileName: '经营报表-2026Q1.csv',
      mimeType: 'text/csv;charset=utf-8',
      format: 'csv',
      content: '经营报表,2026Q1',
    });
  });

  it('核心收敛模式下不再注册经营报表路由', () => {
    const route = appRoutes.find((item) => item.name === 'management-report');

    expect(route).toBeUndefined();
  });

  it('应在页面初始化后展示首屏双专题与多块内容', async () => {
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain('经营报表');
    expect(wrapper.text()).not.toContain('经营驾驶舱');
    expect(wrapper.text()).toContain('总览');
    expect(wrapper.text()).toContain('线索-客户-商机漏斗');
    expect(wrapper.text()).not.toContain('一句话经营结论');
    expect(wrapper.text()).not.toContain('本周经营动作');
  });

  it('应把查询按钮放到筛选区域并默认显示总览 tab', async () => {
    const wrapper = mountPage();
    await flushPromises();

    const buttons = wrapper.findAll('button').map((item) => item.text());
    const queryIndex = buttons.findIndex((item) => item.includes('查询'));
    const exportIndex = buttons.findIndex((item) => item.includes('导出报表'));

    expect(queryIndex).toBeGreaterThan(-1);
    expect(exportIndex).toBeGreaterThan(-1);
    expect(wrapper.text()).not.toContain('刷新报表');
    expect(wrapper.text()).toContain('总览');
    expect(wrapper.text()).not.toContain('经营摘要本期经营节奏稳定');
  });

  it('切换到经营摘要后应只渲染该 tab，并默认折叠口径说明', async () => {
    const wrapper = mountPage();
    await flushPromises();

    const summaryTab = wrapper
      .findAll('button')
      .find((item) => item.text().includes('经营摘要'));

    expect(summaryTab).toBeTruthy();

    await summaryTab!.trigger('click');
    await flushPromises();

    const blockTitles = wrapper
      .findAll('.management-section-canvas__block h3')
      .map((item) => item.text());

    expect(blockTitles.indexOf('关键经营指标')).toBeGreaterThan(-1);
    expect(blockTitles.indexOf('一句话经营结论')).toBeGreaterThan(-1);
    expect(wrapper.text()).toContain('一句话经营结论');
    expect(wrapper.text()).toContain('本周经营动作');
    expect(wrapper.text()).toContain('关键经营指标');
    expect(wrapper.text()).not.toContain('线索-客户-商机漏斗');
    expect(wrapper.text()).not.toContain('本期经营节奏稳定，回款优先级最高。');
    expect(wrapper.text()).not.toContain('管理层摘要聚焦结论、动作、风险与关键指标。');
    expect(wrapper.text()).toContain('查看口径');
    expect(wrapper.text()).not.toContain('统计筛选期内实际回款金额。');
  });

  it('切换时间快捷项后应同步更新起止日期，并按新日期刷新快照', async () => {
    const wrapper = mountPage();
    await flushPromises();

    const filterComponent = wrapper.findComponent(ManagementReportFilters);
    expect(filterComponent.exists()).toBe(true);

    vi.mocked(managementReportService.getSnapshot).mockClear();

    filterComponent.vm.$emit('update:modelValue', {
      departmentId: 'all-company',
      presetKey: 'q2',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
    });
    await flushPromises();

    const pageVm = wrapper.vm as unknown as {
      filters: {
        departmentId: string;
        presetKey: string;
        startDate: string;
        endDate: string;
      };
      handleApplyFilters: () => Promise<void>;
    };

    expect(pageVm.filters).toMatchObject({
      presetKey: 'q2',
      startDate: '2026-04-01',
      endDate: '2026-06-30',
    });

    await pageVm.handleApplyFilters();
    await flushPromises();

    expect(managementReportService.getSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        presetKey: 'q2',
        startDate: '2026-04-01',
        endDate: '2026-06-30',
      }),
    );
  });

  it('手动调整起止日期后应切换为自定义时间范围并按自定义日期查询', async () => {
    const wrapper = mountPage();
    await flushPromises();

    const filterComponent = wrapper.findComponent(ManagementReportFilters);
    expect(filterComponent.exists()).toBe(true);

    vi.mocked(managementReportService.getSnapshot).mockClear();

    filterComponent.vm.$emit('update:modelValue', {
      departmentId: 'all-company',
      presetKey: 'custom',
      startDate: '2026-05-01',
      endDate: '2026-05-31',
    });
    await flushPromises();

    const pageVm = wrapper.vm as unknown as {
      filters: {
        departmentId: string;
        presetKey: string;
        startDate: string;
        endDate: string;
      };
      handleApplyFilters: () => Promise<void>;
    };

    expect(pageVm.filters).toMatchObject({
      presetKey: 'custom',
      startDate: '2026-05-01',
      endDate: '2026-05-31',
    });

    await pageVm.handleApplyFilters();
    await flushPromises();

    expect(managementReportService.getSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        presetKey: 'custom',
        startDate: '2026-05-01',
        endDate: '2026-05-31',
      }),
    );
  });

  it('专题加载失败时应展示区块级重试入口，并在重试成功后恢复内容', async () => {
    vi.mocked(managementReportService.getSection)
      .mockRejectedValueOnce(new Error('专题加载失败，请稍后重试。'))
      .mockResolvedValueOnce({
        reportId: 'report_q1',
        sectionKey: 'collections',
        generatedAt: '2026-04-24T10:00:00.000Z',
        timeBasis: '实际回款按 received_payments.receive_date 聚合。',
        scopeBasis: '当前展示销售团队授权范围。',
        section: {
          sectionKey: 'collections',
          title: '收款情况',
          summary: '本期应收与已回款已完成对账。',
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
              ],
            },
          ],
          footnotes: [],
          sourceNotes: [],
        },
      });

    const wrapper = mountPage();
    await flushPromises();

    const sectionTab = wrapper
      .findAll('button')
      .find((item) => item.text().includes('收款情况'));
    expect(sectionTab).toBeTruthy();

    await sectionTab!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('专题加载失败，请稍后重试。');
    expect(wrapper.text()).toContain('重试加载专题');

    const retryButton = wrapper
      .findAll('button')
      .find((item) => item.text().includes('重试加载专题'));
    expect(retryButton).toBeTruthy();

    await retryButton!.trigger('click');
    await flushPromises();

    expect(managementReportService.getSection).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('收款摘要');
  });

  it('有数据块的降级专题应继续渲染专题内容', async () => {
    vi.mocked(managementReportService.getSection).mockResolvedValueOnce({
      reportId: 'report_q1',
      sectionKey: 'products',
      generatedAt: '2026-04-24T10:00:00.000Z',
      timeBasis: '产品方案当前基于商机产品方案字段和行业方案字段统计。',
      scopeBasis: '当前展示销售团队授权范围。',
      section: {
        sectionKey: 'products',
        title: '产品方案',
        summary: '产品专题先覆盖方案总览、方案排行和字段完整度，避免继续只有占位文案。',
        state: 'degraded',
        blocks: [
          {
            blockId: 'products-summary',
            blockType: 'metric-strip',
            title: '产品经营总览',
            size: 'full',
            items: [
              { label: '产品方案数', value: '8' },
              { label: '行业方案数', value: '5' },
            ],
          },
          {
            blockId: 'products-product-top',
            blockType: 'bar-ranking',
            title: '产品解决方案机会规模 Top',
            size: 'wide',
            rows: [{ label: '低代码平台', value: 12 }],
            unitLabel: '个',
          },
        ],
        footnotes: ['产品方案专题重点观察方案覆盖和机会集中方向。'],
        sourceNotes: [],
      },
    });

    const wrapper = mountPage();
    await flushPromises();

    const sectionTab = wrapper
      .findAll('button')
      .find((item) => item.text().includes('产品方案'));
    expect(sectionTab).toBeTruthy();

    await sectionTab!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('产品经营总览');
    expect(wrapper.text()).toContain('产品解决方案机会规模 Top');
    expect(wrapper.text()).not.toContain('专题暂不可用');
  });
});

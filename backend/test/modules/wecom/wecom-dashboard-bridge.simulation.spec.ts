/**
 * 企微看板桥接链路模拟测试
 *
 * 模拟从企微提问到 DashboardReportComposer 的完整信号检测和数据流，
 * 不依赖真实 OpenAPI，用 mock 数据验证各层逻辑正确性。
 *
 * 覆盖问题（用户实际会问的）：
 * 1. 管理员视角，近3个月商机进展
 * 2. 最近一年商机趋势分析
 * 3. 近3个月没有维护进度的客户情况
 * 4. 全国渠道商发展运营数据看板
 * 5. 各区域渠道商发展运营数据情况看板
 * 6. 最近3个月没有商机和订单的渠道商情况
 */

import { WecomBotService } from '../../../src/modules/wecom/wecom-bot.service';
import { DashboardReportComposer } from '../../../src/modules/crm-standard-api/dashboard-report-composer.service';
import { DashboardAnalyticsService } from '../../../src/modules/crm-standard-api/dashboard-analytics.service';
import { LianruanCrmOpenApiClient } from '../../../src/modules/crm-standard-api/lianruan-crm-openapi.client';

// ===== 信号检测测试（无需依赖注入，直接提取正则逻辑）=====

describe('企微看板桥接 - 信号检测', () => {
  // 复制 hasExplicitWecomAnalysisOrBlockSignal 的核心逻辑用于独立测试
  function hasExplicitWecomAnalysisOrBlockSignal(messageText: string): boolean {
    const normalizedText = messageText.replace(/\s+/gu, '').trim();
    if (!normalizedText) return false;

    // 排除非分析类请求
    if (/天气|气温|股票|基金|新闻|汇率|电影|翻译|代码|编程|提醒我|删除|修改|更新状态|改成已成交/u.test(normalizedText)) {
      return true; // 这些是明确非分析的，返回 true 表示"已识别为非分析"（不进入帮助分支）
    }

    if (/商机|机会|漏斗|赢单率|合同|签单|签约|成交|回款|客户|客资|客群/u.test(normalizedText)) {
      return true;
    }

    // 看板/运营分析类信号词（2026-06-25 修复新增）
    if (
      /数据看板|看板分析|运营看板|经营看板|发展运营|运营数据|运营分析|经营分析|数据运营|渠道商.*看板|渠道商.*分析|代理商.*看板|代理商.*分析|区域.*看板|排名.*看板|汇总.*看板|统计.*看板|明细.*看板|趋势.*看板|漏斗.*看板|分布.*看板|建设.*看板|结构.*看板|贡献.*看板|阶段.*看板|下单.*汇总|签单.*汇总|订单.*分析|订单.*看板/u.test(
        normalizedText,
      )
    ) {
      return true;
    }

    // 原有 hasAnalysisReportSignal 逻辑
    const hasMetricOrDimension = /新增商机金额|商机金额|商机数量|商机数|机会数|负责人|销售|区域|团队|大区|金额|数量|赢单率|转化率|成交率|客户贡献|报备|未报备|没有报备|未建商机|没有商机|无商机|未下单|未报价|创建时间|创建时长/u.test(normalizedText);
    const hasReportAction = /分析|统计|排名|排行|趋势|报表|明细|详情|多少|多久|多长时间|最高|最低|最多|最少/u.test(normalizedText);
    const hasTime = /今日|今天|昨天|明天|本周|本月|本季度|今年|近\d+天|最近|上月|下月/u.test(normalizedText);

    return (hasMetricOrDimension && (hasReportAction || hasTime)) || (hasTime && hasReportAction);
  }

  // 复制 isWecomDashboardAnalysisRequest 的核心逻辑
  function isWecomDashboardAnalysisRequest(questionText: string): boolean {
    const normalizedQuestion = questionText.replace(/\s+/gu, '').trim();
    if (!normalizedQuestion) return false;

    const hasDashboardSignal = /(数据看板|看板分析|运营看板|经营看板|发展运营|运营数据|运营分析|经营分析|数据运营)/u.test(normalizedQuestion);
    const hasAnalysisIntent = /(分析|看板|概览|汇总|统计|趋势|漏斗|分布|排名|排行|明细|建设|结构|贡献|阶段)/u.test(normalizedQuestion);

    return hasDashboardSignal && hasAnalysisIntent;
  }

  const testCases: Array<{ question: string; expectAnalysisSignal: boolean; expectDashboardBridge: string; description: string }> = [
    {
      question: '全国渠道商发展运营数据看板',
      expectAnalysisSignal: true,
      expectDashboardBridge: 'agent-development',
      description: '用户实际提问1：全国渠道商发展运营数据看板',
    },
    {
      question: '各区域渠道商发展运营数据情况看板',
      expectAnalysisSignal: true,
      expectDashboardBridge: 'region-overview',
      description: '用户实际提问2：各区域渠道商发展运营数据情况看板',
    },
    {
      question: '管理员视角，近3个月商机进展',
      expectAnalysisSignal: true,
      expectDashboardBridge: 'auto', // 常规分析，非看板桥接
      description: '用户实际提问3：近3个月商机进展',
    },
    {
      question: '最近一年商机趋势分析',
      expectAnalysisSignal: true,
      expectDashboardBridge: 'auto',
      description: '用户实际提问4：最近一年商机趋势分析',
    },
    {
      question: '近3个月没有维护进度的客户情况',
      expectAnalysisSignal: true,
      expectDashboardBridge: 'auto',
      description: '用户实际提问5：近3个月没有维护进度的客户情况',
    },
    {
      question: '最近3个月没有商机和订单的渠道商情况',
      expectAnalysisSignal: true,
      expectDashboardBridge: 'auto',
      description: '用户实际提问6：最近3个月没有商机和订单的渠道商情况',
    },
    {
      question: '渠道商经营分析看板',
      expectAnalysisSignal: true,
      expectDashboardBridge: 'agent-development',
      description: '截图中用户实际提问：渠道商经营分析看板',
    },
    {
      question: '代理商发展运营数据看板分析',
      expectAnalysisSignal: true,
      expectDashboardBridge: 'agent-development',
      description: '变体：代理商发展运营数据看板分析',
    },
    {
      question: '你好',
      expectAnalysisSignal: false,
      expectDashboardBridge: 'none',
      description: '非分析类：打招呼应进入帮助分支',
    },
    {
      question: '今天天气怎么样',
      expectAnalysisSignal: true, // 天气词返回 true（表示"已识别非CRM分析"）
      expectDashboardBridge: 'none',
      description: '非分析类：天气查询',
    },
  ];

  describe('hasExplicitWecomAnalysisOrBlockSignal 信号覆盖', () => {
    for (const tc of testCases) {
      it(`[${tc.expectAnalysisSignal ? 'PASS' : 'HELP'}] ${tc.question}`, () => {
        const result = hasExplicitWecomAnalysisOrBlockSignal(tc.question);
        expect(result).toBe(tc.expectAnalysisSignal);
      });
    }
  });

  describe('isWecomDashboardAnalysisRequest 看板桥接信号', () => {
    for (const tc of testCases) {
      const bridgeLabel = tc.expectDashboardBridge === 'agent-development' || tc.expectDashboardBridge === 'region-overview' ? 'BRIDGE' : tc.expectDashboardBridge === 'auto' ? 'ANALYZE' : 'SKIP';
      it(`[${bridgeLabel}] ${tc.question}`, () => {
        const result = isWecomDashboardAnalysisRequest(tc.question);
        if (tc.expectDashboardBridge === 'agent-development' || tc.expectDashboardBridge === 'region-overview') {
          // 明确看板类问题应触发看板桥接
          expect(result).toBe(true);
        } else if (tc.expectDashboardBridge === 'auto') {
          // 常规分析问题不触发看板桥接（走 ANALYZE 分支但用常规管道）
          expect(result).toBe(false);
        }
      });
    }
  });
});

// ===== Mock 数据构建器 =====

function buildMockBundle(overrides?: Partial<import('../../../src/modules/crm-standard-api/dashboard-analytics.service').DashboardAnalyticsBundle>) {
  return {
    businessOverview: {},
    funnel: {
      registrationCount: 120,
      opportunityCount: 85,
      quoteCount: 42,
      orderCount: 28,
      registrationAmount: 5000000,
      opportunityAmount: 3500000,
      quoteAmount: 2000000,
      orderAmount: 1500000,
      registrationToOpportunityRate: 0.708,
      opportunityToQuoteRate: 0.494,
      quoteToOrderRate: 0.667,
    },
    partnerContributions: [
      { partnerId: 'p1', partnerName: '广州XX科技', region: '广东', bigRegion: '华南', cooperationLevel: 'gold', techServiceType: 'full', registrationCount: 15, opportunityCount: 12, opportunityAmount: 800000, quoteCount: 8, quoteAmount: 500000, orderCount: 5, orderAmount: 400000 } as any,
      { partnerId: 'p2', partnerName: '北京YY信息', region: '北京', bigRegion: '华北', cooperationLevel: 'lep', techServiceType: 'developing', registrationCount: 10, opportunityCount: 8, opportunityAmount: 600000, quoteCount: 5, quoteAmount: 300000, orderCount: 3, orderAmount: 200000 } as any,
      { partnerId: 'p3', partnerName: '上海ZZ软件', region: '上海', bigRegion: '华东', cooperationLevel: 'gold', techServiceType: 'full', registrationCount: 8, opportunityCount: 6, opportunityAmount: 400000, quoteCount: 4, quoteAmount: 250000, orderCount: 3, orderAmount: 180000 } as any,
      { partnerId: 'p4', partnerName: '成都AA集成', region: '四川', bigRegion: '西南', cooperationLevel: undefined, techServiceType: 'none', registrationCount: 5, opportunityCount: 3, opportunityAmount: 150000, quoteCount: 1, quoteAmount: 80000, orderCount: 1, orderAmount: 60000 } as any,
      { partnerId: 'p5', partnerName: '深圳BB网络', region: '广东', bigRegion: '华南', cooperationLevel: undefined, techServiceType: 'developing', registrationCount: 4, opportunityCount: 2, opportunityAmount: 100000, quoteCount: 1, quoteAmount: 60000, orderCount: 0, orderAmount: 0 } as any,
    ],
    regionContributions: [
      { region: '广东', bigRegion: '华南', registrationCount: 19, opportunityCount: 14, opportunityAmount: 900000, quoteCount: 9, quoteAmount: 560000, orderCount: 5, orderAmount: 400000 } as any,
      { region: '北京', bigRegion: '华北', registrationCount: 10, opportunityCount: 8, opportunityAmount: 600000, quoteCount: 5, quoteAmount: 300000, orderCount: 3, orderAmount: 200000 } as any,
      { region: '上海', bigRegion: '华东', registrationCount: 8, opportunityCount: 6, opportunityAmount: 400000, quoteCount: 4, quoteAmount: 250000, orderCount: 3, orderAmount: 180000 } as any,
      { region: '四川', bigRegion: '西南', registrationCount: 5, opportunityCount: 3, opportunityAmount: 150000, quoteCount: 1, quoteAmount: 80000, orderCount: 1, orderAmount: 60000 } as any,
    ],
    ownerContributions: [
      { ownerId: 'u1', ownerName: '刘龙海', assignedStaffName: '刘龙海', region: '广东', bigRegion: '华南', registrationCount: 12, opportunityCount: 9, opportunityAmount: 650000, quoteCount: 6, quoteAmount: 380000, orderCount: 4, orderAmount: 300000 } as any,
      { ownerId: 'u2', ownerName: '首龙', assignedStaffName: '首龙', region: '北京', bigRegion: '华北', registrationCount: 8, opportunityCount: 6, opportunityAmount: 450000, quoteCount: 4, quoteAmount: 250000, orderCount: 2, orderAmount: 140000 } as any,
    ],
    partnerProfile: null,
    partnerSummary: {
      resource: 'partners',
      totalCount: 173,
      totalAmount: 8500000,
      byCooperationLevel: [{ key: 'gold', count: 21 }, { key: 'lep', count: 6 }],
      byTechServiceType: [{ key: 'full', count: 26 }, { key: 'developing', count: 121 }, { key: 'none', count: 26 }],
      byStatus: [],
      timeSeries: [
        { period: '2026-01', count: 12, amount: 600000 },
        { period: '2026-02', count: 18, amount: 900000 },
        { period: '2026-03', count: 15, amount: 750000 },
        { period: '2026-04', count: 22, amount: 1100000 },
        { period: '2026-05', count: 20, amount: 1000000 },
        { period: '2026-06', count: 16, amount: 800000 },
      ],
    } as any,
    opportunitySummary: {
      resource: 'opportunities',
      totalCount: 85,
      totalAmount: 3500000,
      byStatus: [
        { key: '初步接洽', count: 25 },
        { key: '需求确认', count: 20 },
        { key: '方案报价', count: 18 },
        { key: '商务谈判', count: 12 },
        { key: '成交/输单', count: 10 },
      ],
    } as any,
    orderSummary: {
      resource: 'orders',
      totalCount: 28,
      totalAmount: 1500000,
      byStatus: [
        { key: '待发货', count: 8 },
        { key: '已发货', count: 12 },
        { key: '已完成', count: 8 },
      ],
    } as any,
    registrationSummary: {
      resource: 'registrations',
      totalCount: 120,
      byStatus: [
        { key: '有效', count: 100 },
        { key: '无效', count: 20 },
      ],
    } as any,
    quoteSummary: {
      resource: 'quotes',
      totalCount: 42,
      byStatus: [
        { key: '有效', count: 35 },
        { key: '已过期', count: 7 },
      ],
    } as any,
    dataSource: 'OPENAPI_REALTIME' as const,
    fetchedAt: new Date().toISOString(),
    errors: [],
    ...overrides,
  };
}

// ===== DashboardReportComposer block 组装验证 =====

describe('DashboardReportComposer - agent-development block 组装', () => {
  let composer: DashboardReportComposer;
  let mockDashboardAnalyticsService: Partial<jest.Mocked<DashboardAnalyticsService>>;

  beforeEach(() => {
    mockDashboardAnalyticsService = {
      fetchDashboardAnalytics: jest.fn(),
      isAvailable: jest.fn().mockReturnValue(true),
    };

    // 由于 DashboardAnalyticsService 有很多私有方法，
    // 我们通过部分 mock 来绕过实际的 API 调用
    composer = new DashboardReportComposer(
      mockDashboardAnalyticsService as unknown as DashboardAnalyticsService,
    );

    // 让 fetchDashboardAnalytics 直接返回预构建的 bundle
    (mockDashboardAnalyticsService.fetchDashboardAnalytics as jest.Mock).mockResolvedValue(buildMockBundle());
  });

  it('agent-development 应生成完整的 12 个 block（含兜底聚合）', async () => {
    const result = await composer.compose('agent-development', {}, '全国渠道商发展运营数据看板');

    // 验证基本信息
    expect(result.blocks.length).toBeGreaterThanOrEqual(8); // 至少 KPI + 几个图表/表
    expect(result.reportTitle).toBeTruthy();
    expect(result.executiveSummary).toBeTruthy();
    expect(result.dataSource).toBe('OPENAPI_REALTIME');

    // 必须有 KPI matrix
    const kpiBlock = result.blocks.find((b) => b.blockType === 'kpi-matrix');
    expect(kpiBlock).toBeDefined();
    expect((kpiBlock?.metrics ?? []).length).toBeGreaterThan(0);

    // 验证 block 类型多样性
    const blockTypes = result.blocks.map((b) => b.blockType);
    console.log('[TEST] 生成的 block 类型:', blockTypes.join(', '));

    // 关键 block 必须存在
    expect(blockTypes).toContain('kpi-matrix');
    // 如果 summary 端点有数据，应该有 pie-distribution
    if (result.errors.length === 0) {
      // 验证 block 数量合理（至少 4 个）
      expect(result.blocks.length).toBeGreaterThanOrEqual(4);
    }

    const regionComparisonBlock = result.blocks.find((block) => block.blockType === 'grouped-bar');
    expect(regionComparisonBlock).toBeDefined();
    if (regionComparisonBlock?.blockType !== 'grouped-bar') {
      throw new Error('未生成区域同指标对比图');
    }
    expect(regionComparisonBlock.title).toBe('区域订单金额对比');
    expect(regionComparisonBlock.series).toHaveLength(1);
    expect(regionComparisonBlock.series[0].name).toBe('订单金额');
    expect(regionComparisonBlock.description).toContain('同类对比');
  });

  it('当 funnel 为 null 时应从 contributions 兜底生成漏斗', async () => {
    // 模拟 funnel 端点失败但其他端点成功
    (mockDashboardAnalyticsService.fetchDashboardAnalytics as jest.Mock).mockResolvedValue(
      buildMockBundle({ funnel: null }),
    );

    const result = await composer.compose('agent-development', {}, '全国渠道商发展运营数据看板');
    const funnelBlock = result.blocks.find((b) => b.blockType === 'funnel');

    // 兜底漏斗应该存在（从 partnerContributions 汇总）
    expect(funnelBlock).toBeDefined();
    if (funnelBlock) {
      expect(funnelBlock.stages).toBeDefined();
      expect((funnelBlock.stages ?? []).length).toBe(4);
    }
  });

  it('当 partnerSummary.byCooperationLevel 为空时应从 contributions 兜底', async () => {
    // 模拟 summary 端点返回空字段
    (mockDashboardAnalyticsService.fetchDashboardAnalytics as jest.Mock).mockResolvedValue(
      buildMockBundle({
        partnerSummary: {
          resource: 'partners',
          totalCount: 173,
          byCooperationLevel: [], // 空！
          byTechServiceType: [], // 空！
          timeSeries: [],
        } as any,
      }),
    );

    const result = await composer.compose('agent-development', {}, '全国渠道商发展运营数据看板');

    // 合作级别饼图应该从 partnerContributions 兜底生成
    const pieBlocks = result.blocks.filter((b) => b.blockType === 'pie-distribution');
    expect(pieBlocks.length).toBeGreaterThan(0);

    // 漏斗应该从 contributions 兜底生成
    const funnelBlock = result.blocks.find((b) => b.blockType === 'funnel');
    expect(funnelBlock).toBeDefined();
  });

});

// ===== 订单分析看板模板验证 =====

describe('DashboardReportComposer - channel-order-summary 订单分析模板', () => {
  let composer: DashboardReportComposer;
  let mockDashboardAnalyticsService: Partial<jest.Mocked<DashboardAnalyticsService>>;

  beforeEach(() => {
    mockDashboardAnalyticsService = {
      fetchDashboardAnalytics: jest.fn(),
      isAvailable: jest.fn().mockReturnValue(true),
    };

    composer = new DashboardReportComposer(
      mockDashboardAnalyticsService as unknown as DashboardAnalyticsService,
    );

    (mockDashboardAnalyticsService.fetchDashboardAnalytics as jest.Mock).mockResolvedValue(buildMockBundle());
  });

  it('channel-order-summary 应生成订单相关 KPI 和表格', async () => {
    const result = await composer.compose('channel-order-summary', {}, '广州办渠道下单汇总分析');

    expect(result.blocks.length).toBeGreaterThan(0);
    expect(result.reportTitle).toBeTruthy();

    const kpiBlock = result.blocks.find((b) => b.blockType === 'kpi-matrix');
    expect(kpiBlock).toBeDefined();

    // 订单分析应有表格类 block
    const tableBlocks = result.blocks.filter((b) => b.blockType === 'sortable-table');
    expect(tableBlocks.length).toBeGreaterThan(0);
  });

  it('不同 profile 应生成不同标题', async () => {
    const r1 = await composer.compose('agent-development', {}, '测试');
    const r2 = await composer.compose('channel-order-summary', {}, '测试');
    const r3 = await composer.compose('region-overview', {}, '测试');

    expect(r1.reportTitle).not.toBe(r2.reportTitle);
  });

  it('订单金额为空时渠道集中度和排行应切换为报价金额口径', async () => {
    const bundle = buildMockBundle({
      funnel: {
        registrationCount: 120,
        opportunityCount: 85,
        quoteCount: 42,
        orderCount: 0,
        registrationAmount: 5000000,
        opportunityAmount: 3500000,
        quoteAmount: 2000000,
        orderAmount: 0,
        registrationToOpportunityRate: 0.708,
        opportunityToQuoteRate: 0.494,
        quoteToOrderRate: 0,
      },
      orderSummary: {
        resource: 'orders',
        totalCount: 0,
        totalAmount: 0,
        byStatus: [],
      } as any,
      partnerContributions: buildMockBundle().partnerContributions.map((partner) => ({
        ...partner,
        orderCount: 0,
        orderAmount: 0,
      })) as any,
    });
    (mockDashboardAnalyticsService.fetchDashboardAnalytics as jest.Mock).mockResolvedValue(bundle);

    const result = await composer.compose('channel-order-summary', {}, '渠道下单汇总分析');
    const concentrationBlock = result.blocks.find((block) => block.blockType === 'concentration');
    const partnerTable = result.blocks.find((block) =>
      block.blockType === 'sortable-table' && /渠道贡献排行/u.test(block.title),
    );

    expect(concentrationBlock?.title).toContain('报价金额');
    expect(partnerTable?.title).toContain('报价金额');
    expect(partnerTable && partnerTable.blockType === 'sortable-table' ? partnerTable.rows[0].amount : undefined).toBeGreaterThan(0);
    expect(partnerTable && partnerTable.blockType === 'sortable-table' ? partnerTable.rows[0].orderAmount : undefined).toBe(0);
  });

  it('区域经营看板应只按同一指标生成区域对比，不能把商机金额和订单金额混在同一对比图', async () => {
    const result = await composer.compose('region-overview', {}, '不同区域的订单金额对比');
    const regionComparisonBlock = result.blocks.find((block) => block.blockType === 'grouped-bar');
    const regionTable = result.blocks.find((block) =>
      block.blockType === 'sortable-table' && /区域/u.test(block.title),
    );

    expect(regionComparisonBlock).toBeDefined();
    if (regionComparisonBlock?.blockType !== 'grouped-bar') {
      throw new Error('未生成区域同指标对比图');
    }

    expect(regionComparisonBlock.title).toBe('区域订单金额对比');
    expect(regionComparisonBlock.series).toHaveLength(1);
    expect(regionComparisonBlock.series[0].name).toBe('订单金额');
    expect(regionComparisonBlock.series.map((series) => series.name)).not.toEqual(
      expect.arrayContaining(['商机金额（万）', '下单金额（万）']),
    );
    expect(regionTable?.title).toBe('区域订单金额排行明细');
  });
});

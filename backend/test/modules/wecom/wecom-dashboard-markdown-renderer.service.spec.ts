import { WecomDashboardMarkdownRendererService } from '../../../src/modules/wecom/wecom-dashboard-markdown-renderer.service';
import { resolveWecomDashboardTemplateDefinition } from '../../../src/modules/wecom/wecom-dashboard-template.registry';
import type { DashboardComposeResult } from '../../../src/modules/crm-standard-api/dashboard-report-composer.service';

describe('WecomDashboardMarkdownRendererService', () => {
  const service = new WecomDashboardMarkdownRendererService();

  const dashboardResult: DashboardComposeResult = {
    reportTitle: '联软 CRM 数据运营分析看板',
    executiveSummary: '当前经营看板已生成。',
    dataSource: 'OPENAPI_REALTIME',
    fetchedAt: '2026-07-01T00:00:00.000Z',
    scopeSummary: '当前用户权限范围',
    errors: [],
    blocks: [
      {
        blockId: 'dashboard-kpi',
        blockType: 'kpi-matrix',
        title: '核心指标',
        metrics: [
          { label: '渠道商总数', value: '173', unit: '家' },
          { label: '报备数', value: '150', unit: '个' },
          { label: '商机金额', value: '175.00', unit: '万' },
          { label: '报价金额', value: '48.41', unit: '万' },
        ],
      },
      {
        blockId: 'dashboard-funnel',
        blockType: 'funnel',
        title: '业务转化漏斗',
        stages: [
          { name: '客户报备', value: 150 },
          { name: '商机', value: 42, rate: 0.28 },
          { name: '报价', value: 3, rate: 0.071 },
          { name: '订单', value: 1, amount: 0, rate: 0.333 },
        ],
      },
      {
        blockId: 'dashboard-concentration',
        blockType: 'concentration',
        title: '渠道集中度分析',
        totalValue: 484100,
        totalUnits: 3,
        tiers: [{ label: 'TOP3', value: 484100, count: 3, percentage: 88.8 }],
        oneTimeCount: 20,
        insights: [],
      },
      {
        blockId: 'dashboard-region',
        blockType: 'geo-map',
        title: '省份覆盖',
        mapName: 'china',
        regions: [{ name: '山东', value: 8 }],
        coveredRegionCount: 1,
        totalRegionCount: 31,
      },
      {
        blockId: 'dashboard-ranking',
        blockType: 'sortable-table',
        title: '渠道贡献排行',
        columns: [],
        rows: [
          {
            name: '山东示例渠道',
            opportunityAmount: 1750000,
            quoteAmount: 484100,
            orderAmount: 0,
            opportunityCount: 42,
          },
        ],
      },
    ],
  };

  it.each([
    ['BUSINESS_OVERVIEW', '经营总览看板卡', '【核心经营判断】'],
    ['FUNNEL_DIAGNOSIS', '业务漏斗诊断卡', '【最大断点】'],
    ['CHANNEL_RANKING', '渠道贡献排行卡', '【多口径榜单】'],
    ['REGION_COMPARISON', '区域经营对比卡', '【区域分层】'],
    ['CHANNEL_PROFILE', '渠道画像诊断卡', '【渠道分层】'],
    ['REGISTRATION_PROTECTION', '客户报备与保护期卡', '【到期统计】'],
    ['OPPORTUNITY_RISK', '商机风险清单卡', '【风险分层】'],
    ['QUOTE_TO_ORDER', '报价与订单转化卡', '【预测声明】'],
    ['RENEWAL_SUCCESS', '续费与客户成功卡', '【续费概览】'],
    ['PRODUCT_SOLUTION', '产品与解决方案结构卡', '【产品结构】'],
    ['SERVICE_ECOSYSTEM', '技术服务商生态卡', '【生态覆盖】'],
    ['DISTRIBUTION_HEALTH', '分销层级健康卡', '【层级结构】'],
    ['CADENCE_REPORT', '经营节奏日报/周报/月报卡', '【会议摘要】'],
    ['DATA_SCOPE_QUALITY', '数据质量与权限口径卡', '【可见范围】'],
  ] as const)('模板 %s 应输出对应正文结构', (templateCode, displayName, expectedSection) => {
    const markdown = service.render({
      dashboardResult,
      questionText: '测试问题',
      template: resolveWecomDashboardTemplateDefinition(templateCode),
      cardKpiItems: [
        { label: '渠道商总数', value: '173家' },
        { label: '报备数', value: '150个' },
        { label: '商机金额', value: '175.00万' },
      ],
      webDashboardUrl: 'http://127.0.0.1/report',
    });

    expect(markdown).toContain(`【展示模板】${displayName}`);
    expect(markdown).toContain('【数据口径】');
    expect(markdown).toContain('【权限口径】');
    expect(markdown).toContain('【核心指标】');
    expect(markdown).toContain('【分析结论】');
    expect(markdown).toContain('【分维度分析】');
    expect(markdown).toContain('建议动作：');
    expect(markdown).toContain(expectedSection);
    expect(markdown).toContain('【明细摘要】');
    expect(markdown).toContain('【风险建议】');
    expect(markdown).toContain('【建议追问】');
  });

  it('经营总览正文不应只汇总数据，应输出经营判断、主要矛盾和多维度分析', () => {
    const markdown = service.render({
      dashboardResult,
      questionText: '全国渠道商发展运营情况',
      template: resolveWecomDashboardTemplateDefinition('BUSINESS_OVERVIEW'),
      cardKpiItems: [
        { label: '渠道商总数', value: '173家' },
        { label: '报备数', value: '150个' },
        { label: '商机金额', value: '175.00万' },
      ],
      webDashboardUrl: 'http://127.0.0.1/report',
    });

    expect(markdown).toContain('经营判断：');
    expect(markdown).toContain('主要矛盾：');
    expect(markdown).toContain('建议动作：');
    expect(markdown).toContain('漏斗维度：');
    expect(markdown).toContain('区域维度：');
    expect(markdown).toContain('渠道维度：');
    expect(markdown).toContain('治理维度：');
    expect(markdown).toContain('订单结果数据不足');
    expect(markdown).not.toContain('只汇总数据');
  });

  it('不同模板应输出不同分析维度，而不是同一套明细列表', () => {
    const funnelMarkdown = service.render({
      dashboardResult,
      questionText: '报备到订单转化漏斗断点在哪里',
      template: resolveWecomDashboardTemplateDefinition('FUNNEL_DIAGNOSIS'),
      cardKpiItems: [{ label: '最大断点', value: '商机到报价' }],
    });
    const rankingMarkdown = service.render({
      dashboardResult,
      questionText: '哪些渠道贡献最大',
      template: resolveWecomDashboardTemplateDefinition('CHANNEL_RANKING'),
      cardKpiItems: [{ label: 'TOP3占比', value: '88.8%' }],
    });

    expect(funnelMarkdown).toContain('阶段量维度：');
    expect(funnelMarkdown).toContain('转化率维度：');
    expect(funnelMarkdown).toContain('动作维度：');
    expect(rankingMarkdown).toContain('排序口径维度：');
    expect(rankingMarkdown).toContain('头部集中维度：');
    expect(rankingMarkdown).toContain('长尾运营维度：');
    expect(funnelMarkdown).not.toContain('排序口径维度：');
    expect(rankingMarkdown).not.toContain('阶段量维度：');
  });

  it('区域正文摘要应明确同类同指标对比口径', () => {
    const result: DashboardComposeResult = {
      ...dashboardResult,
      blocks: [
        ...dashboardResult.blocks,
        {
          blockId: 'dashboard-region-ranking',
          blockType: 'sortable-table',
          title: '区域订单金额排行明细',
          columns: [],
          rows: [
            { region: '山东区', orderAmount: 120, opportunityAmount: 300 },
            { region: '北京区', orderAmount: 80, opportunityAmount: 500 },
          ],
        },
      ],
    };

    const markdown = service.render({
      dashboardResult: result,
      questionText: '不同区域的订单金额对比',
      template: resolveWecomDashboardTemplateDefinition('REGION_COMPARISON'),
      cardKpiItems: [{ label: '订单金额领先区域', value: '山东区 120万' }],
    });

    expect(markdown).toContain('所有对比只在同一对象和同一指标内进行');
    expect(markdown).toContain('区域之间只按同一指标对比');
    expect(markdown).toContain('1. 山东区，订单金额120.00万');
    expect(markdown).not.toContain('1. 山东区，金额');
  });
});

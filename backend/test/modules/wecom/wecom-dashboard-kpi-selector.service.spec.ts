import { WecomDashboardKpiSelectorService } from '../../../src/modules/wecom/wecom-dashboard-kpi-selector.service';
import { resolveWecomDashboardTemplateDefinition } from '../../../src/modules/wecom/wecom-dashboard-template.registry';
import type { DashboardComposeResult } from '../../../src/modules/crm-standard-api/dashboard-report-composer.service';

describe('WecomDashboardKpiSelectorService', () => {
  const service = new WecomDashboardKpiSelectorService();

  const buildDashboardResult = (): DashboardComposeResult => ({
    reportTitle: '联软 CRM 数据运营分析看板',
    executiveSummary: '已生成动态看板。',
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
          { name: '订单', value: 1, rate: 0.333 },
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
    ],
  });

  it('经营总览应优先选择渠道或经营核心指标，并保留至少 3 个辅助指标', () => {
    const items = service.selectCardKpiItems({
      dashboardResult: buildDashboardResult(),
      template: resolveWecomDashboardTemplateDefinition('BUSINESS_OVERVIEW'),
    });

    expect(items[0]).toEqual({ label: '渠道商总数', value: '173家' });
    expect(items.length).toBeGreaterThanOrEqual(4);
    expect(items).toEqual(
      expect.arrayContaining([
        { label: '报备数', value: '150个' },
        { label: '商机金额', value: '175.00万' },
      ]),
    );
  });

  it('漏斗诊断应优先展示最大断点', () => {
    const items = service.selectCardKpiItems({
      dashboardResult: buildDashboardResult(),
      template: resolveWecomDashboardTemplateDefinition('FUNNEL_DIAGNOSIS'),
    });

    expect(items[0]).toEqual({ label: '最大断点', value: '商机转报价' });
    expect(items).toEqual(
      expect.arrayContaining([
        { label: '客户报备', value: '150个' },
        { label: '商机', value: '42个' },
        { label: '报价', value: '3个' },
      ]),
    );
  });

  it('渠道排行应优先展示集中度指标', () => {
    const items = service.selectCardKpiItems({
      dashboardResult: buildDashboardResult(),
      template: resolveWecomDashboardTemplateDefinition('CHANNEL_RANKING'),
    });

    expect(items[0]).toEqual({ label: 'TOP3占比', value: '88.8%' });
    expect(items).toEqual(
      expect.arrayContaining([
        { label: '商机金额', value: '175.00万' },
        { label: '报价金额', value: '48.41万' },
        { label: '长尾渠道', value: '20家' },
      ]),
    );
  });

  it('数据质量模板在业务指标不足时应补齐兜底指标', () => {
    const result = buildDashboardResult();
    result.errors = ['接口超时'];
    result.blocks = [];

    const items = service.selectCardKpiItems({
      dashboardResult: result,
      template: resolveWecomDashboardTemplateDefinition('DATA_SCOPE_QUALITY'),
    });

    expect(items[0]).toEqual({ label: '可见范围', value: '当前用户权限范围' });
    expect(items.length).toBeGreaterThanOrEqual(4);
    expect(items).toEqual(
      expect.arrayContaining([
        { label: '异常接口', value: '1项' },
        { label: '替代口径', value: '已说明' },
      ]),
    );
  });
});

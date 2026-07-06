import { DashboardReportComposer } from '../../src/modules/crm-standard-api/dashboard-report-composer.service';
import type { DashboardAnalyticsBundle } from '../../src/modules/crm-standard-api/dashboard-analytics.service';
import type { DashboardAnalyticsService } from '../../src/modules/crm-standard-api/dashboard-analytics.service';

/**
 * 构造覆盖“全国渠道商发展运营情况”的最小看板数据包。
 *
 * 参数说明：无参数，固定模拟真实问题中暴露的 CRM 区域与原始状态枚举。
 * 返回值说明：返回 DashboardReportComposer 可直接消费的统计聚合结果。
 * 调用注意事项：该用例不访问真实 OpenAPI，只验证展示口径转换是否稳定。
 */
function buildProvinceAndStatusBundle(): DashboardAnalyticsBundle {
  return {
    businessOverview: {},
    funnel: null,
    partnerContributions: [
      { partnerId: 'p1', partnerName: '临沂普悦天诚信息科技有限公司', region: '山东区', bigRegion: '大北区' },
      { partnerId: 'p2', partnerName: '山东诚卓信息技术有限公司', partnerCityName: '济南市', region: '山东区', bigRegion: '大北区' },
      { partnerId: 'p12', partnerName: '深圳市佰航信息技术有限公司', cityName: '深圳市', region: '深圳区', bigRegion: '大南区' },
      { partnerId: 'p13', partnerName: '广州天畅信息技术有限公司', 所在城市: '广州市', region: '深圳区', bigRegion: '大南区' },
      { partnerId: 'p14', partnerName: '广西唯信电子科技有限公司', cityName: '南宁市', region: '深圳区', bigRegion: '大南区' },
      { partnerId: 'p15', partnerName: '福州宝视通电子科技有限公司', cityName: '福州市', region: '深圳区', bigRegion: '大南区' },
      { partnerId: 'p16', partnerName: '厦门三绎信息科技有限公司', cityName: '厦门市', region: '深圳区', bigRegion: '大南区' },
      { partnerId: 'p3', partnerName: '北京华夏泰合科技有限公司', region: '北区（政企企业）', bigRegion: '大北区' },
      { partnerId: 'p4', partnerName: '北京意畅科技股份有限公司', region: '北区（政府企业）', bigRegion: '大北区' },
      { partnerId: 'p5', partnerName: '河北奇点信息技术服务有限公司', region: '晋冀区', bigRegion: '大北区' },
      { partnerId: 'p6', partnerName: '山西中教合创软件科技有限公司', region: '晋冀区', bigRegion: '大北区' },
      { partnerId: 'p7', partnerName: '日电（沈阳）信息系统有限公司', region: '东北区', bigRegion: '大北区' },
      { partnerId: 'p8', partnerName: '吉林科高经贸有限公司', region: '东北区', bigRegion: '大北区' },
      { partnerId: 'p9', partnerName: '中汇大通科技有限公司', region: '河南区', bigRegion: '大北区' },
      { partnerId: 'p10', partnerName: '诚致（南京）数字技术有限公司', region: '江苏区', bigRegion: '大东区' },
      { partnerId: 'p11', partnerName: '杭州一鸣计算机有限公司', region: '浙赣区', bigRegion: '大东区' },
    ],
    regionContributions: [],
    ownerContributions: [],
    partnerProfile: null,
    partnerSummary: {
      resource: 'partners',
      totalCount: 16,
      byCooperationLevel: [],
      byTechServiceType: [],
    },
    opportunitySummary: {
      resource: 'opportunities',
      totalCount: 13,
      totalAmount: 1000000,
      byStatus: [
        { key: 'testing', count: 5 },
        { key: 'registered', count: 4 },
        { key: 'contacted', count: 3 },
        { key: 'won', count: 1 },
      ],
    },
    orderSummary: {
      resource: 'orders',
      totalCount: 1,
      byStatus: [{ key: 'cancelled', count: 1 }],
    },
    registrationSummary: null,
    quoteSummary: {
      resource: 'quotes',
      totalCount: 3,
      byStatus: [
        { key: 'draft', count: 2 },
        { key: 'converted', count: 1 },
      ],
    },
    dataSource: 'OPENAPI_REALTIME',
    fetchedAt: '2026-07-02T00:00:00.000Z',
    errors: [],
  };
}

describe('DashboardReportComposer 省份地图和枚举中文化', () => {
  it('全国渠道商发展运营情况应输出标准省份和中文状态标签', async () => {
    const mockDashboardAnalyticsService = {
      fetchDashboardAnalytics: jest.fn().mockResolvedValue(buildProvinceAndStatusBundle()),
    };
    const composer = new DashboardReportComposer(
      mockDashboardAnalyticsService as unknown as DashboardAnalyticsService,
    );

    const result = await composer.compose('agent-development', {}, '全国渠道商发展运营情况');
    const geoBlock = result.blocks.find((block) => block.blockType === 'geo-map');
    expect(geoBlock).toBeDefined();

    if (geoBlock?.blockType !== 'geo-map') {
      throw new Error('未生成省份覆盖地图区块');
    }

    const provinceCounts = Object.fromEntries(geoBlock.regions.map((region) => [region.name, region.value]));
    expect(provinceCounts).toMatchObject({
      山东: 2,
      广东: 2,
      广西: 1,
      福建: 2,
      北京: 2,
      河北: 1,
      山西: 1,
      辽宁: 1,
      吉林: 1,
      河南: 1,
      江苏: 1,
      浙江: 1,
    });
    expect(geoBlock.coveredRegionCount).toBe(12);
    expect(geoBlock.coveredCityCount).toBe(11);
    expect(geoBlock.totalCityCount).toBeGreaterThan(300);

    const shandongRegion = geoBlock.regions.find((region) => region.name === '山东');
    expect(shandongRegion?.cityGroups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cityName: '济南',
          partnerCount: 1,
          partners: ['山东诚卓信息技术有限公司'],
        }),
        expect.objectContaining({
          cityName: '临沂',
          partnerCount: 1,
          partners: ['临沂普悦天诚信息科技有限公司'],
        }),
      ]),
    );
    const guangdongRegion = geoBlock.regions.find((region) => region.name === '广东');
    expect(guangdongRegion?.coveredCityCount).toBe(2);
    expect(guangdongRegion?.cityGroups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cityName: '深圳',
          partnerCount: 1,
          partners: ['深圳市佰航信息技术有限公司'],
        }),
        expect.objectContaining({
          cityName: '广州',
          partnerCount: 1,
          partners: ['广州天畅信息技术有限公司'],
        }),
      ]),
    );
    const guangxiRegion = geoBlock.regions.find((region) => region.name === '广西');
    expect(guangxiRegion?.cityGroups).toEqual([
      expect.objectContaining({
        cityName: '南宁',
        partnerCount: 1,
        partners: ['广西唯信电子科技有限公司'],
      }),
    ]);
    const fujianRegion = geoBlock.regions.find((region) => region.name === '福建');
    expect(fujianRegion?.cityGroups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cityName: '福州',
          partnerCount: 1,
          partners: ['福州宝视通电子科技有限公司'],
        }),
        expect.objectContaining({
          cityName: '厦门',
          partnerCount: 1,
          partners: ['厦门三绎信息科技有限公司'],
        }),
      ]),
    );
    expect(geoBlock.regions.map((region) => region.name)).not.toEqual(
      expect.arrayContaining(['山东区', '深圳区', '北区（政企企业）', '晋冀区', '东北区', '浙赣区']),
    );
    expect(result.executiveSummary).toContain('覆盖11个地市');
    expect(result.executiveSummary).toContain('覆盖12个省份');

    const labels = result.blocks.flatMap((block) => block.blockType === 'pie-distribution'
      ? block.segments.map((segment) => segment.name)
      : []);
    expect(labels).toEqual(
      expect.arrayContaining(['30%客户测试中', '20%已登记/已报备', '1%已联系客户', '100%已成交', '草稿', '已转订单', '已取消']),
    );
    expect(labels).not.toEqual(
      expect.arrayContaining(['testing', 'registered', 'contacted', 'won', 'draft', 'converted', 'cancelled']),
    );
  });

  it('合作级别分布包含未设置桶时不应再次用总数差额重复补数', async () => {
    const bundle = buildProvinceAndStatusBundle();
    bundle.partnerSummary = {
      resource: 'partners',
      totalCount: 16,
      byCooperationLevel: [
        { key: 'lep', count: 3 },
        { key: 'gold', count: 4 },
        { key: 'unknown', count: 9 },
      ],
    };
    const mockDashboardAnalyticsService = {
      fetchDashboardAnalytics: jest.fn().mockResolvedValue(bundle),
    };
    const composer = new DashboardReportComposer(
      mockDashboardAnalyticsService as unknown as DashboardAnalyticsService,
    );

    const result = await composer.compose('agent-development', {}, '全国渠道商发展运营情况');
    const cooperationBlock = result.blocks.find(
      (block) => block.blockType === 'pie-distribution' && block.title === '合作级别分布',
    );

    if (cooperationBlock?.blockType !== 'pie-distribution') {
      throw new Error('未生成合作级别分布区块');
    }

    expect(cooperationBlock.segments).toEqual([
      { name: 'LEP', value: 3 },
      { name: '金牌', value: 4 },
      { name: '未设置', value: 9 },
    ]);
  });
});

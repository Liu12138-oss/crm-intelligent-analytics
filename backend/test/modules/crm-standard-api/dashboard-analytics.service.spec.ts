import { DashboardAnalyticsService } from '../../../src/modules/crm-standard-api/dashboard-analytics.service';
import type { LianruanCrmOpenApiClient } from '../../../src/modules/crm-standard-api/lianruan-crm-openapi.client';

describe('DashboardAnalyticsService 渠道商位置补全', () => {
  it('统计接口未返回地市时应使用渠道商主数据的所在城市补齐地市字段', async () => {
    const openApiClient = {
      getBusinessOverviewAnalytics: jest.fn().mockResolvedValue({}),
      getFunnelAnalytics: jest.fn().mockResolvedValue(null),
      listPartnerContributions: jest.fn().mockResolvedValue([
        {
          partnerId: 'p1',
          partnerName: '山东诚卓信息技术有限公司',
          region: '山东区',
          orderCount: 0,
        },
        {
          partnerId: 'p2',
          partnerName: '青岛生态伙伴有限公司',
          region: '山东区',
          orderCount: 0,
        },
      ]),
      listRegionContributions: jest.fn().mockResolvedValue([]),
      listOwnerContributions: jest.fn().mockResolvedValue([]),
      getPartnerProfileAnalytics: jest.fn().mockResolvedValue(null),
      getResourceSummaryAnalytics: jest.fn().mockResolvedValue({ resource: 'partners', totalCount: 1 }),
      listResource: jest.fn().mockResolvedValue({
        items: [
          {
            id: 'p1',
            partnerId: 'p1',
            partnerName: '山东诚卓信息技术有限公司',
            city: '济南市',
          },
          {
            id: 'p2',
            partnerId: 'p2',
            partnerName: '青岛生态伙伴有限公司',
            所在城市: '青岛市',
          },
        ],
        pageNo: 1,
        pageSize: 500,
        total: 1,
        returnedCount: 1,
      }),
    };
    const logger = {
      logStep: jest.fn(),
      logWarn: jest.fn(),
    };
    const service = new DashboardAnalyticsService(
      openApiClient as unknown as LianruanCrmOpenApiClient,
      logger as never,
    );

    const result = await service.fetchDashboardAnalytics({ limit: 10 });

    expect(result.partnerContributions[0]).toMatchObject({
      partnerName: '山东诚卓信息技术有限公司',
      cityName: '济南市',
    });
    expect(result.partnerContributions[1]).toMatchObject({
      partnerName: '青岛生态伙伴有限公司',
      cityName: '青岛市',
    });
    expect(openApiClient.listResource).toHaveBeenCalledWith(
      'partners',
      expect.objectContaining({
        pageNo: 1,
        pageSize: 500,
      }),
    );
  });
});

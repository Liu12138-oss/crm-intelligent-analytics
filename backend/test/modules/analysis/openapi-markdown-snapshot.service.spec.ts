import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { OpenApiMarkdownSnapshotService } from '../../../src/modules/analysis/openapi-markdown-snapshot.service';

describe('OpenApiMarkdownSnapshotService', () => {
  let tempDir: string;

  /**
   * 为每个用例创建独立快照目录，避免 Markdown 文件互相污染。
   */
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'openapi-md-snapshot-'));
  });

  /**
   * 清理临时快照目录。
   */
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('应从 OpenAPI mock 数据生成 AI 可读 Markdown 快照', async () => {
    const service = createService(tempDir);

    const manifest = await service.generateSnapshot();

    expect(manifest.counts).toMatchObject({
      partners: 1,
      registrations: 1,
      opportunities: 1,
      orders: 1,
    });
    expect(manifest.files).toContain('04-商机分析.md');
    expect(manifest.files).toContain('11-data-quality.md');
    expect(manifest.files).toContain('12-index.md');
    expect(manifest.resourceMeta.opportunities).toMatchObject({
      total: 1,
      returnedCount: 1,
      complete: true,
      required: true,
    });
    const opportunityMarkdown = readFileSync(
      join(tempDir, 'latest', '04-商机分析.md'),
      'utf8',
    );
    expect(opportunityMarkdown).toContain('真实商机A');
    expect(opportunityMarkdown).toContain('真实客户A');
    expect(opportunityMarkdown).toContain('真实渠道商A');
  });

  it('读取相关快照片段时应按问题选择商机和渠道商材料', async () => {
    const service = createService(tempDir);
    await service.generateSnapshot();

    const context = service.readRelevantSnapshotContext('分析渠道商和商机情况');

    expect(context).toContain('# 合作伙伴开拓与运营');
    expect(context).toContain('# 商机分析');
    expect(context).toContain('真实渠道商A');
    expect(context).toContain('真实商机A');
  });

  it('区域问题读取快照时不应注入全量明细', async () => {
    const service = createService(tempDir);
    await service.generateSnapshot();

    const context = service.readRelevantSnapshotContext('分析山东区域的商机和订单情况');

    expect(context).toContain('正式分析会先按问题筛选本地 Markdown 快照明细');
    expect(context).toContain('# 字段口径与枚举');
    expect(context).not.toContain('真实渠道商A');
    expect(context).not.toContain('真实商机A');
    expect(context).not.toContain('真实订单A');
  });

  it('details 明细文件应写入全量快照记录，不能受摘要区块行数限制', async () => {
    const originalOpportunities = recordsByResource.opportunities;
    recordsByResource.opportunities = Array.from({ length: 25 }, (_, index) => ({
      opportunityId: `opp_full_${index + 1}`,
      opportunityName: `全量商机${index + 1}`,
      customerName: `全量客户${index + 1}`,
      partnerName: '真实渠道商A',
      stageName: '方案报价',
      amount: 10000 + index,
      ownerName: '销售A',
      updatedAt: '2026-06-01',
    }));

    try {
      const service = createService(tempDir);
      await service.generateSnapshot();

      const detailMarkdown = readFileSync(
        join(tempDir, 'latest', 'details', 'opportunities.md'),
        'utf8',
      );

      expect(detailMarkdown).toContain('记录数：25');
      expect(detailMarkdown).toContain('全量商机1');
      expect(detailMarkdown).toContain('全量商机25');
    } finally {
      recordsByResource.opportunities = originalOpportunities;
    }
  });

  it('合作伙伴 details 明细应保留类型、等级、所在城市和区域字段并可反读', async () => {
    const service = createService(tempDir);
    await service.generateSnapshot();

    const detailMarkdown = readFileSync(
      join(tempDir, 'latest', 'details', 'partners.md'),
      'utf8',
    );
    const partnerRecords = service.readResourceRecords('partners') ?? [];

    expect(detailMarkdown).toContain('| ID | 渠道商ID | 渠道商 | 合作等级 | 渠道类型 | 是否技术服务商 | 技术服务商类型 | 所在城市 | 区域 | 大区 | 状态 | 更新时间 |');
    expect(detailMarkdown).toContain('技术服务商');
    expect(partnerRecords[0]).toEqual(
      expect.objectContaining({
        partnerId: 'partner_001',
        partnerName: '真实渠道商A',
        partnerLevel: '金牌',
        partnerType: '技术服务商',
        isTechnicalServiceProvider: true,
        technicalServiceProviderType: '交付服务',
        city: '济南市',
        cityName: '济南市',
        region: '华南',
      }),
    );
  });

  it('核心资源分页未拉齐时正式读取应阻断分析', async () => {
    const service = createService(tempDir, {
      totalOverrides: {
        opportunities: 2,
      },
    });
    await service.generateSnapshot();

    expect(() =>
      service.readBusinessChainSnapshot({ resources: ['opportunities'] }),
    ).toThrow('opportunities 明细未拉齐');
  });
});

/**
 * 构造快照服务测试实例。
 */
function createService(
  snapshotDir: string,
  options?: { totalOverrides?: Record<string, number> },
): OpenApiMarkdownSnapshotService {
  const localRuntimeConfigService = {
    getCrmOpenApiMarkdownSnapshotConfig: jest.fn(() => ({
      enabled: true,
      snapshotDir,
      maxRowsPerResource: 100,
      detailRowsPerSection: 20,
      maxContextChars: 50000,
    })),
  };
  const queryAdapter = {
    isEnabled: jest.fn(() => true),
    listByResource: jest.fn(async (resource: string) => ({
      items: recordsByResource[resource] ?? [],
      pageNo: 1,
      pageSize: 200,
      total: options?.totalOverrides?.[resource] ?? (recordsByResource[resource] ?? []).length,
      returnedCount: (recordsByResource[resource] ?? []).length,
      requestId: `req_${resource}`,
    })),
    listCatalogResource: jest.fn(async (resource: string) => ({
      items: recordsByResource[resource] ?? [],
      pageNo: 1,
      pageSize: 200,
      total: options?.totalOverrides?.[resource] ?? (recordsByResource[resource] ?? []).length,
      returnedCount: (recordsByResource[resource] ?? []).length,
      requestId: `req_${resource}`,
    })),
    getDiagnosticsSelfCheck: jest.fn(async () => ({
      visibleCounts: {
        partners: 1,
        opportunities: 1,
      },
    })),
    getBusinessOverviewAnalytics: jest.fn(async () => ({
      partnerCount: 1,
      opportunityCount: 1,
    })),
    getResourceSummaryAnalytics: jest.fn(async (resource: string) => ({
      resource,
      totalCount: (recordsByResource[resource] ?? []).length,
    })),
    listPartnerContributions: jest.fn(async () => [
      {
        partnerId: 'partner_001',
        partnerName: '真实渠道商A',
        registrationCount: 1,
        opportunityCount: 1,
        opportunityAmount: 120000,
        orderCount: 1,
        orderAmount: 88000,
      },
    ]),
    getPartnerProfileAnalytics: jest.fn(async () => ({
      totalCount: 1,
      activeCount: 1,
      technicalServiceProviderCount: 1,
    })),
    getFunnelAnalytics: jest.fn(async () => ({
      registrationCount: 1,
      opportunityCount: 1,
      quoteCount: 0,
      orderCount: 1,
    })),
    getCustomerLifecycleAnalytics: jest.fn(async () => ({
      totalCount: 1,
      noOrderCount: 0,
    })),
    getCustomerUnregisteredOpportunityAnalytics: jest.fn(async () => ({
      noOpportunityCount: 0,
    })),
    listRegionContributions: jest.fn(async () => []),
    listOwnerContributions: jest.fn(async () => []),
  };
  const openApiAdapter = {
    getBootstrapSnapshot: jest.fn(async () => ({
      context: { client: { name: '测试 client' }, user: { id: 'A001', name: '测试用户' } },
      permissionScope: { scopeType: 'all', regions: [], partnerIds: [], userIds: [] },
      dictionaries: {
        opportunityStages: [{ value: 'quote', label: '方案报价' }],
      },
    })),
  };
  const logger = {
    logStep: jest.fn(),
    logWarn: jest.fn(),
  };

  return new OpenApiMarkdownSnapshotService(
    localRuntimeConfigService as never,
    queryAdapter as never,
    openApiAdapter as never,
    logger as never,
  );
}

const recordsByResource: Record<string, Array<Record<string, unknown>>> = {
  users: [
    {
      id: 'A001',
      username: 'test_user',
      name: '测试用户',
      roleName: '管理员',
      region: '华南',
    },
  ],
  partners: [
    {
      id: 'partner_001',
      partnerId: 'partner_001',
      partnerName: '真实渠道商A',
      partnerLevelName: '金牌',
      partnerTypeName: '技术服务商',
      isTechnicalServiceProvider: true,
      technicalServiceProviderType: '交付服务',
      partnerCityName: '济南市',
      region: '华南',
      bigRegion: '南区',
      status: 'active',
      updatedAt: '2026-06-01',
    },
  ],
  customers: [
    {
      customerId: 'customer_001',
      customerName: '真实客户A',
      region: '华南',
    },
  ],
  registrations: [
    {
      registrationId: 'reg_001',
      customerName: '真实客户A',
      partnerName: '真实渠道商A',
      statusName: '已通过',
      opportunityName: '真实商机A',
      estimatedAmount: 50000,
    },
  ],
  opportunities: [
    {
      opportunityId: 'opp_001',
      opportunityName: '真实商机A',
      customerName: '真实客户A',
      partnerName: '真实渠道商A',
      partnerId: 'partner_001',
      stageName: '方案报价',
      amount: 120000,
      ownerName: '销售A',
      updatedAt: '2026-06-01',
    },
  ],
  quotes: [],
  orders: [
    {
      orderId: 'order_001',
      orderName: '真实订单A',
      customerName: '真实客户A',
      partnerName: '真实渠道商A',
      partnerId: 'partner_001',
      totalAmount: 88000,
      statusName: '已下单',
    },
  ],
  categories: [],
  modules: [],
  features: [],
  hardware: [],
  packages: [],
  products: [],
};

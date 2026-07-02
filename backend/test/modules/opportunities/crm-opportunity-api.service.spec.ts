import { CrmOpportunityApiService } from '../../../src/modules/opportunities/crm-opportunity-api.service';
import type { CrmUser } from '../../../src/shared/types/domain';

describe('CrmOpportunityApiService', () => {
  const mockUser: CrmUser = {
    id: 'user_sales_director',
    name: '销售总监',
    roleIds: ['role_sales_director'],
    roleNames: ['销售总监'],
    organizationIds: ['org_north'],
    departmentIds: ['dept_sales'],
    ownerIds: ['owner_zhang'],
    isAdmin: false,
    exportAllowed: true,
    channels: ['wecom-bot'],
  };

  function createService(options?: {
    crmAuthConfig?: Record<string, unknown>;
    lianruanCrmQueryAdapter?: Record<string, unknown>;
  }): CrmOpportunityApiService {
    return new CrmOpportunityApiService(
      {
        getCrmAuthConfig: jest.fn(() => ({
          enabled: false,
          mockEnabled: true,
          baseUrl: '',
          versionCode: 'v2',
          device: 'wecom-bot',
          timeoutMs: 3000,
          ...options?.crmAuthConfig,
        })),
        getCrmOpportunityCreateConfig: jest.fn(() => ({
          defaultStage: '250839',
          defaultSource: '400',
          defaultKind: 'normal',
          leadCodeField: 'lead_code',
          renewalContractCodeField: 'renewal_code',
          agentFullNameField: 'agent_name',
          projectStatusField: 'project_status',
          preSalesField: 'pre_sales',
          productAliasMap: {},
        })),
      } as never,
      {
        logStep: jest.fn(),
        logWarn: jest.fn(),
      } as never,
      {
        lookupByCompanyName: jest.fn(async (_user, companyName) => ({
          companyName,
          customFieldName: 'title',
          totalCount: 0,
          limit: 5,
          matchedCompanyNames: [],
          records: [],
          summary: 'noop',
        })),
      } as never,
      {
        isEnabled: jest.fn(() => false),
        listOpportunities: jest.fn(),
        ...options?.lianruanCrmQueryAdapter,
      } as never,
    );
  }

  it('模糊项目名带“项目”后缀时，也应能召回实际商机标题', async () => {
    const service = createService();

    const result = await service.lookupByCompanyName(
      mockUser,
      '苏州制造升级项目',
      {
        limit: 5,
      },
    );

    expect(result.totalCount).toBeGreaterThan(0);
    expect(result.records.some((item) => item.title.includes('苏州制造升级'))).toBe(true);
  });

  it('样例模式下应能按 ID 读取商机当前负责人', async () => {
    const service = createService();

    const record = await service.getById(mockUser, 'opp_002');

    expect(record).toMatchObject({
      id: 'opp_002',
      title: expect.stringContaining('苏州制造'),
      ownerId: 'owner_li',
      ownerName: '李浩',
    });
  });

  it('标准 OpenAPI 已启用但商机列表失败时，不应回退旧版 /api/v2/opportunities', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('旧接口不应被调用'));
    const listOpportunities = jest.fn(async () => {
      throw new Error('联软标准 OpenAPI 列表请求失败：not found（code=404）');
    });
    const service = createService({
      crmAuthConfig: {
        enabled: true,
        mockEnabled: false,
        baseUrl: 'http://crm.example.com',
        versionCode: '9.9.9',
        device: 'open_api',
        timeoutMs: 3000,
      },
      lianruanCrmQueryAdapter: {
        isEnabled: jest.fn(() => true),
        listOpportunities,
      },
    });

    try {
      await expect(
        service.lookupByCompanyName(mockUser, '看一下所有的商机明细', {
          accessToken: 'crm-access-token',
          limit: 10,
        }),
      ).rejects.toThrow('联软标准 OpenAPI 商机查询暂不可用');
      expect(listOpportunities).toHaveBeenCalledWith({
        keyword: '看一下所有的商机明细',
        pageNo: 1,
        pageSize: 10,
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});

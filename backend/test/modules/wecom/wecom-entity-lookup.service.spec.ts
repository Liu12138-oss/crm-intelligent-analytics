import { WecomEntityLookupService } from '../../../src/modules/wecom/wecom-entity-lookup.service';
import type {
  CrmUser,
  WecomEntityLookupMemory,
} from '../../../src/shared/types/domain';

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

function createLookupService(params?: {
  customers?: Array<Record<string, unknown>>;
  opportunities?: Array<Record<string, unknown>>;
}): WecomEntityLookupService {
  const customers = params?.customers ?? [];
  const opportunities = params?.opportunities ?? [];

  return new WecomEntityLookupService(
    {
      lookupByName: jest.fn(async () => ({
        customerName: '测试客户',
        totalCount: customers.length,
        limit: 10,
        records: customers,
        summary: '测试客户结果',
      })),
      getById: jest.fn(async (_user, customerId: string) =>
        customers.find((item) => item.id === customerId),
      ),
    } as never,
    {
      lookupByCompanyName: jest.fn(async () => ({
        companyName: '测试商机',
        customFieldName: 'title',
        totalCount: opportunities.length,
        limit: 10,
        matchedCompanyNames: [],
        records: opportunities,
        summary: '测试商机结果',
      })),
      getById: jest.fn(async (_user, opportunityId: string) =>
        opportunities.find((item) => item.id === opportunityId),
      ),
    } as never,
  );
}

describe('WecomEntityLookupService', () => {
  it('直接详情查询多命中时应返回列表态，而不是默认选第一项', async () => {
    const service = createLookupService({
      opportunities: [
        {
          id: 'opp_001',
          title: '安恒信息-AH001',
          customerName: '杭州安恒信息技术股份有限公司',
          ownerName: '销售总监',
          ownerId: 'user_sales_director',
          stage: '方案',
          expectAmount: 100000,
        },
        {
          id: 'opp_002',
          title: '安恒信息-AH002',
          customerName: '杭州安恒信息技术股份有限公司',
          ownerName: '销售总监',
          ownerId: 'user_sales_director',
          stage: '谈判',
          expectAmount: 150000,
        },
      ],
    });

    const result = await service.execute({
      user: mockUser,
      accessToken: 'mock-token',
      entityLookupAction: 'DETAIL',
      entityType: 'Opportunity',
      queryText: '安恒信息详情',
    });

    expect(result.status).toBe('LIST_RETURNED');
    expect(result.listItems).toHaveLength(2);
    expect(result.replyText).toContain('前 2 条');
  });

  it('直接客户详情唯一命中时应返回详情态', async () => {
    const service = createLookupService({
      customers: [
        {
          id: 'cus_001',
          name: '山东农信',
          ownerId: 'user_sales_director',
          ownerName: '销售总监',
          category: '重点客户',
          organizationId: 'org_north',
          departmentId: 'dept_sales',
          createdAt: '2026-04-01T10:00:00.000Z',
        },
      ],
    });

    const result = await service.execute({
      user: mockUser,
      accessToken: 'mock-token',
      entityLookupAction: 'DETAIL',
      entityType: 'Customer',
      queryText: '山东农信详情',
    });

    expect(result.status).toBe('DETAIL_RETURNED');
    expect(result.selectedItemId).toBe('cus_001');
    expect(result.replyText).toContain('山东农信');
  });

  it('上一轮列表选择详情时应按序号读取列表项对应对象', async () => {
    const service = createLookupService({
      customers: [
        {
          id: 'cus_001',
          name: '山东农信',
          ownerId: 'user_sales_director',
          ownerName: '销售总监',
          category: '重点客户',
        },
        {
          id: 'cus_002',
          name: '苏州制造',
          ownerId: 'user_sales_director',
          ownerName: '销售总监',
          category: '战略客户',
        },
      ],
    });
    const memory: WecomEntityLookupMemory = {
      mode: 'LIST_RETURNED',
      entityType: 'Customer',
      queryText: '查我的客户列表',
      listItems: [
        {
          id: 'cus_001',
          entityType: 'Customer',
          displayTitle: '山东农信',
          ownerName: '销售总监',
          summaryFields: ['重点客户'],
        },
        {
          id: 'cus_002',
          entityType: 'Customer',
          displayTitle: '苏州制造',
          ownerName: '销售总监',
          summaryFields: ['战略客户'],
        },
      ],
      source: 'DIRECT_QUERY',
      expiresAt: '2026-04-29T11:00:00.000Z',
    };

    const result = await service.execute({
      user: mockUser,
      accessToken: 'mock-token',
      entityLookupAction: 'SELECT_FROM_LAST_LIST',
      entityType: 'Customer',
      selectionIndex: 2,
      memory,
    });

    expect(result.status).toBe('DETAIL_RETURNED');
    expect(result.selectedItemId).toBe('cus_002');
    expect(result.replyText).toContain('苏州制造');
  });
});

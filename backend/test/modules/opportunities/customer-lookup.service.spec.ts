import { CustomerLookupService } from '../../../src/modules/opportunities/customer-lookup.service';
import {
  CRM_CUSTOMERS,
  CRM_OPPORTUNITIES,
} from '../../../src/shared/mock/sample-data';
import type { CrmUser } from '../../../src/shared/types/domain';

describe('CustomerLookupService', () => {
  const actor: CrmUser = {
    id: 'owner_zhang',
    name: '张琳',
    roleIds: ['role_sales'],
    roleNames: ['销售'],
    organizationIds: ['org_north'],
    departmentIds: ['dept_region_east'],
    ownerIds: ['owner_zhang'],
    isAdmin: false,
    exportAllowed: false,
    channels: ['wecom-bot'],
    identitySource: 'mock',
  };

  function createService(): CustomerLookupService {
    return new CustomerLookupService(
      {
        canUseLiveQuery: jest.fn(() => false),
        ensureLiveQueryReady: jest.fn(async () => false),
        listCustomers: jest.fn(() => CRM_CUSTOMERS),
        listOpportunities: jest.fn(() => CRM_OPPORTUNITIES),
      } as never,
      {
        resolveScope: jest.fn(() => ({
          organizationIds: actor.organizationIds,
          departmentIds: actor.departmentIds,
          ownerIds: actor.ownerIds,
          scopeSummary: 'mock-scope',
        })),
      } as never,
      {
        logStep: jest.fn(),
        logWarn: jest.fn(),
      } as never,
    );
  }

  it('仅自己筛选开启时，客户查询应只返回负责人是当前用户本人的候选', async () => {
    const service = createService();

    const result = await service.lookupByName(actor, '信', {
      limit: 10,
      restrictToOwnerOrCollaborator: true,
    });

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      id: 'cus_001',
      ownerId: actor.id,
    });
  });
});

import { CrmCustomerApiService } from '../../../src/modules/opportunities/crm-customer-api.service';
import type { CrmUser } from '../../../src/shared/types/domain';

describe('CrmCustomerApiService', () => {
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

  function createService(): CrmCustomerApiService {
    return new CrmCustomerApiService(
      {
        getCrmAuthConfig: jest.fn(() => ({
          enabled: false,
          mockEnabled: true,
          baseUrl: '',
          versionCode: 'v2',
          device: 'wecom-bot',
          timeoutMs: 3000,
        })),
        getCrmCustomerCreateConfig: jest.fn(() => ({
          defaultCategory: '201',
          defaultSource: '400',
          itDecisionLocationField: 'it_decision_location',
          unifiedSocialCreditCodeField: 'uscc',
        })),
      } as never,
      {
        logStep: jest.fn(),
        logWarn: jest.fn(),
      } as never,
      {
        lookupByName: jest.fn(),
        ensureLiveQueryReady: jest.fn(async () => false),
      } as never,
    );
  }

  it('样例模式下应能按 ID 读取客户当前负责人', async () => {
    const service = createService();

    const record = await service.getById(mockUser, 'cus_001');

    expect(record).toMatchObject({
      id: 'cus_001',
      name: expect.any(String),
      ownerId: 'owner_zhang',
      ownerName: '张琳',
    });
  });
});

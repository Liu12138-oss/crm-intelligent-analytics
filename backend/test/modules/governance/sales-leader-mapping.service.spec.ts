import { SalesLeaderMappingService } from '../../../src/modules/daily-report/sales-leader-mapping.service';
import type { CrmUser, ScopeSnapshot } from '../../../src/shared/types/domain';

describe('SalesLeaderMappingService', () => {
  const wangdong = buildUser('crm_wangdong', '王冬');
  const yangang = buildUser('crm_yangang', '严刚');
  const guanjundong = buildUser('crm_guanjundong', '官俊东');

  function buildUser(id: string, name: string): CrmUser {
    return {
      id,
      name,
      roleIds: ['role_sales'],
      roleNames: ['销售'],
      organizationIds: ['org_north'],
      departmentIds: ['dept_big_north'],
      ownerIds: [],
      isAdmin: false,
      exportAllowed: false,
      channels: ['web-console', 'wecom-bot'],
    };
  }

  it('应优先从组织范围服务生成负责人团队映射', async () => {
    const service = new SalesLeaderMappingService(
      {
        listDailyReportUsers: jest.fn(async () => [wangdong, yangang, guanjundong]),
      } as never,
      {
        hasOrganizationFacts: jest.fn(() => true),
        resolveScope: jest.fn((user: CrmUser): ScopeSnapshot => ({
          organizationIds: user.organizationIds,
          departmentIds: [],
          ownerIds:
            user.id === 'crm_wangdong'
              ? ['crm_wangdong', 'crm_yangang', 'crm_guanjundong']
              : [user.id],
          scopeSummary: user.id === 'crm_wangdong' ? '王冬团队范围' : '本人范围',
          scopeSource: 'wecom-organization',
        })),
      } as never,
    );

    const groups = await service.listMappedSalesGroups();

    expect(groups).toHaveLength(1);
    expect(groups[0].leader.id).toBe('crm_wangdong');
    expect(groups[0].members.map((item) => item.id)).toEqual([
      'crm_yangang',
      'crm_guanjundong',
    ]);
  });

  it('未命中组织事实时应直接返回空映射', async () => {
    const service = new SalesLeaderMappingService(
      {
        listDailyReportUsers: jest.fn(async () => [wangdong, yangang, guanjundong]),
      } as never,
      {
        hasOrganizationFacts: jest.fn(() => false),
        resolveScope: jest.fn(),
      } as never,
    );

    await expect(service.listMappedSalesGroups()).resolves.toEqual([]);
  });
});

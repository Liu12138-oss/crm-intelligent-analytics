import { UserScopeService } from '../../../src/modules/auth/user-scope.service';
import type { CrmUser, ScopeSnapshot } from '../../../src/shared/types/domain';

describe('UserScopeService', () => {
  const user: CrmUser = {
    id: 'crm_wangdong',
    name: '王冬',
    roleIds: ['role_region_director'],
    roleNames: ['大区负责人'],
    organizationIds: ['org_north'],
    departmentIds: ['dept_big_north'],
    ownerIds: [],
    isAdmin: false,
    exportAllowed: false,
    channels: ['web-console', 'wecom-bot'],
    wecomSenderId: 'wx_wangdong',
  };

  it('应优先返回组织范围服务解析的范围快照', () => {
    const organizationScope: ScopeSnapshot = {
      organizationIds: ['org_north'],
      departmentIds: ['dept_authorized'],
      ownerIds: ['crm_wangdong', 'crm_yangang'],
      scopeSummary: '当前按企业微信组织架构展示王冬团队范围。',
      scopeSource: 'mixed',
    };
    const service = new UserScopeService({
      resolveScope: jest.fn(() => organizationScope),
    } as never);

    expect(service.resolveScope(user)).toEqual(organizationScope);
  });

  it('缺少组织范围服务时 CRM 管理员仍应标记为全量范围', () => {
    const service = new UserScopeService();

    const scope = service.resolveScope({
      ...user,
      roleIds: ['2619'],
      roleNames: ['超级管理员'],
      isAdmin: true,
      organizationIds: ['10804'],
      departmentIds: ['5434'],
    });

    expect(scope.organizationIds).toEqual(['10804']);
    expect(scope.isFullAccess).toBe(true);
    expect(scope.fullAccessSource).toBe('crm-admin');
    expect(scope.scopeSummary).toContain('管理员视角');
  });
});

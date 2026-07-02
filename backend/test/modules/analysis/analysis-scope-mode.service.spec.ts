import { AnalysisScopeModeService } from '../../../src/modules/analysis/analysis-scope-mode.service';

describe('AnalysisScopeModeService', () => {
  it('普通范围快照应返回部门范围模式', () => {
    const resolveScope = jest.fn(() => ({
      organizationIds: ['10804'],
      departmentIds: ['469'],
      ownerIds: ['2224755'],
      scopeSummary: '当前按企业微信组织架构展示团队范围。',
    }));
    const service = new AnalysisScopeModeService(
      {
        resolveScope,
      } as never,
    );

    const result = service.resolve({
      id: 'user_sales_director',
      name: '销售总监',
      roleIds: ['role_sales_director'],
      roleNames: ['销售总监'],
      organizationIds: ['10804'],
      departmentIds: ['469'],
      ownerIds: ['2224755'],
      isAdmin: false,
      exportAllowed: true,
      channels: ['web-console'],
    } as never);

    expect(result.mode).toBe('DEPARTMENT_ANALYSIS_SCOPE');
    expect(resolveScope).toHaveBeenCalledTimes(1);
    expect(result.scopeSnapshot.departmentIds).toEqual(['469']);
  });

  it('统一范围快照标记为应用超级管理员时应返回 FULL_ANALYSIS_SCOPE', () => {
    const resolveScope = jest.fn(() => ({
      organizationIds: ['10804'],
      departmentIds: [],
      ownerIds: [],
      scopeSource: 'application-super-admin',
      isFullAccess: true,
      fullAccessSource: 'application-super-admin',
      scopeSummary: '当前已开通应用超级管理员授权，可查看全公司数据。',
    }));
    const service = new AnalysisScopeModeService(
      {
        resolveScope,
      } as never,
    );

    const result = service.resolve({
      id: 'user_ceo',
      name: '总经理',
      roleIds: ['role_common'],
      roleNames: ['普通角色'],
      organizationIds: ['10804'],
      departmentIds: ['469'],
      ownerIds: ['2223349'],
      isAdmin: false,
      exportAllowed: false,
      channels: ['web-console'],
    } as never);

    expect(result.mode).toBe('FULL_ANALYSIS_SCOPE');
    expect(result.scopeSnapshot.scopeSource).toBe('application-super-admin');
  });

  it('CRM 管理员范围快照标记为全量时应返回 FULL_ANALYSIS_SCOPE', () => {
    const resolveScope = jest.fn(() => ({
      organizationIds: ['10804'],
      departmentIds: [],
      ownerIds: [],
      scopeSource: 'crm-user',
      isFullAccess: true,
      fullAccessSource: 'crm-admin',
      scopeSummary: '当前为管理员视角，可查看已授权的全组织结果。',
    }));
    const service = new AnalysisScopeModeService(
      {
        resolveScope,
      } as never,
    );

    const result = service.resolve({
      id: '2224755',
      name: '王亮2',
      roleIds: ['2619'],
      roleNames: ['超级管理员'],
      organizationIds: ['10804'],
      departmentIds: ['5434'],
      ownerIds: [],
      isAdmin: true,
      exportAllowed: true,
      channels: ['web-console'],
    } as never);

    expect(result.mode).toBe('FULL_ANALYSIS_SCOPE');
    expect(result.scopeSnapshot.fullAccessSource).toBe('crm-admin');
  });
});

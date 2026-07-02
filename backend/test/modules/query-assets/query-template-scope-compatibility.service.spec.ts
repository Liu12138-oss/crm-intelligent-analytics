import { QueryTemplateScopeCompatibilityService } from '../../../src/modules/query-assets/query-template-scope-compatibility.service';

describe('QueryTemplateScopeCompatibilityService', () => {
  it('模板声明部门范围超出用户权限时应阻断', () => {
    const service = new QueryTemplateScopeCompatibilityService();

    expect(() =>
      service.ensureCompatible(
        {
          organizationIds: ['10804'],
          departmentIds: ['578'],
          ownerIds: [],
        },
        {
          organizationIds: ['10804'],
          departmentIds: ['469'],
          ownerIds: ['2224755'],
          scopeSummary: '当前按企业微信组织架构展示团队范围。',
        },
      ),
    ).toThrow('这个模板已经限定了特定部门或负责人范围');
  });

  it('模板声明范围被用户权限覆盖时应允许执行', () => {
    const service = new QueryTemplateScopeCompatibilityService();

    expect(() =>
      service.ensureCompatible(
        {
          organizationIds: ['10804'],
          departmentIds: ['469'],
          ownerIds: [],
        },
        {
          organizationIds: ['10804'],
          departmentIds: ['469', '578'],
          ownerIds: ['2224755'],
          scopeSummary: '当前按企业微信组织架构展示团队范围。',
        },
      ),
    ).not.toThrow();
  });
});

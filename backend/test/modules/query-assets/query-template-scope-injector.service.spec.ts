import { QueryTemplateScopeInjectorService } from '../../../src/modules/query-assets/query-template-scope-injector.service';

describe('QueryTemplateScopeInjectorService', () => {
  it('部门模式用户执行 AUTO_SCOPE 模板时应自动注入 organization / department / owner 范围', () => {
    const service = new QueryTemplateScopeInjectorService();
    const compiled = service.inject(
      `
      SELECT o.id, o.title
      FROM opportunities o
      WHERE YEAR(o.created_at) = 2026
    `,
      {
        organizationIds: ['10804'],
        departmentIds: ['469'],
        ownerIds: ['2224755'],
        scopeSummary: '当前按企业微信组织架构展示团队范围。',
      },
    );

    expect(compiled.sql).toContain('organization_id');
    expect(compiled.sql).toContain('department_id');
    expect(compiled.sql).toContain('user_id');
    expect(compiled.sql).toContain('OR');
    expect(compiled.params).toEqual([['10804'], ['469'], ['2224755']]);
  });

  it('客户表 AUTO_SCOPE 模板也应同时按部门和负责人收口', () => {
    const service = new QueryTemplateScopeInjectorService();
    const compiled = service.inject(
      `
      SELECT c.category, COUNT(c.id) AS count
      FROM customers c
      GROUP BY c.category
    `,
      {
        organizationIds: ['10804'],
        departmentIds: [],
        ownerIds: ['1001', '1002', '1003'],
        scopeSummary: '当前按企业微信组织架构展示牛劲团队范围。',
      },
    );

    expect(compiled.sql).toContain('organization_id');
    expect(compiled.sql).toContain('department_id');
    expect(compiled.sql).toContain('user_id');
    expect(compiled.sql).toContain('OR');
    expect(compiled.params).toEqual([
      ['10804'],
      ['__crm_scope_no_match__'],
      ['1001', '1002', '1003'],
    ]);
  });
});

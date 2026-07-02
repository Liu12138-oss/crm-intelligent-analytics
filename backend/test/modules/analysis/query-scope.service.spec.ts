import { QueryScopeService } from '../../../src/modules/analysis/query-scope.service';
import { QueryCompilerService } from '../../../src/modules/analysis/query-compiler.service';
import type { AnalysisIntent, ScopeSnapshot } from '../../../src/shared/types/domain';

describe('QueryScopeService', () => {
  it('应同时保留团队成员范围和白名单部门范围', () => {
    const service = new QueryScopeService();
    const intent: AnalysisIntent = {
      domain: 'opportunity-analysis',
      metrics: ['新增商机金额'],
      dimensions: ['销售负责人'],
      filters: {},
      missingConditions: [],
      normalizedQuestion: '查看团队和授权部门商机情况',
      requestedAction: 'READONLY_ANALYSIS',
      confidence: 'HIGH',
    };
    const scope: ScopeSnapshot = {
      organizationIds: ['org_north'],
      departmentIds: ['dept_authorized'],
      ownerIds: ['crm_wangdong', 'crm_yangang'],
      scopeSummary: '当前按企业微信组织架构展示王冬团队范围，并叠加授权部门。',
    };

    const scopedIntent = service.injectScope(intent, scope);

    expect(scopedIntent.filters).toMatchObject({
      organizationIds: ['org_north'],
      departmentIds: ['dept_authorized'],
      ownerIds: ['crm_wangdong', 'crm_yangang'],
    });
  });

  it('默认业务部门只用于裁剪团队成员，不应作为 CRM 部门条件注入自由问数 SQL', () => {
    const scopeService = new QueryScopeService();
    const compilerService = new QueryCompilerService();
    const intent: AnalysisIntent = {
      domain: 'opportunity-analysis',
      metrics: ['新增商机金额'],
      dimensions: ['销售负责人'],
      filters: {
        startAt: '2026-05-15T00:00:00.000Z',
        endAt: '2026-05-22T00:00:00.000Z',
      },
      missingConditions: [],
      normalizedQuestion: '近一周新增商机明细',
      requestedAction: 'READONLY_ANALYSIS',
      confidence: 'HIGH',
      resultKindHint: 'owner-ranking',
    };
    const scope: ScopeSnapshot = {
      organizationIds: ['10804'],
      departmentIds: [],
      ownerIds: ['1001', '1002', '1003'],
      defaultDepartmentIds: ['101', '102'],
      scopeSummary: '当前按企业微信组织架构展示牛劲团队范围。',
    };

    const scopedIntent = scopeService.injectScope(intent, scope);
    const compiled = compilerService.compile(
      compilerService.buildPlan(scopedIntent),
    );

    expect(compiled.sql).toContain('o.user_id IN (?, ?, ?)');
    expect(compiled.sql).not.toContain('o.department_id IN');
    expect(compiled.params).toEqual([
      '10804',
      '1001',
      '1002',
      '1003',
      '2026-05-15T00:00:00.000Z',
      '2026-05-22T00:00:00.000Z',
      100,
    ]);
    expect(compiled.params).not.toEqual(expect.arrayContaining(['101', '102']));
  });
});

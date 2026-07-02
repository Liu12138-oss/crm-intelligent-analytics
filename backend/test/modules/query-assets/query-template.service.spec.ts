import { QueryTemplateService } from '../../../src/modules/query-assets/query-template.service';
import { QueryTemplateScopeAnalyzerService } from '../../../src/modules/query-assets/query-template-scope-analyzer.service';
import { QueryTemplateSqlGuardService } from '../../../src/modules/query-assets/query-template-sql-guard.service';
import { QueryRiskGuardService } from '../../../src/modules/analysis/query-risk-guard.service';
import type { AnalysisRequestRecord, AnalysisResultRecord, CrmUser } from '../../../src/shared/types/domain';

describe('QueryTemplateService 保存问数模板', () => {
  const user: CrmUser = {
    id: 'user_sales_director',
    name: '销售总监',
    roleIds: ['role_sales_director'],
    roleNames: ['销售总监'],
    organizationIds: ['10804'],
    departmentIds: ['578'],
    ownerIds: ['1001', '1002'],
    isAdmin: false,
    identitySource: 'database',
  } as never;

  function createService(params: {
    request: AnalysisRequestRecord;
    result: AnalysisResultRecord;
  }) {
    const savedTemplates: unknown[] = [];
    const scopeAnalyzerService = new QueryTemplateScopeAnalyzerService();
    const service = new QueryTemplateService(
      {
        listAll: jest.fn(() => []),
        findById: jest.fn(),
        save: jest.fn((template) => {
          savedTemplates.push(template);
          return template;
        }),
      } as never,
      {
        hasVisibleMenu: jest.fn(() => true),
        hasAction: jest.fn(() => true),
      } as never,
      {
        ensureAction: jest.fn(),
      } as never,
      {
        findRequestById: jest.fn(() => params.request),
        findResultByRequestId: jest.fn(() => params.result),
      } as never,
      new QueryTemplateSqlGuardService({
        getCurrent: jest.fn(() => ({
          allowedTables: ['opportunities', 'users'],
        })),
      } as never),
      scopeAnalyzerService,
      new QueryRiskGuardService(),
      {
        create: jest.fn(),
      } as never,
      {
        resolveScope: jest.fn(() => ({
          organizationIds: ['10804'],
          departmentIds: [],
          ownerIds: ['1001', '1002'],
          scopeSummary: '当前按企业微信组织架构展示销售总监团队范围。',
        })),
      } as never,
    );

    return { service, savedTemplates };
  }

  it('应把自由问数生成的问号参数 SQL 转为可复跑命名参数模板', () => {
    const request = {
      id: 'query_saved_owner_ranking',
      requesterId: user.id,
      requesterRoleIds: user.roleIds,
      sessionId: 'session_saved_owner_ranking',
      entryChannel: 'web-console',
      querySource: 'FREE_TEXT',
      organizationScope: ['10804'],
      departmentScope: [],
      ownerScope: ['1001', '1002'],
      intentDomain: 'opportunity-analysis',
      metrics: ['新增商机金额'],
      dimensions: ['销售负责人'],
      filters: {
        organizationIds: ['10804'],
        ownerIds: ['1001', '1002'],
        departmentIds: [],
        startAt: '2026-05-01T00:00:00+08:00',
        endAt: '2026-06-01T00:00:00+08:00',
      },
      missingConditions: [],
      generatedQuery: `-- 新增商机金额负责人排名 [primary-summary]
SELECT o.user_id AS owner_id,
COALESCE(u.name, CAST(o.user_id AS CHAR)) AS owner_name,
SUM(o.expect_amount) AS amount,
COUNT(o.id) AS count
FROM opportunities o
LEFT JOIN users u ON u.id = o.user_id
WHERE o.organization_id IN (?) AND o.user_id IN (?, ?) AND o.created_at >= ? AND o.created_at < ?
GROUP BY o.user_id, u.name
ORDER BY amount DESC
LIMIT ?`,
      status: 'RETURNED',
      createdAt: '2026-05-28T10:00:00.000Z',
      completedAt: '2026-05-28T10:00:01.000Z',
    } as AnalysisRequestRecord;
    const result = {
      requestId: request.id,
      title: '新增商机金额负责人排名报告',
      summary: '已返回负责人排名。',
      primaryView: {
        viewType: 'RANKING_TABLE',
        title: '新增商机金额负责人排名',
        columns: [{ key: 'owner_name', label: '负责人' }],
      },
      rowCount: 2,
      tableRows: [],
      metricCards: [],
      secondaryViews: [],
      keyFindings: [],
      scopeSummary: '当前按企业微信组织架构展示销售总监团队范围。',
      appliedFilters: [],
      report: {} as never,
      consistencyToken: 'token_saved_owner_ranking',
      executionMode: 'GUARDED_DIRECT_QUERY',
      executionSource: 'GUARDED_READONLY_SQL',
      preferredSource: 'GUARDED_READONLY_SQL',
      matchedAdapter: 'analysis-query',
      streamBlocks: [],
      availableActions: [],
      returnedAt: '2026-05-28T10:00:01.000Z',
      dataFreshnessAt: '2026-05-28T10:00:01.000Z',
    } as AnalysisResultRecord;
    const { service, savedTemplates } = createService({ request, result });

    const saved = service.saveQueryAsTemplate(user, request.id, {
      name: '新增商机金额负责人排名报告',
    });

    expect(saved.sqlText).not.toContain('?');
    expect(saved.sqlText).toContain('o.organization_id IN (:scopeOrganizationIds)');
    expect(saved.sqlText).toContain('o.user_id IN (:scopeOwnerIds)');
    expect(saved.sqlText).toContain('o.created_at >= :startAt');
    expect(saved.sqlText).toContain('o.created_at < :endAt');
    expect(saved.sqlText).toContain('LIMIT :rowLimit');
    expect(saved.defaultFilters).toEqual({
      startAt: '2026-05-01T00:00:00+08:00',
      endAt: '2026-06-01T00:00:00+08:00',
      rowLimit: 100,
    });
    expect(savedTemplates).toHaveLength(1);
  });

  it('工作台编辑我的模板时只允许更新基础展示信息', () => {
    const currentTemplate = {
      id: 'tpl_mine_edit',
      name: '新增商机金额趋势分析报告',
      description: '查看新增商机金额趋势。',
      tags: ['商机'],
      defaultQuestionText: '新增商机金额趋势',
      defaultFilters: { timeRange: '本季度' },
      defaultViewType: 'LINE_CHART',
      queryMode: 'FIXED_SQL',
      sqlText: 'SELECT 1 AS value',
      sqlVersion: '2026.05.28',
      parameterSchema: [],
      renderConfig: {
        primaryViewType: 'LINE_CHART',
        primaryTitle: '新增商机金额趋势分析报告',
        chartDimensionKey: 'month',
        chartMetricKey: 'amount',
      },
      visibleRoleIds: ['role_sales_director'],
      ownerUserId: user.id,
      visibilityType: 'SHARED',
      displayOrder: 1,
      clickCount7d: 0,
      usageCountTotal: 0,
      hitRatePercent: 98,
      optimizationStatus: 'HEALTHY',
      status: 'ACTIVE',
      ownedBy: user.id,
      updatedAt: '2026-05-28T09:00:00.000Z',
    } as const;
    const repository = {
      listAll: jest.fn(() => [currentTemplate]),
      findById: jest.fn(() => currentTemplate),
      save: jest.fn((template) => template),
    };
    const service = new QueryTemplateService(
      repository as never,
      {
        hasVisibleMenu: jest.fn(() => true),
        hasAction: jest.fn(() => true),
      } as never,
      {
        ensureAction: jest.fn(),
      } as never,
      {
        findRequestById: jest.fn(),
        findResultByRequestId: jest.fn(),
      } as never,
      new QueryTemplateSqlGuardService({
        getCurrent: jest.fn(() => ({
          allowedTables: ['opportunities'],
        })),
      } as never),
      new QueryTemplateScopeAnalyzerService(),
      new QueryRiskGuardService(),
      {
        create: jest.fn(),
      } as never,
      {
        resolveScope: jest.fn(() => ({
          organizationIds: ['10804'],
          departmentIds: [],
          ownerIds: ['1001', '1002'],
          scopeSummary: '当前按企业微信组织架构展示销售总监团队范围。',
        })),
      } as never,
    );

    const updated = service.updateMine(user, 'tpl_mine_edit', {
      name: '第一季度商机金额趋势分析报告',
      description: '查看第一季度新增商机金额趋势。',
      defaultQuestionText: '第一季度商机金额趋势',
      defaultViewType: 'BAR_CHART',
      tags: ['商机', '趋势', '商机'],
    });

    expect(updated.name).toBe('第一季度商机金额趋势分析报告');
    expect(updated.description).toBe('查看第一季度新增商机金额趋势。');
    expect(updated.defaultQuestionText).toBe('第一季度商机金额趋势');
    expect(updated.defaultViewType).toBe('BAR_CHART');
    expect(updated.tags).toEqual(['商机', '趋势']);
    expect(updated.sqlText).toBe(currentTemplate.sqlText);
    expect(updated.visibleRoleIds).toEqual(currentTemplate.visibleRoleIds);
    expect(updated.renderConfig).toEqual({
      ...currentTemplate.renderConfig,
      primaryViewType: 'BAR_CHART',
      primaryTitle: '第一季度商机金额趋势分析报告',
    });
  });
});

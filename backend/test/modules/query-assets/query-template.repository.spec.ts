import { QueryTemplateRepository } from '../../../src/modules/query-assets/query-template.repository';

describe('QueryTemplateRepository legacy template migration', () => {
  it('历史内置模板缺少 SQL 时，应回填真实 SQL 而不是 placeholder', () => {
    const repository = new QueryTemplateRepository({
      state: {
        queryTemplates: [
          {
            id: 'tpl_quarter_health',
            name: '季度商机健康度总览',
            description: '查看季度新增商机金额、赢单率和趋势概况。',
            defaultQuestionText: '本季度各区域新增商机金额、赢单率和环比变化',
            defaultFilters: {
              timeRange: '本季度',
            },
            defaultViewType: 'BAR_CHART',
            visibleRoleIds: ['role_sales_director'],
            displayOrder: 1,
            clickCount7d: 42,
            hitRatePercent: 92.4,
            optimizationStatus: 'HEALTHY',
            status: 'ACTIVE',
            ownedBy: 'user_admin',
            updatedAt: '2026-03-24T10:00:00Z',
          },
          {
            id: 'tpl_owner_ranking',
            name: '负责人新增商机排名',
            description: '查看本月销售负责人新增商机金额排名。',
            defaultQuestionText: '本月各销售负责人新增商机金额排名',
            defaultFilters: {
              timeRange: '本月',
            },
            defaultViewType: 'RANKING_TABLE',
            visibleRoleIds: ['role_sales_director'],
            displayOrder: 2,
            clickCount7d: 35,
            hitRatePercent: 89.1,
            optimizationStatus: 'HEALTHY',
            status: 'ACTIVE',
            ownedBy: 'user_admin',
            updatedAt: '2026-03-24T10:00:00Z',
          },
        ],
      },
    } as never);

    const quarterTemplate = repository.findById('tpl_quarter_health');
    const ownerRankingTemplate = repository.findById('tpl_owner_ranking');

    expect(quarterTemplate?.sqlText).toContain('FROM opportunities o');
    expect(quarterTemplate?.sqlText).not.toBe('SELECT 1 AS placeholder_value');
    expect(quarterTemplate?.sqlText).not.toContain('INNER JOIN customers cu ON o.customer_id = cu.id');
    expect(quarterTemplate?.sqlVersion).toBe('2026.05.28-legacy-left-join');
    expect(ownerRankingTemplate?.sqlText).toContain('LEFT JOIN users u');
    expect(ownerRankingTemplate?.sqlText).not.toBe('SELECT 1 AS placeholder_value');
    expect(ownerRankingTemplate?.sqlVersion).toBe('2026.05.28-legacy-left-join');
  });

  it('历史模板缺少治理字段时，应标记为待校验而不是静默当作安全模板', () => {
    const repository = new QueryTemplateRepository({
      state: {
        queryTemplates: [
          {
            id: 'tpl_legacy_custom',
            name: '历史自定义模板',
            description: '历史自定义模板',
            defaultQuestionText: '历史自定义模板',
            defaultFilters: {},
            defaultViewType: 'DETAIL_TABLE',
            queryMode: 'FIXED_SQL',
            sqlText: 'SELECT id, title FROM opportunities',
            sqlVersion: 'legacy',
            parameterSchema: [],
            renderConfig: {
              primaryViewType: 'TABLE',
              primaryTitle: '历史自定义模板',
            },
            visibleRoleIds: [],
            displayOrder: 9,
            clickCount7d: 0,
            hitRatePercent: 0,
            optimizationStatus: 'HEALTHY',
            status: 'ACTIVE',
            ownedBy: 'user_admin',
            updatedAt: '2026-05-19T00:00:00.000Z',
          },
        ],
      },
    } as never);

    const template = repository.findById('tpl_legacy_custom');

    expect(template?.scopeGovernanceSnapshot?.reviewStatus).toBe('PENDING_VALIDATION');
    expect(template?.scopeGovernanceSnapshot?.scopeClassification).toBe('AUTO_SCOPABLE');
    expect(template?.validationSnapshot?.scopeAnalysis?.scopeClassification).toBe('AUTO_SCOPABLE');
  });
});

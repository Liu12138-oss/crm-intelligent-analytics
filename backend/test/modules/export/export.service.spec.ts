import { ExportService } from '../../../src/modules/export/export.service';
import { QueryTemplateScopeAnalyzerService } from '../../../src/modules/query-assets/query-template-scope-analyzer.service';

describe('ExportService template governance', () => {
  const user = {
    id: 'user_sales_director',
    name: '销售总监',
    roleNames: ['销售总监'],
    roleIds: ['role_sales_director'],
    organizationIds: ['org_north'],
    departmentIds: ['dept_shandong'],
    ownerIds: ['user_sales_001'],
    isAdmin: false,
    exportAllowed: true,
    channels: ['web-console'],
  } as never;

  function createService() {
    const exportRequestRepository = {
      save: jest.fn((record) => record),
    };
    const auditEventRepository = {
      create: jest.fn((record) => record),
    };
    const service = new ExportService(
      {
        findRequestById: jest.fn(() => ({
          id: 'query_static',
          requesterId: 'user_sales_director',
          requesterRoleIds: ['role_sales_director'],
          sessionId: 'session_1',
          entryChannel: 'web-console',
          querySource: 'COMMON_TEMPLATE',
          templateId: 'tpl_static_team',
          organizationScope: ['org_north'],
          departmentScope: ['dept_shandong'],
          ownerScope: ['user_sales_001'],
          intentDomain: 'opportunity-analysis',
          metrics: [],
          dimensions: [],
          filters: {},
          missingConditions: [],
          status: 'RETURNED',
          createdAt: '2026-05-19T00:00:00.000Z',
        })),
        findResultByRequestId: jest.fn(() => ({
          requestId: 'query_static',
          title: '静态团队模板',
          scopeSummary: '当前仅展示授权范围数据。',
          appliedFilters: [],
          metricCards: [],
          secondaryViews: [],
          tableRows: [{ team_name: '大南区-深圳区', amount: 100 }],
          keyFindings: [],
          rowCount: 1,
          dataFreshnessAt: '2026-05-19T00:00:00.000Z',
          consistencyToken: 'token_1',
          report: {
            variant: 'summary',
            reportTitle: '静态团队模板',
            executiveSummary: '静态团队模板',
            keyFindings: [],
            metricCards: [],
            chartBlocks: [],
            tableBlocks: [],
            sections: [],
            datasetReferences: [],
            scopeSummary: '当前仅展示授权范围数据。',
            appliedFilters: [],
            availableActions: [],
          },
          streamBlocks: [],
          availableActions: [],
          returnedAt: '2026-05-19T00:00:00.000Z',
        })),
      } as never,
      {
        getCurrent: jest.fn(() => ({ exportRowLimit: 1000 })),
      } as never,
      exportRequestRepository as never,
      {
        evaluate: jest.fn(() => ({ allowed: true })),
      } as never,
      auditEventRepository as never,
      {
        resolveScope: jest.fn(() => ({
          organizationIds: ['org_north'],
          departmentIds: ['dept_shandong'],
          ownerIds: ['user_sales_001'],
          scopeSummary: '当前仅展示授权范围数据。',
        })),
      } as never,
      {
        findById: jest.fn(() => ({
          id: 'tpl_static_team',
          status: 'ACTIVE',
          sqlText: `SELECT tt.team_name, tt.annual_target
FROM (
  SELECT '大北区-山东区' AS team_name, 2100 AS annual_target UNION ALL
  SELECT '大南区-深圳区', 4600
) tt`,
        })),
      } as never,
      new QueryTemplateScopeAnalyzerService(),
    );

    return {
      service,
      exportRequestRepository,
      auditEventRepository,
    };
  }

  it('强制治理模式下当前模板不可执行时应阻断历史结果导出', () => {
    const originalMode = process.env.QUERY_TEMPLATE_SCOPE_GOVERNANCE_MODE;
    process.env.QUERY_TEMPLATE_SCOPE_GOVERNANCE_MODE = 'enforce';
    const { service, auditEventRepository } = createService();

    try {
      const result = service.createExport(user, 'query_static', 'csv');

      expect(result).toEqual(
        expect.objectContaining({
          status: 'BLOCKED',
          blockedReason: expect.stringContaining('范围治理审核'),
        }),
      );
      expect(auditEventRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'EXPORT_BLOCKED',
          riskLevel: 'HIGH',
        }),
      );
    } finally {
      process.env.QUERY_TEMPLATE_SCOPE_GOVERNANCE_MODE = originalMode;
    }
  });
});

import { BadRequestException } from '@nestjs/common';
import {
  QueryPreflightError,
} from '../../../src/modules/analysis/analysis.errors';
import { AnalysisForecastService } from '../../../src/modules/analysis/analysis-forecast.service';
import { AnalysisInsightEvidenceService } from '../../../src/modules/analysis/analysis-insight-evidence.service';
import { AnalysisRichReportService } from '../../../src/modules/analysis/analysis-rich-report.service';
import { QueryResultPresentationService } from '../../../src/modules/query-assets/query-result-presentation.service';
import { QueryTemplateScopeAnalyzerService } from '../../../src/modules/query-assets/query-template-scope-analyzer.service';
import { QueryTemplateScopeCompatibilityService } from '../../../src/modules/query-assets/query-template-scope-compatibility.service';
import { QueryTemplateExecutionService } from '../../../src/modules/query-assets/query-template-execution.service';
import { QueryTemplateScopeInjectorService } from '../../../src/modules/query-assets/query-template-scope-injector.service';

describe('QueryTemplateExecutionService real execution', () => {
  const presentationService = new QueryResultPresentationService();
  const scopeAnalyzerService = new QueryTemplateScopeAnalyzerService();
  const scopeInjectorService = new QueryTemplateScopeInjectorService();
  const scopeCompatibilityService = new QueryTemplateScopeCompatibilityService();
  const richReportService = new AnalysisRichReportService(
    new AnalysisInsightEvidenceService(new AnalysisForecastService()),
    {
      generateRichAnalysisReport: jest.fn(async () => null),
    } as never,
  );

  function createService(params?: {
    template?: Record<string, unknown>;
    canUseLiveQuery?: boolean;
    executeRows?: Array<Record<string, unknown>>;
    preflightError?: Error;
    scope?: {
      mode: 'FULL_ANALYSIS_SCOPE' | 'DEPARTMENT_ANALYSIS_SCOPE';
      scopeSnapshot: {
        organizationIds: string[];
        departmentIds: string[];
        ownerIds: string[];
        scopeSummary: string;
      };
    };
  }) {
    const template = {
      id: 'tpl_live_team_completion',
      name: '团队完成预测',
      description: '真实执行测试模板',
      defaultQuestionText: '团队完成预测',
      defaultFilters: {
        year: 2026,
      },
      defaultViewType: 'BAR_CHART',
      queryMode: 'FIXED_SQL',
      sqlVersion: '2026.05.13-live',
      sqlText:
        'SELECT o.id AS opportunity_id, o.title AS project_name FROM opportunities o WHERE YEAR(o.created_at) = :year',
      parameterSchema: [
        {
          key: 'year',
          label: '统计年份',
          type: 'number',
          required: true,
          defaultValue: 2026,
        },
      ],
      renderConfig: {
        primaryViewType: 'BAR_CHART',
        primaryTitle: '团队完成预测',
        chartDimensionKey: 'team_name',
        chartMetricKey: 'annual_forecast',
        tableColumns: [
          { key: 'team_name', label: '团队' },
          { key: 'annual_target', label: '全年目标' },
          { key: 'annual_forecast', label: '全年预测' },
        ],
        metricFields: [
          { key: 'annual_target', label: '全年目标' },
          { key: 'annual_forecast', label: '全年预测' },
        ],
      },
      visibleRoleIds: ['role_sales_director'],
      displayOrder: 1,
      clickCount7d: 0,
      hitRatePercent: 0,
      optimizationStatus: 'HEALTHY',
      status: 'ACTIVE',
      ownedBy: 'user_admin',
      updatedAt: '2026-05-13T00:00:00.000Z',
      ...params?.template,
    };

    const executeQuery = jest.fn(async () => params?.executeRows ?? [
      {
        team_name: '大北区-北区金融部',
        annual_target: 6000,
        annual_forecast: 4800,
      },
    ]);

    const service = new QueryTemplateExecutionService(
      {
        findById: jest.fn(() => template),
      } as never,
      {
        validateReadonlyTemplateSql: jest.fn(),
      } as never,
      presentationService,
      {
        save: jest.fn(),
      } as never,
      {
        saveRequest: jest.fn(),
        saveResult: jest.fn(),
      } as never,
      {
        canUseLiveQuery: jest.fn(() => params?.canUseLiveQuery ?? true),
        ensureLiveQueryReady: jest.fn(async () => params?.canUseLiveQuery ?? true),
        preflightQuery: jest.fn(async () => {
          if (params?.preflightError) {
            throw params.preflightError;
          }
          return undefined;
        }),
        executeQuery,
      } as never,
      {
        resolve: jest.fn(() =>
          params?.scope ?? {
            mode: 'DEPARTMENT_ANALYSIS_SCOPE',
            scopeSnapshot: {
              organizationIds: ['org_north'],
              departmentIds: ['dept_shandong'],
              ownerIds: ['user_sales_001'],
              scopeSummary: '当前仅展示授权范围数据。',
            },
          },
        ),
      } as never,
      {
        ensureQuerySafe: jest.fn(),
      } as never,
      {
        run: jest.fn(async (_context, handler: () => Promise<unknown>) => handler()),
      } as never,
      scopeAnalyzerService,
      scopeInjectorService,
      scopeCompatibilityService,
      richReportService,
    );

    return {
      service,
      executeQuery,
      template,
    };
  }

  it('应编译命名参数并走真实 CRM 只读执行', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const { service, executeQuery } = createService();

    try {
      const result = await service.execute(
        {
          id: 'user_sales_director',
          name: '销售总监',
          roleNames: ['销售总监'],
          roleIds: ['role_sales_director'],
          organizationIds: ['org_north'],
          departmentIds: ['dept_shandong'],
          ownerIds: ['user_sales_001'],
          isAdmin: false,
          identitySource: 'database',
        } as never,
        'tpl_live_team_completion',
        {
          parameters: {
            year: 2026,
          },
          includeAiReport: true,
        },
      );

      expect(executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('organization_id'),
        [2026, ['org_north'], ['dept_shandong'], ['user_sales_001']],
        expect.objectContaining({
          timeoutMs: expect.any(Number),
        }),
      );
      expect(result.queryId).toEqual(expect.any(String));
      expect(result.resultBundle.primaryBlock.series?.[0]).toEqual(
        expect.objectContaining({
          label: '大北区-北区金融部',
          value: 4800,
        }),
      );
      expect(result.resultBundle.metricCards).toEqual(
        expect.arrayContaining([
          { name: '全年目标', value: '6,000 万元' },
          { name: '全年预测', value: '4,800 万元' },
        ]),
      );
      expect(result.resultBundle.primaryBlock.columns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'annual_target', label: '全年目标（万元）' }),
          expect.objectContaining({ key: 'annual_forecast', label: '全年预测（万元）' }),
        ]),
      );
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('带 CTE 与权限占位符的模板应保留 WITH 结构并绑定当前权限参数', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const { service, executeQuery } = createService({
      template: {
        sqlText: `WITH monthly_team_opportunities AS (
  SELECT o.organization_id, o.department_id, o.user_id, SUM(o.expect_amount) AS amount
  FROM opportunities o
  WHERE YEAR(o.created_at) = :year
    AND o.organization_id IN (:scopeOrganizationIds)
    AND (:scopeUnrestricted = 1 OR o.department_id IN (:scopeDepartmentIds) OR o.user_id IN (:scopeOwnerIds))
  GROUP BY o.organization_id, o.department_id, o.user_id
)
SELECT SUM(amount) AS total_amount
FROM monthly_team_opportunities`,
      },
      scope: {
        mode: 'DEPARTMENT_ANALYSIS_SCOPE',
        scopeSnapshot: {
          organizationIds: ['org_north'],
          departmentIds: ['dept_shandong'],
          ownerIds: ['user_sales_001'],
          scopeSummary: '当前仅展示授权范围数据。',
        },
      },
    });

    try {
      await service.execute(
        {
          id: 'user_sales_director',
          name: '销售总监',
          roleNames: ['销售总监'],
          roleIds: ['role_sales_director'],
          organizationIds: ['org_north'],
          departmentIds: ['dept_shandong'],
          ownerIds: ['user_sales_001'],
          isAdmin: false,
          identitySource: 'database',
        } as never,
        'tpl_live_team_completion',
        {
          parameters: {
            year: 2026,
          },
          includeAiReport: false,
        },
      );

      const firstCall = executeQuery.mock.calls[0] as unknown[];
      expect(firstCall[0]).toMatch(/^WITH monthly_team_opportunities AS/);
      expect(firstCall[1]).toEqual([
        2026,
        ['org_north'],
        0,
        ['dept_shandong'],
        ['user_sales_001'],
      ]);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('近一周新增商机明细模板应使用 CRM 负责人范围，不应把企业微信默认部门当成 CRM 部门范围', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const { service, executeQuery } = createService({
      template: {
        id: 'tpl_company_weekly_new_opportunity',
        name: '近一周新增商机明细',
        defaultQuestionText: '近一周新增商机明细',
        defaultFilters: {
          days: 7,
        },
        defaultViewType: 'DETAIL_TABLE',
        sqlText:
          'SELECT o.id AS opportunity_id FROM opportunities o WHERE o.created_at >= DATE_SUB(CURDATE(), INTERVAL :days DAY) AND o.organization_id IN (:scopeOrganizationIds) AND (:scopeUnrestricted = 1 OR o.department_id IN (:scopeDepartmentIds) OR o.user_id IN (:scopeOwnerIds)) ORDER BY o.created_at DESC LIMIT 50',
        parameterSchema: [
          {
            key: 'days',
            label: '最近天数',
            type: 'number',
            required: true,
            defaultValue: 7,
          },
        ],
      },
      scope: {
        mode: 'DEPARTMENT_ANALYSIS_SCOPE',
        scopeSnapshot: {
          organizationIds: ['10804'],
          departmentIds: [],
          ownerIds: ['1001', '1002', '1003'],
          scopeSummary: '当前按企业微信组织架构展示牛劲团队范围。',
        },
      },
    });

    try {
      await service.execute(
        {
          id: '1001',
          name: '牛劲',
          roleNames: ['山东区负责人'],
          roleIds: ['role_shandong_director'],
          organizationIds: ['10804'],
          departmentIds: ['578'],
          ownerIds: [],
          isAdmin: false,
          identitySource: 'database',
        } as never,
        'tpl_company_weekly_new_opportunity',
        {
          parameters: {
            days: 7,
          },
          includeAiReport: false,
        },
      );

      const firstCall = executeQuery.mock.calls[0] as unknown[];
      expect(firstCall[0]).toContain('o.user_id IN');
      expect(firstCall[1]).toEqual([
        7,
        ['10804'],
        0,
        ['__crm_scope_no_match__'],
        ['1001', '1002', '1003'],
      ]);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('全量权限用户执行声明权限模板时不应把空部门或负责人数组编译成 IN 空列表', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const { service, executeQuery } = createService({
      template: {
        sqlText:
          'SELECT o.id AS opportunity_id FROM opportunities o WHERE o.organization_id IN (:scopeOrganizationIds) AND (:scopeUnrestricted = 1 OR o.department_id IN (:scopeDepartmentIds) OR o.user_id IN (:scopeOwnerIds))',
      },
      scope: {
        mode: 'FULL_ANALYSIS_SCOPE',
        scopeSnapshot: {
          organizationIds: ['org_north'],
          departmentIds: [],
          ownerIds: [],
          scopeSummary: '当前已开通全量分析权限。',
        },
      },
    });

    try {
      await service.execute(
        {
          id: 'user_admin',
          name: '系统管理员',
          roleNames: ['系统管理员'],
          roleIds: ['role_admin'],
          organizationIds: ['org_north'],
          departmentIds: [],
          ownerIds: [],
          isAdmin: true,
          identitySource: 'database',
        } as never,
        'tpl_live_team_completion',
        {
          parameters: {
            year: 2026,
          },
          includeAiReport: false,
        },
      );

      const firstCall = executeQuery.mock.calls[0] as unknown[];
      expect(firstCall[1]).toEqual([
        ['org_north'],
        1,
        ['__crm_scope_no_match__'],
        ['__crm_scope_no_match__'],
      ]);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('全量权限用户没有组织边界时不应把组织空数组编译成无命中条件', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const { service, executeQuery } = createService({
      template: {
        sqlText:
          'SELECT o.id AS opportunity_id FROM opportunities o WHERE o.organization_id IN (:scopeOrganizationIds) AND (:scopeUnrestricted = 1 OR o.department_id IN (:scopeDepartmentIds) OR o.user_id IN (:scopeOwnerIds))',
      },
      scope: {
        mode: 'FULL_ANALYSIS_SCOPE',
        scopeSnapshot: {
          organizationIds: [],
          departmentIds: [],
          ownerIds: [],
          scopeSummary: '当前已开通全量分析权限。',
        },
      },
    });

    try {
      await service.execute(
        {
          id: 'user_admin',
          name: '系统管理员',
          roleNames: ['系统管理员'],
          roleIds: ['role_admin'],
          organizationIds: [],
          departmentIds: [],
          ownerIds: [],
          isAdmin: true,
          identitySource: 'database',
        } as never,
        'tpl_live_team_completion',
        {
          parameters: {
            year: 2026,
          },
          includeAiReport: false,
        },
      );

      const firstCall = executeQuery.mock.calls[0] as unknown[];
      expect(firstCall[0]).not.toContain('organization_id IN (?)');
      expect(firstCall[1]).toEqual([
        1,
        ['__crm_scope_no_match__'],
        ['__crm_scope_no_match__'],
      ]);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('模板 SQL 显式限定了超出当前权限的部门范围时应阻断真实执行', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const { service } = createService({
      template: {
        sqlText: 'SELECT o.id AS opportunity_id FROM opportunities o WHERE o.department_id IN (578)',
      },
    });

    try {
      await expect(
        service.execute(
          {
            id: 'user_sales_director',
            name: '销售总监',
            roleNames: ['销售总监'],
            roleIds: ['role_sales_director'],
            organizationIds: ['org_north'],
            departmentIds: ['dept_shandong'],
            ownerIds: ['user_sales_001'],
            isAdmin: false,
            identitySource: 'database',
          } as never,
          'tpl_live_team_completion',
          {
            parameters: {
              year: 2026,
            },
            includeAiReport: false,
          },
        ),
      ).rejects.toThrow('这个模板已经限定了特定部门或负责人范围');
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('非测试环境未连上真实只读数据源时不应回退样例数据', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const { service } = createService({
      canUseLiveQuery: false,
    });

    try {
      await expect(
        service.execute(
          {
            id: 'user_sales_director',
            name: '销售总监',
            roleNames: ['销售总监'],
            roleIds: ['role_sales_director'],
            organizationIds: ['org_north'],
            departmentIds: ['dept_shandong'],
            ownerIds: ['user_sales_001'],
            isAdmin: false,
            identitySource: 'database',
          } as never,
          'tpl_live_team_completion',
          {
            parameters: {
              year: 2026,
            },
            includeAiReport: false,
          },
        ),
      ).rejects.toThrow(BadRequestException);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('强制治理模式下未审核静态团队模板应阻断普通用户执行', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalMode = process.env.QUERY_TEMPLATE_SCOPE_GOVERNANCE_MODE;
    process.env.NODE_ENV = 'development';
    process.env.QUERY_TEMPLATE_SCOPE_GOVERNANCE_MODE = 'enforce';
    const { service } = createService({
      template: {
        sqlText: `SELECT tt.team_name, tt.annual_target
FROM (
  SELECT '大北区-山东区' AS team_name, 2100 AS annual_target UNION ALL
  SELECT '大南区-深圳区', 4600
) tt`,
      },
    });

    try {
      await expect(
        service.execute(
          {
            id: 'user_sales_director',
            name: '销售总监',
            roleNames: ['销售总监'],
            roleIds: ['role_sales_director'],
            organizationIds: ['org_north'],
            departmentIds: ['dept_shandong'],
            ownerIds: ['user_sales_001'],
            isAdmin: false,
            identitySource: 'database',
          } as never,
          'tpl_live_team_completion',
          {
            parameters: { year: 2026 },
            includeAiReport: false,
          },
        ),
      ).rejects.toThrow('当前模板需要管理员完成范围治理审核');
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      process.env.QUERY_TEMPLATE_SCOPE_GOVERNANCE_MODE = originalMode;
    }
  });

  it('观察治理模式下复杂模板应记录治理快照并兼容放行', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalMode = process.env.QUERY_TEMPLATE_SCOPE_GOVERNANCE_MODE;
    process.env.NODE_ENV = 'development';
    process.env.QUERY_TEMPLATE_SCOPE_GOVERNANCE_MODE = 'observe';
    const { service, executeQuery } = createService({
      template: {
        sqlText: `SELECT tt.team_name, tt.annual_target
FROM (
  SELECT '大北区-山东区' AS team_name, 2100 AS annual_target UNION ALL
  SELECT '大南区-深圳区', 4600
) tt`,
      },
    });

    try {
      const result = await service.execute(
        {
          id: 'user_sales_director',
          name: '销售总监',
          roleNames: ['销售总监'],
          roleIds: ['role_sales_director'],
          organizationIds: ['org_north'],
          departmentIds: ['dept_shandong'],
          ownerIds: ['user_sales_001'],
          isAdmin: false,
          identitySource: 'database',
        } as never,
        'tpl_live_team_completion',
        {
          parameters: { year: 2026 },
          includeAiReport: false,
        },
      );

      expect(executeQuery).toHaveBeenCalled();
      expect(result.scopeExecution.templateScopeClassification).toBe(
        'COMPLEX_REVIEW_REQUIRED',
      );
      expect(result.scopeExecution.templateScopeGovernanceMode).toBe('observe');
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      process.env.QUERY_TEMPLATE_SCOPE_GOVERNANCE_MODE = originalMode;
    }
  });

  it('模板 SQL 预检失败时应返回可控业务错误而不是透出 500', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const { service } = createService({
      preflightError: new QueryPreflightError('执行前预检失败，SQL 无法通过数据库检查。'),
    });

    try {
      await expect(
        service.execute(
          {
            id: 'user_sales_director',
            name: '销售总监',
            roleNames: ['销售总监'],
            roleIds: ['role_sales_director'],
            organizationIds: ['org_north'],
            departmentIds: ['dept_shandong'],
            ownerIds: ['user_sales_001'],
            isAdmin: false,
            identitySource: 'database',
          } as never,
          'tpl_live_team_completion',
          {
            parameters: {
              year: 2026,
            },
            includeAiReport: false,
          },
        ),
      ).rejects.toThrow(BadRequestException);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('模板执行结果应先返回 PENDING，再由后台异步生成 richer report', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const { service } = createService({
      executeRows: [
        {
          bucket_label: '2026-01',
          team_name: '大北区-北区金融部',
          annual_target: 6000,
          annual_forecast: 4800,
          amount: 4800,
          count: 2,
        },
        {
          bucket_label: '2026-02',
          team_name: '大北区-北区金融部',
          annual_target: 6000,
          annual_forecast: 5100,
          amount: 5100,
          count: 2,
        },
        {
          bucket_label: '2026-03',
          team_name: '大北区-北区金融部',
          annual_target: 6000,
          annual_forecast: 5400,
          amount: 5400,
          count: 3,
        },
        {
          bucket_label: '2026-04',
          team_name: '大北区-北区金融部',
          annual_target: 6000,
          annual_forecast: 5600,
          amount: 5600,
          count: 3,
        },
      ],
    });

    try {
      const result = await service.execute(
        {
          id: 'user_sales_director',
          name: '销售总监',
          roleNames: ['销售总监'],
          roleIds: ['role_sales_director'],
          organizationIds: ['org_north'],
          departmentIds: ['dept_shandong'],
          ownerIds: ['user_sales_001'],
          isAdmin: false,
          identitySource: 'database',
        } as never,
        'tpl_live_team_completion',
        {
          parameters: {
            year: 2026,
          },
          includeAiReport: true,
        },
      );

      expect(result.queryId).toEqual(expect.any(String));
      expect(result.insightBundle.status).toBe('PENDING');
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});

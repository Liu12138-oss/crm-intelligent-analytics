import { AnalysisWorkflowOrchestrator } from '../../../src/modules/analysis/analysis-workflow.orchestrator';
import { OpenApiCapabilityGapError } from '../../../src/modules/analysis/analysis.errors';

function createNormalizedResult() {
  return {
    requestId: 'query_fast_return_001',
    title: '本月商机分析',
    summary: '基础结果包已生成。',
    report: {
      variant: 'summary',
      reportTitle: '本月商机分析',
      executiveSummary: '基础结果包已生成。',
      keyFindings: [],
      metricCards: [],
      chartBlocks: [],
      tableBlocks: [],
      sections: [],
      datasetReferences: [],
      availableActions: [],
    },
    keyFindings: [],
    metricCards: [],
    scopeSummary: '当前权限范围',
    tableRows: [],
    rowCount: 0,
    consistencyToken: 'token_fast_return',
    streamBlocks: [],
    availableActions: [],
  };
}

function createOrchestratorFixture(
  routeOverride?: Record<string, unknown>,
  options?: {
    workflowTasks?: Array<Record<string, unknown>>;
    compiledTasks?: Array<Record<string, unknown>>;
    businessChainSnapshotSlice?: Record<string, unknown>;
  },
) {
  const normalizedResult = createNormalizedResult();
  const queryRiskGuardService = {
    ensureQuerySafe: jest.fn(),
  };
  const queryWhitelistService = {
    ensureAllowed: jest.fn(),
  };
  const queryAstValidatorService = {
    validateReadOnly: jest.fn(),
  };
  const queryPreflightService = {
    validate: jest.fn(async () => undefined),
  };
  const analysisQueryExecutorService = {
    executeTask: jest.fn(async () => ({
      datasetId: 'slice_summary',
      taskId: 'task_summary',
      taskTitle: '本月商机分析',
      resultKind: 'risk-overview',
      purpose: 'primary-summary',
      sql: 'SELECT 1 AS value',
      summary: '已完成分析。',
      appliedFilters: [],
      metricCards: [],
      secondaryViews: [],
      tableRows: [],
      rowCount: 0,
    })),
    executeBusinessChainSnapshot: jest.fn(async () => ({
      datasetId: 'slice_business_chain',
      taskId: 'crm-openapi-business-chain-snapshot',
      taskTitle: '合作伙伴开拓、客户报备、商机与订单经营分析',
      resultKind: 'partner-contribution',
      purpose: 'primary-summary',
      sql: '-- 联软标准 OpenAPI 业务链真实明细临时快照',
      summary: '已通过联软标准 OpenAPI 读取真实明细临时快照。',
      appliedFilters: [],
      metricCards: [],
      secondaryViews: [],
      tableRows: [],
      rowCount: 0,
      executionMode: 'PLAN_EXECUTION',
      executionSource: 'CRM_OFFICIAL_API',
      matchedAdapter: 'crm-official-api.business-chain-snapshot',
      ...(options?.businessChainSnapshotSlice ?? {}),
    })),
  };
  const analysisWarehouseAnalysisExecutorService = {
    tryExecute: jest.fn(async () => null),
  };
  const crmSqliteReadonlyAnalysisExecutorService = {
    executeTask: jest.fn(async () => ({
      datasetId: 'slice_sqlite_summary',
      taskId: 'task_summary',
      taskTitle: '本月商机分析',
      resultKind: 'risk-overview',
      purpose: 'primary-summary',
      sql: '-- CRM SQLite 只读库固定模板',
      summary: '已通过 CRM SQLite 只读库完成分析。',
      appliedFilters: [],
      metricCards: [],
      secondaryViews: [],
      tableRows: [],
      rowCount: 0,
      executionMode: 'PLAN_EXECUTION',
      executionSource: 'CRM_SQLITE_READONLY',
      matchedAdapter: 'crm-sqlite-readonly.opportunities.risk-overview',
    })),
    executeBusinessAnalysis: jest.fn(async () => ({
      datasetId: 'slice_sqlite_business_chain',
      taskId: 'crm-sqlite-readonly-business-chain',
      taskTitle: '合作伙伴开拓、客户报备、商机与订单经营分析',
      resultKind: 'partner-contribution',
      purpose: 'primary-summary',
      sql: '-- CRM SQLite 只读库业务链固定模板',
      summary: '已通过 CRM SQLite 只读库读取真实业务链数据。',
      appliedFilters: [],
      metricCards: [],
      secondaryViews: [],
      tableRows: [],
      rowCount: 0,
      executionMode: 'PLAN_EXECUTION',
      executionSource: 'CRM_SQLITE_READONLY',
      matchedAdapter: 'crm-sqlite-readonly.business-chain-snapshot',
      ...(options?.businessChainSnapshotSlice ?? {}),
    })),
  };

  const orchestrator = new AnalysisWorkflowOrchestrator(
    {
      injectScope: jest.fn((intent) => ({
        ...intent,
        scopeSummary: '当前权限范围',
      })),
    } as never,
    {
      buildWorkflow: jest.fn(() => ({
        workflowId: 'workflow_fast_return',
        normalizedQuestion: '本月商机分析',
        tasks: options?.workflowTasks ?? [
          {
            id: 'task_summary',
            title: '本月商机分析',
            purpose: 'primary-summary',
            required: true,
            plan: { resultKind: 'risk-overview' },
          },
        ],
      })),
    } as never,
    {
      compileTasks: jest.fn(() => options?.compiledTasks ?? [
        {
          taskId: 'task_summary',
          taskTitle: '本月商机分析',
          purpose: 'primary-summary',
          required: true,
          sql: 'SELECT 1 AS value',
          params: [],
          tables: ['opportunities'],
          fieldMap: { opportunities: ['id'] },
          joinPaths: [],
          allowedFunctions: [],
          resultKind: 'risk-overview',
          plan: {
            domain: 'opportunity-analysis',
            resultKind: 'risk-overview',
            filters: {},
          },
          rowLimit: 1,
          timeoutMs: 1000,
        },
      ]),
    } as never,
    queryRiskGuardService as never,
    queryWhitelistService as never,
    queryAstValidatorService as never,
    queryPreflightService as never,
    analysisQueryExecutorService as never,
    {
      assemble: jest.fn(() => ({
        slices: [],
        mergedRows: [],
        missingSections: [],
      })),
    } as never,
    {
      compose: jest.fn(() => normalizedResult.report),
    } as never,
    {
      normalize: jest.fn(() => ({ ...normalizedResult })),
    } as never,
    {
      buildBlocks: jest.fn(() => []),
    } as never,
    {
      ensureConsistent: jest.fn(),
      buildToken: jest.fn(() => 'token_fast_return'),
    } as never,
    {
      getFreshnessAt: jest.fn(() => '2026-05-14T00:00:00.000Z'),
    } as never,
    {
      resolveReadRoute: jest.fn(() => ({
        executionMode: 'PLAN_EXECUTION',
        executionSource: 'CRM_OFFICIAL_API',
        preferredSource: 'CRM_OFFICIAL_API',
        matchedAdapter: 'crm-official-api.opportunity-risk-overview',
        gapReason: '',
        toolSpec: {
          toolId: 'crm-official-api.opportunity-risk-overview',
          toolType: 'CRM_OFFICIAL_API',
          allowedStatements: ['CRM_API_GET'],
          allowedTables: ['opportunities'],
          allowedFields: { opportunities: ['id'] },
          allowedFunctions: [],
          outputShape: 'DATASET_SLICE',
          rowLimit: 1,
          timeoutMs: 1000,
        },
        ...routeOverride,
      })),
    } as never,
    {
      buildKnowledgeContext: jest.fn(() => ({ knowledgeHits: [] })),
      formatKnowledgeContext: jest.fn(() => ''),
    } as never,
    {
      enrich: jest.fn(async () => undefined),
    } as never,
    analysisWarehouseAnalysisExecutorService as never,
    {
      generateGroundedAnalysisInsight: jest.fn(async () => ({
        groundedExplanation: '基础结果已生成。',
        nextBestQuestions: [],
      })),
    } as never,
    {
      run: jest.fn(async (_context, handler: () => Promise<unknown>) => handler()),
    } as never,
    {
      recordBlocked: jest.fn(),
    } as never,
  );

  return {
    orchestrator,
    queryRiskGuardService,
    queryWhitelistService,
    queryAstValidatorService,
    queryPreflightService,
    analysisQueryExecutorService,
    analysisWarehouseAnalysisExecutorService,
    crmSqliteReadonlyAnalysisExecutorService,
  };
}

describe('AnalysisWorkflowOrchestrator', () => {
  it('首个查询结果不应等待 richer report 生成完成', async () => {
    const { orchestrator } = createOrchestratorFixture();

    const result = await Promise.race([
      orchestrator.run({
        requestId: 'query_fast_return_001',
        questionText: '本月商机分析',
        channel: 'web-console',
        user: {
          id: 'user_sales_director',
          roleIds: ['role_sales_director'],
        } as never,
        intent: {
          domain: 'opportunity-analysis',
          metrics: [],
          dimensions: [],
          filters: {},
          missingConditions: [],
        } as never,
        scopeSnapshot: {
          organizationIds: ['org_north'],
          departmentIds: ['dept_sales'],
          ownerIds: [],
          scopeSummary: '当前权限范围',
        },
        policy: {} as never,
        executionMode: 'PLAN_EXECUTION',
      }).then(() => 'resolved'),
      new Promise((resolve) => {
        setTimeout(() => resolve('timeout'), 30);
      }),
    ]);

    expect(result).toBe('resolved');
  });

  it('正式主链默认不调用 SQLite 或 MySQL 分析库执行器', async () => {
    const fixture = createOrchestratorFixture();

    await fixture.orchestrator.run({
      requestId: 'query_openapi_mainline_001',
      questionText: '本月商机分析',
      channel: 'web-console',
      user: {
        id: 'A030',
        roleIds: ['role_superadmin'],
      } as never,
      intent: {
        domain: 'opportunity-analysis',
        metrics: [],
        dimensions: [],
        filters: {},
        missingConditions: [],
      } as never,
      scopeSnapshot: {
        organizationIds: ['org_north'],
        departmentIds: ['dept_sales'],
        ownerIds: ['A030'],
        scopeSummary: '当前权限范围',
      },
      policy: {} as never,
      executionMode: 'PLAN_EXECUTION',
    });

    expect(fixture.analysisWarehouseAnalysisExecutorService.tryExecute).not.toHaveBeenCalled();
    expect(fixture.crmSqliteReadonlyAnalysisExecutorService.executeTask).not.toHaveBeenCalled();
    expect(fixture.crmSqliteReadonlyAnalysisExecutorService.executeBusinessAnalysis).not.toHaveBeenCalled();
  });

  it('选择 SQLite 只读库路线时应直接阻断且不调用任何执行器', async () => {
    const fixture = createOrchestratorFixture();

    await expect(
      fixture.orchestrator.run({
        requestId: 'query_sqlite_mainline_001',
        questionText: '本月商机分析',
        channel: 'web-console',
        user: {
          id: 'A030',
          roleIds: ['role_superadmin'],
        } as never,
        intent: {
          domain: 'opportunity-analysis',
          metrics: [],
          dimensions: [],
          filters: {},
          missingConditions: [],
        } as never,
        scopeSnapshot: {
          organizationIds: ['org_north'],
          departmentIds: ['dept_sales'],
          ownerIds: ['A030'],
          scopeSummary: '当前权限范围',
        },
        policy: {} as never,
        executionMode: 'PLAN_EXECUTION',
        analysisRoute: 'SQLITE_READONLY',
      }),
    ).rejects.toThrow(OpenApiCapabilityGapError);

    expect(fixture.crmSqliteReadonlyAnalysisExecutorService.executeTask).not.toHaveBeenCalled();
    expect(fixture.crmSqliteReadonlyAnalysisExecutorService.executeBusinessAnalysis).not.toHaveBeenCalled();
    expect(fixture.analysisQueryExecutorService.executeTask).not.toHaveBeenCalled();
    expect(fixture.analysisQueryExecutorService.executeBusinessChainSnapshot).not.toHaveBeenCalled();
    expect(fixture.analysisWarehouseAnalysisExecutorService.tryExecute).not.toHaveBeenCalled();
  });

  it('综合经营问法应优先接入 OpenAPI 业务链真实明细快照主链', async () => {
    const workflowTasks = [
      {
        id: 'task_partner',
        title: '合作伙伴开拓情况',
        purpose: 'primary-summary',
        required: true,
        plan: { resultKind: 'partner-contribution' },
      },
      {
        id: 'task_registration',
        title: '客户报备情况',
        purpose: 'distribution',
        required: true,
        plan: { resultKind: 'category-distribution' },
      },
      {
        id: 'task_opportunity',
        title: '客户商机及渠道商维度',
        purpose: 'detail-table',
        required: true,
        plan: { resultKind: 'partner-contribution' },
      },
      {
        id: 'task_order',
        title: '订单情况及渠道商贡献',
        purpose: 'detail-table',
        required: true,
        plan: { resultKind: 'partner-contribution' },
      },
    ];
    const compiledTasks = workflowTasks.map((task) => ({
      taskId: task.id,
      taskTitle: task.title,
      purpose: task.purpose,
      required: task.required,
      sql: `-- ${task.title}`,
      params: [],
      tables: ['opportunities', 'partners'],
      fieldMap: {
        opportunities: ['id', 'partnerId', 'amount'],
        partners: ['id', 'name'],
      },
      joinPaths: [],
      allowedFunctions: [],
      resultKind: task.plan.resultKind,
      plan: {
        domain: task.id === 'task_order' ? 'contract-conversion' : 'opportunity-analysis',
        resultKind: task.plan.resultKind,
        metrics: ['商机数量'],
        dimensions: ['渠道商'],
        filters: {},
      },
      rowLimit: 200,
      timeoutMs: 3000,
    }));
    const fixture = createOrchestratorFixture(undefined, {
      workflowTasks,
      compiledTasks,
      businessChainSnapshotSlice: {
        tableRows: [
          {
            ownerId: 'business-chain-opportunities',
            ownerName: '客户商机报备及商机情况',
            businessSection: '客户商机报备及商机情况',
            count: 3,
          },
        ],
      },
    });

    const output = await fixture.orchestrator.run({
      requestId: 'query_business_chain_snapshot_001',
      questionText: '帮我查询分析下，公司当前的合作伙伴开拓情况、客户商机报备及订单情况，并且给出后续经营建议',
      channel: 'wecom-bot',
      user: {
        id: 'A030',
        roleIds: ['role_superadmin'],
      } as never,
      intent: {
        domain: 'opportunity-analysis',
        metrics: [],
        dimensions: [],
        filters: {},
        missingConditions: [],
        businessIntentHint: {
          objectTypes: ['partner', 'registration', 'opportunity', 'order'],
          metrics: [],
          dimensions: [],
        },
      } as never,
      scopeSnapshot: {
        organizationIds: ['org_north'],
        departmentIds: ['dept_sales'],
        ownerIds: ['A030'],
        scopeSummary: '当前权限范围',
      },
      policy: {} as never,
      executionMode: 'PLAN_EXECUTION',
    });

    expect(fixture.analysisQueryExecutorService.executeBusinessChainSnapshot).toHaveBeenCalledTimes(1);
    expect(fixture.analysisQueryExecutorService.executeBusinessChainSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        resources: ['partners', 'registrations', 'opportunities', 'orders'],
        taskTitle: '合作伙伴开拓、客户报备、商机与订单经营分析',
      }),
    );
    expect(fixture.analysisQueryExecutorService.executeTask).not.toHaveBeenCalled();
    expect(fixture.analysisWarehouseAnalysisExecutorService.tryExecute).not.toHaveBeenCalled();
    expect(output.matchedAdapter).toBe('crm-official-api.business-chain-snapshot');
    expect(output.generatedQueryText).toContain('业务链真实明细临时快照');
  });

  it('停滞商机风险问法不应被业务链快照抢走', async () => {
    const fixture = createOrchestratorFixture();

    await fixture.orchestrator.run({
      requestId: 'query_stale_opportunity_001',
      questionText: '分析当前3个月没有进展的商机情况',
      channel: 'wecom-bot',
      user: {
        id: 'A030',
        roleIds: ['role_superadmin'],
      } as never,
      intent: {
        domain: 'opportunity-analysis',
        metrics: [],
        dimensions: [],
        filters: {},
        missingConditions: [],
      } as never,
      scopeSnapshot: {
        organizationIds: ['org_north'],
        departmentIds: ['dept_sales'],
        ownerIds: ['A030'],
        scopeSummary: '当前权限范围',
      },
      policy: {} as never,
      executionMode: 'PLAN_EXECUTION',
    });

    expect(fixture.analysisQueryExecutorService.executeBusinessChainSnapshot).not.toHaveBeenCalled();
    expect(fixture.analysisQueryExecutorService.executeTask).toHaveBeenCalledTimes(1);
  });

  it('服务商发展运营看板应进入 OpenAPI 业务链真实明细快照', async () => {
    const fixture = createOrchestratorFixture();

    await fixture.orchestrator.run({
      requestId: 'query_partner_operation_dashboard_001',
      questionText: '全国代理商发展运营数据看板',
      channel: 'wecom-bot',
      user: {
        id: 'A030',
        roleIds: ['role_superadmin'],
      } as never,
      intent: {
        domain: 'customer-relationship',
        metrics: [],
        dimensions: ['渠道商'],
        filters: {},
        missingConditions: [],
        businessIntentHint: {
          objectTypes: ['partner', 'registration', 'opportunity', 'order'],
          metrics: [],
          dimensions: [],
        },
      } as never,
      scopeSnapshot: {
        organizationIds: ['org_north'],
        departmentIds: ['dept_sales'],
        ownerIds: ['A030'],
        scopeSummary: '当前权限范围',
      },
      policy: {} as never,
      executionMode: 'PLAN_EXECUTION',
    });

    expect(fixture.analysisQueryExecutorService.executeBusinessChainSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        resources: ['partners', 'registrations', 'opportunities', 'orders'],
        taskTitle: '合作伙伴开拓、客户报备、商机与订单经营分析',
      }),
    );
    expect(fixture.analysisQueryExecutorService.executeTask).not.toHaveBeenCalled();
  });

  it('单一商机整体问法即使带渠道维度任务，也不应被业务链快照抢走', async () => {
    const workflowTasks = [
      {
        id: 'task_opportunity_summary',
        title: '商机整体总览',
        purpose: 'primary-summary',
        required: true,
        plan: { resultKind: 'metric-summary' },
      },
      {
        id: 'task_opportunity_stage',
        title: '商机阶段分布',
        purpose: 'distribution',
        required: true,
        plan: { resultKind: 'stage-distribution' },
      },
      {
        id: 'task_opportunity_partner',
        title: '商机渠道商维度',
        purpose: 'detail-table',
        required: true,
        plan: { resultKind: 'partner-contribution' },
      },
    ];
    const compiledTasks = workflowTasks.map((task) => ({
      taskId: task.id,
      taskTitle: task.title,
      purpose: task.purpose,
      required: task.required,
      sql: `-- ${task.title}`,
      params: [],
      tables: ['opportunities', 'partners'],
      fieldMap: {
        opportunities: ['id', 'partnerId', 'amount'],
        partners: ['id', 'name'],
      },
      joinPaths: [],
      allowedFunctions: [],
      resultKind: task.plan.resultKind,
      plan: {
        domain: 'opportunity-analysis',
        resultKind: task.plan.resultKind,
        metrics: ['新增商机金额', '商机数量'],
        dimensions: task.id === 'task_opportunity_partner' ? ['渠道商'] : [],
        filters: {},
      },
      rowLimit: 200,
      timeoutMs: 3000,
    }));
    const fixture = createOrchestratorFixture(undefined, {
      workflowTasks,
      compiledTasks,
    });

    await fixture.orchestrator.run({
      requestId: 'query_opportunity_overview_001',
      questionText: '帮我分析一下最近3个月的商机',
      channel: 'wecom-bot',
      user: {
        id: 'A030',
        roleIds: ['role_superadmin'],
      } as never,
      intent: {
        domain: 'opportunity-analysis',
        metrics: [],
        dimensions: [],
        filters: {},
        missingConditions: [],
        businessIntentHint: {
          objectTypes: ['partner', 'opportunity', 'order'],
          metrics: [],
          dimensions: [],
        },
      } as never,
      scopeSnapshot: {
        organizationIds: ['org_north'],
        departmentIds: ['dept_sales'],
        ownerIds: ['A030'],
        scopeSummary: '当前权限范围',
      },
      policy: {} as never,
      executionMode: 'PLAN_EXECUTION',
    });

    expect(fixture.analysisQueryExecutorService.executeBusinessChainSnapshot).not.toHaveBeenCalled();
    expect(fixture.analysisQueryExecutorService.executeTask).toHaveBeenCalledTimes(3);
  });

  it('标准 OpenAPI 路由应跳过 SQL 风险校验与预检，只保留白名单校验', async () => {
    const fixture = createOrchestratorFixture({
      executionSource: 'CRM_OFFICIAL_API',
      matchedAdapter: 'crm-official-api.opportunity-owner-ranking',
      toolSpec: {
        toolId: 'crm-official-api.opportunity-owner-ranking',
        toolType: 'CRM_OFFICIAL_API',
        allowedStatements: ['CRM_API_GET'],
        allowedTables: ['opportunities'],
        allowedFields: { opportunities: ['id'] },
        allowedFunctions: [],
        outputShape: 'DATASET_SLICE',
        rowLimit: 1,
        timeoutMs: 1000,
      },
    });

    await fixture.orchestrator.run({
      requestId: 'query_openapi_001',
      questionText: '本月商机负责人排名',
      channel: 'web-console',
      user: {
        id: 'A030',
        roleIds: ['role_superadmin'],
      } as never,
      intent: {
        domain: 'opportunity-analysis',
        metrics: [],
        dimensions: [],
        filters: {},
        missingConditions: [],
      } as never,
      scopeSnapshot: {
        organizationIds: ['org_north'],
        departmentIds: ['dept_sales'],
        ownerIds: ['A030'],
        scopeSummary: '当前权限范围',
      },
      policy: {} as never,
      executionMode: 'PLAN_EXECUTION',
    });

    expect(fixture.queryWhitelistService.ensureAllowed).toHaveBeenCalledTimes(1);
    expect(fixture.queryRiskGuardService.ensureQuerySafe).not.toHaveBeenCalled();
    expect(fixture.queryAstValidatorService.validateReadOnly).not.toHaveBeenCalled();
    expect(fixture.queryPreflightService.validate).not.toHaveBeenCalled();
    expect(fixture.analysisQueryExecutorService.executeTask).toHaveBeenCalledTimes(1);
  });

  it('非 OpenAPI 路由应被阻断且不得进入 SQL 校验或执行', async () => {
    const fixture = createOrchestratorFixture({
      executionSource: 'GUARDED_READONLY_SQL',
      matchedAdapter: 'guarded-readonly-sql.aggregate-query',
      toolSpec: {
        toolId: 'guarded-readonly-sql.aggregate-query',
        toolType: 'GUARDED_READONLY_SQL',
        allowedStatements: ['SELECT'],
        allowedTables: ['opportunities'],
        allowedFields: { opportunities: ['id'] },
        allowedFunctions: [],
        outputShape: 'DATASET_SLICE',
        rowLimit: 1,
        timeoutMs: 1000,
      },
    });

    await expect(
      fixture.orchestrator.run({
        requestId: 'query_sql_blocked_001',
        questionText: '本月商机负责人排名',
        channel: 'web-console',
        user: {
          id: 'A030',
          roleIds: ['role_superadmin'],
        } as never,
        intent: {
          domain: 'opportunity-analysis',
          metrics: [],
          dimensions: [],
          filters: {},
          missingConditions: [],
        } as never,
        scopeSnapshot: {
          organizationIds: ['org_north'],
          departmentIds: ['dept_sales'],
          ownerIds: ['A030'],
          scopeSummary: '当前权限范围',
        },
        policy: {} as never,
        executionMode: 'PLAN_EXECUTION',
      }),
    ).rejects.toThrow(OpenApiCapabilityGapError);

    expect(fixture.queryRiskGuardService.ensureQuerySafe).not.toHaveBeenCalled();
    expect(fixture.queryAstValidatorService.validateReadOnly).not.toHaveBeenCalled();
    expect(fixture.queryPreflightService.validate).not.toHaveBeenCalled();
    expect(fixture.analysisQueryExecutorService.executeTask).not.toHaveBeenCalled();
  });
});

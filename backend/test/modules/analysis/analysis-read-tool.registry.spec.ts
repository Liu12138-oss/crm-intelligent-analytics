import { QueryCompilerService } from '../../../src/modules/analysis/query-compiler.service';
import { AnalysisReadToolRegistryService } from '../../../src/modules/analysis/analysis-read-tool.registry';
import { OpenApiCapabilityGapError } from '../../../src/modules/analysis/analysis.errors';

describe('AnalysisReadToolRegistryService', () => {
  const queryCompilerService = new QueryCompilerService();
  const registry = new AnalysisReadToolRegistryService();

  it('未命中 OpenAPI 适配器时应返回能力缺口且不再路由 SQL 兜底', () => {
    const compiledTask = {
      taskId: 'task_001',
      taskTitle: '暂未覆盖的合同风险概览',
      purpose: 'risk-observation',
      sql: 'SELECT ...',
      params: [],
      tables: ['opportunities', 'departments'],
      fieldMap: {
        opportunities: ['id', 'department_id', 'created_at'],
        departments: ['id', 'name'],
      },
      joinPaths: ['departments.id=opportunities.department_id'],
      allowedFunctions: ['COUNT'],
      resultKind: 'risk-overview',
      rowLimit: 100,
      timeoutMs: 3000,
      plan: {
        type: 'query-plan',
        baseTable: 'opportunities',
        joinTables: ['departments'],
        groupBy: ['risk_stage'],
        orderBy: [{ field: 'count', direction: 'DESC' }],
        resultKind: 'risk-overview',
        domain: 'contract-conversion',
          metrics: ['签单风险'],
          dimensions: ['风险阶段'],
          filters: { organizationIds: ['org_north'] },
          confidence: 'HIGH',
      },
    } as never;

    expect(() =>
      registry.resolveReadRoute(compiledTask, 'GUARDED_DIRECT_QUERY'),
    ).toThrow(OpenApiCapabilityGapError);
    expect(() =>
      registry.resolveReadRoute(compiledTask, 'GUARDED_DIRECT_QUERY'),
    ).toThrow('系统已停止自动切换 SQLite、MySQL 分析库或受控 SQL 兜底');
  });

  it('商机负责人排名应优先命中标准 OpenAPI 适配器', () => {
    const compiledTask = queryCompilerService.compileTask({
      id: 'task_002',
      title: '新增商机金额排名',
      description: '测试任务',
      purpose: 'primary-summary',
      plan: queryCompilerService.buildPlan({
        domain: 'opportunity-analysis',
        metrics: ['新增商机金额'],
        dimensions: ['销售负责人'],
        filters: { organizationIds: ['org_north'] },
        missingConditions: [],
        normalizedQuestion: '本月各销售负责人新增商机金额排名',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'HIGH',
      }),
    });

    const route = registry.resolveReadRoute(compiledTask, 'PLAN_EXECUTION');

    expect(route.executionSource).toBe('CRM_OFFICIAL_API');
    expect(route.matchedAdapter).toBe('crm-official-api.opportunity-owner-ranking');
    expect(route.gapReason).toBe('');
    expect(route.toolSpec.allowedStatements).toEqual(['CRM_API_GET']);
  });

  it('客户分类分布读取步骤应优先命中官方 API 适配器', () => {
    const compiledTask = queryCompilerService.compileTask({
      id: 'task_003',
      title: '客户分类分布',
      description: '测试任务',
      purpose: 'distribution',
      plan: queryCompilerService.buildPlan({
        domain: 'customer-relationship',
        metrics: ['客户数量'],
        dimensions: ['客户分类'],
        filters: { organizationIds: ['org_north'] },
        missingConditions: [],
        normalizedQuestion: '本月客户分类分布',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'HIGH',
      }),
    });

    const route = registry.resolveReadRoute(compiledTask, 'PLAN_EXECUTION');

    expect(route.executionSource).toBe('CRM_OFFICIAL_API');
    expect(route.matchedAdapter).toBe('crm-official-api.customer-category-distribution');
    expect(route.gapReason).toBe('');
  });

  it('区域经营贡献应优先命中联软标准 OpenAPI 适配器', () => {
    const compiledTask = queryCompilerService.compileTask({
      id: 'task_004',
      title: '区域经营贡献',
      description: '测试任务',
      purpose: 'primary-summary',
      plan: queryCompilerService.buildPlanForResultKind(
        {
          domain: 'opportunity-analysis',
          metrics: ['新增商机金额'],
          dimensions: ['区域'],
          filters: { organizationIds: ['org_north'] },
          confidence: 'HIGH',
        },
        'department-contribution',
      ),
    });

    const route = registry.resolveReadRoute(compiledTask, 'PLAN_EXECUTION');

    expect(route.executionSource).toBe('CRM_OFFICIAL_API');
    expect(route.matchedAdapter).toBe('crm-official-api.opportunity-region-contribution');
    expect(route.toolSpec.allowedStatements).toEqual(['CRM_API_GET']);
  });

  it('商机渠道商贡献应优先命中联软标准 OpenAPI 适配器', () => {
    const compiledTask = queryCompilerService.compileTask({
      id: 'task_partner',
      title: '商机渠道商贡献',
      description: '测试任务',
      purpose: 'primary-summary',
      plan: queryCompilerService.buildPlanForResultKind(
        {
          domain: 'opportunity-analysis',
          metrics: ['新增商机金额'],
          dimensions: ['渠道商'],
          filters: { organizationIds: ['org_north'] },
          confidence: 'HIGH',
        },
        'partner-contribution',
      ),
    });

    const route = registry.resolveReadRoute(compiledTask, 'PLAN_EXECUTION');

    expect(route.executionSource).toBe('CRM_OFFICIAL_API');
    expect(route.matchedAdapter).toBe('crm-official-api.opportunity-partner-contribution');
    expect(route.toolSpec.allowedStatements).toEqual(['CRM_API_GET']);
  });

  it('订单总览应优先命中联软标准 OpenAPI 适配器', () => {
    const compiledTask = queryCompilerService.compileTask({
      id: 'task_005',
      title: '订单金额总览',
      description: '测试任务',
      purpose: 'primary-summary',
      plan: queryCompilerService.buildPlanForResultKind(
        {
          domain: 'contract-conversion',
          metrics: ['订单金额'],
          dimensions: [],
          filters: { organizationIds: ['org_north'] },
          confidence: 'HIGH',
        },
        'metric-summary',
      ),
    });

    const route = registry.resolveReadRoute(compiledTask, 'PLAN_EXECUTION');

    expect(route.executionSource).toBe('CRM_OFFICIAL_API');
    expect(route.matchedAdapter).toBe('crm-official-api.order-metric-summary');
    expect(route.toolSpec.allowedStatements).toEqual(['CRM_API_GET']);
  });

  it('订单渠道商贡献应优先命中联软标准 OpenAPI 订单适配器', () => {
    const compiledTask = queryCompilerService.compileTask({
      id: 'task_order_partner',
      title: '订单金额渠道商贡献',
      description: '测试任务',
      purpose: 'detail-table',
      plan: queryCompilerService.buildPlanForResultKind(
        {
          domain: 'contract-conversion',
          metrics: ['订单金额'],
          dimensions: ['渠道商'],
          filters: { organizationIds: ['org_north'] },
          confidence: 'HIGH',
        },
        'partner-contribution',
      ),
    });

    const route = registry.resolveReadRoute(compiledTask, 'PLAN_EXECUTION');

    expect(route.executionSource).toBe('CRM_OFFICIAL_API');
    expect(route.matchedAdapter).toBe('crm-official-api.order-partner-contribution');
    expect(route.toolSpec.allowedStatements).toEqual(['CRM_API_GET']);
  });
});

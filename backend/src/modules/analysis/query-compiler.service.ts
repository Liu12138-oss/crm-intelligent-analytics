import { Injectable } from '@nestjs/common';
import type {
  AnalysisIntent,
  AnalysisQueryTask,
  QueryPlanAst,
  QueryPlanResultKind,
} from '../../shared/types/domain';

export interface CompiledQuery {
  sql: string;
  params: unknown[];
  tables: string[];
  fieldMap: Record<string, string[]>;
  joinPaths: string[];
  allowedFunctions: string[];
  resultKind: QueryPlanResultKind;
  plan: QueryPlanAst;
  rowLimit: number;
  timeoutMs: number;
}

export interface CompiledQueryTask extends CompiledQuery {
  taskId: string;
  taskTitle: string;
  purpose: AnalysisQueryTask['purpose'];
  required?: AnalysisQueryTask['required'];
  reportSection?: AnalysisQueryTask['reportSection'];
}

@Injectable()
export class QueryCompilerService {
  private readonly defaultRowLimit = 100;
  private readonly defaultTimeoutMs = 3000;

  buildPlan(intent: AnalysisIntent): QueryPlanAst {
    return this.buildPlanForResultKind(intent, this.resolveResultKind(intent));
  }

  buildPlanForResultKind(
    intent: Pick<
      AnalysisIntent,
      'domain' | 'metrics' | 'dimensions' | 'filters' | 'confidence' | 'orderBy' | 'resultKindHint'
      | 'temporalSlot'
    >,
    resultKind: QueryPlanResultKind,
  ): QueryPlanAst {
    const baseTable = this.resolveBaseTable(intent.domain);
    const joinTables =
      resultKind === 'owner-ranking'
        ? ['users']
        : resultKind === 'partner-contribution'
          ? ['partners']
          : [];
    const filters = this.resolveTemporalFilters(intent.filters, intent.temporalSlot);

    return {
      type: 'query-plan',
      domain: intent.domain,
      baseTable,
      joinTables,
      metrics: intent.metrics,
      dimensions: intent.dimensions,
      filters,
      groupBy: this.resolveGroupBy(resultKind),
      temporalSlot: intent.temporalSlot,
      orderBy:
        intent.orderBy && intent.orderBy.length > 0
          ? intent.orderBy
          : [{ field: resultKind === 'time-trend' ? 'bucket_label' : 'amount', direction: resultKind === 'time-trend' ? 'ASC' : 'DESC' }],
      resultKind,
      confidence: intent.confidence,
    };
  }

  compileTask(task: AnalysisQueryTask): CompiledQueryTask {
    const compiledQuery = this.compile(task.plan);
    return {
      ...compiledQuery,
      taskId: task.id,
      taskTitle: task.title,
      purpose: task.purpose,
      required: task.required,
      reportSection: task.reportSection,
    };
  }

  compileTasks(tasks: AnalysisQueryTask[]): CompiledQueryTask[] {
    if (tasks.length > 8) {
      throw new Error('当前问题需要执行过多查询任务，请缩小范围后重试。');
    }

    return tasks.map((task) => this.compileTask(task));
  }

  compile(plan: QueryPlanAst): CompiledQuery {
    if (plan.domain === 'contract-conversion') {
      if (plan.resultKind === 'metric-summary') {
        return this.compileContractSummaryQuery(plan);
      }

      if (plan.resultKind === 'time-trend') {
        return this.compileContractTrendQuery(plan);
      }
      if (plan.resultKind === 'partner-contribution') {
        return this.compileContractPartnerContributionQuery(plan);
      }
      return this.compileContractOwnerQuery(plan);
    }

    if (plan.domain === 'customer-relationship') {
      return this.compileCustomerCategoryQuery(plan);
    }

    if (plan.resultKind === 'metric-summary') {
      return this.compileOpportunitySummaryQuery(plan);
    }

    if (plan.resultKind === 'time-trend') {
      return this.compileOpportunityTrendQuery(plan);
    }

    if (plan.resultKind === 'stage-distribution') {
      return this.compileOpportunityStageQuery(plan);
    }

    if (plan.resultKind === 'department-contribution') {
      return this.compileOpportunityDepartmentContributionQuery(plan);
    }

    if (plan.resultKind === 'partner-contribution') {
      return this.compileOpportunityPartnerContributionQuery(plan);
    }

    if (plan.resultKind === 'risk-overview') {
      return this.compileOpportunityRiskOverviewQuery(plan);
    }

    return this.compileOpportunityOwnerQuery(plan);
  }

  /**
   * 编译商机总览历史查询形态。
   *
   * 参数说明：`plan` 为已经完成权限、时间和结果形态规划的查询计划。
   * 返回值说明：返回商机金额与数量总览查询，用于 OpenAPI 路由白名单和审计摘要。
   * 调用注意事项：正式执行由联软标准 OpenAPI `/opportunities` 列表聚合完成，这里只保留只读等价形态，避免商机整体问题退成负责人排名。
   */
  private compileOpportunitySummaryQuery(plan: QueryPlanAst): CompiledQuery {
    const scoped = this.buildScopedWhereClause(plan.filters, 'o', 'created_at', 'user_id');
    return {
      sql: `SELECT
SUM(o.expect_amount) AS amount,
COUNT(o.id) AS count
FROM opportunities o
${scoped.whereClause}`,
      params: [...scoped.params],
      tables: ['opportunities'],
      fieldMap: {
        opportunities: ['id', 'user_id', 'department_id', 'organization_id', 'expect_amount', 'created_at'],
      },
      joinPaths: [],
      allowedFunctions: ['SUM', 'COUNT'],
      resultKind: 'metric-summary',
      plan,
      rowLimit: 1,
      timeoutMs: this.defaultTimeoutMs,
    };
  }

  private compileOpportunityOwnerQuery(plan: QueryPlanAst): CompiledQuery {
    const scoped = this.buildScopedWhereClause(plan.filters, 'o', 'created_at', 'user_id');
    return {
      sql: `SELECT o.user_id AS owner_id,
COALESCE(u.name, CAST(o.user_id AS CHAR)) AS owner_name,
SUM(o.expect_amount) AS amount,
COUNT(o.id) AS count
FROM opportunities o
LEFT JOIN users u ON u.id = o.user_id
${scoped.whereClause}
GROUP BY o.user_id, u.name
ORDER BY amount ${this.resolveOrderDirection(plan, 'amount')}
LIMIT ?`,
      params: [...scoped.params, this.defaultRowLimit],
      tables: ['opportunities', 'users'],
      fieldMap: {
        opportunities: ['id', 'user_id', 'department_id', 'organization_id', 'expect_amount', 'created_at'],
        users: ['id', 'name'],
      },
      joinPaths: ['users.id=opportunities.user_id'],
      allowedFunctions: ['SUM', 'COUNT', 'COALESCE', 'CAST'],
      resultKind: 'owner-ranking',
      plan,
      rowLimit: this.defaultRowLimit,
      timeoutMs: this.defaultTimeoutMs,
    };
  }

  private compileOpportunityTrendQuery(plan: QueryPlanAst): CompiledQuery {
    const scoped = this.buildScopedWhereClause(plan.filters, 'o', 'created_at', 'user_id');
    return {
      sql: `SELECT DATE_FORMAT(o.created_at, '%Y-%m') AS bucket_label,
SUM(o.expect_amount) AS amount,
COUNT(o.id) AS count
FROM opportunities o
${scoped.whereClause}
GROUP BY DATE_FORMAT(o.created_at, '%Y-%m')
ORDER BY bucket_label ${this.resolveOrderDirection(plan, 'bucket_label')}
LIMIT ?`,
      params: [...scoped.params, this.defaultRowLimit],
      tables: ['opportunities'],
      fieldMap: {
        opportunities: ['id', 'organization_id', 'department_id', 'expect_amount', 'created_at'],
      },
      joinPaths: [],
      allowedFunctions: ['SUM', 'COUNT', 'DATE_FORMAT'],
      resultKind: 'time-trend',
      plan,
      rowLimit: this.defaultRowLimit,
      timeoutMs: this.defaultTimeoutMs,
    };
  }

  private compileOpportunityStageQuery(plan: QueryPlanAst): CompiledQuery {
    const scoped = this.buildScopedWhereClause(plan.filters, 'o', 'created_at', 'user_id');
    return {
      sql: `SELECT o.stage AS bucket_label,
SUM(o.expect_amount) AS amount,
COUNT(o.id) AS count
FROM opportunities o
${scoped.whereClause}
GROUP BY o.stage
ORDER BY amount ${this.resolveOrderDirection(plan, 'amount')}
LIMIT ?`,
      params: [...scoped.params, this.defaultRowLimit],
      tables: ['opportunities'],
      fieldMap: {
        opportunities: ['id', 'stage', 'organization_id', 'department_id', 'expect_amount', 'created_at'],
      },
      joinPaths: [],
      allowedFunctions: ['SUM', 'COUNT'],
      resultKind: 'stage-distribution',
      plan,
      rowLimit: this.defaultRowLimit,
      timeoutMs: this.defaultTimeoutMs,
    };
  }

  private compileContractOwnerQuery(plan: QueryPlanAst): CompiledQuery {
    const scoped = this.buildScopedWhereClause(plan.filters, 'c', 'created_at', 'user_id');
    const approved = this.buildContractApprovedWhereClause(scoped, plan.filters, 'c');
    const rowLimit = this.resolveRowLimit(plan);
    return {
      sql: `SELECT c.user_id AS owner_id,
COALESCE(u.name, CAST(c.user_id AS CHAR)) AS owner_name,
SUM(COALESCE(ca_valid_income.numeric_asset, 0)) AS amount,
COUNT(DISTINCT c.id) AS count
FROM contracts c
LEFT JOIN users u ON u.id = c.user_id
LEFT JOIN contract_assets ca_valid_income ON ca_valid_income.entity_id = c.id
AND ca_valid_income.custom_field_name = 'numeric_asset_7ee237'
${approved.whereClause}
GROUP BY c.user_id, u.name
ORDER BY amount ${this.resolveOrderDirection(plan, 'amount')}
LIMIT ?`,
      params: [...approved.params, rowLimit],
      tables: ['contracts', 'users', 'contract_assets'],
      fieldMap: {
        contracts: [
          'id',
          'user_id',
          'organization_id',
          'department_id',
          'created_at',
          'approve_status',
          'pending_step',
          'submit_applying_at',
          'finish_approve_at',
        ],
        users: ['id', 'name'],
        contract_assets: ['entity_id', 'custom_field_name', 'numeric_asset'],
      },
      joinPaths: ['users.id=contracts.user_id', 'contract_assets.entity_id=contracts.id'],
      allowedFunctions: ['SUM', 'COUNT', 'COALESCE', 'CAST'],
      resultKind: 'owner-ranking',
      plan,
      rowLimit,
      timeoutMs: this.defaultTimeoutMs,
    };
  }

  /**
   * 编译合同/订单渠道商贡献历史查询形态。
   *
   * 参数说明：`plan` 为已经完成权限、时间和结果形态规划的查询计划。
   * 返回值说明：返回渠道商维度聚合查询，仅用于兼容历史模板、审计快照或离线测试。
   * 调用注意事项：正式 CRM 分析主链不再通过该查询兜底，订单分析必须优先走联软标准 OpenAPI。
   */
  private compileContractPartnerContributionQuery(plan: QueryPlanAst): CompiledQuery {
    const scoped = this.buildScopedWhereClause(plan.filters, 'c', 'created_at', 'user_id');
    const approved = this.buildContractApprovedWhereClause(scoped, plan.filters, 'c');
    const rowLimit = this.resolveRowLimit(plan);
    return {
      sql: `SELECT c.partner_id AS partner_id,
COALESCE(p.name, CAST(c.partner_id AS CHAR), '未填写渠道商') AS partner_name,
SUM(COALESCE(ca_valid_income.numeric_asset, 0)) AS amount,
COUNT(DISTINCT c.id) AS count
FROM contracts c
LEFT JOIN partners p ON p.id = c.partner_id
LEFT JOIN contract_assets ca_valid_income ON ca_valid_income.entity_id = c.id
AND ca_valid_income.custom_field_name = 'numeric_asset_7ee237'
${approved.whereClause}
GROUP BY c.partner_id, p.name
ORDER BY amount ${this.resolveOrderDirection(plan, 'amount')}
LIMIT ?`,
      params: [...approved.params, rowLimit],
      tables: ['contracts', 'partners', 'contract_assets'],
      fieldMap: {
        contracts: [
          'id',
          'partner_id',
          'user_id',
          'organization_id',
          'department_id',
          'created_at',
          'approve_status',
          'pending_step',
          'submit_applying_at',
          'finish_approve_at',
        ],
        partners: ['id', 'name', 'partnerLevel', 'region', 'bigRegion', 'status'],
        contract_assets: ['entity_id', 'custom_field_name', 'numeric_asset'],
      },
      joinPaths: ['partners.id=contracts.partner_id', 'contract_assets.entity_id=contracts.id'],
      allowedFunctions: ['SUM', 'COUNT', 'COALESCE', 'CAST'],
      resultKind: 'partner-contribution',
      plan,
      rowLimit,
      timeoutMs: this.defaultTimeoutMs,
    };
  }

  private compileContractSummaryQuery(plan: QueryPlanAst): CompiledQuery {
    const scoped = this.buildScopedWhereClause(plan.filters, 'c', 'created_at', 'user_id');
    const approved = this.buildContractApprovedWhereClause(scoped, plan.filters, 'c');
    return {
      sql: `SELECT
SUM(COALESCE(ca_valid_income.numeric_asset, 0)) AS amount,
COUNT(DISTINCT c.id) AS count
FROM contracts c
LEFT JOIN contract_assets ca_valid_income ON ca_valid_income.entity_id = c.id
AND ca_valid_income.custom_field_name = 'numeric_asset_7ee237'
${approved.whereClause}`,
      params: [...approved.params],
      tables: ['contracts', 'contract_assets'],
      fieldMap: {
        contracts: [
          'id',
          'user_id',
          'organization_id',
          'department_id',
          'created_at',
          'approve_status',
          'pending_step',
          'submit_applying_at',
          'finish_approve_at',
        ],
        contract_assets: ['entity_id', 'custom_field_name', 'numeric_asset'],
      },
      joinPaths: ['contract_assets.entity_id=contracts.id'],
      allowedFunctions: ['SUM', 'COUNT', 'COALESCE'],
      resultKind: 'metric-summary',
      plan,
      rowLimit: 1,
      timeoutMs: this.defaultTimeoutMs,
    };
  }

  private compileContractTrendQuery(plan: QueryPlanAst): CompiledQuery {
    const scoped = this.buildScopedWhereClause(plan.filters, 'c', 'created_at', 'user_id');
    const approved = this.buildContractApprovedWhereClause(scoped, plan.filters, 'c');
    return {
      sql: `SELECT DATE_FORMAT(c.created_at, '%Y-%m') AS bucket_label,
SUM(COALESCE(ca_valid_income.numeric_asset, 0)) AS amount,
COUNT(DISTINCT c.id) AS count
FROM contracts c
LEFT JOIN contract_assets ca_valid_income ON ca_valid_income.entity_id = c.id
AND ca_valid_income.custom_field_name = 'numeric_asset_7ee237'
${approved.whereClause}
GROUP BY DATE_FORMAT(c.created_at, '%Y-%m')
ORDER BY bucket_label ${this.resolveOrderDirection(plan, 'bucket_label')}
LIMIT ?`,
      params: [...approved.params, this.defaultRowLimit],
      tables: ['contracts', 'contract_assets'],
      fieldMap: {
        contracts: [
          'id',
          'organization_id',
          'department_id',
          'created_at',
          'approve_status',
          'pending_step',
          'submit_applying_at',
          'finish_approve_at',
        ],
        contract_assets: ['entity_id', 'custom_field_name', 'numeric_asset'],
      },
      joinPaths: ['contract_assets.entity_id=contracts.id'],
      allowedFunctions: ['SUM', 'COUNT', 'DATE_FORMAT', 'COALESCE'],
      resultKind: 'time-trend',
      plan,
      rowLimit: this.defaultRowLimit,
      timeoutMs: this.defaultTimeoutMs,
    };
  }

  private compileCustomerCategoryQuery(plan: QueryPlanAst): CompiledQuery {
    const scoped = this.buildScopedWhereClause(plan.filters, 'c', 'created_at', 'user_id');
    return {
      sql: `SELECT c.category AS bucket_label,
COUNT(c.id) AS count
FROM customers c
${scoped.whereClause}
GROUP BY c.category
ORDER BY count ${this.resolveOrderDirection(plan, 'count')}
LIMIT ?`,
      params: [...scoped.params, this.defaultRowLimit],
      tables: ['customers'],
      fieldMap: {
        customers: ['id', 'category', 'organization_id', 'department_id', 'user_id', 'created_at'],
      },
      joinPaths: [],
      allowedFunctions: ['COUNT'],
      resultKind: 'category-distribution',
      plan,
      rowLimit: this.defaultRowLimit,
      timeoutMs: this.defaultTimeoutMs,
    };
  }

  private buildScopedWhereClause(
    filters: Record<string, unknown>,
    tableAlias: string,
    timeField = 'created_at',
    ownerField: string | null = 'user_id',
  ): { whereClause: string; params: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    const organizationIds = this.normalizeStringList(filters.organizationIds);
    if (organizationIds.length > 0) {
      conditions.push(`${tableAlias}.organization_id IN (${organizationIds.map(() => '?').join(', ')})`);
      params.push(...organizationIds);
    }

    const ownerIds = this.normalizeStringList(filters.ownerIds);
    const departmentIds = this.normalizeStringList(filters.departmentIds);
    const scopedAccessConditions: string[] = [];
    const scopedAccessParams: unknown[] = [];

    if (ownerIds.length > 0 && ownerField) {
      scopedAccessConditions.push(`${tableAlias}.${ownerField} IN (${ownerIds.map(() => '?').join(', ')})`);
      scopedAccessParams.push(...ownerIds);
    }

    if (departmentIds.length > 0) {
      scopedAccessConditions.push(`${tableAlias}.department_id IN (${departmentIds.map(() => '?').join(', ')})`);
      scopedAccessParams.push(...departmentIds);
    }

    if (scopedAccessConditions.length === 1) {
      conditions.push(scopedAccessConditions[0]);
      params.push(...scopedAccessParams);
    }

    if (scopedAccessConditions.length > 1) {
      conditions.push(`(${scopedAccessConditions.join(' OR ')})`);
      params.push(...scopedAccessParams);
    }

    if (typeof filters.startAt === 'string' && filters.startAt) {
      conditions.push(`${tableAlias}.${timeField} >= ?`);
      params.push(filters.startAt);
    }

    if (typeof filters.endAt === 'string' && filters.endAt) {
      conditions.push(`${tableAlias}.${timeField} < ?`);
      params.push(filters.endAt);
    }

    return {
      whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      params,
    };
  }

  /**
   * 为合同统计补齐 CRM 原始数据页的“已通过且在统计窗口内完成审批”口径。
   *
   * 参数说明：
   * - `scoped`：已按组织、负责人、部门和提交日期生成的查询条件。
   * - `filters`：查询计划过滤条件，用于读取结束时间边界。
   * - `tableAlias`：合同表别名。
   * 返回值：追加审批条件后的 WHERE 子句与参数。
   * 设计原因：CRM 截图中的签单统计看“提交日期”和“审批状态=已通过”，且不把统计日之后才审批通过的合同回填到昨天。
   */
  private buildContractApprovedWhereClause(
    scoped: { whereClause: string; params: unknown[] },
    filters: Record<string, unknown>,
    tableAlias: string,
  ): { whereClause: string; params: unknown[] } {
    const approvalConditions = [
      `${tableAlias}.approve_status = 3`,
      `COALESCE(${tableAlias}.pending_step, 0) = 0`,
    ];
    const approvalParams: unknown[] = [];

    // 已进入审批流的合同必须在查询结束边界前完成审批，避免统计日之后通过的合同被回填。
    if (typeof filters.endAt === 'string' && filters.endAt) {
      approvalConditions.push(
        `(${tableAlias}.submit_applying_at IS NULL OR (` +
          `${tableAlias}.finish_approve_at IS NOT NULL AND ${tableAlias}.finish_approve_at < ?))`,
      );
      approvalParams.push(filters.endAt);
    } else {
      approvalConditions.push(
        `(${tableAlias}.submit_applying_at IS NULL OR ${tableAlias}.finish_approve_at IS NOT NULL)`,
      );
    }

    const scopedConditions = scoped.whereClause.replace(/^WHERE\s+/u, '');
    const whereParts = scopedConditions ? [scopedConditions, ...approvalConditions] : approvalConditions;
    return {
      whereClause: `WHERE ${whereParts.join(' AND ')}`,
      params: [...scoped.params, ...approvalParams],
    };
  }

  private compileOpportunityDepartmentContributionQuery(plan: QueryPlanAst): CompiledQuery {
    const scoped = this.buildScopedWhereClause(plan.filters, 'o', 'created_at', 'user_id');
    return {
      sql: `SELECT o.department_id AS department_id,
COALESCE(d.name, '未命名部门') AS department_name,
SUM(o.expect_amount) AS amount,
COUNT(o.id) AS count
FROM opportunities o
LEFT JOIN departments d ON d.id = o.department_id
${scoped.whereClause}
GROUP BY o.department_id, d.name
ORDER BY amount ${this.resolveOrderDirection(plan, 'amount')}
LIMIT ?`,
      params: [...scoped.params, this.defaultRowLimit],
      tables: ['opportunities', 'departments'],
      fieldMap: {
        opportunities: ['id', 'department_id', 'organization_id', 'expect_amount', 'created_at'],
        departments: ['id', 'name'],
      },
      joinPaths: ['departments.id=opportunities.department_id'],
      allowedFunctions: ['SUM', 'COUNT', 'COALESCE'],
      resultKind: 'department-contribution',
      plan,
      rowLimit: this.defaultRowLimit,
      timeoutMs: this.defaultTimeoutMs,
    };
  }

  private compileOpportunityPartnerContributionQuery(plan: QueryPlanAst): CompiledQuery {
    const scoped = this.buildScopedWhereClause(plan.filters, 'o', 'created_at', 'user_id');
    return {
      sql: `SELECT o.partner_id AS partner_id,
COALESCE(p.name, CAST(o.partner_id AS CHAR), '未填写渠道商') AS partner_name,
SUM(o.expect_amount) AS amount,
COUNT(o.id) AS count
FROM opportunities o
LEFT JOIN partners p ON p.id = o.partner_id
${scoped.whereClause}
GROUP BY o.partner_id, p.name
ORDER BY amount ${this.resolveOrderDirection(plan, 'amount')}
LIMIT ?`,
      params: [...scoped.params, this.defaultRowLimit],
      tables: ['opportunities', 'partners'],
      fieldMap: {
        opportunities: ['id', 'partner_id', 'department_id', 'organization_id', 'expect_amount', 'created_at'],
        partners: ['id', 'name', 'partnerLevel', 'region', 'bigRegion', 'status'],
      },
      joinPaths: ['partners.id=opportunities.partner_id'],
      allowedFunctions: ['SUM', 'COUNT', 'COALESCE', 'CAST'],
      resultKind: 'partner-contribution',
      plan,
      rowLimit: this.defaultRowLimit,
      timeoutMs: this.defaultTimeoutMs,
    };
  }

  private compileOpportunityRiskOverviewQuery(plan: QueryPlanAst): CompiledQuery {
    const scoped = this.buildScopedWhereClause(plan.filters, 'o', 'created_at', 'user_id');
    const riskStages = ['初访', '方案', '谈判'];
    const riskWhereClause = scoped.whereClause
      ? `${scoped.whereClause} AND o.stage IN (${riskStages.map(() => '?').join(', ')})`
      : `WHERE o.stage IN (${riskStages.map(() => '?').join(', ')})`;
    return {
      sql: `SELECT o.user_id AS owner_id,
COALESCE(u.name, CAST(o.user_id AS CHAR)) AS owner_name,
SUM(o.expect_amount) AS amount,
COUNT(o.id) AS count
FROM opportunities o
LEFT JOIN users u ON u.id = o.user_id
${riskWhereClause}
GROUP BY o.user_id, u.name
ORDER BY amount ${this.resolveOrderDirection(plan, 'amount')}
LIMIT ?`,
      params: [...scoped.params, ...riskStages, this.defaultRowLimit],
      tables: ['opportunities', 'users'],
      fieldMap: {
        opportunities: ['id', 'user_id', 'department_id', 'organization_id', 'expect_amount', 'created_at', 'stage'],
        users: ['id', 'name'],
      },
      joinPaths: ['users.id=opportunities.user_id'],
      allowedFunctions: ['SUM', 'COUNT', 'COALESCE', 'CAST'],
      resultKind: 'risk-overview',
      plan,
      rowLimit: this.defaultRowLimit,
      timeoutMs: this.defaultTimeoutMs,
    };
  }

  private resolveTemporalFilters(
    filters: Record<string, unknown>,
    temporalSlot: AnalysisIntent['temporalSlot'],
  ): Record<string, unknown> {
    return {
      ...filters,
      ...(temporalSlot?.normalizedLabel && !filters.timeRange
        ? { timeRange: temporalSlot.normalizedLabel }
        : {}),
      ...(temporalSlot?.startAt && !filters.startAt ? { startAt: temporalSlot.startAt } : {}),
      ...(temporalSlot?.endAt && !filters.endAt ? { endAt: temporalSlot.endAt } : {}),
    };
  }

  private resolveBaseTable(domain: QueryPlanAst['domain']): QueryPlanAst['baseTable'] {
    if (domain === 'contract-conversion') {
      return 'contracts';
    }

    if (domain === 'customer-relationship') {
      return 'customers';
    }

    return 'opportunities';
  }

  private resolveResultKind(intent: AnalysisIntent): QueryPlanResultKind {
    if (intent.resultKindHint) {
      return intent.resultKindHint;
    }

    if (intent.dimensions.includes('渠道商')) {
      return 'partner-contribution';
    }

    if (intent.dimensions.includes('月份')) {
      return 'time-trend';
    }

    if (intent.dimensions.includes('商机阶段')) {
      return 'stage-distribution';
    }

    if (intent.dimensions.includes('客户分类')) {
      return 'category-distribution';
    }

    return 'owner-ranking';
  }

  private resolveGroupBy(resultKind: QueryPlanResultKind): string[] {
    if (resultKind === 'metric-summary') {
      return [];
    }

    if (resultKind === 'time-trend') {
      return ['created_at'];
    }

    if (resultKind === 'stage-distribution') {
      return ['stage'];
    }

    if (resultKind === 'category-distribution') {
      return ['category'];
    }

    if (resultKind === 'department-contribution') {
      return ['department_id'];
    }

    if (resultKind === 'partner-contribution') {
      return ['partner_id'];
    }

    return ['user_id', 'name'];
  }

  private resolveOrderDirection(plan: QueryPlanAst, field: string): 'ASC' | 'DESC' {
    return plan.orderBy.find((item) => item.field === field)?.direction ?? 'DESC';
  }

  private normalizeStringList(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item): item is string | number => item !== null && item !== undefined)
      .map((item) => String(item));
  }

  private resolveRowLimit(plan: QueryPlanAst): number {
    const parsedLimit = Number(plan.filters.rowLimit ?? plan.filters.topN);
    if (Number.isFinite(parsedLimit) && parsedLimit >= 1) {
      return Math.min(Math.floor(parsedLimit), 1000);
    }

    return this.defaultRowLimit;
  }
}

import { Injectable } from '@nestjs/common';
import type {
  AnalysisDatasetSlice,
  AnalysisIntent,
  AnalysisQueryTask,
  CrmUser,
  MetricCard,
  QueryPlanResultKind,
  ResultView,
  ScopeSnapshot,
} from '../../shared/types/domain';
import { formatWanAmount } from '../../shared/utils/business-amount.util';
import { buildEntityId } from '../../shared/utils/id.util';
import type { RoutedCompiledQueryTask } from './analysis-read-tool.registry';
import { CrmSqliteReadonlyService } from './crm-sqlite-readonly.service';
import { formatOpportunityStageLabel } from './opportunity-stage-label.util';
import {
  buildStaleOpportunityAnalysisTitle,
  buildStaleOpportunityDetailTitle,
  buildStaleOpportunityRiskScopeText,
  buildStaleOpportunitySortScopeText,
  isStaleOpportunityQuestionText,
  resolveStaleOpportunityThreshold,
} from './stale-opportunity-threshold.util';
import { buildResultTemporalScope } from './temporal-scope.util';

type BusinessChainResource = 'partners' | 'registrations' | 'opportunities' | 'orders';
type SqliteRecord = Record<string, unknown>;

interface SqliteBusinessSnapshot {
  partners: SqliteRecord[];
  registrations: SqliteRecord[];
  opportunities: SqliteRecord[];
  orders: SqliteRecord[];
  businessOverview: SqliteRecord[];
  salesFunnel: SqliteRecord[];
  partnerContribution: SqliteRecord[];
  customerLifecycle: SqliteRecord[];
  openRisks: SqliteRecord[];
  scopeSummary: string;
  useMirrorSummaries: boolean;
  sql: string;
}

@Injectable()
export class CrmSqliteReadonlyAnalysisExecutorService {
  constructor(private readonly crmSqliteReadonlyService: CrmSqliteReadonlyService) {}

  /**
   * 执行单个 SQLite 只读分析任务。
   *
   * 参数说明：包含用户问题、当前用户、权限摘要、权限快照和已路由任务。
   * 返回值说明：返回统一数据切片，供现有报告组装器复用。
   * 可能抛出的异常：底层 SQLite 不可用或资源缺失时向上抛出。
   * 调用注意事项：这里只读取固定资源并做内存聚合，不让 AI 自由 SQL 直接访问生产库。
   */
  async executeTask(params: {
    questionText: string;
    user: CrmUser;
    scopeSummary: string;
    scopeSnapshot: ScopeSnapshot;
    compiledTask: RoutedCompiledQueryTask;
  }): Promise<AnalysisDatasetSlice> {
    const resource = this.resolvePrimaryResource(params.compiledTask);
    const shouldUseStaleOpportunityTemplate =
      resource === 'opportunities' &&
      isStaleOpportunityQuestionText(params.questionText);
    const [records, partners] = await Promise.all([
      this.readScopedResource(
        resource,
        params.scopeSnapshot,
        shouldUseStaleOpportunityTemplate
          ? undefined
          : params.compiledTask.plan.temporalSlot,
      ),
      resource === 'partners'
        ? Promise.resolve<SqliteRecord[]>([])
        : this.readScopedResource('partners', params.scopeSnapshot),
    ]);
    const partnerNameMap = this.buildPartnerNameMap(
      resource === 'partners' ? records : partners,
    );

    if (shouldUseStaleOpportunityTemplate) {
      return this.buildStaleOpportunitySlice({
        questionText: params.questionText,
        scopeSummary: params.scopeSummary,
        task: params.compiledTask,
        opportunities: records,
        partnerNameMap,
      });
    }

    const rows = this.buildRowsForTask(resource, records, params.compiledTask, partnerNameMap);
    return this.buildSlice({
      task: params.compiledTask,
      taskTitle: params.compiledTask.taskTitle,
      scopeSummary: params.scopeSummary,
      summary: this.buildTaskSummary(resource, records, rows, params.compiledTask.resultKind),
      rows,
      metricCards: this.buildMetricCardsForResource(resource, records, rows, params.compiledTask.resultKind),
      primaryView: this.buildPrimaryView(params.compiledTask.taskTitle, params.compiledTask.resultKind, rows),
      secondaryViews: this.buildSecondaryViews(resource, records, partnerNameMap),
      temporalSlot: params.compiledTask.plan.temporalSlot,
      sql: this.buildSqlSummary(resource),
      matchedAdapter: `crm-sqlite-readonly.${resource}.${params.compiledTask.resultKind}`,
    });
  }

  /**
   * 执行组合经营 SQLite 只读分析。
   *
   * 参数说明：`resources` 为本次明确覆盖的合作伙伴、报备、商机和订单对象。
   * 返回值说明：返回一个组合经营切片，主表是经营区块摘要，二级表包含真实明细。
   * 调用注意事项：组合经营问题走这一条正式 SQLite 路线，不再进入旧分析仓库或 MySQL 兜底。
   */
  async executeBusinessAnalysis(params: {
    questionText: string;
    user: CrmUser;
    scopeSummary: string;
    scopeSnapshot: ScopeSnapshot;
    temporalSlot?: AnalysisIntent['temporalSlot'];
    resources: BusinessChainResource[];
    taskId?: string;
    taskTitle?: string;
  }): Promise<AnalysisDatasetSlice> {
    const snapshot = await this.readBusinessSnapshot({
      scopeSnapshot: params.scopeSnapshot,
      temporalSlot: params.temporalSlot,
      resources: params.resources,
      scopeSummary: params.scopeSummary,
    });
    const summaryRows = this.buildBusinessSummaryRows(snapshot, params.resources);
    const partnerContributionRows = this.buildPartnerContributionRows(snapshot);
    const secondaryViews = this.buildBusinessSecondaryViews(snapshot, partnerContributionRows, params.resources);
    const metricCards = this.buildBusinessMetricCards(snapshot, params.resources);

    return {
      datasetId: buildEntityId('dataset'),
      taskId: params.taskId ?? 'crm-sqlite-readonly-business-chain',
      taskTitle: params.taskTitle ?? '合作伙伴开拓、客户报备、商机与订单经营分析',
      resultKind: 'partner-contribution',
      purpose: 'primary-summary',
      sql: snapshot.sql,
      executionMode: 'PLAN_EXECUTION',
      executionSource: 'CRM_SQLITE_READONLY',
      matchedAdapter: 'crm-sqlite-readonly.business-chain-snapshot',
      gapReason: '',
      summary: this.buildBusinessSummary(snapshot, params.resources),
      temporalScope: buildResultTemporalScope(params.temporalSlot),
      appliedFilters: [
        { label: '分析对象', value: this.formatResourceLabel(params.resources) },
        { label: '数据来源', value: 'CRM SQLite 只读镜像库 analysis-mirror' },
        { label: '权限范围', value: params.scopeSummary },
        { label: '执行口径', value: '优先读取 mirror 分析视图，再用 fact/dim 明细钻取；不调用旧 MySQL 分析库或脱敏样例库' },
      ],
      metricCards,
      primaryView: summaryRows.length
        ? {
            viewType: 'BAR_CHART',
            title: '经营区块数据覆盖',
            series: summaryRows.map((row) => ({
              label: row.ownerName,
              value: row.count,
            })),
          }
        : undefined,
      secondaryViews,
      tableRows: summaryRows,
      rowCount: summaryRows.length,
    };
  }

  /**
   * 读取并裁剪业务资源。
   */
  private async readScopedResource(
    resource: BusinessChainResource | 'quotes',
    scopeSnapshot: ScopeSnapshot,
    temporalSlot?: AnalysisIntent['temporalSlot'],
  ): Promise<SqliteRecord[]> {
    const records = await this.crmSqliteReadonlyService.readResource(resource);
    return records.filter((record) =>
      this.matchesScope(record, scopeSnapshot) && this.matchesTemporal(record, resource, temporalSlot),
    );
  }

  /**
   * 尝试读取 mirror 分析视图。
   *
   * 参数说明：`viewName` 为联软提供的固定分析视图名。
   * 返回值说明：视图存在时返回行数组，不存在时返回空数组。
   * 调用注意事项：视图只作为总览加速和标准口径来源；明细仍从 fact/dim 表钻取，避免视图缺失时影响主链。
   */
  private async readOptionalAnalysisView(
    viewName:
      | 'v_business_overview'
      | 'v_sales_funnel'
      | 'v_partner_contribution'
      | 'v_customer_lifecycle'
      | 'v_open_risks',
  ): Promise<SqliteRecord[]> {
    try {
      return await this.crmSqliteReadonlyService.readAnalysisView(viewName);
    } catch {
      return [];
    }
  }

  /**
   * 读取组合经营所需的多资源快照。
   */
  private async readBusinessSnapshot(params: {
    scopeSnapshot: ScopeSnapshot;
    temporalSlot?: AnalysisIntent['temporalSlot'];
    resources: BusinessChainResource[];
    scopeSummary: string;
  }): Promise<SqliteBusinessSnapshot> {
    const resources = new Set(params.resources);
    const [
      partners,
      registrations,
      opportunities,
      orders,
      businessOverview,
      salesFunnel,
      partnerContribution,
      customerLifecycle,
      openRisks,
    ] = await Promise.all([
      resources.has('partners')
        ? this.readScopedResource('partners', params.scopeSnapshot, params.temporalSlot)
        : this.readScopedResource('partners', params.scopeSnapshot),
      resources.has('registrations')
        ? this.readScopedResource('registrations', params.scopeSnapshot, params.temporalSlot)
        : Promise.resolve<SqliteRecord[]>([]),
      resources.has('opportunities')
        ? this.readScopedResource('opportunities', params.scopeSnapshot, params.temporalSlot)
        : Promise.resolve<SqliteRecord[]>([]),
      resources.has('orders')
        ? this.readScopedResource('orders', params.scopeSnapshot, params.temporalSlot)
        : Promise.resolve<SqliteRecord[]>([]),
      this.readOptionalAnalysisView('v_business_overview'),
      this.readOptionalAnalysisView('v_sales_funnel'),
      this.readOptionalAnalysisView('v_partner_contribution'),
      this.readOptionalAnalysisView('v_customer_lifecycle'),
      this.readOptionalAnalysisView('v_open_risks'),
    ]);

    return {
      partners,
      registrations,
      opportunities,
      orders,
      businessOverview,
      salesFunnel,
      partnerContribution,
      customerLifecycle,
      openRisks,
      scopeSummary: params.scopeSummary,
      useMirrorSummaries: !params.temporalSlot?.startAt && !params.temporalSlot?.endAt,
      sql: [
        '-- CRM SQLite 只读镜像库固定模板',
        `-- resources: ${params.resources.join(', ')}`,
        '-- preferred views: v_business_overview, v_sales_funnel, v_partner_contribution, v_customer_lifecycle, v_open_risks',
        '-- drilldown tables: fact_registrations, fact_opportunities, fact_orders, dim_partners, dim_users, dim_customers',
      ].join('\n'),
    };
  }

  /**
   * 根据当前任务选择主资源。
   */
  private resolvePrimaryResource(task: RoutedCompiledQueryTask): BusinessChainResource {
    if (task.plan.domain === 'contract-conversion') {
      return 'orders';
    }
    if (task.plan.domain === 'customer-relationship') {
      return /渠道|伙伴|服务商/u.test(task.taskTitle) ? 'partners' : 'registrations';
    }
    return 'opportunities';
  }

  /**
   * 按任务类型生成聚合行。
   */
  private buildRowsForTask(
    resource: BusinessChainResource,
    records: SqliteRecord[],
    task: RoutedCompiledQueryTask,
    partnerNameMap: Map<string, string>,
  ): SqliteRecord[] {
    if (task.resultKind === 'metric-summary') {
      return [this.buildSummaryRow(resource, records)];
    }
    if (task.resultKind === 'time-trend') {
      return this.aggregateBy(records, (record) => this.readDate(record, resource).slice(0, 7) || '未填写时间', resource);
    }
    if (task.resultKind === 'stage-distribution' && resource === 'opportunities') {
      return this.aggregateBy(records, (record) => this.resolveStageName(record), resource);
    }
    if (task.resultKind === 'partner-contribution') {
      return this.aggregateBy(records, (record) => this.resolvePartnerName(record, partnerNameMap), resource, 'partner');
    }
    if (task.resultKind === 'department-contribution') {
      return this.aggregateBy(records, (record) => this.resolveDepartmentName(record), resource);
    }
    return this.aggregateBy(records, (record) => this.resolveOwnerName(record), resource);
  }

  /**
   * 构造停滞商机切片。
   */
  private buildStaleOpportunitySlice(params: {
    questionText: string;
    scopeSummary: string;
    task: RoutedCompiledQueryTask;
    opportunities: SqliteRecord[];
    partnerNameMap: Map<string, string>;
  }): AnalysisDatasetSlice {
    const threshold = resolveStaleOpportunityThreshold(params.questionText);
    const rows = params.opportunities
      .map((record) => this.buildOpportunityDetailRow(record, params.partnerNameMap))
      .filter((row) => Number(row.staleDays ?? 0) > threshold.days)
      .sort((left, right) => Number(right.staleDays ?? 0) - Number(left.staleDays ?? 0));
    const amount = rows.reduce((sum, row) => sum + Number(row.opportunityAmount ?? 0), 0);

    return this.buildSlice({
      task: params.task,
      taskTitle: buildStaleOpportunityAnalysisTitle(threshold.label),
      scopeSummary: params.scopeSummary,
      summary: `当前权限范围内共有 ${rows.length} 条${threshold.label}未更新商机，涉及金额 ${formatWanAmount(amount)}。风险口径：${buildStaleOpportunityRiskScopeText(threshold.days)}。`,
      rows,
      metricCards: [
        { name: '停滞商机数', value: rows.length },
        { name: '停滞商机金额', value: formatWanAmount(amount) },
        { name: '停滞阈值', value: threshold.label },
      ],
      primaryView: rows.length
        ? {
            viewType: 'RANKING_TABLE',
            title: buildStaleOpportunityDetailTitle(threshold.label),
            rows,
          }
        : undefined,
      secondaryViews: [],
      temporalSlot: params.task.plan.temporalSlot,
      sql: '-- CRM SQLite 只读库固定模板：停滞商机明细',
      matchedAdapter: 'crm-sqlite-readonly.opportunity-stale-detail',
      extraFilters: [
        { label: '风险口径', value: buildStaleOpportunityRiskScopeText(threshold.days) },
        { label: '排序口径', value: buildStaleOpportunitySortScopeText() },
      ],
    });
  }

  /**
   * 构造统一数据切片。
   */
  private buildSlice(params: {
    task: RoutedCompiledQueryTask;
    taskTitle: string;
    scopeSummary: string;
    summary: string;
    rows: SqliteRecord[];
    metricCards: MetricCard[];
    primaryView?: ResultView;
    secondaryViews: ResultView[];
    temporalSlot?: AnalysisQueryTask['plan']['temporalSlot'];
    sql: string;
    matchedAdapter: string;
    extraFilters?: Array<{ label: string; value: string }>;
  }): AnalysisDatasetSlice {
    return {
      datasetId: buildEntityId('dataset'),
      taskId: params.task.taskId,
      taskTitle: params.taskTitle,
      resultKind: params.task.resultKind,
      purpose: params.task.purpose,
      sql: params.sql,
      executionMode: params.task.executionMode,
      executionSource: 'CRM_SQLITE_READONLY',
      matchedAdapter: params.matchedAdapter,
      gapReason: '',
      summary: params.summary,
      temporalScope: buildResultTemporalScope(params.temporalSlot),
      appliedFilters: [
        { label: '数据来源', value: 'CRM SQLite 只读镜像库 analysis-mirror' },
        ...(params.extraFilters ?? []),
        { label: '权限范围', value: params.scopeSummary },
      ],
      metricCards: params.metricCards,
      primaryView: params.primaryView,
      secondaryViews: params.secondaryViews,
      tableRows: params.rows,
      rowCount: params.rows.length,
    };
  }

  /**
   * 构造组合经营摘要行。
   */
  private buildBusinessSummaryRows(
    snapshot: SqliteBusinessSnapshot,
    resources: BusinessChainResource[],
  ): SqliteRecord[] {
    const rows: SqliteRecord[] = [];
    const pushRow = (resource: BusinessChainResource, label: string, count: number, amount = 0) => {
      if (!resources.includes(resource)) {
        return;
      }
      rows.push({
        resource,
        businessSection: label,
        ownerName: label,
        count,
        amount,
        amountText: amount > 0 ? formatWanAmount(amount) : '',
        source: `CRM SQLite 只读库 ${resource}`,
      });
    };
    const registrationMetric = this.readOverviewMetric(snapshot, 'registrations');
    const opportunityMetric = this.readOverviewMetric(snapshot, 'opportunities');
    const orderMetric = this.readOverviewMetric(snapshot, 'orders');
    pushRow('partners', '合作伙伴开拓情况', this.resolveMirrorCount(snapshot, snapshot.partners.length));
    pushRow(
      'registrations',
      '客户报备情况',
      registrationMetric.count ?? snapshot.registrations.length,
      registrationMetric.amount ?? this.sumAmount('registrations', snapshot.registrations),
    );
    pushRow(
      'opportunities',
      '客户商机报备及商机情况',
      opportunityMetric.count ?? snapshot.opportunities.length,
      opportunityMetric.amount ?? this.sumAmount('opportunities', snapshot.opportunities),
    );
    pushRow(
      'orders',
      '订单情况',
      orderMetric.count ?? snapshot.orders.length,
      orderMetric.amount ?? this.sumAmount('orders', snapshot.orders),
    );
    return rows;
  }

  /**
   * 构造渠道商贡献汇总。
   */
  private buildPartnerContributionRows(snapshot: SqliteBusinessSnapshot): SqliteRecord[] {
    if (snapshot.useMirrorSummaries && snapshot.partnerContribution.length > 0) {
      return snapshot.partnerContribution
        .map((record): SqliteRecord => {
          const opportunityAmount = this.toNumber(record.opportunity_amount);
          const orderAmount = this.toNumber(record.order_amount);
          return {
            partnerId: this.readText(record.partner_id),
            partnerName: this.readText(record.partner_name) || '未填写渠道商',
            ownerId: this.readText(record.partner_id),
            ownerName: this.readText(record.partner_name) || '未填写渠道商',
            bucket_label: this.readText(record.partner_name) || '未填写渠道商',
            partnerLevel: this.readText(record.partner_level_name ?? record.partner_level) || undefined,
            region: this.readText(record.region ?? record.big_region) || undefined,
            registrationCount: this.toNumber(record.registration_count),
            registrationAmount: this.toNumber(record.registration_amount),
            opportunityCount: this.toNumber(record.opportunity_count),
            opportunityAmount,
            opportunityAmountText: formatWanAmount(opportunityAmount),
            quoteCount: this.toNumber(record.quote_count),
            quoteAmount: this.toNumber(record.quote_amount),
            orderCount: this.toNumber(record.order_count),
            orderAmount,
            orderAmountText: formatWanAmount(orderAmount),
          };
        })
        .sort((left, right) =>
          Number(right.orderAmount ?? 0) - Number(left.orderAmount ?? 0) ||
          Number(right.opportunityAmount ?? 0) - Number(left.opportunityAmount ?? 0) ||
          Number(right.registrationCount ?? 0) - Number(left.registrationCount ?? 0),
        );
    }

    const partnerNameMap = this.buildPartnerNameMap(snapshot.partners);
    const rows = new Map<string, SqliteRecord>();
    const ensureRow = (record: SqliteRecord): SqliteRecord => {
      const partnerId = this.resolvePartnerId(record);
      const partnerName = this.resolvePartnerName(record, partnerNameMap);
      const current = rows.get(partnerId) ?? {
        partnerId,
        partnerName,
        ownerId: partnerId,
        ownerName: partnerName,
        bucket_label: partnerName,
        registrationCount: 0,
        opportunityCount: 0,
        opportunityAmount: 0,
        orderCount: 0,
        orderAmount: 0,
      };
      rows.set(partnerId, current);
      return current;
    };

    snapshot.partners.forEach((partner) => ensureRow(partner));
    snapshot.registrations.forEach((record) => {
      const row = ensureRow(record);
      row.registrationCount = Number(row.registrationCount ?? 0) + 1;
    });
    snapshot.opportunities.forEach((record) => {
      const row = ensureRow(record);
      row.opportunityCount = Number(row.opportunityCount ?? 0) + 1;
      row.opportunityAmount = Number(row.opportunityAmount ?? 0) + this.readAmount('opportunities', record);
    });
    snapshot.orders.forEach((record) => {
      const row = ensureRow(record);
      row.orderCount = Number(row.orderCount ?? 0) + 1;
      row.orderAmount = Number(row.orderAmount ?? 0) + this.readAmount('orders', record);
    });

    return [...rows.values()]
      .map((row): SqliteRecord => ({
        ...row,
        opportunityAmountText: formatWanAmount(Number(row.opportunityAmount ?? 0)),
        orderAmountText: formatWanAmount(Number(row.orderAmount ?? 0)),
      }))
      .sort((left, right) =>
        Number(right.orderAmount ?? 0) - Number(left.orderAmount ?? 0) ||
        Number(right.opportunityAmount ?? 0) - Number(left.opportunityAmount ?? 0),
      );
  }

  /**
   * 构造组合经营二级明细表。
   */
  private buildBusinessSecondaryViews(
    snapshot: SqliteBusinessSnapshot,
    partnerContributionRows: SqliteRecord[],
    resources: BusinessChainResource[],
  ): ResultView[] {
    const partnerNameMap = this.buildPartnerNameMap(snapshot.partners);
    const views: ResultView[] = [
      { viewType: 'RANKING_TABLE', title: '渠道商经营贡献汇总', rows: partnerContributionRows },
      { viewType: 'DETAIL_TABLE', title: '销售漏斗', rows: snapshot.useMirrorSummaries ? snapshot.salesFunnel.map((item) => this.buildSalesFunnelRow(item)) : [] },
      { viewType: 'DETAIL_TABLE', title: '客户生命周期', rows: snapshot.useMirrorSummaries ? snapshot.customerLifecycle.map((item) => this.buildCustomerLifecycleRow(item)) : [] },
      { viewType: 'DETAIL_TABLE', title: '待关注风险', rows: snapshot.openRisks.map((item) => this.buildOpenRiskRow(item)) },
      { viewType: 'DETAIL_TABLE', title: '合作伙伴明细', rows: resources.includes('partners') ? snapshot.partners.map((item) => this.buildPartnerDetailRow(item)) : [] },
      { viewType: 'DETAIL_TABLE', title: '客户报备明细', rows: resources.includes('registrations') ? snapshot.registrations.map((item) => this.buildRegistrationDetailRow(item, partnerNameMap)) : [] },
      { viewType: 'DETAIL_TABLE', title: '商机明细', rows: resources.includes('opportunities') ? snapshot.opportunities.map((item) => this.buildOpportunityDetailRow(item, partnerNameMap)) : [] },
      { viewType: 'DETAIL_TABLE', title: '订单明细', rows: resources.includes('orders') ? snapshot.orders.map((item) => this.buildOrderDetailRow(item, partnerNameMap)) : [] },
    ];
    return views.filter((view) => (view.rows?.length ?? 0) > 0);
  }

  /**
   * 构造单资源二级明细表。
   */
  private buildSecondaryViews(
    resource: BusinessChainResource,
    records: SqliteRecord[],
    partnerNameMap: Map<string, string>,
  ): ResultView[] {
    const rows = records.map((record) => {
      if (resource === 'partners') return this.buildPartnerDetailRow(record);
      if (resource === 'registrations') return this.buildRegistrationDetailRow(record, partnerNameMap);
      if (resource === 'orders') return this.buildOrderDetailRow(record, partnerNameMap);
      return this.buildOpportunityDetailRow(record, partnerNameMap);
    });
    return rows.length
      ? [{ viewType: 'DETAIL_TABLE', title: `${this.resourceLabel(resource)}明细`, rows }]
      : [];
  }

  /**
   * 生成指标卡。
   */
  private buildMetricCardsForResource(
    resource: BusinessChainResource,
    records: SqliteRecord[],
    rows: SqliteRecord[],
    resultKind: QueryPlanResultKind,
  ): MetricCard[] {
    const cards: MetricCard[] = [
      { name: `${this.resourceLabel(resource)}数`, value: records.length },
    ];
    const amount = this.sumAmount(resource, records);
    if (amount > 0) {
      cards.push({ name: `${this.resourceLabel(resource)}金额`, value: formatWanAmount(amount) });
    }
    if (resultKind !== 'metric-summary') {
      cards.push({ name: '分组数量', value: rows.length });
    }
    return cards;
  }

  /**
   * 生成组合经营指标卡。
   */
  private buildBusinessMetricCards(
    snapshot: SqliteBusinessSnapshot,
    resources: BusinessChainResource[],
  ): MetricCard[] {
    const cards: MetricCard[] = [];
    const registrationMetric = this.readOverviewMetric(snapshot, 'registrations');
    const opportunityMetric = this.readOverviewMetric(snapshot, 'opportunities');
    const orderMetric = this.readOverviewMetric(snapshot, 'orders');
    if (resources.includes('partners')) cards.push({ name: '合作伙伴数', value: this.resolveMirrorCount(snapshot, snapshot.partners.length) });
    if (resources.includes('registrations')) cards.push({ name: '客户报备数', value: registrationMetric.count ?? snapshot.registrations.length });
    if (resources.includes('opportunities')) {
      cards.push({ name: '商机数', value: opportunityMetric.count ?? snapshot.opportunities.length });
      cards.push({ name: '商机金额', value: formatWanAmount(opportunityMetric.amount ?? this.sumAmount('opportunities', snapshot.opportunities)) });
    }
    if (resources.includes('orders')) {
      cards.push({ name: '订单数', value: orderMetric.count ?? snapshot.orders.length });
      cards.push({ name: '订单金额', value: formatWanAmount(orderMetric.amount ?? this.sumAmount('orders', snapshot.orders)) });
    }
    return cards;
  }

  /**
   * 从业务总览视图读取指定资源指标。
   *
   * 参数说明：`metricName` 对应 `v_business_overview.metric`。
   * 返回值说明：返回数量和金额；视图不可用或当前为时间筛选场景时返回空对象。
   * 调用注意事项：带时间范围的问题不能直接使用全量视图，避免“最近三个月”被全量数据污染。
   */
  private readOverviewMetric(
    snapshot: SqliteBusinessSnapshot,
    metricName: 'registrations' | 'opportunities' | 'orders',
  ): { count?: number; amount?: number } {
    if (!snapshot.useMirrorSummaries) {
      return {};
    }
    const row = snapshot.businessOverview.find(
      (item) => this.readText(item.metric) === metricName,
    );
    if (!row) {
      return {};
    }
    return {
      count: this.toNumber(row.count_value),
      amount: this.toNumber(row.amount_value),
    };
  }

  /**
   * 读取 mirror 贡献视图的行数作为合作伙伴数量。
   *
   * 参数说明：`snapshot` 为本次组合经营快照，`fallback` 为维表明细数量。
   * 返回值说明：视图可用时返回视图行数，否则返回兜底数量。
   * 调用注意事项：合作伙伴本身没有金额，贡献视图能更贴近经营分析口径。
   */
  private resolveMirrorCount(snapshot: SqliteBusinessSnapshot, fallback: number): number {
    return snapshot.useMirrorSummaries && snapshot.partnerContribution.length > 0
      ? snapshot.partnerContribution.length
      : fallback;
  }

  /**
   * 构造销售漏斗视图行。
   */
  private buildSalesFunnelRow(record: SqliteRecord): SqliteRecord {
    return {
      stage: this.resolveSalesFunnelStage(record),
      count: this.toNumber(record.count_value),
      conversionFromPrevious: this.toNumber(record.conversion_from_previous),
    };
  }

  /**
   * 构造客户生命周期视图行。
   */
  private buildCustomerLifecycleRow(record: SqliteRecord): SqliteRecord {
    return {
      customerId: this.readText(record.customer_id),
      customerName: this.readText(record.customer_name) || '未命名客户',
      lifecycleStage: this.readText(record.lifecycle_stage) || '未填写阶段',
      region: this.readText(record.region ?? record.city) || undefined,
      partnerNames: this.readJsonTextList(record.partner_names_json).join('、') || undefined,
      ownerNames: this.readJsonTextList(record.owner_names_json).join('、') || undefined,
      registrationCount: this.toNumber(record.registration_count),
      opportunityCount: this.toNumber(record.opportunity_count),
      quoteCount: this.toNumber(record.quote_count),
      orderCount: this.toNumber(record.order_count),
      opportunityAmount: this.toNumber(record.opportunity_amount),
      orderAmount: this.toNumber(record.order_amount),
    };
  }

  /**
   * 构造待关注风险视图行。
   */
  private buildOpenRiskRow(record: SqliteRecord): SqliteRecord {
    return {
      riskType: this.readText(record.risk_type) || '待关注事项',
      objectId: this.readText(record.object_id) || undefined,
      objectName: this.readText(record.object_name) || '未命名对象',
      customerName: this.readText(record.customer_name) || undefined,
      partnerName: this.readText(record.partner_name) || undefined,
      ownerName: this.readText(record.owner_name) || undefined,
      amount: this.toNumber(record.amount),
      amountText: formatWanAmount(this.toNumber(record.amount)),
      riskDays: this.toNumber(record.risk_days),
      riskMessage: this.readText(record.risk_message) || undefined,
    };
  }

  /**
   * 按维度聚合数量和金额。
   */
  private aggregateBy(
    records: SqliteRecord[],
    readLabel: (record: SqliteRecord) => string,
    resource: BusinessChainResource,
    idKind: 'generic' | 'partner' = 'generic',
  ): SqliteRecord[] {
    const groups = new Map<string, SqliteRecord>();
    for (const record of records) {
      const label = readLabel(record) || '未填写';
      const group = groups.get(label) ?? {
        ownerId: idKind === 'partner' ? this.resolvePartnerId(record) : label,
        ownerName: label,
        bucket_label: label,
        count: 0,
        amount: 0,
      };
      group.count = Number(group.count ?? 0) + 1;
      group.amount = Number(group.amount ?? 0) + this.readAmount(resource, record);
      groups.set(label, group);
    }
    return [...groups.values()].sort((left, right) =>
      Number(right.amount ?? 0) - Number(left.amount ?? 0) ||
      Number(right.count ?? 0) - Number(left.count ?? 0),
    );
  }

  /**
   * 构造汇总行。
   */
  private buildSummaryRow(resource: BusinessChainResource, records: SqliteRecord[]): SqliteRecord {
    const amount = this.sumAmount(resource, records);
    return {
      ownerId: 'summary',
      ownerName: `${this.resourceLabel(resource)}总览`,
      bucket_label: `${this.resourceLabel(resource)}总览`,
      count: records.length,
      amount,
      amountText: amount > 0 ? formatWanAmount(amount) : '',
    };
  }

  /**
   * 构造主图。
   */
  private buildPrimaryView(
    title: string,
    resultKind: QueryPlanResultKind,
    rows: SqliteRecord[],
  ): ResultView | undefined {
    if (!rows.length || resultKind === 'metric-summary') {
      return undefined;
    }
    return {
      viewType: resultKind === 'time-trend' ? 'LINE_CHART' : 'BAR_CHART',
      title,
      series: rows.map((row) => ({
        label: row.ownerName ?? row.bucket_label ?? '未命名分组',
        value: row.amount ?? row.count ?? 0,
      })),
    };
  }

  /**
   * 构造合作伙伴明细。
   */
  private buildPartnerDetailRow(record: SqliteRecord): SqliteRecord {
    return {
      partnerId: this.readText(record.partner_id ?? record.id ?? record.partnerId),
      partnerName: this.readText(record.partner_name ?? record.partnerName ?? record.name ?? record.displayName ?? record.shortName) || '未命名服务商',
      partnerLevel: this.readText(record.partner_level_name ?? record.partnerLevelName ?? record.partner_level ?? record.partnerLevel ?? record.level) || '未填写等级',
      partnerType: this.readText(record.partner_type_name ?? record.partnerTypeName ?? record.partner_type ?? record.partnerType) || undefined,
      region: this.readText(record.region ?? record.big_region ?? record.bigRegion) || undefined,
      status: this.readText(record.status) || undefined,
      joinDate: this.readText(record.join_date ?? record.joinDate ?? record.created_at ?? record.createdAt) || undefined,
    };
  }

  /**
   * 构造客户报备明细。
   */
  private buildRegistrationDetailRow(record: SqliteRecord, partnerNameMap: Map<string, string>): SqliteRecord {
    return {
      registrationId: this.readText(record.registration_id ?? record.registrationId ?? record.id ?? record.regId),
      customerName: this.readText(record.customer_name ?? record.customerName ?? record.customer) || '未命名客户',
      status: this.readText(record.status_name ?? record.status) || '未填写状态',
      partnerId: this.resolvePartnerId(record),
      partnerName: this.resolvePartnerName(record, partnerNameMap),
      opportunityId: this.readText(record.opportunity_id ?? record.opportunityId) || undefined,
      opportunityName: this.readText(record.opportunity_name ?? record.opportunityName) || undefined,
      ownerName: this.readText(record.assigned_staff_name ?? record.assignedStaffName ?? record.created_by_name ?? record.createdByName) || undefined,
      registrationAmount: this.readAmount('registrations', record),
      registrationAmountText: formatWanAmount(this.readAmount('registrations', record)),
      createdAt: this.readText(record.created_at ?? record.createdAt) || undefined,
      expireAt: this.readText(record.expire_at ?? record.expireAt) || undefined,
    };
  }

  /**
   * 构造商机明细。
   */
  private buildOpportunityDetailRow(record: SqliteRecord, partnerNameMap: Map<string, string>): SqliteRecord {
    const updatedAt = this.readText(record.updated_at ?? record.updatedAt ?? record.last_follow_up_at ?? record.lastFollowUpAt ?? record.__sourceUpdatedAt);
    return {
      opportunityId: this.readText(record.opportunity_id ?? record.opportunityId ?? record.id ?? record.oppId),
      opportunityName: this.readText(record.opportunity_name ?? record.opportunityName ?? record.name ?? record.title) || '未命名商机',
      customerName: this.readText(record.customer_name ?? record.customerName ?? record.customer) || undefined,
      stage: this.resolveStageName(record),
      partnerId: this.resolvePartnerId(record),
      partnerName: this.resolvePartnerName(record, partnerNameMap),
      ownerName: this.resolveOwnerName(record),
      opportunityAmount: this.readAmount('opportunities', record),
      opportunityAmountText: formatWanAmount(this.readAmount('opportunities', record)),
      createdAt: this.readText(record.created_at ?? record.createdAt) || undefined,
      updatedAt: updatedAt || undefined,
      staleDays: updatedAt ? this.diffDays(updatedAt) : undefined,
    };
  }

  /**
   * 构造订单明细。
   */
  private buildOrderDetailRow(record: SqliteRecord, partnerNameMap: Map<string, string>): SqliteRecord {
    return {
      orderId: this.readText(record.order_id ?? record.orderId ?? record.id),
      orderNo: this.readText(record.order_no ?? record.orderNo) || undefined,
      orderName: this.readText(record.order_name ?? record.orderName ?? record.name ?? record.order_no ?? record.orderNo) || '未命名订单',
      status: this.readText(record.status_name ?? record.status) || undefined,
      partnerId: this.resolvePartnerId(record),
      partnerName: this.resolvePartnerName(record, partnerNameMap),
      customerName: this.readText(record.customer_name ?? record.customerName) || undefined,
      opportunityId: this.readText(record.opportunity_id ?? record.opportunityId ?? record.oppId) || undefined,
      opportunityName: this.readText(record.opportunity_name ?? record.opportunityName) || undefined,
      orderAmount: this.readAmount('orders', record),
      orderAmountText: formatWanAmount(this.readAmount('orders', record)),
      createdAt: this.readText(record.created_at ?? record.createdAt ?? record.deal_at ?? record.dealAt ?? record.sign_date ?? record.signDate) || undefined,
    };
  }

  /**
   * 判断记录是否属于当前权限范围。
   */
  private matchesScope(record: SqliteRecord, scopeSnapshot: ScopeSnapshot): boolean {
    if (scopeSnapshot.isFullAccess) {
      return true;
    }

    return this.matchesScopeValues(record, scopeSnapshot.organizationIds, ['organizationId', 'orgId']) &&
      this.matchesScopeValues(record, scopeSnapshot.organizationIds, ['organization_id', 'org_id']) &&
      this.matchesScopeValues(record, scopeSnapshot.departmentIds, ['departmentId', 'deptId', 'department', 'department_id', 'dept_id']) &&
      this.matchesScopeValues(record, scopeSnapshot.ownerIds, ['ownerId', 'assignedStaffId', 'createdBy', 'userId', 'owner_id', 'assigned_staff_id', 'created_by', 'user_id']);
  }

  /**
   * 校验单类权限字段；记录没有对应字段时不在本类权限上误杀。
   */
  private matchesScopeValues(record: SqliteRecord, allowedValues: string[], fields: string[]): boolean {
    if (!allowedValues.length) {
      return true;
    }
    const recordValues = fields
      .map((field) => this.readText(record[field]))
      .filter(Boolean);
    return recordValues.length === 0 || recordValues.some((value) => allowedValues.includes(value));
  }

  /**
   * 判断记录是否命中时间口径。
   */
  private matchesTemporal(
    record: SqliteRecord,
    resource: BusinessChainResource | 'quotes',
    temporalSlot?: AnalysisIntent['temporalSlot'],
  ): boolean {
    if (!temporalSlot?.startAt && !temporalSlot?.endAt) {
      return true;
    }
    const recordDate = this.readDate(record, resource);
    if (!recordDate) {
      return true;
    }
    return (!temporalSlot.startAt || recordDate >= temporalSlot.startAt) &&
      (!temporalSlot.endAt || recordDate < temporalSlot.endAt);
  }

  /**
   * 读取资源主日期字段。
   */
  private readDate(record: SqliteRecord, resource: BusinessChainResource | 'quotes'): string {
    if (resource === 'orders') {
      return this.readText(record.deal_at ?? record.dealAt ?? record.sign_date ?? record.signDate ?? record.order_date ?? record.orderDate ?? record.created_at ?? record.createdAt);
    }
    if (resource === 'partners') {
      return this.readText(record.join_date ?? record.joinDate ?? record.created_at ?? record.createdAt);
    }
    if (resource === 'registrations') {
      return this.readText(record.created_at ?? record.createdAt ?? record.approved_at ?? record.approvedAt);
    }
    return this.readText(record.created_at ?? record.createdAt ?? record.updated_at ?? record.updatedAt ?? record.__sourceUpdatedAt);
  }

  /**
   * 读取金额字段。
   */
  private readAmount(resource: BusinessChainResource, record: SqliteRecord): number {
    const value = resource === 'orders'
      ? record.order_amount ?? record.orderAmount ?? record.total_amount ?? record.totalAmount ?? record.total ?? record.amount ?? record.contract_amount ?? record.contractAmount
      : resource === 'opportunities'
        ? record.opportunity_amount ?? record.opportunityAmount ?? record.amount ?? record.expect_amount ?? record.expectAmount ?? record.expected_amount ?? record.expectedAmount ?? record.total_amount ?? record.totalAmount
        : resource === 'partners'
          ? record.total_amount ?? record.totalAmount ?? record.total_amt ?? record.totalAmt ?? record.amount
          : record.registration_amount ?? record.registrationAmount ?? record.estimated_amount ?? record.estimatedAmount ?? record.amount ?? record.total_amount ?? record.totalAmount;
    return this.toNumber(value);
  }

  /**
   * 汇总资源金额。
   */
  private sumAmount(resource: BusinessChainResource, records: SqliteRecord[]): number {
    return records.reduce((sum, record) => sum + this.readAmount(resource, record), 0);
  }

  /**
   * 构造渠道商名称映射。
   */
  private buildPartnerNameMap(partners: SqliteRecord[]): Map<string, string> {
    const map = new Map<string, string>();
    for (const partner of partners) {
      const partnerId = this.readText(partner.partner_id ?? partner.id ?? partner.partnerId);
      const partnerName = this.readText(partner.partner_name ?? partner.partnerName ?? partner.name ?? partner.displayName ?? partner.shortName);
      if (partnerId && partnerName) {
        map.set(partnerId, partnerName);
      }
    }
    return map;
  }

  /**
   * 解析渠道商 ID。
   */
  private resolvePartnerId(record: SqliteRecord): string {
    return this.readText(record.partner_id ?? record.partnerId ?? record.assigned_partner_id ?? record.assignedPartnerId ?? record.channel_id ?? record.channelId) || 'unknown-partner';
  }

  /**
   * 解析渠道商名称，优先真实名称，不生成占位编号。
   */
  private resolvePartnerName(record: SqliteRecord, partnerNameMap: Map<string, string>): string {
    const partnerId = this.resolvePartnerId(record);
    return this.readText(record.partner_name ?? record.partnerName ?? record.assigned_partner_name ?? record.assignedPartnerName) ||
      partnerNameMap.get(partnerId) ||
      (partnerId === 'unknown-partner' ? '未填写渠道商' : partnerId);
  }

  /**
   * 解析商机阶段中文名。
   */
  private resolveStageName(record: SqliteRecord): string {
    return this.readText(record.stage_name ?? record.stageName) ||
      formatOpportunityStageLabel(record.stage) ||
      '未填写阶段';
  }

  /**
   * 解析销售漏斗阶段中文名。
   */
  private resolveSalesFunnelStage(record: SqliteRecord): string {
    const rawStage = this.readText(record.stage_name ?? record.stage);
    const labels: Record<string, string> = {
      registrations: '客户报备',
      opportunities: '商机',
      quotes: '报价',
      orders: '订单',
    };
    if (!rawStage) {
      return '未填写阶段';
    }
    return labels[rawStage] ?? formatOpportunityStageLabel(rawStage) ?? rawStage;
  }

  /**
   * 解析负责人名称。
   */
  private resolveOwnerName(record: SqliteRecord): string {
    return this.readText(
      record.owner_name ?? record.ownerName ?? record.assigned_staff_name ?? record.assignedStaffName ?? record.created_by_name ?? record.createdByName ?? record.user_name ?? record.userName,
    ) || '未填写负责人';
  }

  /**
   * 解析部门或区域名称。
   */
  private resolveDepartmentName(record: SqliteRecord): string {
    return this.readText(record.department_name ?? record.departmentName ?? record.department_id ?? record.departmentId ?? record.region ?? record.big_region ?? record.bigRegion) || '未填写部门/区域';
  }

  /**
   * 构造任务摘要。
   */
  private buildTaskSummary(
    resource: BusinessChainResource,
    records: SqliteRecord[],
    rows: SqliteRecord[],
    resultKind: QueryPlanResultKind,
  ): string {
    const amount = this.sumAmount(resource, records);
    const amountText = amount > 0 ? `，金额合计 ${formatWanAmount(amount)}` : '';
    const groupText = resultKind === 'metric-summary' ? '' : `，形成 ${rows.length} 个分组`;
    return `当前权限范围内共有${this.resourceLabel(resource)} ${records.length} 条${amountText}${groupText}。`;
  }

  /**
   * 构造组合经营摘要。
   */
  private buildBusinessSummary(snapshot: SqliteBusinessSnapshot, resources: BusinessChainResource[]): string {
    const parts: string[] = [];
    const registrationMetric = this.readOverviewMetric(snapshot, 'registrations');
    const opportunityMetric = this.readOverviewMetric(snapshot, 'opportunities');
    const orderMetric = this.readOverviewMetric(snapshot, 'orders');
    if (resources.includes('partners')) {
      parts.push(`合作伙伴 ${this.resolveMirrorCount(snapshot, snapshot.partners.length)} 家`);
    }
    if (resources.includes('registrations')) {
      parts.push(`客户报备 ${registrationMetric.count ?? snapshot.registrations.length} 条`);
    }
    if (resources.includes('opportunities')) {
      parts.push(`商机 ${opportunityMetric.count ?? snapshot.opportunities.length} 条、金额 ${formatWanAmount(opportunityMetric.amount ?? this.sumAmount('opportunities', snapshot.opportunities))}`);
    }
    if (resources.includes('orders')) {
      parts.push(`订单 ${orderMetric.count ?? snapshot.orders.length} 条、金额 ${formatWanAmount(orderMetric.amount ?? this.sumAmount('orders', snapshot.orders))}`);
    }
    return `当前权限范围内已读取 CRM SQLite 只读镜像库真实数据：${parts.join('；')}。`;
  }

  /**
   * 构造审计摘要 SQL。
   */
  private buildSqlSummary(resource: BusinessChainResource): string {
    return [
      '-- CRM SQLite 只读镜像库固定模板',
      `-- resource: ${resource}`,
      '-- drilldown tables: fact_registrations, fact_opportunities, fact_orders, dim_partners, dim_users, dim_customers',
    ].join('\n');
  }

  /**
   * 资源中文名。
   */
  private resourceLabel(resource: BusinessChainResource): string {
    const labels: Record<BusinessChainResource, string> = {
      partners: '合作伙伴',
      registrations: '客户报备',
      opportunities: '商机',
      orders: '订单',
    };
    return labels[resource];
  }

  /**
   * 格式化资源集合。
   */
  private formatResourceLabel(resources: BusinessChainResource[]): string {
    return resources.map((resource) => this.resourceLabel(resource)).join('、');
  }

  /**
   * 文本读取。
   */
  private readText(value: unknown): string {
    return String(value ?? '').trim();
  }

  /**
   * 读取 SQLite JSON 文本中的名称数组。
   *
   * 参数说明：`value` 为 SQLite 视图返回的 JSON 字符串或数组。
   * 返回值说明：返回已过滤空值的文本列表。
   * 调用注意事项：解析失败时返回空数组，避免把原始 JSON 或异常展示给业务用户。
   */
  private readJsonTextList(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map((item) => this.readText(item)).filter(Boolean);
    }
    const rawText = this.readText(value);
    if (!rawText) {
      return [];
    }
    try {
      const parsed = JSON.parse(rawText) as unknown;
      return Array.isArray(parsed)
        ? parsed.map((item) => this.readText(item)).filter(Boolean)
        : [];
    } catch {
      return [];
    }
  }

  /**
   * 数值读取。
   */
  private toNumber(value: unknown): number {
    const numberValue = Number(value ?? 0);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  /**
   * 计算距离今天的天数。
   */
  private diffDays(dateText: string): number {
    const time = new Date(dateText).getTime();
    if (!Number.isFinite(time)) {
      return 0;
    }
    return Math.max(0, Math.floor((Date.now() - time) / 86400000));
  }
}

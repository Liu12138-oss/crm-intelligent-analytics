import { Injectable } from '@nestjs/common';
import { CrmReadonlyService } from '../../database/crm-readonly/crm-readonly.service';
import type {
  AnalysisDatasetSlice,
  AppliedFilter,
  CrmOpportunity,
  CrmUser,
  MetricCard,
  ResultView,
} from '../../shared/types/domain';
import { formatWanAmount } from '../../shared/utils/business-amount.util';
import { buildEntityId } from '../../shared/utils/id.util';
import {
  OpenApiCapabilityGapError,
  OfficialApiFallbackToSqlError,
  RealDataUnavailableError,
} from './analysis.errors';
import type { RoutedCompiledQueryTask } from './analysis-read-tool.registry';
import { LianruanCrmAnalysisExecutorService } from './lianruan-crm-analysis-executor.service';
import type { CompiledQueryTask } from './query-compiler.service';
import { buildResultTemporalScope } from './temporal-scope.util';

@Injectable()
export class AnalysisQueryExecutorService {
  private readonly departmentNameMap: Record<string, string> = {
    dept_sales: '销售部',
    dept_region_east: '华东销售部',
    dept_sales_management: '销售管理部',
    dept_product: '产品部',
    dept_admin: '行政管理部',
  };

  constructor(
    private readonly crmReadonlyService: CrmReadonlyService,
    private readonly lianruanCrmAnalysisExecutorService?: LianruanCrmAnalysisExecutorService,
  ) {}

  /**
   * 统一执行正式分析任务。
   *
   * 参数说明：
   * - `questionText`：用户原始问题，用于 mock 与 Markdown 快照补充过滤。
   * - `user`：当前登录用户，用于保留统一权限和审计上下文。
   * - `scopeSummary`：当前权限范围摘要。
   * - `compiledTask`：已完成编译与路由的分析任务。
   * 返回值说明：返回统一分析数据切片，供编排层继续组装报告。
   * 调用注意事项：正式环境只允许 OpenAPI Markdown 快照主链；其它来源会被直接阻断。
   */
  async executeTask(
    questionText: string,
    user: CrmUser,
    scopeSummary: string,
    compiledTask: RoutedCompiledQueryTask,
  ): Promise<AnalysisDatasetSlice> {
    if (process.env.NODE_ENV === 'test') {
      return this.buildSliceFromRows(
        compiledTask,
        scopeSummary,
        this.buildMockTaskResult(questionText, compiledTask),
      );
    }

    if (compiledTask.executionSource === 'CRM_OFFICIAL_API') {
      return this.executeOfficialApiTask(
        questionText,
        user,
        scopeSummary,
        compiledTask,
      );
    }

    throw new OpenApiCapabilityGapError(
      '当前正式 CRM 分析主链仅允许通过 OpenAPI Markdown 快照读取本地真实明细，系统已停止执行受控 SQL 兜底以避免返回非真实明细。',
    );
  }

  /**
   * 执行业务链 Markdown 快照主链。
   *
   * 参数说明：
   * - `questionText/user/scopeSummary`：用户原问题、当前 CRM 用户和权限摘要；
   * - `temporalSlot/resources/taskId/taskTitle`：编排层识别出的时间口径、业务对象和主任务展示信息。
   * 返回值说明：返回由本地 Markdown 明细快照聚合出的组合经营数据切片。
   * 调用注意事项：该入口只委托正式分析执行器，不接入 SQLite/MySQL 或只读 SQL 旧链路。
   */
  async executeBusinessChainSnapshot(params: {
    questionText: string;
    user: CrmUser;
    scopeSummary: string;
    temporalSlot?: RoutedCompiledQueryTask['plan']['temporalSlot'];
    resources: Array<'partners' | 'registrations' | 'opportunities' | 'quotes' | 'orders'>;
    taskId?: string;
    taskTitle?: string;
  }): Promise<AnalysisDatasetSlice> {
    if (!this.lianruanCrmAnalysisExecutorService) {
      throw new RealDataUnavailableError('OpenAPI Markdown 快照分析执行器未注入，无法执行联软 CRM 业务链分析。');
    }

    return await this.lianruanCrmAnalysisExecutorService.executeBusinessChainSnapshotTask(params);
  }

  /**
   * 执行 Markdown 快照路由任务。
   *
   * 参数说明：
   * - `questionText/user/scopeSummary/compiledTask` 与 `executeTask` 保持一致。
   * 返回值说明：返回 Markdown 快照聚合结果。
   * 调用注意事项：正式主链不再对快照缺失做 SQL 兜底，避免掩盖快照刷新或文件缺失问题。
   */
  private async executeOfficialApiTask(
    questionText: string,
    user: CrmUser,
    scopeSummary: string,
    compiledTask: RoutedCompiledQueryTask,
  ): Promise<AnalysisDatasetSlice> {
    if (!this.lianruanCrmAnalysisExecutorService) {
      throw new RealDataUnavailableError('OpenAPI Markdown 快照分析执行器未注入，无法执行联软 CRM 分析。');
    }

    try {
      return await this.lianruanCrmAnalysisExecutorService.executeTask(
        questionText,
        user,
        scopeSummary,
        compiledTask,
      );
    } catch (error) {
      if (error instanceof OfficialApiFallbackToSqlError) {
        throw new RealDataUnavailableError(error.message);
      }

      throw error;
    }
  }

  /**
   * 执行既有只读 SQL 聚合链路，保持旧环境兼容。
   *
   * 参数说明：
   * - `questionText`：用户原始问题。
   * - `scopeSummary`：当前权限范围摘要。
   * - `compiledTask`：已编译的 SQL 分析任务。
   * 返回值说明：返回基于只读库聚合后的统一数据切片。
   * 调用注意事项：仅在只读库可用时调用，避免向空连接环境返回样例数据。
   */
  private async executeReadonlySqlTask(
    questionText: string,
    scopeSummary: string,
    compiledTask: RoutedCompiledQueryTask,
  ): Promise<AnalysisDatasetSlice> {
    const liveRows = await this.crmReadonlyService.executeQuery<Record<string, unknown>>(
      compiledTask.sql,
      compiledTask.params,
      {
        timeoutMs: compiledTask.timeoutMs,
      },
    );

    if (this.crmReadonlyService.canUseLiveQuery()) {
      return this.buildSliceFromRows(
        compiledTask,
        scopeSummary,
        await this.buildLiveTaskResult(questionText, compiledTask, liveRows),
      );
    }

    throw new RealDataUnavailableError(
      '当前未连接真实 CRM 分析数据源或当前身份未完成真实映射，系统不会返回样例分析结果，请先完成数据库与用户映射配置。',
    );
  }

  /**
   * 把底层聚合结果封装为统一数据切片，并附带执行来源追踪信息。
   *
   * 参数说明：
   * - `compiledTask`：当前任务。
   * - `scopeSummary`：当前权限范围摘要。
   * - `result`：已完成聚合的标准结果结构。
   * 返回值说明：返回供报告层直接消费的数据切片。
   * 调用注意事项：当下游未返回过滤标签时，这里会补一条权限范围标签。
   */
  private buildSliceFromRows(
    compiledTask: RoutedCompiledQueryTask,
    scopeSummary: string,
    result: {
      summary: string;
      appliedFilters: AppliedFilter[];
      metricCards: MetricCard[];
      primaryView?: ResultView;
      secondaryViews: ResultView[];
      tableRows: Array<Record<string, unknown>>;
    },
  ): AnalysisDatasetSlice {
    return {
      datasetId: buildEntityId('dataset'),
      taskId: compiledTask.taskId,
      taskTitle: compiledTask.taskTitle,
      resultKind: compiledTask.resultKind,
      purpose: compiledTask.purpose,
      sql: compiledTask.sql,
      executionMode: compiledTask.executionMode,
      executionSource: compiledTask.executionSource,
      matchedAdapter: compiledTask.matchedAdapter,
      gapReason: compiledTask.gapReason,
      summary: result.summary,
      temporalScope: buildResultTemporalScope(compiledTask.plan.temporalSlot),
      appliedFilters: result.appliedFilters.length
        ? result.appliedFilters
        : [{ label: '权限范围', value: scopeSummary }],
      metricCards: result.metricCards,
      primaryView: result.primaryView,
      secondaryViews: result.secondaryViews,
      tableRows: result.tableRows,
      rowCount: result.tableRows.length,
    };
  }

  private async buildLiveTaskResult(
    questionText: string,
    compiledTask: CompiledQueryTask,
    rows: Array<Record<string, unknown>>,
  ): Promise<{
    summary: string;
    appliedFilters: AppliedFilter[];
    metricCards: MetricCard[];
    primaryView?: ResultView;
    secondaryViews: ResultView[];
    tableRows: Array<Record<string, unknown>>;
  }> {
    const stageLabelMap =
      compiledTask.resultKind === 'stage-distribution'
        ? await this.crmReadonlyService.resolveFieldValueLabels({
            fieldName: 'stage',
            values: rows
              .map((item) => String(item.bucket_label ?? '').trim())
              .filter(Boolean),
            organizationIds: this.normalizeStringList(compiledTask.plan.filters.organizationIds),
            klassNameLike: '%Opportunity%',
          })
        : {};
    const normalizedRows = rows.map((item) => {
      const displayLabel = this.resolveLiveRowLabel(compiledTask, item, stageLabelMap);
      const rawBucketId = item.owner_id ?? item.department_id ?? item.partner_id ?? item.bucket_label ?? item.category ?? 'summary';

      return {
        ownerId: rawBucketId,
        ownerName: displayLabel,
        amount: Number(item.amount ?? item.total_amount ?? 0),
        count: Number(item.count ?? 0),
        bucket_label: compiledTask.resultKind === 'department-contribution' || compiledTask.resultKind === 'partner-contribution'
          ? displayLabel
          : item.bucket_label,
        category: item.category,
        partnerId: item.partner_id,
        partnerName: compiledTask.resultKind === 'partner-contribution' ? displayLabel : item.partnerName,
      };
    });

    const totalAmount = normalizedRows.reduce(
      (sum, item) => sum + Number(item.amount ?? 0),
      0,
    );
    const totalCount = normalizedRows.reduce(
      (sum, item) => sum + Number(item.count ?? 0),
      0,
    );

    return {
      summary:
        normalizedRows.length > 0
          ? `已执行 ${compiledTask.taskTitle} 查询，返回 ${normalizedRows.length} 个分组结果。`
          : '当前任务在授权范围内未命中数据。',
      appliedFilters: [
        { label: '时间口径', value: this.resolveTemporalFilterLabel(compiledTask) },
        { label: '数据来源', value: 'CRM 数据库' },
      ],
      metricCards: this.buildMetricCards(compiledTask, totalAmount, totalCount, normalizedRows.length),
      primaryView: this.buildPrimaryView(compiledTask, normalizedRows),
      secondaryViews: normalizedRows.length
        ? [
            {
              viewType: 'RANKING_TABLE',
              title: `${compiledTask.taskTitle}明细`,
              rows: normalizedRows,
            },
          ]
        : [],
      tableRows: normalizedRows,
    };
  }

  private buildMockTaskResult(
    questionText: string,
    compiledTask: CompiledQueryTask,
  ): {
    summary: string;
    appliedFilters: AppliedFilter[];
    metricCards: MetricCard[];
    primaryView?: ResultView;
    secondaryViews: ResultView[];
    tableRows: Array<Record<string, unknown>>;
  } {
    const rows = this.buildMockRows(compiledTask);
    const totalAmount = rows.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
    const totalCount = rows.reduce((sum, item) => sum + Number(item.count ?? 0), 0);

    return {
      summary:
        rows.length > 0
          ? `已完成 ${compiledTask.taskTitle} 查询，命中 ${rows.length} 个结果分组。`
          : '当前任务在授权范围内未命中数据。',
      appliedFilters: [
        { label: '时间口径', value: this.resolveTemporalFilterLabel(compiledTask) },
        { label: '数据来源', value: '本地样例数据' },
      ],
      metricCards: this.buildMetricCards(compiledTask, totalAmount, totalCount, rows.length),
      primaryView: this.buildPrimaryView(compiledTask, rows),
      secondaryViews: rows.length
        ? [
            {
              viewType: 'RANKING_TABLE',
              title: `${compiledTask.taskTitle}明细`,
              rows,
            },
          ]
        : [],
      tableRows: rows,
    };
  }

  private buildMetricCards(
    compiledTask: CompiledQueryTask,
    totalAmount: number,
    totalCount: number,
    rowLength: number,
  ): MetricCard[] {
    const metrics: MetricCard[] = [
      { name: this.resolveRecordMetricLabel(compiledTask), value: totalCount },
    ];
    if (compiledTask.resultKind !== 'metric-summary') {
      metrics.push({ name: '分组数量', value: rowLength });
    }

    if (totalAmount > 0) {
      metrics.unshift({
        name: this.resolveAmountMetricLabel(compiledTask),
        value: compiledTask.resultKind === 'metric-summary'
          ? this.formatYuanAmount(totalAmount)
          : formatWanAmount(totalAmount),
      });
    }

    return metrics;
  }

  private resolveAmountMetricLabel(compiledTask: CompiledQueryTask): string {
    if (compiledTask.plan.domain === 'contract-conversion') {
      return compiledTask.resultKind === 'metric-summary' ? '合同金额' : '转合同金额';
    }

    return '累计金额';
  }

  /**
   * 按业务域返回底层命中记录的明确口径名称。
   *
   * 参数说明：`compiledTask` 为当前执行任务。
   * 返回值：用户可直接理解的业务记录名，避免把分组结果误读成“页面行数”。
   */
  private resolveRecordMetricLabel(compiledTask: CompiledQueryTask): string {
    if (compiledTask.plan.domain === 'contract-conversion') {
      return '命中合同数';
    }

    if (compiledTask.plan.domain === 'customer-relationship') {
      return '命中客户数';
    }

    return '命中商机数';
  }

  private buildPrimaryView(
    compiledTask: CompiledQueryTask,
    rows: Array<Record<string, unknown>>,
  ): ResultView | undefined {
    if (!rows.length) {
      return undefined;
    }

    if (compiledTask.resultKind === 'metric-summary') {
      return undefined;
    }

    return {
      viewType: compiledTask.resultKind === 'time-trend' ? 'LINE_CHART' : 'BAR_CHART',
      title: compiledTask.taskTitle,
      series: rows.map((item) => ({
        label: item.ownerName ?? item.bucket_label ?? item.category ?? '未命名分组',
        value: item.amount ?? item.count ?? 0,
      })),
    };
  }

  private buildMockRows(
    compiledTask: CompiledQueryTask,
  ): Array<Record<string, unknown>> {
    if (compiledTask.plan.domain === 'contract-conversion') {
      return this.buildContractMockRows(compiledTask);
    }

    if (compiledTask.plan.domain === 'customer-relationship') {
      return this.buildCustomerMockRows(compiledTask);
    }

    return this.buildOpportunityMockRows(compiledTask);
  }

  private buildOpportunityMockRows(
    compiledTask: CompiledQueryTask,
  ): Array<Record<string, unknown>> {
    const rows = this.crmReadonlyService
      .listOpportunities()
      .filter((item) =>
        this.matchesPlanFilters(
          item.createdAt,
          item.organizationId,
          item.departmentId,
          item.ownerId,
          compiledTask.plan.filters,
        ),
      );

    if (compiledTask.resultKind === 'time-trend') {
      return this.aggregateTimeRows(
        rows.map((item) => ({ bucketAt: item.createdAt, amount: item.expectAmount })),
      );
    }

    if (compiledTask.resultKind === 'stage-distribution') {
      const stageMap = new Map<string, { amount: number; count: number }>();
      for (const item of rows) {
        const current = stageMap.get(item.stage) ?? { amount: 0, count: 0 };
        current.amount += item.expectAmount;
        current.count += 1;
        stageMap.set(item.stage, current);
      }

      return [...stageMap.entries()]
        .map(([bucketLabel, value]) => ({
          bucket_label: bucketLabel,
          ownerName: bucketLabel,
          amount: value.amount,
          count: value.count,
        }))
        .sort((left, right) => Number(right.amount) - Number(left.amount));
    }

    if (compiledTask.resultKind === 'department-contribution') {
      const departmentMap = new Map<string, { amount: number; count: number }>();
      for (const item of rows) {
        const current = departmentMap.get(item.departmentId) ?? { amount: 0, count: 0 };
        current.amount += item.expectAmount;
        current.count += 1;
        departmentMap.set(item.departmentId, current);
      }

      return [...departmentMap.entries()]
        .map(([bucketLabel, value]) => ({
          bucket_label: bucketLabel,
          ownerName: this.resolveDepartmentLabel(bucketLabel),
          amount: value.amount,
          count: value.count,
        }))
        .sort((left, right) => Number(right.amount) - Number(left.amount));
    }

    if (compiledTask.resultKind === 'risk-overview') {
      return this.aggregateRankingRows(
        rows.filter((item) => ['初访', '方案', '谈判'].includes(item.stage)),
      );
    }

    return this.aggregateRankingRows(rows);
  }

  private buildContractMockRows(
    compiledTask: CompiledQueryTask,
  ): Array<Record<string, unknown>> {
    const rows = this.crmReadonlyService
      .listContracts()
      .filter((item) =>
        this.matchesPlanFilters(
          item.signDate,
          item.organizationId,
          item.departmentId,
          item.ownerId,
          compiledTask.plan.filters,
        ),
      );

    if (compiledTask.resultKind === 'time-trend') {
      return this.aggregateTimeRows(
        rows.map((item) => ({ bucketAt: item.signDate, amount: item.totalAmount })),
      );
    }

    if (compiledTask.resultKind === 'metric-summary') {
      return [
        {
          ownerId: 'summary',
          ownerName: '合同金额总览',
          amount: rows.reduce((sum, item) => sum + item.totalAmount, 0),
          count: rows.length,
        },
      ];
    }

    const rankingMap = new Map<string, { ownerName: string; amount: number; count: number }>();
    for (const item of rows) {
      const current = rankingMap.get(item.ownerId) ?? {
        ownerName: item.ownerName,
        amount: 0,
        count: 0,
      };
      current.amount += item.totalAmount;
      current.count += 1;
      rankingMap.set(item.ownerId, current);
    }

    return [...rankingMap.entries()]
      .map(([ownerId, value]) => ({
        ownerId,
        ownerName: value.ownerName,
        amount: value.amount,
        count: value.count,
      }))
      .sort((left, right) => Number(right.amount) - Number(left.amount));
  }

  private buildCustomerMockRows(
    compiledTask: CompiledQueryTask,
  ): Array<Record<string, unknown>> {
    const rows = this.crmReadonlyService
      .listCustomers()
      .filter((item) =>
        this.matchesPlanFilters(
          item.createdAt,
          item.organizationId,
          item.departmentId,
          item.ownerId,
          compiledTask.plan.filters,
        ),
      );

    const categoryMap = new Map<string, number>();
    for (const item of rows) {
      categoryMap.set(item.category, (categoryMap.get(item.category) ?? 0) + 1);
    }

    return [...categoryMap.entries()]
      .map(([bucketLabel, count]) => ({
        category: bucketLabel,
        bucket_label: bucketLabel,
        ownerName: bucketLabel,
        count,
      }))
      .sort((left, right) => Number(right.count) - Number(left.count));
  }

  private aggregateRankingRows(
    rows: CrmOpportunity[],
  ): Array<Record<string, unknown>> {
    const rankingMap = new Map<string, { ownerName: string; amount: number; count: number }>();
    rows.forEach((item) => {
      const current = rankingMap.get(item.ownerId) ?? {
        ownerName: item.ownerName,
        amount: 0,
        count: 0,
      };
      current.amount += item.expectAmount;
      current.count += 1;
      rankingMap.set(item.ownerId, current);
    });

    return [...rankingMap.entries()]
      .map(([ownerId, value]) => ({
        ownerId,
        ownerName: value.ownerName,
        amount: value.amount,
        count: value.count,
      }))
      .sort((left, right) => Number(right.amount) - Number(left.amount));
  }

  private aggregateTimeRows(
    rows: Array<{ bucketAt: string; amount: number }>,
  ): Array<Record<string, unknown>> {
    const timeMap = new Map<string, { amount: number; count: number }>();
    for (const item of rows) {
      const bucketLabel = item.bucketAt.slice(0, 7);
      const current = timeMap.get(bucketLabel) ?? { amount: 0, count: 0 };
      current.amount += item.amount;
      current.count += 1;
      timeMap.set(bucketLabel, current);
    }

    return [...timeMap.entries()]
      .map(([bucketLabel, value]) => ({
        bucket_label: bucketLabel,
        ownerName: bucketLabel,
        amount: value.amount,
        count: value.count,
      }))
      .sort((left, right) =>
        String(left.bucket_label).localeCompare(String(right.bucket_label)),
      );
  }

  private resolveDepartmentLabel(departmentId: string): string {
    return this.departmentNameMap[departmentId] ?? departmentId;
  }

  private resolveLiveRowLabel(
    compiledTask: CompiledQueryTask,
    row: Record<string, unknown>,
    stageLabelMap: Record<string, string>,
  ): string {
    if (compiledTask.resultKind === 'metric-summary') {
      return '合同金额总览';
    }

    if (compiledTask.resultKind === 'stage-distribution') {
      const stageCode = String(row.bucket_label ?? '').trim();
      if (!stageCode) {
        return '未填写阶段';
      }

      return stageLabelMap[stageCode] ?? stageCode;
    }

    if (compiledTask.resultKind === 'department-contribution') {
      const departmentName = String(row.department_name ?? '').trim();
      if (departmentName) {
        return departmentName;
      }

      return this.resolveDepartmentLabel(String(row.department_id ?? row.bucket_label ?? '').trim());
    }

    if (compiledTask.resultKind === 'partner-contribution') {
      return String(row.partner_name ?? row.partnerName ?? row.partner_id ?? '未填写渠道商').trim();
    }

    return String(
      row.owner_name ??
        row.bucket_label ??
        row.category ??
        '未命名分组',
    );
  }

  private formatYuanAmount(value: number): string {
    return value.toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  private normalizeStringList(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item): item is string | number => item !== null && item !== undefined)
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  private matchesPlanFilters(
    createdAt: string | undefined,
    organizationId: string,
    departmentId: string,
    ownerId: string,
    filters: Record<string, unknown>,
  ): boolean {
    const organizationIds = Array.isArray(filters.organizationIds)
      ? filters.organizationIds.map(String)
      : [];
    const departmentIds = Array.isArray(filters.departmentIds)
      ? filters.departmentIds.map(String)
      : [];
    const ownerIds = Array.isArray(filters.ownerIds) ? filters.ownerIds.map(String) : [];
    const startAt = typeof filters.startAt === 'string' ? filters.startAt : undefined;
    const endAt = typeof filters.endAt === 'string' ? filters.endAt : undefined;

    if (organizationIds.length > 0 && !organizationIds.includes(organizationId)) {
      return false;
    }

    if (departmentIds.length > 0 && !departmentIds.includes(departmentId)) {
      return false;
    }

    if (ownerIds.length > 0 && !ownerIds.includes(ownerId)) {
      return false;
    }

    if (startAt && createdAt && createdAt < startAt) {
      return false;
    }

    if (endAt && createdAt && createdAt >= endAt) {
      return false;
    }

    return true;
  }

  /**
   * 读取编译计划中已锁定的时间口径。
   *
   * 参数说明：`compiledTask` 是当前执行的受控查询任务。
   * 返回值：展示给结果包和用户的时间口径标签。
   * 调用注意：不得在这里重新解析自然语言问题，避免渠道侧产生新的时间范围。
   */
  private resolveTemporalFilterLabel(compiledTask: CompiledQueryTask): string {
    return String(
      compiledTask.plan.temporalSlot?.normalizedLabel ??
        compiledTask.plan.filters.timeRange ??
        '未声明时间口径',
    );
  }
}

import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type {
  AnalysisIntent,
  AnalysisDatasetSlice,
  AppliedFilter,
  CrmUser,
  MetricCard,
  QueryPlanAst,
  QueryPlanResultKind,
  ResultView,
} from '../../shared/types/domain';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';
import { formatWanAmount } from '../../shared/utils/business-amount.util';
import { buildEntityId } from '../../shared/utils/id.util';
import { LianruanCrmOpenApiAdapterService } from '../crm-standard-api/lianruan-crm-openapi.adapter.service';
import { LianruanCrmQueryAdapterService } from '../crm-standard-api/lianruan-crm-query-adapter.service';
import type { LianruanCrmOpenApiBoundUser } from '../crm-standard-api/lianruan-crm-openapi.types';
import type {
  LianruanCrmOpenApiDictionaries,
  LianruanCrmOpenApiDictionaryItem,
  LianruanCrmOpenApiAnalyticsQuery,
  LianruanCrmOpenApiCustomerLifecycleAnalytics,
  LianruanCrmOpenApiCustomerUnregisteredOpportunityAnalytics,
  LianruanCrmOpenApiListQuery,
  LianruanCrmOpenApiPageResult,
  LianruanCrmOpenApiPartnerContributionRecord,
  LianruanCrmOpenApiPartnerProfileAnalytics,
  LianruanCrmOpenApiPartnerProfileBucket,
  LianruanCrmOpenApiResource,
} from '../crm-standard-api/lianruan-crm-openapi.types';
import {
  OfficialApiAnalyticsUnavailableError,
  OfficialApiFallbackToSqlError,
  RealDataUnavailableError,
} from './analysis.errors';
import type { RoutedCompiledQueryTask } from './analysis-read-tool.registry';
import { buildResultTemporalScope } from './temporal-scope.util';
import {
  buildStaleOpportunityAnalysisTitle,
  buildStaleOpportunityDetailTitle,
  buildStaleOpportunityRiskScopeText,
  buildStaleOpportunitySortScopeText,
  isStaleOpportunityQuestionText,
  resolveStaleOpportunityThreshold,
} from './stale-opportunity-threshold.util';
import { formatOpportunityStageLabel } from './opportunity-stage-label.util';
import { OpenApiMarkdownSnapshotService } from './openapi-markdown-snapshot.service';

export type StandardApiRecord = Record<string, unknown>;
type BusinessChainSnapshotResource = 'partners' | 'registrations' | 'opportunities' | 'quotes' | 'orders';
type BusinessChainSecondaryViewKey =
  | 'opportunity-quarter-comparison'
  | 'opportunity-region-quarter-matrix'
  | 'big-region-comparison'
  | 'region-comparison'
  | 'partner-contribution'
  | 'sales-contribution'
  | 'order-fulfillment-comparison'
  | 'distribution-hierarchy'
  | 'technical-service-ecosystem'
  | 'partner-detail'
  | 'registration-detail'
  | 'opportunity-stage'
  | 'opportunity-detail'
  | 'quote-detail'
  | 'order-detail';

interface StandardApiAggregateRow extends Record<string, unknown> {
  ownerId: string;
  ownerName: string;
  amount: number;
  count: number;
  bucket_label?: string;
  region?: string;
  stage?: string;
  partnerId?: string;
  partnerName?: string;
}

interface StandardApiTaskConfig {
  resource: LianruanCrmOpenApiResource;
  subjectLabel: string;
  amountMetricLabel: string;
  countMetricLabel: string;
  dictionaryKey?: keyof LianruanCrmOpenApiDictionaries;
}

interface StandardApiTaskResult {
  summary: string;
  appliedFilters: AppliedFilter[];
  metricCards: MetricCard[];
  primaryView?: ResultView;
  secondaryViews: ResultView[];
  tableRows: Array<Record<string, unknown>>;
}

interface StandardApiExecutionPolicy {
  mode: 'bound-user' | 'service-client-with-local-scope';
  requiresLocalScopeEnforcement: boolean;
  boundUserId: string;
  currentUserId: string;
  boundUserRole: string;
}

interface BusinessChainRegionConstraint {
  region?: string;
  bigRegion?: string;
  tokens: string[];
  label?: string;
}

interface BusinessChainPartnerScope {
  ids: Set<string>;
  names: Set<string>;
}

interface BusinessChainPartnerEntityConstraint {
  label: string;
  partners: StandardApiRecord[];
  scope: BusinessChainPartnerScope;
}

interface QuestionEntityNameConstraint {
  label: string;
  aliases: Set<string>;
}

interface BusinessChainPartnerMeta {
  partnerId: string;
  partnerName: string;
  partnerLevel: string;
  partnerType: string;
  technicalServiceProviderType: string;
  isTechnicalServiceProvider: boolean;
  parentPartnerId: string;
  parentPartnerIds: string;
  region: string;
  bigRegion: string;
}

interface PartnerContributionAnalyticsDecision {
  slice?: AnalysisDatasetSlice;
  listAggregationNote?: string;
}

export interface LianruanCrmOpenApiBusinessChainSnapshot {
  sql: string;
  scopeSummary: string;
  partners: StandardApiRecord[];
  registrations: StandardApiRecord[];
  opportunities: StandardApiRecord[];
  quotes: StandardApiRecord[];
  orders: StandardApiRecord[];
}

const OPPORTUNITY_SUPPORTED_RESULT_KINDS: ReadonlySet<QueryPlanResultKind> =
  new Set([
    'metric-summary',
    'owner-ranking',
    'time-trend',
    'stage-distribution',
    'department-contribution',
    'partner-contribution',
    'risk-overview',
  ]);

const GENERIC_SUPPORTED_RESULT_KINDS: ReadonlySet<QueryPlanResultKind> =
  new Set([
    'metric-summary',
    'owner-ranking',
    'time-trend',
    'category-distribution',
    'department-contribution',
    'partner-contribution',
  ]);

const COMMON_CHINA_REGION_KEYWORDS = [
  '大北区',
  '大东区',
  '大南区',
  '大西区',
  '大北',
  '大东',
  '大南',
  '大西',
  '北区',
  '北京',
  '天津',
  '河北',
  '山西',
  '内蒙古',
  '辽宁',
  '吉林',
  '黑龙江',
  '上海',
  '江苏',
  '浙江',
  '安徽',
  '福建',
  '江西',
  '山东',
  '河南',
  '湖北',
  '湖南',
  '广东',
  '广西',
  '海南',
  '重庆',
  '四川',
  '贵州',
  '云南',
  '西藏',
  '陕西',
  '甘肃',
  '青海',
  '宁夏',
  '新疆',
  '台湾',
  '香港',
  '澳门',
] as const;

const RISK_STAGE_KEYS = new Set([
  'contacted',
  'qualified',
  'proposal',
  'negotiation',
  '初访',
  '方案',
  '谈判',
]);

const LIANRUAN_FALLBACK_BUSINESS_LABELS: Record<string, string> = {
  registered: formatOpportunityStageLabel('registered'),
  reported: formatOpportunityStageLabel('registered'),
  submitted: '已提交',
  pending: '待审批',
  approving: '审批中',
  approved: '已通过',
  rejected: '已驳回',
  cancelled: '已取消',
  canceled: '已取消',
  active: '启用',
  inactive: '停用',
  enabled: '启用',
  disabled: '停用',
  contacted: formatOpportunityStageLabel('contacted'),
  qualified: formatOpportunityStageLabel('qualified'),
  proposal: formatOpportunityStageLabel('proposal'),
  negotiation: formatOpportunityStageLabel('negotiation'),
  won: formatOpportunityStageLabel('won'),
  lost: formatOpportunityStageLabel('lost'),
  draft: '草稿',
  quoted: formatOpportunityStageLabel('quoted'),
  ordered: '已下单',
  signed: '已签约',
};

@Injectable()
export class LianruanCrmAnalysisExecutorService {
  private readonly logger = new Logger('CRMLianruanExecutor');
  private readonly listPageSize = 200;
  private readonly maxPageCount = 50;
  private readonly maxRecordCount = this.listPageSize * this.maxPageCount;

  constructor(
    private readonly lianruanCrmOpenApiAdapterService: LianruanCrmOpenApiAdapterService,
    private readonly lianruanCrmQueryAdapterService: LianruanCrmQueryAdapterService,
    @Optional()
    @Inject(LocalRuntimeConfigService)
    private readonly localRuntimeConfigService?: LocalRuntimeConfigService,
    @Optional()
    @Inject(OpenApiMarkdownSnapshotService)
    private readonly openApiMarkdownSnapshotService?: OpenApiMarkdownSnapshotService,
  ) {}

  /**
   * 获取正式分析主链的 Markdown 快照服务。
   *
   * 参数说明：无。
   * 返回值说明：返回已注入的 OpenAPI Markdown 快照服务。
   * 可能抛出的异常：服务未注入时抛出真实数据不可用错误。
   * 调用注意事项：正式问答阶段只能读取本地 Markdown 快照；OpenAPI 实时请求只允许出现在快照刷新链。
   */
  private requireOpenApiMarkdownSnapshotService(): OpenApiMarkdownSnapshotService {
    if (!this.openApiMarkdownSnapshotService) {
      throw new RealDataUnavailableError(
        '当前正式分析只启用 OpenAPI Markdown 快照主链，请先启用快照服务并刷新本地 Markdown 数据文件。',
      );
    }

    return this.openApiMarkdownSnapshotService;
  }

  /**
   * 通过 OpenAPI Markdown 快照执行智能分析任务。
   *
   * 参数说明：
   * - `questionText`：用户原始问题，用于识别订单/报价/报备等渠道 CRM 语义；
   * - `user`：当前登录用户，用于校验标准 API 绑定账号，防止使用超管 client 给普通用户扩权；
   * - `scopeSummary`：当前权限范围摘要，用于结果页明确提示；
   * - `compiledTask`：已完成规划、编译与路由的分析任务。
   * 返回值说明：返回统一数据切片，供既有报告生成和页面展示链路继续复用。
   * 可能抛出的异常：快照未生成、明细缺失、数据量超过安全聚合上限或任务不支持时抛出业务异常。
   * 调用注意事项：该方法保持原有出参结构，但问答阶段不实时调用 OpenAPI；OpenAPI 只用于刷新 Markdown 文件。
   */
  async executeTask(
    questionText: string,
    user: CrmUser,
    scopeSummary: string,
    compiledTask: RoutedCompiledQueryTask,
  ): Promise<AnalysisDatasetSlice> {
    this.logger.debug('OpenAPI执行开始', {
      resultKind: compiledTask.resultKind,
      matchedAdapter: compiledTask.matchedAdapter,
      purpose: compiledTask.purpose,
      userId: user.id,
    });
    const taskConfig = this.resolveTaskConfig(questionText, compiledTask);
    if (!taskConfig) {
      this.logger.warn('OpenAPI执行：任务主题不支持', {
        resultKind: compiledTask.resultKind,
        matchedAdapter: compiledTask.matchedAdapter,
      });
      throw new RealDataUnavailableError(
        '当前标准 OpenAPI 分析暂不支持该主题或结果形态，请先使用商机、客户报备、报价、订单等已接入主题。',
      );
    }

    this.requireOpenApiMarkdownSnapshotService();
    const executionPolicy = this.resolveMarkdownSnapshotExecutionPolicy(user);
    const executionScopeSummary = this.buildMarkdownSnapshotScopeSummary(scopeSummary);
    const dictionaries: LianruanCrmOpenApiDictionaries = {};

    if (
      compiledTask.resultKind === 'partner-contribution' &&
      this.isPartnerProfileTask(questionText, compiledTask)
    ) {
      this.logger.debug('OpenAPI执行：进入合作伙伴画像分支', { sourceResource: 'partners' });
      return await this.executePartnerProfileTask(
        questionText,
        compiledTask,
        user,
        executionScopeSummary,
        dictionaries,
        executionPolicy,
      );
    }

    const openApiListAggregationNote: string | undefined = undefined;

    const records = await this.listAllRecords(taskConfig, compiledTask);
    const filteredRecords = this.applyLocalFilters(
      questionText,
      taskConfig,
      compiledTask,
      records,
      user,
      executionPolicy,
    );
    this.logger.log('OpenAPI取数完成', {
      sourceResource: taskConfig.resource,
      rawCount: records.length,
      filteredCount: filteredRecords.length,
      resultKind: compiledTask.resultKind,
    });
    const emptyResultHint =
      filteredRecords.length === 0
        ? await this.buildEmptyResultHint(
            questionText,
            taskConfig,
            compiledTask,
            records,
            user,
            executionPolicy,
          )
        : undefined;
    const partnerNameMap =
      compiledTask.resultKind === 'partner-contribution'
        ? await this.buildPartnerNameMap(filteredRecords)
        : new Map<string, string>();
    const result = this.buildTaskResult(
      questionText,
      taskConfig,
      compiledTask,
      executionScopeSummary,
      filteredRecords,
      dictionaries,
      partnerNameMap,
      emptyResultHint,
      openApiListAggregationNote,
    );
    const displayTaskTitle = this.resolveRiskAwareTaskTitle(
      questionText,
      taskConfig,
      compiledTask,
    );

    return {
      datasetId: buildEntityId('dataset'),
      taskId: compiledTask.taskId,
      taskTitle: displayTaskTitle,
      resultKind: compiledTask.resultKind,
      purpose: compiledTask.purpose,
      sql: this.buildApiExecutionSummary(
        compiledTask,
        taskConfig,
        openApiListAggregationNote,
      ),
      executionMode: compiledTask.executionMode,
      executionSource: 'OPENAPI_MARKDOWN_SNAPSHOT',
      matchedAdapter: `openapi-markdown-snapshot.${taskConfig.resource}`,
      gapReason: compiledTask.gapReason,
      summary: result.summary,
      temporalScope: buildResultTemporalScope(compiledTask.plan.temporalSlot),
      appliedFilters: result.appliedFilters,
      metricCards: result.metricCards,
      primaryView: result.primaryView,
      secondaryViews: result.secondaryViews,
      tableRows: result.tableRows,
      rowCount: result.tableRows.length,
    };
  }

  /**
   * 为正式 Markdown 快照主链提供停滞商机明细。
   *
   * 参数说明：`questionText` 为用户原始问题，`user` 为当前 CRM 用户，`scopeSummary` 为上游权限摘要。
   * 返回值说明：返回本地 Markdown 快照范围内的停滞商机明细切片。
   * 可能抛出的异常：快照未刷新、明细缺失或结果超过本地聚合上限时抛出。
   * 调用注意事项：该方法复用 `executeTask` 主链路，不在问答阶段实时请求 OpenAPI。
   */
  async executeStaleOpportunityDetailTask(
    questionText: string,
    user: CrmUser,
    scopeSummary: string,
  ): Promise<AnalysisDatasetSlice> {
    return await this.executeTask(
      questionText,
      user,
      scopeSummary,
      this.buildStaleOpportunityDetailTask(questionText),
    );
  }

  /**
   * 读取本地 OpenAPI Markdown 业务链真实快照。
   *
   * 参数说明：
   * - `questionText`：用户原始问题，用于复用区域词和本地收窄逻辑；
   * - `user`：当前 CRM 用户，用于绑定账号校验和服务账号本地权限裁剪；
   * - `scopeSummary`：上游权限摘要，用于结果说明；
   * - `temporalSlot`：本次模板的时间口径，缺失时读取当前授权全量。
   * 返回值说明：返回本地 Markdown 快照中的渠道商、客户报备、商机和订单真实记录。
   * 可能抛出的异常：快照服务未启用、快照未刷新或明细文件缺失时抛出。
   * 调用注意事项：正式问答阶段不实时调用 OpenAPI；OpenAPI 只用于刷新 Markdown 文件。
   */
  async fetchBusinessChainSnapshot(params: {
    questionText: string;
    user: CrmUser;
    scopeSummary: string;
    temporalSlot?: AnalysisIntent['temporalSlot'];
    resources?: BusinessChainSnapshotResource[];
  }): Promise<LianruanCrmOpenApiBusinessChainSnapshot> {
    this.requireOpenApiMarkdownSnapshotService();
    return this.fetchBusinessChainSnapshotFromMarkdown(params);
  }

  /**
   * 从本地 OpenAPI Markdown 快照读取组合经营明细。
   *
   * 参数说明：同 `fetchBusinessChainSnapshot`。
   * 返回值说明：返回与原 OpenAPI 临时快照相同结构的数据，供后续聚合逻辑复用。
   * 调用注意事项：该方法不触发 OpenAPI；若快照缺失应直接报错，提示先刷新快照。
   */
  private fetchBusinessChainSnapshotFromMarkdown(params: {
    questionText: string;
    user: CrmUser;
    scopeSummary: string;
    temporalSlot?: AnalysisIntent['temporalSlot'];
    resources?: BusinessChainSnapshotResource[];
  }): LianruanCrmOpenApiBusinessChainSnapshot {
    if (!this.openApiMarkdownSnapshotService) {
      throw new RealDataUnavailableError('OpenAPI Markdown 快照服务未注入，无法从本地文件分析。');
    }

    const requestedResources = params.resources ?? [
      'partners',
      'registrations',
      'opportunities',
      'quotes',
      'orders',
    ];
    const markdownSnapshot = this.openApiMarkdownSnapshotService.readBusinessChainSnapshot({
      resources: requestedResources,
    });
    const partnerEntityConstraint = this.resolveBusinessChainPartnerEntityConstraint(
      params.questionText,
      markdownSnapshot.partners,
    );
    const regionConstraint = partnerEntityConstraint
      ? undefined
      : this.resolveBusinessChainRegionConstraint(params.questionText, {});
    const usePartnerRegionScope = this.shouldUsePartnerRegionScope(
      params.questionText,
      requestedResources,
      regionConstraint,
    );
    const result: LianruanCrmOpenApiBusinessChainSnapshot = {
      sql: this.buildBusinessChainMarkdownSnapshotExecutionSummary(
        requestedResources,
        params.temporalSlot,
        regionConstraint,
        markdownSnapshot.generatedAt,
        partnerEntityConstraint?.label,
      ),
      scopeSummary: `${params.scopeSummary}；${markdownSnapshot.scopeSummary}`,
      partners: [],
      registrations: [],
      opportunities: [],
      quotes: [],
      orders: [],
    };

    let partnerScope: BusinessChainPartnerScope | undefined;
    if (partnerEntityConstraint) {
      partnerScope = partnerEntityConstraint.scope;
      if (requestedResources.includes('partners')) {
        result.partners = this.enrichBusinessChainRecords(
          'partners',
          partnerEntityConstraint.partners,
          {},
        );
      }
    } else if (usePartnerRegionScope && requestedResources.includes('partners')) {
      const filteredPartners = this.filterMarkdownBusinessChainResource({
        questionText: params.questionText,
        resource: 'partners',
        records: markdownSnapshot.partners,
        user: params.user,
        temporalSlot: params.temporalSlot,
        regionConstraint,
        skipQuestionRegion: false,
      });
      result.partners = this.enrichBusinessChainRecords('partners', filteredPartners, {});
      partnerScope = this.buildBusinessChainPartnerScope(result.partners);
    }

    for (const resource of requestedResources) {
      if ((partnerEntityConstraint || usePartnerRegionScope) && resource === 'partners') {
        continue;
      }

      const filteredRecords = this.filterMarkdownBusinessChainResource({
        questionText: params.questionText,
        resource,
        records: markdownSnapshot[resource],
        user: params.user,
        temporalSlot: params.temporalSlot,
        regionConstraint,
        skipQuestionRegion: Boolean(partnerEntityConstraint) || usePartnerRegionScope,
      });
      const scopedRecords =
        (partnerEntityConstraint || usePartnerRegionScope) && resource !== 'partners'
          ? filteredRecords.filter((record) =>
              this.recordMatchesBusinessChainPartnerScope(record, partnerScope),
            )
          : filteredRecords;
      result[resource] = this.enrichBusinessChainRecords(resource, scopedRecords, {});
    }

    return result;
  }

  /**
   * 过滤 Markdown 快照中的业务链资源。
   *
   * 参数说明：包含用户问题、资源名、原始记录、当前用户、时间口径、区域约束和是否跳过区域词筛选。
   * 返回值说明：返回已按时间、权限和必要区域口径收窄后的记录。
   * 调用注意事项：渠道商区域主口径下，非渠道商资源会跳过区域词筛选，后续改由渠道商集合关联过滤。
   */
  private filterMarkdownBusinessChainResource(params: {
    questionText: string;
    resource: BusinessChainSnapshotResource;
    records: StandardApiRecord[];
    user: CrmUser;
    temporalSlot?: AnalysisIntent['temporalSlot'];
    regionConstraint?: BusinessChainRegionConstraint;
    skipQuestionRegion: boolean;
  }): StandardApiRecord[] {
    const taskConfig = this.buildBusinessChainTaskConfig(params.resource);
    const task = this.buildBusinessChainListTask(
      params.resource,
      params.temporalSlot,
      params.regionConstraint,
    );
    return this.applyLocalFilters(
      params.questionText,
      taskConfig,
      task,
      params.records,
      params.user,
      this.resolveMarkdownSnapshotExecutionPolicy(params.user),
      params.regionConstraint,
      { skipQuestionRegion: params.skipQuestionRegion },
    );
  }

  /**
   * 通过本地 OpenAPI Markdown 快照执行组合经营主链。
   *
   * 参数说明：
   * - `questionText/user/scopeSummary`：用户原问题、当前 CRM 用户和权限摘要；
   * - `temporalSlot/resources`：时间口径与需要读取的业务对象；
   * - `taskId/taskTitle`：编排层用于审计和报告展示的主任务标识。
   * 返回值说明：返回一个正式 `AnalysisDatasetSlice`，包含区块汇总、渠道商贡献汇总和各对象真实明细。
   * 可能抛出的异常：快照服务未启用、明细文件缺失或本地聚合校验失败时抛出。
   * 调用注意事项：该方法是正式 Markdown 快照主链能力，不依赖 SQLite/MySQL 分析库，也不实时调用 OpenAPI。
   */
  async executeBusinessChainSnapshotTask(params: {
    questionText: string;
    user: CrmUser;
    scopeSummary: string;
    temporalSlot?: AnalysisIntent['temporalSlot'];
    resources?: BusinessChainSnapshotResource[];
    taskId?: string;
    taskTitle?: string;
  }): Promise<AnalysisDatasetSlice> {
    const effectiveTemporalSlot = params.temporalSlot ??
      this.resolveBusinessChainQuarterComparisonSlot(params.questionText);
    const snapshot = await this.fetchBusinessChainSnapshot({
      questionText: params.questionText,
      user: params.user,
      scopeSummary: params.scopeSummary,
      temporalSlot: effectiveTemporalSlot,
      resources: params.resources,
    });
    const resources = params.resources ?? [
      'partners',
      'registrations',
      'opportunities',
      'quotes',
      'orders',
    ];
    const summaryRows = this.buildBusinessChainSummaryRows(snapshot, resources);
    const partnerContributionRows = this.buildBusinessChainPartnerContributionRows(snapshot);
    const bigRegionComparisonRows = this.buildBusinessChainBigRegionComparisonRows(snapshot);
    const regionComparisonRows = this.buildBusinessChainRegionComparisonRows(snapshot);
    const salesContributionRows = this.buildBusinessChainSalesContributionRows(snapshot);
    const orderFulfillmentRows = this.buildBusinessChainOrderFulfillmentRows(snapshot);
    const distributionHierarchyRows = this.buildBusinessChainDistributionHierarchyRows(snapshot);
    const technicalServiceRows = this.buildBusinessChainTechnicalServiceRows(snapshot);
    const opportunityQuarterComparisonRows = resources.includes('opportunities')
      ? this.buildBusinessChainOpportunityQuarterComparisonRows(snapshot.opportunities, effectiveTemporalSlot)
      : [];
    const opportunityRegionQuarterRows = resources.includes('opportunities')
      ? this.buildBusinessChainOpportunityRegionQuarterRows(snapshot, effectiveTemporalSlot, params.questionText)
      : [];
    const partnerRows = resources.includes('partners')
      ? this.buildBusinessChainPartnerDetailRows(snapshot.partners)
      : [];
    const registrationRows = resources.includes('registrations')
      ? this.buildBusinessChainRegistrationDetailRows(snapshot.registrations)
      : [];
    const opportunityRows = resources.includes('opportunities')
      ? this.buildBusinessChainOpportunityDetailRows(snapshot.opportunities)
      : [];
    const quoteRows = resources.includes('quotes')
      ? this.buildBusinessChainQuoteDetailRows(snapshot.quotes)
      : [];
    const orderRows = resources.includes('orders')
      ? this.buildBusinessChainOrderDetailRows(snapshot.orders)
      : [];
    const opportunityStageRows = resources.includes('opportunities')
      ? this.buildBusinessChainOpportunityStageRows(opportunityRows)
      : [];
    const metricCards = this.buildBusinessChainMetricCards(snapshot, resources);
    const opportunityQuarterMetricCards =
      this.buildBusinessChainOpportunityQuarterMetricCards(opportunityQuarterComparisonRows);
    if (opportunityQuarterMetricCards.length > 0) {
      metricCards.unshift(...opportunityQuarterMetricCards);
    }
    const secondaryViews = this.buildBusinessChainSecondaryViews({
      questionText: params.questionText,
      resources,
      opportunityQuarterComparisonRows,
      opportunityRegionQuarterRows,
      bigRegionComparisonRows,
      regionComparisonRows,
      partnerContributionRows,
      salesContributionRows,
      orderFulfillmentRows,
      distributionHierarchyRows,
      technicalServiceRows,
      partnerRows,
      registrationRows,
      opportunityStageRows,
      opportunityRows,
      quoteRows,
      orderRows,
    });
    if (secondaryViews.length === 0 && summaryRows.length > 0) {
      secondaryViews.push({
        viewType: 'DETAIL_TABLE',
        title: '经营区块数据覆盖',
        rows: summaryRows.map((row) => ({ ...row })),
      });
    }
    const taskTitle = params.taskTitle ?? '合作伙伴开拓、客户报备、商机与订单经营分析';
    const partnerEntityLabel = this.resolveRequestedBusinessChainPartnerLabel(
      params.questionText,
      snapshot.partners,
    );
    const regionFilterLabel = this.resolveRequestedRegionLabel(params.questionText, [
      ...snapshot.partners,
      ...snapshot.registrations,
      ...snapshot.opportunities,
      ...snapshot.quotes,
      ...snapshot.orders,
    ]);
    const useOpportunityQuarterPrimary =
      opportunityQuarterComparisonRows.length > 0 &&
      /(对比|比较|差异|相比|分别|季度|按季|一季度|二季度|三季度|四季度|Q[1-4])/iu.test(params.questionText);
    const primaryRows = useOpportunityQuarterPrimary
      ? opportunityQuarterComparisonRows
      : summaryRows;
    const primaryView = useOpportunityQuarterPrimary
      ? {
          viewType: 'LINE_CHART' as const,
          title: '商机季度对比',
          series: opportunityQuarterComparisonRows.map((row) => ({
            label: row.quarterLabel,
            value: Number(row.opportunityAmount ?? 0) || Number(row.opportunityCount ?? 0),
          })),
        }
      : summaryRows.length
        ? {
            viewType: 'BAR_CHART' as const,
            title: '经营区块数据覆盖',
            series: summaryRows.map((row) => ({
              label: row.ownerName,
              value: row.count,
            })),
          }
        : undefined;

    return {
      datasetId: buildEntityId('dataset'),
      taskId: params.taskId ?? 'crm-openapi-business-chain-snapshot',
      taskTitle,
      resultKind: 'partner-contribution',
      purpose: 'primary-summary',
      sql: snapshot.sql,
      executionMode: 'PLAN_EXECUTION',
      executionSource: 'OPENAPI_MARKDOWN_SNAPSHOT',
      matchedAdapter: 'openapi-markdown-snapshot.business-chain',
      gapReason: '',
      summary: this.buildBusinessChainSnapshotSummary(snapshot, resources, params.questionText),
      temporalScope: buildResultTemporalScope(effectiveTemporalSlot),
      appliedFilters: [
        { label: '分析对象', value: this.formatBusinessChainResourceLabel(resources) },
        ...(partnerEntityLabel ? [{ label: '渠道商', value: partnerEntityLabel }] : []),
        ...(!partnerEntityLabel && regionFilterLabel ? [{ label: '区域', value: regionFilterLabel }] : []),
        { label: '数据来源', value: 'CRM 已同步真实明细数据' },
        { label: '权限范围', value: snapshot.scopeSummary },
        {
          label: '执行口径',
          value: '正式分析复用同一批 CRM 明细结果，不在展示层重新取数',
        },
      ],
      metricCards,
      primaryView,
      secondaryViews,
      tableRows: primaryRows,
      rowCount: primaryRows.length,
    };
  }

  /**
   * 构造停滞商机 Markdown 快照明细任务。
   *
   * 参数说明：`questionText` 用于解析“超过 N 天/月未更新”的停滞阈值。
   * 返回值说明：返回可直接交给 Markdown 快照执行主链的路由任务。
   * 调用注意事项：停滞问题按“进展更新时间”过滤，不把用户口中的“3 个月未进展”误转成创建时间窗口。
   */
  private buildStaleOpportunityDetailTask(questionText: string): RoutedCompiledQueryTask {
    const threshold = resolveStaleOpportunityThreshold(questionText);
    const fields = [
      'id',
      'name',
      'customer',
      'customerName',
      'partnerId',
      'partnerName',
      'ownerId',
      'ownerName',
      'assignedStaffId',
      'assignedStaffName',
      'stage',
      'stageName',
      'status',
      'amount',
      'region',
      'bigRegion',
      'updatedAt',
      'sourceUpdatedAt',
      'latestFollowUpAt',
      'lastProgressAt',
      'progressUpdatedAt',
    ];

    return {
      taskId: 'crm-openapi-stale-opportunity-detail',
      taskTitle: buildStaleOpportunityAnalysisTitle(threshold.label),
      purpose: 'risk-observation',
      sql: '-- 联软标准 OpenAPI /opportunities',
      params: [],
      tables: ['opportunities'],
      fieldMap: {
        opportunities: fields,
      },
      joinPaths: [],
      allowedFunctions: [],
      resultKind: 'risk-overview',
      plan: {
        type: 'query-plan',
        domain: 'opportunity-analysis',
        baseTable: 'opportunities',
        joinTables: [],
        metrics: ['商机数量', '商机金额'],
        dimensions: ['商机', '客户', '渠道商', '负责人', '销售阶段'],
        filters: {},
        groupBy: [],
        orderBy: [{ field: 'updatedAt', direction: 'ASC' }],
        resultKind: 'risk-overview',
        limit: 1000,
        confidence: 'HIGH',
      },
      rowLimit: 1000,
      timeoutMs: 5000,
      executionMode: 'GUARDED_DIRECT_QUERY',
      executionSource: 'CRM_OFFICIAL_API',
      preferredSource: 'CRM_OFFICIAL_API',
      matchedAdapter: 'crm-official-api.opportunity-stale-detail',
      gapReason: '',
      toolSpec: {
        toolId: 'crm-official-api.opportunity-stale-detail',
        toolType: 'CRM_OFFICIAL_API',
        allowedStatements: ['CRM_API_GET'],
        allowedTables: ['opportunities'],
        allowedFields: {
          opportunities: fields,
        },
        allowedFunctions: [],
        outputShape: 'DATASET_SLICE',
        rowLimit: 1000,
        timeoutMs: 5000,
      },
    };
  }

  /**
   * 构造业务链快照资源配置。
   *
   * 参数说明：`resource` 为需要从 Markdown 快照读取的 CRM 对象。
   * 返回值说明：返回该资源在本地过滤、金额读取和字典翻译中使用的业务配置。
   * 调用注意事项：该配置只服务本地快照读取和聚合，不改变通用问数路由。
   */
  private buildBusinessChainTaskConfig(
    resource: BusinessChainSnapshotResource,
  ): StandardApiTaskConfig {
    if (resource === 'partners') {
      return {
        resource,
        subjectLabel: '渠道商',
        amountMetricLabel: '渠道金额',
        countMetricLabel: '渠道商数',
        dictionaryKey: 'partnerLevels',
      };
    }

      if (resource === 'registrations') {
      return {
        resource,
        subjectLabel: '客户报备',
        amountMetricLabel: '报备金额',
        countMetricLabel: '客户报备数',
        dictionaryKey: 'registrationStatuses',
      };
    }

    if (resource === 'quotes') {
      return {
        resource,
        subjectLabel: '报价',
        amountMetricLabel: '报价金额',
        countMetricLabel: '报价数',
        dictionaryKey: 'quoteStatuses',
      };
    }

    if (resource === 'orders') {
      return {
        resource,
        subjectLabel: '订单',
        amountMetricLabel: '订单金额',
        countMetricLabel: '订单数',
        dictionaryKey: 'orderStatuses',
      };
    }

    return {
      resource,
      subjectLabel: '商机',
      amountMetricLabel: '商机金额',
      countMetricLabel: '商机数',
      dictionaryKey: 'opportunityStages',
    };
  }

  /**
   * 构造业务链快照列表任务。
   *
   * 参数说明：`resource` 为 OpenAPI 资源名，`temporalSlot` 为当前问数时间口径。
   * 返回值说明：返回可复用分页、权限裁剪和时间过滤逻辑的内部任务。
   * 调用注意事项：该任务不交给模型生成，固定声明允许字段和执行边界。
   */
  private buildBusinessChainListTask(
    resource: BusinessChainSnapshotResource,
    temporalSlot?: AnalysisIntent['temporalSlot'],
    regionConstraint?: BusinessChainRegionConstraint,
  ): RoutedCompiledQueryTask {
    const fieldsByResource: Record<typeof resource, string[]> = {
      partners: [
        'id',
        'partnerId',
        'name',
        'partnerName',
        'displayName',
        'shortName',
        'partnerLevel',
        'partnerLevelName',
        'level',
        'partnerType',
        'partnerTypeName',
        'isTechnicalServiceProvider',
        'technicalServiceProviderType',
        'isTechService',
        'techServiceType',
        'region',
        'bigRegion',
        'status',
        'joinDate',
        'quoteCount',
        'orderCount',
        'totalAmt',
        'totalAmount',
        'createdAt',
        'updatedAt',
      ],
      registrations: [
        'id',
        'registrationId',
        'customerId',
        'customerName',
        'customer',
        'partnerId',
        'partnerName',
        'assignedPartnerId',
        'assignedPartnerName',
        'opportunityId',
        'opportunityName',
        'status',
        'statusName',
        'region',
        'bigRegion',
        'ownerId',
        'ownerName',
        'assignedStaffId',
        'assignedStaffName',
        'approvedAt',
        'expireAt',
        'createdAt',
        'updatedAt',
      ],
      opportunities: [
        'id',
        'opportunityId',
        'opportunityName',
        'name',
        'title',
        'customerId',
        'customerName',
        'customer',
        'registrationId',
        'regId',
        'quoteId',
        'partnerId',
        'partnerName',
        'assignedPartnerId',
        'assignedPartnerName',
        'ownerId',
        'ownerName',
        'assignedStaffId',
        'assignedStaffName',
        'stage',
        'stageName',
        'status',
        'statusName',
        'amount',
        'opportunityAmount',
        'expectAmount',
        'expectedClose',
        'createdBy',
        'createdByName',
        'region',
        'bigRegion',
        'createdAt',
        'updatedAt',
      ],
      quotes: [
        'id',
        'quoteId',
        'quoteNo',
        'quoteName',
        'name',
        'customerId',
        'customerName',
        'customer',
        'registrationId',
        'regId',
        'opportunityId',
        'opportunityName',
        'partnerId',
        'partnerName',
        'assignedPartnerId',
        'assignedPartnerName',
        'ownerId',
        'ownerName',
        'assignedStaffId',
        'assignedStaffName',
        'status',
        'statusName',
        'amount',
        'quoteAmount',
        'total',
        'totalAmount',
        'validUntil',
        'expectedClose',
        'region',
        'bigRegion',
        'createdAt',
        'updatedAt',
      ],
      orders: [
        'id',
        'orderId',
        'orderNo',
        'orderName',
        'customerId',
        'customerName',
        'customer',
        'registrationId',
        'regId',
        'opportunityId',
        'opportunityName',
        'quoteId',
        'partnerId',
        'partnerName',
        'assignedPartnerId',
        'assignedPartnerName',
        'ownerId',
        'ownerName',
        'assignedStaffId',
        'assignedStaffName',
        'status',
        'statusName',
        'amount',
        'orderAmount',
        'total',
        'totalAmount',
        'createdBy',
        'createdByName',
        'region',
        'bigRegion',
        'dealAt',
        'completedAt',
        'createdAt',
        'updatedAt',
      ],
    };
    const domainByResource: Record<typeof resource, QueryPlanAst['domain']> = {
      partners: 'customer-relationship',
      registrations: 'customer-relationship',
      opportunities: 'opportunity-analysis',
      quotes: 'contract-conversion',
      orders: 'contract-conversion',
    };
    const resultKindByResource: Record<typeof resource, QueryPlanResultKind> = {
      partners: 'partner-contribution',
      registrations: 'category-distribution',
      opportunities: 'partner-contribution',
      quotes: 'partner-contribution',
      orders: 'partner-contribution',
    };
    const baseTableByResource: Record<typeof resource, QueryPlanAst['baseTable']> = {
      partners: 'customers',
      registrations: 'customers',
      opportunities: 'opportunities',
      quotes: 'contracts',
      orders: 'contracts',
    };
    const filters: Record<string, unknown> = {};
    if (temporalSlot?.startAt) {
      filters.startAt = temporalSlot.startAt;
    }
    if (temporalSlot?.endAt) {
      filters.endAt = temporalSlot.endAt;
    }
    if (regionConstraint?.region) {
      filters.region = regionConstraint.region;
    }
    if (regionConstraint?.bigRegion) {
      filters.bigRegion = regionConstraint.bigRegion;
    }

    const resultKind = resultKindByResource[resource];
    const fields = fieldsByResource[resource];
    return {
      taskId: `crm-openapi-business-chain-${resource}`,
      taskTitle: `联软 CRM ${this.buildBusinessChainTaskConfig(resource).subjectLabel}真实明细`,
      purpose: 'primary-summary',
      sql: `-- 联软标准 OpenAPI /${resource}`,
      params: [],
      tables: [resource],
      fieldMap: {
        [resource]: fields,
      },
      joinPaths: [],
      allowedFunctions: [],
      resultKind,
      plan: {
        type: 'query-plan',
        domain: domainByResource[resource],
        baseTable: baseTableByResource[resource],
        joinTables: resource === 'opportunities' || resource === 'quotes' || resource === 'orders' ? ['partners'] : [],
        metrics: [],
        dimensions: [],
        filters,
        groupBy: [],
        temporalSlot,
        orderBy: [{ field: resultKind === 'time-trend' ? 'createdAt' : 'updatedAt', direction: 'DESC' }],
        resultKind,
        limit: 1000,
        confidence: 'HIGH',
      },
      rowLimit: 1000,
      timeoutMs: 8000,
      executionMode: 'GUARDED_DIRECT_QUERY',
      executionSource: 'CRM_OFFICIAL_API',
      preferredSource: 'CRM_OFFICIAL_API',
      matchedAdapter: `crm-official-api.business-chain-${resource}`,
      gapReason: '',
      toolSpec: {
        toolId: `crm-official-api.business-chain-${resource}`,
        toolType: 'CRM_OFFICIAL_API',
        allowedStatements: ['CRM_API_GET'],
        allowedTables: [resource],
        allowedFields: {
          [resource]: fields,
        },
        allowedFunctions: [],
        outputShape: 'DATASET_SLICE',
        rowLimit: 1000,
        timeoutMs: 8000,
      },
    };
  }

  /**
   * 将业务链快照记录补齐展示名称。
   *
   * 参数说明：`resource` 为资源名，`records` 为 OpenAPI 原始行，`dictionaries` 为远端字典。
   * 返回值说明：返回带中文阶段/状态/等级展示字段的记录副本。
   * 调用注意事项：只做展示增强，不改变原始字段，避免影响后续字段兼容。
   */
  private enrichBusinessChainRecords(
    resource: BusinessChainSnapshotResource,
    records: StandardApiRecord[],
    dictionaries: LianruanCrmOpenApiDictionaries,
  ): StandardApiRecord[] {
    const dictionaryKeyByResource: Partial<Record<typeof resource, keyof LianruanCrmOpenApiDictionaries>> = {
      partners: 'partnerLevels',
      registrations: 'registrationStatuses',
      opportunities: 'opportunityStages',
      quotes: 'quoteStatuses',
      orders: 'orderStatuses',
    };
    const dictionaryKey = dictionaryKeyByResource[resource];
    const dictionary = dictionaryKey ? dictionaries[dictionaryKey] : undefined;
    const labelMap = new Map(
      Array.isArray(dictionary)
        ? dictionary.map((item) => [this.readText(item.value), this.readText(item.label)])
        : [],
    );

    return records.map((record) => {
      const categoryValue = this.resolveCategoryValue(resource, record);
      const categoryLabel = this.resolveBusinessLabel(categoryValue, labelMap) || categoryValue;
      if (resource === 'opportunities') {
        const rawStageValue = this.readText(record.stageName ?? record.stage ?? record.status);
        const rawStatusValue = this.readText(record.statusName ?? record.status ?? record.stage);
        const dictionaryStageLabel = rawStageValue ? labelMap.get(rawStageValue) : '';
        const dictionaryStatusLabel = rawStatusValue ? labelMap.get(rawStatusValue) : '';
        return {
          ...record,
          stageName: dictionaryStageLabel || formatOpportunityStageLabel(rawStageValue || categoryValue),
          statusName: dictionaryStatusLabel || formatOpportunityStageLabel(rawStatusValue || categoryValue),
        };
      }
      if (resource === 'partners') {
        return {
          ...record,
          partnerLevelName: this.readText(record.partnerLevelName ?? record.level) || categoryLabel,
        };
      }
      return {
        ...record,
        statusName: this.readText(record.statusName) || categoryLabel,
      };
    });
  }

  /**
   * 生成业务链快照执行摘要。
   *
   * 参数说明：`resources` 为本次实际读取资源，`temporalSlot` 为时间口径。
   * 返回值说明：返回用于报告说明和审计追踪的伪查询文本。
   * 调用注意事项：摘要只记录资源和筛选边界，不记录 token、密钥或敏感凭据。
   */
  private buildBusinessChainSnapshotExecutionSummary(
    resources: BusinessChainSnapshotResource[],
    temporalSlot?: AnalysisIntent['temporalSlot'],
    regionConstraint?: BusinessChainRegionConstraint,
  ): string {
    return [
      '-- 历史实时 OpenAPI 业务链摘要已停用',
      ...resources.map((resource) => `-- DISABLED /${resource}`),
      `-- createdAfter: ${temporalSlot?.startAt || '未限制'}`,
      `-- createdBefore: ${temporalSlot?.endAt || '未限制'}`,
      `-- region: ${regionConstraint?.region || regionConstraint?.label || '未限制'}`,
      `-- bigRegion: ${regionConstraint?.bigRegion || '未限制'}`,
      '-- 用途：历史兼容说明；正式分析请使用 Markdown 快照执行摘要。',
    ].join('\n');
  }

  /**
   * 生成 Markdown 快照业务链执行摘要。
   *
   * 参数说明：`resources` 为读取对象，`temporalSlot` 为时间口径，`regionConstraint` 为区域筛选。
   * 返回值说明：返回只读本地 Markdown 文件的伪查询摘要。
   * 调用注意事项：该摘要用于日志和审计，明确说明本次未实时调用 OpenAPI。
   */
  private buildBusinessChainMarkdownSnapshotExecutionSummary(
    resources: BusinessChainSnapshotResource[],
    temporalSlot?: AnalysisIntent['temporalSlot'],
    regionConstraint?: BusinessChainRegionConstraint,
    generatedAt?: string,
    partnerEntityLabel?: string,
  ): string {
    return [
      '-- 本地 OpenAPI Markdown 快照业务链分析',
      ...resources.map((resource) => `-- READ backend/analysis-snapshot/latest/details/${resource}.md`),
      `-- snapshotGeneratedAt: ${generatedAt || '未知'}`,
      `-- createdAfter: ${temporalSlot?.startAt || '未限制'}`,
      `-- createdBefore: ${temporalSlot?.endAt || '未限制'}`,
      `-- partner: ${partnerEntityLabel || '未限制'}`,
      `-- region: ${regionConstraint?.region || regionConstraint?.label || '未限制'}`,
      `-- bigRegion: ${regionConstraint?.bigRegion || '未限制'}`,
      '-- 用途：正式分析只读 Markdown 快照；OpenAPI 仅用于刷新快照文件。',
    ].join('\n');
  }

  /**
   * 构造业务链快照指标卡。
   *
   * 参数说明：`snapshot` 为 Markdown 快照真实明细，`resources` 为本次实际读取对象。
   * 返回值说明：返回合作伙伴、报备、商机和订单的核心指标卡。
   * 调用注意事项：金额指标只来自对应对象自己的金额字段，避免订单金额和商机金额互相串口径。
   */
  private buildBusinessChainMetricCards(
    snapshot: LianruanCrmOpenApiBusinessChainSnapshot,
    resources: BusinessChainSnapshotResource[],
  ): MetricCard[] {
    const metrics: MetricCard[] = [];
    if (resources.includes('partners')) {
      metrics.push({ name: '合作伙伴数', value: snapshot.partners.length });
    }

    if (resources.includes('registrations')) {
      metrics.push({ name: '客户报备数', value: snapshot.registrations.length });
    }

    if (resources.includes('opportunities')) {
      const opportunityAmount = this.sumBusinessChainAmount('opportunities', snapshot.opportunities);
      metrics.push({ name: '商机数', value: snapshot.opportunities.length });
      if (opportunityAmount > 0) {
        metrics.push({ name: '商机金额', value: formatWanAmount(opportunityAmount) });
      }
    }

    if (resources.includes('quotes')) {
      const quoteAmount = this.sumBusinessChainAmount('quotes', snapshot.quotes);
      metrics.push({ name: '报价数', value: snapshot.quotes.length });
      if (quoteAmount > 0) {
        metrics.push({ name: '报价金额', value: formatWanAmount(quoteAmount) });
      }
    }

    if (resources.includes('orders')) {
      const orderAmount = this.sumBusinessChainAmount('orders', snapshot.orders);
      metrics.push({ name: '订单数', value: snapshot.orders.length });
      if (orderAmount > 0) {
        metrics.push({ name: '订单金额', value: formatWanAmount(orderAmount) });
      }
    }

    return metrics;
  }

  /**
   * 构造业务链快照主表汇总行。
   *
   * 参数说明：`snapshot` 为真实明细快照，`resources` 为请求内读取对象。
   * 返回值说明：返回按“合作伙伴、客户报备、商机、订单”分区的汇总行。
   * 调用注意事项：主表用于图表和指标一致性校验，详细对象清单放入二级视图，避免混合粒度导致校验失败。
   */
  private buildBusinessChainSummaryRows(
    snapshot: LianruanCrmOpenApiBusinessChainSnapshot,
    resources: BusinessChainSnapshotResource[],
  ): Array<Record<string, unknown>> {
    const rows: Array<Record<string, unknown>> = [];
    const pushRow = (
      resource: BusinessChainSnapshotResource,
      label: string,
      count: number,
      amount: number,
      endpoint: string,
    ) => {
      rows.push({
        ownerId: `business-chain-${resource}`,
        ownerName: label,
        businessSection: label,
        dataEndpoint: endpoint,
        count,
        amount,
        amountText: amount > 0 ? formatWanAmount(amount) : undefined,
        statisticScope: 'CRM 真实明细聚合',
      });
    };

    if (resources.includes('partners')) {
      pushRow(
        'partners',
        '合作伙伴开拓情况',
        snapshot.partners.length,
        0,
        'READ details/partners.md',
      );
    }
    if (resources.includes('registrations')) {
      pushRow(
        'registrations',
        '客户报备情况',
        snapshot.registrations.length,
        0,
        'READ details/registrations.md',
      );
    }
    if (resources.includes('opportunities')) {
      pushRow(
        'opportunities',
        '客户商机报备及商机情况',
        snapshot.opportunities.length,
        this.sumBusinessChainAmount('opportunities', snapshot.opportunities),
        'READ details/opportunities.md',
      );
    }
    if (resources.includes('quotes')) {
      pushRow(
        'quotes',
        '报价情况',
        snapshot.quotes.length,
        this.sumBusinessChainAmount('quotes', snapshot.quotes),
        'READ details/quotes.md',
      );
    }
    if (resources.includes('orders')) {
      pushRow(
        'orders',
        '订单情况',
        snapshot.orders.length,
        this.sumBusinessChainAmount('orders', snapshot.orders),
        'READ details/orders.md',
      );
    }

    return rows;
  }

  /**
   * 构造业务链快照二级表。
   *
   * 参数说明：各参数为已格式化的渠道商汇总和对象明细行。
   * 返回值说明：返回报告层可渲染的表格视图数组。
   * 调用注意事项：二级表承载真实名称明细，企微卡片和公开 HTML 共用同一结果包，不再展示脱敏占位名。
   */
  private buildBusinessChainSecondaryViews(params: {
    questionText: string;
    resources: BusinessChainSnapshotResource[];
    opportunityQuarterComparisonRows: Array<Record<string, unknown>>;
    opportunityRegionQuarterRows: Array<Record<string, unknown>>;
    bigRegionComparisonRows: Array<Record<string, unknown>>;
    regionComparisonRows: Array<Record<string, unknown>>;
    partnerContributionRows: Array<Record<string, unknown>>;
    salesContributionRows: Array<Record<string, unknown>>;
    orderFulfillmentRows: Array<Record<string, unknown>>;
    distributionHierarchyRows: Array<Record<string, unknown>>;
    technicalServiceRows: Array<Record<string, unknown>>;
    partnerRows: Array<Record<string, unknown>>;
    registrationRows: Array<Record<string, unknown>>;
    opportunityStageRows: Array<Record<string, unknown>>;
    opportunityRows: Array<Record<string, unknown>>;
    quoteRows: Array<Record<string, unknown>>;
    orderRows: Array<Record<string, unknown>>;
  }): ResultView[] {
    const viewsByKey: Record<BusinessChainSecondaryViewKey, ResultView> = {
      'opportunity-quarter-comparison': {
        viewType: 'LINE_CHART',
        title: '商机季度对比',
        rows: params.opportunityQuarterComparisonRows,
        series: params.opportunityQuarterComparisonRows.map((row) => ({
          label: row.quarterLabel,
          value: row.opportunityAmount,
          count: row.opportunityCount,
        })),
      },
      'opportunity-region-quarter-matrix': {
        viewType: 'RANKING_TABLE',
        title: '区域大区季度商机对比',
        rows: params.opportunityRegionQuarterRows,
      },
      'region-comparison': {
        viewType: 'RANKING_TABLE',
        title: '区域经营对比',
        rows: params.regionComparisonRows,
      },
      'big-region-comparison': {
        viewType: 'RANKING_TABLE',
        title: '大区经营对比',
        rows: params.bigRegionComparisonRows,
      },
      'partner-contribution': {
        viewType: 'RANKING_TABLE',
        title: '渠道商经营贡献汇总',
        rows: params.partnerContributionRows,
      },
      'sales-contribution': {
        viewType: 'RANKING_TABLE',
        title: '销售负责人经营对比',
        rows: params.salesContributionRows,
      },
      'order-fulfillment-comparison': {
        viewType: 'RANKING_TABLE',
        title: '订单承接对比',
        rows: params.orderFulfillmentRows,
      },
      'distribution-hierarchy': {
        viewType: 'RANKING_TABLE',
        title: '分销层级健康汇总',
        rows: params.distributionHierarchyRows,
      },
      'technical-service-ecosystem': {
        viewType: 'RANKING_TABLE',
        title: '技术服务商生态对比',
        rows: params.technicalServiceRows,
      },
      'partner-detail': {
        viewType: 'DETAIL_TABLE',
        title: '合作伙伴明细',
        rows: params.partnerRows,
      },
      'registration-detail': {
        viewType: 'DETAIL_TABLE',
        title: '客户报备明细',
        rows: params.registrationRows,
      },
      'opportunity-stage': {
        viewType: 'PIE_CHART',
        title: '商机阶段分布',
        rows: params.opportunityStageRows,
        series: params.opportunityStageRows.map((row) => ({
          label: row.stageName,
          value: row.count,
          amount: row.amount,
        })),
      },
      'opportunity-detail': {
        viewType: 'DETAIL_TABLE',
        title: '商机明细',
        rows: params.opportunityRows,
      },
      'quote-detail': {
        viewType: 'DETAIL_TABLE',
        title: '报价明细',
        rows: params.quoteRows,
      },
      'order-detail': {
        viewType: 'DETAIL_TABLE',
        title: '订单明细',
        rows: params.orderRows,
      },
    };

    return this.resolveBusinessChainSecondaryViewOrder(
      params.questionText,
      params.resources,
    )
      .map((viewKey) => viewsByKey[viewKey])
      .filter((view) => (view.rows?.length ?? 0) > 0);
  }

  /**
   * 按用户本轮描述决定业务链二级视图展示顺序。
   *
   * 参数说明：`questionText` 为用户原始问题，`resources` 为本次已经读取的业务对象。
   * 返回值说明：返回去重后的二级视图键，报告层会按此顺序展示明细和图表。
   * 调用注意事项：该函数只影响展示顺序，不新增取数对象；默认模板兜底仍保留，但用户明确说到的对象会优先展示。
   */
  private resolveBusinessChainSecondaryViewOrder(
    questionText: string,
    resources: BusinessChainSnapshotResource[],
  ): BusinessChainSecondaryViewKey[] {
    const orderedKeys: BusinessChainSecondaryViewKey[] = [];
    const add = (key: BusinessChainSecondaryViewKey) => {
      if (!orderedKeys.includes(key)) {
        orderedKeys.push(key);
      }
    };
    const hasPartner = resources.includes('partners');
    const hasDependentBusiness = resources.some((resource) =>
      ['registrations', 'opportunities', 'quotes', 'orders'].includes(resource),
    );
    const hasRegionQuestion = /(区域|大区|省份|地区|地域|覆盖|大北|大东|大南|大西|山东|广州|北京|上海|深圳|江苏|华北|华东|华南|华西)/u.test(questionText);
    const hasBigRegionQuestion = /(大区|大北|大东|大南|大西|华北|华东|华南|华西)/u.test(questionText);
    const hasSalesQuestion = /(销售|销售负责人|负责人|人员|个人|团队|跟进人|归属人)/u.test(questionText);
    const hasOrderQuestion = /(订单|下单|成单|签单|成交|订单承接|回款)/u.test(questionText);
    const hasQuarterComparisonQuestion = /(季度|按季|一季度|二季度|三季度|四季度|Q[1-4]|对比|比较|差异|相比)/iu.test(questionText);
    const hasRegionQuarterComparison = hasRegionQuestion && hasQuarterComparisonQuestion;
    const hasDistributionQuestion = /(一级渠道|二级渠道|分销|上级|层级|父级|一级确认)/u.test(questionText);
    const hasTechnicalServiceQuestion = /(技术服务商|签约技术|提名技术|交付生态|交付能力|技术服务能力)/u.test(questionText);
    const explicitPartnerSummary = /(按.*渠道商|渠道商.*汇总|渠道商.*贡献|经营贡献|贡献|经营|运营|业绩|产出)/u.test(
      questionText,
    );
    const explicitPartnerList = /(类型|类别|分类|等级|级别|技术服务商|开拓|拓展|发展|画像|名单|明细|单独列|列一下|列出)/u.test(
      questionText,
    ) && /(合作伙伴|服务商|渠道商|渠道|代理商|经销商|伙伴)/u.test(questionText);

    if (hasPartner && explicitPartnerList && !hasDependentBusiness) {
      add('partner-detail');
    }
    if (resources.includes('opportunities') && hasQuarterComparisonQuestion) {
      if (hasOrderQuestion && resources.includes('orders')) {
        add('order-fulfillment-comparison');
      }
      if (hasRegionQuarterComparison) {
        add('opportunity-region-quarter-matrix');
      }
      add('opportunity-quarter-comparison');
    }
    if (hasSalesQuestion && hasDependentBusiness) {
      add('sales-contribution');
    }
    if (hasOrderQuestion && resources.includes('orders')) {
      add('order-fulfillment-comparison');
    }
    if (hasRegionQuestion) {
      if (hasBigRegionQuestion) {
        add('big-region-comparison');
      }
      add('region-comparison');
    }
    if (hasDistributionQuestion) {
      add('distribution-hierarchy');
    }
    if (hasTechnicalServiceQuestion) {
      add('technical-service-ecosystem');
    }
    if (hasPartner && (explicitPartnerSummary || hasDependentBusiness)) {
      add('partner-contribution');
    }

    const signalPositions: Array<{ key: BusinessChainSecondaryViewKey; index: number }> = [
      { key: 'partner-detail', index: this.findBusinessChainSignalIndex(questionText, /(合作伙伴|服务商|渠道商|渠道|代理商|经销商|伙伴|类型|等级|技术服务商|开拓|拓展|发展)/u) },
      { key: 'big-region-comparison', index: this.findBusinessChainSignalIndex(questionText, /(大区|大北|大东|大南|大西|华北|华东|华南|华西)/u) },
      { key: 'region-comparison', index: this.findBusinessChainSignalIndex(questionText, /(区域|大区|省份|地区|覆盖)/u) },
      { key: 'sales-contribution', index: this.findBusinessChainSignalIndex(questionText, /(销售|销售负责人|负责人|人员|个人|团队|跟进人|归属人)/u) },
      { key: 'order-fulfillment-comparison', index: this.findBusinessChainSignalIndex(questionText, /(订单|下单|成单|签单|成交|订单承接|回款)/u) },
      { key: 'opportunity-region-quarter-matrix', index: this.findBusinessChainSignalIndex(questionText, /(区域|大区|季度|按季|一季度|二季度|三季度|四季度|Q[1-4]|对比|比较|差异|相比)/iu) },
      { key: 'distribution-hierarchy', index: this.findBusinessChainSignalIndex(questionText, /(一级渠道|二级渠道|分销|上级|层级|父级|一级确认)/u) },
      { key: 'technical-service-ecosystem', index: this.findBusinessChainSignalIndex(questionText, /(技术服务商|签约技术|提名技术|交付生态|交付能力|技术服务能力)/u) },
      { key: 'opportunity-quarter-comparison', index: this.findBusinessChainSignalIndex(questionText, /(季度|按季|一季度|二季度|三季度|四季度|Q[1-4]|对比|比较|差异|相比)/iu) },
      { key: 'registration-detail', index: this.findBusinessChainSignalIndex(questionText, /(客户商机报备|客户报备|报备情况|报备)/u) },
      { key: 'opportunity-stage', index: this.findBusinessChainSignalIndex(questionText, /(商机阶段|阶段分布|阶段|漏斗|分布)/u) },
      { key: 'opportunity-detail', index: this.findBusinessChainSignalIndex(questionText, /(重点商机|商机|机会)/u) },
      { key: 'quote-detail', index: this.findBusinessChainSignalIndex(questionText, /(报价|报价单|价格)/u) },
      { key: 'order-detail', index: this.findBusinessChainSignalIndex(questionText, /(订单|下单|成单|签单|成交)/u) },
    ];

    signalPositions
      .filter((item) => item.index >= 0 && this.isBusinessChainViewResourceAvailable(item.key, resources))
      .sort((left, right) => left.index - right.index)
      .forEach((item) => add(item.key));

    if (hasPartner && !orderedKeys.includes('partner-detail')) {
      add('partner-detail');
    }
    if (hasPartner && hasDependentBusiness && !orderedKeys.includes('region-comparison')) {
      if (!orderedKeys.includes('big-region-comparison')) {
        add('big-region-comparison');
      }
      add('region-comparison');
    }
    if (hasPartner && !orderedKeys.includes('distribution-hierarchy')) {
      add('distribution-hierarchy');
    }
    if (hasPartner && !orderedKeys.includes('technical-service-ecosystem')) {
      add('technical-service-ecosystem');
    }
    if (resources.includes('registrations')) {
      add('registration-detail');
    }
    if (resources.includes('opportunities')) {
      if (/(阶段|漏斗|分布|结构|占比)/u.test(questionText)) {
        add('opportunity-stage');
      }
      add('opportunity-detail');
    }
    if (resources.includes('quotes')) {
      add('quote-detail');
    }
    if (resources.includes('orders')) {
      add('order-detail');
    }

    return orderedKeys;
  }

  /**
   * 查找用户问题中某类业务表达首次出现的位置。
   *
   * 参数说明：`questionText` 为用户原文，`pattern` 为业务对象或展示要求正则。
   * 返回值说明：命中时返回首个索引，未命中返回 `-1`。
   */
  private findBusinessChainSignalIndex(questionText: string, pattern: RegExp): number {
    const match = questionText.match(pattern);
    return match?.index ?? -1;
  }

  /**
   * 判断二级视图依赖的数据对象是否已在本次快照读取范围内。
   *
   * 参数说明：`viewKey` 为二级视图键，`resources` 为本次读取对象。
   * 返回值说明：依赖资源存在时返回 `true`。
   */
  private isBusinessChainViewResourceAvailable(
    viewKey: BusinessChainSecondaryViewKey,
    resources: BusinessChainSnapshotResource[],
  ): boolean {
    const resourceByViewKey: Record<BusinessChainSecondaryViewKey, BusinessChainSnapshotResource> = {
      'opportunity-quarter-comparison': 'opportunities',
      'opportunity-region-quarter-matrix': 'opportunities',
      'big-region-comparison': 'partners',
      'region-comparison': 'partners',
      'partner-contribution': 'partners',
      'sales-contribution': 'opportunities',
      'order-fulfillment-comparison': 'orders',
      'distribution-hierarchy': 'partners',
      'technical-service-ecosystem': 'partners',
      'partner-detail': 'partners',
      'registration-detail': 'registrations',
      'opportunity-stage': 'opportunities',
      'opportunity-detail': 'opportunities',
      'quote-detail': 'quotes',
      'order-detail': 'orders',
    };
    return resources.includes(resourceByViewKey[viewKey]);
  }

  /**
   * 构造商机阶段分布行。
   *
   * 参数说明：`opportunityRows` 为已经格式化后的商机真实明细。
   * 返回值说明：按阶段聚合商机数量、金额和金额中文展示值。
   * 调用注意事项：阶段标签使用前置字典或本地中文释义后的 `stageName`，避免把内部枚举直接展示给用户。
   */
  private buildBusinessChainOpportunityStageRows(
    opportunityRows: Array<Record<string, unknown>>,
  ): Array<Record<string, unknown>> {
    const rows = new Map<string, Record<string, unknown>>();
    for (const opportunity of opportunityRows) {
      const stageName = this.readText(opportunity.stageName) || '未填写阶段';
      const amount = this.resolveFiniteNumber(opportunity.amount);
      const existing = rows.get(stageName) ?? {
        stageName,
        ownerId: stageName,
        ownerName: stageName,
        count: 0,
        amount: 0,
      };
      existing.count = Number(existing.count ?? 0) + 1;
      existing.amount = Number(existing.amount ?? 0) + amount;
      rows.set(stageName, existing);
    }

    const normalizedRows: Array<Record<string, unknown>> = [...rows.values()]
      .map((row): Record<string, unknown> => ({
        ...row,
        amountText: formatWanAmount(Number(row.amount ?? 0)),
      }));

    return normalizedRows.sort(
        (left, right) =>
          Number(right.count ?? 0) - Number(left.count ?? 0) ||
          Number(right.amount ?? 0) - Number(left.amount ?? 0),
      );
  }

  /**
   * 构造商机季度对比行。
   *
   * 参数说明：`opportunities` 为已按权限、时间和区域过滤后的商机记录。
   * 返回值说明：返回按自然季度升序排列的商机数量、金额和相邻季度变化。
   * 调用注意事项：该函数只基于当前结果集聚合，不扩大查询范围；金额沿用商机金额字段。
   */
  private buildBusinessChainOpportunityQuarterComparisonRows(
    opportunities: StandardApiRecord[],
    temporalSlot?: AnalysisIntent['temporalSlot'],
  ): Array<Record<string, unknown>> {
    const taskConfig = this.buildBusinessChainTaskConfig('opportunities');
    const rows = new Map<string, {
      quarterKey: string;
      quarterLabel: string;
      opportunityCount: number;
      opportunityAmount: number;
    }>();

    for (const opportunity of opportunities) {
      const quarter = this.resolveBusinessChainRecordQuarter(opportunity);
      const existing = rows.get(quarter.key) ?? {
        quarterKey: quarter.key,
        quarterLabel: quarter.label,
        opportunityCount: 0,
        opportunityAmount: 0,
      };
      existing.opportunityCount += 1;
      existing.opportunityAmount += this.resolveAmount(taskConfig, opportunity);
      rows.set(quarter.key, existing);
    }

    for (const quarter of this.resolveExpectedQuarterBuckets(temporalSlot)) {
      if (!rows.has(quarter.key)) {
        rows.set(quarter.key, {
          quarterKey: quarter.key,
          quarterLabel: quarter.label,
          opportunityCount: 0,
          opportunityAmount: 0,
        });
      }
    }

    const sortedRows = [...rows.values()].sort((left, right) =>
      left.quarterKey.localeCompare(right.quarterKey),
    );
    const totalOpportunityAmount = sortedRows.reduce(
      (sum, row) => sum + row.opportunityAmount,
      0,
    );

    return sortedRows.map((row, index): Record<string, unknown> => {
      const previous = index > 0 ? sortedRows[index - 1] : undefined;
      const countDelta = previous
        ? row.opportunityCount - previous.opportunityCount
        : 0;
      const amountDelta = previous
        ? row.opportunityAmount - previous.opportunityAmount
        : 0;
      const amountChangeRate = previous && previous.opportunityAmount > 0
        ? `${((amountDelta / previous.opportunityAmount) * 100).toFixed(1)}%`
        : '无上期基数';
      const countChangeRate = previous && previous.opportunityCount > 0
        ? `${((countDelta / previous.opportunityCount) * 100).toFixed(1)}%`
        : '无上期基数';
      const opportunityShare = this.formatBusinessChainPercent(
        row.opportunityAmount,
        totalOpportunityAmount,
      );
      const riskReason = previous
        ? this.buildBusinessChainQuarterRiskReason(countDelta, amountDelta)
        : '首期作为对比基准，风险判断从下一期开始观察。';

      return {
        ownerId: row.quarterKey,
        ownerName: row.quarterLabel,
        bucket_label: row.quarterLabel,
        quarterLabel: row.quarterLabel,
        opportunityCount: row.opportunityCount,
        opportunityAmount: row.opportunityAmount,
        opportunityAmountText: formatWanAmount(row.opportunityAmount),
        countChange: countDelta,
        countChangeText: previous ? this.formatSignedNumber(countDelta) : '首期',
        countChangeRate,
        amountChange: amountDelta,
        amountChangeText: previous ? this.formatSignedWanAmount(amountDelta) : '首期',
        amountChangeRate,
        contributionShare: opportunityShare,
        opportunityShare,
        amount: row.opportunityAmount,
        count: row.opportunityCount,
        comparisonConclusion: previous
          ? this.buildQuarterComparisonConclusion(row.quarterLabel, countDelta, amountDelta)
          : `${row.quarterLabel}为本次对比首期。`,
        riskReason,
        actionSuggestion: this.buildBusinessChainQuarterActionSuggestion(countDelta, amountDelta, previous),
      };
    });
  }

  /**
   * 构造区域或大区维度下的季度商机对比矩阵。
   *
   * 参数说明：`snapshot` 为真实业务链快照，`temporalSlot` 为用户时间口径，`questionText` 为原始问题。
   * 返回值说明：返回“区域/大区 × 季度”的商机数量、金额、变化、占比、风险原因和动作建议。
   * 调用注意事项：只在已取回商机明细内做聚合；渠道商主数据只用于补齐区域和大区，不扩大数据范围。
   */
  private buildBusinessChainOpportunityRegionQuarterRows(
    snapshot: LianruanCrmOpenApiBusinessChainSnapshot,
    temporalSlot: AnalysisIntent['temporalSlot'] | undefined,
    questionText: string,
  ): Array<Record<string, unknown>> {
    const partnerMetaMap = this.buildBusinessChainPartnerMetaMap(snapshot.partners);
    const groupByBigRegion = /(大区|大北|大东|大南|大西|华北|华东|华南|华西)/u.test(questionText) &&
      !/(不同区域|各区域|区域对比|省份|地区)/u.test(questionText);
    const dimensionLabel = groupByBigRegion ? '大区' : '区域';
    const rows = new Map<string, {
      groupKey: string;
      groupLabel: string;
      bigRegion: string;
      region: string;
      quarterKey: string;
      quarterLabel: string;
      opportunityCount: number;
      opportunityAmount: number;
    }>();
    const groups = new Map<string, { groupKey: string; groupLabel: string; bigRegion: string; region: string }>();
    const expectedQuarters = this.resolveExpectedQuarterBuckets(temporalSlot);

    const resolveGroup = (record: StandardApiRecord): { groupKey: string; groupLabel: string; bigRegion: string; region: string } => {
      const partnerId = this.resolvePartnerId(record);
      const partnerMeta = partnerMetaMap.get(partnerId);
      const bigRegion = this.readText(record.bigRegion ?? partnerMeta?.bigRegion) || '未填写大区';
      const region = this.readText(record.region ?? partnerMeta?.region) || '未填写区域';
      const groupLabel = groupByBigRegion ? bigRegion : (region === bigRegion ? region : `${bigRegion}/${region}`);
      const groupKey = groupByBigRegion ? bigRegion : `${bigRegion}::${region}`;
      return { groupKey, groupLabel, bigRegion, region };
    };

    for (const partner of snapshot.partners) {
      const group = resolveGroup({
        ...partner,
        partnerId: partner.partnerId ?? partner.id,
      });
      groups.set(group.groupKey, group);
    }

    for (const opportunity of snapshot.opportunities) {
      const group = resolveGroup(opportunity);
      groups.set(group.groupKey, group);
      const quarter = this.resolveBusinessChainRecordQuarter(opportunity);
      const rowKey = `${group.groupKey}::${quarter.key}`;
      const existing = rows.get(rowKey) ?? {
        ...group,
        quarterKey: quarter.key,
        quarterLabel: quarter.label,
        opportunityCount: 0,
        opportunityAmount: 0,
      };
      existing.opportunityCount += 1;
      existing.opportunityAmount += this.resolveAmount(
        this.buildBusinessChainTaskConfig('opportunities'),
        opportunity,
      );
      rows.set(rowKey, existing);
    }

    if (expectedQuarters.length > 0) {
      for (const group of groups.values()) {
        for (const quarter of expectedQuarters) {
          const rowKey = `${group.groupKey}::${quarter.key}`;
          if (!rows.has(rowKey)) {
            rows.set(rowKey, {
              ...group,
              quarterKey: quarter.key,
              quarterLabel: quarter.label,
              opportunityCount: 0,
              opportunityAmount: 0,
            });
          }
        }
      }
    }

    const groupedRows = [...rows.values()]
      .sort((left, right) =>
        left.groupLabel.localeCompare(right.groupLabel, 'zh-Hans-CN') ||
        left.quarterKey.localeCompare(right.quarterKey),
      );
    const totalOpportunityAmount = groupedRows.reduce(
      (sum, row) => sum + row.opportunityAmount,
      0,
    );
    const previousByGroup = new Map<string, {
      opportunityCount: number;
      opportunityAmount: number;
    }>();

    return groupedRows.map((row): Record<string, unknown> => {
      const previous = previousByGroup.get(row.groupKey);
      const countDelta = previous ? row.opportunityCount - previous.opportunityCount : 0;
      const amountDelta = previous ? row.opportunityAmount - previous.opportunityAmount : 0;
      const amountChangeRate = previous && previous.opportunityAmount > 0
        ? `${((amountDelta / previous.opportunityAmount) * 100).toFixed(1)}%`
        : '无上期基数';
      previousByGroup.set(row.groupKey, {
        opportunityCount: row.opportunityCount,
        opportunityAmount: row.opportunityAmount,
      });

      return {
        ownerId: `${row.groupKey}-${row.quarterKey}`,
        ownerName: `${row.groupLabel}/${row.quarterLabel}`,
        bucket_label: `${row.groupLabel}/${row.quarterLabel}`,
        comparisonDimension: dimensionLabel,
        comparisonObject: row.groupLabel,
        bigRegion: row.bigRegion,
        region: row.region,
        quarterLabel: row.quarterLabel,
        opportunityCount: row.opportunityCount,
        opportunityAmount: row.opportunityAmount,
        opportunityAmountText: formatWanAmount(row.opportunityAmount),
        countChange: countDelta,
        countChangeText: previous ? this.formatSignedNumber(countDelta) : '首期',
        amountChange: amountDelta,
        amountChangeText: previous ? this.formatSignedWanAmount(amountDelta) : '首期',
        amountChangeRate,
        opportunityShare: this.formatBusinessChainPercent(row.opportunityAmount, totalOpportunityAmount),
        contributionShare: this.formatBusinessChainPercent(row.opportunityAmount, totalOpportunityAmount),
        riskReason: previous
          ? this.buildBusinessChainQuarterRiskReason(countDelta, amountDelta)
          : `${row.groupLabel}在${row.quarterLabel}作为本对象对比基准。`,
        actionSuggestion: this.buildBusinessChainQuarterActionSuggestion(countDelta, amountDelta, previous),
        amount: row.opportunityAmount,
        count: row.opportunityCount,
      };
    });
  }

  /**
   * 构造商机季度对比指标卡。
   *
   * 参数说明：`rows` 为季度对比聚合行。
   * 返回值说明：返回最多 3 个可前置展示的季度指标。
   * 调用注意事项：仅在至少两个季度时输出，避免单期数据伪装成对比。
   */
  private buildBusinessChainOpportunityQuarterMetricCards(
    rows: Array<Record<string, unknown>>,
  ): MetricCard[] {
    if (rows.length < 2) {
      return [];
    }

    const first = rows[0];
    const latest = rows[rows.length - 1];
    const amountDelta = this.resolveFiniteNumber(latest.amountChange);
    return [
      {
        name: `${this.readText(first.quarterLabel)}商机`,
        value: `${this.resolveFiniteNumber(first.opportunityCount)}个 / ${this.readText(first.opportunityAmountText)}`,
      },
      {
        name: `${this.readText(latest.quarterLabel)}商机`,
        value: `${this.resolveFiniteNumber(latest.opportunityCount)}个 / ${this.readText(latest.opportunityAmountText)}`,
      },
      {
        name: '季度金额变化',
        value: this.formatSignedWanAmount(amountDelta),
      },
    ];
  }

  /**
   * 解析记录所在自然季度。
   *
   * 参数说明：`record` 为标准 API 记录。
   * 返回值说明：返回排序键和展示标签；缺失时间时归入“未填写时间”。
   */
  private resolveBusinessChainRecordQuarter(record: StandardApiRecord): { key: string; label: string } {
    const recordTime = this.readRecordTime(record);
    const parsedTime = recordTime ? new Date(recordTime) : undefined;
    if (!parsedTime || Number.isNaN(parsedTime.getTime())) {
      return { key: '9999-Q9', label: '未填写时间' };
    }

    const shanghaiTime = new Date(parsedTime.getTime() + 8 * 60 * 60 * 1000);
    const year = shanghaiTime.getUTCFullYear();
    const quarterIndex = Math.floor(shanghaiTime.getUTCMonth() / 3);
    return {
      key: `${year}-Q${quarterIndex + 1}`,
      label: `${year}年${['一季度', '二季度', '三季度', '四季度'][quarterIndex]}`,
    };
  }

  /**
   * 从时间槽推导应展示的季度桶。
   *
   * 参数说明：`temporalSlot` 为用户问题解析出的时间口径。
   * 返回值说明：季度粒度且边界完整时返回覆盖区间内所有自然季度；否则返回空数组。
   * 调用注意事项：该函数用于展示 0 值季度，不能扩大底层记录过滤范围。
   */
  private resolveExpectedQuarterBuckets(
    temporalSlot?: AnalysisIntent['temporalSlot'],
  ): Array<{ key: string; label: string }> {
    if (temporalSlot?.granularity !== 'quarter' || !temporalSlot.startAt || !temporalSlot.endAt) {
      return [];
    }

    const start = new Date(temporalSlot.startAt);
    const end = new Date(temporalSlot.endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      return [];
    }

    const cursor = new Date(start.getTime() + 8 * 60 * 60 * 1000);
    cursor.setUTCDate(1);
    cursor.setUTCHours(0, 0, 0, 0);
    cursor.setUTCMonth(Math.floor(cursor.getUTCMonth() / 3) * 3);
    const endLocal = new Date(end.getTime() + 8 * 60 * 60 * 1000);
    const buckets: Array<{ key: string; label: string }> = [];

    while (cursor < endLocal && buckets.length < 12) {
      const year = cursor.getUTCFullYear();
      const quarterIndex = Math.floor(cursor.getUTCMonth() / 3);
      buckets.push({
        key: `${year}-Q${quarterIndex + 1}`,
        label: `${year}年${['一季度', '二季度', '三季度', '四季度'][quarterIndex]}`,
      });
      cursor.setUTCMonth(cursor.getUTCMonth() + 3);
    }

    return buckets;
  }

  /**
   * 从问题原文兜底解析季度对比时间槽。
   *
   * 参数说明：`questionText` 为用户原始问题。
   * 返回值说明：命中“一季度和二季度 / 26年一季度与二季度”时返回季度时间槽，否则返回 `undefined`。
   * 调用注意事项：该兜底只服务业务链补齐 0 值季度，不会改变非季度问题的默认时间范围。
   */
  private resolveBusinessChainQuarterComparisonSlot(
    questionText: string,
  ): AnalysisIntent['temporalSlot'] | undefined {
    const match = questionText.match(
      /(?:(?<firstYear>(?:20)?\d{2})\s*年\s*)?(?<first>一|二|三|四|1|2|3|4|Q1|Q2|Q3|Q4)\s*(?:季度|季)?\s*(?:与|和|及|到|至|比|对比|比较|-|—|~|、|,|，)\s*(?:(?<secondYear>(?:20)?\d{2})\s*年\s*)?(?<second>一|二|三|四|1|2|3|4|Q1|Q2|Q3|Q4)\s*(?:季度|季)?/iu,
    );
    if (!match?.groups?.first || !match.groups.second) {
      return undefined;
    }

    const fallbackYear = this.resolveCurrentShanghaiYear();
    const firstYear = match.groups.firstYear
      ? this.normalizeBusinessChainQuarterYear(match.groups.firstYear)
      : fallbackYear;
    const secondYear = match.groups.secondYear
      ? this.normalizeBusinessChainQuarterYear(match.groups.secondYear)
      : firstYear;
    const firstQuarter = this.parseBusinessChainQuarterIndex(match.groups.first);
    const secondQuarter = this.parseBusinessChainQuarterIndex(match.groups.second);
    if (!firstYear || !secondYear || firstQuarter < 0 || secondQuarter < 0) {
      return undefined;
    }

    const firstOrdinal = firstYear * 4 + firstQuarter;
    const secondOrdinal = secondYear * 4 + secondQuarter;
    const startOrdinal = Math.min(firstOrdinal, secondOrdinal);
    const endOrdinal = Math.max(firstOrdinal, secondOrdinal);
    const startYear = Math.floor(startOrdinal / 4);
    const startQuarter = startOrdinal % 4;
    const endYear = Math.floor(endOrdinal / 4);
    const endQuarter = endOrdinal % 4;
    const endBoundaryOrdinal = endOrdinal + 1;
    const endBoundaryYear = Math.floor(endBoundaryOrdinal / 4);
    const endBoundaryQuarter = endBoundaryOrdinal % 4;

    return {
      rawText: match[0].replace(/\s+/gu, ''),
      normalizedLabel: startYear === endYear
        ? `${startYear}年${this.formatBusinessChainQuarterName(startQuarter)}至${this.formatBusinessChainQuarterName(endQuarter)}`
        : `${startYear}年${this.formatBusinessChainQuarterName(startQuarter)}至${endYear}年${this.formatBusinessChainQuarterName(endQuarter)}`,
      startAt: this.buildShanghaiQuarterBoundaryIso(startYear, startQuarter),
      endAt: this.buildShanghaiQuarterBoundaryIso(endBoundaryYear, endBoundaryQuarter),
      timezone: 'Asia/Shanghai',
      granularity: 'quarter',
      relativity: 'absolute',
      inclusivity: {
        start: 'inclusive',
        end: 'exclusive',
      },
      confidence: 'HIGH',
    };
  }

  /**
   * 解析当前上海时区自然年。
   *
   * 返回值说明：返回四位自然年，用于用户省略年份的季度对比。
   */
  private resolveCurrentShanghaiYear(): number {
    return new Date(Date.now() + 8 * 60 * 60 * 1000).getUTCFullYear();
  }

  /**
   * 规范化业务链季度年份。
   *
   * 参数说明：`rawYear` 为两位或四位年份。
   * 返回值说明：返回四位年份；非法输入返回 `undefined`。
   */
  private normalizeBusinessChainQuarterYear(rawYear: string): number | undefined {
    const year = Number(rawYear);
    if (!Number.isInteger(year)) {
      return undefined;
    }

    return year < 100 ? 2000 + year : year;
  }

  /**
   * 构造上海时区季度边界。
   *
   * 参数说明：`year` 为自然年，`quarterIndex` 为从 0 开始的季度序号。
   * 返回值说明：返回 UTC ISO 字符串，对应上海本地季度起始时刻。
   */
  private buildShanghaiQuarterBoundaryIso(year: number, quarterIndex: number): string {
    const monthIndex = quarterIndex * 3;
    return new Date(Date.UTC(year, monthIndex, 1, -8, 0, 0, 0)).toISOString();
  }

  /**
   * 解析业务链季度序号。
   *
   * 参数说明：`rawQuarter` 为中文数字、阿拉伯数字或 Q1 形式。
   * 返回值说明：返回从 0 开始的季度索引；无法识别时返回 -1。
   */
  private parseBusinessChainQuarterIndex(rawQuarter: string): number {
    const normalized = rawQuarter.toUpperCase().replace(/^Q/u, '');
    const quarterMap: Record<string, number> = {
      一: 0,
      二: 1,
      三: 2,
      四: 3,
      '1': 0,
      '2': 1,
      '3': 2,
      '4': 3,
    };
    return quarterMap[normalized] ?? -1;
  }

  /**
   * 格式化业务链季度中文名。
   *
   * 参数说明：`quarterIndex` 为从 0 开始的季度索引。
   * 返回值说明：返回“一季度”等中文标签。
   */
  private formatBusinessChainQuarterName(quarterIndex: number): string {
    return ['一季度', '二季度', '三季度', '四季度'][quarterIndex] ?? `第${quarterIndex + 1}季度`;
  }

  /**
   * 格式化带符号整数。
   *
   * 参数说明：`value` 为变化数量。
   * 返回值说明：返回 `+3`、`-2` 或 `0`。
   */
  private formatSignedNumber(value: number): string {
    if (value > 0) {
      return `+${value}`;
    }

    return String(value);
  }

  /**
   * 格式化带符号万元金额。
   *
   * 参数说明：`value` 为元金额变化。
   * 返回值说明：返回带正负号的万元展示文本。
   */
  private formatSignedWanAmount(value: number): string {
    if (value > 0) {
      return `+${formatWanAmount(value)}`;
    }
    if (value < 0) {
      return `-${formatWanAmount(Math.abs(value))}`;
    }

    return formatWanAmount(0);
  }

  /**
   * 生成季度对比结论。
   *
   * 参数说明：`quarterLabel` 为当前季度，`countDelta/amountDelta` 为相邻季度变化。
   * 返回值说明：返回业务用户可读的变化判断。
   */
  private buildQuarterComparisonConclusion(
    quarterLabel: string,
    countDelta: number,
    amountDelta: number,
  ): string {
    if (countDelta > 0 && amountDelta > 0) {
      return `${quarterLabel}商机数量和金额均高于上期，增量质量相对更好。`;
    }
    if (countDelta > 0 && amountDelta <= 0) {
      return `${quarterLabel}商机数量增加但金额未同步增加，需要复核单均金额和重点商机质量。`;
    }
    if (countDelta <= 0 && amountDelta > 0) {
      return `${quarterLabel}商机数量未增加但金额提升，重点关注大额商机推进。`;
    }

    return `${quarterLabel}商机数量和金额均未高于上期，需要关注新增来源和推进效率。`;
  }

  /**
   * 格式化业务链对比百分比。
   *
   * 参数说明：`numerator` 为分子，`denominator` 为分母。
   * 返回值说明：分母无效时返回 `0%`，否则返回一位小数百分比。
   * 调用注意事项：仅用于用户可见展示，不参与金额计算和权限判断。
   */
  private formatBusinessChainPercent(numerator: number, denominator: number): string {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
      return '0%';
    }

    return `${((numerator / denominator) * 100).toFixed(1)}%`;
  }

  /**
   * 生成季度对比风险原因。
   *
   * 参数说明：`countDelta/amountDelta` 为当前季度相对上一季度的变化。
   * 返回值说明：返回业务用户可理解的风险解释。
   * 调用注意事项：只基于已返回数据做原因归纳，不推断 CRM 中不存在的字段。
   */
  private buildBusinessChainQuarterRiskReason(
    countDelta: number,
    amountDelta: number,
  ): string {
    if (countDelta < 0 && amountDelta < 0) {
      return '商机数量和金额同步下滑，主要风险是新增来源不足或推进节奏放慢。';
    }
    if (countDelta > 0 && amountDelta <= 0) {
      return '商机数量增加但金额没有同步提升，主要风险是小额商机占比上升或重点商机质量不足。';
    }
    if (countDelta <= 0 && amountDelta > 0) {
      return '金额增长依赖少量大额商机，主要风险是头部项目波动会放大整体结果波动。';
    }

    return '当前季度与上一期差异不大，主要风险是缺少新的增长拉动项。';
  }

  /**
   * 生成季度对比动作建议。
   *
   * 参数说明：`countDelta/amountDelta` 为当前季度变化，`previous` 为上一季度行。
   * 返回值说明：返回可分派的下一步动作。
   * 调用注意事项：首期没有可比基准时只建议建立后续跟踪口径。
   */
  private buildBusinessChainQuarterActionSuggestion(
    countDelta: number,
    amountDelta: number,
    previous?: { opportunityCount: number; opportunityAmount: number },
  ): string {
    if (!previous) {
      return '把本季度作为基准，后续固定按季度跟踪商机数、金额和高金额项目清单。';
    }
    if (countDelta < 0 && amountDelta < 0) {
      return '本周补一版新增商机来源清单，并按渠道商和销售负责人拆解下滑原因。';
    }
    if (countDelta > 0 && amountDelta <= 0) {
      return '筛选新增商机中的低金额项目，要求负责人补充重点商机推进计划。';
    }
    if (countDelta <= 0 && amountDelta > 0) {
      return '锁定大额商机的报价、决策人和预计签约时间，避免金额集中但无法落单。';
    }

    return '延续当前推进节奏，同时补充第二梯队商机，降低单一季度波动。';
  }

  /**
   * 给经营对比聚合行补齐占比、转化率、风险原因和动作建议。
   *
   * 参数说明：`rows` 为某一维度的聚合结果，`dimensionLabel` 为区域、大区、渠道商或销售负责人等中文维度名。
   * 返回值说明：返回保留原字段并追加严格对比字段的新行集合。
   * 调用注意事项：该函数只处理展示派生指标，不改变底层真实数量和金额。
   */
  private enrichBusinessChainComparisonRows(
    rows: Array<Record<string, unknown>>,
    dimensionLabel: string,
  ): Array<Record<string, unknown>> {
    const totalOpportunityAmount = rows.reduce(
      (sum, row) => sum + this.resolveFiniteNumber(row.opportunityAmount),
      0,
    );
    const totalOrderAmount = rows.reduce(
      (sum, row) => sum + this.resolveFiniteNumber(row.orderAmount),
      0,
    );
    const totalAmount = rows.reduce(
      (sum, row) => sum + this.resolveFiniteNumber(row.amount),
      0,
    );

    return rows.map((row): Record<string, unknown> => {
      const opportunityCount = this.resolveFiniteNumber(row.opportunityCount);
      const orderCount = this.resolveFiniteNumber(row.orderCount);
      const quoteCount = this.resolveFiniteNumber(row.quoteCount);
      const registrationCount = this.resolveFiniteNumber(row.registrationCount);
      const opportunityAmount = this.resolveFiniteNumber(row.opportunityAmount);
      const orderAmount = this.resolveFiniteNumber(row.orderAmount);
      const rowAmount = this.resolveFiniteNumber(row.amount);
      const opportunityShare = this.formatBusinessChainPercent(opportunityAmount, totalOpportunityAmount);
      const orderShare = this.formatBusinessChainPercent(orderAmount, totalOrderAmount);
      const contributionShare = this.formatBusinessChainPercent(rowAmount, totalAmount);
      const opportunityToOrderRate = this.formatBusinessChainPercent(orderCount, opportunityCount);
      const quoteToOrderRate = this.formatBusinessChainPercent(orderCount, quoteCount);
      const riskReason = this.buildBusinessChainComparisonRiskReason({
        row,
        dimensionLabel,
        opportunityCount,
        orderCount,
        registrationCount,
        opportunityAmount,
        orderAmount,
        opportunityShare,
        orderShare,
        contributionShare,
        opportunityToOrderRate,
      });

      return {
        ...row,
        opportunityShare,
        orderShare,
        contributionShare,
        opportunityToOrderRate,
        quoteToOrderRate,
        riskReason,
        actionSuggestion: this.buildBusinessChainComparisonActionSuggestion(riskReason, dimensionLabel),
      };
    });
  }

  /**
   * 生成经营对比风险原因。
   *
   * 参数说明：`params` 为单行聚合指标和维度说明。
   * 返回值说明：返回一条优先级最高的风险原因。
   * 调用注意事项：原因只来自当前行的真实指标和占比，不虚构客户预算、竞争对手等不可见信息。
   */
  private buildBusinessChainComparisonRiskReason(params: {
    row: Record<string, unknown>;
    dimensionLabel: string;
    opportunityCount: number;
    orderCount: number;
    registrationCount: number;
    opportunityAmount: number;
    orderAmount: number;
    opportunityShare: string;
    orderShare: string;
    contributionShare: string;
    opportunityToOrderRate: string;
  }): string {
    const objectName = this.resolveBusinessChainComparisonObjectName(params.row, params.dimensionLabel);
    if (this.hasMissingBusinessChainDimension(params.row)) {
      return `${objectName}存在区域、大区、负责人或渠道商字段缺口，归因准确性会受影响。`;
    }
    if (params.opportunityAmount > 0 && params.orderAmount <= 0) {
      return `${objectName}有商机储备但暂无订单承接，风险集中在报价推进和签单闭环。`;
    }
    if (params.opportunityCount > 0 && params.orderCount / params.opportunityCount < 0.1) {
      return `${objectName}商机到订单转化率仅 ${params.opportunityToOrderRate}，推进效率低于经营复盘阈值。`;
    }
    if (this.resolvePercentNumber(params.orderShare) >= 50 || this.resolvePercentNumber(params.opportunityShare) >= 50) {
      return `${objectName}贡献占比较高，当前结果对单一区块依赖偏强。`;
    }
    if (params.registrationCount > 0 && params.opportunityCount <= 0) {
      return `${objectName}已有报备但未沉淀商机，风险在客户报备到商机创建断点。`;
    }

    return `${objectName}未出现明显单点风险，建议持续观察商机推进和订单承接节奏。`;
  }

  /**
   * 生成经营对比动作建议。
   *
   * 参数说明：`riskReason` 为行级风险原因，`dimensionLabel` 为维度名称。
   * 返回值说明：返回可执行、可分派的下一步动作。
   */
  private buildBusinessChainComparisonActionSuggestion(
    riskReason: string,
    dimensionLabel: string,
  ): string {
    if (riskReason.includes('字段缺口')) {
      return `先补齐${dimensionLabel}归属、渠道商和负责人字段，再复核对比结论。`;
    }
    if (riskReason.includes('暂无订单承接')) {
      return '拉出高金额商机清单，逐条补报价状态、客户决策人和预计签约时间。';
    }
    if (riskReason.includes('转化率')) {
      return '按阶段拆分阻塞原因，要求负责人本周给出报价、测试或签单推进动作。';
    }
    if (riskReason.includes('依赖偏强')) {
      return '复盘头部对象打法，同时激活第二梯队渠道或销售，降低单点波动。';
    }
    if (riskReason.includes('报备到商机')) {
      return '核对报备客户质量和商机创建责任人，建立未转商机跟进清单。';
    }

    return '保留当前推进节奏，并把高金额商机和低转化对象纳入下次复盘。';
  }

  /**
   * 读取对比行的业务对象名称。
   *
   * 参数说明：`row` 为聚合行，`dimensionLabel` 为兜底维度名。
   * 返回值说明：返回用户可读对象名称。
   */
  private resolveBusinessChainComparisonObjectName(
    row: Record<string, unknown>,
    dimensionLabel: string,
  ): string {
    return (
      this.readText(
        row.ownerName ??
          row.partnerName ??
          row.region ??
          row.bigRegion ??
          row.bucket_label ??
          row.bucketLabel,
      ) || `当前${dimensionLabel}`
    );
  }

  /**
   * 判断对比行是否存在关键归因字段缺失。
   *
   * 参数说明：`row` 为聚合行。
   * 返回值说明：区域、大区、负责人或渠道商明确为未填写时返回 `true`。
   */
  private hasMissingBusinessChainDimension(row: Record<string, unknown>): boolean {
    return [row.ownerName, row.partnerName, row.region, row.bigRegion]
      .map((value) => this.readText(value))
      .some((value) => /未填写|未分配|未知/u.test(value));
  }

  /**
   * 将百分比文本转为数字。
   *
   * 参数说明：`value` 为 `12.3%` 一类展示值。
   * 返回值说明：可解析时返回百分比数字，否则返回 0。
   */
  private resolvePercentNumber(value: string): number {
    const parsed = Number(value.replace('%', ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  /**
   * 构造业务链快照摘要。
   *
   * 参数说明：`snapshot` 为真实明细快照，`resources` 为本次读取资源。
   * 返回值说明：返回面向业务用户的主摘要文本。
   * 调用注意事项：摘要必须明确来自本地 Markdown 快照，避免误解为 SQLite 测试库或实时 OpenAPI 请求结果。
   */
  private buildBusinessChainSnapshotSummary(
    snapshot: LianruanCrmOpenApiBusinessChainSnapshot,
    resources: BusinessChainSnapshotResource[],
    questionText: string,
  ): string {
    const parts: string[] = [];
    if (resources.includes('partners')) {
      parts.push(`合作伙伴 ${snapshot.partners.length} 家`);
    }
    if (resources.includes('registrations')) {
      parts.push(`客户报备 ${snapshot.registrations.length} 条`);
    }
    if (resources.includes('opportunities')) {
      parts.push(
        `商机 ${snapshot.opportunities.length} 条、金额 ${formatWanAmount(
          this.sumBusinessChainAmount('opportunities', snapshot.opportunities),
        )}`,
      );
    }
    if (resources.includes('quotes')) {
      parts.push(
        `报价 ${snapshot.quotes.length} 条、金额 ${formatWanAmount(
          this.sumBusinessChainAmount('quotes', snapshot.quotes),
        )}`,
      );
    }
    if (resources.includes('orders')) {
      parts.push(
        `订单 ${snapshot.orders.length} 条、金额 ${formatWanAmount(
          this.sumBusinessChainAmount('orders', snapshot.orders),
        )}`,
      );
    }

    const sourceLabel = 'CRM 已同步真实明细数据';
    const requirementLabel = this.resolveBusinessChainRequirementLabel(questionText, resources);
    return `已基于${sourceLabel}按${requirementLabel}完成只读分析：${parts.join('；')}。后续建议优先沿渠道商维度复核报备、商机推进和订单转化断点。`;
  }

  /**
   * 生成面向业务用户的本轮需求标签。
   *
   * 参数说明：`questionText` 为用户原文，`resources` 为本次读取对象。
   * 返回值说明：返回摘要中使用的中文需求口径。
   */
  private resolveBusinessChainRequirementLabel(
    questionText: string,
    resources: BusinessChainSnapshotResource[],
  ): string {
    const labels: string[] = [];
    const regionLabel = this.resolveRequestedRegionLabel(questionText, []);
    if (regionLabel) {
      labels.push(regionLabel);
    }
    if (resources.includes('partners')) {
      labels.push(/开拓|拓展|发展/u.test(questionText) ? '合作伙伴开拓' : '渠道商');
    }
    if (resources.includes('registrations')) {
      labels.push('客户报备');
    }
    if (resources.includes('opportunities')) {
      labels.push(/阶段|漏斗|分布/u.test(questionText) ? '商机阶段与明细' : '商机');
    }
    if (resources.includes('quotes')) {
      labels.push('报价');
    }
    if (resources.includes('orders')) {
      labels.push('订单');
    }

    return labels.length > 0 ? labels.join('、') : this.formatBusinessChainResourceLabel(resources);
  }

  /**
   * 构造渠道商经营贡献汇总行。
   *
   * 参数说明：`snapshot` 为四类 OpenAPI 真实明细。
   * 返回值说明：返回按渠道商聚合的报备数、商机数/金额和订单数/金额。
   * 调用注意事项：渠道名称优先使用 `/partners` 真实名称，其次使用各业务对象返回的渠道名称，不生成“渠道商001”占位。
   */
  private buildBusinessChainPartnerContributionRows(
    snapshot: LianruanCrmOpenApiBusinessChainSnapshot,
  ): Array<Record<string, unknown>> {
    const partnerNameMap = this.buildBusinessChainPartnerNameMap(snapshot);
    const rows = new Map<string, Record<string, unknown>>();
    const ensureRow = (record: StandardApiRecord): Record<string, unknown> => {
      const partnerId = this.resolvePartnerId(record);
      const partnerName = this.resolvePartnerName(record, partnerId, partnerNameMap);
      const existing = rows.get(partnerId);
      if (existing) {
        return existing;
      }

      const created = {
        partnerId,
        partnerName,
        ownerId: partnerId,
        ownerName: partnerName,
        bucket_label: partnerName,
        registrationCount: 0,
        opportunityCount: 0,
        opportunityAmount: 0,
        quoteCount: 0,
        quoteAmount: 0,
        orderCount: 0,
        orderAmount: 0,
        amount: 0,
        count: 0,
      };
      rows.set(partnerId, created);
      return created;
    };

    for (const partner of snapshot.partners) {
      ensureRow({
        ...partner,
        partnerId: partner.partnerId ?? partner.id,
        partnerName:
          partner.partnerName ?? partner.name ?? partner.displayName ?? partner.shortName,
      });
    }
    for (const registration of snapshot.registrations) {
      const row = ensureRow(registration);
      row.registrationCount = Number(row.registrationCount ?? 0) + 1;
      row.count = Number(row.count ?? 0) + 1;
    }
    for (const opportunity of snapshot.opportunities) {
      const amount = this.resolveAmount(this.buildBusinessChainTaskConfig('opportunities'), opportunity);
      const row = ensureRow(opportunity);
      row.opportunityCount = Number(row.opportunityCount ?? 0) + 1;
      row.opportunityAmount = Number(row.opportunityAmount ?? 0) + amount;
      row.amount = Number(row.amount ?? 0) + amount;
      row.count = Number(row.count ?? 0) + 1;
    }
    for (const quote of snapshot.quotes) {
      const amount = this.resolveAmount(this.buildBusinessChainTaskConfig('quotes'), quote);
      const row = ensureRow(quote);
      row.quoteCount = Number(row.quoteCount ?? 0) + 1;
      row.quoteAmount = Number(row.quoteAmount ?? 0) + amount;
      row.amount = Number(row.amount ?? 0) + amount;
      row.count = Number(row.count ?? 0) + 1;
    }
    for (const order of snapshot.orders) {
      const amount = this.resolveAmount(this.buildBusinessChainTaskConfig('orders'), order);
      const row = ensureRow(order);
      row.orderCount = Number(row.orderCount ?? 0) + 1;
      row.orderAmount = Number(row.orderAmount ?? 0) + amount;
      row.amount = Number(row.amount ?? 0) + amount;
      row.count = Number(row.count ?? 0) + 1;
    }

    const normalizedRows: Array<Record<string, unknown>> = [...rows.values()]
      .map((row): Record<string, unknown> => ({
        ...row,
        opportunityAmountText: formatWanAmount(Number(row.opportunityAmount ?? 0)),
        quoteAmountText: formatWanAmount(Number(row.quoteAmount ?? 0)),
        orderAmountText: formatWanAmount(Number(row.orderAmount ?? 0)),
        amountText: formatWanAmount(Number(row.amount ?? 0)),
      }));

    return this.enrichBusinessChainComparisonRows(
      normalizedRows.sort(
        (left, right) =>
          Number(right.orderAmount ?? 0) - Number(left.orderAmount ?? 0) ||
          Number(right.quoteAmount ?? 0) - Number(left.quoteAmount ?? 0) ||
          Number(right.opportunityAmount ?? 0) - Number(left.opportunityAmount ?? 0) ||
          Number(right.count ?? 0) - Number(left.count ?? 0),
      ),
      '渠道商',
    );
  }

  /**
   * 构造大区经营对比汇总行。
   *
   * 参数说明：`snapshot` 为本地 Markdown 快照读取到的业务链真实明细。
   * 返回值说明：返回按大区汇总的渠道、报备、商机、报价、订单和严格对比字段。
   * 调用注意事项：业务对象缺大区时优先用渠道商主数据补齐，仍缺失时归入“未填写大区”。
   */
  private buildBusinessChainBigRegionComparisonRows(
    snapshot: LianruanCrmOpenApiBusinessChainSnapshot,
  ): Array<Record<string, unknown>> {
    const partnerMetaMap = this.buildBusinessChainPartnerMetaMap(snapshot.partners);
    const rows = new Map<string, Record<string, unknown>>();
    const ensureRow = (record: StandardApiRecord): Record<string, unknown> => {
      const partnerId = this.resolvePartnerId(record);
      const partnerMeta = partnerMetaMap.get(partnerId);
      const bigRegion = this.readText(record.bigRegion ?? partnerMeta?.bigRegion) || '未填写大区';
      const existing = rows.get(bigRegion);
      if (existing) {
        return existing;
      }

      const created = {
        ownerId: bigRegion,
        ownerName: bigRegion,
        bucket_label: bigRegion,
        bigRegion,
        partnerCount: 0,
        registrationCount: 0,
        opportunityCount: 0,
        opportunityAmount: 0,
        quoteCount: 0,
        quoteAmount: 0,
        orderCount: 0,
        orderAmount: 0,
        amount: 0,
        count: 0,
      };
      rows.set(bigRegion, created);
      return created;
    };

    for (const partner of snapshot.partners) {
      const row = ensureRow({
        ...partner,
        partnerId: partner.partnerId ?? partner.id,
      });
      row.partnerCount = Number(row.partnerCount ?? 0) + 1;
      row.count = Number(row.count ?? 0) + 1;
    }
    for (const registration of snapshot.registrations) {
      const row = ensureRow(registration);
      row.registrationCount = Number(row.registrationCount ?? 0) + 1;
      row.count = Number(row.count ?? 0) + 1;
    }
    for (const opportunity of snapshot.opportunities) {
      const amount = this.resolveAmount(this.buildBusinessChainTaskConfig('opportunities'), opportunity);
      const row = ensureRow(opportunity);
      row.opportunityCount = Number(row.opportunityCount ?? 0) + 1;
      row.opportunityAmount = Number(row.opportunityAmount ?? 0) + amount;
      row.amount = Number(row.amount ?? 0) + amount;
      row.count = Number(row.count ?? 0) + 1;
    }
    for (const quote of snapshot.quotes) {
      const amount = this.resolveAmount(this.buildBusinessChainTaskConfig('quotes'), quote);
      const row = ensureRow(quote);
      row.quoteCount = Number(row.quoteCount ?? 0) + 1;
      row.quoteAmount = Number(row.quoteAmount ?? 0) + amount;
      row.amount = Number(row.amount ?? 0) + amount;
      row.count = Number(row.count ?? 0) + 1;
    }
    for (const order of snapshot.orders) {
      const amount = this.resolveAmount(this.buildBusinessChainTaskConfig('orders'), order);
      const row = ensureRow(order);
      row.orderCount = Number(row.orderCount ?? 0) + 1;
      row.orderAmount = Number(row.orderAmount ?? 0) + amount;
      row.amount = Number(row.amount ?? 0) + amount;
      row.count = Number(row.count ?? 0) + 1;
    }

    const normalizedRows = [...rows.values()].map((row): Record<string, unknown> => ({
      ...row,
      opportunityAmountText: formatWanAmount(Number(row.opportunityAmount ?? 0)),
      quoteAmountText: formatWanAmount(Number(row.quoteAmount ?? 0)),
      orderAmountText: formatWanAmount(Number(row.orderAmount ?? 0)),
      amountText: formatWanAmount(Number(row.amount ?? 0)),
    }));

    return this.enrichBusinessChainComparisonRows(
      normalizedRows.sort(
        (left, right) =>
          Number(right.orderAmount ?? 0) - Number(left.orderAmount ?? 0) ||
          Number(right.quoteAmount ?? 0) - Number(left.quoteAmount ?? 0) ||
          Number(right.opportunityAmount ?? 0) - Number(left.opportunityAmount ?? 0) ||
          Number(right.count ?? 0) - Number(left.count ?? 0),
      ),
      '大区',
    );
  }

  /**
   * 构造区域经营对比汇总行。
   *
   * 参数说明：`snapshot` 为本地 Markdown 快照读取到的业务链真实明细。
   * 返回值说明：返回按区域/大区汇总的渠道数、报备数、商机数/金额、报价数/金额和订单数/金额。
   * 调用注意事项：业务对象缺区域时优先使用渠道商主数据补齐；仍缺失时归入“未填写区域”，不补造区域名称。
   */
  private buildBusinessChainRegionComparisonRows(
    snapshot: LianruanCrmOpenApiBusinessChainSnapshot,
  ): Array<Record<string, unknown>> {
    const partnerMetaMap = this.buildBusinessChainPartnerMetaMap(snapshot.partners);
    const rows = new Map<string, Record<string, unknown>>();
    const ensureRow = (record: StandardApiRecord): Record<string, unknown> => {
      const partnerId = this.resolvePartnerId(record);
      const partnerMeta = partnerMetaMap.get(partnerId);
      const region = this.readText(record.region ?? partnerMeta?.region) || '未填写区域';
      const bigRegion = this.readText(record.bigRegion ?? partnerMeta?.bigRegion) || '未填写大区';
      const rowKey = `${bigRegion}::${region}`;
      const existing = rows.get(rowKey);
      if (existing) {
        return existing;
      }

      const created = {
        ownerId: rowKey,
        ownerName: region === bigRegion ? region : `${bigRegion}/${region}`,
        bucket_label: region === bigRegion ? region : `${bigRegion}/${region}`,
        region,
        bigRegion,
        partnerCount: 0,
        registrationCount: 0,
        opportunityCount: 0,
        opportunityAmount: 0,
        quoteCount: 0,
        quoteAmount: 0,
        orderCount: 0,
        orderAmount: 0,
        amount: 0,
        count: 0,
      };
      rows.set(rowKey, created);
      return created;
    };

    for (const partner of snapshot.partners) {
      const row = ensureRow({
        ...partner,
        partnerId: partner.partnerId ?? partner.id,
      });
      row.partnerCount = Number(row.partnerCount ?? 0) + 1;
      row.count = Number(row.count ?? 0) + 1;
    }
    for (const registration of snapshot.registrations) {
      const row = ensureRow(registration);
      row.registrationCount = Number(row.registrationCount ?? 0) + 1;
      row.count = Number(row.count ?? 0) + 1;
    }
    for (const opportunity of snapshot.opportunities) {
      const amount = this.resolveAmount(this.buildBusinessChainTaskConfig('opportunities'), opportunity);
      const row = ensureRow(opportunity);
      row.opportunityCount = Number(row.opportunityCount ?? 0) + 1;
      row.opportunityAmount = Number(row.opportunityAmount ?? 0) + amount;
      row.amount = Number(row.amount ?? 0) + amount;
      row.count = Number(row.count ?? 0) + 1;
    }
    for (const quote of snapshot.quotes) {
      const amount = this.resolveAmount(this.buildBusinessChainTaskConfig('quotes'), quote);
      const row = ensureRow(quote);
      row.quoteCount = Number(row.quoteCount ?? 0) + 1;
      row.quoteAmount = Number(row.quoteAmount ?? 0) + amount;
      row.amount = Number(row.amount ?? 0) + amount;
      row.count = Number(row.count ?? 0) + 1;
    }
    for (const order of snapshot.orders) {
      const amount = this.resolveAmount(this.buildBusinessChainTaskConfig('orders'), order);
      const row = ensureRow(order);
      row.orderCount = Number(row.orderCount ?? 0) + 1;
      row.orderAmount = Number(row.orderAmount ?? 0) + amount;
      row.amount = Number(row.amount ?? 0) + amount;
      row.count = Number(row.count ?? 0) + 1;
    }

    const normalizedRows = [...rows.values()].map((row): Record<string, unknown> => ({
      ...row,
      opportunityAmountText: formatWanAmount(Number(row.opportunityAmount ?? 0)),
      quoteAmountText: formatWanAmount(Number(row.quoteAmount ?? 0)),
      orderAmountText: formatWanAmount(Number(row.orderAmount ?? 0)),
      amountText: formatWanAmount(Number(row.amount ?? 0)),
    }));

    return this.enrichBusinessChainComparisonRows(
      normalizedRows.sort(
        (left, right) =>
          Number(right.orderAmount ?? 0) - Number(left.orderAmount ?? 0) ||
          Number(right.quoteAmount ?? 0) - Number(left.quoteAmount ?? 0) ||
          Number(right.opportunityAmount ?? 0) - Number(left.opportunityAmount ?? 0) ||
          Number(right.count ?? 0) - Number(left.count ?? 0),
      ),
      '区域',
    );
  }

  /**
   * 构造销售负责人经营对比汇总行。
   *
   * 参数说明：`snapshot` 为本地 Markdown 快照读取到的业务链真实明细。
   * 返回值说明：返回按销售负责人聚合的报备、商机、报价、订单和行级建议。
   * 调用注意事项：渠道商主数据没有明确负责人时不纳入销售维度，避免把渠道归属误当销售业绩。
   */
  private buildBusinessChainSalesContributionRows(
    snapshot: LianruanCrmOpenApiBusinessChainSnapshot,
  ): Array<Record<string, unknown>> {
    const rows = new Map<string, Record<string, unknown>>();
    const ensureRow = (record: StandardApiRecord): Record<string, unknown> => {
      const ownerId = this.resolveOwnerId(record);
      const ownerName = this.resolveOwnerName(record, ownerId);
      const existing = rows.get(ownerId);
      if (existing) {
        return existing;
      }

      const created = {
        ownerId,
        ownerName,
        bucket_label: ownerName,
        registrationCount: 0,
        opportunityCount: 0,
        opportunityAmount: 0,
        quoteCount: 0,
        quoteAmount: 0,
        orderCount: 0,
        orderAmount: 0,
        amount: 0,
        count: 0,
      };
      rows.set(ownerId, created);
      return created;
    };

    for (const registration of snapshot.registrations) {
      const row = ensureRow(registration);
      row.registrationCount = Number(row.registrationCount ?? 0) + 1;
      row.count = Number(row.count ?? 0) + 1;
    }
    for (const opportunity of snapshot.opportunities) {
      const amount = this.resolveAmount(this.buildBusinessChainTaskConfig('opportunities'), opportunity);
      const row = ensureRow(opportunity);
      row.opportunityCount = Number(row.opportunityCount ?? 0) + 1;
      row.opportunityAmount = Number(row.opportunityAmount ?? 0) + amount;
      row.amount = Number(row.amount ?? 0) + amount;
      row.count = Number(row.count ?? 0) + 1;
    }
    for (const quote of snapshot.quotes) {
      const amount = this.resolveAmount(this.buildBusinessChainTaskConfig('quotes'), quote);
      const row = ensureRow(quote);
      row.quoteCount = Number(row.quoteCount ?? 0) + 1;
      row.quoteAmount = Number(row.quoteAmount ?? 0) + amount;
      row.amount = Number(row.amount ?? 0) + amount;
      row.count = Number(row.count ?? 0) + 1;
    }
    for (const order of snapshot.orders) {
      const amount = this.resolveAmount(this.buildBusinessChainTaskConfig('orders'), order);
      const row = ensureRow(order);
      row.orderCount = Number(row.orderCount ?? 0) + 1;
      row.orderAmount = Number(row.orderAmount ?? 0) + amount;
      row.amount = Number(row.amount ?? 0) + amount;
      row.count = Number(row.count ?? 0) + 1;
    }

    const normalizedRows = [...rows.values()].map((row): Record<string, unknown> => ({
      ...row,
      opportunityAmountText: formatWanAmount(Number(row.opportunityAmount ?? 0)),
      quoteAmountText: formatWanAmount(Number(row.quoteAmount ?? 0)),
      orderAmountText: formatWanAmount(Number(row.orderAmount ?? 0)),
      amountText: formatWanAmount(Number(row.amount ?? 0)),
    }));

    return this.enrichBusinessChainComparisonRows(
      normalizedRows.sort(
        (left, right) =>
          Number(right.orderAmount ?? 0) - Number(left.orderAmount ?? 0) ||
          Number(right.opportunityAmount ?? 0) - Number(left.opportunityAmount ?? 0) ||
          Number(right.count ?? 0) - Number(left.count ?? 0),
      ),
      '销售负责人',
    );
  }

  /**
   * 构造订单承接对比行。
   *
   * 参数说明：`snapshot` 为本地 Markdown 快照读取到的业务链真实明细。
   * 返回值说明：返回以区域为承接单元的商机到订单对比结果。
   * 调用注意事项：该视图复用区域经营结果，只突出订单承接率和订单占比，避免重复取数。
   */
  private buildBusinessChainOrderFulfillmentRows(
    snapshot: LianruanCrmOpenApiBusinessChainSnapshot,
  ): Array<Record<string, unknown>> {
    return this.buildBusinessChainRegionComparisonRows(snapshot)
      .map((row): Record<string, unknown> => ({
        ...row,
        orderFulfillmentRate: this.formatBusinessChainPercent(
          this.resolveFiniteNumber(row.orderAmount),
          this.resolveFiniteNumber(row.opportunityAmount),
        ),
      }))
      .sort(
        (left, right) =>
          Number(right.orderAmount ?? 0) - Number(left.orderAmount ?? 0) ||
          Number(right.opportunityAmount ?? 0) - Number(left.opportunityAmount ?? 0),
      );
  }

  /**
   * 构造分销层级健康汇总行。
   *
   * 参数说明：`snapshot` 为本地 Markdown 快照读取到的业务链真实明细。
   * 返回值说明：返回一级渠道、二级渠道、无层级渠道和其它层级的数量与业务贡献。
   * 调用注意事项：当前快照没有一级确认耗时和拒绝原因时，只统计父级绑定、父级链和贡献，不声明流程已顺畅。
   */
  private buildBusinessChainDistributionHierarchyRows(
    snapshot: LianruanCrmOpenApiBusinessChainSnapshot,
  ): Array<Record<string, unknown>> {
    const partnerMetaMap = this.buildBusinessChainPartnerMetaMap(snapshot.partners);
    const rows = new Map<string, Record<string, unknown>>();
    const ensureRow = (record: StandardApiRecord): Record<string, unknown> => {
      const partnerId = this.resolvePartnerId(record);
      const partnerMeta = partnerMetaMap.get(partnerId);
      const hierarchyLabel = this.resolveBusinessChainDistributionHierarchyLabel(
        record,
        partnerMeta,
      );
      const existing = rows.get(hierarchyLabel);
      if (existing) {
        return existing;
      }

      const created = {
        ownerId: hierarchyLabel,
        ownerName: hierarchyLabel,
        bucket_label: hierarchyLabel,
        hierarchyLevel: hierarchyLabel,
        partnerCount: 0,
        parentLinkedPartnerCount: 0,
        registrationCount: 0,
        opportunityCount: 0,
        opportunityAmount: 0,
        quoteCount: 0,
        quoteAmount: 0,
        orderCount: 0,
        orderAmount: 0,
        amount: 0,
        count: 0,
        gapNote: '当前快照未提供一级确认耗时、拒绝原因和多上级审批流字段，流程顺畅度需补字段后复核。',
      };
      rows.set(hierarchyLabel, created);
      return created;
    };

    for (const partner of snapshot.partners) {
      const row = ensureRow({
        ...partner,
        partnerId: partner.partnerId ?? partner.id,
      });
      row.partnerCount = Number(row.partnerCount ?? 0) + 1;
      row.count = Number(row.count ?? 0) + 1;
      if (this.hasBusinessChainParentPartner(partner)) {
        row.parentLinkedPartnerCount = Number(row.parentLinkedPartnerCount ?? 0) + 1;
      }
    }
    for (const registration of snapshot.registrations) {
      const row = ensureRow(registration);
      row.registrationCount = Number(row.registrationCount ?? 0) + 1;
      row.count = Number(row.count ?? 0) + 1;
    }
    for (const opportunity of snapshot.opportunities) {
      const amount = this.resolveAmount(this.buildBusinessChainTaskConfig('opportunities'), opportunity);
      const row = ensureRow(opportunity);
      row.opportunityCount = Number(row.opportunityCount ?? 0) + 1;
      row.opportunityAmount = Number(row.opportunityAmount ?? 0) + amount;
      row.amount = Number(row.amount ?? 0) + amount;
      row.count = Number(row.count ?? 0) + 1;
    }
    for (const quote of snapshot.quotes) {
      const amount = this.resolveAmount(this.buildBusinessChainTaskConfig('quotes'), quote);
      const row = ensureRow(quote);
      row.quoteCount = Number(row.quoteCount ?? 0) + 1;
      row.quoteAmount = Number(row.quoteAmount ?? 0) + amount;
      row.amount = Number(row.amount ?? 0) + amount;
      row.count = Number(row.count ?? 0) + 1;
    }
    for (const order of snapshot.orders) {
      const amount = this.resolveAmount(this.buildBusinessChainTaskConfig('orders'), order);
      const row = ensureRow(order);
      row.orderCount = Number(row.orderCount ?? 0) + 1;
      row.orderAmount = Number(row.orderAmount ?? 0) + amount;
      row.amount = Number(row.amount ?? 0) + amount;
      row.count = Number(row.count ?? 0) + 1;
    }

    const normalizedRows = [...rows.values()].map((row): Record<string, unknown> => ({
      ...row,
      opportunityAmountText: formatWanAmount(Number(row.opportunityAmount ?? 0)),
      quoteAmountText: formatWanAmount(Number(row.quoteAmount ?? 0)),
      orderAmountText: formatWanAmount(Number(row.orderAmount ?? 0)),
      amountText: formatWanAmount(Number(row.amount ?? 0)),
    }));

    return normalizedRows.sort(
      (left, right) =>
        this.resolveBusinessChainHierarchySortWeight(String(left.hierarchyLevel ?? '')) -
          this.resolveBusinessChainHierarchySortWeight(String(right.hierarchyLevel ?? '')) ||
        Number(right.orderAmount ?? 0) - Number(left.orderAmount ?? 0) ||
        Number(right.count ?? 0) - Number(left.count ?? 0),
    );
  }

  /**
   * 构造技术服务商生态汇总行。
   *
   * 参数说明：`snapshot` 为本地 Markdown 快照读取到的业务链真实明细。
   * 返回值说明：返回签约技术服务商、提名技术服务商、普通渠道和未标注渠道的数量与业务贡献。
   * 调用注意事项：只使用快照中的技术服务商标记和类型字段；缺交付能力字段时不推断项目推进因果。
   */
  private buildBusinessChainTechnicalServiceRows(
    snapshot: LianruanCrmOpenApiBusinessChainSnapshot,
  ): Array<Record<string, unknown>> {
    const partnerMetaMap = this.buildBusinessChainPartnerMetaMap(snapshot.partners);
    const rows = new Map<string, Record<string, unknown>>();
    const ensureRow = (record: StandardApiRecord): Record<string, unknown> => {
      const partnerId = this.resolvePartnerId(record);
      const partnerMeta = partnerMetaMap.get(partnerId);
      const ecosystemLabel = this.resolveBusinessChainTechnicalServiceLabel(record, partnerMeta);
      const existing = rows.get(ecosystemLabel);
      if (existing) {
        return existing;
      }

      const created = {
        ownerId: ecosystemLabel,
        ownerName: ecosystemLabel,
        bucket_label: ecosystemLabel,
        technicalServiceType: ecosystemLabel,
        partnerCount: 0,
        registrationCount: 0,
        opportunityCount: 0,
        opportunityAmount: 0,
        quoteCount: 0,
        quoteAmount: 0,
        orderCount: 0,
        orderAmount: 0,
        amount: 0,
        count: 0,
        gapNote: '当前快照未提供技术交流、测试进度和交付能力评分字段，生态贡献只能按覆盖与业务链结果判断。',
      };
      rows.set(ecosystemLabel, created);
      return created;
    };

    for (const partner of snapshot.partners) {
      const row = ensureRow({
        ...partner,
        partnerId: partner.partnerId ?? partner.id,
      });
      row.partnerCount = Number(row.partnerCount ?? 0) + 1;
      row.count = Number(row.count ?? 0) + 1;
    }
    for (const registration of snapshot.registrations) {
      const row = ensureRow(registration);
      row.registrationCount = Number(row.registrationCount ?? 0) + 1;
      row.count = Number(row.count ?? 0) + 1;
    }
    for (const opportunity of snapshot.opportunities) {
      const amount = this.resolveAmount(this.buildBusinessChainTaskConfig('opportunities'), opportunity);
      const row = ensureRow(opportunity);
      row.opportunityCount = Number(row.opportunityCount ?? 0) + 1;
      row.opportunityAmount = Number(row.opportunityAmount ?? 0) + amount;
      row.amount = Number(row.amount ?? 0) + amount;
      row.count = Number(row.count ?? 0) + 1;
    }
    for (const quote of snapshot.quotes) {
      const amount = this.resolveAmount(this.buildBusinessChainTaskConfig('quotes'), quote);
      const row = ensureRow(quote);
      row.quoteCount = Number(row.quoteCount ?? 0) + 1;
      row.quoteAmount = Number(row.quoteAmount ?? 0) + amount;
      row.amount = Number(row.amount ?? 0) + amount;
      row.count = Number(row.count ?? 0) + 1;
    }
    for (const order of snapshot.orders) {
      const amount = this.resolveAmount(this.buildBusinessChainTaskConfig('orders'), order);
      const row = ensureRow(order);
      row.orderCount = Number(row.orderCount ?? 0) + 1;
      row.orderAmount = Number(row.orderAmount ?? 0) + amount;
      row.amount = Number(row.amount ?? 0) + amount;
      row.count = Number(row.count ?? 0) + 1;
    }

    const normalizedRows = [...rows.values()].map((row): Record<string, unknown> => ({
      ...row,
      opportunityAmountText: formatWanAmount(Number(row.opportunityAmount ?? 0)),
      quoteAmountText: formatWanAmount(Number(row.quoteAmount ?? 0)),
      orderAmountText: formatWanAmount(Number(row.orderAmount ?? 0)),
      amountText: formatWanAmount(Number(row.amount ?? 0)),
    }));

    return normalizedRows.sort(
      (left, right) =>
        this.resolveBusinessChainTechnicalServiceSortWeight(String(left.technicalServiceType ?? '')) -
          this.resolveBusinessChainTechnicalServiceSortWeight(String(right.technicalServiceType ?? '')) ||
        Number(right.orderAmount ?? 0) - Number(left.orderAmount ?? 0) ||
        Number(right.count ?? 0) - Number(left.count ?? 0),
    );
  }

  /**
   * 构造合作伙伴真实明细行。
   *
   * 参数说明：`records` 为 `/partners` 返回记录。
   * 返回值说明：返回只含展示必要字段的合作伙伴明细。
   * 调用注意事项：不展示联系人、手机号、邮箱等未进入白名单的敏感字段。
   */
  private buildBusinessChainPartnerDetailRows(records: StandardApiRecord[]): Array<Record<string, unknown>> {
    return records.map((record) => {
      const partnerId = this.readText(record.id ?? record.partnerId);
      const totalAmount = this.resolveFiniteNumber(record.totalAmount ?? record.totalAmt ?? record.amount);
      return {
        partnerId,
        partnerName:
          this.readText(record.partnerName ?? record.name ?? record.displayName ?? record.shortName) ||
          partnerId ||
          '未命名合作伙伴',
        partnerLevel: this.readText(record.partnerLevelName ?? record.partnerLevel ?? record.level) || '未填写等级',
        partnerType: this.readText(record.partnerTypeName ?? record.partnerType) || undefined,
        technicalServiceProvider: this.resolveTechnicalServiceProviderFlag(record)
          ? '技术服务商'
          : '非技术服务商',
        technicalServiceProviderType:
          this.readText(record.technicalServiceProviderType ?? record.techServiceType) || undefined,
        region: this.readText(record.region ?? record.bigRegion) || undefined,
        status: this.resolveBusinessLabel(this.readText(record.status)) || undefined,
        quoteCount: this.resolveFiniteNumber(record.quoteCount),
        orderCount: this.resolveFiniteNumber(record.orderCount),
        totalAmount,
        totalAmountText: totalAmount > 0 ? formatWanAmount(totalAmount) : undefined,
        joinDate: this.readText(record.joinDate) || undefined,
        createdAt: this.readText(record.createdAt) || undefined,
        updatedAt: this.readText(record.updatedAt) || undefined,
      };
    });
  }

  /**
   * 构造客户报备真实明细行。
   *
   * 参数说明：`records` 为 `/registrations` 返回记录。
   * 返回值说明：返回客户、渠道商、关联商机和报备状态明细。
   * 调用注意事项：报备只展示经营分析必要字段，避免扩大客户隐私字段范围。
   */
  private buildBusinessChainRegistrationDetailRows(records: StandardApiRecord[]): Array<Record<string, unknown>> {
    return records.map((record) => ({
      registrationId: this.readText(record.registrationId ?? record.id),
      customerName: this.readText(record.customerName ?? record.customer) || '未命名客户',
      partnerName:
        this.readText(record.partnerName ?? record.assignedPartnerName) ||
        this.readText(record.partnerId ?? record.assignedPartnerId) ||
        '未填写渠道商',
      opportunityName: this.readText(record.opportunityName) || undefined,
      statusName: this.readText(record.statusName ?? record.status) || '未填写状态',
      ownerName: this.readText(record.ownerName ?? record.assignedStaffName) || undefined,
      region: this.readText(record.region ?? record.bigRegion) || undefined,
      approvedAt: this.readText(record.approvedAt) || undefined,
      expireAt: this.readText(record.expireAt) || undefined,
      createdAt: this.readText(record.createdAt) || undefined,
      updatedAt: this.readText(record.updatedAt) || undefined,
    }));
  }

  /**
   * 构造商机真实明细行。
   *
   * 参数说明：`records` 为 `/opportunities` 返回记录。
   * 返回值说明：返回商机名称、客户、渠道商、阶段、金额和负责人等明细。
   * 调用注意事项：阶段显示使用联软字典或本地中文释义，不直接暴露英文枚举。
   */
  private buildBusinessChainOpportunityDetailRows(records: StandardApiRecord[]): Array<Record<string, unknown>> {
    const taskConfig = this.buildBusinessChainTaskConfig('opportunities');
    return records.map((record) => {
      const opportunityId = this.resolveOpportunityId(record);
      const amount = this.resolveAmount(taskConfig, record);
      return {
        opportunityId,
        opportunityName:
          this.readText(record.opportunityName ?? record.name ?? record.title) ||
          opportunityId ||
          '未命名商机',
        customerName: this.readText(record.customerName ?? record.customer) || '未命名客户',
        partnerName:
          this.readText(record.partnerName ?? record.assignedPartnerName) ||
          this.readText(record.partnerId ?? record.assignedPartnerId) ||
          '未填写渠道商',
        stageName:
          formatOpportunityStageLabel(
            this.readText(record.stageName ?? record.stage ?? record.statusName ?? record.status),
          ) || '未填写阶段',
        statusName:
          formatOpportunityStageLabel(this.readText(record.statusName ?? record.status)) ||
          this.readText(record.statusName ?? record.status) ||
          undefined,
        amount,
        amountText: formatWanAmount(amount),
        ownerName: this.readText(record.ownerName ?? record.assignedStaffName) || undefined,
        region: this.readText(record.region ?? record.bigRegion) || undefined,
        expectedClose: this.readText(record.expectedClose) || undefined,
        createdAt: this.readText(record.createdAt) || undefined,
        updatedAt: this.readText(record.updatedAt) || undefined,
      };
    });
  }

  /**
   * 构造报价真实明细行。
   *
   * 参数说明：`records` 为 `/quotes` 返回记录。
   * 返回值说明：返回报价编号、客户、商机、渠道商、状态和金额明细。
   * 调用注意事项：报价金额只读取报价对象字段，不用商机或订单金额兜底。
   */
  private buildBusinessChainQuoteDetailRows(records: StandardApiRecord[]): Array<Record<string, unknown>> {
    const taskConfig = this.buildBusinessChainTaskConfig('quotes');
    return records.map((record) => {
      const quoteId = this.readText(record.quoteId ?? record.id ?? record.quoteNo);
      const amount = this.resolveAmount(taskConfig, record);
      return {
        quoteId,
        quoteNo: this.readText(record.quoteNo) || quoteId || undefined,
        quoteName: this.readText(record.quoteName ?? record.name) || quoteId || '未命名报价',
        customerName: this.readText(record.customerName ?? record.customer) || '未命名客户',
        opportunityName: this.readText(record.opportunityName) || undefined,
        partnerName:
          this.readText(record.partnerName ?? record.assignedPartnerName) ||
          this.readText(record.partnerId ?? record.assignedPartnerId) ||
          '未填写渠道商',
        statusName: this.readText(record.statusName ?? record.status) || '未填写状态',
        amount,
        amountText: formatWanAmount(amount),
        ownerName: this.readText(record.ownerName ?? record.assignedStaffName) || undefined,
        region: this.readText(record.region ?? record.bigRegion) || undefined,
        validUntil: this.readText(record.validUntil ?? record.expireAt) || undefined,
        expectedClose: this.readText(record.expectedClose) || undefined,
        createdAt: this.readText(record.createdAt) || undefined,
        updatedAt: this.readText(record.updatedAt) || undefined,
      };
    });
  }

  /**
   * 构造订单真实明细行。
   *
   * 参数说明：`records` 为 `/orders` 返回记录。
   * 返回值说明：返回订单编号/名称、客户、渠道商、关联商机、状态和金额明细。
   * 调用注意事项：订单金额只读取订单对象金额字段，不用商机金额或报价金额兜底。
   */
  private buildBusinessChainOrderDetailRows(records: StandardApiRecord[]): Array<Record<string, unknown>> {
    const taskConfig = this.buildBusinessChainTaskConfig('orders');
    return records.map((record) => {
      const orderId = this.readText(record.orderId ?? record.id ?? record.orderNo);
      const amount = this.resolveAmount(taskConfig, record);
      return {
        orderId,
        orderNo: this.readText(record.orderNo) || orderId || undefined,
        orderName: this.readText(record.orderName ?? record.name) || orderId || '未命名订单',
        customerName: this.readText(record.customerName ?? record.customer) || '未命名客户',
        partnerName:
          this.readText(record.partnerName ?? record.assignedPartnerName) ||
          this.readText(record.partnerId ?? record.assignedPartnerId) ||
          '未填写渠道商',
        opportunityName: this.readText(record.opportunityName) || undefined,
        statusName: this.readText(record.statusName ?? record.status) || '未填写状态',
        amount,
        amountText: formatWanAmount(amount),
        ownerName: this.readText(record.ownerName ?? record.assignedStaffName) || undefined,
        region: this.readText(record.region ?? record.bigRegion) || undefined,
        dealAt: this.readText(record.dealAt ?? record.completedAt) || undefined,
        createdAt: this.readText(record.createdAt) || undefined,
        updatedAt: this.readText(record.updatedAt) || undefined,
      };
    });
  }

  /**
   * 汇总业务链对象金额。
   *
   * 参数说明：`resource` 为业务对象，`records` 为该对象真实记录。
   * 返回值说明：返回元级金额合计。
   * 调用注意事项：该函数复用对象级金额读取规则，避免跨对象字段误算。
   */
  private sumBusinessChainAmount(
    resource: BusinessChainSnapshotResource,
    records: StandardApiRecord[],
  ): number {
    const taskConfig = this.buildBusinessChainTaskConfig(resource);
    return records.reduce((sum, record) => sum + this.resolveAmount(taskConfig, record), 0);
  }

  /**
   * 构造业务链渠道商名称映射。
   *
   * 参数说明：`snapshot` 为 OpenAPI 真实明细快照。
   * 返回值说明：返回渠道商 ID 到渠道商名称的映射。
   * 调用注意事项：映射只用于本次请求内展示增强，不写回 CRM，也不缓存到持久化分析库。
   */
  private buildBusinessChainPartnerNameMap(
    snapshot: LianruanCrmOpenApiBusinessChainSnapshot,
  ): Map<string, string> {
    const partnerNameMap = new Map<string, string>();
    for (const partner of snapshot.partners) {
      const partnerId = this.readText(partner.id ?? partner.partnerId);
      const partnerName = this.readText(
        partner.partnerName ?? partner.name ?? partner.displayName ?? partner.shortName,
      );
      if (partnerId && partnerName) {
        partnerNameMap.set(partnerId, partnerName);
      }
    }

    return partnerNameMap;
  }

  /**
   * 构造渠道商元数据映射。
   *
   * 参数说明：`partners` 为渠道商 Markdown 快照记录。
   * 返回值说明：返回渠道 ID 到区域、层级、父级和技术服务商属性的映射。
   * 调用注意事项：该映射只服务本次聚合补齐，不持久化、不反写 CRM。
   */
  private buildBusinessChainPartnerMetaMap(
    partners: StandardApiRecord[],
  ): Map<string, BusinessChainPartnerMeta> {
    const partnerMetaMap = new Map<string, BusinessChainPartnerMeta>();
    for (const partner of partners) {
      const partnerId = this.readText(partner.partnerId ?? partner.id);
      if (!partnerId) {
        continue;
      }

      partnerMetaMap.set(partnerId, {
        partnerId,
        partnerName:
          this.readText(partner.partnerName ?? partner.name ?? partner.displayName ?? partner.shortName) ||
          partnerId,
        partnerLevel: this.readText(partner.partnerLevelName ?? partner.partnerLevel ?? partner.level),
        partnerType: this.readText(partner.partnerTypeName ?? partner.partnerType),
        technicalServiceProviderType: this.readText(
          partner.technicalServiceProviderType ?? partner.techServiceType,
        ),
        isTechnicalServiceProvider: this.resolveTechnicalServiceProviderFlag(partner),
        parentPartnerId: this.readText(partner.parentPartnerId),
        parentPartnerIds: this.readText(partner.parentPartnerIds),
        region: this.readText(partner.region),
        bigRegion: this.readText(partner.bigRegion),
      });
    }

    return partnerMetaMap;
  }

  /**
   * 解析渠道分销层级标签。
   *
   * 参数说明：`record` 为业务对象记录，`partnerMeta` 为渠道主数据补齐信息。
   * 返回值说明：返回一级渠道、二级渠道、无层级渠道或其它层级。
   * 调用注意事项：优先使用渠道主数据等级，业务对象仅作为缺失兜底。
   */
  private resolveBusinessChainDistributionHierarchyLabel(
    record: StandardApiRecord,
    partnerMeta?: BusinessChainPartnerMeta,
  ): string {
    const levelText = this.readText(
      partnerMeta?.partnerLevel ?? record.partnerLevelName ?? record.partnerLevel ?? record.level,
    );
    const normalizedLevelText = this.normalizeComparableText(levelText);
    if (/一级/u.test(normalizedLevelText)) {
      return '一级渠道';
    }

    if (/二级/u.test(normalizedLevelText)) {
      return '二级渠道';
    }

    if (!normalizedLevelText || /^(未设置|未填写|无|none|null|undefined)$/iu.test(normalizedLevelText)) {
      return '无层级渠道';
    }

    return '其它层级渠道';
  }

  /**
   * 判断渠道是否存在父级归属。
   *
   * 参数说明：`record` 为渠道商或业务对象记录。
   * 返回值说明：存在父级渠道 ID 或父级渠道链时返回 `true`。
   * 调用注意事项：只做字段存在性判断，不推断父级关系是否已审批生效。
   */
  private hasBusinessChainParentPartner(record: StandardApiRecord): boolean {
    return Boolean(
      this.readText(record.parentPartnerId) ||
        this.readText(record.parentPartnerIds) ||
        this.readText(record.parentPartnerName),
    );
  }

  /**
   * 解析技术服务商生态标签。
   *
   * 参数说明：`record` 为业务对象记录，`partnerMeta` 为渠道主数据补齐信息。
   * 返回值说明：返回签约技术服务商、提名技术服务商、普通渠道或未标注渠道。
   * 调用注意事项：只按快照字段判断，缺少字段时明确归入未标注渠道。
   */
  private resolveBusinessChainTechnicalServiceLabel(
    record: StandardApiRecord,
    partnerMeta?: BusinessChainPartnerMeta,
  ): string {
    const typeText = this.readText(
      partnerMeta?.technicalServiceProviderType ??
        record.technicalServiceProviderType ??
        record.techServiceType,
    );
    const partnerTypeText = this.readText(partnerMeta?.partnerType ?? record.partnerTypeName ?? record.partnerType);
    const isTechnicalServiceProvider =
      partnerMeta?.isTechnicalServiceProvider ?? this.resolveTechnicalServiceProviderFlag(record);
    const normalizedTypeText = this.normalizeComparableText(typeText);

    if (isTechnicalServiceProvider && /^(full|签约|正式|contracted|signed)$/iu.test(normalizedTypeText)) {
      return '签约技术服务商';
    }

    if (
      isTechnicalServiceProvider &&
      /^(nominated|nominate|提名|developing|培育|发展中)$/iu.test(normalizedTypeText)
    ) {
      return '提名技术服务商';
    }

    if (isTechnicalServiceProvider || /技术服务商/u.test(partnerTypeText)) {
      return '其它技术服务商';
    }

    if (!typeText && !partnerTypeText) {
      return '未标注渠道';
    }

    return '普通渠道';
  }

  /**
   * 返回分销层级排序权重。
   *
   * 参数说明：`hierarchyLevel` 为聚合后的层级标签。
   * 返回值说明：权重越小展示越靠前。
   */
  private resolveBusinessChainHierarchySortWeight(hierarchyLevel: string): number {
    const weightMap: Record<string, number> = {
      一级渠道: 1,
      二级渠道: 2,
      无层级渠道: 3,
      其它层级渠道: 4,
    };
    return weightMap[hierarchyLevel] ?? 9;
  }

  /**
   * 返回技术服务商生态排序权重。
   *
   * 参数说明：`technicalServiceType` 为聚合后的生态标签。
   * 返回值说明：权重越小展示越靠前。
   */
  private resolveBusinessChainTechnicalServiceSortWeight(technicalServiceType: string): number {
    const weightMap: Record<string, number> = {
      签约技术服务商: 1,
      提名技术服务商: 2,
      其它技术服务商: 3,
      普通渠道: 4,
      未标注渠道: 5,
    };
    return weightMap[technicalServiceType] ?? 9;
  }

  /**
   * 判断业务链是否应采用“渠道商区域”为主口径。
   *
   * 参数说明：`questionText` 为用户原问题，`resources` 为本次读取对象，`regionConstraint` 为区域约束。
   * 返回值说明：用户明确问某区域，且本次读取了渠道商与业务对象时返回 `true`。
   * 调用注意事项：该判断只用于 Markdown 快照链路，避免各对象分别按客户名/项目名匹配区域导致口径混用。
   */
  private shouldUsePartnerRegionScope(
    questionText: string,
    resources: BusinessChainSnapshotResource[],
    regionConstraint?: BusinessChainRegionConstraint,
  ): boolean {
    const hasRegion = Boolean(regionConstraint?.region || regionConstraint?.bigRegion || regionConstraint?.tokens.length);
    const hasDependentResource = resources.some((resource) =>
      ['registrations', 'opportunities', 'quotes', 'orders'].includes(resource),
    );
    return hasRegion && resources.includes('partners') && hasDependentResource;
  }

  /**
   * 解析业务链问题中明确点名的渠道商实体。
   *
   * 参数说明：`questionText` 为用户原问题，`partners` 为本地快照中的渠道商明细。
   * 返回值说明：问题完整命中某个渠道商名称时返回该渠道商范围；未命中返回 `undefined`。
   * 调用注意事项：实体命中优先级高于区域词，避免“山东华安...”这类公司名被误当成山东区域筛选。
   */
  private resolveBusinessChainPartnerEntityConstraint(
    questionText: string,
    partners: StandardApiRecord[],
  ): BusinessChainPartnerEntityConstraint | undefined {
    const entityConstraint = this.resolveQuestionEntityNameConstraint(
      questionText,
      partners,
    );
    if (!entityConstraint) {
      return undefined;
    }

    const matchedPartners = partners.filter((partner) =>
      this.recordMatchesQuestionEntityName(partner, entityConstraint),
    );
    if (matchedPartners.length === 0) {
      return undefined;
    }

    return {
      label: entityConstraint.label,
      partners: matchedPartners,
      scope: this.buildBusinessChainPartnerScope(matchedPartners),
    };
  }

  /**
   * 解析结果过滤标签中应展示的渠道商名称。
   *
   * 参数说明：`questionText` 为用户原问题，`partners` 为已经过本地过滤后的渠道商明细。
   * 返回值说明：命中实体时返回渠道商名称；未命中返回 `undefined`。
   */
  private resolveRequestedBusinessChainPartnerLabel(
    questionText: string,
    partners: StandardApiRecord[],
  ): string | undefined {
    return this.resolveQuestionEntityNameConstraint(questionText, partners)?.label;
  }

  /**
   * 从已命中的渠道商明细构造本次业务链关联范围。
   *
   * 参数说明：`partners` 为已经按区域筛选出的渠道商记录。
   * 返回值说明：返回可按 ID 或名称匹配的渠道商集合。
   * 调用注意事项：Markdown 快照可能没有稳定渠道商 ID，因此必须同时保存规范化名称。
   */
  private buildBusinessChainPartnerScope(partners: StandardApiRecord[]): BusinessChainPartnerScope {
    const ids = new Set<string>();
    const names = new Set<string>();
    for (const partner of partners) {
      this.addBusinessChainPartnerScopeValue(
        ids,
        partner.id ?? partner.partnerId ?? partner.assignedPartnerId,
      );
      this.addBusinessChainPartnerScopeValue(
        names,
        partner.partnerName ?? partner.name ?? partner.displayName ?? partner.shortName,
      );
    }
    return { ids, names };
  }

  /**
   * 判断业务记录是否属于已命中的渠道商范围。
   *
   * 参数说明：`record` 为报备、商机或订单记录，`scope` 为渠道商区域主口径集合。
   * 返回值说明：记录的渠道商 ID 或名称命中集合时返回 `true`。
   * 调用注意事项：没有任何渠道商命中时返回 `false`，避免把区域外业务误混进结果。
   */
  private recordMatchesBusinessChainPartnerScope(
    record: StandardApiRecord,
    scope?: BusinessChainPartnerScope,
  ): boolean {
    if (!scope || (scope.ids.size === 0 && scope.names.size === 0)) {
      return false;
    }

    const recordIds = [
      record.partnerId,
      record.assignedPartnerId,
      record.channelId,
      record.dealerId,
      record.agentId,
    ]
      .map((item) => this.normalizeComparableText(item))
      .filter(Boolean);
    if (recordIds.some((item) => scope.ids.has(item))) {
      return true;
    }

    const recordNames = [
      record.partnerName,
      record.assignedPartnerName,
      record.channelName,
      record.serviceProviderName,
      record.dealerName,
      record.agentName,
    ]
      .map((item) => this.normalizeComparableText(item))
      .filter(Boolean);
    return recordNames.some((item) => scope.names.has(item));
  }

  /**
   * 将渠道商 ID 或名称写入规范化集合。
   *
   * 参数说明：`target` 为目标集合，`value` 为候选 ID 或名称。
   * 返回值说明：无。
   */
  private addBusinessChainPartnerScopeValue(target: Set<string>, value: unknown): void {
    const normalizedValue = this.normalizeComparableText(value);
    if (normalizedValue) {
      target.add(normalizedValue);
    }
  }

  /**
   * 生成业务链对象中文标签。
   *
   * 参数说明：`resources` 为本次读取的 OpenAPI 资源列表。
   * 返回值说明：返回适合过滤标签和摘要展示的中文对象列表。
   * 调用注意事项：只转换资源名，不推断额外业务对象。
   */
  private formatBusinessChainResourceLabel(resources: BusinessChainSnapshotResource[]): string {
    const labelMap: Record<BusinessChainSnapshotResource, string> = {
      partners: '合作伙伴',
      registrations: '客户报备',
      opportunities: '商机',
      quotes: '报价',
      orders: '订单',
    };
    return resources.map((resource) => labelMap[resource]).join('、');
  }

  /**
   * 根据分析域和自然语言关键词选择联软标准资源。
   *
   * 参数说明：`questionText` 为用户问题，`compiledTask` 为当前任务。
   * 返回值说明：返回资源配置；当前任务不适合走标准 API 时返回 `undefined`。
   * 调用注意事项：这里只做资源选择，不做权限判断，权限仍由标准 API 与本地绑定校验共同收口。
   */
  private resolveTaskConfig(
    questionText: string,
    compiledTask: RoutedCompiledQueryTask,
  ): StandardApiTaskConfig | undefined {
    if (compiledTask.plan.domain === 'opportunity-analysis') {
      if (!OPPORTUNITY_SUPPORTED_RESULT_KINDS.has(compiledTask.resultKind)) {
        return undefined;
      }

      return {
        resource: 'opportunities',
        subjectLabel: '商机',
        amountMetricLabel: '累计商机金额',
        countMetricLabel: '命中商机数',
        dictionaryKey: 'opportunityStages',
      };
    }

    if (compiledTask.plan.domain === 'customer-relationship') {
      if (!GENERIC_SUPPORTED_RESULT_KINDS.has(compiledTask.resultKind)) {
        return undefined;
      }

      if (/(渠道|服务商|伙伴|代理商|经销商)/u.test(questionText)) {
        return {
          resource: 'partners',
          subjectLabel: '渠道',
          amountMetricLabel: '渠道金额',
          countMetricLabel: '命中渠道数',
          dictionaryKey: 'partnerLevels',
        };
      }

      if (/(客户报备|报备状态|报备分布)/u.test(questionText)) {
        return {
          resource: 'registrations',
          subjectLabel: '客户报备',
          amountMetricLabel: '报备金额',
          countMetricLabel: '命中报备数',
          dictionaryKey: 'registrationStatuses',
        };
      }

      return {
        resource: 'customers',
        subjectLabel: '客户',
        amountMetricLabel: '客户金额',
        countMetricLabel: '客户数量',
        dictionaryKey: 'customerStatuses',
      };
    }

    if (compiledTask.plan.domain === 'contract-conversion') {
      if (!GENERIC_SUPPORTED_RESULT_KINDS.has(compiledTask.resultKind)) {
        return undefined;
      }

      if (/(报价|报价单|报价金额)/u.test(questionText)) {
        return {
          resource: 'quotes',
          subjectLabel: '报价',
          amountMetricLabel: '累计报价金额',
          countMetricLabel: '命中报价数',
          dictionaryKey: 'quoteStatuses',
        };
      }

      return {
        resource: 'orders',
        subjectLabel: '订单',
        amountMetricLabel: '累计订单金额',
        countMetricLabel: '命中订单数',
        dictionaryKey: 'orderStatuses',
      };
    }

    return undefined;
  }

  /**
   * 判断当前问题是否是服务商画像统计，而不是商机贡献统计。
   *
   * 参数说明：`questionText` 为用户原始问题。
   * 返回值说明：只问服务商数量、合作等级、状态等资料维度时返回 true。
   * 调用注意事项：只要用户明确提到商机、订单、报价、报备或金额，就继续走贡献分析，
   * 避免把经营贡献问题误切到服务商基础资料。
   */
  private isPartnerProfileQuestion(questionText: string): boolean {
    const asksPartnerProfile =
      /(服务商|渠道商|渠道|伙伴|代理商|经销商)/u.test(questionText) &&
      /(多少家|多少个|合作级别|合作等级|渠道等级|等级|技术服务商|状态|维度|开拓|拓展|发展|开发|画像|概况|情况)/u.test(
        questionText,
      );
    const asksBusinessContribution = /(商机|机会|订单|报价|报备|金额|贡献|成交|签单|经营|运营|业绩|产出|下单情况)/u.test(
      questionText,
    );

    return asksPartnerProfile && !asksBusinessContribution;
  }

  /**
   * 判断渠道商贡献任务是否承载服务商开拓或画像子需求。
   *
   * 参数说明：
   * - `questionText`：用户原始问题，综合经营问题里可能同时包含商机、报备和订单；
   * - `compiledTask`：当前已拆分任务，标题表达本任务真实业务对象。
   * 返回值说明：明确的服务商开拓或画像任务返回 true。
   * 调用注意事项：只用任务标题补足组合拆分后的子需求，不放宽普通商机/订单贡献问题。
   */
  private isPartnerProfileTask(
    questionText: string,
    compiledTask: RoutedCompiledQueryTask,
  ): boolean {
    return (
      this.isPartnerProfileQuestion(questionText) ||
      /(合作伙伴|服务商|渠道商).*(开拓|拓展|发展|开发|画像|概况|情况)|服务商画像/u.test(
        compiledTask.taskTitle,
      )
    );
  }

  /**
   * 判断当前问题是否属于客户生命周期或反关联分析。
   *
   * 参数说明：`questionText` 为用户原始问题。
   * 返回值说明：命中未报备、未建商机、未报价、未下单、创建时长或沉睡客户时返回 true。
   * 调用注意事项：这里只决定客户统计接口优先路径，不放宽联软标准 OpenAPI 的权限裁剪。
   */
  private isCustomerLifecycleQuestion(questionText: string): boolean {
    return /(客户).*((没有|未|无).{0,8}(报备|商机|报价|下单|订单)|未报备商机|未建商机|无商机|创建.{0,8}(多久|多长时间|时长|天数)|生命周期|沉睡)/u.test(
      questionText,
    );
  }

  /**
   * 执行客户生命周期和反关联分析。
   *
   * 参数说明：各参数沿用 OpenAPI Markdown 快照执行主链。
   * 返回值说明：返回基于本地客户快照明细聚合出的生命周期结果。
   * 调用注意事项：正式问答阶段不再探测客户生命周期统计接口，避免未部署接口返回 HTML 干扰主链。
   */
  private async executeCustomerLifecycleTask(
    questionText: string,
    taskConfig: StandardApiTaskConfig,
    compiledTask: RoutedCompiledQueryTask,
    user: CrmUser,
    scopeSummary: string,
    dictionaries: LianruanCrmOpenApiDictionaries,
    executionPolicy: StandardApiExecutionPolicy,
  ): Promise<AnalysisDatasetSlice> {
    return this.executeCustomerLifecycleListTask(
      questionText,
      taskConfig,
      compiledTask,
      user,
      scopeSummary,
      dictionaries,
      executionPolicy,
    );
  }

  /**
   * 通过联软客户反关联统计接口执行生命周期问数。
   *
   * 参数说明：
   * - `questionText`：用户原始问题，用于识别区域；
   * - `taskConfig`：客户资源配置；
   * - `compiledTask`：当前分析任务；
   * - `scopeSummary`：当前权限说明；
   * - `dictionaries`：远端字典。
   * 返回值说明：返回未报备、未建商机、未报价、未下单客户指标和创建时长分布。
   */
  private async executeCustomerLifecycleAnalyticsTask(
    questionText: string,
    taskConfig: StandardApiTaskConfig,
    compiledTask: RoutedCompiledQueryTask,
    scopeSummary: string,
    dictionaries: LianruanCrmOpenApiDictionaries,
  ): Promise<AnalysisDatasetSlice> {
    const query = this.buildPartnerContributionQuery(questionText, compiledTask, dictionaries);
    const [lifecycle, unregistered] = await Promise.all([
      this.lianruanCrmQueryAdapterService.getCustomerLifecycleAnalytics(query),
      this.lianruanCrmQueryAdapterService.getCustomerUnregisteredOpportunityAnalytics(query),
    ]);
    const rows = this.buildCustomerUnregisteredRows(unregistered);
    const sampleRows = this.buildCustomerSampleRows(unregistered.samples ?? lifecycle.idleSamples ?? []);
    const noRegistrationCount = this.resolveFiniteNumber(unregistered.noRegistrationCount);
    const noOpportunityCount = this.resolveFiniteNumber(unregistered.noOpportunityCount);
    const noQuoteCount = this.resolveFiniteNumber(unregistered.noQuoteCount);
    const noOrderCount = this.resolveFiniteNumber(unregistered.noOrderCount);
    const totalCount = this.resolveFiniteNumber(lifecycle.totalCount);

    if (
      totalCount === 0 &&
      noRegistrationCount === 0 &&
      noOpportunityCount === 0 &&
      noQuoteCount === 0 &&
      noOrderCount === 0 &&
      rows.length === 0
    ) {
      throw new RealDataUnavailableError('联软客户生命周期统计接口未返回可展示数据。');
    }

    const primaryRows = rows.length > 0 ? rows : this.buildCustomerLifecycleRows(lifecycle);
    const secondaryViews: ResultView[] = [];
    if (primaryRows.length > 0) {
      secondaryViews.push({
        viewType: 'DETAIL_TABLE',
        title: '客户创建时长分布',
        rows: primaryRows,
      });
    }
    if (sampleRows.length > 0) {
      secondaryViews.push({
        viewType: 'DETAIL_TABLE',
        title: '客户样例明细',
        rows: sampleRows,
      });
    }

    return {
      datasetId: buildEntityId('dataset'),
      taskId: compiledTask.taskId,
      taskTitle: '客户生命周期反关联分析',
      resultKind: compiledTask.resultKind,
      purpose: compiledTask.purpose,
      sql: this.buildCustomerLifecycleExecutionSummary(compiledTask, query),
      executionMode: compiledTask.executionMode,
      executionSource: compiledTask.executionSource,
      matchedAdapter: 'crm-official-api.customer-lifecycle-analytics',
      gapReason: compiledTask.gapReason,
      summary: `已通过联软标准 OpenAPI 客户生命周期统计完成分析，当前权限范围内客户总数 ${totalCount} 个，其中未报备客户 ${noRegistrationCount} 个、未建商机客户 ${noOpportunityCount} 个、未报价客户 ${noQuoteCount} 个、未下单客户 ${noOrderCount} 个。`,
      temporalScope: buildResultTemporalScope(compiledTask.plan.temporalSlot),
      appliedFilters: this.buildAppliedFilters(taskConfig, compiledTask, scopeSummary, primaryRows),
      metricCards: [
        { name: '客户总数', value: totalCount },
        { name: '未报备客户', value: noRegistrationCount },
        { name: '未建商机客户', value: noOpportunityCount },
        { name: '未下单客户', value: noOrderCount },
      ],
      primaryView: primaryRows.length
        ? {
            viewType: 'PIE_CHART',
            title: '客户创建时长分布',
            series: primaryRows.map((item) => ({
              label: String(item.ageBucketLabel ?? item.bucket_label ?? item.ownerName ?? '未填写'),
              value: Number(item.count ?? 0),
            })),
          }
        : undefined,
      secondaryViews,
      tableRows: primaryRows.length > 0 ? primaryRows : sampleRows,
      rowCount: primaryRows.length > 0 ? primaryRows.length : sampleRows.length,
    };
  }

  /**
   * 通过客户列表执行生命周期问数兜底。
   *
   * 参数说明：各参数与客户统计接口链路一致。
   * 返回值说明：返回按客户创建时长分桶的本地聚合结果。
   * 调用注意事项：列表回退仍只读取标准 OpenAPI 当前授权范围内的客户视图。
   */
  private async executeCustomerLifecycleListTask(
    questionText: string,
    taskConfig: StandardApiTaskConfig,
    compiledTask: RoutedCompiledQueryTask,
    user: CrmUser,
    scopeSummary: string,
    dictionaries: LianruanCrmOpenApiDictionaries,
    executionPolicy: StandardApiExecutionPolicy,
  ): Promise<AnalysisDatasetSlice> {
    const records = await this.listAllRecords(taskConfig, compiledTask);
    const filteredRecords = this.applyLocalFilters(
      questionText,
      taskConfig,
      compiledTask,
      records,
      user,
      executionPolicy,
    );
    const noRegistrationRecords = filteredRecords.filter((record) =>
      this.isMissingBooleanOrZero(record.hasRegistration, record.registrationCount),
    );
    const noOpportunityRecords = filteredRecords.filter((record) =>
      this.isMissingBooleanOrZero(record.hasOpportunity, record.opportunityCount),
    );
    const noOrderRecords = filteredRecords.filter((record) =>
      this.isMissingBooleanOrZero(record.hasOrder, record.orderCount),
    );
    const rows = this.buildCustomerRowsByAgeBucket(noRegistrationRecords);
    const sampleRows = this.buildCustomerSampleRows(noRegistrationRecords.slice(0, 10));

    return {
      datasetId: buildEntityId('dataset'),
      taskId: compiledTask.taskId,
      taskTitle: '客户生命周期反关联分析',
      resultKind: compiledTask.resultKind,
      purpose: compiledTask.purpose,
      sql: this.buildApiExecutionSummary(compiledTask, taskConfig),
      executionMode: compiledTask.executionMode,
      executionSource: compiledTask.executionSource,
      matchedAdapter: 'crm-official-api.customer-lifecycle-list',
      gapReason: compiledTask.gapReason,
      summary:
        filteredRecords.length > 0
          ? `已通过联软标准 OpenAPI 客户列表完成生命周期分析，当前权限范围内客户 ${filteredRecords.length} 个，其中未报备客户 ${noRegistrationRecords.length} 个、未建商机客户 ${noOpportunityRecords.length} 个、未下单客户 ${noOrderRecords.length} 个。`
          : '当前任务在标准 OpenAPI 授权范围内未命中客户数据。',
      temporalScope: buildResultTemporalScope(compiledTask.plan.temporalSlot),
      appliedFilters: this.buildAppliedFilters(taskConfig, compiledTask, scopeSummary, filteredRecords),
      metricCards: [
        { name: '客户总数', value: filteredRecords.length },
        { name: '未报备客户', value: noRegistrationRecords.length },
        { name: '未建商机客户', value: noOpportunityRecords.length },
        { name: '未下单客户', value: noOrderRecords.length },
      ],
      primaryView: rows.length
        ? {
            viewType: 'PIE_CHART',
            title: '客户创建时长分布',
            series: rows.map((item) => ({
              label: String(item.ageBucketLabel ?? item.bucket_label ?? '未填写'),
              value: Number(item.count ?? 0),
            })),
          }
        : undefined,
      secondaryViews: [
        ...(rows.length
          ? [{ viewType: 'DETAIL_TABLE' as const, title: '客户创建时长分布', rows }]
          : []),
        ...(sampleRows.length
          ? [{ viewType: 'DETAIL_TABLE' as const, title: '客户样例明细', rows: sampleRows }]
          : []),
      ],
      tableRows: rows.length > 0 ? rows : sampleRows,
      rowCount: rows.length > 0 ? rows.length : sampleRows.length,
    };
  }

  /**
   * 将客户反关联统计转换为创建时长分布行。
   *
   * 参数说明：`analytics` 为联软未报备/未建商机统计接口返回。
   * 返回值说明：返回按创建时长分桶的客户数量行。
   * 调用注意事项：优先使用未报备客户创建时长分布，符合用户“没有报备商机且创建多久”的核心问法。
   */
  private buildCustomerUnregisteredRows(
    analytics: LianruanCrmOpenApiCustomerUnregisteredOpportunityAnalytics,
  ): StandardApiAggregateRow[] {
    const rows = this.normalizeBucketList(analytics.noRegistrationByAgeBucket)
      .map((bucket) => {
        const rawValue = bucket.value ?? bucket.key ?? bucket.name ?? bucket.label ?? '';
        const ageBucket = this.readText(rawValue) || 'unknown';
        const ageBucketLabel = this.resolveCustomerAgeBucketLabel(ageBucket);
        const count = this.resolveFiniteNumber(bucket.count);
        return {
          ownerId: ageBucket,
          ownerName: ageBucketLabel,
          amount: 0,
          count,
          bucket_label: ageBucketLabel,
          ageBucket,
          ageBucketLabel,
        };
      })
      .filter((item) => item.count > 0);

    return rows.sort((left, right) =>
      this.resolveAgeBucketOrder(this.readText(left.ageBucket)) -
      this.resolveAgeBucketOrder(this.readText(right.ageBucket)),
    );
  }

  /**
   * 将客户生命周期统计转换为通用分布行。
   *
   * 参数说明：`analytics` 为客户生命周期统计接口返回。
   * 返回值说明：返回客户创建时长分桶行。
   */
  private buildCustomerLifecycleRows(
    analytics: LianruanCrmOpenApiCustomerLifecycleAnalytics,
  ): StandardApiAggregateRow[] {
    return this.normalizeBucketList(analytics.byAgeBucket)
      .map((bucket) => {
        const rawValue = bucket.value ?? bucket.key ?? bucket.name ?? bucket.label ?? '';
        const ageBucket = this.readText(rawValue) || 'unknown';
        const ageBucketLabel = this.resolveCustomerAgeBucketLabel(ageBucket);
        return {
          ownerId: ageBucket,
          ownerName: ageBucketLabel,
          amount: 0,
          count: this.resolveFiniteNumber(bucket.count),
          bucket_label: ageBucketLabel,
          ageBucket,
          ageBucketLabel,
        };
      })
      .filter((item) => item.count > 0)
      .sort((left, right) =>
        this.resolveAgeBucketOrder(this.readText(left.ageBucket)) -
        this.resolveAgeBucketOrder(this.readText(right.ageBucket)),
      );
  }

  /**
   * 按客户创建时长分桶聚合客户列表。
   *
   * 参数说明：`records` 为客户视图列表。
   * 返回值说明：返回本地聚合后的创建时长分布。
   */
  private buildCustomerRowsByAgeBucket(records: StandardApiRecord[]): StandardApiAggregateRow[] {
    const bucketMap = new Map<string, StandardApiAggregateRow>();
    for (const record of records) {
      const ageBucket = this.readText(record.ageBucket) || this.resolveAgeBucketFromCreatedAt(record.createdAt);
      const ageBucketLabel = this.resolveCustomerAgeBucketLabel(ageBucket);
      const current = bucketMap.get(ageBucket) ?? {
        ownerId: ageBucket,
        ownerName: ageBucketLabel,
        amount: 0,
        count: 0,
        bucket_label: ageBucketLabel,
        ageBucket,
        ageBucketLabel,
      };
      current.count += 1;
      bucketMap.set(ageBucket, current);
    }

    return [...bucketMap.values()].sort((left, right) =>
      this.resolveAgeBucketOrder(this.readText(left.ageBucket)) -
      this.resolveAgeBucketOrder(this.readText(right.ageBucket)),
    );
  }

  /**
   * 构建客户样例明细行。
   *
   * 参数说明：`records` 为联软返回的客户样例或客户列表。
   * 返回值说明：返回不含手机号、邮箱等敏感联系信息的展示行。
   * 调用注意事项：仅展示经营分析必要字段，避免企微端扩散敏感资料。
   */
  private buildCustomerSampleRows(records: StandardApiRecord[]): Array<Record<string, unknown>> {
    return records.slice(0, 10).map((record) => {
      const customerId = this.readText(record.customerId ?? record.id);
      const customerName =
        this.readText(record.name ?? record.customer) ||
        (customerId ? `客户#${customerId}` : '未命名客户');
      const ageBucket = this.readText(record.ageBucket) || this.resolveAgeBucketFromCreatedAt(record.createdAt);
      return {
        customerId,
        customerName,
        status: this.readText(record.statusName ?? record.status) || '未填写状态',
        ageBucket: this.resolveCustomerAgeBucketLabel(ageBucket),
        createdAt: this.readText(record.createdAt) || undefined,
        latestActivityAt: this.readText(record.latestActivityAt ?? record.updatedAt) || undefined,
        ownerName: this.readText(record.ownerName ?? record.assignedStaffName) || undefined,
        partnerName: this.readText(record.partnerName) || undefined,
        region: this.readText(record.region ?? record.bigRegion) || undefined,
        hasRegistration: this.resolveYesNo(record.hasRegistration, record.registrationCount),
        hasOpportunity: this.resolveYesNo(record.hasOpportunity, record.opportunityCount),
        hasOrder: this.resolveYesNo(record.hasOrder, record.orderCount),
      };
    });
  }

  /**
   * 判断布尔标记或计数字段是否表达“没有关联对象”。
   *
   * 参数说明：`flag` 为是否有关联对象，`count` 为关联数量。
   * 返回值说明：明确 false 或数量为 0 时返回 true。
   */
  private isMissingBooleanOrZero(flag: unknown, count: unknown): boolean {
    if (typeof flag === 'boolean') {
      return !flag;
    }

    const numericCount = Number(count);
    if (Number.isFinite(numericCount)) {
      return numericCount <= 0;
    }

    return false;
  }

  /**
   * 把客户创建时长分桶转换为中文。
   *
   * 参数说明：`ageBucket` 为联软标准分桶值。
   * 返回值说明：返回业务用户可理解的中文标签。
   */
  private resolveCustomerAgeBucketLabel(ageBucket: string): string {
    const normalized = ageBucket.trim().toLowerCase();
    const map: Record<string, string> = {
      '0-30': '创建 0-30 天',
      '31-90': '创建 31-90 天',
      '91-180': '创建 91-180 天',
      '180+': '创建 180 天以上',
      unknown: '创建时间未知',
    };
    return map[normalized] ?? this.resolveBusinessLabel(ageBucket) ?? ageBucket ?? '创建时间未知';
  }

  /**
   * 按客户创建时间估算分桶。
   *
   * 参数说明：`createdAt` 为客户创建时间。
   * 返回值说明：返回联软标准分桶值；无法解析时返回 `unknown`。
   */
  private resolveAgeBucketFromCreatedAt(createdAt: unknown): string {
    const createdTime = Date.parse(this.readText(createdAt));
    if (!Number.isFinite(createdTime)) {
      return 'unknown';
    }

    const days = Math.floor((Date.now() - createdTime) / 86_400_000);
    if (days <= 30) {
      return '0-30';
    }
    if (days <= 90) {
      return '31-90';
    }
    if (days <= 180) {
      return '91-180';
    }
    return '180+';
  }

  /**
   * 返回客户创建时长分桶排序值。
   *
   * 参数说明：`ageBucket` 为分桶编码。
   * 返回值说明：数值越小越靠前。
   */
  private resolveAgeBucketOrder(ageBucket: string): number {
    const map: Record<string, number> = {
      '0-30': 1,
      '31-90': 2,
      '91-180': 3,
      '180+': 4,
      unknown: 5,
    };
    return map[ageBucket.trim().toLowerCase()] ?? 99;
  }

  /**
   * 转换是否存在关联对象的展示文案。
   *
   * 参数说明：`flag/count` 为标准 API 返回的布尔和数量字段。
   * 返回值说明：返回“是/否/未返回”。
   */
  private resolveYesNo(flag: unknown, count: unknown): string {
    if (typeof flag === 'boolean') {
      return flag ? '是' : '否';
    }
    const numericCount = Number(count);
    if (Number.isFinite(numericCount)) {
      return numericCount > 0 ? '是' : '否';
    }
    return '未返回';
  }

  /**
   * 执行服务商基础资料画像统计。
   *
   * 参数说明：
   * - `questionText`：用户原始问题，用于区域过滤；
   * - `compiledTask`：沿用渠道商贡献任务骨架，保留同一时间与权限口径；
   * - `scopeSummary`：当前权限说明；
   * - `dictionaries`：远端字典，用于合作等级中文化。
   * 返回值说明：返回服务商数量、合作等级数量和明细列表。
   * 调用注意事项：Markdown 快照模式只读 `details/partners.md`；实时 OpenAPI 模式优先使用联软画像统计接口，
   * 接口不可用时回退服务商列表聚合，避免联调版本差异导致无结果。
   */
  private async executePartnerProfileTask(
    questionText: string,
    compiledTask: RoutedCompiledQueryTask,
    user: CrmUser,
    scopeSummary: string,
    dictionaries: LianruanCrmOpenApiDictionaries,
    executionPolicy: StandardApiExecutionPolicy,
  ): Promise<AnalysisDatasetSlice> {
    const taskConfig: StandardApiTaskConfig = {
      resource: 'partners',
      subjectLabel: '服务商',
      amountMetricLabel: '服务商金额',
      countMetricLabel: '服务商数量',
      dictionaryKey: 'partnerLevels',
    };
    const profileTask = this.buildPartnerProfileSnapshotTask(questionText, compiledTask);

    if (!this.openApiMarkdownSnapshotService && !executionPolicy.requiresLocalScopeEnforcement) {
      try {
        return await this.executePartnerProfileAnalyticsTask(
          questionText,
          taskConfig,
          compiledTask,
          profileTask,
          scopeSummary,
          dictionaries,
        );
      } catch {
        // 新画像统计接口是首选路径；若远端尚未部署或临时异常，保留列表聚合兜底，保证旧联调链路可用。
      }
    }

    return this.executePartnerProfileListTask(
      questionText,
      taskConfig,
      compiledTask,
      profileTask,
      user,
      scopeSummary,
      dictionaries,
      executionPolicy,
    );
  }

  /**
   * 通过联软服务商画像统计接口执行画像问数。
   *
   * 参数说明：
   * - `questionText`：用户原始问题，用于识别区域和技术服务商口径；
   * - `taskConfig`：服务商资源配置；
   * - `compiledTask`：原始分析任务；
   * - `profileTask`：实际执行的画像任务，可能已移除快照类时间过滤；
   * - `scopeSummary`：当前权限说明；
   * - `dictionaries`：远端字典。
   * 返回值说明：返回画像维度分布和指标卡。
   * 调用注意事项：统计接口不返回服务商逐条明细，因此表格展示维度分布；需要逐条服务商时由列表兜底链路承接。
   */
  private async executePartnerProfileAnalyticsTask(
    questionText: string,
    taskConfig: StandardApiTaskConfig,
    compiledTask: RoutedCompiledQueryTask,
    profileTask: RoutedCompiledQueryTask,
    scopeSummary: string,
    dictionaries: LianruanCrmOpenApiDictionaries,
  ): Promise<AnalysisDatasetSlice> {
    const query = this.buildPartnerProfileAnalyticsQuery(
      questionText,
      profileTask,
      dictionaries,
    );
    const analytics =
      await this.lianruanCrmQueryAdapterService.getPartnerProfileAnalytics(query);
    const rows = this.buildPartnerProfileAnalyticsRows(analytics, dictionaries);
    const totalCount = this.resolveProfileTotalCount(analytics, rows);
    const activeCount = this.resolveFiniteNumber(analytics.activeCount);
    const technicalServiceProviderCount = this.resolveFiniteNumber(
      analytics.technicalServiceProviderCount,
    );
    const levelCount = rows.filter((item) => item.dimension === '合作等级').length;
    const profileScopeLabel = this.isPartnerCreatedQuestion(questionText)
      ? '按服务商加入时间命中'
      : '当前授权服务商快照命中';

    if (totalCount === 0 && rows.length === 0) {
      throw new RealDataUnavailableError('联软服务商画像统计接口未返回可展示数据。');
    }

    return {
      datasetId: buildEntityId('dataset'),
      taskId: compiledTask.taskId,
      taskTitle: '服务商画像统计',
      resultKind: compiledTask.resultKind,
      purpose: compiledTask.purpose,
      sql: this.buildPartnerProfileExecutionSummary(profileTask, query),
      executionMode: compiledTask.executionMode,
      executionSource: compiledTask.executionSource,
      matchedAdapter: 'crm-official-api.partner-profile-analytics',
      gapReason: compiledTask.gapReason,
      summary: `已通过联软标准 OpenAPI 服务商画像统计完成分析，${profileScopeLabel} ${totalCount} 家服务商，覆盖 ${levelCount} 类合作等级，其中技术服务商 ${technicalServiceProviderCount} 家。`,
      temporalScope: buildResultTemporalScope(compiledTask.plan.temporalSlot),
      appliedFilters: this.buildPartnerProfileAppliedFilters(
        questionText,
        taskConfig,
        compiledTask,
        profileTask,
        scopeSummary,
        rows,
      ),
      metricCards: [
        { name: '服务商数量', value: totalCount },
        { name: '合作等级数', value: levelCount },
        { name: '技术服务商', value: technicalServiceProviderCount },
        { name: '正常状态服务商', value: activeCount },
      ],
      primaryView: rows.length
        ? {
            viewType: 'DETAIL_TABLE',
            title: '服务商画像维度分布',
            rows,
          }
        : undefined,
      secondaryViews: rows.length
        ? [
            {
              viewType: 'DETAIL_TABLE',
              title: '服务商画像维度分布',
              rows,
            },
          ]
        : [],
      tableRows: rows,
      rowCount: rows.length,
    };
  }

  /**
   * 通过服务商列表执行画像问数兜底。
   *
   * 参数说明：各参数与画像统计接口链路一致。
   * 返回值说明：返回服务商逐条明细和本地聚合指标。
   * 调用注意事项：仅在统计接口不可用时使用，仍然只读取标准 OpenAPI 授权范围内的数据。
   */
  private async executePartnerProfileListTask(
    questionText: string,
    taskConfig: StandardApiTaskConfig,
    compiledTask: RoutedCompiledQueryTask,
    profileTask: RoutedCompiledQueryTask,
    user: CrmUser,
    scopeSummary: string,
    dictionaries: LianruanCrmOpenApiDictionaries,
    executionPolicy?: StandardApiExecutionPolicy,
  ): Promise<AnalysisDatasetSlice> {
    const listFetchTask = this.buildPartnerProfileListFetchTask(questionText, profileTask);
    const records = await this.listAllRecords(taskConfig, listFetchTask);
    const filteredRecords = this.applyLocalFilters(
      questionText,
      taskConfig,
      profileTask,
      records,
      user,
      executionPolicy,
    );
    const rows = this.buildPartnerProfileRows(filteredRecords, dictionaries);
    const levelCount = new Set(
      rows.map((item) => this.readText(item.partnerLevel)).filter(Boolean),
    ).size;
    const activeCount = rows.filter((item) =>
      /^(active|enabled|启用|正常|有效)$/iu.test(this.readText(item.status)),
    ).length;
    const profileScopeLabel = this.isPartnerCreatedQuestion(questionText)
      ? '按服务商加入时间命中'
      : '当前授权服务商快照命中';
    const technicalServiceProviderCount = rows.filter(
      (item) => item.isTechnicalServiceProvider === true,
    ).length;
    const sourceLabel = this.openApiMarkdownSnapshotService
      ? 'CRM 已同步真实明细数据'
      : '联软标准 OpenAPI 服务商列表';
    const resultTaskTitle = this.resolvePartnerProfileResultTitle(questionText, compiledTask);
    const subjectLabel = this.resolvePartnerProfileSubjectLabel(questionText);

    return {
      datasetId: buildEntityId('dataset'),
      taskId: compiledTask.taskId,
      taskTitle: resultTaskTitle,
      resultKind: compiledTask.resultKind,
      purpose: compiledTask.purpose,
      sql: this.buildApiExecutionSummary(profileTask, taskConfig),
      executionMode: compiledTask.executionMode,
      executionSource: this.openApiMarkdownSnapshotService
        ? 'OPENAPI_MARKDOWN_SNAPSHOT'
        : compiledTask.executionSource,
      matchedAdapter: this.openApiMarkdownSnapshotService
        ? 'openapi-markdown-snapshot.partner-profile'
        : 'crm-official-api.partner-profile',
      gapReason: compiledTask.gapReason,
      summary:
        rows.length > 0
          ? `已通过${sourceLabel}完成${subjectLabel}画像统计，${profileScopeLabel} ${rows.length} 家${subjectLabel}，覆盖 ${levelCount} 类合作等级，其中技术服务商 ${technicalServiceProviderCount} 家。`
          : `当前任务在${sourceLabel}内未命中${subjectLabel}数据。`,
      temporalScope: buildResultTemporalScope(compiledTask.plan.temporalSlot),
      appliedFilters: this.buildPartnerProfileAppliedFilters(
        questionText,
        taskConfig,
        compiledTask,
        profileTask,
        scopeSummary,
        filteredRecords,
      ),
      metricCards: [
        { name: `${subjectLabel}数量`, value: rows.length },
        { name: '合作等级数', value: levelCount },
        { name: '技术服务商', value: technicalServiceProviderCount },
        { name: `正常状态${subjectLabel}`, value: activeCount },
      ],
      primaryView: rows.length
        ? {
            viewType: 'DETAIL_TABLE',
            title: `${subjectLabel}画像明细`,
            rows,
          }
        : undefined,
      secondaryViews: rows.length
        ? [
            {
              viewType: 'DETAIL_TABLE',
              title: `${subjectLabel}画像明细`,
              rows,
            },
          ]
        : [],
      tableRows: rows,
      rowCount: rows.length,
    };
  }

  /**
   * 构造服务商画像列表拉取任务。
   *
   * 参数说明：`questionText` 为用户问题，`profileTask` 为画像任务。
   * 返回值说明：服务商“加入时间”类问题会移除下推时间筛选，其它问题保持原任务。
   * 调用注意事项：联软当前 `/partners` 列表按 `createdAfter/createdBefore` 会基于空 `createdAt`
   * 返回 0，但列表本身提供 `joinDate`；因此这里先不下推时间，再由本地 `joinDate` 过滤收窄，
   * 避免把接口字段缺口误判成真实无数据。
   */
  private buildPartnerProfileListFetchTask(
    questionText: string,
    profileTask: RoutedCompiledQueryTask,
  ): RoutedCompiledQueryTask {
    if (!this.isPartnerCreatedQuestion(questionText)) {
      return profileTask;
    }

    const filters = { ...profileTask.plan.filters };
    delete filters.startAt;
    delete filters.endAt;
    delete filters.timeRange;

    return {
      ...profileTask,
      plan: {
        ...profileTask.plan,
        filters,
      },
    };
  }

  /**
   * 生成服务商画像结果标题。
   *
   * 参数说明：`questionText` 为用户原文，`compiledTask` 为规划任务。
   * 返回值说明：类型、名单、明细类窄查询返回明细标题，其它画像问题保留服务商画像统计。
   * 调用注意事项：不能沿用“新增商机金额渠道商贡献”这类底层兼容标题，避免结果串线。
   */
  private resolvePartnerProfileResultTitle(
    questionText: string,
    compiledTask: RoutedCompiledQueryTask,
  ): string {
    if (/(类型|类别|分类|分别|单独列|列一下|列出|名单|明细|清单)/u.test(questionText)) {
      return `${this.resolvePartnerProfileSubjectLabel(questionText)}类型明细`;
    }

    if (!/新增商机金额渠道商贡献|订单金额渠道商贡献|商机渠道商贡献/u.test(compiledTask.taskTitle)) {
      return compiledTask.taskTitle;
    }

    return '服务商画像统计';
  }

  /**
   * 解析服务商画像结果中应展示的主体名称。
   *
   * 参数说明：`questionText` 为用户原始问题。
   * 返回值说明：按用户用词返回渠道商、合作伙伴、代理商或服务商。
   */
  private resolvePartnerProfileSubjectLabel(questionText: string): string {
    if (/渠道商|渠道/u.test(questionText)) {
      return '渠道商';
    }
    if (/合作伙伴|伙伴/u.test(questionText)) {
      return '合作伙伴';
    }
    if (/代理商|经销商/u.test(questionText)) {
      return '代理商';
    }
    return '服务商';
  }

  /**
   * 判断用户是否询问“是否技术服务商”。
   *
   * 参数说明：`questionText` 为用户原始问题。
   * 返回值说明：命中技术服务商字样时返回 true。
   */
  private hasTechnicalServiceProviderQuestion(questionText: string): boolean {
    return /技术服务商/u.test(questionText);
  }

  /**
   * 构造服务商画像统计接口查询参数。
   *
   * 参数说明：
   * - `questionText`：用户问题，用于识别区域和“仅技术服务商/非技术服务商”筛选；
   * - `profileTask`：实际画像任务；
   * - `dictionaries`：远端字典。
   * 返回值说明：返回 `/analytics/partners/profile` 支持的筛选参数。
   * 调用注意事项：“是否技术服务商维度”只做维度展示，不会误下推为只查技术服务商。
   */
  private buildPartnerProfileAnalyticsQuery(
    questionText: string,
    profileTask: RoutedCompiledQueryTask,
    dictionaries: LianruanCrmOpenApiDictionaries,
  ): LianruanCrmOpenApiAnalyticsQuery {
    const query = this.buildPartnerContributionQuery(questionText, profileTask, dictionaries);

    if (/非技术服务商/u.test(questionText)) {
      query.isTechnicalServiceProvider = false;
    } else if (
      this.hasTechnicalServiceProviderQuestion(questionText) &&
      !/(是否|维度|分布|占比|一起|分别)/u.test(questionText)
    ) {
      query.isTechnicalServiceProvider = true;
    }

    return query;
  }

  /**
   * 将联软服务商画像统计结果转换为中文维度表格。
   *
   * 参数说明：`analytics` 为画像统计原始返回，`dictionaries` 为字典快照。
   * 返回值说明：返回“维度、分类、数量”三列为主的表格行。
   * 调用注意事项：兼容数组和对象两类分布结构，避免对方实现细节微调导致前端空白。
   */
  private buildPartnerProfileAnalyticsRows(
    analytics: LianruanCrmOpenApiPartnerProfileAnalytics,
    dictionaries: LianruanCrmOpenApiDictionaries,
  ): Array<Record<string, unknown>> {
    const rows: Array<Record<string, unknown>> = [];
    rows.push(
      ...this.normalizeProfileBuckets(
        '合作等级',
        analytics.byLevel ?? analytics.byPartnerLevel,
        dictionaries.partnerLevels,
      ),
    );
    rows.push(
      ...this.normalizeProfileBuckets(
        '是否技术服务商',
        analytics.byTechnicalServiceProvider,
        dictionaries.technicalServiceProviderTypes,
      ),
    );
    rows.push(...this.normalizeProfileBuckets('服务商状态', analytics.byStatus));
    rows.push(...this.normalizeProfileBuckets('区域', analytics.byRegion));
    rows.push(...this.normalizeProfileBuckets('大区', analytics.byBigRegion));

    return rows.filter((item) => Number(item.count ?? 0) > 0);
  }

  /**
   * 归一化画像维度分布。
   *
   * 参数说明：
   * - `dimension`：中文维度名；
   * - `source`：数组或对象形式的远端分布；
   * - `dictionary`：可选字典。
   * 返回值说明：返回统一维度行。
   * 调用注意事项：布尔值会按字典或默认中文转换，避免企微侧出现 `true/false`。
   */
  private normalizeProfileBuckets(
    dimension: string,
    source: unknown,
    dictionary?: LianruanCrmOpenApiDictionaryItem[] | Record<string, unknown>,
  ): Array<Record<string, unknown>> {
    const labelMap = this.buildDictionaryLabelMap(dictionary);
    const buckets = this.normalizeBucketList(source);

    return buckets.map((bucket) => {
      const rawValue = bucket.value ?? bucket.key ?? bucket.name ?? bucket.label ?? '';
      const value = this.readText(rawValue);
      const label =
        this.readText(bucket.label) ||
        labelMap.get(value) ||
        this.resolveBooleanLabel(rawValue) ||
        this.resolveBusinessLabel(value) ||
        value ||
        '未填写';
      return {
        dimension,
        item: label,
        count: this.resolveFiniteNumber(bucket.count),
      };
    });
  }

  /**
   * 将分布数据统一整理为数组。
   *
   * 参数说明：`source` 可以是数组，也可以是 `{key: count}` 对象。
   * 返回值说明：返回画像分桶数组。
   * 调用注意事项：只做结构兼容，不改变权限和统计口径。
   */
  private normalizeBucketList(source: unknown): LianruanCrmOpenApiPartnerProfileBucket[] {
    if (Array.isArray(source)) {
      return source.filter((item): item is LianruanCrmOpenApiPartnerProfileBucket =>
        Boolean(item && typeof item === 'object'),
      );
    }

    if (source && typeof source === 'object') {
      return Object.entries(source as Record<string, unknown>).map(([key, value]) => {
        if (value && typeof value === 'object') {
          return {
            key,
            ...(value as Record<string, unknown>),
          } as LianruanCrmOpenApiPartnerProfileBucket;
        }

        return {
          key,
          value: key,
          count: this.resolveFiniteNumber(value),
        };
      });
    }

    return [];
  }

  /**
   * 构造字典值到中文名的映射。
   *
   * 参数说明：`dictionary` 为远端字典项数组。
   * 返回值说明：返回 `value -> label` 映射。
   */
  private buildDictionaryLabelMap(
    dictionary?: LianruanCrmOpenApiDictionaryItem[] | Record<string, unknown>,
  ): Map<string, string> {
    if (!Array.isArray(dictionary)) {
      return new Map();
    }

    return new Map(
      dictionary.map((item) => [this.readText(item.value), this.readText(item.label)]),
    );
  }

  /**
   * 转换布尔分布标签。
   *
   * 参数说明：`value` 为远端原始分桶值。
   * 返回值说明：布尔或布尔字符串返回中文标签，其它值返回空字符串。
   */
  private resolveBooleanLabel(value: unknown): string {
    if (value === true || value === 'true') {
      return '技术服务商';
    }

    if (value === false || value === 'false') {
      return '非技术服务商';
    }

    return '';
  }

  /**
   * 将联软标准 API 的业务枚举值转换为中文展示名。
   *
   * 参数说明：
   * - `value`：远端返回的阶段、状态、等级等原始值。
   * - `labelMap`：远端 `/meta/dictionaries` 返回的字典映射。
   * 返回值说明：优先返回联软字典中文，其次返回本地常见编码意译，无法识别时返回原值。
   * 调用注意事项：该方法只影响展示文案，不改变过滤、聚合和权限判断口径。
   */
  private resolveBusinessLabel(value: string, labelMap?: Map<string, string>): string {
    const rawValue = this.readText(value);
    if (!rawValue) {
      return '';
    }

    const dictionaryLabel = labelMap?.get(rawValue);
    if (dictionaryLabel) {
      return dictionaryLabel;
    }

    const normalizedValue = rawValue.trim().toLowerCase();
    return LIANRUAN_FALLBACK_BUSINESS_LABELS[normalizedValue] ?? rawValue;
  }

  /**
   * 读取画像统计总数。
   *
   * 参数说明：`analytics` 为统计原始返回，`rows` 为已归一化维度行。
   * 返回值说明：优先返回接口总数，缺失时用同一维度最大合计兜底。
   */
  private resolveProfileTotalCount(
    analytics: LianruanCrmOpenApiPartnerProfileAnalytics,
    rows: Array<Record<string, unknown>>,
  ): number {
    const totalCount = this.resolveFiniteNumber(analytics.totalCount);
    if (totalCount > 0) {
      return totalCount;
    }

    const countByDimension = new Map<string, number>();
    for (const row of rows) {
      const dimension = this.readText(row.dimension);
      countByDimension.set(
        dimension,
        (countByDimension.get(dimension) ?? 0) + this.resolveFiniteNumber(row.count),
      );
    }

    return Math.max(0, ...countByDimension.values());
  }

  /**
   * 安全读取数值。
   *
   * 参数说明：`value` 为接口返回的数值或字符串数值。
   * 返回值说明：可解析时返回数字，否则返回 0。
   */
  private resolveFiniteNumber(value: unknown): number {
    const numberValue = Number(value ?? 0);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  /**
   * 构造服务商画像任务，并按用户问法决定是否保留加入时间过滤。
   *
   * 参数说明：`questionText` 为用户原始问题；
   * 参数说明：`compiledTask` 为原始服务商画像任务。
   * 返回值说明：返回用于拉取 `partners` 主数据的任务副本。
   * 调用注意事项：普通“最近一年服务商画像”默认按当前授权快照统计；但用户明确说
   * “加入/新增/创建/入驻的服务商”时，应按服务商 `createdAt` 时间窗过滤。
   */
  private buildPartnerProfileSnapshotTask(
    questionText: string,
    compiledTask: RoutedCompiledQueryTask,
  ): RoutedCompiledQueryTask {
    if (this.isPartnerCreatedQuestion(questionText)) {
      return compiledTask;
    }

    const snapshotFilters = { ...compiledTask.plan.filters };
    delete snapshotFilters.startAt;
    delete snapshotFilters.endAt;
    delete snapshotFilters.timeRange;

    return {
      ...compiledTask,
      plan: {
        ...compiledTask.plan,
        filters: snapshotFilters,
      },
    };
  }

  /**
   * 判断服务商画像是否应按加入时间过滤。
   *
   * 参数说明：`questionText` 为用户原始问题。
   * 返回值说明：明确出现加入、新增、创建、入驻等主数据发生词时返回 `true`。
   * 调用注意事项：不把普通“最近一年服务商”误判为新加入服务商，避免排除存量渠道。
   */
  private isPartnerCreatedQuestion(questionText: string): boolean {
    return /(加入|新增|新建|创建|入驻|注册|发展).{0,8}(服务商|渠道商|渠道|伙伴|代理商|经销商)|(服务商|渠道商|渠道|伙伴|代理商|经销商).{0,8}(加入|新增|新建|创建|入驻|注册|发展)/u.test(
      questionText,
    );
  }

  /**
   * 构建服务商画像过滤标签。
   *
   * 参数说明：
   * - `originalTask` 保留用户输入的时间口径；
   * - `snapshotTask` 表示实际服务商主数据读取口径。
   * 返回值说明：返回面向用户的中文过滤说明。
   */
  private buildPartnerProfileAppliedFilters(
    questionText: string,
    taskConfig: StandardApiTaskConfig,
    originalTask: RoutedCompiledQueryTask,
    snapshotTask: RoutedCompiledQueryTask,
    scopeSummary: string,
    records: StandardApiRecord[],
  ): AppliedFilter[] {
    const filters = this.buildAppliedFilters(
      taskConfig,
      snapshotTask,
      scopeSummary,
      records,
    );
    filters.push({
      label: '用户时间表达',
      value: this.resolveTemporalFilterLabel(originalTask),
    });
    filters.push({
      label: '画像统计口径',
      value: this.isPartnerCreatedQuestion(questionText)
        ? '按服务商加入时间统计。'
        : '按当前授权服务商主数据快照统计，不按服务商创建时间排除历史服务商。',
    });
    return filters;
  }

  /**
   * 解析联软标准 OpenAPI 当前执行策略。
   *
   * 参数说明：
   * - `boundUser`：标准 OpenAPI client 当前绑定的联软 CRM 用户；
   * - `user`：本系统当前登录或企微映射出的 CRM 用户。
   * 返回值说明：返回绑定用户直连或服务账号本地裁剪策略。
   * 可能抛出的异常：未开启服务账号模式、绑定账号角色不允许或当前用户缺失时抛出只读 API 兜底异常。
   * 调用注意事项：不能直接删除绑定账号校验；服务账号模式必须显式开启，并由本地二次权限裁剪兜住。
   */
  private resolveOpenApiExecutionPolicy(
    boundUser: LianruanCrmOpenApiBoundUser,
    user: CrmUser,
  ): StandardApiExecutionPolicy {
    const boundUserId = this.readText(boundUser.id);
    const currentUserId = this.readText(user.id);
    const boundUserRole = this.readText(boundUser.role ?? boundUser.roleName).toLowerCase();

    if (boundUserId && currentUserId && boundUserId === currentUserId) {
      return {
        mode: 'bound-user',
        requiresLocalScopeEnforcement: false,
        boundUserId,
        currentUserId,
        boundUserRole,
      };
    }

    if (
      this.getStandardOpenApiAccessMode() === 'service-client-with-local-scope' &&
      this.getServiceClientAllowedRoles().includes(boundUserRole)
    ) {
      return {
        mode: 'service-client-with-local-scope',
        requiresLocalScopeEnforcement: true,
        boundUserId: boundUserId || '未配置',
        currentUserId,
        boundUserRole,
      };
    }

    throw new OfficialApiFallbackToSqlError(
      `当前标准 OpenAPI 已绑定 CRM 用户 ${boundUserId || '未配置'}，仅支持该账号执行页面联调分析；如需其他账号，请补充对应 client 凭证、启用用户态 token，或在确认服务账号权限后开启本地权限裁剪模式。`,
    );
  }

  /**
   * 构造 Markdown 快照分析的本地执行策略。
   *
   * 参数说明：`user` 为当前提问人映射出的 CRM 用户。
   * 返回值说明：返回不触发远端 OpenAPI 绑定校验的本地快照策略。
   * 调用注意事项：Markdown 快照已经在刷新阶段通过 OpenAPI 生成；正式问数阶段不再实时调用 OpenAPI。
   */
  private resolveMarkdownSnapshotExecutionPolicy(user: CrmUser): StandardApiExecutionPolicy {
    const currentUserId = this.readText(user.id) || 'unknown-user';
    return {
      mode: 'bound-user',
      requiresLocalScopeEnforcement: false,
      boundUserId: currentUserId,
      currentUserId,
      boundUserRole: this.canBypassLocalScope(user) ? 'admin' : 'user',
    };
  }

  /**
   * 构造 Markdown 快照分析的数据范围说明。
   *
   * 参数说明：`scopeSummary` 为原权限摘要。
   * 返回值说明：返回追加了本地快照数据源的范围说明。
   */
  private buildMarkdownSnapshotScopeSummary(scopeSummary: string): string {
    return `${scopeSummary}；数据源为当前用户可见 CRM 标准业务数据。`;
  }

  /**
   * 读取联软标准 OpenAPI 访问模式。
   *
   * 参数说明：无。
   * 返回值说明：默认返回绑定用户直连；仅配置明确声明时返回服务账号本地裁剪。
   * 调用注意事项：保持默认安全，避免升级后自动放宽现有环境权限。
   */
  private getStandardOpenApiAccessMode():
    | 'bound-user'
    | 'service-client-with-local-scope' {
    return (
      this.localRuntimeConfigService?.getCrmStandardOpenApiConfig().accessMode ??
      (process.env.CRM_STANDARD_OPEN_API_ACCESS_MODE ===
      'service-client-with-local-scope'
        ? 'service-client-with-local-scope'
        : 'bound-user')
    );
  }

  /**
   * 读取允许作为服务账号的联软角色。
   *
   * 参数说明：无。
   * 返回值说明：返回小写角色标识集合，默认只允许超管和管理员。
   * 调用注意事项：该列表只校验绑定 client 的角色，不代表当前用户可越权查看数据。
   */
  private getServiceClientAllowedRoles(): string[] {
    const configured =
      this.localRuntimeConfigService?.getCrmStandardOpenApiConfig()
        .serviceClientAllowedRoles;
    if (configured && configured.length > 0) {
      return configured;
    }

    return String(
      process.env.CRM_STANDARD_OPEN_API_SERVICE_CLIENT_ALLOWED_ROLES ??
        'superadmin,admin',
    )
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }

  /**
   * 构建带执行模式说明的权限摘要。
   *
   * 参数说明：`scopeSummary` 为原始权限摘要，`executionPolicy` 为标准 API 执行策略。
   * 返回值说明：服务账号模式下补充本地裁剪说明，旧模式保持原样。
   * 调用注意事项：这是用户可见口径说明，不参与权限判断。
   */
  private buildExecutionScopeSummary(
    scopeSummary: string,
    executionPolicy: StandardApiExecutionPolicy,
  ): string {
    if (!executionPolicy.requiresLocalScopeEnforcement) {
      return scopeSummary;
    }

    return `${scopeSummary}；标准 OpenAPI 使用服务账号取数，结果已按当前 CRM 用户权限二次裁剪。`;
  }

  /**
   * 从 OpenAPI Markdown 快照读取资源明细。
   *
   * 参数说明：`taskConfig` 决定资源名，`compiledTask` 提供时间过滤和排序口径。
   * 返回值说明：返回当前任务范围内的本地快照记录列表。
   * 可能抛出的异常：快照服务未启用或明细文件缺失时抛出 `RealDataUnavailableError`。
   * 调用注意事项：正式分析不在问答阶段分页请求 OpenAPI，OpenAPI 仅负责刷新 Markdown 文件。
   */
  private async listAllRecords(
    taskConfig: StandardApiTaskConfig,
    compiledTask: RoutedCompiledQueryTask,
  ): Promise<StandardApiRecord[]> {
    void compiledTask;
    const markdownRecords = this.requireOpenApiMarkdownSnapshotService().readResourceRecords(
      taskConfig.resource,
    );
    if (!markdownRecords) {
      throw new RealDataUnavailableError(
        `本地 OpenAPI Markdown 快照缺少 ${taskConfig.resource} 明细文件，请先刷新快照后再分析。`,
      );
    }

    return this.deduplicateResourceRecords(taskConfig.resource, markdownRecords);
  }

  /**
   * 对标准 API 分页结果按业务主键去重。
   *
   * 参数说明：`resource` 为资源名，`records` 为分页拉取的原始记录。
   * 返回值说明：同一业务 ID 多次出现时只保留第一条，避免分页边界、接口别名或同步重复导致金额和数量被放大。
   * 调用注意事项：没有稳定 ID 的记录不强行合并，避免把不同业务对象误去重。
   */
  private deduplicateResourceRecords(
    resource: LianruanCrmOpenApiResource,
    records: StandardApiRecord[],
  ): StandardApiRecord[] {
    const seenKeys = new Set<string>();
    const deduplicatedRecords: StandardApiRecord[] = [];

    for (const record of records) {
      const recordKey = this.resolveRecordIdentityKey(resource, record);
      if (recordKey && seenKeys.has(recordKey)) {
        continue;
      }

      if (recordKey) {
        seenKeys.add(recordKey);
      }
      deduplicatedRecords.push(record);
    }

    return deduplicatedRecords;
  }

  /**
   * 解析标准 API 记录稳定业务主键。
   *
   * 参数说明：`resource` 为资源名，`record` 为一条标准 API 记录。
   * 返回值说明：返回带资源前缀的去重键；无法识别时返回空字符串。
   */
  private resolveRecordIdentityKey(
    resource: LianruanCrmOpenApiResource,
    record: StandardApiRecord,
  ): string {
    const id = this.readText(
      record.id ??
        record[`${resource.slice(0, -1)}Id`] ??
        record.opportunityId ??
        record.opportunity_id ??
        record.opportunityNo ??
        record.opportunity_no ??
        record.businessNo ??
        record.business_no ??
        record.code ??
        record.no,
    );

    return id ? `${resource}:${id}` : '';
  }

  /**
   * 尝试通过渠道贡献统计接口执行商机渠道汇总。
   *
   * 参数说明：各参数与 `executePartnerContributionTask` 保持一致。
   * 返回值说明：统计接口可用时返回数据切片；不可用时返回同源列表聚合说明。
   * 调用注意事项：这里不再把统计接口不可用伪装成 SQL 兜底，后续仍然只读取联软标准 OpenAPI。
   */
  private async tryExecutePartnerContributionAnalyticsTask(
    questionText: string,
    taskConfig: StandardApiTaskConfig,
    compiledTask: RoutedCompiledQueryTask,
    scopeSummary: string,
    dictionaries: LianruanCrmOpenApiDictionaries,
  ): Promise<PartnerContributionAnalyticsDecision> {
    try {
      return {
        slice: await this.executePartnerContributionTask(
          questionText,
          taskConfig,
          compiledTask,
          scopeSummary,
          dictionaries,
        ),
      };
    } catch (error) {
      if (error instanceof OfficialApiAnalyticsUnavailableError) {
        return {
          listAggregationNote: error.message,
        };
      }

      return {
        listAggregationNote:
          '联软渠道贡献统计接口暂不可用，已使用同一标准 OpenAPI 商机列表按渠道商聚合复核。',
      };
    }
  }

  /**
   * 优先通过联软渠道贡献统计接口执行渠道商贡献分析。
   *
   * 参数说明：
   * - `questionText`：用户问题，用于解析区域筛选；
   * - `taskConfig`：当前商机分析对象配置；
   * - `compiledTask`：渠道商贡献任务；
   * - `scopeSummary`：当前权限范围说明；
   * - `dictionaries`：远端字典，用于把“山东区域”这类自然说法归一到接口区域值。
   * 返回值说明：返回统一分析数据切片。
   * 调用注意事项：该方法只读调用 `/analytics/partners/contribution`，权限裁剪仍由联软标准 OpenAPI 完成。
   */
  private async executePartnerContributionTask(
    questionText: string,
    taskConfig: StandardApiTaskConfig,
    compiledTask: RoutedCompiledQueryTask,
    scopeSummary: string,
    dictionaries: LianruanCrmOpenApiDictionaries,
  ): Promise<AnalysisDatasetSlice> {
    const query = this.buildPartnerContributionQuery(questionText, compiledTask, dictionaries);
    const contributions = await this.lianruanCrmQueryAdapterService.listPartnerContributions(query);
    const rows = this.buildPartnerContributionRows(contributions);
    if (rows.length === 0 && this.hasPartnerContributionTimeFilter(query)) {
      // 联软统计接口在部分联调版本中带 createdAfter/createdBefore 会返回空，
      // 但商机列表接口同口径可查到数据；此处交给同源列表聚合复核，避免把接口口径缺口误展示为“无数据”。
      throw new OfficialApiAnalyticsUnavailableError(
        '联软渠道贡献统计接口带时间筛选未返回可用结果，已使用同一标准 OpenAPI 商机列表按渠道商聚合复核。',
      );
    }
    const totalAmount = rows.reduce((sum, item) => sum + item.amount, 0);
    const totalCount = rows.reduce((sum, item) => sum + item.count, 0);
    const result: StandardApiTaskResult = {
      summary:
        rows.length > 0
          ? `已通过联软标准 OpenAPI 渠道贡献统计完成 ${compiledTask.taskTitle}，命中 ${totalCount} 条商机并聚合为 ${rows.length} 个渠道商分组。`
          : '当前任务在标准 OpenAPI 授权范围内未命中渠道商商机数据。',
      appliedFilters: this.buildAppliedFilters(taskConfig, compiledTask, scopeSummary, rows),
      metricCards: this.buildMetricCards(taskConfig, compiledTask, totalAmount, totalCount, rows.length),
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

    return {
      datasetId: buildEntityId('dataset'),
      taskId: compiledTask.taskId,
      taskTitle: compiledTask.taskTitle,
      resultKind: compiledTask.resultKind,
      purpose: compiledTask.purpose,
      sql: this.buildPartnerContributionExecutionSummary(compiledTask, query),
      executionMode: compiledTask.executionMode,
      executionSource: compiledTask.executionSource,
      matchedAdapter: compiledTask.matchedAdapter,
      gapReason: compiledTask.gapReason,
      summary: result.summary,
      temporalScope: buildResultTemporalScope(compiledTask.plan.temporalSlot),
      appliedFilters: result.appliedFilters,
      metricCards: result.metricCards,
      primaryView: result.primaryView,
      secondaryViews: result.secondaryViews,
      tableRows: result.tableRows,
      rowCount: result.tableRows.length,
    };
  }

  /**
   * 构造渠道贡献统计查询参数。
   *
   * 参数说明：`questionText` 为用户问题，`compiledTask` 提供时间过滤，`dictionaries` 提供区域字典。
   * 返回值说明：返回联软统计接口支持的只读筛选参数。
   * 调用注意事项：只下推时间和明确区域，不额外放宽当前 token 的权限范围。
   */
  private buildPartnerContributionQuery(
    questionText: string,
    compiledTask: RoutedCompiledQueryTask,
    dictionaries: LianruanCrmOpenApiDictionaries,
  ): LianruanCrmOpenApiAnalyticsQuery {
    const query: LianruanCrmOpenApiAnalyticsQuery = {};
    if (typeof compiledTask.plan.filters.startAt === 'string') {
      query.createdAfter = compiledTask.plan.filters.startAt;
    }
    if (typeof compiledTask.plan.filters.endAt === 'string') {
      query.createdBefore = compiledTask.plan.filters.endAt;
    }

    const region = this.resolveDictionaryRegionFilter(questionText, dictionaries, 'regions');
    if (region) {
      query.region = region;
    }

    const bigRegion = this.resolveDictionaryRegionFilter(questionText, dictionaries, 'bigRegions');
    if (bigRegion) {
      query.bigRegion = bigRegion;
    }

    return query;
  }

  /**
   * 将联软渠道贡献统计行转换为统一聚合行。
   *
   * 参数说明：`contributions` 为 `/analytics/partners/contribution` 原始行。
   * 返回值说明：返回系统统一的 `amount/count/partnerName` 结果行。
   * 调用注意事项：当前“渠道商贡献”主指标取商机数量和商机金额，报价/订单指标保留在明细行中供后续扩展展示。
   */
  private buildPartnerContributionRows(
    contributions: LianruanCrmOpenApiPartnerContributionRecord[],
  ): StandardApiAggregateRow[] {
    return contributions
      .map((record) => {
        const partnerId = this.readText(record.partnerId) || 'unknown-partner';
        const partnerName =
          this.readText(record.partnerName) ||
          (partnerId === 'unknown-partner' ? '未填写渠道商' : partnerId);
        const amount = Number(record.opportunityAmount ?? 0);
        const count = Number(record.opportunityCount ?? 0);
        return {
          ownerId: partnerId,
          ownerName: partnerName,
          amount: Number.isFinite(amount) ? amount : 0,
          count: Number.isFinite(count) ? count : 0,
          bucket_label: partnerName,
          partnerId,
          partnerName,
          partnerLevel: this.readText(record.partnerLevel) || undefined,
          region: this.readText(record.region) || undefined,
          bigRegion: this.readText(record.bigRegion) || undefined,
          registrationCount: Number(record.registrationCount ?? 0),
          quoteCount: Number(record.quoteCount ?? 0),
          quoteAmount: Number(record.quoteAmount ?? 0),
          orderCount: Number(record.orderCount ?? 0),
          orderAmount: Number(record.orderAmount ?? 0),
        };
      })
      .filter((row) => row.amount > 0 || row.count > 0)
      .sort((left, right) => right.amount - left.amount || right.count - left.count);
  }

  /**
   * 将服务商列表记录转换为画像明细行。
   *
   * 参数说明：
   * - `records`：Markdown 快照中的 partners 明细；
   * - `dictionaries`：快照或历史字典，用于把 `partnerLevel` 翻译为业务名称。
   * 返回值说明：返回适合 Web 与企微展示的服务商明细行。
   * 调用注意事项：不读取手机号、邮箱等敏感联系方式，避免基础画像问数扩大字段边界。
   */
  private buildPartnerProfileRows(
    records: StandardApiRecord[],
    dictionaries: LianruanCrmOpenApiDictionaries,
  ): Array<Record<string, unknown>> {
    const levelDictionary = dictionaries.partnerLevels;
    const levelLabelMap = new Map(
      Array.isArray(levelDictionary)
        ? levelDictionary.map((item) => [item.value, item.label])
        : [],
    );

    return records
      .map((record) => {
        const partnerId = this.readText(record.id);
        const partnerName =
          this.readText(record.shortName ?? record.name ?? record.partnerName) ||
          (partnerId ? partnerId : '未命名服务商');
        const partnerLevel = this.readText(record.partnerLevel);
        const legacyLevel = this.readText(record.level);
        const partnerLevelLabel =
          this.readText(record.partnerLevelName) ||
          legacyLevel ||
          levelLabelMap.get(partnerLevel) ||
          partnerLevel ||
          '未填写等级';
        const isTechnicalServiceProvider = this.resolveTechnicalServiceProviderFlag(record);
        const partnerType =
          this.readText(record.partnerTypeName ?? record.partnerType ?? record.typeName ?? record.type) ||
          (isTechnicalServiceProvider ? '技术服务商' : '未填写类型');
        const technicalServiceProviderType =
          this.readText(record.technicalServiceProviderType ?? record.techServiceType) ||
          (isTechnicalServiceProvider ? partnerType : '非技术服务商');

        return {
          partnerId,
          partnerName,
          partnerLevel: partnerLevelLabel,
          partnerType,
          isTechnicalServiceProvider,
          technicalServiceProvider: isTechnicalServiceProvider ? '是' : '否',
          technicalServiceProviderType,
          region: this.readText(record.region) || undefined,
          bigRegion: this.readText(record.bigRegion) || undefined,
          status: this.readText(record.status) || '未填写状态',
          parentPartnerId: this.readText(record.parentPartnerId) || undefined,
          joinDate: this.readText(record.joinDate) || undefined,
          createdAt: this.readText(record.createdAt) || undefined,
        };
      })
      .sort((left, right) =>
        String(left.partnerName).localeCompare(String(right.partnerName), 'zh-CN'),
      );
  }

  /**
   * 判断渠道贡献统计是否携带时间筛选。
   *
   * 参数说明：`query` 为统计接口查询条件。
   * 返回值说明：带开始或结束时间时返回 `true`。
   * 调用注意事项：仅用于统计接口空结果复核，不改变用户明确给出的时间范围。
   */
  private hasPartnerContributionTimeFilter(
    query: LianruanCrmOpenApiAnalyticsQuery,
  ): boolean {
    return Boolean(query.createdAfter || query.createdBefore);
  }

  /**
   * 构建空结果提示，帮助用户区分“数据源没通”和“当前时间/区域条件未命中”。
   *
   * 参数说明：
   * - `questionText`：用户原始问题，用于识别山东区等区域词；
   * - `taskConfig`：当前标准 API 资源配置；
   * - `compiledTask`：当前分析任务，用于读取时间口径；
   * - `currentRangeRecords`：当前时间范围内已拉取的记录。
   * 返回值说明：存在同类数据但当前筛选未命中时返回中文提示，否则返回 `undefined`。
   * 调用注意事项：该方法只补充解释，不把范围外数据混入当前查询结果，避免改变用户明确给出的时间条件。
   */
  private async buildEmptyResultHint(
    questionText: string,
    taskConfig: StandardApiTaskConfig,
    compiledTask: RoutedCompiledQueryTask,
    currentRangeRecords: StandardApiRecord[],
    user?: CrmUser,
    executionPolicy?: StandardApiExecutionPolicy,
  ): Promise<string | undefined> {
    const hasTimeRange =
      typeof compiledTask.plan.filters.startAt === 'string' ||
      typeof compiledTask.plan.filters.endAt === 'string';
    if (!hasTimeRange) {
      return undefined;
    }

    const candidateRecords =
      currentRangeRecords.length > 0
        ? currentRangeRecords
        : await this.listRecentRecordsForEmptyHint(taskConfig);
    const scopedCandidateRecords =
      executionPolicy?.requiresLocalScopeEnforcement && user
        ? this.applyLocalFilters(
            questionText,
            taskConfig,
            compiledTask,
            candidateRecords,
            user,
            executionPolicy,
          )
        : candidateRecords;
    const matchedRecords = this.filterRecordsByQuestionRegion(
      questionText,
      scopedCandidateRecords,
    );
    if (matchedRecords.length === 0) {
      return undefined;
    }

    const recentTime = this.resolveLatestRecordTime(matchedRecords);
    const temporalLabel = this.resolveTemporalFilterLabel(compiledTask);
    const recentTimeText = recentTime ? `，最近一条创建时间为 ${recentTime}` : '';
    return `当前“${temporalLabel}”时间范围内没有命中${taskConfig.subjectLabel}数据；但在当前权限范围内可以找到相关${taskConfig.subjectLabel}${recentTimeText}。建议把问题改成“2026年5月山东区${taskConfig.subjectLabel}情况”或“最近三个月山东区${taskConfig.subjectLabel}情况”再试。`;
  }

  /**
   * 从 Markdown 快照读取最近记录作为空结果诊断样本。
   *
   * 参数说明：`taskConfig` 为当前标准 API 资源配置。
   * 返回值说明：返回快照中的前 50 条记录，快照缺少该资源时返回空数组。
   * 调用注意事项：只在当前查询结果为空时触发，且不在问答阶段额外请求 OpenAPI。
   */
  private async listRecentRecordsForEmptyHint(
    taskConfig: StandardApiTaskConfig,
  ): Promise<StandardApiRecord[]> {
    const markdownRecords = this.requireOpenApiMarkdownSnapshotService().readResourceRecords(
      taskConfig.resource,
    );
    if (markdownRecords) {
      return markdownRecords.slice(0, 50);
    }

    return [];
  }

  /**
   * 从渠道列表补齐商机里的渠道名称。
   *
   * 参数说明：`records` 为已按权限、时间和区域过滤后的商机记录。
   * 返回值说明：返回 `partnerId -> partnerName` 映射，快照缺少伙伴明细时返回空映射。
   * 调用注意事项：只读取本地 Markdown 快照，不在正式问答阶段额外请求 `/partners`。
   */
  private async buildPartnerNameMap(
    records: StandardApiRecord[],
  ): Promise<Map<string, string>> {
    const targetPartnerIds = new Set(
      records
        .map((record) =>
          this.readText(record.partnerId ?? record.assignedPartnerId ?? record.channelId),
        )
        .filter(Boolean),
    );
    const partnerNameMap = new Map<string, string>();
    if (targetPartnerIds.size === 0) {
      return partnerNameMap;
    }

    const markdownPartners = this.requireOpenApiMarkdownSnapshotService().readResourceRecords('partners');
    if (markdownPartners) {
      for (const partner of markdownPartners) {
        const partnerId = this.readText(partner.id ?? partner.partnerId ?? partner.name);
        const partnerName = this.readText(partner.name ?? partner.partnerName);
        if (partnerId && partnerName && targetPartnerIds.has(partnerId)) {
          partnerNameMap.set(partnerId, partnerName);
        }
      }
      return partnerNameMap;
    }

    return partnerNameMap;
  }

  /**
   * 按资源名调用已封装的标准 API 查询适配层。
   *
   * 参数说明：`resource` 为六类对象资源名，`query` 为标准分页查询参数。
   * 返回值说明：返回统一分页结构。
   * 调用注意事项：统一入口便于后续替换为用户态 token 或多 client 策略。
   */
  private async listResource(
    resource: LianruanCrmOpenApiResource,
    query: LianruanCrmOpenApiListQuery,
  ): Promise<LianruanCrmOpenApiPageResult<StandardApiRecord>> {
    return this.lianruanCrmQueryAdapterService.listByResource(resource, query);
  }

  /**
   * 把分析任务时间窗口转换为标准 API 查询参数。
   *
   * 参数说明：`compiledTask` 为当前任务。
   * 返回值说明：返回标准 API 支持的通用时间和排序参数。
   * 调用注意事项：`time-trend` 按创建时间正序，其它结果按更新时间倒序，便于首屏尽快取到近期数据。
   */
  private buildListQuery(
    compiledTask: RoutedCompiledQueryTask,
  ): LianruanCrmOpenApiListQuery {
    const startAt =
      typeof compiledTask.plan.filters.startAt === 'string'
        ? compiledTask.plan.filters.startAt
        : undefined;
    const endAt =
      typeof compiledTask.plan.filters.endAt === 'string'
        ? compiledTask.plan.filters.endAt
        : undefined;
    const region =
      typeof compiledTask.plan.filters.region === 'string'
        ? compiledTask.plan.filters.region
        : undefined;
    const bigRegion =
      typeof compiledTask.plan.filters.bigRegion === 'string'
        ? compiledTask.plan.filters.bigRegion
        : undefined;

    return {
      ...(startAt ? { createdAfter: startAt } : {}),
      ...(endAt ? { createdBefore: endAt } : {}),
      ...(region ? { region } : {}),
      ...(bigRegion ? { bigRegion } : {}),
      sortBy: compiledTask.resultKind === 'time-trend' ? 'createdAt' : 'updatedAt',
      sortOrder: compiledTask.resultKind === 'time-trend' ? 'asc' : 'desc',
    };
  }

  /**
   * 对标准 API 记录执行本地补充过滤。
   *
   * 参数说明：
   * - `questionText`：原始问题，用于区域词匹配；
   * - `taskConfig`：当前资源配置；
   * - `compiledTask`：当前任务；
   * - `records`：远端返回记录。
   * 返回值说明：返回已按时间、负责人、区域和风险口径收窄后的记录。
   * 调用注意事项：本地过滤只允许收窄，不允许放宽远端已裁剪的数据范围。
   */
  private applyLocalFilters(
    questionText: string,
    taskConfig: StandardApiTaskConfig,
    compiledTask: RoutedCompiledQueryTask,
    records: StandardApiRecord[],
    user?: CrmUser,
    executionPolicy?: StandardApiExecutionPolicy,
    regionConstraint?: BusinessChainRegionConstraint,
    options?: { skipQuestionRegion?: boolean },
  ): StandardApiRecord[] {
    const ownerIds = this.normalizeStringList(compiledTask.plan.filters.ownerIds);
    const organizationIds = this.normalizeStringList(
      compiledTask.plan.filters.organizationIds,
    );
    const departmentIds = this.normalizeStringList(compiledTask.plan.filters.departmentIds);
    const startAt =
      typeof compiledTask.plan.filters.startAt === 'string'
        ? compiledTask.plan.filters.startAt
        : undefined;
    const endAt =
      typeof compiledTask.plan.filters.endAt === 'string'
        ? compiledTask.plan.filters.endAt
        : undefined;
    const entityNameConstraint = this.resolveQuestionEntityNameConstraint(
      questionText,
      records,
    );
    const matchedRegions = entityNameConstraint || options?.skipQuestionRegion
      ? []
      : this.matchRegionsFromQuestion(
          questionText,
          records,
          regionConstraint,
        );
    const staleThreshold = resolveStaleOpportunityThreshold(questionText);
    const isStaleOpportunityRisk =
      taskConfig.resource === 'opportunities' &&
      compiledTask.resultKind === 'risk-overview' &&
      isStaleOpportunityQuestionText(questionText);
    const isExpectedSignWithoutQuoteRisk =
      taskConfig.resource === 'opportunities' &&
      compiledTask.resultKind === 'risk-overview' &&
      this.isExpectedSignWithoutQuoteQuestion(questionText);
    const isBusinessChainSnapshot = compiledTask.matchedAdapter.startsWith(
      'crm-official-api.business-chain-',
    );

    return records.filter((record) => {
      const createdAt = this.readRecordTime(record);
      if (startAt && createdAt && createdAt < startAt) {
        return false;
      }

      if (endAt && createdAt && createdAt >= endAt) {
        return false;
      }

      if (ownerIds.length > 0) {
        const ownerCandidates = this.collectOwnerCandidates(record);
        if (
          (!executionPolicy?.requiresLocalScopeEnforcement ||
            ownerCandidates.length > 0) &&
          !ownerCandidates.some((item) => ownerIds.includes(item))
        ) {
          return false;
        }
      }

      if (
        executionPolicy?.requiresLocalScopeEnforcement &&
        user &&
        !this.canBypassLocalScope(user) &&
        !this.isRecordInsideLocalScope(record, user, ownerIds, organizationIds, departmentIds)
      ) {
        return false;
      }

      if (
        entityNameConstraint &&
        !this.recordMatchesQuestionEntityName(record, entityNameConstraint)
      ) {
        return false;
      }

      if (matchedRegions.length > 0) {
        if (!this.recordMatchesRegionTokens(record, matchedRegions)) {
          return false;
        }
      }

      if (isStaleOpportunityRisk) {
        return (
          this.isEffectiveOpportunityRecord(record) &&
          this.resolveStaleDays(record) > staleThreshold.days
        );
      }

      if (isExpectedSignWithoutQuoteRisk) {
        return (
          this.isEffectiveOpportunityRecord(record) &&
          this.isExpectedSignInDays(record, 30) &&
          !this.hasLinkedQuote(record)
        );
      }

      if (
        compiledTask.resultKind === 'risk-overview' &&
        taskConfig.resource === 'opportunities' &&
        !this.isRiskStage(this.readText(record.stage ?? record.status))
      ) {
        return false;
      }

      if (
        taskConfig.resource === 'opportunities' &&
        compiledTask.resultKind !== 'risk-overview' &&
        !isBusinessChainSnapshot &&
        !this.isEffectiveOpportunityRecord(record)
      ) {
        return false;
      }

      return true;
    });
  }

  /**
   * 判断当前用户是否可以跳过服务账号模式下的本地二次裁剪。
   *
   * 参数说明：`user` 为当前 CRM 用户。
   * 返回值说明：应用超管或 CRM 管理员返回 true。
   * 调用注意事项：普通角色必须继续走记录级匹配，不能因为服务 client 是超管就扩大权限。
   */
  private canBypassLocalScope(user: CrmUser): boolean {
    return Boolean(user.isAdmin);
  }

  /**
   * 判断单条标准 API 记录是否落在当前用户本地权限范围内。
   *
   * 参数说明：
   * - `record`：联软标准 API 明细记录；
   * - `user`：当前 CRM 用户；
   * - `ownerIds/organizationIds/departmentIds`：统一作用域注入后的权限范围。
   * 返回值说明：记录能匹配负责人、组织或部门任一范围时返回 true；无可比字段时保守返回 false。
   * 调用注意事项：这是服务账号模式的关键安全闸门，只能收窄不能放宽远端取数结果。
   */
  private isRecordInsideLocalScope(
    record: StandardApiRecord,
    user: CrmUser,
    ownerIds: string[],
    organizationIds: string[],
    departmentIds: string[],
  ): boolean {
    const effectiveOwnerIds =
      ownerIds.length > 0 ? ownerIds : [this.readText(user.id)].filter(Boolean);
    const ownerCandidates = this.collectOwnerCandidates(record);
    if (
      ownerCandidates.length > 0 &&
      ownerCandidates.some((item) => effectiveOwnerIds.includes(item))
    ) {
      return true;
    }

    const organizationCandidates = this.collectOrganizationCandidates(record);
    if (
      organizationIds.length > 0 &&
      organizationCandidates.some((item) => organizationIds.includes(item))
    ) {
      return true;
    }

    const departmentCandidates = this.collectDepartmentCandidates(record);
    if (
      departmentIds.length > 0 &&
      departmentCandidates.some((item) => departmentIds.includes(item))
    ) {
      return true;
    }

    return false;
  }

  /**
   * 判断标准 API 商机是否属于默认“有效商机”统计口径。
   *
   * 参数说明：`record` 为标准 API 商机记录。
   * 返回值说明：排除审批中、输单/取消、赢单以及 1% 已联系客户等不计入当前商机池的记录。
   * 调用注意事项：该口径与历史只读 SQL 商机列表保持一致，避免智能分析比 CRM 页面口径偏大。
   */
  private isEffectiveOpportunityRecord(record: StandardApiRecord): boolean {
    const pendingStep = this.parseNumericAmount(record.pendingStep ?? record.pending_step);
    if (pendingStep > 0) {
      return false;
    }

    const submitApplyingAt = this.readText(record.submitApplyingAt ?? record.submit_applying_at);
    const finishApproveAt = this.readText(record.finishApproveAt ?? record.finish_approve_at);
    if (submitApplyingAt && !finishApproveAt) {
      return false;
    }

    const stageText = this.normalizeComparableText(
      record.stageName ?? record.stage ?? record.statusName ?? record.status,
    );
    if (!stageText) {
      return true;
    }

    return ![
      '输单',
      '输单项目取消',
      '项目取消',
      '1%已联系上客户',
      '已联系上客户',
      '赢单',
      'won',
      'lost',
      'cancelled',
      'canceled',
      'closed',
      'invalid',
    ].includes(stageText);
  }

  /**
   * 解析风险类任务的用户可见标题。
   *
   * 参数说明：`questionText` 为原问题，`taskConfig/compiledTask` 为当前执行上下文。
   * 返回值说明：未更新、预计签约未报价和普通阶段风险分别返回明确标题。
   */
  private resolveRiskAwareTaskTitle(
    questionText: string,
    taskConfig: StandardApiTaskConfig,
    compiledTask: RoutedCompiledQueryTask,
  ): string {
    if (taskConfig.resource !== 'opportunities' || compiledTask.resultKind !== 'risk-overview') {
      return compiledTask.taskTitle;
    }

    if (isStaleOpportunityQuestionText(questionText)) {
      return buildStaleOpportunityAnalysisTitle(
        resolveStaleOpportunityThreshold(questionText).label,
      );
    }

    if (this.isExpectedSignWithoutQuoteQuestion(questionText)) {
      return '预计签约未报价商机分析';
    }

    return '高风险商机观察';
  }

  /**
   * 解析风险类任务的明细表标题。
   *
   * 参数说明：`questionText` 为原问题，`taskConfig/compiledTask` 为当前执行上下文。
   * 返回值说明：返回带具体风险口径的明细标题。
   */
  private resolveRiskAwareDetailTitle(
    questionText: string,
    taskConfig: StandardApiTaskConfig,
    compiledTask: RoutedCompiledQueryTask,
  ): string {
    if (taskConfig.resource !== 'opportunities' || compiledTask.resultKind !== 'risk-overview') {
      return `${compiledTask.taskTitle}明细`;
    }

    if (isStaleOpportunityQuestionText(questionText)) {
      return buildStaleOpportunityDetailTitle(
        resolveStaleOpportunityThreshold(questionText).label,
      );
    }

    if (this.isExpectedSignWithoutQuoteQuestion(questionText)) {
      return '预计签约未报价商机明细';
    }

    return '高风险商机明细';
  }

  /**
   * 构建统一分析结果。
   *
   * 参数说明：`taskConfig` 为资源配置，`compiledTask` 为当前任务，`scopeSummary` 为权限摘要，`records` 为过滤后记录，`dictionaries` 为远端字典。
   * 返回值说明：返回摘要、过滤标签、指标卡、图表和明细表。
   * 调用注意事项：所有用户可见文案都使用中文业务语义，不直接展示内部资源名作为主要文案。
   */
  private buildTaskResult(
    questionText: string,
    taskConfig: StandardApiTaskConfig,
    compiledTask: RoutedCompiledQueryTask,
    scopeSummary: string,
    records: StandardApiRecord[],
    dictionaries: LianruanCrmOpenApiDictionaries,
    partnerNameMap: Map<string, string>,
    emptyResultHint?: string,
    openApiListAggregationNote?: string,
  ): StandardApiTaskResult {
    const rows = this.aggregateRows(
      questionText,
      taskConfig,
      compiledTask,
      records,
      dictionaries,
      partnerNameMap,
    );
    const totalAmount = rows.reduce((sum, item) => sum + item.amount, 0);
    const totalCount = rows.reduce((sum, item) => sum + item.count, 0);
    const staleThreshold = resolveStaleOpportunityThreshold(questionText);
    const isStaleOpportunityRisk =
      taskConfig.resource === 'opportunities' &&
      compiledTask.resultKind === 'risk-overview' &&
      isStaleOpportunityQuestionText(questionText);
    const isExpectedSignWithoutQuoteRisk =
      taskConfig.resource === 'opportunities' &&
      compiledTask.resultKind === 'risk-overview' &&
      this.isExpectedSignWithoutQuoteQuestion(questionText);
    const displayTaskTitle = this.resolveRiskAwareTaskTitle(
      questionText,
      taskConfig,
      compiledTask,
    );
    const detailTitle = this.resolveRiskAwareDetailTitle(
      questionText,
      taskConfig,
      compiledTask,
    );
    const sourceLabel = this.openApiMarkdownSnapshotService
      ? 'CRM 已同步真实明细数据'
      : '联软标准 OpenAPI';
    const emptyScopeLabel = this.openApiMarkdownSnapshotService
      ? '当前授权 CRM 数据范围'
      : '标准 OpenAPI 授权范围';

    const baseSummary =
      rows.length > 0
        ? isStaleOpportunityRisk
          ? `已基于${sourceLabel}完成${displayTaskTitle}，命中 ${totalCount} 条商机${staleThreshold.label}未更新。风险口径：${buildStaleOpportunityRiskScopeText(staleThreshold.days)}。`
          : isExpectedSignWithoutQuoteRisk
            ? `已基于${sourceLabel}完成${displayTaskTitle}，命中 ${totalCount} 条预计 30 天内签约但未检测到报价关联的商机。`
            : `已基于${sourceLabel}完成 ${displayTaskTitle}，命中 ${totalCount} 条${taskConfig.subjectLabel}并聚合为 ${rows.length} 个结果分组。`
        : emptyResultHint ??
          (isStaleOpportunityRisk
            ? `当前任务在${emptyScopeLabel}内未命中${staleThreshold.label}未更新的商机。`
            : isExpectedSignWithoutQuoteRisk
              ? `当前任务在${emptyScopeLabel}内未命中预计 30 天内签约但未检测到报价关联的商机。`
            : `当前任务在${emptyScopeLabel}内未命中${taskConfig.subjectLabel}数据。`);

    return {
      summary: openApiListAggregationNote
        ? `${openApiListAggregationNote} ${baseSummary}`
        : baseSummary,
      appliedFilters: this.buildAppliedFilters(
        taskConfig,
        compiledTask,
        scopeSummary,
        records,
        questionText,
        openApiListAggregationNote,
      ),
      metricCards: this.buildMetricCards(taskConfig, compiledTask, totalAmount, totalCount, rows.length),
      primaryView: isStaleOpportunityRisk || isExpectedSignWithoutQuoteRisk
        ? this.buildRiskDetailPrimaryView(rows, detailTitle)
        : this.buildPrimaryView(compiledTask, rows),
      secondaryViews: rows.length
        ? [
            {
              viewType: 'RANKING_TABLE',
              title: isStaleOpportunityRisk || isExpectedSignWithoutQuoteRisk
                ? detailTitle
                : `${displayTaskTitle}明细`,
              rows,
            },
          ]
        : [],
      tableRows: rows,
    };
  }

  /**
   * 按结果类型聚合标准 API 记录。
   *
   * 参数说明：`taskConfig` 决定对象语义，`compiledTask` 决定聚合形态，`records` 是过滤后记录，`dictionaries` 用于中文翻译。
   * 返回值说明：返回图表和表格均可复用的聚合行。
   * 调用注意事项：聚合只读取标准 API 字段，不依赖联软 SQLite 表结构。
   */
  private aggregateRows(
    questionText: string,
    taskConfig: StandardApiTaskConfig,
    compiledTask: RoutedCompiledQueryTask,
    records: StandardApiRecord[],
    dictionaries: LianruanCrmOpenApiDictionaries,
    partnerNameMap: Map<string, string>,
  ): StandardApiAggregateRow[] {
    if (
      taskConfig.resource === 'opportunities' &&
      compiledTask.resultKind === 'risk-overview' &&
      isStaleOpportunityQuestionText(questionText)
    ) {
      return this.buildStaleOpportunityRows(taskConfig, records);
    }

    if (
      taskConfig.resource === 'opportunities' &&
      compiledTask.resultKind === 'risk-overview' &&
      this.isExpectedSignWithoutQuoteQuestion(questionText)
    ) {
      return this.buildExpectedSignWithoutQuoteRows(taskConfig, records);
    }

    if (
      taskConfig.resource === 'quotes' &&
      this.isQuoteOrderRuleScoreQuestion(questionText)
    ) {
      return this.buildQuoteOrderRuleScoreRows(taskConfig, records);
    }

    if (compiledTask.resultKind === 'metric-summary') {
      return this.aggregateSummaryRows(taskConfig, records);
    }

    if (compiledTask.resultKind === 'time-trend') {
      return this.aggregateTimeTrendRows(taskConfig, records);
    }

    if (
      compiledTask.resultKind === 'stage-distribution' ||
      compiledTask.resultKind === 'category-distribution'
    ) {
      return this.aggregateCategoryRows(taskConfig, records, dictionaries);
    }

    if (compiledTask.resultKind === 'department-contribution') {
      return this.aggregateRegionRows(taskConfig, records);
    }

    if (compiledTask.resultKind === 'partner-contribution') {
      return this.aggregatePartnerRows(taskConfig, records, partnerNameMap);
    }

    return this.aggregateOwnerRows(taskConfig, records);
  }

  /**
   * 汇总全量指标行。
   *
   * 参数说明：`taskConfig` 为对象语义配置，`records` 为待汇总记录。
   * 返回值说明：返回单行总览数据。
   * 调用注意事项：无数据时返回空数组，让页面展示空状态而不是 0 值误导。
   */
  private aggregateSummaryRows(
    taskConfig: StandardApiTaskConfig,
    records: StandardApiRecord[],
  ): StandardApiAggregateRow[] {
    if (records.length === 0) {
      return [];
    }

    return [
      {
        ownerId: `${taskConfig.resource}-summary`,
        ownerName: `${taskConfig.subjectLabel}总览`,
        amount: records.reduce((sum, item) => sum + this.resolveAmount(taskConfig, item), 0),
        count: records.length,
        bucket_label: '总览',
      },
    ];
  }

  /**
   * 按负责人聚合记录。
   *
   * 参数说明：`records` 为待聚合记录。
   * 返回值说明：按金额倒序返回负责人分组，金额缺失时按数量排序。
   * 调用注意事项：负责人字段缺失时统一落到“未分配负责人”，避免页面空白。
   */
  private aggregateOwnerRows(
    taskConfig: StandardApiTaskConfig,
    records: StandardApiRecord[],
  ): StandardApiAggregateRow[] {
    const rankingMap = new Map<string, StandardApiAggregateRow>();

    for (const record of records) {
      const ownerId = this.resolveOwnerId(record);
      const ownerName = this.resolveOwnerName(record, ownerId);
      const current = rankingMap.get(ownerId) ?? {
        ownerId,
        ownerName,
        amount: 0,
        count: 0,
      };

      current.amount += this.resolveAmount(taskConfig, record);
      current.count += 1;
      rankingMap.set(ownerId, current);
    }

    return [...rankingMap.values()].sort(
      (left, right) => right.amount - left.amount || right.count - left.count,
    );
  }

  /**
   * 构造 OpenAPI 兜底下的停滞商机明细行。
   *
   * 参数说明：`taskConfig` 为商机对象配置，`records` 为已按阈值和权限过滤后的记录。
   * 返回值说明：返回带商机名称、客户、服务商、负责人、阶段、金额和未更新天数的明细行。
   * 调用注意事项：该路径只作为分析库不可用时的兜底，仍然只读取标准 OpenAPI 返回字段。
   */
  private buildStaleOpportunityRows(
    taskConfig: StandardApiTaskConfig,
    records: StandardApiRecord[],
  ): StandardApiAggregateRow[] {
    return records
      .map((record) => {
        const opportunityId = this.resolveOpportunityId(record);
        const opportunityName =
          this.readText(record.name ?? record.opportunityName ?? record.title) ||
          opportunityId ||
          '未命名商机';
        const ownerId = this.resolveOwnerId(record);
        const ownerName = this.resolveOwnerName(record, ownerId);
        const partnerId = this.resolvePartnerId(record);
        const sourceUpdatedAt = this.resolveProgressUpdatedAt(record);
        const staleDays = this.resolveStaleDays(record);
        return {
          ownerId: opportunityId || ownerId || opportunityName,
          ownerName: opportunityName,
          amount: this.resolveAmount(taskConfig, record),
          count: 1,
          bucket_label: opportunityName,
          opportunityId,
          opportunityName,
          customerName: this.readText(record.customerName ?? record.customer) || undefined,
          partnerId,
          partnerName: this.readText(record.partnerName) || undefined,
          ownerUserId: ownerId,
          salesOwnerName: ownerName,
          stageName:
            formatOpportunityStageLabel(
              this.readText(record.stageName ?? record.stage ?? record.statusName ?? record.status),
            ) || undefined,
          region: this.readText(record.region ?? record.bigRegion) || undefined,
          sourceUpdatedAt,
          stale_days: staleDays,
        };
      })
      .sort(
        (left, right) =>
          Number(right.stale_days ?? 0) - Number(left.stale_days ?? 0) ||
          right.amount - left.amount,
      );
  }

  /**
   * 构造预计签约但未报价商机明细行。
   *
   * 参数说明：`taskConfig` 为商机对象配置，`records` 为已按预计签约和未报价过滤后的记录。
   * 返回值说明：返回商机、客户、渠道商、负责人、预计签约日、金额和风险原因。
   * 调用注意事项：只读取商机自身字段，不跨接口猜测报价事实；缺少报价关联字段时按“未检测到报价关联”说明。
   */
  private buildExpectedSignWithoutQuoteRows(
    taskConfig: StandardApiTaskConfig,
    records: StandardApiRecord[],
  ): StandardApiAggregateRow[] {
    return records
      .map((record) => {
        const opportunityId = this.resolveOpportunityId(record);
        const opportunityName =
          this.readText(record.name ?? record.opportunityName ?? record.title) ||
          opportunityId ||
          '未命名商机';
        const ownerId = this.resolveOwnerId(record);
        const ownerName = this.resolveOwnerName(record, ownerId);
        const partnerId = this.resolvePartnerId(record);
        const expectedSignDate = this.resolveExpectedSignDate(record);
        return {
          ownerId: opportunityId || ownerId || opportunityName,
          ownerName: opportunityName,
          amount: this.resolveAmount(taskConfig, record),
          count: 1,
          bucket_label: opportunityName,
          opportunityId,
          opportunityName,
          customerName: this.readText(record.customerName ?? record.customer) || undefined,
          partnerId,
          partnerName: this.readText(record.partnerName ?? record.assignedPartnerName) || undefined,
          ownerUserId: ownerId,
          salesOwnerName: ownerName,
          stageName:
            formatOpportunityStageLabel(
              this.readText(record.stageName ?? record.stage ?? record.statusName ?? record.status),
            ) || undefined,
          expectedSignDate,
          riskReason: expectedSignDate
            ? '预计 30 天内签约，但当前快照未检测到报价关联'
            : '缺少预计签约日期，且当前快照未检测到报价关联',
          region: this.readText(record.region ?? record.bigRegion) || undefined,
        };
      })
      .sort((left, right) => right.amount - left.amount);
  }

  /**
   * 构造报价转订单规则评分行。
   *
   * 参数说明：`taskConfig` 为报价对象配置，`records` 为报价快照记录。
   * 返回值说明：返回带规则评分、金额、客户、渠道商和建议动作的报价清单。
   * 调用注意事项：这是无训练模型时的 P0 兜底评分，不声称机器学习预测。
   */
  private buildQuoteOrderRuleScoreRows(
    taskConfig: StandardApiTaskConfig,
    records: StandardApiRecord[],
  ): StandardApiAggregateRow[] {
    return records
      .map((record) => {
        const quoteId = this.readText(record.quoteId ?? record.id ?? record.quoteNo);
        const quoteName = this.readText(record.quoteName ?? record.name ?? record.quoteNo) || quoteId || '未命名报价';
        const amount = this.resolveAmount(taskConfig, record);
        const score = this.calculateQuoteOrderRuleScore(record, amount);
        return {
          ownerId: quoteId || quoteName,
          ownerName: quoteName,
          amount,
          count: 1,
          bucket_label: quoteName,
          quoteId,
          quoteNo: this.readText(record.quoteNo) || undefined,
          quoteName,
          customerName: this.readText(record.customerName ?? record.customer) || undefined,
          opportunityName: this.readText(record.opportunityName) || undefined,
          partnerName: this.readText(record.partnerName ?? record.assignedPartnerName) || undefined,
          ownerUserId: this.resolveOwnerId(record),
          salesOwnerName: this.resolveOwnerName(record, this.resolveOwnerId(record)),
          statusName: this.readText(record.statusName ?? record.status) || '未填写状态',
          ruleScore: score,
          ruleScoreLabel: `${score} 分`,
          amountText: formatWanAmount(amount),
          suggestedAction: score >= 80
            ? '本周优先催单并确认订单归属'
            : score >= 60
              ? '补齐决策人、交付和价格确认信息'
              : '先复核报价有效性和商机阶段',
        };
      })
      .filter((row) => row.ruleScore >= 50)
      .sort((left, right) =>
        Number(right.ruleScore ?? 0) - Number(left.ruleScore ?? 0) ||
        right.amount - left.amount,
      );
  }

  /**
   * 构造风险明细主视图。
   *
   * 参数说明：`rows` 为风险明细行，`title` 为已带口径的明细标题。
   * 返回值说明：返回明细表视图；无数据时返回 undefined。
   * 调用注意事项：明细型风险不再强行生成负责人金额柱图，避免图表和明细粒度不一致。
   */
  private buildRiskDetailPrimaryView(
    rows: StandardApiAggregateRow[],
    title: string,
  ): ResultView | undefined {
    if (rows.length === 0) {
      return undefined;
    }

    return {
      viewType: 'RANKING_TABLE',
      title,
      rows,
    };
  }

  /**
   * 按月份聚合记录。
   *
   * 参数说明：`records` 为待聚合记录。
   * 返回值说明：按 `YYYY-MM` 正序返回金额与数量。
   * 调用注意事项：时间字段优先 `createdAt`，缺失时回退 `updatedAt`。
   */
  private aggregateTimeTrendRows(
    taskConfig: StandardApiTaskConfig,
    records: StandardApiRecord[],
  ): StandardApiAggregateRow[] {
    const timeMap = new Map<string, StandardApiAggregateRow>();

    for (const record of records) {
      const bucketLabel = this.readRecordTime(record).slice(0, 7) || '未填写时间';
      const current = timeMap.get(bucketLabel) ?? {
        ownerId: bucketLabel,
        ownerName: bucketLabel,
        amount: 0,
        count: 0,
        bucket_label: bucketLabel,
        month_label: bucketLabel,
      };

      current.amount += this.resolveAmount(taskConfig, record);
      current.count += 1;
      timeMap.set(bucketLabel, current);
    }

    return [...timeMap.values()].sort((left, right) =>
      String(left.bucket_label ?? '').localeCompare(String(right.bucket_label ?? '')),
    );
  }

  /**
   * 按状态、阶段或渠道等级聚合记录。
   *
   * 参数说明：`taskConfig` 为对象配置，`records` 为待聚合记录，`dictionaries` 为标准 API 字典。
   * 返回值说明：返回中文化后的分类分布。
   * 调用注意事项：优先使用联软字典中文，字典缺失时使用本地常见编码意译，避免英文编码直接出现在企微报告。
   */
  private aggregateCategoryRows(
    taskConfig: StandardApiTaskConfig,
    records: StandardApiRecord[],
    dictionaries: LianruanCrmOpenApiDictionaries,
  ): StandardApiAggregateRow[] {
    const dictionaryItems = this.resolveDictionaryItems(taskConfig, dictionaries);
    const labelMap = new Map(dictionaryItems.map((item) => [item.value, item.label]));
    const categoryMap = new Map<string, StandardApiAggregateRow>();

    for (const record of records) {
      const categoryValue = this.resolveCategoryValue(taskConfig.resource, record);
      const resolvedCategoryLabel =
        taskConfig.resource === 'opportunities'
          ? labelMap.get(categoryValue) || formatOpportunityStageLabel(categoryValue)
          : this.resolveBusinessLabel(categoryValue, labelMap);
      const categoryLabel = resolvedCategoryLabel || '未填写分类';
      const current = categoryMap.get(categoryValue) ?? {
        ownerId: categoryValue || 'unknown-category',
        ownerName: categoryLabel,
        amount: 0,
        count: 0,
        bucket_label: categoryLabel,
        stage: categoryLabel,
      };

      current.amount += this.resolveAmount(taskConfig, record);
      current.count += 1;
      categoryMap.set(categoryValue, current);
    }

    return [...categoryMap.values()].sort(
      (left, right) => right.amount - left.amount || right.count - left.count,
    );
  }

  /**
   * 按区域聚合记录。
   *
   * 参数说明：`records` 为待聚合记录。
   * 返回值说明：按金额倒序返回区域贡献行。
   * 调用注意事项：联软标准 API 当前未提供我方 `departments` 表，因此区域主题先按 `region/bigRegion` 口径承接。
   */
  private aggregateRegionRows(
    taskConfig: StandardApiTaskConfig,
    records: StandardApiRecord[],
  ): StandardApiAggregateRow[] {
    const regionMap = new Map<string, StandardApiAggregateRow>();

    for (const record of records) {
      const region = this.readText(record.region ?? record.bigRegion) || '未填写区域';
      const current = regionMap.get(region) ?? {
        ownerId: region,
        ownerName: region,
        amount: 0,
        count: 0,
        bucket_label: region,
        region,
      };

      current.amount += this.resolveAmount(taskConfig, record);
      current.count += 1;
      regionMap.set(region, current);
    }

    return [...regionMap.values()].sort(
      (left, right) => right.amount - left.amount || right.count - left.count,
    );
  }

  /**
   * 按渠道商聚合商机记录。
   *
   * 参数说明：`records` 为商机标准 API 记录，`partnerNameMap` 为 `/partners` 补齐的渠道名称映射。
   * 返回值说明：按商机金额倒序返回渠道商分组，金额相同时按商机数量排序。
   * 调用注意事项：渠道字段缺失时统一落到“未填写渠道商”，避免把空字段误展示成负责人。
   */
  private aggregatePartnerRows(
    taskConfig: StandardApiTaskConfig,
    records: StandardApiRecord[],
    partnerNameMap: Map<string, string>,
  ): StandardApiAggregateRow[] {
    const partnerMap = new Map<string, StandardApiAggregateRow>();

    for (const record of records) {
      const partnerId = this.resolvePartnerId(record);
      const partnerName = this.resolvePartnerName(record, partnerId, partnerNameMap);
      const current = partnerMap.get(partnerId) ?? {
        ownerId: partnerId,
        ownerName: partnerName,
        amount: 0,
        count: 0,
        bucket_label: partnerName,
        partnerId,
        partnerName,
        region: this.readText(record.region ?? record.bigRegion) || undefined,
      };

      current.amount += this.resolveAmount(taskConfig, record);
      current.count += 1;
      partnerMap.set(partnerId, current);
    }

    return [...partnerMap.values()].sort(
      (left, right) => right.amount - left.amount || right.count - left.count,
    );
  }

  /**
   * 构建过滤标签。
   *
   * 参数说明：`taskConfig` 为对象配置，`compiledTask` 为当前任务，`scopeSummary` 为权限摘要，`records` 为过滤后记录。
   * 返回值说明：返回页面可直接展示的中文过滤标签。
   * 调用注意事项：标签只说明口径，不参与权限放行。
   */
  private buildAppliedFilters(
    taskConfig: StandardApiTaskConfig,
    compiledTask: RoutedCompiledQueryTask,
    scopeSummary: string,
    records: StandardApiRecord[],
    questionText = '',
    openApiListAggregationNote?: string,
  ): AppliedFilter[] {
    const staleThreshold = resolveStaleOpportunityThreshold(questionText);
    const isStaleOpportunityRisk =
      taskConfig.resource === 'opportunities' &&
      compiledTask.resultKind === 'risk-overview' &&
      isStaleOpportunityQuestionText(questionText);
    const isExpectedSignWithoutQuoteRisk =
      taskConfig.resource === 'opportunities' &&
      compiledTask.resultKind === 'risk-overview' &&
      this.isExpectedSignWithoutQuoteQuestion(questionText);
    const filters: AppliedFilter[] = [
      {
        label: '分析对象',
        value: taskConfig.subjectLabel,
      },
      {
        label: '时间口径',
        value: this.resolveTemporalFilterLabel(compiledTask),
      },
      {
        label: '数据来源',
        value: this.openApiMarkdownSnapshotService ? 'CRM 已同步真实明细数据' : '联软标准 OpenAPI',
      },
      {
        label: '权限范围',
        value: scopeSummary,
      },
    ];

    const regionSet = Array.from(
      new Set(records.map((item) => this.resolveDisplayRecordRegion(item)).filter(Boolean)),
    );
    if (regionSet.length === 1) {
      filters.push({
        label: '区域',
        value: regionSet[0],
      });
    } else {
      const requestedRegionLabel = this.resolveRequestedRegionLabel(questionText, records);
      if (requestedRegionLabel) {
        filters.push({
          label: '区域',
          value: requestedRegionLabel,
        });
      }
    }

    if (isStaleOpportunityRisk) {
      filters.push({
        label: '风险口径',
        value: buildStaleOpportunityRiskScopeText(staleThreshold.days),
      });
      filters.push({
        label: '排序口径',
        value: buildStaleOpportunitySortScopeText(),
      });
    } else if (isExpectedSignWithoutQuoteRisk) {
      filters.push({
        label: '风险口径',
        value: '预计签约日期在未来 30 天内，且当前快照未检测到报价关联；同时排除审批中、输单、赢单、取消等无效商机',
      });
      filters.push({
        label: '排序口径',
        value: '按商机金额倒序',
      });
    } else if (taskConfig.resource === 'opportunities' && compiledTask.resultKind === 'risk-overview') {
      filters.push({
        label: '风险口径',
        value: '商机阶段为初访、方案、谈判等推进中阶段；该口径不是“未更新商机”口径',
      });
      filters.push({
        label: '排序口径',
        value: '按风险商机金额倒序，金额相同按商机数量倒序',
      });
    }

    if (openApiListAggregationNote) {
      filters.push({
        label: '聚合口径',
        value: openApiListAggregationNote,
      });
    }

    return filters;
  }

  /**
   * 构建指标卡。
   *
   * 参数说明：`taskConfig` 为对象配置，`compiledTask` 为当前任务，`totalAmount/totalCount/rowLength` 为聚合结果。
   * 返回值说明：返回页面指标卡数组。
   * 调用注意事项：只有存在有效金额时展示金额卡，避免报备、渠道等无金额对象出现无意义 0 元。
   */
  private buildMetricCards(
    taskConfig: StandardApiTaskConfig,
    compiledTask: RoutedCompiledQueryTask,
    totalAmount: number,
    totalCount: number,
    rowLength: number,
  ): MetricCard[] {
    const metrics: MetricCard[] = [
      { name: taskConfig.countMetricLabel, value: totalCount },
      { name: '分组数量', value: rowLength },
    ];

    if (totalAmount > 0) {
      metrics.unshift({
        name:
          compiledTask.resultKind === 'risk-overview'
            ? '风险商机金额'
            : taskConfig.amountMetricLabel,
        value: formatWanAmount(totalAmount),
      });
    }

    if (compiledTask.resultKind === 'risk-overview') {
      metrics[metrics.length - 2] = {
        name: '风险商机数',
        value: totalCount,
      };
    }

    return metrics;
  }

  /**
   * 构建主视图。
   *
   * 参数说明：`compiledTask` 为当前任务，`rows` 为聚合行。
   * 返回值说明：根据结果类型返回折线图、饼图或柱状图。
   * 调用注意事项：无数据时返回 `undefined`，由页面走空态展示。
   */
  private buildPrimaryView(
    compiledTask: RoutedCompiledQueryTask,
    rows: StandardApiAggregateRow[],
  ): ResultView | undefined {
    if (rows.length === 0) {
      return undefined;
    }

    const viewType =
      compiledTask.resultKind === 'time-trend'
        ? 'LINE_CHART'
        : compiledTask.resultKind === 'category-distribution' ||
            compiledTask.resultKind === 'stage-distribution'
          ? 'PIE_CHART'
          : 'BAR_CHART';

    return {
      viewType,
      title: compiledTask.taskTitle,
      series: rows.map((item) => ({
        label:
          (compiledTask.resultKind === 'time-trend' ? item.month_label : undefined) ||
          item.bucket_label ||
          item.ownerName ||
          '未命名分组',
        value: item.amount || item.count,
      })),
    };
  }

  /**
   * 生成标准 API 执行摘要。
   *
   * 参数说明：`compiledTask` 为当前任务，`taskConfig` 为资源配置。
   * 返回值说明：返回用于执行追踪的伪查询文本。
   * 调用注意事项：摘要不包含 appSecret、token、密码等敏感信息。
   */
  buildApiExecutionSummary(
    compiledTask: RoutedCompiledQueryTask,
    taskConfig?: StandardApiTaskConfig,
    openApiListAggregationNote?: string,
  ): string {
    const startAt =
      typeof compiledTask.plan.filters.startAt === 'string'
        ? compiledTask.plan.filters.startAt
        : '';
    const endAt =
      typeof compiledTask.plan.filters.endAt === 'string'
        ? compiledTask.plan.filters.endAt
        : '';
    const resource = taskConfig?.resource ?? 'opportunities';

    if (this.openApiMarkdownSnapshotService) {
      return [
        '-- 本地 OpenAPI Markdown 快照分析',
        `-- READ backend/analysis-snapshot/latest/details/${resource}.md`,
        `-- adapter: openapi-markdown-snapshot.${resource}`,
        `-- resultKind: ${compiledTask.resultKind}`,
        `-- createdAfter: ${startAt || '未限制'}`,
        `-- createdBefore: ${endAt || '未限制'}`,
        '-- 用途：正式分析只读 Markdown 快照；OpenAPI 仅用于刷新快照文件。',
      ].join('\n');
    }

    return [
      `-- 联软标准 OpenAPI /${resource}`,
      `-- adapter: ${compiledTask.matchedAdapter || `crm-official-api.${resource}`}`,
      `-- resultKind: ${compiledTask.resultKind}`,
      `-- createdAfter: ${startAt || '未限制'}`,
      `-- createdBefore: ${endAt || '未限制'}`,
      ...(openApiListAggregationNote ? [`-- 同源列表聚合复核：${openApiListAggregationNote}`] : []),
    ].join('\n');
  }

  /**
   * 生成渠道贡献统计接口执行摘要。
   *
   * 参数说明：`compiledTask` 为当前任务，`query` 为已下推的统计筛选参数。
   * 返回值说明：返回用于审计和页面追踪的伪查询文本。
   * 调用注意事项：只记录筛选口径，不记录 token、密钥等敏感信息。
   */
  private buildPartnerContributionExecutionSummary(
    compiledTask: RoutedCompiledQueryTask,
    query: LianruanCrmOpenApiAnalyticsQuery,
  ): string {
    return [
      '-- 联软标准 OpenAPI /analytics/partners/contribution',
      `-- adapter: ${compiledTask.matchedAdapter || 'crm-official-api.opportunity-partner-contribution'}`,
      `-- resultKind: ${compiledTask.resultKind}`,
      `-- createdAfter: ${query.createdAfter || '未限制'}`,
      `-- createdBefore: ${query.createdBefore || '未限制'}`,
      `-- region: ${query.region || '未限制'}`,
      `-- bigRegion: ${query.bigRegion || '未限制'}`,
    ].join('\n');
  }

  /**
   * 生成客户生命周期统计接口执行摘要。
   *
   * 参数说明：`compiledTask` 为当前任务，`query` 为统计筛选参数。
   * 返回值说明：返回用于审计和页面追踪的伪查询文本。
   * 调用注意事项：摘要不包含 token、密钥或客户敏感联系方式。
   */
  private buildCustomerLifecycleExecutionSummary(
    compiledTask: RoutedCompiledQueryTask,
    query: LianruanCrmOpenApiAnalyticsQuery,
  ): string {
    return [
      '-- 联软标准 OpenAPI /analytics/customers/unregistered-opportunity',
      '-- 联软标准 OpenAPI /analytics/customers/lifecycle',
      `-- adapter: ${compiledTask.matchedAdapter || 'crm-official-api.customer-lifecycle-analytics'}`,
      `-- resultKind: ${compiledTask.resultKind}`,
      `-- createdAfter: ${query.createdAfter || '未限制'}`,
      `-- createdBefore: ${query.createdBefore || '未限制'}`,
      `-- region: ${query.region || '未限制'}`,
      `-- bigRegion: ${query.bigRegion || '未限制'}`,
    ].join('\n');
  }

  /**
   * 生成服务商画像统计接口执行摘要。
   *
   * 参数说明：`compiledTask` 为画像任务，`query` 为统计筛选参数。
   * 返回值说明：返回用于审计和页面追踪的伪查询文本。
   * 调用注意事项：摘要只记录口径，不记录任何 token 或密钥。
   */
  private buildPartnerProfileExecutionSummary(
    compiledTask: RoutedCompiledQueryTask,
    query: LianruanCrmOpenApiAnalyticsQuery,
  ): string {
    return [
      '-- 联软标准 OpenAPI /analytics/partners/profile',
      `-- adapter: ${compiledTask.matchedAdapter || 'crm-official-api.partner-profile-analytics'}`,
      `-- resultKind: ${compiledTask.resultKind}`,
      `-- createdAfter: ${query.createdAfter || '未限制'}`,
      `-- createdBefore: ${query.createdBefore || '未限制'}`,
      `-- region: ${query.region || '未限制'}`,
      `-- bigRegion: ${query.bigRegion || '未限制'}`,
      `-- isTechnicalServiceProvider: ${query.isTechnicalServiceProvider ?? '未限制'}`,
    ].join('\n');
  }

  /**
   * 收集负责人候选字段。
   *
   * 参数说明：`record` 为标准 API 记录。
   * 返回值说明：返回去重后的负责人 ID 列表。
   * 调用注意事项：只做候选收集，不把空值写入结果。
   */
  private collectOwnerCandidates(record: StandardApiRecord): string[] {
    return Array.from(
      new Set(
        [
          record.assignedStaffId,
          record.ownerId,
          record.createdBy,
          record.userId,
          record.salesId,
        ]
          .map((item) => this.readText(item))
          .filter(Boolean),
      ),
    );
  }

  /**
   * 收集组织候选字段。
   *
   * 参数说明：`record` 为标准 API 记录。
   * 返回值说明：返回去重后的组织 ID 或组织口径候选值。
   * 调用注意事项：仅供服务账号本地权限裁剪使用，候选不命中时不会放行记录。
   */
  private collectOrganizationCandidates(record: StandardApiRecord): string[] {
    return Array.from(
      new Set(
        [
          ...this.normalizeStringList(record.organizationIds),
          record.organizationId,
          record.orgId,
          record.crmOrganizationId,
          record.bigRegion,
        ]
          .map((item) => this.readText(item))
          .filter(Boolean),
      ),
    );
  }

  /**
   * 收集部门候选字段。
   *
   * 参数说明：`record` 为标准 API 记录。
   * 返回值说明：返回去重后的部门 ID 或区域口径候选值。
   * 调用注意事项：联软若暂未提供部门字段，会自然无法命中并由本地裁剪保守排除。
   */
  private collectDepartmentCandidates(record: StandardApiRecord): string[] {
    return Array.from(
      new Set(
        [
          ...this.normalizeStringList(record.departmentIds),
          record.departmentId,
          record.deptId,
          record.crmDepartmentId,
          record.region,
        ]
          .map((item) => this.readText(item))
          .filter(Boolean),
      ),
    );
  }

  /**
   * 读取最终负责人 ID。
   *
   * 参数说明：`record` 为标准 API 记录。
   * 返回值说明：返回稳定负责人 ID，缺失时返回 `unassigned`。
   * 调用注意事项：该值作为分组键，不应为空。
   */
  private resolveOwnerId(record: StandardApiRecord): string {
    return this.collectOwnerCandidates(record)[0] ?? 'unassigned';
  }

  /**
   * 读取负责人名称。
   *
   * 参数说明：`record` 为标准 API 记录，`fallbackOwnerId` 为兜底 ID。
   * 返回值说明：返回页面展示名称。
   * 调用注意事项：名称缺失时用 ID 兜底，避免显示空白。
   */
  private resolveOwnerName(
    record: StandardApiRecord,
    fallbackOwnerId: string,
  ): string {
    return (
      this.readText(
        record.assignedStaffName ??
          record.ownerName ??
          record.createdByName ??
          record.salesName ??
          record.assignedStaffId ??
          record.ownerId,
      ) || (fallbackOwnerId === 'unassigned' ? '未分配负责人' : fallbackOwnerId)
    );
  }

  /**
   * 读取商机 ID。
   *
   * 参数说明：`record` 为标准 API 商机记录。
   * 返回值说明：返回可用于明细去重和展示的商机 ID；缺失时返回空字符串。
   * 调用注意事项：只读取标准接口可能返回的业务编号，不生成新的可执行 ID。
   */
  private resolveOpportunityId(record: StandardApiRecord): string {
    return this.readText(
      record.id ??
        record.opportunityId ??
        record.opportunity_id ??
        record.opportunityNo ??
        record.opportunity_no ??
        record.businessNo ??
        record.business_no ??
        record.code ??
        record.no,
    );
  }

  /**
   * 读取商机进展更新时间。
   *
   * 参数说明：`record` 为标准 API 商机记录。
   * 返回值说明：返回 ISO 或原始日期字符串；缺失时返回空字符串。
   * 调用注意事项：优先使用跟进/进展更新时间，其次才回退标准更新时间，不能使用创建时间判断“无进展”。
   */
  private resolveProgressUpdatedAt(record: StandardApiRecord): string {
    return this.readText(
      record.sourceUpdatedAt ??
        record.source_updated_at ??
        record.latestFollowUpAt ??
        record.latest_follow_up_at ??
        record.lastProgressAt ??
        record.last_progress_at ??
        record.progressUpdatedAt ??
        record.progress_updated_at ??
        record.updatedAt ??
        record.updated_at ??
        record.updateTime,
    );
  }

  /**
   * 判断是否为“预计签约但未报价”风险问题。
   *
   * 参数说明：`questionText` 为用户原始问题。
   * 返回值说明：同时包含预计签约和未报价语义时返回 `true`。
   * 调用注意事项：只用于商机风险明细，不影响普通商机排行。
   */
  private isExpectedSignWithoutQuoteQuestion(questionText: string): boolean {
    return /(预计|预估|计划).{0,8}(签约|签单|成交).{0,16}(未报价|没有报价|还没有报价|无报价)|(未报价|没有报价|还没有报价|无报价).{0,16}(预计|预估|计划).{0,8}(签约|签单|成交)/u.test(
      questionText,
    );
  }

  /**
   * 判断是否为报价转订单规则评分问题。
   *
   * 参数说明：`questionText` 为用户原始问题。
   * 返回值说明：同时包含报价和转订单/成交倾向时返回 `true`。
   * 调用注意事项：该兜底只提供规则评分，不替代真实订单结果。
   */
  private isQuoteOrderRuleScoreQuestion(questionText: string): boolean {
    return /(报价|报价单).{0,16}(转订单|转成订单|转化为订单|成交|下单|签单|最可能)|(转订单|成交|下单|签单|最可能).{0,16}(报价|报价单)/u.test(
      questionText,
    );
  }

  /**
   * 判断商机是否已有报价关联。
   *
   * 参数说明：`record` 为商机快照记录。
   * 返回值说明：检测到报价编号、报价数量或报价状态时返回 `true`。
   * 调用注意事项：字段缺失时保守视为未检测到关联，并在风险原因中说明口径。
   */
  private hasLinkedQuote(record: StandardApiRecord): boolean {
    const quoteId = this.readText(
      record.quoteId ??
        record.quote_id ??
        record.quoteNo ??
        record.quote_no ??
        record.latestQuoteId ??
        record.latest_quote_id,
    );
    const quoteCount = this.resolveFiniteNumber(record.quoteCount ?? record.quote_count);
    const stageText = this.normalizeComparableText(record.stageName ?? record.stage ?? record.statusName ?? record.status);
    return Boolean(quoteId) || quoteCount > 0 || /报价|quoted/u.test(stageText);
  }

  /**
   * 读取预计签约日期。
   *
   * 参数说明：`record` 为商机或报价记录。
   * 返回值说明：返回原始日期文本；无法识别时返回空字符串。
   */
  private resolveExpectedSignDate(record: StandardApiRecord): string {
    return this.readText(
      record.expectedSignDate ??
        record.expected_sign_date ??
        record.expectedClose ??
        record.expected_close ??
        record.expectedDealDate ??
        record.expected_deal_date ??
        record.planSignDate ??
        record.plan_sign_date,
    );
  }

  /**
   * 判断预计签约日是否落在未来指定天数内。
   *
   * 参数说明：`record` 为商机记录，`days` 为未来窗口天数。
   * 返回值说明：日期可解析且处于今天到未来 N 天内时返回 `true`。
   * 调用注意事项：日期缺失不纳入“30 天内”风险清单，避免误报。
   */
  private isExpectedSignInDays(record: StandardApiRecord, days: number): boolean {
    const expectedSignDate = this.resolveExpectedSignDate(record);
    const timestamp = Date.parse(expectedSignDate);
    if (!Number.isFinite(timestamp)) {
      return false;
    }

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    return timestamp >= now - dayMs && timestamp <= now + days * dayMs;
  }

  /**
   * 计算报价转订单规则评分。
   *
   * 参数说明：`record` 为报价记录，`amount` 为报价金额。
   * 返回值说明：返回 0 到 100 的规则分，不代表机器学习概率。
   * 调用注意事项：评分只用于排序候选，真实成交仍以订单数据为准。
   */
  private calculateQuoteOrderRuleScore(record: StandardApiRecord, amount: number): number {
    let score = 35;
    if (amount >= 100000) {
      score += 20;
    } else if (amount > 0) {
      score += 10;
    }

    const statusText = this.normalizeComparableText(record.statusName ?? record.status);
    if (!/(已作废|作废|取消|失效|过期|已下单|已转订单|ordered|cancel|invalid|expired)/u.test(statusText)) {
      score += 15;
    }

    if (this.isExpectedSignInDays(record, 14)) {
      score += 15;
    }

    const updatedAt = this.readText(record.updatedAt ?? record.updateTime);
    const updatedTimestamp = Date.parse(updatedAt);
    if (Number.isFinite(updatedTimestamp)) {
      const dayMs = 24 * 60 * 60 * 1000;
      const updatedDays = Math.max(0, Math.floor((Date.now() - updatedTimestamp) / dayMs));
      if (updatedDays <= 7) {
        score += 10;
      }
    }

    if (this.readText(record.customerName ?? record.customer) && this.readText(record.opportunityName ?? record.opportunityId)) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 计算商机未更新天数。
   *
   * 参数说明：`record` 为标准 API 商机记录。
   * 返回值说明：能解析进展更新时间时返回距当前时间的整天数，否则返回 0。
   * 调用注意事项：无法解析日期时不纳入停滞商机，避免把脏数据误报为风险。
   */
  private resolveStaleDays(record: StandardApiRecord): number {
    const progressUpdatedAt = this.resolveProgressUpdatedAt(record);
    const timestamp = Date.parse(progressUpdatedAt);
    if (!Number.isFinite(timestamp)) {
      return 0;
    }

    const dayMs = 24 * 60 * 60 * 1000;
    return Math.max(0, Math.floor((Date.now() - timestamp) / dayMs));
  }

  /**
   * 读取商机归属渠道 ID。
   *
   * 参数说明：`record` 为标准 API 商机记录。
   * 返回值说明：优先返回稳定渠道 ID，字段缺失时用渠道名称兜底，否则归入未知渠道。
   * 调用注意事项：联软标准契约里商机列表可能只有 `partnerId/assignedPartnerId`，不强依赖本地 SQLite 字段。
   */
  private resolvePartnerId(record: StandardApiRecord): string {
    return (
      this.readText(
        record.partnerId ??
          record.assignedPartnerId ??
          record.channelId ??
          record.dealerId ??
          record.agentId,
      ) ||
      this.readText(
        record.partnerName ??
          record.assignedPartnerName ??
          record.channelName ??
          record.serviceProviderName ??
          record.dealerName ??
          record.agentName,
      ) ||
      'unknown-partner'
    );
  }

  /**
   * 读取商机归属渠道名称。
   *
   * 参数说明：
   * - `record` 为标准 API 商机记录；
   * - `partnerId` 为已解析出的渠道 ID；
   * - `partnerNameMap` 为渠道列表补齐映射。
   * 返回值说明：返回用户可读渠道名称，缺失时用 ID 或“未填写渠道商”兜底。
   */
  private resolvePartnerName(
    record: StandardApiRecord,
    partnerId: string,
    partnerNameMap: Map<string, string>,
  ): string {
    return (
      this.readText(
        record.partnerName ??
          record.assignedPartnerName ??
          record.channelName ??
          record.serviceProviderName ??
          record.dealerName ??
          record.agentName,
      ) ||
      partnerNameMap.get(partnerId) ||
      (partnerId === 'unknown-partner' ? '未填写渠道商' : partnerId)
    );
  }

  /**
   * 读取金额字段。
   *
   * 参数说明：`record` 为标准 API 记录。
   * 返回值说明：返回可解析金额，缺失或脏数据返回 `0`。
   * 调用注意事项：兼容报价、订单、商机不同命名，避免因字段别名差异中断首批联调。
   */
  private resolveAmount(
    taskConfig: StandardApiTaskConfig,
    record: StandardApiRecord,
  ): number {
    const rawAmount = this.resolveRawAmountByResource(taskConfig.resource, record);
    return this.parseNumericAmount(rawAmount);
  }

  /**
   * 按资源类型读取金额字段。
   *
   * 参数说明：`resource` 为当前分析对象，`record` 为标准 API 原始记录。
   * 返回值说明：返回当前对象自己的金额字段，不跨对象兜底，避免商机分析误读报价/订单金额。
   */
  private resolveRawAmountByResource(
    resource: LianruanCrmOpenApiResource,
    record: StandardApiRecord,
  ): unknown {
    if (resource === 'opportunities') {
      return (
        record.amount ??
        record.opportunityAmount ??
        record.opportunity_amount ??
        record.expectedAmount ??
        record.expectAmount ??
        record.estimatedAmt ??
        record.estimatedAmount
      );
    }

    if (resource === 'quotes') {
      return record.quoteAmount ?? record.quote_amount ?? record.amount ?? record.totalAmount;
    }

    if (resource === 'orders') {
      return (
        record.orderAmount ??
        record.order_amount ??
        record.amount ??
        record.totalAmount ??
        record.total
      );
    }

    if (resource === 'registrations') {
      return record.registrationAmount ?? record.registration_amount ?? record.amount ?? record.totalAmount;
    }

    if (resource === 'customers') {
      return record.customerAmount ?? record.customer_amount ?? record.amount ?? record.totalAmount;
    }

    if (resource === 'partners') {
      return record.partnerAmount ?? record.partner_amount ?? record.amount ?? record.totalAmount;
    }

    return record.amount ?? record.totalAmount;
  }

  /**
   * 读取服务商是否技术服务商。
   *
   * 参数说明：`record` 为服务商标准 API 记录。
   * 返回值说明：标准字段或历史别名能判断为真时返回 `true`，否则返回 `false`。
   * 调用注意事项：该函数只用于展示和统计兜底，不会把缺失字段反向写回远端。
   */
  private resolveTechnicalServiceProviderFlag(record: StandardApiRecord): boolean {
    const directValue = record.isTechnicalServiceProvider ?? record.isTechService;
    if (typeof directValue === 'boolean') {
      return directValue;
    }

    const directText = this.readText(directValue).toLowerCase();
    if (['true', '1', 'yes', '是', '技术服务商'].includes(directText)) {
      return true;
    }

    const serviceTypeText = this.readText(record.technicalServiceProviderType ?? record.techServiceType);
    if (serviceTypeText) {
      return !/^(none|false|0|否|非技术服务商)$/iu.test(serviceTypeText);
    }

    const partnerTypeText = this.readText(record.partnerTypeName ?? record.partnerType);
    return /技术服务商/u.test(partnerTypeText);
  }

  /**
   * 读取时间字段。
   *
   * 参数说明：`record` 为标准 API 记录。
   * 返回值说明：优先返回 `createdAt`，缺失时回退 `updatedAt`。
   * 调用注意事项：返回值用于字符串时间比较，应保持 ISO 或同序日期格式。
   */
  private readRecordTime(record: StandardApiRecord): string {
    return (
      this.readText(record.createdAt) ||
      this.readText(record.joinDate) ||
      this.readText(record.dealAt) ||
      this.readText(record.updatedAt)
    );
  }

  /**
   * 解析标准 API 金额数值。
   *
   * 参数说明：`value` 可能是数字、decimal 字符串或带千分位/货币符号的展示值。
   * 返回值说明：无法解析时返回 0。
   */
  private parseNumericAmount(value: unknown): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    if (typeof value !== 'string') {
      return 0;
    }

    const parsed = Number(
      value
        .replace(/万元/gu, '')
        .replace(/[,\s￥¥元]/gu, '')
        .trim(),
    );

    return Number.isFinite(parsed) ? parsed : 0;
  }

  /**
   * 读取分类字段。
   *
   * 参数说明：`resource` 为资源名，`record` 为标准 API 记录。
   * 返回值说明：返回状态、阶段、渠道等级或客户分类等分组值。
   * 调用注意事项：不同对象字段不同，此处集中兼容，避免聚合层散落字段判断。
   */
  private resolveCategoryValue(
    resource: LianruanCrmOpenApiResource,
    record: StandardApiRecord,
  ): string {
    if (resource === 'opportunities') {
      return this.readText(record.stageName ?? record.stage ?? record.status);
    }

    if (resource === 'partners') {
      return this.readText(record.partnerLevelName ?? record.partnerLevel ?? record.status);
    }

    return this.readText(record.status ?? record.category ?? record.type);
  }

  /**
   * 读取当前资源对应字典。
   *
   * 参数说明：`taskConfig` 为资源配置，`dictionaries` 为远端字典。
   * 返回值说明：返回字典项数组；缺失时返回空数组。
   * 调用注意事项：字典仅用于展示翻译，不影响数据过滤。
   */
  private resolveDictionaryItems(
    taskConfig: StandardApiTaskConfig,
    dictionaries: LianruanCrmOpenApiDictionaries,
  ): LianruanCrmOpenApiDictionaryItem[] {
    if (!taskConfig.dictionaryKey) {
      return [];
    }

    const dictionary = dictionaries[taskConfig.dictionaryKey];
    return Array.isArray(dictionary) ? dictionary : [];
  }

  /**
   * 从字典中识别用户问题里的区域或大区筛选值。
   *
   * 参数说明：`questionText` 为用户原问题，`dictionaries` 为远端字典，`dictionaryKey` 为 `regions/bigRegions`。
   * 返回值说明：命中时返回字典值，未命中返回 `undefined`。
   * 调用注意事项：只在用户问题明确包含区域词时下推，不凭空添加筛选条件。
   */
  private resolveDictionaryRegionFilter(
    questionText: string,
    dictionaries: LianruanCrmOpenApiDictionaries,
    dictionaryKey: 'regions' | 'bigRegions',
  ): string | undefined {
    const dictionary = dictionaries[dictionaryKey];
    if (!Array.isArray(dictionary)) {
      return undefined;
    }

    const normalizedQuestion = this.normalizeRegionToken(questionText);
    for (const item of dictionary) {
      const value = this.readText((item as LianruanCrmOpenApiDictionaryItem).value);
      const label = this.readText((item as LianruanCrmOpenApiDictionaryItem).label);
      const candidates = [value, label].filter(Boolean);
      if (
        candidates.some((candidate) =>
          this.buildRegionAliases(this.normalizeRegionToken(candidate)).some((alias) =>
            normalizedQuestion.includes(alias),
          ),
        )
      ) {
        return value || label;
      }
    }

    return undefined;
  }

  /**
   * 从问题文本和候选记录中解析明确点名的业务实体名称。
   *
   * 参数说明：`questionText` 为用户原问题，`records` 为当前资源候选明细。
   * 返回值说明：当问题完整包含客户、渠道商、商机、报价或订单名称时返回匹配约束。
   * 调用注意事项：只接受较长名称或公司名别名，避免把“山东”“北京”这类区域短词当实体。
   */
  private resolveQuestionEntityNameConstraint(
    questionText: string,
    records: StandardApiRecord[],
  ): QuestionEntityNameConstraint | undefined {
    const normalizedQuestion = this.normalizeComparableText(questionText);
    if (!normalizedQuestion || records.length === 0) {
      return undefined;
    }

    const matchedItems: Array<{
      label: string;
      aliases: Set<string>;
      matchedLength: number;
    }> = [];

    for (const record of records) {
      const aliases = new Set<string>();
      const displayLabel = this.collectRecordEntityNameCandidates(record)[0];
      for (const candidate of this.collectRecordEntityNameCandidates(record)) {
        for (const alias of this.buildEntityNameAliases(candidate)) {
          aliases.add(alias);
        }
      }

      const matchedLength = [...aliases].reduce((maxLength, alias) => {
        if (normalizedQuestion.includes(alias)) {
          return Math.max(maxLength, alias.length);
        }
        return maxLength;
      }, 0);

      if (displayLabel && matchedLength > 0) {
        matchedItems.push({
          label: displayLabel,
          aliases,
          matchedLength,
        });
      }
    }

    if (matchedItems.length === 0) {
      return undefined;
    }

    const longestLength = Math.max(...matchedItems.map((item) => item.matchedLength));
    const selectedItems = matchedItems.filter((item) => item.matchedLength === longestLength);
    const aliases = new Set<string>();
    const labels: string[] = [];
    for (const item of selectedItems) {
      if (!labels.includes(item.label)) {
        labels.push(item.label);
      }
      for (const alias of item.aliases) {
        aliases.add(alias);
      }
    }

    return {
      label: labels.slice(0, 3).join('、'),
      aliases,
    };
  }

  /**
   * 判断记录是否命中已解析出的业务实体名称。
   *
   * 参数说明：`record` 为候选业务明细，`constraint` 为问题中点名的实体约束。
   * 返回值说明：记录的客户、渠道商、商机、报价或订单名称与实体别名相交时返回 `true`。
   */
  private recordMatchesQuestionEntityName(
    record: StandardApiRecord,
    constraint: QuestionEntityNameConstraint,
  ): boolean {
    return this.collectRecordEntityNameCandidates(record)
      .flatMap((candidate) => this.buildEntityNameAliases(candidate))
      .some((alias) => constraint.aliases.has(alias));
  }

  /**
   * 收集一条记录中可被用户点名的业务实体名称。
   *
   * 参数说明：`record` 为任意 OpenAPI 快照记录。
   * 返回值说明：按渠道商、客户、商机、报价、订单、通用名称的优先级返回去重名称。
   */
  private collectRecordEntityNameCandidates(record: StandardApiRecord): string[] {
    return Array.from(
      new Set(
        [
          record.partnerName,
          record.assignedPartnerName,
          record.channelName,
          record.serviceProviderName,
          record.dealerName,
          record.agentName,
          record.customerName,
          record.customer,
          record.opportunityName,
          record.quoteName,
          record.orderName,
          record.name,
          record.title,
          record.displayName,
          record.shortName,
        ]
          .map((item) => this.readText(item))
          .filter(Boolean),
      ),
    );
  }

  /**
   * 构造业务实体名称别名。
   *
   * 参数说明：`value` 为客户、渠道商或商机等名称。
   * 返回值说明：返回规范化全称和去掉常见公司后缀后的别名。
   * 调用注意事项：别名最短 4 个字符，过滤纯区域和泛化业务词，防止误把区域问题当实体问题。
   */
  private buildEntityNameAliases(value: unknown): string[] {
    const normalizedName = this.normalizeComparableText(value)
      .replace(/[“”"'`]/gu, '');
    if (!normalizedName) {
      return [];
    }

    const aliases = new Set<string>([normalizedName]);
    const suffixes = [
      '有限责任公司',
      '股份有限公司',
      '信息技术有限公司',
      '科技有限公司',
      '技术有限公司',
      '有限公司',
      '分公司',
      '公司',
    ];
    for (const suffix of suffixes) {
      if (normalizedName.endsWith(suffix) && normalizedName.length > suffix.length) {
        aliases.add(normalizedName.slice(0, -suffix.length));
      }
    }

    const stopWords = new Set([
      '山东',
      '北京',
      '上海',
      '广州',
      '深圳',
      '渠道',
      '渠道商',
      '代理商',
      '服务商',
      '客户',
      '商机',
      '订单',
      '报价',
    ]);

    return [...aliases].filter((alias) => alias.length >= 4 && !stopWords.has(alias));
  }

  /**
   * 判断阶段是否属于风险观察口径。
   *
   * 参数说明：`stage` 为标准 API 阶段或状态值。
   * 返回值说明：命中风险阶段时返回 `true`。
   * 调用注意事项：当前仅用于商机首批联调，后续可按正式风险字典扩展。
   */
  private isRiskStage(stage: string): boolean {
    return RISK_STAGE_KEYS.has(stage);
  }

  /**
   * 根据问题文本匹配区域词。
   *
   * 参数说明：`questionText` 为用户问题，`records` 为候选记录。
   * 返回值说明：返回问题中明确命中的区域集合。
   * 调用注意事项：仅在命中时收窄，不因无法识别区域而阻断查询。
   */
  private matchRegionsFromQuestion(
    questionText: string,
    records: StandardApiRecord[],
    regionConstraint?: BusinessChainRegionConstraint,
  ): string[] {
    return this.resolveQuestionRegionTokens(questionText, records, regionConstraint);
  }

  /**
   * 解析业务链问题中的区域约束。
   *
   * 参数说明：`questionText` 为用户原问题，`dictionaries` 为联软标准 OpenAPI 字典。
   * 返回值说明：命中区域时返回可下推 OpenAPI 的区域/大区值和本地匹配 token。
   * 调用注意事项：仅当问题明确出现区域词时才返回，避免把用户权限范围误当作筛选条件。
   */
  private resolveBusinessChainRegionConstraint(
    questionText: string,
    dictionaries: LianruanCrmOpenApiDictionaries,
  ): BusinessChainRegionConstraint | undefined {
    const region = this.resolveDictionaryRegionFilter(questionText, dictionaries, 'regions');
    const bigRegion = this.resolveDictionaryRegionFilter(questionText, dictionaries, 'bigRegions');
    const tokens = this.resolveQuestionRegionTokens(questionText, [], {
      region,
      bigRegion,
      tokens: [],
      label: region || bigRegion,
    });

    if (!region && !bigRegion && tokens.length === 0) {
      return undefined;
    }

    return {
      region,
      bigRegion,
      tokens,
      label: region || bigRegion || tokens[0],
    };
  }

  /**
   * 从用户问题、已识别约束和候选记录中归并区域匹配 token。
   *
   * 参数说明：
   * - `questionText`：用户原问题；
   * - `records`：候选记录，用于兼容“山东区”“大北区-山东区”等实际写法；
   * - `regionConstraint`：字典识别出的区域/大区约束。
   * 返回值说明：返回标准化后的区域 token，含别名，供本地过滤使用。
   * 调用注意事项：token 只用于收窄记录，不写回原始数据。
   */
  private resolveQuestionRegionTokens(
    questionText: string,
    records: StandardApiRecord[],
    regionConstraint?: BusinessChainRegionConstraint,
  ): string[] {
    const normalizedQuestion = this.normalizeRegionToken(questionText);
    if (!normalizedQuestion) {
      return [];
    }

    const matchedRegions = new Set<string>();
    for (const token of regionConstraint?.tokens ?? []) {
      this.addRegionAliases(matchedRegions, token);
    }
    if (regionConstraint?.region) {
      this.addRegionAliases(matchedRegions, regionConstraint.region);
    }
    if (regionConstraint?.bigRegion) {
      this.addRegionAliases(matchedRegions, regionConstraint.bigRegion);
    }

    for (const keyword of COMMON_CHINA_REGION_KEYWORDS) {
      const normalizedKeyword = this.normalizeRegionToken(keyword);
      if (normalizedQuestion.includes(normalizedKeyword)) {
        this.addRegionAliases(matchedRegions, normalizedKeyword);
      }
    }

    for (const record of records) {
      for (const normalizedRegion of this.collectRecordRegionCandidates(record)) {
        const aliases = this.buildRegionAliases(normalizedRegion);
        if (aliases.some((item) => normalizedQuestion.includes(item))) {
          this.addRegionAliases(matchedRegions, normalizedRegion);
        }
      }
    }

    return [...matchedRegions];
  }

  /**
   * 判断单条记录是否命中区域 token。
   *
   * 参数说明：`record` 为标准 API 记录，`regionTokens` 为问题中解析出的区域 token。
   * 返回值说明：命中返回 `true`，否则返回 `false`。
   * 调用注意事项：有明确区域字段时以字段为准；字段缺失时才用业务名称保守兜底，避免全国数据混入区域问题。
   */
  private recordMatchesRegionTokens(
    record: StandardApiRecord,
    regionTokens: string[],
  ): boolean {
    if (regionTokens.length === 0) {
      return true;
    }

    const normalizedTokens = new Set(
      regionTokens.flatMap((token) => this.buildRegionAliases(token)),
    );
    const explicitCandidates = this.collectRecordRegionCandidates(record);
    if (explicitCandidates.length > 0) {
      return explicitCandidates.some((candidate) =>
        this.buildRegionAliases(candidate).some((alias) => normalizedTokens.has(alias)),
      );
    }

    return this.collectRecordRegionFallbackCandidates(record).some((candidate) => {
      const normalizedCandidate = this.normalizeRegionToken(candidate);
      return [...normalizedTokens].some((token) => normalizedCandidate.includes(token));
    });
  }

  /**
   * 收集记录中明确表达区域/大区的字段。
   *
   * 参数说明：`record` 为标准 API 记录。
   * 返回值说明：返回标准化后的区域候选集合。
   * 调用注意事项：只收集结构化区域字段，不把业务名称误当作强区域字段。
   */
  private collectRecordRegionCandidates(record: StandardApiRecord): string[] {
    return Array.from(
      new Set(
        [
          record.region,
          record.regionName,
          record.bigRegion,
          record.bigRegionName,
          record.area,
          record.areaName,
          record.province,
          record.provinceName,
        ]
          .map((item) => this.normalizeRegionToken(item))
          .filter(Boolean),
      ),
    );
  }

  /**
   * 收集区域字段缺失时可用于保守兜底的业务名称。
   *
   * 参数说明：`record` 为标准 API 记录。
   * 返回值说明：返回客户、商机、订单和渠道商名称候选。
   * 调用注意事项：这些字段只在结构化区域字段缺失时参与匹配，不能覆盖明确区域字段。
   */
  private collectRecordRegionFallbackCandidates(record: StandardApiRecord): string[] {
    return [
      record.partnerName,
      record.assignedPartnerName,
      record.customerName,
      record.customer,
      record.opportunityName,
      record.orderName,
      record.name,
      record.title,
      record.displayName,
      record.shortName,
    ]
      .map((item) => this.readText(item))
      .filter(Boolean);
  }

  /**
   * 读取记录用于展示的区域名称。
   *
   * 参数说明：`record` 为标准 API 记录。
   * 返回值说明：优先返回区域，其次返回大区。
   */
  private resolveDisplayRecordRegion(record: StandardApiRecord): string {
    return this.readText(
      record.region ?? record.regionName ?? record.bigRegion ?? record.bigRegionName,
    );
  }

  /**
   * 从问题或记录中解析用户可见的区域筛选说明。
   *
   * 参数说明：`questionText` 为用户原问题，`records` 为已过滤记录。
   * 返回值说明：返回用户可读区域文本，未命中时返回 `undefined`。
   */
  private resolveRequestedRegionLabel(
    questionText: string,
    records: StandardApiRecord[],
  ): string | undefined {
    const tokens = this.matchRegionsFromQuestion(questionText, records);
    return tokens[0];
  }

  /**
   * 将区域及其别名加入 token 集合。
   *
   * 参数说明：`target` 为待写入集合，`region` 为区域原始文本。
   * 返回值说明：无。
   */
  private addRegionAliases(target: Set<string>, region: string): void {
    for (const alias of this.buildRegionAliases(this.normalizeRegionToken(region))) {
      target.add(alias);
    }
  }

  /**
   * 按问题中的区域词筛选诊断样本。
   *
   * 参数说明：`questionText` 为用户问题，`records` 为候选记录。
   * 返回值说明：问题命中区域时返回同区域记录；问题未命中区域时返回原候选记录。
   * 调用注意事项：该方法只服务空结果提示，不参与正式查询结果。
   */
  private filterRecordsByQuestionRegion(
    questionText: string,
    records: StandardApiRecord[],
  ): StandardApiRecord[] {
    const matchedRegions = this.matchRegionsFromQuestion(questionText, records);
    if (matchedRegions.length === 0) {
      return records;
    }

    return records.filter((record) =>
      this.recordMatchesRegionTokens(record, matchedRegions),
    );
  }

  /**
   * 读取候选记录中最新创建时间。
   *
   * 参数说明：`records` 为标准 API 记录列表。
   * 返回值说明：返回 `YYYY-MM-DD` 日期文本，缺失时返回 `undefined`。
   * 调用注意事项：该日期只用于提示用户调整查询范围，不作为统计口径。
   */
  private resolveLatestRecordTime(records: StandardApiRecord[]): string | undefined {
    const latest = records
      .map((record) => this.readRecordTime(record))
      .filter(Boolean)
      .sort((left, right) => right.localeCompare(left))[0];
    return latest ? latest.slice(0, 10) : undefined;
  }

  /**
   * 生成区域别名。
   *
   * 参数说明：`region` 为标准化区域文本。
   * 返回值说明：返回去重后的区域别名。
   * 调用注意事项：别名只用于匹配，不写回数据。
   */
  private buildRegionAliases(region: string): string[] {
    const normalizedRegion = this.normalizeRegionToken(region);
    const aliases = new Set<string>([normalizedRegion]);
    for (const part of normalizedRegion.split(/[\\/\-_/｜|、，,>＞]+/u)) {
      if (part) {
        aliases.add(part);
      }
    }
    for (const item of [...aliases]) {
      aliases.add(item.replace(/区域/gu, ''));
      aliases.add(item.replace(/大区/gu, ''));
      aliases.add(item.replace(/区/gu, ''));
      aliases.add(item.replace(/省$/u, ''));
      aliases.add(item.replace(/市$/u, ''));
      if (/^大[北东南西]$/u.test(item)) {
        aliases.add(`${item}区`);
      }
    }
    return [...aliases].filter(Boolean);
  }

  /**
   * 标准化区域文本。
   *
   * 参数说明：`value` 为区域原始值。
   * 返回值说明：返回去空格、括号说明后的文本。
   * 调用注意事项：只用于比较，不替换页面展示值。
   */
  private normalizeRegionToken(value: unknown): string {
    return String(value ?? '')
      .trim()
      .replace(/\s+/gu, '')
      .replace(/区域/gu, '区')
      .replace(/（.*?）/gu, '')
      .replace(/\(.*?\)/gu, '');
  }

  /**
   * 归一化枚举比较文本。
   *
   * 参数说明：`value` 为阶段、状态等展示值。
   * 返回值说明：去除空白和括号，英文统一小写，便于稳定匹配排除口径。
   */
  private normalizeComparableText(value: unknown): string {
    return String(value ?? '')
      .trim()
      .replace(/\s+/gu, '')
      .replace(/（.*?）/gu, '')
      .replace(/\(.*?\)/gu, '')
      .toLowerCase();
  }

  /**
   * 归一化字符串数组。
   *
   * 参数说明：`value` 为待解析值。
   * 返回值说明：数组输入时返回去重后的字符串数组，其它输入返回空数组。
   * 调用注意事项：不做语义转换，只处理类型与空值。
   */
  private normalizeStringList(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return Array.from(
      new Set(
        value
          .filter((item): item is string | number => item !== null && item !== undefined)
          .map((item) => String(item).trim())
          .filter(Boolean),
      ),
    );
  }

  /**
   * 安全读取文本。
   *
   * 参数说明：`value` 为任意字段值。
   * 返回值说明：返回去空格字符串。
   * 调用注意事项：集中处理空值，减少页面出现 `undefined`。
   */
  private readText(value: unknown): string {
    return String(value ?? '').trim();
  }

  /**
   * 读取时间口径标签。
   *
   * 参数说明：`compiledTask` 为当前任务。
   * 返回值说明：返回标准化时间标签或“未声明时间口径”。
   * 调用注意事项：不能重新解析自然语言时间，避免执行口径漂移。
   */
  private resolveTemporalFilterLabel(
    compiledTask: RoutedCompiledQueryTask,
  ): string {
    return String(
      compiledTask.plan.temporalSlot?.normalizedLabel ??
        compiledTask.plan.filters.timeRange ??
        '未声明时间口径',
    );
  }
}

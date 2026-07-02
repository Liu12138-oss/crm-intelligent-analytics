import { Injectable } from '@nestjs/common';
import type {
  AnalysisDepth,
  AnalysisFocus,
  AnalysisIntent,
  AnalysisResultIntent,
  QueryPlanResultKind,
  TemporalSlot,
} from '../../shared/types/domain';
import { detectTimeRange } from '../../shared/utils/time-range.util';
import {
  LianruanCrmFieldCapabilityRegistry,
} from '../crm-standard-api/lianruan-crm-field-capability.registry';
import type { LianruanCrmOpenApiResource } from '../crm-standard-api/lianruan-crm-openapi.types';
import {
  inferAnalysisDepth,
  inferAnalysisFacetProfile,
  resolveAnalysisOutputPreference,
  resolveAnalysisFocus,
} from './analysis-topic-report.registry';
import type {
  BusinessAnalysisIntent,
  BusinessDimension,
  BusinessIntentMappingResult,
  BusinessMetric,
  BusinessUnsupportedHint,
} from './business-analysis-intent.types';

interface FieldDemand {
  resource: LianruanCrmOpenApiResource;
  fields: string[];
  usage: 'filter' | 'sort' | 'aggregate' | 'read';
  label: string;
  anyOf?: boolean;
}

const RESOURCE_LABELS: Record<LianruanCrmOpenApiResource, string> = {
  users: '用户',
  customers: '客户主数据',
  partners: '服务商',
  registrations: '客户报备',
  opportunities: '商机',
  quotes: '报价',
  orders: '订单',
};

@Injectable()
export class BusinessAnalysisIntentMapperService {
  constructor(
    private readonly fieldCapabilityRegistry: LianruanCrmFieldCapabilityRegistry,
  ) {}

  /**
   * 将宽业务意图映射为现有受控分析意图。
   *
   * 参数说明：
   * - `questionText`：用户原始问题，用于保留业务口径和既有规划器关键词识别。
   * - `businessIntent`：AI 宽意图理解结果。
   * 返回值说明：返回可执行的旧版 `AnalysisIntent`、主资源和字段缺口。
   * 调用注意事项：该方法只使用字段能力表里已登记的字段，不接受 AI 输出的任意字段名。
   */
  mapToAnalysisIntent(
    questionText: string,
    businessIntent: BusinessAnalysisIntent,
  ): BusinessIntentMappingResult {
    const normalizedQuestion = businessIntent.normalizedQuestion || questionText.trim();
    const sourceResource = this.resolveSourceResource(businessIntent);
    if (businessIntent.requestedAction === 'BLOCK') {
      return {
        intent: this.createBlockedIntent(
          normalizedQuestion,
          businessIntent.blockReason || '当前请求不属于受控只读 CRM 分析范围。',
        ),
        sourceResource,
        unsupportedHints: [],
      };
    }

    const unsupportedHints = this.validateFieldCapabilities(sourceResource, businessIntent);
    if (unsupportedHints.length > 0) {
      return {
        intent: this.createBlockedIntent(
          normalizedQuestion,
          this.buildUnsupportedBlockReason(unsupportedHints),
        ),
        sourceResource,
        unsupportedHints,
      };
    }

    const dimensions = this.resolveLegacyDimensions(businessIntent);
    const resultKindHint = this.resolveResultKindHint(businessIntent, dimensions);
    const effectiveTimeRange = this.resolveEffectiveTimeRange(normalizedQuestion, businessIntent);
    const missingConditions = effectiveTimeRange
      ? businessIntent.missingConditions.filter((item) => item !== '时间范围')
      : businessIntent.missingConditions;
    const filters = effectiveTimeRange
      ? {
          timeRange: effectiveTimeRange.normalizedLabel,
          ...(effectiveTimeRange.startAt ? { startAt: effectiveTimeRange.startAt } : {}),
          ...(effectiveTimeRange.endAt ? { endAt: effectiveTimeRange.endAt } : {}),
        }
      : {};
    const analysisDepth = this.resolveAnalysisDepth(normalizedQuestion, businessIntent);
    const analysisFocus = this.resolveAnalysisFocus(normalizedQuestion, businessIntent);
    const outputPreference = resolveAnalysisOutputPreference(
      normalizedQuestion,
      businessIntent.outputPreference,
    );

    return {
      intent: {
        domain: this.resolveLegacyDomain(sourceResource),
        metrics: this.resolveLegacyMetrics(sourceResource, businessIntent.metrics),
        dimensions,
        filters,
        ...(effectiveTimeRange ? { temporalSlot: effectiveTimeRange } : {}),
        missingConditions,
        normalizedQuestion,
        requestedAction: 'READONLY_ANALYSIS',
        confidence: businessIntent.confidence,
        blockReason: '',
        orderBy: [
          {
            field: resultKindHint === 'time-trend' ? 'bucket_label' : 'amount',
            direction: resultKindHint === 'time-trend' ? 'ASC' : 'DESC',
          },
        ],
        resultKindHint,
        queryEntities: this.resolveQueryEntities(sourceResource, businessIntent),
        resultIntent: this.resolveResultIntent(businessIntent, resultKindHint),
        timeRangeText: effectiveTimeRange?.rawText,
        analysisFacetProfile: inferAnalysisFacetProfile(normalizedQuestion),
        analysisDepth,
        analysisFocus,
        outputPreference,
        businessIntentHint: {
          objectTypes: [...businessIntent.objectTypes],
          metrics: [...businessIntent.metrics],
          dimensions: [...businessIntent.dimensions],
          analysisMode: businessIntent.analysisMode,
          outputPreference,
          comparison: [...businessIntent.comparison],
          sourceResource,
        },
      },
      sourceResource,
      unsupportedHints,
    };
  }

  /**
   * 解析宽业务意图的有效时间范围。
   *
   * 参数说明：`questionText` 为原始问题，`businessIntent` 为 AI 宽意图。
   * 返回值说明：优先返回 AI 明确输出的时间槽；若 AI 漏掉但原文能被共享时间工具识别，则补成可执行时间槽。
   * 调用注意事项：该兜底只修复“最近一年/近一年”等明确时间被漏抽的情况；用户未给时间时不补默认时间。
   */
  private resolveEffectiveTimeRange(
    questionText: string,
    businessIntent: BusinessAnalysisIntent,
  ): TemporalSlot | undefined {
    const explicitQuarterComparison = this.detectExplicitQuarterComparisonSlot(questionText);
    if (explicitQuarterComparison) {
      return explicitQuarterComparison;
    }

    if (businessIntent.timeRange) {
      return businessIntent.timeRange;
    }

    const range = detectTimeRange(questionText);
    if (!range) {
      return undefined;
    }

    return {
      rawText: range.label,
      normalizedLabel: range.label,
      startAt: range.startAt,
      endAt: new Date().toISOString(),
      timezone: 'Asia/Shanghai',
      granularity: range.label.includes('天') || range.label.includes('今日') ? 'day' : 'month',
      relativity: 'relative',
      inclusivity: {
        start: 'inclusive',
        end: 'exclusive',
      },
      confidence: 'MEDIUM',
    };
  }

  /**
   * 识别“26年一季度与二季度 / 一季度和二季度”这类明确多季度对比窗口。
   *
   * 参数说明：`questionText` 为用户原始问题。
   * 返回值说明：命中时返回覆盖两个季度的闭开时间槽；否则返回 `undefined`。
   * 调用注意事项：该时间槽用于先取齐两个季度数据，真正的季度拆分在结果聚合层完成。
   */
  private detectExplicitQuarterComparisonSlot(questionText: string): TemporalSlot | undefined {
    const match = questionText.match(
      /(?:(?<firstYear>(?:20)?\d{2})\s*年\s*)?(?<first>一|二|三|四|1|2|3|4|Q1|Q2|Q3|Q4)\s*(?:季度|季)?\s*(?:与|和|及|到|至|比|对比|比较|-|—|~|、|,|，)\s*(?:(?<secondYear>(?:20)?\d{2})\s*年\s*)?(?<second>一|二|三|四|1|2|3|4|Q1|Q2|Q3|Q4)\s*(?:季度|季)?/iu,
    );
    if (!match?.groups?.first || !match.groups.second) {
      return undefined;
    }

    const fallbackYear = this.resolveCurrentShanghaiYear();
    const firstYear = match.groups.firstYear
      ? this.normalizeQuarterYear(match.groups.firstYear)
      : fallbackYear;
    const secondYear = match.groups.secondYear
      ? this.normalizeQuarterYear(match.groups.secondYear)
      : firstYear;
    const firstQuarter = this.parseQuarterIndex(match.groups.first);
    const secondQuarter = this.parseQuarterIndex(match.groups.second);
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
        ? `${startYear}年${this.formatQuarterName(startQuarter)}至${this.formatQuarterName(endQuarter)}`
        : `${startYear}年${this.formatQuarterName(startQuarter)}至${endYear}年${this.formatQuarterName(endQuarter)}`,
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
   * 返回值说明：返回四位自然年，用于“今年一季度和二季度”省略年份时的兜底。
   * 调用注意事项：这里只处理用户已明确给出季度对比、但省略年份的场景，不给无时间问题补默认时间。
   */
  private resolveCurrentShanghaiYear(): number {
    return new Date(Date.now() + 8 * 60 * 60 * 1000).getUTCFullYear();
  }

  /**
   * 规范化两位或四位年份。
   *
   * 参数说明：`rawYear` 为用户输入年份。
   * 返回值说明：返回四位年份，非法时返回 `undefined`。
   */
  private normalizeQuarterYear(rawYear: string): number | undefined {
    const year = Number(rawYear);
    if (!Number.isInteger(year)) {
      return undefined;
    }

    return year < 100 ? 2000 + year : year;
  }

  /**
   * 解析季度序号。
   *
   * 参数说明：`rawQuarter` 为中文、数字或 Q1 形式季度。
   * 返回值说明：返回从 0 开始的季度索引，无法识别时返回 -1。
   */
  private parseQuarterIndex(rawQuarter: string): number {
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
   * 格式化季度中文名。
   *
   * 参数说明：`quarterIndex` 为从 0 开始的季度索引。
   * 返回值说明：返回“一季度”等中文展示名。
   */
  private formatQuarterName(quarterIndex: number): string {
    return ['一季度', '二季度', '三季度', '四季度'][quarterIndex] ?? `第${quarterIndex + 1}季度`;
  }

  /**
   * 构造上海时区季度边界 ISO。
   *
   * 参数说明：`year` 为自然年，`quarterIndex` 可传 0-4，4 表示下一年一季度边界。
   * 返回值说明：返回 UTC ISO 字符串，表示上海本地季度起点。
   */
  private buildShanghaiQuarterBoundaryIso(year: number, quarterIndex: number): string {
    const monthIndex = quarterIndex * 3;
    return new Date(Date.UTC(year, monthIndex, 1, -8, 0, 0, 0)).toISOString();
  }

  /**
   * 根据业务对象选择主资源。
   *
   * 参数说明：`objectTypes` 为宽意图对象数组。
   * 返回值说明：返回联软标准 API 主资源。
   * 调用注意事项：多对象问题优先选择成交链路对象，再选择画像主对象。
   */
  private resolveSourceResource(
    businessIntent: BusinessAnalysisIntent,
  ): LianruanCrmOpenApiResource {
    const objectTypes = businessIntent.objectTypes;
    const metricSet = new Set(businessIntent.metrics);
    const dimensionSet = new Set(businessIntent.dimensions);
    if (objectTypes.includes('order') || objectTypes.includes('contract') || objectTypes.includes('payment')) {
      return 'orders';
    }

    if (objectTypes.includes('quote')) {
      return 'quotes';
    }

    if (
      objectTypes.includes('customer') &&
      (
        metricSet.has('unlinked_customer_count') ||
        metricSet.has('customer_age_days') ||
        dimensionSet.has('customer_age_bucket')
      )
    ) {
      return 'customers';
    }

    if (objectTypes.includes('opportunity')) {
      return 'opportunities';
    }

    if (objectTypes.includes('registration')) {
      return 'registrations';
    }

    if (objectTypes.includes('partner')) {
      return 'partners';
    }

    if (objectTypes.includes('customer')) {
      return 'customers';
    }

    return 'opportunities';
  }

  /**
   * 将主资源映射为旧版分析域。
   *
   * 参数说明：`resource` 为主资源。
   * 返回值说明：返回现有 `AnalysisDomain`。
   * 调用注意事项：报价和订单复用合同转化域，服务商和报备复用客户经营域以兼容现有执行器。
   */
  private resolveLegacyDomain(resource: LianruanCrmOpenApiResource): AnalysisIntent['domain'] {
    if (resource === 'orders' || resource === 'quotes') {
      return 'contract-conversion';
    }

    if (resource === 'partners' || resource === 'registrations' || resource === 'customers') {
      return 'customer-relationship';
    }

    return 'opportunity-analysis';
  }

  /**
   * 将宽指标映射为旧版指标。
   *
   * 参数说明：`resource` 为主资源，`metrics` 为宽指标。
   * 返回值说明：返回旧执行层支持的指标标签。
   * 调用注意事项：订单/报价数量由结果 `count` 统计，旧指标仍使用金额口径承接。
   */
  private resolveLegacyMetrics(
    resource: LianruanCrmOpenApiResource,
    metrics: BusinessMetric[],
  ): string[] {
    if (resource === 'orders' || resource === 'quotes') {
      return ['转合同金额'];
    }

    if (resource === 'partners') {
      return metrics.includes('partner_count') || metrics.includes('technical_partner_count')
        ? []
        : ['客户贡献度'];
    }

    if (resource === 'registrations' || resource === 'customers') {
      return ['客户贡献度'];
    }

    if (metrics.includes('opportunity_count')) {
      return ['商机数量'];
    }

    if (metrics.includes('stale_opportunity_count')) {
      return ['商机数量'];
    }

    if (metrics.includes('win_rate') || metrics.includes('conversion_rate')) {
      return ['赢单率'];
    }

    return ['新增商机金额'];
  }

  /**
   * 将宽维度映射为旧版维度。
   *
   * 参数说明：`businessIntent` 为宽意图。
   * 返回值说明：返回旧规划器可识别的维度标签。
   * 调用注意事项：等级、状态、技术服务商等资料维度暂映射为分类维度，由服务商画像和分类聚合承接。
   */
  private resolveLegacyDimensions(businessIntent: BusinessAnalysisIntent): string[] {
    const dimensions = new Set<string>();
    const dimensionSet = new Set(businessIntent.dimensions);

    if (dimensionSet.has('partner') || businessIntent.objectTypes.includes('partner')) {
      dimensions.add('渠道商');
    }

    if (dimensionSet.has('region') || dimensionSet.has('big_region') || dimensionSet.has('department')) {
      dimensions.add('区域');
    }

    if (dimensionSet.has('owner')) {
      dimensions.add('销售负责人');
    }

    if (dimensionSet.has('month') || dimensionSet.has('quarter') || dimensionSet.has('year')) {
      dimensions.add('月份');
    }

    if (dimensionSet.has('stage')) {
      dimensions.add('商机阶段');
    }

    if (
      dimensionSet.has('status') ||
      dimensionSet.has('partner_level') ||
      dimensionSet.has('is_technical_service_provider') ||
      dimensionSet.has('customer_category') ||
      dimensionSet.has('customer_age_bucket')
    ) {
      dimensions.add('客户分类');
    }

    if (dimensions.size > 0) {
      return [...dimensions];
    }

    if (businessIntent.objectTypes.includes('order') || businessIntent.objectTypes.includes('contract')) {
      return ['渠道商'];
    }

    if (businessIntent.objectTypes.includes('registration')) {
      return ['渠道商', '客户分类'];
    }

    if (businessIntent.objectTypes.includes('partner')) {
      return ['渠道商'];
    }

    if (businessIntent.objectTypes.includes('opportunity')) {
      return ['渠道商', '商机阶段'];
    }

    return ['销售负责人'];
  }

  /**
   * 解析结果形态提示。
   *
   * 参数说明：`businessIntent` 为宽意图，`legacyDimensions` 为旧版维度。
   * 返回值说明：返回旧规划器可识别的结果形态。
   * 调用注意事项：渠道商维度优先返回贡献分析，以承接渠道/服务商问数。
   */
  private resolveResultKindHint(
    businessIntent: BusinessAnalysisIntent,
    legacyDimensions: string[],
  ): QueryPlanResultKind {
    const objectTypes = new Set(businessIntent.objectTypes);
    if (businessIntent.metrics.includes('stale_opportunity_count')) {
      return 'risk-overview';
    }

    // 修复：detail 模式优先于渠道商短路，避免"把商机列出来"被误判为 partner-contribution
    // detail 模式用户期望看到条目明细，应走 owner-ranking 产出明细表
    if (businessIntent.analysisMode === 'detail') {
      return 'owner-ranking';
    }

    // 修复：trend 模式优先于渠道商短路，避免"渠道商商机趋势分析"被误判为 partner-contribution
    // 只有 analysisMode 明确为 trend 时才优先；月份维度单独出现（如时间范围"最近三个月"）不触发
    if (businessIntent.analysisMode === 'trend') {
      return 'time-trend';
    }

    if (
      legacyDimensions.includes('客户分类') &&
      (objectTypes.has('registration') || objectTypes.has('customer')) &&
      !objectTypes.has('order') &&
      !objectTypes.has('contract') &&
      !objectTypes.has('opportunity')
    ) {
      return 'category-distribution';
    }

    if (legacyDimensions.includes('渠道商')) {
      return 'partner-contribution';
    }

    if (legacyDimensions.includes('月份')) {
      return 'time-trend';
    }

    if (legacyDimensions.includes('商机阶段')) {
      return 'stage-distribution';
    }

    if (
      businessIntent.analysisMode === 'distribution' ||
      legacyDimensions.includes('客户分类')
    ) {
      return 'category-distribution';
    }

    if (legacyDimensions.includes('区域')) {
      return 'department-contribution';
    }

    return businessIntent.analysisMode === 'single_metric'
      ? 'metric-summary'
      : 'owner-ranking';
  }

  /**
   * 解析用户期望结果意图。
   *
   * 参数说明：`businessIntent` 为宽意图，`resultKindHint` 为结果形态。
   * 返回值说明：返回旧版结果意图枚举。
   * 调用注意事项：该字段主要用于报告组织，不直接决定查询字段。
   */
  private resolveResultIntent(
    businessIntent: BusinessAnalysisIntent,
    resultKindHint: QueryPlanResultKind,
  ): AnalysisResultIntent {
    if (businessIntent.analysisMode === 'detail') {
      return 'detail';
    }

    if (businessIntent.analysisMode === 'comparison') {
      return 'comparison';
    }

    if (businessIntent.analysisMode === 'trend' || resultKindHint === 'time-trend') {
      return 'trend';
    }

    if (businessIntent.analysisMode === 'distribution') {
      return 'distribution';
    }

    if (businessIntent.analysisMode === 'ranking') {
      return 'ranking';
    }

    return 'summary';
  }

  /**
   * 解析报告深度。
   *
   * 参数说明：`questionText` 为问题文本，`businessIntent` 为宽意图。
   * 返回值说明：返回报告深度。
   * 调用注意事项：看板和报告类问题默认提升到深度分析。
   */
  private resolveAnalysisDepth(
    questionText: string,
    businessIntent: BusinessAnalysisIntent,
  ): AnalysisDepth {
    if (
      businessIntent.analysisMode === 'summary_report' ||
      businessIntent.analysisMode === 'dashboard'
    ) {
      return 'deep-dive';
    }

    return inferAnalysisDepth(questionText);
  }

  /**
   * 解析分析关注点。
   *
   * 参数说明：`questionText` 为问题文本，`businessIntent` 为宽意图。
   * 返回值说明：返回关注点数组。
   * 调用注意事项：关注点只用于报告编排，不影响权限和字段边界。
   */
  private resolveAnalysisFocus(
    questionText: string,
    businessIntent: BusinessAnalysisIntent,
  ): AnalysisFocus[] {
    const focus = new Set<AnalysisFocus>(resolveAnalysisFocus(questionText));
    if (businessIntent.analysisMode === 'ranking') {
      focus.add('ranking');
    }
    if (businessIntent.analysisMode === 'trend' || businessIntent.dimensions.includes('month')) {
      focus.add('trend');
    }
    if (
      businessIntent.analysisMode === 'summary_report' ||
      businessIntent.analysisMode === 'dashboard'
    ) {
      focus.add('summary');
      focus.add('structure');
    }
    if (businessIntent.dimensions.includes('region') || businessIntent.dimensions.includes('big_region')) {
      focus.add('region');
    }
    return [...focus];
  }

  /**
   * 解析查询实体。
   *
   * 参数说明：`resource` 为主资源，`businessIntent` 为宽意图。
   * 返回值说明：返回用户可见的业务实体标签。
   * 调用注意事项：实体只用于快照和报告文案，不作为字段名执行。
   */
  private resolveQueryEntities(
    resource: LianruanCrmOpenApiResource,
    businessIntent: BusinessAnalysisIntent,
  ): string[] {
    const entities = new Set<string>([RESOURCE_LABELS[resource]]);
    for (const dimension of businessIntent.dimensions) {
      const label = this.resolveDimensionLabel(dimension);
      if (label) {
        entities.add(label);
      }
    }
    for (const entity of businessIntent.entities) {
      entities.add(entity.normalizedValue ?? entity.value);
    }
    return [...entities];
  }

  /**
   * 校验宽意图所需字段是否在能力表中存在。
   *
   * 参数说明：`resource` 为主资源，`businessIntent` 为宽意图。
   * 返回值说明：返回字段缺口列表；为空表示静态契约允许映射。
   * 调用注意事项：这里不检查远端样例是否为空，运行时空值由诊断服务继续处理。
   */
  private validateFieldCapabilities(
    resource: LianruanCrmOpenApiResource,
    businessIntent: BusinessAnalysisIntent,
  ): BusinessUnsupportedHint[] {
    const demands = [
      ...this.buildMetricDemands(resource, businessIntent.metrics),
      ...this.buildDimensionDemands(resource, businessIntent.dimensions),
    ];
    const unsupported: BusinessUnsupportedHint[] = [];

    for (const demand of demands) {
      if (this.isDemandSupported(demand)) {
        continue;
      }

      unsupported.push({
        resource: demand.resource,
        field: demand.fields.join('/'),
        label: demand.label,
        reason: `${RESOURCE_LABELS[demand.resource]}暂未声明可用于${this.resolveUsageLabel(demand.usage)}的“${demand.label}”字段。`,
      });
    }

    return unsupported;
  }

  /**
   * 构建指标字段需求。
   *
   * 参数说明：`resource` 为主资源，`metrics` 为宽指标数组。
   * 返回值说明：返回指标所需字段需求。
   * 调用注意事项：金额类指标允许 `amount/totalAmount` 任一字段承接。
   */
  private buildMetricDemands(
    resource: LianruanCrmOpenApiResource,
    metrics: BusinessMetric[],
  ): FieldDemand[] {
    const demands: FieldDemand[] = [];
    const metricSet = new Set(metrics);

    if (
      metricSet.has('amount') ||
      metricSet.has('total_amount') ||
      metricSet.has('opportunity_amount') ||
      metricSet.has('quote_amount') ||
      metricSet.has('order_amount') ||
      metricSet.has('contract_amount') ||
      metricSet.has('payment_amount') ||
      metricSet.has('concentration_ratio')
    ) {
      demands.push({
        resource,
        fields: ['amount', 'totalAmount'],
        usage: 'aggregate',
        label: '金额',
        anyOf: true,
      });
    }

    if (
      metricSet.has('count') ||
      metricSet.has('opportunity_count') ||
      metricSet.has('registration_count') ||
      metricSet.has('quote_count') ||
      metricSet.has('order_count') ||
      metricSet.has('partner_count') ||
      metricSet.has('unlinked_customer_count')
    ) {
      demands.push({ resource, fields: ['id'], usage: 'read', label: '数量' });
    }

    if (metricSet.has('technical_partner_count')) {
      demands.push({
        resource: 'partners',
        fields: ['isTechnicalServiceProvider', 'isTechService'],
        usage: 'aggregate',
        label: '是否技术服务商',
        anyOf: true,
      });
    }

    if (metricSet.has('customer_age_days')) {
      demands.push({
        resource: 'customers',
        fields: ['createdAt'],
        usage: 'aggregate',
        label: '客户创建时间',
      });
    }

    if (metricSet.has('stale_opportunity_count')) {
      demands.push({
        resource: 'opportunities',
        fields: ['updatedAt'],
        usage: 'sort',
        label: '商机更新时间',
      });
      demands.push({
        resource: 'opportunities',
        fields: ['stage', 'stageName', 'status'],
        usage: 'aggregate',
        label: '商机阶段或状态',
        anyOf: true,
      });
    }

    if (metricSet.has('inactive_customer_count')) {
      demands.push({
        resource: 'customers',
        fields: ['latestActivityAt', 'updatedAt', 'createdAt'],
        usage: 'aggregate',
        label: '未活跃客户',
        anyOf: true,
      });
    }

    return demands;
  }

  /**
   * 构建维度字段需求。
   *
   * 参数说明：`resource` 为主资源，`dimensions` 为宽维度数组。
   * 返回值说明：返回维度所需字段需求。
   * 调用注意事项：订单/报价按区域分析时可通过服务商关联字段承接，不要求订单对象直接声明区域字段。
   */
  private buildDimensionDemands(
    resource: LianruanCrmOpenApiResource,
    dimensions: BusinessDimension[],
  ): FieldDemand[] {
    const demands: FieldDemand[] = [];
    const dimensionSet = new Set(dimensions);

    if (dimensionSet.has('partner')) {
      demands.push({ resource, fields: ['partnerId'], usage: 'aggregate', label: '服务商' });
    }

    if (dimensionSet.has('region')) {
      demands.push(this.buildRegionDemand(resource, 'region', '区域'));
    }

    if (dimensionSet.has('big_region')) {
      demands.push(this.buildRegionDemand(resource, 'bigRegion', '大区'));
    }

    if (dimensionSet.has('owner')) {
      demands.push({
        resource,
        fields: ['ownerId', 'assignedStaffId', 'createdBy'],
        usage: 'aggregate',
        label: '负责人',
        anyOf: true,
      });
    }

    if (dimensionSet.has('month') || dimensionSet.has('quarter') || dimensionSet.has('year')) {
      demands.push({ resource, fields: ['createdAt'], usage: 'aggregate', label: '时间' });
    }

    if (dimensionSet.has('stage')) {
      demands.push({
        resource,
        fields: ['stage', 'stageName', 'status'],
        usage: 'aggregate',
        label: '阶段',
        anyOf: true,
      });
    }

    if (dimensionSet.has('status')) {
      demands.push({ resource, fields: ['status'], usage: 'aggregate', label: '状态' });
    }

    if (dimensionSet.has('partner_level')) {
      demands.push({
        resource: 'partners',
        fields: ['partnerLevel', 'partnerLevelName', 'level'],
        usage: 'aggregate',
        label: '合作等级',
        anyOf: true,
      });
    }

    if (dimensionSet.has('is_technical_service_provider')) {
      demands.push({
        resource: 'partners',
        fields: ['isTechnicalServiceProvider', 'isTechService'],
        usage: 'aggregate',
        label: '是否技术服务商',
        anyOf: true,
      });
    }

    if (dimensionSet.has('customer_category')) {
      demands.push({ resource, fields: ['category'], usage: 'aggregate', label: '客户分类' });
    }

    if (dimensionSet.has('customer_age_bucket')) {
      demands.push({ resource, fields: ['createdAt'], usage: 'aggregate', label: '客户创建时长' });
    }

    return demands;
  }

  /**
   * 构建区域字段需求。
   *
   * 参数说明：`resource` 为主资源，`field` 为区域字段名，`label` 为业务标签。
   * 返回值说明：返回字段需求。
   * 调用注意事项：成交链路可通过 `partnerId -> partners.region` 关联承接区域口径。
   */
  private buildRegionDemand(
    resource: LianruanCrmOpenApiResource,
    field: 'region' | 'bigRegion',
    label: string,
  ): FieldDemand {
    if (this.fieldCapabilityRegistry.findCapability(resource, field)) {
      return { resource, fields: [field], usage: 'aggregate', label };
    }

    if (this.fieldCapabilityRegistry.findCapability(resource, 'partnerId')) {
      return { resource: 'partners', fields: [field], usage: 'aggregate', label };
    }

    return { resource, fields: [field], usage: 'aggregate', label };
  }

  /**
   * 判断字段需求是否满足。
   *
   * 参数说明：`demand` 为单个字段需求。
   * 返回值说明：字段能力满足时返回 true。
   * 调用注意事项：`anyOf` 需求只要任一字段满足即可。
   */
  private isDemandSupported(demand: FieldDemand): boolean {
    if (demand.anyOf) {
      return demand.fields.some((field) =>
        this.fieldCapabilityRegistry.supportsFieldUsage(demand.resource, field, demand.usage),
      );
    }

    return demand.fields.every((field) =>
      this.fieldCapabilityRegistry.supportsFieldUsage(demand.resource, field, demand.usage),
    );
  }

  /**
   * 构建字段缺失阻断文案。
   *
   * 参数说明：`unsupportedHints` 为字段缺口列表。
   * 返回值说明：返回面向业务用户的中文提示。
   * 调用注意事项：文案不暴露内部 SQL，仅说明缺少哪个业务字段。
   */
  private buildUnsupportedBlockReason(unsupportedHints: BusinessUnsupportedHint[]): string {
    const labels = unsupportedHints
      .map((item) => `${RESOURCE_LABELS[item.resource]}的${item.label}`)
      .filter(Boolean);
    return `当前联软标准 OpenAPI 字段能力暂不支持本次分析所需的 ${labels.join('、')}，请先让联软补齐对应字段或调整查询口径。`;
  }

  /**
   * 创建阻断意图。
   *
   * 参数说明：`questionText` 为规范化问题，`blockReason` 为阻断原因。
   * 返回值说明：返回旧链路可识别的阻断意图。
   * 调用注意事项：阻断只用于写操作、越界或字段缺失，不用于普通空数据。
   */
  private createBlockedIntent(questionText: string, blockReason: string): AnalysisIntent {
    return {
      domain: 'opportunity-analysis',
      metrics: [],
      dimensions: [],
      filters: {},
      missingConditions: [],
      normalizedQuestion: questionText,
      requestedAction: 'BLOCK',
      confidence: 'LOW',
      blockReason,
      orderBy: [],
      resultKindHint: 'owner-ranking',
      queryEntities: ['CRM'],
      resultIntent: 'summary',
      analysisFacetProfile: 'generic-analysis',
      analysisDepth: 'snapshot',
      analysisFocus: [],
    };
  }

  /**
   * 解析维度中文标签。
   *
   * 参数说明：`dimension` 为宽维度枚举。
   * 返回值说明：返回业务中文标签。
   * 调用注意事项：仅用于展示，不参与字段执行。
   */
  private resolveDimensionLabel(dimension: BusinessDimension): string {
    const map: Record<BusinessDimension, string> = {
      region: '区域',
      big_region: '大区',
      department: '部门',
      owner: '负责人',
      partner: '服务商',
      customer: '客户',
      month: '月份',
      quarter: '季度',
      year: '年度',
      stage: '阶段',
      status: '状态',
      partner_level: '合作等级',
      is_technical_service_provider: '是否技术服务商',
      customer_category: '客户分类',
      customer_age_bucket: '客户创建时长',
    };
    return map[dimension];
  }

  /**
   * 解析字段用途中文标签。
   *
   * 参数说明：`usage` 为字段用途枚举。
   * 返回值说明：返回中文用途。
   * 调用注意事项：仅用于友好错误提示。
   */
  private resolveUsageLabel(usage: FieldDemand['usage']): string {
    if (usage === 'filter') {
      return '筛选';
    }
    if (usage === 'sort') {
      return '排序';
    }
    if (usage === 'aggregate') {
      return '聚合';
    }
    return '读取';
  }
}

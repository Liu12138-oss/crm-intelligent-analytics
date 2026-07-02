import { Injectable, Logger, Optional } from '@nestjs/common';
import type {
  AiEntryInterpretationSnapshot,
  AnalysisIntent,
  AnalysisEntryMode,
  AiEntryTargetWorkflow,
  AnalysisResultIntent,
  ChannelType,
} from '../../shared/types/domain';
import { createAiEntryInterpretationSnapshot } from '../../shared/utils/ai-entry-intent.util';
import { AiGatewayService } from './ai-gateway.service';
import { BusinessAnalysisIntentMapperService } from './business-analysis-intent-mapper.service';
import {
  inferAnalysisDepth,
  inferAnalysisFacetProfile,
  resolveAnalysisOutputPreference,
  resolveAnalysisFocus,
} from './analysis-topic-report.registry';
import {
  resolveCrmAnalysisQuestionTemplateRuleByText,
  scoreCrmAnalysisQuestionTemplateRule,
} from './crm-analysis-question-template.registry';
import type {
  BusinessAnalysisIntent,
  BusinessAnalysisMode,
  BusinessDimension,
  BusinessMetric,
  BusinessObjectType,
  BusinessOutputPreference,
} from './business-analysis-intent.types';

/**
 * Web 智能分析入口当前只承接自由问数与其衍生追问。
 *
 * 固定功能主题入口仍由企业微信和其它专用程序流处理，不进入本服务。
 */
const WEB_ANALYSIS_ENTRY_MODE: AnalysisEntryMode = 'FREE_QUERY';

export interface AnalysisIntentParseResult {
  intent: AnalysisIntent;
  entryInterpretationSnapshot: AiEntryInterpretationSnapshot;
}

@Injectable()
export class AnalysisIntentService {
  private readonly logger = new Logger('CRMAnalysisIntent');

  constructor(
    private readonly aiGatewayService: AiGatewayService,
    @Optional()
    private readonly businessAnalysisIntentMapperService?: BusinessAnalysisIntentMapperService,
  ) {}

  async parse(questionText: string): Promise<AnalysisIntent> {
    const result = await this.parseWithEntrySnapshot(questionText);
    return result.intent;
  }

  /**
   * 统一分析入口的 AI-first 解析结果。
   *
   * 设计原因：
   * 1. 联软 OpenAPI 已作为正式真实取数主链，入口必须先产出宽业务语义；
   * 2. 窄业务意图和历史问数链路会把综合经营问题压回旧口径，因此不再参与正式主链；
   * 3. 宽业务 AI 超时或无效时，仅对原文中明确出现的 CRM 只读对象启用受控主链补偿。
   */
  async parseWithEntrySnapshot(
    questionText: string,
    channel: ChannelType = 'web-console',
  ): Promise<AnalysisIntentParseResult> {
    const normalizedQuestion = this.aiGatewayService.summarizeQuestion(questionText);
    this.logger.debug('意图解析开始', { channel, question: normalizedQuestion });
    const businessIntent =
      typeof this.aiGatewayService.parseBusinessAnalysisIntent === 'function' &&
      this.businessAnalysisIntentMapperService
        ? await this.aiGatewayService.parseBusinessAnalysisIntent(normalizedQuestion)
        : null;
    if (businessIntent && this.businessAnalysisIntentMapperService) {
      const mappedResult =
        this.businessAnalysisIntentMapperService.mapToAnalysisIntent(
          normalizedQuestion,
          businessIntent,
        );
      this.logger.log(
        '意图解析命中AI主链',
        {
          channel,
          domain: mappedResult.intent.domain,
          analysisMode: businessIntent.analysisMode,
          resultKindHint: mappedResult.intent.resultKindHint,
          requestedAction: mappedResult.intent.requestedAction,
        },
      );
      return {
        intent: mappedResult.intent,
        entryInterpretationSnapshot: this.buildEntryInterpretationSnapshot({
          questionText: normalizedQuestion,
          intent: mappedResult.intent,
          channel,
          usedFallback: false,
        }),
      };
    }

    const compensatedBusinessIntent =
      this.businessAnalysisIntentMapperService
        ? this.tryBuildControlledBusinessIntentCompensation(normalizedQuestion)
        : null;
    if (compensatedBusinessIntent && this.businessAnalysisIntentMapperService) {
      const mappedResult =
        this.businessAnalysisIntentMapperService.mapToAnalysisIntent(
          normalizedQuestion,
          compensatedBusinessIntent,
        );
      this.logger.log(
        '意图解析命中受控补偿链路',
        {
          channel,
          domain: mappedResult.intent.domain,
          analysisMode: compensatedBusinessIntent.analysisMode,
          resultKindHint: mappedResult.intent.resultKindHint,
        },
      );
      return {
        intent: mappedResult.intent,
        entryInterpretationSnapshot: this.buildEntryInterpretationSnapshot({
          questionText: normalizedQuestion,
          intent: mappedResult.intent,
          channel,
          usedFallback: true,
          fallbackReason: 'business-analysis-intent-controlled-compensation',
        }),
      };
    }

    this.logger.warn('意图解析阻断：未返回可执行CRM分析意图', {
      channel,
      question: normalizedQuestion,
    });
    const blockedIntent = this.createBlockedIntent(
      normalizedQuestion,
      '当前统一业务语义解析未返回可执行的 CRM 分析意图。请稍后重试；如果持续失败，请联系管理员检查 AI 配置，或让联软补齐 OpenAPI 能力后再执行分析。',
    );

    return {
      intent: blockedIntent,
      entryInterpretationSnapshot: this.buildEntryInterpretationSnapshot({
        questionText: normalizedQuestion,
        intent: blockedIntent,
        channel,
        usedFallback: true,
        fallbackReason: 'business-analysis-intent-unavailable',
      }),
    };
  }

  /**
   * 生成统一 AI 入口理解快照。
   *
   * 这里把“AI 主链命中”与“规则 fallback 命中”统一落成同一结构，
   * 供分析审计、企业微信帮助兜底和后续治理统计共用。
   */
  private buildEntryInterpretationSnapshot(params: {
    questionText: string;
    intent: AnalysisIntent;
    channel: ChannelType;
    usedFallback: boolean;
    fallbackReason?: string;
  }): AiEntryInterpretationSnapshot {
    const capabilityMetadata = params.intent as AnalysisIntent & {
      packCode?: string;
      packVersion?: string;
      providerCode?: string;
      model?: string;
      validationFailureReason?: string;
    };

    return createAiEntryInterpretationSnapshot({
      channel: params.channel,
      scene:
        params.channel === 'wecom-bot'
          ? 'WECOM_IDLE_MESSAGE'
          : 'WEB_ANALYSIS_QUERY',
      targetWorkflow: this.resolveTargetWorkflow(params.intent),
      originalText: params.questionText,
      intent:
        params.intent.requestedAction === 'BLOCK'
          ? 'BLOCK'
          : 'ANALYZE',
      requestedAction: params.intent.requestedAction,
      confidence: params.intent.confidence,
      usedFallback: params.usedFallback,
      fallbackReason: params.fallbackReason,
      packCode: capabilityMetadata.packCode,
      packVersion: capabilityMetadata.packVersion,
      providerCode: capabilityMetadata.providerCode,
      model: capabilityMetadata.model,
      validationFailureReason: capabilityMetadata.validationFailureReason,
      blockReason: params.intent.blockReason,
      structuredSlots: {
        entryMode: WEB_ANALYSIS_ENTRY_MODE,
        domain: params.intent.domain,
        metrics: params.intent.metrics,
        dimensions: params.intent.dimensions,
        filters: params.intent.filters,
        missingConditions: params.intent.missingConditions,
        resultKindHint: params.intent.resultKindHint,
        queryEntities: params.intent.queryEntities ?? this.detectQueryEntities(params.questionText),
        resultIntent:
          params.intent.resultIntent ??
          this.detectResultIntent(params.questionText, params.intent.resultKindHint),
        timeRangeText:
          params.intent.timeRangeText ??
          (typeof params.intent.filters.timeRange === 'string'
            ? params.intent.filters.timeRange
            : undefined),
        temporalSlot: params.intent.temporalSlot,
        analysisFacetProfile:
          params.intent.analysisFacetProfile ??
          inferAnalysisFacetProfile(params.questionText),
        analysisDepth:
          params.intent.analysisDepth ??
          inferAnalysisDepth(params.questionText),
        analysisFocus:
          params.intent.analysisFocus ??
          resolveAnalysisFocus(params.questionText),
        outputPreference:
          params.intent.outputPreference ??
          resolveAnalysisOutputPreference(params.questionText),
      },
      generatedAt: new Date().toISOString(),
    });
  }

  private resolveTargetWorkflow(intent: AnalysisIntent): AiEntryTargetWorkflow {
    if (intent.requestedAction === 'BLOCK') {
      return 'ANALYSIS_BLOCKED';
    }

    if (intent.missingConditions.length > 0) {
      return 'ANALYSIS_CLARIFICATION';
    }

    return 'ANALYSIS_QUERY_EXECUTION';
  }

  private detectQueryEntities(questionText: string): string[] {
    const entities = new Set<string>();
    if (/(客户|客资|客群|重点客户|战略客户)/u.test(questionText)) {
      entities.add('客户');
    }
    if (/(商机|机会|漏斗|阶段|赢单率)/u.test(questionText)) {
      entities.add('商机');
    }
    if (/(合同|签单|签约|成交|回款|订单|下单|成单)/u.test(questionText)) {
      entities.add(questionText.includes('订单') || questionText.includes('下单') ? '订单' : '合同');
    }
    if (/(回款|到账)/u.test(questionText)) {
      entities.add('回款');
    }
    if (/(负责人|销售|业务员|销售负责人)/u.test(questionText)) {
      entities.add('销售负责人');
    }
    if (/(区域|团队|大区)/u.test(questionText)) {
      entities.add('区域');
    }
    if (/(渠道商|服务商|渠道|伙伴|代理商|经销商)/u.test(questionText)) {
      entities.add('渠道商');
    }
    return [...entities];
  }

  private detectResultIntent(
    questionText: string,
    resultKindHint?: AnalysisIntent['resultKindHint'],
  ): AnalysisResultIntent {
    if (questionText.includes('明细') || questionText.includes('详情')) {
      return 'detail';
    }
    if (questionText.includes('看板') || questionText.includes('报告') || questionText.includes('汇总分析')) {
      return 'summary';
    }
    if (questionText.includes('对比') || questionText.includes('比较')) {
      return 'comparison';
    }
    if (resultKindHint === 'time-trend' || questionText.includes('趋势')) {
      return 'trend';
    }
    if (
      resultKindHint === 'stage-distribution' ||
      resultKindHint === 'category-distribution'
    ) {
      return 'distribution';
    }
    if (questionText.includes('排名') || questionText.includes('排行')) {
      return 'ranking';
    }
    return 'summary';
  }

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
      queryEntities: this.detectQueryEntities(questionText),
      resultIntent: this.detectResultIntent(questionText, 'owner-ranking'),
      analysisFacetProfile: 'generic-analysis',
      analysisDepth: 'snapshot',
      analysisFocus: [],
      outputPreference: [],
    };
  }

  /**
   * 在宽业务 AI 不可用时构造受控只读分析意图。
   *
   * 参数说明：`questionText` 为已经归一化的用户原文。
   * 返回值说明：明确命中 CRM 只读对象时返回宽业务意图；越界、写入或非 CRM 问题返回 `null` 或阻断意图。
   * 调用注意事项：该方法只作为 AI 失败后的主链补偿，不作为优先语义入口；所有结果仍会经过字段能力、权限和 OpenAPI 白名单校验。
   */
  private tryBuildControlledBusinessIntentCompensation(
    questionText: string,
  ): BusinessAnalysisIntent | null {
    const catalogRule = resolveCrmAnalysisQuestionTemplateRuleByText(questionText);
    if (this.isWriteActionQuestion(questionText)) {
      return this.createBusinessBlockedIntent(
        questionText,
        '当前请求包含创建、修改、删除、写入或提醒等动作，不属于受控只读 CRM 分析范围。',
      );
    }

    const objects = this.resolveControlledBusinessObjects(questionText);
    if (catalogRule && this.shouldUseCatalogTemplateCompensation(questionText, objects.length)) {
      return this.createCatalogTemplateBusinessIntent(questionText, catalogRule.templateType);
    }

    if (objects.length === 0) {
      return null;
    }

    const dimensions = this.resolveControlledBusinessDimensions(questionText, objects);
    const metrics = this.resolveControlledBusinessMetrics(questionText, objects);
    const analysisMode = this.resolveControlledBusinessAnalysisMode(questionText);
    const outputPreference = this.resolveControlledBusinessOutputPreference(
      questionText,
      analysisMode,
    );

    return {
      objectTypes: objects,
      metrics,
      dimensions,
      filters: this.resolveControlledBusinessFilters(questionText),
      analysisMode,
      outputPreference,
      comparison: this.resolveControlledBusinessComparison(questionText),
      entities: this.resolveControlledBusinessEntities(questionText, objects),
      confidence: 'MEDIUM',
      missingConditions: [],
      unsupportedHints: [],
      requestedAction: 'READONLY_ANALYSIS',
      blockReason: '',
      normalizedQuestion: questionText,
    };
  }

  /**
   * 根据 300 问模板构造只读业务意图。
   *
   * 参数说明：`questionText` 为用户问题，`templateType` 为已命中的标准分析模板。
   * 返回值说明：返回可进入受控执行链路的宽业务意图。
   * 调用注意事项：该方法只在 AI 不可用且问题已命中标准 300 问目录时使用，事实计算仍由 OpenAPI Markdown 快照主链完成。
   */
  private createCatalogTemplateBusinessIntent(
    questionText: string,
    templateType: import('../../shared/types/domain').CrmAnalysisPresentationTemplateType,
  ): BusinessAnalysisIntent {
    const objectTypes = this.resolveCatalogTemplateBusinessObjects(templateType);
    const dimensions = this.resolveCatalogTemplateBusinessDimensions(templateType);
    const metrics = this.resolveCatalogTemplateBusinessMetrics(templateType);

    return {
      objectTypes,
      metrics,
      dimensions,
      filters: this.resolveControlledBusinessFilters(questionText),
      analysisMode: this.resolveCatalogTemplateAnalysisMode(templateType, questionText),
      outputPreference: ['text_summary', 'table', 'chart', 'html_report'],
      comparison: this.resolveControlledBusinessComparison(questionText),
      entities: this.resolveControlledBusinessEntities(questionText, objectTypes),
      confidence: 'MEDIUM',
      missingConditions: [],
      unsupportedHints: [],
      requestedAction: 'READONLY_ANALYSIS',
      blockReason: '',
      normalizedQuestion: questionText,
    };
  }

  /**
   * 判断是否应使用 300 问目录补偿。
   *
   * 参数说明：`questionText` 为用户问题，`objectCount` 为普通 CRM 对象解析结果数量。
   * 返回值说明：强模板命中或无明确对象但存在 CRM 管理语境时返回 `true`。
   * 调用注意事项：单个弱关键词如“山东”“客户”“明天”不能直接接管普通问法，避免域外问题和通用 CRM 问法误入目录模板。
   */
  private shouldUseCatalogTemplateCompensation(
    questionText: string,
    objectCount: number,
  ): boolean {
    const catalogRule = resolveCrmAnalysisQuestionTemplateRuleByText(questionText);
    if (!catalogRule) {
      return false;
    }

    const normalizedText = questionText.trim().toLowerCase();
    const catalogScore = scoreCrmAnalysisQuestionTemplateRule(catalogRule, normalizedText);
    if (catalogScore >= 10) {
      return true;
    }

    if (this.hasCrmCatalogManagementContext(questionText)) {
      return true;
    }

    return objectCount === 0 && this.hasCrmManagementContext(questionText);
  }

  /**
   * 判断文本是否属于 300 问目录中的管理治理型问法。
   *
   * 参数说明：`questionText` 为用户原文。
   * 返回值说明：包含通知、审计、看板、规则、筛选等目录特征时返回 `true`。
   */
  private hasCrmCatalogManagementContext(questionText: string): boolean {
    return /(通知中心|提醒|审计|日志|筛选|到期天数|经营看板|风险提醒|是否应|是否需要|是否能|系统是否|规则|机制|看板|策略|目标|复盘|日报|周报|月报|汇报|权限|字段|数据可见性|数据质量|管理|治理|健康度|自动发现|主动告诉|任务清单)/u.test(
      questionText,
    );
  }

  /**
   * 判断文本是否具备 CRM 管理分析语境。
   *
   * 参数说明：`questionText` 为用户原文。
   * 返回值说明：包含经营、渠道、风险、目标、负责人等管理词时返回 `true`。
   */
  private hasCrmManagementContext(questionText: string): boolean {
    return /(CRM|客户|报备|商机|报价|订单|渠道|服务商|合作伙伴|产品|价格|工作量|经营|业务|风险|目标|负责人|责任人|推进|转化|增长|复盘|日报|周报|月报|汇报|看板|权限|字段|审计|通知|提醒|筛选|到期天数)/iu.test(
      questionText,
    );
  }

  /**
   * 根据模板类型推导受控分析对象。
   *
   * 参数说明：`templateType` 为 300 问标准模板类型。
   * 返回值说明：返回宽业务意图对象数组。
   */
  private resolveCatalogTemplateBusinessObjects(
    templateType: import('../../shared/types/domain').CrmAnalysisPresentationTemplateType,
  ): BusinessObjectType[] {
    if (templateType === 'OPPORTUNITY_RISK') {
      return ['opportunity', 'quote', 'partner'];
    }

    if (templateType === 'QUOTE_ORDER_CONVERSION' || templateType === 'PRODUCT_SOLUTION_STRUCTURE') {
      return ['quote', 'order', 'opportunity', 'partner'];
    }

    if (templateType === 'CUSTOMER_SUCCESS_RENEWAL') {
      return ['customer', 'registration', 'opportunity', 'quote', 'order'];
    }

    return ['partner', 'registration', 'opportunity', 'quote', 'order'];
  }

  /**
   * 根据模板类型推导展示维度。
   *
   * 参数说明：`templateType` 为 300 问标准模板类型。
   * 返回值说明：返回宽业务意图维度数组。
   */
  private resolveCatalogTemplateBusinessDimensions(
    templateType: import('../../shared/types/domain').CrmAnalysisPresentationTemplateType,
  ): BusinessDimension[] {
    const commonDimensions: BusinessDimension[] = ['partner', 'region', 'month', 'status'];
    if (templateType === 'REGION_COMPARISON') {
      return ['big_region', 'region', 'partner', 'month'];
    }

    if (templateType === 'DISTRIBUTION_HIERARCHY') {
      return ['partner_level', 'partner', 'region', 'status'];
    }

    if (templateType === 'TECH_SERVICE_ECOSYSTEM') {
      return ['is_technical_service_provider', 'region', 'partner', 'stage'];
    }

    if (templateType === 'OPPORTUNITY_RISK') {
      return ['stage', 'owner', 'partner', 'month'];
    }

    if (templateType === 'OWNER_ORG_COLLABORATION') {
      return ['owner', 'department', 'region', 'partner'];
    }

    return commonDimensions;
  }

  /**
   * 根据模板类型推导核心指标。
   *
   * 参数说明：`templateType` 为 300 问标准模板类型。
   * 返回值说明：返回宽业务意图指标数组。
   */
  private resolveCatalogTemplateBusinessMetrics(
    templateType: import('../../shared/types/domain').CrmAnalysisPresentationTemplateType,
  ): BusinessMetric[] {
    const chainMetrics: BusinessMetric[] = [
      'partner_count',
      'registration_count',
      'opportunity_count',
      'opportunity_amount',
      'quote_count',
      'quote_amount',
      'order_count',
      'order_amount',
      'conversion_rate',
    ];
    if (templateType === 'TECH_SERVICE_ECOSYSTEM') {
      return ['partner_count', 'technical_partner_count', 'opportunity_count', 'quote_count', 'order_count', 'order_amount'];
    }

    if (templateType === 'OPPORTUNITY_RISK') {
      return ['opportunity_count', 'opportunity_amount', 'stale_opportunity_count', 'quote_count'];
    }

    return chainMetrics;
  }

  /**
   * 根据模板类型推导分析形态。
   *
   * 参数说明：`templateType` 为 300 问标准模板类型，`questionText` 为用户原文。
   * 返回值说明：返回宽业务分析模式。
   */
  private resolveCatalogTemplateAnalysisMode(
    templateType: import('../../shared/types/domain').CrmAnalysisPresentationTemplateType,
    questionText: string,
  ): BusinessAnalysisMode {
    if (templateType === 'OPPORTUNITY_RISK' || templateType === 'ALERT_AUDIT_GOVERNANCE') {
      return 'risk_analysis';
    }

    if (/(趋势|最近|连续|周期|同比|环比)/u.test(questionText)) {
      return 'trend';
    }

    if (/(对比|比较|差异|是否均衡|贡献最大|排名|排行)/u.test(questionText)) {
      return 'comparison';
    }

    return 'summary_report';
  }

  /**
   * 识别写入或越权动作。
   *
   * 参数说明：`questionText` 为用户原文。
   * 返回值说明：命中创建、修改、删除、保存、提醒等动作时返回 `true`。
   * 调用注意事项：避免把“新增商机金额/新增渠道商统计”这类只读指标误判为写入动作。
   */
  private isWriteActionQuestion(questionText: string): boolean {
    if (
      /^(是否|能否|需不需要|要不要|应该|当前|哪些|哪个|什么|如何|有多少|是否存在)/u.test(questionText) &&
      !/(帮我|请|提醒我|通知我)/u.test(questionText)
    ) {
      return false;
    }

    if (
      /(创建了多长时间|创建时长|创建多久|创建.*天|创建.*时间|新增商机金额|新增数量|新增情况|增长)|新增(渠道商|客户|订单|报备).*(情况|数量|金额|统计|分析|趋势|增长)|(情况|数量|金额|统计|分析|趋势|增长).*新增(渠道商|客户|订单|报备)/u.test(
        questionText,
      )
      || /(创建|新增).{0,6}(首次|第一笔|第一次).{0,12}(报备|商机|报价|订单|下单)/u.test(questionText)
    ) {
      return false;
    }

    return /((帮我|请|把|将).*(创建|新建|新增|添加|保存|写入|修改|更新|删除|作废|改成|设为|提醒|通知))|^(创建|新建|新增|添加|保存|写入|修改|更新|删除|作废|提醒)(一个|一条|到|至|为|成)?/u.test(
      questionText,
    );
  }

  /**
   * 解析受控补偿链路中的 CRM 对象。
   *
   * 参数说明：`questionText` 为用户原文。
   * 返回值说明：返回合作伙伴、报备、商机、报价、订单等宽业务对象。
   * 调用注意事项：只把用户已经明确提到或服务商经营默认需要的对象纳入主链，避免单商机问题被扩成综合经营报告。
   */
  private resolveControlledBusinessObjects(questionText: string): BusinessObjectType[] {
    const hasPartner = /(合作伙伴|服务商|渠道商|渠道|代理商|经销商|伙伴)/u.test(questionText);
    const hasRegistration = /(客户商机报备|客户报备|报备情况|报备)/u.test(questionText);
    const hasOpportunity = /(商机|机会)/u.test(questionText);
    const hasQuote = /(报价|报价单)/u.test(questionText);
    const hasOrder = /(订单|下单|成单|签单|成交)/u.test(questionText) && !hasQuote;
    const isPartnerOperating = hasPartner && /(经营|运营|贡献|业绩|产出|整体情况|经营情况|业务情况|下单情况|看板)/u.test(
      questionText,
    );
    const objectSet = new Set<BusinessObjectType>();

    if (hasPartner) {
      objectSet.add('partner');
    }
    if (hasRegistration || isPartnerOperating) {
      objectSet.add('registration');
      objectSet.add('partner');
    }
    if (hasOpportunity || hasRegistration || isPartnerOperating) {
      objectSet.add('opportunity');
      objectSet.add('partner');
    }
    if (hasQuote) {
      objectSet.add('quote');
      objectSet.add('partner');
    }
    if (hasOrder || isPartnerOperating) {
      objectSet.add('order');
      objectSet.add('partner');
    }

    return [...objectSet];
  }

  /**
   * 解析受控补偿链路中的指标。
   *
   * 参数说明：`questionText` 为用户原文，`objects` 为已识别的 CRM 对象。
   * 返回值说明：返回宽业务指标数组，覆盖两个 HTML 模板需要的规模、金额和贡献口径。
   */
  private resolveControlledBusinessMetrics(
    questionText: string,
    objects: BusinessObjectType[],
  ): BusinessMetric[] {
    const objectSet = new Set(objects);
    const metrics = new Set<BusinessMetric>();

    if (objectSet.has('partner')) {
      metrics.add('partner_count');
      if (/(技术服务|证书|认证|等级|级别|发展|开拓|运营|看板)/u.test(questionText)) {
        metrics.add('technical_partner_count');
      }
    }
    if (objectSet.has('registration')) {
      metrics.add('registration_count');
      if (/(未关联|没有形成|未形成|未转商机|未建商机)/u.test(questionText)) {
        metrics.add('unlinked_customer_count');
      }
    }
    if (objectSet.has('opportunity')) {
      metrics.add('opportunity_count');
      metrics.add('opportunity_amount');
      if (/(没有进展|没进展|未进展|停滞|未更新|无跟进|风险|超期|逾期)/u.test(questionText)) {
        metrics.add('stale_opportunity_count');
      }
    }
    if (objectSet.has('quote')) {
      metrics.add('quote_count');
      metrics.add('quote_amount');
    }
    if (objectSet.has('order') || objectSet.has('contract')) {
      metrics.add('order_count');
      metrics.add('order_amount');
      metrics.add('total_amount');
      if (/(集中度|TOP|top|排名|排行|汇总分析|看板)/u.test(questionText)) {
        metrics.add('concentration_ratio');
      }
    }

    if (metrics.size === 0) {
      metrics.add('count');
    }

    return [...metrics];
  }

  /**
   * 解析受控补偿链路中的维度。
   *
   * 参数说明：`questionText` 为用户原文，`objects` 为已识别对象。
   * 返回值说明：返回渠道商、阶段、状态、区域、月份等稳定维度。
   * 调用注意事项：月份只在用户明确要趋势、按月或年度看板时加入，避免“最近三个月”被误解为趋势图。
   */
  private resolveControlledBusinessDimensions(
    questionText: string,
    objects: BusinessObjectType[],
  ): BusinessDimension[] {
    const objectSet = new Set(objects);
    const dimensions = new Set<BusinessDimension>();

    if (
      objectSet.has('partner') ||
      objectSet.has('registration') ||
      objectSet.has('opportunity') ||
      objectSet.has('quote') ||
      objectSet.has('order')
    ) {
      dimensions.add('partner');
    }
    if (/(区域|大区|省|城市|广州办|山东|华东|华南|华北|华中|西南|西北|东北|大北|大东|大南|大西)/u.test(questionText)) {
      dimensions.add(/大区|大北|大东|大南|大西/u.test(questionText) ? 'big_region' : 'region');
    }
    if (/(负责人|销售|业务员|跟进人|归属人)/u.test(questionText)) {
      dimensions.add('owner');
    }
    if (objectSet.has('opportunity')) {
      dimensions.add('stage');
    }
    if (/(状态|分布|结构|保护期|到期)/u.test(questionText)) {
      dimensions.add('status');
    }
    if (/(等级|级别|金牌|LEP|提名)/iu.test(questionText)) {
      dimensions.add('partner_level');
    }
    if (/(技术服务|证书|认证)/u.test(questionText)) {
      dimensions.add('is_technical_service_provider');
    }
    if (/(季度|按季|季报|一季度|二季度|三季度|四季度|Q[1-4])/iu.test(questionText)) {
      dimensions.add('quarter');
    }
    if (/(趋势|走势|按月|月度|年度|近3年|近三年|最近一年|同比|环比|看板|汇总分析)/u.test(questionText)) {
      dimensions.add(/年度|近3年|近三年|最近一年/u.test(questionText) ? 'year' : 'month');
    }

    return [...dimensions];
  }

  /**
   * 解析受控补偿链路中的分析形态。
   *
   * 参数说明：`questionText` 为用户原文。
   * 返回值说明：返回宽业务分析模式，用于报告和任务编排。
   */
  private resolveControlledBusinessAnalysisMode(questionText: string): BusinessAnalysisMode {
    if (/(看板|驾驶舱|仪表盘)/u.test(questionText)) {
      return 'dashboard';
    }
    // 修复：当用户在追问/抱怨中提到"趋势"且"明细"出现在否定/转折语境时，
    // 说明用户实际想要的是趋势分析而非明细列表
    // 典型场景："你并没有分析趋势，你只是给我列出了明细"
    if (
      /(趋势|走势)/u.test(questionText) &&
      /(并没有|只是|不是|不要|而非|而不是|却|没有)/u.test(questionText) &&
      /(明细|详情|清单|列表|条目)/u.test(questionText)
    ) {
      return 'trend';
    }
    if (/(对比|比较|差异|分别|相比|一季度.*二季度|二季度.*一季度|Q1.*Q2|Q2.*Q1)/iu.test(questionText)) {
      return 'comparison';
    }
    // detail 判断提到 summary_report 之前，因为"列出/条目/表格"是更具体的明细意图
    // 修复：补充"列出|条目|表格呈现|表格方式|用表格|列成表格|逐条|每条"等用户自然表达
    if (/(明细|详情|清单|列表|列出|条目|表格呈现|表格方式|用表格|列成表格|成表格|表格形式|逐条|每条|逐个|一个个)/u.test(questionText)) {
      return 'detail';
    }
    // summary_report 去掉过于宽泛的"分析"，改为"汇总分析"精确匹配
    // 修复："所有商机分析"不应一律判为 summary_report，让"分析"单独出现时走默认
    if (/(汇总分析|汇总报告|经营建议|运营建议|建议|整体|全部|当前|情况)/u.test(questionText)) {
      return 'summary_report';
    }
    if (/(趋势|走势|按月|月度|年度|同比|环比)/u.test(questionText)) {
      return 'trend';
    }
    if (/(排名|排行|TOP|top|前\d+)/u.test(questionText)) {
      return 'ranking';
    }
    if (/(分布|结构|占比|集中度)/u.test(questionText)) {
      return 'distribution';
    }

    return 'summary_report';
  }

  /**
   * 解析受控补偿链路中的展示偏好。
   *
   * 参数说明：`questionText` 为用户原文，`analysisMode` 为分析形态。
   * 返回值说明：返回文字、表格、图表和 HTML 报告偏好，不再默认要求企微图片。
   */
  private resolveControlledBusinessOutputPreference(
    questionText: string,
    analysisMode: BusinessAnalysisMode,
  ): BusinessOutputPreference[] {
    const preferences = new Set<BusinessOutputPreference>(['text_summary', 'table', 'html_report']);
    if (
      analysisMode === 'dashboard' ||
      analysisMode === 'trend' ||
      analysisMode === 'comparison' ||
      /(图表|看板|趋势|走势|对比|比较|差异|相比|季度|分布|结构|占比|集中度|汇总分析)/u.test(questionText)
    ) {
      preferences.add('chart');
    }
    if (/(导出|Excel|excel|文件)/u.test(questionText)) {
      preferences.add('export_file');
    }

    return [...preferences];
  }

  /**
   * 解析受控补偿链路中的比较口径。
   *
   * 参数说明：`questionText` 为用户原文。
   * 返回值说明：返回 TOP、同比环比、集中度或漏斗等比较偏好。
   */
  private resolveControlledBusinessComparison(
    questionText: string,
  ): BusinessAnalysisIntent['comparison'] {
    const comparison = new Set<BusinessAnalysisIntent['comparison'][number]>();
    if (/(TOP|top|排名|排行|前\d+)/u.test(questionText)) {
      comparison.add('top_n');
    }
    if (/(同比|去年|年度对比)/u.test(questionText)) {
      comparison.add('year_over_year');
    }
    if (/(环比|上月|月度对比)/u.test(questionText)) {
      comparison.add('month_over_month');
    }
    if (/(季度对比|按季对比|一季度.*二季度|二季度.*一季度|Q1.*Q2|Q2.*Q1)/iu.test(questionText)) {
      comparison.add('period_over_period');
    }
    if (/(集中度|头部|长尾)/u.test(questionText)) {
      comparison.add('concentration');
    }
    if (/(漏斗|转化|报备.*商机.*订单|客户.*商机.*订单)/u.test(questionText)) {
      comparison.add('funnel');
    }

    return [...comparison];
  }

  /**
   * 解析受控补偿链路中的筛选条件。
   *
   * 参数说明：`questionText` 为用户原文。
   * 返回值说明：目前仅抽取稳定区域筛选，其他复杂条件交给 OpenAPI 主链和报告层表达。
   */
  private resolveControlledBusinessFilters(
    questionText: string,
  ): BusinessAnalysisIntent['filters'] {
    const region = this.extractRegionEntity(questionText);
    if (!region) {
      return [];
    }

    return [
      {
        field: 'region',
        operator: 'contains',
        value: region,
        label: `${region}区域`,
      },
    ];
  }

  /**
   * 解析受控补偿链路中的业务实体。
   *
   * 参数说明：`questionText` 为用户原文，`objects` 为已识别对象。
   * 返回值说明：返回对象实体和区域实体，供审计快照和报告文案使用。
   */
  private resolveControlledBusinessEntities(
    questionText: string,
    objects: BusinessObjectType[],
  ): BusinessAnalysisIntent['entities'] {
    const entities: BusinessAnalysisIntent['entities'] = objects.map((objectType) => ({
      type: objectType,
      value: this.resolveBusinessObjectLabel(objectType),
    }));
    const region = this.extractRegionEntity(questionText);
    if (region) {
      entities.push({
        type: 'region',
        value: region,
      });
    }

    return entities;
  }

  /**
   * 提取常见区域实体。
   *
   * 参数说明：`questionText` 为用户原文。
   * 返回值说明：返回“广州”“山东”“华东”等区域词；未命中返回 `undefined`。
   * 调用注意事项：这里只做高置信地区表达抽取，避免把“公司当前”等普通词误当区域。
   */
  private extractRegionEntity(questionText: string): string | undefined {
    const explicitRegion = questionText.match(/(大北区|大东区|大南区|大西区|大北|大东|大南|大西|华东|华南|华北|华中|西南|西北|东北|山东|广州|深圳|北京|上海|江苏|浙江|广东|四川|湖南|湖北|河南|河北|福建|安徽|江西|广西|云南|贵州|陕西|山西|辽宁|吉林|黑龙江|内蒙古|新疆|甘肃|宁夏|青海|海南|天津|重庆)(?:办|区域|区|大区|省|市)?/u)?.[1];
    if (explicitRegion) {
      return explicitRegion;
    }

    return undefined;
  }

  /**
   * 将宽业务对象转成中文标签。
   *
   * 参数说明：`objectType` 为宽业务对象。
   * 返回值说明：返回业务用户可读标签。
   */
  private resolveBusinessObjectLabel(objectType: BusinessObjectType): string {
    const labels: Record<BusinessObjectType, string> = {
      opportunity: '商机',
      registration: '客户报备',
      quote: '报价',
      order: '订单',
      partner: '合作伙伴',
      customer: '客户',
      contract: '合同',
      payment: '回款',
    };
    return labels[objectType];
  }

  /**
   * 构造宽业务阻断意图。
   *
   * 参数说明：`questionText` 为用户原文，`blockReason` 为阻断原因。
   * 返回值说明：返回宽业务层阻断结构，后续由统一映射器转为 AnalysisIntent。
   */
  private createBusinessBlockedIntent(
    questionText: string,
    blockReason: string,
  ): BusinessAnalysisIntent {
    return {
      objectTypes: [],
      metrics: [],
      dimensions: [],
      filters: [],
      analysisMode: 'summary_report',
      outputPreference: [],
      comparison: [],
      entities: [],
      confidence: 'LOW',
      missingConditions: [],
      unsupportedHints: [],
      requestedAction: 'BLOCK',
      blockReason,
      normalizedQuestion: questionText,
    };
  }
}

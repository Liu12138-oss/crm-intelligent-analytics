import { Injectable, Logger } from '@nestjs/common';
import type {
  AnalysisIntent,
  AnalysisQueryTask,
  AnalysisTaskPurpose,
  AnalysisWorkflowPlan,
  ChannelType,
  QueryPlanResultKind,
} from '../../shared/types/domain';
import { buildEntityId } from '../../shared/utils/id.util';
import { UnsupportedQuestionError } from './analysis.errors';
import { QueryCompilerService } from './query-compiler.service';
import {
  getAnalysisTopicReportProfile,
  inferAnalysisDepth,
  inferAnalysisFacetProfile,
  resolveAnalysisOutputPreference,
  resolveAnalysisFocus,
  resolveTopicTaskTemplates,
  type AnalysisTopicTaskTemplate,
} from './analysis-topic-report.registry';

interface PlannedTaskDescriptor {
  title: string;
  description: string;
  resultKind: QueryPlanResultKind;
  purpose: AnalysisTaskPurpose;
  required: boolean;
  reportSection: NonNullable<AnalysisQueryTask['reportSection']>;
  rowLimit?: number;
  intentOverride?: Partial<AnalysisIntent>;
}

interface BusinessChainObjectSignals {
  hasPartner: boolean;
  hasRegistration: boolean;
  hasOpportunity: boolean;
  hasOrder: boolean;
}

@Injectable()
export class AnalysisQueryPlannerService {
  private readonly logger = new Logger('CRMQueryPlanner');
  private readonly maxTaskCount = 8;

  constructor(private readonly queryCompilerService: QueryCompilerService) {}

  buildWorkflow(
    questionText: string,
    intent: AnalysisIntent,
    channel: ChannelType,
  ): AnalysisWorkflowPlan {
    const effectiveIntent = this.normalizeIntentForWorkflow(questionText, intent);
    const analysisFacetProfile =
      effectiveIntent.analysisFacetProfile ?? inferAnalysisFacetProfile(questionText);
    const analysisDepth = effectiveIntent.analysisDepth ?? inferAnalysisDepth(questionText);
    const analysisFocus = resolveAnalysisFocus(questionText, effectiveIntent.analysisFocus);
    const outputPreference = resolveAnalysisOutputPreference(
      questionText,
      effectiveIntent.outputPreference ?? effectiveIntent.businessIntentHint?.outputPreference,
    );
    this.logger.debug('查询计划开始构建', {
      channel,
      domain: effectiveIntent.domain,
      resultKindHint: effectiveIntent.resultKindHint,
      analysisFacetProfile,
      analysisDepth,
    });
    const taskDescriptors = this.resolveTaskDescriptors({
      questionText,
      intent: effectiveIntent,
      channel,
      analysisFacetProfile,
      analysisDepth,
      analysisFocus,
      outputPreference,
    });
    if (taskDescriptors.length > this.maxTaskCount) {
      this.logger.error('查询计划任务数超限', {
        count: taskDescriptors.length,
        max: this.maxTaskCount,
        question: questionText,
      });
      throw new UnsupportedQuestionError('当前主题报告包含过多分析步骤，请缩小范围后重试。');
    }

    const tasks = taskDescriptors.map((item, index) => this.createTask(effectiveIntent, item, index));

    this.logger.log('查询计划构建完成', {
      channel,
      workflowId: '',
      taskCount: tasks.length,
      purposes: tasks.map((task) => task.purpose),
      resultKindHints: tasks.map((task) => task.plan?.resultKind).filter(Boolean),
    });

    return {
      workflowId: buildEntityId('workflow'),
      channel,
      questionText,
      normalizedQuestion: effectiveIntent.normalizedQuestion,
      domain: effectiveIntent.domain,
      temporalSlot: effectiveIntent.temporalSlot,
      confidence: effectiveIntent.confidence,
      requestedAction: effectiveIntent.requestedAction,
      missingConditions: effectiveIntent.missingConditions,
      analysisFacetProfile,
      analysisDepth,
      analysisFocus,
      outputPreference,
      tasks,
    };
  }

  private resolveTaskDescriptors(params: {
    questionText: string;
    intent: AnalysisIntent;
    channel: ChannelType;
    analysisFacetProfile: NonNullable<AnalysisWorkflowPlan['analysisFacetProfile']>;
    analysisDepth: NonNullable<AnalysisWorkflowPlan['analysisDepth']>;
    analysisFocus: NonNullable<AnalysisWorkflowPlan['analysisFocus']>;
    outputPreference: NonNullable<AnalysisWorkflowPlan['outputPreference']>;
  }): PlannedTaskDescriptor[] {
    if (this.isPartnerProfileQuestion(params.questionText, params.intent)) {
      return this.applyPreferenceDrivenTaskDescriptors([
        {
          title: this.resolvePartnerProfileTaskTitle(params.questionText),
          description: '用于服务商画像统计的渠道商主数据切片。',
          resultKind: 'partner-contribution',
          purpose: 'primary-summary',
          required: true,
          reportSection: 'detail-table',
        },
      ], params);
    }

    if (this.isChannelContributionRankingQuestion(params.questionText)) {
      return this.applyPreferenceDrivenTaskDescriptors([
        {
          title: `渠道贡献${this.formatTopNLabel(this.resolveTopN(params.questionText) ?? 10)}排名`,
          description: '按渠道商维度聚合报备、商机、报价和订单贡献，避免把经营区块当作渠道排行。',
          resultKind: 'partner-contribution',
          purpose: 'primary-summary',
          required: true,
          reportSection: 'detail-table',
          rowLimit: this.resolveTopN(params.questionText) ?? 10,
          intentOverride: {
            domain: 'opportunity-analysis',
            metrics: ['新增商机金额', '商机数量'],
            dimensions: ['渠道商'],
            resultKindHint: 'partner-contribution',
          },
        },
      ], params);
    }

    if (this.isBusinessFunnelQuestion(params.questionText)) {
      return this.applyPreferenceDrivenTaskDescriptors([
        {
          title: '报备到订单转化漏斗',
          description: '读取报备、商机、报价和订单主链路数据，输出四段漏斗和断点口径。',
          resultKind: 'partner-contribution',
          purpose: 'primary-summary',
          required: true,
          reportSection: 'summary',
          intentOverride: {
            domain: 'opportunity-analysis',
            metrics: ['客户贡献度'],
            dimensions: ['渠道商'],
            resultKindHint: 'partner-contribution',
          },
        },
      ], params);
    }

    if (this.isCompositeBusinessChainQuestion(params.questionText, params.intent)) {
      return this.applyPreferenceDrivenTaskDescriptors(
        this.resolveCompositeBusinessChainTaskDescriptors(params.questionText, params.intent),
        params,
      );
    }

    if (this.isOpportunityOverviewQuestion(params.questionText, params.intent)) {
      return this.applyPreferenceDrivenTaskDescriptors(
        this.resolveOpportunityOverviewTaskDescriptors(),
        params,
      );
    }

    if (params.intent.domain === 'contract-conversion') {
      return this.applyPreferenceDrivenTaskDescriptors(
        this.resolveContractTaskDescriptors(params.questionText, params.intent),
        params,
      );
    }

    const topicProfile = getAnalysisTopicReportProfile(params.analysisFacetProfile);
    if (!topicProfile || params.analysisFacetProfile === 'generic-analysis') {
      return this.applyPreferenceDrivenTaskDescriptors(
        this.resolveLegacyTaskDescriptors(params.questionText, params.intent),
        params,
      );
    }

    const templates = resolveTopicTaskTemplates({
      facetProfile: params.analysisFacetProfile,
      analysisDepth: params.analysisDepth,
      analysisFocus: params.analysisFocus,
      channel: params.channel,
    });
    if (templates.length === 0) {
      return this.applyPreferenceDrivenTaskDescriptors(
        this.resolveLegacyTaskDescriptors(params.questionText, params.intent),
        params,
      );
    }

    return this.applyPreferenceDrivenTaskDescriptors(
      templates.map((item) => ({
        title: this.resolveTemplateTitle(params.intent, item),
        description: item.description,
        resultKind: item.resultKind,
        purpose: item.purpose,
        required: item.required,
        reportSection: item.reportSection,
      })),
      params,
    );
  }

  private resolveLegacyTaskDescriptors(
    questionText: string,
    intent: AnalysisIntent,
  ): PlannedTaskDescriptor[] {
    const tasks: PlannedTaskDescriptor[] = [];
    const primaryResultKind = intent.resultKindHint ?? this.resolveFallbackResultKind(intent);
    const pushUniqueTask = (
      resultKind: QueryPlanResultKind,
      purpose: AnalysisTaskPurpose,
      reportSection: NonNullable<AnalysisQueryTask['reportSection']>,
      required = false,
    ): void => {
      if (tasks.some((item) => item.resultKind === resultKind && item.purpose === purpose)) {
        return;
      }

      const title = this.resolveTaskTitle(intent, resultKind, purpose);
      tasks.push({
        title,
        description: `用于${this.resolvePurposeLabel(purpose)}的${title}`,
        resultKind,
        purpose,
        required,
        reportSection,
      });
    };

    pushUniqueTask(primaryResultKind, 'primary-summary', 'detail-table', true);

    if (
      primaryResultKind !== 'time-trend' &&
      primaryResultKind !== 'partner-contribution' &&
      (questionText.includes('趋势') || intent.dimensions.includes('月份'))
    ) {
      pushUniqueTask('time-trend', 'trend-series', 'trend');
    }

    if (
      primaryResultKind !== 'owner-ranking' &&
      primaryResultKind !== 'partner-contribution' &&
      (questionText.includes('排名') || questionText.includes('排行'))
    ) {
      pushUniqueTask('owner-ranking', 'primary-summary', 'detail-table', true);
    }

    if (intent.dimensions.includes('商机阶段')) {
      pushUniqueTask('stage-distribution', 'distribution', 'distribution');
    }

    if (intent.dimensions.includes('客户分类') || intent.domain === 'customer-relationship') {
      pushUniqueTask('category-distribution', 'distribution', 'distribution');
    }

    if (questionText.includes('明细') || questionText.includes('详情')) {
      pushUniqueTask(
        intent.resultKindHint ?? this.resolveFallbackResultKind(intent),
        'detail-table',
        'detail-table',
      );
    }

    return tasks.slice(0, 3);
  }

  /**
   * 根据用户追加的分析内容和呈现偏好补充可选任务。
   *
   * 参数说明：
   * - `baseTasks`：主语义已经确定的任务列表；
   * - `params`：包含原始问题、结构化意图、分析重点和呈现偏好。
   * 返回值说明：返回去重后的任务列表，最多不超过 `maxTaskCount`。
   * 调用注意事项：这里只把偏好映射到已有受控 resultKind，不允许 AI 或用户输入直接生成 SQL。
   */
  private applyPreferenceDrivenTaskDescriptors(
    baseTasks: PlannedTaskDescriptor[],
    params: {
      questionText: string;
      intent: AnalysisIntent;
      analysisFocus: NonNullable<AnalysisWorkflowPlan['analysisFocus']>;
      outputPreference: NonNullable<AnalysisWorkflowPlan['outputPreference']>;
    },
  ): PlannedTaskDescriptor[] {
    if (!this.hasFlexibleAnalysisCustomizationSignal(params.questionText)) {
      return baseTasks.slice(0, this.maxTaskCount);
    }

    const tasks = [...baseTasks];
    const focusSet = new Set(params.analysisFocus);
    const preferenceSet = new Set(params.outputPreference);
    const addTask = (
      resultKind: QueryPlanResultKind,
      purpose: AnalysisTaskPurpose,
      reportSection: NonNullable<AnalysisQueryTask['reportSection']>,
      required = false,
      intentOverride?: Partial<AnalysisIntent>,
    ): void => {
      if (tasks.length >= this.maxTaskCount) {
        return;
      }

      const duplicate = tasks.some((item) => item.resultKind === resultKind);
      if (duplicate) {
        return;
      }

      const title = this.resolveTaskTitle(params.intent, resultKind, purpose);
      tasks.push({
        title,
        description: `根据用户追加要求补充${this.resolvePurposeLabel(purpose)}，仍通过联软 OpenAPI 受控查询执行。`,
        resultKind,
        purpose,
        required,
        reportSection,
        intentOverride,
      });
    };

    if (focusSet.has('trend') || preferenceSet.has('chart')) {
      addTask('time-trend', 'trend-series', 'trend');
    }

    if (focusSet.has('structure') || /(阶段|分布|结构|漏斗|占比|集中度)/u.test(params.questionText)) {
      const distributionKind: QueryPlanResultKind =
        params.intent.domain === 'customer-relationship'
          ? 'category-distribution'
          : 'stage-distribution';
      addTask(distributionKind, 'distribution', 'distribution');
    }

    if (focusSet.has('risk')) {
      addTask('risk-overview', 'risk-observation', 'risk', false, {
        domain: 'opportunity-analysis',
        resultKindHint: 'risk-overview',
      });
    }

    if (focusSet.has('region')) {
      addTask('department-contribution', 'focus-contribution', 'focus-list');
    }

    if (focusSet.has('ranking') && !tasks.some((item) =>
      item.resultKind === 'owner-ranking' || item.resultKind === 'partner-contribution',
    )) {
      addTask('owner-ranking', 'detail-table', 'detail-table');
    }

    if (focusSet.has('detail') || preferenceSet.has('table')) {
      const detailKind = params.intent.resultKindHint ?? this.resolveFallbackResultKind(params.intent);
      if (!tasks.some((item) => item.resultKind === detailKind)) {
        addTask(detailKind, 'detail-table', 'detail-table');
      }
    }

    return tasks.slice(0, this.maxTaskCount);
  }

  /**
   * 判断用户是否明确要求追加分析内容或指定呈现方式。
   *
   * 参数说明：`questionText` 为用户原始问题。
   * 返回值说明：只有出现“再加/补充/用图表呈现”等明确表达时返回 true。
   * 调用注意事项：普通“分析一下/情况/最近三个月”不触发扩展，避免破坏轻量问数旧体验。
   */
  private hasFlexibleAnalysisCustomizationSignal(questionText: string): boolean {
    return /(再加|加上|补充|顺便|同时看|另外看|也看|展开|重点看|用.*呈现|以.*呈现|按.*呈现|做成|生成.*图表|表格和图表|图表呈现|表格呈现|完整报告|导出|Excel)/iu.test(
      questionText,
    );
  }

  private createTask(
    intent: AnalysisIntent,
    task: PlannedTaskDescriptor,
    index: number,
  ): AnalysisQueryTask {
    const plan = this.queryCompilerService.buildPlanForResultKind(
      this.normalizeIntentForTask(this.applyTaskIntentOverride(intent, task), task),
      task.resultKind,
    );
    if (task.rowLimit) {
      plan.filters = {
        ...plan.filters,
        rowLimit: task.rowLimit,
      };
    }

    return {
      id: buildEntityId(`task-${index + 1}`),
      title: task.title,
      description: task.description,
      purpose: task.purpose,
      required: task.required,
      reportSection: task.reportSection,
      plan,
    };
  }

  /**
   * 应用组合经营任务的对象级意图覆盖。
   *
   * 参数说明：
   * - `intent`：宽业务入口映射后的原始意图。
   * - `task`：当前任务描述，可能携带对象域、指标和维度覆盖。
   * 返回值说明：返回只影响当前任务的意图副本。
   * 调用注意事项：权限范围、时间范围和原始业务语义提示必须沿用原意图，不能在任务拆分时丢失。
   */
  private applyTaskIntentOverride(
    intent: AnalysisIntent,
    task: PlannedTaskDescriptor,
  ): AnalysisIntent {
    if (!task.intentOverride) {
      return intent;
    }

    return {
      ...intent,
      ...task.intentOverride,
      filters: {
        ...intent.filters,
        ...(task.intentOverride.filters ?? {}),
      },
      temporalSlot: task.intentOverride.temporalSlot ?? intent.temporalSlot,
      businessIntentHint: intent.businessIntentHint,
    };
  }

  /**
   * 识别合作伙伴、客户报备/商机和订单同时出现的综合经营问题。
   *
   * 参数说明：`questionText` 为用户原文，`intent` 为宽业务映射后的意图。
   * 返回值说明：命中至少两个业务链对象时返回 true。
   * 调用注意事项：该判断只负责多对象任务拆分，不使用关键词生成可执行旧意图。
   */
  private isCompositeBusinessChainQuestion(
    questionText: string,
    intent: AnalysisIntent,
  ): boolean {
    const signals = this.resolveBusinessChainObjectSignals(questionText, intent);
    if (signals.hasPartner && this.isPartnerOperatingChainQuestion(questionText)) {
      return true;
    }

    return signals.hasPartner && signals.hasOrder && (signals.hasRegistration || signals.hasOpportunity);
  }

  /**
   * 生成综合经营问题的 OpenAPI 业务链任务。
   *
   * 参数说明：`questionText` 为用户原文，`intent` 为宽业务映射后的意图。
   * 返回值说明：返回伙伴开拓、客户报备、商机和订单四类任务中被用户问到的部分。
   * 调用注意事项：每个任务仍会经过 OpenAPI 路由、字段白名单和权限注入，不能回到 SQLite 模板。
   */
  private resolveCompositeBusinessChainTaskDescriptors(
    questionText: string,
    intent: AnalysisIntent,
  ): PlannedTaskDescriptor[] {
    const signals = this.resolveBusinessChainObjectSignals(questionText, intent);
    const shouldExpandPartnerOperating =
      signals.hasPartner && this.isPartnerOperatingChainQuestion(questionText);
    const tasks: PlannedTaskDescriptor[] = [];

    if (signals.hasPartner) {
      tasks.push({
        title: '合作伙伴开拓情况',
        description: '通过联软 OpenAPI 读取服务商真实明细，统计合作伙伴开拓规模和状态。',
        resultKind: 'partner-contribution',
        purpose: 'primary-summary',
        required: true,
        reportSection: 'summary',
        intentOverride: {
          domain: 'opportunity-analysis',
          metrics: ['客户贡献度'],
          dimensions: ['渠道商'],
          resultKindHint: 'partner-contribution',
        },
      });
    }

    if (signals.hasRegistration || shouldExpandPartnerOperating) {
      tasks.push({
        title: '客户报备情况',
        description: '通过联软 OpenAPI 读取客户报备真实明细，统计报备状态和渠道关联情况。',
        resultKind: 'category-distribution',
        purpose: 'distribution',
        required: true,
        reportSection: 'distribution',
        intentOverride: {
          domain: 'customer-relationship',
          metrics: ['客户贡献度'],
          dimensions: ['客户分类', '渠道商'],
          resultKindHint: 'category-distribution',
        },
      });
    }

    if (signals.hasOpportunity || shouldExpandPartnerOperating) {
      tasks.push({
        title: '客户商机及渠道商维度',
        description: '通过联软 OpenAPI 读取商机真实明细，按渠道商统计商机数量、金额和阶段情况。',
        resultKind: 'partner-contribution',
        purpose: 'detail-table',
        required: true,
        reportSection: 'detail-table',
        intentOverride: {
          domain: 'opportunity-analysis',
          metrics: ['新增商机金额', '商机数量'],
          dimensions: ['渠道商', '商机阶段'],
          resultKindHint: 'partner-contribution',
        },
      });
    }

    if (signals.hasOrder || shouldExpandPartnerOperating) {
      tasks.push({
        title: '订单情况及渠道商贡献',
        description: '通过联软 OpenAPI 读取订单真实明细，按渠道商统计订单数量和订单金额。',
        resultKind: 'partner-contribution',
        purpose: 'detail-table',
        required: true,
        reportSection: 'detail-table',
        intentOverride: {
          domain: 'contract-conversion',
          metrics: ['转合同金额'],
          dimensions: ['渠道商'],
          resultKindHint: 'partner-contribution',
        },
      });
    }

    return tasks.slice(0, this.maxTaskCount);
  }

  /**
   * 解析业务链对象信号。
   *
   * 参数说明：`questionText` 为用户原文，`intent` 为 AI 结构化意图。
   * 返回值说明：返回伙伴、报备、商机、订单四类对象是否被明确问到。
   * 调用注意事项：只要用户原文已经出现 CRM 对象，就以原文为准，避免上游 AI 或历史上下文把单一商机问题扩成综合经营问题。
   */
  private resolveBusinessChainObjectSignals(
    questionText: string,
    intent: AnalysisIntent,
  ): BusinessChainObjectSignals {
    const explicitSignals: BusinessChainObjectSignals = {
      hasPartner: /(合作伙伴|服务商|渠道商|渠道|代理商|经销商)/u.test(questionText),
      hasRegistration: /(客户商机报备|客户报备|报备情况|报备)/u.test(questionText),
      hasOpportunity: /(商机|机会)/u.test(questionText),
      hasOrder: /(订单|下单|成单|签单|成交)/u.test(questionText),
    };
    const explicitObjectCount = Object.values(explicitSignals).filter(Boolean).length;
    if (explicitObjectCount > 0) {
      return explicitSignals;
    }

    const objectTypes = new Set(intent.businessIntentHint?.objectTypes ?? []);
    return {
      hasPartner: objectTypes.has('partner'),
      hasRegistration: objectTypes.has('registration'),
      hasOpportunity: objectTypes.has('opportunity'),
      hasOrder: objectTypes.has('order') || objectTypes.has('contract'),
    };
  }

  /**
   * 识别单一商机整体情况问题。
   *
   * 参数说明：`questionText` 为用户原文，`intent` 为 AI 结构化意图。
   * 返回值说明：只问商机整体、全部或当前情况时返回 true。
   * 调用注意事项：排名、趋势、风险、渠道商经营等更具体的问题仍交给对应专题任务，避免过度扩展。
   */
  private isOpportunityOverviewQuestion(
    questionText: string,
    intent: AnalysisIntent,
  ): boolean {
    if (intent.domain !== 'opportunity-analysis') {
      return false;
    }

    // 修复：detail 模式不走商机总览模板，应走明细查询路径
    // 当 resultKindHint 已被映射为 owner-ranking（detail 模式标志）时跳过总览判定
    if (intent.resultKindHint === 'owner-ranking') {
      return false;
    }
    // 修复：含明细/列出/条目等关键词的问题不走总览
    if (/(明细|详情|清单|列表|列出|条目|逐条|每条|逐个)/u.test(questionText)) {
      return false;
    }

    const signals = this.resolveBusinessChainObjectSignals(questionText, intent);
    const isSingleOpportunitySubject =
      signals.hasOpportunity &&
      !signals.hasPartner &&
      !signals.hasRegistration &&
      !signals.hasOrder;
    if (!isSingleOpportunitySubject) {
      return false;
    }

    const hasOverviewSignal = /(商机).*(情况|分析|概况|总览|整体|全部|当前|最近|近)|(情况|分析|概况|总览|整体|全部|当前|最近|近).*(商机)/u.test(
      questionText,
    );
    const hasSpecializedSignal =
      /(趋势|走势|排名|排行|top\s*\d+|没有进展|没进展|未进展|停滞|未更新|无跟进|风险|超期|逾期)/iu.test(
        questionText,
      );
    const aiAlreadyChoseTrend = intent.resultKindHint === 'time-trend' || intent.dimensions.includes('月份');

    return hasOverviewSignal && !hasSpecializedSignal && !aiAlreadyChoseTrend;
  }

  /**
   * 生成单一商机整体情况任务。
   *
   * 返回值说明：返回商机总览、阶段分布和渠道商维度三个 OpenAPI 任务。
   * 调用注意事项：这里不生成业务链快照任务，明细和指标都通过 `/opportunities` 真实列表聚合得到。
   */
  private resolveOpportunityOverviewTaskDescriptors(): PlannedTaskDescriptor[] {
    return [
      {
        title: '商机整体总览',
        description: '通过联软 OpenAPI 读取商机真实明细，统计商机数量和商机金额。',
        resultKind: 'metric-summary',
        purpose: 'primary-summary',
        required: true,
        reportSection: 'summary',
        intentOverride: {
          domain: 'opportunity-analysis',
          metrics: ['新增商机金额', '商机数量'],
          dimensions: [],
          resultKindHint: 'metric-summary',
        },
      },
      {
        title: '商机阶段分布',
        description: '通过联软 OpenAPI 读取商机真实明细，按商机阶段统计数量和金额。',
        resultKind: 'stage-distribution',
        purpose: 'distribution',
        required: true,
        reportSection: 'distribution',
        intentOverride: {
          domain: 'opportunity-analysis',
          metrics: ['新增商机金额', '商机数量'],
          dimensions: ['商机阶段'],
          resultKindHint: 'stage-distribution',
        },
      },
      {
        title: '商机渠道商维度',
        description: '通过联软 OpenAPI 读取商机真实明细，按渠道商统计商机数量和金额。',
        resultKind: 'partner-contribution',
        purpose: 'detail-table',
        required: true,
        reportSection: 'detail-table',
        intentOverride: {
          domain: 'opportunity-analysis',
          metrics: ['新增商机金额', '商机数量'],
          dimensions: ['渠道商'],
          resultKindHint: 'partner-contribution',
        },
      },
    ];
  }

  /**
   * 将服务商画像类渠道贡献任务统一归到商机分析域。
   *
   * 参数说明：
   * - `intent`：AI 或 fallback 解析出的原始意图。
   * - `task`：当前待生成的任务描述。
   * 返回值说明：返回供查询编译器使用的意图副本。
   * 调用注意事项：AI 可能把“服务商画像”理解为客户经营域，但当前联软标准 API
   * 的服务商画像适配器挂在商机/渠道贡献路径下；订单渠道贡献必须保留合同/订单域，避免把下单金额误查成商机金额。
   */
  private normalizeIntentForTask(
    intent: AnalysisIntent,
    task: PlannedTaskDescriptor,
  ): AnalysisIntent {
    if (task.resultKind !== 'partner-contribution') {
      return intent;
    }

    if (intent.domain === 'contract-conversion') {
      return intent;
    }

    return {
      ...intent,
      domain: 'opportunity-analysis',
    };
  }

  /**
   * 识别只询问服务商主数据画像的问题。
   *
   * 参数说明：
   * - `questionText`：用户原始问题。
   * - `intent`：当前结构化意图。
   * 返回值说明：命中服务商数量、等级、状态、技术服务商等资料维度时返回 `true`。
   * 调用注意事项：该判断只负责纠偏 AI 主题档案，不直接执行查询或放宽权限。
   */
  private isPartnerProfileQuestion(
    questionText: string,
    intent: AnalysisIntent,
  ): boolean {
    const hasPartnerSubject =
      intent.dimensions.includes('渠道商') ||
      /(服务商|渠道商|渠道|伙伴|代理商|经销商)/u.test(questionText);
    const hasProfileMetric =
      /(多少家|多少个|合作级别|合作等级|渠道等级|等级|技术服务商|状态|加入|新增|创建|入驻|维度|开拓|拓展|发展|开发|画像|概况|情况)/u.test(
        questionText,
      );
    const hasBusinessContribution =
      /(商机|机会|金额|报价|订单|合同|成交|回款|报备转|转化率)/u.test(questionText);
    const hasOperatingChainIntent = this.isPartnerOperatingChainQuestion(questionText);

    return hasPartnerSubject && hasProfileMetric && !hasBusinessContribution && !hasOperatingChainIntent;
  }

  /**
   * 识别渠道商经营贡献类默认问题。
   *
   * 参数说明：`questionText` 为用户原文。
   * 返回值说明：围绕渠道商经营、贡献、业绩或整体情况提问时返回 true。
   * 调用注意事项：开拓、画像、等级、状态等服务商资料问题由服务商画像分支处理。
   */
  private isPartnerOperatingChainQuestion(questionText: string): boolean {
    const hasPartnerSubject = /(合作伙伴|服务商|渠道商|渠道|代理商|经销商)/u.test(questionText);
    const hasOperatingSignal = /(经营|运营|贡献|业绩|产出|整体情况|经营情况|业务情况|下单情况)/u.test(
      questionText,
    );
    const isProfileOnly = /(开拓|拓展|发展|开发|画像|等级|级别|状态|技术服务商)/u.test(
      questionText,
    ) && !/(商机|报备|订单|下单|成交|贡献|业绩|经营|运营)/u.test(questionText);

    return hasPartnerSubject && hasOperatingSignal && !isProfileOnly;
  }

  /**
   * 识别 P0 渠道贡献排行问题。
   *
   * 参数说明：`questionText` 为用户原始问题。
   * 返回值说明：当问题同时具备渠道主语和排行/贡献语义时返回 `true`。
   * 调用注意事项：该分支只决定渠道商维度，不改变权限、时间或事实来源。
   */
  private isChannelContributionRankingQuestion(questionText: string): boolean {
    return /(渠道|渠道商|服务商|代理商|经销商|伙伴)/u.test(questionText) &&
      /(贡献|业绩|产出|排行|排名|前\s*(三|3|五|5|十|10)|top\s*\d+)/iu.test(questionText);
  }

  /**
   * 识别 P0 业务漏斗问题。
   *
   * 参数说明：`questionText` 为用户原始问题。
   * 返回值说明：命中报备、商机、报价、订单转化链路时返回 `true`。
   * 调用注意事项：普通“不带看板字样”的漏斗问题也必须进入分析链路。
   */
  private isBusinessFunnelQuestion(questionText: string): boolean {
    return /(漏斗|转化率|转化漏斗|流失|断点|报备到订单|报备到商机|商机到报价|报价到订单)/u.test(
      questionText,
    );
  }

  /**
   * 在最终规划前纠正明显的业务对象串线。
   *
   * 参数说明：`questionText` 为用户原问题，`intent` 为 AI 主链或宽意图映射结果。
   * 返回值说明：返回用于规划的意图副本。
   * 调用注意事项：这里只处理“订单被误归为商机”等明确对象冲突，不承担完整语义理解。
   */
  private normalizeIntentForWorkflow(
    questionText: string,
    intent: AnalysisIntent,
  ): AnalysisIntent {
    if (!this.isOrderQuestion(questionText) || intent.domain === 'contract-conversion') {
      return intent;
    }

    return {
      ...intent,
      domain: 'contract-conversion',
      metrics: intent.metrics.includes('转合同金额')
        ? intent.metrics
        : ['转合同金额'],
      resultKindHint:
        intent.dimensions.includes('渠道商') || /(渠道|渠道商|服务商|代理商|经销商|合作渠道|伙伴)/u.test(questionText)
          ? 'partner-contribution'
          : intent.resultKindHint === 'partner-contribution'
            ? 'metric-summary'
            : intent.resultKindHint,
      queryEntities: Array.from(
        new Set(['订单', ...(intent.queryEntities ?? []).filter((item) => item !== '商机')]),
      ),
    };
  }

  /**
   * 生成服务商资料类问题的任务标题。
   *
   * 参数说明：`questionText` 为用户原问题。
   * 返回值说明：返回不会误写成商机金额贡献的中文标题。
   * 调用注意事项：该标题只用于服务商画像/开拓，不用于含商机、订单或合同贡献的问题。
   */
  private resolvePartnerProfileTaskTitle(questionText: string): string {
    if (/(类型|类别|分类|分别|单独列|列一下|列出|名单|明细|清单)/u.test(questionText)) {
      return '渠道商类型明细';
    }

    if (/(开拓|拓展|发展|开发)/u.test(questionText)) {
      return '服务商开拓情况';
    }

    return '服务商画像统计';
  }

  private resolveContractTaskDescriptors(
    questionText: string,
    intent: AnalysisIntent,
  ): PlannedTaskDescriptor[] {
    const isChannelOrderQuestion = this.isChannelOrderQuestion(questionText, intent);
    const subjectLabel = this.isOrderQuestion(questionText) ? '订单' : '合同';
    const metricLabel = this.isOrderQuestion(questionText) ? '订单金额' : '合同金额';
    const tasks: PlannedTaskDescriptor[] = [
      {
        title: `${metricLabel}总览`,
        description: `统计当前时间和权限范围内的全量${subjectLabel}金额与${subjectLabel}数量。`,
        resultKind: 'metric-summary',
        purpose: 'primary-summary',
        required: true,
        reportSection: 'summary',
      },
    ];

    if (isChannelOrderQuestion) {
      const topN = this.resolveTopN(questionText) ?? 30;
      tasks.push({
        title: `${metricLabel}渠道商贡献`,
        description: `按渠道商聚合${subjectLabel}数量和${subjectLabel}金额，承接渠道下单汇总、排行和报告展示。`,
        resultKind: 'partner-contribution',
        purpose: 'detail-table',
        required: true,
        reportSection: 'detail-table',
        rowLimit: topN,
      });
    }

    if (!isChannelOrderQuestion && this.isRankingQuestion(questionText)) {
      const topN = this.resolveTopN(questionText) ?? 10;
      tasks.push({
        title: `${metricLabel}负责人${this.formatTopNLabel(topN)}排名`,
        description: `按销售负责人输出${subjectLabel}金额排名，排名表只承担排名展示，不作为公司总额来源。`,
        resultKind: 'owner-ranking',
        purpose: 'detail-table',
        required: true,
        reportSection: 'detail-table',
        rowLimit: topN,
      });
    }

    if (this.needsTrendTask(questionText, intent, isChannelOrderQuestion)) {
      tasks.push({
        title: `${metricLabel}月度趋势`,
        description: `按月汇总${subjectLabel}金额和${subjectLabel}数量，观察时间趋势。`,
        resultKind: 'time-trend',
        purpose: 'trend-series',
        required: false,
        reportSection: 'trend',
      });
    }

    return tasks.slice(0, 3);
  }

  /**
   * 识别“渠道下单/渠道订单汇总”问题。
   *
   * 参数说明：`questionText` 为用户原始问题，`intent` 为结构化意图。
   * 返回值说明：当问题同时具备订单口径与渠道商维度时返回 true。
   * 调用注意事项：这里只影响任务拆分，不放宽字段、权限或执行来源。
   */
  private isChannelOrderQuestion(questionText: string, intent: AnalysisIntent): boolean {
    const hasChannelSubject =
      intent.dimensions.includes('渠道商') ||
      /(渠道|渠道商|服务商|代理商|经销商|合作渠道|伙伴)/u.test(questionText);
    const isDefaultOrderTopic = /(订单情况|下单情况|订单分析|订单经营|下单汇总)/u.test(
      questionText,
    );
    return (hasChannelSubject || isDefaultOrderTopic) && this.isOrderQuestion(questionText);
  }

  /**
   * 识别订单或下单口径。
   *
   * 参数说明：`questionText` 为用户原始问题。
   * 返回值说明：提到订单、下单、成单等成交对象时返回 true。
   * 调用注意事项：报价问题仍由执行器按报价关键词选择报价资源，不在此处抢占。
   */
  private isOrderQuestion(questionText: string): boolean {
    return /(订单|下单|成单|签单|成交)/u.test(questionText) && !/(报价|报价单|报价金额)/u.test(questionText);
  }

  /**
   * 判断是否需要补充趋势任务。
   *
   * 参数说明：`questionText` 为用户问题，`intent` 为解析结果，`isChannelOrderQuestion` 表示是否命中渠道订单报告口径。
   * 返回值说明：明确要求趋势、月份或管理型报告时返回 true。
   * 调用注意事项：简单总数查询不默认扩展趋势，避免影响旧的轻量问数体验。
   */
  private needsTrendTask(
    questionText: string,
    intent: AnalysisIntent,
    isChannelOrderQuestion: boolean,
  ): boolean {
    return (
      questionText.includes('趋势') ||
      questionText.includes('走势') ||
      intent.dimensions.includes('月份') ||
      (isChannelOrderQuestion && /(看板|报告|汇总分析|经营分析|年度|近三个月|最近三个月|最近一年)/u.test(questionText))
    );
  }

  private resolveTemplateTitle(
    intent: AnalysisIntent,
    template: AnalysisTopicTaskTemplate,
  ): string {
    const metricLabel = intent.metrics[0] ?? '经营指标';
    return template.title.replace('新增商机金额', metricLabel);
  }

  private resolveFallbackResultKind(intent: AnalysisIntent): QueryPlanResultKind {
    if (intent.resultKindHint) {
      return intent.resultKindHint;
    }

    if (intent.analysisFacetProfile === 'opportunity-risk') {
      return 'risk-overview';
    }

    if (intent.dimensions.includes('渠道商')) {
      return 'partner-contribution';
    }

    if (intent.analysisFacetProfile === 'region-operations') {
      return 'department-contribution';
    }

    if (intent.dimensions.includes('月份')) {
      return 'time-trend';
    }

    if (intent.dimensions.includes('商机阶段')) {
      return 'stage-distribution';
    }

    if (intent.dimensions.includes('客户分类') || intent.domain === 'customer-relationship') {
      return 'category-distribution';
    }

    return 'owner-ranking';
  }

  private resolveTaskTitle(
    intent: AnalysisIntent,
    resultKind: QueryPlanResultKind,
    purpose: AnalysisTaskPurpose,
  ): string {
    const metricLabel = intent.metrics[0] ?? '经营指标';
    if (resultKind === 'metric-summary') {
      return `${metricLabel}总览`;
    }

    if (purpose === 'detail-table') {
      return `${metricLabel}结果明细`;
    }

    if (resultKind === 'time-trend') {
      return `${metricLabel}趋势分析`;
    }

    if (resultKind === 'stage-distribution') {
      return `${metricLabel}阶段分布`;
    }

    if (resultKind === 'category-distribution') {
      return `${metricLabel}分类分布`;
    }

    if (resultKind === 'department-contribution') {
      return `${metricLabel}部门贡献`;
    }

    if (resultKind === 'partner-contribution') {
      return `${metricLabel}渠道商贡献`;
    }

    if (resultKind === 'risk-overview') {
      return '高风险商机观察';
    }

    return `${metricLabel}排名`;
  }

  private isRankingQuestion(questionText: string): boolean {
    return /排名|排行|前\s*(三|3|五|5|十|10|二|两|2|四|4|六|6|七|7|八|8|九|9)|top\s*\d+/iu.test(questionText);
  }

  private resolveTopN(questionText: string): number | undefined {
    const topMatch = questionText.match(/top\s*(?<count>\d{1,2})/iu);
    if (topMatch?.groups?.count) {
      return this.normalizeTopN(Number(topMatch.groups.count));
    }

    const prefixMatch = questionText.match(/前\s*(?<count>三|3|五|5|十|10|二|两|2|四|4|六|6|七|7|八|8|九|9)/u);
    if (prefixMatch?.groups?.count) {
      return this.normalizeTopN(this.parseChineseTopN(prefixMatch.groups.count));
    }

    return undefined;
  }

  private parseChineseTopN(value: string): number {
    const map: Record<string, number> = {
      两: 2,
      二: 2,
      三: 3,
      四: 4,
      五: 5,
      六: 6,
      七: 7,
      八: 8,
      九: 9,
      十: 10,
    };
    return map[value] ?? Number(value);
  }

  private normalizeTopN(value: number): number | undefined {
    if (!Number.isFinite(value) || value < 1) {
      return undefined;
    }

    return Math.min(Math.floor(value), 100);
  }

  private formatTopNLabel(topN: number): string {
    const map: Record<number, string> = {
      2: '前二',
      3: '前三',
      4: '前四',
      5: '前五',
      6: '前六',
      7: '前七',
      8: '前八',
      9: '前九',
      10: '前十',
    };
    return map[topN] ?? `TOP${topN}`;
  }

  private resolvePurposeLabel(purpose: AnalysisTaskPurpose): string {
    if (purpose === 'trend-series') {
      return '趋势补充';
    }

    if (purpose === 'distribution') {
      return '分布分析';
    }

    if (purpose === 'detail-table') {
      return '明细展示';
    }

    if (purpose === 'focus-contribution') {
      return '重点对象贡献';
    }

    if (purpose === 'risk-observation') {
      return '风险观察';
    }

    return '主结论生成';
  }
}

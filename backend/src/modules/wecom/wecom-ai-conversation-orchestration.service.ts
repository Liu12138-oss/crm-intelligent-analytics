import { Injectable } from '@nestjs/common';
import { AiGatewayService } from '../analysis/ai-gateway.service';
import { ClarificationService } from '../analysis/clarification.service';
import { resolveCrmAnalysisQuestionTemplateRuleByText } from '../analysis/crm-analysis-question-template.registry';
import { AiContextPolicyService } from '../ai-models/ai-context-policy.service';
import type {
  AiEntryInterpretationSnapshot,
  AiWorkflowRoutingSnapshot,
  CrmCreateEntityType,
  DailyReportFragmentType,
  FollowUpLoggableType,
  FollowUpShareStatus,
  FollowUpWritebackStatus,
  QuerySessionRecord,
  ScopeSnapshot,
  WecomLatestResultContext,
  WecomCustomerCreateDraft,
  WecomConversationContextRecord,
  WecomEntityLookupListItem,
  WecomEntityLookupMemory,
  WecomFollowUpTemplateDraft,
  WecomInboundMessage,
  WecomOpportunityCreateDraft,
} from '../../shared/types/domain';
import { buildEntityId } from '../../shared/utils/id.util';
import {
  createAiEntryInterpretationSnapshot,
  createAiWorkflowRoutingSnapshot,
} from '../../shared/utils/ai-entry-intent.util';
import {
  buildWecomDailyReportThemeEntryPrompt,
  buildWecomHelpPrompt,
  buildWecomFollowUpTemplateEntryPrompt,
  buildWecomExplanationPrompt,
  detectWecomHelpIntent,
} from './wecom-ai-prompt.config';
import { WecomConversationContextRepository } from './wecom-conversation-context.repository';

export interface WecomConversationDecision {
  action:
    | 'ANALYZE'
    | 'CLARIFICATION_REPLY'
    | 'FOLLOW_UP_ANALYZE'
    | 'EXPLAIN_RESULT'
    | 'REDISPLAY_RESULT'
    | 'DAILY_REPORT'
    | 'DAILY_REPORT_QUERY'
    | 'TEAM_DAILY_REPORT_QUERY'
    | 'CRM_CREATE_CUSTOMER'
    | 'CRM_CREATE_OPPORTUNITY'
    | 'OPPORTUNITY_LOOKUP'
    | 'ENTITY_LOOKUP'
    | 'HELP_GUIDANCE';
  effectiveQuestionText?: string;
  redisplayMode?: 'IMAGE' | 'DETAIL';
  redisplayQueryId?: string;
  entityLookupAction?: 'LIST' | 'DETAIL' | 'SELECT_FROM_LAST_LIST';
  entityLookupEntityType?: 'Customer' | 'Opportunity' | 'Unknown';
  entityLookupQueryText?: string;
  entityLookupSelectionIndex?: number;
  leaderNameQuery?: string;
  directReply?: string;
  entryInterpretationSnapshot?: AiEntryInterpretationSnapshot;
  workflowRoutingSnapshot?: AiWorkflowRoutingSnapshot;
  context: WecomConversationContextRecord;
}

type WecomFixedWorkflowAction =
  | 'HELP_GUIDANCE'
  | 'DAILY_REPORT'
  | 'DAILY_REPORT_QUERY'
  | 'TEAM_DAILY_REPORT_QUERY'
  | 'CRM_CREATE_CUSTOMER'
  | 'CRM_CREATE_OPPORTUNITY'
  | 'OPPORTUNITY_LOOKUP'
  | 'ENTITY_LOOKUP';

type WecomFreeQueryAction =
  | 'ANALYZE'
  | 'FOLLOW_UP_ANALYZE'
  | 'EXPLAIN_RESULT'
  | 'REDISPLAY_RESULT'
  | 'CLARIFICATION_REPLY';

@Injectable()
export class WecomAiConversationOrchestrationService {
  constructor(
    private readonly aiGatewayService: AiGatewayService,
    private readonly clarificationService: ClarificationService,
    private readonly wecomConversationContextRepository: WecomConversationContextRepository,
    private readonly aiContextPolicyService: AiContextPolicyService,
  ) {}

  loadOrCreateContext(
    session: QuerySessionRecord,
    inboundMessage: WecomInboundMessage,
  ): WecomConversationContextRecord {
    const existingContext =
      this.wecomConversationContextRepository.findBySessionId(session.id);
    if (existingContext) {
      return this.applyContextPolicy(existingContext, inboundMessage.receivedAt);
    }

    const now = new Date().toISOString();
    return this.wecomConversationContextRepository.save({
      id: buildEntityId('wecom_ctx'),
      sessionId: session.id,
      requesterId: session.requesterId,
      externalConversationId: inboundMessage.externalConversationId,
      senderId: inboundMessage.senderId,
      turns: [],
      workMemory: {
        metrics: [],
        dimensions: [],
        filters: {},
        pendingSlots: [],
        dailyReportEntityLookupStatus: 'IDLE',
        followUpShareStatus: 'IDLE',
        entityLookupMemory: {
          mode: 'IDLE',
          listItems: [],
        },
      },
      createdAt: now,
      updatedAt: now,
    });
  }

  appendUserTurn(
    context: WecomConversationContextRecord,
    inboundMessage: WecomInboundMessage,
  ): WecomConversationContextRecord {
    return this.wecomConversationContextRepository.save({
      ...context,
      turns: this.compressTurns([
        ...context.turns,
        {
          role: 'user' as const,
          content: inboundMessage.messageText ?? '',
          messageId: inboundMessage.channelMessageId,
          createdAt: inboundMessage.receivedAt,
        },
      ]),
      updatedAt: new Date().toISOString(),
    });
  }

  async decideNextAction(
    context: WecomConversationContextRecord,
    inboundMessage: WecomInboundMessage,
    scopeSnapshot: ScopeSnapshot,
  ): Promise<WecomConversationDecision> {
    const questionText = inboundMessage.messageText ?? '';
    const shouldUseAnalysisContext = this.shouldUseAnalysisConversationContext(questionText);
    const readOnlyOpportunityDetailDecision =
      this.resolveReadOnlyOpportunityDetailDecision(context, questionText);
    if (readOnlyOpportunityDetailDecision) {
      return readOnlyOpportunityDetailDecision;
    }

    const hasActiveConversationTask =
      this.hasActiveDailyReport(context) ||
      Boolean(context.workMemory.followUpTemplateDraft);
    let idleIntentMetadata:
      | {
          packCode?: string;
          packVersion?: string;
          providerCode?: string;
          model?: string;
          usedFallback?: boolean;
          fallbackReason?: string;
          validationFailureReason?: string;
        }
      | undefined;

    const quickActionDecision = await this.resolveAnalysisQuickActionDecision(
      context,
      questionText,
      scopeSnapshot,
    );
    if (quickActionDecision) {
      return quickActionDecision;
    }

    // 看板分析型问题确定性路由：
    // 明确经营分析/看板类问题应能打断旧日报、写回或帮助上下文，避免被 idle lane
    // 或活跃任务续填逻辑误判为帮助菜单。
    if (this.isDashboardAnalysisQuestion(questionText)) {
      return {
        action: 'ANALYZE',
        effectiveQuestionText: questionText,
        ...this.buildWecomDecisionSnapshots({
          questionText,
          targetWorkflow: 'ANALYSIS_QUERY_EXECUTION',
          usedFallback: true,
          fallbackReason: 'dashboard-analysis-signal-deterministic-route',
          structuredSlots: this.buildFreeQueryStructuredSlots('ANALYZE'),
        }),
        context,
      };
    }

    if (!hasActiveConversationTask) {
      const idleIntent = await this.aiGatewayService.classifyWecomIdleConversationIntent({
        messageText: questionText,
        latestQuestion: shouldUseAnalysisContext ? context.workMemory.latestQuestion : undefined,
        latestSummary: shouldUseAnalysisContext ? context.workMemory.latestSummary : undefined,
        latestResultContext: shouldUseAnalysisContext
          ? context.workMemory.latestResultContext
          : undefined,
        hasPendingSlots: context.workMemory.pendingSlots.length > 0,
      });
      idleIntentMetadata = idleIntent
        ? {
            packCode: idleIntent.packCode,
            packVersion: idleIntent.packVersion,
            providerCode: idleIntent.providerCode,
            model: idleIntent.model,
            usedFallback: idleIntent.usedFallback,
            fallbackReason: idleIntent.fallbackReason,
            validationFailureReason: idleIntent.validationFailureReason,
          }
        : undefined;
      if (idleIntent && idleIntent.intent !== 'NONE') {
        const mappedDecision = await this.buildDecisionFromIdleIntent(
          context,
          questionText,
          scopeSnapshot,
          idleIntent,
        );
        if (mappedDecision) {
          return mappedDecision;
        }
      }
    }

    if (hasActiveConversationTask) {
      const helpIntent = detectWecomHelpIntent(questionText);
      if (helpIntent) {
        const activeTaskLabel = context.workMemory.followUpTemplateDraft
          ? '当前跟进整理'
          : '当前日报整理';
        return {
          action: 'HELP_GUIDANCE',
          directReply: buildWecomHelpPrompt({
            scene: helpIntent === 'GREETING' ? 'GREETING' : 'CAPABILITY',
            taskLabel: activeTaskLabel,
          }),
          ...this.buildWecomDecisionSnapshots({
            questionText,
            targetWorkflow: 'WECOM_HELP_GUIDANCE',
            replyIntent: 'HELP_GUIDANCE',
            usedFallback: true,
            fallbackReason: 'active-conversation-help-fallback',
          }),
          context,
        };
      }

      return {
        action: 'DAILY_REPORT',
        ...this.buildWecomDecisionSnapshots({
          questionText,
          targetWorkflow: 'WECOM_DAILY_REPORT_ENTRY',
          usedFallback: true,
          fallbackReason: 'active-conversation-flow-continue',
        }),
        context,
      };
    }

    const analysisFollowUpIntent = shouldUseAnalysisContext && context.workMemory.latestSummary
      ? await this.aiGatewayService.classifyAnalysisFollowUpIntent({
          questionText,
          latestQuestion: context.workMemory.latestQuestion,
          latestSummary: context.workMemory.latestSummary,
          latestResultContext: context.workMemory.latestResultContext,
          channel: 'wecom-bot',
        })
      : null;

    if (
      context.workMemory.latestSummary &&
      analysisFollowUpIntent === 'EXPLAIN_RESULT' &&
      !this.shouldForceNewAnalysis(questionText)
    ) {
      const directReply = await this.aiGatewayService.generateWecomExplanationReply(
        buildWecomExplanationPrompt({
          userQuestion: questionText,
          latestQuestion: context.workMemory.latestQuestion,
          latestSummary: context.workMemory.latestSummary,
          scopeSummary: scopeSnapshot.scopeSummary,
        }),
      );

      return {
        action: 'EXPLAIN_RESULT',
        directReply,
        ...this.buildWecomDecisionSnapshots({
          questionText,
          targetWorkflow: 'ANALYSIS_RESULT_EXPLANATION',
          replyIntent: 'EXPLAIN_RESULT',
          usedFallback: false,
        }),
        context,
      };
    }

    if (context.workMemory.pendingSlots.length > 0 && shouldUseAnalysisContext) {
      return {
        action: 'CLARIFICATION_REPLY',
        effectiveQuestionText: this.clarificationService.mergeClarificationQuestion(
          context.workMemory.latestQuestion,
          questionText,
        ),
        ...this.buildWecomDecisionSnapshots({
          questionText,
          targetWorkflow: 'ANALYSIS_CLARIFICATION',
          usedFallback: true,
          fallbackReason: 'pending-slot-clarification-fallback',
        }),
        context,
      };
    }

    if (
      context.workMemory.latestQuestion &&
      shouldUseAnalysisContext &&
      analysisFollowUpIntent === 'RUN_NEW_ANALYSIS'
    ) {
      return {
        action: 'FOLLOW_UP_ANALYZE',
        effectiveQuestionText: this.clarificationService.mergeFollowUpQuestion(
          this.buildFollowUpBaseQuestion(context),
          questionText,
        ),
        ...this.buildWecomDecisionSnapshots({
          questionText,
          targetWorkflow: 'ANALYSIS_QUERY_EXECUTION',
          replyIntent: 'RUN_NEW_ANALYSIS',
          usedFallback: false,
          structuredSlots: this.buildFreeQueryStructuredSlots('FOLLOW_UP_ANALYZE'),
        }),
        context,
      };
    }

    return {
      action: 'ANALYZE',
      effectiveQuestionText: questionText,
      ...this.buildWecomDecisionSnapshots({
        questionText,
        targetWorkflow: 'ANALYSIS_QUERY_EXECUTION',
        usedFallback: idleIntentMetadata?.usedFallback ?? true,
        fallbackReason:
          idleIntentMetadata?.fallbackReason ?? 'idle-intent-none-default-analyze',
        validationFailureReason: idleIntentMetadata?.validationFailureReason,
        packCode: idleIntentMetadata?.packCode,
        packVersion: idleIntentMetadata?.packVersion,
        providerCode: idleIntentMetadata?.providerCode,
        model: idleIntentMetadata?.model,
        structuredSlots: this.buildFreeQueryStructuredSlots('ANALYZE'),
      }),
      context,
    };
  }

  /**
   * 识别机器人自己下发的上一轮结果快捷动作。
   *
   * 参数说明：
   * - `context` 为当前企微会话上下文，必须包含上一轮分析记忆才可命中。
   * - `questionText` 为用户本轮短回复。
   * - `scopeSnapshot` 为当前用户权限摘要，用于解释回复保持权限口径。
   * 返回值说明：命中快捷动作时返回复用上一轮结果的决策；否则返回 null。
   * 调用注意事项：这里不是替代自然语言理解，只处理系统自己展示给用户的固定短动作，
   * 避免它们被 AI 空闲态分类误判为全新问数而丢失上下文。
   */
  private async resolveAnalysisQuickActionDecision(
    context: WecomConversationContextRecord,
    questionText: string,
    scopeSnapshot: ScopeSnapshot,
  ): Promise<WecomConversationDecision | null> {
    const normalizedQuestion = questionText.replace(/[「」"“”'\s]/gu, '').trim();
    if (
      !normalizedQuestion ||
      (!context.workMemory.latestSummary && !context.workMemory.latestQueryId)
    ) {
      return null;
    }

    const redisplayActionMap = new Map<string, 'IMAGE' | 'DETAIL'>([
      ['看分布图', 'IMAGE'],
      ['看趋势图', 'IMAGE'],
      ['看明细', 'DETAIL'],
      ['看前10', 'DETAIL'],
    ]);
    const redisplayMode = redisplayActionMap.get(normalizedQuestion);
    if (redisplayMode) {
      return {
        action: 'REDISPLAY_RESULT',
        redisplayMode,
        redisplayQueryId: context.workMemory.latestQueryId,
        directReply: context.workMemory.latestQueryId
          ? undefined
          : '我还没有上一轮可展示的完整结果，请先发起一次完整查询，例如“最近三个月山东区域服务商商机金额排名”。',
        ...this.buildWecomDecisionSnapshots({
          questionText,
          targetWorkflow: 'ANALYSIS_RESULT_EXPLANATION',
          replyIntent: 'REDISPLAY_RESULT',
          usedFallback: true,
          fallbackReason: 'system-quick-action-redisplays-latest-result',
          structuredSlots: this.buildFreeQueryStructuredSlots('REDISPLAY_RESULT', {
            redisplayMode,
            latestQueryId: context.workMemory.latestQueryId,
          }),
        }),
        context,
      };
    }

    const explanationActionSet = new Set([
      '看差距',
      '分析异常',
      '分析风险',
      '分析原因',
    ]);
    if (explanationActionSet.has(normalizedQuestion)) {
      return {
        action: 'EXPLAIN_RESULT',
        directReply: await this.aiGatewayService.generateWecomExplanationReply(
          buildWecomExplanationPrompt({
            userQuestion: questionText,
            latestQuestion: context.workMemory.latestQuestion,
            latestSummary: context.workMemory.latestSummary,
            scopeSummary: scopeSnapshot.scopeSummary,
          }),
        ),
        ...this.buildWecomDecisionSnapshots({
          questionText,
          targetWorkflow: 'ANALYSIS_RESULT_EXPLANATION',
          replyIntent: 'EXPLAIN_RESULT',
          usedFallback: true,
          fallbackReason: 'system-quick-action-reuses-latest-result',
          structuredSlots: this.buildFreeQueryStructuredSlots('EXPLAIN_RESULT'),
        }),
        context,
      };
    }

    const followUpActionSet = new Set(['继续分析', '按区域对比']);
    if (followUpActionSet.has(normalizedQuestion) && context.workMemory.latestQuestion) {
      return {
        action: 'FOLLOW_UP_ANALYZE',
        effectiveQuestionText: this.clarificationService.mergeFollowUpQuestion(
          this.buildFollowUpBaseQuestion(context),
          questionText,
        ),
        ...this.buildWecomDecisionSnapshots({
          questionText,
          targetWorkflow: 'ANALYSIS_QUERY_EXECUTION',
          replyIntent: 'RUN_NEW_ANALYSIS',
          usedFallback: true,
          fallbackReason: 'system-quick-action-follow-up-analysis',
          structuredSlots: this.buildFreeQueryStructuredSlots('FOLLOW_UP_ANALYZE'),
        }),
        context,
      };
    }

    return null;
  }

  private async buildDecisionFromIdleIntent(
    context: WecomConversationContextRecord,
    questionText: string,
    scopeSnapshot: ScopeSnapshot,
    idleIntent: {
      intent:
        | 'HELP_GUIDANCE'
        | 'DAILY_REPORT'
        | 'DAILY_REPORT_QUERY'
        | 'TEAM_DAILY_REPORT_QUERY'
        | 'CRM_CREATE_CUSTOMER'
        | 'CRM_CREATE_OPPORTUNITY'
        | 'OPPORTUNITY_LOOKUP'
        | 'ENTITY_LOOKUP'
        | 'EXPLAIN_RESULT'
        | 'FOLLOW_UP_ANALYZE'
        | 'ANALYZE'
        | 'NONE';
      helpScene?: 'GREETING' | 'CAPABILITY';
      dailyReportPrompt?: 'FOLLOW_UP_TEMPLATE_ENTRY' | 'DAILY_REPORT_THEME_ENTRY';
      leaderNameQuery?: string;
      lookupText?: string;
      entityLookupAction?: 'LIST' | 'DETAIL' | 'SELECT_FROM_LAST_LIST';
      entityType?: 'Customer' | 'Opportunity' | 'Unknown';
      queryText?: string;
      selectionIndex?: number;
      referenceTarget?: 'LAST_LIST' | 'NONE';
      confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
      packCode?: string;
      packVersion?: string;
      providerCode?: string;
      model?: string;
    },
  ): Promise<WecomConversationDecision | null> {
    const capabilityMetadata = {
      packCode: idleIntent.packCode,
      packVersion: idleIntent.packVersion,
      providerCode: idleIntent.providerCode,
      model: idleIntent.model,
    };

    if (
      this.isReadOnlyCustomerLifecycleAnalysisQuestion(questionText) &&
      (
        idleIntent.intent === 'HELP_GUIDANCE' ||
        idleIntent.intent === 'CRM_CREATE_CUSTOMER' ||
        idleIntent.intent === 'CRM_CREATE_OPPORTUNITY' ||
        idleIntent.intent === 'DAILY_REPORT'
      )
    ) {
      return {
        action: 'ANALYZE',
        effectiveQuestionText: questionText,
        ...this.buildWecomDecisionSnapshots({
          questionText,
          targetWorkflow: 'ANALYSIS_QUERY_EXECUTION',
          usedFallback: true,
          fallbackReason: 'readonly-customer-lifecycle-overrides-idle-intent',
          ...capabilityMetadata,
          structuredSlots: this.buildFreeQueryStructuredSlots('ANALYZE'),
        }),
        context,
      };
    }

    // 防御性覆盖：当 AI 把看板分析型问题误分类为 ENTITY_LOOKUP / OPPORTUNITY_LOOKUP
    // 等固定程序流时，强制降级为 ANALYZE，确保看板分析走分析执行链路。
    if (
      this.isCrmAnalysisQuestionCatalogQuestion(questionText) &&
      (
        idleIntent.intent === 'ENTITY_LOOKUP' ||
        idleIntent.intent === 'OPPORTUNITY_LOOKUP' ||
        idleIntent.intent === 'CRM_CREATE_CUSTOMER' ||
        idleIntent.intent === 'CRM_CREATE_OPPORTUNITY' ||
        idleIntent.intent === 'HELP_GUIDANCE' ||
        idleIntent.intent === 'DAILY_REPORT'
      )
    ) {
      return {
        action: 'ANALYZE',
        effectiveQuestionText: questionText,
        ...this.buildWecomDecisionSnapshots({
          questionText,
          targetWorkflow: 'ANALYSIS_QUERY_EXECUTION',
          usedFallback: true,
          fallbackReason: 'crm-analysis-question-catalog-overrides-idle-intent',
          ...capabilityMetadata,
          structuredSlots: this.buildFreeQueryStructuredSlots('ANALYZE'),
        }),
        context,
      };
    }

    if (
      this.isDashboardAnalysisQuestion(questionText) &&
      (
        idleIntent.intent === 'ENTITY_LOOKUP' ||
        idleIntent.intent === 'OPPORTUNITY_LOOKUP' ||
        idleIntent.intent === 'CRM_CREATE_CUSTOMER' ||
        idleIntent.intent === 'CRM_CREATE_OPPORTUNITY' ||
        idleIntent.intent === 'HELP_GUIDANCE' ||
        idleIntent.intent === 'DAILY_REPORT'
      )
    ) {
      return {
        action: 'ANALYZE',
        effectiveQuestionText: questionText,
        ...this.buildWecomDecisionSnapshots({
          questionText,
          targetWorkflow: 'ANALYSIS_QUERY_EXECUTION',
          usedFallback: true,
          fallbackReason: 'dashboard-analysis-signal-overrides-misrouted-idle-intent',
          ...capabilityMetadata,
          structuredSlots: this.buildFreeQueryStructuredSlots('ANALYZE'),
        }),
        context,
      };
    }

    switch (idleIntent.intent) {
      case 'HELP_GUIDANCE':
        return {
          action: 'HELP_GUIDANCE',
          directReply: buildWecomHelpPrompt({
            scene: idleIntent.helpScene ?? 'CAPABILITY',
          }),
          ...this.buildWecomDecisionSnapshots({
            questionText,
            targetWorkflow: 'WECOM_HELP_GUIDANCE',
            replyIntent: 'HELP_GUIDANCE',
            usedFallback: false,
            ...capabilityMetadata,
            structuredSlots: this.buildFixedWorkflowStructuredSlots(
              'HELP_GUIDANCE',
              {
                helpScene: idleIntent.helpScene ?? 'CAPABILITY',
              },
            ),
          }),
          context,
        };
      case 'DAILY_REPORT':
        return {
          action: 'DAILY_REPORT',
          directReply:
            idleIntent.dailyReportPrompt === 'FOLLOW_UP_TEMPLATE_ENTRY'
              ? buildWecomFollowUpTemplateEntryPrompt({
                  requesterName:
                    context.workMemory.dailyReportSupervisorName ?? '同事',
                })
              : buildWecomDailyReportThemeEntryPrompt({
                  requesterName:
                    context.workMemory.dailyReportSupervisorName ?? '同事',
                }),
          ...this.buildWecomDecisionSnapshots({
            questionText,
            targetWorkflow: 'WECOM_DAILY_REPORT_ENTRY',
            usedFallback: false,
            ...capabilityMetadata,
            structuredSlots: this.buildFixedWorkflowStructuredSlots('DAILY_REPORT', {
              dailyReportPrompt: idleIntent.dailyReportPrompt,
            }),
          }),
          context,
        };
      case 'DAILY_REPORT_QUERY':
        return {
          action: 'DAILY_REPORT_QUERY',
          ...this.buildWecomDecisionSnapshots({
            questionText,
            targetWorkflow: 'WECOM_DAILY_REPORT_QUERY',
            usedFallback: false,
            ...capabilityMetadata,
            structuredSlots: this.buildFixedWorkflowStructuredSlots(
              'DAILY_REPORT_QUERY',
            ),
          }),
          context,
        };
      case 'TEAM_DAILY_REPORT_QUERY':
        if (!idleIntent.leaderNameQuery?.trim()) {
          return null;
        }

        return {
          action: 'TEAM_DAILY_REPORT_QUERY',
          leaderNameQuery: idleIntent.leaderNameQuery.trim(),
          ...this.buildWecomDecisionSnapshots({
            questionText,
            targetWorkflow: 'WECOM_TEAM_DAILY_REPORT_QUERY',
            usedFallback: false,
            ...capabilityMetadata,
            structuredSlots: this.buildFixedWorkflowStructuredSlots(
              'TEAM_DAILY_REPORT_QUERY',
              {
                leaderNameQuery: idleIntent.leaderNameQuery.trim(),
              },
            ),
          }),
          context,
        };
      case 'CRM_CREATE_CUSTOMER':
        return {
          action: 'CRM_CREATE_CUSTOMER',
          ...this.buildWecomDecisionSnapshots({
            questionText,
            targetWorkflow: 'WECOM_CRM_CREATE_CUSTOMER',
            usedFallback: false,
            ...capabilityMetadata,
            structuredSlots: this.buildFixedWorkflowStructuredSlots(
              'CRM_CREATE_CUSTOMER',
            ),
          }),
          context,
        };
      case 'CRM_CREATE_OPPORTUNITY':
        if (!this.hasExplicitOpportunityCreateIntent(questionText)) {
          return {
            action: 'ANALYZE',
            effectiveQuestionText: questionText,
            ...this.buildWecomDecisionSnapshots({
              questionText,
              targetWorkflow: 'ANALYSIS_QUERY_EXECUTION',
              replyIntent: 'RUN_NEW_ANALYSIS',
              usedFallback: true,
              fallbackReason: 'readonly-opportunity-query-overrides-create-intent',
              ...capabilityMetadata,
              structuredSlots: this.buildFreeQueryStructuredSlots('ANALYZE'),
            }),
            context,
          };
        }

        return {
          action: 'CRM_CREATE_OPPORTUNITY',
          ...this.buildWecomDecisionSnapshots({
            questionText,
            targetWorkflow: 'WECOM_CRM_CREATE_OPPORTUNITY',
            usedFallback: false,
            ...capabilityMetadata,
            structuredSlots: this.buildFixedWorkflowStructuredSlots(
              'CRM_CREATE_OPPORTUNITY',
            ),
          }),
          context,
        };
      case 'OPPORTUNITY_LOOKUP':
        if (!idleIntent.lookupText?.trim()) {
          return null;
        }

        return {
          action: 'OPPORTUNITY_LOOKUP',
          effectiveQuestionText: idleIntent.lookupText.trim(),
          ...this.buildWecomDecisionSnapshots({
            questionText,
            targetWorkflow: 'WECOM_OPPORTUNITY_LOOKUP',
            usedFallback: false,
            ...capabilityMetadata,
            structuredSlots: this.buildFixedWorkflowStructuredSlots(
              'OPPORTUNITY_LOOKUP',
              {
                lookupText: idleIntent.lookupText.trim(),
              },
            ),
          }),
          context,
        };
      case 'ENTITY_LOOKUP':
        if (!idleIntent.entityLookupAction) {
          return null;
        }
        if (
          idleIntent.entityLookupAction === 'SELECT_FROM_LAST_LIST' &&
          !idleIntent.selectionIndex
        ) {
          return null;
        }
        if (
          idleIntent.entityLookupAction !== 'SELECT_FROM_LAST_LIST' &&
          !idleIntent.queryText?.trim()
        ) {
          return null;
        }

        return {
          action: 'ENTITY_LOOKUP',
          effectiveQuestionText: idleIntent.queryText?.trim() ?? questionText,
          entityLookupAction: idleIntent.entityLookupAction,
          entityLookupEntityType: idleIntent.entityType ?? 'Unknown',
          entityLookupQueryText: idleIntent.queryText?.trim(),
          entityLookupSelectionIndex: idleIntent.selectionIndex,
          ...this.buildWecomDecisionSnapshots({
            questionText,
            targetWorkflow: 'WECOM_ENTITY_LOOKUP',
            usedFallback: false,
            ...capabilityMetadata,
            structuredSlots: this.buildFixedWorkflowStructuredSlots(
              'ENTITY_LOOKUP',
              {
                entityLookupAction: idleIntent.entityLookupAction,
                entityType: idleIntent.entityType ?? 'Unknown',
                queryText: idleIntent.queryText?.trim(),
                selectionIndex: idleIntent.selectionIndex,
                referenceTarget: idleIntent.referenceTarget,
                confidence: idleIntent.confidence,
              },
            ),
          }),
          context,
        };
      case 'EXPLAIN_RESULT':
        if (!context.workMemory.latestSummary) {
          return null;
        }

        if (this.shouldForceNewAnalysis(questionText)) {
          return {
            action: 'ANALYZE',
            effectiveQuestionText: questionText,
            ...this.buildWecomDecisionSnapshots({
              questionText,
              targetWorkflow: 'ANALYSIS_QUERY_EXECUTION',
              replyIntent: 'RUN_NEW_ANALYSIS',
              usedFallback: true,
              fallbackReason: 'explicit-crm-query-overrides-explanation',
              ...capabilityMetadata,
              structuredSlots: this.buildFreeQueryStructuredSlots('ANALYZE'),
            }),
            context,
          };
        }

        return {
          action: 'EXPLAIN_RESULT',
          directReply: await this.aiGatewayService.generateWecomExplanationReply(
            buildWecomExplanationPrompt({
              userQuestion: questionText,
              latestQuestion: context.workMemory.latestQuestion,
              latestSummary: context.workMemory.latestSummary,
              scopeSummary: scopeSnapshot.scopeSummary,
            }),
          ),
          ...this.buildWecomDecisionSnapshots({
            questionText,
            targetWorkflow: 'ANALYSIS_RESULT_EXPLANATION',
            replyIntent: 'EXPLAIN_RESULT',
            usedFallback: false,
            ...capabilityMetadata,
            structuredSlots: this.buildFreeQueryStructuredSlots('EXPLAIN_RESULT'),
          }),
          context,
        };
      case 'FOLLOW_UP_ANALYZE':
        if (
          !context.workMemory.latestQuestion ||
          !this.shouldUseAnalysisConversationContext(questionText)
        ) {
          return null;
        }

        return {
          action: 'FOLLOW_UP_ANALYZE',
          effectiveQuestionText: this.clarificationService.mergeFollowUpQuestion(
            this.buildFollowUpBaseQuestion(context),
            questionText,
          ),
          ...this.buildWecomDecisionSnapshots({
            questionText,
            targetWorkflow: 'ANALYSIS_QUERY_EXECUTION',
            replyIntent: 'RUN_NEW_ANALYSIS',
            usedFallback: false,
            ...capabilityMetadata,
            structuredSlots: this.buildFreeQueryStructuredSlots('FOLLOW_UP_ANALYZE'),
          }),
          context,
        };
      case 'ANALYZE':
        return {
          action: 'ANALYZE',
          effectiveQuestionText: questionText,
          ...this.buildWecomDecisionSnapshots({
            questionText,
            targetWorkflow: 'ANALYSIS_QUERY_EXECUTION',
            usedFallback: false,
            ...capabilityMetadata,
            structuredSlots: this.buildFreeQueryStructuredSlots('ANALYZE'),
          }),
          context,
        };
      default:
        return null;
    }
  }

  /**
   * 构造追问合并的上一轮基准问题。
   *
   * 参数说明：`context` 为当前企微会话上下文，可能包含上一轮已验证结果包摘要。
   * 返回值说明：返回原始上一轮问题，并在存在结果上下文时追加可审计的实体和筛选口径。
   * 调用注意事项：这里只注入已交付结果中的事实，避免程序侧自行猜测“他/这个”等指代对象。
   */
  private buildFollowUpBaseQuestion(
    context: WecomConversationContextRecord,
  ): string | undefined {
    const latestQuestion = context.workMemory.latestQuestion;
    const latestResultContext = context.workMemory.latestResultContext;
    if (!latestQuestion || !latestResultContext) {
      return latestQuestion;
    }

    const entityText = latestResultContext.entities
      .map((item) => item.value)
      .filter(Boolean)
      .slice(0, 8)
      .join('、');
    const topRowsText = latestResultContext.topRows
      .map((item) => [item.label, ...item.summaryFields].filter(Boolean).join('，'))
      .filter(Boolean)
      .slice(0, 5)
      .join('；');
    const filterText = latestResultContext.appliedFilters
      .map((item) => `${item.label}=${item.value}`)
      .filter(Boolean)
      .slice(0, 6)
      .join('；');
    const contextText = [
      latestResultContext.title ? `标题：${latestResultContext.title}` : undefined,
      latestResultContext.summary ? `摘要：${latestResultContext.summary}` : undefined,
      entityText ? `已验证对象：${entityText}` : undefined,
      filterText ? `筛选：${filterText}` : undefined,
      topRowsText ? `代表性结果：${topRowsText}` : undefined,
    ]
      .filter(Boolean)
      .join('；');

    return contextText ? `${latestQuestion}；上一轮已验证结果上下文：${contextText}` : latestQuestion;
  }

  /**
   * 判断当前消息是否应强制作为新的 CRM 受控分析执行。
   *
   * 参数说明：`questionText` 为用户本轮原文。
   * 返回值说明：明确包含 CRM 对象、指标、区域或时间查询信号时返回 `true`。
   * 调用注意事项：该门闩用于防止上一轮摘要上下文把新查询误导到自由解释链路，不能替代后续白名单、权限和 SQL 审计。
   */
  private shouldForceNewAnalysis(questionText: string): boolean {
    const normalizedQuestion = questionText.trim();
    if (!normalizedQuestion) {
      return false;
    }

    const hasAnalysisVerb = /(查|看|分析|统计|汇总|整理|列出|给我|情况|排名|排行|趋势|明细|详情|列表)/u.test(
      normalizedQuestion,
    );
    const hasCrmObject = /(商机|机会|客户|合同|签单|订单|报价|报备|渠道|代理商|伙伴|负责人|销售|服务商)/u.test(
      normalizedQuestion,
    );
    const hasMetric = /(金额|数量|多少|多久|多长时间|时长|阶段|状态|负责人|服务商|区域|大区|团队|赢单|回款|转化|报价|订单)/u.test(
      normalizedQuestion,
    );
    const hasTimeOrScope = /(最近|近|本月|当月|今日|今天|昨天|本周|本季度|今年|去年|\d+\s*个?月|山东|华东|华南|华北|区域|大区|团队)/u.test(
      normalizedQuestion,
    );

    return hasCrmObject && (hasAnalysisVerb || hasMetric || hasTimeOrScope);
  }

  /**
   * 判断本轮自然语言是否应该携带上一轮分析上下文。
   *
   * 参数说明：`questionText` 为企微用户本轮原文。
   * 返回值说明：只有明显追问、省略、引用、改条件或解释上一轮结果时返回 true。
   * 调用注意事项：完整新问题即使前 1-2 轮存在分析结果，也不传入 latestQuestion/latestSummary，避免 AI 把“商机”串成上一轮订单或综合经营。
   */
  private shouldUseAnalysisConversationContext(questionText: string): boolean {
    const normalizedQuestion = questionText.replace(/\s+/gu, '').trim();
    if (!normalizedQuestion) {
      return false;
    }

    const hasExplicitReference =
      /(继续|接着|沿用|基于|刚才|刚刚|上面|上一轮|前面|这个|这些|这批|这份|该结果|它们|他们|他|她|它|其|那|其中|这几条|上一步|上一条)/u.test(
        normalizedQuestion,
      );
    const hasFollowUpOperation =
      /^(换成|改成|调整为|只看|仅看|再看|再按|按|展开|补充|过滤|剔除|排除|对比|拆开|细分|明细|详情|看明细|看详情)/u.test(
        normalizedQuestion,
      );
    const asksPreviousResultReason =
      /(为什么|为啥|怎么会|原因|差距|异常|风险|不对|不一致|说明什么|说明啥|意味着什么|代表什么|怎么理解|怎么看)/u.test(
        normalizedQuestion,
      );
    const hasCrmObject = /(商机|机会|客户|合同|签单|订单|报价|报备|渠道|代理商|伙伴|负责人|销售|服务商)/u.test(
      normalizedQuestion,
    );
    const isTimeOnlySupplement =
      /(最近|近|本月|当月|今日|今天|昨天|本周|本季度|今年|去年|\d+\s*天|\d+\s*个?月)/u.test(
        normalizedQuestion,
      ) && !hasCrmObject;
    const hasSameScopeSupplement = /(也看|也查|也分析|也统计|同样|另外|顺便)/u.test(
      normalizedQuestion,
    );

    return (
      hasExplicitReference ||
      hasFollowUpOperation ||
      asksPreviousResultReason ||
      isTimeOnlySupplement ||
      hasSameScopeSupplement
    );
  }

  /**
   * 判断企微空闲态消息是否为客户生命周期只读分析。
   *
   * 参数说明：`questionText` 为企微用户原文。
   * 返回值说明：命中未报备、未建商机、创建时长等客户统计语义时返回 `true`。
   * 调用注意事项：该判断只用于防止入口层误进帮助、日报或创建程序流；后续仍由分析意图、权限和联软 OpenAPI 执行层兜底。
   */
  private isReadOnlyCustomerLifecycleAnalysisQuestion(questionText: string): boolean {
    return /(客户).*((没有|未|无).{0,8}(报备|商机|报价|下单|订单)|未报备商机|未建商机|无商机|创建.{0,10}(多久|多长时间|时长|天数)|生命周期|沉睡)/u.test(
      questionText,
    );
  }

  /**
   * 识别企微空闲态消息是否为看板分析型问题。
   *
   * 参数说明：`questionText` 为企微用户原文。
   * 返回值说明：当消息同时包含看板信号词和分析意图词时返回 `true`。
   * 调用注意事项：该判断用于确定性路由看板分析请求到 ANALYZE，避免 AI 意图分类器
   * 把"代理商发展运营数据看板分析"误判为 ENTITY_LOOKUP（按名搜索商机/客户），
   * 返回"没查到可继续跟进的商机"之类的错误答案。
   * 典型命中场景：
   * - "代理商发展运营数据看板分析"
   * - "渠道商运营分析"
   * - "服务商数据运营看板"
   * - "经营分析看板"
   */
  private isDashboardAnalysisQuestion(questionText: string): boolean {
    const normalizedQuestion = questionText.replace(/\s+/gu, '').trim();
    if (!normalizedQuestion) {
      return false;
    }

    // 排除性过滤：筛选/明细类提问不应走看板桥接
    // 覆盖："近3个月没有维护进度的客户情况"、"最近3个月没有商机和订单的渠道商情况"
    // 四组排除模式，确保筛选类问题被完全拦截
    const isExclusionaryQuery =
      /没有.{0,8}(客户|商机|订单|报价|渠道商|代理商).{0,6}(情况|的|列表|明细)/u.test(normalizedQuestion) ||
      /无.{0,4}(进展|维护|跟进|商机|订单|更新|联系)/u.test(normalizedQuestion) ||
      /未.{0,4}(维护|跟进|进展|更新|联系)/u.test(normalizedQuestion) ||
      /没有.{0,6}(维护进度|跟进记录|商机和订单|维护记录)/u.test(normalizedQuestion);
    if (isExclusionaryQuery) {
      return false;
    }

    // 看板信号词：明确指向看板/运营分析场景
    const hasDashboardSignal = /(数据看板|看板分析|运营看板|经营看板|经营总览|经营概览|经营情况|发展运营|运营数据|运营分析|经营分析|数据运营)/u.test(
      normalizedQuestion,
    );

    // 分析意图词：确认用户想看分析结果而非查某个实体
    const hasAnalysisIntent = /(分析|看板|概览|总览|情况|汇总|统计|趋势|漏斗|分布|排名|排行|明细|建设|结构|贡献|阶段)/u.test(
      normalizedQuestion,
    );

    return hasDashboardSignal && hasAnalysisIntent;
  }

  /**
   * 判断消息是否命中 CRM 智能分析 300 问目录。
   *
   * 参数说明：`questionText` 为企微用户原文。
   * 返回值说明：命中 P0 模板目录时返回 `true`。
   * 调用注意事项：这里只纠正高频分析问题的入口误分流，真实数据仍由后续只读分析主链计算。
   */
  private isCrmAnalysisQuestionCatalogQuestion(questionText: string): boolean {
    const rule = resolveCrmAnalysisQuestionTemplateRuleByText(questionText);
    return rule?.priority === 'P0';
  }

  private resolveReadOnlyOpportunityDetailDecision(
    context: WecomConversationContextRecord,
    questionText: string,
  ): WecomConversationDecision | null {
    const normalizedQuestion = questionText.replace(/\s+/g, '').trim();
    if (!normalizedQuestion) {
      return null;
    }

    const hasOpportunityObject = /(商机|机会|项目)/u.test(normalizedQuestion);
    const hasReadVerb = /(查|看|查看|列出|展示|返回|给我|打开|输出)/u.test(
      normalizedQuestion,
    );
    const hasDetailSignal =
      /(明细|详情|列表|清单|全部|所有|这\d+条|这些|上面|刚才)/u.test(
        normalizedQuestion,
      );

    // 修复：当用户明确要求"表格呈现/表格方式/用表格"或"看板分析"时，这是分析型展示请求，
    // 应走 ANALYZE→detail 模式生成全量商机表格或看板，而非 ENTITY_LOOKUP 按名搜索。
    // 典型场景："把所有的商机，用表格方式呈现"——ENTITY_LOOKUP 会用问题全文做
    // LIKE 搜索商机标题，匹配不到任何记录，返回"没查到可继续跟进的商机"。
    // 同理"商机看板分析""商机数据看板"也应走 ANALYZE 而非 ENTITY_LOOKUP。
    const hasAnalysisPresentationSignal =
      /(表格呈现|表格方式|用表格|列成表格|成表格|表格形式|数据看板|看板分析|运营看板|经营看板)/u.test(
        normalizedQuestion,
      );
    if (
      hasOpportunityObject &&
      hasAnalysisPresentationSignal &&
      !this.hasExplicitOpportunityCreateIntent(normalizedQuestion)
    ) {
      return {
        action: 'ANALYZE',
        effectiveQuestionText: questionText,
        ...this.buildWecomDecisionSnapshots({
          questionText,
          targetWorkflow: 'ANALYSIS_QUERY_EXECUTION',
          replyIntent: 'RUN_NEW_ANALYSIS',
          usedFallback: true,
          fallbackReason:
            'readonly-opportunity-table-presentation-runs-analysis',
          structuredSlots: this.buildFreeQueryStructuredSlots('ANALYZE'),
        }),
        context,
      };
    }

    if (
      !hasOpportunityObject ||
      !hasReadVerb ||
      !hasDetailSignal ||
      this.hasExplicitOpportunityCreateIntent(normalizedQuestion)
    ) {
      return null;
    }

    if (
      (context.workMemory.latestQuestion || context.workMemory.latestSummary) &&
      this.shouldUseAnalysisConversationContext(questionText)
    ) {
      return {
        action: 'FOLLOW_UP_ANALYZE',
        effectiveQuestionText: context.workMemory.latestQuestion
          ? this.clarificationService.mergeFollowUpQuestion(
              this.buildFollowUpBaseQuestion(context),
              questionText,
            )
          : questionText,
        ...this.buildWecomDecisionSnapshots({
          questionText,
          targetWorkflow: 'ANALYSIS_QUERY_EXECUTION',
          replyIntent: 'RUN_NEW_ANALYSIS',
          usedFallback: true,
          fallbackReason: 'readonly-opportunity-detail-reuses-latest-analysis',
          structuredSlots: this.buildFreeQueryStructuredSlots('FOLLOW_UP_ANALYZE', {
            requestedDetailObject: 'Opportunity',
            latestQueryId: context.workMemory.latestQueryId,
          }),
        }),
        context,
      };
    }

    return {
      action: 'ENTITY_LOOKUP',
      effectiveQuestionText: questionText,
      entityLookupAction: 'LIST',
      entityLookupEntityType: 'Opportunity',
      entityLookupQueryText: questionText,
      ...this.buildWecomDecisionSnapshots({
        questionText,
        targetWorkflow: 'WECOM_ENTITY_LOOKUP',
        usedFallback: true,
        fallbackReason: 'readonly-opportunity-detail-entity-lookup',
        structuredSlots: this.buildFixedWorkflowStructuredSlots('ENTITY_LOOKUP', {
          entityLookupAction: 'LIST',
          entityType: 'Opportunity',
          queryText: questionText,
          confidence: 'HIGH',
        }),
      }),
      context,
    };
  }

  private hasExplicitOpportunityCreateIntent(questionText: string): boolean {
    return /(新增|新建|创建|录入|登记|报备|建一个|加一个).{0,12}(商机|机会|项目)|(商机|机会|项目).{0,12}(新增|新建|创建|录入|登记|报备)/u.test(
      questionText,
    );
  }

  updateEntityLookupMemory(
    context: WecomConversationContextRecord,
    params: Omit<WecomEntityLookupMemory, 'listItems'> & {
      listItems?: WecomEntityLookupListItem[];
    },
  ): WecomConversationContextRecord {
    return this.wecomConversationContextRepository.save({
      ...context,
      workMemory: {
        ...context.workMemory,
        entityLookupMemory: {
          mode: params.mode,
          entityType: params.entityType,
          queryText: params.queryText,
          listItems: params.listItems ?? [],
          selectedItemId: params.selectedItemId,
          source: params.source,
          expiresAt: params.expiresAt,
        },
      },
      updatedAt: new Date().toISOString(),
    });
  }

  clearEntityLookupMemory(
    context: WecomConversationContextRecord,
  ): WecomConversationContextRecord {
    return this.updateEntityLookupMemory(context, {
      mode: 'IDLE',
      entityType: undefined,
      queryText: undefined,
      listItems: [],
      selectedItemId: undefined,
      source: undefined,
      expiresAt: undefined,
    });
  }

  updateDailyReportMemory(
    context: WecomConversationContextRecord,
    params: {
      flowStatus: 'IDLE' | 'COLLECTING' | 'AWAITING_CONFIRMATION';
      reportId?: string;
      businessDate?: string;
      nextFragmentType?: DailyReportFragmentType;
      collectedFragmentTypes?: DailyReportFragmentType[];
      supervisorId?: string;
      supervisorName?: string;
      draftSummary?: string;
      entityLookupStatus?: 'IDLE' | 'AWAITING_CONFIRMATION';
      entityLookupStep?: 'INITIAL_CONFIRM' | 'BATCH_WRITEBACK_CONFIRM' | 'SELECT_TARGET';
      entityLookupText?: string;
      entityLookupQueryText?: string;
      entityLookupCompanyName?: string;
      entityLookupProjectName?: string;
      entityLookupCompanyNames?: string[];
      entityLookupProjectNames?: string[];
      entityLookupMatchedCompanyNames?: string[];
      entityLookupSummary?: string;
    },
  ): WecomConversationContextRecord {
    const isClearing = params.flowStatus === 'IDLE';
    return this.wecomConversationContextRepository.save({
      ...context,
      workMemory: {
        ...context.workMemory,
        dailyReportFlowStatus: params.flowStatus,
        dailyReportReportId: isClearing
          ? undefined
          : params.reportId ?? context.workMemory.dailyReportReportId,
        dailyReportBusinessDate: isClearing
          ? undefined
          : params.businessDate ?? context.workMemory.dailyReportBusinessDate,
        dailyReportNextFragmentType: isClearing
          ? undefined
          : params.nextFragmentType ?? context.workMemory.dailyReportNextFragmentType,
        dailyReportCollectedFragmentTypes: isClearing
          ? []
          : params.collectedFragmentTypes ??
            context.workMemory.dailyReportCollectedFragmentTypes ??
            [],
        dailyReportSupervisorId: isClearing
          ? undefined
          : params.supervisorId ?? context.workMemory.dailyReportSupervisorId,
        dailyReportSupervisorName: isClearing
          ? undefined
          : params.supervisorName ?? context.workMemory.dailyReportSupervisorName,
        dailyReportDraftSummary: isClearing
          ? undefined
          : params.draftSummary ?? context.workMemory.dailyReportDraftSummary,
        dailyReportEntityLookupStatus: isClearing
          ? 'IDLE'
          : params.entityLookupStatus ?? context.workMemory.dailyReportEntityLookupStatus,
        dailyReportEntityLookupStep: isClearing
          ? undefined
          : params.entityLookupStep ?? context.workMemory.dailyReportEntityLookupStep,
        dailyReportEntityLookupText: isClearing
          ? undefined
          : params.entityLookupText ?? context.workMemory.dailyReportEntityLookupText,
        dailyReportEntityLookupQueryText: isClearing
          ? undefined
          : params.entityLookupQueryText ??
            context.workMemory.dailyReportEntityLookupQueryText,
        dailyReportEntityLookupCompanyName: isClearing
          ? undefined
          : params.entityLookupCompanyName ?? context.workMemory.dailyReportEntityLookupCompanyName,
        dailyReportEntityLookupProjectName: isClearing
          ? undefined
          : params.entityLookupProjectName ?? context.workMemory.dailyReportEntityLookupProjectName,
        dailyReportEntityLookupCompanyNames: isClearing
          ? []
          : params.entityLookupCompanyNames ??
            context.workMemory.dailyReportEntityLookupCompanyNames ??
            [],
        dailyReportEntityLookupProjectNames: isClearing
          ? []
          : params.entityLookupProjectNames ??
            context.workMemory.dailyReportEntityLookupProjectNames ??
            [],
        dailyReportEntityLookupMatchedCompanyNames: isClearing
          ? []
          : params.entityLookupMatchedCompanyNames ??
            context.workMemory.dailyReportEntityLookupMatchedCompanyNames ??
            [],
        dailyReportEntityLookupSummary: isClearing
          ? undefined
          : params.entityLookupSummary ?? context.workMemory.dailyReportEntityLookupSummary,
      },
      updatedAt: new Date().toISOString(),
    });
  }

  clearDailyReportMemory(
    context: WecomConversationContextRecord,
  ): WecomConversationContextRecord {
    return this.updateFollowUpTemplateMemory(
      this.updateDailyReportMemory(context, {
        flowStatus: 'IDLE',
        collectedFragmentTypes: [],
      }),
      undefined,
    );
  }

  appendAssistantTurn(
    context: WecomConversationContextRecord,
    content: string,
    requestId?: string,
  ): WecomConversationContextRecord {
    return this.wecomConversationContextRepository.save({
      ...context,
      turns: this.compressTurns([
        ...context.turns,
        {
          role: 'assistant' as const,
          content,
          requestId,
          createdAt: new Date().toISOString(),
        },
      ]),
      summaryText: this.buildSummaryText(context, content),
      updatedAt: new Date().toISOString(),
    });
  }

  updateWorkMemoryAfterResponse(
    context: WecomConversationContextRecord,
    params: {
      questionText: string;
      queryId?: string;
      summary?: string;
      latestResultContext?: WecomLatestResultContext;
      pendingSlots?: string[];
    },
  ): WecomConversationContextRecord {
    return this.wecomConversationContextRepository.save({
      ...context,
      workMemory: {
        ...context.workMemory,
        latestQuestion: this.aiContextPolicyService.trimLatestQuestion(
          params.questionText,
        ),
        latestQueryId: params.queryId ?? context.workMemory.latestQueryId,
        latestSummary: this.aiContextPolicyService.trimLatestSummary(
          params.summary ?? context.workMemory.latestSummary,
        ),
        latestResultContext:
          params.latestResultContext ?? context.workMemory.latestResultContext,
        pendingSlots: params.pendingSlots ?? [],
      },
      updatedAt: new Date().toISOString(),
    });
  }

  applyContextPolicy(
    context: WecomConversationContextRecord,
    referenceAt: string,
  ): WecomConversationContextRecord {
    const shouldExpireTaskMemory =
      this.hasActiveTaskMemory(context) &&
      this.aiContextPolicyService.isTaskSessionExpired(
        context.updatedAt,
        referenceAt,
      );
    const shouldExpireAnalysisMemory =
      this.hasAnalysisMemory(context) &&
      this.aiContextPolicyService.isAnalysisSessionExpired(
        context.updatedAt,
        referenceAt,
      );

    if (!shouldExpireTaskMemory && !shouldExpireAnalysisMemory) {
      return context;
    }

    const nextWorkMemory = {
      ...context.workMemory,
      ...(shouldExpireTaskMemory ? this.buildClearedTaskWorkMemory() : {}),
      ...(shouldExpireAnalysisMemory ? this.buildClearedAnalysisWorkMemory() : {}),
    };

    return this.wecomConversationContextRepository.save({
      ...context,
      workMemory: nextWorkMemory,
      updatedAt: referenceAt,
    });
  }

  updateEntryRoutingMemory(
    context: WecomConversationContextRecord,
    params: {
      entryInterpretationSnapshot?: AiEntryInterpretationSnapshot;
      workflowRoutingSnapshot?: AiWorkflowRoutingSnapshot;
    },
  ): WecomConversationContextRecord {
    return this.wecomConversationContextRepository.save({
      ...context,
      workMemory: {
        ...context.workMemory,
        latestEntryInterpretationSnapshot:
          params.entryInterpretationSnapshot ??
          context.workMemory.latestEntryInterpretationSnapshot,
        latestWorkflowRoutingSnapshot:
          params.workflowRoutingSnapshot ??
          context.workMemory.latestWorkflowRoutingSnapshot,
      },
      updatedAt: new Date().toISOString(),
    });
  }

  updateFollowUpWritebackMemory(
    context: WecomConversationContextRecord,
    params: {
      activeId?: string;
      status?: FollowUpWritebackStatus;
      objectType?: FollowUpLoggableType;
      objectId?: string;
      objectTitle?: string;
      opportunityId?: string;
      opportunityTitle?: string;
      draftContent?: string;
      failureReason?: string;
      shareStatus?: FollowUpShareStatus;
      shareTargetId?: string;
      shareChatType?: WecomInboundMessage['chatType'];
      shareFailureReason?: string;
    },
  ): WecomConversationContextRecord {
    return this.wecomConversationContextRepository.save({
      ...context,
      workMemory: {
        ...context.workMemory,
        activeFollowUpWritebackId:
          params.activeId ?? context.workMemory.activeFollowUpWritebackId,
        followUpWritebackStatus:
          params.status ?? context.workMemory.followUpWritebackStatus,
        followUpWritebackObjectType:
          params.objectType ?? context.workMemory.followUpWritebackObjectType,
        followUpWritebackObjectId:
          params.objectId ??
          params.opportunityId ??
          context.workMemory.followUpWritebackObjectId,
        followUpWritebackObjectTitle:
          params.objectTitle ??
          params.opportunityTitle ??
          context.workMemory.followUpWritebackObjectTitle,
        followUpWritebackOpportunityId:
          params.opportunityId ??
          params.objectId ??
          context.workMemory.followUpWritebackOpportunityId,
        followUpWritebackOpportunityTitle:
          params.opportunityTitle ??
          params.objectTitle ??
          context.workMemory.followUpWritebackOpportunityTitle,
        followUpWritebackDraftContent:
          params.draftContent ?? context.workMemory.followUpWritebackDraftContent,
        followUpWritebackFailureReason:
          params.failureReason ?? context.workMemory.followUpWritebackFailureReason,
        followUpShareStatus:
          params.shareStatus ?? context.workMemory.followUpShareStatus,
        followUpShareTargetId:
          params.shareTargetId ?? context.workMemory.followUpShareTargetId,
        followUpShareChatType:
          params.shareChatType ?? context.workMemory.followUpShareChatType,
        followUpShareFailureReason:
          params.shareFailureReason ?? context.workMemory.followUpShareFailureReason,
      },
      updatedAt: new Date().toISOString(),
    });
  }

  clearFollowUpWritebackMemory(
    context: WecomConversationContextRecord,
  ): WecomConversationContextRecord {
    return this.wecomConversationContextRepository.save({
      ...context,
      workMemory: {
        ...context.workMemory,
        activeFollowUpWritebackId: undefined,
        followUpWritebackStatus: undefined,
        followUpWritebackObjectType: undefined,
        followUpWritebackObjectId: undefined,
        followUpWritebackObjectTitle: undefined,
        followUpWritebackOpportunityId: undefined,
        followUpWritebackOpportunityTitle: undefined,
        followUpWritebackDraftContent: undefined,
        followUpWritebackFailureReason: undefined,
        followUpShareStatus: 'IDLE',
        followUpShareTargetId: undefined,
        followUpShareChatType: undefined,
        followUpShareFailureReason: undefined,
      },
      updatedAt: new Date().toISOString(),
    });
  }

  updateFollowUpTemplateMemory(
    context: WecomConversationContextRecord,
    draft?: WecomFollowUpTemplateDraft,
  ): WecomConversationContextRecord {
    return this.wecomConversationContextRepository.save({
      ...context,
      workMemory: {
        ...context.workMemory,
        followUpTemplateDraft: draft,
      },
      updatedAt: new Date().toISOString(),
    });
  }

  clearFollowUpTemplateMemory(
    context: WecomConversationContextRecord,
  ): WecomConversationContextRecord {
    return this.updateFollowUpTemplateMemory(context, undefined);
  }

  updateCrmCreateMemory(
    context: WecomConversationContextRecord,
    params: {
      status?: 'COLLECTING' | 'AWAITING_CONFIRMATION' | 'COMPLETED' | 'FAILED';
      entityType?: CrmCreateEntityType;
      customerDraft?: WecomCustomerCreateDraft;
      opportunityDraft?: WecomOpportunityCreateDraft;
      failureReason?: string;
      resultId?: string;
      resultSummary?: string;
    },
  ): WecomConversationContextRecord {
    return this.wecomConversationContextRepository.save({
      ...context,
      workMemory: {
        ...context.workMemory,
        crmCreateStatus: params.status ?? context.workMemory.crmCreateStatus,
        crmCreateEntityType:
          params.entityType ?? context.workMemory.crmCreateEntityType,
        crmCreateCustomerDraft:
          params.customerDraft ?? context.workMemory.crmCreateCustomerDraft,
        crmCreateOpportunityDraft:
          params.opportunityDraft ?? context.workMemory.crmCreateOpportunityDraft,
        crmCreateFailureReason:
          params.failureReason ?? context.workMemory.crmCreateFailureReason,
        crmCreateResultId:
          params.resultId ?? context.workMemory.crmCreateResultId,
        crmCreateResultSummary:
          params.resultSummary ?? context.workMemory.crmCreateResultSummary,
      },
      updatedAt: new Date().toISOString(),
    });
  }

  clearCrmCreateMemory(
    context: WecomConversationContextRecord,
  ): WecomConversationContextRecord {
    return this.wecomConversationContextRepository.save({
      ...context,
      workMemory: {
        ...context.workMemory,
        crmCreateStatus: undefined,
        crmCreateEntityType: undefined,
        crmCreateCustomerDraft: undefined,
        crmCreateOpportunityDraft: undefined,
        crmCreateFailureReason: undefined,
        crmCreateResultId: undefined,
        crmCreateResultSummary: undefined,
      },
      updatedAt: new Date().toISOString(),
    });
  }

  private buildSummaryText(
    context: WecomConversationContextRecord,
    latestAssistantReply: string,
  ): string {
    const latestUserTurn = [...context.turns]
      .reverse()
      .find((item) => item.role === 'user');
    return (
      this.aiContextPolicyService.trimLatestSummary(
        [
      latestUserTurn ? `最近用户问题：${latestUserTurn.content}` : undefined,
      `最近助手回复：${latestAssistantReply}`,
    ]
      .filter(Boolean)
          .join('；'),
      ) ?? ''
    );
  }

  private buildWecomDecisionSnapshots(params: {
    questionText: string;
    targetWorkflow: AiEntryInterpretationSnapshot['targetWorkflow'];
    replyIntent?: string;
    usedFallback: boolean;
    fallbackReason?: string;
    validationFailureReason?: string;
    packCode?: string;
    packVersion?: string;
    providerCode?: string;
    model?: string;
    structuredSlots?: Record<string, unknown>;
  }): Pick<
    WecomConversationDecision,
    'entryInterpretationSnapshot' | 'workflowRoutingSnapshot'
  > {
    return {
      entryInterpretationSnapshot: createAiEntryInterpretationSnapshot({
        channel: 'wecom-bot',
        scene: 'WECOM_IDLE_MESSAGE',
        targetWorkflow: params.targetWorkflow,
        originalText: params.questionText,
        intent:
          params.replyIntent === 'HELP_GUIDANCE'
            ? 'HELP_GUIDANCE'
            : params.targetWorkflow === 'WECOM_ENTITY_LOOKUP'
              ? 'ENTITY_LOOKUP'
            : params.replyIntent === 'EXPLAIN_RESULT'
              ? 'EXPLAIN_RESULT'
            : params.replyIntent === 'REDISPLAY_RESULT'
              ? 'EXPLAIN_RESULT'
              : params.replyIntent === 'RUN_NEW_ANALYSIS'
                ? 'FOLLOW_UP_ANALYZE'
                : params.targetWorkflow === 'ANALYSIS_QUERY_EXECUTION'
                  ? 'ANALYZE'
                  : 'UNKNOWN',
        requestedAction: 'READONLY_ANALYSIS',
        replyIntent: params.replyIntent,
        confidence: params.usedFallback ? 'MEDIUM' : 'HIGH',
        usedFallback: params.usedFallback,
        fallbackReason: params.fallbackReason,
        validationFailureReason: params.validationFailureReason,
        packCode: params.packCode,
        packVersion: params.packVersion,
        providerCode: params.providerCode,
        model: params.model,
        structuredSlots: params.structuredSlots,
        generatedAt: new Date().toISOString(),
      }),
      workflowRoutingSnapshot: createAiWorkflowRoutingSnapshot({
        targetWorkflow: params.targetWorkflow,
        finalProgram: 'wecom-ai-conversation-orchestration.decideNextAction',
        requiresConfirmation: false,
        gateResult: 'BYPASSED',
        generatedAt: new Date().toISOString(),
      }),
    };
  }

  private buildFixedWorkflowStructuredSlots(
    fixedWorkflow: WecomFixedWorkflowAction,
    extra?: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      entryMode: 'FIXED_WORKFLOW',
      fixedWorkflow,
      ...(extra ?? {}),
    };
  }

  private buildFreeQueryStructuredSlots(
    freeQueryIntent: WecomFreeQueryAction,
    extra?: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      entryMode: 'FREE_QUERY',
      freeQueryIntent,
      ...(extra ?? {}),
    };
  }

  buildActiveTaskReplySnapshots(params: {
    questionText: string;
    targetWorkflow: AiEntryInterpretationSnapshot['targetWorkflow'];
    replyIntent: string;
    usedFallback: boolean;
    fallbackReason?: string;
    validationFailureReason?: string;
    packCode?: string;
    packVersion?: string;
    providerCode?: string;
    model?: string;
    structuredSlots?: Record<string, unknown>;
  }): Pick<
    WecomConversationDecision,
    'entryInterpretationSnapshot' | 'workflowRoutingSnapshot'
  > {
    return {
      entryInterpretationSnapshot: createAiEntryInterpretationSnapshot({
        channel: 'wecom-bot',
        scene: 'WECOM_ACTIVE_TASK_REPLY',
        targetWorkflow: params.targetWorkflow,
        originalText: params.questionText,
        intent:
          params.replyIntent === 'HELP_GUIDANCE'
            ? 'HELP_GUIDANCE'
            : params.replyIntent === 'TASK_CANCEL'
              ? 'TASK_CANCEL'
              : params.replyIntent === 'TASK_SWITCH'
                ? 'TASK_SWITCH'
                : params.replyIntent === 'CONTINUE_EXECUTION'
                  ? 'CONTINUE'
                  : params.replyIntent === 'MODIFY_CONTENT'
                    ? 'MODIFY'
                    : 'UNKNOWN',
        requestedAction: 'READONLY_ANALYSIS',
        replyIntent: params.replyIntent,
        confidence: params.usedFallback ? 'MEDIUM' : 'HIGH',
        usedFallback: params.usedFallback,
        fallbackReason: params.fallbackReason,
        validationFailureReason: params.validationFailureReason,
        packCode: params.packCode,
        packVersion: params.packVersion,
        providerCode: params.providerCode,
        model: params.model,
        structuredSlots: params.structuredSlots,
        generatedAt: new Date().toISOString(),
      }),
      workflowRoutingSnapshot: createAiWorkflowRoutingSnapshot({
        targetWorkflow: params.targetWorkflow,
        finalProgram: 'wecom-bot.processInboundMessage.activeTaskReply',
        requiresConfirmation: false,
        gateResult: 'BYPASSED',
        generatedAt: new Date().toISOString(),
      }),
    };
  }

  private hasActiveDailyReport(context: WecomConversationContextRecord): boolean {
    return context.workMemory.dailyReportFlowStatus === 'COLLECTING' ||
      context.workMemory.dailyReportFlowStatus === 'AWAITING_CONFIRMATION' ||
      context.workMemory.dailyReportEntityLookupStatus === 'AWAITING_CONFIRMATION';
  }

  private getDailyReportFirstStep(): DailyReportFragmentType {
    return 'TODAY_FOLLOW_UP';
  }

  private compressTurns(
    turns: WecomConversationContextRecord['turns'],
  ): WecomConversationContextRecord['turns'] {
    const turnRetentionLimit =
      this.aiContextPolicyService.getCurrent().turnRetentionLimit;
    if (turns.length <= turnRetentionLimit) {
      return turns;
    }

    const recentTurnCount = Math.max(turnRetentionLimit - 1, 1);
    const recentTurns = turns.slice(-recentTurnCount);
    const historySummary =
      this.aiContextPolicyService.trimHistorySummary(
        turns
          .slice(0, -recentTurnCount)
          .map((item) => `${item.role === 'user' ? '用户' : '助手'}：${item.content}`)
            .join('；'),
      ) ?? '历史上下文已压缩';

    return [
      {
        role: 'system',
        content: `历史摘要：${historySummary}`,
        createdAt: new Date().toISOString(),
      },
      ...recentTurns,
    ];
  }

  private hasAnalysisMemory(context: WecomConversationContextRecord): boolean {
    return Boolean(
      context.workMemory.latestQuestion ||
        context.workMemory.latestSummary ||
        context.workMemory.latestResultContext ||
        context.workMemory.pendingSlots.length > 0,
    );
  }

  private hasActiveTaskMemory(context: WecomConversationContextRecord): boolean {
    return (
      this.hasActiveDailyReport(context) ||
      Boolean(context.workMemory.followUpTemplateDraft) ||
      Boolean(context.workMemory.activeFollowUpWritebackId) ||
      context.workMemory.followUpShareStatus === 'AWAITING_CONFIRMATION' ||
      Boolean(context.workMemory.crmCreateStatus) ||
      context.workMemory.entityLookupMemory?.mode === 'LIST_RETURNED'
    );
  }

  private buildClearedAnalysisWorkMemory(): Partial<WecomConversationContextRecord['workMemory']> {
    return {
      latestQuestion: undefined,
      latestQueryId: undefined,
      latestSummary: undefined,
      latestResultContext: undefined,
      latestEntryInterpretationSnapshot: undefined,
      latestWorkflowRoutingSnapshot: undefined,
      pendingSlots: [],
    };
  }

  private buildClearedTaskWorkMemory(): Partial<WecomConversationContextRecord['workMemory']> {
    return {
      dailyReportFlowStatus: 'IDLE',
      dailyReportReportId: undefined,
      dailyReportBusinessDate: undefined,
      dailyReportNextFragmentType: undefined,
      dailyReportCollectedFragmentTypes: [],
      dailyReportSupervisorId: undefined,
      dailyReportSupervisorName: undefined,
      dailyReportDraftSummary: undefined,
      dailyReportEntityLookupStatus: 'IDLE',
      dailyReportEntityLookupStep: undefined,
      dailyReportEntityLookupText: undefined,
      dailyReportEntityLookupQueryText: undefined,
      dailyReportEntityLookupCompanyName: undefined,
      dailyReportEntityLookupProjectName: undefined,
      dailyReportEntityLookupCompanyNames: [],
      dailyReportEntityLookupProjectNames: [],
      dailyReportEntityLookupMatchedCompanyNames: [],
      dailyReportEntityLookupSummary: undefined,
      activeFollowUpWritebackId: undefined,
      followUpWritebackStatus: undefined,
      followUpWritebackOpportunityId: undefined,
      followUpWritebackOpportunityTitle: undefined,
      followUpWritebackDraftContent: undefined,
      followUpWritebackFailureReason: undefined,
      followUpShareStatus: 'IDLE',
      followUpShareTargetId: undefined,
      followUpShareChatType: undefined,
      followUpShareFailureReason: undefined,
      followUpTemplateDraft: undefined,
      entityLookupMemory: {
        mode: 'IDLE',
        listItems: [],
      },
      crmCreateStatus: undefined,
      crmCreateEntityType: undefined,
      crmCreateCustomerDraft: undefined,
      crmCreateOpportunityDraft: undefined,
      crmCreateFailureReason: undefined,
      crmCreateResultId: undefined,
      crmCreateResultSummary: undefined,
    };
  }
}

import { Injectable, OnModuleInit } from '@nestjs/common';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  AuditEventType,
  CrmCreateEntityType,
  CrmUser,
  DailyReportFragmentType,
  PendingFollowUpWritebackRecord,
  QuerySessionRecord,
  StreamBlock,
  AppliedFilter,
  WecomInboundMessage,
  WecomConversationContextRecord,
  WecomLatestResultContext,
  WecomMessageReceiptRecord,
  WecomCustomerCreateDraft,
  WecomFollowUpTemplateDraft,
  WecomOpportunityCreateDraft,
  ResultView,
} from '../../shared/types/domain';
import { buildEntityId } from '../../shared/utils/id.util';
import {
  createAiEntryInterpretationSnapshot,
  createAiWorkflowRoutingSnapshot,
} from '../../shared/utils/ai-entry-intent.util';
import { UnauthorizedException } from '@nestjs/common';
import { AnalysisService } from '../analysis/analysis.service';
import { AiGatewayService } from '../analysis/ai-gateway.service';
import { buildAnalysisWecomMarkdown } from '../analysis/analysis-markdown.util';
import type {
  AnalysisForecastInsight,
  AnalysisInsightItem,
  AnalysisKeyFinding,
  AnalysisRecommendationItem,
  AnalysisTrendInsight,
  MetricCard,
} from '../../shared/types/domain';
import { AuditEventRepository } from '../audit/audit-event.repository';
import { AnalysisRequestRepository } from '../analysis/analysis-request.repository';
import { AuditEventBuilderService } from '../audit/audit-event-builder.service';
import { AuthSessionRepository } from '../auth/auth-session.repository';
import { CrmReadonlyService } from '../../database/crm-readonly/crm-readonly.service';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';
import { UserScopeService } from '../auth/user-scope.service';
import { PermissionEnforcementService } from '../governance/permission-enforcement.service';
import { DailyReportService } from '../daily-report/daily-report.service';
import { QuerySessionRepository } from '../sessions/query-session.repository';
import { WecomAuthService } from './wecom-auth.service';
import {
  WecomAiConversationOrchestrationService,
  type WecomConversationDecision,
} from './wecom-ai-conversation-orchestration.service';
import {
  WECOM_DAILY_REPORT_CONFIRM_KEYWORDS,
  WECOM_DAILY_REPORT_REVISE_KEYWORDS,
  WECOM_FOLLOW_UP_SHARE_CANCEL_KEYWORDS,
  WECOM_FOLLOW_UP_SHARE_CONFIRM_KEYWORDS,
  WECOM_TASK_CANCEL_KEYWORDS,
  isWecomDailyReportThemeEntryIntent,
  isWecomDailyReportThemeOnlyMessage,
  isWecomDailyReportEntryOnlyMessage,
  isWecomDailyReportSelfViewIntent,
  WECOM_FOLLOW_UP_WRITEBACK_CANCEL_KEYWORDS,
  WECOM_FOLLOW_UP_WRITEBACK_CONFIRM_KEYWORDS,
  WECOM_FOLLOW_UP_WRITEBACK_MODIFY_KEYWORDS,
  WECOM_FOLLOW_UP_WRITEBACK_RETRY_KEYWORDS,
  buildWecomDailyReportEntityQueryResultPrompt,
  buildWecomDailyReportPrompt,
  buildWecomDailyReportReviewPrompt,
  buildWecomDailyReportThemeEntryPrompt,
  buildWecomFollowUpTemplateCollectPrompt,
  buildWecomFollowUpTemplateEntryPrompt,
  buildWecomFollowUpWritebackContentPrompt,
  buildWecomFollowUpWritebackIntentPrompt,
  buildWecomFollowUpShareMarkdown,
  buildWecomFollowUpSharePrompt,
  buildWecomFollowUpShareSuccessPrompt,
  buildWecomFollowUpShareUnsupportedPrompt,
  buildWecomFollowUpWritebackSuccessPrompt,
  buildWecomDailyReportSharePrompt,
  buildWecomHelpPrompt,
  buildWecomTaskCancelledPrompt,
  buildWecomTaskSwitchLeadInPrompt,
  detectWecomHelpIntent,
  getWecomDailyReportNextStep,
  parseWecomTeamDailyReportPreviewIntent,
  resolveWecomHelpPromptSceneFromBlockedReason,
  WECOM_FOLLOW_UP_POST_WRITEBACK_REMINDER_HINT,
} from './wecom-ai-prompt.config';
import {
  DAILY_REPORT_SECTION_LABELS,
  DAILY_REPORT_SECTION_ORDER,
} from '../daily-report/daily-report.constants';
import {
  WecomDailyReportIntakeService,
  type WecomDailyReportIntakeResult,
} from './wecom-daily-report-intake.service';
import { WecomDeliveryRecordRepository } from './wecom-delivery-record.repository';
import {
  WecomMaintenanceDegradationError,
  WecomMaintenanceDegradationService,
} from './wecom-maintenance-degradation.service';
import { WecomMessageAdapterService } from './wecom-message-adapter.service';
import { WecomMessageReceiptRepository } from './wecom-message-receipt.repository';
import type {
  WecomInboundEnvelope,
  WecomCrmCreatePayload,
  WecomDispatchImageAttachment,
  WecomDispatchTemplateCard,
  WecomReceiveMessageResult,
  WecomFollowUpWritebackPayload,
} from './wecom-message.types';
import { WecomAnalysisTableImageService } from './wecom-analysis-table-image.service';
import { WecomStreamDispatcherService } from './wecom-stream-dispatcher.service';
import { WecomTransportService } from './wecom-transport.service';
import { WecomEntityLookupService } from './wecom-entity-lookup.service';
import { CrmBuiltinAccountTokenService } from '../opportunities/crm-builtin-account-token.service';
import {
  CrmFollowUpWritebackService,
  type FollowUpDraft,
} from '../opportunities/crm-follow-up-writeback.service';
import { CrmCustomerApiService } from '../opportunities/crm-customer-api.service';
import {
  FollowUpAuthorizationService,
  type FollowUpAuthorizationResult,
} from '../opportunities/follow-up-authorization.service';
import { FollowUpAuthorizationTargetService } from '../opportunities/follow-up-authorization-target.service';
import { CrmOpportunityApiService } from '../opportunities/crm-opportunity-api.service';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import { FollowUpWritebackRepository } from './follow-up-writeback.repository';
import { resolveCrmAnalysisQuestionTemplateRuleByText } from '../analysis/crm-analysis-question-template.registry';
import {
  buildCrmCreateDuplicatePrompt,
  buildCrmCreateSuccessPrompt,
  buildCustomerCreateCollectPrompt,
  buildCustomerCreateEntryPrompt,
  buildCustomerCreateSummaryPrompt,
  buildOpportunityCreateCollectPrompt,
  buildOpportunityCreateEntryPrompt,
  buildOpportunityCreateSummaryPrompt,
  detectWecomCrmCreateIntent,
  getMissingCustomerFields,
  getMissingOpportunityFields,
  isWecomCrmCreateCancelMessage,
  isWecomCrmCreateConfirmMessage,
  isWecomCrmCreateRetryMessage,
  parseCustomerDraftUpdates,
  parseOpportunityDraftUpdates,
  selectCustomerCandidateByReply,
} from './wecom-crm-create.helper';
import {
  buildWecomFollowUpTemplateFinalContent,
  buildWecomFollowUpTemplateFilledLines,
  buildWecomFollowUpTemplateOptionalMissingPrompt,
  createWecomFollowUpTemplateDraft,
  getMissingWecomFollowUpTemplateLabels,
  getOptionalMissingWecomFollowUpTemplateLabels,
  hasRequiredWecomFollowUpTemplateContent,
  isWecomFollowUpTemplateDirectSubmitIntent,
  mergeWecomFollowUpTemplateDrafts,
  normalizeWecomFollowUpTemplateFinalContent,
  parseWecomFollowUpTemplateFreeformDraft,
  parseWecomFollowUpTemplateUpdates,
} from './wecom-follow-up-template.helper';
import {
  buildWecomCandidateDisplayLine,
  parseWecomCandidateSelectionIndex,
  rankWecomCandidatesWithAiRecommendation,
  selectWecomCandidateByReply,
} from './wecom-candidate-selection.helper';
import {
  isWecomAffirmativeReply,
  matchesWecomExactReply,
} from './wecom-reply-intent.helper';
import { WecomDashboardCardBuilder } from './wecom-dashboard-card-builder.service';
import { WecomDashboardKpiSelectorService } from './wecom-dashboard-kpi-selector.service';
import { WecomDashboardMarkdownRendererService } from './wecom-dashboard-markdown-renderer.service';
import { WecomDashboardTemplateResolverService } from './wecom-dashboard-template-resolver.service';
import { DashboardReportComposer } from '../crm-standard-api/dashboard-report-composer.service';
import type { DashboardComposeResult, DashboardBlock } from '../crm-standard-api/dashboard-report-composer.service';

interface WecomProgressFeedbackHandle {
  cancel(): void;
}

interface DailyReportEntityLookupResult {
  queryResultLine: string;
  targetLabel: string;
  targetName: string;
  objectLabel: '商机' | '客户';
  candidateNames: string[];
  candidateLines?: string[];
  candidateDrafts?: Array<{
    name: string;
    draft: FollowUpDraft;
  }>;
  draft?: FollowUpDraft;
}

type WecomActiveTaskKind =
  | 'FOLLOW_UP_WRITEBACK'
  | 'FOLLOW_UP_SHARE'
  | 'CUSTOMER_CREATE'
  | 'OPPORTUNITY_CREATE'
  | 'FOLLOW_UP_TEMPLATE'
  | 'DAILY_REPORT';

interface WecomActiveTaskSnapshot {
  kind: WecomActiveTaskKind;
  label: string;
  writebackRecord?: PendingFollowUpWritebackRecord;
}

type WecomTaskSwitchTarget =
  | 'DAILY_REPORT_ENTRY'
  | 'DAILY_REPORT_QUERY'
  | 'TEAM_DAILY_REPORT_QUERY'
  | 'FOLLOW_UP_TEMPLATE'
  | 'CRM_CREATE_CUSTOMER'
  | 'CRM_CREATE_OPPORTUNITY'
  | 'ENTITY_LOOKUP';

interface WecomTaskSwitchIntent {
  target: WecomTaskSwitchTarget;
  leaderNameQuery?: string;
}

interface WecomTaskReplyRuntimeMetadata {
  packCode?: string;
  packVersion?: string;
  providerCode?: string;
  model?: string;
  validationFailureReason?: string;
}

interface WecomAnalysisImageSource {
  title?: string;
  summary?: string;
  variant?: WecomAnalysisImageVariant;
  rows: Array<Record<string, unknown>>;
  signature: string;
}

type WecomAnalysisImageVariant = 'ranking' | 'trend' | 'distribution' | 'map' | 'summary';

interface DashboardPublicSection {
  sectionType: string;
  title: string;
  description?: string;
  rows?: Array<Record<string, unknown>>;
  items?: string[];
  chartType?: string;
  chartData?: Record<string, unknown>;
}

interface DashboardCardImageBundle {
  imageUrl?: string;
  imageAspectRatio?: number;
  imageAttachments: WecomDispatchImageAttachment[];
}

type WecomTaskReplyIntentLike = WecomTaskReplyRuntimeMetadata & {
  intent?: string;
};

@Injectable()
export class WecomBotService implements OnModuleInit {
  constructor(
    private readonly wecomAuthService: WecomAuthService,
    private readonly wecomAiConversationOrchestrationService: WecomAiConversationOrchestrationService,
    private readonly wecomMessageAdapterService: WecomMessageAdapterService,
    private readonly wecomMessageReceiptRepository: WecomMessageReceiptRepository,
    private readonly wecomDeliveryRecordRepository: WecomDeliveryRecordRepository,
    private readonly wecomMaintenanceDegradationService: WecomMaintenanceDegradationService,
    private readonly authSessionRepository: AuthSessionRepository,
    private readonly crmReadonlyService: CrmReadonlyService,
    private readonly localRuntimeConfigService: LocalRuntimeConfigService,
    private readonly querySessionRepository: QuerySessionRepository,
    private readonly analysisService: AnalysisService,
    private readonly analysisLoggerService: AnalysisLoggerService,
    private readonly aiGatewayService: AiGatewayService,
    private readonly dailyReportService: DailyReportService,
    private readonly wecomDailyReportIntakeService: WecomDailyReportIntakeService,
    private readonly customerLookupService: CrmCustomerApiService,
    private readonly opportunityLookupService: CrmOpportunityApiService,
    private readonly followUpAuthorizationService: FollowUpAuthorizationService,
    private readonly followUpAuthorizationTargetService: FollowUpAuthorizationTargetService,
    private readonly crmBuiltinAccountTokenService: CrmBuiltinAccountTokenService,
    private readonly crmFollowUpWritebackService: CrmFollowUpWritebackService,
    private readonly followUpWritebackRepository: FollowUpWritebackRepository,
    private readonly wecomAnalysisTableImageService: WecomAnalysisTableImageService,
    private readonly wecomStreamDispatcherService: WecomStreamDispatcherService,
    private readonly wecomTransportService: WecomTransportService,
    private readonly wecomEntityLookupService: WecomEntityLookupService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly userScopeService: UserScopeService,
    private readonly permissionEnforcementService: PermissionEnforcementService,
    private readonly auditEventBuilderService: AuditEventBuilderService,
    private readonly dashboardReportComposer: DashboardReportComposer,
    private readonly analysisRequestRepository: AnalysisRequestRepository,
    private readonly wecomDashboardCardBuilder: WecomDashboardCardBuilder,
    private readonly wecomDashboardTemplateResolverService: WecomDashboardTemplateResolverService,
    private readonly wecomDashboardKpiSelectorService: WecomDashboardKpiSelectorService,
    private readonly wecomDashboardMarkdownRendererService: WecomDashboardMarkdownRendererService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.wecomTransportService.startInboundListener(async (payload) => {
        await this.receiveSdkMessage(payload);
      });
    } catch (error) {
      this.analysisLoggerService.logWarn(
        '企业微信机器人入站监听启动失败，已降级跳过本次监听初始化。',
        {
          reason: error instanceof Error ? error.message : String(error ?? 'unknown'),
        },
      );
    }
  }

  async receiveMessage(
    envelope: WecomInboundEnvelope,
  ): Promise<WecomReceiveMessageResult> {
    let inboundMessage: WecomInboundMessage | undefined;
    try {
      this.wecomAuthService.validateSignature(envelope.signature);
      this.wecomAuthService.validateSource(envelope.source);
      inboundMessage = this.wecomMessageAdapterService.normalizeIncomingMessage(
        envelope.body,
      );
      return await this.processInboundMessage(inboundMessage, {
        deliverErrorsToChat: false,
      });
    } catch (error) {
      return await this.handleReceiveError(error, inboundMessage, envelope.body, {
        deliverToChat: false,
      });
    }
  }

  async receiveSdkMessage(
    body: Record<string, unknown>,
  ): Promise<WecomReceiveMessageResult> {
    let inboundMessage: WecomInboundMessage | undefined;
    try {
      inboundMessage = this.wecomMessageAdapterService.normalizeIncomingMessage(body);
      return await this.processInboundMessage(inboundMessage, {
        deliverErrorsToChat: true,
      });
    } catch (error) {
      return await this.handleReceiveError(error, inboundMessage, body, {
        deliverToChat: true,
      });
    }
  }

  getSession(sessionId: string): QuerySessionRecord | undefined {
    return this.querySessionRepository.findById(sessionId);
  }

  getMessageReceipt(channelMessageId: string): Record<string, unknown> | undefined {
    const receipt =
      this.wecomMessageReceiptRepository.findByChannelMessageId(channelMessageId);
    if (!receipt) {
      return undefined;
    }

    return {
      ...receipt,
      deliveryRecords: this.wecomDeliveryRecordRepository.listByReceiptId(receipt.id),
    };
  }

  private async processInboundMessage(
    inboundMessage: WecomInboundMessage,
    options: {
      deliverErrorsToChat: boolean;
    },
  ): Promise<WecomReceiveMessageResult> {
    let progressFeedbackHandle: WecomProgressFeedbackHandle | undefined;
    let progressStreamId: string | undefined;
    try {
      await this.auditRecoveryIfNeeded(
        await this.wecomMaintenanceDegradationService.assertStorageAvailable(),
        'storage',
        inboundMessage,
      );

      const existingReceipt =
        this.wecomMessageReceiptRepository.findByChannelMessageId(
          inboundMessage.channelMessageId,
        );
      if (existingReceipt) {
        return {
          receiptId: existingReceipt.id,
          sessionId: existingReceipt.sessionId,
          queryId: existingReceipt.queryId,
          status: existingReceipt.status,
          acceptedAt: existingReceipt.createdAt,
          deduplicated: true,
        };
      }

      const preflightReceipt = this.wecomMessageReceiptRepository.save({
        id: buildEntityId('receipt'),
        channelMessageId: inboundMessage.channelMessageId,
        externalConversationId: inboundMessage.externalConversationId,
        senderId: inboundMessage.senderId,
        chatType: inboundMessage.chatType,
        messageType: inboundMessage.messageType,
        status: 'ACCEPTED',
        rawPayloadSummary:
          this.wecomMessageAdapterService.summarizePayload(inboundMessage.rawPayload),
        createdAt: inboundMessage.receivedAt,
        updatedAt: inboundMessage.receivedAt,
      });
      progressFeedbackHandle = await this.startProgressFeedback(
        preflightReceipt.id,
        buildEntityId('session'),
        inboundMessage,
        inboundMessage.messageText,
      );
      progressStreamId = preflightReceipt.id;

      const businessActionsEnabled = this.areWecomBusinessActionsEnabled();
      if (businessActionsEnabled) {
        await this.auditRecoveryIfNeeded(
          await this.wecomMaintenanceDegradationService.assertIdentitySourceAvailable(),
          'identity',
          inboundMessage,
        );
      }

      const cachedSession = this.querySessionRepository.findByWecomConversation(
        inboundMessage.externalConversationId,
        inboundMessage.senderId,
      );
      const user = cachedSession
        ? await this.wecomAuthService.resolveSenderFromSessionCache({
            senderId: inboundMessage.senderId,
            requesterId: cachedSession.requesterId,
            targetChannel: 'wecom-bot',
          })
        : await this.wecomAuthService.resolveSender(inboundMessage.senderId);
      let session = cachedSession
        ? this.querySessionRepository.save({
            ...cachedSession,
            lastMessageAt: inboundMessage.receivedAt,
            updatedAt: inboundMessage.receivedAt,
          })
        : this.getOrCreateSession(inboundMessage, user);
      let conversationContext =
        this.wecomAiConversationOrchestrationService.loadOrCreateContext(
          session,
          inboundMessage,
        );
      conversationContext =
        this.wecomAiConversationOrchestrationService.appendUserTurn(
          conversationContext,
          inboundMessage,
        );
      let receipt = this.wecomMessageReceiptRepository.save({
        ...preflightReceipt,
        requesterId: user.id,
        sessionId: session.id,
        updatedAt: new Date().toISOString(),
      });

      this.audit(user, 'WECOM_AUTH_SUCCEEDED', '企业微信入口认证通过。', {
        sessionId: session.id,
        ...this.buildWecomAuditSessionSnapshot(inboundMessage),
      });
      this.audit(user, 'WECOM_MESSAGE_ACCEPTED', '企业微信消息已受理。', {
        sessionId: session.id,
        ...this.buildWecomAuditSessionSnapshot(inboundMessage),
      });

      if (businessActionsEnabled) {
        await this.auditRecoveryIfNeeded(
          await this.wecomMaintenanceDegradationService.assertRealtimeDataAvailable(),
          'data',
          inboundMessage,
          user,
        );
      }
      this.audit(user, 'AI_CONTEXT_READ', '企业微信会话上下文已读取。', {
        sessionId: session.id,
        contextId: conversationContext.id,
      });

      const activeTask = this.getActiveWecomTask(conversationContext);
      const shouldForceAnalysisFromDashboardQuestion =
        this.isWecomDashboardAnalysisRequest(inboundMessage.messageText ?? '') ||
        this.hasCrmAnalysisQuestionCatalogSignal(inboundMessage.messageText);
      if (activeTask && !shouldForceAnalysisFromDashboardQuestion && !businessActionsEnabled) {
        session = this.saveSessionState(session, 'EXECUTING', {
          activeRequestId: undefined,
          lastReceiptId: receipt.id,
        });
        const disabledTaskResult =
          await this.dispatchUnsupportedBusinessCapabilityPrompt({
            session,
            receipt,
            inboundMessage,
            conversationContext,
            requestedAction: activeTask.kind,
          });
        progressFeedbackHandle.cancel();
        return disabledTaskResult;
      }

      const aiTaskReplyIntent =
        activeTask && !shouldForceAnalysisFromDashboardQuestion && inboundMessage.messageText?.trim()
          ? await this.aiGatewayService.classifyWecomTaskReplyIntent({
              messageText: inboundMessage.messageText,
              activeTaskLabel: activeTask.label,
            })
          : null;
      const taskSwitchIntent = this.detectWecomTaskSwitchIntent(
        conversationContext,
        inboundMessage.messageText,
      );
      const resolvedTaskSwitchIntent =
        taskSwitchIntent ??
        this.buildWecomTaskSwitchIntentFromAiTarget(aiTaskReplyIntent?.target);
      const aiEntryEnabled = process.env.WECOM_AI_ENTRY_INTENT_ENABLED !== 'false';
      const shouldSkipOptionalSupplementAndContinue =
        activeTask?.kind === 'FOLLOW_UP_TEMPLATE' &&
        Boolean(
          conversationContext.workMemory.followUpTemplateDraft
            ?.optionalMissingPromptShown,
        ) &&
        isWecomFollowUpTemplateDirectSubmitIntent(
          inboundMessage.messageText,
        );

      if (
        activeTask &&
        !shouldForceAnalysisFromDashboardQuestion &&
        !aiEntryEnabled &&
        resolvedTaskSwitchIntent &&
        !(
          aiTaskReplyIntent?.intent === 'TASK_SWITCH' &&
          aiTaskReplyIntent.target
        )
      ) {
        conversationContext =
          this.wecomAiConversationOrchestrationService.updateEntryRoutingMemory(
            conversationContext,
            this.wecomAiConversationOrchestrationService.buildActiveTaskReplySnapshots({
              questionText: inboundMessage.messageText ?? '',
              targetWorkflow: 'WECOM_HELP_GUIDANCE',
              replyIntent: 'HELP_GUIDANCE',
              usedFallback: true,
              fallbackReason: 'active-task-switch-disabled-help-fallback',
              ...this.extractAiTaskReplyRuntimeMetadata(aiTaskReplyIntent),
              structuredSlots: {
                activeTaskLabel: activeTask.label,
                blockedSwitchTarget: resolvedTaskSwitchIntent.target,
              },
            }),
          );
        session = this.saveSessionState(session, 'EXECUTING', {
          activeRequestId: undefined,
          lastReceiptId: receipt.id,
        });
        const helpGuidanceResult = await this.dispatchTaskGuidancePrompt({
          session,
          receipt,
          inboundMessage,
          conversationContext,
          prompt: buildWecomHelpPrompt({
            scene: 'CAPABILITY',
            taskLabel: activeTask.label,
          }),
          status: 'RETURNED',
        });
        progressFeedbackHandle.cancel();
        return helpGuidanceResult;
      }

      // 显式新任务入口要优先于旧任务续填，否则会把“生成日报”之类的新指令误写进旧草稿。
      if (
        activeTask &&
        !shouldForceAnalysisFromDashboardQuestion &&
        (
          resolvedTaskSwitchIntent &&
          (
            taskSwitchIntent ||
            (aiTaskReplyIntent?.intent === 'TASK_SWITCH' && aiTaskReplyIntent.target)
          )
        )
      ) {
        conversationContext =
          this.wecomAiConversationOrchestrationService.updateEntryRoutingMemory(
            conversationContext,
            this.wecomAiConversationOrchestrationService.buildActiveTaskReplySnapshots({
              questionText: inboundMessage.messageText ?? '',
              targetWorkflow:
                resolvedTaskSwitchIntent.target === 'DAILY_REPORT_QUERY'
                  ? 'WECOM_DAILY_REPORT_QUERY'
                  : resolvedTaskSwitchIntent.target === 'TEAM_DAILY_REPORT_QUERY'
                    ? 'WECOM_TEAM_DAILY_REPORT_QUERY'
                    : resolvedTaskSwitchIntent.target === 'ENTITY_LOOKUP'
                      ? 'WECOM_ENTITY_LOOKUP'
                    : resolvedTaskSwitchIntent.target === 'FOLLOW_UP_TEMPLATE'
                      ? 'WECOM_DAILY_REPORT_ENTRY'
                      : resolvedTaskSwitchIntent.target === 'CRM_CREATE_CUSTOMER'
                        ? 'WECOM_CRM_CREATE_CUSTOMER'
                        : resolvedTaskSwitchIntent.target === 'CRM_CREATE_OPPORTUNITY'
                          ? 'WECOM_CRM_CREATE_OPPORTUNITY'
                          : 'WECOM_DAILY_REPORT_ENTRY',
              replyIntent: 'TASK_SWITCH',
              usedFallback: !(
                aiTaskReplyIntent?.intent === 'TASK_SWITCH' && aiTaskReplyIntent.target
              ),
              fallbackReason:
                aiTaskReplyIntent?.intent === 'TASK_SWITCH' && aiTaskReplyIntent.target
                  ? undefined
                  : 'active-task-rule-switch-fallback',
              ...this.extractAiTaskReplyRuntimeMetadata(aiTaskReplyIntent),
              structuredSlots: {
                activeTaskLabel: activeTask.label,
                switchTarget: resolvedTaskSwitchIntent.target,
                leaderNameQuery: resolvedTaskSwitchIntent.leaderNameQuery,
              },
            }),
          );
        session = this.saveSessionState(session, 'EXECUTING', {
          activeRequestId: undefined,
          lastReceiptId: receipt.id,
        });
        const taskSwitchResult = await this.handleTaskSwitch({
          user,
          session,
          receipt,
          inboundMessage,
          conversationContext,
          activeTask,
          switchIntent: resolvedTaskSwitchIntent,
        });
        progressFeedbackHandle.cancel();
        return taskSwitchResult;
      }

      if (
        activeTask &&
        !shouldForceAnalysisFromDashboardQuestion &&
        (activeTask.kind === 'FOLLOW_UP_TEMPLATE' || activeTask.kind === 'DAILY_REPORT') &&
        !shouldSkipOptionalSupplementAndContinue &&
        (
          this.isExplicitTaskCancelIntent(inboundMessage.messageText) ||
          aiTaskReplyIntent?.intent === 'TASK_CANCEL'
        )
      ) {
        conversationContext =
          this.wecomAiConversationOrchestrationService.updateEntryRoutingMemory(
            conversationContext,
            this.wecomAiConversationOrchestrationService.buildActiveTaskReplySnapshots({
              questionText: inboundMessage.messageText ?? '',
              targetWorkflow: 'WECOM_TASK_ROUTER',
              replyIntent: 'TASK_CANCEL',
              usedFallback: aiTaskReplyIntent?.intent !== 'TASK_CANCEL',
              fallbackReason:
                aiTaskReplyIntent?.intent === 'TASK_CANCEL'
                  ? undefined
                  : 'active-task-rule-cancel-fallback',
              ...this.extractAiTaskReplyRuntimeMetadata(aiTaskReplyIntent),
              structuredSlots: {
                activeTaskLabel: activeTask.label,
              },
            }),
          );
        session = this.saveSessionState(session, 'EXECUTING', {
          activeRequestId: undefined,
          lastReceiptId: receipt.id,
        });
        const taskCancelResult = await this.handleDailyReportTaskCancel({
          session,
          receipt,
          inboundMessage,
          conversationContext,
          activeTask,
        });
        progressFeedbackHandle.cancel();
        return taskCancelResult;
      }

      const helpIntent = detectWecomHelpIntent(inboundMessage.messageText);
      if (
        activeTask &&
        !shouldForceAnalysisFromDashboardQuestion &&
        (helpIntent || aiTaskReplyIntent?.intent === 'HELP_GUIDANCE')
      ) {
        conversationContext =
          this.wecomAiConversationOrchestrationService.updateEntryRoutingMemory(
            conversationContext,
            this.wecomAiConversationOrchestrationService.buildActiveTaskReplySnapshots({
              questionText: inboundMessage.messageText ?? '',
              targetWorkflow: 'WECOM_HELP_GUIDANCE',
              replyIntent: 'HELP_GUIDANCE',
              usedFallback: aiTaskReplyIntent?.intent !== 'HELP_GUIDANCE',
              fallbackReason:
                aiTaskReplyIntent?.intent === 'HELP_GUIDANCE'
                  ? undefined
                  : 'active-task-rule-help-fallback',
              ...this.extractAiTaskReplyRuntimeMetadata(aiTaskReplyIntent),
              structuredSlots: {
                activeTaskLabel: activeTask.label,
                helpScene: helpIntent === 'GREETING' ? 'GREETING' : 'CAPABILITY',
              },
            }),
          );
        session = this.saveSessionState(session, 'EXECUTING', {
          activeRequestId: undefined,
          lastReceiptId: receipt.id,
        });
        const helpGuidanceResult = await this.dispatchTaskGuidancePrompt({
          session,
          receipt,
          inboundMessage,
          conversationContext,
          prompt: buildWecomHelpPrompt({
            scene: helpIntent === 'GREETING' ? 'GREETING' : 'CAPABILITY',
            taskLabel: activeTask.label,
          }),
          status: 'RETURNED',
        });
        progressFeedbackHandle.cancel();
        return helpGuidanceResult;
      }

      if (
        !shouldForceAnalysisFromDashboardQuestion &&
        conversationContext.workMemory.activeFollowUpWritebackId &&
        this.shouldHandleFollowUpWritebackMessage(
          conversationContext,
          inboundMessage.messageText,
        )
      ) {
        session = this.saveSessionState(session, 'EXECUTING', {
          activeRequestId: undefined,
          lastReceiptId: receipt.id,
        });
        const followUpWritebackResult =
          await this.handleFollowUpWritebackFlow({
            user,
            session,
            receipt,
            inboundMessage,
            conversationContext,
          });
        progressFeedbackHandle.cancel();
        return followUpWritebackResult;
      }

      if (
        !shouldForceAnalysisFromDashboardQuestion &&
        this.shouldHandleActiveCrmCreateMessage(
          conversationContext,
          inboundMessage.messageText,
        )
      ) {
        session = this.saveSessionState(session, 'EXECUTING', {
          activeRequestId: undefined,
          lastReceiptId: receipt.id,
        });
        const crmCreateResult = await this.handleCrmCreateFlow({
          user,
          session,
          receipt,
          inboundMessage,
          conversationContext,
          aiTaskReplyIntent,
        });
        progressFeedbackHandle.cancel();
        return crmCreateResult;
      }

      // 成功写回后的补充提醒是可选引导；用户如果明确回复“无/没有”，
      // 应直接就地收口，避免误入分析链路并在稍后插回无关结果。
      if (
        !shouldForceAnalysisFromDashboardQuestion &&
        this.shouldAcknowledgeFollowUpPostWritebackReminder(
          conversationContext,
          inboundMessage.messageText,
        )
      ) {
        session = this.saveSessionState(session, 'EXECUTING', {
          activeRequestId: undefined,
          lastReceiptId: receipt.id,
        });
        const postWritebackReminderResult =
          await this.handleFollowUpPostWritebackReminderReply({
            session,
            receipt,
            inboundMessage,
            conversationContext,
          });
        progressFeedbackHandle.cancel();
        return postWritebackReminderResult;
      }

      const conversationDecision = shouldForceAnalysisFromDashboardQuestion
        ? this.buildForcedDashboardAnalysisDecision(inboundMessage, conversationContext)
        : await this.wecomAiConversationOrchestrationService.decideNextAction(
            conversationContext,
            inboundMessage,
            this.userScopeService.resolveScope(user),
          );
      conversationContext =
        this.wecomAiConversationOrchestrationService.updateEntryRoutingMemory(
          conversationContext,
          {
            entryInterpretationSnapshot:
              conversationDecision.entryInterpretationSnapshot,
            workflowRoutingSnapshot:
              conversationDecision.workflowRoutingSnapshot,
          },
        );

      session = this.saveSessionState(session, 'EXECUTING', {
        activeRequestId: undefined,
        lastReceiptId: receipt.id,
      });

      if (conversationDecision.action === 'HELP_GUIDANCE') {
        const helpGuidanceResult = await this.dispatchTaskGuidancePrompt({
          session,
          receipt,
          inboundMessage,
          conversationContext,
          prompt:
            conversationDecision.directReply ??
            buildWecomHelpPrompt({
              scene: 'CAPABILITY',
            }),
          status: 'RETURNED',
        });
        progressFeedbackHandle.cancel();
        return helpGuidanceResult;
      }

      if (!businessActionsEnabled) {
        const coreModeResult = this.isWecomCoreAiChatAction(conversationDecision.action)
          ? await this.dispatchCoreAiChatReply({
              user,
              session,
              receipt,
              inboundMessage,
              conversationContext,
            })
          : await this.dispatchUnsupportedBusinessCapabilityPrompt({
              session,
              receipt,
              inboundMessage,
              conversationContext,
              requestedAction: conversationDecision.action,
            });
        progressFeedbackHandle.cancel();
        return coreModeResult;
      }

      // 日报入口走分步收集、写库、确认和 AI 分享的独立链路，避免混入问数执行计划。
      if (conversationDecision.action === 'DAILY_REPORT') {
        const dailyReportContext =
          !activeTask &&
          this.shouldSeedFreeformFollowUpDraft(
            conversationDecision,
            inboundMessage.messageText,
          )
            ? this.activateFollowUpTemplateDraft(conversationContext, user)
            : conversationContext;
        const dailyReportResult = await this.handleDailyReportFlow({
          user,
          session,
          receipt,
          inboundMessage,
          conversationContext: dailyReportContext,
          conversationDecision,
          aiTaskReplyIntent,
        });
        progressFeedbackHandle.cancel();
        return dailyReportResult;
      }

      if (conversationDecision.action === 'DAILY_REPORT_QUERY') {
        const dailyReportPreviewResult = await this.handleDailyReportPreviewQuery({
          user,
          session,
          receipt,
          inboundMessage,
          conversationContext,
        });
        progressFeedbackHandle.cancel();
        return dailyReportPreviewResult;
      }

      if (conversationDecision.action === 'TEAM_DAILY_REPORT_QUERY') {
        const teamDailyPreviewResult =
          await this.handleTeamDailyReportPreviewQuery({
            user,
            session,
            receipt,
            inboundMessage,
            conversationContext,
            leaderNameQuery: conversationDecision.leaderNameQuery ?? '',
          });
        progressFeedbackHandle.cancel();
        return teamDailyPreviewResult;
      }

      if (
        conversationDecision.action === 'CRM_CREATE_CUSTOMER' ||
        conversationDecision.action === 'CRM_CREATE_OPPORTUNITY'
      ) {
        const crmCreateResult = await this.handleCrmCreateFlow({
          user,
          session,
          receipt,
          inboundMessage,
          conversationContext,
          entityType:
            conversationDecision.action === 'CRM_CREATE_CUSTOMER'
              ? 'Customer'
              : 'Opportunity',
          aiTaskReplyIntent,
        });
        progressFeedbackHandle.cancel();
        return crmCreateResult;
      }

      if (conversationDecision.action === 'REDISPLAY_RESULT') {
        const redisplayResult = await this.handleAnalysisResultRedisplay({
          user,
          session,
          receipt,
          inboundMessage,
          conversationContext,
          conversationDecision,
        });
        progressFeedbackHandle.cancel();
        return redisplayResult;
      }

      if (conversationDecision.action === 'EXPLAIN_RESULT') {
        const explanationText =
          conversationDecision.directReply ??
          '当前已基于上一轮 CRM 结果继续解释，请结合结果摘要查看。';
        this.wecomAiConversationOrchestrationService.appendAssistantTurn(
          conversationContext,
          explanationText,
        );
        this.audit(user, 'AI_RESULT_EXPLAINED', '系统已基于上一轮结果生成解释。', {
          sessionId: session.id,
          contextId: conversationContext.id,
          entryInterpretationSnapshot: conversationDecision.entryInterpretationSnapshot,
          workflowRoutingSnapshot: conversationDecision.workflowRoutingSnapshot,
        });

        const explanationDispatchResult =
          await this.wecomStreamDispatcherService.dispatch({
            receiptId: receipt.id,
            sessionId: session.id,
            target: this.buildDispatchTarget(inboundMessage, receipt.id),
            blocks: this.wecomStreamDispatcherService.buildExplanationBlocks(
              explanationText,
            ),
          });

        session = this.saveSessionState(session, 'IDLE', {
          activeRequestId: undefined,
        });
        progressFeedbackHandle.cancel();

        return {
          receiptId: receipt.id,
          sessionId: session.id,
          status: 'EXPLAINED',
          acceptedAt: receipt.createdAt,
          deliveryStatus: explanationDispatchResult.status,
          deliveredBlockCount: explanationDispatchResult.deliveredCount,
        };
      }

      if (conversationDecision.action === 'OPPORTUNITY_LOOKUP') {
        const opportunityLookupResult = await this.handleOpportunityLookupFlow({
          user,
          session,
          receipt,
          inboundMessage,
          conversationContext,
          lookupText: conversationDecision.effectiveQuestionText ?? '',
        });
        progressFeedbackHandle.cancel();
        return opportunityLookupResult;
      }

      if (conversationDecision.action === 'ENTITY_LOOKUP') {
        const entityLookupResult = await this.handleEntityLookupFlow({
          user,
          session,
          receipt,
          inboundMessage,
          conversationContext,
          conversationDecision,
        });
        progressFeedbackHandle.cancel();
        return entityLookupResult;
      }

      if (
        this.shouldFallbackToFollowUpThemeEntryPrompt(
          conversationContext,
          inboundMessage.messageText,
          conversationDecision.entryInterpretationSnapshot,
        )
      ) {
        // 显式“跟进客户 / 跟进商机 / 今日跟进”入口只负责拉起模板收集，
        // 不直接执行写回；当 AI idle lane 因 provider 抖动或 NONE 回退失手时，
        // 这里允许受控兜底，避免把非常明确的固定入口误回成总帮助菜单。
        conversationContext =
          this.wecomAiConversationOrchestrationService.updateEntryRoutingMemory(
            conversationContext,
            {
              entryInterpretationSnapshot: createAiEntryInterpretationSnapshot({
                channel: 'wecom-bot',
                scene: 'WECOM_IDLE_MESSAGE',
                targetWorkflow: 'WECOM_DAILY_REPORT_ENTRY',
                originalText: inboundMessage.messageText ?? '',
                intent: 'UNKNOWN',
                requestedAction: 'READONLY_ANALYSIS',
                confidence: 'MEDIUM',
                usedFallback: true,
                fallbackReason: 'idle-follow-up-theme-entry-fallback',
                validationFailureReason:
                  conversationDecision.entryInterpretationSnapshot?.validationFailureReason,
                packCode: conversationDecision.entryInterpretationSnapshot?.packCode,
                packVersion:
                  conversationDecision.entryInterpretationSnapshot?.packVersion,
                providerCode:
                  conversationDecision.entryInterpretationSnapshot?.providerCode,
                model: conversationDecision.entryInterpretationSnapshot?.model,
                structuredSlots: {
                  entryMode: 'FIXED_WORKFLOW',
                  fixedWorkflow: 'DAILY_REPORT',
                  dailyReportPrompt: 'FOLLOW_UP_TEMPLATE_ENTRY',
                },
                generatedAt: new Date().toISOString(),
              }),
              workflowRoutingSnapshot: createAiWorkflowRoutingSnapshot({
                targetWorkflow: 'WECOM_DAILY_REPORT_ENTRY',
                finalProgram:
                  'wecom-bot.processInboundMessage.idleFollowUpThemeEntryFallback',
                requiresConfirmation: false,
                gateResult: 'BYPASSED',
                generatedAt: new Date().toISOString(),
              }),
            },
          );
        const followUpThemeFallbackResult = await this.promptDailyReportThemeEntry({
          user,
          session,
          receipt,
          inboundMessage,
          conversationContext,
          resetExistingFlow: false,
        });
        progressFeedbackHandle.cancel();
        return followUpThemeFallbackResult;
      }

      if (
        this.shouldReturnIdleUnrecognizedHelp(
          conversationContext,
          inboundMessage.messageText,
          conversationDecision.entryInterpretationSnapshot,
        )
      ) {
        const helpScene = detectWecomHelpIntent(inboundMessage.messageText) ?? 'GREETING';
        conversationContext =
          this.wecomAiConversationOrchestrationService.updateEntryRoutingMemory(
            conversationContext,
            {
              entryInterpretationSnapshot: createAiEntryInterpretationSnapshot({
                channel: 'wecom-bot',
                scene: 'WECOM_IDLE_MESSAGE',
                targetWorkflow: 'WECOM_HELP_GUIDANCE',
                originalText: inboundMessage.messageText ?? '',
                intent: 'HELP_GUIDANCE',
                requestedAction: 'READONLY_ANALYSIS',
                confidence: 'MEDIUM',
                usedFallback: true,
                fallbackReason: 'idle-unrecognized-help-fallback',
                validationFailureReason:
                  conversationDecision.entryInterpretationSnapshot?.validationFailureReason,
                packCode: conversationDecision.entryInterpretationSnapshot?.packCode,
                packVersion:
                  conversationDecision.entryInterpretationSnapshot?.packVersion,
                providerCode:
                  conversationDecision.entryInterpretationSnapshot?.providerCode,
                model: conversationDecision.entryInterpretationSnapshot?.model,
                generatedAt: new Date().toISOString(),
              }),
              workflowRoutingSnapshot: createAiWorkflowRoutingSnapshot({
                targetWorkflow: 'WECOM_HELP_GUIDANCE',
                finalProgram: 'wecom-bot.processInboundMessage.idleHelpGuidance',
                requiresConfirmation: false,
                gateResult: 'BYPASSED',
                generatedAt: new Date().toISOString(),
              }),
            },
          );
        const unrecognizedHelpResult = await this.dispatchTaskGuidancePrompt({
          session,
          receipt,
          inboundMessage,
          conversationContext,
          prompt: buildWecomHelpPrompt({
            scene: helpScene,
          }),
          status: 'RETURNED',
        });
        session = this.saveSessionState(session, 'IDLE', {
          activeRequestId: undefined,
          lastReceiptId: receipt.id,
        });
        progressFeedbackHandle.cancel();
        return unrecognizedHelpResult;
      }

      this.audit(user, 'AI_ANALYSIS_REQUESTED', '统一入口已决定调用受控分析链路。', {
        sessionId: session.id,
        contextId: conversationContext.id,
        action: conversationDecision.action,
        entryInterpretationSnapshot: conversationDecision.entryInterpretationSnapshot,
        workflowRoutingSnapshot: conversationDecision.workflowRoutingSnapshot,
      });

      const effectiveQuestionText =
        conversationDecision.effectiveQuestionText ??
        inboundMessage.messageText ??
        '';

      // ===== 看板分析桥接：当用户提问是看板/运营分析类问题时，
      // 跳过常规分析管道（文字报告），直接调用 DashboardReportComposer
      // 生成结构化看板 block（饼图/漏斗/柱状图/表格/地图等），
      // 再转换为企微可展示的增强格式（模板卡片 + 结构化 Markdown）。
      // 这解决了"99.99% 场景都是企微机器人使用，但回复只有纯文字 KPI 没有图表"的核心问题。
      const isWecomDashboardAnalysis = this.isWecomDashboardAnalysisRequest(effectiveQuestionText);

      // 终极安全网：在 if 分支前再次排除筛选/明细类问题
      // 即使 isWecomDashboardAnalysis 因某种原因返回 true，也要拦截
      const normalizedForSafetyCheck = effectiveQuestionText.replace(/\s+/gu, '').trim();
      const isExclusionarySafetyNet = this.isExclusionaryFilterQuery(normalizedForSafetyCheck);
      const shouldBridgeToDashboard = isWecomDashboardAnalysis && !isExclusionarySafetyNet;

      this.analysisLoggerService.logStep('看板桥接检测', {
        questionText: effectiveQuestionText,
        isWecomDashboardAnalysis,
        isExclusionarySafetyNet,
        shouldBridgeToDashboard,
      });

      let queryResponse: Awaited<ReturnType<AnalysisService['createQuery']>>;
      let detail: Record<string, unknown> | undefined;
      let userFacingClarificationPrompt: string | undefined;
      let imageAttachments: WecomDispatchImageAttachment[] = [];
      let templateCards: WecomDispatchTemplateCard[];
      let dispatchBlocks: StreamBlock[];

      if (shouldBridgeToDashboard) {
        // ★ 最终绝对拦截：即使前面所有检查都通过了，在调用 compose() 前再做一次排除检查。
        // 这是防止场景③"近3个月没有维护进度的客户情况"误入看板的最后一道防线。
        const normalizedForFinalGuard = effectiveQuestionText.replace(/\s+/gu, '').trim();
        if (this.isExclusionaryFilterQuery(normalizedForFinalGuard)) {
          this.analysisLoggerService.logWarn(
            '最终拦截：问题匹配排除过滤，强制走常规分析管道（不走看板桥接）。',
            { questionText: effectiveQuestionText, normalizedForFinalGuard },
          );
          // 强制走常规分析管道
          const regularResult = await this.executeRegularAnalysisPipeline({
            user,
            effectiveQuestionText,
            session,
            conversationContext,
            conversationDecision,
            receipt,
          });
          queryResponse = regularResult.queryResponse;
          detail = regularResult.detail;
          templateCards = regularResult.templateCards;
          dispatchBlocks = regularResult.dispatchBlocks;
          imageAttachments = regularResult.imageAttachments;
          userFacingClarificationPrompt = regularResult.userFacingClarificationPrompt;
          receipt = regularResult.receipt;
          conversationContext = regularResult.conversationContext;
        } else {
        this.analysisLoggerService.logStep('企微看板分析请求已识别，桥接到 DashboardReportComposer。', {
          questionText: effectiveQuestionText,
          isWecomDashboardAnalysis,
          exclusionarySafetyNet: isExclusionarySafetyNet,
        });
        this.audit(user, 'AI_ANALYSIS_REQUESTED', '企微看板分析请求已桥接到 DashboardReportComposer。', {
          sessionId: session.id,
          questionText: effectiveQuestionText,
        });

        try {
          const dashboardResult = await this.dashboardReportComposer.compose(
            'auto',
            {},
            effectiveQuestionText,
          );

          this.analysisLoggerService.logStep('DashboardReportComposer 返回结果。', {
            blockCount: dashboardResult.blocks.length,
            blockTypes: dashboardResult.blocks.map((b) => b.blockType),
            errorCount: dashboardResult.errors.length,
            dataSource: dashboardResult.dataSource,
            reportTitle: dashboardResult.reportTitle,
          });

          // ===== 保存分析结果到 analysisRequestRepository，确保 Web 看板链接可访问 =====
          // 生成与常规分析一致的 queryId 格式，并保存 request + result 记录，
          // 这样 PublicAnalysisResultController 的 /public/analysis-results/:queryId/file 端点能找到数据。
          const dashboardQueryId = buildEntityId('query');
          const now = new Date().toISOString();

          // 保存 AnalysisRequestRecord（状态 COMPLETED）
          this.analysisRequestRepository.saveRequest({
            id: dashboardQueryId,
            questionText: effectiveQuestionText,
            requesterId: user.id,
            requesterRoleIds: user.roleIds ?? [],
            sessionId: session.id,
            entryChannel: 'wecom-bot',
            querySource: 'FREE_TEXT',
            organizationScope: [],
            departmentScope: [],
            ownerScope: [],
            intentDomain: 'opportunity-analysis',
            metrics: [],
            dimensions: [],
            filters: {},
            missingConditions: [],
            status: 'RETURNED',
            createdAt: now,
            completedAt: now,
            executionMode: 'PLAN_EXECUTION',
            executionSource: 'OPENAPI_MARKDOWN_SNAPSHOT',
            analysisRoute: 'OPENAPI',
          } as import('../../shared/types/domain').AnalysisRequestRecord);

          const dashboardPreviewPayload = this.buildDashboardPreviewPayload(
            dashboardResult,
            effectiveQuestionText,
          );
          const dashboardCardImageBundle = await this.buildDashboardCardImageBundle(
            dashboardResult,
            dashboardPreviewPayload,
            dashboardQueryId,
          );

          // 将看板 block 转换为企微可展示的增强格式（传入已保存的 queryId 和卡片图 URL）
          const wecomDashboardPayload = this.convertDashboardResultToWecomFormat(
            dashboardResult,
            effectiveQuestionText,
            dashboardQueryId,
            {
              imageUrl: dashboardCardImageBundle.imageUrl,
              imageAspectRatio: dashboardCardImageBundle.imageAspectRatio,
            },
          );
          imageAttachments = dashboardCardImageBundle.imageAttachments;

          // 保存 AnalysisResultRecord（供 Web 端点渲染）
          // 注意：在 convertDashboardResultToWecomFormat 之后保存，因为需要先获取 metricCardsForDetail 和 tableBlocksForDetail
          this.analysisRequestRepository.saveResult({
            requestId: dashboardQueryId,
            questionText: effectiveQuestionText,
            title: dashboardResult.reportTitle,
            summary: dashboardResult.executiveSummary,
            report: {
              variant: 'DASHBOARD',
              title: dashboardResult.reportTitle,
              executiveSummary: dashboardResult.executiveSummary,
              scopeSummary: dashboardResult.scopeSummary,
              dashboardTemplate: wecomDashboardPayload.dashboardTemplate,
              metricCards: wecomDashboardPayload.metricCardsForDetail,
              tableBlocks: wecomDashboardPayload.tableBlocksForDetail,
              sections: wecomDashboardPayload.publicSections,
            } as unknown as import('../../shared/types/domain').AnalysisReportPayload,
            scopeSummary: dashboardResult.scopeSummary,
            appliedFilters: [],
            metricCards: wecomDashboardPayload.metricCardsForDetail,
            secondaryViews: [],
            tableRows: wecomDashboardPayload.tableBlocksForDetail.flatMap((t) => t.rows ?? []),
            keyFindings: [],
            rowCount: wecomDashboardPayload.tableBlocksForDetail.reduce((sum, t) => sum + (t.rows?.length ?? 0), 0),
            dataFreshnessAt: now,
            consistencyToken: '',
            streamBlocks: wecomDashboardPayload.dispatchBlocks,
            availableActions: [],
            returnedAt: now,
            wecomMarkdown: wecomDashboardPayload.dispatchBlocks[0]?.content ?? '',
          } as import('../../shared/types/domain').AnalysisResultRecord);

          receipt = this.wecomMessageReceiptRepository.save({
            ...receipt,
            queryId: dashboardQueryId,
            updatedAt: now,
          });

          templateCards = wecomDashboardPayload.templateCards;
          dispatchBlocks = wecomDashboardPayload.dispatchBlocks;
          userFacingClarificationPrompt = undefined;

          // 构造一个兼容 queryResponse 形状的伪对象，让后续状态管理正常走通
          queryResponse = {
            status: 'RETURNED',
            queryId: receipt.queryId ?? '',
            clarificationPrompt: null,
            missingConditions: [],
            queueNotice: undefined,
          } as Awaited<ReturnType<AnalysisService['createQuery']>>;
          detail = {
            report: {
              reportTitle: dashboardResult.reportTitle,
              executiveSummary: dashboardResult.executiveSummary,
              scopeSummary: dashboardResult.scopeSummary,
              dashboardTemplate: wecomDashboardPayload.dashboardTemplate,
              metricCards: wecomDashboardPayload.metricCardsForDetail,
              tableBlocks: wecomDashboardPayload.tableBlocksForDetail,
              sections: wecomDashboardPayload.publicSections,
            },
            questionText: effectiveQuestionText,
          };

          conversationContext =
            this.wecomAiConversationOrchestrationService.updateWorkMemoryAfterResponse(
              conversationContext,
              {
                questionText: effectiveQuestionText,
                queryId: receipt.queryId,
                summary: dashboardResult.executiveSummary,
                latestResultContext: this.buildLatestResultContext(detail, {
                  queryId: receipt.queryId,
                  questionText: effectiveQuestionText,
                }),
                pendingSlots: [],
              },
            );
        } catch (dashboardError) {
          this.analysisLoggerService.logWarn(
            'DashboardReportComposer 执行失败，回退到常规分析管道。',
            {
              reason: dashboardError instanceof Error ? dashboardError.message : String(dashboardError),
            },
          );
          // 回退到常规分析管道
          const fallbackResult = await this.executeRegularAnalysisPipeline({
            user,
            effectiveQuestionText,
            session,
            conversationContext,
            conversationDecision,
            receipt,
          });
          queryResponse = fallbackResult.queryResponse;
          detail = fallbackResult.detail;
          templateCards = fallbackResult.templateCards;
          dispatchBlocks = fallbackResult.dispatchBlocks;
          imageAttachments = fallbackResult.imageAttachments;
          userFacingClarificationPrompt = fallbackResult.userFacingClarificationPrompt;
          receipt = fallbackResult.receipt;
          conversationContext = fallbackResult.conversationContext;
        }
        } // 关闭 else（非排除过滤的看板桥接分支）
      } else {
        // 常规分析管道（原有流程）
        const regularResult = await this.executeRegularAnalysisPipeline({
          user,
          effectiveQuestionText,
          session,
          conversationContext,
          conversationDecision,
          receipt,
        });
        queryResponse = regularResult.queryResponse;
        detail = regularResult.detail;
        templateCards = regularResult.templateCards;
        dispatchBlocks = regularResult.dispatchBlocks;
        imageAttachments = regularResult.imageAttachments;
        userFacingClarificationPrompt = regularResult.userFacingClarificationPrompt;
        receipt = regularResult.receipt;
        conversationContext = regularResult.conversationContext;
      }

      // ===== 公共尾部：状态管理 + 投递 + 返回 =====
      if (queryResponse.status === 'CLARIFICATION_REQUIRED') {
      session = this.saveSessionState(session, 'CLARIFYING', {
        activeRequestId: receipt.queryId,
      });
    } else if (queryResponse.status === 'RETURNED') {
      session = this.saveSessionState(session, 'ANSWERING', {
        activeRequestId: receipt.queryId,
      });
    } else if (queryResponse.status === 'QUEUED') {
      session = this.saveSessionState(session, 'ACTIVE', {
        activeRequestId: receipt.queryId,
      });
    } else {
      session = this.saveSessionState(session, 'IDLE', {
        activeRequestId: undefined,
      });
    }

    const dispatchResult = await this.wecomStreamDispatcherService.dispatch({
      receiptId: receipt.id,
      sessionId: session.id,
      queryId: receipt.queryId,
      target: this.buildDispatchTarget(inboundMessage, receipt.id),
      blocks: dispatchBlocks,
      templateCards,
      imageAttachments,
    });

      if (dispatchResult.failedCount > 0) {
      this.audit(user, 'STREAM_DELIVERY_FAILED', '企业微信结果回传失败。', {
        sessionId: session.id,
        queryId: receipt.queryId,
        failedCount: dispatchResult.failedCount,
      });
    } else {
      this.audit(user, 'WECOM_DELIVERY_SUCCEEDED', '企业微信结果已完成回传。', {
        sessionId: session.id,
        queryId: receipt.queryId,
        deliveredCount: dispatchResult.deliveredCount,
      });
    }

      this.wecomAiConversationOrchestrationService.appendAssistantTurn(
      conversationContext,
      dispatchBlocks.length > 0
        ? dispatchBlocks.map((item) => item.content).join('\n')
        : templateCards.map((item) => item.contentPreview).join('\n'),
      receipt.queryId,
    );

      if (queryResponse.status === 'RETURNED' || queryResponse.status === 'BLOCKED') {
      session = this.saveSessionState(session, 'IDLE', {
        activeRequestId: undefined,
      });
    }
      progressFeedbackHandle.cancel();

      return {
        receiptId: receipt.id,
        sessionId: session.id,
        queryId: receipt.queryId,
        status: String(queryResponse.status),
        acceptedAt: receipt.createdAt,
        queueNotice: queryResponse.queueNotice as string | undefined,
        clarificationPrompt: userFacingClarificationPrompt,
        deliveryStatus: dispatchResult.status,
        deliveredBlockCount: dispatchResult.deliveredCount,
      };
    } catch (error: unknown) {
      progressFeedbackHandle?.cancel();
      return await this.handleReceiveError(error, inboundMessage, inboundMessage.rawPayload, {
        deliverToChat: options.deliverErrorsToChat,
        streamId: progressStreamId,
      });
    }
  }

  /**
   * 重发上一轮企微智能分析结果。
   *
   * 参数说明：`conversationDecision` 必须来自机器人快捷动作识别，`redisplayQueryId`
   * 指向上一轮已完成的分析请求；`redisplayMode` 控制优先发送图表还是明细。
   * 返回值说明：返回本轮企业微信消息处理结果，包含实际投递状态。
   * 异常场景：上一轮结果丢失或无权限时，不重新取数，只发送友好中文兜底。
   * 调用注意事项：这里通过 `getQueryDetail(..., 'wecom-bot')` 复用统一权限边界，
   * 避免快捷动作绕过当前用户、当前会话和结果归属校验。
   */
  private async handleAnalysisResultRedisplay(params: {
    user: CrmUser;
    session: QuerySessionRecord;
    receipt: WecomMessageReceiptRecord;
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
    conversationDecision: WecomConversationDecision;
  }): Promise<WecomReceiveMessageResult> {
    const redisplayMode = params.conversationDecision.redisplayMode ?? 'DETAIL';
    const queryId = params.conversationDecision.redisplayQueryId?.trim();

    // 没有上一轮 queryId 时不能声称已生成图表，必须明确提示用户先发起完整查询。
    if (!queryId) {
      const replyText =
        params.conversationDecision.directReply ??
        '我还没有上一轮可展示的完整结果，请先发起一次完整查询。';
      return await this.dispatchAnalysisRedisplayBlocks({
        ...params,
        queryId: undefined,
        blocks: this.wecomStreamDispatcherService.buildExplanationBlocks(replyText),
        imageAttachments: [],
        assistantText: replyText,
        redisplayMode,
      });
    }

    let detail: Record<string, unknown> | undefined;
    try {
      detail = this.analysisService.getQueryDetail(
        params.user,
        queryId,
        'wecom-bot',
      );
    } catch (error) {
      this.analysisLoggerService.logWarn(
        '企业微信上一轮分析结果重发展示失败，已发送兜底提示。',
        {
          queryId,
          requesterId: params.user.id,
          reason: error instanceof Error ? error.message : String(error ?? 'unknown'),
        },
      );
      const replyText =
        '上一轮分析结果暂时无法重新展示，可能是结果已失效或当前账号无权查看。请重新发起一次完整查询。';
      return await this.dispatchAnalysisRedisplayBlocks({
        ...params,
        queryId,
        blocks: this.wecomStreamDispatcherService.buildBlockedBlocks(replyText),
        imageAttachments: [],
        assistantText: replyText,
        redisplayMode,
      });
    }

    const detailBlocks = this.resolveDispatchBlocks(
      { status: 'RETURNED' },
      detail,
      undefined,
    );
    const redisplayImageAttachments =
      redisplayMode === 'IMAGE'
        ? await this.buildAnalysisImageAttachments(detail)
        : [];
    const templateCards = this.buildAnalysisTemplateCards(detail, {
      hasImageAttachments: redisplayImageAttachments.length > 0,
      queryId,
    });

    // 图表快捷动作优先重发模板卡片，同时补发轻量图片看板；图片失败时仍保留正文和卡片。
    if (redisplayMode === 'IMAGE') {
      const blocks =
        templateCards.length > 0
          ? detailBlocks
          : [
              {
                sequence: 0,
                blockType: 'REPORT' as const,
                content: `上一轮结果已改用模板卡片交付；当前没有可生成卡片的报告摘要，我先把上一轮明细重新发给你。\n\n${detailBlocks
                  .map((item) => item.content)
                  .join('\n')}`,
              },
            ];

      return await this.dispatchAnalysisRedisplayBlocks({
        ...params,
        queryId,
        blocks,
        templateCards,
        imageAttachments: redisplayImageAttachments,
        assistantText:
          blocks.length > 0
            ? blocks.map((item) => item.content).join('\n')
            : templateCards.map((item) => item.contentPreview).join('\n'),
        redisplayMode,
      });
    }

    return await this.dispatchAnalysisRedisplayBlocks({
      ...params,
      queryId,
      blocks: detailBlocks,
      templateCards,
      imageAttachments: [],
      assistantText:
        detailBlocks.length > 0
          ? detailBlocks.map((item) => item.content).join('\n')
          : templateCards.map((item) => item.contentPreview).join('\n'),
      redisplayMode,
    });
  }

  /**
   * 统一投递上一轮结果重发展示消息，并补齐会话、助手记忆和审计。
   *
   * 参数说明：`blocks` 为本轮企微文本块，`templateCards` 为可选模板卡片，`imageAttachments` 为兼容字段。
   * 返回值说明：返回企业微信投递结果摘要。
   * 调用注意事项：该方法只负责投递和留痕，不读取 CRM，也不修改分析结果。
   */
  private async dispatchAnalysisRedisplayBlocks(params: {
    user: CrmUser;
    session: QuerySessionRecord;
    receipt: WecomMessageReceiptRecord;
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
    queryId?: string;
    blocks: StreamBlock[];
    templateCards?: WecomDispatchTemplateCard[];
    imageAttachments: WecomDispatchImageAttachment[];
    assistantText: string;
    redisplayMode: 'IMAGE' | 'DETAIL';
  }): Promise<WecomReceiveMessageResult> {
    const dispatchResult = await this.wecomStreamDispatcherService.dispatch({
      receiptId: params.receipt.id,
      sessionId: params.session.id,
      queryId: params.queryId,
      target: this.buildDispatchTarget(params.inboundMessage, params.receipt.id),
      blocks: params.blocks,
      templateCards: params.templateCards,
      imageAttachments: params.imageAttachments,
    });

    this.wecomAiConversationOrchestrationService.appendAssistantTurn(
      params.conversationContext,
      params.assistantText,
      params.queryId,
    );

    const nextSession = this.saveSessionState(params.session, 'IDLE', {
      activeRequestId: undefined,
    });

    if (dispatchResult.failedCount > 0) {
      this.audit(params.user, 'STREAM_DELIVERY_FAILED', '企业微信上一轮结果重发展示失败。', {
        sessionId: nextSession.id,
        queryId: params.queryId,
        redisplayMode: params.redisplayMode,
        failedCount: dispatchResult.failedCount,
      });
    } else {
      this.audit(params.user, 'WECOM_DELIVERY_SUCCEEDED', '企业微信上一轮结果已重新展示。', {
        sessionId: nextSession.id,
        queryId: params.queryId,
        redisplayMode: params.redisplayMode,
        deliveredCount: dispatchResult.deliveredCount,
      });
    }

    return {
      receiptId: params.receipt.id,
      sessionId: nextSession.id,
      queryId: params.queryId,
      status: 'REDISPLAYED',
      acceptedAt: params.receipt.createdAt,
      deliveryStatus: dispatchResult.status,
      deliveredBlockCount: dispatchResult.deliveredCount,
    };
  }

  // ===== 看板分析桥接方法 =====

  /**
   * 判断企微用户消息是否为看板/运营分析型请求。
   *
   * 与 wecom-ai-conversation-orchestration.service.ts 的 isDashboardAnalysisQuestion
   * 保持一致的信号词检测逻辑，确保路由层和执行层使用相同判定标准。
   */
  private isWecomDashboardAnalysisRequest(questionText: string): boolean {
    const normalizedQuestion = questionText.replace(/\s+/gu, '').trim();
    if (!normalizedQuestion) {
      return false;
    }

    // 排除性过滤：以下类型的提问明确是常规筛选/明细分析查询，
    // 不应走 DashboardReportComposer 看板桥接。
    // 覆盖场景："近3个月没有维护进度的客户情况"、"最近3个月没有商机和订单的渠道商情况"
    if (this.isExclusionaryFilterQuery(normalizedQuestion)) {
      return false;
    }

    const hasDashboardSignal = /(数据看板|看板分析|运营看板|经营看板|经营总览|经营概览|经营情况|发展运营|运营数据|运营分析|经营分析|数据运营)/u.test(
      normalizedQuestion,
    );
    const hasAnalysisIntent = /(分析|看板|概览|总览|情况|汇总|统计|趋势|漏斗|分布|排名|排行|明细|建设|结构|贡献|阶段)/u.test(
      normalizedQuestion,
    );
    return hasDashboardSignal && hasAnalysisIntent;
  }

  /**
   * 构造企微看板分析强制路由决策。
   *
   * 参数说明：`inboundMessage` 为企微原始入站消息，`conversationContext` 为当前会话上下文。
   * 返回值说明：返回可直接进入分析链路的决策对象。
   * 调用注意事项：只用于明确的经营总览、经营看板和运营分析问题，避免旧任务上下文或 AI idle
   * 误判把真实经营问数带到帮助菜单。
   */
  private buildForcedDashboardAnalysisDecision(
    inboundMessage: WecomInboundMessage,
    conversationContext: WecomConversationContextRecord,
  ): WecomConversationDecision {
    const questionText = inboundMessage.messageText ?? '';
    return {
      action: 'ANALYZE',
      effectiveQuestionText: questionText,
      entryInterpretationSnapshot: createAiEntryInterpretationSnapshot({
        channel: 'wecom-bot',
        scene: 'WECOM_IDLE_MESSAGE',
        targetWorkflow: 'ANALYSIS_QUERY_EXECUTION',
        originalText: questionText,
        intent: 'ANALYZE',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'MEDIUM',
        usedFallback: true,
        fallbackReason: 'wecom-dashboard-question-forced-analysis-route',
        structuredSlots: {
          entryMode: 'FREE_QUERY',
          requestedAction: 'ANALYZE',
          route: 'DASHBOARD_ANALYSIS',
        },
        generatedAt: new Date().toISOString(),
      }),
      workflowRoutingSnapshot: createAiWorkflowRoutingSnapshot({
        targetWorkflow: 'ANALYSIS_QUERY_EXECUTION',
        finalProgram: 'wecom-bot.processInboundMessage.forcedDashboardAnalysis',
        requiresConfirmation: false,
        gateResult: 'BYPASSED',
        generatedAt: new Date().toISOString(),
      }),
      context: conversationContext,
    };
  }

  /**
   * 常规分析管道（原有 ANALYZE 流程）。
   * 将原有的 analysisService.createQuery + detail 获取 + 模板卡片构建逻辑
   * 抽取为独立方法，供看板桥接的回退路径和常规非看板问题复用。
   */
  private async executeRegularAnalysisPipeline(params: {
    user: CrmUser;
    effectiveQuestionText: string;
    session: QuerySessionRecord;
    conversationContext: WecomConversationContextRecord;
    conversationDecision: WecomConversationDecision;
    receipt: WecomMessageReceiptRecord;
  }): Promise<{
    queryResponse: Awaited<ReturnType<AnalysisService['createQuery']>>;
    detail: Record<string, unknown> | undefined;
    templateCards: WecomDispatchTemplateCard[];
    dispatchBlocks: StreamBlock[];
    imageAttachments: WecomDispatchImageAttachment[];
    userFacingClarificationPrompt: string | undefined;
    receipt: WecomMessageReceiptRecord;
    conversationContext: WecomConversationContextRecord;
  }> {
    const queryResponse = await this.analysisService.createQuery(params.user, {
      querySource: 'FREE_TEXT',
      channel: 'wecom-bot',
      questionText: params.effectiveQuestionText,
      sessionId: params.session.id,
      followUpQueryId:
        params.conversationDecision.action === 'FOLLOW_UP_ANALYZE' ||
        params.conversationDecision.action === 'CLARIFICATION_REPLY'
          ? params.conversationContext.workMemory.latestQueryId
          : undefined,
    });

    let receipt = params.receipt;
    receipt = this.wecomMessageReceiptRepository.save({
      ...receipt,
      queryId: queryResponse.queryId ? String(queryResponse.queryId) : undefined,
      updatedAt: new Date().toISOString(),
    });

    const detail =
      queryResponse.status === 'RETURNED' && queryResponse.queryId
        ? this.analysisService.getQueryDetail(
            params.user,
            String(queryResponse.queryId),
            'wecom-bot',
          )
        : undefined;

    const conversationContext =
      this.wecomAiConversationOrchestrationService.updateWorkMemoryAfterResponse(
        params.conversationContext,
        {
          questionText: params.effectiveQuestionText,
          queryId: receipt.queryId,
          summary: detail?.summary ? String(detail.summary) : undefined,
          latestResultContext: this.buildLatestResultContext(detail, {
            queryId: receipt.queryId,
            questionText: params.effectiveQuestionText,
          }),
          pendingSlots:
            queryResponse.status === 'CLARIFICATION_REQUIRED'
              ? ((queryResponse.missingConditions as string[] | undefined) ?? [])
              : [],
        },
      );

    const userFacingClarificationPrompt =
      queryResponse.status === 'BLOCKED'
        ? this.buildUserFacingBlockedReply(
            String(queryResponse.clarificationPrompt ?? '当前请求已被系统拦截。'),
            { messageText: params.effectiveQuestionText } as WecomInboundMessage,
          )
        : (queryResponse.clarificationPrompt as string | undefined);

    const imageAttachments = await this.buildAnalysisImageAttachments(detail);
    const templateCards = this.buildAnalysisTemplateCards(detail, {
      hasImageAttachments: imageAttachments.length > 0,
      queryId: queryResponse.queryId ? String(queryResponse.queryId) : undefined,
    });
    const dispatchBlocks = this.resolveDispatchBlocks(
      queryResponse,
      detail,
      userFacingClarificationPrompt,
      { preferImageAttachments: imageAttachments.length > 0 },
    );

    return {
      queryResponse,
      detail,
      templateCards,
      dispatchBlocks,
      imageAttachments,
      userFacingClarificationPrompt,
      receipt,
      conversationContext,
    };
  }

  /**
   * 将 DashboardReportComposer 的结构化看板结果转换为企微可展示格式。
   *
   * 核心转换策略：
   * - KPI matrix → 模板卡片 horizontal_content_list（最多 6 项核心指标）
   * - 饼图/漏斗/柱状图/趋势图 → 结构化 Markdown 文本块（含数据和洞察）
   * - 排名表格 → Markdown 表格文本
   * - 所有 block 汇总为多段 dispatch blocks，每段一个图表/表格
   *
   * 参数说明：`dashboardResult` 为 DashboardReportComposer.compose() 返回值。
   * 返回值说明：包含模板卡片、dispatch blocks、以及用于 detail 记录的 metricCards/tableBlocks。
   */
  private convertDashboardResultToWecomFormat(
    dashboardResult: DashboardComposeResult,
    questionText: string,
    dashboardQueryId?: string,
    cardImage?: { imageUrl?: string; imageAspectRatio?: number },
  ): {
    templateCards: WecomDispatchTemplateCard[];
    dispatchBlocks: StreamBlock[];
    dashboardTemplate: {
      code: string;
      displayName: string;
      cardTitle: string;
    };
    publicSections: Array<{
      sectionType: string;
      title: string;
      description?: string;
      rows?: Array<Record<string, unknown>>;
    }>;
    metricCardsForDetail: MetricCard[];
    tableBlocksForDetail: Array<{
      title?: string;
      rows?: Array<Record<string, unknown>>;
      columns?: Array<{ key: string; label: string }>;
    }>;
  } {
    const blocks = dashboardResult.blocks;
    const kpiBlock = blocks.find((b) => b.blockType === 'kpi-matrix');
    const kpiMetrics = (kpiBlock?.metrics ?? []).slice(0, 6);

    // 诊断日志：记录看板 block 转换入口
    const blockTypeSummary = blocks.map((b) => b.blockType).join(', ');
    this.analysisLoggerService.logInfo(
      `convertDashboardResultToWecomFormat() 收到 ${blocks.length} 个 block: [${blockTypeSummary}], ` +
        `errors=${dashboardResult.errors.length}`,
    );

    // 构建卡片点击 URL。
    // 企微 text_notice 要求 card_action 为有效跳转动作；即使最终交付以长连接文本为主，
    // 也必须给卡片提供合法 URL，否则企微会按 42045 拒收模板卡片。
    const effectiveQueryId = dashboardQueryId ?? buildEntityId('query');
    const webDashboardUrl = this.resolveDashboardPublicReportUrl(effectiveQueryId);

    const dataSourceLabel =
      dashboardResult.dataSource === 'OPENAPI_REALTIME'
        ? 'CRM OpenAPI 实时数据'
        : 'CRM 同步数据';
    const dashboardTemplate = this.wecomDashboardTemplateResolverService.resolve({
      questionText,
      reportTitle: dashboardResult.reportTitle,
      blocks,
    });
    const kpiItems = this.wecomDashboardKpiSelectorService.selectCardKpiItems({
      dashboardResult,
      template: dashboardTemplate,
    });
    const templateCard = this.wecomDashboardCardBuilder.buildDashboardCard({
      queryId: effectiveQueryId,
      title: dashboardTemplate.cardTitle,
      kpiItems,
      summary: dashboardResult.executiveSummary || '已生成核心指标、经营判断、明细摘要和企微图片看板。',
      webDashboardUrl,
      dataSourceLabel: `${dashboardResult.scopeSummary || '当前用户权限范围'} / ${dataSourceLabel}`,
      sourceDesc: 'CRM智能助手',
      quoteTitle: this.resolveDashboardCardQuoteTitle(dashboardTemplate.cardTitle),
      quoteText: this.buildDashboardCardQuoteText(dashboardResult.blocks),
      imageUrl: cardImage?.imageUrl,
      imageAspectRatio: cardImage?.imageAspectRatio,
      imageTitle: this.resolveDashboardCardImageTitle(dashboardTemplate.cardTitle),
      imageDesc: this.buildDashboardCardImageDesc(dashboardResult),
    });

    const templateCards: WecomDispatchTemplateCard[] = [
      {
        sequence: 0,
        contentPreview: `${dashboardResult.reportTitle}\n${dashboardResult.executiveSummary}`,
        templateCard,
      },
    ];

    // ===== 将看板 block 转换为紧凑的综合报告（单个 dispatch block）=====
    // 核心设计原则：
    // 1. 合并为单一 block，避免多 block 分发时前面内容被截断/覆盖
    // 2. 总字数严格控制在 4000 字符以内（远低于 maxStreamReplyBytes=20480）
    // 3. KPI 数值放在最前面（用户第一眼就能看到）
    // 4. 饼图/漏斗只取 Top 关键数据点，不输出完整明细
    // 5. 表格只取 Top 5 行，用紧凑列表而非 Markdown 表格
    // 6. 完整详细数据通过模板卡片 KPI + Web 跳转链接查看

    // 构建单一 dispatch block。企微长连接内必须直接返回完整模板化摘要，
    // 不能依赖外部网页入口才能看到关键经营维度。
    let fullReport = this.wecomDashboardMarkdownRendererService.render({
      dashboardResult,
      questionText,
      webDashboardUrl,
      template: dashboardTemplate,
      cardKpiItems: kpiItems,
    });
    if (fullReport.length > 4000) {
      fullReport = fullReport.substring(0, 3970) + '\n\n_...（更多详情可继续追问，系统将通过企微长连接分段返回）_';
    }

    const dispatchBlocks: StreamBlock[] = [
      {
        sequence: 0,
        blockType: 'REPORT',
        content: fullReport,
      },
    ];

    // 诊断日志：记录转换结果
    const totalContentBytes = dispatchBlocks.reduce((sum, b) => sum + Buffer.byteLength(b.content, 'utf8'), 0);
    this.analysisLoggerService.logInfo(
      `convertDashboardResultToWecomFormat() 输出 ${dispatchBlocks.length} 个 dispatch block, ` +
        `总内容 ${totalContentBytes} bytes, ` +
        `各块大小: [${dispatchBlocks.map((b) => Buffer.byteLength(b.content, 'utf8')).join(', ')}]`,
    );

    // 从 KPI block 提取 MetricCard 格式（兼容 buildAnalysisTemplateCards 的 detail 结构）
    const metricCardsForDetail: MetricCard[] = kpiMetrics.map((m) => ({
      name: m.label,
      value: m.value,
    })) as unknown as MetricCard[];

    const tableBlocksForDetail = blocks
      .filter((b) => b.blockType === 'sortable-table')
      .map((b) => ({
        title: b.title,
        rows: (b.rows ?? []) as Array<Record<string, unknown>>,
        columns: (b.columns ?? []).map((column) => ({
          key: column.key,
          label: column.label,
        })),
      }));

    return {
      templateCards,
      dispatchBlocks,
      dashboardTemplate: {
        code: dashboardTemplate.code,
        displayName: dashboardTemplate.displayName,
        cardTitle: dashboardTemplate.cardTitle,
      },
      publicSections: this.buildDashboardPublicSections(dashboardResult, dashboardTemplate.cardTitle),
      metricCardsForDetail,
      tableBlocksForDetail,
    };
  }

  /**
   * 构造公开 HTML 报告使用的看板分区元数据。
   *
   * 参数说明：`dashboardResult` 为看板组装结果，`cardTitle` 为当前动态模板标题。
   * 返回值说明：返回公开报告可展示的分区摘要，P2 用于让 HTML 报告和企微卡片保持同一模板门面。
   * 调用注意事项：这里只复用已有区块，不额外查询 CRM 数据。
   */
  private buildDashboardPublicSections(
    dashboardResult: DashboardComposeResult,
    cardTitle: string,
  ): DashboardPublicSection[] {
    const chartSections = dashboardResult.blocks
      .map((block) => this.buildDashboardChartPublicSection(block))
      .filter((section): section is DashboardPublicSection => Boolean(section));

    return [
      {
        sectionType: 'DASHBOARD_TEMPLATE',
        title: `${cardTitle}展示分区`,
        description: '本报告已按企微动态看板模板组织，卡片摘要、长连接正文、图片附件和备查报告使用同一模板识别结果；企微内优先展示指标、对比摘要和图片看板。',
        rows: dashboardResult.blocks.map((block) => ({
          blockType: block.blockType,
          title: block.title,
        })),
      },
      ...chartSections,
    ];
  }

  /**
   * 将看板结构化 block 转成公开 HTML 报告可渲染的图表分区。
   *
   * 参数说明：`block` 为看板组装器产出的结构化区块。
   * 返回值说明：只转换折线、占比、柱状、漏斗、集中度和地图等图表区块；表格和指标卡由原有区域展示。
   * 调用注意事项：这里只搬运已计算好的只读结果，不重新查询 CRM，避免公开报告和企微正文口径不一致。
   */
  private buildDashboardChartPublicSection(block: DashboardBlock): DashboardPublicSection | undefined {
    if (block.blockType === 'geo-map') {
      return {
        sectionType: 'DASHBOARD_GEO_MAP',
        title: block.title,
        description: '全国地图基于本次 CRM 实时统计结果绘制，颜色深浅表示该区域当前命中数量。',
        rows: block.regions.map((region) => ({
          province: region.name,
          partnerCount: region.value,
          value: region.value,
          levelSummary: region.extra ?? '',
        })),
        chartType: 'geo-map',
        chartData: {
          mapName: block.mapName,
          regions: block.regions,
          totalRegionCount: block.totalRegionCount,
          coveredRegionCount: block.coveredRegionCount,
          unitLabel: block.unitLabel,
        },
      };
    }

    if (block.blockType === 'composite-trend') {
      return {
        sectionType: 'DASHBOARD_CHART',
        title: block.title,
        description: '趋势图用于观察月度变化、节奏波动和阶段性拐点。',
        chartType: 'composite-trend',
        rows: this.buildDashboardTrendImageRows(block),
        chartData: {
          categories: block.categories,
          barSeries: block.barSeries,
          lineSeries: block.lineSeries ?? [],
          barUnitLabel: block.barUnitLabel,
          lineUnitLabel: block.lineUnitLabel,
        },
      };
    }

    if (block.blockType === 'pie-distribution') {
      return {
        sectionType: 'DASHBOARD_CHART',
        title: block.title,
        description: '占比图用于判断结构是否均衡，以及未设置、低活跃或高集中项是否需要治理。',
        items: block.insights,
        chartType: 'pie-distribution',
        rows: block.segments.map((segment) => ({
          分组: segment.name,
          数值: segment.value,
        })),
        chartData: {
          segments: block.segments,
          totalValue: block.totalValue,
          unitLabel: block.unitLabel,
          insights: block.insights ?? [],
        },
      };
    }

    if (block.blockType === 'grouped-bar') {
      return {
        sectionType: 'DASHBOARD_CHART',
        title: block.title,
        description: block.description ?? '分组柱状图只比较同一指标在不同区域、团队或渠道之间的差异。',
        chartType: 'grouped-bar',
        rows: this.buildDashboardGroupedBarImageRows(block),
        chartData: {
          categories: block.categories,
          series: block.series,
          unitLabel: block.unitLabel,
        },
      };
    }

    if (block.blockType === 'funnel') {
      return {
        sectionType: 'DASHBOARD_CHART',
        title: block.title,
        description: '漏斗图用于识别从客户报备、商机、报价到订单的主要流失阶段。',
        items: block.insights,
        chartType: 'funnel',
        rows: this.buildDashboardFunnelImageRows(block) ?? [],
        chartData: {
          stages: block.stages,
          insights: block.insights ?? [],
        },
      };
    }

    if (block.blockType === 'concentration') {
      return {
        sectionType: 'DASHBOARD_CHART',
        title: block.title,
        description: '集中度图用于观察头部渠道或区域贡献是否过度集中。',
        items: block.insights,
        chartType: 'concentration',
        rows: this.buildDashboardConcentrationImageRows(block) ?? [],
        chartData: {
          totalValue: block.totalValue,
          totalUnits: block.totalUnits,
          tiers: block.tiers,
          oneTimeCount: block.oneTimeCount,
          oneTimePercentage: block.oneTimePercentage,
          unitLabel: block.unitLabel,
          insights: block.insights,
        },
      };
    }

    return undefined;
  }

  /**
   * 解析看板卡片引用区标题。
   *
   * 参数说明：`cardTitle` 为当前企微动态看板标题。
   * 返回值说明：返回适合企微卡片引用区展示的短标题。
   */
  private resolveDashboardCardQuoteTitle(cardTitle: string): string {
    if (/漏斗|转化/u.test(cardTitle)) {
      return '漏斗断点';
    }

    if (/区域|生态|覆盖/u.test(cardTitle)) {
      return '覆盖对比';
    }

    if (/排行|贡献/u.test(cardTitle)) {
      return '头部对比';
    }

    return '关键发现';
  }

  /**
   * 解析图文卡片图片区标题。
   *
   * 参数说明：`cardTitle` 为当前企微动态看板标题。
   * 返回值说明：返回不超过企微建议长度的图片说明标题。
   */
  private resolveDashboardCardImageTitle(cardTitle: string): string {
    if (/漏斗|转化/u.test(cardTitle)) {
      return '漏斗趋势';
    }

    if (/排行|贡献/u.test(cardTitle)) {
      return '贡献排行';
    }

    if (/区域|覆盖|生态/u.test(cardTitle)) {
      return '覆盖图示';
    }

    return '图表看板';
  }

  /**
   * 构造图文卡片图片区说明。
   *
   * 参数说明：`dashboardResult` 为结构化看板结果。
   * 返回值说明：返回适合企微卡片左图右文区域展示的短说明。
   */
  private buildDashboardCardImageDesc(dashboardResult: DashboardComposeResult): string {
    const blockTypes = new Set(dashboardResult.blocks.map((block) => block.blockType));
    if (blockTypes.has('composite-trend')) {
      return '趋势图已内嵌展示';
    }

    if (blockTypes.has('funnel')) {
      return '漏斗断点已内嵌展示';
    }

    if (blockTypes.has('grouped-bar') || blockTypes.has('sortable-table')) {
      return '同类排行已内嵌展示';
    }

    if (blockTypes.has('geo-map')) {
      return '区域覆盖已内嵌展示';
    }

    return '核心指标已内嵌展示';
  }

  /**
   * 构造看板卡片引用区短分析。
   *
   * 参数说明：`blocks` 为看板结构化区块。
   * 返回值说明：返回最大断点、领先区域、占比最高项、趋势变化等首屏可读结论。
   * 调用注意事项：只基于已经组装好的 block，不重新计算权限外数据。
   */
  private buildDashboardCardQuoteText(blocks: DashboardBlock[]): string {
    const highlights = [
      this.buildDashboardFunnelHighlight(this.findDashboardBlock(blocks, 'funnel')),
      this.buildDashboardMapHighlight(this.findDashboardBlock(blocks, 'geo-map')),
      this.buildDashboardGroupedBarHighlight(this.findDashboardBlock(blocks, 'grouped-bar')),
      this.buildDashboardPieHighlight(this.filterDashboardBlocks(blocks, 'pie-distribution')),
      this.buildDashboardTrendHighlight(this.findDashboardBlock(blocks, 'composite-trend')),
      this.buildDashboardConcentrationHighlight(this.findDashboardBlock(blocks, 'concentration')),
    ].filter((item): item is string => Boolean(item));

    return highlights.slice(0, 3).join('；');
  }

  /**
   * 构造漏斗断点摘要。
   *
   * 参数说明：`funnelBlock` 为漏斗区块。
   * 返回值说明：返回最低转化率阶段。
   */
  private buildDashboardFunnelHighlight(
    funnelBlock: Extract<DashboardBlock, { blockType: 'funnel' }> | undefined,
  ): string | undefined {
    const weakestStage = funnelBlock?.stages
      .map((stage, index) => ({ stage, index }))
      .filter((item) => item.index > 0 && typeof item.stage.rate === 'number')
      .sort((left, right) => (left.stage.rate ?? 1) - (right.stage.rate ?? 1))[0];
    if (!funnelBlock || !weakestStage) {
      return undefined;
    }

    const previousStage = funnelBlock.stages[weakestStage.index - 1];
    return `最大断点：${previousStage.name}→${weakestStage.stage.name} ${(weakestStage.stage.rate! * 100).toFixed(1)}%`;
  }

  /**
   * 构造地图覆盖摘要。
   *
   * 参数说明：`mapBlock` 为地图区块。
   * 返回值说明：返回覆盖率和领先区域。
   */
  private buildDashboardMapHighlight(
    mapBlock: Extract<DashboardBlock, { blockType: 'geo-map' }> | undefined,
  ): string | undefined {
    if (!mapBlock || mapBlock.regions.length === 0) {
      return undefined;
    }

    const coveredCount = mapBlock.coveredRegionCount ?? mapBlock.regions.filter((region) => region.value > 0).length;
    const totalCount = mapBlock.totalRegionCount ?? 31;
    const leadingRegion = [...mapBlock.regions].sort((left, right) => right.value - left.value)[0];
    const coverageRate = totalCount > 0 ? `${((coveredCount / totalCount) * 100).toFixed(1)}%` : '0.0%';
    return `覆盖：${coveredCount}/${totalCount}（${coverageRate}），领先${leadingRegion.name}${leadingRegion.value}`;
  }

  /**
   * 构造分组柱状对比摘要。
   *
   * 参数说明：`barBlock` 为分组柱状图区块。
   * 返回值说明：返回首个系列的领先分类。
   */
  private buildDashboardGroupedBarHighlight(
    barBlock: Extract<DashboardBlock, { blockType: 'grouped-bar' }> | undefined,
  ): string | undefined {
    const series = barBlock?.series[0];
    if (!barBlock || !series || series.values.length === 0) {
      return undefined;
    }

    const topIndex = series.values.reduce((maxIndex, value, index) => value > series.values[maxIndex] ? index : maxIndex, 0);
    const topCategory = barBlock.categories[topIndex] ?? '未命名';
    const topValue = series.values[topIndex] ?? 0;
    const metricLabel = this.normalizeDashboardMetricLabel(series.name);
    return `${metricLabel}领先：${topCategory} ${this.formatDashboardComparableValue(metricLabel, topValue)}`;
  }

  /**
   * 构造占比分布摘要。
   *
   * 参数说明：`pieBlocks` 为所有占比分布区块。
   * 返回值说明：返回占比最高的结构项。
   */
  private buildDashboardPieHighlight(
    pieBlocks: Array<Extract<DashboardBlock, { blockType: 'pie-distribution' }>>,
  ): string | undefined {
    const pieBlock = pieBlocks.find((block) => block.segments.length > 0);
    if (!pieBlock) {
      return undefined;
    }

    const totalValue = pieBlock.totalValue ?? pieBlock.segments.reduce((sum, segment) => sum + segment.value, 0);
    const topSegment = [...pieBlock.segments].sort((left, right) => right.value - left.value)[0];
    if (!topSegment) {
      return undefined;
    }

    const percentage = totalValue > 0 ? `${((topSegment.value / totalValue) * 100).toFixed(1)}%` : '0.0%';
    return `${pieBlock.title}：${topSegment.name}最高，占${percentage}`;
  }

  /**
   * 构造趋势变化摘要。
   *
   * 参数说明：`trendBlock` 为柱线组合趋势区块。
   * 返回值说明：返回首个系列最新一期较前一期变化。
   */
  private buildDashboardTrendHighlight(
    trendBlock: Extract<DashboardBlock, { blockType: 'composite-trend' }> | undefined,
  ): string | undefined {
    const series = trendBlock?.barSeries[0] ?? trendBlock?.lineSeries?.[0];
    if (!series || series.values.length === 0) {
      return undefined;
    }

    const latestValue = series.values[series.values.length - 1] ?? 0;
    const previousValue = series.values.length > 1 ? series.values[series.values.length - 2] ?? 0 : undefined;
    if (previousValue === undefined) {
      return `最新趋势：${series.name}${Number(latestValue.toFixed(2))}`;
    }

    const diff = latestValue - previousValue;
    return `最新趋势：${series.name}${Number(latestValue.toFixed(2))}，较前${diff >= 0 ? '+' : ''}${Number(diff.toFixed(2))}`;
  }

  /**
   * 构造集中度摘要。
   *
   * 参数说明：`concentrationBlock` 为集中度区块。
   * 返回值说明：返回首个集中度层级或已有洞察。
   */
  private buildDashboardConcentrationHighlight(
    concentrationBlock: Extract<DashboardBlock, { blockType: 'concentration' }> | undefined,
  ): string | undefined {
    const insight = concentrationBlock?.insights?.[0];
    if (insight) {
      return insight;
    }

    const tier = concentrationBlock?.tiers?.[0];
    return tier ? `${tier.label}集中度：${tier.percentage}%` : undefined;
  }

  /**
   * 预先构造看板图片生成所需的轻量载荷。
   *
   * 参数说明：`dashboardResult` 为结构化看板结果，`questionText` 为用户原始问题。
   * 返回值说明：返回图片生成需要的模板、指标和明细行。
   */
  private buildDashboardPreviewPayload(
    dashboardResult: DashboardComposeResult,
    questionText: string,
  ): {
    dashboardTemplate: { code: string; cardTitle: string };
    metricCardsForDetail: MetricCard[];
    tableBlocksForDetail: Array<{ title?: string; rows?: Array<Record<string, unknown>> }>;
  } {
    const blocks = dashboardResult.blocks;
    const dashboardTemplate = this.wecomDashboardTemplateResolverService.resolve({
      questionText,
      reportTitle: dashboardResult.reportTitle,
      blocks,
    });
    const kpiBlock = blocks.find((block) => block.blockType === 'kpi-matrix');
    const metricCardsForDetail: MetricCard[] = ((kpiBlock?.metrics ?? []).slice(0, 6)).map((metric) => ({
      name: metric.label,
      value: `${metric.value}${metric.unit ?? ''}`,
    })) as unknown as MetricCard[];
    const tableBlocksForDetail = blocks
      .filter((block) => block.blockType === 'sortable-table')
      .map((block) => ({
        title: block.title,
        rows: (block.rows ?? []) as Array<Record<string, unknown>>,
      }));

    return {
      dashboardTemplate: {
        code: dashboardTemplate.code,
        cardTitle: dashboardTemplate.cardTitle,
      },
      metricCardsForDetail,
      tableBlocksForDetail,
    };
  }

  /**
   * 生成企微动态看板图片附件。
   *
   * 参数说明：`dashboardResult` 为看板结果，`dashboardPayload` 为已转换的企微载荷。
   * 返回值说明：返回可交给分发层上传的图片附件；图片生成失败时返回空数组。
   * 调用注意事项：图片只是 P2 展示增强，不能阻断模板卡片和 Markdown 正文投递。
   */
  private async buildDashboardImageAttachments(
    dashboardResult: DashboardComposeResult,
    dashboardPayload: {
      dashboardTemplate: { code: string; cardTitle: string };
      metricCardsForDetail: MetricCard[];
      tableBlocksForDetail: Array<{ title?: string; rows?: Array<Record<string, unknown>> }>;
    },
  ): Promise<WecomDispatchImageAttachment[]> {
    const bundle = await this.buildDashboardImageBundle(dashboardResult, dashboardPayload, {
      layout: 'detail',
    });
    return bundle.imageAttachments;
  }

  /**
   * 生成企微模板卡片内嵌图片包。
   *
   * 参数说明：`dashboardQueryId` 为当前看板查询 ID。
   * 返回值说明：优先返回公开图片 URL；写公开图片失败时返回图片附件兜底。
   */
  private async buildDashboardCardImageBundle(
    dashboardResult: DashboardComposeResult,
    dashboardPayload: {
      dashboardTemplate: { code: string; cardTitle: string };
      metricCardsForDetail: MetricCard[];
      tableBlocksForDetail: Array<{ title?: string; rows?: Array<Record<string, unknown>> }>;
    },
    dashboardQueryId: string,
  ): Promise<DashboardCardImageBundle> {
    const webDashboardUrl = this.resolveDashboardPublicReportUrl(dashboardQueryId);
    return await this.buildDashboardImageBundle(dashboardResult, dashboardPayload, {
      layout: 'card',
      dashboardQueryId,
      webDashboardUrl,
    });
  }

  private async buildDashboardImageBundle(
    dashboardResult: DashboardComposeResult,
    dashboardPayload: {
      dashboardTemplate: { code: string; cardTitle: string };
      metricCardsForDetail: MetricCard[];
      tableBlocksForDetail: Array<{ title?: string; rows?: Array<Record<string, unknown>> }>;
    },
    options: {
      layout: 'detail' | 'card';
      dashboardQueryId?: string;
      webDashboardUrl?: string;
    },
  ): Promise<DashboardCardImageBundle> {
    if (!this.shouldRenderDashboardImage(dashboardPayload.dashboardTemplate.code)) {
      return { imageAttachments: [] };
    }

    const defaultVariant = this.resolveDashboardImageVariant(dashboardPayload.dashboardTemplate.code);
    const imageSource =
      options.layout === 'card'
        ? this.resolveDashboardCardImageSource(dashboardResult, dashboardPayload, defaultVariant)
        : {
            variant: defaultVariant,
            rows: this.resolveDashboardImageRows(dashboardResult, dashboardPayload, defaultVariant),
          };
    if (imageSource.rows.length === 0) {
      return { imageAttachments: [] };
    }

    try {
      const artifact = await this.wecomAnalysisTableImageService.renderTableImage({
        title:
          options.layout === 'card'
            ? `${dashboardPayload.dashboardTemplate.cardTitle}图表看板`
            : `${dashboardPayload.dashboardTemplate.cardTitle}图片看板`,
        summary: dashboardResult.executiveSummary,
        metricCards: dashboardPayload.metricCardsForDetail.slice(0, 4),
        variant: imageSource.variant,
        layout: options.layout,
        rows: imageSource.rows,
      });
      if (!artifact) {
        return { imageAttachments: [] };
      }

      if (options.layout === 'card' && options.dashboardQueryId && options.webDashboardUrl) {
        try {
          const imageUrl = this.saveDashboardCardImage(
            artifact.buffer,
            options.dashboardQueryId,
            options.webDashboardUrl,
          );
          return {
            imageUrl,
            imageAspectRatio: artifact.aspectRatio,
            imageAttachments: [],
          };
        } catch (error) {
          this.analysisLoggerService.logWarn('企微看板卡片图片保存失败，已降级为图片附件。', {
            templateCode: dashboardPayload.dashboardTemplate.code,
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return {
        imageAttachments: [
          {
            sequence: 9000,
            filename: artifact.filename,
            buffer: artifact.buffer,
            contentPreview: `${dashboardPayload.dashboardTemplate.cardTitle}图片看板｜${artifact.previewText}`,
          },
        ],
      };
    } catch (error) {
      this.analysisLoggerService.logWarn('企微动态看板图片生成失败，已降级为卡片和正文。', {
        templateCode: dashboardPayload.dashboardTemplate.code,
        reason: error instanceof Error ? error.message : String(error),
      });
      return { imageAttachments: [] };
    }
  }

  /**
   * 保存模板卡片图表图片并返回公开地址。
   *
   * 参数说明：`buffer` 为 PNG 内容，`dashboardQueryId` 为查询 ID，`webDashboardUrl` 为同一报告公开地址。
   * 返回值说明：返回企业微信客户端可访问的公开图片 URL。
   * 调用注意事项：文件名只使用安全字符，避免把问题文本或敏感字段写入路径。
   */
  private saveDashboardCardImage(
    buffer: Buffer,
    dashboardQueryId: string,
    webDashboardUrl: string,
  ): string {
    const imageDir = join(
      this.localRuntimeConfigService.getRepoRoot(),
      '.runtime',
      'public',
      'wecom-dashboard-images',
    );
    mkdirSync(imageDir, { recursive: true });

    const safeQueryId = this.normalizePublicImageFilenamePart(dashboardQueryId);
    const filename = `wecom-dashboard-card-${safeQueryId}-${Date.now()}.png`;
    writeFileSync(join(imageDir, filename), buffer, { mode: 0o644 });

    return this.buildDashboardCardImageUrl(webDashboardUrl, filename);
  }

  private buildDashboardCardImageUrl(webDashboardUrl: string, filename: string): string {
    try {
      const reportUrl = new URL(webDashboardUrl);
      const publicPathIndex = reportUrl.pathname.indexOf('/public/analysis-results/');
      const apiPrefix =
        publicPathIndex >= 0
          ? reportUrl.pathname.slice(0, publicPathIndex)
          : /\/api\/v1$/u.test(reportUrl.pathname)
          ? reportUrl.pathname
          : '/api/v1';
      reportUrl.pathname = `${apiPrefix.replace(/\/+$/u, '')}/public/wecom-dashboard-images/${filename}`;
      reportUrl.search = '';
      reportUrl.hash = '';
      return reportUrl.toString();
    } catch {
      const config = this.localRuntimeConfigService.getWecomRuntimeConfig();
      const apiBaseUrl = this.resolvePublicApiBaseUrl(config.webBaseUrl);
      return `${apiBaseUrl.replace(/\/+$/u, '')}/api/v1/public/wecom-dashboard-images/${filename}`;
    }
  }

  private normalizePublicImageFilenamePart(value: string): string {
    const normalized = value.replace(/[^a-zA-Z0-9_-]/gu, '-').replace(/-+/gu, '-');
    return normalized.slice(0, 80) || 'query';
  }

  /**
   * 判断模板是否需要生成图片看板。
   *
   * 参数说明：`templateCode` 为动态看板模板编码。
   * 返回值说明：P2 优先覆盖 6 类重点图片模板。
   */
  private shouldRenderDashboardImage(templateCode: string): boolean {
    return [
      'BUSINESS_OVERVIEW',
      'FUNNEL_DIAGNOSIS',
      'CHANNEL_RANKING',
      'REGION_COMPARISON',
      'CHANNEL_PROFILE',
      'REGISTRATION_PROTECTION',
      'OPPORTUNITY_RISK',
      'QUOTE_TO_ORDER',
      'RENEWAL_SUCCESS',
      'PRODUCT_SOLUTION',
      'SERVICE_ECOSYSTEM',
      'DISTRIBUTION_HEALTH',
      'CADENCE_REPORT',
      'DATA_SCOPE_QUALITY',
    ].includes(templateCode);
  }

  /**
   * 解析模板卡片图片优先展示的数据来源。
   *
   * 参数说明：`dashboardResult` 为看板结果，`dashboardPayload` 为卡片载荷，`fallbackVariant` 为模板默认图形。
   * 返回值说明：优先返回趋势、排行或分布数据，保证折线图和对比图进入模板卡片图片。
   */
  private resolveDashboardCardImageSource(
    dashboardResult: DashboardComposeResult,
    dashboardPayload: {
      metricCardsForDetail: MetricCard[];
      tableBlocksForDetail: Array<{ title?: string; rows?: Array<Record<string, unknown>> }>;
    },
    fallbackVariant: WecomAnalysisImageVariant,
  ): {
    variant: WecomAnalysisImageVariant;
    rows: Array<Record<string, unknown>>;
  } {
    const preferredVariants: WecomAnalysisImageVariant[] = [
      'trend',
      'ranking',
      'distribution',
      'map',
      fallbackVariant,
      'summary',
    ];
    const seenVariants = new Set<WecomAnalysisImageVariant>();

    for (const variant of preferredVariants) {
      if (seenVariants.has(variant)) {
        continue;
      }

      seenVariants.add(variant);
      const chartRows = this.resolveDashboardChartImageRows(dashboardResult.blocks, variant);
      if (chartRows.length > 0) {
        return {
          variant,
          rows: chartRows.slice(0, 10),
        };
      }
    }

    return {
      variant: fallbackVariant,
      rows: this.resolveDashboardImageRows(dashboardResult, dashboardPayload, fallbackVariant),
    };
  }

  /**
   * 解析图片看板表格行。
   *
   * 参数说明：`dashboardPayload` 为企微看板载荷。
   * 返回值说明：优先返回真实明细表；无明细时用指标行兜底生成图片。
   */
  private resolveDashboardImageRows(
    dashboardResult: DashboardComposeResult,
    dashboardPayload: {
      metricCardsForDetail: MetricCard[];
      tableBlocksForDetail: Array<{ title?: string; rows?: Array<Record<string, unknown>> }>;
    },
    variant: WecomAnalysisImageVariant,
  ): Array<Record<string, unknown>> {
    const chartRows = this.resolveDashboardChartImageRows(dashboardResult.blocks, variant);
    if (chartRows.length > 0) {
      return chartRows.slice(0, 10);
    }

    const tableRows = dashboardPayload.tableBlocksForDetail.find((block) => (block.rows?.length ?? 0) > 0)?.rows ?? [];
    if (tableRows.length > 0) {
      return tableRows.slice(0, 10);
    }

    return dashboardPayload.metricCardsForDetail.slice(0, 8).map((metric) => ({
      指标: metric.name,
      数值: metric.value,
    }));
  }

  /**
   * 从看板结构化图表中提炼企微图片行。
   *
   * 参数说明：`blocks` 为看板区块，`variant` 为图片展示倾向。
   * 返回值说明：优先返回趋势、占比、排行或漏斗对应的结构化行。
   * 调用注意事项：图片行只用于展示，不改变 Markdown 正文和 HTML 报告中的原始图表数据。
   */
  private resolveDashboardChartImageRows(
    blocks: DashboardBlock[],
    variant: WecomAnalysisImageVariant,
  ): Array<Record<string, unknown>> {
    if (variant === 'map') {
      const mapRows = this.buildDashboardMapImageRows(this.findDashboardBlock(blocks, 'geo-map'));
      if ((mapRows?.length ?? 0) > 0) {
        return mapRows ?? [];
      }
    }

    if (variant === 'trend') {
      const trendRows = this.buildDashboardTrendImageRows(this.findDashboardBlock(blocks, 'composite-trend'));
      if (trendRows.length > 0) {
        return trendRows;
      }
    }

    if (variant === 'distribution') {
      const pieRows = this.buildDashboardPieImageRows(this.filterDashboardBlocks(blocks, 'pie-distribution'));
      if (pieRows.length > 0) {
        return pieRows;
      }
    }

    if (variant === 'ranking') {
      const barRows = this.buildDashboardGroupedBarImageRows(this.findDashboardBlock(blocks, 'grouped-bar'));
      if (barRows.length > 0) {
        return barRows;
      }
    }

    return (
      this.buildDashboardFunnelImageRows(this.findDashboardBlock(blocks, 'funnel')) ??
      this.buildDashboardMapImageRows(this.findDashboardBlock(blocks, 'geo-map')) ??
      this.buildDashboardConcentrationImageRows(this.findDashboardBlock(blocks, 'concentration')) ??
      []
    );
  }

  /**
   * 构造趋势图片行。
   *
   * 参数说明：`trendBlock` 为趋势区块。
   * 返回值说明：返回按月份展开的系列数据行。
   */
  private buildDashboardTrendImageRows(
    trendBlock: Extract<DashboardBlock, { blockType: 'composite-trend' }> | undefined,
  ): Array<Record<string, unknown>> {
    if (!trendBlock) {
      return [];
    }

    const seriesList = [...trendBlock.barSeries, ...(trendBlock.lineSeries ?? [])].slice(0, 4);
    return trendBlock.categories.map((category, index) => {
      const row: Record<string, unknown> = { 月份: category };
      for (const series of seriesList) {
        row[series.name] = series.values[index] ?? 0;
      }
      return row;
    });
  }

  /**
   * 构造占比图片行。
   *
   * 参数说明：`pieBlocks` 为占比分布区块。
   * 返回值说明：返回第一个可用占比分布的分段行。
   */
  private buildDashboardPieImageRows(
    pieBlocks: Array<Extract<DashboardBlock, { blockType: 'pie-distribution' }>>,
  ): Array<Record<string, unknown>> {
    const pieBlock = pieBlocks.find((block) => block.segments.length > 0);
    if (!pieBlock) {
      return [];
    }

    return pieBlock.segments.map((segment) => ({
      分组: segment.name,
      数值: segment.value,
    }));
  }

  /**
   * 构造分组柱状图片行。
   *
   * 参数说明：`barBlock` 为分组柱状图区块。
   * 返回值说明：返回按分类展开的系列数据行。
   */
  private buildDashboardGroupedBarImageRows(
    barBlock: Extract<DashboardBlock, { blockType: 'grouped-bar' }> | undefined,
  ): Array<Record<string, unknown>> {
    if (!barBlock) {
      return [];
    }

    return barBlock.categories.map((category, index) => {
      const row: Record<string, unknown> = { 分组: category };
      for (const series of barBlock.series.slice(0, 4)) {
        row[series.name] = series.values[index] ?? 0;
      }
      return row;
    });
  }

  /**
   * 构造漏斗图片行。
   *
   * 参数说明：`funnelBlock` 为漏斗区块。
   * 返回值说明：返回阶段、数量和转化率行。
   */
  private buildDashboardFunnelImageRows(
    funnelBlock: Extract<DashboardBlock, { blockType: 'funnel' }> | undefined,
  ): Array<Record<string, unknown>> | undefined {
    if (!funnelBlock || funnelBlock.stages.length === 0) {
      return undefined;
    }

    return funnelBlock.stages.map((stage) => ({
      阶段: stage.name,
      数量: stage.value,
      转化率: typeof stage.rate === 'number' ? Number((stage.rate * 100).toFixed(1)) : undefined,
    }));
  }

  /**
   * 构造地图覆盖图片行。
   *
   * 参数说明：`mapBlock` 为地图区块。
   * 返回值说明：返回区域和命中数量，作为企微图片中的覆盖排行图示。
   */
  private buildDashboardMapImageRows(
    mapBlock: Extract<DashboardBlock, { blockType: 'geo-map' }> | undefined,
  ): Array<Record<string, unknown>> | undefined {
    if (!mapBlock || mapBlock.regions.length === 0) {
      return undefined;
    }

    return [...mapBlock.regions]
      .sort((left, right) => right.value - left.value)
      .map((region) => ({
        区域: region.name,
        数量: region.value,
      }));
  }

  /**
   * 构造集中度图片行。
   *
   * 参数说明：`concentrationBlock` 为集中度区块。
   * 返回值说明：返回层级和占比行。
   */
  private buildDashboardConcentrationImageRows(
    concentrationBlock: Extract<DashboardBlock, { blockType: 'concentration' }> | undefined,
  ): Array<Record<string, unknown>> | undefined {
    if (!concentrationBlock || concentrationBlock.tiers.length === 0) {
      return undefined;
    }

    return concentrationBlock.tiers.map((tier) => ({
      层级: tier.label,
      占比: tier.percentage,
      金额: tier.value,
    }));
  }

  /**
   * 解析图片看板样式。
   *
   * 参数说明：`templateCode` 为动态看板模板编码。
   * 返回值说明：返回现有图片渲染服务支持的版式类型。
   */
  private resolveDashboardImageVariant(
    templateCode: string,
  ): WecomAnalysisImageVariant {
    if (
      templateCode === 'BUSINESS_OVERVIEW' ||
      templateCode === 'REGION_COMPARISON'
    ) {
      return 'map';
    }

    if (templateCode === 'CHANNEL_RANKING') {
      return 'ranking';
    }

    if (
      templateCode === 'FUNNEL_DIAGNOSIS' ||
      templateCode === 'CADENCE_REPORT' ||
      templateCode === 'RENEWAL_SUCCESS'
    ) {
      return 'trend';
    }

    if (
      templateCode === 'CHANNEL_PROFILE' ||
      templateCode === 'OPPORTUNITY_RISK' ||
      templateCode === 'PRODUCT_SOLUTION' ||
      templateCode === 'SERVICE_ECOSYSTEM' ||
      templateCode === 'DISTRIBUTION_HEALTH'
    ) {
      return 'distribution';
    }

    if (templateCode === 'QUOTE_TO_ORDER' || templateCode === 'REGISTRATION_PROTECTION') {
      return 'ranking';
    }

    return 'summary';
  }

  /**
   * 解析看板模板卡片标题。
   *
   * 参数说明：`questionText` 为用户原始提问，`fallbackTitle` 为报告生成器标题。
   * 返回值说明：返回设计文档定义的看板卡片大类标题，无法判断时使用报告标题。
   * 调用注意事项：这里只调整展示门面，不改变底层查询条件和分析结果。
   */
  private resolveDashboardTemplateCardTitle(
    questionText: string,
    fallbackTitle: string,
  ): string {
    const normalizedQuestion = questionText.trim();
    if (/(漏斗|转化|报备到订单|报价到订单|断点)/u.test(normalizedQuestion)) {
      return '业务漏斗诊断';
    }

    if (/(排行|排名|贡献|头部|TOP|top)/u.test(normalizedQuestion)) {
      return '渠道贡献排行';
    }

    if (/(区域|省份|地区|大区|城市|覆盖)/u.test(normalizedQuestion)) {
      return '区域经营对比';
    }

    if (/(技术服务商|生态)/u.test(normalizedQuestion)) {
      return '技术服务商生态';
    }

    if (/(质量|权限|口径|字段|缺失|可信)/u.test(normalizedQuestion)) {
      return '数据质量与权限口径';
    }

    if (/(渠道|代理商|服务商|伙伴|经营|运营|发展|整体|总览|看板)/u.test(normalizedQuestion)) {
      return '经营总览看板';
    }

    return fallbackTitle;
  }

  private buildDashboardWecomTemplateReport(
    dashboardResult: DashboardComposeResult,
    questionText: string,
    webDashboardUrl?: string,
  ): string {
    const blocks = dashboardResult.blocks;
    const kpiBlock = this.findDashboardBlock(blocks, 'kpi-matrix');
    const funnelBlock = this.findDashboardBlock(blocks, 'funnel');
    const trendBlock = this.findDashboardBlock(blocks, 'composite-trend');
    const concentrationBlock = this.findDashboardBlock(blocks, 'concentration');
    const mapBlock = this.findDashboardBlock(blocks, 'geo-map');
    const barBlock = this.findDashboardBlock(blocks, 'grouped-bar');
    const pieBlocks = this.filterDashboardBlocks(blocks, 'pie-distribution');
    const tableBlocks = this.filterDashboardBlocks(blocks, 'sortable-table');
    const partnerTable = tableBlocks.find((block) => /渠道|代理商|服务商/u.test(block.title));
    const regionTable = tableBlocks.find((block) => /区域|大区/u.test(block.title));
    const hasOrderData = this.hasDashboardOrderData(funnelBlock, partnerTable);

    const lines: string[] = [];
    lines.push('【展示模板】经营数据运营看板卡');
    lines.push('【回复结构】问题复述 / 数据口径 / 权限口径 / 核心经营判断 / 核心指标 / 业务漏斗与趋势 / 渠道集中度 / 区域覆盖与业务分布 / 渠道贡献排行 / 渠道结构与状态分布 / 明细摘要 / 风险建议 / 建议追问');
    lines.push(`## ${dashboardResult.reportTitle}`);
    lines.push(`【问题复述】${questionText.trim() || '经营看板查询'}`);
    lines.push('【数据口径】');
    lines.push(`- 数据范围：${dashboardResult.scopeSummary || '当前用户权限范围'}`);
    lines.push(`- 数据来源：${dashboardResult.dataSource === 'OPENAPI_REALTIME' ? 'CRM OpenAPI 实时数据' : 'CRM 同步数据'}`);
    lines.push('- 金额单位：人民币；看板金额按系统统计口径展示。');
    lines.push(`- 口径说明：${hasOrderData ? '当前包含订单口径，渠道贡献优先按订单金额解读；所有对比只在同一对象和同一指标内进行。' : '当前真实订单数据不足，渠道贡献优先按报价金额或商机金额作为前置经营口径，不能等同真实成交；所有对比只在同一对象和同一指标内进行。'}`);
    lines.push('');

    lines.push('【权限口径】');
    lines.push(`- 当前可见范围：${dashboardResult.scopeSummary || '当前用户权限范围'}`);
    lines.push('- 结果仅基于当前企微用户绑定 CRM 账号可访问的数据；如无全国或全量权限，系统不会越权补全不可见数据。');
    lines.push('');

    lines.push('【核心经营判断】');
    lines.push(`1. ${dashboardResult.executiveSummary || '已生成 CRM 经营看板，请结合下方指标判断。'}`);
    lines.push(`2. ${this.buildDashboardPrimaryJudgement(funnelBlock, mapBlock, partnerTable)}`);
    lines.push(`3. ${this.buildDashboardRiskJudgement(hasOrderData, pieBlocks, dashboardResult.errors)}`);
    lines.push('');

    lines.push('【核心指标】');
    const kpiLines = this.buildDashboardKpiLines(kpiBlock, funnelBlock, partnerTable);
    for (const line of kpiLines) {
      lines.push(`- ${line}`);
    }
    if (kpiLines.length === 0) {
      lines.push('- 暂无可展示的核心指标，请检查 CRM 统计端点返回。');
    }
    lines.push('');

    lines.push('【业务漏斗与趋势】');
    const funnelLines = this.buildDashboardFunnelLines(funnelBlock);
    for (const line of funnelLines) {
      lines.push(`- ${line}`);
    }
    const trendLines = this.buildDashboardTrendLines(trendBlock);
    for (const line of trendLines) {
      lines.push(`- ${line}`);
    }
    if (funnelLines.length === 0 && trendLines.length === 0) {
      lines.push('- 暂无漏斗或趋势数据，建议补齐报备、商机、报价、订单的时间序列统计。');
    }
    lines.push('');

    lines.push('【渠道集中度】');
    const concentrationLines = this.buildDashboardConcentrationLines(concentrationBlock);
    for (const line of concentrationLines) {
      lines.push(`- ${line}`);
    }
    if (concentrationLines.length === 0) {
      lines.push('- 暂无可计算的渠道集中度，通常是金额类数据尚未沉淀。');
    }
    lines.push('');

    lines.push('【区域覆盖与业务分布】');
    const regionLines = this.buildDashboardRegionLines(mapBlock, barBlock, regionTable);
    for (const line of regionLines) {
      lines.push(`- ${line}`);
    }
    if (regionLines.length === 0) {
      lines.push('- 暂无区域分布数据，建议检查渠道省份、大区字段是否已维护。');
    }
    lines.push('');

    lines.push('【渠道贡献排行】');
    const rankingLines = this.buildDashboardChannelRankingLines(partnerTable);
    for (const line of rankingLines) {
      lines.push(`- ${line}`);
    }
    if (rankingLines.length === 0) {
      lines.push('- 暂无渠道贡献排行数据。');
    }
    lines.push('');

    lines.push('【渠道结构与状态分布】');
    const structureLines = this.buildDashboardStructureLines(pieBlocks);
    for (const line of structureLines) {
      lines.push(`- ${line}`);
    }
    if (structureLines.length === 0) {
      lines.push('- 暂无渠道等级、技术服务商、阶段或状态分布数据。');
    }
    lines.push('');

    lines.push('【明细摘要】');
    const detailLines = this.buildDashboardDetailLines(tableBlocks);
    for (const line of detailLines) {
      lines.push(`- ${line}`);
    }
    if (detailLines.length === 0) {
      lines.push('- 企微端未收到可摘要的明细表，建议继续追问具体区域或渠道明细。');
    }
    lines.push('');

    lines.push('【风险建议】');
    for (const line of this.buildDashboardGovernanceLines(hasOrderData, mapBlock, pieBlocks, dashboardResult.errors)) {
      lines.push(`- ${line}`);
    }
    lines.push('');

    lines.push('【建议追问】');
    lines.push('- 按区域拆分渠道贡献排行。');
    lines.push('- 查看报价转订单风险清单。');
    lines.push('- 生成经营会摘要和下一步动作。');
    if (webDashboardUrl) {
      lines.push(`【企微展示说明】已通过卡片、正文和图片看板在企微内完成交付；备查报告：${webDashboardUrl}`);
    } else {
      lines.push('【企微展示说明】已通过卡片、正文和图片看板在企微内完成交付；当前未配置外部备查报告入口。');
    }

    return lines.join('\n');
  }

  private findDashboardBlock<T extends DashboardBlock['blockType']>(
    blocks: DashboardBlock[],
    blockType: T,
  ): Extract<DashboardBlock, { blockType: T }> | undefined {
    return blocks.find((block) => block.blockType === blockType) as Extract<DashboardBlock, { blockType: T }> | undefined;
  }

  private filterDashboardBlocks<T extends DashboardBlock['blockType']>(
    blocks: DashboardBlock[],
    blockType: T,
  ): Array<Extract<DashboardBlock, { blockType: T }>> {
    return blocks.filter((block) => block.blockType === blockType) as Array<Extract<DashboardBlock, { blockType: T }>>;
  }

  private buildDashboardKpiLines(
    kpiBlock: Extract<DashboardBlock, { blockType: 'kpi-matrix' }> | undefined,
    funnelBlock: Extract<DashboardBlock, { blockType: 'funnel' }> | undefined,
    partnerTable: Extract<DashboardBlock, { blockType: 'sortable-table' }> | undefined,
  ): string[] {
    const lines: string[] = [];
    const seenLabels = new Set<string>();
    for (const metric of kpiBlock?.metrics ?? []) {
      const value = `${metric.value}${metric.unit ?? ''}`;
      lines.push(`${metric.label}：${value}${metric.sublabel ? `（${metric.sublabel}）` : ''}`);
      seenLabels.add(metric.label);
    }

    const activePartnerLine = this.buildDashboardActivePartnerLine(partnerTable);
    if (activePartnerLine) {
      lines.push(activePartnerLine);
    }

    for (const stage of funnelBlock?.stages ?? []) {
      const normalizedLabel = stage.name === '客户报备' ? '报备数' : `${stage.name}数`;
      if (seenLabels.has(normalizedLabel) || seenLabels.has(stage.name)) {
        continue;
      }
      const amountText = stage.amount !== undefined ? `，金额${this.formatDashboardAmount(stage.amount)}` : '';
      lines.push(`${stage.name}：${stage.value ?? 0}条${amountText}`);
    }

    return lines.slice(0, 12);
  }

  private buildDashboardActivePartnerLine(
    partnerTable: Extract<DashboardBlock, { blockType: 'sortable-table' }> | undefined,
  ): string | undefined {
    const rows = partnerTable?.rows ?? [];
    if (rows.length === 0) {
      return undefined;
    }
    const activeCount = rows.filter((row) =>
      ['registrationCount', 'opportunityCount', 'quoteCount', 'orderCount', 'count'].some((key) =>
        this.toDashboardNumber(row[key]) > 0,
      ),
    ).length;
    return `活跃业务渠道：${activeCount}/${rows.length}家（有报备、商机、报价或订单任一业务记录）`;
  }

  private buildDashboardFunnelLines(
    funnelBlock: Extract<DashboardBlock, { blockType: 'funnel' }> | undefined,
  ): string[] {
    if (!funnelBlock || funnelBlock.stages.length === 0) {
      return [];
    }
    const stageText = funnelBlock.stages
      .map((stage) => `${stage.name}${stage.value ?? 0}条`)
      .join(' -> ');
    const rateText = funnelBlock.stages
      .map((stage, index, stages) => {
        if (index === 0 || stage.rate === undefined) {
          return undefined;
        }
        return `${stages[index - 1].name}到${stage.name}${this.formatDashboardRate(stage.rate)}`;
      })
      .filter((item): item is string => Boolean(item))
      .join('；');
    const amountText = funnelBlock.stages
      .filter((stage) => stage.amount !== undefined)
      .map((stage) => `${stage.name}${this.formatDashboardAmount(stage.amount)}`)
      .join('；');

    const lines = [`阶段量：${stageText}`];
    if (rateText) {
      lines.push(`转化率：${rateText}`);
    }
    if (amountText) {
      lines.push(`阶段金额：${amountText}`);
    }
    for (const insight of funnelBlock.insights ?? []) {
      lines.push(`漏斗洞察：${insight}`);
    }
    return lines;
  }

  private buildDashboardTrendLines(
    trendBlock: Extract<DashboardBlock, { blockType: 'composite-trend' }> | undefined,
  ): string[] {
    if (!trendBlock || trendBlock.categories.length === 0) {
      return [];
    }
    const recentCategories = trendBlock.categories.slice(-3);
    const series = [...(trendBlock.barSeries ?? []), ...(trendBlock.lineSeries ?? [])].slice(0, 4);
    return series.map((item) => {
      const recentValues = item.values.slice(-3);
      const valuesText = recentValues
        .map((value, index) => `${recentCategories[index] ?? `近${recentValues.length - index}期`}:${value}`)
        .join('，');
      return `${trendBlock.title}-${item.name}近3期：${valuesText}`;
    });
  }

  private buildDashboardConcentrationLines(
    concentrationBlock: Extract<DashboardBlock, { blockType: 'concentration' }> | undefined,
  ): string[] {
    if (!concentrationBlock) {
      return [];
    }
    const lines = [
      `分析口径：${concentrationBlock.title}，覆盖${concentrationBlock.totalUnits}家渠道，总金额${this.formatDashboardAmount(concentrationBlock.totalValue)}。`,
    ];
    for (const tier of concentrationBlock.tiers ?? []) {
      lines.push(`${tier.label}：${tier.count}家，金额${this.formatDashboardAmount(tier.value)}，占比${tier.percentage}%。`);
    }
    for (const insight of concentrationBlock.insights ?? []) {
      lines.push(`集中度洞察：${insight}`);
    }
    return lines;
  }

  private buildDashboardRegionLines(
    mapBlock: Extract<DashboardBlock, { blockType: 'geo-map' }> | undefined,
    barBlock: Extract<DashboardBlock, { blockType: 'grouped-bar' }> | undefined,
    regionTable: Extract<DashboardBlock, { blockType: 'sortable-table' }> | undefined,
  ): string[] {
    const lines: string[] = [];
    if (mapBlock && mapBlock.regions.length > 0) {
      const topRegions = [...mapBlock.regions]
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
        .slice(0, 5)
        .map((region) => `${region.name}${region.value}`);
      lines.push(`省份覆盖：${mapBlock.coveredRegionCount ?? mapBlock.regions.length}/${mapBlock.totalRegionCount ?? 31}，前5为${topRegions.join('、')}。`);
    }
    if (barBlock && barBlock.categories.length > 0 && barBlock.series.length > 0) {
      const topItems = barBlock.categories.slice(0, 3).map((category, index) => {
        const values = barBlock.series
          .slice(0, 2)
          .map((series) => {
            const metricLabel = this.normalizeDashboardMetricLabel(series.name);
            return `${metricLabel}${this.formatDashboardComparableValue(metricLabel, this.toDashboardNumber(series.values[index]))}`;
          })
          .join('，');
        return `${category}（${values}）`;
      });
      lines.push(`${barBlock.title}：${topItems.join('；')}。`);
    }
    if (regionTable && regionTable.rows.length > 0) {
      const topRows = regionTable.rows.slice(0, 3).map((row) => {
        const region = String(row.region ?? row.name ?? '--');
        const registration = this.toDashboardNumber(row.registrationCount);
        const opportunityAmount = this.toDashboardNumber(row.oppAmount ?? row.opportunityAmount);
        const quoteAmount = this.toDashboardNumber(row.quoteAmount);
        const orderAmount = this.toDashboardNumber(row.orderAmount ?? row.amount);
        return `${region}：报备${registration}，商机金额${this.formatDashboardAmount(opportunityAmount)}，报价金额${this.formatDashboardAmount(quoteAmount)}，订单金额${this.formatDashboardAmount(orderAmount)}`;
      });
      lines.push(`区域明细前3：${topRows.join('；')}。`);
    }
    return lines;
  }

  private buildDashboardChannelRankingLines(
    partnerTable: Extract<DashboardBlock, { blockType: 'sortable-table' }> | undefined,
  ): string[] {
    const rows = partnerTable?.rows ?? [];
    if (rows.length === 0) {
      return [];
    }

    const lines: string[] = [];
    const registrationLine = this.buildDashboardMetricRankingLine(rows, 'registrationCount', '报备前3', '条');
    const opportunityLine = this.buildDashboardMetricRankingLine(rows, 'opportunityAmount', '商机金额前3', '万');
    const quoteLine = this.buildDashboardMetricRankingLine(rows, 'quoteAmount', '报价金额前3', '万');
    const orderLine = this.buildDashboardMetricRankingLine(rows, 'orderAmount', '订单金额前3', '万');
    if (registrationLine) lines.push(registrationLine);
    if (opportunityLine) lines.push(opportunityLine);
    if (quoteLine) lines.push(quoteLine);
    if (orderLine) {
      lines.push(orderLine);
    } else {
      lines.push('订单金额前3：暂无真实订单金额沉淀，当前不输出下单排行结论。');
    }
    return lines;
  }

  private buildDashboardMetricRankingLine(
    rows: Array<Record<string, string | number>>,
    metricKey: string,
    label: string,
    unit: string,
  ): string | undefined {
    const rankedRows = [...rows]
      .map((row) => ({
        name: String(row.name ?? row.partnerName ?? row.region ?? '--'),
        value: this.toDashboardNumber(row[metricKey]),
      }))
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);
    if (rankedRows.length === 0) {
      return undefined;
    }
    const text = rankedRows
      .map((row) => `${row.name}${unit === '万' ? this.formatDashboardAmount(row.value) : `${row.value}${unit}`}`)
      .join('；');
    return `${label}：${text}。`;
  }

  private buildDashboardStructureLines(
    pieBlocks: Array<Extract<DashboardBlock, { blockType: 'pie-distribution' }>>,
  ): string[] {
    return pieBlocks.slice(0, 5).map((block) => {
      const segments = [...(block.segments ?? [])]
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
        .slice(0, 5)
        .map((segment) => `${segment.name}${segment.value}${block.unitLabel ?? ''}`)
        .join('、');
      const insight = (block.insights ?? []).slice(0, 1).join('；');
      return `${block.title}：${segments}${insight ? `；${insight}` : ''}。`;
    });
  }

  private buildDashboardDetailLines(
    tableBlocks: Array<Extract<DashboardBlock, { blockType: 'sortable-table' }>>,
  ): string[] {
    return tableBlocks.slice(0, 3).map((block) => {
      const previews = block.rows.slice(0, 3).map((row) => {
        const name = String(row.name ?? row.partnerName ?? row.region ?? '--');
        const region = row.region && row.region !== name ? `，区域${row.region}` : '';
        const amount = this.toDashboardNumber(row.amount ?? row.orderAmount ?? row.quoteAmount ?? row.oppAmount ?? row.opportunityAmount);
        const count = this.toDashboardNumber(row.count ?? row.orderCount ?? row.quoteCount ?? row.opportunityCount ?? row.registrationCount);
        const amountText = amount > 0 ? `，金额${this.formatDashboardAmount(amount)}` : '';
        const countText = count > 0 ? `，数量${count}` : '';
        return `${name}${region}${countText}${amountText}`;
      });
      return `${block.title}前3：${previews.join('；')}。`;
    });
  }

  private buildDashboardGovernanceLines(
    hasOrderData: boolean,
    mapBlock: Extract<DashboardBlock, { blockType: 'geo-map' }> | undefined,
    pieBlocks: Array<Extract<DashboardBlock, { blockType: 'pie-distribution' }>>,
    errors: string[],
  ): string[] {
    const lines: string[] = [];
    if (!hasOrderData) {
      lines.push('问题：订单数据不足；影响：真实成交评价弱；建议：优先推进有效报价转订单，并补齐订单状态和金额。');
    }
    const unsetSegment = pieBlocks
      .flatMap((block) => block.segments.map((segment) => ({ title: block.title, segment })))
      .find((item) => /未设置|未知|未参与/u.test(item.segment.name) && item.segment.value > 0);
    if (unsetSegment) {
      lines.push(`问题：${unsetSegment.title}存在${unsetSegment.segment.name}${unsetSegment.segment.value}项；影响：结构判断会被稀释；建议：补齐渠道等级、技术服务商或状态字段。`);
    }
    if (mapBlock && mapBlock.regions.length > 0) {
      const total = mapBlock.regions.reduce((sum, region) => sum + (region.value ?? 0), 0);
      const top = [...mapBlock.regions].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
      if (top && total > 0 && top.value / total >= 0.6) {
        lines.push(`问题：区域数据集中在${top.name}；影响：全国经营判断代表性不足；建议：按大区补齐报备、商机、报价推进数据。`);
      }
    }
    if (errors.length > 0) {
      lines.push(`问题：统计端点返回${errors.length}项异常；影响：部分图表可能缺维度；建议：先复核接口返回和字段映射。`);
    }
    if (lines.length === 0) {
      lines.push('问题：当前未发现强异常；影响：仍需持续核对口径；建议：固定按报备、商机、报价、订单四段漏斗沉淀经营数据。');
    }
    lines.push('治理动作：后续看板固定保留口径说明、替代口径提示、Top排行和明细链接，避免企微短回复误读。');
    return lines;
  }

  private buildDashboardPrimaryJudgement(
    funnelBlock: Extract<DashboardBlock, { blockType: 'funnel' }> | undefined,
    mapBlock: Extract<DashboardBlock, { blockType: 'geo-map' }> | undefined,
    partnerTable: Extract<DashboardBlock, { blockType: 'sortable-table' }> | undefined,
  ): string {
    const orderStage = this.findDashboardFunnelStage(funnelBlock, '订单');
    const quoteStage = this.findDashboardFunnelStage(funnelBlock, '报价');
    const opportunityStage = this.findDashboardFunnelStage(funnelBlock, '商机');
    if (this.toDashboardNumber(orderStage?.value) === 0 && (this.toDashboardNumber(quoteStage?.value) > 0 || this.toDashboardNumber(opportunityStage?.value) > 0)) {
      return '真实订单沉淀不足，当前更适合用报价和商机判断经营推进质量。';
    }
    const activeLine = this.buildDashboardActivePartnerLine(partnerTable);
    if (activeLine) {
      return activeLine.replace('：', '为').replace('（', '，其中').replace('）', '。');
    }
    if (mapBlock && mapBlock.regions.length > 0) {
      return `区域覆盖已沉淀${mapBlock.coveredRegionCount ?? mapBlock.regions.length}个省份，可继续下钻头部区域。`;
    }
    return '当前看板已返回核心经营数据，建议按区域、渠道、阶段继续下钻。';
  }

  private buildDashboardRiskJudgement(
    hasOrderData: boolean,
    pieBlocks: Array<Extract<DashboardBlock, { blockType: 'pie-distribution' }>>,
    errors: string[],
  ): string {
    if (!hasOrderData) {
      return '不要把报价或商机直接解释为真实订单，需要在回复中明确替代口径。';
    }
    if (errors.length > 0) {
      return '部分统计接口存在异常，结论需要以已返回字段为准并提示缺失风险。';
    }
    const hasUnsetStructure = pieBlocks.some((block) =>
      block.segments.some((segment) => /未设置|未知|未参与/u.test(segment.name) && segment.value > 0),
    );
    if (hasUnsetStructure) {
      return '渠道结构存在未设置或未参与项，需要补齐字段后再做精细化分层。';
    }
    return '当前可用于阶段性经营复盘，仍需结合明细确认重点渠道动作。';
  }

  private hasDashboardOrderData(
    funnelBlock: Extract<DashboardBlock, { blockType: 'funnel' }> | undefined,
    partnerTable: Extract<DashboardBlock, { blockType: 'sortable-table' }> | undefined,
  ): boolean {
    const orderStage = this.findDashboardFunnelStage(funnelBlock, '订单');
    if (this.toDashboardNumber(orderStage?.value) > 0 || this.toDashboardNumber(orderStage?.amount) > 0) {
      return true;
    }
    return (partnerTable?.rows ?? []).some((row) =>
      this.toDashboardNumber(row.orderCount) > 0 || this.toDashboardNumber(row.orderAmount) > 0,
    );
  }

  private findDashboardFunnelStage(
    funnelBlock: Extract<DashboardBlock, { blockType: 'funnel' }> | undefined,
    stageName: string,
  ): { name: string; value: number; amount?: number; rate?: number } | undefined {
    return funnelBlock?.stages.find((stage) => stage.name.includes(stageName));
  }

  private formatDashboardRate(rate: number): string {
    const normalizedRate = rate > 1 ? rate : rate * 100;
    return `${normalizedRate.toFixed(1)}%`;
  }

  private normalizeDashboardMetricLabel(label: string): string {
    return label.replace(/（.*?）/gu, '').replace(/\(.*?\)/gu, '').trim() || '指标';
  }

  private formatDashboardComparableValue(metricLabel: string, value: number): string {
    if (/金额|万/u.test(metricLabel)) {
      return this.formatDashboardAmount(value);
    }

    if (/订单|下单/u.test(metricLabel)) {
      return `${Number(value.toFixed(2))}单`;
    }

    if (/商机|报价|报备/u.test(metricLabel)) {
      return `${Number(value.toFixed(2))}个`;
    }

    return String(Number(value.toFixed(2)));
  }

  private formatDashboardAmount(amount: unknown): string {
    const value = this.toDashboardNumber(amount);
    if (value === 0) {
      return '0万';
    }
    const normalizedValue = Math.abs(value) >= 10000 ? value / 10000 : value;
    return `${normalizedValue.toFixed(2)}万`;
  }

  private toDashboardNumber(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = Number(value.replace(/[,%，万]/gu, ''));
      return Number.isFinite(normalized) ? normalized : 0;
    }
    return 0;
  }

  private async handleReceiveError(
    error: unknown,
    inboundMessage: WecomInboundMessage | undefined,
    fallbackSnapshot: Record<string, unknown>,
    options: {
      deliverToChat: boolean;
      streamId?: string;
    },
  ): Promise<WecomReceiveMessageResult> {
    if (error instanceof WecomMaintenanceDegradationError && inboundMessage) {
      const auditContext = await this.resolveWecomAuditContext(
        inboundMessage,
        '企业微信会话进入维护期降级。',
      );
      const degradedDispatchResult =
        await this.wecomStreamDispatcherService.dispatch({
          receiptId: buildEntityId('receipt'),
          sessionId: buildEntityId('session'),
          target: this.buildDispatchTarget(
            inboundMessage,
            options.streamId ?? buildEntityId('stream'),
          ),
          blocks: this.wecomStreamDispatcherService.buildBlockedBlocks(error.message),
        });

      this.auditEventRepository.create({
        id: buildEntityId('audit'),
        eventType: 'MAINTENANCE_DEGRADED',
        ...auditContext.actor,
        ...this.auditEventBuilderService.wecomChannelAgent(inboundMessage),
        scopeSnapshot: auditContext.scopeSnapshot,
        sessionSnapshot: {
          ...this.buildWecomAuditSessionSnapshot(inboundMessage),
          degradationKind: error.kind,
        },
        riskLevel: 'MEDIUM',
        reviewStatus: 'CONFIRMED',
        outcome: error.message,
        actionSummary: '企业微信维护降级提示已发送。',
        targetType: 'wecom-conversation',
        targetId: inboundMessage.externalConversationId,
        targetSummary: `企业微信会话 ${inboundMessage.externalConversationId}`,
        createdAt: new Date().toISOString(),
      });

      return {
        receiptId: buildEntityId('receipt'),
        status: 'DEGRADED',
        acceptedAt: new Date().toISOString(),
        clarificationPrompt: error.message,
        deliveryStatus: degradedDispatchResult.status,
        deliveredBlockCount: degradedDispatchResult.deliveredCount,
      };
    }

    if (inboundMessage && options.deliverToChat) {
      const auditContext = await this.resolveWecomAuditContext(
        inboundMessage,
        '企业微信消息在进入正式分析链路前被拒绝。',
      );
      const blockedReason =
        error instanceof Error ? error.message : '当前企业微信消息处理失败，请稍后重试。';
      const userFacingReason = this.buildUserFacingBlockedReply(
        blockedReason,
        inboundMessage,
      );
      const blockedDispatchResult =
        await this.wecomStreamDispatcherService.dispatch({
          receiptId: buildEntityId('receipt'),
          sessionId: buildEntityId('session'),
          target: this.buildDispatchTarget(
            inboundMessage,
            options.streamId ?? buildEntityId('stream'),
          ),
          blocks: this.wecomStreamDispatcherService.buildBlockedBlocks(
            userFacingReason,
          ),
        });

      this.auditEventRepository.create({
        id: buildEntityId('audit'),
        eventType: 'WECOM_MESSAGE_REJECTED',
        ...auditContext.actor,
        ...this.auditEventBuilderService.wecomChannelAgent(inboundMessage),
        scopeSnapshot: auditContext.scopeSnapshot,
        sessionSnapshot: this.buildWecomAuditSessionSnapshot(inboundMessage),
        riskLevel: 'MEDIUM',
        reviewStatus: 'CONFIRMED',
        outcome: userFacingReason,
        failureReason: blockedReason,
        actionSummary: '企业微信消息已被拒绝。',
        targetType: 'wecom-message',
        targetId: inboundMessage.channelMessageId,
        targetSummary: `企业微信消息 ${inboundMessage.channelMessageId}`,
        createdAt: new Date().toISOString(),
      });

      return {
        receiptId: buildEntityId('receipt'),
        status: 'BLOCKED',
        acceptedAt: new Date().toISOString(),
        clarificationPrompt: userFacingReason,
        deliveryStatus: blockedDispatchResult.status,
        deliveredBlockCount: blockedDispatchResult.deliveredCount,
      };
    }

    const fallbackSenderId =
      inboundMessage?.senderId ?? this.resolveSenderIdFromSnapshot(fallbackSnapshot);
    const fallbackActor = fallbackSenderId
      ? this.auditEventBuilderService.unboundWecomActor(fallbackSenderId)
      : this.auditEventBuilderService.systemActor(
          'system:wecom-bot-ingress',
          '企业微信机器人入口',
        );
    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'WECOM_AUTH_FAILED',
      ...fallbackActor,
      ...this.auditEventBuilderService.wecomChannelAgent(inboundMessage),
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        scopeSummary: '企业微信入口认证失败，未建立有效权限范围。',
      },
      sessionSnapshot: inboundMessage
        ? this.buildWecomAuditSessionSnapshot(inboundMessage)
        : fallbackSnapshot,
      riskLevel: 'HIGH',
      reviewStatus: 'PENDING',
      outcome: '企业微信入口处理失败。',
      failureReason: error instanceof Error ? error.message : '企业微信入口处理失败。',
      actionSummary: '企业微信入口认证失败。',
      targetType: inboundMessage ? 'wecom-message' : 'wecom-ingress',
      targetId: inboundMessage?.channelMessageId,
      targetSummary: inboundMessage
        ? `企业微信消息 ${inboundMessage.channelMessageId}`
        : '企业微信入口请求',
      createdAt: new Date().toISOString(),
    });
    throw error;
  }

  private getActiveWecomTask(
    context: WecomConversationContextRecord,
  ): WecomActiveTaskSnapshot | undefined {
    const writebackId = context.workMemory.activeFollowUpWritebackId;
    if (writebackId) {
      const writebackRecord = this.followUpWritebackRepository.findById(writebackId);
      if (
        context.workMemory.followUpWritebackStatus === 'COMPLETED' &&
        context.workMemory.followUpShareStatus === 'AWAITING_CONFIRMATION'
      ) {
        return {
          kind: 'FOLLOW_UP_SHARE',
          label: writebackRecord
            ? `${this.buildFollowUpTargetDisplay(writebackRecord)}的群共享`
            : '本次群共享',
          writebackRecord,
        };
      }

      return {
        kind: 'FOLLOW_UP_WRITEBACK',
        label: writebackRecord
          ? `${this.buildFollowUpTargetDisplay(writebackRecord)}的跟进写回`
          : '本次CRM跟进写入',
        writebackRecord,
      };
    }

    if (
      context.workMemory.crmCreateEntityType &&
      context.workMemory.crmCreateStatus &&
      context.workMemory.crmCreateStatus !== 'COMPLETED'
    ) {
      return {
        kind:
          context.workMemory.crmCreateEntityType === 'Customer'
            ? 'CUSTOMER_CREATE'
            : 'OPPORTUNITY_CREATE',
        label:
          context.workMemory.crmCreateEntityType === 'Customer'
            ? '本次客户创建'
            : '本次商机创建',
      };
    }

    if (context.workMemory.followUpTemplateDraft) {
      return {
        kind: 'FOLLOW_UP_TEMPLATE',
        label: '当前跟进整理',
      };
    }

    if (
      context.workMemory.dailyReportFlowStatus === 'COLLECTING' ||
      context.workMemory.dailyReportFlowStatus === 'AWAITING_CONFIRMATION' ||
      context.workMemory.dailyReportEntityLookupStatus === 'AWAITING_CONFIRMATION'
    ) {
      return {
        kind: 'DAILY_REPORT',
        label: '当前日报整理',
      };
    }

    return undefined;
  }

  private detectWecomTaskSwitchIntent(
    context: WecomConversationContextRecord,
    messageText?: string,
  ): WecomTaskSwitchIntent | undefined {
    const activeTask = this.getActiveWecomTask(context);
    const trimmedText = messageText?.trim() ?? '';
    if (!activeTask || !trimmedText) {
      return undefined;
    }

    const teamDailyPreviewIntent =
      parseWecomTeamDailyReportPreviewIntent(trimmedText);
    if (teamDailyPreviewIntent) {
      return {
        target: 'TEAM_DAILY_REPORT_QUERY',
        leaderNameQuery: teamDailyPreviewIntent.leaderNameQuery,
      };
    }

    if (isWecomDailyReportSelfViewIntent(trimmedText)) {
      return {
        target: 'DAILY_REPORT_QUERY',
      };
    }

    if (this.isThemeEntryOnlyMessage(trimmedText)) {
      return activeTask.kind === 'FOLLOW_UP_TEMPLATE'
        ? undefined
        : {
            target: 'FOLLOW_UP_TEMPLATE',
          };
    }

    if (isWecomDailyReportEntryOnlyMessage(trimmedText)) {
      return activeTask.kind === 'DAILY_REPORT'
        ? undefined
        : {
            target: 'DAILY_REPORT_ENTRY',
          };
    }

    const crmCreateIntent = detectWecomCrmCreateIntent(trimmedText);
    if (crmCreateIntent === 'Customer') {
      return activeTask.kind === 'CUSTOMER_CREATE'
        ? undefined
        : {
            target: 'CRM_CREATE_CUSTOMER',
          };
    }

    if (crmCreateIntent === 'Opportunity') {
      return activeTask.kind === 'OPPORTUNITY_CREATE'
        ? undefined
        : {
            target: 'CRM_CREATE_OPPORTUNITY',
          };
    }

    return undefined;
  }

  private buildWecomTaskSwitchIntentFromAiTarget(
    target?: WecomTaskSwitchTarget,
  ): WecomTaskSwitchIntent | undefined {
    if (!target) {
      return undefined;
    }

    return { target };
  }

  private isExplicitTaskCancelIntent(messageText?: string): boolean {
    const normalizedText = this.normalizeStandaloneClosingReply(messageText);
    if (!normalizedText || normalizedText.length > 12) {
      return false;
    }

    return WECOM_TASK_CANCEL_KEYWORDS.some((keyword) =>
      normalizedText.includes(keyword),
    );
  }

  /**
   * 判断空闲会话里的文本是否应返回统一帮助。
   * 参数：当前会话上下文、企业微信原始文本；返回 true 表示不应进入问数 / 直查。
   * 注意：
   * 1. AI 主链已先于此方法运行，这里只消费既有理解结果，不再重复调用一次 idle semantic lane；
   * 2. 当 AI 未识别但文本又命中旧入口模式时，也只能退回帮助兜底，不能偷偷恢复旧规则主链；
   * 3. 活跃任务的实体补充和候选回复必须先交给任务状态机。
   */
  private shouldReturnIdleUnrecognizedHelp(
    context: WecomConversationContextRecord,
    messageText?: string,
    entryInterpretationSnapshot?: {
      targetWorkflow?: string;
      usedFallback?: boolean;
      fallbackReason?: string;
      validationFailureReason?: string;
    },
  ): boolean {
    const trimmedText = messageText?.trim() ?? '';
    if (!trimmedText || this.getActiveWecomTask(context)) {
      return false;
    }

    const aiEntryEnabled = process.env.WECOM_AI_ENTRY_INTENT_ENABLED !== 'false';
    const legacyIdleEntryMatched =
      Boolean(parseWecomTeamDailyReportPreviewIntent(trimmedText)) ||
      isWecomDailyReportSelfViewIntent(trimmedText) ||
      isWecomDailyReportEntryOnlyMessage(trimmedText) ||
      this.isThemeEntryOnlyMessage(trimmedText) ||
      Boolean(detectWecomCrmCreateIntent(trimmedText)) ||
      Boolean(this.extractExplicitOpportunityLookupText(trimmedText));

    if (detectWecomHelpIntent(trimmedText)) {
      return true;
    }

    if (this.hasCrmAnalysisQuestionCatalogSignal(trimmedText)) {
      return false;
    }

    if (!aiEntryEnabled) {
      if (legacyIdleEntryMatched) {
        return true;
      }

      return !this.hasExplicitWecomAnalysisOrBlockSignal(trimmedText);
    }

    if (
      entryInterpretationSnapshot?.targetWorkflow === 'ANALYSIS_QUERY_EXECUTION' &&
      entryInterpretationSnapshot.usedFallback === false
    ) {
      return false;
    }

    if (
      entryInterpretationSnapshot?.validationFailureReason ||
      entryInterpretationSnapshot?.fallbackReason === 'PACK_NONE' ||
      entryInterpretationSnapshot?.fallbackReason === 'PACK_DISABLED' ||
      entryInterpretationSnapshot?.fallbackReason === 'PACK_VALIDATION_FAILED' ||
      entryInterpretationSnapshot?.fallbackReason === 'PROVIDER_ERROR' ||
      entryInterpretationSnapshot?.fallbackReason === 'PROVIDER_TIMEOUT' ||
      entryInterpretationSnapshot?.fallbackReason === 'idle-intent-none-default-analyze'
    ) {
      return legacyIdleEntryMatched || !this.hasExplicitWecomAnalysisOrBlockSignal(trimmedText);
    }

    return legacyIdleEntryMatched || !this.hasExplicitWecomAnalysisOrBlockSignal(trimmedText);
  }

  /**
   * 当空闲态 AI 入口理解未能稳定命中时，为显式跟进主题入口保留受控兜底。
   *
   * 参数：当前会话上下文、用户文本、统一入口理解快照；
   * 返回：true 表示当前消息可以安全退回到“跟进模板入口提示”，而不是展示总帮助菜单。
   * 说明：
   * 1. 这里只放行“跟进客户 / 跟进商机 / 今日跟进”这类固定入口短句；
   * 2. 若 AI 已高置信度判成问数分析，则必须尊重主链结果，不可强行改道；
   * 3. 该兜底只拉起模板收集，不直接写回 CRM，因此不会突破执行边界。
   */
  private shouldFallbackToFollowUpThemeEntryPrompt(
    context: WecomConversationContextRecord,
    messageText?: string,
    entryInterpretationSnapshot?: {
      targetWorkflow?: string;
      usedFallback?: boolean;
      fallbackReason?: string;
      validationFailureReason?: string;
    },
  ): boolean {
    const trimmedText = messageText?.trim() ?? '';
    if (!trimmedText || this.getActiveWecomTask(context)) {
      return false;
    }

    if (!this.isThemeEntryOnlyMessage(trimmedText)) {
      return false;
    }

    if (
      entryInterpretationSnapshot?.targetWorkflow === 'ANALYSIS_QUERY_EXECUTION' &&
      entryInterpretationSnapshot.usedFallback === false
    ) {
      return false;
    }

    return (
      !entryInterpretationSnapshot ||
      entryInterpretationSnapshot.usedFallback === true ||
      Boolean(entryInterpretationSnapshot.validationFailureReason) ||
      entryInterpretationSnapshot.fallbackReason === 'PACK_NONE' ||
      entryInterpretationSnapshot.fallbackReason === 'PACK_DISABLED' ||
      entryInterpretationSnapshot.fallbackReason === 'PACK_VALIDATION_FAILED' ||
      entryInterpretationSnapshot.fallbackReason === 'PROVIDER_ERROR' ||
      entryInterpretationSnapshot.fallbackReason === 'PROVIDER_TIMEOUT' ||
      entryInterpretationSnapshot.fallbackReason === 'idle-intent-none-default-analyze'
    );
  }

  private extractAiTaskReplyRuntimeMetadata(
    aiTaskReplyIntent?: { packCode?: string; packVersion?: string; providerCode?: string; model?: string; validationFailureReason?: string } | null,
  ): WecomTaskReplyRuntimeMetadata {
    return {
      packCode: aiTaskReplyIntent?.packCode,
      packVersion: aiTaskReplyIntent?.packVersion,
      providerCode: aiTaskReplyIntent?.providerCode,
      model: aiTaskReplyIntent?.model,
      validationFailureReason: aiTaskReplyIntent?.validationFailureReason,
    };
  }

  /**
   * 当 AI 已判定进入 DAILY_REPORT，且当前消息本身已经是明显的跟进正文时，
   * 需要先补齐跟进模板上下文，后续才能继续复用四段抽槽与写回确认链路。
   */
  private shouldSeedFreeformFollowUpDraft(
    decision: {
      action: string;
      entryInterpretationSnapshot?: {
        structuredSlots?: Record<string, unknown>;
      };
    },
    messageText?: string,
  ): boolean {
    const normalizedText = this.normalizeDailyReportFollowUpText(messageText ?? '');
    if (
      decision.action !== 'DAILY_REPORT' ||
      !normalizedText ||
      isWecomDailyReportThemeEntryIntent(messageText ?? '') ||
      this.isThemeEntryOnlyMessage(normalizedText) ||
      isWecomDailyReportEntryOnlyMessage(normalizedText)
    ) {
      return false;
    }

    const dailyReportPrompt = decision.entryInterpretationSnapshot?.structuredSlots?.[
      'dailyReportPrompt'
    ];
    return dailyReportPrompt === 'FOLLOW_UP_TEMPLATE_ENTRY' &&
      this.isLikelyFreeformFollowUpNarrative(normalizedText);
  }

  /**
   * 从“查 / 查询 / 查商机”等显式查询表达中提取实体名。
   * 参数：用户消息文本；返回剥离查询前缀后的客户 / 公司 / 项目 / 商机关键词。
   * 抛错：不抛业务异常；无法安全提取时返回 undefined，交由后续帮助或分析阻断处理。
   */
  private extractExplicitOpportunityLookupText(
    messageText?: string,
  ): string | undefined {
    const coreText = this.normalizeSingleLineIntentText(messageText);
    if (!coreText || coreText.length > 60) {
      return undefined;
    }

    const lookupPatterns = [
      /^(?:请|麻烦|帮我)?(?:查一下|查一查|查询一下|查询|查找|查)(?:这个|下)?(?:客户|客户名称|公司|公司名称|项目|项目名称|商机|机会)?[：:\s]*(?<target>.+)$/u,
      /^(?:请|麻烦|帮我)?(?:查|查询)(?<target>.+?)(?:的)?(?:客户|公司|项目|商机|机会)$/u,
    ];

    for (const pattern of lookupPatterns) {
      const target = pattern.exec(coreText)?.groups?.target;
      const normalizedTarget = this.normalizeExplicitLookupTarget(target);
      if (normalizedTarget) {
        return normalizedTarget;
      }
    }

    return undefined;
  }

  /**
   * 归一化显式查询里的实体关键词，并过滤天气、日报、排名等不应直查项目的目标。
   */
  private normalizeExplicitLookupTarget(targetText?: string): string | undefined {
    const target = targetText
      ?.trim()
      .replace(/^(?:一下|下|这个|该|对应的?)/u, '')
      .replace(/(?:的)?(?:客户|公司|项目|商机|机会)(?:记录|信息|详情)?$/u, '')
      .replace(/[。！？!?；;，,\s]+$/gu, '')
      .trim();
    if (!target || target.length < 2 || target.length > 40) {
      return undefined;
    }

    if (
      /日报|天气|气温|股票|基金|新闻|汇率|电影|翻译|代码|编程/u.test(target) ||
      /怎么样|如何|分析|统计|排名|排行|趋势|转化|赢单|金额|数量|负责人|区域|本月|本周|本季度|最近|今天|今日|近\d+天/u.test(target) ||
      this.hasAnalysisReportSignal(target)
    ) {
      return undefined;
    }

    return target;
  }

  /**
   * 判断文本是否足够像“受控问数或明确阻断请求”。
   * 返回 true 时继续走既有分析链路，使天气 / 提醒等明确越界请求保持原有审计与 BLOCKED 回执。
   */
  private hasExplicitWecomAnalysisOrBlockSignal(messageText: string): boolean {
    const normalizedText = this.normalizeSingleLineIntentText(messageText);
    if (!normalizedText) {
      return false;
    }

    // 明显跟进叙述在 AI 未识别时也只允许回帮助兜底，不能误打进问数主链。
    if (this.isLikelyFreeformFollowUpNarrative(normalizedText)) {
      return false;
    }

    // 筛选/明细排除过滤：这类提问虽然可能含"客户""商机"等关键词，
    // 但本质是"找出符合条件的记录列表"，不是看板/运营分析请求，
    // 不应进入看板桥接。覆盖场景：
    // "近3个月没有维护进度的客户情况"
    // "最近3个月没有商机和订单的渠道商情况"
    if (this.isExclusionaryFilterQuery(normalizedText)) {
      return false;
    }

    if (
      /天气|气温|股票|基金|新闻|汇率|电影|翻译|代码|编程|提醒我|删除|修改|更新状态|改成已成交/u.test(
        normalizedText,
      )
    ) {
      return true;
    }

    if (/商机|机会|漏斗|赢单率|合同|签单|签约|成交|回款|客户|客资|客群/u.test(normalizedText)) {
      return true;
    }

    // 看板/运营分析类信号词：这类提问虽然可能不含常规 metric/dimension 关键词，
    // 但明确表达了数据分析意图，应直接放行到 ANALYZE 分支。
    // 覆盖场景："渠道商经营分析看板"、"全国渠道商发展运营数据看板"、
    //       "各区域渠道商发展运营数据情况看板"、"代理商发展运营数据看板"
    if (
      /数据看板|看板分析|运营看板|经营看板|发展运营|运营数据|运营分析|经营分析|数据运营|渠道商.*看板|渠道商.*分析|代理商.*看板|代理商.*分析|区域.*看板|排名.*看板|汇总.*看板|统计.*看板|明细.*看板|趋势.*看板|漏斗.*看板|分布.*看板|建设.*看板|结构.*看板|贡献.*看板|阶段.*看板|下单.*汇总|签单.*汇总|订单.*分析|订单.*看板/u.test(
        normalizedText,
      )
    ) {
      return true;
    }

    return this.hasAnalysisReportSignal(normalizedText);
  }

  /**
   * 筛选/明细排除查询检测。
   *
   * 这类提问本质是"找出符合条件的记录列表"（如"没有维护进度的客户"），
   * 不是看板/运营分析请求，不应进入 DashboardReportComposer 看板桥接。
   *
   * 覆盖场景：
   * - "近3个月没有维护进度的客户情况"
   * - "最近3个月没有商机和订单的渠道商情况"
   * - "无跟进记录的客户"
   * - "未维护的商机"
   */
  private isExclusionaryFilterQuery(normalizedText: string): boolean {
    if (!normalizedText) {
      return false;
    }
    // 三组排除模式：
    // 1. 没有 + (客户|商机|订单|报价|渠道商|代理商) + 情况/的
    // 2. 无 + (进展|维护|跟进|商机|订单|更新)
    // 3. 未 + (维护|跟进|进展|更新|联系)
    // 4. 含"没有维护进度""没有跟进"等明确筛选意图
    const isExclusionary =
      /没有.{0,8}(客户|商机|订单|报价|渠道商|代理商).{0,6}(情况|的|列表|明细)/u.test(normalizedText) ||
      /无.{0,4}(进展|维护|跟进|商机|订单|更新|联系)/u.test(normalizedText) ||
      /未.{0,4}(维护|跟进|进展|更新|联系)/u.test(normalizedText) ||
      /没有.{0,6}(维护进度|跟进记录|商机和订单|维护记录)/u.test(normalizedText);
    return isExclusionary;
  }

  /**
   * 识别“今天跟进了谁、遇到什么问题、明天怎么推进”这类明显跟进叙述。
   *
   * 这里只用于阻止 AI miss 时误入问数分析，并不直接负责路由到跟进链路，
   * 真正的业务分流仍必须由前面的 AI idle semantic lane 决定。
   */
  private isLikelyFreeformFollowUpNarrative(messageText: string): boolean {
    if (
      detectWecomHelpIntent(messageText) ||
      detectWecomCrmCreateIntent(messageText) ||
      parseWecomTeamDailyReportPreviewIntent(messageText) ||
      isWecomDailyReportSelfViewIntent(messageText) ||
      isWecomDailyReportEntryOnlyMessage(messageText) ||
      this.isThemeEntryOnlyMessage(messageText) ||
      this.extractExplicitOpportunityLookupText(messageText)
    ) {
      return false;
    }

    const hasFollowUpAction =
      /跟进|拜访|走访|推进|沟通|对接|联系|回访|拜会|约见|洽谈|面谈/u.test(
        messageText,
      );
    const hasNarrativeContext =
      /今天|今日|昨天|上午|下午|晚上|目前|当前|已经|已|无进度|推进缓慢|客户不好沟通|明天|后天|下周|继续跟进/u.test(
        messageText,
      );
    const hasTemplateLikeField = /协助|问题|共享|计划/u.test(messageText);

    return hasFollowUpAction && (hasNarrativeContext || hasTemplateLikeField);
  }

  /**
   * 当 AI 已明确决定进入跟进整理时，提前种入模板上下文，避免正文再次掉回分析主链。
   */
  private activateFollowUpTemplateDraft(
    conversationContext: WecomConversationContextRecord,
    user: CrmUser,
  ): WecomConversationContextRecord {
    return this.wecomAiConversationOrchestrationService.updateFollowUpTemplateMemory(
      this.wecomAiConversationOrchestrationService.updateDailyReportMemory(
        conversationContext,
        {
          flowStatus: 'COLLECTING',
          nextFragmentType: DAILY_REPORT_SECTION_ORDER[0],
          supervisorId: user.id,
          supervisorName: user.name,
        },
      ),
      createWecomFollowUpTemplateDraft(user.name),
    );
  }

  /**
   * 识别经营分析问题里的时间、指标、维度和报表动作组合，避免被空闲帮助兜底吞掉。
   */
  private hasAnalysisReportSignal(messageText: string): boolean {
    const hasMetricOrDimension =
      /新增商机金额|商机金额|商机数量|商机数|机会数|负责人|销售|区域|团队|大区|金额|数量|赢单率|转化率|成交率|客户贡献|报备|未报备|没有报备|未建商机|没有商机|无商机|未下单|未报价|创建时间|创建时长/u.test(
        messageText,
      );
    const hasReportAction = /分析|统计|排名|排行|趋势|报表|明细|详情|多少|多久|多长时间|最高|最低|最多|最少/u.test(
      messageText,
    );
    const hasTime = /今日|今天|昨天|明天|本周|本月|本季度|今年|近\d+天|最近|上月|下月/u.test(
      messageText,
    );

    return this.hasCrmAnalysisQuestionCatalogSignal(messageText) ||
      (hasMetricOrDimension && (hasReportAction || hasTime)) ||
      (hasTime && hasReportAction);
  }

  /**
   * 判断文本是否命中 300 问需求目录。
   *
   * 参数说明：`messageText` 为企微用户原始消息。
   * 返回值说明：返回 true 表示应进入 CRM 智能分析模板路由，而不是帮助菜单。
   * 调用注意事项：该判断只决定入口兜底方向，不直接生成事实数据。
   */
  private hasCrmAnalysisQuestionCatalogSignal(messageText?: string): boolean {
    return Boolean(resolveCrmAnalysisQuestionTemplateRuleByText(messageText));
  }

  private clearActiveTaskContext(params: {
    user: CrmUser;
    sessionId: string;
    conversationContext: WecomConversationContextRecord;
    activeTask: WecomActiveTaskSnapshot;
  }): WecomConversationContextRecord {
    switch (params.activeTask.kind) {
      case 'FOLLOW_UP_SHARE':
        if (params.activeTask.writebackRecord) {
        this.audit(
          params.user,
          'FOLLOW_UP_SHARE_CANCELLED',
          `已取消${this.buildFollowUpTargetDisplay(params.activeTask.writebackRecord)}的群共享。`,
          this.withConversationAuditSnapshot(params.conversationContext, {
            sessionId: params.sessionId,
            followUpWritebackId: params.activeTask.writebackRecord.id,
            objectType: this.getFollowUpRecordObjectType(
              params.activeTask.writebackRecord,
            ),
            objectId: this.getFollowUpRecordObjectId(params.activeTask.writebackRecord),
          }),
        );
        }
        return this.wecomAiConversationOrchestrationService.clearDailyReportMemory(
          this.wecomAiConversationOrchestrationService.clearFollowUpWritebackMemory(
            params.conversationContext,
          ),
        );
      case 'FOLLOW_UP_WRITEBACK': {
        const nextRecord = params.activeTask.writebackRecord
          ? this.followUpWritebackRepository.save({
              ...params.activeTask.writebackRecord,
              status: 'CANCELLED',
              updatedAt: new Date().toISOString(),
            })
          : undefined;
        if (nextRecord) {
          this.audit(
            params.user,
            'FOLLOW_UP_WRITEBACK_CANCELLED',
            `已取消${this.buildFollowUpTargetDisplay(nextRecord)}的跟进写回。`,
            {
              sessionId: params.sessionId,
              followUpWritebackId: nextRecord.id,
              objectType: this.getFollowUpRecordObjectType(nextRecord),
              objectId: this.getFollowUpRecordObjectId(nextRecord),
            },
          );
        }
        return this.wecomAiConversationOrchestrationService.clearDailyReportMemory(
          this.wecomAiConversationOrchestrationService.clearFollowUpWritebackMemory(
            params.conversationContext,
          ),
        );
      }
      case 'CUSTOMER_CREATE':
        this.audit(
          params.user,
          'WECOM_CRM_CREATE_CANCELLED',
          '企业微信客户创建已取消。',
          {
            sessionId: params.sessionId,
            entityType: 'Customer',
          },
        );
        return this.wecomAiConversationOrchestrationService.clearCrmCreateMemory(
          params.conversationContext,
        );
      case 'OPPORTUNITY_CREATE':
        this.audit(
          params.user,
          'WECOM_CRM_CREATE_CANCELLED',
          '企业微信商机创建已取消。',
          {
            sessionId: params.sessionId,
            entityType: 'Opportunity',
          },
        );
        return this.wecomAiConversationOrchestrationService.clearCrmCreateMemory(
          params.conversationContext,
        );
      case 'FOLLOW_UP_TEMPLATE':
      case 'DAILY_REPORT':
        return this.wecomAiConversationOrchestrationService.clearDailyReportMemory(
          params.conversationContext,
        );
      default:
        return params.conversationContext;
    }
  }

  private async handleTaskSwitch(params: {
    user: CrmUser;
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
    activeTask: WecomActiveTaskSnapshot;
    switchIntent: WecomTaskSwitchIntent;
  }): Promise<WecomReceiveMessageResult> {
    const clearedContext = this.clearActiveTaskContext({
      user: params.user,
      sessionId: params.session.id,
      conversationContext: params.conversationContext,
      activeTask: params.activeTask,
    });
    const leadInPrompt = buildWecomTaskSwitchLeadInPrompt(params.activeTask.label);

    switch (params.switchIntent.target) {
      case 'CRM_CREATE_CUSTOMER':
        return await this.handleCrmCreateFlow({
          ...params,
          conversationContext: clearedContext,
          entityType: 'Customer',
          leadInPrompt,
        });
      case 'CRM_CREATE_OPPORTUNITY':
        return await this.handleCrmCreateFlow({
          ...params,
          conversationContext: clearedContext,
          entityType: 'Opportunity',
          leadInPrompt,
        });
      case 'FOLLOW_UP_TEMPLATE':
        return await this.promptDailyReportThemeEntry({
          user: params.user,
          session: params.session,
          receipt: params.receipt,
          inboundMessage: params.inboundMessage,
          conversationContext: clearedContext,
          resetExistingFlow: false,
          leadInPrompt,
        });
      case 'DAILY_REPORT_QUERY':
        return await this.handleDailyReportPreviewQuery({
          user: params.user,
          session: params.session,
          receipt: params.receipt,
          inboundMessage: params.inboundMessage,
          conversationContext: clearedContext,
          leadInPrompt,
        });
      case 'TEAM_DAILY_REPORT_QUERY':
        return await this.handleTeamDailyReportPreviewQuery({
          user: params.user,
          session: params.session,
          receipt: params.receipt,
          inboundMessage: params.inboundMessage,
          conversationContext: clearedContext,
          leaderNameQuery: params.switchIntent.leaderNameQuery ?? '',
          leadInPrompt,
        });
      case 'ENTITY_LOOKUP': {
        const redirectedDecision =
          await this.wecomAiConversationOrchestrationService.decideNextAction(
            clearedContext,
            params.inboundMessage,
            this.userScopeService.resolveScope(params.user),
          );

        if (redirectedDecision.action !== 'ENTITY_LOOKUP') {
          return await this.dispatchTaskGuidancePrompt({
            session: params.session,
            receipt: params.receipt,
            inboundMessage: params.inboundMessage,
            conversationContext: clearedContext,
            prompt: this.mergeLeadInPrompt(
              leadInPrompt,
              buildWecomHelpPrompt({
                scene: 'CAPABILITY',
              }),
            ),
            status: 'RETURNED',
          });
        }

        return await this.handleEntityLookupFlow({
          user: params.user,
          session: params.session,
          receipt: params.receipt,
          inboundMessage: params.inboundMessage,
          conversationContext: clearedContext,
          conversationDecision: redirectedDecision,
        });
      }
      case 'DAILY_REPORT_ENTRY':
      default:
        return await this.handleDailyReportFlow({
          user: params.user,
          session: params.session,
          receipt: params.receipt,
          inboundMessage: params.inboundMessage,
          conversationContext: clearedContext,
          conversationDecision: {},
          leadInPrompt,
        });
    }
  }

  private async handleDailyReportTaskCancel(params: {
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
    activeTask: WecomActiveTaskSnapshot;
  }): Promise<WecomReceiveMessageResult> {
    const clearedContext = this.wecomAiConversationOrchestrationService.clearDailyReportMemory(
      params.conversationContext,
    );
    return await this.dispatchTaskGuidancePrompt({
      session: params.session,
      receipt: params.receipt,
      inboundMessage: params.inboundMessage,
      conversationContext: clearedContext,
      prompt: buildWecomTaskCancelledPrompt(params.activeTask.label),
      status: 'RETURNED',
    });
  }

  /**
   * 判断企业微信业务动作是否启用。
   *
   * 设计原因：第一阶段默认启用企微 CRM 问数，避免消息入口只停留在普通 AI 对话。
   * 如需回到核心聊天模式，可显式配置 WECOM_BUSINESS_ACTIONS_ENABLED=false。
   */
  private areWecomBusinessActionsEnabled(): boolean {
    return process.env.WECOM_BUSINESS_ACTIONS_ENABLED !== 'false';
  }

  /**
   * 判断当前 action 是否可以在核心模式下转为普通 AI 对话。
   *
   * 参数说明：`action` 为企业微信会话编排输出。
   * 返回值说明：通用自由文本类 action 返回 true，其余业务动作返回 false。
   */
  private isWecomCoreAiChatAction(
    action: WecomConversationDecision['action'],
  ): boolean {
    return (
      action === 'ANALYZE' ||
      action === 'FOLLOW_UP_ANALYZE' ||
      action === 'CLARIFICATION_REPLY'
    );
  }

  /**
   * 在核心模式下发送普通 AI 回复。
   *
   * 调用注意事项：该链路不查询 CRM，不保存分析结果，也不生成公开结果页。
   */
  private async dispatchCoreAiChatReply(params: {
    user: CrmUser;
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
  }): Promise<WecomReceiveMessageResult> {
    const replyText = await this.aiGatewayService.generateWecomCoreChatReply({
      messageText: params.inboundMessage.messageText,
      requesterName: params.user.name,
    });

    return await this.dispatchTaskGuidancePrompt({
      session: params.session,
      receipt: params.receipt,
      inboundMessage: params.inboundMessage,
      conversationContext: params.conversationContext,
      prompt: replyText,
      status: 'RETURNED',
    });
  }

  /**
   * 统一回复已收敛的业务能力未启用。
   *
   * 参数说明：`requestedAction` 用于审计排障，不直接暴露给用户。
   * 返回值说明：企业微信发送结果。
   */
  private async dispatchUnsupportedBusinessCapabilityPrompt(params: {
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
    requestedAction?: string;
  }): Promise<WecomReceiveMessageResult> {
    const prompt = [
      '当前机器人已收敛为普通 AI 对话模式。',
      'CRM 问数、渠道分析、合同评审、日报、新增客户/商机、跟进写回、结果导出等业务能力暂未启用。',
      '你可以继续发送普通文本问题；涉及真实业务数据或写入操作的请求，需要后续按模块单独开启。',
    ].join('\n');

    this.analysisLoggerService.logStep('企业微信业务动作已按核心模式拦截。', {
      requestedAction: params.requestedAction,
      sessionId: params.session.id,
      receiptId: params.receipt.id,
    });

    return await this.dispatchTaskGuidancePrompt({
      session: params.session,
      receipt: params.receipt,
      inboundMessage: params.inboundMessage,
      conversationContext: params.conversationContext,
      prompt,
      status: 'RETURNED',
    });
  }

  private async dispatchTaskGuidancePrompt(params: {
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
    prompt: string;
    status: string;
  }): Promise<WecomReceiveMessageResult> {
    this.wecomAiConversationOrchestrationService.appendAssistantTurn(
      params.conversationContext,
      params.prompt,
    );

    const dispatchResult = await this.wecomStreamDispatcherService.dispatch({
      receiptId: params.receipt.id,
      sessionId: params.session.id,
      target: this.buildDispatchTarget(params.inboundMessage, params.receipt.id),
      blocks: this.wecomStreamDispatcherService.buildDirectReplyBlocks(params.prompt),
    });

    this.saveSessionState(params.session, 'IDLE', {
      activeRequestId: undefined,
      lastReceiptId: params.receipt.id,
    });

    return {
      receiptId: params.receipt.id,
      sessionId: params.session.id,
      status: params.status,
      acceptedAt: params.receipt.createdAt,
      deliveryStatus: dispatchResult.status,
      deliveredBlockCount: dispatchResult.deliveredCount,
    };
  }

  private mergeLeadInPrompt(leadInPrompt: string | undefined, prompt: string): string {
    return leadInPrompt ? `${leadInPrompt}\n\n${prompt}` : prompt;
  }

  private shouldHandleActiveCrmCreateMessage(
    context: WecomConversationContextRecord,
    messageText?: string,
  ): boolean {
    if (
      !context.workMemory.crmCreateStatus ||
      !context.workMemory.crmCreateEntityType
    ) {
      return false;
    }

    if (context.workMemory.crmCreateStatus === 'COMPLETED') {
      return isWecomCrmCreateConfirmMessage(messageText);
    }

    return true;
  }

  private async handleCrmCreateFlow(params: {
    user: CrmUser;
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
    entityType?: CrmCreateEntityType;
    leadInPrompt?: string;
    aiTaskReplyIntent?: WecomTaskReplyIntentLike | null;
  }): Promise<WecomReceiveMessageResult> {
    const entityType =
      params.entityType ?? params.conversationContext.workMemory.crmCreateEntityType;

    if (!entityType) {
      return await this.dispatchCrmCreatePrompt({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext: params.conversationContext,
        status: 'WECOM_CRM_CREATE_FAILED',
        prompt: '当前创建草稿已失效，请重新发送“新增客户”或“新增商机”开始。',
        crmCreate: {
          entityType: 'Customer',
          status: 'FAILED',
          title: '未识别创建对象',
          failureReason: '创建对象未识别',
        },
      });
    }

    this.ensureWecomWorkflowAction(
      params.user,
      params.session.id,
      entityType === 'Customer' ? 'wecom.customer.create' : 'wecom.opportunity.create',
      entityType === 'Customer' ? '当前用户无权新增客户。' : '当前用户无权新增商机。',
      entityType === 'Customer' ? 'wecom-customer-create' : 'wecom-opportunity-create',
    );

    if (entityType === 'Customer') {
      return await this.handleCustomerCreateFlow(params);
    }

    return await this.handleOpportunityCreateFlow(params);
  }

  /**
   * 企业微信通道准入只决定能否进入机器人；具体工作流仍必须按动作权限二次校验。
   */
  private ensureWecomWorkflowAction(
    user: CrmUser,
    sessionId: string,
    actionKey:
      | 'wecom.analysis.use'
      | 'wecom.customer.create'
      | 'wecom.opportunity.create'
      | 'wecom.followup.writeback'
      | 'wecom.daily_report.preview',
    reason: string,
    resourceType: string,
  ): void {
    this.permissionEnforcementService.ensureAction(user, actionKey, reason, {
      channel: 'wecom-bot',
      resourceType,
      sessionSnapshot: {
        sessionId,
      },
    });
  }

  /**
   * 在动作权限通过后，再按目标对象负责人执行对象级授权。
   * 这里统一复用同一拒绝出口，确保审计事件能区分“有动作权限但对象关系不满足”的场景。
   */
  private async ensureFollowUpObjectAuthorization(params: {
    user: CrmUser;
    sessionId: string;
    conversationContext?: WecomConversationContextRecord;
    resourceType: string;
    accessToken?: string;
    target: {
      objectType: 'Opportunity' | 'Customer';
      objectId: string;
      objectTitle: string;
      ownerId: string;
      ownerName?: string;
      assistUserIds?: string[];
      assistUserNames?: string[];
      assistUsersResolved?: boolean;
    };
  }): Promise<FollowUpAuthorizationResult> {
    const authorizationTarget =
      params.target.assistUserIds !== undefined ||
      params.target.assistUserNames !== undefined ||
      params.target.assistUsersResolved !== undefined
        ? params.target
        : {
            ...params.target,
            ...(await this.followUpAuthorizationTargetService.resolveAssistUsers({
              user: params.user,
              objectType: params.target.objectType,
              objectId: params.target.objectId,
              accessToken: params.accessToken,
            })),
          };
    const authorizationResult = this.followUpAuthorizationService.evaluate({
      actor: params.user,
      target: authorizationTarget,
    });
    if (authorizationResult.allowed) {
      return authorizationResult;
    }

    this.permissionEnforcementService.denyAction(
      params.user,
      'wecom.followup.writeback',
      authorizationResult.reason,
      {
        channel: 'wecom-bot',
        resourceType: params.resourceType,
        resourceId: params.target.objectId,
        sessionSnapshot: this.withConversationAuditSnapshot(
          params.conversationContext,
          {
            sessionId: params.sessionId,
            objectType: authorizationTarget.objectType,
            objectId: authorizationTarget.objectId,
            objectTitle: authorizationTarget.objectTitle,
            ownerId: authorizationTarget.ownerId,
            ownerName: authorizationTarget.ownerName,
            assistUserIds: authorizationResult.assistUserCrmUserIds,
            assistUserNames: authorizationResult.assistUserNames,
            assistUsersResolved: authorizationTarget.assistUsersResolved,
            matchedRelation: authorizationResult.relation,
            ownerWxUserid: authorizationResult.ownerWxUserid,
            actorWxUserid: authorizationResult.actorWxUserid,
            ownerAncestorCrmUserIds: authorizationResult.ancestorCrmUserIds,
            collaboratorAncestorCrmUserIds:
              authorizationResult.collaboratorAncestorCrmUserIds,
            missingAssistUserCrmUserIds:
              authorizationResult.missingAssistUserCrmUserIds,
          },
        ),
      },
    );
  }

  private async handleCustomerCreateFlow(params: {
    user: CrmUser;
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
    entityType?: CrmCreateEntityType;
    leadInPrompt?: string;
    aiTaskReplyIntent?: WecomTaskReplyIntentLike | null;
  }): Promise<WecomReceiveMessageResult> {
    const customerCreateConfig =
      this.localRuntimeConfigService.getCrmCustomerCreateConfig();
    const requireCategory = !customerCreateConfig.defaultCategory?.trim();
    const requireSource = !customerCreateConfig.defaultSource?.trim();
    const isNewEntry = params.entityType === 'Customer';
    let conversationContext = isNewEntry
      ? this.wecomAiConversationOrchestrationService.updateCrmCreateMemory(
          this.wecomAiConversationOrchestrationService.clearCrmCreateMemory(
            params.conversationContext,
          ),
          {
            entityType: 'Customer',
            status: 'COLLECTING',
            customerDraft: {},
          },
        )
      : params.conversationContext;
    let draft: WecomCustomerCreateDraft =
      conversationContext.workMemory.crmCreateCustomerDraft ?? {};
    const messageText = params.inboundMessage.messageText;

    if (
      isWecomCrmCreateCancelMessage(messageText) ||
      params.aiTaskReplyIntent?.intent === 'TASK_CANCEL'
    ) {
      if (params.aiTaskReplyIntent?.intent === 'TASK_CANCEL') {
        conversationContext =
          this.wecomAiConversationOrchestrationService.updateEntryRoutingMemory(
            conversationContext,
            this.wecomAiConversationOrchestrationService.buildActiveTaskReplySnapshots({
              questionText: messageText ?? '',
              targetWorkflow: 'WECOM_CRM_CREATE_CUSTOMER',
              replyIntent: 'TASK_CANCEL',
              usedFallback: false,
              ...this.extractAiTaskReplyRuntimeMetadata(params.aiTaskReplyIntent),
              structuredSlots: {
                activeTaskLabel: '当前客户创建',
              },
            }),
          );
      }
      conversationContext =
        this.wecomAiConversationOrchestrationService.clearCrmCreateMemory(
          conversationContext,
        );
      this.audit(
        params.user,
        'WECOM_CRM_CREATE_CANCELLED',
        '企业微信客户创建已取消。',
        {
          sessionId: params.session.id,
          entityType: 'Customer',
        },
      );
      return await this.dispatchCrmCreatePrompt({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext,
        leadInPrompt: params.leadInPrompt,
        status: 'WECOM_CRM_CREATE_CANCELLED',
        prompt: buildWecomTaskCancelledPrompt('本次客户创建'),
        crmCreate: {
          entityType: 'Customer',
          status: 'FAILED',
          title: draft.name ?? '客户',
        },
      });
    }

    if (
      conversationContext.workMemory.crmCreateStatus === 'COMPLETED' &&
      (
        isWecomCrmCreateConfirmMessage(messageText) ||
        params.aiTaskReplyIntent?.intent === 'CONTINUE_EXECUTION'
      )
    ) {
      this.audit(
        params.user,
        'WECOM_CRM_CREATE_DUPLICATE_BLOCKED',
        '企业微信客户创建重复确认已拦截。',
        {
          sessionId: params.session.id,
          entityType: 'Customer',
          resultId: conversationContext.workMemory.crmCreateResultId,
        },
      );
      return await this.dispatchCrmCreatePrompt({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext,
        leadInPrompt: params.leadInPrompt,
        status: 'WECOM_CRM_CREATE_SUCCEEDED',
        prompt: buildCrmCreateDuplicatePrompt(
          'Customer',
          conversationContext.workMemory.crmCreateResultSummary,
        ),
        crmCreate: {
          entityType: 'Customer',
          status: 'COMPLETED',
          title: draft.name ?? '客户',
          resultId: conversationContext.workMemory.crmCreateResultId,
        },
      });
    }

    const draftUpdates = parseCustomerDraftUpdates(messageText);
    if (Object.keys(draftUpdates).length > 0) {
      draft = {
        ...draft,
        ...draftUpdates,
      };
      conversationContext =
        this.wecomAiConversationOrchestrationService.updateCrmCreateMemory(
          conversationContext,
          {
            entityType: 'Customer',
            status: 'COLLECTING',
            customerDraft: draft,
            failureReason: undefined,
            resultId: undefined,
            resultSummary: undefined,
          },
        );
    }

    const missingFields = getMissingCustomerFields(draft, {
      requireCategory,
      requireSource,
    });
    const configIssues = this.getCustomerCreateConfigIssues();
    const shouldExecute =
      (isWecomCrmCreateConfirmMessage(messageText) ||
        params.aiTaskReplyIntent?.intent === 'CONTINUE_EXECUTION' ||
        (conversationContext.workMemory.crmCreateStatus === 'FAILED' &&
          isWecomCrmCreateRetryMessage(messageText))) &&
      missingFields.length === 0 &&
      configIssues.length === 0;

    if (shouldExecute) {
      if (params.aiTaskReplyIntent?.intent === 'CONTINUE_EXECUTION') {
        conversationContext =
          this.wecomAiConversationOrchestrationService.updateEntryRoutingMemory(
            conversationContext,
            this.wecomAiConversationOrchestrationService.buildActiveTaskReplySnapshots({
              questionText: messageText ?? '',
              targetWorkflow: 'WECOM_CRM_CREATE_CUSTOMER',
              replyIntent: 'CONTINUE_EXECUTION',
              usedFallback: false,
              ...this.extractAiTaskReplyRuntimeMetadata(params.aiTaskReplyIntent),
              structuredSlots: {
                activeTaskLabel: '当前客户创建',
              },
            }),
          );
      }
      return await this.executeCustomerCreate({
        ...params,
        conversationContext,
        draft,
      });
    }

    if (missingFields.length > 0) {
      const prompt =
        isNewEntry && Object.keys(draftUpdates).length === 0
          ? buildCustomerCreateEntryPrompt({
              requireCategory,
              requireSource,
            })
          : buildCustomerCreateCollectPrompt(
              draft,
              missingFields,
              conversationContext.workMemory.crmCreateFailureReason,
            );
      conversationContext =
        this.wecomAiConversationOrchestrationService.updateCrmCreateMemory(
          conversationContext,
          {
            entityType: 'Customer',
            status: 'COLLECTING',
            customerDraft: draft,
          },
        );
      return await this.dispatchCrmCreatePrompt({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext,
        leadInPrompt: params.leadInPrompt,
        status: 'WECOM_CRM_CREATE_COLLECTING',
        prompt,
        crmCreate: {
          entityType: 'Customer',
          status: 'COLLECTING',
          title: draft.name ?? '客户',
        },
      });
    }

    if (configIssues.length > 0) {
      const failureReason = `缺少新增客户字段映射配置：${configIssues.join('、')}`;
      conversationContext =
        this.wecomAiConversationOrchestrationService.updateCrmCreateMemory(
          conversationContext,
          {
            entityType: 'Customer',
            status: 'FAILED',
            customerDraft: draft,
            failureReason,
          },
        );
      this.audit(
        params.user,
        'WECOM_CRM_CREATE_FAILED',
        '企业微信客户创建因配置缺失被拦截。',
        {
          sessionId: params.session.id,
          entityType: 'Customer',
          failureReason,
        },
      );
      return await this.dispatchCrmCreatePrompt({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext,
        leadInPrompt: params.leadInPrompt,
        status: 'WECOM_CRM_CREATE_FAILED',
        prompt: [
          `客户创建失败：${failureReason}`,
          buildCustomerCreateSummaryPrompt(draft, params.user, {
            defaultCategory: customerCreateConfig.defaultCategory,
            defaultSource: customerCreateConfig.defaultSource,
          }),
          '这是系统配置问题，请联系管理员补齐配置后再重试。',
        ].join('\n'),
        crmCreate: {
          entityType: 'Customer',
          status: 'FAILED',
          title: draft.name ?? '客户',
          failureReason,
        },
      });
    }

    const prompt = buildCustomerCreateSummaryPrompt(draft, params.user, {
      defaultCategory: customerCreateConfig.defaultCategory,
      defaultSource: customerCreateConfig.defaultSource,
    });
    conversationContext =
      this.wecomAiConversationOrchestrationService.updateCrmCreateMemory(
        conversationContext,
        {
          entityType: 'Customer',
          status: 'AWAITING_CONFIRMATION',
          customerDraft: draft,
        },
      );
    this.audit(
      params.user,
      'WECOM_CRM_CREATE_DRAFTED',
      '企业微信客户创建草稿已进入确认阶段。',
      this.withConversationAuditSnapshot(conversationContext, {
        sessionId: params.session.id,
        entityType: 'Customer',
        customerName: draft.name,
      }),
    );
    return await this.dispatchCrmCreatePrompt({
      user: params.user,
      session: params.session,
      receipt: params.receipt,
      inboundMessage: params.inboundMessage,
      conversationContext,
      leadInPrompt: params.leadInPrompt,
      status: 'WECOM_CRM_CREATE_AWAITING_CONFIRMATION',
      prompt,
      crmCreate: {
        entityType: 'Customer',
        status: 'AWAITING_CONFIRMATION',
        title: draft.name ?? '客户',
      },
    });
  }

  private async handleOpportunityCreateFlow(params: {
    user: CrmUser;
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
    entityType?: CrmCreateEntityType;
    leadInPrompt?: string;
    aiTaskReplyIntent?: WecomTaskReplyIntentLike | null;
  }): Promise<WecomReceiveMessageResult> {
    const isNewEntry = params.entityType === 'Opportunity';
    let conversationContext = isNewEntry
      ? this.wecomAiConversationOrchestrationService.updateCrmCreateMemory(
          this.wecomAiConversationOrchestrationService.clearCrmCreateMemory(
            params.conversationContext,
          ),
          {
            entityType: 'Opportunity',
            status: 'COLLECTING',
            opportunityDraft: {},
          },
        )
      : params.conversationContext;
    let draft: WecomOpportunityCreateDraft =
      conversationContext.workMemory.crmCreateOpportunityDraft ?? {};
    const messageText = params.inboundMessage.messageText;
    const productAliasMap =
      this.localRuntimeConfigService.getCrmOpportunityCreateConfig()
        .productAliasMap;

    if (
      isWecomCrmCreateCancelMessage(messageText) ||
      params.aiTaskReplyIntent?.intent === 'TASK_CANCEL'
    ) {
      if (params.aiTaskReplyIntent?.intent === 'TASK_CANCEL') {
        conversationContext =
          this.wecomAiConversationOrchestrationService.updateEntryRoutingMemory(
            conversationContext,
            this.wecomAiConversationOrchestrationService.buildActiveTaskReplySnapshots({
              questionText: messageText ?? '',
              targetWorkflow: 'WECOM_CRM_CREATE_OPPORTUNITY',
              replyIntent: 'TASK_CANCEL',
              usedFallback: false,
              ...this.extractAiTaskReplyRuntimeMetadata(params.aiTaskReplyIntent),
              structuredSlots: {
                activeTaskLabel: '当前商机创建',
              },
            }),
          );
      }
      conversationContext =
        this.wecomAiConversationOrchestrationService.clearCrmCreateMemory(
          conversationContext,
        );
      this.audit(
        params.user,
        'WECOM_CRM_CREATE_CANCELLED',
        '企业微信商机创建已取消。',
        {
          sessionId: params.session.id,
          entityType: 'Opportunity',
        },
      );
      return await this.dispatchCrmCreatePrompt({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext,
        leadInPrompt: params.leadInPrompt,
        status: 'WECOM_CRM_CREATE_CANCELLED',
        prompt: buildWecomTaskCancelledPrompt('本次商机创建'),
        crmCreate: {
          entityType: 'Opportunity',
          status: 'FAILED',
          title: draft.title ?? '商机',
        },
      });
    }

    if (
      conversationContext.workMemory.crmCreateStatus === 'COMPLETED' &&
      (
        isWecomCrmCreateConfirmMessage(messageText) ||
        params.aiTaskReplyIntent?.intent === 'CONTINUE_EXECUTION'
      )
    ) {
      this.audit(
        params.user,
        'WECOM_CRM_CREATE_DUPLICATE_BLOCKED',
        '企业微信商机创建重复确认已拦截。',
        {
          sessionId: params.session.id,
          entityType: 'Opportunity',
          resultId: conversationContext.workMemory.crmCreateResultId,
        },
      );
      return await this.dispatchCrmCreatePrompt({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext,
        leadInPrompt: params.leadInPrompt,
        status: 'WECOM_CRM_CREATE_SUCCEEDED',
        prompt: buildCrmCreateDuplicatePrompt(
          'Opportunity',
          conversationContext.workMemory.crmCreateResultSummary,
        ),
        crmCreate: {
          entityType: 'Opportunity',
          status: 'COMPLETED',
          title: draft.title ?? '商机',
          resultId: conversationContext.workMemory.crmCreateResultId,
        },
      });
    }

    if (draft.customerCandidates?.length) {
      const selectedCandidate = selectCustomerCandidateByReply(
        messageText,
        draft.customerCandidates,
      );
      if (selectedCandidate) {
        draft = {
          ...draft,
          customerId: selectedCandidate.id,
          customerName: selectedCandidate.name,
          customerCandidates: [],
        };
      } else if (
        draft.customerCandidates.length > 0 &&
        parseWecomCandidateSelectionIndex(messageText) !== undefined
      ) {
        return await this.dispatchCrmCreatePrompt({
          user: params.user,
          session: params.session,
          receipt: params.receipt,
          inboundMessage: params.inboundMessage,
          conversationContext,
          leadInPrompt: params.leadInPrompt,
          status: 'WECOM_CRM_CREATE_COLLECTING',
          prompt: buildOpportunityCreateCollectPrompt(draft, getMissingOpportunityFields(draft), {
            customerCandidateLines: draft.customerCandidates.map((item, index) =>
              buildWecomCandidateDisplayLine({
                index,
                title: item.name,
                details: [item.category, item.ownerName],
              }),
            ),
            candidateRetryHint: `未识别到有效候选，请重新选择 1 到 ${draft.customerCandidates.length} 之间的候选序号，或直接回复完整客户名称。`,
          }),
          crmCreate: {
            entityType: 'Opportunity',
            status: 'COLLECTING',
            title: draft.title ?? '商机',
          },
        });
      }
    }

    const parsedOpportunity = parseOpportunityDraftUpdates(
      messageText,
      productAliasMap,
    );
    if (Object.keys(parsedOpportunity.updates).length > 0) {
      draft = {
        ...draft,
        ...parsedOpportunity.updates,
      };
      if (parsedOpportunity.updates.customerId || parsedOpportunity.updates.customerName) {
        draft.customerCandidates = [];
      }
      conversationContext =
        this.wecomAiConversationOrchestrationService.updateCrmCreateMemory(
          conversationContext,
          {
            entityType: 'Opportunity',
            status: 'COLLECTING',
            opportunityDraft: draft,
            failureReason: undefined,
            resultId: undefined,
            resultSummary: undefined,
          },
        );
    }

    const customerResolution = await this.resolveOpportunityDraftCustomer({
      user: params.user,
      draft,
    });
    draft = customerResolution.draft;
    conversationContext =
      this.wecomAiConversationOrchestrationService.updateCrmCreateMemory(
        conversationContext,
        {
          entityType: 'Opportunity',
          status: 'COLLECTING',
          opportunityDraft: draft,
        },
      );

    if (customerResolution.prompt) {
      return await this.dispatchCrmCreatePrompt({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext,
        leadInPrompt: params.leadInPrompt,
        status: 'WECOM_CRM_CREATE_COLLECTING',
        prompt: customerResolution.prompt,
        crmCreate: {
          entityType: 'Opportunity',
          status: 'COLLECTING',
          title: draft.title ?? '商机',
        },
      });
    }

    const missingFields = getMissingOpportunityFields(draft);
    const shouldExecute =
      (isWecomCrmCreateConfirmMessage(messageText) ||
        params.aiTaskReplyIntent?.intent === 'CONTINUE_EXECUTION' ||
        (conversationContext.workMemory.crmCreateStatus === 'FAILED' &&
          isWecomCrmCreateRetryMessage(messageText))) &&
      missingFields.length === 0 &&
      parsedOpportunity.unresolvedProducts.length === 0 &&
      (!draft.customerCandidates || draft.customerCandidates.length === 0);

    if (shouldExecute) {
      if (params.aiTaskReplyIntent?.intent === 'CONTINUE_EXECUTION') {
        conversationContext =
          this.wecomAiConversationOrchestrationService.updateEntryRoutingMemory(
            conversationContext,
            this.wecomAiConversationOrchestrationService.buildActiveTaskReplySnapshots({
              questionText: messageText ?? '',
              targetWorkflow: 'WECOM_CRM_CREATE_OPPORTUNITY',
              replyIntent: 'CONTINUE_EXECUTION',
              usedFallback: false,
              ...this.extractAiTaskReplyRuntimeMetadata(params.aiTaskReplyIntent),
              structuredSlots: {
                activeTaskLabel: '当前商机创建',
              },
            }),
          );
      }
      return await this.executeOpportunityCreate({
        ...params,
        conversationContext,
        draft,
      });
    }

    if (
      missingFields.length > 0 ||
      parsedOpportunity.unresolvedProducts.length > 0 ||
      (draft.customerCandidates?.length ?? 0) > 0
    ) {
      const prompt =
        isNewEntry &&
        Object.keys(parsedOpportunity.updates).length === 0 &&
        !draft.customerCandidates?.length
          ? buildOpportunityCreateEntryPrompt()
          : buildOpportunityCreateCollectPrompt(draft, missingFields, {
              unresolvedProducts: parsedOpportunity.unresolvedProducts,
              failureReason: conversationContext.workMemory.crmCreateFailureReason,
              customerCandidateLines: draft.customerCandidates?.map(
                (item, index) => `候选${index + 1}：${item.name}`,
              ),
            });
      return await this.dispatchCrmCreatePrompt({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext,
        leadInPrompt: params.leadInPrompt,
        status: 'WECOM_CRM_CREATE_COLLECTING',
        prompt,
        crmCreate: {
          entityType: 'Opportunity',
          status: 'COLLECTING',
          title: draft.title ?? '商机',
        },
      });
    }

    const prompt = buildOpportunityCreateSummaryPrompt(draft, params.user);
    conversationContext =
      this.wecomAiConversationOrchestrationService.updateCrmCreateMemory(
        conversationContext,
        {
          entityType: 'Opportunity',
          status: 'AWAITING_CONFIRMATION',
          opportunityDraft: draft,
        },
      );
    this.audit(
      params.user,
      'WECOM_CRM_CREATE_DRAFTED',
      '企业微信商机创建草稿已进入确认阶段。',
      this.withConversationAuditSnapshot(conversationContext, {
        sessionId: params.session.id,
        entityType: 'Opportunity',
        opportunityTitle: draft.title,
        customerId: draft.customerId,
      }),
    );
    return await this.dispatchCrmCreatePrompt({
      user: params.user,
      session: params.session,
      receipt: params.receipt,
      inboundMessage: params.inboundMessage,
      conversationContext,
      leadInPrompt: params.leadInPrompt,
      status: 'WECOM_CRM_CREATE_AWAITING_CONFIRMATION',
      prompt,
      crmCreate: {
        entityType: 'Opportunity',
        status: 'AWAITING_CONFIRMATION',
        title: draft.title ?? '商机',
      },
    });
  }

  private async executeCustomerCreate(params: {
    user: CrmUser;
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
    draft: WecomCustomerCreateDraft;
  }): Promise<WecomReceiveMessageResult> {
    this.audit(
      params.user,
      'WECOM_CRM_CREATE_CONFIRMED',
      '企业微信客户创建已确认执行。',
      this.withConversationAuditSnapshot(params.conversationContext, {
        sessionId: params.session.id,
        entityType: 'Customer',
        customerName: params.draft.name,
      }),
    );

    try {
      const result = await this.createCustomerWithRetry(params.user, params.draft);
      const successPrompt = buildCrmCreateSuccessPrompt({
        entityType: 'Customer',
        title: result.customerName,
        resultId: result.customerId,
        createdAt: result.createdAt,
      });
      const conversationContext =
        this.wecomAiConversationOrchestrationService.updateCrmCreateMemory(
          params.conversationContext,
          {
            entityType: 'Customer',
            status: 'COMPLETED',
            customerDraft: params.draft,
            resultId: result.customerId,
            resultSummary: successPrompt,
            failureReason: undefined,
          },
        );
      this.audit(
        params.user,
        'WECOM_CRM_CREATE_SUCCEEDED',
        '企业微信客户创建成功。',
        {
          sessionId: params.session.id,
          entityType: 'Customer',
          resultId: result.customerId,
        },
      );
      return await this.dispatchCrmCreatePrompt({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext,
        status: 'WECOM_CRM_CREATE_SUCCEEDED',
        prompt: successPrompt,
        crmCreate: {
          entityType: 'Customer',
          status: 'COMPLETED',
          title: result.customerName,
          resultId: result.customerId,
        },
      });
    } catch (error) {
      const failureReason =
        error instanceof Error ? error.message : '当前客户创建失败，请稍后重试。';
      const conversationContext =
        this.wecomAiConversationOrchestrationService.updateCrmCreateMemory(
          params.conversationContext,
          {
            entityType: 'Customer',
            status: 'FAILED',
            customerDraft: params.draft,
            failureReason,
          },
        );
      this.audit(
        params.user,
        'WECOM_CRM_CREATE_FAILED',
        '企业微信客户创建失败。',
        {
          sessionId: params.session.id,
          entityType: 'Customer',
          failureReason,
        },
      );
      return await this.dispatchCrmCreatePrompt({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext,
        status: 'WECOM_CRM_CREATE_FAILED',
        prompt: [
          `客户创建失败：${failureReason}`,
          buildCustomerCreateSummaryPrompt(params.draft, params.user),
          '回复“重试”可再次执行，或继续发送字段修正草稿。',
        ].join('\n'),
        crmCreate: {
          entityType: 'Customer',
          status: 'FAILED',
          title: params.draft.name ?? '客户',
          failureReason,
        },
      });
    }
  }

  private async executeOpportunityCreate(params: {
    user: CrmUser;
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
    draft: WecomOpportunityCreateDraft;
  }): Promise<WecomReceiveMessageResult> {
    this.audit(
      params.user,
      'WECOM_CRM_CREATE_CONFIRMED',
      '企业微信商机创建已确认执行。',
      this.withConversationAuditSnapshot(params.conversationContext, {
        sessionId: params.session.id,
        entityType: 'Opportunity',
        opportunityTitle: params.draft.title,
      }),
    );

    try {
      const result = await this.createOpportunityWithRetry(params.user, params.draft);
      const successPrompt = buildCrmCreateSuccessPrompt({
        entityType: 'Opportunity',
        title: result.title,
        resultId: result.opportunityId,
        createdAt: result.createdAt,
      });
      const conversationContext =
        this.wecomAiConversationOrchestrationService.updateCrmCreateMemory(
          params.conversationContext,
          {
            entityType: 'Opportunity',
            status: 'COMPLETED',
            opportunityDraft: params.draft,
            resultId: result.opportunityId,
            resultSummary: successPrompt,
            failureReason: undefined,
          },
        );
      this.audit(
        params.user,
        'WECOM_CRM_CREATE_SUCCEEDED',
        '企业微信商机创建成功。',
        {
          sessionId: params.session.id,
          entityType: 'Opportunity',
          resultId: result.opportunityId,
        },
      );
      return await this.dispatchCrmCreatePrompt({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext,
        status: 'WECOM_CRM_CREATE_SUCCEEDED',
        prompt: successPrompt,
        crmCreate: {
          entityType: 'Opportunity',
          status: 'COMPLETED',
          title: result.title,
          resultId: result.opportunityId,
        },
      });
    } catch (error) {
      const failureReason =
        error instanceof Error ? error.message : '当前商机创建失败，请稍后重试。';
      const conversationContext =
        this.wecomAiConversationOrchestrationService.updateCrmCreateMemory(
          params.conversationContext,
          {
            entityType: 'Opportunity',
            status: 'FAILED',
            opportunityDraft: params.draft,
            failureReason,
          },
        );
      this.audit(
        params.user,
        'WECOM_CRM_CREATE_FAILED',
        '企业微信商机创建失败。',
        {
          sessionId: params.session.id,
          entityType: 'Opportunity',
          failureReason,
        },
      );
      return await this.dispatchCrmCreatePrompt({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext,
        status: 'WECOM_CRM_CREATE_FAILED',
        prompt: [
          `商机创建失败：${failureReason}`,
          buildOpportunityCreateSummaryPrompt(params.draft, params.user),
          '回复“重试”可再次执行，或继续发送字段修正草稿。',
        ].join('\n'),
        crmCreate: {
          entityType: 'Opportunity',
          status: 'FAILED',
          title: params.draft.title ?? '商机',
          failureReason,
        },
      });
    }
  }

  private async createCustomerWithRetry(
    user: CrmUser,
    draft: WecomCustomerCreateDraft,
  ) {
    return await this.executeWecomCrmOperationWithTokenRetry({
      user,
      operationLabel: '受控新增客户',
      operationKey: draft.name ?? 'unknown-customer',
      executor: async (accessToken) =>
        await this.customerLookupService.createCustomer(
          user,
          {
            name: draft.name!,
            phone: draft.phone!,
            itDecisionLocation: draft.itDecisionLocation!,
            unifiedSocialCreditCode: draft.unifiedSocialCreditCode!,
            ownerUserId: draft.ownerUserId,
            wantDepartmentId: draft.wantDepartmentId,
            category: draft.category,
            source: draft.source,
            note: draft.note,
            parentCustomerId: draft.parentCustomerId,
            industry: draft.industry,
          },
          {
            accessToken,
          },
        ),
    });
  }

  private async createOpportunityWithRetry(
    user: CrmUser,
    draft: WecomOpportunityCreateDraft,
  ) {
    return await this.executeWecomCrmOperationWithTokenRetry({
      user,
      operationLabel: '受控新增商机',
      operationKey: draft.title ?? 'unknown-opportunity',
      executor: async (accessToken) =>
        await this.opportunityLookupService.createOpportunity(
          user,
          {
            title: draft.title!,
            customerId: draft.customerId!,
            customerName: draft.customerName,
            leadCode: draft.leadCode!,
            expectAmount: draft.expectAmount!,
            expectSignDate: draft.expectSignDate!,
            renewalContractCode: draft.renewalContractCode!,
            agentFullName: draft.agentFullName!,
            projectStatusSummary: draft.projectStatusSummary!,
            preSalesName: draft.preSalesName!,
            ownerUserId: draft.ownerUserId,
            wantDepartmentId: draft.wantDepartmentId,
            stage: draft.stage,
            source: draft.source,
            kind: draft.kind,
            note: draft.note,
            customerRequirement: draft.customerRequirement,
            getTime: draft.getTime,
            productAssets: (draft.productIds ?? []).map((productId) => ({
              productId,
            })),
            contactIds: draft.contactIds,
          },
          {
            accessToken,
          },
        ),
    });
  }

  private async resolveOpportunityDraftCustomer(params: {
    user: CrmUser;
    draft: WecomOpportunityCreateDraft;
  }): Promise<{
    draft: WecomOpportunityCreateDraft;
    prompt?: string;
  }> {
    if (params.draft.customerId || !params.draft.customerName) {
      return { draft: params.draft };
    }

    const accessToken = await this.resolveWecomCrmAccessToken(params.user);
    const lookupResult = await this.lookupCustomerByNameWithRetry({
      user: params.user,
      customerName: params.draft.customerName,
      accessToken,
    });

    if (lookupResult.totalCount === 1 && lookupResult.records.length === 1) {
      return {
        draft: {
          ...params.draft,
          customerId: lookupResult.records[0].id,
          customerName: lookupResult.records[0].name,
          customerCandidates: [],
        },
      };
    }

    if (lookupResult.totalCount > 1) {
      const customerCandidates = lookupResult.records.map((item) => ({
        id: item.id,
        name: item.name,
        ownerName: item.ownerName,
        category: item.category,
      }));
      return {
        draft: {
          ...params.draft,
          customerCandidates,
        },
        prompt: buildOpportunityCreateCollectPrompt(
          {
            ...params.draft,
            customerCandidates,
          },
          getMissingOpportunityFields({
            ...params.draft,
            customerCandidates,
          }),
          {
            customerCandidateLines: customerCandidates.map(
              (item, index) =>
                buildWecomCandidateDisplayLine({
                  index,
                  title: item.name,
                  details: [item.category, item.ownerName],
                }),
            ),
          },
        ),
      };
    }

    return {
      draft: {
        ...params.draft,
        customerId: undefined,
        customerCandidates: [],
      },
      prompt: `未按名称「${params.draft.customerName}」查到客户，请补充更准确的客户名称或直接提供“最终客户ID”。`,
    };
  }

  private async dispatchCrmCreatePrompt(params: {
    user: CrmUser;
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
    leadInPrompt?: string;
    status: string;
    prompt: string;
    crmCreate: WecomCrmCreatePayload;
  }): Promise<WecomReceiveMessageResult> {
    const finalPrompt = this.mergeLeadInPrompt(params.leadInPrompt, params.prompt);
    this.wecomAiConversationOrchestrationService.appendAssistantTurn(
      params.conversationContext,
      finalPrompt,
    );
    const dispatchResult = await this.wecomStreamDispatcherService.dispatch({
      receiptId: params.receipt.id,
      sessionId: params.session.id,
      target: this.buildDispatchTarget(params.inboundMessage, params.receipt.id),
      blocks: this.wecomStreamDispatcherService.buildDirectReplyBlocks(
        finalPrompt,
      ),
    });

    this.saveSessionState(
      params.session,
      params.crmCreate.status === 'COMPLETED' ? 'IDLE' : 'ACTIVE',
      {
        activeRequestId: undefined,
      },
    );

    return {
      receiptId: params.receipt.id,
      sessionId: params.session.id,
      status: params.status,
      acceptedAt: params.receipt.createdAt,
      deliveryStatus: dispatchResult.status,
      deliveredBlockCount: dispatchResult.deliveredCount,
      crmCreate: params.crmCreate,
    };
  }

  private async handleDailyReportFlow(params: {
    user: CrmUser;
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
    conversationDecision: { directReply?: string };
    leadInPrompt?: string;
    aiTaskReplyIntent?: WecomTaskReplyIntentLike | null;
  }): Promise<WecomReceiveMessageResult> {
    const messageText = params.inboundMessage.messageText?.trim() ?? '';
    const isThemeEntryOnlyMessage = this.isThemeEntryOnlyMessage(messageText);
    const currentState = params.conversationContext.workMemory.dailyReportFlowStatus ?? 'IDLE';
    const currentReportId = params.conversationContext.workMemory.dailyReportReportId;
    const hasPendingEntityLookup =
      params.conversationContext.workMemory.dailyReportEntityLookupStatus ===
      'AWAITING_CONFIRMATION';

    // 日报收集中如果用户再次明确输入主题入口，说明希望从新的口述轮次重新开始，
    // 不能继续沿用上一轮待确认的公司/项目或缺失项提示。
    if (
      isThemeEntryOnlyMessage &&
      (currentState !== 'IDLE' || hasPendingEntityLookup)
    ) {
      return await this.promptDailyReportThemeEntry({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext: params.conversationContext,
        resetExistingFlow: true,
      });
    }

    const hasActiveDailyReportMemory = Boolean(currentReportId) || currentState !== 'IDLE';
    const currentExpectedStep =
      currentState === 'AWAITING_CONFIRMATION'
        ? undefined
        : hasActiveDailyReportMemory
          ? params.conversationContext.workMemory.dailyReportNextFragmentType ??
            (currentReportId
              ? getWecomDailyReportNextStep(
                  this.dailyReportService.getReport(params.user, currentReportId).sectionTypes,
                ) ?? DAILY_REPORT_SECTION_ORDER[0]
              : DAILY_REPORT_SECTION_ORDER[0])
          : undefined;
    const intake = this.wecomDailyReportIntakeService.inspect(
      messageText,
      currentExpectedStep,
    );

    if (currentState === 'AWAITING_CONFIRMATION' && currentReportId) {
      if (this.isDailyReportConfirmReply(messageText)) {
        return await this.confirmDailyReportAndShare({
          user: params.user,
          session: params.session,
          receiptId: params.receipt.id,
          receiptCreatedAt: params.receipt.createdAt,
          inboundMessage: params.inboundMessage,
          conversationContext: params.conversationContext,
          reportId: currentReportId,
        });
      }

      if (this.matchesAnyKeyword(messageText, WECOM_DAILY_REPORT_REVISE_KEYWORDS)) {
        if (!intake.hasMeaningfulContent) {
          const report = this.dailyReportService.getReport(params.user, currentReportId);
          const revisePrompt = buildWecomDailyReportPrompt({
            stepType: getWecomDailyReportNextStep(report.sectionTypes) ?? DAILY_REPORT_SECTION_ORDER[0],
            latestQuestion: params.conversationContext.workMemory.latestQuestion,
            latestSummary: report.draftSummary,
          });

          this.wecomAiConversationOrchestrationService.appendAssistantTurn(
            params.conversationContext,
            revisePrompt,
          );

          const dispatchResult = await this.wecomStreamDispatcherService.dispatch({
            receiptId: params.receipt.id,
            sessionId: params.session.id,
            target: this.buildDispatchTarget(params.inboundMessage, params.receipt.id),
            blocks: this.wecomStreamDispatcherService.buildDirectReplyBlocks(revisePrompt),
          });

          this.saveSessionState(params.session, 'ACTIVE', {
            activeRequestId: params.receipt.id,
            lastReceiptId: params.receipt.id,
          });

          return {
            receiptId: params.receipt.id,
            sessionId: params.session.id,
            status: 'DAILY_REPORT_PROMPTED',
            acceptedAt: params.receipt.createdAt,
            deliveryStatus: dispatchResult.status,
            deliveredBlockCount: dispatchResult.deliveredCount,
          };
        }

        return await this.captureDailyReportInput({
          user: params.user,
          session: params.session,
          receipt: params.receipt,
          inboundMessage: params.inboundMessage,
          conversationContext: params.conversationContext,
          intake,
        });
      }

      if (intake.hasMeaningfulContent) {
        return await this.captureDailyReportInput({
          user: params.user,
          session: params.session,
          receipt: params.receipt,
          inboundMessage: params.inboundMessage,
          conversationContext: params.conversationContext,
          intake,
        });
      }

      const report = this.dailyReportService.getReport(params.user, currentReportId);
      const confirmationPrompt = this.buildDailyReportReviewPrompt(
        report,
        this.wecomDailyReportIntakeService.inspect(''),
        '请确认是否正确',
      );

      this.wecomAiConversationOrchestrationService.appendAssistantTurn(
        params.conversationContext,
        confirmationPrompt,
      );

      const dispatchResult = await this.wecomStreamDispatcherService.dispatch({
        receiptId: params.receipt.id,
        sessionId: params.session.id,
        target: this.buildDispatchTarget(params.inboundMessage, params.receipt.id),
        blocks: this.wecomStreamDispatcherService.buildDirectReplyBlocks(
          confirmationPrompt,
        ),
      });

      this.saveSessionState(params.session, 'ACTIVE', {
        activeRequestId: params.receipt.id,
        lastReceiptId: params.receipt.id,
      });

      return {
        receiptId: params.receipt.id,
        sessionId: params.session.id,
        status: 'DAILY_REPORT_AWAITING_CONFIRMATION',
        acceptedAt: params.receipt.createdAt,
        deliveryStatus: dispatchResult.status,
        deliveredBlockCount: dispatchResult.deliveredCount,
      };
    }

    if (hasPendingEntityLookup) {
      return await this.captureDailyReportInput({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext: params.conversationContext,
        intake,
        aiTaskReplyIntent: params.aiTaskReplyIntent,
      });
    }

    if (currentState === 'COLLECTING' || currentState === 'IDLE') {
      if (!intake.hasMeaningfulContent) {
        const startPrompt = buildWecomDailyReportThemeEntryPrompt({
          requesterName: params.user.name,
        });
        const finalPrompt = this.mergeLeadInPrompt(
          params.leadInPrompt,
          startPrompt,
        );

        this.wecomAiConversationOrchestrationService.appendAssistantTurn(
          params.conversationContext,
          finalPrompt,
        );

        const dispatchResult = await this.wecomStreamDispatcherService.dispatch({
          receiptId: params.receipt.id,
          sessionId: params.session.id,
          target: this.buildDispatchTarget(params.inboundMessage, params.receipt.id),
          blocks: this.wecomStreamDispatcherService.buildDirectReplyBlocks(finalPrompt),
        });

        this.saveSessionState(params.session, 'ACTIVE', {
          activeRequestId: params.receipt.id,
          lastReceiptId: params.receipt.id,
        });

        return {
          receiptId: params.receipt.id,
          sessionId: params.session.id,
          status: 'DAILY_REPORT_PROMPTED',
          acceptedAt: params.receipt.createdAt,
          deliveryStatus: dispatchResult.status,
          deliveredBlockCount: dispatchResult.deliveredCount,
        };
      }

      return await this.captureDailyReportInput({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext: params.conversationContext,
        intake,
        aiTaskReplyIntent: params.aiTaskReplyIntent,
      });
    }

    return await this.captureDailyReportInput({
      user: params.user,
      session: params.session,
      receipt: params.receipt,
      inboundMessage: params.inboundMessage,
      conversationContext: params.conversationContext,
      intake,
      aiTaskReplyIntent: params.aiTaskReplyIntent,
    });
  }

  private async handleDailyReportPreviewQuery(params: {
    user: CrmUser;
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
    leadInPrompt?: string;
  }): Promise<WecomReceiveMessageResult> {
    this.ensureWecomWorkflowAction(
      params.user,
      params.session.id,
      'wecom.daily_report.preview',
      '当前用户无权查看日报预览。',
      'daily-report-preview',
    );
    const businessDate = this.getCurrentBusinessDate();
    const report = await this.dailyReportService.getOrBuildUserDailyReportPreview(
      params.user,
      businessDate,
      params.receipt.createdAt,
    );
    const prompt = report
      ? [
          `这是你 ${businessDate} 的日报预览：`,
          '',
          report.draftSummary,
        ].join('\n')
      : [
          `这是你 ${businessDate} 的日报预览：`,
          '今天还没有可汇总的日报内容。',
          '如果你刚补充了跟进，可以继续写跟进；稍后再让我查看今日日报。',
        ].join('\n');
    const finalPrompt = this.mergeLeadInPrompt(params.leadInPrompt, prompt);

    this.wecomAiConversationOrchestrationService.appendAssistantTurn(
      params.conversationContext,
      finalPrompt,
    );

    const dispatchResult = await this.wecomStreamDispatcherService.dispatch({
      receiptId: params.receipt.id,
      sessionId: params.session.id,
      target: this.buildDispatchTarget(params.inboundMessage, params.receipt.id),
      blocks: this.wecomStreamDispatcherService.buildDirectReplyBlocks(finalPrompt),
    });

    this.saveSessionState(params.session, 'IDLE', {
      activeRequestId: undefined,
      lastReceiptId: params.receipt.id,
    });

    return {
      receiptId: params.receipt.id,
      sessionId: params.session.id,
      status: 'DAILY_REPORT_PREVIEW_RETURNED',
      acceptedAt: params.receipt.createdAt,
      deliveryStatus: dispatchResult.status,
      deliveredBlockCount: dispatchResult.deliveredCount,
    };
  }

  /**
   * 在企业微信当前会话里返回指定负责人小组的今日日报预览。
   * 参数：当前用户、会话与负责人查询词；返回统一的日报预览回执，不创建正式汇总批次。
   */
  private async handleTeamDailyReportPreviewQuery(params: {
    user: CrmUser;
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
    leaderNameQuery: string;
    leadInPrompt?: string;
  }): Promise<WecomReceiveMessageResult> {
    this.ensureWecomWorkflowAction(
      params.user,
      params.session.id,
      'wecom.daily_report.preview',
      '当前用户无权查看团队日报预览。',
      'team-daily-report-preview',
    );
    const previewResult = await this.dailyReportService.getTeamDailyReportPreview(
      params.user,
      params.leaderNameQuery,
      this.getCurrentBusinessDate(),
      params.receipt.createdAt,
    );
    const finalPrompt = this.mergeLeadInPrompt(
      params.leadInPrompt,
      this.buildTeamDailyReportPreviewPrompt(previewResult),
    );

    this.wecomAiConversationOrchestrationService.appendAssistantTurn(
      params.conversationContext,
      finalPrompt,
    );

    const dispatchResult = await this.wecomStreamDispatcherService.dispatch({
      receiptId: params.receipt.id,
      sessionId: params.session.id,
      target: this.buildDispatchTarget(params.inboundMessage, params.receipt.id),
      blocks: this.wecomStreamDispatcherService.buildDirectReplyBlocks(finalPrompt),
    });

    this.saveSessionState(params.session, 'IDLE', {
      activeRequestId: undefined,
      lastReceiptId: params.receipt.id,
    });

    return {
      receiptId: params.receipt.id,
      sessionId: params.session.id,
      status: 'DAILY_REPORT_PREVIEW_RETURNED',
      acceptedAt: params.receipt.createdAt,
      deliveryStatus: dispatchResult.status,
      deliveredBlockCount: dispatchResult.deliveredCount,
    };
  }

  private buildTeamDailyReportPreviewPrompt(params: {
    status: 'READY' | 'LEADER_NOT_FOUND' | 'LEADER_AMBIGUOUS' | 'FORBIDDEN';
    businessDate: string;
    leaderNameQuery: string;
    leaderName?: string;
    summaryText?: string;
    hasAnySourceData?: boolean;
    candidateLeaderNames?: string[];
  }): string {
    switch (params.status) {
      case 'LEADER_NOT_FOUND':
        return [
          `我暂时没识别到“${params.leaderNameQuery}”对应的销售负责人小组。`,
          '请补充更完整的负责人姓名后再试，例如“请把王文定小组今天的日报发给我”。',
        ].join('\n');
      case 'LEADER_AMBIGUOUS':
        return [
          `我识别到多个可能的负责人：${(params.candidateLeaderNames ?? []).join('、')}。`,
          '请补充更完整的负责人姓名后再试，我再把对应小组今天的日报发给你。',
        ].join('\n');
      case 'FORBIDDEN':
        return [
          `暂时不能查看${params.leaderName ?? params.leaderNameQuery}小组今天的日报。`,
          '当前只支持查看你自己负责的小组，或你直属下级负责人负责的小组。',
        ].join('\n');
      case 'READY':
      default: {
        const leaderName = params.leaderName ?? params.leaderNameQuery;
        if (!params.hasAnySourceData) {
          return [
            `这是${leaderName}小组 ${params.businessDate} 的日报预览：`,
            '当前小组今天还没有可汇总的日报内容，下面先给你看组内当前状态：',
            '',
            params.summaryText ?? '当前组内暂无可展示的日报明细。',
          ].join('\n');
        }

        return [
          `这是${leaderName}小组 ${params.businessDate} 的日报预览：`,
          '',
          params.summaryText ?? '当前组内暂无可展示的日报明细。',
        ].join('\n');
      }
    }
  }

  private async confirmDailyReportAndShare(params: {
    user: CrmUser;
    session: QuerySessionRecord;
    receiptId: string;
    receiptCreatedAt: string;
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
    reportId: string;
  }): Promise<WecomReceiveMessageResult> {
    const confirmedReport = await this.dailyReportService.confirmReport(
      params.user,
      params.reportId,
      new Date().toISOString(),
    );

    const sharePrompt = buildWecomDailyReportSharePrompt({
      reportTitle: confirmedReport.draftTitle,
      draftSummary: confirmedReport.draftSummary,
      sectionTypes: confirmedReport.sectionTypes,
      requesterName: params.user.name,
    });
    const shareReply = await this.aiGatewayService.generateWecomExplanationReply(
      sharePrompt,
    );

    const finalReply = [`日报已确认：${confirmedReport.draftTitle}`, shareReply].join('\n');

    this.wecomAiConversationOrchestrationService.appendAssistantTurn(
      params.conversationContext,
      finalReply,
      params.reportId,
    );
    this.wecomAiConversationOrchestrationService.clearDailyReportMemory(
      params.conversationContext,
    );

    const dispatchResult = await this.wecomStreamDispatcherService.dispatch({
      receiptId: params.receiptId,
      sessionId: params.session.id,
      target: this.buildDispatchTarget(params.inboundMessage, params.receiptId),
      blocks: this.wecomStreamDispatcherService.buildDirectReplyBlocks(finalReply),
    });

    this.saveSessionState(params.session, 'IDLE', {
      activeRequestId: undefined,
    });

    return {
      receiptId: params.receiptId,
      sessionId: params.session.id,
      status: 'DAILY_REPORT_CONFIRMED',
      acceptedAt: params.receiptCreatedAt,
      deliveryStatus: dispatchResult.status,
      deliveredBlockCount: dispatchResult.deliveredCount,
    };
  }

  private async captureDailyReportInput(params: {
    user: CrmUser;
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
    intake: WecomDailyReportIntakeResult;
    aiTaskReplyIntent?: WecomTaskReplyIntentLike | null;
  }): Promise<WecomReceiveMessageResult> {
    const currentState = params.conversationContext.workMemory.dailyReportFlowStatus ?? 'IDLE';
    const isThemeEntryOnlyMessage = this.isThemeEntryOnlyMessage(
      params.inboundMessage.messageText ?? '',
    );
    const normalizedFollowUpText = this.normalizeDailyReportFollowUpText(
      params.inboundMessage.messageText ?? '',
    );

    if (
      params.conversationContext.workMemory.dailyReportEntityLookupStatus ===
      'AWAITING_CONFIRMATION'
    ) {
      return await this.handleDailyReportEntityLookupReply({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext: params.conversationContext,
        intake: params.intake,
        followUpText: normalizedFollowUpText,
      });
    }

    if (currentState === 'IDLE' && isThemeEntryOnlyMessage) {
      return await this.promptDailyReportThemeEntry({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext: params.conversationContext,
        resetExistingFlow: false,
      });
    }

    if (this.hasActiveFollowUpTemplateDraft(params.conversationContext)) {
      return await this.handleFollowUpTemplateInput({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext: params.conversationContext,
        aiTaskReplyIntent: params.aiTaskReplyIntent,
      });
    }

    if (normalizedFollowUpText) {
      return await this.handleDailyReportFollowUpLookup({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext: params.conversationContext,
        intake: params.intake,
        followUpText: normalizedFollowUpText,
      });
    }

    const fallbackPrompt = buildWecomDailyReportThemeEntryPrompt({
      requesterName: params.user.name,
    });

    const activeContext = this.wecomAiConversationOrchestrationService.updateDailyReportMemory(
      params.conversationContext,
      {
        flowStatus: 'COLLECTING',
        nextFragmentType: DAILY_REPORT_SECTION_ORDER[0],
        supervisorId: params.user.id,
        supervisorName: params.user.name,
      },
    );

    this.wecomAiConversationOrchestrationService.appendAssistantTurn(
      activeContext,
      fallbackPrompt,
    );

    const dispatchResult = await this.wecomStreamDispatcherService.dispatch({
      receiptId: params.receipt.id,
      sessionId: params.session.id,
      target: this.buildDispatchTarget(params.inboundMessage, params.receipt.id),
      blocks: this.wecomStreamDispatcherService.buildDirectReplyBlocks(fallbackPrompt),
    });

    this.saveSessionState(params.session, 'ACTIVE', {
      activeRequestId: params.receipt.id,
      lastReceiptId: params.receipt.id,
    });

    return {
      receiptId: params.receipt.id,
      sessionId: params.session.id,
      status: 'DAILY_REPORT_PROMPTED',
      acceptedAt: params.receipt.createdAt,
      deliveryStatus: dispatchResult.status,
      deliveredBlockCount: dispatchResult.deliveredCount,
    };
  }

  private hasActiveFollowUpTemplateDraft(
    context: WecomConversationContextRecord,
  ): boolean {
    return Boolean(context.workMemory.followUpTemplateDraft);
  }

  private async handleFollowUpTemplateInput(params: {
    user: CrmUser;
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
    aiTaskReplyIntent?: WecomTaskReplyIntentLike | null;
  }): Promise<WecomReceiveMessageResult> {
    const messageText = params.inboundMessage.messageText?.trim() ?? '';
    const aiTemplateReplyIntent =
      params.aiTaskReplyIntent !== undefined
        ? params.aiTaskReplyIntent
        : messageText
          ? await this.aiGatewayService.classifyWecomTaskReplyIntent({
              messageText,
              activeTaskLabel: '当前跟进整理',
            })
          : null;
    const currentDraft =
      params.conversationContext.workMemory.followUpTemplateDraft ??
      createWecomFollowUpTemplateDraft(params.user.name);
    const currentHasExplicitEntityName = this.hasExplicitFollowUpTemplateEntityName(
      currentDraft.followUpContent,
    );
    const parsedUpdates = parseWecomFollowUpTemplateUpdates(messageText);
    const shouldPreferFreeformDraft =
      Object.keys(parsedUpdates).length === 0 &&
      this.isFreeformFollowUpTemplateContent(messageText) &&
      this.isLikelyFreeformFollowUpNarrative(messageText);
    const isDirectSubmit =
      isWecomFollowUpTemplateDirectSubmitIntent(messageText) ||
      ((!shouldPreferFreeformDraft &&
        aiTemplateReplyIntent?.intent === 'DIRECT_SUBMIT') ||
        (!shouldPreferFreeformDraft &&
          aiTemplateReplyIntent?.intent === 'CONTINUE_EXECUTION')) ||
      Boolean(
        currentDraft.optionalMissingPromptShown &&
          isWecomAffirmativeReply(messageText),
      );
    const aiStructuredDraft =
      Object.keys(parsedUpdates).length === 0 &&
      !isDirectSubmit &&
      this.isFreeformFollowUpTemplateContent(messageText)
        ? await this.aiGatewayService.parseWecomFollowUpStructuredDraft({
            requesterName: params.user.name,
            messageText,
          })
        : null;
    const ruleStructuredDraft =
      Object.keys(parsedUpdates).length === 0 &&
      !isDirectSubmit &&
      this.isFreeformFollowUpTemplateContent(messageText)
        ? parseWecomFollowUpTemplateFreeformDraft({
            requesterName: params.user.name,
            messageText,
          })
        : undefined;
    const freeformDraft =
      Object.keys(parsedUpdates).length === 0 &&
      !isDirectSubmit &&
      this.isFreeformFollowUpTemplateContent(messageText)
        ? mergeWecomFollowUpTemplateDrafts({
            requesterName: params.user.name,
            aiDraft: aiStructuredDraft,
            ruleDraft: ruleStructuredDraft,
          })
        : undefined;

    if (this.isFreeformFollowUpTemplateContent(messageText)) {
      this.analysisLoggerService.logStep('企业微信跟进自由文本四段草稿已整理。', {
        requesterId: params.user.id,
        requesterName: params.user.name,
        sessionId: params.session.id,
        sourceMessageId: params.inboundMessage.channelMessageId,
        aiReplyIntent: aiTemplateReplyIntent?.intent,
        shouldPreferFreeformDraft,
        isDirectSubmit,
        aiDraftAvailable: Boolean(aiStructuredDraft),
        aiDraftSnapshot: aiStructuredDraft
          ? {
              followUpContent: aiStructuredDraft.followUpContent,
              helpNeeded: aiStructuredDraft.helpNeeded,
              informationShare: aiStructuredDraft.informationShare,
              visitPlan: aiStructuredDraft.visitPlan,
            }
          : undefined,
        ruleDraftSnapshot: ruleStructuredDraft
          ? {
              followUpContent: ruleStructuredDraft.followUpContent,
              helpNeeded: ruleStructuredDraft.helpNeeded,
              informationShare: ruleStructuredDraft.informationShare,
              visitPlan: ruleStructuredDraft.visitPlan,
            }
          : undefined,
        mergedDraftSnapshot: freeformDraft
          ? {
              followUpContent: freeformDraft.followUpContent,
              helpNeeded: freeformDraft.helpNeeded,
              informationShare: freeformDraft.informationShare,
              visitPlan: freeformDraft.visitPlan,
              missingLabels: freeformDraft.missingLabels,
            }
          : undefined,
      });
    }
    const nextDraft: WecomFollowUpTemplateDraft = {
      ...currentDraft,
      ...freeformDraft,
      ...parsedUpdates,
      directSubmitSource: isDirectSubmit
        ? 'NATURAL_LANGUAGE'
        : freeformDraft?.directSubmitSource ?? currentDraft.directSubmitSource,
    };
    const hasParsedUpdates = Object.keys(parsedUpdates).length > 0;

    if (!freeformDraft && !hasParsedUpdates && !nextDraft.followUpContent && this.isFreeformFollowUpTemplateContent(messageText)) {
      nextDraft.followUpContent = messageText;
    }

    const missingLabels = getMissingWecomFollowUpTemplateLabels(nextDraft);
    const optionalMissingLabels =
      getOptionalMissingWecomFollowUpTemplateLabels(nextDraft);
    const structuredDraftEnabled =
      process.env.WECOM_AI_STRUCTURED_DRAFT_ENABLED !== 'false';
    const nextContext =
      this.wecomAiConversationOrchestrationService.updateFollowUpTemplateMemory(
        params.conversationContext,
        {
          ...nextDraft,
          missingLabels,
        },
      );
    this.audit(
      params.user,
      'WECOM_AI_DRAFT_STRUCTURED',
      '企业微信自由文本跟进草稿已结构化。',
      this.withConversationAuditSnapshot(nextContext, {
        sessionId: params.session.id,
        source: aiStructuredDraft
          ? 'ai-structured-draft'
          : freeformDraft
            ? 'rule-fallback-structured-draft'
            : 'labeled-template-draft',
        fallbackReason:
          !aiStructuredDraft && freeformDraft
            ? 'ai-unavailable-or-invalid'
            : undefined,
        structuredDraftSnapshot: {
          requesterName: nextDraft.requesterName,
          followUpContent: nextDraft.followUpContent,
          helpNeeded: nextDraft.helpNeeded,
          informationShare: nextDraft.informationShare,
          visitPlan: nextDraft.visitPlan,
          missingLabels,
          optionalMissingPromptShown: nextDraft.optionalMissingPromptShown,
          directSubmitSource: nextDraft.directSubmitSource,
        },
      }),
    );

    const entityClarificationText =
      !isDirectSubmit &&
      !hasParsedUpdates &&
      currentDraft.followUpContent &&
      !currentHasExplicitEntityName &&
      this.isLikelyFollowUpEntityClarificationReply(messageText)
        ? messageText
        : undefined;

    if (
      !structuredDraftEnabled &&
      missingLabels.length > 0
    ) {
      return await this.dispatchDailyReportTemplatePrompt({
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext: nextContext,
        prompt: buildWecomFollowUpTemplateCollectPrompt({
          filledLines: buildWecomFollowUpTemplateFilledLines(nextDraft),
          missingLabels,
          needsExplicitEntityName: false,
        }),
      });
    }

    if (!hasRequiredWecomFollowUpTemplateContent(nextDraft)) {
      return await this.dispatchDailyReportTemplatePrompt({
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext: nextContext,
        prompt: buildWecomFollowUpTemplateCollectPrompt({
          filledLines: buildWecomFollowUpTemplateFilledLines(nextDraft),
          missingLabels: ['跟进内容'],
          needsExplicitEntityName: false,
        }),
      });
    }

    if (
      optionalMissingLabels.length > 0 &&
      structuredDraftEnabled &&
      !isDirectSubmit &&
      !nextDraft.optionalMissingPromptShown
    ) {
      const promptContext =
        this.wecomAiConversationOrchestrationService.updateFollowUpTemplateMemory(
          nextContext,
          {
            ...nextDraft,
            missingLabels: optionalMissingLabels,
            optionalMissingPromptShown: true,
          },
        );

      return await this.dispatchDailyReportTemplatePrompt({
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext: promptContext,
        prompt: buildWecomFollowUpTemplateOptionalMissingPrompt({
          filledLines: buildWecomFollowUpTemplateFilledLines(nextDraft),
          missingLabels: optionalMissingLabels,
        }),
      });
    }

    const structuredDraftContent = this.buildFollowUpTemplateDraftContent(
      params.user,
      nextDraft,
    );
    const entityLookupSourceText =
      entityClarificationText ?? nextDraft.followUpContent ?? structuredDraftContent;

    return await this.resolveFollowUpTemplateEntity({
      user: params.user,
      session: params.session,
      receipt: params.receipt,
      inboundMessage: params.inboundMessage,
      conversationContext: nextContext,
      followUpText: structuredDraftContent,
      queryText: entityLookupSourceText,
      draft: nextDraft,
    });
  }

  private async dispatchDailyReportTemplatePrompt(params: {
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
    prompt: string;
  }): Promise<WecomReceiveMessageResult> {
    this.wecomAiConversationOrchestrationService.appendAssistantTurn(
      params.conversationContext,
      params.prompt,
    );

    const dispatchResult = await this.wecomStreamDispatcherService.dispatch({
      receiptId: params.receipt.id,
      sessionId: params.session.id,
      target: this.buildDispatchTarget(params.inboundMessage, params.receipt.id),
      blocks: this.wecomStreamDispatcherService.buildDirectReplyBlocks(params.prompt),
    });

    this.saveSessionState(params.session, 'ACTIVE', {
      activeRequestId: params.receipt.id,
      lastReceiptId: params.receipt.id,
    });

    return {
      receiptId: params.receipt.id,
      sessionId: params.session.id,
      status: 'DAILY_REPORT_PROMPTED',
      acceptedAt: params.receipt.createdAt,
      deliveryStatus: dispatchResult.status,
      deliveredBlockCount: dispatchResult.deliveredCount,
    };
  }

  private buildFollowUpTemplateDraftContent(
    user: CrmUser,
    draft: WecomFollowUpTemplateDraft,
  ): string {
    return buildWecomFollowUpTemplateFinalContent(user.name, draft);
  }

  private buildStructuredFollowUpFields(
    draft?: WecomFollowUpTemplateDraft,
  ): Pick<
    PendingFollowUpWritebackRecord,
    | 'structuredFollowUpContent'
    | 'structuredHelpNeeded'
    | 'structuredInformationShare'
    | 'structuredVisitPlan'
  > {
    return {
      structuredFollowUpContent: draft?.followUpContent,
      structuredHelpNeeded: draft?.helpNeeded,
      structuredInformationShare: draft?.informationShare,
      structuredVisitPlan: draft?.visitPlan,
    };
  }

  /**
   * 候选序号一旦已在当次召回集合里被用户明确选中，就必须直接绑定该候选对应的草稿；
   * 否则像“总行/分行”这类同名前缀客户会再次走模糊查询，导致会话反复停在候选列表。
   */
  private async dispatchFollowUpTemplateWritebackConfirmation(params: {
    user: CrmUser;
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
    draft: WecomFollowUpTemplateDraft;
    sourceQueryText: string;
    resolvedDraft: FollowUpDraft;
  }): Promise<WecomReceiveMessageResult> {
    this.ensureWecomWorkflowAction(
      params.user,
      params.session.id,
      'wecom.followup.writeback',
      '当前用户无权执行企业微信跟进写回。',
      'follow-up-writeback-draft',
    );
    this.analysisLoggerService.logStep('企业微信跟进模板实体已唯一命中，准备生成待写回草稿。', {
      requesterId: params.user.id,
      requesterName: params.user.name,
      sessionId: params.session.id,
      sourceMessageId: params.inboundMessage.channelMessageId,
      queryText: params.sourceQueryText,
      structuredDraftSnapshot: {
        followUpContent: params.draft.followUpContent,
        helpNeeded: params.draft.helpNeeded,
        informationShare: params.draft.informationShare,
        visitPlan: params.draft.visitPlan,
      },
      resolvedObject: {
        objectType: params.resolvedDraft.objectType,
        objectId: params.resolvedDraft.objectId,
        objectTitle: params.resolvedDraft.objectTitle,
        customerName: params.resolvedDraft.customerName,
      },
      resolvedDraftContent: params.resolvedDraft.draftContent,
    });

    const accessToken = await this.resolveWecomCrmAccessToken(params.user);
    const authorizationResult = await this.ensureFollowUpObjectAuthorization({
      user: params.user,
      sessionId: params.session.id,
      conversationContext: params.conversationContext,
      resourceType: 'daily-report-follow-up-writeback-draft-scope',
      accessToken,
      target: {
        objectType: params.resolvedDraft.objectType,
        objectId: params.resolvedDraft.objectId,
        objectTitle: params.resolvedDraft.objectTitle,
        ownerId: params.resolvedDraft.ownerId,
        ownerName: params.resolvedDraft.ownerName,
      },
    });

    const pendingWriteback = this.followUpWritebackRepository.save({
      id: buildEntityId('follow_up_writeback'),
      sessionId: params.session.id,
      requesterId: params.user.id,
      requesterName: params.user.name,
      sourceReceiptId: params.receipt.id,
      sourceMessageId: params.inboundMessage.channelMessageId,
      sourceQueryText: params.sourceQueryText,
      objectType: params.resolvedDraft.objectType,
      objectId: params.resolvedDraft.objectId,
      objectTitle: params.resolvedDraft.objectTitle,
      opportunityId: params.resolvedDraft.objectId,
      opportunityTitle: params.resolvedDraft.objectTitle,
      customerName: params.resolvedDraft.customerName,
      ...this.buildStructuredFollowUpFields(params.draft),
      ownerId: params.resolvedDraft.ownerId,
      ownerName: params.resolvedDraft.ownerName,
      assistUserIds: authorizationResult.assistUserCrmUserIds,
      assistUserNames: authorizationResult.assistUserNames,
      assistUsersResolved: true,
      draftContent: params.resolvedDraft.draftContent,
      status: 'DRAFTED',
      idempotencyKey: `${params.session.id}:${params.resolvedDraft.objectType}:${params.resolvedDraft.objectId}:${params.receipt.id}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    this.audit(
      params.user,
      'FOLLOW_UP_WRITEBACK_DRAFTED',
      `已根据跟进模板为${this.buildFollowUpTargetDisplay(pendingWriteback)}生成待写回草稿。`,
      this.withConversationAuditSnapshot(params.conversationContext, {
        sessionId: params.session.id,
        followUpWritebackId: pendingWriteback.id,
        objectType: pendingWriteback.objectType,
        objectId: pendingWriteback.objectId,
        source: 'follow-up-template',
      }),
    );
    const activeContext =
      this.wecomAiConversationOrchestrationService.clearDailyReportMemory(
        this.wecomAiConversationOrchestrationService.updateFollowUpWritebackMemory(
          params.conversationContext,
          {
            activeId: pendingWriteback.id,
            status: pendingWriteback.status,
            objectType: pendingWriteback.objectType,
            objectId: pendingWriteback.objectId,
            objectTitle: pendingWriteback.objectTitle,
            opportunityId: pendingWriteback.opportunityId,
            opportunityTitle: pendingWriteback.opportunityTitle,
            draftContent: pendingWriteback.draftContent,
            failureReason: undefined,
          },
        ),
      );

    this.analysisLoggerService.logStep('企业微信跟进模板待写回确认文案即将发送。', {
      requesterId: params.user.id,
      requesterName: params.user.name,
      sessionId: params.session.id,
      followUpWritebackId: pendingWriteback.id,
      draftContent: pendingWriteback.draftContent,
      structuredFollowUpContent: pendingWriteback.structuredFollowUpContent,
      structuredHelpNeeded: pendingWriteback.structuredHelpNeeded,
      structuredInformationShare: pendingWriteback.structuredInformationShare,
      structuredVisitPlan: pendingWriteback.structuredVisitPlan,
    });

    return await this.dispatchFollowUpWritebackPrompt({
      user: params.user,
      session: params.session,
      receipt: params.receipt,
      inboundMessage: params.inboundMessage,
      conversationContext: activeContext,
      prompt: buildWecomFollowUpWritebackIntentPrompt({
        objectType: this.getFollowUpRecordObjectType(pendingWriteback),
        opportunityTitle: pendingWriteback.opportunityTitle,
        customerName: pendingWriteback.customerName,
        draftContent: pendingWriteback.draftContent,
      }),
      status: 'FOLLOW_UP_WRITEBACK_PENDING_CONFIRMATION',
    });
  }

  private isLikelyFollowUpEntityClarificationReply(messageText: string): boolean {
    const trimmedText = messageText.trim();
    if (!trimmedText || trimmedText.length > 40) {
      return false;
    }

    if (/[\n]/u.test(trimmedText) || /[:：]/u.test(trimmedText)) {
      return false;
    }

    return true;
  }

  private getFollowUpTemplateSearchPreference(
    context: WecomConversationContextRecord,
  ): 'project' | 'customer' | 'auto' {
    const firstUserTurn = context.turns.find((item) => item.role === 'user')?.content ?? '';
    if (firstUserTurn.includes('跟进商机')) {
      return 'project';
    }

    if (firstUserTurn.includes('跟进客户')) {
      return 'customer';
    }

    return 'auto';
  }

  private extractFollowUpTemplateFuzzyQueryText(queryText: string): string | undefined {
    let normalizedText = queryText.replace(/^.*?(?:跟进内容[:：])?/u, '').trim();

    while (normalizedText) {
      const nextValue = normalizedText
        .replace(
          /^(?:今天|今早|上午|下午|晚上|昨日|继续|再次|先|刚刚|刚才|本次)\s*/u,
          '',
        )
        .replace(
          /^(?:跟进了|跟进|拜访了|拜访|走访了|走访|推进了|推进|沟通了|沟通|联系了|联系|对接了|对接)\s*/u,
          '',
        )
        .trim();

      if (nextValue === normalizedText) {
        break;
      }

      normalizedText = nextValue;
    }

    normalizedText = normalizedText
      .split(/[，,。！？；;\n]/u)[0]
      ?.replace(/(?:这个客户|这个项目|该客户|该项目)$/u, '')
      ?.trim();

    if (!normalizedText || normalizedText.length < 2 || normalizedText.length > 40) {
      return undefined;
    }

    if (
      /^(?:客户|项目|商机|方案|报价|合同|测试|POC|SaaS|续签|扩容|升级|客户方案|项目方案|客户项目|这个客户|该客户|这个项目|该项目)$/u.test(
        normalizedText,
      )
    ) {
      return undefined;
    }

    return normalizedText;
  }

  private filterFollowUpTemplateLookupResultsByPreference(
    lookupResults: DailyReportEntityLookupResult[],
    preference: 'project' | 'customer' | 'auto',
  ): DailyReportEntityLookupResult[] {
    if (preference === 'auto') {
      return lookupResults;
    }

    const preferredLabel = preference === 'project' ? '商机' : '客户';
    const preferredResults = lookupResults.filter(
      (item) =>
        item.objectLabel === preferredLabel &&
        (Boolean(item.draft) || item.candidateNames.length > 0),
    );

    return preferredResults.length > 0 ? preferredResults : lookupResults;
  }

  private async resolveFollowUpTemplateEntity(params: {
    user: CrmUser;
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
    followUpText: string;
    queryText: string;
    draft: WecomFollowUpTemplateDraft;
  }): Promise<WecomReceiveMessageResult> {
    const intake = this.wecomDailyReportIntakeService.inspect(
      params.queryText,
      'TODAY_FOLLOW_UP',
    );
    const { companyNames, projectNames } = this.extractFollowUpEntityCandidates(intake);
    let refinedEntityNames = this.refineDailyReportEntityCandidates(
      params.queryText,
      companyNames,
      projectNames,
    );
    const searchPreference = this.getFollowUpTemplateSearchPreference(
      params.conversationContext,
    );
    const fuzzyQueryText = this.extractFollowUpTemplateFuzzyQueryText(
      params.queryText,
    );

    if (
      refinedEntityNames.companyNames.length === 0 &&
      refinedEntityNames.projectNames.length === 0 &&
      fuzzyQueryText
    ) {
      refinedEntityNames = {
        companyNames:
          searchPreference === 'project' ? [] : [fuzzyQueryText],
        projectNames:
          searchPreference === 'customer' ? [] : [fuzzyQueryText],
      };
    } else if (fuzzyQueryText) {
      if (
        searchPreference === 'project' &&
        refinedEntityNames.projectNames.length === 0
      ) {
        refinedEntityNames = {
          ...refinedEntityNames,
          projectNames: [fuzzyQueryText],
        };
      }

      if (
        searchPreference === 'customer' &&
        refinedEntityNames.companyNames.length === 0
      ) {
        refinedEntityNames = {
          ...refinedEntityNames,
          companyNames: [fuzzyQueryText],
        };
      }
    }

    if (
      refinedEntityNames.companyNames.length === 0 &&
      refinedEntityNames.projectNames.length === 0
    ) {
      return await this.dispatchDailyReportTemplatePrompt({
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext: params.conversationContext,
        prompt: buildWecomFollowUpTemplateCollectPrompt({
          filledLines: buildWecomFollowUpTemplateFilledLines(params.draft),
          missingLabels: [],
          needsExplicitEntityName: true,
        }),
      });
    }

    const lookupContext = this.wecomAiConversationOrchestrationService.updateDailyReportMemory(
      params.conversationContext,
      {
        flowStatus: 'COLLECTING',
        nextFragmentType: DAILY_REPORT_SECTION_ORDER[0],
        supervisorId: params.user.id,
        supervisorName: params.user.name,
        entityLookupStatus: 'AWAITING_CONFIRMATION',
        entityLookupText: params.followUpText,
        entityLookupQueryText: params.queryText,
        entityLookupCompanyNames: refinedEntityNames.companyNames,
        entityLookupProjectNames: refinedEntityNames.projectNames,
        entityLookupMatchedCompanyNames: [],
        entityLookupSummary: undefined,
        entityLookupStep: 'SELECT_TARGET',
      },
    );
    const accessToken = await this.resolveWecomCrmAccessToken(params.user);
    const lookupResults = this.filterFollowUpTemplateLookupResultsByPreference(
      await this.queryDailyReportEntitiesSeparately({
        user: params.user,
        conversationContext: params.conversationContext,
        companyNames: refinedEntityNames.companyNames,
        projectNames: refinedEntityNames.projectNames,
        followUpText: params.followUpText,
        accessToken,
      }),
      searchPreference,
    );
    const resolvedDrafts = lookupResults.filter((item) => item.draft);
    const unresolvedResults = lookupResults.filter((item) => !item.draft);

    if (resolvedDrafts.length === 1 && unresolvedResults.length === 0) {
      return await this.dispatchFollowUpTemplateWritebackConfirmation({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext: lookupContext,
        draft: params.draft,
        sourceQueryText: params.queryText,
        resolvedDraft: resolvedDrafts[0].draft!,
      });
    }

    const prompt = this.buildDailyReportEntityQueryResultPrompt({
      lookupResults,
      candidateActionHint:
        '请直接回复候选序号或更准确的名称（例如：候选2、2、一、第一、第1个），我会继续帮你整理成 CRM 跟进。',
      noCandidateActionHint:
        '当前还没定位到可直接写入的项目或客户，请补充更准确的完整名称，我再继续帮你整理成 CRM 跟进。',
    });
    await this.dispatchDailyReportEntityLookupPrompt({
      user: params.user,
      session: params.session,
      receipt: params.receipt,
      inboundMessage: params.inboundMessage,
      conversationContext: lookupContext,
      prompt,
    });

    return {
      receiptId: params.receipt.id,
      sessionId: params.session.id,
      status: 'DAILY_REPORT_PROMPTED',
      acceptedAt: params.receipt.createdAt,
      deliveryStatus: 'SENT',
      deliveredBlockCount: 1,
    };
  }

  private hasExplicitFollowUpTemplateEntityName(followUpContent?: string): boolean {
    if (!followUpContent?.trim()) {
      return false;
    }

    const entityCandidates = this.extractFollowUpEntityCandidates(
      this.wecomDailyReportIntakeService.inspect(followUpContent, 'TODAY_FOLLOW_UP'),
    );

    return (
      entityCandidates.companyNames.length > 0 ||
      entityCandidates.projectNames.length > 0
    );
  }

  private isFreeformFollowUpTemplateContent(messageText: string): boolean {
    const trimmedText = messageText.trim();
    if (!trimmedText) {
      return false;
    }

    if (
      /^姓名[:：]/u.test(trimmedText) ||
      /^跟进内容[:：]/u.test(trimmedText) ||
      /^(?:遇到与协助|问题与协助)[:：]/u.test(trimmedText) ||
      /^(?:信息共享|信息分享)[:：]/u.test(trimmedText) ||
      /^拜访计划[:：]/u.test(trimmedText)
    ) {
      return false;
    }

    return !['无', '暂无', '无需协助', '无需共享'].includes(trimmedText);
  }

  private async promptDailyReportThemeEntry(params: {
    user: CrmUser;
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
    resetExistingFlow: boolean;
    leadInPrompt?: string;
  }): Promise<WecomReceiveMessageResult> {
    const fallbackPrompt = buildWecomFollowUpTemplateEntryPrompt({
      requesterName: params.user.name,
    });
    const finalPrompt = this.mergeLeadInPrompt(
      params.leadInPrompt,
      fallbackPrompt,
    );
    const baseContext = params.resetExistingFlow
      ? this.wecomAiConversationOrchestrationService.clearDailyReportMemory(
          params.conversationContext,
        )
      : params.conversationContext;
    const activeContext =
      this.wecomAiConversationOrchestrationService.updateFollowUpTemplateMemory(
        this.wecomAiConversationOrchestrationService.updateDailyReportMemory(
          baseContext,
          {
            flowStatus: 'COLLECTING',
            nextFragmentType: DAILY_REPORT_SECTION_ORDER[0],
            supervisorId: params.user.id,
            supervisorName: params.user.name,
          },
        ),
        createWecomFollowUpTemplateDraft(params.user.name),
      );

    this.wecomAiConversationOrchestrationService.appendAssistantTurn(
      activeContext,
      finalPrompt,
    );

    const dispatchResult = await this.wecomStreamDispatcherService.dispatch({
      receiptId: params.receipt.id,
      sessionId: params.session.id,
      target: this.buildDispatchTarget(params.inboundMessage, params.receipt.id),
      blocks: this.wecomStreamDispatcherService.buildDirectReplyBlocks(finalPrompt),
    });

    this.saveSessionState(params.session, 'ACTIVE', {
      activeRequestId: params.receipt.id,
      lastReceiptId: params.receipt.id,
    });

    return {
      receiptId: params.receipt.id,
      sessionId: params.session.id,
      status: 'DAILY_REPORT_PROMPTED',
      acceptedAt: params.receipt.createdAt,
      deliveryStatus: dispatchResult.status,
      deliveredBlockCount: dispatchResult.deliveredCount,
    };
  }

  private async handleDailyReportFollowUpLookup(params: {
    user: CrmUser;
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
    intake: WecomDailyReportIntakeResult;
    followUpText: string;
    savedReport?: ReturnType<DailyReportService['recordFragment']>;
  }): Promise<WecomReceiveMessageResult> {
    const pendingStatus =
      params.conversationContext.workMemory.dailyReportEntityLookupStatus ?? 'IDLE';

    if (pendingStatus === 'AWAITING_CONFIRMATION') {
      return await this.handleDailyReportEntityLookupReply({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext: params.conversationContext,
        intake: params.intake,
        followUpText: params.followUpText,
        savedReport: params.savedReport,
      });
    }

    return await this.startDailyReportEntityLookup({
      user: params.user,
      session: params.session,
      receipt: params.receipt,
      inboundMessage: params.inboundMessage,
      conversationContext: params.conversationContext,
      intake: params.intake,
      followUpText: params.followUpText,
      savedReport: params.savedReport,
    });
  }

  private async handleDailyReportEntityLookupReply(params: {
    user: CrmUser;
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
    intake: WecomDailyReportIntakeResult;
    followUpText: string;
    savedReport?: ReturnType<DailyReportService['recordFragment']>;
  }): Promise<WecomReceiveMessageResult> {
    const messageText = params.inboundMessage.messageText?.trim() ?? '';
    const pendingText =
      params.conversationContext.workMemory.dailyReportEntityLookupText ??
      params.followUpText;
    const lookupStep =
      params.conversationContext.workMemory.dailyReportEntityLookupStep ??
      'INITIAL_CONFIRM';
    const selectionResult =
      lookupStep === 'SELECT_TARGET'
        ? await this.resolveDailyReportEntitySelection({
            user: params.user,
            conversationContext: params.conversationContext,
            rawReplyText: messageText,
            followUpText: pendingText,
          })
        : {
            selectedQueryText: messageText,
          };

    if ('retryPrompt' in selectionResult) {
      await this.dispatchDailyReportEntityLookupPrompt({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext: params.conversationContext,
        prompt: selectionResult.retryPrompt,
      });

      return {
        receiptId: params.receipt.id,
        sessionId: params.session.id,
        status: 'DAILY_REPORT_PROMPTED',
        acceptedAt: params.receipt.createdAt,
        deliveryStatus: 'SENT',
        deliveredBlockCount: 1,
      };
    }

    if (
      params.conversationContext.workMemory.followUpTemplateDraft &&
      selectionResult.selectedDraft
    ) {
      return await this.dispatchFollowUpTemplateWritebackConfirmation({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext: params.conversationContext,
        draft: params.conversationContext.workMemory.followUpTemplateDraft,
        sourceQueryText: selectionResult.selectedQueryText || pendingText,
        resolvedDraft: selectionResult.selectedDraft,
      });
    }

    if (params.conversationContext.workMemory.followUpTemplateDraft) {
      return await this.resolveFollowUpTemplateEntity({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext: params.conversationContext,
        followUpText: pendingText,
        queryText: selectionResult.selectedQueryText || pendingText,
        draft: params.conversationContext.workMemory.followUpTemplateDraft,
      });
    }

    if (
      lookupStep === 'BATCH_WRITEBACK_CONFIRM' &&
      this.isDailyReportConfirmReply(messageText)
    ) {
      return await this.executeBatchDailyReportEntityWriteback({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext: params.conversationContext,
        followUpText: pendingText,
      });
    }

    if (this.isDailyReportConfirmReply(messageText)) {
      this.analysisLoggerService.logStep('企业微信日报实体确认已命中确认分支。', {
        requesterId: params.user.id,
        requesterName: params.user.name,
        sessionId: params.session.id,
        sourceMessageId: params.inboundMessage.channelMessageId,
        followUpTemplateDraftPresent: false,
        pendingText,
        lookupStep,
      });
      return await this.confirmDailyReportEntityLookup({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext: params.conversationContext,
        followUpText: pendingText,
      });
    }

    return await this.startDailyReportEntityLookup({
      user: params.user,
      session: params.session,
      receipt: params.receipt,
      inboundMessage: params.inboundMessage,
      conversationContext: params.conversationContext,
      intake:
        selectionResult.selectedQueryText &&
        selectionResult.selectedQueryText !== messageText
          ? this.wecomDailyReportIntakeService.inspect(
              selectionResult.selectedQueryText,
            )
          : params.intake,
      followUpText: pendingText,
      queryText: selectionResult.selectedQueryText || pendingText,
      savedReport: params.savedReport,
    });
  }

  private async startDailyReportEntityLookup(params: {
    user: CrmUser;
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
    intake: WecomDailyReportIntakeResult;
    followUpText: string;
    queryText?: string;
    savedReport?: ReturnType<DailyReportService['recordFragment']>;
  }): Promise<WecomReceiveMessageResult> {
    const { companyNames, projectNames } = this.extractFollowUpEntityCandidates(
      params.intake,
    );
    const refinedEntityNames =
      params.queryText && params.queryText.trim() !== params.followUpText.trim()
        ? this.refineDailyReportEntityCandidates(
            params.queryText,
            companyNames,
            projectNames,
          )
        : {
            companyNames,
            projectNames,
          };

    const savedContext = this.wecomAiConversationOrchestrationService.updateDailyReportMemory(
      params.conversationContext,
      {
        flowStatus: 'COLLECTING',
        reportId: params.savedReport?.id,
        businessDate: params.savedReport?.businessDate,
        nextFragmentType: params.savedReport
          ? getWecomDailyReportNextStep(params.savedReport.sectionTypes)
          : DAILY_REPORT_SECTION_ORDER[0],
        collectedFragmentTypes: params.savedReport?.sectionTypes,
        supervisorId: params.user.id,
        supervisorName: params.user.name,
        draftSummary: params.savedReport?.draftSummary,
        entityLookupStatus: 'AWAITING_CONFIRMATION',
        entityLookupText:
          params.conversationContext.workMemory.dailyReportEntityLookupText ??
          params.followUpText,
        entityLookupQueryText: params.queryText ?? params.followUpText,
        entityLookupCompanyName: refinedEntityNames.companyNames[0],
        entityLookupProjectName: refinedEntityNames.projectNames[0],
        entityLookupCompanyNames: refinedEntityNames.companyNames,
        entityLookupProjectNames: refinedEntityNames.projectNames,
        entityLookupMatchedCompanyNames: [],
        entityLookupSummary: undefined,
        entityLookupStep: 'INITIAL_CONFIRM',
      },
    );

    const prompt = this.buildTodayFollowUpEntityIntentPrompt({
      companyNames: refinedEntityNames.companyNames,
      projectNames: refinedEntityNames.projectNames,
      summaryLines: this.buildTodayFollowUpSummaryLines(params.followUpText),
    });
    await this.dispatchDailyReportEntityLookupPrompt({
      user: params.user,
      session: params.session,
      receipt: params.receipt,
      inboundMessage: params.inboundMessage,
      conversationContext: savedContext,
      prompt,
    });

    return {
      receiptId: params.receipt.id,
      sessionId: params.session.id,
      status: 'DAILY_REPORT_PROMPTED',
      acceptedAt: params.receipt.createdAt,
      deliveryStatus: 'SENT',
      deliveredBlockCount: 1,
    };
  }

  private extractFollowUpEntityCandidates(intake: WecomDailyReportIntakeResult): {
    companyNames: string[];
    projectNames: string[];
  } {
    return {
      companyNames: this.uniqueStrings([
        ...intake.companyCandidates,
        ...intake.backendMatches
          .filter((item) => item.kind === 'customer')
          .map((item) => item.name),
        ...intake.fallbackCandidates.filter((item) => this.looksLikeCompanyName(item)),
      ]),
      projectNames: this.uniqueStrings([
        ...intake.projectCandidates,
        ...intake.backendMatches
          .filter((item) => item.kind === 'opportunity')
          .map((item) => item.name),
        ...intake.fallbackCandidates.filter((item) => !this.looksLikeCompanyName(item)),
      ]),
    };
  }

  private async confirmDailyReportEntityLookup(params: {
    user: CrmUser;
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
    followUpText: string;
  }): Promise<WecomReceiveMessageResult> {
    const companyNames =
      params.conversationContext.workMemory.dailyReportEntityLookupCompanyNames ?? [];
    const projectNames =
      params.conversationContext.workMemory.dailyReportEntityLookupProjectNames ?? [];
    const accessToken = await this.resolveWecomCrmAccessToken(params.user);
    const lookupResults = await this.queryDailyReportEntitiesSeparately({
      user: params.user,
      conversationContext: params.conversationContext,
      companyNames,
      projectNames,
      followUpText:
        params.conversationContext.workMemory.dailyReportEntityLookupText ??
        params.followUpText,
      accessToken,
    });
    const unresolvedResults = lookupResults.filter((item) => !item.draft);

    if (unresolvedResults.length > 0) {
      const prompt = this.buildDailyReportEntityQueryResultPrompt({
        lookupResults,
        candidateActionHint:
          '当前还有项目/客户未能唯一确认，请直接回复候选序号或更准确的名称，我再继续写入跟进记录。',
        noCandidateActionHint:
          '当前还有项目/客户未能唯一确认，请补充更准确的完整名称，我再继续写入跟进记录。',
      });
      const nextContext =
        this.wecomAiConversationOrchestrationService.updateDailyReportMemory(
          params.conversationContext,
          {
            flowStatus:
              params.conversationContext.workMemory.dailyReportFlowStatus ?? 'COLLECTING',
            entityLookupStatus: 'AWAITING_CONFIRMATION',
            entityLookupText: params.followUpText,
            entityLookupQueryText:
              params.conversationContext.workMemory.dailyReportEntityLookupQueryText ??
              params.followUpText,
            entityLookupCompanyName: companyNames[0],
            entityLookupProjectName: projectNames[0],
            entityLookupCompanyNames: companyNames,
            entityLookupProjectNames: projectNames,
            entityLookupMatchedCompanyNames: [],
            entityLookupSummary: undefined,
            entityLookupStep: 'SELECT_TARGET',
          },
        );

      await this.dispatchDailyReportEntityLookupPrompt({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext: nextContext,
        prompt,
      });

      return {
        receiptId: params.receipt.id,
        sessionId: params.session.id,
        status: 'DAILY_REPORT_PROMPTED',
        acceptedAt: params.receipt.createdAt,
        deliveryStatus: 'SENT',
        deliveredBlockCount: 1,
      };
    }

    if (lookupResults.length > 1) {
      return await this.executeBatchDailyReportEntityWriteback({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext: params.conversationContext,
        followUpText: params.followUpText,
      });
    }

    const draft = await this.resolveFollowUpDraftForDailyReportWriteback({
      user: params.user,
      companyNames,
      projectNames,
      accessToken,
      draftContent: params.followUpText,
    });
    if (!draft) {
      const prompt = '当前还没有识别到可直接写入的项目或客户，请直接补充准确名称后再试。';
      const retryContext =
        this.wecomAiConversationOrchestrationService.updateDailyReportMemory(
          params.conversationContext,
          {
            flowStatus:
              params.conversationContext.workMemory.dailyReportFlowStatus ?? 'COLLECTING',
            entityLookupStatus: 'AWAITING_CONFIRMATION',
            entityLookupText: params.followUpText,
            entityLookupQueryText:
              params.conversationContext.workMemory.dailyReportEntityLookupQueryText ??
              params.followUpText,
            entityLookupCompanyNames: companyNames,
            entityLookupProjectNames: projectNames,
            entityLookupMatchedCompanyNames: [],
            entityLookupSummary: undefined,
            entityLookupStep: 'SELECT_TARGET',
          },
        );
      await this.dispatchDailyReportEntityLookupPrompt({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext: retryContext,
        prompt,
      });

      return {
        receiptId: params.receipt.id,
        sessionId: params.session.id,
        status: 'DAILY_REPORT_PROMPTED',
        acceptedAt: params.receipt.createdAt,
        deliveryStatus: 'SENT',
        deliveredBlockCount: 1,
      };
    }

    this.ensureWecomWorkflowAction(
      params.user,
      params.session.id,
      'wecom.followup.writeback',
      '当前用户无权执行企业微信跟进写回。',
      'daily-report-direct-writeback-draft',
    );
    const authorizationResult = await this.ensureFollowUpObjectAuthorization({
      user: params.user,
      sessionId: params.session.id,
      conversationContext: params.conversationContext,
      resourceType: 'daily-report-direct-writeback-draft-scope',
      accessToken,
      target: {
        objectType: draft.objectType,
        objectId: draft.objectId,
        objectTitle: draft.objectTitle,
        ownerId: draft.ownerId,
        ownerName: draft.ownerName,
      },
    });

    const pendingWriteback = this.followUpWritebackRepository.save({
      id: buildEntityId('follow_up_writeback'),
      sessionId: params.session.id,
      requesterId: params.user.id,
      requesterName: params.user.name,
      sourceReceiptId: params.receipt.id,
      sourceMessageId: params.inboundMessage.channelMessageId,
      sourceQueryText:
        params.conversationContext.workMemory.dailyReportEntityLookupQueryText ??
        params.followUpText,
      objectType: draft.objectType,
      objectId: draft.objectId,
      objectTitle: draft.objectTitle,
      opportunityId: draft.objectId,
      opportunityTitle: draft.objectTitle,
      customerName: draft.customerName,
      ...this.buildStructuredFollowUpFields(
        params.conversationContext.workMemory.followUpTemplateDraft,
      ),
      ownerId: draft.ownerId,
      ownerName: draft.ownerName,
      assistUserIds: authorizationResult.assistUserCrmUserIds,
      assistUserNames: authorizationResult.assistUserNames,
      assistUsersResolved: true,
      draftContent: draft.draftContent,
      status: 'DRAFTED',
      idempotencyKey: `${params.session.id}:${draft.objectType}:${draft.objectId}:${params.receipt.id}`,
      confirmedWriteIntentAt: params.receipt.createdAt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    this.audit(
      params.user,
      'FOLLOW_UP_WRITEBACK_DRAFTED',
      `已根据今日跟进口述为${this.buildFollowUpTargetDisplay(pendingWriteback)}生成待写回草稿。`,
      this.withConversationAuditSnapshot(params.conversationContext, {
        sessionId: params.session.id,
        followUpWritebackId: pendingWriteback.id,
        objectType: pendingWriteback.objectType,
        objectId: pendingWriteback.objectId,
        source: 'daily-report-direct-writeback',
      }),
    );
    this.audit(
      params.user,
      'FOLLOW_UP_WRITEBACK_INTENT_CONFIRMED',
      `已确认准备写入${this.buildFollowUpTargetDisplay(pendingWriteback)}的跟进记录。`,
      this.withConversationAuditSnapshot(params.conversationContext, {
        sessionId: params.session.id,
        followUpWritebackId: pendingWriteback.id,
        objectType: pendingWriteback.objectType,
        objectId: pendingWriteback.objectId,
      }),
    );

    const activeContext =
      this.wecomAiConversationOrchestrationService.clearDailyReportMemory(
        this.wecomAiConversationOrchestrationService.updateFollowUpWritebackMemory(
          params.conversationContext,
          {
            activeId: pendingWriteback.id,
            status: pendingWriteback.status,
            objectType: pendingWriteback.objectType,
            objectId: pendingWriteback.objectId,
            objectTitle: pendingWriteback.objectTitle,
            opportunityId: pendingWriteback.opportunityId,
            opportunityTitle: pendingWriteback.opportunityTitle,
            draftContent: pendingWriteback.draftContent,
            failureReason: undefined,
          },
        ),
      );

    return await this.executeFollowUpWriteback({
      user: params.user,
      session: params.session,
      receipt: params.receipt,
      inboundMessage: params.inboundMessage,
      conversationContext: activeContext,
      writebackRecord: pendingWriteback,
    });
  }

  private async dispatchDailyReportEntityLookupPrompt(params: {
    user: CrmUser;
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
    prompt: string;
  }): Promise<void> {
    this.wecomAiConversationOrchestrationService.appendAssistantTurn(
      params.conversationContext,
      params.prompt,
    );

    const dispatchResult = await this.wecomStreamDispatcherService.dispatch({
      receiptId: params.receipt.id,
      sessionId: params.session.id,
      target: this.buildDispatchTarget(params.inboundMessage, params.receipt.id),
      blocks: this.wecomStreamDispatcherService.buildDirectReplyBlocks(params.prompt),
    });

    this.saveSessionState(params.session, 'ACTIVE', {
      activeRequestId: params.receipt.id,
      lastReceiptId: params.receipt.id,
    });

    this.analysisLoggerService.logStep('企业微信日报公司/项目确认已回传。', {
      requesterId: params.user.id,
      sessionId: params.session.id,
      deliveryStatus: dispatchResult.status,
      deliveredCount: dispatchResult.deliveredCount,
    });
  }

  private async dispatchDailyReportReview(params: {
    user: CrmUser;
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
    intake: WecomDailyReportIntakeResult;
    savedReport: ReturnType<DailyReportService['recordFragment']>;
    closingHint: string;
    leadingPrompt?: string;
    followUpWritebackRecord?: PendingFollowUpWritebackRecord;
  }): Promise<WecomReceiveMessageResult> {
    const nextStep = getWecomDailyReportNextStep(params.savedReport.sectionTypes);
    const nextState = nextStep ? 'COLLECTING' : 'AWAITING_CONFIRMATION';
    const reviewPrompt = this.buildDailyReportReviewPrompt(
      params.savedReport,
      params.intake,
      params.closingHint,
    );
    const finalPrompt = [
      params.leadingPrompt,
      reviewPrompt,
      params.followUpWritebackRecord
        ? buildWecomFollowUpWritebackIntentPrompt({
            objectType: this.getFollowUpRecordObjectType(params.followUpWritebackRecord),
            opportunityTitle: params.followUpWritebackRecord.opportunityTitle,
            customerName: params.followUpWritebackRecord.customerName,
            draftContent: params.followUpWritebackRecord.draftContent,
          })
        : undefined,
    ]
      .filter(Boolean)
      .join('\n\n');

    const updatedContext = this.wecomAiConversationOrchestrationService.updateDailyReportMemory(
      params.conversationContext,
      {
        flowStatus: nextState,
        reportId: params.savedReport.id,
        businessDate: params.savedReport.businessDate,
        nextFragmentType: nextStep,
        collectedFragmentTypes: params.savedReport.sectionTypes,
        supervisorId: params.user.id,
        supervisorName: params.user.name,
        draftSummary: params.savedReport.draftSummary,
        entityLookupStatus: 'IDLE',
        entityLookupText: undefined,
        entityLookupQueryText: undefined,
        entityLookupCompanyName: undefined,
        entityLookupProjectName: undefined,
        entityLookupMatchedCompanyNames: [],
        entityLookupSummary: undefined,
      },
    );

    this.wecomAiConversationOrchestrationService.appendAssistantTurn(
      updatedContext,
      finalPrompt,
    );

    const dispatchResult = await this.wecomStreamDispatcherService.dispatch({
      receiptId: params.receipt.id,
      sessionId: params.session.id,
      target: this.buildDispatchTarget(params.inboundMessage, params.receipt.id),
      blocks: this.wecomStreamDispatcherService.buildDirectReplyBlocks(finalPrompt),
    });

    this.saveSessionState(params.session, 'ACTIVE', {
      activeRequestId: params.receipt.id,
      lastReceiptId: params.receipt.id,
    });

    return {
      receiptId: params.receipt.id,
      sessionId: params.session.id,
      status: nextStep ? 'DAILY_REPORT_COLLECTED' : 'DAILY_REPORT_AWAITING_CONFIRMATION',
      acceptedAt: params.receipt.createdAt,
      deliveryStatus: dispatchResult.status,
      deliveredBlockCount: dispatchResult.deliveredCount,
      followUpWriteback: this.buildFollowUpWritebackPayload(
        params.followUpWritebackRecord,
      ),
    };
  }

  private async maybeCreateFollowUpWritebackFromDailyReport(params: {
    user: CrmUser;
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    conversationContext: WecomConversationContextRecord;
    followUpText: string;
  }): Promise<PendingFollowUpWritebackRecord | undefined> {
    const companyNames =
      params.conversationContext.workMemory.dailyReportEntityLookupCompanyNames ?? [];
    const projectNames =
      params.conversationContext.workMemory.dailyReportEntityLookupProjectNames ?? [];
    const sourceQueryText =
      params.conversationContext.workMemory.dailyReportEntityLookupQueryText ??
      params.followUpText;
    const accessToken = await this.resolveWecomCrmAccessToken(params.user);

    const draft = await this.resolveFollowUpDraftForDailyReportWriteback({
      user: params.user,
      companyNames,
      projectNames,
      accessToken,
      draftContent: params.followUpText,
    });

    if (!draft) {
      return undefined;
    }

    this.ensureWecomWorkflowAction(
      params.user,
      params.session.id,
      'wecom.followup.writeback',
      '当前用户无权执行企业微信跟进写回。',
      'daily-report-follow-up-writeback-from-context',
    );
    const authorizationResult = await this.ensureFollowUpObjectAuthorization({
      user: params.user,
      sessionId: params.session.id,
      conversationContext: params.conversationContext,
      resourceType: 'daily-report-follow-up-writeback-from-context-scope',
      accessToken,
      target: {
        objectType: draft.objectType,
        objectId: draft.objectId,
        objectTitle: draft.objectTitle,
        ownerId: draft.ownerId,
        ownerName: draft.ownerName,
      },
    });

    const pendingWriteback = this.followUpWritebackRepository.save({
      id: buildEntityId('follow_up_writeback'),
      sessionId: params.session.id,
      requesterId: params.user.id,
      requesterName: params.user.name,
      sourceReceiptId: params.receipt.id,
      sourceMessageId:
        params.conversationContext.turns.filter((item) => item.role === 'user').at(-1)
          ?.messageId ?? params.receipt.id,
      sourceQueryText,
      objectType: draft.objectType,
      objectId: draft.objectId,
      objectTitle: draft.objectTitle,
      opportunityId: draft.objectId,
      opportunityTitle: draft.objectTitle,
      customerName: draft.customerName,
      ...this.buildStructuredFollowUpFields(
        params.conversationContext.workMemory.followUpTemplateDraft,
      ),
      ownerId: draft.ownerId,
      ownerName: draft.ownerName,
      assistUserIds: authorizationResult.assistUserCrmUserIds,
      assistUserNames: authorizationResult.assistUserNames,
      assistUsersResolved: true,
      draftContent: draft.draftContent,
      status: 'DRAFTED',
      idempotencyKey: `${params.session.id}:${draft.objectType}:${draft.objectId}:${params.receipt.id}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    this.audit(
      params.user,
      'FOLLOW_UP_WRITEBACK_DRAFTED',
      `已根据日报口述为${this.buildFollowUpTargetDisplay(pendingWriteback)}生成待写回草稿。`,
      {
        sessionId: params.session.id,
        followUpWritebackId: pendingWriteback.id,
        objectType: pendingWriteback.objectType,
        objectId: pendingWriteback.objectId,
        source: 'daily-report-entity-lookup',
      },
    );

    return pendingWriteback;
  }

  private async resolveFollowUpDraftForDailyReportWriteback(params: {
    user: CrmUser;
    companyNames: string[];
    projectNames: string[];
    accessToken?: string;
    draftContent: string;
  }) {
    const uniqueProjectNames = this.uniqueStrings(params.projectNames);
    const uniqueCompanyNames = this.uniqueStrings(params.companyNames);
    const opportunityLookupKeys = this.uniqueStrings([
      ...uniqueProjectNames,
      ...uniqueCompanyNames,
    ]);
    const preferOpportunity =
      uniqueProjectNames.length > 0 ||
      /(?:项目|商机|POC|SaaS|续签|扩容|升级|方案|报价|测试)/iu.test(
        params.draftContent,
      );

    if (preferOpportunity) {
      for (const lookupKey of opportunityLookupKeys) {
        const lookupResult = await this.lookupOpportunityByCompanyNameWithRetry({
          user: params.user,
          companyName: lookupKey,
          limit: 10,
          accessToken: params.accessToken,
          allowBuiltinWritebackFallback: true,
          restrictToOwnerOrCollaborator:
            this.shouldRestrictFollowUpLookupToOwnerOrCollaborator(params.user),
        });

        const resolved = this.pickOpportunityRecordForWriteback(
          lookupResult.records,
          lookupResult.totalCount,
          uniqueProjectNames,
        );
        if (resolved) {
          return this.crmFollowUpWritebackService.buildOpportunityFollowUpDraft(
            resolved,
            {
              draftContent: params.draftContent,
              actorName: params.user.name,
            },
          );
        }
      }
    }

    for (const companyName of uniqueCompanyNames) {
      const customerLookupResult = await this.lookupCustomerByNameWithRetry({
        user: params.user,
        customerName: companyName,
        limit: 10,
        accessToken: params.accessToken,
        allowBuiltinWritebackFallback: true,
        restrictToOwnerOrCollaborator:
          this.shouldRestrictFollowUpLookupToOwnerOrCollaborator(params.user),
      });
      const resolvedCustomer = this.pickCustomerRecordForWriteback(
        customerLookupResult.records,
        customerLookupResult.totalCount,
        uniqueCompanyNames,
      );
      if (resolvedCustomer) {
        return this.crmFollowUpWritebackService.buildCustomerFollowUpDraft(
          resolvedCustomer,
          {
            draftContent: params.draftContent,
            actorName: params.user.name,
          },
        );
      }
    }

    for (const companyName of uniqueCompanyNames) {
      const lookupResult = await this.lookupOpportunityByCompanyNameWithRetry({
        user: params.user,
        companyName,
        limit: 10,
        accessToken: params.accessToken,
        allowBuiltinWritebackFallback: true,
        restrictToOwnerOrCollaborator:
          this.shouldRestrictFollowUpLookupToOwnerOrCollaborator(params.user),
      });

      const resolved = this.pickOpportunityRecordForWriteback(
        lookupResult.records,
        lookupResult.totalCount,
        params.projectNames,
      );
      if (resolved) {
        return this.crmFollowUpWritebackService.buildOpportunityFollowUpDraft(
          resolved,
          {
            draftContent: params.draftContent,
            actorName: params.user.name,
          },
        );
      }
    }

    return undefined;
  }

  private hasMultipleDailyReportEntityTargets(
    companyNames: string[],
    projectNames: string[],
  ): boolean {
    return this.buildDailyReportEntityTargets(companyNames, projectNames).length > 1;
  }

  private buildDailyReportEntityTargets(
    companyNames: string[],
    projectNames: string[],
  ): Array<{
    kind: 'project' | 'customer';
    label: string;
    name: string;
  }> {
    const uniqueProjectNames = this.uniqueStrings(projectNames);
    const uniqueCompanyNames = this.uniqueStrings(companyNames).filter((companyName) => {
      const normalizedCompanyName = this.normalizeEntityText(companyName);
      return !uniqueProjectNames.some((projectName) =>
        this.normalizeEntityText(projectName).includes(normalizedCompanyName),
      );
    });

    return [
      ...uniqueProjectNames.map((name, index) => ({
        kind: 'project' as const,
        label: uniqueProjectNames.length > 1 ? `项目${index + 1}` : '项目',
        name,
      })),
      ...uniqueCompanyNames.map((name, index) => ({
        kind: 'customer' as const,
        label: uniqueCompanyNames.length > 1 ? `客户${index + 1}` : '客户',
        name,
      })),
    ];
  }

  /**
   * 跟进写回场景的候选召回需要先找“当前有资格继续写回”的对象；
   * 但管理员应直接看到组织内可写对象，不能在召回阶段被误按“负责人/协作人=本人”裁空。
   */
  private shouldRestrictFollowUpLookupToOwnerOrCollaborator(
    user: CrmUser,
  ): boolean {
    return !user.isAdmin;
  }

  private refineDailyReportEntityCandidates(
    queryText: string,
    companyNames: string[],
    projectNames: string[],
  ): {
    companyNames: string[];
    projectNames: string[];
  } {
    const normalizedQueryText = this.normalizeEntityText(queryText);
    if (!normalizedQueryText) {
      return {
        companyNames,
        projectNames,
      };
    }

    const matchedProjectNames = this.uniqueStrings(projectNames).filter((name) => {
      const normalizedName = this.normalizeEntityText(name);
      return (
        normalizedName.length > 0 &&
        (normalizedQueryText.includes(normalizedName) ||
          normalizedName.includes(normalizedQueryText))
      );
    });
    const matchedCompanyNames = this.uniqueStrings(companyNames).filter((name) => {
      const normalizedName = this.normalizeEntityText(name);
      return (
        normalizedName.length > 0 &&
        (normalizedQueryText.includes(normalizedName) ||
          normalizedName.includes(normalizedQueryText))
      );
    });

    if (matchedProjectNames.length === 0 && matchedCompanyNames.length === 0) {
      return {
        companyNames,
        projectNames,
      };
    }

    if (matchedProjectNames.length > 0) {
      const filteredCompanyNames = matchedCompanyNames.filter((companyName) => {
        const normalizedCompanyName = this.normalizeEntityText(companyName);
        return !matchedProjectNames.some((projectName) =>
          this.normalizeEntityText(projectName).includes(normalizedCompanyName),
        );
      });

      return {
        companyNames: filteredCompanyNames,
        projectNames: matchedProjectNames,
      };
    }

    return {
      companyNames: matchedCompanyNames,
      projectNames: [],
    };
  }

  private async queryDailyReportEntitiesSeparately(params: {
    user: CrmUser;
    conversationContext?: WecomConversationContextRecord;
    companyNames: string[];
    projectNames: string[];
    followUpText?: string;
    accessToken?: string;
  }): Promise<DailyReportEntityLookupResult[]> {
    const targets = this.buildDailyReportEntityTargets(
      params.companyNames,
      params.projectNames,
    );

    return await Promise.all(
      targets.map(async (target, index) => {
        try {
          if (target.kind === 'project') {
            const result = await this.lookupOpportunityByCompanyNameWithRetry({
              user: params.user,
              companyName: target.name,
              limit: 10,
              accessToken: params.accessToken,
              allowBuiltinWritebackFallback: true,
              restrictToOwnerOrCollaborator:
                this.shouldRestrictFollowUpLookupToOwnerOrCollaborator(params.user),
            });
            const resolved = this.pickOpportunityRecordForWriteback(
              result.records,
              result.totalCount,
              [target.name],
            );
            const draftContent = this.buildDailyReportEntityDraftContent(
              target.name,
              params.followUpText,
            );

            if (resolved) {
              return {
                queryResultLine: this.appendDailyReportEntitySummaryLine(
                  `${index + 1}. ${target.label}「${target.name}」：唯一命中商机「${resolved.title}」`,
                  target.name,
                  params.followUpText,
                ),
                targetLabel: target.label,
                targetName: target.name,
                objectLabel: '商机',
                candidateNames: [resolved.title],
                draft: this.crmFollowUpWritebackService.buildOpportunityFollowUpDraft(
                  resolved,
                  {
                    draftContent,
                    actorName: params.user.name,
                  },
                ),
              };
            }

            if (result.totalCount === 0) {
              return {
                queryResultLine: this.appendDailyReportEntitySummaryLine(
                  `${index + 1}. ${target.label}「${target.name}」信息较模糊，暂时找不到可写入的商机，请补充更完整的项目名或客户名。`,
                  target.name,
                  params.followUpText,
                ),
                targetLabel: target.label,
                targetName: target.name,
                objectLabel: '商机',
                candidateNames: [],
              };
            }

            const uniqueProjectRecords = this.uniqueByName(
              result.records,
              (item) => item.title,
            );
            const candidateDrafts = uniqueProjectRecords.map((item) => ({
              name: item.title,
              draft: this.crmFollowUpWritebackService.buildOpportunityFollowUpDraft(
                item,
                {
                  draftContent: this.buildDailyReportEntityDraftContent(
                    item.title,
                    params.followUpText,
                  ),
                  actorName: params.user.name,
                },
              ),
            }));
            const candidateDisplay = await this.buildRerankedCandidateDisplay({
              queryText: `${target.name} ${params.followUpText}`,
              candidates: uniqueProjectRecords.map((item) => ({
                id: item.id,
                name: item.title,
                details: [item.customerName, item.stage, item.ownerName],
              })),
            });
            this.audit(params.user, 'WECOM_CANDIDATE_RERANKED', '企业微信商机候选已完成受控重排。', {
              ...this.withConversationAuditSnapshot(params.conversationContext, {
                targetName: target.name,
                objectLabel: '商机',
                candidateRerankSnapshot: candidateDisplay.auditSnapshot,
              }),
            });
            return {
              queryResultLine: this.appendDailyReportEntitySummaryLine(
                this.buildDailyReportEntityCandidatePrompt({
                  index,
                  label: target.label,
                  targetName: target.name,
                  objectLabel: '商机',
                  candidateLines: candidateDisplay.candidateLines,
                  rawTotalCount: result.totalCount,
                }),
                target.name,
                params.followUpText,
              ),
              targetLabel: target.label,
              targetName: target.name,
              objectLabel: '商机',
              candidateNames: candidateDisplay.candidateNames,
              candidateLines: candidateDisplay.candidateLines,
              candidateDrafts,
            };
          }

          const result = await this.lookupCustomerByNameWithRetry({
            user: params.user,
            customerName: target.name,
            limit: 10,
            accessToken: params.accessToken,
            allowBuiltinWritebackFallback: true,
            restrictToOwnerOrCollaborator:
              this.shouldRestrictFollowUpLookupToOwnerOrCollaborator(params.user),
          });
          const resolved = this.pickCustomerRecordForWriteback(
            result.records,
            result.totalCount,
            [target.name],
          );
          const draftContent = this.buildDailyReportEntityDraftContent(
            target.name,
            params.followUpText,
          );

          if (resolved) {
            return {
              queryResultLine: this.appendDailyReportEntitySummaryLine(
                `${index + 1}. ${target.label}「${target.name}」：唯一命中客户「${resolved.name}」`,
                target.name,
                params.followUpText,
              ),
              targetLabel: target.label,
              targetName: target.name,
              objectLabel: '客户',
              candidateNames: [resolved.name],
              draft: this.crmFollowUpWritebackService.buildCustomerFollowUpDraft(
                resolved,
                {
                  draftContent,
                  actorName: params.user.name,
                },
              ),
            };
          }

          if (result.totalCount === 0) {
            return {
              queryResultLine: this.appendDailyReportEntitySummaryLine(
                `${index + 1}. ${target.label}「${target.name}」信息较模糊，暂时找不到可写入的客户，请补充更完整的客户名或公司全称。`,
                target.name,
                params.followUpText,
              ),
              targetLabel: target.label,
              targetName: target.name,
              objectLabel: '客户',
              candidateNames: [],
            };
          }

          const uniqueCustomerRecords = this.uniqueByName(
            result.records,
            (item) => item.name,
          );
          const candidateDrafts = uniqueCustomerRecords.map((item) => ({
            name: item.name,
            draft: this.crmFollowUpWritebackService.buildCustomerFollowUpDraft(
              item,
              {
                draftContent: this.buildDailyReportEntityDraftContent(
                  item.name,
                  params.followUpText,
                ),
                actorName: params.user.name,
              },
            ),
          }));
          const candidateDisplay = await this.buildRerankedCandidateDisplay({
            queryText: `${target.name} ${params.followUpText}`,
            candidates: uniqueCustomerRecords.map((item) => ({
              id: item.id,
              name: item.name,
              details: [item.category, item.ownerName],
            })),
          });
          this.audit(params.user, 'WECOM_CANDIDATE_RERANKED', '企业微信客户候选已完成受控重排。', {
            ...this.withConversationAuditSnapshot(params.conversationContext, {
              targetName: target.name,
              objectLabel: '客户',
              candidateRerankSnapshot: candidateDisplay.auditSnapshot,
            }),
          });
          return {
            queryResultLine: this.appendDailyReportEntitySummaryLine(
              this.buildDailyReportEntityCandidatePrompt({
                index,
                label: target.label,
                targetName: target.name,
                objectLabel: '客户',
                candidateLines: candidateDisplay.candidateLines,
                rawTotalCount: result.totalCount,
              }),
              target.name,
              params.followUpText,
            ),
            targetLabel: target.label,
            targetName: target.name,
            objectLabel: '客户',
            candidateNames: candidateDisplay.candidateNames,
            candidateLines: candidateDisplay.candidateLines,
            candidateDrafts,
          };
        } catch (error) {
          const reason =
            error instanceof Error ? error.message : 'CRM 查询失败，请稍后重试';
          return {
            queryResultLine: this.appendDailyReportEntitySummaryLine(
              `${index + 1}. ${target.label}「${target.name}」：查询失败，${reason}`,
              target.name,
              params.followUpText,
            ),
            targetLabel: target.label,
            targetName: target.name,
            objectLabel: target.kind === 'project' ? '商机' : '客户',
            candidateNames: [],
          };
        }
      }),
    );
  }

  private appendDailyReportEntitySummaryLine(
    resultLine: string,
    targetName: string,
    followUpText?: string,
  ): string {
    // 候选选择与未命中提示必须保持简洁，避免把原始跟进内容重复回显给用户。
    if (
      resultLine.includes('候选') ||
      resultLine.includes('暂时找不到可写入') ||
      resultLine.includes('查询失败')
    ) {
      return resultLine;
    }

    const summary = this.buildDailyReportEntityDraftContent(
      targetName,
      followUpText,
    );
    return summary ? `${resultLine}\n   跟进记录内容：${summary}` : resultLine;
  }

  private buildDailyReportEntityDraftContent(
    targetName: string,
    followUpText?: string,
  ): string | undefined {
    const normalizedTargetName = this.normalizeEntityText(targetName);
    const normalizedFollowUpText = followUpText?.trim()
      ? this.normalizeDailyReportFollowUpText(followUpText)
      : undefined;
    if (!normalizedTargetName || !normalizedFollowUpText) {
      return normalizedFollowUpText;
    }

    // 模板链路一旦已经收齐结构化四段内容，后续候选选择必须保留整段草稿，不能再退回默认摘要。
    if (this.hasStructuredFollowUpTemplateSections(normalizedFollowUpText)) {
      return normalizedFollowUpText;
    }

    const quotedMatches = Array.from(
      normalizedFollowUpText.matchAll(/[“"'『「](.+?)[”"'』」]/gu),
      (item) => item[1]?.trim(),
    ).filter((item): item is string => Boolean(item));
    const otherQuotedEntities = quotedMatches.filter((item) => {
      const normalizedQuotedEntity = this.normalizeEntityText(item);
      return (
        normalizedQuotedEntity.length > 0 &&
        !normalizedQuotedEntity.includes(normalizedTargetName) &&
        !normalizedTargetName.includes(normalizedQuotedEntity)
      );
    });
    if (
      this.normalizeEntityText(normalizedFollowUpText).includes(normalizedTargetName) &&
      otherQuotedEntities.length === 0
    ) {
      return normalizedFollowUpText;
    }

    return this.extractDailyReportEntitySummary(targetName, normalizedFollowUpText);
  }

  private hasStructuredFollowUpTemplateSections(text: string): boolean {
    return /(?:^|\n)(?:跟进内容|遇到与协助|问题与协助|信息共享|信息分享|拜访计划)[:：]/u.test(
      text,
    );
  }

  private async resolveDailyReportEntitySelection(params: {
    user: CrmUser;
    conversationContext: WecomConversationContextRecord;
    rawReplyText: string;
    followUpText: string;
  }): Promise<
    | {
        selectedQueryText: string;
        selectedDraft?: FollowUpDraft;
      }
    | {
        retryPrompt: string;
      }
  > {
    const trimmedReplyText = params.rawReplyText.trim();
    if (!trimmedReplyText) {
      return {
        selectedQueryText: trimmedReplyText,
      };
    }

    const companyNames =
      params.conversationContext.workMemory.dailyReportEntityLookupCompanyNames ?? [];
    const projectNames =
      params.conversationContext.workMemory.dailyReportEntityLookupProjectNames ?? [];
    const accessToken = await this.resolveWecomCrmAccessToken(params.user);
    const lookupResults = await this.queryDailyReportEntitiesSeparately({
      user: params.user,
      conversationContext: params.conversationContext,
      companyNames,
      projectNames,
      followUpText: params.followUpText,
      accessToken,
    });
    const unresolvedTargets = lookupResults.filter(
      (item) => !item.draft && item.candidateNames.length > 0,
    );

    if (unresolvedTargets.length === 1) {
      const singleTarget = unresolvedTargets[0];
      const selectionResult = selectWecomCandidateByReply(
        trimmedReplyText,
        singleTarget.candidateNames.map((name) => ({ name })),
      );
      if (selectionResult.candidate) {
        return {
          selectedQueryText: selectionResult.candidate.name,
          selectedDraft: this.findEntityLookupCandidateDraft(
            singleTarget,
            selectionResult.candidate.name,
          ),
        };
      }

      if (selectionResult.selectionAttempted) {
        return {
          retryPrompt: this.buildDailyReportEntitySelectionRetryPrompt({
            target: singleTarget,
          }),
        };
      }

      return {
        selectedQueryText: trimmedReplyText,
      };
    }

    const exactMatchedTargets = unresolvedTargets.flatMap((target) =>
      target.candidateNames
        .filter((candidateName) => candidateName === trimmedReplyText)
        .map((candidateName) => ({
          target,
          candidateName,
        })),
    );
    if (exactMatchedTargets.length === 1) {
      return {
        selectedQueryText: exactMatchedTargets[0].candidateName,
        selectedDraft: this.findEntityLookupCandidateDraft(
          exactMatchedTargets[0].target,
          exactMatchedTargets[0].candidateName,
        ),
      };
    }

    if (parseWecomCandidateSelectionIndex(trimmedReplyText) !== undefined) {
      return {
        retryPrompt:
          '当前还有多个项目或客户候选待确认，请直接回复候选序号对应的完整名称，我再继续定位。',
      };
    }

    return {
      selectedQueryText: trimmedReplyText,
    };
  }

  private findEntityLookupCandidateDraft(
    target: DailyReportEntityLookupResult,
    candidateName: string,
  ): FollowUpDraft | undefined {
    return target.candidateDrafts?.find((item) => item.name === candidateName)?.draft;
  }

  private buildDailyReportEntitySelectionRetryPrompt(params: {
    target: DailyReportEntityLookupResult;
  }): string {
    return [
      `没有识别到有效候选，请重新选择 1 到 ${params.target.candidateNames.length} 之间的候选序号，或直接回复完整${params.target.objectLabel}名称。`,
      this.buildDailyReportEntityCandidatePrompt({
        index: 0,
        label: params.target.targetLabel,
        targetName: params.target.targetName,
        objectLabel: params.target.objectLabel,
        candidateLines:
          params.target.candidateLines ??
          params.target.candidateNames.map((name, candidateIndex) =>
            buildWecomCandidateDisplayLine({
              index: candidateIndex,
              title: name,
            }),
          ),
        rawTotalCount: params.target.candidateNames.length,
      }),
    ].join('\n');
  }

  private buildDailyReportEntityQueryResultPrompt(params: {
    lookupResults: DailyReportEntityLookupResult[];
    candidateActionHint: string;
    noCandidateActionHint: string;
  }): string {
    const hasCandidates = params.lookupResults.some(
      (item) =>
        item.candidateNames.length > 0 || (item.candidateLines?.length ?? 0) > 0,
    );

    return buildWecomDailyReportEntityQueryResultPrompt({
      leadLine: hasCandidates
        ? undefined
        : '你给出的项目/客户信息还不够准确，我先把 CRM 查询结果发你：',
      queryResultLines: params.lookupResults.map((item) => item.queryResultLine),
      actionHint: hasCandidates
        ? params.candidateActionHint
        : params.noCandidateActionHint,
    });
  }

  private buildDailyReportEntityCandidatePrompt(params: {
    index: number;
    label: string;
    targetName: string;
    objectLabel: '商机' | '客户';
    candidateLines?: string[];
    rawTotalCount: number;
  }): string {
    const candidateLines = (params.candidateLines ?? []).slice(0, 10);
    const totalCount = Math.max(params.rawTotalCount, candidateLines.length);
    const displayCount = candidateLines.length;
    const displayLines =
      candidateLines.length > 0
        ? candidateLines.map((line) => `   ${line}`)
        : ['   当前结果较多，请直接回复更完整的名称'];
    const countLine =
      totalCount > displayCount && displayCount > 0
        ? `找到 ${totalCount} 条${params.objectLabel}候选，先给你前 ${displayCount} 条`
        : `找到 ${totalCount} 条${params.objectLabel}候选`;

    return [
      `${params.index + 1}. ${params.label}「${params.targetName}」信息较模糊，${countLine}，请直接回复候选序号或完整${params.objectLabel}名称（例如：候选2、2、一、第一、第1个）。`,
      ...displayLines,
    ].join('\n');
  }

  private async buildRerankedCandidateDisplay(params: {
    queryText: string;
    candidates: Array<{
      id?: string;
      name: string;
      details?: Array<string | undefined>;
    }>;
  }): Promise<{
    candidateNames: string[];
    candidateLines: string[];
    auditSnapshot?: Record<string, unknown>;
  }> {
    if (process.env.WECOM_AI_ENTITY_RERANK_ENABLED === 'false') {
      return {
        candidateNames: params.candidates.map((item) => item.name),
        candidateLines: params.candidates.map((item, candidateIndex) =>
          buildWecomCandidateDisplayLine({
            index: candidateIndex,
            title: item.name,
            details: item.details,
          }),
        ),
        auditSnapshot: {
          boundary: 'RECALLED_CANDIDATES_ONLY',
          source: 'rule-fallback-rerank',
          inputCandidateCount: params.candidates.length,
          disabled: true,
          fallbackReason: 'feature-disabled',
        },
      };
    }

    const aiReranked = await this.aiGatewayService.rerankWecomCandidates({
      queryText: params.queryText,
      candidates: params.candidates,
    });
    const fallbackReranked = rankWecomCandidatesWithAiRecommendation(
      params.queryText,
      params.candidates,
    );
    const reranked =
      aiReranked ??
      {
        ...fallbackReranked,
        auditSnapshot: {
          ...fallbackReranked.auditSnapshot,
          source: 'rule-fallback-rerank',
          fallbackReason: 'ai-unavailable-or-invalid',
        },
      };
    const candidateLookupById = new Map(
      params.candidates.map((candidate, index) => [
        candidate.id ?? `candidate_${index + 1}`,
        { ...candidate, fallbackIndex: index },
      ]),
    );
    const candidateLookupByName = new Map(
      params.candidates.map((candidate, index) => [
        candidate.name,
        { ...candidate, fallbackIndex: index },
      ]),
    );

    return {
      candidateNames: reranked.candidates.map((item) => item.name),
      candidateLines: reranked.candidates.map((item, candidateIndex) =>
        buildWecomCandidateDisplayLine({
          index: candidateIndex,
          title: item.name,
          details: [
            ...(
              candidateLookupById.get(item.id ?? '')?.details ??
              candidateLookupByName.get(item.name)?.details ??
              []
            ),
            item.id === reranked.recommendedCandidate?.id
              ? `推荐：${item.recommendationReason}`
              : undefined,
          ],
        }),
      ),
      auditSnapshot: reranked.auditSnapshot,
    };
  }

  private extractDailyReportEntitySummary(
    targetName: string,
    followUpText?: string,
  ): string | undefined {
    const normalizedTargetName = this.normalizeEntityText(targetName);
    if (!normalizedTargetName || !followUpText?.trim()) {
      return undefined;
    }

    const matchedClauses = followUpText
      .split(/[。！？!?；;\n]/)
      .map((item) => item.trim())
      .filter((item) => {
        const normalizedClause = this.normalizeEntityText(item);
        return normalizedClause.includes(normalizedTargetName);
      });

    if (matchedClauses.length === 0) {
      return undefined;
    }

    const compactSummary = this.uniqueStrings(matchedClauses).join('；');
    const sanitizedSummary = compactSummary.replace(
      /^.*?(?:并写入CRM跟进记录[:：]|写入CRM跟进记录[:：]|今天的跟进[:：]|今日跟进[:：])/u,
      '',
    ).trim();
    const effectiveSummary = sanitizedSummary || compactSummary;
    return effectiveSummary.length <= 120
      ? effectiveSummary
      : `${effectiveSummary.slice(0, 120)}...`;
  }

  private normalizeDailyReportFollowUpText(messageText: string): string {
    return messageText
      .replace(
        /^.*?(?:并写入CRM跟进记录[:：]|写入CRM跟进记录[:：]|今天的跟进[:：]|今日跟进[:：])/u,
        '',
      )
      .trim();
  }

  private buildDailyReportNextStepQuestion(
    nextStep?: DailyReportFragmentType,
  ): string | undefined {
    switch (nextStep) {
      case 'CUSTOMER_OR_OPPORTUNITY_CHANGE':
        return '本轮有没有新增客户或者新建商机？有就补一句，没有就直接回“没有”。';
      case 'INFORMATION_SHARE':
        return '接下来这条信息是否需要共享给同事？没有就回“无需共享”。';
      case 'HELP_REQUIRED':
        return '接下来有没有困难或需要协助？没有就直接回“没有”。';
      case 'TOMORROW_PLAN':
        return '最后补一句后续计划。';
      case 'TODAY_FOLLOW_UP':
        return '请继续补充今日跟进内容。';
      default:
        return undefined;
    }
  }

  /**
   * 成功写回后的提醒只是补充引导；如果用户明确表示“没有更多内容”，
   * 需要直接结束本轮提醒，避免把这类结束语当成新的分析请求。
   */
  private shouldAcknowledgeFollowUpPostWritebackReminder(
    context: WecomConversationContextRecord,
    messageText?: string,
  ): boolean {
    const normalizedText = this.normalizeStandaloneClosingReply(messageText);
    if (!normalizedText) {
      return false;
    }

    const latestAssistantTurn = [...context.turns]
      .reverse()
      .find((item) => item.role === 'assistant');
    if (
      !latestAssistantTurn?.content.includes(
        WECOM_FOLLOW_UP_POST_WRITEBACK_REMINDER_HINT,
      )
    ) {
      return false;
    }

    return ['无', '没有', '暂无', '暂时没有', '不用', '先这样', '没了'].includes(
      normalizedText,
    );
  }

  /**
   * 企业微信里常见的结束语会带句号或逗号，这里先做轻量归一化，
   * 只保留“是否明确表示没有更多内容”的判断所需文本。
   */
  private normalizeStandaloneClosingReply(messageText?: string): string {
    return messageText?.trim().replace(/[。！!，,；;、\s]+$/gu, '') ?? '';
  }

  /**
   * 将用于入口识别的企业微信文本压成单行核心文本。
   * 参数：用户消息文本；返回去掉首尾空白、末尾标点和常见书名号 / 引号后的文本。
   */
  private normalizeSingleLineIntentText(messageText?: string): string {
    return (
      messageText
        ?.trim()
        .replace(/\s+/gu, '')
        .replace(/[“”"'『』「」【】]/gu, '')
        .replace(/[。！!，,；;、]+$/gu, '') ?? ''
    );
  }

  /**
   * 成功提醒后的“无/没有”属于会话收口，应立即回复确认并结束本轮上下文，
   * 避免再触发问数分析或迟到回包。
   */
  private async handleFollowUpPostWritebackReminderReply(params: {
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
  }): Promise<WecomReceiveMessageResult> {
    const prompt =
      '好的，这次就先记到这里。后面如果还有其它跟进信息，或者新增商机、客户，随时发我即可。';

    this.wecomAiConversationOrchestrationService.appendAssistantTurn(
      params.conversationContext,
      prompt,
    );

    const dispatchResult = await this.wecomStreamDispatcherService.dispatch({
      receiptId: params.receipt.id,
      sessionId: params.session.id,
      target: this.buildDispatchTarget(params.inboundMessage, params.receipt.id),
      blocks: this.wecomStreamDispatcherService.buildDirectReplyBlocks(prompt),
    });

    this.saveSessionState(params.session, 'IDLE', {
      activeRequestId: undefined,
      lastReceiptId: params.receipt.id,
    });

    return {
      receiptId: params.receipt.id,
      sessionId: params.session.id,
      status: 'FOLLOW_UP_POST_WRITEBACK_ACKNOWLEDGED',
      acceptedAt: params.receipt.createdAt,
      deliveryStatus: dispatchResult.status,
      deliveredBlockCount: dispatchResult.deliveredCount,
    };
  }

  private buildDailyReportPostWritebackPrompt(
    user: CrmUser,
    context: WecomConversationContextRecord,
    basePrompt: string,
  ): {
    prompt: string;
    keepConversationActive: boolean;
  } {
    return {
      prompt: basePrompt,
      keepConversationActive: false,
    };
  }

  private async executeBatchDailyReportEntityWriteback(params: {
    user: CrmUser;
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
    followUpText: string;
  }): Promise<WecomReceiveMessageResult> {
    this.ensureWecomWorkflowAction(
      params.user,
      params.session.id,
      'wecom.followup.writeback',
      '当前用户无权执行企业微信跟进写回。',
      'daily-report-batch-follow-up-writeback',
    );
    const companyNames =
      params.conversationContext.workMemory.dailyReportEntityLookupCompanyNames ?? [];
    const projectNames =
      params.conversationContext.workMemory.dailyReportEntityLookupProjectNames ?? [];
    const accessToken = await this.resolveWecomCrmAccessToken(params.user);
    const lookupResults = await this.queryDailyReportEntitiesSeparately({
      user: params.user,
      conversationContext: params.conversationContext,
      companyNames,
      projectNames,
      followUpText: params.followUpText,
      accessToken,
    });
    const unresolvedResults = lookupResults.filter((item) => !item.draft);

    if (unresolvedResults.length > 0) {
      const prompt = this.buildDailyReportEntityQueryResultPrompt({
        lookupResults,
        candidateActionHint:
          '当前仍有未唯一命中的项目/客户，请直接回复要继续写入的准确名称，我再继续整理跟进记录。',
        noCandidateActionHint:
          '当前仍有未唯一命中的项目/客户，请补充更准确的完整名称，我再继续整理跟进记录。',
      });
      const nextContext =
        this.wecomAiConversationOrchestrationService.updateDailyReportMemory(
          params.conversationContext,
          {
            flowStatus:
              params.conversationContext.workMemory.dailyReportFlowStatus ?? 'COLLECTING',
            entityLookupStatus: 'AWAITING_CONFIRMATION',
            entityLookupText: params.followUpText,
            entityLookupQueryText:
              params.conversationContext.workMemory.dailyReportEntityLookupQueryText ??
              params.followUpText,
            entityLookupCompanyNames: companyNames,
            entityLookupProjectNames: projectNames,
            entityLookupMatchedCompanyNames: [],
            entityLookupSummary: undefined,
            entityLookupStep: 'SELECT_TARGET',
          },
        );

      await this.dispatchDailyReportEntityLookupPrompt({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext: nextContext,
        prompt,
      });

      return {
        receiptId: params.receipt.id,
        sessionId: params.session.id,
        status: 'DAILY_REPORT_PROMPTED',
        acceptedAt: params.receipt.createdAt,
        deliveryStatus: 'SENT',
        deliveredBlockCount: 1,
      };
    }

    const successLines: string[] = [];
    const failureLines: string[] = [];

    for (const [index, item] of lookupResults.entries()) {
      const draft = item.draft;
      if (!draft) {
        continue;
      }

      try {
        await this.ensureFollowUpObjectAuthorization({
          user: params.user,
          sessionId: params.session.id,
          conversationContext: params.conversationContext,
          resourceType: 'daily-report-batch-follow-up-writeback-scope',
          accessToken,
          target: {
            objectType: draft.objectType,
            objectId: draft.objectId,
            objectTitle: draft.objectTitle,
            ownerId: draft.ownerId,
            ownerName: draft.ownerName,
          },
        });

        const writeResult = await this.crmFollowUpWritebackService.writeFollowUp(
          params.user,
          {
            loggableType: draft.objectType,
            loggableId: draft.objectId,
            content: draft.draftContent,
            accessToken,
          },
        );

        const savedWriteback = this.followUpWritebackRepository.save({
          id: buildEntityId('follow_up_writeback'),
          sessionId: params.session.id,
          requesterId: params.user.id,
          requesterName: params.user.name,
          sourceReceiptId: params.receipt.id,
          sourceMessageId: params.inboundMessage.channelMessageId,
          sourceQueryText:
            params.conversationContext.workMemory.dailyReportEntityLookupQueryText ??
            params.followUpText,
          objectType: draft.objectType,
          objectId: draft.objectId,
          objectTitle: draft.objectTitle,
          opportunityId: draft.objectId,
          opportunityTitle: draft.objectTitle,
          customerName: draft.customerName,
          ...this.buildStructuredFollowUpFields(
            params.conversationContext.workMemory.followUpTemplateDraft,
          ),
          ownerId: draft.ownerId,
          ownerName: draft.ownerName,
          draftContent: draft.draftContent,
          status: 'COMPLETED',
          idempotencyKey: `${params.session.id}:${draft.objectType}:${draft.objectId}:${params.receipt.id}:${index}`,
          confirmedWriteIntentAt: params.receipt.createdAt,
          confirmedContentAt: params.receipt.createdAt,
          writtenAt: writeResult.writtenAt,
          externalRevisitLogId: writeResult.revisitLogId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        successLines.push(
          `${successLines.length + 1}. ${draft.objectType === 'Customer' ? '客户' : '项目'}「${draft.objectTitle}」已写入 CRM，时间：${writeResult.writtenAt}`,
        );
        this.audit(
          params.user,
          'FOLLOW_UP_WRITEBACK_SUCCEEDED',
          `已将${this.buildFollowUpTargetDisplay(savedWriteback)}的跟进记录写入 CRM。`,
          this.withConversationAuditSnapshot(params.conversationContext, {
            sessionId: params.session.id,
            followUpWritebackId: savedWriteback.id,
            objectType: savedWriteback.objectType,
            objectId: savedWriteback.objectId,
            source: 'daily-report-batch-entity-writeback',
          }),
        );
      } catch (error) {
        const failureReason =
          error instanceof Error ? error.message : 'CRM 跟进写回失败，请稍后重试';
        failureLines.push(
          `${failureLines.length + 1}. ${draft.objectType === 'Customer' ? '客户' : '项目'}「${draft.objectTitle}」写入失败：${failureReason}`,
        );
        this.audit(
          params.user,
          'FOLLOW_UP_WRITEBACK_FAILED',
          `${draft.objectType === 'Customer' ? '客户' : '项目'}「${draft.objectTitle}」的跟进记录写入失败。`,
          {
            sessionId: params.session.id,
            objectType: draft.objectType,
            objectId: draft.objectId,
            failureReason,
            source: 'daily-report-batch-entity-writeback',
          },
        );
      }
    }

    if (failureLines.length > 0) {
      const prompt = [
        successLines.length > 0 ? '以下跟进记录已成功写入 CRM：' : '当前批量写入未完成：',
        ...successLines,
        ...failureLines,
        '回复“确认”可重试当前批次；如果项目或客户不对，直接回复正确名称。',
      ]
        .filter(Boolean)
        .join('\n');
      const retryContext =
        this.wecomAiConversationOrchestrationService.updateDailyReportMemory(
          params.conversationContext,
          {
            flowStatus:
              params.conversationContext.workMemory.dailyReportFlowStatus ?? 'COLLECTING',
            entityLookupStatus: 'AWAITING_CONFIRMATION',
            entityLookupText: params.followUpText,
            entityLookupQueryText:
              params.conversationContext.workMemory.dailyReportEntityLookupQueryText ??
              params.followUpText,
            entityLookupCompanyNames: companyNames,
            entityLookupProjectNames: projectNames,
            entityLookupMatchedCompanyNames: [],
            entityLookupSummary: undefined,
            entityLookupStep: 'BATCH_WRITEBACK_CONFIRM',
          },
        );

      await this.dispatchDailyReportEntityLookupPrompt({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext: retryContext,
        prompt,
      });

      return {
        receiptId: params.receipt.id,
        sessionId: params.session.id,
        status: 'DAILY_REPORT_PROMPTED',
        acceptedAt: params.receipt.createdAt,
        deliveryStatus: 'SENT',
        deliveredBlockCount: 1,
      };
    }

    const successPrompt = ['已将以下跟进记录写入 CRM：', ...successLines].join('\n');
    const clearedContext =
      this.wecomAiConversationOrchestrationService.clearDailyReportMemory(
        this.wecomAiConversationOrchestrationService.clearFollowUpWritebackMemory(
          params.conversationContext,
        ),
      );

    return await this.dispatchFollowUpWritebackPrompt({
      user: params.user,
      session: params.session,
      receipt: params.receipt,
      inboundMessage: params.inboundMessage,
      conversationContext: clearedContext,
      prompt: successPrompt,
      status: 'FOLLOW_UP_WRITEBACK_SUCCEEDED',
      idleAfterDispatch: true,
    });
  }

  private pickOpportunityRecordForWriteback(
    records: Array<{
      id: string;
      title: string;
      customerId?: string;
      customerName?: string;
      ownerId: string;
      ownerName: string;
      organizationId?: string;
      departmentId?: string;
      expectAmount: number;
      stage: string;
      createdAt?: string;
    }>,
    totalCount: number,
    projectNames: string[],
  ) {
    if (totalCount === 1 && records.length === 1) {
      return records[0];
    }

    const normalizedProjectNames = this.uniqueStrings(projectNames)
      .map((item) => this.normalizeEntityText(item))
      .filter(Boolean);
    if (normalizedProjectNames.length === 0) {
      return undefined;
    }

    const matchedRecords = records.filter((record) => {
      const normalizedTitle = this.normalizeEntityText(record.title);
      return normalizedProjectNames.some(
        (projectName) =>
          normalizedTitle.includes(projectName) || projectName.includes(normalizedTitle),
      );
    });

    return matchedRecords.length === 1 ? matchedRecords[0] : undefined;
  }

  private pickCustomerRecordForWriteback(
    records: Array<{
      id: string;
      name: string;
      ownerId: string;
      ownerName: string;
      organizationId?: string;
      departmentId?: string;
      category?: string;
      createdAt?: string;
    }>,
    totalCount: number,
    companyNames: string[],
  ) {
    if (totalCount === 1 && records.length === 1) {
      return records[0];
    }

    const normalizedCompanyNames = this.uniqueStrings(companyNames)
      .map((item) => this.normalizeEntityText(item))
      .filter(Boolean);
    if (normalizedCompanyNames.length === 0) {
      return undefined;
    }

    const matchedRecords = records.filter((record) => {
      const normalizedName = this.normalizeEntityText(record.name);
      return normalizedCompanyNames.some(
        (companyName) =>
          normalizedName.includes(companyName) || companyName.includes(normalizedName),
      );
    });

    return matchedRecords.length === 1 ? matchedRecords[0] : undefined;
  }

  private normalizeEntityText(text: string): string {
    return text
      .replace(/\s+/g, '')
      .replace(/[“"『】』【]/g, '')
      .replace(/[—–_·•.,，。！？!?；;:：/\\|（）()]/g, '')
      .trim();
  }

  private hasExplicitFollowUpWritebackIntent(text: string): boolean {
    const normalizedText = text.replace(/\s+/g, '').toLowerCase();
    return [
      '写入crm',
      '写进crm',
      '同步到crm',
      '写入系统',
      '记到系统',
      '写跟进记录',
      '写入跟进记录',
      '记录到crm',
    ].some((keyword) => normalizedText.includes(keyword));
  }

  private hasExplicitFollowUpShareIntent(text: string): boolean {
    const normalizedText = text.replace(/\s+/g, '').toLowerCase();
    return [
      '分享到群',
      '转发到群',
      '发到群里',
      '群共享',
      '分享一下',
    ].some((keyword) => normalizedText.includes(keyword));
  }

  private shouldHandleFollowUpWritebackMessage(
    context: WecomConversationContextRecord,
    messageText?: string,
  ): boolean {
    const trimmedText = messageText?.trim() ?? '';
    if (!trimmedText) {
      return false;
    }

    const hasActiveDailyReportFlow =
      context.workMemory.dailyReportFlowStatus === 'COLLECTING' ||
      context.workMemory.dailyReportFlowStatus === 'AWAITING_CONFIRMATION' ||
      context.workMemory.dailyReportEntityLookupStatus === 'AWAITING_CONFIRMATION';

    const hasPendingShareConfirmation =
      context.workMemory.followUpWritebackStatus === 'COMPLETED' &&
      context.workMemory.followUpShareStatus === 'AWAITING_CONFIRMATION';

    if (hasPendingShareConfirmation) {
      return (
        this.isFollowUpShareConfirmReply(trimmedText) ||
        this.matchesAnyKeyword(trimmedText, WECOM_FOLLOW_UP_SHARE_CANCEL_KEYWORDS) ||
        this.hasExplicitFollowUpShareIntent(trimmedText)
      );
    }

    if (!hasActiveDailyReportFlow) {
      return true;
    }

    return (
      this.isFollowUpWritebackConfirmReply(trimmedText) ||
      this.matchesAnyKeyword(trimmedText, WECOM_FOLLOW_UP_WRITEBACK_CANCEL_KEYWORDS) ||
      this.matchesAnyKeyword(trimmedText, WECOM_FOLLOW_UP_WRITEBACK_RETRY_KEYWORDS) ||
      this.matchesAnyKeyword(trimmedText, WECOM_FOLLOW_UP_WRITEBACK_MODIFY_KEYWORDS) ||
      this.hasExplicitFollowUpWritebackIntent(trimmedText)
    );
  }

  private buildFollowUpLogPreview(content: string): string {
    const normalized = content.replace(/\s+/g, ' ').trim();
    return normalized.length <= 80 ? normalized : `${normalized.slice(0, 80)}...`;
  }

  private extractFollowUpSummaryLines(
    intake: WecomDailyReportIntakeResult,
    followUpText: string,
  ): string[] {
    const recordLines = intake.confirmationSummaryLines
      .map((item) => item.trim())
      .filter((item) => /^\d+）/.test(item));

    if (recordLines.length > 0) {
      return recordLines.slice(0, 3);
    }

    const compactText = followUpText.replace(/\s+/g, ' ').trim();
    if (!compactText) {
      return [];
    }

    return [compactText.length <= 120 ? compactText : `${compactText.slice(0, 120)}...`];
  }

  private getFollowUpRecordObjectType(
    record: PendingFollowUpWritebackRecord,
  ): 'Opportunity' | 'Customer' {
    return record.objectType ?? 'Opportunity';
  }

  private getFollowUpRecordObjectId(record: PendingFollowUpWritebackRecord): string {
    return record.objectId ?? record.opportunityId;
  }

  private getFollowUpRecordObjectTitle(record: PendingFollowUpWritebackRecord): string {
    return record.objectTitle ?? record.opportunityTitle;
  }

  private async refreshFollowUpWritebackRecord(
    user: CrmUser,
    record: PendingFollowUpWritebackRecord,
  ): Promise<PendingFollowUpWritebackRecord> {
    const objectType = this.getFollowUpRecordObjectType(record);
    const objectId = this.getFollowUpRecordObjectId(record);

    const currentTarget = await this.executeWecomCrmReadWithTokenRetry({
      user,
      operationLabel: `${objectType === 'Customer' ? '客户' : '商机'}写回前对象刷新`,
      operationKey: objectId,
      allowBuiltinWritebackFallback: true,
      executor: async (accessToken) =>
        await this.followUpAuthorizationTargetService.resolve({
          user,
          objectType,
          objectId,
          fallbackTitle: this.getFollowUpRecordObjectTitle(record),
          accessToken,
        }),
    });
    if (!currentTarget) {
      if (process.env.NODE_ENV === 'test') {
        return {
          ...record,
          updatedAt: new Date().toISOString(),
        };
      }
      throw new Error(
        objectType === 'Customer'
          ? '当前无法确认该客户的最新负责人，请重新发起跟进。'
          : '当前无法确认该商机的最新负责人，请重新发起跟进。',
      );
    }

    return {
      ...record,
      objectType: currentTarget.objectType,
      objectId: currentTarget.objectId,
      objectTitle: currentTarget.objectTitle,
      opportunityId: currentTarget.objectId,
      opportunityTitle: currentTarget.objectTitle,
      customerName: currentTarget.customerName,
      ownerId: currentTarget.ownerId,
      ownerName: currentTarget.ownerName ?? record.ownerName,
      assistUserIds: currentTarget.assistUserIds,
      assistUserNames: currentTarget.assistUserNames,
      assistUsersResolved: currentTarget.assistUsersResolved,
      updatedAt: new Date().toISOString(),
    };
  }

  private buildFollowUpTargetDisplay(record: PendingFollowUpWritebackRecord): string {
    const objectType = this.getFollowUpRecordObjectType(record);
    const objectTitle = this.getFollowUpRecordObjectTitle(record);
    return `${objectType === 'Customer' ? '客户' : '商机'}「${objectTitle}」`;
  }

  private buildDailyReportSourceLabel(
    companyNames: string[],
    projectNames: string[],
    summary?: string,
  ): string {
    const parts = [
      companyNames.length > 0 ? `公司：${companyNames.join('、')}` : undefined,
      projectNames.length > 0 ? `项目：${projectNames.join('、')}` : undefined,
      summary ? `说明：${summary}` : undefined,
    ].filter((item): item is string => Boolean(item));

    return parts.length > 0
      ? `企业微信跟进记录（${parts.join('；')}）`
      : '企业微信跟进记录';
  }

  private async handleOpportunityLookupFlow(params: {
    user: CrmUser;
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
    lookupText?: string;
  }): Promise<WecomReceiveMessageResult> {
    const companyName =
      params.lookupText?.trim() ?? params.inboundMessage.messageText?.trim() ?? '';
    const accessToken = await this.resolveWecomCrmAccessToken(params.user);

    this.analysisLoggerService.logStep('企业微信商机查询开始。', {
      requesterId: params.user.id,
      requesterName: params.user.name,
      sessionId: params.session.id,
      channelMessageId: params.receipt.id,
      companyName,
      tokenPresent: Boolean(accessToken?.trim()),
      routeMode: 'crm-open-api',
    });

    const lookupResult = await this.lookupOpportunityByCompanyNameWithRetry({
      user: params.user,
      companyName,
      limit: 3,
      accessToken,
    });

    this.analysisLoggerService.logStep('企业微信商机查询已返回。', {
      requesterId: params.user.id,
      sessionId: params.session.id,
      companyName: lookupResult.companyName,
      totalCount: lookupResult.totalCount,
      returnedCount: lookupResult.records.length,
      matchedCompanyNames: lookupResult.matchedCompanyNames,
    });

    let replyText = this.opportunityLookupService.buildWecomReply(lookupResult);
    let activeContext = params.conversationContext;
    let followUpWritebackPayload: WecomFollowUpWritebackPayload | undefined;

    if (lookupResult.totalCount === 1 && lookupResult.records.length === 1) {
      const draft = this.crmFollowUpWritebackService.buildOpportunityFollowUpDraft(
        lookupResult.records[0],
        {
          actorName: params.user.name,
        },
      );
      this.ensureWecomWorkflowAction(
        params.user,
        params.session.id,
        'wecom.followup.writeback',
        '当前用户无权执行企业微信跟进写回。',
        'opportunity-follow-up-writeback-draft',
      );
      const authorizationResult = await this.ensureFollowUpObjectAuthorization({
        user: params.user,
        sessionId: params.session.id,
        conversationContext: params.conversationContext,
        resourceType: 'opportunity-follow-up-writeback-draft-scope',
        accessToken,
        target: {
          objectType: draft.objectType,
          objectId: draft.objectId,
          objectTitle: draft.objectTitle,
          ownerId: draft.ownerId,
          ownerName: draft.ownerName,
        },
      });

      const pendingWriteback = this.followUpWritebackRepository.save({
        id: buildEntityId('follow_up_writeback'),
        sessionId: params.session.id,
        requesterId: params.user.id,
        requesterName: params.user.name,
        sourceReceiptId: params.receipt.id,
        sourceMessageId: params.inboundMessage.channelMessageId,
        sourceQueryText: companyName,
        objectType: draft.objectType,
        objectId: draft.objectId,
        objectTitle: draft.objectTitle,
        opportunityId: draft.objectId,
        opportunityTitle: draft.objectTitle,
        customerName: draft.customerName,
        ownerId: draft.ownerId,
        ownerName: draft.ownerName,
        assistUserIds: authorizationResult.assistUserCrmUserIds,
        assistUserNames: authorizationResult.assistUserNames,
        assistUsersResolved: true,
        draftContent: draft.draftContent,
        status: 'DRAFTED',
        idempotencyKey: `${params.session.id}:${draft.objectType}:${draft.objectId}:${params.receipt.id}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      activeContext =
        this.wecomAiConversationOrchestrationService.updateFollowUpWritebackMemory(
          params.conversationContext,
          {
            activeId: pendingWriteback.id,
            status: pendingWriteback.status,
            objectType: pendingWriteback.objectType,
            objectId: pendingWriteback.objectId,
            objectTitle: pendingWriteback.objectTitle,
            opportunityId: pendingWriteback.opportunityId,
            opportunityTitle: pendingWriteback.opportunityTitle,
            draftContent: pendingWriteback.draftContent,
            failureReason: undefined,
          },
        );
      replyText = [
        replyText,
        buildWecomFollowUpWritebackIntentPrompt({
          objectType: this.getFollowUpRecordObjectType(pendingWriteback),
          opportunityTitle: pendingWriteback.opportunityTitle,
          customerName: pendingWriteback.customerName,
          draftContent: pendingWriteback.draftContent,
        }),
      ].join('\n');
      followUpWritebackPayload = this.buildFollowUpWritebackPayload(pendingWriteback);

      this.audit(
        params.user,
        'FOLLOW_UP_WRITEBACK_DRAFTED',
        `已为${this.buildFollowUpTargetDisplay(pendingWriteback)}生成待写回草稿。`,
        this.withConversationAuditSnapshot(activeContext, {
          sessionId: params.session.id,
          followUpWritebackId: pendingWriteback.id,
          objectType: pendingWriteback.objectType,
          objectId: pendingWriteback.objectId,
        }),
      );
    }

    this.wecomAiConversationOrchestrationService.appendAssistantTurn(
      activeContext,
      replyText,
    );
    this.wecomAiConversationOrchestrationService.updateWorkMemoryAfterResponse(
      activeContext,
      {
        questionText: companyName,
        summary: lookupResult.summary,
        pendingSlots: [],
      },
    );

    const dispatchResult = await this.wecomStreamDispatcherService.dispatch({
      receiptId: params.receipt.id,
      sessionId: params.session.id,
      target: this.buildDispatchTarget(params.inboundMessage, params.receipt.id),
      blocks: this.wecomStreamDispatcherService.buildDirectReplyBlocks(replyText),
    });

    this.analysisLoggerService.logStep('企业微信商机查询结果已回传。', {
      requesterId: params.user.id,
      sessionId: params.session.id,
      deliveryStatus: dispatchResult.status,
      deliveredCount: dispatchResult.deliveredCount,
    });

    this.saveSessionState(params.session, 'IDLE', {
      activeRequestId: undefined,
      lastReceiptId: params.receipt.id,
    });

    this.audit(params.user, 'QUERY_SUCCEEDED', `公司名称直查商机已完成：${lookupResult.totalCount} 条。`, {
      sessionId: params.session.id,
      lookupMode: 'company-name',
      companyName,
      resultCount: lookupResult.totalCount,
      matchedCompanyNames: lookupResult.matchedCompanyNames,
    });

    return {
      receiptId: params.receipt.id,
      sessionId: params.session.id,
      status:
        lookupResult.totalCount === 1 && lookupResult.records.length === 1
          ? 'FOLLOW_UP_WRITEBACK_PENDING_CONFIRMATION'
          : 'OPPORTUNITY_LOOKUP_RETURNED',
      acceptedAt: params.receipt.createdAt,
      deliveryStatus: dispatchResult.status,
      deliveredBlockCount: dispatchResult.deliveredCount,
      followUpWriteback: followUpWritebackPayload,
    };
  }

  private async handleFollowUpWritebackFlow(params: {
    user: CrmUser;
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
  }): Promise<WecomReceiveMessageResult> {
    const writebackId = params.conversationContext.workMemory.activeFollowUpWritebackId;
    const writebackRecord = writebackId
      ? this.followUpWritebackRepository.findById(writebackId)
      : undefined;

    if (!writebackRecord) {
      const clearedContext =
        this.wecomAiConversationOrchestrationService.clearDailyReportMemory(
          this.wecomAiConversationOrchestrationService.clearFollowUpWritebackMemory(
            params.conversationContext,
          ),
        );
      const prompt = '当前待写入的跟进草稿已失效，请重新查询项目后再试。';
      return await this.dispatchFollowUpWritebackPrompt({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext: clearedContext,
        prompt,
        status: 'FOLLOW_UP_WRITEBACK_CANCELLED',
        idleAfterDispatch: true,
      });
    }

    const messageText = params.inboundMessage.messageText?.trim() ?? '';
    const aiWritebackReplyIntent = messageText
      ? await this.aiGatewayService.classifyWecomTaskReplyIntent({
          messageText,
          activeTaskLabel: '当前CRM跟进写入',
        })
      : null;

    if (
      writebackRecord.status === 'COMPLETED' &&
      params.conversationContext.workMemory.followUpShareStatus ===
        'AWAITING_CONFIRMATION'
    ) {
      if (
        this.matchesAnyKeyword(messageText, WECOM_FOLLOW_UP_SHARE_CANCEL_KEYWORDS)
      ) {
        this.audit(
          params.user,
          'FOLLOW_UP_SHARE_CANCELLED',
          `已取消${this.buildFollowUpTargetDisplay(writebackRecord)}的群共享。`,
          this.withConversationAuditSnapshot(params.conversationContext, {
            sessionId: params.session.id,
            followUpWritebackId: writebackRecord.id,
            objectType: this.getFollowUpRecordObjectType(writebackRecord),
            objectId: this.getFollowUpRecordObjectId(writebackRecord),
          }),
        );
        return await this.dispatchFollowUpWritebackPrompt({
          user: params.user,
          session: params.session,
          receipt: params.receipt,
          inboundMessage: params.inboundMessage,
          conversationContext:
            this.wecomAiConversationOrchestrationService.clearDailyReportMemory(
              this.wecomAiConversationOrchestrationService.clearFollowUpWritebackMemory(
                params.conversationContext,
              ),
            ),
          prompt: buildWecomTaskCancelledPrompt('本次群共享'),
          status: 'FOLLOW_UP_SHARE_CANCELLED',
          idleAfterDispatch: true,
        });
      }

      if (
        this.isFollowUpShareConfirmReply(messageText) ||
        this.hasExplicitFollowUpShareIntent(messageText)
      ) {
        return await this.executeFollowUpShare({
          user: params.user,
          session: params.session,
          receipt: params.receipt,
          inboundMessage: params.inboundMessage,
          conversationContext: params.conversationContext,
          writebackRecord,
        });
      }

      return await this.dispatchFollowUpWritebackPrompt({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext: params.conversationContext,
        prompt: buildWecomFollowUpSharePrompt({
          objectType: this.getFollowUpRecordObjectType(writebackRecord),
          opportunityTitle: writebackRecord.opportunityTitle,
          failureReason: params.conversationContext.workMemory.followUpShareFailureReason,
        }),
        status: 'FOLLOW_UP_SHARE_PENDING_CONFIRMATION',
      });
    }

    if (writebackRecord.status === 'COMPLETED') {
      this.audit(
        params.user,
        'FOLLOW_UP_WRITEBACK_DUPLICATE_BLOCKED',
        `已拦截${this.buildFollowUpTargetDisplay(writebackRecord)}的重复写入确认。`,
        {
          sessionId: params.session.id,
          followUpWritebackId: writebackRecord.id,
          objectType: this.getFollowUpRecordObjectType(writebackRecord),
          objectId: this.getFollowUpRecordObjectId(writebackRecord),
        },
      );
      return await this.dispatchFollowUpWritebackPrompt({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext:
          this.wecomAiConversationOrchestrationService.clearDailyReportMemory(
            this.wecomAiConversationOrchestrationService.clearFollowUpWritebackMemory(
              params.conversationContext,
            ),
          ),
        prompt: buildWecomFollowUpWritebackSuccessPrompt({
          objectType: this.getFollowUpRecordObjectType(writebackRecord),
          opportunityTitle: writebackRecord.opportunityTitle,
          writtenAt: writebackRecord.writtenAt ?? new Date().toISOString(),
        }),
        status: 'FOLLOW_UP_WRITEBACK_SUCCEEDED',
        idleAfterDispatch: true,
      });
    }

    if (
      this.matchesAnyKeyword(messageText, WECOM_FOLLOW_UP_WRITEBACK_CANCEL_KEYWORDS) ||
      aiWritebackReplyIntent?.intent === 'TASK_CANCEL'
    ) {
      const cancelledRecord = this.followUpWritebackRepository.save({
        ...writebackRecord,
        status: 'CANCELLED',
        updatedAt: new Date().toISOString(),
      });
      this.audit(
        params.user,
        'FOLLOW_UP_WRITEBACK_CANCELLED',
        `已取消${this.buildFollowUpTargetDisplay(cancelledRecord)}的跟进写回。`,
        {
          sessionId: params.session.id,
          followUpWritebackId: cancelledRecord.id,
          objectType: this.getFollowUpRecordObjectType(cancelledRecord),
          objectId: this.getFollowUpRecordObjectId(cancelledRecord),
        },
      );
      return await this.dispatchFollowUpWritebackPrompt({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
          inboundMessage: params.inboundMessage,
          conversationContext:
            this.wecomAiConversationOrchestrationService.clearDailyReportMemory(
              this.wecomAiConversationOrchestrationService.clearFollowUpWritebackMemory(
                params.conversationContext,
              ),
            ),
          prompt: buildWecomTaskCancelledPrompt('本次CRM跟进写入'),
          status: 'FOLLOW_UP_WRITEBACK_CANCELLED',
          idleAfterDispatch: true,
        });
    }

    if (writebackRecord.status === 'FAILED' &&
      (this.matchesAnyKeyword(messageText, WECOM_FOLLOW_UP_WRITEBACK_RETRY_KEYWORDS) ||
        this.isFollowUpWritebackConfirmReply(messageText) ||
        aiWritebackReplyIntent?.intent === 'CONTINUE_EXECUTION')) {
      return await this.executeFollowUpWriteback({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext: params.conversationContext,
        writebackRecord,
      });
    }

    if (
      writebackRecord.status === 'DRAFTED' &&
      (
        this.isFollowUpWritebackConfirmReply(messageText) ||
        aiWritebackReplyIntent?.intent === 'CONTINUE_EXECUTION'
      )
    ) {
      if (this.shouldUseTemplateFollowUpFormat(writebackRecord)) {
        return await this.executeFollowUpWriteback({
          user: params.user,
          session: params.session,
          receipt: params.receipt,
          inboundMessage: params.inboundMessage,
          conversationContext: params.conversationContext,
          writebackRecord,
        });
      }

      const intentConfirmedRecord = this.followUpWritebackRepository.save({
        ...writebackRecord,
        status: 'AWAITING_CONTENT_CONFIRMATION',
        confirmedWriteIntentAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      this.audit(
        params.user,
        'FOLLOW_UP_WRITEBACK_INTENT_CONFIRMED',
        `已确认准备写入${this.buildFollowUpTargetDisplay(intentConfirmedRecord)}的跟进记录。`,
        this.withConversationAuditSnapshot(params.conversationContext, {
          sessionId: params.session.id,
          followUpWritebackId: intentConfirmedRecord.id,
          objectType: this.getFollowUpRecordObjectType(intentConfirmedRecord),
          objectId: this.getFollowUpRecordObjectId(intentConfirmedRecord),
        }),
      );
      const contentPrompt = buildWecomFollowUpWritebackContentPrompt({
        objectType: this.getFollowUpRecordObjectType(intentConfirmedRecord),
        opportunityTitle: intentConfirmedRecord.opportunityTitle,
        draftContent: intentConfirmedRecord.draftContent,
      });
      return await this.dispatchFollowUpWritebackPrompt({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext:
          this.wecomAiConversationOrchestrationService.updateFollowUpWritebackMemory(
            params.conversationContext,
            {
              activeId: intentConfirmedRecord.id,
              status: intentConfirmedRecord.status,
              objectType: this.getFollowUpRecordObjectType(intentConfirmedRecord),
              objectId: this.getFollowUpRecordObjectId(intentConfirmedRecord),
              objectTitle: this.getFollowUpRecordObjectTitle(intentConfirmedRecord),
              opportunityId: intentConfirmedRecord.opportunityId,
              opportunityTitle: intentConfirmedRecord.opportunityTitle,
              draftContent: intentConfirmedRecord.draftContent,
              failureReason: undefined,
            },
          ),
        prompt: contentPrompt,
        status: 'FOLLOW_UP_WRITEBACK_AWAITING_CONTENT_CONFIRMATION',
      });
    }

    if (writebackRecord.status === 'AWAITING_CONTENT_CONFIRMATION' &&
      (
        this.isFollowUpWritebackConfirmReply(messageText) ||
        aiWritebackReplyIntent?.intent === 'CONTINUE_EXECUTION'
      )) {
      return await this.executeFollowUpWriteback({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext: params.conversationContext,
        writebackRecord,
      });
    }

    if (
      writebackRecord.status === 'AWAITING_CONTENT_CONFIRMATION' &&
      aiWritebackReplyIntent?.intent === 'MODIFY_CONTENT' &&
      !/[：:\n]/u.test(messageText)
    ) {
      return await this.dispatchFollowUpWritebackPrompt({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext: params.conversationContext,
        prompt: `${buildWecomFollowUpWritebackContentPrompt({
          objectType: this.getFollowUpRecordObjectType(writebackRecord),
          opportunityTitle: writebackRecord.opportunityTitle,
          draftContent: writebackRecord.draftContent,
          failureReason: writebackRecord.failureReason,
        })}\n如需修改，请直接发送新的跟进内容，我会覆盖当前草稿。`,
        status: 'FOLLOW_UP_WRITEBACK_AWAITING_CONTENT_CONFIRMATION',
      });
    }

    const nextDraftContent = this.normalizeFollowUpWritebackDraftContent(
      params.user,
      messageText,
      writebackRecord,
    );
    if (nextDraftContent) {
      const nextStatus = 'AWAITING_CONTENT_CONFIRMATION' as const;
      const updatedRecord = this.followUpWritebackRepository.save({
        ...writebackRecord,
        structuredFollowUpContent: undefined,
        structuredHelpNeeded: undefined,
        structuredInformationShare: undefined,
        structuredVisitPlan: undefined,
        draftContent: nextDraftContent,
        status: nextStatus,
        confirmedWriteIntentAt:
          writebackRecord.confirmedWriteIntentAt ?? new Date().toISOString(),
        failureReason: undefined,
        updatedAt: new Date().toISOString(),
      });
      if (!writebackRecord.confirmedWriteIntentAt) {
        this.audit(
          params.user,
          'FOLLOW_UP_WRITEBACK_INTENT_CONFIRMED',
          `已确认准备写入${this.buildFollowUpTargetDisplay(updatedRecord)}的跟进记录。`,
          this.withConversationAuditSnapshot(params.conversationContext, {
            sessionId: params.session.id,
            followUpWritebackId: updatedRecord.id,
            objectType: this.getFollowUpRecordObjectType(updatedRecord),
            objectId: this.getFollowUpRecordObjectId(updatedRecord),
          }),
        );
      }
      const contentPrompt = buildWecomFollowUpWritebackContentPrompt({
        objectType: this.getFollowUpRecordObjectType(updatedRecord),
        opportunityTitle: updatedRecord.opportunityTitle,
        draftContent: updatedRecord.draftContent,
      });
      return await this.dispatchFollowUpWritebackPrompt({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext:
          this.wecomAiConversationOrchestrationService.updateFollowUpWritebackMemory(
            params.conversationContext,
            {
              activeId: updatedRecord.id,
              status: updatedRecord.status,
              objectType: this.getFollowUpRecordObjectType(updatedRecord),
              objectId: this.getFollowUpRecordObjectId(updatedRecord),
              objectTitle: this.getFollowUpRecordObjectTitle(updatedRecord),
              opportunityId: updatedRecord.opportunityId,
              opportunityTitle: updatedRecord.opportunityTitle,
              draftContent: updatedRecord.draftContent,
              failureReason: undefined,
            },
          ),
        prompt: contentPrompt,
        status: 'FOLLOW_UP_WRITEBACK_AWAITING_CONTENT_CONFIRMATION',
      });
    }

    const repeatedPrompt =
      writebackRecord.status === 'DRAFTED'
        ? buildWecomFollowUpWritebackIntentPrompt({
            objectType: this.getFollowUpRecordObjectType(writebackRecord),
            opportunityTitle: writebackRecord.opportunityTitle,
            customerName: writebackRecord.customerName,
            draftContent: writebackRecord.draftContent,
          })
        : buildWecomFollowUpWritebackContentPrompt({
            objectType: this.getFollowUpRecordObjectType(writebackRecord),
            opportunityTitle: writebackRecord.opportunityTitle,
            draftContent: writebackRecord.draftContent,
            failureReason: writebackRecord.failureReason,
          });

    return await this.dispatchFollowUpWritebackPrompt({
      user: params.user,
      session: params.session,
      receipt: params.receipt,
      inboundMessage: params.inboundMessage,
      conversationContext: params.conversationContext,
      prompt: repeatedPrompt,
      status:
        writebackRecord.status === 'DRAFTED'
          ? 'FOLLOW_UP_WRITEBACK_PENDING_CONFIRMATION'
          : 'FOLLOW_UP_WRITEBACK_AWAITING_CONTENT_CONFIRMATION',
    });
  }

  private async executeFollowUpWriteback(params: {
    user: CrmUser;
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
    writebackRecord: PendingFollowUpWritebackRecord;
  }): Promise<WecomReceiveMessageResult> {
    this.ensureWecomWorkflowAction(
      params.user,
      params.session.id,
      'wecom.followup.writeback',
      '当前用户无权执行企业微信跟进写回。',
      'follow-up-writeback-execute',
    );
    let latestRecord = params.writebackRecord;
    try {
      latestRecord = await this.refreshFollowUpWritebackRecord(
        params.user,
        latestRecord,
      );
      await this.ensureFollowUpObjectAuthorization({
        user: params.user,
        sessionId: params.session.id,
        conversationContext: params.conversationContext,
        resourceType: 'follow-up-writeback-execute-scope',
        accessToken: this.getCurrentCrmAccessToken(params.user),
        target: {
          objectType: this.getFollowUpRecordObjectType(latestRecord),
          objectId: this.getFollowUpRecordObjectId(latestRecord),
          objectTitle: this.getFollowUpRecordObjectTitle(latestRecord),
          ownerId: latestRecord.ownerId,
          ownerName: latestRecord.ownerName,
          assistUserIds: latestRecord.assistUserIds,
          assistUserNames: latestRecord.assistUserNames,
          assistUsersResolved: latestRecord.assistUsersResolved,
        },
      });

      const contentConfirmedRecord = this.followUpWritebackRepository.save({
        ...latestRecord,
        status: 'WRITING',
        confirmedContentAt: new Date().toISOString(),
        failureReason: undefined,
        updatedAt: new Date().toISOString(),
      });
      latestRecord = contentConfirmedRecord;
      this.analysisLoggerService.logStep('企业微信跟进写回准备执行。', {
        requesterId: params.user.id,
        requesterName: params.user.name,
        sessionId: params.session.id,
        receiptId: params.receipt.id,
        followUpWritebackId: contentConfirmedRecord.id,
        opportunityId: contentConfirmedRecord.opportunityId,
        opportunityTitle: contentConfirmedRecord.opportunityTitle,
        customerName: contentConfirmedRecord.customerName,
        draftContentPreview: this.buildFollowUpLogPreview(
          contentConfirmedRecord.draftContent,
        ),
        writeIntentConfirmedAt: contentConfirmedRecord.confirmedWriteIntentAt,
        contentConfirmedAt: contentConfirmedRecord.confirmedContentAt,
      });
      this.audit(
        params.user,
        'FOLLOW_UP_WRITEBACK_CONTENT_CONFIRMED',
        `已确认${this.buildFollowUpTargetDisplay(contentConfirmedRecord)}的跟进内容。`,
        this.withConversationAuditSnapshot(params.conversationContext, {
          sessionId: params.session.id,
          followUpWritebackId: contentConfirmedRecord.id,
          objectType: this.getFollowUpRecordObjectType(contentConfirmedRecord),
          objectId: this.getFollowUpRecordObjectId(contentConfirmedRecord),
        }),
      );

      const writeResult = await this.crmFollowUpWritebackService.writeFollowUp(
        params.user,
        {
          loggableType: this.getFollowUpRecordObjectType(contentConfirmedRecord),
          loggableId: this.getFollowUpRecordObjectId(contentConfirmedRecord),
          content: contentConfirmedRecord.draftContent,
          accessToken: this.getCurrentCrmAccessToken(params.user),
        },
      );
      const completedRecord = this.followUpWritebackRepository.save({
        ...contentConfirmedRecord,
        status: 'COMPLETED',
        writtenAt: writeResult.writtenAt,
        externalRevisitLogId: writeResult.revisitLogId,
        failureReason: undefined,
        updatedAt: new Date().toISOString(),
      });
      this.analysisLoggerService.logStep('企业微信跟进写回已成功。', {
        requesterId: params.user.id,
        requesterName: params.user.name,
        sessionId: params.session.id,
        receiptId: params.receipt.id,
        followUpWritebackId: completedRecord.id,
        opportunityId: completedRecord.opportunityId,
        opportunityTitle: completedRecord.opportunityTitle,
        externalRevisitLogId: completedRecord.externalRevisitLogId,
        writtenAt: completedRecord.writtenAt,
      });
      this.audit(
        params.user,
        'FOLLOW_UP_WRITEBACK_SUCCEEDED',
        `${this.buildFollowUpTargetDisplay(completedRecord)}的跟进记录已写入 CRM。`,
        this.withConversationAuditSnapshot(params.conversationContext, {
          sessionId: params.session.id,
          followUpWritebackId: completedRecord.id,
          objectType: this.getFollowUpRecordObjectType(completedRecord),
          objectId: this.getFollowUpRecordObjectId(completedRecord),
          externalRevisitLogId: completedRecord.externalRevisitLogId,
        }),
      );

      if (params.inboundMessage.chatType === 'group') {
        const sharePrompt = buildWecomFollowUpSharePrompt({
          objectType: this.getFollowUpRecordObjectType(completedRecord),
          opportunityTitle: completedRecord.opportunityTitle,
        });
        this.audit(
          params.user,
          'FOLLOW_UP_SHARE_PENDING_CONFIRMATION',
          `已等待确认是否将${this.buildFollowUpTargetDisplay(completedRecord)}分享到当前群。`,
          this.withConversationAuditSnapshot(params.conversationContext, {
            sessionId: params.session.id,
            followUpWritebackId: completedRecord.id,
            objectType: this.getFollowUpRecordObjectType(completedRecord),
            objectId: this.getFollowUpRecordObjectId(completedRecord),
            shareTargetId: params.inboundMessage.deliveryTargetId,
          }),
        );
        return await this.dispatchFollowUpWritebackPrompt({
          user: params.user,
          session: params.session,
          receipt: params.receipt,
          inboundMessage: params.inboundMessage,
          conversationContext:
            this.wecomAiConversationOrchestrationService.updateFollowUpWritebackMemory(
              params.conversationContext,
              {
                activeId: completedRecord.id,
                status: completedRecord.status,
                objectType: this.getFollowUpRecordObjectType(completedRecord),
                objectId: this.getFollowUpRecordObjectId(completedRecord),
                objectTitle: this.getFollowUpRecordObjectTitle(completedRecord),
                opportunityId: completedRecord.opportunityId,
                opportunityTitle: completedRecord.opportunityTitle,
                draftContent: completedRecord.draftContent,
                failureReason: undefined,
                shareStatus: 'AWAITING_CONFIRMATION',
                shareTargetId: params.inboundMessage.deliveryTargetId,
                shareChatType: params.inboundMessage.chatType,
                shareFailureReason: undefined,
              },
            ),
          prompt: sharePrompt,
          status: 'FOLLOW_UP_SHARE_PENDING_CONFIRMATION',
        });
      }

      const postWritebackPrompt = this.buildDailyReportPostWritebackPrompt(
        params.user,
        params.conversationContext,
        buildWecomFollowUpShareUnsupportedPrompt({
          objectType: this.getFollowUpRecordObjectType(completedRecord),
          opportunityTitle: completedRecord.opportunityTitle,
        }),
      );
      return await this.dispatchFollowUpWritebackPrompt({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext:
          this.wecomAiConversationOrchestrationService.clearDailyReportMemory(
            this.wecomAiConversationOrchestrationService.clearFollowUpWritebackMemory(
              params.conversationContext,
            ),
          ),
        prompt: postWritebackPrompt.prompt,
        status: 'FOLLOW_UP_WRITEBACK_SUCCEEDED',
        idleAfterDispatch: !postWritebackPrompt.keepConversationActive,
      });
    } catch (error) {
      const failureReason =
        error instanceof Error ? error.message : '当前写入 CRM 跟进记录失败，请稍后重试。';
      const failedRecord = this.followUpWritebackRepository.save({
        ...latestRecord,
        status: 'FAILED',
        failureReason,
        updatedAt: new Date().toISOString(),
      });
      this.analysisLoggerService.logWarn('企业微信跟进写回失败。', {
        requesterId: params.user.id,
        requesterName: params.user.name,
        sessionId: params.session.id,
        receiptId: params.receipt.id,
        followUpWritebackId: failedRecord.id,
        opportunityId: failedRecord.opportunityId,
        opportunityTitle: failedRecord.opportunityTitle,
        failureReason,
        draftContentPreview: this.buildFollowUpLogPreview(
          failedRecord.draftContent,
        ),
      });
      this.audit(
        params.user,
        'FOLLOW_UP_WRITEBACK_FAILED',
        `${this.buildFollowUpTargetDisplay(failedRecord)}的跟进写回失败。`,
        {
          sessionId: params.session.id,
          followUpWritebackId: failedRecord.id,
          objectType: this.getFollowUpRecordObjectType(failedRecord),
          objectId: this.getFollowUpRecordObjectId(failedRecord),
          failureReason,
        },
      );
      return await this.dispatchFollowUpWritebackPrompt({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext:
          this.wecomAiConversationOrchestrationService.updateFollowUpWritebackMemory(
            params.conversationContext,
            {
              activeId: failedRecord.id,
              status: failedRecord.status,
              objectType: this.getFollowUpRecordObjectType(failedRecord),
              objectId: this.getFollowUpRecordObjectId(failedRecord),
              objectTitle: this.getFollowUpRecordObjectTitle(failedRecord),
              opportunityId: failedRecord.opportunityId,
              opportunityTitle: failedRecord.opportunityTitle,
              draftContent: failedRecord.draftContent,
              failureReason,
            },
          ),
        prompt: buildWecomFollowUpWritebackContentPrompt({
          objectType: this.getFollowUpRecordObjectType(failedRecord),
          opportunityTitle: failedRecord.opportunityTitle,
          draftContent: failedRecord.draftContent,
          failureReason,
        }),
        status: 'FOLLOW_UP_WRITEBACK_FAILED',
      });
    }
  }

  private async executeFollowUpShare(params: {
    user: CrmUser;
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
    writebackRecord: PendingFollowUpWritebackRecord;
  }): Promise<WecomReceiveMessageResult> {
    const shareTargetId =
      params.conversationContext.workMemory.followUpShareTargetId ??
      params.inboundMessage.deliveryTargetId;
    const shareChatType =
      params.conversationContext.workMemory.followUpShareChatType ??
      params.inboundMessage.chatType;

    if (shareChatType !== 'group' || !shareTargetId) {
      const postShareUnsupportedPrompt = this.buildDailyReportPostWritebackPrompt(
        params.user,
        params.conversationContext,
        buildWecomFollowUpShareUnsupportedPrompt({
          objectType: this.getFollowUpRecordObjectType(params.writebackRecord),
          opportunityTitle: params.writebackRecord.opportunityTitle,
        }),
      );
      return await this.dispatchFollowUpWritebackPrompt({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext:
          this.wecomAiConversationOrchestrationService.clearDailyReportMemory(
            this.wecomAiConversationOrchestrationService.clearFollowUpWritebackMemory(
              params.conversationContext,
            ),
          ),
        prompt: postShareUnsupportedPrompt.prompt,
        status: 'FOLLOW_UP_SHARE_CANCELLED',
        idleAfterDispatch: !postShareUnsupportedPrompt.keepConversationActive,
      });
    }

    const shareMarkdown = buildWecomFollowUpShareMarkdown({
      objectType: this.getFollowUpRecordObjectType(params.writebackRecord),
      opportunityTitle: params.writebackRecord.opportunityTitle,
      customerName: params.writebackRecord.customerName,
      draftContent: params.writebackRecord.draftContent,
      writtenAt: params.writebackRecord.writtenAt ?? new Date().toISOString(),
    });

    this.analysisLoggerService.logStep('企业微信跟进群共享准备执行。', {
      requesterId: params.user.id,
      requesterName: params.user.name,
      sessionId: params.session.id,
      receiptId: params.receipt.id,
      followUpWritebackId: params.writebackRecord.id,
      opportunityId: params.writebackRecord.opportunityId,
      opportunityTitle: params.writebackRecord.opportunityTitle,
      shareTargetId,
    });

    try {
      await this.wecomTransportService.sendMarkdownMessage(
        {
          chatType: 'group',
          deliveryTargetId: shareTargetId,
          senderId: params.inboundMessage.senderId,
          externalConversationId: params.inboundMessage.externalConversationId,
        },
        shareMarkdown,
      );

      this.analysisLoggerService.logStep('企业微信跟进群共享已成功。', {
        requesterId: params.user.id,
        requesterName: params.user.name,
        sessionId: params.session.id,
        receiptId: params.receipt.id,
        followUpWritebackId: params.writebackRecord.id,
        opportunityId: params.writebackRecord.opportunityId,
        shareTargetId,
      });
      this.audit(
        params.user,
        'FOLLOW_UP_SHARE_SUCCEEDED',
        `${this.buildFollowUpTargetDisplay(params.writebackRecord)}的跟进摘要已分享到当前群。`,
        this.withConversationAuditSnapshot(params.conversationContext, {
          sessionId: params.session.id,
          followUpWritebackId: params.writebackRecord.id,
          objectType: this.getFollowUpRecordObjectType(params.writebackRecord),
          objectId: this.getFollowUpRecordObjectId(params.writebackRecord),
          shareTargetId,
        }),
      );
      const postShareSuccessPrompt = this.buildDailyReportPostWritebackPrompt(
        params.user,
        params.conversationContext,
        buildWecomFollowUpShareSuccessPrompt({
          objectType: this.getFollowUpRecordObjectType(params.writebackRecord),
          opportunityTitle: params.writebackRecord.opportunityTitle,
        }),
      );

      return await this.dispatchFollowUpWritebackPrompt({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext:
          this.wecomAiConversationOrchestrationService.clearDailyReportMemory(
            this.wecomAiConversationOrchestrationService.clearFollowUpWritebackMemory(
              params.conversationContext,
            ),
          ),
        prompt: postShareSuccessPrompt.prompt,
        status: 'FOLLOW_UP_SHARE_SUCCEEDED',
        idleAfterDispatch: !postShareSuccessPrompt.keepConversationActive,
      });
    } catch (error) {
      const failureReason =
        error instanceof Error ? error.message : '当前分享到群失败，请稍后重试。';
      this.analysisLoggerService.logWarn('企业微信跟进群共享失败。', {
        requesterId: params.user.id,
        requesterName: params.user.name,
        sessionId: params.session.id,
        receiptId: params.receipt.id,
        followUpWritebackId: params.writebackRecord.id,
        opportunityId: params.writebackRecord.opportunityId,
        shareTargetId,
        failureReason,
      });
      this.audit(
        params.user,
        'FOLLOW_UP_SHARE_FAILED',
        `${this.buildFollowUpTargetDisplay(params.writebackRecord)}的群共享失败。`,
        this.withConversationAuditSnapshot(params.conversationContext, {
          sessionId: params.session.id,
          followUpWritebackId: params.writebackRecord.id,
          objectType: this.getFollowUpRecordObjectType(params.writebackRecord),
          objectId: this.getFollowUpRecordObjectId(params.writebackRecord),
          shareTargetId,
          failureReason,
        }),
      );

      return await this.dispatchFollowUpWritebackPrompt({
        user: params.user,
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext:
          this.wecomAiConversationOrchestrationService.updateFollowUpWritebackMemory(
            params.conversationContext,
            {
              activeId: params.writebackRecord.id,
              status: params.writebackRecord.status,
              objectType: this.getFollowUpRecordObjectType(params.writebackRecord),
              objectId: this.getFollowUpRecordObjectId(params.writebackRecord),
              objectTitle: this.getFollowUpRecordObjectTitle(params.writebackRecord),
              opportunityId: params.writebackRecord.opportunityId,
              opportunityTitle: params.writebackRecord.opportunityTitle,
              draftContent: params.writebackRecord.draftContent,
              failureReason: undefined,
              shareStatus: 'AWAITING_CONFIRMATION',
              shareTargetId,
              shareChatType: 'group',
              shareFailureReason: failureReason,
            },
          ),
        prompt: buildWecomFollowUpSharePrompt({
          objectType: this.getFollowUpRecordObjectType(params.writebackRecord),
          opportunityTitle: params.writebackRecord.opportunityTitle,
          failureReason,
        }),
        status: 'FOLLOW_UP_SHARE_PENDING_CONFIRMATION',
      });
    }
  }

  private async dispatchFollowUpWritebackPrompt(params: {
    user: CrmUser;
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
    prompt: string;
    status: string;
    idleAfterDispatch?: boolean;
  }): Promise<WecomReceiveMessageResult> {
    this.wecomAiConversationOrchestrationService.appendAssistantTurn(
      params.conversationContext,
      params.prompt,
    );
    const dispatchResult = await this.wecomStreamDispatcherService.dispatch({
      receiptId: params.receipt.id,
      sessionId: params.session.id,
      target: this.buildDispatchTarget(params.inboundMessage, params.receipt.id),
      blocks: this.wecomStreamDispatcherService.buildDirectReplyBlocks(params.prompt),
    });

    this.saveSessionState(
      params.session,
      params.idleAfterDispatch ? 'IDLE' : 'ACTIVE',
      {
        activeRequestId: params.idleAfterDispatch ? undefined : params.receipt.id,
        lastReceiptId: params.receipt.id,
      },
    );

    return {
      receiptId: params.receipt.id,
      sessionId: params.session.id,
      status: params.status,
      acceptedAt: params.receipt.createdAt,
      deliveryStatus: dispatchResult.status,
      deliveredBlockCount: dispatchResult.deliveredCount,
      followUpWriteback: params.idleAfterDispatch
        ? undefined
        : this.buildFollowUpWritebackPayload(
            params.conversationContext.workMemory.activeFollowUpWritebackId
              ? this.followUpWritebackRepository.findById(
                  params.conversationContext.workMemory.activeFollowUpWritebackId,
                ) ?? undefined
              : undefined,
          ),
    };
  }

  private buildFollowUpWritebackPayload(
    record?: PendingFollowUpWritebackRecord,
  ): WecomFollowUpWritebackPayload | undefined {
    if (!record) {
      return undefined;
    }

    const statusMap: Record<
      PendingFollowUpWritebackRecord['status'],
      WecomFollowUpWritebackPayload['status']
    > = {
      DRAFTED: 'DRAFTED',
      AWAITING_CONTENT_CONFIRMATION: 'AWAITING_CONTENT_CONFIRMATION',
      WRITING: 'AWAITING_CONTENT_CONFIRMATION',
      COMPLETED: 'COMPLETED',
      CANCELLED: 'CANCELLED',
      FAILED: 'FAILED',
    };

    return {
      id: record.id,
      objectType: this.getFollowUpRecordObjectType(record),
      objectId: this.getFollowUpRecordObjectId(record),
      objectTitle: this.getFollowUpRecordObjectTitle(record),
      customerName: record.customerName,
      draftContent: record.draftContent,
      status: statusMap[record.status],
      failureReason: record.failureReason,
      externalRevisitLogId: record.externalRevisitLogId,
      writtenAt: record.writtenAt,
    };
  }

  private normalizeFollowUpWritebackDraftContent(
    user: CrmUser,
    messageText: string,
    existingRecord?: PendingFollowUpWritebackRecord,
  ): string | undefined {
    const trimmedText = messageText.trim();
    if (!trimmedText) {
      return undefined;
    }

    if (
      this.matchesAnyKeyword(trimmedText, WECOM_FOLLOW_UP_WRITEBACK_MODIFY_KEYWORDS) &&
      trimmedText.length <= 4
    ) {
      return undefined;
    }

    if (
      this.isFollowUpWritebackConfirmReply(trimmedText) &&
      trimmedText.length <= 4
    ) {
      return undefined;
    }

    if (this.shouldUseTemplateFollowUpFormat(existingRecord)) {
      return normalizeWecomFollowUpTemplateFinalContent(user.name, trimmedText);
    }

    return this.crmFollowUpWritebackService.formatSignedFollowUpContent(
      user.name,
      trimmedText,
    );
  }

  private shouldUseTemplateFollowUpFormat(
    record?: PendingFollowUpWritebackRecord,
  ): boolean {
    if (!record) {
      return false;
    }

    return (
      Boolean(record.structuredFollowUpContent) ||
      Boolean(record.structuredHelpNeeded) ||
      Boolean(record.structuredInformationShare) ||
      Boolean(record.structuredVisitPlan) ||
      record.draftContent.trim().startsWith(`【${record.requesterName}】`)
    );
  }

  private getCurrentCrmAccessToken(user: CrmUser): string | undefined {
    return this.authSessionRepository.findActiveByRequesterId(user.id)[0]?.crmAccessToken;
  }

  private getCustomerCreateConfigIssues(): string[] {
    const customerCreateConfig =
      this.localRuntimeConfigService.getCrmCustomerCreateConfig();
    const issues: string[] = [];

    if (!customerCreateConfig.itDecisionLocationField?.trim()) {
      issues.push('CRM_CUSTOMER_CREATE_IT_DECISION_LOCATION_FIELD');
    }
    if (!customerCreateConfig.unifiedSocialCreditCodeField?.trim()) {
      issues.push('CRM_CUSTOMER_CREATE_UNIFIED_SOCIAL_CREDIT_CODE_FIELD');
    }

    return issues;
  }

  private async resolveWecomCrmAccessToken(
    user: CrmUser,
  ): Promise<string | undefined> {
    return await this.crmFollowUpWritebackService.resolveWecomBotAccessToken(
      this.getCurrentCrmAccessToken(user),
    );
  }

  private resolveWecomCrmReadAccessToken(user: CrmUser): string | undefined {
    const sessionAccessToken = this.getCurrentCrmAccessToken(user)?.trim();
    if (sessionAccessToken) {
      return sessionAccessToken;
    }

    const crmAuthConfig = this.localRuntimeConfigService.getCrmAuthConfig();
    if (crmAuthConfig.mockEnabled || process.env.NODE_ENV === 'test') {
      return 'mock-builtin-wecom-token';
    }

    return undefined;
  }

  /**
   * 企业微信机器人执行 CRM 相关读写时，优先尝试当前用户登录态；
   * 若命中登录过期，则先降级到内置账号，再在必要时强制刷新内置账号 token。
   *
   * 这样可以把 token 生命周期问题拦在系统内部，避免把“请重新登录”直接暴露给机器人用户。
   */
  private async executeWecomCrmOperationWithTokenRetry<T>(params: {
    user: CrmUser;
    operationLabel: string;
    operationKey: string;
    accessToken?: string;
    executor: (accessToken?: string) => Promise<T>;
  }): Promise<T> {
    const sessionAccessToken = this.getCurrentCrmAccessToken(params.user)?.trim();
    const primaryAccessToken =
      params.accessToken?.trim() ?? (await this.resolveWecomCrmAccessToken(params.user));

    try {
      return await params.executor(primaryAccessToken);
    } catch (error) {
      if (!(error instanceof UnauthorizedException)) {
        throw error;
      }
      let latestUnauthorizedError = error;

      let builtinAccessToken: string | undefined;
      if (sessionAccessToken && primaryAccessToken === sessionAccessToken) {
        builtinAccessToken =
          await this.crmFollowUpWritebackService.resolveWecomBotAccessToken(undefined);
        this.analysisLoggerService.logWarn(
          `企业微信${params.operationLabel}检测到当前登录态已过期，已回退内置账号重试。`,
          {
            requesterId: params.user.id,
            requesterName: params.user.name,
            operationKey: params.operationKey,
          },
        );

        try {
          return await params.executor(builtinAccessToken);
        } catch (fallbackError) {
          if (!(fallbackError instanceof UnauthorizedException)) {
            throw fallbackError;
          }
          latestUnauthorizedError = fallbackError;
        }
      }

      this.crmBuiltinAccountTokenService.clearBuiltinAccessTokenCache();
      builtinAccessToken =
        await this.crmBuiltinAccountTokenService.getBuiltinWriteAccessToken(
          true,
        );
      this.analysisLoggerService.logWarn(
        `企业微信${params.operationLabel}检测到内置账号 token 已过期，已重新登录 CRM 后重试。`,
        {
          requesterId: params.user.id,
          requesterName: params.user.name,
          operationKey: params.operationKey,
        },
      );

      try {
        return await params.executor(builtinAccessToken);
      } catch (builtinRetryError) {
        if (!(builtinRetryError instanceof UnauthorizedException)) {
          throw builtinRetryError;
        }

        throw latestUnauthorizedError;
      }
    }
  }

  /**
   * 读取型 CRM 查询复用统一 token 续期策略，避免查询链路单独维护一套过期处理。
   */
  private async executeWecomCrmReadWithTokenRetry<T>(params: {
    user: CrmUser;
    operationLabel: string;
    operationKey: string;
    accessToken?: string;
    allowBuiltinWritebackFallback?: boolean;
    executor: (accessToken?: string) => Promise<T>;
  }): Promise<T> {
    if (params.allowBuiltinWritebackFallback) {
      return await this.executeWecomCrmOperationWithTokenRetry(params);
    }

    const primaryAccessToken =
      params.accessToken?.trim() ?? this.resolveWecomCrmReadAccessToken(params.user);

    try {
      return await params.executor(primaryAccessToken);
    } catch (error) {
      if (!(error instanceof UnauthorizedException)) {
        throw error;
      }

      this.analysisLoggerService.logWarn(
        `企业微信${params.operationLabel}只读查询检测到当前 CRM 登录态不可用，已阻止回退写入内置账号。`,
        {
          requesterId: params.user.id,
          requesterName: params.user.name,
          operationKey: params.operationKey,
        },
      );
      throw new UnauthorizedException(
        '当前 CRM 登录态已失效或缺失，请先重新登录 CRM 或刷新企业微信绑定后再查询。只读查询不会使用企业微信写回内置账号。',
      );
    }
  }

  /**
   * 商机 / 客户查询继续复用统一 token 过期重试能力，只保留查询语义上的参数命名。
   */
  private async executeWecomLookupWithTokenRetry<T>(params: {
    user: CrmUser;
    lookupLabel: '商机' | '客户';
    lookupKey: string;
    accessToken?: string;
    allowBuiltinWritebackFallback?: boolean;
    executor: (accessToken?: string) => Promise<T>;
  }): Promise<T> {
    return await this.executeWecomCrmReadWithTokenRetry({
      user: params.user,
      operationLabel: `${params.lookupLabel}查询`,
      operationKey: params.lookupKey,
      accessToken: params.accessToken,
      allowBuiltinWritebackFallback: params.allowBuiltinWritebackFallback,
      executor: params.executor,
    });
  }

  private async lookupOpportunityByCompanyNameWithRetry(params: {
    user: CrmUser;
    companyName: string;
    limit?: number;
    customFieldName?: string;
    accessToken?: string;
    restrictToOwnerOrCollaborator?: boolean;
    allowBuiltinWritebackFallback?: boolean;
  }) {
    return await this.executeWecomLookupWithTokenRetry({
      user: params.user,
      lookupLabel: '商机',
      lookupKey: params.companyName,
      accessToken: params.accessToken,
      allowBuiltinWritebackFallback: params.allowBuiltinWritebackFallback,
      executor: async (accessToken) =>
        await this.opportunityLookupService.lookupByCompanyName(
          params.user,
          params.companyName,
          {
            limit: params.limit,
            customFieldName: params.customFieldName,
            accessToken,
            restrictToOwnerOrCollaborator:
              params.restrictToOwnerOrCollaborator,
          },
        ),
    });
  }

  private async handleEntityLookupFlow(params: {
    user: CrmUser;
    session: QuerySessionRecord;
    receipt: { id: string; createdAt: string };
    inboundMessage: WecomInboundMessage;
    conversationContext: WecomConversationContextRecord;
    conversationDecision: WecomConversationDecision;
  }): Promise<WecomReceiveMessageResult> {
    const entityLookupEnabled = process.env.WECOM_AI_ENTITY_LOOKUP_ENABLED !== 'false';
    if (!entityLookupEnabled) {
      return await this.dispatchTaskGuidancePrompt({
        session: params.session,
        receipt: params.receipt,
        inboundMessage: params.inboundMessage,
        conversationContext: params.conversationContext,
        prompt:
          '当前企业微信列表与详情查询能力尚未开启，请先使用现有经营问数、跟进或创建能力。',
        status: 'RETURNED',
      });
    }

    const lookupResult = await this.executeWecomCrmReadWithTokenRetry({
      user: params.user,
      operationLabel: '列表与详情查询',
      operationKey:
        params.conversationDecision.entityLookupQueryText ??
        params.inboundMessage.messageText?.trim() ??
        'entity-lookup',
      executor: async (accessToken) =>
        await this.wecomEntityLookupService.execute({
          user: params.user,
          accessToken,
          entityLookupAction: params.conversationDecision.entityLookupAction ?? 'LIST',
          entityType: params.conversationDecision.entityLookupEntityType ?? 'Unknown',
          queryText: params.conversationDecision.entityLookupQueryText,
          selectionIndex: params.conversationDecision.entityLookupSelectionIndex,
          memory: params.conversationContext.workMemory.entityLookupMemory,
        }),
    });

    let nextContext = params.conversationContext;
    if (lookupResult.status === 'LIST_RETURNED') {
      nextContext = this.wecomAiConversationOrchestrationService.updateEntityLookupMemory(
        nextContext,
        {
          mode: 'LIST_RETURNED',
          entityType:
            params.conversationDecision.entityLookupEntityType === 'Unknown'
              ? undefined
              : params.conversationDecision.entityLookupEntityType,
          queryText:
            params.conversationDecision.entityLookupQueryText ??
            params.conversationContext.workMemory.entityLookupMemory?.queryText,
          listItems: lookupResult.listItems,
          source:
            params.conversationDecision.entityLookupAction === 'SELECT_FROM_LAST_LIST'
              ? 'AI_SELECTION_FROM_LAST_LIST'
              : 'DIRECT_QUERY',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        },
      );
    } else if (lookupResult.status === 'DETAIL_RETURNED') {
      nextContext = this.wecomAiConversationOrchestrationService.updateEntityLookupMemory(
        nextContext,
        {
          mode: 'DETAIL_RETURNED',
          entityType:
            params.conversationDecision.entityLookupEntityType === 'Unknown'
              ? undefined
              : params.conversationDecision.entityLookupEntityType,
          queryText:
            params.conversationDecision.entityLookupQueryText ??
            params.conversationContext.workMemory.entityLookupMemory?.queryText,
          listItems:
            lookupResult.listItems.length > 0
              ? lookupResult.listItems
              : params.conversationContext.workMemory.entityLookupMemory?.listItems ?? [],
          selectedItemId: lookupResult.selectedItemId,
          source:
            params.conversationDecision.entityLookupAction === 'SELECT_FROM_LAST_LIST'
              ? 'AI_SELECTION_FROM_LAST_LIST'
              : 'DIRECT_QUERY',
          expiresAt:
            params.conversationContext.workMemory.entityLookupMemory?.expiresAt,
        },
      );
    } else if (lookupResult.listItems.length > 0) {
      nextContext = this.wecomAiConversationOrchestrationService.updateEntityLookupMemory(
        nextContext,
        {
          mode: 'LIST_RETURNED',
          entityType:
            params.conversationContext.workMemory.entityLookupMemory?.entityType,
          queryText:
            params.conversationContext.workMemory.entityLookupMemory?.queryText,
          listItems: lookupResult.listItems,
          source:
            params.conversationContext.workMemory.entityLookupMemory?.source ??
            'DIRECT_QUERY',
          expiresAt:
            params.conversationContext.workMemory.entityLookupMemory?.expiresAt ??
            new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        },
      );
    }

    this.wecomAiConversationOrchestrationService.appendAssistantTurn(
      nextContext,
      lookupResult.replyText,
    );
    const dispatchResult = await this.wecomStreamDispatcherService.dispatch({
      receiptId: params.receipt.id,
      sessionId: params.session.id,
      target: this.buildDispatchTarget(params.inboundMessage, params.receipt.id),
      blocks: this.wecomStreamDispatcherService.buildDirectReplyBlocks(
        lookupResult.replyText,
      ),
    });

    this.saveSessionState(params.session, 'IDLE', {
      activeRequestId: undefined,
      lastReceiptId: params.receipt.id,
    });

    return {
      receiptId: params.receipt.id,
      sessionId: params.session.id,
      status:
        lookupResult.status === 'LIST_RETURNED'
          ? 'ENTITY_LOOKUP_LIST_RETURNED'
          : lookupResult.status === 'DETAIL_RETURNED'
            ? 'ENTITY_LOOKUP_DETAIL_RETURNED'
            : 'CLARIFICATION_REQUIRED',
      acceptedAt: params.receipt.createdAt,
      deliveryStatus: dispatchResult.status,
      deliveredBlockCount: dispatchResult.deliveredCount,
    };
  }

  private async lookupCustomerByNameWithRetry(params: {
    user: CrmUser;
    customerName: string;
    limit?: number;
    accessToken?: string;
    restrictToOwnerOrCollaborator?: boolean;
    allowBuiltinWritebackFallback?: boolean;
  }) {
    return await this.executeWecomLookupWithTokenRetry({
      user: params.user,
      lookupLabel: '客户',
      lookupKey: params.customerName,
      accessToken: params.accessToken,
      allowBuiltinWritebackFallback: params.allowBuiltinWritebackFallback,
      executor: async (accessToken) =>
        await this.customerLookupService.lookupByName(
          params.user,
          params.customerName,
          {
            limit: params.limit,
            accessToken,
            restrictToOwnerOrCollaborator:
              params.restrictToOwnerOrCollaborator,
          },
        ),
    });
  }

  private async lookupOpportunityByIdWithRetry(params: {
    user: CrmUser;
    opportunityId: string;
    accessToken?: string;
  }) {
    return await this.executeWecomLookupWithTokenRetry({
      user: params.user,
      lookupLabel: '商机',
      lookupKey: params.opportunityId,
      accessToken: params.accessToken,
      executor: async (accessToken) =>
        await this.opportunityLookupService.getById(
          params.user,
          params.opportunityId,
          {
            accessToken,
          },
        ),
    });
  }

  private async lookupCustomerByIdWithRetry(params: {
    user: CrmUser;
    customerId: string;
    accessToken?: string;
  }) {
    return await this.executeWecomLookupWithTokenRetry({
      user: params.user,
      lookupLabel: '客户',
      lookupKey: params.customerId,
      accessToken: params.accessToken,
      executor: async (accessToken) =>
        await this.customerLookupService.getById(
          params.user,
          params.customerId,
          {
            accessToken,
          },
        ),
    });
  }

  private buildTodayFollowUpEntityIntentPrompt(params: {
    companyNames: string[];
    projectNames: string[];
    summaryLines?: string[];
  }): string {
    const identifiedLines: string[] = [];
    const projectItems = params.projectNames.slice(0, 3);
    const customerItems = params.companyNames.slice(0, 3);

    if (projectItems.length > 0) {
      identifiedLines.push(
        ...projectItems.map((item, index) =>
          projectItems.length > 1 ? `项目${index + 1}：${item}` : `项目：${item}`,
        ),
      );
    }
    if (customerItems.length > 0) {
      identifiedLines.push(
        ...customerItems.map((item, index) =>
          customerItems.length > 1 ? `客户${index + 1}：${item}` : `客户：${item}`,
        ),
      );
    }

    if (identifiedLines.length === 0) {
      return '我还没有从这段记录里识别出明确的项目或客户名称。请补充项目名或客户名，我再继续帮你写 CRM 跟进记录。';
    }

    return [
      '我先根据你的记录识别到这些信息：',
      ...identifiedLines.map((item, index) => `${index + 1}. ${item}`),
      ...(params.summaryLines && params.summaryLines.length > 0
        ? [
            `${identifiedLines.length + 1}. 跟进摘要：`,
            ...params.summaryLines.map((item) => `   ${item}`),
          ]
        : []),
      '如果这些信息没问题，回复“确认”后我会直接写入 CRM 跟进记录；如果项目或客户不对，直接告诉我正确名称即可。',
    ].join('\n');
  }

  private buildTodayFollowUpSummaryLines(followUpText: string): string[] {
    const summaryLines = this.normalizeDailyReportFollowUpText(followUpText)
      .split(/\r?\n/u)
      .map((item) => item.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (summaryLines.length === 0) {
      return [];
    }

    return summaryLines;
  }

  private buildDailyReportReviewPrompt(
    report: ReturnType<DailyReportService['recordFragment']>,
    intake: WecomDailyReportIntakeResult,
    closingHint: string,
  ): string {
    const labeledSectionLines = report.fragments.map(
      (fragment) => `${DAILY_REPORT_SECTION_LABELS[fragment.fragmentType]}：${fragment.content}`,
    );
    const backendMatchLines = intake.backendMatches.map(
      (match) => `${this.getBackendMatchLabel(match.kind)}：${match.name}（${match.detail}）`,
    );
    const missingSectionLabels = DAILY_REPORT_SECTION_ORDER.filter(
      (sectionType) => !report.sectionTypes.includes(sectionType),
    ).map((sectionType) => DAILY_REPORT_SECTION_LABELS[sectionType]);

    return buildWecomDailyReportReviewPrompt({
      reportTitle: report.draftTitle,
      extractedSectionLines: labeledSectionLines,
      backendMatchLines,
      fallbackCandidates: intake.fallbackCandidates,
      missingSectionLabels,
      confirmationSummaryLines: intake.confirmationSummaryLines,
    }) + `\n${closingHint}`;
  }

  private getBackendMatchLabel(kind: WecomDailyReportIntakeResult['backendMatches'][number]['kind']): string {
    switch (kind) {
      case 'customer':
        return '客户';
      case 'opportunity':
        return '商机';
      case 'contract':
        return '合同';
      default:
        return '主数据';
    }
  }

  private matchesAnyKeyword(text: string, keywords: string[]): boolean {
    return keywords.some((keyword) => text.includes(keyword));
  }

  private isDailyReportConfirmReply(messageText?: string): boolean {
    return isWecomAffirmativeReply(messageText, WECOM_DAILY_REPORT_CONFIRM_KEYWORDS);
  }

  private isFollowUpWritebackConfirmReply(messageText?: string): boolean {
    return (
      matchesWecomExactReply(messageText, WECOM_FOLLOW_UP_WRITEBACK_CONFIRM_KEYWORDS) ||
      this.hasExplicitFollowUpWritebackIntent(messageText ?? '')
    );
  }

  private isFollowUpShareConfirmReply(messageText?: string): boolean {
    return (
      matchesWecomExactReply(messageText, WECOM_FOLLOW_UP_SHARE_CONFIRM_KEYWORDS) ||
      this.hasExplicitFollowUpShareIntent(messageText ?? '')
    );
  }

  private isThemeEntryOnlyMessage(messageText: string): boolean {
    return isWecomDailyReportThemeOnlyMessage(messageText);
  }

  private resolveDailyReportRevisionTarget(
    messageText: string,
    existingSectionTypes: DailyReportFragmentType[],
  ): DailyReportFragmentType | undefined {
    const labelTargets: Array<[DailyReportFragmentType, string[]]> = [
      ['TODAY_FOLLOW_UP', ['今日跟进', '跟进']],
      ['CUSTOMER_OR_OPPORTUNITY_CHANGE', ['客户/商机变化', '客户变化', '商机变化']],
      ['INFORMATION_SHARE', ['信息共享', '信息分享', '共享', '分享']],
      ['HELP_REQUIRED', ['问题与协助', '需要协助', '协助']],
      ['TOMORROW_PLAN', ['计划', '后续计划', '明日计划', '明天计划']],
    ];

    for (const [fragmentType, labels] of labelTargets) {
      if (labels.some((label) => messageText.includes(label))) {
        return fragmentType;
      }
    }

    return getWecomDailyReportNextStep(existingSectionTypes) ?? DAILY_REPORT_SECTION_ORDER[0];
  }

  private getCurrentBusinessDate(): string {
    return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  /**
   * 从已返回的统一结果详情中提取企微短期追问上下文。
   *
   * 参数说明：`detail` 为本次查询详情，`params` 保存当前查询 ID 和用户实际执行问题。
   * 返回值说明：成功结果返回可压缩进会话记忆的实体、筛选和代表性结果；非成功结果返回 `undefined`。
   * 调用注意事项：这里只读取已经交付的结果包，不重新访问 CRM，避免追问上下文和实际结果口径漂移。
   */
  private buildLatestResultContext(
    detail: Record<string, unknown> | undefined,
    params: {
      queryId?: string;
      questionText: string;
    },
  ): WecomLatestResultContext | undefined {
    if (!detail) {
      return undefined;
    }

    const report = detail.report as
      | {
          reportTitle?: string;
          executiveSummary?: string;
          appliedFilters?: AppliedFilter[];
          temporalScope?: Record<string, unknown>;
        }
      | undefined;
    const appliedFilters = this.resolveLatestResultAppliedFilters(
      detail.appliedFilters ?? report?.appliedFilters,
    );
    const rows = this.resolveRowsForAnalysisImage(detail.tableRows).slice(0, 5);
    const topRows = rows.map((row) => ({
      label: this.resolveLatestResultRowLabel(row),
      summaryFields: this.buildLatestResultRowSummaryFields(row),
    }));

    return {
      queryId: params.queryId,
      questionText: params.questionText,
      title:
        report?.reportTitle ??
        (typeof detail.title === 'string' ? detail.title : undefined),
      summary:
        report?.executiveSummary ??
        (typeof detail.summary === 'string' ? detail.summary : undefined),
      entities: this.buildLatestResultEntities(detail, appliedFilters, topRows),
      temporalScope: (detail.temporalScope ?? report?.temporalScope) as
        | Record<string, unknown>
        | undefined,
      appliedFilters,
      topRows,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * 规范化结果筛选条件。
   *
   * 参数说明：`value` 为详情里的筛选数组。
   * 返回值说明：只保留 label/value 都存在的筛选项。
   */
  private resolveLatestResultAppliedFilters(value: unknown): AppliedFilter[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return undefined;
        }
        const raw = item as Record<string, unknown>;
        const label = String(raw.label ?? '').trim();
        const filterValue = String(raw.value ?? '').trim();
        return label && filterValue ? { label, value: filterValue } : undefined;
      })
      .filter((item): item is AppliedFilter => Boolean(item));
  }

  /**
   * 构造追问可用的已验证实体清单。
   *
   * 参数说明：`detail` 为统一结果详情，`appliedFilters/topRows` 为已规范化的筛选和代表行。
   * 返回值说明：返回去重后的业务实体，供后续 AI 共指消解使用。
   * 调用注意事项：实体来源必须来自结构化意图或结果行，不从用户短追问里猜测。
   */
  private buildLatestResultEntities(
    detail: Record<string, unknown>,
    appliedFilters: AppliedFilter[],
    topRows: WecomLatestResultContext['topRows'],
  ): WecomLatestResultContext['entities'] {
    const entrySnapshot = detail.entryInterpretationSnapshot as
      | { structuredSlots?: Record<string, unknown> }
      | undefined;
    const queryEntities = this.resolveStringArray(
      entrySnapshot?.structuredSlots?.queryEntities,
    );
    const filterEntities = appliedFilters.map((item) => item.value);
    const rowEntities = topRows.map((item) => item.label);

    return [
      ...queryEntities.map((value) => ({
        type: 'QUERY_ENTITY' as const,
        value,
        source: 'entryInterpretationSnapshot',
      })),
      ...filterEntities.map((value) => ({
        type: 'FILTER' as const,
        value,
        source: 'appliedFilters',
      })),
      ...rowEntities.map((value) => ({
        type: 'RESULT_ROW' as const,
        value,
        source: 'tableRows',
      })),
    ].filter((item, index, array) =>
      Boolean(item.value) &&
      array.findIndex((candidate) => candidate.value === item.value) === index,
    ).slice(0, 20);
  }

  /**
   * 解析结果行的业务名称。
   *
   * 参数说明：`row` 为结果表格中的一行。
   * 返回值说明：优先返回客户、商机、渠道商、负责人、区域等业务名称。
   */
  private resolveLatestResultRowLabel(row: Record<string, unknown>): string {
    return String(
      row.partnerName ??
        row.partner_name ??
        row.partner ??
        row.customerName ??
        row.customer_name ??
        row.customer ??
        row.opportunityName ??
        row.opportunity_name ??
        row.projectName ??
        row.project_name ??
        row.ownerName ??
        row.owner_name ??
        row.region ??
        row.region_name ??
        row.bigRegion ??
        row.big_region ??
        row.bucket_label ??
        row.bucketLabel ??
        row.category ??
        row.name ??
        row.title ??
        '未命名结果',
    ).trim();
  }

  /**
   * 构造代表行摘要字段。
   *
   * 参数说明：`row` 为结果表格行。
   * 返回值说明：返回最多 6 个中文可读字段，供追问理解使用。
   */
  private buildLatestResultRowSummaryFields(row: Record<string, unknown>): string[] {
    const labelMap: Record<string, string> = {
      amount: '金额',
      totalAmount: '总金额',
      total_amount: '总金额',
      opportunityAmount: '商机金额',
      opportunity_amount: '商机金额',
      orderAmount: '订单金额',
      order_amount: '订单金额',
      count: '数量',
      opportunityCount: '商机数',
      opportunity_count: '商机数',
      orderCount: '订单数',
      order_count: '订单数',
      stageName: '阶段',
      stage_name: '阶段',
      status: '状态',
      statusName: '状态',
      region: '区域',
      bigRegion: '大区',
      ownerName: '负责人',
      partnerName: '渠道商',
      customerName: '客户',
    };
    const priorityKeys = Object.keys(labelMap);

    return priorityKeys
      .filter((key) => row[key] !== undefined && row[key] !== null && row[key] !== '')
      .map((key) => `${labelMap[key]}=${this.formatLatestResultField(row[key])}`)
      .slice(0, 6);
  }

  /**
   * 格式化追问上下文字段值。
   */
  private formatLatestResultField(value: unknown): string {
    if (Array.isArray(value)) {
      return value.map((item) => String(item ?? '').trim()).filter(Boolean).join('、');
    }

    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }

    return String(value ?? '').trim();
  }

  /**
   * 从未知值中读取字符串数组。
   */
  private resolveStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => String(item ?? '').trim())
      .filter(Boolean);
  }

  private resolveDispatchBlocks(
    queryResponse: Record<string, unknown>,
    detail?: Record<string, unknown>,
    clarificationPrompt?: string,
    options?: { preferImageAttachments?: boolean },
  ): StreamBlock[] {
    if (queryResponse.status === 'RETURNED' && detail) {
      const groundedMarkdown = this.resolveWecomFinalMarkdown(detail, {
        preferImageAttachments: options?.preferImageAttachments === true,
      });
      if (groundedMarkdown) {
        return [
          {
            sequence: 0,
            blockType: 'REPORT',
            content: groundedMarkdown,
          },
        ];
      }
      return detail.streamBlocks as StreamBlock[];
    }

    if (queryResponse.status === 'CLARIFICATION_REQUIRED') {
      return this.wecomStreamDispatcherService.buildClarificationBlocks(
        String(clarificationPrompt ?? '请补充必要条件后继续分析。'),
      );
    }

    if (queryResponse.status === 'QUEUED') {
      return this.wecomStreamDispatcherService.buildQueueBlocks(
        String(queryResponse.queueNotice ?? '当前会话仍有请求处理中，请稍后查看结果。'),
      );
    }

    return this.wecomStreamDispatcherService.buildBlockedBlocks(
      String(clarificationPrompt ?? '当前请求已被系统拦截。'),
    );
  }

  /**
   * 为企微智能分析结果生成模板卡片。
   *
   * 参数说明：`detail` 为统一分析详情，`options` 描述当前查询 ID。
   * 返回值说明：默认返回 1 张文本通知卡片；配置关闭、无报告或构造失败时返回空数组。
   * 调用注意事项：卡片是企微分析结果主交付形态，图片附件和 Markdown 正文承载主要内容，链接仅作为只读备查。
   */
  private buildAnalysisTemplateCards(
    detail: Record<string, unknown> | undefined,
    options: { hasImageAttachments: boolean; queryId?: string },
  ): WecomDispatchTemplateCard[] {
    if (process.env.WECOM_ANALYSIS_TEMPLATE_CARD_ENABLED === 'false' || !detail) {
      return [];
    }

    const report = detail.report as
      | {
          reportTitle?: string;
          executiveSummary?: string;
          metricCards?: MetricCard[];
          keyFindings?: AnalysisKeyFinding[];
          trendInsight?: AnalysisTrendInsight;
          riskInsights?: AnalysisInsightItem[];
          recommendations?: AnalysisRecommendationItem[];
          tableBlocks?: Array<{
            title?: string;
            rows?: Array<Record<string, unknown>>;
          }>;
          scopeSummary?: string;
        }
      | undefined;
    if (!report?.reportTitle || !report.executiveSummary) {
      return [];
    }

    const metricCards = this.resolveTemplateCardMetricCards(
      report.metricCards ?? [],
      report.reportTitle,
    );
    const questionText = String(detail.questionText ?? '');
    const requestedSections = this.resolveTemplateCardRequestedSections(questionText, report);
    const primaryMetric = metricCards[0];
    const secondaryMetrics = metricCards.slice(1, 5);
    const sectionContents = this.buildTemplateCardSectionContents(requestedSections, report);
    const cardHint = requestedSections.length > 0 ? '按需分析结果' : '模板卡片摘要';
    const subTitleText = this.resolveTemplateCardSubTitle(report.reportTitle, requestedSections);
    const comparisonText = this.buildAnalysisTemplateCardQuoteText(detail, report, requestedSections);
    const webBaseUrl = this.resolveWecomCardActionUrl(options.queryId);
    const templateCard = {
      card_type: 'text_notice',
      source: {
        desc: 'CRM智能分析',
        desc_color: 0,
      },
      main_title: {
        title: this.truncateWecomCardText(report.reportTitle, 26),
        desc: this.truncateWecomCardText(
          this.resolveTemplateCardDescription(report.executiveSummary, questionText, requestedSections),
          30,
        ),
      },
      emphasis_content: primaryMetric
        ? {
            title: this.truncateWecomCardText(String(primaryMetric.value), 10),
            desc: this.truncateWecomCardText(primaryMetric.name, 15),
          }
        : undefined,
      quote_area: comparisonText
        ? {
            type: 0,
            title: this.truncateWecomCardText(options.hasImageAttachments ? '图表与发现' : '关键发现', 13),
            quote_text: this.truncateWecomCardText(comparisonText, 80),
          }
        : undefined,
      sub_title_text: this.truncateWecomCardText(subTitleText, 112),
      horizontal_content_list: [
        ...sectionContents,
        ...secondaryMetrics.map((metric) => ({
          keyname: this.truncateWecomCardText(metric.name, 5),
          value: this.truncateWecomCardText(String(metric.value), 26),
        })),
        {
          keyname: '展示',
          value: options.hasImageAttachments ? `${cardHint}，已附图表` : cardHint,
        },
      ].slice(0, 6),
      jump_list: [
        {
          type: 1,
          title: '打开备查报告',
          url: webBaseUrl,
        },
      ].slice(0, 3),
      card_action: {
        type: 1,
        url: webBaseUrl,
      },
    };

    return [
      {
        sequence: 8000,
        templateCard,
        contentPreview: `${report.reportTitle}｜${cardHint}`,
      },
    ];
  }

  /**
   * 从用户问题中解析企微卡片应优先呈现的业务区块。
   *
   * 参数说明：`questionText` 为本轮企微原问题，`report` 为统一报告。
   * 返回值说明：返回用于卡片副标题和横向内容的短区块名称。
   * 调用注意事项：这里只做展示编排，不扩大查询范围；默认模板仍由报告本身承载。
   */
  private resolveTemplateCardRequestedSections(
    questionText: string,
    report: {
      reportTitle?: string;
      tableBlocks?: Array<{ title?: string; rows?: Array<Record<string, unknown>> }>;
    },
  ): string[] {
    const normalizedQuestion = questionText.trim();
    const sections: string[] = [];
    const add = (section: string) => {
      if (!sections.includes(section)) {
        sections.push(section);
      }
    };

    if (!normalizedQuestion) {
      return [];
    }

    const hasPartnerSubject = /(合作伙伴|服务商|渠道商|渠道|代理商|经销商|伙伴)/u.test(normalizedQuestion);
    const hasPartnerType = /(类型|类别|分类|等级|级别|技术服务商|分别|单独列|列一下|名单|明细)/u.test(
      normalizedQuestion,
    );
    if (hasPartnerSubject) {
      add(hasPartnerType ? '渠道商类型' : /开拓|拓展|发展/u.test(normalizedQuestion) ? '合作伙伴开拓' : '渠道商');
    }
    if (/(客户商机报备|客户报备|报备情况|报备)/u.test(normalizedQuestion)) {
      add('客户报备');
    }
    if (/(商机|机会)/u.test(normalizedQuestion)) {
      add(/阶段|漏斗|分布|结构|占比/u.test(normalizedQuestion) ? '商机阶段' : '商机');
    }
    if (/(订单|下单|成单|签单|成交)/u.test(normalizedQuestion)) {
      add('订单');
    }
    if (/(建议|后续|经营建议|下一步|怎么做)/u.test(normalizedQuestion)) {
      add('经营建议');
    }

    if (sections.length === 0 && this.isCompositeTemplateCardReport(report.reportTitle ?? '')) {
      return ['合作伙伴开拓', '客户报备', '商机', '订单'];
    }

    return sections.slice(0, 5);
  }

  /**
   * 构造企微卡片横向业务区块摘要。
   *
   * 参数说明：`requestedSections` 为用户本轮要求区块，`report` 为统一报告。
   * 返回值说明：返回企微模板卡片 `horizontal_content_list` 可直接使用的键值项。
   * 调用注意事项：区块行数只来自已经生成的报告表格，不重新计算指标。
   */
  private buildTemplateCardSectionContents(
    requestedSections: string[],
    report: {
      tableBlocks?: Array<{ title?: string; rows?: Array<Record<string, unknown>> }>;
    },
  ): Array<{ keyname: string; value: string }> {
    return requestedSections.slice(0, 3).map((section) => {
      const matchedBlock = this.findTemplateCardTableBlock(section, report.tableBlocks ?? []);
      const rowCount = matchedBlock?.rows?.length;
      return {
        keyname: this.truncateWecomCardText(section, 5),
        value: this.truncateWecomCardText(
          typeof rowCount === 'number' ? `已生成 ${rowCount} 条` : '已生成',
          26,
        ),
      };
    });
  }

  /**
   * 构造常规分析模板卡片引用区短分析。
   *
   * 参数说明：`report` 为统一分析报告，`requestedSections` 为用户本轮关注区块。
   * 返回值说明：优先返回关键发现、趋势、风险或建议；没有洞察时从表格和指标提炼对比。
   * 调用注意事项：只复用已生成报告，不新增查询或推断权限外事实。
   */
  private buildAnalysisTemplateCardQuoteText(
    detail: Record<string, unknown>,
    report: {
      executiveSummary?: string;
      metricCards?: MetricCard[];
      keyFindings?: AnalysisKeyFinding[];
      trendInsight?: AnalysisTrendInsight;
      riskInsights?: AnalysisInsightItem[];
      recommendations?: AnalysisRecommendationItem[];
      tableBlocks?: Array<{ title?: string; rows?: Array<Record<string, unknown>> }>;
    },
    requestedSections: string[],
  ): string {
    const highlights = [
      this.resolveAnalysisKeyFindingText(report.keyFindings),
      this.resolveAnalysisTrendText(report.trendInsight),
      this.resolveAnalysisRiskText(report.riskInsights),
      this.resolveAnalysisRecommendationText(report.recommendations),
      this.resolveAnalysisTableComparisonText(
        report.tableBlocks ?? this.buildFallbackTemplateCardTableBlocks(detail),
        requestedSections,
      ),
      this.resolveAnalysisMetricComparisonText(report.metricCards ?? []),
    ].filter((item): item is string => Boolean(item));

    return highlights.slice(0, 2).join('；');
  }

  /**
   * 将顶层结果行包装成卡片对比表格。
   *
   * 参数说明：`detail` 为统一分析详情。
   * 返回值说明：当报告未提供 tableBlocks 时，用顶层 tableRows 构造一个兜底表格块。
   */
  private buildFallbackTemplateCardTableBlocks(
    detail: Record<string, unknown>,
  ): Array<{ title?: string; rows?: Array<Record<string, unknown>> }> {
    const rows = Array.isArray(detail.tableRows)
      ? detail.tableRows.filter(
          (row): row is Record<string, unknown> =>
            Boolean(row) && typeof row === 'object' && !Array.isArray(row),
        )
      : [];
    return rows.length > 0 ? [{ title: '结果明细', rows }] : [];
  }

  /**
   * 解析关键发现短文本。
   *
   * 参数说明：`keyFindings` 为报告关键发现。
   * 返回值说明：返回首条发现的标题和详情。
   */
  private resolveAnalysisKeyFindingText(keyFindings?: AnalysisKeyFinding[]): string | undefined {
    const finding = keyFindings?.[0];
    if (!finding) {
      return undefined;
    }

    return this.compactCardSentence(`${finding.title}${finding.detail ? `：${finding.detail}` : ''}`);
  }

  /**
   * 解析趋势洞察短文本。
   *
   * 参数说明：`trendInsight` 为报告趋势洞察。
   * 返回值说明：返回趋势方向和解释。
   */
  private resolveAnalysisTrendText(trendInsight?: AnalysisTrendInsight): string | undefined {
    if (!trendInsight) {
      return undefined;
    }

    const trendRecord = trendInsight as unknown as Record<string, unknown>;
    const label = String(trendRecord.title ?? trendRecord.metricName ?? trendRecord.label ?? '趋势变化');
    const direction = String(trendRecord.directionLabel ?? trendRecord.direction ?? '').trim();
    const summary = String(trendRecord.summary ?? trendRecord.description ?? trendRecord.reason ?? '').trim();
    return this.compactCardSentence(`${label}${direction ? ` ${direction}` : ''}${summary ? `：${summary}` : ''}`);
  }

  /**
   * 解析风险洞察短文本。
   *
   * 参数说明：`riskInsights` 为报告风险洞察。
   * 返回值说明：返回首条风险标题和说明。
   */
  private resolveAnalysisRiskText(riskInsights?: AnalysisInsightItem[]): string | undefined {
    const risk = riskInsights?.[0];
    if (!risk) {
      return undefined;
    }

    const riskRecord = risk as unknown as Record<string, unknown>;
    return this.compactCardSentence(`${riskRecord.title ?? riskRecord.name ?? '风险提示'}${riskRecord.detail ?? riskRecord.description ? `：${riskRecord.detail ?? riskRecord.description}` : ''}`);
  }

  /**
   * 解析建议短文本。
   *
   * 参数说明：`recommendations` 为报告建议。
   * 返回值说明：返回首条建议。
   */
  private resolveAnalysisRecommendationText(recommendations?: AnalysisRecommendationItem[]): string | undefined {
    const recommendation = recommendations?.[0];
    if (!recommendation) {
      return undefined;
    }

    const recommendationRecord = recommendation as unknown as Record<string, unknown>;
    return this.compactCardSentence(`${recommendationRecord.title ?? '建议动作'}${recommendationRecord.detail ?? recommendationRecord.description ? `：${recommendationRecord.detail ?? recommendationRecord.description}` : ''}`);
  }

  /**
   * 从表格中提炼对比短文本。
   *
   * 参数说明：`tableBlocks` 为报告表格，`requestedSections` 为本轮关注区块。
   * 返回值说明：返回首个匹配表格的 Top1 名称和关键数值。
   */
  private resolveAnalysisTableComparisonText(
    tableBlocks: Array<{ title?: string; rows?: Array<Record<string, unknown>> }>,
    requestedSections: string[],
  ): string | undefined {
    const matchedBlock =
      requestedSections
        .map((section) => this.findTemplateCardTableBlock(section, tableBlocks))
        .find((block) => (block?.rows?.length ?? 0) > 0) ??
      tableBlocks.find((block) => (block.rows?.length ?? 0) > 0);
    const firstRow = matchedBlock?.rows?.[0];
    if (!firstRow) {
      return undefined;
    }

    const label = this.resolveLatestResultRowLabel(firstRow);
    const valueText = this.resolveAnalysisRowPrimaryValueText(firstRow);
    return this.compactCardSentence(`${matchedBlock?.title ?? '明细对比'}：${label}${valueText ? `，${valueText}` : ''}`);
  }

  /**
   * 从指标卡中提炼对比短文本。
   *
   * 参数说明：`metricCards` 为报告指标卡。
   * 返回值说明：返回前两个指标的并列对比。
   */
  private resolveAnalysisMetricComparisonText(metricCards: MetricCard[]): string | undefined {
    if (metricCards.length < 2) {
      return undefined;
    }

    return this.compactCardSentence(`${metricCards[0].name}${metricCards[0].value}，${metricCards[1].name}${metricCards[1].value}`);
  }

  /**
   * 解析行中的首个关键数值。
   *
   * 参数说明：`row` 为表格行。
   * 返回值说明：返回金额、数量、阶段或负责人等短字段。
   */
  private resolveAnalysisRowPrimaryValueText(row: Record<string, unknown>): string {
    const priorityKeys = [
      'amount',
      'totalAmount',
      'total_amount',
      'opportunityAmount',
      'opportunity_amount',
      'quoteAmount',
      'quote_amount',
      'orderAmount',
      'order_amount',
      'count',
      'totalCount',
      'opportunityCount',
      'opportunity_count',
      'quoteCount',
      'quote_count',
      'orderCount',
      'order_count',
      'stageName',
      'stage_name',
      'ownerName',
      'owner_name',
    ];
    const key = priorityKeys.find((item) => row[item] !== undefined && row[item] !== null && row[item] !== '');
    if (!key) {
      return '';
    }

    return `${this.resolveAnalysisRowValueLabel(key)}${this.formatLatestResultField(row[key])}`;
  }

  /**
   * 解析表格行字段中文名。
   *
   * 参数说明：`key` 为字段名。
   * 返回值说明：返回适合卡片展示的业务字段名。
   */
  private resolveAnalysisRowValueLabel(key: string): string {
    if (/amount/i.test(key)) {
      return '金额';
    }

    if (/count/i.test(key)) {
      return '数量';
    }

    if (/stage/i.test(key)) {
      return '阶段';
    }

    if (/owner/i.test(key)) {
      return '负责人';
    }

    return '';
  }

  /**
   * 压缩卡片短句。
   *
   * 参数说明：`value` 为待压缩文本。
   * 返回值说明：返回去掉换行和多余空白后的短句。
   */
  private compactCardSentence(value: string): string {
    return value.replace(/\s+/gu, ' ').replace(/[【】#*_`]/gu, '').trim();
  }

  /**
   * 匹配卡片业务区块对应的报告表格。
   *
   * 参数说明：`section` 为用户要求区块，`tableBlocks` 为报告表格块。
   * 返回值说明：返回标题最贴近该区块的表格块。
   */
  private findTemplateCardTableBlock(
    section: string,
    tableBlocks: Array<{ title?: string; rows?: Array<Record<string, unknown>> }>,
  ): { title?: string; rows?: Array<Record<string, unknown>> } | undefined {
    const patternBySection: Array<{ pattern: RegExp; matcher: RegExp }> = [
      { pattern: /渠道商类型|合作伙伴|渠道商/u, matcher: /渠道商|合作伙伴|服务商|伙伴/u },
      { pattern: /客户报备/u, matcher: /报备/u },
      { pattern: /商机阶段/u, matcher: /阶段/u },
      { pattern: /商机/u, matcher: /商机/u },
      { pattern: /订单/u, matcher: /订单|下单/u },
    ];
    const matchedPattern = patternBySection.find((item) => item.pattern.test(section));
    if (!matchedPattern) {
      return undefined;
    }

    return tableBlocks.find((block) => matchedPattern.matcher.test(block.title ?? ''));
  }

  /**
   * 构造企微模板卡片主标题描述。
   *
   * 参数说明：`executiveSummary` 为报告摘要，`questionText` 为用户原问题，`requestedSections` 为已识别业务区块。
   * 返回值说明：优先返回贴合用户描述的短句，无法识别时使用报告摘要。
   */
  private resolveTemplateCardDescription(
    executiveSummary: string,
    questionText: string,
    requestedSections: string[],
  ): string {
    if (requestedSections.length === 0) {
      return executiveSummary;
    }

    const regionLabel = this.resolveTemplateCardRegionLabel(questionText);
    return `已按${regionLabel}${requestedSections.join('、')}生成结果`;
  }

  /**
   * 解析企微卡片中的区域短语。
   *
   * 参数说明：`questionText` 为用户原问题。
   * 返回值说明：命中“山东区域、北京区域”等常见表达时返回短语。
   */
  private resolveTemplateCardRegionLabel(questionText: string): string {
    const match = questionText.match(
      /(北京|天津|河北|山西|内蒙古|辽宁|吉林|黑龙江|上海|江苏|浙江|安徽|福建|江西|山东|河南|湖北|湖南|广东|广西|海南|重庆|四川|贵州|云南|西藏|陕西|甘肃|青海|宁夏|新疆|广州|深圳|华东|华北|华南|华中|西南|西北|东北)(?:区域|区|大区|办)?/u,
    );
    return match?.[0] ?? '';
  }

  /**
   * 解析模板卡片展示指标。
   *
   * 参数说明：`metricCards` 为统一报告指标，`reportTitle` 为报告标题。
   * 返回值说明：组合经营报告优先展示伙伴、报备、商机、订单四段指标，普通报告保持原顺序。
   * 调用注意事项：这里只调整展示顺序，不能新增或重算任何指标值。
   */
  private resolveTemplateCardMetricCards(
    metricCards: MetricCard[],
    reportTitle: string,
  ): MetricCard[] {
    if (!this.isCompositeTemplateCardReport(reportTitle)) {
      return metricCards;
    }

    const priorityPatterns = [
      /渠道商数|命中渠道数|服务商数量|合作伙伴数/u,
      /客户报备数|命中报备数|报备数/u,
      /商机数|命中商机数|商机数量/u,
      /商机金额|累计商机金额|新增商机金额/u,
      /订单数|命中订单数|有效订单数量/u,
      /订单金额|累计订单金额|有效订单金额|订单总额/u,
      /技术服务商|合作等级数|正常状态服务商/u,
    ];
    const selected: MetricCard[] = [];
    const selectedNames = new Set<string>();

    for (const pattern of priorityPatterns) {
      const matchedMetric = metricCards.find(
        (item) => pattern.test(item.name) && !selectedNames.has(item.name),
      );
      if (matchedMetric) {
        selected.push(matchedMetric);
        selectedNames.add(matchedMetric.name);
      }
    }

    return [
      ...selected,
      ...metricCards.filter((item) => !selectedNames.has(item.name)),
    ];
  }

  /**
   * 解析模板卡片副标题。
   *
   * 参数说明：`reportTitle` 为统一报告标题。
   * 返回值说明：组合经营报告提示覆盖的业务区块，其他报告使用通用查看提示。
   */
  private resolveTemplateCardSubTitle(reportTitle: string, requestedSections: string[] = []): string {
    if (requestedSections.length > 0) {
      return `已优先呈现：${requestedSections.join('、')}，企微内已附摘要和图表。`;
    }

    if (this.isCompositeTemplateCardReport(reportTitle)) {
      return '已按合作伙伴开拓、客户报备、商机和订单生成模板卡片，并在企微内附图表。';
    }

    return '本次结果已生成模板卡片，企微内同步返回正文和图片图表。';
  }

  /**
   * 判断模板卡片是否为组合经营报告。
   *
   * 参数说明：`reportTitle` 为统一报告标题。
   * 返回值说明：标题表达组合经营、合作伙伴开拓或渠道商经营贡献时返回 `true`。
   */
  private isCompositeTemplateCardReport(reportTitle: string): boolean {
    return /(组合经营|合作伙伴开拓|客户报备与订单|渠道商经营贡献|服务商经营贡献)/u.test(
      reportTitle,
    );
  }

  /**
   * 解析看板公开报告地址。
   *
   * 参数说明：`queryId` 为当前分析请求 ID。
   * 返回值说明：返回企微卡片和卡片图片共同使用的公开后端地址。
   */
  private resolveDashboardPublicReportUrl(queryId: string): string {
    const dashboardBaseUrl = process.env.WECOM_DASHBOARD_BASE_URL?.trim();
    if (dashboardBaseUrl) {
      return this.buildPublicAnalysisReportUrl(dashboardBaseUrl, queryId);
    }

    return this.resolveWecomCardActionUrl(queryId);
  }

  /**
   * 解析企微卡片点击地址。
   *
   * 参数说明：`queryId` 为当前分析请求 ID。
   * 返回值说明：有查询 ID 时返回免登录只读结果页，否则返回 Web 基础地址。
   * 调用注意事项：不要把 token、client secret 或内网敏感参数拼到卡片链接里。
   */
  private resolveWecomCardActionUrl(queryId?: string): string {
    const config = this.localRuntimeConfigService.getWecomRuntimeConfig();
    const baseUrl = String(config.webBaseUrl ?? '').trim() || 'https://work.weixin.qq.com';
    if (!queryId) {
      return baseUrl;
    }

    return this.buildPublicAnalysisReportUrl(baseUrl, queryId);
  }

  /**
   * 构造企微卡片直达报告地址。
   *
   * 参数说明：`webBaseUrl` 为前端站点地址，`queryId` 为分析结果 ID。
   * 返回值说明：优先返回后端只读 HTML 报告地址，避免企微打开前端 SPA 时因静态资源或 API 代理不可达而白屏加载。
   * 调用注意事项：后端地址可通过 `APP_API_BASE_URL` 或 `VITE_API_BASE_URL` 显式指定；未指定时按 Web 地址主机和后端端口推导。
   */
  private buildPublicAnalysisReportUrl(webBaseUrl: string, queryId: string): string {
    const apiBaseUrl = this.resolvePublicApiBaseUrl(webBaseUrl);
    const normalizedBaseUrl = apiBaseUrl.replace(/\/+$/u, '');
    const encodedQueryId = encodeURIComponent(queryId);
    const publicReportPath = `/public/analysis-results/${encodedQueryId}/file`;

    if (/\/api\/v1$/iu.test(normalizedBaseUrl)) {
      return `${normalizedBaseUrl}${publicReportPath}`;
    }

    return `${normalizedBaseUrl}/api/v1${publicReportPath}`;
  }

  /**
   * 解析企微公开报告使用的后端 API 根地址。
   *
   * 参数说明：`webBaseUrl` 为现有 Web 端配置。
   * 返回值说明：返回可被企微客户端访问的后端 HTTP 地址。
   */
  private resolvePublicApiBaseUrl(webBaseUrl: string): string {
    const configuredApiBaseUrl = String(
      process.env.APP_API_BASE_URL ?? process.env.VITE_API_BASE_URL ?? '',
    ).trim();
    if (configuredApiBaseUrl) {
      return configuredApiBaseUrl;
    }

    try {
      const derivedUrl = new URL(webBaseUrl);
      derivedUrl.port = String(process.env.PORT ?? 3001);
      derivedUrl.pathname = derivedUrl.pathname.replace(/\/+$/u, '');
      derivedUrl.search = '';
      derivedUrl.hash = '';
      return derivedUrl.toString().replace(/\/+$/u, '');
    } catch {
      return `http://127.0.0.1:${process.env.PORT ?? 3001}`;
    }
  }

  /**
   * 裁剪企微模板卡片文案。
   *
   * 参数说明：`value` 为原始文本，`maxLength` 为最大字符数。
   * 返回值说明：返回去除换行并在超长时加省略号的短文本。
   * 调用注意事项：企微卡片字段有建议长度，提前裁剪可以避免客户端显示被硬截断。
   */
  private truncateWecomCardText(value: string, maxLength: number): string {
    const normalized = value.replace(/\s+/gu, ' ').trim();
    if (normalized.length <= maxLength) {
      return normalized;
    }

    return `${normalized.slice(0, Math.max(0, maxLength - 1))}…`;
  }

  /**
   * 为常规智能分析结果生成企微图片附件。
   *
   * 参数说明：`detail` 为统一分析结果详情。
   * 返回值说明：返回最多两张可上传图片；没有可展示行或生成失败时返回空数组。
   * 调用注意事项：图片是企微首屏展示增强，不能影响模板卡片和 Markdown 正文下发。
   */
  private async buildAnalysisImageAttachments(
    detail?: Record<string, unknown>,
  ): Promise<WecomDispatchImageAttachment[]> {
    if (!detail || process.env.WECOM_ANALYSIS_IMAGE_ATTACHMENT_ENABLED === 'false') {
      return [];
    }

    const report = detail.report as
      | {
          reportTitle?: string;
          executiveSummary?: string;
          variant?: WecomAnalysisImageVariant;
          metricCards?: MetricCard[];
        }
      | undefined;
    const sources = this.sortAnalysisImageSourcesForCard(
      this.resolveAnalysisImageSources(detail, report),
    ).slice(0, 1);
    const attachments: WecomDispatchImageAttachment[] = [];

    for (const [index, source] of sources.entries()) {
      try {
        const artifact = await this.wecomAnalysisTableImageService.renderTableImage({
          title: source.title,
          summary: source.summary,
          metricCards: (report?.metricCards ?? []).slice(0, 4),
          variant: source.variant,
          layout: 'card',
          rows: source.rows.slice(0, 10),
        });
        if (!artifact) {
          continue;
        }

        attachments.push({
          sequence: 9200 + index,
          filename: artifact.filename,
          buffer: artifact.buffer,
          contentPreview: `${source.title ?? report?.reportTitle ?? 'CRM 智能分析'}｜${artifact.previewText}`,
        });
      } catch (error) {
        this.analysisLoggerService.logWarn('企微分析图片生成失败，已降级为卡片和正文。', {
          title: source.title ?? report?.reportTitle,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return attachments;
  }

  /**
   * 解析企微结果图片的数据来源。
   *
   * 参数说明：`detail` 为统一分析结果详情，`report` 为可选报告摘要。
   * 返回值说明：返回最多 3 个可渲染图片的数据区块，优先使用二级视图，其次回退主表。
   * 调用注意事项：这里只做展示层裁剪，不重新查询 CRM，也不改变权限边界和审计口径。
   */
  private resolveAnalysisImageSources(
    detail: Record<string, unknown>,
    report?: {
      reportTitle?: string;
      executiveSummary?: string;
      variant?: WecomAnalysisImageVariant;
    },
  ): WecomAnalysisImageSource[] {
    const sources: WecomAnalysisImageSource[] = [];
    const usedSignatures = new Set<string>();
    const secondaryViews = Array.isArray(detail.secondaryViews)
      ? (detail.secondaryViews as ResultView[])
      : [];
    const primaryView = detail.primaryView as ResultView | undefined;
    const primaryRows = this.resolveRowsForAnalysisImage(detail.tableRows);
    if (primaryView && primaryRows.length > 0) {
      const source = {
        title: primaryView.title || report?.reportTitle,
        summary: primaryView.description || report?.executiveSummary,
        variant: this.resolveAnalysisImageVariant(primaryView.viewType, report?.variant),
        rows: primaryRows,
        signature: this.buildAnalysisImageSourceSignature(primaryRows),
      };
      usedSignatures.add(source.signature);
      sources.push(source);
    }

    for (const view of secondaryViews) {
      const rows = this.resolveRowsForAnalysisImage(view.rows);
      if (rows.length === 0) {
        continue;
      }

      const source = {
        title: view.title || report?.reportTitle,
        summary: view.description || report?.executiveSummary,
        variant: this.resolveAnalysisImageVariant(view.viewType, report?.variant),
        rows,
        signature: this.buildAnalysisImageSourceSignature(rows),
      };
      if (usedSignatures.has(source.signature)) {
        continue;
      }

      usedSignatures.add(source.signature);
      sources.push(source);
      if (sources.length >= 3) {
        return sources;
      }
    }

    const tableRows = sources.length === 0
      ? this.resolveRowsForAnalysisImage(detail.tableRows)
      : [];
    if (tableRows.length > 0) {
      const source = {
        title: report?.reportTitle,
        summary: report?.executiveSummary,
        variant: report?.variant,
        rows: tableRows,
        signature: this.buildAnalysisImageSourceSignature(tableRows),
      };
      if (!usedSignatures.has(source.signature)) {
        sources.push(source);
      }
    }

    return sources.slice(0, 3);
  }

  /**
   * 按卡片展示价值排序图片来源。
   *
   * 参数说明：`sources` 为已去重的图片来源。
   * 返回值说明：趋势、排行和分布优先于普通明细，保证卡片首屏先看到图表分析。
   */
  private sortAnalysisImageSourcesForCard(
    sources: WecomAnalysisImageSource[],
  ): WecomAnalysisImageSource[] {
    const priorityByVariant: Record<WecomAnalysisImageVariant, number> = {
      trend: 0,
      ranking: 1,
      distribution: 2,
      map: 3,
      summary: 4,
    };

    return [...sources].sort(
      (left, right) =>
        priorityByVariant[left.variant ?? 'summary'] -
        priorityByVariant[right.variant ?? 'summary'],
    );
  }

  /**
   * 规范化企微图片渲染行。
   *
   * 参数说明：`rows` 为主表或二级视图中的未知行集合。
   * 返回值说明：仅返回对象行，过滤空值和非对象值。
   * 调用注意事项：渲染层只接受键值对象，避免数组、字符串等异常数据破坏 SVG 表格。
   */
  private resolveRowsForAnalysisImage(rows: unknown): Array<Record<string, unknown>> {
    if (!Array.isArray(rows)) {
      return [];
    }

    return rows.filter(
      (row): row is Record<string, unknown> =>
        Boolean(row) && typeof row === 'object' && !Array.isArray(row),
    );
  }

  /**
   * 将统一视图类型映射为企微图片展示形态。
   *
   * 参数说明：`viewType` 为统一结果视图类型，`fallbackVariant` 为报告默认形态。
   * 返回值说明：返回图片渲染服务可识别的图形倾向。
   */
  private resolveAnalysisImageVariant(
    viewType: ResultView['viewType'] | 'PRIMARY_TABLE' | undefined,
    fallbackVariant?: WecomAnalysisImageVariant,
  ): WecomAnalysisImageVariant {
    if (viewType === 'LINE_CHART' || viewType === 'BAR_CHART') {
      return 'trend';
    }

    if (viewType === 'PIE_CHART') {
      return 'distribution';
    }

    if (viewType === 'RANKING_TABLE') {
      return 'ranking';
    }

    if (viewType === 'DETAIL_TABLE') {
      return 'summary';
    }

    return fallbackVariant ?? 'summary';
  }

  /**
   * 构造图片区块去重签名。
   *
   * 参数说明：`rows` 为图片区块使用的数据行。
   * 返回值说明：返回稳定短签名，避免不同标题的同源数据重复下发。
   */
  private buildAnalysisImageSourceSignature(
    rows: Array<Record<string, unknown>>,
  ): string {
    const rowSignature = JSON.stringify(
      rows.slice(0, 3).map((row) =>
        Object.keys(row)
          .sort()
          .reduce<Record<string, unknown>>((acc, key) => {
            acc[key] = row[key];
            return acc;
          }, {}),
      ),
    ).slice(0, 360);
    return `${rows.length}|${rowSignature}`;
  }

  /**
   * 为企业微信最终回传构造同源 Markdown。
   *
   * 设计原因：
   * 1. 企业微信应优先消费与 Web 同源的统一结果包，而不是依赖顶层缓存字段是否存在；
   * 2. 当详情对象缺少顶层 `groundedMarkdown` 时，仍然可以根据 `report` 重建最终内容，避免退回成过于简化的流式摘要；
   * 3. 这里只基于已经裁剪后的 `detail.report` / `detail.tableRows` 重建，不会重新取数。
   */
  private resolveWecomFinalMarkdown(
    detail: Record<string, unknown>,
    options?: { preferImageAttachments?: boolean },
  ): string {
    if (process.env.ANALYSIS_MARKDOWN_DELIVERY_ENABLED === 'false') {
      return '';
    }

    const report = detail.report as {
      reportTitle?: string;
      executiveSummary?: string;
      groundedExplanation?: string;
      metricCards?: MetricCard[];
      keyFindings?: AnalysisKeyFinding[];
      nextBestQuestions?: string[];
      trendInsight?: AnalysisTrendInsight;
      forecastInsight?: AnalysisForecastInsight;
      riskInsights?: AnalysisInsightItem[];
      recommendations?: AnalysisRecommendationItem[];
      evidenceSummary?: string;
      scopeSummary?: string;
      temporalScope?: Record<string, unknown>;
      appliedFilters?: Array<{ label: string; value: string }>;
      sourceNotes?: Array<{ key: string; label: string; description: string }>;
      footnotes?: string[];
      variant?: 'ranking' | 'trend' | 'distribution' | 'summary';
    } | undefined;

    if (report?.reportTitle && report.executiveSummary) {
      return buildAnalysisWecomMarkdown({
        title: report.reportTitle,
        summary: report.executiveSummary,
        groundedExplanation: report.groundedExplanation,
        metricCards: report.metricCards ?? [],
        keyFindings: report.keyFindings ?? [],
        nextBestQuestions: report.nextBestQuestions,
        trendInsight: report.trendInsight,
        forecastInsight: report.forecastInsight,
        riskInsights: report.riskInsights,
        recommendations: report.recommendations,
        evidenceSummary: report.evidenceSummary,
        scopeSummary: report.scopeSummary ?? String(detail.scopeSummary ?? ''),
        temporalScope: (detail.temporalScope ?? report.temporalScope) as never,
        rows: (detail.tableRows as Array<Record<string, unknown>> | undefined) ?? [],
        appliedFilters: (
          detail.appliedFilters ?? report.appliedFilters ?? []
        ) as Array<{ label: string; value: string }>,
        sourceNotes: report.sourceNotes,
        footnotes: report.footnotes,
        secondaryViewSummaries: (
          (detail.secondaryViews as Array<{ title?: string; rows?: unknown[]; viewType?: string }> | undefined) ?? []
        ).slice(0, 6).map((item) => ({
          title: item.title ?? '报告区块',
          rowCount: item.rows?.length ?? 0,
          renderType: this.formatAnalysisViewRenderType(item.viewType),
        })),
        variant: report.variant,
        preferImageAttachments: options?.preferImageAttachments === true,
      }).trim();
    }

    return String(detail.groundedMarkdown ?? '').trim();
  }

  private formatAnalysisViewRenderType(viewType?: string): string {
    if (viewType === 'LINE_CHART' || viewType === 'BAR_CHART' || viewType === 'PIE_CHART') {
      return '图表区块';
    }

    if (viewType === 'DETAIL_TABLE' || viewType === 'RANKING_TABLE') {
      return '表格';
    }

    return '指标卡';
  }

  private getOrCreateSession(
    inboundMessage: WecomInboundMessage,
    user: CrmUser,
  ): QuerySessionRecord {
    const currentSession = this.querySessionRepository.findByConversation(
      inboundMessage.externalConversationId,
      user.id,
      inboundMessage.senderId,
    );
    if (currentSession) {
      return this.querySessionRepository.save({
        ...currentSession,
        lastMessageAt: inboundMessage.receivedAt,
        updatedAt: inboundMessage.receivedAt,
      });
    }

    return this.querySessionRepository.save({
      id: buildEntityId('session'),
      channel: 'wecom-bot',
      externalConversationId: inboundMessage.externalConversationId,
      senderId: inboundMessage.senderId,
      requesterId: user.id,
      requesterRoleIds: user.roleIds,
      contextStatus: 'NEW',
      lastMessageAt: inboundMessage.receivedAt,
      pendingSequence: 0,
      createdAt: inboundMessage.receivedAt,
      updatedAt: inboundMessage.receivedAt,
    });
  }

  private saveSessionState(
    session: QuerySessionRecord,
    contextStatus: QuerySessionRecord['contextStatus'],
    overrides?: Partial<QuerySessionRecord>,
  ): QuerySessionRecord {
    const nextSession = this.querySessionRepository.save({
      ...session,
      ...overrides,
      contextStatus,
      updatedAt: new Date().toISOString(),
    });

    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'WECOM_SESSION_STATE_CHANGED',
      actorId: nextSession.requesterId,
      actorRoleIds: nextSession.requesterRoleIds,
      actorType: 'crm-user',
      actorBindingStatus: 'BOUND_CRM',
      channel: 'wecom-bot',
      channelAgentType: 'wecom-bot',
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        scopeSummary: '企业微信会话状态迁移。',
      },
      sessionSnapshot: {
        sessionId: nextSession.id,
        externalConversationId: nextSession.externalConversationId,
        contextStatus: nextSession.contextStatus,
      },
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome: `企业微信会话状态已切换为 ${nextSession.contextStatus}。`,
      actionSummary: '企业微信会话状态已变更。',
      targetType: 'wecom-session',
      targetId: nextSession.id,
      targetSummary: `企业微信会话 ${nextSession.id}`,
      createdAt: new Date().toISOString(),
    });

    return nextSession;
  }

  private audit(
    user: CrmUser,
    eventType: AuditEventType,
    outcome: string,
    sessionSnapshot?: Record<string, unknown>,
  ): void {
    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType,
      ...this.auditEventBuilderService.crmUserActor(user),
      ...this.auditEventBuilderService.channelAgent({
        channel: 'wecom-bot',
        channelAgentType: 'wecom-bot',
      }),
      scopeSnapshot: this.userScopeService.resolveScope(user),
      sessionSnapshot,
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome,
      actionSummary: outcome,
      createdAt: new Date().toISOString(),
    });
  }

  private withConversationAuditSnapshot(
    conversationContext: WecomConversationContextRecord | undefined,
    sessionSnapshot?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    const entryInterpretationSnapshot =
      conversationContext?.workMemory.latestEntryInterpretationSnapshot;
    const workflowRoutingSnapshot =
      conversationContext?.workMemory.latestWorkflowRoutingSnapshot;

    if (
      !entryInterpretationSnapshot &&
      !workflowRoutingSnapshot &&
      !sessionSnapshot
    ) {
      return undefined;
    }

    return {
      entryInterpretationSnapshot,
      workflowRoutingSnapshot,
      ...sessionSnapshot,
    };
  }

  private buildWecomAuditSessionSnapshot(
    inboundMessage: WecomInboundMessage,
  ): Record<string, unknown> {
    return {
      senderId: inboundMessage.senderId,
      rawSenderId: inboundMessage.rawSenderId,
      botId: inboundMessage.botId,
      channelAgentId: inboundMessage.channelAgentId,
      externalConversationId: inboundMessage.externalConversationId,
      channelMessageId: inboundMessage.channelMessageId,
      chatType: inboundMessage.chatType,
    };
  }

  private async resolveWecomAuditContext(
    inboundMessage: WecomInboundMessage,
    fallbackScopeSummary: string,
  ): Promise<{
    actor: ReturnType<AuditEventBuilderService['crmUserActor']>;
    scopeSnapshot: ReturnType<UserScopeService['resolveScope']>;
  }> {
    const mappedUser = await this.crmReadonlyService.getUserByWecomSenderId(
      inboundMessage.senderId,
    );
    if (mappedUser) {
      return {
        actor: this.auditEventBuilderService.crmUserActor(mappedUser),
        scopeSnapshot: this.userScopeService.resolveScope(mappedUser),
      };
    }

    return {
      actor: this.auditEventBuilderService.unboundWecomActor(inboundMessage.senderId),
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        scopeSummary: fallbackScopeSummary,
      },
    };
  }

  private resolveSenderIdFromSnapshot(
    snapshot: Record<string, unknown>,
  ): string | undefined {
    const directSenderId = this.resolveStringValue(
      snapshot.senderId,
      snapshot.userid,
      this.readSnapshotValue(snapshot, ['from', 'userid']),
      this.readSnapshotValue(snapshot, ['sender', 'id']),
      this.readSnapshotValue(snapshot, ['body', 'from', 'userid']),
      this.readSnapshotValue(snapshot, ['body', 'sender', 'id']),
      this.readSnapshotValue(snapshot, ['body', 'userid']),
      this.readSnapshotValue(snapshot, ['body', 'senderId']),
    );
    const botId = this.resolveStringValue(
      snapshot.botId,
      snapshot.aibotid,
      this.readSnapshotValue(snapshot, ['body', 'botId']),
      this.readSnapshotValue(snapshot, ['body', 'aibotid']),
    );

    if (directSenderId && directSenderId !== botId) {
      return directSenderId;
    }

    return undefined;
  }

  private readSnapshotValue(
    snapshot: Record<string, unknown>,
    path: string[],
  ): unknown {
    let current: unknown = snapshot;
    for (const key of path) {
      if (!current || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }
    return current;
  }

  private resolveStringValue(...values: unknown[]): string | undefined {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return undefined;
  }

  private async auditRecoveryIfNeeded(
    result: { recovered: boolean },
    kind: 'identity' | 'storage' | 'data',
    inboundMessage: WecomInboundMessage,
    user?: CrmUser,
  ): Promise<void> {
    if (!result.recovered) {
      return;
    }

    const auditContext = user
      ? {
          actor: this.auditEventBuilderService.crmUserActor(user),
          scopeSnapshot: this.userScopeService.resolveScope(user),
        }
      : await this.resolveWecomAuditContext(
          inboundMessage,
          '企业微信维护期已恢复。',
        );

    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'MAINTENANCE_RECOVERED',
      ...auditContext.actor,
      ...this.auditEventBuilderService.wecomChannelAgent(inboundMessage),
      scopeSnapshot: auditContext.scopeSnapshot,
      sessionSnapshot: {
        ...this.buildWecomAuditSessionSnapshot(inboundMessage),
        recoveredKind: kind,
      },
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome: `企业微信 ${kind} 依赖已恢复。`,
      actionSummary: `企业微信 ${kind} 依赖已恢复。`,
      targetType: 'wecom-dependency',
      targetId: kind,
      targetSummary: `企业微信 ${kind} 依赖`,
      createdAt: new Date().toISOString(),
    });
  }

  private async startProgressFeedback(
    receiptId: string,
    sessionId: string,
    inboundMessage: WecomInboundMessage,
    questionText?: string,
  ): Promise<WecomProgressFeedbackHandle> {
    const timers: NodeJS.Timeout[] = [];
    let cancelled = false;

    const dispatchSafely = async (blocks: StreamBlock[]): Promise<void> => {
      if (cancelled) {
        return;
      }

      try {
        await this.wecomStreamDispatcherService.dispatch({
          receiptId,
          sessionId,
          target: this.buildDispatchTarget(inboundMessage, receiptId),
          blocks,
          finalize: false,
        });
      } catch {
        // 进度反馈失败不阻塞主链路，最终结果仍会继续尝试回传。
      }
    };

    await dispatchSafely(
      this.wecomStreamDispatcherService.buildImmediateAckBlocks(questionText),
    );

    const stages: Array<{
      delayMs: number;
      stage: 'thinking' | 'querying' | 'reporting';
    }> = [
      { delayMs: 1500, stage: 'thinking' },
      { delayMs: 4000, stage: 'querying' },
      { delayMs: 7000, stage: 'reporting' },
    ];

    for (const item of stages) {
      const timer = setTimeout(() => {
        void dispatchSafely(
          this.wecomStreamDispatcherService.buildProgressStageBlocks(item.stage),
        );
      }, item.delayMs);
      timers.push(timer);
    }

    return {
      cancel: () => {
        cancelled = true;
        for (const timer of timers) {
          clearTimeout(timer);
        }
      },
    };
  }

  private buildUserFacingBlockedReply(
    blockedReason: string,
    inboundMessage: WecomInboundMessage,
  ): string {
    const questionText = inboundMessage.messageText?.trim().toLowerCase() ?? '';
    const isGreeting =
      questionText === '你好' ||
      questionText === '您好' ||
      questionText === 'hi' ||
      questionText === 'hello' ||
      questionText === '在吗';

    if (blockedReason.includes('未绑定 CRM 身份')) {
      if (isGreeting) {
        return `你好，我是 CRM 智能移动助手。当前你的企业微信账号（${inboundMessage.senderId}）尚未形成可用的 CRM 映射，所以暂时不能查询业务数据。请先执行企业微信目录同步，或检查 CRM wx_users / wx_user_maps 是否已生成后再试。`;
      }

      return `当前企业微信账号（${inboundMessage.senderId}）尚未形成可用的 CRM 映射，请先执行企业微信目录同步，或检查 CRM wx_users / wx_user_maps 是否已生成。`;
    }

    if (blockedReason.includes('无权使用企业微信问数能力')) {
      return '当前账号暂未开通企业微信问数权限，请联系管理员确认角色与渠道权限。';
    }

    const helpPromptScene =
      resolveWecomHelpPromptSceneFromBlockedReason(blockedReason);
    if (helpPromptScene) {
      return buildWecomHelpPrompt({
        scene: helpPromptScene,
      });
    }

    return blockedReason;
  }

  private uniqueStrings(values: Array<string | undefined | null>): string[] {
    return Array.from(
      new Set(
        values
          .map((item) => item?.trim())
          .filter((item): item is string => Boolean(item)),
      ),
    );
  }

  private uniqueByName<T>(
    values: T[],
    getName: (value: T) => string | undefined,
  ): T[] {
    const seenNames = new Set<string>();
    const uniqueValues: T[] = [];

    for (const value of values) {
      const normalizedName = getName(value)?.trim();
      if (!normalizedName || seenNames.has(normalizedName)) {
        continue;
      }

      seenNames.add(normalizedName);
      uniqueValues.push(value);
    }

    return uniqueValues;
  }

  private looksLikeCompanyName(text: string): boolean {
    return /(?:股份有限公司|有限公司|分公司|子公司|集团|公司|科技|电子|网络|制造|银行|教育|服务)$/u.test(
      text.trim(),
    );
  }

  private async lookupCompaniesForDailyReport(
    user: CrmUser,
    companyNames: string[],
    accessToken?: string,
  ): Promise<
    Array<{
      queryName: string;
      totalCount: number;
      matchedCompanyNames: string[];
      summary: string;
    }>
  > {
    const lookupNames = this.uniqueStrings(companyNames);
    const lookupResults = await Promise.all(
      lookupNames.map(async (companyName) => {
        const result = await this.opportunityLookupService.lookupByCompanyName(
          user,
          companyName,
          {
            limit: 3,
            accessToken,
          },
        );

        return {
          queryName: companyName,
          totalCount: result.totalCount,
          matchedCompanyNames: result.matchedCompanyNames,
          summary: result.summary,
        };
      }),
    );

    return lookupResults;
  }

  private buildDailyReportEntityLookupQueryLines(
    companyNames: string[],
    projectNames: string[],
    lookupResults: Array<{
      queryName: string;
      totalCount: number;
      matchedCompanyNames: string[];
      summary: string;
    }>,
  ): string[] {
    const lines: string[] = [];

    if (companyNames.length > 0) {
      lines.push(`识别公司：${this.uniqueStrings(companyNames).join('、')}`);
    } else {
      lines.push('识别公司：未识别');
    }

    if (projectNames.length > 0) {
      lines.push(`识别项目：${this.uniqueStrings(projectNames).join('、')}`);
    } else {
      lines.push('识别项目：未识别');
    }

    if (lookupResults.length === 0) {
      lines.push('公司查询：未执行');
      return lines;
    }

    for (const result of lookupResults) {
      const matchedCompanyText = result.matchedCompanyNames.length > 0
        ? `，命中公司：${this.uniqueStrings(result.matchedCompanyNames).join('、')}`
        : '';
      lines.push(`公司查询「${result.queryName}」：${result.totalCount} 条${matchedCompanyText}`);
      lines.push(`查询摘要：${result.summary}`);
    }

    return lines;
  }

  private buildDispatchTarget(
    inboundMessage: WecomInboundMessage,
    streamId: string,
  ) {
    return {
      chatType: inboundMessage.chatType,
      deliveryTargetId: inboundMessage.deliveryTargetId,
      senderId: inboundMessage.senderId,
      externalConversationId: inboundMessage.externalConversationId,
      replyFrameHeaders: inboundMessage.replyFrameHeaders,
      streamId,
    };
  }
}

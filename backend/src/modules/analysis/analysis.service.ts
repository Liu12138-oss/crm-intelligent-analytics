import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import type {
  AccessPolicyRecord,
  AiEntryInterpretationSnapshot,
  AiWorkflowRoutingSnapshot,
  AnalysisRequestRecord,
  ChannelType,
  CrmUser,
  AnalysisRoute,
  AnalysisExecutionMode,
  AnalysisIntent,
  AnalysisResultRecord,
  QuerySourceType,
  ScopeSnapshot,
} from '../../shared/types/domain';
import { buildEntityId } from '../../shared/utils/id.util';
import { AuditEventRepository } from '../audit/audit-event.repository';
import { AccessPolicyRepository } from '../governance/access-policy.repository';
import { AccessDecisionService } from '../governance/access-decision.service';
import { QueryTemplateRepository } from '../query-assets/query-template.repository';
import { RecentQueryRepository } from '../query-assets/recent-query.repository';
import { QuerySessionRepository } from '../sessions/query-session.repository';
import { SessionQueueService } from '../sessions/session-queue.service';
import { AnalysisIntentService } from './analysis-intent.service';
import { AnalysisRequestRepository } from './analysis-request.repository';
import { AnalysisResponseMapper } from './analysis-response.mapper';
import { AnalysisWorkflowOrchestrator } from './analysis-workflow.orchestrator';
import { AnalysisChannelPresenterService } from './analysis-channel-presenter.service';
import { AnalysisRichReportService } from './analysis-rich-report.service';
import { ClarificationService } from './clarification.service';
import { AnalysisQueryKnowledgeService } from './analysis-query-knowledge.service';
import {
  LowConfidenceQuestionError,
  OpenApiCapabilityGapError,
} from './analysis.errors';
import { QueryRiskGuardService } from './query-risk-guard.service';
import { AiGatewayService } from './ai-gateway.service';
import { AiContextPolicyService } from '../ai-models/ai-context-policy.service';
import { SqlAuditContextService } from '../audit/sql-audit-context.service';
import { AnalysisScopeModeService } from './analysis-scope-mode.service';
import { AnalysisRouteConfigService } from './analysis-route-config.service';
import {
  createAiEntryInterpretationSnapshot,
  createAiWorkflowRoutingSnapshot,
} from '../../shared/utils/ai-entry-intent.util';
import {
  buildAnalysisGroundedMarkdown,
  buildAnalysisMarkdownOutline,
  buildAnalysisWecomMarkdown,
} from './analysis-markdown.util';
import { buildTemporalSlotFromScope } from './temporal-scope.util';

interface CreateAnalysisPayload {
  querySource: QuerySourceType;
  channel: ChannelType;
  questionText?: string;
  templateId?: string;
  historyId?: string;
  followUpQueryId?: string;
  clarificationAnswer?: Record<string, string>;
  sessionId?: string;
  executionMode?: AnalysisExecutionMode;
  analysisRoute?: AnalysisRoute | 'DEFAULT';
}

const ANALYSIS_RICH_REPORT_DEFAULT_WAIT_MS = 55000;
const ANALYSIS_RICH_REPORT_MAX_WAIT_MS = 60000;

@Injectable()
export class AnalysisService {
  constructor(
    private readonly analysisLoggerService: AnalysisLoggerService,
    private readonly accessPolicyRepository: AccessPolicyRepository,
    private readonly accessDecisionService: AccessDecisionService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly analysisScopeModeService: AnalysisScopeModeService,
    private readonly analysisRouteConfigService: AnalysisRouteConfigService,
    private readonly queryTemplateRepository: QueryTemplateRepository,
    private readonly recentQueryRepository: RecentQueryRepository,
    private readonly querySessionRepository: QuerySessionRepository,
    private readonly sessionQueueService: SessionQueueService,
    private readonly analysisIntentService: AnalysisIntentService,
    private readonly analysisRequestRepository: AnalysisRequestRepository,
    private readonly clarificationService: ClarificationService,
    private readonly analysisQueryKnowledgeService: AnalysisQueryKnowledgeService,
    private readonly queryRiskGuardService: QueryRiskGuardService,
    private readonly analysisWorkflowOrchestrator: AnalysisWorkflowOrchestrator,
    private readonly analysisRichReportService: AnalysisRichReportService,
    private readonly analysisChannelPresenterService: AnalysisChannelPresenterService,
    private readonly analysisResponseMapper: AnalysisResponseMapper,
    private readonly aiGatewayService: AiGatewayService,
    private readonly aiContextPolicyService: AiContextPolicyService,
    private readonly sqlAuditContextService: SqlAuditContextService,
  ) {}

  createSessionIfNeeded(user: CrmUser, channel: ChannelType, sessionId?: string): string {
    if (sessionId && this.querySessionRepository.findById(sessionId)) {
      return sessionId;
    }

    const now = new Date().toISOString();
    const nextSessionId = buildEntityId('session');
    this.querySessionRepository.save({
      id: nextSessionId,
      channel,
      requesterId: user.id,
      requesterRoleIds: user.roleIds,
      contextStatus: 'ACTIVE',
      lastMessageAt: now,
      pendingSequence: 0,
      createdAt: now,
      updatedAt: now,
      webSessionKey: channel === 'web-console' ? nextSessionId : undefined,
      externalConversationId: channel === 'wecom-bot' ? nextSessionId : undefined,
    });
    return nextSessionId;
  }

  async createQuery(
    user: CrmUser,
    payload: CreateAnalysisPayload,
  ): Promise<Record<string, unknown>> {
    const policy = this.accessPolicyRepository.getCurrent();
    const scopeSnapshot = this.analysisScopeModeService.resolve(user).scopeSnapshot;
    this.ensureUserAllowed(user, policy, payload.channel, payload, scopeSnapshot);

    const sessionId = this.createSessionIfNeeded(user, payload.channel, payload.sessionId);
    const questionText = this.resolveQuestionText(payload);
    const requestId = buildEntityId('query');
    const createdAt = new Date().toISOString();
    const expiredFollowUpResponse = this.tryHandleExpiredFollowUpContext({
      user,
      payload,
      requestId,
      sessionId,
      createdAt,
      scopeSnapshot,
    });
    if (expiredFollowUpResponse) {
      return expiredFollowUpResponse;
    }
    const explanationReuse = await this.tryReuseResultForExplanation({
      user,
      payload,
      requestId,
      sessionId,
      questionText,
      scopeSnapshot,
      createdAt,
    });
    if (explanationReuse) {
      return explanationReuse;
    }

    const executableQuestionText = this.resolveExecutableQuestionTextForAnalysis(
      user,
      payload,
      questionText,
    );
    const intentParseResult =
      await this.analysisIntentService.parseWithEntrySnapshot(
        executableQuestionText,
        payload.channel,
      );
    const intent = this.applyRecentRerunTemporalScope(
      intentParseResult.intent,
      payload,
    );
    const analysisRoute = this.analysisRouteConfigService.resolveRoute(
      payload.analysisRoute,
    );
    const executionMode = await this.resolveExecutionMode({
      requestedMode: payload.executionMode,
      questionText: executableQuestionText,
      channel: payload.channel,
    });
    this.analysisLoggerService.logStep('分析路由已确定', {
      queryId: requestId,
      requesterId: user.id,
      channel: payload.channel,
      analysisRoute,
      executionMode,
      questionText: executableQuestionText,
    });

    const baseRequest: AnalysisRequestRecord = {
      id: requestId,
      questionText,
      requesterId: user.id,
      requesterRoleIds: user.roleIds,
      sessionId,
      entryChannel: payload.channel,
      querySource: payload.querySource,
      templateId: payload.templateId,
      rerunFromHistoryId: payload.historyId,
      organizationScope: scopeSnapshot.organizationIds,
      departmentScope: scopeSnapshot.departmentIds,
      ownerScope: scopeSnapshot.ownerIds,
      intentDomain: intent.domain,
      metrics: intent.metrics,
      dimensions: intent.dimensions,
      filters: intent.filters,
      temporalSlot: intent.temporalSlot,
      followUpToRequestId: payload.followUpQueryId,
      missingConditions: intent.missingConditions,
      entryInterpretationSnapshot: intentParseResult.entryInterpretationSnapshot,
      workflowRoutingSnapshot: this.buildWorkflowRoutingSnapshot({
        targetWorkflow: 'ANALYSIS_QUERY_EXECUTION',
        finalProgram: 'analysis-service.createQuery',
        requiresConfirmation: false,
        executionMode,
      }),
      analysisRoute,
      executionMode,
      status: 'RECEIVED',
      createdAt,
    };

    const knowledgeContext = this.analysisQueryKnowledgeService.buildKnowledgeContext(
      executableQuestionText,
    );
    if (knowledgeContext.blockedReason) {
      return this.blockRequest(
        baseRequest,
        scopeSnapshot,
        new Error(knowledgeContext.blockedReason),
      );
    }

    try {
      this.queryRiskGuardService.ensureQuestionSafe(executableQuestionText);
    } catch (error) {
      return this.blockRequest(baseRequest, scopeSnapshot, error);
    }

    if (intent.requestedAction === 'BLOCK') {
      return this.blockRequest(
        baseRequest,
        scopeSnapshot,
        new Error(intent.blockReason ?? '当前一期仅支持只读分析问题。'),
      );
    }

    if (intent.missingConditions.length > 0) {
      const clarificationPrompt = this.clarificationService.buildPrompt(
        intent.missingConditions,
      );
      const clarificationRequest: AnalysisRequestRecord = {
        ...baseRequest,
        clarificationPrompt,
        workflowRoutingSnapshot: this.buildWorkflowRoutingSnapshot({
          targetWorkflow: 'ANALYSIS_CLARIFICATION',
          finalProgram: 'clarification-service.buildPrompt',
          requiresConfirmation: false,
        }),
        status: 'CLARIFICATION_REQUIRED',
      };
      this.analysisRequestRepository.saveRequest(clarificationRequest);
      this.auditEventRepository.create({
        id: buildEntityId('audit'),
        eventType: 'CLARIFICATION_REQUESTED',
        actorId: user.id,
        actorRoleIds: user.roleIds,
        relatedRequestId: requestId,
        originalQuestion: questionText,
        scopeSnapshot,
        sessionSnapshot: {
          entryInterpretationSnapshot: clarificationRequest.entryInterpretationSnapshot,
          workflowRoutingSnapshot: clarificationRequest.workflowRoutingSnapshot,
        },
        riskLevel: 'LOW',
        reviewStatus: 'CONFIRMED',
        outcome: clarificationPrompt,
        createdAt,
      });
      return {
        queryId: requestId,
        status: 'CLARIFICATION_REQUIRED',
        clarificationPrompt,
        missingConditions: intent.missingConditions,
        sessionId,
        createdAt,
      };
    }

    if (intent.confidence === 'LOW') {
      return this.blockRequest(
        baseRequest,
        scopeSnapshot,
        new LowConfidenceQuestionError(),
      );
    }

    const queueState = this.sessionQueueService.tryEnter(
      requestId,
      policy.maxConcurrentQueries,
      sessionId,
    );
    if (!queueState.accepted) {
      const queuedRequest: AnalysisRequestRecord = {
        ...baseRequest,
        status: 'QUEUED',
      };
      this.analysisRequestRepository.saveRequest(queuedRequest);
      return {
        queryId: requestId,
        status: 'QUEUED',
        queueNotice: queueState.queueNotice,
        sessionId,
        createdAt,
      };
    }

    try {
      const orchestration = await this.sqlAuditContextService.run(
        {
          actorId: user.id,
          actorRoleIds: user.roleIds,
          channel: payload.channel,
          sessionId,
          requestId,
          moduleKey: 'analysis-workbench',
          programName: 'AnalysisWorkflowOrchestrator.run',
          executionMode,
          executionSource: 'CRM_OFFICIAL_API',
        },
        async () =>
          this.analysisWorkflowOrchestrator.run({
            requestId,
            questionText: executableQuestionText,
            channel: payload.channel,
            user,
            intent,
            scopeSnapshot,
            policy,
            executionMode,
            analysisRoute,
          }),
      );
      const completedAt = new Date().toISOString();
      const requestRecord: AnalysisRequestRecord = {
        ...baseRequest,
        filters: {
          ...intent.filters,
          organizationIds: scopeSnapshot.organizationIds,
          departmentIds: scopeSnapshot.departmentIds,
          ownerIds: scopeSnapshot.ownerIds,
        },
        temporalSlot: intent.temporalSlot,
        generatedQuery: orchestration.generatedQueryText,
        resultConsistencyToken: orchestration.result.consistencyToken,
        entryInterpretationSnapshot:
          orchestration.result.entryInterpretationSnapshot ??
          baseRequest.entryInterpretationSnapshot,
        workflowRoutingSnapshot:
          orchestration.result.workflowRoutingSnapshot ??
          this.buildWorkflowRoutingSnapshot({
            targetWorkflow: 'ANALYSIS_QUERY_EXECUTION',
            finalProgram: 'analysis-workflow-orchestrator.run',
            requiresConfirmation: false,
            executionMode: orchestration.executionMode,
          }),
        executionMode: orchestration.executionMode,
        analysisRoute: orchestration.analysisRoute,
        executionSource: orchestration.executionSource,
        preferredSource: orchestration.preferredSource,
        matchedAdapter: orchestration.matchedAdapter,
        gapReason: orchestration.gapReason,
        executionSnapshot: orchestration.executionSnapshot,
        executionTraceSummary: orchestration.result.executionTraceSummary,
        resultBundleSnapshot: orchestration.resultBundleSnapshot,
        insightSnapshot: orchestration.insightSnapshot,
        deliverySnapshot: orchestration.deliverySnapshot,
        status: 'RETURNED',
        completedAt,
      };

      this.analysisRequestRepository.saveRequest(requestRecord);
      this.analysisRequestRepository.saveResult(orchestration.result);
      this.saveHistoryRecord(
        user,
        payload,
        requestId,
        questionText,
        orchestration.result.summary,
        completedAt,
        {
          executionMode: orchestration.executionMode,
          analysisRoute: orchestration.analysisRoute,
          executionSource: orchestration.executionSource,
          matchedAdapter: orchestration.matchedAdapter,
          gapReason: orchestration.gapReason,
        },
        orchestration.result.temporalScope,
      );
      this.bumpTemplateStats(payload.templateId, completedAt);
      this.auditEventRepository.create({
        id: buildEntityId('audit'),
        eventType:
          payload.querySource === 'COMMON_TEMPLATE'
            ? 'TEMPLATE_EXECUTED'
            : payload.querySource === 'RECENT_RERUN'
              ? 'HISTORY_RERUN'
              : 'QUERY_SUCCEEDED',
        actorId: user.id,
        actorRoleIds: user.roleIds,
        actorType: 'crm-user',
        actorDisplayName: user.name,
        actorExternalId: user.wecomSenderId,
        actorBindingStatus: 'BOUND_CRM',
        channel: payload.channel,
        relatedRequestId: requestId,
        relatedTemplateId: payload.templateId,
        relatedHistoryId: payload.historyId,
        originalQuestion: questionText,
        querySnapshot: orchestration.generatedQueryText,
        scopeSnapshot,
        sessionSnapshot: {
          entryInterpretationSnapshot: requestRecord.entryInterpretationSnapshot,
          workflowRoutingSnapshot: requestRecord.workflowRoutingSnapshot,
          executionSnapshot: orchestration.executionSnapshot,
          executionTraceSummary: orchestration.result.executionTraceSummary,
          resultBundleSnapshot: orchestration.resultBundleSnapshot,
          insightSnapshot: orchestration.insightSnapshot,
          deliverySnapshot: orchestration.deliverySnapshot,
        },
        resultCount: orchestration.result.rowCount,
        riskLevel: 'LOW',
        reviewStatus: 'CONFIRMED',
        outcome: orchestration.result.summary ?? orchestration.result.title,
        actionSummary:
          payload.querySource === 'COMMON_TEMPLATE'
            ? '执行常用查询模板。'
            : payload.querySource === 'RECENT_RERUN'
              ? '重新运行历史查询。'
              : '提交智能问数查询。',
        targetType: 'analysis-query',
        targetId: requestId,
        targetSummary: questionText,
        createdAt: completedAt,
      });

      this.analysisLoggerService.logStep('分析请求完成', {
        queryId: requestId,
        requesterId: user.id,
        channel: payload.channel,
        taskCount: orchestration.compiledTasks.length,
        analysisRoute: orchestration.analysisRoute,
        executionSource: orchestration.result.executionSource,
        matchedAdapter: orchestration.result.matchedAdapter,
        appliedFilters: orchestration.result.appliedFilters,
      });

      return {
        queryId: requestId,
        status: 'RETURNED',
        analysisRoute: orchestration.analysisRoute,
        sessionId,
        createdAt,
      };
    } catch (error) {
      return this.blockRequest(baseRequest, scopeSnapshot, error);
    } finally {
      this.sessionQueueService.leave(requestId);
    }
  }

  getQueryDetail(
    user: CrmUser,
    queryId: string,
    channel: ChannelType = 'web-console',
  ): Record<string, unknown> {
    if (
      channel === 'web-console' &&
      !this.accessDecisionService.hasVisibleMenu(user, 'analysis-workbench')
    ) {
      throw new ForbiddenException('当前用户无权访问智能分析结果详情。');
    }

    const requestRecord = this.analysisRequestRepository.findRequestById(queryId);
    if (!requestRecord || requestRecord.requesterId !== user.id) {
      throw new NotFoundException('分析请求不存在。');
    }

    const result = this.analysisRequestRepository.findResultByRequestId(queryId);
    if (!result) {
      return {
        queryId: requestRecord.id,
        status: requestRecord.status,
        entryInterpretationSnapshot: requestRecord.entryInterpretationSnapshot,
        workflowRoutingSnapshot: requestRecord.workflowRoutingSnapshot,
        analysisRoute: requestRecord.analysisRoute,
        executionMode: requestRecord.executionMode,
        executionSource: requestRecord.executionSource,
        matchedAdapter: requestRecord.matchedAdapter,
        gapReason: requestRecord.gapReason,
        clarificationPrompt: requestRecord.clarificationPrompt,
        missingConditions: requestRecord.missingConditions,
        createdAt: requestRecord.createdAt,
        completedAt: requestRecord.completedAt,
      };
    }

    const presentedResult = this.analysisChannelPresenterService.presentResult(result, channel);
    const availableActions = this.resolveAvailableActions(
      user,
      presentedResult.availableActions,
    );
    const reportPayload = presentedResult.report
      ? {
          ...presentedResult.report,
          availableActions,
        }
      : undefined;

    return {
      queryId: requestRecord.id,
      status: requestRecord.status,
      questionText: requestRecord.questionText,
      title: presentedResult.title,
      summary: presentedResult.summary,
      analysisRoute: requestRecord.analysisRoute ?? presentedResult.analysisRoute,
      executionMode: requestRecord.executionMode ?? presentedResult.executionMode,
      executionSource: requestRecord.executionSource ?? presentedResult.executionSource,
      preferredSource: requestRecord.preferredSource ?? presentedResult.preferredSource,
      matchedAdapter: requestRecord.matchedAdapter ?? presentedResult.matchedAdapter,
      gapReason: requestRecord.gapReason ?? presentedResult.gapReason,
      entryInterpretationSnapshot:
        requestRecord.entryInterpretationSnapshot ?? presentedResult.entryInterpretationSnapshot,
      workflowRoutingSnapshot:
        requestRecord.workflowRoutingSnapshot ?? presentedResult.workflowRoutingSnapshot,
      report: reportPayload,
      temporalScope: presentedResult.temporalScope,
      keyFindings: presentedResult.keyFindings,
      scopeSummary: presentedResult.scopeSummary,
      appliedFilters: presentedResult.appliedFilters,
      metricCards: presentedResult.metricCards,
      primaryView: presentedResult.primaryView,
      secondaryViews: presentedResult.secondaryViews,
      tableRows: presentedResult.tableRows,
      rowCount: presentedResult.rowCount,
      dataFreshnessAt: presentedResult.dataFreshnessAt,
      consistencyToken: presentedResult.consistencyToken,
      explanation: presentedResult.explanation,
      groundedExplanation: presentedResult.groundedExplanation,
      nextBestQuestions: presentedResult.nextBestQuestions,
      groundedMarkdown: presentedResult.groundedMarkdown,
      wecomMarkdown: presentedResult.wecomMarkdown,
      markdownOutline: presentedResult.markdownOutline,
      executionSnapshot: requestRecord.executionSnapshot ?? presentedResult.executionSnapshot,
      executionTraceSummary:
        requestRecord.executionTraceSummary ?? presentedResult.executionTraceSummary,
      resultBundleSnapshot:
        requestRecord.resultBundleSnapshot ?? presentedResult.resultBundleSnapshot,
      insightSnapshot: requestRecord.insightSnapshot ?? presentedResult.insightSnapshot,
      deliverySnapshot: requestRecord.deliverySnapshot ?? presentedResult.deliverySnapshot,
      emptyReason: presentedResult.emptyReason,
      availableActions,
      streamBlocks: presentedResult.streamBlocks,
      createdAt: requestRecord.createdAt,
      completedAt: requestRecord.completedAt,
    };
  }

  async getQueryReport(
    user: CrmUser,
    queryId: string,
    waitMs = ANALYSIS_RICH_REPORT_DEFAULT_WAIT_MS,
  ): Promise<Record<string, unknown>> {
    const requestRecord = this.analysisRequestRepository.findRequestById(queryId);
    if (!requestRecord || requestRecord.requesterId !== user.id) {
      throw new NotFoundException('分析请求不存在。');
    }

    let latestResult = this.analysisRequestRepository.findResultByRequestId(queryId);

    if (!latestResult) {
      return {
        queryId,
        status: 'PENDING',
      };
    }

    if (this.shouldWaitRichReport(latestResult)) {
      try {
        latestResult = await Promise.race([
          this.analysisRichReportService.enrich(latestResult),
          new Promise<AnalysisResultRecord>((_, reject) => {
            setTimeout(
              () => reject(new Error('analysis-rich-report-timeout')),
              Number.isFinite(waitMs) && waitMs > 0
                ? Math.min(waitMs, ANALYSIS_RICH_REPORT_MAX_WAIT_MS)
                : ANALYSIS_RICH_REPORT_DEFAULT_WAIT_MS,
            );
          }),
        ]);
        this.analysisRequestRepository.saveResult(latestResult);
      } catch {
        return {
          queryId,
          status: 'PENDING',
        };
      }
    }

    const detail = this.getQueryDetail(user, queryId);
    return {
      queryId,
      status: 'READY',
      report: detail.report,
      keyFindings: detail.keyFindings,
      groundedMarkdown: detail.groundedMarkdown,
      wecomMarkdown: detail.wecomMarkdown,
      markdownOutline: detail.markdownOutline,
      completedAt: detail.completedAt,
    };
  }

  private shouldWaitRichReport(result: AnalysisResultRecord): boolean {
    if (this.hasLegacyUnavailableReport(result)) {
      return true;
    }

    return !(
      result.report.detailMarkdown ||
      result.report.analysisConfidence ||
      result.report.forecastInsight ||
      result.report.recommendations?.length
    );
  }

  /**
   * 识别历史缓存中的旧版“非空结果不可预测”报告，读取时触发重新生成。
   *
   * @param result 已保存的查询结果记录。
   * @returns 有真实结果但预测或阅读稿仍是旧降级口径时返回 `true`。
   */
  private hasLegacyUnavailableReport(result: AnalysisResultRecord): boolean {
    const hasResultFacts =
      (result.tableRows ?? []).length > 0 ||
      (result.metricCards ?? []).some(
        (item) => item.value !== undefined && item.value !== null && item.value !== '',
      );
    if (!hasResultFacts) {
      return false;
    }

    const reportText = [
      result.report.forecastInsight?.status,
      result.report.forecastInsight?.summary,
      result.report.trendInsight?.summary,
      result.report.detailMarkdown,
      result.report.workbenchMarkdown,
      result.report.groundedMarkdown,
    ]
      .filter(Boolean)
      .join('\n');

    return /UNAVAILABLE|时间序列不足|预测暂不可用|不具备预测条件|不可预测|不能预测|样本点偏少/u.test(
      reportText,
    );
  }

  private resolveQuestionText(payload: CreateAnalysisPayload): string {
    if (payload.querySource === 'COMMON_TEMPLATE' && payload.templateId) {
      const template = this.queryTemplateRepository.findById(payload.templateId);
      if (!template) {
        throw new NotFoundException('查询模板不存在。');
      }
      return template.defaultQuestionText;
    }

    if (payload.querySource === 'RECENT_RERUN' && payload.historyId) {
      const history = this.recentQueryRepository.findById(payload.historyId);
      if (!history) {
        throw new NotFoundException('最近查询记录不存在。');
      }
      return payload.questionText ?? history.questionText;
    }

    if (!payload.questionText) {
      throw new NotFoundException('当前请求缺少问题内容。');
    }

    return payload.questionText;
  }

  /**
   * 为改条件追问补齐上一轮查询主题。
   *
   * 设计原因：用户在追问里常说“改成一月份”“只看华东区”，这类短句本身缺少指标和对象；
   * 执行前必须把上一轮问题合并进 AI 理解层，但审计和最近查询仍保留用户本轮原文。
   */
  private resolveExecutableQuestionTextForAnalysis(
    user: CrmUser,
    payload: CreateAnalysisPayload,
    questionText: string,
  ): string {
    if (payload.channel !== 'web-console' || !payload.followUpQueryId) {
      return questionText;
    }

    const sourceRequest = this.analysisRequestRepository.findRequestById(
      payload.followUpQueryId,
    );
    if (!sourceRequest || sourceRequest.requesterId !== user.id) {
      throw new NotFoundException('上一轮分析结果不存在。');
    }

    return this.clarificationService.mergeFollowUpQuestion(
      sourceRequest.questionText,
      questionText,
    );
  }

  private ensureUserAllowed(
    user: CrmUser,
    policy: AccessPolicyRecord,
    channel: ChannelType,
    payload: Pick<CreateAnalysisPayload, 'followUpQueryId'>,
    scopeSnapshot: ScopeSnapshot,
  ): void {
    const decision = this.accessDecisionService.buildDecision(user, channel);
    if (!policy.enabledChannels.includes(channel) || decision.state === 'CHANNEL_DISABLED') {
      this.auditEventRepository.create({
        id: buildEntityId('audit'),
        eventType: 'ACCESS_CHANNEL_DENIED',
        actorId: user.id,
        actorRoleIds: user.roleIds,
        permissionKey: channel,
        resourceType: 'analysis-query',
        channel,
        scopeSnapshot,
        riskLevel: 'LOW',
        reviewStatus: 'CONFIRMED',
        outcome: '当前入口未开放。',
        failureReason: '当前入口未开放。',
        createdAt: new Date().toISOString(),
      });
      throw new ForbiddenException('当前入口未开放。');
    }

    const requiredAction =
      channel === 'wecom-bot'
        ? 'wecom.analysis.use'
        : payload.followUpQueryId
          ? 'analysis.follow_up'
          : 'analysis.use';

    if (!decision.allowed || !this.accessDecisionService.hasAction(user, requiredAction)) {
      this.auditEventRepository.create({
        id: buildEntityId('audit'),
        eventType: 'ACCESS_ACTION_DENIED',
        actorId: user.id,
        actorRoleIds: user.roleIds,
        permissionKey: requiredAction,
        resourceType: 'analysis-query',
        channel,
        scopeSnapshot,
        riskLevel: 'LOW',
        reviewStatus: 'CONFIRMED',
        outcome: '当前用户无权使用智能分析能力。',
        failureReason: '当前用户无权使用智能分析能力。',
        createdAt: new Date().toISOString(),
      });
      throw new ForbiddenException('当前用户无权使用智能分析能力。');
    }
  }

  /**
   * 结果页动作需要与统一权限矩阵保持一致，避免前端继续展示已撤销的追问或导出入口。
   */
  private resolveAvailableActions(
    user: CrmUser,
    availableActions: Array<{ actionType: string; enabled: boolean; reason?: string }> | undefined,
  ): Array<{ actionType: string; enabled: boolean; reason?: string }> {
    return (availableActions ?? []).map((item) => {
      if (item.actionType === 'FOLLOW_UP' && !this.accessDecisionService.hasAction(user, 'analysis.follow_up')) {
        return {
          ...item,
          enabled: false,
          reason: '当前用户无权继续追问。',
        };
      }

      if (item.actionType === 'EXPORT' && !this.accessDecisionService.hasAction(user, 'analysis.export')) {
        return {
          ...item,
          enabled: false,
          reason: '当前用户无导出权限。',
        };
      }

      return item;
    });
  }

  private async tryReuseResultForExplanation(params: {
    user: CrmUser;
    payload: CreateAnalysisPayload;
    requestId: string;
    sessionId: string;
    questionText: string;
    scopeSnapshot: ScopeSnapshot;
    createdAt: string;
  }): Promise<Record<string, unknown> | undefined> {
    if (
      params.payload.channel !== 'web-console' ||
      !params.payload.followUpQueryId
    ) {
      return undefined;
    }

    const sourceRequest = this.analysisRequestRepository.findRequestById(
      params.payload.followUpQueryId,
    );
    const sourceResult = this.analysisRequestRepository.findResultByRequestId(
      params.payload.followUpQueryId,
    );
    if (!sourceRequest || !sourceResult || sourceRequest.requesterId !== params.user.id) {
      throw new NotFoundException('上一轮分析结果不存在。');
    }

    const latestQuestion = this.aiContextPolicyService.trimLatestQuestion(
      sourceRequest.questionText,
    );
    const latestSummary = this.aiContextPolicyService.trimLatestSummary(
      sourceResult.groundedExplanation ?? sourceResult.summary ?? sourceResult.title,
    );
    const followUpIntent = await this.aiGatewayService.classifyAnalysisFollowUpIntent({
      questionText: params.questionText,
      latestQuestion,
      latestSummary,
      channel: params.payload.channel,
    });
    if (followUpIntent !== 'EXPLAIN_RESULT') {
      return undefined;
    }

    const completedAt = new Date().toISOString();
    const groundedExplanation = [
      '本次解释型追问复用上一轮结果包，不重新发起数据读取。',
      sourceResult.groundedExplanation ?? sourceResult.explanation ?? sourceResult.summary ?? sourceResult.title,
    ].join('\n');
    const groundedMarkdown = buildAnalysisGroundedMarkdown({
      title: `追问解释：${sourceResult.title}`,
      summary: sourceResult.summary,
      groundedExplanation,
      metricCards: sourceResult.metricCards,
      keyFindings: sourceResult.keyFindings,
      nextBestQuestions: sourceResult.nextBestQuestions,
      scopeSummary: sourceResult.scopeSummary,
      temporalScope: sourceResult.temporalScope,
      appliedFilters: sourceResult.appliedFilters,
      sourceNotes: sourceResult.report.sourceNotes,
      footnotes: sourceResult.report.footnotes,
    });
    const wecomMarkdown = buildAnalysisWecomMarkdown({
      title: `追问解释：${sourceResult.title}`,
      summary: sourceResult.summary,
      groundedExplanation,
      metricCards: sourceResult.metricCards,
      keyFindings: sourceResult.keyFindings,
      nextBestQuestions: sourceResult.nextBestQuestions,
      scopeSummary: sourceResult.scopeSummary,
      temporalScope: sourceResult.temporalScope,
      appliedFilters: sourceResult.appliedFilters,
      sourceNotes: sourceResult.report.sourceNotes,
      footnotes: sourceResult.report.footnotes,
    });
    const reusedResult: AnalysisResultRecord = {
      ...sourceResult,
      requestId: params.requestId,
      questionText: params.questionText,
      title: `追问解释：${sourceResult.title}`,
      summary: sourceResult.summary,
      report: {
        ...sourceResult.report,
        groundedExplanation,
        nextBestQuestions: sourceResult.nextBestQuestions,
        groundedMarkdown,
        wecomMarkdown,
        markdownOutline: buildAnalysisMarkdownOutline({
          title: `追问解释：${sourceResult.title}`,
          summary: sourceResult.summary,
          groundedExplanation,
          metricCards: sourceResult.metricCards,
          keyFindings: sourceResult.keyFindings,
          nextBestQuestions: sourceResult.nextBestQuestions,
          scopeSummary: sourceResult.scopeSummary,
          temporalScope: sourceResult.temporalScope,
          appliedFilters: sourceResult.appliedFilters,
          sourceNotes: sourceResult.report.sourceNotes,
          footnotes: sourceResult.report.footnotes,
        }),
      },
      groundedExplanation,
      explanation: groundedExplanation,
      nextBestQuestions: sourceResult.nextBestQuestions,
      groundedMarkdown,
      wecomMarkdown,
      markdownOutline: buildAnalysisMarkdownOutline({
        title: `追问解释：${sourceResult.title}`,
        summary: sourceResult.summary,
        groundedExplanation,
        metricCards: sourceResult.metricCards,
        keyFindings: sourceResult.keyFindings,
        nextBestQuestions: sourceResult.nextBestQuestions,
        scopeSummary: sourceResult.scopeSummary,
        temporalScope: sourceResult.temporalScope,
        appliedFilters: sourceResult.appliedFilters,
        sourceNotes: sourceResult.report.sourceNotes,
        footnotes: sourceResult.report.footnotes,
      }),
      executionSnapshot: {
        analysisRoute:
          sourceRequest.analysisRoute ??
          sourceResult.analysisRoute ??
          sourceResult.executionSnapshot?.analysisRoute,
        executionMode: sourceRequest.executionMode ?? sourceResult.executionMode ?? 'PLAN_EXECUTION',
        executionSource:
          sourceRequest.executionSource ?? sourceResult.executionSource ?? 'CRM_OFFICIAL_API',
        preferredSource:
          sourceRequest.preferredSource ?? sourceResult.preferredSource ?? 'CRM_OFFICIAL_API',
        matchedAdapter: sourceRequest.matchedAdapter ?? sourceResult.matchedAdapter,
        gapReason: sourceRequest.gapReason ?? sourceResult.gapReason,
        scopeSnapshot: params.scopeSnapshot,
        taskSnapshots: [],
        createdAt: completedAt,
      },
      resultBundleSnapshot: sourceResult.resultBundleSnapshot
        ? {
            ...sourceResult.resultBundleSnapshot,
            requestId: params.requestId,
          }
        : undefined,
      insightSnapshot: {
        grounded: true,
        reusedResultBundle: true,
        generatedAt: completedAt,
        explanationLength: groundedExplanation.length,
        nextQuestionCount: sourceResult.nextBestQuestions?.length ?? 0,
      },
      deliverySnapshot: {
        channel: params.payload.channel,
        deliveredFromSingleBundle: true,
        streamBlockCount: sourceResult.streamBlocks.length,
        generatedAt: completedAt,
      },
      entryInterpretationSnapshot: this.buildEntryInterpretationSnapshotForExplanation({
        questionText: params.questionText,
        followUpIntent: 'EXPLAIN_RESULT',
      }),
      workflowRoutingSnapshot: this.buildWorkflowRoutingSnapshot({
        targetWorkflow: 'ANALYSIS_RESULT_EXPLANATION',
        finalProgram: 'analysis-service.tryReuseResultForExplanation',
        requiresConfirmation: false,
      }),
      returnedAt: completedAt,
    };
    const requestRecord: AnalysisRequestRecord = {
      id: params.requestId,
      questionText: params.questionText,
      requesterId: params.user.id,
      requesterRoleIds: params.user.roleIds,
      sessionId: params.sessionId,
      entryChannel: params.payload.channel,
      querySource: params.payload.querySource,
      templateId: params.payload.templateId,
      rerunFromHistoryId: params.payload.historyId,
      organizationScope: params.scopeSnapshot.organizationIds,
      departmentScope: params.scopeSnapshot.departmentIds,
      ownerScope: params.scopeSnapshot.ownerIds,
      intentDomain: sourceRequest.intentDomain,
      metrics: sourceRequest.metrics,
      dimensions: sourceRequest.dimensions,
      filters: sourceRequest.filters,
      temporalSlot: sourceRequest.temporalSlot ?? buildTemporalSlotFromScope(sourceResult.temporalScope),
      followUpToRequestId: params.payload.followUpQueryId,
      missingConditions: [],
      resultConsistencyToken: sourceResult.consistencyToken,
      entryInterpretationSnapshot: reusedResult.entryInterpretationSnapshot,
      workflowRoutingSnapshot: reusedResult.workflowRoutingSnapshot,
      analysisRoute: reusedResult.executionSnapshot?.analysisRoute,
      executionMode: reusedResult.executionSnapshot?.executionMode,
      executionSource: reusedResult.executionSnapshot?.executionSource,
      preferredSource: reusedResult.executionSnapshot?.preferredSource,
      matchedAdapter: reusedResult.executionSnapshot?.matchedAdapter,
      gapReason: reusedResult.executionSnapshot?.gapReason,
      executionSnapshot: reusedResult.executionSnapshot,
      resultBundleSnapshot: reusedResult.resultBundleSnapshot,
      insightSnapshot: reusedResult.insightSnapshot,
      deliverySnapshot: reusedResult.deliverySnapshot,
      status: 'RETURNED',
      createdAt: params.createdAt,
      completedAt,
    };

    this.analysisRequestRepository.saveRequest(requestRecord);
    this.analysisRequestRepository.saveResult(reusedResult);
    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'AI_RESULT_EXPLAINED',
      actorId: params.user.id,
      actorRoleIds: params.user.roleIds,
      actorType: 'crm-user',
      actorDisplayName: params.user.name,
      actorExternalId: params.user.wecomSenderId,
      actorBindingStatus: 'BOUND_CRM',
      channel: params.payload.channel,
      relatedRequestId: params.requestId,
      originalQuestion: params.questionText,
      scopeSnapshot: params.scopeSnapshot,
      sessionSnapshot: {
        sourceRequestId: params.payload.followUpQueryId,
        entryInterpretationSnapshot: requestRecord.entryInterpretationSnapshot,
        workflowRoutingSnapshot: requestRecord.workflowRoutingSnapshot,
        executionSnapshot: reusedResult.executionSnapshot,
        resultBundleSnapshot: reusedResult.resultBundleSnapshot,
        insightSnapshot: reusedResult.insightSnapshot,
        deliverySnapshot: reusedResult.deliverySnapshot,
      },
      resultCount: reusedResult.rowCount,
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome: '解释型追问已复用上一轮结果包。',
      actionSummary: '解释上一轮问数结果。',
      targetType: 'analysis-query',
      targetId: params.payload.followUpQueryId,
      targetSummary: `上一轮查询 ${params.payload.followUpQueryId}`,
      createdAt: completedAt,
    });

    return {
      queryId: params.requestId,
      status: 'RETURNED',
      sessionId: requestRecord.sessionId,
      createdAt: params.createdAt,
    };
  }

  private async resolveExecutionMode(params: {
    requestedMode?: AnalysisExecutionMode;
    questionText: string;
    channel: ChannelType;
  }): Promise<AnalysisExecutionMode> {
    if (
      params.requestedMode === 'GUARDED_DIRECT_QUERY' &&
      process.env.AI_GUARDED_DIRECT_QUERY_ENABLED === 'true'
    ) {
      return 'GUARDED_DIRECT_QUERY';
    }

    if (params.requestedMode === 'PLAN_EXECUTION') {
      return 'PLAN_EXECUTION';
    }

    if (process.env.AI_GUARDED_DIRECT_QUERY_ENABLED === 'true') {
      return 'GUARDED_DIRECT_QUERY';
    }

    return 'PLAN_EXECUTION';
  }

  private blockRequest(
    requestRecord: AnalysisRequestRecord,
    scopeSnapshot: ScopeSnapshot,
    error: unknown,
  ): Record<string, unknown> {
    const blockedReason = this.analysisResponseMapper.mapBlockedReason(error);
    const isOpenApiGap = error instanceof OpenApiCapabilityGapError;
    const blockedRequest: AnalysisRequestRecord = {
      ...requestRecord,
      workflowRoutingSnapshot: this.buildWorkflowRoutingSnapshot({
        targetWorkflow: 'ANALYSIS_BLOCKED',
        finalProgram: 'analysis-service.blockRequest',
        requiresConfirmation: false,
        executionMode: requestRecord.executionMode,
        blockedReason,
      }),
      status: 'BLOCKED',
      errorMessage: blockedReason,
      executionSource: isOpenApiGap
        ? 'CRM_OFFICIAL_API'
        : requestRecord.executionSource,
      preferredSource: isOpenApiGap
        ? 'CRM_OFFICIAL_API'
        : requestRecord.preferredSource,
      gapReason: isOpenApiGap ? blockedReason : requestRecord.gapReason,
      completedAt: new Date().toISOString(),
    };
    this.analysisRequestRepository.saveRequest(blockedRequest);
    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'QUERY_BLOCKED',
      actorId: requestRecord.requesterId,
      actorRoleIds: requestRecord.requesterRoleIds,
      actorType: 'crm-user',
      actorBindingStatus: 'BOUND_CRM',
      channel: requestRecord.entryChannel,
      relatedRequestId: requestRecord.id,
      originalQuestion: requestRecord.questionText,
      scopeSnapshot,
      sessionSnapshot: {
        entryInterpretationSnapshot: blockedRequest.entryInterpretationSnapshot,
        workflowRoutingSnapshot: blockedRequest.workflowRoutingSnapshot,
        executionSnapshot: requestRecord.executionSnapshot ?? {
          executionMode: requestRecord.executionMode ?? 'PLAN_EXECUTION',
          analysisRoute: requestRecord.analysisRoute,
          executionSource: requestRecord.executionSource ?? 'CRM_OFFICIAL_API',
          preferredSource: requestRecord.preferredSource ?? 'CRM_OFFICIAL_API',
          gapReason: isOpenApiGap ? blockedReason : undefined,
          scopeSnapshot,
          taskSnapshots: [],
          blockedReason,
          createdAt: new Date().toISOString(),
        },
      },
      riskLevel: 'HIGH',
      reviewStatus: 'PENDING',
      outcome: blockedReason,
      failureReason: blockedReason,
      actionSummary: '智能问数请求被阻断。',
      targetType: 'analysis-query',
      targetId: requestRecord.id,
      targetSummary: requestRecord.questionText,
      createdAt: new Date().toISOString(),
    });
    return {
      queryId: requestRecord.id,
      status: 'BLOCKED',
      analysisRoute: requestRecord.analysisRoute,
      createdAt: requestRecord.createdAt,
      missingConditions: [],
      clarificationPrompt: blockedReason,
    };
  }

  private saveHistoryRecord(
    user: CrmUser,
    payload: CreateAnalysisPayload,
    requestId: string,
    questionText: string,
    resultSummary: string | undefined,
    completedAt: string,
    metadata?: Pick<
      NonNullable<AnalysisRequestRecord>,
      'analysisRoute' | 'executionMode' | 'executionSource' | 'matchedAdapter' | 'gapReason'
    >,
    temporalScope?: AnalysisResultRecord['temporalScope'],
  ): void {
    this.recentQueryRepository.save({
      id: buildEntityId('history'),
      requesterId: user.id,
      sourceRequestId: requestId,
      sourceType:
        payload.querySource === 'COMMON_TEMPLATE'
          ? 'TEMPLATE_QUERY'
          : payload.querySource === 'RECENT_RERUN'
            ? 'RERUN_HISTORY'
            : 'AI_QUERY',
      templateId: payload.templateId,
      templateVersion: payload.templateId
        ? this.queryTemplateRepository.findById(payload.templateId)?.sqlVersion
        : undefined,
      questionText,
      lastUsedChannel: payload.channel,
      lastUsedConditions: {},
      parameterSnapshot: payload.templateId ? {} : undefined,
      renderSnapshot: payload.templateId
        ? this.queryTemplateRepository.findById(payload.templateId)?.renderConfig
        : undefined,
      lastTemporalScope: temporalScope,
      resultSummary,
        executionMode: metadata?.executionMode,
        analysisRoute: metadata?.analysisRoute,
        executionSource: metadata?.executionSource,
      matchedAdapter: metadata?.matchedAdapter,
      gapReason: metadata?.gapReason,
      status: 'SUCCEEDED',
      lastUsedAt: completedAt,
    });
  }

  /**
   * 最近查询重跑时复用历史结果包保存的时间边界。
   *
   * 参数说明：
   * - `intent`：本次重新解析出的问数意图。
   * - `payload`：创建查询请求，包含可选历史记录 ID。
   * 返回值：若历史记录存在时间口径，则返回替换为历史边界后的意图。
   * 调用注意：只有未显式改写问题的最近查询重跑复用历史边界，改条件重跑仍走 AI 新时间槽。
   */
  private applyRecentRerunTemporalScope(
    intent: AnalysisIntent,
    payload: CreateAnalysisPayload,
  ): AnalysisIntent {
    if (
      payload.querySource !== 'RECENT_RERUN' ||
      !payload.historyId ||
      payload.questionText
    ) {
      return intent;
    }

    const history = this.recentQueryRepository.findById(payload.historyId);
    const temporalSlot = buildTemporalSlotFromScope(history?.lastTemporalScope);
    if (!temporalSlot) {
      return intent;
    }

    return {
      ...intent,
      temporalSlot,
      filters: {
        ...intent.filters,
        timeRange: temporalSlot.normalizedLabel,
        startAt: temporalSlot.startAt,
        endAt: temporalSlot.endAt,
      },
      timeRangeText: temporalSlot.rawText,
      missingConditions: intent.missingConditions.filter((item) => item !== '时间范围'),
    };
  }

  private tryHandleExpiredFollowUpContext(params: {
    user: CrmUser;
    payload: CreateAnalysisPayload;
    requestId: string;
    sessionId: string;
    createdAt: string;
    scopeSnapshot: ScopeSnapshot;
  }): Record<string, unknown> | undefined {
    if (
      params.payload.channel !== 'web-console' ||
      !params.payload.followUpQueryId
    ) {
      return undefined;
    }

    const sourceRequest = this.analysisRequestRepository.findRequestById(
      params.payload.followUpQueryId,
    );
    const sourceResult = this.analysisRequestRepository.findResultByRequestId(
      params.payload.followUpQueryId,
    );
    if (!sourceRequest || sourceRequest.requesterId !== params.user.id) {
      throw new NotFoundException('上一轮分析结果不存在。');
    }

    const lastContextAt =
      sourceResult?.returnedAt ??
      sourceRequest.completedAt ??
      sourceRequest.createdAt;
    if (
      !this.aiContextPolicyService.isAnalysisSessionExpired(
        lastContextAt,
        params.createdAt,
      )
    ) {
      return undefined;
    }

    const clarificationPrompt = '上一轮分析上下文已失效，请重新描述完整的分析问题后再继续。';
    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'CLARIFICATION_REQUESTED',
      actorId: params.user.id,
      actorRoleIds: params.user.roleIds,
      relatedRequestId: params.requestId,
      originalQuestion: sourceRequest.questionText,
      scopeSnapshot: params.scopeSnapshot,
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome: clarificationPrompt,
      failureReason: 'analysis-follow-up-context-expired',
      createdAt: params.createdAt,
    });

    return {
      queryId: params.requestId,
      status: 'CLARIFICATION_REQUIRED',
      clarificationPrompt,
      missingConditions: [],
      sessionId: params.sessionId,
      createdAt: params.createdAt,
    };
  }

  private bumpTemplateStats(templateId: string | undefined, completedAt: string): void {
    if (!templateId) {
      return;
    }

    const template = this.queryTemplateRepository.findById(templateId);
    if (!template) {
      return;
    }

    this.queryTemplateRepository.save({
      ...template,
      clickCount7d: template.clickCount7d + 1,
      updatedAt: completedAt,
    });
  }

  /**
   * 统一记录入口理解后的固定程序路由结果。
   *
   * 该快照用于把“AI 理解层决定去哪里”和“系统最终执行了什么程序”分开留痕，
   * 便于后续排查误路由、fallback 和阻断原因。
   */
  private buildWorkflowRoutingSnapshot(params: {
    targetWorkflow: AiWorkflowRoutingSnapshot['targetWorkflow'];
    finalProgram: string;
    requiresConfirmation: boolean;
    executionMode?: AnalysisExecutionMode;
    blockedReason?: string;
  }): AiWorkflowRoutingSnapshot {
    return createAiWorkflowRoutingSnapshot({
      targetWorkflow: params.targetWorkflow,
      finalProgram: params.finalProgram,
      requiresConfirmation: params.requiresConfirmation,
      gateResult:
        params.targetWorkflow === 'ANALYSIS_BLOCKED'
          ? 'BLOCKED'
          : params.targetWorkflow === 'ANALYSIS_CLARIFICATION'
            ? 'CLARIFICATION_REQUIRED'
            : params.requiresConfirmation
              ? 'PENDING_CONFIRMATION'
              : 'BYPASSED',
      executionMode: params.executionMode,
      blockedReason: params.blockedReason,
      generatedAt: new Date().toISOString(),
    });
  }

  /**
   * 为解释型追问生成统一入口快照。
   *
   * 解释追问不重新取数，因此这里明确标记为“结果复用解释”而不是新的查询执行。
   */
  private buildEntryInterpretationSnapshotForExplanation(params: {
    questionText: string;
    followUpIntent: 'EXPLAIN_RESULT';
  }): AiEntryInterpretationSnapshot {
    return createAiEntryInterpretationSnapshot({
      channel: 'web-console',
      scene: 'WEB_ANALYSIS_FOLLOW_UP',
      targetWorkflow: 'ANALYSIS_RESULT_EXPLANATION',
      originalText: params.questionText,
      intent: 'EXPLAIN_RESULT',
      requestedAction: 'READONLY_ANALYSIS',
      replyIntent: params.followUpIntent,
      confidence: 'HIGH',
      usedFallback: false,
      generatedAt: new Date().toISOString(),
    });
  }
}

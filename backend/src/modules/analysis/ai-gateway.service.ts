import { basename, join } from 'node:path';
import { Injectable, Optional } from '@nestjs/common';
import type { AiRuntimeConfig } from '../../shared/config/local-runtime-config.service';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import type {
  AnalysisIntent,
  TemporalGranularity,
  TemporalSlot,
  WecomFollowUpTemplateDraft,
  WecomLatestResultContext,
} from '../../shared/types/domain';
import {
  inferAnalysisDepth,
  inferAnalysisFacetProfile,
  resolveAnalysisOutputPreference,
  resolveAnalysisFocus,
} from './analysis-topic-report.registry';
import { normalizeAnalysisMissingConditions } from './missing-conditions.util';
import {
  detectWecomHelpIntent,
  isWecomDailyReportSelfViewIntent,
  parseWecomTeamDailyReportPreviewIntent,
} from '../wecom/wecom-ai-prompt.config';
import { detectWecomCrmCreateIntent } from '../wecom/wecom-crm-create.helper';
import { AiRuntimeConfigResolver } from '../ai-models/ai-runtime-config.resolver';
import { UnifiedAiExecutionService } from '../ai-models/unified-ai-execution.service';
import { AiCapabilityPackRuntimeService } from './capability-packs/ai-capability-pack.runtime';
import type {
  AiCapabilityPackExecutionResult,
  AiCapabilityPackFailureReason,
} from './capability-packs/ai-capability-pack.types';
import type {
  AnalysisFollowUpPackOutput,
} from './capability-packs/packs/analysis-follow-up.pack';
import type {
  GroundedExplanationPackOutput,
} from './capability-packs/packs/grounded-explanation.pack';
import type {
  RichAnalysisReportPackOutput,
} from './capability-packs/packs/rich-analysis-report.pack';
import type {
  WecomActiveTaskReplyPackOutput,
} from './capability-packs/packs/wecom-active-task-reply.pack';
import type {
  WecomIdleEntryPackOutput,
} from './capability-packs/packs/wecom-idle-entry.pack';
import { resolveWecomIdleEntryFixture } from './capability-packs/fixtures/wecom-idle-entry.fixtures';
import type { BusinessAnalysisIntent } from './business-analysis-intent.types';

interface WecomCandidateRerankInput {
  id?: string;
  name: string;
  details?: Array<string | undefined>;
}

interface WecomCandidateRerankOutputItem {
  id?: string;
  name: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendationReason: string;
}

interface WecomCandidateRerankOutput {
  candidates: WecomCandidateRerankOutputItem[];
  recommendedCandidate?: WecomCandidateRerankOutputItem;
  auditSnapshot: {
    boundary: 'RECALLED_CANDIDATES_ONLY';
    source: 'ai-rerank';
    inputCandidateCount: number;
    recommendedCandidateId?: string;
    recommendedCandidateName?: string;
  };
}

interface GroundedAnalysisInsightOutput extends CapabilityPackRuntimeMetadata {
  groundedExplanation: string;
  nextBestQuestions: string[];
}

interface LegacyAnalysisIntentStructuredOutput {
  domain: AnalysisIntent['domain'];
  metrics: string[];
  dimensions: string[];
  missingConditions: string[];
  normalizedQuestion: string;
  requestedAction: AnalysisIntent['requestedAction'];
  confidence: AnalysisIntent['confidence'];
  blockReason?: string;
  timeRange?: string;
  startAt?: string;
  temporalSlot?: TemporalSlot;
}

/**
 * 判断旧版意图解析返回的时间槽是否已经可执行。
 *
 * 参数说明：`slot` 为模型输出的时间槽。
 * 返回值说明：同时具备起止边界且置信度不是 LOW 时返回 true。
 * 调用注意事项：旧版路径没有 pack 归一化，因此这里必须兜住低置信时间。
 */
function isExecutableLegacyTemporalSlot(slot: TemporalSlot | undefined): boolean {
  return Boolean(slot?.startAt && slot?.endAt && slot.confidence !== 'LOW');
}

/**
 * 判断旧版意图解析问题中是否显式包含时间约束。
 *
 * 参数说明：`questionText` 为规范化后的用户问题。
 * 返回值说明：命中明确日期、月份、季度、年度或相对时间表达时返回 true。
 * 调用注意事项：未限定时间时默认当前权限全量可见范围，不进入时间追问。
 */
function hasExplicitLegacyTemporalConstraint(questionText: string): boolean {
  return /(今天|昨日|昨天|明天|本周|上周|本月|上月|当月|本季度|上季度|本年|今年|去年|本财年|最近|近\s*\d+|过去|前\s*\d+|\d{4}\s*年|\d{1,2}\s*月|一月份|二月份|三月份|四月份|五月份|六月份|七月份|八月份|九月份|十月份|十一月份|十二月份)/u.test(
    questionText,
  );
}

/**
 * 清洗旧版意图解析输出的缺口条件。
 *
 * 参数说明：`parsed` 为模型结构化输出，`questionText` 为本次问题文本。
 * 返回值说明：仅保留真正阻断执行的缺口条件。
 * 调用注意事项：旧版 Codex 路径绕过 capability pack normalize，需要复用同一缺口口径。
 */
function normalizeLegacyIntentMissingConditions(
  parsed: LegacyAnalysisIntentStructuredOutput,
  questionText: string,
): string[] {
  return normalizeAnalysisMissingConditions(parsed.missingConditions, {
    keepTimeRangeCondition: Boolean(
      (parsed.temporalSlot && !isExecutableLegacyTemporalSlot(parsed.temporalSlot)) ||
        (!parsed.temporalSlot && hasExplicitLegacyTemporalConstraint(questionText)),
    ),
    dropDefaultableMetricOrDimension:
      parsed.metrics.length > 0 || parsed.dimensions.length > 0,
  });
}

interface RichAnalysisReportOutput extends CapabilityPackRuntimeMetadata {
  executiveSummary: string;
  keyFindings: Array<{
    title: string;
    detail: string;
    tone: 'positive' | 'neutral' | 'risk';
  }>;
  trendNarrative: string;
  riskNarratives: string[];
  recommendationNarratives: string[];
  evidenceNarrative: string;
}

interface DailyReportGroundedInsightOutput {
  summaryLines: string[];
}

type SuggestedAnalysisExecutionMode =
  | 'PLAN_EXECUTION'
  | 'GUARDED_DIRECT_QUERY';

type AnalysisFollowUpIntent =
  | 'EXPLAIN_RESULT'
  | 'RUN_NEW_ANALYSIS';

interface ControlledDirectQueryTaskOutput {
  taskTitle: string;
  resultKind:
    | 'metric-summary'
    | 'owner-ranking'
    | 'time-trend'
    | 'stage-distribution'
    | 'category-distribution'
    | 'department-contribution'
    | 'partner-contribution'
    | 'risk-overview';
  sql: string;
  tables: string[];
  fieldEntries: Array<{
    table: string;
    fields: string[];
  }>;
  joinPaths: string[];
  allowedFunctions: string[];
  rowLimit: number;
  timeoutMs: number;
  temporalSlot?: TemporalSlot;
}

interface CapabilityPackRuntimeMetadata {
  packCode?: string;
  packVersion?: string;
  providerCode?: string;
  model?: string;
  usedFallback?: boolean;
  fallbackReason?: AiCapabilityPackFailureReason;
  validationFailureReason?: string;
}

interface WecomTaskReplyIntentOutput extends CapabilityPackRuntimeMetadata {
  intent:
    | 'HELP_GUIDANCE'
    | 'TASK_CANCEL'
    | 'TASK_SWITCH'
    | 'DIRECT_SUBMIT'
    | 'CONTINUE_EXECUTION'
    | 'MODIFY_CONTENT'
    | 'NONE';
  target?:
    | 'DAILY_REPORT_ENTRY'
    | 'DAILY_REPORT_QUERY'
    | 'TEAM_DAILY_REPORT_QUERY'
    | 'FOLLOW_UP_TEMPLATE'
    | 'CRM_CREATE_CUSTOMER'
    | 'CRM_CREATE_OPPORTUNITY'
    | 'ENTITY_LOOKUP';
}

interface WecomIdleConversationIntentOutput extends CapabilityPackRuntimeMetadata {
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
  dailyReportPrompt?:
    | 'FOLLOW_UP_TEMPLATE_ENTRY'
    | 'DAILY_REPORT_THEME_ENTRY';
  leaderNameQuery?: string;
  lookupText?: string;
  entityLookupAction?: 'LIST' | 'DETAIL' | 'SELECT_FROM_LAST_LIST';
  entityType?: 'Customer' | 'Opportunity' | 'Unknown';
  queryText?: string;
  selectionIndex?: number;
  referenceTarget?: 'LAST_LIST' | 'NONE';
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
}

type RemovedCodexSdkModule = {
  Codex: new (...args: unknown[]) => {
    startThread: (...args: unknown[]) => {
      run: (...args: unknown[]) => Promise<{ finalResponse: string }>;
    };
  };
};

type CodexQueueLane =
  | 'default'
  | 'wecom-semantic-reply'
  | 'wecom-structured-draft'
  | 'wecom-entity-rerank';

type CodexClientRuntimeConfig = Pick<
  AiRuntimeConfig,
  | 'apiKey'
  | 'baseUrl'
  | 'model'
  | 'reasoningEffort'
  | 'serviceTier'
  | 'modelProvider'
  | 'wireApi'
  | 'requiresOpenaiAuth'
  | 'disableResponseStorage'
  | 'codexPath'
  | 'proxyEnv'
>;

@Injectable()
export class AiGatewayService {
  private static readonly DEFAULT_INTENT_TIMEOUT_MS = 10000;
  private static readonly DEFAULT_WECOM_STRUCTURED_DRAFT_TIMEOUT_MS = 60000;
  private static readonly DEFAULT_WECOM_TASK_REPLY_TIMEOUT_MS = 60000;
  private static readonly DEFAULT_WECOM_IDLE_INTENT_TIMEOUT_MS = 60000;
  private static readonly DEFAULT_WECOM_IDLE_HELP_INTENT_TIMEOUT_MS = 60000;
  private static readonly DEFAULT_GROUNDED_INSIGHT_TIMEOUT_MS = 60000;
  private static readonly DEFAULT_AUXILIARY_INTENT_TIMEOUT_MS = 60000;
  private static readonly DEFAULT_FREEFORM_REPLY_TIMEOUT_MS = 60000;

  /**
   * 按能力 lane 隔离的 Codex 调用队列。
   *
   * 设计原因：
   * 1. 企业微信短回复语义和四段草稿抽取都属于轻量理解，不应长期阻塞在问数 / 洞察类任务之后；
   * 2. 继续保持每个 lane 内串行，避免同类请求瞬时拉起过多线程；
   * 3. 只拆必要 lane，控制并发范围，避免把全部调用放开成无上限并发。
   */
  private readonly codexRunQueues: Record<CodexQueueLane, Promise<void>> = {
    default: Promise.resolve(),
    'wecom-semantic-reply': Promise.resolve(),
    'wecom-structured-draft': Promise.resolve(),
    'wecom-entity-rerank': Promise.resolve(),
  };

  private get codexRunQueue(): Promise<void> {
    return this.codexRunQueues.default;
  }

  private set codexRunQueue(value: Promise<void>) {
    this.codexRunQueues.default = value;
  }

  constructor(
    private readonly localRuntimeConfigService: LocalRuntimeConfigService,
    private readonly analysisLoggerService: AnalysisLoggerService,
    @Optional()
    private readonly aiRuntimeConfigResolver?: AiRuntimeConfigResolver,
    @Optional()
    private readonly unifiedAiExecutionService?: UnifiedAiExecutionService,
    @Optional()
    private readonly aiCapabilityPackRuntimeService?: AiCapabilityPackRuntimeService,
  ) {}

  /**
   * 统一解析当前生效的 AI 配置。
   *
   * 当治理后台已经激活 Profile 时优先走 resolver；
   * 未接入 resolver 或 resolver 不可用时继续回退到原环境配置。
   */
  private getCurrentAiConfig(): AiRuntimeConfig {
    return (
      this.aiRuntimeConfigResolver?.getCurrentConfig() ??
      this.localRuntimeConfigService.getAiConfig()
    );
  }

  /**
   * 当前 capability pack 运行时只在完整应用启动后可用；缺失时保持旧能力不被构造阶段阻断。
   */
  private ensureCapabilityPackRuntime(): AiCapabilityPackRuntimeService {
    if (!this.aiCapabilityPackRuntimeService) {
      throw new Error('AI_CAPABILITY_PACK_RUNTIME_UNAVAILABLE');
    }

    return this.aiCapabilityPackRuntimeService;
  }

  private buildCapabilityPackMetadata<TOutput extends object>(
    result: AiCapabilityPackExecutionResult<TOutput>,
  ): CapabilityPackRuntimeMetadata {
    return {
      packCode: result.packCode,
      packVersion: result.packVersion,
      providerCode: result.providerCode,
      model: result.model,
      usedFallback: result.status !== 'SUCCEEDED',
      fallbackReason: result.fallbackReason,
      validationFailureReason: result.validationFailureReason,
    };
  }

  private buildTestCapabilityPackMetadata(
    packCode: string,
  ): CapabilityPackRuntimeMetadata {
    return {
      packCode,
      packVersion: 'test-fixture',
      providerCode: 'test-provider',
      model: 'test-model',
    };
  }

  private logCapabilityPackFailure(
    scene: string,
    result: AiCapabilityPackExecutionResult<object>,
  ): void {
    const payload = {
      packCode: result.packCode,
      packVersion: result.packVersion,
      providerCode: result.providerCode,
      model: result.model,
      failureReason: result.failureReason,
      failureMessage: result.failureMessage,
      validationFailureReason: result.validationFailureReason,
      rawResponseLength: result.rawResponseLength,
      rawResponsePreview: result.rawResponsePreview,
      requestOverrides: result.requestOverrides,
    };

    // 能力包关闭或主动判空属于受控降级，不应在现场日志里表现成主链故障。
    if (this.isExpectedCapabilityPackFallback(result.failureReason)) {
      this.analysisLoggerService.logStep?.(
        `${scene} capability pack 未选中，已使用受控兜底链路。`,
        payload,
      );
      return;
    }

    this.analysisLoggerService.logWarn(
      this.buildCapabilityPackFailureMessage(scene, result.failureReason),
      payload,
    );
  }

  /**
   * 判断能力包失败是否属于可预期回退。
   * 参数说明：`failureReason` 为能力包运行时返回的失败原因。
   * 返回值：true 表示无需告警，只需要记录普通执行轨迹。
   * 注意事项：Provider 超时、解析失败和结构化校验失败仍保留告警，方便排查真实模型或网关问题。
   */
  private isExpectedCapabilityPackFallback(
    failureReason?: AiCapabilityPackFailureReason,
  ): boolean {
    return failureReason === 'PACK_NONE' || failureReason === 'PACK_DISABLED';
  }

  /**
   * 生成能力包异常日志文案。
   * 参数说明：`scene` 为业务场景，`failureReason` 为能力包失败原因。
   * 返回值：面向排障人员的中文日志摘要。
   * 注意事项：文案必须区分模型输出问题与网关调用问题，避免所有异常都被误读为业务执行未命中。
   */
  private buildCapabilityPackFailureMessage(
    scene: string,
    failureReason?: AiCapabilityPackFailureReason,
  ): string {
    if (failureReason === 'PACK_VALIDATION_FAILED') {
      return `${scene} capability pack 结构化输出未通过校验，已进入受控失败处理。`;
    }

    if (failureReason === 'PROVIDER_TIMEOUT') {
      return `${scene} capability pack 调用超时，已进入受控失败处理。`;
    }

    if (failureReason === 'PROVIDER_ERROR') {
      return `${scene} capability pack 调用失败，已进入受控失败处理。`;
    }

    return `${scene} capability pack 执行异常，已进入受控失败处理。`;
  }

  /**
   * 统一走当前激活 Provider 执行结构化调用。
   *
   * 当前主运行时必须走统一执行门面；门面不可用时由上层业务进入降级。
   */
  private async invokeUnifiedStructured<T extends object>(
    config: T & { sdkType?: AiRuntimeConfig['sdkType'] },
    prompt: string,
    outputSchema: Record<string, unknown>,
    cwd?: string,
  ): Promise<unknown> {
    if (!this.unifiedAiExecutionService || !config.sdkType) {
      throw new Error('UNIFIED_AI_EXECUTION_UNAVAILABLE');
    }

    return await this.unifiedAiExecutionService.invokeStructured({
      prompt,
      outputSchema,
      cwd,
    });
  }

  /**
   * 统一走当前激活 Provider 执行纯文本调用。
   */
  private async invokeUnifiedText<T extends object>(
    config: T & { sdkType?: AiRuntimeConfig['sdkType'] },
    prompt: string,
    cwd?: string,
  ): Promise<string> {
    if (!this.unifiedAiExecutionService || !config.sdkType) {
      throw new Error('UNIFIED_AI_EXECUTION_UNAVAILABLE');
    }

    return await this.unifiedAiExecutionService.invokeText({
      prompt,
      cwd,
    });
  }

  /**
   * 旧 Agent SDK fallback 已下线，统一执行门面失败不得再回退本地 SDK。
   */
  private shouldFallbackToLegacyCodex(error: unknown): boolean {
    void error;
    return false;
  }

  /**
   * 对用户原始问题做最基础的规范化处理。
   *
   * 这里只做“压缩多余空白、去掉首尾空格”这类不会改变业务语义的整理，
   * 避免在进入规则识别或 Codex 解析前，因换行、重复空格等噪音影响稳定性。
   */
  summarizeQuestion(questionText: string): string {
    return questionText.replace(/\s+/g, ' ').trim();
  }

  /**
   * 调用 Codex 将自然语言问题解析为结构化意图。
   *
   * 关键约束：
   * 1. 测试环境返回确定性的本地 AI 桩结果，避免自动化测试依赖外部网关；
   * 2. 本地未配置 AI 网关时返回 null，让上层自动回退到规则解析；
   * 3. 调用失败只记录日志，不向上抛出，保证主链路具备“可回退”能力。
   */
  async parseStructuredIntent(questionText: string): Promise<AnalysisIntent | null> {
    if (process.env.NODE_ENV === 'test') {
      return this.buildTestStructuredIntent(questionText);
    }

    const config = this.getCurrentAiConfig();
    if (!config.enabled || !config.baseUrl || !config.model || !config.apiKey) {
      return null;
    }

    try {
      const intentTimeoutMs = this.resolveAiTimeoutMs(
        'ANALYSIS_AI_INTENT_TIMEOUT_MS',
        AiGatewayService.DEFAULT_INTENT_TIMEOUT_MS,
      );
      const capabilityResult =
        await this.ensureCapabilityPackRuntime().executeStructuredPack<
          {
            questionText: string;
            referenceNowIso: string;
            timezone: 'Asia/Shanghai';
          },
          Record<string, unknown>,
          AnalysisIntent
        >({
          packCode: 'analysis-intent-pack',
          context: {
            questionText,
            referenceNowIso: new Date().toISOString(),
            timezone: 'Asia/Shanghai',
          },
          cwd: this.resolveBackendWorkingDirectory(),
          requestOverrides: {
            timeoutMs: intentTimeoutMs,
            retryOnTimeout: false,
          },
        });
      if (capabilityResult.status === 'SUCCEEDED') {
        return {
          ...(capabilityResult.output ?? {}),
          ...this.buildCapabilityPackMetadata(capabilityResult),
        } as AnalysisIntent;
      }

      this.logCapabilityPackFailure('分析意图解析', capabilityResult);
      return null;
    } catch (error) {
      this.analysisLoggerService.logWarn('Codex SDK 意图解析失败，已回退本地规则。', {
        reason: error instanceof Error ? error.message : 'unknown',
      });
      return null;
    }
  }

  /**
   * 调用 AI 将自然语言问题解析为宽业务意图。
   *
   * 参数说明：`questionText` 为用户规范化后的自然语言问题。
   * 返回值说明：AI 成功理解时返回宽业务意图；AI 不可用或输出无效时返回 `null`。
   * 调用注意事项：宽意图不直接执行，必须经过字段能力检查和旧意图映射后才能进入查询链路。
   */
  async parseBusinessAnalysisIntent(
    questionText: string,
  ): Promise<BusinessAnalysisIntent | null> {
    if (process.env.NODE_ENV === 'test') {
      return this.buildTestBusinessAnalysisIntent(questionText);
    }

    const config = this.getCurrentAiConfig();
    if (!config.enabled || !config.baseUrl || !config.model || !config.apiKey) {
      return null;
    }

    try {
      const intentTimeoutMs = this.resolveAiTimeoutMs(
        'ANALYSIS_AI_INTENT_TIMEOUT_MS',
        AiGatewayService.DEFAULT_INTENT_TIMEOUT_MS,
      );
      const capabilityResult =
        await this.ensureCapabilityPackRuntime().executeStructuredPack<
          {
            questionText: string;
            referenceNowIso: string;
            timezone: 'Asia/Shanghai';
          },
          Record<string, unknown>,
          BusinessAnalysisIntent
        >({
          packCode: 'business-analysis-intent-pack',
          context: {
            questionText,
            referenceNowIso: new Date().toISOString(),
            timezone: 'Asia/Shanghai',
          },
          cwd: this.resolveBackendWorkingDirectory(),
          requestOverrides: {
            timeoutMs: intentTimeoutMs,
            retryOnTimeout: false,
          },
        });
      if (capabilityResult.status === 'SUCCEEDED') {
        return capabilityResult.output ?? null;
      }

      this.logCapabilityPackFailure('宽业务意图解析', capabilityResult);
      return null;
    } catch (error) {
      this.analysisLoggerService.logWarn('Codex SDK 宽业务意图解析失败，正式主链将进入受控补偿或安全阻断。', {
        reason: error instanceof Error ? error.message : 'unknown',
      });
      return null;
    }
  }

  async generateWecomExplanationReply(prompt: string): Promise<string> {
    if (process.env.NODE_ENV === 'test') {
      const summaryLine = prompt
        .split('\n')
        .find((line) => line.startsWith('上一轮结果摘要：'));
      const summary = summaryLine?.replace('上一轮结果摘要：', '').trim() ?? '暂无结果摘要';
      return `基于当前 CRM 结果，${summary}`;
    }

    const config = this.getCurrentAiConfig();
    if (!config.enabled || !config.baseUrl || !config.model || !config.apiKey) {
      return '当前已基于上一轮 CRM 结果继续解释，请结合结果摘要继续查看。';
    }

    try {
      const capabilityResult =
        await this.ensureCapabilityPackRuntime().executeStructuredPack<
          { prompt: string },
          Record<string, unknown>,
          { replyText: string }
        >({
          packCode: 'wecom-explanation-reply-pack',
          context: {
            prompt,
          },
          cwd: this.resolveBackendWorkingDirectory(),
        });
      if (capabilityResult.status === 'SUCCEEDED') {
        return capabilityResult.output?.replyText?.trim() ||
          '当前已基于上一轮 CRM 结果继续解释，请结合结果摘要继续查看。';
      }

      this.logCapabilityPackFailure('企业微信解释回复', capabilityResult);
      return '当前已基于上一轮 CRM 结果继续解释，请结合结果摘要继续查看。';
    } catch (error) {
      this.analysisLoggerService.logWarn('企业微信解释回复生成失败，已回退默认解释。', {
        reason: error instanceof Error ? error.message : 'unknown',
      });
      return '当前已基于上一轮 CRM 结果继续解释，请结合结果摘要继续查看。';
    }
  }

  /**
   * 为收敛后的企业微信机器人生成普通 AI 对话回复。
   *
   * 参数说明：`messageText` 为用户原始消息，`requesterName` 仅用于自然称呼。
   * 返回值说明：返回可直接发送到企业微信的中文回复。
   * 调用注意事项：该能力不读取 CRM、合同、日报或写回数据，只能回答通用文本问题。
   */
  async generateWecomCoreChatReply(params: {
    messageText?: string;
    requesterName?: string;
  }): Promise<string> {
    const messageText = params.messageText?.trim();
    if (!messageText) {
      return '我已收到你的消息。当前机器人只启用普通 AI 对话，可以继续补充你想处理的文本问题。';
    }

    if (process.env.NODE_ENV === 'test') {
      return `AI 已收到：${messageText}`;
    }

    const config = this.getCurrentAiConfig();
    if (!config.enabled || !config.baseUrl || !config.model || !config.apiKey) {
      return 'AI 服务还没有完成配置，请先在 AI 配置中激活可用模型。';
    }

    const prompt = [
      '你是企业微信机器人中的 AI 助手，请用简洁、可信、中文的方式回复用户。',
      '当前系统只启用普通 AI 对话，不查询 CRM 数据，不执行合同评审，不生成日报，不新增客户或商机，不写回跟进记录。',
      '如果用户要求查询经营数据、CRM 客户/商机、渠道排名、合同风险、日报、导出、写回或创建对象，请明确说明该业务能力当前未启用，不要编造任何业务事实。',
      params.requesterName ? `用户称呼：${params.requesterName}` : '',
      `用户消息：${messageText}`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const reply = await this.runCodexFreeformPrompt(config, prompt);
      return reply.trim() || '我已收到你的消息，但这次没有生成有效回复。请换一种说法再试。';
    } catch (error) {
      this.analysisLoggerService.logWarn('企业微信普通 AI 对话生成失败。', {
        reason: error instanceof Error ? error.message : 'unknown',
      });
      return 'AI 服务暂时不可用，请稍后再试。';
    }
  }

  /**
   * 将企业微信自由文本整理为四段结构化草稿。
   *
   * 关键约束：
   * 1. 仅用于“用户已经给出自由文本正文”的场景，不承担主题入口判断；
   * 2. 模型只能整理用户原文，不允许补造不存在的业务事实；
   * 3. 当 AI 不可用、超时或返回异常时返回 null，让上层显式回退到规则 helper。
   */
  async parseWecomFollowUpStructuredDraft(params: {
    requesterName: string;
    messageText?: string;
  }): Promise<WecomFollowUpTemplateDraft | null> {
    if (process.env.NODE_ENV === 'test') {
      return null;
    }

    const normalizedMessage = params.messageText?.trim();
    if (!normalizedMessage) {
      return null;
    }

    const config = this.getCurrentAiConfig();
    if (!config.enabled || !config.baseUrl || !config.model || !config.apiKey) {
      return null;
    }

    try {
      return await this.runCodexWecomFollowUpStructuredDraftPrompt(config, {
        requesterName: params.requesterName,
        messageText: normalizedMessage,
      });
    } catch (error) {
      this.analysisLoggerService.logWarn('企业微信自由文本四段草稿 AI 抽取失败，已回退规则 helper。', {
        reason: error instanceof Error ? error.message : 'unknown',
      });
      return null;
    }
  }

  /**
   * 在受控召回集合内做企业微信候选重排。
   *
   * 关键约束：
   * 1. 模型只能在调用方给出的候选集合内比较，不得新增候选；
   * 2. 若模型不可用或结果不合法，返回 null 交由上层 fallback；
   * 3. 返回结果只表达排序与推荐，不改变“多候选必须等待用户确认”的执行边界。
   */
  async rerankWecomCandidates(params: {
    queryText: string;
    candidates: WecomCandidateRerankInput[];
  }): Promise<WecomCandidateRerankOutput | null> {
    if (process.env.NODE_ENV === 'test') {
      return null;
    }

    if (!params.queryText.trim() || params.candidates.length === 0) {
      return null;
    }

    const config = this.getCurrentAiConfig();
    if (!config.enabled || !config.baseUrl || !config.model || !config.apiKey) {
      return null;
    }

    try {
      return await this.runCodexWecomCandidateRerankPrompt(config, params);
    } catch (error) {
      this.analysisLoggerService.logWarn('企业微信候选 AI 重排失败，已回退规则评分。', {
        reason: error instanceof Error ? error.message : 'unknown',
      });
      return null;
    }
  }

  /**
   * 基于已验证结果包生成 grounded 洞察。
   *
   * 关键约束：
   * 1. 只能消费当前结果包摘要和权限摘要，不得触发新的数据读取；
   * 2. AI 不可用或返回异常时返回 null，让上层显式回退模板文案；
   * 3. 输出必须稳定为 explanation + questions 结构。
   */
  async generateGroundedAnalysisInsight(params: {
    title?: string;
    summary?: string;
    scopeSummary?: string;
    keyFindings: string[];
  }): Promise<GroundedAnalysisInsightOutput | null> {
    if (process.env.NODE_ENV === 'test') {
      return null;
    }

    const config = this.getCurrentAiConfig();
    if (!config.enabled || !config.baseUrl || !config.model || !config.apiKey) {
      return null;
    }

    try {
      const capabilityResult =
        await this.ensureCapabilityPackRuntime().executeStructuredPack<
          {
            title?: string;
            summary?: string;
            scopeSummary?: string;
            keyFindings: string[];
          },
          Record<string, unknown>,
          GroundedExplanationPackOutput
        >({
          packCode: 'grounded-explanation-pack',
          context: params,
          cwd: this.resolveBackendWorkingDirectory(),
        });
      if (capabilityResult.status === 'SUCCEEDED') {
        return {
          ...(capabilityResult.output ?? {
            groundedExplanation: '',
            nextBestQuestions: [],
          }),
          ...this.buildCapabilityPackMetadata(capabilityResult),
        };
      }

      this.logCapabilityPackFailure('grounded 洞察生成', capabilityResult);
      return null;
    } catch (error) {
      this.analysisLoggerService.logWarn('grounded AI 洞察生成失败，已回退模板 explanation。', {
        reason: error instanceof Error ? error.message : 'unknown',
      });
      return null;
    }
  }

  /**
   * 基于统一事实包生成 richer report 的中文经营分析内容。
   *
   * 关键约束：
   * 1. 只能消费当前结果事实与明细预览，不得发起二次查数；
   * 2. AI 不可用或失败时返回 null，由上层继续走程序兜底文案；
   * 3. 输出必须稳定为执行摘要、关键发现、趋势解读、风险说明和建议说明。
   */
  async generateRichAnalysisReport(params: {
    title: string;
    summary?: string;
    scopeSummary?: string;
    metricCards: Array<{ name: string; value: string | number }>;
    rowPreview: Array<Record<string, unknown>>;
    appliedFilters?: Array<{ label: string; value: string }>;
    trendSummary?: string;
    forecastSummary?: string;
    anomalySummaries: string[];
    riskSummaries: string[];
    recommendationSummaries: string[];
    markdownSnapshotContext?: string;
  }): Promise<RichAnalysisReportOutput | null> {
    if (process.env.NODE_ENV === 'test') {
      return null;
    }

    const config = this.getCurrentAiConfig();
    if (!config.enabled || !config.baseUrl || !config.model || !config.apiKey) {
      return null;
    }

    try {
      const capabilityResult =
        await this.ensureCapabilityPackRuntime().executeStructuredPack<
          typeof params,
          Record<string, unknown>,
          RichAnalysisReportPackOutput
        >({
          packCode: 'rich-analysis-report-pack',
          context: params,
          cwd: this.resolveBackendWorkingDirectory(),
        });

      if (capabilityResult.status === 'SUCCEEDED') {
        return {
          ...(capabilityResult.output ?? {
            executiveSummary: '',
            keyFindings: [],
            trendNarrative: '',
            riskNarratives: [],
            recommendationNarratives: [],
            evidenceNarrative: '',
          }),
          ...this.buildCapabilityPackMetadata(capabilityResult),
        };
      }

      this.logCapabilityPackFailure('richer report 编排', capabilityResult);
      return null;
    } catch (error) {
      this.analysisLoggerService.logWarn('richer report AI 编排失败，已回退程序摘要。', {
        reason: error instanceof Error ? error.message : 'unknown',
      });
      return null;
    }
  }

  /**
   * 对分析请求建议执行模式。
   *
   * 该能力只负责给出“计划执行 / 受控直查”的建议，
   * 最终是否采用仍由服务端结合特性开关统一决定。
   */
  async suggestAnalysisExecutionMode(params: {
    questionText: string;
    channel: 'web-console' | 'wecom-bot';
  }): Promise<SuggestedAnalysisExecutionMode | null> {
    if (process.env.NODE_ENV === 'test') {
      return null;
    }

    const normalizedQuestion = params.questionText.trim();
    if (!normalizedQuestion) {
      return null;
    }

    const config = this.getCurrentAiConfig();
    if (!config.enabled || !config.baseUrl || !config.model || !config.apiKey) {
      return null;
    }

    try {
      return await this.runCodexAnalysisExecutionModePrompt(config, params);
    } catch (error) {
      this.analysisLoggerService.logWarn('分析执行模式 AI 建议失败，已回退默认计划执行。', {
        reason: error instanceof Error ? error.message : 'unknown',
      });
      return null;
    }
  }

  /**
   * 生成受控直查任务。
   *
   * 返回值仍然要经过既有安全栈校验和 API-first 路由，
   * 这里只提供 AI 生成的只读任务草案。
   */
  async generateControlledDirectQueryTask(params: {
    questionText: string;
    channel: 'web-console' | 'wecom-bot';
    domain: AnalysisIntent['domain'];
    metrics: string[];
    dimensions: string[];
    filters: Record<string, unknown>;
    temporalSlot?: TemporalSlot;
    knowledgeContextText?: string;
    expectedTaskTitle: string;
    expectedResultKind: ControlledDirectQueryTaskOutput['resultKind'];
    expectedPurpose: string;
  }): Promise<ControlledDirectQueryTaskOutput | null> {
    if (process.env.NODE_ENV === 'test') {
      return null;
    }

    const config = this.getCurrentAiConfig();
    if (!config.enabled || !config.baseUrl || !config.model || !config.apiKey) {
      return null;
    }

    try {
      const generatedTask = await this.runCodexControlledDirectQueryTaskPrompt(config, params);
      if (generatedTask.resultKind !== params.expectedResultKind) {
        this.analysisLoggerService.logWarn('受控直查 AI 任务结果类型与计划器期望不一致，已回退统一编排。', {
          questionText: params.questionText,
          channel: params.channel,
          expectedResultKind: params.expectedResultKind,
          actualResultKind: generatedTask.resultKind,
          expectedTaskTitle: params.expectedTaskTitle,
        });
        return null;
      }

      return generatedTask;
    } catch (error) {
      this.analysisLoggerService.logWarn('受控直查 AI 任务生成失败，已回退计划执行编排。', {
        reason: error instanceof Error ? error.message : 'unknown',
      });
      return null;
    }
  }

  /**
   * 生成 AI-agent 分析库 Text-to-SQL 查询任务。
   *
   * 参数说明：`params` 包含用户问题、入口渠道、语义字段目录和权限摘要。
   * 返回值说明：成功返回候选 SQL 任务；AI 不可用、输出不合规或超时时返回 `null`。
   * 调用注意事项：这里只生成候选任务，后续仍必须经过分析库 SQL Guard、权限门闩和审计执行。
   */
  async generateAnalysisWarehouseQueryTask(params: {
    questionText: string;
    channel: 'web-console' | 'wecom-bot';
    semanticCatalogText: string;
    metricCatalogText: string;
    scopeSummary: string;
    temporalSlot?: TemporalSlot;
  }): Promise<ControlledDirectQueryTaskOutput | null> {
    if (process.env.NODE_ENV === 'test') {
      return null;
    }

    const config = this.getCurrentAiConfig();
    if (!config.enabled || !config.baseUrl || !config.model || !config.apiKey) {
      return null;
    }

    try {
      const parsed = (await this.invokeUnifiedStructured(
        config,
        this.buildAnalysisWarehouseQueryTaskPrompt(params),
        this.buildControlledDirectQueryTaskSchema(),
        this.resolveBackendWorkingDirectory(),
      )) as ControlledDirectQueryTaskOutput;

      return {
        taskTitle: parsed.taskTitle.replace(/\s+/gu, ' ').trim() || '分析库问数任务',
        resultKind: parsed.resultKind,
        sql: parsed.sql.trim(),
        tables: parsed.tables.map((item) => item.trim()).filter(Boolean),
        fieldEntries: parsed.fieldEntries.map((item) => ({
          table: item.table.trim(),
          fields: item.fields.map((field) => field.trim()).filter(Boolean),
        })),
        joinPaths: parsed.joinPaths.map((item) => item.trim()).filter(Boolean),
        allowedFunctions: parsed.allowedFunctions
          .map((item) => item.trim().toUpperCase())
          .filter(Boolean),
        rowLimit: Math.min(Math.max(parsed.rowLimit, 1), 1000),
        timeoutMs: Math.min(Math.max(parsed.timeoutMs, 500), 5000),
        temporalSlot: this.normalizeDirectQueryTemporalSlot(
          parsed.temporalSlot,
          params.temporalSlot,
        ),
      };
    } catch (error) {
      this.analysisLoggerService.logWarn('分析库 Text-to-SQL 任务生成失败，已停止本次离线诊断 SQL 生成。', {
        reason: error instanceof Error ? error.message : 'unknown',
      });
      return null;
    }
  }

  /**
   * 生成日报 grounded 摘要或团队观察。
   *
   * 这里只消费已确认事实摘要，不触发新的数据读取。
   * 输出失败时返回 null，让上层显式回退模板文案。
   */
  async generateDailyReportGroundedInsight(params: {
    scene: 'PERSONAL_CONFIRMATION' | 'TEAM_PREVIEW' | 'SUMMARY_BATCH';
    requesterName: string;
    factSummary: string;
    helpSummary?: string;
    shareSummary?: string;
    planSummary?: string;
    missingSummary?: string;
  }): Promise<DailyReportGroundedInsightOutput | null> {
    if (process.env.NODE_ENV === 'test') {
      return null;
    }

    const config = this.getCurrentAiConfig();
    if (!config.enabled || !config.baseUrl || !config.model || !config.apiKey) {
      return null;
    }

    try {
      return await this.runCodexDailyReportGroundedInsightPrompt(config, params);
    } catch (error) {
      this.analysisLoggerService.logWarn('日报 grounded AI 摘要生成失败，已回退事实模板。', {
        reason: error instanceof Error ? error.message : 'unknown',
      });
      return null;
    }
  }

  /**
   * 识别企业微信活跃任务下的帮助 / 取消 / 切换任务回复。
   *
   * 仅用于固定前置校验后的企业微信活跃任务上下文，不承担执行逻辑。
   */
  async classifyWecomTaskReplyIntent(params: {
    messageText: string;
    activeTaskLabel: string;
  }): Promise<WecomTaskReplyIntentOutput | null> {
    if (process.env.WECOM_AI_ENTRY_INTENT_ENABLED === 'false') {
      return null;
    }

    if (process.env.NODE_ENV === 'test') {
      return null;
    }

    if (!params.messageText.trim()) {
      return null;
    }

    const config = this.getCurrentAiConfig();
    if (!config.enabled || !config.baseUrl || !config.model || !config.apiKey) {
      return null;
    }

    try {
      const capabilityResult =
        await this.ensureCapabilityPackRuntime().executeStructuredPack<
          {
            messageText: string;
            activeTaskLabel: string;
          },
          Record<string, unknown>,
          WecomActiveTaskReplyPackOutput
        >({
          packCode: 'wecom-active-task-reply-pack',
          context: params,
          cwd: this.resolveBackendWorkingDirectory(),
        });
      if (capabilityResult.status === 'SUCCEEDED' || capabilityResult.status === 'NONE') {
        return {
          ...(capabilityResult.output ?? { intent: 'NONE' }),
          ...this.buildCapabilityPackMetadata(capabilityResult),
        };
      }

      this.logCapabilityPackFailure('企业微信任务回复意图分类', capabilityResult);
      return {
        intent: 'NONE',
        ...this.buildCapabilityPackMetadata(capabilityResult),
      };
    } catch (error) {
      this.analysisLoggerService.logWarn('企业微信任务回复意图分类失败，已回退关键词判断。', {
        reason: error instanceof Error ? error.message : 'unknown',
      });
      return null;
    }
  }

  /**
   * 识别企业微信空闲态消息属于帮助、跟进、日报查看、解释追问、改条件追问还是普通分析。
   *
   * 该能力与活跃任务回复共用 semantic reply lane，尽量让空闲态自然语言先经过 AI 理解，
   * 再由上层决定进入哪条固定程序。
   */
  async classifyWecomIdleConversationIntent(params: {
    messageText: string;
    latestQuestion?: string;
    latestSummary?: string;
    latestResultContext?: WecomLatestResultContext;
    hasPendingSlots: boolean;
  }): Promise<WecomIdleConversationIntentOutput | null> {
    if (process.env.WECOM_AI_ENTRY_INTENT_ENABLED === 'false') {
      return null;
    }

    if (process.env.NODE_ENV === 'test') {
      return this.classifyTestWecomIdleConversationIntent(params.messageText);
    }

    if (!params.messageText.trim()) {
      return null;
    }

    const config = this.getCurrentAiConfig();
    if (!config.enabled || !config.baseUrl || !config.model || !config.apiKey) {
      return null;
    }

    try {
      const capabilityResult =
        await this.ensureCapabilityPackRuntime().executeStructuredPack<
          {
            messageText: string;
            latestQuestion?: string;
            latestSummary?: string;
            latestResultContext?: WecomLatestResultContext;
            hasPendingSlots: boolean;
          },
          Record<string, unknown>,
          WecomIdleEntryPackOutput
        >({
          packCode: 'wecom-idle-entry-pack',
          context: params,
          cwd: this.resolveBackendWorkingDirectory(),
        });
      if (capabilityResult.status === 'SUCCEEDED' || capabilityResult.status === 'NONE') {
        const normalizedOutput = this.normalizeWecomIdleConversationIntentOutput({
          messageText: params.messageText,
          output: capabilityResult.output ?? { intent: 'NONE' },
        });
        return {
          ...normalizedOutput,
          ...this.buildCapabilityPackMetadata(capabilityResult),
        };
      }

      this.logCapabilityPackFailure('企业微信空闲态消息意图分类', capabilityResult);
      return {
        intent: 'NONE',
        ...this.buildCapabilityPackMetadata(capabilityResult),
      };
    } catch (error) {
      this.analysisLoggerService.logWarn('企业微信空闲态消息意图分类失败，已回退规则判断。', {
        reason: error instanceof Error ? error.message : 'unknown',
      });
      return null;
    }
  }

  /**
   * 对企业微信空闲态 AI 分类结果做最小执行边界校验。
   *
   * 设计原因：
   * 1. 新建客户 / 新建商机属于固定创建程序流，必须要求消息里存在显式创建入口；
   * 2. 一旦把普通经营分析问句误送进创建链路，后续会话就会进入错误状态机，影响用户继续问数；
   * 3. 这里只拦截会导致固定程序误执行的结果，不替代主语义理解。
   */
  private normalizeWecomIdleConversationIntentOutput(params: {
    messageText: string;
    output: WecomIdleConversationIntentOutput;
  }): WecomIdleConversationIntentOutput {
    if (
      params.output.intent !== 'CRM_CREATE_CUSTOMER' &&
      params.output.intent !== 'CRM_CREATE_OPPORTUNITY'
    ) {
      return params.output;
    }

    const crmCreateIntent = detectWecomCrmCreateIntent(params.messageText);
    const expectedIntent =
      crmCreateIntent === 'Customer'
        ? 'CRM_CREATE_CUSTOMER'
        : crmCreateIntent === 'Opportunity'
          ? 'CRM_CREATE_OPPORTUNITY'
          : undefined;

    if (params.output.intent !== expectedIntent) {
      return {
        intent: 'NONE',
      };
    }

    return params.output;
  }

  /**
   * 识别分析追问属于“解释结果”还是“重新分析”。
   *
   * 用于统一 Web 与企业微信在已有结果上下文中的 follow-up 分流。
   */
  async classifyAnalysisFollowUpIntent(params: {
    questionText: string;
    latestQuestion?: string;
    latestSummary?: string;
    latestResultContext?: WecomLatestResultContext;
    channel: 'web-console' | 'wecom-bot';
  }): Promise<AnalysisFollowUpIntent | null> {
    if (process.env.AI_ANALYSIS_FOLLOW_UP_INTENT_ENABLED === 'false') {
      return null;
    }

    if (process.env.NODE_ENV === 'test') {
      return this.classifyTestAnalysisFollowUpIntent(params.questionText);
    }

    if (!params.questionText.trim()) {
      return null;
    }

    const config = this.getCurrentAiConfig();
    if (!config.enabled || !config.baseUrl || !config.model || !config.apiKey) {
      return null;
    }

    try {
      const capabilityResult =
        await this.ensureCapabilityPackRuntime().executeStructuredPack<
          {
            questionText: string;
            latestQuestion?: string;
            latestSummary?: string;
            latestResultContext?: WecomLatestResultContext;
            channel: 'web-console' | 'wecom-bot';
          },
          Record<string, unknown>,
          AnalysisFollowUpPackOutput
        >({
          packCode: 'analysis-follow-up-pack',
          context: params,
          cwd: this.resolveBackendWorkingDirectory(),
        });
      if (capabilityResult.status === 'SUCCEEDED') {
        return capabilityResult.output?.intent ?? null;
      }

      this.logCapabilityPackFailure('分析追问意图分类', capabilityResult);
      return null;
    } catch (error) {
      this.analysisLoggerService.logWarn('分析追问意图分类失败，已回退本地关键词判断。', {
        reason: error instanceof Error ? error.message : 'unknown',
      });
      return null;
    }
  }

  /**
   * 构造发给 Codex 的提示词。
   *
   * 这里不是通用聊天提示，而是“严格受控的问数意图解析提示”：
   * - 明确限定主题域、指标、维度的可选范围；
   * - 明确写入型问题必须被阻断；
   * - 明确未给时间范围时按当前权限全量查询，不把“时间范围”作为缺项；
   * - 要求返回结构化 JSON，供后续查询计划和 SQL 编译链路消费。
   */
  private buildIntentPrompt(questionText: string): string {
    return [
      '你是 CRM 智能分析系统的一期问数意图解析器。',
      '请把用户问题转成结构化 JSON。',
      '必须严格遵守以下限制：',
      '1. 主题只能是 opportunity-analysis、contract-conversion、customer-relationship。',
      '2. 指标只能从 新增商机金额、商机数量、赢单率、转合同金额、客户贡献度 中选择。',
      '3. 维度只能从 销售负责人、区域、渠道商、月份、商机阶段、客户分类 中选择；用户说“服务商、渠道、伙伴、代理商、经销商”时统一输出“渠道商”。',
      '4. 如果问题包含新增/创建/修改/删除/提醒等写操作，requestedAction 必须是 BLOCK。',
      '5. 如果问题完全没有给时间范围，不要把“时间范围”放入 missingConditions，后续会默认查询当前账号权限内全部可见数据；如果问题包含自然语言时间表达，必须输出 temporalSlot，并给出 startAt/endAt、时区、粒度、相对/绝对类型和置信度。',
      '5.1 missingConditions 只允许填写真正阻断执行、必须用户补充的缺口；如果问题已经能按默认指标、默认维度或权限内全量范围执行，不要把“未指定指标/维度/时间但默认提供...”写入 missingConditions。',
      '6. 低置信、缺边界或歧义时间表达必须标记 LOW 并填写 unresolvedReason，不得编造边界。',
      '7. normalizedQuestion 使用中文原问题的规范化版本。',
      '8. 如果 requestedAction 是 BLOCK，blockReason 必须给出阻断原因；如果不是 BLOCK，blockReason 也要返回空字符串，保证输出结构稳定。',
      `用户问题：${questionText}`,
    ].join('\n');
  }

  /**
   * 构造企业微信跟进四段草稿抽取提示词。
   *
   * 这里要求模型只做“归类与留空”，不做补造：
   * - 无法确认的字段必须输出空字符串；
   * - 同一句若同时包含多个语义，允许拆到多个字段；
   * - 输出稳定 JSON，交由上层继续做缺项提示、确认和写回边界控制。
   */
  private buildWecomFollowUpStructuredDraftPrompt(params: {
    requesterName: string;
    messageText: string;
  }): string {
    return [
      '你是 CRM 智能分析系统里的企业微信跟进草稿整理器。',
      '请把用户原文整理为四段结构化草稿 JSON。',
      '必须严格遵守以下限制：',
      '1. 只能基于用户原文整理，不得编造用户未表达的业务事实。',
      '2. 只输出 JSON，不要输出解释。',
      '3. 无法确认的字段必须输出空字符串。',
      '4. followUpContent 表示已发生的跟进事实、进展或结果。',
      '5. helpNeeded 表示遇到的问题、阻塞项、协助诉求。',
      '6. informationShare 表示值得同步的信息、客户反馈、行业信息、友商信息。',
      '7. visitPlan 表示下一步计划、后续安排、明日计划、下次拜访计划。',
      '8. 同一句如同时包含多个语义，可以拆到多个字段；但不得重复大段复写同一句到所有字段。',
      '9. 若原文里明确出现“客户不好沟通”“推进缓慢”“卡住”“需要协助”等问题/阻塞表达，优先归到 helpNeeded。',
      '10. 若原文里明确出现“明天继续跟进”“后续安排”“下次拜访”“明日下午确认”这类下一步动作，优先归到 visitPlan。',
      '11. 某个字段未出现时，未出现则输出空字符串，不得把整段原文全部压到 followUpContent。',
      '12. 以下是真实话术示例，请按同样口径抽取：',
      '示例A 原文：今天跟进了安恒信息，尬聊了一天，无进度更新，客户不好沟通，推进缓慢，明天继续跟进',
      '示例A 输出：{"requesterName":"销售总监","followUpContent":"今天跟进了安恒信息；尬聊了一天；无进度更新","helpNeeded":"客户不好沟通；推进缓慢","informationShare":"","visitPlan":"明天继续跟进"}',
      '示例B 原文：今天拜访了山东农信续约项目，客户认可续签方向，但需要区域经理确认折扣底线，客户更关注交付周期，明天下午继续确认 POC 时间',
      '示例B 输出：{"requesterName":"销售总监","followUpContent":"今天拜访了山东农信续约项目；客户认可续签方向","helpNeeded":"需要区域经理确认折扣底线","informationShare":"客户更关注交付周期","visitPlan":"明天下午继续确认 POC 时间"}',
      `发送人：${params.requesterName}`,
      `用户原文：${params.messageText}`,
    ].join('\n');
  }

  /**
   * 约束跟进四段草稿的模型输出结构。
   *
   * 所有字段均要求稳定返回字符串，缺失时返回空字符串，
   * 避免上层在解析时处理不稳定的 null / 缺字段情况。
   */
  private buildWecomFollowUpStructuredDraftSchema(): Record<string, unknown> {
    return {
      type: 'object',
      additionalProperties: false,
      required: [
        'requesterName',
        'followUpContent',
        'helpNeeded',
        'informationShare',
        'visitPlan',
      ],
      properties: {
        requesterName: { type: 'string' },
        followUpContent: { type: 'string' },
        helpNeeded: { type: 'string' },
        informationShare: { type: 'string' },
        visitPlan: { type: 'string' },
      },
    };
  }

  /**
   * 构造企业微信候选重排提示词。
   *
   * 模型只能在现有候选集合内排序和推荐，不能新造候选。
   */
  private buildWecomCandidateRerankPrompt(params: {
    queryText: string;
    candidates: WecomCandidateRerankInput[];
  }): string {
    const candidateLines = params.candidates.map((candidate, index) => {
      const detailsText = (candidate.details ?? [])
        .map((item) => item?.trim())
        .filter((item): item is string => Boolean(item))
        .join('｜');
      return `${index + 1}. id=${candidate.id ?? `candidate_${index + 1}`}；name=${candidate.name}${detailsText ? `；details=${detailsText}` : ''}`;
    });

    return [
      '你是 CRM 智能分析系统里的企业微信候选重排器。',
      '你只能在给定候选集合内做排序与推荐，绝不能新增集合外候选。',
      '请输出结构化 JSON，只返回排序后的候选、推荐候选和推荐理由。',
      '必须严格遵守以下限制：',
      '1. candidates 数组中的 name 必须全部来自输入候选集合。',
      '2. 推荐理由只能说明匹配原因，不得引入集合外事实。',
      '3. confidence 只能取 HIGH、MEDIUM、LOW。',
      `用户上下文：${params.queryText}`,
      '候选集合：',
      ...candidateLines,
    ].join('\n');
  }

  private buildWecomCandidateRerankSchema(): Record<string, unknown> {
    return {
      type: 'object',
      additionalProperties: false,
      required: ['candidates', 'recommendedCandidate'],
      properties: {
        candidates: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'name', 'confidence', 'recommendationReason'],
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              confidence: {
                type: 'string',
                enum: ['HIGH', 'MEDIUM', 'LOW'],
              },
              recommendationReason: { type: 'string' },
            },
          },
        },
        recommendedCandidate: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'name', 'confidence', 'recommendationReason'],
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            confidence: {
              type: 'string',
              enum: ['HIGH', 'MEDIUM', 'LOW'],
            },
            recommendationReason: { type: 'string' },
          },
        },
      },
    };
  }

  private buildGroundedAnalysisInsightPrompt(params: {
    title?: string;
    summary?: string;
    scopeSummary?: string;
    keyFindings: string[];
  }): string {
    return [
      '你是 CRM 智能分析系统里的 grounded 洞察生成器。',
      '你只能基于当前结果包事实生成解释和下一步建议问题，不得编造结果包之外的事实，也不得发起新的数据读取。',
      '请输出 JSON。',
      '必须严格遵守以下限制：',
      '1. groundedExplanation 必须只总结当前结果包已确认的事实。',
      '2. nextBestQuestions 必须是中文短句数组，长度 0 到 3。',
      '3. 不得引入结果包中不存在的客户、负责人、数值、排行或原因。',
      `结果标题：${params.title ?? '无'}`,
      `结果摘要：${params.summary ?? '无'}`,
      `权限摘要：${params.scopeSummary ?? '无'}`,
      `关键发现：${params.keyFindings.length > 0 ? params.keyFindings.join('；') : '无'}`,
    ].join('\n');
  }

  private buildGroundedAnalysisInsightSchema(): Record<string, unknown> {
    return {
      type: 'object',
      additionalProperties: false,
      required: ['groundedExplanation', 'nextBestQuestions'],
      properties: {
        groundedExplanation: { type: 'string' },
        nextBestQuestions: {
          type: 'array',
          items: { type: 'string' },
          maxItems: 3,
        },
      },
    };
  }

  private buildAnalysisExecutionModePrompt(params: {
    questionText: string;
    channel: 'web-console' | 'wecom-bot';
  }): string {
    return [
      '你是 CRM 智能分析系统的执行模式建议器。',
      '请只判断当前问题更适合 PLAN_EXECUTION 还是 GUARDED_DIRECT_QUERY。',
      '必须严格遵守以下限制：',
      '1. 只输出 JSON。',
      '2. 只返回 executionMode 和 reason 两个字段。',
      '3. 如果问题是常规高频排行、趋势、分布、明细查询，优先建议 GUARDED_DIRECT_QUERY。',
      '4. 如果问题更像复杂补问、依赖严格结构化计划、或存在较高歧义，建议 PLAN_EXECUTION。',
      `入口渠道：${params.channel}`,
      `用户问题：${params.questionText}`,
    ].join('\n');
  }

  private buildAnalysisExecutionModeSchema(): Record<string, unknown> {
    return {
      type: 'object',
      additionalProperties: false,
      required: ['executionMode', 'reason'],
      properties: {
        executionMode: {
          type: 'string',
          enum: ['PLAN_EXECUTION', 'GUARDED_DIRECT_QUERY'],
        },
        reason: { type: 'string' },
      },
    };
  }

  private buildControlledDirectQueryTaskPrompt(params: {
    questionText: string;
    channel: 'web-console' | 'wecom-bot';
    domain: AnalysisIntent['domain'];
    metrics: string[];
    dimensions: string[];
    filters: Record<string, unknown>;
    temporalSlot?: TemporalSlot;
    knowledgeContextText?: string;
    expectedTaskTitle: string;
    expectedResultKind: ControlledDirectQueryTaskOutput['resultKind'];
    expectedPurpose: string;
  }): string {
    return [
      '你是 CRM 智能分析系统的受控直查任务生成器。',
      '请基于当前问题生成 1 条只读查询任务 JSON；上层会按既定任务骨架逐条调用，供后端安全栈继续校验和执行。',
      '必须严格遵守以下限制：',
      '1. 只能生成单条只读 SELECT 查询。',
      '2. 不能包含 INSERT、UPDATE、DELETE、DROP、ALTER、TRUNCATE。',
      '3. taskTitle 必须与期望任务标题保持一致，不得自行改成别的主题。',
      '4. resultKind 只能从 metric-summary、owner-ranking、time-trend、stage-distribution、category-distribution、department-contribution、partner-contribution、risk-overview 中选择，且必须与期望 resultKind 保持一致。',
      '5. tables 必须只列出本次 SQL 真正访问的表。',
      '6. fieldEntries 必须列出每张表实际访问到的字段。',
      '7. joinPaths 只列出显式 join 路径，若无 join 则返回空数组。',
      '8. allowedFunctions 只列出 SQL 中实际使用的函数。',
      '9. rowLimit 取 1 到 1000 之间，timeoutMs 取 500 到 5000 之间。',
      '10. 必须消费 temporalSlot 中的 startAt/endAt 生成时间条件，并在 temporalSlot 字段原样回写时间槽。',
      '11. 必须说明所选时间字段：商机新增默认 opportunities.created_at，合同签单默认 contracts.created_at（CRM 原始数据页的提交日期），客户默认 customers.created_at；不得使用 updated_at、deleted_at 或未在白名单内的字段。',
      '12. 入口渠道只影响后续展示层，不得因为 web-console 或 wecom-bot 改变主查询对象、resultKind、时间口径或事实边界；同一问题在两个渠道必须生成等价任务。',
      `入口渠道：${params.channel}`,
      `用户问题：${params.questionText}`,
      `主题域：${params.domain}`,
      `指标：${params.metrics.join('、') || '无'}`,
      `维度：${params.dimensions.join('、') || '无'}`,
      `过滤条件：${JSON.stringify(params.filters)}`,
      `标准时间槽：${JSON.stringify(params.temporalSlot ?? null)}`,
      `期望任务标题：${params.expectedTaskTitle}`,
      `期望结果类型：${params.expectedResultKind}`,
      `期望任务用途：${params.expectedPurpose}`,
      ...(params.knowledgeContextText
        ? [`问数知识层提示：\n${params.knowledgeContextText}`]
        : []),
    ].join('\n');
  }

  private buildAnalysisWarehouseQueryTaskPrompt(params: {
    questionText: string;
    channel: 'web-console' | 'wecom-bot';
    semanticCatalogText: string;
    metricCatalogText: string;
    scopeSummary: string;
    temporalSlot?: TemporalSlot;
  }): string {
    return [
      '你是 CRM 智能分析系统的 AI-agent 分析库 Text-to-SQL 生成器。',
      '请基于语义字段目录生成 1 条只读 SELECT，用于查询 AI-agent 自建 MySQL 分析库。',
      '必须严格遵守以下限制：',
      '1. 只能访问语义目录中列出的 dim_lianruan_* 和 fact_lianruan_* 表，禁止访问 ods_lianruan_raw_records、系统库和任意未列出的表。',
      '2. 只能生成单条 SELECT，禁止 INSERT、UPDATE、DELETE、DROP、ALTER、TRUNCATE、CREATE 和多语句。',
      '3. 不得使用 SELECT *，必须显式列字段，并给聚合结果设置清晰别名。',
      '4. 优先使用中文业务含义理解字段：服务商等同渠道商/合作伙伴/代理商，报备对应 fact_lianruan_registration，商机对应 fact_lianruan_opportunity，报价对应 fact_lianruan_quote，订单/下单对应 fact_lianruan_order。',
      '5. 只使用语义目录中的字段，不能编造字段；如果字段不足，尽量用已有字段完成可回答部分。',
      '6. 如问题包含时间范围，必须使用 temporalSlot 中 startAt/endAt 生成时间条件；没有时间范围时不要臆造时间过滤。',
      '7. rowLimit 取 1 到 1000，timeoutMs 取 500 到 5000。',
      '8. tables、fieldEntries、allowedFunctions 必须与 SQL 实际使用保持一致。',
      '9. 当前权限摘要仅用于理解结果口径；程序会在 SQL 执行前自动注入当前用户的区域、服务商或负责人权限条件，AI 不得自行扩大权限范围。',
      '10. 区域/大区分析优先使用各事实表已标准化的 region/big_region；联软已为报价和订单按对象、商机、报价、渠道和负责人继承规则补齐 region/big_region。',
      '11. 有效订单默认排除 status 为 cancelled、canceled、void、rejected、deleted 的记录；completed、paid、confirmed、signed 可优先视为有效。',
      '12. 超过两周未更新商机使用 DATEDIFF(CURRENT_DATE(), DATE(source_updated_at)) > 14，并排除 stage/status 为 won、lost、已成交、已失单 的商机。',
      '13. 最近 30 天未活跃客户使用 latest_activity_at，空值可作为未活跃处理；不要用 ODS 原始 JSON 自行推断。',
      '14. 报备到订单漏斗优先按 customer_id 串联报备、商机、报价、订单；报价可通过 opportunity_id 关联商机，订单可通过 customer_id 或后续 P4 受控模板进一步精确关联。',
      `入口渠道：${params.channel}`,
      `用户问题：${params.questionText}`,
      `权限摘要：${params.scopeSummary}`,
      `标准时间槽：${JSON.stringify(params.temporalSlot ?? null)}`,
      `语义字段目录：\n${params.semanticCatalogText}`,
      `语义指标目录：\n${params.metricCatalogText}`,
    ].join('\n');
  }

  private buildControlledDirectQueryTaskSchema(): Record<string, unknown> {
    return {
      type: 'object',
      additionalProperties: false,
      required: [
        'taskTitle',
        'resultKind',
        'sql',
        'tables',
        'fieldEntries',
        'joinPaths',
        'allowedFunctions',
        'rowLimit',
        'timeoutMs',
        'temporalSlot',
      ],
      properties: {
        taskTitle: { type: 'string' },
        resultKind: {
          type: 'string',
          enum: ['metric-summary', 'owner-ranking', 'time-trend', 'stage-distribution', 'category-distribution', 'department-contribution', 'partner-contribution', 'risk-overview'],
        },
        sql: { type: 'string' },
        tables: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
        },
        fieldEntries: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['table', 'fields'],
            properties: {
              table: { type: 'string' },
              fields: {
                type: 'array',
                items: { type: 'string' },
                minItems: 1,
              },
            },
          },
        },
        joinPaths: {
          type: 'array',
          items: { type: 'string' },
        },
        allowedFunctions: {
          type: 'array',
          items: { type: 'string' },
        },
        rowLimit: {
          type: 'integer',
          minimum: 1,
          maximum: 1000,
        },
        timeoutMs: {
          type: 'integer',
          minimum: 500,
          maximum: 5000,
        },
        temporalSlot: this.buildTemporalSlotSchema(),
      },
    };
  }

  /**
   * 构造统一时间槽 JSON Schema。
   *
   * 参数说明：无。
   * 返回值：供意图解析和受控直查任务生成共用的时间槽结构约束。
   * 调用注意：该 schema 只约束形状，真实执行前仍必须走程序侧时间边界校验。
   */
  private buildTemporalSlotSchema(): Record<string, unknown> {
    return {
      type: 'object',
      additionalProperties: false,
      required: [
        'rawText',
        'normalizedLabel',
        'startAt',
        'endAt',
        'timezone',
        'granularity',
        'relativity',
        'inclusivity',
        'confidence',
      ],
      properties: {
        rawText: { type: 'string' },
        normalizedLabel: { type: 'string' },
        startAt: { type: 'string' },
        endAt: { type: 'string' },
        timezone: { type: 'string', enum: ['Asia/Shanghai'] },
        granularity: {
          type: 'string',
          enum: ['day', 'week', 'month', 'quarter', 'year', 'custom'],
        },
        relativity: {
          type: 'string',
          enum: ['absolute', 'relative', 'mixed'],
        },
        inclusivity: {
          type: 'object',
          additionalProperties: false,
          required: ['start', 'end'],
          properties: {
            start: { type: 'string', enum: ['inclusive'] },
            end: { type: 'string', enum: ['exclusive', 'inclusive'] },
          },
        },
        confidence: {
          type: 'string',
          enum: ['HIGH', 'MEDIUM', 'LOW'],
        },
        unresolvedReason: { type: 'string' },
      },
    };
  }

  private buildAnalysisFollowUpIntentPrompt(params: {
    questionText: string;
    latestQuestion?: string;
    latestSummary?: string;
    channel: 'web-console' | 'wecom-bot';
  }): string {
    return [
      '你是 CRM 智能分析系统的追问分流器。',
      '请判断当前追问属于 EXPLAIN_RESULT 还是 RUN_NEW_ANALYSIS。',
      'EXPLAIN_RESULT 表示用户想继续解释、理解、确认上一轮结果，不需要重新取数。',
      'RUN_NEW_ANALYSIS 表示用户想改条件、改维度、改时间范围、继续比较或重新分析，需要重新取数。',
      '只输出 JSON。',
      `入口渠道：${params.channel}`,
      `当前追问：${params.questionText}`,
      `上一轮问题：${params.latestQuestion ?? '无'}`,
      `上一轮结果摘要：${params.latestSummary ?? '无'}`,
    ].join('\n');
  }

  private buildAnalysisFollowUpIntentSchema(): Record<string, unknown> {
    return {
      type: 'object',
      additionalProperties: false,
      required: ['intent'],
      properties: {
        intent: {
          type: 'string',
          enum: ['EXPLAIN_RESULT', 'RUN_NEW_ANALYSIS'],
        },
      },
    };
  }

  private buildDailyReportGroundedInsightPrompt(params: {
    scene: 'PERSONAL_CONFIRMATION' | 'TEAM_PREVIEW' | 'SUMMARY_BATCH';
    requesterName: string;
    factSummary: string;
    helpSummary?: string;
    shareSummary?: string;
    planSummary?: string;
    missingSummary?: string;
  }): string {
    return [
      '你是 CRM 智能分析系统里的日报 grounded 摘要生成器。',
      '请只基于当前已确认事实生成中文摘要，不得编造新事实，也不得要求重新取数。',
      '只输出 JSON。',
      'summaryLines 表示可直接展示给用户或主管的摘要句子数组，长度 1 到 4。',
      `场景：${params.scene}`,
      `查看主体：${params.requesterName}`,
      `事实摘要：${params.factSummary}`,
      `协助摘要：${params.helpSummary ?? '无'}`,
      `信息共享摘要：${params.shareSummary ?? '无'}`,
      `计划摘要：${params.planSummary ?? '无'}`,
      `缺失摘要：${params.missingSummary ?? '无'}`,
    ].join('\n');
  }

  private buildDailyReportGroundedInsightSchema(): Record<string, unknown> {
    return {
      type: 'object',
      additionalProperties: false,
      required: ['summaryLines'],
      properties: {
        summaryLines: {
          type: 'array',
          minItems: 1,
          maxItems: 4,
          items: { type: 'string' },
        },
      },
    };
  }

  private buildWecomTaskReplyIntentPrompt(params: {
    messageText: string;
    activeTaskLabel: string;
  }): string {
    return [
      '你是 CRM 智能分析系统的企业微信任务回复意图分类器。',
      '当前用户已经处于一个进行中的任务，请判断这条回复属于 HELP_GUIDANCE、TASK_CANCEL、TASK_SWITCH、DIRECT_SUBMIT、CONTINUE_EXECUTION、MODIFY_CONTENT 还是 NONE。',
      '如果是 TASK_SWITCH，target 只能从以下值中选择：DAILY_REPORT_ENTRY、DAILY_REPORT_QUERY、TEAM_DAILY_REPORT_QUERY、FOLLOW_UP_TEMPLATE、CRM_CREATE_CUSTOMER、CRM_CREATE_OPPORTUNITY。',
      'DIRECT_SUBMIT 表示按当前草稿继续流程；CONTINUE_EXECUTION 表示继续当前确认流程；MODIFY_CONTENT 表示用户想修改内容但当前消息不一定直接给出新正文。',
      '只输出 JSON。',
      `当前任务：${params.activeTaskLabel}`,
      `用户回复：${params.messageText}`,
    ].join('\n');
  }

  private buildWecomTaskReplyIntentSchema(): Record<string, unknown> {
    return {
      type: 'object',
      additionalProperties: false,
      required: ['intent'],
      properties: {
        intent: {
          type: 'string',
          enum: [
            'HELP_GUIDANCE',
            'TASK_CANCEL',
            'TASK_SWITCH',
            'DIRECT_SUBMIT',
            'CONTINUE_EXECUTION',
            'MODIFY_CONTENT',
            'NONE',
          ],
        },
        target: {
          anyOf: [
            {
              type: 'string',
              enum: [
                'DAILY_REPORT_ENTRY',
                'DAILY_REPORT_QUERY',
                'TEAM_DAILY_REPORT_QUERY',
                'FOLLOW_UP_TEMPLATE',
                'CRM_CREATE_CUSTOMER',
                'CRM_CREATE_OPPORTUNITY',
              ],
            },
            {
              type: 'null',
            },
          ],
        },
      },
    };
  }

  private buildWecomIdleConversationIntentPrompt(params: {
    messageText: string;
    latestQuestion?: string;
    latestSummary?: string;
    hasPendingSlots: boolean;
  }): string {
    return [
      '你是 CRM 智能分析系统的企业微信空闲态入口分类器。',
      '请判断这条消息更适合进入 HELP_GUIDANCE、DAILY_REPORT、DAILY_REPORT_QUERY、TEAM_DAILY_REPORT_QUERY、CRM_CREATE_CUSTOMER、CRM_CREATE_OPPORTUNITY、OPPORTUNITY_LOOKUP、EXPLAIN_RESULT、FOLLOW_UP_ANALYZE、ANALYZE 还是 NONE。',
      '必须遵守以下限制：',
      '1. HELP_GUIDANCE 用于打招呼、能力询问、求帮助；helpScene 只能是 GREETING 或 CAPABILITY。',
      '2. DAILY_REPORT 用于今日跟进 / 跟进商机 / 跟进客户 / 帮我写今日跟进，以及“今天跟进了某客户 / 商机、推进缓慢、明天继续跟进”这类明显跟进叙述；dailyReportPrompt 只能是 FOLLOW_UP_TEMPLATE_ENTRY 或 DAILY_REPORT_THEME_ENTRY。',
      '3. DAILY_REPORT_QUERY 用于查看今日日报 / 生成日报 / 查看我的日报这类个人日报查看。',
      '4. TEAM_DAILY_REPORT_QUERY 用于“把王文定小组日报发给我”这类查看指定小组今日日报的请求；需要同时输出 leaderNameQuery。',
      '5. CRM_CREATE_CUSTOMER / CRM_CREATE_OPPORTUNITY 用于新增客户 / 新增商机这类创建主题入口。',
      '6. OPPORTUNITY_LOOKUP 用于“查苏州制造 / 查安恒信息项目 / 查这个客户”这类显式查项目、查客户、查商机；需要输出 lookupText。',
      '7. EXPLAIN_RESULT 只在已有 latestSummary 时使用，表示当前消息是在追问“为什么 / 这说明什么 / 怎么理解”。',
      '8. FOLLOW_UP_ANALYZE 只在已有 latestQuestion 或 latestSummary 时使用，表示当前消息是在改时间范围、改维度或补充筛选条件。',
      '9. ANALYZE 用于普通经营分析问句。',
      '10. 如果当前消息无法安全判定，或更像待补问里的简短续填，返回 NONE。',
      '11. 只输出 JSON。',
      `当前消息：${params.messageText}`,
      `上一轮问题：${params.latestQuestion ?? '无'}`,
      `上一轮结果摘要：${params.latestSummary ?? '无'}`,
      `当前是否存在待补问：${params.hasPendingSlots ? '是' : '否'}`,
    ].join('\n');
  }

  private buildWecomIdleConversationIntentSchema(): Record<string, unknown> {
    return {
      type: 'object',
      additionalProperties: false,
      required: ['intent'],
      properties: {
        intent: {
          type: 'string',
          enum: [
            'HELP_GUIDANCE',
            'DAILY_REPORT',
            'DAILY_REPORT_QUERY',
            'TEAM_DAILY_REPORT_QUERY',
            'CRM_CREATE_CUSTOMER',
            'CRM_CREATE_OPPORTUNITY',
            'OPPORTUNITY_LOOKUP',
            'EXPLAIN_RESULT',
            'FOLLOW_UP_ANALYZE',
            'ANALYZE',
            'NONE',
          ],
        },
        helpScene: {
          anyOf: [
            {
              type: 'string',
              enum: ['GREETING', 'CAPABILITY'],
            },
            {
              type: 'null',
            },
          ],
        },
        dailyReportPrompt: {
          anyOf: [
            {
              type: 'string',
              enum: ['FOLLOW_UP_TEMPLATE_ENTRY', 'DAILY_REPORT_THEME_ENTRY'],
            },
            {
              type: 'null',
            },
          ],
        },
        leaderNameQuery: {
          anyOf: [
            {
              type: 'string',
            },
            {
              type: 'null',
            },
          ],
        },
        lookupText: {
          anyOf: [
            {
              type: 'string',
            },
            {
              type: 'null',
            },
          ],
        },
      },
    };
  }

  /**
   * 定义 Codex 返回结果的 JSON Schema。
   *
   * 设计目的：
   * 1. 把模型输出限制为固定结构，避免自然语言描述混入；
   * 2. 让后端能直接将结果映射为 AnalysisIntent；
   * 3. 在“高/中/低置信度”和“阻断原因”层面给后续校验与拒答逻辑提供依据。
   */
  private buildIntentSchema(): Record<string, unknown> {
    return {
      type: 'object',
      additionalProperties: false,
      required: [
        'domain',
        'metrics',
        'dimensions',
        'missingConditions',
        'normalizedQuestion',
        'timeRange',
        'startAt',
        'requestedAction',
        'confidence',
        'blockReason',
      ],
      properties: {
        domain: {
          type: 'string',
          enum: [
            'opportunity-analysis',
            'contract-conversion',
            'customer-relationship',
          ],
        },
        metrics: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'string',
            enum: ['新增商机金额', '商机数量', '赢单率', '转合同金额', '客户贡献度'],
          },
        },
        dimensions: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['销售负责人', '区域', '渠道商', '月份', '商机阶段', '客户分类'],
          },
        },
        missingConditions: {
          type: 'array',
          items: { type: 'string' },
        },
        normalizedQuestion: { type: 'string' },
        timeRange: { type: 'string' },
        startAt: { type: 'string' },
        temporalSlot: this.buildTemporalSlotSchema(),
        requestedAction: {
          type: 'string',
          enum: ['READONLY_ANALYSIS', 'BLOCK'],
        },
        confidence: {
          type: 'string',
          enum: ['HIGH', 'MEDIUM', 'LOW'],
        },
        blockReason: { type: 'string' },
      },
    };
  }

  /**
   * 旧 Codex SDK 主运行时已移除；保留该方法只用于阻断遗留调用路径。
   */
  private async importCodexSdk(): Promise<RemovedCodexSdkModule> {
    throw new Error('旧 Codex SDK 运行时已移除，请通过统一 AI 执行门面调用。');
  }

  /**
   * 执行一次完整的 Codex 意图解析调用。
   *
   * 主要流程：
   * 1. 通过 codexRunQueue 串行化请求；
   * 2. 临时切换到 backend 目录执行 SDK 逻辑；
   * 3. 使用只读沙箱和禁用 Web 搜索的线程参数，确保意图解析稳定、可控；
   * 4. 用 outputSchema 强制模型输出 JSON；
   * 5. 增加 4 秒超时保护，避免单次请求无限挂起；
   * 6. 最终将 JSON 映射为系统内部的 AnalysisIntent。
   */
  private async runCodexIntentPrompt(
    config: {
      apiKey?: string;
      baseUrl?: string;
      model?: string;
      reasoningEffort?: string;
    },
    questionText: string,
  ): Promise<AnalysisIntent> {
    return await this.runInCodexQueueLane('default', async () => {
      const previousWorkingDirectory = process.cwd();
      const backendWorkingDirectory = this.resolveBackendWorkingDirectory();

      try {
        process.chdir(backendWorkingDirectory);
        try {
          const parsed = (await this.invokeUnifiedStructured(
            config,
            this.buildIntentPrompt(questionText),
            this.buildIntentSchema(),
            backendWorkingDirectory,
          )) as LegacyAnalysisIntentStructuredOutput;

          return {
            domain: parsed.domain,
            metrics: parsed.metrics,
            dimensions: parsed.dimensions,
            filters: {
              ...(parsed.timeRange ? { timeRange: parsed.timeRange } : {}),
              ...(parsed.startAt ? { startAt: parsed.startAt } : {}),
              ...(parsed.temporalSlot?.endAt ? { endAt: parsed.temporalSlot.endAt } : {}),
            },
            ...(parsed.temporalSlot ? { temporalSlot: parsed.temporalSlot } : {}),
            missingConditions: normalizeLegacyIntentMissingConditions(parsed, questionText),
            normalizedQuestion: parsed.normalizedQuestion,
            requestedAction: parsed.requestedAction,
            confidence:
              parsed.confidence === 'HIGH' || parsed.confidence === 'LOW'
                ? parsed.confidence
                : 'MEDIUM',
            blockReason: parsed.blockReason,
          };
        } catch (error) {
          if (!this.shouldFallbackToLegacyCodex(error)) {
            throw error;
          }
        }

        const sdkModule = await this.importCodexSdk();
        const thread = this.startCodexThread(sdkModule, config, 'default');

        const result = await Promise.race([
          thread.run(this.buildIntentPrompt(questionText), {
            outputSchema: this.buildIntentSchema(),
          }),
          new Promise<never>((_, reject) => {
            setTimeout(
              () => reject(new Error('意图解析超时。')),
              this.resolveAiTimeoutMs(
                'ANALYSIS_AI_INTENT_TIMEOUT_MS',
                AiGatewayService.DEFAULT_INTENT_TIMEOUT_MS,
              ),
            );
          }),
        ]);

        const parsed = JSON.parse(result.finalResponse) as LegacyAnalysisIntentStructuredOutput;

        return {
          domain: parsed.domain,
          metrics: parsed.metrics,
          dimensions: parsed.dimensions,
          filters: {
            ...(parsed.timeRange ? { timeRange: parsed.timeRange } : {}),
            ...(parsed.startAt ? { startAt: parsed.startAt } : {}),
            ...(parsed.temporalSlot?.endAt ? { endAt: parsed.temporalSlot.endAt } : {}),
          },
          ...(parsed.temporalSlot ? { temporalSlot: parsed.temporalSlot } : {}),
          missingConditions: normalizeLegacyIntentMissingConditions(parsed, questionText),
          normalizedQuestion: parsed.normalizedQuestion,
          requestedAction: parsed.requestedAction,
          confidence:
            parsed.confidence === 'HIGH' || parsed.confidence === 'LOW'
              ? parsed.confidence
              : 'MEDIUM',
          blockReason: parsed.blockReason,
        };
      } finally {
        process.chdir(previousWorkingDirectory);
      }
    });
  }

  private async runCodexWecomFollowUpStructuredDraftPrompt(
    config: {
      apiKey?: string;
      baseUrl?: string;
      model?: string;
      reasoningEffort?: string;
    },
    params: {
      requesterName: string;
      messageText: string;
    },
  ): Promise<WecomFollowUpTemplateDraft> {
    return await this.runInCodexQueueLane('wecom-structured-draft', async () => {
      const previousWorkingDirectory = process.cwd();
      const backendWorkingDirectory = this.resolveBackendWorkingDirectory();

      try {
        process.chdir(backendWorkingDirectory);
        try {
          const parsed = (await this.invokeUnifiedStructured(
            config,
            this.buildWecomFollowUpStructuredDraftPrompt(params),
            this.buildWecomFollowUpStructuredDraftSchema(),
            backendWorkingDirectory,
          )) as {
            requesterName: string;
            followUpContent: string;
            helpNeeded: string;
            informationShare: string;
            visitPlan: string;
          };

          return {
            requesterName: params.requesterName,
            followUpContent: this.normalizeStructuredDraftField(parsed.followUpContent),
            helpNeeded: this.normalizeStructuredDraftField(parsed.helpNeeded),
            informationShare: this.normalizeStructuredDraftField(parsed.informationShare),
            visitPlan: this.normalizeStructuredDraftField(parsed.visitPlan),
          };
        } catch (error) {
          if (!this.shouldFallbackToLegacyCodex(error)) {
            throw error;
          }
        }

        const sdkModule = await this.importCodexSdk();
        const thread = this.startCodexThread(
          sdkModule,
          config,
          'wecom-structured-draft',
        );

        const result = await Promise.race([
          thread.run(this.buildWecomFollowUpStructuredDraftPrompt(params), {
            outputSchema: this.buildWecomFollowUpStructuredDraftSchema(),
          }),
          new Promise<never>((_, reject) => {
            setTimeout(
              () => reject(new Error('企业微信四段草稿抽取超时。')),
              this.resolveAiTimeoutMs(
                'WECOM_AI_STRUCTURED_DRAFT_TIMEOUT_MS',
                AiGatewayService.DEFAULT_WECOM_STRUCTURED_DRAFT_TIMEOUT_MS,
              ),
            );
          }),
        ]);

        const parsed = JSON.parse(result.finalResponse) as {
          requesterName: string;
          followUpContent: string;
          helpNeeded: string;
          informationShare: string;
          visitPlan: string;
        };

        return {
          requesterName: params.requesterName,
          followUpContent: this.normalizeStructuredDraftField(parsed.followUpContent),
          helpNeeded: this.normalizeStructuredDraftField(parsed.helpNeeded),
          informationShare: this.normalizeStructuredDraftField(parsed.informationShare),
          visitPlan: this.normalizeStructuredDraftField(parsed.visitPlan),
        };
      } finally {
        process.chdir(previousWorkingDirectory);
      }
    });
  }

  private async runCodexWecomCandidateRerankPrompt(
    config: {
      apiKey?: string;
      baseUrl?: string;
      model?: string;
      reasoningEffort?: string;
    },
    params: {
      queryText: string;
      candidates: WecomCandidateRerankInput[];
    },
  ): Promise<WecomCandidateRerankOutput> {
    return await this.runInCodexQueueLane('wecom-entity-rerank', async () => {
      const previousWorkingDirectory = process.cwd();
      const backendWorkingDirectory = this.resolveBackendWorkingDirectory();

      try {
        process.chdir(backendWorkingDirectory);
        try {
          const parsed = (await this.invokeUnifiedStructured(
            config,
            this.buildWecomCandidateRerankPrompt(params),
            this.buildWecomCandidateRerankSchema(),
            backendWorkingDirectory,
          )) as {
            candidates: Array<{
              id: string;
              name: string;
              confidence: 'HIGH' | 'MEDIUM' | 'LOW';
              recommendationReason: string;
            }>;
            recommendedCandidate?: {
              id: string;
              name: string;
              confidence: 'HIGH' | 'MEDIUM' | 'LOW';
              recommendationReason: string;
            };
          };

          const allowedCandidates = new Map(
            params.candidates.map((candidate, index) => [
              candidate.id ?? `candidate_${index + 1}`,
              candidate,
            ]),
          );
          const normalizedCandidates = parsed.candidates
            .filter((item) => allowedCandidates.has(item.id))
            .map((item) => ({
              id: item.id,
              name: item.name,
              confidence: item.confidence,
              recommendationReason:
                item.recommendationReason.trim() || '候选名称与当前上下文更匹配。',
            }));

          if (normalizedCandidates.length === 0) {
            throw new Error('候选重排结果为空。');
          }

          const recommendedCandidate =
            parsed.recommendedCandidate &&
            allowedCandidates.has(parsed.recommendedCandidate.id)
              ? {
                  id: parsed.recommendedCandidate.id,
                  name: parsed.recommendedCandidate.name,
                  confidence: parsed.recommendedCandidate.confidence,
                  recommendationReason:
                    parsed.recommendedCandidate.recommendationReason.trim() ||
                    '候选名称与当前上下文更匹配。',
                }
              : normalizedCandidates[0];

          return {
            candidates: normalizedCandidates,
            recommendedCandidate,
            auditSnapshot: {
              boundary: 'RECALLED_CANDIDATES_ONLY',
              source: 'ai-rerank',
              inputCandidateCount: params.candidates.length,
              recommendedCandidateId: recommendedCandidate?.id,
              recommendedCandidateName: recommendedCandidate?.name,
            },
          };
        } catch (error) {
          if (!this.shouldFallbackToLegacyCodex(error)) {
            throw error;
          }
        }

        const sdkModule = await this.importCodexSdk();
        const thread = this.startCodexThread(
          sdkModule,
          config,
          'wecom-entity-rerank',
        );

        const result = await Promise.race([
          thread.run(this.buildWecomCandidateRerankPrompt(params), {
            outputSchema: this.buildWecomCandidateRerankSchema(),
          }),
          new Promise<never>((_, reject) => {
            setTimeout(
              () => reject(new Error('企业微信候选重排超时。')),
              this.resolveAiTimeoutMs(
                'WECOM_AI_CANDIDATE_RERANK_TIMEOUT_MS',
                AiGatewayService.DEFAULT_AUXILIARY_INTENT_TIMEOUT_MS,
              ),
            );
          }),
        ]);

        const parsed = JSON.parse(result.finalResponse) as {
          candidates: Array<{
            id: string;
            name: string;
            confidence: 'HIGH' | 'MEDIUM' | 'LOW';
            recommendationReason: string;
          }>;
          recommendedCandidate?: {
            id: string;
            name: string;
            confidence: 'HIGH' | 'MEDIUM' | 'LOW';
            recommendationReason: string;
          };
        };

        const allowedCandidates = new Map(
          params.candidates.map((candidate, index) => [
            candidate.id ?? `candidate_${index + 1}`,
            candidate,
          ]),
        );
        const normalizedCandidates = parsed.candidates
          .filter((item) => allowedCandidates.has(item.id))
          .map((item) => ({
            id: item.id,
            name: item.name,
            confidence: item.confidence,
            recommendationReason:
              item.recommendationReason.trim() || '候选名称与当前上下文更匹配。',
          }));

        if (normalizedCandidates.length === 0) {
          throw new Error('候选重排结果为空。');
        }

        const recommendedCandidate =
          parsed.recommendedCandidate &&
          allowedCandidates.has(parsed.recommendedCandidate.id)
            ? {
                id: parsed.recommendedCandidate.id,
                name: parsed.recommendedCandidate.name,
                confidence: parsed.recommendedCandidate.confidence,
                recommendationReason:
                  parsed.recommendedCandidate.recommendationReason.trim() ||
                  '候选名称与当前上下文更匹配。',
              }
            : normalizedCandidates[0];

        return {
          candidates: normalizedCandidates,
          recommendedCandidate,
          auditSnapshot: {
            boundary: 'RECALLED_CANDIDATES_ONLY',
            source: 'ai-rerank',
            inputCandidateCount: params.candidates.length,
            recommendedCandidateId: recommendedCandidate?.id,
            recommendedCandidateName: recommendedCandidate?.name,
          },
        };
      } finally {
        process.chdir(previousWorkingDirectory);
      }
    });
  }

  private async runCodexGroundedAnalysisInsightPrompt(
    config: CodexClientRuntimeConfig,
    params: {
      title?: string;
      summary?: string;
      scopeSummary?: string;
      keyFindings: string[];
    },
  ): Promise<GroundedAnalysisInsightOutput> {
    const previousQueue = this.codexRunQueue;
    let releaseQueue!: () => void;
    this.codexRunQueue = new Promise<void>((resolve) => {
      releaseQueue = resolve;
    });

    await previousQueue;

    const previousWorkingDirectory = process.cwd();
    const backendWorkingDirectory = this.resolveBackendWorkingDirectory();

    try {
      process.chdir(backendWorkingDirectory);
      try {
        const parsed = (await this.invokeUnifiedStructured(
          config,
          this.buildGroundedAnalysisInsightPrompt(params),
          this.buildGroundedAnalysisInsightSchema(),
          backendWorkingDirectory,
        )) as {
          groundedExplanation: string;
          nextBestQuestions: string[];
        };

        return {
          groundedExplanation:
            parsed.groundedExplanation.replace(/\s+/gu, ' ').trim() ||
            '当前结果已生成，但 AI 洞察内容为空。',
          nextBestQuestions: (parsed.nextBestQuestions ?? [])
            .map((item) => item.replace(/\s+/gu, ' ').trim())
            .filter(Boolean)
            .slice(0, 3),
        };
      } catch (error) {
        if (!this.shouldFallbackToLegacyCodex(error)) {
          throw error;
        }
      }

      const sdkModule = await this.importCodexSdk();
      const codex = new sdkModule.Codex(this.buildCodexClientOptions(config));
      const thread = codex.startThread({
        workingDirectory: this.localRuntimeConfigService.getRepoRoot(),
        skipGitRepoCheck: true,
        sandboxMode: 'read-only',
        networkAccessEnabled: true,
        approvalPolicy: 'never',
        model: config.model,
        modelReasoningEffort: this.mapReasoningEffort(config.reasoningEffort),
        webSearchEnabled: false,
      });

      const result = await Promise.race([
        thread.run(this.buildGroundedAnalysisInsightPrompt(params), {
          outputSchema: this.buildGroundedAnalysisInsightSchema(),
        }),
        new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error('grounded AI 洞察生成超时。')),
            this.resolveAiTimeoutMs(
              'ANALYSIS_AI_GROUNDED_INSIGHT_TIMEOUT_MS',
              AiGatewayService.DEFAULT_GROUNDED_INSIGHT_TIMEOUT_MS,
            ),
          );
        }),
      ]);

      const parsed = JSON.parse(result.finalResponse) as {
        groundedExplanation: string;
        nextBestQuestions: string[];
      };

      return {
        groundedExplanation:
          parsed.groundedExplanation.replace(/\s+/gu, ' ').trim() ||
          '当前结果已生成，但 AI 洞察内容为空。',
        nextBestQuestions: (parsed.nextBestQuestions ?? [])
          .map((item) => item.replace(/\s+/gu, ' ').trim())
          .filter(Boolean)
          .slice(0, 3),
      };
    } finally {
      process.chdir(previousWorkingDirectory);
      releaseQueue();
    }
  }

  private async runCodexAnalysisExecutionModePrompt(
    config: CodexClientRuntimeConfig,
    params: {
      questionText: string;
      channel: 'web-console' | 'wecom-bot';
    },
  ): Promise<SuggestedAnalysisExecutionMode> {
    const previousQueue = this.codexRunQueue;
    let releaseQueue!: () => void;
    this.codexRunQueue = new Promise<void>((resolve) => {
      releaseQueue = resolve;
    });

    await previousQueue;

    const previousWorkingDirectory = process.cwd();
    const backendWorkingDirectory = this.resolveBackendWorkingDirectory();

    try {
      process.chdir(backendWorkingDirectory);
      try {
        const parsed = (await this.invokeUnifiedStructured(
          config,
          this.buildAnalysisExecutionModePrompt(params),
          this.buildAnalysisExecutionModeSchema(),
          backendWorkingDirectory,
        )) as {
          executionMode: SuggestedAnalysisExecutionMode;
          reason: string;
        };

        return parsed.executionMode;
      } catch (error) {
        if (!this.shouldFallbackToLegacyCodex(error)) {
          throw error;
        }
      }

      const sdkModule = await this.importCodexSdk();
      const codex = new sdkModule.Codex(this.buildCodexClientOptions(config));
      const thread = codex.startThread({
        workingDirectory: this.localRuntimeConfigService.getRepoRoot(),
        skipGitRepoCheck: true,
        sandboxMode: 'read-only',
        networkAccessEnabled: true,
        approvalPolicy: 'never',
        model: config.model,
        modelReasoningEffort: this.mapReasoningEffort(config.reasoningEffort),
        webSearchEnabled: false,
      });

      const result = await Promise.race([
        thread.run(this.buildAnalysisExecutionModePrompt(params), {
          outputSchema: this.buildAnalysisExecutionModeSchema(),
        }),
        new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error('分析执行模式建议超时。')),
            this.resolveAiTimeoutMs(
              'ANALYSIS_AI_EXECUTION_MODE_TIMEOUT_MS',
              AiGatewayService.DEFAULT_AUXILIARY_INTENT_TIMEOUT_MS,
            ),
          );
        }),
      ]);

      const parsed = JSON.parse(result.finalResponse) as {
        executionMode: SuggestedAnalysisExecutionMode;
        reason: string;
      };

      return parsed.executionMode;
    } finally {
      process.chdir(previousWorkingDirectory);
      releaseQueue();
    }
  }

  private async runCodexControlledDirectQueryTaskPrompt(
    config: CodexClientRuntimeConfig,
    params: {
      questionText: string;
      channel: 'web-console' | 'wecom-bot';
      domain: AnalysisIntent['domain'];
      metrics: string[];
      dimensions: string[];
      filters: Record<string, unknown>;
      temporalSlot?: TemporalSlot;
      knowledgeContextText?: string;
      expectedTaskTitle: string;
      expectedResultKind: ControlledDirectQueryTaskOutput['resultKind'];
      expectedPurpose: string;
    },
  ): Promise<ControlledDirectQueryTaskOutput> {
    const previousQueue = this.codexRunQueue;
    let releaseQueue!: () => void;
    this.codexRunQueue = new Promise<void>((resolve) => {
      releaseQueue = resolve;
    });

    await previousQueue;

    const previousWorkingDirectory = process.cwd();
    const backendWorkingDirectory = this.resolveBackendWorkingDirectory();

    try {
      process.chdir(backendWorkingDirectory);
      try {
        const parsed = (await this.invokeUnifiedStructured(
          config,
          this.buildControlledDirectQueryTaskPrompt(params),
          this.buildControlledDirectQueryTaskSchema(),
          backendWorkingDirectory,
        )) as ControlledDirectQueryTaskOutput;

        return {
          taskTitle: parsed.taskTitle.replace(/\s+/gu, ' ').trim() || 'AI直查任务',
          resultKind: parsed.resultKind,
          sql: parsed.sql.trim(),
          tables: parsed.tables.map((item) => item.trim()).filter(Boolean),
          fieldEntries: parsed.fieldEntries.map((item) => ({
            table: item.table.trim(),
            fields: item.fields.map((field) => field.trim()).filter(Boolean),
          })),
          joinPaths: parsed.joinPaths.map((item) => item.trim()).filter(Boolean),
          allowedFunctions: parsed.allowedFunctions
            .map((item) => item.trim().toUpperCase())
            .filter(Boolean),
          rowLimit: Math.min(Math.max(parsed.rowLimit, 1), 1000),
          timeoutMs: Math.min(Math.max(parsed.timeoutMs, 500), 5000),
          temporalSlot: this.normalizeDirectQueryTemporalSlot(
            parsed.temporalSlot,
            params.temporalSlot,
          ),
        };
      } catch (error) {
        if (!this.shouldFallbackToLegacyCodex(error)) {
          throw error;
        }
      }

      const sdkModule = await this.importCodexSdk();
      const codex = new sdkModule.Codex(this.buildCodexClientOptions(config));
      const thread = codex.startThread({
        workingDirectory: this.localRuntimeConfigService.getRepoRoot(),
        skipGitRepoCheck: true,
        sandboxMode: 'read-only',
        networkAccessEnabled: true,
        approvalPolicy: 'never',
        model: config.model,
        modelReasoningEffort: this.mapReasoningEffort(config.reasoningEffort),
        webSearchEnabled: false,
      });

      const result = await Promise.race([
        thread.run(this.buildControlledDirectQueryTaskPrompt(params), {
          outputSchema: this.buildControlledDirectQueryTaskSchema(),
        }),
        new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error('受控直查任务生成超时。')),
            this.resolveAiTimeoutMs(
              'ANALYSIS_AI_DIRECT_QUERY_TIMEOUT_MS',
              AiGatewayService.DEFAULT_AUXILIARY_INTENT_TIMEOUT_MS,
            ),
          );
        }),
      ]);

      const parsed = JSON.parse(result.finalResponse) as ControlledDirectQueryTaskOutput;

      return {
        taskTitle: parsed.taskTitle.replace(/\s+/gu, ' ').trim() || 'AI直查任务',
        resultKind: parsed.resultKind,
        sql: parsed.sql.trim(),
        tables: parsed.tables.map((item) => item.trim()).filter(Boolean),
        fieldEntries: parsed.fieldEntries.map((item) => ({
          table: item.table.trim(),
          fields: item.fields.map((field) => field.trim()).filter(Boolean),
        })),
        joinPaths: parsed.joinPaths.map((item) => item.trim()).filter(Boolean),
        allowedFunctions: parsed.allowedFunctions
          .map((item) => item.trim().toUpperCase())
          .filter(Boolean),
        rowLimit: Math.min(Math.max(parsed.rowLimit, 1), 1000),
        timeoutMs: Math.min(Math.max(parsed.timeoutMs, 500), 5000),
        temporalSlot: this.normalizeDirectQueryTemporalSlot(
          parsed.temporalSlot,
          params.temporalSlot,
        ),
      };
    } finally {
      process.chdir(previousWorkingDirectory);
      releaseQueue();
    }
  }

  private async runCodexAnalysisFollowUpIntentPrompt(
    config: CodexClientRuntimeConfig,
    params: {
      questionText: string;
      latestQuestion?: string;
      latestSummary?: string;
      channel: 'web-console' | 'wecom-bot';
    },
  ): Promise<AnalysisFollowUpIntent> {
    const previousQueue = this.codexRunQueue;
    let releaseQueue!: () => void;
    this.codexRunQueue = new Promise<void>((resolve) => {
      releaseQueue = resolve;
    });

    await previousQueue;

    const previousWorkingDirectory = process.cwd();
    const backendWorkingDirectory = this.resolveBackendWorkingDirectory();

    try {
      process.chdir(backendWorkingDirectory);
      try {
        const parsed = (await this.invokeUnifiedStructured(
          config,
          this.buildAnalysisFollowUpIntentPrompt(params),
          this.buildAnalysisFollowUpIntentSchema(),
          backendWorkingDirectory,
        )) as {
          intent: AnalysisFollowUpIntent;
        };

        return parsed.intent;
      } catch (error) {
        if (!this.shouldFallbackToLegacyCodex(error)) {
          throw error;
        }
      }

      const sdkModule = await this.importCodexSdk();
      const codex = new sdkModule.Codex(this.buildCodexClientOptions(config));
      const thread = codex.startThread({
        workingDirectory: this.localRuntimeConfigService.getRepoRoot(),
        skipGitRepoCheck: true,
        sandboxMode: 'read-only',
        networkAccessEnabled: true,
        approvalPolicy: 'never',
        model: config.model,
        modelReasoningEffort: this.mapReasoningEffort(config.reasoningEffort),
        webSearchEnabled: false,
      });

      const result = await Promise.race([
        thread.run(this.buildAnalysisFollowUpIntentPrompt(params), {
          outputSchema: this.buildAnalysisFollowUpIntentSchema(),
        }),
        new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error('分析追问意图分类超时。')),
            this.resolveAiTimeoutMs(
              'ANALYSIS_AI_FOLLOW_UP_INTENT_TIMEOUT_MS',
              AiGatewayService.DEFAULT_AUXILIARY_INTENT_TIMEOUT_MS,
            ),
          );
        }),
      ]);

      const parsed = JSON.parse(result.finalResponse) as {
        intent: AnalysisFollowUpIntent;
      };

      return parsed.intent;
    } finally {
      process.chdir(previousWorkingDirectory);
      releaseQueue();
    }
  }

  private async runCodexDailyReportGroundedInsightPrompt(
    config: CodexClientRuntimeConfig,
    params: {
      scene: 'PERSONAL_CONFIRMATION' | 'TEAM_PREVIEW' | 'SUMMARY_BATCH';
      requesterName: string;
      factSummary: string;
      helpSummary?: string;
      shareSummary?: string;
      planSummary?: string;
      missingSummary?: string;
    },
  ): Promise<DailyReportGroundedInsightOutput> {
    const previousQueue = this.codexRunQueue;
    let releaseQueue!: () => void;
    this.codexRunQueue = new Promise<void>((resolve) => {
      releaseQueue = resolve;
    });

    await previousQueue;

    const previousWorkingDirectory = process.cwd();
    const backendWorkingDirectory = this.resolveBackendWorkingDirectory();

    try {
      process.chdir(backendWorkingDirectory);
      try {
        const parsed = (await this.invokeUnifiedStructured(
          config,
          this.buildDailyReportGroundedInsightPrompt(params),
          this.buildDailyReportGroundedInsightSchema(),
          backendWorkingDirectory,
        )) as {
          summaryLines: string[];
        };

        return {
          summaryLines: (parsed.summaryLines ?? [])
            .map((item) => item.replace(/\s+/gu, ' ').trim())
            .filter(Boolean)
            .slice(0, 4),
        };
      } catch (error) {
        if (!this.shouldFallbackToLegacyCodex(error)) {
          throw error;
        }
      }

      const sdkModule = await this.importCodexSdk();
      const codex = new sdkModule.Codex(this.buildCodexClientOptions(config));
      const thread = codex.startThread({
        workingDirectory: this.localRuntimeConfigService.getRepoRoot(),
        skipGitRepoCheck: true,
        sandboxMode: 'read-only',
        networkAccessEnabled: true,
        approvalPolicy: 'never',
        model: config.model,
        modelReasoningEffort: this.mapReasoningEffort(config.reasoningEffort),
        webSearchEnabled: false,
      });

      const result = await Promise.race([
        thread.run(this.buildDailyReportGroundedInsightPrompt(params), {
          outputSchema: this.buildDailyReportGroundedInsightSchema(),
        }),
        new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error('日报 grounded 摘要生成超时。')),
            this.resolveAiTimeoutMs(
              'DAILY_REPORT_AI_GROUNDED_TIMEOUT_MS',
              AiGatewayService.DEFAULT_GROUNDED_INSIGHT_TIMEOUT_MS,
            ),
          );
        }),
      ]);

      const parsed = JSON.parse(result.finalResponse) as {
        summaryLines: string[];
      };

      return {
        summaryLines: (parsed.summaryLines ?? [])
          .map((item) => item.replace(/\s+/gu, ' ').trim())
          .filter(Boolean)
          .slice(0, 4),
      };
    } finally {
      process.chdir(previousWorkingDirectory);
      releaseQueue();
    }
  }

  private async runCodexWecomTaskReplyIntentPrompt(
    config: {
      apiKey?: string;
      baseUrl?: string;
      model?: string;
      reasoningEffort?: string;
    },
    params: {
      messageText: string;
      activeTaskLabel: string;
    },
  ): Promise<WecomTaskReplyIntentOutput> {
    return await this.runInCodexQueueLane('wecom-semantic-reply', async () => {
      const previousWorkingDirectory = process.cwd();
      const backendWorkingDirectory = this.resolveBackendWorkingDirectory();

      try {
        process.chdir(backendWorkingDirectory);
        try {
          return (await this.invokeUnifiedStructured(
            config,
            this.buildWecomTaskReplyIntentPrompt(params),
            this.buildWecomTaskReplyIntentSchema(),
            backendWorkingDirectory,
          )) as WecomTaskReplyIntentOutput;
        } catch (error) {
          if (!this.shouldFallbackToLegacyCodex(error)) {
            throw error;
          }
        }

        const sdkModule = await this.importCodexSdk();
        const thread = this.startCodexThread(
          sdkModule,
          config,
          'wecom-semantic-reply',
        );

        const result = await Promise.race([
          thread.run(this.buildWecomTaskReplyIntentPrompt(params), {
            outputSchema: this.buildWecomTaskReplyIntentSchema(),
          }),
          new Promise<never>((_, reject) => {
            setTimeout(
              () => reject(new Error('企业微信任务回复意图分类超时。')),
              this.resolveAiTimeoutMs(
                'WECOM_AI_TASK_REPLY_TIMEOUT_MS',
                AiGatewayService.DEFAULT_WECOM_TASK_REPLY_TIMEOUT_MS,
              ),
            );
          }),
        ]);

        const parsed = JSON.parse(result.finalResponse) as WecomTaskReplyIntentOutput;
        return parsed;
      } finally {
        process.chdir(previousWorkingDirectory);
      }
    });
  }

  private async runCodexWecomIdleConversationIntentPrompt(
    config: {
      apiKey?: string;
      baseUrl?: string;
      model?: string;
      reasoningEffort?: string;
    },
    params: {
      messageText: string;
      latestQuestion?: string;
      latestSummary?: string;
      hasPendingSlots: boolean;
    },
  ): Promise<WecomIdleConversationIntentOutput> {
    return await this.runInCodexQueueLane('wecom-semantic-reply', async () => {
      const previousWorkingDirectory = process.cwd();
      const backendWorkingDirectory = this.resolveBackendWorkingDirectory();

      try {
        process.chdir(backendWorkingDirectory);
        try {
          return (await this.invokeUnifiedStructured(
            config,
            this.buildWecomIdleConversationIntentPrompt(params),
            this.buildWecomIdleConversationIntentSchema(),
            backendWorkingDirectory,
          )) as WecomIdleConversationIntentOutput;
        } catch (error) {
          if (!this.shouldFallbackToLegacyCodex(error)) {
            throw error;
          }
        }

        const sdkModule = await this.importCodexSdk();
        const thread = this.startCodexThread(
          sdkModule,
          config,
          'wecom-semantic-reply',
        );

        const result = await Promise.race([
          thread.run(this.buildWecomIdleConversationIntentPrompt(params), {
            outputSchema: this.buildWecomIdleConversationIntentSchema(),
          }),
          new Promise<never>((_, reject) => {
            setTimeout(
              () => reject(new Error('企业微信空闲态意图分类超时。')),
              this.resolveWecomIdleIntentTimeoutMs(params.messageText),
            );
          }),
        ]);

        const parsed = JSON.parse(
          result.finalResponse,
        ) as WecomIdleConversationIntentOutput;
        return parsed;
      } finally {
        process.chdir(previousWorkingDirectory);
      }
    });
  }

  /**
   * 解析 AI 调用超时配置。
   *
   * 设计原因：
   * 1. 企业微信确认类回复和四段草稿比普通问数更容易受网关波动影响；
   * 2. 用环境变量调节超时，便于按环境灰度，而不需要反复改代码；
   * 3. 非法配置时回退默认值，避免因为配置错误把调用直接打挂。
   */
  private resolveAiTimeoutMs(envKey: string, fallbackMs: number): number {
    const configuredValue = Number(process.env[envKey] ?? '');
    if (!Number.isFinite(configuredValue) || configuredValue <= 0) {
      return fallbackMs;
    }

    return configuredValue;
  }

  /**
   * 企业微信帮助短句无需长期占用 idle semantic lane。
   *
   * 这里仍然保持“先过 AI 再兜底”的原则，只是对明显帮助短句收紧超时预算，
   * 避免用户在“你好 / help / 你能做什么”这类消息上等待 10 秒以上。
   */
  private resolveWecomIdleIntentTimeoutMs(messageText: string): number {
    const defaultTimeout = this.resolveAiTimeoutMs(
      'WECOM_AI_IDLE_INTENT_TIMEOUT_MS',
      AiGatewayService.DEFAULT_WECOM_IDLE_INTENT_TIMEOUT_MS,
    );
    if (!detectWecomHelpIntent(messageText)) {
      return defaultTimeout;
    }

    const helpTimeout = this.resolveAiTimeoutMs(
      'WECOM_AI_IDLE_HELP_INTENT_TIMEOUT_MS',
      AiGatewayService.DEFAULT_WECOM_IDLE_HELP_INTENT_TIMEOUT_MS,
    );
    return Math.min(defaultTimeout, helpTimeout);
  }

  /**
   * 将不同 AI 能力归到各自的执行 lane。
   *
   * 这里保留显式方法而不是直接传字符串，便于测试和后续继续扩展更多 lane。
   */
  private resolveCodexQueueLane(lane: CodexQueueLane): CodexQueueLane {
    return lane;
  }

  /**
   * 企业微信短回复和轻量结构化抽取不需要使用默认的中高推理档位。
   *
   * 对这类短文本任务，优先保证时延和稳定性，避免因为档位过重导致频繁超时。
   */
  private resolveLaneReasoningEffort(
    lane: CodexQueueLane,
    configured?: string,
  ): 'none' | 'low' | 'medium' | 'high' | 'xhigh' | undefined {
    if (lane === 'default' || lane === 'wecom-semantic-reply') {
      return 'low';
    }

    if (
      lane === 'wecom-structured-draft' ||
      lane === 'wecom-entity-rerank'
    ) {
      const mappedConfigured = this.mapReasoningEffort(configured);
      if (
        mappedConfigured === 'none' ||
        mappedConfigured === 'low' ||
        mappedConfigured === 'medium'
      ) {
        return mappedConfigured === 'medium' ? 'low' : mappedConfigured;
      }

      return 'low';
    }

    return this.mapReasoningEffort(configured);
  }

  private async runInCodexQueueLane<T>(
    lane: CodexQueueLane,
    executor: () => Promise<T>,
  ): Promise<T> {
    const queueLane = this.resolveCodexQueueLane(lane);
    const queuedAt = Date.now();
    const previousQueue = this.codexRunQueues[queueLane];
    let releaseQueue!: () => void;
    this.codexRunQueues[queueLane] = new Promise<void>((resolve) => {
      releaseQueue = resolve;
    });

    await previousQueue;
    const queueWaitMs = Date.now() - queuedAt;
    const startedAt = Date.now();

    try {
      const result = await executor();
      const elapsedMs = Date.now() - startedAt;
      if (queueWaitMs >= 200 || elapsedMs >= 3000) {
        this.analysisLoggerService.logStep('Codex lane 执行完成', {
          lane: queueLane,
          queueWaitMs,
          elapsedMs,
        });
      }
      return result;
    } finally {
      releaseQueue();
    }
  }

  private startCodexThread(
    sdkModule: RemovedCodexSdkModule,
    config: CodexClientRuntimeConfig,
    lane: CodexQueueLane,
  ) {
    const codex = new sdkModule.Codex(this.buildCodexClientOptions(config));

    return codex.startThread({
      workingDirectory: this.localRuntimeConfigService.getRepoRoot(),
      skipGitRepoCheck: true,
      sandboxMode: 'read-only',
      networkAccessEnabled: true,
      approvalPolicy: 'never',
      model: config.model,
      modelReasoningEffort: this.resolveLaneReasoningEffort(
        lane,
        config.reasoningEffort,
      ),
      webSearchEnabled: false,
    });
  }

  private async runCodexFreeformPrompt(
    config: CodexClientRuntimeConfig,
    prompt: string,
  ): Promise<string> {
    const previousQueue = this.codexRunQueue;
    let releaseQueue!: () => void;
    this.codexRunQueue = new Promise<void>((resolve) => {
      releaseQueue = resolve;
    });

    await previousQueue;

    const previousWorkingDirectory = process.cwd();
    const backendWorkingDirectory = this.resolveBackendWorkingDirectory();

    try {
      process.chdir(backendWorkingDirectory);
      const result = await Promise.race([
        this.invokeUnifiedText(config, prompt, backendWorkingDirectory),
        new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error('企业微信解释回复生成超时。')),
            this.resolveAiTimeoutMs(
              'WECOM_AI_FREEFORM_REPLY_TIMEOUT_MS',
              AiGatewayService.DEFAULT_FREEFORM_REPLY_TIMEOUT_MS,
            ),
          );
        }),
      ]);

      return result;
    } finally {
      process.chdir(previousWorkingDirectory);
      releaseQueue();
    }
  }

  private normalizeStructuredDraftField(value?: string): string | undefined {
    const normalizedValue = value?.replace(/\s+/gu, ' ').trim();
    return normalizedValue ? normalizedValue : undefined;
  }

  /**
   * 统一构造 Codex SDK 客户端配置。
   *
   * 设计原因：
   * 1. 自建 AI provider 不只需要 `apiKey/baseUrl`，还依赖 `model_provider`、`wire_api` 等 CLI 配置；
   * 2. 合同审核链路已经验证过这些配置透传是必需的，分析问数与企业微信理解必须保持一致；
   * 3. 代理、禁用响应落盘和自定义 codex 可执行路径都属于运行时行为，不能在不同能力里各自遗漏。
   */
  private buildCodexClientOptions(
    config: CodexClientRuntimeConfig,
  ): Record<string, unknown> {
    const configOverrides = this.buildCodexConfigOverrides(config);
    return {
      ...(config.apiKey ? { apiKey: config.apiKey } : {}),
      ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
      ...(Object.keys(configOverrides).length > 0 ? { config: configOverrides } : {}),
      ...(config.proxyEnv ? { env: config.proxyEnv } : {}),
    };
  }

  /**
   * 将本地运行时配置转换成 Codex CLI 可识别的 `--config` 覆盖项。
   */
  private buildCodexConfigOverrides(
    config: Pick<
      CodexClientRuntimeConfig,
      | 'baseUrl'
      | 'serviceTier'
      | 'modelProvider'
      | 'wireApi'
      | 'requiresOpenaiAuth'
      | 'disableResponseStorage'
    >,
  ): Record<string, unknown> {
    const overrides: Record<string, unknown> = {};

    if (typeof config.disableResponseStorage === 'boolean') {
      overrides.disable_response_storage = config.disableResponseStorage;
    }

    if (config.serviceTier?.trim()) {
      overrides.service_tier = config.serviceTier.trim();
    }

    if (!config.modelProvider) {
      return overrides;
    }

    overrides.model_provider = config.modelProvider;
    overrides.model_providers = {
      [config.modelProvider]: {
        name: config.modelProvider,
        ...(config.baseUrl ? { base_url: config.baseUrl } : {}),
        ...(config.wireApi ? { wire_api: config.wireApi } : {}),
        ...(typeof config.requiresOpenaiAuth === 'boolean'
          ? { requires_openai_auth: config.requiresOpenaiAuth }
          : {}),
      },
    };

    return overrides;
  }

  private resolveCodexPathOverride(codexPath?: string): string | undefined {
    return codexPath?.trim() ? undefined : undefined;
  }

  /**
   * 归一化受控直查任务回写的时间槽。
   *
   * 参数说明：
   * - `candidate`：AI 直查任务输出中的时间槽副本。
   * - `fallback`：入口理解阶段已经通过的标准时间槽。
   * 返回值：优先使用结构完整的 AI 回写槽，否则复用入口时间槽。
   */
  private normalizeDirectQueryTemporalSlot(
    candidate: TemporalSlot | undefined,
    fallback: TemporalSlot | undefined,
  ): TemporalSlot | undefined {
    if (!candidate) {
      return fallback;
    }

    const rawText = typeof candidate.rawText === 'string' ? candidate.rawText.trim() : '';
    const normalizedLabel =
      typeof candidate.normalizedLabel === 'string'
        ? candidate.normalizedLabel.trim()
        : rawText;
    if (!rawText || !normalizedLabel) {
      return fallback;
    }

    return {
      rawText,
      normalizedLabel,
      startAt: typeof candidate.startAt === 'string' ? candidate.startAt.trim() : undefined,
      endAt: typeof candidate.endAt === 'string' ? candidate.endAt.trim() : undefined,
      timezone: 'Asia/Shanghai',
      granularity: this.normalizeTemporalGranularity(candidate.granularity),
      relativity:
        candidate.relativity === 'absolute' ||
        candidate.relativity === 'relative' ||
        candidate.relativity === 'mixed'
          ? candidate.relativity
          : fallback?.relativity ?? 'mixed',
      inclusivity: {
        start: 'inclusive',
        end: candidate.inclusivity?.end === 'inclusive' ? 'inclusive' : 'exclusive',
      },
      confidence:
        candidate.confidence === 'HIGH' ||
        candidate.confidence === 'MEDIUM' ||
        candidate.confidence === 'LOW'
          ? candidate.confidence
          : fallback?.confidence ?? 'MEDIUM',
      unresolvedReason:
        typeof candidate.unresolvedReason === 'string'
          ? candidate.unresolvedReason.trim()
          : undefined,
    };
  }

  /**
   * 归一化时间粒度枚举。
   *
   * 参数说明：`value` 是 AI 输出或测试辅助中的粒度值。
   * 返回值：合法粒度，非法时回退为 `custom`。
   */
  private normalizeTemporalGranularity(value: unknown): TemporalGranularity {
    if (
      value === 'day' ||
      value === 'week' ||
      value === 'month' ||
      value === 'quarter' ||
      value === 'year' ||
      value === 'custom'
    ) {
      return value;
    }

    return 'custom';
  }

  /**
   * 为自动化测试提供确定性的统一 AI 问数桩结果。
   *
   * 该桩只在 `NODE_ENV=test` 时启用，用于验证“先消费 AI 结果，再进入固定程序”的主链，
   * 不代表运行时会回退为本地规则主链。
   */
  /**
   * 为测试环境构造标准时间槽。
   *
   * 参数说明：
   * - `questionText`：测试用自然语言问题。
   * 返回值：覆盖常见时间问法的确定性时间槽；无法识别时返回 `undefined`。
   * 调用注意：该方法只在 `NODE_ENV=test` 的 AI 桩中使用，不作为运行时自由问数主理解链路。
   */
  private buildTestTemporalSlot(questionText: string): TemporalSlot | undefined {
    const latestQuestionText = this.resolveLatestAnalysisInstruction(questionText);
    const explicitQuarter = this.matchExplicitQuarter(latestQuestionText);
    if (explicitQuarter) {
      return explicitQuarter;
    }

    if (latestQuestionText.includes('上季度')) {
      const localNow = this.getShanghaiLocalNow();
      const currentQuarterStartMonth = Math.floor(localNow.getUTCMonth() / 3) * 3;
      return this.buildQuarterTemporalSlot('上季度', localNow.getUTCFullYear(), currentQuarterStartMonth - 3);
    }

    if (latestQuestionText.includes('本季度')) {
      const localNow = this.getShanghaiLocalNow();
      const currentQuarterStartMonth = Math.floor(localNow.getUTCMonth() / 3) * 3;
      return this.buildQuarterTemporalSlot('本季度', localNow.getUTCFullYear(), currentQuarterStartMonth);
    }

    if (latestQuestionText.includes('去年同期')) {
      const localNow = this.getShanghaiLocalNow();
      return this.buildMonthTemporalSlot(
        '去年同期',
        localNow.getUTCFullYear(),
        localNow.getUTCMonth() - 12,
        1,
      );
    }

    if (latestQuestionText.includes('本财年')) {
      const localNow = this.getShanghaiLocalNow();
      return this.buildYearTemporalSlot('本财年', localNow.getUTCFullYear());
    }

    const monthRangeMatch = latestQuestionText.match(
      /(最近|近|前|过去)\s*(?<count>十二|十一|十|九|八|七|六|五|四|三|两|二|一|\d{1,2})\s*个?\s*月/u,
    );
    if (monthRangeMatch?.groups?.count) {
      const rawText = monthRangeMatch[0].replace(/\s+/gu, ' ').trim();
      const monthCount = this.parseTestMonthCount(monthRangeMatch.groups.count);
      if (monthCount && monthCount >= 1 && monthCount <= 24) {
        const localNow = this.getShanghaiLocalNow();
        return this.buildMonthTemporalSlot(
          rawText,
          localNow.getUTCFullYear(),
          localNow.getUTCMonth() - (monthCount - 1),
          monthCount,
        );
      }
    }

    const explicitMonth = this.matchExplicitMonth(latestQuestionText);
    if (explicitMonth) {
      return explicitMonth;
    }

    if (latestQuestionText.includes('本月') || latestQuestionText.includes('当月')) {
      const localNow = this.getShanghaiLocalNow();
      const rawText = latestQuestionText.includes('当月') ? '当月' : '本月';
      return this.buildMonthTemporalSlot(rawText, localNow.getUTCFullYear(), localNow.getUTCMonth(), 1);
    }

    if (
      latestQuestionText.includes('最近一年') ||
      latestQuestionText.includes('近一年') ||
      latestQuestionText.includes('过去一年')
    ) {
      const localNow = this.getShanghaiLocalNow();
      const rawText = latestQuestionText.includes('最近一年')
        ? '最近一年'
        : latestQuestionText.includes('近一年')
        ? '近一年'
        : latestQuestionText.includes('过去一年')
          ? '过去一年'
          : '最近一年';
      return this.buildMonthTemporalSlot(
        rawText,
        localNow.getUTCFullYear(),
        localNow.getUTCMonth() - 11,
        12,
      );
    }

    if (latestQuestionText.includes('最近30天')) {
      const startAt = this.buildShanghaiDayBoundaryIso(-29);
      const endAt = this.buildShanghaiDayBoundaryIso(1);
      return this.createTestTemporalSlot('最近30天', startAt, endAt, 'day');
    }

    if (
      latestQuestionText.includes('今日') ||
      latestQuestionText.includes('今天') ||
      latestQuestionText.includes('本日') ||
      latestQuestionText.includes('当天')
    ) {
      const rawText = latestQuestionText.includes('今天') ? '今天' : '今日';
      return this.createTestTemporalSlot(
        rawText,
        this.buildShanghaiDayBoundaryIso(0),
        this.buildShanghaiDayBoundaryIso(1),
        'day',
      );
    }

    if (latestQuestionText.includes('明日') || latestQuestionText.includes('明天')) {
      const rawText = latestQuestionText.includes('明天') ? '明天' : '明日';
      return this.createTestTemporalSlot(
        rawText,
        this.buildShanghaiDayBoundaryIso(1),
        this.buildShanghaiDayBoundaryIso(2),
        'day',
      );
    }

    if (latestQuestionText.includes('后天')) {
      return this.createTestTemporalSlot(
        '后天',
        this.buildShanghaiDayBoundaryIso(2),
        this.buildShanghaiDayBoundaryIso(3),
        'day',
      );
    }

    return undefined;
  }

  /**
   * 合并追问后优先解析最新追问片段，避免上一轮“本月”覆盖本轮“近三个月 / 一月份”。
   */
  private resolveLatestAnalysisInstruction(questionText: string): string {
    const marker = '继续分析：';
    const markerIndex = questionText.lastIndexOf(marker);
    if (markerIndex < 0) {
      return questionText;
    }

    return questionText.slice(markerIndex + marker.length).trim() || questionText;
  }

  /**
   * 匹配“2026 年一季度”这类绝对季度表达。
   *
   * 参数说明：`questionText` 为测试问题文本。
   * 返回值：匹配成功时返回绝对季度时间槽，否则返回 `undefined`。
   */
  private matchExplicitQuarter(questionText: string): TemporalSlot | undefined {
    const match = questionText.match(
      /(?<year>\d{4})\s*年\s*(?<quarter>一|二|三|四|1|2|3|4)\s*季度/u,
    );
    if (!match?.groups?.year || !match.groups.quarter) {
      return undefined;
    }

    const year = Number(match.groups.year);
    const quarterIndex = this.parseTestQuarterIndex(match.groups.quarter);
    if (!Number.isFinite(year) || quarterIndex < 0) {
      return undefined;
    }

    return this.buildQuarterTemporalSlot(match[0].replace(/\s+/gu, ' ').trim(), year, quarterIndex * 3);
  }

  /**
   * 匹配“一月份 / 2026 年 1 月”这类绝对月份表达。
   *
   * 参数说明：`questionText` 为测试问题文本。
   * 返回值：匹配成功时返回当前年或显式年份的自然月时间槽。
   */
  private matchExplicitMonth(questionText: string): TemporalSlot | undefined {
    const match = questionText.match(
      /(?:(?<year>\d{4})\s*年\s*)?(?<month>十二|十一|十|九|八|七|六|五|四|三|二|一|1[0-2]|0?[1-9])\s*月份?/u,
    );
    if (!match?.groups?.month) {
      return undefined;
    }

    const localNow = this.getShanghaiLocalNow();
    const year = match.groups.year ? Number(match.groups.year) : localNow.getUTCFullYear();
    const parsedMonth = this.parseTestMonthCount(match.groups.month);
    if (!parsedMonth) {
      return undefined;
    }

    const monthIndex = parsedMonth - 1;
    if (!Number.isFinite(year) || monthIndex < 0 || monthIndex > 11) {
      return undefined;
    }

    return this.buildMonthTemporalSlot(match[0].replace(/\s+/gu, ' ').trim(), year, monthIndex, 1);
  }

  /**
   * 测试桩中区分查询条件改写和真实 CRM 写入。
   *
   * 设计原因：自动化测试环境不调用真实 AI，也必须覆盖“改成一月份”这类只读追问语义。
   */
  private isTestReadOnlyQueryRewrite(questionText: string): boolean {
    const hasRewriteVerb = /(改成|改为|调整为|调整成|换成|切到|改到|改看|只看|限定为|范围改)/u.test(questionText);
    const hasReadOnlyTarget =
      /(时间|日期|月份|月|季度|年度|年份|范围|条件|维度|口径|分组|区域|团队|部门|负责人|趋势|排行|排名|一月份|二月份|三月份|四月份|五月份|六月份|七月份|八月份|九月份|十月份|十一月份|十二月份|\d{1,2}\s*月|本月|上月|近.+月|最近.+月)/u.test(
        questionText,
      );
    const hasWriteTarget =
      /(已成交|成交状态|阶段改|状态改|写入|保存|提交|创建|新建|新增客户|新增商机(?!金额)|新建商机|创建商机|删除|更新状态|录入|同步到\s*CRM)/u.test(
        questionText,
      );

    return hasRewriteVerb && hasReadOnlyTarget && !hasWriteTarget;
  }

  /**
   * 测试桩中识别客户生命周期只读问题。
   *
   * 参数说明：`questionText` 为规范化问题。
   * 返回值说明：命中未报备、未建商机、创建时长等客户统计语义时返回 `true`。
   * 调用注意事项：只用于测试/降级桩避免宽阻断误伤，生产语义仍优先走能力包和模型。
   */
  private isTestReadOnlyCustomerLifecycleQuestion(questionText: string): boolean {
    return /(客户).*((没有|未|无).{0,8}(报备|商机|报价|下单|订单)|未报备商机|未建商机|无商机|创建.{0,10}(多久|多长时间|时长|天数)|生命周期|沉睡)/u.test(
      questionText,
    );
  }

  /**
   * 构造按月粒度时间槽。
   *
   * 参数说明：`label` 为用户表达，`year/monthIndex` 为起始自然月，`monthCount` 为覆盖月数。
   * 返回值：闭开区间的月粒度时间槽。
   */
  private buildMonthTemporalSlot(
    label: string,
    year: number,
    monthIndex: number,
    monthCount: number,
  ): TemporalSlot {
    return this.createTestTemporalSlot(
      label,
      this.buildShanghaiMonthBoundaryIso(year, monthIndex),
      this.buildShanghaiMonthBoundaryIso(year, monthIndex + monthCount),
      'month',
    );
  }

  /**
   * 构造自然季度时间槽。
   *
   * 参数说明：`label` 为用户表达，`year/monthIndex` 为季度起始月。
   * 返回值：闭开区间的季度粒度时间槽。
   */
  private buildQuarterTemporalSlot(
    label: string,
    year: number,
    monthIndex: number,
  ): TemporalSlot {
    return this.createTestTemporalSlot(
      label,
      this.buildShanghaiMonthBoundaryIso(year, monthIndex),
      this.buildShanghaiMonthBoundaryIso(year, monthIndex + 3),
      'quarter',
    );
  }

  /**
   * 构造自然财年时间槽。
   *
   * 参数说明：`label` 为用户表达，`year` 为财年起始年份。
   * 返回值：闭开区间的年粒度时间槽。
   */
  private buildYearTemporalSlot(label: string, year: number): TemporalSlot {
    return this.createTestTemporalSlot(
      label,
      this.buildShanghaiMonthBoundaryIso(year, 0),
      this.buildShanghaiMonthBoundaryIso(year + 1, 0),
      'year',
    );
  }

  /**
   * 统一构造测试时间槽对象。
   *
   * 参数说明：`label/startAt/endAt/granularity` 分别表示原文、边界和粒度。
   * 返回值：高置信、上海时区、左闭右开时间槽。
   */
  private createTestTemporalSlot(
    label: string,
    startAt: string,
    endAt: string,
    granularity: TemporalGranularity,
  ): TemporalSlot {
    return {
      rawText: label,
      normalizedLabel: label,
      startAt,
      endAt,
      timezone: 'Asia/Shanghai',
      granularity,
      relativity: /^\d{4}/u.test(label) ? 'absolute' : 'relative',
      inclusivity: {
        start: 'inclusive',
        end: 'exclusive',
      },
      confidence: 'HIGH',
    };
  }

  /**
   * 获取上海时区下的当前日期对象。
   *
   * 参数说明：无。
   * 返回值：把当前 UTC 时间平移到上海本地时刻后的 `Date`，便于用 UTC getter 读取本地年月日。
   */
  private getShanghaiLocalNow(): Date {
    if (process.env.NODE_ENV === 'test') {
      return new Date(
        Date.parse(process.env.ANALYSIS_TEST_NOW ?? '2026-03-23T10:00:00.000Z') +
          8 * 60 * 60 * 1000,
      );
    }

    return new Date(Date.now() + 8 * 60 * 60 * 1000);
  }

  /**
   * 构造上海本地自然月边界的 ISO 字符串。
   *
   * 参数说明：`year/monthIndex` 使用 JavaScript 月索引，允许越界自动进退年份。
   * 返回值：对应上海本地 00:00 的 UTC ISO 时间。
   */
  private buildShanghaiMonthBoundaryIso(year: number, monthIndex: number): string {
    return new Date(Date.UTC(year, monthIndex, 1, -8, 0, 0, 0)).toISOString();
  }

  /**
   * 构造上海本地自然日边界的 ISO 字符串。
   *
   * 参数说明：`offsetDays` 为相对当前本地日期的偏移天数。
   * 返回值：对应上海本地 00:00 的 UTC ISO 时间。
   */
  private buildShanghaiDayBoundaryIso(offsetDays: number): string {
    const localNow = this.getShanghaiLocalNow();
    return new Date(
      Date.UTC(
        localNow.getUTCFullYear(),
        localNow.getUTCMonth(),
        localNow.getUTCDate() + offsetDays,
        -8,
        0,
        0,
        0,
      ),
    ).toISOString();
  }

  /**
   * 解析测试用中文或阿拉伯数字月份数量。
   *
   * 参数说明：`value` 是捕获到的月份数量文本。
   * 返回值：可用月份数；无法解析时返回 `undefined`。
   */
  private parseTestMonthCount(value: string): number | undefined {
    const numberValue = Number(value);
    if (Number.isInteger(numberValue)) {
      return numberValue;
    }

    const map: Record<string, number> = {
      一: 1,
      二: 2,
      两: 2,
      三: 3,
      四: 4,
      五: 5,
      六: 6,
      七: 7,
      八: 8,
      九: 9,
      十: 10,
      十一: 11,
      十二: 12,
    };
    return map[value];
  }

  /**
   * 解析中文季度序号。
   *
   * 参数说明：`value` 是季度文本。
   * 返回值：从 0 开始的季度索引；非法时返回 -1。
   */
  private parseTestQuarterIndex(value: string): number {
    const map: Record<string, number> = {
      一: 0,
      '1': 0,
      二: 1,
      '2': 1,
      三: 2,
      '3': 2,
      四: 3,
      '4': 3,
    };
    return map[value] ?? -1;
  }

  /**
   * 为测试环境提供确定性的宽业务意图桩。
   *
   * 参数说明：`questionText` 为用户问题。
   * 返回值说明：明确 CRM 分析问题返回宽意图；非 CRM 或模糊文本返回 `null`。
   * 调用注意事项：该桩只覆盖核心回归语义，生产环境仍由能力包和模型解析。
   */
  private buildTestBusinessAnalysisIntent(
    questionText: string,
  ): BusinessAnalysisIntent | null {
    const normalizedQuestion = this.summarizeQuestion(questionText);
    if (
      /(新增客户|创建|修改|删除|提醒|写入|更新状态|改成)/u.test(normalizedQuestion) &&
      !this.isTestReadOnlyQueryRewrite(normalizedQuestion) &&
      !this.isTestReadOnlyCustomerLifecycleQuestion(normalizedQuestion)
    ) {
      return this.createTestBlockedBusinessIntent(
        normalizedQuestion,
        '当前一期仅支持受控问数，不支持写入、修改、删除或提醒创建类请求。',
      );
    }

    if (/(天气|气温|股票|基金|新闻|汇率|电影|翻译|代码|编程)/u.test(normalizedQuestion)) {
      return this.createTestBlockedBusinessIntent(
        normalizedQuestion,
        '当前仅支持 CRM 智能分析相关问题。',
      );
    }

    if (
      !/(商机|机会|客户|合同|签单|订单|下单|报价|报备|渠道|代理商|伙伴|服务商|经营|看板)/u.test(
        normalizedQuestion,
      )
    ) {
      return null;
    }

    const temporalSlot = this.buildTestTemporalSlot(normalizedQuestion);
    const objectTypes = this.detectTestBusinessObjectTypes(normalizedQuestion);
    const metrics = this.detectTestBusinessMetrics(normalizedQuestion, objectTypes);
    const dimensions = this.detectTestBusinessDimensions(normalizedQuestion);
    const analysisMode = this.detectTestBusinessAnalysisMode(normalizedQuestion);
    const outputPreference = resolveAnalysisOutputPreference(
      normalizedQuestion,
      analysisMode === 'summary_report' || analysisMode === 'dashboard'
        ? ['text_summary', 'table', 'chart']
        : ['text_summary', 'table'],
    );
    const hasAmbiguousTemporalReference = /(那段时间|那个时间|这段时间|某段时间|从那时|从那会儿)/u.test(
      normalizedQuestion,
    );

    return {
      objectTypes,
      metrics,
      dimensions,
      filters: this.detectTestBusinessFilters(normalizedQuestion, dimensions),
      ...(temporalSlot ? { timeRange: temporalSlot } : {}),
      analysisMode,
      outputPreference,
      comparison: this.detectTestBusinessComparison(normalizedQuestion),
      entities: this.detectTestBusinessEntities(normalizedQuestion),
      confidence: hasAmbiguousTemporalReference ? 'LOW' : temporalSlot ? 'HIGH' : 'MEDIUM',
      missingConditions: hasAmbiguousTemporalReference ? ['时间范围'] : [],
      unsupportedHints: [],
      requestedAction: 'READONLY_ANALYSIS',
      blockReason: '',
      normalizedQuestion,
    };
  }

  /**
   * 创建测试用阻断宽意图。
   *
   * 参数说明：`questionText` 为规范化问题，`blockReason` 为阻断原因。
   * 返回值说明：返回 `BLOCK` 宽意图。
   * 调用注意事项：仅供测试桩复用。
   */
  private createTestBlockedBusinessIntent(
    questionText: string,
    blockReason: string,
  ): BusinessAnalysisIntent {
    return {
      objectTypes: [],
      metrics: [],
      dimensions: [],
      filters: [],
      analysisMode: 'single_metric',
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

  /**
   * 测试桩识别业务对象。
   *
   * 参数说明：`questionText` 为规范化问题。
   * 返回值说明：返回宽意图对象数组。
   * 调用注意事项：多对象时保留服务商对象，方便映射成渠道贡献。
   */
  private detectTestBusinessObjectTypes(questionText: string): BusinessAnalysisIntent['objectTypes'] {
    const objectTypes = new Set<BusinessAnalysisIntent['objectTypes'][number]>();
    if (/(订单|下单|成单)/u.test(questionText)) {
      objectTypes.add('order');
    }
    if (/(报价|报价单)/u.test(questionText)) {
      objectTypes.add('quote');
    }
    if (/(报备|客户报备)/u.test(questionText)) {
      objectTypes.add('registration');
    }
    if (/(商机|机会)/u.test(questionText)) {
      objectTypes.add('opportunity');
    }
    if (/(服务商|渠道商|渠道|代理商|经销商|合作渠道|伙伴)/u.test(questionText)) {
      objectTypes.add('partner');
    }
    if (/(客户|客资|客群)/u.test(questionText)) {
      objectTypes.add('customer');
    }
    if (/(合同|签单|签约|成交|回款)/u.test(questionText) && !objectTypes.has('order')) {
      objectTypes.add('contract');
    }
    return objectTypes.size > 0 ? [...objectTypes] : ['opportunity'];
  }

  /**
   * 测试桩识别业务指标。
   *
   * 参数说明：`questionText` 为规范化问题，`objectTypes` 为已识别对象。
   * 返回值说明：返回宽意图指标数组。
   * 调用注意事项：金额和数量可以同时存在，后续执行层分别生成金额与 count。
   */
  private detectTestBusinessMetrics(
    questionText: string,
    objectTypes: BusinessAnalysisIntent['objectTypes'],
  ): BusinessAnalysisIntent['metrics'] {
    const metrics = new Set<BusinessAnalysisIntent['metrics'][number]>();
    if (/(数量|多少|多少家|多少个|单数|数\b)/u.test(questionText)) {
      metrics.add('count');
    }
    if (/(金额|总金额|总额|贡献|集中度)/u.test(questionText)) {
      metrics.add('amount');
      if (questionText.includes('总')) {
        metrics.add('total_amount');
      }
    }
    if (objectTypes.includes('order')) {
      if (/(数量|单数|多少)/u.test(questionText)) {
        metrics.add('order_count');
      }
      if (/(金额|总额|总金额)/u.test(questionText)) {
        metrics.add('order_amount');
      }
    }
    if (objectTypes.includes('opportunity')) {
      metrics.add(/(数量|商机数|机会数)/u.test(questionText) ? 'opportunity_count' : 'opportunity_amount');
    }
    if (objectTypes.includes('partner') && !objectTypes.includes('order') && !objectTypes.includes('opportunity')) {
      metrics.add('partner_count');
    }
    if (/(技术服务商|是否技术服务商)/u.test(questionText)) {
      metrics.add('technical_partner_count');
    }
    return metrics.size > 0 ? [...metrics] : ['amount'];
  }

  /**
   * 测试桩识别业务维度。
   *
   * 参数说明：`questionText` 为规范化问题。
   * 返回值说明：返回宽意图维度数组。
   * 调用注意事项：只识别常见业务维度，复杂语义由生产 AI 处理。
   */
  private detectTestBusinessDimensions(questionText: string): BusinessAnalysisIntent['dimensions'] {
    const dimensions = new Set<BusinessAnalysisIntent['dimensions'][number]>();
    if (/(区域|大区|山东|广州|华东|华北|大北|大东|大南|大西|办事处|办)/u.test(questionText)) {
      dimensions.add('region');
    }
    if (/(服务商|渠道商|渠道|代理商|经销商|合作渠道|伙伴)/u.test(questionText)) {
      dimensions.add('partner');
    }
    if (/(负责人|销售|业务员)/u.test(questionText)) {
      dimensions.add('owner');
    }
    if (/(季度|按季|一季度|二季度|三季度|四季度|Q[1-4])/iu.test(questionText)) {
      dimensions.add('quarter');
    }
    if (/(月份|月度|按月|逐月|趋势|最近三个月|近三个月|最近一年|年度|看板|报告|汇总分析)/u.test(questionText)) {
      dimensions.add('month');
    }
    if (/(阶段|漏斗)/u.test(questionText)) {
      dimensions.add('stage');
    }
    if (/(状态)/u.test(questionText)) {
      dimensions.add('status');
    }
    if (/(合作级别|合作等级|渠道等级|等级)/u.test(questionText)) {
      dimensions.add('partner_level');
    }
    if (/(技术服务商|是否技术服务商)/u.test(questionText)) {
      dimensions.add('is_technical_service_provider');
    }
    return [...dimensions];
  }

  /**
   * 测试桩识别分析模式。
   *
   * 参数说明：`questionText` 为规范化问题。
   * 返回值说明：返回宽意图分析模式。
   * 调用注意事项：报告和看板优先于排行、趋势等局部模式。
   */
  private detectTestBusinessAnalysisMode(questionText: string): BusinessAnalysisIntent['analysisMode'] {
    if (/(看板|经营看板)/u.test(questionText)) {
      return 'dashboard';
    }
    if (/(对比|比较|差异|分别|相比|一季度.*二季度|二季度.*一季度|Q1.*Q2|Q2.*Q1)/iu.test(questionText)) {
      return 'comparison';
    }
    if (/(报告|汇总分析|经营分析|总结)/u.test(questionText)) {
      return 'summary_report';
    }
    if (/(趋势|走势|按月|逐月)/u.test(questionText)) {
      return 'trend';
    }
    if (/(分布|占比|合作等级|技术服务商|状态|阶段)/u.test(questionText)) {
      return 'distribution';
    }
    if (/(排行|排名|TOP|top|前\s*(三|五|十|\d+))/u.test(questionText)) {
      return 'ranking';
    }
    return 'single_metric';
  }

  /**
   * 测试桩识别过滤条件。
   *
   * 参数说明：`questionText` 为规范化问题，`dimensions` 为已识别维度。
   * 返回值说明：返回宽意图过滤条件。
   * 调用注意事项：只保留自然语言标签，实际字段下推由映射和执行层决定。
   */
  private detectTestBusinessFilters(
    questionText: string,
    dimensions: BusinessAnalysisIntent['dimensions'],
  ): BusinessAnalysisIntent['filters'] {
    const filters: BusinessAnalysisIntent['filters'] = [];
    if (dimensions.includes('region')) {
      const regionMatch = questionText.match(/(大北区|大东区|大南区|大西区|大北|大东|大南|大西|山东|广州|华东|华北|华南|北京|上海|深圳)[^，,。；;\s]*/u);
      if (regionMatch?.[0]) {
        filters.push({
          field: 'region',
          operator: 'contains',
          value: regionMatch[0],
          label: regionMatch[0],
        });
      }
    }
    return filters;
  }

  /**
   * 测试桩识别业务实体。
   *
   * 参数说明：`questionText` 为规范化问题。
   * 返回值说明：返回业务实体数组。
   * 调用注意事项：实体只用于审计和提示，不直接作为字段执行。
   */
  private detectTestBusinessEntities(questionText: string): BusinessAnalysisIntent['entities'] {
    const entities: BusinessAnalysisIntent['entities'] = [];
    for (const token of ['大北区', '大东区', '大南区', '大西区', '大北', '大东', '大南', '大西', '山东', '广州', '华东', '华北']) {
      if (questionText.includes(token)) {
        entities.push({ type: 'region', value: token });
      }
    }
    if (/(服务商|渠道商|渠道|代理商)/u.test(questionText)) {
      entities.push({ type: 'partner', value: '服务商' });
    }
    return entities;
  }

  /**
   * 测试桩识别比较偏好。
   *
   * 参数说明：`questionText` 为规范化问题。
   * 返回值说明：返回 TOP、集中度或跨周期比较等偏好。
   * 调用注意事项：只服务本地验收，不替代生产 AI 语义解析。
   */
  private detectTestBusinessComparison(
    questionText: string,
  ): BusinessAnalysisIntent['comparison'] {
    const comparison = new Set<BusinessAnalysisIntent['comparison'][number]>();
    if (/集中度|TOP|top|前\s*(三|五|十|\d+)/iu.test(questionText)) {
      comparison.add('top_n');
      comparison.add('concentration');
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

    return [...comparison];
  }

  private buildTestStructuredIntent(questionText: string): AnalysisIntent {
    const normalizedQuestion = this.summarizeQuestion(questionText);
    const analysisFacetProfile = inferAnalysisFacetProfile(normalizedQuestion);
    const analysisDepth = inferAnalysisDepth(normalizedQuestion);
    const analysisFocus = resolveAnalysisFocus(normalizedQuestion);
    const outputPreference = resolveAnalysisOutputPreference(normalizedQuestion);
    if (
      /(新增客户|创建|修改|删除|提醒|写入|更新状态|改成)/u.test(
        normalizedQuestion,
      ) &&
      !this.isTestReadOnlyQueryRewrite(normalizedQuestion) &&
      !this.isTestReadOnlyCustomerLifecycleQuestion(normalizedQuestion)
    ) {
      return {
        domain: 'opportunity-analysis',
        metrics: [],
        dimensions: [],
        filters: {},
        missingConditions: [],
        normalizedQuestion,
        requestedAction: 'BLOCK',
        confidence: 'LOW',
        blockReason:
          '当前一期仅支持受控问数，不支持写入、修改、删除或提醒创建类请求。',
        orderBy: [],
        resultKindHint: 'owner-ranking',
        queryEntities: ['CRM'],
        resultIntent: 'summary',
        analysisFacetProfile: 'generic-analysis',
        analysisDepth: 'snapshot',
        analysisFocus: [],
        outputPreference: [],
        ...this.buildTestCapabilityPackMetadata('analysis-intent-pack'),
      } as AnalysisIntent;
    }

    if (/(天气|气温|股票|基金|新闻|汇率|电影|翻译|代码|编程)/u.test(normalizedQuestion)) {
      return {
        domain: 'opportunity-analysis',
        metrics: [],
        dimensions: [],
        filters: {},
        missingConditions: [],
        normalizedQuestion,
        requestedAction: 'BLOCK',
        confidence: 'LOW',
        blockReason:
          '当前仅支持 CRM 智能分析相关问题，请改为商机、合同、客户、负责人、区域等经营分析问题。',
        orderBy: [],
        resultKindHint: 'owner-ranking',
        queryEntities: ['CRM'],
        resultIntent: 'summary',
        analysisFacetProfile: 'generic-analysis',
        analysisDepth: 'snapshot',
        analysisFocus: [],
        outputPreference: [],
        ...this.buildTestCapabilityPackMetadata('analysis-intent-pack'),
      } as AnalysisIntent;
    }

    const temporalSlot = this.buildTestTemporalSlot(normalizedQuestion);
    const isContractQuestion = /(合同|签单|签约|成交|回款)/u.test(normalizedQuestion);
    const isCustomerQuestion = /(客户|客资|客群|重点客户|战略客户)/u.test(normalizedQuestion);
    const domain = isContractQuestion
      ? 'contract-conversion'
      : isCustomerQuestion
        ? 'customer-relationship'
        : 'opportunity-analysis';
    const metrics = isContractQuestion
      ? ['转合同金额']
      : isCustomerQuestion
        ? ['客户贡献度']
        : /(商机数量|商机数|机会数)/u.test(normalizedQuestion)
          ? ['商机数量']
          : /(赢单率|转化率|成交率)/u.test(normalizedQuestion)
            ? ['赢单率']
            : ['新增商机金额'];
    const detectedDimensions = [
      ...(/(渠道商|服务商|渠道|伙伴|代理商|经销商)/u.test(normalizedQuestion)
        ? ['渠道商']
        : []),
      ...(/(区域|团队|大区)/u.test(normalizedQuestion) ? ['区域'] : []),
      ...(/(月份|月度|按月|逐月|趋势|前三个月|前三月|近三个月|最近三个月)/u.test(normalizedQuestion)
        ? ['月份']
        : []),
      ...(/(客户分类|客户等级|客户类型|分类)/u.test(normalizedQuestion)
        ? ['客户分类']
        : []),
    ];
    const dimensions = detectedDimensions.length > 0 ? detectedDimensions : ['销售负责人'];
    const missingConditions: string[] = [];
    const resultKindHint =
      analysisFacetProfile === 'opportunity-risk'
        ? 'risk-overview'
        : dimensions.includes('渠道商')
          ? 'partner-contribution'
          : analysisFacetProfile === 'region-operations'
          ? 'department-contribution'
          : temporalSlot &&
            /(情况|态势|走势|趋势)/u.test(normalizedQuestion)
        ? 'time-trend'
        : dimensions.includes('月份')
          ? 'time-trend'
          : 'owner-ranking';
    const resultIntent =
      temporalSlot &&
      /(情况|态势|走势|趋势)/u.test(normalizedQuestion)
        ? 'trend'
        : dimensions.includes('月份')
          ? 'trend'
          : 'ranking';

    return {
      domain,
      metrics,
      dimensions,
      filters: temporalSlot
        ? {
            timeRange: temporalSlot.normalizedLabel,
            startAt: temporalSlot.startAt,
            endAt: temporalSlot.endAt,
          }
        : {},
      ...(temporalSlot ? { temporalSlot } : {}),
      missingConditions,
      normalizedQuestion,
      requestedAction: 'READONLY_ANALYSIS',
      confidence: missingConditions.length === 0 ? 'HIGH' : 'MEDIUM',
      blockReason: '',
      orderBy: [
        {
          field: resultKindHint === 'time-trend' ? 'bucket_label' : 'amount',
          direction: resultKindHint === 'time-trend' ? 'ASC' : 'DESC',
        },
      ],
      resultKindHint,
      queryEntities: [domain === 'contract-conversion' ? '合同' : domain === 'customer-relationship' ? '客户' : '商机', ...dimensions],
      resultIntent,
      timeRangeText: temporalSlot?.rawText,
      analysisFacetProfile,
      analysisDepth,
      analysisFocus,
      outputPreference,
      ...this.buildTestCapabilityPackMetadata('analysis-intent-pack'),
    } as AnalysisIntent;
  }

  /**
   * 为自动化测试提供确定性的追问语义桩结果。
   *
   * 该桩用于验证追问主链先消费统一 AI 结果，而不是继续依赖本地关键词作为运行时主判断。
   */
  private classifyTestAnalysisFollowUpIntent(
    questionText: string,
  ): AnalysisFollowUpIntent | null {
    const normalizedQuestion = this.summarizeQuestion(questionText).toLowerCase();
    if (
      /(说明什么|为什么|原因|解释|怎么看|结论|重点原因|what does this mean|why|explain)/u.test(
        normalizedQuestion,
      )
    ) {
      return 'EXPLAIN_RESULT';
    }

    if (
      /(换成|改成|也看一下|再看|按.+看|重新看|重新分析|also show|compare|break down)/u.test(
        normalizedQuestion,
      )
    ) {
      return 'RUN_NEW_ANALYSIS';
    }

    return null;
  }

  /**
   * 为测试环境提供窄范围的企业微信 idle semantic 桩。
   *
   * 这里只覆盖已经明确迁入统一 idle semantic lane 的入口：
   * 帮助、个人日报查看、小组日报预览、客户/商机创建、显式项目查询。
   * 其余文本继续返回 null，让现有业务回退路径保持原状，避免把低置信短句和越界请求误导成其它流程。
   */
  private classifyTestWecomIdleConversationIntent(
    messageText: string,
  ): WecomIdleConversationIntentOutput | null {
    const normalizedText = this.summarizeQuestion(messageText);
    if (!normalizedText) {
      return null;
    }

    const fixtureMatch = resolveWecomIdleEntryFixture(normalizedText);
    if (fixtureMatch) {
      return {
        ...fixtureMatch,
        ...this.buildTestCapabilityPackMetadata('wecom-idle-entry-pack'),
      } as WecomIdleConversationIntentOutput;
    }

    const helpIntent = detectWecomHelpIntent(normalizedText);
    if (helpIntent) {
      return {
        intent: 'HELP_GUIDANCE',
        helpScene: helpIntent,
        ...this.buildTestCapabilityPackMetadata('wecom-idle-entry-pack'),
      };
    }

    const teamPreviewIntent = parseWecomTeamDailyReportPreviewIntent(normalizedText);
    if (teamPreviewIntent) {
      return {
        intent: 'TEAM_DAILY_REPORT_QUERY',
        leaderNameQuery: teamPreviewIntent.leaderNameQuery,
        ...this.buildTestCapabilityPackMetadata('wecom-idle-entry-pack'),
      };
    }

    if (isWecomDailyReportSelfViewIntent(normalizedText)) {
      return {
        intent: 'DAILY_REPORT_QUERY',
        ...this.buildTestCapabilityPackMetadata('wecom-idle-entry-pack'),
      };
    }

    if (
      this.isTestWecomDailyReportEntryIntent(normalizedText) ||
      this.isTestWecomFreeformFollowUpIntent(normalizedText)
    ) {
      return {
        intent: 'DAILY_REPORT',
        dailyReportPrompt: 'FOLLOW_UP_TEMPLATE_ENTRY',
        ...this.buildTestCapabilityPackMetadata('wecom-idle-entry-pack'),
      };
    }

    const crmCreateIntent = detectWecomCrmCreateIntent(normalizedText);
    if (crmCreateIntent === 'Customer') {
      return {
        intent: 'CRM_CREATE_CUSTOMER',
        ...this.buildTestCapabilityPackMetadata('wecom-idle-entry-pack'),
      };
    }

    if (crmCreateIntent === 'Opportunity') {
      return {
        intent: 'CRM_CREATE_OPPORTUNITY',
        ...this.buildTestCapabilityPackMetadata('wecom-idle-entry-pack'),
      };
    }

    const lookupText = this.extractTestWecomIdleLookupText(normalizedText);
    if (lookupText) {
      return {
        intent: 'OPPORTUNITY_LOOKUP',
        lookupText,
        ...this.buildTestCapabilityPackMetadata('wecom-idle-entry-pack'),
      };
    }

    return null;
  }

  private extractTestWecomIdleLookupText(messageText: string): string | undefined {
    if (
      /今日跟进[:：]|今天跟进[:：]|帮我写|写今日跟进|写今天的跟进|跟进了|拜访了|推进了|沟通了|回访了/u.test(
        messageText,
      )
    ) {
      return undefined;
    }

    const matchedTarget =
      messageText.match(
        /^(?:查一下|查一查|查询一下|查询|查找|查)(?<target>[\u4e00-\u9fa5A-Za-z0-9·-]{2,30})$/u,
      )?.groups?.target?.trim() ??
      messageText.match(
        /(?:查一下|查一查|查询一下|查询|查找|查|看看|看下|看一下)(?<target>.+?)(?:项目|商机|机会)$/u,
      )?.groups?.target?.trim() ??
      messageText.match(/(?<target>[\u4e00-\u9fa5A-Za-z0-9·]{2,30})(?:那个)?项目/u)
        ?.groups?.target?.trim();

    if (!matchedTarget) {
      return undefined;
    }

    if (/(天气|日报|金额|排名|趋势|分析|统计)/u.test(matchedTarget)) {
      return undefined;
    }

    return matchedTarget;
  }

  private isTestWecomDailyReportEntryIntent(messageText: string): boolean {
    return /今日跟进[:：]|今天跟进[:：]|帮我写今天的跟进|帮我写今日跟进|写今日跟进|写今天的跟进|跟进商机|跟进今日商机|跟进客户/u.test(
      messageText,
    );
  }

  /**
   * 为测试环境补齐“明显跟进叙述”场景，确保空闲态自由文本也先经 idle semantic lane。
   *
   * 这里仍保持窄范围识别，只覆盖明确包含跟进行为与叙述上下文的文本，
   * 避免把普通问数、帮助或创建入口误判为跟进整理。
   */
  private isTestWecomFreeformFollowUpIntent(messageText: string): boolean {
    if (
      detectWecomHelpIntent(messageText) ||
      detectWecomCrmCreateIntent(messageText) ||
      parseWecomTeamDailyReportPreviewIntent(messageText) ||
      isWecomDailyReportSelfViewIntent(messageText) ||
      this.extractTestWecomIdleLookupText(messageText)
    ) {
      return false;
    }

    if (
      /天气|气温|股票|基金|新闻|汇率|电影|翻译|代码|编程|分析|统计|排名|排行|趋势/u.test(
        messageText,
      )
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
   * 将配置中的 reasoning effort 映射到 SDK 支持的枚举值。
   *
   * 若配置缺失或值不合法，则回退为 `none`，
   * 与 Codex 当前真实支持的最低档位保持一致。
   */
  private mapReasoningEffort(
    value?: string,
  ): 'none' | 'low' | 'medium' | 'high' | 'xhigh' | undefined {
    const normalizedValue = value?.trim().toLowerCase();
    if (
      normalizedValue === 'none' ||
      normalizedValue === 'low' ||
      normalizedValue === 'medium' ||
      normalizedValue === 'high' ||
      normalizedValue === 'xhigh'
    ) {
      return normalizedValue;
    }

    return 'low';
  }

  private resolveBackendWorkingDirectory(): string {
    const repoRoot = this.localRuntimeConfigService.getRepoRoot();
    if (basename(repoRoot).toLowerCase() === 'backend') {
      return repoRoot;
    }

    return join(repoRoot, 'backend');
  }
}

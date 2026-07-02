import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, Optional } from '@nestjs/common';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';
import type { AiRuntimeConfig } from '../../shared/config/local-runtime-config.service';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import type { RiskLevel } from '../../shared/types/domain';
import { ContractReviewConfigService } from './contract-review.config';
import type {
  ContractReviewCompiledCheck,
  ContractReviewFactExtractionResult,
  ContractReviewSkillPackSnapshot,
} from './contract-review.runtime.types';
import type { ContractReviewDocumentFragment, ContractReviewDocumentSnapshot } from './contract-review.types';
import type { ContractReviewSkillPackPromptSet } from './skill-pack/contract-review-skill-pack.types';
import { AiRuntimeConfigResolver } from '../ai-models/ai-runtime-config.resolver';
import { UnifiedAiExecutionService } from '../ai-models/unified-ai-execution.service';

type ContractReviewAiResultFlag = 'HIT' | 'NO_HIT';
type ContractReviewAiConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

type RemovedCodexClient = {
  startThread: (...args: unknown[]) => {
    run: (...args: unknown[]) => Promise<{ finalResponse: string }>;
  };
};

type RemovedCodexSdkModule = {
  Codex: new (...args: unknown[]) => RemovedCodexClient;
};

export interface ContractReviewAiReviewInput {
  documentSnapshot: ContractReviewDocumentSnapshot;
  packSnapshot: ContractReviewSkillPackSnapshot;
  factExtraction: ContractReviewFactExtractionResult;
  requirementsText: string;
  workflowText: string;
  promptSet: ContractReviewSkillPackPromptSet;
}

interface ContractReviewAiExecutionOptions {
  logLabel: string;
  reviewTimeoutMs: number;
  maxParallelGroups: number;
  maxChecksPerExecutionBatch: number;
  includeAdditionalFindings: boolean;
  reasoningEffort?: string;
}

export interface ContractReviewAiIssueCandidate {
  reviewType?: 'CHECK' | 'SUPPLEMENTAL';
  ruleCode: string;
  group: string;
  title?: string;
  sourceClause?: string;
  locator: string;
  quote: string;
  reason: string;
  suggestion: string;
  confidence: ContractReviewAiConfidence;
  riskLevel: RiskLevel;
  isVeto: boolean;
  analysis?: string;
}

interface ContractReviewAiGroupReviewInput {
  group: string;
  checks: ContractReviewCompiledCheck[];
}

interface ContractReviewAiStructuredCheckResult {
  checkId: string;
  result: ContractReviewAiResultFlag;
  riskLevel: RiskLevel;
  isVeto: boolean;
  quote: string;
  locator: string;
  reason: string;
  suggestion: string;
  confidence: ContractReviewAiConfidence;
}

interface ContractReviewAiStructuredGroupResult {
  group: string;
  results: ContractReviewAiStructuredCheckResult[];
  additionalFindings?: ContractReviewAiStructuredSupplementalResult[];
}

interface ContractReviewAiStructuredSupplementalResult {
  title: string;
  riskLevel: RiskLevel;
  isVeto: boolean;
  quote: string;
  locator: string;
  reason: string;
  suggestion: string;
  confidence: ContractReviewAiConfidence;
  sourceClause: string;
  requirementTopic?: string;
}

interface ContractReviewAiNormalizedGroupResult {
  results: ContractReviewAiStructuredCheckResult[];
  additionalFindings: ContractReviewAiStructuredSupplementalResult[];
}

interface ContractReviewMarkdownSection {
  heading: string;
  body: string;
}

interface ContractReviewAiGroupExecutionResult {
  checkHits: ContractReviewAiIssueCandidate[];
  supplementalFindings: Array<{
    group: string;
    finding: ContractReviewAiStructuredSupplementalResult;
  }>;
}

interface ContractReviewAiDebugGroupSnapshot {
  group: string;
  checkCount: number;
  promptLength: number;
  promptPreview: string;
  outputSchemaPreview: string;
}

interface ContractReviewAiDebugContext {
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED';
  capturedAt: string;
  logLabel?: string;
  providerCode?: string;
  model?: string;
  wireApi?: string;
  sdkType?: string;
  failureReason?: string;
  failureGroup?: string;
  rawResponsePreview?: string;
  rawResponseLength?: number;
  document: {
    title: string;
    summary: string;
    fullTextLength: number;
    paragraphCount: number;
    headingCount: number;
    clauseCount: number;
  };
  reviewGroups: ContractReviewAiDebugGroupSnapshot[];
}

@Injectable()
export class ContractReviewAiReviewService {
  private reviewQueue: Promise<void> = Promise.resolve();
  private readonly maxChecksPerExecutionBatch = 4;
  private readonly supplementalReasoningEffort = 'low';
  private lastReviewFailureReason?: string;
  private lastReviewDebugContext?: ContractReviewAiDebugContext;
  private formalPromptTemplateCache?: string;

  constructor(
    private readonly localRuntimeConfigService: LocalRuntimeConfigService,
    private readonly analysisLoggerService: AnalysisLoggerService,
    private readonly contractReviewConfigService: ContractReviewConfigService,
    @Optional()
    private readonly aiRuntimeConfigResolver?: AiRuntimeConfigResolver,
    @Optional()
    private readonly unifiedAiExecutionService?: UnifiedAiExecutionService,
  ) {}

  /**
   * 统一解析当前生效的 AI 配置。
   *
   * 当治理后台存在激活 Profile 时优先使用该配置；
   * 未接入 resolver 时则继续回退到原环境配置。
   */
  private getCurrentAiConfig(): AiRuntimeConfig {
    return (
      this.aiRuntimeConfigResolver?.getCurrentConfig() ??
      this.localRuntimeConfigService.getAiConfig()
    );
  }

  /**
   * 当统一执行门面可用时，优先通过当前激活 Provider 执行合同审核结构化调用。
   */
  private async invokeUnifiedStructured<T extends object>(
    config: T & {
      sdkType?: AiRuntimeConfig['sdkType'];
      timeoutMs?: number;
    },
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
      requestOverrides: {
        // 合同审核分组会返回较长的 reason / suggestion / additionalFindings，
        // 默认 1024 tokens 容易被兼容网关截断成半截 JSON，因此这里显式放大输出上限。
        maxTokens: 4096,
        // 合同审核单次分组允许长于默认 Profile 超时，需显式把业务超时传到统一执行层。
        timeoutMs: config.timeoutMs,
      },
    });
  }

  private shouldFallbackToLegacyCodex(error: unknown): boolean {
    void error;
    return false;
  }

  consumeLastFailureReason(): string | undefined {
    const reason = this.lastReviewFailureReason;
    this.lastReviewFailureReason = undefined;
    return reason;
  }

  consumeLastDebugContext(): unknown {
    const context = this.lastReviewDebugContext;
    this.lastReviewDebugContext = undefined;
    return context;
  }

  async reviewDocument(
    input: ContractReviewAiReviewInput,
  ): Promise<ContractReviewAiIssueCandidate[] | null> {
    this.lastReviewFailureReason = undefined;
    this.lastReviewDebugContext = undefined;
    if (process.env.NODE_ENV === 'test') {
      return null;
    }

    const config = this.getCurrentAiConfig();
    if (!this.isRuntimeConfigAvailable(config)) {
      this.lastReviewFailureReason =
        'AI 运行时配置不可用，请检查当前激活配置是否包含模型、网关地址和密钥。';
      this.lastReviewDebugContext = this.buildInitialDebugContext(input, config, {
        logLabel: '合同审核 AI 审查',
      });
      this.lastReviewDebugContext.status = 'SKIPPED';
      this.lastReviewDebugContext.failureReason = this.lastReviewFailureReason;
      this.logUnavailableConfig('合同审核 AI 已跳过，运行时配置不完整。', config);
      return null;
    }

    const reviewGroups = this.buildGroupReviewInputs(input.packSnapshot);
    if (reviewGroups.length === 0) {
      return [];
    }
    return await this.executeReviewDocument(input, config, reviewGroups, {
      logLabel: '合同审核 AI 审查',
      reviewTimeoutMs: this.contractReviewConfigService.getAiReviewTimeoutMs(),
      maxParallelGroups: this.contractReviewConfigService.getAiMaxParallelGroups(),
      maxChecksPerExecutionBatch: this.maxChecksPerExecutionBatch,
      includeAdditionalFindings: true,
      reasoningEffort: this.resolveReviewReasoningEffort(
        input.packSnapshot.modelProfile,
        config.reasoningEffort,
      ),
    });
  }

  isReviewAvailable(): boolean {
    return this.isRuntimeConfigAvailable(this.getCurrentAiConfig());
  }

  async reviewSupplementalChecks(
    input: ContractReviewAiReviewInput,
  ): Promise<ContractReviewAiIssueCandidate[] | null> {
    this.lastReviewFailureReason = undefined;
    this.lastReviewDebugContext = undefined;
    if (process.env.NODE_ENV === 'test') {
      return null;
    }

    const config = this.getCurrentAiConfig();
    if (!this.isRuntimeConfigAvailable(config)) {
      this.lastReviewFailureReason =
        'AI 运行时配置不可用，请检查当前激活配置是否包含模型、网关地址和密钥。';
      this.lastReviewDebugContext = this.buildInitialDebugContext(input, config, {
        logLabel: '合同审核 AI 补充审查',
      });
      this.lastReviewDebugContext.status = 'SKIPPED';
      this.lastReviewDebugContext.failureReason = this.lastReviewFailureReason;
      this.logUnavailableConfig('合同审核 AI 补充审查已跳过，运行时配置不完整。', config);
      return null;
    }

    const reviewGroups = this.buildGroupReviewInputs(input.packSnapshot);
    if (reviewGroups.length === 0) {
      return [];
    }

    return await this.executeReviewDocument(input, config, reviewGroups, {
      logLabel: '合同审核 AI 补充审查',
      reviewTimeoutMs: this.contractReviewConfigService.getAiSupplementalReviewTimeoutMs(),
      maxParallelGroups: 1,
      maxChecksPerExecutionBatch:
        this.contractReviewConfigService.getAiSupplementalMaxChecksPerBatch(),
      includeAdditionalFindings: false,
      reasoningEffort: this.supplementalReasoningEffort,
    });
  }

  private buildGroupReviewInputs(
    packSnapshot: ContractReviewSkillPackSnapshot,
  ): ContractReviewAiGroupReviewInput[] {
    return packSnapshot.groups
      .map((group) => ({
        group: group.group,
        checks: packSnapshot.checks.filter((check) => group.checkCodes.includes(check.code)),
      }))
      .filter((group) => group.checks.length > 0);
  }

  private buildExecutionBatches(
    reviewGroups: ContractReviewAiGroupReviewInput[],
    maxChecksPerExecutionBatch = this.maxChecksPerExecutionBatch,
  ): ContractReviewAiGroupReviewInput[] {
    const batches: ContractReviewAiGroupReviewInput[] = [];
    let currentGroups: string[] = [];
    let currentChecks: ContractReviewCompiledCheck[] = [];

    const flushCurrentBatch = () => {
      if (currentChecks.length === 0) {
        return;
      }

      batches.push({
        group:
          currentGroups.length === 1
            ? currentGroups[0]
            : `合并批次：${currentGroups.join(' / ')}`,
        checks: [...currentChecks],
      });
      currentGroups = [];
      currentChecks = [];
    };

    for (const reviewGroup of reviewGroups) {
      const nextCheckCount = currentChecks.length + reviewGroup.checks.length;
      if (
        currentChecks.length > 0 &&
        nextCheckCount > maxChecksPerExecutionBatch
      ) {
        flushCurrentBatch();
      }

      currentGroups.push(reviewGroup.group);
      currentChecks.push(...reviewGroup.checks);
    }

    flushCurrentBatch();
    return batches;
  }

  private async executeReviewDocument(
    input: ContractReviewAiReviewInput,
    config: AiRuntimeConfig,
    reviewGroups: ContractReviewAiGroupReviewInput[],
    options: ContractReviewAiExecutionOptions,
  ): Promise<ContractReviewAiIssueCandidate[] | null> {
    const executionBatches = this.buildExecutionBatches(
      reviewGroups,
      options.maxChecksPerExecutionBatch,
    );

    this.analysisLoggerService.logStep(`${options.logLabel}启动。`, {
      reviewGroupCount: reviewGroups.length,
      executionBatchCount: executionBatches.length,
      model: config.model,
      modelProvider: config.modelProvider ?? 'default',
      modelProfile: input.packSnapshot.modelProfile,
      reasoningEffort: options.reasoningEffort ?? 'minimal',
      wireApi: config.wireApi ?? 'unset',
      codexPath: this.resolveCodexPathOverride(config.codexPath) ?? 'bundled',
      proxyKeys: Object.keys(config.proxyEnv ?? {}),
      timeoutMs: options.reviewTimeoutMs,
      includeAdditionalFindings: options.includeAdditionalFindings,
    });

    this.lastReviewDebugContext = this.buildInitialDebugContext(input, config, options);
    try {
      const result = await this.runGroupedCodexReviewPrompts(
        {
          sdkType: config.sdkType,
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          model: config.model,
          modelProvider: config.modelProvider,
          reasoningEffort: options.reasoningEffort,
          timeoutMs: options.reviewTimeoutMs,
          wireApi: config.wireApi,
          requiresOpenaiAuth: config.requiresOpenaiAuth,
          disableResponseStorage: config.disableResponseStorage,
          codexPath: config.codexPath,
          proxyEnv: config.proxyEnv,
        },
        input,
        executionBatches,
        options,
      );
      this.lastReviewFailureReason = undefined;
      this.markReviewDebugSuccess();
      return result;
    } catch (error) {
      this.lastReviewFailureReason = this.buildFailureReasonMessage(error, config);
      this.markReviewDebugFailure(error, this.lastReviewFailureReason);
      this.analysisLoggerService.logWarn(`${options.logLabel}失败，已跳过 AI 结果回写。`, {
        reason: error instanceof Error ? error.message : 'unknown',
        modelProvider: config.modelProvider,
        model: config.model,
        baseUrl: config.baseUrl,
        wireApi: config.wireApi,
        codexPath: config.codexPath ?? 'bundled',
        proxyKeys: Object.keys(config.proxyEnv ?? {}),
      });
      return null;
    }
  }

  private isRuntimeConfigAvailable(config: AiRuntimeConfig): boolean {
    return Boolean(config.enabled && config.baseUrl && config.model && config.apiKey);
  }

  private buildFailureReasonMessage(
    error: unknown,
    config: Pick<AiRuntimeConfig, 'model' | 'wireApi' | 'providerCode' | 'modelProvider'>,
  ): string {
    const rawReason =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : 'unknown';
    const provider = config.providerCode?.trim() || config.modelProvider?.trim() || 'unknown';
    const model = config.model?.trim() || 'unknown';
    const wireApi = config.wireApi?.trim() || 'default';
    const runtimeLabel = `Provider=${provider}，Model=${model}，协议=${wireApi}`;

    if (rawReason === 'UNIFIED_AI_EXECUTION_UNAVAILABLE') {
      return `AI 审核执行器未就绪，请检查后端统一 AI 执行配置。${runtimeLabel}`;
    }

    if (/fetch failed/ui.test(rawReason)) {
      return `AI 服务请求失败，请检查后端出站网络、网关地址或 TLS 连接。${runtimeLabel}`;
    }

    if (/timeout|超时|HTTP_REQUEST/ui.test(rawReason)) {
      return `AI 服务请求超时或连接中断，请检查网关连通性与超时配置。${runtimeLabel}`;
    }

    if (/RESPONSE_PARSE|json|schema/ui.test(rawReason)) {
      return `AI 返回结果无法通过结构化校验，请检查模型结构化输出兼容性。${runtimeLabel}；原始原因=${rawReason}`;
    }

    return `AI 审核执行失败。${runtimeLabel}；原始原因=${rawReason}`;
  }

  private buildInitialDebugContext(
    input: ContractReviewAiReviewInput,
    config: Partial<
      Pick<
        AiRuntimeConfig,
        'providerCode' | 'modelProvider' | 'model' | 'wireApi' | 'sdkType'
      >
    >,
    options: Pick<ContractReviewAiExecutionOptions, 'logLabel'>,
  ): ContractReviewAiDebugContext {
    return {
      status: 'PENDING',
      capturedAt: new Date().toISOString(),
      logLabel: options.logLabel,
      providerCode: config.providerCode ?? config.modelProvider,
      model: config.model,
      wireApi: config.wireApi,
      sdkType: config.sdkType,
      document: {
        title: input.documentSnapshot.title,
        summary: input.documentSnapshot.summary,
        fullTextLength: input.documentSnapshot.fullText.length,
        paragraphCount: input.documentSnapshot.paragraphs.length,
        headingCount: input.documentSnapshot.headings.length,
        clauseCount: input.documentSnapshot.clauses.length,
      },
      reviewGroups: [],
    };
  }

  private ensureLastReviewDebugContext(
    input: ContractReviewAiReviewInput,
    config: Partial<
      Pick<
        AiRuntimeConfig,
        'providerCode' | 'modelProvider' | 'model' | 'wireApi' | 'sdkType'
      >
    >,
    options: Pick<ContractReviewAiExecutionOptions, 'logLabel'>,
  ): ContractReviewAiDebugContext {
    if (!this.lastReviewDebugContext) {
      this.lastReviewDebugContext = this.buildInitialDebugContext(input, config, options);
    }

    return this.lastReviewDebugContext;
  }

  private recordReviewGroupDebugSnapshot(
    input: ContractReviewAiReviewInput,
    config: Partial<
      Pick<
        AiRuntimeConfig,
        'providerCode' | 'modelProvider' | 'model' | 'wireApi' | 'sdkType'
      >
    >,
    options: Pick<ContractReviewAiExecutionOptions, 'logLabel'>,
    reviewGroup: ContractReviewAiGroupReviewInput,
    prompt: string,
    outputSchema: Record<string, unknown>,
  ): void {
    const context = this.ensureLastReviewDebugContext(input, config, options);
    context.reviewGroups.push({
      group: reviewGroup.group,
      checkCount: reviewGroup.checks.length,
      promptLength: prompt.length,
      promptPreview:
        prompt.length > 6000 ? `${prompt.slice(0, 6000).trim()}\n...[truncated]` : prompt,
      outputSchemaPreview: JSON.stringify(outputSchema, null, 2),
    });
  }

  private markReviewDebugSuccess(): void {
    if (this.lastReviewDebugContext) {
      this.lastReviewDebugContext.status = 'SUCCEEDED';
      this.lastReviewDebugContext.failureReason = undefined;
      this.lastReviewDebugContext.failureGroup = undefined;
      this.lastReviewDebugContext.rawResponsePreview = undefined;
      this.lastReviewDebugContext.rawResponseLength = undefined;
    }
  }

  private markReviewDebugFailure(error: unknown, failureReason: string, group?: string): void {
    if (!this.lastReviewDebugContext) {
      return;
    }

    this.lastReviewDebugContext.status = 'FAILED';
    this.lastReviewDebugContext.failureReason = failureReason;
    this.lastReviewDebugContext.failureGroup = group;

    if (!error || typeof error !== 'object') {
      return;
    }

    const errorRecord = error as Record<string, unknown>;
    if (typeof errorRecord.rawResponsePreview === 'string') {
      this.lastReviewDebugContext.rawResponsePreview = errorRecord.rawResponsePreview;
    }
    if (typeof errorRecord.rawResponseLength === 'number') {
      this.lastReviewDebugContext.rawResponseLength = errorRecord.rawResponseLength;
    }
  }

  private logUnavailableConfig(message: string, config: AiRuntimeConfig): void {
    this.analysisLoggerService.logWarn(message, {
      nodeEnv: process.env.NODE_ENV ?? 'undefined',
      enabled: config.enabled,
      hasApiKey: Boolean(config.apiKey),
      hasBaseUrl: Boolean(config.baseUrl),
      hasModel: Boolean(config.model),
      modelProvider: config.modelProvider ?? 'unset',
      wireApi: config.wireApi ?? 'unset',
      codexPath: this.resolveCodexPathOverride(config.codexPath) ?? 'bundled',
      proxyKeys: Object.keys(config.proxyEnv ?? {}),
    });
  }

  private buildGroupPrompt(
    input: ContractReviewAiReviewInput,
    reviewGroup: ContractReviewAiGroupReviewInput,
    includeAdditionalFindings: boolean,
  ): string {
    const formalPromptTemplate = this.getFormalPromptTemplate(input);
    const fragmentLines = this.pickGroupReviewFragments(
      input.documentSnapshot,
      input.factExtraction,
      reviewGroup,
    ).map((fragment) => `- [${fragment.locator}] ${fragment.text}`);
    const factLines = this.buildGroupFactLines(input.factExtraction, reviewGroup);
    const templateMatchLines = this.buildTemplateMatchLines(input.factExtraction);
    const templateSlotLines = this.buildTemplateSlotLines(input.factExtraction);
    const requirementsLines = includeAdditionalFindings
      ? this.buildReferenceContextLines(
          input.requirementsText,
          reviewGroup,
          2800,
        ).map((line) => this.rewriteReferenceContextLine(line, 'requirements'))
      : [];
    const workflowLines = includeAdditionalFindings
      ? this.buildReferenceContextLines(
          input.workflowText,
          reviewGroup,
          1800,
        ).map((line) => this.rewriteReferenceContextLine(line, 'workflow'))
      : [];
    const checkLines = reviewGroup.checks.map(
      (check) =>
        `- ${check.code} | ${check.title} | 风险=${check.riskLevel} | 一票否决=${
          check.isVeto ? '是' : '否'
        } | 关键词=${check.keywords.join('、')} | 依据=${check.sourceClause} | 建议=${check.suggestion}`,
    );

    return [
      '你是 CRM 系统中的合同审核分组审查器，本轮必须直接使用项目内《合同审核AI提示词（正式版）》作为主提示词基线完成审查。',
      formalPromptTemplate,
      '',
      '本轮为分组结构化审查，不是整份合同的最终总结。请在继承正式版规则的前提下，仅输出当前检查组对应的结构化结果。',
      '',
      ...(includeAdditionalFindings
        ? [
            '补充要求：',
            '7. additionalFindings 用于记录合同原文中已经出现、且依据公司审查规则或审核流程应当关注、但当前检查项尚未完整覆盖的补充风险。',
            '8. additionalFindings 不得与 results 中已命中的检查项重复；每条都必须包含 title、sourceClause、quote、locator、reason、suggestion。',
            '9. additionalFindings 的 sourceClause、reason、suggestion、requirementTopic 必须写成业务人员可直接理解的话，不得出现 requirements.md、workflow.md、checks.json、提示词、文件名或系统实现痕迹。',
            '10. 如需写审查依据，请使用“公司付款条件要求（1.3）”“公司知识产权要求（2.7）”“公司审核流程第4阶段要求”这类业务表达。',
          ]
        : [
            '补充要求：',
            '7. 本轮是 AI 补充快审，只允许判断当前 checks 中列出的条目。',
            '8. additionalFindings 必须返回空数组，不要补充 checks 之外的新风险。',
          ]),
      '请严格根据“当前检查组”“结构化事实”“审核标准摘录”和“合同片段”执行审查，程序侧硬规则仅作为降级兜底，不参与本轮主判断。',
      '必须遵守以下要求：',
      '1. 只允许输出当前检查组内的 checkId。',
      '2. results 中应尽量覆盖当前组全部 checkId；如果没有充分依据，result 填 NO_HIT。',
      '3. result=NO_HIT 时，quote 与 locator 返回空字符串，reason 填“未发现充分依据”。',
      '4. result=HIT 时，quote 必须直接摘自合同片段原文，locator 必须复用片段定位。',
      '5. riskLevel 和 isVeto 必须与检查项定义保持一致，不要自行改级别。',
      '6. suggestion 必须使用中文，且要能直接指导商务人员修改。',
      '7. 不要在任何字段中提及内部文件名、研发流程名、提示词、规则装配方式或“根据某个 md 文件”之类的话。',
      '',
      `合同标题：${input.documentSnapshot.title}`,
      `合同摘要：${input.documentSnapshot.summary}`,
      `审核标准：${input.packSnapshot.packTitle} ${input.packSnapshot.packVersion}`,
      `当前检查组：${reviewGroup.group}`,
      `适用合同类型：${input.packSnapshot.selectedContractTypes.join('、')}`,
      `结构化事实摘要：${input.factExtraction.summary}`,
      '',
      '当前组结构化事实：',
      ...(factLines.length > 0 ? factLines : ['- 未提取到与当前检查组强相关的结构化事实']),
      ...(templateMatchLines.length > 0 || templateSlotLines.length > 0
        ? [
            '',
            '标准模板识别：',
            ...templateMatchLines,
            '',
            '关键模板槽位：',
            ...(templateSlotLines.length > 0
              ? templateSlotLines
              : ['- 已命中标准模板，但暂未识别到异常槽位。']),
          ]
        : []),
      '',
      '当前组检查项：',
      ...checkLines,
      ...(includeAdditionalFindings
        ? [
            '',
            '审核要求原文摘录：',
            ...(requirementsLines.length > 0
              ? requirementsLines
              : ['- 未找到与当前审核组直接相关的公司审查规则摘录，请仍以全文规范为准审查。']),
            '',
            '审核流程原文摘录：',
            ...(workflowLines.length > 0
              ? workflowLines
              : ['- 未找到与当前审核组直接相关的公司审核流程摘录，请仅在有合同原文依据时输出补充发现。']),
          ]
        : []),
      '',
      '合同片段：',
      ...(fragmentLines.length > 0 ? fragmentLines : ['- 未筛选到高相关片段，请谨慎判断并优先返回 NO_HIT']),
    ].join('\n');
  }

  /**
   * 读取项目内维护的正式合同审核提示词，并作为分组审查的统一基线。
   *
   * 若本地文件缺失，则回退到技能包内的 planner / reviewer，避免直接阻断审核流程。
   */
  private getFormalPromptTemplate(
    input: ContractReviewAiReviewInput,
  ): string {
    if (this.formalPromptTemplateCache) {
      return this.formalPromptTemplateCache;
    }

    const promptPath = join(
      this.localRuntimeConfigService.getRepoRoot(),
      '智能合同审核系统相关资料',
      '合同审核提示词.md',
    );

    try {
      if (existsSync(promptPath)) {
        const content = readFileSync(promptPath, 'utf8').trim();
        if (content) {
          this.formalPromptTemplateCache = content;
          return content;
        }
      }
    } catch (error) {
      this.analysisLoggerService.logWarn('读取正式合同审核提示词失败，已回退到技能包提示词。', {
        promptPath,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const fallbackPrompt = [input.promptSet.planner, input.promptSet.reviewer]
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .join('\n\n')
      .trim();

    this.formalPromptTemplateCache = fallbackPrompt;
    return fallbackPrompt;
  }

  /**
   * 将参考资料摘录中的内部文件名改写为业务可读表达，避免模型继续复述研发文件名。
   */
  private rewriteReferenceContextLine(
    line: string,
    sourceType: 'requirements' | 'workflow',
  ): string {
    const normalizedLine = this.sanitizeBusinessReadableText(line);
    const sourceLabel =
      sourceType === 'requirements' ? '公司审查规则' : '公司审核流程';

    return normalizedLine.replace(
      new RegExp(`\\[(?:${sourceType}(?:\\.md)?)\\]`, 'ig'),
      `[${sourceLabel}]`,
    );
  }

  private buildReferenceContextLines(
    markdownContent: string,
    reviewGroup: ContractReviewAiGroupReviewInput,
    maxChars: number,
  ): string[] {
    const sections = this.pickRelevantMarkdownSections(markdownContent, reviewGroup);
    if (sections.length === 0) {
      return [];
    }

    const lines: string[] = [];
    let totalLength = 0;

    for (const section of sections) {
      if (lines.length >= 3 || totalLength >= maxChars) {
        break;
      }

      const remaining = maxChars - totalLength;
      const normalizedBody = section.body.replace(/\s+/g, ' ').trim();
      const sectionText = normalizedBody
        ? `[${section.heading}] ${normalizedBody}`
        : `[${section.heading}]`;
      const snippet =
        sectionText.length > remaining
          ? `${sectionText.slice(0, Math.max(remaining - 1, 0)).trim()}…`
          : sectionText;

      if (!snippet) {
        continue;
      }

      lines.push(`- ${snippet}`);
      totalLength += snippet.length;
    }

    return lines;
  }

  private pickRelevantMarkdownSections(
    markdownContent: string,
    reviewGroup: ContractReviewAiGroupReviewInput,
  ): ContractReviewMarkdownSection[] {
    const sections = this.splitMarkdownIntoSections(markdownContent);
    if (sections.length === 0) {
      return [];
    }

    const keywords = [
      ...new Set(
        [
          reviewGroup.group,
          ...reviewGroup.checks.flatMap((check) => [
            check.group,
            check.category,
            check.title,
            check.sourceClause,
            ...check.keywords,
          ]),
        ]
          .map((value) => value.trim())
          .filter((value) => value.length >= 2),
      ),
    ];

    const scoredSections = sections
      .map((section, index) => ({
        section,
        index,
        score: keywords.reduce((score, keyword) => {
          let nextScore = score;
          if (section.heading.includes(keyword)) {
            nextScore += 3;
          }
          if (section.body.includes(keyword)) {
            nextScore += 1;
          }

          return nextScore;
        }, 0),
      }))
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return left.index - right.index;
      });

    const matchedSections = scoredSections
      .filter((item) => item.score > 0)
      .slice(0, 4)
      .map((item) => item.section);

    if (matchedSections.length > 0) {
      return matchedSections;
    }

    return sections.slice(0, 2);
  }

  private splitMarkdownIntoSections(markdownContent: string): ContractReviewMarkdownSection[] {
    const lines = markdownContent.split(/\r?\n/);
    const sections: ContractReviewMarkdownSection[] = [];
    let currentHeading = '概述';
    let currentBodyLines: string[] = [];

    const pushSection = () => {
      const body = currentBodyLines.join('\n').trim();
      if (!currentHeading && !body) {
        return;
      }

      sections.push({
        heading: currentHeading || '未命名章节',
        body,
      });
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (/^#{1,6}\s+/.test(line)) {
        pushSection();
        currentHeading = line.replace(/^#{1,6}\s+/, '').trim() || '未命名章节';
        currentBodyLines = [];
        continue;
      }

      if (line === '---') {
        continue;
      }

      currentBodyLines.push(rawLine.trimEnd());
    }

    pushSection();

    return sections.filter((section) => section.heading || section.body);
  }

  /**
   * 分组审查时优先给模型最相关的片段，避免把整份合同一次性送进去导致噪音和误判上升。
   */
  private pickGroupReviewFragments(
    documentSnapshot: ContractReviewDocumentSnapshot,
    factExtraction: ContractReviewFactExtractionResult,
    reviewGroup: ContractReviewAiGroupReviewInput,
  ): ContractReviewDocumentFragment[] {
    const prioritizedLocators = new Set([
      ...this.collectRelevantFactLocators(factExtraction, reviewGroup),
      ...this.collectTemplateSlotLocators(factExtraction),
    ]);
    const reviewKeywords = [
      reviewGroup.group,
      ...reviewGroup.checks.flatMap((check) => [check.category, check.title, ...check.keywords]),
    ].filter(Boolean);

    const fragments = [
      ...documentSnapshot.clauses.filter((fragment) => prioritizedLocators.has(fragment.locator)),
      ...documentSnapshot.paragraphs.filter((fragment) =>
        prioritizedLocators.has(fragment.locator),
      ),
      ...documentSnapshot.clauses.filter((fragment) =>
        reviewKeywords.some((keyword) => fragment.text.includes(keyword)),
      ),
      ...documentSnapshot.headings.filter((fragment) =>
        reviewKeywords.some((keyword) => fragment.text.includes(keyword)),
      ),
      ...documentSnapshot.paragraphs.filter((fragment) =>
        reviewKeywords.some((keyword) => fragment.text.includes(keyword)),
      ),
      ...documentSnapshot.clauses,
      ...documentSnapshot.paragraphs,
    ];

    const selected: ContractReviewDocumentFragment[] = [];
    const seen = new Set<string>();
    let totalLength = 0;

    for (const fragment of fragments) {
      const uniqueKey = `${fragment.locator}:${fragment.text}`;
      if (seen.has(uniqueKey)) {
        continue;
      }

      if (selected.length >= 18 || totalLength >= 5000) {
        break;
      }

      seen.add(uniqueKey);
      selected.push(fragment);
      totalLength += fragment.text.length;
    }

    return selected;
  }

  private buildGroupFactLines(
    factExtraction: ContractReviewFactExtractionResult,
    reviewGroup: ContractReviewAiGroupReviewInput,
  ): string[] {
    const factLines: string[] = [];

    if (this.matchReviewTopic(reviewGroup, ['付款', '回款'])) {
      factLines.push(
        ...factExtraction.paymentFacts.map(
          (fact) =>
            `- [${fact.locator}] 阶段=${fact.stage}，账期=${
              fact.days !== undefined ? `${fact.days}天` : '未识别'
            }，比例=${fact.percentage !== undefined ? `${fact.percentage}%` : '未识别'}`,
        ),
      );
    }

    if (this.matchReviewTopic(reviewGroup, ['票税', '开票', '税率', '结算'])) {
      factLines.push(
        ...factExtraction.taxRateFacts.map(
          (fact) => `- [${fact.locator}] 税率=${fact.taxRate}% 类型=${fact.kind}`,
        ),
        ...factExtraction.invoiceFacts.map(
          (fact) =>
            `- [${fact.locator}] 发票类型=${fact.invoiceType}，软件前缀=${
              fact.hasSoftwarePrefix ? '是' : '否'
            }，名称=${fact.invoiceName ?? '未识别'}`,
        ),
      );
    }

    if (this.matchReviewTopic(reviewGroup, ['违约', '责任'])) {
      factLines.push(
        ...factExtraction.penaltyFacts.map(
          (fact) =>
            `- [${fact.locator}] 日违约率=${
              fact.dailyRatePermille !== undefined ? `千分之${fact.dailyRatePermille}` : '未识别'
            }，责任上限=${
              fact.capPercent !== undefined ? `${fact.capPercent}%` : '未识别'
            }，无限责任=${fact.unlimitedLiability ? '是' : '否'}`,
        ),
      );
    }

    if (this.matchReviewTopic(reviewGroup, ['知识产权', '许可'])) {
      factLines.push(
        ...factExtraction.intellectualPropertyFacts.map(
          (fact) =>
            `- [${fact.locator}] 权属=${fact.ownership}，独占措辞=${
              fact.hasExclusiveLanguage ? '是' : '否'
            }，允许逆向工程=${fact.allowsReverseEngineering ? '是' : '否'}`,
        ),
        ...factExtraction.licenseDeliveryFacts.map(
          (fact) =>
            `- [${fact.locator}] 临时许可=${fact.mentionsTemporaryLicense ? '是' : '否'}，永久许可=${
              fact.mentionsPermanentLicense ? '是' : '否'
            }，全款门槛=${fact.mentionsFullPaymentRequired ? '是' : '否'}，提前交付=${
              fact.mentionsAdvanceDelivery ? '是' : '否'
            }`,
        ),
      );
    }

    if (this.matchReviewTopic(reviewGroup, ['交付', '验收'])) {
      factLines.push(
        ...factExtraction.licenseDeliveryFacts.map(
          (fact) =>
            `- [${fact.locator}] 临时许可=${fact.mentionsTemporaryLicense ? '是' : '否'}，永久许可=${
              fact.mentionsPermanentLicense ? '是' : '否'
            }，全款门槛=${fact.mentionsFullPaymentRequired ? '是' : '否'}，提前交付=${
              fact.mentionsAdvanceDelivery ? '是' : '否'
            }`,
        ),
      );
    }

    if (this.matchReviewTopic(reviewGroup, ['维保', '服务周期', '服务'])) {
      factLines.push(
        ...factExtraction.amountFacts.map(
          (fact) => `- [${fact.locator}] ${fact.label}=${fact.amount}元`,
        ),
      );
    }

    if (factLines.length === 0) {
      factLines.push(
        ...factExtraction.amountFacts.map(
          (fact) => `- [${fact.locator}] ${fact.label}=${fact.amount}元`,
        ),
        ...factExtraction.paymentFacts.map(
          (fact) => `- [${fact.locator}] 付款阶段=${fact.stage}`,
        ),
      );
    }

    return [...new Set(factLines)].slice(0, 12);
  }

  private buildTemplateMatchLines(
    factExtraction: ContractReviewFactExtractionResult,
  ): string[] {
    return factExtraction.templateMatchFacts.map(
      (fact) =>
        `- 模板=${fact.templateLabel}，得分=${fact.score}，命中特征=${fact.signals.join('、')}`,
    );
  }

  private buildTemplateSlotLines(
    factExtraction: ContractReviewFactExtractionResult,
  ): string[] {
    return factExtraction.templateSlotFacts
      .filter((fact) => fact.status !== 'FILLED' && fact.status !== 'PRESENT')
      .map((fact) => {
        const valueText = fact.value ? `，取值=${fact.value}` : '';
        const noteText = fact.note ? `，说明=${fact.note}` : '';
        return `- [${fact.locator}] ${fact.slotLabel}：状态=${this.resolveTemplateSlotStatusLabel(
          fact.status,
        )}${valueText}${noteText}`;
      });
  }

  private resolveTemplateSlotStatusLabel(status: string): string {
    switch (status) {
      case 'PLACEHOLDER':
        return '仍为模板占位';
      case 'MISSING':
        return '缺失';
      case 'AMBIGUOUS':
        return '待收敛';
      case 'PRESENT':
        return '已保留';
      case 'FILLED':
        return '已填写';
      default:
        return status;
    }
  }

  private collectTemplateSlotLocators(
    factExtraction: ContractReviewFactExtractionResult,
  ): string[] {
    return factExtraction.templateSlotFacts
      .filter(
        (fact) =>
          fact.status !== 'FILLED' &&
          fact.status !== 'PRESENT' &&
          Boolean(fact.locator) &&
          fact.locator !== '全文',
      )
      .map((fact) => fact.locator);
  }

  private collectRelevantFactLocators(
    factExtraction: ContractReviewFactExtractionResult,
    reviewGroup: ContractReviewAiGroupReviewInput,
  ): string[] {
    const locators: string[] = [];

    if (this.matchReviewTopic(reviewGroup, ['付款', '回款'])) {
      locators.push(...factExtraction.paymentFacts.map((fact) => fact.locator));
    }

    if (this.matchReviewTopic(reviewGroup, ['票税', '开票', '税率', '结算'])) {
      locators.push(
        ...factExtraction.taxRateFacts.map((fact) => fact.locator),
        ...factExtraction.invoiceFacts.map((fact) => fact.locator),
      );
    }

    if (this.matchReviewTopic(reviewGroup, ['违约', '责任'])) {
      locators.push(...factExtraction.penaltyFacts.map((fact) => fact.locator));
    }

    if (this.matchReviewTopic(reviewGroup, ['知识产权', '许可'])) {
      locators.push(
        ...factExtraction.intellectualPropertyFacts.map((fact) => fact.locator),
        ...factExtraction.licenseDeliveryFacts.map((fact) => fact.locator),
      );
    }

    if (this.matchReviewTopic(reviewGroup, ['交付', '验收'])) {
      locators.push(...factExtraction.licenseDeliveryFacts.map((fact) => fact.locator));
    }

    if (locators.length === 0) {
      locators.push(
        ...factExtraction.amountFacts.map((fact) => fact.locator),
        ...factExtraction.paymentFacts.map((fact) => fact.locator),
      );
    }

    return [...new Set(locators)];
  }

  private matchReviewTopic(
    reviewGroup: ContractReviewAiGroupReviewInput,
    keywords: string[],
  ): boolean {
    const searchText = [
      reviewGroup.group,
      ...reviewGroup.checks.flatMap((check) => [
        check.group,
        check.category,
        check.title,
        ...check.keywords,
      ]),
    ].join(' ');

    return keywords.some((keyword) => searchText.includes(keyword));
  }

  private buildGroupOutputSchema(
    reviewGroup: ContractReviewAiGroupReviewInput,
  ): Record<string, unknown> {
    const supplementalFindingSchema = {
      type: 'object',
      additionalProperties: false,
      required: [
        'title',
        'riskLevel',
        'isVeto',
        'quote',
        'locator',
        'reason',
        'suggestion',
        'confidence',
        'sourceClause',
        'requirementTopic',
      ],
      properties: {
        title: { type: 'string' },
        riskLevel: {
          type: 'string',
          enum: ['LOW', 'MEDIUM', 'HIGH'],
        },
        isVeto: { type: 'boolean' },
        quote: { type: 'string' },
        locator: { type: 'string' },
        reason: { type: 'string' },
        suggestion: { type: 'string' },
        confidence: {
          type: 'string',
          enum: ['HIGH', 'MEDIUM', 'LOW'],
        },
        sourceClause: { type: 'string' },
        requirementTopic: { type: 'string' },
      },
    } as const;

    return {
      type: 'object',
      additionalProperties: false,
      required: ['group', 'results', 'additionalFindings'],
      properties: {
        group: {
          type: 'string',
          enum: [reviewGroup.group],
        },
        results: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: [
              'checkId',
              'result',
              'riskLevel',
              'isVeto',
              'quote',
              'locator',
              'reason',
              'suggestion',
              'confidence',
            ],
            properties: {
              checkId: {
                type: 'string',
                enum: reviewGroup.checks.map((check) => check.code),
              },
              result: {
                type: 'string',
                enum: ['HIT', 'NO_HIT'],
              },
              riskLevel: {
                type: 'string',
                enum: ['LOW', 'MEDIUM', 'HIGH'],
              },
              isVeto: { type: 'boolean' },
              quote: { type: 'string' },
              locator: { type: 'string' },
              reason: { type: 'string' },
              suggestion: { type: 'string' },
              confidence: {
                type: 'string',
                enum: ['HIGH', 'MEDIUM', 'LOW'],
              },
              // 兼容部分模型把 supplemental findings 错误挂到单条 result 下的情况；
              // 归一化阶段不会消费该字段，但允许其存在以避免整批审核失败。
              additionalFindings: {
                type: 'array',
                items: supplementalFindingSchema,
              },
            },
          },
        },
        additionalFindings: {
          type: 'array',
          items: supplementalFindingSchema,
        },
      },
    };
  }

  private normalizeGroupReviewResult(
    reviewGroup: ContractReviewAiGroupReviewInput,
    rawResult: ContractReviewAiStructuredGroupResult,
  ): ContractReviewAiNormalizedGroupResult {
    const checkMap = new Map(reviewGroup.checks.map((check) => [check.code, check] as const));
    const normalizedMap = new Map<string, ContractReviewAiStructuredCheckResult>();

    for (const item of rawResult.results ?? []) {
      const check = checkMap.get(item.checkId);
      if (!check || normalizedMap.has(check.code)) {
        continue;
      }

      const normalizedResult: ContractReviewAiStructuredCheckResult = {
        checkId: check.code,
        result: item.result === 'HIT' ? 'HIT' : 'NO_HIT',
        riskLevel: check.riskLevel,
        isVeto: check.isVeto,
        quote: this.normalizeFreeText(item.quote),
        locator: this.normalizeFreeText(item.locator),
        reason: this.sanitizeBusinessReadableText(
          this.normalizeFreeText(item.reason) ||
            (item.result === 'HIT' ? check.description : '未发现充分依据'),
        ),
        suggestion: this.sanitizeBusinessReadableText(
          this.normalizeFreeText(item.suggestion) ||
            (item.result === 'HIT' ? check.suggestion : ''),
        ),
        confidence: this.normalizeConfidence(item.confidence),
      };

      normalizedMap.set(check.code, normalizedResult);
    }

    const results: ContractReviewAiStructuredCheckResult[] = reviewGroup.checks.map((check) => {
      const normalized = normalizedMap.get(check.code);
      if (normalized) {
        return normalized;
      }

      return {
        checkId: check.code,
        result: 'NO_HIT' as const,
        riskLevel: check.riskLevel,
        isVeto: check.isVeto,
        quote: '',
        locator: '',
        reason: '未发现充分依据',
        suggestion: '',
        confidence: 'LOW' as const,
      };
    });

    return {
      results,
      additionalFindings: this.normalizeSupplementalFindings(rawResult.additionalFindings),
    };
  }

  private normalizeSupplementalFindings(
    findings: ContractReviewAiStructuredSupplementalResult[] | undefined,
  ): ContractReviewAiStructuredSupplementalResult[] {
    const normalizedFindings: ContractReviewAiStructuredSupplementalResult[] = [];
    const seen = new Set<string>();

    for (const item of findings ?? []) {
      const title = this.sanitizeBusinessReadableText(this.normalizeFreeText(item.title));
      const locator = this.normalizeFreeText(item.locator);
      const quote = this.normalizeFreeText(item.quote);
      const reason = this.sanitizeBusinessReadableText(this.normalizeFreeText(item.reason));
      const sourceClause = this.sanitizeBusinessReadableText(
        this.normalizeFreeText(item.sourceClause),
      );

      if (!title || !locator || !quote || !reason || !sourceClause) {
        continue;
      }

      const signature = `${title}::${locator}::${quote}::${sourceClause}`;
      if (seen.has(signature)) {
        continue;
      }

      seen.add(signature);
      normalizedFindings.push({
        title,
        riskLevel: this.normalizeRiskLevel(item.riskLevel, item.isVeto),
        isVeto: Boolean(item.isVeto),
        quote,
        locator,
        reason,
        suggestion: this.sanitizeBusinessReadableText(
          this.normalizeFreeText(item.suggestion) || '请结合公司审核要求补充修订。',
        ),
        confidence: this.normalizeConfidence(item.confidence),
        sourceClause,
        requirementTopic:
          this.sanitizeBusinessReadableText(this.normalizeFreeText(item.requirementTopic)) ||
          undefined,
      });
    }

    return normalizedFindings;
  }

  private normalizeFreeText(value: string | undefined): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  /**
   * 将模型输出中的内部文件引用、流程实现痕迹改写为业务人员可直接阅读的表达。
   */
  private sanitizeBusinessReadableText(value: string): string {
    if (!value) {
      return value;
    }

    const formatRequirementReference = (clauseNo: string, topic: string): string => {
      const normalizedTopic = topic.trim();
      if (normalizedTopic) {
        return normalizedTopic.endsWith('要求')
          ? `公司${normalizedTopic}（${clauseNo}）`
          : `公司${normalizedTopic}要求（${clauseNo}）`;
      }

      return `公司审查规则第${clauseNo}条要求`;
    };

    let normalized = value
      .replace(/\brequirements(?:\.md)?\b/gi, '公司审查规则')
      .replace(/\bworkflow(?:\.md)?\b/gi, '公司审核流程')
      .replace(/\bchecks(?:\.json)?\b/gi, '本次检查项');

    normalized = normalized.replace(
      /([根依]据)公司审核流程\s*阶段\s*([0-9一二三四五六七八九十]+)\s*要求/g,
      '$1公司审核流程第$2阶段要求',
    );

    normalized = normalized.replace(
      /([根依]据)公司审查规则\s*([0-9]+(?:\.[0-9]+)?)\s*([^\s，。；、：:]*)/g,
      (_match, prefix: string, clauseNo: string, topic: string) => {
        return `${prefix}${formatRequirementReference(clauseNo, topic)}`;
      },
    );

    normalized = normalized.replace(
      /公司审查规则\s*([0-9]+(?:\.[0-9]+)?)\s*([^\s，。；、：:]*)/g,
      (_match, clauseNo: string, topic: string) =>
        formatRequirementReference(clauseNo, topic),
    );

    normalized = normalized.replace(
      /公司审核流程\s*阶段\s*([0-9一二三四五六七八九十]+)\s*要求/g,
      '公司审核流程第$1阶段要求',
    );

    return normalized.trim();
  }

  private normalizeRiskLevel(
    value: RiskLevel | undefined,
    isVeto?: boolean,
  ): RiskLevel {
    if (value === 'HIGH' || value === 'MEDIUM' || value === 'LOW') {
      return value;
    }

    return isVeto ? 'HIGH' : 'MEDIUM';
  }

  private normalizeConfidence(
    value: string | undefined,
  ): ContractReviewAiConfidence {
    if (value === 'HIGH' || value === 'MEDIUM' || value === 'LOW') {
      return value;
    }

    return 'MEDIUM';
  }

  private async importCodexSdk(): Promise<RemovedCodexSdkModule> {
    throw new Error('旧 Codex SDK 运行时已移除，请通过统一 AI 执行门面调用。');
  }

  private async runGroupedCodexReviewPrompts(
    config: Pick<
      AiRuntimeConfig,
      | 'sdkType'
      | 'apiKey'
      | 'baseUrl'
      | 'model'
      | 'modelProvider'
      | 'timeoutMs'
      | 'reasoningEffort'
      | 'wireApi'
      | 'requiresOpenaiAuth'
      | 'disableResponseStorage'
      | 'codexPath'
      | 'proxyEnv'
    >,
    input: ContractReviewAiReviewInput,
    reviewGroups: ContractReviewAiGroupReviewInput[],
    options: Pick<
      ContractReviewAiExecutionOptions,
      'logLabel' | 'reviewTimeoutMs' | 'maxParallelGroups' | 'includeAdditionalFindings'
    > = {
      logLabel: '合同审核 AI 审查',
      reviewTimeoutMs: this.contractReviewConfigService.getAiReviewTimeoutMs(),
      maxParallelGroups: this.contractReviewConfigService.getAiMaxParallelGroups(),
      includeAdditionalFindings: true,
    },
  ): Promise<ContractReviewAiIssueCandidate[]> {
    const previousQueue = this.reviewQueue;
    let releaseQueue!: () => void;
    this.reviewQueue = new Promise<void>((resolve) => {
      releaseQueue = resolve;
    });

    await previousQueue;

    const previousWorkingDirectory = process.cwd();
    const backendWorkingDirectory = join(
      this.localRuntimeConfigService.getRepoRoot(),
      'backend',
    );
    const effectiveWorkingDirectory = existsSync(backendWorkingDirectory)
      ? backendWorkingDirectory
      : previousWorkingDirectory;
    const reviewTimeoutMs = options.reviewTimeoutMs;
    const maxParallelGroups = Math.min(options.maxParallelGroups, reviewGroups.length);
    const reviewStartedAt = Date.now();

    try {
      process.chdir(effectiveWorkingDirectory);
      try {
        const hits = await this.runReviewGroupsWithUnifiedExecution(
          config,
          input,
          reviewGroups,
          options,
          effectiveWorkingDirectory,
          reviewStartedAt,
        );
        return hits;
      } catch (error) {
        if (!this.shouldFallbackToLegacyCodex(error)) {
          throw error;
        }
      }

      const sdkModule = await this.importCodexSdk();
      const codex = new sdkModule.Codex(this.buildCodexClientOptions(config));

      const groupResults = await this.runReviewGroupsWithConcurrency(
        codex,
        config,
        input,
        reviewGroups,
        reviewTimeoutMs,
        maxParallelGroups,
        options.includeAdditionalFindings,
        options.logLabel,
      );

      const firstRejectedResult = groupResults.find(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      );
      if (firstRejectedResult) {
        throw firstRejectedResult.reason;
      }

      const hits: ContractReviewAiIssueCandidate[] = [];
      let supplementalFindingIndex = 0;
      const supplementalSignatures = new Set<string>();
      for (const groupResult of groupResults) {
        if (groupResult.status !== 'fulfilled') {
          continue;
        }

        hits.push(...groupResult.value.checkHits);
        for (const { group, finding } of groupResult.value.supplementalFindings) {
          const signature = `${finding.title}::${finding.locator}::${finding.quote}::${finding.sourceClause}`;
          if (supplementalSignatures.has(signature)) {
            continue;
          }

          supplementalSignatures.add(signature);
          supplementalFindingIndex += 1;
          hits.push({
            reviewType: 'SUPPLEMENTAL',
            ruleCode: this.buildSupplementalRuleCode(supplementalFindingIndex),
            group,
            title: finding.title,
            sourceClause: finding.sourceClause,
            locator: finding.locator,
            quote: finding.quote,
            reason: finding.reason,
            suggestion: finding.suggestion,
            confidence: finding.confidence,
            riskLevel: finding.riskLevel,
            isVeto: finding.isVeto,
            analysis: finding.reason,
          });
        }
      }

      this.analysisLoggerService.logStep(`${options.logLabel}完成。`, {
        reviewGroupCount: reviewGroups.reduce(
          (count, batch) => count + new Set(batch.checks.map((check) => check.group)).size,
          0,
        ),
        executionBatchCount: reviewGroups.length,
        maxParallelGroups,
        issueHitCount: hits.filter((item) => item.reviewType !== 'SUPPLEMENTAL').length,
        supplementalFindingCount: hits.filter((item) => item.reviewType === 'SUPPLEMENTAL')
          .length,
        durationMs: Date.now() - reviewStartedAt,
      });
      return hits;
    } finally {
      process.chdir(previousWorkingDirectory);
      releaseQueue();
    }
  }

  private async runReviewGroupsWithUnifiedExecution<T extends object>(
    config: T & { sdkType?: AiRuntimeConfig['sdkType'] },
    input: ContractReviewAiReviewInput,
    reviewGroups: ContractReviewAiGroupReviewInput[],
    options: Pick<
      ContractReviewAiExecutionOptions,
      'logLabel' | 'reviewTimeoutMs' | 'maxParallelGroups' | 'includeAdditionalFindings'
    >,
    effectiveWorkingDirectory: string,
    reviewStartedAt: number,
  ): Promise<ContractReviewAiIssueCandidate[]> {
    const groupResults = await Promise.all(
      reviewGroups.map(async (reviewGroup, index) => {
        const groupStartedAt = Date.now();
        this.analysisLoggerService.logStep(`${options.logLabel}分组开始。`, {
          group: reviewGroup.group,
          groupIndex: index + 1,
          reviewGroupCount: reviewGroups.length,
          checkCount: reviewGroup.checks.length,
          timeoutMs: options.reviewTimeoutMs,
          maxParallelGroups: Math.min(options.maxParallelGroups, reviewGroups.length),
          activeGroupCount: 1,
          queuedGroupCount: Math.max(reviewGroups.length - index - 1, 0),
        });

        try {
          const groupPrompt = this.buildGroupPrompt(
            input,
            reviewGroup,
            options.includeAdditionalFindings,
          );
          const outputSchema = this.buildGroupOutputSchema(reviewGroup);
          this.recordReviewGroupDebugSnapshot(
            input,
            config,
            options,
            reviewGroup,
            groupPrompt,
            outputSchema,
          );
          const parsed = (await this.invokeUnifiedStructured(
            config,
            groupPrompt,
            outputSchema,
            effectiveWorkingDirectory,
          )) as ContractReviewAiStructuredGroupResult;
          const normalizedResults = this.normalizeGroupReviewResult(reviewGroup, parsed);
          const checkHits = normalizedResults.results
            .filter(
              (item) => item.result === 'HIT' && item.quote.trim() && item.locator.trim(),
            )
            .map((item) => {
              const matchedCheck = reviewGroup.checks.find(
                (check) => check.code === item.checkId,
              );

              return {
                reviewType: 'CHECK' as const,
                ruleCode: item.checkId,
                group: matchedCheck?.group ?? reviewGroup.group,
                locator: item.locator,
                quote: item.quote,
                reason: item.reason,
                suggestion: item.suggestion,
                confidence: item.confidence,
                riskLevel: item.riskLevel,
                isVeto: item.isVeto,
                analysis: item.reason,
              };
            });

          this.analysisLoggerService.logStep(`${options.logLabel}分组完成。`, {
            group: reviewGroup.group,
            groupIndex: index + 1,
            reviewGroupCount: reviewGroups.length,
            checkCount: reviewGroup.checks.length,
            hitCount: checkHits.length,
            supplementalFindingCount: normalizedResults.additionalFindings.length,
            durationMs: Date.now() - groupStartedAt,
          });

          return {
            checkHits,
            supplementalFindings: normalizedResults.additionalFindings.map((finding) => ({
              group: reviewGroup.group,
              finding,
            })),
          };
        } catch (error) {
          this.markReviewDebugFailure(error, error instanceof Error ? error.message : 'unknown', reviewGroup.group);
          this.analysisLoggerService.logWarn(`${options.logLabel}分组失败。`, {
            group: reviewGroup.group,
            groupIndex: index + 1,
            reviewGroupCount: reviewGroups.length,
            checkCount: reviewGroup.checks.length,
            durationMs: Date.now() - groupStartedAt,
            timeoutMs: options.reviewTimeoutMs,
            failureType: this.resolveGroupFailureType(error, reviewGroup.group),
            reason: error instanceof Error ? error.message : 'unknown',
          });
          throw error;
        }
      }),
    );

    const hits: ContractReviewAiIssueCandidate[] = [];
    let supplementalFindingIndex = 0;
    const supplementalSignatures = new Set<string>();
    for (const groupResult of groupResults) {
      hits.push(...groupResult.checkHits);
      for (const { group, finding } of groupResult.supplementalFindings) {
        const signature = `${finding.title}::${finding.locator}::${finding.quote}::${finding.sourceClause}`;
        if (supplementalSignatures.has(signature)) {
          continue;
        }

        supplementalSignatures.add(signature);
        supplementalFindingIndex += 1;
        hits.push({
          reviewType: 'SUPPLEMENTAL',
          ruleCode: this.buildSupplementalRuleCode(supplementalFindingIndex),
          group,
          title: finding.title,
          sourceClause: finding.sourceClause,
          locator: finding.locator,
          quote: finding.quote,
          reason: finding.reason,
          suggestion: finding.suggestion,
          confidence: finding.confidence,
          riskLevel: finding.riskLevel,
          isVeto: finding.isVeto,
          analysis: finding.reason,
        });
      }
    }

    this.analysisLoggerService.logStep(`${options.logLabel}完成。`, {
      reviewGroupCount: reviewGroups.reduce(
        (count, batch) => count + new Set(batch.checks.map((check) => check.group)).size,
        0,
      ),
      executionBatchCount: reviewGroups.length,
      maxParallelGroups: Math.min(options.maxParallelGroups, reviewGroups.length),
      issueHitCount: hits.filter((item) => item.reviewType !== 'SUPPLEMENTAL').length,
      supplementalFindingCount: hits.filter((item) => item.reviewType === 'SUPPLEMENTAL')
        .length,
      durationMs: Date.now() - reviewStartedAt,
    });

    return hits;
  }

  private async runReviewGroupsWithConcurrency(
    codex: RemovedCodexClient,
    config: Pick<AiRuntimeConfig, 'model' | 'reasoningEffort'>,
    input: ContractReviewAiReviewInput,
    reviewGroups: ContractReviewAiGroupReviewInput[],
    reviewTimeoutMs: number,
    maxParallelGroups: number,
    includeAdditionalFindings = true,
    logLabel = '合同审核 AI 审查',
  ): Promise<Array<PromiseSettledResult<ContractReviewAiGroupExecutionResult>>> {
    const results: Array<
      PromiseSettledResult<ContractReviewAiGroupExecutionResult> | undefined
    > = new Array(reviewGroups.length);
    let nextGroupIndex = 0;
    let inFlightGroupCount = 0;
    let shouldStopScheduling = false;

    const workers = Array.from({ length: maxParallelGroups }, async () => {
      while (!shouldStopScheduling) {
        const currentGroupIndex = nextGroupIndex;
        if (currentGroupIndex >= reviewGroups.length) {
          return;
        }

        nextGroupIndex += 1;
        inFlightGroupCount += 1;
        const activeGroupCount = inFlightGroupCount;
        const queuedGroupCount = Math.max(reviewGroups.length - nextGroupIndex, 0);

        try {
          const value = await this.runReviewGroup(
            codex,
            config,
            input,
            reviewGroups[currentGroupIndex],
            currentGroupIndex,
            reviewGroups.length,
            reviewTimeoutMs,
            includeAdditionalFindings,
            logLabel,
            {
              maxParallelGroups,
              activeGroupCount,
              queuedGroupCount,
            },
          );
          results[currentGroupIndex] = {
            status: 'fulfilled',
            value,
          };
        } catch (error) {
          shouldStopScheduling = true;
          results[currentGroupIndex] = {
            status: 'rejected',
            reason: error,
          };
        } finally {
          inFlightGroupCount -= 1;
        }
      }
    });

    await Promise.all(workers);
    return results.filter(
      (
        result,
      ): result is PromiseSettledResult<ContractReviewAiGroupExecutionResult> =>
        result !== undefined,
    );
  }

  private async runReviewGroup(
    codex: RemovedCodexClient,
    config: Pick<AiRuntimeConfig, 'model' | 'reasoningEffort'>,
    input: ContractReviewAiReviewInput,
    reviewGroup: ContractReviewAiGroupReviewInput,
    groupIndex: number,
    reviewGroupCount: number,
    reviewTimeoutMs: number,
    includeAdditionalFindings = true,
    logLabel = '合同审核 AI 审查',
    runtimeSnapshot: {
      maxParallelGroups: number;
      activeGroupCount: number;
      queuedGroupCount: number;
    },
  ): Promise<ContractReviewAiGroupExecutionResult> {
    const groupStartedAt = Date.now();
    this.analysisLoggerService.logStep(`${logLabel}分组开始。`, {
      group: reviewGroup.group,
      groupIndex: groupIndex + 1,
      reviewGroupCount,
      checkCount: reviewGroup.checks.length,
      timeoutMs: reviewTimeoutMs,
      maxParallelGroups: runtimeSnapshot.maxParallelGroups,
      activeGroupCount: runtimeSnapshot.activeGroupCount,
      queuedGroupCount: runtimeSnapshot.queuedGroupCount,
    });

    try {
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

      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      const result = await Promise.race([
        thread.run(this.buildGroupPrompt(input, reviewGroup, includeAdditionalFindings), {
          outputSchema: this.buildGroupOutputSchema(reviewGroup),
        }),
        new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(
            () => reject(new Error(`合同审核 AI 编排超时：${reviewGroup.group}`)),
            reviewTimeoutMs,
          );
        }),
      ]).finally(() => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
      });

      const parsed = JSON.parse(result.finalResponse) as ContractReviewAiStructuredGroupResult;
      const normalizedResults = this.normalizeGroupReviewResult(reviewGroup, parsed);
      const checkHits = normalizedResults.results
        .filter(
          (item) => item.result === 'HIT' && item.quote.trim() && item.locator.trim(),
        )
        .map((item) => {
          const matchedCheck = reviewGroup.checks.find(
            (check) => check.code === item.checkId,
          );

          return {
            reviewType: 'CHECK' as const,
            ruleCode: item.checkId,
            group: matchedCheck?.group ?? reviewGroup.group,
            locator: item.locator,
            quote: item.quote,
            reason: item.reason,
            suggestion: item.suggestion,
            confidence: item.confidence,
            riskLevel: item.riskLevel,
            isVeto: item.isVeto,
            analysis: item.reason,
          };
        });

      this.analysisLoggerService.logStep(`${logLabel}分组完成。`, {
        group: reviewGroup.group,
        groupIndex: groupIndex + 1,
        reviewGroupCount,
        checkCount: reviewGroup.checks.length,
        hitCount: checkHits.length,
        supplementalFindingCount: normalizedResults.additionalFindings.length,
        durationMs: Date.now() - groupStartedAt,
      });

      return {
        checkHits,
        supplementalFindings: normalizedResults.additionalFindings.map((finding) => ({
          group: reviewGroup.group,
          finding,
        })),
      };
    } catch (error) {
      this.analysisLoggerService.logWarn(`${logLabel}分组失败。`, {
        group: reviewGroup.group,
        groupIndex: groupIndex + 1,
        reviewGroupCount,
        checkCount: reviewGroup.checks.length,
        durationMs: Date.now() - groupStartedAt,
        timeoutMs: reviewTimeoutMs,
        failureType: this.resolveGroupFailureType(error, reviewGroup.group),
        reason: error instanceof Error ? error.message : 'unknown',
      });
      throw error;
    }
  }

  private buildCodexClientOptions(
    config: Pick<
      AiRuntimeConfig,
      | 'apiKey'
      | 'baseUrl'
      | 'serviceTier'
      | 'modelProvider'
      | 'wireApi'
      | 'requiresOpenaiAuth'
      | 'disableResponseStorage'
      | 'codexPath'
      | 'proxyEnv'
    >,
  ): {
    baseUrl?: string;
    apiKey?: string;
    config?: Record<string, unknown>;
    env?: Record<string, string>;
  } {
    const configOverrides = this.buildCodexConfigOverrides(config);
    return {
      ...(config.modelProvider
        ? {}
        : config.baseUrl
          ? { baseUrl: config.baseUrl }
          : {}),
      ...(config.apiKey ? { apiKey: config.apiKey } : {}),
      ...(Object.keys(configOverrides).length > 0 ? { config: configOverrides } : {}),
      ...(config.proxyEnv ? { env: config.proxyEnv } : {}),
    };
  }

  private buildCodexConfigOverrides(
    config: Pick<
      AiRuntimeConfig,
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

    // 自建网关场景需要把 provider 元信息一并透传给本机 Codex CLI，
    // 否则 CLI 只拿到 baseUrl/model，仍可能按默认 provider 解析后回退。
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

  private resolveGroupFailureType(
    error: unknown,
    reviewGroupName: string,
  ): 'TIMEOUT' | 'ERROR' {
    if (
      error instanceof Error &&
      error.message === `合同审核 AI 编排超时：${reviewGroupName}`
    ) {
      return 'TIMEOUT';
    }

    return 'ERROR';
  }

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

  private resolveReviewReasoningEffort(
    modelProfile?: string,
    fallbackReasoningEffort?: string,
  ): string | undefined {
    const normalizedProfile = modelProfile?.trim().toLowerCase();
    if (!normalizedProfile) {
      return fallbackReasoningEffort;
    }

    if (
      normalizedProfile.endsWith('minimal') ||
      normalizedProfile.endsWith('none')
    ) {
      return 'none';
    }

    if (normalizedProfile.endsWith('low')) {
      return 'low';
    }

    if (normalizedProfile.endsWith('medium')) {
      return 'medium';
    }

    if (normalizedProfile.endsWith('xhigh')) {
      return 'xhigh';
    }

    if (normalizedProfile.endsWith('high')) {
      return 'high';
    }

    return fallbackReasoningEffort;
  }

  private buildSupplementalRuleCode(index: number): string {
    return `AI-SUPPLEMENTAL-${String(index).padStart(3, '0')}`;
  }
}

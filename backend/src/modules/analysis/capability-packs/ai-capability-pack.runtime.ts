import { Injectable, Optional } from '@nestjs/common';
import { AiRuntimeConfigResolver } from '../../ai-models/ai-runtime-config.resolver';
import { UnifiedAiExecutionService } from '../../ai-models/unified-ai-execution.service';
import { AiCapabilityPackRegistry } from './ai-capability-pack.registry';
import type {
  AiCapabilityPackExecutionResult,
  AiCapabilityPackFailureReason,
  AiCapabilityProviderContext,
  AiCapabilityProviderTuning,
  AiCapabilityRequestOverrides,
} from './ai-capability-pack.types';
import { resolveDeepSeekCapabilityTuning } from './provider-tuning/deepseek.provider';
import { resolveKimiCapabilityTuning } from './provider-tuning/kimi.provider';
import { AiCapabilityPackRolloutPolicy } from './runtime/pack-rollout.policy';
import { AnalysisSemanticKnowledgeRepository } from '../../governance/analysis-semantic-knowledge.repository';

@Injectable()
export class AiCapabilityPackRuntimeService {
  private readonly transientRetryCount = 1;

  constructor(
    private readonly aiRuntimeConfigResolver: AiRuntimeConfigResolver,
    private readonly unifiedAiExecutionService: UnifiedAiExecutionService,
    private readonly registry: AiCapabilityPackRegistry,
    private readonly rolloutPolicy: AiCapabilityPackRolloutPolicy,
    @Optional()
    private readonly knowledgeRepository?: AnalysisSemanticKnowledgeRepository,
  ) {}

  async executeStructuredPack<
    TContext,
    TRaw extends object,
    TOutput extends object,
  >(params: {
    packCode: string;
    context: TContext;
    cwd?: string;
    requestOverrides?: AiCapabilityRequestOverrides;
  }): Promise<AiCapabilityPackExecutionResult<TOutput>> {
    const pack = this.registry.getPack<TContext, TRaw, TOutput>(params.packCode);
    const config = this.aiRuntimeConfigResolver.getCurrentConfig();
    const providerCode = config.providerCode ?? config.modelProvider ?? 'unknown';
    const model = config.model ?? '';

    if (!pack) {
      return this.buildFailureResult({
        packCode: params.packCode,
        packVersion: 'unregistered',
        providerCode,
        model,
        failureReason: 'PACK_NOT_REGISTERED',
      });
    }

    if (!this.rolloutPolicy.isEnabled(pack.packCode)) {
      return this.buildFailureResult({
        packCode: pack.packCode,
        packVersion: pack.packVersion,
        providerCode,
        model,
        failureReason: 'PACK_DISABLED',
      });
    }

    const providerContext: AiCapabilityProviderContext = {
      providerCode,
      model,
      wireApi: config.wireApi,
      structuredOutputMode: config.structuredOutputMode,
      sdkOptions: config.sdkOptions ?? {},
    };
    const tuning = this.mergeProviderTunings(
      this.resolveDefaultProviderTuning(providerContext),
      pack.resolveProviderTuning?.(providerContext),
      this.resolveGovernedFewShotExamples(),
    );
    const mergedRequestOverrides = this.mergeRequestOverrides(
      tuning.requestOverrides,
      params.requestOverrides,
    );
    const request = pack.buildStructuredRequest(params.context, tuning);

    try {
      const rawResult = (await this.invokeStructuredWithRetry<TRaw>({
        prompt: request.prompt,
        system: request.system,
        outputSchema: request.outputSchema,
        cwd: params.cwd,
        requestOverrides: mergedRequestOverrides,
      })) as TRaw;
      const normalizedOutput = pack.normalize(rawResult, params.context);
      const validationFailureReason = pack.validate?.(
        normalizedOutput,
        params.context,
      );

      if (validationFailureReason) {
        return this.buildFailureResult({
          packCode: pack.packCode,
          packVersion: pack.packVersion,
          providerCode,
          model,
          failureReason: 'PACK_VALIDATION_FAILED',
          validationFailureReason,
          requestOverrides: mergedRequestOverrides,
        });
      }

      if (pack.isNone?.(normalizedOutput, params.context)) {
        return {
          status: 'NONE',
          packCode: pack.packCode,
          packVersion: pack.packVersion,
          providerCode,
          model,
          output: normalizedOutput,
          failureReason: 'PACK_NONE',
          fallbackReason: 'PACK_NONE',
          requestOverrides: mergedRequestOverrides,
        };
      }

      return {
        status: 'SUCCEEDED',
        packCode: pack.packCode,
        packVersion: pack.packVersion,
        providerCode,
        model,
        output: normalizedOutput,
        requestOverrides: mergedRequestOverrides,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'unknown capability pack error';
      const failureReason = this.resolveFailureReason(error);
      const errorDebug = this.extractErrorDebug(error);
      return this.buildFailureResult({
        packCode: pack.packCode,
        packVersion: pack.packVersion,
        providerCode,
        model,
        failureReason,
        failureMessage: message,
        validationFailureReason:
          failureReason === 'PACK_VALIDATION_FAILED' ? message : undefined,
        rawResponsePreview: errorDebug.rawResponsePreview,
        rawResponseLength: errorDebug.rawResponseLength,
        requestOverrides: mergedRequestOverrides,
      });
    }
  }

  /**
   * 解析跨能力包通用的 Provider 兼容调优。
   *
   * 参数说明：`providerContext` 为当前激活 Profile 的 provider、model 与协议摘要。
   * 返回值：命中已知兼容性规则时返回受控调优项，否则返回空对象。
   * 设计原因：智能分析、企业微信和报告生成都复用 capability pack，Provider 协议差异应收敛
   * 到统一运行时，避免每个业务入口重复写一套 Kimi / Moonshot 兼容逻辑。
   */
  private resolveDefaultProviderTuning(
    providerContext: AiCapabilityProviderContext,
  ): AiCapabilityProviderTuning {
    const providerTunings = [
      resolveKimiCapabilityTuning(providerContext),
      resolveDeepSeekCapabilityTuning(providerContext),
    ];

    return providerTunings.reduce<AiCapabilityProviderTuning>(
      (mergedTuning, currentTuning) =>
        this.mergeProviderTunings(mergedTuning, currentTuning),
      {},
    );
  }

  /**
   * 合并通用 Provider 调优和具体能力包调优。
   *
   * 参数说明：
   * - `defaultTuning`：按 Provider / model 维度推导出的通用调优；
   * - `packTuning`：单个能力包声明的专属调优。
   * 返回值：合并后的能力包调优，能力包专属配置优先级更高。
   */
  private mergeProviderTunings(
    defaultTuning: AiCapabilityProviderTuning,
    packTuning?: AiCapabilityProviderTuning,
    governedTuning?: AiCapabilityProviderTuning,
  ): AiCapabilityProviderTuning {
    return {
      requestOverrides: this.mergeRequestOverrides(
        defaultTuning.requestOverrides,
        packTuning?.requestOverrides,
      ),
      fewShotExamples: [
        ...(defaultTuning.fewShotExamples ?? []),
        ...(packTuning?.fewShotExamples ?? []),
        // 已发布知识资产的 few-shot 注入（学习闭环第 3 层产物）
        // 注入优先级：代码基线 > pack 专属 > 已发布人工正例 > 已发布自动沉淀正例 > 已发布负例
        ...(governedTuning?.fewShotExamples ?? []),
      ],
    };
  }

  /**
   * 从已发布知识资产动态读取 few-shot 示例。
   *
   * 设计原因：
   * 1. 学习闭环第 3 层审核通过的正例/负例需要注入 AI 理解层
   * 2. 只读取已发布且 ACTIVE 的资产（PROPOSED 不注入）
   * 3. 正例最多 20 条，负例最多 10 条，按 confidence 降序取 Top N
   * 4. 注入格式：正例直接作为示例文本，负例标注"不适用"
   *
   * 返回值说明：返回从知识资产表读取的 few-shot 调优配置。
   */
  private resolveGovernedFewShotExamples(): AiCapabilityProviderTuning {
    if (!this.knowledgeRepository) {
      return { fewShotExamples: [] };
    }

    try {
      const publishedAssets = this.knowledgeRepository.listPublishedActive();

      const validatedExamples = publishedAssets
        .filter((asset) => asset.type === 'VALIDATED_EXAMPLE')
        .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
        .slice(0, 20)
        .map((asset) => asset.questionText ?? asset.name)
        .filter((text) => text.trim().length > 0);

      const negativeExamples = publishedAssets
        .filter((asset) => asset.type === 'NEGATIVE_EXAMPLE')
        .slice(0, 10)
        .map(
          (asset) =>
            `${asset.questionText ?? asset.name}（不适用：${asset.blockReason ?? '条件不足'}）`,
        )
        .filter((text) => text.trim().length > 0);

      return {
        fewShotExamples: [...validatedExamples, ...negativeExamples],
      };
    } catch {
      // 知识资产读取失败不影响主链路，返回空
      return { fewShotExamples: [] };
    }
  }

  /**
   * 合并能力包默认调优和调用方的临时覆盖项。
   * 调用方传入的覆盖项优先级更高，用于入口链路按场景压缩超时或关闭重试。
   */
  private mergeRequestOverrides(
    tuningOverrides?: AiCapabilityRequestOverrides,
    invocationOverrides?: AiCapabilityRequestOverrides,
  ): AiCapabilityRequestOverrides | undefined {
    const mergedOverrides = {
      ...(tuningOverrides ?? {}),
      ...(invocationOverrides ?? {}),
    };

    return Object.keys(mergedOverrides).length > 0 ? mergedOverrides : undefined;
  }

  private buildFailureResult<TOutput extends object>(params: {
    packCode: string;
    packVersion: string;
    providerCode: string;
    model: string;
    failureReason: AiCapabilityPackFailureReason;
    failureMessage?: string;
    validationFailureReason?: string;
    rawResponsePreview?: string;
    rawResponseLength?: number;
    requestOverrides?: AiCapabilityPackExecutionResult<TOutput>['requestOverrides'];
  }): AiCapabilityPackExecutionResult<TOutput> {
    return {
      status: 'FAILED',
      packCode: params.packCode,
      packVersion: params.packVersion,
      providerCode: params.providerCode,
      model: params.model,
      failureReason: params.failureReason,
      fallbackReason: params.failureReason,
      failureMessage: params.failureMessage,
      validationFailureReason: params.validationFailureReason,
      rawResponsePreview: params.rawResponsePreview,
      rawResponseLength: params.rawResponseLength,
      requestOverrides: params.requestOverrides,
    };
  }

  /**
   * 从异常对象中提取结构化输出排障摘要。
   *
   * 参数说明：`error` 为 Provider adapter 抛出的异常。
   * 返回值：包含截断后的模型原始输出预览和原始长度；没有可用信息时返回空对象。
   * 注意事项：这里不处理 API Key，因为 adapter 的 HTTP 错误已做脱敏；预览只用于治理排障日志，
   * 不会直接展示给普通业务用户。
   */
  private extractErrorDebug(error: unknown): {
    rawResponsePreview?: string;
    rawResponseLength?: number;
  } {
    if (!(error instanceof Error)) {
      return {};
    }

    const errorRecord = error as Error & {
      rawResponsePreview?: unknown;
      rawResponseLength?: unknown;
    };
    const rawResponsePreview =
      typeof errorRecord.rawResponsePreview === 'string'
        ? errorRecord.rawResponsePreview.slice(0, 1200)
        : undefined;
    const rawResponseLength =
      typeof errorRecord.rawResponseLength === 'number'
        ? errorRecord.rawResponseLength
        : undefined;

    return {
      ...(rawResponsePreview ? { rawResponsePreview } : {}),
      ...(typeof rawResponseLength === 'number' ? { rawResponseLength } : {}),
    };
  }

  private resolveFailureReason(error: unknown): AiCapabilityPackFailureReason {
    if (!(error instanceof Error)) {
      return 'PROVIDER_ERROR';
    }

    // 结构化输出已经返回但文本缺失或 JSON 被截断时，继续重试通常只会拉长等待时间，
    // 还会把真实根因掩盖成更泛化的 provider 超时，因此在这里直接按校验失败落地。
    if (
      error.name === 'RESPONSE_PARSE' ||
      error.message.includes('模型结构化输出不是合法 JSON') ||
      error.message.includes('模型响应缺少最终文本')
    ) {
      return 'PACK_VALIDATION_FAILED';
    }

    if (
      error.name === 'SCHEMA_VALIDATION' ||
      error.message.includes('结构化输出')
    ) {
      return 'PACK_VALIDATION_FAILED';
    }

    if (
      error.name === 'AbortError' ||
      error.message.includes('超时') ||
      error.message.toLowerCase().includes('timeout')
    ) {
      return 'PROVIDER_TIMEOUT';
    }

    return 'PROVIDER_ERROR';
  }

  /**
   * 对能力包结构化调用做一次受控重试，仅用于吸收上游短暂的 provider 抖动。
   */
  private async invokeStructuredWithRetry<TRaw extends object>(params: {
    prompt: string;
    system?: string;
    outputSchema: Record<string, unknown>;
    cwd?: string;
    requestOverrides?: AiCapabilityPackExecutionResult<TRaw>['requestOverrides'];
  }): Promise<TRaw> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.transientRetryCount; attempt += 1) {
      try {
        const adapterRequestOverrides = { ...(params.requestOverrides ?? {}) };
        delete adapterRequestOverrides.retryOnTimeout;
        return (await this.unifiedAiExecutionService.invokeStructured({
          prompt: params.prompt,
          system: params.system,
          outputSchema: params.outputSchema,
          cwd: params.cwd,
          requestOverrides: adapterRequestOverrides,
        })) as TRaw;
      } catch (error) {
        lastError = error;
        const failureReason = this.resolveFailureReason(error);
        const shouldRetry =
          attempt < this.transientRetryCount &&
          (failureReason === 'PROVIDER_ERROR' ||
            (failureReason === 'PROVIDER_TIMEOUT' &&
              params.requestOverrides?.retryOnTimeout !== false));

        if (!shouldRetry) {
          throw error;
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error('capability-pack invoke failed');
  }
}

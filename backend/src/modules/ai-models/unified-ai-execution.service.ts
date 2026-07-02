import { Injectable } from '@nestjs/common';
import { AiRuntimeConfigResolver } from './ai-runtime-config.resolver';
import { AiProviderRegistryService } from './ai-provider-registry.service';

export interface UnifiedTextRequest {
  prompt: string;
  system?: string;
  cwd?: string;
  requestOverrides?: {
    wireApi?: 'responses' | 'chat_completions';
    structuredOutputMode?: 'json_schema' | 'json_object' | 'prompt_schema';
    disableResponseStorage?: boolean;
    enableThinking?: boolean;
    maxTokens?: number;
    timeoutMs?: number;
  };
}

export interface UnifiedStructuredRequest extends UnifiedTextRequest {
  outputSchema: Record<string, unknown>;
}

/**
 * 统一屏蔽业务层对具体 AI SDK 的依赖，按当前激活 Profile 选择对应 adapter。
 */
@Injectable()
export class UnifiedAiExecutionService {
  constructor(
    private readonly aiRuntimeConfigResolver: AiRuntimeConfigResolver,
    private readonly aiProviderRegistryService: AiProviderRegistryService,
  ) {}

  /**
   * 基于当前生效 Profile 执行一次纯文本调用。
   */
  async invokeText(params: UnifiedTextRequest): Promise<string> {
    const config = this.aiRuntimeConfigResolver.getCurrentConfig();
    if (!config.enabled || !config.sdkType) {
      throw new Error('当前没有可用的 AI 运行时配置。');
    }

    const adapter = this.aiProviderRegistryService.getAdapter(config.sdkType);
    return await adapter.invokeText({
      profile: {
        id: config.profileId ?? 'env_fallback',
        name: config.profileId ?? 'env_fallback',
        providerCode: config.providerCode ?? config.modelProvider ?? 'unknown',
        sdkType: config.sdkType,
        model: config.model ?? '',
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        secretConfigured: Boolean(config.apiKey),
        reasoningEffort: config.reasoningEffort,
        serviceTier: config.serviceTier,
        timeoutMs: config.timeoutMs,
        status: 'ACTIVE',
        sdkOptions: {
          ...(config.sdkOptions ?? {}),
          ...(config.wireApi ? { wireApi: config.wireApi } : {}),
          ...(config.structuredOutputMode
            ? { structuredOutputMode: config.structuredOutputMode }
            : {}),
          ...(typeof config.disableResponseStorage === 'boolean'
            ? { disableResponseStorage: config.disableResponseStorage }
            : {}),
        },
        createdBy: 'system',
        updatedBy: 'system',
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      },
      prompt: params.prompt,
      system: params.system,
      cwd: params.cwd,
      requestOverrides: params.requestOverrides,
    });
  }

  /**
   * 基于当前生效 Profile 执行一次结构化调用。
   */
  async invokeStructured(params: UnifiedStructuredRequest): Promise<unknown> {
    const config = this.aiRuntimeConfigResolver.getCurrentConfig();
    if (!config.enabled || !config.sdkType) {
      throw new Error('当前没有可用的 AI 运行时配置。');
    }

    const adapter = this.aiProviderRegistryService.getAdapter(config.sdkType);
    return await adapter.invokeStructured({
      profile: {
        id: config.profileId ?? 'env_fallback',
        name: config.profileId ?? 'env_fallback',
        providerCode: config.providerCode ?? config.modelProvider ?? 'unknown',
        sdkType: config.sdkType,
        model: config.model ?? '',
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        secretConfigured: Boolean(config.apiKey),
        reasoningEffort: config.reasoningEffort,
        serviceTier: config.serviceTier,
        timeoutMs: config.timeoutMs,
        status: 'ACTIVE',
        sdkOptions: {
          ...(config.sdkOptions ?? {}),
          ...(config.wireApi ? { wireApi: config.wireApi } : {}),
          ...(config.structuredOutputMode
            ? { structuredOutputMode: config.structuredOutputMode }
            : {}),
          ...(typeof config.disableResponseStorage === 'boolean'
            ? { disableResponseStorage: config.disableResponseStorage }
            : {}),
        },
        createdBy: 'system',
        updatedBy: 'system',
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      },
      prompt: params.prompt,
      system: params.system,
      cwd: params.cwd,
      outputSchema: params.outputSchema,
      requestOverrides: params.requestOverrides,
    });
  }
}

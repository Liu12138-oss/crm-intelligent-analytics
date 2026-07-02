import { Inject, Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import {
  LocalRuntimeConfigService,
  type AiRuntimeConfig,
} from '../../shared/config/local-runtime-config.service';
import { normalizeAiReasoningEffort } from '../../shared/utils/ai-reasoning-effort.util';
import { AiSecretCryptoService } from './ai-secret-crypto.service';

/**
 * 统一解析当前真正生效的 AI 运行时配置。
 *
 * 优先级：
 * 1. 当前激活的后台 Profile；
 * 2. 环境变量和本地配置文件；
 * 3. 由上层按 enabled=false 进入降级逻辑。
 */
@Injectable()
export class AiRuntimeConfigResolver {
  constructor(
    @Inject(AppStorageService)
    private readonly appStorage: AppStorageService,
    @Inject(LocalRuntimeConfigService)
    private readonly localRuntimeConfigService: Pick<
      LocalRuntimeConfigService,
      'getAiConfig'
    >,
    private readonly aiSecretCryptoService?: AiSecretCryptoService,
  ) {}

  /**
   * 返回当前可供业务服务直接消费的运行时配置。
   */
  getCurrentConfig(): AiRuntimeConfig {
    const activeProfileId = this.appStorage.state.aiModelActivation.activeProfileId;
    if (!activeProfileId) {
      return this.resolveEnvConfig();
    }

    const activeProfile = this.appStorage.state.aiModelProfiles.find(
      (profile) => profile.id === activeProfileId && profile.status === 'ACTIVE',
    );
    if (!activeProfile) {
      return this.resolveEnvConfig();
    }

    const sdkOptions = activeProfile.sdkOptions ?? {};
    let decryptedApiKey: string | undefined;
    if (activeProfile.secretCiphertext && this.aiSecretCryptoService) {
      try {
        decryptedApiKey = this.aiSecretCryptoService.decrypt(
          activeProfile.secretCiphertext,
        );
      } catch {
        decryptedApiKey = undefined;
      }
    }

    return {
      enabled: Boolean(activeProfile.baseUrl && activeProfile.model),
      source: 'profile',
      profileId: activeProfile.id,
      providerCode: activeProfile.providerCode,
      sdkType: activeProfile.sdkType,
      apiKey: decryptedApiKey,
      baseUrl: activeProfile.baseUrl,
      model: activeProfile.model,
      modelProvider:
        typeof sdkOptions.modelProvider === 'string'
          ? sdkOptions.modelProvider
          : activeProfile.providerCode,
      reasoningEffort: normalizeAiReasoningEffort(
        activeProfile.reasoningEffort,
        activeProfile.sdkType,
      ),
      serviceTier: activeProfile.serviceTier,
      timeoutMs: activeProfile.timeoutMs,
      wireApi:
        sdkOptions.wireApi === 'responses' ||
        sdkOptions.wireApi === 'chat_completions'
          ? sdkOptions.wireApi
          : undefined,
      structuredOutputMode:
        sdkOptions.structuredOutputMode === 'json_schema' ||
        sdkOptions.structuredOutputMode === 'json_object' ||
        sdkOptions.structuredOutputMode === 'prompt_schema'
          ? sdkOptions.structuredOutputMode
          : undefined,
      requiresOpenaiAuth:
        typeof sdkOptions.requiresOpenaiAuth === 'boolean'
          ? sdkOptions.requiresOpenaiAuth
          : undefined,
      disableResponseStorage:
        typeof sdkOptions.disableResponseStorage === 'boolean'
          ? sdkOptions.disableResponseStorage
          : undefined,
      codexPath:
        typeof sdkOptions.codexPath === 'string'
          ? sdkOptions.codexPath
          : undefined,
      proxyEnv:
        this.isStringRecord(sdkOptions.proxyEnv) ? sdkOptions.proxyEnv : undefined,
      sdkOptions,
    };
  }

  /**
   * 统一透传当前环境默认配置，并补充来源标记。
   */
  private resolveEnvConfig(): AiRuntimeConfig {
    const envConfig = this.localRuntimeConfigService.getAiConfig();

    return {
      ...envConfig,
      reasoningEffort: normalizeAiReasoningEffort(
        envConfig.reasoningEffort,
        envConfig.sdkType,
      ),
      source: 'env',
    };
  }

  /**
   * 判断一个值是否可以安全视为字符串键值表。
   */
  private isStringRecord(value: unknown): value is Record<string, string> {
    if (!value || typeof value !== 'object') {
      return false;
    }

    return Object.values(value).every(
      (entry) => typeof entry === 'string',
    );
  }
}

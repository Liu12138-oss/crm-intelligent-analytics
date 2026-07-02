import { Injectable } from '@nestjs/common';
import type { AiProviderHealthCheckResult } from './adapters/ai-provider.adapter';
import type { AiModelProfileWriteInput } from './ai-model-profile.service';
import { AiModelProfileService } from './ai-model-profile.service';
import { AiProviderRegistryService } from './ai-provider-registry.service';
import { AiSecretCryptoService } from './ai-secret-crypto.service';
import { normalizeAiReasoningEffort } from '../../shared/utils/ai-reasoning-effort.util';

/**
 * 统一执行 Profile 健康检查，并把结果回写到治理目录。
 */
@Injectable()
export class AiHealthCheckService {
  constructor(
    private readonly aiModelProfileService: AiModelProfileService,
    private readonly aiProviderRegistryService: AiProviderRegistryService,
    private readonly aiSecretCryptoService: AiSecretCryptoService,
  ) {}

  /**
   * 对指定 Profile 执行一次健康检查，并回写最近测试结果。
   */
  async runHealthCheck(profileId: string): Promise<AiProviderHealthCheckResult> {
    const profile = this.aiModelProfileService.getById(profileId);
    const executableProfile = this.buildExecutableProfile(profile);
    const adapter = this.aiProviderRegistryService.getAdapter(profile.sdkType);
    const result = await adapter.healthCheck(executableProfile);

    this.aiModelProfileService.recordHealthCheck(profile.id, result);
    return result;
  }

  /**
   * 基于当前表单草稿执行一次临时健康检查。
   *
   * 该能力用于配置抽屉中的“测试连接”按钮：
   * 1. 新建时直接使用当前输入值；
   * 2. 编辑时若密钥留空，则复用已保存密钥；
   * 3. 测试结果只返回给调用方，不回写最近测试状态。
   */
  async runDraftHealthCheck(
    input: AiModelProfileWriteInput & { profileId?: string },
  ): Promise<AiProviderHealthCheckResult> {
    const existingProfile = input.profileId
      ? this.aiModelProfileService.getById(input.profileId)
      : undefined;
    const adapter = this.aiProviderRegistryService.getAdapter(input.sdkType);
    const executableProfile = {
      id: existingProfile?.id ?? 'draft_ai_profile',
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      providerCode: input.providerCode.trim(),
      sourceType: existingProfile?.sourceType ?? 'MANUAL',
      bootstrapKey: existingProfile?.bootstrapKey,
      bootstrapWarnings: existingProfile?.bootstrapWarnings,
      lastBootstrapAt: existingProfile?.lastBootstrapAt,
      sdkType: input.sdkType,
      model: input.model.trim(),
      baseUrl: input.baseUrl?.trim() || undefined,
      secretCiphertext: undefined,
      secretConfigured: Boolean(
        input.apiKey?.trim() || existingProfile?.secretConfigured,
      ),
      reasoningEffort: normalizeAiReasoningEffort(
        input.reasoningEffort?.trim() ?? existingProfile?.reasoningEffort,
        input.sdkType,
      ),
      serviceTier: input.serviceTier?.trim() || undefined,
      timeoutMs: input.timeoutMs,
      status: existingProfile?.status ?? 'INACTIVE',
      sdkOptions: { ...input.sdkOptions },
      createdBy: existingProfile?.createdBy ?? 'draft',
      updatedBy: existingProfile?.updatedBy ?? 'draft',
      createdAt: existingProfile?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      apiKey: input.apiKey?.trim()
        ? input.apiKey.trim()
        : existingProfile?.secretCiphertext
          ? this.aiSecretCryptoService.decrypt(existingProfile.secretCiphertext)
          : undefined,
    };
    const result = await adapter.healthCheck(executableProfile);
    return result;
  }

  /**
   * 将持久化 Profile 解密成 provider adapter 可直接消费的运行时结构。
   */
  private buildExecutableProfile(profile: ReturnType<AiModelProfileService['getById']>) {
    return {
      ...profile,
      apiKey: profile.secretCiphertext
        ? this.aiSecretCryptoService.decrypt(profile.secretCiphertext)
        : undefined,
    };
  }
}

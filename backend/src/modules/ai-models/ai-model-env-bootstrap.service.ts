import { Injectable, OnModuleInit } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';
import {
  AiModelProfileService,
  type AiModelProfileWriteInput,
} from './ai-model-profile.service';

/**
 * 将环境中的默认 AI 配置引导为后台治理档案。
 *
 * 这里采用“缺失时落表，不覆盖已存在保留档案”的策略：
 * 1. 让治理页首次打开时就能看到当前环境已有的 OpenAI 兼容 HTTP 配置；
 * 2. 避免每次启动把管理员手工补齐的字段覆盖掉；
 * 3. 继续保留现有运行时环境兜底，不把 bootstrap 结果当成唯一依赖。
 */
@Injectable()
export class AiModelEnvBootstrapService implements OnModuleInit {
  constructor(
    private readonly appStorage: AppStorageService,
    private readonly localRuntimeConfigService: LocalRuntimeConfigService,
    private readonly aiModelProfileService: AiModelProfileService,
  ) {}

  /**
   * 模块初始化时尝试引导默认档案，保证治理页有可见起点。
   */
  onModuleInit(): void {
    this.ensureBootstrapped();
  }

  /**
   * 按当前环境配置补齐缺失的默认档案。
   */
  ensureBootstrapped(): void {
    const removedActiveBootstrappedProfile =
      this.removeLegacySdkBootstrapProfiles();
    this.syncOpenAiCompatibleHttpProfile();
    this.ensureActivationAfterBootstrapRefresh(removedActiveBootstrappedProfile);
  }

  /**
   * 同步 OpenAI 兼容 HTTP 默认档案。
   */
  private syncOpenAiCompatibleHttpProfile(): void {
    const config = this.localRuntimeConfigService.getOpenAiCompatibleHttpEnvConfig();
    if (!config || !config.baseUrl || !config.model || !config.apiKey) {
      return;
    }

    const existingProfile = this.findBootstrapProfile(
      'env_openai_compatible_http_default',
    );
    if (existingProfile && this.isManuallyPreservedBootstrapProfile(existingProfile)) {
      this.ensureBootstrapProfileActivation(existingProfile.id);
      return;
    }

    const shouldActivate =
      !this.appStorage.state.aiModelActivation.activeProfileId ||
      this.appStorage.state.aiModelActivation.activeProfileId === existingProfile?.id;
    const payload: AiModelProfileWriteInput = {
      name: '环境默认 OpenAI 兼容 HTTP',
      providerCode: config.providerCode,
      sourceType: 'ENV_BOOTSTRAPPED',
      bootstrapKey: 'env_openai_compatible_http_default',
      bootstrapWarnings: config.warnings.length > 0 ? config.warnings : undefined,
      lastBootstrapAt: new Date().toISOString(),
      sdkType: 'openai-compatible-http',
      model: config.model,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      reasoningEffort: config.reasoningEffort,
      serviceTier: config.serviceTier,
      timeoutMs: config.timeoutMs,
      initialStatus: shouldActivate ? 'ACTIVE' : 'INACTIVE',
      sdkOptions: {
        ...(config.sdkOptions ?? {}),
      },
    };
    const profileView = existingProfile
      ? this.aiModelProfileService.update(
          'system_env_bootstrap',
          existingProfile.id,
          payload,
        )
      : this.aiModelProfileService.create('system_env_bootstrap', payload);

    if (shouldActivate) {
      this.appStorage.state.aiModelProfiles = this.appStorage.state.aiModelProfiles.map(
        (profile) => ({
          ...profile,
          status: profile.id === profileView.id ? 'ACTIVE' : 'INACTIVE',
        }),
      );
      this.appStorage.state.aiModelActivation = {
        activeProfileId: profileView.id,
        activatedAt: new Date().toISOString(),
        activatedBy: 'system_env_bootstrap',
        lastVerifiedAt: undefined,
        lastVerificationStatus: undefined,
      };
      this.appStorage.persist();
    }
  }

  /**
   * 判断环境默认档案是否已被管理员手工修正。
   *
   * 这样处理的原因是：
   * 1. 环境引导档案首次落表后，管理员可能会在治理页里补正确的网关、模型或密钥；
   * 2. 如果后续重启继续强制用旧环境值覆盖，会把已经验证通过的人工修正再次打坏；
   * 3. 因此一旦发现该档案最近一次更新并非系统引导行为，就只保留激活兜底，不再覆盖配置内容。
   */
  private isManuallyPreservedBootstrapProfile(profile: {
    sourceType?: string;
    updatedBy?: string;
  }): boolean {
    return (
      profile.sourceType === 'ENV_BOOTSTRAPPED' &&
      profile.updatedBy !== 'system_env_bootstrap'
    );
  }

  /**
   * 当系统当前没有激活项时，继续把保留中的环境默认档案作为兜底激活项。
   *
   * 注意这里仅补激活记录，不改动管理员已保存的配置内容。
   */
  private ensureBootstrapProfileActivation(profileId: string): void {
    const currentActiveProfileId = this.appStorage.state.aiModelActivation.activeProfileId;
    if (currentActiveProfileId && currentActiveProfileId !== profileId) {
      return;
    }

    if (currentActiveProfileId === profileId) {
      return;
    }

    this.appStorage.state.aiModelProfiles = this.appStorage.state.aiModelProfiles.map(
      (profile) => ({
        ...profile,
        status: profile.id === profileId ? 'ACTIVE' : 'INACTIVE',
      }),
    );
    this.appStorage.state.aiModelActivation = {
      activeProfileId: profileId,
      activatedAt: new Date().toISOString(),
      activatedBy: 'system_env_bootstrap',
      lastVerifiedAt: undefined,
      lastVerificationStatus: undefined,
    };
    this.appStorage.persist();
  }

  /**
   * 读取指定 bootstrapKey 的环境默认档案。
   */
  private findBootstrapProfile(
    bootstrapKey:
      | 'env_openai_compatible_http_default'
      | 'env_codex_default'
      | 'env_claude_default',
  ) {
    return this.appStorage.state.aiModelProfiles.find(
      (profile) => profile.bootstrapKey === bootstrapKey,
    );
  }

  /**
   * 清理旧版遗留的 SDK 环境默认档案，避免治理页继续展示已移除入口。
   */
  private removeLegacySdkBootstrapProfiles(): boolean {
    const removedActiveProfile = this.appStorage.state.aiModelProfiles.some(
      (profile) =>
        profile.sourceType === 'ENV_BOOTSTRAPPED' &&
        profile.sdkType !== 'openai-compatible-http' &&
        profile.id === this.appStorage.state.aiModelActivation.activeProfileId,
    );

    this.appStorage.state.aiModelProfiles = this.appStorage.state.aiModelProfiles.filter(
      (profile) =>
        !(
          profile.sourceType === 'ENV_BOOTSTRAPPED' &&
          profile.sdkType !== 'openai-compatible-http'
        ),
    );

    if (removedActiveProfile) {
      this.appStorage.state.aiModelActivation = {
        activeProfileId: undefined,
        activatedAt: undefined,
        activatedBy: undefined,
        lastVerifiedAt: undefined,
        lastVerificationStatus: undefined,
      };
    }

    if (removedActiveProfile) {
      this.appStorage.persist();
    }

    return removedActiveProfile;
  }

  /**
   * 若刚移除了当前激活的环境默认档案，则优先把新建的 HTTP 默认档案设为当前生效。
   */
  private ensureActivationAfterBootstrapRefresh(removedActiveProfile: boolean): void {
    if (!removedActiveProfile || this.appStorage.state.aiModelActivation.activeProfileId) {
      return;
    }

    const httpProfile = this.appStorage.state.aiModelProfiles.find(
      (profile) => profile.bootstrapKey === 'env_openai_compatible_http_default',
    );
    const fallbackProfile = httpProfile ?? this.appStorage.state.aiModelProfiles[0];
    if (!fallbackProfile) {
      return;
    }

    this.appStorage.state.aiModelProfiles = this.appStorage.state.aiModelProfiles.map(
      (profile) => ({
        ...profile,
        status: profile.id === fallbackProfile.id ? 'ACTIVE' : 'INACTIVE',
      }),
    );
    this.appStorage.state.aiModelActivation = {
      activeProfileId: fallbackProfile.id,
      activatedAt: new Date().toISOString(),
      activatedBy: 'system_env_bootstrap',
      lastVerifiedAt: undefined,
      lastVerificationStatus: undefined,
    };
    this.appStorage.persist();
  }
}

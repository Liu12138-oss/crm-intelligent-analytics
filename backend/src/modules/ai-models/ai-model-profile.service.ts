import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type {
  AiHealthCheckStatus,
  AiModelProfileRecord,
  AiModelProfileStatus,
  AiSdkType,
} from '../../shared/types/domain';
import { normalizeAiReasoningEffort } from '../../shared/utils/ai-reasoning-effort.util';
import { buildEntityId } from '../../shared/utils/id.util';
import { AiSecretCryptoService } from './ai-secret-crypto.service';
import type { AiProviderHealthCheckResult } from './adapters/ai-provider.adapter';

export interface AiModelProfileWriteInput {
  name: string;
  description?: string;
  providerCode: string;
  sourceType?: AiModelProfileRecord['sourceType'];
  bootstrapKey?: AiModelProfileRecord['bootstrapKey'];
  bootstrapWarnings?: string[];
  lastBootstrapAt?: string;
  initialStatus?: AiModelProfileStatus;
  sdkType: AiSdkType;
  model: string;
  baseUrl?: string;
  apiKey?: string;
  reasoningEffort?: string;
  serviceTier?: string;
  timeoutMs?: number;
  sdkOptions: Record<string, unknown>;
}

export interface AiModelProfileView extends Omit<AiModelProfileRecord, 'secretCiphertext'> {
  secretMask: '已配置' | '未配置';
  secretUpdatedAt?: string;
}

/**
 * 负责 AI Profile 的增删改查、状态维护与密钥写入规则。
 */
@Injectable()
export class AiModelProfileService {
  constructor(
    @Inject(AppStorageService)
    private readonly appStorage: AppStorageService,
    private readonly aiSecretCryptoService: AiSecretCryptoService,
  ) {}

  /**
   * 返回当前全部 Profile 的脱敏视图。
   */
  list(): AiModelProfileView[] {
    return this.appStorage.state.aiModelProfiles.map((profile) =>
      this.toView(profile),
    );
  }

  /**
   * 返回指定 Profile 的脱敏详情视图。
   */
  getViewById(profileId: string): AiModelProfileView {
    return this.toView(this.getById(profileId));
  }

  /**
   * 根据标识读取一条 Profile 原始记录。
   */
  getById(profileId: string): AiModelProfileRecord {
    const matchedProfile = this.appStorage.state.aiModelProfiles.find(
      (profile) => profile.id === profileId,
    );
    if (!matchedProfile) {
      throw new NotFoundException('未找到对应的 AI Profile。');
    }

    return matchedProfile;
  }

  /**
   * 创建新的 AI Profile，并在存在密钥时转为密文存储。
   */
  create(actorId: string, input: AiModelProfileWriteInput): AiModelProfileView {
    const now = new Date().toISOString();
    const nextProfile: AiModelProfileRecord = {
      id: buildEntityId('ai_profile'),
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      providerCode: input.providerCode.trim(),
      sourceType: input.sourceType ?? 'MANUAL',
      bootstrapKey: input.bootstrapKey,
      bootstrapWarnings:
        input.bootstrapWarnings && input.bootstrapWarnings.length > 0
          ? [...input.bootstrapWarnings]
          : undefined,
      lastBootstrapAt: input.lastBootstrapAt,
      sdkType: input.sdkType,
      model: input.model.trim(),
      baseUrl: input.baseUrl?.trim() || undefined,
      secretCiphertext: input.apiKey?.trim()
        ? this.aiSecretCryptoService.encrypt(input.apiKey.trim())
        : undefined,
      secretConfigured: Boolean(input.apiKey?.trim()),
      reasoningEffort: normalizeAiReasoningEffort(
        input.reasoningEffort?.trim(),
        input.sdkType,
      ),
      serviceTier: input.serviceTier?.trim() || undefined,
      timeoutMs: input.timeoutMs,
      status: input.initialStatus ?? 'ACTIVE',
      sdkOptions: { ...input.sdkOptions },
      createdBy: actorId,
      updatedBy: actorId,
      createdAt: now,
      updatedAt: now,
    };

    this.appStorage.state.aiModelProfiles.push(nextProfile);
    this.appStorage.persist();
    return this.toView(nextProfile);
  }

  /**
   * 更新指定 Profile，并遵守“留空不改密钥”的写入约束。
   */
  update(
    actorId: string,
    profileId: string,
    input: AiModelProfileWriteInput,
  ): AiModelProfileView {
    const currentProfile = this.getById(profileId);
    const nextProfile: AiModelProfileRecord = {
      ...currentProfile,
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      providerCode: input.providerCode.trim(),
      sdkType: input.sdkType,
      model: input.model.trim(),
      baseUrl: input.baseUrl?.trim() || undefined,
      reasoningEffort: normalizeAiReasoningEffort(
        input.reasoningEffort?.trim(),
        input.sdkType,
      ),
      serviceTier: input.serviceTier?.trim() || undefined,
      timeoutMs: input.timeoutMs,
      sdkOptions: { ...input.sdkOptions },
      bootstrapWarnings:
        currentProfile.sourceType === 'ENV_BOOTSTRAPPED'
          ? this.buildBootstrapWarnings({
              providerCode: input.providerCode.trim(),
              sdkType: input.sdkType,
              model: input.model.trim(),
              baseUrl: input.baseUrl?.trim() || undefined,
              hasApiKey: Boolean(
                input.apiKey?.trim() || currentProfile.secretConfigured,
              ),
            })
          : currentProfile.bootstrapWarnings,
      updatedBy: actorId,
      updatedAt: new Date().toISOString(),
    };

    if (typeof input.apiKey === 'string' && input.apiKey.trim()) {
      nextProfile.secretCiphertext = this.aiSecretCryptoService.encrypt(
        input.apiKey.trim(),
      );
      nextProfile.secretConfigured = true;
    }

    this.replaceProfile(nextProfile);
    this.appStorage.persist();
    return this.toView(nextProfile);
  }

  /**
   * 复制一条现有 Profile，默认不继承密钥与最近测试状态。
   */
  copy(actorId: string, profileId: string): AiModelProfileView {
    const sourceProfile = this.getById(profileId);
    const now = new Date().toISOString();
    const copiedProfile: AiModelProfileRecord = {
      ...sourceProfile,
      id: buildEntityId('ai_profile'),
      name: `${sourceProfile.name}-副本`,
      sourceType: 'MANUAL',
      bootstrapKey: undefined,
      bootstrapWarnings: undefined,
      lastBootstrapAt: undefined,
      secretCiphertext: undefined,
      secretConfigured: false,
      reasoningEffort: normalizeAiReasoningEffort(
        sourceProfile.reasoningEffort,
        sourceProfile.sdkType,
      ),
      lastHealthCheckAt: undefined,
      lastHealthCheckStatus: undefined,
      lastHealthCheckLatencyMs: undefined,
      lastHealthCheckFailureReason: undefined,
      createdBy: actorId,
      updatedBy: actorId,
      createdAt: now,
      updatedAt: now,
    };

    this.appStorage.state.aiModelProfiles.push(copiedProfile);
    this.appStorage.persist();
    return this.toView(copiedProfile);
  }

  /**
   * 显式清空指定 Profile 的密钥。
   */
  clearSecret(actorId: string, profileId: string): AiModelProfileView {
    const currentProfile = this.getById(profileId);
    const nextProfile: AiModelProfileRecord = {
      ...currentProfile,
      secretCiphertext: undefined,
      secretConfigured: false,
      updatedBy: actorId,
      updatedAt: new Date().toISOString(),
    };

    this.replaceProfile(nextProfile);
    this.appStorage.persist();
    return this.toView(nextProfile);
  }

  /**
   * 删除一条手工维护的 AI Profile。
   *
   * 关键约束：
   * 1. 当前生效项不能直接删除，避免把全局运行时来源删空；
   * 2. 环境默认档案删除后会被 bootstrap 重建，因此不提供删除；
   * 3. 删除仅用于清理复制出的手工配置或失效手工档案。
   */
  delete(profileId: string): AiModelProfileView {
    const currentProfile = this.getById(profileId);
    if (currentProfile.sourceType === 'ENV_BOOTSTRAPPED') {
      throw new BadRequestException('环境默认 AI Profile 不支持删除。');
    }
    if (this.appStorage.state.aiModelActivation.activeProfileId === profileId) {
      throw new BadRequestException('当前生效的 AI Profile 不能删除，请先切换到其它配置。');
    }

    const deletedProfile = this.toView(currentProfile);
    this.appStorage.state.aiModelProfiles = this.appStorage.state.aiModelProfiles.filter(
      (profile) => profile.id !== profileId,
    );
    this.appStorage.persist();
    return deletedProfile;
  }

  /**
   * 更新 Profile 的启停状态。
   */
  setStatus(
    actorId: string,
    profileId: string,
    status: AiModelProfileStatus,
  ): AiModelProfileView {
    const currentProfile = this.getById(profileId);
    const nextProfile: AiModelProfileRecord = {
      ...currentProfile,
      status,
      updatedBy: actorId,
      updatedAt: new Date().toISOString(),
    };

    this.replaceProfile(nextProfile);
    this.appStorage.persist();
    return this.toView(nextProfile);
  }

  /**
   * 在激活前校验目标 Profile 是否允许作为当前全局配置。
   */
  assertActivatable(profileId: string): AiModelProfileRecord {
    const currentProfile = this.getById(profileId);
    if (currentProfile.lastHealthCheckStatus !== 'SUCCEEDED') {
      throw new BadRequestException('当前 AI Profile 最近一次测试未通过，不能被激活。');
    }

    return currentProfile;
  }

  /**
   * 回写最近一次健康检查结果，供激活门闩和治理页展示复用。
   */
  recordHealthCheck(
    profileId: string,
    result: AiProviderHealthCheckResult,
  ): AiModelProfileView {
    const currentProfile = this.getById(profileId);
    const nextProfile: AiModelProfileRecord = {
      ...currentProfile,
      lastHealthCheckAt: new Date().toISOString(),
      lastHealthCheckStatus: result.status as AiHealthCheckStatus,
      lastHealthCheckLatencyMs: result.latencyMs,
      lastHealthCheckFailureReason: result.failureReason,
    };

    this.replaceProfile(nextProfile);
    this.appStorage.persist();
    return this.toView(nextProfile);
  }

  /**
   * 将持久化记录转换成接口和页面使用的脱敏视图。
   */
  private toView(profile: AiModelProfileRecord): AiModelProfileView {
    return {
      ...profile,
      secretMask: profile.secretConfigured ? '已配置' : '未配置',
      secretUpdatedAt: profile.secretConfigured ? profile.updatedAt : undefined,
    };
  }

  /**
   * 以原位替换的方式写回 Profile，避免丢失现有数组引用。
   */
  private replaceProfile(nextProfile: AiModelProfileRecord): void {
    const profileIndex = this.appStorage.state.aiModelProfiles.findIndex(
      (profile) => profile.id === nextProfile.id,
    );
    if (profileIndex < 0) {
      throw new NotFoundException('未找到对应的 AI Profile。');
    }

    this.appStorage.state.aiModelProfiles[profileIndex] = nextProfile;
  }

  /**
   * 为环境默认档案生成缺失字段提示，避免治理页只看到空值却不知道为什么不可启用。
   */
  private buildBootstrapWarnings(params: {
    providerCode: string;
    sdkType: AiSdkType;
    model: string;
    baseUrl?: string;
    hasApiKey: boolean;
  }): string[] | undefined {
    const providerLabel =
      params.sdkType === 'claude-agent-sdk'
        ? 'Claude'
        : params.sdkType === 'openai-compatible-http'
          ? 'OpenAI 兼容 HTTP'
          : 'Codex';
    const warnings: string[] = [];
    if (!params.baseUrl?.trim()) {
      warnings.push(`缺少 ${providerLabel} 服务地址`);
    }
    if (!params.model.trim()) {
      warnings.push(`缺少 ${providerLabel} 模型名`);
    }
    if (!params.hasApiKey) {
      warnings.push(`缺少 ${providerLabel} 密钥`);
    }

    return warnings.length > 0 ? warnings : undefined;
  }
}

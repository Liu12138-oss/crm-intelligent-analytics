import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type { AiHealthCheckStatus, CrmUser } from '../../shared/types/domain';
import { AiModelProfileService } from './ai-model-profile.service';
import type { AiProviderHealthCheckResult } from './adapters/ai-provider.adapter';
import { AiModelAuditService } from './ai-model-audit.service';

/**
 * 负责维护全局唯一激活 Profile 记录，并在切换时覆盖旧激活状态。
 */
@Injectable()
export class AiProfileActivationService {
  constructor(
    @Inject(AppStorageService)
    private readonly appStorage: AppStorageService,
    private readonly aiModelProfileService: AiModelProfileService,
    private readonly aiModelAuditService: AiModelAuditService,
  ) {}

  /**
   * 返回当前激活快照，供治理接口和页面直接展示。
   */
  getCurrentActivation() {
    return this.appStorage.state.aiModelActivation;
  }

  /**
   * 激活指定 Profile，并写入当前激活快照。
   */
  activate(actorId: string, profileId: string): void {
    this.aiModelProfileService.assertActivatable(profileId);
    const now = new Date().toISOString();
    this.appStorage.state.aiModelProfiles = this.appStorage.state.aiModelProfiles.map(
      (profile) => ({
        ...profile,
        status: profile.id === profileId ? 'ACTIVE' : 'INACTIVE',
        updatedBy: actorId,
        updatedAt: now,
      }),
    );
    this.appStorage.state.aiModelActivation = {
      activeProfileId: profileId,
      activatedAt: now,
      activatedBy: actorId,
      lastVerifiedAt: this.appStorage.state.aiModelActivation.lastVerifiedAt,
      lastVerificationStatus:
        this.appStorage.state.aiModelActivation.lastVerificationStatus,
    };
    this.appStorage.persist();
  }

  /**
   * 激活后立即执行一次验证；若验证失败，则自动回滚到上一条激活记录。
   */
  async activateWithVerification(
    actor: Pick<CrmUser, 'id' | 'roleIds' | 'organizationIds' | 'departmentIds' | 'ownerIds' | 'isAdmin'>,
    profileId: string,
    verifier: () => Promise<AiProviderHealthCheckResult>,
  ) {
    const previousActivation = {
      ...this.appStorage.state.aiModelActivation,
    };
    this.activate(actor.id, profileId);
    const verificationResult = await verifier();
    this.markVerified(verificationResult.status);

    if (verificationResult.status !== 'SUCCEEDED') {
      this.appStorage.state.aiModelActivation = previousActivation;
      this.appStorage.persist();
      this.aiModelAuditService.createEvent({
        actor: actor as CrmUser,
        eventType: 'AI_MODEL_PROFILE_ACTIVATION_ROLLED_BACK',
        outcome: `AI Profile ${profileId} 切换后验证失败，已回滚。`,
        failureReason: verificationResult.failureReason,
        sessionSnapshot: {
          profileId,
          rollbackToProfileId: previousActivation.activeProfileId,
          verificationResult,
        },
      });
      throw new BadRequestException('切换后的 AI Profile 验证失败，已回滚到上一条配置。');
    }

    this.aiModelAuditService.createEvent({
      actor: actor as CrmUser,
      eventType: 'AI_MODEL_PROFILE_ACTIVATED',
      outcome: `AI Profile ${profileId} 已激活。`,
      sessionSnapshot: {
        profileId,
        previousProfileId: previousActivation.activeProfileId,
        verificationResult,
      },
    });

    return this.getCurrentActivation();
  }

  /**
   * 写入最近一次切换后验证结果，供治理页和回滚判断复用。
   */
  markVerified(status: AiHealthCheckStatus): void {
    this.appStorage.state.aiModelActivation = {
      ...this.appStorage.state.aiModelActivation,
      lastVerifiedAt: new Date().toISOString(),
      lastVerificationStatus: status,
    };
    this.appStorage.persist();
  }
}

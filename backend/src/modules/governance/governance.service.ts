import { Injectable, Optional } from '@nestjs/common';
import type { CrmUser } from '../../shared/types/domain';
import { AccessPolicyRepository } from './access-policy.repository';
import { updateAccessPolicySchema } from './access-policy.schema';
import { PermissionEnforcementService } from './permission-enforcement.service';
import { SessionCapabilitiesService } from '../sessions/session-capabilities.service';
import { CrmAuthService } from '../auth/crm-auth.service';

@Injectable()
export class GovernanceService {
  constructor(
    private readonly accessPolicyRepository: AccessPolicyRepository,
    private readonly permissionEnforcementService: PermissionEnforcementService,
    private readonly sessionCapabilitiesService: SessionCapabilitiesService,
    @Optional()
    private readonly crmAuthService?: CrmAuthService,
  ) {}

  getCurrent(user: CrmUser) {
    this.ensureGovernanceManageAccess(user);
    return this.accessPolicyRepository.getCurrent();
  }

  updateCurrent(user: CrmUser, payload: unknown) {
    this.ensureGovernanceManageAccess(user);
    const parsed = updateAccessPolicySchema.parse(payload);
    const currentPolicy = this.accessPolicyRepository.getCurrent();
    const saved = this.accessPolicyRepository.save({
      ...currentPolicy,
      ...parsed,
      updatedBy: user.id,
      updatedAt: new Date().toISOString(),
    });
    this.invalidatePermissionRelatedCaches();
    return saved;
  }

  /**
   * 权限治理变更后统一清理短缓存，避免页面初始化继续复用旧身份和旧能力快照。
   *
   * @returns 无返回值。
   * @throws 不抛出异常；缓存清理失败不应阻断治理配置落库。
   */
  private invalidatePermissionRelatedCaches(): void {
    this.sessionCapabilitiesService.invalidateAllSnapshots();
    this.crmAuthService?.invalidateResolvedSessionUserCache();
  }

  private ensureGovernanceManageAccess(user: CrmUser): void {
    this.permissionEnforcementService.ensureAction(
      user,
      'governance.policy.manage',
      '当前用户无权管理治理策略。',
      {
        channel: 'web-console',
        resourceType: 'governance-policy',
      },
    );
  }
}

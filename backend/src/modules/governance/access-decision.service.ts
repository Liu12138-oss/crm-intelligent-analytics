import { ForbiddenException, Injectable, Optional } from '@nestjs/common';
import type {
  AccessDecisionRecord,
  ContractPermissionSnapshot,
  CrmUser,
  RolePermissionRecord,
} from '../../shared/types/domain';
import { AccessPolicyRepository } from './access-policy.repository';
import { RolePermissionRepository } from './role-permission.repository';
import { WecomPilotPolicyRepository } from './wecom-pilot-policy.repository';
import { UserScopeService } from '../auth/user-scope.service';
import {
  FEATURE_PERMISSION_CATALOG,
  FEATURE_PERMISSION_KEYS,
} from './feature-permission-catalog';
import { ApplicationSuperAdminPolicyRepository } from './application-super-admin-policy.repository';

@Injectable()
export class AccessDecisionService {
  constructor(
    private readonly accessPolicyRepository: AccessPolicyRepository,
    private readonly rolePermissionRepository: RolePermissionRepository,
    private readonly wecomPilotPolicyRepository: WecomPilotPolicyRepository,
    private readonly userScopeService: UserScopeService,
    @Optional()
    private readonly applicationSuperAdminPolicyRepository?: ApplicationSuperAdminPolicyRepository,
  ) {}

  buildDecision(
    user: CrmUser,
    channel: 'web-console' | 'wecom-bot',
  ): AccessDecisionRecord {
    const policy = this.accessPolicyRepository.getCurrent();
    const isApplicationSuperAdmin = this.isApplicationSuperAdmin(user);
    const rolePermissions = isApplicationSuperAdmin
      ? [this.buildApplicationSuperAdminRolePermission(user)]
      : this.resolveRolePermissions(user);
    const visibleMenus = this.collectVisibleMenus(rolePermissions);
    const actionKeys = this.collectActionKeys(rolePermissions);
    const contractPermissions = this.collectContractPermissions(rolePermissions);
    const scopeSnapshot = this.userScopeService.resolveScope(user);

    if (!policy.enabledChannels.includes(channel)) {
      return {
        allowed: false,
        channel,
        state: 'CHANNEL_DISABLED',
        reason:
          channel === 'wecom-bot'
            ? '当前企业微信机器人入口暂未开放，请先使用 Web 工作台。'
            : '当前 Web 工作台入口暂未开放。',
        matchedRoleIds: rolePermissions.map((item) => item.roleId),
        visibleMenus,
        actionKeys,
        scopeSnapshot,
        contractPermissions,
      };
    }

    if (!isApplicationSuperAdmin && !user.channels.includes(channel)) {
      return {
        allowed: false,
        channel,
        state: 'ROLE_NOT_ENABLED',
        reason:
          channel === 'wecom-bot'
            ? '当前用户未开通企业微信机器人入口资格。'
            : '当前用户未开通 Web 工作台入口资格。',
        matchedRoleIds: rolePermissions.map((item) => item.roleId),
        visibleMenus,
        actionKeys,
        scopeSnapshot,
        contractPermissions,
      };
    }

    if (channel === 'web-console') {
      const hasWebConsoleEligibility = isApplicationSuperAdmin || rolePermissions.some(
        (item) => item.status === 'ACTIVE' && item.webConsoleEnabled,
      );
      if (!hasWebConsoleEligibility) {
        return {
          allowed: false,
          channel,
          state: 'ROLE_NOT_ENABLED',
          reason: '当前用户无权使用 Web 工作台入口。',
          matchedRoleIds: rolePermissions.map((item) => item.roleId),
          visibleMenus,
          actionKeys,
          scopeSnapshot,
          contractPermissions,
        };
      }

      return {
        allowed: true,
        channel,
        state: 'ALLOWED',
        matchedRoleIds: rolePermissions.map((item) => item.roleId),
        visibleMenus,
        actionKeys,
        scopeSnapshot,
        contractPermissions,
      };
    }

    const hasWecomEligibility = isApplicationSuperAdmin || rolePermissions.some(
      (item) => item.status === 'ACTIVE' && item.wecomBotEligible,
    );
    if (!hasWecomEligibility) {
      return {
        allowed: false,
        channel,
        state: 'ROLE_NOT_ENABLED',
        reason: '当前用户无权使用企业微信问数能力。',
        matchedRoleIds: rolePermissions.map((item) => item.roleId),
        visibleMenus,
        actionKeys,
        scopeSnapshot,
        contractPermissions,
      };
    }

    const pilotPolicy = this.wecomPilotPolicyRepository.getCurrent();
    if (pilotPolicy.mode === 'DISABLED') {
      return {
        allowed: false,
        channel,
        state: 'CHANNEL_DISABLED',
        reason: '当前企业微信机器人入口暂未开放，请先使用 Web 工作台。',
        matchedRoleIds: rolePermissions.map((item) => item.roleId),
        visibleMenus,
        actionKeys,
        scopeSnapshot,
        contractPermissions,
        wecomPilotSnapshot: {
          mode: pilotPolicy.mode,
        },
      };
    }

    if (!isApplicationSuperAdmin && pilotPolicy.denyUserIds.includes(user.id)) {
      return {
        allowed: false,
        channel,
        state: 'EXPLICITLY_DENIED',
        reason: '当前账号已被暂停企业微信机器人使用资格，请联系管理员确认。',
        matchedRoleIds: rolePermissions.map((item) => item.roleId),
        visibleMenus,
        actionKeys,
        scopeSnapshot,
        contractPermissions,
        wecomPilotSnapshot: {
          mode: pilotPolicy.mode,
          deniedByUserId: user.id,
        },
      };
    }

    if (pilotPolicy.mode === 'PILOT_ONLY' && !isApplicationSuperAdmin) {
      const matchedBy = this.matchWecomPilotAllowRule(user, pilotPolicy);
      if (!matchedBy) {
        return {
          allowed: false,
          channel,
          state: 'PILOT_REQUIRED',
          reason: '当前企业微信机器人仍在灰度开放中，你的账号暂未开通体验资格。',
          matchedRoleIds: rolePermissions.map((item) => item.roleId),
          visibleMenus,
          actionKeys,
          scopeSnapshot,
          contractPermissions,
          wecomPilotSnapshot: {
            mode: pilotPolicy.mode,
          },
        };
      }

      return {
        allowed: true,
        channel,
        state: 'ALLOWED',
        matchedRoleIds: rolePermissions.map((item) => item.roleId),
        visibleMenus,
        actionKeys,
        scopeSnapshot,
        contractPermissions,
        wecomPilotSnapshot: {
          mode: pilotPolicy.mode,
          matchedBy,
        },
      };
    }

    return {
      allowed: true,
      channel,
      state: 'ALLOWED',
      matchedRoleIds: rolePermissions.map((item) => item.roleId),
      visibleMenus,
      actionKeys,
      scopeSnapshot,
      contractPermissions,
      wecomPilotSnapshot: {
        mode: pilotPolicy.mode,
      },
    };
  }

  hasAction(user: CrmUser, actionKey: string): boolean {
    if (this.isApplicationSuperAdmin(user)) {
      return FEATURE_PERMISSION_KEYS.includes(actionKey);
    }

    const rolePermissions = this.resolveRolePermissions(user);
    return rolePermissions.some((item) => this.resolveActionMatch(item, actionKey));
  }

  hasVisibleMenu(user: CrmUser, menuKey: string): boolean {
    const isKnownMenu = FEATURE_PERMISSION_CATALOG.some(
      (item) => item.kind === 'menu' && item.key === menuKey,
    );
    if (!isKnownMenu) {
      return false;
    }

    if (this.isApplicationSuperAdmin(user)) {
      return true;
    }

    const rolePermissions = this.resolveRolePermissions(user);
    return rolePermissions.some((item) => item.visibleMenus.includes(menuKey));
  }

  ensureAction(user: CrmUser, actionKey: string, reason: string): void {
    if (!this.hasAction(user, actionKey)) {
      throw new ForbiddenException(reason);
    }
  }

  private resolveRolePermissions(user: CrmUser): RolePermissionRecord[] {
    const policy = this.accessPolicyRepository.getCurrent();
    const storedRolePermissions = this.rolePermissionRepository
      .listAll()
      .filter((item) => item.status === 'ACTIVE' && user.roleIds.includes(item.roleId));
    const knownRoleIds = new Set(storedRolePermissions.map((item) => item.roleId));
    const fallbackRolePermissions = user.roleIds
      .filter((roleId) => !knownRoleIds.has(roleId))
      .map((roleId) => this.buildFallbackRolePermission(user, roleId, policy));

    return [...storedRolePermissions, ...fallbackRolePermissions];
  }

  private buildFallbackRolePermission(
    user: CrmUser,
    roleId: string,
    policy: ReturnType<AccessPolicyRepository['getCurrent']>,
  ): RolePermissionRecord {
    const isAdminRole = user.isAdmin;
    const analysisEnabled = isAdminRole || policy.enabledRoleIds.includes(roleId);
    const exportAllowed = user.exportAllowed && (isAdminRole || policy.exportRoleIds.includes(roleId));
    const webConsoleEnabled = analysisEnabled || isAdminRole;
    const wecomBotEligible =
      policy.enabledChannels.includes('wecom-bot') &&
      user.channels.includes('wecom-bot') &&
      (analysisEnabled || isAdminRole);
    const visibleMenus = analysisEnabled ? ['analysis-workbench', 'management-report'] : [];
    const actionKeys = analysisEnabled
      ? ['analysis.use', 'analysis.follow_up', 'management.report.view', 'template.view']
      : [];

    if (exportAllowed) {
      actionKeys.push('analysis.export');
      actionKeys.push('management.report.export');
    }

    if (isAdminRole) {
      visibleMenus.push(
        'contract-review',
        'permission-center',
        'connection-policy',
        'audit-center',
        'ai-model-governance',
      );
      actionKeys.push(
        'template.manage',
        'template.sql.write',
        'wecom.analysis.use',
        'wecom.customer.create',
        'wecom.opportunity.create',
        'wecom.followup.writeback',
        'wecom.daily_report.preview',
        'governance.policy.manage',
        'audit.view',
        'audit.sql.view',
        'audit.sql.view_sensitive',
        'ai_profile.manage',
        'contract.review.upload',
        'contract.review.cross_view',
        'contract.review.cross_download',
      );
    }

    return {
      roleId,
      roleNameSnapshot: user.roleNames.join('、') || roleId,
      status: 'ACTIVE',
      visibleMenus: Array.from(new Set(visibleMenus)),
      actionKeys: Array.from(new Set(actionKeys)),
      webConsoleEnabled,
      wecomBotEligible,
      exportAllowed,
      templateManageAllowed: isAdminRole,
      contractReviewUploadAllowed: isAdminRole,
      contractReviewCrossViewAllowed: isAdminRole,
      contractReviewCrossDownloadAllowed: isAdminRole,
      updatedBy: 'system',
      updatedAt: new Date().toISOString(),
      changeReason: '基于当前用户实时权限的兼容回退结果',
    };
  }

  /**
   * 判断当前用户是否命中应用超级管理员授权。
   * 参数：当前 CRM 用户快照。
   * 返回：命中用户级或角色级授权时返回 true。
   * 注意：该判断只覆盖应用内功能与范围，不替代登录、通道关闭等固定安全前置检查。
   */
  private isApplicationSuperAdmin(user: CrmUser): boolean {
    return this.applicationSuperAdminPolicyRepository?.isSuperAdminSubject(user) ?? false;
  }

  /**
   * 构造应用超级管理员虚拟角色权限。
   * 参数：当前 CRM 用户快照。
   * 返回：覆盖权限目录所有菜单和动作的运行时权限记录。
   */
  private buildApplicationSuperAdminRolePermission(
    user: CrmUser,
  ): RolePermissionRecord {
    const visibleMenus = FEATURE_PERMISSION_CATALOG
      .filter((item) => item.kind === 'menu')
      .map((item) => item.key);
    const actionKeys = FEATURE_PERMISSION_CATALOG
      .filter((item) => item.kind === 'action')
      .map((item) => item.key);

    return {
      roleId: 'application-super-admin',
      roleNameSnapshot: `${user.name}（应用超级管理员）`,
      status: 'ACTIVE',
      visibleMenus,
      actionKeys,
      webConsoleEnabled: true,
      wecomBotEligible: true,
      exportAllowed: true,
      templateManageAllowed: true,
      contractReviewUploadAllowed: true,
      contractReviewCrossViewAllowed: true,
      contractReviewCrossDownloadAllowed: true,
      updatedBy: 'application-super-admin-policy',
      updatedAt: new Date().toISOString(),
      changeReason: '命中应用超级管理员授权，开放系统内全部功能和操作。',
    };
  }

  private collectVisibleMenus(rolePermissions: RolePermissionRecord[]): string[] {
    const knownMenuKeys = new Set(
      FEATURE_PERMISSION_CATALOG
        .filter((item) => item.kind === 'menu')
        .map((item) => item.key),
    );
    return Array.from(
      new Set(rolePermissions.flatMap((item) => item.visibleMenus)),
    ).filter((menuKey) => knownMenuKeys.has(menuKey));
  }

  private collectActionKeys(rolePermissions: RolePermissionRecord[]): string[] {
    return Array.from(
      new Set(
        rolePermissions.flatMap((item) => {
          const actionKeys = [...item.actionKeys];
          if (item.exportAllowed) {
            actionKeys.push('analysis.export');
          }
      if (item.templateManageAllowed) {
        actionKeys.push('template.manage');
        actionKeys.push('template.sql.write');
      }
          if (item.contractReviewUploadAllowed) {
            actionKeys.push('contract.review.upload');
          }
          if (item.contractReviewCrossViewAllowed) {
            actionKeys.push('contract.review.cross_view');
          }
          if (item.contractReviewCrossDownloadAllowed) {
            actionKeys.push('contract.review.cross_download');
          }
          return actionKeys;
        }),
      ),
    );
  }

  private collectContractPermissions(
    rolePermissions: RolePermissionRecord[],
  ): ContractPermissionSnapshot {
    return {
      uploadAllowed: rolePermissions.some(
        (item) =>
          item.contractReviewUploadAllowed ||
          item.actionKeys.includes('contract.review.upload'),
      ),
      crossViewAllowed: rolePermissions.some(
        (item) =>
          item.contractReviewCrossViewAllowed ||
          item.actionKeys.includes('contract.review.cross_view'),
      ),
      crossDownloadAllowed: rolePermissions.some(
        (item) =>
          item.contractReviewCrossDownloadAllowed ||
          item.actionKeys.includes('contract.review.cross_download'),
      ),
    };
  }

  private matchWecomPilotAllowRule(
    user: CrmUser,
    pilotPolicy: ReturnType<WecomPilotPolicyRepository['getCurrent']>,
  ): 'user' | 'role' | 'department' | undefined {
    if (pilotPolicy.allowUserIds.includes(user.id)) {
      return 'user';
    }

    if (user.roleIds.some((roleId) => pilotPolicy.allowRoleIds.includes(roleId))) {
      return 'role';
    }

    if (
      user.departmentIds.some((departmentId) =>
        pilotPolicy.allowDepartmentIds.includes(departmentId),
      )
    ) {
      return 'department';
    }

    return undefined;
  }

  private resolveActionMatch(
    rolePermission: RolePermissionRecord,
    actionKey: string,
  ): boolean {
    if (rolePermission.actionKeys.includes(actionKey)) {
      return true;
    }

    const booleanActionMap: Record<string, boolean> = {
      'analysis.export': rolePermission.exportAllowed,
      'template.manage': rolePermission.templateManageAllowed,
      'template.sql.write':
        rolePermission.templateManageAllowed ||
        rolePermission.actionKeys.includes('template.sql.write'),
      'contract.review.upload': rolePermission.contractReviewUploadAllowed,
      'contract.review.cross_view': rolePermission.contractReviewCrossViewAllowed,
      'contract.review.cross_download': rolePermission.contractReviewCrossDownloadAllowed,
    };

    return booleanActionMap[actionKey] ?? false;
  }
}

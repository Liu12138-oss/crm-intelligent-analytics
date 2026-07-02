import { ForbiddenException, Injectable } from '@nestjs/common';
import type { ChannelType, CrmUser } from '../../shared/types/domain';
import { buildEntityId } from '../../shared/utils/id.util';
import { AuditEventRepository } from '../audit/audit-event.repository';
import { UserScopeService } from '../auth/user-scope.service';
import { AccessDecisionService } from './access-decision.service';

interface PermissionDenyContext {
  channel?: ChannelType;
  resourceType?: string;
  resourceId?: string;
  sessionSnapshot?: Record<string, unknown>;
}

@Injectable()
export class PermissionEnforcementService {
  constructor(
    private readonly accessDecisionService: AccessDecisionService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly userScopeService: UserScopeService,
  ) {}

  hasAction(user: CrmUser, actionKey: string): boolean {
    return this.accessDecisionService.hasAction(user, actionKey);
  }

  hasVisibleMenu(user: CrmUser, menuKey: string): boolean {
    return this.accessDecisionService.hasVisibleMenu(user, menuKey);
  }

  ensureAction(
    user: CrmUser,
    actionKey: string,
    reason: string,
    context?: PermissionDenyContext,
  ): void {
    if (this.hasAction(user, actionKey)) {
      return;
    }

    this.auditPermissionDenied(user, 'ACCESS_ACTION_DENIED', actionKey, reason, context);
    throw new ForbiddenException(reason);
  }

  denyAction(
    user: CrmUser,
    actionKey: string,
    reason: string,
    context?: PermissionDenyContext,
  ): never {
    this.auditPermissionDenied(user, 'ACCESS_ACTION_DENIED', actionKey, reason, context);
    throw new ForbiddenException(reason);
  }

  ensureVisibleMenu(
    user: CrmUser,
    menuKey: string,
    reason: string,
    context?: PermissionDenyContext,
  ): void {
    if (this.hasVisibleMenu(user, menuKey)) {
      return;
    }

    this.auditPermissionDenied(user, 'ACCESS_MENU_DENIED', menuKey, reason, context);
    throw new ForbiddenException(reason);
  }

  private auditPermissionDenied(
    user: CrmUser,
    eventType: 'ACCESS_ACTION_DENIED' | 'ACCESS_MENU_DENIED',
    permissionKey: string,
    reason: string,
    context?: PermissionDenyContext,
  ): void {
    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType,
      actorId: user.id,
      actorRoleIds: user.roleIds,
      permissionKey,
      resourceType: context?.resourceType,
      resourceId: context?.resourceId,
      channel: context?.channel,
      scopeSnapshot: this.userScopeService.resolveScope(user),
      sessionSnapshot: context?.sessionSnapshot,
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome: reason,
      failureReason: reason,
      createdAt: new Date().toISOString(),
    });
  }
}

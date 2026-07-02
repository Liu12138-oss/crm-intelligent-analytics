import { Injectable } from '@nestjs/common';
import { OrganizationScopeService } from '../governance/organization-scope.service';
import type { CrmUser, FollowUpLoggableType } from '../../shared/types/domain';

export type FollowUpAuthorizationRelation =
  | 'ADMIN'
  | 'OWNER_SELF'
  | 'COLLABORATOR_SELF'
  | 'OWNER_GROUP_LEADER'
  | 'COLLABORATOR_LEADER'
  | 'COLLABORATOR_FACTS_MISSING'
  | 'OWNER_MAPPING_MISSING'
  | 'COLLABORATOR_MAPPING_MISSING'
  | 'ACTOR_MAPPING_MISSING'
  | 'ORGANIZATION_FACTS_MISSING'
  | 'DENIED';

export interface FollowUpAuthorizationResult {
  allowed: boolean;
  relation: FollowUpAuthorizationRelation;
  ownerWxUserid?: string;
  actorWxUserid?: string;
  assistUserCrmUserIds: string[];
  assistUserNames: string[];
  siblingCrmUserIds: string[];
  ancestorCrmUserIds: string[];
  collaboratorAncestorCrmUserIds: string[];
  missingAssistUserCrmUserIds: string[];
  reason: string;
}

@Injectable()
export class FollowUpAuthorizationService {
  constructor(
    private readonly organizationScopeService: OrganizationScopeService,
  ) {}

  /**
   * 按目标对象负责人判定当前用户是否具备跟进写回资格。
   * 参数：当前操作者以及目标对象的最小身份快照。
   * 返回：是否允许、命中的关系类型，以及可审计的关系上下文。
   */
  evaluate(params: {
    actor: CrmUser;
    target: {
      objectType: FollowUpLoggableType;
      objectId: string;
      objectTitle: string;
      ownerId: string;
      ownerName?: string;
      assistUserIds?: string[];
      assistUserNames?: string[];
      assistUsersResolved?: boolean;
    };
  }): FollowUpAuthorizationResult {
    const assistUserCrmUserIds = this.uniqueCrmUserIds(
      params.target.assistUserIds ?? [],
    );
    const assistUserNames = this.uniqueNames(params.target.assistUserNames ?? []);

    if (params.actor.isAdmin) {
      return {
        allowed: true,
        relation: 'ADMIN',
        assistUserCrmUserIds,
        assistUserNames,
        siblingCrmUserIds: [],
        ancestorCrmUserIds: [],
        collaboratorAncestorCrmUserIds: [],
        missingAssistUserCrmUserIds: [],
        reason: '当前用户为管理员，可执行企业微信跟进写回。',
      };
    }

    // 负责人本人无需依赖组织事实，避免真实负责人因为同步暂时缺失而误伤自身写回。
    if (
      params.actor.id === params.target.ownerId ||
      this.normalizeName(params.actor.name) ===
        this.normalizeName(params.target.ownerName)
    ) {
      return {
        allowed: true,
        relation: 'OWNER_SELF',
        assistUserCrmUserIds,
        assistUserNames,
        siblingCrmUserIds: [],
        ancestorCrmUserIds: [],
        collaboratorAncestorCrmUserIds: [],
        missingAssistUserCrmUserIds: [],
        reason: '当前用户就是目标对象负责人，可执行企业微信跟进写回。',
      };
    }

    if (
      assistUserCrmUserIds.includes(params.actor.id) ||
      this.isNameIncluded(params.actor.name, assistUserNames)
    ) {
      return {
        allowed: true,
        relation: 'COLLABORATOR_SELF',
        assistUserCrmUserIds,
        assistUserNames,
        siblingCrmUserIds: [],
        ancestorCrmUserIds: [],
        collaboratorAncestorCrmUserIds: [],
        missingAssistUserCrmUserIds: [],
        reason: '当前用户就是目标对象协作人，可执行企业微信跟进写回。',
      };
    }

    if (!this.organizationScopeService.hasOrganizationFacts()) {
      return {
        allowed: false,
        relation: 'ORGANIZATION_FACTS_MISSING',
        assistUserCrmUserIds,
        assistUserNames,
        siblingCrmUserIds: [],
        ancestorCrmUserIds: [],
        collaboratorAncestorCrmUserIds: [],
        missingAssistUserCrmUserIds: [],
        reason:
          '当前无法确认企业微信组织关系，暂不能执行跟进写回，请联系管理员同步目录后重试。',
      };
    }

    if (params.target.assistUsersResolved === false) {
      return {
        allowed: false,
        relation: 'COLLABORATOR_FACTS_MISSING',
        assistUserCrmUserIds,
        assistUserNames,
        siblingCrmUserIds: [],
        ancestorCrmUserIds: [],
        collaboratorAncestorCrmUserIds: [],
        missingAssistUserCrmUserIds: [],
        reason:
          '当前无法确认该对象协作人的最新权限关系，暂不能执行跟进写回。',
      };
    }

    const ownerWxUserid =
      this.organizationScopeService.resolveWxUseridByCrmUserId(
        params.target.ownerId,
      );
    if (!ownerWxUserid) {
      return {
        allowed: false,
        relation: 'OWNER_MAPPING_MISSING',
        assistUserCrmUserIds,
        assistUserNames,
        siblingCrmUserIds: [],
        ancestorCrmUserIds: [],
        collaboratorAncestorCrmUserIds: [],
        missingAssistUserCrmUserIds: [],
        reason:
          '当前无法确认该对象负责人的企业微信映射，暂不能执行跟进写回。',
      };
    }

    const actorWxUserid =
      params.actor.wecomSenderId?.trim() ||
      this.organizationScopeService.resolveWxUseridByCrmUserId(params.actor.id);
    if (!actorWxUserid) {
      return {
        allowed: false,
        relation: 'ACTOR_MAPPING_MISSING',
        ownerWxUserid,
        assistUserCrmUserIds,
        assistUserNames,
        siblingCrmUserIds: [],
        ancestorCrmUserIds: [],
        collaboratorAncestorCrmUserIds: [],
        missingAssistUserCrmUserIds: [],
        reason:
          '当前无法确认你的企业微信组织映射，暂不能执行跟进写回。',
      };
    }

    const {
      ancestorCrmUserIds,
      missingCrmUserIds: missingAssistUserCrmUserIds,
    } = this.organizationScopeService.collectAncestorCrmUserIdsByCrmUserIds(
      assistUserCrmUserIds,
    );
    if (missingAssistUserCrmUserIds.length > 0) {
      return {
        allowed: false,
        relation: 'COLLABORATOR_MAPPING_MISSING',
        ownerWxUserid,
        actorWxUserid,
        assistUserCrmUserIds,
        assistUserNames,
        siblingCrmUserIds: [],
        ancestorCrmUserIds: [],
        collaboratorAncestorCrmUserIds: ancestorCrmUserIds,
        missingAssistUserCrmUserIds,
        reason:
          '当前无法确认该对象协作人的企业微信映射，暂不能执行跟进写回。',
      };
    }

    const ownerAncestorCrmUserIds =
      this.organizationScopeService.collectAncestorCrmUserIdsByCrmUserId(
        params.target.ownerId,
      );
    if (ownerAncestorCrmUserIds.includes(params.actor.id)) {
      return {
        allowed: true,
        relation: 'OWNER_GROUP_LEADER',
        ownerWxUserid,
        actorWxUserid,
        assistUserCrmUserIds,
        assistUserNames,
        siblingCrmUserIds: [],
        ancestorCrmUserIds: ownerAncestorCrmUserIds,
        collaboratorAncestorCrmUserIds: ancestorCrmUserIds,
        missingAssistUserCrmUserIds: [],
        reason: '当前用户命中目标对象负责人的上级链，可执行跟进写回。',
      };
    }

    if (ancestorCrmUserIds.includes(params.actor.id)) {
      return {
        allowed: true,
        relation: 'COLLABORATOR_LEADER',
        ownerWxUserid,
        actorWxUserid,
        assistUserCrmUserIds,
        assistUserNames,
        siblingCrmUserIds: [],
        ancestorCrmUserIds: ownerAncestorCrmUserIds,
        collaboratorAncestorCrmUserIds: ancestorCrmUserIds,
        missingAssistUserCrmUserIds: [],
        reason: '当前用户命中目标对象协作人的上级链，可执行跟进写回。',
      };
    }

    return {
      allowed: false,
      relation: 'DENIED',
      ownerWxUserid,
      actorWxUserid,
      assistUserCrmUserIds,
      assistUserNames,
      siblingCrmUserIds: [],
      ancestorCrmUserIds: ownerAncestorCrmUserIds,
      collaboratorAncestorCrmUserIds: ancestorCrmUserIds,
      missingAssistUserCrmUserIds: [],
      reason:
        '当前仅负责人、协作人、负责人或协作人的上级领导可跟进该客户或商机。',
    };
  }

  /** 仅用于稳定比较中文姓名，避免空格或大小写差异影响负责人本人判定。 */
  private normalizeName(name: string | undefined): string {
    return name?.replace(/\s+/gu, '').trim().toLowerCase() ?? '';
  }

  /** 判断当前姓名是否命中授权主体姓名快照。 */
  private isNameIncluded(
    currentName: string | undefined,
    candidateNames: string[],
  ): boolean {
    const normalizedCurrentName = this.normalizeName(currentName);
    return candidateNames.some(
      (candidateName) => this.normalizeName(candidateName) === normalizedCurrentName,
    );
  }

  /** 去重 CRM 用户 ID，并滤掉空值。 */
  private uniqueCrmUserIds(crmUserIds: string[]): string[] {
    return Array.from(new Set(crmUserIds.map((item) => item.trim()).filter(Boolean)));
  }

  /** 去重姓名，并滤掉空值。 */
  private uniqueNames(names: string[]): string[] {
    return Array.from(new Set(names.map((item) => item.trim()).filter(Boolean)));
  }
}

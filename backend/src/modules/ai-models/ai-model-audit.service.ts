import { Injectable } from '@nestjs/common';
import { buildEntityId } from '../../shared/utils/id.util';
import type { CrmUser, AuditEventType } from '../../shared/types/domain';
import { AuditEventRepository } from '../audit/audit-event.repository';

/**
 * 负责记录 AI 模型治理相关审计事件，避免控制器散落重复审计拼装逻辑。
 */
@Injectable()
export class AiModelAuditService {
  constructor(private readonly auditEventRepository: AuditEventRepository) {}

  /**
   * 记录一条 AI 模型治理审计事件。
   */
  createEvent(params: {
    actor: CrmUser;
    eventType: AuditEventType;
    outcome: string;
    failureReason?: string;
    sessionSnapshot?: Record<string, unknown>;
  }) {
    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: params.eventType,
      actorId: params.actor.id,
      actorRoleIds: params.actor.roleIds,
      scopeSnapshot: {
        organizationIds: params.actor.organizationIds,
        departmentIds: params.actor.departmentIds,
        ownerIds: params.actor.ownerIds,
        scopeSummary: params.actor.isAdmin ? '管理员操作' : '受限用户操作',
      },
      sessionSnapshot: params.sessionSnapshot,
      riskLevel: params.failureReason ? 'MEDIUM' : 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome: params.outcome,
      failureReason: params.failureReason,
      createdAt: new Date().toISOString(),
    });
  }
}

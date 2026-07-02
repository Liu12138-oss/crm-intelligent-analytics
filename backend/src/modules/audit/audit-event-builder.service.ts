import { Injectable } from '@nestjs/common';
import type {
  AuditEventRecord,
  ChannelType,
  CrmUser,
  ScopeSnapshot,
  WecomInboundMessage,
} from '../../shared/types/domain';
import { buildEntityId } from '../../shared/utils/id.util';

type AuditActorFields = Pick<
  AuditEventRecord,
  | 'actorId'
  | 'actorRoleIds'
  | 'actorType'
  | 'actorDisplayName'
  | 'actorExternalId'
  | 'actorBindingStatus'
>;

type AuditChannelAgentFields = Pick<
  AuditEventRecord,
  'channel' | 'channelAgentId' | 'channelAgentType'
>;

type AuditSummaryFields = Pick<
  AuditEventRecord,
  'actionSummary' | 'targetType' | 'targetId' | 'targetSummary'
>;

export type BuildAuditEventParams = Omit<
  Partial<AuditEventRecord>,
  | 'eventType'
  | 'actorId'
  | 'actorRoleIds'
  | 'scopeSnapshot'
  | 'riskLevel'
  | 'reviewStatus'
  | 'outcome'
> &
  AuditActorFields & {
    eventType: AuditEventRecord['eventType'];
    scopeSnapshot: ScopeSnapshot;
    riskLevel: AuditEventRecord['riskLevel'];
    reviewStatus: AuditEventRecord['reviewStatus'];
    outcome: string;
  };

@Injectable()
export class AuditEventBuilderService {
  /**
   * 基于 CRM 用户生成真实行为人字段，用于 Web 和已绑定企业微信入口。
   */
  crmUserActor(user: CrmUser): AuditActorFields {
    return {
      actorId: user.id,
      actorRoleIds: user.roleIds,
      actorType: 'crm-user',
      actorDisplayName: user.name,
      actorExternalId: user.wecomSenderId,
      actorBindingStatus: 'BOUND_CRM',
    };
  }

  /**
   * 基于未绑定企业微信发送者生成稳定主体，避免把机器人误记为行为人。
   */
  unboundWecomActor(senderId: string): AuditActorFields {
    const normalizedSenderId = senderId.trim();
    return {
      actorId: `wecom:${normalizedSenderId}`,
      actorRoleIds: [],
      actorType: 'wecom-user',
      actorDisplayName: `未绑定 CRM 用户（企业微信：${normalizedSenderId}）`,
      actorExternalId: normalizedSenderId,
      actorBindingStatus: 'UNBOUND_WECOM',
    };
  }

  /**
   * 基于系统入口生成主体字段，用于无法确认真实发送人的入口失败或定时任务。
   */
  systemActor(actorId: string, displayName: string): AuditActorFields {
    return {
      actorId,
      actorRoleIds: [],
      actorType: 'system',
      actorDisplayName: displayName,
      actorBindingStatus: 'SYSTEM',
    };
  }

  /**
   * 生成入口通道代理字段，机器人或调度器只作为代理信息留痕。
   */
  channelAgent(params: {
    channel: ChannelType;
    channelAgentId?: string;
    channelAgentType?: AuditEventRecord['channelAgentType'];
  }): AuditChannelAgentFields {
    return {
      channel: params.channel,
      channelAgentId: params.channelAgentId,
      channelAgentType:
        params.channelAgentType ??
        (params.channel === 'wecom-bot' ? 'wecom-bot' : 'web-console'),
    };
  }

  /**
   * 从企业微信入站消息提取通道代理字段，优先保留机器人或应用标识。
   */
  wecomChannelAgent(
    inboundMessage?: Pick<WecomInboundMessage, 'botId' | 'channelAgentId' | 'rawSenderId'>,
  ): AuditChannelAgentFields {
    return this.channelAgent({
      channel: 'wecom-bot',
      channelAgentId:
        inboundMessage?.channelAgentId ??
        inboundMessage?.botId ??
        inboundMessage?.rawSenderId,
      channelAgentType: 'wecom-bot',
    });
  }

  /**
   * 生成业务摘要字段，供审计列表在缺少 AI 专属字段时仍能完整展示。
   */
  summary(params: AuditSummaryFields): AuditSummaryFields {
    return {
      actionSummary: params.actionSummary,
      targetType: params.targetType,
      targetId: params.targetId,
      targetSummary: params.targetSummary,
    };
  }

  /**
   * 创建完整审计事件，调用方仍可覆盖其它兼容字段。
   */
  buildEvent(params: BuildAuditEventParams): AuditEventRecord {
    return {
      id: params.id ?? buildEntityId('audit'),
      eventType: params.eventType,
      actorId: params.actorId,
      actorRoleIds: params.actorRoleIds,
      actorType: params.actorType,
      actorDisplayName: params.actorDisplayName,
      actorExternalId: params.actorExternalId,
      actorBindingStatus: params.actorBindingStatus,
      permissionKey: params.permissionKey,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      channel: params.channel,
      channelAgentId: params.channelAgentId,
      channelAgentType: params.channelAgentType,
      relatedRequestId: params.relatedRequestId,
      relatedTemplateId: params.relatedTemplateId,
      relatedHistoryId: params.relatedHistoryId,
      originalQuestion: params.originalQuestion,
      querySnapshot: params.querySnapshot,
      scopeSnapshot: params.scopeSnapshot,
      sessionSnapshot: params.sessionSnapshot,
      resultCount: params.resultCount,
      riskLevel: params.riskLevel,
      reviewStatus: params.reviewStatus,
      reviewedBy: params.reviewedBy,
      reviewedAt: params.reviewedAt,
      outcome: params.outcome,
      failureReason: params.failureReason,
      actionSummary: params.actionSummary,
      targetType: params.targetType,
      targetId: params.targetId,
      targetSummary: params.targetSummary,
      contractReviewReviewBasis: params.contractReviewReviewBasis,
      createdAt: params.createdAt ?? new Date().toISOString(),
    };
  }
}

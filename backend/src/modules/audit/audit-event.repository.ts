import { Inject, Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type { AuditEventRecord } from '../../shared/types/domain';

@Injectable()
export class AuditEventRepository {
  constructor(
    @Inject(AppStorageService)
    private readonly appStorage: AppStorageService,
  ) {}

  create(event: AuditEventRecord): AuditEventRecord {
    const normalizedEvent = this.normalizeEventForDisplay(event);
    this.appStorage.state.auditEvents.unshift(normalizedEvent);
    this.appStorage.persist();
    return normalizedEvent;
  }

  list(): AuditEventRecord[] {
    return [...this.appStorage.state.auditEvents];
  }

  /**
   * 为旧写入口补齐用户行为审计列表需要的通用展示字段。
   * 设计原因：本次修复不能逐条重构所有业务链路，仓储层只基于现有字段做无副作用兜底。
   */
  private normalizeEventForDisplay(event: AuditEventRecord): AuditEventRecord {
    return {
      ...event,
      actorBindingStatus:
        event.actorBindingStatus ??
        (event.actorId.startsWith('system:') ? 'SYSTEM' : undefined),
      actionSummary: event.actionSummary ?? event.outcome,
      targetType: event.targetType ?? event.resourceType ?? this.resolveRelatedTargetType(event),
      targetId: event.targetId ?? event.resourceId ?? this.resolveRelatedTargetId(event),
      targetSummary:
        event.targetSummary ??
        event.originalQuestion ??
        event.resourceId ??
        this.resolveRelatedTargetId(event),
    };
  }

  private resolveRelatedTargetType(event: AuditEventRecord): string | undefined {
    if (event.relatedRequestId) {
      return 'analysis-query';
    }
    if (event.relatedTemplateId) {
      return 'query-template';
    }
    if (event.relatedHistoryId) {
      return 'recent-query';
    }
    return undefined;
  }

  private resolveRelatedTargetId(event: AuditEventRecord): string | undefined {
    return event.relatedRequestId ?? event.relatedTemplateId ?? event.relatedHistoryId;
  }
}

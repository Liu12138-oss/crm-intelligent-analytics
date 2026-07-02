import { Injectable } from '@nestjs/common';
import type {
  CrmUser,
  DailyReportDeliveryRecord,
  DailyReportRecord,
  DailyReportReminderRecord,
  DailyReportSummaryBatchRecord,
  DailyReportSummaryGroupRecord,
} from '../../shared/types/domain';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';
import { buildEntityId } from '../../shared/utils/id.util';
import { ProactiveNotificationService } from '../notifications/proactive-notification.service';

@Injectable()
export class DailyReportDispatcherService {
  constructor(
    private readonly localRuntimeConfigService: LocalRuntimeConfigService,
    private readonly proactiveNotificationService: ProactiveNotificationService,
  ) {}

  async dispatchPersonalConfirmation(
    actor: CrmUser,
    report: DailyReportRecord,
  ): Promise<{
    delivery: DailyReportDeliveryRecord;
    outcome: 'SENT' | 'FAILED' | 'SKIPPED';
  }> {
    const contentPreview = `${report.draftTitle}：${report.draftSummary.slice(0, 120)}`;
    if (!this.localRuntimeConfigService.getDailyReportConfig().enabled) {
      return {
        delivery: {
          id: buildEntityId('daily_report_delivery'),
          deliveryType: 'PERSONAL_CONFIRMATION',
          targetUserId: report.requesterId,
          targetUserName: report.requesterName,
          status: 'SKIPPED',
          contentPreview,
          failureReason: '日报功能开关已关闭，已跳过 22 点个人日报确认发送。',
        },
        outcome: 'SKIPPED',
      };
    }

    const task = await this.proactiveNotificationService.dispatch({
      actor,
      sceneKey: 'daily-report.personal-confirmation',
      title: report.draftTitle,
      audience: {
        type: 'CRM_USER',
        crmUserIds: [report.requesterId],
      },
      dedupeKey: `${report.requesterId}:${report.businessDate}:personal-confirmation`,
      metadata: {
        deliveryClass: 'SYSTEM_SCHEDULED',
        notificationLabel: '【日报确认】',
        actionHints: ['确认日报', '补充说明', '稍后确认'],
        suppressActionHints: true,
      },
      message: {
        msgtype: 'markdown',
        content: [
          `辛苦了，${report.requesterName}。我先根据你今天更新的 CRM 数据整理了一版日报摘要，请你看一下是否准确：`,
          '',
          report.draftSummary,
          '',
          '如果内容没问题，请忽略本条消息；如果还想补充，你也可以继续写跟进，我会帮您将数据同步到CRM。',
        ].join('\n'),
      },
    });

    const deliveredAt = new Date().toISOString();
    const delivery: DailyReportDeliveryRecord = {
      id: buildEntityId('daily_report_delivery'),
      deliveryType: 'PERSONAL_CONFIRMATION',
      targetUserId: report.requesterId,
      targetUserName: report.requesterName,
      status: this.resolveDeliveryStatus(task.status),
      contentPreview,
      deliveredAt: this.isSuccessfulTask(task.status) ? deliveredAt : undefined,
      failureReason:
        this.isSuccessfulTask(task.status) ? undefined : task.failureReason,
    };

    return {
      delivery,
      outcome: delivery.status === 'SENT' ? 'SENT' : 'FAILED',
    };
  }

  async dispatchFriendlyReminder(params: {
    actor: CrmUser;
    recipient: CrmUser;
    businessDate: string;
  }): Promise<{
    reminder?: DailyReportReminderRecord;
    outcome: 'SENT' | 'FAILED' | 'SKIPPED';
    reason?: string;
    notificationTaskId?: string;
    resolvedChannel?: string;
    lastAttemptAt?: string;
  }> {
    const messageText = [
      `晚上好，${params.recipient.name}。`,
      '我这边还没有同步到你今天的 CRM 跟进、新增客户或新增商机记录。',
      '如果你今天已经有相关进展，辛苦抽空补录一下，我再帮你自动整理成日报。',
    ].join('\n');

    if (!this.localRuntimeConfigService.getDailyReportConfig().enabled) {
      return {
        outcome: 'SKIPPED',
        reason: '日报功能开关已关闭，已跳过 22 点催报提醒发送。',
      };
    }

    const task = await this.proactiveNotificationService.dispatch({
      actor: params.actor,
      sceneKey: 'daily-report.missing-source-reminder',
      title: `${params.businessDate} 日报温馨提醒`,
      audience: {
        type: 'CRM_USER',
        crmUserIds: [params.recipient.id],
      },
      dedupeKey: `${params.recipient.id}:${params.businessDate}:missing-source-reminder`,
      metadata: {
        deliveryClass: 'SYSTEM_SCHEDULED',
        notificationLabel: '【日报提醒】',
        actionHints: ['立即补录', '稍后处理'],
        suppressActionHints: true,
      },
      message: {
        msgtype: 'markdown',
        content: messageText,
      },
    });

    if (!this.isSuccessfulTask(task.status)) {
      return {
        outcome: 'FAILED',
        reason: task.failureReason ?? '22 点催报提醒发送失败。',
        notificationTaskId: task.id,
        resolvedChannel: task.resolvedChannel,
        lastAttemptAt: task.lastAttemptAt,
      };
    }

    return {
      reminder: {
        id: buildEntityId('daily_report_reminder'),
        reminderType: 'REMINDER_22_00',
        recipientId: params.recipient.id,
        sentAt: new Date().toISOString(),
        dedupeKey: `${params.recipient.id}:${params.businessDate}:missing-source-reminder`,
        messageText,
      },
      outcome: 'SENT',
      notificationTaskId: task.id,
      resolvedChannel: task.resolvedChannel,
      lastAttemptAt: task.lastAttemptAt,
    };
  }

  async dispatchSupervisorDelivery(
    actor: CrmUser,
    report: DailyReportRecord,
  ): Promise<{
    delivery: DailyReportDeliveryRecord;
    outcome: 'SENT' | 'FAILED' | 'SKIPPED';
  }> {
    const contentPreview = `${report.draftTitle}：${report.draftSummary.slice(0, 120)}`;
    if (!this.localRuntimeConfigService.getDailyReportConfig().enabled) {
      return {
        delivery: {
          id: buildEntityId('daily_report_delivery'),
          deliveryType: 'SUPERVISOR_DELIVERY',
          targetUserId: report.supervisorId,
          targetUserName: report.supervisorName,
          status: 'SKIPPED',
          contentPreview,
          failureReason: '日报功能开关已关闭，已跳过正式对上发送。',
        },
        outcome: 'SKIPPED',
      };
    }

    const task = await this.proactiveNotificationService.dispatch({
      actor,
      sceneKey: 'daily-report.supervisor-delivery',
      title: report.draftTitle,
      audience: {
        type: 'CRM_USER',
        crmUserIds: [report.supervisorId],
      },
      dedupeKey: `${report.id}:${report.confirmation?.confirmedAt ?? report.updatedAt}:supervisor-delivery`,
      metadata: {
        deliveryClass: 'SYSTEM_SCHEDULED',
        notificationLabel: '【日报推送】',
        suppressActionHints: true,
      },
      message: {
        msgtype: 'markdown',
        content: [
          `${report.supervisorName ?? '主管'}，你好。`,
          `${report.requesterName} 已确认 ${report.businessDate} 的日报，请查收：`,
          '',
          report.draftSummary,
        ].join('\n'),
      },
    });

    const delivery: DailyReportDeliveryRecord = {
      id: buildEntityId('daily_report_delivery'),
      deliveryType: 'SUPERVISOR_DELIVERY',
      targetUserId: report.supervisorId,
      targetUserName: report.supervisorName,
      status: this.resolveDeliveryStatus(task.status),
      contentPreview,
      deliveredAt: this.isSuccessfulTask(task.status) ? new Date().toISOString() : undefined,
      failureReason: this.isSuccessfulTask(task.status) ? undefined : task.failureReason,
    };

    return {
      delivery,
      outcome:
        delivery.status === 'SENT'
          ? 'SENT'
          : delivery.status === 'SKIPPED'
            ? 'SKIPPED'
            : 'FAILED',
    };
  }

  dispatchReminder(report: DailyReportRecord): DailyReportDeliveryRecord {
    return {
      id: buildEntityId('daily_report_reminder_delivery'),
      deliveryType: 'REMINDER',
      targetUserId: report.requesterId,
      targetUserName: report.requesterName,
      status: 'SENT',
      contentPreview: `日报提醒：${report.draftTitle} 仍未确认，请尽快完成当日收口。`,
      deliveredAt: new Date().toISOString(),
    };
  }

  async dispatchSummaryBatch(
    batch: DailyReportSummaryBatchRecord,
    recipientSummaries: Array<{
      recipient: CrmUser;
      summaryText: string;
    }>,
    actor: CrmUser,
  ): Promise<{
    batch: DailyReportSummaryBatchRecord;
    deliveries: DailyReportDeliveryRecord[];
  }> {
    if (!this.localRuntimeConfigService.getDailyReportConfig().enabled) {
      return {
        batch: {
          ...batch,
          deliveryStatus: 'FAILED',
          deliveredAt: undefined,
          failureReason: '日报功能开关已关闭，已跳过团队汇总推送。',
        },
        deliveries: [],
      };
    }

    if (batch.groupSummaries.length > 0) {
      return await this.dispatchGroupedSummaryBatch(batch, actor);
    }

    if (recipientSummaries.length === 0) {
      return {
        batch: {
          ...batch,
          deliveryStatus: 'FAILED',
          deliveredAt: undefined,
          failureReason: '没有可接收汇总的目标人员。',
        },
        deliveries: [],
      };
    }

    const deliveries: DailyReportDeliveryRecord[] = [];
    let hasSuccessfulDelivery = false;
    const notifyConfig = this.localRuntimeConfigService.getWecomNotifyConfig();

    if (!notifyConfig.realMessageEnabled) {
      const mergedSummaryText = this.buildMergedTestSummaryMessage(
        batch,
        recipientSummaries,
        notifyConfig.testReceiverUserId,
      );
      const task = await this.proactiveNotificationService.dispatch({
        actor,
        sceneKey: 'daily-report.team-summary.test',
        title: `${batch.businessDate} 销售组汇总测试`,
        audience: {
          type: 'WECOM_USER',
          wecomUserIds: [notifyConfig.testReceiverUserId],
        },
        dedupeKey: `${batch.businessDate}:team-summary:test:${notifyConfig.testReceiverUserId}`,
        metadata: {
          deliveryClass: 'SYSTEM_SCHEDULED',
          notificationLabel: '【日报汇总】',
          suppressActionHints: true,
        },
        message: {
          msgtype: 'markdown',
          content: mergedSummaryText,
        },
      });

      const delivery: DailyReportDeliveryRecord = {
        id: buildEntityId('daily_report_summary_delivery'),
        deliveryType: 'SUMMARY_BATCH',
        targetUserId: notifyConfig.testReceiverUserId,
        targetUserName: `测试接收人（${notifyConfig.testReceiverUserId}）`,
        status: this.resolveDeliveryStatus(task.status),
        contentPreview: mergedSummaryText.slice(0, 120),
        deliveredAt: this.isSuccessfulTask(task.status)
          ? new Date().toISOString()
          : undefined,
        failureReason:
          this.isSuccessfulTask(task.status) ? undefined : task.failureReason,
      };

      return {
        batch: {
          ...batch,
          deliveryStatus: delivery.status === 'SENT' ? 'SENT' : 'FAILED',
          deliveredAt: delivery.deliveredAt,
          failureReason: delivery.failureReason,
        },
        deliveries: [delivery],
      };
    }

    for (const item of recipientSummaries) {
      const task = await this.proactiveNotificationService.dispatch({
        actor,
        sceneKey: 'daily-report.team-summary',
        title: `${batch.businessDate} 销售组汇总`,
        audience: {
          type: 'CRM_USER',
          crmUserIds: [item.recipient.id],
        },
        dedupeKey: `${item.recipient.id}:${batch.businessDate}:team-summary`,
        metadata: {
          deliveryClass: 'SYSTEM_SCHEDULED',
          notificationLabel: '【日报汇总】',
          suppressActionHints: true,
        },
        message: {
          msgtype: 'markdown',
          content: item.summaryText,
        },
      });

      const delivery: DailyReportDeliveryRecord = {
        id: buildEntityId('daily_report_summary_delivery'),
        deliveryType: 'SUMMARY_BATCH',
        targetUserId: item.recipient.id,
        targetUserName: item.recipient.name,
        status: this.resolveDeliveryStatus(task.status),
        contentPreview: item.summaryText.slice(0, 120),
        deliveredAt: this.isSuccessfulTask(task.status)
          ? new Date().toISOString()
          : undefined,
        failureReason:
          this.isSuccessfulTask(task.status) ? undefined : task.failureReason,
      };
      deliveries.push(delivery);
      if (delivery.status === 'SENT') {
        hasSuccessfulDelivery = true;
      }
    }

    return {
      batch: {
        ...batch,
        deliveryStatus: hasSuccessfulDelivery ? 'SENT' : 'FAILED',
        deliveredAt: hasSuccessfulDelivery ? new Date().toISOString() : undefined,
        failureReason: hasSuccessfulDelivery
          ? undefined
          : deliveries[0]?.failureReason ?? '日报组长汇总发送失败。',
      },
      deliveries,
    };
  }

  private async dispatchGroupedSummaryBatch(
    batch: DailyReportSummaryBatchRecord,
    actor: CrmUser,
  ): Promise<{
    batch: DailyReportSummaryBatchRecord;
    deliveries: DailyReportDeliveryRecord[];
  }> {
    const deliveries: DailyReportDeliveryRecord[] = [];
    const notifyConfig = this.localRuntimeConfigService.getWecomNotifyConfig();
    const deliverableGroups = batch.groupSummaries.filter(
      (item) =>
        item.deliveryStatus === 'READY' &&
        this.pickDeliverableGroupRecipientCrmUserIds(item).length > 0,
    );
    const blockedGroups = batch.groupSummaries.filter(
      (item) => item.deliveryStatus === 'BLOCKED',
    );

    for (const group of blockedGroups) {
      deliveries.push({
        id: buildEntityId('daily_report_summary_delivery'),
        deliveryType: 'SUMMARY_BATCH',
        targetUserId:
          this.pickDeliverableGroupRecipientCrmUserIds(group)[0] ??
          group.recipientCrmUserId ??
          group.groupDepartmentId,
        targetUserName: this.formatGroupRecipientNames(group),
        status: 'FAILED',
        contentPreview: group.summaryText.slice(0, 120),
        failureReason: group.deliveryReason,
      });
    }

    if (deliverableGroups.length === 0) {
      return {
        batch: {
          ...batch,
          deliveryStatus: 'FAILED',
          deliveredAt: undefined,
          failureReason:
            blockedGroups[0]?.deliveryReason ?? '没有可接收汇总的目标人员。',
        },
        deliveries,
      };
    }

    if (!notifyConfig.realMessageEnabled) {
      const mergedSummaryText = this.buildMergedTestSummaryMessageForGroups(
        batch,
        deliverableGroups,
        notifyConfig.testReceiverUserId,
      );
      const task = await this.proactiveNotificationService.dispatch({
        actor,
        sceneKey: 'daily-report.team-summary.test',
        title: `${batch.businessDate} 销售组汇总测试`,
        audience: {
          type: 'WECOM_USER',
          wecomUserIds: [notifyConfig.testReceiverUserId],
        },
        dedupeKey: `${batch.businessDate}:team-summary:test:${notifyConfig.testReceiverUserId}`,
        metadata: {
          deliveryClass: 'SYSTEM_SCHEDULED',
          notificationLabel: '【日报汇总】',
          suppressActionHints: true,
        },
        message: {
          msgtype: 'markdown',
          content: mergedSummaryText,
        },
      });

      const deliveryStatus = this.resolveDeliveryStatus(task.status);
      const deliveredAt =
        deliveryStatus === 'SENT' ? new Date().toISOString() : undefined;
      deliveries.push({
        id: buildEntityId('daily_report_summary_delivery'),
        deliveryType: 'SUMMARY_BATCH',
        targetUserId: notifyConfig.testReceiverUserId,
        targetUserName: `测试接收人（${notifyConfig.testReceiverUserId}）`,
        status: deliveryStatus,
        contentPreview: mergedSummaryText.slice(0, 120),
        deliveredAt,
        failureReason:
          deliveryStatus === 'SENT' ? undefined : task.failureReason,
      });

      return {
        batch: {
          ...batch,
          groupSummaries: batch.groupSummaries.map((item) =>
            item.deliveryStatus === 'READY'
              ? {
                  ...item,
                  deliveryStatus:
                    deliveryStatus === 'SENT' ? 'SENT' : 'FAILED',
                  deliveryReason:
                    deliveryStatus === 'SENT'
                      ? undefined
                      : task.failureReason,
                }
              : item,
          ),
          deliveryStatus: deliveryStatus === 'SENT' ? 'SENT' : 'FAILED',
          deliveredAt,
          failureReason:
            deliveryStatus === 'SENT' ? undefined : task.failureReason,
        },
        deliveries,
      };
    }

    const updatedGroups = [...batch.groupSummaries];
    let hasSuccessfulDelivery = false;
    for (const group of deliverableGroups) {
      const recipientCrmUserIds =
        this.pickDeliverableGroupRecipientCrmUserIds(group);
      const recipientName = this.formatGroupRecipientNames(group);
      const task = await this.proactiveNotificationService.dispatch({
        actor,
        sceneKey: 'daily-report.team-summary',
        title: `${batch.businessDate} 销售组汇总`,
        audience: {
          type: 'CRM_USER',
          crmUserIds: recipientCrmUserIds,
        },
        dedupeKey: `${group.groupDepartmentId}:${batch.businessDate}:team-summary:${recipientCrmUserIds.join(',')}`,
        metadata: {
          deliveryClass: 'SYSTEM_SCHEDULED',
          notificationLabel: '【日报汇总】',
          suppressActionHints: true,
          dailyReportGroupDepartmentId: group.groupDepartmentId,
          dailyReportRecipientName: recipientName,
        },
        message: {
          msgtype: 'markdown',
          content: group.summaryText,
        },
      });

      const deliveryStatus = this.resolveDeliveryStatus(task.status);
      recipientCrmUserIds.forEach((recipientCrmUserId, index) => {
        deliveries.push({
          id: buildEntityId('daily_report_summary_delivery'),
          deliveryType: 'SUMMARY_BATCH',
          targetUserId: recipientCrmUserId,
          targetUserName:
            group.recipientNames?.[index] ?? group.recipientName ?? recipientName,
          status: deliveryStatus,
          contentPreview: group.summaryText.slice(0, 120),
          deliveredAt:
            deliveryStatus === 'SENT' ? new Date().toISOString() : undefined,
          failureReason:
            deliveryStatus === 'SENT' ? undefined : task.failureReason,
        });
      });

      const currentIndex = updatedGroups.findIndex(
        (item) => item.groupDepartmentId === group.groupDepartmentId,
      );
      if (currentIndex >= 0) {
        updatedGroups[currentIndex] = {
          ...updatedGroups[currentIndex],
          deliveryStatus: deliveryStatus === 'SENT' ? 'SENT' : 'FAILED',
          deliveryReason:
            deliveryStatus === 'SENT' ? undefined : task.failureReason,
        };
      }
      if (deliveryStatus === 'SENT') {
        hasSuccessfulDelivery = true;
      }
    }

    return {
      batch: {
        ...batch,
        groupSummaries: updatedGroups,
        deliveryStatus: hasSuccessfulDelivery ? 'SENT' : 'FAILED',
        deliveredAt: hasSuccessfulDelivery ? new Date().toISOString() : undefined,
        failureReason: hasSuccessfulDelivery
          ? undefined
          : deliveries.find((item) => item.failureReason)?.failureReason ??
            '日报组长汇总发送失败。',
      },
      deliveries,
    };
  }

  /**
   * 读取日报小组可投递的组长 CRM 用户 ID，兼容旧单人字段和新多人字段。
   */
  private pickDeliverableGroupRecipientCrmUserIds(
    group: DailyReportSummaryGroupRecord,
  ): string[] {
    return Array.from(
      new Set([
        ...(group.recipientCrmUserIds ?? []),
        ...(group.recipientCrmUserId ? [group.recipientCrmUserId] : []),
      ].filter(Boolean)),
    );
  }

  /**
   * 展示日报小组组长姓名，多人收件时用于测试消息、审计和投递记录。
   */
  private formatGroupRecipientNames(group: DailyReportSummaryGroupRecord): string {
    const names = [
      ...(group.recipientNames ?? []),
      ...(group.recipientName ? [group.recipientName] : []),
    ].filter(Boolean);
    return Array.from(new Set(names)).join('、') || '未配置收件人';
  }

  private resolveDeliveryStatus(
    taskStatus: 'PENDING' | 'SENT' | 'PARTIAL_FAILED' | 'FAILED' | 'BLOCKED' | 'DEDUPED',
  ): DailyReportDeliveryRecord['status'] {
    return this.isSuccessfulTask(taskStatus) ? 'SENT' : 'FAILED';
  }

  private isSuccessfulTask(taskStatus: string): boolean {
    return (
      taskStatus === 'SENT' ||
      taskStatus === 'DEDUPED' ||
      taskStatus === 'PARTIAL_FAILED'
    );
  }

  private buildMergedTestSummaryMessage(
    batch: DailyReportSummaryBatchRecord,
    recipientSummaries: Array<{
      recipient: CrmUser;
      summaryText: string;
    }>,
    testReceiverUserId: string,
  ): string {
    return [
      `开发阶段测试消息：当前销售组汇总统一先发送给 ${testReceiverUserId} 验证，不触达真实组长。`,
      '',
      `原计划接收组长：${recipientSummaries.map((item) => item.recipient.name).join('、')}`,
      '',
      ...recipientSummaries.flatMap((item, index) => [
        `==== 第 ${index + 1} 组 / 目标组长：${item.recipient.name} ====`,
        item.summaryText,
        '',
      ]),
      `汇总批次预览：${batch.summaryText}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildMergedTestSummaryMessageForGroups(
    batch: DailyReportSummaryBatchRecord,
    groups: DailyReportSummaryBatchRecord['groupSummaries'],
    testReceiverUserId: string,
  ): string {
    return [
      `开发阶段测试消息：当前销售组汇总统一先发送给 ${testReceiverUserId} 验证，不触达真实组长。`,
      '',
      `原计划接收组长：${groups.map((item) => this.formatGroupRecipientNames(item)).join('、')}`,
      '',
      ...groups.flatMap((item, index) => [
        `==== 第 ${index + 1} 组 / 销售小组：${item.groupDepartmentName} / 目标组长：${this.formatGroupRecipientNames(item)} ====`,
        item.summaryText,
        '',
      ]),
      `汇总批次预览：${batch.summaryText}`,
    ]
      .filter(Boolean)
      .join('\n');
  }
}

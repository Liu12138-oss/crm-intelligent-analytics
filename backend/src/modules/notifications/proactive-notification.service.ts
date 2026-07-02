import { Injectable } from '@nestjs/common';
import { CrmReadonlyService } from '../../database/crm-readonly/crm-readonly.service';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import type {
  CrmUser,
  ProactiveNotificationAttemptRecord,
  ProactiveNotificationChannel,
  ProactiveNotificationKind,
  ProactiveNotificationRecipientSnapshot,
  ProactiveNotificationTaskRecord,
} from '../../shared/types/domain';
import { buildEntityId } from '../../shared/utils/id.util';
import { AuditEventRepository } from '../audit/audit-event.repository';
import { UserScopeService } from '../auth/user-scope.service';
import type {
  DispatchProactiveNotificationInput,
  DispatchProactiveNotificationResult,
  ProactiveNotificationAudience,
  ProactiveNotificationChannelSendResult,
} from './proactive-notification.types';
import { NotificationSendQueue } from './notification-send-queue';
import { ProactiveNotificationRepository } from './proactive-notification.repository';
import { WecomAppMessageService } from './wecom-app-message.service';
import { WecomBotNotificationService } from './wecom-bot-notification.service';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';

interface QueuedNotificationSendResult {
  result: ProactiveNotificationChannelSendResult;
  startedAt: string;
  completedAt: string;
}

@Injectable()
export class ProactiveNotificationService {
  private readonly botSendQueue = new NotificationSendQueue();
  private readonly appMessageSendQueue = new NotificationSendQueue();

  constructor(
    private readonly proactiveNotificationRepository: ProactiveNotificationRepository,
    private readonly wecomBotNotificationService: WecomBotNotificationService,
    private readonly wecomAppMessageService: WecomAppMessageService,
    private readonly localRuntimeConfigService: LocalRuntimeConfigService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly userScopeService: UserScopeService,
    private readonly crmReadonlyService: CrmReadonlyService,
    private readonly analysisLoggerService: AnalysisLoggerService,
  ) {}

  async dispatch(
    input: DispatchProactiveNotificationInput,
  ): Promise<DispatchProactiveNotificationResult> {
    const createdAt = new Date().toISOString();
    const resolvedKind: ProactiveNotificationKind = input.kind ?? 'FORMAL';
    const messagePresentation = this.resolveMessagePresentation(input, resolvedKind);
    const effectiveMessage = this.decorateMessage(
      input.message,
      input.title,
      messagePresentation.label,
      messagePresentation.actionHints,
    );

    if (input.dedupeKey) {
      const duplicated = this.proactiveNotificationRepository.findLatestByDedupeKey(
        input.dedupeKey,
      );
      if (duplicated) {
        const dedupedTask: ProactiveNotificationTaskRecord = {
          id: buildEntityId('notify_task'),
          sceneKey: input.sceneKey,
          title: input.title,
          kind: resolvedKind,
          preferredChannel: input.preferredChannel,
          resolvedChannel: duplicated.resolvedChannel,
          messageType: effectiveMessage.msgtype,
          markdownContent:
            effectiveMessage.msgtype === 'markdown'
              ? effectiveMessage.content
              : undefined,
          templateCardPayload:
            effectiveMessage.msgtype === 'template_card'
              ? effectiveMessage.payload
              : undefined,
          dedupeKey: input.dedupeKey,
          duplicateOfTaskId: duplicated.id,
          status: 'DEDUPED',
          originalAudienceSummary: this.buildAudienceSummary(input.audience),
          testModeApplied: duplicated.testModeApplied,
          realMessageEnabled: duplicated.realMessageEnabled,
          recipientSnapshots: [...duplicated.recipientSnapshots],
          attempts: [],
          metadata: {
            ...input.metadata,
            notificationLabel: messagePresentation.label,
            actionHints: messagePresentation.actionHints,
            interactionMode: 'DETACHED_UNTIL_INTERACTION',
          },
          failureReason: `通知任务幂等命中，已复用 ${duplicated.id}。`,
          createdAt,
        };
        this.proactiveNotificationRepository.save(dedupedTask);
        this.audit(
          input.actor,
          'PROACTIVE_NOTIFICATION_DEDUPED',
          dedupedTask.failureReason ?? '通知任务幂等命中。',
          {
          notificationTaskId: dedupedTask.id,
          duplicateOfTaskId: duplicated.id,
          dedupeKey: input.dedupeKey,
          },
        );
        return dedupedTask;
      }
    }

    const resolvedChannel = this.resolveChannel(input);
    const routedMessage = this.appendAppMessageFollowUpHint(
      effectiveMessage,
      resolvedChannel,
    );
    const notifyConfig = this.localRuntimeConfigService.getWecomNotifyConfig();
    const resolvedRecipients = await this.resolveRecipients(input);
    const effectiveRecipients = this.applyTestReceiverOverride(
      resolvedRecipients,
      notifyConfig.realMessageEnabled,
      notifyConfig.testReceiverUserId,
    );

    const task: ProactiveNotificationTaskRecord = {
      id: buildEntityId('notify_task'),
      sceneKey: input.sceneKey,
      title: input.title,
      kind: resolvedKind,
      preferredChannel: input.preferredChannel,
      resolvedChannel,
      messageType: routedMessage.msgtype,
      markdownContent:
        routedMessage.msgtype === 'markdown'
          ? routedMessage.content
          : undefined,
      templateCardPayload:
        routedMessage.msgtype === 'template_card'
          ? routedMessage.payload
          : undefined,
      dedupeKey: input.dedupeKey,
      status: 'PENDING',
      originalAudienceSummary: this.buildAudienceSummary(input.audience),
      testModeApplied:
        !notifyConfig.realMessageEnabled &&
        effectiveRecipients.some((item) => item.status === 'TEST_OVERRIDDEN'),
      realMessageEnabled: notifyConfig.realMessageEnabled,
      recipientSnapshots: effectiveRecipients,
      attempts: [],
      metadata: {
        ...input.metadata,
        notificationLabel: messagePresentation.label,
        actionHints: messagePresentation.actionHints,
        interactionMode: 'DETACHED_UNTIL_INTERACTION',
      },
      createdAt,
    };
    this.proactiveNotificationRepository.save(task);
    this.audit(input.actor, 'PROACTIVE_NOTIFICATION_REQUESTED', '主动通知任务已创建。', {
      notificationTaskId: task.id,
      sceneKey: task.sceneKey,
      resolvedChannel,
    });

    const deliverableRecipients = effectiveRecipients.filter(
      (item) => item.status === 'READY' || item.status === 'TEST_OVERRIDDEN',
    );
    if (deliverableRecipients.length === 0) {
      const blockedTask = this.proactiveNotificationRepository.save({
        ...task,
        status: 'BLOCKED',
        failureReason:
          effectiveRecipients[0]?.resolutionReason ?? '没有可发送的通知接收人。',
      });
      this.audit(
        input.actor,
        'PROACTIVE_NOTIFICATION_BLOCKED',
        blockedTask.failureReason ?? '主动通知已阻断。',
        {
          notificationTaskId: blockedTask.id,
          sceneKey: blockedTask.sceneKey,
        },
      );
      return blockedTask;
    }

    const attempts: ProactiveNotificationAttemptRecord[] = [];
    let sentCount = 0;
    let failedCount = 0;
    for (const recipient of effectiveRecipients) {
      if (recipient.status === 'BLOCKED') {
        attempts.push({
          id: buildEntityId('notify_attempt'),
          recipientSnapshotId: recipient.id,
          channel: resolvedChannel,
          status: 'SKIPPED',
          attemptCount: 0,
          failureReason: recipient.resolutionReason,
          createdAt,
        });
        failedCount += 1;
        continue;
      }

      const attempt = await this.deliverWithRetry(
        recipient,
        resolvedChannel,
        {
          ...input,
          message: routedMessage,
        },
        notifyConfig.realMessageEnabled,
      );
      attempts.push(attempt);
      if (attempt.status === 'SENT') {
        sentCount += 1;
      } else {
        failedCount += 1;
      }
    }

    const completedTask = this.proactiveNotificationRepository.save({
      ...task,
      attempts,
      status:
        sentCount > 0 && failedCount === 0
          ? 'SENT'
          : sentCount > 0
            ? 'PARTIAL_FAILED'
            : 'FAILED',
      failureReason:
        sentCount === 0
          ? attempts.find((item) => item.failureReason)?.failureReason
          : undefined,
      lastAttemptAt: new Date().toISOString(),
      sentAt: sentCount > 0 ? new Date().toISOString() : undefined,
    });

    if (completedTask.status === 'SENT') {
      this.audit(input.actor, 'PROACTIVE_NOTIFICATION_SENT', '主动通知已发送。', {
        notificationTaskId: completedTask.id,
        sceneKey: completedTask.sceneKey,
        resolvedChannel,
        sentCount,
      });
    } else {
      const failedAttempts = attempts.filter((item) => item.status === 'FAILED');
      const representativeFailure = failedAttempts.find((item) => item.failureReason);
      this.audit(input.actor, 'PROACTIVE_NOTIFICATION_FAILED', '主动通知发送失败或部分失败。', {
        notificationTaskId: completedTask.id,
        sceneKey: completedTask.sceneKey,
        resolvedChannel,
        sentCount,
        failedCount,
        failureReason: completedTask.failureReason,
        retryCount: Math.max(
          0,
          Math.max(...failedAttempts.map((item) => item.attemptCount), 1) - 1,
        ),
        lastAttemptAt: completedTask.lastAttemptAt,
        externalErrorCode: representativeFailure?.externalErrorCode,
        externalErrorMessage: representativeFailure?.externalErrorMessage,
      });
    }

    return completedTask;
  }

  list(): ProactiveNotificationTaskRecord[] {
    return this.proactiveNotificationRepository.list();
  }

  private resolveChannel(
    input: DispatchProactiveNotificationInput,
  ): ProactiveNotificationChannel {
    const deliveryClass = this.resolveDeliveryClass(input);
    if (
      input.kind === 'CONVERSATION_CONTEXT' ||
      deliveryClass === 'CONVERSATION_CONTEXT' ||
      input.audience.type === 'WECOM_CONVERSATION'
    ) {
      return 'WECOM_BOT_MESSAGE';
    }

    if (
      input.preferredChannel === 'WECOM_BOT_MESSAGE' &&
      deliveryClass !== 'SYSTEM_SCHEDULED'
    ) {
      return 'WECOM_BOT_MESSAGE';
    }

    return 'WECOM_APP_MESSAGE';
  }

  private async resolveRecipients(
    input: DispatchProactiveNotificationInput,
  ): Promise<ProactiveNotificationRecipientSnapshot[]> {
    if (input.audience.type === 'CRM_USER') {
      const recipients = await Promise.all(
        input.audience.crmUserIds.map(async (crmUserId) => {
          const user = await this.crmReadonlyService.getUserById(crmUserId);
          if (!user) {
            return this.buildBlockedRecipient('CRM_USER', crmUserId, '未找到对应的 CRM 用户。');
          }

          const wecomUserId =
            await this.crmReadonlyService.getWecomSenderIdByUserId(crmUserId);
          if (!wecomUserId) {
            return this.buildBlockedRecipient(
              'CRM_USER',
              crmUserId,
              '当前 CRM 用户缺少可用的企业微信映射。',
              {
                crmUserId,
                displayName: user.name,
              },
            );
          }

          if (input.recipientGuard) {
            const guardResult = input.recipientGuard({
              recipient: user,
              audience: input.audience,
            });
            if (!guardResult.allowed) {
              return this.buildBlockedRecipient(
                'CRM_USER',
                wecomUserId,
                guardResult.reason ?? '当前接收人不满足通知权限条件。',
                {
                  crmUserId,
                  wecomUserId,
                  displayName: user.name,
                },
              );
            }
          }

          const readyRecipient: ProactiveNotificationRecipientSnapshot = {
            id: buildEntityId('notify_recipient'),
            recipientType: 'CRM_USER',
            status: 'READY',
            displayName: user.name,
            crmUserId,
            wecomUserId,
            deliveryTargetId: wecomUserId,
          };
          return readyRecipient;
        }),
      );
      return recipients;
    }

    if (input.audience.type === 'WECOM_USER') {
      return input.audience.wecomUserIds.map((wecomUserId) => ({
        id: buildEntityId('notify_recipient'),
        recipientType: 'WECOM_USER',
        status: 'READY',
        wecomUserId,
        deliveryTargetId: wecomUserId,
      }));
    }

    if (input.audience.type === 'WECOM_PARTY') {
      return input.audience.partyIds.map((partyId) => ({
        id: buildEntityId('notify_recipient'),
        recipientType: 'WECOM_PARTY',
        status: 'READY',
        partyId,
        deliveryTargetId: partyId,
      }));
    }

    if (input.audience.type === 'WECOM_TAG') {
      return input.audience.tagIds.map((tagId) => ({
        id: buildEntityId('notify_recipient'),
        recipientType: 'WECOM_TAG',
        status: 'READY',
        tagId,
        deliveryTargetId: tagId,
      }));
    }

    return [
      {
        id: buildEntityId('notify_recipient'),
        recipientType: 'WECOM_CONVERSATION',
        status: 'READY',
        displayName: input.audience.displayName,
        deliveryTargetId: input.audience.deliveryTargetId,
        chatType: input.audience.chatType,
        wecomUserId:
          input.audience.chatType === 'single'
            ? input.audience.deliveryTargetId
            : undefined,
        externalConversationId: input.audience.externalConversationId,
      },
    ];
  }

  private applyTestReceiverOverride(
    recipients: ProactiveNotificationRecipientSnapshot[],
    realMessageEnabled: boolean,
    testReceiverUserId: string,
  ): ProactiveNotificationRecipientSnapshot[] {
    if (realMessageEnabled) {
      return recipients;
    }

    const blockedRecipients = recipients.filter((item) => item.status === 'BLOCKED');
    const deliverableRecipients = recipients.filter((item) => item.status !== 'BLOCKED');
    if (deliverableRecipients.length === 0) {
      return recipients;
    }

    return [
      ...blockedRecipients,
      {
        id: buildEntityId('notify_recipient'),
        recipientType: 'WECOM_USER',
        status: 'TEST_OVERRIDDEN',
        displayName: `测试接收人（${testReceiverUserId}）`,
        wecomUserId: testReceiverUserId,
        deliveryTargetId: testReceiverUserId,
        chatType: 'single',
        externalConversationId: testReceiverUserId,
        resolutionReason: '真实消息发送开关关闭，已改投测试接收人。',
      },
    ];
  }

  private async deliverWithRetry(
    recipient: ProactiveNotificationRecipientSnapshot,
    channel: ProactiveNotificationChannel,
    input: DispatchProactiveNotificationInput,
    realMessageEnabled: boolean,
  ): Promise<ProactiveNotificationAttemptRecord> {
    const wecomConfig = this.localRuntimeConfigService.getWecomRuntimeConfig();
    const notifyConfig = this.localRuntimeConfigService.getWecomNotifyConfig();
    const deliveryConfig =
      channel === 'WECOM_BOT_MESSAGE'
        ? {
            maxAttempts: realMessageEnabled
              ? Math.max(1, wecomConfig.deliveryMaxRetries + 1)
              : 1,
            standardRetryDelayMs: Math.max(
              wecomConfig.deliveryRetryDelayMs,
              wecomConfig.botProactiveMinIntervalMs,
            ),
            minIntervalMs: wecomConfig.botProactiveMinIntervalMs,
            rateLimitRetryDelaysMs: wecomConfig.botRateLimitRetryDelaysMs,
          }
        : {
            maxAttempts: realMessageEnabled
              ? Math.max(1, notifyConfig.appMessageMaxRetries + 1)
              : 1,
            standardRetryDelayMs: notifyConfig.appMessageMinIntervalMs,
            minIntervalMs: notifyConfig.appMessageMinIntervalMs,
            rateLimitRetryDelaysMs: notifyConfig.appMessageRateLimitRetryDelaysMs,
          };
    let lastResult: ProactiveNotificationChannelSendResult = {
      status: 'FAILED',
      failureReason: '主动通知发送失败。',
    };
    let lastAttemptStartedAt = new Date().toISOString();
    let lastAttemptCompletedAt = lastAttemptStartedAt;
    let nextRetryAt: string | undefined;

    for (let attempt = 1; attempt <= deliveryConfig.maxAttempts; attempt += 1) {
      let attemptStartedAt = new Date().toISOString();
      let attemptCompletedAt = attemptStartedAt;
      lastAttemptStartedAt = attemptStartedAt;
      try {
        const queuedResult = await this.sendByResolvedChannel(
          channel,
          recipient,
          input.message,
          realMessageEnabled,
          deliveryConfig.minIntervalMs,
        );
        lastResult = queuedResult.result;
        attemptStartedAt = queuedResult.startedAt;
        attemptCompletedAt = queuedResult.completedAt;
        lastAttemptStartedAt = attemptStartedAt;
      } catch (error) {
        attemptCompletedAt = new Date().toISOString();
        lastResult = {
          status: 'FAILED',
          failureReason:
            error instanceof Error ? error.message : '主动通知发送适配器异常。',
          externalErrorMessage:
            error instanceof Error ? error.message : String(error ?? 'unknown'),
          retryStrategy: 'STANDARD_RETRY',
        };
      }
      lastAttemptCompletedAt = attemptCompletedAt;

      if (
        lastResult.status === 'SENT' &&
        !this.hasInvalidTargets(lastResult)
      ) {
        return {
          id: buildEntityId('notify_attempt'),
          recipientSnapshotId: recipient.id,
          channel,
          status: 'SENT',
          attemptCount: attempt,
          externalMessageId: lastResult.externalMessageId,
          externalErrorCode: lastResult.externalErrorCode,
          externalErrorMessage: lastResult.externalErrorMessage,
          retryStrategy: lastResult.retryStrategy,
          invalidUserIds: lastResult.invalidUserIds,
          invalidPartyIds: lastResult.invalidPartyIds,
          invalidTagIds: lastResult.invalidTagIds,
          createdAt: attemptStartedAt,
          lastAttemptAt: attemptCompletedAt,
          deliveredAt: attemptCompletedAt,
        };
      }

      const retryDelayMs = this.resolveRetryDelayMs(
        lastResult,
        attempt,
        deliveryConfig.standardRetryDelayMs,
        deliveryConfig.rateLimitRetryDelaysMs,
      );
      nextRetryAt = retryDelayMs
        ? new Date(Date.now() + retryDelayMs).toISOString()
        : undefined;
      if (attempt < deliveryConfig.maxAttempts && retryDelayMs > 0) {
        await this.delay(retryDelayMs);
      }
    }

    return {
      id: buildEntityId('notify_attempt'),
      recipientSnapshotId: recipient.id,
      channel,
      status: 'FAILED',
      attemptCount: deliveryConfig.maxAttempts,
      externalMessageId: lastResult.externalMessageId,
      externalErrorCode: lastResult.externalErrorCode,
      externalErrorMessage: lastResult.externalErrorMessage,
      retryStrategy: lastResult.retryStrategy,
      nextRetryAt,
      invalidUserIds: lastResult.invalidUserIds,
      invalidPartyIds: lastResult.invalidPartyIds,
      invalidTagIds: lastResult.invalidTagIds,
      failureReason:
        lastResult.failureReason ??
        (this.hasInvalidTargets(lastResult)
          ? '企业微信返回了无效接收人。'
          : '主动通知发送失败。'),
      createdAt: lastAttemptStartedAt,
      lastAttemptAt: lastAttemptCompletedAt,
    };
  }

  private async sendByResolvedChannel(
    channel: ProactiveNotificationChannel,
    recipient: ProactiveNotificationRecipientSnapshot,
    message: DispatchProactiveNotificationInput['message'],
    realMessageEnabled: boolean,
    minIntervalMs: number,
  ): Promise<QueuedNotificationSendResult> {
    const sendOperation = async (): Promise<QueuedNotificationSendResult> => {
      const startedAt = new Date().toISOString();
      const result =
        channel === 'WECOM_APP_MESSAGE'
          ? await this.wecomAppMessageService.sendMessage({
              recipient,
              message,
              realMessageEnabled,
            })
          : await this.wecomBotNotificationService.sendMessage({
              recipient,
              message,
              realMessageEnabled,
            });
      return {
        result,
        startedAt,
        completedAt: new Date().toISOString(),
      };
    };

    const effectiveMinIntervalMs =
      process.env.NODE_ENV === 'test' ? 0 : minIntervalMs;
    return channel === 'WECOM_APP_MESSAGE'
      ? await this.appMessageSendQueue.enqueue(sendOperation, effectiveMinIntervalMs)
      : await this.botSendQueue.enqueue(sendOperation, effectiveMinIntervalMs);
  }

  private resolveRetryDelayMs(
    result: ProactiveNotificationChannelSendResult,
    attemptIndex: number,
    standardRetryDelayMs: number,
    rateLimitRetryDelaysMs: number[],
  ): number {
    if (result.retryStrategy === 'NONE') {
      return 0;
    }

    if (result.retryStrategy === 'RATE_LIMIT_BACKOFF') {
      return (
        rateLimitRetryDelaysMs[attemptIndex - 1] ??
        rateLimitRetryDelaysMs.at(-1) ??
        result.retryAfterMs ??
        standardRetryDelayMs
      );
    }

    return Math.max(standardRetryDelayMs, result.retryAfterMs ?? 0);
  }

  private hasInvalidTargets(result: ProactiveNotificationChannelSendResult): boolean {
    return Boolean(
      result.invalidUserIds?.length ||
        result.invalidPartyIds?.length ||
        result.invalidTagIds?.length,
    );
  }

  private buildBlockedRecipient(
    recipientType: ProactiveNotificationRecipientSnapshot['recipientType'],
    deliveryTargetId: string,
    resolutionReason: string,
    overrides?: Partial<ProactiveNotificationRecipientSnapshot>,
  ): ProactiveNotificationRecipientSnapshot {
    return {
      id: buildEntityId('notify_recipient'),
      recipientType,
      status: 'BLOCKED',
      deliveryTargetId,
      resolutionReason,
      ...overrides,
    };
  }

  private buildAudienceSummary(audience: ProactiveNotificationAudience): string {
    switch (audience.type) {
      case 'CRM_USER':
        return `CRM 用户 ${audience.crmUserIds.join('、')}`;
      case 'WECOM_USER':
        return `企业微信成员 ${audience.wecomUserIds.join('、')}`;
      case 'WECOM_PARTY':
        return `企业微信部门 ${audience.partyIds.join('、')}`;
      case 'WECOM_TAG':
        return `企业微信标签 ${audience.tagIds.join('、')}`;
      case 'WECOM_CONVERSATION':
        return `企业微信${audience.chatType === 'single' ? '单聊' : '群聊'} ${audience.deliveryTargetId}`;
      default:
        return '未知接收人';
    }
  }

  private resolveDeliveryClass(
    input: DispatchProactiveNotificationInput,
  ): 'SYSTEM_SCHEDULED' | 'FORMAL_NOTICE' | 'CONVERSATION_CONTEXT' | undefined {
    const deliveryClass = input.metadata?.deliveryClass;
    if (
      deliveryClass === 'SYSTEM_SCHEDULED' ||
      deliveryClass === 'FORMAL_NOTICE' ||
      deliveryClass === 'CONVERSATION_CONTEXT'
    ) {
      return deliveryClass;
    }

    if (input.sceneKey.startsWith('daily-report.')) {
      return 'SYSTEM_SCHEDULED';
    }

    if (input.kind === 'CONVERSATION_CONTEXT') {
      return 'CONVERSATION_CONTEXT';
    }

    return undefined;
  }

  private resolveMessagePresentation(
    input: DispatchProactiveNotificationInput,
    kind: ProactiveNotificationKind,
  ): {
    label: string;
    actionHints: string[];
  } {
    const metadata = input.metadata ?? {};
    const suppressActionHints = metadata.suppressActionHints === true;
    const configuredLabel =
      typeof metadata.notificationLabel === 'string' &&
      metadata.notificationLabel.trim()
        ? metadata.notificationLabel.trim()
        : undefined;
    const configuredActions = Array.isArray(metadata.actionHints)
      ? metadata.actionHints
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

    if (!suppressActionHints && configuredLabel && configuredActions.length > 0) {
      return {
        label: configuredLabel,
        actionHints: configuredActions,
      };
    }

    const inferredLabel = configuredLabel ?? this.inferNotificationLabel(input, kind);
    return {
      label: inferredLabel,
      actionHints: suppressActionHints
        ? []
        : configuredActions.length > 0
          ? configuredActions
          : this.inferActionHints(input, kind),
    };
  }

  private decorateMessage(
    message: DispatchProactiveNotificationInput['message'],
    title: string,
    label: string,
    actionHints: string[],
  ): DispatchProactiveNotificationInput['message'] {
    if (message.msgtype !== 'markdown') {
      return message;
    }

    const lines = [
      `${label} ${title}`,
      '',
      message.content.trim(),
    ];

    if (actionHints.length > 0) {
      lines.push('', `可执行动作：${actionHints.join(' / ')}`);
    }

    return {
      msgtype: 'markdown',
      content: lines.join('\n').trim(),
    };
  }

  private appendAppMessageFollowUpHint(
    message: DispatchProactiveNotificationInput['message'],
    channel: ProactiveNotificationChannel,
  ): DispatchProactiveNotificationInput['message'] {
    if (channel !== 'WECOM_APP_MESSAGE' || message.msgtype !== 'markdown') {
      return message;
    }

    const hint = '后续处理请回到 CRM 智能分析机器人或 Web 工作台完成。';
    if (message.content.includes(hint)) {
      return message;
    }

    return {
      msgtype: 'markdown',
      content: [message.content.trim(), '', hint].join('\n').trim(),
    };
  }

  private inferNotificationLabel(
    input: DispatchProactiveNotificationInput,
    kind: ProactiveNotificationKind,
  ): string {
    const sceneKey = input.sceneKey.toLowerCase();
    if (sceneKey.includes('daily')) {
      return '【日报提醒】';
    }
    if (sceneKey.includes('summary')) {
      return '【团队汇总】';
    }
    if (kind === 'CONVERSATION_CONTEXT') {
      return '【异步结果】';
    }
    return '【通知】';
  }

  private inferActionHints(
    input: DispatchProactiveNotificationInput,
    kind: ProactiveNotificationKind,
  ): string[] {
    const sceneKey = input.sceneKey.toLowerCase();
    if (sceneKey.includes('daily')) {
      return ['查看详情', '立即处理', '稍后提醒'];
    }
    if (kind === 'CONVERSATION_CONTEXT') {
      return ['查看详情', '继续处理'];
    }
    return ['查看详情', '稍后处理'];
  }

  private audit(
    actor: CrmUser,
    eventType:
      | 'PROACTIVE_NOTIFICATION_REQUESTED'
      | 'PROACTIVE_NOTIFICATION_DEDUPED'
      | 'PROACTIVE_NOTIFICATION_SENT'
      | 'PROACTIVE_NOTIFICATION_FAILED'
      | 'PROACTIVE_NOTIFICATION_BLOCKED',
    outcome: string,
    sessionSnapshot?: Record<string, unknown>,
  ): void {
    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType,
      actorId: actor.id,
      actorRoleIds: actor.roleIds,
      scopeSnapshot: this.userScopeService.resolveScope(actor),
      sessionSnapshot,
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome,
      failureReason:
        eventType === 'PROACTIVE_NOTIFICATION_FAILED' ||
        eventType === 'PROACTIVE_NOTIFICATION_BLOCKED'
          ? outcome
          : undefined,
      createdAt: new Date().toISOString(),
    });

    this.analysisLoggerService.logStep(outcome, sessionSnapshot);
  }

  private async delay(durationMs: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, durationMs));
  }
}

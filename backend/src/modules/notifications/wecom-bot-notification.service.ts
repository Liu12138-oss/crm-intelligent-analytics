import { Injectable } from '@nestjs/common';
import { buildEntityId } from '../../shared/utils/id.util';
import type { ProactiveNotificationRecipientSnapshot } from '../../shared/types/domain';
import type {
  ProactiveNotificationChannelSendResult,
  ProactiveNotificationMessage,
} from './proactive-notification.types';
import { WecomTransportService } from '../wecom/wecom-transport.service';
import { normalizeWecomBotError } from './wecom-notification-error.util';

@Injectable()
export class WecomBotNotificationService {
  constructor(
    private readonly wecomTransportService: WecomTransportService,
  ) {}

  async sendMessage(params: {
    recipient: ProactiveNotificationRecipientSnapshot;
    message: ProactiveNotificationMessage;
    realMessageEnabled: boolean;
  }): Promise<ProactiveNotificationChannelSendResult> {
    // 自动化测试环境保留 mock，避免单测/集成测试误触真实企业微信机器人。
    // 非测试环境即使关闭真实消息开关，也要把已改投的测试接收人真正发出去。
    if (process.env.NODE_ENV === 'test') {
      return {
        status: 'SENT',
        externalMessageId: `wecom-bot-mock-${buildEntityId('notify')}`,
      };
    }

    const target = {
      chatType: params.recipient.chatType ?? 'single',
      deliveryTargetId: params.recipient.deliveryTargetId,
      senderId:
        params.recipient.wecomUserId ?? params.recipient.deliveryTargetId,
      externalConversationId:
        params.recipient.externalConversationId ??
        params.recipient.deliveryTargetId,
    };

    try {
      const result =
        params.message.msgtype === 'markdown'
          ? await this.wecomTransportService.sendMarkdownMessage(target, params.message.content)
          : await this.wecomTransportService.sendTemplateCardMessage(
              target,
              params.message.payload,
            );

      return {
        status: 'SENT',
        externalMessageId: result.externalMessageId,
      };
    } catch (error) {
      const normalizedError = normalizeWecomBotError(error);
      return {
        status: 'FAILED',
        failureReason: normalizedError.failureReason,
        externalErrorCode: normalizedError.externalErrorCode,
        externalErrorMessage: normalizedError.externalErrorMessage,
        retryStrategy: normalizedError.retryStrategy,
      };
    }
  }
}

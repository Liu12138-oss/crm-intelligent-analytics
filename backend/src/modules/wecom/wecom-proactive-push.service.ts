/**
 * 企微主动回复与异步推送服务
 *
 * 第 3 期新增的主动推送能力：
 * 1. response_url 主动回复：超时兜底场景推送最终结果卡片（1 小时有效，1 次性）
 * 2. aibot_send_msg 降级推送：response_url 失效后的降级方案
 * 3. 主动推送场景：日报定时推送、治理待办提醒
 *
 * 参考企微开发者文档 path/101138 主动回复
 */

import { Injectable } from '@nestjs/common';
import { WecomTransportService } from './wecom-transport.service';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import type { WecomDeliveryTarget } from './wecom-message.types';

/**
 * 主动推送消息类型
 */
export type ProactiveMessageType =
  | 'dashboard_result' // 看板结果推送
  | 'daily_report' // 日报定时推送
  | 'governance_todo' // 治理待办提醒
  | 'timeout_fallback'; // 超时兜底推送

/**
 * 主动推送参数
 */
export interface ProactivePushParams {
  /** 推送目标 */
  target: WecomDeliveryTarget;
  /** 推送消息类型 */
  messageType: ProactiveMessageType;
  /** response_url（1 小时有效，1 次性，优先使用） */
  responseUrl?: string;
  /** 消息内容（markdown 文本或模板卡片对象） */
  content: string | Record<string, unknown>;
  /** 内容格式 */
  format: 'markdown' | 'template_card';
  /** 关联 ID（queryId / reportId / todoId） */
  relatedId?: string;
}

/**
 * 推送结果
 */
export interface ProactivePushResult {
  success: boolean;
  deliveryMethod: 'response_url' | 'aibot_send_msg' | 'failed';
  externalMessageId?: string;
  error?: string;
}

@Injectable()
export class WecomProactivePushService {
  constructor(
    private readonly transportService: WecomTransportService,
    private readonly logger: AnalysisLoggerService,
  ) {}

  /**
   * 主动推送消息
   *
   * 优先使用 response_url（1 小时有效，1 次性），
   * 失效后降级为 aibot_send_msg（长连接主动推送）。
   *
   * 参数说明：`params` 为推送参数
   * 返回值说明：返回推送结果，包含使用的推送方式和消息 ID
   */
  async push(params: ProactivePushParams): Promise<ProactivePushResult> {
    // 优先尝试 response_url（仅对超时兜底场景有效，因为只有问答场景才有 response_url）
    if (params.responseUrl) {
      const result = await this.tryResponseUrl(params);
      if (result.success) {
        return result;
      }
      // response_url 失败，降级到 aibot_send_msg
      this.logger.logWarn('response_url 推送失败，降级到 aibot_send_msg', {
        relatedId: params.relatedId,
        error: result.error,
      });
    }

    // 降级方案：通过长连接 sendMessage 主动推送
    return this.tryAibotSendMsg(params);
  }

  /**
   * 尝试通过 response_url 推送
   *
   * response_url 是企微在用户发消息时附带的主动回复地址，
   * 1 小时内有效，每个只能用 1 次。
   */
  private async tryResponseUrl(params: ProactivePushParams): Promise<ProactivePushResult> {
    if (!params.responseUrl) {
      return { success: false, deliveryMethod: 'failed', error: 'response_url 为空' };
    }

    try {
      const body = this.buildMessageBody(params);
      const response = await fetch(params.responseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        return {
          success: false,
          deliveryMethod: 'failed',
          error: `response_url HTTP ${response.status}`,
        };
      }

      const result = await response.json() as Record<string, unknown>;
      const errcode = Number(result.errcode ?? result.errCode ?? 0);
      if (errcode !== 0) {
        return {
          success: false,
          deliveryMethod: 'failed',
          error: `response_url 业务错误 ${errcode}: ${String(result.errmsg ?? '')}`,
        };
      }

      return {
        success: true,
        deliveryMethod: 'response_url',
        externalMessageId: String(result.msgid ?? result.messageId ?? `response-url-${Date.now()}`),
      };
    } catch (error) {
      return {
        success: false,
        deliveryMethod: 'failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 通过 aibot_send_msg（长连接 sendMessage）推送
   *
   * 适用于 response_url 失效或无 response_url 的场景（如日报推送）。
   */
  private async tryAibotSendMsg(params: ProactivePushParams): Promise<ProactivePushResult> {
    try {
      if (params.format === 'markdown') {
        const result = await this.transportService.sendMarkdownMessage(
          params.target,
          params.content as string,
        );
        return {
          success: true,
          deliveryMethod: 'aibot_send_msg',
          externalMessageId: result.externalMessageId,
        };
      }

      // template_card
      const result = await this.transportService.sendTemplateCardMessage(
        params.target,
        params.content as Record<string, unknown>,
      );
      return {
        success: true,
        deliveryMethod: 'aibot_send_msg',
        externalMessageId: result.externalMessageId,
      };
    } catch (error) {
      return {
        success: false,
        deliveryMethod: 'failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 构建 response_url 请求体
   */
  private buildMessageBody(params: ProactivePushParams): Record<string, unknown> {
    if (params.format === 'markdown') {
      return {
        msgtype: 'markdown',
        markdown: { content: params.content as string },
      };
    }
    return {
      msgtype: 'template_card',
      template_card: params.content as Record<string, unknown>,
    };
  }
}

import { Injectable } from '@nestjs/common';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import { buildEntityId } from '../../shared/utils/id.util';
import type { ProactiveNotificationRecipientSnapshot } from '../../shared/types/domain';
import type {
  ProactiveNotificationChannelSendResult,
  ProactiveNotificationMessage,
} from './proactive-notification.types';
import {
  normalizeWecomAppBusinessError,
  normalizeWecomAppThrownError,
} from './wecom-notification-error.util';

interface WecomAccessTokenCache {
  token: string;
  expiresAt: number;
}

@Injectable()
export class WecomAppMessageService {
  private accessTokenCache?: WecomAccessTokenCache;

  constructor(
    private readonly localRuntimeConfigService: LocalRuntimeConfigService,
    private readonly analysisLoggerService: AnalysisLoggerService,
  ) {}

  async sendMessage(params: {
    recipient: ProactiveNotificationRecipientSnapshot;
    message: ProactiveNotificationMessage;
    realMessageEnabled: boolean;
  }): Promise<ProactiveNotificationChannelSendResult> {
    if (process.env.NODE_ENV === 'test' && !params.realMessageEnabled) {
      return {
        status: 'SENT',
        externalMessageId: `wecom-app-mock-${buildEntityId('notify')}`,
      };
    }

    try {
      const config = this.localRuntimeConfigService.getWecomNotifyConfig();
      if (!config.enabled || !config.corpId || !config.agentId || !config.secret) {
        return {
          status: 'FAILED',
          failureReason: '企业微信自建应用通知配置不完整。',
          retryStrategy: 'NONE',
        };
      }

      const accessToken = await this.getAccessToken();
      const response = await fetch(
        `${config.qyapiBaseUrl}/message/send?access_token=${encodeURIComponent(accessToken)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(
            this.buildRequestBody(config.agentId, params.recipient, params.message),
          ),
        },
      );

      if (!response.ok) {
        return {
          status: 'FAILED',
          failureReason: `企业微信自建应用发送失败：HTTP ${response.status}`,
          externalErrorCode: String(response.status),
          retryStrategy: 'STANDARD_RETRY',
        };
      }

      const payload = (await response.json()) as Record<string, unknown>;
      const errcode = Number(payload.errcode ?? -1);
      const invalidUserIds = this.parsePipeSeparatedIds(payload.invaliduser);
      const invalidPartyIds = this.parsePipeSeparatedIds(payload.invalidparty);
      const invalidTagIds = this.parsePipeSeparatedIds(payload.invalidtag);
      if (errcode !== 0) {
        const normalizedError = normalizeWecomAppBusinessError(payload);
        return {
          status: 'FAILED',
          failureReason: normalizedError.failureReason,
          externalErrorCode: normalizedError.externalErrorCode,
          externalErrorMessage: normalizedError.externalErrorMessage,
          retryStrategy: normalizedError.retryStrategy,
          invalidUserIds,
          invalidPartyIds,
          invalidTagIds,
        };
      }

      if (invalidUserIds.length || invalidPartyIds.length || invalidTagIds.length) {
        return {
          status: 'FAILED',
          failureReason: '企业微信自建应用返回了无效接收人。',
          invalidUserIds,
          invalidPartyIds,
          invalidTagIds,
          retryStrategy: 'NONE',
        };
      }

      return {
        status: 'SENT',
        externalMessageId: `wecom-app-${buildEntityId('notify')}`,
        invalidUserIds,
        invalidPartyIds,
        invalidTagIds,
      };
    } catch (error) {
      const normalizedError = normalizeWecomAppThrownError(
        error,
        '企业微信通知 access_token 或消息发送失败',
      );
      return {
        status: 'FAILED',
        failureReason: normalizedError.failureReason,
        externalErrorCode: normalizedError.externalErrorCode,
        externalErrorMessage: normalizedError.externalErrorMessage,
        retryStrategy: normalizedError.retryStrategy,
      };
    }
  }

  private async getAccessToken(): Promise<string> {
    if (
      this.accessTokenCache &&
      this.accessTokenCache.expiresAt > Date.now() + 30 * 1000
    ) {
      return this.accessTokenCache.token;
    }

    const config = this.localRuntimeConfigService.getWecomNotifyConfig();
    if (!config.enabled || !config.corpId || !config.secret) {
      throw new Error('企业微信自建应用通知配置不完整。');
    }

    const response = await fetch(
      `${config.qyapiBaseUrl}/gettoken?corpid=${encodeURIComponent(config.corpId)}&corpsecret=${encodeURIComponent(config.secret)}`,
      {
        method: 'GET',
      },
    );
    if (!response.ok) {
      throw new Error(`企业微信通知 access_token 获取失败：HTTP ${response.status}`);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const accessToken =
      typeof payload.access_token === 'string' ? payload.access_token : undefined;
    const errcode = Number(payload.errcode ?? -1);
    if (!accessToken || errcode !== 0) {
      throw new Error(
        `企业微信通知 access_token 获取失败：${String(payload.errmsg ?? errcode)}`,
      );
    }

    const expiresIn = Number(payload.expires_in ?? 7200);
    this.accessTokenCache = {
      token: accessToken,
      expiresAt: Date.now() + expiresIn * 1000,
    };
    this.analysisLoggerService.logStep('企业微信自建应用通知 access_token 已刷新。');
    return accessToken;
  }

  private buildRequestBody(
    agentId: string,
    recipient: ProactiveNotificationRecipientSnapshot,
    message: ProactiveNotificationMessage,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      agentid: this.parseAgentId(agentId),
      msgtype: message.msgtype,
    };

    if (recipient.recipientType === 'WECOM_USER' || recipient.recipientType === 'CRM_USER') {
      body.touser = recipient.deliveryTargetId;
    } else if (recipient.recipientType === 'WECOM_PARTY') {
      body.toparty = recipient.deliveryTargetId;
    } else if (recipient.recipientType === 'WECOM_TAG') {
      body.totag = recipient.deliveryTargetId;
    } else {
      throw new Error('企业微信自建应用消息不支持当前接收人类型。');
    }

    if (message.msgtype === 'markdown') {
      body.markdown = {
        content: message.content,
      };
    } else {
      body.template_card = message.payload;
    }

    return body;
  }

  private parseAgentId(agentId: string): number | string {
    const numericAgentId = Number(agentId);
    return Number.isFinite(numericAgentId) ? numericAgentId : agentId;
  }

  private parsePipeSeparatedIds(value: unknown): string[] {
    if (typeof value !== 'string' || !value.trim()) {
      return [];
    }

    return value
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

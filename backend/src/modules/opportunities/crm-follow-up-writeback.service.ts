import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import type { CrmUser, FollowUpLoggableType } from '../../shared/types/domain';
import { buildEntityId } from '../../shared/utils/id.util';
import type { CustomerLookupRecord } from './crm-customer-api.service';
import type { OpportunityLookupRecord } from './crm-opportunity-api.service';
import { CrmBuiltinAccountTokenService } from './crm-builtin-account-token.service';

export interface FollowUpDraft {
  objectType: FollowUpLoggableType;
  objectId: string;
  objectTitle: string;
  customerName?: string;
  ownerId: string;
  ownerName: string;
  draftContent: string;
}

export interface FollowUpWritebackResult {
  revisitLogId: string;
  writtenAt: string;
  message: string;
}

@Injectable()
export class CrmFollowUpWritebackService {
  constructor(
    private readonly localRuntimeConfigService: LocalRuntimeConfigService,
    private readonly analysisLoggerService: AnalysisLoggerService,
    private readonly crmBuiltinAccountTokenService: CrmBuiltinAccountTokenService,
  ) {}

  buildOpportunityFollowUpDraft(
    record: OpportunityLookupRecord,
    options?: {
      draftContent?: string;
      actorName?: string;
    },
  ): FollowUpDraft {
    const customDraftContent = options?.draftContent?.trim();
    const customerLabel = record.customerName
      ? `客户「${record.customerName}」`
      : '当前客户';
    const draftBody =
      customDraftContent ??
      `${customerLabel}对应项目「${record.title}」当前处于${record.stage}阶段，预计金额${record.expectAmount.toLocaleString()}元，当前负责人为${record.ownerName}。本次已在企业微信完成进度确认，后续按该阶段继续推进。`;

    return {
      objectType: 'Opportunity',
      objectId: record.id,
      objectTitle: record.title,
      customerName: record.customerName,
      ownerId: record.ownerId,
      ownerName: record.ownerName,
      draftContent: this.formatSignedFollowUpContent(
        options?.actorName,
        draftBody,
      ),
    };
  }

  buildCustomerFollowUpDraft(
    record: CustomerLookupRecord,
    options?: {
      draftContent?: string;
      actorName?: string;
    },
  ): FollowUpDraft {
    const customDraftContent = options?.draftContent?.trim();
    const draftBody =
      customDraftContent ??
      `客户「${record.name}」当前分类为${record.category ?? '未分类'}，当前负责人为${record.ownerName}。本次已在企业微信完成进度确认，后续按客户跟进节奏继续推进。`;

    return {
      objectType: 'Customer',
      objectId: record.id,
      objectTitle: record.name,
      customerName: record.name,
      ownerId: record.ownerId,
      ownerName: record.ownerName,
      draftContent: this.formatSignedFollowUpContent(
        options?.actorName,
        draftBody,
      ),
    };
  }

  formatSignedFollowUpContent(
    actorName: string | undefined,
    content: string,
  ): string {
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      return '';
    }

    const trimmedActorName = actorName?.trim();
    if (!trimmedActorName) {
      return trimmedContent;
    }

    const escapedActorName = this.escapeForRegex(trimmedActorName);
    const bracketedPrefixPattern = new RegExp(
      `^(?:【\\s*${escapedActorName}\\s*】[：:]?\\s*)+`,
      'u',
    );
    const plainPrefixPattern = new RegExp(`^(?:${escapedActorName}[：:]\\s*)+`, 'u');
    const hasBracketedPrefix = bracketedPrefixPattern.test(trimmedContent);
    const normalizedBody = trimmedContent
      .replace(bracketedPrefixPattern, '')
      .replace(plainPrefixPattern, '')
      .trim();

    if (hasBracketedPrefix) {
      return `【${trimmedActorName}】：\n${normalizedBody || trimmedContent}`;
    }

    return `${trimmedActorName}：${normalizedBody || trimmedContent}`;
  }

  async resolveWecomBotAccessToken(
    currentAccessToken?: string,
  ): Promise<string | undefined> {
    return await this.crmBuiltinAccountTokenService.resolveWecomBotAccessToken(
      currentAccessToken,
    );
  }

  async writeFollowUp(
    user: CrmUser,
    params: {
      loggableType: FollowUpLoggableType;
      loggableId: string;
      content: string;
      accessToken?: string;
    },
  ): Promise<FollowUpWritebackResult> {
    const crmAuthConfig = this.localRuntimeConfigService.getCrmAuthConfig();
    const normalizedContent = this.formatSignedFollowUpContent(
      user.name,
      params.content,
    );

    this.analysisLoggerService.logStep('CRM 跟进写回开始。', {
      requesterId: user.id,
      requesterName: user.name,
      loggableType: params.loggableType,
      loggableId: params.loggableId,
      senderTokenPresent: Boolean(params.accessToken?.trim()),
      writebackLoginConfigured: Boolean(crmAuthConfig.writebackLogin?.trim()),
      routeMode: crmAuthConfig.mockEnabled
        ? 'mock'
        : 'crm-open-api-writeback-account',
    });

    if (crmAuthConfig.mockEnabled || process.env.NODE_ENV === 'test') {
      if (normalizedContent.includes('模拟失败')) {
        throw new ServiceUnavailableException('模拟 CRM 跟进写回失败。');
      }
      const writtenAt = new Date().toISOString();
      return {
        revisitLogId: buildEntityId('revisit_log'),
        writtenAt,
        message: '跟进记录已通过样例模式写入。',
      };
    }

    if (!crmAuthConfig.enabled || !crmAuthConfig.baseUrl) {
      throw new ServiceUnavailableException('当前未配置 CRM Open API 地址。');
    }

    const requestUrl = new URL('/api/v2/revisit_logs', crmAuthConfig.baseUrl);
    const response = await this.executeWritebackWithBuiltinAccount(
      crmAuthConfig,
      {
        requester: user,
        loggableType: params.loggableType,
        loggableId: params.loggableId,
        content: normalizedContent,
        requestUrl,
      },
    );

    this.analysisLoggerService.logStep('CRM 跟进写回响应原文已收到。', {
      requesterId: user.id,
      requesterName: user.name,
      requestUrl: requestUrl.toString(),
      httpStatus: response.httpStatus,
      payload: response.payload,
    });

    this.analysisLoggerService.logStep('CRM 跟进写回响应已返回。', {
      loggableType: params.loggableType,
      loggableId: params.loggableId,
      requestUrl: requestUrl.toString(),
      httpStatus: response.httpStatus,
      apiCode: response.apiCode,
      message: response.message,
      dataKeys: Object.keys(response.data),
    });

    if (!response.responseOk) {
      throw new ServiceUnavailableException(
        response.message ?? `CRM 跟进写回失败，HTTP ${response.httpStatus}。`,
      );
    }

    if (response.apiCode !== 0) {
      throw new ServiceUnavailableException(
        response.message ?? 'CRM 跟进写回失败。',
      );
    }

    return {
      revisitLogId: String(
        response.data.id ??
          response.data.revisit_log_id ??
          buildEntityId('revisit_log'),
      ),
      writtenAt: new Date().toISOString(),
      message: response.message ?? '跟进记录已写入 CRM。',
    };
  }

  private async executeWritebackWithBuiltinAccount(
    crmAuthConfig: ReturnType<LocalRuntimeConfigService['getCrmAuthConfig']>,
    params: {
      requester: CrmUser;
      loggableType: FollowUpLoggableType;
      loggableId: string;
      content: string;
      requestUrl: URL;
    },
  ): Promise<{
    httpStatus: number;
    responseOk: boolean;
    payload: Record<string, unknown>;
    apiCode: number;
    message?: string;
    data: Record<string, unknown>;
  }> {
    let accessToken =
      await this.crmBuiltinAccountTokenService.getBuiltinWriteAccessToken();
    let response = await this.sendWritebackRequest(crmAuthConfig, accessToken, {
      requester: params.requester,
      loggableType: params.loggableType,
      loggableId: params.loggableId,
      content: params.content,
      requestUrl: params.requestUrl,
    });

    if (this.isWritebackAuthFailure(response.httpStatus, response.apiCode, response.message)) {
      this.analysisLoggerService.logWarn(
        'CRM 跟进写回内置账号 token 已失效，准备重新登录后重试。',
        {
          requesterId: params.requester.id,
          requesterName: params.requester.name,
          loggableType: params.loggableType,
          loggableId: params.loggableId,
          httpStatus: response.httpStatus,
          apiCode: response.apiCode,
          message: response.message,
        },
      );
      this.crmBuiltinAccountTokenService.clearBuiltinAccessTokenCache();
      accessToken =
        await this.crmBuiltinAccountTokenService.getBuiltinWriteAccessToken(
          true,
        );
      response = await this.sendWritebackRequest(crmAuthConfig, accessToken, {
        requester: params.requester,
        loggableType: params.loggableType,
        loggableId: params.loggableId,
        content: params.content,
        requestUrl: params.requestUrl,
      });
    }

    return response;
  }

  private async sendWritebackRequest(
    crmAuthConfig: ReturnType<LocalRuntimeConfigService['getCrmAuthConfig']>,
    accessToken: string,
    params: {
      requester: CrmUser;
      loggableType: FollowUpLoggableType;
      loggableId: string;
      content: string;
      requestUrl: URL;
    },
  ): Promise<{
    httpStatus: number;
    responseOk: boolean;
    payload: Record<string, unknown>;
    apiCode: number;
    message?: string;
    data: Record<string, unknown>;
  }> {
    const requestBody = new URLSearchParams();
    requestBody.set('revisit_log[loggable_id]', params.loggableId);
    requestBody.set('revisit_log[loggable_type]', params.loggableType);
    requestBody.set('revisit_log[content]', params.content.trim());

    this.analysisLoggerService.logStep('CRM 跟进写回请求体已生成。', {
      requesterId: params.requester.id,
      requesterName: params.requester.name,
      requestUrl: params.requestUrl.toString(),
      requestBody: requestBody.toString(),
      authMode: 'builtin-writeback-account',
    });

    let response: Response;
    try {
      response = await fetch(params.requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
          Authorization: `Token token=${accessToken}, device=${crmAuthConfig.device}, version_code=${crmAuthConfig.versionCode}`,
        },
        body: requestBody.toString(),
        signal: AbortSignal.timeout(crmAuthConfig.timeoutMs),
      });
    } catch (error) {
      this.analysisLoggerService.logWarn(
        'CRM 跟进写回请求失败，无法连接 Open API。',
        {
          loggableType: params.loggableType,
          loggableId: params.loggableId,
          requestUrl: params.requestUrl.toString(),
          reason:
            error instanceof Error
              ? error.message
              : String(error ?? 'unknown'),
        },
      );
      throw new ServiceUnavailableException(
        `当前无法连接 CRM Open API，请确认 ${crmAuthConfig.baseUrl} 可达后重试。`,
      );
    }

    const payload = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const apiCode = Number(payload.code ?? -1);
    const message =
      typeof payload.message === 'string' ? payload.message : undefined;
    const data = (payload.data ?? {}) as Record<string, unknown>;

    return {
      httpStatus: response.status,
      responseOk: response.ok,
      payload,
      apiCode,
      message,
      data,
    };
  }
  private isWritebackAuthFailure(
    httpStatus: number,
    apiCode: number,
    message?: string,
  ): boolean {
    return httpStatus === 401 || httpStatus === 403 || this.isAuthError(apiCode, message);
  }

  private isAuthError(apiCode: number, message?: string): boolean {
    return (
      apiCode === 401 ||
      apiCode === 403 ||
      Boolean(message && /token|登录|授权|认证|权限/i.test(message))
    );
  }

  private escapeForRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

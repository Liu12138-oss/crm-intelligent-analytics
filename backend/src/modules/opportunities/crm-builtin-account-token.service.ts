import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';

const BUILTIN_TOKEN_CACHE_MS = 10 * 60 * 1000;

interface CachedBuiltinAccessToken {
  token: string;
  login: string;
  expiresAt: number;
}

@Injectable()
export class CrmBuiltinAccountTokenService {
  private builtinAccessTokenCache?: CachedBuiltinAccessToken;

  constructor(
    private readonly localRuntimeConfigService: LocalRuntimeConfigService,
    private readonly analysisLoggerService: AnalysisLoggerService,
  ) {}

  async resolveWecomBotAccessToken(
    currentAccessToken?: string,
  ): Promise<string | undefined> {
    const normalizedCurrentAccessToken = currentAccessToken?.trim();
    if (normalizedCurrentAccessToken) {
      return normalizedCurrentAccessToken;
    }

    const crmAuthConfig = this.localRuntimeConfigService.getCrmAuthConfig();
    if (crmAuthConfig.mockEnabled || process.env.NODE_ENV === 'test') {
      return 'mock-builtin-wecom-token';
    }

    return await this.getBuiltinWriteAccessToken();
  }

  async getBuiltinWriteAccessToken(forceRefresh = false): Promise<string> {
    const crmAuthConfig = this.localRuntimeConfigService.getCrmAuthConfig();
    const writebackLogin = crmAuthConfig.writebackLogin?.trim();
    const writebackPassword = crmAuthConfig.writebackPassword;
    const loginPath = crmAuthConfig.loginPath || '/api/v2/auth/login';

    if (crmAuthConfig.mockEnabled || process.env.NODE_ENV === 'test') {
      return 'mock-builtin-wecom-token';
    }

    if (!crmAuthConfig.enabled || !crmAuthConfig.baseUrl) {
      throw new ServiceUnavailableException('当前未配置 CRM Open API 地址。');
    }

    if (!writebackLogin || !writebackPassword) {
      throw new ServiceUnavailableException(
        '当前未配置企业微信受控写入内置 CRM 账号，请设置 CRM_OPEN_API_WRITEBACK_LOGIN 和 CRM_OPEN_API_WRITEBACK_PASSWORD。',
      );
    }

    if (
      !forceRefresh &&
      this.builtinAccessTokenCache &&
      this.builtinAccessTokenCache.login === writebackLogin &&
      this.builtinAccessTokenCache.expiresAt > Date.now() + 30 * 1000
    ) {
      return this.builtinAccessTokenCache.token;
    }

    const body: Record<string, unknown> = {
      login: writebackLogin,
      password: writebackPassword,
      device: crmAuthConfig.device,
    };
    if (crmAuthConfig.corpId) {
      body.corp_id = crmAuthConfig.corpId;
    }

    let response: Response;
    try {
      response = await fetch(
        `${crmAuthConfig.baseUrl}${loginPath}`,
        {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(crmAuthConfig.timeoutMs),
        },
      );
    } catch (error) {
      this.analysisLoggerService.logWarn(
        '企业微信受控写入内置账号登录 CRM 失败，无法连接认证接口。',
        {
          login: writebackLogin,
          reason:
            error instanceof Error
              ? error.message
              : String(error ?? 'unknown'),
        },
      );
      throw new ServiceUnavailableException(
        `当前无法连接 CRM 登录服务，请确认 ${crmAuthConfig.baseUrl} 可达后重试。`,
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
    const userToken =
      typeof data.user_token === 'string'
        ? data.user_token
        : typeof payload.user_token === 'string'
          ? payload.user_token
          : undefined;

    if (!response.ok || apiCode !== 0 || !userToken) {
      this.analysisLoggerService.logWarn('企业微信受控写入内置账号登录 CRM 失败。', {
        login: writebackLogin,
        httpStatus: response.status,
        apiCode,
        message,
        hasUserToken: Boolean(userToken),
      });
      throw new ServiceUnavailableException(
        message
          ? `企业微信受控写入内置 CRM 账号认证失败：${message}`
          : '企业微信受控写入内置 CRM 账号认证失败，请检查账号密码配置。',
      );
    }

    // 机器人侧连续写入较集中，这里做短时缓存，避免每次都重新登录 CRM。
    this.builtinAccessTokenCache = {
      token: userToken,
      login: writebackLogin,
      expiresAt: Date.now() + BUILTIN_TOKEN_CACHE_MS,
    };

    return userToken;
  }

  clearBuiltinAccessTokenCache(): void {
    this.builtinAccessTokenCache = undefined;
  }
}

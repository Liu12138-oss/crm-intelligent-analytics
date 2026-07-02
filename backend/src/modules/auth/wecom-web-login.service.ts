import { promises as dns } from 'node:dns';
import { request as httpRequest, type RequestOptions } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';
import { CRM_AUTH_ACCOUNTS, CRM_USERS } from '../../shared/mock/sample-data';
import type { CrmUser } from '../../shared/types/domain';
import { buildEntityId } from '../../shared/utils/id.util';
import { buildWebAppUrl } from '../../shared/utils/web-app-url.util';
import { WecomAuthService } from '../wecom/wecom-auth.service';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import { WecomLoginBindingRepository } from './wecom-login-binding.repository';

interface WecomAccessTokenCache {
  token: string;
  expiresAt: number;
}

interface WecomHttpJsonResponse {
  statusCode: number;
  payload: Record<string, unknown>;
}

export interface WecomLoginReturnTarget {
  webBaseUrl: string;
  returnUrl?: string;
}

interface WecomLoginReturnTargetCache extends WecomLoginReturnTarget {
  webBaseUrl: string;
  expiresAt: number;
}

type NodeRequestFactory = typeof httpRequest;
type WecomNodeRequestOptions = RequestOptions & {
  servername?: string;
  family?: number;
  agent?: false;
};

const wecomHostnameResolutionCache = new Map<string, string>();

/**
 * 将 `HeadersInit` 归一化成 Node 原生 HTTP 客户端可直接消费的对象结构。
 */
function normalizeRequestHeaders(
  headers?: RequestInit['headers'],
): Record<string, string> | undefined {
  if (!headers) {
    return undefined;
  }

  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers.map(([key, value]) => [key, String(value)]));
  }

  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key, String(value)]),
  );
}

/**
 * 当前企业微信调用只会发送 JSON 字符串；若后续出现其它请求体类型，应显式扩展而不是静默吞掉。
 */
function normalizeRequestBody(
  body?: RequestInit['body'],
): string | Uint8Array | undefined {
  if (!body) {
    return undefined;
  }

  if (
    typeof body === 'string' ||
    body instanceof Uint8Array
  ) {
    return body;
  }

  throw new Error('企业微信请求体类型不受支持。');
}

/**
 * 企业微信官方接口在当前生产机上会出现 Node `fetch` 间歇性连接超时，而 `https.request` 稳定可用。
 * 这里改为走 Node 原生 HTTP 客户端，避免扫码换票被 undici 的连接行为放大成 500。
 */
export async function requestWecomJsonThroughNodeHttp(params: {
  url: string;
  init?: RequestInit;
  timeoutMs?: number;
  requestFactory?: NodeRequestFactory;
}): Promise<WecomHttpJsonResponse> {
  const requestUrl = new URL(params.url);
  const resolvedHostname =
    isIP(requestUrl.hostname) || requestUrl.hostname === 'localhost'
      ? requestUrl.hostname
      : await resolveWecomRequestHostname(requestUrl.hostname);
  const requestFactory =
    params.requestFactory ??
    (requestUrl.protocol === 'http:' ? httpRequest : httpsRequest);
  const normalizedHeaders = normalizeRequestHeaders(params.init?.headers) ?? {};
  if (!normalizedHeaders.Host) {
    normalizedHeaders.Host = requestUrl.hostname;
  }
  if (!normalizedHeaders.Connection) {
    normalizedHeaders.Connection = 'close';
  }
  const requestOptions: WecomNodeRequestOptions = {
    protocol: requestUrl.protocol,
    hostname: resolvedHostname,
    port: requestUrl.port || undefined,
    path: `${requestUrl.pathname}${requestUrl.search}`,
    method: params.init?.method ?? 'GET',
    headers: normalizedHeaders,
    family: 4,
    agent: false,
    servername: requestUrl.hostname,
  };
  const requestBody = normalizeRequestBody(params.init?.body);
  const timeoutMs = params.timeoutMs ?? 15000;

  return await new Promise<WecomHttpJsonResponse>((resolve, reject) => {
    const request = requestFactory(requestOptions, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      response.on('end', () => {
        const rawPayload = Buffer.concat(chunks).toString('utf-8');
        try {
          const parsed = JSON.parse(rawPayload) as Record<string, unknown>;
          resolve({
            statusCode: response.statusCode ?? 0,
            payload: parsed && typeof parsed === 'object' ? parsed : {},
          });
        } catch {
          resolve({
            statusCode: response.statusCode ?? 0,
            payload: {},
          });
        }
      });
      response.on('error', reject);
    });

    request.on('error', reject);
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`企业微信接口连接超时（${timeoutMs}ms）。`));
    });

    if (requestBody) {
      request.write(requestBody);
    }

    request.end();
  });
}

/**
 * 企业微信网页登录一次会串行访问多个官方接口。
 * 这里在首次成功解析后缓存 IPv4，并继续保留原始 servername / Host，避免 Node 直接按域名连接时命中现网异常链路。
 */
async function resolveWecomRequestHostname(hostname: string): Promise<string> {
  const cached = wecomHostnameResolutionCache.get(hostname);
  if (cached) {
    return cached;
  }

  const addresses = await dns.resolve4(hostname);
  if (!addresses[0]) {
    throw new Error(`未解析到 ${hostname} 的 IPv4 地址。`);
  }

  wecomHostnameResolutionCache.set(hostname, addresses[0]);
  return addresses[0];
}

export type WecomLoginResolution =
  | {
      kind: 'user';
      user: CrmUser;
    }
  | {
      kind: 'bind_required';
      bindToken: string;
      wecomUserId: string;
      wecomUserName?: string;
      prompt: string;
    };

@Injectable()
export class WecomWebLoginService {
  private accessTokenCache?: WecomAccessTokenCache;
  private readonly loginReturnTargetCache = new Map<
    string,
    WecomLoginReturnTargetCache
  >();

  constructor(
    @Inject(LocalRuntimeConfigService)
    private readonly localRuntimeConfigService: LocalRuntimeConfigService,
    @Inject(WecomAuthService)
    private readonly wecomAuthService: WecomAuthService,
    @Inject(AnalysisLoggerService)
    private readonly analysisLoggerService: AnalysisLoggerService,
    @Inject(WecomLoginBindingRepository)
    private readonly wecomLoginBindingRepository: WecomLoginBindingRepository,
  ) {}

  beginLogin(params?: { webBaseUrl?: string; returnUrl?: string }): Record<string, unknown> {
    const config = this.localRuntimeConfigService.getWecomRuntimeConfig();
    const state = buildEntityId('wecom_state');
    this.rememberLoginReturnTarget(state, params);
    const redirectUri = this.buildWecomLoginRedirectUrl();

    if (
      config.webLoginAppId &&
      config.webLoginAgentId &&
      redirectUri
    ) {
      const authorizeUrl = this.buildAuthorizeUrl(state);
      return {
        enabled: true,
        state,
        authorizeUrl,
        widget: {
          appId: config.webLoginAppId,
          agentId: config.webLoginAgentId,
          redirectUri,
          state,
          scope: 'snsapi_privateinfo',
        },
      };
    }

    if (config.loginAuthorizeUrl && redirectUri) {
      return {
        enabled: true,
        state,
        authorizeUrl: config.loginAuthorizeUrl
          .replace('{state}', encodeURIComponent(state))
          .replace(
            '{redirect_uri}',
            encodeURIComponent(redirectUri),
          ),
      };
    }

    const mockAccount = CRM_AUTH_ACCOUNTS[0];
    return {
      enabled: false,
      state,
      authorizeUrl: `${
        redirectUri
      }?state=${encodeURIComponent(state)}&code=${encodeURIComponent(
        mockAccount.wecomCode,
      )}`,
      reason: '当前未配置企业微信网页登录参数，已回退到本地模拟扫码链路。',
    };
  }

  /**
   * 读取并消费扫码发起入口与完整回跳地址。
   *
   * 参数说明：
   * - state: 企业微信扫码链路回传的状态值，用于匹配本次扫码发起入口。
   *
   * 返回值说明：
   * - 找到未过期记录时返回对应 Web 基地址和完整回跳地址；否则返回空值，由调用方回退默认配置。
   *
   * 设计原因：
   * - 同一套应用可能同时通过门户域名和内网 IP 访问，callback 必须回到发起扫码的入口，
   *   否则浏览器会换域名，导致 state cookie 不随 `/exchange` 请求发送。
   * - 门户平台会在 URL 上附加代理参数，扫码成功后必须保留完整地址，避免最终落点被网关拦成 302 页面。
   */
  consumeLoginReturnTarget(state?: string): WecomLoginReturnTarget | undefined {
    const normalizedState = state?.trim();
    if (!normalizedState) {
      return undefined;
    }

    const cached = this.loginReturnTargetCache.get(normalizedState);
    this.loginReturnTargetCache.delete(normalizedState);
    if (!cached || cached.expiresAt <= Date.now()) {
      return undefined;
    }

    return {
      webBaseUrl: cached.webBaseUrl,
      ...(cached.returnUrl ? { returnUrl: cached.returnUrl } : {}),
    };
  }

  /**
   * 兼容旧调用方读取扫码发起入口。
   *
   * 参数说明：`state` 为企业微信扫码回调状态值。
   * 返回值说明：仅返回 Web 基址；新流程应优先使用 `consumeLoginReturnTarget`。
   */
  consumeLoginReturnBaseUrl(state?: string): string | undefined {
    return this.consumeLoginReturnTarget(state)?.webBaseUrl;
  }

  async resolveCallbackUser(params: {
    senderId?: string;
    code?: string;
  }): Promise<WecomLoginResolution> {
    if (params.senderId) {
      const user = await this.wecomAuthService.resolveSender(
        params.senderId,
        'web-console',
      );
      return {
        kind: 'user',
        user,
      };
    }

    if (params.code) {
      const config = this.localRuntimeConfigService.getWecomRuntimeConfig();
      if (config.webLoginAppId && config.webLoginSecret) {
        return await this.resolveOfficialWecomUser(params.code);
      }

      const mockAccount = CRM_AUTH_ACCOUNTS.find(
        (item) => item.wecomCode === params.code,
      );
      if (mockAccount) {
        const user = CRM_USERS.find((item) => item.id === mockAccount.userId);
        if (!user) {
          throw new UnauthorizedException('当前企业微信账号未绑定有效的 CRM 用户。');
        }
        return {
          kind: 'user',
          user: { ...user, identitySource: 'mock' },
        };
      }
    }

    throw new UnauthorizedException('当前未配置企业微信扫码回调解析器。');
  }

  private buildAuthorizeUrl(state: string): string {
    const config = this.localRuntimeConfigService.getWecomRuntimeConfig();
    const url = new URL(config.webLoginQrConnectUrl);
    url.searchParams.set('appid', String(config.webLoginAppId));
    url.searchParams.set('agentid', String(config.webLoginAgentId));
    url.searchParams.set(
      'redirect_uri',
      this.buildWecomLoginRedirectUrl(),
    );
    url.searchParams.set('state', state);
    url.searchParams.set('scope', 'snsapi_privateinfo');
    return url.toString();
  }

  /**
   * 企业微信扫码回流优先走显式配置的 callback 域名。
   *
   * 设计原因：
   * 1. 生产环境可能继续通过内网 IP 打开页面，但企业微信只接受已登记的外部域名回调；
   * 2. 回流先落到后端 callback，再由后端统一 302 回当前 Web 登录页，可避免要求业务页和扫码域名完全一致；
   * 3. 未显式配置时仍保留原有行为，继续回流到前端登录页，兼容本地开发和旧环境。
   */
  private buildWecomLoginRedirectUrl(): string {
    const config = this.localRuntimeConfigService.getWecomRuntimeConfig();
    if (config.loginCallbackUrl?.trim()) {
      return config.loginCallbackUrl.trim();
    }

    return buildWebAppUrl(config.webBaseUrl, '/login');
  }

  /**
   * 记录扫码发起入口和完整回跳地址，并顺手清理过期记录，避免长期运行时缓存无限增长。
   */
  private rememberLoginReturnTarget(
    state: string,
    target?: { webBaseUrl?: string; returnUrl?: string },
  ): void {
    const normalizedWebBaseUrl = target?.webBaseUrl?.trim();
    this.pruneExpiredLoginReturnTargets();
    if (!normalizedWebBaseUrl) {
      return;
    }

    const normalizedReturnUrl = target?.returnUrl?.trim();
    this.loginReturnTargetCache.set(state, {
      webBaseUrl: normalizedWebBaseUrl,
      ...(normalizedReturnUrl ? { returnUrl: normalizedReturnUrl } : {}),
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
  }

  /**
   * 清理企业微信扫码入口缓存中的过期记录。
   */
  private pruneExpiredLoginReturnTargets(): void {
    const now = Date.now();
    for (const [state, cached] of this.loginReturnTargetCache.entries()) {
      if (cached.expiresAt <= now) {
        this.loginReturnTargetCache.delete(state);
      }
    }
  }

  private async resolveOfficialWecomUser(
    code: string,
  ): Promise<WecomLoginResolution> {
    const accessToken = await this.getAccessToken();
    const authInfo = (await this.requestWecomJson(
      `${this.localRuntimeConfigService.getWecomRuntimeConfig().qyapiBaseUrl}/auth/getuserinfo?access_token=${encodeURIComponent(
        accessToken,
      )}&code=${encodeURIComponent(code)}`,
    )) as Record<string, unknown>;

    const userTicket =
      typeof authInfo.user_ticket === 'string'
        ? authInfo.user_ticket
        : undefined;
    const userId = authInfo.UserId ?? authInfo.userid;
    const [detailByTicket, detailByUserId] = await Promise.all([
      userTicket
        ? this.requestWecomJsonSafely(
            `${this.localRuntimeConfigService.getWecomRuntimeConfig().qyapiBaseUrl}/auth/getuserdetail?access_token=${encodeURIComponent(
              accessToken,
            )}`,
            'auth/getuserdetail',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_ticket: userTicket }),
            },
          )
        : Promise.resolve(undefined),
      userId && typeof userId === 'string'
        ? this.requestWecomJsonSafely(
            `${this.localRuntimeConfigService.getWecomRuntimeConfig().qyapiBaseUrl}/user/get?access_token=${encodeURIComponent(
              accessToken,
            )}&userid=${encodeURIComponent(String(userId))}`,
            'user/get',
          )
        : Promise.resolve(undefined),
    ]);

    this.analysisLoggerService.logStep('企业微信网页登录返回诊断', {
      authInfoKeys: Object.keys(authInfo).sort(),
      authInfoUserId:
        typeof authInfo.UserId === 'string'
          ? authInfo.UserId
          : typeof authInfo.userid === 'string'
            ? authInfo.userid
            : undefined,
      hasUserTicket: Boolean(userTicket),
      detailByTicketKeys: detailByTicket ? Object.keys(detailByTicket).sort() : [],
      detailByTicketMobile: this.readString(detailByTicket?.mobile),
      detailByTicketTelephone: this.readString(detailByTicket?.telephone),
      detailByTicketEmail: this.readString(detailByTicket?.email),
      detailByTicketName: this.readString(detailByTicket?.name),
      detailByUserIdKeys: detailByUserId ? Object.keys(detailByUserId).sort() : [],
      detailByUserIdMobile: this.readString(detailByUserId?.mobile),
      detailByUserIdTelephone: this.readString(detailByUserId?.telephone),
      detailByUserIdEmail: this.readString(detailByUserId?.email),
      detailByUserIdName: this.readString(detailByUserId?.name),
    });

    const resolvedUserId =
      typeof userId === 'string' ? userId : undefined;
    const resolvedUserName =
      this.readString(detailByTicket?.name) ??
      this.readString(detailByUserId?.name);
    const mobile =
      this.readString(detailByTicket?.mobile) ??
      this.readString(detailByTicket?.telephone) ??
      this.readString(detailByUserId?.mobile) ??
      this.readString(detailByUserId?.telephone);
    const email =
      this.readString(detailByTicket?.email) ??
      this.readString(detailByUserId?.email);

    this.analysisLoggerService.logStep('企业微信网页登录匹配字段结果', {
      resolvedMobile: mobile,
      resolvedEmail: email,
    });

    if (!resolvedUserId) {
      throw new UnauthorizedException('企业微信未返回可用于绑定的用户标识。');
    }

    const mappedUser =
      await this.wecomAuthService.resolveMappedWebLoginUser(resolvedUserId);
    if (mappedUser) {
      this.analysisLoggerService.logStep('企业微信网页登录命中 CRM 原生映射', {
        wecomUserId: resolvedUserId,
        crmUserId: mappedUser.id,
      });
      return {
        kind: 'user',
        user: mappedUser,
      };
    }

    const bindToken = buildEntityId('wecom_bind');
    const prompt =
      '当前企业微信账号尚未形成可用的 CRM 身份映射，请先输入一次账号密码完成绑定。完成后，后续可直接扫码登录。';
    const now = new Date();
    this.wecomLoginBindingRepository.savePendingBinding({
      id: buildEntityId('pending_wecom_bind'),
      bindToken,
      state: buildEntityId('bind_state'),
      wecomUserId: resolvedUserId,
      wecomUserName: resolvedUserName,
      mobile,
      email,
      prompt,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
    });

    this.analysisLoggerService.logWarn('企业微信网页登录未命中 CRM 原生映射', {
      wecomUserId: resolvedUserId,
      wecomUserName: resolvedUserName,
    });

    return {
      kind: 'bind_required',
      bindToken,
      wecomUserId: resolvedUserId,
      wecomUserName: resolvedUserName,
      prompt,
    };
  }

  private async getAccessToken(): Promise<string> {
    if (
      this.accessTokenCache &&
      this.accessTokenCache.expiresAt > Date.now() + 30 * 1000
    ) {
      return this.accessTokenCache.token;
    }

    const config = this.localRuntimeConfigService.getWecomRuntimeConfig();
    if (!config.webLoginAppId || !config.webLoginSecret) {
      throw new UnauthorizedException('当前未配置企业微信网页登录凭据。');
    }

    const tokenResponse = (await this.requestWecomJson(
      `${config.qyapiBaseUrl}/gettoken?corpid=${encodeURIComponent(
        config.webLoginAppId,
      )}&corpsecret=${encodeURIComponent(config.webLoginSecret)}`,
    )) as Record<string, unknown>;

    const token = tokenResponse.access_token;
    const expiresIn = Number(tokenResponse.expires_in ?? 7200);
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException('企业微信访问令牌获取失败。');
    }

    this.accessTokenCache = {
      token,
      expiresAt: Date.now() + expiresIn * 1000,
    };
    return token;
  }

  private async requestWecomJson(
    url: string,
    init?: RequestInit,
  ): Promise<unknown> {
    let response: WecomHttpJsonResponse;
    try {
      response = await requestWecomJsonThroughNodeHttp({
        url,
        init,
        timeoutMs: 15000,
      });
    } catch (error) {
      const requestUrl = new URL(url);
      this.analysisLoggerService.logWarn('企业微信网页登录官方接口调用失败。', {
        host: requestUrl.host,
        path: requestUrl.pathname,
        reason: error instanceof Error ? error.message : String(error ?? 'unknown'),
      });
      throw new ServiceUnavailableException(
        '当前无法连接企业微信认证服务，请稍后重试。',
      );
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new UnauthorizedException('企业微信认证接口调用失败。');
    }

    const payload = response.payload;
    const errcode = Number(payload.errcode ?? 0);
    if (errcode !== 0) {
      throw new UnauthorizedException(
        String(payload.errmsg ?? '企业微信认证返回失败。'),
      );
    }

    return payload;
  }

  private async requestWecomJsonSafely(
    url: string,
    stage: string,
    init?: RequestInit,
  ): Promise<Record<string, unknown> | undefined> {
    try {
      return (await this.requestWecomJson(url, init)) as Record<string, unknown>;
    } catch (error) {
      this.analysisLoggerService.logWarn('企业微信网页登录辅助信息获取失败，已继续尝试其它身份字段来源。', {
        stage,
        reason: error instanceof Error ? error.message : String(error ?? 'unknown'),
      });
      return undefined;
    }
  }

  private readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value : undefined;
  }
}

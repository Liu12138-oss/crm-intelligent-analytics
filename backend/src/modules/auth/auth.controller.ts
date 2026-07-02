import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { isIP } from 'node:net';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';
import {
  CRM_AUTH_SESSION_COOKIE,
  CRM_WECOM_LOGIN_STATE_COOKIE,
} from './auth-session.constants';
import { CrmAuthService } from './crm-auth.service';
import {
  WecomWebLoginService,
  type WecomLoginReturnTarget,
} from './wecom-web-login.service';
import { buildWebAppUrl } from '../../shared/utils/web-app-url.util';

const WECOM_SUCCESS_PERSISTED_QUERY_KEYS = ['GratuitousProxy'] as const;

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(CrmAuthService)
    private readonly crmAuthService: CrmAuthService,
    @Inject(WecomWebLoginService)
    private readonly wecomWebLoginService: WecomWebLoginService,
    @Inject(LocalRuntimeConfigService)
    private readonly localRuntimeConfigService: LocalRuntimeConfigService,
  ) {}

  @Post('login')
  async login(
    @Body()
    body: {
      login?: string;
      password?: string;
      corpId?: string;
      wecomBindToken?: string;
    },
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!body.login?.trim() || !body.password?.trim()) {
      throw new UnauthorizedException('请输入账号和密码后再登录。');
    }

    const session = await this.crmAuthService.loginByPassword({
      login: body.login.trim(),
      password: body.password,
      corpId: body.corpId?.trim() || undefined,
      wecomBindToken: body.wecomBindToken?.trim() || undefined,
    });
    this.writeAuthSessionCookie(response, session.id);
    return this.crmAuthService.buildSessionView(session);
  }

  @Get('session')
  async getSession(
    @Req() request: Request & { cookies?: Record<string, string | undefined> },
    @Res({ passthrough: true }) response: Response,
  ) {
    const sessionId = request.cookies?.[CRM_AUTH_SESSION_COOKIE];
    if (!sessionId) {
      throw new UnauthorizedException('当前未登录。');
    }

    const resolved = await this.crmAuthService.resolveSessionUser(sessionId);
    this.writeAuthSessionCookie(response, resolved.session.id);
    return this.crmAuthService.buildSessionView(resolved.session);
  }

  @Post('logout')
  @HttpCode(200)
  logout(
    @Req() request: Request & { cookies?: Record<string, string | undefined> },
    @Res({ passthrough: true }) response: Response,
  ) {
    const sessionId = request.cookies?.[CRM_AUTH_SESSION_COOKIE];
    this.crmAuthService.closeSession(sessionId);
    response.clearCookie(CRM_AUTH_SESSION_COOKIE, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isAuthCookieSecure(),
      path: '/',
    });
    const sharedCookieDomain = this.readSharedCookieDomain();
    if (sharedCookieDomain) {
      response.clearCookie(CRM_AUTH_SESSION_COOKIE, {
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        path: '/',
        domain: sharedCookieDomain,
      });
    }
    return { success: true };
  }

  @Get('wecom/initiate')
  getWecomLoginInitiate(
    @Query('webBaseUrl') webBaseUrl: string | undefined,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Query('returnUrl') returnUrl?: string,
  ) {
    const loginReturnTarget = this.resolveLoginReturnTarget(
      request,
      webBaseUrl,
      returnUrl,
    );
    const loginRequest = this.wecomWebLoginService.beginLogin({
      webBaseUrl: loginReturnTarget.webBaseUrl,
      ...(loginReturnTarget.returnUrl
        ? { returnUrl: loginReturnTarget.returnUrl }
        : {}),
    });
    response.cookie(CRM_WECOM_LOGIN_STATE_COOKIE, loginRequest.state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isAuthCookieSecure(),
      path: '/',
      maxAge: 5 * 60 * 1000,
    });
    return loginRequest;
  }

  @Get('wecom/callback')
  async handleWecomLoginCallback(
    @Query('state') state: string | undefined,
    @Query('senderId') senderId: string | undefined,
    @Query('code') code: string | undefined,
    @Query('error') error: string | undefined,
    @Res() response: Response,
  ) {
    const config = this.localRuntimeConfigService.getWecomRuntimeConfig();
    const trimmedState = state?.trim();
    const cachedLoginReturnTarget = trimmedState
      ? this.consumeWecomLoginReturnTarget(trimmedState)
      : undefined;
    const redirectWebBaseUrl =
      cachedLoginReturnTarget?.webBaseUrl ?? config.webBaseUrl;
    const redirectUrl = this.buildWecomLoginReturnUrl(
      redirectWebBaseUrl,
      cachedLoginReturnTarget?.returnUrl,
    );

    if (!error && cachedLoginReturnTarget?.webBaseUrl && (code?.trim() || senderId?.trim())) {
      const sharedCookieDomain = this.resolveSharedCookieDomain(
        cachedLoginReturnTarget.webBaseUrl,
      );
      if (sharedCookieDomain) {
        try {
          const loginResult = await this.wecomWebLoginService.resolveCallbackUser({
            code: code?.trim(),
            senderId: senderId?.trim(),
          });

          if (loginResult.kind === 'user') {
            const session = this.crmAuthService.createSessionForUser(
              loginResult.user,
              'wecom-scan',
            );
            this.writeAuthSessionCookie(response, session.id, {
              domain: sharedCookieDomain,
              secure: true,
            });
            const successRedirectUrl = this.buildWecomLoginSuccessRedirectUrl(
              redirectWebBaseUrl,
              cachedLoginReturnTarget?.returnUrl,
            );
            if (
              this.shouldReturnToPreviousPageAfterSharedCookieLogin(
                successRedirectUrl,
              )
            ) {
              response.type('html');
              return response.send(
                this.buildWecomLoginHistoryBackPage(successRedirectUrl),
              );
            }
            return response.redirect(successRedirectUrl.toString());
          }

          redirectUrl.hash = this.buildWecomLoginFeedbackHash({
            authError: encodeURIComponent(loginResult.prompt),
          });
          return response.redirect(redirectUrl.toString());
        } catch (callbackError) {
          redirectUrl.hash = this.buildWecomLoginFeedbackHash({
            authError: encodeURIComponent(
              callbackError instanceof Error && callbackError.message.trim()
                ? callbackError.message.trim()
                : '企业微信登录换票失败，请稍后重试。',
            ),
          });
          return response.redirect(redirectUrl.toString());
        }
      }
    }

    // 门户网关会拦截带扫码 query 的深链接；把结果放入 hash，避免服务器侧二次处理。
    const redirectHashParams = new URLSearchParams();
    if (trimmedState) {
      redirectHashParams.set('state', trimmedState);
    }
    if (senderId?.trim()) {
      redirectHashParams.set('senderId', senderId.trim());
    }
    if (code?.trim()) {
      redirectHashParams.set('code', code.trim());
    }
    if (error) {
      redirectHashParams.set(
        'authError',
        encodeURIComponent(error),
      );
      redirectUrl.hash = this.buildWecomLoginFeedbackHash(redirectHashParams);
      return response.redirect(redirectUrl.toString());
    }

    if (!code?.trim() && !senderId?.trim()) {
      redirectHashParams.set(
        'authError',
        encodeURIComponent('企业微信登录回调缺少必要参数，请重新扫码。'),
      );
    }

    if (Array.from(redirectHashParams.keys()).length > 0) {
      redirectUrl.hash = this.buildWecomLoginFeedbackHash(redirectHashParams);
    }

    return response.redirect(redirectUrl.toString());
  }

  @Post('wecom/exchange')
  async exchangeWecomCode(
    @Body() body: { code?: string; authCode?: string; state?: string },
    @Req() request: Request & { cookies?: Record<string, string | undefined> },
    @Res({ passthrough: true }) response: Response,
  ) {
    const expectedState = request.cookies?.[CRM_WECOM_LOGIN_STATE_COOKIE];
    const state = body.state?.trim();
    if (!state || !expectedState || state !== expectedState) {
      throw new UnauthorizedException('企业微信登录状态校验失败，请重新扫码。');
    }

    const loginResult = await this.wecomWebLoginService.resolveCallbackUser({
      code: body.code?.trim() || body.authCode?.trim(),
    });
    if (loginResult.kind === 'bind_required') {
      throw new UnauthorizedException(loginResult.prompt);
    }

    const session = this.crmAuthService.createSessionForUser(
      loginResult.user,
      'wecom-scan',
    );
    this.writeAuthSessionCookie(response, session.id);
    response.clearCookie(CRM_WECOM_LOGIN_STATE_COOKIE, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isAuthCookieSecure(),
      path: '/',
    });
    return this.crmAuthService.buildSessionView(session);
  }

  private writeAuthSessionCookie(
    response: Response,
    sessionId: string,
    overrides?: {
      domain?: string;
      secure?: boolean;
    },
  ): void {
    response.cookie(CRM_AUTH_SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: overrides?.secure ?? this.isAuthCookieSecure(),
      path: '/',
      maxAge: this.crmAuthService.getSessionTtlMs(),
      ...(overrides?.domain ? { domain: overrides.domain } : {}),
    });
  }

  private isAuthCookieSecure(): boolean {
    const explicitSecure = process.env.CRM_AUTH_COOKIE_SECURE;
    if (explicitSecure === 'true') {
      return true;
    }
    if (explicitSecure === 'false') {
      return false;
    }

    return this.localRuntimeConfigService
      .getWecomRuntimeConfig()
      .webBaseUrl.startsWith('https://');
  }

  /**
   * 构造企业微信扫码完成后的 Web 回跳地址。
   *
   * 参数说明：
   * - webBaseUrl: 扫码发起入口对应的 Web 基址。
   * - returnUrl: 扫码发起时浏览器所在的完整页面地址，可包含门户代理参数。
   *
   * 返回值：优先回到原始门户地址；缺失时回到登录页，并保留原始 `/analysis` 跳转值。
   * 设计原因：门户网关依赖 URL 中的代理参数，扫码成功后重新拼地址会丢失参数并触发网关 302 页面。
   */
  private buildWecomLoginReturnUrl(webBaseUrl: string, returnUrl?: string): URL {
    if (returnUrl?.trim()) {
      return new URL(returnUrl.trim());
    }

    const redirectUrl = new URL(buildWebAppUrl(webBaseUrl, '/login'));
    redirectUrl.search = 'redirect=/analysis';
    return redirectUrl;
  }

  /**
   * 构造企业微信扫码直登成功后的业务页落点。
   *
   * 参数说明：
   * - webBaseUrl: 本次扫码发起入口对应的 Web 基址。
   * - returnUrl: 扫码发起时浏览器所在的完整页面地址，通常是登录页。
   *
   * 返回值：登录页发起时直达 `redirect` 指向的业务页；缺失时进入智能分析页。
   * 设计原因：后端已经写入共享 Cookie，再跳回门户 `/login` 会触发门户网关 302 中间页；
   * 直接进入业务页并附加 `login=wecom`，让前端鉴权守卫按扫码回流做一次短重试。
   */
  private buildWecomLoginSuccessRedirectUrl(
    webBaseUrl: string,
    returnUrl?: string,
  ): URL {
    const originalReturnUrl = this.buildWecomLoginReturnUrl(webBaseUrl, returnUrl);
    if (!this.isWecomLoginPageUrl(originalReturnUrl, webBaseUrl)) {
      originalReturnUrl.searchParams.set('login', 'wecom');
      return originalReturnUrl;
    }

    const redirectPath =
      this.normalizeInternalLoginRedirectPath(
        originalReturnUrl.searchParams.get('redirect'),
      ) ?? '/analysis';
    const baseUrl = new URL(webBaseUrl);
    const basePath = baseUrl.pathname.replace(/\/$/u, '');
    const successRedirectUrl = new URL(
      buildWebAppUrl(`${originalReturnUrl.origin}${basePath}`, redirectPath),
    );
    this.copyWecomSuccessPersistedQuery(originalReturnUrl, successRedirectUrl);
    successRedirectUrl.searchParams.set('login', 'wecom');
    return successRedirectUrl;
  }

  /**
   * 判断回跳地址是否为当前 Web 应用的登录页。
   *
   * 参数说明：`candidateUrl` 为原始回跳地址，`webBaseUrl` 为已校验的应用基址。
   * 返回值：路径命中 `/login` 时返回 `true`。
   */
  private isWecomLoginPageUrl(candidateUrl: URL, webBaseUrl: string): boolean {
    const baseUrl = new URL(webBaseUrl);
    const basePath = baseUrl.pathname.replace(/\/$/u, '');
    const expectedLoginPath = `${basePath}/login`.replace(/\/{2,}/gu, '/');
    const candidatePath = candidateUrl.pathname.replace(/\/$/u, '');
    return candidatePath === expectedLoginPath;
  }

  /**
   * 规范化登录页记录的业务跳转路径。
   *
   * 参数说明：`rawRedirectPath` 来自登录页 `redirect` 查询参数。
   * 返回值：仅允许站内绝对路径；异常、外链或协议相对地址返回空值。
   */
  private normalizeInternalLoginRedirectPath(
    rawRedirectPath: string | null,
  ): string | undefined {
    const redirectPath = rawRedirectPath?.trim();
    if (
      !redirectPath ||
      !redirectPath.startsWith('/') ||
      redirectPath.startsWith('//') ||
      redirectPath.includes('\\')
    ) {
      return undefined;
    }

    return redirectPath;
  }

  /**
   * 复制扫码成功后仍必须保留的门户代理参数。
   *
   * 参数说明：`sourceUrl` 为原登录页地址，`targetUrl` 为业务页跳转地址。
   * 设计原因：门户参数不是业务路由的一部分，但丢失后刷新或服务端落地可能再次被网关拦截。
   */
  private copyWecomSuccessPersistedQuery(
    sourceUrl: URL,
    targetUrl: URL,
  ): void {
    for (const key of WECOM_SUCCESS_PERSISTED_QUERY_KEYS) {
      const value = sourceUrl.searchParams.get(key);
      if (value?.trim()) {
        targetUrl.searchParams.set(key, value);
      }
    }
  }

  /**
   * 判断共享 Cookie 直登成功后是否应回到浏览器历史中的扫码前页面。
   *
   * 参数说明：`successRedirectUrl` 为常规业务页直跳地址。
   * 返回值：没有门户代理参数时返回 `true`。
   * 设计原因：生产门户会把 `GratuitousProxy` 隐藏在外层代理链路中，前端和后端都可能拿不到；
   * 此时继续 302 到门户深链接会显示门户 302 中间页，而会话 Cookie 已经写成功，回退到扫码前页面可复用原门户上下文完成登录。
   */
  private shouldReturnToPreviousPageAfterSharedCookieLogin(
    successRedirectUrl: URL,
  ): boolean {
    return !WECOM_SUCCESS_PERSISTED_QUERY_KEYS.some((key) =>
      Boolean(successRedirectUrl.searchParams.get(key)?.trim()),
    );
  }

  /**
   * 构造扫码成功后的自动回退页。
   *
   * 参数说明：`fallbackUrl` 为浏览器没有历史记录时的兜底地址。
   * 返回值：包含自动回退脚本的 HTML 字符串。
   * 设计原因：用户手动点击浏览器返回已经证明原页面可用；这里自动执行同一动作，避免把用户留在门户 302 页面。
   */
  private buildWecomLoginHistoryBackPage(fallbackUrl: URL): string {
    const fallbackUrlText = fallbackUrl.toString();
    const fallbackUrlScriptLiteral = JSON.stringify(fallbackUrlText);
    const fallbackUrlAttribute = this.escapeHtmlAttribute(fallbackUrlText);

    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>企业微信登录完成</title>
</head>
<body>
  <p>企业微信登录已完成，正在返回系统。</p>
  <p><a href="${fallbackUrlAttribute}">如果页面没有自动返回，请点击这里继续。</a></p>
  <script>
    (function () {
      var fallbackUrl = ${fallbackUrlScriptLiteral};
      try {
        if (window.history.length > 1) {
          window.history.back();
          window.setTimeout(function () {
            window.location.replace(fallbackUrl);
          }, 1800);
          return;
        }
      } catch (error) {
        window.location.replace(fallbackUrl);
        return;
      }
      window.location.replace(fallbackUrl);
    })();
  </script>
</body>
</html>`;
  }

  /**
   * 转义 HTML 属性值，避免兜底链接中出现特殊字符破坏页面结构。
   */
  private escapeHtmlAttribute(value: string): string {
    return value
      .replace(/&/gu, '&amp;')
      .replace(/"/gu, '&quot;')
      .replace(/</gu, '&lt;')
      .replace(/>/gu, '&gt;');
  }

  /**
   * 构造企业微信扫码回流 hash。
   *
   * 参数说明：`params` 为需要交给前端读取的扫码结果或错误提示。
   * 返回值：`wecom-login?...` 格式的 hash 内容。
   */
  private buildWecomLoginFeedbackHash(
    params: URLSearchParams | Record<string, string>,
  ): string {
    const hashParams =
      params instanceof URLSearchParams
        ? params
        : new URLSearchParams(params);
    return `wecom-login?${hashParams.toString()}`;
  }

  /**
   * 解析可跨门户与认证回调域共享的 Cookie 域。
   *
   * 参数说明：`webBaseUrl` 为本次扫码发起入口；只有它属于共享域时才返回配置值。
   * 返回值：允许写入的 Cookie Domain；不满足条件时返回 `undefined`。
   * 设计原因：企业微信 callback 落在认证域名，门户页面落在门户域名，只有同一父域下的
   * 安全共享 Cookie 才能让后端直接完成扫码登录并让门户页面识别会话。
   */
  private resolveSharedCookieDomain(webBaseUrl: string): string | undefined {
    const sharedCookieDomain = this.readSharedCookieDomain();
    if (!sharedCookieDomain) {
      return undefined;
    }

    try {
      const webUrl = new URL(webBaseUrl);
      if (webUrl.protocol !== 'https:') {
        return undefined;
      }

      const normalizedDomain = sharedCookieDomain.replace(/^\./u, '');
      return webUrl.hostname === normalizedDomain ||
        webUrl.hostname.endsWith(`.${normalizedDomain}`)
        ? sharedCookieDomain
        : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * 读取跨子域会话 Cookie 的 Domain 配置。
   */
  private readSharedCookieDomain(): string | undefined {
    const rawDomain = process.env.APP_WEB_SHARED_COOKIE_DOMAIN?.trim();
    if (!rawDomain) {
      return undefined;
    }

    return rawDomain.startsWith('.') ? rawDomain : `.${rawDomain}`;
  }

  /**
   * 消费企业微信扫码回跳目标。
   *
   * 参数说明：`state` 为企业微信扫码链路回传的状态值。
   * 返回值：包含 Web 基址和完整回跳地址的目标；旧服务实现仅返回基址时会做兼容转换。
   */
  private consumeWecomLoginReturnTarget(
    state: string,
  ): WecomLoginReturnTarget | undefined {
    const serviceWithTarget = this.wecomWebLoginService as WecomWebLoginService & {
      consumeLoginReturnTarget?: (
        state?: string,
      ) => WecomLoginReturnTarget | undefined;
    };
    if (typeof serviceWithTarget.consumeLoginReturnTarget === 'function') {
      return serviceWithTarget.consumeLoginReturnTarget(state);
    }

    const webBaseUrl = this.wecomWebLoginService.consumeLoginReturnBaseUrl(state);
    return webBaseUrl ? { webBaseUrl } : undefined;
  }

  /**
   * 解析扫码发起时的安全回跳目标。
   *
   * 参数说明：
   * - request: 发起 `/auth/wecom/initiate` 的浏览器请求。
   * - explicitWebBaseUrl: 前端计算的 Web 基址。
   * - explicitReturnUrl: 前端计算的当前完整页面地址。
   *
   * 返回值：通过校验的 Web 基址和完整回跳地址；无法校验时仅返回可用基址或空基址。
   */
  private resolveLoginReturnTarget(
    request: Request,
    explicitWebBaseUrl?: string,
    explicitReturnUrl?: string,
  ): { webBaseUrl?: string; returnUrl?: string } {
    const resolvedWebBaseUrl = this.resolveLoginReturnBaseUrl(
      request,
      explicitWebBaseUrl,
    );
    const upgradedWebBaseUrl = this.resolveSharedCookiePortalReturnBaseUrl(
      resolvedWebBaseUrl,
      explicitWebBaseUrl,
    );
    const webBaseUrl = upgradedWebBaseUrl ?? resolvedWebBaseUrl;
    const upgradedReturnUrl = upgradedWebBaseUrl
      ? this.resolveSharedCookiePortalReturnUrl(
          upgradedWebBaseUrl,
          explicitWebBaseUrl ?? resolvedWebBaseUrl,
          explicitReturnUrl,
        )
      : undefined;
    const returnUrl =
      upgradedReturnUrl ??
      this.resolveLoginReturnUrl(
        request,
        webBaseUrl,
        explicitReturnUrl,
      );
    return {
      webBaseUrl,
      ...(returnUrl ? { returnUrl } : {}),
    };
  }

  /**
   * 在门户代理隐藏真实外层 URL 时，把异常的内网 HTTPS 地址升级为共享 Cookie 门户基址。
   *
   * 参数说明：
   * - resolvedWebBaseUrl: 常规来源解析得到的 Web 基址，可能已经被代理改写成内网 IP。
   * - explicitWebBaseUrl: 前端显式传入的基址，用于识别 `https://内网IP:80` 这类门户代理特征。
   *
   * 返回值：命中共享 Cookie 域和白名单的门户基址；不满足严格条件时返回空值。
   * 设计原因：生产门户会把应用运行环境改写成内网 IP，前端无法读取 `portal.leagsoft.com`；
   * 只有回到同父域门户地址，企业微信 callback 才能写入 `.leagsoft.com` 会话 Cookie 并完成直登。
   */
  private resolveSharedCookiePortalReturnBaseUrl(
    resolvedWebBaseUrl?: string,
    explicitWebBaseUrl?: string,
  ): string | undefined {
    const sharedCookieDomain = this.readSharedCookieDomain();
    const rawExplicitWebBaseUrl = explicitWebBaseUrl?.trim();
    if (!sharedCookieDomain || !resolvedWebBaseUrl || !rawExplicitWebBaseUrl) {
      return undefined;
    }

    try {
      const explicitUrl = new URL(rawExplicitWebBaseUrl);
      const resolvedUrl = new URL(resolvedWebBaseUrl);
      if (
        !this.isHiddenPortalInternalWebBaseUrl(explicitUrl, resolvedUrl)
      ) {
        return undefined;
      }

      const configuredUrl = new URL(
        this.localRuntimeConfigService.getWecomRuntimeConfig().webBaseUrl,
      );
      const configuredPath = configuredUrl.pathname.replace(/\/$/u, '');
      const normalizedSharedDomain = sharedCookieDomain.replace(/^\./u, '');

      return this.readAllowedLoginReturnBaseUrls()
        .map((allowedBaseUrl) => {
          try {
            return new URL(allowedBaseUrl);
          } catch {
            return undefined;
          }
        })
        .find((allowedUrl): allowedUrl is URL => {
          if (!allowedUrl || allowedUrl.protocol !== 'https:') {
            return false;
          }

          const allowedPath = allowedUrl.pathname.replace(/\/$/u, '');
          const matchesConfiguredPath =
            configuredPath && configuredPath !== '/'
              ? allowedPath === configuredPath
              : Boolean(allowedPath);
          const matchesSharedDomain =
            allowedUrl.hostname === normalizedSharedDomain ||
            allowedUrl.hostname.endsWith(`.${normalizedSharedDomain}`);
          return matchesConfiguredPath && matchesSharedDomain;
        })
        ?.toString()
        .replace(/\/$/u, '');
    } catch {
      return undefined;
    }
  }

  /**
   * 将内网 IP 完整回跳地址改写到共享 Cookie 门户基址下。
   *
   * 参数说明：
   * - upgradedWebBaseUrl: 已确认可用于共享 Cookie 的门户 Web 基址。
   * - resolvedWebBaseUrl: 常规解析得到的内网 Web 基址，用于校验原始回跳地址来源。
   * - explicitReturnUrl: 前端传入的完整当前页地址，可能包含门户网关代理参数。
   *
   * 返回值：改写后的门户完整回跳地址；原始地址不可信或不在应用前缀下时返回空值。
   * 设计原因：门户代理隐藏真实 URL 时，前端只能传回内网 IP 形态的完整地址；
   * 但其中的 `GratuitousProxy` 仍是门户网关回到原页面的必要参数，必须保留并挂到门户域名下。
   */
  private resolveSharedCookiePortalReturnUrl(
    upgradedWebBaseUrl: string,
    resolvedWebBaseUrl?: string,
    explicitReturnUrl?: string,
  ): string | undefined {
    const rawReturnUrl = explicitReturnUrl?.trim();
    if (!resolvedWebBaseUrl || !rawReturnUrl) {
      return undefined;
    }

    try {
      const portalBaseUrl = new URL(upgradedWebBaseUrl);
      const internalBaseUrl = new URL(resolvedWebBaseUrl);
      const returnUrl = new URL(rawReturnUrl);
      if (!['http:', 'https:'].includes(returnUrl.protocol)) {
        return undefined;
      }

      if (returnUrl.origin !== internalBaseUrl.origin) {
        return undefined;
      }

      const internalBasePath = internalBaseUrl.pathname.replace(/\/$/u, '');
      const returnPath = returnUrl.pathname.replace(/\/$/u, '');
      const matchesInternalPath =
        !internalBasePath ||
        internalBasePath === '/' ||
        returnPath === internalBasePath ||
        returnPath.startsWith(`${internalBasePath}/`);
      if (!matchesInternalPath) {
        return undefined;
      }

      const portalReturnUrl = new URL(
        `${returnUrl.pathname}${returnUrl.search}${returnUrl.hash}`,
        portalBaseUrl.origin,
      );
      return portalReturnUrl.toString();
    } catch {
      return undefined;
    }
  }

  /**
   * 判断显式基址是否呈现“门户 HTTPS 外壳 + 内网 IP Host”的代理特征。
   */
  private isHiddenPortalInternalWebBaseUrl(
    explicitUrl: URL,
    resolvedUrl: URL,
  ): boolean {
    const isInternalIpHost = Boolean(isIP(explicitUrl.hostname));
    const isHttpsInternalShell = explicitUrl.protocol === 'https:';
    const resolvedIsSameInternalHost = explicitUrl.hostname === resolvedUrl.hostname;
    return isInternalIpHost && isHttpsInternalShell && resolvedIsSameInternalHost;
  }

  /**
   * 从扫码发起页推导登录完成后的 Web 回跳基址。
   *
   * 参数说明：`request` 为发起 `/auth/wecom/initiate` 的浏览器请求。
   * 返回值：通过当前 Web 前缀校验后的基址；无法校验时返回 `undefined` 并回退到配置值。
   * 注意事项：只复用配置里的路径前缀，避免把 `Referer` 中的登录页路径或查询参数带入回跳地址。
   */
  private resolveLoginReturnBaseUrl(
    request: Request,
    explicitWebBaseUrl?: string,
  ): string | undefined {
    const explicitReturnBaseUrl = this.resolveExplicitLoginReturnBaseUrl(
      request,
      explicitWebBaseUrl,
    );
    if (explicitReturnBaseUrl) {
      return explicitReturnBaseUrl;
    }

    const rawReferer = this.readFirstHeaderValue(
      request.headers.referer ?? request.headers.referrer,
    );
    if (!rawReferer) {
      return undefined;
    }

    try {
      const refererUrl = new URL(rawReferer);
      if (!['http:', 'https:'].includes(refererUrl.protocol)) {
        return undefined;
      }

      const configuredUrl = new URL(
        this.localRuntimeConfigService.getWecomRuntimeConfig().webBaseUrl,
      );
      const configuredPath = configuredUrl.pathname.replace(/\/$/u, '');
      const refererPath = refererUrl.pathname.replace(/\/$/u, '');
      const matchesConfiguredPath =
        !configuredPath ||
        configuredPath === '/' ||
        refererPath === configuredPath ||
        refererPath.startsWith(`${configuredPath}/`);
      if (!matchesConfiguredPath) {
        return undefined;
      }

      return `${refererUrl.origin}${configuredPath}`;
    } catch {
      return undefined;
    }
  }

  /**
   * 校验扫码完成后可回跳的完整页面地址。
   *
   * 参数说明：
   * - request: 发起扫码初始化的请求，用于在前端未显式传值时读取 Referer。
   * - webBaseUrl: 已通过来源或白名单校验的 Web 基址。
   * - explicitReturnUrl: 前端按 `window.location.href` 传入的完整地址。
   *
   * 返回值：同源且位于应用基路径下的完整地址；不满足时返回 `undefined`。
   * 设计原因：只允许回到本应用页面，避免开放跳转；同时保留门户代理参数，避免扫码成功后落到网关 302。
   */
  private resolveLoginReturnUrl(
    request: Request,
    webBaseUrl?: string,
    explicitReturnUrl?: string,
  ): string | undefined {
    if (!webBaseUrl) {
      return undefined;
    }

    const rawReturnUrl =
      explicitReturnUrl?.trim() ||
      this.readFirstHeaderValue(
        request.headers.referer ?? request.headers.referrer,
      );
    if (!rawReturnUrl) {
      return undefined;
    }

    try {
      const baseUrl = new URL(webBaseUrl);
      const candidateUrl = new URL(rawReturnUrl);
      if (!['http:', 'https:'].includes(candidateUrl.protocol)) {
        return undefined;
      }

      if (candidateUrl.origin !== baseUrl.origin) {
        return undefined;
      }

      const basePath = baseUrl.pathname.replace(/\/$/u, '');
      const candidatePath = candidateUrl.pathname.replace(/\/$/u, '');
      const matchesBasePath =
        !basePath ||
        basePath === '/' ||
        candidatePath === basePath ||
        candidatePath.startsWith(`${basePath}/`);
      if (!matchesBasePath) {
        return undefined;
      }

      return candidateUrl.toString();
    } catch {
      return undefined;
    }
  }

  /**
   * 校验前端显式传入的扫码回跳基址。
   *
   * 参数说明：
   * - request: 发起扫码初始化的浏览器请求，用于读取 Referer / Origin 做来源约束。
   * - explicitWebBaseUrl: 前端按当前页面运行环境计算出的 Web 基址。
   *
   * 返回值：校验通过时返回规范化后的 Web 基址；校验失败时返回 `undefined`。
   *
   * 设计原因：跨域代理场景下浏览器可能只发送 Referer origin，不带 `/insight/login`
   * 路径，后端无法仅靠 Referer 还原门户访问前缀；但该值仍必须与请求来源同源，避免形成开放跳转。
   */
  private resolveExplicitLoginReturnBaseUrl(
    request: Request,
    explicitWebBaseUrl?: string,
  ): string | undefined {
    const rawWebBaseUrl = explicitWebBaseUrl?.trim();
    if (!rawWebBaseUrl) {
      return undefined;
    }

    try {
      const candidateUrl = new URL(rawWebBaseUrl);
      if (!['http:', 'https:'].includes(candidateUrl.protocol)) {
        return undefined;
      }

      const configuredUrl = new URL(
        this.localRuntimeConfigService.getWecomRuntimeConfig().webBaseUrl,
      );
      const configuredPath = configuredUrl.pathname.replace(/\/$/u, '');
      const candidatePath = candidateUrl.pathname.replace(/\/$/u, '');
      const matchesConfiguredPath =
        !configuredPath ||
        configuredPath === '/' ||
        candidatePath === configuredPath;
      if (!matchesConfiguredPath) {
        return undefined;
      }

      const sourceOrigin = this.resolveRequestSourceOrigin(request);
      const sourceMatchesCandidate = sourceOrigin === candidateUrl.origin;
      const candidateIsAllowed = this.isAllowedLoginReturnBaseUrl(
        candidateUrl,
        configuredPath,
      );
      if (!sourceMatchesCandidate && !candidateIsAllowed) {
        return undefined;
      }

      return `${candidateUrl.origin}${configuredPath}`;
    } catch {
      return undefined;
    }
  }

  /**
   * 判断显式扫码回跳基址是否属于服务器允许列表。
   *
   * 参数说明：
   * - candidateUrl: 前端传入并已解析的 Web 基址。
   * - configuredPath: 当前应用路径前缀，例如 `/insight`。
   *
   * 返回值：命中 `APP_WEB_ALLOWED_BASE_URLS`、`APP_WEB_BASE_URL` 或 `WECOM_WEB_BASE_URL`
   * 中任意同源同路径配置时返回 `true`。
   *
   * 设计原因：门户平台或反向代理可能把 Referer 改写为内网 IP，不能单靠来源头判断；
   * 但回跳目标仍必须落在部署白名单中，避免扫码接口变成开放跳转入口。
   */
  private isAllowedLoginReturnBaseUrl(
    candidateUrl: URL,
    configuredPath: string,
  ): boolean {
    return this.readAllowedLoginReturnBaseUrls().some((allowedBaseUrl) => {
      try {
        const allowedUrl = new URL(allowedBaseUrl);
        const allowedPath = allowedUrl.pathname.replace(/\/$/u, '');
        const expectedPath =
          configuredPath && configuredPath !== '/'
            ? configuredPath
            : allowedPath;
        return (
          allowedUrl.origin === candidateUrl.origin &&
          allowedPath === expectedPath
        );
      } catch {
        return false;
      }
    });
  }

  /**
   * 读取允许作为扫码回跳目标的 Web 基址列表。
   *
   * 返回值说明：包含显式白名单以及当前主 Web 配置；多个显式值可用逗号、分号或空白分隔。
   */
  private readAllowedLoginReturnBaseUrls(): string[] {
    const config = this.localRuntimeConfigService.getWecomRuntimeConfig();
    const rawAllowedBaseUrls = process.env.APP_WEB_ALLOWED_BASE_URLS ?? '';
    return [
      ...rawAllowedBaseUrls.split(/[,\s;]+/u),
      config.webBaseUrl,
      process.env.APP_WEB_BASE_URL,
      process.env.WECOM_WEB_BASE_URL,
    ].filter((item): item is string => Boolean(item?.trim()));
  }

  /**
   * 解析扫码初始化请求的来源 origin。
   *
   * 参数说明：`request` 为浏览器请求；优先使用 Origin，其次使用 Referer / Referrer。
   * 返回值：合法 HTTP(S) 来源的 origin；没有可用来源时返回 `undefined`。
   */
  private resolveRequestSourceOrigin(request: Request): string | undefined {
    const rawOrigin = this.readFirstHeaderValue(request.headers.origin);
    if (rawOrigin) {
      try {
        const originUrl = new URL(rawOrigin);
        if (['http:', 'https:'].includes(originUrl.protocol)) {
          return originUrl.origin;
        }
      } catch {
        return undefined;
      }
    }

    const rawReferer = this.readFirstHeaderValue(
      request.headers.referer ?? request.headers.referrer,
    );
    if (!rawReferer) {
      return undefined;
    }

    try {
      const refererUrl = new URL(rawReferer);
      return ['http:', 'https:'].includes(refererUrl.protocol)
        ? refererUrl.origin
        : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * 读取可能为数组的请求头首个值。
   *
   * 参数说明：`value` 为 Express 请求头字段值。
   * 返回值：去除空白后的首个有效字符串；没有有效值时返回 `undefined`。
   */
  private readFirstHeaderValue(value: string | string[] | undefined): string | undefined {
    const firstValue = Array.isArray(value) ? value[0] : value;
    return firstValue?.trim() || undefined;
  }
}

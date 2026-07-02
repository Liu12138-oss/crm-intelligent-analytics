import {
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthSessionRepository } from './auth-session.repository';
import type { AuthSessionRecord, CrmUser } from '../../shared/types/domain';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';
import { CRM_AUTH_ACCOUNTS, CRM_USERS } from '../../shared/mock/sample-data';
import { CrmReadonlyService } from '../../database/crm-readonly/crm-readonly.service';
import { AuditEventRepository } from '../audit/audit-event.repository';
import { UserScopeService } from './user-scope.service';
import { WecomLoginBindingRepository } from './wecom-login-binding.repository';
import { CrmWecomIdentityRepository } from '../wecom/crm-wecom-identity.repository';
import { CrmPhoneConfirmationRepairService } from './crm-phone-confirmation-repair.service';
import { buildEntityId } from '../../shared/utils/id.util';
import { QueryExecutionTimeoutError } from '../analysis/analysis.errors';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import { SqlAuditContextService } from '../audit/sql-audit-context.service';
import { CrmLoginIdentityApiService } from './crm-login-identity-api.service';

const noopSqlAuditContextService = {
  run: async <T>(_context: Record<string, unknown>, handler: () => Promise<T>): Promise<T> =>
    handler(),
} as SqlAuditContextService;

type CrmLoginIdentityResolver = Pick<
  CrmLoginIdentityApiService,
  'isEnabled' | 'getUserById'
>;

const noopCrmLoginIdentityApiService = {
  isEnabled: () => false,
  getUserById: async () => undefined,
} as CrmLoginIdentityResolver;

interface CrmLoginResult {
  corpId?: string;
  crmAccessToken?: string;
  user: CrmUser;
}

@Injectable()
export class CrmAuthService {
  private readonly sessionTtlHours = Number(
    process.env.CRM_AUTH_SESSION_TTL_HOURS ?? '12',
  );
  private readonly resolvedSessionUserCacheTtlMs = Number(
    process.env.CRM_AUTH_SESSION_USER_CACHE_TTL_MS ?? '30000',
  );
  private readonly sessionUserResolutionPromises = new Map<
    string,
    Promise<CrmUser | undefined>
  >();
  private readonly resolvedSessionUsers = new Map<
    string,
    {
      user: CrmUser;
      expiresAt: number;
    }
  >();

  constructor(
    @Inject(AuthSessionRepository)
    private readonly authSessionRepository: AuthSessionRepository,
    @Inject(LocalRuntimeConfigService)
    private readonly localRuntimeConfigService: LocalRuntimeConfigService,
    @Inject(CrmReadonlyService)
    private readonly crmReadonlyService: CrmReadonlyService,
    @Inject(AuditEventRepository)
    private readonly auditEventRepository: AuditEventRepository,
    @Inject(UserScopeService)
    private readonly userScopeService: UserScopeService,
    @Inject(WecomLoginBindingRepository)
    private readonly wecomLoginBindingRepository: WecomLoginBindingRepository,
    @Inject(CrmWecomIdentityRepository)
    private readonly crmWecomIdentityRepository: CrmWecomIdentityRepository,
    @Inject(CrmPhoneConfirmationRepairService)
    private readonly crmPhoneConfirmationRepairService: CrmPhoneConfirmationRepairService,
    @Inject(AnalysisLoggerService)
    private readonly analysisLoggerService: AnalysisLoggerService,
    @Inject(SqlAuditContextService)
    private readonly sqlAuditContextService: SqlAuditContextService = noopSqlAuditContextService,
    @Inject(CrmLoginIdentityApiService)
    private readonly crmLoginIdentityApiService: CrmLoginIdentityResolver = noopCrmLoginIdentityApiService,
  ) {}

  async loginByPassword(params: {
    login: string;
    password: string;
    corpId?: string;
    wecomBindToken?: string;
  }): Promise<AuthSessionRecord> {
    try {
      const loginResult = await this.authenticateByPassword(params);
      await this.bindWecomUserIfNeeded(loginResult.user, params.wecomBindToken);
      const session = this.createSession(
        loginResult.user,
        'password-login',
        loginResult.crmAccessToken,
        loginResult.corpId,
      );

      this.auditEventRepository.create({
        id: buildEntityId('audit'),
        eventType: 'AUTH_LOGIN_SUCCEEDED',
        actorId: loginResult.user.id,
        actorRoleIds: loginResult.user.roleIds,
        scopeSnapshot: this.userScopeService.resolveScope(loginResult.user),
        sessionSnapshot: { sessionId: session.id, source: session.source },
        riskLevel: 'LOW',
        reviewStatus: 'CONFIRMED',
        outcome: '账号密码登录成功。',
        createdAt: new Date().toISOString(),
      });

      return session;
    } catch (error) {
      this.auditEventRepository.create({
        id: buildEntityId('audit'),
        eventType: 'AUTH_LOGIN_FAILED',
        actorId: params.login,
        actorRoleIds: [],
        scopeSnapshot: {
          organizationIds: [],
          departmentIds: [],
          ownerIds: [],
          scopeSummary: '登录失败，未建立有效权限范围。',
        },
        riskLevel: 'MEDIUM',
        reviewStatus: 'PENDING',
        outcome: '账号密码登录失败。',
        failureReason:
          error instanceof Error ? error.message : '账号密码登录失败。',
        createdAt: new Date().toISOString(),
      });
      throw error;
    }
  }

  createSessionForUser(
    user: CrmUser,
    source: AuthSessionRecord['source'],
  ): AuthSessionRecord {
    return this.createSession(user, source);
  }

  getSessionTtlMs(): number {
    return this.sessionTtlHours * 60 * 60 * 1000;
  }

  getSession(sessionId: string): AuthSessionRecord | undefined {
    const session = this.authSessionRepository.findById(sessionId);
    if (!session) {
      return undefined;
    }

    if (session.sessionStatus !== 'ACTIVE') {
      return undefined;
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      this.authSessionRepository.save({
        ...session,
        sessionStatus: 'EXPIRED',
        updatedAt: new Date().toISOString(),
      });
      return undefined;
    }

    return session;
  }

  async resolveSessionUser(sessionId: string): Promise<{
    session: AuthSessionRecord;
    user: CrmUser;
  }> {
    const startedAt = Date.now();
    const session = this.getSession(sessionId);
    if (!session) {
      throw new UnauthorizedException('登录状态已失效，请重新登录。');
    }

    let user = session.userSnapshot;
    let cacheHit = false;
    if (this.shouldRefreshSessionIdentity(session.userSnapshot)) {
      const cachedUser = this.getCachedResolvedSessionUser(session.id);
      if (cachedUser) {
        user = cachedUser;
        cacheHit = true;
      } else {
        const liveUser = await this.resolveSessionUserFromLiveIdentity(session);
        if (liveUser) {
          user = liveUser;
          this.cacheResolvedSessionUser(session.id, liveUser);
        }
      }
    }

    const refreshedSession = this.authSessionRepository.save({
      ...session,
      userSnapshot: user,
      lastAccessAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    this.analysisLoggerService.logStep('会话用户解析完成。', {
      sessionId,
      requesterId: refreshedSession.requesterId,
      identitySource: refreshedSession.userSnapshot.identitySource ?? 'unknown',
      cacheHit,
      durationMs: Date.now() - startedAt,
    });

    return {
      session: refreshedSession,
      user,
    };
  }

  closeSession(sessionId: string | undefined): void {
    if (!sessionId) {
      return;
    }

    const session = this.authSessionRepository.findById(sessionId);
    if (!session) {
      return;
    }

    this.authSessionRepository.save({
      ...session,
      sessionStatus: 'CLOSED',
      updatedAt: new Date().toISOString(),
    });
    this.resolvedSessionUsers.delete(sessionId);
  }

  /**
   * 主动清空会话实时身份短缓存，供权限、角色和数据范围变更后调用。
   *
   * @returns 无返回值。
   * @throws 不抛出异常；只影响短 TTL 身份缓存和并发去重等待池。
   */
  invalidateResolvedSessionUserCache(): void {
    this.resolvedSessionUsers.clear();
    this.sessionUserResolutionPromises.clear();
  }

  buildSessionView(session: AuthSessionRecord): Record<string, unknown> {
    return {
      authenticated: true,
      sessionId: session.id,
      source: session.source,
      expiresAt: session.expiresAt,
      user: {
        id: session.userSnapshot.id,
        name: session.userSnapshot.name,
        roleNames: session.userSnapshot.roleNames,
        channels: session.userSnapshot.channels,
        organizationIds: session.userSnapshot.organizationIds,
        departmentIds: session.userSnapshot.departmentIds,
      },
    };
  }

  private createSession(
    user: CrmUser,
    source: AuthSessionRecord['source'],
    crmAccessToken?: string,
    corpId?: string,
  ): AuthSessionRecord {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.getSessionTtlMs());
    const session: AuthSessionRecord = {
      id: buildEntityId('auth_session'),
      requesterId: user.id,
      source,
      sessionStatus: 'ACTIVE',
      crmCorpId: corpId,
      crmAccessToken,
      userSnapshot: user,
      lastAccessAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    const savedSession = this.authSessionRepository.save(session);
    this.cacheSessionUserIfRefreshableIdentity(savedSession);
    return savedSession;
  }

  private async authenticateByPassword(params: {
    login: string;
    password: string;
    corpId?: string;
  }): Promise<CrmLoginResult> {
    const config = this.localRuntimeConfigService.getCrmAuthConfig();
    const loginPath = config.loginPath || '/api/v2/auth/login';
    if (config.mockEnabled) {
      const account = CRM_AUTH_ACCOUNTS.find(
        (item) =>
          item.login === params.login &&
          item.password === params.password &&
          (!params.corpId || item.corpId === params.corpId),
      );

      if (!account) {
        throw new UnauthorizedException('账号或密码错误。');
      }

      const user = CRM_USERS.find((item) => item.id === account.userId);
      if (!user) {
        throw new UnauthorizedException('当前登录账号未绑定有效的 CRM 用户。');
      }

      return {
        corpId: account.corpId,
        crmAccessToken: `mock-token-${account.userId}`,
        user: { ...user, identitySource: 'mock' },
      };
    }

    if (!config.enabled || !config.baseUrl) {
      throw new UnauthorizedException(
        '当前未配置 CRM 登录地址，请设置 CRM_OPEN_API_BASE_URL 后重试。',
      );
    }

    const body: Record<string, unknown> = {
      login: params.login,
      password: params.password,
      device: config.device,
    };
    if (params.corpId ?? config.corpId) {
      body.corp_id = params.corpId ?? config.corpId;
    }

    let loginResponse = await this.requestCrmLogin(
      config.baseUrl,
      loginPath,
      config.timeoutMs,
      body,
    );
    if (this.shouldRetryAfterPhoneConfirmation(loginResponse.payload)) {
      const repaired =
        await this.crmPhoneConfirmationRepairService.repairIfMissing(
          params.login,
        );
      if (repaired) {
        loginResponse = await this.requestCrmLogin(
          config.baseUrl,
          loginPath,
          config.timeoutMs,
          body,
        );
      }
    }

    const { responseOk, payload } = loginResponse;
    if (!responseOk || Number(payload.code ?? -1) !== 0) {
      throw new UnauthorizedException(
        String(payload.message ?? 'CRM 登录失败。'),
      );
    }

    const data = (payload.data ?? {}) as Record<string, unknown>;
    const userId = data.user_id ?? payload.user_id;
    const userToken = data.user_token ?? payload.user_token;
    if (!userId || !userToken) {
      throw new UnauthorizedException('CRM 登录返回缺少必要字段。');
    }

    const user = await this.resolveUserFromLiveIdentity(
      String(userId),
      String(userToken),
    );
    if (!user) {
      throw new UnauthorizedException('当前登录账号未绑定有效的 CRM 数据权限。');
    }

    return {
      corpId: params.corpId ?? config.corpId,
      crmAccessToken: String(userToken),
      user,
    };
  }

  private async bindWecomUserIfNeeded(
    user: CrmUser,
    wecomBindToken?: string,
  ): Promise<void> {
    if (!wecomBindToken) {
      return;
    }

    const pendingBinding =
      this.wecomLoginBindingRepository.findPendingBindingByToken(
        wecomBindToken,
      );
    if (!pendingBinding) {
      throw new UnauthorizedException('当前企业微信绑定请求已失效，请重新扫码。');
    }

    if (new Date(pendingBinding.expiresAt).getTime() <= Date.now()) {
      this.wecomLoginBindingRepository.removePendingBinding(wecomBindToken);
      throw new UnauthorizedException('当前企业微信绑定请求已过期，请重新扫码。');
    }

    const bindingResult =
      await this.crmWecomIdentityRepository.bindWecomWebLoginUser({
        wecomUserId: pendingBinding.wecomUserId,
        wecomUserName: pendingBinding.wecomUserName,
        mobile: pendingBinding.mobile,
        email: pendingBinding.email,
        crmUserId: user.id,
      });
    if (bindingResult.status === 'CONFLICT') {
      throw new UnauthorizedException(
        '当前企业微信账号已绑定其他 CRM 用户，请联系管理员处理。',
      );
    }

    this.wecomLoginBindingRepository.removePendingBinding(wecomBindToken);
  }

  private async requestCrmLogin(
    baseUrl: string,
    loginPath: string,
    timeoutMs: number,
    body: Record<string, unknown>,
  ): Promise<{
    responseOk: boolean;
    payload: Record<string, unknown>;
  }> {
    let response: Response;
    const startedAt = Date.now();
    try {
      response = await fetch(`${baseUrl}${loginPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      this.analysisLoggerService.logWarn('CRM Open API 登录请求失败。', {
        endpoint: loginPath,
        timeoutMs,
        durationMs: Date.now() - startedAt,
      });
      throw new ServiceUnavailableException(
        `当前无法连接 CRM 登录服务，请确认 ${baseUrl} 可达后重试。`,
      );
    }

    const payload = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    this.analysisLoggerService.logStep('CRM Open API 登录请求完成。', {
      endpoint: loginPath,
      statusCode: response.status,
      responseOk: response.ok,
      timeoutMs,
      durationMs: Date.now() - startedAt,
    });
    return {
      responseOk: response.ok,
      payload,
    };
  }

  private shouldRetryAfterPhoneConfirmation(
    payload: Record<string, unknown>,
  ): boolean {
    return String(payload.message ?? '') === '帐号不存在';
  }

  /**
   * 统一包装只读库身份解析异常，避免瞬时抖动直接把登录态相关接口打成泛化 500。
   *
   * @param userId CRM 用户编号。
   * @returns 命中的实时 CRM 用户；查无结果时返回 undefined。
   * @throws ServiceUnavailableException 当身份查询连续超时或只读库暂时不可用时抛出。
   */
  private async resolveUserFromLiveIdentity(
    userId: string,
    crmAccessToken?: string,
  ): Promise<CrmUser | undefined> {
    try {
      const liveUser = await this.crmReadonlyService.getUserById(userId);
      if (liveUser) {
        return liveUser;
      }

      if (!this.crmLoginIdentityApiService.isEnabled()) {
        return undefined;
      }

      return await this.crmLoginIdentityApiService.getUserById(
        userId,
        crmAccessToken,
      );
    } catch (error) {
      if (error instanceof QueryExecutionTimeoutError) {
        throw new ServiceUnavailableException(
          '当前 CRM 身份数据暂时繁忙，请稍后重试。',
        );
      }

      throw error;
    }
  }

  /**
   * 同一会话在页面初始化时会并发命中多个受保护接口，这里对实时身份装载做同会话内去重，
   * 避免权限中心、审计中心等页面一次刷新就把 CRM 身份查询放大成多次并发慢查询。
   */
  private async resolveSessionUserFromLiveIdentity(
    session: AuthSessionRecord,
  ): Promise<CrmUser | undefined> {
    const cacheKey = `${session.id}:${session.userSnapshot.id}`;
    const currentPromise = this.sessionUserResolutionPromises.get(cacheKey);
    if (currentPromise) {
      return currentPromise;
    }

    const nextPromise = this.sqlAuditContextService.run(
      {
        actorId: session.userSnapshot.id,
        actorRoleIds: session.userSnapshot.roleIds,
        channel: 'web-console',
        sessionId: session.id,
        moduleKey: 'crm-identity',
        programName: 'CrmAuthService.resolveSessionUser',
      },
      () =>
        this.resolveUserFromLiveIdentity(
          session.userSnapshot.id,
          session.crmAccessToken,
        ),
    ).finally(() => {
      this.sessionUserResolutionPromises.delete(cacheKey);
    });
    this.sessionUserResolutionPromises.set(cacheKey, nextPromise);
    return nextPromise;
  }

  /**
   * 受保护页面切换会在短时间内连续命中多个接口，这里复用最近一次实时身份结果，
   * 避免同一数据库身份会话在几秒内对只读库重复发起相同用户查询。
   */
  private getCachedResolvedSessionUser(sessionId: string): CrmUser | undefined {
    const cached = this.resolvedSessionUsers.get(sessionId);
    if (!cached) {
      return undefined;
    }

    if (cached.expiresAt <= Date.now()) {
      this.resolvedSessionUsers.delete(sessionId);
      return undefined;
    }

    return cached.user;
  }

  /**
   * 将最近一次实时身份解析结果缓存到会话维度，并使用短 TTL 控制陈旧风险。
   */
  private cacheResolvedSessionUser(sessionId: string, user: CrmUser): void {
    this.resolvedSessionUsers.set(sessionId, {
      user,
      expiresAt: Date.now() + this.resolvedSessionUserCacheTtlMs,
    });
  }

  /**
   * 登录或扫码换票刚完成时，用户身份已经经过 CRM 实时来源解析。
   *
   * @param session 新建的本地会话记录。
   * @returns 无返回值，数据库身份会被写入短时缓存，非数据库身份保持原逻辑。
   * @throws 不抛出异常；缓存失败不应影响登录主链路。
   */
  private cacheSessionUserIfRefreshableIdentity(session: AuthSessionRecord): void {
    if (!this.shouldRefreshSessionIdentity(session.userSnapshot)) {
      return;
    }

    this.cacheResolvedSessionUser(session.id, session.userSnapshot);
  }

  /**
   * 判断当前会话快照是否应在访问时继续回源刷新实时身份。
   *
   * 参数说明：`user` 为会话内保存的 CRM 用户快照。
   * 返回值说明：数据库身份或身份 API 身份返回 `true`，其余来源返回 `false`。
   * 调用注意事项：mock 身份不回源，避免本地联调链路被误打成真实依赖。
   */
  private shouldRefreshSessionIdentity(user: CrmUser): boolean {
    return user.identitySource === 'database' || user.identitySource === 'crm-api';
  }
}

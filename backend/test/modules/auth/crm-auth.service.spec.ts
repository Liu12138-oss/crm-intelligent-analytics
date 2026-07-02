import { CrmAuthService } from '../../../src/modules/auth/crm-auth.service';
import type {
  AuthSessionRecord,
  CrmUser,
} from '../../../src/shared/types/domain';

describe('CrmAuthService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('账号密码登录已解析数据库身份后，后续会话解析应复用登录身份快照', async () => {
    const sessions: AuthSessionRecord[] = [];
    const databaseUser: CrmUser = {
      id: 'user_database_001',
      name: '数据库用户',
      roleIds: ['role_sales_director'],
      roleNames: ['销售总监'],
      organizationIds: ['org_north'],
      departmentIds: ['dept_sales'],
      ownerIds: ['owner_database_001'],
      isAdmin: false,
      exportAllowed: true,
      channels: ['web-console', 'wecom-bot'],
      identitySource: 'database',
    };
    const authSessionRepository = {
      findById: jest.fn((sessionId: string) =>
        sessions.find((item) => item.id === sessionId),
      ),
      save: jest.fn((session: AuthSessionRecord) => {
        const currentIndex = sessions.findIndex((item) => item.id === session.id);
        if (currentIndex >= 0) {
          sessions[currentIndex] = session;
        } else {
          sessions.unshift(session);
        }
        return session;
      }),
    };
    const getUserById = jest.fn(async () => databaseUser);
    const service = new CrmAuthService(
      authSessionRepository as never,
      {
        getCrmAuthConfig: jest.fn(() => ({
          enabled: true,
          baseUrl: 'https://crm.example.test',
          corpId: 'mock-corp',
          versionCode: '9.9.9',
          device: 'open_api',
          timeoutMs: 1000,
          mockEnabled: false,
        })),
      } as never,
      { getUserById } as never,
      { create: jest.fn() } as never,
      {
        resolveScope: jest.fn(() => ({
          organizationIds: databaseUser.organizationIds,
          departmentIds: databaseUser.departmentIds,
          ownerIds: databaseUser.ownerIds,
          scopeSummary: '数据库用户范围',
        })),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      { logStep: jest.fn(), logWarn: jest.fn() } as never,
    );

    global.fetch = jest.fn(async () =>
      new Response(
        JSON.stringify({
          code: 0,
          data: {
            user_id: databaseUser.id,
            user_token: 'crm-token-001',
          },
        }),
        { status: 200 },
      ),
    ) as typeof global.fetch;

    const session = await service.loginByPassword({
      login: 'director',
      password: 'director123',
      corpId: 'mock-corp',
    });

    await service.resolveSessionUser(session.id);

    expect(getUserById).toHaveBeenCalledTimes(1);
  });

  it('真实登录时只读库未命中且已配置身份 API，应回退到身份 API 解析用户', async () => {
    const sessions: AuthSessionRecord[] = [];
    const apiUser: CrmUser = {
      id: 'A013',
      name: '区域管理员',
      roleIds: ['role_admin'],
      roleNames: ['区域管理员'],
      organizationIds: ['org_sd'],
      departmentIds: ['dept_sd'],
      ownerIds: ['A013'],
      isAdmin: true,
      exportAllowed: true,
      channels: ['web-console'],
      identitySource: 'crm-api',
    };
    const authSessionRepository = {
      findById: jest.fn((sessionId: string) =>
        sessions.find((item) => item.id === sessionId),
      ),
      save: jest.fn((session: AuthSessionRecord) => {
        const currentIndex = sessions.findIndex((item) => item.id === session.id);
        if (currentIndex >= 0) {
          sessions[currentIndex] = session;
        } else {
          sessions.unshift(session);
        }
        return session;
      }),
    };
    const identityApiService = {
      isEnabled: jest.fn(() => true),
      getUserById: jest.fn(async () => apiUser),
    };
    const service = new CrmAuthService(
      authSessionRepository as never,
      {
        getCrmAuthConfig: jest.fn(() => ({
          enabled: true,
          baseUrl: 'https://crm.example.test',
          corpId: 'mock-corp',
          versionCode: '9.9.9',
          device: 'open_api',
          timeoutMs: 1000,
          mockEnabled: false,
        })),
      } as never,
      { getUserById: jest.fn(async () => undefined) } as never,
      { create: jest.fn() } as never,
      {
        resolveScope: jest.fn(() => ({
          organizationIds: apiUser.organizationIds,
          departmentIds: apiUser.departmentIds,
          ownerIds: apiUser.ownerIds,
          scopeSummary: '身份 API 范围',
        })),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      { logStep: jest.fn(), logWarn: jest.fn() } as never,
      undefined,
      identityApiService as never,
    );

    global.fetch = jest.fn(async () =>
      new Response(
        JSON.stringify({
          code: 0,
          data: {
            user_id: 'A013',
            user_token: 'crm-token-identity-api',
          },
        }),
        { status: 200 },
      ),
    ) as typeof global.fetch;

    const session = await service.loginByPassword({
      login: 'admin_sd',
      password: '123456',
      corpId: 'mock-corp',
    });

    expect(identityApiService.getUserById).toHaveBeenCalledWith(
      'A013',
      'crm-token-identity-api',
    );
    expect(session.userSnapshot.identitySource).toBe('crm-api');
  });

  it('主动失效身份短缓存后，会话恢复应重新读取实时数据库身份', async () => {
    const now = new Date().toISOString();
    const databaseUser: CrmUser = {
      id: 'user_database_cache_reset',
      name: '缓存用户',
      roleIds: ['role_sales_director'],
      roleNames: ['销售总监'],
      organizationIds: ['org_north'],
      departmentIds: ['dept_sales'],
      ownerIds: ['owner_database_cache_reset'],
      isAdmin: false,
      exportAllowed: true,
      channels: ['web-console'],
      identitySource: 'database',
    };
    const sessions: AuthSessionRecord[] = [
      {
        id: 'auth_session_cache_reset',
        requesterId: databaseUser.id,
        source: 'password-login',
        sessionStatus: 'ACTIVE',
        userSnapshot: databaseUser,
        lastAccessAt: now,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        createdAt: now,
        updatedAt: now,
      },
    ];
    const authSessionRepository = {
      findById: jest.fn((sessionId: string) =>
        sessions.find((item) => item.id === sessionId),
      ),
      save: jest.fn((session: AuthSessionRecord) => {
        sessions[0] = session;
        return session;
      }),
    };
    const getUserById = jest.fn(async () => databaseUser);
    const service = new CrmAuthService(
      authSessionRepository as never,
      { getCrmAuthConfig: jest.fn() } as never,
      { getUserById } as never,
      { create: jest.fn() } as never,
      { resolveScope: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      { logStep: jest.fn(), logWarn: jest.fn() } as never,
    );

    await service.resolveSessionUser('auth_session_cache_reset');
    await service.resolveSessionUser('auth_session_cache_reset');
    service.invalidateResolvedSessionUserCache();
    await service.resolveSessionUser('auth_session_cache_reset');

    expect(getUserById).toHaveBeenCalledTimes(2);
  });

  it('同一数据库会话并发恢复时应去重实时身份查询', async () => {
    const now = new Date().toISOString();
    const databaseUser: CrmUser = {
      id: 'user_database_dedupe',
      name: '并发用户',
      roleIds: ['role_sales_director'],
      roleNames: ['销售总监'],
      organizationIds: ['org_north'],
      departmentIds: ['dept_sales'],
      ownerIds: ['owner_database_dedupe'],
      isAdmin: false,
      exportAllowed: true,
      channels: ['web-console'],
      identitySource: 'database',
    };
    const sessions: AuthSessionRecord[] = [
      {
        id: 'auth_session_dedupe',
        requesterId: databaseUser.id,
        source: 'password-login',
        sessionStatus: 'ACTIVE',
        userSnapshot: databaseUser,
        lastAccessAt: now,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        createdAt: now,
        updatedAt: now,
      },
    ];
    const getUserById = jest.fn(
      async () =>
        new Promise<CrmUser>((resolve) => {
          setTimeout(() => resolve(databaseUser), 5);
        }),
    );
    const service = new CrmAuthService(
      {
        findById: jest.fn((sessionId: string) =>
          sessions.find((item) => item.id === sessionId),
        ),
        save: jest.fn((session: AuthSessionRecord) => session),
      } as never,
      { getCrmAuthConfig: jest.fn() } as never,
      { getUserById } as never,
      { create: jest.fn() } as never,
      { resolveScope: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      { logStep: jest.fn(), logWarn: jest.fn() } as never,
    );

    await Promise.all([
      service.resolveSessionUser('auth_session_dedupe'),
      service.resolveSessionUser('auth_session_dedupe'),
    ]);

    expect(getUserById).toHaveBeenCalledTimes(1);
  });

  it('解析数据库会话用户时应把 SQL 审计上下文归因到当前会话用户', async () => {
    const now = new Date().toISOString();
    const databaseUser: CrmUser = {
      id: 'user_database_002',
      name: '数据库用户二号',
      roleIds: ['role_sales_director'],
      roleNames: ['销售总监'],
      organizationIds: ['org_north'],
      departmentIds: ['dept_sales'],
      ownerIds: ['owner_database_002'],
      isAdmin: false,
      exportAllowed: true,
      channels: ['web-console'],
      identitySource: 'database',
    };
    const sessions: AuthSessionRecord[] = [
      {
        id: 'auth_session_database_002',
        requesterId: databaseUser.id,
        source: 'password-login',
        sessionStatus: 'ACTIVE',
        userSnapshot: databaseUser,
        lastAccessAt: now,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        createdAt: now,
        updatedAt: now,
      },
    ];
    const authSessionRepository = {
      findById: jest.fn((sessionId: string) =>
        sessions.find((item) => item.id === sessionId),
      ),
      save: jest.fn((session: AuthSessionRecord) => session),
    };
    const sqlAuditContextService = {
      run: jest.fn(
        async (_context: Record<string, unknown>, handler: () => Promise<unknown>) =>
          handler(),
      ),
    };
    const service = new CrmAuthService(
      authSessionRepository as never,
      { getCrmAuthConfig: jest.fn() } as never,
      { getUserById: jest.fn(async () => databaseUser) } as never,
      { create: jest.fn() } as never,
      { resolveScope: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      { logStep: jest.fn(), logWarn: jest.fn() } as never,
      sqlAuditContextService as never,
    );

    await service.resolveSessionUser('auth_session_database_002');

    expect(sqlAuditContextService.run).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'user_database_002',
        actorRoleIds: ['role_sales_director'],
        channel: 'web-console',
        sessionId: 'auth_session_database_002',
        moduleKey: 'crm-identity',
        programName: 'CrmAuthService.resolveSessionUser',
      }),
      expect.any(Function),
    );
  });
});

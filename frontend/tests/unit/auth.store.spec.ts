import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from '@/stores/auth.store';
import { authService } from '@/services/auth.service';
import { analysisService } from '@/services/analysis.service';

vi.mock('@/services/analysis.service', () => ({
  analysisService: {
    getCapabilities: vi.fn(),
  },
}));

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.mocked(analysisService.getCapabilities).mockResolvedValue({
      serviceStatus: 'ONLINE',
      scopeSummary: '测试权限范围',
      roleNames: ['销售总监'],
      channels: ['web-console'],
      domains: ['opportunity-analysis'],
      metrics: ['新增商机金额'],
      dimensions: ['销售负责人'],
      exportAllowed: true,
      exportRowLimit: 1000,
      exportDailyLimit: 3,
      remainingDailyExports: 3,
      historyEnabled: true,
      templateCount: 1,
      dataFreshnessAt: '2026-04-22T09:00:00.000Z',
      visibleMenus: ['analysis-workbench', 'contract-review'],
      actionKeys: ['analysis.use', 'analysis.export'],
      followUpAllowed: true,
      templateViewAllowed: true,
      contractWorkspaceAllowed: true,
      wecomBotAccessState: 'ALLOWED',
      contractPermissions: {
        uploadAllowed: true,
        crossViewAllowed: false,
        crossDownloadAllowed: false,
      },
    });
  });

  it('应在没有本地 sessionId 的情况下通过会话接口水合登录态', async () => {
    vi.spyOn(authService, 'getCurrentSession').mockResolvedValue({
      authenticated: true,
      sessionId: 'auth_session_cookie_only',
      source: 'wecom-scan',
      expiresAt: '2026-04-03T10:00:00.000Z',
      user: {
        id: 'user_sales_director',
        name: '销售总监',
        roleNames: ['销售总监'],
        channels: ['web-console'],
        organizationIds: ['org_north'],
        departmentIds: ['dept_sales'],
      },
    });

    const authStore = useAuthStore();
    await authStore.hydrateSession();

    expect(authService.getCurrentSession).toHaveBeenCalledTimes(1);
    expect(authStore.isAuthenticated).toBe(true);
    expect(authStore.currentUser?.name).toBe('销售总监');
  });

  it('账号密码登录后不应把 sessionId 写入 localStorage', async () => {
    vi.spyOn(authService, 'login').mockResolvedValue({
      authenticated: true,
      sessionId: 'auth_session_cookie_only',
      source: 'password-login',
      expiresAt: '2026-04-03T10:00:00.000Z',
      user: {
        id: 'user_sales_director',
        name: '销售总监',
        roleNames: ['销售总监'],
        channels: ['web-console'],
        organizationIds: ['org_north'],
        departmentIds: ['dept_sales'],
      },
    });

    const authStore = useAuthStore();
    await authStore.loginWithPassword({
      login: 'director',
      password: 'director123',
      corpId: 'mock-corp',
    });

    expect(window.localStorage.length).toBe(0);
    expect(authStore.isAuthenticated).toBe(true);
  });

  it('已水合后再次 hydrateSession 时不应重复请求会话接口', async () => {
    vi.spyOn(authService, 'getCurrentSession').mockResolvedValue({
      authenticated: true,
      sessionId: 'auth_session_cached',
      source: 'password-login',
      expiresAt: '2026-04-03T10:00:00.000Z',
      user: {
        id: 'user_sales_director',
        name: '销售总监',
        roleNames: ['销售总监'],
        channels: ['web-console'],
        organizationIds: ['org_north'],
        departmentIds: ['dept_sales'],
      },
    });

    const authStore = useAuthStore();
    await authStore.hydrateSession();
    await authStore.hydrateSession();

    expect(authService.getCurrentSession).toHaveBeenCalledTimes(1);
    expect(analysisService.getCapabilities).toHaveBeenCalledTimes(1);
  });

  it('短时间内重复 loadCapabilities 时应复用能力快照', async () => {
    const authStore = useAuthStore();
    authStore.session = {
      authenticated: true,
      sessionId: 'auth_session_cached_capabilities',
      source: 'password-login',
      expiresAt: '2026-04-03T10:00:00.000Z',
      user: {
        id: 'user_sales_director',
        name: '销售总监',
        roleNames: ['销售总监'],
        channels: ['web-console'],
        organizationIds: ['org_north'],
        departmentIds: ['dept_sales'],
      },
    };

    await authStore.loadCapabilities();
    await authStore.loadCapabilities();

    expect(analysisService.getCapabilities).toHaveBeenCalledTimes(1);
  });
});

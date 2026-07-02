import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia } from 'pinia';
import router from '@/router';
import { pinia } from '@/stores/pinia';
import { useAuthStore } from '@/stores/auth.store';
import { authService } from '@/services/auth.service';
import { analysisService } from '@/services/analysis.service';

vi.mock('@/services/auth.service', () => ({
  authService: {
    getCurrentSession: vi.fn(),
  },
}));

vi.mock('@/services/analysis.service', () => ({
  analysisService: {
    getCapabilities: vi.fn(),
  },
}));

describe('router access guard', () => {
  beforeEach(async () => {
    setActivePinia(pinia);
    vi.restoreAllMocks();

    const authStore = useAuthStore(pinia);
    authStore.$reset();

    vi.mocked(authService.getCurrentSession).mockResolvedValue({
      authenticated: true,
      sessionId: 'auth_session_no_permission',
      source: 'password-login',
      expiresAt: '2026-05-09T15:37:02.521Z',
      user: {
        id: '2224755',
        name: '刘涛',
        roleNames: [],
        channels: ['web-console', 'wecom-bot'],
        organizationIds: ['10804'],
        departmentIds: [],
      },
    });

    vi.mocked(analysisService.getCapabilities).mockResolvedValue({
      serviceStatus: 'ONLINE',
      scopeSummary: '当前用户暂无可用菜单权限。',
      roleNames: [],
      channels: ['web-console', 'wecom-bot'],
      domains: [],
      metrics: [],
      dimensions: [],
      exportAllowed: false,
      exportRowLimit: 1000,
      exportDailyLimit: 3,
      remainingDailyExports: 3,
      historyEnabled: true,
      templateCount: 0,
      dataFreshnessAt: '2026-03-24T00:00:00.000Z',
      visibleMenus: [],
      actionKeys: [],
      followUpAllowed: false,
      templateViewAllowed: false,
      contractWorkspaceAllowed: false,
      wecomBotAccessState: 'ROLE_NOT_ENABLED',
      wecomBotAccessReason: '当前用户无权使用企业微信能力。',
      contractPermissions: {
        uploadAllowed: false,
        crossViewAllowed: false,
        crossDownloadAllowed: false,
      },
    });

    await router.replace('/');
  });

  it('已登录但无任何可用菜单时，应落到无权限页而不是重定向回旧分析页', async () => {
    await router.push('/analysis');

    expect(router.currentRoute.value.fullPath).toBe('/forbidden');
    expect(authService.getCurrentSession).toHaveBeenCalled();
    expect(analysisService.getCapabilities).toHaveBeenCalled();
  });

  it('门户代理参数存在时，权限守卫重定向应保留该参数', async () => {
    await router.push('/analysis?GratuitousProxy=mock');

    expect(router.currentRoute.value.fullPath).toBe('/forbidden?GratuitousProxy=mock');
  });

  it('进入核心 AI 配置页后重复访问不应每次强制刷新会话与能力快照', async () => {
    vi.mocked(authService.getCurrentSession).mockResolvedValue({
      authenticated: true,
      sessionId: 'auth_session_cached_navigation',
      source: 'password-login',
      expiresAt: '2026-05-09T15:37:02.521Z',
      user: {
        id: '2224755',
        name: '刘涛',
        roleNames: ['销售总监'],
        channels: ['web-console', 'wecom-bot'],
        organizationIds: ['10804'],
        departmentIds: ['dept_sales'],
      },
    });
    vi.mocked(analysisService.getCapabilities).mockResolvedValue({
      serviceStatus: 'ONLINE',
      scopeSummary: '当前用户可访问 AI 配置。',
      roleNames: ['销售总监'],
      channels: ['web-console', 'wecom-bot'],
      domains: ['opportunity-analysis'],
      metrics: ['新增商机金额'],
      dimensions: ['销售负责人'],
      exportAllowed: false,
      exportRowLimit: 1000,
      exportDailyLimit: 3,
      remainingDailyExports: 3,
      historyEnabled: true,
      templateCount: 1,
      dataFreshnessAt: '2026-03-24T00:00:00.000Z',
      visibleMenus: ['ai-model-governance'],
      actionKeys: ['ai_profile.manage'],
      followUpAllowed: false,
      templateViewAllowed: true,
      contractWorkspaceAllowed: false,
      wecomBotAccessState: 'ALLOWED',
      contractPermissions: {
        uploadAllowed: false,
        crossViewAllowed: false,
        crossDownloadAllowed: false,
      },
    });

    const authStore = useAuthStore(pinia);
    authStore.$reset();
    vi.mocked(authService.getCurrentSession).mockClear();
    vi.mocked(analysisService.getCapabilities).mockClear();

    await router.push('/governance/ai-models');
    await router.push('/governance/ai-models?tab=profiles');

    expect(router.currentRoute.value.fullPath).toBe('/governance/ai-models?tab=profiles');
    expect(authService.getCurrentSession).toHaveBeenCalledTimes(1);
    expect(analysisService.getCapabilities).toHaveBeenCalledTimes(1);
  });

  it('AI 配置入口必须同时具备核心菜单和管理动作', async () => {
    vi.mocked(analysisService.getCapabilities).mockResolvedValue({
      serviceStatus: 'ONLINE',
      scopeSummary: '当前用户只有 AI 配置菜单，但缺少管理动作。',
      roleNames: ['系统管理员'],
      channels: ['web-console'],
      domains: [],
      metrics: [],
      dimensions: [],
      exportAllowed: false,
      exportRowLimit: 1000,
      exportDailyLimit: 3,
      remainingDailyExports: 3,
      historyEnabled: true,
      templateCount: 0,
      dataFreshnessAt: '2026-03-24T00:00:00.000Z',
      visibleMenus: ['ai-model-governance'],
      actionKeys: [],
      followUpAllowed: false,
      templateViewAllowed: false,
      contractWorkspaceAllowed: false,
      wecomBotAccessState: 'ROLE_NOT_ENABLED',
      contractPermissions: {
        uploadAllowed: false,
        crossViewAllowed: false,
        crossDownloadAllowed: false,
      },
    });

    const authStore = useAuthStore(pinia);
    authStore.$reset();

    await router.push('/governance/ai-models');

    expect(router.currentRoute.value.fullPath).toBe('/forbidden');
  });

  it('历史治理地址应统一回到核心 AI 配置页', async () => {
    vi.mocked(analysisService.getCapabilities).mockResolvedValue({
      serviceStatus: 'ONLINE',
      scopeSummary: '当前用户可管理 AI 配置。',
      roleNames: ['系统管理员'],
      channels: ['web-console'],
      domains: [],
      metrics: [],
      dimensions: [],
      exportAllowed: false,
      exportRowLimit: 1000,
      exportDailyLimit: 3,
      remainingDailyExports: 3,
      historyEnabled: true,
      templateCount: 1,
      dataFreshnessAt: '2026-03-24T00:00:00.000Z',
      visibleMenus: ['ai-model-governance'],
      actionKeys: ['ai_profile.manage'],
      followUpAllowed: false,
      templateViewAllowed: false,
      contractWorkspaceAllowed: false,
      wecomBotAccessState: 'ROLE_NOT_ENABLED',
      contractPermissions: {
        uploadAllowed: false,
        crossViewAllowed: false,
        crossDownloadAllowed: false,
      },
    });

    const authStore = useAuthStore(pinia);
    authStore.$reset();

    await router.push('/governance/connections');

    expect(router.currentRoute.value.fullPath).toBe('/governance/ai-models');
  });

  it('历史查询模板地址应统一回到核心 AI 配置页', async () => {
    vi.mocked(analysisService.getCapabilities).mockResolvedValue({
      serviceStatus: 'ONLINE',
      scopeSummary: '当前用户可管理 AI 配置。',
      roleNames: ['系统管理员'],
      channels: ['web-console'],
      domains: [],
      metrics: [],
      dimensions: [],
      exportAllowed: false,
      exportRowLimit: 1000,
      exportDailyLimit: 3,
      remainingDailyExports: 3,
      historyEnabled: true,
      templateCount: 1,
      dataFreshnessAt: '2026-03-24T00:00:00.000Z',
      visibleMenus: ['ai-model-governance'],
      actionKeys: ['ai_profile.manage'],
      followUpAllowed: false,
      templateViewAllowed: true,
      contractWorkspaceAllowed: false,
      wecomBotAccessState: 'ROLE_NOT_ENABLED',
      contractPermissions: {
        uploadAllowed: false,
        crossViewAllowed: false,
        crossDownloadAllowed: false,
      },
    });

    const authStore = useAuthStore(pinia);
    authStore.$reset();

    await router.push('/governance/templates');

    expect(router.currentRoute.value.fullPath).toBe('/governance/ai-models');
  });
});

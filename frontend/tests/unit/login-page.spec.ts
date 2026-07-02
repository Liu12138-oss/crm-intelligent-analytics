import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import LoginPage from '@/pages/auth/LoginPage.vue';
import { useAuthStore } from '@/stores/auth.store';
import { authService } from '@/services/auth.service';

const replaceMock = vi.fn();
const wecomWidgetMock = vi.fn();
const originalUserAgent = window.navigator.userAgent;
const routeMock = {
  query: {} as Record<string, unknown>,
  hash: '',
};

vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: routeMock.query,
    hash: routeMock.hash,
  }),
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

async function flushAsyncUpdates(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await nextTick();
}

function mockUserAgent(userAgent: string): void {
  Object.defineProperty(window.navigator, 'userAgent', {
    value: userAgent,
    configurable: true,
  });
}

describe('login page', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    replaceMock.mockReset();
    wecomWidgetMock.mockReset();
    routeMock.query = {};
    routeMock.hash = '';
    mockUserAgent(originalUserAgent);

    document.head.innerHTML = '';
    const widgetScript = document.createElement('script');
    widgetScript.dataset.wecomLoginWidget = 'true';
    document.head.appendChild(widgetScript);

    (
      window as Window & {
        WwLogin?: new (options: Record<string, unknown>) => unknown;
      }
    ).WwLogin = wecomWidgetMock as unknown as new (
      options: Record<string, unknown>,
    ) => unknown;

    vi.spyOn(authService, 'startWecomLogin').mockResolvedValue({
      enabled: true,
      state: 'mock-state',
      authorizeUrl: 'http://127.0.0.1/mock-wecom-login',
      widget: {
        appId: 'ww-test-app',
        agentId: '1000001',
        redirectUri: 'http://127.0.0.1:3001/login',
        state: 'mock-state',
        scope: 'snsapi_privateinfo',
      },
    });
  });

  it('应将平台品牌固定为页面级入口并移除左侧说明区', () => {
    const wrapper = mount(LoginPage);

    expect(wrapper.get('img.login-page__brand-logo').attributes('alt')).toBe(
      'CRM 智能业务平台标志',
    );
    expect(wrapper.text()).toContain('CRM 智能业务平台');
    expect(wrapper.text()).toContain('统一客户经营入口');
    expect(wrapper.find('.login-page > .login-page__brand').exists()).toBe(true);
    expect(wrapper.find('.login-page__intro').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('问数 · 合同 · 审计');
    expect(wrapper.text()).not.toContain('自然语言查询');
    expect(wrapper.find('.login-page__hero').exists()).toBe(false);
    expect(wrapper.find('.login-page__brand-mark').exists()).toBe(true);
    expect(wrapper.find('.login-page__brand-subtitle').exists()).toBe(true);
  });

  it('账号密码模式应展示极简登录卡片并仅保留登录按钮', async () => {
    const wrapper = mount(LoginPage);

    expect(wrapper.text()).toContain('登录 CRM 智能业务平台');
    expect(wrapper.find('.login-card__mode-panel--password').exists()).toBe(true);
    expect(wrapper.find('.login-card__desc').exists()).toBe(false);
    expect(wrapper.get('button.login-card__support-trigger').text()).toBe('联系管理员');
    expect(wrapper.get('button.button-primary').text()).toBe('登录');
    expect(wrapper.find('.login-card__secondary').exists()).toBe(false);
    expect(wrapper.find('.login-card__foot').exists()).toBe(false);

    await wrapper.get('button.button-primary').trigger('click');

    expect(wrapper.text()).toContain('请输入账号和密码后再登录');
  });

  it('点击联系管理员后应展示两位管理员信息', async () => {
    const wrapper = mount(LoginPage);

    const trigger = wrapper.get('button.login-card__support-trigger');
    expect(trigger.attributes('aria-expanded')).toBe('false');
    expect(wrapper.find('.login-card__support--open').exists()).toBe(false);

    await trigger.trigger('click');

    const supportPanel = wrapper.get('.login-card__support-panel');
    expect(trigger.attributes('aria-expanded')).toBe('true');
    expect(wrapper.find('.login-card__support--open').exists()).toBe(true);
    expect(supportPanel.text()).toContain('王亮');
    expect(supportPanel.text()).toContain('19806510901');
    expect(supportPanel.text()).toContain('邱凤云');
    expect(supportPanel.text()).toContain('18503081052');
    expect(supportPanel.find('a[href^="tel:"]').exists()).toBe(false);

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();
    expect(trigger.attributes('aria-expanded')).toBe('false');
    expect(wrapper.find('.login-card__support--open').exists()).toBe(false);
  });

  it('切换企业微信标签时应刷新二维码并展示新的扫码说明', async () => {
    const wrapper = mount(LoginPage);

    await wrapper.findAll('button.login-card__tab')[1].trigger('click');
    await flushAsyncUpdates();

    expect(authService.startWecomLogin).toHaveBeenCalledTimes(1);
    expect(wecomWidgetMock).toHaveBeenCalledTimes(1);
    expect(wrapper.find('#wecom-login-widget').exists()).toBe(true);
    expect(wrapper.find('.login-card__mode-panel--wecom').exists()).toBe(true);
    expect(wrapper.text()).toContain('请使用已绑定 CRM 的企业微信扫码');
    expect(wrapper.find('.login-card__qrcode-hint').exists()).toBe(true);
    expect(wrapper.find('.login-card__support').exists()).toBe(false);
    expect(wrapper.find('.login-card__primary').exists()).toBe(false);
    expect(wrapper.find('.login-card__secondary').exists()).toBe(false);
    expect(wrapper.find('.login-card__foot').exists()).toBe(false);

    await wrapper.findAll('button.login-card__tab')[0].trigger('click');
    await wrapper.findAll('button.login-card__tab')[1].trigger('click');
    await flushAsyncUpdates();

    expect(authService.startWecomLogin).toHaveBeenCalledTimes(2);
    expect(wecomWidgetMock).toHaveBeenCalledTimes(2);
  });

  it('Safari 浏览器下应避开企业微信内嵌二维码跨域顶层跳转', async () => {
    mockUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
    );
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      const wrapper = mount(LoginPage);

      await wrapper.findAll('button.login-card__tab')[1].trigger('click');
      await flushAsyncUpdates();

      expect(authService.startWecomLogin).toHaveBeenCalledTimes(1);
      expect(wecomWidgetMock).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('企业微信配置加载失败时不应闪到企业微信面板', async () => {
    vi.spyOn(authService, 'startWecomLogin').mockRejectedValue(
      new Error('企业微信登录发起失败，请稍后重试。'),
    );

    const wrapper = mount(LoginPage);

    await wrapper.findAll('button.login-card__tab')[1].trigger('click');
    await flushAsyncUpdates();

    expect(wrapper.find('.login-card__mode-panel--password').exists()).toBe(true);
    expect(wrapper.find('.login-card__mode-panel--wecom').exists()).toBe(false);
  });

  it('账号密码登录成功后应跳转到分析页', async () => {
    const wrapper = mount(LoginPage);
    const authStore = useAuthStore();
    vi.spyOn(authStore, 'loginWithPassword').mockResolvedValue({
      authenticated: true,
      sessionId: 'auth_session_001',
      source: 'password-login',
      expiresAt: '2026-03-26T10:00:00.000Z',
      user: {
        id: 'user_sales_director',
        name: '销售总监',
        roleNames: ['销售总监'],
        channels: ['web-console'],
        organizationIds: ['org_north'],
        departmentIds: ['dept_sales'],
      },
    });

    await wrapper.get('input[placeholder="请输入 CRM 账号或手机号"]').setValue('director');
    await wrapper.get('input[placeholder="请输入登录密码"]').setValue('director123');
    await wrapper.get('button.button-primary').trigger('click');

    expect(authStore.loginWithPassword).toHaveBeenCalled();
    expect(replaceMock).toHaveBeenCalledWith('/governance/ai-models');
  });

  it('密码输入框按 Enter 键应触发账号密码登录', async () => {
    const wrapper = mount(LoginPage);
    const authStore = useAuthStore();
    vi.spyOn(authStore, 'loginWithPassword').mockResolvedValue({
      authenticated: true,
      sessionId: 'auth_session_001',
      source: 'password-login',
      expiresAt: '2026-03-26T10:00:00.000Z',
      user: {
        id: 'user_sales_director',
        name: '销售总监',
        roleNames: ['销售总监'],
        channels: ['web-console'],
        organizationIds: ['org_north'],
        departmentIds: ['dept_sales'],
      },
    });

    await wrapper.get('input[placeholder="请输入 CRM 账号或手机号"]').setValue('director');
    const passwordInput = wrapper.get('input[placeholder="请输入登录密码"]');
    await passwordInput.setValue('director123');
    await passwordInput.trigger('keyup.enter');

    expect(authStore.loginWithPassword).toHaveBeenCalledWith({
      login: 'director',
      password: 'director123',
      wecomBindToken: undefined,
    });
    expect(replaceMock).toHaveBeenCalledWith('/governance/ai-models');
  });

  it('账号密码登录成功后应保留门户代理参数再跳转', async () => {
    routeMock.query = {
      redirect: '/governance/ai-models',
      GratuitousProxy: 'mock',
    };
    const wrapper = mount(LoginPage);
    const authStore = useAuthStore();
    vi.spyOn(authStore, 'loginWithPassword').mockResolvedValue({
      authenticated: true,
      sessionId: 'auth_session_001',
      source: 'password-login',
      expiresAt: '2026-03-26T10:00:00.000Z',
      user: {
        id: 'user_sales_director',
        name: '销售总监',
        roleNames: ['销售总监'],
        channels: ['web-console'],
        organizationIds: ['org_north'],
        departmentIds: ['dept_sales'],
      },
    });

    await wrapper.get('input[placeholder="请输入 CRM 账号或手机号"]').setValue('director');
    await wrapper.get('input[placeholder="请输入登录密码"]').setValue('director123');
    await wrapper.get('button.button-primary').trigger('click');

    expect(replaceMock).toHaveBeenCalledWith({
      path: '/governance/ai-models',
      query: {
        GratuitousProxy: 'mock',
      },
    });
  });

  it('账号密码登录请求进行中应展示按钮加载状态', async () => {
    const wrapper = mount(LoginPage);
    let resolveLogin!: (value: Awaited<ReturnType<typeof authService.login>>) => void;
    vi.spyOn(authService, 'login').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        }),
    );

    await wrapper.get('input[placeholder="请输入 CRM 账号或手机号"]').setValue('director');
    await wrapper.get('input[placeholder="请输入登录密码"]').setValue('director123');
    await wrapper.get('button.login-card__primary').trigger('click');
    await nextTick();

    const submitButton = wrapper.get('button.login-card__primary');
    expect(submitButton.text()).toContain('登录中...');
    expect(submitButton.attributes('aria-busy')).toBe('true');
    expect(submitButton.attributes('disabled')).toBeDefined();

    resolveLogin({
      authenticated: true,
      sessionId: 'auth_session_001',
      source: 'password-login',
      expiresAt: '2026-03-26T10:00:00.000Z',
      user: {
        id: 'user_sales_director',
        name: '销售总监',
        roleNames: ['销售总监'],
        channels: ['web-console'],
        organizationIds: ['org_north'],
        departmentIds: ['dept_sales'],
      },
    });
    await flushAsyncUpdates();
  });

  it('企业微信扫码回流后应展示登录中提示，并自动发起换票登录', async () => {
    routeMock.query = {
      code: 'mock-wecom-code',
      state: 'mock-wecom-state',
    };

    const authStore = useAuthStore();
    let resolveLogin!: (value: Awaited<ReturnType<typeof authService.exchangeWecomCode>>) => void;
    vi.spyOn(authStore, 'loginWithWecomCode').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        }),
    );

    const wrapper = mount(LoginPage);
    await nextTick();

    expect(authStore.loginWithWecomCode).toHaveBeenCalledWith({
      code: 'mock-wecom-code',
      state: 'mock-wecom-state',
    });
    expect(wrapper.text()).toContain('正在完成企业微信登录');
    expect(wrapper.text()).toContain('请保持当前页面');

    resolveLogin({
      authenticated: true,
      sessionId: 'auth_session_wecom_001',
      source: 'wecom-scan',
      expiresAt: '2026-03-26T10:00:00.000Z',
      user: {
        id: 'user_sales_director',
        name: '销售总监',
        roleNames: ['销售总监'],
        channels: ['web-console'],
        organizationIds: ['org_north'],
        departmentIds: ['dept_sales'],
      },
    });
    await flushAsyncUpdates();
  });

  it('企业微信扫码回流参数在 hash 中时也应自动换票登录', async () => {
    routeMock.hash = '#wecom-login?code=mock-wecom-code&state=mock-wecom-state';

    const authStore = useAuthStore();
    vi.spyOn(authStore, 'loginWithWecomCode').mockImplementation(
      () => new Promise(() => {}),
    );

    const wrapper = mount(LoginPage);
    await flushAsyncUpdates();

    expect(authStore.loginWithWecomCode).toHaveBeenCalledWith({
      code: 'mock-wecom-code',
      state: 'mock-wecom-state',
    });
    expect(wrapper.text()).toContain('正在完成企业微信登录');
  });

  it('企业微信扫码回流首屏不应先闪现账号密码表单', () => {
    routeMock.query = {
      code: 'mock-wecom-code',
      state: 'mock-wecom-state',
    };

    const authStore = useAuthStore();
    vi.spyOn(authStore, 'loginWithWecomCode').mockImplementation(
      async () =>
        ({
          authenticated: true,
          sessionId: 'auth_session_wecom_001',
          source: 'wecom-scan',
          expiresAt: '2026-03-26T10:00:00.000Z',
          user: {
            id: 'user_sales_director',
            name: '销售总监',
            roleNames: ['销售总监'],
            channels: ['web-console'],
            organizationIds: ['org_north'],
            departmentIds: ['dept_sales'],
          },
        }) as Awaited<ReturnType<typeof authService.exchangeWecomCode>>,
    );

    const wrapper = mount(LoginPage);

    expect(wrapper.text()).toContain('正在完成企业微信登录');
    expect(wrapper.find('.login-card__mode-panel--password').exists()).toBe(
      false,
    );
  });

  it('企业微信扫码回流失败后应展示明确提示，并允许用户重新扫码', async () => {
    routeMock.query = {
      code: 'mock-wecom-code',
      state: 'mock-wecom-state',
    };

    const authStore = useAuthStore();
    vi.spyOn(authStore, 'loginWithWecomCode').mockRejectedValue(
      new Error('企业微信登录换票失败，请稍后重试。'),
    );

    const wrapper = mount(LoginPage);
    await flushAsyncUpdates();

    expect(wrapper.text()).toContain('企业微信登录换票失败，请稍后重试。');
    expect(wrapper.text()).toContain('企业微信登录');
  });

  it('企业微信 IP 白名单错误不应在账号登录页展示原始报错', () => {
    routeMock.query = {
      authError: encodeURIComponent(
        'not allow to access from your ip, hint: [1777424699445593820321132], from ip: 61.141.64.212, more info at https://open.work.weixin.qq.com/devtool/query?e=60020',
      ),
    };

    const wrapper = mount(LoginPage);

    expect(wrapper.find('.login-card__feedback').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('not allow to access from your ip');
    expect(wrapper.find('.login-card__mode-panel--password').exists()).toBe(true);
  });
});

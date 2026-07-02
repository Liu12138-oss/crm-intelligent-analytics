import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import WecomLoginCallbackPage from '@/pages/auth/WecomLoginCallbackPage.vue';
import { useAuthStore } from '@/stores/auth.store';

const replaceMock = vi.fn();
const routeMock = {
  query: {} as Record<string, unknown>,
};

vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: routeMock.query,
  }),
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

describe('wecom login callback page', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    replaceMock.mockReset();
    routeMock.query = {
      code: 'mock-wecom-code',
      state: 'mock-wecom-state',
    };
  });

  it('应首屏展示企业微信登录中的加载态，并立即发起换票', async () => {
    const authStore = useAuthStore();
    vi.spyOn(authStore, 'loginWithWecomCode').mockResolvedValue({
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

    const wrapper = mount(WecomLoginCallbackPage);

    expect(wrapper.text()).toContain('正在完成企业微信登录');
    expect(wrapper.text()).toContain('系统正在校验扫码结果并建立登录会话');
    expect(authStore.loginWithWecomCode).toHaveBeenCalledWith({
      code: 'mock-wecom-code',
      state: 'mock-wecom-state',
    });
  });

  it('企业微信 IP 白名单错误回流时不应把原始报错继续挂到登录页', async () => {
    const authStore = useAuthStore();
    vi.spyOn(authStore, 'loginWithWecomCode').mockRejectedValue(
      new Error(
        'not allow to access from your ip, hint: [1777424699445593820321132], from ip: 61.141.64.212, more info at https://open.work.weixin.qq.com/devtool/query?e=60020',
      ),
    );

    mount(WecomLoginCallbackPage);
    await Promise.resolve();
    await Promise.resolve();

    expect(replaceMock).toHaveBeenCalledWith({
      name: 'login',
      query: {
        redirect: '/governance/ai-models',
      },
    });
  });
});

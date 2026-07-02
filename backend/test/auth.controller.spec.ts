import type { Response } from 'express';
import { AuthController } from '../src/modules/auth/auth.controller';

describe('AuthController 企业微信回调跳转', () => {
  const originalAllowedBaseUrls = process.env.APP_WEB_ALLOWED_BASE_URLS;
  const originalSharedCookieDomain = process.env.APP_WEB_SHARED_COOKIE_DOMAIN;

  beforeEach(() => {
    delete process.env.APP_WEB_ALLOWED_BASE_URLS;
    delete process.env.APP_WEB_SHARED_COOKIE_DOMAIN;
  });

  afterAll(() => {
    if (typeof originalAllowedBaseUrls === 'string') {
      process.env.APP_WEB_ALLOWED_BASE_URLS = originalAllowedBaseUrls;
    } else {
      delete process.env.APP_WEB_ALLOWED_BASE_URLS;
    }

    if (typeof originalSharedCookieDomain === 'string') {
      process.env.APP_WEB_SHARED_COOKIE_DOMAIN = originalSharedCookieDomain;
    } else {
      delete process.env.APP_WEB_SHARED_COOKIE_DOMAIN;
    }
  });

  it('门户域名发起扫码时，应记录包含门户代理参数的完整回跳地址', () => {
    const response = {
      cookie: jest.fn(),
    } as unknown as Response;
    const beginLogin = jest.fn(() => ({
      state: 'wecom-state-portal',
      enabled: true,
    }));
    const controller = new AuthController(
      {} as never,
      {
        beginLogin,
      } as never,
      {
        getWecomRuntimeConfig: () => ({
          webBaseUrl: 'http://10.10.3.241/insight',
        }),
      } as never,
    );

    controller.getWecomLoginInitiate(
      undefined,
      {
        headers: {
          referer:
            'https://portal.leagsoft.com/insight/login?GratuitousProxy=mock',
        },
      } as never,
      response,
    );

    expect(beginLogin).toHaveBeenCalledWith({
      webBaseUrl: 'https://portal.leagsoft.com/insight',
      returnUrl:
        'https://portal.leagsoft.com/insight/login?GratuitousProxy=mock',
    });
  });

  it('门户代理改写 Referer 为 IP 时，应允许白名单内的门户 Web 基址', () => {
    process.env.APP_WEB_ALLOWED_BASE_URLS =
      'http://10.10.3.241/insight,https://portal.leagsoft.com/insight';
    const response = {
      cookie: jest.fn(),
    } as unknown as Response;
    const beginLogin = jest.fn(() => ({
      state: 'wecom-state-portal',
      enabled: true,
    }));
    const controller = new AuthController(
      {} as never,
      {
        beginLogin,
      } as never,
      {
        getWecomRuntimeConfig: () => ({
          webBaseUrl: 'http://10.10.3.241/insight',
        }),
      } as never,
    );

    controller.getWecomLoginInitiate(
      'https://portal.leagsoft.com/insight',
      {
        headers: {
          referer: 'http://10.10.3.241/insight/login',
        },
      } as never,
      response,
    );

    expect(beginLogin).toHaveBeenCalledWith({
      webBaseUrl: 'https://portal.leagsoft.com/insight',
    });
  });

  it('门户代理彻底隐藏门户 URL 时，应把内网 IP 入口和完整回跳地址升级为共享 Cookie 门户地址', () => {
    process.env.APP_WEB_ALLOWED_BASE_URLS =
      'http://10.10.3.241/insight,https://portal.leagsoft.com/insight';
    process.env.APP_WEB_SHARED_COOKIE_DOMAIN = '.leagsoft.com';
    const response = {
      cookie: jest.fn(),
    } as unknown as Response;
    const beginLogin = jest.fn(() => ({
      state: 'wecom-state-portal',
      enabled: true,
    }));
    const controller = new AuthController(
      {} as never,
      {
        beginLogin,
      } as never,
      {
        getWecomRuntimeConfig: () => ({
          webBaseUrl: 'http://10.10.3.241/insight',
        }),
      } as never,
    );

    controller.getWecomLoginInitiate(
      'https://10.10.3.241:80/insight',
      {
        headers: {
          referer: 'http://10.10.3.241/insight/login?redirect=/analysis',
        },
      } as never,
      response,
      'https://10.10.3.241:80/insight/login?redirect=/analysis&GratuitousProxy=mock',
    );

    expect(beginLogin).toHaveBeenCalledWith({
      webBaseUrl: 'https://portal.leagsoft.com/insight',
      returnUrl:
        'https://portal.leagsoft.com/insight/login?redirect=/analysis&GratuitousProxy=mock',
    });
  });

  it('跨域代理只传 Referer origin 时，应接受前端显式传入的 Web 基址', () => {
    const response = {
      cookie: jest.fn(),
    } as unknown as Response;
    const beginLogin = jest.fn(() => ({
      state: 'wecom-state-portal',
      enabled: true,
    }));
    const controller = new AuthController(
      {} as never,
      {
        beginLogin,
      } as never,
      {
        getWecomRuntimeConfig: () => ({
          webBaseUrl: 'http://10.10.3.241/insight',
        }),
      } as never,
    );

    controller.getWecomLoginInitiate(
      'https://portal.leagsoft.com/insight',
      {
        headers: {
          referer: 'https://portal.leagsoft.com/',
        },
      } as never,
      response,
    );

    expect(beginLogin).toHaveBeenCalledWith({
      webBaseUrl: 'https://portal.leagsoft.com/insight',
    });
  });

  it('显式 Web 基址与请求来源不同源时，不应记录为回跳地址', () => {
    const response = {
      cookie: jest.fn(),
    } as unknown as Response;
    const beginLogin = jest.fn(() => ({
      state: 'wecom-state-portal',
      enabled: true,
    }));
    const controller = new AuthController(
      {} as never,
      {
        beginLogin,
      } as never,
      {
        getWecomRuntimeConfig: () => ({
          webBaseUrl: 'http://10.10.3.241/insight',
        }),
      } as never,
    );

    controller.getWecomLoginInitiate(
      'https://evil.example.com/insight',
      {
        headers: {
          referer: 'https://portal.leagsoft.com/',
        },
      } as never,
      response,
    );

    expect(beginLogin).toHaveBeenCalledWith({
      webBaseUrl: undefined,
    });
  });

  it('企业微信回调携带已记录的 state 时，应优先回跳到发起扫码的门户域名', async () => {
    const response = {
      redirect: jest.fn(),
    } as unknown as Response;
    const controller = new AuthController(
      {} as never,
      {
        consumeLoginReturnBaseUrl: jest.fn(() => 'https://portal.leagsoft.com/insight'),
      } as never,
      {
        getWecomRuntimeConfig: () => ({
          webBaseUrl: 'http://10.10.3.241/insight',
        }),
      } as never,
    );

    await controller.handleWecomLoginCallback(
      'wecom-state-portal',
      undefined,
      'wecom-code-001',
      undefined,
      response,
    );

    expect(response.redirect).toHaveBeenCalledWith(
      'https://portal.leagsoft.com/insight/login?redirect=/analysis#wecom-login?state=wecom-state-portal&code=wecom-code-001',
    );
  });

  it('门户回调可共享 Cookie 时，应由后端直接完成扫码登录并跳回登录前业务页', async () => {
    process.env.APP_WEB_SHARED_COOKIE_DOMAIN = '.leagsoft.com';
    const response = {
      cookie: jest.fn(),
      redirect: jest.fn(),
    } as unknown as Response;
    const controller = new AuthController(
      {
        createSessionForUser: jest.fn(() => ({
          id: 'auth-session-wecom-001',
        })),
        getSessionTtlMs: jest.fn(() => 3600000),
      } as never,
      {
        consumeLoginReturnTarget: jest.fn(() => ({
          webBaseUrl: 'https://portal.leagsoft.com/insight',
          returnUrl:
            'https://portal.leagsoft.com/insight/login?redirect=/analysis&GratuitousProxy=mock',
        })),
        resolveCallbackUser: jest.fn(async () => ({
          kind: 'user',
          user: { id: 'user_sales_director' },
        })),
      } as never,
      {
        getWecomRuntimeConfig: () => ({
          webBaseUrl: 'http://10.10.3.241/insight',
        }),
      } as never,
    );

    await controller.handleWecomLoginCallback(
      'wecom-state-portal',
      undefined,
      'wecom-code-001',
      undefined,
      response,
    );

    expect(response.cookie).toHaveBeenCalledWith(
      'crm_auth_session',
      'auth-session-wecom-001',
      expect.objectContaining({
        domain: '.leagsoft.com',
        secure: true,
      }),
    );
    expect(response.redirect).toHaveBeenCalledWith(
      'https://portal.leagsoft.com/insight/analysis?GratuitousProxy=mock&login=wecom',
    );
  });

  it('门户回调可共享 Cookie 但缺少门户代理参数时，应回退到扫码前页面避免门户 302', async () => {
    process.env.APP_WEB_SHARED_COOKIE_DOMAIN = '.leagsoft.com';
    const response = {
      cookie: jest.fn(),
      redirect: jest.fn(),
      send: jest.fn(),
      type: jest.fn(),
    } as unknown as Response;
    const controller = new AuthController(
      {
        createSessionForUser: jest.fn(() => ({
          id: 'auth-session-wecom-002',
        })),
        getSessionTtlMs: jest.fn(() => 3600000),
      } as never,
      {
        consumeLoginReturnTarget: jest.fn(() => ({
          webBaseUrl: 'https://portal.leagsoft.com/insight',
          returnUrl: 'https://portal.leagsoft.com/insight/login',
        })),
        resolveCallbackUser: jest.fn(async () => ({
          kind: 'user',
          user: { id: 'user_sales_director' },
        })),
      } as never,
      {
        getWecomRuntimeConfig: () => ({
          webBaseUrl: 'http://10.10.3.241/insight',
        }),
      } as never,
    );

    await controller.handleWecomLoginCallback(
      'wecom-state-portal',
      undefined,
      'wecom-code-001',
      undefined,
      response,
    );

    expect(response.redirect).not.toHaveBeenCalled();
    expect(response.type).toHaveBeenCalledWith('html');
    expect(response.send).toHaveBeenCalledWith(
      expect.stringContaining('window.history.back()'),
    );
    expect(response.send).toHaveBeenCalledWith(
      expect.stringContaining(
        'https://portal.leagsoft.com/insight/analysis?login=wecom',
      ),
    );
  });

  it('门户回调可共享 Cookie 且代理参数只在 redirect 内时，应继续带回业务页', async () => {
    process.env.APP_WEB_SHARED_COOKIE_DOMAIN = '.leagsoft.com';
    const response = {
      cookie: jest.fn(),
      redirect: jest.fn(),
    } as unknown as Response;
    const controller = new AuthController(
      {
        createSessionForUser: jest.fn(() => ({
          id: 'auth-session-wecom-003',
        })),
        getSessionTtlMs: jest.fn(() => 3600000),
      } as never,
      {
        consumeLoginReturnTarget: jest.fn(() => ({
          webBaseUrl: 'https://portal.leagsoft.com/insight',
          returnUrl:
            'https://portal.leagsoft.com/insight/login?redirect=%2Fmanagement-report%3FGratuitousProxy%3Dmock',
        })),
        resolveCallbackUser: jest.fn(async () => ({
          kind: 'user',
          user: { id: 'user_sales_director' },
        })),
      } as never,
      {
        getWecomRuntimeConfig: () => ({
          webBaseUrl: 'http://10.10.3.241/insight',
        }),
      } as never,
    );

    await controller.handleWecomLoginCallback(
      'wecom-state-portal',
      undefined,
      'wecom-code-001',
      undefined,
      response,
    );

    expect(response.redirect).toHaveBeenCalledWith(
      'https://portal.leagsoft.com/insight/management-report?GratuitousProxy=mock&login=wecom',
    );
  });

  it('Web 地址带前缀时，应回跳到带前缀的登录页', async () => {
    const response = {
      redirect: jest.fn(),
    } as unknown as Response;
    const controller = new AuthController(
      {} as never,
      {
        consumeLoginReturnBaseUrl: jest.fn(() => undefined),
      } as never,
      {
        getWecomRuntimeConfig: () => ({
          webBaseUrl: 'http://10.10.3.241/insight',
        }),
      } as never,
    );

    await controller.handleWecomLoginCallback(
      'wecom-state-001',
      undefined,
      'wecom-code-001',
      undefined,
      response,
    );

    expect(response.redirect).toHaveBeenCalledWith(
      'http://10.10.3.241/insight/login?redirect=/analysis#wecom-login?state=wecom-state-001&code=wecom-code-001',
    );
  });
});

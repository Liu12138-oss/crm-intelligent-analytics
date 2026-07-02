import { describe, expect, it } from 'vitest';
import {
  buildWecomLoginInitiatePath,
  resolveCurrentWebBaseUrl,
  resolveCurrentWecomReturnUrl,
} from '@/services/auth.service';
import { resolveApiBaseUrl } from '@/services/http-client';

describe('http client api base url', () => {
  it('本机回环地址打开开发页面时，应优先回退到当前站点同源代理', () => {
    expect(
      resolveApiBaseUrl({
        configuredBaseUrl: 'http://10.20.13.53:3000',
        currentOrigin: 'http://127.0.0.1:5173',
        isProduction: false,
      }),
    ).toBe('http://127.0.0.1:5173');
  });

  it('开发环境通过局域网入口访问时，也应优先回退到当前站点同源代理', () => {
    expect(
      resolveApiBaseUrl({
        configuredBaseUrl: 'http://10.20.13.53:3000',
        currentOrigin: 'http://10.10.3.241',
        isProduction: false,
      }),
    ).toBe('http://10.10.3.241');
  });

  it('生产环境遇到跨域开发地址时应回退到当前站点同源', () => {
    expect(
      resolveApiBaseUrl({
        configuredBaseUrl: 'http://10.20.13.53:3000',
        currentOrigin: 'http://10.10.3.241',
        isProduction: true,
      }),
    ).toBe('http://10.10.3.241');
  });

  it('生产环境未配置显式地址时应默认使用当前站点同源', () => {
    expect(
      resolveApiBaseUrl({
        configuredBaseUrl: '',
        currentOrigin: 'http://10.10.3.241',
        isProduction: true,
      }),
    ).toBe('http://10.10.3.241');
  });

  it('生产环境显式地址与当前站点同源且带有页面前缀时，应保留该前缀作为 API 根地址', () => {
    expect(
      resolveApiBaseUrl({
        configuredBaseUrl: 'http://10.10.3.241/insight/',
        currentOrigin: 'http://10.10.3.241',
        isProduction: true,
      }),
    ).toBe('http://10.10.3.241/insight');
  });

  it('生产环境通过门户域名访问时，应复用当前域名并保留构建配置中的应用前缀', () => {
    expect(
      resolveApiBaseUrl({
        configuredBaseUrl: 'http://10.10.3.241/insight/',
        currentOrigin: 'https://portal.leagsoft.com',
        isProduction: true,
      }),
    ).toBe('https://portal.leagsoft.com/insight');
  });
});

describe('auth service current web base url', () => {
  it('应按当前门户域名和 Vite 基路径生成扫码回跳基址', () => {
    expect(
      resolveCurrentWebBaseUrl({
        currentOrigin: 'https://portal.leagsoft.com',
        appBasePath: '/insight/',
      }),
    ).toBe('https://portal.leagsoft.com/insight');
  });

  it('IP 入口访问时应保留当前 IP origin', () => {
    expect(
      resolveCurrentWebBaseUrl({
        currentOrigin: 'http://10.10.3.241',
        appBasePath: '/insight/',
      }),
    ).toBe('http://10.10.3.241/insight');
  });

  it('门户入口带代理参数时，扫码回跳地址应保留当前完整页面地址', () => {
    expect(
      resolveCurrentWecomReturnUrl({
        currentHref:
          'https://portal.leagsoft.com/insight/login?redirect=/analysis&GratuitousProxy=mock',
        currentOrigin: 'https://portal.leagsoft.com',
        appBasePath: '/insight/',
      }),
    ).toBe(
      'https://portal.leagsoft.com/insight/login?redirect=/analysis&GratuitousProxy=mock',
    );
  });

  it('应用运行在代理内层 IP 地址时，应优先使用顶层浏览器门户地址', () => {
    expect(
      resolveCurrentWebBaseUrl({
        currentOrigin: 'https://10.10.3.241:80',
        currentHref: 'https://10.10.3.241:80/insight/login?redirect=/analysis',
        topHref:
          'https://portal.leagsoft.com/insight/login?redirect=/analysis&GratuitousProxy=mock',
        appBasePath: '/insight/',
      }),
    ).toBe('https://portal.leagsoft.com/insight');

    expect(
      resolveCurrentWecomReturnUrl({
        currentOrigin: 'https://10.10.3.241:80',
        currentHref: 'https://10.10.3.241:80/insight/login?redirect=/analysis',
        topHref:
          'https://portal.leagsoft.com/insight/login?redirect=/analysis&GratuitousProxy=mock',
        appBasePath: '/insight/',
      }),
    ).toBe(
      'https://portal.leagsoft.com/insight/login?redirect=/analysis&GratuitousProxy=mock',
    );
  });

  it('当前地址不在应用基路径下时，不应作为扫码回跳地址', () => {
    expect(
      resolveCurrentWecomReturnUrl({
        currentHref: 'https://portal.leagsoft.com/other/login?GratuitousProxy=mock',
        currentOrigin: 'https://portal.leagsoft.com',
        appBasePath: '/insight/',
      }),
    ).toBeUndefined();
  });

  it('扫码初始化接口应同时提交 Web 基址和完整门户回跳地址', () => {
    expect(
      buildWecomLoginInitiatePath({
        currentHref:
          'https://portal.leagsoft.com/insight/login?redirect=/analysis&GratuitousProxy=mock',
        currentOrigin: 'https://portal.leagsoft.com',
        appBasePath: '/insight/',
      }),
    ).toBe(
      '/auth/wecom/initiate?webBaseUrl=https%3A%2F%2Fportal.leagsoft.com%2Finsight&returnUrl=https%3A%2F%2Fportal.leagsoft.com%2Finsight%2Flogin%3Fredirect%3D%2Fanalysis%26GratuitousProxy%3Dmock',
    );
  });

  it('扫码初始化接口应优先提交顶层浏览器门户地址', () => {
    expect(
      buildWecomLoginInitiatePath({
        currentOrigin: 'https://10.10.3.241:80',
        currentHref: 'https://10.10.3.241:80/insight/login?redirect=/analysis',
        topHref:
          'https://portal.leagsoft.com/insight/login?redirect=/analysis&GratuitousProxy=mock',
        appBasePath: '/insight/',
      }),
    ).toBe(
      '/auth/wecom/initiate?webBaseUrl=https%3A%2F%2Fportal.leagsoft.com%2Finsight&returnUrl=https%3A%2F%2Fportal.leagsoft.com%2Finsight%2Flogin%3Fredirect%3D%2Fanalysis%26GratuitousProxy%3Dmock',
    );
  });

  it('只能读取 iframe 祖先 origin 时，应用当前路径合成门户扫码地址', () => {
    expect(
      buildWecomLoginInitiatePath({
        currentOrigin: 'https://10.10.3.241:80',
        currentHref:
          'https://10.10.3.241:80/insight/login?redirect=/analysis&GratuitousProxy=mock',
        ancestorOrigins: ['https://portal.leagsoft.com'],
        appBasePath: '/insight/',
      }),
    ).toBe(
      '/auth/wecom/initiate?webBaseUrl=https%3A%2F%2Fportal.leagsoft.com%2Finsight&returnUrl=https%3A%2F%2Fportal.leagsoft.com%2Finsight%2Flogin%3Fredirect%3D%2Fanalysis%26GratuitousProxy%3Dmock',
    );
  });
});

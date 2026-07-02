import { EventEmitter } from 'node:events';
import { promises as dns } from 'node:dns';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AnalysisLoggerService } from '../../../src/shared/logging/analysis-logger.service';
import { LocalRuntimeConfigService } from '../../../src/shared/config/local-runtime-config.service';
import {
  requestWecomJsonThroughNodeHttp,
  WecomWebLoginService,
} from '../../../src/modules/auth/wecom-web-login.service';

class MockHttpIncomingMessage extends EventEmitter {
  statusCode: number;

  constructor(statusCode: number) {
    super();
    this.statusCode = statusCode;
  }
}

class MockHttpClientRequest extends EventEmitter {
  constructor(private readonly onEnd: () => void) {
    super();
  }

  setTimeout(): this {
    return this;
  }

  write(): void {
    // 该测试桩只验证请求选项，不关心请求体内容。
  }

  end(): void {
    this.onEnd();
  }

  destroy(error?: Error): void {
    if (error) {
      this.emit('error', error);
    }
  }
}

describe('WecomWebLoginService', () => {
  const loggerService = {
    logStep: jest.fn(),
    logWarn: jest.fn(),
  };
  const trackedEnvKeys = [
    'WECOM_WEB_LOGIN_APP_ID',
    'WECOM_WEB_LOGIN_AGENT_ID',
    'WECOM_WEB_LOGIN_SECRET',
    'WECOM_WEB_LOGIN_CALLBACK_URL',
    'WECOM_QYAPI_BASE_URL',
    'APP_WEB_BASE_URL',
  ] as const;

  let originalCwd: string;
  let originalEnv: Record<string, string | undefined>;
  let tempRepoRoot: string;
  let originalFetch: typeof global.fetch | undefined;
  let mockServer: Server | undefined;

  beforeEach(() => {
    originalCwd = process.cwd();
    originalEnv = Object.fromEntries(
      trackedEnvKeys.map((key) => [key, process.env[key]]),
    );
    originalFetch = global.fetch;
    loggerService.logStep.mockReset();
    loggerService.logWarn.mockReset();
    tempRepoRoot = mkdtempSync(join(tmpdir(), 'crm-wecom-login-'));

    mkdirSync(join(tempRepoRoot, 'specs'), { recursive: true });
    mkdirSync(join(tempRepoRoot, 'backend'), { recursive: true });

    for (const key of trackedEnvKeys) {
      delete process.env[key];
    }

    process.chdir(tempRepoRoot);
  });

  afterEach(() => {
    process.chdir(originalCwd);

    if (mockServer) {
      mockServer.close();
      mockServer = undefined;
    }

    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      delete (global as Partial<typeof global>).fetch;
    }

    for (const key of trackedEnvKeys) {
      const value = originalEnv[key];
      if (typeof value === 'string') {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    }

    rmSync(tempRepoRoot, { recursive: true, force: true });
  });

  it('应优先使用显式配置的扫码回调地址作为企业微信 redirect_uri', () => {
    process.env.WECOM_WEB_LOGIN_APP_ID = 'wwcorp-test';
    process.env.WECOM_WEB_LOGIN_AGENT_ID = '1000001';
    process.env.WECOM_WEB_LOGIN_SECRET = 'mock-secret';
    process.env.WECOM_WEB_LOGIN_CALLBACK_URL =
      'https://insight.leagsoft.com:34567/api/v1/auth/wecom/callback';
    process.env.APP_WEB_BASE_URL = 'http://10.10.3.241';

    const service = new WecomWebLoginService(
      new LocalRuntimeConfigService(),
      {} as never,
      {
        logStep: jest.fn(),
        logWarn: jest.fn(),
      } as unknown as AnalysisLoggerService,
      {} as never,
    );

    const loginRequest = service.beginLogin() as {
      enabled: boolean;
      authorizeUrl: string;
      widget?: {
        redirectUri: string;
      };
    };

    expect(loginRequest.enabled).toBe(true);
    expect(loginRequest.widget?.redirectUri).toBe(
      'https://insight.leagsoft.com:34567/api/v1/auth/wecom/callback',
    );
    expect(new URL(loginRequest.authorizeUrl).searchParams.get('redirect_uri')).toBe(
      'https://insight.leagsoft.com:34567/api/v1/auth/wecom/callback',
    );
  });

  it('扫码换票应通过 Node 原生 HTTP 客户端访问企业微信接口，而不是依赖全局 fetch', async () => {
    process.env.WECOM_WEB_LOGIN_APP_ID = 'wwcorp-test';
    process.env.WECOM_WEB_LOGIN_SECRET = 'mock-secret';
    process.env.APP_WEB_BASE_URL = 'http://127.0.0.1:4173';

    const requestPaths: string[] = [];
    mockServer = createServer((request, response) => {
      requestPaths.push(request.url ?? '');
      response.setHeader('Content-Type', 'application/json');

      if (request.url?.startsWith('/cgi-bin/gettoken')) {
        response.end(
          JSON.stringify({
            errcode: 0,
            errmsg: 'ok',
            access_token: 'access-token-001',
            expires_in: 7200,
          }),
        );
        return;
      }

      if (request.url?.startsWith('/cgi-bin/auth/getuserinfo')) {
        response.end(
          JSON.stringify({
            errcode: 0,
            errmsg: 'ok',
            UserId: 'wx_user_001',
          }),
        );
        return;
      }

      if (request.url?.startsWith('/cgi-bin/user/get')) {
        response.end(
          JSON.stringify({
            errcode: 0,
            errmsg: 'ok',
            userid: 'wx_user_001',
            name: '王亮',
            mobile: '13800138000',
          }),
        );
        return;
      }

      response.statusCode = 404;
      response.end(JSON.stringify({ errcode: 404, errmsg: 'not found' }));
    });

    await new Promise<void>((resolve) => {
      mockServer!.listen(0, '127.0.0.1', () => resolve());
    });
    const port = (mockServer.address() as AddressInfo).port;
    process.env.WECOM_QYAPI_BASE_URL = `http://127.0.0.1:${port}/cgi-bin`;

    global.fetch = jest.fn(async () => {
      throw new Error('不应调用全局 fetch');
    }) as typeof global.fetch;

    const resolveMappedWebLoginUser = jest.fn(async () => ({
      id: 'user_sales_director',
      name: '销售总监',
      roleIds: ['role_sales_director'],
      roleNames: ['销售总监'],
      organizationIds: ['org_north'],
      departmentIds: ['dept_sales'],
      ownerIds: ['owner_sales_director'],
      isAdmin: false,
      exportAllowed: true,
      channels: ['web-console'],
      identitySource: 'database' as const,
    }));

    const service = new WecomWebLoginService(
      new LocalRuntimeConfigService(),
      {
        resolveMappedWebLoginUser,
      } as never,
      loggerService as unknown as AnalysisLoggerService,
      {
        savePendingBinding: jest.fn(),
      } as never,
    );

    await expect(
      service.resolveCallbackUser({ code: 'mock-wecom-code' }),
    ).resolves.toMatchObject({
      kind: 'user',
      user: {
        id: 'user_sales_director',
      },
    });
    expect(resolveMappedWebLoginUser).toHaveBeenCalledWith('wx_user_001');
    expect(requestPaths.some((item) => item.startsWith('/cgi-bin/gettoken'))).toBe(
      true,
    );
    expect(
      requestPaths.some((item) => item.startsWith('/cgi-bin/auth/getuserinfo')),
    ).toBe(true);
    expect(requestPaths.some((item) => item.startsWith('/cgi-bin/user/get'))).toBe(
      true,
    );
  });

  it('企业微信官方域名请求应先解析 IPv4 并保留原始 SNI 与 Host 头', async () => {
    const resolve4Spy = jest
      .spyOn(dns, 'resolve4')
      .mockResolvedValue(['183.47.100.66']);
    let capturedOptions: Record<string, unknown> | undefined;

    const requestFactory = jest.fn(((options: Record<string, unknown>, callback?: (response: MockHttpIncomingMessage) => void) => {
      capturedOptions = options;
      const response = new MockHttpIncomingMessage(200);
      const request = new MockHttpClientRequest(() => {
        callback?.(response);
        response.emit(
          'data',
          JSON.stringify({ errcode: 0, errmsg: 'ok', access_token: 'token_test' }),
        );
        response.emit('end');
      });

      return request as unknown as ReturnType<typeof createServer>;
    }) as never);

    await expect(
      requestWecomJsonThroughNodeHttp({
        url: 'https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=test&corpsecret=test',
        requestFactory: requestFactory as never,
      }),
    ).resolves.toEqual({
      statusCode: 200,
      payload: {
        errcode: 0,
        errmsg: 'ok',
        access_token: 'token_test',
      },
    });

    expect(resolve4Spy).toHaveBeenCalledWith('qyapi.weixin.qq.com');
    expect(capturedOptions).toEqual(
      expect.objectContaining({
        hostname: '183.47.100.66',
        servername: 'qyapi.weixin.qq.com',
        family: 4,
        agent: false,
      }),
    );
    expect(capturedOptions?.headers).toEqual(
      expect.objectContaining({
        Host: 'qyapi.weixin.qq.com',
        Connection: 'close',
      }),
    );
  });

  it('企业微信官方接口网络异常时应返回明确中文提示，而不是内部错误', async () => {
    process.env.WECOM_WEB_LOGIN_APP_ID = 'wwcorp-test';
    process.env.WECOM_WEB_LOGIN_SECRET = 'mock-secret';
    process.env.WECOM_QYAPI_BASE_URL = 'http://127.0.0.1:9/cgi-bin';
    process.env.APP_WEB_BASE_URL = 'http://127.0.0.1:4173';

    const service = new WecomWebLoginService(
      new LocalRuntimeConfigService(),
      {
        resolveMappedWebLoginUser: jest.fn(),
      } as never,
      loggerService as unknown as AnalysisLoggerService,
      {
        savePendingBinding: jest.fn(),
      } as never,
    );

    await expect(
      service.resolveCallbackUser({ code: 'mock-wecom-code' }),
    ).rejects.toThrow('当前无法连接企业微信认证服务，请稍后重试。');
    expect(loggerService.logWarn).toHaveBeenCalled();
  });
});

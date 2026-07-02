import { EventEmitter } from 'node:events';
import { promises as dns } from 'node:dns';
import * as https from 'node:https';
import { LocalRuntimeConfigService } from '../../../src/shared/config/local-runtime-config.service';
import { WecomOfficialDirectoryClient } from '../../../src/modules/wecom/wecom-official-directory.client';

jest.mock('node:dns', () => ({
  promises: {
    resolve4: jest.fn().mockResolvedValue(['1.1.1.1']),
  },
}));

jest.mock('node:https', () => ({
  request: jest.fn(),
}));

class MockIncomingMessage extends EventEmitter {
  statusCode: number;

  constructor(statusCode: number) {
    super();
    this.statusCode = statusCode;
  }

  setEncoding(): void {
    // 测试桩不需要真实编码处理，只需保持接口兼容。
  }
}

class MockClientRequest extends EventEmitter {
  constructor(private readonly onEnd: () => void) {
    super();
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

describe('WecomOfficialDirectoryClient', () => {
  function createConfigService(): LocalRuntimeConfigService {
    return {
      getWecomDirectorySyncConfig: () => ({
        enabled: true,
        corpId: 'corp_test',
        agentId: '1000043',
        secret: 'secret_test',
        rootDepartmentName: '联软科技集团',
        pageSize: 100,
      }),
      getWecomRuntimeConfig: () => ({
        qyapiBaseUrl: 'https://qyapi.weixin.qq.com/cgi-bin',
      }),
    } as unknown as LocalRuntimeConfigService;
  }

  function mockHttpsJsonResponse(payload: unknown, statusCode = 200): void {
    jest.mocked(https.request).mockImplementationOnce(((...args: unknown[]) => {
      const callback =
        typeof args[1] === 'function'
          ? (args[1] as (response: MockIncomingMessage) => void)
          : undefined;
      const response = new MockIncomingMessage(statusCode);
      const request = new MockClientRequest(() => {
        callback?.(response);
        response.emit('data', JSON.stringify(payload));
        response.emit('end');
      });

      return request as unknown as ReturnType<typeof https.request>;
    }) as typeof https.request);
  }

  function mockHttpsError(message = 'socket hang up'): void {
    jest.mocked(https.request).mockImplementationOnce(((() => {
      const request = new MockClientRequest(() => {
        request.emit('error', new Error(message));
      });
      return request as unknown as ReturnType<typeof https.request>;
    }) as unknown as typeof https.request));
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(dns.resolve4).mockResolvedValue(['1.1.1.1']);
  });

  it('获取 access token 遇到瞬时网络失败时应自动重试一次', async () => {
    mockHttpsError();
    mockHttpsJsonResponse({
      errcode: 0,
      errmsg: 'ok',
      access_token: 'token_success',
    });

    const client = new WecomOfficialDirectoryClient(createConfigService());

    await expect(client.getAccessToken()).resolves.toBe('token_success');
    expect(https.request).toHaveBeenCalledTimes(2);
  });

  it('拉取部门列表遇到瞬时网络失败时应自动重试一次', async () => {
    mockHttpsError();
    mockHttpsJsonResponse({
      errcode: 0,
      errmsg: 'ok',
      department: [],
    });

    const client = new WecomOfficialDirectoryClient(createConfigService());

    await expect(client.listDepartments('token_success')).resolves.toEqual({
      errcode: 0,
      errmsg: 'ok',
      department: [],
    });
    expect(https.request).toHaveBeenCalledTimes(2);
  });
});

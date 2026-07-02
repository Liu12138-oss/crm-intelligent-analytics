import { WecomAppMessageService } from '../../../src/modules/notifications/wecom-app-message.service';

describe('WecomAppMessageService', () => {
  const loggerService = {
    logStep: jest.fn(),
    logWarn: jest.fn(),
  };

  let service: WecomAppMessageService;
  let originalFetch: typeof global.fetch | undefined;

  beforeEach(() => {
    originalFetch = global.fetch;
    loggerService.logStep.mockReset();
    loggerService.logWarn.mockReset();
  });

  afterEach(() => {
    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      delete (global as Partial<typeof global>).fetch;
    }
  });

  it('非测试运行环境真实发送关闭时仍应把已改投接收人发送到企业微信自建应用', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    service = new WecomAppMessageService(
      {
        getWecomNotifyConfig: jest.fn(() => ({
          enabled: true,
          corpId: 'wwcorp',
          agentId: '1000271',
          secret: 'secret_001',
          qyapiBaseUrl: 'https://qyapi.weixin.qq.com/cgi-bin',
          realMessageEnabled: false,
          testReceiverUserId: 'WangLiang02',
        })),
      } as never,
      loggerService as never,
    );
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errcode: 0,
            errmsg: 'ok',
            access_token: 'notify-access-token',
            expires_in: 7200,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errcode: 0,
            errmsg: 'ok',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      );
    global.fetch = fetchMock as typeof global.fetch;

    try {
      const result = await service.sendMessage({
        recipient: {
          id: 'recipient_001',
          recipientType: 'WECOM_USER',
          status: 'TEST_OVERRIDDEN',
          deliveryTargetId: 'WangLiang02',
          wecomUserId: 'WangLiang02',
        },
        message: {
          msgtype: 'markdown',
          content: '测试内容',
        },
        realMessageEnabled: false,
      });
      const sendBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));

      expect(result.status).toBe('SENT');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(sendBody.touser).toBe('WangLiang02');
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
    }
  });

  it('真实发送时应调用企业微信自建应用消息接口并将 invaliduser 判定为失败', async () => {
    service = new WecomAppMessageService(
      {
        getWecomNotifyConfig: jest.fn(() => ({
          enabled: true,
          corpId: 'wwcorp',
          agentId: '1000271',
          secret: 'secret_001',
          qyapiBaseUrl: 'https://qyapi.weixin.qq.com/cgi-bin',
          realMessageEnabled: true,
          testReceiverUserId: 'WangLiang02',
        })),
      } as never,
      loggerService as never,
    );

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errcode: 0,
            errmsg: 'ok',
            access_token: 'notify-access-token',
            expires_in: 7200,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errcode: 0,
            errmsg: 'ok',
            invaliduser: 'user_a|user_b',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      );
    global.fetch = fetchMock as typeof global.fetch;

    const result = await service.sendMessage({
      recipient: {
        id: 'recipient_002',
        recipientType: 'WECOM_USER',
        status: 'READY',
        deliveryTargetId: 'wx_user_002',
        wecomUserId: 'wx_user_002',
      },
      message: {
        msgtype: 'markdown',
        content: '正式通知内容',
      },
      realMessageEnabled: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/gettoken?corpid=');
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/message/send?access_token=');
    expect(result.status).toBe('FAILED');
    expect(result.failureReason).toBe('企业微信自建应用返回了无效接收人。');
    expect(result.invalidUserIds).toEqual(['user_a', 'user_b']);
  });

  it('access_token 获取失败时应返回标准失败结果', async () => {
    service = new WecomAppMessageService(
      {
        getWecomNotifyConfig: jest.fn(() => ({
          enabled: true,
          corpId: 'wwcorp',
          agentId: '1000271',
          secret: 'secret_001',
          qyapiBaseUrl: 'https://qyapi.weixin.qq.com/cgi-bin',
          realMessageEnabled: true,
          testReceiverUserId: 'WangLiang02',
        })),
      } as never,
      loggerService as never,
    );
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('token 网络失败')) as typeof global.fetch;

    await expect(
      service.sendMessage({
        recipient: {
          id: 'recipient_003',
          recipientType: 'WECOM_USER',
          status: 'READY',
          deliveryTargetId: 'wx_user_003',
          wecomUserId: 'wx_user_003',
        },
        message: {
          msgtype: 'markdown',
          content: '正式通知内容',
        },
        realMessageEnabled: true,
      }),
    ).resolves.toMatchObject({
      status: 'FAILED',
      failureReason: expect.stringContaining('access_token'),
      externalErrorMessage: expect.stringContaining('token 网络失败'),
    });
  });

  it('自建应用消息接口返回无效接收人时应判定失败并保留外部错误信息', async () => {
    service = new WecomAppMessageService(
      {
        getWecomNotifyConfig: jest.fn(() => ({
          enabled: true,
          corpId: 'wwcorp',
          agentId: '1000271',
          secret: 'secret_001',
          qyapiBaseUrl: 'https://qyapi.weixin.qq.com/cgi-bin',
          realMessageEnabled: true,
          testReceiverUserId: 'WangLiang02',
        })),
      } as never,
      loggerService as never,
    );
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errcode: 0,
            errmsg: 'ok',
            access_token: 'notify-access-token',
            expires_in: 7200,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errcode: 0,
            errmsg: 'ok',
            invaliduser: 'bad_user',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      ) as typeof global.fetch;

    await expect(
      service.sendMessage({
        recipient: {
          id: 'recipient_004',
          recipientType: 'WECOM_USER',
          status: 'READY',
          deliveryTargetId: 'bad_user',
          wecomUserId: 'bad_user',
        },
        message: {
          msgtype: 'markdown',
          content: '正式通知内容',
        },
        realMessageEnabled: true,
      }),
    ).resolves.toMatchObject({
      status: 'FAILED',
      failureReason: '企业微信自建应用返回了无效接收人。',
      invalidUserIds: ['bad_user'],
    });
  });

  it('自建应用频率限制错误应归一化为退避重试策略', async () => {
    service = new WecomAppMessageService(
      {
        getWecomNotifyConfig: jest.fn(() => ({
          enabled: true,
          corpId: 'wwcorp',
          agentId: '1000271',
          secret: 'secret_001',
          qyapiBaseUrl: 'https://qyapi.weixin.qq.com/cgi-bin',
          realMessageEnabled: true,
          testReceiverUserId: 'WangLiang02',
        })),
      } as never,
      loggerService as never,
    );
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errcode: 0,
            errmsg: 'ok',
            access_token: 'notify-access-token',
            expires_in: 7200,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errcode: 45009,
            errmsg: 'api freq out of limit',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      ) as typeof global.fetch;

    await expect(
      service.sendMessage({
        recipient: {
          id: 'recipient_005',
          recipientType: 'WECOM_USER',
          status: 'READY',
          deliveryTargetId: 'wx_user_005',
          wecomUserId: 'wx_user_005',
        },
        message: {
          msgtype: 'markdown',
          content: '正式通知内容',
        },
        realMessageEnabled: true,
      }),
    ).resolves.toMatchObject({
      status: 'FAILED',
      failureReason: '企业微信自建应用发送频率超限或服务暂不可用',
      externalErrorCode: '45009',
      retryStrategy: 'RATE_LIMIT_BACKOFF',
    });
  });
});

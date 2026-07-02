import { WecomBotNotificationService } from '../../../src/modules/notifications/wecom-bot-notification.service';

describe('WecomBotNotificationService', () => {
  const transportService = {
    sendMarkdownMessage: jest.fn(),
    sendTemplateCardMessage: jest.fn(),
  };

  let service: WecomBotNotificationService;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    transportService.sendMarkdownMessage.mockReset();
    transportService.sendTemplateCardMessage.mockReset();
    service = new WecomBotNotificationService(transportService as never);
  });

  afterAll(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('测试环境下应继续返回 mock 发送结果', async () => {
    process.env.NODE_ENV = 'test';

    const result = await service.sendMessage({
      recipient: {
        id: 'recipient_test_001',
        recipientType: 'WECOM_USER',
        status: 'TEST_OVERRIDDEN',
        deliveryTargetId: 'WangLiang02',
        wecomUserId: 'WangLiang02',
      },
      message: {
        msgtype: 'markdown',
        content: '测试日报确认消息',
      },
      realMessageEnabled: false,
    });

    expect(result.status).toBe('SENT');
    expect(String(result.externalMessageId)).toContain('wecom-bot-mock-');
    expect(transportService.sendMarkdownMessage).not.toHaveBeenCalled();
  });

  it('开发环境改投测试接收人时应真正调用机器人 markdown 发送', async () => {
    process.env.NODE_ENV = 'development';
    transportService.sendMarkdownMessage.mockResolvedValue({
      externalMessageId: 'wecom-msg-001',
    });

    const result = await service.sendMessage({
      recipient: {
        id: 'recipient_dev_001',
        recipientType: 'WECOM_USER',
        status: 'TEST_OVERRIDDEN',
        deliveryTargetId: 'WangLiang02',
        wecomUserId: 'WangLiang02',
        chatType: 'single',
        externalConversationId: 'WangLiang02',
      },
      message: {
        msgtype: 'markdown',
        content: '开发环境日报汇总测试消息',
      },
      realMessageEnabled: false,
    });

    expect(transportService.sendMarkdownMessage).toHaveBeenCalledWith(
      {
        chatType: 'single',
        deliveryTargetId: 'WangLiang02',
        senderId: 'WangLiang02',
        externalConversationId: 'WangLiang02',
      },
      '开发环境日报汇总测试消息',
    );
    expect(result).toEqual({
      status: 'SENT',
      externalMessageId: 'wecom-msg-001',
    });
  });

  it('应将企业微信机器人 846607 错误归一为中文频率限制原因', async () => {
    process.env.NODE_ENV = 'development';
    transportService.sendMarkdownMessage.mockRejectedValue(
      new Error('ack failed errcode=846607 errmsg=aibot send msg frequency limit exceeded hint: [abc]'),
    );

    const result = await service.sendMessage({
      recipient: {
        id: 'recipient_rate_limit_001',
        recipientType: 'WECOM_USER',
        status: 'READY',
        deliveryTargetId: 'wx_user_001',
        wecomUserId: 'wx_user_001',
      },
      message: {
        msgtype: 'markdown',
        content: '频率限制测试',
      },
      realMessageEnabled: true,
    });

    expect(result).toMatchObject({
      status: 'FAILED',
      failureReason: '企业微信机器人发送频率超限',
      externalErrorCode: '846607',
      externalErrorMessage: expect.stringContaining('aibot send msg frequency limit exceeded'),
      retryStrategy: 'RATE_LIMIT_BACKOFF',
    });
  });
});

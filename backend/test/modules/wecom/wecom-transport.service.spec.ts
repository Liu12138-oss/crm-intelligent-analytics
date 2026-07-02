import { WecomTransportService } from '../../../src/modules/wecom/wecom-transport.service';

describe('WecomTransportService', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalEnableSdkTransport = process.env.WECOM_ENABLE_SDK_TRANSPORT;

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.NODE_ENV = originalNodeEnv;
    if (originalEnableSdkTransport === undefined) {
      delete process.env.WECOM_ENABLE_SDK_TRANSPORT;
    } else {
      process.env.WECOM_ENABLE_SDK_TRANSPORT = originalEnableSdkTransport;
    }
  });

  const buildRuntimeConfig = (overrides: Record<string, unknown> = {}) => ({
    botId: 'test-bot',
    botSecret: 'test-secret',
    botSignature: 'test-signature',
    botSource: 'wecom-bot',
    botTransportMode: 'sdk',
    botWsUrl: 'wss://openws.work.weixin.qq.com',
    botMaxReconnectAttempts: 10,
    botHeartbeatIntervalMs: 30000,
    deliveryMaxRetries: 2,
    deliveryRetryDelayMs: 300,
    deliveryChunkMaxLength: 900,
    webBaseUrl: 'http://127.0.0.1:5173',
    qyapiBaseUrl: 'https://qyapi.weixin.qq.com/cgi-bin',
    ...overrides,
  });

  const buildService = (configOverrides: Record<string, unknown> = {}) => {
    const logger = {
      logWarn: jest.fn(),
      logStep: jest.fn(),
    };
    const service = new WecomTransportService(
      {
        getWecomRuntimeConfig: jest.fn(() => buildRuntimeConfig(configOverrides)),
      } as never,
      logger as never,
    ) as any;

    return {
      service,
      logger,
    };
  };

  it('测试环境默认应走 mock transport，避免自动化测试连接真实企业微信', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.WECOM_ENABLE_SDK_TRANSPORT;
    const { service } = buildService();

    const result = await service.sendMarkdownMessage(
      {
        deliveryTargetId: 'test-chat',
      } as never,
      '测试消息',
    );

    expect(result.externalMessageId).toContain('mock-delivery-');
  });

  it('开发环境 mock 通道应跳过真实入站监听且不安排重试', async () => {
    process.env.NODE_ENV = 'development';
    const { service, logger } = buildService({
      botTransportMode: 'mock',
    });
    service.scheduleInboundRetry = jest.fn();
    service.ensureSdkClient = jest.fn();

    await service.startInboundListener(jest.fn().mockResolvedValue(undefined));

    expect(service.ensureSdkClient).not.toHaveBeenCalled();
    expect(service.scheduleInboundRetry).not.toHaveBeenCalled();
    expect(logger.logWarn).toHaveBeenCalledWith(
      '企业微信机器人当前使用 mock transport，已跳过真实入站监听。',
    );
  });

  it('真实监听准备失败时应记录警告并自动安排重试', async () => {
    process.env.NODE_ENV = 'development';
    const { service, logger } = buildService();
    service.acquireInboundListenerLock = jest.fn().mockReturnValue(true);
    service.ensureSdkClient = jest.fn().mockRejectedValue(new Error('sdk-timeout'));
    service.scheduleInboundRetry = jest.fn();

    await expect(
      service.startInboundListener(jest.fn().mockResolvedValue(undefined)),
    ).resolves.toBeUndefined();

    expect(logger.logWarn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        retryInMs: 10000,
        reason: 'sdk-timeout',
      }),
    );
    expect(service.scheduleInboundRetry).toHaveBeenCalledTimes(1);
  });

  it('企微 SDK 参数缺失时应跳过真实监听并安排重试', async () => {
    process.env.NODE_ENV = 'development';
    const { service, logger } = buildService({
      botSecret: undefined,
    });
    service.acquireInboundListenerLock = jest.fn().mockReturnValue(true);
    service.ensureSdkClient = jest.fn();
    service.scheduleInboundRetry = jest.fn();

    await service.startInboundListener(jest.fn().mockResolvedValue(undefined));

    expect(service.ensureSdkClient).not.toHaveBeenCalled();
    expect(service.scheduleInboundRetry).toHaveBeenCalledTimes(1);
    expect(logger.logWarn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        retryInMs: 10000,
        reason: 'wecom-sdk-config-not-ready',
      }),
    );
  });

  it('监听锁被其他进程占用时应安排自动重试', async () => {
    process.env.NODE_ENV = 'development';
    const { service } = buildService();
    service.acquireInboundListenerLock = jest.fn().mockReturnValue(false);
    service.ensureSdkClient = jest.fn();
    service.scheduleInboundRetry = jest.fn();

    await service.startInboundListener(jest.fn().mockResolvedValue(undefined));

    expect(service.ensureSdkClient).not.toHaveBeenCalled();
    expect(service.scheduleInboundRetry).toHaveBeenCalledTimes(1);
  });

  it('监听锁主人为僵尸进程时应视为失效锁', () => {
    const { service } = buildService();
    jest.spyOn(process, 'kill').mockImplementation((() => true) as typeof process.kill);
    service.readProcessStatus = jest.fn(() => 'Z+');

    expect(service.isProcessAlive(72521)).toBe(false);
  });

  it('SDK 主动发送返回 ACK 错误时应抛出包含 errcode 的异常', async () => {
    process.env.NODE_ENV = 'development';
    const { service } = buildService();
    service.ensureSdkClient = jest.fn().mockResolvedValue({
      sendMessage: jest.fn().mockResolvedValue({
        errcode: 846607,
        errmsg: 'aibot send msg frequency limit exceeded',
        hint: '[abc]',
      }),
    });

    await expect(
      service.sendMarkdownMessage(
        {
          deliveryTargetId: 'test-chat',
        } as never,
        '测试消息',
      ),
    ).rejects.toThrow('errcode=846607');
  });

  it('发送图片消息时应先上传临时素材再下发媒体消息', async () => {
    process.env.NODE_ENV = 'development';
    const uploadMedia = jest.fn().mockResolvedValue({
      media_id: 'media_table_image',
    });
    const sendMediaMessage = jest.fn().mockResolvedValue({
      header: {
        msgid: 'msg_image_001',
      },
    });
    const { service } = buildService();
    service.ensureSdkClient = jest.fn().mockResolvedValue({
      uploadMedia,
      sendMediaMessage,
    });

    const result = await service.sendImageMessage(
      {
        deliveryTargetId: 'test-chat',
      } as never,
      Buffer.from('png-buffer'),
      'crm-analysis-table.png',
    );

    expect(uploadMedia).toHaveBeenCalledWith(Buffer.from('png-buffer'), {
      type: 'image',
      filename: 'crm-analysis-table.png',
    });
    expect(sendMediaMessage).toHaveBeenCalledWith(
      'test-chat',
      'image',
      'media_table_image',
    );
    expect(result.externalMessageId).toBe('msg_image_001');
  });

  it('发送模板卡片消息时应使用 template_card 消息体', async () => {
    process.env.NODE_ENV = 'development';
    const sendMessage = jest.fn().mockResolvedValue({
      header: {
        msgid: 'msg_card_001',
      },
    });
    const { service } = buildService();
    service.ensureSdkClient = jest.fn().mockResolvedValue({
      sendMessage,
    });

    const templateCard = {
      card_type: 'text_notice',
      main_title: {
        title: '订单与商机分块分析',
      },
      card_action: {
        type: 1,
        url: 'http://127.0.0.1:5173',
      },
    };
    const result = await service.sendTemplateCardMessage(
      {
        deliveryTargetId: 'test-chat',
      } as never,
      templateCard,
    );

    expect(sendMessage).toHaveBeenCalledWith('test-chat', {
      msgtype: 'template_card',
      template_card: templateCard,
    });
    expect(result.externalMessageId).toBe('msg_card_001');
  });
});

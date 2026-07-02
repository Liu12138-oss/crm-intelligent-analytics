import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AnalysisService } from '../../src/modules/analysis/analysis.service';
import { AppStorageService } from '../../src/database/app-storage/app-storage.service';
import { createTestApp } from '../test-app';

describe('wecom stream delivery integration', () => {
  let app: INestApplication;
  let appStorageService: AppStorageService;
  const originalEnableSdkTransport = process.env.WECOM_ENABLE_SDK_TRANSPORT;
  const originalChunkLength = process.env.WECOM_BOT_DELIVERY_CHUNK_MAX_LENGTH;
  const originalWsUrl = process.env.WECOM_BOT_WS_URL;
  const originalBotId = process.env.WECOM_BOT_ID;
  const originalBotSecret = process.env.WECOM_BOT_SECRET;

  beforeEach(async () => {
    delete process.env.WECOM_ENABLE_SDK_TRANSPORT;
    delete process.env.WECOM_BOT_DELIVERY_CHUNK_MAX_LENGTH;
    app = await createTestApp();
    appStorageService = app.get(AppStorageService);
  });

  afterEach(async () => {
    await app.close();
    if (originalEnableSdkTransport === undefined) {
      delete process.env.WECOM_ENABLE_SDK_TRANSPORT;
    } else {
      process.env.WECOM_ENABLE_SDK_TRANSPORT = originalEnableSdkTransport;
    }

    if (originalChunkLength === undefined) {
      delete process.env.WECOM_BOT_DELIVERY_CHUNK_MAX_LENGTH;
    } else {
      process.env.WECOM_BOT_DELIVERY_CHUNK_MAX_LENGTH = originalChunkLength;
    }

    if (originalWsUrl === undefined) {
      delete process.env.WECOM_BOT_WS_URL;
    } else {
      process.env.WECOM_BOT_WS_URL = originalWsUrl;
    }

    if (originalBotId === undefined) {
      delete process.env.WECOM_BOT_ID;
    } else {
      process.env.WECOM_BOT_ID = originalBotId;
    }

    if (originalBotSecret === undefined) {
      delete process.env.WECOM_BOT_SECRET;
    } else {
      process.env.WECOM_BOT_SECRET = originalBotSecret;
    }
  });

  it('应将结果块真实写入下发记录，而不是仅返回预览数组', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_delivery_001',
        senderId: 'wx_sales_director',
        messageId: 'msg_delivery_001',
        messageText: '本月各销售负责人新增商机金额排名',
      })
      .expect(202);

    const deliveryRecords = appStorageService.state.wecomDeliveryRecords.filter(
      (item) => item.receiptId === response.body.receiptId,
    );

    expect(response.body.deliveryStatus).toBe('SENT');
    expect(deliveryRecords.length).toBeGreaterThan(0);
    expect(deliveryRecords[0].status).toBe('SENT');
    expect(deliveryRecords.some((item) => item.blockType === 'PROCESSING_NOTICE')).toBe(
      true,
    );
  });

  it('块内容过长时应拆分为多条下发记录', async () => {
    await app.close();
    delete process.env.WECOM_ENABLE_SDK_TRANSPORT;
    process.env.WECOM_BOT_DELIVERY_CHUNK_MAX_LENGTH = '20';
    app = await createTestApp();
    appStorageService = app.get(AppStorageService);

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_delivery_002',
        senderId: 'wx_sales_director',
        messageId: 'msg_delivery_002',
        messageText: '本月各销售负责人新增商机金额排名',
      })
      .expect(202);

    const deliveryRecords = appStorageService.state.wecomDeliveryRecords.filter(
      (item) => item.receiptId === response.body.receiptId,
    );

    expect(deliveryRecords.length).toBeGreaterThan(3);
  });

  it('SDK 模式连接异常时应记录下发尝试而不是丢失结果', async () => {
    await app.close();
    process.env.WECOM_ENABLE_SDK_TRANSPORT = 'true';
    process.env.WECOM_BOT_ID = 'test-bot';
    process.env.WECOM_BOT_SECRET = 'test-secret';
    process.env.WECOM_BOT_WS_URL = 'ws://127.0.0.1:1';
    app = await createTestApp();
    appStorageService = app.get(AppStorageService);

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_delivery_003',
        senderId: 'wx_sales_director',
        messageId: 'msg_delivery_003',
        messageText: '本月各销售负责人新增商机金额排名',
      })
      .expect(202);

    const deliveryRecords = appStorageService.state.wecomDeliveryRecords.filter(
      (item) => item.receiptId === response.body.receiptId,
    );

    expect(response.body.deliveryStatus).toBe('FAILED');
    expect(deliveryRecords.length).toBeGreaterThan(0);
    expect(deliveryRecords.some((item) => item.status === 'FAILED')).toBe(true);
  });

  it('慢查询时应先发送中间进度反馈，再发送最终结果', async () => {
    const analysisService = app.get(AnalysisService);
    const originalCreateQuery = analysisService.createQuery.bind(analysisService);
    jest
      .spyOn(analysisService, 'createQuery')
      .mockImplementation(async (...args) => {
        await new Promise((resolve) => setTimeout(resolve, 1800));
        return await originalCreateQuery(...args);
      });

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_delivery_004',
        senderId: 'wx_sales_director',
        messageId: 'msg_delivery_004',
        messageText: '本月各销售负责人新增商机金额排名',
      })
      .expect(202);

    const deliveryRecords = appStorageService.state.wecomDeliveryRecords.filter(
      (item) => item.receiptId === response.body.receiptId,
    );

    expect(
      deliveryRecords.some((item) =>
        item.contentPreview.includes('您好，已收到'),
      ),
    ).toBe(true);
    expect(
      deliveryRecords.some((item) =>
        item.contentPreview.includes('正在识别意图并准备后续处理'),
      ),
    ).toBe(true);
  });
});

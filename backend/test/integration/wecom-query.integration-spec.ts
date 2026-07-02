import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppStorageService } from '../../src/database/app-storage/app-storage.service';
import { AnalysisService } from '../../src/modules/analysis/analysis.service';
import { WecomBotService } from '../../src/modules/wecom/wecom-bot.service';
import { WecomTransportService } from '../../src/modules/wecom/wecom-transport.service';
import { createTestApp } from '../test-app';

describe('wecom query integration', () => {
  let app: INestApplication;
  let appStorageService: AppStorageService;
  let analysisService: AnalysisService;
  let wecomBotService: WecomBotService;
  let wecomTransportService: WecomTransportService;

  beforeAll(async () => {
    app = await createTestApp();
    appStorageService = app.get(AppStorageService);
    analysisService = app.get(AnalysisService);
    wecomBotService = app.get(WecomBotService);
    wecomTransportService = app.get(WecomTransportService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('企业微信消息应通过验签并建立会话', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_sales_001',
        senderId: 'wx_sales_director',
        messageId: 'msg_001',
        messageText: '本月各销售负责人新增商机金额排名',
      })
      .expect(202);

    expect(response.body.sessionId).toBeTruthy();
    expect(response.body.queryId).toBeTruthy();
    expect(response.body.status).toBe('RETURNED');
    expect(
      appStorageService.state.auditEvents.find(
        (item) =>
          item.eventType === 'QUERY_SUCCEEDED' &&
          item.relatedRequestId === response.body.queryId,
      ),
    ).toEqual(
      expect.objectContaining({
        actorId: 'user_sales_director',
        actorType: 'crm-user',
        actorBindingStatus: 'BOUND_CRM',
        channel: 'wecom-bot',
      }),
    );
  });

  it('企业微信消息来源错误时应被拦截', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'unknown-source')
      .send({
        externalConversationId: 'conv_sales_002',
        senderId: 'wx_sales_director',
        messageId: 'msg_002',
        messageText: '本月各销售负责人新增商机金额排名',
      })
      .expect(403);
  });

  it('未绑定 CRM 身份的企业微信用户应被拦截', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_sales_003',
        senderId: 'wx_unknown_user',
        messageId: 'msg_003',
        messageText: '本月各销售负责人新增商机金额排名',
      })
      .expect(403);

    expect(
      appStorageService.state.auditEvents.find(
        (item) =>
          item.eventType === 'WECOM_AUTH_FAILED' &&
          item.actorId === 'wecom:wx_unknown_user',
      ),
    ).toEqual(
      expect.objectContaining({
        actorDisplayName: '未绑定 CRM 用户（企业微信：wx_unknown_user）',
        actorBindingStatus: 'UNBOUND_WECOM',
        channel: 'wecom-bot',
      }),
    );
  });

  it('真实企业微信入站未绑定 CRM 身份时也应回错误提示', async () => {
    const response = await wecomBotService.receiveSdkMessage({
      msgid: 'sdk_unbound_001',
      chattype: 'single',
      from: {
        userid: 'WangLiang02',
      },
      msgtype: 'text',
      text: {
        content: '你好',
      },
    });

    expect(response.status).toBe('BLOCKED');
    expect(String(response.clarificationPrompt)).toContain('智能移动助手');
    expect(String(response.clarificationPrompt)).toContain('WangLiang02');
    expect(appStorageService.state.wecomDeliveryRecords.length).toBeGreaterThan(0);
    expect(
      appStorageService.state.wecomDeliveryRecords.some((item) =>
        item.contentPreview.includes('正在处理中'),
      ),
    ).toBe(true);
  });

  it('真实 SDK 入站应先发送未完成的进度流，再发送完成态结果', async () => {
    const replyStreamSpy = jest.spyOn(
      wecomTransportService,
      'replyStreamMessage',
    );

    await wecomBotService.receiveSdkMessage({
      headers: {
        req_id: 'sdk_req_stream_001',
      },
      body: {
        msgid: 'sdk_stream_001',
        chattype: 'single',
        from: {
          userid: 'WangLiang02',
        },
        msgtype: 'text',
        text: {
          content: '你好',
        },
      },
    });

    expect(replyStreamSpy).toHaveBeenCalled();
    expect(replyStreamSpy.mock.calls[0][0].finish).toBe(false);
    expect(replyStreamSpy.mock.calls[replyStreamSpy.mock.calls.length - 1][0].finish).toBe(true);
  });

  it('企业微信详情若缺少顶层 Markdown，也应基于统一结果包重建企微 Markdown 回传', async () => {
    const originalGetQueryDetail = analysisService.getQueryDetail.bind(analysisService);
    jest
      .spyOn(analysisService, 'getQueryDetail')
      .mockImplementation((...args) => {
        const detail = originalGetQueryDetail(...args) as Record<string, unknown>;
        return {
          ...detail,
          groundedMarkdown: undefined,
          wecomMarkdown: undefined,
          report: {
            ...(detail.report as Record<string, unknown>),
            groundedMarkdown: undefined,
            wecomMarkdown: undefined,
          },
        };
      });

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_sales_004',
        senderId: 'wx_sales_director',
        messageId: 'msg_004',
        messageText: '本月各销售负责人新增商机金额排名',
      })
      .expect(202);

    const deliveryRecords = appStorageService.state.wecomDeliveryRecords.filter(
      (item) => item.receiptId === response.body.receiptId,
    );

    expect(
      deliveryRecords.some(
        (item) =>
          item.contentPreview.includes('新增商机金额') ||
          item.contentPreview.includes('销售负责人'),
      ),
    ).toBe(true);
  });
});

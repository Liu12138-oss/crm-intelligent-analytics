import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from '../test-app';

describe('wecom bot contract', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('未配置 AI 时应接受普通企业微信文本消息并返回明确降级状态', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_contract_001',
        senderId: 'wx_sales_director',
        messageId: 'msg_contract_001',
        messageText: '帮我写一段会议纪要开头',
      })
      .expect(202);

    expect(response.body.receiptId).toBeTruthy();
    expect(response.body.sessionId).toBeTruthy();
    expect(response.body.status).toBe('AI_UNAVAILABLE');
    expect(response.body.deliveryStatus).toBe('SENT');
  });

  it('未配置 AI 时应接受官方风格普通文本消息并完成归一化', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        msgid: 'msg_contract_002',
        chattype: 'group',
        chatid: 'group_sales_001',
        from: {
          userid: 'wx_sales_director',
        },
        msgtype: 'text',
        text: {
          content: '请把这句话润色得更正式：明天大家早点到',
        },
      })
      .expect(202);

    expect(response.body.receiptId).toBeTruthy();
    expect(response.body.sessionId).toBeTruthy();
    expect(response.body.status).toBe('AI_UNAVAILABLE');
  });

  it('核心模式下应接受 CRM 问数类消息并返回业务能力未启用提示', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_contract_disabled_001',
        senderId: 'wx_sales_director',
        messageId: 'msg_contract_disabled_001',
        messageText: '本月各销售负责人新增商机金额排名',
      })
      .expect(202);

    expect(response.body.status).toBe('BUSINESS_DISABLED');
    expect(response.body.deliveryStatus).toBe('SENT');
  });

  it('应拒绝当前一期不支持的企业微信图片消息', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        msgid: 'msg_contract_003',
        chattype: 'single',
        from: {
          userid: 'wx_sales_director',
        },
        msgtype: 'image',
        image: {
          url: 'https://example.com/image.png',
        },
      })
      .expect(400);
  });
});

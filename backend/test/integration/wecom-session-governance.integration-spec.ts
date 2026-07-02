import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppStorageService } from '../../src/database/app-storage/app-storage.service';
import { SessionQueueService } from '../../src/modules/sessions/session-queue.service';
import { createTestApp } from '../test-app';

describe('wecom session governance integration', () => {
  let app: INestApplication;
  let appStorageService: AppStorageService;
  let sessionQueueService: SessionQueueService;

  beforeAll(async () => {
    app = await createTestApp();
    appStorageService = app.get(AppStorageService);
    sessionQueueService = app.get(SessionQueueService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('同一 messageId 重复回调时应直接命中幂等结果', async () => {
    const payload = {
      externalConversationId: 'conv_gov_001',
      senderId: 'wx_sales_director',
      messageId: 'msg_gov_001',
      messageText: '本月各销售负责人新增商机金额排名',
    };

    const firstResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send(payload)
      .expect(202);

    const secondResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send(payload)
      .expect(202);

    expect(secondResponse.body.deduplicated).toBe(true);
    expect(secondResponse.body.receiptId).toBe(firstResponse.body.receiptId);
    expect(
      appStorageService.state.analysisRequests.filter(
        (item) => item.id === firstResponse.body.queryId,
      ),
    ).toHaveLength(1);
  });

  it('同一群聊中的不同发送者应隔离不同会话', async () => {
    const directorResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        msgid: 'msg_gov_002',
        chattype: 'group',
        chatid: 'group_sales_002',
        from: { userid: 'wx_sales_director' },
        msgtype: 'text',
        text: { content: '本月各销售负责人新增商机金额排名' },
      })
      .expect(202);

    const managerResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        msgid: 'msg_gov_003',
        chattype: 'group',
        chatid: 'group_sales_002',
        from: { userid: 'wx_region_manager' },
        msgtype: 'text',
        text: { content: '本月各销售负责人新增商机金额排名' },
      })
      .expect(202);

    expect(directorResponse.body.sessionId).not.toBe(managerResponse.body.sessionId);
  });

  it('同一会话繁忙时后续消息应进入排队提示', async () => {
    const firstResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_gov_004',
        senderId: 'wx_sales_director',
        messageId: 'msg_gov_004',
        messageText: '本月各销售负责人新增商机金额排名',
      })
      .expect(202);

    sessionQueueService.tryEnter('manual_busy_request', 50, firstResponse.body.sessionId);

    const queuedResponse = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_gov_004',
        senderId: 'wx_sales_director',
        messageId: 'msg_gov_005',
        messageText: '本月各销售负责人新增商机金额排名',
      })
      .expect(202);

    sessionQueueService.leave('manual_busy_request');

    expect(queuedResponse.body.status).toBe('QUEUED');
    expect(queuedResponse.body.queueNotice).toContain('当前会话仍有请求处理中');
  });
});

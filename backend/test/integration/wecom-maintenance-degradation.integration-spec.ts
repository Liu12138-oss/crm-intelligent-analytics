import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppStorageService } from '../../src/database/app-storage/app-storage.service';
import { createTestApp } from '../test-app';

describe('wecom maintenance degradation integration', () => {
  let app: INestApplication;
  let appStorageService: AppStorageService;
  const originalIdentityFlag = process.env.WECOM_FORCE_IDENTITY_UNAVAILABLE;
  const originalDataFlag = process.env.WECOM_FORCE_DATA_UNAVAILABLE;
  const originalStorageFlag = process.env.WECOM_FORCE_STORAGE_UNAVAILABLE;

  afterEach(async () => {
    if (app) {
      await app.close();
    }

    if (originalIdentityFlag === undefined) {
      delete process.env.WECOM_FORCE_IDENTITY_UNAVAILABLE;
    } else {
      process.env.WECOM_FORCE_IDENTITY_UNAVAILABLE = originalIdentityFlag;
    }

    if (originalDataFlag === undefined) {
      delete process.env.WECOM_FORCE_DATA_UNAVAILABLE;
    } else {
      process.env.WECOM_FORCE_DATA_UNAVAILABLE = originalDataFlag;
    }

    if (originalStorageFlag === undefined) {
      delete process.env.WECOM_FORCE_STORAGE_UNAVAILABLE;
    } else {
      process.env.WECOM_FORCE_STORAGE_UNAVAILABLE = originalStorageFlag;
    }
  });

  it('身份源不可用时应返回维护期降级提示而不是无权限', async () => {
    process.env.WECOM_FORCE_IDENTITY_UNAVAILABLE = 'true';
    app = await createTestApp();
    appStorageService = app.get(AppStorageService);

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_deg_001',
        senderId: 'wx_sales_director',
        messageId: 'msg_deg_001',
        messageText: '本月各销售负责人新增商机金额排名',
      })
      .expect(202);

    expect(response.body.status).toBe('DEGRADED');
    expect(response.body.clarificationPrompt).toContain('无法确认你的 CRM 身份');
    expect(
      appStorageService.state.auditEvents.some(
        (item) => item.eventType === 'MAINTENANCE_DEGRADED',
      ),
    ).toBe(true);
  });

  it('数据源不可用时应返回实时数据维护提示', async () => {
    process.env.WECOM_FORCE_DATA_UNAVAILABLE = 'true';
    app = await createTestApp();
    appStorageService = app.get(AppStorageService);

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_deg_002',
        senderId: 'wx_sales_director',
        messageId: 'msg_deg_002',
        messageText: '本月各销售负责人新增商机金额排名',
      })
      .expect(202);

    expect(response.body.status).toBe('DEGRADED');
    expect(response.body.clarificationPrompt).toContain('无法查询实时 CRM 数据');
    expect(appStorageService.state.analysisRequests).toHaveLength(0);
  });

  it('维护期恢复后应记录恢复事件', async () => {
    process.env.WECOM_FORCE_DATA_UNAVAILABLE = 'true';
    app = await createTestApp();
    appStorageService = app.get(AppStorageService);

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_deg_003',
        senderId: 'wx_sales_director',
        messageId: 'msg_deg_003',
        messageText: '本月各销售负责人新增商机金额排名',
      })
      .expect(202);

    delete process.env.WECOM_FORCE_DATA_UNAVAILABLE;

    await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_deg_003',
        senderId: 'wx_sales_director',
        messageId: 'msg_deg_004',
        messageText: '本月各销售负责人新增商机金额排名',
      })
      .expect(202);

    expect(
      appStorageService.state.auditEvents.some(
        (item) => item.eventType === 'MAINTENANCE_RECOVERED',
      ),
    ).toBe(true);
  });
});

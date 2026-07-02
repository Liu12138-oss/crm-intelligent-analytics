import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppStorageService } from '../../src/database/app-storage/app-storage.service';
import { CrmReadonlyService } from '../../src/database/crm-readonly/crm-readonly.service';
import { SalesLeaderMappingService } from '../../src/modules/daily-report/sales-leader-mapping.service';
import { createTestApp } from '../test-app';

describe('wecom daily report preview integration', () => {
  let app: INestApplication;
  let appStorageService: AppStorageService;
  let crmReadonlyService: CrmReadonlyService;
  let salesLeaderMappingService: SalesLeaderMappingService;

  function getCurrentBusinessDate(): string {
    return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  function seedCompletedFollowUpWriteback(options?: {
    businessDate?: string;
    requesterId?: string;
    requesterName?: string;
    objectId?: string;
    objectTitle?: string;
    customerName?: string;
    idSuffix?: string;
  }): string {
    const businessDate = options?.businessDate ?? getCurrentBusinessDate();
    const requesterId = options?.requesterId ?? 'user_sales_director';
    const requesterName = options?.requesterName ?? '销售总监';
    const idSuffix = options?.idSuffix ?? '001';
    appStorageService.state.pendingFollowUpWritebacks.unshift({
      id: `follow_up_preview_${idSuffix}`,
      sessionId: `session_preview_${idSuffix}`,
      requesterId,
      requesterName,
      sourceReceiptId: `receipt_preview_${idSuffix}`,
      sourceMessageId: `msg_preview_${idSuffix}`,
      sourceQueryText: '日报预览',
      objectType: 'Opportunity',
      objectId: options?.objectId ?? 'opp_001',
      objectTitle: options?.objectTitle ?? '山东农信续约',
      opportunityId: options?.objectId ?? 'opp_001',
      opportunityTitle: options?.objectTitle ?? '山东农信续约',
      customerName: options?.customerName ?? '山东农信',
      structuredFollowUpContent: '推进了续约商务条款确认，客户倾向本周内完成审批。',
      structuredHelpNeeded: '需要区域经理协助确认最终折扣底线。',
      structuredInformationShare: '客户对交付周期比价格更敏感。',
      structuredVisitPlan: '明天下午继续约客户采购负责人沟通签约节奏。',
      ownerId: requesterId,
      ownerName: requesterName,
      draftContent:
        `【${requesterName}】：\n` +
        '跟进内容：推进了续约商务条款确认，客户倾向本周内完成审批。\n' +
        '遇到与协助：需要区域经理协助确认最终折扣底线。\n' +
        '信息共享：客户对交付周期比价格更敏感。\n' +
        '拜访计划：明天下午继续约客户采购负责人沟通签约节奏。',
      status: 'COMPLETED',
      idempotencyKey: `preview-follow-up-${idSuffix}`,
      confirmedWriteIntentAt: `${businessDate}T10:00:00.000Z`,
      confirmedContentAt: `${businessDate}T10:01:00.000Z`,
      writtenAt: `${businessDate}T10:02:00.000Z`,
      externalRevisitLogId: `revisit_preview_${idSuffix}`,
      createdAt: `${businessDate}T10:00:00.000Z`,
      updatedAt: `${businessDate}T10:02:00.000Z`,
    });

    return businessDate;
  }

  function mockLeaderGroup(): void {
    const actor = crmReadonlyService.listUsers().find((item) => item.id === 'user_sales_vp');
    const member = crmReadonlyService.listUsers().find(
      (item) => item.id === 'user_sales_director',
    );
    if (!actor || !member) {
      throw new Error('测试用户未找到，无法构造王文定小组映射。');
    }

    jest.spyOn(salesLeaderMappingService, 'listMappedSalesGroups').mockResolvedValue([
      {
        area: '北区金融部',
        region: '北区金融部-王文定',
        leaderName: '王文定',
        leader: {
          ...actor,
          id: 'leader_wang',
          name: '王文定',
          supervisorId: 'user_sales_vp',
          supervisorName: '销售副总',
        },
        members: [member],
      },
    ]);
  }

  beforeEach(async () => {
    app = await createTestApp();
    appStorageService = app.get(AppStorageService);
    crmReadonlyService = app.get(CrmReadonlyService);
    salesLeaderMappingService = app.get(SalesLeaderMappingService);
  });

  afterEach(async () => {
    await app.close();
  });

  it('用户主动要求查看今日日报时，应返回当天自动日报摘要', async () => {
    const businessDate = seedCompletedFollowUpWriteback({ idSuffix: '001' });

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_daily_report_preview_001',
        senderId: 'wx_sales_director',
        messageId: 'msg_daily_report_preview_001',
        messageText: '查看我今天的日报',
      })
      .expect(202);

    expect(response.body.status).toBe('DAILY_REPORT_PREVIEW_RETURNED');
    expect(
      appStorageService.state.wecomDeliveryRecords.some(
        (item) =>
          item.receiptId === response.body.receiptId &&
          item.contentPreview.includes(`这是你 ${businessDate} 的日报预览`),
      ),
    ).toBe(true);
    expect(
      appStorageService.state.wecomDeliveryRecords.some(
        (item) =>
          item.receiptId === response.body.receiptId &&
          item.contentPreview.includes('【销售总监日报】'),
      ),
    ).toBe(true);
  });

  it('用户只说“今天日报”时，也应命中日报预览链路', async () => {
    const businessDate = seedCompletedFollowUpWriteback({ idSuffix: '002' });

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_daily_report_preview_003',
        senderId: 'wx_sales_director',
        messageId: 'msg_daily_report_preview_003',
        messageText: '今天日报',
      })
      .expect(202);

    expect(response.body.status).toBe('DAILY_REPORT_PREVIEW_RETURNED');
    expect(
      appStorageService.state.wecomDeliveryRecords.some(
        (item) =>
          item.receiptId === response.body.receiptId &&
          item.contentPreview.includes(`这是你 ${businessDate} 的日报预览`),
      ),
    ).toBe(true);
  });

  it('当天还没有日报数据时，应返回空日报提示', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_daily_report_preview_002',
        senderId: 'wx_region_manager',
        messageId: 'msg_daily_report_preview_002',
        messageText: '输出我今天的日报',
      })
      .expect(202);

    expect(response.body.status).toBe('DAILY_REPORT_PREVIEW_RETURNED');
    expect(
      appStorageService.state.wecomDeliveryRecords.some(
        (item) =>
          item.receiptId === response.body.receiptId &&
        item.contentPreview.includes('今天还没有可汇总的日报内容'),
      ),
    ).toBe(true);
  });

  it('显式索取指定负责人小组日报且未写今天时，应默认返回当天预览且不触发正式汇总', async () => {
    const businessDate = seedCompletedFollowUpWriteback({ idSuffix: 'team_001' });
    mockLeaderGroup();
    const reportCountBefore = appStorageService.state.dailyReports.length;

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_team_daily_report_preview_001',
        senderId: 'wx_sales_vp',
        messageId: 'msg_team_daily_report_preview_001',
        messageText: '把王文定小组日报发给我',
      })
      .expect(202);

    expect(response.body.status).toBe('DAILY_REPORT_PREVIEW_RETURNED');
    expect(
      appStorageService.state.wecomDeliveryRecords.some(
        (item) =>
          item.receiptId === response.body.receiptId &&
          item.contentPreview.includes(`这是王文定小组 ${businessDate} 的日报预览`),
      ),
    ).toBe(true);
    expect(
      appStorageService.state.wecomDeliveryRecords.some(
        (item) =>
          item.receiptId === response.body.receiptId &&
          item.contentPreview.includes('【王文定小组日报分析】'),
      ),
    ).toBe(true);
    expect(appStorageService.state.proactiveNotificationTasks).toHaveLength(0);
    expect(appStorageService.state.dailyReportSummaryBatches).toHaveLength(0);
    expect(appStorageService.state.dailyReports.length).toBe(reportCountBefore);
  });

  it('无权限查看其他负责人小组日报时，应返回明确提示', async () => {
    seedCompletedFollowUpWriteback({ idSuffix: 'team_002' });
    mockLeaderGroup();

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_team_daily_report_preview_002',
        senderId: 'wx_sales_director',
        messageId: 'msg_team_daily_report_preview_002',
        messageText: '请把王文定小组今天的日报发给我',
      })
      .expect(202);

    expect(response.body.status).toBe('DAILY_REPORT_PREVIEW_RETURNED');
    expect(
      appStorageService.state.wecomDeliveryRecords.some(
        (item) =>
          item.receiptId === response.body.receiptId &&
          item.contentPreview.includes('暂时不能查看王文定小组今天的日报'),
      ),
    ).toBe(true);
  });

  it('负责人未命中时，应返回补充负责人姓名提示', async () => {
    mockLeaderGroup();

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_team_daily_report_preview_003',
        senderId: 'wx_sales_vp',
        messageId: 'msg_team_daily_report_preview_003',
        messageText: '请把未知负责人小组今天的日报发给我',
      })
      .expect(202);

    expect(response.body.status).toBe('DAILY_REPORT_PREVIEW_RETURNED');
    expect(
      appStorageService.state.wecomDeliveryRecords.some(
        (item) =>
          item.receiptId === response.body.receiptId &&
          item.contentPreview.includes('我暂时没识别到“未知负责人”对应的销售负责人小组'),
      ),
    ).toBe(true);
  });

  it('目标小组当天暂无可汇总内容时，应返回小组空状态预览', async () => {
    const businessDate = getCurrentBusinessDate();
    mockLeaderGroup();

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_team_daily_report_preview_004',
        senderId: 'wx_sales_vp',
        messageId: 'msg_team_daily_report_preview_004',
        messageText: '请把王文定小组今天的日报发给我',
      })
      .expect(202);

    expect(response.body.status).toBe('DAILY_REPORT_PREVIEW_RETURNED');
    expect(
      appStorageService.state.wecomDeliveryRecords.some(
        (item) =>
          item.receiptId === response.body.receiptId &&
          item.contentPreview.includes('当前小组今天还没有可汇总的日报内容'),
      ),
    ).toBe(true);
    expect(
      appStorageService.state.wecomDeliveryRecords.some(
        (item) =>
          item.receiptId === response.body.receiptId &&
          item.contentPreview.includes(`这是王文定小组 ${businessDate} 的日报预览`),
      ),
    ).toBe(true);
  });

  it('撤销日报预览动作后，企业微信预览请求应被阻断', async () => {
    appStorageService.state.rolePermissions = appStorageService.state.rolePermissions.map((item) =>
      item.roleId === 'role_sales_director'
        ? {
            ...item,
            actionKeys: item.actionKeys.filter((actionKey) => actionKey !== 'wecom.daily_report.preview'),
          }
        : item,
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/wecom/messages')
      .set('x-wecom-signature', 'test-signature')
      .set('x-wecom-source', 'wecom-bot')
      .send({
        externalConversationId: 'conv_daily_report_preview_denied_001',
        senderId: 'wx_sales_director',
        messageId: 'msg_daily_report_preview_denied_001',
        messageText: '查看我今天的日报',
      })
      .expect(403);

    expect(String(response.body.message)).toContain('无权查看日报预览');
  });
});

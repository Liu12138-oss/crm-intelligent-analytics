import type { INestApplication } from '@nestjs/common';
import { AppStorageService } from '../../src/database/app-storage/app-storage.service';
import { CrmReadonlyService } from '../../src/database/crm-readonly/crm-readonly.service';
import { WecomAppMessageService } from '../../src/modules/notifications/wecom-app-message.service';
import { WecomBotNotificationService } from '../../src/modules/notifications/wecom-bot-notification.service';
import { ProactiveNotificationService } from '../../src/modules/notifications/proactive-notification.service';
import { createTestApp } from '../test-app';

describe('proactive notification integration', () => {
  let app: INestApplication;
  let appStorageService: AppStorageService;
  let crmReadonlyService: CrmReadonlyService;
  let wecomAppMessageService: WecomAppMessageService;
  let wecomBotNotificationService: WecomBotNotificationService;
  let proactiveNotificationService: ProactiveNotificationService;

  beforeAll(async () => {
    app = await createTestApp();
    appStorageService = app.get(AppStorageService);
    crmReadonlyService = app.get(CrmReadonlyService);
    wecomAppMessageService = app.get(WecomAppMessageService);
    wecomBotNotificationService = app.get(WecomBotNotificationService);
    proactiveNotificationService = app.get(ProactiveNotificationService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    appStorageService.state.proactiveNotificationTasks = [];
    appStorageService.state.auditEvents = [];
  });

  it('日报固定周期通知默认应走企业微信自建应用消息并在测试模式下改投测试收件人', async () => {
    const actor = crmReadonlyService.listUsers().find((item) => item.id === 'user_sales_director');
    expect(actor).toBeTruthy();

    const result = await proactiveNotificationService.dispatch({
      actor: actor!,
      sceneKey: 'daily-report.missing-source-reminder',
      title: '测试日报提醒',
      audience: {
        type: 'CRM_USER',
        crmUserIds: ['user_region_manager'],
      },
      message: {
        msgtype: 'markdown',
        content: '日报提醒内容',
      },
      dedupeKey: 'daily_report_notify_001',
      metadata: {
        deliveryClass: 'SYSTEM_SCHEDULED',
      },
    });

    expect(result.resolvedChannel).toBe('WECOM_APP_MESSAGE');
    expect(result.status).toBe('SENT');
    expect(result.testModeApplied).toBe(true);
    expect(result.markdownContent).toContain('【日报提醒】 测试日报提醒');
    expect(result.metadata).toMatchObject({
      deliveryClass: 'SYSTEM_SCHEDULED',
      notificationLabel: '【日报提醒】',
      interactionMode: 'DETACHED_UNTIL_INTERACTION',
    });
    expect(
      result.recipientSnapshots.some(
        (item) =>
          item.status === 'TEST_OVERRIDDEN' &&
          item.chatType === 'single' &&
          item.deliveryTargetId === 'WangLiang02',
      ),
    ).toBe(true);
    expect(result.attempts[0]?.status).toBe('SENT');
    expect(result.attempts[0]?.channel).toBe('WECOM_APP_MESSAGE');
  });

  it('会话型通知默认应走机器人主动推送', async () => {
    const actor = crmReadonlyService.listUsers().find((item) => item.id === 'user_sales_director');
    expect(actor).toBeTruthy();

    const result = await proactiveNotificationService.dispatch({
      actor: actor!,
      sceneKey: 'notify.conversation.result',
      title: '机器人异步结果回推',
      kind: 'CONVERSATION_CONTEXT',
      audience: {
        type: 'WECOM_CONVERSATION',
        deliveryTargetId: 'conversation_group_001',
        chatType: 'group',
        senderId: 'wx_sales_director',
        externalConversationId: 'conversation_group_001',
      },
      message: {
        msgtype: 'markdown',
        content: '异步结果已完成',
      },
    });

    expect(result.resolvedChannel).toBe('WECOM_BOT_MESSAGE');
    expect(result.status).toBe('SENT');
    expect(result.markdownContent).toContain('【异步结果】 机器人异步结果回推');
    expect(result.markdownContent).toContain('可执行动作：查看详情 / 继续处理');
    expect(
      result.recipientSnapshots.some(
        (item) =>
          item.status === 'TEST_OVERRIDDEN' &&
          item.chatType === 'single' &&
          item.deliveryTargetId === 'WangLiang02',
      ),
    ).toBe(true);
  });

  it('发送适配器抛出异常时应将主动通知落为失败并写入失败审计', async () => {
    const actor = crmReadonlyService.listUsers().find((item) => item.id === 'user_sales_director');
    expect(actor).toBeTruthy();
    jest.spyOn(wecomAppMessageService, 'sendMessage').mockRejectedValueOnce(
      new Error('适配器未捕获异常'),
    );

    const result = await proactiveNotificationService.dispatch({
      actor: actor!,
      sceneKey: 'daily-report.missing-source-reminder',
      title: '异常兜底测试',
      audience: {
        type: 'WECOM_USER',
        wecomUserIds: ['wx_user_001'],
      },
      message: {
        msgtype: 'markdown',
        content: '异常兜底内容',
      },
      metadata: {
        deliveryClass: 'SYSTEM_SCHEDULED',
      },
    });

    expect(result.status).toBe('FAILED');
    expect(result.failureReason).toContain('适配器未捕获异常');
    expect(result.attempts[0]).toMatchObject({
      channel: 'WECOM_APP_MESSAGE',
      status: 'FAILED',
    });
    expect(appStorageService.state.auditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: 'PROACTIVE_NOTIFICATION_FAILED',
          sessionSnapshot: expect.objectContaining({
            notificationTaskId: result.id,
            resolvedChannel: 'WECOM_APP_MESSAGE',
            failedCount: 1,
          }),
        }),
      ]),
    );
  });

  it('频率限制失败审计应保留外部错误码和中文归因', async () => {
    const actor = crmReadonlyService.listUsers().find((item) => item.id === 'user_sales_director');
    expect(actor).toBeTruthy();
    jest.spyOn(wecomBotNotificationService, 'sendMessage').mockResolvedValueOnce({
      status: 'FAILED',
      failureReason: '企业微信机器人发送频率超限',
      externalErrorCode: '846607',
      externalErrorMessage: 'aibot send msg frequency limit exceeded',
      retryStrategy: 'RATE_LIMIT_BACKOFF',
      retryAfterMs: 60000,
    });

    const result = await proactiveNotificationService.dispatch({
      actor: actor!,
      sceneKey: 'notify.conversation.rate-limit',
      title: '机器人频率限制',
      kind: 'CONVERSATION_CONTEXT',
      audience: {
        type: 'WECOM_CONVERSATION',
        deliveryTargetId: 'conversation_group_002',
        chatType: 'group',
        senderId: 'wx_sales_director',
        externalConversationId: 'conversation_group_002',
      },
      message: {
        msgtype: 'markdown',
        content: '频率限制内容',
      },
    });

    expect(result.status).toBe('FAILED');
    expect(result.failureReason).toBe('企业微信机器人发送频率超限');
    expect(result.attempts[0]).toMatchObject({
      externalErrorCode: '846607',
      externalErrorMessage: 'aibot send msg frequency limit exceeded',
      retryStrategy: 'RATE_LIMIT_BACKOFF',
    });
    expect(appStorageService.state.auditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: 'PROACTIVE_NOTIFICATION_FAILED',
          sessionSnapshot: expect.objectContaining({
            externalErrorCode: '846607',
            failureReason: '企业微信机器人发送频率超限',
            retryCount: 0,
          }),
        }),
      ]),
    );
  });

  it('相同 dedupeKey 再次投递时应命中幂等保护', async () => {
    const actor = crmReadonlyService.listUsers().find((item) => item.id === 'user_sales_director');
    expect(actor).toBeTruthy();

    const firstTask = await proactiveNotificationService.dispatch({
      actor: actor!,
      sceneKey: 'notify.formal.dedupe',
      title: '幂等测试',
      audience: {
        type: 'CRM_USER',
        crmUserIds: ['user_region_manager'],
      },
      message: {
        msgtype: 'markdown',
        content: '第一次发送',
      },
      dedupeKey: 'formal_notify_dedupe_001',
    });

    const secondTask = await proactiveNotificationService.dispatch({
      actor: actor!,
      sceneKey: 'notify.formal.dedupe',
      title: '幂等测试',
      audience: {
        type: 'CRM_USER',
        crmUserIds: ['user_region_manager'],
      },
      message: {
        msgtype: 'markdown',
        content: '第二次发送',
      },
      dedupeKey: 'formal_notify_dedupe_001',
    });

    expect(firstTask.status).toBe('SENT');
    expect(secondTask.status).toBe('DEDUPED');
    expect(secondTask.duplicateOfTaskId).toBe(firstTask.id);
    expect(secondTask.resolvedChannel).toBe('WECOM_APP_MESSAGE');
  });

  it('接收人权限校验失败时应阻断发送', async () => {
    const actor = crmReadonlyService.listUsers().find((item) => item.id === 'user_sales_director');
    expect(actor).toBeTruthy();

    const result = await proactiveNotificationService.dispatch({
      actor: actor!,
      sceneKey: 'notify.formal.blocked',
      title: '权限阻断测试',
      audience: {
        type: 'CRM_USER',
        crmUserIds: ['user_region_manager'],
      },
      message: {
        msgtype: 'markdown',
        content: '不可发送内容',
      },
      recipientGuard: () => ({
        allowed: false,
        reason: '当前接收人不具备查看该通知内容的权限。',
      }),
    });

    expect(result.status).toBe('BLOCKED');
    expect(String(result.failureReason)).toContain('不具备查看该通知内容的权限');
  });
});

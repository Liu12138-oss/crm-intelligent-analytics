import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { CrmReadonlyService } from '../../src/database/crm-readonly/crm-readonly.service';
import { AppStorageService } from '../../src/database/app-storage/app-storage.service';
import { DailyReportService } from '../../src/modules/daily-report/daily-report.service';
import { SalesLeaderMappingService } from '../../src/modules/daily-report/sales-leader-mapping.service';
import { LocalRuntimeConfigService } from '../../src/shared/config/local-runtime-config.service';
import { loginAs } from '../auth-test.helper';
import { createTestApp } from '../test-app';

describe('daily report integration', () => {
  let app: INestApplication;
  let appStorageService: AppStorageService;
  let localRuntimeConfigService: LocalRuntimeConfigService;
  let crmReadonlyService: CrmReadonlyService;
  let dailyReportService: DailyReportService;
  let salesLeaderMappingService: SalesLeaderMappingService;

  beforeEach(async () => {
    app = await createTestApp();
    appStorageService = app.get(AppStorageService);
    localRuntimeConfigService = app.get(LocalRuntimeConfigService);
    crmReadonlyService = app.get(CrmReadonlyService);
    dailyReportService = app.get(DailyReportService);
    salesLeaderMappingService = app.get(SalesLeaderMappingService);
  });

  afterEach(async () => {
    await app.close();
  });

  function resetDailyReportConfigCache(): void {
    (
      localRuntimeConfigService as unknown as {
        dailyReportRuntimeConfigCache?: unknown;
      }
    ).dailyReportRuntimeConfigCache = undefined;
  }

  async function createCompleteReport(options?: {
    businessDate?: string;
    supervisorId?: string;
    supervisorName?: string;
    helpContent?: string;
  }) {
    const cookies = await loginAs(app, 'user_sales_director');
    const businessDate = options?.businessDate ?? '2026-04-05';
    const supervisorId = options?.supervisorId ?? 'user_region_manager';
    const supervisorName = options?.supervisorName ?? '区域经理';
    const sections = [
      ['TODAY_FOLLOW_UP', '上午拜访了 XX 科技，推进 SaaS 续签。'],
      ['CUSTOMER_OR_OPPORTUNITY_CHANGE', 'XX 动力项目预计下周二 POC。'],
      ['HELP_REQUIRED', options?.helpContent ?? '需要区域主管协助折扣审批。'],
      ['INFORMATION_SHARE', '项目方对产品演示反馈积极。'],
      ['TOMORROW_PLAN', '明天继续跟进 POC 计划与折扣申请。'],
    ] as const;

    let reportId = '';
    let lastResponseBody: any = {};

    for (const [fragmentType, content] of sections) {
      const sourceInterface =
        fragmentType === 'TODAY_FOLLOW_UP'
          ? '/api/v2/revisit_logs'
          : fragmentType === 'CUSTOMER_OR_OPPORTUNITY_CHANGE'
            ? '/api/v2/opportunities'
            : 'manual';
      const response = await request(app.getHttpServer())
        .post('/api/v1/daily-reports/fragments')
        .set('Cookie', cookies)
        .send({
          fragmentType,
          content,
          businessDate,
          supervisorId,
          supervisorName,
          sourceLabel: '企业微信日报收口',
          sourceInterface,
          sourceObjectId:
            sourceInterface === '/api/v2/opportunities'
              ? 'opp_001'
              : sourceInterface === '/api/v2/revisit_logs'
                ? 'revisit_001'
                : undefined,
          sourceOperatorId:
            sourceInterface === 'manual' ? undefined : 'user_sales_director',
          sourceOperatorName:
            sourceInterface === 'manual' ? undefined : '销售总监',
          sourceCode: 0,
          capturedAt: '2026-04-05T10:00:00.000Z',
        })
        .expect(201);
      reportId = response.body.id;
      lastResponseBody = response.body;
    }

    return {
      cookies,
      businessDate,
      supervisorId,
      supervisorName,
      reportId,
      lastResponseBody,
    };
  }

  it('应按五类片段生成待确认日报并在确认后推送主管', async () => {
    const { cookies, businessDate, reportId, lastResponseBody } =
      await createCompleteReport();

    expect(lastResponseBody.status).toBe('PENDING_CONFIRMATION');
    expect(lastResponseBody.sectionTypes.length).toBe(5);
    expect(String(lastResponseBody.draftSummary)).toContain('计划');

    const confirmed = await request(app.getHttpServer())
      .post(`/api/v1/daily-reports/${reportId}/confirm`)
      .set('Cookie', cookies)
      .send({ confirmedAt: '2026-04-05T13:30:00.000Z' })
      .expect(201);

    expect(confirmed.body.status).toBe('CONFIRMED');
    expect(confirmed.body.confirmation.confirmedBy).toBe('user_sales_director');
    expect(Array.isArray(confirmed.body.deliveries)).toBe(true);
    expect(confirmed.body.deliveries[0].targetUserId).toBe('user_region_manager');

    const audit = await request(app.getHttpServer())
      .get('/api/v1/daily-reports/audit')
      .set('Cookie', cookies)
      .query({ businessDate })
      .expect(200);

    expect(audit.body.length).toBe(1);
    expect(audit.body[0].status).toBe('CONFIRMED');
    expect(audit.body[0].deliveries.length).toBeGreaterThan(0);
    expect(audit.body[0].fragments[0].sourceInterface).toBe('/api/v2/revisit_logs');
    expect(audit.body[0].fragments[1].sourceInterface).toBe('/api/v2/opportunities');
  });

  it('22:00 有 CRM 数据时应自动生成日报并发给本人确认', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const businessDate = '2026-04-05';

    appStorageService.state.pendingFollowUpWritebacks.unshift({
      id: 'follow_up_completed_001',
      sessionId: 'session_daily_report_001',
      requesterId: 'user_sales_director',
      requesterName: '销售总监',
      sourceReceiptId: 'receipt_daily_report_001',
      sourceMessageId: 'msg_daily_report_001',
      sourceQueryText: '今天跟进了山东农信续约项目',
      objectType: 'Opportunity',
      objectId: 'opp_001',
      objectTitle: '山东农信续约',
      opportunityId: 'opp_001',
      opportunityTitle: '山东农信续约',
      customerName: '山东农信',
      structuredFollowUpContent: '推进了续约商务条款确认，客户倾向本周内完成审批。',
      structuredHelpNeeded: '需要区域经理协助确认最终折扣底线。',
      structuredInformationShare: '客户对交付周期比价格更敏感。',
      structuredVisitPlan: '明天下午继续约客户采购负责人沟通签约节奏。',
      ownerId: 'user_sales_director',
      ownerName: '销售总监',
      draftContent:
        '【销售总监】：\n跟进内容：推进了续约商务条款确认，客户倾向本周内完成审批。\n遇到与协助：需要区域经理协助确认最终折扣底线。\n信息共享：客户对交付周期比价格更敏感。\n拜访计划：明天下午继续约客户采购负责人沟通签约节奏。',
      status: 'COMPLETED',
      idempotencyKey: 'daily-report-follow-up-001',
      confirmedWriteIntentAt: '2026-04-05T12:00:00.000Z',
      confirmedContentAt: '2026-04-05T12:01:00.000Z',
      writtenAt: '2026-04-05T12:02:00.000Z',
      externalRevisitLogId: 'revisit_001',
      createdAt: '2026-04-05T12:00:00.000Z',
      updatedAt: '2026-04-05T12:02:00.000Z',
    });

    const sweepResponse = await request(app.getHttpServer())
      .post('/api/v1/daily-reports/cron/reminders')
      .set('Cookie', cookies)
      .send({
        businessDate,
        sentAt: '2026-04-05T22:00:00.000Z',
      })
      .expect(200);

    expect(sweepResponse.body).toHaveLength(1);
    expect(sweepResponse.body[0].requesterId).toBe('user_sales_director');
    expect(sweepResponse.body[0].status).toBe('PENDING_CONFIRMATION');
    expect(String(sweepResponse.body[0].draftSummary)).toContain('【销售总监日报】');
    expect(String(sweepResponse.body[0].draftSummary)).toContain('1、当日工作执行结果');
    expect(String(sweepResponse.body[0].draftSummary)).toContain('2、问题与协助');
    expect(String(sweepResponse.body[0].draftSummary)).toContain('3、信息分享');
    expect(String(sweepResponse.body[0].draftSummary)).toContain('4、计划');
    expect(String(sweepResponse.body[0].draftSummary)).toContain(
      '①商机「山东农信续约」：推进了续约商务条款确认，客户倾向本周内完成审批。',
    );
    expect(String(sweepResponse.body[0].draftSummary)).toContain(
      '①商机「山东农信续约」：需要区域经理协助确认最终折扣底线。',
    );
    expect(String(sweepResponse.body[0].draftSummary)).toContain(
      '①商机「山东农信续约」：客户对交付周期比价格更敏感。',
    );
    expect(String(sweepResponse.body[0].draftSummary)).toContain(
      '①商机「山东农信续约」：明天下午继续约客户采购负责人沟通签约节奏。',
    );
    expect(String(sweepResponse.body[0].draftSummary)).toContain('5、AI摘要');
    expect(String(sweepResponse.body[0].draftSummary)).toContain('grounded');
    expect(sweepResponse.body[0].aiInsightSnapshot).toEqual(
      expect.objectContaining({
        scene: 'PERSONAL_CONFIRMATION',
        grounded: true,
        degraded: false,
      }),
    );
    expect(sweepResponse.body[0].deliveries[0].targetUserId).toBe('user_sales_director');
    expect(sweepResponse.body[0].deliveries[0].deliveryType).toBe('PERSONAL_CONFIRMATION');

    expect(appStorageService.state.proactiveNotificationTasks).toHaveLength(1);
    expect(
      String(appStorageService.state.proactiveNotificationTasks[0].markdownContent),
    ).toContain('【销售总监日报】');
    expect(
      String(appStorageService.state.proactiveNotificationTasks[0].markdownContent),
    ).not.toContain('可执行动作：');
    expect(
      String(appStorageService.state.proactiveNotificationTasks[0].markdownContent),
    ).toContain('如果内容没问题，请忽略本条消息');
  });

  it('22:00 AI 可用时应优先采用 AI 个人日报摘要内容', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const businessDate = '2026-04-05';
    const aiGateway = dailyReportService['aiGatewayService'] as unknown as {
      generateDailyReportGroundedInsight: jest.Mock;
    };
    const aiDailyInsightSpy = jest.spyOn(
      aiGateway,
      'generateDailyReportGroundedInsight',
    );
    aiDailyInsightSpy.mockResolvedValue({
      summaryLines: [
        'AI摘要：今日推进焦点集中在山东农信续约，整体节奏清晰。',
        'AI摘要：建议优先确认折扣底线与 POC 时间。',
      ],
    });

    appStorageService.state.pendingFollowUpWritebacks.unshift({
      id: 'follow_up_completed_ai_personal_001',
      sessionId: 'session_daily_report_ai_personal_001',
      requesterId: 'user_sales_director',
      requesterName: '销售总监',
      sourceReceiptId: 'receipt_daily_report_ai_personal_001',
      sourceMessageId: 'msg_daily_report_ai_personal_001',
      sourceQueryText: '今天跟进了山东农信续约项目',
      objectType: 'Opportunity',
      objectId: 'opp_001',
      objectTitle: '山东农信续约',
      opportunityId: 'opp_001',
      opportunityTitle: '山东农信续约',
      customerName: '山东农信',
      structuredFollowUpContent: '推进了续约商务条款确认，客户倾向本周内完成审批。',
      structuredHelpNeeded: '需要区域经理协助确认最终折扣底线。',
      structuredInformationShare: '客户对交付周期比价格更敏感。',
      structuredVisitPlan: '明天下午继续约客户采购负责人沟通签约节奏。',
      ownerId: 'user_sales_director',
      ownerName: '销售总监',
      draftContent:
        '【销售总监】：\n跟进内容：推进了续约商务条款确认，客户倾向本周内完成审批。\n遇到与协助：需要区域经理协助确认最终折扣底线。\n信息共享：客户对交付周期比价格更敏感。\n拜访计划：明天下午继续约客户采购负责人沟通签约节奏。',
      status: 'COMPLETED',
      idempotencyKey: 'daily-report-ai-personal-001',
      confirmedWriteIntentAt: '2026-04-05T12:00:00.000Z',
      confirmedContentAt: '2026-04-05T12:01:00.000Z',
      writtenAt: '2026-04-05T12:02:00.000Z',
      externalRevisitLogId: 'revisit_ai_personal_001',
      createdAt: '2026-04-05T12:00:00.000Z',
      updatedAt: '2026-04-05T12:02:00.000Z',
    });

    const sweepResponse = await request(app.getHttpServer())
      .post('/api/v1/daily-reports/cron/reminders')
      .set('Cookie', cookies)
      .send({
        businessDate,
        sentAt: '2026-04-05T22:00:00.000Z',
      })
      .expect(200);

    expect(String(sweepResponse.body[0].draftSummary)).toContain(
      'AI摘要：今日推进焦点集中在山东农信续约，整体节奏清晰。',
    );
    expect(String(sweepResponse.body[0].draftSummary)).toContain(
      'AI摘要：建议优先确认折扣底线与 POC 时间。',
    );
  });

  it('22:00 自动汇总遇到非模板手工跟进时，应将全文视为跟进内容且其余三段显示无', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const businessDate = '2026-04-05';

    appStorageService.state.pendingFollowUpWritebacks.unshift({
      id: 'follow_up_completed_freeform_001',
      sessionId: 'session_daily_report_freeform_001',
      requesterId: 'user_sales_director',
      requesterName: '销售总监',
      sourceReceiptId: 'receipt_daily_report_freeform_001',
      sourceMessageId: 'msg_daily_report_freeform_001',
      sourceQueryText: '后台手工填写自由文本跟进',
      objectType: 'Opportunity',
      objectId: 'opp_001',
      objectTitle: '山东农信续约',
      opportunityId: 'opp_001',
      opportunityTitle: '山东农信续约',
      customerName: '山东农信',
      ownerId: 'user_sales_director',
      ownerName: '销售总监',
      draftContent: '【销售总监】：\n测试测试',
      status: 'COMPLETED',
      idempotencyKey: 'daily-report-freeform-001',
      confirmedWriteIntentAt: '2026-04-05T12:00:00.000Z',
      confirmedContentAt: '2026-04-05T12:01:00.000Z',
      writtenAt: '2026-04-05T12:02:00.000Z',
      externalRevisitLogId: 'revisit_freeform_001',
      createdAt: '2026-04-05T12:00:00.000Z',
      updatedAt: '2026-04-05T12:02:00.000Z',
    });

    const sweepResponse = await request(app.getHttpServer())
      .post('/api/v1/daily-reports/cron/reminders')
      .set('Cookie', cookies)
      .send({
        businessDate,
        sentAt: '2026-04-05T22:00:00.000Z',
      })
      .expect(200);

    const draftSummary = String(sweepResponse.body[0].draftSummary);
    expect(draftSummary).toContain('①商机「山东农信续约」：测试测试');
    expect(draftSummary).toContain('2、问题与协助\n无');
    expect(draftSummary).toContain('3、信息分享\n无');
    expect(draftSummary).toContain('4、计划\n无');
  });

  it('同一商机重复写跟进时，22:00 自动日报应综合成一条', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const businessDate = '2026-04-05';

    appStorageService.state.pendingFollowUpWritebacks.unshift(
      {
        id: 'follow_up_completed_aggregate_002',
        sessionId: 'session_daily_report_aggregate_002',
        requesterId: 'user_sales_director',
        requesterName: '销售总监',
        sourceReceiptId: 'receipt_daily_report_aggregate_002',
        sourceMessageId: 'msg_daily_report_aggregate_002',
        sourceQueryText: '第二次补充同一个商机跟进',
        objectType: 'Opportunity',
        objectId: 'opp_001',
        objectTitle: '山东农信续约',
        opportunityId: 'opp_001',
        opportunityTitle: '山东农信续约',
        customerName: '山东农信',
        structuredFollowUpContent: '客户已确认下周安排 POC 测试资源。',
        structuredHelpNeeded: '需要产品同事同步 POC 资源排期。',
        structuredInformationShare: '客户优先关注测试资源投入效率。',
        structuredVisitPlan: '明天继续确认测试时间窗。',
        ownerId: 'user_sales_director',
        ownerName: '销售总监',
        draftContent:
          '【销售总监】：\n跟进内容：客户已确认下周安排 POC 测试资源。\n遇到与协助：需要产品同事同步 POC 资源排期。\n信息共享：客户优先关注测试资源投入效率。\n拜访计划：明天继续确认测试时间窗。',
        status: 'COMPLETED',
        idempotencyKey: 'daily-report-follow-up-aggregate-002',
        confirmedWriteIntentAt: '2026-04-05T13:00:00.000Z',
        confirmedContentAt: '2026-04-05T13:01:00.000Z',
        writtenAt: '2026-04-05T13:02:00.000Z',
        externalRevisitLogId: 'revisit_aggregate_002',
        createdAt: '2026-04-05T13:00:00.000Z',
        updatedAt: '2026-04-05T13:02:00.000Z',
      },
      {
        id: 'follow_up_completed_aggregate_001',
        sessionId: 'session_daily_report_aggregate_001',
        requesterId: 'user_sales_director',
        requesterName: '销售总监',
        sourceReceiptId: 'receipt_daily_report_aggregate_001',
        sourceMessageId: 'msg_daily_report_aggregate_001',
        sourceQueryText: '第一次写同一个商机跟进',
        objectType: 'Opportunity',
        objectId: 'opp_001',
        objectTitle: '山东农信续约',
        opportunityId: 'opp_001',
        opportunityTitle: '山东农信续约',
        customerName: '山东农信',
        structuredFollowUpContent: '今天先完成了商务条款确认。',
        structuredHelpNeeded: '需要区域经理协助确认折扣边界。',
        structuredInformationShare: '客户对交付节奏较敏感。',
        structuredVisitPlan: '明天继续确认商务条款。',
        ownerId: 'user_sales_director',
        ownerName: '销售总监',
        draftContent:
          '【销售总监】：\n跟进内容：今天先完成了商务条款确认。\n遇到与协助：需要区域经理协助确认折扣边界。\n信息共享：客户对交付节奏较敏感。\n拜访计划：明天继续确认商务条款。',
        status: 'COMPLETED',
        idempotencyKey: 'daily-report-follow-up-aggregate-001',
        confirmedWriteIntentAt: '2026-04-05T10:00:00.000Z',
        confirmedContentAt: '2026-04-05T10:01:00.000Z',
        writtenAt: '2026-04-05T10:02:00.000Z',
        externalRevisitLogId: 'revisit_aggregate_001',
        createdAt: '2026-04-05T10:00:00.000Z',
        updatedAt: '2026-04-05T10:02:00.000Z',
      },
    );

    const sweepResponse = await request(app.getHttpServer())
      .post('/api/v1/daily-reports/cron/reminders')
      .set('Cookie', cookies)
      .send({
        businessDate,
        sentAt: '2026-04-05T22:00:00.000Z',
      })
      .expect(200);

    expect(String(sweepResponse.body[0].draftSummary)).toContain(
      '①商机「山东农信续约」：今天先完成了商务条款确认。；客户已确认下周安排 POC 测试资源。',
    );
    expect(String(sweepResponse.body[0].draftSummary)).not.toContain(
      '②商机「山东农信续约」',
    );
  });

  it('同一对象重复跟进时，信息分享中的占位词不应在日报预览里当成正文展示', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const businessDate = '2026-04-05';

    appStorageService.state.pendingFollowUpWritebacks.unshift(
      {
        id: 'follow_up_completed_share_placeholder_002',
        sessionId: 'session_daily_report_share_placeholder_002',
        requesterId: 'user_sales_director',
        requesterName: '销售总监',
        sourceReceiptId: 'receipt_daily_report_share_placeholder_002',
        sourceMessageId: 'msg_daily_report_share_placeholder_002',
        sourceQueryText: '第二次补充同一个客户跟进',
        objectType: 'Customer',
        objectId: 'cus_001',
        objectTitle: '海航集团有限公司',
        opportunityId: '',
        opportunityTitle: '',
        customerName: '海航集团有限公司',
        structuredFollowUpContent: '今天再次拜访了海航集团有限公司，补充沟通后续节奏。',
        structuredHelpNeeded: '无',
        structuredInformationShare: '暂无分享',
        structuredVisitPlan: '明天继续拜访海航集团有限公司。',
        ownerId: 'user_sales_director',
        ownerName: '销售总监',
        draftContent:
          '【销售总监】：\n跟进内容：今天再次拜访了海航集团有限公司，补充沟通后续节奏。\n遇到与协助：无\n信息共享：暂无分享\n拜访计划：明天继续拜访海航集团有限公司。',
        status: 'COMPLETED',
        idempotencyKey: 'daily-report-share-placeholder-002',
        confirmedWriteIntentAt: '2026-04-05T13:00:00.000Z',
        confirmedContentAt: '2026-04-05T13:01:00.000Z',
        writtenAt: '2026-04-05T13:02:00.000Z',
        externalRevisitLogId: 'revisit_share_placeholder_002',
        createdAt: '2026-04-05T13:00:00.000Z',
        updatedAt: '2026-04-05T13:02:00.000Z',
      },
      {
        id: 'follow_up_completed_share_placeholder_001',
        sessionId: 'session_daily_report_share_placeholder_001',
        requesterId: 'user_sales_director',
        requesterName: '销售总监',
        sourceReceiptId: 'receipt_daily_report_share_placeholder_001',
        sourceMessageId: 'msg_daily_report_share_placeholder_001',
        sourceQueryText: '第一次补充同一个客户跟进',
        objectType: 'Customer',
        objectId: 'cus_001',
        objectTitle: '海航集团有限公司',
        opportunityId: '',
        opportunityTitle: '',
        customerName: '海航集团有限公司',
        structuredFollowUpContent: '今天拜访了海航集团有限公司，简单聊聊。',
        structuredHelpNeeded: '无',
        structuredInformationShare: '有太多要分享了',
        structuredVisitPlan: '明天继续拜访海航集团有限公司。',
        ownerId: 'user_sales_director',
        ownerName: '销售总监',
        draftContent:
          '【销售总监】：\n跟进内容：今天拜访了海航集团有限公司，简单聊聊。\n遇到与协助：无\n信息共享：有太多要分享了\n拜访计划：明天继续拜访海航集团有限公司。',
        status: 'COMPLETED',
        idempotencyKey: 'daily-report-share-placeholder-001',
        confirmedWriteIntentAt: '2026-04-05T10:00:00.000Z',
        confirmedContentAt: '2026-04-05T10:01:00.000Z',
        writtenAt: '2026-04-05T10:02:00.000Z',
        externalRevisitLogId: 'revisit_share_placeholder_001',
        createdAt: '2026-04-05T10:00:00.000Z',
        updatedAt: '2026-04-05T10:02:00.000Z',
      },
    );

    const sweepResponse = await request(app.getHttpServer())
      .post('/api/v1/daily-reports/cron/reminders')
      .set('Cookie', cookies)
      .send({
        businessDate,
        sentAt: '2026-04-05T22:00:00.000Z',
      })
      .expect(200);

    expect(String(sweepResponse.body[0].draftSummary)).toContain('3、信息分享\n无');
    expect(String(sweepResponse.body[0].draftSummary)).not.toContain(
      '①客户「海航集团有限公司」：有太多要分享了',
    );
    expect(String(sweepResponse.body[0].draftSummary)).not.toContain('暂无分享');
  });

  it('日报预览展示时应过滤测试尾巴和泛化信息分享短语，但不影响原始写回记录', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const businessDate = '2026-04-05';

    appStorageService.state.pendingFollowUpWritebacks.unshift({
      id: 'follow_up_completed_display_noise_001',
      sessionId: 'session_daily_report_display_noise_001',
      requesterId: 'user_sales_director',
      requesterName: '销售总监',
      sourceReceiptId: 'receipt_daily_report_display_noise_001',
      sourceMessageId: 'msg_daily_report_display_noise_001',
      sourceQueryText: '补充海航集团跟进',
      objectType: 'Customer',
      objectId: 'cus_001',
      objectTitle: '海航集团有限公司',
      opportunityId: '',
      opportunityTitle: '',
      customerName: '海航集团有限公司',
      structuredFollowUpContent: '今天拜访了海航集团有限公司，简单聊聊。hhhh',
      structuredHelpNeeded: '无',
      structuredInformationShare: '这个案例场景可以分享，xxxxxxxxxxxxxtttttttt',
      structuredVisitPlan: '明天继续拜访海航集团有限公司。',
      ownerId: 'user_sales_director',
      ownerName: '销售总监',
      draftContent:
        '【销售总监】：\n跟进内容：今天拜访了海航集团有限公司，简单聊聊。hhhh\n遇到与协助：无\n信息共享：这个案例场景可以分享，xxxxxxxxxxxxxtttttttt\n拜访计划：明天继续拜访海航集团有限公司。',
      status: 'COMPLETED',
      idempotencyKey: 'daily-report-display-noise-001',
      confirmedWriteIntentAt: '2026-04-05T12:00:00.000Z',
      confirmedContentAt: '2026-04-05T12:01:00.000Z',
      writtenAt: '2026-04-05T12:02:00.000Z',
      externalRevisitLogId: 'revisit_display_noise_001',
      createdAt: '2026-04-05T12:00:00.000Z',
      updatedAt: '2026-04-05T12:02:00.000Z',
    });

    const sweepResponse = await request(app.getHttpServer())
      .post('/api/v1/daily-reports/cron/reminders')
      .set('Cookie', cookies)
      .send({
        businessDate,
        sentAt: '2026-04-05T22:00:00.000Z',
      })
      .expect(200);

    const draftSummary = String(sweepResponse.body[0].draftSummary);
    expect(draftSummary).toContain(
      '①客户「海航集团有限公司」：今天拜访了海航集团有限公司，简单聊聊',
    );
    expect(draftSummary).not.toContain('hhhh');
    expect(draftSummary).not.toContain('xxxxxxxx');
    expect(draftSummary).not.toContain('tttt');
    expect(draftSummary).not.toContain('这个案例场景可以分享');
    expect(draftSummary).toContain('3、信息分享\n无');
    expect(appStorageService.state.pendingFollowUpWritebacks[0].draftContent).toContain(
      '这个案例场景可以分享，xxxxxxxxxxxxxtttttttt',
    );
  });

  it('22:00 无 CRM 数据时应发送友好催报提醒', async () => {
    const cookies = await loginAs(app, 'user_region_manager');
    const businessDate = '2026-04-05';

    const sweepResponse = await request(app.getHttpServer())
      .post('/api/v1/daily-reports/cron/reminders')
      .set('Cookie', cookies)
      .send({
        businessDate,
        sentAt: '2026-04-05T22:00:00.000Z',
      })
      .expect(200);

    expect(sweepResponse.body).toHaveLength(0);
    expect(appStorageService.state.proactiveNotificationTasks).toHaveLength(1);
    expect(appStorageService.state.proactiveNotificationTasks[0].resolvedChannel).toBe(
      'WECOM_APP_MESSAGE',
    );
    expect(appStorageService.state.proactiveNotificationTasks[0].metadata).toMatchObject({
      deliveryClass: 'SYSTEM_SCHEDULED',
    });
    expect(
      String(appStorageService.state.proactiveNotificationTasks[0].markdownContent),
    ).toContain('晚上好，区域经理');
    expect(
      String(appStorageService.state.proactiveNotificationTasks[0].markdownContent),
    ).toContain('辛苦抽空补录一下');
    expect(
      String(appStorageService.state.proactiveNotificationTasks[0].markdownContent),
    ).not.toContain('可执行动作：');
    const reminderAudit = appStorageService.state.auditEvents.find(
      (item) => item.eventType === 'DAILY_REPORT_REMINDER_SENT',
    );
    expect(reminderAudit).toMatchObject({
      sessionSnapshot: expect.objectContaining({
        scheduledAt: '2026-04-05T22:00:00.000Z',
        notificationTaskId: appStorageService.state.proactiveNotificationTasks[0].id,
        resolvedChannel: 'WECOM_APP_MESSAGE',
        lastAttemptAt: expect.any(String),
      }),
    });
    expect(reminderAudit?.createdAt).not.toBe('2026-04-05T22:00:00.000Z');
  });

  it('日报正式对上发送时应同步通知协助人及其主管', async () => {
    const {
      cookies,
      reportId,
    } = await createCompleteReport({
      supervisorId: 'user_sales_vp',
      supervisorName: '销售副总',
      helpContent: '需要李四协助补充实施排期。',
    });

    const confirmed = await request(app.getHttpServer())
      .post(`/api/v1/daily-reports/${reportId}/confirm`)
      .set('Cookie', cookies)
      .send({ confirmedAt: '2026-04-05T13:30:00.000Z' })
      .expect(201);

    expect(confirmed.body.status).toBe('CONFIRMED');
    expect(appStorageService.state.proactiveNotificationTasks).toHaveLength(3);
    expect(
      appStorageService.state.proactiveNotificationTasks.map((item) => item.sceneKey),
    ).toEqual(
      expect.arrayContaining([
        'daily-report.supervisor-delivery',
        'daily-report.assistance-target',
        'daily-report.assistance-supervisor',
      ]),
    );
    const helperTask = appStorageService.state.proactiveNotificationTasks.find(
      (item) => item.sceneKey === 'daily-report.assistance-target',
    );
    const helperSupervisorTask =
      appStorageService.state.proactiveNotificationTasks.find(
        (item) => item.sceneKey === 'daily-report.assistance-supervisor',
      );
    expect(String(helperTask?.markdownContent)).toContain('需要李四协助补充实施排期');
    expect(String(helperSupervisorTask?.markdownContent)).toContain('你的成员 李四');
    expect(appStorageService.state.dailyReportAssistanceEscalations).toHaveLength(1);
    expect(appStorageService.state.dailyReportAssistanceEscalations[0].status).toBe(
      'SENT',
    );
    expect(appStorageService.state.dailyReportAssistanceEscalations[0].helperUserId).toBe(
      'user_product_li_si',
    );
    expect(
      appStorageService.state.dailyReportAssistanceEscalations[0]
        .helperSupervisorUserId,
    ).toBe('user_product_director');
  });

  it('22:00 本人确认草稿阶段不应提前触发协助升级通知', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const businessDate = '2026-04-05';

    appStorageService.state.pendingFollowUpWritebacks.unshift({
      id: 'follow_up_completed_assistance_preview_001',
      sessionId: 'session_daily_report_assistance_preview_001',
      requesterId: 'user_sales_director',
      requesterName: '销售总监',
      sourceReceiptId: 'receipt_daily_report_assistance_preview_001',
      sourceMessageId: 'msg_daily_report_assistance_preview_001',
      sourceQueryText: '今天跟进了山东农信续约项目',
      objectType: 'Opportunity',
      objectId: 'opp_001',
      objectTitle: '山东农信续约',
      opportunityId: 'opp_001',
      opportunityTitle: '山东农信续约',
      customerName: '山东农信',
      structuredFollowUpContent: '推进了续约商务条款确认。',
      structuredHelpNeeded: '需要李四协助补充实施排期。',
      structuredInformationShare: '客户更关注交付周期。',
      structuredVisitPlan: '明天下午继续沟通排期。',
      ownerId: 'user_sales_director',
      ownerName: '销售总监',
      draftContent:
        '【销售总监】：\n跟进内容：推进了续约商务条款确认。\n遇到与协助：需要李四协助补充实施排期。\n信息共享：客户更关注交付周期。\n拜访计划：明天下午继续沟通排期。',
      status: 'COMPLETED',
      idempotencyKey: 'daily-report-assistance-preview-001',
      confirmedWriteIntentAt: '2026-04-05T12:00:00.000Z',
      confirmedContentAt: '2026-04-05T12:01:00.000Z',
      writtenAt: '2026-04-05T12:02:00.000Z',
      externalRevisitLogId: 'revisit_assistance_preview_001',
      createdAt: '2026-04-05T12:00:00.000Z',
      updatedAt: '2026-04-05T12:02:00.000Z',
    });

    await request(app.getHttpServer())
      .post('/api/v1/daily-reports/cron/reminders')
      .set('Cookie', cookies)
      .send({
        businessDate,
        sentAt: '2026-04-05T22:00:00.000Z',
      })
      .expect(200);

    expect(appStorageService.state.proactiveNotificationTasks).toHaveLength(1);
    expect(appStorageService.state.dailyReportAssistanceEscalations).toHaveLength(0);
  });

  it('同一份日报多条事项命中同一协助人时应聚合去重发送', async () => {
    const { cookies, reportId } = await createCompleteReport({
      supervisorId: 'user_sales_vp',
      supervisorName: '销售副总',
      helpContent:
        '商机「山东农信续约」：需要李四协助补充实施排期。\n客户「山东农信」：需要李四协助确认交付窗口。',
    });

    await request(app.getHttpServer())
      .post(`/api/v1/daily-reports/${reportId}/confirm`)
      .set('Cookie', cookies)
      .send({ confirmedAt: '2026-04-05T13:30:00.000Z' })
      .expect(201);

    expect(appStorageService.state.proactiveNotificationTasks).toHaveLength(3);
    const helperTask = appStorageService.state.proactiveNotificationTasks.find(
      (item) => item.sceneKey === 'daily-report.assistance-target',
    );
    expect(String(helperTask?.markdownContent)).toContain(
      '1）商机「山东农信续约」：需要李四协助补充实施排期。',
    );
    expect(String(helperTask?.markdownContent)).toContain(
      '2）客户「山东农信」：需要李四协助确认交付窗口。',
    );
    expect(appStorageService.state.dailyReportAssistanceEscalations).toHaveLength(1);
  });

  it('协助人无法唯一识别时应只留痕且不阻断主管侧日报送达', async () => {
    const { cookies, reportId } = await createCompleteReport({
      supervisorId: 'user_sales_vp',
      supervisorName: '销售副总',
      helpContent: '需要产品同事协助补充实施排期。',
    });

    const confirmed = await request(app.getHttpServer())
      .post(`/api/v1/daily-reports/${reportId}/confirm`)
      .set('Cookie', cookies)
      .send({ confirmedAt: '2026-04-05T13:30:00.000Z' })
      .expect(201);

    expect(confirmed.body.status).toBe('CONFIRMED');
    expect(confirmed.body.deliveries[0].targetUserId).toBe('user_sales_vp');
    expect(appStorageService.state.proactiveNotificationTasks).toHaveLength(1);
    expect(appStorageService.state.dailyReportAssistanceEscalations).toHaveLength(1);
    expect(appStorageService.state.dailyReportAssistanceEscalations[0].status).toBe(
      'BLOCKED',
    );
    expect(
      String(appStorageService.state.dailyReportAssistanceEscalations[0].failureReason),
    ).toContain('可唯一识别');
  });

  it('应在封账后汇总迟交与未交日报', async () => {
    const managerCookies = await loginAs(app, 'user_region_manager');
    const adminCookies = await loginAs(app, 'user_admin');
    const businessDate = '2026-04-05';

    appStorageService.state.pendingFollowUpWritebacks.unshift({
      id: 'follow_up_summary_001',
      sessionId: 'session_summary_001',
      requesterId: 'user_sales_director',
      requesterName: '销售总监',
      sourceReceiptId: 'receipt_summary_001',
      sourceMessageId: 'msg_summary_001',
      sourceQueryText: '今日跟进汇总',
      objectType: 'Opportunity',
      objectId: 'opp_001',
      objectTitle: '山东农信续约',
      opportunityId: 'opp_001',
      opportunityTitle: '山东农信续约',
      customerName: '山东农信',
      structuredFollowUpContent: '完成商务条款确认，客户计划下周内部评审。',
      structuredHelpNeeded: '无',
      structuredInformationShare: '客户更关注签约时点。',
      structuredVisitPlan: '明天继续确认评审节奏。',
      ownerId: 'user_sales_director',
      ownerName: '销售总监',
      draftContent:
        '【销售总监】：\n跟进内容：完成商务条款确认，客户计划下周内部评审。\n遇到与协助：无\n信息共享：客户更关注签约时点。\n拜访计划：明天继续确认评审节奏。',
      status: 'COMPLETED',
      idempotencyKey: 'daily-report-summary-001',
      confirmedWriteIntentAt: '2026-04-05T10:00:00.000Z',
      confirmedContentAt: '2026-04-05T10:01:00.000Z',
      writtenAt: '2026-04-05T10:02:00.000Z',
      externalRevisitLogId: 'revisit_summary_001',
      createdAt: '2026-04-05T10:00:00.000Z',
      updatedAt: '2026-04-05T10:02:00.000Z',
    });

    await request(app.getHttpServer())
      .post('/api/v1/daily-reports/cron/close')
      .set('Cookie', adminCookies)
      .send({
        businessDate,
        closedAt: '2026-04-05T15:59:59.000Z',
      })
      .expect(200);

    const summary = await request(app.getHttpServer())
      .post('/api/v1/daily-reports/cron/summaries')
      .set('Cookie', adminCookies)
      .send({
        businessDate,
        generatedAt: '2026-04-06T00:30:00.000Z',
      })
      .expect(200);

    expect(summary.body.confirmedCount).toBe(0);
    expect(summary.body.missingCount).toBe(1);
    expect(summary.body.deliveryStatus).toBe('SENT');
    expect(String(summary.body.summaryText)).toContain('未交 1 人');
    expect(String(summary.body.summaryText)).toContain('区域经理');

    const managerBatches = await request(app.getHttpServer())
      .get('/api/v1/daily-reports/summary-batches')
      .set('Cookie', managerCookies)
      .expect(200);

    expect(managerBatches.body.length).toBe(1);
    expect(managerBatches.body[0].missingCount).toBe(1);
    expect(appStorageService.state.proactiveNotificationTasks).toHaveLength(1);
    expect(
      String(appStorageService.state.proactiveNotificationTasks[0].markdownContent),
    ).toContain('【区域经理小组日报分析】');
    expect(
      String(appStorageService.state.proactiveNotificationTasks[0].markdownContent),
    ).toContain('一、日报汇总');
    expect(
      String(appStorageService.state.proactiveNotificationTasks[0].markdownContent),
    ).toContain('二、日报明细');
    expect(
      String(appStorageService.state.proactiveNotificationTasks[0].markdownContent),
    ).toContain('【销售总监日报】');
    expect(
      String(appStorageService.state.proactiveNotificationTasks[0].markdownContent),
    ).toContain('【区域经理日报】');
    expect(
      String(appStorageService.state.proactiveNotificationTasks[0].markdownContent),
    ).toContain('未交 1 人（区域经理）');
    expect(
      String(appStorageService.state.proactiveNotificationTasks[0].markdownContent),
    ).not.toContain('可执行动作：');
  });

  it('应按启用销售小组生成团队汇总，并保留真实目标收件人', async () => {
    const adminCookies = await loginAs(app, 'user_admin');
    const businessDate = '2026-04-07';

    appStorageService.state.wecomSyncedDepartments = [
      {
        id: 'dept_synced_region_east',
        wxDepartmentId: 'dept_region_east',
        departmentName: '华东区',
        parentDepartmentId: 'dept_sales_management',
        leaderUserids: ['wx_region_manager'],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-07T21:50:00.000Z',
      },
      {
        id: 'dept_synced_sales_east',
        wxDepartmentId: 'dept_sales',
        departmentName: '华东销售',
        parentDepartmentId: 'dept_region_east',
        leaderUserids: [],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-07T21:50:00.000Z',
      },
      {
        id: 'dept_synced_tech_east',
        wxDepartmentId: 'dept_sd_tech',
        departmentName: '华东技术团队',
        parentDepartmentId: 'dept_region_east',
        leaderUserids: [],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-07T21:50:00.000Z',
      },
    ];
    appStorageService.state.wecomSyncedUsers = [
      {
        id: 'synced_region_manager',
        wxUserid: 'wx_region_manager',
        userName: '区域经理',
        primaryDepartmentId: 'dept_region_east',
        departmentIds: ['dept_region_east'],
        directLeaderUserids: ['wx_sales_vp'],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-07T21:50:00.000Z',
      },
      {
        id: 'synced_sales_director',
        wxUserid: 'wx_sales_director',
        userName: '销售总监',
        primaryDepartmentId: 'dept_sales',
        departmentIds: ['dept_sales'],
        directLeaderUserids: ['wx_region_manager'],
        rawPayload: {},
        syncStatus: 'ACTIVE',
        lastSyncedAt: '2026-04-07T21:50:00.000Z',
      },
    ];
    appStorageService.state.dailyReportDepartmentPolicies = [
      {
        departmentId: 'dept_region_east',
        departmentName: '华东区',
        status: 'ENABLED',
        departmentType: 'REGION',
        applyToChildren: true,
        updatedBy: 'user_admin',
        updatedAt: '2026-04-07T21:55:00.000Z',
        reason: '区域节点对销售小组生效',
      },
      {
        departmentId: 'dept_sd_tech',
        departmentName: '华东技术团队',
        status: 'DISABLED',
        departmentType: 'NON_SALES',
        applyToChildren: false,
        updatedBy: 'user_admin',
        updatedAt: '2026-04-07T21:56:00.000Z',
        reason: '技术团队不参与日报链路',
      },
    ];
    appStorageService.state.dailyReportRecipientOverrides = [
      {
        departmentId: 'dept_region_east',
        departmentName: '华东区',
        scopeType: 'REGION',
        crmUserId: 'user_region_manager',
        recipientName: '区域经理',
        updatedBy: 'user_admin',
        updatedAt: '2026-04-07T21:57:00.000Z',
        reason: '区域负责人承接销售组汇总',
      },
    ];
    appStorageService.state.pendingFollowUpWritebacks.unshift({
      id: 'follow_up_group_summary_001',
      sessionId: 'session_group_summary_001',
      requesterId: 'user_sales_director',
      requesterName: '销售总监',
      sourceReceiptId: 'receipt_group_summary_001',
      sourceMessageId: 'msg_group_summary_001',
      sourceQueryText: '今天跟进了华东重点项目',
      objectType: 'Opportunity',
      objectId: 'opp_001',
      objectTitle: '山东农信续约',
      opportunityId: 'opp_001',
      opportunityTitle: '山东农信续约',
      customerName: '山东农信',
      structuredFollowUpContent: '完成商务条款确认，客户计划下周内部评审。',
      structuredHelpNeeded: '无',
      structuredInformationShare: '客户更关注签约时点。',
      structuredVisitPlan: '明天继续确认评审节奏。',
      ownerId: 'user_sales_director',
      ownerName: '销售总监',
      draftContent:
        '【销售总监】：\n跟进内容：完成商务条款确认，客户计划下周内部评审。\n遇到与协助：无\n信息共享：客户更关注签约时点。\n拜访计划：明天继续确认评审节奏。',
      status: 'COMPLETED',
      idempotencyKey: 'daily-report-group-summary-001',
      confirmedWriteIntentAt: '2026-04-07T10:00:00.000Z',
      confirmedContentAt: '2026-04-07T10:01:00.000Z',
      writtenAt: '2026-04-07T10:02:00.000Z',
      externalRevisitLogId: 'revisit_group_summary_001',
      createdAt: '2026-04-07T10:00:00.000Z',
      updatedAt: '2026-04-07T10:02:00.000Z',
    });

    await request(app.getHttpServer())
      .post('/api/v1/daily-reports/cron/close')
      .set('Cookie', adminCookies)
      .send({
        businessDate,
        closedAt: '2026-04-07T23:59:59.000Z',
      })
      .expect(200);

    const summary = await request(app.getHttpServer())
      .post('/api/v1/daily-reports/cron/summaries')
      .set('Cookie', adminCookies)
      .send({
        businessDate,
        generatedAt: '2026-04-08T08:00:00.000Z',
      })
      .expect(200);

    expect(summary.body.groupSummaries).toEqual([
      expect.objectContaining({
        groupDepartmentId: 'dept_sales',
        groupDepartmentName: '华东销售',
        recipientCrmUserId: 'user_region_manager',
        recipientName: '区域经理',
        ruleSource: 'REGION_OVERRIDE',
        deliveryStatus: 'SENT',
      }),
    ]);
    expect(summary.body.recipientIds).toEqual(['user_region_manager']);
    expect(
      summary.body.groupSummaries.find(
        (item: { groupDepartmentId: string }) =>
          item.groupDepartmentId === 'dept_sd_tech',
      ),
    ).toBeUndefined();
    expect(
      String(appStorageService.state.proactiveNotificationTasks[0].markdownContent),
    ).toContain('销售小组：华东销售');
  });

  it('按负责人即时查看小组日报预览时，不应创建正式汇总批次或主动通知', async () => {
    const businessDate = '2026-04-06';
    const actor = crmReadonlyService.listUsers().find((item) => item.id === 'user_sales_vp');
    const member = crmReadonlyService.listUsers().find(
      (item) => item.id === 'user_sales_director',
    );
    expect(actor).toBeDefined();
    expect(member).toBeDefined();

    jest.spyOn(salesLeaderMappingService, 'listMappedSalesGroups').mockResolvedValue([
      {
        area: '北区金融部',
        region: '北区金融部-王文定',
        leaderName: '王文定',
        leader: {
          ...(actor as NonNullable<typeof actor>),
          id: 'leader_wang',
          name: '王文定',
          supervisorId: 'user_sales_vp',
          supervisorName: '销售副总',
        },
        members: [member as NonNullable<typeof member>],
      },
    ]);

    appStorageService.state.pendingFollowUpWritebacks.unshift({
      id: 'follow_up_team_preview_001',
      sessionId: 'session_team_preview_001',
      requesterId: 'user_sales_director',
      requesterName: '销售总监',
      sourceReceiptId: 'receipt_team_preview_001',
      sourceMessageId: 'msg_team_preview_001',
      sourceQueryText: '王文定小组日报预览',
      objectType: 'Opportunity',
      objectId: 'opp_001',
      objectTitle: '山东农信续约',
      opportunityId: 'opp_001',
      opportunityTitle: '山东农信续约',
      customerName: '山东农信',
      structuredFollowUpContent: '推进了续约商务条款确认，客户倾向本周内完成审批。',
      structuredHelpNeeded: '需要区域经理协助确认最终折扣底线。',
      structuredInformationShare: '客户对交付周期比价格更敏感。',
      structuredVisitPlan: '明天下午继续约客户采购负责人沟通签约节奏。',
      ownerId: 'user_sales_director',
      ownerName: '销售总监',
      draftContent:
        '【销售总监】：\n跟进内容：推进了续约商务条款确认，客户倾向本周内完成审批。\n遇到与协助：需要区域经理协助确认最终折扣底线。\n信息共享：客户对交付周期比价格更敏感。\n拜访计划：明天下午继续约客户采购负责人沟通签约节奏。',
      status: 'COMPLETED',
      idempotencyKey: 'team-preview-follow-up-001',
      confirmedWriteIntentAt: `${businessDate}T10:00:00.000Z`,
      confirmedContentAt: `${businessDate}T10:01:00.000Z`,
      writtenAt: `${businessDate}T10:02:00.000Z`,
      externalRevisitLogId: 'revisit_team_preview_001',
      createdAt: `${businessDate}T10:00:00.000Z`,
      updatedAt: `${businessDate}T10:02:00.000Z`,
    });

    const reportCountBefore = appStorageService.state.dailyReports.length;
    const summaryBatchCountBefore = appStorageService.state.dailyReportSummaryBatches.length;
    const notificationTaskCountBefore =
      appStorageService.state.proactiveNotificationTasks.length;

    const preview = await dailyReportService.getTeamDailyReportPreview(
      actor as NonNullable<typeof actor>,
      '王文定',
      businessDate,
      `${businessDate}T12:00:00.000Z`,
    );

    expect(preview.status).toBe('READY');
    expect(preview.hasAnySourceData).toBe(true);
    expect(String(preview.summaryText)).toContain('【王文定小组日报分析】');
    expect(String(preview.summaryText)).toContain('【销售总监日报】');
    expect(appStorageService.state.dailyReports.length).toBe(reportCountBefore);
    expect(appStorageService.state.dailyReportSummaryBatches.length).toBe(
      summaryBatchCountBefore,
    );
    expect(appStorageService.state.proactiveNotificationTasks.length).toBe(
      notificationTaskCountBefore,
    );
  });

  it('小组日报预览在 AI 可用时应优先采用 AI 团队观察', async () => {
    const businessDate = '2026-04-06';
    const actor = crmReadonlyService.listUsers().find((item) => item.id === 'user_sales_vp');
    const member = crmReadonlyService.listUsers().find(
      (item) => item.id === 'user_sales_director',
    );
    expect(actor).toBeDefined();
    expect(member).toBeDefined();
    const aiGateway = dailyReportService['aiGatewayService'] as unknown as {
      generateDailyReportGroundedInsight: jest.Mock;
    };
    const aiDailyInsightSpy = jest.spyOn(
      aiGateway,
      'generateDailyReportGroundedInsight',
    );
    aiDailyInsightSpy.mockResolvedValue({
      summaryLines: ['AI团队观察：建议优先关注销售总监的折扣审批阻塞。'],
    });

    jest.spyOn(salesLeaderMappingService, 'listMappedSalesGroups').mockResolvedValue([
      {
        area: '北区金融部',
        region: '北区金融部-王文定',
        leaderName: '王文定',
        leader: {
          ...(actor as NonNullable<typeof actor>),
          id: 'leader_wang',
          name: '王文定',
          supervisorId: 'user_sales_vp',
          supervisorName: '销售副总',
        },
        members: [member as NonNullable<typeof member>],
      },
    ]);

    appStorageService.state.pendingFollowUpWritebacks.unshift({
      id: 'follow_up_team_preview_ai_001',
      sessionId: 'session_team_preview_ai_001',
      requesterId: 'user_sales_director',
      requesterName: '销售总监',
      sourceReceiptId: 'receipt_team_preview_ai_001',
      sourceMessageId: 'msg_team_preview_ai_001',
      sourceQueryText: '王文定小组日报 AI 预览',
      objectType: 'Opportunity',
      objectId: 'opp_001',
      objectTitle: '山东农信续约',
      opportunityId: 'opp_001',
      opportunityTitle: '山东农信续约',
      customerName: '山东农信',
      structuredFollowUpContent: '推进了续约商务条款确认，客户倾向本周内完成审批。',
      structuredHelpNeeded: '需要区域经理协助确认最终折扣底线。',
      structuredInformationShare: '客户对交付周期比价格更敏感。',
      structuredVisitPlan: '明天下午继续约客户采购负责人沟通签约节奏。',
      ownerId: 'user_sales_director',
      ownerName: '销售总监',
      draftContent:
        '【销售总监】：\n跟进内容：推进了续约商务条款确认，客户倾向本周内完成审批。\n遇到与协助：需要区域经理协助确认最终折扣底线。\n信息共享：客户对交付周期比价格更敏感。\n拜访计划：明天下午继续约客户采购负责人沟通签约节奏。',
      status: 'COMPLETED',
      idempotencyKey: 'team-preview-ai-001',
      confirmedWriteIntentAt: `${businessDate}T10:00:00.000Z`,
      confirmedContentAt: `${businessDate}T10:01:00.000Z`,
      writtenAt: `${businessDate}T10:02:00.000Z`,
      externalRevisitLogId: 'revisit_team_preview_ai_001',
      createdAt: `${businessDate}T10:00:00.000Z`,
      updatedAt: `${businessDate}T10:02:00.000Z`,
    });

    const preview = await dailyReportService.getTeamDailyReportPreview(
      actor as NonNullable<typeof actor>,
      '王文定',
      businessDate,
      `${businessDate}T12:00:00.000Z`,
    );

    expect(String(preview.summaryText)).toContain(
      '团队观察：AI团队观察：建议优先关注销售总监的折扣审批阻塞。',
    );
  });

  it('小组日报预览遇到非模板手工跟进时，应将全文视为跟进内容且不误计协助/分享/计划', async () => {
    const businessDate = '2026-04-06';
    const actor = crmReadonlyService.listUsers().find((item) => item.id === 'user_sales_vp');
    const member = crmReadonlyService.listUsers().find(
      (item) => item.id === 'user_sales_director',
    );
    expect(actor).toBeDefined();
    expect(member).toBeDefined();

    jest.spyOn(salesLeaderMappingService, 'listMappedSalesGroups').mockResolvedValue([
      {
        area: '北区金融部',
        region: '北区金融部-王文定',
        leaderName: '王文定',
        leader: {
          ...(actor as NonNullable<typeof actor>),
          id: 'leader_wang',
          name: '王文定',
          supervisorId: 'user_sales_vp',
          supervisorName: '销售副总',
        },
        members: [member as NonNullable<typeof member>],
      },
    ]);

    appStorageService.state.pendingFollowUpWritebacks.unshift({
      id: 'follow_up_team_preview_freeform_001',
      sessionId: 'session_team_preview_freeform_001',
      requesterId: 'user_sales_director',
      requesterName: '销售总监',
      sourceReceiptId: 'receipt_team_preview_freeform_001',
      sourceMessageId: 'msg_team_preview_freeform_001',
      sourceQueryText: '王文定小组日报非模板预览',
      objectType: 'Opportunity',
      objectId: 'opp_001',
      objectTitle: '山东农信续约',
      opportunityId: 'opp_001',
      opportunityTitle: '山东农信续约',
      customerName: '山东农信',
      ownerId: 'user_sales_director',
      ownerName: '销售总监',
      draftContent: '【销售总监】：\n测试测试',
      status: 'COMPLETED',
      idempotencyKey: 'team-preview-freeform-001',
      confirmedWriteIntentAt: `${businessDate}T10:00:00.000Z`,
      confirmedContentAt: `${businessDate}T10:01:00.000Z`,
      writtenAt: `${businessDate}T10:02:00.000Z`,
      externalRevisitLogId: 'revisit_team_preview_freeform_001',
      createdAt: `${businessDate}T10:00:00.000Z`,
      updatedAt: `${businessDate}T10:02:00.000Z`,
    });

    const preview = await dailyReportService.getTeamDailyReportPreview(
      actor as NonNullable<typeof actor>,
      '王文定',
      businessDate,
      `${businessDate}T12:00:00.000Z`,
    );

    const summaryText = String(preview.summaryText);
    expect(preview.status).toBe('READY');
    expect(summaryText).toContain('【销售总监日报】');
    expect(summaryText).toContain('①商机「山东农信续约」：测试测试');
    expect(summaryText).toContain('2、问题与协助\n无');
    expect(summaryText).toContain('3、信息分享\n无');
    expect(summaryText).toContain('4、计划\n无');
    expect(summaryText).not.toContain('协助诉求');
    expect(summaryText).not.toContain('成员已沉淀 1 项后续计划');
  });

  it('销售负责人映射成员即使缺少 ownerIds 或 supervisorId，也应统计其当天跟进', async () => {
    const businessDate = '2026-04-10';
    const actor = crmReadonlyService.listUsers().find((item) => item.id === 'user_sales_vp');
    const member = crmReadonlyService.listUsers().find(
      (item) => item.id === 'user_sales_director',
    );
    expect(actor).toBeDefined();
    expect(member).toBeDefined();

    jest.spyOn(salesLeaderMappingService, 'listMappedSalesGroups').mockResolvedValue([
      {
        area: '北区金融部',
        region: '北区金融部-王文定',
        leaderName: '王文定',
        leader: {
          ...(actor as NonNullable<typeof actor>),
          id: 'leader_wang',
          name: '王文定',
          supervisorId: 'user_sales_vp',
          supervisorName: '销售副总',
        },
        members: [
          {
            ...(member as NonNullable<typeof member>),
            ownerIds: [],
            supervisorId: undefined,
            supervisorName: undefined,
          },
        ],
      },
    ]);

    appStorageService.state.pendingFollowUpWritebacks.unshift({
      id: 'follow_up_team_preview_missing_scope_001',
      sessionId: 'session_team_preview_missing_scope_001',
      requesterId: 'user_sales_director',
      requesterName: '销售总监',
      sourceReceiptId: 'receipt_team_preview_missing_scope_001',
      sourceMessageId: 'msg_team_preview_missing_scope_001',
      sourceQueryText: '手动跟进日报预览',
      objectType: 'Opportunity',
      objectId: 'opp_001',
      objectTitle: '山东农信续约',
      opportunityId: 'opp_001',
      opportunityTitle: '山东农信续约',
      customerName: '山东农信',
      structuredFollowUpContent: '今天已手动补充测试跟进内容。',
      structuredHelpNeeded: '无',
      structuredInformationShare: '无',
      structuredVisitPlan: '明天继续推进。',
      ownerId: 'user_sales_director',
      ownerName: '销售总监',
      draftContent:
        '【销售总监】：\n跟进内容：今天已手动补充测试跟进内容。\n遇到与协助：无\n信息共享：无\n拜访计划：明天继续推进。',
      status: 'COMPLETED',
      idempotencyKey: 'team-preview-missing-scope-001',
      confirmedWriteIntentAt: `${businessDate}T09:10:00.000Z`,
      confirmedContentAt: `${businessDate}T09:11:00.000Z`,
      writtenAt: `${businessDate}T09:13:00.000Z`,
      externalRevisitLogId: 'revisit_team_preview_missing_scope_001',
      createdAt: `${businessDate}T09:10:00.000Z`,
      updatedAt: `${businessDate}T09:13:00.000Z`,
    });

    const preview = await dailyReportService.getTeamDailyReportPreview(
      actor as NonNullable<typeof actor>,
      '王文定',
      businessDate,
      `${businessDate}T09:20:00.000Z`,
    );

    expect(preview.status).toBe('READY');
    expect(preview.hasAnySourceData).toBe(true);
    expect(String(preview.summaryText)).toContain('【王文定小组日报分析】');
    expect(String(preview.summaryText)).toContain('【销售总监日报】');
    expect(String(preview.summaryText)).toContain('今天已手动补充测试跟进内容');
  });

  it('修改已确认日报后应回到待确认状态并可重新确认', async () => {
    const { cookies, reportId } = await createCompleteReport();

    await request(app.getHttpServer())
      .post(`/api/v1/daily-reports/${reportId}/confirm`)
      .set('Cookie', cookies)
      .send({ confirmedAt: '2026-04-05T13:30:00.000Z' })
      .expect(201);

    const revised = await request(app.getHttpServer())
      .post('/api/v1/daily-reports/fragments')
      .set('Cookie', cookies)
      .send({
        fragmentType: 'TODAY_FOLLOW_UP',
        content: '上午拜访了 XX 科技，补充了新的折扣诉求。',
        businessDate: '2026-04-05',
        supervisorId: 'user_region_manager',
        supervisorName: '区域经理',
        capturedAt: '2026-04-05T14:20:00.000Z',
      })
      .expect(201);

    expect(revised.body.status).toBe('PENDING_CONFIRMATION');
    expect(revised.body.confirmation).toBeUndefined();

    const reconfirmed = await request(app.getHttpServer())
      .post(`/api/v1/daily-reports/${reportId}/confirm`)
      .set('Cookie', cookies)
      .send({ confirmedAt: '2026-04-05T15:00:00.000Z' })
      .expect(201);

    expect(reconfirmed.body.status).toBe('CONFIRMED');
    expect(reconfirmed.body.deliveries.length).toBe(2);
  });

  it('已确认日报在摘要未变化时，不应被 22 点重跑打回待确认', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const businessDate = '2026-04-05';

    appStorageService.state.pendingFollowUpWritebacks.unshift({
      id: 'follow_up_confirm_keep_001',
      sessionId: 'session_confirm_keep_001',
      requesterId: 'user_sales_director',
      requesterName: '销售总监',
      sourceReceiptId: 'receipt_confirm_keep_001',
      sourceMessageId: 'msg_confirm_keep_001',
      sourceQueryText: '今天跟进了山东农信续约项目',
      objectType: 'Opportunity',
      objectId: 'opp_001',
      objectTitle: '山东农信续约',
      opportunityId: 'opp_001',
      opportunityTitle: '山东农信续约',
      customerName: '山东农信',
      structuredFollowUpContent: '推进了续约商务条款确认，客户倾向本周内完成审批。',
      structuredHelpNeeded: '无',
      structuredInformationShare: '客户对交付周期比价格更敏感。',
      structuredVisitPlan: '明天下午继续约客户采购负责人沟通签约节奏。',
      ownerId: 'user_sales_director',
      ownerName: '销售总监',
      draftContent:
        '【销售总监】：\n跟进内容：推进了续约商务条款确认，客户倾向本周内完成审批。\n遇到与协助：无\n信息共享：客户对交付周期比价格更敏感。\n拜访计划：明天下午继续约客户采购负责人沟通签约节奏。',
      status: 'COMPLETED',
      idempotencyKey: 'daily-report-confirm-keep-001',
      confirmedWriteIntentAt: '2026-04-05T12:00:00.000Z',
      confirmedContentAt: '2026-04-05T12:01:00.000Z',
      writtenAt: '2026-04-05T12:02:00.000Z',
      externalRevisitLogId: 'revisit_confirm_keep_001',
      createdAt: '2026-04-05T12:00:00.000Z',
      updatedAt: '2026-04-05T12:02:00.000Z',
    });

    const firstSweep = await request(app.getHttpServer())
      .post('/api/v1/daily-reports/cron/reminders')
      .set('Cookie', cookies)
      .send({
        businessDate,
        sentAt: '2026-04-05T22:00:00.000Z',
      })
      .expect(200);

    const reportId = firstSweep.body[0].id;

    await request(app.getHttpServer())
      .post(`/api/v1/daily-reports/${reportId}/confirm`)
      .set('Cookie', cookies)
      .send({ confirmedAt: '2026-04-05T13:10:00.000Z' })
      .expect(201);

    const secondSweep = await request(app.getHttpServer())
      .post('/api/v1/daily-reports/cron/reminders')
      .set('Cookie', cookies)
      .send({
        businessDate,
        sentAt: '2026-04-05T22:30:00.000Z',
      })
      .expect(200);

    expect(secondSweep.body[0].status).toBe('CONFIRMED');
    expect(secondSweep.body[0].confirmation.confirmedBy).toBe('user_sales_director');
    expect(
      secondSweep.body[0].deliveries.filter(
        (item: { deliveryType?: string }) =>
          item.deliveryType === 'PERSONAL_CONFIRMATION',
      ),
    ).toHaveLength(1);
  });

  it('关闭日报开关后，应跳过催办、个人确认和正式推送', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const originalValue = process.env.DAILY_REPORT_ENABLED;
    process.env.DAILY_REPORT_ENABLED = 'false';
    resetDailyReportConfigCache();

    try {
      appStorageService.state.pendingFollowUpWritebacks.unshift({
        id: 'follow_up_switch_001',
        sessionId: 'session_switch_001',
        requesterId: 'user_sales_director',
        requesterName: '销售总监',
        sourceReceiptId: 'receipt_switch_001',
        sourceMessageId: 'msg_switch_001',
        sourceQueryText: '今天跟进了山东农信续约项目',
        objectType: 'Opportunity',
        objectId: 'opp_001',
        objectTitle: '山东农信续约',
        opportunityId: 'opp_001',
        opportunityTitle: '山东农信续约',
        customerName: '山东农信',
        structuredFollowUpContent: '推进了续约商务条款确认。',
        structuredHelpNeeded: '无',
        structuredInformationShare: '客户对交付周期更敏感。',
        structuredVisitPlan: '明天下午继续沟通。',
        ownerId: 'user_sales_director',
        ownerName: '销售总监',
        draftContent:
          '【销售总监】：\n跟进内容：推进了续约商务条款确认。\n遇到与协助：无\n信息共享：客户对交付周期更敏感。\n拜访计划：明天下午继续沟通。',
        status: 'COMPLETED',
        idempotencyKey: 'daily-report-switch-001',
        confirmedWriteIntentAt: '2026-04-05T12:00:00.000Z',
        confirmedContentAt: '2026-04-05T12:01:00.000Z',
        writtenAt: '2026-04-05T12:02:00.000Z',
        externalRevisitLogId: 'revisit_switch_001',
        createdAt: '2026-04-05T12:00:00.000Z',
        updatedAt: '2026-04-05T12:02:00.000Z',
      });

      const sweepResponse = await request(app.getHttpServer())
        .post('/api/v1/daily-reports/cron/reminders')
        .set('Cookie', cookies)
        .send({
          businessDate: '2026-04-05',
          sentAt: '2026-04-05T22:00:00.000Z',
        })
        .expect(200);

      expect(sweepResponse.body[0].deliveries[0].status).toBe('SKIPPED');
      expect(appStorageService.state.proactiveNotificationTasks).toHaveLength(0);

      const confirmed = await request(app.getHttpServer())
        .post(`/api/v1/daily-reports/${sweepResponse.body[0].id}/confirm`)
        .set('Cookie', cookies)
        .send({ confirmedAt: '2026-04-05T22:10:00.000Z' })
        .expect(201);

      expect(confirmed.body.deliveries[1].status).toBe('SKIPPED');
      expect(appStorageService.state.proactiveNotificationTasks).toHaveLength(0);
    } finally {
      if (originalValue === undefined) {
        delete process.env.DAILY_REPORT_ENABLED;
      } else {
        process.env.DAILY_REPORT_ENABLED = originalValue;
      }
      resetDailyReportConfigCache();
    }
  });

  it('应保留上游来源元数据并拒绝失败码写入', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const businessDate = '2026-04-05';

    const response = await request(app.getHttpServer())
      .post('/api/v1/daily-reports/fragments')
      .set('Cookie', cookies)
      .send({
        fragmentType: 'CUSTOMER_OR_OPPORTUNITY_CHANGE',
        content: 'XX 动力项目预计下周二 POC。',
        businessDate,
        supervisorId: 'user_region_manager',
        supervisorName: '区域经理',
        sourceLabel: '接口来源',
        sourceInterface: '/api/v2/opportunities',
        sourceObjectId: 'opp_001',
        sourceOperatorId: 'owner_zhang',
        sourceOperatorName: '张琳',
        sourceCode: 0,
        capturedAt: '2026-04-05T10:00:00.000Z',
      })
      .expect(201);

    expect(response.body.fragments[0].sourceInterface).toBe(
      '/api/v2/opportunities',
    );
    expect(response.body.fragments[0].sourceObjectId).toBe('opp_001');
    expect(response.body.fragments[0].sourceCode).toBe(0);

    const audit = await request(app.getHttpServer())
      .get('/api/v1/daily-reports/audit')
      .set('Cookie', cookies)
      .query({ businessDate })
      .expect(200);

    expect(audit.body[0].fragments[0].sourceOperatorName).toBe('张琳');

    await request(app.getHttpServer())
      .post('/api/v1/daily-reports/fragments')
      .set('Cookie', cookies)
      .send({
        fragmentType: 'TODAY_FOLLOW_UP',
        content: '跟进失败样例。',
        businessDate,
        supervisorId: 'user_region_manager',
        supervisorName: '区域经理',
        sourceInterface: '/api/v2/revisit_logs',
        sourceObjectId: 'revisit_002',
        sourceCode: 100000,
        capturedAt: '2026-04-05T11:00:00.000Z',
      })
      .expect(400);
  });
});

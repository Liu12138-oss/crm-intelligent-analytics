import { DailyReportDispatcherService } from '../../../src/modules/daily-report/daily-report-dispatcher.service';
import type {
  CrmUser,
  DailyReportSummaryBatchRecord,
} from '../../../src/shared/types/domain';

describe('DailyReportDispatcherService', () => {
  it('日报团队汇总应支持同一小组发送给多个组长', async () => {
    const dispatch = jest.fn(async () => ({
      status: 'SENT',
    }));
    const service = new DailyReportDispatcherService(
      {
        getDailyReportConfig: () => ({ enabled: true }),
        getWecomNotifyConfig: () => ({
          realMessageEnabled: true,
          testReceiverUserId: 'test_receiver',
        }),
      } as never,
      { dispatch } as never,
    );
    const actor = {
      id: 'user_admin',
      name: '系统管理员',
      roleIds: [],
      roleNames: [],
      organizationIds: [],
      departmentIds: [],
      ownerIds: [],
      isAdmin: true,
      exportAllowed: true,
      channels: ['web-console'],
    } satisfies CrmUser;
    const batch = {
      id: 'summary_batch_multi_leader',
      businessDate: '2026-05-28',
      generatedAt: '2026-05-28T08:00:00.000Z',
      confirmedCount: 1,
      lateCount: 0,
      missingCount: 0,
      recipientIds: ['leader_a', 'leader_b'],
      deliveryStatus: 'SENT',
      summaryText: '销售日报汇总',
      groupSummaries: [
        {
          groupDepartmentId: 'dept_sales',
          groupDepartmentName: '销售一组',
          recipientCrmUserIds: ['leader_a', 'leader_b'],
          recipientNames: ['张组长', '李组长'],
          recipientCrmUserId: 'leader_a',
          recipientName: '张组长',
          ruleSource: 'MANUAL_GROUP_CONFIG',
          deliveryStatus: 'READY',
          memberRequesterIds: ['member_a'],
          memberCount: 1,
          summaryText: '销售一组日报汇总',
        },
      ],
    } satisfies DailyReportSummaryBatchRecord;

    const result = await service.dispatchSummaryBatch(batch, [], actor);

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: {
          type: 'CRM_USER',
          crmUserIds: ['leader_a', 'leader_b'],
        },
        metadata: expect.objectContaining({
          dailyReportRecipientName: '张组长、李组长',
        }),
      }),
    );
    expect(result.deliveries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetUserId: 'leader_a',
          targetUserName: '张组长',
          status: 'SENT',
        }),
        expect.objectContaining({
          targetUserId: 'leader_b',
          targetUserName: '李组长',
          status: 'SENT',
        }),
      ]),
    );
    expect(result.batch.groupSummaries[0]?.deliveryStatus).toBe('SENT');
  });
});

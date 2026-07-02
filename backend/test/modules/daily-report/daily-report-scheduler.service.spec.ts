import { DailyReportSchedulerService } from '../../../src/modules/daily-report/daily-report-scheduler.service';

describe('DailyReportSchedulerService', () => {
  const actor = {
    id: 'user_admin',
    name: '系统管理员',
    roleIds: ['role_admin'],
    roleNames: ['系统管理员'],
    organizationIds: ['org_north'],
    departmentIds: ['dept_admin'],
    ownerIds: [],
    isAdmin: true,
    exportAllowed: true,
    channels: ['web-console'],
  };

  function buildService() {
    const dailyReportService = {
      runReminderSweep: jest.fn(),
      runClosureSweep: jest.fn(),
      runSummarySweep: jest.fn(),
    };
    const crmReadonlyService = {
      getUserById: jest.fn(async () => actor),
    };
    const localRuntimeConfigService = {
      getDailyReportConfig: jest.fn(() => ({
        enabled: true,
        internalSchedulerEnabled: true,
        schedulerActorUserId: 'user_admin',
      })),
    };
    const logger = {
      logStep: jest.fn(),
      logWarn: jest.fn(),
    };

    const service = new DailyReportSchedulerService(
      dailyReportService as never,
      crmReadonlyService as never,
      localRuntimeConfigService as never,
      logger as never,
    );

    return {
      service,
      dailyReportService,
      crmReadonlyService,
      logger,
    };
  }

  it('内置调度执行 reminders 时应直接调用日报提醒链路，不再依赖外部脚本登录态', async () => {
    const { service, dailyReportService } = buildService();

    await service.runScheduledJob(
      'reminders',
      new Date('2026-05-15T14:00:00.000Z'),
    );

    expect(dailyReportService.runReminderSweep).toHaveBeenCalledWith(
      actor,
      '2026-05-15',
      expect.any(String),
    );
  });

  it('内置调度执行 summaries 时应汇总前一业务日', async () => {
    const { service, dailyReportService } = buildService();

    await service.runScheduledJob(
      'summaries',
      new Date('2026-05-15T00:00:00.000Z'),
    );

    expect(dailyReportService.runSummarySweep).toHaveBeenCalledWith(
      actor,
      '2026-05-14',
      undefined,
      expect.any(String),
    );
  });

  it('内置调度执行 close 时应封账当前业务日', async () => {
    const { service, dailyReportService } = buildService();

    await service.runScheduledJob(
      'close',
      new Date('2026-05-15T15:59:00.000Z'),
    );

    expect(dailyReportService.runClosureSweep).toHaveBeenCalledWith(
      actor,
      '2026-05-15',
      expect.any(String),
    );
  });
});

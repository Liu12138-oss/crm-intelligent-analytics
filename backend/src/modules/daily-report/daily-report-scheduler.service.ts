import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CrmReadonlyService } from '../../database/crm-readonly/crm-readonly.service';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import type { CrmUser } from '../../shared/types/domain';
import { DailyReportService } from './daily-report.service';

type DailyReportScheduledJob = 'reminders' | 'close' | 'summaries';

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

@Injectable()
export class DailyReportSchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly executedJobKeys = new Set<string>();
  private intervalHandle?: ReturnType<typeof setInterval>;

  constructor(
    private readonly dailyReportService: DailyReportService,
    private readonly crmReadonlyService: CrmReadonlyService,
    private readonly localRuntimeConfigService: LocalRuntimeConfigService,
    private readonly analysisLoggerService: AnalysisLoggerService,
  ) {}

  /**
   * 模块启动时注册应用内置日报调度器。
   *
   * 测试环境不启动定时器，避免单元测试留下后台句柄；生产和开发环境由运行配置决定是否启用。
   */
  onModuleInit(): void {
    const config = this.localRuntimeConfigService.getDailyReportConfig();

    // 单元测试只验证显式调用，不启动真实调度。
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    // 日报总开关或内置调度关闭时，页面仍可手动预览，但后台不自动触发发送。
    if (!config.enabled || !config.internalSchedulerEnabled) {
      this.analysisLoggerService.logStep('日报内置调度未启动。', {
        enabled: config.enabled,
        internalSchedulerEnabled: config.internalSchedulerEnabled,
      });
      return;
    }

    this.intervalHandle = setInterval(() => {
      void this.runDueJobs(new Date());
    }, 60_000);
    void this.runDueJobs(new Date());
    this.analysisLoggerService.logStep('日报内置调度已启动。', {
      reminderTime: config.reminderTime,
      closeTime: config.closeTime,
      summaryTime: config.summaryTime,
    });
  }

  /**
   * 模块销毁时释放调度器句柄。
   *
   * Nest 关闭或热重载时清理定时器，避免重复触发同一业务日发送。
   */
  onModuleDestroy(): void {
    // 只有启动过内置调度时才需要释放句柄。
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
    }
  }

  /**
   * 执行指定日报调度任务。
   *
   * @param job 调度任务类型，`reminders` 为 22 点提醒，`close` 为 23:59 封账，`summaries` 为次日 8 点汇总。
   * @param now 当前时间，默认使用系统时间；测试可传入固定时间验证业务日期。
   * @returns 调度执行结果；若配置关闭或系统执行人不存在，则返回 `undefined` 并记录日志。
   */
  async runScheduledJob(
    job: DailyReportScheduledJob,
    now = new Date(),
  ): Promise<unknown> {
    const config = this.localRuntimeConfigService.getDailyReportConfig();

    // 调度入口必须尊重页面总开关和内置调度开关，防止后台绕过管理员配置。
    if (!config.enabled || !config.internalSchedulerEnabled) {
      this.analysisLoggerService.logWarn('日报调度任务已跳过，当前配置未启用。', {
        job,
        enabled: config.enabled,
        internalSchedulerEnabled: config.internalSchedulerEnabled,
      });
      return undefined;
    }

    const actor = await this.resolveSchedulerActor(config.schedulerActorUserId);
    // 系统执行人缺失时不能降级为匿名执行，避免审计链路丢失责任主体。
    if (!actor) {
      this.analysisLoggerService.logWarn('日报调度任务已跳过，系统执行人不存在。', {
        job,
        schedulerActorUserId: config.schedulerActorUserId,
      });
      return undefined;
    }

    const triggeredAt = now.toISOString();
    // 汇总任务面向前一业务日；提醒和封账都处理当天业务日。
    if (job === 'summaries') {
      return await this.dailyReportService.runSummarySweep(
        actor,
        this.formatShanghaiBusinessDate(
          new Date(now.getTime() - 24 * 60 * 60 * 1000),
        ),
        undefined,
        triggeredAt,
      );
    }

    // 封账任务只更新当日日报状态，不发送团队汇总。
    if (job === 'close') {
      return this.dailyReportService.runClosureSweep(
        actor,
        this.formatShanghaiBusinessDate(now),
        triggeredAt,
      );
    }

    return await this.dailyReportService.runReminderSweep(
      actor,
      this.formatShanghaiBusinessDate(now),
      triggeredAt,
    );
  }

  /**
   * 按当前时间检查并触发应执行的日报任务。
   *
   * @param now 当前时间，按 Asia/Shanghai 业务时间匹配配置中的 HH:mm。
   * @returns 已触发任务的 Promise；未命中时间点时返回空数组。
   */
  private async runDueJobs(now: Date): Promise<unknown[]> {
    const config = this.localRuntimeConfigService.getDailyReportConfig();
    const localDate = this.formatShanghaiBusinessDate(now);
    const localTime = this.formatShanghaiTime(now);
    const dueJobs: DailyReportScheduledJob[] = [];

    // 三个时间点互相独立，同一分钟内只允许同一任务执行一次。
    if (localTime === config.reminderTime) {
      dueJobs.push('reminders');
    }
    if (localTime === config.closeTime) {
      dueJobs.push('close');
    }
    if (localTime === config.summaryTime) {
      dueJobs.push('summaries');
    }

    const tasks = dueJobs
      .filter((job) => this.markJobPending(localDate, job))
      .map(async (job) => {
        try {
          return await this.runScheduledJob(job, now);
        } catch (error) {
          this.analysisLoggerService.logWarn('日报内置调度执行失败。', {
            job,
            message: error instanceof Error ? error.message : String(error),
          });
          return undefined;
        }
      });

    return await Promise.all(tasks);
  }

  /**
   * 解析日报调度系统执行人。
   *
   * @param actorUserId 配置中的 CRM 用户 ID。
   * @returns 可用于权限、审计和发送链路的 CRM 用户；不存在时返回 null。
   */
  private async resolveSchedulerActor(
    actorUserId: string,
  ): Promise<CrmUser | null> {
    const actor = await this.crmReadonlyService.getUserById(actorUserId);
    return actor ?? null;
  }

  /**
   * 记录同一业务日同一任务是否已进入执行队列。
   *
   * @param businessDate Asia/Shanghai 业务日期。
   * @param job 调度任务类型。
   * @returns 首次进入队列返回 true，重复命中返回 false。
   */
  private markJobPending(
    businessDate: string,
    job: DailyReportScheduledJob,
  ): boolean {
    const key = `${businessDate}:${job}`;
    // 重复命中通常来自同一分钟内的多次轮询，必须拦截避免重复发送。
    if (this.executedJobKeys.has(key)) {
      return false;
    }

    this.executedJobKeys.add(key);
    return true;
  }

  /**
   * 将任意时间转换为 Asia/Shanghai 业务日期。
   *
   * @param input 原始时间。
   * @returns `YYYY-MM-DD` 格式的业务日期。
   */
  private formatShanghaiBusinessDate(input: Date): string {
    return new Date(input.getTime() + SHANGHAI_OFFSET_MS)
      .toISOString()
      .slice(0, 10);
  }

  /**
   * 将任意时间转换为 Asia/Shanghai 分钟粒度时间。
   *
   * @param input 原始时间。
   * @returns `HH:mm` 格式的本地业务时间。
   */
  private formatShanghaiTime(input: Date): string {
    return new Date(input.getTime() + SHANGHAI_OFFSET_MS)
      .toISOString()
      .slice(11, 16);
  }
}

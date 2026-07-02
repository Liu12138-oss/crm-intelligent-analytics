import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import { OpenApiMarkdownSnapshotService } from './openapi-markdown-snapshot.service';

@Injectable()
export class OpenApiMarkdownSnapshotSchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private intervalHandle?: ReturnType<typeof setInterval>;
  private currentRun?: Promise<void>;

  constructor(
    private readonly localRuntimeConfigService: LocalRuntimeConfigService,
    private readonly openApiMarkdownSnapshotService: OpenApiMarkdownSnapshotService,
    private readonly analysisLoggerService: AnalysisLoggerService,
  ) {}

  /**
   * 后端启动时注册 OpenAPI Markdown 快照刷新任务。
   *
   * 参数说明：无。
   * 返回值说明：无返回值。
   * 可能抛出的异常：不会主动向外抛出，单次刷新失败只记录告警。
   * 调用注意事项：只在配置启用且非测试环境启动，避免单元测试留下后台定时器。
   */
  onModuleInit(): void {
    const config = this.localRuntimeConfigService.getCrmOpenApiMarkdownSnapshotConfig();

    // 单元测试环境不启动后台定时器，防止测试进程被长生命周期任务挂住。
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    // 快照总开关和刷新开关分离，允许只手动生成文件，不让后台定时请求 OpenAPI。
    if (!config.enabled || !config.refreshEnabled) {
      this.analysisLoggerService.logStep('OpenAPI Markdown 分析快照定时刷新未启动。', {
        enabled: config.enabled,
        refreshEnabled: config.refreshEnabled,
      });
      return;
    }

    // 启动后立即刷新可保证企微问答优先拿到最新 Markdown；失败不阻断后端启动。
    if (config.refreshOnStartup) {
      void this.refreshSnapshot('startup');
    }

    this.intervalHandle = setInterval(() => {
      void this.refreshSnapshot('interval');
    }, config.refreshIntervalMinutes * 60_000);
    this.analysisLoggerService.logStep('OpenAPI Markdown 分析快照定时刷新已启动。', {
      refreshIntervalMinutes: config.refreshIntervalMinutes,
      refreshOnStartup: config.refreshOnStartup,
    });
  }

  /**
   * 后端关闭时释放快照刷新定时器。
   *
   * 参数说明：无。
   * 返回值说明：无返回值。
   * 可能抛出的异常：无。
   * 调用注意事项：热重载或进程退出时必须清理，避免重复调度。
   */
  onModuleDestroy(): void {
    // 只有已注册定时器时才清理，避免误清其它模块的后台任务。
    if (!this.intervalHandle) {
      return;
    }

    clearInterval(this.intervalHandle);
    this.intervalHandle = undefined;
  }

  /**
   * 执行一次 OpenAPI Markdown 快照刷新。
   *
   * 参数说明：`trigger` 表示触发来源，取值为启动刷新或周期刷新。
   * 返回值说明：无返回值。
   * 可能抛出的异常：内部捕获并记录，避免刷新失败影响主服务。
   * 调用注意事项：并发刷新会被跳过，防止同一批 OpenAPI 请求重叠执行。
   */
  private async refreshSnapshot(trigger: 'startup' | 'interval'): Promise<void> {
    // 上一次刷新未结束时跳过本轮，避免对方 OpenAPI 慢响应时堆积请求。
    if (this.currentRun) {
      this.analysisLoggerService.logWarn('OpenAPI Markdown 分析快照刷新已跳过，上一轮仍在执行。', {
        trigger,
      });
      return;
    }

    this.currentRun = this.openApiMarkdownSnapshotService
      .generateSnapshot()
      .then((manifest) => {
        this.analysisLoggerService.logStep('OpenAPI Markdown 分析快照刷新完成。', {
          trigger,
          outputDir: manifest.outputDir,
          counts: manifest.counts,
          warningCount: manifest.warnings.length,
        });
      })
      .catch((error) => {
        this.analysisLoggerService.logWarn('OpenAPI Markdown 分析快照刷新失败，已保留上一版快照。', {
          trigger,
          reason: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        this.currentRun = undefined;
      });

    await this.currentRun;
  }
}

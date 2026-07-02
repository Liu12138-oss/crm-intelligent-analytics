import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AnalysisWarehouseSyncService } from './analysis-warehouse-sync.service';
import type { RunAnalysisWarehouseSyncRequest } from './analysis-warehouse-sync.service';
import {
  AnalysisWarehouseQueryExecutorService,
  type ExecuteAnalysisWarehouseQueryRequest,
} from './analysis-warehouse-query-executor.service';

@Controller('governance/analysis-warehouse')
@UseGuards(SessionAuthGuard)
export class AnalysisWarehouseController {
  constructor(
    private readonly analysisWarehouseSyncService: AnalysisWarehouseSyncService,
    private readonly analysisWarehouseQueryExecutorService: AnalysisWarehouseQueryExecutorService,
  ) {}

  /**
   * 读取智能分析数据仓库同步概览。
   *
   * 参数说明：`request.crmUser` 为当前登录 CRM 用户。
   * 返回值说明：返回来源配置状态、最近同步结果、资源快照数和检查点。
   * 调用注意事项：该入口只展示治理元数据，不返回同步后的业务明细。
   */
  @Get('overview')
  async getOverview(@Req() request: Request & { crmUser: any }) {
    return await this.analysisWarehouseSyncService.getOverview(request.crmUser);
  }

  /**
   * 手动触发一次智能分析数据仓库同步。
   *
   * 参数说明：
   * - `request.crmUser`：当前治理操作者。
   * - `body`：同步来源、资源、分页和 dry-run 参数。
   * 返回值说明：返回本次同步运行记录。
   * 调用注意事项：默认从联软标准 OpenAPI 同步；SQLite 与文件来源当前只返回兼容状态。
   */
  @Post('sync-runs')
  async runSync(
    @Req() request: Request & { crmUser: any },
    @Body() body: RunAnalysisWarehouseSyncRequest,
  ) {
    return await this.analysisWarehouseSyncService.runSync(
      request.crmUser,
      body ?? {},
    );
  }

  /**
   * 校验或执行受控分析库 SQL。
   *
   * 参数说明：
   * - `request.crmUser`：当前治理操作者。
   * - `body`：候选 SELECT、参数、超时和 dry-run 标记。
   * 返回值说明：默认只返回校验结果；显式 `dryRun=false` 时执行查询。
   * 调用注意事项：该入口只供治理联调，不面向企微普通问数直接暴露。
   */
  @Post('controlled-query')
  async executeControlledQuery(
    @Req() request: Request & { crmUser: any },
    @Body() body: ExecuteAnalysisWarehouseQueryRequest,
  ) {
    return await this.analysisWarehouseQueryExecutorService.execute(
      request.crmUser,
      body,
    );
  }
}

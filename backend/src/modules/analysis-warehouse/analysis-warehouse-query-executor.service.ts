import { Injectable } from '@nestjs/common';
import { AnalysisWarehouseMysqlService } from '../../database/analysis-warehouse/analysis-warehouse-mysql.service';
import { PermissionEnforcementService } from '../governance/permission-enforcement.service';
import { AnalysisWarehouseSqlGuardService } from './analysis-warehouse-sql-guard.service';
import type { CrmUser } from '../../shared/types/domain';

export interface ExecuteAnalysisWarehouseQueryRequest {
  sql: string;
  params?: unknown[];
  timeoutMs?: number;
  dryRun?: boolean;
}

@Injectable()
export class AnalysisWarehouseQueryExecutorService {
  constructor(
    private readonly analysisWarehouseMysqlService: AnalysisWarehouseMysqlService,
    private readonly permissionEnforcementService: PermissionEnforcementService,
    private readonly analysisWarehouseSqlGuardService: AnalysisWarehouseSqlGuardService,
  ) {}

  /**
   * 校验或执行受控分析库 SELECT。
   *
   * 参数说明：
   * - `user`：当前治理操作者。
   * - `request`：候选 SQL、参数、超时和 dry-run 标记。
   * 返回值说明：dry-run 返回校验结果；执行模式返回行数据和行数。
   * 调用注意事项：该入口仅用于治理联调和后续程序化 Text-to-SQL 执行底座，不面向普通用户自由输入。
   */
  async execute(
    user: CrmUser,
    request: ExecuteAnalysisWarehouseQueryRequest,
  ): Promise<Record<string, unknown>> {
    this.ensureAccess(user);
    const validation = this.analysisWarehouseSqlGuardService.validateAndNormalize(
      request.sql,
      {
        defaultLimit: 100,
        maxLimit: 1000,
      },
    );

    if (request.dryRun !== false) {
      return {
        status: 'VALIDATED',
        ...validation,
      };
    }

    const rows = await this.analysisWarehouseMysqlService.executeSelect(
      validation.normalizedSql,
      Array.isArray(request.params) ? request.params : [],
      this.normalizeTimeoutMs(request.timeoutMs),
    );

    return {
      status: 'SUCCEEDED',
      ...validation,
      rowCount: rows.length,
      rows,
    };
  }

  /**
   * 校验当前用户是否允许使用分析库治理执行器。
   *
   * 参数说明：`user` 为当前登录用户。
   * 返回值说明：无返回值；无权限时抛错。
   * 调用注意事项：先用治理策略管理权限收口，后续可拆成专用权限键。
   */
  private ensureAccess(user: CrmUser): void {
    this.permissionEnforcementService.ensureAction(
      user,
      'governance.policy.manage',
      '当前用户无权使用 AI-agent 分析库 SQL 联调能力。',
      {
        channel: 'web-console',
        resourceType: 'analysis-warehouse-sql',
      },
    );
  }

  /**
   * 标准化查询超时。
   */
  private normalizeTimeoutMs(timeoutMs?: number): number {
    const value = Number(timeoutMs ?? 5000);
    if (!Number.isFinite(value)) {
      return 5000;
    }
    return Math.min(Math.max(Math.trunc(value), 1000), 30000);
  }
}

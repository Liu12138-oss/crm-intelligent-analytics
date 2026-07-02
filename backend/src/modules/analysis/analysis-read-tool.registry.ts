import { Injectable } from '@nestjs/common';
import type {
  AnalysisExecutionMode,
  AnalysisRoute,
  AnalysisExecutionSource,
} from '../../shared/types/domain';
import { OpenApiCapabilityGapError } from './analysis.errors';
import type { CompiledQueryTask } from './query-compiler.service';

export interface AnalysisReadToolSpec {
  toolId: string;
  toolType: AnalysisExecutionSource;
  allowedStatements: Array<'SELECT' | 'WITH_SELECT' | 'CRM_API_GET'>;
  allowedTables: string[];
  allowedFields: Record<string, string[]>;
  allowedFunctions: string[];
  outputShape: 'DATASET_SLICE';
  rowLimit: number;
  timeoutMs: number;
}

export interface AnalysisReadRoute {
  executionMode: AnalysisExecutionMode;
  executionSource: AnalysisExecutionSource;
  preferredSource: AnalysisExecutionSource;
  matchedAdapter: string;
  gapReason: string;
  toolSpec: AnalysisReadToolSpec;
}

export interface RoutedCompiledQueryTask extends CompiledQueryTask, AnalysisReadRoute {}

@Injectable()
export class AnalysisReadToolRegistryService {
  resolveReadRoute(
    compiledTask: CompiledQueryTask,
    executionMode: AnalysisExecutionMode,
    analysisRoute: AnalysisRoute = 'OPENAPI',
  ): AnalysisReadRoute {
    if (analysisRoute === 'SQLITE_READONLY') {
      throw new OpenApiCapabilityGapError(
        '当前正式分析只启用 OpenAPI Markdown 快照主链，SQLite、MySQL、受控 SQL 等历史兜底路线已临时停用。',
      );
    }

    const preferredSource: AnalysisExecutionSource = 'CRM_OFFICIAL_API';
    const officialAdapter = this.matchOfficialApiAdapter(compiledTask);
    if (officialAdapter) {
      return {
        executionMode,
        executionSource: 'CRM_OFFICIAL_API',
        preferredSource,
        matchedAdapter: officialAdapter,
        gapReason: '',
        toolSpec: this.buildOfficialApiToolSpec(compiledTask, officialAdapter),
      };
    }

    throw new OpenApiCapabilityGapError(
      this.buildOpenApiCapabilityGapReason(compiledTask),
    );
  }

  private matchOfficialApiAdapter(compiledTask: CompiledQueryTask): string | undefined {
    if (compiledTask.plan.domain === 'opportunity-analysis') {
      if (compiledTask.resultKind === 'metric-summary') {
        return 'crm-official-api.opportunity-metric-summary';
      }

      if (compiledTask.resultKind === 'owner-ranking') {
        return 'crm-official-api.opportunity-owner-ranking';
      }

      if (compiledTask.resultKind === 'time-trend') {
        return 'crm-official-api.opportunity-time-trend';
      }

      if (compiledTask.resultKind === 'stage-distribution') {
        return 'crm-official-api.opportunity-stage-distribution';
      }

      if (compiledTask.resultKind === 'risk-overview') {
        return 'crm-official-api.opportunity-risk-overview';
      }

      if (compiledTask.resultKind === 'department-contribution') {
        return 'crm-official-api.opportunity-region-contribution';
      }

      if (compiledTask.resultKind === 'partner-contribution') {
        return 'crm-official-api.opportunity-partner-contribution';
      }
    }

    if (
      compiledTask.plan.domain === 'customer-relationship' &&
      (
        compiledTask.resultKind === 'metric-summary' ||
        compiledTask.resultKind === 'owner-ranking' ||
        compiledTask.resultKind === 'time-trend' ||
        compiledTask.resultKind === 'category-distribution' ||
        compiledTask.resultKind === 'department-contribution'
      )
    ) {
      return `crm-official-api.customer-${compiledTask.resultKind}`;
    }

    if (
      compiledTask.plan.domain === 'contract-conversion' &&
      (
        compiledTask.resultKind === 'metric-summary' ||
        compiledTask.resultKind === 'owner-ranking' ||
        compiledTask.resultKind === 'time-trend' ||
        compiledTask.resultKind === 'category-distribution' ||
        compiledTask.resultKind === 'department-contribution' ||
        compiledTask.resultKind === 'partner-contribution'
      )
    ) {
      return `crm-official-api.order-${compiledTask.resultKind}`;
    }

    return undefined;
  }

  private buildOfficialApiToolSpec(
    compiledTask: CompiledQueryTask,
    adapterId: string,
  ): AnalysisReadToolSpec {
    return {
      toolId: adapterId,
      toolType: 'CRM_OFFICIAL_API',
      allowedStatements: ['CRM_API_GET'],
      allowedTables: compiledTask.tables,
      allowedFields: compiledTask.fieldMap,
      allowedFunctions: [],
      outputShape: 'DATASET_SLICE',
      rowLimit: compiledTask.rowLimit,
      timeoutMs: compiledTask.timeoutMs,
    };
  }

  /**
   * 构造 OpenAPI 能力缺口提示。
   *
   * 参数说明：`compiledTask` 为已编译但未命中 OpenAPI 适配器的读取任务。
   * 返回值说明：返回面向业务和联软联调的缺口描述。
   * 调用注意事项：正式 CRM 分析主链不再自动退回 SQL/SQLite/分析库，必须显式暴露缺口。
   */
  private buildOpenApiCapabilityGapReason(compiledTask: CompiledQueryTask): string {
    const objectLabel = this.resolveDomainLabel(compiledTask.plan.domain);
    const resultLabel = this.resolveResultKindLabel(compiledTask.resultKind);
    return [
      `当前联软标准 OpenAPI 暂不支持“${compiledTask.taskTitle}”所需的${objectLabel}${resultLabel}分析口径。`,
      '请联软补齐对应资源接口、返回字段、筛选条件、聚合能力或关联关系后再执行；系统已停止自动切换 SQLite、MySQL 分析库或受控 SQL 兜底，避免返回脱敏样例或非真实明细。',
    ].join('');
  }

  /**
   * 解析分析域中文标签。
   *
   * 参数说明：`domain` 为旧版分析域。
   * 返回值说明：返回业务用户可读对象标签。
   */
  private resolveDomainLabel(domain: CompiledQueryTask['plan']['domain']): string {
    if (domain === 'contract-conversion') {
      return '订单/合同';
    }
    if (domain === 'customer-relationship') {
      return '客户/报备';
    }
    return '商机';
  }

  /**
   * 解析结果形态中文标签。
   *
   * 参数说明：`resultKind` 为计划器生成的结果类型。
   * 返回值说明：返回业务口径说明。
   */
  private resolveResultKindLabel(resultKind: CompiledQueryTask['resultKind']): string {
    const labels: Record<CompiledQueryTask['resultKind'], string> = {
      'metric-summary': '汇总',
      'owner-ranking': '负责人排行',
      'time-trend': '趋势',
      'stage-distribution': '阶段分布',
      'category-distribution': '分类分布',
      'department-contribution': '区域贡献',
      'partner-contribution': '渠道商贡献',
      'risk-overview': '风险概览',
    };
    return labels[resultKind] ?? resultKind;
  }
}

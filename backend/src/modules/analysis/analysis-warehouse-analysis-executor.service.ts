import { Injectable, Optional } from '@nestjs/common';
import {
  AnalysisWarehouseMysqlService,
  type AnalysisWarehouseUserScopeHint,
} from '../../database/analysis-warehouse/analysis-warehouse-mysql.service';
import {
  buildAnalysisWarehouseSemanticFieldSeeds,
  buildAnalysisWarehouseSemanticMetricSeeds,
} from '../../database/analysis-warehouse/analysis-warehouse-semantic-seeds';
import type {
  AnalysisDatasetSlice,
  AnalysisIntent,
  AnalysisWarehouseResource,
  ChannelType,
  CrmUser,
  MetricCard,
  QueryPlanResultKind,
  ResultTemporalScope,
  ResultView,
  ScopeSnapshot,
} from '../../shared/types/domain';
import { formatWanAmount } from '../../shared/utils/business-amount.util';
import { buildEntityId } from '../../shared/utils/id.util';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import { AnalysisWarehouseSqlGuardService } from '../analysis-warehouse/analysis-warehouse-sql-guard.service';
import { AnalysisWarehouseSqliteSnapshotImporterService } from '../analysis-warehouse/analysis-warehouse-sqlite-snapshot-importer.service';
import { AiGatewayService } from './ai-gateway.service';
import { buildResultTemporalScope, formatTemporalScopeLabel } from './temporal-scope.util';
import {
  buildStaleOpportunityAnalysisTitle,
  buildStaleOpportunityDetailTitle,
  buildStaleOpportunityRiskScopeText,
  buildStaleOpportunitySortScopeText,
  isStaleOpportunityQuestionText,
  resolveStaleOpportunityThreshold,
} from './stale-opportunity-threshold.util';
import {
  LianruanCrmAnalysisExecutorService,
  type LianruanCrmOpenApiBusinessChainSnapshot,
} from './lianruan-crm-analysis-executor.service';
import { formatOpportunityStageLabel } from './opportunity-stage-label.util';

export interface AnalysisWarehouseBusinessExecutionResult {
  slice: AnalysisDatasetSlice;
  sql: string;
  tables: string[];
  columns: string[];
  rowLimit: number;
  timeoutMs: number;
  fallbackReason?: string;
}

type WarehouseScopeMode = 'full' | 'region' | 'partner' | 'user' | 'mixed';

interface WarehouseScopeResolution {
  canUseWarehouse: boolean;
  mode: WarehouseScopeMode;
  regions: string[];
  bigRegions: string[];
  partnerIds: string[];
  userIds: string[];
  summary: string;
  hint?: AnalysisWarehouseUserScopeHint | null;
  fallbackReason?: string;
}

interface WarehouseScopePredicate {
  sql: string;
  params: unknown[];
}

interface GuardedWarehouseQueryResult {
  sql: string;
  tables: string[];
  columns: string[];
  rowLimit: number;
  rows: Array<Record<string, unknown>>;
}

interface SqliteSnapshotBusinessResource {
  resource: AnalysisWarehouseResource;
  rows: Array<Record<string, unknown>>;
  tableName: string;
  snapshotFile: string;
}

interface BusinessRegionFilter {
  regions: string[];
  bigRegions: string[];
  summary?: string;
}

type FixedBusinessTemplateKind =
  | 'partner-opportunity-growth'
  | 'opportunity-partner-overview'
  | 'partner-business-chain'
  | 'registration-partner-overview'
  | 'order-partner-overview'
  | 'business-briefing'
  | 'funnel-conversion'
  | 'quote-without-order'
  | 'composite-operations'
  | 'order-opportunity-overview'
  | 'registration-without-opportunity'
  | 'stale-opportunity'
  | 'inactive-customer'
  | 'order-summary';

type BusinessChainOpenApiResource = 'partners' | 'registrations' | 'opportunities' | 'orders';

const ROW_SCOPE_FIELDS: Record<
  string,
  {
    regions?: string[];
    bigRegions?: string[];
    partnerIds?: string[];
    userIds?: string[];
  }
> = {
  dim_lianruan_user: {
    regions: ['region'],
    bigRegions: ['big_region'],
    partnerIds: ['partner_id'],
    userIds: ['user_id'],
  },
  dim_lianruan_partner: {
    regions: ['region'],
    bigRegions: ['big_region'],
    partnerIds: ['partner_id', 'parent_partner_id'],
  },
  dim_lianruan_customer: {
    regions: ['region'],
    bigRegions: ['big_region'],
    partnerIds: ['partner_id'],
    userIds: ['owner_id', 'assigned_staff_id'],
  },
  fact_lianruan_registration: {
    regions: ['region'],
    bigRegions: ['big_region'],
    partnerIds: ['partner_id'],
    userIds: ['created_by', 'assigned_staff_id'],
  },
  fact_lianruan_opportunity: {
    regions: ['region'],
    bigRegions: ['big_region'],
    partnerIds: ['partner_id', 'assigned_partner_id'],
    userIds: ['owner_id', 'assigned_staff_id'],
  },
  fact_lianruan_quote: {
    regions: ['region'],
    bigRegions: ['big_region'],
    partnerIds: ['partner_id', 'assigned_partner_id', 'parent_partner_id'],
    userIds: ['owner_id', 'assigned_staff_id'],
  },
  fact_lianruan_order: {
    regions: ['region'],
    bigRegions: ['big_region'],
    partnerIds: ['partner_id', 'parent_partner_id', 'assigned_partner_id'],
    userIds: ['owner_id', 'assigned_staff_id'],
  },
};

const SCOPED_BUSINESS_TABLES = new Set(Object.keys(ROW_SCOPE_FIELDS));

/**
 * 执行 AI-agent 分析库 Text-to-SQL 问数。
 *
 * 参数说明：通过构造函数注入分析库连接、SQL Guard、AI 网关和日志服务。
 * 返回值说明：对外暴露 `tryExecute`，成功返回统一数据切片，失败返回 `null` 交由旧链路兜底。
 * 调用注意事项：全量权限可直接执行受控 SQL；非全量权限必须先解析出行级范围并注入 SQL，注入失败时回退旧链路。
 */
@Injectable()
export class AnalysisWarehouseAnalysisExecutorService {
  constructor(
    private readonly analysisWarehouseMysqlService: AnalysisWarehouseMysqlService,
    private readonly analysisWarehouseSqlGuardService: AnalysisWarehouseSqlGuardService,
    private readonly analysisWarehouseSqliteSnapshotImporterService: AnalysisWarehouseSqliteSnapshotImporterService,
    private readonly aiGatewayService: AiGatewayService,
    private readonly analysisLoggerService: AnalysisLoggerService,
    @Optional()
    private readonly lianruanCrmAnalysisExecutorService?: LianruanCrmAnalysisExecutorService,
  ) {}

  /**
   * 尝试通过分析库回答自然语言问数。
   *
   * 参数说明：
   * - `questionText/channel/user/intent/scopeSnapshot`：当前问数上下文和权限快照。
   * 返回值说明：成功返回统一数据切片和 SQL 元数据；不可用或不适合时返回 `null`。
   * 调用注意事项：该服务仅用于治理诊断和离线验证，正式 CRM 分析主链不得自动调用。
   */
  async tryExecute(params: {
    questionText: string;
    channel: ChannelType;
    user: CrmUser;
    intent: AnalysisIntent;
    scopeSnapshot: ScopeSnapshot;
  }): Promise<AnalysisWarehouseBusinessExecutionResult | null> {
    try {
      const sqliteSnapshotResult = await this.tryExecuteSqliteSnapshotFixedBusinessQuery(params);
      if (sqliteSnapshotResult) {
        return sqliteSnapshotResult;
      }
    } catch (error) {
      this.analysisLoggerService.logWarn('SQLite 脱敏快照固定模板执行失败，已停止本次分析库诊断模板执行。', {
        userId: params.user.id,
        reason: error instanceof Error ? error.message : 'unknown',
      });
    }

    if (!this.isTextToSqlEnabled()) {
      return null;
    }

    if (!this.analysisWarehouseMysqlService.isConfigured()) {
      return null;
    }

    const warehouseScope = await this.resolveWarehouseScope(params.user, params.scopeSnapshot);
    if (!warehouseScope.canUseWarehouse) {
      this.analysisLoggerService.logStep('分析库 Text-to-SQL 已跳过，当前用户缺少可安全注入的行级范围。', {
        userId: params.user.id,
        fallbackReason: warehouseScope.fallbackReason,
      });
      return null;
    }

    try {
      const fixedQueryResult = await this.tryExecuteFixedBusinessQuery({
        ...params,
        warehouseScope,
      });
      if (fixedQueryResult) {
        return fixedQueryResult;
      }
    } catch (error) {
      this.analysisLoggerService.logWarn('分析库固定业务模板执行失败，已停止本次离线诊断模板执行。', {
        userId: params.user.id,
        reason: error instanceof Error ? error.message : 'unknown',
      });
      return null;
    }

    const generatedTask = await this.aiGatewayService.generateAnalysisWarehouseQueryTask({
      questionText: params.questionText,
      channel: params.channel,
      semanticCatalogText: this.buildSemanticCatalogText(),
      metricCatalogText: this.buildMetricCatalogText(),
      scopeSummary: params.scopeSnapshot.scopeSummary,
      temporalSlot: params.intent.temporalSlot,
    });
    if (!generatedTask) {
      return null;
    }

    try {
      const scopedTask = this.applyScopeToGeneratedSql(generatedTask.sql, warehouseScope);
      if (!scopedTask) {
        this.analysisLoggerService.logStep('分析库 AI SQL 未能安全注入行级权限，已停止本次离线诊断 SQL 执行。', {
          userId: params.user.id,
          scopeMode: warehouseScope.mode,
        });
        return null;
      }
      const validation = this.analysisWarehouseSqlGuardService.validateAndNormalize(
        scopedTask.sql,
        {
          defaultLimit: generatedTask.rowLimit,
          maxLimit: 1000,
        },
      );
      const rows = await this.analysisWarehouseMysqlService.executeSelect<Record<string, unknown>>(
        validation.normalizedSql,
        scopedTask.params,
        generatedTask.timeoutMs,
      );
      const slice = this.buildSlice({
        taskTitle: generatedTask.taskTitle,
        resultKind: generatedTask.resultKind,
        rows,
        sql: validation.normalizedSql,
        temporalSlot: generatedTask.temporalSlot ?? params.intent.temporalSlot,
        scopeSummary: warehouseScope.summary,
        rowLimit: validation.appliedLimit,
      });

      return {
        slice,
        sql: validation.normalizedSql,
        tables: validation.tables,
        columns: validation.columns,
        rowLimit: validation.appliedLimit,
        timeoutMs: generatedTask.timeoutMs,
      };
    } catch (error) {
      this.analysisLoggerService.logWarn('分析库 Text-to-SQL 执行失败，已停止本次离线诊断 SQL 执行。', {
        reason: error instanceof Error ? error.message : 'unknown',
      });
      return null;
    }
  }

  /**
   * 执行高频且口径明确的受控业务 SQL。
   *
   * 参数说明：`params` 为当前问数上下文。
   * 返回值说明：命中固定业务语义时返回结果；未命中时返回 `null`，由离线诊断流程自行决定是否继续。
   * 调用注意事项：该能力只服务治理诊断和离线验证，不能作为正式 CRM 分析主链的结果来源。
   */
  private async tryExecuteFixedBusinessQuery(params: {
    questionText: string;
    channel: ChannelType;
    user: CrmUser;
    intent: AnalysisIntent;
    scopeSnapshot: ScopeSnapshot;
    warehouseScope: WarehouseScopeResolution;
  }): Promise<AnalysisWarehouseBusinessExecutionResult | null> {
    const templateKind = this.resolveFixedBusinessTemplateKind(params.questionText, params.intent);

    if (templateKind === 'partner-opportunity-growth') {
      return this.executePartnerOpportunityGrowthQuery(params);
    }

    if (templateKind === 'business-briefing') {
      return this.executeBusinessBriefingQuery(params);
    }

    if (templateKind === 'funnel-conversion') {
      return this.executeFunnelConversionQuery(params);
    }

    if (templateKind === 'quote-without-order') {
      return this.executeQuoteWithoutOrderQuery(params);
    }

    if (templateKind === 'composite-operations') {
      return this.executeCompositeOperationsQuery(params);
    }

    if (templateKind === 'order-opportunity-overview') {
      return this.executeOrderOpportunityOverviewQuery(params);
    }

    if (templateKind === 'registration-without-opportunity') {
      return this.executeRegistrationWithoutOpportunityQuery(params);
    }

    if (templateKind === 'stale-opportunity') {
      return this.executeStaleOpportunityQuery(params);
    }

    if (templateKind === 'inactive-customer') {
      return this.executeInactiveCustomerQuery(params);
    }

    if (templateKind === 'order-summary') {
      return this.executeOrderSummaryQuery(params);
    }

    return null;
  }

  /**
   * 执行“渠道商新增 + 商机增长”双区块分析模板。
   *
   * 参数说明：`params` 为当前问数上下文和已解析权限范围。
   * 返回值说明：返回渠道商新增表格区块和商机增长趋势区块。
   * 调用注意事项：用户同时要求两个对象时必须拆成两个受控子任务，避免把渠道商和商机混成一张表。
   */
  private async executePartnerOpportunityGrowthQuery(params: {
    questionText: string;
    channel: ChannelType;
    user: CrmUser;
    intent: AnalysisIntent;
    scopeSnapshot: ScopeSnapshot;
    warehouseScope: WarehouseScopeResolution;
  }): Promise<AnalysisWarehouseBusinessExecutionResult | null> {
    const businessRegionFilter = this.resolveBusinessRegionFilter(params.questionText);
    const partnerScope = this.buildScopePredicateForAlias(
      'dim_lianruan_partner',
      'p',
      params.warehouseScope,
    );
    const opportunityScope = this.buildScopePredicateForAlias(
      'fact_lianruan_opportunity',
      'o',
      params.warehouseScope,
    );

    if (!partnerScope || !opportunityScope) {
      this.analysisLoggerService.logStep('渠道商新增与商机增长模板缺少可注入权限范围，已回退现有链路。', {
        userId: params.user.id,
        scopeMode: params.warehouseScope.mode,
      });
      return null;
    }

    const partnerRegionPredicate = this.buildBusinessRegionPredicateForAlias(
      'dim_lianruan_partner',
      'p',
      businessRegionFilter,
    );
    const opportunityRegionPredicate = this.buildBusinessRegionPredicateForAlias(
      'fact_lianruan_opportunity',
      'o',
      businessRegionFilter,
    );
    const partnerTemporal = this.buildTemplateTemporalPredicate(
      'p.created_at',
      params.intent.temporalSlot,
      params.questionText,
    );
    const opportunityTemporal = this.buildTemplateTemporalPredicate(
      'o.created_at',
      params.intent.temporalSlot,
      params.questionText,
    );
    const partnerSql = `
      SELECT
        DATE_FORMAT(p.created_at, '%Y-%m') AS month_label,
        COUNT(p.partner_id) AS new_partner_count
      FROM dim_lianruan_partner p
      WHERE p.created_at IS NOT NULL
        ${partnerScope.sql ? `AND (${partnerScope.sql})` : ''}
        ${partnerRegionPredicate.sql ? `AND (${partnerRegionPredicate.sql})` : ''}
        ${partnerTemporal.predicate.sql ? `AND (${partnerTemporal.predicate.sql})` : ''}
      GROUP BY DATE_FORMAT(p.created_at, '%Y-%m')
      ORDER BY month_label ASC
      LIMIT 100
    `;
    const opportunitySql = `
      SELECT
        DATE_FORMAT(o.created_at, '%Y-%m') AS month_label,
        COUNT(o.opportunity_id) AS new_opportunity_count,
        SUM(COALESCE(o.amount, 0)) AS opportunity_amount
      FROM fact_lianruan_opportunity o
      WHERE o.created_at IS NOT NULL
        ${opportunityScope.sql ? `AND (${opportunityScope.sql})` : ''}
        ${opportunityRegionPredicate.sql ? `AND (${opportunityRegionPredicate.sql})` : ''}
        ${opportunityTemporal.predicate.sql ? `AND (${opportunityTemporal.predicate.sql})` : ''}
      GROUP BY DATE_FORMAT(o.created_at, '%Y-%m')
      ORDER BY month_label ASC
      LIMIT 100
    `;
    const partnerQuery = await this.executeGuardedWarehouseQuery(
      partnerSql,
      [
        ...partnerScope.params,
        ...partnerRegionPredicate.params,
        ...partnerTemporal.predicate.params,
      ],
      5000,
      100,
    );
    const opportunityQuery = await this.executeGuardedWarehouseQuery(
      opportunitySql,
      [
        ...opportunityScope.params,
        ...opportunityRegionPredicate.params,
        ...opportunityTemporal.predicate.params,
      ],
      5000,
      100,
    );
    const slice = this.buildPartnerOpportunityGrowthSlice({
      partnerRows: partnerQuery.rows,
      opportunityRows: opportunityQuery.rows,
      sql: [
        partnerQuery.sql,
        opportunityQuery.sql,
      ].join('\n\n-- P4 渠道商新增与商机增长子任务分隔 --\n\n'),
      temporalScope: partnerTemporal.temporalScope ?? opportunityTemporal.temporalScope,
      scopeSummary: params.warehouseScope.summary,
      businessRegionFilter,
    });

    return {
      slice,
      sql: slice.sql,
      tables: this.uniqueStrings([...partnerQuery.tables, ...opportunityQuery.tables]),
      columns: this.uniqueStrings([...partnerQuery.columns, ...opportunityQuery.columns]),
      rowLimit: Math.max(partnerQuery.rowLimit, opportunityQuery.rowLimit),
      timeoutMs: 8000,
    };
  }

  /**
   * 执行“订单情况 + 商机情况”双区块分析模板。
   *
   * 参数说明：`params` 为当前问数上下文和已解析权限范围。
   * 返回值说明：返回订单月度趋势区块和商机月度趋势区块。
   * 调用注意事项：订单与商机是两个独立业务对象，不能误归为漏斗或合同转化；两条 SQL 仍分别经过权限注入和 SQL Guard。
   */
  private async executeOrderOpportunityOverviewQuery(params: {
    questionText: string;
    channel: ChannelType;
    user: CrmUser;
    intent: AnalysisIntent;
    scopeSnapshot: ScopeSnapshot;
    warehouseScope: WarehouseScopeResolution;
  }): Promise<AnalysisWarehouseBusinessExecutionResult | null> {
    const businessRegionFilter = this.resolveBusinessRegionFilter(params.questionText);
    const orderScope = this.buildScopePredicateForAlias(
      'fact_lianruan_order',
      'o',
      params.warehouseScope,
    );
    const opportunityScope = this.buildScopePredicateForAlias(
      'fact_lianruan_opportunity',
      'opp',
      params.warehouseScope,
    );

    if (!orderScope || !opportunityScope) {
      this.analysisLoggerService.logStep('订单与商机双区块模板缺少可注入权限范围，已回退现有链路。', {
        userId: params.user.id,
        scopeMode: params.warehouseScope.mode,
      });
      return null;
    }

    const orderRegionPredicate = this.buildBusinessRegionPredicateForAlias(
      'fact_lianruan_order',
      'o',
      businessRegionFilter,
    );
    const opportunityRegionPredicate = this.buildBusinessRegionPredicateForAlias(
      'fact_lianruan_opportunity',
      'opp',
      businessRegionFilter,
    );
    const orderTemporal = this.buildTemplateTemporalPredicate(
      'COALESCE(o.deal_at, o.created_at)',
      params.intent.temporalSlot,
      params.questionText,
    );
    const opportunityTemporal = this.buildTemplateTemporalPredicate(
      'opp.created_at',
      params.intent.temporalSlot,
      params.questionText,
    );
    const orderSql = `
      SELECT
        DATE_FORMAT(COALESCE(o.deal_at, o.created_at), '%Y-%m') AS month_label,
        COUNT(o.order_id) AS order_count,
        SUM(COALESCE(o.amount, 0)) AS order_amount
      FROM fact_lianruan_order o
      WHERE COALESCE(o.deal_at, o.created_at) IS NOT NULL
        AND ${this.buildEffectiveOrderWhereSql('o')}
        ${orderScope.sql ? `AND (${orderScope.sql})` : ''}
        ${orderRegionPredicate.sql ? `AND (${orderRegionPredicate.sql})` : ''}
        ${orderTemporal.predicate.sql ? `AND (${orderTemporal.predicate.sql})` : ''}
      GROUP BY DATE_FORMAT(COALESCE(o.deal_at, o.created_at), '%Y-%m')
      ORDER BY month_label ASC
      LIMIT 100
    `;
    const opportunitySql = `
      SELECT
        DATE_FORMAT(opp.created_at, '%Y-%m') AS month_label,
        COUNT(opp.opportunity_id) AS opportunity_count,
        SUM(COALESCE(opp.amount, 0)) AS opportunity_amount
      FROM fact_lianruan_opportunity opp
      WHERE opp.created_at IS NOT NULL
        ${opportunityScope.sql ? `AND (${opportunityScope.sql})` : ''}
        ${opportunityRegionPredicate.sql ? `AND (${opportunityRegionPredicate.sql})` : ''}
        ${opportunityTemporal.predicate.sql ? `AND (${opportunityTemporal.predicate.sql})` : ''}
      GROUP BY DATE_FORMAT(opp.created_at, '%Y-%m')
      ORDER BY month_label ASC
      LIMIT 100
    `;
    const orderQuery = await this.executeGuardedWarehouseQuery(
      orderSql,
      [
        ...orderScope.params,
        ...orderRegionPredicate.params,
        ...orderTemporal.predicate.params,
      ],
      5000,
      100,
    );
    const opportunityQuery = await this.executeGuardedWarehouseQuery(
      opportunitySql,
      [
        ...opportunityScope.params,
        ...opportunityRegionPredicate.params,
        ...opportunityTemporal.predicate.params,
      ],
      5000,
      100,
    );
    const slice = this.buildOrderOpportunityOverviewSlice({
      orderRows: orderQuery.rows,
      opportunityRows: opportunityQuery.rows,
      sql: [
        orderQuery.sql,
        opportunityQuery.sql,
      ].join('\n\n-- P5 订单与商机双区块子任务分隔 --\n\n'),
      temporalScope: orderTemporal.temporalScope ?? opportunityTemporal.temporalScope,
      scopeSummary: params.warehouseScope.summary,
      businessRegionFilter,
    });

    return {
      slice,
      sql: slice.sql,
      tables: this.uniqueStrings([...orderQuery.tables, ...opportunityQuery.tables]),
      columns: this.uniqueStrings([...orderQuery.columns, ...opportunityQuery.columns]),
      rowLimit: Math.max(orderQuery.rowLimit, opportunityQuery.rowLimit),
      timeoutMs: 8000,
    };
  }

  /**
   * 执行“经营简报/经营报告”受控多子任务模板。
   *
   * 参数说明：`params` 为当前问数上下文和已解析权限范围。
   * 返回值说明：返回一个包含经营概览、漏斗、报价未下单和风险明细的综合报告切片。
   * 调用注意事项：该模板只编排已存在的受控模板，不复制 SQL 口径，避免 P4 多子任务报告与单项模板口径漂移。
   */
  private async executeBusinessBriefingQuery(params: {
    questionText: string;
    channel: ChannelType;
    user: CrmUser;
    intent: AnalysisIntent;
    scopeSnapshot: ScopeSnapshot;
    warehouseScope: WarehouseScopeResolution;
  }): Promise<AnalysisWarehouseBusinessExecutionResult | null> {
    const compositeResult = await this.executeCompositeOperationsQuery(params);
    const funnelResult = await this.executeFunnelConversionQuery(params);
    const quoteRiskResult = await this.executeQuoteWithoutOrderQuery(params);

    if (!compositeResult || !funnelResult || !quoteRiskResult) {
      return null;
    }

    const slice = this.buildBusinessBriefingSlice({
      compositeSlice: compositeResult.slice,
      funnelSlice: funnelResult.slice,
      quoteRiskSlice: quoteRiskResult.slice,
      sql: [
        compositeResult.sql,
        funnelResult.sql,
        quoteRiskResult.sql,
      ].join('\n\n-- P4 经营简报子任务分隔 --\n\n'),
      temporalSlot: params.intent.temporalSlot,
      scopeSummary: params.warehouseScope.summary,
      businessRegionFilter: this.resolveBusinessRegionFilter(params.questionText),
    });

    return {
      slice,
      sql: slice.sql,
      tables: this.uniqueStrings([
        ...compositeResult.tables,
        ...funnelResult.tables,
        ...quoteRiskResult.tables,
      ]),
      columns: this.uniqueStrings([
        ...compositeResult.columns,
        ...funnelResult.columns,
        ...quoteRiskResult.columns,
      ]),
      rowLimit: Math.max(
        compositeResult.rowLimit,
        funnelResult.rowLimit,
        quoteRiskResult.rowLimit,
      ),
      timeoutMs: 12000,
    };
  }

  /**
   * 执行“客户、报备、商机、订单、风险”组合经营报告模板。
   *
   * 参数说明：`params` 为当前问数上下文和已解析权限范围。
   * 返回值说明：返回一个组合结果切片，内部包含概览表、未关联商机客户报备明细和超期商机明细。
   * 调用注意事项：组合模板仍由多条固定只读 SQL 组成，每一条都单独经过 SQL Guard、权限注入和审计。
   */
  private async executeCompositeOperationsQuery(params: {
    questionText: string;
    channel: ChannelType;
    user: CrmUser;
    intent: AnalysisIntent;
    scopeSnapshot: ScopeSnapshot;
    warehouseScope: WarehouseScopeResolution;
  }): Promise<AnalysisWarehouseBusinessExecutionResult | null> {
    const businessRegionFilter = this.resolveBusinessRegionFilter(params.questionText);
    const partnerQuery = await this.executeScopedAggregateQuery({
      tableName: 'dim_lianruan_partner',
      alias: 'p',
      selectSql: `
        SELECT
          COUNT(p.partner_id) AS partner_count
        FROM dim_lianruan_partner p
      `,
      baseWhereSql: '',
      orderSql: '',
      temporalField: 'p.created_at',
      params,
      businessRegionFilter,
    });
    const customerQuery = await this.executeScopedAggregateQuery({
      tableName: 'dim_lianruan_customer',
      alias: 'c',
      selectSql: `
        SELECT
          COUNT(c.customer_id) AS customer_count
        FROM dim_lianruan_customer c
      `,
      baseWhereSql: '',
      orderSql: '',
      temporalField: 'c.created_at',
      params,
      businessRegionFilter,
    });
    const registrationQuery = await this.executeScopedAggregateQuery({
      tableName: 'fact_lianruan_registration',
      alias: 'r',
      selectSql: `
        SELECT
          COUNT(r.registration_id) AS registration_count
        FROM fact_lianruan_registration r
      `,
      baseWhereSql: '',
      orderSql: '',
      temporalField: 'r.created_at',
      params,
      businessRegionFilter,
    });
    const opportunityQuery = await this.executeScopedAggregateQuery({
      tableName: 'fact_lianruan_opportunity',
      alias: 'o',
      selectSql: `
        SELECT
          COUNT(o.opportunity_id) AS opportunity_count,
          SUM(COALESCE(o.amount, 0)) AS opportunity_amount
        FROM fact_lianruan_opportunity o
      `,
      baseWhereSql: '',
      orderSql: '',
      temporalField: 'o.created_at',
      params,
      businessRegionFilter,
    });
    const orderQuery = await this.executeScopedAggregateQuery({
      tableName: 'fact_lianruan_order',
      alias: 'o',
      selectSql: `
        SELECT
          COUNT(o.order_id) AS order_count,
          SUM(COALESCE(o.amount, 0)) AS order_amount
        FROM fact_lianruan_order o
      `,
      baseWhereSql: this.buildEffectiveOrderWhereSql('o'),
      orderSql: '',
      temporalField: 'COALESCE(o.deal_at, o.created_at)',
      params,
      businessRegionFilter,
    });
    const unlinkedQuery = await this.executeCompositeRegistrationWithoutOpportunityDetail({
      ...params,
      businessRegionFilter,
    });
    const staleQuery = await this.executeCompositeStaleOpportunityDetail({
      ...params,
      businessRegionFilter,
    });

    if (!partnerQuery || !customerQuery || !registrationQuery || !opportunityQuery || !orderQuery || !unlinkedQuery || !staleQuery) {
      return null;
    }

    const slice = this.buildCompositeOperationsSlice({
      partnerSummary: partnerQuery.rows[0] ?? {},
      customerSummary: customerQuery.rows[0] ?? {},
      registrationSummary: registrationQuery.rows[0] ?? {},
      opportunitySummary: opportunityQuery.rows[0] ?? {},
      orderSummary: orderQuery.rows[0] ?? {},
      unlinkedRows: unlinkedQuery.rows,
      staleRows: staleQuery.rows,
      sql: [
        partnerQuery.sql,
        customerQuery.sql,
        registrationQuery.sql,
        opportunityQuery.sql,
        orderQuery.sql,
        unlinkedQuery.sql,
        staleQuery.sql,
      ].join('\n\n-- P3 组合报告子任务分隔 --\n\n'),
      temporalSlot: params.intent.temporalSlot,
      scopeSummary: params.warehouseScope.summary,
      businessRegionFilter,
    });

    return {
      slice,
      sql: slice.sql,
      tables: this.uniqueStrings([
        ...partnerQuery.tables,
        ...customerQuery.tables,
        ...registrationQuery.tables,
        ...opportunityQuery.tables,
        ...orderQuery.tables,
        ...unlinkedQuery.tables,
        ...staleQuery.tables,
      ]),
      columns: this.uniqueStrings([
        ...partnerQuery.columns,
        ...customerQuery.columns,
        ...registrationQuery.columns,
        ...opportunityQuery.columns,
        ...orderQuery.columns,
        ...unlinkedQuery.columns,
        ...staleQuery.columns,
      ]),
      rowLimit: Math.max(
        partnerQuery.rowLimit,
        customerQuery.rowLimit,
        registrationQuery.rowLimit,
        opportunityQuery.rowLimit,
        orderQuery.rowLimit,
        unlinkedQuery.rowLimit,
        staleQuery.rowLimit,
      ),
      timeoutMs: 8000,
    };
  }

  /**
   * 执行“报备-商机-报价-订单”漏斗转化受控模板。
   *
   * 参数说明：`params` 为当前问数上下文和已解析权限范围。
   * 返回值说明：返回四段漏斗数量、金额和阶段转化率。
   * 调用注意事项：当前阶段先按各事实表总量计算漏斗，完整 ID 链路将在 P4 深化为链路模板。
   */
  private async executeFunnelConversionQuery(params: {
    questionText: string;
    channel: ChannelType;
    user: CrmUser;
    intent: AnalysisIntent;
    scopeSnapshot: ScopeSnapshot;
    warehouseScope: WarehouseScopeResolution;
  }): Promise<AnalysisWarehouseBusinessExecutionResult | null> {
    const businessRegionFilter = this.resolveBusinessRegionFilter(params.questionText);
    const registrationQuery = await this.executeScopedAggregateQuery({
      tableName: 'fact_lianruan_registration',
      alias: 'r',
      selectSql: `
        SELECT
          COUNT(r.registration_id) AS registration_count
        FROM fact_lianruan_registration r
      `,
      baseWhereSql: '',
      orderSql: '',
      temporalField: 'r.created_at',
      params,
      businessRegionFilter,
    });
    const opportunityQuery = await this.executeScopedAggregateQuery({
      tableName: 'fact_lianruan_opportunity',
      alias: 'o',
      selectSql: `
        SELECT
          COUNT(o.opportunity_id) AS opportunity_count,
          SUM(COALESCE(o.amount, 0)) AS opportunity_amount
        FROM fact_lianruan_opportunity o
      `,
      baseWhereSql: '',
      orderSql: '',
      temporalField: 'o.created_at',
      params,
      businessRegionFilter,
    });
    const quoteQuery = await this.executeScopedAggregateQuery({
      tableName: 'fact_lianruan_quote',
      alias: 'q',
      selectSql: `
        SELECT
          COUNT(q.quote_id) AS quote_count,
          SUM(COALESCE(q.amount, 0)) AS quote_amount
        FROM fact_lianruan_quote q
      `,
      baseWhereSql: '',
      orderSql: '',
      temporalField: 'q.created_at',
      params,
      businessRegionFilter,
    });
    const orderQuery = await this.executeScopedAggregateQuery({
      tableName: 'fact_lianruan_order',
      alias: 'o',
      selectSql: `
        SELECT
          COUNT(o.order_id) AS order_count,
          SUM(COALESCE(o.amount, 0)) AS order_amount
        FROM fact_lianruan_order o
      `,
      baseWhereSql: this.buildEffectiveOrderWhereSql('o'),
      orderSql: '',
      temporalField: 'COALESCE(o.deal_at, o.created_at)',
      params,
      businessRegionFilter,
    });

    if (!registrationQuery || !opportunityQuery || !quoteQuery || !orderQuery) {
      return null;
    }

    const slice = this.buildFunnelConversionSlice({
      registrationSummary: registrationQuery.rows[0] ?? {},
      opportunitySummary: opportunityQuery.rows[0] ?? {},
      quoteSummary: quoteQuery.rows[0] ?? {},
      orderSummary: orderQuery.rows[0] ?? {},
      sql: [
        registrationQuery.sql,
        opportunityQuery.sql,
        quoteQuery.sql,
        orderQuery.sql,
      ].join('\n\n-- P4 漏斗转化子任务分隔 --\n\n'),
      temporalSlot: params.intent.temporalSlot,
      scopeSummary: params.warehouseScope.summary,
      businessRegionFilter,
    });

    return {
      slice,
      sql: slice.sql,
      tables: this.uniqueStrings([
        ...registrationQuery.tables,
        ...opportunityQuery.tables,
        ...quoteQuery.tables,
        ...orderQuery.tables,
      ]),
      columns: this.uniqueStrings([
        ...registrationQuery.columns,
        ...opportunityQuery.columns,
        ...quoteQuery.columns,
        ...orderQuery.columns,
      ]),
      rowLimit: Math.max(
        registrationQuery.rowLimit,
        opportunityQuery.rowLimit,
        quoteQuery.rowLimit,
        orderQuery.rowLimit,
      ),
      timeoutMs: 8000,
    };
  }

  /**
   * 执行“有报价但未下单客户”受控模板。
   *
   * 参数说明：`params` 为当前问数上下文和已解析权限范围。
   * 返回值说明：返回报价明细和报价金额，按金额降序。
   * 调用注意事项：当前订单事实表暂未落 `quote_id`，先按同客户无有效订单做兜底口径，并在结果中说明。
   */
  private async executeQuoteWithoutOrderQuery(params: {
    questionText: string;
    channel: ChannelType;
    user: CrmUser;
    intent: AnalysisIntent;
    scopeSnapshot: ScopeSnapshot;
    warehouseScope: WarehouseScopeResolution;
  }): Promise<AnalysisWarehouseBusinessExecutionResult | null> {
    const quoteScope = this.buildScopePredicateForAlias(
      'fact_lianruan_quote',
      'q',
      params.warehouseScope,
    );
    if (!quoteScope) {
      this.analysisLoggerService.logStep('报价未下单固定模板缺少可注入权限范围，已回退现有链路。', {
        userId: params.user.id,
        scopeMode: params.warehouseScope.mode,
      });
      return null;
    }

    const businessRegionFilter = this.resolveBusinessRegionFilter(params.questionText);
    const businessRegionPredicate = this.buildBusinessRegionPredicateForAlias(
      'fact_lianruan_quote',
      'q',
      businessRegionFilter,
    );
    const temporalPredicate = this.buildTemporalPredicate('q.created_at', params.intent.temporalSlot);
    const sql = `
      SELECT
        q.quote_id,
        q.customer_id,
        q.customer_name,
        q.opportunity_id,
        q.partner_id,
        p.partner_name,
        q.owner_name,
        q.assigned_staff_name,
        q.status,
        q.region,
        q.big_region,
        q.amount,
        q.created_at
      FROM fact_lianruan_quote q
      LEFT JOIN fact_lianruan_order o
        ON o.customer_id = q.customer_id
        AND ${this.buildEffectiveOrderWhereSql('o')}
      LEFT JOIN dim_lianruan_partner p
        ON p.partner_id = q.partner_id
      WHERE o.order_id IS NULL
        AND COALESCE(q.status, '') NOT IN ('rejected', 'cancelled', 'canceled', 'deleted')
        ${quoteScope.sql ? `AND (${quoteScope.sql})` : ''}
        ${businessRegionPredicate.sql ? `AND (${businessRegionPredicate.sql})` : ''}
        ${temporalPredicate.sql ? `AND (${temporalPredicate.sql})` : ''}
      ORDER BY q.amount DESC, q.created_at DESC, q.quote_id ASC
      LIMIT 1000
    `;
    const query = await this.executeGuardedWarehouseQuery(
      sql,
      [
        ...quoteScope.params,
        ...businessRegionPredicate.params,
        ...temporalPredicate.params,
      ],
      5000,
      100,
    );
    const slice = this.buildQuoteWithoutOrderSlice({
      rows: query.rows,
      sql: query.sql,
      temporalSlot: params.intent.temporalSlot,
      scopeSummary: params.warehouseScope.summary,
      businessRegionFilter,
    });

    return {
      slice,
      sql: query.sql,
      tables: query.tables,
      columns: query.columns,
      rowLimit: query.rowLimit,
      timeoutMs: 5000,
    };
  }

  /**
   * 执行“客户报备未关联商机”受控查询模板。
   *
   * 参数说明：`params` 为当前问数上下文和已解析权限范围。
   * 返回值说明：返回客户报备未关联商机明细切片。
   * 调用注意事项：该模板只处理只读反关联口径，不能扩展为写入或补建商机动作。
   */
  private async executeRegistrationWithoutOpportunityQuery(params: {
    questionText: string;
    channel: ChannelType;
    user: CrmUser;
    intent: AnalysisIntent;
    scopeSnapshot: ScopeSnapshot;
    warehouseScope: WarehouseScopeResolution;
  }): Promise<AnalysisWarehouseBusinessExecutionResult | null> {
    const registrationScope = this.buildScopePredicateForAlias(
      'fact_lianruan_registration',
      'r',
      params.warehouseScope,
    );
    if (!registrationScope) {
      this.analysisLoggerService.logStep('客户报备未关联商机固定模板缺少可注入权限范围，已回退现有链路。', {
        userId: params.user.id,
        scopeMode: params.warehouseScope.mode,
      });
      return null;
    }

    const businessRegionFilter = this.resolveBusinessRegionFilter(params.questionText);
    const businessRegionPredicate = this.buildBusinessRegionPredicateForAlias(
      'fact_lianruan_registration',
      'r',
      businessRegionFilter,
    );
    const sql = `
      SELECT
        r.registration_id,
        r.customer_id,
        r.customer_name,
        r.partner_id,
        p.partner_name,
        r.region,
        r.created_at,
        DATEDIFF(CURRENT_DATE(), DATE(r.created_at)) AS created_days
      FROM fact_lianruan_registration r
      LEFT JOIN fact_lianruan_opportunity o
        ON (
          o.registration_id = r.registration_id
          OR (o.customer_id IS NOT NULL AND o.customer_id = r.customer_id)
        )
      LEFT JOIN dim_lianruan_partner p
        ON p.partner_id = r.partner_id
      WHERE o.opportunity_id IS NULL
        ${registrationScope.sql ? `AND (${registrationScope.sql})` : ''}
        ${businessRegionPredicate.sql ? `AND (${businessRegionPredicate.sql})` : ''}
      ORDER BY r.created_at ASC, r.registration_id ASC
      LIMIT 1000
    `;
    const validation = this.analysisWarehouseSqlGuardService.validateAndNormalize(sql, {
      defaultLimit: 100,
      maxLimit: 1000,
    });
    const rows = await this.analysisWarehouseMysqlService.executeSelect<Record<string, unknown>>(
      validation.normalizedSql,
      [...registrationScope.params, ...businessRegionPredicate.params],
      5000,
    );
    const normalizedRows = rows.map((row) => this.normalizeRow(row));
    const slice = this.buildRegistrationWithoutOpportunitySlice({
      rows: normalizedRows,
      sql: validation.normalizedSql,
      temporalSlot: params.intent.temporalSlot,
      scopeSummary: params.warehouseScope.summary,
      businessRegionFilter,
    });

    return {
      slice,
      sql: validation.normalizedSql,
      tables: validation.tables,
      columns: validation.columns,
      rowLimit: validation.appliedLimit,
      timeoutMs: 5000,
    };
  }

  /**
   * 执行“超两周未更新商机”受控查询模板。
   *
   * 参数说明：`params` 为当前问数上下文和已解析权限范围。
   * 返回值说明：返回停滞商机明细、数量和金额。
   * 调用注意事项：使用 `source_updated_at` 作为进展更新时间，避免把同步时间误当业务跟进时间。
   */
  private async executeStaleOpportunityQuery(params: {
    questionText: string;
    channel: ChannelType;
    user: CrmUser;
    intent: AnalysisIntent;
    scopeSnapshot: ScopeSnapshot;
    warehouseScope: WarehouseScopeResolution;
  }): Promise<AnalysisWarehouseBusinessExecutionResult | null> {
    const opportunityScope = this.buildScopePredicateForAlias(
      'fact_lianruan_opportunity',
      'o',
      params.warehouseScope,
    );
    if (!opportunityScope) {
      this.analysisLoggerService.logStep('超期商机固定模板缺少可注入权限范围，已回退现有链路。', {
        userId: params.user.id,
        scopeMode: params.warehouseScope.mode,
      });
      return null;
    }

    const businessRegionFilter = this.resolveBusinessRegionFilter(params.questionText);
    const businessRegionPredicate = this.buildBusinessRegionPredicateForAlias(
      'fact_lianruan_opportunity',
      'o',
      businessRegionFilter,
    );
    const staleThreshold = resolveStaleOpportunityThreshold(params.questionText);
    const sql = `
      SELECT
        o.opportunity_id,
        o.opportunity_name,
        o.customer_name,
        o.partner_name,
        o.owner_name,
        o.stage_name,
        o.region,
        o.big_region,
        o.amount,
        o.source_updated_at,
        DATEDIFF(CURRENT_DATE(), DATE(o.source_updated_at)) AS stale_days
      FROM fact_lianruan_opportunity o
      WHERE o.source_updated_at IS NOT NULL
        AND DATEDIFF(CURRENT_DATE(), DATE(o.source_updated_at)) > ${staleThreshold.days}
        AND COALESCE(o.status, '') NOT IN ('won', 'lost', 'completed', 'cancelled', 'canceled', 'deleted')
        AND COALESCE(o.stage, '') NOT IN ('won', 'lost', 'completed', 'cancelled', 'canceled', 'deleted')
        ${opportunityScope.sql ? `AND (${opportunityScope.sql})` : ''}
        ${businessRegionPredicate.sql ? `AND (${businessRegionPredicate.sql})` : ''}
      ORDER BY stale_days DESC, o.amount DESC, o.opportunity_id ASC
      LIMIT 1000
    `;
    const validation = this.analysisWarehouseSqlGuardService.validateAndNormalize(sql, {
      defaultLimit: 100,
      maxLimit: 1000,
    });
    const rows = await this.analysisWarehouseMysqlService.executeSelect<Record<string, unknown>>(
      validation.normalizedSql,
      [...opportunityScope.params, ...businessRegionPredicate.params],
      5000,
    );
    const normalizedRows = rows.map((row) => this.normalizeRow(row));
    const slice = this.buildStaleOpportunitySlice({
      rows: normalizedRows,
      sql: validation.normalizedSql,
      scopeSummary: params.warehouseScope.summary,
      businessRegionFilter,
      thresholdDays: staleThreshold.days,
      thresholdLabel: staleThreshold.label,
    });

    return {
      slice,
      sql: validation.normalizedSql,
      tables: validation.tables,
      columns: validation.columns,
      rowLimit: validation.appliedLimit,
      timeoutMs: 5000,
    };
  }

  /**
   * 执行“未活跃客户”受控查询模板。
   *
   * 参数说明：`params` 为当前问数上下文和已解析权限范围。
   * 返回值说明：返回最近 30 天未活跃客户明细。
   * 调用注意事项：联软客户活跃口径以 `latest_activity_at` 为准，字段为空时按“暂无活动记录”纳入。
   */
  private async executeInactiveCustomerQuery(params: {
    questionText: string;
    channel: ChannelType;
    user: CrmUser;
    intent: AnalysisIntent;
    scopeSnapshot: ScopeSnapshot;
    warehouseScope: WarehouseScopeResolution;
  }): Promise<AnalysisWarehouseBusinessExecutionResult | null> {
    const customerScope = this.buildScopePredicateForAlias(
      'dim_lianruan_customer',
      'c',
      params.warehouseScope,
    );
    if (!customerScope) {
      this.analysisLoggerService.logStep('未活跃客户固定模板缺少可注入权限范围，已回退现有链路。', {
        userId: params.user.id,
        scopeMode: params.warehouseScope.mode,
      });
      return null;
    }

    const businessRegionFilter = this.resolveBusinessRegionFilter(params.questionText);
    const businessRegionPredicate = this.buildBusinessRegionPredicateForAlias(
      'dim_lianruan_customer',
      'c',
      businessRegionFilter,
    );
    const temporalPredicate = this.buildTemporalPredicate('c.created_at', params.intent.temporalSlot);
    const sql = `
      SELECT
        c.customer_id,
        c.customer_name,
        c.partner_name,
        c.owner_name,
        c.region,
        c.big_region,
        c.category_name,
        c.status_name,
        c.created_at,
        c.latest_activity_at,
        CASE
          WHEN c.latest_activity_at IS NULL THEN DATEDIFF(CURRENT_DATE(), DATE(c.created_at))
          ELSE DATEDIFF(CURRENT_DATE(), DATE(c.latest_activity_at))
        END AS inactive_days
      FROM dim_lianruan_customer c
      WHERE (c.latest_activity_at IS NULL OR DATEDIFF(CURRENT_DATE(), DATE(c.latest_activity_at)) > 30)
        ${customerScope.sql ? `AND (${customerScope.sql})` : ''}
        ${businessRegionPredicate.sql ? `AND (${businessRegionPredicate.sql})` : ''}
        ${temporalPredicate.sql ? `AND (${temporalPredicate.sql})` : ''}
      ORDER BY inactive_days DESC, c.created_at ASC, c.customer_id ASC
      LIMIT 1000
    `;
    const validation = this.analysisWarehouseSqlGuardService.validateAndNormalize(sql, {
      defaultLimit: 100,
      maxLimit: 1000,
    });
    const rows = await this.analysisWarehouseMysqlService.executeSelect<Record<string, unknown>>(
      validation.normalizedSql,
      [...customerScope.params, ...businessRegionPredicate.params, ...temporalPredicate.params],
      5000,
    );
    const normalizedRows = rows.map((row) => this.normalizeRow(row));
    const slice = this.buildInactiveCustomerSlice({
      rows: normalizedRows,
      sql: validation.normalizedSql,
      temporalSlot: params.intent.temporalSlot,
      scopeSummary: params.warehouseScope.summary,
      businessRegionFilter,
    });

    return {
      slice,
      sql: validation.normalizedSql,
      tables: validation.tables,
      columns: validation.columns,
      rowLimit: validation.appliedLimit,
      timeoutMs: 5000,
    };
  }

  /**
   * 执行“订单数量/金额汇总”受控查询模板。
   *
   * 参数说明：`params` 为当前问数上下文和已解析权限范围。
   * 返回值说明：返回按区域和大区聚合的有效订单数量、金额。
   * 调用注意事项：有效订单排除取消、作废、驳回、删除状态，时间优先使用成交时间 `deal_at`。
   */
  private async executeOrderSummaryQuery(params: {
    questionText: string;
    channel: ChannelType;
    user: CrmUser;
    intent: AnalysisIntent;
    scopeSnapshot: ScopeSnapshot;
    warehouseScope: WarehouseScopeResolution;
  }): Promise<AnalysisWarehouseBusinessExecutionResult | null> {
    const orderScope = this.buildScopePredicateForAlias(
      'fact_lianruan_order',
      'o',
      params.warehouseScope,
    );
    if (!orderScope) {
      this.analysisLoggerService.logStep('订单汇总固定模板缺少可注入权限范围，已回退现有链路。', {
        userId: params.user.id,
        scopeMode: params.warehouseScope.mode,
      });
      return null;
    }

    const businessRegionFilter = this.resolveBusinessRegionFilter(params.questionText);
    const businessRegionPredicate = this.buildBusinessRegionPredicateForAlias(
      'fact_lianruan_order',
      'o',
      businessRegionFilter,
    );
    const temporalPredicate = this.buildTemporalPredicate('COALESCE(o.deal_at, o.created_at)', params.intent.temporalSlot);
    const sql = `
      SELECT
        COALESCE(o.region, '未填写') AS region,
        COALESCE(o.big_region, '未填写') AS big_region,
        COUNT(o.order_id) AS order_count,
        SUM(COALESCE(o.amount, 0)) AS order_amount
      FROM fact_lianruan_order o
      WHERE COALESCE(o.status, '') NOT IN ('cancelled', 'canceled', 'void', 'rejected', 'deleted')
        ${orderScope.sql ? `AND (${orderScope.sql})` : ''}
        ${businessRegionPredicate.sql ? `AND (${businessRegionPredicate.sql})` : ''}
        ${temporalPredicate.sql ? `AND (${temporalPredicate.sql})` : ''}
      GROUP BY COALESCE(o.region, '未填写'), COALESCE(o.big_region, '未填写')
      ORDER BY order_amount DESC, order_count DESC
      LIMIT 1000
    `;
    const validation = this.analysisWarehouseSqlGuardService.validateAndNormalize(sql, {
      defaultLimit: 100,
      maxLimit: 1000,
    });
    const rows = await this.analysisWarehouseMysqlService.executeSelect<Record<string, unknown>>(
      validation.normalizedSql,
      [...orderScope.params, ...businessRegionPredicate.params, ...temporalPredicate.params],
      5000,
    );
    const normalizedRows = rows.map((row) => this.normalizeRow(row));
    const slice = this.buildOrderSummarySlice({
      rows: normalizedRows,
      sql: validation.normalizedSql,
      temporalSlot: params.intent.temporalSlot,
      scopeSummary: params.warehouseScope.summary,
      businessRegionFilter,
    });

    return {
      slice,
      sql: validation.normalizedSql,
      tables: validation.tables,
      columns: validation.columns,
      rowLimit: validation.appliedLimit,
      timeoutMs: 5000,
    };
  }

  /**
   * 执行组合报告中的单表聚合子任务。
   *
   * 参数说明：包含固定 SQL 片段、表别名、时间字段、权限和业务区域过滤。
   * 返回值说明：返回已通过 SQL Guard 的查询结果；无法注入权限时返回 `null`。
   * 调用注意事项：`selectSql/baseWhereSql/orderSql/temporalField` 只能由程序固定传入，不接受用户或 AI 原文。
   */
  private async executeScopedAggregateQuery(params: {
    tableName: string;
    alias: string;
    selectSql: string;
    baseWhereSql: string;
    orderSql: string;
    temporalField: string;
    params: {
      questionText: string;
      user: CrmUser;
      intent: AnalysisIntent;
      warehouseScope: WarehouseScopeResolution;
    };
    businessRegionFilter?: BusinessRegionFilter;
  }): Promise<GuardedWarehouseQueryResult | null> {
    const scopePredicate = this.buildScopePredicateForAlias(
      params.tableName,
      params.alias,
      params.params.warehouseScope,
    );
    if (!scopePredicate) {
      this.analysisLoggerService.logStep('P3 组合报告聚合子任务缺少可注入权限范围，已回退现有链路。', {
        userId: params.params.user.id,
        tableName: params.tableName,
        scopeMode: params.params.warehouseScope.mode,
      });
      return null;
    }

    const temporalPredicate = this.buildTemporalPredicate(
      params.temporalField,
      params.params.intent.temporalSlot,
    );
    const businessRegionPredicate = this.buildBusinessRegionPredicateForAlias(
      params.tableName,
      params.alias,
      params.businessRegionFilter,
    );
    const wherePredicates = [
      params.baseWhereSql,
      scopePredicate.sql ? `(${scopePredicate.sql})` : '',
      businessRegionPredicate.sql ? `(${businessRegionPredicate.sql})` : '',
      temporalPredicate.sql ? `(${temporalPredicate.sql})` : '',
    ].filter(Boolean);
    const sql = `
      ${params.selectSql}
      ${wherePredicates.length ? `WHERE ${wherePredicates.join(' AND ')}` : ''}
      ${params.orderSql}
      LIMIT 1
    `;

    return this.executeGuardedWarehouseQuery(
      sql,
      [
        ...scopePredicate.params,
        ...businessRegionPredicate.params,
        ...temporalPredicate.params,
      ],
      5000,
      1,
    );
  }

  /**
   * 执行组合报告中的“客户报备未关联商机”明细子任务。
   *
   * 参数说明：包含当前上下文和业务区域过滤。
   * 返回值说明：返回最多 100 条明细，用于企业微信和 Web 展示。
   * 调用注意事项：该子任务沿用反关联口径，仍按报备表做行级权限注入。
   */
  private async executeCompositeRegistrationWithoutOpportunityDetail(params: {
    questionText: string;
    user: CrmUser;
    intent: AnalysisIntent;
    warehouseScope: WarehouseScopeResolution;
    businessRegionFilter?: BusinessRegionFilter;
  }): Promise<GuardedWarehouseQueryResult | null> {
    const registrationScope = this.buildScopePredicateForAlias(
      'fact_lianruan_registration',
      'r',
      params.warehouseScope,
    );
    if (!registrationScope) {
      this.analysisLoggerService.logStep('P3 组合报告未关联商机子任务缺少可注入权限范围，已回退现有链路。', {
        userId: params.user.id,
        scopeMode: params.warehouseScope.mode,
      });
      return null;
    }

    const businessRegionPredicate = this.buildBusinessRegionPredicateForAlias(
      'fact_lianruan_registration',
      'r',
      params.businessRegionFilter,
    );
    const temporalPredicate = this.buildTemporalPredicate('r.created_at', params.intent.temporalSlot);
    const sql = `
      SELECT
        r.registration_id,
        r.customer_id,
        r.customer_name,
        r.partner_id,
        p.partner_name,
        r.region,
        r.big_region,
        r.created_at,
        DATEDIFF(CURRENT_DATE(), DATE(r.created_at)) AS created_days
      FROM fact_lianruan_registration r
      LEFT JOIN fact_lianruan_opportunity o
        ON (
          o.registration_id = r.registration_id
          OR (o.customer_id IS NOT NULL AND o.customer_id = r.customer_id)
        )
      LEFT JOIN dim_lianruan_partner p
        ON p.partner_id = r.partner_id
      WHERE o.opportunity_id IS NULL
        ${registrationScope.sql ? `AND (${registrationScope.sql})` : ''}
        ${businessRegionPredicate.sql ? `AND (${businessRegionPredicate.sql})` : ''}
        ${temporalPredicate.sql ? `AND (${temporalPredicate.sql})` : ''}
      ORDER BY r.created_at ASC, r.registration_id ASC
      LIMIT 100
    `;

    return this.executeGuardedWarehouseQuery(
      sql,
      [
        ...registrationScope.params,
        ...businessRegionPredicate.params,
        ...temporalPredicate.params,
      ],
      5000,
      100,
    );
  }

  /**
   * 执行组合报告中的“超两周未更新商机”明细子任务。
   *
   * 参数说明：包含当前上下文和业务区域过滤。
   * 返回值说明：返回最多 100 条停滞商机明细。
   * 调用注意事项：状态排除规则与单项超期商机模板保持一致，避免同一问题在组合报告中口径漂移。
   */
  private async executeCompositeStaleOpportunityDetail(params: {
    questionText: string;
    user: CrmUser;
    intent: AnalysisIntent;
    warehouseScope: WarehouseScopeResolution;
    businessRegionFilter?: BusinessRegionFilter;
  }): Promise<GuardedWarehouseQueryResult | null> {
    const opportunityScope = this.buildScopePredicateForAlias(
      'fact_lianruan_opportunity',
      'o',
      params.warehouseScope,
    );
    if (!opportunityScope) {
      this.analysisLoggerService.logStep('P3 组合报告超期商机子任务缺少可注入权限范围，已回退现有链路。', {
        userId: params.user.id,
        scopeMode: params.warehouseScope.mode,
      });
      return null;
    }

    const businessRegionPredicate = this.buildBusinessRegionPredicateForAlias(
      'fact_lianruan_opportunity',
      'o',
      params.businessRegionFilter,
    );
    const staleThreshold = resolveStaleOpportunityThreshold(params.questionText);
    const sql = `
      SELECT
        o.opportunity_id,
        o.opportunity_name,
        o.customer_name,
        o.partner_name,
        o.owner_name,
        o.stage_name,
        o.region,
        o.big_region,
        o.amount,
        o.source_updated_at,
        DATEDIFF(CURRENT_DATE(), DATE(o.source_updated_at)) AS stale_days
      FROM fact_lianruan_opportunity o
      WHERE o.source_updated_at IS NOT NULL
        AND DATEDIFF(CURRENT_DATE(), DATE(o.source_updated_at)) > ${staleThreshold.days}
        AND COALESCE(o.status, '') NOT IN ('won', 'lost', 'completed', 'cancelled', 'canceled', 'deleted')
        AND COALESCE(o.stage, '') NOT IN ('won', 'lost', 'completed', 'cancelled', 'canceled', 'deleted')
        ${opportunityScope.sql ? `AND (${opportunityScope.sql})` : ''}
        ${businessRegionPredicate.sql ? `AND (${businessRegionPredicate.sql})` : ''}
      ORDER BY stale_days DESC, o.amount DESC, o.opportunity_id ASC
      LIMIT 100
    `;

    return this.executeGuardedWarehouseQuery(
      sql,
      [
        ...opportunityScope.params,
        ...businessRegionPredicate.params,
      ],
      5000,
      100,
    );
  }

  /**
   * 执行一条固定模板 SQL，并统一完成 SQL Guard、只读执行和行标准化。
   *
   * 参数说明：`sql` 为程序固定生成的 SELECT，`params` 为绑定参数。
   * 返回值说明：返回规范化 SQL、表字段元数据和结果行。
   * 调用注意事项：禁止调用方传入用户拼接 SQL；用户输入只能以参数形式进入。
   */
  private async executeGuardedWarehouseQuery(
    sql: string,
    params: unknown[],
    timeoutMs: number,
    defaultLimit: number,
  ): Promise<GuardedWarehouseQueryResult> {
    const validation = this.analysisWarehouseSqlGuardService.validateAndNormalize(sql, {
      defaultLimit,
      maxLimit: 1000,
    });
    const rows = await this.analysisWarehouseMysqlService.executeSelect<Record<string, unknown>>(
      validation.normalizedSql,
      params,
      timeoutMs,
    );

    return {
      sql: validation.normalizedSql,
      tables: validation.tables,
      columns: validation.columns,
      rowLimit: validation.appliedLimit,
      rows: rows.map((row) => this.normalizeRow(row)),
    };
  }

  /**
   * 解析固定业务模板类型。
   *
   * 参数说明：`questionText` 为用户原文，`intent` 为 AI-first 意图结果。
   * 返回值说明：命中时返回固定模板类型，未命中返回 `null`。
   * 调用注意事项：宽业务意图命中时优先参与选择，原文规则只作为兜底；执行仍走受控模板，不接受 AI SQL。
   */
  private resolveFixedBusinessTemplateKind(
    questionText: string,
    intent: AnalysisIntent,
  ): FixedBusinessTemplateKind | null {
    const hint = intent.businessIntentHint;
    const objectTypes = new Set(hint?.objectTypes ?? []);
    const metrics = new Set(hint?.metrics ?? []);
    const comparison = new Set(hint?.comparison ?? []);
    const analysisMode = hint?.analysisMode;
    const objectCount = objectTypes.size;

    if (
      this.isCompositeOperationsQuestion(questionText) ||
      (
        objectTypes.has('customer') &&
        objectTypes.has('registration') &&
        objectTypes.has('opportunity') &&
        objectTypes.has('order')
      ) ||
      (
        objectTypes.has('registration') &&
        objectTypes.has('opportunity') &&
        objectTypes.has('order') &&
        (metrics.has('unlinked_customer_count') || metrics.has('stale_opportunity_count'))
      ) ||
      (
        objectTypes.has('partner') &&
        objectTypes.has('registration') &&
        objectTypes.has('order')
      )
    ) {
      return 'composite-operations';
    }

    if (
      this.isPartnerOpportunityGrowthQuestion(questionText) ||
      (
        objectTypes.has('partner') &&
        objectTypes.has('opportunity') &&
        (metrics.has('partner_count') || metrics.has('opportunity_count') || metrics.has('opportunity_amount')) &&
        (analysisMode === 'trend' || analysisMode === 'summary_report' || analysisMode === 'dashboard')
      )
    ) {
      return 'partner-opportunity-growth';
    }

    if (
      this.isBusinessBriefingQuestion(questionText) ||
      (
        (analysisMode === 'dashboard' || (analysisMode === 'summary_report' && /简报|报告|看板/u.test(questionText))) &&
        (
          objectCount >= 3 ||
          (objectTypes.has('customer') && objectTypes.has('opportunity') && objectTypes.has('order')) ||
          (objectTypes.has('registration') && objectTypes.has('opportunity') && objectTypes.has('order'))
        )
      )
    ) {
      return 'business-briefing';
    }

    if (
      this.isFunnelConversionQuestion(questionText) ||
      comparison.has('funnel') ||
      (
        metrics.has('conversion_rate') &&
        objectTypes.has('registration') &&
        objectTypes.has('opportunity') &&
        (objectTypes.has('quote') || objectTypes.has('order'))
      )
    ) {
      return 'funnel-conversion';
    }

    if (
      this.isQuoteWithoutOrderQuestion(questionText) ||
      (objectTypes.has('quote') && objectTypes.has('order') && /未|没|无|风险|差异|缺口/u.test(questionText))
    ) {
      return 'quote-without-order';
    }

    if (
      this.isOrderOpportunityOverviewQuestion(questionText) ||
      (
        objectTypes.has('order') &&
        objectTypes.has('opportunity') &&
        !comparison.has('funnel') &&
        !/漏斗|转化率|转化/u.test(questionText)
      )
    ) {
      return 'order-opportunity-overview';
    }

    if (
      this.isRegistrationWithoutOpportunityQuestion(questionText) ||
      metrics.has('unlinked_customer_count')
    ) {
      return 'registration-without-opportunity';
    }

    if (
      this.isStaleOpportunityQuestion(questionText) ||
      metrics.has('stale_opportunity_count')
    ) {
      return 'stale-opportunity';
    }

    if (
      this.isInactiveCustomerQuestion(questionText) ||
      metrics.has('inactive_customer_count')
    ) {
      return 'inactive-customer';
    }

    if (
      this.isOpportunityPartnerOverviewQuestion(questionText) ||
      (
        objectTypes.has('opportunity') &&
        objectTypes.has('partner') &&
        !objectTypes.has('order') &&
        !comparison.has('funnel') &&
        !/未|没|没有|无|停滞|进展|更新|漏斗|转化/u.test(questionText)
      )
    ) {
      return 'opportunity-partner-overview';
    }

    if (
      this.isPartnerBusinessChainQuestion(questionText) ||
      (
        objectTypes.has('partner') &&
        (
          objectTypes.has('registration') ||
          objectTypes.has('opportunity') ||
          objectTypes.has('order')
        ) &&
        !comparison.has('funnel') &&
        !/新增.{0,8}(商机|渠道商|服务商|合作伙伴)|增长|趋势/u.test(questionText)
      )
    ) {
      return 'partner-business-chain';
    }

    if (
      this.isRegistrationPartnerOverviewQuestion(questionText) ||
      (objectTypes.has('registration') && objectTypes.has('partner') && !comparison.has('funnel'))
    ) {
      return 'registration-partner-overview';
    }

    if (
      this.isOrderPartnerOverviewQuestion(questionText) ||
      (
        objectTypes.has('order') &&
        objectTypes.has('partner') &&
        !objectTypes.has('opportunity') &&
        !comparison.has('funnel')
      )
    ) {
      return 'order-partner-overview';
    }

    if (
      this.isOrderSummaryQuestion(questionText) ||
      (
        objectTypes.has('order') &&
        (metrics.has('order_count') || metrics.has('order_amount') || metrics.has('total_amount'))
      )
    ) {
      return 'order-summary';
    }

    return null;
  }

  /**
   * 判断是否为 P3 复杂组合经营分析问数。
   *
   * 参数说明：`questionText` 为用户原始问题。
   * 返回值说明：同时涉及客户/报备/商机/订单/风险中的多类对象时返回 `true`。
   * 调用注意事项：该识别只决定是否进入固定组合模板；具体 SQL 仍由程序模板生成，AI 不直接拼接 SQL。
   */
  private isCompositeOperationsQuestion(questionText: string): boolean {
    const hasCustomer = /客户|合作伙伴客户/u.test(questionText);
    const hasRegistration = /报备/u.test(questionText);
    const hasOpportunity = /商机/u.test(questionText);
    const hasOrder = /订单|下单|成单/u.test(questionText);
    const hasUnlinked = /(没有|未|无).{0,8}(报备商机|商机)|未建商机|无商机/u.test(questionText);
    const hasStale = /(超|超过).{0,4}(两周|14天|十四天).{0,8}(未|没|没有).{0,4}(更新|进展|跟进)|停滞/u.test(questionText);
    return (
      (hasCustomer && hasRegistration && hasOpportunity && hasOrder) ||
      (hasCustomer && hasRegistration && hasOrder && (hasUnlinked || hasStale))
    );
  }

  /**
   * 判断是否为“经营简报/经营报告”问数。
   *
   * 参数说明：`questionText` 为用户原始问题。
   * 返回值说明：用户明确要求生成简报、经营报告或经营看板时返回 `true`。
   * 调用注意事项：该判断不吃掉普通“订单汇总/商机汇总”，避免影响已有单项模板。
   */
  private isBusinessBriefingQuestion(questionText: string): boolean {
    return /(经营简报|经营报告|分析报告|经营看板|生成.{0,8}简报|生成.{0,8}报告|本月经营|本季度经营|渠道经营)/u.test(
      questionText,
    );
  }

  /**
   * 判断是否为“渠道商新增 + 商机增长”双区块问数。
   *
   * 参数说明：`questionText` 为用户原始问题。
   * 返回值说明：同时命中渠道商新增和商机增长语义时返回 `true`。
   * 调用注意事项：该问法需要两块内容，不能只命中渠道或商机单对象模板。
   */
  private isPartnerOpportunityGrowthQuestion(questionText: string): boolean {
    const hasPartnerGrowth = /(渠道商|服务商|合作伙伴|代理商).{0,12}(新增|增加|增长|发展|新建)|新增.{0,8}(渠道商|服务商|合作伙伴|代理商)/u.test(
      questionText,
    );
    const hasOpportunityGrowth = /商机.{0,12}(新增|增加|增长|趋势|变化)|新增.{0,8}商机/u.test(
      questionText,
    );
    return hasPartnerGrowth && hasOpportunityGrowth;
  }

  /**
   * 判断是否为“订单情况 + 商机情况”双区块问数。
   *
   * 参数说明：`questionText` 为用户原始问题。
   * 返回值说明：同时命中订单和商机概览语义时返回 `true`。
   * 调用注意事项：该判断必须早于漏斗/经营报告模板，避免“订单、商机情况”被误解释为合同转化。
   */
  private isOrderOpportunityOverviewQuestion(questionText: string): boolean {
    const hasOrder = /(订单|下单|成单).{0,12}(情况|概况|汇总|统计|趋势|增长|分析|数量|金额)|((情况|概况|汇总|统计|趋势|增长|分析).{0,12}(订单|下单|成单))/u.test(
      questionText,
    );
    const hasOpportunity = /商机.{0,12}(情况|概况|汇总|统计|趋势|增长|分析|数量|金额)|((情况|概况|汇总|统计|趋势|增长|分析).{0,12}商机)/u.test(
      questionText,
    );
    return hasOrder && hasOpportunity && !/(漏斗|转化率|转化)/u.test(questionText);
  }

  /**
   * 判断是否为“商机整体 + 渠道商维度”问数。
   *
   * 参数说明：`questionText` 为用户原始问题。
   * 返回值说明：只问商机情况、概况、分析、汇总时返回 `true`。
   * 调用注意事项：停滞、未更新、转化漏斗等更具体模板已经在上游优先识别，这里只承接默认商机经营视角。
   */
  private isOpportunityPartnerOverviewQuestion(questionText: string): boolean {
    return /商机.{0,12}(情况|概况|整体|全部|汇总|统计|分析|总览)|((情况|概况|整体|全部|汇总|统计|分析|总览).{0,12}商机)/u.test(
      questionText,
    ) && !/(订单|下单|成单|报备|报价|漏斗|转化|未|没|没有|无|停滞|进展|更新)/u.test(questionText);
  }

  /**
   * 判断是否为“渠道商经营贡献”问数。
   *
   * 参数说明：`questionText` 为用户原始问题。
   * 返回值说明：用户只问渠道商、服务商、合作伙伴经营情况时返回 `true`。
   * 调用注意事项：该模板默认拉通客户报备、商机和订单，不再退化为单一渠道画像。
   */
  private isPartnerBusinessChainQuestion(questionText: string): boolean {
    const hasPartner = /(渠道商|服务商|合作伙伴|代理商|经销商|渠道|伙伴)/u.test(questionText);
    const hasOverview = /(情况|概况|整体|全部|经营|贡献|汇总|统计|分析|总览)/u.test(questionText);
    const hasGrowthOnly = /(新增|增加|增长|拓展|开拓|发展).{0,8}(渠道商|服务商|合作伙伴|代理商|经销商|渠道|伙伴)/u.test(
      questionText,
    );
    return hasPartner && hasOverview && !hasGrowthOnly && !/(订单|下单|成单).{0,12}商机/u.test(questionText);
  }

  /**
   * 判断是否为“客户报备 + 渠道商维度”问数。
   *
   * 参数说明：`questionText` 为用户原始问题。
   * 返回值说明：用户询问客户报备整体情况时返回 `true`。
   * 调用注意事项：未关联商机这类反关联问题已由更具体模板优先承接。
   */
  private isRegistrationPartnerOverviewQuestion(questionText: string): boolean {
    return /(客户报备|报备).{0,12}(情况|概况|整体|全部|汇总|统计|分析|总览)|((情况|概况|整体|全部|汇总|统计|分析|总览).{0,12}(客户报备|报备))/u.test(
      questionText,
    ) && !/(未|没|没有|无).{0,8}商机/u.test(questionText);
  }

  /**
   * 判断是否为“订单 + 渠道商维度”问数。
   *
   * 参数说明：`questionText` 为用户原始问题。
   * 返回值说明：用户询问订单、下单或成单整体情况时返回 `true`。
   * 调用注意事项：订单+商机、漏斗转化等组合问题已经在上游优先识别。
   */
  private isOrderPartnerOverviewQuestion(questionText: string): boolean {
    return /(订单|下单|成单).{0,12}(情况|概况|整体|全部|经营|贡献|汇总分析|分析|总览)|((情况|概况|整体|全部|经营|贡献|汇总分析|分析|总览).{0,12}(订单|下单|成单))/u.test(
      questionText,
    ) && !/(商机|报备|报价|漏斗|转化)/u.test(questionText);
  }

  /**
   * 判断是否为漏斗转化问数。
   *
   * 参数说明：`questionText` 为用户原始问题。
   * 返回值说明：命中报备、商机、报价、订单链路转化语义时返回 `true`。
   * 调用注意事项：该模板只输出只读统计，不生成写回或业务动作。
   */
  private isFunnelConversionQuestion(questionText: string): boolean {
    return /(漏斗|转化率|转化情况|转化).*(报备|商机|报价|订单)|(报备).*(商机|报价|订单).*(转化|漏斗)|(商机).*(报价|订单).*(转化|漏斗)|(报价).*(订单).*(转化|漏斗)/u.test(
      questionText,
    );
  }

  /**
   * 判断是否为“有报价但未下单”问数。
   *
   * 参数说明：`questionText` 为用户原始问题。
   * 返回值说明：命中报价差集、报价未转订单等语义时返回 `true`。
   * 调用注意事项：当前订单缺少 quote_id 标准字段时按客户兜底关联，结果会展示口径说明。
   */
  private isQuoteWithoutOrderQuestion(questionText: string): boolean {
    return /(报价).*((没有|未|无).{0,6}(下单|订单|成单)|未转.{0,4}订单|还没.{0,4}(下单|订单|成单))|((有报价).{0,12}(未|没|没有|还没).{0,6}(下单|订单|成单))/u.test(
      questionText,
    );
  }

  /**
   * 判断是否为“客户报备后未关联商机”的反关联问数。
   *
   * 参数说明：`questionText` 为用户原始问题。
   * 返回值说明：命中客户报备、未建商机、创建时长等组合语义时返回 `true`。
   * 调用注意事项：该判断只用于选择已固化的只读查询模板，不负责入口路由或权限放行。
   */
  private isRegistrationWithoutOpportunityQuestion(questionText: string): boolean {
    return /(客户|报备).*((没有|未|无).{0,8}(报备商机|商机)|报备.{0,8}(没有|未|无).{0,8}商机|未建商机|无商机)/u.test(
      questionText,
    );
  }

  /**
   * 判断是否为“超两周未更新商机”问数。
   *
   * 参数说明：`questionText` 为用户原始问题。
   * 返回值说明：命中停滞商机、长期未跟进等语义时返回 `true`。
   * 调用注意事项：这里只做模板选择，安全边界仍由后续 SQL Guard 和权限注入控制。
   */
  private isStaleOpportunityQuestion(questionText: string): boolean {
    return isStaleOpportunityQuestionText(questionText);
  }

  /**
   * 判断是否为“未活跃客户”问数。
   *
   * 参数说明：`questionText` 为用户原始问题。
   * 返回值说明：命中沉默客户、长期未活跃等语义时返回 `true`。
   * 调用注意事项：默认口径是最近 30 天无活动，后续若联软确认更细口径可在同一模板演进。
   */
  private isInactiveCustomerQuestion(questionText: string): boolean {
    const inactivePattern = /(未|没|没有).{0,6}(活跃|活动|跟进)|沉默|长期.{0,4}(未|没|没有).{0,4}(活跃|活动|跟进)/u;
    return /客户/u.test(questionText) && inactivePattern.test(questionText);
  }

  /**
   * 判断是否为“订单数量/金额汇总”问数。
   *
   * 参数说明：`questionText` 为用户原始问题。
   * 返回值说明：命中订单、下单、成单金额或数量时返回 `true`。
   * 调用注意事项：报价、商机不在该模板内处理，避免把不同业务对象的金额口径混在一起。
   */
  private isOrderSummaryQuestion(questionText: string): boolean {
    return /(订单|下单|成单).*(金额|数量|多少|汇总|总额|总金额)|((金额|数量|多少|汇总|总额|总金额).{0,8}(订单|下单|成单))/u.test(
      questionText,
    );
  }

  /**
   * 构造有效订单状态过滤 SQL。
   *
   * 参数说明：`alias` 为固定模板里的订单表别名。
   * 返回值说明：返回有效成交订单过滤条件。
   * 调用注意事项：联软 P3-P5 资料建议 `confirmed/completed` 计入有效成交，`pending/processing` 仅作为过程订单。
   */
  private buildEffectiveOrderWhereSql(alias: string): string {
    return `COALESCE(${alias}.status, '') IN ('confirmed', 'completed')`;
  }

  /**
   * 判断分析库 Text-to-SQL 开关。
   *
   * 参数说明：无。
   * 返回值说明：未显式关闭且未启用 SQLite-only 时返回 `true`。
   * 调用注意事项：生产灰度时可通过 `ANALYSIS_WAREHOUSE_TEXT_TO_SQL_ENABLED=false` 快速回退；
   * 本地只验证联软 SQLite 快照时可设置 `ANALYSIS_WAREHOUSE_SQLITE_ONLY=true`，避免误连 MySQL 分析库。
   */
  private isTextToSqlEnabled(): boolean {
    if (process.env.ANALYSIS_WAREHOUSE_SQLITE_ONLY === 'true') {
      return false;
    }

    return process.env.ANALYSIS_WAREHOUSE_TEXT_TO_SQL_ENABLED !== 'false';
  }

  /**
   * 尝试通过联软 SQLite 脱敏快照执行固定业务模板。
   *
   * 参数说明：`params` 为当前问数上下文、意图和会话权限快照。
   * 返回值说明：命中已支持模板时返回统一数据切片；未启用、未命中或权限不足时返回 `null`。
   * 调用注意事项：该路径只读取导入器白名单资源，不接受用户 SQL，也不依赖本地 3307 分析库。
   */
  private async tryExecuteSqliteSnapshotFixedBusinessQuery(params: {
    questionText: string;
    channel: ChannelType;
    user: CrmUser;
    intent: AnalysisIntent;
    scopeSnapshot: ScopeSnapshot;
  }): Promise<AnalysisWarehouseBusinessExecutionResult | null> {
    if (!this.analysisWarehouseSqliteSnapshotImporterService.isConfigured()) {
      return null;
    }

    const templateKind = this.resolveFixedBusinessTemplateKind(params.questionText, params.intent);

    if (templateKind === 'partner-opportunity-growth') {
      return await this.executeSqliteSnapshotPartnerOpportunityGrowthQuery(params);
    }

    if (templateKind === 'opportunity-partner-overview') {
      return await this.executeSqliteSnapshotOpportunityPartnerOverviewQuery(params);
    }

    if (templateKind === 'partner-business-chain') {
      return await this.executeSqliteSnapshotPartnerBusinessChainQuery(params);
    }

    if (templateKind === 'registration-partner-overview') {
      return await this.executeSqliteSnapshotRegistrationPartnerOverviewQuery(params);
    }

    if (templateKind === 'order-partner-overview') {
      return await this.executeSqliteSnapshotOrderPartnerOverviewQuery(params);
    }

    if (templateKind === 'order-opportunity-overview') {
      return await this.executeSqliteSnapshotOrderOpportunityOverviewQuery(params);
    }

    if (templateKind === 'composite-operations' || templateKind === 'business-briefing') {
      return await this.executeSqliteSnapshotCompositeOperationsQuery(params);
    }

    if (templateKind === 'stale-opportunity') {
      return await this.executeSqliteSnapshotStaleOpportunityQuery(params);
    }

    return null;
  }

  /**
   * 基于 SQLite 快照执行“渠道商新增 + 商机增长”组合模板。
   *
   * 参数说明：`params` 为当前问数上下文。
   * 返回值说明：返回渠道商新增表格和商机增长趋势两个区块。
   * 调用注意事项：该模板只读取联软快照白名单资源，不访问 MySQL 分析库，也不回退 OpenAPI 单对象兜底。
   */
  private async executeSqliteSnapshotPartnerOpportunityGrowthQuery(params: {
    questionText: string;
    channel: ChannelType;
    user: CrmUser;
    intent: AnalysisIntent;
    scopeSnapshot: ScopeSnapshot;
  }): Promise<AnalysisWarehouseBusinessExecutionResult | null> {
    const snapshotScope = this.resolveSqliteSnapshotScope(params.user, params.scopeSnapshot);
    if (!snapshotScope.canUseWarehouse) {
      this.logSqliteSnapshotScopeFallback(params.user.id, snapshotScope);
      return null;
    }

    const businessRegionFilter = this.resolveBusinessRegionFilter(params.questionText);
    const temporalScope = this.resolveSqliteTemplateTemporalScope(
      params.intent.temporalSlot,
      params.questionText,
    );
    const partners = await this.importSqliteSnapshotResource('partners');
    const opportunities = await this.importSqliteSnapshotResource('opportunities');
    const partnerRows = this.buildSqliteMonthlyRows({
      records: partners.rows
        .filter((record) => this.isSqliteRecordInsideScope(record, snapshotScope))
        .filter((record) => this.isSqliteRecordInsideBusinessRegion(record, businessRegionFilter))
        .filter((record) =>
          this.isDateInsideSqliteTemporalScope(this.resolveSqliteCreatedAt(record), temporalScope),
        ),
      idFields: ['id', 'partnerId', 'partner_id'],
      amountFields: [],
      countKey: 'new_partner_count',
    });
    const opportunityRows = this.buildSqliteMonthlyRows({
      records: opportunities.rows
        .filter((record) => this.isSqliteRecordInsideScope(record, snapshotScope))
        .filter((record) => this.isSqliteRecordInsideBusinessRegion(record, businessRegionFilter))
        .filter((record) =>
          this.isDateInsideSqliteTemporalScope(this.resolveSqliteCreatedAt(record), temporalScope),
        ),
      idFields: ['id', 'opportunityId', 'opportunity_id'],
      amountFields: ['amount', 'opportunityAmount', 'opportunity_amount'],
      countKey: 'new_opportunity_count',
      amountKey: 'opportunity_amount',
    });
    const sql = this.buildSqliteSnapshotSqlComment({
      title: '渠道商新增与商机增长组合模板',
      resources: [partners, opportunities],
      statisticScopeLabel: '渠道商按创建时间统计新增；商机按创建时间统计新增和金额',
    });
    const slice = this.buildPartnerOpportunityGrowthSlice({
      partnerRows,
      opportunityRows,
      sql,
      temporalScope,
      scopeSummary: snapshotScope.summary,
      businessRegionFilter,
    });
    slice.matchedAdapter = 'sqlite-snapshot.fixed-partner-opportunity-growth';

    return this.buildSqliteSnapshotExecutionResult({
      slice,
      sql,
      resources: [partners, opportunities],
      columns: this.uniqueStrings([
        ...Object.keys(partnerRows[0] ?? {}),
        ...Object.keys(opportunityRows[0] ?? {}),
      ]),
      rowLimit: 1000,
      timeoutMs: 5000,
    });
  }

  /**
   * 基于 SQLite 快照执行“商机整体 + 渠道商维度”默认模板。
   *
   * 参数说明：`params` 为当前问数上下文。
   * 返回值说明：返回商机总览、阶段分布、渠道商贡献和重点商机明细。
   * 调用注意事项：这是“商机情况”的默认经营口径，不再退化为负责人排行或单一阶段分布。
   */
  private async executeSqliteSnapshotOpportunityPartnerOverviewQuery(params: {
    questionText: string;
    channel: ChannelType;
    user: CrmUser;
    intent: AnalysisIntent;
    scopeSnapshot: ScopeSnapshot;
  }): Promise<AnalysisWarehouseBusinessExecutionResult | null> {
    const snapshotScope = this.resolveSqliteSnapshotScope(params.user, params.scopeSnapshot);
    if (!snapshotScope.canUseWarehouse) {
      this.logSqliteSnapshotScopeFallback(params.user.id, snapshotScope);
      return null;
    }

    const businessRegionFilter = this.resolveBusinessRegionFilter(params.questionText);
    const temporalScope = this.resolveSqliteTemplateTemporalScope(
      params.intent.temporalSlot,
      params.questionText,
    );
    const opportunities = await this.importSqliteSnapshotResource('opportunities');
    const partners = await this.importOptionalSqliteSnapshotResource('partners');
    const resources = [opportunities, ...(partners ? [partners] : [])];
    const openApiSnapshot = await this.tryFetchOpenApiBusinessChainSnapshot({
      questionText: params.questionText,
      user: params.user,
      scopeSummary: snapshotScope.summary,
      temporalScope,
      temporalSlot: params.intent.temporalSlot,
      resources: ['partners', 'opportunities'],
    });
    if (!openApiSnapshot) {
      return null;
    }

    const partnerNameMap = this.buildSqlitePartnerNameMap(openApiSnapshot.partners);
    const scopedOpportunities = openApiSnapshot.opportunities;
    const stageRows = this.buildSqliteOpportunityStageRows(scopedOpportunities);
    const partnerRows = this.buildSqliteOpportunityPartnerRows(scopedOpportunities, partnerNameMap);
    const detailRows = this.buildSqliteOpportunityDetailRows(scopedOpportunities, partnerNameMap);
    const snapshotSql = this.buildSqliteSnapshotSqlComment({
      title: '商机整体与渠道商维度总览模板',
      resources,
      statisticScopeLabel: '商机按创建时间统计整体数量、金额、阶段分布、渠道商贡献和重点明细',
    });
    const sql = this.mergeSqliteTemplateAndOpenApiSnapshotSql(snapshotSql, openApiSnapshot.sql);
    const slice = this.buildOpportunityPartnerOverviewSlice({
      opportunities: scopedOpportunities,
      stageRows,
      partnerRows,
      detailRows,
      sql,
      temporalScope,
      scopeSummary: snapshotScope.summary,
      businessRegionFilter,
    });
    this.markOpenApiHydratedSlice(
      slice,
      'sqlite-snapshot.fixed-opportunity-partner-overview.openapi-detail',
    );

    return this.buildSqliteSnapshotExecutionResult({
      slice,
      sql,
      resources,
      columns: this.uniqueStrings([
        ...Object.keys(stageRows[0] ?? {}),
        ...Object.keys(partnerRows[0] ?? {}),
        ...Object.keys(detailRows[0] ?? {}),
      ]),
      rowLimit: 1000,
      timeoutMs: 5000,
      extraTables: ['openapi:/partners', 'openapi:/opportunities'],
    });
  }

  /**
   * 基于 SQLite 快照执行“渠道商经营链路”默认模板。
   *
   * 参数说明：`params` 为当前问数上下文。
   * 返回值说明：按渠道商聚合客户报备、商机和有效订单，展示经营贡献。
   * 调用注意事项：渠道商问题默认拉通业务链，不再只看渠道主数据画像。
   */
  private async executeSqliteSnapshotPartnerBusinessChainQuery(params: {
    questionText: string;
    channel: ChannelType;
    user: CrmUser;
    intent: AnalysisIntent;
    scopeSnapshot: ScopeSnapshot;
  }): Promise<AnalysisWarehouseBusinessExecutionResult | null> {
    const snapshotScope = this.resolveSqliteSnapshotScope(params.user, params.scopeSnapshot);
    if (!snapshotScope.canUseWarehouse) {
      this.logSqliteSnapshotScopeFallback(params.user.id, snapshotScope);
      return null;
    }

    const businessRegionFilter = this.resolveBusinessRegionFilter(params.questionText);
    const temporalScope = this.resolveSqliteTemplateTemporalScope(
      params.intent.temporalSlot,
      params.questionText,
    );
    const [partners, registrations, opportunities, orders] = await Promise.all([
      this.importSqliteSnapshotResource('partners'),
      this.importSqliteSnapshotResource('registrations'),
      this.importSqliteSnapshotResource('opportunities'),
      this.importSqliteSnapshotResource('orders'),
    ]);
    const openApiSnapshot = await this.tryFetchOpenApiBusinessChainSnapshot({
      questionText: params.questionText,
      user: params.user,
      scopeSummary: snapshotScope.summary,
      temporalScope,
      temporalSlot: params.intent.temporalSlot,
      resources: ['partners', 'registrations', 'opportunities', 'orders'],
    });
    if (!openApiSnapshot) {
      return null;
    }

    const scopedPartners = openApiSnapshot.partners;
    const scopedRegistrations = openApiSnapshot.registrations;
    const scopedOpportunities = openApiSnapshot.opportunities;
    const scopedOrders = openApiSnapshot.orders.filter((record) =>
      this.isEffectiveSqliteOrderRecord(record),
    );
    const partnerRows = this.buildSqlitePartnerBusinessChainRows({
      partners: scopedPartners,
      registrations: scopedRegistrations,
      opportunities: scopedOpportunities,
      orders: scopedOrders,
    });
    const snapshotSql = this.buildSqliteSnapshotSqlComment({
      title: '渠道商客户报备、商机和订单经营链路模板',
      resources: [partners, registrations, opportunities, orders],
      statisticScopeLabel: '按渠道商聚合客户报备数、商机数、商机金额、有效订单数和有效订单金额',
    });
    const sql = this.mergeSqliteTemplateAndOpenApiSnapshotSql(snapshotSql, openApiSnapshot.sql);
    const slice = this.buildPartnerBusinessChainSlice({
      partnerRows,
      sql,
      temporalScope,
      scopeSummary: snapshotScope.summary,
      businessRegionFilter,
    });
    this.markOpenApiHydratedSlice(
      slice,
      'sqlite-snapshot.fixed-partner-business-chain.openapi-detail',
    );

    return this.buildSqliteSnapshotExecutionResult({
      slice,
      sql,
      resources: [partners, registrations, opportunities, orders],
      columns: Object.keys(partnerRows[0] ?? {}),
      rowLimit: 1000,
      timeoutMs: 5000,
      extraTables: ['openapi:/partners', 'openapi:/registrations', 'openapi:/opportunities', 'openapi:/orders'],
    });
  }

  /**
   * 基于 SQLite 快照执行“客户报备 + 渠道商维度”默认模板。
   *
   * 参数说明：`params` 为当前问数上下文。
   * 返回值说明：返回客户报备总览、渠道商分布、关联商机情况和未关联商机明细。
   * 调用注意事项：报备问题默认关联渠道商和商机状态，避免只输出单表报备数量。
   */
  private async executeSqliteSnapshotRegistrationPartnerOverviewQuery(params: {
    questionText: string;
    channel: ChannelType;
    user: CrmUser;
    intent: AnalysisIntent;
    scopeSnapshot: ScopeSnapshot;
  }): Promise<AnalysisWarehouseBusinessExecutionResult | null> {
    const snapshotScope = this.resolveSqliteSnapshotScope(params.user, params.scopeSnapshot);
    if (!snapshotScope.canUseWarehouse) {
      this.logSqliteSnapshotScopeFallback(params.user.id, snapshotScope);
      return null;
    }

    const businessRegionFilter = this.resolveBusinessRegionFilter(params.questionText);
    const temporalScope = this.resolveSqliteTemplateTemporalScope(
      params.intent.temporalSlot,
      params.questionText,
    );
    const [registrations, opportunities, partners] = await Promise.all([
      this.importSqliteSnapshotResource('registrations'),
      this.importSqliteSnapshotResource('opportunities'),
      this.importOptionalSqliteSnapshotResource('partners'),
    ]);
    const openApiSnapshot = await this.tryFetchOpenApiBusinessChainSnapshot({
      questionText: params.questionText,
      user: params.user,
      scopeSummary: snapshotScope.summary,
      temporalScope,
      temporalSlot: params.intent.temporalSlot,
      resources: ['partners', 'registrations', 'opportunities'],
    });
    if (!openApiSnapshot) {
      return null;
    }

    const partnerNameMap = this.buildSqlitePartnerNameMap(openApiSnapshot.partners);
    const scopedRegistrations = openApiSnapshot.registrations;
    const scopedOpportunities = openApiSnapshot.opportunities;
    const partnerRows = this.buildSqliteRegistrationPartnerRows(
      scopedRegistrations,
      scopedOpportunities,
      partnerNameMap,
    );
    const detailRows = this.buildSqliteRegistrationDetailRows(
      scopedRegistrations,
      scopedOpportunities,
      partnerNameMap,
    );
    const unlinkedRows = this.buildSqliteRegistrationWithoutOpportunityRows({
      registrations: scopedRegistrations,
      opportunities: scopedOpportunities,
    });
    const resources = [registrations, opportunities, ...(partners ? [partners] : [])];
    const snapshotSql = this.buildSqliteSnapshotSqlComment({
      title: '客户报备与渠道商维度总览模板',
      resources,
      statisticScopeLabel: '客户报备按创建时间统计，并按渠道商聚合关联商机和未关联商机情况',
    });
    const sql = this.mergeSqliteTemplateAndOpenApiSnapshotSql(snapshotSql, openApiSnapshot.sql);
    const slice = this.buildRegistrationPartnerOverviewSlice({
      registrationRows: scopedRegistrations,
      partnerRows,
      detailRows,
      unlinkedRows,
      sql,
      temporalScope,
      scopeSummary: snapshotScope.summary,
      businessRegionFilter,
    });
    this.markOpenApiHydratedSlice(
      slice,
      'sqlite-snapshot.fixed-registration-partner-overview.openapi-detail',
    );

    return this.buildSqliteSnapshotExecutionResult({
      slice,
      sql,
      resources,
      columns: this.uniqueStrings([
        ...Object.keys(partnerRows[0] ?? {}),
        ...Object.keys(detailRows[0] ?? {}),
        ...Object.keys(unlinkedRows[0] ?? {}),
      ]),
      rowLimit: 1000,
      timeoutMs: 5000,
      extraTables: ['openapi:/partners', 'openapi:/registrations', 'openapi:/opportunities'],
    });
  }

  /**
   * 基于 SQLite 快照执行“订单 + 渠道商维度”默认模板。
   *
   * 参数说明：`params` 为当前问数上下文。
   * 返回值说明：返回有效订单总览、渠道商贡献和订单明细。
   * 调用注意事项：订单问题默认按渠道商贡献呈现，而不是只按区域或合同口径兜底。
   */
  private async executeSqliteSnapshotOrderPartnerOverviewQuery(params: {
    questionText: string;
    channel: ChannelType;
    user: CrmUser;
    intent: AnalysisIntent;
    scopeSnapshot: ScopeSnapshot;
  }): Promise<AnalysisWarehouseBusinessExecutionResult | null> {
    const snapshotScope = this.resolveSqliteSnapshotScope(params.user, params.scopeSnapshot);
    if (!snapshotScope.canUseWarehouse) {
      this.logSqliteSnapshotScopeFallback(params.user.id, snapshotScope);
      return null;
    }

    const businessRegionFilter = this.resolveBusinessRegionFilter(params.questionText);
    const temporalScope = this.resolveSqliteTemplateTemporalScope(
      params.intent.temporalSlot,
      params.questionText,
    );
    const [orders, partners] = await Promise.all([
      this.importSqliteSnapshotResource('orders'),
      this.importOptionalSqliteSnapshotResource('partners'),
    ]);
    const openApiSnapshot = await this.tryFetchOpenApiBusinessChainSnapshot({
      questionText: params.questionText,
      user: params.user,
      scopeSummary: snapshotScope.summary,
      temporalScope,
      temporalSlot: params.intent.temporalSlot,
      resources: ['partners', 'orders'],
    });
    if (!openApiSnapshot) {
      return null;
    }

    const partnerNameMap = this.buildSqlitePartnerNameMap(openApiSnapshot.partners);
    const scopedOrders = openApiSnapshot.orders.filter((record) =>
      this.isEffectiveSqliteOrderRecord(record),
    );
    const partnerRows = this.buildSqliteOrderPartnerRows(scopedOrders, partnerNameMap);
    const detailRows = this.buildSqliteOrderDetailRows(scopedOrders, partnerNameMap);
    const resources = [orders, ...(partners ? [partners] : [])];
    const snapshotSql = this.buildSqliteSnapshotSqlComment({
      title: '订单与渠道商贡献总览模板',
      resources,
      statisticScopeLabel: '有效订单按成交时间优先、创建时间兜底统计，并按渠道商聚合数量和金额',
    });
    const sql = this.mergeSqliteTemplateAndOpenApiSnapshotSql(snapshotSql, openApiSnapshot.sql);
    const slice = this.buildOrderPartnerOverviewSlice({
      orderRows: scopedOrders,
      partnerRows,
      detailRows,
      sql,
      temporalScope,
      scopeSummary: snapshotScope.summary,
      businessRegionFilter,
    });
    this.markOpenApiHydratedSlice(
      slice,
      'sqlite-snapshot.fixed-order-partner-overview.openapi-detail',
    );

    return this.buildSqliteSnapshotExecutionResult({
      slice,
      sql,
      resources,
      columns: this.uniqueStrings([
        ...Object.keys(partnerRows[0] ?? {}),
        ...Object.keys(detailRows[0] ?? {}),
      ]),
      rowLimit: 1000,
      timeoutMs: 5000,
      extraTables: ['openapi:/partners', 'openapi:/orders'],
    });
  }

  /**
   * 基于 SQLite 快照执行“订单情况 + 商机情况”组合模板。
   *
   * 参数说明：`params` 为当前问数上下文。
   * 返回值说明：返回订单和商机两个独立趋势区块。
   * 调用注意事项：订单和商机分别汇总，避免综合经营问法被降级成单对象 OpenAPI 兜底。
   */
  private async executeSqliteSnapshotOrderOpportunityOverviewQuery(params: {
    questionText: string;
    channel: ChannelType;
    user: CrmUser;
    intent: AnalysisIntent;
    scopeSnapshot: ScopeSnapshot;
  }): Promise<AnalysisWarehouseBusinessExecutionResult | null> {
    const snapshotScope = this.resolveSqliteSnapshotScope(params.user, params.scopeSnapshot);
    if (!snapshotScope.canUseWarehouse) {
      this.logSqliteSnapshotScopeFallback(params.user.id, snapshotScope);
      return null;
    }

    const businessRegionFilter = this.resolveBusinessRegionFilter(params.questionText);
    const temporalScope = this.resolveSqliteTemplateTemporalScope(
      params.intent.temporalSlot,
      params.questionText,
    );
    const orders = await this.importSqliteSnapshotResource('orders');
    const opportunities = await this.importSqliteSnapshotResource('opportunities');
    const orderRows = this.buildSqliteMonthlyRows({
      records: orders.rows
        .filter((record) => this.isSqliteRecordInsideScope(record, snapshotScope))
        .filter((record) => this.isSqliteRecordInsideBusinessRegion(record, businessRegionFilter))
        .filter((record) => this.isEffectiveSqliteOrderRecord(record))
        .filter((record) =>
          this.isDateInsideSqliteTemporalScope(this.resolveSqliteOrderStatisticAt(record), temporalScope),
        ),
      idFields: ['id', 'orderId', 'order_id'],
      amountFields: ['amount', 'orderAmount', 'order_amount', 'totalAmount', 'total_amount'],
      countKey: 'order_count',
      amountKey: 'order_amount',
      dateResolver: (record) => this.resolveSqliteOrderStatisticAt(record),
    });
    const opportunityRows = this.buildSqliteMonthlyRows({
      records: opportunities.rows
        .filter((record) => this.isSqliteRecordInsideScope(record, snapshotScope))
        .filter((record) => this.isSqliteRecordInsideBusinessRegion(record, businessRegionFilter))
        .filter((record) =>
          this.isDateInsideSqliteTemporalScope(this.resolveSqliteCreatedAt(record), temporalScope),
        ),
      idFields: ['id', 'opportunityId', 'opportunity_id'],
      amountFields: ['amount', 'opportunityAmount', 'opportunity_amount'],
      countKey: 'opportunity_count',
      amountKey: 'opportunity_amount',
    });
    const sql = this.buildSqliteSnapshotSqlComment({
      title: '订单与商机分块组合模板',
      resources: [orders, opportunities],
      statisticScopeLabel: '订单按成交时间优先、创建时间兜底统计；商机按创建时间统计',
    });
    const slice = this.buildOrderOpportunityOverviewSlice({
      orderRows,
      opportunityRows,
      sql,
      temporalScope,
      scopeSummary: snapshotScope.summary,
      businessRegionFilter,
    });
    slice.matchedAdapter = 'sqlite-snapshot.fixed-order-opportunity-overview';

    return this.buildSqliteSnapshotExecutionResult({
      slice,
      sql,
      resources: [orders, opportunities],
      columns: this.uniqueStrings([
        ...Object.keys(orderRows[0] ?? {}),
        ...Object.keys(opportunityRows[0] ?? {}),
      ]),
      rowLimit: 1000,
      timeoutMs: 5000,
    });
  }

  /**
   * 基于 SQLite 快照执行“客户、报备、商机、订单、风险”组合经营模板。
   *
   * 参数说明：`params` 为当前问数上下文。
   * 返回值说明：返回组合经营概览、未关联商机报备明细和超期商机明细。
   * 调用注意事项：综合经营问题优先走该模板，避免被旧链路误选为“新增商机金额渠道商贡献”。
   */
  private async executeSqliteSnapshotCompositeOperationsQuery(params: {
    questionText: string;
    channel: ChannelType;
    user: CrmUser;
    intent: AnalysisIntent;
    scopeSnapshot: ScopeSnapshot;
  }): Promise<AnalysisWarehouseBusinessExecutionResult | null> {
    const snapshotScope = this.resolveSqliteSnapshotScope(params.user, params.scopeSnapshot);
    if (!snapshotScope.canUseWarehouse) {
      this.logSqliteSnapshotScopeFallback(params.user.id, snapshotScope);
      return null;
    }

    const businessRegionFilter = this.resolveBusinessRegionFilter(params.questionText);
    const temporalScope = this.resolveSqliteTemplateTemporalScope(
      params.intent.temporalSlot,
      params.questionText,
    );
    const [partners, customers, registrations, opportunities, orders] = await Promise.all([
      this.importSqliteSnapshotResource('partners'),
      this.importOptionalSqliteSnapshotResource('customers'),
      this.importSqliteSnapshotResource('registrations'),
      this.importSqliteSnapshotResource('opportunities'),
      this.importSqliteSnapshotResource('orders'),
    ]);
    const openApiSnapshot = await this.tryFetchOpenApiBusinessChainSnapshot({
      questionText: params.questionText,
      user: params.user,
      scopeSummary: snapshotScope.summary,
      temporalScope,
      temporalSlot: params.intent.temporalSlot,
      resources: ['partners', 'registrations', 'opportunities', 'orders'],
    });
    if (!openApiSnapshot) {
      return null;
    }

    const scopedPartners = openApiSnapshot.partners;
    const scopedRegistrations = openApiSnapshot.registrations;
    const scopedOpportunities = openApiSnapshot.opportunities;
    const temporalOpportunities = scopedOpportunities;
    const scopedOrders = openApiSnapshot.orders.filter((record) =>
      this.isEffectiveSqliteOrderRecord(record),
    );
    const unlinkedRows = this.buildSqliteRegistrationWithoutOpportunityRows({
      registrations: scopedRegistrations,
      opportunities: scopedOpportunities,
    });
    const staleThreshold = resolveStaleOpportunityThreshold(params.questionText);
    const staleRows = scopedOpportunities
      .filter((record) => this.isEffectiveSqliteOpportunityRecord(record))
      .map((record) => this.buildSqliteStaleOpportunityRow(record, staleThreshold.days))
      .filter((row): row is Record<string, unknown> => Boolean(row))
      .slice(0, 100);
    const derivedCustomerCount = this.countDistinctSqliteCustomers([
      ...scopedRegistrations,
      ...temporalOpportunities,
      ...scopedOrders,
    ]);
    const customerCount = derivedCustomerCount;
    const resources = [
      partners,
      ...(customers ? [customers] : []),
      registrations,
      opportunities,
      orders,
    ];
    const snapshotSql = this.buildSqliteSnapshotSqlComment({
      title: '合作伙伴、客户报备、商机、订单和风险组合经营模板',
      resources,
      statisticScopeLabel:
        '合作伙伴开拓、客户报备、商机、订单和风险明细组合统计；真实明细来自 OpenAPI 临时快照，涉及客户数按报备、商机和订单中的客户标识去重估算',
    });
    const sql = this.mergeSqliteTemplateAndOpenApiSnapshotSql(snapshotSql, openApiSnapshot.sql);
    const slice = this.buildCompositeOperationsSlice({
      partnerSummary: { partner_count: scopedPartners.length },
      customerSummary: {
        customer_count: customerCount,
        customer_count_source: 'derived-from-openapi-business-records',
      },
      registrationSummary: { registration_count: scopedRegistrations.length },
      opportunitySummary: {
        opportunity_count: temporalOpportunities.length,
        opportunity_amount: this.sumSqliteRecordAmount(temporalOpportunities, [
          'amount',
          'opportunityAmount',
          'opportunity_amount',
        ]),
      },
      orderSummary: {
        order_count: scopedOrders.length,
        order_amount: this.sumSqliteRecordAmount(scopedOrders, [
          'amount',
          'orderAmount',
          'order_amount',
          'totalAmount',
          'total_amount',
        ]),
      },
      unlinkedRows,
      staleRows,
      sql,
      temporalSlot: this.toTemporalSlotFromResultScope(temporalScope, params.intent.temporalSlot),
      scopeSummary: snapshotScope.summary,
      businessRegionFilter,
    });
    this.markOpenApiHydratedSlice(
      slice,
      'sqlite-snapshot.fixed-composite-operations.openapi-detail',
    );

    return this.buildSqliteSnapshotExecutionResult({
      slice,
      sql,
      resources,
      columns: this.uniqueStrings([
        ...Object.keys(unlinkedRows[0] ?? {}),
        ...Object.keys(staleRows[0] ?? {}),
        'partner_count',
        'customer_count',
        'registration_count',
        'opportunity_count',
        'order_count',
      ]),
      rowLimit: 1000,
      timeoutMs: 8000,
      extraTables: ['openapi:/partners', 'openapi:/registrations', 'openapi:/opportunities', 'openapi:/orders'],
    });
  }

  /**
   * 基于 SQLite 快照执行“长时间未更新商机”模板。
   *
   * 参数说明：`params` 为当前问数上下文。
   * 返回值说明：返回停滞商机明细、数量、金额和停滞天数。
   * 调用注意事项：先执行权限裁剪，再执行业务状态和时间阈值过滤，避免快照测试阶段扩大可见范围。
   */
  private async executeSqliteSnapshotStaleOpportunityQuery(params: {
    questionText: string;
    channel: ChannelType;
    user: CrmUser;
    intent: AnalysisIntent;
    scopeSnapshot: ScopeSnapshot;
  }): Promise<AnalysisWarehouseBusinessExecutionResult | null> {
    const snapshotScope = this.resolveSqliteSnapshotScope(params.user, params.scopeSnapshot);
    if (!snapshotScope.canUseWarehouse) {
      this.analysisLoggerService.logStep('SQLite 脱敏快照固定模板缺少可安全使用的权限范围，已回退现有链路。', {
        userId: params.user.id,
        fallbackReason: snapshotScope.fallbackReason,
      });
      return null;
    }

    const staleThreshold = resolveStaleOpportunityThreshold(params.questionText);
    const businessRegionFilter = this.resolveBusinessRegionFilter(params.questionText);
    const importResult = await this.analysisWarehouseSqliteSnapshotImporterService.importResource({
      resource: 'opportunities',
      mode: 'FULL',
      pageSize: 1000,
      maxPages: 20,
    });
    const rows = importResult.rows
      .map((row) => row.payload)
      .filter((record) => this.isSqliteOpportunityInsideScope(record, snapshotScope))
      .filter((record) => this.isSqliteOpportunityInsideBusinessRegion(record, businessRegionFilter))
      .filter((record) => this.isEffectiveSqliteOpportunityRecord(record))
      .map((record) =>
        this.buildSqliteStaleOpportunityRow(record, staleThreshold.days),
      )
      .filter((row): row is Record<string, unknown> => Boolean(row))
      .sort(
        (left, right) =>
          Number(right.stale_days ?? 0) - Number(left.stale_days ?? 0) ||
          Number(right.amount ?? 0) - Number(left.amount ?? 0) ||
          String(left.opportunity_id ?? '').localeCompare(String(right.opportunity_id ?? ''), 'zh-Hans-CN'),
      )
      .slice(0, 1000);
    const snapshotSql = [
      '-- 联软 SQLite 脱敏快照固定模板：读取 opportunities 资源。',
      `-- 过滤口径：进展更新时间超过 ${staleThreshold.days} 天，排除已成交、已失单、取消、删除等无效商机。`,
      `-- 快照文件：${importResult.snapshotFile ?? '未返回文件名'}；资源表：${importResult.tableName ?? 'opportunities'}。`,
    ].join('\n');
    const openApiDetail = await this.tryBuildOpenApiStaleOpportunityDetailRows({
      questionText: params.questionText,
      user: params.user,
      scopeSummary: snapshotScope.summary,
    });
    const finalRows = openApiDetail?.rows ?? rows;
    const sql = openApiDetail
      ? [
          snapshotSql,
          '-- 明细补数：已通过联软标准 OpenAPI 获取当前授权范围内的真实商机、客户、渠道商和负责人名称。',
          openApiDetail.sql,
        ].join('\n')
      : snapshotSql;
    const slice = this.buildStaleOpportunitySlice({
      rows: finalRows,
      sql,
      scopeSummary: snapshotScope.summary,
      businessRegionFilter,
      thresholdDays: staleThreshold.days,
      thresholdLabel: staleThreshold.label,
    });
    slice.matchedAdapter = openApiDetail
      ? 'sqlite-snapshot.fixed-stale-opportunity.openapi-detail'
      : 'sqlite-snapshot.fixed-stale-opportunity';
    if (openApiDetail) {
      const totalAmount = this.sumNumeric(finalRows, 'amount');
      const maxStaleDays = Math.max(
        0,
        ...finalRows
          .map((row) => Number(row.stale_days))
          .filter((value) => Number.isFinite(value)),
      );
      slice.summary =
        finalRows.length > 0
          ? `已按 SQLite 快照模板识别停滞商机口径，并通过联软标准 OpenAPI 返回真实明细：当前授权范围内共有 ${finalRows.length} 条商机${staleThreshold.label}未更新，涉及商机金额 ${formatWanAmount(totalAmount)}，最长未更新 ${maxStaleDays} 天。`
          : `已按 SQLite 快照模板识别停滞商机口径，并通过联软标准 OpenAPI 复核：当前授权范围内未发现${staleThreshold.label}未更新的商机。`;
    }

    return {
      slice,
      sql,
      tables: openApiDetail
        ? [importResult.tableName ?? 'opportunities', 'openapi:/opportunities']
        : [importResult.tableName ?? 'opportunities'],
      columns: finalRows.length ? Object.keys(finalRows[0]) : [],
      rowLimit: 1000,
      timeoutMs: 5000,
    };
  }

  /**
   * 尝试用联软标准 OpenAPI 补齐停滞商机真实明细。
   *
   * 参数说明：`questionText` 为用户原始问题，`user` 为当前 CRM 用户，`scopeSummary` 为 SQLite 权限摘要。
   * 返回值说明：OpenAPI 成功时返回标准化后的明细行和执行摘要；未配置或调用失败时返回 `null`。
   * 调用注意事项：SQLite-only 只表示不访问 MySQL 分析库；真实业务名称仍应优先从联软 OpenAPI 获取，
   * 且 OpenAPI 执行器会继续校验绑定用户或服务账号本地裁剪策略，不能绕过联软授权范围。
   */
  private async tryBuildOpenApiStaleOpportunityDetailRows(params: {
    questionText: string;
    user: CrmUser;
    scopeSummary: string;
  }): Promise<{ rows: Array<Record<string, unknown>>; sql: string } | null> {
    if (!this.lianruanCrmAnalysisExecutorService) {
      return null;
    }

    try {
      const openApiSlice = await this.lianruanCrmAnalysisExecutorService.executeStaleOpportunityDetailTask(
        params.questionText,
        params.user,
        params.scopeSummary,
      );
      return {
        rows: this.normalizeOpenApiStaleOpportunityRows(openApiSlice.tableRows ?? []),
        sql: openApiSlice.sql,
      };
    } catch (error) {
      this.analysisLoggerService.logWarn('联软标准 OpenAPI 停滞商机明细补数失败，已保留 SQLite 脱敏快照明细。', {
        userId: params.user.id,
        reason: error instanceof Error ? error.message : 'unknown',
      });
      return null;
    }
  }

  /**
   * 尝试读取联软标准 OpenAPI 真实业务链快照。
   *
   * 参数说明：`params` 包含用户问题、当前 CRM 用户、权限摘要、时间口径和需要读取的资源列表。
   * 返回值说明：成功时返回本次请求内临时缓存的真实业务记录，失败时返回 `null`。
   * 调用注意事项：SQLite 快照只负责模板命中和关系口径；四类默认经营分析的明细必须来自 OpenAPI。
   * 如果 OpenAPI 不可用，调用方应回退后续真实数据链路，不允许继续展示脱敏占位明细。
   */
  private async tryFetchOpenApiBusinessChainSnapshot(params: {
    questionText: string;
    user: CrmUser;
    scopeSummary: string;
    temporalScope?: ResultTemporalScope;
    temporalSlot?: AnalysisIntent['temporalSlot'];
    resources: BusinessChainOpenApiResource[];
  }): Promise<LianruanCrmOpenApiBusinessChainSnapshot | null> {
    if (!this.lianruanCrmAnalysisExecutorService) {
      this.analysisLoggerService.logWarn('联软标准 OpenAPI 业务链真实明细补数不可用，已跳过 SQLite 脱敏明细展示。', {
        userId: params.user.id,
        reason: '未注入联软标准 OpenAPI 分析执行器。',
      });
      return null;
    }

    try {
      return await this.lianruanCrmAnalysisExecutorService.fetchBusinessChainSnapshot({
        questionText: params.questionText,
        user: params.user,
        scopeSummary: params.scopeSummary,
        temporalSlot: this.toTemporalSlotFromResultScope(params.temporalScope, params.temporalSlot),
        resources: params.resources,
      });
    } catch (error) {
      this.analysisLoggerService.logWarn('联软标准 OpenAPI 业务链真实明细补数失败，已跳过 SQLite 脱敏明细展示。', {
        userId: params.user.id,
        resources: params.resources,
        reason: error instanceof Error ? error.message : 'unknown',
      });
      return null;
    }
  }

  /**
   * 将标准 OpenAPI 停滞商机行收敛为 SQLite 模板使用的中文列口径。
   *
   * 参数说明：`rows` 为 OpenAPI 分析执行器返回的原始展示行。
   * 返回值说明：返回字段稳定、列数克制的商机明细，供企微模板卡片和公开结果页展示。
   * 调用注意事项：只做字段命名和展示收敛，不改写金额、阶段和停滞天数等业务事实。
   */
  private normalizeOpenApiStaleOpportunityRows(
    rows: Array<Record<string, unknown>>,
  ): Array<Record<string, unknown>> {
    return rows.map((row) => ({
      opportunity_id: this.readString(row.opportunityId ?? row.opportunity_id),
      opportunity_name: this.readString(row.opportunityName ?? row.opportunity_name ?? row.ownerName),
      customer_name: this.readString(row.customerName ?? row.customer_name),
      partner_name: this.readString(row.partnerName ?? row.partner_name),
      owner_name: this.readString(row.salesOwnerName ?? row.owner_name ?? row.ownerName),
      stage_name: formatOpportunityStageLabel(this.readString(row.stageName ?? row.stage_name)),
      region: this.readString(row.region),
      big_region: this.readString(row.bigRegion ?? row.big_region),
      amount: this.readNumber(row.amount),
      source_updated_at: this.readString(row.sourceUpdatedAt ?? row.source_updated_at),
      stale_days: this.readNumber(row.stale_days ?? row.staleDays),
    }));
  }

  /**
   * 记录 SQLite 快照权限缺口。
   *
   * 参数说明：`userId` 为当前用户 ID，`snapshotScope` 为本地解析出的快照权限范围。
   * 返回值说明：无。
   * 调用注意事项：只记录降级原因，不把快照数据扩大到无法校验的范围。
   */
  private logSqliteSnapshotScopeFallback(
    userId: string,
    snapshotScope: WarehouseScopeResolution,
  ): void {
    this.analysisLoggerService.logStep('SQLite 脱敏快照固定模板缺少可安全使用的权限范围，已回退现有链路。', {
      userId,
      fallbackReason: snapshotScope.fallbackReason,
    });
  }

  /**
   * 导入 SQLite 快照白名单资源。
   *
   * 参数说明：`resource` 为联软快照资源名。
   * 返回值说明：返回展开后的业务 JSON 行和快照元数据。
   * 调用注意事项：统一使用导入器白名单，不允许模板自行读取任意 SQLite 表。
   */
  private async importSqliteSnapshotResource(
    resource: AnalysisWarehouseResource,
  ): Promise<SqliteSnapshotBusinessResource> {
    const result = await this.analysisWarehouseSqliteSnapshotImporterService.importResource({
      resource,
      mode: 'FULL',
      pageSize: 1000,
      maxPages: 20,
    });

    return {
      resource,
      rows: result.rows.map((row) => row.payload),
      tableName: result.tableName ?? resource,
      snapshotFile: result.snapshotFile ?? '未返回文件名',
    };
  }

  /**
   * 导入 SQLite 快照可选资源。
   *
   * 参数说明：`resource` 为可能未出现在联软快照中的资源名。
   * 返回值说明：资源存在时返回业务行；快照明确缺少该资源时返回 `null`。
   * 调用注意事项：只能吞掉“资源白名单表缺失”这一类结构性缺口；哈希失败、文件损坏等问题必须继续抛出。
   */
  private async importOptionalSqliteSnapshotResource(
    resource: AnalysisWarehouseResource,
  ): Promise<SqliteSnapshotBusinessResource | null> {
    try {
      return await this.importSqliteSnapshotResource(resource);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (!reason.includes(`SQLite 快照中未找到资源 ${resource} 对应的白名单表`)) {
        throw error;
      }

      this.analysisLoggerService.logStep('SQLite 脱敏快照未提供可选资源，已使用可用业务表继续组合分析。', {
        resource,
        fallbackReason: reason,
      });
      return null;
    }
  }

  /**
   * 构造 SQLite 快照执行结果。
   *
   * 参数说明：包含结果切片、SQL 注释、参与资源和列名。
   * 返回值说明：返回统一分析库执行结果。
   * 调用注意事项：SQLite 固定模板不经过 SQL Guard，因此 SQL 字段只作为审计说明，不作为可执行 SQL 展示。
   */
  private buildSqliteSnapshotExecutionResult(params: {
    slice: AnalysisDatasetSlice;
    sql: string;
    resources: SqliteSnapshotBusinessResource[];
    columns: string[];
    rowLimit: number;
    timeoutMs: number;
    extraTables?: string[];
  }): AnalysisWarehouseBusinessExecutionResult {
    return {
      slice: params.slice,
      sql: params.sql,
      tables: this.uniqueStrings([
        ...params.resources.map((item) => item.tableName),
        ...(params.extraTables ?? []),
      ]),
      columns: params.columns,
      rowLimit: params.rowLimit,
      timeoutMs: params.timeoutMs,
    };
  }

  /**
   * 构造 SQLite 快照审计说明。
   *
   * 参数说明：包含模板名称、读取资源和统计口径。
   * 返回值说明：返回用于执行追踪展示的注释文本。
   * 调用注意事项：这里不是用户输入 SQL，避免误导为可直接在生产库执行的查询语句。
   */
  private buildSqliteSnapshotSqlComment(params: {
    title: string;
    resources: SqliteSnapshotBusinessResource[];
    statisticScopeLabel: string;
  }): string {
    const resourceText = params.resources
      .map((item) => `${item.resource}:${item.tableName}`)
      .join('、');
    const snapshotFile = params.resources[0]?.snapshotFile ?? '未返回文件名';
    return [
      `-- 联软 SQLite 脱敏快照固定模板：${params.title}。`,
      `-- 读取资源：${resourceText}。`,
      `-- 统计口径：${params.statisticScopeLabel}。`,
      `-- 快照文件：${snapshotFile}。`,
    ].join('\n');
  }

  /**
   * 合并 SQLite 模板口径和 OpenAPI 真实明细取数摘要。
   *
   * 参数说明：`sqliteSql` 为快照模板说明，`openApiSql` 为标准 OpenAPI 取数说明。
   * 返回值说明：返回可审计的双段执行摘要。
   * 调用注意事项：这里只记录受控执行说明，不包含任何密钥、token 或真实接口凭据。
   */
  private mergeSqliteTemplateAndOpenApiSnapshotSql(sqliteSql: string, openApiSql: string): string {
    return [
      sqliteSql,
      '-- 真实明细补数：已通过联软标准 OpenAPI 拉取当前授权范围内的临时业务链快照。',
      openApiSql,
    ].join('\n');
  }

  /**
   * 标记结果切片已由 OpenAPI 真实明细补数。
   *
   * 参数说明：`slice` 为待返回的统一结果切片，`matchedAdapter` 为最终适配器标识。
   * 返回值说明：无，原地更新切片元数据和用户可见数据来源。
   * 调用注意事项：真实明细成功后必须覆盖默认“AI-agent 自建分析库”说明，避免误导用户。
   */
  private markOpenApiHydratedSlice(
    slice: AnalysisDatasetSlice,
    matchedAdapter: string,
  ): void {
    slice.matchedAdapter = matchedAdapter;
    slice.appliedFilters = slice.appliedFilters.map((item) =>
      item.label === '数据来源'
        ? {
            ...item,
            value: '联软标准 OpenAPI 真实明细临时快照；SQLite 快照仅用于模板命中和统计口径。',
          }
        : item,
    );
  }

  /**
   * 按月份聚合 SQLite 快照记录。
   *
   * 参数说明：记录集合、主键候选、金额候选和输出列名。
   * 返回值说明：返回按 `month_label` 升序的月度统计行。
   * 调用注意事项：只做内存聚合，不接受用户字段名；候选字段均由模板固定传入。
   */
  private buildSqliteMonthlyRows(params: {
    records: Array<Record<string, unknown>>;
    idFields: string[];
    amountFields: string[];
    countKey: string;
    amountKey?: string;
    dateResolver?: (record: Record<string, unknown>) => Date | null;
  }): Array<Record<string, unknown>> {
    const bucket = new Map<string, { ids: Set<string>; count: number; amount: number }>();
    for (const record of params.records) {
      const date = params.dateResolver
        ? params.dateResolver(record)
        : this.resolveSqliteCreatedAt(record);
      if (!date) {
        continue;
      }

      const monthLabel = date.toISOString().slice(0, 7);
      const current = bucket.get(monthLabel) ?? { ids: new Set<string>(), count: 0, amount: 0 };
      const id = this.readFirstString(record, params.idFields);
      if (id) {
        current.ids.add(id);
      } else {
        current.count += 1;
      }
      current.amount += this.readFirstNumber(record, params.amountFields);
      bucket.set(monthLabel, current);
    }

    return [...bucket.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([monthLabel, item]) => ({
        month_label: monthLabel,
        [params.countKey]: item.ids.size + item.count,
        ...(params.amountKey ? { [params.amountKey]: item.amount } : {}),
      }));
  }

  /**
   * 构造 SQLite 快照中的“客户报备未关联商机”明细。
   *
   * 参数说明：`registrations` 为已过滤的报备记录，`opportunities` 为已过滤的商机记录。
   * 返回值说明：返回最多 100 条未关联商机的报备明细。
   * 调用注意事项：优先按 `registrationId` 关联，缺失时用客户 ID 兜底，和 MySQL 模板口径保持一致。
   */
  private buildSqliteRegistrationWithoutOpportunityRows(params: {
    registrations: Array<Record<string, unknown>>;
    opportunities: Array<Record<string, unknown>>;
  }): Array<Record<string, unknown>> {
    const opportunityRegistrationIds = new Set(
      params.opportunities
        .map((record) => this.readFirstString(record, ['registrationId', 'registration_id']))
        .filter(Boolean),
    );
    const opportunityCustomerIds = new Set(
      params.opportunities
        .map((record) => this.readFirstString(record, ['customerId', 'customer_id']))
        .filter(Boolean),
    );

    return params.registrations
      .filter((record) => {
        const registrationId = this.readFirstString(record, ['id', 'registrationId', 'registration_id']);
        const customerId = this.readFirstString(record, ['customerId', 'customer_id']);
        return !(
          (registrationId && opportunityRegistrationIds.has(registrationId)) ||
          (customerId && opportunityCustomerIds.has(customerId))
        );
      })
      .map((record) => {
        const createdAt = this.resolveSqliteCreatedAt(record);
        return {
          registration_id: this.readFirstString(record, ['id', 'registrationId', 'registration_id']),
          customer_id: this.readFirstString(record, ['customerId', 'customer_id']),
          customer_name: this.readFirstString(record, ['customerName', 'customer_name', 'customer']),
          partner_id: this.readFirstString(record, ['partnerId', 'partner_id']),
          partner_name: this.readFirstString(record, ['partnerName', 'partner_name']),
          region: this.readFirstString(record, ['region']),
          big_region: this.readFirstString(record, ['bigRegion', 'big_region']),
          created_at: createdAt?.toISOString() ?? '',
          created_days: createdAt ? this.calculateElapsedDays(createdAt) : 0,
        };
      })
      .sort(
        (left, right) =>
          Number(right.created_days ?? 0) - Number(left.created_days ?? 0) ||
          String(left.registration_id ?? '').localeCompare(String(right.registration_id ?? ''), 'zh-Hans-CN'),
      )
      .slice(0, 100);
  }

  /**
   * 从 SQLite 业务记录中估算涉及客户数。
   *
   * 参数说明：`records` 为已完成权限、区域和时间过滤的报备、商机或订单记录。
   * 返回值说明：返回按客户 ID 优先、客户名称兜底去重后的数量。
   * 调用注意事项：联软脱敏快照可能只提供报备/商机/订单而不提供客户主表，此时只能表达“涉及客户数”，不能冒充客户主数据总量。
   */
  private countDistinctSqliteCustomers(records: Array<Record<string, unknown>>): number {
    const customerKeys = records
      .map((record) =>
        this.readFirstString(record, [
          'customerId',
          'customer_id',
          'customerCode',
          'customer_code',
          'finalCustomerId',
          'final_customer_id',
          'customerName',
          'customer_name',
          'customer',
          'finalCustomer',
          'final_customer',
          'endCustomerName',
          'end_customer_name',
        ]),
      )
      .filter(Boolean);

    return this.uniqueStrings(customerKeys).length;
  }

  /**
   * 解析 SQLite 模板时间范围。
   *
   * 参数说明：`temporalSlot` 为 AI 时间槽，`questionText` 用于兜底识别最近 N 个月。
   * 返回值说明：返回结果展示用时间口径；没有时间限制时返回 undefined。
   * 调用注意事项：与 MySQL 固定模板使用同一“最近 N 个月”兜底策略。
   */
  private resolveSqliteTemplateTemporalScope(
    temporalSlot: AnalysisIntent['temporalSlot'] | undefined,
    questionText: string,
  ): ResultTemporalScope | undefined {
    const aiScope = buildResultTemporalScope(temporalSlot);
    if (aiScope) {
      return aiScope;
    }

    const recentMonths = this.resolveRecentMonthCount(questionText);
    if (!recentMonths) {
      return undefined;
    }

    const endAt = new Date();
    const startAt = new Date(endAt.getTime());
    startAt.setMonth(startAt.getMonth() - recentMonths);
    return {
      rawText: `最近${recentMonths}个月`,
      normalizedLabel: `最近 ${recentMonths} 个月`,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      granularity: 'month',
      timezone: 'Asia/Shanghai',
      source: 'FALLBACK_CLARIFICATION',
    };
  }

  /**
   * 将结果时间口径转回切片构造器需要的时间槽。
   *
   * 参数说明：`temporalScope` 为结果时间口径，`fallback` 为原始 AI 时间槽。
   * 返回值说明：返回可被既有切片构造器识别的时间槽。
   * 调用注意事项：仅用于复用现有展示构造器，不改变实际过滤结果。
   */
  private toTemporalSlotFromResultScope(
    temporalScope: ResultTemporalScope | undefined,
    fallback: AnalysisIntent['temporalSlot'] | undefined,
  ): AnalysisIntent['temporalSlot'] | undefined {
    if (fallback || !temporalScope) {
      return fallback;
    }

    return {
      rawText: temporalScope.rawText,
      normalizedLabel: temporalScope.normalizedLabel,
      startAt: temporalScope.startAt,
      endAt: temporalScope.endAt,
      timezone: 'Asia/Shanghai',
      granularity: this.normalizeTemporalGranularity(temporalScope.granularity),
      relativity: 'relative',
      inclusivity: {
        start: 'inclusive',
        end: 'exclusive',
      },
      confidence: 'MEDIUM',
    };
  }

  /**
   * 判断日期是否落在 SQLite 模板时间范围内。
   *
   * 参数说明：`date` 为业务日期，`temporalScope` 为已解析时间口径。
   * 返回值说明：没有时间口径时返回 true；日期缺失且存在时间口径时返回 false。
   * 调用注意事项：用于内存过滤，避免把“最近一年”问题错误统计成全量。
   */
  private isDateInsideSqliteTemporalScope(
    date: Date | null,
    temporalScope?: ResultTemporalScope,
  ): boolean {
    if (!temporalScope) {
      return true;
    }
    if (!date) {
      return false;
    }

    const time = date.getTime();
    const start = temporalScope.startAt ? new Date(temporalScope.startAt).getTime() : undefined;
    const end = temporalScope.endAt ? new Date(temporalScope.endAt).getTime() : undefined;
    if (typeof start === 'number' && Number.isFinite(start) && time < start) {
      return false;
    }
    if (typeof end === 'number' && Number.isFinite(end) && time >= end) {
      return false;
    }
    return true;
  }

  /**
   * 收窄结果时间粒度为标准时间槽枚举。
   */
  private normalizeTemporalGranularity(
    granularity: ResultTemporalScope['granularity'],
  ): NonNullable<AnalysisIntent['temporalSlot']>['granularity'] {
    if (['day', 'week', 'month', 'quarter', 'year', 'custom'].includes(String(granularity))) {
      return granularity as NonNullable<AnalysisIntent['temporalSlot']>['granularity'];
    }
    return 'custom';
  }

  /**
   * 判断 SQLite 任意资源记录是否落在当前权限范围内。
   *
   * 参数说明：`record` 为业务 JSON，`scope` 为快照权限范围。
   * 返回值说明：全量权限直接通过；负责人范围需命中负责人候选字段。
   * 调用注意事项：与商机专用权限判断保持一致，缺少可比字段时不扩大权限。
   */
  private isSqliteRecordInsideScope(
    record: Record<string, unknown>,
    scope: WarehouseScopeResolution,
  ): boolean {
    if (scope.mode === 'full') {
      return true;
    }

    if (scope.mode !== 'user' || scope.userIds.length === 0) {
      return false;
    }

    const ownerCandidates = this.uniqueStrings([
      this.readString(record.ownerId),
      this.readString(record.owner_id),
      this.readString(record.ownerUserId),
      this.readString(record.owner_user_id),
      this.readString(record.assignedStaffId),
      this.readString(record.assigned_staff_id),
      this.readString(record.createdBy),
      this.readString(record.created_by),
    ]);
    return ownerCandidates.length > 0 && ownerCandidates.some((item) => scope.userIds.includes(item));
  }

  /**
   * 判断 SQLite 任意资源记录是否命中业务区域过滤。
   *
   * 参数说明：`record` 为业务 JSON，`filter` 为自然语言识别出的区域过滤。
   * 返回值说明：无区域过滤时返回 true；有区域过滤时需命中区域或大区字段。
   * 调用注意事项：区域过滤只是业务收窄，不替代权限控制。
   */
  private isSqliteRecordInsideBusinessRegion(
    record: Record<string, unknown>,
    filter: BusinessRegionFilter,
  ): boolean {
    if (!filter.regions.length && !filter.bigRegions.length) {
      return true;
    }

    const region = this.readString(record.region);
    const bigRegion = this.readString(record.bigRegion ?? record.big_region);
    return Boolean(
      (region && filter.regions.includes(region)) ||
        (bigRegion && filter.bigRegions.includes(bigRegion)),
    );
  }

  /**
   * 判断 SQLite 订单是否计入有效订单。
   *
   * 参数说明：`record` 为订单业务 JSON。
   * 返回值说明：排除取消、作废、驳回、删除等状态；无状态时保守计入快照测试口径。
   * 调用注意事项：联软快照状态枚举可能与 OpenAPI 英文字段不完全一致，因此同时兼容中英文状态。
   */
  private isEffectiveSqliteOrderRecord(record: Record<string, unknown>): boolean {
    const statusText = this.normalizeComparableText(
      record.statusName ?? record.status_name ?? record.status,
    );
    if (!statusText) {
      return true;
    }

    return ![
      'cancelled',
      'canceled',
      'deleted',
      'invalid',
      'rejected',
      'void',
      '作废',
      '取消',
      '已取消',
      '驳回',
      '已驳回',
      '删除',
      '已删除',
    ].includes(statusText);
  }

  /**
   * 解析 SQLite 记录创建时间。
   */
  private resolveSqliteCreatedAt(record: Record<string, unknown>): Date | null {
    return this.parseDateValue(
      record.createdAt ?? record.created_at ?? record.createTime ?? record.create_time,
    );
  }

  /**
   * 解析 SQLite 订单统计时间。
   */
  private resolveSqliteOrderStatisticAt(record: Record<string, unknown>): Date | null {
    return this.parseDateValue(
      record.dealAt ??
        record.deal_at ??
        record.completedAt ??
        record.completed_at ??
        record.confirmedAt ??
        record.confirmed_at,
    ) ?? this.resolveSqliteCreatedAt(record);
  }

  /**
   * 从多个候选字段读取首个非空字符串。
   */
  private readFirstString(record: Record<string, unknown>, fields: string[]): string {
    for (const field of fields) {
      const value = this.readString(record[field]);
      if (value) {
        return value;
      }
    }
    return '';
  }

  /**
   * 从多个候选字段读取首个有效数值。
   */
  private readFirstNumber(record: Record<string, unknown>, fields: string[]): number {
    for (const field of fields) {
      const value = this.readNumber(record[field]);
      if (value !== 0) {
        return value;
      }
    }
    return 0;
  }

  /**
   * 汇总 SQLite 记录的金额候选字段。
   */
  private sumSqliteRecordAmount(
    records: Array<Record<string, unknown>>,
    fields: string[],
  ): number {
    return records.reduce((sum, record) => sum + this.readFirstNumber(record, fields), 0);
  }

  /**
   * 构造 SQLite 渠道商 ID 到名称的映射。
   *
   * 参数说明：`partners` 为已经过权限和时间过滤或全量导入的渠道商主数据。
   * 返回值说明：返回渠道商 ID 对应的中文名称。
   * 调用注意事项：只用于展示名称补齐，不作为权限判断依据。
   */
  private buildSqlitePartnerNameMap(partners: Array<Record<string, unknown>>): Map<string, string> {
    const map = new Map<string, string>();
    for (const partner of partners) {
      const partnerId = this.resolveSqlitePartnerId(partner) || this.readFirstString(partner, ['id']);
      const partnerName = this.readFirstString(partner, [
        'name',
        'partnerName',
        'partner_name',
        'fullName',
        'full_name',
      ]);
      if (partnerId && partnerName) {
        map.set(partnerId, partnerName);
      }
    }
    return map;
  }

  /**
   * 解析 SQLite 记录中的渠道商 ID。
   *
   * 参数说明：`record` 为任意联软业务快照记录。
   * 返回值说明：返回最可信的渠道商 ID，缺失时返回空字符串。
   */
  private resolveSqlitePartnerId(record: Record<string, unknown>): string {
    return this.readFirstString(record, [
      'partnerId',
      'partner_id',
      'assignedPartnerId',
      'assigned_partner_id',
      'parentPartnerId',
      'parent_partner_id',
      'channelPartnerId',
      'channel_partner_id',
    ]);
  }

  /**
   * 解析 SQLite 记录中的渠道商名称。
   *
   * 参数说明：`record` 为任意联软业务快照记录，`partnerNameMap` 为可选主数据名称映射。
   * 返回值说明：优先返回记录自带名称，其次按 ID 从主数据补齐，最后返回“未填写渠道商”。
   */
  private resolveSqlitePartnerName(
    record: Record<string, unknown>,
    partnerNameMap?: Map<string, string>,
  ): string {
    const directName = this.readFirstString(record, [
      'partnerName',
      'partner_name',
      'assignedPartnerName',
      'assigned_partner_name',
      'parentPartnerName',
      'parent_partner_name',
      'channelPartnerName',
      'channel_partner_name',
    ]);
    if (directName) {
      return directName;
    }

    const partnerId = this.resolveSqlitePartnerId(record);
    if (partnerId && partnerNameMap?.has(partnerId)) {
      return partnerNameMap.get(partnerId) ?? '未填写渠道商';
    }

    return partnerId ? `渠道商 ${partnerId}` : '未填写渠道商';
  }

  /**
   * 解析 SQLite 记录中的客户名称。
   *
   * 参数说明：`record` 为任意联软业务快照记录。
   * 返回值说明：返回客户中文名称，缺失时返回空字符串。
   */
  private resolveSqliteCustomerName(record: Record<string, unknown>): string {
    return this.readFirstString(record, [
      'customerName',
      'customer_name',
      'customer',
      'finalCustomer',
      'final_customer',
      'endCustomerName',
      'end_customer_name',
    ]);
  }

  /**
   * 按商机阶段聚合 SQLite 商机。
   *
   * 参数说明：`opportunities` 为已完成权限、区域和时间过滤的商机记录。
   * 返回值说明：返回阶段、数量和金额列表。
   * 调用注意事项：阶段缺失时归入“未填写阶段”，避免图表空标签。
   */
  private buildSqliteOpportunityStageRows(
    opportunities: Array<Record<string, unknown>>,
  ): Array<Record<string, unknown>> {
    const stageMap = new Map<string, { count: number; amount: number }>();
    for (const opportunity of opportunities) {
      const stageName =
        formatOpportunityStageLabel(
          this.readFirstString(opportunity, ['stageName', 'stage_name', 'stage', 'statusName', 'status_name', 'status']),
        ) ||
        '未填写阶段';
      const current = stageMap.get(stageName) ?? { count: 0, amount: 0 };
      current.count += 1;
      current.amount += this.readFirstNumber(opportunity, [
        'amount',
        'opportunityAmount',
        'opportunity_amount',
        'expectAmount',
        'expect_amount',
      ]);
      stageMap.set(stageName, current);
    }

    return [...stageMap.entries()]
      .map(([stageName, item]) => ({
        stage_name: stageName,
        opportunity_count: item.count,
        opportunity_amount: item.amount,
      }))
      .sort((left, right) =>
        Number(right.opportunity_amount) - Number(left.opportunity_amount) ||
        Number(right.opportunity_count) - Number(left.opportunity_count),
      );
  }

  /**
   * 按渠道商聚合 SQLite 商机。
   *
   * 参数说明：`opportunities` 为已过滤商机记录，`partnerNameMap` 为渠道商名称补齐映射。
   * 返回值说明：返回渠道商商机数量、商机金额和涉及客户数。
   */
  private buildSqliteOpportunityPartnerRows(
    opportunities: Array<Record<string, unknown>>,
    partnerNameMap: Map<string, string>,
  ): Array<Record<string, unknown>> {
    const partnerMap = new Map<string, {
      partnerName: string;
      opportunityCount: number;
      opportunityAmount: number;
      customerKeys: Set<string>;
    }>();
    for (const opportunity of opportunities) {
      const partnerId = this.resolveSqlitePartnerId(opportunity) || 'unknown-partner';
      const current = partnerMap.get(partnerId) ?? {
        partnerName: this.resolveSqlitePartnerName(opportunity, partnerNameMap),
        opportunityCount: 0,
        opportunityAmount: 0,
        customerKeys: new Set<string>(),
      };
      current.opportunityCount += 1;
      current.opportunityAmount += this.readFirstNumber(opportunity, [
        'amount',
        'opportunityAmount',
        'opportunity_amount',
        'expectAmount',
        'expect_amount',
      ]);
      const customerKey = this.readFirstString(opportunity, [
        'customerId',
        'customer_id',
        'customerName',
        'customer_name',
        'customer',
      ]);
      if (customerKey) {
        current.customerKeys.add(customerKey);
      }
      partnerMap.set(partnerId, current);
    }

    return [...partnerMap.entries()]
      .map(([partnerId, item]) => ({
        partner_id: partnerId === 'unknown-partner' ? '' : partnerId,
        partner_name: item.partnerName,
        opportunity_count: item.opportunityCount,
        opportunity_amount: item.opportunityAmount,
        customer_count: item.customerKeys.size,
      }))
      .sort((left, right) =>
        Number(right.opportunity_amount) - Number(left.opportunity_amount) ||
        Number(right.opportunity_count) - Number(left.opportunity_count),
      );
  }

  /**
   * 构造 SQLite 重点商机明细。
   *
   * 参数说明：`opportunities` 为已过滤商机记录，`partnerNameMap` 为渠道商名称补齐映射。
   * 返回值说明：按金额倒序返回最多 100 条商机明细。
   */
  private buildSqliteOpportunityDetailRows(
    opportunities: Array<Record<string, unknown>>,
    partnerNameMap: Map<string, string>,
  ): Array<Record<string, unknown>> {
    return opportunities
      .map((opportunity) => ({
        opportunity_id: this.readFirstString(opportunity, ['id', 'opportunityId', 'opportunity_id']),
        opportunity_name:
          this.readFirstString(opportunity, ['name', 'opportunityName', 'opportunity_name', 'title']) ||
          '未命名商机',
        customer_name: this.resolveSqliteCustomerName(opportunity),
        partner_id: this.resolveSqlitePartnerId(opportunity),
        partner_name: this.resolveSqlitePartnerName(opportunity, partnerNameMap),
        owner_name: this.readFirstString(opportunity, ['ownerName', 'owner_name', 'owner', 'assignedStaffName', 'assigned_staff_name']),
        stage_name: formatOpportunityStageLabel(
          this.readFirstString(opportunity, ['stageName', 'stage_name', 'stage', 'statusName', 'status_name', 'status']),
        ),
        region: this.readFirstString(opportunity, ['region']),
        big_region: this.readFirstString(opportunity, ['bigRegion', 'big_region']),
        amount: this.readFirstNumber(opportunity, ['amount', 'opportunityAmount', 'opportunity_amount', 'expectAmount', 'expect_amount']),
        created_at: this.resolveSqliteCreatedAt(opportunity)?.toISOString() ?? '',
      }))
      .sort((left, right) => Number(right.amount) - Number(left.amount))
      .slice(0, 100);
  }

  /**
   * 按渠道商聚合客户报备、商机和订单经营链路。
   *
   * 参数说明：`partners/registrations/opportunities/orders` 为已过滤后的快照记录。
   * 返回值说明：返回每个渠道商的报备、商机、订单和转化指标。
   */
  private buildSqlitePartnerBusinessChainRows(params: {
    partners: Array<Record<string, unknown>>;
    registrations: Array<Record<string, unknown>>;
    opportunities: Array<Record<string, unknown>>;
    orders: Array<Record<string, unknown>>;
  }): Array<Record<string, unknown>> {
    const partnerNameMap = this.buildSqlitePartnerNameMap(params.partners);
    const rowMap = new Map<string, {
      partnerName: string;
      registrationCount: number;
      opportunityCount: number;
      opportunityAmount: number;
      orderCount: number;
      orderAmount: number;
    }>();
    const ensureRow = (record: Record<string, unknown>, allowOwnId = false): {
      partnerName: string;
      registrationCount: number;
      opportunityCount: number;
      opportunityAmount: number;
      orderCount: number;
      orderAmount: number;
    } => {
      const partnerId =
        this.resolveSqlitePartnerId(record) ||
        (allowOwnId ? this.readFirstString(record, ['id']) : '') ||
        'unknown-partner';
      const current = rowMap.get(partnerId) ?? {
        partnerName: partnerNameMap.get(partnerId) ?? this.resolveSqlitePartnerName(record, partnerNameMap),
        registrationCount: 0,
        opportunityCount: 0,
        opportunityAmount: 0,
        orderCount: 0,
        orderAmount: 0,
      };
      rowMap.set(partnerId, current);
      return current;
    };

    for (const partner of params.partners) {
      ensureRow(partner, true);
    }
    for (const registration of params.registrations) {
      ensureRow(registration).registrationCount += 1;
    }
    for (const opportunity of params.opportunities) {
      const row = ensureRow(opportunity);
      row.opportunityCount += 1;
      row.opportunityAmount += this.readFirstNumber(opportunity, ['amount', 'opportunityAmount', 'opportunity_amount', 'expectAmount', 'expect_amount']);
    }
    for (const order of params.orders) {
      const row = ensureRow(order);
      row.orderCount += 1;
      row.orderAmount += this.readFirstNumber(order, ['amount', 'orderAmount', 'order_amount', 'totalAmount', 'total_amount']);
    }

    return [...rowMap.entries()]
      .map(([partnerId, item]) => ({
        partner_id: partnerId === 'unknown-partner' ? '' : partnerId,
        partner_name: item.partnerName,
        registration_count: item.registrationCount,
        opportunity_count: item.opportunityCount,
        opportunity_amount: item.opportunityAmount,
        order_count: item.orderCount,
        order_amount: item.orderAmount,
        opportunity_to_order_rate: this.formatPercent(item.orderCount, item.opportunityCount),
      }))
      .sort((left, right) =>
        Number(right.order_amount) - Number(left.order_amount) ||
        Number(right.opportunity_amount) - Number(left.opportunity_amount) ||
        Number(right.registration_count) - Number(left.registration_count),
      );
  }

  /**
   * 按渠道商聚合客户报备及关联商机情况。
   *
   * 参数说明：`registrations` 为已过滤报备，`opportunities` 为同权限范围内商机。
   * 返回值说明：返回渠道商报备数量、已关联商机报备数和未关联商机报备数。
   */
  private buildSqliteRegistrationPartnerRows(
    registrations: Array<Record<string, unknown>>,
    opportunities: Array<Record<string, unknown>>,
    partnerNameMap: Map<string, string>,
  ): Array<Record<string, unknown>> {
    const rowMap = new Map<string, {
      partnerName: string;
      registrationCount: number;
      linkedCount: number;
      unlinkedCount: number;
    }>();
    for (const registration of registrations) {
      const partnerId = this.resolveSqlitePartnerId(registration) || 'unknown-partner';
      const current = rowMap.get(partnerId) ?? {
        partnerName: this.resolveSqlitePartnerName(registration, partnerNameMap),
        registrationCount: 0,
        linkedCount: 0,
        unlinkedCount: 0,
      };
      current.registrationCount += 1;
      if (this.isSqliteRegistrationLinkedToOpportunity(registration, opportunities)) {
        current.linkedCount += 1;
      } else {
        current.unlinkedCount += 1;
      }
      rowMap.set(partnerId, current);
    }

    return [...rowMap.entries()]
      .map(([partnerId, item]) => ({
        partner_id: partnerId === 'unknown-partner' ? '' : partnerId,
        partner_name: item.partnerName,
        registration_count: item.registrationCount,
        linked_opportunity_count: item.linkedCount,
        unlinked_registration_count: item.unlinkedCount,
        registration_to_opportunity_rate: this.formatPercent(item.linkedCount, item.registrationCount),
      }))
      .sort((left, right) =>
        Number(right.registration_count) - Number(left.registration_count) ||
        Number(right.linked_opportunity_count) - Number(left.linked_opportunity_count),
      );
  }

  /**
   * 构造客户报备明细并标识是否已关联商机。
   *
   * 参数说明：`registrations` 为已过滤报备，`opportunities` 为同权限范围内商机。
   * 返回值说明：返回最多 100 条客户报备明细。
   */
  private buildSqliteRegistrationDetailRows(
    registrations: Array<Record<string, unknown>>,
    opportunities: Array<Record<string, unknown>>,
    partnerNameMap: Map<string, string>,
  ): Array<Record<string, unknown>> {
    return registrations
      .map((registration) => ({
        registration_id: this.readFirstString(registration, ['id', 'registrationId', 'registration_id']),
        customer_id: this.readFirstString(registration, ['customerId', 'customer_id']),
        customer_name: this.resolveSqliteCustomerName(registration),
        partner_id: this.resolveSqlitePartnerId(registration),
        partner_name: this.resolveSqlitePartnerName(registration, partnerNameMap),
        status_name: this.readFirstString(registration, ['statusName', 'status_name', 'status']),
        region: this.readFirstString(registration, ['region']),
        big_region: this.readFirstString(registration, ['bigRegion', 'big_region']),
        linked_opportunity_count: this.isSqliteRegistrationLinkedToOpportunity(registration, opportunities) ? 1 : 0,
        created_at: this.resolveSqliteCreatedAt(registration)?.toISOString() ?? '',
      }))
      .sort((left, right) =>
        Number(right.linked_opportunity_count) - Number(left.linked_opportunity_count) ||
        String(left.created_at ?? '').localeCompare(String(right.created_at ?? ''), 'zh-Hans-CN'),
      )
      .slice(0, 100);
  }

  /**
   * 判断客户报备是否已关联商机。
   *
   * 参数说明：`registration` 为报备记录，`opportunities` 为同权限范围内商机记录。
   * 返回值说明：报备 ID 或客户 ID 命中商机时返回 `true`。
   */
  private isSqliteRegistrationLinkedToOpportunity(
    registration: Record<string, unknown>,
    opportunities: Array<Record<string, unknown>>,
  ): boolean {
    const registrationId = this.readFirstString(registration, ['id', 'registrationId', 'registration_id']);
    const customerId = this.readFirstString(registration, ['customerId', 'customer_id']);
    return opportunities.some((opportunity) => {
      const opportunityRegistrationId = this.readFirstString(opportunity, ['registrationId', 'registration_id']);
      const opportunityCustomerId = this.readFirstString(opportunity, ['customerId', 'customer_id']);
      return Boolean(
        (registrationId && opportunityRegistrationId === registrationId) ||
          (customerId && opportunityCustomerId === customerId),
      );
    });
  }

  /**
   * 按渠道商聚合 SQLite 有效订单。
   *
   * 参数说明：`orders` 为已过滤有效订单，`partnerNameMap` 为渠道商名称补齐映射。
   * 返回值说明：返回渠道商订单数量、订单金额和涉及客户数。
   */
  private buildSqliteOrderPartnerRows(
    orders: Array<Record<string, unknown>>,
    partnerNameMap: Map<string, string>,
  ): Array<Record<string, unknown>> {
    const rowMap = new Map<string, {
      partnerName: string;
      orderCount: number;
      orderAmount: number;
      customerKeys: Set<string>;
    }>();
    for (const order of orders) {
      const partnerId = this.resolveSqlitePartnerId(order) || 'unknown-partner';
      const current = rowMap.get(partnerId) ?? {
        partnerName: this.resolveSqlitePartnerName(order, partnerNameMap),
        orderCount: 0,
        orderAmount: 0,
        customerKeys: new Set<string>(),
      };
      current.orderCount += 1;
      current.orderAmount += this.readFirstNumber(order, ['amount', 'orderAmount', 'order_amount', 'totalAmount', 'total_amount']);
      const customerKey = this.readFirstString(order, [
        'customerId',
        'customer_id',
        'customerName',
        'customer_name',
        'customer',
      ]);
      if (customerKey) {
        current.customerKeys.add(customerKey);
      }
      rowMap.set(partnerId, current);
    }

    return [...rowMap.entries()]
      .map(([partnerId, item]) => ({
        partner_id: partnerId === 'unknown-partner' ? '' : partnerId,
        partner_name: item.partnerName,
        order_count: item.orderCount,
        order_amount: item.orderAmount,
        customer_count: item.customerKeys.size,
      }))
      .sort((left, right) =>
        Number(right.order_amount) - Number(left.order_amount) ||
        Number(right.order_count) - Number(left.order_count),
      );
  }

  /**
   * 构造 SQLite 订单明细。
   *
   * 参数说明：`orders` 为已过滤有效订单，`partnerNameMap` 为渠道商名称补齐映射。
   * 返回值说明：按金额倒序返回最多 100 条订单明细。
   */
  private buildSqliteOrderDetailRows(
    orders: Array<Record<string, unknown>>,
    partnerNameMap: Map<string, string>,
  ): Array<Record<string, unknown>> {
    return orders
      .map((order) => ({
        order_id: this.readFirstString(order, ['id', 'orderId', 'order_id']),
        customer_name: this.resolveSqliteCustomerName(order),
        partner_id: this.resolveSqlitePartnerId(order),
        partner_name: this.resolveSqlitePartnerName(order, partnerNameMap),
        status_name: this.readFirstString(order, ['statusName', 'status_name', 'status']),
        region: this.readFirstString(order, ['region']),
        big_region: this.readFirstString(order, ['bigRegion', 'big_region']),
        order_amount: this.readFirstNumber(order, ['amount', 'orderAmount', 'order_amount', 'totalAmount', 'total_amount']),
        deal_at: this.resolveSqliteOrderStatisticAt(order)?.toISOString() ?? '',
      }))
      .sort((left, right) => Number(right.order_amount) - Number(left.order_amount))
      .slice(0, 100);
  }

  /**
   * 解析 SQLite 快照查询可用的本地权限范围。
   *
   * 参数说明：`user` 为当前用户，`scopeSnapshot` 为现有鉴权链路产出的权限快照。
   * 返回值说明：全量权限返回 full；普通用户返回负责人范围；缺少可比字段时返回不可用。
   * 调用注意事项：SQLite 快照测试阶段没有权限桥表时只能使用会话权限，不能推断扩大到区域或服务商范围。
   */
  private resolveSqliteSnapshotScope(
    user: CrmUser,
    scopeSnapshot: ScopeSnapshot,
  ): WarehouseScopeResolution {
    if (user.isAdmin || scopeSnapshot.isFullAccess === true) {
      return {
        canUseWarehouse: true,
        mode: 'full',
        regions: [],
        bigRegions: [],
        partnerIds: [],
        userIds: [],
        summary: scopeSnapshot.scopeSummary || '全部数据范围',
      };
    }

    const userIds = this.uniqueStrings([
      ...(scopeSnapshot.ownerIds ?? []),
      ...(scopeSnapshot.defaultOwnerIds ?? []),
      ...(user.ownerIds ?? []),
      user.id,
    ]);
    if (userIds.length === 0) {
      return {
        canUseWarehouse: false,
        mode: 'user',
        regions: [],
        bigRegions: [],
        partnerIds: [],
        userIds: [],
        summary: scopeSnapshot.scopeSummary,
        fallbackReason: 'SQLite 快照阶段缺少可比对的负责人范围。',
      };
    }

    return {
      canUseWarehouse: true,
      mode: 'user',
      regions: [],
      bigRegions: [],
      partnerIds: [],
      userIds,
      summary: scopeSnapshot.scopeSummary || `联软 CRM 负责人权限：${userIds.length} 人`,
    };
  }

  /**
   * 判断 SQLite 商机记录是否落在当前权限范围内。
   *
   * 参数说明：`record` 为快照商机记录，`scope` 为本地解析出的权限范围。
   * 返回值说明：全量权限直接通过；负责人范围必须命中记录中的负责人候选字段。
   * 调用注意事项：记录没有可比负责人字段时保守返回 false，避免测试快照越权展示。
   */
  private isSqliteOpportunityInsideScope(
    record: Record<string, unknown>,
    scope: WarehouseScopeResolution,
  ): boolean {
    if (scope.mode === 'full') {
      return true;
    }

    if (scope.mode !== 'user' || scope.userIds.length === 0) {
      return false;
    }

    const ownerCandidates = this.uniqueStrings([
      this.readString(record.ownerId),
      this.readString(record.owner_id),
      this.readString(record.ownerUserId),
      this.readString(record.owner_user_id),
      this.readString(record.assignedStaffId),
      this.readString(record.assigned_staff_id),
      this.readString(record.createdBy),
      this.readString(record.created_by),
    ]);
    return ownerCandidates.length > 0 && ownerCandidates.some((item) => scope.userIds.includes(item));
  }

  /**
   * 判断 SQLite 商机记录是否命中用户显式提到的业务区域。
   *
   * 参数说明：`record` 为快照商机记录，`filter` 为自然语言问题中识别出的业务区域。
   * 返回值说明：没有显式区域过滤时返回 true；有过滤时必须命中区域或大区字段。
   * 调用注意事项：业务区域过滤不能替代权限过滤，只作为结果收窄条件。
   */
  private isSqliteOpportunityInsideBusinessRegion(
    record: Record<string, unknown>,
    filter: BusinessRegionFilter,
  ): boolean {
    if (!filter.regions.length && !filter.bigRegions.length) {
      return true;
    }

    const region = this.readString(record.region);
    const bigRegion = this.readString(record.bigRegion ?? record.big_region);
    return Boolean(
      (region && filter.regions.includes(region)) ||
        (bigRegion && filter.bigRegions.includes(bigRegion)),
    );
  }

  /**
   * 判断 SQLite 商机是否属于有效商机池。
   *
   * 参数说明：`record` 为快照商机记录。
   * 返回值说明：排除审批中、输单、项目取消、赢单、删除等不应纳入停滞风险池的商机。
   * 调用注意事项：这里复用标准 OpenAPI 兜底的业务口径，保证两个数据源结果可解释。
   */
  private isEffectiveSqliteOpportunityRecord(record: Record<string, unknown>): boolean {
    const pendingStep = this.readNumber(record.pendingStep ?? record.pending_step);
    if (pendingStep > 0) {
      return false;
    }

    const submitApplyingAt = this.readString(record.submitApplyingAt ?? record.submit_applying_at);
    const finishApproveAt = this.readString(record.finishApproveAt ?? record.finish_approve_at);
    if (submitApplyingAt && !finishApproveAt) {
      return false;
    }

    const stageText = this.normalizeComparableText(
      record.stageName ?? record.stage ?? record.statusName ?? record.status,
    );
    if (!stageText) {
      return true;
    }

    return ![
      '输单',
      '输单项目取消',
      '项目取消',
      '1%已联系上客户',
      '已联系上客户',
      '赢单',
      'won',
      'lost',
      'completed',
      'cancelled',
      'canceled',
      'closed',
      'deleted',
      'invalid',
    ].includes(stageText);
  }

  /**
   * 构造 SQLite 停滞商机明细行。
   *
   * 参数说明：`record` 为快照商机记录，`thresholdDays` 为停滞天数阈值。
   * 返回值说明：超过阈值时返回展示行；未超过或缺少进展时间时返回 `null`。
   * 调用注意事项：停滞天数只基于业务更新时间候选字段，不使用用户问题里的时间范围去过滤创建时间。
   */
  private buildSqliteStaleOpportunityRow(
    record: Record<string, unknown>,
    thresholdDays: number,
  ): Record<string, unknown> | null {
    const sourceUpdatedAt = this.resolveSqliteProgressUpdatedAt(record);
    if (!sourceUpdatedAt) {
      return null;
    }

    const staleDays = this.calculateElapsedDays(sourceUpdatedAt);
    if (staleDays <= thresholdDays) {
      return null;
    }

    const opportunityId = this.readString(record.id ?? record.opportunityId ?? record.opportunity_id);
    const opportunityName =
      this.readString(record.name ?? record.opportunityName ?? record.opportunity_name ?? record.title) ||
      opportunityId ||
      '未命名商机';

    return {
      opportunity_id: opportunityId,
      opportunity_name: opportunityName,
      customer_name: this.readString(record.customerName ?? record.customer ?? record.customer_name),
      partner_name: this.readString(
        record.partnerName ?? record.partner_name ?? record.assignedPartnerName ?? record.assigned_partner_name,
      ),
      owner_name: this.readString(record.ownerName ?? record.owner_name ?? record.owner),
      stage_name: formatOpportunityStageLabel(
        this.readString(record.stageName ?? record.stage ?? record.statusName ?? record.status),
      ),
      region: this.readString(record.region),
      big_region: this.readString(record.bigRegion ?? record.big_region),
      amount: this.readNumber(record.amount ?? record.opportunityAmount ?? record.opportunity_amount),
      source_updated_at: sourceUpdatedAt.toISOString(),
      stale_days: staleDays,
    };
  }

  /**
   * 解析 SQLite 商机的进展更新时间。
   *
   * 参数说明：`record` 为快照商机记录。
   * 返回值说明：返回可解析的最近业务更新时间；没有可用字段时返回 `null`。
   * 调用注意事项：字段优先级覆盖联软快照和分析库常见命名，并兼容状态流转历史的最近变更时间。
   */
  private resolveSqliteProgressUpdatedAt(record: Record<string, unknown>): Date | null {
    const candidates = [
      record.sourceUpdatedAt,
      record.source_updated_at,
      record.latestFollowUpAt,
      record.latest_follow_up_at,
      record.lastProgressAt,
      record.last_progress_at,
      record.progressUpdatedAt,
      record.progress_updated_at,
      record.updatedAt,
      record.updated_at,
      record.updateTime,
    ];
    for (const candidate of candidates) {
      const parsedDate = this.parseDateValue(candidate);
      if (parsedDate) {
        return parsedDate;
      }
    }

    if (Array.isArray(record.statusHistory)) {
      const historyDates = record.statusHistory
        .map((item) =>
          typeof item === 'object' && item
            ? this.parseDateValue((item as Record<string, unknown>).changedAt)
            : null,
        )
        .filter((item): item is Date => Boolean(item))
        .sort((left, right) => right.getTime() - left.getTime());
      return historyDates[0] ?? null;
    }

    return null;
  }

  /**
   * 计算某个时间距离今天的整天数。
   *
   * 参数说明：`date` 为业务更新时间。
   * 返回值说明：返回非负整数天数。
   * 调用注意事项：使用本地运行日期作为测试快照分析基准，和 MySQL `CURRENT_DATE()` 口径保持一致。
   */
  private calculateElapsedDays(date: Date): number {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    return Math.max(0, Math.floor((todayStart - dateStart) / 86_400_000));
  }

  /**
   * 解析日期字段。
   *
   * 参数说明：`value` 为可能的 ISO 字符串、时间戳或 Date。
   * 返回值说明：成功时返回 Date，失败时返回 `null`。
   * 调用注意事项：无法解析的业务字段不参与停滞天数计算，避免产生虚假超期结果。
   */
  private parseDateValue(value: unknown): Date | null {
    if (value instanceof Date && Number.isFinite(value.getTime())) {
      return value;
    }

    if (typeof value !== 'string' && typeof value !== 'number') {
      return null;
    }

    const parsedDate = new Date(value);
    return Number.isFinite(parsedDate.getTime()) ? parsedDate : null;
  }

  /**
   * 解析分析库执行所需的行级权限范围。
   *
   * 参数说明：`user` 为当前登录用户，`scopeSnapshot` 为现有组织范围快照。
   * 返回值说明：返回全量、区域、服务商、负责人或混合范围；无法安全识别时返回不可用状态。
   * 调用注意事项：该方法把登录会话、企业微信范围和联软权限桥表合并；任何异常都按保守降级处理。
   */
  private async resolveWarehouseScope(
    user: CrmUser,
    scopeSnapshot: ScopeSnapshot,
  ): Promise<WarehouseScopeResolution> {
    let hint: AnalysisWarehouseUserScopeHint | null = null;
    try {
      hint = await this.analysisWarehouseMysqlService.getUserScopeHint({
        userId: user.id,
        username: user.id,
        wecomUserid: user.wecomSenderId,
      });
    } catch (error) {
      this.analysisLoggerService.logWarn('读取分析库用户权限提示失败，已仅使用会话权限快照。', {
        userId: user.id,
        reason: error instanceof Error ? error.message : 'unknown',
      });
    }

    const hintedFullAccess = this.isFullAccessHint(hint);
    if (user.isAdmin || scopeSnapshot.isFullAccess === true || hintedFullAccess) {
      return {
        canUseWarehouse: true,
        mode: 'full',
        regions: [],
        bigRegions: [],
        partnerIds: [],
        userIds: [],
        summary: scopeSnapshot.scopeSummary || '全部数据范围',
        hint,
      };
    }

    const regions = this.uniqueStrings([
      ...((this.normalizeScopeMode(hint?.permissionScopeType) === 'region'
        ? hint?.permissionRegions
        : []) ?? []),
      ...(hint?.permissionRegions?.length ? hint.permissionRegions : []),
      ...(this.shouldUseUserRegionAsScope(hint) ? [hint?.region] : []),
    ]);
    const bigRegions = this.uniqueStrings([
      ...(hint?.permissionBigRegions ?? []),
      hint?.bigRegion,
    ]);
    const partnerIds = this.uniqueStrings([
      ...(hint?.permissionPartnerIds ?? []),
      ...(hint?.partnerId ? [hint.partnerId] : []),
    ]);
    const userIds = this.uniqueStrings([
      ...(hint?.permissionUserIds ?? []),
      ...(hint?.permissionOwnerIds ?? []),
      ...(hint?.permissionManagedUserIds ?? []),
      ...(scopeSnapshot.ownerIds ?? []),
      ...(scopeSnapshot.defaultOwnerIds ?? []),
      ...(user.ownerIds ?? []),
      hint?.userId,
      user.id,
    ]);
    const mode = this.resolveWarehouseScopeMode({
      hint,
      regions,
      partnerIds,
      userIds,
    });

    if (mode === 'region' && regions.length === 0 && bigRegions.length === 0) {
      return {
        canUseWarehouse: false,
        mode,
        regions,
        bigRegions,
        partnerIds,
        userIds,
        summary: scopeSnapshot.scopeSummary,
        hint,
        fallbackReason: '区域角色缺少可注入的区域字段。',
      };
    }

    if (mode === 'partner' && partnerIds.length === 0) {
      return {
        canUseWarehouse: false,
        mode,
        regions,
        bigRegions,
        partnerIds,
        userIds,
        summary: scopeSnapshot.scopeSummary,
        hint,
        fallbackReason: '渠道角色缺少可注入的服务商 ID。',
      };
    }

    if (mode === 'user' && userIds.length === 0) {
      return {
        canUseWarehouse: false,
        mode,
        regions,
        bigRegions,
        partnerIds,
        userIds,
        summary: scopeSnapshot.scopeSummary,
        hint,
        fallbackReason: '个人角色缺少可注入的负责人 ID。',
      };
    }

    return {
      canUseWarehouse: true,
      mode,
      regions,
      bigRegions,
      partnerIds,
      userIds,
      summary: this.buildWarehouseScopeSummary(mode, {
        scopeSnapshot,
        regions,
        bigRegions,
        partnerIds,
        userIds,
        hint,
      }),
      hint,
    };
  }

  /**
   * 判断联软权限桥表是否声明全量权限。
   *
   * 参数说明：`hint` 为分析库用户权限提示。
   * 返回值说明：权限桥表或角色编码明确全量时返回 `true`。
   * 调用注意事项：该判断用于兼容真实 CRM 角色返回；如会话侧已不是管理员但联软侧声明全量，则以联软角色为准。
   */
  private isFullAccessHint(hint?: AnalysisWarehouseUserScopeHint | null): boolean {
    const scopeType = String(hint?.permissionScopeType ?? '').toLowerCase();
    const roleCode = String(hint?.roleCode ?? '').toLowerCase();
    return (
      ['all', 'full', 'global', 'superadmin'].includes(scopeType) ||
      roleCode.includes('superadmin')
    );
  }

  /**
   * 根据桥表和用户维度判断是否可以把用户区域作为默认区域范围。
   *
   * 参数说明：`hint` 为分析库用户权限提示。
   * 返回值说明：区域管理员等角色存在区域字段时返回 `true`。
   * 调用注意事项：渠道账号即使带区域也优先走服务商范围，避免误扩到整个区域。
   */
  private shouldUseUserRegionAsScope(hint?: AnalysisWarehouseUserScopeHint | null): boolean {
    if (!hint?.region || hint.partnerId) {
      return false;
    }

    const mode = this.normalizeScopeMode(hint.permissionScopeType);
    const roleCode = String(hint.roleCode ?? '').toLowerCase();
    return mode === 'region' || roleCode.includes('admin') || roleCode.includes('manager');
  }

  /**
   * 归一化联软权限范围类型。
   *
   * 参数说明：`scopeType` 为联软权限桥表返回的范围编码。
   * 返回值说明：返回分析库内部使用的范围类型；无法识别时返回 `undefined`。
   * 调用注意事项：这里兼容中英文和常见缩写，避免对方编码轻微变化导致全部降级。
   */
  private normalizeScopeMode(scopeType?: string): WarehouseScopeMode | undefined {
    const normalized = String(scopeType ?? '').toLowerCase();
    if (!normalized) {
      return undefined;
    }

    if (['all', 'full', 'global', 'superadmin'].includes(normalized)) {
      return 'full';
    }
    if (/region|area|区域|大区/u.test(normalized)) {
      return 'region';
    }
    if (/partner|channel|dealer|服务商|渠道/u.test(normalized)) {
      return 'partner';
    }
    if (/user|owner|staff|self|person|个人|本人|员工/u.test(normalized)) {
      return 'user';
    }
    return undefined;
  }

  /**
   * 决定当前用户的分析库行级范围模式。
   *
   * 参数说明：包含权限提示和已提取的区域、服务商、用户范围。
   * 返回值说明：优先采用桥表显式范围，其次按可用字段推断。
   * 调用注意事项：推断顺序采用区域、服务商、个人，避免把个人账号误当全量。
   */
  private resolveWarehouseScopeMode(params: {
    hint?: AnalysisWarehouseUserScopeHint | null;
    regions: string[];
    partnerIds: string[];
    userIds: string[];
  }): WarehouseScopeMode {
    const explicitMode = this.normalizeScopeMode(params.hint?.permissionScopeType);
    if (explicitMode && explicitMode !== 'full') {
      return explicitMode;
    }

    if (params.regions.length > 0) {
      return 'region';
    }
    if (params.partnerIds.length > 0) {
      return 'partner';
    }
    if (params.userIds.length > 0) {
      return 'user';
    }
    return 'user';
  }

  /**
   * 构造分析库权限范围展示摘要。
   *
   * 参数说明：`mode` 为范围模式，其余参数为已解析范围值。
   * 返回值说明：返回用于报告筛选条件和审计提示的中文摘要。
   * 调用注意事项：摘要只展示范围口径，不泄露 token、client secret 或数据库连接信息。
   */
  private buildWarehouseScopeSummary(
    mode: WarehouseScopeMode,
    params: {
      scopeSnapshot: ScopeSnapshot;
      regions: string[];
      bigRegions: string[];
      partnerIds: string[];
      userIds: string[];
      hint?: AnalysisWarehouseUserScopeHint | null;
    },
  ): string {
    if (mode === 'full') {
      return params.scopeSnapshot.scopeSummary || '全部数据范围';
    }
    if (mode === 'region') {
      return `联软 CRM 区域权限：${[...params.regions, ...params.bigRegions].join('、')}`;
    }
    if (mode === 'partner') {
      return params.hint?.partnerName
        ? `联软 CRM 服务商权限：${params.hint.partnerName}`
        : `联软 CRM 服务商权限：${params.partnerIds.join('、')}`;
    }
    if (mode === 'mixed') {
      return `联软 CRM 混合权限：区域 ${params.regions.join('、') || '无'}，服务商 ${params.partnerIds.join('、') || '无'}，负责人 ${params.userIds.length} 人`;
    }
    return params.scopeSnapshot.scopeSummary || `联软 CRM 负责人权限：${params.userIds.length} 人`;
  }

  /**
   * 为指定表别名构造行级范围条件。
   *
   * 参数说明：`tableName` 为分析库表名，`alias` 为 SQL 中的表别名，`scope` 为权限范围。
   * 返回值说明：全量权限返回空条件；非全量权限返回 SQL 条件和参数；无法注入时返回 `null`。
   * 调用注意事项：只使用语义层白名单字段，条件本身仍会再次经过 SQL Guard 校验。
   */
  private buildScopePredicateForAlias(
    tableName: string,
    alias: string,
    scope: WarehouseScopeResolution,
  ): WarehouseScopePredicate | null {
    if (scope.mode === 'full') {
      return { sql: '', params: [] };
    }

    const fields = ROW_SCOPE_FIELDS[tableName];
    if (!fields || !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(alias)) {
      return null;
    }

    const groups: WarehouseScopePredicate[] = [];
    const pushGroup = (fieldNames: string[] | undefined, values: string[]): void => {
      if (!fieldNames?.length || values.length === 0) {
        return;
      }

      const predicates = fieldNames.map((fieldName) =>
        this.buildInPredicate(`${alias}.${fieldName}`, values),
      );
      groups.push({
        sql: predicates.map((item) => item.sql).join(' OR '),
        params: predicates.flatMap((item) => item.params),
      });
    };

    if (scope.mode === 'region') {
      pushGroup(fields.regions, scope.regions);
      pushGroup(fields.bigRegions, scope.bigRegions);
    } else if (scope.mode === 'partner') {
      pushGroup(fields.partnerIds, scope.partnerIds);
    } else if (scope.mode === 'user') {
      pushGroup(fields.userIds, scope.userIds);
    } else {
      pushGroup(fields.regions, scope.regions);
      pushGroup(fields.bigRegions, scope.bigRegions);
      pushGroup(fields.partnerIds, scope.partnerIds);
      pushGroup(fields.userIds, scope.userIds);
    }

    if (groups.length === 0) {
      return null;
    }

    return {
      sql: groups.map((item) => `(${item.sql})`).join(' OR '),
      params: groups.flatMap((item) => item.params),
    };
  }

  /**
   * 从用户问题中提取明确的业务区域过滤。
   *
   * 参数说明：`questionText` 为用户自然语言问题。
   * 返回值说明：当前只返回已确认的区域/大区标准值；没有明确区域时返回空过滤。
   * 调用注意事项：这是业务过滤，不是权限过滤；权限仍由 `buildScopePredicateForAlias` 强制注入。
   */
  private resolveBusinessRegionFilter(questionText: string): BusinessRegionFilter {
    const regions: string[] = [];
    const bigRegions: string[] = [];

    if (/山东|山东区|山东区域/u.test(questionText)) {
      regions.push('山东区');
    }

    if (/大北|大北区/u.test(questionText)) {
      bigRegions.push('大北区');
    }

    const uniqueRegions = this.uniqueStrings(regions);
    const uniqueBigRegions = this.uniqueStrings(bigRegions);
    return {
      regions: uniqueRegions,
      bigRegions: uniqueBigRegions,
      summary: [...uniqueRegions, ...uniqueBigRegions].length
        ? [...uniqueRegions, ...uniqueBigRegions].join('、')
        : undefined,
    };
  }

  /**
   * 为指定表别名构造业务区域过滤条件。
   *
   * 参数说明：`tableName/alias` 指向固定模板中的业务表，`filter` 为已标准化的区域过滤。
   * 返回值说明：没有业务区域过滤时返回空条件；字段不可用时返回空条件交由权限范围兜底。
   * 调用注意事项：只使用 `ROW_SCOPE_FIELDS` 中登记的 `region/big_region` 字段，不接受用户输入字段名。
   */
  private buildBusinessRegionPredicateForAlias(
    tableName: string,
    alias: string,
    filter?: BusinessRegionFilter,
  ): WarehouseScopePredicate {
    if ((!filter?.regions.length && !filter?.bigRegions.length) || !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(alias)) {
      return { sql: '', params: [] };
    }

    const fields = ROW_SCOPE_FIELDS[tableName];
    if (!fields) {
      return { sql: '', params: [] };
    }

    const groups: WarehouseScopePredicate[] = [];
    const pushGroup = (fieldNames: string[] | undefined, values: string[]): void => {
      if (!fieldNames?.length || values.length === 0) {
        return;
      }

      const predicates = fieldNames.map((fieldName) =>
        this.buildInPredicate(`${alias}.${fieldName}`, values),
      );
      groups.push({
        sql: predicates.map((item) => item.sql).join(' OR '),
        params: predicates.flatMap((item) => item.params),
      });
    };

    pushGroup(fields.regions, filter.regions);
    pushGroup(fields.bigRegions, filter.bigRegions);
    if (groups.length === 0) {
      return { sql: '', params: [] };
    }

    return {
      sql: groups.map((item) => `(${item.sql})`).join(' OR '),
      params: groups.flatMap((item) => item.params),
    };
  }

  /**
   * 将非全量用户的行级范围注入 AI 生成 SQL。
   *
   * 参数说明：`sql` 为 AI 生成 SQL，`scope` 为当前用户权限范围。
   * 返回值说明：返回加范围后的 SQL 和参数；不能安全改写时返回 `null`。
   * 调用注意事项：拒绝子查询和 UNION 等复杂结构，避免字符串改写误伤业务语义或权限边界。
   */
  private applyScopeToGeneratedSql(
    sql: string,
    scope: WarehouseScopeResolution,
  ): WarehouseScopePredicate | null {
    if (scope.mode === 'full') {
      return { sql, params: [] };
    }

    if (/\(\s*SELECT\b|\bUNION\b/iu.test(sql)) {
      return null;
    }

    const tableAliases = this.extractBusinessTableAliases(sql);
    if (tableAliases.length === 0) {
      return null;
    }

    const predicates: WarehouseScopePredicate[] = [];
    for (const tableAlias of tableAliases) {
      const predicate = this.buildScopePredicateForAlias(
        tableAlias.tableName,
        tableAlias.alias,
        scope,
      );
      if (!predicate) {
        return null;
      }
      if (predicate.sql) {
        predicates.push(predicate);
      }
    }

    if (predicates.length === 0) {
      return { sql, params: [] };
    }

    const insertionIndex = this.findScopeInsertionIndex(sql);
    const before = sql.slice(0, insertionIndex).trimEnd();
    const after = sql.slice(insertionIndex).trimStart();
    const connector = /\bWHERE\b/iu.test(before) ? 'AND' : 'WHERE';
    const scopedSql = [
      before,
      connector,
      predicates.map((item) => `(${item.sql})`).join(' AND '),
      after,
    ]
      .filter(Boolean)
      .join(' ');

    return {
      sql: scopedSql,
      params: predicates.flatMap((item) => item.params),
    };
  }

  /**
   * 提取 AI SQL 中出现的业务表和别名。
   *
   * 参数说明：`sql` 为已拒绝子查询后的 SELECT SQL。
   * 返回值说明：返回需要行级权限控制的业务表别名列表。
   * 调用注意事项：语义目录表不承载业务行数据，因此不纳入行级范围注入。
   */
  private extractBusinessTableAliases(sql: string): Array<{ tableName: string; alias: string }> {
    const aliases: Array<{ tableName: string; alias: string }> = [];
    const tablePattern =
      /\b(?:FROM|JOIN)\s+(dim_lianruan_user|dim_lianruan_partner|dim_lianruan_customer|fact_lianruan_registration|fact_lianruan_opportunity|fact_lianruan_quote|fact_lianruan_order)\s*(?:AS\s+)?([A-Za-z_][A-Za-z0-9_]*)?/giu;
    let match: RegExpExecArray | null;
    while ((match = tablePattern.exec(sql))) {
      const tableName = match[1];
      const aliasCandidate = match[2];
      const alias =
        aliasCandidate && !this.isSqlClauseKeyword(aliasCandidate)
          ? aliasCandidate
          : tableName;
      if (SCOPED_BUSINESS_TABLES.has(tableName)) {
        aliases.push({ tableName, alias });
      }
    }
    return aliases;
  }

  /**
   * 判断提取到的候选别名是否其实是 SQL 子句关键字。
   *
   * 参数说明：`value` 为正则提取到的别名候选。
   * 返回值说明：如果是 `WHERE/GROUP/ORDER/LIMIT/ON` 等关键字则返回 `true`。
   * 调用注意事项：该判断用于处理未写别名的 SQL，避免把关键字当作表别名注入。
   */
  private isSqlClauseKeyword(value: string): boolean {
    return ['WHERE', 'GROUP', 'HAVING', 'ORDER', 'LIMIT', 'LEFT', 'RIGHT', 'INNER', 'ON'].includes(
      value.toUpperCase(),
    );
  }

  /**
   * 查找行级范围条件应插入的位置。
   *
   * 参数说明：`sql` 为单条 SELECT SQL。
   * 返回值说明：返回 `GROUP BY/HAVING/ORDER BY/LIMIT` 之前的位置；不存在这些子句时返回 SQL 末尾。
   * 调用注意事项：调用方已拒绝子查询，因此这里按顶层关键字做轻量定位。
   */
  private findScopeInsertionIndex(sql: string): number {
    const match = /\s+(GROUP\s+BY|HAVING|ORDER\s+BY|LIMIT)\b/iu.exec(sql);
    return match?.index ?? sql.length;
  }

  /**
   * 构造参数化 IN 条件。
   *
   * 参数说明：`qualifiedField` 为带别名字段，`values` 为允许值。
   * 返回值说明：返回 SQL 片段和绑定参数。
   * 调用注意事项：字段名来自固定白名单，值全部走参数绑定，避免 SQL 注入。
   */
  private buildInPredicate(qualifiedField: string, values: string[]): WarehouseScopePredicate {
    const placeholders = values.map(() => '?').join(', ');
    return {
      sql: `${qualifiedField} IN (${placeholders})`,
      params: values,
    };
  }

  /**
   * 构造固定模板的时间范围条件。
   *
   * 参数说明：
   * - `qualifiedField`：已由程序固定生成的日期字段或安全表达式。
   * - `temporalSlot`：AI 理解层输出的可执行时间槽。
   * 返回值说明：返回 SQL 条件和参数；缺少起止边界时返回空条件。
   * 调用注意事项：字段表达式必须来自固定模板，不能接受 AI 或用户输入，避免绕过字段白名单。
   */
  private buildTemporalPredicate(
    qualifiedField: string,
    temporalSlot?: AnalysisIntent['temporalSlot'],
  ): WarehouseScopePredicate {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (temporalSlot?.startAt) {
      clauses.push(`${qualifiedField} >= ?`);
      params.push(temporalSlot.startAt);
    }

    if (temporalSlot?.endAt) {
      const operator = temporalSlot.inclusivity?.end === 'inclusive' ? '<=' : '<';
      clauses.push(`${qualifiedField} ${operator} ?`);
      params.push(temporalSlot.endAt);
    }

    return {
      sql: clauses.join(' AND '),
      params,
    };
  }

  /**
   * 构造固定模板时间过滤，缺省时按用户问法兜底为最近 N 个月。
   *
   * 参数说明：
   * - `qualifiedField`：固定模板中的时间字段表达式。
   * - `temporalSlot`：AI 时间槽，存在时优先使用。
   * - `questionText`：用户原始问题，用于识别“最近3个月”等明确相对时间。
   * 返回值说明：返回 SQL 时间条件和报告展示时间口径。
   * 调用注意事项：兜底时间只支持固定月数，不接受自由文本拼 SQL。
   */
  private buildTemplateTemporalPredicate(
    qualifiedField: string,
    temporalSlot: AnalysisIntent['temporalSlot'] | undefined,
    questionText: string,
  ): { predicate: WarehouseScopePredicate; temporalScope?: ResultTemporalScope } {
    const aiPredicate = this.buildTemporalPredicate(qualifiedField, temporalSlot);
    const aiScope = buildResultTemporalScope(temporalSlot);
    if (aiPredicate.sql || aiScope) {
      return {
        predicate: aiPredicate,
        temporalScope: aiScope,
      };
    }

    const recentMonths = this.resolveRecentMonthCount(questionText);
    if (!recentMonths) {
      return {
        predicate: { sql: '', params: [] },
      };
    }

    const endAt = new Date();
    const startAt = new Date(endAt.getTime());
    startAt.setMonth(startAt.getMonth() - recentMonths);
    const startIso = startAt.toISOString();
    const endIso = endAt.toISOString();
    return {
      predicate: {
        sql: `${qualifiedField} >= ? AND ${qualifiedField} < ?`,
        params: [startIso, endIso],
      },
      temporalScope: {
        rawText: `最近${recentMonths}个月`,
        normalizedLabel: `最近 ${recentMonths} 个月`,
        startAt: startIso,
        endAt: endIso,
        granularity: 'month',
        timezone: 'Asia/Shanghai',
        source: 'FALLBACK_CLARIFICATION',
      },
    };
  }

  /**
   * 从用户问题中识别“最近 N 个月”。
   *
   * 参数说明：`questionText` 为用户原始问题。
   * 返回值说明：返回 1 到 12 之间的月份数；未命中时返回 0。
   * 调用注意事项：只做固定数值识别，避免把模糊时间猜成全量或错误周期。
   */
  private resolveRecentMonthCount(questionText: string): number {
    const digitMatch = questionText.match(/(?:最近|近)\s*(\d{1,2})\s*个?月/u);
    if (digitMatch?.[1]) {
      const months = Number(digitMatch[1]);
      return Number.isInteger(months) && months >= 1 && months <= 12 ? months : 0;
    }

    if (/(最近|近)\s*三\s*个?月/u.test(questionText)) {
      return 3;
    }

    if (/(最近|近)\s*(一年|1\s*年|12\s*个?月|十二\s*个?月)/u.test(questionText)) {
      return 12;
    }

    return 0;
  }

  /**
   * 数组去重并过滤空字符串。
   *
   * 参数说明：`values` 为候选字符串数组。
   * 返回值说明：返回保留原顺序的非空去重数组。
   * 调用注意事项：权限值为空时不能补默认全量，只能保持空数组。
   */
  private uniqueStrings(values: Array<string | null | undefined>): string[] {
    return [...new Set(values.map((item) => item?.trim()).filter((item): item is string => Boolean(item)))];
  }

  /**
   * 安全读取展示文本。
   *
   * 参数说明：`value` 为快照、MySQL 或 AI 结果中的任意字段值。
   * 返回值说明：返回去除首尾空白后的字符串；空值返回空字符串。
   * 调用注意事项：用户可见字段需要先经过该函数，避免把 null/undefined 直接展示出去。
   */
  private readString(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value).trim();
  }

  /**
   * 安全读取数值。
   *
   * 参数说明：`value` 为可能的数字、数字字符串或空值。
   * 返回值说明：解析成功返回数值，失败返回 0。
   * 调用注意事项：金额和数量指标允许为空，但不能让 `NaN` 进入结果卡片。
   */
  private readNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  /**
   * 标准化用于状态比较的文本。
   *
   * 参数说明：`value` 为阶段、状态或枚举字段。
   * 返回值说明：中文保持原义并去空白，英文统一转小写。
   * 调用注意事项：只用于程序内部比较，不直接作为用户可见文案。
   */
  private normalizeComparableText(value: unknown): string {
    const text = this.readString(value).replace(/\s+/gu, '');
    return /[A-Za-z]/u.test(text) ? text.toLowerCase() : text;
  }

  /**
   * 构造给 AI 的语义字段目录。
   *
   * 参数说明：无。
   * 返回值说明：返回紧凑中文字段目录文本。
   * 调用注意事项：只暴露 DWD/Facts/语义目录登记字段，不包含 ODS 原始 JSON。
   */
  private buildSemanticCatalogText(): string {
    return buildAnalysisWarehouseSemanticFieldSeeds()
      .map((field) =>
        [
          `${field.tableName}.${field.fieldName}`,
          `中文：${field.fieldLabel}`,
          `类型：${field.dataType}`,
          `含义：${field.businessMeaning}`,
        ].join('；'),
      )
      .join('\n');
  }

  /**
   * 构造给 AI 的语义指标目录。
   *
   * 参数说明：无。
   * 返回值说明：返回可参考的指标中文口径。
   * 调用注意事项：指标目录只作语义提示，真实执行仍以 SQL Guard 和分析库字段为准。
   */
  private buildMetricCatalogText(): string {
    return buildAnalysisWarehouseSemanticMetricSeeds()
      .map((metric) =>
        [
          `${metric.metricKey}`,
          `中文：${metric.metricLabel}`,
          `默认表：${metric.defaultTable}`,
          `公式：${metric.metricFormula}`,
          `含义：${metric.businessMeaning}`,
        ].join('；'),
      )
      .join('\n');
  }

  /**
   * 把分析库查询行转换为统一数据切片。
   *
   * 参数说明：包含任务标题、结果类型、SQL、行数据和时间权限口径。
   * 返回值说明：返回现有报告编排器可消费的数据切片。
   * 调用注意事项：这里不重新计算复杂业务口径，只做展示层需要的基础指标和表格封装。
   */
  private buildSlice(params: {
    taskTitle: string;
    resultKind: QueryPlanResultKind;
    rows: Array<Record<string, unknown>>;
    sql: string;
    temporalSlot?: AnalysisIntent['temporalSlot'];
    scopeSummary: string;
    rowLimit: number;
  }): AnalysisDatasetSlice {
    const normalizedRows = params.rows.map((row) => this.normalizeRow(row));
    const temporalScope = buildResultTemporalScope(params.temporalSlot);
    return {
      datasetId: buildEntityId('dataset'),
      taskId: 'analysis-warehouse-text-to-sql',
      taskTitle: params.taskTitle,
      resultKind: params.resultKind,
      purpose: 'primary-summary',
      sql: params.sql,
      executionMode: 'GUARDED_DIRECT_QUERY',
      executionSource: 'ANALYSIS_WAREHOUSE',
      matchedAdapter: 'analysis-warehouse.text-to-sql',
      gapReason: '',
      summary:
        normalizedRows.length > 0
          ? `已通过 AI-agent 分析库完成查询，返回 ${normalizedRows.length} 行结果。`
          : '当前分析库在授权范围内未命中数据。',
      temporalScope,
      appliedFilters: [
        {
          label: '数据来源',
          value: 'AI-agent 自建分析库',
        },
        {
          label: '权限范围',
          value: params.scopeSummary,
        },
        ...(temporalScope
          ? [{ label: '时间口径', value: formatTemporalScopeLabel(temporalScope) }]
          : []),
      ],
      metricCards: this.buildMetricCards(normalizedRows),
      primaryView: this.buildPrimaryView(params.taskTitle, normalizedRows),
      secondaryViews: normalizedRows.length
        ? [
            {
              viewType: 'RANKING_TABLE',
              title: `${params.taskTitle}明细`,
              rows: normalizedRows,
              columns: this.buildColumns(normalizedRows),
            },
          ]
        : [],
      tableRows: normalizedRows,
      rowCount: normalizedRows.length,
    };
  }

  /**
   * 构造固定模板通用过滤说明。
   *
   * 参数说明：包含时间口径、权限摘要和业务区域过滤。
   * 返回值说明：返回可直接进入结果包的中文过滤说明。
   * 调用注意事项：业务区域过滤只说明用户问题里的条件，不替代权限范围说明。
   */
  private buildTemplateAppliedFilters(params: {
    scopeSummary: string;
    temporalScope?: ReturnType<typeof buildResultTemporalScope>;
    businessRegionFilter?: BusinessRegionFilter;
    statisticScopeLabel: string;
    riskScopeLabel?: string;
    sortScopeLabel?: string;
  }): Array<{ label: string; value: string }> {
    return [
      { label: '数据来源', value: 'AI-agent 自建分析库' },
      { label: '统计口径', value: params.statisticScopeLabel },
      ...(params.riskScopeLabel ? [{ label: '风险口径', value: params.riskScopeLabel }] : []),
      ...(params.sortScopeLabel ? [{ label: '排序口径', value: params.sortScopeLabel }] : []),
      { label: '权限范围', value: params.scopeSummary },
      ...(params.businessRegionFilter?.summary
        ? [{ label: '业务范围', value: params.businessRegionFilter.summary }]
        : []),
      ...(params.temporalScope
        ? [{ label: '时间口径', value: formatTemporalScopeLabel(params.temporalScope) }]
        : []),
    ];
  }

  /**
   * 构造 P4 经营简报综合报告切片。
   *
   * 参数说明：包含组合经营、漏斗转化、报价未下单三个受控模板结果。
   * 返回值说明：返回一个适合企微和 Web 同源消费的综合报告切片。
   * 调用注意事项：这里只重组已审计查询结果，不重新解释底层字段，避免报告区块与原始模板数值不一致。
   */
  private buildBusinessBriefingSlice(params: {
    compositeSlice: AnalysisDatasetSlice;
    funnelSlice: AnalysisDatasetSlice;
    quoteRiskSlice: AnalysisDatasetSlice;
    sql: string;
    temporalSlot?: AnalysisIntent['temporalSlot'];
    scopeSummary: string;
    businessRegionFilter?: BusinessRegionFilter;
  }): AnalysisDatasetSlice {
    const temporalScope = buildResultTemporalScope(params.temporalSlot);
    const metricCards = this.mergeMetricCards([
      params.compositeSlice.metricCards,
      params.funnelSlice.metricCards,
      params.quoteRiskSlice.metricCards,
    ], 8);
    const overviewRows = [
      {
        section_name: '经营概览',
        section_summary: params.compositeSlice.summary,
        row_count: params.compositeSlice.rowCount,
      },
      {
        section_name: '转化漏斗',
        section_summary: params.funnelSlice.summary,
        row_count: params.funnelSlice.rowCount,
      },
      {
        section_name: '报价未下单风险',
        section_summary: params.quoteRiskSlice.summary,
        row_count: params.quoteRiskSlice.rowCount,
      },
    ];
    const secondaryViews: ResultView[] = [
      {
        viewType: 'DETAIL_TABLE',
        title: '经营简报区块总览',
        rows: overviewRows,
        columns: this.buildColumns(overviewRows),
      },
      ...params.compositeSlice.secondaryViews,
      ...params.funnelSlice.secondaryViews,
      ...params.quoteRiskSlice.secondaryViews,
    ];
    const quoteRiskCount = params.quoteRiskSlice.rowCount;
    const riskText = quoteRiskCount > 0
      ? `发现 ${quoteRiskCount} 条报价未下单风险，建议优先跟进高金额报价客户。`
      : '暂未发现报价未下单风险，建议继续关注报价转订单节奏。';

    return {
      datasetId: buildEntityId('dataset'),
      taskId: 'analysis-warehouse-business-briefing',
      taskTitle: '联软 CRM 经营简报',
      resultKind: 'metric-summary',
      purpose: 'primary-summary',
      sql: params.sql,
      executionMode: 'GUARDED_DIRECT_QUERY',
      executionSource: 'ANALYSIS_WAREHOUSE',
      matchedAdapter: 'analysis-warehouse.fixed-business-briefing',
      gapReason: '',
      summary: `已生成联软 CRM 经营简报：包含经营概览、报备到订单转化漏斗、报价未下单风险和超期商机明细。${riskText}`,
      temporalScope,
      appliedFilters: this.buildTemplateAppliedFilters({
        scopeSummary: params.scopeSummary,
        temporalScope,
        businessRegionFilter: params.businessRegionFilter,
        statisticScopeLabel: 'P4 多子任务经营简报：经营概览、转化漏斗、报价未下单风险和超期商机明细',
      }),
      metricCards,
      primaryView: {
        viewType: 'METRIC_CARDS',
        title: '经营简报关键指标',
        rows: overviewRows,
        columns: this.buildColumns(overviewRows),
      },
      secondaryViews,
      tableRows: overviewRows,
      rowCount: overviewRows.length,
    };
  }

  /**
   * 构造“商机整体 + 渠道商维度”结果切片。
   *
   * 参数说明：包含已过滤商机、阶段分布、渠道商贡献、重点明细和审计 SQL。
   * 返回值说明：返回适合企业微信卡片和 Web 详情共同消费的商机经营总览。
   * 调用注意事项：主表放渠道商贡献，阶段分布和商机明细作为二级视图保留。
   */
  private buildOpportunityPartnerOverviewSlice(params: {
    opportunities: Array<Record<string, unknown>>;
    stageRows: Array<Record<string, unknown>>;
    partnerRows: Array<Record<string, unknown>>;
    detailRows: Array<Record<string, unknown>>;
    sql: string;
    temporalScope?: ResultTemporalScope;
    scopeSummary: string;
    businessRegionFilter?: BusinessRegionFilter;
  }): AnalysisDatasetSlice {
    const totalAmount = this.sumSqliteRecordAmount(params.opportunities, [
      'amount',
      'opportunityAmount',
      'opportunity_amount',
      'expectAmount',
      'expect_amount',
    ]);
    const effectiveCount = params.opportunities.filter((record) =>
      this.isEffectiveSqliteOpportunityRecord(record),
    ).length;
    const overviewRows = [
      { metric_name: '商机数', metric_value: params.opportunities.length, metric_note: '按商机创建时间统计当前可见商机' },
      { metric_name: '商机金额', metric_value: formatWanAmount(totalAmount), metric_note: '商机金额合计' },
      { metric_name: '有效商机数', metric_value: effectiveCount, metric_note: '排除已赢单、已输单、取消、删除等状态' },
      { metric_name: '关联渠道商数', metric_value: params.partnerRows.length, metric_note: '按商机上的渠道商字段去重' },
    ];

    return {
      datasetId: buildEntityId('dataset'),
      taskId: 'sqlite-snapshot-opportunity-partner-overview',
      taskTitle: '商机与渠道商经营总览',
      resultKind: 'metric-summary',
      purpose: 'primary-summary',
      sql: params.sql,
      executionMode: 'GUARDED_DIRECT_QUERY',
      executionSource: 'ANALYSIS_WAREHOUSE',
      matchedAdapter: 'sqlite-snapshot.fixed-opportunity-partner-overview',
      gapReason: '',
      summary: `当前权限范围内共有商机 ${params.opportunities.length} 条，商机金额合计 ${formatWanAmount(totalAmount)}，关联渠道商 ${params.partnerRows.length} 家。`,
      temporalScope: params.temporalScope,
      appliedFilters: this.buildTemplateAppliedFilters({
        scopeSummary: params.scopeSummary,
        temporalScope: params.temporalScope,
        businessRegionFilter: params.businessRegionFilter,
        statisticScopeLabel: '商机整体情况默认带渠道商维度，补充阶段分布和重点商机明细',
      }),
      metricCards: [
        { name: '商机数', value: params.opportunities.length },
        { name: '商机金额', value: formatWanAmount(totalAmount) },
        { name: '关联渠道商数', value: params.partnerRows.length },
        { name: '有效商机数', value: effectiveCount },
      ],
      primaryView: {
        viewType: 'METRIC_CARDS',
        title: '商机经营总览',
        rows: overviewRows,
        columns: this.buildColumns(overviewRows),
      },
      secondaryViews: [
        {
          viewType: 'RANKING_TABLE',
          title: '商机渠道商贡献',
          rows: params.partnerRows,
          columns: this.buildColumns(params.partnerRows),
        },
        {
          viewType: 'RANKING_TABLE',
          title: '商机阶段分布',
          rows: params.stageRows,
          columns: this.buildColumns(params.stageRows),
        },
        {
          viewType: 'DETAIL_TABLE',
          title: '重点商机明细',
          rows: params.detailRows,
          columns: this.buildColumns(params.detailRows),
        },
      ],
      tableRows: params.partnerRows.length ? params.partnerRows : overviewRows,
      rowCount: params.partnerRows.length || overviewRows.length,
    };
  }

  /**
   * 构造“渠道商经营链路”结果切片。
   *
   * 参数说明：`partnerRows` 为按渠道商聚合的报备、商机和订单链路数据。
   * 返回值说明：返回渠道商经营贡献表和关键指标。
   */
  private buildPartnerBusinessChainSlice(params: {
    partnerRows: Array<Record<string, unknown>>;
    sql: string;
    temporalScope?: ResultTemporalScope;
    scopeSummary: string;
    businessRegionFilter?: BusinessRegionFilter;
  }): AnalysisDatasetSlice {
    const registrationCount = this.sumNumeric(params.partnerRows, 'registration_count');
    const opportunityCount = this.sumNumeric(params.partnerRows, 'opportunity_count');
    const orderCount = this.sumNumeric(params.partnerRows, 'order_count');
    const orderAmount = this.sumNumeric(params.partnerRows, 'order_amount');

    return {
      datasetId: buildEntityId('dataset'),
      taskId: 'sqlite-snapshot-partner-business-chain',
      taskTitle: '渠道商经营贡献分析',
      resultKind: 'partner-contribution',
      purpose: 'primary-summary',
      sql: params.sql,
      executionMode: 'GUARDED_DIRECT_QUERY',
      executionSource: 'ANALYSIS_WAREHOUSE',
      matchedAdapter: 'sqlite-snapshot.fixed-partner-business-chain',
      gapReason: '',
      summary: `当前权限范围内渠道商经营链路覆盖 ${params.partnerRows.length} 家渠道商，客户报备 ${registrationCount} 条、商机 ${opportunityCount} 条、有效订单 ${orderCount} 单，订单金额 ${formatWanAmount(orderAmount)}。`,
      temporalScope: params.temporalScope,
      appliedFilters: this.buildTemplateAppliedFilters({
        scopeSummary: params.scopeSummary,
        temporalScope: params.temporalScope,
        businessRegionFilter: params.businessRegionFilter,
        statisticScopeLabel: '渠道商默认拉通客户报备、商机和有效订单经营贡献',
      }),
      metricCards: [
        { name: '渠道商数', value: params.partnerRows.length },
        { name: '客户报备数', value: registrationCount },
        { name: '商机数', value: opportunityCount },
        { name: '有效订单金额', value: formatWanAmount(orderAmount) },
      ],
      primaryView: params.partnerRows.length
        ? {
            viewType: 'RANKING_TABLE',
            title: '渠道商经营贡献',
            rows: params.partnerRows,
            columns: this.buildColumns(params.partnerRows),
          }
        : undefined,
      secondaryViews: params.partnerRows.length
        ? [
            {
              viewType: 'RANKING_TABLE',
              title: '渠道商报备-商机-订单贡献明细',
              rows: params.partnerRows,
              columns: this.buildColumns(params.partnerRows),
            },
          ]
        : [],
      tableRows: params.partnerRows,
      rowCount: params.partnerRows.length,
    };
  }

  /**
   * 构造“客户报备 + 渠道商维度”结果切片。
   *
   * 参数说明：包含报备原始行、渠道商聚合行、报备明细和未关联商机明细。
   * 返回值说明：返回客户报备整体情况和渠道商分布。
   */
  private buildRegistrationPartnerOverviewSlice(params: {
    registrationRows: Array<Record<string, unknown>>;
    partnerRows: Array<Record<string, unknown>>;
    detailRows: Array<Record<string, unknown>>;
    unlinkedRows: Array<Record<string, unknown>>;
    sql: string;
    temporalScope?: ResultTemporalScope;
    scopeSummary: string;
    businessRegionFilter?: BusinessRegionFilter;
  }): AnalysisDatasetSlice {
    const linkedCount = this.sumNumeric(params.partnerRows, 'linked_opportunity_count');
    const unlinkedCount = this.sumNumeric(params.partnerRows, 'unlinked_registration_count');

    return {
      datasetId: buildEntityId('dataset'),
      taskId: 'sqlite-snapshot-registration-partner-overview',
      taskTitle: '客户报备与渠道商总览',
      resultKind: 'category-distribution',
      purpose: 'primary-summary',
      sql: params.sql,
      executionMode: 'GUARDED_DIRECT_QUERY',
      executionSource: 'ANALYSIS_WAREHOUSE',
      matchedAdapter: 'sqlite-snapshot.fixed-registration-partner-overview',
      gapReason: '',
      summary: `当前权限范围内客户报备 ${params.registrationRows.length} 条，其中已关联商机 ${linkedCount} 条、未关联商机 ${unlinkedCount} 条，覆盖渠道商 ${params.partnerRows.length} 家。`,
      temporalScope: params.temporalScope,
      appliedFilters: this.buildTemplateAppliedFilters({
        scopeSummary: params.scopeSummary,
        temporalScope: params.temporalScope,
        businessRegionFilter: params.businessRegionFilter,
        statisticScopeLabel: '客户报备默认带渠道商维度，并按报备 ID 或客户 ID 识别关联商机',
      }),
      metricCards: [
        { name: '客户报备数', value: params.registrationRows.length },
        { name: '已关联商机报备数', value: linkedCount },
        { name: '未关联商机报备数', value: unlinkedCount },
        { name: '关联渠道商数', value: params.partnerRows.length },
      ],
      primaryView: params.partnerRows.length
        ? {
            viewType: 'RANKING_TABLE',
            title: '客户报备渠道商分布',
            rows: params.partnerRows,
            columns: this.buildColumns(params.partnerRows),
          }
        : undefined,
      secondaryViews: [
        {
          viewType: 'RANKING_TABLE',
          title: '客户报备渠道商分布',
          rows: params.partnerRows,
          columns: this.buildColumns(params.partnerRows),
        },
        {
          viewType: 'DETAIL_TABLE',
          title: '客户报备明细',
          rows: params.detailRows,
          columns: this.buildColumns(params.detailRows),
        },
        {
          viewType: 'DETAIL_TABLE',
          title: '未关联商机的客户报备明细',
          rows: params.unlinkedRows,
          columns: this.buildColumns(params.unlinkedRows),
        },
      ],
      tableRows: params.partnerRows,
      rowCount: params.partnerRows.length,
    };
  }

  /**
   * 构造“订单 + 渠道商维度”结果切片。
   *
   * 参数说明：包含有效订单、渠道商聚合行、订单明细和审计 SQL。
   * 返回值说明：返回订单整体情况和渠道商贡献。
   */
  private buildOrderPartnerOverviewSlice(params: {
    orderRows: Array<Record<string, unknown>>;
    partnerRows: Array<Record<string, unknown>>;
    detailRows: Array<Record<string, unknown>>;
    sql: string;
    temporalScope?: ResultTemporalScope;
    scopeSummary: string;
    businessRegionFilter?: BusinessRegionFilter;
  }): AnalysisDatasetSlice {
    const orderAmount = this.sumSqliteRecordAmount(params.orderRows, [
      'amount',
      'orderAmount',
      'order_amount',
      'totalAmount',
      'total_amount',
    ]);

    return {
      datasetId: buildEntityId('dataset'),
      taskId: 'sqlite-snapshot-order-partner-overview',
      taskTitle: '订单与渠道商贡献总览',
      resultKind: 'partner-contribution',
      purpose: 'primary-summary',
      sql: params.sql,
      executionMode: 'GUARDED_DIRECT_QUERY',
      executionSource: 'ANALYSIS_WAREHOUSE',
      matchedAdapter: 'sqlite-snapshot.fixed-order-partner-overview',
      gapReason: '',
      summary: `当前权限范围内有效订单 ${params.orderRows.length} 单，订单金额 ${formatWanAmount(orderAmount)}，覆盖渠道商 ${params.partnerRows.length} 家。`,
      temporalScope: params.temporalScope,
      appliedFilters: this.buildTemplateAppliedFilters({
        scopeSummary: params.scopeSummary,
        temporalScope: params.temporalScope,
        businessRegionFilter: params.businessRegionFilter,
        statisticScopeLabel: '订单默认按渠道商贡献统计，排除取消、作废、驳回、删除状态',
      }),
      metricCards: [
        { name: '有效订单数', value: params.orderRows.length },
        { name: '有效订单金额', value: formatWanAmount(orderAmount) },
        { name: '关联渠道商数', value: params.partnerRows.length },
      ],
      primaryView: params.partnerRows.length
        ? {
            viewType: 'RANKING_TABLE',
            title: '订单金额渠道商贡献',
            rows: params.partnerRows,
            columns: this.buildColumns(params.partnerRows),
          }
        : undefined,
      secondaryViews: [
        {
          viewType: 'RANKING_TABLE',
          title: '订单金额渠道商贡献',
          rows: params.partnerRows,
          columns: this.buildColumns(params.partnerRows),
        },
        {
          viewType: 'DETAIL_TABLE',
          title: '订单明细',
          rows: params.detailRows,
          columns: this.buildColumns(params.detailRows),
        },
      ],
      tableRows: params.partnerRows,
      rowCount: params.partnerRows.length,
    };
  }

  /**
   * 构造“渠道商新增 + 商机增长”双区块结果切片。
   *
   * 参数说明：包含渠道商新增月度行、商机增长月度行、SQL、时间和权限口径。
   * 返回值说明：返回一个主摘要和两个展示区块，分别用于表格和趋势数据。
   * 调用注意事项：渠道商新增适合表格核对，商机增长适合图表区块展示，两者不合并为同一宽表。
   */
  private buildPartnerOpportunityGrowthSlice(params: {
    partnerRows: Array<Record<string, unknown>>;
    opportunityRows: Array<Record<string, unknown>>;
    sql: string;
    temporalScope?: ResultTemporalScope;
    scopeSummary: string;
    businessRegionFilter?: BusinessRegionFilter;
  }): AnalysisDatasetSlice {
    const partnerCount = this.sumNumeric(params.partnerRows, 'new_partner_count');
    const opportunityCount = this.sumNumeric(params.opportunityRows, 'new_opportunity_count');
    const opportunityAmount = this.sumNumeric(params.opportunityRows, 'opportunity_amount');
    const overviewRows = [
      {
        section_name: '渠道商新增情况',
        render_type: '表格',
        section_summary: `新增渠道商 ${partnerCount} 家，按月份拆分展示。`,
        row_count: params.partnerRows.length,
      },
      {
        section_name: '商机增长情况',
        render_type: '趋势数据',
        section_summary: `新增商机 ${opportunityCount} 个，商机金额合计 ${formatWanAmount(opportunityAmount)}。`,
        row_count: params.opportunityRows.length,
      },
    ];

    return {
      datasetId: buildEntityId('dataset'),
      taskId: 'analysis-warehouse-partner-opportunity-growth',
      taskTitle: '渠道商新增与商机增长分析',
      resultKind: 'time-trend',
      purpose: 'primary-summary',
      sql: params.sql,
      executionMode: 'GUARDED_DIRECT_QUERY',
      executionSource: 'ANALYSIS_WAREHOUSE',
      matchedAdapter: 'analysis-warehouse.fixed-partner-opportunity-growth',
      gapReason: '',
      summary: `已按两个区块完成分析：渠道商新增 ${partnerCount} 家，商机新增 ${opportunityCount} 个，商机金额合计 ${formatWanAmount(opportunityAmount)}。`,
      temporalScope: params.temporalScope,
      appliedFilters: this.buildTemplateAppliedFilters({
        scopeSummary: params.scopeSummary,
        temporalScope: params.temporalScope,
        businessRegionFilter: params.businessRegionFilter,
        statisticScopeLabel: '渠道商新增按服务商创建时间统计；商机增长按商机创建时间统计，金额取商机金额',
      }),
      metricCards: [
        { name: '新增渠道商数', value: partnerCount },
        { name: '新增商机数', value: opportunityCount },
        { name: '新增商机金额', value: formatWanAmount(opportunityAmount) },
      ],
      primaryView: {
        viewType: 'METRIC_CARDS',
        title: '渠道商新增与商机增长概览',
        rows: overviewRows,
        columns: this.buildColumns(overviewRows),
      },
      secondaryViews: [
        {
          viewType: 'DETAIL_TABLE',
          title: '渠道商新增情况（表格）',
          rows: params.partnerRows,
          columns: this.buildColumns(params.partnerRows),
        },
        {
          viewType: 'LINE_CHART',
          title: '商机增长情况（趋势数据）',
          rows: params.opportunityRows,
          columns: this.buildColumns(params.opportunityRows),
        },
      ],
      tableRows: overviewRows,
      rowCount: overviewRows.length,
    };
  }

  /**
   * 构造“订单情况 + 商机情况”双区块结果切片。
   *
   * 参数说明：包含订单月度行、商机月度行、SQL、时间和权限口径。
   * 返回值说明：返回一个主摘要和两个展示区块，分别用于订单、商机独立呈现。
   * 调用注意事项：主表只放区块总览，企微和公开结果页通过模板卡片及区块表格查看详情。
   */
  private buildOrderOpportunityOverviewSlice(params: {
    orderRows: Array<Record<string, unknown>>;
    opportunityRows: Array<Record<string, unknown>>;
    sql: string;
    temporalScope?: ResultTemporalScope;
    scopeSummary: string;
    businessRegionFilter?: BusinessRegionFilter;
  }): AnalysisDatasetSlice {
    const orderCount = this.sumNumeric(params.orderRows, 'order_count');
    const orderAmount = this.sumNumeric(params.orderRows, 'order_amount');
    const opportunityCount = this.sumNumeric(params.opportunityRows, 'opportunity_count');
    const opportunityAmount = this.sumNumeric(params.opportunityRows, 'opportunity_amount');
    const overviewRows = [
      {
        section_name: '订单情况',
        render_type: '趋势/表格区块',
        section_summary: `有效订单 ${orderCount} 单，订单金额合计 ${formatWanAmount(orderAmount)}。`,
        row_count: params.orderRows.length,
      },
      {
        section_name: '商机情况',
        render_type: '趋势/表格区块',
        section_summary: `商机 ${opportunityCount} 个，商机金额合计 ${formatWanAmount(opportunityAmount)}。`,
        row_count: params.opportunityRows.length,
      },
    ];

    return {
      datasetId: buildEntityId('dataset'),
      taskId: 'analysis-warehouse-order-opportunity-overview',
      taskTitle: '订单与商机分块分析',
      resultKind: 'time-trend',
      purpose: 'primary-summary',
      sql: params.sql,
      executionMode: 'GUARDED_DIRECT_QUERY',
      executionSource: 'ANALYSIS_WAREHOUSE',
      matchedAdapter: 'analysis-warehouse.fixed-order-opportunity-overview',
      gapReason: '',
      summary: `已按两个区块完成分析：订单情况 ${orderCount} 单、${formatWanAmount(orderAmount)}；商机情况 ${opportunityCount} 个、${formatWanAmount(opportunityAmount)}。`,
      temporalScope: params.temporalScope,
      appliedFilters: this.buildTemplateAppliedFilters({
        scopeSummary: params.scopeSummary,
        temporalScope: params.temporalScope,
        businessRegionFilter: params.businessRegionFilter,
        statisticScopeLabel: '订单按有效订单成交时间优先、创建时间兜底统计；商机按商机创建时间统计，两者独立汇总',
      }),
      metricCards: [
        { name: '有效订单数量', value: orderCount },
        { name: '有效订单金额', value: formatWanAmount(orderAmount) },
        { name: '商机数量', value: opportunityCount },
        { name: '商机金额', value: formatWanAmount(opportunityAmount) },
      ],
      primaryView: {
        viewType: 'METRIC_CARDS',
        title: '订单与商机概览',
        rows: overviewRows,
        columns: this.buildColumns(overviewRows),
      },
      secondaryViews: [
        {
          viewType: 'LINE_CHART',
          title: '订单情况（趋势/表格）',
          rows: params.orderRows,
          columns: this.buildColumns(params.orderRows),
        },
        {
          viewType: 'LINE_CHART',
          title: '商机情况（趋势/表格）',
          rows: params.opportunityRows,
          columns: this.buildColumns(params.opportunityRows),
        },
      ],
      tableRows: overviewRows,
      rowCount: overviewRows.length,
    };
  }

  /**
   * 构造 P3 组合经营分析结果切片。
   *
   * 参数说明：包含多子任务的汇总行、风险明细、SQL 和过滤口径。
   * 返回值说明：返回单个组合切片，供现有 Web 和企微结果编排复用。
   * 调用注意事项：该切片聚合多个受控子查询的结果，不能把指标重新解释为单表自由 SQL 结果。
   */
  private buildCompositeOperationsSlice(params: {
    partnerSummary: Record<string, unknown>;
    customerSummary: Record<string, unknown>;
    registrationSummary: Record<string, unknown>;
    opportunitySummary: Record<string, unknown>;
    orderSummary: Record<string, unknown>;
    unlinkedRows: Array<Record<string, unknown>>;
    staleRows: Array<Record<string, unknown>>;
    sql: string;
    temporalSlot?: AnalysisIntent['temporalSlot'];
    scopeSummary: string;
    businessRegionFilter?: BusinessRegionFilter;
  }): AnalysisDatasetSlice {
    const temporalScope = buildResultTemporalScope(params.temporalSlot);
    const partnerCount = Number(params.partnerSummary.partner_count) || 0;
    const customerCount = Number(params.customerSummary.customer_count) || 0;
    const customerCountSource = this.readString(params.customerSummary.customer_count_source);
    const registrationCount = Number(params.registrationSummary.registration_count) || 0;
    const opportunityCount = Number(params.opportunitySummary.opportunity_count) || 0;
    const opportunityAmount = Number(params.opportunitySummary.opportunity_amount) || 0;
    const orderCount = Number(params.orderSummary.order_count) || 0;
    const orderAmount = Number(params.orderSummary.order_amount) || 0;
    const unlinkedCount = params.unlinkedRows.length;
    const staleCount = params.staleRows.length;
    const overviewRows = [
      { metric_name: '合作伙伴数', metric_value: partnerCount, metric_note: '按服务商/渠道商创建时间统计合作伙伴开拓情况' },
      {
        metric_name: customerCountSource === 'derived-from-business-records' ? '涉及客户数' : '客户数',
        metric_value: customerCount,
        metric_note: customerCountSource === 'derived-from-business-records'
          ? '快照未提供客户主表，按报备、商机和订单中的客户标识去重估算'
          : '当前权限和业务范围内客户主数据数量',
      },
      { metric_name: '客户商机报备数', metric_value: registrationCount, metric_note: '按客户报备创建时间统计' },
      { metric_name: '商机数', metric_value: opportunityCount, metric_note: '按商机创建时间统计' },
      { metric_name: '商机金额', metric_value: formatWanAmount(opportunityAmount), metric_note: '商机金额合计' },
      { metric_name: '有效订单数', metric_value: orderCount, metric_note: '排除取消、作废、驳回、删除状态' },
      { metric_name: '有效订单金额', metric_value: formatWanAmount(orderAmount), metric_note: '按成交时间优先、创建时间兜底统计' },
      { metric_name: '未关联商机报备数', metric_value: unlinkedCount, metric_note: '报备记录未关联商机的明细数量' },
      { metric_name: '超两周未更新商机数', metric_value: staleCount, metric_note: '更新时间超过 14 天且未成交/未失单' },
    ];

    return {
      datasetId: buildEntityId('dataset'),
      taskId: 'analysis-warehouse-composite-operations',
      taskTitle: '联软 CRM 组合经营分析',
      resultKind: 'metric-summary',
      purpose: 'primary-summary',
      sql: params.sql,
      executionMode: 'GUARDED_DIRECT_QUERY',
      executionSource: 'ANALYSIS_WAREHOUSE',
      matchedAdapter: 'analysis-warehouse.fixed-composite-operations',
      gapReason: '',
      summary: `已按三个区块完成经营分析：合作伙伴开拓 ${partnerCount} 家；客户商机报备 ${registrationCount} 条、商机 ${opportunityCount} 条；有效订单 ${orderCount} 单、订单金额 ${formatWanAmount(orderAmount)}。同时补充未关联商机报备 ${unlinkedCount} 条、超两周未更新商机 ${staleCount} 条供后续经营建议参考。`,
      temporalScope,
      appliedFilters: this.buildTemplateAppliedFilters({
        scopeSummary: params.scopeSummary,
        temporalScope,
        businessRegionFilter: params.businessRegionFilter,
        statisticScopeLabel: '合作伙伴开拓、客户商机报备、订单情况和风险明细组合统计',
      }),
      metricCards: [
        { name: '合作伙伴数', value: partnerCount },
        { name: '客户商机报备数', value: registrationCount },
        { name: '商机数', value: opportunityCount },
        { name: '有效订单金额', value: formatWanAmount(orderAmount) },
      ],
      primaryView: {
        viewType: 'METRIC_CARDS',
        title: '组合经营概览',
        rows: overviewRows,
        columns: this.buildColumns(overviewRows),
      },
      secondaryViews: [
        {
          viewType: 'DETAIL_TABLE',
          title: '组合经营概览表',
          rows: overviewRows,
          columns: this.buildColumns(overviewRows),
        },
        ...(params.unlinkedRows.length
          ? [{
              viewType: 'DETAIL_TABLE' as const,
              title: '未关联商机的客户报备明细',
              rows: params.unlinkedRows,
              columns: this.buildColumns(params.unlinkedRows),
            }]
          : []),
        ...(params.staleRows.length
          ? [{
              viewType: 'DETAIL_TABLE' as const,
              title: '超过两周未更新商机明细',
              rows: params.staleRows,
              columns: this.buildColumns(params.staleRows),
            }]
          : []),
      ],
      tableRows: overviewRows,
      rowCount: overviewRows.length,
    };
  }

  /**
   * 构造“报备-商机-报价-订单”漏斗转化结果切片。
   *
   * 参数说明：包含四段事实表汇总、SQL、时间和权限口径。
   * 返回值说明：返回漏斗表、转化率指标卡和口径说明。
   * 调用注意事项：当前首版按各对象总量计算阶段转化率，完整链路样例仅作为 P4 深化依据。
   */
  private buildFunnelConversionSlice(params: {
    registrationSummary: Record<string, unknown>;
    opportunitySummary: Record<string, unknown>;
    quoteSummary: Record<string, unknown>;
    orderSummary: Record<string, unknown>;
    sql: string;
    temporalSlot?: AnalysisIntent['temporalSlot'];
    scopeSummary: string;
    businessRegionFilter?: BusinessRegionFilter;
  }): AnalysisDatasetSlice {
    const temporalScope = buildResultTemporalScope(params.temporalSlot);
    const registrationCount = Number(params.registrationSummary.registration_count) || 0;
    const opportunityCount = Number(params.opportunitySummary.opportunity_count) || 0;
    const quoteCount = Number(params.quoteSummary.quote_count) || 0;
    const orderCount = Number(params.orderSummary.order_count) || 0;
    const opportunityAmount = Number(params.opportunitySummary.opportunity_amount) || 0;
    const quoteAmount = Number(params.quoteSummary.quote_amount) || 0;
    const orderAmount = Number(params.orderSummary.order_amount) || 0;
    const rows = [
      {
        funnel_stage: '客户报备',
        stage_count: registrationCount,
        stage_amount: '',
        conversion_rate: '100%',
        stage_note: '客户报备记录数',
      },
      {
        funnel_stage: '商机',
        stage_count: opportunityCount,
        stage_amount: formatWanAmount(opportunityAmount),
        conversion_rate: this.formatPercent(opportunityCount, registrationCount),
        stage_note: '商机数 / 报备数',
      },
      {
        funnel_stage: '报价',
        stage_count: quoteCount,
        stage_amount: formatWanAmount(quoteAmount),
        conversion_rate: this.formatPercent(quoteCount, opportunityCount),
        stage_note: '报价数 / 商机数',
      },
      {
        funnel_stage: '有效订单',
        stage_count: orderCount,
        stage_amount: formatWanAmount(orderAmount),
        conversion_rate: this.formatPercent(orderCount, quoteCount),
        stage_note: '有效订单数 / 报价数',
      },
    ];

    return {
      datasetId: buildEntityId('dataset'),
      taskId: 'analysis-warehouse-funnel-conversion',
      taskTitle: '报备到订单转化漏斗',
      resultKind: 'category-distribution',
      purpose: 'primary-summary',
      sql: params.sql,
      executionMode: 'GUARDED_DIRECT_QUERY',
      executionSource: 'ANALYSIS_WAREHOUSE',
      matchedAdapter: 'analysis-warehouse.fixed-funnel-conversion',
      gapReason: '',
      summary: `当前权限范围内报备 ${registrationCount} 条、商机 ${opportunityCount} 条、报价 ${quoteCount} 条、有效订单 ${orderCount} 单；报备到有效订单总体转化率为 ${this.formatPercent(orderCount, registrationCount)}。`,
      temporalScope,
      appliedFilters: this.buildTemplateAppliedFilters({
        scopeSummary: params.scopeSummary,
        temporalScope,
        businessRegionFilter: params.businessRegionFilter,
        statisticScopeLabel: '报备、商机、报价、有效订单逐级漏斗；有效订单仅统计已确认和已完成',
      }),
      metricCards: [
        { name: '报备数', value: registrationCount },
        { name: '商机数', value: opportunityCount },
        { name: '报价数', value: quoteCount },
        { name: '有效订单转化率', value: this.formatPercent(orderCount, registrationCount) },
      ],
      primaryView: {
        viewType: 'DETAIL_TABLE',
        title: '报备到订单转化漏斗',
        rows,
        columns: this.buildColumns(rows),
      },
      secondaryViews: [
        {
          viewType: 'DETAIL_TABLE',
          title: '报备到订单转化漏斗',
          rows,
          columns: this.buildColumns(rows),
        },
      ],
      tableRows: rows,
      rowCount: rows.length,
    };
  }

  /**
   * 构造“有报价但未下单”结果切片。
   *
   * 参数说明：包含报价差集明细、SQL、时间和权限口径。
   * 返回值说明：返回报价数量、金额和客户明细。
   * 调用注意事项：当前按同客户无有效订单判断，后续可升级为 `quote_id` 直接链路。
   */
  private buildQuoteWithoutOrderSlice(params: {
    rows: Array<Record<string, unknown>>;
    sql: string;
    temporalSlot?: AnalysisIntent['temporalSlot'];
    scopeSummary: string;
    businessRegionFilter?: BusinessRegionFilter;
  }): AnalysisDatasetSlice {
    const temporalScope = buildResultTemporalScope(params.temporalSlot);
    const quoteAmount = this.sumNumeric(params.rows, 'amount');
    return {
      datasetId: buildEntityId('dataset'),
      taskId: 'analysis-warehouse-quote-without-order',
      taskTitle: '有报价但未下单客户明细',
      resultKind: 'risk-overview',
      purpose: 'primary-summary',
      sql: params.sql,
      executionMode: 'GUARDED_DIRECT_QUERY',
      executionSource: 'ANALYSIS_WAREHOUSE',
      matchedAdapter: 'analysis-warehouse.fixed-quote-without-order',
      gapReason: '',
      summary:
        params.rows.length > 0
          ? `当前权限范围内共有 ${params.rows.length} 条报价尚未匹配到有效订单，报价金额合计 ${formatWanAmount(quoteAmount)}。`
          : '当前权限范围内未发现有报价但未下单的客户。',
      temporalScope,
      appliedFilters: this.buildTemplateAppliedFilters({
        scopeSummary: params.scopeSummary,
        temporalScope,
        businessRegionFilter: params.businessRegionFilter,
        statisticScopeLabel: '有报价且同客户未匹配到已确认/已完成订单；当前按客户兜底关联',
      }),
      metricCards: [
        { name: '未下单报价数', value: params.rows.length },
        { name: '未下单报价金额', value: formatWanAmount(quoteAmount) },
      ],
      primaryView: params.rows.length
        ? {
            viewType: 'DETAIL_TABLE',
            title: '有报价但未下单客户明细',
            rows: params.rows,
            columns: this.buildColumns(params.rows),
          }
        : undefined,
      secondaryViews: params.rows.length
        ? [
            {
              viewType: 'DETAIL_TABLE',
              title: '有报价但未下单客户明细',
              rows: params.rows,
              columns: this.buildColumns(params.rows),
            },
          ]
        : [],
      tableRows: params.rows,
      rowCount: params.rows.length,
    };
  }

  /**
   * 构造“客户报备未关联商机”专用结果切片。
   *
   * 参数说明：包含查询行、SQL、时间槽和权限摘要。
   * 返回值说明：返回数量、平均创建时长和明细表格。
   * 调用注意事项：结果口径是“客户报备记录未关联商机”，不是“全量客户未报备”。
   */
  private buildRegistrationWithoutOpportunitySlice(params: {
    rows: Array<Record<string, unknown>>;
    sql: string;
    temporalSlot?: AnalysisIntent['temporalSlot'];
    scopeSummary: string;
    businessRegionFilter?: BusinessRegionFilter;
  }): AnalysisDatasetSlice {
    const temporalScope = buildResultTemporalScope(params.temporalSlot);
    const createdDaysValues = params.rows
      .map((row) => Number(row.created_days))
      .filter((value) => Number.isFinite(value));
    const averageDays = createdDaysValues.length
      ? Math.round(createdDaysValues.reduce((sum, value) => sum + value, 0) / createdDaysValues.length)
      : 0;

    return {
      datasetId: buildEntityId('dataset'),
      taskId: 'analysis-warehouse-registration-without-opportunity',
      taskTitle: '客户报备未关联商机明细',
      resultKind: 'category-distribution',
      purpose: 'primary-summary',
      sql: params.sql,
      executionMode: 'GUARDED_DIRECT_QUERY',
      executionSource: 'ANALYSIS_WAREHOUSE',
      matchedAdapter: 'analysis-warehouse.fixed-registration-without-opportunity',
      gapReason: '',
      summary:
        params.rows.length > 0
          ? `当前权限范围内共有 ${params.rows.length} 条客户报备尚未关联商机，平均已创建 ${averageDays} 天。`
          : '当前权限范围内未发现尚未关联商机的客户报备。',
      temporalScope,
      appliedFilters: this.buildTemplateAppliedFilters({
        scopeSummary: params.scopeSummary,
        temporalScope,
        businessRegionFilter: params.businessRegionFilter,
        statisticScopeLabel: '客户报备记录未关联商机',
      }),
      metricCards: [
        { name: '未关联商机的客户报备数', value: params.rows.length },
        { name: '平均创建时长', value: `${averageDays} 天` },
      ],
      primaryView: params.rows.length
        ? {
            viewType: 'RANKING_TABLE',
            title: '客户报备未关联商机明细',
            rows: params.rows,
            columns: this.buildColumns(params.rows),
          }
        : undefined,
      secondaryViews: params.rows.length
        ? [
            {
              viewType: 'RANKING_TABLE',
              title: '客户报备未关联商机明细',
              rows: params.rows,
              columns: this.buildColumns(params.rows),
            },
          ]
        : [],
      tableRows: params.rows,
      rowCount: params.rows.length,
    };
  }

  /**
   * 构造“超两周未更新商机”专用结果切片。
   *
   * 参数说明：包含查询行、SQL、时间槽和权限摘要。
   * 返回值说明：返回停滞商机数量、金额和最长停滞天数。
   * 调用注意事项：这里展示的是当前权限范围内需要跟进的商机，不代表所有历史商机质量结论。
   */
  private buildStaleOpportunitySlice(params: {
    rows: Array<Record<string, unknown>>;
    sql: string;
    temporalSlot?: AnalysisIntent['temporalSlot'];
    scopeSummary: string;
    businessRegionFilter?: BusinessRegionFilter;
    thresholdDays: number;
    thresholdLabel: string;
  }): AnalysisDatasetSlice {
    const temporalScope = buildResultTemporalScope(params.temporalSlot);
    const totalAmount = this.sumNumeric(params.rows, 'amount');
    const analysisTitle = buildStaleOpportunityAnalysisTitle(params.thresholdLabel);
    const detailTitle = buildStaleOpportunityDetailTitle(params.thresholdLabel);
    const riskScopeText = buildStaleOpportunityRiskScopeText(params.thresholdDays);
    const maxStaleDays = Math.max(
      0,
      ...params.rows
        .map((row) => Number(row.stale_days))
        .filter((value) => Number.isFinite(value)),
    );

    return {
      datasetId: buildEntityId('dataset'),
      taskId: 'analysis-warehouse-stale-opportunity',
      taskTitle: analysisTitle,
      resultKind: 'risk-overview',
      purpose: 'primary-summary',
      sql: params.sql,
      executionMode: 'GUARDED_DIRECT_QUERY',
      executionSource: 'ANALYSIS_WAREHOUSE',
      matchedAdapter: 'analysis-warehouse.fixed-stale-opportunity',
      gapReason: '',
      summary:
        params.rows.length > 0
          ? `当前权限范围内共有 ${params.rows.length} 条商机${params.thresholdLabel}未更新，涉及商机金额 ${formatWanAmount(totalAmount)}，最长未更新 ${maxStaleDays} 天。风险口径：${riskScopeText}。`
          : `当前权限范围内未发现${params.thresholdLabel}未更新的商机。`,
      temporalScope,
      appliedFilters: this.buildTemplateAppliedFilters({
        scopeSummary: params.scopeSummary,
        temporalScope,
        businessRegionFilter: params.businessRegionFilter,
        statisticScopeLabel: '按商机更新时间识别未更新商机，用户输入的月份按 30 天换算',
        riskScopeLabel: riskScopeText,
        sortScopeLabel: buildStaleOpportunitySortScopeText(),
      }),
      metricCards: [
        { name: '超期商机数量', value: params.rows.length },
        { name: '涉及商机金额', value: formatWanAmount(totalAmount) },
        { name: '最长未更新天数', value: `${maxStaleDays} 天` },
      ],
      primaryView: params.rows.length
        ? {
            viewType: 'RANKING_TABLE',
            title: detailTitle,
            rows: params.rows,
            columns: this.buildColumns(params.rows),
          }
        : undefined,
      secondaryViews: params.rows.length
        ? [
            {
              viewType: 'RANKING_TABLE',
              title: detailTitle,
              rows: params.rows,
              columns: this.buildColumns(params.rows),
            },
          ]
        : [],
      tableRows: params.rows,
      rowCount: params.rows.length,
    };
  }

  /**
   * 构造“未活跃客户”专用结果切片。
   *
   * 参数说明：包含查询行、SQL、时间槽和权限摘要。
   * 返回值说明：返回未活跃客户数量和最长未活跃天数。
   * 调用注意事项：字段为空表示联软未提供最近活动记录，需在结果口径里如实展示。
   */
  private buildInactiveCustomerSlice(params: {
    rows: Array<Record<string, unknown>>;
    sql: string;
    temporalSlot?: AnalysisIntent['temporalSlot'];
    scopeSummary: string;
    businessRegionFilter?: BusinessRegionFilter;
  }): AnalysisDatasetSlice {
    const temporalScope = buildResultTemporalScope(params.temporalSlot);
    const maxInactiveDays = Math.max(
      0,
      ...params.rows
        .map((row) => Number(row.inactive_days))
        .filter((value) => Number.isFinite(value)),
    );

    return {
      datasetId: buildEntityId('dataset'),
      taskId: 'analysis-warehouse-inactive-customer',
      taskTitle: '最近 30 天未活跃客户明细',
      resultKind: 'risk-overview',
      purpose: 'primary-summary',
      sql: params.sql,
      executionMode: 'GUARDED_DIRECT_QUERY',
      executionSource: 'ANALYSIS_WAREHOUSE',
      matchedAdapter: 'analysis-warehouse.fixed-inactive-customer',
      gapReason: '',
      summary:
        params.rows.length > 0
          ? `当前权限范围内共有 ${params.rows.length} 个客户最近 30 天未活跃，最长未活跃 ${maxInactiveDays} 天。`
          : '当前权限范围内未发现最近 30 天未活跃的客户。',
      temporalScope,
      appliedFilters: this.buildTemplateAppliedFilters({
        scopeSummary: params.scopeSummary,
        temporalScope,
        businessRegionFilter: params.businessRegionFilter,
        statisticScopeLabel: '客户最近活动时间为空，或距离今天超过 30 天',
      }),
      metricCards: [
        { name: '未活跃客户数', value: params.rows.length },
        { name: '最长未活跃天数', value: `${maxInactiveDays} 天` },
      ],
      primaryView: params.rows.length
        ? {
            viewType: 'RANKING_TABLE',
            title: '最近 30 天未活跃客户明细',
            rows: params.rows,
            columns: this.buildColumns(params.rows),
          }
        : undefined,
      secondaryViews: params.rows.length
        ? [
            {
              viewType: 'RANKING_TABLE',
              title: '最近 30 天未活跃客户明细',
              rows: params.rows,
              columns: this.buildColumns(params.rows),
            },
          ]
        : [],
      tableRows: params.rows,
      rowCount: params.rows.length,
    };
  }

  /**
   * 构造“订单数量/金额汇总”专用结果切片。
   *
   * 参数说明：包含查询行、SQL、时间槽和权限摘要。
   * 返回值说明：返回有效订单数量、金额以及区域汇总表。
   * 调用注意事项：有效订单状态口径在 SQL 中固定，展示层只负责汇总已返回结果。
   */
  private buildOrderSummarySlice(params: {
    rows: Array<Record<string, unknown>>;
    sql: string;
    temporalSlot?: AnalysisIntent['temporalSlot'];
    scopeSummary: string;
    businessRegionFilter?: BusinessRegionFilter;
  }): AnalysisDatasetSlice {
    const temporalScope = buildResultTemporalScope(params.temporalSlot);
    const totalOrderCount = this.sumNumeric(params.rows, 'order_count');
    const totalOrderAmount = this.sumNumeric(params.rows, 'order_amount');

    return {
      datasetId: buildEntityId('dataset'),
      taskId: 'analysis-warehouse-order-summary',
      taskTitle: '有效订单区域汇总',
      resultKind: 'category-distribution',
      purpose: 'primary-summary',
      sql: params.sql,
      executionMode: 'GUARDED_DIRECT_QUERY',
      executionSource: 'ANALYSIS_WAREHOUSE',
      matchedAdapter: 'analysis-warehouse.fixed-order-summary',
      gapReason: '',
      summary:
        params.rows.length > 0
          ? `当前权限范围内有效订单 ${totalOrderCount} 单，订单金额合计 ${formatWanAmount(totalOrderAmount)}。`
          : '当前权限范围内未发现符合条件的有效订单。',
      temporalScope,
      appliedFilters: this.buildTemplateAppliedFilters({
        scopeSummary: params.scopeSummary,
        temporalScope,
        businessRegionFilter: params.businessRegionFilter,
        statisticScopeLabel: '有效订单数量和金额，排除取消、作废、驳回、删除状态',
      }),
      metricCards: [
        { name: '有效订单数量', value: totalOrderCount },
        { name: '有效订单金额', value: formatWanAmount(totalOrderAmount) },
      ],
      primaryView: params.rows.length
        ? {
            viewType: 'RANKING_TABLE',
            title: '有效订单区域汇总',
            rows: params.rows,
            columns: this.buildColumns(params.rows),
          }
        : undefined,
      secondaryViews: params.rows.length
        ? [
            {
              viewType: 'RANKING_TABLE',
              title: '有效订单区域汇总',
              rows: params.rows,
              columns: this.buildColumns(params.rows),
            },
          ]
        : [],
      tableRows: params.rows,
      rowCount: params.rows.length,
    };
  }

  /**
   * 标准化 MySQL 返回行。
   *
   * 参数说明：`row` 为 mysql2 返回的普通对象。
   * 返回值说明：返回可 JSON 序列化的对象。
   * 调用注意事项：DECIMAL 常以字符串返回，这里保留字符串并在指标计算时再安全转数值。
   */
  private normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        value instanceof Date ? value.toISOString() : value,
      ]),
    );
  }

  /**
   * 构造基础指标卡。
   *
   * 参数说明：`rows` 为查询结果行。
   * 返回值说明：返回最多 4 个关键指标。
   * 调用注意事项：聚合查询单行时优先展示该行数值；多行时展示行数和明显金额/数量字段汇总。
   */
  private buildMetricCards(rows: Array<Record<string, unknown>>): MetricCard[] {
    if (rows.length === 0) {
      return [{ name: '命中结果数', value: 0 }];
    }

    const numericKeys = this.resolveNumericKeys(rows);
    if (rows.length === 1 && numericKeys.length > 0) {
      return numericKeys.slice(0, 4).map((key) => ({
        name: this.toBusinessLabel(key),
        value: this.formatMetricValue(key, Number(rows[0][key])),
      }));
    }

    const cards: MetricCard[] = [{ name: '结果行数', value: rows.length }];
    const amountKey = numericKeys.find((key) => /amount|金额|money|total/iu.test(key));
    const countKey = numericKeys.find((key) => /count|数量|num|total/iu.test(key));
    if (amountKey) {
      cards.push({
        name: this.toBusinessLabel(amountKey),
        value: formatWanAmount(this.sumNumeric(rows, amountKey)),
      });
    }
    if (countKey && countKey !== amountKey) {
      cards.push({
        name: this.toBusinessLabel(countKey),
        value: this.sumNumeric(rows, countKey),
      });
    }
    return cards.slice(0, 4);
  }

  /**
   * 构造主结果视图。
   */
  private buildPrimaryView(
    taskTitle: string,
    rows: Array<Record<string, unknown>>,
  ): ResultView | undefined {
    if (rows.length === 0) {
      return undefined;
    }

    return {
      viewType: 'RANKING_TABLE',
      title: `${taskTitle}结果`,
      rows,
      columns: this.buildColumns(rows),
    };
  }

  /**
   * 根据结果行构造表格列。
   */
  private buildColumns(rows: Array<Record<string, unknown>>): Array<{ key: string; label: string }> {
    const firstRow = rows[0] ?? {};
    return Object.keys(firstRow).map((key) => ({
      key,
      label: this.toBusinessLabel(key),
    }));
  }

  /**
   * 识别可汇总的数值列。
   */
  private resolveNumericKeys(rows: Array<Record<string, unknown>>): string[] {
    const firstRow = rows[0] ?? {};
    return Object.keys(firstRow).filter((key) =>
      rows.some((row) => {
        const value = row[key];
        return value !== null && value !== '' && Number.isFinite(Number(value));
      }),
    );
  }

  /**
   * 汇总数值列。
   */
  private sumNumeric(rows: Array<Record<string, unknown>>, key: string): number {
    return rows.reduce((sum, row) => sum + (Number(row[key]) || 0), 0);
  }

  /**
   * 格式化指标值。
   */
  private formatMetricValue(key: string, value: number): string | number {
    if (/amount|金额|money/iu.test(key)) {
      return formatWanAmount(value);
    }
    return value;
  }

  /**
   * 格式化转化率。
   *
   * 参数说明：`numerator` 为分子数量，`denominator` 为分母数量。
   * 返回值说明：分母为 0 时返回 `0%`，否则保留一位小数。
   * 调用注意事项：仅用于展示，不参与后续 SQL 或权限判断。
   */
  private formatPercent(numerator: number, denominator: number): string {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
      return '0%';
    }

    return `${((numerator / denominator) * 100).toFixed(1)}%`;
  }

  /**
   * 将常见字段别名转为中文。
   */
  private toBusinessLabel(key: string): string {
    const labels: Record<string, string> = {
      partner_name: '服务商名称',
      partner_count: '服务商数量',
      customer_name: '客户名称',
      customer_count: '客户数量',
      opportunity_count: '商机数量',
      opportunity_amount: '商机金额',
      order_count: '订单数量',
      order_amount: '订单金额',
      registration_count: '报备数量',
      linked_opportunity_count: '已关联商机数',
      unlinked_registration_count: '未关联商机报备数',
      registration_to_opportunity_rate: '报备关联商机率',
      opportunity_to_order_rate: '商机到订单转化率',
      quote_count: '报价数量',
      amount: '金额',
      count: '数量',
      total_amount: '总金额',
      total_count: '总数量',
      region: '区域',
      big_region: '大区',
      created_at: '创建时间',
      source_updated_at: '更新时间',
      opportunity_id: '商机 ID',
      opportunity_name: '商机名称',
      customer_id: '客户 ID',
      partner_id: '服务商 ID',
      owner_name: '负责人',
      stage_name: '商机阶段',
      stale_days: '未更新天数',
      latest_activity_at: '最近活动时间',
      inactive_days: '未活跃天数',
      category_name: '客户分类',
      status_name: '状态',
      metric_name: '指标',
      metric_value: '数值',
      metric_note: '说明',
      registration_id: '报备 ID',
      created_days: '创建时长',
      quote_id: '报价 ID',
      order_id: '订单 ID',
      deal_at: '成交时间',
      assigned_staff_name: '分配人员',
      funnel_stage: '漏斗阶段',
      stage_count: '阶段数量',
      stage_amount: '阶段金额',
      conversion_rate: '转化率',
      stage_note: '口径说明',
      section_name: '报告区块',
      section_summary: '区块摘要',
      render_type: '呈现方式',
      row_count: '结果数量',
      month_label: '月份',
      new_partner_count: '新增渠道商数',
      new_opportunity_count: '新增商机数',
    };
    return labels[key] ?? key.replace(/_/gu, ' ');
  }

  /**
   * 合并多个模板指标卡并按名称去重。
   *
   * 参数说明：`groups` 为多个模板输出的指标卡列表，`limit` 为最多保留数量。
   * 返回值说明：返回名称不重复的指标卡数组。
   * 调用注意事项：优先保留靠前模板的指标，避免同一指标在企微关键指标区重复出现。
   */
  private mergeMetricCards(groups: MetricCard[][], limit: number): MetricCard[] {
    const cards: MetricCard[] = [];
    const names = new Set<string>();
    for (const group of groups) {
      for (const card of group) {
        if (names.has(card.name)) {
          continue;
        }

        cards.push(card);
        names.add(card.name);
        if (cards.length >= limit) {
          return cards;
        }
      }
    }

    return cards;
  }
}

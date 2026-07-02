import { Injectable } from '@nestjs/common';
import type {
  AnalysisDatasetSlice,
  AccessPolicyRecord,
  AnalysisDeliverySnapshot,
  AnalysisExecutionMode,
  AnalysisExecutionSnapshot,
  AnalysisExecutionSource,
  AnalysisRoute,
  AnalysisExecutionTraceSummary,
  AnalysisInsightSnapshot,
  AnalysisIntent,
  AnalysisMissingSection,
  AnalysisResultRecord,
  AnalysisResultBundleSnapshot,
  CrmUser,
  ScopeSnapshot,
} from '../../shared/types/domain';
import { DataFreshnessService } from './data-freshness.service';
import { QueryAstValidatorService } from './query-ast-validator.service';
import { QueryPreflightService } from './query-preflight.service';
import {
  type CompiledQueryTask,
  QueryCompilerService,
} from './query-compiler.service';
import { QueryRiskGuardService } from './query-risk-guard.service';
import { QueryScopeService } from './query-scope.service';
import { QueryWhitelistService } from './query-whitelist.service';
import { ResultConsistencyService } from './result-consistency.service';
import { ResultNormalizerService } from './result-normalizer.service';
import { ResultStreamerService } from './result-streamer.service';
import { AnalysisQueryPlannerService } from './analysis-query-planner.service';
import { AnalysisQueryExecutorService } from './analysis-query-executor.service';
import { AnalysisDatasetAssemblerService } from './analysis-dataset-assembler.service';
import { AnalysisReportComposerService } from './analysis-report-composer.service';
import {
  AnalysisReadToolRegistryService,
  type RoutedCompiledQueryTask,
} from './analysis-read-tool.registry';
import { AiGatewayService } from './ai-gateway.service';
import type { ChannelType } from '../../shared/types/domain';
import { AnalysisQueryKnowledgeService } from './analysis-query-knowledge.service';
import { AnalysisRichReportService } from './analysis-rich-report.service';
import { resolveCrmAnalysisQuestionTemplateRuleByText } from './crm-analysis-question-template.registry';
import { SqlAuditContextService } from '../audit/sql-audit-context.service';
import { SqlAuditService } from '../audit/sql-audit.service';
import {
  OpenApiCapabilityGapError,
  QueryPreflightError,
  RealDataUnavailableError,
} from './analysis.errors';
import {
  AnalysisWarehouseAnalysisExecutorService,
} from './analysis-warehouse-analysis-executor.service';

type BusinessChainSnapshotResource = 'partners' | 'registrations' | 'opportunities' | 'quotes' | 'orders';

interface BusinessChainObjectSignals {
  hasPartner: boolean;
  hasRegistration: boolean;
  hasOpportunity: boolean;
  hasOrder: boolean;
}

@Injectable()
export class AnalysisWorkflowOrchestrator {
  constructor(
    private readonly queryScopeService: QueryScopeService,
    private readonly analysisQueryPlannerService: AnalysisQueryPlannerService,
    private readonly queryCompilerService: QueryCompilerService,
    private readonly queryRiskGuardService: QueryRiskGuardService,
    private readonly queryWhitelistService: QueryWhitelistService,
    private readonly queryAstValidatorService: QueryAstValidatorService,
    private readonly queryPreflightService: QueryPreflightService,
    private readonly analysisQueryExecutorService: AnalysisQueryExecutorService,
    private readonly analysisDatasetAssemblerService: AnalysisDatasetAssemblerService,
    private readonly analysisReportComposerService: AnalysisReportComposerService,
    private readonly resultNormalizerService: ResultNormalizerService,
    private readonly resultStreamerService: ResultStreamerService,
    private readonly resultConsistencyService: ResultConsistencyService,
    private readonly dataFreshnessService: DataFreshnessService,
    private readonly analysisReadToolRegistryService: AnalysisReadToolRegistryService,
    private readonly analysisQueryKnowledgeService: AnalysisQueryKnowledgeService,
    private readonly analysisRichReportService: AnalysisRichReportService,
    private readonly analysisWarehouseAnalysisExecutorService: AnalysisWarehouseAnalysisExecutorService,
    private readonly aiGatewayService: AiGatewayService,
    private readonly sqlAuditContextService: SqlAuditContextService,
    private readonly sqlAuditService: SqlAuditService,
  ) {}

  private isQueryKnowledgeEnabled(): boolean {
    return process.env.ANALYSIS_QUERY_KNOWLEDGE_ENABLED !== 'false';
  }

  private isMarkdownDeliveryEnabled(): boolean {
    return process.env.ANALYSIS_MARKDOWN_DELIVERY_ENABLED !== 'false';
  }

  async run(params: {
    requestId: string;
    questionText: string;
    channel: 'web-console' | 'wecom-bot';
    user: CrmUser;
    intent: AnalysisIntent;
    scopeSnapshot: ScopeSnapshot;
    policy: AccessPolicyRecord;
    executionMode?: AnalysisExecutionMode;
    analysisRoute?: AnalysisRoute;
  }): Promise<{
    result: AnalysisResultRecord;
    compiledTasks: CompiledQueryTask[];
    generatedQueryText: string;
    analysisRoute: AnalysisRoute;
    executionMode: AnalysisExecutionMode;
    executionSource: AnalysisExecutionSource;
    preferredSource: AnalysisExecutionSource;
    matchedAdapter?: string;
    gapReason?: string;
    executionSnapshot: AnalysisExecutionSnapshot;
    resultBundleSnapshot: AnalysisResultBundleSnapshot;
    insightSnapshot: AnalysisInsightSnapshot;
    deliverySnapshot: AnalysisDeliverySnapshot;
  }> {
    const executionMode = params.executionMode ?? 'PLAN_EXECUTION';
    const analysisRoute = params.analysisRoute ?? 'OPENAPI';
    this.ensureFormalAnalysisRouteEnabled(analysisRoute);
    const scopedIntent = this.queryScopeService.injectScope(
      params.intent,
      params.scopeSnapshot,
    );
    const knowledgeContext = this.isQueryKnowledgeEnabled()
      ? this.analysisQueryKnowledgeService.buildKnowledgeContext(params.questionText)
      : undefined;
    const workflow = this.analysisQueryPlannerService.buildWorkflow(
      params.questionText,
      scopedIntent,
      params.channel,
    );
    await this.ensureWarehouseDisabledForFormalMainline();
    const effectiveExecutionMode: AnalysisExecutionMode = executionMode;
    const directQueryTasks = executionMode === 'GUARDED_DIRECT_QUERY'
      ? await this.buildControlledDirectQueryTasks({
          questionText: params.questionText,
          channel: params.channel,
          intent: scopedIntent,
          knowledgeContextText: knowledgeContext
            ? this.analysisQueryKnowledgeService.formatKnowledgeContext(knowledgeContext)
            : undefined,
          baseTasks: workflow.tasks,
        })
      : null;
    const routedTasks: RoutedCompiledQueryTask[] = (directQueryTasks
      ? directQueryTasks
      : this.queryCompilerService.compileTasks(workflow.tasks)
    ).map((compiledTask) => ({
      ...compiledTask,
      ...this.analysisReadToolRegistryService.resolveReadRoute(
        compiledTask,
        executionMode,
        analysisRoute,
      ),
    }));

    const slices: AnalysisDatasetSlice[] = [];
    const missingSections: AnalysisMissingSection[] = [];
    const businessChainSnapshotResources = this.resolveBusinessChainSnapshotResources(
      params.questionText,
      scopedIntent,
      routedTasks,
    );
    if (businessChainSnapshotResources.length > 0) {
      await this.executeBusinessChainSnapshotMainline({
        questionText: params.questionText,
        user: params.user,
        scopeSummary: scopedIntent.scopeSummary,
        policy: params.policy,
        routedTasks,
        resources: businessChainSnapshotResources,
        slices,
      });
    } else {
      for (const compiledTask of routedTasks) {
        let reachedExecuteStep = false;
        try {
          await this.sqlAuditContextService.run(
            {
              moduleKey: 'analysis-workbench',
              programName: 'AnalysisWorkflowOrchestrator.executeTask',
              executionSource: compiledTask.executionSource ?? 'CRM_OFFICIAL_API',
              matchedAdapter: compiledTask.matchedAdapter,
            },
            async () => {
              if (compiledTask.executionSource === 'CRM_OFFICIAL_API') {
                reachedExecuteStep = true;
                this.queryWhitelistService.ensureAllowed(
                  compiledTask.tables,
                  compiledTask.fieldMap,
                  params.policy,
                );

                slices.push(
                  await this.analysisQueryExecutorService.executeTask(
                    params.questionText,
                    params.user,
                    scopedIntent.scopeSummary,
                    compiledTask,
                  ),
                );
                return;
              }

              throw new OpenApiCapabilityGapError(
                `当前正式 CRM 分析主链只允许通过 OpenAPI Markdown 快照读取本地真实明细，“${compiledTask.taskTitle}”被路由到非快照主链来源，系统已阻断执行。请先补齐快照文件、资源字段或适配器后再执行。`,
              );
            },
          );
        } catch (error) {
          if (this.shouldRecordBlockedSql(error, reachedExecuteStep)) {
            this.sqlAuditService.recordBlocked({
              sql: compiledTask.sql,
              params: compiledTask.params,
              databaseRole: 'CRM_READONLY',
              moduleKey: 'analysis-workbench',
              programName: 'AnalysisWorkflowOrchestrator.blockedTask',
              blockedReason:
                error instanceof Error ? error.message : 'analysis-sql-blocked',
            });
          }

          if (compiledTask.required) {
            throw error;
          }

          missingSections.push({
            sectionType: compiledTask.reportSection ?? 'detail-table',
            title: compiledTask.taskTitle,
            reason: error instanceof Error ? error.message : 'optional-task-failed',
            taskId: compiledTask.taskId,
          });
        }
      }
    }

    const datasetBundle = this.analysisDatasetAssemblerService.assemble(
      workflow.workflowId,
      scopedIntent.scopeSummary,
      slices,
      missingSections,
    );
    const report = this.analysisReportComposerService.compose(workflow, datasetBundle);
    const consistencyToken = this.resultConsistencyService.buildToken(
      params.requestId,
      datasetBundle.mergedRows,
      report.metricCards,
      report.temporalScope,
    );
    const normalizedResult = this.resultNormalizerService.normalize({
      requestId: params.requestId,
      report,
      dataFreshnessAt: this.dataFreshnessService.getFreshnessAt(),
      consistencyToken,
    });
    const executionSnapshot = this.buildExecutionSnapshot({
      analysisRoute,
      executionMode: effectiveExecutionMode,
      scopeSnapshot: params.scopeSnapshot,
      compiledTasks: routedTasks,
      executedSlices: slices,
      fallbackReason:
        executionMode === 'GUARDED_DIRECT_QUERY' && !directQueryTasks
          ? 'ai-unavailable-or-invalid'
          : undefined,
    });
    const resultBundleSnapshot = this.buildResultBundleSnapshot(
      normalizedResult,
      report,
    );
    const executionTraceSummary = this.buildExecutionTraceSummary({
      normalizedQuestion: workflow.normalizedQuestion,
      knowledgeContext,
      routedTasks,
      executionSnapshot,
      consistencyToken,
      datasetReferences: report.datasetReferences,
    });
    const insight = await this.buildGroundedInsight(normalizedResult);
    const insightSnapshot = this.buildInsightSnapshot(insight);
    const deliverySnapshot = this.buildDeliverySnapshot(
      params.channel,
      normalizedResult,
    );

    normalizedResult.executionMode = effectiveExecutionMode;
    normalizedResult.questionText = params.questionText;
    normalizedResult.analysisRoute = analysisRoute;
    normalizedResult.executionSource = executionSnapshot.executionSource;
    normalizedResult.preferredSource = executionSnapshot.preferredSource;
    normalizedResult.matchedAdapter = executionSnapshot.matchedAdapter;
    normalizedResult.gapReason = executionSnapshot.gapReason;
    normalizedResult.executionSnapshot = executionSnapshot;
    normalizedResult.executionTraceSummary = executionTraceSummary;
    normalizedResult.resultBundleSnapshot = resultBundleSnapshot;
    normalizedResult.insightSnapshot = insightSnapshot;
    normalizedResult.deliverySnapshot = deliverySnapshot;
    normalizedResult.groundedExplanation = insight.groundedExplanation;
    normalizedResult.nextBestQuestions = insight.nextBestQuestions;
    normalizedResult.report = {
      ...normalizedResult.report,
      executionTraceSummary,
      groundedExplanation: insight.groundedExplanation,
      nextBestQuestions: insight.nextBestQuestions,
    };

    normalizedResult.streamBlocks = this.resultStreamerService.buildBlocks(
      normalizedResult,
      {
        normalizedQuestion: workflow.normalizedQuestion,
        scopeSummary: scopedIntent.scopeSummary,
        taskTitles: workflow.tasks.map((item) => item.title),
        datasetCount: datasetBundle.slices.length,
        validationSummary: [
          `已完成 ${effectiveExecutionMode === 'GUARDED_DIRECT_QUERY' ? '受控直查' : '计划执行'} 的 OpenAPI Markdown 快照路由校验、字段白名单校验和权限范围注入。`,
          '已完成统一数据集组装与关键指标回算。',
        ],
      },
    );
    this.resultConsistencyService.ensureConsistent(normalizedResult);

    return {
      result: normalizedResult,
      compiledTasks: routedTasks,
      generatedQueryText: this.buildGeneratedQueryText(routedTasks, slices),
      analysisRoute,
      executionMode: effectiveExecutionMode,
      executionSource: executionSnapshot.executionSource,
      preferredSource: executionSnapshot.preferredSource,
      matchedAdapter: executionSnapshot.matchedAdapter,
      gapReason: executionSnapshot.gapReason,
      executionSnapshot,
      resultBundleSnapshot,
      insightSnapshot,
      deliverySnapshot,
    };
  }

  /**
   * 执行业务链 Markdown 快照主链。
   *
   * 参数说明：
   * - `questionText/user/scopeSummary/policy`：请求原文、当前用户、权限摘要和白名单策略；
   * - `routedTasks`：已完成快照主链路由的计划任务；
   * - `resources`：本次需要读取的 Markdown 快照资源；
   * - `slices`：编排器统一结果切片数组，由本方法追加业务链快照切片。
   * 返回值说明：无返回值，成功时向 `slices` 追加一个正式业务链数据集。
   * 调用注意事项：这里仍会校验所有计划任务必须进入正式 CRM 主链，并执行字段白名单校验；不会调用 SQLite/MySQL 执行器。
   */
  private async executeBusinessChainSnapshotMainline(params: {
    questionText: string;
    user: CrmUser;
    scopeSummary: string;
    policy: AccessPolicyRecord;
    routedTasks: RoutedCompiledQueryTask[];
    resources: BusinessChainSnapshotResource[];
    slices: AnalysisDatasetSlice[];
  }): Promise<void> {
    let reachedExecuteStep = false;
    const primaryTask = params.routedTasks[0];
    try {
      await this.sqlAuditContextService.run(
        {
          moduleKey: 'analysis-workbench',
          programName: 'AnalysisWorkflowOrchestrator.executeBusinessChainSnapshot',
          executionSource: 'OPENAPI_MARKDOWN_SNAPSHOT',
          matchedAdapter: 'openapi-markdown-snapshot.business-chain',
        },
        async () => {
          for (const routedTask of params.routedTasks) {
            if (routedTask.executionSource !== 'CRM_OFFICIAL_API') {
              throw new OpenApiCapabilityGapError(
                `当前正式 CRM 业务链主链只允许通过 OpenAPI Markdown 快照读取本地真实明细，“${routedTask.taskTitle}”被路由到非快照主链来源，系统已阻断执行。请先补齐快照文件、资源字段或适配器后再执行。`,
              );
            }

            this.queryWhitelistService.ensureAllowed(
              routedTask.tables,
              routedTask.fieldMap,
              params.policy,
            );
          }

          reachedExecuteStep = true;
          params.slices.push(
            await this.analysisQueryExecutorService.executeBusinessChainSnapshot({
              questionText: params.questionText,
              user: params.user,
              scopeSummary: params.scopeSummary,
              temporalSlot: this.resolveBusinessChainTemporalSlot(params.routedTasks),
              resources: params.resources,
              taskId: 'crm-openapi-business-chain-snapshot',
              taskTitle: this.resolveBusinessChainSnapshotTaskTitle(params.resources, params.questionText),
            }),
          );
        },
      );
    } catch (error) {
      if (primaryTask && this.shouldRecordBlockedSql(error, reachedExecuteStep)) {
        this.sqlAuditService.recordBlocked({
          sql: primaryTask.sql,
          params: primaryTask.params,
          databaseRole: 'CRM_READONLY',
          moduleKey: 'analysis-workbench',
          programName: 'AnalysisWorkflowOrchestrator.blockedBusinessChainSnapshot',
          blockedReason: error instanceof Error ? error.message : 'analysis-sql-blocked',
        });
      }

      throw error;
    }
  }

  /**
   * 解析业务链快照需要读取的 OpenAPI 资源。
   *
   * 参数说明：`questionText` 为用户原文，`intent` 为已注入权限的业务意图，`routedTasks` 为计划任务。
   * 返回值说明：命中业务链主链时返回资源列表；未命中时返回空数组。
   * 调用注意事项：规则只负责把已识别的业务对象落到固定 OpenAPI 主链，不生成 SQL，也不承担主语义解析。
   */
  private resolveBusinessChainSnapshotResources(
    questionText: string,
    intent: AnalysisIntent,
    routedTasks: RoutedCompiledQueryTask[],
  ): BusinessChainSnapshotResource[] {
    const templateDrivenResources =
      this.resolveTemplateDrivenBusinessChainSnapshotResources(questionText);
    if (templateDrivenResources.length > 0) {
      return templateDrivenResources;
    }

    const signals = this.resolveBusinessChainObjectSignals(questionText, intent);
    const hasPlannerCompositeTask = routedTasks.some((task) =>
      /合作伙伴开拓情况|客户报备情况|客户商机及渠道商维度|订单情况及渠道商贡献/u.test(
        task.taskTitle,
      ),
    );
    const isSpecializedTrendOrRanking =
      !hasPlannerCompositeTask &&
      (/(趋势|走势|排名|排行|top\s*\d+)/iu.test(questionText) ||
        routedTasks.some((task) => task.resultKind === 'time-trend' || task.resultKind === 'owner-ranking'));
    const isRiskOrStaleOpportunityQuestion =
      !hasPlannerCompositeTask &&
      (/(没有进展|没进展|未进展|停滞|未更新|无跟进|风险|超期|逾期)/u.test(questionText) ||
        routedTasks.some(
          (task) =>
            task.resultKind === 'risk-overview' &&
            /(没有进展|没进展|未进展|停滞|未更新|无跟进|风险|超期|逾期)/u.test(task.taskTitle),
        ));

    if (this.isBusinessFunnelQuestion(questionText)) {
      return ['registrations', 'opportunities', 'quotes', 'orders'];
    }

    if (this.isChannelContributionRankingQuestion(questionText)) {
      return ['partners', 'registrations', 'opportunities', 'quotes', 'orders'];
    }

    if (this.isOrderFulfillmentComparisonQuestion(questionText)) {
      return ['partners', 'registrations', 'opportunities', 'quotes', 'orders'];
    }

    if (this.isOpportunityPeriodOrRegionComparisonQuestion(questionText, signals)) {
      return ['partners', 'opportunities'];
    }

    if (isSpecializedTrendOrRanking || isRiskOrStaleOpportunityQuestion) {
      return [];
    }

    const shouldExpandPartnerOperating =
      signals.hasPartner && this.isPartnerOperatingChainQuestion(questionText);
    const shouldUseBusinessChainSnapshot =
      shouldExpandPartnerOperating ||
      (
        hasPlannerCompositeTask &&
        signals.hasPartner &&
        signals.hasOrder &&
        (signals.hasRegistration || signals.hasOpportunity)
      );
    if (!shouldUseBusinessChainSnapshot) {
      return [];
    }

    const resources: BusinessChainSnapshotResource[] = [];
    const add = (resource: BusinessChainSnapshotResource) => {
      if (!resources.includes(resource)) {
        resources.push(resource);
      }
    };

    if (signals.hasPartner) {
      add('partners');
    }
    if (signals.hasRegistration || shouldExpandPartnerOperating) {
      add('partners');
      add('registrations');
    }
    if (signals.hasOpportunity || signals.hasRegistration || shouldExpandPartnerOperating) {
      add('partners');
      add('opportunities');
    }
    if (signals.hasOrder || shouldExpandPartnerOperating) {
      add('partners');
      add('orders');
    }

    return resources;
  }

  /**
   * 按 300 问标准模板优先选择本地 OpenAPI Markdown 快照资源。
   *
   * 参数说明：`questionText` 为用户原始问题。
   * 返回值说明：命中 300 问目录中需要跨对象核对的模板时，返回固定资源集合；未命中返回空数组。
   * 可能抛出的异常：无。
   * 调用注意事项：该方法只决定“读取哪些真实快照明细”，不改变权限、白名单或任何事实口径。
   */
  private resolveTemplateDrivenBusinessChainSnapshotResources(
    questionText: string,
  ): BusinessChainSnapshotResource[] {
    const catalogRule = resolveCrmAnalysisQuestionTemplateRuleByText(questionText);
    if (!catalogRule) {
      return [];
    }

    const fullBusinessChain: BusinessChainSnapshotResource[] = [
      'partners',
      'registrations',
      'opportunities',
      'quotes',
      'orders',
    ];
    const opportunityToOrderChain: BusinessChainSnapshotResource[] = [
      'partners',
      'opportunities',
      'quotes',
      'orders',
    ];

    switch (catalogRule.templateType) {
      case 'BUSINESS_OVERVIEW':
      case 'FUNNEL_DIAGNOSIS':
      case 'REGION_COMPARISON':
      case 'CHANNEL_RANKING':
      case 'CHANNEL_PROFILE':
      case 'DISTRIBUTION_HIERARCHY':
      case 'TECH_SERVICE_ECOSYSTEM':
      case 'REGISTRATION_PROTECTION':
      case 'OPERATING_CADENCE':
      case 'OWNER_ORG_COLLABORATION':
      case 'ALERT_AUDIT_GOVERNANCE':
      case 'DATA_SCOPE_QUALITY':
      case 'CUSTOMER_SUCCESS_RENEWAL':
        return fullBusinessChain;
      case 'OPPORTUNITY_RISK':
      case 'QUOTE_ORDER_CONVERSION':
      case 'PRODUCT_SOLUTION_STRUCTURE':
        return opportunityToOrderChain;
      default:
        return [];
    }
  }

  /**
   * 解析业务链对象信号。
   *
   * 参数说明：`questionText` 为用户原文，`intent` 为已注入权限的结构化意图。
   * 返回值说明：返回伙伴、报备、商机、订单四类对象是否被明确问到。
   * 调用注意事项：正式执行选择必须以用户原文为主；任务标题、维度和指标不能反向扩大对象，避免单商机问题误走综合经营快照。
   */
  private resolveBusinessChainObjectSignals(
    questionText: string,
    intent: AnalysisIntent,
  ): BusinessChainObjectSignals {
    const explicitSignals: BusinessChainObjectSignals = {
      hasPartner: /(合作伙伴|服务商|渠道商|渠道|代理商|经销商|伙伴)/u.test(questionText),
      hasRegistration: /(客户商机报备|客户报备|报备情况|报备)/u.test(questionText),
      hasOpportunity: /(商机|机会)/u.test(questionText),
      hasOrder: /(订单|下单|成单|签单|成交)/u.test(questionText),
    };
    const explicitObjectCount = Object.values(explicitSignals).filter(Boolean).length;
    if (explicitObjectCount > 0) {
      return explicitSignals;
    }

    const objectTypes = new Set(intent.businessIntentHint?.objectTypes ?? []);
    return {
      hasPartner: objectTypes.has('partner'),
      hasRegistration: objectTypes.has('registration'),
      hasOpportunity: objectTypes.has('opportunity'),
      hasOrder: objectTypes.has('order') || objectTypes.has('contract'),
    };
  }

  /**
   * 判断是否为渠道商经营链路问题。
   *
   * 参数说明：`questionText` 为用户原文。
   * 返回值说明：只在用户明确问渠道商经营、贡献、业绩或下单情况时返回 true。
   * 调用注意事项：服务商开拓、画像、等级和状态不自动扩展为客户报备、商机、订单全链路。
   */
  private isPartnerOperatingChainQuestion(questionText: string): boolean {
    const hasPartnerSubject = /(合作伙伴|服务商|渠道商|渠道|代理商|经销商|伙伴)/u.test(questionText);
    const hasOperatingSignal = /(经营|运营|贡献|业绩|产出|整体情况|经营情况|业务情况|下单情况)/u.test(
      questionText,
    );
    const isProfileOnly = /(开拓|拓展|发展|开发|画像|等级|级别|状态|技术服务商)/u.test(
      questionText,
    ) && !/(商机|报备|订单|下单|成交|贡献|业绩|经营|运营)/u.test(questionText);

    return hasPartnerSubject && hasOperatingSignal && !isProfileOnly;
  }

  /**
   * 判断是否为商机跨周期或区域对比问题。
   *
   * 参数说明：`questionText` 为用户原文，`signals` 为业务对象信号。
   * 返回值说明：用户明确问商机且包含季度、区域、大区或对比表达时返回 true。
   * 调用注意事项：该类问题需要渠道商主数据补区域字段，因此固定读取 partners + opportunities。
   */
  private isOpportunityPeriodOrRegionComparisonQuestion(
    questionText: string,
    signals: BusinessChainObjectSignals,
  ): boolean {
    return signals.hasOpportunity &&
      /(对比|比较|差异|相比|分别|季度|按季|一季度|二季度|三季度|四季度|Q[1-4]|区域|大区|大北|大东|大南|大西)/iu.test(
        questionText,
      );
  }

  /**
   * 识别报备、商机、报价、订单转化漏斗问题。
   *
   * 参数说明：`questionText` 为用户原始问题。
   * 返回值说明：命中漏斗或主链路转化语义时返回 `true`。
   * 调用注意事项：这里只选择固定快照资源，不重新解析自然语言条件。
   */
  private isBusinessFunnelQuestion(questionText: string): boolean {
    return /(漏斗|转化率|转化漏斗|流失|断点|报备到订单|报备到商机|商机到报价|报价到订单)/u.test(
      questionText,
    );
  }

  /**
   * 识别渠道商贡献排行问题。
   *
   * 参数说明：`questionText` 为用户原始问题。
   * 返回值说明：同时包含渠道主语和贡献/排行语义时返回 `true`。
   * 调用注意事项：命中后进入业务链快照，确保排行维度是渠道商而不是经营区块。
   */
  private isChannelContributionRankingQuestion(questionText: string): boolean {
    return /(渠道|渠道商|服务商|代理商|经销商|伙伴)/u.test(questionText) &&
      /(贡献|业绩|产出|订单金额|商机金额|排行|排名|前\s*(三|3|五|5|十|10)|top\s*\d+)/iu.test(questionText);
  }

  /**
   * 识别订单承接对比问题。
   *
   * 参数说明：`questionText` 为用户原始问题。
   * 返回值说明：同时包含订单承接/成交和对比语义时返回 true。
   * 调用注意事项：订单承接必须拉通商机、报价、订单和渠道商，否则只能看到订单孤立汇总。
   */
  private isOrderFulfillmentComparisonQuestion(questionText: string): boolean {
    return /(订单承接|订单|下单|成单|签单|成交)/u.test(questionText) &&
      /(对比|比较|差异|相比|分别|季度|按季|一季度|二季度|三季度|四季度|Q[1-4]|区域|大区|大北|大东|大南|大西)/iu.test(
        questionText,
      );
  }

  /**
   * 解析业务链快照时间口径。
   *
   * 参数说明：`routedTasks` 为已路由任务。
   * 返回值说明：返回首个任务携带的标准时间槽。
   * 调用注意事项：组合任务应共享同一时间槽；这里不重新解析自然语言，避免执行口径漂移。
   */
  private resolveBusinessChainTemporalSlot(
    routedTasks: RoutedCompiledQueryTask[],
  ): AnalysisIntent['temporalSlot'] | undefined {
    return routedTasks.find((task) => task.plan.temporalSlot)?.plan.temporalSlot;
  }

  /**
   * 解析业务链快照主标题。
   *
   * 参数说明：`resources` 为本次读取资源。
   * 返回值说明：返回用户可见的主任务标题。
   * 调用注意事项：标题只描述业务对象，不暴露快照、fallback 或内部适配器名称。
   */
  private resolveBusinessChainSnapshotTaskTitle(
    resources: BusinessChainSnapshotResource[],
    questionText = '',
  ): string {
    const hasPartner = resources.includes('partners');
    const hasRegistration = resources.includes('registrations');
    const hasOpportunity = resources.includes('opportunities');
    const hasOrder = resources.includes('orders');
    if (
      hasPartner &&
      hasOpportunity &&
      !hasRegistration &&
      !hasOrder &&
      /(对比|比较|差异|相比|分别|季度|按季|一季度|二季度|三季度|四季度|Q[1-4]|区域|大区|大北|大东|大南|大西)/iu.test(questionText)
    ) {
      return '大区商机季度对比分析';
    }
    if (hasPartner && hasRegistration && hasOpportunity && hasOrder) {
      return '合作伙伴开拓、客户报备、商机与订单经营分析';
    }
    if (hasPartner && hasOpportunity && hasOrder) {
      return '渠道商、商机与订单经营分析';
    }
    if (hasPartner && hasRegistration && hasOpportunity) {
      return '合作伙伴、客户报备与商机分析';
    }
    if (hasPartner && hasOpportunity) {
      return '商机及渠道商经营分析';
    }
    if (hasPartner && hasOrder) {
      return '订单及渠道商贡献分析';
    }
    if (hasPartner && hasRegistration) {
      return '客户报备及渠道商分析';
    }

    return '联软 CRM 业务链经营分析';
  }

  /**
   * 生成本次实际执行查询摘要。
   *
   * 参数说明：`routedTasks` 为计划任务，`slices` 为实际执行出的数据切片。
   * 返回值说明：业务链快照返回快照摘要；普通任务返回实际执行切片中的快照读取摘要。
   * 调用注意事项：摘要只用于审计和排障，不包含任何 token、密钥或个人敏感配置。
   */
  private buildGeneratedQueryText(
    routedTasks: RoutedCompiledQueryTask[],
    slices: AnalysisDatasetSlice[],
  ): string {
    const businessChainSnapshot = slices.find(
      (slice) => /business-chain-snapshot/u.test(slice.matchedAdapter ?? ''),
    );
    if (businessChainSnapshot) {
      return businessChainSnapshot.sql;
    }

    if (slices.length > 0) {
      return slices
        .map((slice) =>
          [
            `-- ${slice.taskTitle} [${slice.purpose}]`,
            `-- source: ${slice.executionSource}`,
            ...(slice.matchedAdapter ? [`-- adapter: ${slice.matchedAdapter}`] : []),
            slice.sql,
          ].join('\n'),
        )
        .join('\n\n');
    }

    return routedTasks
      .map((item) =>
        item.executionSource === 'CRM_OFFICIAL_API'
          ? `-- ${item.taskTitle} [${item.purpose}]\n-- OpenAPI Markdown 快照 /${item.tables.join(', /') || 'crm'}\n-- adapter: ${item.matchedAdapter ?? 'openapi-markdown-snapshot'}\n-- resultKind: ${item.resultKind}`
          : `-- ${item.taskTitle} [${item.purpose}]\n${item.sql}`,
      )
      .join('\n\n');
  }

  /**
   * 正式 CRM 分析主链显式停用 SQLite/MySQL 分析库抢跑。
   *
   * 返回值说明：无返回值，当前请求必须继续走 OpenAPI 路由。
   * 调用注意事项：分析库执行器仍保留给治理诊断和离线验证，不能在正式问数链路自动启用。
   */
  private async ensureWarehouseDisabledForFormalMainline(): Promise<void> {
    void this.analysisWarehouseAnalysisExecutorService;
  }

  /**
   * 校验正式问答主链路线。
   *
   * 参数说明：`analysisRoute` 为入口或历史记录传入的路线。
   * 返回值说明：OpenAPI Markdown 快照路线直接通过。
   * 可能抛出的异常：传入 SQLite、MySQL 或受控 SQL 等历史路线时抛出能力缺口，防止兜底链路抢跑。
   * 调用注意事项：数据刷新链仍由 OpenAPI Markdown 快照服务负责，本方法只约束用户问答分析主链。
   */
  private ensureFormalAnalysisRouteEnabled(analysisRoute: AnalysisRoute): void {
    if (analysisRoute === 'OPENAPI') {
      return;
    }

    throw new OpenApiCapabilityGapError(
      '当前正式分析只启用 OpenAPI Markdown 快照主链，SQLite、MySQL、受控 SQL 等历史兜底路线已临时停用。',
    );
  }

  private buildExecutionSnapshot(params: {
    analysisRoute: AnalysisRoute;
    executionMode: AnalysisExecutionMode;
    scopeSnapshot: ScopeSnapshot;
    fallbackReason?: string;
    executedSlices?: AnalysisDatasetSlice[];
    compiledTasks: Array<CompiledQueryTask & {
      executionSource?: AnalysisExecutionSource;
      preferredSource?: AnalysisExecutionSource;
      matchedAdapter?: string;
      gapReason?: string;
      toolSpec?: {
        toolId: string;
        allowedStatements: string[];
        outputShape: string;
      };
    }>;
  }): AnalysisExecutionSnapshot {
    const primaryTask = params.compiledTasks[0];
    const primarySlice = params.executedSlices?.[0];
    const primarySource = primarySlice?.executionSource ?? primaryTask?.executionSource ?? 'CRM_OFFICIAL_API';
    return {
      analysisRoute: params.analysisRoute,
      executionMode: params.executionMode,
      executionSource: primarySource,
      preferredSource: primaryTask?.preferredSource ?? 'CRM_OFFICIAL_API',
      matchedAdapter: primarySlice?.matchedAdapter ?? primaryTask?.matchedAdapter,
      gapReason: primarySlice?.gapReason ?? primaryTask?.gapReason,
      fallbackReason: params.fallbackReason,
      scopeSnapshot: params.scopeSnapshot,
      taskSnapshots: params.compiledTasks.map((item) => ({
        taskId: item.taskId,
        taskTitle: item.taskTitle,
        temporalSlot: item.plan.temporalSlot,
        executionSource: item.executionSource ?? 'CRM_OFFICIAL_API',
        matchedAdapter: item.matchedAdapter,
        gapReason: item.gapReason,
        rowLimit: item.rowLimit,
        timeoutMs: item.timeoutMs,
        tables: item.tables,
        toolId: item.toolSpec?.toolId,
        allowedStatements: item.toolSpec?.allowedStatements,
        outputShape: item.toolSpec?.outputShape,
      })),
      createdAt: new Date().toISOString(),
    };
  }

  private buildExecutionTraceSummary(params: {
    normalizedQuestion: string;
    knowledgeContext?: {
      knowledgeHits: Array<{
        assetId: string;
        assetType: AnalysisExecutionTraceSummary['knowledgeHits'][number]['assetType'];
        source: 'PUBLISHED_ASSET' | 'STATIC_FALLBACK' | 'GOVERNED_TEMPLATE';
        name: string;
        detail?: string;
      }>;
      blockedReason?: string;
    };
    routedTasks: Array<
      CompiledQueryTask & {
        executionSource?: AnalysisExecutionSource;
        preferredSource?: AnalysisExecutionSource;
        matchedAdapter?: string;
        gapReason?: string;
      }
    >;
    executionSnapshot: AnalysisExecutionSnapshot;
    consistencyToken: string;
    datasetReferences: AnalysisResultRecord['report']['datasetReferences'];
  }): AnalysisExecutionTraceSummary {
    return {
      normalizedQuestion: params.normalizedQuestion,
      consistencyToken: params.consistencyToken,
      fallbackReason: params.executionSnapshot.fallbackReason,
      blockedReason: params.knowledgeContext?.blockedReason,
      knowledgeHits:
        params.knowledgeContext?.knowledgeHits.map((item) => ({
          assetId: item.assetId,
          assetType:
            item.assetType === 'GOVERNED_TEMPLATE' ? 'GOVERNED_TEMPLATE' : item.assetType,
          source: item.source,
          name: item.name,
          detail: item.detail,
        })) ?? [],
      taskSummaries: params.routedTasks.map((item) => ({
        taskId: item.taskId,
        taskTitle: item.taskTitle,
        resultKind: item.resultKind,
        executionSource: item.executionSource ?? 'CRM_OFFICIAL_API',
        preferredSource: item.preferredSource,
        matchedAdapter: item.matchedAdapter,
        gapReason: item.gapReason,
      })),
      datasetReferences: params.datasetReferences,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * 按工作流任务生成受控 AI 直查任务。
   *
   * 参数说明：
   * - `questionText/channel/intent`：入口问题、渠道和已注入权限范围的意图。
   * - `baseTasks`：计划器拆出的 1 到 3 个受控任务骨架。
   * 返回值：AI 生成且保留同一时间槽的直查任务列表；任一任务失败时返回 `null` 让上层回退计划编译。
   */
  private async buildControlledDirectQueryTasks(params: {
    questionText: string;
    channel: ChannelType;
    intent: AnalysisIntent;
    knowledgeContextText?: string;
    baseTasks: Array<{
      id: string;
      title: string;
      purpose:
        | 'primary-summary'
        | 'trend-series'
        | 'distribution'
        | 'detail-table'
        | 'focus-contribution'
        | 'risk-observation';
      required?: boolean;
      reportSection?: CompiledQueryTask['reportSection'];
      plan: { resultKind: CompiledQueryTask['resultKind'] };
    }>;
  }): Promise<CompiledQueryTask[] | null> {
    const compiledTasks: CompiledQueryTask[] = [];

    // AI 直查必须与计划任务一一对应，避免只生成主任务导致趋势、分布或明细口径缺失。
    for (const baseTask of params.baseTasks.slice(0, 8)) {
      const generatedTask = await this.aiGatewayService.generateControlledDirectQueryTask({
        questionText: params.questionText,
        channel: params.channel,
        domain: params.intent.domain,
        metrics: params.intent.metrics,
        dimensions: params.intent.dimensions,
        filters: params.intent.filters,
        temporalSlot: params.intent.temporalSlot,
        knowledgeContextText: params.knowledgeContextText,
        expectedTaskTitle: baseTask.title,
        expectedResultKind: baseTask.plan.resultKind,
        expectedPurpose: baseTask.purpose,
      });
      if (!generatedTask) {
        return null;
      }

      const normalizedTask = this.normalizeGeneratedDirectQueryTask(generatedTask);
      compiledTasks.push({
        taskId: baseTask.id,
        taskTitle: normalizedTask.taskTitle,
        purpose: baseTask.purpose,
        required: baseTask.required,
        reportSection: baseTask.reportSection,
        sql: normalizedTask.sql,
        params: [],
        tables: normalizedTask.tables,
        fieldMap: Object.fromEntries(
          normalizedTask.fieldEntries.map((item) => [item.table, item.fields]),
        ),
        joinPaths: normalizedTask.joinPaths,
        allowedFunctions: normalizedTask.allowedFunctions,
        resultKind: normalizedTask.resultKind,
        plan: this.queryCompilerService.buildPlanForResultKind(
          {
            ...params.intent,
            temporalSlot: normalizedTask.temporalSlot ?? params.intent.temporalSlot,
          },
          normalizedTask.resultKind,
        ),
        rowLimit: normalizedTask.rowLimit,
        timeoutMs: normalizedTask.timeoutMs,
      });
    }

    return compiledTasks;
  }

  private normalizeGeneratedDirectQueryTask(task: {
    taskTitle: string;
    resultKind: CompiledQueryTask['resultKind'];
    sql: string;
    tables: string[];
    fieldEntries: Array<{ table: string; fields: string[] }>;
    joinPaths: string[];
    allowedFunctions: string[];
    rowLimit: number;
    timeoutMs: number;
    temporalSlot?: AnalysisIntent['temporalSlot'];
  }) {
    if (task.resultKind !== 'owner-ranking') {
      return task;
    }

    const normalizedRowLimit = Math.max(task.rowLimit, 20);
    const normalizedSql = this.ensureSqlLimit(task.sql, normalizedRowLimit);

    return {
      ...task,
      sql: normalizedSql,
      rowLimit: normalizedRowLimit,
    };
  }

  private ensureSqlLimit(sql: string, rowLimit: number): string {
    const limitPattern = /\bLIMIT\s+(\d+)\s*$/iu;
    const match = sql.match(limitPattern);
    if (match) {
      const currentLimit = Number(match[1]);
      if (Number.isFinite(currentLimit) && currentLimit >= rowLimit) {
        return sql;
      }
      return sql.replace(limitPattern, `LIMIT ${rowLimit}`);
    }

    return `${sql.trim()}\nLIMIT ${rowLimit}`;
  }

  /**
   * 仅对执行前治理阻断记录 BLOCKED 审计，避免与已落库的预检失败或真实执行失败重复记账。
   */
  private shouldRecordBlockedSql(
    error: unknown,
    reachedExecuteStep: boolean,
  ): boolean {
    if (reachedExecuteStep) {
      return false;
    }

    if (error instanceof RealDataUnavailableError) {
      return false;
    }

    if (error instanceof OpenApiCapabilityGapError) {
      return false;
    }

    if (
      error instanceof QueryPreflightError &&
      error.message.includes('SQL 无法通过数据库检查')
    ) {
      return false;
    }

    return true;
  }

  private buildResultBundleSnapshot(
    result: AnalysisResultRecord,
    report: AnalysisResultRecord['report'],
  ): AnalysisResultBundleSnapshot {
    return {
      requestId: result.requestId,
      consistencyToken: result.consistencyToken,
      rowCount: result.rowCount,
      metricCount: result.metricCards.length,
      tableBlockCount: report.tableBlocks.length,
      chartBlockCount: report.chartBlocks.length,
    };
  }

  private async buildGroundedInsight(result: AnalysisResultRecord): Promise<{
    groundedExplanation: string;
    nextBestQuestions: string[];
    packCode?: string;
    packVersion?: string;
    providerCode?: string;
    model?: string;
    failureReason?: string;
  }> {
    const topFinding = result.keyFindings[0]?.detail ?? result.summary ?? result.title;
    const scopeText = result.scopeSummary || '当前权限范围';
    if (process.env.AI_GROUNDED_EXPLANATION_ENABLED === 'false') {
      return {
        groundedExplanation: 'AI grounded 洞察开关已关闭，当前仅返回事实结果包。',
        nextBestQuestions: [],
        failureReason: 'grounded-explanation-disabled',
      };
    }

    const aiInsight = await this.resolveGroundedInsightWithTimeout(result);
    if (aiInsight?.groundedExplanation?.trim()) {
      return aiInsight;
    }

    return {
      groundedExplanation: `仅基于本次结果包和权限快照可确认：${topFinding}。该解释不会发起二次查数，适用范围为${scopeText}。`,
      nextBestQuestions: [
        '继续按月份看趋势变化',
        '继续查看当前结果的明细口径',
        '继续比较不同销售负责人的分布差异',
      ],
      failureReason: aiInsight?.failureReason ?? 'ai-unavailable-or-invalid',
    };
  }

  /**
   * 为 grounded 洞察增加服务端超时保护，避免上游 provider 卡住时阻塞最终结果交付。
   *
   * 参数说明：`result` 为当前已经完成结果一致性校验的统一结果包。
   * 返回值：超时或异常时返回 `null`，由上层继续走模板解释兜底。
   */
  private async resolveGroundedInsightWithTimeout(
    result: AnalysisResultRecord,
  ): Promise<{
    groundedExplanation: string;
    nextBestQuestions: string[];
    packCode?: string;
    packVersion?: string;
    providerCode?: string;
    model?: string;
    failureReason?: string;
  } | null> {
    const timeoutMs = Number(process.env.ANALYSIS_GROUNDED_INSIGHT_TIMEOUT_MS ?? '8000');
    const normalizedTimeoutMs =
      Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 8000;
    let timeoutHandle: NodeJS.Timeout | undefined;

    try {
      return await Promise.race([
        this.aiGatewayService.generateGroundedAnalysisInsight({
          title: result.title,
          summary: result.summary,
          scopeSummary: result.scopeSummary,
          keyFindings: result.keyFindings.map((item) => `${item.title}：${item.detail}`),
        }),
        new Promise<{
          groundedExplanation: string;
          nextBestQuestions: string[];
          failureReason: string;
        } | null>((resolve) => {
          timeoutHandle = setTimeout(
            () =>
              resolve({
                groundedExplanation: '',
                nextBestQuestions: [],
                failureReason: 'grounded-explanation-timeout',
              }),
            normalizedTimeoutMs,
          );
        }),
      ]);
    } catch {
      return null;
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  private buildInsightSnapshot(params: {
    groundedExplanation: string;
    nextBestQuestions: string[];
    packCode?: string;
    packVersion?: string;
    providerCode?: string;
    model?: string;
    failureReason?: string;
  }): AnalysisInsightSnapshot {
    return {
      grounded: true,
      reusedResultBundle: true,
      generatedAt: new Date().toISOString(),
      explanationLength: params.groundedExplanation.length,
      nextQuestionCount: params.nextBestQuestions.length,
      failureReason: params.failureReason,
      packCode: params.packCode,
      packVersion: params.packVersion,
      providerCode: params.providerCode,
      model: params.model,
    };
  }

  private buildDeliverySnapshot(
    channel: 'web-console' | 'wecom-bot',
    result: AnalysisResultRecord,
  ): AnalysisDeliverySnapshot {
    return {
      channel,
      deliveredFromSingleBundle: true,
      streamBlockCount: result.streamBlocks.length,
      generatedAt: new Date().toISOString(),
    };
  }
}

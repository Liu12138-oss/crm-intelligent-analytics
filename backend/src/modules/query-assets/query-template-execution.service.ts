import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AnalysisRequestRepository } from '../analysis/analysis-request.repository';
import type {
  AnalysisResultRecord,
  CrmUser,
  QueryTemplateRecord,
  QueryTemplateScopeGovernanceMode,
  QueryTemplateScopeValidationSnapshot,
} from '../../shared/types/domain';
import { buildEntityId } from '../../shared/utils/id.util';
import { CrmReadonlyService } from '../../database/crm-readonly/crm-readonly.service';
import { AnalysisScopeModeService } from '../analysis/analysis-scope-mode.service';
import { AnalysisRichReportService } from '../analysis/analysis-rich-report.service';
import {
  QueryExecutionTimeoutError,
  QueryPreflightError,
  RealDataUnavailableError,
} from '../analysis/analysis.errors';
import { QueryRiskGuardService } from '../analysis/query-risk-guard.service';
import { AuditEventRepository } from '../audit/audit-event.repository';
import { SqlAuditContextService } from '../audit/sql-audit-context.service';
import { UserScopeService } from '../auth/user-scope.service';
import { RecentQueryRepository } from './recent-query.repository';
import { QueryTemplateRepository } from './query-template.repository';
import { QueryResultPresentationService } from './query-result-presentation.service';
import { QueryTemplateScopeAnalyzerService } from './query-template-scope-analyzer.service';
import { QueryTemplateScopeCompatibilityService } from './query-template-scope-compatibility.service';
import { QueryTemplateScopeInjectorService } from './query-template-scope-injector.service';
import { QueryTemplateSqlGuardService } from './query-template-sql-guard.service';
import {
  buildTemplateExecutionParams,
  compileNamedTemplateSql,
  normalizeGeneratedQueryTemplateSql,
} from './query-template-sql.runtime';

const DEFAULT_TEMPLATE_EMPTY_COPY = '请解释为什么当前条件下未查到数据。';
const SQL_IN_NO_MATCH_VALUE = '__crm_scope_no_match__';

@Injectable()
export class QueryTemplateExecutionService {
  constructor(
    private readonly queryTemplateRepository: QueryTemplateRepository,
    private readonly queryTemplateSqlGuardService: QueryTemplateSqlGuardService,
    private readonly queryResultPresentationService: QueryResultPresentationService,
    private readonly recentQueryRepository: RecentQueryRepository,
    private readonly analysisRequestRepository: AnalysisRequestRepository,
    private readonly crmReadonlyService: CrmReadonlyService,
    private readonly analysisScopeModeService: AnalysisScopeModeService,
    private readonly queryRiskGuardService: QueryRiskGuardService,
    private readonly sqlAuditContextService: SqlAuditContextService,
    private readonly queryTemplateScopeAnalyzerService: QueryTemplateScopeAnalyzerService,
    private readonly queryTemplateScopeInjectorService: QueryTemplateScopeInjectorService,
    private readonly queryTemplateScopeCompatibilityService: QueryTemplateScopeCompatibilityService,
    private readonly analysisRichReportService: AnalysisRichReportService,
    private readonly auditEventRepository?: AuditEventRepository,
    private readonly userScopeService?: UserScopeService,
  ) {}

  async execute(
    user: CrmUser,
    templateId: string,
    payload: {
      parameters?: Record<string, unknown>;
      includeAiReport?: boolean;
      scopeRewriteConfirmed?: boolean;
    },
  ) {
    const template = this.queryTemplateRepository.findById(templateId);
    if (!template || template.status !== 'ACTIVE') {
      throw new NotFoundException('查询模板不存在。');
    }

    let executableTemplate = this.normalizeExecutableTemplate(template);
    this.queryTemplateSqlGuardService.validateReadonlyTemplateSql(executableTemplate.sqlText);
    let scopeAnalysis =
      this.queryTemplateScopeAnalyzerService.analyze(executableTemplate.sqlText);
    const governanceMode = this.resolveTemplateScopeGovernanceMode();
    const resolvedAnalysisScope = this.analysisScopeModeService.resolve(user);

    if (
      resolvedAnalysisScope.mode === 'DEPARTMENT_ANALYSIS_SCOPE' &&
      scopeAnalysis.scopeClassification === 'FIXED_SCOPE'
    ) {
      if (!payload.scopeRewriteConfirmed) {
        this.ensureFixedScopeCoveredOrSuggestRewrite(
          user,
          executableTemplate,
          scopeAnalysis,
          resolvedAnalysisScope.scopeSnapshot,
        );
      } else {
        executableTemplate = this.rewriteFixedScopeTemplateToCurrentScope(
          executableTemplate,
          scopeAnalysis,
        );
        scopeAnalysis = this.queryTemplateScopeAnalyzerService.analyze(
          executableTemplate.sqlText,
        );
        this.auditTemplateScopeEvent(
          user,
          'QUERY_TEMPLATE_FIXED_SCOPE_REWRITTEN',
          template,
          '用户确认后已将固定范围改为当前可见范围，并重新执行安全校验。',
          scopeAnalysis,
        );
      }
    }

    const parameters = buildTemplateExecutionParams({
      template: executableTemplate,
      parameters: payload.parameters,
    });
    const preparedQuery = this.prepareTemplateQuery(
      executableTemplate,
      parameters,
      resolvedAnalysisScope.mode,
      resolvedAnalysisScope.scopeSnapshot,
      scopeAnalysis,
      governanceMode,
      user,
    );
    const rows = await this.runTemplateQuerySafely(
      user,
      executableTemplate,
      preparedQuery,
      parameters,
    );
    const resultBundle = this.queryResultPresentationService.present({
      template: executableTemplate,
      rows,
      parameters,
      scopeSnapshot: resolvedAnalysisScope.scopeSnapshot,
      scopeGovernance: scopeAnalysis,
    });
    const queryId = buildEntityId('query');
    const executedAt = new Date().toISOString();
    const insightBundle =
      payload.includeAiReport === false
        ? { status: 'SKIPPED' as const }
        : { status: 'PENDING' as const };
    const baseResultRecord = this.buildTemplateResultRecord({
      queryId,
      user,
      template: executableTemplate,
      parameters,
      rows,
      resultBundle,
      insightBundle,
      executedAt,
      preparedQuery,
      scopeExecution: resolvedAnalysisScope,
      templateScopeGovernance: scopeAnalysis,
    });
    const responseInsightBundle = insightBundle;

    this.analysisRequestRepository.saveRequest({
      id: queryId,
      questionText: template.defaultQuestionText,
      requesterId: user.id,
      requesterRoleIds: user.roleIds,
      sessionId: buildEntityId('session'),
      entryChannel: 'web-console',
      querySource: 'COMMON_TEMPLATE',
      templateId: template.id,
      rerunFromHistoryId: undefined,
      organizationScope: resolvedAnalysisScope.scopeSnapshot.organizationIds,
      departmentScope: resolvedAnalysisScope.scopeSnapshot.departmentIds,
      ownerScope: resolvedAnalysisScope.scopeSnapshot.ownerIds,
      intentDomain: 'opportunity-analysis',
      metrics: [],
      dimensions: [],
      filters: parameters,
      missingConditions: [],
      generatedQuery: preparedQuery.sql,
      resultConsistencyToken: baseResultRecord.consistencyToken,
      executionMode: baseResultRecord.executionMode,
      executionSource: baseResultRecord.executionSource,
      preferredSource: baseResultRecord.preferredSource,
      matchedAdapter: baseResultRecord.matchedAdapter,
      executionSnapshot: baseResultRecord.executionSnapshot,
      executionTraceSummary: baseResultRecord.executionTraceSummary,
      resultBundleSnapshot: baseResultRecord.resultBundleSnapshot,
      insightSnapshot: baseResultRecord.insightSnapshot,
      deliverySnapshot: baseResultRecord.deliverySnapshot,
      status: 'RETURNED',
      createdAt: executedAt,
      completedAt: executedAt,
    });
    this.analysisRequestRepository.saveResult(baseResultRecord);

    this.recentQueryRepository.save({
      id: buildEntityId('history'),
      requesterId: user.id,
      sourceRequestId: queryId,
      sourceType: 'TEMPLATE_QUERY',
      templateId: template.id,
      templateVersion: template.sqlVersion,
      questionText: template.defaultQuestionText,
      lastUsedChannel: 'web-console',
      lastUsedConditions: parameters,
      parameterSnapshot: parameters,
      renderSnapshot: template.renderConfig,
      templateScopeGovernanceSummary: {
        scopeClassification: scopeAnalysis.scopeClassification,
        reviewStatus: scopeAnalysis.reviewStatus,
        riskCodes: scopeAnalysis.riskFindings.map((item) => item.code),
        snapshotHash: scopeAnalysis.snapshotHash,
      },
      resultSummary:
        rows.length > 0
          ? `模板 ${template.name} 已返回 ${rows.length} 条结果。`
          : `模板 ${template.name} 当前无数据。`,
      status: 'SUCCEEDED',
      lastUsedAt: executedAt,
    });

    if (typeof this.queryTemplateRepository.incrementUsage === 'function') {
      this.queryTemplateRepository.incrementUsage(template.id, executedAt);
    }
    this.auditTemplateScopeEvent(
      user,
      'QUERY_TEMPLATE_USAGE_UPDATED',
      template,
      '模板执行成功，已更新历史累计使用次数。',
      scopeAnalysis,
    );

    return {
      queryId,
      templateId: template.id,
      queryMode: template.queryMode,
      sqlVersion: template.sqlVersion,
      scopeExecution: {
        analysisScopeMode: resolvedAnalysisScope.mode,
        analysisScopeSummary: resolvedAnalysisScope.scopeSnapshot.scopeSummary,
        templateScopeMode: scopeAnalysis.scopeMode,
        templateScopeClassification: scopeAnalysis.scopeClassification,
        templateScopeGovernanceMode: governanceMode,
        templateScopeReviewStatus: scopeAnalysis.reviewStatus,
        templateScopeRisks: scopeAnalysis.riskFindings,
      },
      resultBundle,
      insightBundle: responseInsightBundle,
      executedAt,
    };
  }

  /**
   * 兼容已保存过的自由问数模板，将一次性 `?` 参数 SQL 转为当前执行器可绑定的命名参数 SQL。
   */
  private normalizeExecutableTemplate(template: QueryTemplateRecord): QueryTemplateRecord {
    if (template.sourceType !== 'FREE_QUERY_SAVED' || !template.sqlText.includes('?')) {
      return template;
    }

    const normalized = normalizeGeneratedQueryTemplateSql({
      sqlText: template.sqlText,
      defaultFilters: template.defaultFilters ?? {},
    });

    return {
      ...template,
      sqlText: normalized.sqlText,
      defaultFilters: normalized.defaultFilters,
    };
  }

  preview(
    user: CrmUser,
    templateId: string,
    payload: { parameters?: Record<string, unknown> },
  ) {
    return this.execute(user, templateId, {
      parameters: payload.parameters,
      includeAiReport: true,
    });
  }

  validate(sqlText: string) {
    this.queryTemplateSqlGuardService.validateReadonlyTemplateSql(sqlText);
    const scopeAnalysis = this.queryTemplateScopeAnalyzerService.analyze(sqlText);
    return {
      status:
        scopeAnalysis.scopeClassification === 'UNSAFE_SCOPE' ? 'FAILED' as const : 'PASSED' as const,
      message:
        scopeAnalysis.riskFindings.length > 0
          ? scopeAnalysis.friendlyMessage
          : '模板 SQL 已通过只读校验。',
      scopeAnalysis,
    };
  }

  private buildTemplateResultRecord(params: {
    queryId: string;
    user: CrmUser;
    template: QueryTemplateRecord;
    parameters: Record<string, unknown>;
    rows: Array<Record<string, unknown>>;
    resultBundle: {
      metricCards: Array<{ name: string; value: string | number }>;
      primaryBlock: {
        viewType: string;
        title: string;
        rows?: Array<Record<string, unknown>>;
        series?: Array<Record<string, unknown>>;
        columns?: Array<{ key: string; label: string; width?: number }>;
      };
      emptyStateBlock?: {
        title: string;
        reason: string;
        scopeSummary?: string;
        suggestions: string[];
      };
    };
    insightBundle: { status: 'PENDING' | 'READY' | 'FAILED' | 'SKIPPED'; groundedMarkdown?: string };
    executedAt: string;
    preparedQuery: { sql: string; params: unknown[]; timeoutMs: number };
    scopeExecution: {
      mode: 'FULL_ANALYSIS_SCOPE' | 'DEPARTMENT_ANALYSIS_SCOPE';
      scopeSnapshot: {
        organizationIds: string[];
        departmentIds: string[];
        ownerIds: string[];
        scopeSummary: string;
      };
    };
    templateScopeGovernance?: QueryTemplateScopeValidationSnapshot;
  }): AnalysisResultRecord {
    const consistencyToken = `template:${params.template.id}:${params.executedAt}`;
    const reportVariant: AnalysisResultRecord['report']['variant'] =
      params.template.defaultViewType === 'RANKING_TABLE' ? 'ranking' : 'summary';
    const primaryViewType =
      params.template.defaultViewType === 'RANKING_TABLE'
        ? 'RANKING_TABLE'
        : params.template.renderConfig.primaryViewType === 'TABLE'
          ? 'DETAIL_TABLE'
          : (params.template.renderConfig.primaryViewType as
              | 'BAR_CHART'
              | 'LINE_CHART'
              | 'RANKING_TABLE'
              | 'DETAIL_TABLE');
    const chartBlocks =
      params.resultBundle.primaryBlock.series &&
      ['BAR_CHART', 'LINE_CHART'].includes(params.resultBundle.primaryBlock.viewType)
        ? [
            {
              blockId: `${params.queryId}_chart`,
              title: params.resultBundle.primaryBlock.title,
              viewType: params.resultBundle.primaryBlock.viewType as 'BAR_CHART' | 'LINE_CHART',
              series: params.resultBundle.primaryBlock.series,
              datasetId: `${params.queryId}_dataset`,
            },
          ]
        : [];
    const tableBlocks =
      (params.resultBundle.primaryBlock.rows?.length ?? 0) > 0
        ? [
            {
              blockId: `${params.queryId}_table`,
              title: params.resultBundle.primaryBlock.title,
              rows: params.resultBundle.primaryBlock.rows ?? [],
              columns: params.resultBundle.primaryBlock.columns,
              datasetId: `${params.queryId}_dataset`,
            },
          ]
        : [];
    const summary =
      params.resultBundle.emptyStateBlock
        ? '当前条件下未查到数据。'
        : `${params.template.name} 已生成数据结果。`;

    return {
      requestId: params.queryId,
      title: params.template.name,
      summary,
      report: {
        variant: reportVariant,
        reportTitle: params.template.name,
        executiveSummary: summary,
        keyFindings: [],
        metricCards: params.resultBundle.metricCards,
        chartBlocks,
        tableBlocks,
        sections: [],
        datasetReferences: [
          {
            datasetId: `${params.queryId}_dataset`,
            taskId: `${params.queryId}_task`,
            taskTitle: params.template.name,
            purpose: 'detail-table' as const,
            rowCount: params.rows.length,
          },
        ],
        scopeSummary: params.scopeExecution.scopeSnapshot.scopeSummary,
        sourceNotes: params.templateScopeGovernance?.riskFindings.map((item) => ({
          key: item.code,
          label: '模板范围治理',
          description: `${item.title}：${item.description}`,
        })),
        appliedFilters: Object.entries(params.parameters).map(([key, value]) => ({
          label: key,
          value: Array.isArray(value) ? value.join('、') : String(value),
        })),
        groundedMarkdown:
          params.resultBundle.emptyStateBlock && !params.insightBundle.groundedMarkdown
            ? `## 空结果说明\n- ${DEFAULT_TEMPLATE_EMPTY_COPY}\n- 建议放宽时间范围或切换相邻模板。`
            : params.insightBundle.groundedMarkdown,
        emptyState: params.resultBundle.emptyStateBlock?.reason,
        availableActions: [
          { actionType: 'EXPORT' as const, enabled: true },
          { actionType: 'FOLLOW_UP' as const, enabled: true },
          { actionType: 'RERUN' as const, enabled: true },
        ],
      },
      temporalScope: undefined,
      scopeSummary: params.scopeExecution.scopeSnapshot.scopeSummary,
      appliedFilters: Object.entries(params.parameters).map(([key, value]) => ({
        label: key,
        value: Array.isArray(value) ? value.join('、') : String(value),
      })),
      metricCards: params.resultBundle.metricCards,
      primaryView: {
        viewType: primaryViewType,
        title: params.resultBundle.primaryBlock.title,
        series: params.resultBundle.primaryBlock.series,
        rows: params.resultBundle.primaryBlock.rows,
        columns: params.resultBundle.primaryBlock.columns,
      },
      secondaryViews: [],
      tableRows: params.rows,
      keyFindings: [],
      rowCount: params.rows.length,
      dataFreshnessAt: params.executedAt,
      consistencyToken,
      executionMode: 'GUARDED_DIRECT_QUERY' as const,
      executionSource: 'GUARDED_READONLY_SQL' as const,
      preferredSource: 'GUARDED_READONLY_SQL' as const,
      matchedAdapter: params.template.id,
      executionSnapshot: {
        executionMode: 'GUARDED_DIRECT_QUERY' as const,
        executionSource: 'GUARDED_READONLY_SQL' as const,
        preferredSource: 'GUARDED_READONLY_SQL' as const,
        matchedAdapter: params.template.id,
        scopeSnapshot: params.scopeExecution.scopeSnapshot,
        blockedReason:
          params.templateScopeGovernance?.riskFindings.length
            ? params.templateScopeGovernance.friendlyMessage
            : undefined,
        taskSnapshots: [
          {
            taskId: `${params.queryId}_task`,
            taskTitle: params.template.name,
            executionSource: 'GUARDED_READONLY_SQL' as const,
            matchedAdapter: params.template.id,
            rowLimit: params.rows.length,
            timeoutMs: params.preparedQuery.timeoutMs,
            tables: [],
          },
        ],
        createdAt: params.executedAt,
      },
      executionTraceSummary: {
        normalizedQuestion: params.template.defaultQuestionText,
        consistencyToken,
        knowledgeHits: [],
        taskSummaries: [
          {
            taskId: `${params.queryId}_task`,
            taskTitle: params.template.name,
            resultKind: 'risk-overview' as const,
            executionSource: 'GUARDED_READONLY_SQL' as const,
            preferredSource: 'GUARDED_READONLY_SQL' as const,
            matchedAdapter: params.template.id,
          },
        ],
        datasetReferences: [
          {
            datasetId: `${params.queryId}_dataset`,
            taskId: `${params.queryId}_task`,
            taskTitle: params.template.name,
            purpose: 'detail-table' as const,
            rowCount: params.rows.length,
          },
        ],
        createdAt: params.executedAt,
      },
      resultBundleSnapshot: {
        requestId: params.queryId,
        consistencyToken,
        rowCount: params.rows.length,
        metricCount: params.resultBundle.metricCards.length,
        tableBlockCount: tableBlocks.length,
        chartBlockCount: chartBlocks.length,
      },
      insightSnapshot: {
        grounded: params.insightBundle.status === 'READY',
        reusedResultBundle: false,
        generatedAt: params.executedAt,
        explanationLength: params.insightBundle.groundedMarkdown?.length ?? 0,
        nextQuestionCount: 0,
      },
      deliverySnapshot: {
        channel: 'web-console' as const,
        deliveredFromSingleBundle: true,
        streamBlockCount: 0,
        generatedAt: params.executedAt,
      },
      groundedMarkdown: params.insightBundle.groundedMarkdown,
      emptyReason: params.resultBundle.emptyStateBlock?.reason,
      streamBlocks: [],
      availableActions: [
        { actionType: 'EXPORT' as const, enabled: true },
        { actionType: 'FOLLOW_UP' as const, enabled: true },
        { actionType: 'RERUN' as const, enabled: true },
      ],
      returnedAt: params.executedAt,
    };
  }

  /**
   * 统一编译模板命名参数，占位符在保存时允许自由编辑，但执行时必须被严格绑定成 mysql2 参数数组。
   */
  private prepareTemplateQuery(
    template: QueryTemplateRecord,
    parameters: Record<string, unknown>,
    analysisScopeMode: 'FULL_ANALYSIS_SCOPE' | 'DEPARTMENT_ANALYSIS_SCOPE',
    scopeSnapshot: {
      organizationIds: string[];
      departmentIds: string[];
      ownerIds: string[];
      scopeSummary: string;
    },
    scopeAnalysis: QueryTemplateScopeValidationSnapshot,
    governanceMode: QueryTemplateScopeGovernanceMode,
    user: CrmUser,
  ): { sql: string; params: unknown[]; timeoutMs: number } {
    this.ensureTemplateScopeExecutable({
      user,
      analysisScopeMode,
      scopeAnalysis,
      governanceMode,
    });

    const shouldBypassOrganizationScope =
      analysisScopeMode === 'FULL_ANALYSIS_SCOPE' &&
      scopeSnapshot.organizationIds.length === 0;
    const executableSqlText = shouldBypassOrganizationScope
      ? this.removeOrganizationScopePredicate(template.sqlText)
      : template.sqlText;
    const declaredScopeParameters = {
      ...parameters,
      scopeOrganizationIds: scopeSnapshot.organizationIds,
      scopeDepartmentIds: scopeSnapshot.departmentIds,
      scopeOwnerIds: scopeSnapshot.ownerIds,
      scopeUnrestricted: analysisScopeMode === 'FULL_ANALYSIS_SCOPE' ? 1 : 0,
    };
    const scopedParameters = {
      ...declaredScopeParameters,
      scopeOrganizationIds: this.normalizeSqlInScopeValues(
        scopeSnapshot.organizationIds,
      ),
      scopeDepartmentIds: this.normalizeSqlInScopeValues(
        scopeSnapshot.departmentIds,
      ),
      scopeOwnerIds: this.normalizeSqlInScopeValues(scopeSnapshot.ownerIds),
    };
    const compiled = compileNamedTemplateSql(executableSqlText, scopedParameters);
    let nextSql = compiled.sql;
    let nextParams = [...compiled.params];

    if (analysisScopeMode === 'DEPARTMENT_ANALYSIS_SCOPE') {
      if (scopeAnalysis.scopeClassification === 'AUTO_SCOPABLE') {
        const injected = this.queryTemplateScopeInjectorService.inject(
          compiled.sql,
          scopeSnapshot,
        );
        nextSql = injected.sql;
        nextParams = [...compiled.params, ...injected.params];
      } else if (
        scopeAnalysis.scopeClassification === 'DECLARED_DYNAMIC_SCOPE' ||
        scopeAnalysis.scopeClassification === 'FIXED_SCOPE'
      ) {
        const declaredScope = this.queryTemplateScopeAnalyzerService.extractDeclaredScope(
          template.sqlText,
          declaredScopeParameters,
        );
        this.queryTemplateScopeCompatibilityService.ensureCompatible(
          declaredScope,
          scopeSnapshot,
        );
      }
    }

    this.queryRiskGuardService.ensureQuerySafe(nextSql);
    return {
      sql: nextSql,
      params: nextParams,
      timeoutMs: 8000,
    };
  }

  /**
   * 根据灰度模式和模板治理结论判断当前用户是否可以执行模板。
   */
  private ensureTemplateScopeExecutable(params: {
    user: CrmUser;
    analysisScopeMode: 'FULL_ANALYSIS_SCOPE' | 'DEPARTMENT_ANALYSIS_SCOPE';
    scopeAnalysis: QueryTemplateScopeValidationSnapshot;
    governanceMode: QueryTemplateScopeGovernanceMode;
  }): void {
    if (params.analysisScopeMode === 'FULL_ANALYSIS_SCOPE' || params.user.isAdmin) {
      return;
    }

    if (params.governanceMode === 'observe') {
      return;
    }

    if (
      params.scopeAnalysis.scopeClassification === 'COMPLEX_REVIEW_REQUIRED' ||
      params.scopeAnalysis.scopeClassification === 'UNSAFE_SCOPE'
    ) {
      throw new BadRequestException(
        '当前模板需要管理员完成范围治理审核后才能对普通用户执行。请联系管理员确认权限主表、展示口径和固定范围说明，或改用已通过治理校验的模板。',
      );
    }
  }

  /**
   * 全量权限且没有组织边界时，模板里的组织占位符表示“不按组织收口”，不能被空数组转成无命中条件。
   */
  private removeOrganizationScopePredicate(sqlText: string): string {
    return sqlText
      .replace(
        /\bWHERE\s+(?:[a-zA-Z_][a-zA-Z0-9_]*\.)?organization_id\s+IN\s*\(:scopeOrganizationIds\)\s+AND\s+/giu,
        'WHERE ',
      )
      .replace(
        /\s+AND\s+(?:[a-zA-Z_][a-zA-Z0-9_]*\.)?organization_id\s+IN\s*\(:scopeOrganizationIds\)/giu,
        '',
      )
      .replace(
        /\bWHERE\s+(?:[a-zA-Z_][a-zA-Z0-9_]*\.)?organization_id\s+IN\s*\(:scopeOrganizationIds\)/giu,
        'WHERE 1 = 1',
      );
  }

  private ensureFixedScopeCoveredOrSuggestRewrite(
    user: CrmUser,
    template: QueryTemplateRecord,
    scopeAnalysis: QueryTemplateScopeValidationSnapshot,
    scopeSnapshot: {
      organizationIds: string[];
      departmentIds: string[];
      ownerIds: string[];
      scopeSummary: string;
    },
  ): void {
    const declaredScope = this.queryTemplateScopeAnalyzerService.extractDeclaredScope(
      template.sqlText,
      {},
    );
    const organizationAllowed = declaredScope.organizationIds.every((item) =>
      scopeSnapshot.organizationIds.includes(item),
    );
    const departmentAllowed = declaredScope.departmentIds.every((item) =>
      scopeSnapshot.departmentIds.includes(item),
    );
    const ownerAllowed = declaredScope.ownerIds.every((item) =>
      scopeSnapshot.ownerIds.includes(item),
    );

    if (organizationAllowed && departmentAllowed && ownerAllowed) {
      return;
    }

    this.auditTemplateScopeEvent(
      user,
      'QUERY_TEMPLATE_FIXED_SCOPE_BLOCKED',
      template,
      '模板限定了当前用户无权覆盖的固定范围，已阻断原范围执行。',
      scopeAnalysis,
    );
    throw new BadRequestException({
      message:
        `这个模板已经限定了特定部门或负责人范围，但你当前只开通了「${scopeSnapshot.scopeSummary}」的数据权限，暂时不能直接使用原范围。`,
      scopeRewriteCandidate: {
        action: 'CONFIRM_REWRITE_TO_CURRENT_SCOPE',
        label: '改为当前可见范围',
        description:
          '确认后系统会把模板里的固定部门或负责人条件改为你当前可见的数据范围，并重新执行安全校验。',
      },
    });
  }

  private rewriteFixedScopeTemplateToCurrentScope(
    template: QueryTemplateRecord,
    scopeAnalysis: QueryTemplateScopeValidationSnapshot,
  ): QueryTemplateRecord {
    let nextSql = template.sqlText;
    let replacementCount = 0;

    for (const predicate of scopeAnalysis.scopePredicateSources) {
      if (predicate.sourceType !== 'FIXED_VALUE' && predicate.sourceType !== 'MIXED') {
        continue;
      }

      const parameterName = this.resolveScopeParameterName(predicate.field);
      const qualifiedField = predicate.alias
        ? `${this.escapeRegExp(predicate.alias)}\\s*\\.\\s*${predicate.field}`
        : `(?:\\w+\\s*\\.\\s*)?${predicate.field}`;
      const fixedPredicatePattern = new RegExp(
        `${qualifiedField}\\s*(?:=\\s*(?:'[^']+'|\\d+)|IN\\s*\\([^)]*\\))`,
        'giu',
      );
      nextSql = nextSql.replace(fixedPredicatePattern, (matched) => {
        replacementCount += 1;
        const fieldPrefix = matched.match(/^\s*[\w.\\s]+/u)?.[0]?.trim() ?? predicate.field;
        return `${fieldPrefix} IN (:${parameterName})`;
      });
    }

    if (replacementCount === 0) {
      throw new BadRequestException(
        '当前模板包含固定范围，但系统无法可靠替换为当前可见范围。请联系管理员将模板治理为通用模板后再使用。',
      );
    }

    return {
      ...template,
      sqlText: nextSql,
      scopeMode: 'DECLARED_SCOPE',
    };
  }

  private resolveScopeParameterName(
    field: 'organization_id' | 'department_id' | 'user_id',
  ): 'scopeOrganizationIds' | 'scopeDepartmentIds' | 'scopeOwnerIds' {
    if (field === 'organization_id') {
      return 'scopeOrganizationIds';
    }
    if (field === 'department_id') {
      return 'scopeDepartmentIds';
    }
    return 'scopeOwnerIds';
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  }

  private auditTemplateScopeEvent(
    user: CrmUser,
    eventType:
      | 'QUERY_TEMPLATE_USAGE_UPDATED'
      | 'QUERY_TEMPLATE_FIXED_SCOPE_BLOCKED'
      | 'QUERY_TEMPLATE_FIXED_SCOPE_REWRITTEN',
    template: QueryTemplateRecord,
    outcome: string,
    scopeAnalysis: QueryTemplateScopeValidationSnapshot,
  ): void {
    if (!this.auditEventRepository || !this.userScopeService) {
      return;
    }

    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType,
      actorId: user.id,
      actorRoleIds: user.roleIds,
      channel: 'web-console',
      relatedTemplateId: template.id,
      scopeSnapshot: this.userScopeService.resolveScope(user),
      sessionSnapshot: {
        scopeClassification: scopeAnalysis.scopeClassification,
        reviewStatus: scopeAnalysis.reviewStatus,
        riskCodes: scopeAnalysis.riskFindings.map((item) => item.code),
      },
      riskLevel:
        eventType === 'QUERY_TEMPLATE_FIXED_SCOPE_BLOCKED' ? 'MEDIUM' : 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * 解析查询模板范围治理灰度模式。
   */
  private resolveTemplateScopeGovernanceMode(): QueryTemplateScopeGovernanceMode {
    const configuredMode = process.env.QUERY_TEMPLATE_SCOPE_GOVERNANCE_MODE;
    if (configuredMode === 'observe' || configuredMode === 'enforce') {
      return configuredMode;
    }

    return 'observe';
  }

  /**
   * mysql2 会把数组参数展开到 `IN (?)` 中；空数组会生成非法的 `IN ()`。
   * 因此只在 SQL 编译执行参数中放入不可能命中的哨兵值，权限兼容性判断仍使用原始空数组。
   */
  private normalizeSqlInScopeValues(values: string[]): string[] {
    return values.length > 0 ? values : [SQL_IN_NO_MATCH_VALUE];
  }

  /**
   * 非测试环境优先执行真实只读 SQL；只有自动化测试环境且未连接真实数据源时才回退样例结果。
   */
  private async runTemplateQuery(
    user: CrmUser,
    template: QueryTemplateRecord,
    preparedQuery: { sql: string; params: unknown[]; timeoutMs: number },
    parameters: Record<string, unknown>,
  ): Promise<Array<Record<string, unknown>>> {
    const liveQueryReady = await this.crmReadonlyService.ensureLiveQueryReady();
    if (liveQueryReady && this.crmReadonlyService.canUseLiveQuery()) {
      return await this.sqlAuditContextService.run(
        {
          actorId: user.id,
          actorRoleIds: user.roleIds,
          channel: 'web-console',
          moduleKey: 'query-assets',
          programName: 'QueryTemplateExecutionService.execute',
          executionMode: 'GUARDED_DIRECT_QUERY',
          executionSource: 'GUARDED_READONLY_SQL',
          matchedAdapter: template.id,
        },
        async () => {
          await this.crmReadonlyService.preflightQuery(
            preparedQuery.sql,
            preparedQuery.params,
            {
              timeoutMs: preparedQuery.timeoutMs,
            },
          );
          return await this.crmReadonlyService.executeQuery<Record<string, unknown>>(
            preparedQuery.sql,
            preparedQuery.params,
            {
              timeoutMs: preparedQuery.timeoutMs,
            },
          );
        },
      );
    }

    if (process.env.NODE_ENV === 'test') {
      return this.buildMockRows(template, parameters);
    }

    throw new RealDataUnavailableError(
      '当前未连接真实 CRM 只读数据源，模板查询不会回退样例结果，请先完成数据库连接配置。',
    );
  }

  /**
   * 将模板真实执行阶段的数据库错误收敛为用户可理解的 400 响应，避免 SQL 预检或超时被 Nest 兜底成 500。
   */
  private async runTemplateQuerySafely(
    user: CrmUser,
    template: QueryTemplateRecord,
    preparedQuery: { sql: string; params: unknown[]; timeoutMs: number },
    parameters: Record<string, unknown>,
  ): Promise<Array<Record<string, unknown>>> {
    try {
      return await this.runTemplateQuery(user, template, preparedQuery, parameters);
    } catch (error) {
      if (error instanceof RealDataUnavailableError) {
        throw new BadRequestException(
          '当前常用查询暂时无法执行，因为 CRM 只读数据源还没有准备好。请稍后重试，或联系管理员检查数据源配置。',
        );
      }

      if (error instanceof QueryExecutionTimeoutError) {
        throw new BadRequestException(
          '当前常用查询执行超时，系统已停止等待结果。请缩小查询范围后重试，或联系管理员优化模板。',
        );
      }

      if (error instanceof QueryPreflightError) {
        throw new BadRequestException(
          '当前常用查询没有通过执行前检查，请联系管理员在治理后台重新校验模板 SQL 后再试。',
        );
      }

      throw new BadRequestException(
        '当前常用查询暂时无法执行，请稍后重试；如果多次失败，请联系管理员检查模板配置。',
      );
    }
  }

  private buildMockRows(
    template: QueryTemplateRecord,
    parameters: Record<string, unknown>,
  ): Array<Record<string, unknown>> {
    if (template.id === 'tpl_company_quarterly_opportunity_health') {
      return [
        {
          team_name: '大北区-山东区',
          jan_amount: 32,
          feb_amount: 40,
          mar_amount: 48,
          apr_amount: 55,
          may_amount: 62,
          jun_amount: 58,
          jul_amount: 50,
          aug_amount: 46,
          sep_amount: 52,
          oct_amount: 61,
          nov_amount: 56,
          dec_amount: 60,
          annual_total_amount: 620,
        },
        {
          team_name: '大南区-深圳区',
          jan_amount: 24,
          feb_amount: 36,
          mar_amount: 42,
          apr_amount: 45,
          may_amount: 54,
          jun_amount: 51,
          jul_amount: 44,
          aug_amount: 39,
          sep_amount: 47,
          oct_amount: 53,
          nov_amount: 50,
          dec_amount: 55,
          annual_total_amount: 540,
        },
        {
          team_name: '大东区-江苏区',
          jan_amount: 18,
          feb_amount: 25,
          mar_amount: 33,
          apr_amount: 37,
          may_amount: 41,
          jun_amount: 39,
          jul_amount: 35,
          aug_amount: 30,
          sep_amount: 38,
          oct_amount: 44,
          nov_amount: 42,
          dec_amount: 48,
          annual_total_amount: 460,
        },
      ];
    }

    if (template.id === 'tpl_company_year_completion_snapshot') {
      return [
        {
          year_label: String(parameters.year ?? 2026),
          valid_income: 2860,
          committed_amount: 1940,
          q1_committed_amount: 620,
          q2_committed_amount: 480,
          q3_committed_amount: 430,
          q4_committed_amount: 410,
          annual_forecast: 4800,
        },
      ];
    }

    if (template.id === 'tpl_company_2026_completion') {
      return [
        {
          team_name: '大北区-北区金融部',
          annual_target: 6000,
          contract_count: 16,
          valid_income: 2860,
          contract_amount: 3380,
          committed_amount: 1940,
          q1_committed_amount: 620,
          q2_committed_amount: 480,
          q3_committed_amount: 430,
          q4_committed_amount: 410,
          annual_forecast: 4800,
          completion_rate: 80,
        },
        {
          team_name: '大南区-深圳区',
          annual_target: 4600,
          contract_count: 12,
          valid_income: 2280,
          contract_amount: 2690,
          committed_amount: 1320,
          q1_committed_amount: 360,
          q2_committed_amount: 310,
          q3_committed_amount: 290,
          q4_committed_amount: 360,
          annual_forecast: 3600,
          completion_rate: 78.26,
        },
      ];
    }

    if (template.id === 'tpl_company_contract_effective_income_trend') {
      return [
        {
          quarter_label: '2025Q2',
          contract_amount: 410,
          unreceived_amount: 96,
          valid_income: 314,
        },
        {
          quarter_label: '2025Q3',
          contract_amount: 520,
          unreceived_amount: 118,
          valid_income: 402,
        },
        {
          quarter_label: '2025Q4',
          contract_amount: 610,
          unreceived_amount: 140,
          valid_income: 470,
        },
        {
          quarter_label: '2026Q1',
          contract_amount: 730,
          unreceived_amount: 166,
          valid_income: 564,
        },
      ];
    }

    if (template.id === 'tpl_company_ten_percent_opportunity_trend') {
      return [
        {
          quarter_label: '2025Q2',
          opportunity_amount: 680,
        },
        {
          quarter_label: '2025Q3',
          opportunity_amount: 740,
        },
        {
          quarter_label: '2025Q4',
          opportunity_amount: 860,
        },
        {
          quarter_label: '2026Q1',
          opportunity_amount: 930,
        },
      ];
    }

    if (template.id === 'tpl_company_committed_opportunity_summary') {
      return [
        {
          team_name: '大北区-山东区',
          committed_amount: 760,
          q1_committed_amount: 220,
          q2_committed_amount: 180,
          q3_committed_amount: 170,
          q4_committed_amount: 190,
          total_opportunity_amount: 980,
          opportunity_count: 14,
        },
        {
          team_name: '大南区-深圳区',
          committed_amount: 640,
          q1_committed_amount: 180,
          q2_committed_amount: 160,
          q3_committed_amount: 130,
          q4_committed_amount: 170,
          total_opportunity_amount: 860,
          opportunity_count: 11,
        },
      ];
    }

    if (template.id === 'tpl_company_valuable_customer_contract_history') {
      return [
        {
          year_label: 2023,
          contract_count: 6,
          contract_amount: 980,
          valid_income: 760,
        },
        {
          year_label: 2024,
          contract_count: 8,
          contract_amount: 1120,
          valid_income: 840,
        },
        {
          year_label: 2025,
          contract_count: 9,
          contract_amount: 1260,
          valid_income: 930,
        },
        {
          year_label: 2026,
          contract_count: 5,
          contract_amount: 870,
          valid_income: 640,
        },
      ];
    }

    if (template.id === 'tpl_company_customer_contract_dimension') {
      return [
        {
          department_name: '大北区-山东区',
          customer_name: '山东农信',
          customer_level: '重点客户',
          branch_201_flag: 1,
          customer_category: '银行-省联社',
          contract_count: 3,
          contract_amount: 510,
          amount_2026: 180,
          amount_2025: 140,
          amount_2024: 110,
          amount_2023: 80,
        },
        {
          department_name: '大东区-江苏区',
          customer_name: '苏州制造',
          customer_level: '战略客户',
          branch_201_flag: 0,
          customer_category: '制造业',
          contract_count: 2,
          contract_amount: 360,
          amount_2026: 130,
          amount_2025: 100,
          amount_2024: 70,
          amount_2023: 60,
        },
        {
          department_name: '大南区-深圳区',
          customer_name: '联软科技集团',
          customer_level: '重点客户',
          branch_201_flag: 1,
          customer_category: '201新客户',
          contract_count: 1,
          contract_amount: 240,
          amount_2026: 90,
          amount_2025: 70,
          amount_2024: 50,
          amount_2023: 30,
        },
      ];
    }

    const days = Number(parameters.days ?? 7);
    if (days <= 2) {
      return [];
    }

    return [
      {
        team_name: '大北区-山东区',
        opportunity_code: 'OPP-2026-001',
        customer_name: '华北数科集团',
        customer_level: '重点客户',
        customer_category: '政府-电子政务',
        project_name: '统一安全平台升级',
        stage_name: '30%有预算且最认可',
        committed_flag: '是',
        owner_name: '张三',
        expected_amount: 180,
        created_at: '2026-05-10',
        expected_sign_date: '2026-06-18',
        innovation_flag: '信创',
        implementation_party: '我方',
        project_type: '存量扩容',
        product_solution: '安全数据交换系统',
        idle_days: 2,
        updated_at: '2026-05-11 09:30:00',
      },
      {
        team_name: '大南区-深圳区',
        opportunity_code: 'OPP-2026-002',
        customer_name: '联软科技集团',
        customer_level: '战略客户',
        customer_category: '201新客户',
        project_name: '数据交换平台扩容',
        stage_name: '50%控标或唯一品牌',
        committed_flag: '是',
        owner_name: '李四',
        expected_amount: 80,
        created_at: '2026-05-09',
        expected_sign_date: '2026-05-28',
        innovation_flag: '非信创',
        implementation_party: '甲方',
        project_type: '新签项目',
        product_solution: '零信任安全接入',
        idle_days: 4,
        updated_at: '2026-05-10 18:20:00',
      },
    ];
  }

  private formatMetricValue(value: string | number): string {
    if (typeof value === 'number') {
      return Number.isInteger(value)
        ? value.toLocaleString('zh-CN')
        : value.toLocaleString('zh-CN', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          });
    }

    return value;
  }
}

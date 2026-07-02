import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { buildEntityId } from '../../shared/utils/id.util';
import type {
  AnalysisResultRecord,
  CrmUser,
  QueryTemplateScopeGovernanceMode,
} from '../../shared/types/domain';
import { AuditEventRepository } from '../audit/audit-event.repository';
import { AccessPolicyRepository } from '../governance/access-policy.repository';
import { AnalysisRequestRepository } from '../analysis/analysis-request.repository';
import { UserScopeService } from '../auth/user-scope.service';
import { QueryTemplateRepository } from '../query-assets/query-template.repository';
import { QueryTemplateScopeAnalyzerService } from '../query-assets/query-template-scope-analyzer.service';
import { ExportPolicyService } from './export-policy.service';
import { ExportRequestRepository } from './export-request.repository';

@Injectable()
export class ExportService {
  private readonly exportColumnLabelMap: Record<string, string> = {
    ownerName: '负责人',
    team_name: '团队',
    customer_name: '最终客户',
    customer_level: '客户级别',
    customer_category: '客户分类',
    opportunity_code: '商机编号',
    project_name: '项目名称',
    stage_name: '销售阶段',
    committed_flag: '承诺签约',
    expected_amount: '预计有效收入（万元）',
    created_at: '创建时间',
    expected_sign_date: '预计签单日期',
    innovation_flag: '信创项目',
    implementation_party: '实施方',
    project_type: '项目类型',
    product_solution: '产品方案',
    idle_days: '闲置天数',
    updated_at: '更新时间',
    amount: '金额',
    count: '记录数',
  };

  constructor(
    private readonly analysisRequestRepository: AnalysisRequestRepository,
    private readonly accessPolicyRepository: AccessPolicyRepository,
    private readonly exportRequestRepository: ExportRequestRepository,
    private readonly exportPolicyService: ExportPolicyService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly userScopeService: UserScopeService,
    private readonly queryTemplateRepository: QueryTemplateRepository,
    private readonly queryTemplateScopeAnalyzerService: QueryTemplateScopeAnalyzerService,
  ) {}

  createExport(user: CrmUser, queryId: string, format: 'xlsx' | 'csv'): Record<string, unknown> {
    const requestRecord = this.analysisRequestRepository.findRequestById(queryId);
    const result = this.analysisRequestRepository.findResultByRequestId(queryId);

    if (!requestRecord || requestRecord.requesterId !== user.id || !result) {
      throw new NotFoundException('指定分析结果不存在。');
    }

    if (requestRecord.status !== 'RETURNED') {
      throw new ConflictException('分析结果尚未准备好导出。');
    }

    const exportId = buildEntityId('export');
    const now = new Date().toISOString();
    const currentTemplateGovernance = this.evaluateCurrentTemplateGovernance(
      user,
      requestRecord.templateId,
    );
    if (!currentTemplateGovernance.allowed) {
      const blockedRecord = this.exportRequestRepository.save({
        id: exportId,
        analysisRequestId: queryId,
        requesterId: user.id,
        rowCount: result.rowCount,
        consistencyToken: result.consistencyToken,
        status: 'BLOCKED',
        blockedReason: currentTemplateGovernance.reason,
        createdAt: now,
      });
      this.auditEventRepository.create({
        id: buildEntityId('audit'),
        eventType: 'EXPORT_BLOCKED',
        actorId: user.id,
        actorRoleIds: user.roleIds,
        relatedRequestId: queryId,
        originalQuestion: requestRecord.questionText,
        scopeSnapshot: this.userScopeService.resolveScope(user),
        sessionSnapshot: {
          templateId: requestRecord.templateId,
          templateScopeGovernance: currentTemplateGovernance.snapshot,
        },
        resultCount: result.rowCount,
        riskLevel: 'HIGH',
        reviewStatus: 'CONFIRMED',
        outcome: currentTemplateGovernance.reason ?? '导出被模板范围治理拦截。',
        failureReason: currentTemplateGovernance.reason,
        createdAt: now,
      });
      return {
        exportId: blockedRecord.id,
        status: blockedRecord.status,
        rowCount: blockedRecord.rowCount,
        blockedReason: blockedRecord.blockedReason,
        createdAt: blockedRecord.createdAt,
      };
    }

    const policy = this.accessPolicyRepository.getCurrent();
    const evaluation = this.exportPolicyService.evaluate(
      user,
      policy,
      result.rowCount,
    );
    if (!evaluation.allowed) {
      const blockedRecord = this.exportRequestRepository.save({
        id: exportId,
        analysisRequestId: queryId,
        requesterId: user.id,
        rowCount: result.rowCount,
        consistencyToken: result.consistencyToken,
        status: 'BLOCKED',
        blockedReason: evaluation.reason,
        createdAt: now,
      });
      this.auditEventRepository.create({
        id: buildEntityId('audit'),
        eventType: 'EXPORT_BLOCKED',
        actorId: user.id,
        actorRoleIds: user.roleIds,
        relatedRequestId: queryId,
        originalQuestion: requestRecord.questionText,
        scopeSnapshot: this.userScopeService.resolveScope(user),
        sessionSnapshot: {
          executionSource: requestRecord.executionSource ?? result.executionSource,
          matchedAdapter: requestRecord.matchedAdapter ?? result.matchedAdapter,
          gapReason: requestRecord.gapReason ?? result.gapReason,
          resultBundleSnapshot: result.resultBundleSnapshot,
          templateScopeGovernance: currentTemplateGovernance.snapshot,
        },
        resultCount: result.rowCount,
        riskLevel: 'MEDIUM',
        reviewStatus: 'CONFIRMED',
        outcome: evaluation.reason ?? '导出被拦截。',
        failureReason: evaluation.reason,
        createdAt: now,
      });
      return {
        exportId: blockedRecord.id,
        status: blockedRecord.status,
        rowCount: blockedRecord.rowCount,
        blockedReason: blockedRecord.blockedReason,
        createdAt: blockedRecord.createdAt,
      };
    }

    const completedRecord = this.exportRequestRepository.save({
      id: exportId,
      analysisRequestId: queryId,
      requesterId: user.id,
      rowCount: result.rowCount,
      consistencyToken: result.consistencyToken,
      status: 'COMPLETED',
      createdAt: now,
      exportedAt: now,
      downloadUrl: `/downloads/${exportId}.${format}`,
    });
    const exportFile = this.buildExportFile(result, exportId, format);
    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'EXPORT_SUCCEEDED',
      actorId: user.id,
      actorRoleIds: user.roleIds,
      relatedRequestId: queryId,
      originalQuestion: requestRecord.questionText,
      scopeSnapshot: this.userScopeService.resolveScope(user),
      sessionSnapshot: {
        executionSource: requestRecord.executionSource ?? result.executionSource,
        matchedAdapter: requestRecord.matchedAdapter ?? result.matchedAdapter,
        gapReason: requestRecord.gapReason ?? result.gapReason,
        resultBundleSnapshot: result.resultBundleSnapshot,
        templateScopeGovernance: currentTemplateGovernance.snapshot,
      },
      resultCount: result.rowCount,
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome: '导出成功。',
      createdAt: now,
    });
    return {
      exportId: completedRecord.id,
      status: completedRecord.status,
      rowCount: completedRecord.rowCount,
      downloadUrl: completedRecord.downloadUrl,
      fileName: exportFile.fileName,
      mimeType: exportFile.mimeType,
      content: exportFile.content,
      executionSource: requestRecord.executionSource ?? result.executionSource,
      matchedAdapter: requestRecord.matchedAdapter ?? result.matchedAdapter,
      gapReason: requestRecord.gapReason ?? result.gapReason,
      createdAt: completedRecord.createdAt,
      exportedAt: completedRecord.exportedAt,
    };
  }

  /**
   * 历史模板结果导出前重新计算当前模板治理结论。
   */
  private evaluateCurrentTemplateGovernance(
    user: CrmUser,
    templateId?: string,
  ): {
    allowed: boolean;
    reason?: string;
    snapshot?: ReturnType<QueryTemplateScopeAnalyzerService['analyze']>;
  } {
    if (!templateId) {
      return { allowed: true };
    }

    const template = this.queryTemplateRepository.findById(templateId);
    if (!template || template.status !== 'ACTIVE') {
      return {
        allowed: false,
        reason: '当前模板已不存在或已停用，请重新执行查询后再导出。',
      };
    }

    const snapshot = this.queryTemplateScopeAnalyzerService.analyze(template.sqlText);
    const approved = template.scopeGovernanceSnapshot?.reviewStatus === 'APPROVED';
    const shouldBlock =
      this.resolveTemplateScopeGovernanceMode() === 'enforce' &&
      !user.isAdmin &&
      !approved &&
      (
        snapshot.scopeClassification === 'COMPLEX_REVIEW_REQUIRED' ||
        snapshot.scopeClassification === 'UNSAFE_SCOPE'
      );

    return {
      allowed: !shouldBlock,
      reason: shouldBlock
        ? '当前模板需要管理员完成范围治理审核后才能导出历史结果。请重新执行查询，或联系管理员确认模板权限口径。'
        : undefined,
      snapshot,
    };
  }

  /**
   * 解析模板范围治理灰度模式，未配置时保持观察模式以降低历史模板上线冲击。
   */
  private resolveTemplateScopeGovernanceMode(): QueryTemplateScopeGovernanceMode {
    return process.env.QUERY_TEMPLATE_SCOPE_GOVERNANCE_MODE === 'enforce'
      ? 'enforce'
      : 'observe';
  }

  private buildExportFile(
    result: AnalysisResultRecord,
    exportId: string,
    format: 'xlsx' | 'csv',
  ): {
    fileName: string;
    mimeType: string;
    content: string;
  } {
    if (format === 'xlsx') {
      return {
        fileName: `analysis-export-${exportId}.xls`,
        mimeType: 'application/vnd.ms-excel;charset=utf-8',
        content: this.buildHtmlTable(result),
      };
    }

    return {
      fileName: `analysis-export-${exportId}.csv`,
      mimeType: 'text/csv;charset=utf-8',
      content: `\uFEFF${this.buildCsvContent(result)}`,
    };
  }

  private buildCsvContent(result: AnalysisResultRecord): string {
    const { headers, rows } = this.extractExportMatrix(result);
    return [
      headers.map((item) => this.escapeCsvCell(item)).join(','),
      ...rows.map((row) => row.map((item) => this.escapeCsvCell(item)).join(',')),
    ].join('\n');
  }

  private buildHtmlTable(result: AnalysisResultRecord): string {
    const { headers, rows } = this.extractExportMatrix(result);
    const thead = `<tr>${headers.map((item) => `<th>${this.escapeHtml(item)}</th>`).join('')}</tr>`;
    const tbody = rows
      .map(
        (row) =>
          `<tr>${row.map((item) => `<td>${this.escapeHtml(item)}</td>`).join('')}</tr>`,
      )
      .join('');
    return [
      '<html><head><meta charset="utf-8" /></head><body>',
      `<table border="1"><thead>${thead}</thead><tbody>${tbody}</tbody></table>`,
      '</body></html>',
    ].join('');
  }

  private extractExportMatrix(result: AnalysisResultRecord): {
    headers: string[];
    rows: string[][];
  } {
    if (result.tableRows.length > 0) {
      const headers = this.normalizeExportHeaders(Object.keys(result.tableRows[0] ?? {}));
      return {
        headers: headers.map((key) => this.resolveExportHeaderLabel(key)),
        rows: result.tableRows.map((row) => headers.map((key) => this.stringifyExportValue(row[key]))),
      };
    }

    if (result.metricCards.length > 0) {
      return {
        headers: ['指标', '值'],
        rows: result.metricCards.map((item) => [
          this.stringifyExportValue(item.name),
          this.stringifyExportValue(item.value),
        ]),
      };
    }

    return {
      headers: ['标题', '摘要'],
      rows: [[this.stringifyExportValue(result.title), this.stringifyExportValue(result.summary ?? '')]],
    };
  }

  private stringifyExportValue(value: unknown): string {
    if (value === null || value === undefined || value === '') {
      return '--';
    }

    return typeof value === 'string' ? value : String(value);
  }

  private normalizeExportHeaders(headers: string[]): string[] {
    const headerSet = new Set(headers);
    if (headerSet.has('ownerName') && headerSet.has('ownerId')) {
      headerSet.delete('ownerId');
    }
    return headers.filter((item) => headerSet.has(item));
  }

  private resolveExportHeaderLabel(header: string): string {
    return this.exportColumnLabelMap[header] ?? header;
  }

  private escapeCsvCell(value: string): string {
    const escaped = value.replace(/"/gu, '""');
    return /[",\n]/u.test(escaped) ? `"${escaped}"` : escaped;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/gu, '&amp;')
      .replace(/</gu, '&lt;')
      .replace(/>/gu, '&gt;')
      .replace(/"/gu, '&quot;')
      .replace(/'/gu, '&#39;');
  }
}

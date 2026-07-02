import { Injectable, Optional } from '@nestjs/common';
import type { AnalysisMarkdownPayload } from './analysis-markdown.util';
import type {
  AnalysisKeyFinding,
  AnalysisRecommendationItem,
  AnalysisResultRecord,
} from '../../shared/types/domain';
import { AiGatewayService } from './ai-gateway.service';
import { AnalysisInsightEvidenceService } from './analysis-insight-evidence.service';
import {
  buildAnalysisDetailMarkdown,
  buildAnalysisMarkdownOutline,
  buildAnalysisWecomMarkdown,
  buildAnalysisWorkbenchMarkdown,
} from './analysis-markdown.util';
import { OpenApiMarkdownSnapshotService } from './openapi-markdown-snapshot.service';

type ResultRowProfile = {
  kind: 'detail' | 'customer' | 'aggregate';
  rowUnitLabel: string;
  emptyLabel: string;
  focusTitle: string;
  representativeLabel: string;
  recommendationTitle: string;
};

@Injectable()
export class AnalysisRichReportService {
  constructor(
    private readonly analysisInsightEvidenceService: AnalysisInsightEvidenceService,
    private readonly aiGatewayService: AiGatewayService,
    @Optional()
    private readonly openApiMarkdownSnapshotService?: OpenApiMarkdownSnapshotService,
  ) {}

  /**
   * 把统一结果记录增强成 richer report，并派生多渠道 Markdown。
   *
   * 参数说明：`result` 为已通过基础一致性校验的统一结果记录。
   * 返回值：补齐 richer report 字段后的新结果记录。
   */
  async enrich(result: AnalysisResultRecord): Promise<AnalysisResultRecord> {
    const evidence = this.analysisInsightEvidenceService.buildEvidence({
      reportTitle: result.report.reportTitle,
      variant: result.report.variant,
      templateId: result.matchedAdapter,
      tableRows: result.tableRows,
      metricCards: result.metricCards,
      keyFindings: result.keyFindings,
    });
    const markdownSnapshotContext =
      this.openApiMarkdownSnapshotService?.readRelevantSnapshotContext(
        [
          result.questionText,
          result.report.reportTitle,
          result.report.executiveSummary,
          result.summary,
          result.matchedAdapter,
        ].filter(Boolean).join('\n'),
      ) ?? '';
    const aiNarrative = await this.aiGatewayService.generateRichAnalysisReport({
      title: result.report.reportTitle,
      summary: result.report.executiveSummary,
      scopeSummary: result.scopeSummary,
      metricCards: result.metricCards,
      rowPreview: this.selectRepresentativeRows(result.tableRows, 5).map((row) =>
        this.buildRowPreview(row),
      ),
      appliedFilters: result.appliedFilters.map((item) => ({
        label: item.label,
        value: item.value,
      })),
      trendSummary: evidence.trendInsight.summary,
      forecastSummary: evidence.forecastInsight.summary,
      anomalySummaries: evidence.anomalyInsights.map((item) => `${item.title}：${item.detail}`),
      riskSummaries: evidence.riskInsights.map((item) => `${item.title}：${item.detail}`),
      recommendationSummaries: evidence.recommendations.map((item) => `${item.title}：${item.action}`),
      markdownSnapshotContext,
    });
    const fallbackNarrative = this.buildDeterministicNarrative(result, evidence);
    const analysisConfidence = this.resolveAnalysisConfidence(evidence);
    const evidenceSummary = aiNarrative?.evidenceNarrative ?? fallbackNarrative.evidenceNarrative;
    const executiveSummary = aiNarrative?.executiveSummary ?? fallbackNarrative.executiveSummary;
    const datasetId = result.report.datasetReferences[0]?.datasetId ?? `${result.requestId}_dataset`;
    const narrativeKeyFindings =
      aiNarrative?.keyFindings?.length
        ? this.sanitizeKeyFindings(
            aiNarrative.keyFindings.map((item, index) => ({
              title: item.title,
              detail: item.detail,
              tone: item.tone,
              datasetId: result.report.datasetReferences[0]?.datasetId ?? `dataset_${index + 1}`,
            })),
            result,
          )
        : fallbackNarrative.keyFindings;
    const keyFindings = this.mergeKeyFindings(
      narrativeKeyFindings,
      this.buildStructuralKeyFindings(result, datasetId),
    );
    const trendSummary = this.normalizeTrendNarrative(
      aiNarrative?.trendNarrative ?? fallbackNarrative.trendNarrative,
      fallbackNarrative.trendNarrative,
      result,
    );
    const trendInsight = {
      ...evidence.trendInsight,
      summary: trendSummary,
    };
    const riskSummaries = this.normalizeRiskNarratives(
      aiNarrative?.riskNarratives ?? fallbackNarrative.riskNarratives,
      fallbackNarrative.riskNarratives,
      result,
      evidence,
    );
    const recommendations = aiNarrative?.recommendationNarratives?.length
      ? evidence.recommendations.map((item, index) => ({
          ...item,
          action: aiNarrative.recommendationNarratives[index] ?? item.action,
        }))
      : fallbackNarrative.recommendations;
    const enrichedRecommendations = this.mergeRecommendations(
      recommendations,
      this.buildDeterministicRecommendations(
        result,
        evidence,
        this.selectRepresentativeRows(result.tableRows, 3),
      ),
    );
    const recommendationSummaries = enrichedRecommendations.map(
      (item) => `${item.title}：${item.action}`,
    );
    const markdownPayload: AnalysisMarkdownPayload = {
      title: result.report.reportTitle,
      summary: executiveSummary,
      groundedExplanation: trendSummary,
      metricCards: result.metricCards,
      keyFindings,
      nextBestQuestions: result.nextBestQuestions,
      scopeSummary: result.scopeSummary,
      temporalScope: result.temporalScope,
      trendInsight,
      forecastInsight: evidence.forecastInsight,
      riskSummaries,
      recommendations: enrichedRecommendations,
      recommendationSummaries,
      evidenceSummary,
      rows: result.tableRows,
      appliedFilters: result.appliedFilters,
      sourceNotes: result.report.sourceNotes,
      footnotes: result.report.footnotes,
      secondaryViewSummaries: this.buildSecondaryViewSummaries(result.secondaryViews),
      variant: result.report.variant,
    };

    const workbenchMarkdown = buildAnalysisWorkbenchMarkdown(markdownPayload);
    const detailMarkdown = buildAnalysisDetailMarkdown(markdownPayload);
    const wecomMarkdown = buildAnalysisWecomMarkdown(markdownPayload);
    const markdownOutline = buildAnalysisMarkdownOutline(markdownPayload);

    return {
      ...result,
      report: {
        ...result.report,
        analysisConfidence,
        predictionMode: 'BALANCED_RANGE_FORECAST',
        predictionHorizon: evidence.forecastInsight.horizonLabel,
        executiveSummary,
        trendInsight,
        forecastInsight: evidence.forecastInsight,
        anomalyInsights: evidence.anomalyInsights,
        riskInsights: evidence.riskInsights,
        recommendations: enrichedRecommendations,
        confidenceSummary: `当前分析可信度为 ${analysisConfidence}。`,
        evidenceSummary,
        keyFindings,
        groundedMarkdown: detailMarkdown,
        workbenchMarkdown,
        detailMarkdown,
        wecomMarkdown,
        markdownOutline,
      },
      keyFindings,
      groundedMarkdown: detailMarkdown,
      wecomMarkdown,
      markdownOutline,
    };
  }

  /**
   * 根据预测状态、风险和异常情况推导整体分析可信度。
   *
   * 参数说明：`evidence` 为 richer report 事实包。
   * 返回值：`HIGH` / `MEDIUM` / `LOW` 之一。
   */
  private resolveAnalysisConfidence(
    evidence: ReturnType<AnalysisInsightEvidenceService['buildEvidence']>,
  ): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (evidence.forecastInsight.status === 'UNAVAILABLE') {
      return 'MEDIUM';
    }

    if (
      evidence.anomalyInsights.some((item) => item.severity === 'HIGH') ||
      evidence.riskInsights.some((item) => item.severity === 'HIGH')
    ) {
      return 'LOW';
    }

    return evidence.forecastInsight.confidenceLevel === 'HIGH' ? 'HIGH' : 'MEDIUM';
  }

  /**
   * 构造企微/Web 可读的报告区块摘要。
   *
   * 参数说明：`secondaryViews` 为统一结果中的二级视图列表。
   * 返回值：返回区块标题和行数，用于企微说明“本次报告实际包含哪些内容”。
   * 调用注意事项：这里只输出摘要，不复制明细数据，避免企微消息过长。
   */
  private buildSecondaryViewSummaries(
    secondaryViews: AnalysisResultRecord['secondaryViews'],
  ): Array<{ title: string; rowCount: number; renderType: string }> {
    return secondaryViews
      .filter((item) => (item.rows?.length ?? 0) > 0)
      .map((item) => ({
        title: item.title,
        rowCount: item.rows?.length ?? 0,
        renderType: this.formatViewRenderType(item.viewType),
      }));
  }

  /**
   * 将内部视图类型转成企微可读的呈现方式。
   *
   * 参数说明：`viewType` 为统一结果视图类型。
   * 返回值：返回表格、指标卡或适合图表区块呈现的说明。
   */
  private formatViewRenderType(viewType: AnalysisResultRecord['secondaryViews'][number]['viewType']): string {
    if (['LINE_CHART', 'BAR_CHART', 'PIE_CHART'].includes(viewType)) {
      return '图表区块';
    }

    if (['DETAIL_TABLE', 'RANKING_TABLE'].includes(viewType)) {
      return '表格';
    }

    return '指标卡';
  }

  /**
   * 生成“结果依据”摘要，帮助查询页和一致性校验识别 richer report 的可追溯来源。
   *
   * 参数说明：
   * - `result`：基础结果记录。
   * - `evidence`：richer report 事实包。
   * 返回值：用于 Markdown 与结构化报告的依据说明文本。
   */
  private buildEvidenceSummary(
    result: AnalysisResultRecord,
    evidence: ReturnType<AnalysisInsightEvidenceService['buildEvidence']>,
  ): string {
    const rowProfile = this.resolveRowProfile(result.tableRows);
    const fragments = [
      `本次结果基于 ${result.tableRows.length} 条${rowProfile.rowUnitLabel}和 ${result.metricCards.length} 个指标卡计算。`,
      evidence.trendInsight.summary,
      evidence.forecastInsight.summary,
    ].filter(Boolean);
    return fragments.join(' ');
  }

  /**
   * 从明细结果中补充确定性结构洞察，避免 AI 只输出泛化摘要。
   */
  private buildStructuralKeyFindings(
    result: AnalysisResultRecord,
    datasetId: string,
  ): AnalysisKeyFinding[] {
    const findings: AnalysisKeyFinding[] = [];
    const rowProfile = this.resolveRowProfile(result.tableRows);
    const amountTotal = result.tableRows.reduce(
      (sum, row) => sum + this.resolveBusinessAmount(row),
      0,
    );
    if (result.tableRows.length > 0 && amountTotal > 0) {
      findings.push({
        title: '金额结构',
        detail: `本次返回 ${result.tableRows.length} 条${rowProfile.rowUnitLabel}，金额合计 ${this.formatNumber(amountTotal)}，单均约 ${this.formatNumber(amountTotal / result.tableRows.length)}。`,
        tone: 'neutral',
        datasetId,
      });
    }

    const topTeams = this.summarizeTopGroups(result.tableRows, ['team_name', 'teamName', '团队'], 3);
    if (topTeams) {
      findings.push({
        title: '团队分布',
        detail: `新增记录主要分布在 ${topTeams}。`,
        tone: 'neutral',
        datasetId,
      });
    }

    const topStages = this.summarizeTopGroups(result.tableRows, ['stage_name', 'stageName', '销售阶段', '阶段'], 3);
    if (topStages) {
      findings.push({
        title: '阶段结构',
        detail: `当前销售阶段以 ${topStages} 为主，适合优先核对高阶段与大额商机的推进计划。`,
        tone: 'neutral',
        datasetId,
      });
    }

    const topRows = this.selectRepresentativeRows(result.tableRows, 2)
      .map((row) => this.formatBusinessRow(row))
      .filter(Boolean);
    if (topRows.length > 0) {
      findings.push({
        title: rowProfile.focusTitle,
        detail: `按金额优先识别的${rowProfile.representativeLabel}包括：${topRows.join('；')}。`,
        tone: 'positive',
        datasetId,
      });
    }

    return findings;
  }

  /**
   * 合并 AI 叙述和程序事实，按标题去重并控制报告可读长度。
   */
  private mergeKeyFindings(
    primary: AnalysisKeyFinding[],
    supplemental: AnalysisKeyFinding[],
  ): AnalysisKeyFinding[] {
    const seenTitles = new Set<string>();
    const merged: AnalysisKeyFinding[] = [];
    for (const item of [...primary, ...supplemental]) {
      const normalizedTitle = item.title.replace(/\s+/gu, '');
      if (seenTitles.has(normalizedTitle)) {
        continue;
      }
      seenTitles.add(normalizedTitle);
      merged.push(item);
    }

    return merged.slice(0, 6);
  }

  /**
   * 过滤 AI 关键发现中的旧降级文案，避免非空模板结果继续展示“关键指标缺失/不可预测”等误导结论。
   *
   * 参数说明：
   * - `items`：AI 生成的关键发现列表。
   * - `result`：当前统一结果包，用于判断是否已有真实事实。
   * 返回值：清理后的关键发现列表；空结果场景保留原始提示。
   */
  private sanitizeKeyFindings(
    items: AnalysisKeyFinding[],
    result: AnalysisResultRecord,
  ): AnalysisKeyFinding[] {
    if (!this.hasResultFacts(result)) {
      return items;
    }

    return items.filter((item) => !this.containsMisleadingUnavailableFinding(`${item.title} ${item.detail}`));
  }

  /**
   * 合并 AI 建议和确定性建议，确保至少包含可落地的重点结果动作。
   */
  private mergeRecommendations(
    primary: AnalysisRecommendationItem[],
    supplemental: AnalysisRecommendationItem[],
  ): AnalysisRecommendationItem[] {
    const seenTitles = new Set<string>();
    const merged: AnalysisRecommendationItem[] = [];
    for (const item of [...primary, ...supplemental]) {
      const normalizedTitle = item.title.replace(/\s+/gu, '');
      if (seenTitles.has(normalizedTitle)) {
        continue;
      }
      seenTitles.add(normalizedTitle);
      merged.push(item);
    }

    return merged.slice(0, 4);
  }

  /**
   * AI 不可用时基于真实结果包生成可读分析，避免把“已生成数据结果”当成报告交付。
   */
  private buildDeterministicNarrative(
    result: AnalysisResultRecord,
    evidence: ReturnType<AnalysisInsightEvidenceService['buildEvidence']>,
  ): {
    executiveSummary: string;
    keyFindings: AnalysisKeyFinding[];
    trendNarrative: string;
    riskNarratives: string[];
    recommendationNarratives: string[];
    evidenceNarrative: string;
    recommendations: AnalysisRecommendationItem[];
  } {
    const datasetId = result.report.datasetReferences[0]?.datasetId ?? `${result.requestId}_dataset`;
    const rowCount = result.tableRows.length;
    const rowProfile = this.resolveRowProfile(result.tableRows);
    const metricSummary = this.formatMetricCards(result.metricCards);
    const representativeRows = this.selectRepresentativeRows(result.tableRows, 3);
    const representativeSummary = this.formatRepresentativeRows(representativeRows);
    const rowCountText =
      rowCount > 0
        ? `本次返回 ${rowCount} 条${rowProfile.rowUnitLabel}`
        : `本次未返回${rowProfile.emptyLabel}`;
    const metricText = metricSummary ? `，核心指标为 ${metricSummary}` : '';
    const keyFindings: AnalysisKeyFinding[] = [
      {
        title: '结果规模',
        detail: `${rowCountText}${metricText}。`,
        tone: rowCount > 0 ? 'neutral' : 'risk',
        datasetId,
      },
    ];

    if (representativeSummary) {
      keyFindings.push({
        title: rowProfile.focusTitle,
        detail: `按金额和业务字段优先抽样，代表性${rowProfile.representativeLabel}包括：${representativeSummary}。`,
        tone: 'neutral',
        datasetId,
      });
    }

    keyFindings.push({
      title: evidence.trendInsight.status === 'READY' ? '趋势判断' : '分析口径',
      detail:
        evidence.trendInsight.status === 'READY'
          ? evidence.trendInsight.summary
          : '当前未返回可计算数值，需先确认筛选条件或权限范围后再生成趋势判断。',
      tone: evidence.trendInsight.status === 'READY' ? 'positive' : 'neutral',
      datasetId,
    });

    const executiveSummary = `${result.report.reportTitle}已基于真实查询结果生成分析：${rowCountText}${metricText}。${
      representativeSummary ? `当前应优先关注 ${representativeSummary}。` : ''
    }`;
    const trendNarrative =
      evidence.trendInsight.status === 'READY'
        ? evidence.trendInsight.summary
        : `${result.report.reportTitle} 当前未返回可计算数值，需先确认筛选条件或权限范围后再生成趋势判断。`;
    const riskNarratives = this.buildDeterministicRiskNarratives(result, evidence);
    const recommendations = this.buildDeterministicRecommendations(
      result,
      evidence,
      representativeRows,
    );
    const recommendationNarratives = recommendations.map((item) => item.action);
    const evidenceNarrative = [
      this.buildEvidenceSummary(result, evidence),
      representativeSummary
        ? `代表性${rowProfile.representativeLabel}：${representativeSummary}。`
        : '',
    ]
      .filter(Boolean)
      .join(' ');

    return {
      executiveSummary,
      keyFindings: keyFindings.slice(0, 4),
      trendNarrative,
      riskNarratives,
      recommendationNarratives,
      evidenceNarrative,
      recommendations,
    };
  }

  /**
   * 从真实明细和趋势事实生成关注事项，避免把非连续明细误判为不可预测。
   */
  private buildDeterministicRiskNarratives(
    result: AnalysisResultRecord,
    evidence: ReturnType<AnalysisInsightEvidenceService['buildEvidence']>,
  ): string[] {
    const riskNarratives = [
      ...evidence.anomalyInsights.map((item) => `${item.title}：${item.detail}`),
      ...evidence.riskInsights.map((item) => `${item.title}：${item.detail}`),
    ];

    if (riskNarratives.length > 0) {
      return riskNarratives;
    }

    if (result.tableRows.length === 0) {
      return ['当前查询没有返回明细，需先调整筛选条件或确认权限范围后再做经营判断。'];
    }

    return [
      '当前结论只基于本次已返回明细和指标卡，若用于经营动作分派，需要结合最新跟进记录、阶段变更和负责人反馈复核。',
    ];
  }

  /**
   * 清理 AI 叙述中的旧降级口径：只要结果包有真实数据，就不能把报告写成不可预测。
   */
  private normalizeTrendNarrative(
    narrative: string,
    fallback: string,
    result: AnalysisResultRecord,
  ): string {
    if (!this.hasResultFacts(result) || !this.containsLegacyUnavailableWording(narrative)) {
      return narrative;
    }

    const cleanedNarrative = narrative
      .replace(/当前结果虽?缺少完整时间序列[，,但]*/gu, '当前基于已返回结果事实，')
      .replace(/当前结果包缺少连续时间序列[，,。]?/gu, '当前基于已返回结果事实，')
      .replace(/当前不是连续时间序列结果[，,。]?/gu, '当前基于已返回结果事实，')
      .replace(/时间序列不足|预测暂不可用|不具备预测条件|不可预测|不能预测|样本点偏少/gu, '已按短期参考预测处理')
      .replace(/\s+/gu, ' ')
      .trim();

    if (
      cleanedNarrative &&
      !this.containsLegacyUnavailableWording(cleanedNarrative) &&
      !this.isGenericUnavailableRewrite(cleanedNarrative)
    ) {
      return cleanedNarrative;
    }

    return this.containsLegacyUnavailableWording(fallback)
      ? `${result.report.reportTitle} 已基于当前结果快照形成方向性判断，适合围绕现有规模、重点对象和阶段结构安排短期跟进。`
      : fallback;
  }

  /**
   * 清理风险区块中的“样本不足/预测不可用”误报，仅保留真实业务风险和可执行复核边界。
   */
  private normalizeRiskNarratives(
    narratives: string[],
    fallback: string[],
    result: AnalysisResultRecord,
    evidence: ReturnType<AnalysisInsightEvidenceService['buildEvidence']>,
  ): string[] {
    if (!this.hasResultFacts(result)) {
      return narratives;
    }

    const cleaned = narratives.filter((item) => !this.containsLegacyUnavailableWording(item));
    if (cleaned.length > 0) {
      return cleaned;
    }

    const fallbackCleaned = fallback.filter((item) => !this.containsLegacyUnavailableWording(item));
    if (fallbackCleaned.length > 0) {
      return fallbackCleaned;
    }

    if (evidence.riskInsights.length > 0 || evidence.anomalyInsights.length > 0) {
      return [
        ...evidence.anomalyInsights.map((item) => `${item.title}：${item.detail}`),
        ...evidence.riskInsights.map((item) => `${item.title}：${item.detail}`),
      ];
    }

    return [];
  }

  /**
   * 判断结果包是否已有可分析事实，包含明细或指标卡任一有效数据即可。
   */
  private hasResultFacts(result: AnalysisResultRecord): boolean {
    return result.tableRows.length > 0 || result.metricCards.some((item) => item.value !== undefined && item.value !== null && item.value !== '');
  }

  /**
   * 识别历史版本遗留的“不可预测/数据不足”文案，避免继续污染线上报告。
   */
  private containsLegacyUnavailableWording(value: string): boolean {
    return /时间序列不足|缺少连续时间序列|缺少完整时间序列|不是连续时间序列|预测暂不可用|不具备预测条件|不可预测|不能预测|样本点偏少|缺少可预测数据|当前未返回可计算数值/u.test(
      value,
    );
  }

  /**
   * 识别 AI 关键发现中特定的“系统异常/关键指标缺失”误报，这类文案通常来自旧提示词而非真实数据事实。
   *
   * 参数说明：`value` 为标题与详情拼接文本。
   * 返回值：命中误导性不可用文案时返回 true。
   */
  private containsMisleadingUnavailableFinding(value: string): boolean {
    return (
      this.containsLegacyUnavailableWording(value) ||
      /关键指标字段为空|关键指标缺失|未触发有效聚合逻辑|趋势事实与预测事实.*无计算数值|系统返回异常|数据权限配置存在偏差/u.test(
        value,
      )
    );
  }

  /**
   * 判断清洗后是否只剩“已按短期参考预测处理”这类泛化占位，避免把机械替换结果展示给业务用户。
   *
   * 参数说明：`value` 为已清洗趋势文本。
   * 返回值：只表达降级占位、缺少真实经营含义时返回 true。
   */
  private isGenericUnavailableRewrite(value: string): boolean {
    return /^当前结果?已按短期参考预测处理[。.]?$/u.test(value);
  }

  /**
   * 基于真实记录生成动作建议，优先指向高金额或信息完整的代表性对象。
   */
  private buildDeterministicRecommendations(
    result: AnalysisResultRecord,
    evidence: ReturnType<AnalysisInsightEvidenceService['buildEvidence']>,
    representativeRows: Array<Record<string, unknown>>,
  ): AnalysisRecommendationItem[] {
    const firstRepresentative = representativeRows[0];
    if (!firstRepresentative) {
      return evidence.recommendations;
    }

    const rowProfile = this.resolveRowProfile(representativeRows);
    const targetLabel = this.formatBusinessRow(firstRepresentative) || result.report.reportTitle;
    const action =
      rowProfile.kind === 'detail'
        ? `优先核对 ${targetLabel} 的负责人、阶段、预计金额和下一步跟进计划，确认是否需要推进资源或风险提醒。`
        : `优先核对 ${targetLabel} 对应的统计口径、指标拆分和业务原因，确认是否需要继续下钻到客户、项目或负责人。`;
    return [
      {
        priority: 'HIGH',
        title: rowProfile.recommendationTitle,
        action,
        reason:
          rowProfile.kind === 'detail'
            ? '该记录在当前结果包中金额或业务字段完整度靠前，适合作为第一批经营动作入口。'
            : '该汇总项在当前结果包中指标靠前，适合作为第一批复核和下钻入口。',
        evidenceKeys: ['representative-row'],
      },
      ...evidence.recommendations.filter((item) => item.title !== '持续观察当前趋势').slice(0, 2),
    ];
  }

  private buildRowPreview(row: Record<string, unknown>): Record<string, unknown> {
    const preferredKeys = [
      'team_name',
      'department_name',
      'customer_name',
      'project_name',
      'opportunity_name',
      'owner_name',
      'stage_name',
      'expected_amount',
      'amount',
      'contract_amount',
      'annual_forecast',
      'bucket_label',
      'created_at',
      'expected_sign_date',
    ];
    const previewEntries = preferredKeys
      .filter((key) => row[key] !== undefined && row[key] !== null && row[key] !== '')
      .slice(0, 4)
      .map((key) => [key, row[key]]);

    return Object.fromEntries(previewEntries);
  }

  private selectRepresentativeRows(
    rows: Array<Record<string, unknown>>,
    limit: number,
  ): Array<Record<string, unknown>> {
    return [...rows]
      .sort((left, right) => this.resolveBusinessAmount(right) - this.resolveBusinessAmount(left))
      .slice(0, limit);
  }

  private resolveBusinessAmount(row: Record<string, unknown>): number {
    const amountKeys = [
      'expected_amount',
      'amount',
      'value',
      'contract_amount',
      'annual_forecast',
      'valid_income',
      'committed_amount',
      'total_amount',
    ];
    for (const key of amountKeys) {
      const value = this.toNumber(row[key]);
      if (Number.isFinite(value) && value > 0) {
        return value;
      }
    }

    return 0;
  }

  private formatMetricCards(metricCards: AnalysisResultRecord['metricCards']): string {
    return metricCards
      .filter((item) => item.value !== undefined && item.value !== null && item.value !== '')
      .slice(0, 4)
      .map((item) => `${item.name} ${item.value}`)
      .join('、');
  }

  private formatRepresentativeRows(rows: Array<Record<string, unknown>>): string {
    return rows
      .map((row) => this.formatBusinessRow(row))
      .filter(Boolean)
      .join('；');
  }

  private summarizeTopGroups(
    rows: Array<Record<string, unknown>>,
    keys: string[],
    limit: number,
  ): string {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const label = this.pickString(row, keys);
      if (!label) {
        continue;
      }
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, limit)
      .map(([label, count]) => `${label} ${count} 条`)
      .join('、');
  }

  private formatBusinessRow(row: Record<string, unknown>): string {
    const primaryObjectParts = [
      this.pickString(row, ['customer_name', 'customerName', '客户名称']),
      this.pickString(row, [
        'project_name',
        'projectName',
        'opportunity_name',
        'name',
        '项目名称',
        '商机名称',
      ]),
    ].filter(Boolean);
    const fallbackDimensionParts = [
      this.pickString(row, ['team_name', 'teamName', '团队']),
      this.pickString(row, ['department_name', 'departmentName', '所属部门', '部门']),
      this.pickString(row, ['owner_name', 'ownerName', '负责人']),
      this.pickString(row, ['year_label', 'yearLabel', 'quarter_label', 'quarterLabel', 'month_label', 'monthLabel']),
    ].filter(Boolean);
    const parts = [
      ...primaryObjectParts,
      ...(primaryObjectParts.length > 0 ? [] : fallbackDimensionParts),
      ...(primaryObjectParts.length > 0
        ? [this.pickString(row, ['year_label', 'yearLabel', 'quarter_label', 'quarterLabel', 'month_label', 'monthLabel'])]
        : []),
      this.pickString(row, ['stage_name', 'stageName', '阶段']),
      this.pickString(row, ['owner_name', 'ownerName', '负责人']),
    ].filter(Boolean);
    const amount = this.resolveBusinessAmount(row);
    if (amount > 0) {
      parts.push(`金额 ${this.formatNumber(amount)}`);
    }

    return parts.join(' / ');
  }

  /**
   * 根据返回行字段识别结果粒度，避免把团队、季度、年度等汇总行误称为业务明细。
   *
   * 参数说明：`rows` 为本次查询返回的统一结果行。
   * 返回值：用于摘要、重点区块和建议文案的中文粒度标签。
   */
  private resolveRowProfile(rows: Array<Record<string, unknown>>): ResultRowProfile {
    const hasProjectDetail = rows.some((row) =>
      Boolean(
        this.pickString(row, [
          'project_name',
          'projectName',
          'opportunity_name',
          'opportunity_code',
          '商机名称',
          '项目名称',
        ]) ||
          this.pickString(row, ['stage_name', 'stageName', '销售阶段', '阶段']) ||
          this.pickString(row, ['expected_sign_date', 'expectedSignDate', '预计签单日期']),
      ),
    );

    if (hasProjectDetail) {
      return {
        kind: 'detail',
        rowUnitLabel: '明细',
        emptyLabel: '明细',
        focusTitle: '重点明细',
        representativeLabel: '明细',
        recommendationTitle: '优先复核重点明细',
      };
    }

    const hasCustomerDimension = rows.some((row) =>
      Boolean(this.pickString(row, ['customer_name', 'customerName', '客户名称', '最终客户'])),
    );
    if (hasCustomerDimension) {
      return {
        kind: 'customer',
        rowUnitLabel: '客户维度结果',
        emptyLabel: '客户维度结果',
        focusTitle: '重点客户',
        representativeLabel: '客户',
        recommendationTitle: '优先复核重点客户',
      };
    }

    return {
      kind: 'aggregate',
      rowUnitLabel: '汇总结果',
      emptyLabel: '汇总结果',
      focusTitle: '重点汇总项',
      representativeLabel: '汇总项',
      recommendationTitle: '优先复核重点汇总项',
    };
  }

  private pickString(row: Record<string, unknown>, keys: string[]): string | undefined {
    for (const key of keys) {
      const value = row[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
      if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
      }
    }

    return undefined;
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value.replace(/,/gu, ''));
      return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
  }

  private formatNumber(value: number): string {
    return Number.isInteger(value)
      ? value.toLocaleString('zh-CN')
      : value.toLocaleString('zh-CN', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        });
  }
}

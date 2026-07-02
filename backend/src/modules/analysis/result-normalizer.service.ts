import { Injectable } from '@nestjs/common';
import type {
  AnalysisReportPayload,
  AnalysisResultRecord,
} from '../../shared/types/domain';

@Injectable()
export class ResultNormalizerService {
  normalize(params: {
    requestId: string;
    report: AnalysisReportPayload;
    dataFreshnessAt: string;
    consistencyToken: string;
  }): AnalysisResultRecord {
    const primaryChart = params.report.chartBlocks[0];
    const primaryTable = this.resolvePrimaryTable(params.report, primaryChart?.datasetId);
    return {
      requestId: params.requestId,
      title: params.report.reportTitle,
      summary: params.report.executiveSummary,
      report: params.report,
      temporalScope: params.report.temporalScope,
      scopeSummary: params.report.scopeSummary,
      appliedFilters: params.report.appliedFilters,
      metricCards: params.report.metricCards,
      primaryView: primaryChart
        ? {
            viewType: primaryChart.viewType,
            title: primaryChart.title,
            series: primaryChart.series,
          }
        : undefined,
      secondaryViews: params.report.tableBlocks.slice(1).map((item) => ({
        viewType: 'DETAIL_TABLE',
        title: item.title,
        rows: item.rows,
      })),
      tableRows: primaryTable?.rows ?? [],
      keyFindings: params.report.keyFindings,
      rowCount: primaryTable?.rows.length ?? 0,
      dataFreshnessAt: params.dataFreshnessAt,
      consistencyToken: params.consistencyToken,
      explanation: params.report.explanation,
      groundedExplanation: params.report.groundedExplanation,
      nextBestQuestions: params.report.nextBestQuestions,
      groundedMarkdown: params.report.groundedMarkdown,
      wecomMarkdown: params.report.wecomMarkdown,
      markdownOutline: params.report.markdownOutline,
      emptyReason: params.report.emptyState,
      streamBlocks: [],
      availableActions: params.report.availableActions,
      returnedAt: new Date().toISOString(),
    };
  }

  private resolvePrimaryTable(
    report: AnalysisReportPayload,
    primaryChartDatasetId?: string,
  ): AnalysisReportPayload['tableBlocks'][number] | undefined {
    if (!primaryChartDatasetId) {
      return report.tableBlocks[0];
    }

    return (
      report.tableBlocks.find((item) => item.datasetId === primaryChartDatasetId) ??
      report.tableBlocks[0]
    );
  }
}

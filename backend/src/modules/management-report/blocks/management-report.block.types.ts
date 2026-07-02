export type ManagementReportBlockSize = 'full' | 'wide' | 'compact';

export type ManagementReportBlockLayoutHint =
  | 'metric-row'
  | 'two-column'
  | 'three-column'
  | 'table-priority';

export interface ManagementReportBlockBase {
  blockId: string;
  blockType:
    | 'metric-strip'
    | 'bar-ranking'
    | 'trend'
    | 'funnel'
    | 'matrix-table'
    | 'detail-table'
    | 'insight-table'
    | 'data-quality'
    | 'record-preview';
  title: string;
  description?: string;
  size: ManagementReportBlockSize;
  layoutHint?: ManagementReportBlockLayoutHint;
}

export interface ManagementReportMetricStripItem {
  label: string;
  value: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
}

export interface ManagementReportMetricStripBlock
  extends ManagementReportBlockBase {
  blockType: 'metric-strip';
  items: ManagementReportMetricStripItem[];
}

export interface ManagementReportBarRankingRow {
  label: string;
  value: number;
  secondaryLabel?: string;
  secondaryValue?: string;
}

export interface ManagementReportBarRankingBlock
  extends ManagementReportBlockBase {
  blockType: 'bar-ranking';
  rows: ManagementReportBarRankingRow[];
  unitLabel?: string;
}

export interface ManagementReportTrendPoint {
  label: string;
  value: number;
}

export interface ManagementReportTrendBlock extends ManagementReportBlockBase {
  blockType: 'trend';
  points: ManagementReportTrendPoint[];
  unitLabel?: string;
}

export interface ManagementReportFunnelStage {
  label: string;
  value: number;
  conversionLabel?: string;
}

export interface ManagementReportFunnelBlock extends ManagementReportBlockBase {
  blockType: 'funnel';
  stages: ManagementReportFunnelStage[];
}

export interface ManagementReportMatrixRow {
  label: string;
  values: string[];
}

export interface ManagementReportMatrixTableBlock
  extends ManagementReportBlockBase {
  blockType: 'matrix-table';
  columns: string[];
  rows: ManagementReportMatrixRow[];
}

export interface ManagementReportTableColumn {
  key: string;
  label: string;
}

export interface ManagementReportDetailTableBlock
  extends ManagementReportBlockBase {
  blockType: 'detail-table' | 'record-preview';
  columns: ManagementReportTableColumn[];
  rows: Array<Record<string, string>>;
}

export interface ManagementReportInsightTableRow {
  label: string;
  value: string;
}

export interface ManagementReportInsightTableBlock
  extends ManagementReportBlockBase {
  blockType: 'insight-table';
  rows: ManagementReportInsightTableRow[];
}

export interface ManagementReportDataQualityRow {
  tableName: string;
  fieldName: string;
  filledCount: string;
  missingCount: string;
  completeness: string;
}

export interface ManagementReportDataQualityBlock
  extends ManagementReportBlockBase {
  blockType: 'data-quality';
  rows: ManagementReportDataQualityRow[];
}

export type ManagementReportBlock =
  | ManagementReportMetricStripBlock
  | ManagementReportBarRankingBlock
  | ManagementReportTrendBlock
  | ManagementReportFunnelBlock
  | ManagementReportMatrixTableBlock
  | ManagementReportDetailTableBlock
  | ManagementReportInsightTableBlock
  | ManagementReportDataQualityBlock;

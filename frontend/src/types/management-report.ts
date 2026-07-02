export type ManagementReportPresetKey =
  | 'q1'
  | 'q2'
  | 'q3'
  | 'q4'
  | 'this-month'
  | 'this-year'
  | 'last-30-days'
  | 'last-90-days'
  | 'custom';

export type ManagementReportSectionKey =
  | 'regional'
  | 'leads'
  | 'lead-conversion'
  | 'lead-opportunity'
  | 'opportunities'
  | 'customers'
  | 'agents'
  | 'products'
  | 'acceptance'
  | 'collections'
  | 'risks';

export type ManagementReportTabKey =
  | 'overview'
  | 'executive-summary'
  | ManagementReportSectionKey;

export interface ManagementReportFilter {
  departmentId: string;
  presetKey: ManagementReportPresetKey;
  startDate: string;
  endDate: string;
}

export interface ManagementReportDepartmentNode {
  id: string;
  label: string;
  parentId?: string;
  selectable: boolean;
  children?: ManagementReportDepartmentNode[];
}

export interface ManagementReportMetricCard {
  key: string;
  label: string;
  value: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
}

export interface ManagementReportHighlight {
  title: string;
  detail: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
}

export interface ManagementMetricDefinition {
  key: string;
  label: string;
  sourceTables: string[];
  sourceFields: string[];
  timeField: string;
  aggregation: 'count' | 'sum' | 'ratio' | 'distinct-count';
  formula?: string;
  description: string;
}

export type ManagementReportBlockSize = 'full' | 'wide' | 'compact';

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
    | 'record-preview'
    // 第 1 期新增 blockType，支持看板级富可视化
    | 'geo-map'
    | 'grouped-bar'
    | 'stacked-bar'
    | 'kpi-matrix'
    | 'concentration'
    | 'sortable-table'
    | 'composite-trend'
    | 'pie-distribution';
  title: string;
  description?: string;
  size: ManagementReportBlockSize;
  layoutHint?: 'metric-row' | 'two-column' | 'three-column' | 'table-priority';
}

export interface ManagementReportMetricStripBlock
  extends ManagementReportBlockBase {
  blockType: 'metric-strip';
  items: Array<{
    label: string;
    value: string;
    tone?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
  }>;
}

export interface ManagementReportBarRankingBlock
  extends ManagementReportBlockBase {
  blockType: 'bar-ranking';
  rows: Array<{
    label: string;
    value: number;
    secondaryLabel?: string;
    secondaryValue?: string;
  }>;
  unitLabel?: string;
}

export interface ManagementReportTrendBlock extends ManagementReportBlockBase {
  blockType: 'trend';
  points: Array<{
    label: string;
    value: number;
  }>;
  unitLabel?: string;
}

export interface ManagementReportFunnelBlock extends ManagementReportBlockBase {
  blockType: 'funnel';
  stages: Array<{
    label: string;
    value: number;
    conversionLabel?: string;
  }>;
}

export interface ManagementReportMatrixTableBlock
  extends ManagementReportBlockBase {
  blockType: 'matrix-table';
  columns: string[];
  rows: Array<{
    label: string;
    values: string[];
  }>;
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

export interface ManagementReportInsightTableBlock
  extends ManagementReportBlockBase {
  blockType: 'insight-table';
  rows: Array<{
    label: string;
    value: string;
  }>;
}

export interface ManagementReportDataQualityBlock
  extends ManagementReportBlockBase {
  blockType: 'data-quality';
  rows: Array<{
    tableName: string;
    fieldName: string;
    filledCount: string;
    missingCount: string;
    completeness: string;
  }>;
}

// ===== 第 1 期新增 block 类型定义 =====

/**
 * 地图覆盖 block：用于 31 省覆盖地图
 * 案例二全国代理商看板的核心可视化
 */
export interface ManagementReportGeoMapBlock extends ManagementReportBlockBase {
  blockType: 'geo-map';
  mapName: string; // 地图名称，默认 'china'
  regions: Array<{
    name: string; // 省份名称，如"广东"
    value: number; // 覆盖数量或金额
    extra?: string; // 附加信息，如代理商名称列表
  }>;
  totalRegionCount?: number; // 总省份数（如 31）
  coveredRegionCount?: number; // 已覆盖省份数
  unitLabel?: string;
}

/**
 * 分组柱状图 block：用于大区对比、分年对比
 * 案例二 4 大区签约额对比的核心可视化
 */
export interface ManagementReportGroupedBarBlock extends ManagementReportBlockBase {
  blockType: 'grouped-bar';
  categories: string[]; // X 轴分类，如 ["大北","大东","大南","大西"]
  series: Array<{
    name: string; // 系列名，如 "2024年"、"2025年"
    values: number[]; // 与 categories 对应的值
  }>;
  unitLabel?: string;
  direction?: 'vertical' | 'horizontal'; // 默认 vertical
}

/**
 * 堆叠柱状图 block：用于多层叠加对比
 */
export interface ManagementReportStackedBarBlock extends ManagementReportBlockBase {
  blockType: 'stacked-bar';
  categories: string[];
  series: Array<{
    name: string;
    values: number[];
  }>;
  unitLabel?: string;
  direction?: 'vertical' | 'horizontal';
}

/**
 * KPI 矩阵 block：用于多指标卡片矩阵
 * 案例一 4 张 KPI 卡片 + 案例二 6 张 KPI 卡片
 */
export interface ManagementReportKpiMatrixBlock extends ManagementReportBlockBase {
  blockType: 'kpi-matrix';
  metrics: Array<{
    label: string;
    value: string;
    unit?: string;
    tone?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
    trend?: 'up' | 'down' | 'flat';
    trendLabel?: string; // 如 "同比 +15.3%"
    sublabel?: string; // 如 "较上月"
  }>;
  columns?: number; // 矩阵列数，默认 4
}

/**
 * 集中度分析 block：TOP5/10/20 占比 + 自动洞察文案
 * 案例一集中度分析卡片 + 文本洞察框
 */
export interface ManagementReportConcentrationBlock extends ManagementReportBlockBase {
  blockType: 'concentration';
  totalValue: number; // 总金额
  totalUnits: number; // 总渠道数
  tiers: Array<{
    label: string; // 如 "TOP5"
    value: number; // 金额
    count: number; // 渠道数
    percentage: number; // 占比 0-100
  }>;
  oneTimeCount?: number; // 一次性合作渠道数
  oneTimePercentage?: number; // 一次性占比
  insights: string[]; // 自动洞察文案
  unitLabel?: string;
}

/**
 * 可排序筛选明细表 block：用 el-table 启用 sortable + filterable
 * 案例一全渠道排名表 + 合同明细表、案例二渠道商体系表
 */
export interface ManagementReportSortableTableBlock extends ManagementReportBlockBase {
  blockType: 'sortable-table';
  columns: Array<{
    key: string;
    label: string;
    sortable?: boolean;
    filterable?: boolean;
    width?: string;
    align?: 'left' | 'center' | 'right';
    isRank?: boolean; // 是否排名列（显示排名徽章）
    isAmount?: boolean; // 是否金额列（带金额条）
  }>;
  rows: Array<Record<string, string | number>>;
  searchable?: boolean; // 是否启用搜索
  searchPlaceholder?: string;
  pageSize?: number; // 分页大小，默认 10
  showSummary?: boolean; // 是否显示合计行
  summaryRow?: Record<string, string | number>;
}

/**
 * 复合趋势图 block：柱+线双轴复合
 * 案例一年度趋势（金额柱+数量线）、案例二近3年签约&商机趋势
 */
export interface ManagementReportCompositeTrendBlock extends ManagementReportBlockBase {
  blockType: 'composite-trend';
  categories: string[]; // X 轴，如 ["2023年前","2023","2024","2025","2026"]
  barSeries: Array<{
    name: string; // 如 "下单金额"
    values: number[];
  }>;
  lineSeries?: Array<{
    name: string; // 如 "下单数量"
    values: number[];
  }>;
  barUnitLabel?: string;
  lineUnitLabel?: string;
}

export type ManagementReportBlock =
  | ManagementReportMetricStripBlock
  | ManagementReportBarRankingBlock
  | ManagementReportTrendBlock
  | ManagementReportFunnelBlock
  | ManagementReportMatrixTableBlock
  | ManagementReportDetailTableBlock
  | ManagementReportInsightTableBlock
  | ManagementReportDataQualityBlock
  // 第 1 期新增 block 类型
  | ManagementReportGeoMapBlock
  | ManagementReportGroupedBarBlock
  | ManagementReportStackedBarBlock
  | ManagementReportKpiMatrixBlock
  | ManagementReportConcentrationBlock
  | ManagementReportSortableTableBlock
  | ManagementReportCompositeTrendBlock;

export interface ManagementReportSectionData {
  sectionKey: string;
  title: string;
  summary: string;
  state?: 'ready' | 'empty' | 'degraded';
  metricCards?: ManagementReportMetricCard[];
  highlights?: ManagementReportHighlight[];
  footnotes?: string[];
  blocks: ManagementReportBlock[];
  emptyReason?: string;
  sourceNotes?: ManagementMetricDefinition[];
}

export interface ManagementReportSectionMeta {
  sectionKey: ManagementReportSectionKey;
  title: string;
  loadMode: 'lazy';
  available: boolean;
  state: 'ready' | 'empty' | 'degraded';
  summary: string;
  timeBasis: string;
  unavailableReason?: string;
}

export interface ManagementReportTabItem {
  sectionKey: ManagementReportTabKey;
  title: string;
  summary: string;
  state: 'ready' | 'empty' | 'degraded';
  timeBasis?: string;
  loadMode: 'eager' | 'lazy';
  available: boolean;
  unavailableReason?: string;
}

export interface ManagementReportSnapshot {
  reportId: string;
  meta: {
    departmentId: string;
    departmentLabel: string;
    presetKey: ManagementReportPresetKey;
    startDate: string;
    endDate: string;
    scopeSummary: string;
    generatedAt: string;
  };
  overview: ManagementReportSectionData;
  executiveSummary: ManagementReportSectionData;
  sections: ManagementReportSectionMeta[];
}

export interface ManagementReportSectionPayload {
  reportId: string;
  sectionKey: ManagementReportSectionKey;
  generatedAt: string;
  timeBasis: string;
  scopeBasis: string;
  section: ManagementReportSectionData;
}

export interface ManagementReportOptionsPayload {
  scopeSummary: string;
  presets: Array<{
    key: ManagementReportPresetKey;
    label: string;
  }>;
  departments: ManagementReportDepartmentNode[];
  defaultFilter: ManagementReportFilter;
}

export interface ManagementReportExportPayload {
  reportId: string;
  fileName: string;
  mimeType: string;
  format: 'csv';
  content: string;
}

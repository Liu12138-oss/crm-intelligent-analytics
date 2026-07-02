import type {
  ManagementReportBlock,
  ManagementReportDetailTableBlock,
  ManagementReportMetricStripItem,
  ManagementReportTableColumn,
} from './blocks/management-report.block.types';
export type { ManagementReportBlock } from './blocks/management-report.block.types';

export const MANAGEMENT_REPORT_ROOT_DEPARTMENT_ID = 'all-company';

export const MANAGEMENT_REPORT_PRESETS = [
  { key: 'q1', label: '当年 Q1' },
  { key: 'q2', label: '当年 Q2' },
  { key: 'q3', label: '当年 Q3' },
  { key: 'q4', label: '当年 Q4' },
  { key: 'this-month', label: '本月' },
  { key: 'this-year', label: '本年' },
  { key: 'last-30-days', label: '近 30 天' },
  { key: 'last-90-days', label: '近 90 天' },
  { key: 'custom', label: '自定义时间范围' },
] as const;

export type ManagementReportPresetKey =
  (typeof MANAGEMENT_REPORT_PRESETS)[number]['key'];

export const MANAGEMENT_REPORT_SECTION_DEFINITIONS = [
  {
    sectionKey: 'regional',
    title: '区域经营',
    loadMode: 'lazy',
    available: true,
    state: 'ready',
    summary: '按区域、城市和行业观察商机结构与集中度。',
    timeBasis:
      '区域经营按 COALESCE(opportunities.get_time, opportunities.created_at) 统计期间发生商机。',
  },
  {
    sectionKey: 'leads',
    title: '线索',
    loadMode: 'lazy',
    available: true,
    state: 'ready',
    summary: '展示新增趋势、来源结构与高风险线索池。',
    timeBasis: '线索专题按 leads.created_at 统计筛选期内新增线索。',
  },
  {
    sectionKey: 'lead-conversion',
    title: '线索转化',
    loadMode: 'lazy',
    available: true,
    state: 'ready',
    summary: '基于 cohort 口径展示转客户、转商机与成交结果。',
    timeBasis:
      '线索转化以筛选期内创建线索为 cohort，并统计截至 endDate 的转化结果。',
  },
  {
    sectionKey: 'lead-opportunity',
    title: '线索机会',
    loadMode: 'lazy',
    available: true,
    state: 'ready',
    summary: '沉淀高潜机会池与下一步跟进对象。',
    timeBasis: '线索机会以未完全转化的高意向线索为对象池。',
  },
  {
    sectionKey: 'opportunities',
    title: '商机',
    loadMode: 'lazy',
    available: true,
    state: 'ready',
    summary: '展示商机池规模、阶段分布与风险负责人。',
    timeBasis:
      '商机专题按 COALESCE(opportunities.get_time, opportunities.created_at) 统计期间发生，并按 endDate 评估风险池。',
  },
  {
    sectionKey: 'customers',
    title: '客户',
    loadMode: 'lazy',
    available: true,
    state: 'ready',
    summary: '观察新增客户、激活率与无商机客户结构。',
    timeBasis:
      '客户新增按 customers.created_at 统计，客户池与激活率按截至 endDate 的客户截面统计。',
  },
  {
    sectionKey: 'agents',
    title: '代理商/生态',
    loadMode: 'lazy',
    available: true,
    state: 'degraded',
    summary: '围绕伙伴规模、贡献质量和字段完整度查看生态经营。',
    timeBasis: '伙伴经营当前基于商机代理商字段和生态分类字段统计。',
  },
  {
    sectionKey: 'products',
    title: '产品方案',
    loadMode: 'lazy',
    available: true,
    state: 'degraded',
    summary: '围绕产品方案、行业方案和关键词热度查看方案经营。',
    timeBasis: '产品方案当前基于商机产品方案字段和行业方案字段统计。',
  },
  {
    sectionKey: 'acceptance',
    title: '验收进度',
    loadMode: 'lazy',
    available: true,
    state: 'ready',
    summary: '追踪未验收合同与签约后验收风险。',
    timeBasis:
      '验收进度优先按 contracts.sign_date 统计，缺省回退 contracts.created_at。',
  },
  {
    sectionKey: 'collections',
    title: '收款情况',
    loadMode: 'lazy',
    available: true,
    state: 'ready',
    summary: '统一查看回款、应收状态与逾期项目。',
    timeBasis:
      '收款按 received_payments.receive_date 统计，应收计划按 received_payment_plans.receive_date 统计。',
  },
  {
    sectionKey: 'risks',
    title: '经营风险与建议',
    loadMode: 'lazy',
    available: true,
    state: 'ready',
    summary: '汇总高风险对象并给出优先动作建议。',
    timeBasis: '风险专题混合使用商机、合同、应收三类 endDate 截面口径。',
  },
] as const;

export type ManagementReportSectionKey =
  (typeof MANAGEMENT_REPORT_SECTION_DEFINITIONS)[number]['sectionKey'];

export interface ManagementReportFilterInput {
  departmentId?: string;
  presetKey?: ManagementReportPresetKey;
  startDate?: string;
  endDate?: string;
}

export interface ManagementReportSectionRequest {
  reportId?: string;
  filter?: ManagementReportFilterInput;
}

export interface ManagementReportExportRequest {
  reportId?: string;
  filter?: ManagementReportFilterInput;
  format?: 'csv';
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
  metricKeys?: string[];
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

export interface ManagementReportSnapshotPayload {
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
  presets: Array<{ key: ManagementReportPresetKey; label: string }>;
  departments: ManagementReportDepartmentNode[];
  defaultFilter: Required<ManagementReportFilterInput>;
}

export interface ManagementReportExportPayload {
  reportId: string;
  fileName: string;
  mimeType: string;
  format: 'csv';
  content: string;
}

export interface ManagementReportNormalizedFilter {
  departmentId: string;
  departmentLabel: string;
  presetKey: ManagementReportPresetKey;
  startDate: string;
  endDate: string;
  includedDepartmentIds: string[];
}

export interface ManagementReportContext {
  reportId: string;
  userId: string;
  roleNames: string[];
  scopeSummary: string;
  organizationIds?: string[];
  ownerIds?: string[];
  scopeSource?: 'crm-user' | 'wecom-organization' | 'mixed' | 'application-super-admin';
  isFullAccess?: boolean;
  generatedAt: string;
  filter: ManagementReportNormalizedFilter;
}

export function createMetricCard(
  params: ManagementReportMetricCard,
): ManagementReportMetricCard {
  return params;
}

export function createMetricStripItems(
  items: ManagementReportMetricCard[],
): ManagementReportMetricStripItem[] {
  return items.map((item) => ({
    label: item.label,
    value: item.value,
    tone: item.tone,
  }));
}

export function createDetailColumns(
  columns: Array<{ key: string; label: string }>,
): ManagementReportTableColumn[] {
  return columns;
}

export function createEmptyPreviewBlock(params: {
  blockId: string;
  title: string;
  description?: string;
}): ManagementReportDetailTableBlock {
  return {
    blockId: params.blockId,
    blockType: 'record-preview',
    title: params.title,
    description: params.description,
    size: 'wide',
    columns: [
      { key: 'status', label: '状态' },
      { key: 'detail', label: '说明' },
    ],
    rows: [
      {
        status: '暂无数据',
        detail: '当前筛选范围内暂无可展示的样本记录。',
      },
    ],
  };
}

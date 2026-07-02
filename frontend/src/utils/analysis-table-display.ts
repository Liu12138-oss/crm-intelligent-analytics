import { formatWanAmount } from '@/utils/business-amount';

export interface AnalysisDisplayColumn {
  key: string;
  label: string;
  width?: number;
}

export interface NormalizedAnalysisDisplayColumn extends AnalysisDisplayColumn {
  minWidth: number;
}

const wideTableColumnCountThreshold = 7;
const wideTableEstimatedWidthThreshold = 840;
const transposedTableMaxDimensionRows = 6;
const transposedTableMaxEstimatedWidth = 760;

const columnLabelMap: Record<string, string> = {
  team: '团队',
  team_name: '团队',
  teamName: '团队',
  region: '区域',
  big_region: '大区',
  bigRegion: '大区',
  region_name: '区域',
  regionName: '区域',
  owner: '负责人',
  ownerId: '负责人ID',
  owner_id: '负责人ID',
  ownerName: '负责人',
  owner_name: '负责人',
  partner: '渠道商',
  partnerId: '渠道商ID',
  partner_id: '渠道商ID',
  partnerName: '渠道商',
  partner_name: '渠道商',
  partnerLevel: '合作等级',
  partner_level: '合作等级',
  partnerLevelName: '合作等级',
  partner_level_name: '合作等级',
  partnerType: '渠道类型',
  partner_type: '渠道类型',
  partnerRole: '渠道角色',
  partner_role: '渠道角色',
  isTechnicalServiceProvider: '是否技术服务商',
  is_technical_service_provider: '是否技术服务商',
  customer: '最终客户',
  customerId: '客户ID',
  customer_id: '客户ID',
  customer_name: '最终客户',
  customerName: '最终客户',
  customer_level: '客户级别',
  customerLevel: '客户级别',
  customer_category: '客户分类',
  customerCategory: '客户分类',
  opportunity_no: '商机编号',
  opportunityNo: '商机编号',
  opportunity_id: '商机编号',
  opportunityId: '商机编号',
  opportunity_name: '商机名称',
  opportunityName: '商机名称',
  project_name: '项目名称',
  projectName: '项目名称',
  opportunity_title: '项目名称',
  title: '项目名称',
  sales_stage: '销售阶段',
  salesStage: '销售阶段',
  stage: '销售阶段',
  stage_name: '销售阶段',
  stageName: '销售阶段',
  promise_sign: '承诺签约',
  promiseSign: '承诺签约',
  expected_amount: '预计有效收入（万元）',
  expectedAmount: '预计有效收入（万元）',
  expect_amount: '预计有效收入（万元）',
  amount: '金额（万元）',
  total_amount: '金额（万元）',
  annual_target: '全年目标（万元）',
  annual_forecast: '全年预测（万元）',
  year_label: '年份',
  quarter_label: '季度',
  month_label: '月份',
  bucket_label: '分组',
  bucketLabel: '分组',
  category: '客户分类',
  contract_count: '合同数',
  contract_amount: '合同总额（万元）',
  valid_income: '有效收入（万元）',
  count: '记录数',
  totalCount: '记录数',
  row_count: '记录数',
  registration_count: '报备数',
  registrationCount: '报备数',
  opportunity_count: '商机数',
  opportunityCount: '商机数',
  opportunity_amount: '商机金额（万元）',
  opportunityAmount: '商机金额（万元）',
  quote_count: '报价数',
  quoteCount: '报价数',
  quote_amount: '报价金额（万元）',
  quoteAmount: '报价金额（万元）',
  order_count: '订单数',
  orderCount: '订单数',
  order_amount: '订单金额（万元）',
  orderAmount: '订单金额（万元）',
  technical_partner_count: '技术服务商数',
  technicalPartnerCount: '技术服务商数',
  new_partner_count: '新增渠道商数',
  newPartnerCount: '新增渠道商数',
  new_opportunity_count: '新增商机数',
  newOpportunityCount: '新增商机数',
  created_at: '创建时间',
  createdAt: '创建时间',
  updated_at: '最后更新时间',
  updatedAt: '最后更新时间',
  last_updated_at: '最后更新时间',
  lastUpdatedAt: '最后更新时间',
  source_updated_at: '最近进展时间',
  sourceUpdatedAt: '最近进展时间',
  stale_days: '未更新天数',
  staleDays: '未更新天数',
  expected_sign_date: '预计签单日期',
  expectedSignDate: '预计签单日期',
  sign_date: '签约日期',
  signDate: '签约日期',
  opportunity_type: '信创项目',
  opportunityType: '信创项目',
  implementation_party: '实施方',
  implementationParty: '实施方',
  project_category: '项目类别',
  projectCategory: '项目类别',
  product_solution: '产品解决方案',
  productSolution: '产品解决方案',
  days_since_last_update: '距上次更新（天）',
  daysSinceLastUpdate: '距上次更新（天）',
  rank: '排名',
  sequence: '序号',
  win_rate: '赢单率（%）',
  winRate: '赢单率（%）',
  record_count: '记录数',
  recordCount: '记录数',
};

const columnWidthMap: Record<string, number> = {
  team_name: 150,
  partnerName: 190,
  partner_name: 190,
  customer_name: 190,
  project_name: 220,
  opportunity_title: 220,
  sales_stage: 170,
  expected_amount: 150,
  annual_target: 130,
  annual_forecast: 130,
  product_solution: 150,
  created_at: 150,
  updated_at: 170,
  last_updated_at: 170,
  expected_sign_date: 150,
  days_since_last_update: 130,
};

/**
 * 统一生成用户可读列配置，避免后端字段名或模板 key 直接暴露到页面。
 * 参数：原始列配置与列下标；返回：包含中文列名和宽度的展示列。
 */
export function normalizeAnalysisDisplayColumn(
  column: AnalysisDisplayColumn,
  index: number,
): NormalizedAnalysisDisplayColumn {
  return {
    ...column,
    label: resolveAnalysisColumnLabel(column.key, column.label, index),
    minWidth: resolveAnalysisColumnMinWidth(column.key, column.width),
  };
}

/**
 * 统一解析分析结果表格的可见列，确保工作台、详情表和宽表布局判定使用同一套列隐藏与中文表头规则。
 * 参数：模板列配置与结果行；返回：过滤内部 ID 后的展示列配置。
 */
export function resolveAnalysisDisplayColumns(
  columns: AnalysisDisplayColumn[] | undefined,
  rows: Array<Record<string, unknown>>,
): NormalizedAnalysisDisplayColumn[] {
  const firstRow = rows[0];
  if (columns && columns.length > 0) {
    return columns
      .filter((column) => !firstRow || !shouldHideInferredAnalysisColumn(column.key, firstRow))
      .map((column, index) => normalizeAnalysisDisplayColumn(column, index));
  }

  if (!firstRow) {
    return ['ownerName', 'amount', 'count'].map((key, index) => ({
      ...normalizeAnalysisDisplayColumn({ key, label: '' }, index),
    }));
  }

  return Object.keys(firstRow)
    .filter((key) => !shouldHideInferredAnalysisColumn(key, firstRow))
    .map((key, index) => normalizeAnalysisDisplayColumn({ key, label: '' }, index));
}

/**
 * 判断结果表是否需要独占整行展示，避免多月份、多维度明细在左右分栏中被压缩。
 * 参数：模板列配置与结果行；返回：列数较多或估算最小宽度超过分栏承载能力时为 true。
 */
export function isWideAnalysisTable(
  columns: AnalysisDisplayColumn[] | undefined,
  rows: Array<Record<string, unknown>>,
): boolean {
  const visibleColumns = resolveAnalysisDisplayColumns(columns, rows);
  if (visibleColumns.length === 0) {
    return false;
  }

  const estimatedMinWidth = visibleColumns.reduce(
    (totalWidth, column) => totalWidth + (column.width ?? column.minWidth),
    0,
  );

  return (
    visibleColumns.length >= wideTableColumnCountThreshold ||
    estimatedMinWidth >= wideTableEstimatedWidthThreshold
  );
}

/**
 * 判断分析结果表格是否适合转置展示。
 * 参数：模板列配置、结果行、是否与图表配套展示；返回：仅在少量维度值需要和图表对照时才返回 true。
 * 调用注意：多区域、多负责人、多客户等维度行较多的结果必须保持纵向行展示，避免转置后横向撑出页面。
 */
export function shouldTransposeAnalysisTable(
  columns: AnalysisDisplayColumn[] | undefined,
  rows: Array<Record<string, unknown>>,
  pairedWithChart: boolean,
): boolean {
  if (!pairedWithChart || rows.length === 0) {
    return false;
  }

  const visibleColumns = resolveAnalysisDisplayColumns(columns, rows);
  if (visibleColumns.length <= 1 || rows.length > transposedTableMaxDimensionRows) {
    return false;
  }

  const estimatedTransposedWidth = 160 + rows.length * 124;
  return estimatedTransposedWidth <= transposedTableMaxEstimatedWidth;
}

/**
 * 解析表头中文名；当模板未给中文 label 时，优先使用内置业务字段词典。
 * 参数：字段 key、模板 label、列下标；返回：不会直接展示英文 key 的表头。
 */
export function resolveAnalysisColumnLabel(
  key: string,
  label: string | undefined,
  index: number,
): string {
  if (label && /[\u4e00-\u9fff]/.test(label)) {
    return label;
  }

  return columnLabelMap[key] ?? `字段${index + 1}`;
}

/**
 * 根据字段含义估算列宽，确保长客户名、项目名和日期不会全部挤在一起。
 * 参数：字段 key 与模板宽度；返回：Element Plus 表格可用的最小列宽。
 */
export function resolveAnalysisColumnMinWidth(
  key: string,
  configuredWidth: number | undefined,
): number {
  if (typeof configuredWidth === 'number') {
    return configuredWidth;
  }

  return columnWidthMap[key] ?? (/(name|title|customer|project)/i.test(key) ? 180 : 120);
}

/**
 * 将单元格值转换为面向业务用户的展示文本。
 * 参数：原始值；返回：中文布尔值、空值兜底或隐藏后的配置编码。
 */
export function formatAnalysisCellValue(
  value: unknown,
  columnKey?: string,
): string | number {
  if (value === undefined || value === null || value === '') {
    return '--';
  }

  if (columnKey && shouldFormatYuanAmountColumn(columnKey)) {
    return formatWanAmount(value);
  }

  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }

  if (typeof value === 'number') {
    return value;
  }

  const text = String(value).trim();
  if (text === '') {
    return '--';
  }

  if (/^mul_[a-z0-9]+$/i.test(text)) {
    return '选项值待同步';
  }

  const enumLabelMap: Record<string, string> = {
    true: '是',
    false: '否',
    yes: '是',
    no: '否',
    creative: '信创',
    non_creative: '非信创',
    our: '我方',
    self: '我方',
    partner: '伙伴',
    primary: '主渠道',
    secondary: '协作渠道',
    distributor: '经销商',
    integrator: '集成商',
    technical_service_provider: '技术服务商',
  };

  if (enumLabelMap[text]) {
    return enumLabelMap[text];
  }

  if (/^[a-z]+_[a-z0-9_-]+$/i.test(text)) {
    return '编码值待同步';
  }

  return text;
}

/**
 * 判断字段是否为后端元级金额字段。
 * 参数：表格字段 key；返回：需要前端按万元展示时为 true。
 */
export function shouldFormatYuanAmountColumn(columnKey: string): boolean {
  return [
    'amount',
    'total_amount',
    'contract_amount',
    'valid_income',
    'opportunity_amount',
    'opportunityAmount',
    'quote_amount',
    'quoteAmount',
    'order_amount',
    'orderAmount',
  ].includes(columnKey);
}

/**
 * 判断自动推导表格列时是否应隐藏内部 ID 字段。
 * 参数：字段 key 和首行数据；返回：存在可读名称字段时隐藏对应 ID。
 */
export function shouldHideInferredAnalysisColumn(
  key: string,
  row: Record<string, unknown>,
): boolean {
  const readablePairs: Record<string, string[]> = {
    ownerId: ['ownerName', 'owner_name'],
    owner_id: ['ownerName', 'owner_name'],
    partnerId: ['partnerName', 'partner_name'],
    partner_id: ['partnerName', 'partner_name'],
    customerId: ['customerName', 'customer_name'],
    customer_id: ['customerName', 'customer_name'],
    opportunityId: ['opportunityName', 'opportunity_name'],
    opportunity_id: ['opportunityName', 'opportunity_name'],
    teamId: ['teamName', 'team_name'],
    team_id: ['teamName', 'team_name'],
    userId: ['ownerName', 'owner_name'],
    user_id: ['ownerName', 'owner_name'],
  };

  return Boolean(
    readablePairs[key]?.some((readableKey) => {
      const value = row[readableKey];
      return value !== undefined && value !== null && String(value).trim() !== '';
    }),
  );
}

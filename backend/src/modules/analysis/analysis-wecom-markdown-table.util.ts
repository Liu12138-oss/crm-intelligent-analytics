import { formatWanAmount, type AmountSourceUnit } from '../../shared/utils/business-amount.util';
import { formatOpportunityStageLabel } from './opportunity-stage-label.util';

export interface WecomMarkdownTableColumn {
  key: string;
  label: string;
  valueType?: 'amount' | 'number' | 'text';
}

export interface WecomMarkdownTableModel {
  totalRowCount: number;
  visibleRows: Array<Record<string, unknown>>;
  columns: WecomMarkdownTableColumn[];
}

const WECOM_MARKDOWN_TABLE_MAX_ROWS = 10;
const WECOM_MARKDOWN_TABLE_MAX_COLUMNS = 6;

const KNOWN_COLUMN_CANDIDATES: Array<{
  keys: string[];
  label: string;
  valueType?: WecomMarkdownTableColumn['valueType'];
}> = [
  { keys: ['metric_name', '指标'], label: '指标' },
  { keys: ['metric_value', '数值'], label: '数值' },
  { keys: ['metric_note', '说明'], label: '说明' },
  { keys: ['section_name', '报告区块'], label: '报告区块' },
  { keys: ['render_type', '呈现方式'], label: '呈现方式' },
  { keys: ['section_summary', '区块摘要'], label: '区块摘要' },
  { keys: ['funnel_stage', '漏斗阶段'], label: '漏斗阶段' },
  { keys: ['partnerName', 'partner_name', '渠道商', '服务商', '渠道名称', '渠道'], label: '渠道商' },
  { keys: ['comparisonObject', '对比对象'], label: '对比对象' },
  { keys: ['quarterLabel', 'quarter_label', '季度'], label: '季度' },
  { keys: ['region', 'region_name', 'regionName', '区域'], label: '区域' },
  { keys: ['bigRegion', 'big_region', '大区'], label: '大区' },
  { keys: ['owner_name', 'ownerName', '负责人'], label: '负责人' },
  { keys: ['bucket_label', 'bucketLabel', '分组'], label: '分组' },
  { keys: ['month_label', '月份'], label: '月份' },
  { keys: ['customer_name', 'customerName', 'customer', '客户名称', '客户'], label: '客户' },
  { keys: ['quote_id', 'quoteId', '报价ID', '报价 ID'], label: '报价ID' },
  { keys: ['order_id', 'orderId', '订单ID', '订单 ID'], label: '订单ID' },
  {
    keys: [
      'project_name',
      'projectName',
      'opportunity_name',
      'opportunityName',
      'name',
      '项目名称',
      '商机名称',
    ],
    label: '项目/商机',
  },
  { keys: ['stage_name', 'stageName', 'stage', '销售阶段', '阶段'], label: '阶段' },
  {
    keys: ['opportunityAmountText', '商机金额'],
    label: '商机金额',
  },
  {
    keys: [
      'amount',
      'expected_amount',
      'contract_amount',
      'total_amount',
      'valid_income',
      'committed_amount',
      'order_amount',
      'orderAmount',
      'quote_amount',
      'quoteAmount',
      'estimatedAmt',
      'stage_amount',
      'opportunity_amount',
    ],
    label: '金额',
    valueType: 'amount',
  },
  {
    keys: [
      'count',
      'totalCount',
      '数量',
      '记录数',
      'stage_count',
      'order_count',
      'orderCount',
      'quote_count',
      'quoteCount',
      'opportunity_count',
      'opportunityCount',
      'registration_count',
      'registrationCount',
      'new_partner_count',
      'new_opportunity_count',
      'row_count',
    ],
    label: '数量',
    valueType: 'number',
  },
  { keys: ['countChangeText', '数量变化'], label: '数量变化' },
  { keys: ['amountChangeText', '金额变化'], label: '金额变化' },
  { keys: ['amountChangeRate', '金额变化率'], label: '金额变化率' },
  {
    keys: ['contributionShare', 'opportunityShare', 'orderShare', 'percentage', '占比', '贡献占比'],
    label: '贡献占比',
  },
  { keys: ['comparisonConclusion', '对比结论'], label: '对比结论' },
  { keys: ['riskReason', 'risk_reason', '风险原因'], label: '风险原因' },
  {
    keys: ['actionSuggestion', 'actionAdvice', 'nextAction', 'action', '动作建议', '下一步动作'],
    label: '动作建议',
  },
  {
    keys: ['opportunityToOrderRate', 'orderFulfillmentRate', 'conversion_rate', '转化率'],
    label: '转化率',
  },
  { keys: ['assigned_staff_name', 'assignedStaffName', '分配人员'], label: '分配人员' },
  { keys: ['team_name', 'teamName', '团队'], label: '团队' },
  { keys: ['partnerLevel', 'partnerLevelName', 'level', 'partner_level', '合作级别', '合作等级', '渠道等级'], label: '合作等级' },
  { keys: ['partnerRole', 'partner_role', '渠道角色'], label: '渠道角色' },
  { keys: ['partnerType', 'partner_type', '渠道类型'], label: '渠道类型' },
  {
    keys: ['isTechnicalServiceProvider', 'isTechService', 'technicalServiceProvider', 'is_technical_service_provider', '是否技术服务商'],
    label: '是否技术服务商',
  },
  {
    keys: ['technicalServiceProviderType', 'techServiceType', '技术服务商类型'],
    label: '技术服务商类型',
  },
  {
    keys: ['totalAmountText', 'totalAmount', 'totalAmt', '累计金额'],
    label: '累计金额',
  },
  { keys: ['stale_days', '停滞天数', '未更新天数'], label: '停滞天数', valueType: 'number' },
  { keys: ['inactive_days', '未活跃天数'], label: '未活跃天数', valueType: 'number' },
  { keys: ['status', '状态'], label: '状态' },
  {
    keys: ['expected_sign_date', 'expectedSignDate', 'expectedClose', 'createdAt', 'updatedAt'],
    label: '日期',
  },
];

const FALLBACK_COLUMN_LABEL_MAP: Record<string, string> = Object.fromEntries(
  KNOWN_COLUMN_CANDIDATES.flatMap((candidate) =>
    candidate.keys.map((key) => [key, candidate.label] as const),
  ),
);

const HIDDEN_ID_READABLE_PAIRS: Record<string, string[]> = {
  ownerId: ['ownerName', 'owner_name'],
  owner_id: ['ownerName', 'owner_name'],
  partnerId: ['partnerName', 'partner_name'],
  partner_id: ['partnerName', 'partner_name'],
  customerId: ['customerName', 'customer_name'],
  customer_id: ['customerName', 'customer_name'],
};

/**
 * 构造企微原生 Markdown 表格段落。
 *
 * 参数说明：`rows` 为统一分析结果明细行。
 * 返回值说明：返回可直接拼接进企微 Markdown 的行数组；无可展示列时返回空数组。
 * 调用注意事项：只展示前 10 行、前 5 个业务列，避免企微聊天窗口被宽表刷屏。
 */
export function buildWecomMarkdownTableSection(
  rows: Array<Record<string, unknown>>,
): string[] {
  const tableModel = buildWecomMarkdownTableModel(rows);
  if (tableModel.columns.length === 0) {
    return [];
  }

  const lines = [
    '### 详细结果',
    `> 共 ${tableModel.totalRowCount} 条，以下展示前 ${tableModel.visibleRows.length} 条。`,
  ];

  tableModel.visibleRows.forEach((row, index) => {
    lines.push(...buildMarkdownListCard(index + 1, row, tableModel.columns));
  });

  if (tableModel.totalRowCount > tableModel.visibleRows.length) {
    lines.push(
      '',
      `> 结果较多，企微先展示前 ${tableModel.visibleRows.length} 条；如需缩小范围，可以继续回复“看明细”或补充筛选条件。`,
    );
  }

  return lines;
}

/**
 * 构造企微表格展示模型。
 *
 * 参数说明：`rows` 为统一分析结果明细行。
 * 返回值说明：返回裁剪后的展示行、中文列定义和原始总行数。
 * 调用注意事项：Markdown、模板卡片与后续文件导出都应优先复用该模型，避免同一结果在不同通道字段不一致。
 */
export function buildWecomMarkdownTableModel(
  rows: Array<Record<string, unknown>>,
): WecomMarkdownTableModel {
  if (rows.length === 0) {
    return {
      totalRowCount: 0,
      visibleRows: [],
      columns: [],
    };
  }

  const visibleRows = rows.slice(0, WECOM_MARKDOWN_TABLE_MAX_ROWS);
  return {
    totalRowCount: rows.length,
    visibleRows,
    columns: resolveWecomTableColumns(visibleRows),
  };
}

/**
 * 从结果行中选择适合企微展示的业务列。
 *
 * 参数说明：`rows` 为已裁剪的展示行。
 * 返回值说明：返回最多 5 个带中文标签的列定义。
 * 调用注意事项：优先使用业务白名单列，避免把数据库字段名直接暴露给用户。
 */
function resolveWecomTableColumns(
  rows: Array<Record<string, unknown>>,
): WecomMarkdownTableColumn[] {
  const columns: WecomMarkdownTableColumn[] = [];
  const usedKeys = new Set<string>();

  for (const candidate of KNOWN_COLUMN_CANDIDATES) {
    const matchedKey = candidate.keys.find((key) => rows.some((row) => isPresentValue(row[key])));
    if (!matchedKey || usedKeys.has(matchedKey)) {
      continue;
    }

    if (shouldSkipGenericAmountColumn(rows, matchedKey)) {
      continue;
    }

    if (isDuplicateDisplayColumn(rows, matchedKey, columns)) {
      continue;
    }

    columns.push({
      key: matchedKey,
      label: candidate.label,
      valueType: candidate.valueType,
    });
    usedKeys.add(matchedKey);

    if (columns.length >= WECOM_MARKDOWN_TABLE_MAX_COLUMNS) {
      return columns;
    }
  }

  if (columns.length > 0) {
    return columns;
  }

  const fallbackKeys = Array.from(
    new Set(
      rows.flatMap((row) =>
        Object.keys(row).filter(
          (key) => isPresentValue(row[key]) && !shouldHideInternalColumn(key, row),
        ),
      ),
    ),
  ).slice(0, Math.max(0, WECOM_MARKDOWN_TABLE_MAX_COLUMNS - columns.length));

  return fallbackKeys.map((key, index) => ({
    key,
    label: FALLBACK_COLUMN_LABEL_MAP[key] ?? `字段${index + 1}`,
    valueType: resolveFallbackColumnValueType(key),
  }));
}

/**
 * 判断是否跳过通用金额列。
 *
 * 参数说明：`rows` 为企微预览行，`candidateKey` 为当前候选字段。
 * 返回值说明：当行内已有业务金额文本时跳过 `amount`，避免同一金额重复展示。
 */
function shouldSkipGenericAmountColumn(
  rows: Array<Record<string, unknown>>,
  candidateKey: string,
): boolean {
  if (candidateKey !== 'amount') {
    return false;
  }

  return rows.some((row) =>
    isPresentValue(row.opportunityAmountText) ||
      isPresentValue(row.quoteAmountText) ||
      isPresentValue(row.orderAmountText) ||
      isPresentValue(row.amountText),
  );
}

/**
 * 构造企微列表卡片。
 *
 * 参数说明：
 * - `index` 为从 1 开始的展示序号。
 * - `row` 为结果行。
 * - `columns` 为已解析的表格列。
 * 返回值说明：返回多行列表卡片，比企微原生 Markdown 表格更稳定可读。
 * 调用注意事项：企微对管道表格渲染不稳定，列表卡片更适合移动端阅读和截图。
 */
function buildMarkdownListCard(
  index: number,
  row: Record<string, unknown>,
  columns: WecomMarkdownTableColumn[],
): string[] {
  const primaryColumn = columns[0];
  const primaryValue = primaryColumn
    ? formatWecomMarkdownTableCellValue(row[primaryColumn.key], primaryColumn, row)
    : '未命名';
  const detailParts = columns.slice(1).map((column) =>
    `${column.label}：${formatWecomMarkdownTableCellValue(row[column.key], column, row)}`,
  );

  return [
    '',
    `**${index}. ${primaryValue}**`,
    detailParts.length > 0 ? `> ${detailParts.join(' ｜ ')}` : '> 暂无更多字段',
  ];
}

/**
 * 格式化表格单元格，统一金额、数字和空值展示。
 *
 * 参数说明：
 * - `value` 为原始单元格值。
 * - `column` 为列定义。
 * 返回值说明：返回适合企微 Markdown 表格的安全文本。
 */
export function formatWecomMarkdownTableCellValue(
  value: unknown,
  column: WecomMarkdownTableColumn,
  row?: Record<string, unknown>,
): string {
  if (!isPresentValue(value)) {
    return '-';
  }

  if (column.valueType === 'amount') {
    if (isZeroAmountWithBusinessCount(value, row)) {
      return '未填金额';
    }

    return escapeMarkdownTableCell(formatWanAmount(value, resolveAmountSourceUnit(column.key)));
  }

  if (column.valueType === 'number' && typeof value === 'number') {
    return escapeMarkdownTableCell(value.toLocaleString('zh-CN'));
  }

  return escapeMarkdownTableCell(formatDictionaryValue(String(value)));
}

/**
 * 判断金额字段的原始单位。
 *
 * 参数说明：`key` 为结果行字段名。
 * 返回值说明：返回元或万元，供统一格式化为万元展示。
 */
function resolveAmountSourceUnit(key: string): AmountSourceUnit {
  return key === 'expected_amount' || key === 'annual_forecast' || key === 'annual_target'
    ? 'wan'
    : 'yuan';
}

/**
 * 清理 Markdown 表格中的特殊字符，避免单元格内容破坏列结构。
 *
 * 参数说明：`value` 为格式化后的单元格文本。
 * 返回值说明：返回安全的单行文本。
 */
function escapeMarkdownTableCell(value: string): string {
  return value
    .replace(/\|/gu, '｜')
    .replace(/\r?\n/gu, ' ')
    .trim();
}

/**
 * 判断值是否适合展示。
 *
 * 参数说明：`value` 为任意原始值。
 * 返回值说明：非空字符串、数字等可展示值返回 true。
 */
function isPresentValue(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

/**
 * 判断当前候选列是否与已选列展示内容完全重复。
 *
 * 参数说明：
 * - `rows` 为企微预览行。
 * - `candidateKey` 为当前候选字段。
 * - `selectedColumns` 为已经选中的业务列。
 * 返回值说明：当候选列在所有非空行上都与某个已选列一致时返回 true。
 * 调用注意事项：渠道商聚合中 CRM 适配层可能把服务商名同时放入 `partnerName` 与 `ownerName`，
 * 这里在展示层去重，避免误导用户以为负责人也是同一个服务商。
 */
function isDuplicateDisplayColumn(
  rows: Array<Record<string, unknown>>,
  candidateKey: string,
  selectedColumns: WecomMarkdownTableColumn[],
): boolean {
  const candidateValues = rows
    .map((row) => normalizeComparableText(row[candidateKey]))
    .filter(Boolean);
  if (candidateValues.length === 0) {
    return false;
  }

  return selectedColumns.some((column) => {
    const selectedValues = rows
      .map((row) => normalizeComparableText(row[column.key]))
      .filter(Boolean);
    if (selectedValues.length !== candidateValues.length) {
      return false;
    }

    return candidateValues.every((value, index) => value === selectedValues[index]);
  });
}

/**
 * 判断金额为 0 但业务数量大于 0 的聚合行。
 *
 * 参数说明：`value` 为金额字段，`row` 为当前结果行。
 * 返回值说明：金额为 0 且商机数量大于 0 时返回 true。
 * 调用注意事项：该场景通常表示 CRM 商机金额未维护，而不是业务上真实贡献为 0 元。
 */
function isZeroAmountWithBusinessCount(
  value: unknown,
  row?: Record<string, unknown>,
): boolean {
  if (!row || toNumber(value) !== 0) {
    return false;
  }

  return toNumber(row.count ?? row.totalCount ?? row['数量'] ?? row['记录数']) > 0;
}

/**
 * 将任意展示值转成可比较文本。
 *
 * 参数说明：`value` 为单元格原始值。
 * 返回值说明：去掉空白后的文本；空值返回空字符串。
 */
function normalizeComparableText(value: unknown): string {
  if (!isPresentValue(value)) {
    return '';
  }

  return String(value).replace(/\s+/gu, '').trim();
}

/**
 * 将联软 CRM 常见枚举转成中文展示。
 *
 * 参数说明：`value` 为状态、阶段、等级等原始枚举值。
 * 返回值说明：命中字典时返回中文，未命中时保留原文。
 * 调用注意事项：展示层只做翻译，不改变底层结果和审计记录。
 */
function formatDictionaryValue(value: string): string {
  const dictionaries: Record<string, string> = {
    pending: '待处理',
    processing: '处理中',
    confirmed: '已确认',
    completed: '已完成',
    rejected: '已驳回',
    draft: '草稿',
    submitted: '已提交',
    approved: '已通过',
    converted: '已转订单',
    contacted: formatOpportunityStageLabel('contacted'),
    registered: formatOpportunityStageLabel('registered'),
    qualified: '已确认',
    proposal: '方案/报价中',
    quoted: formatOpportunityStageLabel('quoted'),
    negotiation: '商务谈判',
    won: '已成交',
    lost: '已失单',
    active: '已激活',
    disabled: '禁用',
    inactive: '未激活/停用',
    primary: '主渠道',
    secondary: '协作渠道',
    distributor: '经销商',
    integrator: '集成商',
    technical_service_provider: '技术服务商',
    none: '未设置',
    true: '是',
    false: '否',
    yes: '是',
    no: '否',
  };

  return dictionaries[value.trim().toLowerCase()] ?? value;
}

/**
 * 判断 fallback 字段是否为应隐藏的内部 ID。
 *
 * 参数说明：`key` 为候选字段，`row` 为当前结果行。
 * 返回值说明：存在可读名称字段时隐藏对应 ID。
 */
function shouldHideInternalColumn(key: string, row: Record<string, unknown>): boolean {
  return Boolean(
    HIDDEN_ID_READABLE_PAIRS[key]?.some((readableKey) => isPresentValue(row[readableKey])),
  );
}

/**
 * 为 fallback 字段推断基础值类型。
 *
 * 参数说明：`key` 为结果字段名。
 * 返回值说明：金额和数量字段会获得对应格式化类型，其余作为文本展示。
 */
function resolveFallbackColumnValueType(key: string): WecomMarkdownTableColumn['valueType'] {
  if (/(amount|income|revenue|amt)$/iu.test(key)) {
    return 'amount';
  }

  if (/(count|number|num|days)$/iu.test(key)) {
    return 'number';
  }

  return 'text';
}

/**
 * 将未知值转为数字，供展示口径判断使用。
 *
 * 参数说明：`value` 为 CRM 或标准 API 返回值。
 * 返回值说明：无法解析时返回 0。
 */
function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/gu, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

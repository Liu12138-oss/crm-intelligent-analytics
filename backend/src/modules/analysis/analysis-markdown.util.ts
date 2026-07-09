import type {
  AnalysisInsightItem,
  AnalysisKeyFinding,
  AnalysisRecommendationItem,
  AnalysisTrendInsight,
  AnalysisForecastInsight,
  AnalysisSourceNote,
  MetricCard,
  ResultTemporalScope,
} from '../../shared/types/domain';
import { formatWanAmount } from '../../shared/utils/business-amount.util';
import { buildWecomMarkdownTableSection } from './analysis-wecom-markdown-table.util';
import { formatTemporalScopeLabel } from './temporal-scope.util';

export interface AnalysisMarkdownPayload {
  title: string;
  summary?: string;
  groundedExplanation?: string;
  metricCards: MetricCard[];
  keyFindings: AnalysisKeyFinding[];
  nextBestQuestions?: string[];
  scopeSummary?: string;
  temporalScope?: ResultTemporalScope;
  trendInsight?: AnalysisTrendInsight;
  forecastInsight?: AnalysisForecastInsight;
  forecastSummary?: string;
  riskInsights?: AnalysisInsightItem[];
  riskSummaries?: string[];
  recommendations?: AnalysisRecommendationItem[];
  recommendationSummaries?: string[];
  evidenceSummary?: string;
  rows?: Array<Record<string, unknown>>;
  appliedFilters?: Array<{ label: string; value: string }>;
  sourceNotes?: AnalysisSourceNote[];
  footnotes?: string[];
  secondaryViewSummaries?: Array<{ title: string; rowCount: number; renderType?: string }>;
  variant?: 'ranking' | 'trend' | 'distribution' | 'summary';
  preferImageAttachments?: boolean;
}

const MAX_RANKING_ROWS = 20;
const MAX_WECOM_FOCUS_ROWS = 5;
const DEFAULT_WECOM_ACTIONS = ['看明细', '看排名', '分析风险', '继续分析'];

function isPresentValue(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function pickString(row: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (isPresentValue(value)) {
      return String(value).trim();
    }
  }

  return undefined;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/,/gu, '').trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function formatRowLabel(row: Record<string, unknown>): string {
  return String(
    row.customer_name ??
      row.customerName ??
      row.project_name ??
      row.projectName ??
      row.opportunity_name ??
      row.opportunityName ??
      row.month_label ??
      row.monthLabel ??
      row.bucket_label ??
      row.bucketLabel ??
      row.ownerName ??
      row.team_name ??
      row.project_name ??
      row.category ??
      '未命名分组',
  );
}

function formatRowValue(row: Record<string, unknown>): string {
  if (row.amount !== undefined && row.amount !== null) {
    return formatWanAmount(row.amount);
  }

  const value =
    row.expected_amount ??
    row.amount ??
    row.contract_amount ??
    row.annual_forecast ??
    row.annual_target ??
    row.valid_income ??
    row.committed_amount ??
    row.total_amount ??
    row.value ??
    row.count ??
    '--';
  return typeof value === 'number' ? value.toLocaleString('zh-CN') : String(value);
}

function formatBusinessRow(row: Record<string, unknown>): string {
  const customer = pickString(row, ['customer_name', 'customerName', '最终客户', '客户名称']);
  const project = pickString(row, [
    'project_name',
    'projectName',
    'opportunity_name',
    'opportunityName',
    '项目名称',
    '商机名称',
    'name',
  ]);
  const stage = pickString(row, ['stage_name', 'stageName', '销售阶段', '阶段']);
  const owner = pickString(row, ['owner_name', 'ownerName', '负责人']);
  const team = pickString(row, ['team_name', 'teamName', '团队']);
  const amount = toNumber(
    row.amount ??
      row.expected_amount ??
      row.contract_amount ??
      row.annual_forecast ??
      row.valid_income ??
      row.committed_amount ??
      row.total_amount,
  );
  const amountSourceUnit = row.amount !== undefined && row.amount !== null ? 'yuan' : 'wan';
  const signDate = pickString(row, ['expected_sign_date', 'expectedSignDate', '预计签单日期']);
  const idleDays = pickString(row, ['idle_days', 'idleDays', '距上次更新(天)']);
  const hasBusinessContext = Boolean(customer || project || stage);
  const parts = [
    customer,
    project,
    stage,
    owner ? `负责人 ${owner}` : undefined,
    amount > 0 ? `预计金额 ${formatWanAmount(amount, amountSourceUnit)}` : undefined,
    signDate ? `预计签单 ${signDate}` : undefined,
    idleDays ? `停滞 ${idleDays} 天` : undefined,
  ].filter(Boolean);

  if (hasBusinessContext && parts.length > 0) {
    return parts.join(' / ');
  }

  const fallbackValue = formatRowValue(row);
  return fallbackValue === '--' ? formatRowLabel(row) : `${team ?? formatRowLabel(row)}：${fallbackValue}`;
}

/**
 * 生成企微重点汇总行。
 *
 * 参数说明：`rows` 为统一分析明细或聚合行，通常已按业务指标排序。
 * 返回值说明：返回适合企微聊天窗口阅读的 Top N 汇总文本。
 * 调用注意事项：只展示少量重点行，详细列表继续交给“详细结果”段落，避免重复刷屏。
 */
function buildWecomFocusSummaryLines(rows: Array<Record<string, unknown>>): string[] {
  return rows.slice(0, MAX_WECOM_FOCUS_ROWS).map((row, index) => {
    const label = formatRowLabel(row);
    const value = formatRowValue(row);
    const count = row.count ?? row.totalCount ?? row['数量'] ?? row['记录数'];
    const countText = isPresentValue(count) ? `，数量 ${count}` : '';
    return `${index + 1}. ${label}：${value}${countText}`;
  });
}

/**
 * 生成企微可继续追问动作。
 *
 * 参数说明：`payload` 为统一阅读数据，可能包含 AI 生成的下一步问题和结果类型。
 * 返回值说明：返回最多 4 个短动作，适合用户在企微里直接复制回复。
 * 调用注意事项：企微入口以轻交互为主，动作必须短、清晰，不能依赖 Web 页面。
 */
function resolveWecomQuickActions(payload: AnalysisMarkdownPayload): string[] {
  const actions = new Set<string>();
  const variantActionMap: Record<NonNullable<AnalysisMarkdownPayload['variant']>, string[]> = {
    ranking: ['看前10', '看明细', '看差距', '分析风险'],
    trend: ['看趋势', '按区域对比', '分析原因', '订阅日报'],
    distribution: ['看分布图', '看明细', '分析异常', '继续分析'],
    summary: DEFAULT_WECOM_ACTIONS,
  };

  for (const action of variantActionMap[payload.variant ?? 'summary']) {
    actions.add(action);
  }

  for (const question of payload.nextBestQuestions ?? []) {
    const normalizedQuestion = question.replace(/[？?。.!！]/gu, '').trim();
    if (normalizedQuestion) {
      actions.add(normalizedQuestion);
    }
  }

  return Array.from(actions).slice(0, 4);
}

/**
 * 生成完整版阅读稿，供 Web 查询页与详情兼容入口复用。
 *
 * 参数说明：`payload` 为 richer report 已准备好的统一阅读数据。
 * 返回值：包含趋势预测、风险、建议和依据说明的完整版 Markdown。
 */
export function buildAnalysisDetailMarkdown(payload: AnalysisMarkdownPayload): string {
  const lines: string[] = [`## ${payload.title}`];

  if (payload.summary) {
    lines.push('', '## 执行摘要', payload.summary);
  }

  if (payload.temporalScope) {
    lines.push('', '## 时间口径', formatTemporalScopeLabel(payload.temporalScope));
  }

  if (payload.metricCards.length > 0) {
    lines.push('', '## 关键指标');
    for (const metric of payload.metricCards.slice(0, 6)) {
      lines.push(`- **${metric.name}**：${metric.value}`);
    }
  }

  if (payload.groundedExplanation) {
    lines.push('', '## 结果解读', payload.groundedExplanation);
  }

  const trendSummary = payload.trendInsight?.summary;
  if (trendSummary) {
    lines.push('', '## 趋势分析', trendSummary);
  }

  const forecastSummary = payload.forecastSummary ?? payload.forecastInsight?.summary;
  if (forecastSummary) {
    lines.push('', '## 趋势预测', forecastSummary);
    if (payload.forecastInsight?.caveats?.length) {
      for (const caveat of payload.forecastInsight.caveats) {
        lines.push(`- ${caveat}`);
      }
    }
  }

  const riskSummaries =
    payload.riskSummaries ??
    payload.riskInsights?.map((item) => `${item.title}：${item.detail}`) ??
    [];
  if (riskSummaries.length > 0) {
    lines.push('', '## 异常与风险');
    for (const item of riskSummaries.slice(0, 4)) {
      lines.push(`- ${item}`);
    }
  }

  const recommendationSummaries =
    payload.recommendationSummaries ??
    payload.recommendations?.map((item) => `${item.title}：${item.action}`) ??
    [];
  if (recommendationSummaries.length > 0) {
    lines.push('', '## 经营建议');
    for (const item of recommendationSummaries.slice(0, 4)) {
      lines.push(`- ${item}`);
    }
  }

  if (payload.rows && payload.rows.length > 0) {
    lines.push('', '## 详细结果');
    const rows = payload.rows.slice(0, MAX_RANKING_ROWS);
    rows.forEach((row, index) => {
      lines.push(`${index + 1}. ${formatBusinessRow(row)}`);
    });
  }

  if (payload.nextBestQuestions && payload.nextBestQuestions.length > 0) {
    lines.push('', '## 建议下一步');
    for (const item of payload.nextBestQuestions.slice(0, 3)) {
      lines.push(`- ${item}`);
    }
  }

  if (payload.evidenceSummary) {
    lines.push('', '## 结果依据', payload.evidenceSummary);
  }

  if (payload.scopeSummary) {
    lines.push('', `> 适用范围：${payload.scopeSummary}`);
  }

  return lines.join('\n').trim();
}

/**
 * 生成工作台查询页使用的阅读稿，保留趋势预测与建议，但省略详细依据块。
 *
 * 参数说明：`payload` 为统一阅读数据。
 * 返回值：适合查询页直接阅读的压缩完整版 Markdown。
 */
export function buildAnalysisWorkbenchMarkdown(
  payload: AnalysisMarkdownPayload,
): string {
  const lines: string[] = [`## ${payload.title}`];

  if (payload.summary) {
    lines.push('', '## 执行摘要', payload.summary);
  }

  if (payload.forecastSummary ?? payload.forecastInsight?.summary) {
    lines.push('', '## 趋势预测', payload.forecastSummary ?? payload.forecastInsight?.summary ?? '');
  }

  const recommendationSummaries =
    payload.recommendationSummaries ??
    payload.recommendations?.map((item) => `${item.title}：${item.action}`) ??
    [];
  if (recommendationSummaries.length > 0) {
    lines.push('', '## 经营建议');
    for (const item of recommendationSummaries.slice(0, 3)) {
      lines.push(`- ${item}`);
    }
  }

  if (payload.nextBestQuestions && payload.nextBestQuestions.length > 0) {
    lines.push('', '## 建议下一步');
    for (const item of payload.nextBestQuestions.slice(0, 3)) {
      lines.push(`- ${item}`);
    }
  }

  if (payload.scopeSummary) {
    lines.push('', `> 适用范围：${payload.scopeSummary}`);
  }

  return lines.join('\n').trim();
}

/**
 * 生成企业微信经营报告 Markdown，默认覆盖 Web 分析页的核心可读内容。
 *
 * 参数说明：`payload` 为统一阅读数据。
 * 返回值：适合企业微信消息窗口的经营分析报告。
 */
export function buildAnalysisWecomMarkdown(
  payload: AnalysisMarkdownPayload,
): string {
  const lines: string[] = [`## ${payload.title}`];

  if (payload.summary) {
    lines.push('', '### AI分析报告', payload.summary);
  }

  if (payload.temporalScope) {
    lines.push('', `> 时间口径：${formatTemporalScopeLabel(payload.temporalScope)}`);
  }

  if (payload.scopeSummary) {
    lines.push(`> 数据范围：${payload.scopeSummary}`);
  }

  if (payload.metricCards.length > 0) {
    lines.push('', '### 关键指标');
    for (const metric of payload.metricCards.slice(0, payload.preferImageAttachments ? 4 : 6)) {
      lines.push(`- **${metric.name}**：${metric.value}`);
    }
  }

  if (payload.preferImageAttachments) {
    lines.push(
      '',
      '### 企微展示',
      '- 已生成企微模板卡片和摘要；完整图表与明细请打开报告页查看。',
    );

    if (payload.secondaryViewSummaries && payload.secondaryViewSummaries.length > 0) {
      for (const item of payload.secondaryViewSummaries.slice(0, 3)) {
        const renderText = item.renderType ? `，${item.renderType}` : '';
        lines.push(`- ${item.title}：${item.rowCount} 条${renderText}`);
      }
    }

    const quickActions = resolveWecomQuickActions(payload);
    if (quickActions.length > 0) {
      lines.push('', '### 你可以继续回复');
      lines.push(quickActions.map((item) => `「${item}」`).join(' / '));
    }

    return lines.join('\n').trim();
  }

  const forecastSummary = payload.forecastSummary ?? payload.forecastInsight?.summary;
  if (forecastSummary) {
    lines.push('', '### 趋势预测', forecastSummary);
    for (const caveat of payload.forecastInsight?.caveats?.slice(0, 2) ?? []) {
      lines.push(`- ${caveat}`);
    }
  }

  if (payload.rows && payload.rows.length > 0) {
    lines.push('', `### 重点汇总`);
    lines.push(`> Top ${Math.min(payload.rows.length, MAX_WECOM_FOCUS_ROWS)}`);
    for (const item of buildWecomFocusSummaryLines(payload.rows)) {
      lines.push(`- ${item}`);
    }
  }

  if (payload.secondaryViewSummaries && payload.secondaryViewSummaries.length > 0) {
    lines.push('', '### 报告区块');
    for (const item of payload.secondaryViewSummaries.slice(0, 6)) {
      const renderText = item.renderType ? `，${item.renderType}` : '';
      lines.push(`- ${item.title}：${item.rowCount} 条${renderText}`);
    }
  }

  const recommendationSummaries =
    payload.recommendationSummaries ??
    payload.recommendations?.map((item) => `${item.title}：${item.action}`) ??
    [];
  if (recommendationSummaries.length > 0) {
    lines.push('', '### 经营建议');
    for (const item of recommendationSummaries.slice(0, 4)) {
      lines.push(`- ${item}`);
    }
  }

  const riskSummaries =
    payload.riskSummaries ??
    payload.riskInsights?.map((item) => `${item.title}：${item.detail}`) ??
    [];
  if (riskSummaries.length > 0) {
    lines.push('', '### 风险提醒');
    for (const item of riskSummaries.slice(0, 3)) {
      lines.push(`- ${item}`);
    }
  }

  if (!payload.preferImageAttachments && payload.rows && payload.rows.length > 0) {
    lines.push('', '### 已生成');
    lines.push('- 企微文字摘要');
    lines.push('- 结果预览表格');
    lines.push('- 如本次存在可图形化数据，完整图表会放在报告页中。');
    const tableSection = buildWecomMarkdownTableSection(payload.rows);
    if (tableSection.length > 0) {
      lines.push('', ...tableSection);
    } else {
      lines.push('', '### 详细结果');
      const rows = payload.rows.slice(0, MAX_RANKING_ROWS);
      rows.forEach((row, index) => {
        lines.push(`${index + 1}. ${formatBusinessRow(row)}`);
      });
    }
  }

  const quickActions = resolveWecomQuickActions(payload);
  if (quickActions.length > 0) {
    lines.push('', '### 你可以继续回复');
    lines.push(quickActions.map((item) => `「${item}」`).join(' / '));
  }

  return lines.join('\n').trim();
}

/**
 * 保留现有 `groundedMarkdown` 兼容字段，默认输出完整版阅读稿。
 *
 * 参数说明：`payload` 为统一阅读数据。
 * 返回值：完整版 Markdown。
 */
export function buildAnalysisGroundedMarkdown(
  payload: AnalysisMarkdownPayload,
): string {
  return buildAnalysisDetailMarkdown(payload);
}

export function buildAnalysisMarkdownOutline(
  payload: AnalysisMarkdownPayload,
): string[] {
  const outline = ['执行摘要'];
  if (payload.temporalScope) {
    outline.push('时间口径');
  }
  if (payload.metricCards.length > 0) {
    outline.push('关键指标');
  }
  if (payload.groundedExplanation) {
    outline.push('结果解读');
  }
  if (payload.forecastSummary ?? payload.forecastInsight?.summary) {
    outline.push('趋势预测');
  }
  if (
    (payload.riskSummaries && payload.riskSummaries.length > 0) ||
    (payload.riskInsights && payload.riskInsights.length > 0)
  ) {
    outline.push('异常与风险');
  }
  if (
    (payload.recommendationSummaries && payload.recommendationSummaries.length > 0) ||
    (payload.recommendations && payload.recommendations.length > 0)
  ) {
    outline.push('经营建议');
  }
  if (payload.nextBestQuestions && payload.nextBestQuestions.length > 0) {
    outline.push('建议下一步');
  }
  if (payload.evidenceSummary) {
    outline.push('结果依据');
  }
  return outline;
}

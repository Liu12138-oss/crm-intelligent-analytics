import type {
  AnalysisIntent,
  AnalysisDepth,
  AnalysisFacetProfile,
  AnalysisFocus,
  AnalysisOutputPreference,
  QueryConfidence,
  TemporalGranularity,
  TemporalRelativity,
  TemporalSlot,
} from '../../../../shared/types/domain';
import type { AiCapabilityPackDefinition } from '../ai-capability-pack.types';
import {
  inferAnalysisDepth,
  inferAnalysisFacetProfile,
  resolveAnalysisOutputPreference,
  resolveAnalysisFocus,
} from '../../analysis-topic-report.registry';
import { normalizeAnalysisMissingConditions } from '../../missing-conditions.util';

export interface AnalysisIntentPackContext {
  questionText: string;
  referenceNowIso?: string;
  timezone?: 'Asia/Shanghai';
}

type AnalysisIntentRawOutput = {
  domain?: AnalysisIntent['domain'];
  metrics?: string[];
  dimensions?: string[];
  missingConditions?: string[];
  normalizedQuestion?: string;
  timeRange?: string;
  startAt?: string;
  timeRangeText?: string;
  temporalSlot?: Partial<TemporalSlot>;
  queryEntities?: string[];
  resultIntent?: AnalysisIntent['resultIntent'];
  analysisFacetProfile?: AnalysisFacetProfile;
  analysisDepth?: AnalysisDepth;
  analysisFocus?: AnalysisFocus[];
  outputPreference?: AnalysisOutputPreference[];
  requestedAction?: AnalysisIntent['requestedAction'];
  confidence?: AnalysisIntent['confidence'];
  blockReason?: string;
};

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeAnalysisDepth(value: unknown): AnalysisDepth | undefined {
  if (value === 'snapshot' || value === 'standard' || value === 'deep-dive') {
    return value;
  }

  return undefined;
}

function normalizeAnalysisFacetProfile(
  value: unknown,
): AnalysisFacetProfile | undefined {
  if (
    value === 'owner-performance-ranking' ||
    value === 'region-operations' ||
    value === 'customer-operations' ||
    value === 'opportunity-risk' ||
    value === 'lead-funnel' ||
    value === 'generic-analysis'
  ) {
    return value;
  }

  return undefined;
}

function normalizeAnalysisFocus(value: unknown): AnalysisFocus[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const allowedFocus = new Set<AnalysisFocus>([
    'ranking',
    'trend',
    'risk',
    'region',
    'customer-contribution',
    'structure',
    'detail',
    'summary',
  ]);

  const normalizedFocus = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item): item is AnalysisFocus => allowedFocus.has(item as AnalysisFocus));

  return normalizedFocus.length > 0 ? normalizedFocus : undefined;
}

function normalizeAnalysisOutputPreference(value: unknown): AnalysisOutputPreference[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const allowedPreference = new Set<AnalysisOutputPreference>([
    'text_summary',
    'table',
    'chart',
    'wecom_image',
    'html_report',
    'export_file',
  ]);
  const normalizedPreference = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item): item is AnalysisOutputPreference =>
      allowedPreference.has(item as AnalysisOutputPreference),
    );

  return normalizedPreference.length > 0 ? normalizedPreference : undefined;
}

function normalizeTemporalGranularity(value: unknown): TemporalGranularity {
  if (
    value === 'day' ||
    value === 'week' ||
    value === 'month' ||
    value === 'quarter' ||
    value === 'year' ||
    value === 'custom'
  ) {
    return value;
  }

  return 'custom';
}

function normalizeTemporalRelativity(value: unknown): TemporalRelativity {
  if (value === 'absolute' || value === 'relative' || value === 'mixed') {
    return value;
  }

  return 'mixed';
}

function normalizeConfidence(value: unknown, fallback: QueryConfidence): QueryConfidence {
  if (value === 'HIGH' || value === 'MEDIUM' || value === 'LOW') {
    return value;
  }

  return fallback;
}

function normalizeTemporalSlot(
  rawSlot: Partial<TemporalSlot> | undefined,
): TemporalSlot | undefined {
  if (!rawSlot || typeof rawSlot !== 'object') {
    return undefined;
  }

  const rawText = typeof rawSlot.rawText === 'string' ? rawSlot.rawText.trim() : '';
  const normalizedLabel =
    typeof rawSlot.normalizedLabel === 'string'
      ? rawSlot.normalizedLabel.trim()
      : rawText;
  if (!rawText && !normalizedLabel) {
    return undefined;
  }

  return {
    rawText: rawText || normalizedLabel,
    normalizedLabel: normalizedLabel || rawText,
    ...(typeof rawSlot.startAt === 'string' && rawSlot.startAt.trim()
      ? { startAt: rawSlot.startAt.trim() }
      : {}),
    ...(typeof rawSlot.endAt === 'string' && rawSlot.endAt.trim()
      ? { endAt: rawSlot.endAt.trim() }
      : {}),
    timezone: 'Asia/Shanghai',
    granularity: normalizeTemporalGranularity(rawSlot.granularity),
    relativity: normalizeTemporalRelativity(rawSlot.relativity),
    inclusivity: {
      start: 'inclusive',
      end: rawSlot.inclusivity?.end === 'inclusive' ? 'inclusive' : 'exclusive',
    },
    confidence: normalizeConfidence(rawSlot.confidence, 'MEDIUM'),
    ...(typeof rawSlot.unresolvedReason === 'string' && rawSlot.unresolvedReason.trim()
      ? { unresolvedReason: rawSlot.unresolvedReason.trim() }
      : {}),
  };
}

/**
 * 判断被 AI 误判为 BLOCK 的文本是否其实是在改写查询条件。
 *
 * 设计原因：业务用户常用“改成、换成、调整为”表达时间范围、维度或筛选条件变化；
 * 这类语义仍属于只读问数，不能与“把商机改成已成交”这类 CRM 写入动作混淆。
 */
function isReadOnlyQueryRewrite(questionText: string): boolean {
  const hasRewriteVerb = /(改成|改为|调整为|调整成|换成|切到|改到|改看|只看|限定为|范围改)/u.test(
    questionText,
  );
  if (!hasRewriteVerb) {
    return false;
  }

  const hasReadOnlyTarget =
    /(时间|日期|月份|月|季度|年度|年份|范围|条件|维度|口径|分组|区域|团队|部门|负责人|趋势|排行|排名|一月份|二月份|三月份|四月份|五月份|六月份|七月份|八月份|九月份|十月份|十一月份|十二月份|\d{1,2}\s*月|本月|上月|近.+月|最近.+月)/u.test(
      questionText,
    );
  const hasWriteTarget =
    /(已成交|成交状态|阶段改|状态改|写入|保存|提交|创建|新建|新增客户|新增商机(?!金额)|新建商机|创建商机|删除|更新状态|录入|同步到\s*CRM)/u.test(
      questionText,
    );

  return hasReadOnlyTarget && !hasWriteTarget;
}

/**
 * 判断客户生命周期与反关联问法是否属于只读分析。
 *
 * 参数说明：`questionText` 为用户原始问题或规范化问题。
 * 返回值说明：命中“未报备商机、未建商机、创建多久”等客户统计语义时返回 `true`。
 * 调用注意事项：这里只负责纠正 AI 对“创建了多长时间”的写入误判，实际执行仍走受控 OpenAPI。
 */
function isReadOnlyCustomerLifecycleQuestion(questionText: string): boolean {
  return /(客户).*((没有|未|无).{0,8}(报备|商机|报价|下单|订单)|未报备商机|未建商机|无商机|创建.{0,10}(多久|多长时间|时长|天数)|生命周期|沉睡)/u.test(
    questionText,
  );
}

/**
 * 判断用户是否明确限定了时间。
 *
 * 参数说明：`questionText` 为用户原始问题或规范化问题。
 * 返回值说明：出现明确日期、月份、季度、年度或相对时间表达时返回 `true`。
 * 调用注意事项：“趋势、范围、报告”本身不是时间限制，不能因此要求用户补时间。
 */
function hasExplicitTemporalConstraint(questionText: string): boolean {
  return /(今天|昨日|昨天|明天|本周|上周|本月|上月|当月|本季度|上季度|本年|今年|去年|本财年|最近|近\s*\d+|过去|前\s*\d+|\d{4}\s*年|\d{1,2}\s*月|一月份|二月份|三月份|四月份|五月份|六月份|七月份|八月份|九月份|十月份|十一月份|十二月份)/u.test(
    questionText,
  );
}

/**
 * 判断“赢单”是否表达签单/成单对象，而不是“赢单率”这类商机转化率指标。
 *
 * 参数说明：`questionText` 为用户原始问题或规范化问题。
 * 返回值：需要按合同转化域处理时返回 `true`。
 * 注意事项：出现“商机、阶段、漏斗”时保留商机域，避免把“赢单阶段商机”误改成合同。
 */
function isWonOrderContractQuestion(questionText: string): boolean {
  // 未出现“赢单”时，不参与本次合同口径纠偏。
  if (!questionText.includes('赢单')) {
    return false;
  }

  // “赢单率、赢率、转化率、成交率”是商机转化率指标，必须保留商机域。
  if (/(赢单率|赢率|转化率|成交率)/u.test(questionText)) {
    return false;
  }

  // 明确提到商机、阶段或漏斗时，用户更可能在查商机阶段，不强制改成合同。
  if (/(商机|机会|阶段|漏斗)/u.test(questionText)) {
    return false;
  }

  return true;
}

/**
 * 判断用户是否在询问订单/下单类成交对象。
 *
 * 参数说明：`questionText` 为用户原始问题或规范化问题。
 * 返回值说明：命中订单、下单、成单等成交对象且不是报价问题时返回 `true`。
 * 调用注意事项：这里只做口径纠偏，实际资源选择仍由执行器根据标准 OpenAPI 能力决定。
 */
function isOrderContractQuestion(questionText: string): boolean {
  if (/(报价|报价单|报价金额)/u.test(questionText)) {
    return false;
  }

  return /(订单|下单|成单|订单金额|下单金额|订单数量|下单数量|订单数|下单数)/u.test(questionText);
}

/**
 * 补齐订单/渠道下单问题的指标和维度。
 *
 * 参数说明：`questionText` 为规范化问题，`dimensions` 为 AI 返回的维度。
 * 返回值说明：返回去重后的维度列表。
 * 调用注意事项：只补齐用户文本已经明确表达的维度，不凭空添加业务过滤条件。
 */
function normalizeOrderDimensions(questionText: string, dimensions: string[]): string[] {
  const normalized = new Set(dimensions);
  if (/(渠道|渠道商|服务商|代理商|经销商|合作渠道|伙伴)/u.test(questionText)) {
    normalized.add('渠道商');
  }
  if (/(趋势|走势|按月|逐月|月份|月度|看板|报告|汇总分析|经营分析|最近三个月|近三个月|最近一年)/u.test(questionText)) {
    normalized.add('月份');
  }
  return [...normalized];
}

/**
 * 将 AI 返回的包容式日末边界转成执行器使用的排他边界。
 *
 * 参数说明：`slot` 为已标准化时间槽。
 * 返回值：如果能识别日末包容边界，返回次日零点且 `end` 为 `exclusive` 的时间槽。
 * 设计原因：查询编译器统一使用 `< endAt`，若直接传入 `23:59:59` 会漏掉最后一秒数据。
 */
function normalizeExclusiveEndBoundary(slot: TemporalSlot): TemporalSlot {
  // 只有日粒度包容式结束边界会与 `< endAt` 执行语义冲突，其它时间槽保持原样。
  if (slot.inclusivity.end !== 'inclusive' || slot.granularity !== 'day' || !slot.endAt) {
    return slot;
  }

  const offsetEndAtMatch = slot.endAt.match(
    /^(?<date>\d{4}-\d{2}-\d{2})T23:59:59(?:\.\d{1,3})?(?<offset>[+-]\d{2}:\d{2})$/u,
  );
  // 带东八区偏移的日末时间可直接归一为次日零点，保留原偏移表达。
  if (offsetEndAtMatch?.groups?.date && offsetEndAtMatch.groups.offset) {
    const nextDay = new Date(`${offsetEndAtMatch.groups.date}T00:00:00${offsetEndAtMatch.groups.offset}`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const normalizedDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(nextDay);
    return {
      ...slot,
      endAt: `${normalizedDate}T00:00:00${offsetEndAtMatch.groups.offset}`,
      inclusivity: { start: 'inclusive', end: 'exclusive' },
    };
  }

  const parsedEndAt = Date.parse(slot.endAt);
  // 无法可靠解析的时间文本不做猜测，交给后续时间槽校验继续处理。
  if (!Number.isFinite(parsedEndAt)) {
    return slot;
  }

  const shanghaiEndParts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(parsedEndAt));
  const shanghaiEndTime = Object.fromEntries(
    shanghaiEndParts
      .filter((item) => ['hour', 'minute', 'second'].includes(item.type))
      .map((item) => [item.type, item.value]),
  );
  // 只有上海时区视角下的 23:59:59 才代表日末包容边界；其它时间不擅自位移。
  if (
    shanghaiEndTime.hour !== '23' ||
    shanghaiEndTime.minute !== '59' ||
    shanghaiEndTime.second !== '59'
  ) {
    return slot;
  }

  return {
    ...slot,
    endAt: new Date(parsedEndAt + 1000).toISOString(),
    inclusivity: { start: 'inclusive', end: 'exclusive' },
  };
}

function getReferenceNow(context: AnalysisIntentPackContext): Date {
  const rawNow = context.referenceNowIso?.trim();
  const parsedNow = rawNow ? Date.parse(rawNow) : NaN;
  return Number.isFinite(parsedNow) ? new Date(parsedNow) : new Date();
}

function getShanghaiLocalNow(context: AnalysisIntentPackContext): Date {
  return new Date(getReferenceNow(context).getTime() + 8 * 60 * 60 * 1000);
}

function buildShanghaiMonthBoundaryIso(year: number, monthIndex: number): string {
  return new Date(Date.UTC(year, monthIndex, 1, -8, 0, 0, 0)).toISOString();
}

function parseMonthCount(rawValue: string): number | undefined {
  const parsedNumber = Number(rawValue);
  if (Number.isInteger(parsedNumber)) {
    return parsedNumber;
  }

  const chineseNumberMap: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
    十一: 11,
    十二: 12,
  };

  return chineseNumberMap[rawValue];
}

function parseQuarterIndex(rawValue: string): number {
  const quarterIndexMap: Record<string, number> = {
    一: 0,
    '1': 0,
    二: 1,
    '2': 1,
    三: 2,
    '3': 2,
    四: 3,
    '4': 3,
  };

  return quarterIndexMap[rawValue] ?? -1;
}

function createResolvedTemporalSlot(params: {
  label: string;
  startAt: string;
  endAt: string;
  granularity: TemporalGranularity;
  relativity: TemporalRelativity;
}): TemporalSlot {
  return {
    rawText: params.label,
    normalizedLabel: params.label,
    startAt: params.startAt,
    endAt: params.endAt,
    timezone: 'Asia/Shanghai',
    granularity: params.granularity,
    relativity: params.relativity,
    inclusivity: {
      start: 'inclusive',
      end: 'exclusive',
    },
    confidence: 'HIGH',
  };
}

function resolveRelativeTemporalSlot(
  slot: TemporalSlot | undefined,
  context: AnalysisIntentPackContext,
): TemporalSlot | undefined {
  if (!slot || (slot.startAt && slot.endAt && slot.confidence !== 'LOW')) {
    return slot;
  }

  const rawText = slot.rawText.replace(/\s+/gu, '').trim();
  const localNow = getShanghaiLocalNow(context);
  const currentYear = localNow.getUTCFullYear();
  const currentMonthIndex = localNow.getUTCMonth();

  if (
    rawText === '最近一年' ||
    rawText === '近一年' ||
    rawText === '过去一年' ||
    rawText === '近12个月'
  ) {
    return createResolvedTemporalSlot({
      label: slot.rawText,
      startAt: buildShanghaiMonthBoundaryIso(currentYear, currentMonthIndex - 12),
      endAt: buildShanghaiMonthBoundaryIso(currentYear, currentMonthIndex + 1),
      granularity: 'year',
      relativity: 'relative',
    });
  }

  const monthRangeMatch = rawText.match(
    /^(最近|近|前|过去)(十二|十一|十|九|八|七|六|五|四|三|两|二|一|\d{1,2})个?月$/u,
  );
  if (monthRangeMatch?.[2]) {
    const monthCount = parseMonthCount(monthRangeMatch[2]);
    if (monthCount && monthCount >= 1 && monthCount <= 24) {
      return createResolvedTemporalSlot({
        label: slot.rawText,
        startAt: buildShanghaiMonthBoundaryIso(
          currentYear,
          currentMonthIndex - (monthCount - 1),
        ),
        endAt: buildShanghaiMonthBoundaryIso(currentYear, currentMonthIndex + 1),
        granularity: 'month',
        relativity: 'relative',
      });
    }
  }

  if (rawText === '本月' || rawText === '当月') {
    return createResolvedTemporalSlot({
      label: slot.rawText,
      startAt: buildShanghaiMonthBoundaryIso(currentYear, currentMonthIndex),
      endAt: buildShanghaiMonthBoundaryIso(currentYear, currentMonthIndex + 1),
      granularity: 'month',
      relativity: 'relative',
    });
  }

  if (rawText === '本季度') {
    const quarterStartMonth = Math.floor(currentMonthIndex / 3) * 3;
    return createResolvedTemporalSlot({
      label: slot.rawText,
      startAt: buildShanghaiMonthBoundaryIso(currentYear, quarterStartMonth),
      endAt: buildShanghaiMonthBoundaryIso(currentYear, quarterStartMonth + 3),
      granularity: 'quarter',
      relativity: 'relative',
    });
  }

  if (rawText === '上季度') {
    const quarterStartMonth = Math.floor(currentMonthIndex / 3) * 3;
    return createResolvedTemporalSlot({
      label: slot.rawText,
      startAt: buildShanghaiMonthBoundaryIso(currentYear, quarterStartMonth - 3),
      endAt: buildShanghaiMonthBoundaryIso(currentYear, quarterStartMonth),
      granularity: 'quarter',
      relativity: 'relative',
    });
  }

  if (rawText === '去年同期') {
    return createResolvedTemporalSlot({
      label: slot.rawText,
      startAt: buildShanghaiMonthBoundaryIso(currentYear - 1, currentMonthIndex),
      endAt: buildShanghaiMonthBoundaryIso(currentYear - 1, currentMonthIndex + 1),
      granularity: slot.granularity === 'quarter' ? 'quarter' : 'month',
      relativity: 'relative',
    });
  }

  if (rawText === '本财年') {
    return createResolvedTemporalSlot({
      label: slot.rawText,
      startAt: buildShanghaiMonthBoundaryIso(currentYear, 0),
      endAt: buildShanghaiMonthBoundaryIso(currentYear + 1, 0),
      granularity: 'year',
      relativity: 'relative',
    });
  }

  const quarterMatch = rawText.match(
    /^(?<year>\d{4})年(?<quarter>一|二|三|四|1|2|3|4)季度$/u,
  );
  if (quarterMatch?.groups?.year && quarterMatch.groups.quarter) {
    const year = Number(quarterMatch.groups.year);
    const quarterIndex = parseQuarterIndex(quarterMatch.groups.quarter);
    if (Number.isFinite(year) && quarterIndex >= 0) {
      return createResolvedTemporalSlot({
        label: slot.rawText,
        startAt: buildShanghaiMonthBoundaryIso(year, quarterIndex * 3),
        endAt: buildShanghaiMonthBoundaryIso(year, quarterIndex * 3 + 3),
        granularity: 'quarter',
        relativity: 'absolute',
      });
    }
  }

  return slot;
}

function buildLegacyTemporalSlot(raw: AnalysisIntentRawOutput): TemporalSlot | undefined {
  const rawText =
    (typeof raw.timeRangeText === 'string' && raw.timeRangeText.trim()) ||
    (typeof raw.timeRange === 'string' && raw.timeRange.trim()) ||
    '';
  if (!rawText || typeof raw.startAt !== 'string' || !raw.startAt.trim()) {
    return undefined;
  }

  return {
    rawText,
    normalizedLabel: rawText,
    startAt: raw.startAt.trim(),
    timezone: 'Asia/Shanghai',
    granularity: rawText.includes('季度')
      ? 'quarter'
      : rawText.includes('年')
        ? 'year'
        : rawText.includes('周')
          ? 'week'
          : rawText.includes('月')
            ? 'month'
            : 'custom',
    relativity: 'relative',
    inclusivity: {
      start: 'inclusive',
      end: 'exclusive',
    },
    confidence: normalizeConfidence(raw.confidence, 'MEDIUM'),
  };
}

function isExecutableTemporalSlot(slot: TemporalSlot | undefined): slot is TemporalSlot {
  return Boolean(slot?.startAt && slot?.endAt && slot.confidence !== 'LOW');
}

function normalizeResultIntent(
  value: unknown,
): AnalysisIntent['resultIntent'] | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim();
  if (
    normalizedValue === 'ranking' ||
    normalizedValue === 'trend' ||
    normalizedValue === 'distribution' ||
    normalizedValue === 'detail' ||
    normalizedValue === 'comparison' ||
    normalizedValue === 'summary' ||
    normalizedValue === 'unknown'
  ) {
    return normalizedValue;
  }

  return undefined;
}

function resolveResultKindHint(params: {
  analysisFacetProfile?: AnalysisFacetProfile;
  resultIntent?: AnalysisIntent['resultIntent'];
  dimensions: string[];
}): AnalysisIntent['resultKindHint'] {
  if (params.analysisFacetProfile === 'opportunity-risk') {
    return 'risk-overview';
  }

  if (params.dimensions.includes('渠道商')) {
    return 'partner-contribution';
  }

  if (params.analysisFacetProfile === 'region-operations') {
    return 'department-contribution';
  }

  if (params.resultIntent === 'trend' || params.dimensions.includes('月份')) {
    return 'time-trend';
  }

  if (params.dimensions.includes('商机阶段')) {
    return 'stage-distribution';
  }

  if (params.dimensions.includes('客户分类')) {
    return 'category-distribution';
  }

  return 'owner-ranking';
}

export const analysisIntentPack: AiCapabilityPackDefinition<
  AnalysisIntentPackContext,
  AnalysisIntentRawOutput,
  AnalysisIntent
> = {
  packCode: 'analysis-intent-pack',
  packVersion: '2026-04-24.1',
  buildStructuredRequest: (context) => ({
    prompt: [
      '你是 CRM 智能分析系统的一期问数意图解析器。',
      '请把用户问题转成结构化 JSON。',
      '必须严格遵守以下限制：',
      '1. 主题只能是 opportunity-analysis、contract-conversion、customer-relationship。',
      '2. 指标只能从 新增商机金额、商机数量、赢单率、转合同金额、客户贡献度 中选择。',
      '2.1 用户说“订单金额、下单金额、订单总额、下单总额、签约额、成单金额”时，统一输出 contract-conversion + 转合同金额；用户说“订单数量、下单数量、订单数、下单数、成单数量”时，也归入 contract-conversion，并把指标输出为转合同金额，数量由执行层按 count 统计。',
      '3. 维度只能从 销售负责人、区域、渠道商、月份、商机阶段、客户分类 中选择；用户说“服务商、渠道、伙伴、代理商、经销商”时统一输出“渠道商”。',
      '3.1 用户说“合作渠道、代理商、服务商、渠道下单、渠道订单、渠道商订单”时必须包含维度“渠道商”；如果同时出现“趋势、按月、近三个月、最近一年、年度、看板、报告、汇总分析”，还应包含维度“月份”。',
      '4. 如果问题要求创建客户/商机、写入、保存、删除、更新 CRM 状态、把商机改成已成交等真实写操作，requestedAction 必须是 BLOCK。',
      '4.1 用户说“改成一月份、换成近三个月、调整为华东区、只看某负责人、按月份看”等查询条件改写时，仍属于只读分析，requestedAction 必须是 READONLY_ANALYSIS。',
      '4.2 用户问“有多少客户没有报备商机、未建商机、客户创建了多久、创建多长时间、客户生命周期分布”等，是客户主数据只读统计分析，不是创建客户/商机，requestedAction 必须是 READONLY_ANALYSIS。',
      '5. 如果问题完全没有给时间范围，不要把“时间范围”放入 missingConditions，后续会默认查询当前账号权限内全部可见数据；如果问题包含自然语言时间表达，必须通过 temporalSlot 输出结构化时间槽，不要把时间理解长期沉淀为本地关键词规则。',
      '5.1 missingConditions 只允许填写真正阻断执行、必须用户补充的缺口；如果问题已经能按默认指标、默认维度或权限内全量范围执行，不要把“未指定指标/维度/时间但默认提供...”写入 missingConditions。',
      '6. queryEntities 应尽量提取本次问数真正涉及的业务对象、分组对象或关注对象，例如“合同”“订单”“下单”“区域”“销售负责人”“渠道商”。',
      '7. resultIntent 只能从 ranking、trend、distribution、detail、comparison、summary、unknown 中选择，用于表达结果更像排行、趋势、分布、明细还是对比；如果用户是在问“前两个月的商机情况”“前三个月的商机情况”“最近四个月的商机情况”“近两个月合同情况”这类时间窗口总体情况，优先输出 trend。',
      '8. temporalSlot 必须承载时间理解结果，包含 rawText、normalizedLabel、startAt、endAt、timezone、granularity、relativity、inclusivity、confidence；如果无法可靠解析，confidence 返回 LOW 并填写 unresolvedReason，不得编造边界。',
      `9. 当前时间基准为 ${getReferenceNow(context).toISOString()}，时区固定为 ${context.timezone ?? 'Asia/Shanghai'}。对于“最近一年、最近四个月、上季度、去年同期、本财年”等相对时间，必须基于该时间基准直接计算 startAt/endAt，不得因为“需要结合当前日期”而返回 LOW。`,
      '10. timeRangeText 应优先回写用户原问题里最关键的时间表达，如“本月”“近三个月”；若问题没有明确时间，可返回空字符串。',
      '11. analysisFacetProfile 只能从 owner-performance-ranking、region-operations、customer-operations、opportunity-risk、lead-funnel、generic-analysis 中选择，用于标识主题报告档案。',
      '12. analysisDepth 只能从 snapshot、standard、deep-dive 中选择。单点数字或单点排行更接近 snapshot；“分析报告、经营总结、详细分析、作战建议、风险总结、看板、经营看板、汇总分析”等管理摘要式问法优先输出 deep-dive。',
      '13. analysisFocus 应输出本次明确要求展开的重点，例如 trend、risk、region、customer-contribution、structure、ranking、detail；没有额外偏好时可以返回空数组。',
      '14. outputPreference 应输出用户希望的呈现方式，只能从 text_summary、table、chart、wecom_image、html_report、export_file 中选择；例如“用表格/明细”输出 table，“图表/看板”输出 chart，“完整报告/HTML/链接”输出 html_report，“导出/Excel”输出 export_file。',
      '15. normalizedQuestion 使用中文原问题的规范化版本。',
      '16. 如果 requestedAction 是 BLOCK，blockReason 必须给出阻断原因；如果不是 BLOCK，blockReason 也要返回空字符串，保证输出结构稳定。',
      '17. 正例：“最近一年各销售负责人新增商机金额排名，请做详细分析总结” 应输出 owner-performance-ranking + deep-dive，并至少覆盖 ranking、trend、risk 侧重点。',
      '18. 正例：“最近三个月有哪些高风险商机” 应输出 opportunity-risk，不能退化成普通明细查询。',
      '19. 反例：“本月新增商机金额是多少” 属于 snapshot，不要强行扩成详细报告。',
      '20. 口径区分：“赢单率、赢率、转化率、成交率” 是商机转化率，属于 opportunity-analysis；但“赢单排名、昨天销售赢单、赢单金额、赢单单数”里的独立“赢单”表示已签单/已成单合同，必须输出 contract-conversion + 转合同金额，不得误归为赢单率。',
      '21. 日粒度相对时间必须输出排他结束边界，例如“昨天”应输出次日 00:00:00 作为 endAt，并将 inclusivity.end 设为 exclusive。',
      '22. 正例：“最近三个月山东区域，有商机的服务商，对应的商机数量和商机金额、以及总金额” 应输出 opportunity-analysis + 渠道商 + 区域 + 月份，resultIntent 为 ranking 或 summary，resultKindHint 最终应能落到 partner-contribution。',
      '23. 正例：“最近三个月山东区域，有下单的服务商，对应的订单数量、订单金额以及总金额，生成汇总分析报告” 应输出 contract-conversion + 转合同金额 + 渠道商 + 区域 + 月份，analysisDepth 为 deep-dive，outputPreference 至少包含 text_summary、table、chart。',
      '24. 正例：“商机情况再加趋势和阶段分布，用表格和图表呈现” 应输出 analysisFocus 至少包含 trend、structure、detail，outputPreference 至少包含 table、chart。',
      `用户问题：${context.questionText}`,
    ].join('\n'),
    outputSchema: {
      type: 'object',
      additionalProperties: false,
      required: [
        'domain',
        'metrics',
        'dimensions',
        'missingConditions',
        'normalizedQuestion',
        'requestedAction',
        'confidence',
        'blockReason',
      ],
      properties: {
        domain: {
          type: 'string',
          enum: [
            'opportunity-analysis',
            'contract-conversion',
            'customer-relationship',
          ],
        },
        metrics: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['新增商机金额', '商机数量', '赢单率', '转合同金额', '客户贡献度'],
          },
        },
        dimensions: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['销售负责人', '区域', '渠道商', '月份', '商机阶段', '客户分类'],
          },
        },
        missingConditions: {
          type: 'array',
          items: { type: 'string' },
        },
        normalizedQuestion: { type: 'string' },
        timeRange: { type: 'string' },
        startAt: { type: 'string' },
        timeRangeText: { type: 'string' },
        temporalSlot: {
          type: 'object',
          additionalProperties: false,
          required: [
            'rawText',
            'normalizedLabel',
            'timezone',
            'granularity',
            'relativity',
            'inclusivity',
            'confidence',
          ],
          properties: {
            rawText: { type: 'string' },
            normalizedLabel: { type: 'string' },
            startAt: { type: 'string' },
            endAt: { type: 'string' },
            timezone: { type: 'string', enum: ['Asia/Shanghai'] },
            granularity: {
              type: 'string',
              enum: ['day', 'week', 'month', 'quarter', 'year', 'custom'],
            },
            relativity: {
              type: 'string',
              enum: ['absolute', 'relative', 'mixed'],
            },
            inclusivity: {
              type: 'object',
              additionalProperties: false,
              properties: {
                start: { type: 'string', enum: ['inclusive'] },
                end: { type: 'string', enum: ['exclusive', 'inclusive'] },
              },
            },
            confidence: {
              type: 'string',
              enum: ['HIGH', 'MEDIUM', 'LOW'],
            },
            unresolvedReason: { type: 'string' },
          },
        },
        queryEntities: {
          type: 'array',
          items: { type: 'string' },
        },
        resultIntent: {
          type: 'string',
          enum: ['ranking', 'trend', 'distribution', 'detail', 'comparison', 'summary', 'unknown'],
        },
        analysisFacetProfile: {
          type: 'string',
          enum: [
            'owner-performance-ranking',
            'region-operations',
            'customer-operations',
            'opportunity-risk',
            'lead-funnel',
            'generic-analysis',
          ],
        },
        analysisDepth: {
          type: 'string',
          enum: ['snapshot', 'standard', 'deep-dive'],
        },
        analysisFocus: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'ranking',
              'trend',
              'risk',
              'region',
              'customer-contribution',
              'structure',
              'detail',
              'summary',
            ],
          },
        },
        outputPreference: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'text_summary',
              'table',
              'chart',
              'wecom_image',
              'html_report',
              'export_file',
            ],
          },
        },
        requestedAction: {
          type: 'string',
          enum: ['READONLY_ANALYSIS', 'BLOCK'],
        },
        confidence: {
          type: 'string',
          enum: ['HIGH', 'MEDIUM', 'LOW'],
        },
        blockReason: { type: 'string' },
      },
    },
  }),
  normalize: (raw, context) => {
    const normalizedQuestion =
      (typeof raw.normalizedQuestion === 'string' && raw.normalizedQuestion.trim()) ||
      context.questionText.trim();
    const normalizedDimensions = normalizeStringArray(raw.dimensions);
    const rawMetrics = normalizeStringArray(raw.metrics);
    const normalizedResultIntent = normalizeResultIntent(raw.resultIntent);
    const normalizedFacetProfile =
      normalizeAnalysisFacetProfile(raw.analysisFacetProfile) ??
      inferAnalysisFacetProfile(normalizedQuestion);
    const normalizedDepth =
      normalizeAnalysisDepth(raw.analysisDepth) ??
      inferAnalysisDepth(normalizedQuestion);
    const normalizedFocus = resolveAnalysisFocus(
      normalizedQuestion,
      normalizeAnalysisFocus(raw.analysisFocus),
    );
    const normalizedOutputPreference = resolveAnalysisOutputPreference(
      normalizedQuestion,
      normalizeAnalysisOutputPreference(raw.outputPreference),
    );
    const normalizedTemporalSlot = resolveRelativeTemporalSlot(
      normalizeTemporalSlot(raw.temporalSlot) ?? buildLegacyTemporalSlot(raw),
      context,
    );
    const normalizedExecutableTemporalSlot =
      normalizedTemporalSlot && isExecutableTemporalSlot(normalizedTemporalSlot)
        ? normalizeExclusiveEndBoundary(normalizedTemporalSlot)
        : normalizedTemporalSlot;
    const executableTemporalSlot = isExecutableTemporalSlot(normalizedExecutableTemporalSlot)
      ? normalizedExecutableTemporalSlot
      : undefined;
    const questionHasTemporalConstraint = hasExplicitTemporalConstraint(normalizedQuestion);
    const normalizedMissingConditions = normalizeAnalysisMissingConditions(
      raw.missingConditions,
      {
        keepTimeRangeCondition: Boolean(
          (normalizedTemporalSlot && !executableTemporalSlot) ||
            (!normalizedTemporalSlot && questionHasTemporalConstraint),
        ),
        dropDefaultableMetricOrDimension:
          rawMetrics.length > 0 ||
          normalizedDimensions.length > 0 ||
          normalizedFacetProfile !== 'generic-analysis',
      },
    );
    if (
      ((normalizedTemporalSlot && !executableTemporalSlot && normalizedTemporalSlot.rawText) ||
        (!normalizedTemporalSlot && questionHasTemporalConstraint)) &&
      !normalizedMissingConditions.includes('时间范围')
    ) {
      normalizedMissingConditions.push('时间范围');
    }

    const shouldUseContractWonOrder = isWonOrderContractQuestion(normalizedQuestion);
    const shouldUseOrderContract = isOrderContractQuestion(normalizedQuestion);
    const shouldUseContractDomain = shouldUseContractWonOrder || shouldUseOrderContract;
    const rawQueryEntities = normalizeStringArray(raw.queryEntities);
    const finalDimensions = shouldUseOrderContract
      ? normalizeOrderDimensions(normalizedQuestion, normalizedDimensions)
      : normalizedDimensions;
    const requestedAction =
      isReadOnlyCustomerLifecycleQuestion(normalizedQuestion) ||
      isReadOnlyQueryRewrite(normalizedQuestion)
      ? 'READONLY_ANALYSIS'
      : raw.requestedAction ?? 'BLOCK';

    return {
      domain: shouldUseContractDomain
        ? 'contract-conversion'
        : raw.domain ?? 'opportunity-analysis',
      metrics: shouldUseContractDomain ? ['转合同金额'] : rawMetrics,
      dimensions: finalDimensions,
      filters: executableTemporalSlot
        ? {
            timeRange: executableTemporalSlot.normalizedLabel,
            startAt: executableTemporalSlot.startAt,
            ...(executableTemporalSlot.endAt ? { endAt: executableTemporalSlot.endAt } : {}),
          }
        : {},
      ...(normalizedExecutableTemporalSlot ? { temporalSlot: normalizedExecutableTemporalSlot } : {}),
      missingConditions: normalizedMissingConditions,
      normalizedQuestion,
      queryEntities: shouldUseContractDomain
        ? [
            ...new Set([
              shouldUseOrderContract ? '订单' : '合同',
              ...finalDimensions,
              ...rawQueryEntities,
            ]),
          ]
        : rawQueryEntities,
      resultIntent: normalizedResultIntent,
      timeRangeText:
        (typeof raw.timeRangeText === 'string' && raw.timeRangeText.trim()) ||
        executableTemporalSlot?.rawText ||
        undefined,
      requestedAction,
      confidence:
        requestedAction === 'READONLY_ANALYSIS' && raw.confidence === 'LOW'
          ? 'MEDIUM'
          : raw.confidence ?? 'LOW',
      blockReason:
        requestedAction === 'READONLY_ANALYSIS'
          ? ''
          : typeof raw.blockReason === 'string' ? raw.blockReason.trim() : '',
      analysisFacetProfile: normalizedFacetProfile,
      analysisDepth: normalizedDepth,
      analysisFocus: normalizedFocus,
      outputPreference: normalizedOutputPreference,
      orderBy: [],
      resultKindHint: resolveResultKindHint({
        analysisFacetProfile: normalizedFacetProfile,
        resultIntent: normalizedResultIntent,
        dimensions: finalDimensions,
      }),
    };
  },
};

export interface TimeRangeWindow {
  label: string;
  startAt: string;
}

/**
 * 旧版本地时间词表仅保留给测试辅助和迁移兼容场景。
 *
 * 自由问数主链必须消费 AI 输出的 `TemporalSlot`，不得调用本文件来决定可执行时间范围。
 */

const CHINESE_MONTH_NUMBER_MAP: Record<string, number> = {
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

function findMatchedLabel(questionText: string, labels: string[]): string | undefined {
  return labels.find((label) => questionText.includes(label));
}

function parseMonthCount(rawValue: string): number | undefined {
  const parsedNumber = Number(rawValue);
  if (Number.isInteger(parsedNumber)) {
    return parsedNumber;
  }

  return CHINESE_MONTH_NUMBER_MAP[rawValue];
}

function detectFlexibleMonthRange(questionText: string): TimeRangeWindow | undefined {
  const monthRangeMatch = questionText.match(
    /(最近|近|前)(十二|十一|十|九|八|七|六|五|四|三|两|二|\d{1,2})个?月/u,
  );
  const rawMonthCount = monthRangeMatch?.[2];
  if (!rawMonthCount) {
    return undefined;
  }

  const monthCount = parseMonthCount(rawMonthCount);
  if (!monthCount || monthCount < 3 || monthCount > 12) {
    return undefined;
  }

  return {
    label: monthRangeMatch[0],
    startAt: buildLocalMonthOffsetStartIso(-(monthCount - 1)),
  };
}

function buildLocalMidnightIso(offsetDays = 0): string {
  const now = new Date();
  const local = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  local.setUTCDate(local.getUTCDate() + offsetDays);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - 8 * 60 * 60 * 1000).toISOString();
}

function buildLocalMonthStartIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  local.setUTCDate(1);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - 8 * 60 * 60 * 1000).toISOString();
}

function buildLocalMonthOffsetStartIso(offsetMonths = 0): string {
  const now = new Date();
  const local = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  local.setUTCDate(1);
  local.setUTCMonth(local.getUTCMonth() + offsetMonths);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - 8 * 60 * 60 * 1000).toISOString();
}

function buildLocalQuarterStartIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const quarterStartMonth = Math.floor(local.getUTCMonth() / 3) * 3;
  local.setUTCMonth(quarterStartMonth, 1);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - 8 * 60 * 60 * 1000).toISOString();
}

/**
 * 识别少量历史时间表达。
 *
 * 参数说明：`questionText` 为测试或迁移工具输入的中文问题。
 * 返回值：旧版 `{ label, startAt }` 结构；无法识别时返回 `undefined`。
 * 调用注意：不得在自由问数主执行链路中调用，运行时应使用 AI 标准时间槽。
 */
export function detectTimeRange(questionText: string): TimeRangeWindow | undefined {
  if (
    questionText.includes('今日') ||
    questionText.includes('今天') ||
    questionText.includes('本日') ||
    questionText.includes('当天')
  ) {
    return { label: '今日', startAt: buildLocalMidnightIso(0) };
  }

  if (questionText.includes('明日') || questionText.includes('明天')) {
    return { label: '明日', startAt: buildLocalMidnightIso(1) };
  }

  if (questionText.includes('后天')) {
    return { label: '后天', startAt: buildLocalMidnightIso(2) };
  }

  if (questionText.includes('当月')) {
    return { label: '当月', startAt: buildLocalMonthStartIso() };
  }

  if (questionText.includes('本月')) {
    return { label: '本月', startAt: buildLocalMonthStartIso() };
  }

  if (questionText.includes('本季度')) {
    return { label: '本季度', startAt: buildLocalQuarterStartIso() };
  }

  const twoMonthLabel = findMatchedLabel(questionText, [
    '前两个月',
    '近两个月',
    '最近两个月',
    '前两月',
    '近两月',
    '最近两月',
    '前2个月',
    '近2个月',
    '最近2个月',
  ]);
  if (twoMonthLabel) {
    return { label: twoMonthLabel, startAt: buildLocalMonthOffsetStartIso(-2) };
  }

  const threeMonthLabel = findMatchedLabel(questionText, [
    '前三个月',
    '近三个月',
    '最近三个月',
    '前三月',
    '近三月',
    '最近三月',
    '前3个月',
    '近3个月',
    '最近3个月',
  ]);
  if (threeMonthLabel) {
    return { label: threeMonthLabel, startAt: buildLocalMonthOffsetStartIso(-2) };
  }

  const flexibleMonthRange = detectFlexibleMonthRange(questionText);
  if (flexibleMonthRange) {
    return flexibleMonthRange;
  }

  if (questionText.includes('最近30天')) {
    return { label: '最近30天', startAt: buildLocalMidnightIso(-29) };
  }

  if (
    questionText.includes('最近一年') ||
    questionText.includes('近一年') ||
    questionText.includes('过去一年') ||
    questionText.includes('近12个月')
  ) {
    return { label: '最近一年', startAt: buildLocalMonthOffsetStartIso(-12) };
  }

  return undefined;
}

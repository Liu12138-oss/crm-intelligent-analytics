import type {
  ResultTemporalScope,
  TemporalSlot,
} from '../../shared/types/domain';

/**
 * 将入口时间槽转换为结果包时间口径。
 *
 * 参数说明：
 * - `temporalSlot`：AI 理解层输出并通过执行前校验的时间槽。
 * - `source`：结果口径来源，默认表示来自 AI 标准时间槽。
 * 返回值：可直接落入结果包、最近查询和渠道展示的时间口径；缺少时间槽时返回 `undefined`。
 */
export function buildResultTemporalScope(
  temporalSlot: TemporalSlot | undefined,
  source: ResultTemporalScope['source'] = 'AI_TEMPORAL_SLOT',
): ResultTemporalScope | undefined {
  if (!temporalSlot) {
    return undefined;
  }

  return {
    rawText: temporalSlot.rawText,
    normalizedLabel: temporalSlot.normalizedLabel,
    startAt: temporalSlot.startAt,
    endAt: temporalSlot.endAt,
    granularity: temporalSlot.granularity,
    timezone: temporalSlot.timezone,
    source,
  };
}

/**
 * 将最近查询保存的时间口径还原为可执行时间槽。
 *
 * 参数说明：
 * - `scope`：历史结果包保存的实际执行时间口径。
 * 返回值：复用原边界的 `TemporalSlot`；若历史记录没有时间口径则返回 `undefined`。
 * 调用注意：最近查询重跑默认复用已审计边界，避免重新解析相对时间文本造成口径漂移。
 */
export function buildTemporalSlotFromScope(
  scope: ResultTemporalScope | undefined,
): TemporalSlot | undefined {
  if (!scope) {
    return undefined;
  }

  return {
    rawText: scope.rawText,
    normalizedLabel: scope.normalizedLabel,
    startAt: scope.startAt,
    endAt: scope.endAt,
    timezone: 'Asia/Shanghai',
    granularity: scope.granularity === 'day' ||
      scope.granularity === 'week' ||
      scope.granularity === 'month' ||
      scope.granularity === 'quarter' ||
      scope.granularity === 'year' ||
      scope.granularity === 'custom'
      ? scope.granularity
      : 'custom',
    relativity: scope.source === 'USER_EXPLICIT' ? 'absolute' : 'relative',
    inclusivity: {
      start: 'inclusive',
      end: 'exclusive',
    },
    confidence: 'HIGH',
  };
}

/**
 * 生成用于页面、Markdown 和审计排障的时间口径说明。
 *
 * 参数说明：
 * - `scope`：统一结果包时间口径。
 * 返回值：中文展示文案；缺少时间口径时返回空字符串，调用方可选择不展示。
 */
export function formatTemporalScopeLabel(
  scope: ResultTemporalScope | undefined,
): string {
  if (!scope) {
    return '';
  }

  const boundaryText = scope.startAt && scope.endAt
    ? `（${scope.startAt} 至 ${scope.endAt}，${scope.timezone}）`
    : '';
  return `${scope.normalizedLabel}${boundaryText}`;
}

/**
 * 判断两个时间口径是否完全一致。
 *
 * 参数说明：
 * - `left` / `right`：需要比较的结果时间口径。
 * 返回值：核心字段全部一致时返回 `true`。
 */
export function isSameTemporalScope(
  left: ResultTemporalScope | undefined,
  right: ResultTemporalScope | undefined,
): boolean {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return left.rawText === right.rawText &&
    left.normalizedLabel === right.normalizedLabel &&
    left.startAt === right.startAt &&
    left.endAt === right.endAt &&
    left.granularity === right.granularity &&
    left.timezone === right.timezone &&
    left.source === right.source;
}

export type AmountSourceUnit = 'yuan' | 'wan';

/**
 * 将未知输入转成有限数值。
 *
 * 参数说明：`value` 为数据库 decimal、数值或展示态金额文本。
 * 返回值：可参与计算的数值；无法解析时返回 0。
 */
export function toFiniteAmountNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value !== 'string') {
    return 0;
  }

  const normalized = value
    .replace(/万元/gu, '')
    .replace(/[,\s￥¥元]/gu, '')
    .replace(/%/gu, '')
    .trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * 将金额换算成万元数值。
 *
 * 参数说明：
 * - `value`：原始金额。
 * - `sourceUnit`：原始单位，默认按 CRM 元级字段处理。
 * 返回值：保留两位小数的万元数值。
 */
export function toWanAmount(value: unknown, sourceUnit: AmountSourceUnit = 'yuan'): number {
  const amount = toFiniteAmountNumber(value);
  const wanAmount = sourceUnit === 'wan' ? amount : amount / 10000;
  return Number(wanAmount.toFixed(2));
}

/**
 * 将金额格式化为业务统一展示口径“万元”。
 *
 * 参数说明：
 * - `value`：原始金额。
 * - `sourceUnit`：原始单位，默认按 CRM 元级字段处理。
 * 返回值：带千分位和万元单位的展示文本。
 */
export function formatWanAmount(
  value: unknown,
  sourceUnit: AmountSourceUnit = 'yuan',
): string {
  const wanAmount = toWanAmount(value, sourceUnit);
  const formatted = wanAmount.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${formatted} 万元`;
}

/**
 * 将展示态金额还原成元级数值，供一致性校验继续与底层明细对齐。
 *
 * 参数说明：`value` 可为“1,384.37 万元”“¥ 500,000”或普通数值。
 * 返回值：按元计的数值；非金额展示文本按普通数值返回。
 */
export function parseDisplayAmountToYuan(value: unknown): number {
  if (typeof value !== 'string') {
    return toFiniteAmountNumber(value);
  }

  const normalized = value.trim();
  if (normalized.includes('万元')) {
    return Number((toFiniteAmountNumber(normalized) * 10000).toFixed(2));
  }

  return toFiniteAmountNumber(normalized);
}

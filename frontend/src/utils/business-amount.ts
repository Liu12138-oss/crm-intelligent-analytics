/**
 * 将未知输入转成有限金额数值。
 * 参数：接口返回的数字、字符串或空值；返回：可计算数值，无法解析时为 0。
 */
export function toFiniteAmountNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value !== 'string') {
    return 0;
  }

  const normalized = value
    .replace(/万元/g, '')
    .replace(/[,\s￥¥元]/g, '')
    .trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * 将 CRM 元级金额格式化为“万元”。
 * 参数：元级金额；返回：带千分位和万元单位的展示文本。
 */
export function formatWanAmount(value: unknown): string {
  const wanAmount = Number((toFiniteAmountNumber(value) / 10000).toFixed(2));
  return `${wanAmount.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} 万元`;
}

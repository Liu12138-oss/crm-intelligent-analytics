const OPPORTUNITY_STAGE_LABELS: Record<string, string> = {
  contacted: '1%已联系客户',
  registered: '20%已登记/已报备',
  budget: '20%已确认预算',
  testing: '30%客户测试中',
  qualified: '30%已确认需求',
  proposal: '50%方案/报价中',
  quoted: '50%已报价',
  negotiation: '70%商务谈判',
  won: '100%已成交',
  lost: '已失单',
  cancelled: '已取消',
  canceled: '已取消',
  closed: '已关闭',
};

/**
 * 将联软商机阶段编码转换为业务用户可读的中文阶段。
 *
 * 参数说明：`value` 为 OpenAPI、SQLite 快照或分析库返回的阶段原始值。
 * 返回值说明：命中常见阶段编码时返回中文阶段；已是中文或未识别编码时保留原文。
 * 调用注意事项：该函数只改变展示文案，不改变聚合、过滤、审计和权限判断使用的原始值。
 */
export function formatOpportunityStageLabel(value: unknown): string {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) {
    return '';
  }

  const normalizedValue = rawValue.toLowerCase().replace(/\s+/gu, '_');
  return OPPORTUNITY_STAGE_LABELS[normalizedValue] ?? rawValue;
}

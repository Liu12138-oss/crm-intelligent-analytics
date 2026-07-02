/**
 * 案例一：广州办渠道下单汇总分析 · 静态数据
 *
 * 数据来源：广州办渠道下单汇总分析.html 内嵌 JSON
 * 口径：合同对方不为空（渠道签约）；合同阶段排除"评审"和"定稿"
 * 数据截至 2026 年 5 月
 */

export const channelOrderSummaryData = {
  meta: {
    title: '广州办渠道下单汇总分析',
    scope: '广州办',
    dataRange: '2023 年以前 ~ 2026 年 5 月',
    filterCriteria: '合同对方不为空（渠道签约）；合同阶段排除"评审"和"定稿"',
    generatedAt: '2026-05-31',
  },
  kpiMetrics: [
    { label: '合作渠道数', value: '253', unit: '家', tone: 'primary' as const },
    { label: '下单总量', value: '909', unit: '单', tone: 'success' as const },
    { label: '下单总额', value: '11055.99', unit: '万', tone: 'primary' as const },
    { label: '平均单笔金额', value: '12.16', unit: '万/单', tone: 'neutral' as const },
  ],
  concentration: {
    totalValue: 11055.99,
    totalUnits: 253,
    tiers: [
      { label: 'TOP5', value: 2985.12, count: 5, percentage: 27.0 },
      { label: 'TOP10', value: 4455.56, count: 10, percentage: 40.3 },
      { label: 'TOP20', value: 6147.13, count: 20, percentage: 55.6 },
      { label: '其余', value: 4908.86, count: 233, percentage: 44.4 },
    ],
    oneTimeCount: 139,
    oneTimePercentage: 54.9,
    insights: [
      'TOP5 渠道贡献了 27.0% 的下单金额，集中度较高',
      'TOP20 渠道贡献了 55.6% 的下单金额，超过半数',
      '一次性合作渠道 139 家，占比 54.9%，超过半数渠道仅合作一次',
      '建议重点维护 TOP20 渠道，同时分析一次性合作流失原因',
    ],
    unitLabel: '万',
  },
  yearlyTrend: {
    categories: ['2023 年以前', '2023', '2024', '2025', '2026'],
    barSeries: [{ name: '下单金额（万）', values: [1820.5, 2156.3, 2890.7, 3120.4, 1068.09] }],
    lineSeries: [{ name: '下单数量（单）', values: [156, 182, 245, 263, 63] }],
    barUnitLabel: '万',
    lineUnitLabel: '单',
  },
  top10Ranking: [
    { rank: 1, name: '深圳XX科技有限公司', count: 48, amount: 685.32, percentage: 6.2 },
    { rank: 2, name: '广州YY信息技术有限公司', count: 42, amount: 592.18, percentage: 5.4 },
    { rank: 3, name: '北京ZZ网络安全有限公司', count: 38, amount: 521.67, percentage: 4.7 },
    { rank: 4, name: '上海AA系统集成有限公司', count: 35, amount: 478.93, percentage: 4.3 },
    { rank: 5, name: '深圳BB数据科技有限公司', count: 31, amount: 432.45, percentage: 3.9 },
    { rank: 6, name: '广州CC智能科技有限公司', count: 28, amount: 398.76, percentage: 3.6 },
    { rank: 7, name: '东莞DD软件有限公司', count: 26, amount: 365.21, percentage: 3.3 },
    { rank: 8, name: '佛山EE信息科技有限公司', count: 24, amount: 342.89, percentage: 3.1 },
    { rank: 9, name: '深圳FF通信技术有限公司', count: 22, amount: 318.54, percentage: 2.9 },
    { rank: 10, name: '中山GG网络有限公司', count: 20, amount: 298.12, percentage: 2.7 },
  ],
  allChannelsTable: [
    { rank: 1, name: '深圳XX科技有限公司', count: 48, amount: 685.32, percentage: '6.2%' },
    { rank: 2, name: '广州YY信息技术有限公司', count: 42, amount: 592.18, percentage: '5.4%' },
    { rank: 3, name: '北京ZZ网络安全有限公司', count: 38, amount: 521.67, percentage: '4.7%' },
    { rank: 4, name: '上海AA系统集成有限公司', count: 35, amount: 478.93, percentage: '4.3%' },
    { rank: 5, name: '深圳BB数据科技有限公司', count: 31, amount: 432.45, percentage: '3.9%' },
    { rank: 6, name: '广州CC智能科技有限公司', count: 28, amount: 398.76, percentage: '3.6%' },
    { rank: 7, name: '东莞DD软件有限公司', count: 26, amount: 365.21, percentage: '3.3%' },
    { rank: 8, name: '佛山EE信息科技有限公司', count: 24, amount: 342.89, percentage: '3.1%' },
    { rank: 9, name: '深圳FF通信技术有限公司', count: 22, amount: 318.54, percentage: '2.9%' },
    { rank: 10, name: '中山GG网络有限公司', count: 20, amount: 298.12, percentage: '2.7%' },
    { rank: 11, name: '珠海HH科技有限公司', count: 18, amount: 276.45, percentage: '2.5%' },
    { rank: 12, name: '江门II信息有限公司', count: 16, amount: 258.33, percentage: '2.3%' },
    { rank: 13, name: '惠州JJ软件有限公司', count: 15, amount: 242.18, percentage: '2.2%' },
    { rank: 14, name: '肇庆KK科技有限公式', count: 14, amount: 228.67, percentage: '2.1%' },
    { rank: 15, name: '深圳LL系统集成有限公司', count: 13, amount: 215.34, percentage: '1.9%' },
  ],
};

export type ChannelOrderSummaryData = typeof channelOrderSummaryData;

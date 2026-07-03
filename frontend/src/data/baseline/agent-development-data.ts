/**
 * 案例二：全国代理商发展运营数据看板 · 静态数据
 *
 * 数据来源：全国代理商发展运营数据看板_20260522.html 内嵌 Base64 JSON
 * 口径：数据截至 2026 年 5 月；趋势覆盖 2024/2025/2026 三年
 * 注意：证书/技术人员数据按用户决策暂不考虑
 */

export const agentDevelopmentData = {
  meta: {
    title: '全国代理商发展运营数据看板',
    scope: '全国',
    dataRange: '2024 ~ 2026 年 5 月',
    filterCriteria: '按大区/团队/合作级别统计',
    generatedAt: '2026-05-22',
  },
  kpiMetrics: [
    { label: '渠道商总数', value: '172', unit: '家', tone: 'primary' as const, sublabel: '含 LEP6/金牌20/签约技术31/提名121' },
    { label: '万亿城市覆盖', value: '18/27', unit: '', tone: 'success' as const, sublabel: '覆盖率 66.7%' },
    { label: '31 省覆盖', value: '25/31', unit: '', tone: 'success' as const, sublabel: '覆盖率 80.6%' },
    { label: '2026 签约额', value: '3260', unit: '万', tone: 'primary' as const, trend: 'up' as const, trendLabel: '同比 +28.5%' },
    { label: '2026 签约数', value: '156', unit: '单', tone: 'success' as const, trend: 'up' as const, trendLabel: '同比 +22.1%' },
    { label: '2026 商机数', value: '428', unit: '个', tone: 'warning' as const, trend: 'up' as const, trendLabel: '同比 +15.3%' },
  ],
  yearlyTrend: {
    categories: ['2024', '2025', '2026（截至5月）'],
    barSeries: [
      { name: '签约额（万）', values: [2150, 2538, 3260] },
    ],
    lineSeries: [
      { name: '签约数（单）', values: [98, 128, 156] },
      { name: '商机数（个）', values: [312, 371, 428] },
    ],
    barUnitLabel: '万',
    lineUnitLabel: '个/单',
  },
  regionComparison: {
    categories: ['大北区', '大东区', '大南区', '大西区'],
    series: [
      { name: '2025 签约额（万）', values: [685, 720, 568, 565] },
      { name: '2026 签约额（万）', values: [892, 935, 736, 697] },
    ],
    unitLabel: '万',
  },
  provinceMap: {
    mapName: 'china',
    totalRegionCount: 31,
    coveredRegionCount: 25,
    totalCityCount: 322,
    coveredCityCount: 68,
    regions: [
      { name: '北京', value: 12 },
      { name: '天津', value: 5 },
      { name: '河北', value: 8 },
      { name: '山西', value: 3 },
      { name: '内蒙古', value: 2 },
      { name: '辽宁', value: 7 },
      { name: '吉林', value: 4 },
      { name: '黑龙江', value: 3 },
      { name: '上海', value: 15 },
      { name: '江苏', value: 18 },
      { name: '浙江', value: 16 },
      { name: '安徽', value: 6 },
      { name: '福建', value: 9 },
      { name: '江西', value: 4 },
      { name: '山东', value: 12 },
      { name: '河南', value: 8 },
      { name: '湖北', value: 7 },
      {
        name: '湖南',
        value: 6,
        coveredCityCount: 3,
        totalCityCount: 14,
        extra: '覆盖地市：3/14',
        cityGroups: [
          { cityName: '长沙', partnerCount: 3, partners: ['长沙核心渠道商', '湖南智联服务商', '星城数字科技'] },
          { cityName: '株洲', partnerCount: 2, partners: ['株洲产业渠道商', '株洲云网科技'] },
          { cityName: '湘潭', partnerCount: 1, partners: ['湘潭创新服务商'] },
        ],
      },
      { name: '广东', value: 22 },
      { name: '广西', value: 3 },
      { name: '海南', value: 2 },
      { name: '重庆', value: 5 },
      { name: '四川', value: 10 },
      { name: '贵州', value: 2 },
      { name: '云南', value: 3 },
      { name: '陕西', value: 4 },
    ],
    unitLabel: '家',
  },
  teamDetail: [
    { rank: 1, region: '大东区', team: '华东一区', agentCount: 28, orderCount: 42, orderAmount: 568.5, percentage: '17.4%' },
    { rank: 2, region: '大东区', team: '华东二区', agentCount: 22, orderCount: 35, orderAmount: 478.2, percentage: '14.7%' },
    { rank: 3, region: '大北区', team: '华北一区', agentCount: 25, orderCount: 38, orderAmount: 452.8, percentage: '13.9%' },
    { rank: 4, region: '大南区', team: '华南一区', agentCount: 20, orderCount: 31, orderAmount: 398.6, percentage: '12.2%' },
    { rank: 5, region: '大北区', team: '华北二区', agentCount: 18, orderCount: 28, orderAmount: 365.2, percentage: '11.2%' },
    { rank: 6, region: '大西区', team: '西南一区', agentCount: 15, orderCount: 22, orderAmount: 298.4, percentage: '9.2%' },
    { rank: 7, region: '大东区', team: '华中一区', agentCount: 14, orderCount: 20, orderAmount: 265.7, percentage: '8.1%' },
    { rank: 8, region: '大南区', team: '华南二区', agentCount: 12, orderCount: 18, orderAmount: 238.9, percentage: '7.3%' },
    { rank: 9, region: '大西区', team: '西北一区', agentCount: 10, orderCount: 14, orderAmount: 198.3, percentage: '6.1%' },
    { rank: 10, region: '大北区', team: '东北一区', agentCount: 8, orderCount: 10, orderAmount: 156.2, percentage: '4.8%' },
  ],
};

export type AgentDevelopmentData = typeof agentDevelopmentData;

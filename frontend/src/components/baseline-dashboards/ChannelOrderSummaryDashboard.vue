<script setup lang="ts">
/**
 * 渠道下单汇总分析看板
 *
 * 标杆看板组件，对标案例一"广州办渠道下单汇总分析.html"
 * 用静态数据验证第 1 期 ECharts block 组件的渲染效果
 */

import { computed } from 'vue';
import ManagementSectionCanvas from '@/components/management-report/ManagementSectionCanvas.vue';
import type { ManagementReportSectionData } from '@/types/management-report';
import { channelOrderSummaryData as data } from '@/data/baseline/channel-order-summary-data';

const section = computed<ManagementReportSectionData>(() => ({
  sectionKey: 'channel-order-summary',
  title: data.meta.title,
  summary: `数据范围：${data.meta.dataRange} | 筛选条件：${data.meta.filterCriteria}`,
  state: 'ready',
  blocks: [
    // KPI 矩阵
    {
      blockId: 'kpi-matrix',
      blockType: 'kpi-matrix',
      title: '核心指标',
      size: 'full',
      layoutHint: 'metric-row',
      metrics: data.kpiMetrics,
      columns: 4,
    },
    // 集中度分析
    {
      blockId: 'concentration',
      blockType: 'concentration',
      title: '集中度分析',
      size: 'full',
      totalValue: data.concentration.totalValue,
      totalUnits: data.concentration.totalUnits,
      tiers: data.concentration.tiers,
      oneTimeCount: data.concentration.oneTimeCount,
      oneTimePercentage: data.concentration.oneTimePercentage,
      insights: data.concentration.insights,
      unitLabel: data.concentration.unitLabel,
    },
    // 年度趋势复合图
    {
      blockId: 'yearly-trend',
      blockType: 'composite-trend',
      title: '年度下单趋势',
      size: 'full',
      categories: data.yearlyTrend.categories,
      barSeries: data.yearlyTrend.barSeries,
      lineSeries: data.yearlyTrend.lineSeries,
      barUnitLabel: data.yearlyTrend.barUnitLabel,
      lineUnitLabel: data.yearlyTrend.lineUnitLabel,
    },
    // 全渠道排名表（可排序筛选）
    {
      blockId: 'all-channels-table',
      blockType: 'sortable-table',
      title: '全渠道排名明细',
      size: 'full',
      layoutHint: 'table-priority',
      searchable: true,
      searchPlaceholder: '搜索渠道名称...',
      pageSize: 10,
      showSummary: true,
      summaryRow: { rank: '合计', name: `${data.kpiMetrics[0].value} 家渠道`, count: `${data.kpiMetrics[1].value} 单`, amount: `${data.kpiMetrics[2].value} 万`, percentage: '100%' },
      columns: [
        { key: 'rank', label: '排名', sortable: true, isRank: true, width: '80px', align: 'center' },
        { key: 'name', label: '渠道名称', sortable: true, filterable: true },
        { key: 'count', label: '下单数', sortable: true, width: '120px', align: 'right' },
        { key: 'amount', label: '金额（万）', sortable: true, isAmount: true, width: '180px', align: 'right' },
        { key: 'percentage', label: '占比', sortable: true, width: '100px', align: 'right' },
      ],
      rows: data.allChannelsTable,
    },
  ],
}));
</script>

<template>
  <div class="channel-order-summary-dashboard">
    <ManagementSectionCanvas :section="section" />
  </div>
</template>

<style scoped>
.channel-order-summary-dashboard {
  width: 100%;
}
</style>

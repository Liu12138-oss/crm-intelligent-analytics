<script setup lang="ts">
/**
 * 全国代理商发展运营数据看板
 *
 * 标杆看板组件，对标案例二"全国代理商发展运营数据看板_20260522.html"
 * 用静态数据验证第 1 期 ECharts block 组件的渲染效果
 * 注意：证书/技术人员数据按用户决策暂不考虑
 */

import { computed } from 'vue';
import ManagementSectionCanvas from '@/components/management-report/ManagementSectionCanvas.vue';
import type { ManagementReportSectionData } from '@/types/management-report';
import { agentDevelopmentData as data } from '@/data/baseline/agent-development-data';

const section = computed<ManagementReportSectionData>(() => ({
  sectionKey: 'agent-development',
  title: data.meta.title,
  summary: `数据范围：${data.meta.dataRange} | 统计维度：${data.meta.filterCriteria}`,
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
      columns: 3,
    },
    // 年度趋势复合图
    {
      blockId: 'yearly-trend',
      blockType: 'composite-trend',
      title: '近 3 年签约 & 商机趋势',
      size: 'full',
      categories: data.yearlyTrend.categories,
      barSeries: data.yearlyTrend.barSeries,
      lineSeries: data.yearlyTrend.lineSeries,
      barUnitLabel: data.yearlyTrend.barUnitLabel,
      lineUnitLabel: data.yearlyTrend.lineUnitLabel,
    },
    // 大区对比分组柱状图
    {
      blockId: 'region-comparison',
      blockType: 'grouped-bar',
      title: '4 大区签约额对比',
      size: 'full',
      categories: data.regionComparison.categories,
      series: data.regionComparison.series,
      unitLabel: data.regionComparison.unitLabel,
    },
    // 31 省覆盖地图
    {
      blockId: 'province-map',
      blockType: 'geo-map',
      title: '31 省代理商覆盖',
      size: 'full',
      mapName: data.provinceMap.mapName,
      totalRegionCount: data.provinceMap.totalRegionCount,
      coveredRegionCount: data.provinceMap.coveredRegionCount,
      regions: data.provinceMap.regions,
      unitLabel: data.provinceMap.unitLabel,
    },
    // 团队明细表
    {
      blockId: 'team-detail',
      blockType: 'sortable-table',
      title: '各团队签约明细',
      size: 'full',
      layoutHint: 'table-priority',
      searchable: true,
      searchPlaceholder: '搜索团队名称...',
      pageSize: 10,
      columns: [
        { key: 'rank', label: '排名', sortable: true, isRank: true, width: '80px', align: 'center' },
        { key: 'region', label: '大区', sortable: true, filterable: true, width: '120px' },
        { key: 'team', label: '团队', sortable: true, filterable: true },
        { key: 'agentCount', label: '代理商数', sortable: true, width: '120px', align: 'right' },
        { key: 'orderCount', label: '签约数', sortable: true, width: '120px', align: 'right' },
        { key: 'orderAmount', label: '签约额（万）', sortable: true, isAmount: true, width: '180px', align: 'right' },
        { key: 'percentage', label: '占全国比', sortable: true, width: '120px', align: 'right' },
      ],
      rows: data.teamDetail,
    },
  ],
}));
</script>

<template>
  <div class="agent-development-dashboard">
    <ManagementSectionCanvas :section="section" />
  </div>
</template>

<style scoped>
.agent-development-dashboard {
  width: 100%;
}
</style>

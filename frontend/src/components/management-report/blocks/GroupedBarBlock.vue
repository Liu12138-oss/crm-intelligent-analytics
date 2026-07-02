<script setup lang="ts">
/**
 * 分组柱状图 Block
 *
 * 用于大区对比、分年对比等多系列柱状图，对标案例二 4 大区签约额对比。
 * 支持垂直/水平方向，支持多系列分组。
 */

import { ref, computed } from 'vue';
import { ECHARTS_BASE_THEME, type EChartsOption } from '@/ui/echarts-setup';
import { useEChartsBlock } from './use-echarts-block';
import type { ManagementReportGroupedBarBlock } from '@/types/management-report';

const props = defineProps<{
  block: ManagementReportGroupedBarBlock;
}>();

const chartRef = ref<HTMLElement | null>(null);

const option = computed<EChartsOption>(() => {
  const isHorizontal = props.block.direction === 'horizontal';
  const series = props.block.series.map((s) => ({
    name: s.name,
    type: 'bar' as const,
    data: s.values,
    barMaxWidth: 32,
    itemStyle: { borderRadius: isHorizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] },
  }));

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (val: any) => `${val} ${props.block.unitLabel ?? ''}`.trim(),
    },
    legend: {
      show: series.length > 1,
      top: 0,
      right: 0,
      textStyle: { fontSize: 12, color: '#425466' },
    },
    grid: { left: '3%', right: '4%', bottom: '3%', top: series.length > 1 ? '15%' : '8%', containLabel: true },
    xAxis: isHorizontal
      ? { type: 'value', axisLabel: { color: '#6B7C93', fontSize: 11 } }
      : { type: 'category', data: props.block.categories, axisLabel: { color: '#6B7C93', fontSize: 11 } },
    yAxis: isHorizontal
      ? { type: 'category', data: props.block.categories, axisLabel: { color: '#6B7C93', fontSize: 11 } }
      : { type: 'value', axisLabel: { color: '#6B7C93', fontSize: 11 } },
    series,
  } as EChartsOption;
});

const { instance } = useEChartsBlock(chartRef, option);
</script>

<template>
  <div class="grouped-bar-block">
    <div v-if="block.title" class="grouped-bar-block__title">
      <h3>{{ block.title }}</h3>
      <span v-if="block.unitLabel" class="grouped-bar-block__unit">单位：{{ block.unitLabel }}</span>
    </div>
    <div ref="chartRef" class="grouped-bar-block__chart" />
    <p v-if="block.description" class="grouped-bar-block__desc">{{ block.description }}</p>
  </div>
</template>

<style scoped>
.grouped-bar-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  min-height: 300px;
}

.grouped-bar-block__title {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.grouped-bar-block__title h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  color: #0A2540;
}

.grouped-bar-block__unit {
  font-size: 12px;
  color: #6B7C93;
}

.grouped-bar-block__chart {
  flex: 1;
  min-height: 260px;
  width: 100%;
}

.grouped-bar-block__desc {
  margin: 0;
  font-size: 12px;
  color: #6B7C93;
  line-height: 1.5;
}
</style>

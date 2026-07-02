<script setup lang="ts">
/**
 * 堆叠柱状图 Block
 *
 * 用于多层叠加对比，如各区域按合作级别的堆叠对比。
 */

import { ref, computed } from 'vue';
import { ECHARTS_BASE_THEME, type EChartsOption } from '@/ui/echarts-setup';
import { useEChartsBlock } from './use-echarts-block';
import type { ManagementReportStackedBarBlock } from '@/types/management-report';

const props = defineProps<{
  block: ManagementReportStackedBarBlock;
}>();

const chartRef = ref<HTMLElement | null>(null);

const option = computed<EChartsOption>(() => {
  const isHorizontal = props.block.direction === 'horizontal';
  const series = props.block.series.map((s) => ({
    name: s.name,
    type: 'bar' as const,
    stack: 'total',
    data: s.values,
    barMaxWidth: 36,
    itemStyle: { borderRadius: isHorizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] },
    emphasis: { focus: 'series' as const },
  }));

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (val: any) => `${val} ${props.block.unitLabel ?? ''}`.trim(),
    },
    legend: {
      top: 0,
      right: 0,
      textStyle: { fontSize: 12, color: '#425466' },
    },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
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
  <div class="stacked-bar-block">
    <div v-if="block.title" class="stacked-bar-block__title">
      <h3>{{ block.title }}</h3>
      <span v-if="block.unitLabel" class="stacked-bar-block__unit">单位：{{ block.unitLabel }}</span>
    </div>
    <div ref="chartRef" class="stacked-bar-block__chart" />
    <p v-if="block.description" class="stacked-bar-block__desc">{{ block.description }}</p>
  </div>
</template>

<style scoped>
.stacked-bar-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  min-height: 300px;
}

.stacked-bar-block__title {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.stacked-bar-block__title h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  color: #0A2540;
}

.stacked-bar-block__unit {
  font-size: 12px;
  color: #6B7C93;
}

.stacked-bar-block__chart {
  flex: 1;
  min-height: 260px;
  width: 100%;
}

.stacked-bar-block__desc {
  margin: 0;
  font-size: 12px;
  color: #6B7C93;
  line-height: 1.5;
}
</style>

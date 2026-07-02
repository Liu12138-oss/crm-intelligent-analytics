<script setup lang="ts">
/**
 * 复合趋势图 Block
 *
 * 柱+线双轴复合图，对标案例一年度趋势（金额柱+数量线）、案例二近3年签约&商机趋势。
 * 支持多柱系列 + 多线系列，双 Y 轴。
 */

import { ref, computed } from 'vue';
import { ECHARTS_COLOR_PALETTE, type EChartsOption } from '@/ui/echarts-setup';
import { useEChartsBlock } from './use-echarts-block';
import type { ManagementReportCompositeTrendBlock } from '@/types/management-report';

const props = defineProps<{
  block: ManagementReportCompositeTrendBlock;
}>();

const chartRef = ref<HTMLElement | null>(null);

const option = computed<EChartsOption>(() => {
  const barSeries = props.block.barSeries.map((s, idx) => ({
    name: s.name,
    type: 'bar' as const,
    data: s.values,
    barMaxWidth: 36,
    yAxisIndex: 0,
    itemStyle: {
      color: ECHARTS_COLOR_PALETTE[idx % ECHARTS_COLOR_PALETTE.length],
      borderRadius: [4, 4, 0, 0],
    },
  }));

  const lineSeries = (props.block.lineSeries ?? []).map((s, idx) => ({
    name: s.name,
    type: 'line' as const,
    data: s.values,
    yAxisIndex: 1,
    smooth: true,
    symbol: 'circle',
    symbolSize: 6,
    lineStyle: {
      width: 2,
      color: ECHARTS_COLOR_PALETTE[(idx + props.block.barSeries.length) % ECHARTS_COLOR_PALETTE.length],
    },
    itemStyle: {
      color: ECHARTS_COLOR_PALETTE[(idx + props.block.barSeries.length) % ECHARTS_COLOR_PALETTE.length],
    },
  }));

  const allSeries = [...barSeries, ...lineSeries];

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
    },
    legend: {
      top: 0,
      right: 0,
      textStyle: { fontSize: 12, color: '#425466' },
    },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      data: props.block.categories,
      axisLabel: { color: '#6B7C93', fontSize: 11 },
    },
    yAxis: [
      {
        type: 'value',
        name: props.block.barUnitLabel ?? '',
        position: 'left',
        axisLabel: { color: '#6B7C93', fontSize: 11 },
        nameTextStyle: { color: '#6B7C93', fontSize: 11 },
      },
      {
        type: 'value',
        name: props.block.lineUnitLabel ?? '',
        position: 'right',
        axisLabel: { color: '#6B7C93', fontSize: 11 },
        nameTextStyle: { color: '#6B7C93', fontSize: 11 },
        splitLine: { show: false },
      },
    ],
    series: allSeries,
  } as EChartsOption;
});

const { instance } = useEChartsBlock(chartRef, option);
</script>

<template>
  <div class="composite-trend-block">
    <div v-if="block.title" class="composite-trend-block__title">
      <h3>{{ block.title }}</h3>
    </div>
    <div ref="chartRef" class="composite-trend-block__chart" />
    <p v-if="block.description" class="composite-trend-block__desc">{{ block.description }}</p>
  </div>
</template>

<style scoped>
.composite-trend-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  min-height: 300px;
}

.composite-trend-block__title h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  color: #0A2540;
}

.composite-trend-block__chart {
  flex: 1;
  min-height: 260px;
  width: 100%;
}

.composite-trend-block__desc {
  margin: 0;
  font-size: 12px;
  color: #6B7C93;
  line-height: 1.5;
}
</style>

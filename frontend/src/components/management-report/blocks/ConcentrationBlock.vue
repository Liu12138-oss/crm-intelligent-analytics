<script setup lang="ts">
/**
 * 集中度分析 Block
 *
 * 用于 TOP5/10/20 占比分析 + 自动洞察文案，对标案例一集中度分析卡片。
 * 含集中度柱状图 + 一次性合作统计 + 文本洞察框。
 */

import { ref, computed } from 'vue';
import { ECHARTS_COLOR_PALETTE, type EChartsOption } from '@/ui/echarts-setup';
import { useEChartsBlock } from './use-echarts-block';
import type { ManagementReportConcentrationBlock } from '@/types/management-report';

const props = defineProps<{
  block: ManagementReportConcentrationBlock;
}>();

const chartRef = ref<HTMLElement | null>(null);

// 构建集中度柱状图 option
const option = computed<EChartsOption>(() => {
  const categories = props.block.tiers.map((t) => t.label);
  const values = props.block.tiers.map((t) => t.percentage);
  const counts = props.block.tiers.map((t) => t.count);

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const idx = params[0]?.dataIndex ?? 0;
        const tier = props.block.tiers[idx];
        if (!tier) return '';
        return `${tier.label}<br/>金额：${tier.value} ${props.block.unitLabel ?? '万'}<br/>渠道数：${tier.count} 家<br/>占比：${tier.percentage}%`;
      },
    },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '8%', containLabel: true },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: { color: '#6B7C93', fontSize: 12 },
    },
    yAxis: {
      type: 'value',
      max: 100,
      axisLabel: { color: '#6B7C93', fontSize: 11, formatter: '{value}%' },
    },
    series: [
      {
        type: 'bar',
        data: values.map((v, i) => ({
          value: v,
          itemStyle: { color: ECHARTS_COLOR_PALETTE[i % ECHARTS_COLOR_PALETTE.length] },
        })),
        barMaxWidth: 48,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        label: {
          show: true,
          position: 'top',
          formatter: '{c}%',
          fontSize: 12,
          color: '#0A2540',
          fontWeight: 500,
        },
      },
    ],
  } as EChartsOption;
});

const { instance } = useEChartsBlock(chartRef, option);

// 一次性合作统计
const oneTimeSummary = computed(() => {
  if (props.block.oneTimeCount !== undefined && props.block.oneTimePercentage !== undefined) {
    return `一次性合作渠道 ${props.block.oneTimeCount} 家（${props.block.oneTimePercentage}%）`;
  }
  return '';
});
</script>

<template>
  <div class="concentration-block">
    <div v-if="block.title" class="concentration-block__title">
      <h3>{{ block.title }}</h3>
      <span v-if="oneTimeSummary" class="concentration-block__onetimer">{{ oneTimeSummary }}</span>
    </div>
    <div class="concentration-block__chart-wrap">
      <div ref="chartRef" class="concentration-block__chart" />
    </div>
    <div v-if="block.insights.length > 0" class="concentration-block__insights">
      <div class="concentration-block__insights-title">核心发现</div>
      <ul class="concentration-block__insight-list">
        <li v-for="(insight, idx) in block.insights" :key="idx">{{ insight }}</li>
      </ul>
    </div>
    <p v-if="block.description" class="concentration-block__desc">{{ block.description }}</p>
  </div>
</template>

<style scoped>
.concentration-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}

.concentration-block__title {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}

.concentration-block__title h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  color: #0A2540;
}

.concentration-block__onetimer {
  font-size: 12px;
  color: #B76E00;
  background: #FFF6E7;
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
}

.concentration-block__chart-wrap {
  min-height: 200px;
}

.concentration-block__chart {
  height: 200px;
  width: 100%;
}

.concentration-block__insights {
  padding: 12px 14px;
  border-radius: 12px;
  background: #EEF4FF;
  border: 0.5px solid rgba(99, 91, 255, 0.12);
}

.concentration-block__insights-title {
  font-size: 13px;
  font-weight: 500;
  color: #635BFF;
  margin-bottom: 8px;
}

.concentration-block__insight-list {
  margin: 0;
  padding-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.concentration-block__insight-list li {
  font-size: 13px;
  color: #425466;
  line-height: 1.6;
}

.concentration-block__desc {
  margin: 0;
  font-size: 12px;
  color: #6B7C93;
  line-height: 1.5;
}
</style>

<script setup lang="ts">
/**
 * 饼图分布 Block 组件
 *
 * 用于渲染合作级别分布、技术服务商分布、状态分布等饼图。
 * 使用 ECharts 饼图，支持 legend、tooltip 和 insight 洞察文案。
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import * as echarts from 'echarts/core';
import { PieChart } from 'echarts/charts';
import { TitleComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([TitleComponent, TooltipComponent, LegendComponent, PieChart, CanvasRenderer]);

const props = defineProps<{
  block: {
    blockId: string;
    blockType: string;
    title: string;
    segments: Array<{ name: string; value: number; color?: string }>;
    totalValue?: number;
    unitLabel?: string;
    insights?: string[];
  };
}>();

const chartRef = ref<HTMLDivElement>();
let chartInstance: echarts.ECharts | null = null;

// 预设色板，避免使用过饱和渐变
const defaultColors = ['#4472C4', '#70AD47', '#FFC000', '#ED7D31', '#5B9BD5', '#2f7f78', '#8E63CE', '#A9D18E'];

const chartOption = computed(() => {
  const segments = props.block.segments;
  const data = segments.map((seg, idx) => ({
    name: seg.name,
    value: seg.value,
    itemStyle: seg.color ? { color: seg.color } : { color: defaultColors[idx % defaultColors.length] },
  }));

  return {
    tooltip: {
      trigger: 'item',
      formatter: (params: { name: string; value: number; percent: number }) => {
        const unit = props.block.unitLabel ?? '';
        return `${params.name}: ${params.value}${unit} (${params.percent}%)`;
      },
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      textStyle: { fontSize: 12, color: '#425466' },
    },
    series: [
      {
        name: props.block.title,
        type: 'pie',
        radius: ['38%', '68%'],
        center: ['38%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 4,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: true,
          formatter: '{b}\n{c}',
          fontSize: 12,
          color: '#425466',
        },
        emphasis: {
          label: { show: true, fontSize: 14, fontWeight: 'bold' },
        },
        data,
      },
    ],
  };
});

function renderChart() {
  if (!chartRef.value) return;
  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value);
  }
  chartInstance.setOption(chartOption.value);
}

onMounted(() => {
  renderChart();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  chartInstance?.dispose();
  chartInstance = null;
});

function handleResize() {
  chartInstance?.resize();
}

watch(() => props.block, renderChart, { deep: true });
</script>

<template>
  <div class="pie-distribution-block">
    <div ref="chartRef" class="pie-distribution-block__chart" />
    <div v-if="block.insights && block.insights.length > 0" class="pie-distribution-block__insights">
      <p v-for="(insight, idx) in block.insights" :key="idx" class="pie-distribution-block__insight">
        {{ insight }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.pie-distribution-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pie-distribution-block__chart {
  width: 100%;
  height: 280px;
}

.pie-distribution-block__insights {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pie-distribution-block__insight {
  font-size: 12px;
  color: #6B7C93;
  line-height: 1.6;
  margin: 0;
  padding-left: 12px;
  border-left: 3px solid #4472C4;
}
</style>

<script setup lang="ts">
import { computed } from 'vue';
import NumberToneText from '@/components/analysis/NumberToneText.vue';
import ChartLegendHeader from '@/components/shared/ChartLegendHeader.vue';
import { resolveChartColor } from '@/ui/visual-language';
import type { ManagementReportTrendBlock } from '@/types/management-report';

const props = defineProps<{
  block: ManagementReportTrendBlock;
}>();

const maxValue = computed(() =>
  Math.max(...props.block.points.map((item) => item.value), 1),
);

function resolvePointStyle(index: number): Record<string, string> {
  return {
    '--chart-color': resolveChartColor(index),
  };
}
</script>

<template>
  <section class="trend-block">
    <ChartLegendHeader
      :title="block.title"
      summary="趋势柱使用统一色板，辅助识别阶段变化和异常波动。"
      :max-items="3"
    />
    <div class="trend-block__chart">
      <div
        v-for="(point, index) in block.points"
        :key="`${block.blockId}-${point.label}`"
        class="trend-block__column"
        :style="resolvePointStyle(index)"
      >
        <div class="trend-block__bar-shell">
          <div
            class="trend-block__bar"
            :style="{ height: `${Math.max((point.value / maxValue) * 100, 8)}%` }"
          />
        </div>
        <strong>
          <NumberToneText
            :text="`${point.value.toLocaleString('zh-CN')}${block.unitLabel ? ` ${block.unitLabel}` : ''}`"
            :tone-hint="block.title"
          />
        </strong>
        <span>
          <NumberToneText :text="point.label" />
        </span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.trend-block {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 10px;
  height: 100%;
  min-height: 0;
}

.trend-block__header h3 {
  margin: 0;
  font-size: 15px;
  color: #0f172a;
}

.trend-block__chart {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));
  gap: 10px;
  align-items: end;
  height: 100%;
  min-height: 0;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 4px;
  scrollbar-gutter: stable both-edges;
}

.trend-block__column {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto auto;
  gap: 6px;
  justify-items: center;
  min-width: 72px;
}

.trend-block__bar-shell {
  width: 100%;
  height: 100%;
  min-height: 120px;
  display: flex;
  align-items: flex-end;
  padding: 6px;
  border-radius: 14px;
  background: linear-gradient(180deg, #f8fbff, #eef6ff);
}

.trend-block__bar {
  width: 100%;
  border-radius: 10px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--chart-color) 70%, #ffffff), var(--chart-color));
}

.trend-block__column strong {
  font-size: 12px;
  color: #0f172a;
}

.trend-block__column span {
  font-size: 11px;
  color: #64748b;
}
</style>

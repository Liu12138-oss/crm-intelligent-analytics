<script setup lang="ts">
import { computed } from 'vue';
import NumberToneText from '@/components/analysis/NumberToneText.vue';
import ChartLegendHeader from '@/components/shared/ChartLegendHeader.vue';
import { resolveChartColor } from '@/ui/visual-language';
import type { ManagementReportBarRankingBlock } from '@/types/management-report';

const props = defineProps<{
  block: ManagementReportBarRankingBlock;
}>();

const maxValue = computed(() =>
  Math.max(...props.block.rows.map((item) => item.value), 1),
);

function resolveRowStyle(index: number): Record<string, string> {
  return {
    '--chart-color': resolveChartColor(index),
  };
}
</script>

<template>
  <section class="bar-ranking-block">
    <ChartLegendHeader
      :title="block.title"
      summary="排名条使用统一图表色板，便于比较客户、团队或部门差异。"
      :max-items="3"
    />
    <div class="bar-ranking-block__rows">
      <div
        v-for="(row, index) in block.rows"
        :key="`${block.blockId}-${row.label}`"
        class="bar-ranking-block__row"
        :style="resolveRowStyle(index)"
      >
        <span class="bar-ranking-block__label">
          <NumberToneText :text="row.label" />
        </span>
        <div class="bar-ranking-block__track">
          <div
            class="bar-ranking-block__fill"
            :style="{ width: `${Math.max((row.value / maxValue) * 100, 6)}%` }"
          />
        </div>
        <div class="bar-ranking-block__values">
          <strong>
            <NumberToneText
              :text="`${row.value.toLocaleString('zh-CN')}${block.unitLabel ? ` ${block.unitLabel}` : ''}`"
              :tone-hint="block.title"
            />
          </strong>
          <small v-if="row.secondaryValue">
            <NumberToneText
              :text="row.secondaryValue"
              :tone-hint="row.secondaryLabel ?? block.title"
            />
          </small>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.bar-ranking-block {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 10px;
  height: 100%;
  min-height: 0;
}

.bar-ranking-block__header h3 {
  margin: 0;
  font-size: 15px;
  color: #0f172a;
}

.bar-ranking-block__rows {
  display: grid;
  gap: 10px;
  min-height: 0;
  overflow: auto;
  align-content: start;
  padding-right: 4px;
  scrollbar-gutter: stable both-edges;
}

.bar-ranking-block__row {
  display: grid;
  grid-template-columns: 132px 1fr 96px;
  gap: 10px;
  align-items: center;
}

.bar-ranking-block__label {
  font-size: 12px;
  color: #334155;
}

.bar-ranking-block__track {
  height: 12px;
  border-radius: 999px;
  background: #e2e8f0;
  overflow: hidden;
}

.bar-ranking-block__fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--chart-color), color-mix(in srgb, var(--chart-color) 58%, #ffffff));
}

.bar-ranking-block__values {
  display: grid;
  justify-items: end;
}

.bar-ranking-block__values strong {
  font-size: 12px;
  color: #0f172a;
}

.bar-ranking-block__values small {
  color: #64748b;
}

@media (max-width: 640px) {
  .bar-ranking-block__row {
    grid-template-columns: 1fr;
  }
}
</style>

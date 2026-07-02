<script setup lang="ts">
import NumberToneText from '@/components/analysis/NumberToneText.vue';
import { resolveChartColor } from '@/ui/visual-language';
import type { ManagementReportMetricStripBlock } from '@/types/management-report';

defineProps<{
  block: ManagementReportMetricStripBlock;
}>();

function resolveItemStyle(index: number): Record<string, string> {
  return {
    '--metric-color': resolveChartColor(index),
  };
}
</script>

<template>
  <section class="metric-strip-block">
    <header class="metric-strip-block__header">
      <h3>
        <NumberToneText :text="block.title" />
      </h3>
    </header>
    <div class="metric-strip-block__row">
      <article
        v-for="(item, index) in block.items"
        :key="`${block.blockId}-${item.label}`"
        class="metric-strip-block__item"
        :data-tone="item.tone ?? 'neutral'"
        :style="resolveItemStyle(index)"
      >
        <span>
          <NumberToneText :text="item.label" />
        </span>
        <strong>
          <NumberToneText
            :text="item.value"
            :tone-hint="item.tone ?? item.label"
          />
        </strong>
      </article>
    </div>
  </section>
</template>

<style scoped>
.metric-strip-block {
  display: grid;
  grid-template-rows: auto auto;
  gap: 10px;
  height: auto;
}

.metric-strip-block__header h3 {
  margin: 0;
  font-size: 15px;
  color: #0f172a;
}

.metric-strip-block__row {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  overflow-y: hidden;
  align-items: flex-start;
  padding-bottom: 2px;
  scrollbar-gutter: stable both-edges;
}

.metric-strip-block__item {
  flex: 0 0 168px;
  display: grid;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--metric-color) 8%, #ffffff);
  border: 1px solid color-mix(in srgb, var(--metric-color) 20%, #dbeafe);
}

.metric-strip-block__item[data-tone='success'] {
  background: #ecfdf5;
  border-color: #bbf7d0;
}

.metric-strip-block__item[data-tone='warning'] {
  background: #fff7ed;
  border-color: #fed7aa;
}

.metric-strip-block__item[data-tone='danger'] {
  background: #fff1f2;
  border-color: #fecdd3;
}

.metric-strip-block__item[data-tone='primary'] {
  background: #eef6ff;
  border-color: #bfdbfe;
}

.metric-strip-block__item span {
  font-size: 12px;
  color: #64748b;
  white-space: nowrap;
}

.metric-strip-block__item strong {
  font-size: 22px;
  color: #0f172a;
  white-space: nowrap;
}
</style>

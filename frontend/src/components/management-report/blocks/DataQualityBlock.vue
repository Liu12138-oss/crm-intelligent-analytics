<script setup lang="ts">
import NumberToneText from '@/components/analysis/NumberToneText.vue';
import type { ManagementReportDataQualityBlock } from '@/types/management-report';

defineProps<{
  block: ManagementReportDataQualityBlock;
}>();
</script>

<template>
  <section class="data-quality-block">
    <header class="data-quality-block__header">
      <h3>
        <NumberToneText :text="block.title" />
      </h3>
    </header>
    <div class="data-quality-block__rows">
      <article
        v-for="row in block.rows"
        :key="`${block.blockId}-${row.tableName}-${row.fieldName}`"
        class="data-quality-block__row"
      >
        <div class="data-quality-block__meta">
          <strong>
            <NumberToneText :text="`${row.tableName} / ${row.fieldName}`" />
          </strong>
          <span>
            <NumberToneText
              :text="row.completeness"
              tone-hint="完整率"
            />
          </span>
        </div>
        <div class="data-quality-block__bar">
          <div
            class="data-quality-block__fill"
            :style="{ width: row.completeness }"
          />
        </div>
        <div class="data-quality-block__stats">
          <span>
            有值
            <NumberToneText
              :text="row.filledCount"
              tone-hint="有值"
            />
          </span>
          <span>
            缺失
            <NumberToneText
              :text="row.missingCount"
              tone-hint="缺失"
            />
          </span>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.data-quality-block {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 10px;
  height: 100%;
  min-height: 0;
}

.data-quality-block__header h3 {
  margin: 0;
  font-size: 15px;
  color: #0f172a;
}

.data-quality-block__rows {
  display: grid;
  gap: 10px;
  min-height: 0;
  overflow: auto;
  align-content: start;
  padding-right: 4px;
  scrollbar-gutter: stable both-edges;
}

.data-quality-block__row {
  display: grid;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 14px;
  background: #f8fafc;
}

.data-quality-block__meta,
.data-quality-block__stats {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.data-quality-block__meta strong,
.data-quality-block__stats span {
  font-size: 12px;
  color: #0f172a;
}

.data-quality-block__meta span {
  font-size: 12px;
  color: #2563eb;
}

.data-quality-block__bar {
  height: 8px;
  border-radius: 999px;
  background: #dbeafe;
  overflow: hidden;
}

.data-quality-block__fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #86efac, #38bdf8);
}
</style>

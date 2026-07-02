<script setup lang="ts">
import NumberToneText from '@/components/analysis/NumberToneText.vue';
import type { ManagementReportInsightTableBlock } from '@/types/management-report';

defineProps<{
  block: ManagementReportInsightTableBlock;
}>();
</script>

<template>
  <section class="compact-insight-block">
    <header class="compact-insight-block__header">
      <h3>
        <NumberToneText :text="block.title" />
      </h3>
    </header>
    <dl class="compact-insight-block__list">
      <div
        v-for="row in block.rows"
        :key="`${block.blockId}-${row.label}`"
        class="compact-insight-block__row"
      >
        <dt>
          <NumberToneText :text="row.label" />
        </dt>
        <dd>
          <NumberToneText
            :text="row.value"
            :tone-hint="`${block.title} ${row.label}`"
          />
        </dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.compact-insight-block {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 10px;
  height: 100%;
  min-height: 0;
}

.compact-insight-block__header h3 {
  margin: 0;
  font-size: 15px;
  color: #0f172a;
}

.compact-insight-block__list {
  display: grid;
  gap: 8px;
  margin: 0;
  min-height: 0;
  overflow: auto;
  align-content: start;
  padding-right: 4px;
  scrollbar-gutter: stable both-edges;
}

.compact-insight-block__row {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 14px;
  background: #f8fafc;
}

.compact-insight-block__row dt {
  font-size: 12px;
  color: #64748b;
}

.compact-insight-block__row dd {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: #0f172a;
}
</style>

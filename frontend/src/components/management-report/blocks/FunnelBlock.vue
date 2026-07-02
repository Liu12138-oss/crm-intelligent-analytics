<script setup lang="ts">
import { computed } from 'vue';
import NumberToneText from '@/components/analysis/NumberToneText.vue';
import type { ManagementReportFunnelBlock } from '@/types/management-report';

const props = defineProps<{
  block: ManagementReportFunnelBlock;
}>();

const maxValue = computed(() =>
  Math.max(...props.block.stages.map((item) => item.value), 1),
);
</script>

<template>
  <section class="funnel-block">
    <header class="funnel-block__header">
      <h3>
        <NumberToneText :text="block.title" />
      </h3>
    </header>
    <div class="funnel-block__rows">
      <div
        v-for="stage in block.stages"
        :key="`${block.blockId}-${stage.label}`"
        class="funnel-block__row"
      >
        <div class="funnel-block__meta">
          <strong>
            <NumberToneText :text="stage.label" />
          </strong>
          <small v-if="stage.conversionLabel">
            <NumberToneText
              :text="stage.conversionLabel"
              :tone-hint="stage.label"
            />
          </small>
        </div>
        <div class="funnel-block__track">
          <div
            class="funnel-block__fill"
            :style="{ width: `${Math.max((stage.value / maxValue) * 100, 14)}%` }"
          >
            <span>
              <NumberToneText
                :text="stage.value.toLocaleString('zh-CN')"
                :tone-hint="stage.label"
              />
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.funnel-block {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 10px;
  height: 100%;
  min-height: 0;
}

.funnel-block__header h3 {
  margin: 0;
  font-size: 15px;
  color: #0f172a;
}

.funnel-block__rows {
  display: grid;
  gap: 12px;
  min-height: 0;
  overflow: auto;
  align-content: start;
  padding-right: 4px;
  scrollbar-gutter: stable both-edges;
}

.funnel-block__meta {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.funnel-block__meta strong {
  font-size: 13px;
  color: #0f172a;
}

.funnel-block__meta small {
  color: #64748b;
}

.funnel-block__track {
  height: 36px;
  border-radius: 14px;
  background: #f1f5f9;
  overflow: hidden;
}

.funnel-block__fill {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 12px;
  border-radius: inherit;
  background: linear-gradient(90deg, #93c5fd, #38bdf8);
}

.funnel-block__fill span {
  color: #083344;
  font-size: 12px;
  font-weight: 700;
}
</style>

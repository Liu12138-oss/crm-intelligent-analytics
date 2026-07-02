<script setup lang="ts">
import NumberToneText from '@/components/analysis/NumberToneText.vue';
import type { ManagementReportTabItem } from '@/types/management-report';

const props = defineProps<{
  sections: ManagementReportTabItem[];
  activeKey?: string;
}>();

const emit = defineEmits<{
  (event: 'select', sectionKey: string): void;
}>();
</script>

<template>
  <section class="management-report-tabs">
    <button
      v-for="item in props.sections"
      :key="item.sectionKey"
      type="button"
      class="management-report-tabs__item"
      :class="{
        'management-report-tabs__item--active': props.activeKey === item.sectionKey,
        'management-report-tabs__item--degraded': item.state === 'degraded',
      }"
      @click="emit('select', item.sectionKey)"
    >
      <span class="management-report-tabs__title">
        <NumberToneText :text="item.title" />
      </span>
    </button>
  </section>
</template>

<style scoped>
.management-report-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.management-report-tabs__item {
  flex: 0 0 auto;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 10px 14px;
  background: #ffffff;
  color: #334155;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.management-report-tabs__item--active {
  border-color: #7dd3fc;
  background: linear-gradient(135deg, #f0f9ff, #ecfeff);
  color: #0f172a;
}

.management-report-tabs__item--degraded {
  opacity: 0.78;
}

.management-report-tabs__title {
  font-size: 14px;
}
</style>

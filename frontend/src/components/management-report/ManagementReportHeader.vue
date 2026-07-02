<script setup lang="ts">
import { computed } from 'vue';
import NumberToneText from '@/components/analysis/NumberToneText.vue';
import type { ManagementReportSnapshot } from '@/types/management-report';

const props = defineProps<{
  meta?: ManagementReportSnapshot['meta'];
  exportAllowed: boolean;
  exportLoading: boolean;
}>();

const emit = defineEmits<{
  (event: 'export'): void;
}>();

function formatGeneratedAt(value?: string): string {
  if (!value) {
    return '--';
  }

  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  });
}

const rangeText = computed(() =>
  props.meta ? `${props.meta.startDate} 至 ${props.meta.endDate}` : '--',
);
</script>

<template>
  <section class="management-report-header">
    <div class="management-report-header__title-row">
      <div class="management-report-header__copy">
        <p class="management-report-header__eyebrow">
          经营驾驶舱
        </p>
        <h1 class="management-report-header__title">
          经营报表
        </h1>
        <p class="management-report-header__description">
          用紧凑报表视图查看核心指标、专题统计和经营风险。
        </p>
      </div>
      <button
        type="button"
        class="management-report-header__export"
        :disabled="!exportAllowed || exportLoading"
        @click="emit('export')"
      >
        {{ exportLoading ? '导出中...' : '导出报表' }}
      </button>
    </div>
    <div class="management-report-header__meta-row">
      <div class="management-report-header__meta-chip">
        <span>范围</span>
        <strong>
          <NumberToneText :text="props.meta?.departmentLabel ?? '--'" />
        </strong>
      </div>
      <div class="management-report-header__meta-chip">
        <span>时间</span>
        <strong>
          <NumberToneText :text="rangeText" />
        </strong>
      </div>
      <div class="management-report-header__meta-chip">
        <span>生成时间</span>
        <strong>
          <NumberToneText :text="formatGeneratedAt(props.meta?.generatedAt)" />
        </strong>
      </div>
    </div>
  </section>
</template>

<style scoped>
.management-report-header {
  display: grid;
  gap: 10px;
  padding: 16px 18px;
  border-radius: 20px;
  background:
    radial-gradient(circle at top left, rgba(125, 211, 252, 0.2), transparent 35%),
    linear-gradient(180deg, #ffffff, #f6fbff 65%, #f8fafc);
  border: 1px solid #e2e8f0;
  box-shadow: 0 12px 26px rgba(15, 23, 42, 0.05);
}

.management-report-header__title-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.management-report-header__eyebrow {
  margin: 0 0 4px;
  font-size: 11px;
  color: #0891b2;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.management-report-header__title {
  margin: 0;
  font-size: 26px;
  line-height: 1.1;
  color: #0f172a;
}

.management-report-header__description {
  margin: 4px 0 0;
  font-size: 12px;
  color: #64748b;
}

.management-report-header__export {
  flex: 0 0 auto;
  border: 1px solid #bae6fd;
  border-radius: 999px;
  padding: 9px 14px;
  background: linear-gradient(135deg, #e0f2fe, #f0fdf4);
  color: #0f172a;
  font-weight: 700;
  cursor: pointer;
}

.management-report-header__export:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.management-report-header__meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.management-report-header__meta-chip {
  min-width: 180px;
  padding: 8px 12px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.management-report-header__meta-chip span {
  display: block;
  margin-bottom: 2px;
  font-size: 11px;
  color: #64748b;
}

.management-report-header__meta-chip strong {
  font-size: 13px;
  color: #0f172a;
}

@media (max-width: 768px) {
  .management-report-header__title-row {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

<script setup lang="ts">
import { computed } from 'vue';
import NumberToneText from '@/components/analysis/NumberToneText.vue';
import DepartmentTreeSelect from '@/components/shared/DepartmentTreeSelect.vue';
import type {
  ManagementReportDepartmentNode,
  ManagementReportFilter,
  ManagementReportPresetKey,
  ManagementReportSnapshot,
} from '@/types/management-report';

const props = defineProps<{
  modelValue: ManagementReportFilter;
  departments: ManagementReportDepartmentNode[];
  presets: Array<{ key: ManagementReportPresetKey; label: string }>;
  loading: boolean;
  exportAllowed: boolean;
  exportLoading: boolean;
  meta?: ManagementReportSnapshot['meta'];
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: ManagementReportFilter): void;
  (event: 'apply'): void;
  (event: 'export'): void;
}>();

function updateField<K extends keyof ManagementReportFilter>(
  field: K,
  value: ManagementReportFilter[K],
): void {
  emit('update:modelValue', {
    ...props.modelValue,
    [field]: value,
  });
}

function updateDateRange(value: [Date, Date] | undefined): void {
  if (!value) {
    return;
  }

  emit('update:modelValue', {
    ...props.modelValue,
    presetKey: 'custom',
    startDate: value[0].toISOString().slice(0, 10),
    endDate: value[1].toISOString().slice(0, 10),
  });
}

function formatGeneratedAt(value?: string): string {
  if (!value) {
    return '--';
  }

  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  });
}

const compactMetaText = computed(() => {
  if (!props.meta) {
    return '当前范围、时间和生成时间会在快照生成后更新。';
  }

  return `${props.meta.departmentLabel} · ${props.meta.startDate} 至 ${props.meta.endDate} · 生成于 ${formatGeneratedAt(props.meta.generatedAt)}`;
});

</script>

<template>
  <section class="management-report-filters">
    <div class="management-report-filters__toolbar">
      <div class="management-report-filters__headline">
        <h1>经营报表</h1>
        <p>
          <NumberToneText :text="compactMetaText" />
        </p>
      </div>
      <div class="management-report-filters__actions">
        <button
          type="button"
          class="management-report-filters__action management-report-filters__action--export"
          :disabled="!props.exportAllowed || props.exportLoading"
          @click="emit('export')"
        >
          {{ props.exportLoading ? '导出中...' : '导出报表' }}
        </button>
      </div>
    </div>

    <form
      class="management-report-filters__controls"
      @submit.prevent="emit('apply')"
    >
      <div class="management-report-filters__field">
        <span class="management-report-filters__label">部门范围</span>
        <DepartmentTreeSelect
          :model-value="props.modelValue.departmentId"
          :departments="props.departments"
          :disabled="props.loading"
          placeholder="请选择部门范围"
          @update:model-value="updateField('departmentId', String($event ?? ''))"
        />
      </div>
      <div class="management-report-filters__field">
        <span class="management-report-filters__label">时间快捷项</span>
        <el-select
          :model-value="props.modelValue.presetKey"
          :disabled="props.loading"
          @update:model-value="updateField('presetKey', $event as ManagementReportPresetKey)"
        >
          <el-option
            v-for="item in props.presets"
            :key="item.key"
            :label="item.label"
            :value="item.key"
          />
        </el-select>
      </div>
      <div class="management-report-filters__field management-report-filters__field--range">
        <span class="management-report-filters__label">起止日期</span>
        <el-date-picker
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          :disabled="props.loading"
          :model-value="[
            new Date(`${props.modelValue.startDate}T00:00:00.000Z`),
            new Date(`${props.modelValue.endDate}T00:00:00.000Z`),
          ]"
          @update:model-value="updateDateRange($event as [Date, Date] | undefined)"
        />
      </div>
      <button
        type="submit"
        class="management-report-filters__action management-report-filters__action--refresh management-report-filters__query"
        :disabled="props.loading"
      >
        {{ props.loading ? '查询中...' : '查询' }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.management-report-filters {
  display: grid;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 18px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.04);
}

.management-report-filters__toolbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.management-report-filters__headline h1 {
  margin: 0;
  font-size: 24px;
  line-height: 1.1;
  color: #0f172a;
}

.management-report-filters__headline p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #64748b;
}

.management-report-filters__actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.management-report-filters__action {
  height: 38px;
  min-width: 96px;
  border-radius: 12px;
  padding: 0 14px;
  font-weight: 700;
  cursor: pointer;
}

.management-report-filters__action--refresh {
  border: 1px solid #bfdbfe;
  background: linear-gradient(135deg, #e0f2fe, #f0f9ff);
  color: #0f172a;
}

.management-report-filters__action--export {
  border: 1px solid #c7f9cc;
  background: linear-gradient(135deg, #ecfdf5, #f0fdf4);
  color: #166534;
}

.management-report-filters__action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.management-report-filters__controls {
  display: grid;
  grid-template-columns: 1.3fr 0.9fr 1.3fr auto;
  gap: 12px;
  align-items: end;
}

.management-report-filters__field {
  display: grid;
  gap: 6px;
}

.management-report-filters__field :deep(.el-select),
.management-report-filters__field :deep(.el-date-editor),
.management-report-filters__field :deep(.el-tree-select) {
  width: 100%;
}

.management-report-filters__label {
  font-size: 12px;
  color: #475569;
  font-weight: 600;
}

.management-report-filters__query {
  min-width: 88px;
}

@media (max-width: 1200px) {
  .management-report-filters__toolbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .management-report-filters__controls {
    grid-template-columns: 1fr;
  }
}
</style>

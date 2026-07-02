<script setup lang="ts">
import NumberToneText from '@/components/analysis/NumberToneText.vue';
import type { ManagementMetricDefinition } from '@/types/management-report';

defineProps<{
  sourceNotes?: ManagementMetricDefinition[];
  footnotes?: string[];
}>();
</script>

<template>
  <el-popover
    placement="bottom-end"
    width="420"
    trigger="click"
  >
    <template #reference>
      <button
        type="button"
        class="section-source-popover__button"
      >
        查看口径
      </button>
    </template>
    <div class="section-source-popover__panel">
      <div
        v-if="sourceNotes?.length"
        class="section-source-popover__group"
      >
        <strong>指标来源说明</strong>
        <ul>
          <li
            v-for="item in sourceNotes"
            :key="item.key"
          >
            <NumberToneText :text="`${item.label}：${item.description}`" />
          </li>
        </ul>
      </div>
      <div
        v-if="footnotes?.length"
        class="section-source-popover__group"
      >
        <strong>补充备注</strong>
        <ul>
          <li
            v-for="item in footnotes"
            :key="item"
          >
            <NumberToneText :text="item" />
          </li>
        </ul>
      </div>
    </div>
  </el-popover>
</template>

<style scoped>
.section-source-popover__button {
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  padding: 6px 10px;
  background: #ffffff;
  color: #475569;
  font-size: 12px;
  cursor: pointer;
}

.section-source-popover__panel {
  display: grid;
  gap: 12px;
}

.section-source-popover__group strong {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: #0f172a;
}

.section-source-popover__group ul {
  margin: 0;
  padding-left: 18px;
  color: #475569;
  font-size: 12px;
  line-height: 1.6;
}
</style>

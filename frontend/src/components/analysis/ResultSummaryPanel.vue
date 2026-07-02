<script setup lang="ts">
import { computed } from 'vue';
import { ElAlert, ElIcon, ElTag } from 'element-plus';
import NumberToneText from '@/components/analysis/NumberToneText.vue';
import { UiIcons } from '@/ui/icons';
import { toStatusToneClass } from '@/ui/status-presentation';

const props = defineProps<{
  title?: string;
  summary?: string;
  scopeSummary?: string;
  explanation?: string;
  dataFreshnessAt?: string;
}>();

const freshnessToneClass = computed(() =>
  toStatusToneClass(props.dataFreshnessAt ? 'info' : 'neutral'),
);
</script>

<template>
  <section class="panel">
    <div class="panel__header">
      <div>
        <h2 class="summary-panel__title">
          <NumberToneText :text="title ?? '等待分析结果'" />
        </h2>
        <p class="summary-panel__copy">
          <NumberToneText :text="summary ?? '提交问题后，系统会在这里返回业务摘要。'" />
        </p>
      </div>
      <el-tag
        :class="['badge', freshnessToneClass]"
        type="info"
        round
      >
        <el-icon>
          <component :is="UiIcons.refresh" />
        </el-icon>
        <NumberToneText :text="dataFreshnessAt ? `数据更新：${dataFreshnessAt.slice(0, 16).replace('T', ' ')}` : '等待数据'" />
      </el-tag>
    </div>
    <div class="panel__body panel__body--stack">
      <el-alert
        class="summary-panel__scope"
        type="info"
        :closable="false"
        show-icon
      >
        <strong>权限与范围：</strong>
        <NumberToneText :text="scopeSummary ?? '尚未返回权限范围摘要。'" />
      </el-alert>
      <el-alert
        v-if="explanation"
        class="summary-panel__explanation"
        type="success"
        :closable="false"
        show-icon
      >
        <NumberToneText :text="explanation" />
      </el-alert>
    </div>
  </section>
</template>

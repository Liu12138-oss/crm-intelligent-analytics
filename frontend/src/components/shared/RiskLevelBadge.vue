<script setup lang="ts">
import { computed } from 'vue';
import { ElIcon, ElTag } from 'element-plus';
import { resolveRiskLevelIcon, resolveRiskLevelTone, toStatusToneClass } from '@/ui/status-presentation';

const props = withDefaults(
  defineProps<{
    level?: string;
    veto?: boolean;
  }>(),
  {
    level: 'LOW',
    veto: false,
  },
);

const displayTone = computed(() => (props.veto ? 'blocked' : resolveRiskLevelTone(props.level)));
const displayIcon = computed(() => resolveRiskLevelIcon(props.veto ? 'CRITICAL' : props.level));
const displayLabel = computed(() => {
  if (props.veto) {
    return '一票否决';
  }

  switch (String(props.level ?? '').trim().toUpperCase()) {
    case 'CRITICAL':
      return '严重风险';
    case 'HIGH':
      return '高风险';
    case 'MEDIUM':
      return '中风险';
    case 'LOW':
      return '低风险';
    default:
      return '未分级';
  }
});
</script>

<template>
  <el-tag
    :class="['badge', 'risk-level-badge', toStatusToneClass(displayTone)]"
    round
  >
    <el-icon>
      <component :is="displayIcon" />
    </el-icon>
    {{ displayLabel }}
  </el-tag>
</template>

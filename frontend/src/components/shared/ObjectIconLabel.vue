<script setup lang="ts">
import { computed } from 'vue';
import { ElIcon } from 'element-plus';
import { UiIconGroups, type UiIconComponent } from '@/ui/icons';

type ObjectIconType =
  | 'customer'
  | 'owner'
  | 'contract'
  | 'template'
  | 'policy'
  | 'connection'
  | 'auditEvent'
  | 'dataTable'
  | 'chart'
  | 'wecom'
  | 'report'
  | 'profile';

const props = withDefaults(
  defineProps<{
    type: ObjectIconType;
    label: string | number;
    description?: string;
    tone?: string;
  }>(),
  {
    description: '',
    tone: 'neutral',
  },
);

const icon = computed<UiIconComponent>(() => UiIconGroups.object[props.type]);
</script>

<template>
  <span
    class="object-icon-label"
    :class="`object-icon-label--${tone}`"
  >
    <span class="object-icon-label__icon">
      <el-icon>
        <component :is="icon" />
      </el-icon>
    </span>
    <span class="object-icon-label__copy">
      <strong>{{ label }}</strong>
      <small v-if="description">{{ description }}</small>
    </span>
  </span>
</template>

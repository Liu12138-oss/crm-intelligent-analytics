<script setup lang="ts">
import { computed } from 'vue';
import { ElButton, ElIcon } from 'element-plus';
import type { BusinessModuleKey } from '@/ui/visual-language';
import { resolveBusinessModuleVisual } from '@/ui/visual-language';

const props = withDefaults(
  defineProps<{
    module: BusinessModuleKey;
    title: string;
    description: string;
    actionText?: string;
  }>(),
  {
    actionText: '',
  },
);

const emit = defineEmits<{
  action: [];
}>();

const visual = computed(() => resolveBusinessModuleVisual(props.module));
</script>

<template>
  <div
    class="business-empty-state"
    :class="`business-empty-state--${visual.tone}`"
  >
    <div class="business-empty-state__mark">
      <el-icon>
        <component :is="visual.icon" />
      </el-icon>
    </div>
    <div class="business-empty-state__copy">
      <strong>{{ title }}</strong>
      <p>{{ description }}</p>
    </div>
    <el-button
      v-if="actionText"
      class="button-secondary business-empty-state__action"
      @click="emit('action')"
    >
      {{ actionText }}
    </el-button>
  </div>
</template>

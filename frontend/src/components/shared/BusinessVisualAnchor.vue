<script setup lang="ts">
import { computed } from 'vue';
import { ElIcon } from 'element-plus';
import type { BusinessModuleKey } from '@/ui/visual-language';
import { resolveBusinessModuleVisual } from '@/ui/visual-language';

const props = withDefaults(
  defineProps<{
    module: BusinessModuleKey;
    title?: string;
    summary?: string;
    compact?: boolean;
  }>(),
  {
    title: '',
    summary: '',
    compact: false,
  },
);

const visual = computed(() => resolveBusinessModuleVisual(props.module));
const displayTitle = computed(() => props.title || visual.value.label);
const displaySummary = computed(() => props.summary || visual.value.summary);
</script>

<template>
  <div
    class="business-visual-anchor"
    :class="[
      `business-visual-anchor--${visual.tone}`,
      { 'business-visual-anchor--compact': compact },
    ]"
  >
    <span class="business-visual-anchor__icon">
      <el-icon>
        <component :is="visual.icon" />
      </el-icon>
    </span>
    <div class="business-visual-anchor__copy">
      <component
        :is="compact ? 'h2' : 'h1'"
        class="business-visual-anchor__title"
      >
        {{ displayTitle }}
      </component>
      <small>{{ displaySummary }}</small>
    </div>
  </div>
</template>

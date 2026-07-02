<script setup lang="ts">
import { computed } from 'vue';
import { ElIcon } from 'element-plus';
import { UiIcons } from '@/ui/icons';
import { chartColorTokens } from '@/ui/visual-language';

const props = withDefaults(
  defineProps<{
    title: string;
    summary?: string;
    maxItems?: number;
  }>(),
  {
    summary: '',
    maxItems: 4,
  },
);

const legendItems = computed(() => chartColorTokens.slice(0, props.maxItems));
</script>

<template>
  <header class="chart-legend-header">
    <div class="chart-legend-header__copy">
      <span class="chart-legend-header__icon">
        <el-icon>
          <component :is="UiIcons.chart" />
        </el-icon>
      </span>
      <span>
        <h3>{{ title }}</h3>
        <small v-if="summary">{{ summary }}</small>
      </span>
    </div>
    <div
      class="chart-legend-header__legend"
      aria-label="图表色板说明"
    >
      <span
        v-for="item in legendItems"
        :key="item.key"
        class="chart-legend-header__legend-item"
        :style="{ '--legend-color': item.color }"
      >
        {{ item.label }}
      </span>
    </div>
  </header>
</template>

<script setup lang="ts">
/**
 * KPI 矩阵 Block
 *
 * 用于多指标卡片矩阵，对标案例一 4 张 KPI 卡片 + 案例二 6 张 KPI 卡片。
 * 支持趋势标识（同比/环比）、语义色调和自适应列数。
 */

import { computed } from 'vue';
import type { ManagementReportKpiMatrixBlock } from '@/types/management-report';

const props = defineProps<{
  block: ManagementReportKpiMatrixBlock;
}>();

// 矩阵列数，默认 4
const columns = computed(() => props.block.columns ?? 4);

// 色调映射
const toneColorMap: Record<string, string> = {
  primary: '#635BFF',
  success: '#0A7F5A',
  warning: '#B76E00',
  danger: '#C23D4B',
  neutral: '#425466',
};

// 趋势图标
const trendIcon: Record<string, string> = {
  up: '↑',
  down: '↓',
  flat: '→',
};

const trendColor: Record<string, string> = {
  up: '#0A7F5A',
  down: '#C23D4B',
  flat: '#6B7C93',
};
</script>

<template>
  <div class="kpi-matrix-block">
    <div v-if="block.title" class="kpi-matrix-block__title">
      <h3>{{ block.title }}</h3>
    </div>
    <div
      class="kpi-matrix-block__grid"
      :style="{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }"
    >
      <div
        v-for="metric in block.metrics"
        :key="metric.label"
        class="kpi-matrix-block__card"
        :data-tone="metric.tone ?? 'neutral'"
      >
        <span class="kpi-matrix-block__label">{{ metric.label }}</span>
        <div class="kpi-matrix-block__value-wrap">
          <span
            class="kpi-matrix-block__value"
            :style="{ color: toneColorMap[metric.tone ?? 'neutral'] }"
          >
            {{ metric.value }}
          </span>
          <span v-if="metric.unit" class="kpi-matrix-block__unit">{{ metric.unit }}</span>
        </div>
        <div v-if="metric.trend || metric.sublabel" class="kpi-matrix-block__sub">
          <span
            v-if="metric.trend && metric.trendLabel"
            class="kpi-matrix-block__trend"
            :style="{ color: trendColor[metric.trend] }"
          >
            {{ trendIcon[metric.trend] }} {{ metric.trendLabel }}
          </span>
          <span v-if="metric.sublabel" class="kpi-matrix-block__sublabel">{{ metric.sublabel }}</span>
        </div>
      </div>
    </div>
    <p v-if="block.description" class="kpi-matrix-block__desc">{{ block.description }}</p>
  </div>
</template>

<style scoped>
.kpi-matrix-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.kpi-matrix-block__title h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  color: #0A2540;
}

.kpi-matrix-block__grid {
  display: grid;
  gap: 12px;
}

.kpi-matrix-block__card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px;
  border-radius: 12px;
  background: #F9FBFF;
  border: 0.5px solid #E6EBF1;
}

.kpi-matrix-block__label {
  font-size: 12px;
  color: #6B7C93;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.kpi-matrix-block__value-wrap {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.kpi-matrix-block__value {
  font-size: 28px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.kpi-matrix-block__unit {
  font-size: 13px;
  color: #6B7C93;
}

.kpi-matrix-block__sub {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.kpi-matrix-block__trend {
  font-size: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.kpi-matrix-block__sublabel {
  font-size: 11px;
  color: #6B7C93;
}

.kpi-matrix-block__desc {
  margin: 0;
  font-size: 12px;
  color: #6B7C93;
  line-height: 1.5;
}
</style>

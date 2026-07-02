<script setup lang="ts">
import { computed } from 'vue';
import { ElIcon } from 'element-plus';
import BusinessEmptyState from '@/components/shared/BusinessEmptyState.vue';
import NumberToneText from '@/components/analysis/NumberToneText.vue';
import { UiIcons } from '@/ui/icons';
import { resolveChartColor } from '@/ui/visual-language';
import { shouldUseVerticalAnalysisChart } from '@/utils/analysis-chart-display';

const props = defineProps<{
  title?: string;
  viewType?: string;
  series?: Array<Record<string, unknown>>;
}>();

const MAX_BAR_HEIGHT = 180;

const normalizedSeries = computed(() =>
  (props.series ?? []).map((item, index) => ({
    label: String(item.label ?? item.name ?? item.ownerName ?? '未命名'),
    numericValue: Number(item.value ?? 0),
    rank: index + 1,
  })),
);

const maxValue = computed(() =>
  Math.max(...normalizedSeries.value.map((item) => item.numericValue), 1),
);

const shouldUseVerticalList = computed(() =>
  shouldUseVerticalAnalysisChart(props.title, props.viewType, normalizedSeries.value.length),
);

/**
 * 计算折线点位的可视高度，避免极小值贴底导致趋势不可读。
 * 参数：当前数值；返回：CSS 高度字符串。
 */
function getLineOffset(value: number): string {
  const scaledHeight = (value / maxValue.value) * MAX_BAR_HEIGHT;
  return `${Math.min(MAX_BAR_HEIGHT, Math.max(scaledHeight, 20))}px`;
}

/**
 * 计算横向条形宽度，保留最小宽度避免低值条完全不可见。
 * 参数：当前数值；返回：百分比宽度字符串。
 */
function getRankingBarWidth(value: number): string {
  const scaledWidth = (value / maxValue.value) * 100;
  return `${Math.min(100, Math.max(scaledWidth, 8))}%`;
}

/**
 * 将排名序号格式化为两位数字，提升扫描时的稳定性。
 * 参数：从 1 开始的排名；返回：两位排名文本。
 */
function formatRank(rank: number): string {
  return String(rank).padStart(2, '0');
}

/**
 * 为每个图形项绑定统一图表色板，避免所有系列都使用单一品牌渐变。
 * 参数：从 0 开始的数据序号；返回：CSS 自定义属性对象。
 */
function getChartItemStyle(index: number): Record<string, string> {
  return {
    '--chart-color': resolveChartColor(index),
  };
}
</script>

<template>
  <section class="panel">
    <div class="panel__header">
      <h3 class="chart-panel__title">
        <el-icon>
          <component :is="UiIcons.analysis" />
        </el-icon>
        <NumberToneText :text="title ?? '结果图表'" />
      </h3>
    </div>
    <div class="panel__body">
      <BusinessEmptyState
        v-if="!normalizedSeries.length"
        module="analysis"
        title="暂无图表数据"
        description="当前结果没有可绘制的数值序列，请查看明细表格或调整查询条件后重试。"
      />
      <div
        v-else-if="props.viewType === 'LINE_CHART'"
        class="chart-grid chart-grid--line"
      >
        <div
          v-for="item in normalizedSeries"
          :key="item.label"
          class="chart-item"
          :style="getChartItemStyle(item.rank - 1)"
        >
          <div class="chart-item__plot">
            <div
              class="chart-item__line"
              :style="{ height: getLineOffset(item.numericValue) }"
            />
            <div
              class="chart-item__dot"
              :style="{ bottom: `calc(24px + ${getLineOffset(item.numericValue)})` }"
            />
          </div>
          <div class="chart-item__meta">
            <div class="chart-item__label">
              <NumberToneText :text="item.label" />
            </div>
            <div class="chart-item__value">
              <NumberToneText
                :text="item.numericValue"
                :tone-hint="title"
              />
            </div>
          </div>
        </div>
      </div>
      <div
        v-else-if="shouldUseVerticalList"
        class="chart-ranking-list"
      >
        <div
          v-for="item in normalizedSeries"
          :key="item.label"
          class="chart-ranking-item"
          :style="getChartItemStyle(item.rank - 1)"
        >
          <span class="chart-ranking-item__rank">
            <NumberToneText :text="formatRank(item.rank)" />
          </span>
          <div class="chart-ranking-item__content">
            <div class="chart-ranking-item__head">
              <span class="chart-ranking-item__label">
                <NumberToneText :text="item.label" />
              </span>
              <strong class="chart-ranking-item__value">
                <NumberToneText
                  :text="item.numericValue"
                  :tone-hint="title"
                />
              </strong>
            </div>
            <div class="chart-ranking-item__track">
              <div
                class="chart-ranking-item__bar"
                :style="{ width: getRankingBarWidth(item.numericValue) }"
              />
            </div>
          </div>
        </div>
      </div>
      <div
        v-else
        class="chart-horizontal-list"
      >
        <div
          v-for="item in normalizedSeries"
          :key="item.label"
          class="chart-horizontal-item"
          :style="getChartItemStyle(item.rank - 1)"
        >
          <span class="chart-horizontal-item__rank">
            <NumberToneText :text="formatRank(item.rank)" />
          </span>
          <div class="chart-horizontal-item__content">
            <div class="chart-horizontal-item__head">
              <span class="chart-horizontal-item__label">
                <NumberToneText :text="item.label" />
              </span>
              <strong class="chart-horizontal-item__value">
                <NumberToneText
                  :text="item.numericValue"
                  :tone-hint="title"
                />
              </strong>
            </div>
            <div class="chart-horizontal-item__track">
              <div
                class="chart-horizontal-item__bar"
                :style="{ width: getRankingBarWidth(item.numericValue) }"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ElCard, ElIcon } from 'element-plus';
import NumberToneText from '@/components/analysis/NumberToneText.vue';
import { UiIcons, type UiIconComponent } from '@/ui/icons';
import { resolveChartColor } from '@/ui/visual-language';

const props = defineProps<{
  metrics: Array<{ name: string; value: string | number; helper?: string; unit?: string }>;
}>();

/**
 * 按指标名称选择更贴近业务语义的图标，避免所有指标卡都显示同一个文档图标。
 * 参数 name 为指标展示名称；返回 Element Plus 图标组件，未命中时使用结果图标兜底。
 */
function resolveMetricIcon(name: string): UiIconComponent {
  const amountKeywords = ['金额', '收入', '回款', '费用', '万元', '元'];
  const countKeywords = ['数量', '个数', '商机数', '客户数', '合同数'];
  const rankingKeywords = ['排名', '排行', 'Top'];
  const trendKeywords = ['趋势', '预测', '增长', '下降', '环比', '同比'];

  if (amountKeywords.some((keyword) => name.includes(keyword))) {
    return UiIcons.money;
  }

  if (countKeywords.some((keyword) => name.includes(keyword))) {
    return UiIcons.histogram;
  }

  if (rankingKeywords.some((keyword) => name.includes(keyword))) {
    return UiIcons.ranking;
  }

  if (trendKeywords.some((keyword) => name.includes(keyword))) {
    return UiIcons.chart;
  }

  return UiIcons.result;
}

const normalizedMetrics = computed(() =>
  props.metrics.map((item, index) => ({
    ...item,
    color: resolveChartColor(index),
    helper: item.helper ?? '按当前查询口径返回',
    icon: resolveMetricIcon(item.name),
  })),
);
</script>

<template>
  <div class="metric-card-grid">
    <el-card
      v-for="item in normalizedMetrics"
      :key="item.name"
      class="metric-card"
      :style="{ '--metric-color': item.color }"
      shadow="never"
    >
      <p class="metric-card__label">
        <span
          class="metric-card__label-icon"
          aria-hidden="true"
        >
          <el-icon>
            <component :is="item.icon" />
          </el-icon>
        </span>
        <NumberToneText :text="item.name" />
      </p>
      <p class="metric-card__value">
        <NumberToneText
          :text="item.value"
          :tone-hint="item.name"
        />
        <span
          v-if="item.unit"
          class="metric-card__unit"
        >{{ item.unit }}</span>
      </p>
      <p class="metric-card__helper">
        {{ item.helper }}
      </p>
    </el-card>
  </div>
</template>

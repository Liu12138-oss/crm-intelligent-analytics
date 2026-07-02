<script setup lang="ts">
/**
 * 地图覆盖 Block
 *
 * 用于渲染 31 省覆盖地图，对标案例二全国代理商看板的中国地图。
 * 已覆盖省份用绿色着色，未覆盖用红色，支持省份点击弹窗。
 */

import { ref, computed, onMounted } from 'vue';
import { ensureChinaMapRegistered, ECHARTS_COLOR_PALETTE, type EChartsOption } from '@/ui/echarts-setup';
import { useEChartsBlock } from './use-echarts-block';
import type { ManagementReportGeoMapBlock } from '@/types/management-report';

const props = defineProps<{
  block: ManagementReportGeoMapBlock;
}>();

const chartRef = ref<HTMLElement | null>(null);
const mapLoading = ref(true);
const mapError = ref<string | null>(null);

// 构建地图数据
const mapData = computed(() => {
  return props.block.regions.map((item) => ({
    name: item.name,
    value: item.value,
    extra: item.extra,
  }));
});

// 构建 ECharts option
const option = computed<EChartsOption>(() => {
  const max = Math.max(...mapData.value.map((d) => d.value), 1);

  return {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        if (!params.data) {
          return `${params.name}：未覆盖`;
        }
        const extra = params.data.extra ? `<br/>${params.data.extra}` : '';
        return `${params.name}：${params.data.value} ${props.block.unitLabel ?? '家'}${extra}`;
      },
    },
    visualMap: {
      type: 'piecewise',
      pieces: [
        { min: 1, label: '已覆盖', color: '#0E9F8A' },
        { value: 0, label: '未覆盖', color: '#FCEBEB' },
      ],
      left: 'right',
      bottom: 20,
      itemWidth: 14,
      itemHeight: 14,
      textStyle: { fontSize: 11, color: '#6B7C93' },
      show: true,
    },
    geo: undefined,
    series: [
      {
        type: 'map',
        map: props.block.mapName || 'china',
        roam: false,
        data: mapData.value,
        emphasis: {
          label: { show: true, color: '#0A2540' },
          itemStyle: { areaColor: '#8BC5FF' },
        },
        itemStyle: {
          borderColor: '#E6EBF1',
          borderWidth: 0.5,
        },
      },
    ],
  } as EChartsOption;
});

// 注册中国地图后初始化
onMounted(async () => {
  try {
    await ensureChinaMapRegistered();
    mapLoading.value = false;
  } catch (error) {
    mapError.value = error instanceof Error ? error.message : '地图加载失败';
    mapLoading.value = false;
  }
});

const { instance } = useEChartsBlock(chartRef, option);

// 覆盖率摘要
const coverageSummary = computed(() => {
  if (props.block.coveredRegionCount !== undefined && props.block.totalRegionCount) {
    const percentage = ((props.block.coveredRegionCount / props.block.totalRegionCount) * 100).toFixed(1);
    return `已覆盖 ${props.block.coveredRegionCount}/${props.block.totalRegionCount} 省份（${percentage}%）`;
  }
  return '';
});
</script>

<template>
  <div class="geo-map-block">
    <div v-if="block.title" class="geo-map-block__title">
      <h3>{{ block.title }}</h3>
      <span v-if="coverageSummary" class="geo-map-block__summary">{{ coverageSummary }}</span>
    </div>
    <div v-if="mapLoading" class="geo-map-block__loading">
      正在加载地图数据...
    </div>
    <div v-else-if="mapError" class="geo-map-block__error">
      {{ mapError }}
    </div>
    <div v-else ref="chartRef" class="geo-map-block__chart" />
    <p v-if="block.description" class="geo-map-block__desc">{{ block.description }}</p>
  </div>
</template>

<style scoped>
.geo-map-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  min-height: 320px;
}

.geo-map-block__title {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}

.geo-map-block__title h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  color: #0A2540;
}

.geo-map-block__summary {
  font-size: 12px;
  color: #6B7C93;
}

.geo-map-block__chart {
  flex: 1;
  min-height: 280px;
  width: 100%;
}

.geo-map-block__loading,
.geo-map-block__error {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 280px;
  font-size: 13px;
  color: #6B7C93;
  background: #F6F9FC;
  border-radius: 12px;
}

.geo-map-block__error {
  color: #C23D4B;
}

.geo-map-block__desc {
  margin: 0;
  font-size: 12px;
  color: #6B7C93;
  line-height: 1.5;
}
</style>

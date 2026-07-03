<script setup lang="ts">
/**
 * 地图覆盖 Block
 *
 * 用于渲染 31 省覆盖地图，对标案例二全国代理商看板的中国地图。
 * 已覆盖省份按地市覆盖深度着色，支持省份双击查看地市渠道商明细。
 */

import { ref, computed, onMounted, watch } from 'vue';
import { ensureChinaMapRegistered, type EChartsOption } from '@/ui/echarts-setup';
import { useEChartsBlock } from './use-echarts-block';
import type { ManagementReportGeoMapBlock } from '@/types/management-report';

const props = defineProps<{
  block: ManagementReportGeoMapBlock;
}>();

const chartRef = ref<HTMLElement | null>(null);
const mapLoading = ref(true);
const mapError = ref<string | null>(null);
const selectedRegionName = ref('');
const detailVisible = ref(false);

const mapReady = computed(() => !mapLoading.value && !mapError.value);

type GeoRegion = ManagementReportGeoMapBlock['regions'][number];

// 构建地图数据
const mapData = computed(() => {
  return props.block.regions.map((item) => ({
    name: item.name,
    value: item.coveredCityCount ?? item.value,
    partnerCount: item.value,
    coveredCityCount: item.coveredCityCount ?? 0,
    totalCityCount: item.totalCityCount ?? 0,
    extra: item.extra,
    cityGroups: item.cityGroups ?? [],
  }));
});

// 构建 ECharts option
const option = computed<EChartsOption>(() => {
  if (!mapReady.value) {
    return { series: [] } as EChartsOption;
  }

  const max = Math.max(...mapData.value.map((d) => d.value), 1);

  return {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        if (!params.data) {
          return `${params.name}：未覆盖`;
        }
        const extra = params.data.extra ? `<br/>${params.data.extra}` : '';
        const cityText = params.data.totalCityCount
          ? `<br/>覆盖地市：${params.data.coveredCityCount}/${params.data.totalCityCount}`
          : '';
        return `${params.name}<br/>渠道商：${params.data.partnerCount} ${props.block.unitLabel ?? '家'}${cityText}${extra}`;
      },
    },
    visualMap: {
      min: 0,
      max,
      text: ['地市覆盖高', '地市覆盖低'],
      calculable: true,
      left: 'right',
      bottom: 20,
      itemWidth: 14,
      itemHeight: 14,
      textStyle: { fontSize: 11, color: '#6B7C93' },
      inRange: { color: ['#FCEBEB', '#8BC5FF', '#0E9F8A'] },
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

watch(instance, (chart) => {
  if (!chart) {
    return;
  }
  chart.off('dblclick');
  chart.on('dblclick', (params: any) => {
    const regionName = String(params.name ?? '');
    if (regionName) {
      selectedRegionName.value = regionName;
      detailVisible.value = true;
    }
  });
});

// 覆盖率摘要
const coverageSummary = computed(() => {
  if (props.block.coveredCityCount !== undefined && props.block.totalCityCount) {
    const cityPercentage = ((props.block.coveredCityCount / props.block.totalCityCount) * 100).toFixed(1);
    const provinceText = props.block.coveredRegionCount !== undefined && props.block.totalRegionCount
      ? `；省份 ${props.block.coveredRegionCount}/${props.block.totalRegionCount}`
      : '';
    return `已覆盖 ${props.block.coveredCityCount}/${props.block.totalCityCount} 地市（${cityPercentage}%）${provinceText}`;
  }

  if (props.block.coveredRegionCount !== undefined && props.block.totalRegionCount) {
    const percentage = ((props.block.coveredRegionCount / props.block.totalRegionCount) * 100).toFixed(1);
    return `已覆盖 ${props.block.coveredRegionCount}/${props.block.totalRegionCount} 省份（${percentage}%）`;
  }
  return '';
});

const selectedRegion = computed<GeoRegion | null>(() => {
  return props.block.regions.find((region) => region.name === selectedRegionName.value) ?? null;
});

const selectedCityGroups = computed(() => {
  return [...(selectedRegion.value?.cityGroups ?? [])].sort((left, right) => {
    if (left.cityName === '未识别地市') return 1;
    if (right.cityName === '未识别地市') return -1;
    return right.partnerCount - left.partnerCount || left.cityName.localeCompare(right.cityName, 'zh-CN');
  });
});

function closeDetail() {
  detailVisible.value = false;
}
</script>

<template>
  <div class="geo-map-block">
    <div v-if="block.title" class="geo-map-block__title">
      <h3>{{ block.title }}</h3>
      <span v-if="coverageSummary" class="geo-map-block__summary">{{ coverageSummary }}</span>
    </div>

    <div class="geo-map-block__canvas-shell">
      <div ref="chartRef" class="geo-map-block__chart" />
      <div v-if="mapLoading" class="geo-map-block__overlay">
        正在加载地图数据...
      </div>
      <div v-else-if="mapError" class="geo-map-block__overlay geo-map-block__overlay--error">
        {{ mapError }}
      </div>
    </div>

    <p v-if="block.description" class="geo-map-block__desc">{{ block.description }}</p>

    <div v-if="detailVisible" class="geo-map-block__modal" @click.self="closeDetail">
      <div class="geo-map-block__modal-panel">
        <button class="geo-map-block__modal-close" type="button" @click="closeDetail">×</button>
        <div class="geo-map-block__modal-title">
          {{ selectedRegionName }}
          <span :class="['geo-map-block__badge', selectedRegion ? 'is-covered' : 'is-empty']">
            {{ selectedRegion ? '已覆盖' : '未覆盖' }}
          </span>
        </div>
        <div class="geo-map-block__modal-summary">
          <template v-if="selectedRegion">
            渠道商 {{ selectedRegion.value }} 家，覆盖地市
            {{ selectedRegion.coveredCityCount ?? 0 }}/{{ selectedRegion.totalCityCount ?? 0 }}
          </template>
          <template v-else>
            当前省份暂无渠道商数据
          </template>
        </div>

        <div v-if="selectedCityGroups.length > 0" class="geo-map-block__city-list">
          <section
            v-for="city in selectedCityGroups"
            :key="city.cityName"
            class="geo-map-block__city-group"
          >
            <header>
              <strong>{{ city.cityName }}</strong>
              <span>{{ city.partnerCount }} 家</span>
            </header>
            <div class="geo-map-block__partner-list">
              <span
                v-for="partner in city.partners"
                :key="partner"
                class="geo-map-block__partner"
              >
                {{ partner }}
              </span>
              <span v-if="city.partners.length === 0" class="geo-map-block__partner is-empty">
                暂无渠道商名单
              </span>
            </div>
          </section>
        </div>
        <div v-else class="geo-map-block__empty">
          暂无可下钻的地市渠道商数据
        </div>
      </div>
    </div>
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

.geo-map-block__canvas-shell {
  position: relative;
  flex: 1;
  min-height: 280px;
}

.geo-map-block__chart {
  height: 100%;
  min-height: 280px;
  width: 100%;
}

.geo-map-block__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #6B7C93;
  background: #F6F9FC;
  border-radius: 12px;
}

.geo-map-block__overlay--error {
  color: #C23D4B;
}

.geo-map-block__desc {
  margin: 0;
  font-size: 12px;
  color: #6B7C93;
  line-height: 1.5;
}

.geo-map-block__modal {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(10, 20, 16, 0.42);
}

.geo-map-block__modal-panel {
  position: relative;
  width: min(620px, calc(100vw - 40px));
  max-height: min(760px, calc(100vh - 56px));
  overflow: auto;
  padding: 26px 30px;
  border: 1px solid #D8E1DC;
  border-radius: 16px;
  background: #FFFFFF;
  box-shadow: 0 22px 70px rgba(15, 33, 27, 0.24);
}

.geo-map-block__modal-close {
  position: absolute;
  top: 14px;
  right: 18px;
  border: 0;
  background: transparent;
  color: #6B7C93;
  font-size: 26px;
  line-height: 1;
  cursor: pointer;
}

.geo-map-block__modal-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  color: #17251F;
  font-size: 20px;
  font-weight: 800;
}

.geo-map-block__badge {
  padding: 2px 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.geo-map-block__badge.is-covered {
  color: #1A7F37;
  background: #DFF3E6;
}

.geo-map-block__badge.is-empty {
  color: #C23D4B;
  background: #FFF0F0;
}

.geo-map-block__modal-summary {
  margin-bottom: 18px;
  color: #64736D;
  font-size: 13px;
}

.geo-map-block__city-list {
  display: grid;
  gap: 12px;
}

.geo-map-block__city-group {
  padding: 12px 14px;
  border: 1px solid #E3EBE7;
  border-radius: 13px;
  background: #FBFDFC;
}

.geo-map-block__city-group header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
  color: #20322E;
}

.geo-map-block__city-group header span {
  color: #64736D;
  font-size: 12px;
  font-weight: 700;
}

.geo-map-block__partner-list {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.geo-map-block__partner {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  padding: 3px 8px;
  border-radius: 999px;
  background: #EEF8F4;
  color: #315B4C;
  font-size: 12px;
  word-break: break-word;
}

.geo-map-block__partner.is-empty,
.geo-map-block__empty {
  color: #7B8781;
  background: #F7FAF9;
}

.geo-map-block__empty {
  padding: 18px;
  border-radius: 12px;
  text-align: center;
  font-size: 13px;
}
</style>

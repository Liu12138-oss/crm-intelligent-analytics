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

const mapReady = computed(() => !mapLoading.value && !mapError.value);

type GeoRegion = ManagementReportGeoMapBlock['regions'][number];
type MapRegionData = {
  name: string;
  value: number;
  partnerCount: number;
  coveredCityCount: number;
  totalCityCount: number;
  extra?: string;
  cityGroups: NonNullable<GeoRegion['cityGroups']>;
};

const MAP_COLORS = {
  empty: '#0B1A2F',
  low: '#0D5B6B',
  medium: '#12A2B8',
  high: '#22D3EE',
  selected: '#F59E0B',
  border: 'rgba(125, 211, 252, 0.32)',
  hover: '#38BDF8',
  label: '#D7F8FF',
};

// 构建地图数据
const mapData = computed<MapRegionData[]>(() => {
  return props.block.regions.map((item) => {
    const value = item.coveredCityCount ?? item.value;
    const coveredCityCount = item.coveredCityCount ?? 0;
    const totalCityCount = item.totalCityCount ?? 0;

    return {
      name: item.name,
      value,
      partnerCount: item.value,
      coveredCityCount,
      totalCityCount,
      extra: item.extra,
      cityGroups: item.cityGroups ?? [],
    };
  });
});

const coveredRegions = computed(() => {
  return mapData.value
    .filter((item) => item.partnerCount > 0)
    .sort((left, right) => right.partnerCount - left.partnerCount || left.name.localeCompare(right.name, 'zh-CN'));
});

const uncoveredRegionNames = computed(() => {
  const knownRegionNames = new Set(mapData.value.map((item) => item.name));
  const emptyFromData = mapData.value.filter((item) => item.partnerCount <= 0).map((item) => item.name);
  const expectedTotal = props.block.totalRegionCount ?? knownRegionNames.size;

  if (knownRegionNames.size >= expectedTotal) {
    return emptyFromData;
  }

  return [];
});

const mapMaxValue = computed(() => Math.max(...mapData.value.map((item) => item.value), 1));

const defaultSelectedRegionName = computed(() => {
  const cityDetailRegion = props.block.regions.find((item) => (item.cityGroups?.length ?? 0) > 0);
  if (cityDetailRegion) {
    return cityDetailRegion.name;
  }

  const coveredRegion = [...props.block.regions]
    .filter((item) => item.value > 0)
    .sort((left, right) => right.value - left.value || left.name.localeCompare(right.name, 'zh-CN'))[0];

  return coveredRegion?.name ?? props.block.regions[0]?.name ?? '';
});

const coverageRateText = computed(() => {
  if (props.block.coveredCityCount !== undefined && props.block.totalCityCount) {
    return `${((props.block.coveredCityCount / props.block.totalCityCount) * 100).toFixed(1)}%`;
  }

  if (props.block.coveredRegionCount !== undefined && props.block.totalRegionCount) {
    return `${((props.block.coveredRegionCount / props.block.totalRegionCount) * 100).toFixed(1)}%`;
  }

  return '--';
});

// 构建 ECharts option
const option = computed<EChartsOption>(() => {
  if (!mapReady.value) {
    return { series: [] } as EChartsOption;
  }

  const mapName = props.block.mapName || 'china';

  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(7, 18, 36, 0.95)',
      borderColor: 'rgba(56, 189, 248, 0.45)',
      borderWidth: 1,
      padding: [10, 12],
      textStyle: {
        color: '#DCEFFF',
        fontSize: 12,
        lineHeight: 20,
      },
      extraCssText: 'border-radius: 12px; box-shadow: 0 18px 44px rgba(0, 0, 0, 0.28); backdrop-filter: blur(10px);',
      formatter: (params: any) => {
        if (!params.data) {
          return `<strong style="color:#FFFFFF">${params.name}</strong><br/>渠道商：0 ${props.block.unitLabel ?? '家'}<br/><span style="color:#8FB7CC">双击查看地市代理商</span>`;
        }
        const extra = params.data.extra ? `<br/>${params.data.extra}` : '';
        const cityText = params.data.totalCityCount
          ? `<br/>覆盖地市：${params.data.coveredCityCount}/${params.data.totalCityCount}`
          : '';
        return `<strong style="color:#FFFFFF">${params.name}</strong><br/>渠道商：${params.data.partnerCount} ${props.block.unitLabel ?? '家'}${cityText}${extra}<br/><span style="color:#8FB7CC">双击查看地市代理商</span>`;
      },
    },
    visualMap: {
      min: 0,
      max: mapMaxValue.value,
      show: false,
      seriesIndex: [0],
      inRange: { color: [MAP_COLORS.empty, MAP_COLORS.low, MAP_COLORS.medium, MAP_COLORS.high] },
    },
    geo: [
      {
        map: mapName,
        silent: true,
        roam: false,
        zoom: 1.18,
        layoutCenter: ['51.6%', '52.9%'],
        layoutSize: '96%',
        zlevel: 0,
        z: 0,
        label: { show: false },
        itemStyle: {
          areaColor: 'rgba(2, 10, 22, 0.82)',
          borderColor: 'transparent',
          borderWidth: 0,
          shadowBlur: 28,
          shadowColor: 'rgba(8, 145, 178, 0.26)',
        },
        emphasis: {
          disabled: true,
          label: { show: false },
          itemStyle: { areaColor: 'rgba(2, 10, 22, 0.82)' },
        },
      },
      {
        map: mapName,
        silent: true,
        roam: false,
        zoom: 1.18,
        layoutCenter: ['50.9%', '51.7%'],
        layoutSize: '96%',
        zlevel: 0,
        z: 1,
        label: { show: false },
        itemStyle: {
          areaColor: 'rgba(7, 48, 64, 0.8)',
          borderColor: 'transparent',
          borderWidth: 0,
          shadowBlur: 22,
          shadowColor: 'rgba(34, 211, 238, 0.22)',
        },
        emphasis: {
          disabled: true,
          label: { show: false },
          itemStyle: { areaColor: 'rgba(7, 48, 64, 0.8)' },
        },
      },
    ],
    series: [
      {
        type: 'map',
        map: mapName,
        roam: true,
        zoom: 1.18,
        layoutCenter: ['50%', '50%'],
        layoutSize: '96%',
        zlevel: 1,
        z: 10,
        scaleLimit: { min: 1, max: 3 },
        showLegendSymbol: false,
        selectedMode: 'single',
        selectedMap: selectedRegionName.value ? { [selectedRegionName.value]: true } : {},
        data: mapData.value,
        regions: selectedRegionName.value
          ? [{
              name: selectedRegionName.value,
              itemStyle: {
                areaColor: MAP_COLORS.selected,
                borderColor: '#FDE68A',
                borderWidth: 1.6,
                shadowBlur: 20,
                shadowColor: 'rgba(245, 158, 11, 0.42)',
              },
              label: {
                show: true,
                color: '#FFF7D6',
                fontWeight: 800,
                textBorderColor: 'rgba(8, 20, 38, 0.88)',
                textBorderWidth: 3,
              },
            }]
          : [],
        label: {
          show: true,
          color: MAP_COLORS.label,
          fontSize: 10,
          fontWeight: 600,
          formatter: (params: any) => {
            const region = mapData.value.find((item) => item.name === params.name);
            return (region && region.partnerCount > 0) || params.name === selectedRegionName.value ? params.name : '';
          },
        },
        emphasis: {
          label: { show: true, color: '#FFFFFF', fontSize: 12, fontWeight: 700 },
          itemStyle: {
            areaColor: MAP_COLORS.hover,
            borderColor: '#E0F2FE',
            borderWidth: 1.4,
            shadowBlur: 18,
            shadowColor: 'rgba(56, 189, 248, 0.42)',
          },
        },
        select: {
          label: {
            show: true,
            color: '#FFF7D6',
            fontSize: 12,
            fontWeight: 800,
            textBorderColor: 'rgba(8, 20, 38, 0.88)',
            textBorderWidth: 3,
          },
          itemStyle: {
            areaColor: MAP_COLORS.selected,
            borderColor: '#FDE68A',
            borderWidth: 1.7,
            shadowBlur: 22,
            shadowColor: 'rgba(245, 158, 11, 0.46)',
          },
        },
        itemStyle: {
          areaColor: MAP_COLORS.empty,
          borderColor: 'rgba(165, 243, 252, 0.42)',
          borderWidth: 1,
          shadowBlur: 16,
          shadowColor: 'rgba(34, 211, 238, 0.18)',
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
    }
  });
});

watch(
  defaultSelectedRegionName,
  (regionName) => {
    if (!selectedRegionName.value && regionName) {
      selectedRegionName.value = regionName;
    }
  },
  { immediate: true },
);

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

const selectedCoverageRateText = computed(() => {
  if (!selectedRegion.value?.totalCityCount) {
    return '--';
  }

  return `${(((selectedRegion.value.coveredCityCount ?? 0) / selectedRegion.value.totalCityCount) * 100).toFixed(1)}%`;
});

const selectedRegionCovered = computed(() => (selectedRegion.value?.value ?? 0) > 0);

const selectedRegionPartnerCount = computed(() => selectedRegion.value?.value ?? 0);

const selectedCoveredCityCount = computed(() => selectedRegion.value?.coveredCityCount ?? 0);

const selectedTotalCityCount = computed(() => selectedRegion.value?.totalCityCount ?? 0);
</script>

<template>
  <div class="geo-map-block">
    <div v-if="block.title" class="geo-map-block__title">
      <h3>{{ block.title }}</h3>
      <span v-if="coverageSummary" class="geo-map-block__summary">{{ coverageSummary }}</span>
    </div>

    <div class="geo-map-block__stage">
      <div class="geo-map-block__canvas-shell">
        <div class="geo-map-block__overview" aria-label="覆盖概览">
          <span>覆盖率</span>
          <strong>{{ coverageRateText }}</strong>
          <em v-if="block.coveredRegionCount !== undefined && block.totalRegionCount">
            {{ block.coveredRegionCount }}/{{ block.totalRegionCount }} 省份
          </em>
          <em v-if="block.coveredCityCount !== undefined && block.totalCityCount">
            {{ block.coveredCityCount }}/{{ block.totalCityCount }} 地市
          </em>
        </div>
        <div ref="chartRef" class="geo-map-block__chart" />
        <div class="geo-map-block__legend" aria-label="地图图例">
          <span><i class="geo-map-block__legend-chip is-empty" />省份覆盖强度</span>
          <span><i class="geo-map-block__legend-chip is-low" />地市覆盖明细</span>
          <span><i class="geo-map-block__legend-chip is-selected" />当前下钻省份</span>
          <strong>双击省份查看地市代理商</strong>
        </div>
        <div v-if="mapLoading" class="geo-map-block__overlay">
          正在加载地图数据...
        </div>
        <div v-else-if="mapError" class="geo-map-block__overlay geo-map-block__overlay--error">
          {{ mapError }}
        </div>
      </div>

      <aside class="geo-map-block__drill-panel" aria-live="polite" aria-label="地市代理商明细">
        <div class="geo-map-block__drill-title">
          <div>
            <span>当前下钻</span>
            <strong>{{ selectedRegionName ? `${selectedRegionName} · 地市代理商` : '请选择省份' }}</strong>
          </div>
          <span :class="['geo-map-block__badge', selectedRegionCovered ? 'is-covered' : 'is-empty']">
            {{ selectedRegionCovered ? '已覆盖' : '未覆盖' }}
          </span>
        </div>

        <div v-if="selectedRegionName" class="geo-map-block__drill-summary">
          <span>
            <strong>{{ selectedRegionPartnerCount }}</strong>
            {{ block.unitLabel ?? '家' }}渠道商
          </span>
          <span>
            <strong>{{ selectedCoveredCityCount }}/{{ selectedTotalCityCount }}</strong>
            地市覆盖
          </span>
          <span>
            <strong>{{ selectedCoverageRateText }}</strong>
            覆盖率
          </span>
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
          {{ selectedRegionCovered ? '该省份暂无可下钻的地市渠道商数据' : '该省份当前未覆盖代理商' }}
        </div>
      </aside>
    </div>

    <div
      v-if="coveredRegions.length > 0 || uncoveredRegionNames.length > 0"
      class="geo-map-block__note"
    >
      <span v-if="coveredRegions.length > 0">
        重点覆盖：{{ coveredRegions.slice(0, 4).map((item) => `${item.name}${item.partnerCount}${block.unitLabel ?? '家'}`).join('、') }}
      </span>
      <span v-if="uncoveredRegionNames.length > 0">
        空白省份：{{ uncoveredRegionNames.slice(0, 8).join('、') }}
      </span>
    </div>

    <p v-if="block.description" class="geo-map-block__desc">{{ block.description }}</p>
  </div>
</template>

<style scoped>
.geo-map-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 380px;
}

.geo-map-block__title {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}

.geo-map-block__title h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #0A2540;
}

.geo-map-block__summary {
  font-size: 12px;
  color: #6B7C93;
}

.geo-map-block__stage {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(288px, 340px);
  gap: 12px;
  flex: 1;
  min-height: 380px;
}

.geo-map-block__canvas-shell {
  position: relative;
  flex: 1;
  min-height: 380px;
  overflow: hidden;
  border: 1px solid rgba(56, 189, 248, 0.28);
  border-radius: 18px;
  background:
    linear-gradient(rgba(56, 189, 248, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(56, 189, 248, 0.08) 1px, transparent 1px),
    linear-gradient(180deg, rgba(8, 20, 38, 0.98), rgba(4, 11, 24, 0.98)),
    #061326;
  background-size: 42px 42px, 42px 42px, auto, auto;
  box-shadow: inset 0 0 44px rgba(34, 211, 238, 0.1), 0 16px 40px rgba(8, 20, 38, 0.12);
}

.geo-map-block__canvas-shell::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 36%;
  background:
    linear-gradient(180deg, transparent, rgba(34, 211, 238, 0.08) 48%, rgba(2, 6, 23, 0.24));
  pointer-events: none;
  z-index: 0;
}

.geo-map-block__chart {
  position: relative;
  height: 100%;
  min-height: 380px;
  width: 100%;
  z-index: 1;
}

.geo-map-block__chart :deep(canvas) {
  filter: drop-shadow(0 0 14px rgba(34, 211, 238, 0.22));
}

.geo-map-block__overview {
  position: absolute;
  top: 14px;
  left: 14px;
  z-index: 2;
  display: grid;
  gap: 2px;
  min-width: 132px;
  padding: 10px 12px;
  border: 1px solid rgba(125, 211, 252, 0.28);
  border-radius: 14px;
  background: rgba(7, 18, 36, 0.76);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(10px);
}

.geo-map-block__overview span {
  color: #8FB7CC;
  font-size: 12px;
}

.geo-map-block__overview strong {
  color: #22D3EE;
  font-size: 26px;
  line-height: 1.1;
}

.geo-map-block__overview em {
  color: #C7E6F7;
  font-size: 11px;
  font-style: normal;
}

.geo-map-block__legend {
  position: absolute;
  right: 14px;
  bottom: 14px;
  z-index: 2;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  max-width: min(520px, calc(100% - 28px));
  padding: 9px 12px;
  border: 1px solid rgba(125, 211, 252, 0.26);
  border-radius: 999px;
  background: rgba(7, 18, 36, 0.76);
  color: #C7E6F7;
  font-size: 12px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.16);
  backdrop-filter: blur(10px);
}

.geo-map-block__legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}

.geo-map-block__legend strong {
  color: #67E8F9;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.geo-map-block__legend-chip {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1px solid rgba(224, 242, 254, 0.86);
  box-shadow: 0 0 10px rgba(34, 211, 238, 0.28);
}

.geo-map-block__legend-chip.is-empty {
  background: #0B1A2F;
}

.geo-map-block__legend-chip.is-low {
  background: #12A2B8;
}

.geo-map-block__legend-chip.is-high {
  background: #22D3EE;
}

.geo-map-block__legend-chip.is-selected {
  background: #F59E0B;
  box-shadow: 0 0 12px rgba(245, 158, 11, 0.42);
}

.geo-map-block__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #D7F8FF;
  background: rgba(4, 11, 24, 0.88);
  border-radius: 18px;
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

.geo-map-block__note {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  color: #64748B;
  font-size: 12px;
  line-height: 1.5;
}

.geo-map-block__drill-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  min-height: 380px;
  max-height: 560px;
  overflow: auto;
  padding: 16px;
  border: 1px solid rgba(56, 189, 248, 0.24);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(8, 20, 38, 0.96), rgba(6, 18, 32, 0.98)),
    #071224;
  box-shadow: inset 0 0 28px rgba(34, 211, 238, 0.08), 0 16px 38px rgba(8, 20, 38, 0.1);
}

.geo-map-block__drill-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  color: #E0F2FE;
}

.geo-map-block__drill-title div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.geo-map-block__drill-title span:first-child {
  color: #8FB7CC;
  font-size: 12px;
  font-weight: 600;
}

.geo-map-block__drill-title strong {
  color: #F8FCFF;
  font-size: 18px;
  line-height: 1.2;
  word-break: break-word;
}

.geo-map-block__badge {
  flex: 0 0 auto;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.geo-map-block__badge.is-covered {
  color: #67E8F9;
  background: rgba(8, 145, 178, 0.22);
}

.geo-map-block__badge.is-empty {
  color: #FCD34D;
  background: rgba(245, 158, 11, 0.16);
}

.geo-map-block__drill-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.geo-map-block__drill-summary span {
  display: grid;
  gap: 4px;
  padding: 12px;
  border: 1px solid rgba(125, 211, 252, 0.2);
  border-radius: 12px;
  background: rgba(15, 43, 68, 0.62);
  color: #8FB7CC;
  font-size: 12px;
}

.geo-map-block__drill-summary strong {
  color: #67E8F9;
  font-size: 18px;
  line-height: 1.2;
}

.geo-map-block__city-list {
  display: grid;
  gap: 12px;
}

.geo-map-block__city-group {
  padding: 13px 14px;
  border: 1px solid rgba(125, 211, 252, 0.18);
  border-radius: 12px;
  background: rgba(10, 31, 54, 0.74);
}

.geo-map-block__city-group header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
  color: #E0F2FE;
}

.geo-map-block__city-group header span {
  color: #67E8F9;
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
  padding: 4px 9px;
  border-radius: 999px;
  background: rgba(20, 184, 166, 0.16);
  color: #CFFAFE;
  font-size: 12px;
  word-break: break-word;
}

.geo-map-block__partner.is-empty,
.geo-map-block__empty {
  color: #9FC7D8;
  background: rgba(15, 43, 68, 0.58);
}

.geo-map-block__empty {
  padding: 18px;
  border-radius: 12px;
  text-align: center;
  font-size: 13px;
  line-height: 1.6;
}

@media (max-width: 920px) {
  .geo-map-block__stage {
    grid-template-columns: 1fr;
  }

  .geo-map-block__drill-panel {
    min-height: 0;
    max-height: none;
  }
}

@media (max-width: 640px) {
  .geo-map-block {
    min-height: 0;
  }

  .geo-map-block__stage {
    min-height: 0;
  }

  .geo-map-block__canvas-shell {
    min-height: 330px;
  }

  .geo-map-block__chart {
    min-height: 330px;
  }

  .geo-map-block__overview {
    min-width: 112px;
    padding: 8px 10px;
  }

  .geo-map-block__overview strong {
    font-size: 22px;
  }

  .geo-map-block__legend {
    right: 10px;
    bottom: 10px;
    left: 10px;
    border-radius: 14px;
  }

  .geo-map-block__drill-summary {
    grid-template-columns: 1fr;
  }
}
</style>

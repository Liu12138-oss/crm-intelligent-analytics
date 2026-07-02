/**
 * ECharts block 组件通用 composable
 *
 * 提供 ECharts 实例的生命周期管理：
 * - 创建实例并注入主题
 * - 监听容器 resize 自动调整
 * - 组件卸载时销毁实例
 * - 统一的 option 更新方法
 */

import { ref, onMounted, onBeforeUnmount, watch, type Ref } from 'vue';
import { createEChartsInstance, ECHARTS_BASE_THEME, type EChartsOption } from '@/ui/echarts-setup';
import type { ECharts } from 'echarts/core';

/**
 * ECharts block 组件 composable
 * @param chartRef 图表容器的 ref
 * @param optionRef 图表配置的响应式 ref
 * @returns ECharts 实例的 ref
 */
export function useEChartsBlock(
  chartRef: Ref<HTMLElement | null>,
  optionRef: Ref<EChartsOption>,
) {
  const instance = ref<ECharts | null>(null);
  let resizeObserver: ResizeObserver | null = null;

  // 初始化 ECharts 实例
  function initInstance() {
    if (!chartRef.value) {
      return;
    }
    instance.value = createEChartsInstance(chartRef.value);
    instance.value.setOption({
      ...ECHARTS_BASE_THEME,
      ...optionRef.value,
    });
    // 监听容器尺寸变化
    resizeObserver = new ResizeObserver(() => {
      instance.value?.resize();
    });
    resizeObserver.observe(chartRef.value);
  }

  // option 变化时更新图表
  function updateOption(newOption: EChartsOption) {
    if (!instance.value) {
      return;
    }
    instance.value.setOption({
      ...ECHARTS_BASE_THEME,
      ...newOption,
    }, true);
  }

  onMounted(() => {
    initInstance();
  });

  // 监听 option 变化
  watch(
    optionRef,
    (newOption) => {
      if (newOption) {
        updateOption(newOption);
      }
    },
    { deep: true },
  );

  onBeforeUnmount(() => {
    resizeObserver?.disconnect();
    resizeObserver = null;
    instance.value?.dispose();
    instance.value = null;
  });

  return {
    instance,
    updateOption,
  };
}

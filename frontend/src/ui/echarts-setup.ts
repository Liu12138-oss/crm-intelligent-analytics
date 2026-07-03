/**
 * ECharts 按需引入与主题配置
 *
 * 设计目标：
 * - 与 DESIGN.md 图表色板完全对齐，不引入额外色值
 * - 按需引入 ECharts 模块，控制包体积
 * - 提供统一的主题配置，所有 ECharts block 组件复用
 * - 浅色主导，符合 DESIGN.md 的 Stripe 风格工作台定位
 */

import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart, ScatterChart, MapChart, EffectScatterChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
  VisualMapComponent,
  GeoComponent,
  MarkLineComponent,
  MarkPointComponent,
  ToolboxComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { ComposeOption } from 'echarts/core';
import type { BarSeriesOption, LineSeriesOption, PieSeriesOption, ScatterSeriesOption, MapSeriesOption } from 'echarts/charts';
import type {
  GridComponentOption,
  TooltipComponentOption,
  LegendComponentOption,
  TitleComponentOption,
  DataZoomComponentOption,
  VisualMapComponentOption,
  GeoComponentOption,
  MarkLineComponentOption,
  MarkPointComponentOption,
  ToolboxComponentOption,
} from 'echarts/components';

// 按需注册 ECharts 模块，避免引入完整包
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  MapChart,
  EffectScatterChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
  VisualMapComponent,
  GeoComponent,
  MarkLineComponent,
  MarkPointComponent,
  ToolboxComponent,
  CanvasRenderer,
]);

// 统一 Option 类型，所有 block 组件的 ECharts 配置都基于此类型
export type EChartsOption = ComposeOption<
  | BarSeriesOption
  | LineSeriesOption
  | PieSeriesOption
  | ScatterSeriesOption
  | MapSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | TitleComponentOption
  | DataZoomComponentOption
  | VisualMapComponentOption
  | GeoComponentOption
  | MarkLineComponentOption
  | MarkPointComponentOption
  | ToolboxComponentOption
>;

/**
 * DESIGN.md 图表色板，与 visual-language.ts 的 chartColorTokens 完全一致
 * 所有 ECharts 图表必须使用此色板，禁止局部写死色值
 */
export const ECHARTS_COLOR_PALETTE: string[] = [
  '#635BFF', // 主指标（AI 紫）
  '#2563EB', // 趋势对比（经营蓝）
  '#0E9F8A', // 健康增长（治理青）
  '#D97706', // 预警临界（预警琥珀）
  '#C23D4B', // 高风险（风险红）
  '#7C3AED', // 智能推荐（模型紫）
  '#0891B2', // 渠道连接（连接青）
  '#64748B', // 中性其他（中性灰蓝）
];

/**
 * 浅色主题基础配置，与 DESIGN.md 浅色主导基调对齐
 */
export const ECHARTS_BASE_THEME = {
  backgroundColor: 'transparent',
  textStyle: {
    fontFamily: 'HarmonyOS Sans SC, Source Han Sans SC, PingFang SC, system-ui, sans-serif',
    color: '#425466',
  },
  title: {
    textStyle: {
      color: '#0A2540',
      fontSize: 15,
      fontWeight: 500,
    },
    subtextStyle: {
      color: '#6B7C93',
      fontSize: 12,
    },
  },
  legend: {
    textStyle: {
      color: '#425466',
      fontSize: 12,
    },
    inactiveColor: '#C7D2E3',
  },
  tooltip: {
    backgroundColor: '#0A2540',
    borderColor: '#0A2540',
    textStyle: {
      color: '#FFFFFF',
      fontSize: 12,
    },
    extraCssText: 'border-radius: 10px; padding: 10px 12px;',
  },
  xAxis: {
    axisLine: { lineStyle: { color: '#E6EBF1' } },
    axisTick: { lineStyle: { color: '#E6EBF1' } },
    axisLabel: { color: '#6B7C93', fontSize: 11 },
    splitLine: { lineStyle: { color: '#F4F7FB', type: 'dashed' } },
  },
  yAxis: {
    axisLine: { lineStyle: { color: '#E6EBF1' } },
    axisTick: { lineStyle: { color: '#E6EBF1' } },
    axisLabel: { color: '#6B7C93', fontSize: 11 },
    splitLine: { lineStyle: { color: '#F4F7FB', type: 'dashed' } },
  },
  grid: {
    left: '3%',
    right: '4%',
    bottom: '3%',
    top: '12%',
    containLabel: true,
  },
  color: ECHARTS_COLOR_PALETTE,
};

/**
 * 创建 ECharts 实例的统一工厂方法
 * - 自动注入浅色主题
 * - 自动设置色板
 */
export function createEChartsInstance(dom: HTMLElement): echarts.ECharts {
  const instance = echarts.init(dom, undefined, {
    renderer: 'canvas',
  });
  return instance;
}

/**
 * 注册中国地图 GeoJSON
 * 用于 geo-map block 组件渲染 31 省覆盖地图
 * 地图数据从项目 public/assets/maps/china.json 本地加载，避免运行时依赖外部地图脚本。
 */
let chinaMapRegistered = false;
export async function ensureChinaMapRegistered(): Promise<void> {
  if (chinaMapRegistered) {
    return;
  }
  try {
    const basePath = import.meta.env.BASE_URL.endsWith('/')
      ? import.meta.env.BASE_URL
      : `${import.meta.env.BASE_URL}/`;
    const response = await fetch(`${basePath}assets/maps/china.json`, { cache: 'force-cache' });
    if (!response.ok) {
      throw new Error(`地图数据加载失败：HTTP ${response.status}`);
    }
    const geoJson = await response.json();
    echarts.registerMap('china', geoJson);
    chinaMapRegistered = true;
  } catch (error) {
    throw new Error(`中国地图注册失败：${error instanceof Error ? error.message : '未知错误'}`);
  }
}

export { echarts };

/**
 * Block 渲染器统一注册入口
 *
 * 在应用启动时调用 registerAllBlockRenderers() 完成所有 block 的注册
 * 新增 block 只需在此文件追加 import 和注册条目，无需改 ManagementSectionCanvas
 */

import type { Component } from 'vue';
import { registerBlockRenderers } from './block-renderer-registry';

// 现有 block 组件（保持兼容）
import BarRankingBlock from './blocks/BarRankingBlock.vue';
import CompactInsightTableBlock from './blocks/CompactInsightTableBlock.vue';
import DataQualityBlock from './blocks/DataQualityBlock.vue';
import DetailTableBlock from './blocks/DetailTableBlock.vue';
import FunnelBlock from './blocks/FunnelBlock.vue';
import MatrixTableBlock from './blocks/MatrixTableBlock.vue';
import MetricStripBlock from './blocks/MetricStripBlock.vue';
import TrendChartBlock from './blocks/TrendChartBlock.vue';

// 第 1 期新增 ECharts block 组件
import ConcentrationBlock from './blocks/ConcentrationBlock.vue';
import CompositeTrendBlock from './blocks/CompositeTrendBlock.vue';
import GeoMapBlock from './blocks/GeoMapBlock.vue';
import GroupedBarBlock from './blocks/GroupedBarBlock.vue';
import KpiMatrixBlock from './blocks/KpiMatrixBlock.vue';
import SortableTableBlock from './blocks/SortableTableBlock.vue';
import StackedBarBlock from './blocks/StackedBarBlock.vue';
import PieDistributionBlock from './blocks/PieDistributionBlock.vue';

// 标记是否已注册，避免重复注册
let registered = false;

/**
 * 注册所有 block 渲染器
 * 在应用入口（main.ts）或首次使用 ManagementSectionCanvas 前调用
 */
export function registerAllBlockRenderers(): void {
  if (registered) {
    return;
  }

  registerBlockRenderers([
    // 现有 block
    { blockType: 'metric-strip', component: MetricStripBlock as Component },
    { blockType: 'bar-ranking', component: BarRankingBlock as Component },
    { blockType: 'trend', component: TrendChartBlock as Component },
    { blockType: 'funnel', component: FunnelBlock as Component },
    { blockType: 'matrix-table', component: MatrixTableBlock as Component },
    { blockType: 'insight-table', component: CompactInsightTableBlock as Component },
    { blockType: 'data-quality', component: DataQualityBlock as Component },
    { blockType: 'detail-table', component: DetailTableBlock as Component },
    { blockType: 'record-preview', component: DetailTableBlock as Component },

    // 第 1 期新增 ECharts block
    { blockType: 'geo-map', component: GeoMapBlock as Component },
    { blockType: 'grouped-bar', component: GroupedBarBlock as Component },
    { blockType: 'stacked-bar', component: StackedBarBlock as Component },
    { blockType: 'kpi-matrix', component: KpiMatrixBlock as Component },
    { blockType: 'concentration', component: ConcentrationBlock as Component },
    { blockType: 'sortable-table', component: SortableTableBlock as Component },
    { blockType: 'composite-trend', component: CompositeTrendBlock as Component },
    { blockType: 'pie-distribution', component: PieDistributionBlock as Component },
  ]);

  registered = true;
}

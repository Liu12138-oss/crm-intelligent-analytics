<script setup lang="ts">
import { computed } from 'vue';
import ManagementSectionCanvas from '@/components/management-report/ManagementSectionCanvas.vue';
import type {
  AnalysisQueryResult,
  AnalysisReportPayload,
  AnalysisReportSection,
  AnalysisSourceNote,
} from '@/types/analysis';
import type {
  ManagementMetricDefinition,
  ManagementReportBlock,
  ManagementReportMetricCard,
  ManagementReportSectionData,
  ManagementReportTableColumn,
} from '@/types/management-report';
import {
  formatAnalysisCellValue,
  normalizeAnalysisDisplayColumn,
  shouldHideInferredAnalysisColumn,
} from '@/utils/analysis-table-display';

const props = defineProps<{
  report?: AnalysisReportPayload;
  result?: AnalysisQueryResult | null;
}>();

const canvasSection = computed<ManagementReportSectionData | undefined>(() => {
  const report = props.report;
  if (!report || !(report.sections?.length || report.metricCards?.length)) {
    return undefined;
  }

  return {
    sectionKey: 'analysis-shared-report',
    title: report.reportTitle,
    summary: report.executiveSummary,
    state: report.emptyState ? 'empty' : 'ready',
    metricCards: report.metricCards.map<ManagementReportMetricCard>((item) => ({
      key: item.name,
      label: item.name,
      value: String(item.value),
      tone: 'primary',
    })),
    footnotes: report.footnotes ?? [],
    sourceNotes: mapSourceNotes(report.sourceNotes ?? []),
    blocks: report.sections
      .map((section) => mapSectionToBlock(section))
      .filter((item): item is ManagementReportBlock => Boolean(item)),
    emptyReason: report.emptyState,
  };
});

/**
 * 将智能分析口径说明转换为经营报表组件可识别的指标说明。
 * 参数：智能分析来源说明；返回：不暴露底层表字段的展示说明。
 */
function mapSourceNotes(sourceNotes: AnalysisSourceNote[]): ManagementMetricDefinition[] {
  return sourceNotes.map((item) => ({
    key: item.key,
    label: item.label,
    sourceTables: [],
    sourceFields: [],
    timeField: '--',
    aggregation: 'count',
    description: item.description,
  }));
}

/**
 * 将智能分析报告区块映射为通用经营报表区块。
 * 参数：智能分析区块；返回：可复用渲染区块，空数据时返回 undefined。
 */
function mapSectionToBlock(section: AnalysisReportSection): ManagementReportBlock | undefined {
  if (section.sectionType === 'trend') {
    const rows = section.rows ?? [];
    const points = rows
      .map((item) => ({
        label: String(item.bucket_label ?? item.label ?? '--'),
        value: Number(item.amount ?? item.value ?? item.count ?? 0),
      }))
      .filter((item) => Number.isFinite(item.value));

    if (points.length === 0) {
      return undefined;
    }

    return {
      blockId: `analysis-${section.sectionType}-${section.datasetId ?? section.title}`,
      blockType: 'trend',
      title: section.title,
      description: section.description,
      size: 'wide',
      points,
    };
  }

  if (section.sectionType === 'distribution') {
    const rows = section.rows ?? [];
    const rankingRows = rows
      .map((item) => ({
        label: String(item.bucket_label ?? item.label ?? '--'),
        value: Number(item.amount ?? item.value ?? item.count ?? 0),
        secondaryValue:
          item.count !== undefined ? `记录数 ${String(item.count)}` : undefined,
      }))
      .filter((item) => Number.isFinite(item.value));

    if (rankingRows.length === 0) {
      return undefined;
    }

    return {
      blockId: `analysis-${section.sectionType}-${section.datasetId ?? section.title}`,
      blockType: 'bar-ranking',
      title: section.title,
      description: section.description,
      size: 'wide',
      rows: rankingRows,
    };
  }

  if (
    section.sectionType === 'summary' ||
    section.sectionType === 'risk' ||
    section.sectionType === 'focus-list' ||
    section.sectionType === 'actions'
  ) {
    const rows = (section.items ?? (section.summary ? [section.summary] : []))
      .map((item, index) => ({
        label:
          section.sectionType === 'summary'
            ? `摘要${index + 1}`
            : section.sectionType === 'actions'
              ? `建议${index + 1}`
              : `条目${index + 1}`,
        value: item,
      }));

    if (rows.length === 0) {
      return undefined;
    }

    return {
      blockId: `analysis-${section.sectionType}-${section.datasetId ?? section.title}`,
      blockType: 'insight-table',
      title: section.title,
      description: section.description,
      size: section.sectionType === 'summary' ? 'full' : 'compact',
      rows,
    };
  }

  if (section.sectionType === 'detail-table') {
    const rows = section.rows ?? [];
    if (rows.length === 0) {
      return undefined;
    }

    const columns = buildColumns(rows[0]);
    return {
      blockId: `analysis-${section.sectionType}-${section.datasetId ?? section.title}`,
      blockType: 'detail-table',
      title: section.title,
      description: section.description,
      size: 'full',
      columns,
      rows: rows.map((row) =>
        Object.fromEntries(
          columns.map((column) => [column.key, String(formatAnalysisCellValue(row[column.key]))]),
        ),
      ),
    };
  }

  return undefined;
}

/**
 * 根据首行数据生成中文表头，避免报告区详情表直接展示英文 key。
 * 参数：结果行；返回：经营报表表格列定义。
 */
function buildColumns(row: Record<string, unknown>): ManagementReportTableColumn[] {
  return Object.keys(row)
    .filter((key) => !shouldHideInferredAnalysisColumn(key, row))
    .map((key, index) => {
      const normalizedColumn = normalizeAnalysisDisplayColumn({ key, label: '' }, index);
      return {
        key: normalizedColumn.key,
        label: normalizedColumn.label,
      };
    });
}
</script>

<template>
  <ManagementSectionCanvas
    v-if="canvasSection"
    class="analysis-section-canvas"
    :title="canvasSection.title"
    :section="canvasSection"
    empty-text="当前暂无可渲染的共享报告区块。"
  />
</template>

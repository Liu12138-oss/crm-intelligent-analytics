<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  ElButton,
  ElIcon,
  ElPagination,
  ElTable,
  ElTableColumn,
} from 'element-plus';
import BusinessEmptyState from '@/components/shared/BusinessEmptyState.vue';
import ObjectIconLabel from '@/components/shared/ObjectIconLabel.vue';
import NumberToneText from '@/components/analysis/NumberToneText.vue';
import { UiIcons } from '@/ui/icons';
import {
  formatAnalysisCellValue,
  resolveAnalysisDisplayColumns,
  type AnalysisDisplayColumn,
  type NormalizedAnalysisDisplayColumn,
} from '@/utils/analysis-table-display';

const props = defineProps<{
  title?: string;
  rows: Array<Record<string, unknown>>;
  columns?: AnalysisDisplayColumn[];
  exporting?: boolean;
  exportAllowed?: boolean;
  maxRows?: number;
  pageSize?: number;
  transpose?: boolean;
}>();

const emit = defineEmits<{
  export: [];
}>();

const pageSizeOptions = [5, 10, 20, 50];
const currentPage = ref(1);
const currentPageSize = ref(props.pageSize ?? 10);
const transposedLabelColumnWidth = 160;
const transposedValueColumnWidth = 124;

const activePageSize = computed(() => currentPageSize.value);

const cappedRows = computed(() =>
  typeof props.maxRows === 'number' ? props.rows.slice(0, props.maxRows) : props.rows,
);

const displayedRows = computed(() => {
  const startIndex = (currentPage.value - 1) * activePageSize.value;
  return cappedRows.value.slice(startIndex, startIndex + activePageSize.value);
});

const shouldShowPagination = computed(() => cappedRows.value.length > activePageSize.value);

const visibleColumns = computed<NormalizedAnalysisDisplayColumn[]>(() => {
  return resolveAnalysisDisplayColumns(props.columns, cappedRows.value);
});

const transposedDimensionColumn = computed(() => visibleColumns.value[0]);

const transposedMetricColumns = computed(() => visibleColumns.value.slice(1));
const firstColumnKey = computed(() => visibleColumns.value[0]?.key ?? '');

const transposedColumnLabels = computed(() =>
  cappedRows.value.map((row, index) => {
    const dimensionColumn = transposedDimensionColumn.value;
    const dimensionValue = dimensionColumn ? resolveCellValue(row, dimensionColumn.key) : '';
    return dimensionValue === '--' ? `记录${index + 1}` : String(dimensionValue);
  }),
);

const transposedRows = computed(() =>
  transposedMetricColumns.value.map((column) => ({
    key: column.key,
    label: column.label,
    values: cappedRows.value.map((row) => formatTransposedCellValue(row[column.key], column)),
  })),
);

const shouldUseTransposedTable = computed(() =>
  Boolean(props.transpose && cappedRows.value.length > 0 && transposedRows.value.length > 0),
);

const standardTableMinWidth = computed(() =>
  visibleColumns.value.reduce((totalWidth, column) => totalWidth + resolveDisplayColumnWidth(column), 0),
);

const transposedTableMinWidth = computed(
  () =>
    transposedLabelColumnWidth +
    transposedColumnLabels.value.length * transposedValueColumnWidth,
);

watch(
  () => [props.rows.length, props.maxRows],
  () => {
    currentPage.value = 1;
  },
);

watch(
  () => props.pageSize,
  (nextPageSize) => {
    currentPageSize.value = nextPageSize ?? 10;
    currentPage.value = 1;
  },
);

/**
 * 将单元格值转换为面向业务用户的展示文本。
 * 参数：原始行对象和字段 key；返回：中文布尔值、空值兜底或隐藏后的配置编码。
 */
function resolveCellValue(row: Record<string, unknown>, columnKey: string): string | number {
  return formatAnalysisCellValue(row[columnKey], columnKey);
}

/**
 * 格式化转置表格单元格；数值增加千分位，便于跨季度横向扫描。
 * 参数：原始字段值；返回：中文可读文本或格式化数值。
 */
function formatTransposedCellValue(value: unknown, column: NormalizedAnalysisDisplayColumn): string | number {
  const normalized = hasExplicitWanUnitColumn(column)
    ? formatAnalysisCellValue(value)
    : formatAnalysisCellValue(value, column.key);
  if (typeof normalized === 'number') {
    return normalized.toLocaleString('zh-CN');
  }

  return normalized;
}

/**
 * 判断模板是否已经声明当前列为万元口径。
 * 参数：标准化列配置；返回：显式列配置写明万元时为 true。
 * 调用注意：这里只影响转置表格展示，避免模板 SQL 已除以 10000 后又按元级金额二次换算。
 */
function hasExplicitWanUnitColumn(column: NormalizedAnalysisDisplayColumn): boolean {
  return Boolean(
    props.columns?.some(
      (item) =>
        item.key === column.key &&
        typeof item.label === 'string' &&
        item.label.includes('万元'),
    ),
  );
}

/**
 * 解析表格列的实际像素宽度。
 * 参数：已标准化列配置；返回：优先使用模板宽度，否则使用字段语义推导出的最小宽度。
 * 调用注意：这里返回固定宽度，目的是让宽表撑开后交给容器横向滚动，避免列被压缩到数字重叠。
 */
function resolveDisplayColumnWidth(column: NormalizedAnalysisDisplayColumn): number {
  return column.width ?? column.minWidth;
}

/**
 * 判断当前列是否为主对象列；首列增加对象图标，帮助用户快速扫描明细对象。
 * 参数：列配置；返回：是否为当前表格主列。
 */
function isPrimaryDisplayColumn(column: NormalizedAnalysisDisplayColumn): boolean {
  return column.key === firstColumnKey.value;
}

/**
 * 处理分页切换；Element Plus 会传入新的页码，这里只更新本地展示页。
 * 参数：目标页码；返回：无。
 */
function handleCurrentPageChange(nextPage: number): void {
  currentPage.value = nextPage;
}

/**
 * 处理每页条数切换。
 * 参数：Element Plus 分页组件传入的新条数；返回：无。
 * 调用注意：切换条数后回到第一页，避免旧页码在新分页范围内越界导致空表。
 */
function handlePageSizeChange(nextPageSize: number): void {
  currentPageSize.value = nextPageSize;
  currentPage.value = 1;
}
</script>

<template>
  <section class="panel">
    <div class="panel__header">
      <h3 class="table-panel__title">
        <NumberToneText :text="props.title ?? '结果明细'" />
      </h3>
      <el-button
        class="button-secondary analysis-button"
        :disabled="props.exporting || props.exportAllowed === false"
        :loading="props.exporting"
        :aria-busy="props.exporting ? 'true' : 'false'"
        @click="emit('export')"
      >
        <el-icon v-if="!props.exporting">
          <component :is="UiIcons.download" />
        </el-icon>
        {{ props.exporting ? '导出中...' : '导出当前结果' }}
      </el-button>
    </div>
    <div class="panel__body">
      <div
        v-if="shouldUseTransposedTable"
        class="table-wrap table-wrap--transposed"
      >
        <table
          class="transposed-table"
          :style="{
            minWidth: `${transposedTableMinWidth}px`,
            width: `${transposedTableMinWidth}px`,
          }"
        >
          <colgroup>
            <col :style="{ width: `${transposedLabelColumnWidth}px` }">
            <col
              v-for="column in transposedColumnLabels"
              :key="`col-${column}`"
              :style="{ width: `${transposedValueColumnWidth}px` }"
            >
          </colgroup>
          <thead>
            <tr>
              <th>指标</th>
              <th
                v-for="column in transposedColumnLabels"
                :key="column"
              >
                <NumberToneText :text="column" />
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in transposedRows"
              :key="row.key"
            >
              <th>
                <NumberToneText :text="row.label" />
              </th>
              <td
                v-for="(value, index) in row.values"
                :key="`${row.key}-${transposedColumnLabels[index]}`"
              >
                <NumberToneText
                  :text="value"
                  :tone-hint="row.label"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        v-else
        class="table-wrap"
      >
        <el-table
          v-if="displayedRows.length > 0"
          class="table"
          :data="displayedRows"
          :style="{ minWidth: `${standardTableMinWidth}px` }"
          table-layout="fixed"
          stripe
          border
        >
          <el-table-column
            v-for="column in visibleColumns"
            :key="column.key"
            :label="column.label"
            :width="resolveDisplayColumnWidth(column)"
            :min-width="column.minWidth"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <ObjectIconLabel
                v-if="isPrimaryDisplayColumn(column)"
                type="dataTable"
                tone="analysis"
                :label="resolveCellValue(row, column.key)"
              />
              <NumberToneText
                v-else
                :text="resolveCellValue(row, column.key)"
                :tone-hint="column.label"
              />
            </template>
          </el-table-column>
        </el-table>
        <BusinessEmptyState
          v-else
          class="table-panel__empty"
          module="analysis"
          title="当前授权范围内无匹配数据"
          description="可以调整查询条件后重新查询，或回到常用查询选择已有分析模板。"
        />
      </div>
      <div
        v-if="shouldShowPagination && !shouldUseTransposedTable"
        class="table-pagination"
      >
        <span class="table-pagination__summary">
          <NumberToneText :text="`共 ${cappedRows.length} 条，每页 ${activePageSize} 条，当前第 ${currentPage} 页`" />
        </span>
        <el-pagination
          v-model:current-page="currentPage"
          size="small"
          background
          layout="sizes, prev, pager, next"
          :page-size="activePageSize"
          :page-sizes="pageSizeOptions"
          :total="cappedRows.length"
          @current-change="handleCurrentPageChange"
          @size-change="handlePageSizeChange"
        />
      </div>
    </div>
  </section>
</template>

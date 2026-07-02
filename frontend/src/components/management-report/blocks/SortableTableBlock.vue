<script setup lang="ts">
/**
 * 可排序筛选明细表 Block
 *
 * 用 el-table 启用 sortable + filterable，对标案例一全渠道排名表 + 合同明细表、案例二渠道商体系表。
 * 支持搜索、排序、筛选、分页、合计行、排名徽章、金额条。
 */

import { ref, computed } from 'vue';
import { ElTable, ElTableColumn, ElInput, ElPagination } from 'element-plus';
import { Search } from '@element-plus/icons-vue';
import type { ManagementReportSortableTableBlock } from '@/types/management-report';

const props = defineProps<{
  block: ManagementReportSortableTableBlock;
}>();

// 搜索关键字
const searchKeyword = ref('');

// 当前页码
const currentPage = ref(1);

// 分页大小
const pageSize = computed(() => props.block.pageSize ?? 10);

// 过滤后的行数据
const filteredRows = computed(() => {
  if (!searchKeyword.value.trim() || !props.block.searchable) {
    return props.block.rows;
  }
  const keyword = searchKeyword.value.trim().toLowerCase();
  return props.block.rows.filter((row) =>
    Object.values(row).some((val) => String(val).toLowerCase().includes(keyword)),
  );
});

// 分页后的行数据
const pagedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredRows.value.slice(start, start + pageSize.value);
});

// 可筛选列的筛选选项
function buildFilters(columnKey: string) {
  const values = new Set(props.block.rows.map((r) => String(r[columnKey] ?? '')));
  return Array.from(values).map((val) => ({ text: val, value: val }));
}

// 金额列渲染：数值 + 金额条
function formatAmount(row: Record<string, string | number>, columnKey: string): string {
  const val = row[columnKey];
  if (val === undefined || val === null || val === '') return '--';
  const num = Number(val);
  if (!Number.isFinite(num)) return String(val);
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// 排名列渲染
function formatRank(index: number): number {
  return (currentPage.value - 1) * pageSize.value + index + 1;
}

// 金额条宽度百分比
function amountBarWidth(row: Record<string, string | number>, columnKey: string): number {
  const val = Number(row[columnKey]);
  if (!Number.isFinite(val) || val <= 0) return 0;
  const maxVal = Math.max(...props.block.rows.map((r) => Number(r[columnKey]) || 0), 1);
  return Math.min((val / maxVal) * 100, 100);
}

// 搜索时重置页码
function handleSearch() {
  currentPage.value = 1;
}
</script>

<template>
  <div class="sortable-table-block">
    <div v-if="block.title || block.searchable" class="sortable-table-block__head">
      <h3 v-if="block.title">{{ block.title }}</h3>
      <ElInput
        v-if="block.searchable"
        v-model="searchKeyword"
        :placeholder="block.searchPlaceholder ?? '搜索...'"
        :prefix-icon="Search"
        clearable
        class="sortable-table-block__search"
        @input="handleSearch"
      />
    </div>
    <ElTable
      :data="pagedRows"
      stripe
      border
      style="width: 100%"
      :header-cell-style="{ background: '#F7FAFF', color: '#0A2540', fontSize: '13px', fontWeight: 600 }"
      :cell-style="{ fontSize: '14px', color: '#425466' }"
    >
      <ElTableColumn
        v-for="col in block.columns"
        :key="col.key"
        :prop="col.key"
        :label="col.label"
        :sortable="col.sortable ? 'custom' : false"
        :filters="col.filterable ? buildFilters(col.key) : undefined"
        :filter-method="col.filterable ? (value: any, row: any) => String(row[col.key]) === String(value) : undefined"
        :width="col.width"
        :align="col.align ?? 'left'"
      >
        <template #default="scope">
          <!-- 排名列：显示排名徽章 -->
          <span v-if="col.isRank" class="sortable-table-block__rank">{{ formatRank(scope.$index) }}</span>
          <!-- 金额列：数值 + 金额条 -->
          <div v-else-if="col.isAmount" class="sortable-table-block__amount-cell">
            <span class="sortable-table-block__amount-value">{{ formatAmount(scope.row, col.key) }}</span>
            <div class="sortable-table-block__amount-bar">
              <div
                class="sortable-table-block__amount-bar-fill"
                :style="{ width: `${amountBarWidth(scope.row, col.key)}%` }"
              />
            </div>
          </div>
          <!-- 普通列 -->
          <span v-else>{{ scope.row[col.key] ?? '--' }}</span>
        </template>
      </ElTableColumn>
    </ElTable>

    <!-- 合计行 -->
    <div v-if="block.showSummary && block.summaryRow" class="sortable-table-block__summary">
      <span
        v-for="col in block.columns"
        :key="col.key"
        class="sortable-table-block__summary-cell"
        :style="{ textAlign: col.align ?? 'left', width: col.width ?? 'auto' }"
      >
        {{ block.summaryRow[col.key] ?? '' }}
      </span>
    </div>

    <!-- 分页 -->
    <div v-if="filteredRows.length > pageSize" class="sortable-table-block__pagination">
      <ElPagination
        v-model:current-page="currentPage"
        :page-size="pageSize"
        :total="filteredRows.length"
        layout="total, prev, pager, next"
        small
        background
      />
    </div>

    <p v-if="block.description" class="sortable-table-block__desc">{{ block.description }}</p>
  </div>
</template>

<style scoped>
.sortable-table-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sortable-table-block__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.sortable-table-block__head h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  color: #0A2540;
}

.sortable-table-block__search {
  width: 240px;
}

.sortable-table-block__rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  border-radius: 999px;
  background: #EEF4FF;
  color: #635BFF;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.sortable-table-block__amount-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sortable-table-block__amount-value {
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  color: #0A2540;
}

.sortable-table-block__amount-bar {
  height: 4px;
  border-radius: 2px;
  background: #F4F7FB;
  overflow: hidden;
}

.sortable-table-block__amount-bar-fill {
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(90deg, #635BFF, #8BC5FF);
}

.sortable-table-block__summary {
  display: flex;
  gap: 0;
  padding: 10px 12px;
  border-radius: 0 0 8px 8px;
  background: #F7FAFF;
  font-size: 13px;
  font-weight: 600;
  color: #0A2540;
  font-variant-numeric: tabular-nums;
}

.sortable-table-block__summary-cell {
  flex: 1;
  padding: 0 8px;
}

.sortable-table-block__pagination {
  display: flex;
  justify-content: flex-end;
}

.sortable-table-block__desc {
  margin: 0;
  font-size: 12px;
  color: #6B7C93;
  line-height: 1.5;
}
</style>

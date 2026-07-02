<script setup lang="ts">
import NumberToneText from '@/components/analysis/NumberToneText.vue';
import type { ManagementReportDetailTableBlock } from '@/types/management-report';

defineProps<{
  block: ManagementReportDetailTableBlock;
}>();
</script>

<template>
  <section class="detail-table-block">
    <header class="detail-table-block__header">
      <h3>
        <NumberToneText :text="block.title" />
      </h3>
    </header>
    <div class="detail-table-block__scroll">
      <table>
        <thead>
          <tr>
            <th
              v-for="column in block.columns"
              :key="column.key"
            >
              <NumberToneText :text="column.label" />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, rowIndex) in block.rows"
            :key="`${block.blockId}-${rowIndex}`"
          >
            <td
              v-for="column in block.columns"
              :key="column.key"
            >
              <NumberToneText
                :text="row[column.key] ?? '--'"
                :tone-hint="column.label"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.detail-table-block {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 10px;
  height: 100%;
  min-height: 0;
}

.detail-table-block__header h3 {
  margin: 0;
  font-size: 15px;
  color: #0f172a;
}

.detail-table-block__scroll {
  overflow: auto;
  min-height: 0;
  scrollbar-gutter: stable both-edges;
}

.detail-table-block table {
  width: 100%;
  border-collapse: collapse;
  min-width: 480px;
}

.detail-table-block th,
.detail-table-block td {
  padding: 10px 8px;
  border-bottom: 1px solid #e2e8f0;
  text-align: left;
  white-space: nowrap;
}

.detail-table-block th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #f8fbff;
  font-size: 12px;
  color: #64748b;
}

.detail-table-block td {
  font-size: 12px;
  color: #0f172a;
}
</style>

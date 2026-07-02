<script setup lang="ts">
import NumberToneText from '@/components/analysis/NumberToneText.vue';
import type { ManagementReportMatrixTableBlock } from '@/types/management-report';

defineProps<{
  block: ManagementReportMatrixTableBlock;
}>();
</script>

<template>
  <section class="matrix-table-block">
    <header class="matrix-table-block__header">
      <h3>
        <NumberToneText :text="block.title" />
      </h3>
    </header>
    <div class="matrix-table-block__scroll">
      <table>
        <thead>
          <tr>
            <th>维度</th>
            <th
              v-for="column in block.columns"
              :key="column"
            >
              <NumberToneText :text="column" />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in block.rows"
            :key="`${block.blockId}-${row.label}`"
          >
            <td>
              <NumberToneText :text="row.label" />
            </td>
            <td
              v-for="(value, index) in row.values"
              :key="`${row.label}-${block.columns[index]}`"
            >
              <NumberToneText
                :text="value"
                :tone-hint="block.columns[index]"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.matrix-table-block {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 10px;
  height: 100%;
  min-height: 0;
}

.matrix-table-block__header h3 {
  margin: 0;
  font-size: 15px;
  color: #0f172a;
}

.matrix-table-block__scroll {
  overflow: auto;
  min-height: 0;
  scrollbar-gutter: stable both-edges;
}

.matrix-table-block table {
  width: 100%;
  border-collapse: collapse;
  min-width: 640px;
}

.matrix-table-block th,
.matrix-table-block td {
  padding: 10px 8px;
  border-bottom: 1px solid #e2e8f0;
  text-align: left;
  white-space: nowrap;
}

.matrix-table-block th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #f8fbff;
  font-size: 12px;
  color: #64748b;
}

.matrix-table-block td {
  font-size: 12px;
  color: #0f172a;
}
</style>

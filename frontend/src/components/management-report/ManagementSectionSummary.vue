<script setup lang="ts">
import ManagementSectionCanvas from './ManagementSectionCanvas.vue';
import type { ManagementReportSectionData } from '@/types/management-report';

defineProps<{
  title?: string;
  section?: ManagementReportSectionData;
  loading?: boolean;
  emptyText?: string;
}>();
</script>

<template>
  <ManagementSectionCanvas
    :title="title"
    :section="section"
    :loading="loading"
    :empty-text="emptyText"
  />
</template>

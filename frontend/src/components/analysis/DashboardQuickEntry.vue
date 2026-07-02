<script setup lang="ts">
/**
 * 看板快速入口
 *
 * 第 4 期：常用查询区新增"看板"分类
 * 在分析工作台的资产抽屉中展示看板模板，用户可一键生成看板。
 * 与现有固定 SQL 模板并列，但走独立的 dashboard API。
 */

import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { dashboardService } from '@/services/dashboard.service';
import type { DashboardTemplateItem } from '@/services/dashboard.service';
import { toUserFacingErrorMessage } from '@/utils/user-facing-error';

const props = defineProps<{
  /** 是否在抽屉中展示（影响布局） */
  inDrawer?: boolean;
}>();

const emit = defineEmits<{
  /** 看板生成完成，通知父组件展示结果 */
  (event: 'composed', result: unknown): void;
}>();

const templates = ref<DashboardTemplateItem[]>([]);
const loading = ref(false);
const composing = ref(false);

// 分类分组
const groupedTemplates = computed(() => {
  const groups: Record<string, DashboardTemplateItem[]> = {};
  for (const t of templates.value) {
    if (!groups[t.category]) groups[t.category] = [];
    groups[t.category].push(t);
  }
  return groups;
});

const categoryLabels: Record<string, string> = {
  channel: '渠道分析',
  agent: '代理商',
  region: '区域经营',
  owner: '负责人业绩',
};

async function loadTemplates() {
  loading.value = true;
  try {
    const resp = await dashboardService.getTemplates();
    templates.value = resp.code === 0 ? resp.data : [];
  } catch (error) {
    ElMessage.error(toUserFacingErrorMessage(error, '加载看板模板失败'));
  } finally {
    loading.value = false;
  }
}

async function handleRun(template: DashboardTemplateItem) {
  composing.value = true;
  try {
    const resp = await dashboardService.runTemplate(template.templateId, {});
    if (resp.code === 0) {
      emit('composed', resp.data);
      ElMessage.success('看板已生成');
    }
  } catch (error) {
    ElMessage.error(toUserFacingErrorMessage(error, '看板生成失败'));
  } finally {
    composing.value = false;
  }
}

onMounted(() => {
  loadTemplates();
});
</script>

<template>
  <div class="dashboard-quick-entry" :class="{ 'dashboard-quick-entry--drawer': props.inDrawer }">
    <div class="dashboard-quick-entry__head">
      <h3 class="dashboard-quick-entry__title">看板模板</h3>
      <span class="dashboard-quick-entry__hint">一键生成经营看板</span>
    </div>

    <div v-if="loading" class="dashboard-quick-entry__loading">
      正在加载...
    </div>

    <div v-else class="dashboard-quick-entry__groups">
      <div v-for="(items, category) in groupedTemplates" :key="category" class="dashboard-quick-entry__group">
        <div class="dashboard-quick-entry__group-label">{{ categoryLabels[category] ?? category }}</div>
        <div class="dashboard-quick-entry__items">
          <button
            v-for="t in items"
            :key="t.templateId"
            class="dashboard-quick-entry__item"
            :disabled="composing"
            @click="handleRun(t)"
          >
            <span class="dashboard-quick-entry__item-name">{{ t.name }}</span>
            <span class="dashboard-quick-entry__item-desc">{{ t.description }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-quick-entry {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dashboard-quick-entry__head {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.dashboard-quick-entry__title {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  color: #0A2540;
}

.dashboard-quick-entry__hint {
  font-size: 12px;
  color: #6B7C93;
}

.dashboard-quick-entry__loading {
  padding: 20px;
  text-align: center;
  font-size: 13px;
  color: #6B7C93;
}

.dashboard-quick-entry__groups {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dashboard-quick-entry__group-label {
  font-size: 12px;
  font-weight: 500;
  color: #6B7C93;
  margin-bottom: 8px;
}

.dashboard-quick-entry__items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dashboard-quick-entry__item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid #E6EBF1;
  border-radius: 12px;
  background: #FFFFFF;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.dashboard-quick-entry__item:hover {
  border-color: #635BFF;
  background: #F9FBFF;
}

.dashboard-quick-entry__item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dashboard-quick-entry__item-name {
  font-size: 14px;
  font-weight: 500;
  color: #0A2540;
}

.dashboard-quick-entry__item-desc {
  font-size: 12px;
  color: #6B7C93;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

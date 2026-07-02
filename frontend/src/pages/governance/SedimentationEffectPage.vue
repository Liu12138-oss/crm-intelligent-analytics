<script setup lang="ts">
/**
 * 沉淀效果页
 *
 * 学习闭环第 3 层治理入口：展示沉淀器运行报表。
 * - 本周候选生成数、审核通过率
 * - 候选类型分布
 * - 最近沉淀运行记录
 *
 * 遵循 DESIGN.md：
 * - 紧凑页头 + KPI 卡片 + 表格
 * - 不堆叠重复文案
 */

import { computed, onMounted, ref } from 'vue';
import {
  ElButton,
  ElIcon,
  ElMessage,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';
import BusinessVisualAnchor from '@/components/shared/BusinessVisualAnchor.vue';
import {
  sedimentationService,
  type SedimentationEffectStats,
} from '@/services/sedimentation.service';
import { toUserFacingErrorMessage } from '@/utils/user-facing-error';

const stats = ref<SedimentationEffectStats | null>(null);
const loading = ref(false);

const candidateTypeLabel: Record<string, string> = {
  VALIDATED_EXAMPLE: '已验证问法',
  NEGATIVE_EXAMPLE: '高风险问法',
  ALIAS: '别名',
  TEMPORAL_FIELD_HINT: '时间字段提示',
  ORGANIZATION_NORMALIZATION: '组织归一',
};

const approvalRateText = computed(() => {
  if (!stats.value) return '-';
  return (stats.value.approvalRate * 100).toFixed(1) + '%';
});

async function loadStats() {
  loading.value = true;
  try {
    stats.value = await sedimentationService.getEffectStats();
  } catch (error) {
    ElMessage.error(toUserFacingErrorMessage(error, '加载沉淀效果失败'));
  } finally {
    loading.value = false;
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', { hour12: false });
}

const byTypeRows = computed(() => {
  if (!stats.value) return [];
  return Object.entries(stats.value.byType).map(([type, counts]) => ({
    type,
    typeLabel: candidateTypeLabel[type] ?? type,
    ...counts,
  }));
});

onMounted(() => {
  loadStats();
});
</script>

<template>
  <div class="sedimentation-effect-page">
    <header class="sedimentation-effect-page__header">
      <BusinessVisualAnchor module="knowledge-sedimentation" :compact="true" />
      <h2 class="sedimentation-effect-page__title">沉淀效果</h2>
      <div class="sedimentation-effect-page__actions">
        <ElButton :icon="Refresh" size="small" @click="loadStats">
          刷新
        </ElButton>
      </div>
    </header>

    <div v-loading="loading" class="sedimentation-effect-page__body">
      <div v-if="stats" class="kpi-cards">
        <div class="kpi-card kpi-card--proposed">
          <span class="kpi-card__label">待审核候选</span>
          <span class="kpi-card__value">{{ stats.totalProposed }}</span>
        </div>
        <div class="kpi-card kpi-card--approved">
          <span class="kpi-card__label">已通过</span>
          <span class="kpi-card__value">{{ stats.totalApproved }}</span>
        </div>
        <div class="kpi-card kpi-card--rejected">
          <span class="kpi-card__label">已驳回</span>
          <span class="kpi-card__value">{{ stats.totalRejected }}</span>
        </div>
        <div class="kpi-card kpi-card--rate">
          <span class="kpi-card__label">审核通过率</span>
          <span class="kpi-card__value">{{ approvalRateText }}</span>
        </div>
      </div>

      <div v-if="byTypeRows.length > 0" class="sedimentation-effect-page__section">
        <h3 class="sedimentation-effect-page__section-title">候选类型分布</h3>
        <ElTable :data="byTypeRows" stripe size="small" style="width: 100%">
          <ElTableColumn label="类型" prop="typeLabel" min-width="150" />
          <ElTableColumn label="待审核" prop="proposed" width="100" />
          <ElTableColumn label="已通过" prop="approved" width="100" />
          <ElTableColumn label="已驳回" prop="rejected" width="100" />
        </ElTable>
      </div>

      <div v-if="stats && stats.recentRuns.length > 0" class="sedimentation-effect-page__section">
        <h3 class="sedimentation-effect-page__section-title">最近沉淀运行</h3>
        <ElTable :data="stats.recentRuns" stripe size="small" style="width: 100%">
          <ElTableColumn label="运行时间" width="180">
            <template #default="{ row }">
              {{ formatTime(row.runAt) }}
            </template>
          </ElTableColumn>
          <ElTableColumn label="触发方式" width="100">
            <template #default="{ row }">
              <ElTag size="small" :type="row.trigger === 'manual' ? 'warning' : 'info'">
                {{ row.trigger === 'manual' ? '手动' : '定时' }}
              </ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn label="生成候选数" prop="generatedCount" width="120" />
        </ElTable>
      </div>

      <div v-if="!loading && (!stats || (stats.totalProposed === 0 && stats.totalApproved === 0))" class="sedimentation-effect-page__empty">
        <p>暂无沉淀数据。系统运行一段时间并产生足够的查询记录后，沉淀器会自动生成候选知识资产。</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sedimentation-effect-page {
  padding: 16px 24px;
}

.sedimentation-effect-page__header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.sedimentation-effect-page__title {
  font-size: 16px;
  font-weight: 500;
  margin: 0;
  flex: 1;
}

.sedimentation-effect-page__actions {
  display: flex;
  gap: 8px;
}

.kpi-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.kpi-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
}

.kpi-card__label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.kpi-card__value {
  font-size: 28px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.kpi-card--proposed {
  background: var(--el-color-warning-light-9);
}

.kpi-card--approved {
  background: var(--el-color-success-light-9);
}

.kpi-card--rejected {
  background: var(--el-color-info-light-9);
}

.kpi-card--rate {
  background: var(--el-color-primary-light-9);
}

.sedimentation-effect-page__section {
  margin-bottom: 24px;
}

.sedimentation-effect-page__section-title {
  font-size: 14px;
  font-weight: 500;
  margin: 0 0 12px;
}

.sedimentation-effect-page__empty {
  text-align: center;
  padding: 48px 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.sedimentation-effect-page__empty p {
  line-height: 1.8;
}
</style>

<script setup lang="ts">
/**
 * 候选审核页
 *
 * 学习闭环第 3 层治理入口：列出所有 PROPOSED 候选，支持审核通过/驳回。
 * 候选按置信度降序排列，展示证据次数、来源查询、过期时间。
 *
 * 遵循 DESIGN.md：
 * - 紧凑页头 + 表格 + 右侧抽屉详情
 * - 候选状态标签（PROPOSED 琥珀色、ACTIVE 绿色、REJECTED 灰色）
 * - 审核动作放页头右侧同行
 */

import { onMounted, ref } from 'vue';
import {
  ElButton,
  ElDrawer,
  ElIcon,
  ElMessage,
  ElTable,
  ElTableColumn,
  ElTag,
  ElInput,
} from 'element-plus';
import { Check, Close, Refresh, View } from '@element-plus/icons-vue';
import BusinessVisualAnchor from '@/components/shared/BusinessVisualAnchor.vue';
import {
  sedimentationService,
  type KnowledgeCandidateItem,
} from '@/services/sedimentation.service';
import { toUserFacingErrorMessage } from '@/utils/user-facing-error';

const candidates = ref<KnowledgeCandidateItem[]>([]);
const loading = ref(false);
const detailVisible = ref(false);
const selectedCandidate = ref<KnowledgeCandidateItem | null>(null);
const reviewReason = ref('');
const reviewing = ref(false);

const candidateTypeLabel: Record<string, string> = {
  VALIDATED_EXAMPLE: '已验证问法',
  NEGATIVE_EXAMPLE: '高风险问法',
  ALIAS: '别名',
  TEMPORAL_FIELD_HINT: '时间字段提示',
  ORGANIZATION_NORMALIZATION: '组织归一',
};

const reviewStatusTone: Record<string, 'warning' | 'success' | 'info' | 'danger'> = {
  PROPOSED: 'warning',
  ACTIVE: 'success',
  REJECTED: 'info',
  EXPIRED: 'danger',
};

async function loadCandidates() {
  loading.value = true;
  try {
    const result = await sedimentationService.getCandidates();
    candidates.value = result.items;
  } catch (error) {
    ElMessage.error(toUserFacingErrorMessage(error, '加载候选列表失败'));
  } finally {
    loading.value = false;
  }
}

function handleViewDetail(candidate: KnowledgeCandidateItem) {
  selectedCandidate.value = candidate;
  reviewReason.value = '';
  detailVisible.value = true;
}

async function handleReview(action: 'APPROVE' | 'REJECT') {
  if (!selectedCandidate.value) return;
  reviewing.value = true;
  try {
    const result = await sedimentationService.reviewCandidate(
      selectedCandidate.value.id,
      action,
      reviewReason.value || undefined,
    );
    if (result.accepted) {
      ElMessage.success(action === 'APPROVE' ? '候选已审核通过' : '候选已驳回');
      detailVisible.value = false;
      await loadCandidates();
    } else {
      ElMessage.warning('审核失败：' + result.reviewStatus);
    }
  } catch (error) {
    ElMessage.error(toUserFacingErrorMessage(error, '审核操作失败'));
  } finally {
    reviewing.value = false;
  }
}

async function handleRunSedimentation() {
  try {
    const result = await sedimentationService.runSedimentation(24);
    ElMessage.success(`扫描完成，生成 ${result.generatedCandidates.length} 个候选`);
    await loadCandidates();
  } catch (error) {
    ElMessage.error(toUserFacingErrorMessage(error, '手动扫描失败'));
  }
}

function formatConfidence(confidence?: number): string {
  if (confidence === undefined) return '-';
  return (confidence * 100).toFixed(0) + '%';
}

function formatTime(iso?: string): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN', { hour12: false });
}

onMounted(() => {
  loadCandidates();
});
</script>

<template>
  <div class="candidate-review-page">
    <header class="candidate-review-page__header">
      <BusinessVisualAnchor module="knowledge-sedimentation" :compact="true" />
      <h2 class="candidate-review-page__title">候选审核</h2>
      <div class="candidate-review-page__actions">
        <ElButton :icon="Refresh" size="small" @click="loadCandidates">
          刷新
        </ElButton>
        <ElButton type="primary" size="small" @click="handleRunSedimentation">
          手动扫描
        </ElButton>
      </div>
    </header>

    <ElTable
      :data="candidates"
      v-loading="loading"
      stripe
      style="width: 100%"
      :empty-text="'暂无待审核候选'"
    >
      <ElTableColumn label="类型" width="120">
        <template #default="{ row }">
          <ElTag size="small" :type="row.type === 'NEGATIVE_EXAMPLE' ? 'danger' : 'primary'">
            {{ candidateTypeLabel[row.type] ?? row.type }}
          </ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn label="名称" prop="name" min-width="200" show-overflow-tooltip />
      <ElTableColumn label="置信度" width="90">
        <template #default="{ row }">
          {{ formatConfidence(row.confidence) }}
        </template>
      </ElTableColumn>
      <ElTableColumn label="证据数" prop="evidenceCount" width="80" />
      <ElTableColumn label="状态" width="100">
        <template #default="{ row }">
          <ElTag size="small" :type="reviewStatusTone[row.reviewStatus] ?? 'info'">
            {{ row.reviewStatus }}
          </ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn label="生成时间" width="160">
        <template #default="{ row }">
          {{ formatTime(row.proposedAt) }}
        </template>
      </ElTableColumn>
      <ElTableColumn label="过期时间" width="160">
        <template #default="{ row }">
          {{ formatTime(row.expiresAt) }}
        </template>
      </ElTableColumn>
      <ElTableColumn label="操作" width="80" fixed="right">
        <template #default="{ row }">
          <ElButton :icon="View" size="small" link @click="handleViewDetail(row)">
            审核
          </ElButton>
        </template>
      </ElTableColumn>
    </ElTable>

    <ElDrawer
      v-model="detailVisible"
      title="候选详情"
      direction="rtl"
      size="500px"
    >
      <template v-if="selectedCandidate">
        <div class="candidate-detail">
          <ElTable :data="[{ label: '类型', value: candidateTypeLabel[selectedCandidate.type] ?? selectedCandidate.type }, { label: '名称', value: selectedCandidate.name }, { label: '来源', value: selectedCandidate.source === 'AUTO_DERIVED' ? '自动沉淀' : '手工维护' }, { label: '置信度', value: formatConfidence(selectedCandidate.confidence) }, { label: '证据次数', value: selectedCandidate.evidenceCount }, { label: '生成时间', value: formatTime(selectedCandidate.proposedAt) }, { label: '过期时间', value: formatTime(selectedCandidate.expiresAt) }]" :show-header="false" :border="true">
            <ElTableColumn prop="label" width="100" />
            <ElTableColumn prop="value" />
          </ElTable>

          <div v-if="selectedCandidate.questionText" class="candidate-detail__section">
            <h4>示例问题</h4>
            <p>{{ selectedCandidate.questionText }}</p>
          </div>

          <div v-if="selectedCandidate.sqlHint" class="candidate-detail__section">
            <h4>执行提示</h4>
            <p>{{ selectedCandidate.sqlHint }}</p>
          </div>

          <div v-if="selectedCandidate.blockReason" class="candidate-detail__section">
            <h4>阻断原因</h4>
            <p>{{ selectedCandidate.blockReason }}</p>
          </div>

          <div v-if="selectedCandidate.synonyms?.length" class="candidate-detail__section">
            <h4>同义表达</h4>
            <div class="candidate-detail__tags">
              <ElTag v-for="syn in selectedCandidate.synonyms" :key="syn" size="small">
                {{ syn }}
              </ElTag>
            </div>
          </div>

          <div v-if="selectedCandidate.matchKeywords?.length" class="candidate-detail__section">
            <h4>匹配关键词</h4>
            <div class="candidate-detail__tags">
              <ElTag v-for="kw in selectedCandidate.matchKeywords" :key="kw" size="small" type="info">
                {{ kw }}
              </ElTag>
            </div>
          </div>

          <div v-if="selectedCandidate.derivedFromQueryIds?.length" class="candidate-detail__section">
            <h4>来源查询</h4>
            <p class="candidate-detail__query-ids">
              {{ selectedCandidate.derivedFromQueryIds.join('、') }}
            </p>
          </div>

          <div class="candidate-detail__review">
            <h4>审核理由（可选）</h4>
            <ElInput
              v-model="reviewReason"
              type="textarea"
              :rows="2"
              placeholder="填写审核理由，如：问题问法清晰，适合作为正例"
              maxlength="200"
              show-word-limit
            />
            <div class="candidate-detail__review-actions">
              <ElButton
                type="success"
                :icon="Check"
                :loading="reviewing"
                @click="handleReview('APPROVE')"
              >
                审核通过
              </ElButton>
              <ElButton
                type="danger"
                :icon="Close"
                :loading="reviewing"
                @click="handleReview('REJECT')"
              >
                驳回
              </ElButton>
            </div>
          </div>
        </div>
      </template>
    </ElDrawer>
  </div>
</template>

<style scoped>
.candidate-review-page {
  padding: 16px 24px;
}

.candidate-review-page__header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.candidate-review-page__title {
  font-size: 16px;
  font-weight: 500;
  margin: 0;
  flex: 1;
}

.candidate-review-page__actions {
  display: flex;
  gap: 8px;
}

.candidate-detail {
  padding: 0 4px;
}

.candidate-detail__section {
  margin-top: 16px;
}

.candidate-detail__section h4 {
  font-size: 13px;
  font-weight: 500;
  margin: 0 0 8px;
  color: var(--el-text-color-secondary);
}

.candidate-detail__section p {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
}

.candidate-detail__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.candidate-detail__query-ids {
  font-family: monospace;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.candidate-detail__review {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.candidate-detail__review-actions {
  margin-top: 12px;
  display: flex;
  gap: 8px;
}
</style>

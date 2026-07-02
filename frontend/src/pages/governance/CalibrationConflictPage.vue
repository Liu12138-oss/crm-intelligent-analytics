<script setup lang="ts">
/**
 * 口径收敛页
 *
 * 学习闭环第 3 层治理入口：列出所有口径冲突待办，管理员可裁定并收敛。
 * 每条待办展示冲突术语、两种解析、涉及查询、建议收敛方向。
 *
 * 遵循 DESIGN.md：
 * - 紧凑页头 + 表格 + 风险徽标
 * - 冲突待办用风险级别标识优先级
 * - 收敛操作通过弹窗或抽屉完成
 */

import { onMounted, ref } from 'vue';
import {
  ElButton,
  ElDialog,
  ElIcon,
  ElMessage,
  ElTable,
  ElTableColumn,
  ElTag,
  ElInput,
} from 'element-plus';
import { Refresh, WarningFilled } from '@element-plus/icons-vue';
import BusinessVisualAnchor from '@/components/shared/BusinessVisualAnchor.vue';
import {
  sedimentationService,
  type CalibrationConflictItem,
} from '@/services/sedimentation.service';
import { toUserFacingErrorMessage } from '@/utils/user-facing-error';

const conflicts = ref<CalibrationConflictItem[]>([]);
const loading = ref(false);
const resolveDialogVisible = ref(false);
const selectedConflict = ref<CalibrationConflictItem | null>(null);
const resolutionText = ref('');
const resolving = ref(false);

async function loadConflicts() {
  loading.value = true;
  try {
    conflicts.value = await sedimentationService.getCalibrationConflicts();
  } catch (error) {
    ElMessage.error(toUserFacingErrorMessage(error, '加载口径冲突失败'));
  } finally {
    loading.value = false;
  }
}

function handleResolve(conflict: CalibrationConflictItem) {
  selectedConflict.value = conflict;
  resolutionText.value = '';
  resolveDialogVisible.value = true;
}

async function confirmResolve() {
  if (!selectedConflict.value || !resolutionText.value.trim()) {
    ElMessage.warning('请填写收敛说明');
    return;
  }
  resolving.value = true;
  try {
    await sedimentationService.resolveCalibrationConflict(
      selectedConflict.value.conflictId,
      resolutionText.value,
    );
    ElMessage.success('口径冲突已收敛');
    resolveDialogVisible.value = false;
    await loadConflicts();
  } catch (error) {
    ElMessage.error(toUserFacingErrorMessage(error, '收敛操作失败'));
  } finally {
    resolving.value = false;
  }
}

function formatResolutions(resolutions: Record<string, string[]>): string {
  return Object.entries(resolutions)
    .map(([key, ids]) => `${key}（${ids.length}次）`)
    .join(' vs ');
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', { hour12: false });
}

onMounted(() => {
  loadConflicts();
});
</script>

<template>
  <div class="calibration-conflict-page">
    <header class="calibration-conflict-page__header">
      <BusinessVisualAnchor module="knowledge-sedimentation" :compact="true" />
      <h2 class="calibration-conflict-page__title">口径收敛</h2>
      <div class="calibration-conflict-page__actions">
        <ElButton :icon="Refresh" size="small" @click="loadConflicts">
          刷新
        </ElButton>
      </div>
    </header>

    <ElTable
      :data="conflicts"
      v-loading="loading"
      stripe
      style="width: 100%"
      :empty-text="'暂无口径冲突待办'"
    >
      <ElTableColumn label="优先级" width="80">
        <template #default>
          <ElIcon color="#E6A23C" :size="16">
            <WarningFilled />
          </ElIcon>
        </template>
      </ElTableColumn>
      <ElTableColumn label="冲突术语" prop="term" min-width="150" show-overflow-tooltip />
      <ElTableColumn label="解析差异" min-width="250">
        <template #default="{ row }">
          {{ formatResolutions(row.resolutions) }}
        </template>
      </ElTableColumn>
      <ElTableColumn label="涉及查询数" width="100">
        <template #default="{ row }">
          {{ row.queryIds.length }}
        </template>
      </ElTableColumn>
      <ElTableColumn label="检测时间" width="160">
        <template #default="{ row }">
          {{ formatTime(row.detectedAt) }}
        </template>
      </ElTableColumn>
      <ElTableColumn label="状态" width="80">
        <template #default="{ row }">
          <ElTag size="small" :type="row.resolved ? 'success' : 'warning'">
            {{ row.resolved ? '已收敛' : '待处理' }}
          </ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn label="操作" width="80" fixed="right">
        <template #default="{ row }">
          <ElButton
            v-if="!row.resolved"
            size="small"
            type="primary"
            link
            @click="handleResolve(row)"
          >
            收敛
          </ElButton>
        </template>
      </ElTableColumn>
    </ElTable>

    <ElDialog
      v-model="resolveDialogVisible"
      title="收敛口径冲突"
      width="500px"
    >
      <template v-if="selectedConflict">
        <div class="resolve-dialog__info">
          <p><strong>冲突术语：</strong>{{ selectedConflict.term }}</p>
          <p><strong>解析差异：</strong>{{ formatResolutions(selectedConflict.resolutions) }}</p>
          <p><strong>涉及查询：</strong>{{ selectedConflict.queryIds.length }} 条</p>
        </div>
        <div class="resolve-dialog__form">
          <h4>收敛说明</h4>
          <ElInput
            v-model="resolutionText"
            type="textarea"
            :rows="3"
            placeholder="填写收敛方向，如：新增商机统一按创建时间统计"
            maxlength="200"
            show-word-limit
          />
        </div>
      </template>
      <template #footer>
        <ElButton @click="resolveDialogVisible = false">取消</ElButton>
        <ElButton
          type="primary"
          :loading="resolving"
          @click="confirmResolve"
        >
          确认收敛
        </ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
.calibration-conflict-page {
  padding: 16px 24px;
}

.calibration-conflict-page__header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.calibration-conflict-page__title {
  font-size: 16px;
  font-weight: 500;
  margin: 0;
  flex: 1;
}

.calibration-conflict-page__actions {
  display: flex;
  gap: 8px;
}

.resolve-dialog__info {
  margin-bottom: 16px;
}

.resolve-dialog__info p {
  margin: 4px 0;
  font-size: 13px;
  line-height: 1.6;
}

.resolve-dialog__form h4 {
  font-size: 13px;
  font-weight: 500;
  margin: 0 0 8px;
  color: var(--el-text-color-secondary);
}
</style>

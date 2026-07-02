<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { ElButton, ElMessage, ElMessageBox } from 'element-plus';
import AiContextPolicyPanel from '@/components/governance/AiContextPolicyPanel.vue';
import AiProfileSummaryCard from '@/components/governance/AiProfileSummaryCard.vue';
import AiProfileTable from '@/components/governance/AiProfileTable.vue';
import AiProfileFormDrawer from '@/components/governance/AiProfileFormDrawer.vue';
import AiProfileHealthCheckDialog from '@/components/governance/AiProfileHealthCheckDialog.vue';
import { analysisService } from '@/services/analysis.service';
import type {
  AiContextPolicyView,
  AiModelActivationView,
  AiModelHealthCheckResult,
  AiModelProfileItem,
} from '@/types/analysis';
import { toUserFacingErrorMessage } from '@/utils/user-facing-error';

const loading = ref(false);
const saving = ref(false);
const savingContextPolicy = ref(false);
const testing = ref(false);
const drawerVisible = ref(false);
const healthDialogVisible = ref(false);
const profiles = ref<AiModelProfileItem[]>([]);
const activation = ref<AiModelActivationView>({});
const contextPolicy = ref<AiContextPolicyView | null>(null);
const selectedProfile = ref<AiModelProfileItem | null>(null);
const healthCheckResult = ref<AiModelHealthCheckResult | null>(null);
const busyProfileId = ref<string>();
const busyAction = ref<'activate' | 'copy' | 'delete' | 'healthCheck' | null>(null);
const lastDraftHealthCheck = ref<{
  payloadKey: string;
  status: AiModelHealthCheckResult['status'];
} | null>(null);
const operationNotice = ref<{
  tone: 'running' | 'success' | 'error';
  title: string;
  message: string;
} | null>(null);
const AI_MODEL_NOTICE_AUTO_DISMISS_MS = 3000;
let operationNoticeTimer: number | undefined;

const activeProfile = computed(() =>
  profiles.value.find((item) => item.id === activation.value.activeProfileId),
);
const healthDialogLoading = computed(
  () => testing.value || busyAction.value === 'healthCheck',
);
function setOperationNotice(
  tone: 'running' | 'success' | 'error',
  title: string,
  message: string,
): void {
  if (operationNoticeTimer && typeof window !== 'undefined') {
    window.clearTimeout(operationNoticeTimer);
    operationNoticeTimer = undefined;
  }
  operationNotice.value = {
    tone,
    title,
    message,
  };
  if (tone !== 'running' && typeof window !== 'undefined') {
    operationNoticeTimer = window.setTimeout(() => {
      operationNotice.value = null;
      operationNoticeTimer = undefined;
    }, AI_MODEL_NOTICE_AUTO_DISMISS_MS);
  }
}

function beginProfileAction(
  profile: AiModelProfileItem,
  action: 'activate' | 'copy' | 'delete' | 'healthCheck',
  title: string,
  message: string,
): void {
  busyProfileId.value = profile.id;
  busyAction.value = action;
  setOperationNotice('running', title, message);
}

function finishProfileAction(): void {
  busyProfileId.value = undefined;
  busyAction.value = null;
}

async function loadPage() {
  loading.value = true;
  try {
    const [profileResponse, policyResponse] = await Promise.all([
      analysisService.listAiModelProfiles(),
      analysisService.getAiContextPolicy(),
    ]);
    profiles.value = profileResponse.items.filter(
      (item) => item.sdkType === 'openai-compatible-http',
    );
    activation.value = profileResponse.activation;
    contextPolicy.value = policyResponse ?? null;
  } finally {
    loading.value = false;
  }
}

/**
 * 使用稳定序列化结果标记最近一次草稿测试对应的表单快照。
 *
 * 只有“已测试通过且保存时内容未变化”的草稿，才允许在保存后自动回写最近测试状态，
 * 避免把旧测试结果错误套用到新参数上。
 */
function buildDraftPayloadKey(payload: Record<string, unknown>): string {
  return JSON.stringify(payload);
}

function resetDraftHealthCheckState(): void {
  lastDraftHealthCheck.value = null;
}

function openCreateDrawer(): void {
  selectedProfile.value = null;
  resetDraftHealthCheckState();
  drawerVisible.value = true;
}

function openEditDrawer(profile: AiModelProfileItem): void {
  selectedProfile.value = profile;
  resetDraftHealthCheckState();
  drawerVisible.value = true;
}

async function syncSavedProfileHealthCheck(
  profileId: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  if (
    lastDraftHealthCheck.value?.status !== 'SUCCEEDED' ||
    lastDraftHealthCheck.value.payloadKey !== buildDraftPayloadKey(payload)
  ) {
    return false;
  }

  await analysisService.healthCheckAiModelProfile(profileId);
  return true;
}

async function saveProfile(payload: Record<string, unknown>) {
  if (saving.value) {
    return;
  }

  saving.value = true;
  setOperationNotice(
    'running',
    selectedProfile.value ? '正在保存 AI 配置' : '正在创建 AI 配置',
    '系统正在写入配置并刷新当前列表，请稍候。',
  );
  try {
    const savedProfile = selectedProfile.value
      ? await analysisService.updateAiModelProfile(selectedProfile.value.id, payload)
      : await analysisService.createAiModelProfile(payload);
    const persistedHealthCheck = await syncSavedProfileHealthCheck(
      savedProfile.id,
      payload,
    );

    if (selectedProfile.value) {
      ElMessage.success('AI 配置已更新。');
      setOperationNotice(
        'success',
        'AI 配置已更新',
        persistedHealthCheck
          ? '最新配置已保存，最近测试结果已同步到列表。'
          : '最新配置已保存并同步到列表。',
      );
    } else {
      ElMessage.success('AI 配置已创建。');
      setOperationNotice(
        'success',
        'AI 配置已创建',
        persistedHealthCheck
          ? '新配置已保存，最近测试结果已同步到列表。'
          : '新配置已保存，可继续测试或设为生效。',
      );
    }
    drawerVisible.value = false;
    resetDraftHealthCheckState();
    await loadPage();
  } catch (error) {
    const message = toUserFacingErrorMessage(
      error,
      'AI 配置暂时没有保存成功，请检查填写内容后再试；如果仍有问题，请联系管理员。',
    );
    setOperationNotice(
      'error',
      'AI 配置保存失败',
      message,
    );
    ElMessage.error(message);
  } finally {
    saving.value = false;
  }
}

async function copyProfile(profile: AiModelProfileItem) {
  if (busyAction.value) {
    return;
  }

  beginProfileAction(
    profile,
    'copy',
    '正在复制 AI 配置',
    '系统正在生成新的副本，请稍候。',
  );
  try {
    await analysisService.copyAiModelProfile(profile.id);
    ElMessage.success('AI 配置已复制。');
    await loadPage();
    setOperationNotice('success', 'AI 配置已复制', '副本已生成，可继续编辑、测试或删除。');
  } catch (error) {
    const message = toUserFacingErrorMessage(
      error,
      'AI 配置暂时没有复制成功，请稍后重试；如果仍有问题，请联系管理员。',
    );
    setOperationNotice(
      'error',
      'AI 配置复制失败',
      message,
    );
    ElMessage.error(message);
  } finally {
    finishProfileAction();
  }
}

async function deleteProfile(profile: AiModelProfileItem) {
  try {
    await ElMessageBox.confirm(
      `确认删除 AI 配置“${profile.name}”吗？删除后不可恢复。`,
      '删除确认',
      {
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    );
  } catch {
    return;
  }

  beginProfileAction(
    profile,
    'delete',
    '正在删除 AI 配置',
    '系统正在移除该配置并刷新列表，请稍候。',
  );
  try {
    await analysisService.deleteAiModelProfile(profile.id);
    ElMessage.success('AI 配置已删除。');
    await loadPage();
    setOperationNotice('success', 'AI 配置已删除', '该配置已从治理目录移除。');
  } catch (error) {
    const message = toUserFacingErrorMessage(
      error,
      'AI 配置暂时没有删除成功，请稍后重试；如果仍有问题，请联系管理员。',
    );
    setOperationNotice(
      'error',
      'AI 配置删除失败',
      message,
    );
    ElMessage.error(message);
  } finally {
    finishProfileAction();
  }
}

async function clearSecret(profile: AiModelProfileItem) {
  resetDraftHealthCheckState();
  setOperationNotice(
    'running',
    '正在清空已保存密钥',
    '系统正在移除已保存密钥并刷新配置状态。',
  );
  try {
    await analysisService.clearAiModelProfileSecret(profile.id);
    ElMessage.success('AI 密钥已清空。');
    drawerVisible.value = false;
    await loadPage();
    setOperationNotice('success', 'AI 密钥已清空', '后续需重新填写密钥后才能继续测试。');
  } catch (error) {
    const message = toUserFacingErrorMessage(
      error,
      'AI 密钥暂时没有清空成功，请稍后重试；如果仍有问题，请联系管理员。',
    );
    setOperationNotice(
      'error',
      'AI 密钥清空失败',
      message,
    );
    ElMessage.error(message);
  }
}

async function activateProfile(profile: AiModelProfileItem) {
  if (busyAction.value) {
    return;
  }

  beginProfileAction(
    profile,
    'activate',
    '正在切换当前生效配置',
    '系统正在验证目标配置并切换全局当前模型，请稍候。',
  );
  try {
    await analysisService.activateAiModelProfile(profile.id);
    ElMessage.success('当前生效 AI 配置已切换。');
    await loadPage();
    setOperationNotice('success', '当前生效配置已切换', '新的 AI 配置已经成为全局唯一生效项。');
  } catch (error) {
    const message = toUserFacingErrorMessage(
      error,
      'AI 配置暂时没有切换成功，请稍后重试；如果仍有问题，请联系管理员。',
    );
    setOperationNotice(
      'error',
      'AI 配置切换失败',
      message,
    );
    ElMessage.error(message);
  } finally {
    finishProfileAction();
  }
}

async function runHealthCheck(profile: AiModelProfileItem) {
  if (busyAction.value) {
    return;
  }

  beginProfileAction(
    profile,
    'healthCheck',
    '正在测试 AI 配置',
    '系统正在校验服务地址、鉴权和模型连通性，请稍候。',
  );
  healthCheckResult.value = null;
  healthDialogVisible.value = true;
  try {
    healthCheckResult.value = await analysisService.healthCheckAiModelProfile(profile.id);
    await loadPage();
    setOperationNotice('success', 'AI 配置测试完成', '最新测试结果已同步到列表与详情弹层。');
  } catch (error) {
    const message = toUserFacingErrorMessage(
      error,
      'AI 配置暂时没有测试成功，请稍后重试；如果多次失败，请联系管理员。',
    );
    healthCheckResult.value = {
      status: 'FAILED',
      latencyMs: 0,
      failureReason: message,
      providerSummary: profile.providerCode,
    };
    setOperationNotice(
      'error',
      'AI 配置测试失败',
      message,
    );
    ElMessage.error(message);
  } finally {
    finishProfileAction();
  }
}

async function runDraftHealthCheck(payload: Record<string, unknown>) {
  if (testing.value) {
    return;
  }

  testing.value = true;
  healthCheckResult.value = null;
  healthDialogVisible.value = true;
  setOperationNotice(
    'running',
    '正在测试 AI 配置',
    '系统正在校验服务地址、鉴权和模型连通性，请稍候。',
  );
  try {
    healthCheckResult.value = await analysisService.draftHealthCheckAiModelProfile(payload);
    lastDraftHealthCheck.value = {
      payloadKey: buildDraftPayloadKey(payload),
      status: healthCheckResult.value.status,
    };
    ElMessage.success('AI 配置测试完成。');
    setOperationNotice('success', 'AI 配置测试完成', '草稿测试已完成，可继续保存或调整参数。');
    healthDialogVisible.value = true;
  } catch (error) {
    const message = toUserFacingErrorMessage(
      error,
      'AI 配置暂时没有测试成功，请稍后重试；如果多次失败，请联系管理员。',
    );
    resetDraftHealthCheckState();
    healthCheckResult.value = {
      status: 'FAILED',
      latencyMs: 0,
      failureReason: message,
      providerSummary: String(payload.providerCode ?? 'draft'),
    };
    setOperationNotice(
      'error',
      'AI 配置测试失败',
      message,
    );
    ElMessage.error(message);
  } finally {
    testing.value = false;
  }
}

async function saveContextPolicy(payload: Record<string, unknown>) {
  if (savingContextPolicy.value) {
    return;
  }

  savingContextPolicy.value = true;
  setOperationNotice(
    'running',
    '正在保存上下文策略',
    '系统正在更新追问保留、摘要裁剪和会话失活阈值，请稍候。',
  );
  try {
    contextPolicy.value = await analysisService.updateAiContextPolicy(payload);
    ElMessage.success('上下文策略已更新。');
    setOperationNotice(
      'success',
      '上下文策略已更新',
      '新的上下文策略已经写入后台，后续 AI 追问与任务恢复将统一使用最新阈值。',
    );
  } catch (error) {
    const message = toUserFacingErrorMessage(
      error,
      '上下文策略暂时没有保存成功，请稍后重试；如果仍有问题，请联系管理员。',
    );
    setOperationNotice(
      'error',
      '上下文策略保存失败',
      message,
    );
    ElMessage.error(message);
  } finally {
    savingContextPolicy.value = false;
  }
}

onMounted(loadPage);

onBeforeUnmount(() => {
  if (operationNoticeTimer && typeof window !== 'undefined') {
    window.clearTimeout(operationNoticeTimer);
    operationNoticeTimer = undefined;
  }
});
</script>

<template>
  <div class="page governance-page ai-model-page">
    <div class="governance-main-column">
      <AiProfileSummaryCard
        :activation="activation"
        :active-profile="activeProfile"
      />

      <transition name="ai-model-feedback-fade">
        <section
          v-if="operationNotice"
          class="analysis-toast ai-model-feedback"
          :data-tone="operationNotice.tone"
        >
          <div class="analysis-toast__body">
            <strong class="analysis-toast__title">{{ operationNotice.title }}</strong>
            <p class="analysis-toast__content">{{ operationNotice.message }}</p>
            <div
              v-if="operationNotice.tone === 'running'"
              class="ai-model-progress-bar"
            />
          </div>
        </section>
      </transition>

      <section class="panel">
        <div class="panel__header">
          <div>
            <h2 class="table-panel__title">
              模型档案与接入配置
            </h2>
          </div>
          <el-button
            class="button-primary"
            type="primary"
            @click="openCreateDrawer"
          >
            新增 AI 配置
          </el-button>
        </div>
        <div class="panel__body">
          <AiProfileTable
            :items="profiles"
            :activation="activation"
            :loading="loading"
            :busy-profile-id="busyProfileId"
            :busy-action="busyAction"
            @activate="activateProfile"
            @copy="copyProfile"
            @delete="deleteProfile"
            @edit="openEditDrawer"
            @healthCheck="runHealthCheck"
          />
        </div>
      </section>

      <AiContextPolicyPanel
        :policy="contextPolicy"
        :saving="savingContextPolicy"
        @save="saveContextPolicy"
      />
    </div>

    <AiProfileFormDrawer
      v-model:visible="drawerVisible"
      :profile="selectedProfile"
      :saving="saving"
      :testing="testing"
      @save="saveProfile"
      @test="runDraftHealthCheck"
      @clear-secret="clearSecret"
    />
    <AiProfileHealthCheckDialog
      v-model:visible="healthDialogVisible"
      :loading="healthDialogLoading"
      :result="healthCheckResult"
    />
  </div>
</template>

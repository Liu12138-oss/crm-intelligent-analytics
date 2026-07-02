<script setup lang="ts">
import { computed, onActivated, onMounted, reactive, ref } from 'vue';
import {
  ElAlert,
  ElButton,
  ElDescriptions,
  ElDescriptionsItem,
  ElDrawer,
  ElIcon,
  ElPagination,
  ElTable,
  ElTableColumn,
  ElTag,
  ElTimeline,
  ElTimelineItem,
} from 'element-plus';
import { markPageDataReady } from '@/services/navigation-performance.service';
import { useRouter } from 'vue-router';
import BusinessEmptyState from '@/components/shared/BusinessEmptyState.vue';
import ObjectIconLabel from '@/components/shared/ObjectIconLabel.vue';
import { contractReviewService } from '@/services/contract-review.service';
import { useAuthStore } from '@/stores/auth.store';
import type {
  ContractReviewSourceApprovalRecord,
  ContractReviewSourceContractDetail,
  ContractReviewSourceContractSummary,
  ContractReviewTaskSummary,
} from '@/types/contract-review';
import { UiIcons } from '@/ui/icons';
import { resolveFeedbackTone } from '@/ui/status-presentation';
import { toUserFacingErrorMessage } from '@/utils/user-facing-error';

const DEFAULT_PENDING_CONTRACT_PAGE_SIZE = 15;
const PENDING_CONTRACT_PAGE_SIZES = [15, 30, 50];
const SHOW_CONTRACT_UPLOAD_SECTION = false;
const SHOW_RECENT_TASK_SECTION = false;
const CONTRACT_REVIEW_RECENT_TASK_DELAY_MS = 16;

const router = useRouter();
const authStore = useAuthStore();

const pendingContracts = ref<ContractReviewSourceContractSummary[]>([]);
const pendingContractPagination = reactive({
  page: 1,
  pageSize: DEFAULT_PENDING_CONTRACT_PAGE_SIZE,
  total: 0,
});
const detailDrawerVisible = ref(false);
const selectedContractId = ref('');
const selectedContract = ref<ContractReviewSourceContractDetail | null>(null);
const loadingPendingContracts = ref(false);
const loadingContractDetail = ref(false);
const reviewingContractId = ref('');
const feedback = ref('');
const feedbackTone = ref<'info' | 'success' | 'error'>('info');
const recentTasks = ref<ContractReviewTaskSummary[]>([]);
const loadingRecentTasks = ref(false);
const recentTasksHydrated = ref(false);
const uploadInputRef = ref<HTMLInputElement | null>(null);

const workspaceAllowed = computed(
  () => authStore.capabilities?.contractWorkspaceAllowed ?? false,
);
const reviewAllowed = computed(
  () => authStore.capabilities?.contractPermissions.uploadAllowed ?? false,
);
const hasPendingContracts = computed(() => pendingContracts.value.length > 0);
const hasRecentTasks = computed(() => recentTasks.value.length > 0);
let deferredRecentTasksTimer: number | undefined;
let recentTasksPromise: Promise<void> | null = null;

/**
 * 统一写入页面反馈，避免不同异步动作各自维护提示状态。
 *
 * @param tone 提示类型
 * @param message 面向用户展示的提示文案
 * @returns 无返回值
 */
function setFeedback(
  tone: 'info' | 'success' | 'error',
  message: string,
): void {
  feedbackTone.value = tone;
  feedback.value = message;
}

/**
 * 清空当前选中的合同详情，确保抽屉关闭后列表不会残留高亮状态。
 *
 * @returns 无返回值
 */
function clearSelectedContract(): void {
  selectedContractId.value = '';
  selectedContract.value = null;
}

/**
 * 响应详情抽屉开关，关闭时同步清空当前详情。
 *
 * @param visible 抽屉是否显示
 * @returns 无返回值
 */
function handleDetailDrawerVisibleChange(visible: boolean): void {
  detailDrawerVisible.value = visible;

  if (!visible) {
    clearSelectedContract();
  }
}

/**
 * 加载 CRM 待审批合同列表，并尽量保留当前已缓存的详情记录。
 *
 * @returns 无返回值
 */
async function loadPendingContracts(): Promise<void> {
  if (!workspaceAllowed.value) {
    pendingContracts.value = [];
    pendingContractPagination.page = 1;
    pendingContractPagination.total = 0;
    detailDrawerVisible.value = false;
    clearSelectedContract();
    setFeedback('error', '当前账号无权访问合同审核工作台。');
    return;
  }

  loadingPendingContracts.value = true;
  try {
    const response = await contractReviewService.listPendingApprovalContracts(
      pendingContractPagination.page,
      pendingContractPagination.pageSize,
    );
    pendingContracts.value = response.items;
    pendingContractPagination.page = response.page;
    pendingContractPagination.pageSize = response.pageSize;
    pendingContractPagination.total = response.total;

    if (response.total > 0 && response.items.length === 0 && response.page > 1) {
      pendingContractPagination.page = response.page - 1;
      await loadPendingContracts();
      return;
    }

    if (response.items.length === 0) {
      detailDrawerVisible.value = false;
      clearSelectedContract();
      feedback.value = '';
      return;
    }

    const nextContractId = response.items.some(
      (item) => item.contractId === selectedContractId.value,
    )
      ? selectedContractId.value
      : response.items[0].contractId;

    feedback.value = '';
    await selectContract(nextContractId, false);
    markPageDataReady('/contract-review');
  } catch (error) {
    pendingContracts.value = [];
    pendingContractPagination.page = 1;
    pendingContractPagination.total = 0;
    detailDrawerVisible.value = false;
    clearSelectedContract();
    setFeedback(
      'error',
      toUserFacingErrorMessage(
        error,
        '合同列表暂时没有加载成功，请稍后刷新重试；如果多次失败，请联系管理员。',
      ),
    );
  } finally {
    loadingPendingContracts.value = false;
  }
}

function scheduleRecentTasksLoad(force = false): void {
  if (typeof window === 'undefined') {
    void loadRecentTasks(force);
    return;
  }

  if (deferredRecentTasksTimer) {
    window.clearTimeout(deferredRecentTasksTimer);
  }

  if (!force && recentTasksHydrated.value) {
    return;
  }

  deferredRecentTasksTimer = window.setTimeout(() => {
    deferredRecentTasksTimer = undefined;
    void loadRecentTasks(force);
  }, CONTRACT_REVIEW_RECENT_TASK_DELAY_MS);
}

/**
 * 加载最近审核任务，兼容上传补录入口与 CRM 来源入口共用同一最近任务面板。
 *
 * @returns 无返回值
 */
async function loadRecentTasks(force = false): Promise<void> {
  if (!force && recentTasksHydrated.value) {
    return;
  }
  if (recentTasksPromise) {
    return recentTasksPromise;
  }

  loadingRecentTasks.value = true;
  recentTasksPromise = (async () => {
    try {
      const response = await contractReviewService.listRecentTasks();
      recentTasks.value = response.items;
      recentTasksHydrated.value = true;
    } catch (error) {
      recentTasks.value = [];
      setFeedback(
        'error',
        toUserFacingErrorMessage(
          error,
          '最近审核任务暂时没有加载成功，请稍后重试；如果多次失败，请联系管理员。',
        ),
      );
    } finally {
      loadingRecentTasks.value = false;
      recentTasksPromise = null;
    }
  })();

  return recentTasksPromise;
}

/**
 * 读取指定合同的 CRM 快照详情，并按需打开详情抽屉。
 *
 * @param contractId CRM 合同主键
 * @param openDrawer 是否在读取前打开抽屉
 * @returns 无返回值
 */
async function selectContract(
  contractId: string,
  openDrawer = true,
): Promise<void> {
  if (!contractId) {
    return;
  }

  if (openDrawer) {
    detailDrawerVisible.value = true;
  }

  if (selectedContractId.value === contractId && selectedContract.value) {
    return;
  }

  selectedContractId.value = contractId;
  loadingContractDetail.value = true;
  try {
    selectedContract.value =
      await contractReviewService.getPendingApprovalContractDetail(contractId);
  } catch (error) {
    selectedContract.value = null;
    setFeedback(
      'error',
      toUserFacingErrorMessage(
        error,
        '合同详情暂时没有加载成功，请稍后重试；如果多次失败，请联系管理员。',
      ),
    );
  } finally {
    loadingContractDetail.value = false;
  }
}

/**
 * 响应表格行点击，复用统一的详情读取逻辑。
 *
 * @param row 当前点击的合同摘要
 * @returns 无返回值
 */
async function handleContractRowClick(
  row: ContractReviewSourceContractSummary,
): Promise<void> {
  await selectContract(row.contractId);
}

/**
 * 切换分页页码，仅调整当前表格视图，不重置已缓存详情。
 *
 * @param nextPage 目标页码
 * @returns 无返回值
 */
async function handlePendingContractPageChange(nextPage: number): Promise<void> {
  if (pendingContractPagination.page === nextPage) {
    return;
  }

  pendingContractPagination.page = nextPage;
  await loadPendingContracts();
}

/**
 * 调整每页条数时回到第一页，避免切换后出现空页。
 *
 * @param nextPageSize 新的每页条数
 * @returns 无返回值
 */
async function handlePendingContractPageSizeChange(nextPageSize: number): Promise<void> {
  if (pendingContractPagination.pageSize === nextPageSize) {
    return;
  }

  pendingContractPagination.pageSize = nextPageSize;
  pendingContractPagination.page = 1;
  await loadPendingContracts();
}

/**
 * 基于 CRM 合同记录发起审核任务，并跳转到审核详情页。
 *
 * @param contractId CRM 合同主键
 * @returns 无返回值
 */
async function startReview(contractId: string): Promise<void> {
  if (reviewingContractId.value) {
    return;
  }

  if (!reviewAllowed.value) {
    setFeedback('error', '当前账号仅支持查看，不能发起合同审核。');
    return;
  }

  reviewingContractId.value = contractId;
  try {
    const created = await contractReviewService.createTaskFromContract(contractId);
    await router.push({
      name: 'contract-review-detail',
      params: { taskId: created.taskId },
    });
  } catch (error) {
    setFeedback(
      'error',
      toUserFacingErrorMessage(
        error,
        '合同审核暂时没有发起成功，请稍后重试；如果多次失败，请联系管理员。',
      ),
    );
  } finally {
    reviewingContractId.value = '';
  }
}

/**
 * 触发兼容补录上传文件选择，仅作为 CRM 主流程之外的次级入口。
 *
 * @returns 无返回值
 */
function triggerUpload(): void {
  uploadInputRef.value?.click();
}

/**
 * 处理兼容补录合同上传，非法文件直接阻断；成功后刷新最近任务并跳转详情页。
 *
 * @param event 文件选择事件
 * @returns 无返回值
 */
async function handleUploadChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0];
  if (!file) {
    return;
  }

  const isDocxMime =
    file.type ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const isDocxName = /\.docx$/iu.test(file.name);
  if (!isDocxMime && !isDocxName) {
    setFeedback('error', '当前仅支持上传 .docx 合同文件。');
    if (input) {
      input.value = '';
    }
    return;
  }

  try {
    const created = await contractReviewService.uploadContract(file);
    recentTasksHydrated.value = false;
    await loadRecentTasks(true);
    setFeedback('info', '合同已上传，正在进入审核详情页。');
    await router.push({
      name: 'contract-review-detail',
      params: { taskId: created.taskId },
    });
  } catch (error) {
    setFeedback(
      'error',
      toUserFacingErrorMessage(
        error,
        '合同上传暂时没有成功，请检查文件后重试；如果仍有问题，请联系管理员。',
      ),
    );
  } finally {
    if (input) {
      input.value = '';
    }
  }
}

/**
 * 将执行模式翻译为详情列表可读文案。
 *
 * @param mode 审核执行模式
 * @returns 中文模式文案
 */
function formatExecutionModeLabel(mode?: string): string {
  if (mode === 'AI_HYBRID') {
    return 'AI 规则提示词审核';
  }
  if (mode === 'DETERMINISTIC_ONLY') {
    return '规则快审';
  }
  if (mode === 'BLOCKED') {
    return '审核阻断';
  }
  return '待确认';
}

/**
 * 统一格式化合同金额，保证列表和详情展示口径一致。
 *
 * @param amount 合同金额
 * @returns 人民币格式化文本
 */
function formatAmount(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * 格式化时间字段，缺失时回退为统一占位文案。
 *
 * @param dateText ISO 时间字符串
 * @returns 页面可读时间文本
 */
function formatTimeLabel(dateText?: string): string {
  if (!dateText) {
    return '未提供';
  }

  return new Date(dateText).toLocaleString('zh-CN', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 将审批状态和待审级次拼接为更易理解的标签文本。
 *
 * @param status CRM 返回的审批状态
 * @param pendingStep 当前待审级次
 * @returns 适合标签展示的状态文案
 */
function formatApprovalStatusLabel(status: string, pendingStep: number): string {
  const normalizedStatus = status.trim();

  // CRM 部分环境会返回数字状态码，这里统一翻译为业务可读文案。
  if (/^\d+$/.test(normalizedStatus)) {
    if (pendingStep > 0) {
      return `待审批 / 第 ${pendingStep} 级`;
    }

    if (normalizedStatus === '0') {
      return '无待审批级次';
    }

    return `审批状态 ${normalizedStatus}`;
  }

  if (pendingStep > 0) {
    return `${normalizedStatus} / 第 ${pendingStep} 级`;
  }

  return normalizedStatus;
}

/**
 * 拼接审批历史摘要，避免历史记录展示过于碎片化。
 *
 * @param approval 单条审批记录
 * @returns 审批历史摘要文本
 */
function formatApprovalTimeline(
  approval: ContractReviewSourceApprovalRecord,
): string {
  const parts = [
    `第 ${approval.step} 步审批`,
    approval.approverName ?? approval.approverId ?? '未提供审批人',
    approval.status,
  ];

  if (approval.approveAt) {
    parts.push(formatTimeLabel(approval.approveAt));
  }

  return parts.join(' / ');
}

/**
 * 页面挂载后加载待审批合同列表。
 *
 * @returns 无返回值
 */
onMounted(async () => {
  await loadPendingContracts();
});

onActivated(() => {
  if (!loadingPendingContracts.value && hasPendingContracts.value) {
    markPageDataReady('/contract-review');
  }

  if (SHOW_RECENT_TASK_SECTION && !loadingRecentTasks.value && !recentTasksHydrated.value) {
    scheduleRecentTasksLoad();
  }
});
</script>

<template>
  <div class="page contract-review-page">
    <div class="contract-workbench-layout contract-workbench-layout--drawer">
      <div class="contract-main-column">
        <section class="panel contract-recent-panel">
          <div class="panel__header contract-recent-panel__header">
            <div>
              <h3>CRM合同列表</h3>
              <p>从 CRM 待审批合同中选择目标记录，直接发起合同审核任务。</p>
            </div>
            <el-button
              class="button-secondary"
              :loading="loadingPendingContracts"
              @click="loadPendingContracts"
            >
              <el-icon>
                <component :is="UiIcons.refresh" />
              </el-icon>
              查询
            </el-button>
          </div>

          <div class="panel__body contract-recent-panel__body contract-pending-panel__body">
            <el-alert
              v-if="feedback"
              class="contract-review-feedback"
              :data-tone="resolveFeedbackTone(feedbackTone)"
              :type="feedbackTone === 'error' ? 'error' : feedbackTone === 'success' ? 'success' : 'info'"
              :closable="false"
              show-icon
            >
              {{ feedback }}
            </el-alert>

            <el-alert
              v-if="workspaceAllowed && !reviewAllowed"
              class="contract-review-feedback"
              type="warning"
              data-tone="warning"
              :closable="false"
              show-icon
            >
              当前账号仅支持查看 CRM 待审批合同，不能发起合同审核。
            </el-alert>

            <div class="contract-pending-region">
              <div
                v-if="loadingPendingContracts && !hasPendingContracts"
              >
                <BusinessEmptyState
                  module="contract"
                  title="正在加载 CRM 合同列表"
                  description="系统正在读取当前权限范围内的待审批合同，请稍候。"
                />
              </div>
              <div
                v-else-if="!hasPendingContracts"
              >
                <BusinessEmptyState
                  module="contract"
                  title="当前没有可展示的 CRM 待审批合同"
                  description="可以点击查询刷新列表，或确认当前账号是否具备合同审核工作台权限。"
                  action-text="查询"
                  @action="loadPendingContracts"
                />
              </div>

              <div
                v-else
                class="contract-pending-table-shell"
              >
                <el-table
                  :data="pendingContracts"
                  data-test="pending-contract-table"
                  row-key="contractId"
                  :current-row-key="selectedContractId"
                  class="contract-pending-table"
                  height="100%"
                  highlight-current-row
                  stripe
                  @row-click="handleContractRowClick"
                >
                  <el-table-column
                    prop="contractName"
                    label="合同名称"
                    min-width="260"
                  >
                    <template #default="{ row }">
                      <div class="contract-name-cell">
                        <ObjectIconLabel
                          type="contract"
                          tone="contract"
                          :label="row.contractName"
                          :description="row.contractCode || '未提供合同编号'"
                        />
                      </div>
                    </template>
                  </el-table-column>

                  <el-table-column
                    prop="customerName"
                    label="客户"
                    min-width="180"
                  >
                    <template #default="{ row }">
                      {{ row.customerName || '未提供' }}
                    </template>
                  </el-table-column>

                  <el-table-column
                    prop="ownerName"
                    label="负责人"
                    width="140"
                  />

                  <el-table-column
                    prop="totalAmount"
                    label="合同金额"
                    min-width="160"
                  >
                    <template #default="{ row }">
                      {{ formatAmount(row.totalAmount) }}
                    </template>
                  </el-table-column>

                  <el-table-column
                    prop="submitApplyingAt"
                    label="提交审批时间"
                    min-width="180"
                  >
                    <template #default="{ row }">
                      {{ formatTimeLabel(row.submitApplyingAt) }}
                    </template>
                  </el-table-column>

                  <el-table-column
                    label="审批状态"
                    min-width="180"
                  >
                    <template #default="{ row }">
                      <el-tag
                        class="badge"
                        type="warning"
                        round
                      >
                        {{ formatApprovalStatusLabel(row.approveStatus, row.pendingStep) }}
                      </el-tag>
                    </template>
                  </el-table-column>

                  <el-table-column
                    label="操作"
                    width="220"
                    fixed="right"
                    class-name="table-action-column"
                  >
                    <template #default="{ row }">
                      <div class="contract-table-actions table-action-buttons">
                        <el-button
                          class="button-secondary"
                          size="small"
                          @click.stop="selectContract(row.contractId)"
                        >
                          查看详情
                        </el-button>
                        <el-button
                          class="button-primary"
                          type="primary"
                          size="small"
                          :loading="reviewingContractId === row.contractId"
                          :disabled="!reviewAllowed && reviewingContractId !== row.contractId"
                          @click.stop="startReview(row.contractId)"
                        >
                          发起审核
                        </el-button>
                      </div>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </div>

            <div
              v-if="hasPendingContracts"
              class="contract-table-pagination"
            >
              <el-pagination
                background
                layout="total, sizes, prev, pager, next"
                :current-page="pendingContractPagination.page"
                :page-size="pendingContractPagination.pageSize"
                :page-sizes="PENDING_CONTRACT_PAGE_SIZES"
                :total="pendingContractPagination.total"
                @current-change="handlePendingContractPageChange"
                @size-change="handlePendingContractPageSizeChange"
              />
            </div>
          </div>
        </section>

        <section
          v-if="SHOW_CONTRACT_UPLOAD_SECTION"
          class="panel contract-upload-card"
        >
          <div class="panel__header">
            <div class="contract-upload-card__copy">
              <h3>兼容补录上传</h3>
              <p>若当前合同不在 CRM 待审批列表中，可补录上传 `.docx` 合同继续审核。</p>
            </div>
            <el-button
              class="button-secondary contract-upload-card__button"
              @click="triggerUpload"
            >
              <el-icon>
                <component :is="UiIcons.upload" />
              </el-icon>
              上传合同
            </el-button>
            <input
              ref="uploadInputRef"
              class="contract-upload-card__input"
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              @change="handleUploadChange"
            >
          </div>
        </section>

        <section
          v-if="SHOW_RECENT_TASK_SECTION"
          class="panel contract-recent-panel"
        >
          <div class="panel__header contract-recent-panel__header">
            <div>
              <h3>最近审核任务</h3>
              <p>兼容补录上传与 CRM 来源任务会统一沉淀到这里，便于继续查看。</p>
            </div>
            <el-button
              class="button-secondary"
              :loading="loadingRecentTasks"
              @click="loadRecentTasks(true)"
            >
              <el-icon>
                <component :is="UiIcons.refresh" />
              </el-icon>
              查询
            </el-button>
          </div>
          <div class="panel__body panel__body--stack">
            <div
              v-if="loadingRecentTasks && !hasRecentTasks"
              class="contract-empty-state"
            >
              正在加载最近审核任务...
            </div>
            <div
              v-else-if="!hasRecentTasks"
              class="contract-empty-state"
            >
              当前暂无最近审核任务。
            </div>
            <template v-else>
              <article
                v-for="task in recentTasks"
                :key="task.taskId"
                class="contract-task-card"
              >
                <div class="contract-task-card__top">
                  <div>
                    <h4>{{ task.contractName }}</h4>
                    <p>{{ task.latestResultSummary }}</p>
                  </div>
                  <el-tag
                    class="badge"
                    type="info"
                    round
                  >
                    {{ formatExecutionModeLabel(task.reviewBasis?.executionMode) }}
                  </el-tag>
                </div>
                <p class="contract-task-card__meta">
                  审核标准 v{{ task.reviewBasis?.packVersion || '--' }}
                </p>
              </article>
            </template>
          </div>
        </section>
      </div>
    </div>

    <el-drawer
      :model-value="detailDrawerVisible"
      class="contract-detail-drawer"
      direction="rtl"
      size="680px"
      title="合同详情"
      :destroy-on-close="true"
      :teleported="false"
      @update:model-value="handleDetailDrawerVisibleChange"
    >
      <div class="contract-detail-drawer__body">
        <section class="panel">
          <div class="panel__header">
            <div>
              <h3 class="table-panel__title">合同详情</h3>
              <p>点击合同名称后，可查看该合同在 CRM 中的快照信息。</p>
            </div>
          </div>

          <div class="panel__body panel__body--stack">
            <div
              v-if="loadingContractDetail"
              class="contract-empty-state"
            >
              正在加载合同详情...
            </div>

            <template v-else-if="selectedContract">
              <section class="contract-detail-summary">
                <strong>{{ selectedContract.contractName }}</strong>
                <span>{{ selectedContract.sourceSummary }}</span>
              </section>

              <el-descriptions
                :column="1"
                border
              >
                <el-descriptions-item label="合同编号">
                  {{ selectedContract.contractCode || '未提供' }}
                </el-descriptions-item>
                <el-descriptions-item label="客户名称">
                  {{ selectedContract.customerName || '未提供' }}
                </el-descriptions-item>
                <el-descriptions-item label="商机名称">
                  {{ selectedContract.opportunityTitle || '未提供' }}
                </el-descriptions-item>
                <el-descriptions-item label="负责人">
                  {{ selectedContract.ownerName }}
                </el-descriptions-item>
                <el-descriptions-item label="所属部门">
                  {{ selectedContract.departmentName || '未提供' }}
                </el-descriptions-item>
                <el-descriptions-item label="合同金额">
                  {{ formatAmount(selectedContract.totalAmount) }}
                </el-descriptions-item>
                <el-descriptions-item label="签订日期">
                  {{ formatTimeLabel(selectedContract.signDate) }}
                </el-descriptions-item>
                <el-descriptions-item label="合同周期">
                  {{ formatTimeLabel(selectedContract.startAt) }} 至 {{ formatTimeLabel(selectedContract.endAt) }}
                </el-descriptions-item>
                <el-descriptions-item label="客户签约人">
                  {{ selectedContract.customerSigner || '未提供' }}
                </el-descriptions-item>
                <el-descriptions-item label="我方签约人">
                  {{ selectedContract.ourSigner || '未提供' }}
                </el-descriptions-item>
                <el-descriptions-item label="提交审批时间">
                  {{ formatTimeLabel(selectedContract.submitApplyingAt) }}
                </el-descriptions-item>
                <el-descriptions-item label="审批备注">
                  {{ selectedContract.approvalComment || '未提供' }}
                </el-descriptions-item>
              </el-descriptions>

              <section
                class="contract-detail-section"
                data-test="contract-special-terms"
              >
                <header class="contract-detail-section__header">
                  <strong>特殊条款</strong>
                  <span>优先核对服务期限、付款条件、交付物和权责边界。</span>
                </header>
                <p
                  v-if="selectedContract.specialTermBlocks.length === 0"
                  class="contract-detail-muted"
                >
                  未提供特殊条款。
                </p>
                <ul
                  v-else
                  class="contract-special-terms"
                >
                  <li
                    v-for="(block, index) in selectedContract.specialTermBlocks"
                    :key="`${selectedContract.contractId}-term-${index}`"
                  >
                    {{ block }}
                  </li>
                </ul>
              </section>

              <section class="contract-detail-section">
                <header class="contract-detail-section__header">
                  <strong>审批历史</strong>
                  <span>按 CRM 审批顺序展示审批人、状态、时间和备注。</span>
                </header>
                <p
                  v-if="selectedContract.approvalHistory.length === 0"
                  class="contract-detail-muted"
                >
                  暂无审批历史。
                </p>
                <el-timeline
                  v-else
                  class="contract-approval-timeline"
                >
                  <el-timeline-item
                    v-for="(approval, index) in selectedContract.approvalHistory"
                    :key="`${selectedContract.contractId}-approval-${index}`"
                    type="primary"
                    hollow
                    :timestamp="approval.approveAt ? formatTimeLabel(approval.approveAt) : undefined"
                    placement="top"
                  >
                    <article class="contract-approval-timeline__item">
                      <strong>{{ formatApprovalTimeline(approval) }}</strong>
                      <span>{{ approval.comment || '未提供审批备注' }}</span>
                    </article>
                  </el-timeline-item>
                </el-timeline>
              </section>
            </template>

            <BusinessEmptyState
              v-else
              module="contract"
              title="点击合同名称查看合同详情"
              description="合同详情会展示 CRM 快照、特殊条款、审批信息和发起审核入口。"
            />
          </div>
        </section>

        <section class="panel">
          <div class="panel__header">
            <div>
              <h3 class="table-panel__title">审核说明</h3>
            </div>
          </div>
          <div class="panel__body">
            <ol
              class="contract-audit-steps"
              data-test="contract-audit-steps"
            >
              <li data-test="contract-audit-step">
                <span>1</span>
                <div>
                  <strong>先看合同信息</strong>
                  <p>先核对合同字段、特殊条款和审批备注，确认 CRM 快照是否完整。</p>
                </div>
              </li>
              <li data-test="contract-audit-step">
                <span>2</span>
                <div>
                  <strong>再发起审核</strong>
                  <p>确认无误后点击“发起审核”，系统会直接创建任务并跳转到详情页。</p>
                </div>
              </li>
              <li data-test="contract-audit-step">
                <span>3</span>
                <div>
                  <strong>在详情页看结果</strong>
                  <p>风险结论、问题明细和产物下载都在审核详情页统一查看。</p>
                </div>
              </li>
            </ol>
          </div>
        </section>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  ElAlert,
  ElButton,
  ElIcon,
  ElTag,
} from 'element-plus';
import { useRoute, useRouter } from 'vue-router';
import RiskLevelBadge from '@/components/shared/RiskLevelBadge.vue';
import { contractReviewService } from '@/services/contract-review.service';
import type {
  ContractReviewArtifact,
  ContractReviewExecutionMode,
  ContractReviewTaskDetail,
} from '@/types/contract-review';
import { UiIcons } from '@/ui/icons';
import {
  resolveContractReviewStatusIcon,
  resolveContractReviewStatusTone,
  toStatusToneClass,
} from '@/ui/status-presentation';
import { toUserFacingErrorMessage } from '@/utils/user-facing-error';

const route = useRoute();
const router = useRouter();
const detail = ref<ContractReviewTaskDetail | null>(null);
const loading = ref(false);
const feedback = ref('');
const expandedIssueIds = ref<string[]>([]);
let pollTimer: number | null = null;

const taskId = computed(() => String(route.params.taskId ?? ''));
const issues = computed(() => detail.value?.issues ?? []);
const vetoIssues = computed(() => issues.value.filter((issue) => issue.isVeto));
const riskIssues = computed(() => issues.value.filter((issue) => !issue.isVeto));
const reviewBasis = computed(() => detail.value?.reviewBasis);
const displayVetoCount = computed(() =>
  issues.value.length > 0 ? vetoIssues.value.length : (detail.value?.vetoCount ?? 0),
);
const displayHighRiskCount = computed(() =>
  issues.value.length > 0
    ? riskIssues.value.filter((issue) => issue.riskLevel === 'HIGH').length
    : (detail.value?.highRiskCount ?? 0),
);
const displayMediumRiskCount = computed(() =>
  issues.value.length > 0
    ? riskIssues.value.filter((issue) => issue.riskLevel === 'MEDIUM').length
    : (detail.value?.mediumRiskCount ?? 0),
);
const displayLowRiskCount = computed(() =>
  issues.value.length > 0
    ? riskIssues.value.filter((issue) => issue.riskLevel === 'LOW').length
    : (detail.value?.lowRiskCount ?? 0),
);
const processing = computed(() =>
  ['UPLOADED', 'PARSING', 'REVIEWING', 'GENERATING_REPORT'].includes(detail.value?.status ?? ''),
);
const supplementalReviewRunning = computed(() =>
  ['PENDING', 'RUNNING'].includes(detail.value?.supplementalReviewStatus ?? '') &&
  detail.value?.status === 'COMPLETED',
);
const supplementalReviewFailed = computed(
  () => detail.value?.supplementalReviewStatus === 'FAILED',
);
const pollingNeeded = computed(
  () => processing.value || supplementalReviewRunning.value,
);
const reportArtifact = computed(() =>
  detail.value?.artifacts.find((artifact) => artifact.artifactType === 'REPORT'),
);
const reviewBasisItems = computed(() => {
  if (!detail.value || !reviewBasis.value) {
    return [];
  }

  return [
    `审核标准：${detail.value.ruleSet.title} v${reviewBasis.value.packVersion}`,
    `执行模式：${resolveExecutionModeLabel(reviewBasis.value.executionMode)}`,
    `结果来源：${resolveExecutionSourceLabel(reviewBasis.value.executionMode)}`,
  ];
});
const showExecutionNotice = computed(() =>
  ['DETERMINISTIC_ONLY', 'BLOCKED'].includes(reviewBasis.value?.executionMode ?? ''),
);
const executionNoticeTitle = computed(() => {
  if (reviewBasis.value?.executionMode === 'BLOCKED') {
    return '审核已阻断';
  }

  return '降级审核说明';
});
const executionNoticeText = computed(() => {
  if (reviewBasis.value?.degradationReason) {
    return reviewBasis.value.degradationReason;
  }

  if (reviewBasis.value?.executionMode === 'BLOCKED') {
    return '当前任务未形成正式审核结果，请先处理阻断原因后重新发起审核。';
  }

  return '本次结果基于已配置规则生成，仅覆盖可明确判定项；未配置规则的审核项暂不纳入本轮。';
});

const supplementalNoticeTitle = computed(() => {
  if (supplementalReviewFailed.value) {
    return 'AI 补充流程未完成';
  }

  return 'AI 补充流程处理中';
});
const supplementalNoticeText = computed(() => {
  if (detail.value?.supplementalReviewMessage) {
    return detail.value.supplementalReviewMessage;
  }

  if (supplementalReviewFailed.value) {
    return '当前先保留已生成结果，请稍后重试或检查 AI 运行状态。';
  }

  return '当前先展示已生成结果，如存在补充流程，完成后会自动刷新页面。';
});

async function loadDetail(): Promise<void> {
  if (!taskId.value) {
    return;
  }

  loading.value = true;
  try {
    detail.value = await contractReviewService.getTaskDetail(taskId.value);
  } catch (error) {
    feedback.value = toUserFacingErrorMessage(
      error,
      '审核详情暂时没有加载成功，请稍后刷新重试；如果多次失败，请联系管理员。',
    );
  } finally {
    loading.value = false;
    syncPolling();
  }
}

function syncPolling(): void {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }

  if (pollingNeeded.value) {
    pollTimer = window.setInterval(() => {
      void loadDetail();
    }, 5000);
  }
}

function toggleIssueBasis(issueId: string): void {
  if (expandedIssueIds.value.includes(issueId)) {
    expandedIssueIds.value = expandedIssueIds.value.filter((item) => item !== issueId);
    return;
  }

  expandedIssueIds.value = [...expandedIssueIds.value, issueId];
}

function isIssueExpanded(issueId: string): boolean {
  return expandedIssueIds.value.includes(issueId);
}

function resolveDecisionLabel(): string {
  if (detail.value?.overallDecision === 'REJECT') {
    return '建议修改后签署';
  }

  if (detail.value?.overallDecision === 'REVISE') {
    return '建议修改后签署';
  }

  return '可直接签署';
}

function resolveDecisionTone(): 'danger' | 'warning' | 'success' {
  if (detail.value?.overallDecision === 'REJECT') {
    return 'danger';
  }

  if (detail.value?.overallDecision === 'REVISE') {
    return 'warning';
  }

  return 'success';
}

function resolveTaskStatusToneClass(status: ContractReviewTaskDetail['status'] | undefined): string {
  return toStatusToneClass(resolveContractReviewStatusTone(status));
}

function resolveTaskStatusIcon(status: ContractReviewTaskDetail['status'] | undefined) {
  return resolveContractReviewStatusIcon(status);
}

function resolveTaskStatusLabel(status: ContractReviewTaskDetail['status'] | undefined): string {
  switch (status) {
    case 'UPLOADED':
      return '已上传';
    case 'PARSING':
      return '解析中';
    case 'REVIEWING':
      return '审核中';
    case 'GENERATING_REPORT':
      return '生成报告中';
    case 'COMPLETED':
      return '已完成';
    case 'FAILED':
      return '审核失败';
    case 'BLOCKED':
      return '已阻断';
    default:
      return '处理中';
  }
}

function resolveExecutionModeLabel(mode: ContractReviewExecutionMode | undefined): string {
  switch (mode) {
    case 'AI_HYBRID':
      return 'AI 规则提示词审核';
    case 'DETERMINISTIC_ONLY':
      return '规则快审';
    case 'BLOCKED':
      return '审核阻断';
    default:
      return '待确认';
  }
}

function resolveExecutionSourceLabel(mode: ContractReviewExecutionMode | undefined): string {
  switch (mode) {
    case 'AI_HYBRID':
      return 'AI 根据审核规则提示词与合同上下文生成';
    case 'DETERMINISTIC_ONLY':
      return '仅根据已配置规则生成快审结果';
    case 'BLOCKED':
      return '本次任务未形成正式审核结果';
    default:
      return '来源待确认';
  }
}

function canDownloadArtifact(artifact: ContractReviewArtifact | undefined): boolean {
  return Boolean(artifact && artifact.status === 'AVAILABLE');
}

function downloadArtifact(artifact: ContractReviewArtifact | undefined): void {
  if (!artifact) {
    return;
  }

  if (artifact.status !== 'AVAILABLE') {
    feedback.value = artifact.failureReason ?? '当前产物尚未生成完成。';
    return;
  }

  window.open(
    contractReviewService.buildArtifactDownloadUrl(taskId.value, artifact.artifactId),
    '_blank',
  );
}

function goBackToWorkbench(): void {
  void router.push({ name: 'contract-review' });
}

onMounted(async () => {
  await loadDetail();
});

onBeforeUnmount(() => {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer);
  }
});

watch(
  () => route.params.taskId,
  async () => {
    expandedIssueIds.value = [];
    await loadDetail();
  },
);
</script>

<template>
  <div class="page contract-review-detail-page">
    <section
      v-if="detail"
      class="panel contract-review-decision"
      :data-tone="resolveDecisionTone()"
    >
      <div class="panel__body contract-review-decision__body">
        <div class="contract-review-detail-head__body">
          <el-alert
            v-if="feedback"
            class="contract-review-feedback"
            type="error"
            data-tone="danger"
            :closable="false"
            show-icon
          >
            {{ feedback }}
          </el-alert>
          <el-alert
            v-if="processing"
            class="contract-processing-state"
            type="info"
            :closable="false"
            show-icon
          >
            <strong>{{ detail.latestStageMessage }}</strong>
            <p>系统正在持续处理该合同，页面会自动刷新最新状态。</p>
          </el-alert>
        </div>
        <div class="contract-review-decision__summary">
          <div class="contract-review-decision__content">
            <div class="contract-review-detail-head__actions">
              <el-button
                class="button-secondary"
                @click="goBackToWorkbench"
              >
                <el-icon>
                  <component :is="UiIcons.back" />
                </el-icon>
                返回工作台
              </el-button>
              <el-button
                class="button-secondary"
                :disabled="!canDownloadArtifact(reportArtifact)"
                @click="downloadArtifact(reportArtifact)"
              >
                <el-icon>
                  <component :is="UiIcons.download" />
                </el-icon>
                下载审核报告
              </el-button>
            </div>
            <p class="contract-review-decision__label">
              {{ resolveDecisionLabel() }}
            </p>
            <h3>{{ detail.latestResultSummary }}</h3>
            <p>{{ detail.summary }}</p>
            <div class="contract-review-decision__meta">
              <span
                v-for="item in reviewBasisItems"
                :key="item"
                class="contract-review-meta-chip"
              >
                {{ item }}
              </span>
            </div>
          </div>
          <div class="contract-review-decision__aside">
            <el-tag
              :class="['badge', resolveTaskStatusToneClass(detail.status)]"
              type="info"
              round
            >
              <el-icon>
              <component :is="resolveTaskStatusIcon(detail.status)" />
            </el-icon>
            {{ resolveTaskStatusLabel(detail.status) }}
          </el-tag>
          </div>
        </div>

        <el-alert
          v-if="showExecutionNotice"
          class="contract-review-mode-notice"
          :type="reviewBasis?.executionMode === 'BLOCKED' ? 'error' : 'warning'"
          :data-tone="reviewBasis?.executionMode === 'BLOCKED' ? 'blocked' : 'degraded'"
          :closable="false"
          show-icon
        >
          <strong>{{ executionNoticeTitle }}</strong>
          <p>{{ executionNoticeText }}</p>
        </el-alert>

        <el-alert
          v-if="supplementalReviewRunning || supplementalReviewFailed"
          class="contract-review-mode-notice"
          :type="supplementalReviewRunning ? 'info' : 'warning'"
          :data-tone="supplementalReviewRunning ? 'running' : 'warning'"
          :closable="false"
          show-icon
        >
          <strong>{{ supplementalNoticeTitle }}</strong>
          <p>{{ supplementalNoticeText }}</p>
        </el-alert>

        <div class="contract-review-stats">
          <article class="contract-review-stat-card">
            <strong>{{ displayVetoCount }}</strong>
            <span>一票否决</span>
          </article>
          <article class="contract-review-stat-card">
            <strong>{{ displayHighRiskCount }}</strong>
            <span>高风险</span>
          </article>
          <article class="contract-review-stat-card">
            <strong>{{ displayMediumRiskCount }}</strong>
            <span>中风险</span>
          </article>
          <article class="contract-review-stat-card">
            <strong>{{ displayLowRiskCount }}</strong>
            <span>低风险</span>
          </article>
        </div>
      </div>
    </section>

    <section
      v-else
      class="panel"
    >
      <div class="panel__body contract-review-detail-head__body">
        <el-alert
          v-if="feedback"
          class="contract-review-feedback"
          type="error"
          data-tone="danger"
          :closable="false"
          show-icon
        >
          {{ feedback }}
        </el-alert>
        <el-alert
          v-if="loading"
          class="contract-empty-state"
          type="info"
          :closable="false"
          show-icon
        >
          正在加载审核详情...
        </el-alert>
      </div>
    </section>

    <section
      v-if="vetoIssues.length"
      class="panel contract-review-veto-panel"
    >
      <div class="panel__header">
        <div>
          <h3>需优先处理的一票否决项</h3>
        </div>
      </div>
      <div class="panel__body contract-review-risk-list">
        <article
          v-for="issue in vetoIssues"
          :key="issue.issueId"
          class="contract-review-risk-card contract-review-risk-card--veto"
        >
          <div class="contract-review-risk-card__top">
            <RiskLevelBadge
              class="contract-review-risk-card__badge"
              :level="issue.riskLevel"
              :veto="issue.isVeto"
            />
            <h4>{{ issue.title }}</h4>
          </div>
          <p class="contract-review-risk-card__quote">
            原文片段：{{ issue.quote }}
          </p>
          <p class="contract-review-risk-card__desc">
            {{ issue.description }}
          </p>
          <p class="contract-review-risk-card__suggestion">
            建议动作：{{ issue.suggestion }}
          </p>
        </article>
      </div>
    </section>

    <section
      v-if="detail"
      class="panel contract-review-risk-panel"
    >
      <div class="panel__header">
        <div>
          <h3>待处理风险项</h3>
        </div>
      </div>
      <div class="panel__body contract-review-risk-list">
        <article
          v-for="issue in riskIssues"
          :key="issue.issueId"
          class="contract-review-risk-card"
        >
          <div class="contract-review-risk-card__top">
            <RiskLevelBadge
              class="contract-review-risk-card__badge"
              :level="issue.riskLevel"
              :veto="issue.isVeto"
            />
            <h4>{{ issue.title }}</h4>
          </div>
          <p class="contract-review-risk-card__quote">
            原文片段：{{ issue.quote }}
          </p>
          <p class="contract-review-risk-card__desc">
            {{ issue.description }}
          </p>
          <p class="contract-review-risk-card__suggestion">
            建议动作：{{ issue.suggestion }}
          </p>
          <el-button
            class="button-secondary contract-review-risk-card__toggle"
            @click="toggleIssueBasis(issue.issueId)"
          >
            <el-icon>
              <component :is="isIssueExpanded(issue.issueId) ? UiIcons.collapse : UiIcons.expand" />
            </el-icon>
            {{ isIssueExpanded(issue.issueId) ? '收起依据' : '查看依据' }}
          </el-button>
          <div
            v-if="isIssueExpanded(issue.issueId)"
            class="contract-review-risk-card__basis"
          >
            <p>规则编码：{{ issue.ruleCode }}</p>
            <p>规则标题：{{ issue.ruleTitle }}</p>
            <p>依据条款：{{ issue.sourceClause }}</p>
            <p v-if="reviewBasis">
              审核标准版本：v{{ reviewBasis.packVersion }}
            </p>
            <p v-if="reviewBasis">
              执行模式：{{ resolveExecutionModeLabel(reviewBasis.executionMode) }}
            </p>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

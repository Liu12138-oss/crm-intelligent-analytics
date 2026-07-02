<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import {
  ElButton,
  ElDrawer,
  ElIcon,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElPagination,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus';
import ObjectIconLabel from '@/components/shared/ObjectIconLabel.vue';
import RiskLevelBadge from '@/components/shared/RiskLevelBadge.vue';
import { analysisService } from '@/services/analysis.service';
import type {
  AuditEventList,
  SqlAuditDetailView,
  SqlAuditListItem,
  SqlAuditListResponse,
  SqlAuditRevealView,
} from '@/types/analysis';
import { useAuthStore } from '@/stores/auth.store';
import {
  auditEventTypeOptions,
  formatAuditEventTypeLabel,
  formatAuditLevelLabel,
  formatBusinessCodeText,
  formatEntrySceneLabel,
  formatFallbackReasonLabel,
  formatSqlAuditDatabaseRoleLabel,
  formatSqlAuditModuleLabel,
  formatSqlAuditOperationTypeLabel,
  formatSqlAuditStageLabel,
  formatWorkflowLabel,
} from '@/ui/business-code-labels';
import { UiIcons } from '@/ui/icons';
import {
  resolveAuditLevelIcon,
  resolveAuditLevelTone,
  toStatusToneClass,
} from '@/ui/status-presentation';
import { toUserFacingErrorMessage } from '@/utils/user-facing-error';

const authStore = useAuthStore();
const defaultUserAuditPageSize = 10;
const defaultSqlAuditPageSize = 10;
const auditPageSizeOptions = [10, 20, 50];
const filters = reactive({
  actorId: '',
  eventType: '',
  entryScene: '',
  entryTargetWorkflow: '',
  workflowTargetWorkflow: '',
  entryUsedFallback: '',
});

const sqlFilters = reactive({
  actorId: '',
  moduleKey: '',
  databaseRole: '',
  stage: '',
  operationType: '',
  status: '',
  tableName: '',
  requestId: '',
  sessionId: '',
});

type AuditTabKey = 'ai' | 'user' | 'sql';
type AiBreakdownKey = 'scene' | 'workflow' | 'reason' | 'trend';

const activeAuditTab = ref<AuditTabKey>('ai');
const activeAiBreakdown = ref<AiBreakdownKey>('scene');
const auditTabs = computed<
  Array<{
    key: AuditTabKey;
    label: string;
    description: string;
    icon: (typeof UiIcons)[keyof typeof UiIcons];
  }>
>(() => [
  {
    key: 'ai',
    label: 'AI 审计',
    description: '入口质量、AI 兜底与治理信号',
    icon: UiIcons.analysis,
  },
  {
    key: 'user',
    label: '用户行为审计',
    description: '查询、导出、治理操作留痕',
    icon: UiIcons.user,
  },
  ...(authStore.hasAction('audit.sql.view')
    ? [
        {
          key: 'sql' as const,
          label: 'SQL 审计',
          description: 'CRM SQL 执行轨迹与敏感查看',
          icon: UiIcons.connection,
        },
      ]
    : []),
]);

const auditData = ref<AuditEventList | null>(null);
const loading = ref(false);
const userAuditPagination = reactive({
  page: 1,
  pageSize: defaultUserAuditPageSize,
});
const sqlAuditData = ref<SqlAuditListResponse | null>(null);
const sqlAuditLoading = ref(false);
const sqlAuditPagination = reactive({
  page: 1,
  pageSize: defaultSqlAuditPageSize,
});
const sqlAuditDetailVisible = ref(false);
const sqlAuditDetailLoading = ref(false);
const sqlAuditRevealLoading = ref(false);
const selectedSqlAudit = ref<SqlAuditDetailView | null>(null);
const revealedSqlAudit = ref<SqlAuditRevealView | null>(null);

const aiFallbackWarningThresholdPercent = 30;
const aiFallbackCriticalThresholdPercent = 50;

const aiBreakdownTabs: Array<{
  key: AiBreakdownKey;
  label: string;
}> = [
  { key: 'scene', label: '按入口' },
  { key: 'workflow', label: '按工作流' },
  { key: 'reason', label: '按兜底原因' },
  { key: 'trend', label: '趋势' },
];

const latestAiDataDate = computed(() => {
  const latestDate = auditData.value?.summary.entryDailyTrend.at(-1)?.date;
  return latestDate ? `${latestDate} 最新审计汇总` : '--';
});

const affectedAiEntryCount = computed(() => {
  return (
    auditData.value?.summary.entrySceneBreakdown.filter(
      (item) => item.fallbackCount > 0,
    ).length ?? 0
  );
});

const topFallbackReasonLabel = computed(() => {
  const topReason = auditData.value?.summary.entryFallbackReasonBreakdown[0];
  return topReason ? formatFallbackReasonLabel(topReason.fallbackReason) : '暂无明显兜底原因';
});

const aiHealthStatus = computed(() => {
  const fallbackRate = auditData.value?.summary.todayAiFallbackRatePercent ?? 0;
  const hasCriticalSignal =
    auditData.value?.summary.aiGovernanceAlerts.some((item) => item.level === 'critical') ||
    auditData.value?.summary.aiGovernanceSuggestions.some(
      (item) => item.level === 'critical',
    );
  const hasWarningSignal =
    auditData.value?.summary.aiGovernanceAlerts.some((item) => item.level === 'warning') ||
    auditData.value?.summary.aiGovernanceSuggestions.some(
      (item) => item.level === 'warning',
    );

  if (hasCriticalSignal || fallbackRate >= aiFallbackCriticalThresholdPercent) {
    return {
      label: '严重',
      tone: 'critical' as const,
      description: 'AI 兜底率已进入严重区间，建议先暂停扩大灰度并排查入口稳定性。',
    };
  }

  if (hasWarningSignal || fallbackRate >= aiFallbackWarningThresholdPercent) {
    return {
      label: '预警',
      tone: 'warning' as const,
      description: 'AI 兜底率已接近或超过预警线，需要优先核查高频入口。',
    };
  }

  return {
    label: '稳定',
    tone: 'info' as const,
    description: '当前 AI 入口理解链路未触发明显阈值风险。',
  };
});

const aiOverviewMetrics = computed(() => [
  {
    label: 'AI 入口请求数',
    value: String(auditData.value?.summary.todayAiEntryCount ?? 0),
    helper: '今日进入统一 AI 理解层的请求总数',
  },
  {
    label: 'AI 兜底率',
    value: `${auditData.value?.summary.todayAiFallbackRatePercent ?? 0}%`,
    helper: `预警线 ${aiFallbackWarningThresholdPercent}%，严重线 ${aiFallbackCriticalThresholdPercent}%`,
  },
  {
    label: '高风险预警',
    value: String(
      auditData.value?.summary.aiGovernanceAlerts.filter(
        (item) => item.level === 'critical',
      ).length ?? 0,
    ),
    helper: '需要优先处理的严重级治理信号',
  },
  {
    label: '受影响入口',
    value: String(affectedAiEntryCount.value),
    helper: `主要兜底原因：${topFallbackReasonLabel.value}`,
  },
]);

const aiRiskQueue = computed(() => {
  const alerts =
    auditData.value?.summary.aiGovernanceAlerts.map((item) => ({
      level: item.level,
      title: item.title,
      detail: item.detail,
      action: '先定位对应入口的提示词、超时、模型结构返回和固定执行门闩。',
      source: '阈值预警',
    })) ?? [];
  const suggestions =
    auditData.value?.summary.aiGovernanceSuggestions.map((item) => ({
      level: item.level,
      title: item.title,
      detail: item.detail,
      action: item.action,
      source: '治理建议',
    })) ?? [];

  return [...alerts, ...suggestions]
    .sort((left, right) => {
      const priority = { critical: 0, warning: 1, info: 2 };
      return priority[left.level] - priority[right.level];
    })
    .slice(0, 5);
});

const sqlStageOptions = [
  { label: '全部阶段', value: '' },
  { label: '执行前预检', value: 'PREFLIGHT' },
  { label: '已执行', value: 'EXECUTED' },
  { label: '执行失败', value: 'FAILED' },
  { label: '执行前阻断', value: 'BLOCKED' },
];

const sqlDatabaseRoleOptions = [
  { label: '全部数据库角色', value: '' },
  { label: 'CRM 只读库', value: 'CRM_READONLY' },
  { label: 'CRM 写库', value: 'CRM_WRITEBACK' },
];

const sqlOperationTypeOptions = [
  { label: '全部操作', value: '' },
  { label: '只读查询', value: 'SELECT' },
  { label: '新增写入', value: 'INSERT' },
  { label: '更新写入', value: 'UPDATE' },
  { label: '删除写入', value: 'DELETE' },
  { label: '执行前预检', value: 'EXPLAIN' },
];

const sqlStatusOptions = [
  { label: '全部状态', value: '' },
  { label: '已成功', value: 'SUCCEEDED' },
  { label: '失败', value: 'FAILED' },
  { label: '阻断', value: 'BLOCKED' },
];

/**
 * 审计时间统一按上海时区展示，避免直接截断 UTC 字符串后误显示为凌晨。
 */
function formatAuditTimestamp(value: string | undefined): string {
  if (!value?.trim()) {
    return '--';
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value.replace('T', ' ').slice(0, 16);
  }

  return parsedDate.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 优先展示当前登录人可读名称，避免审计表格直接回落到内部 ID。
 * @param row 审计事件行数据
 * @returns 页面用于展示的用户名
 */
function resolveActorDisplayName(row: AuditEventList['items'][number]): string {
  if (row.actorBindingStatus === 'UNBOUND_WECOM' && row.actorExternalId) {
    return `未绑定 CRM 用户（企业微信：${row.actorExternalId}）`;
  }

  if (row.actorDisplayName) {
    return row.actorDisplayName;
  }

  if (row.actorName) {
    return row.actorName;
  }

  if (row.actorId && row.actorId === authStore.currentUser?.id) {
    return authStore.currentUser.name;
  }

  return row.actorId || '--';
}

function formatActorBindingStatus(value: string | undefined): string {
  const labels: Record<string, string> = {
    BOUND_CRM: '已绑定 CRM',
    UNBOUND_WECOM: '未绑定 CRM',
    SYSTEM: '系统任务',
    UNKNOWN: '未知',
  };
  return value ? labels[value] ?? '未知' : '--';
}

function formatAuditChannel(value: string | undefined): string {
  const labels: Record<string, string> = {
    'web-console': 'Web 工作台',
    'wecom-bot': '企业微信机器人',
    system: '系统任务',
  };
  return value ? labels[value] ?? formatBusinessCodeText(value) : '--';
}

function resolveTargetSummary(row: AuditEventList['items'][number]): string {
  return (
    row.targetSummary ||
    row.targetId ||
    row.resourceId ||
    row.originalQuestion ||
    '--'
  );
}

function resolveActionSummary(row: AuditEventList['items'][number]): string {
  return row.actionSummary || row.outcome || '--';
}

/**
 * 将 AI 审计的技术口径转成业务用户更容易理解的中文表达。
 * @param value 后端返回的治理标题、说明或建议动作
 * @returns 已替换内部枚举和 fallback 术语的展示文案
 */
function formatAiAuditText(value: string | undefined): string {
  return formatBusinessCodeText(value)
    .replace(/AI AI 兜底/gu, 'AI 兜底')
    .replace(/AI 兜底 比例/gu, 'AI 兜底比例')
    .replace(/AI 兜底 原因/gu, 'AI 兜底原因')
    .replace(/AI fallback 比例/gu, 'AI 兜底比例')
    .replace(/AI fallback/gu, 'AI 兜底')
    .replace(/fallback 原因分布/gu, 'AI 兜底原因分布')
    .replace(/fallback 比例/gu, 'AI 兜底比例')
    .replace(/fallback/gu, 'AI 兜底');
}

/**
 * 按当前筛选条件重新拉取审计数据，供首屏加载、Tab 切换和手动查询复用。
 * @returns 无返回值
 */
async function loadAuditEvents() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    params.set('page', String(userAuditPagination.page));
    params.set('pageSize', String(userAuditPagination.pageSize));
    if (filters.actorId) {
      params.set('actorId', filters.actorId);
    }
    if (filters.eventType) {
      params.set('eventType', filters.eventType);
    }
    if (filters.entryScene) {
      params.set('entryScene', filters.entryScene);
    }
    if (filters.entryTargetWorkflow) {
      params.set('entryTargetWorkflow', filters.entryTargetWorkflow);
    }
    if (filters.workflowTargetWorkflow) {
      params.set('workflowTargetWorkflow', filters.workflowTargetWorkflow);
    }
    if (filters.entryUsedFallback) {
      params.set('entryUsedFallback', filters.entryUsedFallback);
    }
    const response = await analysisService.listAuditEvents(params);
    auditData.value = response;
    userAuditPagination.page = response.page;
    userAuditPagination.pageSize = response.pageSize;
  } finally {
    loading.value = false;
  }
}

/**
 * 按 SQL 审计筛选条件拉取列表与摘要，供 SQL Tab 初始加载、筛选和分页复用。
 */
async function loadSqlAudits() {
  sqlAuditLoading.value = true;
  try {
    const params = new URLSearchParams();
    params.set('page', String(sqlAuditPagination.page));
    params.set('pageSize', String(sqlAuditPagination.pageSize));
    if (sqlFilters.actorId) {
      params.set('actorId', sqlFilters.actorId);
    }
    if (sqlFilters.moduleKey) {
      params.set('moduleKey', sqlFilters.moduleKey);
    }
    if (sqlFilters.databaseRole) {
      params.set('databaseRole', sqlFilters.databaseRole);
    }
    if (sqlFilters.stage) {
      params.set('stage', sqlFilters.stage);
    }
    if (sqlFilters.operationType) {
      params.set('operationType', sqlFilters.operationType);
    }
    if (sqlFilters.status) {
      params.set('status', sqlFilters.status);
    }
    if (sqlFilters.tableName) {
      params.set('tableName', sqlFilters.tableName);
    }
    if (sqlFilters.requestId) {
      params.set('requestId', sqlFilters.requestId);
    }
    if (sqlFilters.sessionId) {
      params.set('sessionId', sqlFilters.sessionId);
    }
    const response = await analysisService.listSqlAudits(params);
    sqlAuditData.value = response;
    sqlAuditPagination.page = response.page;
    sqlAuditPagination.pageSize = response.pageSize;
  } catch (error) {
    ElMessage.error(
      toUserFacingErrorMessage(
        error,
        'SQL 审计列表暂时没有加载成功，请稍后重试；如果多次失败，请联系管理员。',
      ),
    );
  } finally {
    sqlAuditLoading.value = false;
  }
}

/**
 * 根据当前活动分区刷新对应数据，避免不同审计流共用同一请求。
 */
function loadCurrentTabData(): void {
  if (activeAuditTab.value === 'sql') {
    void loadSqlAudits();
    return;
  }

  void loadAuditEvents();
}

/**
 * 切换审计分区时立即刷新，确保 AI 审计与用户行为审计都读取最新数据。
 * @param nextTab 目标审计分区
 * @returns 无返回值
 */
function handleAuditTabChange(nextTab: AuditTabKey): void {
  // 重复点击当前分区不再重复请求，避免无意义刷新。
  if (activeAuditTab.value === nextTab) {
    return;
  }

  activeAuditTab.value = nextTab;
  loadCurrentTabData();
}

/**
 * 用户重新提交筛选条件时回到第一页，避免仍停留在旧页码造成空页误判。
 * @returns 无返回值
 */
function handleUserAuditQuery(): void {
  userAuditPagination.page = 1;
  void loadAuditEvents();
}

/**
 * 用户切换分页时拉取目标页数据，并保持当前筛选条件不变。
 * @param nextPage 目标页码
 * @returns 无返回值
 */
function handleUserAuditPageChange(nextPage: number): void {
  // 分页器回传当前页时无需重复请求。
  if (userAuditPagination.page === nextPage) {
    return;
  }

  userAuditPagination.page = nextPage;
  void loadAuditEvents();
}

/**
 * 用户调整行为审计每页条数时回到第一页，避免旧页码在新分页范围内出现空结果。
 * @param nextPageSize 新的每页条数
 * @returns 无返回值
 */
function handleUserAuditPageSizeChange(nextPageSize: number): void {
  if (userAuditPagination.pageSize === nextPageSize) {
    return;
  }

  userAuditPagination.pageSize = nextPageSize;
  userAuditPagination.page = 1;
  void loadAuditEvents();
}

/**
 * SQL 审计筛选重新提交时回到第一页，避免旧页码导致空结果误判。
 */
function handleSqlAuditQuery(): void {
  sqlAuditPagination.page = 1;
  void loadSqlAudits();
}

/**
 * SQL 审计分页切换时保留当前筛选条件，并拉取目标页数据。
 */
function handleSqlAuditPageChange(nextPage: number): void {
  if (sqlAuditPagination.page === nextPage) {
    return;
  }

  sqlAuditPagination.page = nextPage;
  void loadSqlAudits();
}

/**
 * SQL 审计调整每页条数时重新从第一页查询，确保筛选条件和分页口径同步进入审计接口。
 */
function handleSqlAuditPageSizeChange(nextPageSize: number): void {
  if (sqlAuditPagination.pageSize === nextPageSize) {
    return;
  }

  sqlAuditPagination.pageSize = nextPageSize;
  sqlAuditPagination.page = 1;
  void loadSqlAudits();
}

/**
 * 打开 SQL 审计详情抽屉，并读取当前记录的摘要详情。
 */
async function openSqlAuditDetail(row: SqlAuditListItem): Promise<void> {
  sqlAuditDetailVisible.value = true;
  sqlAuditDetailLoading.value = true;
  revealedSqlAudit.value = null;
  try {
    selectedSqlAudit.value = await analysisService.getSqlAuditDetail(row.auditId);
  } catch (error) {
    selectedSqlAudit.value = null;
    ElMessage.error(
      toUserFacingErrorMessage(
        error,
        'SQL 审计详情暂时没有加载成功，请稍后重试；如果多次失败，请联系管理员。',
      ),
    );
  } finally {
    sqlAuditDetailLoading.value = false;
  }
}

/**
 * 受控 reveal 完整 SQL 与参数，操作前要求显式确认，并在失败时给出即时反馈。
 */
async function revealCurrentSqlAudit(): Promise<void> {
  if (!selectedSqlAudit.value?.canRevealSensitive) {
    return;
  }

  try {
    await ElMessageBox.confirm(
      '查看完整 SQL 和参数会额外留下审计记录，是否继续？',
      '查看敏感明细确认',
      {
        confirmButtonText: '继续查看',
        cancelButtonText: '取消',
        type: 'warning',
      },
    );
  } catch {
    return;
  }

  sqlAuditRevealLoading.value = true;
  try {
    revealedSqlAudit.value = await analysisService.revealSqlAudit(
      selectedSqlAudit.value.auditId,
    );
    ElMessage.success('已加载完整 SQL 与参数，并记录查看审计。');
  } catch (error) {
    ElMessage.error(
      toUserFacingErrorMessage(
        error,
        '完整 SQL 暂时没有加载成功，请稍后重试；如果多次失败，请联系管理员。',
      ),
    );
  } finally {
    sqlAuditRevealLoading.value = false;
  }
}

onMounted(loadCurrentTabData);
</script>

<template>
  <div class="page audit-page">
    <section class="panel">
      <div class="panel__body audit-center__body">
        <div
          class="audit-tabs"
          :style="{ '--audit-tab-count': String(auditTabs.length) }"
          role="tablist"
          aria-label="审计中心分类"
        >
          <button
            v-for="item in auditTabs"
            :key="item.key"
            class="audit-tabs__button"
            :class="{ 'audit-tabs__button--active': activeAuditTab === item.key }"
            type="button"
            role="tab"
            :aria-selected="activeAuditTab === item.key"
            :data-test="`audit-tab-${item.key}`"
            @click="handleAuditTabChange(item.key)"
          >
            <span class="audit-tabs__icon">
              <el-icon>
                <component :is="item.icon" />
              </el-icon>
            </span>
            <span class="audit-tabs__content">
              <strong>{{ item.label }}</strong>
              <small>{{ item.description }}</small>
            </span>
          </button>
        </div>

        <section
          v-if="activeAuditTab === 'ai'"
          class="audit-tab-panel"
          role="tabpanel"
          data-test="audit-panel-ai"
        >
          <section class="panel ai-audit-hero">
            <div class="panel__body ai-audit-hero__body">
              <div class="ai-audit-hero__summary">
                <div>
                  <h2 class="table-panel__title">
                    AI 运行治理概览
                  </h2>
                  <p>
                    {{ aiHealthStatus.description }}
                  </p>
                </div>
                <el-tag
                  :class="['badge', toStatusToneClass(resolveAuditLevelTone(aiHealthStatus.tone))]"
                  :type="aiHealthStatus.tone === 'critical' ? 'danger' : aiHealthStatus.tone === 'warning' ? 'warning' : 'info'"
                  round
                >
                  <el-icon>
                    <component :is="resolveAuditLevelIcon(aiHealthStatus.tone)" />
                  </el-icon>
                  {{ aiHealthStatus.label }}
                </el-tag>
              </div>
              <div class="audit-chip-row">
                <span class="audit-context-chip">统计口径：今日 AI 入口理解链路</span>
                <span class="audit-context-chip">数据更新时间：{{ latestAiDataDate }}</span>
                <span class="audit-context-chip">阈值：{{ aiFallbackWarningThresholdPercent }}% 预警 / {{ aiFallbackCriticalThresholdPercent }}% 严重</span>
              </div>
              <div class="grid-four">
                <article
                  v-for="item in aiOverviewMetrics"
                  :key="item.label"
                  class="audit-card audit-card--metric"
                >
                  <span class="audit-card__label">{{ item.label }}</span>
                  <strong class="audit-card__value">{{ item.value }}</strong>
                  <small>{{ item.helper }}</small>
                </article>
              </div>
            </div>
          </section>

          <section class="panel">
            <div class="panel__header">
              <div>
                <h2 class="table-panel__title">
                  待处理风险
                </h2>
                <p class="audit-section-copy">
                  合并阈值预警与治理建议，优先展示最需要排查的 AI 入口风险。
                </p>
              </div>
            </div>
            <div class="panel__body">
              <div
                v-if="!aiRiskQueue.length"
                class="empty-state"
              >
                当前暂无需要处理的 AI 治理风险。
              </div>
              <div
                v-else
                class="audit-risk-list"
              >
                <article
                  v-for="item in aiRiskQueue"
                  :key="`${item.source}-${item.level}-${item.title}`"
                  class="audit-alert-card audit-alert-card--risk"
                >
                  <div class="audit-alert-card__head">
                    <div>
                      <strong>{{ formatAiAuditText(item.title) }}</strong>
                      <span>来源：{{ item.source }}</span>
                    </div>
                    <el-tag
                      :class="['badge', toStatusToneClass(resolveAuditLevelTone(item.level))]"
                      :type="item.level === 'critical' ? 'danger' : item.level === 'warning' ? 'warning' : 'info'"
                      round
                    >
                      <el-icon>
                        <component :is="resolveAuditLevelIcon(item.level)" />
                      </el-icon>
                      {{ formatAuditLevelLabel(item.level) }}
                    </el-tag>
                  </div>
                  <p>{{ formatAiAuditText(item.detail) }}</p>
                  <p>建议动作：{{ formatAiAuditText(item.action) }}</p>
                </article>
              </div>
            </div>
          </section>

          <section class="panel">
            <div class="panel__header ai-breakdown-header">
              <div>
                <h2 class="table-panel__title">
                  AI 健康拆解
                </h2>
                <p class="audit-section-copy">
                  先看异常入口，再下钻工作流、兜底原因和趋势，避免同屏堆叠所有小表。
                </p>
              </div>
              <div
                class="ai-breakdown-tabs"
                role="tablist"
                aria-label="AI 健康拆解维度"
              >
                <button
                  v-for="item in aiBreakdownTabs"
                  :key="item.key"
                  class="ai-breakdown-tabs__button"
                  :class="{ 'ai-breakdown-tabs__button--active': activeAiBreakdown === item.key }"
                  type="button"
                  role="tab"
                  :aria-selected="activeAiBreakdown === item.key"
                  @click="activeAiBreakdown = item.key"
                >
                  {{ item.label }}
                </button>
              </div>
            </div>
            <div class="panel__body ai-breakdown-body">
              <div
                v-if="activeAiBreakdown === 'scene'"
                class="table-wrap"
              >
                <table class="table">
                  <thead>
                    <tr>
                      <th>受影响入口</th>
                      <th>请求数</th>
                      <th>AI 兜底数</th>
                      <th>AI 兜底率</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="item in auditData?.summary.entrySceneBreakdown ?? []"
                      :key="item.scene"
                    >
                      <td>{{ formatEntrySceneLabel(item.scene) }}</td>
                      <td>{{ item.count }}</td>
                      <td>{{ item.fallbackCount }}</td>
                      <td>{{ item.fallbackRatePercent }}%</td>
                    </tr>
                    <tr v-if="!(auditData?.summary.entrySceneBreakdown?.length)">
                      <td
                        colspan="4"
                        class="table-panel__empty"
                      >
                        暂无入口统计。
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div
                v-if="activeAiBreakdown === 'workflow'"
                class="table-wrap"
              >
                <table class="table">
                  <thead>
                    <tr>
                      <th>目标工作流</th>
                      <th>请求数</th>
                      <th>AI 兜底数</th>
                      <th>AI 兜底率</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="item in auditData?.summary.entryTargetWorkflowBreakdown ?? []"
                      :key="item.targetWorkflow"
                    >
                      <td>{{ formatWorkflowLabel(item.targetWorkflow) }}</td>
                      <td>{{ item.count }}</td>
                      <td>{{ item.fallbackCount }}</td>
                      <td>{{ item.fallbackRatePercent }}%</td>
                    </tr>
                    <tr v-if="!(auditData?.summary.entryTargetWorkflowBreakdown?.length)">
                      <td
                        colspan="4"
                        class="table-panel__empty"
                      >
                        暂无工作流统计。
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div
                v-if="activeAiBreakdown === 'reason'"
                class="table-wrap"
              >
                <table class="table">
                  <thead>
                    <tr>
                      <th>AI 兜底原因</th>
                      <th>次数</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="item in auditData?.summary.entryFallbackReasonBreakdown ?? []"
                      :key="item.fallbackReason"
                    >
                      <td>{{ formatFallbackReasonLabel(item.fallbackReason) }}</td>
                      <td>{{ item.count }}</td>
                    </tr>
                    <tr v-if="!(auditData?.summary.entryFallbackReasonBreakdown?.length)">
                      <td
                        colspan="2"
                        class="table-panel__empty"
                      >
                        暂无 AI 兜底原因统计。
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div
                v-if="activeAiBreakdown === 'trend'"
                class="table-wrap"
              >
                <table class="table">
                  <thead>
                    <tr>
                      <th>日期</th>
                      <th>入口请求数</th>
                      <th>AI 兜底数</th>
                      <th>AI 兜底率</th>
                      <th>企业微信入口数</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="item in auditData?.summary.entryDailyTrend ?? []"
                      :key="item.date"
                    >
                      <td>{{ item.date }}</td>
                      <td>{{ item.aiEntryCount }}</td>
                      <td>{{ item.aiFallbackCount }}</td>
                      <td>{{ item.aiFallbackRatePercent }}%</td>
                      <td>{{ item.wecomEntryCount }}</td>
                    </tr>
                    <tr v-if="!(auditData?.summary.entryDailyTrend?.length)">
                      <td
                        colspan="5"
                        class="table-panel__empty"
                      >
                        暂无 AI 趋势。
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <aside class="ai-breakdown-aside">
                <strong>快速定位</strong>
                <span>主要兜底原因：{{ topFallbackReasonLabel }}</span>
                <span>受影响入口数：{{ affectedAiEntryCount }}</span>
                <span
                  v-for="item in auditData?.summary.entryFallbackReasonBreakdown.slice(1, 3) ?? []"
                  :key="item.fallbackReason"
                >
                  {{ formatFallbackReasonLabel(item.fallbackReason) }}：{{ item.count }} 次
                </span>
              </aside>
            </div>
          </section>
        </section>

        <section
          v-else-if="activeAuditTab === 'user'"
          class="audit-tab-panel"
          role="tabpanel"
          data-test="audit-panel-user"
        >
          <div class="grid-five">
            <article class="audit-card">
              <span class="audit-card__label">当日查询量</span>
              <strong class="audit-card__value">{{ auditData?.summary.todayQueryCount ?? 0 }}</strong>
            </article>
            <article class="audit-card">
              <span class="audit-card__label">企业微信占比</span>
              <strong class="audit-card__value">{{ auditData?.summary.wecomQueryRatioPercent ?? 0 }}%</strong>
            </article>
            <article class="audit-card">
              <span class="audit-card__label">当日拦截量</span>
              <strong class="audit-card__value">{{ auditData?.summary.todayBlockedCount ?? 0 }}</strong>
            </article>
            <article class="audit-card">
              <span class="audit-card__label">待复核高风险</span>
              <strong class="audit-card__value">{{ auditData?.summary.pendingHighRiskReviewCount ?? 0 }}</strong>
            </article>
            <article class="audit-card">
              <span class="audit-card__label">企业微信入口数</span>
              <strong class="audit-card__value">{{ auditData?.summary.todayWecomEntryCount ?? 0 }}</strong>
            </article>
          </div>

          <section class="panel">
            <div class="panel__header">
              <div>
                <h2 class="table-panel__title">
                  审计事件检索
                </h2>
              </div>
            </div>
            <div class="panel__body">
              <div class="grid-three">
                <el-input
                  v-model="filters.actorId"
                  class="input"
                  placeholder="按用户名筛选"
                  :prefix-icon="UiIcons.user"
                  @keyup.enter="handleUserAuditQuery"
                />
                <el-select
                  v-model="filters.eventType"
                  class="input"
                  placeholder="按事件类型筛选"
                  filterable
                  clearable
                >
                  <el-option
                    value=""
                    label="全部事件类型"
                  >
                    全部事件类型
                  </el-option>
                  <el-option
                    v-for="item in auditEventTypeOptions"
                    :key="item.value"
                    :value="item.value"
                    :label="`${item.label}（${item.value}）`"
                  >
                    {{ item.label }}（{{ item.value }}）
                  </el-option>
                </el-select>
                <el-input
                  v-model="filters.entryScene"
                  class="input"
                  placeholder="按入口场景筛选"
                  :prefix-icon="UiIcons.search"
                  @keyup.enter="handleUserAuditQuery"
                />
                <el-input
                  v-model="filters.entryTargetWorkflow"
                  class="input"
                  placeholder="按入口目标工作流筛选"
                  :prefix-icon="UiIcons.workflow"
                  @keyup.enter="handleUserAuditQuery"
                />
                <el-input
                  v-model="filters.workflowTargetWorkflow"
                  class="input"
                  placeholder="按最终程序工作流筛选"
                  :prefix-icon="UiIcons.workflow"
                  @keyup.enter="handleUserAuditQuery"
                />
                <el-select
                  v-model="filters.entryUsedFallback"
                  class="input"
                  placeholder="AI 兜底：全部"
                >
                  <el-option
                    value=""
                    label="AI 兜底：全部"
                  >
                    AI 兜底：全部
                  </el-option>
                  <el-option
                    value="true"
                    label="仅 AI 兜底"
                  >
                    仅 AI 兜底
                  </el-option>
                  <el-option
                    value="false"
                    label="仅 AI 主链"
                  >
                    仅 AI 主链
                  </el-option>
                </el-select>
              </div>
              <div class="audit-filter-actions">
                <el-button
                  class="button-primary"
                  type="primary"
                  :disabled="loading"
                  :loading="loading"
                  :aria-busy="loading ? 'true' : 'false'"
                  @click="handleUserAuditQuery"
                >
                  <el-icon v-if="!loading">
                    <component :is="UiIcons.filter" />
                  </el-icon>
                  {{ loading ? '查询中...' : '查询' }}
                </el-button>
              </div>
            </div>
          </section>

          <section class="panel">
            <div class="panel__header">
              <h2 class="table-panel__title">
                事件明细
              </h2>
            </div>
            <div class="panel__body">
              <div class="table-wrap">
                <el-table
                  class="table"
                  :data="auditData?.items ?? []"
                  stripe
                  border
                  empty-text="暂无审计记录。"
                >
                  <el-table-column
                    label="时间"
                    min-width="160"
                  >
                    <template #default="{ row }">
                      {{ formatAuditTimestamp(row.createdAt) }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    label="用户"
                    min-width="140"
                  >
                    <template #default="{ row }">
                      <ObjectIconLabel
                        type="owner"
                        tone="audit"
                        :label="resolveActorDisplayName(row)"
                        :description="formatActorBindingStatus(row.actorBindingStatus)"
                      />
                    </template>
                  </el-table-column>
                  <el-table-column
                    label="绑定状态"
                    min-width="120"
                  >
                    <template #default="{ row }">
                      {{ formatActorBindingStatus(row.actorBindingStatus) }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    label="入口"
                    min-width="130"
                  >
                    <template #default="{ row }">
                      {{ formatAuditChannel(row.channel) }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    label="事件类型"
                    min-width="150"
                  >
                    <template #default="{ row }">
                      <ObjectIconLabel
                        type="auditEvent"
                        tone="audit"
                        :label="formatAuditEventTypeLabel(row.eventType)"
                        :description="formatAuditChannel(row.channel)"
                      />
                    </template>
                  </el-table-column>
                  <el-table-column
                    label="业务对象"
                    min-width="180"
                  >
                    <template #default="{ row }">
                      <ObjectIconLabel
                        type="dataTable"
                        tone="audit"
                        :label="resolveTargetSummary(row)"
                        description="审计对象"
                      />
                    </template>
                  </el-table-column>
                  <el-table-column
                    label="操作摘要"
                    min-width="180"
                  >
                    <template #default="{ row }">
                      {{ formatBusinessCodeText(resolveActionSummary(row)) }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    label="结果"
                    min-width="120"
                  >
                    <template #default="{ row }">
                      {{ formatBusinessCodeText(row.outcome) }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    label="风险等级"
                    min-width="120"
                  >
                    <template #default="{ row }">
                      <RiskLevelBadge :level="row.riskLevel" />
                    </template>
                  </el-table-column>
                </el-table>
              </div>
              <div class="audit-table-pagination">
                <el-pagination
                  background
                  layout="total, sizes, prev, pager, next"
                  :current-page="userAuditPagination.page"
                  :page-size="userAuditPagination.pageSize"
                  :page-sizes="auditPageSizeOptions"
                  :total="auditData?.total ?? 0"
                  @current-change="handleUserAuditPageChange"
                  @size-change="handleUserAuditPageSizeChange"
                />
              </div>
            </div>
          </section>
        </section>

        <section
          v-else
          class="audit-tab-panel"
          role="tabpanel"
          data-test="audit-panel-sql"
        >
          <div class="grid-three sql-audit-summary-grid">
            <article class="audit-card">
              <span class="audit-card__label">总 SQL 数</span>
              <strong class="audit-card__value">{{ sqlAuditData?.summary.totalCount ?? 0 }}</strong>
            </article>
            <article class="audit-card">
              <span class="audit-card__label">写 SQL 数</span>
              <strong class="audit-card__value">{{ sqlAuditData?.summary.writeCount ?? 0 }}</strong>
            </article>
            <article class="audit-card">
              <span class="audit-card__label">失败数</span>
              <strong class="audit-card__value">{{ sqlAuditData?.summary.failedCount ?? 0 }}</strong>
            </article>
            <article class="audit-card">
              <span class="audit-card__label">阻断数</span>
              <strong class="audit-card__value">{{ sqlAuditData?.summary.blockedCount ?? 0 }}</strong>
            </article>
            <article class="audit-card">
              <span class="audit-card__label">高风险数</span>
              <strong class="audit-card__value">{{ sqlAuditData?.summary.highRiskCount ?? 0 }}</strong>
            </article>
            <article class="audit-card">
              <span class="audit-card__label">平均耗时</span>
              <strong class="audit-card__value">{{ sqlAuditData?.summary.averageDurationMs ?? 0 }}ms</strong>
            </article>
          </div>

          <section class="panel">
            <div class="panel__header">
              <h2 class="table-panel__title">
                SQL 审计检索
              </h2>
            </div>
            <div class="panel__body">
              <div class="grid-three">
                <el-input
                  v-model="sqlFilters.actorId"
                  class="input"
                  placeholder="按用户名筛选"
                  :prefix-icon="UiIcons.user"
                  @keyup.enter="handleSqlAuditQuery"
                />
                <el-input
                  v-model="sqlFilters.moduleKey"
                  class="input"
                  placeholder="按模块标识筛选"
                  :prefix-icon="UiIcons.audit"
                  @keyup.enter="handleSqlAuditQuery"
                />
                <el-select
                  v-model="sqlFilters.databaseRole"
                  class="input"
                  placeholder="数据库角色：全部"
                >
                  <el-option
                    v-for="item in sqlDatabaseRoleOptions"
                    :key="item.value"
                    :value="item.value"
                    :label="item.label"
                  />
                </el-select>
                <el-select
                  v-model="sqlFilters.stage"
                  class="input"
                  placeholder="执行阶段：全部"
                >
                  <el-option
                    v-for="item in sqlStageOptions"
                    :key="item.value"
                    :value="item.value"
                    :label="item.label"
                  />
                </el-select>
                <el-select
                  v-model="sqlFilters.operationType"
                  class="input"
                  placeholder="操作类型：全部"
                >
                  <el-option
                    v-for="item in sqlOperationTypeOptions"
                    :key="item.value"
                    :value="item.value"
                    :label="item.label"
                  />
                </el-select>
                <el-select
                  v-model="sqlFilters.status"
                  class="input"
                  placeholder="执行状态：全部"
                >
                  <el-option
                    v-for="item in sqlStatusOptions"
                    :key="item.value"
                    :value="item.value"
                    :label="item.label"
                  />
                </el-select>
                <el-input
                  v-model="sqlFilters.tableName"
                  class="input"
                  placeholder="按表名筛选"
                  :prefix-icon="UiIcons.search"
                  @keyup.enter="handleSqlAuditQuery"
                />
                <el-input
                  v-model="sqlFilters.requestId"
                  class="input"
                  placeholder="按请求 ID 筛选"
                  :prefix-icon="UiIcons.search"
                  @keyup.enter="handleSqlAuditQuery"
                />
                <el-input
                  v-model="sqlFilters.sessionId"
                  class="input"
                  placeholder="按会话 ID 筛选"
                  :prefix-icon="UiIcons.search"
                  @keyup.enter="handleSqlAuditQuery"
                />
              </div>
              <div class="audit-filter-actions">
                <el-button
                  class="button-primary"
                  type="primary"
                  :disabled="sqlAuditLoading"
                  :loading="sqlAuditLoading"
                  @click="handleSqlAuditQuery"
                >
                  <el-icon v-if="!sqlAuditLoading">
                    <component :is="UiIcons.filter" />
                  </el-icon>
                  {{ sqlAuditLoading ? '查询中...' : '查询' }}
                </el-button>
              </div>
            </div>
          </section>

          <section class="panel">
            <div class="panel__header">
              <h2 class="table-panel__title">
                SQL 明细
              </h2>
            </div>
            <div class="panel__body">
              <div class="table-wrap">
                <el-table
                  class="table"
                  :data="sqlAuditData?.items ?? []"
                  stripe
                  border
                  empty-text="暂无 SQL 审计记录。"
                >
                  <el-table-column
                    label="时间"
                    min-width="160"
                  >
                    <template #default="{ row }">
                      {{ formatAuditTimestamp(row.createdAt) }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    label="用户名"
                    min-width="140"
                  >
                    <template #default="{ row }">
                      {{ row.actorName || row.actorId || '--' }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    label="模块"
                    min-width="140"
                  >
                    <template #default="{ row }">
                      {{ formatSqlAuditModuleLabel(row.moduleKey) }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    label="数据库角色"
                    min-width="130"
                  >
                    <template #default="{ row }">
                      {{ formatSqlAuditDatabaseRoleLabel(row.databaseRole) }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    label="执行阶段"
                    min-width="130"
                  >
                    <template #default="{ row }">
                      {{ formatSqlAuditStageLabel(row.stage) }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    label="操作类型"
                    min-width="130"
                  >
                    <template #default="{ row }">
                      {{ formatSqlAuditOperationTypeLabel(row.operationType) }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    label="命中表"
                    min-width="180"
                  >
                    <template #default="{ row }">
                      {{ row.tables.join('、') || '--' }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    label="执行状态"
                    min-width="120"
                  >
                    <template #default="{ row }">
                      {{ formatBusinessCodeText(row.status) }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    label="耗时"
                    min-width="100"
                  >
                    <template #default="{ row }">
                      {{ row.durationMs === undefined ? '--' : `${row.durationMs}ms` }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    label="详情"
                    min-width="120"
                    fixed="right"
                    class-name="table-action-column"
                  >
                    <template #default="{ row }">
                      <div class="table-action-buttons">
                        <el-button
                          class="table-action-link"
                          text
                          type="primary"
                          @click="openSqlAuditDetail(row)"
                        >
                          查看详情
                        </el-button>
                      </div>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
              <div class="audit-table-pagination">
                <el-pagination
                  background
                  layout="total, sizes, prev, pager, next"
                  :current-page="sqlAuditPagination.page"
                  :page-size="sqlAuditPagination.pageSize"
                  :page-sizes="auditPageSizeOptions"
                  :total="sqlAuditData?.total ?? 0"
                  @current-change="handleSqlAuditPageChange"
                  @size-change="handleSqlAuditPageSizeChange"
                />
              </div>
            </div>
          </section>
        </section>
      </div>
    </section>

    <el-drawer
      v-model="sqlAuditDetailVisible"
      title="SQL 审计详情"
      size="42%"
      destroy-on-close
    >
      <div
        v-if="sqlAuditDetailLoading"
        class="empty-state"
      >
        正在加载 SQL 审计详情...
      </div>
      <div
        v-else-if="selectedSqlAudit"
        class="audit-detail-drawer"
      >
        <div class="audit-detail-grid">
          <div class="audit-detail-block">
            <span class="audit-card__label">行为人</span>
            <strong>{{ selectedSqlAudit.actorName || selectedSqlAudit.actorId || '--' }}</strong>
          </div>
          <div class="audit-detail-block">
            <span class="audit-card__label">模块</span>
            <strong>{{ formatSqlAuditModuleLabel(selectedSqlAudit.moduleKey) }}</strong>
          </div>
          <div class="audit-detail-block">
            <span class="audit-card__label">数据库角色</span>
            <strong>{{ formatSqlAuditDatabaseRoleLabel(selectedSqlAudit.databaseRole) }}</strong>
          </div>
          <div class="audit-detail-block">
            <span class="audit-card__label">执行阶段</span>
            <strong>{{ formatSqlAuditStageLabel(selectedSqlAudit.stage) }}</strong>
          </div>
          <div class="audit-detail-block">
            <span class="audit-card__label">操作类型</span>
            <strong>{{ formatSqlAuditOperationTypeLabel(selectedSqlAudit.operationType) }}</strong>
          </div>
          <div class="audit-detail-block">
            <span class="audit-card__label">执行状态</span>
            <strong>{{ formatBusinessCodeText(selectedSqlAudit.status) }}</strong>
          </div>
        </div>

        <div class="audit-detail-actions">
          <el-button
            v-if="selectedSqlAudit.canRevealSensitive"
            class="button-secondary"
            :loading="sqlAuditRevealLoading"
            @click="revealCurrentSqlAudit"
          >
            {{ sqlAuditRevealLoading ? '加载中...' : '查看完整 SQL / 参数' }}
          </el-button>
          <span
            v-else
            class="audit-card__label"
          >
            当前账号仅可查看脱敏摘要，完整 SQL 需额外敏感权限。
          </span>
        </div>

        <div
          v-if="selectedSqlAudit.behaviorContext"
          class="audit-detail-block"
        >
          <span class="audit-card__label">行为上下文</span>
          <strong>{{ selectedSqlAudit.behaviorContext.title }}</strong>
          <p>{{ selectedSqlAudit.behaviorContext.summary }}</p>
          <div
            v-if="
              selectedSqlAudit.behaviorContext.originalQuestion ||
                selectedSqlAudit.behaviorContext.requestStatus ||
                selectedSqlAudit.behaviorContext.temporalLabel ||
                selectedSqlAudit.behaviorContext.taskTitles?.length
            "
            class="audit-detail-inline-list"
          >
            <span v-if="selectedSqlAudit.behaviorContext.originalQuestion">
              原始问题：{{ selectedSqlAudit.behaviorContext.originalQuestion }}
            </span>
            <span v-if="selectedSqlAudit.behaviorContext.requestStatus">
              请求状态：{{ formatBusinessCodeText(selectedSqlAudit.behaviorContext.requestStatus) }}
            </span>
            <span v-if="selectedSqlAudit.behaviorContext.temporalLabel">
              时间口径：{{ selectedSqlAudit.behaviorContext.temporalLabel }}
            </span>
            <span v-if="selectedSqlAudit.behaviorContext.taskTitles?.length">
              执行任务：{{ selectedSqlAudit.behaviorContext.taskTitles.join('、') }}
            </span>
          </div>
        </div>

        <div class="audit-detail-block">
          <span class="audit-card__label">脱敏 SQL 摘要</span>
          <pre class="audit-detail-code">{{ selectedSqlAudit.sqlSummary }}</pre>
        </div>
        <div class="audit-detail-block">
          <span class="audit-card__label">参数摘要</span>
          <pre class="audit-detail-code">{{ selectedSqlAudit.paramSummary }}</pre>
        </div>
        <div class="audit-detail-block">
          <span class="audit-card__label">命中表</span>
          <p>{{ selectedSqlAudit.tables.join('、') || '--' }}</p>
        </div>
        <div class="audit-detail-grid">
          <div class="audit-detail-block">
            <span class="audit-card__label">请求 ID</span>
            <strong>{{ selectedSqlAudit.requestId || '--' }}</strong>
          </div>
          <div class="audit-detail-block">
            <span class="audit-card__label">会话 ID</span>
            <strong>{{ selectedSqlAudit.sessionId || '--' }}</strong>
          </div>
          <div class="audit-detail-block">
            <span class="audit-card__label">耗时</span>
            <strong>{{ selectedSqlAudit.durationMs === undefined ? '--' : `${selectedSqlAudit.durationMs}ms` }}</strong>
          </div>
          <div class="audit-detail-block">
            <span class="audit-card__label">影响行数</span>
            <strong>{{ selectedSqlAudit.affectedRows ?? selectedSqlAudit.rowCount ?? '--' }}</strong>
          </div>
        </div>
        <div
          v-if="selectedSqlAudit.errorSummary"
          class="audit-detail-block"
        >
          <span class="audit-card__label">错误摘要</span>
          <pre class="audit-detail-code">{{ selectedSqlAudit.errorSummary }}</pre>
        </div>
        <div
          v-if="revealedSqlAudit"
          class="audit-detail-block"
          data-test="sql-audit-reveal-result"
        >
          <span class="audit-card__label">完整 SQL</span>
          <pre class="audit-detail-code">{{ revealedSqlAudit.sqlText }}</pre>
          <span class="audit-card__label">完整参数</span>
          <pre class="audit-detail-code">{{ JSON.stringify(revealedSqlAudit.params, null, 2) }}</pre>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

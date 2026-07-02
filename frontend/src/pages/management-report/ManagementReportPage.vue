<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import ManagementReportFilters from '@/components/management-report/ManagementReportFilters.vue';
import ManagementSectionCanvas from '@/components/management-report/ManagementSectionCanvas.vue';
import ManagementSectionTabs from '@/components/management-report/ManagementSectionTabs.vue';
import { markPageDataReady } from '@/services/navigation-performance.service';
import { managementReportService } from '@/services/management-report.service';
import { useAuthStore } from '@/stores/auth.store';
import type {
  ManagementReportExportPayload,
  ManagementReportFilter,
  ManagementReportOptionsPayload,
  ManagementReportPresetKey,
  ManagementReportSectionKey,
  ManagementReportSectionPayload,
  ManagementReportSnapshot,
  ManagementReportTabItem,
  ManagementReportTabKey,
} from '@/types/management-report';
import { toUserFacingErrorMessage } from '@/utils/user-facing-error';

const authStore = useAuthStore();
const options = ref<ManagementReportOptionsPayload | null>(null);
const snapshot = ref<ManagementReportSnapshot | null>(null);
const activeSectionKey = ref<ManagementReportTabKey>('overview');
const sectionPayloads = ref<Record<string, ManagementReportSectionPayload>>({});
const pageState = ref<'loading' | 'ready' | 'forbidden' | 'error'>('loading');
const pageError = ref('经营报表初始化失败，请稍后重试。');
const snapshotLoading = ref(false);
const sectionLoadingKey = ref<string>();
const exportLoading = ref(false);

const filters = ref<ManagementReportFilter>({
  departmentId: 'all-company',
  presetKey: 'q1',
  startDate: '',
  endDate: '',
});

const exportAllowed = computed(() =>
  authStore.hasAction('management.report.export'),
);
const tabItems = computed<ManagementReportTabItem[]>(() => {
  if (!snapshot.value) {
    return [];
  }

  return [
    {
      sectionKey: 'overview',
      title: '总览',
      summary: snapshot.value.overview.summary,
      state: snapshot.value.overview.state ?? 'ready',
      timeBasis: '首屏总览统一观察核心指标与漏斗承接关系。',
      loadMode: 'eager',
      available: true,
    },
    {
      sectionKey: 'executive-summary',
      title: '经营摘要',
      summary: snapshot.value.executiveSummary.summary,
      state: snapshot.value.executiveSummary.state ?? 'ready',
      timeBasis: '管理层摘要聚焦结论、动作、风险与关键指标。',
      loadMode: 'eager',
      available: true,
    },
    ...snapshot.value.sections,
  ];
});
const activeSectionMeta = computed(() =>
  tabItems.value.find((item) => item.sectionKey === activeSectionKey.value),
);
const activeSectionPayload = computed(() => {
  if (activeSectionKey.value === 'overview') {
    return snapshot.value?.overview;
  }

  if (activeSectionKey.value === 'executive-summary') {
    return snapshot.value?.executiveSummary;
  }

  return activeSectionKey.value
    ? sectionPayloads.value[activeSectionKey.value as ManagementReportSectionKey]?.section
    : undefined;
});
const activeSectionRetryable = computed(
  () =>
    activeSectionKey.value !== 'overview' &&
    activeSectionKey.value !== 'executive-summary' &&
    activeSectionPayload.value?.state === 'degraded',
);

/**
 * 将经营报表快捷时间项统一解析成真实起止日期，保持前端展示与后端口径一致。
 */
function resolvePresetDateRange(
  presetKey: ManagementReportPresetKey,
): Pick<ManagementReportFilter, 'startDate' | 'endDate'> | undefined {
  if (presetKey === 'custom') {
    return undefined;
  }

  const referenceDate = new Date();
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth() + 1;

  if (presetKey === 'q1') {
    return { startDate: `${year}-01-01`, endDate: `${year}-03-31` };
  }
  if (presetKey === 'q2') {
    return { startDate: `${year}-04-01`, endDate: `${year}-06-30` };
  }
  if (presetKey === 'q3') {
    return { startDate: `${year}-07-01`, endDate: `${year}-09-30` };
  }
  if (presetKey === 'q4') {
    return { startDate: `${year}-10-01`, endDate: `${year}-12-31` };
  }
  if (presetKey === 'this-year') {
    return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
  }
  if (presetKey === 'this-month') {
    const paddedMonth = String(month).padStart(2, '0');
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return {
      startDate: `${year}-${paddedMonth}-01`,
      endDate: `${year}-${paddedMonth}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  const endDate = new Date();
  const startDate = new Date();
  const offsetDays = presetKey === 'last-30-days' ? 29 : 89;
  startDate.setUTCDate(endDate.getUTCDate() - offsetDays);
  return {
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
  };
}

/**
 * 接住筛选组件的任意更新后统一归一化，避免快捷项、起止日期与真实请求参数出现分叉。
 */
function handleUpdateFilters(nextFilter: ManagementReportFilter): void {
  const presetRange = resolvePresetDateRange(nextFilter.presetKey);

  filters.value = presetRange
    ? {
        ...nextFilter,
        startDate: presetRange.startDate,
        endDate: presetRange.endDate,
      }
    : nextFilter;
}

/**
 * 页面挂载时初始化经营报表，先取 options，再拉首屏核心快照。
 */
async function initializePage(): Promise<void> {
  pageState.value = 'loading';
  pageError.value = '经营报表初始化失败，请稍后重试。';

  try {
    options.value = await managementReportService.getOptions();
    filters.value = { ...options.value.defaultFilter };
    await fetchSnapshot();
    pageState.value = 'ready';
    markPageDataReady('/management-report');
  } catch (error) {
    const message = toUserFacingErrorMessage(
      error,
      '经营报表暂时没有加载成功，请稍后刷新重试；如果多次失败，请联系管理员。',
    );

    // 权限拒绝需要给出明确页面态，避免用户只看到通用失败提示。
    if (message.includes('无权') || message.includes('未登录')) {
      pageState.value = 'forbidden';
      pageError.value = message;
      return;
    }

    pageState.value = 'error';
    pageError.value = message;
  }
}

/**
 * 拉取首屏核心快照，并清空旧专题详情，保证筛选刷新后不复用旧上下文结果。
 */
async function fetchSnapshot(): Promise<void> {
  snapshotLoading.value = true;
  try {
    snapshot.value = await managementReportService.getSnapshot({ ...filters.value });
    sectionPayloads.value = {};
    activeSectionKey.value = 'overview';
  } finally {
    snapshotLoading.value = false;
  }
}

/**
 * 响应筛选栏刷新动作，刷新时保持页面停留在就绪态但更新核心摘要。
 */
async function handleApplyFilters(): Promise<void> {
  try {
    await fetchSnapshot();
  } catch (error) {
    ElMessage.error(
      toUserFacingErrorMessage(
        error,
        '经营报表暂时没有刷新成功，请稍后重试；如果多次失败，请联系管理员。',
      ),
    );
  }
}

/**
 * 切换专题时按需加载详情，避免首次进入页面就触发全部重专题请求。
 */
async function handleSelectSection(sectionKey: string): Promise<void> {
  activeSectionKey.value = sectionKey as ManagementReportTabKey;
  await loadSection(sectionKey as ManagementReportTabKey);
}

async function loadSection(
  sectionKey: ManagementReportTabKey,
  force = false,
): Promise<void> {
  const meta = tabItems.value.find((item) => item.sectionKey === sectionKey);

  if (
    !snapshot.value ||
    sectionKey === 'overview' ||
    sectionKey === 'executive-summary' ||
    !meta?.available ||
    (!force && sectionPayloads.value[sectionKey as ManagementReportSectionKey]?.section.state !== 'degraded' && sectionPayloads.value[sectionKey as ManagementReportSectionKey])
  ) {
    return;
  }

  sectionLoadingKey.value = sectionKey;
  try {
    const payload = await managementReportService.getSection(
      sectionKey as ManagementReportSectionKey,
      { reportId: snapshot.value.reportId, filter: { ...filters.value } },
    );
    sectionPayloads.value = {
      ...sectionPayloads.value,
      [sectionKey]: payload,
    };
  } catch (error) {
    const message = toUserFacingErrorMessage(
      error,
      '当前专题暂时加载失败，请稍后重试，或切换其它专题继续查看。',
    );
    sectionPayloads.value = {
      ...sectionPayloads.value,
      [sectionKey]: {
        reportId: snapshot.value.reportId,
        sectionKey: sectionKey as ManagementReportSectionKey,
        generatedAt: snapshot.value.meta.generatedAt,
        timeBasis: meta?.timeBasis ?? '当前专题时间口径暂不可用。',
        scopeBasis: snapshot.value.meta.scopeSummary,
        section: {
          sectionKey: sectionKey as ManagementReportSectionKey,
          title: meta?.title ?? String(sectionKey),
          summary: message,
          state: 'degraded',
          blocks: [],
          footnotes: ['当前专题加载失败，可点击重试重新获取数据。'],
          emptyReason: message,
        },
      },
    };
    ElMessage.error(message);
  } finally {
    sectionLoadingKey.value = undefined;
  }
}

async function retryActiveSection(): Promise<void> {
  if (activeSectionKey.value === 'overview' || activeSectionKey.value === 'executive-summary') {
    return;
  }

  await loadSection(activeSectionKey.value, true);
}

/**
 * 导出当前报表上下文，并在浏览器侧生成下载链接。
 */
async function handleExport(): Promise<void> {
  if (!snapshot.value || exportLoading.value || !exportAllowed.value) {
    return;
  }

  exportLoading.value = true;
  try {
    const payload = await managementReportService.exportReport({
      reportId: snapshot.value.reportId,
      format: 'csv',
      filter: { ...filters.value },
    });
    downloadExport(payload);
    ElMessage.success('经营报表已开始导出。');
  } catch (error) {
    ElMessage.error(
      toUserFacingErrorMessage(
        error,
        '经营报表暂时无法导出，请稍后重试；如果多次失败，请联系管理员。',
      ),
    );
  } finally {
    exportLoading.value = false;
  }
}

/**
 * 根据导出返回值构造浏览器下载，测试环境若不支持下载能力则静默跳过。
 */
function downloadExport(payload: ManagementReportExportPayload): void {
  if (
    typeof window === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    return;
  }

  const blob = new Blob([payload.content], { type: payload.mimeType });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = payload.fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}

onMounted(() => {
  void initializePage();
});

onActivated(() => {
  if (pageState.value === 'ready') {
    markPageDataReady('/management-report');
  }
});
</script>

<template>
  <div class="management-report-page">
    <div
      v-if="pageState === 'forbidden'"
      class="management-report-page__state"
    >
      <h2>当前无权查看经营报表</h2>
      <p>{{ pageError }}</p>
    </div>
    <div
      v-else-if="pageState === 'error'"
      class="management-report-page__state"
    >
      <h2>经营报表暂不可用</h2>
      <p>{{ pageError }}</p>
    </div>
    <template v-else>
      <ManagementReportFilters
        v-if="options"
        :model-value="filters"
        :departments="options.departments"
        :presets="options.presets"
        :loading="snapshotLoading"
        :meta="snapshot?.meta"
        :export-allowed="exportAllowed"
        :export-loading="exportLoading"
        @update:model-value="handleUpdateFilters"
        @apply="handleApplyFilters"
        @export="handleExport"
      />

      <ManagementSectionTabs
        v-if="snapshot"
        :sections="tabItems"
        :active-key="activeSectionKey"
        @select="handleSelectSection"
      />

      <ManagementSectionCanvas
        v-if="snapshot"
        :title="activeSectionMeta?.title"
        :section="activeSectionPayload"
        :loading="sectionLoadingKey === activeSectionKey && activeSectionKey !== 'overview' && activeSectionKey !== 'executive-summary'"
        :empty-text="activeSectionMeta?.available ? '点击专题后将按需加载详情。' : activeSectionMeta?.unavailableReason"
        :retryable="activeSectionRetryable"
        @retry="retryActiveSection"
      />
    </template>
  </div>
</template>

<style scoped>
.management-report-page {
  display: grid;
  gap: 14px;
  padding: 16px 18px;
  background:
    radial-gradient(circle at top left, rgba(125, 211, 252, 0.1), transparent 28%),
    linear-gradient(180deg, #fbfdff, #f5f9ff 42%, #f8fafc 100%);
}

.management-report-page__state {
  padding: 20px 18px;
  border-radius: 20px;
  background: #ffffff;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.05);
}

.management-report-page__state h2 {
  margin: 0 0 12px;
  color: #0f172a;
}

.management-report-page__state p {
  margin: 0;
  color: #64748b;
}

@media (max-width: 768px) {
  .management-report-page {
    padding: 12px;
  }
}
</style>

<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue';
import {
  ElButton,
  ElDialog,
  ElDrawer,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTag,
} from 'element-plus';
import { markPageDataReady } from '@/services/navigation-performance.service';
import { useRouter } from 'vue-router';
import AnalysisMarkdownPreview from '@/components/analysis/AnalysisMarkdownPreview.vue';
import AnalysisRichReportPanel from '@/components/analysis/AnalysisRichReportPanel.vue';
import AnalysisSectionCanvas from '@/components/analysis/AnalysisSectionCanvas.vue';
import BusinessEmptyState from '@/components/shared/BusinessEmptyState.vue';
import CommonQueryPanel from '@/components/analysis/CommonQueryPanel.vue';
import MetricCardGroup from '@/components/analysis/MetricCardGroup.vue';
import NumberToneText from '@/components/analysis/NumberToneText.vue';
import RecentQueryPanel from '@/components/analysis/RecentQueryPanel.vue';
import ResultChartView from '@/components/analysis/ResultChartView.vue';
import ResultTableView from '@/components/analysis/ResultTableView.vue';
import { analysisService } from '@/services/analysis.service';
import { useAnalysisQueryStore } from '@/stores/analysis-query.store';
import type { QueryTemplateItem } from '@/types/analysis';
import { UiIcons } from '@/ui/icons';
import {
  resolveFeedbackTone,
} from '@/ui/status-presentation';
import {
  isWideAnalysisTable,
  shouldTransposeAnalysisTable,
} from '@/utils/analysis-table-display';
import { toUserFacingErrorMessage } from '@/utils/user-facing-error';

const store = useAnalysisQueryStore();
const router = useRouter();
const isRecentQueryDrawerOpen = ref(false);
const commonPanelCollapsed = ref(false);
const commonPanelWidth = ref(340);
const isResizingCommonPanel = ref(false);
const saveTemplateDialogVisible = ref(false);
const saveTemplateForm = ref({
  name: '',
  description: '',
  tags: [] as string[],
});
const selectedTemplateId = ref<string | null>(null);
const selectedTemplateSnapshot = ref<QueryTemplateItem | null>(null);
const templateDetailForm = ref({
  name: '',
  description: '',
  defaultQuestionText: '',
  defaultViewType: 'DETAIL_TABLE',
  tags: [] as string[],
});
const isTemplateDetailLoading = ref(false);
const templateDetailErrorMessage = ref('');
const templateDetailDrawerVisible = ref(false);
const templateEditorDrawerVisible = ref(false);
const isCreatingTemplate = ref(false);
const isValidatingTemplate = ref(false);
const latestTemplateValidation = ref<QueryTemplateItem['validationSnapshot'] | null>(null);
const templateEditorForm = ref({
  name: '近一周新增商机明细',
  description: '查看近一周新增商机明细、负责人、销售阶段和预计有效收入。',
  tags: ['常用查询'] as string[],
  defaultViewType: 'DETAIL_TABLE',
  sqlText: `SELECT
  o.id AS opportunity_id,
  o.title AS project_name,
  ROUND(COALESCE(o.expect_amount, 0) / 10000, 2) AS expected_amount,
  DATE_FORMAT(o.created_at, '%Y-%m-%d') AS created_at
FROM opportunities o
ORDER BY o.created_at DESC
LIMIT 20`,
  status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
});
const hiddenTemplateSystemTags = new Set(['猜你想查', '常用查询', '内置模板']);

const report = computed(() => store.currentResult?.report);
const metricCards = computed(
  () => report.value?.resultBundle?.metricCards ?? report.value?.metricCards ?? store.currentResult?.metricCards ?? [],
);
const hasResult = computed(() => store.hasResult);
const keyFindings = computed(() => report.value?.keyFindings ?? store.currentResult?.keyFindings ?? []);
const primaryChart = computed(() => report.value?.chartBlocks?.[0] ?? report.value?.resultBundle?.primaryBlock);
const primaryTable = computed(() => report.value?.tableBlocks?.[0] ?? report.value?.resultBundle?.primaryBlock);
const primaryTableColumns = computed(() => {
  const block = primaryTable.value as
    | { columns?: Array<{ key: string; label: string; width?: number }> }
    | undefined;
  return block?.columns ?? store.currentResult?.primaryView?.columns;
});
const primaryTableRows = computed(() => primaryTable.value?.rows ?? store.currentResult?.tableRows ?? []);
const resultTitle = computed(() => report.value?.reportTitle ?? store.currentResult?.title ?? 'AI 分析报告');
const resultSummary = computed(() => report.value?.executiveSummary ?? store.currentResult?.summary ?? '请输入问题，系统会返回对应的分析报告。');
const resultExplanation = computed(() => report.value?.explanation ?? store.currentResult?.explanation ?? '');
const resultMarkdown = computed(
  () =>
    report.value?.insightBundle?.groundedMarkdown ??
    report.value?.detailMarkdown ??
    report.value?.groundedMarkdown ??
    store.currentResult?.groundedMarkdown ??
    '',
);
const temporalScope = computed(() => report.value?.temporalScope ?? store.currentResult?.temporalScope);
const richReportReady = computed(() =>
  Boolean(
    report.value?.detailMarkdown ||
    report.value?.analysisConfidence ||
    report.value?.forecastInsight ||
    report.value?.recommendations?.length,
  ),
);
const pendingInsightBundle = computed(() => ({
  status: 'PENDING' as const,
  groundedMarkdown: '',
}));
const hasChartData = computed(() => Boolean(primaryChart.value?.series?.length));
const hasTableData = computed(() => Boolean(primaryTable.value?.rows?.length || store.currentResult?.tableRows?.length));
const shouldUseWideTableLayout = computed(() =>
  hasTableData.value && isWideAnalysisTable(primaryTableColumns.value, primaryTableRows.value),
);
const hasSinglePrimaryResult = computed(() => {
  return (hasChartData.value && !hasTableData.value) || (!hasChartData.value && hasTableData.value);
});
const shouldUseStackedVisualLayout = computed(() => {
  return hasChartData.value && hasTableData.value;
});
const shouldTransposePrimaryTable = computed(() =>
  shouldTransposeAnalysisTable(
    primaryTableColumns.value,
    primaryTableRows.value,
    shouldUseStackedVisualLayout.value,
  ),
);
const analysisAllowed = computed(() => store.capabilities?.actionKeys.includes('analysis.use') ?? false);
const exportAllowed = computed(() => store.capabilities?.exportAllowed ?? false);
const followUpAllowed = computed(() => store.capabilities?.followUpAllowed ?? false);
const templateViewAllowed = computed(() => store.capabilities?.templateViewAllowed ?? false);
const templatePanelLoading = computed(() =>
  store.isTemplateListLoading || store.isBootstrapping || (!store.bootstrapped && store.templates.length === 0),
);
const templateCreateAllowed = computed(
  () =>
    store.capabilities?.actionKeys.includes('template.manage') ||
    store.capabilities?.actionKeys.includes('template.sql.write') ||
    false,
);
const feedbackSurfaceTone = computed(() => resolveFeedbackTone(store.feedbackTone));
const analysisStateNotice = computed(() => {
  if (store.viewState === 'clarifying') {
    return {
      title: '还需要补充一点查询条件',
      description:
        store.currentResult?.clarificationPrompt ??
        store.feedbackMessage ??
        '当前问题还缺少必要条件，请按提示补充后再继续分析。',
    };
  }

  if (store.viewState === 'blocked') {
    return {
      title: '这次查询没有通过安全校验',
      description:
        store.currentResult?.clarificationPrompt ??
        store.feedbackMessage ??
        '请把问题调整为只读经营分析，例如查询客户、商机、订单、区域或渠道商相关数据。',
    };
  }

  if (store.viewState === 'queued') {
    return {
      title: '当前会话已有请求处理中',
      description:
        store.currentResult?.queueNotice ??
        store.feedbackMessage ??
        '请等上一条分析完成后再重新点击“开始分析”。',
    };
  }

  if (store.viewState === 'failed') {
    return {
      title: '本次分析暂时没有成功',
      description:
        store.errorMessage ||
        store.feedbackMessage ||
        '请稍后重试；如果连续失败，请先到连接配置和 AI 配置页面做健康检查。',
    };
  }

  return null;
});
const selectedTemplate = computed(() => selectedTemplateSnapshot.value);
const selectedTemplateOwnerDisplayName = computed(() => {
  const template = selectedTemplate.value;
  if (!template) {
    return '系统模板';
  }
  return template.ownerName?.trim() || template.ownerUserId || '系统模板';
});
const canSaveTemplateDetail = computed(() =>
  Boolean(
    selectedTemplate.value &&
      templateDetailForm.value.name.trim() &&
      templateDetailForm.value.description.trim() &&
      templateDetailForm.value.defaultQuestionText.trim(),
  ),
);
const visibleTemplateDetailTagOptions = computed(() =>
  normalizeBusinessTemplateTags(store.templateListMeta.tags),
);
const templateStatusEnabled = computed({
  get: () => templateEditorForm.value.status === 'ACTIVE',
  set: (value: boolean) => {
    templateEditorForm.value.status = value ? 'ACTIVE' : 'INACTIVE';
  },
});
const analysisRouteOptions = computed(() => {
  const defaultRoute = store.capabilities?.defaultAnalysisRoute;
  const defaultLabel = defaultRoute === 'SQLITE_READONLY'
    ? '跟随后端默认（SQLite）'
    : '跟随后端默认（OpenAPI）';
  return [
    {
      route: 'DEFAULT',
      label: defaultLabel,
      enabled: true,
      description: '使用后端环境配置的默认分析路线。',
    },
    ...(store.capabilities?.analysisRoutes ?? []),
  ];
});

/**
 * 统一处理输入框回车提交，确保键盘触发与按钮点击走同一条受控查询链路。
 * 这里额外复用按钮的禁用条件，避免在加载、初始化或无权限时误发请求。
 */
function submitQueryFromKeyboard(): void {
  if (store.isSubmitting || store.isBootstrapping || !analysisAllowed.value) {
    return;
  }

  void store.submitQuery();
}

function openDetail(): void {
  if (!store.currentResult?.queryId) {
    return;
  }

  void router.push({
    name: 'analysis-result-detail',
    params: { queryId: store.currentResult.queryId },
  });
}

/**
 * 首页追问沿用当前结果上下文，避免用户必须跳转详情页才能改条件或补充解释问题。
 */
function submitFollowUpFromKeyboard(): void {
  if (store.isSubmittingFollowUp || store.isSubmitting || !followUpAllowed.value) {
    return;
  }

  void store.submitFollowUp();
}

function openRecentQueryDrawer(): void {
  isRecentQueryDrawerOpen.value = true;
}

async function runTemplateFromPanel(templateId: string): Promise<void> {
  await store.runTemplate(templateId);
}

async function runSelectedTemplateFromDetail(): Promise<void> {
  const templateId = selectedTemplate.value?.templateId;
  if (!templateId) {
    return;
  }

  await store.runTemplate(templateId);
  if (!store.errorMessage) {
    templateDetailDrawerVisible.value = false;
  }
}

async function queryTemplates(params: {
  scope: 'mine' | 'others';
  keyword?: string;
  tag?: string;
  ownerUserId?: string;
  page?: number;
  pageSize?: number;
}): Promise<void> {
  await store.refreshTemplates({
    ...params,
    sort: 'usage_desc',
  });
}

async function openTemplateDetail(templateId: string): Promise<void> {
  const matchedTemplate = store.templates.find((item) => item.templateId === templateId);
  const matchedRecommendation = store.capabilities?.queryAssetSummary?.recommendedTemplates.find(
    (item) => item.templateId === templateId,
  );

  selectedTemplateId.value = templateId;
  templateDetailErrorMessage.value = '';
  selectedTemplateSnapshot.value = matchedTemplate ?? (matchedRecommendation
    ? {
        templateId: matchedRecommendation.templateId,
        name: matchedRecommendation.name,
        description: matchedRecommendation.description,
        defaultQuestionText: matchedRecommendation.name,
        defaultFilters: {},
        visibleRoleIds: [],
        displayOrder: 0,
        clickCount7d: 0,
        hitRatePercent: 0,
        optimizationStatus: 'HEALTHY',
        status: 'ACTIVE',
        updatedAt: '',
      }
    : null);
  syncTemplateDetailForm(selectedTemplateSnapshot.value);
  templateDetailDrawerVisible.value = true;

  isTemplateDetailLoading.value = true;
  try {
    selectedTemplateSnapshot.value = await analysisService.getTemplate(templateId);
    syncTemplateDetailForm(selectedTemplateSnapshot.value);
  } catch (error) {
    templateDetailErrorMessage.value = toUserFacingErrorMessage(
      error,
      '完整模板内容暂时没有加载成功，请稍后重试。',
    );
    ElMessage.warning(templateDetailErrorMessage.value);
  } finally {
    isTemplateDetailLoading.value = false;
  }
}

/**
 * 将模板详情快照同步到抽屉表单。
 * 设计原因：抽屉允许编辑基础展示信息，但 SQL、权限和归属仍由后端保存边界控制。
 */
function syncTemplateDetailForm(template: QueryTemplateItem | null): void {
  templateDetailForm.value = {
    name: template?.name ?? '',
    description: template?.description ?? '',
    defaultQuestionText: template?.defaultQuestionText ?? template?.name ?? '',
    defaultViewType:
      template?.defaultViewType ?? template?.renderConfig?.primaryViewType ?? 'DETAIL_TABLE',
    tags: normalizeBusinessTemplateTags(template?.tags ?? []),
  };
}

function normalizeBusinessTemplateTags(tags: string[]): string[] {
  return Array.from(
    new Set(
      tags
        .map((item) => item.trim())
        .filter((item) => item && !hiddenTemplateSystemTags.has(item)),
    ),
  );
}

async function saveTemplateDetail(): Promise<void> {
  if (!selectedTemplate.value || !canSaveTemplateDetail.value) {
    ElMessage.warning('请先补全模板名称、说明和默认问题后再保存。');
    return;
  }

  const updatedTemplate = await store.updateMyTemplate(selectedTemplate.value.templateId, {
    name: templateDetailForm.value.name.trim(),
    description: templateDetailForm.value.description.trim(),
    defaultQuestionText: templateDetailForm.value.defaultQuestionText.trim(),
    defaultViewType: templateDetailForm.value.defaultViewType,
    tags: normalizeBusinessTemplateTags(templateDetailForm.value.tags),
  });
  if (updatedTemplate) {
    selectedTemplateSnapshot.value = updatedTemplate;
    syncTemplateDetailForm(updatedTemplate);
    templateDetailDrawerVisible.value = false;
  }
}

function openTemplateEditor(): void {
  latestTemplateValidation.value = null;
  templateEditorDrawerVisible.value = true;
}

function resolvePrimaryViewType(defaultViewType: string): string {
  if (defaultViewType === 'BAR_CHART' || defaultViewType === 'LINE_CHART' || defaultViewType === 'RANKING_TABLE') {
    return defaultViewType;
  }
  return 'TABLE';
}

function buildWorkbenchTemplatePayload(): Record<string, unknown> {
  const name = templateEditorForm.value.name.trim();
  const description = templateEditorForm.value.description.trim();
  const sqlText = templateEditorForm.value.sqlText.trim();

  if (!name) {
    throw new Error('模板名称不能为空。');
  }
  if (!description) {
    throw new Error('模板说明不能为空。');
  }
  if (!sqlText) {
    throw new Error('查询 SQL 不能为空。');
  }

  return {
    name,
    description,
    tags: templateEditorForm.value.tags.map((item) => item.trim()).filter(Boolean),
    defaultQuestionText: name,
    defaultFilters: {},
    defaultViewType: templateEditorForm.value.defaultViewType,
    sqlText,
    parameterSchema: [],
    renderConfig: {
      primaryViewType: resolvePrimaryViewType(templateEditorForm.value.defaultViewType),
      primaryTitle: name,
    },
    visibleRoleIds: [],
    displayOrder: 99,
    status: templateEditorForm.value.status,
  };
}

async function validateWorkbenchTemplate(showSuccessMessage = true): Promise<void> {
  if (isValidatingTemplate.value) {
    return;
  }

  try {
    isValidatingTemplate.value = true;
    const sqlText = templateEditorForm.value.sqlText.trim();
    if (!sqlText) {
      throw new Error('查询 SQL 不能为空。');
    }
    const response = await analysisService.validateGovernanceTemplate('draft_template', { sqlText });
    latestTemplateValidation.value = {
      status: (response.status as 'PASSED' | 'FAILED') ?? 'PASSED',
      message: String(response.message ?? '模板 SQL 校验通过。'),
      scopeAnalysis:
        typeof response.scopeAnalysis === 'object' && response.scopeAnalysis
          ? (response.scopeAnalysis as NonNullable<NonNullable<QueryTemplateItem['validationSnapshot']>['scopeAnalysis']>)
          : undefined,
    };
    if (showSuccessMessage) {
      ElMessage.success(String(response.message ?? '模板 SQL 校验通过。'));
    }
  } catch (error) {
    latestTemplateValidation.value = null;
    if (showSuccessMessage) {
      ElMessage.error(
        toUserFacingErrorMessage(
          error,
          '模板 SQL 暂时没有校验通过，请检查 SQL 后再试。',
        ),
      );
    }
    throw error;
  } finally {
    isValidatingTemplate.value = false;
  }
}

async function createWorkbenchTemplate(): Promise<void> {
  if (isCreatingTemplate.value) {
    return;
  }

  try {
    const payload = buildWorkbenchTemplatePayload();
    isCreatingTemplate.value = true;
    await validateWorkbenchTemplate(false);
    await analysisService.createGovernanceTemplate(payload);
    ElMessage.success('模板已创建。');
    templateEditorDrawerVisible.value = false;
    await store.refreshTemplates({ scope: 'mine', sort: 'usage_desc' });
  } catch (error) {
    ElMessage.error(
      toUserFacingErrorMessage(
        error,
        '模板暂时没有创建成功，请检查填写内容后再试。',
      ),
    );
  } finally {
    isCreatingTemplate.value = false;
  }
}

async function confirmDeleteMyTemplate(templateId: string): Promise<void> {
  const template = store.templates.find((item) => item.templateId === templateId);
  try {
    await ElMessageBox.confirm(
      `确认删除「${template?.name ?? '当前模板'}」吗？删除后不会自动恢复。`,
      '删除我的模板',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    );
  } catch {
    return;
  }

  await store.deleteMyTemplate(templateId);
  if (selectedTemplateId.value === templateId) {
    templateDetailDrawerVisible.value = false;
    selectedTemplateId.value = null;
    selectedTemplateSnapshot.value = null;
  }
}

function openSaveTemplateDialog(): void {
  const currentTitle = store.currentResult?.title || store.activeQuestionText || '我的查询模板';
  saveTemplateForm.value = {
    name: currentTitle,
    description: store.currentResult?.summary || '由当前分析结果保存生成。',
    tags: [],
  };
  saveTemplateDialogVisible.value = true;
}

async function saveCurrentResultAsTemplate(): Promise<void> {
  await store.saveCurrentResultAsTemplate({
    ...saveTemplateForm.value,
    visibilityType: 'SHARED',
  });
  if (!store.errorMessage) {
    saveTemplateDialogVisible.value = false;
  }
}

function startResizeCommonPanel(event: MouseEvent): void {
  isResizingCommonPanel.value = true;
  const startX = event.clientX;
  const startWidth = commonPanelWidth.value;
  const handleMove = (moveEvent: MouseEvent) => {
    const viewportMaxWidth =
      typeof window === 'undefined' ? 720 : Math.floor(window.innerWidth * 0.8);
    commonPanelWidth.value = Math.min(
      viewportMaxWidth,
      Math.max(280, startWidth + moveEvent.clientX - startX),
    );
  };
  const handleUp = () => {
    isResizingCommonPanel.value = false;
    window.removeEventListener('mousemove', handleMove);
    window.removeEventListener('mouseup', handleUp);
  };
  window.addEventListener('mousemove', handleMove);
  window.addEventListener('mouseup', handleUp);
}

async function rerunHistoryFromDrawer(historyId: string): Promise<void> {
  isRecentQueryDrawerOpen.value = false;
  await store.rerunHistory(historyId);
}

onMounted(async () => {
  await store.bootstrap();
  markPageDataReady('/analysis');
});

onActivated(() => {
  if (!store.isBootstrapping) {
    markPageDataReady('/analysis');
  }
});
</script>

<template>
  <div class="page analysis-page">
    <div
      class="analysis-layout analysis-layout--with-assets"
      :class="{ 'analysis-layout--resizing': isResizingCommonPanel }"
    >
      <aside
        class="analysis-common-sidebar"
        :class="{ 'analysis-common-sidebar--collapsed': commonPanelCollapsed }"
        :style="{ width: commonPanelCollapsed ? '0px' : `${commonPanelWidth}px` }"
      >
        <button
          class="analysis-common-sidebar__toggle"
          type="button"
          :aria-label="commonPanelCollapsed ? '展开常用查询' : '收起常用查询'"
          @click="commonPanelCollapsed = !commonPanelCollapsed"
        >
          <el-icon>
            <component :is="commonPanelCollapsed ? UiIcons.arrowRight : UiIcons.arrowLeft" />
          </el-icon>
        </button>
        <CommonQueryPanel
          v-if="!commonPanelCollapsed"
          compact
          :items="store.templates"
          :recommended-items="store.capabilities?.queryAssetSummary?.recommendedTemplates ?? []"
          :busy="store.isSubmitting"
          :loading="templatePanelLoading"
          :view-allowed="templateViewAllowed"
          :tags="store.templateListMeta.tags"
          :page="store.templateListMeta.page"
          :page-size="store.templateListMeta.pageSize"
          :total="store.templateListMeta.total"
          :can-create="templateCreateAllowed"
          :deleting-template-id="store.deletingTemplateId"
          @run="runTemplateFromPanel"
          @copy="store.copyTemplateToMine"
          @view="openTemplateDetail"
          @create="openTemplateEditor"
          @delete="confirmDeleteMyTemplate"
          @query="queryTemplates"
        />
        <div
          v-if="!commonPanelCollapsed"
          class="analysis-common-sidebar__resize"
          role="separator"
          aria-orientation="vertical"
          title="拖拽调整常用查询宽度"
          @mousedown.prevent="startResizeCommonPanel"
        />
      </aside>
      <div class="analysis-main-column">
        <section class="panel search-region">
          <div class="panel__header search-region__header">
            <div>
              <h2 class="search-region__title">
                智能分析
              </h2>
            </div>
            <el-tag
              class="badge status-tone--online"
              type="success"
              round
            >
              <el-icon>
                <component :is="UiIcons.success" />
              </el-icon>
              权限实时生效
            </el-tag>
          </div>

          <div class="panel__body search-region__body">
            <div
              v-if="store.activeQuestionText"
              class="search-region__badges"
            >
              <el-tag
                class="badge status-tone--info search-region__question-badge"
                type="info"
                round
              >
                <el-icon>
                  <component :is="UiIcons.query" />
                </el-icon>
                当前问题：
                <NumberToneText :text="store.activeQuestionText" />
              </el-tag>
            </div>

            <el-input
              v-model="store.queryText"
              class="textarea search-region__textarea"
              type="textarea"
              :rows="4"
              placeholder="请输入自然语言问题，例如：最近一年各销售负责人新增商机金额排名"
              @keydown.enter.exact.prevent="submitQueryFromKeyboard"
            />

            <div class="search-region__actions">
              <div class="search-region__asset-actions">
                <el-button
                  class="button-secondary analysis-button analysis-button--compact search-region__asset-button"
                  @click="openRecentQueryDrawer"
                >
                  <el-icon>
                    <component :is="UiIcons.refresh" />
                  </el-icon>
                  最近查询
                </el-button>
              </div>
              <div class="search-region__action-group">
                <div class="search-region__route-control">
                  <span class="search-region__route-label">分析路线</span>
                  <el-select
                    v-model="store.analysisRoute"
                    class="search-region__route-select"
                    size="large"
                    :disabled="store.isSubmitting || store.isBootstrapping"
                    aria-label="分析路线"
                  >
                    <el-option
                      v-for="item in analysisRouteOptions"
                      :key="item.route"
                      :label="item.label"
                      :value="item.route"
                      :disabled="!item.enabled"
                    >
                      <div class="search-region__route-option">
                        <span>{{ item.label }}</span>
                        <small>{{ item.description }}</small>
                      </div>
                    </el-option>
                  </el-select>
                </div>
                <el-button
                  class="button-secondary analysis-button"
                  :disabled="store.isBootstrapping"
                  :loading="store.isBootstrapping"
                  :aria-busy="store.isBootstrapping ? 'true' : 'false'"
                  @click="store.bootstrap(true)"
                >
                  <el-icon v-if="!store.isBootstrapping">
                    <component :is="UiIcons.refresh" />
                  </el-icon>
                  {{ store.isBootstrapping ? '刷新中...' : '刷新状态' }}
                </el-button>
                <el-button
                  class="button-primary analysis-button search-region__submit-button"
                  type="primary"
                  :disabled="store.isSubmitting || store.isBootstrapping || !analysisAllowed"
                  :loading="store.isSubmitting"
                  :aria-busy="store.isSubmitting ? 'true' : 'false'"
                  @click="store.submitQuery()"
                >
                  <el-icon v-if="!store.isSubmitting">
                    <component :is="UiIcons.analysis" />
                  </el-icon>
                  {{ store.isSubmitting ? '分析中...' : '开始分析' }}
                </el-button>
              </div>
            </div>
          </div>
        </section>

        <section
          v-if="store.currentResult?.queryId && hasResult"
          class="panel analysis-follow-up-bar"
          aria-label="追问当前结果"
        >
          <span class="analysis-follow-up-bar__label">追问当前结果</span>
          <el-input
            v-model="store.followUpText"
            class="analysis-follow-up-bar__input"
            placeholder="例如：把时间范围改成近三个月，再看趋势变化"
            :disabled="!followUpAllowed"
            @keydown.enter.exact.prevent="submitFollowUpFromKeyboard"
          />
          <el-button
            class="button-primary analysis-button analysis-follow-up-bar__button"
            type="primary"
            :disabled="!store.followUpText.trim() || store.isSubmittingFollowUp || store.isSubmitting || !followUpAllowed"
            :loading="store.isSubmittingFollowUp"
            :aria-busy="store.isSubmittingFollowUp ? 'true' : 'false'"
            @click="store.submitFollowUp()"
          >
            <el-icon v-if="!store.isSubmittingFollowUp">
              <component :is="UiIcons.query" />
            </el-icon>
            {{ store.isSubmittingFollowUp ? '追问中...' : '追问' }}
          </el-button>
        </section>

        <section class="panel result-region">
          <div class="panel__header result-region__header">
            <div>
              <h3 class="result-region__title">
                <NumberToneText :text="resultTitle" />
              </h3>
            </div>
            <div class="result-region__header-actions">
              <el-button
                class="button-secondary analysis-button"
                :disabled="!store.currentResult?.queryId || store.isSavingTemplate"
                :loading="store.isSavingTemplate"
                @click="openSaveTemplateDialog"
              >
                <el-icon v-if="!store.isSavingTemplate">
                  <component :is="UiIcons.plus" />
                </el-icon>
                保存为模板
              </el-button>
              <el-button
                class="button-secondary analysis-button"
                :disabled="!store.currentResult?.queryId || store.isExporting || !exportAllowed"
                :loading="store.isExporting"
                :aria-busy="store.isExporting ? 'true' : 'false'"
                @click="store.exportCurrentResult"
              >
                <el-icon v-if="!store.isExporting">
                  <component :is="UiIcons.download" />
                </el-icon>
                {{ store.isExporting ? '导出中...' : '导出结果' }}
              </el-button>
              <el-button
                class="button-primary analysis-button"
                type="primary"
                :disabled="!store.currentResult?.queryId"
                @click="openDetail"
              >
                <el-icon>
                  <component :is="UiIcons.result" />
                </el-icon>
                查看详情
              </el-button>
            </div>
          </div>

          <div class="panel__body result-region__body">
            <div
              v-if="store.isRunning && !hasResult"
              class="result-region__loading"
            >
              <div class="result-region__loading-copy">
                <strong>系统正在生成分析报告</strong>
                <p>请稍候，系统正在查询并整理最终结果。</p>
              </div>
              <div class="skeleton-line skeleton-line--medium" />
              <div class="skeleton-line skeleton-line--long" />
              <div class="skeleton-line skeleton-line--short" />
            </div>

            <div
              v-else-if="analysisStateNotice"
              class="result-region__empty"
            >
              <BusinessEmptyState
                module="analysis"
                :title="analysisStateNotice.title"
                :description="analysisStateNotice.description"
              />
            </div>

            <template v-else-if="hasResult">
              <section
                class="result-region__summary"
                data-testid="analysis-data-stage"
              >
                <div class="result-region__section-head">
                  <h4>数据结果区</h4>
                </div>
                <p class="result-region__summary-text">
                  <NumberToneText :text="resultSummary" />
                </p>
                <p
                  v-if="resultExplanation"
                  class="result-region__summary-note"
                >
                  <NumberToneText :text="resultExplanation" />
                </p>
              </section>

              <MetricCardGroup :metrics="metricCards" />

              <section class="result-region__findings">
                <div class="result-region__section-head">
                  <h4>关键结论</h4>
                  <el-tag
                    class="badge status-tone--info"
                    type="info"
                    round
                  >
                    <el-icon>
                      <component :is="UiIcons.info" />
                    </el-icon>
                    <NumberToneText :text="`${keyFindings.length} 条`" />
                  </el-tag>
                </div>
                <div class="result-region__finding-list">
                  <article
                    v-for="item in keyFindings"
                    :key="`${item.datasetId}-${item.title}`"
                    class="finding-card"
                  >
                    <strong>
                      <NumberToneText :text="item.title" />
                    </strong>
                    <p>
                      <NumberToneText
                        :text="item.detail"
                        :tone-hint="item.tone"
                      />
                    </p>
                  </article>
                  <div
                    v-if="!keyFindings.length"
                    class="empty-state"
                  >
                    当前暂无关键结论。
                  </div>
                </div>
              </section>

              <div
                :class="[
                  'result-region__content-grid',
                  {
                    'result-region__content-grid--single': hasSinglePrimaryResult,
                    'result-region__content-grid--wide-table': shouldUseWideTableLayout,
                    'result-region__content-grid--stacked-visuals': shouldUseStackedVisualLayout,
                  },
                ]"
              >
                <div class="result-region__report-main">
                  <ResultTableView
                    v-if="hasTableData"
                    :title="primaryTable?.title ?? store.currentResult?.primaryView?.title"
                    :rows="primaryTableRows"
                    :columns="primaryTableColumns"
                    :exporting="store.isExporting"
                    :export-allowed="exportAllowed"
                    :transpose="shouldTransposePrimaryTable"
                    @export="store.exportCurrentResult"
                  />
                </div>
                <ResultChartView
                  v-if="hasChartData"
                  :title="primaryChart?.title ?? store.currentResult?.primaryView?.title"
                  :view-type="primaryChart?.viewType ?? store.currentResult?.primaryView?.viewType"
                  :series="primaryChart?.series ?? store.currentResult?.primaryView?.series"
                />
              </div>

              <section
                class="result-region__insight"
                data-testid="analysis-insight-stage"
              >
                <div class="result-region__section-head">
                  <h4>AI 分析报告区</h4>
                </div>
                <AnalysisRichReportPanel
                  v-if="report && richReportReady"
                  :report="report"
                  :temporal-scope="temporalScope"
                />
                <AnalysisMarkdownPreview
                  v-else
                  title="AI 分析报告"
                  :markdown="resultMarkdown"
                  :temporal-scope="temporalScope"
                  :bundle="pendingInsightBundle"
                />
              </section>

              <AnalysisSectionCanvas
                v-if="report?.sections?.length"
                :report="report"
                :result="store.currentResult"
              />
            </template>

            <div
              v-else
              class="result-region__empty"
            >
              <BusinessEmptyState
                module="analysis"
                title="等待输入经营问题"
                description="请输入自然语言问题，系统会按当前权限范围返回摘要、关键发现、图表、明细和可追问的分析报告。"
              />
            </div>
          </div>
        </section>
      </div>
    </div>

    <section
      v-if="store.feedbackMessage"
      class="analysis-toast"
      :data-tone="feedbackSurfaceTone"
    >
      <div class="analysis-toast__icon">
        <el-icon>
          <component
            :is="
              store.feedbackTone === 'error'
                ? UiIcons.error
                : store.feedbackTone === 'warning'
                  ? UiIcons.warning
                  : store.feedbackTone === 'success'
                    ? UiIcons.success
                    : UiIcons.info
            "
          />
        </el-icon>
      </div>
      <div class="analysis-toast__body">
        <strong class="analysis-toast__title">
          {{
            store.feedbackTone === 'warning'
              ? '提示'
              : store.feedbackTone === 'error'
                ? '异常'
                : store.feedbackTone === 'success'
                  ? '完成'
                  : '消息'
          }}
        </strong>
        <p class="analysis-toast__content">
          {{ store.feedbackMessage }}
        </p>
      </div>
      <button
        class="analysis-toast__close"
        type="button"
        aria-label="关闭提示"
        title="关闭提示"
        @click="store.dismissFeedback()"
      >
        <el-icon>
          <component :is="UiIcons.close" />
        </el-icon>
      </button>
    </section>

    <el-dialog
      v-model="saveTemplateDialogVisible"
      title="保存为模板"
      width="520px"
      align-center
    >
      <el-form
        class="save-template-form"
        label-position="top"
      >
        <el-form-item label="模板名称">
          <el-input
            v-model="saveTemplateForm.name"
            maxlength="60"
            show-word-limit
            placeholder="请输入模板名称"
          />
        </el-form-item>
        <el-form-item label="说明">
          <el-input
            v-model="saveTemplateForm.description"
            type="textarea"
            :rows="3"
            maxlength="160"
            show-word-limit
            placeholder="说明这个模板适合查询什么"
          />
        </el-form-item>
        <el-form-item label="标签">
          <el-select
            v-model="saveTemplateForm.tags"
            class="save-template-form__control"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="选择已有标签，或输入新标签"
          >
            <el-option
              v-for="item in visibleTemplateDetailTagOptions"
              :key="item"
              :label="item"
              :value="item"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="saveTemplateDialogVisible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="store.isSavingTemplate"
          :disabled="!saveTemplateForm.name.trim() || !saveTemplateForm.description.trim()"
          @click="saveCurrentResultAsTemplate"
        >
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-drawer
      v-if="templateDetailDrawerVisible"
      v-model="templateDetailDrawerVisible"
      append-to-body
      class="analysis-template-detail-drawer"
      title="模板内容"
      direction="rtl"
      size="min(560px, 100vw)"
      aria-label="模板内容抽屉"
    >
      <div
        v-if="selectedTemplate"
        class="analysis-template-detail"
      >
        <section class="analysis-template-detail__hero">
          <div class="analysis-template-detail__hero-form">
            <span class="analysis-template-detail__eyebrow">查询模板</span>
            <el-input
              v-model="templateDetailForm.name"
              class="analysis-template-detail__title-input"
              maxlength="60"
              show-word-limit
              placeholder="请输入模板名称"
              aria-label="模板名称"
            />
          </div>
        </section>

        <el-form
          class="analysis-template-detail__form"
          label-position="top"
        >
          <el-form-item label="模板说明">
            <el-input
              v-model="templateDetailForm.description"
              type="textarea"
              :rows="4"
              maxlength="240"
              show-word-limit
              placeholder="说明这个模板适合查询什么"
            />
          </el-form-item>

          <el-form-item label="默认问题">
            <el-input
              v-model="templateDetailForm.defaultQuestionText"
              type="textarea"
              :rows="2"
              maxlength="160"
              show-word-limit
              placeholder="请输入执行模板时默认使用的问题"
            />
          </el-form-item>
        </el-form>

        <section class="analysis-template-detail__grid">
          <div>
            <span>默认视图</span>
            <el-select
              v-model="templateDetailForm.defaultViewType"
              class="analysis-template-detail__select"
              placeholder="请选择默认视图"
              aria-label="默认视图"
            >
              <el-option
                label="明细表"
                value="DETAIL_TABLE"
              />
              <el-option
                label="排名表"
                value="RANKING_TABLE"
              />
              <el-option
                label="柱状图"
                value="BAR_CHART"
              />
              <el-option
                label="折线图"
                value="LINE_CHART"
              />
            </el-select>
          </div>
          <div>
            <span>累计执行</span>
            <strong>{{ selectedTemplate.usageCountTotal ?? selectedTemplate.clickCount7d ?? 0 }} 次</strong>
          </div>
          <div>
            <span>归属用户</span>
            <strong>{{ selectedTemplateOwnerDisplayName }}</strong>
          </div>
          <div>
            <span>更新时间</span>
            <strong>{{ selectedTemplate.updatedAt?.slice(0, 10) ?? '--' }}</strong>
          </div>
        </section>

        <section
          class="analysis-template-detail__section"
        >
          <strong>标签</strong>
          <el-select
            v-model="templateDetailForm.tags"
            class="save-template-form__control"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="选择已有标签，或输入新标签"
          >
            <el-option
              v-for="item in store.templateListMeta.tags"
              :key="item"
              :label="item"
              :value="item"
            />
          </el-select>
        </section>

        <section
          class="analysis-template-detail__section"
        >
          <strong>查询 SQL</strong>
          <pre
            v-if="selectedTemplate.sqlText"
            class="analysis-template-detail__code"
          >{{ selectedTemplate.sqlText }}</pre>
          <p
            v-else-if="isTemplateDetailLoading"
            class="analysis-template-detail__hint"
          >
            正在加载完整 SQL 内容。
          </p>
          <p
            v-else
            class="analysis-template-detail__hint"
          >
            {{ templateDetailErrorMessage || '当前模板暂未返回可展示的 SQL 内容，请稍后刷新后再查看。' }}
          </p>
        </section>
      </div>
      <el-empty
        v-else
        description="未找到模板内容。"
      />
      <template #footer>
        <div class="analysis-template-detail__footer">
          <el-button
            class="button-secondary"
            @click="templateDetailDrawerVisible = false"
          >
            关闭
          </el-button>
          <el-button
            class="button-secondary"
            :loading="store.isUpdatingTemplate"
            :disabled="!canSaveTemplateDetail"
            @click="saveTemplateDetail"
          >
            保存
          </el-button>
          <el-button
            v-if="selectedTemplate"
            class="button-primary"
            type="primary"
            :loading="store.isSubmitting"
            @click="runSelectedTemplateFromDetail"
          >
            执行模板
          </el-button>
        </div>
      </template>
    </el-drawer>

    <el-drawer
      v-if="templateEditorDrawerVisible"
      v-model="templateEditorDrawerVisible"
      append-to-body
      class="analysis-template-editor-drawer"
      title="新增查询模板"
      direction="rtl"
      size="min(760px, 100vw)"
      destroy-on-close
      aria-label="新增查询模板抽屉"
    >
      <el-form
        class="query-template-editor analysis-template-editor"
        label-position="top"
      >
        <el-form-item label="模板状态">
          <el-switch
            v-model="templateStatusEnabled"
            inline-prompt
            active-text="启用"
            inactive-text="停用"
          />
        </el-form-item>
        <el-form-item label="模板名称">
          <el-input
            v-model="templateEditorForm.name"
            maxlength="60"
            show-word-limit
            placeholder="请输入模板名称"
          />
        </el-form-item>
        <el-form-item label="模板说明">
          <el-input
            v-model="templateEditorForm.description"
            type="textarea"
            :rows="3"
            maxlength="160"
            show-word-limit
            placeholder="说明这个模板适合查询什么"
          />
        </el-form-item>
        <div class="field-grid">
          <el-form-item label="标签">
            <el-select
              v-model="templateEditorForm.tags"
              class="save-template-form__control"
              multiple
              filterable
              allow-create
              default-first-option
              placeholder="选择已有标签，或输入新标签"
            >
              <el-option
                v-for="item in store.templateListMeta.tags"
                :key="item"
                :label="item"
                :value="item"
              />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="默认视图">
          <el-select
            v-model="templateEditorForm.defaultViewType"
            class="save-template-form__control"
            placeholder="请选择默认视图"
          >
            <el-option
              label="明细表"
              value="DETAIL_TABLE"
            />
            <el-option
              label="排名表"
              value="RANKING_TABLE"
            />
            <el-option
              label="柱状图"
              value="BAR_CHART"
            />
            <el-option
              label="折线图"
              value="LINE_CHART"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="查询 SQL">
          <el-input
            v-model="templateEditorForm.sqlText"
            type="textarea"
            :rows="10"
            placeholder="请输入模板原始 SQL，系统执行时会按当前用户权限自动判断是否收口。"
          />
        </el-form-item>
        <section
          v-if="latestTemplateValidation?.scopeAnalysis?.friendlyMessage"
          class="empty-state analysis-template-editor__validation"
        >
          <strong>范围识别结果</strong>
          <span>
            <NumberToneText :text="latestTemplateValidation.scopeAnalysis.friendlyMessage" />
          </span>
        </section>
      </el-form>
      <template #footer>
        <div class="query-template-editor__footer">
          <el-button
            class="button-secondary"
            @click="templateEditorDrawerVisible = false"
          >
            取消
          </el-button>
          <el-button
            class="button-secondary"
            :loading="isValidatingTemplate"
            @click="validateWorkbenchTemplate(true)"
          >
            校验 SQL
          </el-button>
          <el-button
            class="button-primary"
            type="primary"
            :loading="isCreatingTemplate"
            @click="createWorkbenchTemplate"
          >
            创建模板
          </el-button>
        </div>
      </template>
    </el-drawer>

    <el-drawer
      v-model="isRecentQueryDrawerOpen"
      append-to-body
      class="analysis-assets-drawer"
      title="最近查询"
      direction="rtl"
      size="min(680px, 100vw)"
      aria-label="最近查询抽屉"
    >
      <div class="analysis-drawer__body analysis-drawer__body--single">
        <RecentQueryPanel
          compact
          :items="store.histories"
          :busy="store.isSubmitting"
          @rerun="rerunHistoryFromDrawer"
        />
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.search-region__route-control {
  display: grid;
  grid-template-columns: auto minmax(260px, 320px);
  align-items: center;
  gap: 8px;
}

.search-region__route-label {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.search-region__route-select {
  width: 100%;
}

.search-region__route-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  line-height: 1.25;
}

.search-region__route-option small {
  overflow: hidden;
  color: var(--el-text-color-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 720px) {
  .search-region__route-control {
    grid-template-columns: 1fr;
    width: 100%;
  }

  .search-region__route-select {
    width: 100%;
  }
}
</style>

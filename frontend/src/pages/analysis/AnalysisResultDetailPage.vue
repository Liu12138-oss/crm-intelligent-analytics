<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  ElAlert,
  ElButton,
  ElIcon,
  ElInput,
} from 'element-plus';
import { useRoute, useRouter } from 'vue-router';
import AnalysisRichReportPanel from '@/components/analysis/AnalysisRichReportPanel.vue';
import AnalysisSectionCanvas from '@/components/analysis/AnalysisSectionCanvas.vue';
import MetricCardGroup from '@/components/analysis/MetricCardGroup.vue';
import NumberToneText from '@/components/analysis/NumberToneText.vue';
import ResultChartView from '@/components/analysis/ResultChartView.vue';
import ResultSummaryPanel from '@/components/analysis/ResultSummaryPanel.vue';
import ResultTableView from '@/components/analysis/ResultTableView.vue';
import SectionSourcePopover from '@/components/management-report/blocks/SectionSourcePopover.vue';
import { analysisService } from '@/services/analysis.service';
import type { AnalysisQueryResult } from '@/types/analysis';
import type { ManagementMetricDefinition } from '@/types/management-report';
import { triggerBrowserDownload } from '@/utils/browser-download';
import {
  formatActionTypeLabel,
  formatExecutionModeLabel,
  formatExecutionSourceLabel,
  formatStreamBlockTypeLabel,
} from '@/ui/business-code-labels';
import { UiIcons } from '@/ui/icons';
import {
  resolveFeedbackTone,
} from '@/ui/status-presentation';
import { toUserFacingErrorMessage } from '@/utils/user-facing-error';

const route = useRoute();
const router = useRouter();

const detail = ref<AnalysisQueryResult | null>(null);
const loading = ref(false);
const exporting = ref(false);
const submittingFollowUp = ref(false);
const feedback = ref('');
const feedbackTone = ref<'info' | 'success' | 'warning' | 'error'>('info');
const followUpText = ref('');
const queryId = computed(() => String(route.params.queryId ?? ''));

const metricCards = computed(() => detail.value?.metricCards ?? []);
const streamBlocks = computed(() => detail.value?.streamBlocks ?? []);
const availableActions = computed(() => detail.value?.availableActions ?? []);
const executionTraceSummary = computed(
  () => detail.value?.executionTraceSummary ?? detail.value?.report?.executionTraceSummary,
);
const reportSourceNotes = computed(() => detail.value?.report?.sourceNotes ?? []);
const reportSourceMetricNotes = computed<ManagementMetricDefinition[]>(() =>
  reportSourceNotes.value.map((item) => ({
    key: item.key,
    label: item.label,
    description: item.description,
    sourceTables: [],
    sourceFields: [],
    timeField: '--',
    aggregation: 'count',
  })),
);
const reportFootnotes = computed(() => detail.value?.report?.footnotes ?? []);
const primaryTableBlock = computed(() => detail.value?.report?.tableBlocks?.[0]);
const primaryChartBlock = computed(() => detail.value?.report?.chartBlocks?.[0]);
const detailTableRows = computed(
  () => primaryTableBlock.value?.rows ?? detail.value?.primaryView?.rows ?? detail.value?.tableRows ?? [],
);
const detailTableColumns = computed(
  () => primaryTableBlock.value?.columns ?? detail.value?.primaryView?.columns,
);
const detailTableTitle = computed(
  () =>
    primaryTableBlock.value?.title ??
    (detail.value?.primaryView?.rows?.length ? detail.value.primaryView.title : detail.value?.title),
);
const hasDetailTableRows = computed(() => detailTableRows.value.length > 0);
const detailChartTitle = computed(() => primaryChartBlock.value?.title ?? detail.value?.primaryView?.title);
const detailChartViewType = computed(() => primaryChartBlock.value?.viewType ?? detail.value?.primaryView?.viewType);
const detailChartSeries = computed(() => primaryChartBlock.value?.series ?? detail.value?.primaryView?.series ?? []);
const hasDetailChartData = computed(() => detailChartSeries.value.length > 0);
const exportAction = computed(() =>
  availableActions.value.find((item) => item.actionType === 'EXPORT'),
);
const followUpAction = computed(() =>
  availableActions.value.find((item) => item.actionType === 'FOLLOW_UP'),
);
const feedbackSurfaceTone = computed(() => resolveFeedbackTone(feedbackTone.value));

async function loadDetail() {
  if (!queryId.value) {
    return;
  }

  loading.value = true;
  feedback.value = '';
  feedbackTone.value = 'info';

  try {
    detail.value = await analysisService.getQuery(queryId.value);
  } catch (error) {
    feedbackTone.value = 'error';
    feedback.value = toUserFacingErrorMessage(
      error,
      '分析详情暂时没有加载成功，请稍后刷新重试；如果多次失败，请联系管理员。',
    );
  } finally {
    loading.value = false;
  }
}

async function exportCurrentResult() {
  if (!detail.value?.queryId || exporting.value) {
    return;
  }

  exporting.value = true;
  try {
    const result = await analysisService.createExport(detail.value.queryId, 'csv');
    if (result.status === 'COMPLETED' && result.content && result.fileName && result.mimeType) {
      triggerBrowserDownload({
        fileName: result.fileName,
        mimeType: result.mimeType,
        content: result.content,
      });
    }
    feedbackTone.value = result.status === 'BLOCKED' ? 'warning' : 'success';
    feedback.value =
      result.status === 'BLOCKED'
        ? String(result.blockedReason ?? '导出被拦截')
        : '导出文件已开始下载。';
  } catch (error) {
    feedbackTone.value = 'error';
    feedback.value = toUserFacingErrorMessage(
      error,
      '当前结果暂时无法导出，请稍后重试；如果多次失败，请联系管理员。',
    );
  } finally {
    exporting.value = false;
  }
}

async function submitFollowUp() {
  if (!followUpText.value.trim() || !detail.value?.queryId || submittingFollowUp.value) {
    return;
  }

  submittingFollowUp.value = true;
  try {
    const created = await analysisService.createQuery({
      querySource: 'FREE_TEXT',
      channel: 'web-console',
      questionText: followUpText.value,
      followUpQueryId: detail.value.queryId,
    });

    feedbackTone.value = created.clarificationPrompt ? 'warning' : 'success';
    feedback.value = created.clarificationPrompt ?? '追问已提交。';
    followUpText.value = '';

    if (created.queryId && created.status === 'RETURNED') {
      await router.push({
        name: 'analysis-result-detail',
        params: { queryId: created.queryId },
      });
    }
  } catch (error) {
    feedbackTone.value = 'error';
    feedback.value = toUserFacingErrorMessage(
      error,
      '追问暂时没有提交成功，请稍后重试；如果多次失败，请联系管理员。',
    );
  } finally {
    submittingFollowUp.value = false;
  }
}

onMounted(loadDetail);

watch(
  () => route.params.queryId,
  async () => {
    await loadDetail();
  },
);

function backToWorkbench() {
  void router.push({ name: 'analysis' });
}
</script>

<template>
  <div class="page analysis-page">
    <div class="analysis-detail-toolbar">
      <el-button
        class="button-secondary analysis-button analysis-detail-back-button"
        @click="backToWorkbench"
      >
        <el-icon>
          <component :is="UiIcons.back" />
        </el-icon>
        返回工作台
      </el-button>
    </div>

    <el-alert
      v-if="feedback"
      class="feedback-state"
      :data-tone="feedbackSurfaceTone"
      type="info"
      :closable="false"
      show-icon
    >
      <NumberToneText :text="feedback" />
    </el-alert>
    <el-alert
      v-if="loading"
      class="loading-state"
      type="info"
      :closable="false"
      show-icon
    >
      正在加载结果详情...
    </el-alert>

    <ResultSummaryPanel
      :title="detail?.title"
      :summary="detail?.summary"
      :scope-summary="detail?.scopeSummary"
      :explanation="detail?.explanation"
      :data-freshness-at="detail?.dataFreshnessAt"
    />

    <MetricCardGroup :metrics="metricCards" />

    <div class="result-detail-layout">
      <div class="detail-main-column">
        <ResultTableView
          v-if="hasDetailTableRows"
          :title="detailTableTitle"
          :rows="detailTableRows"
          :columns="detailTableColumns"
          :exporting="exporting"
          @export="exportCurrentResult"
        />

        <ResultChartView
          v-if="hasDetailChartData"
          :title="detailChartTitle"
          :view-type="detailChartViewType"
          :series="detailChartSeries"
        />

        <section
          v-if="detail?.report"
          class="panel"
        >
          <div class="panel__header">
            <h3 class="detail-section-title">
              AI 分析报告
            </h3>
          </div>
          <div class="panel__body">
            <AnalysisRichReportPanel
              :report="detail.report"
              :temporal-scope="detail.temporalScope ?? detail.report.temporalScope"
              :default-markdown-visible="true"
            />
          </div>
        </section>

        <section
          v-else
          class="panel"
        >
          <div class="panel__header">
            <h3 class="detail-section-title">
              AI 分析报告
            </h3>
          </div>
          <div class="panel__body">
            <div class="empty-state">
              当前暂无可展示的完整分析报告。
            </div>
          </div>
        </section>

        <AnalysisSectionCanvas
          v-if="detail?.report?.sections?.length"
          :report="detail?.report"
          :result="detail"
        />

        <section
          v-if="executionTraceSummary"
          class="panel"
        >
          <div class="panel__header">
            <h3 class="detail-section-title">
              执行依据摘要
            </h3>
            <SectionSourcePopover
              v-if="reportSourceNotes.length || reportFootnotes.length"
              :source-notes="reportSourceMetricNotes"
              :footnotes="reportFootnotes"
            />
          </div>
          <div class="panel__body panel__body--stack">
            <div class="empty-state">
              <strong>标准化问题</strong>
              <span>
                <NumberToneText :text="executionTraceSummary.normalizedQuestion" />
              </span>
            </div>
            <div v-if="executionTraceSummary.knowledgeHits.length">
              <div class="detail-section-copy">
                命中语义资产
              </div>
              <div class="result-detail__action-list">
                <el-tag
                  v-for="item in executionTraceSummary.knowledgeHits"
                  :key="`${item.assetId}-${item.assetType}`"
                  class="badge status-tone--info"
                  type="info"
                  round
                >
                  <NumberToneText :text="item.name" />
                </el-tag>
              </div>
            </div>
            <div
              v-if="reportFootnotes.length"
              class="empty-state"
            >
              <strong>口径脚注</strong>
              <span>
                <NumberToneText :text="reportFootnotes.join('；')" />
              </span>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel__header">
            <h3 class="detail-section-title">
              结果流式与说明块
            </h3>
          </div>
          <div class="panel__body">
            <div class="result-detail__stream-list">
              <div
                v-for="block in streamBlocks"
                :key="block.sequence"
                class="result-detail__stream-item"
              >
                <div class="result-detail__stream-type">
                  {{ formatStreamBlockTypeLabel(block.blockType) }}
                </div>
                <div class="result-detail__stream-content">
                  <NumberToneText :text="block.content" />
                </div>
              </div>
              <div
                v-if="streamBlocks.length === 0"
                class="empty-state"
              >
                暂无流式结果块。
              </div>
            </div>
          </div>
        </section>
      </div>

      <aside
        class="detail-side-column"
        aria-label="解释与下一步"
      >
        <section class="panel">
          <div class="panel__header">
            <h3 class="detail-section-title">
              解释与下一步
            </h3>
            <el-button
              class="button-primary analysis-button"
              type="primary"
              :disabled="exporting || exportAction?.enabled === false"
              :loading="exporting"
              :aria-busy="exporting ? 'true' : 'false'"
              @click="exportCurrentResult"
            >
              <el-icon v-if="!exporting">
                <component :is="UiIcons.download" />
              </el-icon>
              {{ exporting ? '导出中...' : '导出当前结果' }}
            </el-button>
          </div>
          <div class="panel__body panel__body--stack">
            <el-alert
              class="result-detail__explain-card"
              type="info"
              :closable="false"
              show-icon
            >
              <NumberToneText :text="detail?.explanation ?? '当前暂无额外解释说明。'" />
            </el-alert>

            <el-alert
              v-if="detail?.groundedExplanation"
              class="feedback-state"
              data-tone="success"
              type="success"
              :closable="false"
              show-icon
            >
              <NumberToneText :text="detail.groundedExplanation" />
            </el-alert>

            <el-alert
              v-if="detail?.executionMode || detail?.executionSource || detail?.matchedAdapter || detail?.gapReason"
              class="empty-state"
              type="info"
              :closable="false"
              show-icon
            >
              <span v-if="detail?.executionMode">
                执行模式：{{ formatExecutionModeLabel(detail.executionMode) }}
              </span>
              <span v-if="detail?.executionSource">
                执行来源：{{ formatExecutionSourceLabel(detail.executionSource) }}
              </span>
              <span v-if="detail?.matchedAdapter">
                命中适配器：<NumberToneText :text="detail.matchedAdapter" />
              </span>
              <span v-if="detail?.gapReason">
                API 缺口：<NumberToneText :text="detail.gapReason" />
              </span>
            </el-alert>

            <div>
              <div class="detail-section-copy">
                当前可执行动作
              </div>
              <div class="result-detail__action-list">
                <el-tag
                  v-for="item in availableActions"
                  :key="item.actionType"
                  :class="['badge', item.enabled ? 'status-tone--success' : 'status-tone--neutral']"
                  :type="item.enabled ? 'success' : 'info'"
                  round
                >
                  {{ formatActionTypeLabel(item.actionType) }}
                </el-tag>
              </div>
            </div>

            <div v-if="detail?.nextBestQuestions?.length">
              <div class="detail-section-copy">
                推荐追问
              </div>
              <div class="result-detail__action-list">
                <el-button
                  v-for="item in detail.nextBestQuestions"
                  :key="item"
                  class="button-secondary analysis-button"
                  @click="followUpText = item"
                >
                  <el-icon>
                    <component :is="UiIcons.query" />
                  </el-icon>
                  <NumberToneText :text="item" />
                </el-button>
              </div>
            </div>

            <div class="form-field">
              <span>追问当前结果</span>
              <el-input
                v-model="followUpText"
                class="textarea"
                type="textarea"
                :rows="4"
                placeholder="例如：把时间范围改成近三个月，再看趋势变化"
              />
              <div class="toolbar-row">
                <span class="detail-section-copy">追问会沿用当前查询上下文。</span>
                <el-button
                  class="button-primary analysis-button"
                  type="primary"
                  :disabled="!followUpText.trim() || submittingFollowUp || followUpAction?.enabled === false"
                  :loading="submittingFollowUp"
                  :aria-busy="submittingFollowUp ? 'true' : 'false'"
                  @click="submitFollowUp"
                >
                  <el-icon v-if="!submittingFollowUp">
                    <component :is="UiIcons.query" />
                  </el-icon>
                  {{ submittingFollowUp ? '提交中...' : '提交追问' }}
                </el-button>
              </div>
            </div>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>

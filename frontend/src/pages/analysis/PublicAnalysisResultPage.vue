<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  ElAlert,
  ElButton,
  ElIcon,
} from 'element-plus';
import { useRoute } from 'vue-router';
import AnalysisRichReportPanel from '@/components/analysis/AnalysisRichReportPanel.vue';
import AnalysisSectionCanvas from '@/components/analysis/AnalysisSectionCanvas.vue';
import MetricCardGroup from '@/components/analysis/MetricCardGroup.vue';
import NumberToneText from '@/components/analysis/NumberToneText.vue';
import ResultChartView from '@/components/analysis/ResultChartView.vue';
import ResultTableView from '@/components/analysis/ResultTableView.vue';
import logoImage from '@/images/logo/logo.png';
import { analysisService } from '@/services/analysis.service';
import { buildApiUrl } from '@/services/http-client';
import type { AnalysisQueryResult } from '@/types/analysis';
import { UiIcons } from '@/ui/icons';
import { toUserFacingErrorMessage } from '@/utils/user-facing-error';

const route = useRoute();
const detail = ref<AnalysisQueryResult | null>(null);
const loading = ref(false);
const feedback = ref('');
const queryId = computed(() => String(route.params.queryId ?? ''));

const report = computed(() => detail.value?.report);
const metricCards = computed(() => detail.value?.metricCards ?? report.value?.metricCards ?? []);
const primaryTableBlock = computed(() => report.value?.tableBlocks?.[0]);
const primaryChartBlock = computed(() => report.value?.chartBlocks?.[0]);
const tableRows = computed(
  () => primaryTableBlock.value?.rows ?? detail.value?.primaryView?.rows ?? detail.value?.tableRows ?? [],
);
const tableColumns = computed(
  () => primaryTableBlock.value?.columns ?? detail.value?.primaryView?.columns,
);
const tableTitle = computed(
  () => primaryTableBlock.value?.title ?? detail.value?.primaryView?.title ?? detail.value?.title,
);
const chartTitle = computed(() => primaryChartBlock.value?.title ?? detail.value?.primaryView?.title);
const chartViewType = computed(() => primaryChartBlock.value?.viewType ?? detail.value?.primaryView?.viewType);
const chartSeries = computed(() => primaryChartBlock.value?.series ?? detail.value?.primaryView?.series ?? []);
const hasTable = computed(() => tableRows.value.length > 0);
const hasChart = computed(() => chartSeries.value.length > 0);
const htmlFileUrl = computed(() =>
  queryId.value ? buildApiUrl(`/public/analysis-results/${encodeURIComponent(queryId.value)}/file`) : '',
);

/**
 * 加载企微公开只读结果。
 *
 * 参数说明：无，直接使用路由中的 `queryId`。
 * 返回值说明：无。
 * 调用注意事项：公开页不建立登录态，只展示后端已裁剪的只读结果。
 */
async function loadPublicResult(): Promise<void> {
  if (!queryId.value) {
    feedback.value = '当前链接缺少分析结果编号，请回到企业微信重新打开。';
    return;
  }

  loading.value = true;
  feedback.value = '';
  try {
    detail.value = await analysisService.getPublicQuery(queryId.value);
  } catch (error) {
    feedback.value = toUserFacingErrorMessage(
      error,
      '分析结果暂时没有加载成功，请稍后重试；如果多次失败，请让管理员检查结果是否仍然存在。',
    );
  } finally {
    loading.value = false;
  }
}

/**
 * 打开 HTML 分析报告。
 *
 * 参数说明：无。
 * 返回值说明：无。
 * 调用注意事项：文件地址由后端公开只读接口生成，不携带登录 Cookie 或敏感凭据。
 */
function openHtmlFile(): void {
  if (!htmlFileUrl.value) {
    return;
  }

  window.location.assign(htmlFileUrl.value);
}

onMounted(() => {
  document.body.classList.add('page-body--public-result');
  void loadPublicResult();
});

onUnmounted(() => {
  document.body.classList.remove('page-body--public-result');
});

watch(
  () => route.params.queryId,
  () => {
    void loadPublicResult();
  },
);
</script>

<template>
  <main class="public-result-page">
    <header class="public-result-hero">
      <div class="public-result-hero__brand">
        <img
          class="public-result-hero__logo"
          :src="logoImage"
          alt="CRM 智能分析系统标志"
        >
        <div>
          <p>CRM 智能分析</p>
          <h1>分析结果详情</h1>
        </div>
      </div>
      <el-button
        v-if="htmlFileUrl"
        class="button-primary analysis-button"
        type="primary"
        @click="openHtmlFile"
      >
        <el-icon>
          <component :is="UiIcons.download" />
        </el-icon>
        打开HTML报告
      </el-button>
    </header>

    <el-alert
      v-if="loading"
      class="public-result-alert"
      type="info"
      :closable="false"
      show-icon
    >
      正在加载分析结果...
    </el-alert>

    <el-alert
      v-if="feedback"
      class="public-result-alert"
      type="warning"
      :closable="false"
      show-icon
    >
      <NumberToneText :text="feedback" />
    </el-alert>

    <section
      v-if="detail"
      class="public-result-summary"
    >
      <p class="public-result-summary__eyebrow">
        只读分析结果
      </p>
      <h2>
        <NumberToneText :text="report?.reportTitle ?? detail.title ?? 'CRM 智能分析结果'" />
      </h2>
      <p>
        <NumberToneText :text="report?.executiveSummary ?? detail.summary ?? '当前分析结果已生成。'" />
      </p>
      <div class="public-result-summary__meta">
        <span>结果编号：{{ detail.queryId }}</span>
        <span v-if="detail.completedAt">生成时间：{{ detail.completedAt }}</span>
        <span v-if="detail.rowCount !== undefined">结果行数：{{ detail.rowCount }}</span>
      </div>
    </section>

    <MetricCardGroup
      v-if="metricCards.length"
      :metrics="metricCards"
    />

    <div
      v-if="detail"
      class="public-result-grid"
    >
      <div class="public-result-main">
        <ResultTableView
          v-if="hasTable"
          :title="tableTitle"
          :rows="tableRows"
          :columns="tableColumns"
          :exporting="false"
          :export-allowed="false"
        />

        <ResultChartView
          v-if="hasChart"
          :title="chartTitle"
          :view-type="chartViewType"
          :series="chartSeries"
        />

        <section
          v-if="report"
          class="panel"
        >
          <div class="panel__header">
            <h3>AI 分析报告</h3>
          </div>
          <div class="panel__body">
            <AnalysisRichReportPanel
              :report="report"
              :temporal-scope="detail.temporalScope ?? report.temporalScope"
              :default-markdown-visible="true"
            />
          </div>
        </section>

        <AnalysisSectionCanvas
          v-if="report?.sections?.length"
          :report="report"
          :result="detail"
        />
      </div>
    </div>
  </main>
</template>

<style scoped>
.public-result-page {
  min-height: 100vh;
  padding: 18px;
  background:
    radial-gradient(circle at 16% 12%, rgba(32, 119, 95, 0.12), transparent 28%),
    linear-gradient(135deg, #f4f8f6 0%, #eef4f8 44%, #ffffff 100%);
  color: #15202b;
}

.public-result-hero,
.public-result-summary,
.public-result-grid {
  width: min(1180px, 100%);
  margin: 0 auto 16px;
}

.public-result-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
  border: 1px solid rgba(195, 211, 205, 0.9);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 18px 48px rgba(24, 54, 47, 0.08);
  backdrop-filter: blur(16px);
}

.public-result-hero__brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.public-result-hero__logo {
  width: 42px;
  height: 42px;
  object-fit: contain;
}

.public-result-hero p,
.public-result-summary__eyebrow {
  margin: 0;
  color: #6b7a74;
  font-size: 13px;
  font-weight: 700;
}

.public-result-hero h1,
.public-result-summary h2 {
  margin: 4px 0 0;
  color: #17352e;
}

.public-result-alert {
  width: min(1180px, 100%);
  margin: 0 auto 14px;
}

.public-result-summary {
  padding: 22px;
  border: 1px solid rgba(213, 225, 221, 0.9);
  border-radius: 24px;
  background: #ffffff;
  box-shadow: 0 16px 42px rgba(31, 68, 58, 0.06);
}

.public-result-summary p:last-of-type {
  margin: 10px 0 0;
  color: #40534b;
  line-height: 1.8;
}

.public-result-summary__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
  color: #6d7b75;
  font-size: 13px;
}

.public-result-summary__meta span {
  padding: 6px 10px;
  border-radius: 999px;
  background: #eef5f2;
}

.public-result-main {
  display: grid;
  gap: 16px;
}

@media (max-width: 720px) {
  .public-result-page {
    padding: 10px;
  }

  .public-result-hero {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>

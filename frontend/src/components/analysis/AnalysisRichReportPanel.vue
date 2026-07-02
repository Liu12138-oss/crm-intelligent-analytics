<script setup lang="ts">
import { computed, ref } from 'vue';
import AnalysisMarkdownPreview from '@/components/analysis/AnalysisMarkdownPreview.vue';
import NumberToneText from '@/components/analysis/NumberToneText.vue';
import type { AnalysisReportPayload, ResultTemporalScope } from '@/types/analysis';

const props = withDefaults(
  defineProps<{
    report: AnalysisReportPayload;
    temporalScope?: ResultTemporalScope;
    defaultMarkdownVisible?: boolean;
  }>(),
  {
    temporalScope: undefined,
    defaultMarkdownVisible: false,
  },
);

const isMarkdownVisible = ref(props.defaultMarkdownVisible);

const metricItems = computed(() => props.report.metricCards ?? []);
const keyFindingItems = computed(() => props.report.keyFindings ?? []);
const recommendationItems = computed(() => props.report.recommendations ?? []);
const riskItems = computed(() => [
  ...(props.report.anomalyInsights ?? []),
  ...(props.report.riskInsights ?? []),
]);
const detailMarkdown = computed(
  () => props.report.detailMarkdown ?? props.report.groundedMarkdown ?? '',
);
const forecastSummary = computed(() => props.report.forecastInsight?.summary ?? '');
const forecastMetricLabel = computed(() => props.report.forecastInsight?.metricLabel?.trim() || inferForecastMetricLabel());
const forecastDisplaySummary = computed(() => {
  const insight = props.report.forecastInsight;
  if (!insight) {
    return props.report.trendInsight?.summary ?? '当前暂无趋势预测结论。';
  }

  if (
    Number.isFinite(insight.predictedRangeLow) &&
    Number.isFinite(insight.predictedRangeHigh)
  ) {
    return `${insight.horizonLabel || '下一周期'}的${forecastMetricLabel.value}大概率在 ${formatReadableNumber(insight.predictedRangeLow)} 到 ${formatReadableNumber(insight.predictedRangeHigh)} 之间。`;
  }

  return normalizeForecastSummary(
    forecastSummary.value || props.report.trendInsight?.summary || '当前暂无趋势预测结论。',
  );
});
const forecastStatusLabel = computed(() => {
  const status = props.report.forecastInsight?.status;
  if (status === 'READY') {
    return '短期区间';
  }
  if (status === 'LOW_CONFIDENCE') {
    return '仅供排布参考';
  }
  return '暂无预测';
});
const forecastConfidenceLabel = computed(() => {
  const level = props.report.forecastInsight?.confidenceLevel;
  if (level === 'HIGH') {
    return '参考价值较高';
  }
  if (level === 'MEDIUM') {
    return '参考价值中等';
  }
  if (level === 'LOW') {
    return '参考价值有限';
  }
  return '';
});
const boundarySummary = computed(() => {
  const caveats = props.report.forecastInsight?.caveats ?? [];
  if (props.report.forecastInsight?.status === 'LOW_CONFIDENCE') {
    const readableBoundary = '不是确定结论，只基于当前已返回数据做粗略估计；请结合下一周期真实数据复核。';
    const caveat = caveats.find((item) => item && !item.includes('方向性预测'));
    return caveat ? `${readableBoundary}${caveat}` : readableBoundary;
  }

  if (props.report.trendInsight?.status === 'UNAVAILABLE') {
    return props.report.trendInsight.summary;
  }

  return '';
});
const focusRows = computed(() => props.report.tableBlocks?.[0]?.rows?.slice(0, 5) ?? []);
const focusProfile = computed(() => resolveFocusProfile(focusRows.value));

/**
 * 切换完整 Markdown 阅读稿的展开状态。
 *
 * 参数说明：无。
 * 返回值：无；仅切换本地可读状态。
 */
function toggleMarkdown(): void {
  isMarkdownVisible.value = !isMarkdownVisible.value;
}

/**
 * 从明细行中按候选字段读取首个可展示文本。
 *
 * 参数说明：`row` 为后端返回的明细记录，`keys` 为兼容字段名列表。
 * 返回值：命中的字符串；未命中时返回空字符串。
 */
function pickText(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  return '';
}

/**
 * 把金额字段统一格式化为中文千分位，避免表格里出现空指标或原始小数字符串。
 *
 * 参数说明：`value` 为原始金额字段。
 * 返回值：格式化后的金额文本；无有效金额时返回空字符串。
 */
function formatAmount(value: unknown): string {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.replace(/,/gu, '').trim())
        : 0;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return '';
  }

  return parsed.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * 根据结果行字段识别重点区块粒度，避免把团队、季度、年度等汇总行展示成业务明细。
 *
 * 参数说明：`rows` 为报告表格中的前几条结果行。
 * 返回值：重点区块标题和行类型。
 */
function resolveFocusProfile(rows: Array<Record<string, unknown>>): {
  kind: 'detail' | 'customer' | 'aggregate';
  title: string;
} {
  const hasProjectDetail = rows.some((row) =>
    Boolean(
      pickText(row, [
        'project_name',
        'projectName',
        'opportunity_name',
        'opportunity_code',
        '商机名称',
        '项目名称',
      ]) ||
        pickText(row, ['stage_name', 'stageName', '销售阶段']) ||
        pickText(row, ['expected_sign_date', 'expectedSignDate', '预计签单日期']),
    ),
  );

  if (hasProjectDetail) {
    return { kind: 'detail', title: '重点明细' };
  }

  const hasCustomerDimension = rows.some((row) =>
    Boolean(pickText(row, ['customer_name', 'customerName', '最终客户', '客户名称'])),
  );
  if (hasCustomerDimension) {
    return { kind: 'customer', title: '重点客户' };
  }

  return { kind: 'aggregate', title: '重点汇总项' };
}

/**
 * 格式化预测区间数值，保留业务可读的小数位，避免直接暴露冗长浮点数。
 *
 * 参数说明：`value` 为后端给出的预测区间端点。
 * 返回值：中文千分位数值文本。
 */
function formatReadableNumber(value: unknown): string {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return '--';
  }

  return parsed.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * 为历史结果补推预测指标名称，保证缓存数据也能说明“预测的是什么”。
 *
 * 参数说明：无，读取当前报告字段。
 * 返回值：业务用户可理解的指标名称。
 */
function inferForecastMetricLabel(): string {
  const summaryMatch = forecastSummary.value.match(/下一周期(?:的)?(.+?)(?:大概率|预计|可能|在|落在)/u);
  if (summaryMatch?.[1]?.trim()) {
    return summaryMatch[1].trim();
  }

  const preferredMetric = metricItems.value.find((item) =>
    /金额|收入|预测|完成率|合同数|商机数|数量|总额/u.test(String(item.name)),
  );
  return preferredMetric ? String(preferredMetric.name) : '指标值';
}

/**
 * 把历史报告里的内部预测术语改写为面向业务用户的表达。
 *
 * 参数说明：`summary` 为后端或缓存中的预测摘要。
 * 返回值：去除内部术语后的可读摘要。
 */
function normalizeForecastSummary(summary: string): string {
  return summary
    .replace(/低置信|中置信|高置信/gu, '')
    .replace(
      /预计下一周期(?:的)?.*?大概率落在\s*([\d,.]+)\s*到\s*([\d,.]+)\s*之间/u,
      `预计下一周期的${forecastMetricLabel.value}大概率在 $1 到 $2 之间`,
    )
    .replace(/预计下一周期大概率落在/u, `预计下一周期的${forecastMetricLabel.value}大概率在`)
    .replace(/\s+/gu, ' ')
    .trim();
}

/**
 * 生成重点结果的主标题，优先使用客户和项目，保证经营对象可识别。
 *
 * 参数说明：`row` 为后端返回的明细记录。
 * 返回值：可读业务对象标题。
 */
function formatFocusTitle(row: Record<string, unknown>): string {
  const customer = pickText(row, ['customer_name', 'customerName', '最终客户', '客户名称']);
  const project = pickText(row, ['project_name', 'projectName', 'opportunity_name', '商机名称', '项目名称']);
  if (customer && project) {
    return `${customer} / ${project}`;
  }

  return (
    customer ||
    project ||
    pickText(row, [
      'team_name',
      'teamName',
      'department_name',
      'departmentName',
      'owner_name',
      'ownerName',
      'year_label',
      'yearLabel',
      'quarter_label',
      'quarterLabel',
      'month_label',
      'monthLabel',
    ]) ||
    '未命名结果'
  );
}

/**
 * 提取重点行里最适合露出的金额指标，并返回带业务标签的中文文案。
 *
 * 参数说明：`row` 为后端返回的结果行。
 * 返回值：如“承诺商机 2,151.52”；无有效金额时返回空字符串。
 */
function formatPrimaryAmountMeta(row: Record<string, unknown>): string {
  const candidates = [
    ['expected_amount', '预计金额'],
    ['committed_amount', '承诺商机'],
    ['total_opportunity_amount', '商机总额'],
    ['contract_amount', '合同总额'],
    ['valid_income', '有效收入'],
    ['annual_forecast', '全年预测'],
    ['annual_total_amount', '全年合计'],
    ['opportunity_amount', '商机金额'],
    ['amount', '金额'],
    ['value', '金额'],
  ] as const;

  for (const [key, label] of candidates) {
    const amount = formatAmount(row[key]);
    if (amount) {
      return `${label} ${amount}`;
    }
  }

  return '';
}

/**
 * 生成重点结果的辅助说明，明细行突出阶段和签单时间，汇总行突出金额和数量。
 *
 * 参数说明：`row` 为后端返回的明细记录。
 * 返回值：可读辅助信息列表。
 */
function formatFocusMeta(row: Record<string, unknown>): string[] {
  const stage = pickText(row, ['stage_name', 'stageName', '销售阶段']);
  const owner = pickText(row, ['owner_name', 'ownerName', '负责人']);
  const amount = formatPrimaryAmountMeta(row);
  const signDate = pickText(row, ['expected_sign_date', 'expectedSignDate', '预计签单日期']);
  const count = pickText(row, ['opportunity_count', 'contract_count', 'count']);

  if (focusProfile.value.kind === 'detail') {
    return [
      stage,
      owner ? `负责人 ${owner}` : '',
      amount,
      signDate ? `预计签单 ${signDate}` : '',
    ].filter(Boolean);
  }

  return [
    amount,
    count ? `数量 ${count}` : '',
    owner ? `负责人 ${owner}` : '',
  ].filter(Boolean);
}
</script>

<template>
  <section class="analysis-rich-report">
    <article class="analysis-rich-report__hero">
      <div>
        <span class="analysis-rich-report__eyebrow">AI 经营分析</span>
        <p>
          <NumberToneText :text="report.executiveSummary" />
        </p>
      </div>
      <div class="analysis-rich-report__status">
        <span>
          <NumberToneText :text="`可信度 ${report.analysisConfidence ?? '待评估'}`" />
        </span>
        <span v-if="report.predictionHorizon">
          <NumberToneText :text="`预测窗口 ${report.predictionHorizon}`" />
        </span>
      </div>
    </article>

    <section
      v-if="metricItems.length"
      class="analysis-rich-report__metrics"
      aria-label="关键指标"
    >
      <article
        v-for="metric in metricItems"
        :key="metric.name"
        class="analysis-rich-report__metric"
      >
        <span>
          <NumberToneText :text="metric.name" />
        </span>
        <strong>
          <NumberToneText
            :text="metric.value"
            :tone-hint="metric.name"
          />
        </strong>
      </article>
    </section>

    <div class="analysis-rich-report__grid">
      <article class="analysis-rich-report__card analysis-rich-report__card--primary">
        <div class="analysis-rich-report__card-head">
          <span>关键发现</span>
          <strong>
            <NumberToneText :text="`${keyFindingItems.length} 条`" />
          </strong>
        </div>
        <ul
          v-if="keyFindingItems.length"
          class="analysis-rich-report__insight-list"
        >
          <li
            v-for="item in keyFindingItems"
            :key="`${item.datasetId}-${item.title}`"
            :data-tone="item.tone"
          >
            <span>
              <NumberToneText
                :text="item.detail"
                :tone-hint="item.tone"
              />
            </span>
          </li>
        </ul>
        <p v-else>
          当前暂无关键发现。
        </p>
      </article>

      <article class="analysis-rich-report__card">
        <div class="analysis-rich-report__card-head">
          <span>趋势预测</span>
          <strong>
            <NumberToneText :text="forecastStatusLabel" />
          </strong>
        </div>
        <span
          v-if="forecastConfidenceLabel"
          class="analysis-rich-report__forecast-chip"
        >
          <NumberToneText :text="forecastConfidenceLabel" />
        </span>
        <p>
          <NumberToneText :text="forecastDisplaySummary" />
        </p>
        <p
          v-if="boundarySummary"
          class="analysis-rich-report__boundary"
        >
          <NumberToneText
            :text="boundarySummary"
            tone-hint="风险边界"
          />
        </p>
      </article>
    </div>

    <article
      v-if="focusRows.length"
      class="analysis-rich-report__card analysis-rich-report__focus"
    >
      <div class="analysis-rich-report__card-head">
        <span>
          <NumberToneText :text="focusProfile.title" />
        </span>
        <strong>
          <NumberToneText :text="`Top ${focusRows.length}`" />
        </strong>
      </div>
      <ol class="analysis-rich-report__focus-list">
        <li
          v-for="(row, index) in focusRows"
          :key="`${formatFocusTitle(row)}-${index}`"
        >
          <span class="analysis-rich-report__focus-index">
            <NumberToneText :text="index + 1" />
          </span>
          <div>
            <strong>
              <NumberToneText :text="formatFocusTitle(row)" />
            </strong>
            <p>
              <NumberToneText :text="formatFocusMeta(row).join(' / ')" />
            </p>
          </div>
        </li>
      </ol>
    </article>

    <div class="analysis-rich-report__grid">
      <article class="analysis-rich-report__card">
        <div class="analysis-rich-report__card-head">
          <span>经营建议</span>
          <strong>
            <NumberToneText :text="`${recommendationItems.length} 条`" />
          </strong>
        </div>
        <ul
          v-if="recommendationItems.length"
          class="analysis-rich-report__action-list"
        >
          <li
            v-for="item in recommendationItems"
            :key="`${item.priority}-${item.title}`"
          >
            <span>
              <NumberToneText :text="item.priority" />
            </span>
            <div>
              <strong>
                <NumberToneText :text="item.title" />
              </strong>
              <p>
                <NumberToneText :text="item.action" />
              </p>
            </div>
          </li>
        </ul>
        <p v-else>
          当前暂无经营建议。
        </p>
      </article>

      <article
        v-if="riskItems.length"
        class="analysis-rich-report__card analysis-rich-report__card--risk"
      >
        <div class="analysis-rich-report__card-head">
          <span>关注事项</span>
          <strong>
            <NumberToneText
              :text="`${riskItems.length} 条`"
              tone-hint="风险"
            />
          </strong>
        </div>
        <ul class="analysis-rich-report__insight-list">
          <li
            v-for="item in riskItems"
            :key="`${item.title}-${item.detail}`"
          >
            <strong>
              <NumberToneText :text="item.title" />
            </strong>
            <span>
              <NumberToneText
                :text="item.detail"
                tone-hint="风险"
              />
            </span>
          </li>
        </ul>
      </article>
    </div>

    <section class="analysis-rich-report__markdown">
      <button
        class="analysis-rich-report__markdown-toggle"
        type="button"
        @click="toggleMarkdown"
      >
        {{ isMarkdownVisible ? '收起完整阅读稿' : '查看完整阅读稿' }}
      </button>

      <AnalysisMarkdownPreview
        v-if="isMarkdownVisible"
        title="完整分析阅读稿"
        :markdown="detailMarkdown"
        :temporal-scope="temporalScope ?? report.temporalScope"
      />
    </section>
  </section>
</template>

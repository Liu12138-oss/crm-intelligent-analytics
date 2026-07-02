<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import {
  ElButton,
  ElDrawer,
  ElIcon,
  ElInput,
  ElOption,
  ElSelect,
  ElMessage,
  ElMessageBox,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus';
import NumberToneText from '@/components/analysis/NumberToneText.vue';
import ObjectIconLabel from '@/components/shared/ObjectIconLabel.vue';
import { analysisService } from '@/services/analysis.service';
import type { QueryTemplateItem } from '@/types/analysis';
import { formatPolicyStatusLabel, formatViewTypeLabel } from '@/ui/business-code-labels';
import { UiIcons } from '@/ui/icons';
import { resolvePolicyStatusTone, toStatusToneClass } from '@/ui/status-presentation';
import { toUserFacingErrorMessage } from '@/utils/user-facing-error';

type FeedbackTone = 'info' | 'success' | 'warning' | 'error';
type TemplateEditorMode = 'create' | 'edit';

interface QueryConditionPreset {
  key: string;
  label: string;
  sourcePanel: string;
  suggestedName: string;
  description: string;
  questionText: string;
  defaultViewType: 'BAR_CHART' | 'LINE_CHART' | 'RANKING_TABLE' | 'DETAIL_TABLE';
  defaultFilters: Record<string, unknown>;
}

interface TemplateEditorFormState {
  name: string;
  description: string;
  tags: string[];
  defaultViewType: string;
  sqlText: string;
  defaultFiltersJson: string;
  parameterSchemaJson: string;
  renderConfigJson: string;
  displayOrder: string;
  status: 'ACTIVE' | 'INACTIVE';
}

const QUERY_CONDITION_PRESETS: QueryConditionPreset[] = [
  {
    key: 'recent-new-opportunity',
    label: '近一周新增商机',
    sourcePanel: '近一周商机信息-（新增）',
    suggestedName: '近一周新增商机明细',
    description: '查看近一周新增商机明细、负责人、销售阶段和预计有效收入，便于快速跟进新增机会。',
    questionText: '近一周新增商机明细',
    defaultViewType: 'DETAIL_TABLE',
    defaultFilters: {
      recentDays: 7,
      metricScope: 'new_opportunity',
      groupBy: 'detail',
      sortBy: 'created_at_desc',
    },
  },
  {
    key: 'team-completion-2026',
    label: '2026 团队完成预测',
    sourcePanel: '2026各团队完成预测',
    suggestedName: '2026 各团队完成预测',
    description: '按团队查看全年目标、当前有效收入、承诺商机、全年预测和完成率预测。',
    questionText: '2026 各团队完成预测',
    defaultViewType: 'BAR_CHART',
    defaultFilters: {
      year: 2026,
      metricScope: 'team_completion_forecast',
      groupBy: 'team',
      committedOnly: true,
    },
  },
  {
    key: 'year-completion-snapshot',
    label: '全年完成预测总览',
    sourcePanel: '2025全年完成预测',
    suggestedName: '全年完成预测总览',
    description: '汇总全年有效收入、承诺商机、季度拆分和全年完成预测，便于判断年度目标达成空间。',
    questionText: '今年全年完成预测总览',
    defaultViewType: 'DETAIL_TABLE',
    defaultFilters: {
      year: 2026,
      metricScope: 'completion_forecast_summary',
      granularity: 'quarter',
      committedOnly: true,
    },
  },
  {
    key: 'committed-quarter-2026',
    label: '2026 承诺商机季度拆分',
    sourcePanel: '商机信息-（不含输单商机）',
    suggestedName: '2026 承诺商机季度拆分',
    description: '按团队查看承诺商机金额、季度拆分、商机总额和商机数量。',
    questionText: '2026 各团队承诺商机季度拆分',
    defaultViewType: 'BAR_CHART',
    defaultFilters: {
      year: 2026,
      metricScope: 'committed_opportunity',
      groupBy: 'team',
      granularity: 'quarter',
      excludeLoseStages: true,
    },
  },
  {
    key: 'contract-trend-last-4-years',
    label: '近四年提单趋势',
    sourcePanel: '提单合同（有效收入）',
    suggestedName: '近四年提单与有效收入趋势',
    description: '查看近四年合同金额、未回款金额和有效收入的季度趋势。',
    questionText: '近四年提单合同与有效收入趋势',
    defaultViewType: 'LINE_CHART',
    defaultFilters: {
      recentYears: 4,
      metricScope: 'contract_and_valid_income',
      granularity: 'quarter',
    },
  },
  {
    key: 'contract-income-trend',
    label: '近四年提单趋势',
    sourcePanel: '提单合同（有效收入）',
    suggestedName: '近四年提单与有效收入趋势',
    description: '查看近四年提单合同金额、未回款金额和有效收入的季度趋势。',
    questionText: '近四年提单合同与有效收入趋势',
    defaultViewType: 'LINE_CHART',
    defaultFilters: {
      recentYears: 4,
      metricScope: 'contract_income_trend',
      granularity: 'quarter',
    },
  },
  {
    key: 'ten-percent-opportunity',
    label: '10%+ 商机新增趋势',
    sourcePanel: '10%商机新增（万元）',
    suggestedName: '10%+ 商机新增趋势',
    description: '查看近四年签单可能性不低于 10% 的新增商机金额季度趋势。',
    questionText: '近四年 10% 以上商机新增趋势',
    defaultViewType: 'BAR_CHART',
    defaultFilters: {
      recentYears: 4,
      probabilityFloor: 10,
      metricScope: 'high_probability_opportunity',
      granularity: 'quarter',
    },
  },
  {
    key: 'customer-contract-dimension',
    label: '客户维度提单',
    sourcePanel: '客户维度提单数据（万元）',
    suggestedName: '客户维度提单数据',
    description: '按客户查看归属部门、客户级别、合同数量、合同金额和有效收入。',
    questionText: '客户维度提单数据',
    defaultViewType: 'DETAIL_TABLE',
    defaultFilters: {
      metricScope: 'customer_contract_dimension',
      groupBy: 'customer',
      includeCustomerLevel: true,
      includeValidIncome: true,
      include201BranchFlag: true,
    },
  },
  {
    key: 'valuable-customer-history',
    label: '价值客户历史提单',
    sourcePanel: '价值客户历史提单数据',
    suggestedName: '价值客户历史提单趋势',
    description: '按年度查看价值客户合同数、合同总额和有效收入，便于评估重点客户贡献变化。',
    questionText: '价值客户历史提单趋势',
    defaultViewType: 'BAR_CHART',
    defaultFilters: {
      customerCategory: '重点客户',
      metricScope: 'valuable_customer_contract_history',
      groupBy: 'year',
    },
  },
];

const DEFAULT_VIEW_OPTIONS = [
  {
    value: 'DETAIL_TABLE',
    label: '明细表',
  },
  {
    value: 'RANKING_TABLE',
    label: '排名表',
  },
  {
    value: 'BAR_CHART',
    label: '柱状图',
  },
  {
    value: 'LINE_CHART',
    label: '折线图',
  },
] as const;

const templates = ref<QueryTemplateItem[]>([]);
const templateFacets = ref<{ tags: string[] }>({
  tags: [],
});
const templateKeywordInput = ref('');
const templateKeyword = ref('');
const listLoading = ref(false);
const drawerVisible = ref(false);
const editorMode = ref<TemplateEditorMode>('create');
const editingTemplateId = ref<string | null>(null);
const saving = ref(false);
const validating = ref(false);
const previewing = ref(false);
const deletingTemplateId = ref<string | null>(null);
const previewResult = ref<Record<string, unknown> | null>(null);
const latestValidationSnapshot = ref<QueryTemplateItem['validationSnapshot'] | null>(null);

const editorForm = reactive<TemplateEditorFormState>(createDefaultEditorForm());

const editorDrawerTitle = computed(() =>
  editorMode.value === 'edit' ? '编辑模板' : '新增模板',
);
const templateStatusEnabled = computed({
  get: () => editorForm.status === 'ACTIVE',
  set: (value: boolean) => {
    editorForm.status = value ? 'ACTIVE' : 'INACTIVE';
  },
});

const filteredTemplates = computed(() => {
  const keyword = templateKeyword.value.trim().toLowerCase();
  if (!keyword) {
    return templates.value;
  }

  return templates.value.filter((item) =>
    [item.name, item.description, item.sqlText]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(keyword),
  );
});

function createDefaultEditorForm(): TemplateEditorFormState {
  const defaultPreset = QUERY_CONDITION_PRESETS[0];
  const defaultSql = `SELECT
  o.id AS opportunity_id,
  o.title AS project_name,
  ROUND(COALESCE(o.expect_amount, 0) / 10000, 2) AS expected_amount,
  DATE_FORMAT(o.created_at, '%Y-%m-%d') AS created_at
FROM opportunities o
ORDER BY o.created_at DESC
LIMIT 20`;

  return {
    name: defaultPreset.suggestedName,
    description: defaultPreset.description,
    tags: ['常用查询'],
    defaultViewType: defaultPreset.defaultViewType,
    sqlText: defaultSql,
    defaultFiltersJson: stringifyJson(defaultPreset.defaultFilters),
    parameterSchemaJson: '[]',
    renderConfigJson: stringifyJson({
      primaryViewType: resolvePrimaryViewType(defaultPreset.defaultViewType),
      primaryTitle: defaultPreset.questionText,
    }),
    displayOrder: '99',
    status: 'ACTIVE',
  };
}

function stringifyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function resolvePrimaryViewType(defaultViewType: string): string {
  if (defaultViewType === 'BAR_CHART') {
    return 'BAR_CHART';
  }
  if (defaultViewType === 'LINE_CHART') {
    return 'LINE_CHART';
  }
  if (defaultViewType === 'RANKING_TABLE') {
    return 'RANKING_TABLE';
  }
  return 'TABLE';
}

function showFeedback(message: string, tone: FeedbackTone) {
  if (tone === 'error') {
    ElMessage.error(
      toUserFacingErrorMessage(
        message,
        '当前操作暂未成功，请检查填写内容后重试；如果仍有问题，请联系管理员。',
      ),
    );
    return;
  }

  if (tone === 'warning') {
    ElMessage.warning(message);
    return;
  }

  ElMessage.success(message);
}

function resetEditorForm() {
  Object.assign(editorForm, createDefaultEditorForm());
  previewResult.value = null;
  latestValidationSnapshot.value = null;
}

function resolveTemplateRow(row?: QueryTemplateItem | null): QueryTemplateItem | null {
  return row ?? templates.value[0] ?? null;
}

function hydrateEditorForm(template: QueryTemplateItem) {
  const renderConfig = template.renderConfig ?? {
    primaryViewType: resolvePrimaryViewType(template.defaultViewType ?? 'DETAIL_TABLE'),
    primaryTitle: template.defaultQuestionText,
  };

  Object.assign(editorForm, {
    name: template.name,
    description: template.description,
    tags: [...(template.tags ?? [])],
    defaultViewType: template.defaultViewType ?? 'DETAIL_TABLE',
    sqlText: template.sqlText ?? createDefaultEditorForm().sqlText,
    defaultFiltersJson: stringifyJson(template.defaultFilters ?? {}),
    parameterSchemaJson: stringifyJson(template.parameterSchema ?? []),
    renderConfigJson: stringifyJson(renderConfig),
    displayOrder: String(template.displayOrder ?? 0),
    status: template.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
  });
  latestValidationSnapshot.value = template.validationSnapshot ?? null;
}

const templateScopeAnalysisMessage = computed(
  () => latestValidationSnapshot.value?.scopeAnalysis?.friendlyMessage ?? '',
);
const templateScopeRiskFindings = computed(
  () => latestValidationSnapshot.value?.scopeAnalysis?.riskFindings ?? [],
);
const templateScopeFixSuggestions = computed(
  () => latestValidationSnapshot.value?.scopeAnalysis?.fixSuggestions ?? [],
);

function openCreateDrawer() {
  editorMode.value = 'create';
  editingTemplateId.value = null;
  drawerVisible.value = true;
  resetEditorForm();
}

function openEditDrawer(template: QueryTemplateItem) {
  editorMode.value = 'edit';
  editingTemplateId.value = template.templateId;
  drawerVisible.value = true;
  previewResult.value = null;
  hydrateEditorForm(template);
}

async function loadTemplates() {
  if (listLoading.value) {
    return;
  }

  listLoading.value = true;
  try {
    const response = await analysisService.listGovernanceTemplates();
    templates.value = response.items;
    templateFacets.value = await analysisService.listGovernanceTemplateFacets();
  } catch (error) {
    showFeedback(
      toUserFacingErrorMessage(
        error,
        '模板列表暂时没有加载成功，请稍后刷新重试；如果多次失败，请联系管理员。',
      ),
      'error',
    );
  } finally {
    listLoading.value = false;
  }
}

async function handleTemplateQuery(): Promise<void> {
  templateKeyword.value = templateKeywordInput.value.trim();
  await loadTemplates();
}

function parseJsonObjectField(label: string, rawText: string): Record<string, unknown> {
  try {
    const parsedValue = JSON.parse(rawText.trim() || '{}');
    if (!parsedValue || Array.isArray(parsedValue) || typeof parsedValue !== 'object') {
      throw new Error(`${label} 必须是 JSON 对象。`);
    }
    return parsedValue as Record<string, unknown>;
  } catch (error) {
    if (error instanceof Error && error.message.includes('必须是 JSON 对象')) {
      throw error;
    }
    throw new Error(`${label} 不是有效 JSON，请检查逗号和引号。`);
  }
}

function parseJsonArrayField(label: string, rawText: string): Array<Record<string, unknown>> {
  try {
    const parsedValue = JSON.parse(rawText.trim() || '[]');
    if (!Array.isArray(parsedValue)) {
      throw new Error(`${label} 必须是 JSON 数组。`);
    }
    return parsedValue as Array<Record<string, unknown>>;
  } catch (error) {
    if (error instanceof Error && error.message.includes('必须是 JSON 数组')) {
      throw error;
    }
    throw new Error(`${label} 不是有效 JSON 数组，请检查逗号和括号。`);
  }
}

function buildTemplatePayload() {
  const name = editorForm.name.trim();
  const description = editorForm.description.trim();
  const defaultQuestionText = name;

  if (!name) {
    throw new Error('模板名称不能为空。');
  }

  if (!description) {
    throw new Error('模板说明不能为空。');
  }

  if (!editorForm.sqlText.trim()) {
    throw new Error('查询 SQL 不能为空。');
  }

  const displayOrder = Number(editorForm.displayOrder);
  if (!Number.isInteger(displayOrder) || displayOrder < 0) {
    throw new Error('展示顺序必须是大于等于 0 的整数。');
  }

  const renderConfig = parseJsonObjectField('展示配置', editorForm.renderConfigJson);
  renderConfig.primaryViewType = resolvePrimaryViewType(editorForm.defaultViewType);
  renderConfig.primaryTitle = defaultQuestionText;

  return {
    name,
    description,
    tags: editorForm.tags.map((item) => item.trim()).filter(Boolean),
    defaultQuestionText,
    defaultFilters: parseJsonObjectField('默认查询条件', editorForm.defaultFiltersJson),
    defaultViewType: editorForm.defaultViewType.trim() || 'DETAIL_TABLE',
    sqlText: editorForm.sqlText.trim(),
    parameterSchema: parseJsonArrayField('参数定义', editorForm.parameterSchemaJson),
    renderConfig,
    visibleRoleIds: [],
    displayOrder,
    status: editorForm.status,
  };
}

async function saveTemplate() {
  if (saving.value || validating.value) {
    return;
  }

  try {
    const payload = buildTemplatePayload();
    saving.value = true;
    await runTemplateValidation(payload.sqlText, false);

    if (editorMode.value === 'edit' && editingTemplateId.value) {
      await analysisService.updateGovernanceTemplate(editingTemplateId.value, payload);
      showFeedback('模板已保存。', 'success');
    } else {
      await analysisService.createGovernanceTemplate(payload);
      showFeedback('模板已创建。', 'success');
    }

    drawerVisible.value = false;
    await loadTemplates();
  } catch (error) {
    showFeedback(
      toUserFacingErrorMessage(
        error,
        '模板暂时没有保存成功，请检查填写内容后再试；如果仍有问题，请联系管理员。',
      ),
      'error',
    );
  } finally {
    saving.value = false;
  }
}

async function runTemplateValidation(sqlText: string, showSuccessMessage: boolean) {
  if (validating.value) {
    return;
  }

  try {
    validating.value = true;
    const response = await analysisService.validateGovernanceTemplate(
      editingTemplateId.value ?? 'draft_template',
      {
        sqlText,
      },
    );

    if (showSuccessMessage) {
      showFeedback(String(response.message ?? '模板 SQL 校验通过。'), 'success');
    }

    const scopeAnalysis =
      typeof response.scopeAnalysis === 'object' && response.scopeAnalysis
        ? (response.scopeAnalysis as NonNullable<NonNullable<QueryTemplateItem['validationSnapshot']>['scopeAnalysis']>)
        : undefined;
    latestValidationSnapshot.value = {
      status: (response.status as 'PASSED' | 'FAILED') ?? 'PASSED',
      message: String(response.message ?? '模板 SQL 校验通过。'),
      scopeAnalysis,
    };

    return response;
  } finally {
    validating.value = false;
  }
}

async function validateTemplate() {
  try {
    await runTemplateValidation(editorForm.sqlText.trim(), true);
  } catch (error) {
    showFeedback(
      toUserFacingErrorMessage(
        error,
        '模板 SQL 暂时没有校验通过，请根据页面提示调整后再试。',
      ),
      'error',
    );
  }
}

async function previewTemplate() {
  if (previewing.value) {
    return;
  }

  if (!editingTemplateId.value) {
    showFeedback('请先保存模板，再执行预览。', 'warning');
    return;
  }

  try {
    const payload = buildTemplatePayload();
    previewing.value = true;
    previewResult.value = await analysisService.previewGovernanceTemplate(editingTemplateId.value, {
      parameters: payload.defaultFilters,
    });
    showFeedback('模板预览已生成。', 'success');
  } catch (error) {
    showFeedback(
      toUserFacingErrorMessage(
        error,
        '模板预览暂时没有生成成功，请稍后重试；如果多次失败，请联系管理员。',
      ),
      'error',
    );
  } finally {
    previewing.value = false;
  }
}

async function confirmDeleteTemplate(template: QueryTemplateItem) {
  try {
    await ElMessageBox.confirm(
      '删除后不会自动恢复，确认继续吗？',
      '删除模板',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    );
  } catch {
    return;
  }

  await deleteTemplate(template);
}

async function deleteTemplate(template: QueryTemplateItem) {
  if (deletingTemplateId.value) {
    return;
  }

  try {
    deletingTemplateId.value = template.templateId;
    await analysisService.deleteGovernanceTemplate(template.templateId);

    if (editingTemplateId.value === template.templateId) {
      drawerVisible.value = false;
    }

    showFeedback(`模板「${template.name}」已删除。`, 'success');
    await loadTemplates();
  } catch (error) {
    showFeedback(
      toUserFacingErrorMessage(
        error,
        '模板暂时没有删除成功，请稍后重试；如果仍有问题，请联系管理员。',
      ),
      'error',
    );
  } finally {
    deletingTemplateId.value = null;
  }
}

function formatFilterValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(' / ');
  }
  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }
  if (value && typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function summarizeFilters(filters: Record<string, unknown>): string {
  const entries = Object.entries(filters ?? {});
  if (entries.length === 0) {
    return '未设置';
  }

  const previewText = entries
    .slice(0, 3)
    .map(([key, value]) => `${key}=${formatFilterValue(value)}`)
    .join(' · ');

  if (entries.length <= 3) {
    return previewText;
  }

  return `${previewText} 等 ${entries.length} 项`;
}

function formatUpdatedAt(updatedAt: string): string {
  return updatedAt.replace('T', ' ').slice(0, 16);
}

onMounted(async () => {
  await loadTemplates();
});
</script>

<template>
  <div class="page governance-page query-template-page">
    <div class="query-template-library">
      <section class="panel query-template-library__main">
        <div class="panel__header">
          <div>
            <h2 class="table-panel__title">
              模板列表
            </h2>
          </div>
          <div class="panel__header-actions">
            <el-button
              class="button-primary"
              type="primary"
              @click="openCreateDrawer"
            >
              <el-icon>
                <component :is="UiIcons.template" />
              </el-icon>
              新增模板
            </el-button>
          </div>
        </div>
        <div class="panel__body panel__body--stack">
          <div class="permission-toolbar">
            <label class="form-field permission-toolbar__search">
              <span>查询模板</span>
              <el-input
                v-model="templateKeywordInput"
                class="input"
                clearable
                placeholder="输入模板名称、说明或 SQL"
                @keyup.enter="handleTemplateQuery"
              />
            </label>
            <el-button
              class="button-primary permission-toolbar__query"
              type="primary"
              :loading="listLoading"
              @click="handleTemplateQuery"
            >
              {{ listLoading ? '查询中...' : '查询' }}
            </el-button>
          </div>
          <div class="table-wrap">
            <el-table
              class="table"
              :data="filteredTemplates"
              stripe
              border
              empty-text="暂无查询模板。"
            >
              <el-table-column
                label="模板名称"
                min-width="180"
              >
                <template #default="{ row }">
                  <ObjectIconLabel
                    type="template"
                    tone="template"
                    :label="resolveTemplateRow(row)?.name ?? '--'"
                    :description="formatViewTypeLabel(resolveTemplateRow(row)?.defaultViewType ?? 'DETAIL_TABLE')"
                  />
                </template>
              </el-table-column>
              <el-table-column
                label="模板说明"
                min-width="220"
              >
                <template #default="{ row }">
                  <NumberToneText :text="resolveTemplateRow(row)?.description ?? '--'" />
                </template>
              </el-table-column>
              <el-table-column
                label="标签"
                min-width="180"
              >
                <template #default="{ row }">
                  <div class="query-template-table__tags">
                    <el-tag
                      v-for="tag in (resolveTemplateRow(row)?.tags ?? []).slice(0, 3)"
                      :key="tag"
                      type="info"
                      round
                    >
                      {{ tag }}
                    </el-tag>
                  </div>
                </template>
              </el-table-column>
              <el-table-column
                label="默认条件"
                min-width="260"
              >
                <template #default="{ row }">
                  <NumberToneText :text="summarizeFilters(resolveTemplateRow(row)?.defaultFilters ?? {})" />
                </template>
              </el-table-column>
              <el-table-column
                label="主视图"
                min-width="120"
              >
                <template #default="{ row }">
                  {{ formatViewTypeLabel(resolveTemplateRow(row)?.defaultViewType ?? 'DETAIL_TABLE') }}
                </template>
              </el-table-column>
              <el-table-column
                label="历史点击"
                min-width="100"
              >
                <template #default="{ row }">
                  <NumberToneText :text="resolveTemplateRow(row)?.usageCountTotal ?? resolveTemplateRow(row)?.clickCount7d ?? '--'" />
                </template>
              </el-table-column>
              <el-table-column
                label="归属人"
                min-width="130"
              >
                <template #default="{ row }">
                  <NumberToneText :text="resolveTemplateRow(row)?.ownerUserId ?? '--'" />
                </template>
              </el-table-column>
              <el-table-column
                label="来源"
                min-width="150"
              >
                <template #default="{ row }">
                  <NumberToneText
                    :text="
                      resolveTemplateRow(row)?.sourceSnapshot?.sourceTemplateName ??
                        (resolveTemplateRow(row)?.sourceType === 'FREE_QUERY_SAVED' ? '自由问数保存' : '治理创建')
                    "
                  />
                </template>
              </el-table-column>
              <el-table-column
                label="命中率"
                min-width="100"
              >
                <template #default="{ row }">
                  <NumberToneText :text="`${resolveTemplateRow(row)?.hitRatePercent ?? '--'}%`" />
                </template>
              </el-table-column>
              <el-table-column
                label="状态"
                min-width="100"
              >
                <template #default="{ row }">
                  <el-tag
                    :class="[
                      'badge',
                      toStatusToneClass(
                        resolvePolicyStatusTone(resolveTemplateRow(row)?.status ?? 'INACTIVE'),
                      ),
                    ]"
                    :type="resolveTemplateRow(row)?.status === 'ACTIVE' ? 'success' : 'info'"
                    round
                  >
                    <el-icon>
                      <component :is="resolveTemplateRow(row)?.status === 'ACTIVE' ? UiIcons.success : UiIcons.warning" />
                    </el-icon>
                    {{ formatPolicyStatusLabel(resolveTemplateRow(row)?.status ?? 'INACTIVE') }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column
                label="更新时间"
                min-width="140"
              >
                <template #default="{ row }">
                  <NumberToneText :text="formatUpdatedAt(resolveTemplateRow(row)?.updatedAt ?? '')" />
                </template>
              </el-table-column>
              <el-table-column
                label="操作"
                min-width="210"
                fixed="right"
                class-name="table-action-column"
              >
                <template #default="{ row }">
                  <div
                    v-if="resolveTemplateRow(row)"
                    class="query-template-table__actions table-action-buttons"
                  >
                    <el-button
                      data-testid="edit-template"
                      class="button-secondary"
                      @click="openEditDrawer(resolveTemplateRow(row)!)"
                    >
                      <el-icon>
                        <component :is="UiIcons.edit" />
                      </el-icon>
                      编辑
                    </el-button>
                    <el-button
                      data-testid="delete-template"
                      class="button-secondary button-secondary--danger"
                      :disabled="deletingTemplateId === resolveTemplateRow(row)?.templateId"
                      @click="confirmDeleteTemplate(resolveTemplateRow(row)!)"
                    >
                      <el-icon>
                        <component :is="UiIcons.delete" />
                      </el-icon>
                      {{
                        deletingTemplateId === resolveTemplateRow(row)?.templateId
                          ? '删除中...'
                          : '删除'
                      }}
                    </el-button>
                  </div>
                  <span v-else>--</span>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </section>
    </div>

    <el-drawer
      v-model="drawerVisible"
      :title="editorDrawerTitle"
      size="760px"
      destroy-on-close
    >
      <div class="query-template-editor">
        <label class="form-field">
          <span>模板状态</span>
          <el-switch
            v-model="templateStatusEnabled"
            data-testid="template-status-switch"
            inline-prompt
            active-text="启用"
            inactive-text="停用"
          />
        </label>

        <label class="form-field">
          <span>模板名称</span>
          <el-input
            v-model="editorForm.name"
            class="input"
            placeholder="请填写模板名称"
          />
        </label>

        <label class="form-field">
          <span>模板说明</span>
          <el-input
            v-model="editorForm.description"
            class="textarea"
            type="textarea"
            :rows="4"
            placeholder="请填写模板说明"
          />
        </label>

        <div class="field-grid">
          <label class="form-field">
            <span>标签</span>
            <el-select
              v-model="editorForm.tags"
              class="input"
              multiple
              filterable
              allow-create
              default-first-option
              placeholder="选择已有标签，或输入新标签"
            >
              <el-option
                v-for="item in templateFacets.tags"
                :key="item"
                :label="item"
                :value="item"
              />
            </el-select>
          </label>
        </div>

        <div class="field-grid">
          <label class="form-field">
            <span>默认视图</span>
            <el-select
              v-model="editorForm.defaultViewType"
              data-testid="default-view-select"
              class="input"
              placeholder="请选择默认视图"
            >
              <el-option
                v-for="option in DEFAULT_VIEW_OPTIONS"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </label>
          <label class="form-field">
            <span>展示顺序</span>
            <el-input
              v-model="editorForm.displayOrder"
              class="input"
              placeholder="0 以上整数"
            />
          </label>
        </div>

        <label class="form-field">
          <span>查询 SQL</span>
          <el-input
            v-model="editorForm.sqlText"
            class="textarea"
            type="textarea"
            :rows="10"
            placeholder="请输入模板原始 SQL，系统会在执行时按当前用户权限自动判断是否收口。"
          />
        </label>

        <div
          v-if="templateScopeAnalysisMessage"
          class="empty-state query-template-editor__scope-tip"
        >
          <strong>范围识别结果</strong>
          <span>
            <NumberToneText :text="templateScopeAnalysisMessage" />
          </span>
          <ul
            v-if="templateScopeRiskFindings.length > 0"
            class="query-template-editor__risk-list"
          >
            <li
              v-for="finding in templateScopeRiskFindings"
              :key="finding.code"
            >
              <strong>{{ finding.title }}</strong>
              <span>{{ finding.description }}</span>
            </li>
          </ul>
          <ul
            v-if="templateScopeFixSuggestions.length > 0"
            class="query-template-editor__risk-list"
          >
            <li
              v-for="suggestion in templateScopeFixSuggestions"
              :key="suggestion"
            >
              <span>{{ suggestion }}</span>
            </li>
          </ul>
        </div>

        <div class="analysis-page__button-row">
          <el-button
            data-testid="validate-template"
            class="button-secondary"
            :loading="validating"
            @click="validateTemplate"
          >
            {{ validating ? '校验中...' : '校验 SQL' }}
          </el-button>
          <el-button
            data-testid="preview-template"
            class="button-secondary"
            :disabled="editorMode === 'create'"
            :loading="previewing"
            @click="previewTemplate"
          >
            {{ previewing ? '预览中...' : '预览模板' }}
          </el-button>
        </div>

        <div
          v-if="previewResult"
          class="empty-state query-template-editor__preview"
        >
          <strong>预览结果</strong>
          <span>
            <NumberToneText :text="`${previewResult.templateId ?? '当前模板'} 已生成预览。`" />
          </span>
        </div>
      </div>

      <template #footer>
        <div class="query-template-editor__footer">
          <el-button
            class="button-secondary"
            @click="drawerVisible = false"
          >
            取消
          </el-button>
          <el-button
            class="button-primary"
            type="primary"
            :loading="saving"
            @click="saveTemplate"
          >
            {{ saving ? '保存中...' : editorMode === 'edit' ? '保存修改' : '创建模板' }}
          </el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

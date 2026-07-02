<script setup lang="ts">
/**
 * 看板模板治理页（v2）
 *
 * 功能：
 * - Tab 切换：模板管理 / 运行预览
 * - 模板管理：列表 + 新增 + 编辑 + 删除
 * - 运行预览：选中模板运行看板，用 ManagementSectionCanvas 渲染结果
 * - 内置模板只读（tpl_ 前缀），自定义模板可编辑/删除（custom_ 前缀）
 */

import { computed, onMounted, reactive, ref } from 'vue';
import {
  ElButton,
  ElDialog,
  ElDrawer,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElMessage,
  ElOption,
  ElPopconfirm,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus';
import {
  CirclePlusFilled,
  Delete,
  Edit,
  Refresh,
  VideoPlay,
  View,
} from '@element-plus/icons-vue';
import BusinessVisualAnchor from '@/components/shared/BusinessVisualAnchor.vue';
import ManagementSectionCanvas from '@/components/management-report/ManagementSectionCanvas.vue';
import { dashboardService } from '@/services/dashboard.service';
import type {
  DashboardTemplateItem,
  DashboardComposeResult,
} from '@/services/dashboard.service';
import type { ManagementReportSectionData } from '@/types/management-report';
import { toUserFacingErrorMessage } from '@/utils/user-facing-error';

// ─── 类型 ───

interface ProfileOption {
  value: string;
  label: string;
  description: string;
}

// ─── Tab 状态 ───

type ActiveTab = 'manage' | 'preview';

const activeTab = ref<ActiveTab>('manage');

// ─── 模板数据 ───

const templates = ref<DashboardTemplateItem[]>([]);
const loading = ref(false);

// ─── Profile 选项 ───

const profileOptions = ref<ProfileOption[]>([]);

// ─── 详情抽屉（运行预览） ───

const detailVisible = ref(false);
const selectedTemplate = ref<DashboardTemplateItem | null>(null);
const rewriteForm = ref<Record<string, string>>({});

// ─── 运行结果 ───

const composeResult = ref<DashboardComposeResult | null>(null);
const composing = ref(false);

const resultSection = computed<ManagementReportSectionData | undefined>(() => {
  if (!composeResult.value) return undefined;
  return {
    sectionKey: 'dashboard-result',
    title: composeResult.value.reportTitle,
    summary: composeResult.value.executiveSummary,
    state: 'ready',
    blocks: composeResult.value.blocks as never[],
  };
});

// ─── 新建/编辑弹窗 ───

const formDialogVisible = ref(false);
const formMode = ref<'create' | 'update'>('create');
const editingTemplateId = ref<string>('');
const formLoading = ref(false);
const formModel = reactive({
  name: '',
  description: '',
  profile: '' as string,
  category: 'channel' as string,
});
const formRules = {
  name: [{ required: true, message: '请输入模板名称', trigger: 'blur' }],
  profile: [{ required: true, message: '请选择看板类型', trigger: 'change' }],
};

// ─── 辅助方法 ───

function isBuiltIn(template: DashboardTemplateItem): boolean {
  return template.templateId.startsWith('tpl_');
}

function isCustom(template: DashboardTemplateItem): boolean {
  return !isBuiltIn(template);
}

const categoryToneMap: Record<string, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
  channel: 'primary',
  agent: 'success',
  region: 'warning',
  owner: 'info',
};

// ─── 数据加载 ───

async function loadTemplates() {
  loading.value = true;
  try {
    const resp = await dashboardService.getTemplates();
    templates.value = resp.code === 0 ? resp.data : [];
  } catch (error) {
    ElMessage.error(toUserFacingErrorMessage(error, '加载看板模板失败'));
  } finally {
    loading.value = false;
  }
}

async function loadProfileOptions() {
  try {
    const resp = await dashboardService.getProfileOptions();
    if (resp.code === 0) {
      profileOptions.value = resp.data;
    }
  } catch {
    // 静默失败，使用硬编码 fallback
    profileOptions.value = [
      { value: 'channel-order-summary', label: '渠道下单汇总', description: '按渠道统计下单金额、数量、集中度和排名' },
      { value: 'agent-development', label: '代理商发展运营', description: '按大区/团队/合作级别统计签约额、商机数和省份覆盖' },
      { value: 'region-overview', label: '区域经营概览', description: '按区域统计下单、商机、报价等经营指标' },
      { value: 'owner-performance', label: '负责人业绩看板', description: '按负责人统计下单金额、数量、商机等业绩指标' },
    ];
  }
}

// ─── 模板 CRUD 操作 ───

function openCreateDialog() {
  formMode.value = 'create';
  editingTemplateId.value = '';
  formModel.name = '';
  formModel.description = '';
  formModel.profile = '';
  formModel.category = 'channel';
  formDialogVisible.value = true;
}

function openEditDialog(template: DashboardTemplateItem) {
  if (isBuiltIn(template)) {
    ElMessage.warning('内置模板不可编辑');
    return;
  }
  formMode.value = 'update';
  editingTemplateId.value = template.templateId;
  formModel.name = template.name;
  formModel.description = template.description ?? '';
  formModel.profile = template.profile;
  formModel.category = template.category;
  formDialogVisible.value = true;
}

async function handleSaveTemplate() {
  // 基础校验
  if (!formModel.name.trim()) {
    ElMessage.error('请输入模板名称');
    return;
  }
  if (!formModel.profile) {
    ElMessage.error('请选择看板类型');
    return;
  }

  formLoading.value = true;
  try {
    if (formMode.value === 'create') {
      const resp = await dashboardService.createTemplate({
        name: formModel.name.trim(),
        description: formModel.description.trim() || undefined,
        profile: formModel.profile,
        category: formModel.category as any,
      });
      if (resp.code === 0) {
        ElMessage.success('模板创建成功');
        formDialogVisible.value = false;
        loadTemplates();
      } else {
        ElMessage.error(resp.message || '创建失败');
      }
    } else {
      const resp = await dashboardService.updateTemplate(editingTemplateId.value, {
        name: formModel.name.trim(),
        description: formModel.description.trim() || undefined,
        profile: formModel.profile,
        category: formModel.category as any,
      });
      if (resp.code === 0) {
        ElMessage.success('模板更新成功');
        formDialogVisible.value = false;
        loadTemplates();
      } else {
        ElMessage.error(resp.message || '更新失败');
      }
    }
  } catch (error) {
    const action = formMode.value === 'create' ? '创建' : '更新';
    ElMessage.error(toUserFacingErrorMessage(error, `模板${action}失败`));
  } finally {
    formLoading.value = false;
  }
}

async function handleDeleteTemplate(template: DashboardTemplateItem) {
  try {
    const resp = await dashboardService.deleteTemplate(template.templateId);
    if (resp.code === 0) {
      ElMessage.success(`"${template.name}" 已删除`);
      loadTemplates();
    } else {
      ElMessage.error(resp.message || '删除失败');
    }
  } catch (error) {
    ElMessage.error(toUserFacingErrorMessage(error, '删除模板失败'));
  }
}

// ─── 模板详情与运行 ───

function handleViewDetail(template: DashboardTemplateItem) {
  selectedTemplate.value = template;
  rewriteForm.value = {};
  detailVisible.value = true;
}

async function handleRunFromDrawer() {
  if (!selectedTemplate.value) return;
  composing.value = true;
  composeResult.value = null;
  try {
    const overrides: Record<string, unknown> = {};
    for (const field of selectedTemplate.value.rewriteableFields) {
      const val = rewriteForm.value[field.key];
      if (val !== undefined && val !== '') {
        overrides[field.key] = field.key === 'limit' ? Number(val) : val;
      }
    }

    const resp = await dashboardService.runTemplate(selectedTemplate.value.templateId, {
      overrides,
    });
    if (resp.code === 0) {
      composeResult.value = resp.data;
      activeTab.value = 'preview';
      detailVisible.value = false;
      ElMessage.success('看板已生成');
    } else {
      ElMessage.error(`看板生成失败：${resp.code}`);
    }
  } catch (error) {
    ElMessage.error(toUserFacingErrorMessage(error, '看板生成失败'));
  } finally {
    composing.value = false;
  }
}

async function handleQuickRun(template: DashboardTemplateItem) {
  selectedTemplate.value = template;
  rewriteForm.value = {};
  composing.value = true;
  composeResult.value = null;
  detailVisible.value = false;
  try {
    const resp = await dashboardService.runTemplate(template.templateId, {});
    if (resp.code === 0) {
      composeResult.value = resp.data;
      activeTab.value = 'preview';
      ElMessage.success('看板已生成');
    }
  } catch (error) {
    ElMessage.error(toUserFacingErrorMessage(error, '看板生成失败'));
  } finally {
    composing.value = false;
  }
}

// ─── 初始化 ───

onMounted(() => {
  loadTemplates();
  loadProfileOptions();
});
</script>

<template>
  <div class="dashboard-template-page">
    <!-- 页头 -->
    <header class="dashboard-template-page__header">
      <div class="dashboard-template-page__title-wrap">
        <BusinessVisualAnchor module="management" :compact="true" />
        <div>
          <h1 class="dashboard-template-page__title">看板模板</h1>
          <p class="dashboard-template-page__desc">配置和管理可复用的经营看板模板</p>
        </div>
      </div>
      <div class="dashboard-template-page__actions">
        <ElButton type="primary" :icon="CirclePlusFilled" @click="openCreateDialog">
          新增模板
        </ElButton>
        <ElButton :icon="Refresh" @click="loadTemplates">刷新</ElButton>
      </div>
    </header>

    <!-- Tab 切换 -->
    <nav class="dashboard-template-page__tabs">
      <button
        class="dashboard-template-page__tab"
        :class="{ 'dashboard-template-page__tab--active': activeTab === 'manage' }"
        @click="activeTab = 'manage'"
      >
        <span class="dashboard-template-page__tab-icon">&#128203;</span>
        模板管理
      </button>
      <button
        class="dashboard-template-page__tab"
        :class="{ 'dashboard-template-page__tab--active': activeTab === 'preview' }"
        @click="activeTab = 'preview'"
        :disabled="!composeResult"
      >
        <span class="dashboard-template-page__tab-icon">&#128202;</span>
        运行预览
        <template v-if="composeResult">
          <span class="dashboard-template-page__tab-badge">{{ composeResult.reportTitle }}</span>
        </template>
      </button>
    </nav>

    <!-- ===== Tab 1: 模板管理 ===== -->
    <div v-show="activeTab === 'manage'" class="dashboard-template-panel">
      <ElTable
        :data="templates"
        v-loading="loading"
        stripe
        border
        style="width: 100%"
        :header-cell-style="{ background: '#F7FAFF', color: '#0A2540', fontSize: '13px', fontWeight: 600 }"
      >
        <ElTableColumn prop="name" label="模板名称" min-width="180">
          <template #default="{ row }">
            <span class="dashboard-template-page__name">{{ row.name }}</span>
            <ElTag v-if="isBuiltIn(row)" size="small" type="info" style="margin-left: 6px">内置</ElTag>
            <ElTag v-else size="small" type="success" style="margin-left: 6px">自定义</ElTag>
          </template>
        </ElTableColumn>

        <ElTableColumn prop="category" label="分类" width="90">
          <template #default="{ row }">
            <ElTag :type="categoryToneMap[row.category] ?? 'info'" size="small">
              {{ row.category }}
            </ElTag>
          </template>
        </ElTableColumn>

        <ElTableColumn prop="profile" label="看板类型" width="180">
          <template #default="{ row }">
            <span class="dashboard-template-page__profile-text">{{ row.profile }}</span>
          </template>
        </ElTableColumn>

        <ElTableColumn prop="description" label="描述" min-width="220" show-overflow-tooltip />

        <ElTableColumn prop="displayOrder" label="排序" width="70" align="center" />

        <ElTableColumn label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <ElButton type="primary" link @click="handleQuickRun(row)">
              <ElIcon><VideoPlay /></ElIcon> 运行
            </ElButton>
            <ElButton link @click="handleViewDetail(row)">
              <ElIcon><View /></ElIcon> 详情
            </ElButton>
            <ElButton
              v-if="isCustom(row)"
              link type="warning"
              @click="openEditDialog(row)"
            >
              <ElIcon><Edit /></ElIcon> 编辑
            </ElButton>
            <ElPopconfirm
              v-if="isCustom(row)"
              :title="'确认删除「' + row.name + '」？'"
              confirm-button-text="删除"
              cancel-button-text="取消"
              confirm-button-type="danger"
              @confirm="handleDeleteTemplate(row)"
            >
              <template #reference>
                <ElButton link type="danger">
                  <ElIcon><Delete /></ElIcon> 删除
                </ElButton>
              </template>
            </ElPopconfirm>
          </template>
        </ElTableColumn>
      </ElTable>
    </div>

    <!-- ===== Tab 2: 运行预览 ===== -->
    <div v-show="activeTab === 'preview'" class="dashboard-template-panel">
      <div v-if="composing" class="dashboard-template-page__composing">
        正在生成看板...
      </div>
      <div v-else-if="composeResult" class="dashboard-template-page__result">
        <div class="dashboard-template-page__result-meta">
          <span class="dashboard-template-page__result-title">{{ composeResult.reportTitle }}</span>
          <ElTag size="small" :type="composeResult.dataSource === 'OPENAPI_REALTIME' ? 'success' : 'warning'">
            {{ composeResult.dataSource === 'OPENAPI_REALTIME' ? '实时数据' : '快照数据' }}
          </ElTag>
          <span v-if="composeResult.errors.length > 0" class="dashboard-template-page__result-errors">
            {{ composeResult.errors.length }} 个接口异常
          </span>
        </div>
        <ManagementSectionCanvas :section="resultSection" />
      </div>
      <div v-else class="dashboard-template-page__empty-preview">
        <p>尚未运行任何看板模板</p>
        <p class="dashboard-template-page__empty-hint">请在「模板管理」中选择一个模板并点击「运行」</p>
      </div>
    </div>

    <!-- 详情抽屉 -->
    <ElDrawer
      v-model="detailVisible"
      :title="selectedTemplate?.name ?? '看板模板详情'"
      direction="rtl"
      size="420px"
    >
      <div v-if="selectedTemplate" class="dashboard-template-page__detail">
        <p class="dashboard-template-page__detail-desc">{{ selectedTemplate.description }}</p>

        <div class="dashboard-template-page__detail-field">
          <label>模板 ID</label>
          <code>{{ selectedTemplate.templateId }}</code>
        </div>
        <div class="dashboard-template-page__detail-field">
          <label>看板类型</label>
          <span>{{ selectedTemplate.profile }}</span>
        </div>
        <div class="dashboard-template-page__detail-field">
          <label>分类</label>
          <ElTag size="small" :type="categoryToneMap[selectedTemplate.category] ?? 'info'">
            {{ selectedTemplate.category }}
          </ElTag>
        </div>
        <div class="dashboard-template-page__detail-field">
          <label>适用角色</label>
          <span v-if="selectedTemplate.applicableRoles.length === 0">全部角色</span>
          <span v-else>{{ selectedTemplate.applicableRoles.join(', ') }}</span>
        </div>

        <!-- 条件改写区 -->
        <div v-if="selectedTemplate.rewriteableFields.length > 0" class="dashboard-template-page__rewrite">
          <h3>条件改写</h3>
          <div v-for="field in selectedTemplate.rewriteableFields" :key="field.key" class="dashboard-template-page__rewrite-field">
            <label>{{ field.label }}</label>
            <ElInput
              v-if="field.type === 'text'"
              v-model="rewriteForm[field.key]"
              :placeholder="field.placeholder"
            />
            <ElSelect
              v-else-if="field.type === 'select'"
              v-model="rewriteForm[field.key]"
              :placeholder="field.placeholder ?? '请选择'"
              clearable
              style="width: 100%"
            >
              <ElOption
                v-for="opt in field.options"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </ElSelect>
          </div>
        </div>

        <ElButton
          type="primary"
          :loading="composing"
          @click="handleRunFromDrawer"
          style="width: 100%; margin-top: 16px"
        >
          运行看板
        </ElButton>
      </div>
    </ElDrawer>

    <!-- 新建/编辑模板弹窗 -->
    <ElDialog
      v-model="formDialogVisible"
      :title="formMode === 'create' ? '新增看板模板' : '编辑看板模板'"
      width="560px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <ElForm
        :model="formModel"
        :rules="formRules"
        label-width="100px"
        label-position="top"
      >
        <ElFormItem label="模板名称" prop="name">
          <ElInput
            v-model="formModel.name"
            placeholder="如：华东区域销售分析看板"
            maxlength="60"
            show-word-limit
          />
        </ElFormItem>

        <ElFormItem label="描述说明">
          <ElInput
            v-model="formModel.description"
            type="textarea"
            placeholder="简要描述该看板的用途和数据范围"
            :rows="3"
            maxlength="200"
            show-word-limit
          />
        </ElFormItem>

        <ElFormItem label="看板类型" prop="profile">
          <ElSelect
            v-model="formModel.profile"
            placeholder="选择看板类型，决定展示的指标和图表"
            style="width: 100%"
          >
            <ElOption
              v-for="opt in profileOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            >
              <div style="line-height: 1.4">
                <strong>{{ opt.label }}</strong>
                <div style="font-size: 12px; color: #999;">{{ opt.description }}</div>
              </div>
            </ElOption>
          </ElSelect>
        </ElFormItem>

        <ElFormItem label="分类标签">
          <ElSelect v-model="formModel.category" style="width: 100%">
            <ElOption label="渠道分析" value="channel" />
            <ElOption label="代理商" value="agent" />
            <ElOption label="区域经营" value="region" />
            <ElOption label="负责人业绩" value="owner" />
          </ElSelect>
        </ElFormItem>

        <!-- 看板类型说明卡片 -->
        <div v-if="formModel.profile" class="dashboard-template-page__profile-hint">
          <div class="dashboard-template-page__profile-hint-title">该类型看板将包含：</div>
          <ul>
            <li v-if="formModel.profile === 'channel-order-summary'">
              KPI 指标卡（合作渠道数、下单总量、金额、平均单笔、报备数、商机数）
              + 集中度分析（TOP N 渠道占比）+ 渠道排名明细表
            </li>
            <li v-else-if="formModel.profile === 'agent-development'">
              KPI 指标卡（渠道商总数、覆盖省份、签约数、签约额）
              + 分组柱状图（大区对比）+ 地图覆盖 + 团队明细表
            </li>
            <li v-else-if="formModel.profile === 'region-overview'">
              KPI 指标卡（区域数、下单总量、金额、商机数）+ 区域排名明细表
            </li>
            <li v-else-if="formModel.profile === 'owner-performance'">
              KPI 指标卡（负责人数、下单总量、金额、商机数）+ 负责人排名明细表
            </li>
          </ul>
        </div>
      </ElForm>

      <template #footer>
        <ElButton @click="formDialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="formLoading" @click="handleSaveTemplate">
          {{ formMode === 'create' ? '创建' : '保存修改' }}
        </ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
.dashboard-template-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── 页头 ── */
.dashboard-template-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.dashboard-template-page__title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dashboard-template-page__title {
  margin: 0;
  font-size: 22px;
  font-weight: 500;
  color: #0A2540;
}

.dashboard-template-page__desc {
  margin: 0;
  font-size: 13px;
  color: #6B7C93;
}

.dashboard-template-page__actions {
  display: flex;
  gap: 8px;
}

/* ── Tab 导航 ── */
.dashboard-template-page__tabs {
  display: flex;
  gap: 2px;
  background: #F1F3F7;
  padding: 3px;
  border-radius: 10px;
  width: fit-content;
}

.dashboard-template-page__tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: #6B7C93;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.dashboard-template-page__tab:hover:not(:disabled) {
  color: #0A2540;
  background: rgba(255, 255, 255, 0.7);
}

.dashboard-template-page__tab--active {
  background: #fff;
  color: #185FA5;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.dashboard-template-page__tab:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.dashboard-template-page__tab-icon {
  font-size: 14px;
}

.dashboard-template-page__tab-badge {
  font-size: 11px;
  color: #999;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── 面板内容 ── */
.dashboard-template-panel {
  min-height: 200px;
}

/* ── 表格列样式 ── */
.dashboard-template-page__name {
  font-weight: 500;
  color: #0A2540;
}

.dashboard-template-page__profile-text {
  font-family: monospace;
  font-size: 12px;
  color: #444441;
  background: #F1EFE8;
  padding: 1px 6px;
  border-radius: 4px;
}

/* ── 运行状态 ── */
.dashboard-template-page__composing {
  padding: 40px;
  text-align: center;
  font-size: 14px;
  color: #6B7C93;
  background: #F6F9FC;
  border-radius: 16px;
}

.dashboard-template-page__result {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dashboard-template-page__result-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.dashboard-template-page__result-title {
  font-size: 17px;
  font-weight: 500;
  color: #0A2540;
}

.dashboard-template-page__result-errors {
  font-size: 12px;
  color: #B76E00;
}

/* ── 空状态 ── */
.dashboard-template-page__empty-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
  background: #F6F9FC;
  border-radius: 16px;
  color: #6B7C93;
}

.dashboard-template-page__empty-preview p:first-child {
  font-size: 16px;
  font-weight: 500;
  color: #444441;
  margin: 0 0 8px;
}

.dashboard-template-page__empty-hint {
  font-size: 13px;
  margin: 0;
}

/* ── 抽屉详情 ── */
.dashboard-template-page__detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dashboard-template-page__detail-desc {
  margin: 0;
  font-size: 14px;
  color: #425466;
  line-height: 1.6;
}

.dashboard-template-page__detail-field {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dashboard-template-page__detail-field label {
  font-size: 13px;
  color: #6B7C93;
  min-width: 80px;
  flex-shrink: 0;
}

.dashboard-template-page__detail-field code {
  font-family: monospace;
  font-size: 11px;
  background: #F1EFE8;
  padding: 2px 8px;
  border-radius: 4px;
  word-break: break-all;
}

/* ── 条件改写 ── */
.dashboard-template-page__rewrite {
  border-top: 1px solid #E6EBF1;
  padding-top: 16px;
}

.dashboard-template-page__rewrite h3 {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 500;
  color: #0A2540;
}

.dashboard-template-page__rewrite-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.dashboard-template-page__rewrite-field label {
  font-size: 12px;
  color: #6B7C93;
}

/* ── 表单提示 ── */
.dashboard-template-page__profile-hint {
  background: #F0F7FF;
  border: 1px solid #B5D4F4;
  border-radius: 8px;
  padding: 12px 16px;
  margin-top: 4px;
}

.dashboard-template-page__profile-hint-title {
  font-size: 13px;
  font-weight: 500;
  color: #185FA5;
  margin: 0 0 6px;
}

.dashboard-template-page__profile-hint ul {
  margin: 0;
  padding-left: 18px;
  list-style: disc;
}

.dashboard-template-page__profile-hint li {
  font-size: 12px;
  color: #444441;
  line-height: 1.65;
}
</style>

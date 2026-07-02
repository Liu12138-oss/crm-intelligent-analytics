<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import {
  ElAlert,
  ElButton,
  ElCheckbox,
  ElDrawer,
  ElInput,
  ElRadioButton,
  ElRadioGroup,
} from 'element-plus';
import type {
  RolePermissionItem,
  SimplifiedPermissionMenuProfile,
  SimplifiedPermissionProfile,
  SimplifiedPermissionRiskProfile,
} from '@/types/analysis';
import { buildSimplifiedPermissionProfile } from '@/utils/simplified-permission-profile';

type MenuKey = keyof SimplifiedPermissionMenuProfile;
type RiskKey = keyof SimplifiedPermissionRiskProfile;

const props = withDefaults(
  defineProps<{
    visible: boolean;
    saving: boolean;
    rolePermission: RolePermissionItem | null;
    menuOptions?: Array<{ label: string; value: string }>;
    actionOptions?: Array<{ label: string; value: string }>;
  }>(),
  {
    menuOptions: () => [],
    actionOptions: () => [],
  },
);

const emit = defineEmits<{
  (event: 'update:visible', value: boolean): void;
  (event: 'submit', payload: Record<string, unknown>): void;
}>();

const businessItems: Array<{
  key: MenuKey;
  label: string;
  description: string;
  risks?: Array<{ key: RiskKey; label: string }>;
}> = [
  {
    key: 'analysis',
    label: '智能分析',
    description: '打开智能分析菜单，包含问数、结果查看、继续追问和常用查询。',
    risks: [{ key: 'analysisExport', label: '导出数据' }],
  },
  {
    key: 'managementReport',
    label: '经营报表',
    description: '打开经营报表菜单，包含报表查询、专题切换和详情查看。',
    risks: [{ key: 'managementReportExport', label: '导出数据' }],
  },
  {
    key: 'contractReview',
    label: '智能合同审核',
    description: '打开合同审核菜单，包含本人范围内合同列表、详情和审核任务。',
    risks: [
      { key: 'contractCrossView', label: '查询他人合同' },
      { key: 'contractCrossDownload', label: '下载他人合同/审核产物' },
    ],
  },
];

const maintenanceItems: Array<{ key: MenuKey; label: string }> = [
  { key: 'permissionCenter', label: '权限中心' },
  { key: 'connectionPolicy', label: '连接策略' },
  { key: 'aiModelGovernance', label: 'AI配置' },
  { key: 'auditCenter', label: '审计中心' },
];

const draft = reactive({
  roleNameSnapshot: '',
  status: 'ACTIVE' as RolePermissionItem['status'],
  menus: {
    analysis: false,
    managementReport: false,
    contractReview: false,
    wecomBot: false,
    permissionCenter: false,
    templateGovernance: false,
    connectionPolicy: false,
    aiModelGovernance: false,
    auditCenter: false,
  } as SimplifiedPermissionMenuProfile,
  risks: {
    analysisExport: false,
    managementReportExport: false,
    contractCrossView: false,
    contractCrossDownload: false,
  } as SimplifiedPermissionRiskProfile,
  legacyWarnings: [] as SimplifiedPermissionProfile['legacyWarnings'],
  changeReason: '',
});

watch(
  () => props.rolePermission,
  (value) => {
    if (!value) {
      return;
    }

    const profile = buildSimplifiedPermissionProfile(value);
    draft.roleNameSnapshot = value.roleNameSnapshot;
    draft.status = value.status;
    Object.assign(draft.menus, profile.menus);
    draft.menus.templateGovernance = false;
    Object.assign(draft.risks, profile.risks);
    draft.legacyWarnings = profile.legacyWarnings ?? [];
    draft.changeReason = value.changeReason ?? '';
    normalizeRiskSelections();
  },
  { immediate: true },
);

const title = computed(() =>
  props.rolePermission ? `编辑角色权限 · ${props.rolePermission.roleNameSnapshot}` : '编辑角色权限',
);

/**
 * 清理脱离主菜单的风险子权限，保证前端提交前已经是合法组合。
 */
function normalizeRiskSelections(): void {
  if (!draft.menus.analysis) {
    draft.risks.analysisExport = false;
  }

  if (!draft.menus.managementReport) {
    draft.risks.managementReportExport = false;
  }

  if (!draft.menus.contractReview) {
    draft.risks.contractCrossView = false;
    draft.risks.contractCrossDownload = false;
  }
}

/**
 * 菜单勾选变化后立即同步风险子权限，避免隐藏子项继续残留。
 */
function handleMenuChange(): void {
  normalizeRiskSelections();
}

/**
 * 关闭抽屉并把显隐状态同步给父组件。
 */
function closeDrawer(): void {
  emit('update:visible', false);
}

/**
 * 提交管理员可见的简化权限树，后端统一负责生成旧运行时字段。
 */
function submit(): void {
  normalizeRiskSelections();
  emit('submit', {
    roleNameSnapshot: draft.roleNameSnapshot,
    status: draft.status,
    simplifiedPermissionProfile: {
      menus: { ...draft.menus },
      risks: { ...draft.risks },
    },
    changeReason: draft.changeReason,
  });
}
</script>

<template>
  <el-drawer
    :model-value="visible"
    size="560px"
    :title="title"
    @close="closeDrawer"
  >
    <div class="permission-drawer__body">
      <label class="form-field">
        <span>角色名称</span>
        <el-input
          v-model="draft.roleNameSnapshot"
          class="input"
          readonly
        />
      </label>

      <label class="form-field">
        <span>状态</span>
        <el-radio-group
          v-model="draft.status"
          class="permission-drawer__status-group"
        >
          <el-radio-button value="ACTIVE">
            启用
          </el-radio-button>
          <el-radio-button value="INACTIVE">
            停用
          </el-radio-button>
        </el-radio-group>
      </label>

      <el-alert
        v-if="draft.legacyWarnings?.includes('WEB_CONSOLE_WITHOUT_MENU')"
        class="permission-drawer__alert"
        type="warning"
        :closable="false"
        show-icon
        title="该角色历史上只开启了 Web 入口但没有配置具体菜单，保存前请确认要开放哪个菜单；如果不需要 Web 入口，保持所有菜单不勾选即可。"
      />

      <section class="permission-drawer__section">
        <h3 class="table-panel__title">
          业务功能
        </h3>
        <div class="permission-drawer__tree">
          <div
            v-for="item in businessItems"
            :key="item.key"
            class="permission-drawer__menu-card"
            :class="{ 'permission-drawer__menu-card--active': draft.menus[item.key] }"
          >
            <div class="permission-drawer__menu-row">
              <el-checkbox
                v-model="draft.menus[item.key]"
                class="permission-drawer__menu-checkbox"
                @change="handleMenuChange"
              >
                <span class="permission-drawer__menu-label">{{ item.label }}</span>
              </el-checkbox>
              <span class="permission-drawer__level-badge">菜单入口</span>
            </div>
            <p class="permission-drawer__menu-desc">
              {{ item.description }}
            </p>
            <div
              v-if="item.risks?.length"
              class="permission-drawer__risk-row"
              :class="{ 'permission-drawer__risk-row--disabled': !draft.menus[item.key] }"
            >
              <div class="permission-drawer__risk-title">
                <span class="permission-drawer__risk-line" />
                <span>附加功能</span>
              </div>
              <div class="permission-drawer__risk-options">
                <el-checkbox
                  v-for="risk in item.risks"
                  :key="risk.key"
                  v-model="draft.risks[risk.key]"
                  class="permission-drawer__risk-checkbox"
                  :disabled="!draft.menus[item.key]"
                >
                  <span class="permission-drawer__risk-label">{{ risk.label }}</span>
                </el-checkbox>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="permission-drawer__section">
        <h3 class="table-panel__title">
          移动端入口
        </h3>
        <div class="permission-drawer__tree">
          <div
            class="permission-drawer__menu-card"
            :class="{ 'permission-drawer__menu-card--active': draft.menus.wecomBot }"
          >
            <div class="permission-drawer__menu-row">
              <el-checkbox
                v-model="draft.menus.wecomBot"
                class="permission-drawer__menu-checkbox"
              >
                <span class="permission-drawer__menu-label">企业微信机器人</span>
              </el-checkbox>
              <span class="permission-drawer__level-badge">入口包</span>
            </div>
            <p class="permission-drawer__menu-desc">
              允许角色进入企业微信机器人，实际执行仍受灰度和 CRM 范围控制。
            </p>
          </div>
        </div>
      </section>

      <section class="permission-drawer__section">
        <h3 class="table-panel__title">
          系统维护
        </h3>
        <div class="permission-drawer__checkbox-grid">
          <div
            v-for="item in maintenanceItems"
            :key="item.key"
            class="permission-drawer__maintenance-card"
            :class="{ 'permission-drawer__maintenance-card--active': draft.menus[item.key] }"
          >
            <el-checkbox
              v-model="draft.menus[item.key]"
              class="permission-drawer__menu-checkbox"
            >
              <span class="permission-drawer__menu-label">{{ item.label }}</span>
            </el-checkbox>
            <span class="permission-drawer__level-badge">菜单入口</span>
          </div>
        </div>
      </section>

      <label class="form-field">
        <span>变更说明</span>
        <el-input
          v-model="draft.changeReason"
          class="textarea"
          type="textarea"
          :rows="3"
          placeholder="说明本次为什么调整该角色权限"
        />
      </label>
    </div>

    <template #footer>
      <div class="permission-drawer__footer">
        <el-button
          class="button-secondary"
          @click="closeDrawer"
        >
          取消
        </el-button>
        <el-button
          class="button-primary"
          type="primary"
          :loading="saving"
          :disabled="saving"
          @click="submit"
        >
          {{ saving ? '保存中...' : '保存权限' }}
        </el-button>
      </div>
    </template>
  </el-drawer>
</template>

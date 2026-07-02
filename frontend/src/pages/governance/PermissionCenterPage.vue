<script setup lang="ts">
import { computed, onActivated, onMounted, reactive, ref } from 'vue';
import {
  ElButton,
  ElCard,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
  ElIcon,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElPagination,
  ElSelect,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTabPane,
  ElTabs,
  ElTag,
  ElTooltip,
} from 'element-plus';
import RolePermissionFormDrawer from '@/components/governance/RolePermissionFormDrawer.vue';
import ObjectIconLabel from '@/components/shared/ObjectIconLabel.vue';
import WecomOrgSubjectPicker from '@/components/shared/WecomOrgSubjectPicker.vue';
import { markPageDataReady } from '@/services/navigation-performance.service';
import { analysisService } from '@/services/analysis.service';
import { useAuthStore } from '@/stores/auth.store';
import type {
  AccessGovernanceOverview,
  AccessOptionItem,
  ApplicationSuperAdminPolicyView,
  AccessOptionsView,
  AccessPreviewView,
  DataScopeGrantItem,
  DailyReportDeliveryPreviewView,
  DailyReportDepartmentPolicyItem,
  IdentityMappingDiagnosticItem,
  RolePermissionItem,
  WecomOrgSubjectOptionsView,
  WecomPilotPolicyView,
} from '@/types/analysis';
import { buildSimplifiedPermissionProfile } from '@/utils/simplified-permission-profile';
import {
  formatBusinessCodeText,
  formatIdentityMappingStatusLabel,
  formatPolicyStatusLabel,
  formatWecomAccessStateLabel,
  formatWecomPilotModeLabel,
} from '@/ui/business-code-labels';
import { UiIcons } from '@/ui/icons';
import {
  resolvePolicyStatusTone,
  toStatusToneClass,
} from '@/ui/status-presentation';
import { toUserFacingErrorMessage } from '@/utils/user-facing-error';

const PERMISSION_CENTER_DEFERRED_SECTION_DELAY_MS = 16;
const ROLE_PERMISSION_PAGE_SIZE_OPTIONS = [10, 20, 50];
const DAILY_REPORT_UNMAPPED_USER_VALUE_PREFIX = '__daily_report_unmapped_user__:';

interface DailyReportTeamUserOption extends AccessOptionItem {
  disabled?: boolean;
}

const authStore = useAuthStore();
const overview = ref<AccessGovernanceOverview | null>(null);
const rolePermissions = ref<RolePermissionItem[]>([]);
const rolePermissionPagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
  keyword: '',
  status: '' as '' | RolePermissionItem['status'],
});
const accessOptions = ref<AccessOptionsView>({
  users: [],
  roles: [],
  departments: [],
  wecomUsers: [],
});
const wecomOrgSubjects = ref<WecomOrgSubjectOptionsView | null>(null);
const pilotPolicy = reactive<WecomPilotPolicyView>({
  channel: 'wecom-bot',
  mode: 'FULL',
  allowUserIds: [],
  allowRoleIds: [],
  allowDepartmentIds: [],
  denyUserIds: [],
  note: '',
  updatedBy: '',
  updatedAt: '',
});
const applicationSuperAdminPolicy = reactive<ApplicationSuperAdminPolicyView>({
  policyId: 'application_super_admin_policy_current',
  subjects: [],
  fullAccessUserIds: [],
  fullAccessRoleIds: [],
  updatedBy: '',
  updatedAt: '',
  changeReason: '',
});
const identityMappings = ref<IdentityMappingDiagnosticItem[]>([]);
const dataScopeGrants = ref<DataScopeGrantItem[]>([]);
const dailyReportDepartments = ref<DailyReportDepartmentPolicyItem[]>([]);
const dailyReportStrategies = ref<DailyReportDepartmentPolicyItem[]>([]);
const dailyReportPreview = ref<DailyReportDeliveryPreviewView | null>(null);
const dataScopeGrantError = ref('');
const dailyReportDepartmentError = ref('');
const dailyReportPreviewError = ref('');
const identityMappingError = ref('');
const loading = ref(false);
const deferredSectionLoading = ref(false);
const deferredSectionHydrated = ref(false);
const rolePermissionLoading = ref(false);
const accessOptionsLoading = ref(false);
const wecomOrgSubjectsLoading = ref(false);
const wecomOrgSubjectsError = ref('');
const savingRolePermission = ref(false);
const savingPilotPolicy = ref(false);
const savingAnalysisScopePolicy = ref(false);
const savingDailyReportDepartment = ref(false);
const dailyReportSavingGroupIds = ref<Set<string>>(new Set());
const loadingDailyReportPreview = ref(false);
const roleDrawerVisible = ref(false);
const selectedRolePermission = ref<RolePermissionItem | null>(null);
const accessPreview = ref<AccessPreviewView | null>(null);
const previewLoading = ref(false);
type GovernanceTab =
  | 'role-permissions'
  | 'wecom-access'
  | 'analysis-scope'
  | 'data-scope'
  | 'identity-access'
  | 'daily-report';

const activeGovernanceTab = ref<GovernanceTab>('role-permissions');

const previewForm = reactive({
  crmUserId: '',
  wecomUserId: '',
});

const dataScopeGrantDraft = reactive({
  subjectType: 'ROLE' as DataScopeGrantItem['subjectType'],
  subjectId: '',
  departmentIds: [] as string[],
  includeSubDepartments: true,
  reason: '',
  status: 'ACTIVE' as DataScopeGrantItem['status'],
});

const identityFilters = reactive({
  wecomUserId: '',
});

const dailyReportPreviewForm = reactive({
  businessDate: new Date().toISOString().slice(0, 10),
});
const dailyReportTeamKeyword = ref('');
const dailyReportTeamEditorVisible = ref(false);
const dailyReportSalesGroupDraft = reactive({
  groupId: '',
  groupName: '',
  regionDepartmentId: '',
  regionDepartmentName: '',
  status: 'DISABLED' as 'ENABLED' | 'DISABLED',
  recipientCrmUserIds: [] as string[],
  memberCrmUserIds: [] as string[],
  reason: '',
});

const simplifiedPermissionMenuItems = [
  { key: 'analysis', label: '智能分析' },
  { key: 'managementReport', label: '经营报表' },
  { key: 'contractReview', label: '智能合同审核' },
  { key: 'wecomBot', label: '企业微信机器人' },
  { key: 'permissionCenter', label: '权限中心' },
  { key: 'connectionPolicy', label: '连接策略' },
  { key: 'aiModelGovernance', label: 'AI配置' },
  { key: 'auditCenter', label: '审计中心' },
] as const;

const simplifiedPermissionRiskItems = [
  { key: 'analysisExport', label: '智能分析导出数据' },
  { key: 'managementReportExport', label: '经营报表导出数据' },
  { key: 'contractCrossView', label: '查询他人合同' },
  { key: 'contractCrossDownload', label: '下载他人合同/审核产物' },
] as const;

const helperTips = {
  grayRule:
    '命中停用名单时优先阻断；白名单开放模式下必须命中用户、角色或部门白名单之一。',
};
let deferredSectionTimer: number | undefined;

const dailyReportTeams = computed(() => dailyReportPreview.value?.groups ?? []);

const dailyReportTeamUserOptions = computed<DailyReportTeamUserOption[]>(() => {
  const options = new Map<string, DailyReportTeamUserOption>();

  accessOptions.value.users.forEach((item) => {
    appendDailyReportUserOption(options, item.value, item.label);
  });

  dailyReportTeams.value.forEach((row) => {
    appendDailyReportRecipientOption(options, row);

    row.members?.forEach((member) => {
      appendDailyReportMemberOption(options, member);
    });

    row.memberRequesterIds.forEach((requesterId) => {
      appendDailyReportUserOption(options, requesterId, requesterId);
    });
  });

  dailyReportSalesGroupDraft.recipientCrmUserIds.forEach((crmUserId) => {
    appendDailyReportUserOption(options, crmUserId, crmUserId);
  });
  dailyReportSalesGroupDraft.memberCrmUserIds.forEach((crmUserId) => {
    appendDailyReportUserOption(options, crmUserId, crmUserId);
  });

  return Array.from(options.values());
});

const filteredDailyReportTeams = computed(() => {
  const keyword = dailyReportTeamKeyword.value.trim().toLowerCase();
  if (!keyword) {
    return dailyReportTeams.value;
  }

  return dailyReportTeams.value.filter((item) => {
    const searchableText = [
      item.groupDepartmentName,
      formatDailyReportRecipientNames(item),
      formatDailyReportMemberNames(item),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return searchableText.includes(keyword);
  });
});

const dailyReportTeamEmptyText = computed(() =>
  dailyReportTeams.value.length === 0
    ? '暂无日报团队，点击新增团队补充。'
    : '没有匹配的日报团队。',
);

/**
 * 将简化权限树中的菜单包转为管理员可读的中文列表。
 */
function formatSimplifiedProfileMenus(
  profile: ReturnType<typeof buildSimplifiedPermissionProfile>,
): string {
  return simplifiedPermissionMenuItems
    .filter((item) => profile.menus[item.key])
    .map((item) => item.label)
    .join('、');
}

/**
 * 将简化权限树中的风险子权限转为管理员可读的中文列表。
 */
function formatSimplifiedProfileRisks(
  profile: ReturnType<typeof buildSimplifiedPermissionProfile>,
): string {
  return simplifiedPermissionRiskItems
    .filter((item) => profile.risks[item.key])
    .map((item) => item.label)
    .join('、');
}

/**
 * 角色列表优先展示菜单包，旧字段只作为接口未升级时的回显兜底。
 */
function formatRolePermissionMenus(row: RolePermissionItem): string {
  return formatSimplifiedProfileMenus(buildSimplifiedPermissionProfile(row));
}

/**
 * 角色列表只展示少量风险子权限，避免普通管理员看到内部动作键。
 */
function formatRolePermissionRisks(row: RolePermissionItem): string {
  return formatSimplifiedProfileRisks(buildSimplifiedPermissionProfile(row));
}

/**
 * 权限预览没有完整角色记录时，用最终菜单、动作和合同权限组装临时记录做统一中文展示。
 */
function buildPreviewPermissionProfile(
  preview: AccessPreviewView,
): ReturnType<typeof buildSimplifiedPermissionProfile> {
  if (preview.simplifiedPermissionProfile) {
    return preview.simplifiedPermissionProfile;
  }

  return buildSimplifiedPermissionProfile({
    roleId: 'preview',
    roleNameSnapshot: preview.roleNames.join('、') || preview.crmUserName || '预览用户',
    status: 'ACTIVE',
    visibleMenus: preview.visibleMenus,
    actionKeys: preview.actionKeys,
    webConsoleEnabled: preview.visibleMenus.length > 0,
    wecomBotEligible: preview.wecomBotAccessState === 'ALLOWED',
    exportAllowed: preview.actionKeys.includes('analysis.export'),
    templateManageAllowed: preview.actionKeys.includes('template.manage'),
    contractReviewUploadAllowed: preview.contractPermissions.uploadAllowed,
    contractReviewCrossViewAllowed: preview.contractPermissions.crossViewAllowed,
    contractReviewCrossDownloadAllowed: preview.contractPermissions.crossDownloadAllowed,
    updatedBy: 'system',
    updatedAt: '',
  });
}

/**
 * 权限预览展示菜单包，避免把内部动作键作为管理员解释口径。
 */
function formatAccessPreviewMenus(preview: AccessPreviewView): string {
  return formatSimplifiedProfileMenus(buildPreviewPermissionProfile(preview));
}

/**
 * 权限预览只展示独立风险子权限，普通动作由菜单包隐含表达。
 */
function formatAccessPreviewRisks(preview: AccessPreviewView): string {
  return formatSimplifiedProfileRisks(buildPreviewPermissionProfile(preview));
}

/**
 * 合并日报团队编辑弹窗可选用户，确保预览行已有的组长和组员即使不在全局候选项里也能按姓名回显。
 */
function appendDailyReportUserOption(
  options: Map<string, DailyReportTeamUserOption>,
  value: string | undefined,
  label: string | undefined,
  disabled = false,
): void {
  if (!value) {
    return;
  }

  const normalizedLabel = label?.trim() || value;
  const existing = options.get(value);
  if (!existing || (existing.label === existing.value && normalizedLabel !== value)) {
    options.set(value, {
      value,
      label: normalizedLabel,
      disabled,
    });
  }
}

/**
 * 从候选用户标签中提取姓名，候选项通常形如“张三（销售经理）”。
 */
function extractDailyReportAccessUserName(label: string): string {
  return label.split(/[（(]/u)[0]?.trim() ?? label.trim();
}

/**
 * 当企业微信映射缺失时，按姓名在 CRM 候选用户里做唯一匹配；重名或缺失时不自动猜测。
 */
function findUniqueDailyReportCrmUserOptionByName(
  name: string | undefined,
): AccessOptionItem | undefined {
  const normalizedName = name?.trim();
  if (!normalizedName) {
    return undefined;
  }

  const matchedOptions = accessOptions.value.users.filter(
    (item) => extractDailyReportAccessUserName(item.label) === normalizedName,
  );
  return matchedOptions.length === 1 ? matchedOptions[0] : undefined;
}

/**
 * 生成仅用于编辑弹窗回显的未映射人员选项值，避免把企业微信 ID 误当成 CRM 用户 ID 保存。
 */
function buildDailyReportUnmappedUserOptionValue(
  role: 'recipient' | 'member',
  identity: string | undefined,
  label: string | undefined,
): string | undefined {
  const normalizedIdentity = identity?.trim() || label?.trim();
  if (!normalizedIdentity) {
    return undefined;
  }
  return `${DAILY_REPORT_UNMAPPED_USER_VALUE_PREFIX}${role}:${normalizedIdentity}`;
}

/**
 * 判断选项值是否为未完成 CRM 映射时生成的回显占位值。
 */
function isDailyReportUnmappedUserOptionValue(value: string | undefined): boolean {
  return value?.startsWith(DAILY_REPORT_UNMAPPED_USER_VALUE_PREFIX) ?? false;
}

/**
 * 统一生成未映射人员的中文标签，提示用户当前人员只能回显，不能作为 CRM 收件配置保存。
 */
function formatDailyReportUnmappedUserLabel(
  name: string | undefined,
  fallback: string | undefined,
): string {
  return `${name?.trim() || fallback?.trim() || '未映射人员'}（未绑定 CRM）`;
}

/**
 * 补充日报团队组长选项；未完成 CRM 映射时只创建禁用回显项，避免编辑弹窗空白。
 */
function appendDailyReportRecipientOption(
  options: Map<string, DailyReportTeamUserOption>,
  row: DailyReportDeliveryPreviewView['groups'][number],
): void {
  pickDailyReportRecipientSourceItems(row).forEach((recipient) => {
    if (recipient.crmUserId) {
      appendDailyReportUserOption(options, recipient.crmUserId, recipient.name);
      return;
    }

    const matchedCrmUser = findUniqueDailyReportCrmUserOptionByName(recipient.name);
    if (matchedCrmUser) {
      appendDailyReportUserOption(options, matchedCrmUser.value, matchedCrmUser.label);
      return;
    }

    const value = buildDailyReportUnmappedUserOptionValue(
      'recipient',
      recipient.wecomUserId,
      recipient.name,
    );
    appendDailyReportUserOption(
      options,
      value,
      formatDailyReportUnmappedUserLabel(recipient.name, recipient.wecomUserId),
      true,
    );
  });
}

/**
 * 补充日报团队成员选项；未映射成员仅用于当前编辑回显，不参与保存写回。
 */
function appendDailyReportMemberOption(
  options: Map<string, DailyReportTeamUserOption>,
  member: NonNullable<DailyReportDeliveryPreviewView['groups'][number]['members']>[number],
): void {
  if (member.crmUserId) {
    appendDailyReportUserOption(options, member.crmUserId, member.memberName);
    return;
  }

  const matchedCrmUser = findUniqueDailyReportCrmUserOptionByName(member.memberName);
  if (matchedCrmUser) {
    appendDailyReportUserOption(options, matchedCrmUser.value, matchedCrmUser.label);
    return;
  }

  const value = buildDailyReportUnmappedUserOptionValue(
    'member',
    member.wecomUserId,
    member.memberName,
  );
  appendDailyReportUserOption(
    options,
    value,
    formatDailyReportUnmappedUserLabel(member.memberName, member.wecomUserId),
    true,
  );
}

/**
 * 将接口返回的说明文案做中文化兜底，避免业务状态码或菜单动作键直接暴露给用户。
 */
function formatHelperText(value: string | undefined): string {
  return formatBusinessCodeText(value);
}

async function loadPage(): Promise<void> {
  loading.value = true;
  const tasks = await Promise.allSettled([
    analysisService.getAccessGovernanceOverview(),
    analysisService.getApplicationSuperAdminPolicy(),
    analysisService.getWecomPilotPolicy(),
    loadAccessOptions(),
    loadWecomOrgSubjects(),
    loadRolePermissions(),
  ]);

  const [
    overviewResult,
    analysisScopePolicyResult,
    pilotResult,
    ,
    wecomOrgSubjectsResult,
    rolePermissionResult,
  ] = tasks;

  if (overviewResult.status === 'fulfilled') {
    overview.value = overviewResult.value;
  } else {
    ElMessage.error(
      toUserFacingErrorMessage(
        overviewResult.reason,
        '权限中心概览暂时没有加载成功，请稍后刷新重试；如果多次失败，请联系管理员。',
      ),
    );
  }

  if (analysisScopePolicyResult.status === 'fulfilled') {
    Object.assign(applicationSuperAdminPolicy, analysisScopePolicyResult.value);
  } else {
    ElMessage.error(
      toUserFacingErrorMessage(
        analysisScopePolicyResult.reason,
        '超级管理员授权暂时没有加载成功，请稍后刷新重试；如果多次失败，请联系管理员。',
      ),
    );
  }

  if (pilotResult.status === 'fulfilled') {
    Object.assign(pilotPolicy, pilotResult.value);
  } else {
    ElMessage.error(
      toUserFacingErrorMessage(
        pilotResult.reason,
        '企业微信灰度策略暂时没有加载成功，请稍后刷新重试；如果多次失败，请联系管理员。',
      ),
    );
  }

  if (rolePermissionResult.status === 'rejected') {
    ElMessage.error(
      toUserFacingErrorMessage(
        rolePermissionResult.reason,
        '角色权限暂时没有加载成功，请稍后刷新重试；如果多次失败，请联系管理员。',
      ),
    );
  }

  if (wecomOrgSubjectsResult.status === 'rejected') {
    ElMessage.error(
      toUserFacingErrorMessage(
        wecomOrgSubjectsResult.reason,
        '企业微信组织架构暂时没有加载成功，请稍后重试；如果多次失败，请联系管理员。',
      ),
    );
  }

  loading.value = false;
  markPageDataReady('/governance/access');
  scheduleDeferredSectionLoad();
}

function scheduleDeferredSectionLoad(force = false): void {
  if (typeof window === 'undefined') {
    void loadDeferredSections(force);
    return;
  }

  if (deferredSectionTimer) {
    window.clearTimeout(deferredSectionTimer);
  }

  deferredSectionTimer = window.setTimeout(() => {
    deferredSectionTimer = undefined;
    void loadDeferredSections(force);
  }, PERMISSION_CENTER_DEFERRED_SECTION_DELAY_MS);
}

async function loadDeferredSections(force = false): Promise<void> {
  if (deferredSectionLoading.value) {
    return;
  }
  if (deferredSectionHydrated.value && !force) {
    return;
  }

  deferredSectionLoading.value = true;
  const tasks = await Promise.allSettled([
    loadDataScopeGrants(),
    loadDailyReportDepartments(),
    loadDailyReportPreview(),
  ]);

  const [, dailyDepartmentResult, dailyPreviewResult] = tasks;

  if (dailyDepartmentResult.status === 'rejected') {
    ElMessage.error(
      dailyDepartmentResult.reason instanceof Error
        ? dailyDepartmentResult.reason.message
        : '加载日报部门配置失败',
    );
  }

  if (dailyPreviewResult.status === 'rejected') {
    ElMessage.error(
      dailyPreviewResult.reason instanceof Error
        ? dailyPreviewResult.reason.message
        : '加载日报发送预览失败',
    );
  }

  deferredSectionHydrated.value = tasks.every((item) => item.status === 'fulfilled');
  deferredSectionLoading.value = false;
}

async function loadDataScopeGrants(): Promise<void> {
  try {
    const response = await analysisService.listDataScopeGrants();
    dataScopeGrants.value = response.items;
    dataScopeGrantError.value = '';
  } catch (error) {
    dataScopeGrants.value = [];
    dataScopeGrantError.value = toUserFacingErrorMessage(
      error,
      '白名单设置暂时没有加载成功，请稍后重试；如果多次失败，请联系管理员。',
    );
    throw error;
  }
}

async function loadAccessOptions(): Promise<void> {
  accessOptionsLoading.value = true;
  try {
    accessOptions.value = await analysisService.listAccessOptions();
  } finally {
    accessOptionsLoading.value = false;
  }
}

async function loadWecomOrgSubjects(): Promise<void> {
  wecomOrgSubjectsLoading.value = true;
  try {
    wecomOrgSubjects.value = await analysisService.listWecomOrgSubjects();
    wecomOrgSubjectsError.value = '';
  } catch (error) {
    wecomOrgSubjects.value = null;
    wecomOrgSubjectsError.value = toUserFacingErrorMessage(
      error,
      '企业微信组织架构暂时没有加载成功，请稍后重试；如果多次失败，请联系管理员。',
    );
    throw error;
  } finally {
    wecomOrgSubjectsLoading.value = false;
  }
}

async function ensureAccessOptionsReady(): Promise<void> {
  if (
    accessOptions.value.users.length > 0 ||
    accessOptions.value.roles.length > 0 ||
    accessOptions.value.departments.length > 0 ||
    accessOptions.value.wecomUsers.length > 0 ||
    accessOptionsLoading.value
  ) {
    return;
  }

  try {
    await loadAccessOptions();
  } catch (error) {
    ElMessage.error(
      toUserFacingErrorMessage(
        error,
        '权限候选项暂时没有加载成功，请稍后重试；如果多次失败，请联系管理员。',
      ),
    );
  }
}

function formatDataScopeSubject(item: DataScopeGrantItem): string {
  const options = item.subjectType === 'USER' ? accessOptions.value.users : accessOptions.value.roles;
  return options.find((option) => option.value === item.subjectId)?.label ?? item.subjectId;
}

function formatDataScopeDepartments(item: DataScopeGrantItem): string {
  return item.departmentIds
    .map(
      (departmentId) =>
        accessOptions.value.departments.find((option) => option.value === departmentId)?.label ??
        departmentId,
    )
    .join('、');
}

/**
 * 生成仅供程序内部使用的数据范围授权编号。
 * 参数：授权对象类型与授权对象 ID。
 * 返回：可稳定复用的授权记录 ID；若已存在同主体授权则优先复用旧 ID，避免把存量记录另存成新记录。
 */
function resolveDataScopeGrantId(
  subjectType: DataScopeGrantItem['subjectType'],
  subjectId: string,
): string {
  const normalizedSubjectId = subjectId.trim();
  const existingGrant = dataScopeGrants.value.find(
    (item) => item.subjectType === subjectType && item.subjectId === normalizedSubjectId,
  );

  if (existingGrant) {
    return existingGrant.id;
  }

  const safeSubjectId = normalizedSubjectId
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return `grant_${safeSubjectId || 'data_scope'}`;
}

async function saveDataScopeGrant(): Promise<void> {
  await ensureAccessOptionsReady();
  try {
    const grantId = resolveDataScopeGrantId(
      dataScopeGrantDraft.subjectType,
      dataScopeGrantDraft.subjectId,
    );
    const saved = await analysisService.updateDataScopeGrant(grantId, {
      subjectType: dataScopeGrantDraft.subjectType,
      subjectId: dataScopeGrantDraft.subjectId,
      departmentIds: [...dataScopeGrantDraft.departmentIds],
      includeSubDepartments: dataScopeGrantDraft.includeSubDepartments,
      reason: dataScopeGrantDraft.reason,
      status: dataScopeGrantDraft.status,
    });
    const currentIndex = dataScopeGrants.value.findIndex((item) => item.id === saved.id);
    if (currentIndex >= 0) {
      dataScopeGrants.value[currentIndex] = saved;
    } else {
      dataScopeGrants.value.unshift(saved);
    }
    await authStore.loadCapabilities(true);
    ElMessage.success('白名单设置已保存。');
  } catch (error) {
    ElMessage.error(
      toUserFacingErrorMessage(
        error,
        '白名单设置暂时没有保存成功，请检查填写内容后再试；如果仍有问题，请联系管理员。',
      ),
    );
  }
}

async function loadDailyReportDepartments(): Promise<void> {
  try {
    const response = await analysisService.listDailyReportDeliveryDepartments();
    dailyReportDepartments.value = response.items;
    dailyReportStrategies.value = response.strategies;
    dailyReportDepartmentError.value = '';
  } catch (error) {
    dailyReportDepartments.value = [];
    dailyReportStrategies.value = [];
    dailyReportDepartmentError.value = toUserFacingErrorMessage(
      error,
      '日报部门策略暂时没有加载成功，请稍后重试；如果多次失败，请联系管理员。',
    );
    throw error;
  }
}

function formatDailyReportRuleSourceLabel(
  value: DailyReportDeliveryPreviewView['groups'][number]['ruleSource'],
): string {
  const labels: Record<typeof value, string> = {
    AUTO: '自动识别',
    REGION_OVERRIDE: '区域继承',
    SALES_GROUP_OVERRIDE: '小组覆盖',
    MANUAL_GROUP_CONFIG: '手动新增',
  };
  return labels[value] ?? value;
}

function formatDailyReportMemberNames(
  row: DailyReportDeliveryPreviewView['groups'][number],
): string {
  const names = (row.members ?? [])
    .map((item) => item.memberName ?? item.crmUserId)
    .filter(Boolean);
  if (names.length > 0) {
    return names.join('、');
  }
  if (row.memberRequesterIds.length > 0) {
    return row.memberRequesterIds.join('、');
  }
  return '暂无成员';
}

/**
 * 归一化日报团队组长展示数据，兼容旧单人字段和新多人字段。
 */
function pickDailyReportRecipientSourceItems(
  row: DailyReportDeliveryPreviewView['groups'][number],
): Array<{
  crmUserId?: string;
  name?: string;
  wecomUserId?: string;
}> {
  if (row.recipients?.length) {
    return row.recipients;
  }

  const maxLength = Math.max(
    row.recipientCrmUserIds?.length ?? 0,
    row.recipientNames?.length ?? 0,
    row.recipientWecomUserIds?.length ?? 0,
  );
  if (maxLength > 0) {
    return Array.from({ length: maxLength }, (_, index) => ({
      crmUserId: row.recipientCrmUserIds?.[index],
      name: row.recipientNames?.[index],
      wecomUserId: row.recipientWecomUserIds?.[index],
    }));
  }

  return [
    {
      crmUserId: row.recipientCrmUserId,
      name: row.recipientName,
      wecomUserId: row.recipientWecomUserId,
    },
  ].filter((item) => item.crmUserId || item.name || item.wecomUserId);
}

/**
 * 展示日报团队组长姓名，多人配置时用顿号连接，缺失时给出明确空状态。
 */
function formatDailyReportRecipientNames(
  row: DailyReportDeliveryPreviewView['groups'][number],
): string {
  const names = pickDailyReportRecipientSourceItems(row)
    .map((item) => item.name ?? item.crmUserId ?? item.wecomUserId)
    .filter(Boolean);
  return names.length > 0 ? Array.from(new Set(names as string[])).join('、') : '--';
}

/**
 * 提取团队内已完成 CRM 映射的组长 ID，用于保留快速启停和删除时的收件配置。
 */
function pickMappedDailyReportRecipientCrmUserIds(
  row: DailyReportDeliveryPreviewView['groups'][number],
): string[] {
  const ids = pickDailyReportRecipientSourceItems(row)
    .map((recipient) => recipient.crmUserId)
    .filter(Boolean);
  return Array.from(new Set(ids as string[]));
}

/**
 * 提取团队内已完成 CRM 映射的成员 ID，用于保存覆盖配置。
 */
function pickMappedDailyReportMemberCrmUserIds(
  row: DailyReportDeliveryPreviewView['groups'][number],
): string[] {
  const ids = row.members?.map((item) => item.crmUserId).filter(Boolean) ?? row.memberRequesterIds;
  return Array.from(new Set(ids as string[]));
}

/**
 * 提取编辑弹窗内可展示的组员值，未完成 CRM 映射的成员使用禁用占位值回显姓名。
 */
function pickDisplayDailyReportMemberUserIds(
  row: DailyReportDeliveryPreviewView['groups'][number],
): string[] {
  const displayIds =
    row.members?.map((member) => {
      if (member.crmUserId) {
        return member.crmUserId;
      }
      const matchedCrmUser = findUniqueDailyReportCrmUserOptionByName(member.memberName);
      if (matchedCrmUser) {
        return matchedCrmUser.value;
      }
      return buildDailyReportUnmappedUserOptionValue(
        'member',
        member.wecomUserId,
        member.memberName,
      );
    }) ?? row.memberRequesterIds;

  return Array.from(new Set(displayIds.filter(Boolean) as string[]));
}

/**
 * 提取编辑弹窗内可展示的组长值，未完成 CRM 映射时用禁用占位值承载当前企业微信负责人。
 */
function pickDisplayDailyReportRecipientUserIds(
  row: DailyReportDeliveryPreviewView['groups'][number],
): string[] {
  const displayIds = pickDailyReportRecipientSourceItems(row)
    .map((recipient) => {
      if (recipient.crmUserId) {
        return recipient.crmUserId;
      }
      const matchedCrmUser = findUniqueDailyReportCrmUserOptionByName(recipient.name);
      if (matchedCrmUser) {
        return matchedCrmUser.value;
      }
      return buildDailyReportUnmappedUserOptionValue(
        'recipient',
        recipient.wecomUserId,
        recipient.name,
      );
    })
    .filter(Boolean);

  return Array.from(new Set(displayIds as string[]));
}

/**
 * 保存前只保留真实 CRM 用户 ID，未映射回显占位值不能写入受控配置。
 */
function filterDailyReportMappedCrmUserIds(values: string[]): string[] {
  return Array.from(
    new Set(values.filter((value) => !isDailyReportUnmappedUserOptionValue(value))),
  );
}

/**
 * 判断指定团队是否正在保存，避免单行启停时锁住整张表。
 */
function isDailyReportGroupSaving(groupId: string): boolean {
  return dailyReportSavingGroupIds.value.has(groupId);
}

/**
 * 更新团队行级保存状态。
 */
function markDailyReportGroupSaving(groupId: string, saving: boolean): void {
  const next = new Set(dailyReportSavingGroupIds.value);
  if (saving) {
    next.add(groupId);
  } else {
    next.delete(groupId);
  }
  dailyReportSavingGroupIds.value = next;
}

/**
 * 打开日报团队新增弹窗，手动团队用于补齐企业微信组织架构未自动识别的小组。
 */
function openCreateDailyReportTeamDialog(): void {
  resetDailyReportSalesGroupDraft();
  dailyReportSalesGroupDraft.reason = '通过日报治理页面新增团队。';
  dailyReportTeamEditorVisible.value = true;
}

function resetDailyReportSalesGroupDraft(): void {
  dailyReportSalesGroupDraft.groupId = '';
  dailyReportSalesGroupDraft.groupName = '';
  dailyReportSalesGroupDraft.regionDepartmentId = '';
  dailyReportSalesGroupDraft.regionDepartmentName = '';
  dailyReportSalesGroupDraft.status = 'DISABLED';
  dailyReportSalesGroupDraft.recipientCrmUserIds = [];
  dailyReportSalesGroupDraft.memberCrmUserIds = [];
  dailyReportSalesGroupDraft.reason = '';
}

/**
 * 关闭团队编辑弹窗并清理草稿，避免上一行团队信息污染下一次新增。
 */
function closeDailyReportTeamDialog(): void {
  dailyReportTeamEditorVisible.value = false;
  resetDailyReportSalesGroupDraft();
}

/**
 * 将表格行写入编辑草稿，编辑自动识别团队时仍通过受控接口保存覆盖配置。
 */
function editDailyReportSalesGroup(row: DailyReportDeliveryPreviewView['groups'][number]): void {
  dailyReportSalesGroupDraft.groupId = row.groupDepartmentId;
  dailyReportSalesGroupDraft.groupName = row.groupDepartmentName;
  dailyReportSalesGroupDraft.regionDepartmentId = row.regionDepartmentId ?? '';
  dailyReportSalesGroupDraft.regionDepartmentName = row.regionDepartmentName ?? '';
  dailyReportSalesGroupDraft.status =
    row.effectivePolicy === 'DISABLED' ? 'DISABLED' : 'ENABLED';
  dailyReportSalesGroupDraft.recipientCrmUserIds =
    pickDisplayDailyReportRecipientUserIds(row);
  dailyReportSalesGroupDraft.memberCrmUserIds =
    pickDisplayDailyReportMemberUserIds(row);
  dailyReportSalesGroupDraft.reason = `通过日报治理页面编辑 ${row.groupDepartmentName}。`;
  dailyReportTeamEditorVisible.value = true;
}

async function saveDailyReportSalesGroup(): Promise<void> {
  if (savingDailyReportDepartment.value) {
    return;
  }
  if (!dailyReportSalesGroupDraft.groupName.trim()) {
    ElMessage.warning('请填写团队名。');
    return;
  }

  savingDailyReportDepartment.value = true;
  try {
    const normalizedReason =
      dailyReportSalesGroupDraft.reason.trim() ||
      (dailyReportSalesGroupDraft.groupId
        ? '通过日报治理页面编辑团队。'
        : '通过日报治理页面新增团队。');
    const mappedRecipientCrmUserIds = filterDailyReportMappedCrmUserIds(
      dailyReportSalesGroupDraft.recipientCrmUserIds,
    );
    const payload: Record<string, unknown> = {
      groupName: dailyReportSalesGroupDraft.groupName.trim(),
      regionDepartmentId: dailyReportSalesGroupDraft.regionDepartmentId || undefined,
      regionDepartmentName: dailyReportSalesGroupDraft.regionDepartmentName.trim() || undefined,
      status: dailyReportSalesGroupDraft.status,
      recipientCrmUserIds: mappedRecipientCrmUserIds,
      memberCrmUserIds: filterDailyReportMappedCrmUserIds(
        dailyReportSalesGroupDraft.memberCrmUserIds,
      ),
      memberOverrideEnabled: true,
      reason: normalizedReason,
    };
    if (dailyReportSalesGroupDraft.groupId) {
      await analysisService.updateDailyReportSalesGroup(
        dailyReportSalesGroupDraft.groupId,
        payload,
      );
    } else {
      await analysisService.createDailyReportSalesGroup(payload);
    }
    closeDailyReportTeamDialog();
    await loadDailyReportPreview();
    ElMessage.success('日报团队已保存。');
  } catch (error) {
    ElMessage.error(
      toUserFacingErrorMessage(
        error,
        '日报团队暂时没有保存成功，请检查填写内容后再试；如果仍有问题，请联系管理员。',
      ),
    );
  } finally {
    savingDailyReportDepartment.value = false;
  }
}

async function deleteDailyReportSalesGroup(
  row: DailyReportDeliveryPreviewView['groups'][number],
): Promise<void> {
  if (isDailyReportGroupSaving(row.groupDepartmentId)) {
    return;
  }

  try {
    const strategy = dailyReportStrategies.value.find(
      (item) => item.departmentId === row.groupDepartmentId,
    );
    await ElMessageBox.confirm(
      strategy
        ? `确认从日报治理中移除“${row.groupDepartmentName}”吗？系统不会删除企业微信组织，只会停用这个团队的日报发送。`
        : `确认删除“${row.groupDepartmentName}”吗？删除后该手动团队不会再出现在日报治理表格中。`,
      '删除日报团队',
      {
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    );
  } catch {
    return;
  }

  markDailyReportGroupSaving(row.groupDepartmentId, true);
  try {
    const strategy = dailyReportStrategies.value.find(
      (item) => item.departmentId === row.groupDepartmentId,
    );
    const recipientCrmUserIds = pickMappedDailyReportRecipientCrmUserIds(row);
    if (strategy) {
      await analysisService.updateDailyReportDeliveryDepartment(row.groupDepartmentId, {
        status: 'DISABLED',
        departmentType: strategy.departmentType,
        applyToChildren: strategy.applyToChildren,
        overrideRecipientCrmUserId: recipientCrmUserIds[0] ?? row.recipientCrmUserId,
        reason: '通过日报治理页面从列表移除自动识别团队。',
      });
    } else {
      await analysisService.deleteDailyReportSalesGroup(row.groupDepartmentId);
    }
    await loadDailyReportDepartments();
    await loadDailyReportPreview();
    ElMessage.success(`${row.groupDepartmentName} 已删除。`);
  } catch (error) {
    ElMessage.error(
      toUserFacingErrorMessage(
        error,
        '日报团队暂时没有删除成功，请稍后重试；如果仍有问题，请联系管理员。',
      ),
    );
  } finally {
    markDailyReportGroupSaving(row.groupDepartmentId, false);
  }
}

async function toggleDailyReportPreviewGroupStatus(
  row: DailyReportDeliveryPreviewView['groups'][number],
  enabled: boolean,
): Promise<void> {
  if (isDailyReportGroupSaving(row.groupDepartmentId)) {
    return;
  }

  const strategy = dailyReportStrategies.value.find(
    (item) => item.departmentId === row.groupDepartmentId,
  );
  const nextStatus = enabled ? 'ENABLED' : 'DISABLED';
  const recipientCrmUserIds = pickMappedDailyReportRecipientCrmUserIds(row);
  markDailyReportGroupSaving(row.groupDepartmentId, true);
  try {
    if (strategy) {
      await analysisService.updateDailyReportDeliveryDepartment(row.groupDepartmentId, {
        status: nextStatus,
        departmentType: strategy.departmentType,
        applyToChildren: strategy.applyToChildren,
        overrideRecipientCrmUserId: recipientCrmUserIds[0] ?? row.recipientCrmUserId,
        reason: enabled
          ? '通过日报团队表格快速启用日报团队。'
          : '通过日报团队表格快速停用日报团队。',
      });
    } else {
      await analysisService.updateDailyReportSalesGroup(row.groupDepartmentId, {
        groupName: row.groupDepartmentName,
        regionDepartmentId: row.regionDepartmentId,
        regionDepartmentName: row.regionDepartmentName,
        status: nextStatus,
        recipientCrmUserIds,
        memberCrmUserIds: pickMappedDailyReportMemberCrmUserIds(row),
        memberOverrideEnabled: true,
        reason: enabled
          ? '通过日报团队表格快速启用日报团队。'
          : '通过日报团队表格快速停用日报团队。',
      });
    }
    await loadDailyReportDepartments();
    await loadDailyReportPreview();
    ElMessage.success(
      enabled ? `${row.groupDepartmentName} 已启用日报。` : `${row.groupDepartmentName} 已停用日报。`,
    );
  } catch (error) {
    ElMessage.error(
      toUserFacingErrorMessage(
        error,
        '日报团队状态暂时没有切换成功，请稍后重试；如果仍有问题，请联系管理员。',
      ),
    );
  } finally {
    markDailyReportGroupSaving(row.groupDepartmentId, false);
  }
}

async function loadDailyReportPreview(): Promise<void> {
  loadingDailyReportPreview.value = true;
  try {
    dailyReportPreview.value = await analysisService.previewDailyReportDelivery({
      businessDate: dailyReportPreviewForm.businessDate,
    });
    dailyReportPreviewError.value = '';
  } catch (error) {
    dailyReportPreview.value = null;
    dailyReportPreviewError.value = toUserFacingErrorMessage(
      error,
      '日报发送预览暂时没有加载成功，请稍后重试；如果多次失败，请联系管理员。',
    );
    throw error;
  } finally {
    loadingDailyReportPreview.value = false;
  }
}

async function loadRolePermissions(): Promise<void> {
  rolePermissionLoading.value = true;
  try {
    const response = await analysisService.listRolePermissions({
      keyword: rolePermissionPagination.keyword,
      status: rolePermissionPagination.status || undefined,
      page: rolePermissionPagination.page,
      pageSize: rolePermissionPagination.pageSize,
    });
    rolePermissions.value = response.items;
    rolePermissionPagination.page = response.page;
    rolePermissionPagination.pageSize = response.pageSize;
    rolePermissionPagination.total = response.total;
  } finally {
    rolePermissionLoading.value = false;
  }
}

async function loadIdentityMappings(): Promise<void> {
  if (!identityFilters.wecomUserId.trim()) {
    identityMappings.value = [];
    identityMappingError.value = '请先选择企业微信账号，再执行身份映射诊断。';
    return;
  }

  try {
    const params = new URLSearchParams();
    params.set('wecomUserId', identityFilters.wecomUserId.trim());
    const response = await analysisService.listIdentityMappings(params);
    identityMappings.value = response.items;
    identityMappingError.value = '';
  } catch (error) {
    identityMappings.value = [];
    identityMappingError.value = toUserFacingErrorMessage(
      error,
      '身份映射诊断暂时没有加载成功，请稍后重试；如果多次失败，请联系管理员。',
    );
    throw error;
  }
}

async function retryDataScopeGrants(): Promise<void> {
  try {
    await loadDataScopeGrants();
  } catch (error) {
    ElMessage.error(
      toUserFacingErrorMessage(
        error,
        '白名单设置暂时没有加载成功，请稍后重试；如果多次失败，请联系管理员。',
      ),
    );
  }
}

async function retryDailyReportPreview(): Promise<void> {
  try {
    await loadDailyReportPreview();
  } catch (error) {
    ElMessage.error(
      toUserFacingErrorMessage(
        error,
        '日报发送预览暂时没有加载成功，请稍后重试；如果多次失败，请联系管理员。',
      ),
    );
  }
}

async function handleDailyReportTeamQuery(): Promise<void> {
  await retryDailyReportPreview();
}

async function retryIdentityMappings(): Promise<void> {
  try {
    await loadIdentityMappings();
  } catch (error) {
    ElMessage.error(
      toUserFacingErrorMessage(
        error,
        '身份映射诊断暂时没有加载成功，请稍后重试；如果多次失败，请联系管理员。',
      ),
    );
  }
}

function openRoleDrawer(item: RolePermissionItem): void {
  selectedRolePermission.value = item;
  roleDrawerVisible.value = true;
}

async function saveRolePermission(payload: Record<string, unknown>): Promise<void> {
  if (!selectedRolePermission.value || savingRolePermission.value) {
    return;
  }

  savingRolePermission.value = true;
  try {
    await analysisService.updateRolePermission(selectedRolePermission.value.roleId, payload);
    await authStore.loadCapabilities(true);
    ElMessage.success(`角色 ${selectedRolePermission.value.roleNameSnapshot} 权限已更新。`);
    roleDrawerVisible.value = false;
    await loadRolePermissions();
  } catch (error) {
    ElMessage.error(
      toUserFacingErrorMessage(
        error,
        '角色权限暂时没有保存成功，请检查填写内容后再试；如果仍有问题，请联系管理员。',
      ),
    );
  } finally {
    savingRolePermission.value = false;
  }
}

async function savePilotPolicy(): Promise<void> {
  if (savingPilotPolicy.value) {
    return;
  }

  savingPilotPolicy.value = true;
  try {
    const saved = await analysisService.updateWecomPilotPolicy({
      mode: pilotPolicy.mode,
      allowUserIds: [...pilotPolicy.allowUserIds],
      allowRoleIds: [...pilotPolicy.allowRoleIds],
      allowDepartmentIds: [...pilotPolicy.allowDepartmentIds],
      denyUserIds: [...pilotPolicy.denyUserIds],
      note: pilotPolicy.note,
    });
    Object.assign(pilotPolicy, saved);
    await authStore.loadCapabilities(true);
    ElMessage.success('企业微信灰度策略已更新。');
    deferredSectionHydrated.value = false;
    await loadPage();
  } catch (error) {
    ElMessage.error(
      toUserFacingErrorMessage(
        error,
        '企业微信灰度策略暂时没有保存成功，请稍后重试；如果仍有问题，请联系管理员。',
      ),
    );
  } finally {
    savingPilotPolicy.value = false;
  }
}

async function saveAnalysisScopePolicy(): Promise<void> {
  savingAnalysisScopePolicy.value = true;
  try {
    const saved = await analysisService.updateApplicationSuperAdminPolicy({
      subjects: [
        ...applicationSuperAdminPolicy.fullAccessUserIds.map((subjectId) => ({
          subjectType: 'USER',
          subjectId,
          status: 'ACTIVE',
        })),
        ...applicationSuperAdminPolicy.fullAccessRoleIds.map((subjectId) => ({
          subjectType: 'ROLE',
          subjectId,
          status: 'ACTIVE',
        })),
      ],
      changeReason: applicationSuperAdminPolicy.changeReason ?? '',
    });
    Object.assign(applicationSuperAdminPolicy, saved);
    await authStore.loadCapabilities(true);
    ElMessage.success('超级管理员授权已保存。');
  } catch (error) {
    ElMessage.error(
      toUserFacingErrorMessage(
        error,
        '超级管理员授权暂时没有保存成功，请稍后重试；如果仍有问题，请联系管理员。',
      ),
    );
  } finally {
    savingAnalysisScopePolicy.value = false;
  }
}

async function runAccessPreview(): Promise<void> {
  await ensureAccessOptionsReady();
  previewLoading.value = true;
  try {
    accessPreview.value = await analysisService.previewAccess({
      crmUserId: previewForm.crmUserId.trim() || undefined,
      wecomUserId: previewForm.wecomUserId.trim() || undefined,
    });
  } catch (error) {
    ElMessage.error(
      toUserFacingErrorMessage(
        error,
        '权限预览暂时没有生成成功，请稍后重试；如果多次失败，请联系管理员。',
      ),
    );
  } finally {
    previewLoading.value = false;
  }
}

function resolveMappingStateTone(
  value: IdentityMappingDiagnosticItem['mappingStatus'],
): 'success' | 'warning' | 'blocked' {
  if (value === 'MAPPED') {
    return 'success';
  }
  if (value === 'CONFLICTED') {
    return 'warning';
  }
  return 'blocked';
}

function resolveAccessStateTone(
  value: AccessPreviewView['wecomBotAccessState'],
): 'success' | 'warning' | 'blocked' {
  if (value === 'ALLOWED') {
    return 'success';
  }
  if (value === 'PILOT_REQUIRED' || value === 'CHANNEL_DISABLED') {
    return 'warning';
  }
  return 'blocked';
}

/**
 * 将权限状态徽标映射到 Element Plus 内置类型，保证颜色在所有浏览器下都能稳定生效。
 */
function resolvePermissionTagType(
  tone: string,
): 'success' | 'warning' | 'info' | 'primary' | 'danger' {
  switch (tone) {
    case 'online':
    case 'success':
      return 'success';
    case 'warning':
      return 'warning';
    case 'danger':
    case 'blocked':
      return 'danger';
    case 'info':
      return 'primary';
    case 'offline':
    case 'neutral':
    default:
      return 'info';
  }
}

function handleRoleSearch(): void {
  rolePermissionPagination.page = 1;
  void loadRolePermissions();
}

function handleRolePageChange(nextPage: number): void {
  rolePermissionPagination.page = nextPage;
  void loadRolePermissions();
}

/**
 * 调整角色权限表每页条数时回到第一页，避免旧页码沿用到新分页口径后出现空表。
 */
function handleRolePageSizeChange(nextPageSize: number): void {
  if (rolePermissionPagination.pageSize === nextPageSize) {
    return;
  }

  rolePermissionPagination.pageSize = nextPageSize;
  rolePermissionPagination.page = 1;
  void loadRolePermissions();
}

onMounted(() => {
  void loadPage();
});

onActivated(() => {
  if (!loading.value && overview.value) {
    markPageDataReady('/governance/access');
  }
});
</script>

<template>
  <div class="page governance-page permission-center-page">
    <div class="governance-layout governance-layout--single">
      <div class="governance-main-column">
        <el-tabs
          v-model="activeGovernanceTab"
          class="permission-center-tabs"
        >
          <el-tab-pane
            label="角色权限"
            name="role-permissions"
            data-test="role-permission-tab"
          >
            <section
              v-if="activeGovernanceTab === 'role-permissions'"
              class="panel"
              data-test="role-permission-panel"
            >
              <div class="panel__header">
                <div>
                  <h2 class="table-panel__title">
                    角色权限
                  </h2>
                </div>
              </div>
              <div class="panel__body panel__body--stack">
                <div class="permission-search-row">
                  <div class="permission-search-field">
                    <span class="permission-search-row__label">角色名</span>
                    <el-input
                      v-model="rolePermissionPagination.keyword"
                      class="input permission-search-row__input"
                      :disabled="rolePermissionLoading"
                      placeholder="请输入角色名称关键词"
                      @keyup.enter="handleRoleSearch"
                    />
                  </div>
                  <div class="permission-search-field permission-search-field--status">
                    <span class="permission-search-row__label">状态</span>
                    <el-select
                      v-model="rolePermissionPagination.status"
                      class="input permission-search-row__status"
                      :disabled="rolePermissionLoading"
                      clearable
                      placeholder="全部状态"
                      @change="handleRoleSearch"
                      @clear="handleRoleSearch"
                    >
                      <el-option
                        label="启用"
                        value="ACTIVE"
                      />
                      <el-option
                        label="停用"
                        value="INACTIVE"
                      />
                    </el-select>
                  </div>
                  <el-button
                    class="button-primary permission-search-row__button"
                    type="primary"
                    :loading="rolePermissionLoading"
                    :disabled="rolePermissionLoading"
                    @click="handleRoleSearch"
                  >
                    {{ rolePermissionLoading ? '加载中...' : '查询' }}
                  </el-button>
                </div>
                <div class="table-wrap">
                  <div
                    v-if="rolePermissionLoading"
                    class="loading-state permission-role-loading"
                  >
                    <strong>正在加载角色权限...</strong>
                    <p>系统正在同步 CRM 角色与应用层权限矩阵，请稍候。</p>
                    <span class="skeleton-line skeleton-line--long" />
                    <span class="skeleton-line skeleton-line--medium" />
                    <span class="skeleton-line skeleton-line--long" />
                  </div>
                  <el-table
                    :data="rolePermissions"
                    stripe
                    border
                    empty-text="暂无角色权限数据。"
                  >
                    <el-table-column
                      label="CRM 角色"
                      min-width="160"
                    >
                      <template #default="{ row }">
                        <ObjectIconLabel
                          type="owner"
                          tone="permission"
                          :label="row.roleNameSnapshot"
                          :description="row.roleId"
                        />
                      </template>
                    </el-table-column>
                    <el-table-column
                      label="菜单包"
                      min-width="260"
                    >
                      <template #default="{ row }">
                        <span class="permission-inline-list">{{ formatRolePermissionMenus(row) || '--' }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column
                      label="风险权限"
                      min-width="220"
                    >
                      <template #default="{ row }">
                        <span class="permission-inline-list">{{ formatRolePermissionRisks(row) || '--' }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column
                      label="状态"
                      min-width="90"
                    >
                      <template #default="{ row }">
                        <el-tag
                          :class="[
                            'badge',
                            'permission-state-badge',
                            toStatusToneClass(resolvePolicyStatusTone(row.status)),
                          ]"
                          :type="resolvePermissionTagType(resolvePolicyStatusTone(row.status))"
                          round
                        >
                          {{ formatPolicyStatusLabel(row.status) }}
                        </el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column
                      label="操作"
                      width="110"
                      fixed="right"
                      class-name="table-action-column"
                    >
                      <template #default="{ row }">
                        <div class="table-action-buttons">
                          <el-button
                            class="button-secondary"
                            @click="openRoleDrawer(row)"
                          >
                            编辑
                          </el-button>
                        </div>
                      </template>
                    </el-table-column>
                  </el-table>
                </div>
                <div class="permission-pagination-row">
                  <span class="permission-table-summary">
                    {{ rolePermissionLoading ? '角色权限加载中...' : `共 ${rolePermissionPagination.total} 条` }}
                  </span>
                  <el-pagination
                    background
                    layout="sizes, prev, pager, next"
                    :current-page="rolePermissionPagination.page"
                    :page-size="rolePermissionPagination.pageSize"
                    :page-sizes="ROLE_PERMISSION_PAGE_SIZE_OPTIONS"
                    :total="rolePermissionPagination.total"
                    :disabled="rolePermissionLoading"
                    @current-change="handleRolePageChange"
                    @size-change="handleRolePageSizeChange"
                  />
                </div>
              </div>
            </section>
          </el-tab-pane>
          <el-tab-pane
            label="企业微信准入"
            name="wecom-access"
            data-test="wecom-access-tab"
          >
            <section
              v-if="activeGovernanceTab === 'wecom-access'"
              class="panel"
              data-test="wecom-access-panel"
            >
              <div class="panel__header">
                <div>
                  <h2 class="table-panel__title">
                    企业微信灰度
                  </h2>
                </div>
                <el-tooltip
                  :content="helperTips.grayRule"
                  placement="top"
                >
                  <el-button
                    class="button-secondary permission-help-button"
                    text
                  >
                    <el-icon><component :is="UiIcons.info" /></el-icon>
                  </el-button>
                </el-tooltip>
                <el-button
                  class="button-primary"
                  type="primary"
                  :loading="savingPilotPolicy"
                  @click="savePilotPolicy"
                >
                  {{ savingPilotPolicy ? '保存中...' : '保存灰度策略' }}
                </el-button>
              </div>
              <div class="panel__body panel__body--stack">
                <div class="field-grid">
                  <label class="form-field">
                    <span>灰度模式</span>
                    <el-select
                      v-model="pilotPolicy.mode"
                      class="input"
                    >
                      <el-option
                        label="关闭"
                        value="DISABLED"
                      />
                      <el-option
                        label="白名单开放"
                        value="PILOT_ONLY"
                      />
                      <el-option
                        label="全量开放"
                        value="FULL"
                      />
                    </el-select>
                  </label>
                  <label class="form-field">
                    <span>备注</span>
                    <el-input
                      v-model="pilotPolicy.note"
                      class="input"
                      placeholder="说明当前灰度策略的目的"
                    />
                  </label>
                </div>
                <div class="field-grid">
                  <label class="form-field">
                    <span>白名单用户</span>
                    <WecomOrgSubjectPicker
                      v-model="pilotPolicy.allowUserIds"
                      :subjects="wecomOrgSubjects"
                      :loading="wecomOrgSubjectsLoading"
                      :error-message="wecomOrgSubjectsError"
                      :subject-types="['user']"
                      value-type="crmUserId"
                      multiple
                      placeholder="请选择白名单用户"
                      @retry="loadWecomOrgSubjects"
                    />
                  </label>
                  <label class="form-field">
                    <span>白名单角色</span>
                    <el-select
                      v-model="pilotPolicy.allowRoleIds"
                      class="input"
                      multiple
                      filterable
                      clearable
                      collapse-tags
                      collapse-tags-tooltip
                    >
                      <el-option
                        v-for="item in accessOptions.roles"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                      />
                    </el-select>
                  </label>
                  <label class="form-field">
                    <span>白名单部门</span>
                    <WecomOrgSubjectPicker
                      v-model="pilotPolicy.allowDepartmentIds"
                      :subjects="wecomOrgSubjects"
                      :loading="wecomOrgSubjectsLoading"
                      :error-message="wecomOrgSubjectsError"
                      :subject-types="['department']"
                      value-type="crmDepartmentId"
                      multiple
                      placeholder="请选择白名单部门"
                      @retry="loadWecomOrgSubjects"
                    />
                  </label>
                  <label class="form-field">
                    <span>停用用户</span>
                    <WecomOrgSubjectPicker
                      v-model="pilotPolicy.denyUserIds"
                      :subjects="wecomOrgSubjects"
                      :loading="wecomOrgSubjectsLoading"
                      :error-message="wecomOrgSubjectsError"
                      :subject-types="['user']"
                      value-type="crmUserId"
                      multiple
                      placeholder="请选择停用用户"
                      @retry="loadWecomOrgSubjects"
                    />
                  </label>
                </div>
                <div class="empty-state">
                  <strong>当前灰度状态：{{ formatWecomPilotModeLabel(pilotPolicy.mode) }}</strong>
                </div>
              </div>
            </section>
          </el-tab-pane>
          <el-tab-pane
            label="超级管理员授权"
            name="analysis-scope"
            data-test="analysis-scope-tab"
          >
            <section
              v-if="activeGovernanceTab === 'analysis-scope'"
              class="panel"
              data-test="analysis-scope-panel"
            >
              <div class="panel__header">
                <div>
                  <h2 class="table-panel__title">
                    超级管理员授权
                  </h2>
                  <p class="panel__subtitle">
                    命中人员或角色将开放全部功能、全部操作和全量数据范围，等同本系统超级管理员。
                  </p>
                </div>
                <el-button
                  class="button-primary"
                  type="primary"
                  :loading="savingAnalysisScopePolicy"
                  @click="saveAnalysisScopePolicy"
                >
                  {{ savingAnalysisScopePolicy ? '保存中...' : '保存超级管理员授权' }}
                </el-button>
              </div>
              <div class="panel__body panel__body--stack">
                <label class="form-field">
                  <span>已开通超级管理员授权的人员</span>
                  <WecomOrgSubjectPicker
                    v-model="applicationSuperAdminPolicy.fullAccessUserIds"
                    :subjects="wecomOrgSubjects"
                    :loading="wecomOrgSubjectsLoading"
                    :error-message="wecomOrgSubjectsError"
                    :fallback-options="accessOptions.users"
                    :subject-types="['user']"
                    value-type="crmUserId"
                    multiple
                    placeholder="请选择拥有系统全部功能和全量数据范围的人员"
                    @retry="loadWecomOrgSubjects"
                  />
                </label>
                <label class="form-field">
                  <span>已开通超级管理员授权的角色</span>
                  <el-select
                    v-model="applicationSuperAdminPolicy.fullAccessRoleIds"
                    class="input"
                    multiple
                    filterable
                    clearable
                    :reserve-keyword="false"
                    placeholder="请选择拥有系统全部功能和全量数据范围的角色"
                  >
                    <el-option
                      v-for="item in accessOptions.roles"
                      :key="item.value"
                      :label="item.label"
                      :value="item.value"
                    />
                  </el-select>
                </label>
                <label class="form-field">
                  <span>变更原因</span>
                  <el-input
                    v-model="applicationSuperAdminPolicy.changeReason"
                    class="textarea"
                    type="textarea"
                    :rows="2"
                    placeholder="请说明为什么开通或调整超级管理员授权"
                  />
                </label>
                <div class="empty-state">
                  <strong>
                    当前超级管理员授权：{{ applicationSuperAdminPolicy.fullAccessUserIds.length }} 人，{{ applicationSuperAdminPolicy.fullAccessRoleIds.length }} 个角色
                  </strong>
                  <span>该授权会开放全部菜单、全部操作、导出、审计、治理配置、合同跨看和全公司数据范围。</span>
                </div>
              </div>
            </section>
          </el-tab-pane>
          <el-tab-pane
            label="白名单设置"
            name="data-scope"
            data-test="data-scope-tab"
          >
            <section
              v-if="activeGovernanceTab === 'data-scope'"
              class="panel"
              data-test="data-scope-panel"
            >
              <div class="panel__header">
                <div>
                  <h2 class="table-panel__title">
                    白名单设置
                  </h2>
                </div>
                <el-button
                  class="button-primary"
                  type="primary"
                  @click="saveDataScopeGrant"
                >
                  保存白名单设置
                </el-button>
              </div>
              <div class="panel__body panel__body--stack">
                <div class="field-grid">
                  <label class="form-field">
                    <span>授权对象类型</span>
                    <el-select
                      v-model="dataScopeGrantDraft.subjectType"
                      class="input"
                    >
                      <el-option
                        label="用户"
                        value="USER"
                      />
                      <el-option
                        label="角色"
                        value="ROLE"
                      />
                    </el-select>
                  </label>
                  <label class="form-field">
                    <span>授权对象</span>
                    <WecomOrgSubjectPicker
                      v-if="dataScopeGrantDraft.subjectType === 'USER'"
                      v-model="dataScopeGrantDraft.subjectId"
                      :subjects="wecomOrgSubjects"
                      :loading="wecomOrgSubjectsLoading"
                      :error-message="wecomOrgSubjectsError"
                      :subject-types="['user']"
                      value-type="crmUserId"
                      :multiple="false"
                      placeholder="请选择用户"
                      @retry="loadWecomOrgSubjects"
                    />
                    <el-select
                      v-else
                      v-model="dataScopeGrantDraft.subjectId"
                      class="input"
                      filterable
                      clearable
                      placeholder="请选择角色"
                    >
                      <el-option
                        v-for="item in accessOptions.roles"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                      />
                    </el-select>
                  </label>
                  <label class="form-field">
                    <span>授权部门</span>
                    <WecomOrgSubjectPicker
                      v-model="dataScopeGrantDraft.departmentIds"
                      :subjects="wecomOrgSubjects"
                      :loading="wecomOrgSubjectsLoading"
                      :error-message="wecomOrgSubjectsError"
                      :subject-types="['department']"
                      value-type="crmDepartmentId"
                      multiple
                      placeholder="请选择允许查看的部门"
                      @retry="loadWecomOrgSubjects"
                    />
                  </label>
                  <label class="form-field">
                    <span>包含子部门</span>
                    <el-select
                      v-model="dataScopeGrantDraft.includeSubDepartments"
                      class="input"
                    >
                      <el-option
                        label="包含子部门"
                        :value="true"
                      />
                      <el-option
                        label="仅当前部门"
                        :value="false"
                      />
                    </el-select>
                  </label>
                  <label class="form-field">
                    <span>授权状态</span>
                    <el-select
                      v-model="dataScopeGrantDraft.status"
                      class="input"
                    >
                      <el-option
                        label="启用"
                        value="ACTIVE"
                      />
                      <el-option
                        label="停用"
                        value="INACTIVE"
                      />
                      <el-option
                        label="已过期"
                        value="EXPIRED"
                      />
                    </el-select>
                  </label>
                </div>
                <label class="form-field">
                  <span>授权原因</span>
                  <el-input
                    v-model="dataScopeGrantDraft.reason"
                    class="textarea"
                    type="textarea"
                    :rows="2"
                    placeholder="说明为什么允许该对象查看这些部门"
                  />
                </label>
                <div
                  v-if="dataScopeGrantError"
                  class="empty-state"
                >
                  <strong>{{ dataScopeGrantError }}</strong>
                  <el-button
                    class="button-secondary"
                    @click="retryDataScopeGrants"
                  >
                    重试加载白名单设置
                  </el-button>
                </div>
                <div
                  v-if="deferredSectionLoading && !deferredSectionHydrated"
                  class="empty-state"
                >
                  <strong>正在补充白名单设置</strong>
                  <span>首屏摘要已可用，白名单设置将在下一帧继续加载。</span>
                </div>
                <div class="table-wrap">
                  <el-table
                    :data="dataScopeGrants"
                    stripe
                    border
                    empty-text="暂无白名单设置。"
                  >
                    <el-table-column
                      label="授权对象"
                      min-width="160"
                    >
                      <template #default="{ row }">
                        {{ formatDataScopeSubject(row) }}
                      </template>
                    </el-table-column>
                    <el-table-column
                      label="授权部门"
                      min-width="180"
                    >
                      <template #default="{ row }">
                        {{ formatDataScopeDepartments(row) }}
                      </template>
                    </el-table-column>
                    <el-table-column
                      label="子部门"
                      min-width="100"
                    >
                      <template #default="{ row }">
                        {{ row.includeSubDepartments ? '包含子部门' : '仅当前部门' }}
                      </template>
                    </el-table-column>
                    <el-table-column
                      prop="reason"
                      label="授权原因"
                      min-width="240"
                    />
                    <el-table-column
                      label="状态"
                      min-width="90"
                    >
                      <template #default="{ row }">
                        {{ formatPolicyStatusLabel(row.status) }}
                      </template>
                    </el-table-column>
                  </el-table>
                </div>
              </div>
            </section>
          </el-tab-pane>
          <el-tab-pane
            label="身份与权限诊断"
            name="identity-access"
            data-test="identity-access-tab"
          />
          <el-tab-pane
            label="日报治理"
            name="daily-report"
            data-test="daily-report-governance-tab"
          >
            <section
              v-if="activeGovernanceTab === 'daily-report'"
              class="panel"
              data-test="daily-report-panel"
            >
              <div class="panel__header">
                <div>
                  <h2 class="table-panel__title">
                    日报团队
                  </h2>
                </div>
                <div class="permission-inline-actions">
                  <el-button
                    class="button-primary"
                    type="primary"
                    @click="openCreateDailyReportTeamDialog"
                  >
                    新增团队
                  </el-button>
                </div>
              </div>
              <div class="panel__body panel__body--stack">
                <div class="permission-toolbar">
                  <label class="form-field permission-toolbar__search">
                    <span>查询团队</span>
                    <el-input
                      v-model="dailyReportTeamKeyword"
                      class="input"
                      clearable
                      placeholder="输入团队名、组长或组员"
                      @keyup.enter="handleDailyReportTeamQuery"
                    />
                  </label>
                  <el-button
                    class="button-primary permission-toolbar__query"
                    type="primary"
                    :loading="loadingDailyReportPreview"
                    @click="handleDailyReportTeamQuery"
                  >
                    {{ loadingDailyReportPreview ? '查询中...' : '查询' }}
                  </el-button>
                </div>
                <div class="table-wrap">
                  <el-table
                    :data="filteredDailyReportTeams"
                    stripe
                    border
                    :empty-text="dailyReportTeamEmptyText"
                  >
                    <el-table-column
                      prop="groupDepartmentName"
                      label="团队名"
                      min-width="170"
                      fixed="left"
                    />
                    <el-table-column
                      label="组长"
                      min-width="140"
                    >
                      <template #default="{ row }">
                        {{ formatDailyReportRecipientNames(row) }}
                      </template>
                    </el-table-column>
                    <el-table-column
                      label="组员"
                      min-width="260"
                    >
                      <template #default="{ row }">
                        {{ formatDailyReportMemberNames(row) }}
                      </template>
                    </el-table-column>
                    <el-table-column
                      label="来源"
                      min-width="110"
                    >
                      <template #default="{ row }">
                        <el-tag
                          class="badge"
                          round
                        >
                          {{ formatDailyReportRuleSourceLabel(row.ruleSource) }}
                        </el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column
                      label="操作"
                      min-width="220"
                      fixed="right"
                      class-name="table-action-column"
                    >
                      <template #default="{ row }">
                        <div class="permission-inline-actions table-action-buttons">
                          <el-switch
                            class="daily-report-status-switch"
                            :model-value="row.effectivePolicy !== 'DISABLED'"
                            :disabled="isDailyReportGroupSaving(row.groupDepartmentId)"
                            active-text="启用"
                            inactive-text="禁用"
                            inline-prompt
                            @change="(value) => toggleDailyReportPreviewGroupStatus(row, Boolean(value))"
                          />
                          <el-button
                            class="button-secondary"
                            size="small"
                            :disabled="isDailyReportGroupSaving(row.groupDepartmentId)"
                            @click="editDailyReportSalesGroup(row)"
                          >
                            编辑
                          </el-button>
                          <el-button
                            class="button-secondary"
                            size="small"
                            :disabled="isDailyReportGroupSaving(row.groupDepartmentId)"
                            @click="deleteDailyReportSalesGroup(row)"
                          >
                            删除
                          </el-button>
                        </div>
                      </template>
                    </el-table-column>
                  </el-table>
                </div>
              </div>
            </section>

            <el-dialog
              v-model="dailyReportTeamEditorVisible"
              :title="dailyReportSalesGroupDraft.groupId ? '编辑团队' : '新增团队'"
              width="520px"
              destroy-on-close
              :close-on-click-modal="false"
              :close-on-press-escape="false"
              @close="closeDailyReportTeamDialog"
            >
              <div class="panel__body panel__body--stack daily-report-team-dialog">
                <label class="form-field">
                  <span>团队名</span>
                  <el-input
                    v-model="dailyReportSalesGroupDraft.groupName"
                    class="input"
                    placeholder="请输入团队名"
                  />
                </label>
                <label class="form-field">
                  <span>组长</span>
                  <WecomOrgSubjectPicker
                    v-model="dailyReportSalesGroupDraft.recipientCrmUserIds"
                    :subjects="wecomOrgSubjects"
                    :loading="wecomOrgSubjectsLoading"
                    :error-message="wecomOrgSubjectsError"
                    :fallback-options="dailyReportTeamUserOptions"
                    :subject-types="['user']"
                    value-type="crmUserId"
                    multiple
                    placeholder="请选择组长，可多选"
                    @retry="loadWecomOrgSubjects"
                  />
                </label>
                <label class="form-field">
                  <span>组员</span>
                  <WecomOrgSubjectPicker
                    v-model="dailyReportSalesGroupDraft.memberCrmUserIds"
                    :subjects="wecomOrgSubjects"
                    :loading="wecomOrgSubjectsLoading"
                    :error-message="wecomOrgSubjectsError"
                    :fallback-options="dailyReportTeamUserOptions"
                    :subject-types="['user']"
                    value-type="crmUserId"
                    multiple
                    placeholder="请选择组员"
                    @retry="loadWecomOrgSubjects"
                  />
                </label>
                <label class="form-field">
                  <span>状态</span>
                  <el-select
                    v-model="dailyReportSalesGroupDraft.status"
                    class="input"
                  >
                    <el-option
                      label="启用"
                      value="ENABLED"
                    />
                    <el-option
                      label="禁用"
                      value="DISABLED"
                    />
                  </el-select>
                </label>
              </div>
              <template #footer>
                <div class="permission-inline-actions permission-dialog-actions">
                  <el-button
                    class="button-secondary"
                    :disabled="savingDailyReportDepartment"
                    @click="closeDailyReportTeamDialog"
                  >
                    取消
                  </el-button>
                  <el-button
                    class="button-primary"
                    type="primary"
                    :loading="savingDailyReportDepartment"
                    @click="saveDailyReportSalesGroup"
                  >
                    保存
                  </el-button>
                </div>
              </template>
            </el-dialog>
          </el-tab-pane>
        </el-tabs>
        <section
          v-if="activeGovernanceTab === 'identity-access'"
          class="panel"
          data-test="identity-diagnostic-panel"
        >
          <div class="panel__header">
            <div>
              <h2 class="table-panel__title">
                身份映射诊断
              </h2>
            </div>
          </div>
          <div class="panel__body panel__body--stack">
            <div class="permission-toolbar">
              <label class="form-field permission-toolbar__search">
                <span>企业微信账号</span>
                <WecomOrgSubjectPicker
                  v-model="identityFilters.wecomUserId"
                  :subjects="wecomOrgSubjects"
                  :loading="wecomOrgSubjectsLoading"
                  :error-message="wecomOrgSubjectsError"
                  :subject-types="['user']"
                  value-type="wecomUserId"
                  :multiple="false"
                  placeholder="请选择企业微信账号"
                  @retry="loadWecomOrgSubjects"
                />
              </label>
              <el-button
                class="button-primary permission-toolbar__query"
                type="primary"
                @click="loadIdentityMappings"
              >
                查询
              </el-button>
            </div>
            <div
              v-if="identityMappingError"
              class="empty-state"
            >
              <strong>{{ identityMappingError }}</strong>
              <el-button
                class="button-secondary"
                @click="retryIdentityMappings"
              >
                重试加载身份映射
              </el-button>
            </div>
            <div class="table-wrap">
              <el-table
                :data="identityMappings"
                stripe
                border
                empty-text="暂无映射诊断结果。"
              >
                <el-table-column
                  prop="wecomUserId"
                  label="企微账号"
                  min-width="160"
                />
                <el-table-column
                  prop="crmUserName"
                  label="CRM 用户"
                  min-width="120"
                />
                <el-table-column
                  label="映射状态"
                  min-width="110"
                >
                  <template #default="{ row }">
                    <el-tag
                      :class="['badge', toStatusToneClass(resolveMappingStateTone(row.mappingStatus))]"
                      :type="row.mappingStatus === 'MAPPED' ? 'success' : 'warning'"
                      round
                    >
                      {{ formatIdentityMappingStatusLabel(row.mappingStatus) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column
                  label="角色"
                  min-width="180"
                >
                  <template #default="{ row }">
                    {{ row.crmRoleNames.join('、') || '--' }}
                  </template>
                </el-table-column>
                <el-table-column
                  label="企业微信入口状态"
                  min-width="140"
                >
                  <template #default="{ row }">
                    <el-tag
                      :class="['badge', toStatusToneClass(resolveAccessStateTone(row.wecomBotAccessState))]"
                      :type="row.wecomBotAccessState === 'ALLOWED' ? 'success' : 'warning'"
                      round
                    >
                      {{ formatWecomAccessStateLabel(row.wecomBotAccessState) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column
                  label="失败原因"
                  min-width="240"
                >
                  <template #default="{ row }">
                    {{ formatHelperText(row.failedReason) }}
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </section>

        <section
          v-if="activeGovernanceTab === 'identity-access'"
          class="panel"
          data-test="access-preview-panel"
        >
          <div class="panel__header">
            <div>
              <h3 class="table-panel__title">
                用户权限预览
              </h3>
            </div>
          </div>
          <div class="panel__body panel__body--stack">
            <label class="form-field">
              <span>CRM 用户</span>
              <WecomOrgSubjectPicker
                v-model="previewForm.crmUserId"
                :subjects="wecomOrgSubjects"
                :loading="wecomOrgSubjectsLoading"
                :error-message="wecomOrgSubjectsError"
                :subject-types="['user']"
                value-type="crmUserId"
                :multiple="false"
                placeholder="请选择 CRM 用户"
                @retry="loadWecomOrgSubjects"
              />
            </label>
            <label class="form-field">
              <span>企业微信账号</span>
              <WecomOrgSubjectPicker
                v-model="previewForm.wecomUserId"
                :subjects="wecomOrgSubjects"
                :loading="wecomOrgSubjectsLoading"
                :error-message="wecomOrgSubjectsError"
                :subject-types="['user']"
                value-type="wecomUserId"
                :multiple="false"
                placeholder="请选择企业微信账号"
                @retry="loadWecomOrgSubjects"
              />
            </label>
            <el-button
              class="button-primary"
              type="primary"
              :loading="previewLoading"
              @click="runAccessPreview"
            >
              {{ previewLoading ? '预览中...' : '查看最终权限' }}
            </el-button>

            <el-card
              v-if="accessPreview"
              class="permission-preview-card"
              shadow="never"
            >
              <el-descriptions
                :column="1"
                border
              >
                <el-descriptions-item label="CRM 用户">
                  {{ accessPreview.crmUserName || accessPreview.crmUserId || '--' }}
                </el-descriptions-item>
                <el-descriptions-item label="映射状态">
                  {{ formatIdentityMappingStatusLabel(accessPreview.mappingStatus) }}
                </el-descriptions-item>
                <el-descriptions-item label="角色">
                  {{ accessPreview.roleNames.join('、') || '--' }}
                </el-descriptions-item>
                <el-descriptions-item label="超级管理员">
                  {{ accessPreview.isApplicationSuperAdmin ? '已命中应用超级管理员授权' : '未命中应用超级管理员授权' }}
                </el-descriptions-item>
                <el-descriptions-item label="企业微信入口">
                  {{ formatWecomAccessStateLabel(accessPreview.wecomBotAccessState) }}
                </el-descriptions-item>
                <el-descriptions-item label="说明">
                  {{ formatHelperText(accessPreview.wecomBotAccessReason || accessPreview.scopeSummary) }}
                </el-descriptions-item>
                <el-descriptions-item label="菜单包">
                  {{ formatAccessPreviewMenus(accessPreview) || '--' }}
                </el-descriptions-item>
                <el-descriptions-item label="风险权限">
                  {{ formatAccessPreviewRisks(accessPreview) || '--' }}
                </el-descriptions-item>
              </el-descriptions>
            </el-card>
          </div>
        </section>
      </div>
    </div>

    <RolePermissionFormDrawer
      v-model:visible="roleDrawerVisible"
      :saving="savingRolePermission"
      :role-permission="selectedRolePermission"
      @submit="saveRolePermission"
    />
  </div>
</template>

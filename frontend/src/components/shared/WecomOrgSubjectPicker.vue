<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  ElButton,
  ElDialog,
  ElIcon,
  ElMessage,
  ElTag,
  ElTooltip,
} from 'element-plus';
import {
  ArrowDown,
  ArrowRight,
  Folder,
  OfficeBuilding,
  Refresh,
  Search,
  User,
} from '@element-plus/icons-vue';
import type {
  WecomOrgDepartmentSubjectItem,
  WecomOrgSubjectOptionsView,
  WecomOrgSubjectType,
  WecomOrgSubjectValueType,
  WecomOrgUserSubjectItem,
} from '@/types/analysis';

interface DepartmentTreeNode {
  department: WecomOrgDepartmentSubjectItem;
  children: DepartmentTreeNode[];
  depth: number;
}

interface VisibleDepartmentRow {
  department: WecomOrgDepartmentSubjectItem;
  depth: number;
  hasChildren: boolean;
}

const props = withDefaults(defineProps<{
  modelValue?: string | string[];
  subjects?: WecomOrgSubjectOptionsView | null;
  subjectTypes?: WecomOrgSubjectType[];
  valueType: WecomOrgSubjectValueType;
  multiple?: boolean;
  title?: string;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  errorMessage?: string;
  fallbackOptions?: Array<{
    value: string;
    label: string;
    disabled?: boolean;
  }>;
}>(), {
  modelValue: undefined,
  subjects: null,
  subjectTypes: () => ['user'],
  multiple: true,
  title: '',
  placeholder: '',
  disabled: false,
  loading: false,
  errorMessage: '',
  fallbackOptions: () => [],
});

const emit = defineEmits<{
  'update:modelValue': [value: string | string[]];
  change: [value: string | string[]];
  retry: [];
}>();

const dialogVisible = ref(false);
const editingDraft = ref(false);
const searchKeyword = ref('');
const draftValues = ref<string[]>([]);
const selectedDepartmentId = ref('');
const expandedDepartmentIds = ref<string[]>([]);

const departments = computed(() => props.subjects?.departments ?? []);
const users = computed(() => props.subjects?.users ?? []);
const canSelectUsers = computed(() => props.subjectTypes.includes('user'));
const canSelectDepartments = computed(() => props.subjectTypes.includes('department'));
const isUserValueType = computed(() => props.valueType === 'crmUserId' || props.valueType === 'wecomUserId');
// 绑定数组字段时必须按多选处理，避免调用层布尔属性透传异常导致批量选择入口被隐藏。
const isMultipleMode = computed(() => props.multiple || Array.isArray(props.modelValue));
const canBulkSelectUsers = computed(() => isMultipleMode.value && canSelectUsers.value && isUserValueType.value);
const isDepartmentValueType = computed(
  () => props.valueType === 'crmDepartmentId' || props.valueType === 'wecomDepartmentId',
);
const pickerTitle = computed(() => {
  if (props.title) {
    return props.title;
  }
  if (canSelectUsers.value && canSelectDepartments.value) {
    return '选择人员或部门';
  }
  return canSelectDepartments.value ? '选择部门' : '选择人员';
});
const openButtonText = computed(() => {
  const selectedCount = normalizedModelValues.value.length;
  if (selectedCount > 0) {
    return isMultipleMode.value ? `已选择 ${selectedCount} 项` : selectedLabels.value[0] ?? '已选择 1 项';
  }
  return props.placeholder || pickerTitle.value;
});
const normalizedModelValues = computed(() => {
  if (Array.isArray(props.modelValue)) {
    return props.modelValue.filter(Boolean);
  }
  return props.modelValue ? [props.modelValue] : [];
});
const normalizedKeyword = computed(() => searchKeyword.value.trim().toLowerCase());
const selectedLabels = computed(() => draftValues.value.map((value) => findLabelByValue(value)));
const selectedSummaryLabels = computed(() => normalizedModelValues.value.map((value) => findLabelByValue(value)));
const filteredUsers = computed(() => {
  if (!normalizedKeyword.value) {
    return users.value;
  }
  return users.value.filter((user) => matchesUserKeyword(user));
});
const departmentById = computed(() => new Map(departments.value.map((department) => [department.departmentId, department] as const)));
const departmentTree = computed(() => buildDepartmentTree(departments.value));
const visibleDepartmentRows = computed(() => flattenVisibleDepartmentRows(departmentTree.value));
const currentDepartment = computed(() => departmentById.value.get(selectedDepartmentId.value));
const currentDepartmentUsers = computed(() => {
  if (normalizedKeyword.value) {
    return filteredUsers.value;
  }
  if (!selectedDepartmentId.value) {
    return users.value;
  }
  return users.value.filter((user) => isDirectUserOfDepartment(user, selectedDepartmentId.value));
});
const currentUserListTitle = computed(() => {
  if (normalizedKeyword.value) {
    return '搜索到的人员';
  }
  if (currentDepartment.value) {
    return `${currentDepartment.value.name}人员`;
  }
  return '人员';
});

watch(
  () => props.modelValue,
  () => {
    if (!editingDraft.value) {
      draftValues.value = [...normalizedModelValues.value];
    }
  },
  { immediate: true },
);

watch(
  departments,
  () => {
    ensureSelectedDepartment();
  },
  { immediate: true },
);

/**
 * 打开选择器并复制当前值到草稿，取消时不会污染调用方表单。
 */
function openPicker(): void {
  if (props.disabled) {
    return;
  }
  // 外层表单标签可能在弹窗内点击后再次激活触发按钮，已打开时不能重置选择草稿。
  if (dialogVisible.value) {
    return;
  }
  draftValues.value = [...normalizedModelValues.value];
  searchKeyword.value = '';
  expandedDepartmentIds.value = rootDepartmentIds();
  ensureSelectedDepartment();
  editingDraft.value = true;
  dialogVisible.value = true;
}

/**
 * 确认选择并按单选或多选模式输出调用方需要的 ID 类型。
 */
function confirmSelection(): void {
  const nextValue = isMultipleMode.value ? [...draftValues.value] : draftValues.value[0] ?? '';
  emit('update:modelValue', nextValue);
  emit('change', nextValue);
  editingDraft.value = false;
  dialogVisible.value = false;
}

/**
 * 取消选择并结束草稿编辑，下一次打开时重新使用调用方已提交值。
 */
function cancelSelection(): void {
  editingDraft.value = false;
  dialogVisible.value = false;
  draftValues.value = [...normalizedModelValues.value];
}

/**
 * 处理遮罩、右上角关闭等非确认关闭，避免关闭后继续阻断外部值同步。
 */
function handleDialogClosed(): void {
  if (!editingDraft.value) {
    return;
  }
  editingDraft.value = false;
  draftValues.value = [...normalizedModelValues.value];
}

/**
 * 清空草稿已选对象，便于管理员重新圈定组织范围。
 */
function clearDraftValues(): void {
  draftValues.value = [];
}

/**
 * 在组织树中切换部门展开状态；搜索时始终展开匹配路径，不覆盖用户手动状态。
 */
function toggleDepartmentExpanded(department: WecomOrgDepartmentSubjectItem): void {
  if (normalizedKeyword.value) {
    return;
  }
  if (expandedDepartmentIds.value.includes(department.departmentId)) {
    expandedDepartmentIds.value = expandedDepartmentIds.value.filter((item) => item !== department.departmentId);
    return;
  }
  expandedDepartmentIds.value = [...expandedDepartmentIds.value, department.departmentId];
}

/**
 * 选中左侧组织树部门，用于让中间人员列表跟随部门切换。
 */
function selectDepartment(department: WecomOrgDepartmentSubjectItem): void {
  selectedDepartmentId.value = department.departmentId;
  expandDepartmentPath(department.departmentId);
}

/**
 * 从已提交值中移除单个对象，兼容日报团队等需要在表单内快速删人的场景。
 */
function removeCommittedValue(value: string): void {
  const nextValues = normalizedModelValues.value.filter((item) => item !== value);
  const nextValue = isMultipleMode.value ? nextValues : '';
  emit('update:modelValue', nextValue);
  emit('change', nextValue);
}

/**
 * 选择单个人员；CRM 用户 ID 模式会拒绝未映射或异常映射成员。
 */
function toggleUser(user: WecomOrgUserSubjectItem): void {
  const value = resolveUserValue(user);
  if (!value || isUserDisabled(user)) {
    return;
  }
  toggleValue(value);
  preserveCurrentDepartmentPath();
  searchKeyword.value = '';
}

/**
 * 选择部门本身；人员模式下该入口不承担部门下人员全选。
 */
function toggleDepartment(department: WecomOrgDepartmentSubjectItem): void {
  const value = resolveDepartmentValue(department);
  if (!value || isDepartmentDisabled(department)) {
    return;
  }
  selectedDepartmentId.value = department.departmentId;
  expandDepartmentPath(department.departmentId);
  toggleValue(value);
  searchKeyword.value = '';
}

/**
 * 人员模式下仅批量加入中间列表当前可见的可选成员，避免展示人员和实际入选人员不一致。
 */
function bulkSelectCurrentDepartmentUsers(department: WecomOrgDepartmentSubjectItem): void {
  if (!canBulkSelectUsers.value) {
    return;
  }
  selectedDepartmentId.value = department.departmentId;
  expandDepartmentPath(department.departmentId);
  const visibleUsers = currentDepartmentUsers.value;
  const candidates = visibleUsers.filter((user) => !isUserDisabled(user));
  const blockedCount = visibleUsers.length - candidates.length;
  const nextValues = candidates
    .map((user) => resolveUserValue(user))
    .filter((value): value is string => Boolean(value));

  if (!isMultipleMode.value) {
    draftValues.value = nextValues.at(-1) ? [nextValues.at(-1)!] : [];
  } else {
    draftValues.value = Array.from(new Set([...draftValues.value, ...nextValues]));
  }

  searchKeyword.value = '';
  if (blockedCount > 0) {
    ElMessage.warning(`已选择 ${nextValues.length} 个对象，${blockedCount} 个对象因不可保存未加入。`);
  } else {
    ElMessage.success(`已选择 ${nextValues.length} 个对象。`);
  }
}

/**
 * 根据单选或多选模式维护草稿值，单选始终只保留最后一次选择。
 */
function toggleValue(value: string): void {
  if (!isMultipleMode.value) {
    draftValues.value = [value];
    return;
  }
  if (draftValues.value.includes(value)) {
    draftValues.value = draftValues.value.filter((item) => item !== value);
    return;
  }
  draftValues.value = [...draftValues.value, value];
}

/**
 * 移除已选对象，保留其它已选项不变。
 */
function removeDraftValue(value: string): void {
  draftValues.value = draftValues.value.filter((item) => item !== value);
}

/**
 * 判断人员在当前输出 ID 类型下是否可选。
 */
function isUserDisabled(user: WecomOrgUserSubjectItem): boolean {
  if (user.syncStatus === 'DELETED') {
    return true;
  }
  if (props.valueType === 'crmUserId') {
    return user.mappingStatus !== 'MAPPED' || !user.crmUserId;
  }
  return false;
}

/**
 * 判断部门在当前输出 ID 类型下是否可选。
 */
function isDepartmentDisabled(department: WecomOrgDepartmentSubjectItem): boolean {
  if (department.syncStatus === 'DELETED') {
    return true;
  }
  if (props.valueType === 'crmDepartmentId') {
    return department.mappingStatus !== 'MAPPED' || !department.crmDepartmentId;
  }
  return false;
}

/**
 * 获取人员在当前场景应输出的 ID。
 */
function resolveUserValue(user: WecomOrgUserSubjectItem): string | undefined {
  if (props.valueType === 'crmUserId') {
    return user.crmUserId;
  }
  if (props.valueType === 'wecomUserId') {
    return user.wecomUserId;
  }
  return undefined;
}

/**
 * 获取部门在当前场景应输出的 ID。
 */
function resolveDepartmentValue(department: WecomOrgDepartmentSubjectItem): string | undefined {
  if (props.valueType === 'crmDepartmentId') {
    return department.crmDepartmentId;
  }
  if (props.valueType === 'wecomDepartmentId') {
    return department.departmentId;
  }
  return undefined;
}

/**
 * 生成稳定测试标识，CRM ID 场景下未映射对象回退到企业微信原始 ID。
 */
function resolveUserTestKey(user: WecomOrgUserSubjectItem): string {
  return resolveUserValue(user) ?? user.wecomUserId;
}

/**
 * 生成人员列表副标题；优先展示职位，避免 CRM 映射姓名与企业微信姓名一致时上下重复。
 */
function resolveUserSubtitle(user: WecomOrgUserSubjectItem): string {
  const normalizedName = user.name.trim();
  const subtitleCandidates = [
    user.position,
    user.crmUserName,
    user.wecomUserId,
  ]
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item));
  return subtitleCandidates.find((item) => item !== normalizedName) ?? user.wecomUserId;
}

/**
 * 生成稳定测试标识，CRM 部门 ID 场景下未映射部门回退到企业微信部门 ID。
 */
function resolveDepartmentTestKey(department: WecomOrgDepartmentSubjectItem): string {
  return resolveDepartmentValue(department) ?? department.departmentId;
}

/**
 * 查找已选值的中文标签，找不到时保留原值用于回显。
 */
function findLabelByValue(value: string): string {
  const fallbackOption = props.fallbackOptions.find((item) => item.value === value);
  if (fallbackOption) {
    return fallbackOption.label;
  }
  const matchedUser = users.value.find((user) => resolveUserValue(user) === value || user.wecomUserId === value);
  if (matchedUser) {
    return matchedUser.crmUserName
      ? `${matchedUser.name}（${matchedUser.crmUserName}）`
      : `${matchedUser.name}（${matchedUser.wecomUserId}）`;
  }
  const matchedDepartment = departments.value.find(
    (department) => resolveDepartmentValue(department) === value || department.departmentId === value,
  );
  if (matchedDepartment) {
    return matchedDepartment.crmDepartmentName
      ? `${matchedDepartment.name}（${matchedDepartment.crmDepartmentName}）`
      : matchedDepartment.name;
  }
  return value;
}

/**
 * 返回部门不可选原因，企业微信部门 ID 场景未映射部门仍允许选择。
 */
function resolveDepartmentDisabledReason(department: WecomOrgDepartmentSubjectItem): string {
  if (department.syncStatus === 'DELETED') {
    return department.disabledReason || '该部门已从企业微信通讯录删除。';
  }
  if (props.valueType === 'crmDepartmentId' && isDepartmentDisabled(department)) {
    return department.disabledReason || '未绑定 CRM 部门，不能保存为授权部门。';
  }
  return department.mappingStatus === 'MAPPED'
    ? '已完成 CRM 部门映射。'
    : department.disabledReason || '当前未完成 CRM 部门映射。';
}

/**
 * 判断部门是否命中当前搜索词。
 */
function matchesDepartmentKeyword(department: WecomOrgDepartmentSubjectItem): boolean {
  const searchableText = [
    department.name,
    department.departmentId,
    department.crmDepartmentId,
    department.crmDepartmentName,
    department.disabledReason,
  ].filter(Boolean).join(' ').toLowerCase();
  return searchableText.includes(normalizedKeyword.value);
}

/**
 * 判断人员是否命中当前搜索词。
 */
function matchesUserKeyword(user: WecomOrgUserSubjectItem): boolean {
  const searchableText = [
    user.name,
    user.wecomUserId,
    user.crmUserId,
    user.crmUserName,
    user.position,
    user.disabledReason,
  ].filter(Boolean).join(' ').toLowerCase();
  return searchableText.includes(normalizedKeyword.value);
}

/**
 * 构造企业微信部门树；根节点按企业微信排序号和名称排序，缺失父节点的部门作为根展示。
 */
function buildDepartmentTree(items: WecomOrgDepartmentSubjectItem[]): DepartmentTreeNode[] {
  const nodeMap = new Map<string, DepartmentTreeNode>();
  const roots: DepartmentTreeNode[] = [];
  const orderedItems = [...items].sort(compareDepartments);

  orderedItems.forEach((department) => {
    nodeMap.set(department.departmentId, {
      department,
      children: [],
      depth: 0,
    });
  });

  orderedItems.forEach((department) => {
    const node = nodeMap.get(department.departmentId);
    if (!node) {
      return;
    }
    const parentNode = department.parentDepartmentId
      ? nodeMap.get(department.parentDepartmentId)
      : undefined;
    if (!parentNode) {
      roots.push(node);
      return;
    }
    node.depth = parentNode.depth + 1;
    parentNode.children.push(node);
  });

  updateDepartmentNodeDepth(roots, 0);
  return roots;
}

/**
 * 递归刷新节点深度，避免父节点后处理导致子节点缩进不准确。
 */
function updateDepartmentNodeDepth(nodes: DepartmentTreeNode[], depth: number): void {
  nodes.forEach((node) => {
    node.depth = depth;
    updateDepartmentNodeDepth(node.children, depth + 1);
  });
}

/**
 * 生成当前可见的树行；搜索时保留匹配部门、匹配人员所在部门及其祖先路径。
 */
function flattenVisibleDepartmentRows(nodes: DepartmentTreeNode[]): VisibleDepartmentRow[] {
  return nodes.flatMap((node) => flattenVisibleDepartmentNode(node));
}

/**
 * 递归展开单个部门节点，并根据搜索词决定是否展示子节点。
 */
function flattenVisibleDepartmentNode(node: DepartmentTreeNode): VisibleDepartmentRow[] {
  if (normalizedKeyword.value && !shouldShowDepartmentNode(node)) {
    return [];
  }

  const rows: VisibleDepartmentRow[] = [{
    department: node.department,
    depth: node.depth,
    hasChildren: node.children.length > 0,
  }];
  const shouldExpand = normalizedKeyword.value
    ? true
    : expandedDepartmentIds.value.includes(node.department.departmentId);

  if (!shouldExpand) {
    return rows;
  }

  return [
    ...rows,
    ...node.children.flatMap((child) => flattenVisibleDepartmentNode(child)),
  ];
}

/**
 * 判断搜索模式下部门节点是否需要展示，包含部门自身、子部门或部门内人员命中三类情况。
 */
function shouldShowDepartmentNode(node: DepartmentTreeNode): boolean {
  return matchesDepartmentKeyword(node.department)
    || users.value.some((user) => isDirectUserOfDepartment(user, node.department.departmentId) && matchesUserKeyword(user))
    || node.children.some((child) => shouldShowDepartmentNode(child));
}

/**
 * 企业微信通讯录按排序号优先、名称兜底排序，保证树形结构稳定。
 */
function compareDepartments(
  left: WecomOrgDepartmentSubjectItem,
  right: WecomOrgDepartmentSubjectItem,
): number {
  const leftOrder = left.displayOrder ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right.displayOrder ?? Number.MAX_SAFE_INTEGER;
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }
  return left.name.localeCompare(right.name, 'zh-Hans-CN');
}

/**
 * 获取根部门 ID，用于打开弹窗时默认展开第一层组织。
 */
function rootDepartmentIds(): string[] {
  return departmentTree.value.map((node) => node.department.departmentId);
}

/**
 * 确保当前部门始终落在最新组织数据内，避免接口刷新后中间人员列表失焦。
 */
function ensureSelectedDepartment(): void {
  if (departmentById.value.has(selectedDepartmentId.value)) {
    preserveCurrentDepartmentPath();
    return;
  }
  const firstDepartmentWithDirectUser = departments.value.find((department) =>
    users.value.some((user) => isDirectUserOfDepartment(user, department.departmentId)),
  );
  selectedDepartmentId.value =
    firstDepartmentWithDirectUser?.departmentId
    ?? departmentTree.value[0]?.department.departmentId
    ?? departments.value[0]?.departmentId
    ?? '';
  preserveCurrentDepartmentPath();
}

/**
 * 判断成员是否直属当前部门；没有主部门时回退到部门列表，兼容历史同步数据。
 */
function isDirectUserOfDepartment(user: WecomOrgUserSubjectItem, departmentId: string): boolean {
  if (user.primaryDepartmentId) {
    return user.primaryDepartmentId === departmentId;
  }
  return user.departmentIds.includes(departmentId);
}

/**
 * 选择或清空搜索时保留当前部门所在路径，避免用户点选后组织树整体收起。
 */
function preserveCurrentDepartmentPath(): void {
  if (!selectedDepartmentId.value) {
    return;
  }
  expandDepartmentPath(selectedDepartmentId.value);
}

/**
 * 展开目标部门的所有祖先节点和自身，保证深层部门点击后仍留在可见路径内。
 */
function expandDepartmentPath(departmentId: string): void {
  const pathIds: string[] = [];
  let currentDepartmentId = departmentId;
  const visitedIds = new Set<string>();

  while (currentDepartmentId && !visitedIds.has(currentDepartmentId)) {
    visitedIds.add(currentDepartmentId);
    pathIds.push(currentDepartmentId);
    currentDepartmentId = departmentById.value.get(currentDepartmentId)?.parentDepartmentId ?? '';
  }

  expandedDepartmentIds.value = Array.from(new Set([...expandedDepartmentIds.value, ...pathIds]));
}

</script>

<template>
  <div class="wecom-org-subject-picker">
    <el-button
      class="wecom-org-subject-picker__trigger"
      :disabled="disabled"
      data-test="wecom-org-picker-open"
      @click="openPicker"
    >
      <el-icon>
        <component :is="canSelectDepartments && !canSelectUsers ? OfficeBuilding : User" />
      </el-icon>
      <span>{{ openButtonText }}</span>
    </el-button>
    <div
      v-if="selectedSummaryLabels.length > 0"
      class="wecom-org-subject-picker__summary"
    >
      <el-tag
        v-for="value in normalizedModelValues.slice(0, 6)"
        :key="value"
        closable
        round
        @close="removeCommittedValue(value)"
      >
        {{ findLabelByValue(value) }}
      </el-tag>
      <span v-if="selectedSummaryLabels.length > 6">等 {{ selectedSummaryLabels.length }} 项</span>
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="pickerTitle"
      width="860px"
      :teleported="true"
      destroy-on-close
      @closed="handleDialogClosed"
    >
      <div class="wecom-org-subject-picker__dialog">
        <div class="wecom-org-subject-picker__search">
          <el-icon><Search /></el-icon>
          <input
            v-model="searchKeyword"
            class="wecom-org-subject-picker__search-input"
            data-test="wecom-org-picker-search"
            placeholder="搜索姓名、账号、部门或映射说明"
          >
        </div>

        <div
          v-if="loading"
          class="wecom-org-subject-picker__state"
        >
          正在加载企业微信组织架构...
        </div>
        <div
          v-else-if="errorMessage"
          class="wecom-org-subject-picker__state"
        >
          <strong>{{ errorMessage }}</strong>
          <el-button
            class="button-secondary"
            @click="emit('retry')"
          >
            <el-icon><Refresh /></el-icon>
            重试
          </el-button>
        </div>
        <div
          v-else-if="departments.length === 0 && users.length === 0"
          class="wecom-org-subject-picker__state"
        >
          暂无可用组织架构对象。
        </div>
        <div
          v-else
          class="wecom-org-subject-picker__content"
        >
          <section class="wecom-org-subject-picker__panel wecom-org-subject-picker__tree">
            <div class="wecom-org-subject-picker__section-title">
              企业微信组织架构
            </div>
            <div class="wecom-org-subject-picker__section-body">
              <div
                v-for="row in visibleDepartmentRows"
                :key="row.department.departmentId"
                class="wecom-org-subject-picker__department"
                :class="{ 'is-active': selectedDepartmentId === row.department.departmentId }"
                :style="{ paddingLeft: `${8 + row.depth * 18}px` }"
                :data-test="`subject-department-row-${row.department.departmentId}`"
                :title="row.department.disabledReason || row.department.name"
                @click="selectDepartment(row.department)"
              >
                <div class="wecom-org-subject-picker__department-main">
                  <button
                    class="wecom-org-subject-picker__tree-toggle"
                    :class="{ 'is-hidden': !row.hasChildren }"
                    :aria-label="expandedDepartmentIds.includes(row.department.departmentId) ? '收起部门' : '展开部门'"
                    type="button"
                    @click.stop="toggleDepartmentExpanded(row.department)"
                  >
                    <el-icon>
                      <ArrowDown v-if="normalizedKeyword || expandedDepartmentIds.includes(row.department.departmentId)" />
                      <ArrowRight v-else />
                    </el-icon>
                  </button>
                  <el-icon class="wecom-org-subject-picker__folder">
                    <Folder />
                  </el-icon>
                  <div class="wecom-org-subject-picker__subject-text">
                    <strong>{{ row.department.name }}</strong>
                  </div>
                </div>
              </div>
              <div
                v-if="visibleDepartmentRows.length === 0"
                class="wecom-org-subject-picker__state"
              >
                没有匹配的组织部门。
              </div>
            </div>
          </section>

          <section class="wecom-org-subject-picker__panel wecom-org-subject-picker__list">
            <div class="wecom-org-subject-picker__section-title">
              <span>{{ canSelectUsers ? currentUserListTitle : '部门选择' }}</span>
              <el-tooltip
                v-if="canBulkSelectUsers && currentDepartment && !normalizedKeyword"
                content="选择当前中间列表里所有可保存人员"
                placement="top"
              >
                <el-button
                  size="small"
                  class="wecom-org-subject-picker__section-action"
                  :data-test="`subject-department-bulk-${currentDepartment.departmentId}`"
                  @click.stop="bulkSelectCurrentDepartmentUsers(currentDepartment)"
                >
                  全选
                </el-button>
              </el-tooltip>
              <el-tooltip
                v-else-if="canSelectDepartments && isDepartmentValueType && currentDepartment"
                :content="resolveDepartmentDisabledReason(currentDepartment)"
                placement="top"
              >
                <el-button
                  size="small"
                  class="wecom-org-subject-picker__section-action"
                  :type="draftValues.includes(resolveDepartmentValue(currentDepartment) || '') ? 'primary' : 'default'"
                  :disabled="isDepartmentDisabled(currentDepartment)"
                  :data-test="`subject-department-${resolveDepartmentTestKey(currentDepartment)}`"
                  @click.stop="toggleDepartment(currentDepartment)"
                >
                  选择当前部门
                </el-button>
              </el-tooltip>
            </div>
            <div class="wecom-org-subject-picker__section-body">
              <template v-if="canSelectUsers && isUserValueType">
                <button
                  v-for="user in currentDepartmentUsers"
                  :key="user.wecomUserId"
                  class="wecom-org-subject-picker__subject-row"
                  :class="{ 'is-selected': draftValues.includes(resolveUserValue(user) || '') }"
                  :disabled="isUserDisabled(user)"
                  :aria-label="isUserDisabled(user) ? `${user.name}不可选` : user.name"
                  :data-test="`subject-user-${resolveUserTestKey(user)}`"
                  type="button"
                  @click.stop="toggleUser(user)"
                >
                  <el-icon>
                    <User />
                  </el-icon>
                  <span class="wecom-org-subject-picker__subject-text">
                    <strong>{{ user.name }}</strong>
                    <span>{{ resolveUserSubtitle(user) }}</span>
                  </span>
                </button>
              </template>
              <div
                v-else
                class="wecom-org-subject-picker__state"
              >
                请在左侧组织树中选择部门。
              </div>
              <div
                v-if="canSelectUsers && currentDepartmentUsers.length === 0"
                class="wecom-org-subject-picker__state"
              >
                没有匹配的人员。
              </div>
            </div>
          </section>

          <aside class="wecom-org-subject-picker__panel wecom-org-subject-picker__selected">
            <div class="wecom-org-subject-picker__section-title">
              已选对象
              <el-button
                text
                size="small"
                :disabled="draftValues.length === 0"
                @click="clearDraftValues"
              >
                清空
              </el-button>
            </div>
            <div class="wecom-org-subject-picker__section-body">
              <div
                v-if="draftValues.length === 0"
                class="wecom-org-subject-picker__state"
              >
                暂未选择对象。
              </div>
              <el-tag
                v-for="value in draftValues"
                :key="value"
                class="wecom-org-subject-picker__selected-tag"
                closable
                round
                @close="removeDraftValue(value)"
              >
                {{ findLabelByValue(value) }}
              </el-tag>
            </div>
          </aside>
        </div>
      </div>
      <template #footer>
        <div class="wecom-org-subject-picker__footer">
          <el-button @click="cancelSelection">
            取消
          </el-button>
          <el-button
            type="primary"
            data-test="wecom-org-picker-confirm"
            @click.stop="confirmSelection"
          >
            确认选择
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.wecom-org-subject-picker {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.wecom-org-subject-picker__trigger {
  justify-content: flex-start;
  min-height: 38px;
  width: 100%;
}

.wecom-org-subject-picker__trigger span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wecom-org-subject-picker__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.wecom-org-subject-picker__dialog {
  display: grid;
  gap: 14px;
}

.wecom-org-subject-picker__search {
  align-items: center;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  display: flex;
  gap: 8px;
  padding: 8px 10px;
}

.wecom-org-subject-picker__search-input {
  border: 0;
  color: var(--el-text-color-primary);
  flex: 1;
  font: inherit;
  min-width: 0;
  outline: 0;
}

.wecom-org-subject-picker__content {
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(220px, 1fr) minmax(220px, 1fr) minmax(180px, 0.8fr);
  height: clamp(360px, 48vh, 420px);
  min-height: 0;
}

.wecom-org-subject-picker__panel {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  display: grid;
  gap: 4px;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  padding: 10px;
}

.wecom-org-subject-picker__section-title {
  align-items: center;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  display: flex;
  font-size: 14px;
  font-weight: 700;
  justify-content: space-between;
  min-height: 30px;
  padding-bottom: 6px;
}

.wecom-org-subject-picker__section-body {
  align-content: start;
  display: grid;
  gap: 4px;
  min-height: 0;
  min-width: 0;
  overflow: auto;
}

.wecom-org-subject-picker__selected .wecom-org-subject-picker__section-body {
  gap: 6px;
}

.wecom-org-subject-picker__department {
  align-items: center;
  border-radius: 6px;
  cursor: pointer;
  display: grid;
  gap: 6px;
  grid-template-columns: max-content;
  min-width: 100%;
  min-height: 34px;
  padding: 4px 8px;
  width: max-content;
}

.wecom-org-subject-picker__department:hover,
.wecom-org-subject-picker__department.is-active {
  background: var(--el-color-primary-light-9);
}

.wecom-org-subject-picker__subject-row {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  min-width: 0;
  padding: 8px;
}

.wecom-org-subject-picker__department-main {
  align-items: center;
  display: grid;
  gap: 6px;
  grid-template-columns: 16px 18px max-content;
  min-width: max-content;
}

.wecom-org-subject-picker__subject-row {
  align-items: center;
  display: flex;
  gap: 8px;
  min-width: 0;
}

.wecom-org-subject-picker__subject-row {
  background: var(--el-fill-color-blank);
  cursor: pointer;
  text-align: left;
  width: 100%;
}

.wecom-org-subject-picker__subject-row:hover,
.wecom-org-subject-picker__subject-row.is-selected {
  border-color: var(--el-color-primary);
}

.wecom-org-subject-picker__subject-row:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.wecom-org-subject-picker__tree-toggle {
  align-items: center;
  background: transparent;
  border: 0;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  display: inline-flex;
  height: 16px;
  justify-content: center;
  padding: 0;
  width: 16px;
}

.wecom-org-subject-picker__tree-toggle.is-hidden {
  cursor: default;
  opacity: 0;
  pointer-events: none;
}

.wecom-org-subject-picker__folder {
  color: var(--el-color-primary);
}

.wecom-org-subject-picker__subject-text {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.wecom-org-subject-picker__subject-text strong,
.wecom-org-subject-picker__subject-text span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wecom-org-subject-picker__subject-text span,
.wecom-org-subject-picker__hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.wecom-org-subject-picker__department .wecom-org-subject-picker__subject-text {
  min-width: max-content;
}

.wecom-org-subject-picker__department .wecom-org-subject-picker__subject-text strong {
  overflow: visible;
  text-overflow: clip;
}

.wecom-org-subject-picker__section-action {
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 600;
  height: 26px;
  min-height: 26px;
  padding: 0 10px;
  --el-button-bg-color: var(--el-color-primary-light-9);
  --el-button-border-color: var(--el-color-primary-light-5);
  --el-button-hover-bg-color: var(--el-color-primary-light-8);
  --el-button-hover-border-color: var(--el-color-primary-light-4);
}

.wecom-org-subject-picker__hint {
  margin: 6px 0 0;
}

.wecom-org-subject-picker__state {
  align-items: center;
  color: var(--el-text-color-secondary);
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  min-height: 72px;
  text-align: center;
}

.wecom-org-subject-picker__selected-tag {
  justify-content: space-between;
  max-width: 100%;
}

.wecom-org-subject-picker__footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

@media (max-width: 860px) {
  .wecom-org-subject-picker__content {
    grid-template-columns: 1fr;
  }
}
</style>

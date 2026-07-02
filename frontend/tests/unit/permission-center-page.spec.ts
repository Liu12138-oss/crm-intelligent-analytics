import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import PermissionCenterPage from '@/pages/governance/PermissionCenterPage.vue';
import RolePermissionFormDrawer from '@/components/governance/RolePermissionFormDrawer.vue';
import WecomOrgSubjectPicker from '@/components/shared/WecomOrgSubjectPicker.vue';
import { analysisService } from '@/services/analysis.service';
import type {
  DailyReportDeliveryPreviewGroupView,
  RolePermissionItem,
} from '@/types/analysis';

const mockLoadCapabilities = vi.fn();

vi.mock('@/services/analysis.service', () => ({
  analysisService: {
    getAccessGovernanceOverview: vi.fn(),
    getAnalysisScopePolicy: vi.fn(),
    updateAnalysisScopePolicy: vi.fn(),
    getApplicationSuperAdminPolicy: vi.fn(),
    updateApplicationSuperAdminPolicy: vi.fn(),
    listRolePermissions: vi.fn(),
    getWecomPilotPolicy: vi.fn(),
    listIdentityMappings: vi.fn(),
    listAccessOptions: vi.fn(),
    listWecomOrgSubjects: vi.fn(),
    updateRolePermission: vi.fn(),
    updateWecomPilotPolicy: vi.fn(),
    previewAccess: vi.fn(),
    listDataScopeGrants: vi.fn(),
    updateDataScopeGrant: vi.fn(),
    previewDataScope: vi.fn(),
    listDailyReportDeliveryDepartments: vi.fn(),
    updateDailyReportDeliveryDepartment: vi.fn(),
    deleteDailyReportDeliveryDepartment: vi.fn(),
    previewDailyReportDelivery: vi.fn(),
    createDailyReportSalesGroup: vi.fn(),
    updateDailyReportSalesGroup: vi.fn(),
    deleteDailyReportSalesGroup: vi.fn(),
  },
}));

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({
    loadCapabilities: mockLoadCapabilities,
  }),
}));

vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('element-plus')>();
  return {
    ...actual,
    ElMessage: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
    },
    ElMessageBox: {
      confirm: vi.fn(),
    },
  };
});

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await nextTick();
  await Promise.resolve();
  await nextTick();
}

async function flushDeferredLoad(): Promise<void> {
  await flushPromises();
  vi.runOnlyPendingTimers();
  await flushPromises();
}

async function activateDailyReportTab(
  wrapper: ReturnType<typeof mount<typeof PermissionCenterPage>>,
): Promise<void> {
  const pageVm = wrapper.vm as unknown as {
    activeGovernanceTab: string;
  };
  pageVm.activeGovernanceTab = 'daily-report';
  await flushPromises();
}

async function activateGovernanceTab(
  wrapper: ReturnType<typeof mount<typeof PermissionCenterPage>>,
  tabName: string,
): Promise<void> {
  const pageVm = wrapper.vm as unknown as {
    activeGovernanceTab: string;
  };
  pageVm.activeGovernanceTab = tabName;
  await flushPromises();
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe('permission center page', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockLoadCapabilities.mockReset();
    mockLoadCapabilities.mockResolvedValue(null);
    vi.mocked(analysisService.getAccessGovernanceOverview).mockResolvedValue({
      analysisEnabledRoleCount: 4,
      wecomPilotMode: 'FULL',
      wecomPilotWhitelistUserCount: 0,
      exportEnabledRoleCount: 3,
      identityMappingIssueCount: 0,
    });
    vi.mocked(analysisService.getApplicationSuperAdminPolicy).mockResolvedValue({
      policyId: 'application_super_admin_policy_current',
      subjects: [
        { subjectType: 'USER', subjectId: 'user_admin', status: 'ACTIVE' },
      ],
      fullAccessUserIds: ['user_admin'],
      fullAccessRoleIds: [],
      updatedBy: 'user_admin',
      updatedAt: '2026-05-12T12:00:00.000Z',
      changeReason: '默认向系统管理员开放超级管理员授权。',
    });
    vi.mocked(analysisService.updateApplicationSuperAdminPolicy).mockResolvedValue({
      policyId: 'application_super_admin_policy_current',
      subjects: [
        { subjectType: 'USER', subjectId: 'user_admin', status: 'ACTIVE' },
        { subjectType: 'USER', subjectId: 'user_product_li_si', status: 'ACTIVE' },
        { subjectType: 'ROLE', subjectId: 'role_product_manager', status: 'ACTIVE' },
      ],
      fullAccessUserIds: ['user_admin', 'user_product_li_si'],
      fullAccessRoleIds: ['role_product_manager'],
      updatedBy: 'user_admin',
      updatedAt: '2026-05-12T12:30:00.000Z',
      changeReason: '新增经营管理超级管理员',
    });
    vi.mocked(analysisService.listRolePermissions).mockResolvedValue({
      page: 1,
      pageSize: 10,
      total: 2,
      items: [
        {
          roleId: 'role_product_manager',
          roleNameSnapshot: '产品经理',
          status: 'INACTIVE',
          visibleMenus: ['analysis-workbench', 'contract-review'],
          actionKeys: ['analysis.use', 'contract.review.upload'],
          webConsoleEnabled: true,
          wecomBotEligible: false,
          exportAllowed: false,
          templateManageAllowed: false,
          contractReviewUploadAllowed: true,
          contractReviewCrossViewAllowed: false,
          contractReviewCrossDownloadAllowed: false,
          updatedBy: 'user_admin',
          updatedAt: '2026-04-22T10:00:00.000Z',
        },
        {
          roleId: 'role_product_director',
          roleNameSnapshot: '产品总监',
          status: 'ACTIVE',
          visibleMenus: ['analysis-workbench'],
          actionKeys: ['analysis.use'],
          webConsoleEnabled: true,
          wecomBotEligible: true,
          exportAllowed: true,
          templateManageAllowed: false,
          contractReviewUploadAllowed: false,
          contractReviewCrossViewAllowed: true,
          contractReviewCrossDownloadAllowed: false,
          updatedBy: 'user_admin',
          updatedAt: '2026-04-22T10:00:00.000Z',
        },
      ],
    });
    vi.mocked(analysisService.getWecomPilotPolicy).mockResolvedValue({
      channel: 'wecom-bot',
      mode: 'FULL',
      allowUserIds: [],
      allowRoleIds: [],
      allowDepartmentIds: [],
      denyUserIds: [],
      updatedBy: 'user_admin',
      updatedAt: '2026-04-22T10:00:00.000Z',
    });
    vi.mocked(analysisService.listIdentityMappings).mockResolvedValue({
      items: [],
    });
    vi.mocked(analysisService.listAccessOptions).mockResolvedValue({
      users: [
        { value: 'user_product_li_si', label: '李四（产品经理）' },
        { value: 'user_admin', label: '系统管理员（系统管理员）' },
      ],
      roles: [
        { value: 'role_product_manager', label: '产品经理' },
      ],
      departments: [
        { value: 'dept_product', label: '产品部' },
      ],
      wecomUsers: [
        { value: 'wx_product_li_si', label: '李四（wx_product_li_si）' },
      ],
    });
    vi.mocked(analysisService.previewAccess).mockResolvedValue({
      crmUserId: 'user_product_li_si',
      crmUserName: '李四',
      wecomUserId: 'wx_product_li_si',
      mappingStatus: 'MAPPED',
      roleNames: ['产品经理'],
      visibleMenus: ['analysis-workbench', 'contract-review'],
      actionKeys: ['analysis.use', 'contract.review.upload'],
      scopeSummary: '当前状态：PILOT_REQUIRED，菜单：analysis-workbench',
      wecomBotAccessState: 'PILOT_REQUIRED',
      wecomBotAccessReason: '当前状态：PILOT_REQUIRED，菜单：analysis-workbench',
      contractPermissions: {
        uploadAllowed: true,
        crossViewAllowed: false,
        crossDownloadAllowed: false,
      },
    });
    vi.mocked(analysisService.listDataScopeGrants).mockResolvedValue({
      items: [
        {
          id: 'grant_region_manager',
          subjectType: 'ROLE',
          subjectId: 'role_region_manager',
          departmentIds: ['dept_product'],
          includeSubDepartments: true,
          reason: '允许区域经理临时查看产品部协作数据',
          status: 'ACTIVE',
          updatedBy: 'user_admin',
          updatedAt: '2026-04-23T10:00:00.000Z',
        },
      ],
    });
    vi.mocked(analysisService.updateDataScopeGrant).mockResolvedValue({
      id: 'grant_region_manager',
      subjectType: 'ROLE',
      subjectId: 'role_region_manager',
      departmentIds: ['dept_product'],
      includeSubDepartments: true,
      reason: '允许区域经理临时查看产品部协作数据',
      status: 'ACTIVE',
      updatedBy: 'user_admin',
      updatedAt: '2026-04-23T10:00:00.000Z',
    });
    vi.mocked(analysisService.previewDataScope).mockResolvedValue({
      crmUserId: 'user_region_manager',
      crmUserName: '区域经理',
      mappingStatus: 'MAPPED',
      organizationIds: ['org_north'],
      departmentIds: ['dept_product'],
      ownerIds: ['owner_zhang'],
      grantSummaries: ['角色 role_region_manager 授权部门：dept_product（含子部门）'],
      scopeSummary: '当前仅展示区域经理本人范围。已叠加白名单设置。',
    });
    vi.mocked(analysisService.listDailyReportDeliveryDepartments).mockResolvedValue({
      items: [
        {
          departmentId: '__GLOBAL_ALL__',
          departmentName: '全公司',
          status: 'DISABLED',
          departmentType: 'UNCLASSIFIED',
          applyToChildren: true,
          updatedBy: 'user_admin',
          updatedAt: '2026-04-28T10:00:00.000Z',
          reason: '全公司默认禁用日报',
        },
        {
          departmentId: 'dept_sd_sales',
          departmentName: '山东销售',
          parentDepartmentId: 'dept_sd_region',
          status: 'ENABLED',
          departmentType: 'SALES',
          applyToChildren: false,
          updatedBy: 'user_admin',
          updatedAt: '2026-04-28T10:00:00.000Z',
          reason: '销售类默认启用',
          resolvedRecipientName: '牛劲',
          resolvedRecipientCrmUserId: '2224755',
          resolvedRecipientWecomUserId: 'NiuJin',
          resolvedRecipientSource: 'REGION_OVERRIDE',
        },
        {
          departmentId: 'dept_sd_tech',
          departmentName: '山东技术团队',
          parentDepartmentId: 'dept_sd_region',
          status: 'DISABLED',
          departmentType: 'NON_SALES',
          applyToChildren: false,
          updatedBy: 'user_admin',
          updatedAt: '2026-04-28T10:00:00.000Z',
          reason: '技术团队默认停用',
        },
      ],
      strategies: [
        {
          departmentId: '__GLOBAL_ALL__',
          departmentName: '全公司',
          status: 'DISABLED',
          departmentType: 'UNCLASSIFIED',
          applyToChildren: true,
          updatedBy: 'user_admin',
          updatedAt: '2026-04-28T10:00:00.000Z',
          reason: '全公司默认禁用日报',
        },
        {
          departmentId: 'dept_sd_sales',
          departmentName: '山东销售',
          parentDepartmentId: '__GLOBAL_ALL__',
          status: 'ENABLED',
          departmentType: 'SALES',
          applyToChildren: false,
          updatedBy: 'user_admin',
          updatedAt: '2026-04-28T10:00:00.000Z',
          reason: '销售类默认启用',
          resolvedRecipientName: '牛劲',
          resolvedRecipientCrmUserId: '2224755',
          resolvedRecipientWecomUserId: 'NiuJin',
          resolvedRecipientSource: 'REGION_OVERRIDE',
        },
      ],
    });
    vi.mocked(analysisService.updateDailyReportDeliveryDepartment).mockResolvedValue({
      departmentId: 'dept_sd_sales',
      departmentName: '山东销售',
      parentDepartmentId: 'dept_sd_region',
      status: 'ENABLED',
      departmentType: 'SALES',
      applyToChildren: false,
      updatedBy: 'user_admin',
      updatedAt: '2026-04-28T10:00:00.000Z',
      reason: '销售类默认启用',
      resolvedRecipientName: '牛劲',
      resolvedRecipientCrmUserId: '2224755',
      resolvedRecipientWecomUserId: 'NiuJin',
      resolvedRecipientSource: 'REGION_OVERRIDE',
    });
    vi.mocked(analysisService.deleteDailyReportDeliveryDepartment).mockResolvedValue({
      success: true,
      departmentId: '__GLOBAL_ALL__',
    });
    vi.mocked(analysisService.createDailyReportSalesGroup).mockResolvedValue({
      groupId: 'dept_new_sales',
      groupName: '新销售团队',
      source: 'MANUAL',
      status: 'ENABLED',
      recipientCrmUserIds: ['user_product_li_si'],
      recipientCrmUserId: 'user_product_li_si',
      memberCrmUserIds: ['user_product_li_si'],
      memberOverrideEnabled: true,
      updatedBy: 'user_admin',
      updatedAt: '2026-05-14T10:00:00.000Z',
      reason: '新增手工团队',
    });
    vi.mocked(analysisService.updateDailyReportSalesGroup).mockResolvedValue({
      groupId: 'dept_sd_sales',
      groupName: '山东销售',
      source: 'AUTO',
      linkedDepartmentId: 'dept_sd_sales',
      regionDepartmentId: 'dept_sd_region',
      regionDepartmentName: '山东区',
      status: 'ENABLED',
      recipientCrmUserIds: ['2224755'],
      recipientCrmUserId: '2224755',
      memberCrmUserIds: ['user_sales_director'],
      memberOverrideEnabled: true,
      updatedBy: 'user_admin',
      updatedAt: '2026-05-14T10:00:00.000Z',
      reason: '调整日报团队',
    });
    vi.mocked(analysisService.deleteDailyReportSalesGroup).mockResolvedValue({
      success: true,
      groupId: 'dept_sd_sales',
    });
    vi.mocked(analysisService.previewDailyReportDelivery).mockResolvedValue({
      businessDate: '2026-04-28',
      groups: [
        {
          groupDepartmentId: 'dept_sd_sales',
          groupDepartmentName: '山东销售',
          regionDepartmentId: 'dept_sd_region',
          regionDepartmentName: '山东区',
          effectivePolicy: 'ENABLED',
          recipientCrmUserIds: ['2224755'],
          recipientNames: ['牛劲'],
          recipientWecomUserIds: ['NiuJin'],
          recipientCrmUserId: '2224755',
          recipientName: '牛劲',
          recipientWecomUserId: 'NiuJin',
          ruleSource: 'REGION_OVERRIDE',
          ruleSourceLabel: '区域继承',
          deliveryStatus: 'READY',
          deliveryStatusLabel: '可发送',
          memberRequesterIds: ['user_sales_director'],
          members: [
            {
              crmUserId: 'user_sales_director',
              memberName: '陈一鸣',
              wecomUserId: 'sales_a',
              mappingStatus: 'MAPPED',
              mappingStatusLabel: '已映射',
            },
          ],
          memberCount: 1,
        },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('首屏应先加载概览、灰度、候选项和角色权限，重区块接口延后一帧再加载', async () => {
    mount(PermissionCenterPage);
    await flushPromises();

    expect(analysisService.getAccessGovernanceOverview).toHaveBeenCalledTimes(1);
    expect(analysisService.getApplicationSuperAdminPolicy).toHaveBeenCalledTimes(1);
    expect(analysisService.getWecomPilotPolicy).toHaveBeenCalledTimes(1);
    expect(analysisService.listAccessOptions).toHaveBeenCalledTimes(1);
    expect(analysisService.listWecomOrgSubjects).toHaveBeenCalledTimes(1);
    expect(analysisService.listRolePermissions).toHaveBeenCalledTimes(1);
    expect(analysisService.listDataScopeGrants).not.toHaveBeenCalled();
    expect(analysisService.listIdentityMappings).not.toHaveBeenCalled();
    expect(analysisService.listDailyReportDeliveryDepartments).not.toHaveBeenCalled();
    expect(analysisService.previewDailyReportDelivery).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();
    await flushPromises();

    expect(analysisService.listDataScopeGrants).toHaveBeenCalledTimes(1);
    expect(analysisService.listIdentityMappings).not.toHaveBeenCalled();
    expect(analysisService.listDailyReportDeliveryDepartments).toHaveBeenCalledTimes(1);
    expect(analysisService.previewDailyReportDelivery).toHaveBeenCalledTimes(1);
  });

  it('应展示超级管理员授权区块并允许保存人员和角色名单', async () => {
    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();
    await activateGovernanceTab(wrapper, 'analysis-scope');

    expect(wrapper.text()).toContain('超级管理员授权');
    expect(wrapper.text()).toContain('已开通超级管理员授权的人员');
    expect(wrapper.text()).toContain('已开通超级管理员授权的角色');

    (wrapper.vm as any).applicationSuperAdminPolicy.fullAccessUserIds = ['user_admin', 'user_product_li_si'];
    (wrapper.vm as any).applicationSuperAdminPolicy.fullAccessRoleIds = ['role_product_manager'];
    (wrapper.vm as any).applicationSuperAdminPolicy.changeReason = '新增经营管理超级管理员';

    const button = wrapper.findAll('button').find((item) => item.text().includes('保存超级管理员授权'));
    expect(button).toBeTruthy();
    await button?.trigger('click');
    await flushPromises();

    expect(analysisService.updateApplicationSuperAdminPolicy).toHaveBeenCalledWith({
      subjects: [
        { subjectType: 'USER', subjectId: 'user_admin', status: 'ACTIVE' },
        { subjectType: 'USER', subjectId: 'user_product_li_si', status: 'ACTIVE' },
        { subjectType: 'ROLE', subjectId: 'role_product_manager', status: 'ACTIVE' },
      ],
      changeReason: '新增经营管理超级管理员',
    });
    expect(ElMessage.success).toHaveBeenCalledWith('超级管理员授权已保存。');
  });

  it('权限中心顶部页签不应暴露浏览器滚动条', () => {
    const styleText = readFileSync('src/styles/main.css', 'utf8');

    expect(styleText).toMatch(
      /\.permission-center-tabs > \.el-tabs__header\s*\{[\s\S]*overflow:\s*hidden;[\s\S]*scrollbar-width:\s*none;/,
    );
    expect(styleText).toMatch(
      /\.permission-center-tabs \.el-tabs__nav-scroll\s*\{[\s\S]*overflow-x:\s*auto;[\s\S]*overflow-y:\s*hidden;/,
    );
  });

  it('应将菜单键显示为中文，而不是英文路由键', async () => {
    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();

    expect(wrapper.text()).toContain('智能分析');
    expect(wrapper.text()).toContain('智能合同审核');
    expect(wrapper.text()).not.toContain('analysis-workbench');
    expect(wrapper.text()).not.toContain('contract-review');
  });

  it('角色权限页应以菜单包和风险权限展示，不再暴露动作大列表', async () => {
    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();

    const drawer = wrapper.findComponent(RolePermissionFormDrawer);
    expect(drawer.props('actionOptions')).toEqual([]);
    expect(wrapper.text()).toContain('智能分析');
    expect(wrapper.text()).toContain('智能合同审核');
    expect(wrapper.text()).toContain('导出数据');
    expect(wrapper.text()).toContain('查询他人合同');
    expect(wrapper.text()).not.toContain('查询模板管理');
    expect(wrapper.text()).not.toContain('分析问数');
    expect(wrapper.text()).not.toContain('management.report.view');
  });

  it('应展示 CRM 全量角色和用户/角色/部门选择器，而不是手填 ID 提示', async () => {
    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();

    expect(wrapper.text()).toContain('产品经理');
    expect(wrapper.text()).not.toContain('例如 user_sales_director');
    expect(wrapper.text()).not.toContain('例如 wx_sales_director');
    expect(wrapper.text()).not.toContain('多个 CRM 用户 ID 用逗号分隔');
    expect(wrapper.text()).not.toContain('多个 CRM 角色 ID 用逗号分隔');
  });

  it('应提供角色名、状态多条件查询和分页摘要', async () => {
    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();

    expect(wrapper.text()).toContain('角色名');
    expect(wrapper.text()).toContain('状态');
    expect(wrapper.text()).toContain('共 2 条');

    const callCountBeforeSizeChange = vi.mocked(analysisService.listRolePermissions).mock.calls.length;
    wrapper.findComponent({ name: 'ElPagination' }).vm.$emit('size-change', 20);
    await flushPromises();

    expect(analysisService.listRolePermissions).toHaveBeenCalledTimes(callCountBeforeSizeChange + 1);
    expect(vi.mocked(analysisService.listRolePermissions).mock.calls.at(-1)?.[0]).toMatchObject({
      page: 1,
      pageSize: 20,
    });
  });

  it('角色权限加载期间应显示加载态并禁用搜索区', async () => {
    const deferred = createDeferred<{
      page: number;
      pageSize: number;
      total: number;
      items: Array<Record<string, unknown>>;
    }>();
    vi.mocked(analysisService.listRolePermissions).mockReturnValueOnce(
      deferred.promise as never,
    );

    const wrapper = mount(PermissionCenterPage);
    await flushPromises();

    expect(wrapper.text()).toContain('正在加载角色权限...');
    expect(wrapper.text()).toContain('系统正在同步 CRM 角色与应用层权限矩阵，请稍候。');

    const searchButton = wrapper
      .findAll('button')
      .find((item) => item.text().includes('加载中...'));
    expect(searchButton).toBeTruthy();
    expect(searchButton?.attributes('disabled')).toBeDefined();

    deferred.resolve({
      page: 1,
      pageSize: 10,
      total: 0,
      items: [],
    });
    await flushPromises();

    expect(wrapper.text()).not.toContain('正在加载角色权限...');
  });

  it('应为角色启停状态渲染不同颜色的状态徽标', async () => {
    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();

    expect(wrapper.find('.permission-state-badge.status-tone--offline').exists()).toBe(true);
    expect(wrapper.find('.permission-state-badge.status-tone--success').exists()).toBe(true);
  });

  it('应将最终权限预览中的业务码转换为中文', async () => {
    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();
    await activateGovernanceTab(wrapper, 'identity-access');

    const previewButton = wrapper
      .findAll('button')
      .find((item) => item.text().includes('查看最终权限'));

    expect(previewButton).toBeTruthy();

    await previewButton!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('待灰度开通');
    expect(wrapper.text()).toContain('智能分析');
    expect(wrapper.text()).toContain('智能合同审核');
    expect(wrapper.text()).not.toContain('PILOT_REQUIRED');
    expect(wrapper.text()).not.toContain('analysis-workbench');
  });

  it('应展示白名单设置授权并提供保存入口', async () => {
    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();
    await activateGovernanceTab(wrapper, 'data-scope');

    expect(wrapper.text()).toContain('白名单设置');
    expect(wrapper.text()).toContain('允许区域经理临时查看产品部协作数据');
    expect(wrapper.text()).not.toContain('授权编号');
    expect(wrapper.text()).toContain('包含子部门');
    expect(wrapper.text()).toContain('保存白名单设置');
  });

  it('保存白名单设置时应自动生成内部授权编号', async () => {
    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();

    const pageVm = wrapper.vm as unknown as {
      saveDataScopeGrant: () => Promise<void>;
      dataScopeGrantDraft: {
        subjectType: 'USER' | 'ROLE';
        subjectId: string;
        departmentIds: string[];
        includeSubDepartments: boolean;
        reason: string;
        status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
      };
    };

    pageVm.dataScopeGrantDraft.subjectType = 'ROLE';
    pageVm.dataScopeGrantDraft.subjectId = 'role_product_manager';
    pageVm.dataScopeGrantDraft.departmentIds = ['dept_product'];
    pageVm.dataScopeGrantDraft.includeSubDepartments = true;
    pageVm.dataScopeGrantDraft.reason = '允许产品经理查看产品部协作数据';
    pageVm.dataScopeGrantDraft.status = 'ACTIVE';

    await pageVm.saveDataScopeGrant();

    expect(analysisService.updateDataScopeGrant).toHaveBeenCalledWith(
      'grant_role_product_manager',
      expect.objectContaining({
        subjectType: 'ROLE',
        subjectId: 'role_product_manager',
      }),
    );
  });

  it('日报治理应直接展示团队表格和 CRUD 操作', async () => {
    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();
    await activateDailyReportTab(wrapper);

    expect(wrapper.text()).toContain('日报治理');
    expect(wrapper.text()).toContain('团队名');
    expect(wrapper.text()).toContain('组长');
    expect(wrapper.text()).toContain('组员');
    expect(wrapper.text()).toContain('新增团队');
    expect(wrapper.text()).toContain('查询');
    expect(wrapper.text()).toContain('编辑');
    expect(wrapper.text()).toContain('删除');
    expect(wrapper.text()).not.toContain('日报策略');
    expect(wrapper.text()).not.toContain('收件规则');
    expect(wrapper.text()).not.toContain('发送预览');
    expect(wrapper.text()).not.toContain('系统正在读取企业微信组织架构并识别团队');
    expect(wrapper.text()).not.toContain('可以先新增团队，后续自动识别结果会继续汇总到这张表');
    expect(analysisService.listDailyReportDeliveryDepartments).toHaveBeenCalled();
    expect(analysisService.previewDailyReportDelivery).toHaveBeenCalled();
  });

  it('基础权限应拆分为多个一级治理 tab', async () => {
    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();

    expect(wrapper.find('[data-test="role-permission-tab"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="wecom-access-tab"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="analysis-scope-tab"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="data-scope-tab"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('超级管理员授权');
    expect(wrapper.text()).toContain('白名单设置');
    expect(wrapper.find('[data-test="identity-access-tab"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('身份与权限诊断');
    expect(wrapper.find('[data-test="identity-diagnostic-tab"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="access-preview-tab"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="daily-report-governance-tab"]').exists()).toBe(true);

    await activateGovernanceTab(wrapper, 'wecom-access');

    expect(wrapper.text()).toContain('企业微信灰度');
    expect(wrapper.text()).toContain('保存灰度策略');
    expect(wrapper.find('[data-test="wecom-access-panel"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="role-permission-panel"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="data-scope-panel"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="identity-diagnostic-panel"]').exists()).toBe(false);
  });

  it('权限中心涉及人员和部门的入口应统一使用企业微信组织架构选择器', async () => {
    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();

    await activateGovernanceTab(wrapper, 'wecom-access');
    let pickers = wrapper.findAllComponents(WecomOrgSubjectPicker);
    expect(pickers.map((item) => item.props('valueType'))).toEqual([
      'crmUserId',
      'crmDepartmentId',
      'crmUserId',
    ]);

    await activateGovernanceTab(wrapper, 'analysis-scope');
    pickers = wrapper.findAllComponents(WecomOrgSubjectPicker);
    expect(pickers).toHaveLength(1);
    expect(pickers[0].props('valueType')).toBe('crmUserId');

    await activateGovernanceTab(wrapper, 'data-scope');
    (wrapper.vm as any).dataScopeGrantDraft.subjectType = 'USER';
    await flushPromises();
    pickers = wrapper.findAllComponents(WecomOrgSubjectPicker);
    expect(pickers.map((item) => item.props('valueType'))).toEqual([
      'crmUserId',
      'crmDepartmentId',
    ]);

    await activateDailyReportTab(wrapper);
    (wrapper.vm as any).openCreateDailyReportTeamDialog();
    await flushPromises();
    pickers = wrapper.findAllComponents(WecomOrgSubjectPicker);
    expect(pickers.map((item) => item.props('valueType'))).toEqual([
      'crmUserId',
      'crmUserId',
    ]);

    (wrapper.vm as any).closeDailyReportTeamDialog();
    await flushPromises();
    await activateGovernanceTab(wrapper, 'identity-access');
    pickers = [
      ...wrapper.find('[data-test="identity-diagnostic-panel"]').findAllComponents(WecomOrgSubjectPicker),
      ...wrapper.find('[data-test="access-preview-panel"]').findAllComponents(WecomOrgSubjectPicker),
    ];
    expect(pickers.map((item) => item.props('valueType'))).toEqual([
      'wecomUserId',
      'crmUserId',
      'wecomUserId',
    ]);
  });

  it('超级管理员授权中无企业微信映射的 CRM 内置账号应显示账号名', async () => {
    vi.mocked(analysisService.getApplicationSuperAdminPolicy).mockResolvedValueOnce({
      policyId: 'application_super_admin_policy_current',
      subjects: [
        { subjectType: 'USER', subjectId: '2224754', status: 'ACTIVE' },
      ],
      fullAccessUserIds: ['2224754'],
      fullAccessRoleIds: [],
      updatedBy: 'user_admin',
      updatedAt: '2026-05-27T10:00:00.000Z',
      changeReason: '保留 CRM 内置账号授权。',
    });
    vi.mocked(analysisService.listAccessOptions).mockResolvedValueOnce({
      users: [
        { value: '2224754', label: 'CRM智能小助手' },
        { value: 'user_admin', label: '系统管理员（系统管理员）' },
      ],
      roles: [],
      departments: [],
      wecomUsers: [],
    });
    vi.mocked(analysisService.listWecomOrgSubjects).mockResolvedValueOnce({
      lastSyncedAt: '2026-05-20T10:00:00.000Z',
      departments: [],
      users: [],
    });
    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();

    await activateGovernanceTab(wrapper, 'analysis-scope');

    const picker = wrapper.findComponent(WecomOrgSubjectPicker);
    expect(picker.text()).toContain('CRM智能小助手');
    expect(picker.text()).not.toContain('2224754');
  });

  it('身份映射诊断查询条件应与查询按钮使用同一行工具栏对齐', async () => {
    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();
    await activateGovernanceTab(wrapper, 'identity-access');

    const panel = wrapper.find('[data-test="identity-diagnostic-panel"]');
    const toolbar = panel.find('.permission-toolbar');

    expect(toolbar.exists()).toBe(true);
    expect(toolbar.find('.form-field').text()).toContain('企业微信账号');
    expect(toolbar.find('.permission-toolbar__query').text()).toContain('查询');
    expect(panel.find('.field-grid .permission-toolbar__query').exists()).toBe(false);
    expect(wrapper.find('[data-test="access-preview-panel"]').exists()).toBe(true);
  });

  it('日报治理应显示从企业微信组织架构识别出的团队、组长、组员和启停开关', async () => {
    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();
    await activateDailyReportTab(wrapper);

    expect(wrapper.find('[data-test="daily-report-governance-tab"]').exists()).toBe(true);
    expect(wrapper.find('.daily-report-status-switch').exists()).toBe(true);
    expect(wrapper.text()).toContain('山东销售');
    expect(wrapper.text()).toContain('牛劲');
    expect(wrapper.text()).toContain('陈一鸣');
    expect(wrapper.text()).not.toContain('REGION_OVERRIDE');
    expect(wrapper.text()).not.toContain('READY');
  });

  it('切换到日报治理 tab 后应显示日报团队表格', async () => {
    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();

    await activateDailyReportTab(wrapper);

    expect(wrapper.text()).toContain('日报团队');
    expect(wrapper.text()).toContain('团队名');
    expect(wrapper.text()).toContain('山东销售');
  });

  it('日报治理应支持按团队名、组长或组员查询', async () => {
    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();

    const pageVm = wrapper.vm as unknown as {
      dailyReportTeamKeyword: string;
      filteredDailyReportTeams: DailyReportDeliveryPreviewGroupView[];
    };

    pageVm.dailyReportTeamKeyword = '陈一鸣';
    await nextTick();

    expect(pageVm.filteredDailyReportTeams).toHaveLength(1);
    expect(pageVm.filteredDailyReportTeams[0].groupDepartmentName).toBe('山东销售');

    pageVm.dailyReportTeamKeyword = '不存在的团队';
    await nextTick();

    expect(pageVm.filteredDailyReportTeams).toHaveLength(0);
  });

  it('日报团队查询按钮应紧跟查询框，并支持 Enter 执行查询', async () => {
    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();
    await activateDailyReportTab(wrapper);
    vi.mocked(analysisService.previewDailyReportDelivery).mockClear();

    const searchInput = wrapper.find('input[placeholder="输入团队名、组长或组员"]');
    expect(searchInput.exists()).toBe(true);
    await searchInput.setValue('陈一鸣');
    await searchInput.trigger('keyup.enter');
    await flushPromises();

    expect(analysisService.previewDailyReportDelivery).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('山东销售');

    vi.mocked(analysisService.previewDailyReportDelivery).mockClear();
    const queryButton = wrapper
      .findAll('.permission-toolbar button')
      .find((item) => item.text().includes('查询'));
    expect(queryButton).toBeTruthy();
    await queryButton!.trigger('click');
    await flushPromises();

    expect(analysisService.previewDailyReportDelivery).toHaveBeenCalledTimes(1);
  });

  it('点击日报团队启停开关时应调用快速更新接口', async () => {
    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();
    await activateDailyReportTab(wrapper);

    const pageVm = wrapper.vm as unknown as {
      toggleDailyReportPreviewGroupStatus: (
        row: DailyReportDeliveryPreviewGroupView,
        enabled: boolean,
      ) => Promise<void>;
    };

    await pageVm.toggleDailyReportPreviewGroupStatus(
      {
        groupDepartmentId: 'dept_sd_sales',
        groupDepartmentName: '山东销售',
        regionDepartmentId: 'dept_sd_region',
        regionDepartmentName: '山东区',
        effectivePolicy: 'ENABLED',
        recipientCrmUserId: '2224755',
        recipientName: '牛劲',
        recipientWecomUserId: 'NiuJin',
        ruleSource: 'REGION_OVERRIDE',
        ruleSourceLabel: '区域继承',
        deliveryStatus: 'READY',
        deliveryStatusLabel: '可发送',
        memberRequesterIds: ['user_sales_director'],
        members: [
          {
            crmUserId: 'user_sales_director',
            memberName: '陈一鸣',
            mappingStatus: 'MAPPED',
            mappingStatusLabel: '已映射',
          },
        ],
        memberCount: 1,
      },
      false,
    );

    expect(analysisService.updateDailyReportDeliveryDepartment).toHaveBeenCalledWith(
      'dept_sd_sales',
      expect.objectContaining({
        status: 'DISABLED',
        departmentType: 'SALES',
        reason: '通过日报团队表格快速停用日报团队。',
      }),
    );
  });

  it('切换单个日报团队状态时，只应锁定当前团队操作', async () => {
    const deferred = createDeferred<Record<string, unknown>>();
    vi.mocked(analysisService.updateDailyReportDeliveryDepartment).mockReturnValueOnce(
      deferred.promise as never,
    );
    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();
    await activateDailyReportTab(wrapper);

    const pageVm = wrapper.vm as unknown as {
      isDailyReportGroupSaving: (groupId: string) => boolean;
      toggleDailyReportPreviewGroupStatus: (
        row: DailyReportDeliveryPreviewGroupView,
        enabled: boolean,
      ) => Promise<void>;
    };

    const togglePromise = pageVm.toggleDailyReportPreviewGroupStatus(
      {
        groupDepartmentId: 'dept_sd_sales',
        groupDepartmentName: '山东销售',
        regionDepartmentId: 'dept_sd_region',
        regionDepartmentName: '山东区',
        effectivePolicy: 'ENABLED',
        recipientCrmUserId: '2224755',
        recipientName: '牛劲',
        recipientWecomUserId: 'NiuJin',
        ruleSource: 'REGION_OVERRIDE',
        ruleSourceLabel: '区域继承',
        deliveryStatus: 'READY',
        deliveryStatusLabel: '可发送',
        memberRequesterIds: ['user_sales_director'],
        members: [],
        memberCount: 0,
      },
      false,
    );
    await nextTick();

    expect(pageVm.isDailyReportGroupSaving('dept_sd_sales')).toBe(true);
    expect(pageVm.isDailyReportGroupSaving('dept_js_presales')).toBe(false);

    deferred.resolve({});
    await togglePromise;
  });

  it('程序未识别到团队时应显示新增团队入口', async () => {
    vi.mocked(analysisService.previewDailyReportDelivery).mockResolvedValueOnce({
      businessDate: '2026-04-28',
      groups: [],
    });

    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();
    await activateDailyReportTab(wrapper);

    expect(wrapper.text()).toContain('暂无日报团队');
    expect(wrapper.text()).toContain('新增团队');
  });

  it('日报团队加载失败时只用消息提示，不应在表格上方铺开大块说明', async () => {
    vi.mocked(analysisService.previewDailyReportDelivery).mockRejectedValueOnce(
      new Error('当前服务暂时不可用'),
    );

    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();
    await activateDailyReportTab(wrapper);

    expect(ElMessage.error).toHaveBeenCalled();
    expect(wrapper.text()).not.toContain('重试加载日报团队');
    expect(wrapper.text()).not.toContain('当前服务暂时不可用');
  });

  it('新增日报团队时应调用团队创建接口', async () => {
    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();

    const pageVm = wrapper.vm as unknown as {
      dailyReportSalesGroupDraft: {
        groupId: string;
        groupName: string;
        recipientCrmUserIds: string[];
        memberCrmUserIds: string[];
        status: 'ENABLED' | 'DISABLED';
        reason: string;
      };
      saveDailyReportSalesGroup: () => Promise<void>;
    };

    pageVm.dailyReportSalesGroupDraft.groupId = '';
    pageVm.dailyReportSalesGroupDraft.groupName = '新销售团队';
    pageVm.dailyReportSalesGroupDraft.recipientCrmUserIds = [
      'user_product_li_si',
      'user_sales_director',
    ];
    pageVm.dailyReportSalesGroupDraft.memberCrmUserIds = ['user_product_li_si'];
    pageVm.dailyReportSalesGroupDraft.status = 'ENABLED';
    pageVm.dailyReportSalesGroupDraft.reason = '组织架构未自动识别，手工补充日报团队。';

    await pageVm.saveDailyReportSalesGroup();

    expect(analysisService.createDailyReportSalesGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        groupName: '新销售团队',
        recipientCrmUserIds: ['user_product_li_si', 'user_sales_director'],
        memberCrmUserIds: ['user_product_li_si'],
      }),
    );
  });

  it('新增日报团队弹窗默认应为禁用状态', async () => {
    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();

    const pageVm = wrapper.vm as unknown as {
      dailyReportSalesGroupDraft: {
        status: 'ENABLED' | 'DISABLED';
      };
      openCreateDailyReportTeamDialog: () => void;
    };

    pageVm.openCreateDailyReportTeamDialog();

    expect(pageVm.dailyReportSalesGroupDraft.status).toBe('DISABLED');
  });

  it('编辑日报团队时应回显不在全局候选项中的组长和组员', async () => {
    const wrapper = mount(PermissionCenterPage, {
      attachTo: document.body,
    });
    await flushDeferredLoad();
    await activateDailyReportTab(wrapper);

    const pageVm = wrapper.vm as unknown as {
      filteredDailyReportTeams: DailyReportDeliveryPreviewGroupView[];
      editDailyReportSalesGroup: (row: DailyReportDeliveryPreviewGroupView) => void;
    };

    pageVm.editDailyReportSalesGroup(pageVm.filteredDailyReportTeams[0]);
    await flushPromises();

    const dialogText = document.body.querySelector('.el-dialog')?.textContent ?? '';
    expect(dialogText).toContain('牛劲');
    expect(dialogText).toContain('陈一鸣');

    wrapper.unmount();
  });

  it('编辑日报团队时应回显尚未完成 CRM 映射的组长和组员', async () => {
    vi.mocked(analysisService.previewDailyReportDelivery).mockResolvedValueOnce({
      businessDate: '2026-05-18',
      groups: [
        {
          groupDepartmentId: 'dept_unmapped_sales',
          groupDepartmentName: '未映射销售',
          regionDepartmentId: 'dept_unmapped_region',
          regionDepartmentName: '未映射区域',
          effectivePolicy: 'ENABLED',
          recipientName: '赵阳',
          recipientWecomUserId: 'zhaoyang',
          ruleSource: 'AUTO',
          ruleSourceLabel: '自动识别',
          deliveryStatus: 'BLOCKED',
          deliveryStatusLabel: '待补充映射',
          memberRequesterIds: [],
          members: [
            {
              memberName: '王未映射',
              wecomUserId: 'sales_b',
              mappingStatus: 'MISSING_CRM_USER',
              mappingStatusLabel: '缺少 CRM 映射',
            },
          ],
          memberCount: 1,
        },
      ],
    });
    vi.mocked(analysisService.listWecomOrgSubjects).mockResolvedValue({
      lastSyncedAt: '2026-05-20T10:00:00.000Z',
      departments: [
        {
          departmentId: 'dept_product',
          name: '产品部',
          syncStatus: 'ACTIVE',
          crmDepartmentId: 'dept_product',
          crmDepartmentName: '产品部',
          mappingStatus: 'MAPPED',
        },
      ],
      users: [
        {
          wecomUserId: 'wx_product_li_si',
          name: '李四',
          departmentIds: ['dept_product'],
          primaryDepartmentId: 'dept_product',
          crmUserId: 'user_product_li_si',
          crmUserName: '李四',
          syncStatus: 'ACTIVE',
          mappingStatus: 'MAPPED',
        },
        {
          wecomUserId: 'wx_admin',
          name: '系统管理员',
          departmentIds: ['dept_admin'],
          primaryDepartmentId: 'dept_admin',
          crmUserId: 'user_admin',
          crmUserName: '系统管理员',
          syncStatus: 'ACTIVE',
          mappingStatus: 'MAPPED',
        },
      ],
    });
    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();
    await activateDailyReportTab(wrapper);

    const pageVm = wrapper.vm as unknown as {
      dailyReportSalesGroupDraft: {
        recipientCrmUserIds: string[];
        memberCrmUserIds: string[];
      };
      dailyReportTeamUserOptions: Array<{
        value: string;
        label: string;
        disabled?: boolean;
      }>;
      editDailyReportSalesGroup: (row: DailyReportDeliveryPreviewGroupView) => void;
      filteredDailyReportTeams: DailyReportDeliveryPreviewGroupView[];
    };

    pageVm.editDailyReportSalesGroup(pageVm.filteredDailyReportTeams[0]);
    await flushPromises();

    const recipientOption = pageVm.dailyReportTeamUserOptions.find(
      (item) => item.value === pageVm.dailyReportSalesGroupDraft.recipientCrmUserIds[0],
    );
    const memberOption = pageVm.dailyReportTeamUserOptions.find(
      (item) => item.value === pageVm.dailyReportSalesGroupDraft.memberCrmUserIds[0],
    );

    expect(pageVm.dailyReportSalesGroupDraft.recipientCrmUserIds[0]).not.toBe('');
    expect(recipientOption).toEqual(
      expect.objectContaining({
        label: '赵阳（未绑定 CRM）',
        disabled: true,
      }),
    );
    expect(pageVm.dailyReportSalesGroupDraft.memberCrmUserIds).toHaveLength(1);
    expect(memberOption).toEqual(
      expect.objectContaining({
        label: '王未映射（未绑定 CRM）',
        disabled: true,
      }),
    );
  });

  it('编辑日报团队时应按姓名唯一匹配已有 CRM 账号', async () => {
    vi.mocked(analysisService.listAccessOptions).mockResolvedValueOnce({
      users: [
        { value: '2223404', label: '张玺玺（售前总监）' },
        { value: '2223594', label: '罗岩（售前）' },
      ],
      roles: [],
      departments: [],
      wecomUsers: [],
    });
    vi.mocked(analysisService.previewDailyReportDelivery).mockResolvedValueOnce({
      businessDate: '2026-05-18',
      groups: [
        {
          groupDepartmentId: 'dept_presales',
          groupDepartmentName: '晋冀售前',
          effectivePolicy: 'ENABLED',
          recipientName: '张玺玺',
          recipientWecomUserId: 'zhangxixi',
          ruleSource: 'AUTO',
          ruleSourceLabel: '自动识别',
          deliveryStatus: 'BLOCKED',
          deliveryStatusLabel: '待补充映射',
          memberRequesterIds: [],
          members: [
            {
              memberName: '罗岩',
              wecomUserId: 'luoyan',
              mappingStatus: 'MISSING_CRM_USER',
              mappingStatusLabel: '缺少 CRM 映射',
            },
          ],
          memberCount: 1,
        },
      ],
    });
    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();
    await activateDailyReportTab(wrapper);

    const pageVm = wrapper.vm as unknown as {
      dailyReportSalesGroupDraft: {
        recipientCrmUserIds: string[];
        memberCrmUserIds: string[];
      };
      dailyReportTeamUserOptions: Array<{
        value: string;
        label: string;
        disabled?: boolean;
      }>;
      editDailyReportSalesGroup: (row: DailyReportDeliveryPreviewGroupView) => void;
      filteredDailyReportTeams: DailyReportDeliveryPreviewGroupView[];
    };

    pageVm.editDailyReportSalesGroup(pageVm.filteredDailyReportTeams[0]);
    await flushPromises();

    expect(pageVm.dailyReportSalesGroupDraft.recipientCrmUserIds).toEqual(['2223404']);
    expect(pageVm.dailyReportSalesGroupDraft.memberCrmUserIds).toEqual(['2223594']);
    expect(pageVm.dailyReportTeamUserOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: '2223404',
          label: '张玺玺（售前总监）',
          disabled: false,
        }),
        expect.objectContaining({
          value: '2223594',
          label: '罗岩（售前）',
          disabled: false,
        }),
      ]),
    );
  });

  it('未映射组员标签应支持逐个移除', async () => {
    vi.mocked(analysisService.previewDailyReportDelivery).mockResolvedValueOnce({
      businessDate: '2026-05-18',
      groups: [
        {
          groupDepartmentId: 'dept_unmapped_sales',
          groupDepartmentName: '未映射销售',
          effectivePolicy: 'ENABLED',
          recipientName: '赵阳',
          recipientWecomUserId: 'zhaoyang',
          ruleSource: 'AUTO',
          ruleSourceLabel: '自动识别',
          deliveryStatus: 'BLOCKED',
          deliveryStatusLabel: '待补充映射',
          memberRequesterIds: [],
          members: [
            {
              memberName: '王未映射',
              wecomUserId: 'sales_b',
              mappingStatus: 'MISSING_CRM_USER',
              mappingStatusLabel: '缺少 CRM 映射',
            },
            {
              memberName: '李未映射',
              wecomUserId: 'sales_c',
              mappingStatus: 'MISSING_CRM_USER',
              mappingStatusLabel: '缺少 CRM 映射',
            },
          ],
          memberCount: 2,
        },
      ],
    });
    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();
    await activateDailyReportTab(wrapper);

    const pageVm = wrapper.vm as unknown as {
      dailyReportSalesGroupDraft: {
        memberCrmUserIds: string[];
      };
      editDailyReportSalesGroup: (row: DailyReportDeliveryPreviewGroupView) => void;
      filteredDailyReportTeams: DailyReportDeliveryPreviewGroupView[];
    };

    pageVm.editDailyReportSalesGroup(pageVm.filteredDailyReportTeams[0]);
    await flushPromises();

    const memberPicker = wrapper
      .findAllComponents(WecomOrgSubjectPicker)
      .find((item) => {
        const modelValue = item.props('modelValue');
        return (
          Array.isArray(modelValue) &&
          modelValue.length === 2 &&
          modelValue.every((value) => String(value).includes('__daily_report_unmapped_user__'))
        );
      });
    const closeButtons = memberPicker?.findAll('.el-tag__close') ?? [];
    expect(closeButtons.length).toBeGreaterThanOrEqual(2);

    await closeButtons[0].trigger('click');
    await flushPromises();

    expect(pageVm.dailyReportSalesGroupDraft.memberCrmUserIds).toHaveLength(1);
  });

  it('按姓名匹配到 CRM 的组员标签也应只移除当前成员', async () => {
    vi.mocked(analysisService.listAccessOptions).mockResolvedValueOnce({
      users: [
        { value: '2224497', label: '史鹏勇（售前）' },
        { value: '2223404', label: '张玺玺（售前总监）' },
        { value: '2223594', label: '罗岩（售前）' },
        { value: '2224186', label: '曹晓敬（售前）' },
      ],
      roles: [],
      departments: [],
      wecomUsers: [],
    });
    vi.mocked(analysisService.previewDailyReportDelivery).mockResolvedValueOnce({
      businessDate: '2026-05-18',
      groups: [
        {
          groupDepartmentId: 'dept_presales',
          groupDepartmentName: '晋冀售前',
          effectivePolicy: 'ENABLED',
          recipientName: '张玺玺',
          recipientWecomUserId: 'zhangxixi',
          ruleSource: 'AUTO',
          ruleSourceLabel: '自动识别',
          deliveryStatus: 'BLOCKED',
          deliveryStatusLabel: '待补充映射',
          memberRequesterIds: [],
          members: [
            {
              memberName: '史鹏勇',
              wecomUserId: 'shipengyong',
              mappingStatus: 'MISSING_CRM_USER',
              mappingStatusLabel: '缺少 CRM 映射',
            },
            {
              memberName: '张玺玺',
              wecomUserId: 'zhangxixi',
              mappingStatus: 'MISSING_CRM_USER',
              mappingStatusLabel: '缺少 CRM 映射',
            },
            {
              memberName: '罗岩',
              wecomUserId: 'luoyan',
              mappingStatus: 'MISSING_CRM_USER',
              mappingStatusLabel: '缺少 CRM 映射',
            },
            {
              memberName: '曹晓敬',
              wecomUserId: 'caoxiaojing',
              mappingStatus: 'MISSING_CRM_USER',
              mappingStatusLabel: '缺少 CRM 映射',
            },
          ],
          memberCount: 4,
        },
      ],
    });
    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();
    await activateDailyReportTab(wrapper);

    const pageVm = wrapper.vm as unknown as {
      dailyReportSalesGroupDraft: {
        memberCrmUserIds: string[];
      };
      editDailyReportSalesGroup: (row: DailyReportDeliveryPreviewGroupView) => void;
      filteredDailyReportTeams: DailyReportDeliveryPreviewGroupView[];
    };

    pageVm.editDailyReportSalesGroup(pageVm.filteredDailyReportTeams[0]);
    await flushPromises();

    const memberPicker = wrapper
      .findAllComponents(WecomOrgSubjectPicker)
      .find((item) => {
        const modelValue = item.props('modelValue');
        return (
          Array.isArray(modelValue) &&
          modelValue.length === 4 &&
          modelValue.includes('2224497')
        );
      });
    const closeButtons = memberPicker?.findAll('.el-tag__close') ?? [];
    expect(closeButtons.length).toBeGreaterThanOrEqual(4);

    await closeButtons[0].trigger('click');
    await flushPromises();

    expect(pageVm.dailyReportSalesGroupDraft.memberCrmUserIds).toEqual([
      '2223404',
      '2223594',
      '2224186',
    ]);
  });

  it('保存日报团队时不应把未映射回显值作为 CRM 用户提交', async () => {
    vi.mocked(analysisService.previewDailyReportDelivery).mockResolvedValueOnce({
      businessDate: '2026-05-18',
      groups: [
        {
          groupDepartmentId: 'dept_unmapped_sales',
          groupDepartmentName: '未映射销售',
          effectivePolicy: 'ENABLED',
          recipientName: '赵阳',
          recipientWecomUserId: 'zhaoyang',
          ruleSource: 'AUTO',
          ruleSourceLabel: '自动识别',
          deliveryStatus: 'BLOCKED',
          deliveryStatusLabel: '待补充映射',
          memberRequesterIds: [],
          members: [
            {
              memberName: '王未映射',
              wecomUserId: 'sales_b',
              mappingStatus: 'MISSING_CRM_USER',
              mappingStatusLabel: '缺少 CRM 映射',
            },
          ],
          memberCount: 1,
        },
      ],
    });
    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();
    await activateDailyReportTab(wrapper);

    const pageVm = wrapper.vm as unknown as {
      filteredDailyReportTeams: DailyReportDeliveryPreviewGroupView[];
      editDailyReportSalesGroup: (row: DailyReportDeliveryPreviewGroupView) => void;
      saveDailyReportSalesGroup: () => Promise<void>;
    };

    pageVm.editDailyReportSalesGroup(pageVm.filteredDailyReportTeams[0]);
    await pageVm.saveDailyReportSalesGroup();

    const [, payload] = vi.mocked(analysisService.updateDailyReportSalesGroup).mock.calls.at(-1)!;
    expect(payload).toMatchObject({
      groupName: '未映射销售',
      recipientCrmUserIds: [],
      memberCrmUserIds: [],
    });
    expect(payload).not.toHaveProperty('recipientCrmUserId');
  });

  it('日报团队弹窗不应点击遮罩关闭，并且组员标签不应折叠成数量', async () => {
    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();

    const pageVm = wrapper.vm as unknown as {
      dailyReportSalesGroupDraft: {
        memberCrmUserIds: string[];
      };
      openCreateDailyReportTeamDialog: () => void;
    };

    pageVm.openCreateDailyReportTeamDialog();
    pageVm.dailyReportSalesGroupDraft.memberCrmUserIds = [
      'user_product_li_si',
      'user_sales_director',
    ];
    await flushPromises();

    const dialog = wrapper.findComponent({ name: 'ElDialog' });
    expect(dialog.props('closeOnClickModal')).toBe(false);

    const memberPicker = wrapper
      .findAllComponents(WecomOrgSubjectPicker)
      .find((item) => item.props('placeholder') === '请选择组员');
    expect(memberPicker).toBeTruthy();
    expect(memberPicker?.text()).toContain('李四');
    expect(memberPicker?.text()).toContain('陈一鸣');
    expect(memberPicker?.text()).not.toContain('+2');
  });

  it('日报团队组员选择器应支持多选和按当前部门全选', async () => {
    vi.mocked(analysisService.listWecomOrgSubjects).mockResolvedValue({
      lastSyncedAt: '2026-05-20T10:00:00.000Z',
      departments: [
        {
          departmentId: 'dept_product',
          name: '产品部',
          syncStatus: 'ACTIVE',
          crmDepartmentId: 'dept_product',
          crmDepartmentName: '产品部',
          mappingStatus: 'MAPPED',
        },
      ],
      users: [
        {
          wecomUserId: 'wx_product_li_si',
          name: '李四',
          departmentIds: ['dept_product'],
          primaryDepartmentId: 'dept_product',
          crmUserId: 'user_product_li_si',
          crmUserName: '李四',
          syncStatus: 'ACTIVE',
          mappingStatus: 'MAPPED',
        },
        {
          wecomUserId: 'wx_sales_director',
          name: '陈一鸣',
          departmentIds: ['dept_product'],
          primaryDepartmentId: 'dept_product',
          crmUserId: 'user_sales_director',
          crmUserName: '陈一鸣',
          syncStatus: 'ACTIVE',
          mappingStatus: 'MAPPED',
        },
      ],
    });
    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();

    const pageVm = wrapper.vm as unknown as {
      openCreateDailyReportTeamDialog: () => void;
    };
    pageVm.openCreateDailyReportTeamDialog();
    await flushPromises();

    const memberPicker = wrapper
      .findAllComponents(WecomOrgSubjectPicker)
      .find((item) => item.props('placeholder') === '请选择组员');
    expect(memberPicker).toBeTruthy();

    await memberPicker!.get('[data-test="wecom-org-picker-open"]').trigger('click');
    await flushPromises();

    expect(memberPicker!.get('[data-test="subject-department-bulk-dept_product"]').text()).toBe('全选');

    await memberPicker!.get('[data-test="subject-department-bulk-dept_product"]').trigger('click');
    await memberPicker!.get('[data-test="wecom-org-picker-confirm"]').trigger('click');

    expect((wrapper.vm as any).dailyReportSalesGroupDraft.memberCrmUserIds).toEqual([
      'user_product_li_si',
      'user_sales_director',
    ]);
  });

  it('日报团队组长选择器应支持多选', async () => {
    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();

    const pageVm = wrapper.vm as unknown as {
      openCreateDailyReportTeamDialog: () => void;
      dailyReportSalesGroupDraft: {
        recipientCrmUserIds: string[];
      };
    };
    pageVm.openCreateDailyReportTeamDialog();
    await flushPromises();

    const leaderPicker = wrapper
      .findAllComponents(WecomOrgSubjectPicker)
      .find((item) => item.props('placeholder') === '请选择组长，可多选');

    expect(leaderPicker?.props('multiple')).toBe(true);
    await leaderPicker!.vm.$emit('update:modelValue', [
      'user_product_li_si',
      'user_sales_director',
    ]);

    expect(pageVm.dailyReportSalesGroupDraft.recipientCrmUserIds).toEqual([
      'user_product_li_si',
      'user_sales_director',
    ]);
  });

  it('保存角色权限后应刷新当前会话能力快照，避免页面继续使用旧权限', async () => {
    vi.mocked(analysisService.updateRolePermission).mockResolvedValue({
      roleId: 'role_product_director',
      roleNameSnapshot: '产品总监',
      status: 'ACTIVE',
      visibleMenus: ['analysis-workbench'],
      actionKeys: ['analysis.use'],
      webConsoleEnabled: true,
      wecomBotEligible: true,
      exportAllowed: true,
      templateManageAllowed: false,
      contractReviewUploadAllowed: false,
      contractReviewCrossViewAllowed: true,
      contractReviewCrossDownloadAllowed: false,
      updatedBy: 'user_admin',
      updatedAt: '2026-04-22T10:00:00.000Z',
    });
    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();

    const pageVm = wrapper.vm as unknown as {
      selectedRolePermission: RolePermissionItem | null;
      saveRolePermission: (payload: Record<string, unknown>) => Promise<void>;
    };
    pageVm.selectedRolePermission = {
      roleId: 'role_product_director',
      roleNameSnapshot: '产品总监',
      status: 'ACTIVE',
      visibleMenus: ['analysis-workbench'],
      actionKeys: ['analysis.use'],
      webConsoleEnabled: true,
      wecomBotEligible: true,
      exportAllowed: true,
      templateManageAllowed: false,
      contractReviewUploadAllowed: false,
      contractReviewCrossViewAllowed: true,
      contractReviewCrossDownloadAllowed: false,
      updatedBy: 'user_admin',
      updatedAt: '2026-04-22T10:00:00.000Z',
    };

    await pageVm.saveRolePermission({ changeReason: '补开企微能力' });

    expect(mockLoadCapabilities).toHaveBeenCalledTimes(1);
  });

  it('保存企业微信灰度后应刷新当前会话能力快照，避免入口状态仍显示旧结果', async () => {
    vi.mocked(analysisService.updateWecomPilotPolicy).mockResolvedValue({
      channel: 'wecom-bot',
      mode: 'FULL',
      allowUserIds: [],
      allowRoleIds: [],
      allowDepartmentIds: [],
      denyUserIds: [],
      updatedBy: 'user_admin',
      updatedAt: '2026-04-22T10:00:00.000Z',
    });
    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();

    const pageVm = wrapper.vm as unknown as {
      savePilotPolicy: () => Promise<void>;
    };

    await pageVm.savePilotPolicy();

    expect(mockLoadCapabilities).toHaveBeenCalledTimes(1);
  });

  it('日报团队配置为空时，不应影响表格新增入口', async () => {
    vi.mocked(analysisService.listDailyReportDeliveryDepartments).mockResolvedValueOnce({
      items: [],
      strategies: [],
    });
    vi.mocked(analysisService.previewDailyReportDelivery).mockResolvedValueOnce({
      businessDate: '2026-04-28',
      groups: [],
    });

    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();
    await activateDailyReportTab(wrapper);

    expect(wrapper.text()).toContain('暂无日报团队');
    expect(wrapper.text()).toContain('新增团队');
  });

  it('延迟区块加载失败时应展示重试入口，并在重试成功后恢复数据', async () => {
    vi.mocked(analysisService.listDataScopeGrants).mockClear();
    vi.mocked(analysisService.listDataScopeGrants)
      .mockRejectedValueOnce(new Error('加载白名单设置失败'))
      .mockResolvedValueOnce({
        items: [
          {
            id: 'grant_region_manager',
            subjectType: 'ROLE',
            subjectId: 'role_region_manager',
            departmentIds: ['dept_product'],
            includeSubDepartments: true,
            reason: '允许区域经理临时查看产品部协作数据',
            status: 'ACTIVE',
            updatedBy: 'user_admin',
            updatedAt: '2026-04-23T10:00:00.000Z',
          },
        ],
      });

    const wrapper = mount(PermissionCenterPage);
    await flushDeferredLoad();
    await activateGovernanceTab(wrapper, 'data-scope');

    expect(wrapper.text()).toContain('加载白名单设置失败');
    expect(wrapper.text()).toContain('重试加载白名单设置');

    const retryButton = wrapper
      .findAll('button')
      .find((item) => item.text().includes('重试加载白名单设置'));
    expect(retryButton).toBeTruthy();

    await retryButton!.trigger('click');
    await flushPromises();

    expect(analysisService.listDataScopeGrants).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('允许区域经理临时查看产品部协作数据');
  });
});

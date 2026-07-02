import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { Cpu } from '@element-plus/icons-vue';
import AppShell from '@/layouts/AppShell.vue';
import ContractReviewWorkbenchPage from '@/pages/contract-review/ContractReviewWorkbenchPage.vue';
import ContractReviewDetailPage from '@/pages/contract-review/ContractReviewDetailPage.vue';
import {
  beginNavigationTrace,
  resetNavigationTraceState,
} from '@/services/navigation-performance.service';
import { contractReviewService } from '@/services/contract-review.service';
import { useAuthStore } from '@/stores/auth.store';
import type {
  ContractReviewSourceContractDetail,
  ContractReviewSourceContractSummary,
  ContractReviewReviewBasis,
  ContractReviewTaskDetail,
  ContractReviewTaskSummary,
} from '@/types/contract-review';

const pushMock = vi.fn();
const replaceMock = vi.fn();
const openMock = vi.fn();
const mockRoute = {
  path: '/analysis',
  fullPath: '/analysis',
  params: {} as Record<string, string>,
  query: {} as Record<string, string>,
};

vi.stubGlobal('open', openMock);

vi.mock('vue-router', () => ({
  RouterLink: {
    props: ['to'],
    template: '<a class="router-link"><slot /></a>',
  },
  useRoute: () => mockRoute,
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
  }),
}));

vi.mock('@/services/contract-review.service', () => ({
  contractReviewService: {
    listPendingApprovalContracts: vi.fn(),
    getPendingApprovalContractDetail: vi.fn(),
    createTaskFromContract: vi.fn(),
    listRecentTasks: vi.fn(),
    uploadContract: vi.fn(),
    getTaskDetail: vi.fn(),
    buildArtifactDownloadUrl: vi.fn(),
  },
}));

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await nextTick();
  await Promise.resolve();
  await nextTick();
}

function buildReviewBasis(
  overrides: Partial<ContractReviewReviewBasis> = {},
): ContractReviewReviewBasis {
  return {
    packCode: 'company-commercial-v1',
    packVersion: '2026.04',
    packChecksum: 'mock-checksum',
    packChecksumSummary: 'mock-sum',
    modelProfile: 'codex-high',
    executionMode: 'AI_HYBRID',
    promptFingerprints: {
      planner: 'planner-hash',
      reviewer: 'reviewer-hash',
      summarizer: 'summarizer-hash',
    },
    ...overrides,
  };
}

function buildPendingApprovalContractSummary(
  overrides: Partial<ContractReviewSourceContractSummary> = {},
): ContractReviewSourceContractSummary {
  return {
    contractId: 'con_pending_001',
    contractCode: 'HT-2026-001',
    contractName: '联软科技年度服务合同',
    customerName: '联软科技集团',
    ownerName: '张琳',
    totalAmount: 680000,
    submitApplyingAt: '2026-04-21T09:15:00.000Z',
    approveStatus: '待审批',
    pendingStep: 1,
    ...overrides,
  };
}

function buildPendingApprovalContractDetail(
  overrides: Partial<ContractReviewSourceContractDetail> = {},
): ContractReviewSourceContractDetail {
  return {
    contractId: 'con_pending_001',
    contractCode: 'HT-2026-001',
    contractName: '联软科技年度服务合同',
    customerName: '联软科技集团',
    opportunityTitle: '联软科技 CRM 升级项目',
    ownerId: 'owner_zhang',
    ownerName: '张琳',
    organizationId: 'org_north',
    departmentId: 'dept_sales',
    departmentName: '销售部',
    totalAmount: 680000,
    startAt: '2026-05-01T00:00:00.000Z',
    endAt: '2027-04-30T00:00:00.000Z',
    signDate: '2026-04-20T00:00:00.000Z',
    customerSigner: '李总',
    ourSigner: '王亮',
    specialTerms:
      '甲方需在验收通过后 45 天内完成付款。\n乙方交付成果的源代码及知识产权归甲方所有。',
    specialTermBlocks: [
      '甲方需在验收通过后 45 天内完成付款。',
      '乙方交付成果的源代码及知识产权归甲方所有。',
    ],
    approvalComment: '请重点核对付款账期和知识产权归属。',
    approvalHistory: [
      {
        step: 1,
        status: 'pending',
        approverId: 'user_legal_001',
        approverName: '法务复核',
        comment: '请重点核对付款账期和知识产权归属。',
      },
    ],
    approveStatus: '待审批',
    pendingStep: 1,
    submitApplyingAt: '2026-04-21T09:15:00.000Z',
    sourceSummary: '合同名称：联软科技年度服务合同；客户：联软科技集团；负责人：张琳；审批状态：待审批；待审批级次：第1级',
    ...overrides,
  };
}

describe('contract review flow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
    pushMock.mockReset();
    replaceMock.mockReset();
    openMock.mockReset();

    mockRoute.path = '/analysis';
    mockRoute.fullPath = '/analysis';
    mockRoute.params = {};
    mockRoute.query = {};

    vi.mocked(contractReviewService.listPendingApprovalContracts).mockReset();
    vi.mocked(contractReviewService.getPendingApprovalContractDetail).mockReset();
    vi.mocked(contractReviewService.createTaskFromContract).mockReset();
    vi.mocked(contractReviewService.listRecentTasks).mockReset();
    vi.mocked(contractReviewService.uploadContract).mockReset();
    vi.mocked(contractReviewService.getTaskDetail).mockReset();
    vi.mocked(contractReviewService.buildArtifactDownloadUrl).mockReset();
    vi.mocked(contractReviewService.listPendingApprovalContracts).mockResolvedValue({
      items: [buildPendingApprovalContractSummary()],
      page: 1,
      pageSize: 15,
      total: 1,
    });
    vi.mocked(contractReviewService.getPendingApprovalContractDetail).mockResolvedValue(
      buildPendingApprovalContractDetail(),
    );
    vi.mocked(contractReviewService.listRecentTasks).mockResolvedValue({ items: [] });

    const authStore = useAuthStore();
    authStore.session = {
      authenticated: true,
      sessionId: 'auth_session_001',
      source: 'password-login',
      expiresAt: '2026-04-07T10:00:00.000Z',
      user: {
        id: 'user_sales_director',
        name: '销售总监',
        roleNames: ['销售总监'],
        channels: ['web-console'],
        organizationIds: ['org_north'],
        departmentIds: ['dept_sales'],
      },
    };
    authStore.capabilities = {
      serviceStatus: 'ONLINE',
      scopeSummary: '测试权限范围',
      roleNames: ['销售总监'],
      channels: ['web-console'],
      domains: ['opportunity-analysis'],
      metrics: ['新增商机金额'],
      dimensions: ['销售负责人'],
      exportAllowed: true,
      exportRowLimit: 1000,
      exportDailyLimit: 3,
      remainingDailyExports: 3,
      historyEnabled: true,
      templateCount: 1,
      dataFreshnessAt: '2026-04-23T09:00:00.000Z',
      visibleMenus: ['analysis-workbench', 'contract-review', 'audit-center', 'ai-model-governance'],
      actionKeys: ['analysis.use', 'contract.review.upload', 'audit.view', 'ai_profile.manage'],
      followUpAllowed: true,
      templateViewAllowed: true,
      contractWorkspaceAllowed: true,
      wecomBotAccessState: 'ALLOWED',
      contractPermissions: {
        uploadAllowed: true,
        crossViewAllowed: false,
        crossDownloadAllowed: false,
      },
    };
    authStore.hydrated = true;
  });

  afterEach(() => {
    resetNavigationTraceState();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('核心收敛模式下左侧导航只展示 AI 配置入口', () => {
    mockRoute.path = '/contract-review';

    const wrapper = mount(AppShell, {
      slots: {
        default: '<div>页面内容</div>',
      },
    });

    expect(wrapper.text()).toContain('AI配置');
    expect(wrapper.text()).not.toContain('智能合同');
    expect(wrapper.text()).not.toContain('智能分析');
    expect(wrapper.text()).not.toContain('经营报表');
    expect(wrapper.find('.shell__group-caption').exists()).toBe(false);
    expect(wrapper.find('.shell__hint').exists()).toBe(false);
    expect(wrapper.find('.shell__sidebar-head').exists()).toBe(true);
    expect(wrapper.find('.shell__brand .shell__collapse-button').exists()).toBe(false);
    expect(wrapper.find('.shell__sidebar-head .shell__collapse-button').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('先上传 .docx 合同，再进入审核详情页查看风险结果。');
  });

  it('合同工作台基础访问被撤销后，左侧导航不应继续展示智能合同入口', () => {
    const authStore = useAuthStore();
    authStore.capabilities = {
      serviceStatus: 'ONLINE',
      scopeSummary: '测试权限范围',
      roleNames: ['销售总监'],
      channels: ['web-console'],
      domains: ['opportunity-analysis'],
      metrics: ['新增商机金额'],
      dimensions: ['销售负责人'],
      exportAllowed: true,
      exportRowLimit: 1000,
      exportDailyLimit: 3,
      remainingDailyExports: 3,
      historyEnabled: true,
      templateCount: 1,
      dataFreshnessAt: '2026-04-23T09:00:00.000Z',
      visibleMenus: ['analysis-workbench'],
      actionKeys: ['analysis.use'],
      followUpAllowed: true,
      templateViewAllowed: true,
      contractWorkspaceAllowed: false,
      wecomBotAccessState: 'ALLOWED',
      contractPermissions: {
        uploadAllowed: false,
        crossViewAllowed: false,
        crossDownloadAllowed: false,
      },
    };

    const wrapper = mount(AppShell, {
      slots: {
        default: '<div>页面内容</div>',
      },
    });

    expect(wrapper.text()).not.toContain('智能合同');
  });

  it('历史查询模板菜单权限不应重新打开旧入口', () => {
    const authStore = useAuthStore();
    authStore.capabilities = {
      ...authStore.capabilities!,
      visibleMenus: ['analysis-workbench', 'template-governance', 'ai-model-governance'],
      actionKeys: ['analysis.use', 'template.manage', 'ai_profile.manage'],
    };

    const wrapper = mount(AppShell, {
      slots: {
        default: '<div>页面内容</div>',
      },
    });

    expect(wrapper.text()).toContain('AI配置');
    expect(wrapper.text()).not.toContain('智能分析');
    expect(wrapper.text()).not.toContain('查询模板');
    expect(wrapper.text()).not.toContain('查询模版');
  });

  it('经营报表导航必须同时具备菜单和查看动作才展示', () => {
    const authStore = useAuthStore();
    authStore.capabilities = {
      serviceStatus: 'ONLINE',
      scopeSummary: '测试权限范围',
      roleNames: ['销售总监'],
      channels: ['web-console'],
      domains: ['opportunity-analysis'],
      metrics: ['新增商机金额'],
      dimensions: ['销售负责人'],
      exportAllowed: false,
      exportRowLimit: 1000,
      exportDailyLimit: 3,
      remainingDailyExports: 3,
      historyEnabled: true,
      templateCount: 1,
      dataFreshnessAt: '2026-04-23T09:00:00.000Z',
      visibleMenus: ['analysis-workbench'],
      actionKeys: ['analysis.use', 'management.report.view'],
      followUpAllowed: true,
      templateViewAllowed: true,
      contractWorkspaceAllowed: false,
      wecomBotAccessState: 'ALLOWED',
      contractPermissions: {
        uploadAllowed: false,
        crossViewAllowed: false,
        crossDownloadAllowed: false,
      },
    };

    const wrapper = mount(AppShell, {
      slots: {
        default: '<div>页面内容</div>',
      },
    });

    expect(wrapper.text()).not.toContain('经营报表');
  });

  it('连接策略在核心收敛模式下不展示导航入口', () => {
    const authStore = useAuthStore();
    authStore.capabilities = {
      serviceStatus: 'ONLINE',
      scopeSummary: '测试权限范围',
      roleNames: ['系统管理员'],
      channels: ['web-console'],
      domains: [],
      metrics: [],
      dimensions: [],
      exportAllowed: false,
      exportRowLimit: 1000,
      exportDailyLimit: 3,
      remainingDailyExports: 3,
      historyEnabled: true,
      templateCount: 1,
      dataFreshnessAt: '2026-04-23T09:00:00.000Z',
      visibleMenus: ['connection-policy'],
      actionKeys: [],
      followUpAllowed: false,
      templateViewAllowed: false,
      contractWorkspaceAllowed: false,
      wecomBotAccessState: 'ROLE_NOT_ENABLED',
      contractPermissions: {
        uploadAllowed: false,
        crossViewAllowed: false,
        crossDownloadAllowed: false,
      },
    };

    const wrapperWithoutAction = mount(AppShell, {
      slots: {
        default: '<div>页面内容</div>',
      },
    });
    expect(wrapperWithoutAction.text()).not.toContain('连接策略');

    authStore.capabilities = {
      ...authStore.capabilities,
      actionKeys: ['governance.policy.manage'],
    };

    const wrapperWithAction = mount(AppShell, {
      slots: {
        default: '<div>页面内容</div>',
      },
    });
    expect(wrapperWithAction.text()).not.toContain('连接策略');
  });

  it('侧栏顶部工具位按钮应切换导航收起状态', async () => {
    const wrapper = mount(AppShell, {
      slots: {
        default: '<div>页面内容</div>',
      },
    });

    const collapseButton = wrapper.get('.shell__sidebar-head .shell__collapse-button');
    const collapseTrigger = wrapper.get('.shell__sidebar-head');

    expect(wrapper.classes()).not.toContain('shell--collapsed');
    expect(collapseButton.attributes('aria-hidden')).toBe('true');
    expect(collapseTrigger.attributes('aria-label')).toBe('收起导航');

    await collapseTrigger.trigger('click');

    expect(wrapper.classes()).toContain('shell--collapsed');
    expect(wrapper.get('.shell__sidebar-head').attributes('aria-label')).toBe('展开导航');
  });

  it('侧栏顶部整块区域应支持点击切换导航收起状态', async () => {
    const wrapper = mount(AppShell, {
      slots: {
        default: '<div>页面内容</div>',
      },
    });

    expect(wrapper.classes()).not.toContain('shell--collapsed');

    await wrapper.get('.shell__sidebar-head').trigger('click');

    expect(wrapper.classes()).toContain('shell--collapsed');
  });

  it('审计中心在核心收敛模式下不展示导航入口', () => {
    mockRoute.path = '/audit';

    const wrapper = mount(AppShell, {
      slots: {
        default: '<div>页面内容</div>',
      },
    });

    expect(wrapper.text()).not.toContain('审计中心');
    expect(wrapper.text()).not.toContain('审计检索中心');
  });

  it('AI配置导航应使用线性芯片图标并保持菜单风格一致', () => {
    mockRoute.path = '/governance/ai-models';

    const wrapper = mount(AppShell, {
      slots: {
        default: '<div>页面内容</div>',
      },
    });

    expect(wrapper.find('.shell__nav-item--active').text()).toBe('AI配置');
    expect(wrapper.findComponent(Cpu).exists()).toBe(true);
  });

  it('应用壳层在菜单切换期间应显示主内容骨架过渡层', async () => {
    const wrapper = mount(AppShell, {
      slots: {
        default: '<div>页面内容</div>',
      },
    });

    beginNavigationTrace('/management-report');
    await nextTick();

    expect(wrapper.find('.shell__main--route-settling').exists()).toBe(true);
    expect(wrapper.find('.shell__route-skeleton').exists()).toBe(true);
  });

  it('退出登录时应保留门户代理参数和当前业务页作为登录后回跳目标', async () => {
    mockRoute.path = '/management-report';
    mockRoute.fullPath = '/management-report?GratuitousProxy=mock';
    mockRoute.query = {
      GratuitousProxy: 'mock',
    };
    const authStore = useAuthStore();
    vi.spyOn(authStore, 'logout').mockResolvedValue(undefined);
    const wrapper = mount(AppShell, {
      slots: {
        default: '<div>页面内容</div>',
      },
    });

    await wrapper.get('.shell__logout').trigger('click');
    await flushPromises();

    expect(replaceMock).toHaveBeenCalledWith({
      name: 'login',
      query: {
        redirect: '/management-report?GratuitousProxy=mock',
        GratuitousProxy: 'mock',
      },
    });
  });

  it('工作台应隐藏兼容补录上传入口，仅保留 CRM 合同主流程', async () => {
    mockRoute.path = '/contract-review';
    vi.mocked(contractReviewService.listRecentTasks).mockResolvedValue({ items: [] });

    const wrapper = mount(ContractReviewWorkbenchPage);
    await flushPromises();

    expect(wrapper.find('.page-header--compact').exists()).toBe(false);
    expect(wrapper.find('.contract-upload-card').exists()).toBe(false);
    expect(wrapper.find('input[type="file"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('兼容补录上传');
    expect(wrapper.text()).toContain('CRM合同列表');
    expect(contractReviewService.uploadContract).not.toHaveBeenCalled();
  });

  it('工作台应默认隐藏最近审核任务区，仅展示 CRM 合同列表与详情抽屉', async () => {
    mockRoute.path = '/contract-review';
    const initialTasks: ContractReviewTaskSummary[] = [
      {
        taskId: 'task_old',
        contractName: '上周修订版合同.docx',
        status: 'COMPLETED',
        overallDecision: 'REVISE',
        reviewBasis: buildReviewBasis(),
        latestResultSummary: '建议修改后签署 · 高风险 1 项 · 中风险 1 项',
        vetoCount: 0,
        highRiskCount: 1,
        mediumRiskCount: 1,
        lowRiskCount: 0,
        createdAt: '2026-04-07T08:00:00.000Z',
      },
    ];
    const updatedTasks: ContractReviewTaskSummary[] = [
      {
        taskId: 'task_new',
        contractName: '待审采购合同.docx',
        status: 'UPLOADED',
        overallDecision: 'REVISE',
        reviewBasis: buildReviewBasis(),
        latestResultSummary: '文件已上传，等待系统完成审核。',
        vetoCount: 0,
        highRiskCount: 0,
        mediumRiskCount: 0,
        lowRiskCount: 0,
        createdAt: '2026-04-07T09:30:00.000Z',
      },
      ...initialTasks,
    ];

    vi.mocked(contractReviewService.listRecentTasks)
      .mockResolvedValueOnce({ items: initialTasks })
      .mockResolvedValueOnce({ items: updatedTasks });
    vi.mocked(contractReviewService.uploadContract).mockResolvedValue({
      taskId: 'task_new',
      status: 'UPLOADED',
      createdAt: '2026-04-07T09:30:00.000Z',
    });

    const wrapper = mount(ContractReviewWorkbenchPage);
    await flushPromises();
    await vi.advanceTimersByTimeAsync(16);
    await flushPromises();

    expect(wrapper.findAll('.contract-task-card')).toHaveLength(0);
    expect(wrapper.text()).not.toContain('最近审核任务');
    expect(wrapper.text()).toContain('联软科技年度服务合同');
    expect(wrapper.find('.contract-detail-drawer').exists()).toBe(true);
    expect(contractReviewService.listRecentTasks).not.toHaveBeenCalled();
    expect(contractReviewService.uploadContract).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('CRM 合同列表应只展示一次合同编号，避免重复编号标签', async () => {
    mockRoute.path = '/contract-review';

    const wrapper = mount(ContractReviewWorkbenchPage);
    await flushPromises();

    const nameCell = wrapper.find('.contract-name-cell');

    expect(nameCell.exists()).toBe(true);
    expect(nameCell.text()).toContain('联软科技年度服务合同');
    expect(nameCell.text()).toContain('HT-2026-001');
    expect(nameCell.text()).not.toContain('编号');
    expect(nameCell.find('.contract-name-cell__meta').exists()).toBe(false);
  });

  it('合同工作台首屏应先加载 CRM 合同列表，最近任务延后一帧再加载', async () => {
    vi.mocked(contractReviewService.listPendingApprovalContracts).mockClear();
    vi.mocked(contractReviewService.listRecentTasks).mockClear();

    mount(ContractReviewWorkbenchPage);
    await flushPromises();

    expect(contractReviewService.listPendingApprovalContracts).toHaveBeenCalledTimes(1);
    expect(contractReviewService.listRecentTasks).toHaveBeenCalledTimes(0);

    await vi.advanceTimersByTimeAsync(16);
    await flushPromises();

    expect(contractReviewService.listRecentTasks).toHaveBeenCalledTimes(0);
  });

  it('详情页应突出风险信息并展示审核依据与执行模式', async () => {
    mockRoute.path = '/contract-review/tasks/task_new';
    mockRoute.params = { taskId: 'task_new' };

    const detail: ContractReviewTaskDetail = {
      taskId: 'task_new',
      contractName: '待审采购合同.docx',
      status: 'COMPLETED',
      latestStageMessage: '审核完成，可查看风险详情。',
      overallDecision: 'REJECT',
      summary: '已提取合同正文并识别出需优先处理的风险问题。',
      reviewBasis: buildReviewBasis(),
      latestResultSummary: '建议修改后再签署 · 一票否决 1 项 · 高风险 1 项',
      vetoCount: 1,
      highRiskCount: 1,
      mediumRiskCount: 0,
      lowRiskCount: 0,
      totalIssueCount: 2,
      createdAt: '2026-04-07T09:30:00.000Z',
      updatedAt: '2026-04-07T09:32:00.000Z',
      completedAt: '2026-04-07T09:32:00.000Z',
      ruleSet: {
        code: 'company-commercial-v1',
        version: '2026.04',
        title: '公司合同审核规则',
        summary: '围绕主体、付款、知识产权和数据边界进行审核。',
      },
      issues: [
        {
          issueId: 'issue_veto',
          title: '知识产权归属不符合公司基线',
          riskLevel: 'HIGH',
          isVeto: true,
          description: '合同将全部知识产权和源代码成果归给甲方，属于一票否决项。',
          suggestion: '将成果使用权与所有权边界改为按交付范围授权，不转移底层知识产权。',
          quote: '正文条款1：知识产权及源代码归甲方独占所有。',
          ruleCode: 'CR-IP-001',
          ruleTitle: '知识产权条款',
          sourceClause: '知识产权与成果归属',
        },
        {
          issueId: 'issue_payment',
          title: '付款条件未绑定验收节点',
          riskLevel: 'HIGH',
          isVeto: false,
          description: '付款节点过早，且未与验收通过挂钩，存在回款风险。',
          suggestion: '调整为验收通过并收到发票后再触发付款。',
          quote: '正文条款2：甲方收到发票后 5 个工作日内支付全部服务费。',
          ruleCode: 'CR-PAY-001',
          ruleTitle: '付款条款',
          sourceClause: '付款与验收',
        },
      ],
      artifacts: [
        {
          artifactId: 'artifact_report',
          artifactType: 'REPORT',
          fileName: '审核报告.md',
          status: 'AVAILABLE',
          reviewBasis: buildReviewBasis(),
        },
        {
          artifactId: 'artifact_annotated',
          artifactType: 'ANNOTATED_DOCX',
          fileName: '带批注合同.docx',
          status: 'FAILED',
          failureReason: '批注稿生成失败，请稍后重试。',
          reviewBasis: buildReviewBasis(),
        },
      ],
    };

    vi.mocked(contractReviewService.getTaskDetail).mockResolvedValue(detail);
    vi.mocked(contractReviewService.buildArtifactDownloadUrl).mockReturnValue(
      'http://127.0.0.1:3001/api/v1/contract-reviews/tasks/task_new/artifacts/artifact_report/download',
    );

    const wrapper = mount(ContractReviewDetailPage);
    await flushPromises();

    expect(contractReviewService.getTaskDetail).toHaveBeenCalledWith('task_new');
    expect(wrapper.find('.page-header--compact').exists()).toBe(false);
    expect(wrapper.find('.contract-review-decision').text()).not.toContain('智能合同审核结果');
    expect(wrapper.find('.contract-review-decision').text()).not.toContain('待审采购合同.docx');
    expect(wrapper.find('.contract-review-decision').text()).not.toContain('返回首页');
    expect(wrapper.find('.page__eyebrow').exists()).toBe(false);
    expect(wrapper.find('.page__description').exists()).toBe(false);
    expect(wrapper.text()).toContain('需优先处理的一票否决项');
    expect(wrapper.text()).toContain('待处理风险项');
    expect(wrapper.text()).toContain('知识产权归属不符合公司基线');
    expect(wrapper.text()).toContain('付款条件未绑定验收节点');
    expect(wrapper.text()).toContain('已完成');
    expect(wrapper.text()).not.toContain('COMPLETED');
    expect(wrapper.text()).toContain('审核标准：公司合同审核规则 v2026.04');
    expect(wrapper.text()).toContain('执行模式：AI 规则提示词审核');
    expect(wrapper.text()).toContain('结果来源：AI 根据审核规则提示词与合同上下文生成');
    expect(wrapper.text()).not.toContain('规则编码：CR-PAY-001');
    expect(wrapper.find('.contract-review-risk-panel__subtitle').exists()).toBe(false);

    const toggleButton = wrapper
      .findAll('button')
      .find((button) => button.text() === '查看依据');
    expect(toggleButton).toBeDefined();
    await toggleButton!.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('规则编码：CR-PAY-001');
    expect(wrapper.text()).toContain('审核标准版本：v2026.04');

    const reportButton = wrapper
      .findAll('button')
      .find((button) => button.text() === '下载审核报告');
    expect(reportButton).toBeDefined();
    expect(wrapper.text()).not.toContain('下载批注稿');

    await reportButton!.trigger('click');
    expect(contractReviewService.buildArtifactDownloadUrl).toHaveBeenCalledWith(
      'task_new',
      'artifact_report',
    );
    expect(openMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3001/api/v1/contract-reviews/tasks/task_new/artifacts/artifact_report/download',
      '_blank',
    );
  });

  it('降级模式任务应显式提示规则快审说明', async () => {
    mockRoute.path = '/contract-review/tasks/task_degraded';
    mockRoute.params = { taskId: 'task_degraded' };

    vi.mocked(contractReviewService.getTaskDetail).mockResolvedValue({
      taskId: 'task_degraded',
      contractName: '待审商务合同.docx',
      status: 'COMPLETED',
      latestStageMessage: '审核完成，本次结果为降级初筛。',
      overallDecision: 'REVISE',
      summary: '当前结果仅用于初筛，请结合原文复核。',
      reviewBasis: buildReviewBasis({
        executionMode: 'DETERMINISTIC_ONLY',
        degradationReason: 'AI 审核暂不可用，当前结果仅基于确定性规则生成。',
      }),
      latestResultSummary: '降级快审 · 建议修改后再签署 · 高风险 1 项',
      vetoCount: 0,
      highRiskCount: 1,
      mediumRiskCount: 0,
      lowRiskCount: 0,
      totalIssueCount: 1,
      createdAt: '2026-04-07T10:00:00.000Z',
      updatedAt: '2026-04-07T10:05:00.000Z',
      completedAt: '2026-04-07T10:05:00.000Z',
      ruleSet: {
        code: 'company-commercial-v1',
        version: '2026.04',
        title: '公司合同审核规则',
        summary: '围绕主体、付款、知识产权和数据边界进行审核。',
      },
      issues: [],
      artifacts: [],
    });

    const wrapper = mount(ContractReviewDetailPage);
    await flushPromises();

    expect(wrapper.text()).toContain('降级审核说明');
    expect(wrapper.text()).toContain('规则快审');
    expect(wrapper.text()).toContain('AI 审核暂不可用，当前结果仅基于确定性规则生成。');
  });

  it('历史任务兼容回填后的审核依据应可正常展示', async () => {
    mockRoute.path = '/contract-review/tasks/task_legacy';
    mockRoute.params = { taskId: 'task_legacy' };

    vi.mocked(contractReviewService.getTaskDetail).mockResolvedValue({
      taskId: 'task_legacy',
      contractName: '历史合同版本.docx',
      status: 'COMPLETED',
      latestStageMessage: '审核完成，可查看历史风险详情。',
      overallDecision: 'REVISE',
      summary: '该任务来自旧版本审核记录，已完成兼容映射。',
      reviewBasis: buildReviewBasis({
        packVersion: '2026.03',
        packChecksum: 'legacy',
        packChecksumSummary: 'legacy',
        modelProfile: 'unknown',
      }),
      latestResultSummary: '建议修改后再签署 · 高风险 1 项',
      vetoCount: 0,
      highRiskCount: 1,
      mediumRiskCount: 0,
      lowRiskCount: 0,
      totalIssueCount: 1,
      createdAt: '2026-03-31T09:00:00.000Z',
      updatedAt: '2026-03-31T09:10:00.000Z',
      completedAt: '2026-03-31T09:10:00.000Z',
      ruleSet: {
        code: 'company-commercial-v1',
        version: '2026.03',
        title: '历史合同审核规则',
        summary: '旧版规则快照。',
      },
      issues: [
        {
          issueId: 'issue_legacy',
          title: '账期超过历史标准',
          riskLevel: 'HIGH',
          isVeto: false,
          description: '历史记录中识别到账期超过允许阈值。',
          suggestion: '将验收款账期调整回标准范围内。',
          quote: '正文条款5：验收后 45 日付款。',
          ruleCode: 'CR-PAY-LEGACY',
          ruleTitle: '账期条款',
          sourceClause: '付款与回款',
        },
      ],
      artifacts: [],
    });

    const wrapper = mount(ContractReviewDetailPage);
    await flushPromises();

    expect(wrapper.text()).toContain('审核标准：历史合同审核规则 v2026.03');
    expect(wrapper.text()).toContain('执行模式：AI 规则提示词审核');
    const toggleButton = wrapper
      .findAll('button')
      .find((button) => button.text() === '查看依据');
    expect(toggleButton).toBeDefined();
    await toggleButton!.trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('审核标准版本：v2026.03');
    expect(wrapper.text()).not.toContain('仅供初筛');
  });

  it('AI è¡¥å……å®¡æ ¸è¿›è¡Œä¸­æ—¶åº”ç»§ç»­è½®è¯¢å¹¶ä¿æŒå½“å‰ç»“æžœå±•ç¤º', async () => {
    vi.useFakeTimers();
    mockRoute.path = '/contract-review/tasks/task_supplemental_running';
    mockRoute.params = { taskId: 'task_supplemental_running' };

    vi.mocked(contractReviewService.getTaskDetail)
      .mockResolvedValueOnce({
        taskId: 'task_supplemental_running',
        contractName: 'è¡¥å……å®¡æ ¸åˆåŒ.docx',
        status: 'COMPLETED',
        latestStageMessage: 'è§„åˆ™å¿«å®¡å·²å®Œæˆ',
        overallDecision: 'REVISE',
        summary: 'å…ˆè¡Œå±•ç¤ºè§„åˆ™å¿«å®¡ç»“æžœã€‚',
        reviewBasis: buildReviewBasis({
          executionMode: 'DETERMINISTIC_ONLY',
        }),
        latestResultSummary: 'è§„åˆ™å¿«å®¡ Â· å»ºè®®ä¿®æ”¹åŽå†ç­¾ç½² Â· é«˜é£Žé™© 1 é¡¹',
        vetoCount: 0,
        highRiskCount: 1,
        mediumRiskCount: 0,
        lowRiskCount: 0,
        totalIssueCount: 1,
        supplementalReviewStatus: 'RUNNING',
        supplementalReviewMessage: 'AI è¡¥å……å®¡æ ¸ä¸­ï¼Œå½“å‰å…ˆå±•ç¤ºè§„åˆ™å¿«å®¡ç»“æžœã€‚',
        createdAt: '2026-04-10T08:00:00.000Z',
        updatedAt: '2026-04-10T08:00:10.000Z',
        completedAt: '2026-04-10T08:00:10.000Z',
        ruleSet: {
          code: 'company-commercial-v1',
          version: '2026.04',
          title: 'å…¬å¸åˆåŒå®¡æ ¸è§„åˆ™',
          summary: 'å›´ç»•ä¸»ä½“ã€ä»˜æ¬¾ã€çŸ¥è¯†äº§æƒå’Œæ•°æ®è¾¹ç•Œè¿›è¡Œå®¡æ ¸ã€‚',
        },
        issues: [],
        artifacts: [],
      })
      .mockResolvedValue({
        taskId: 'task_supplemental_running',
        contractName: 'è¡¥å……å®¡æ ¸åˆåŒ.docx',
        status: 'COMPLETED',
        latestStageMessage: 'AI è¡¥å……å®¡æ ¸å·²å®Œæˆ',
        overallDecision: 'REVISE',
        summary: 'AI è¡¥å……å®¡æ ¸å·²æ›´æ–°ã€‚',
        reviewBasis: buildReviewBasis(),
        latestResultSummary: 'å»ºè®®ä¿®æ”¹åŽå†ç­¾ç½² Â· é«˜é£Žé™© 1 é¡¹',
        vetoCount: 0,
        highRiskCount: 1,
        mediumRiskCount: 0,
        lowRiskCount: 0,
        totalIssueCount: 1,
        supplementalReviewStatus: 'COMPLETED',
        supplementalReviewMessage: 'AI è¡¥å……å®¡æ ¸å·²å®Œæˆï¼Œæœªæ–°å¢žé£Žé™©é¡¹ã€‚',
        supplementalCompletedAt: '2026-04-10T08:00:15.000Z',
        createdAt: '2026-04-10T08:00:00.000Z',
        updatedAt: '2026-04-10T08:00:15.000Z',
        completedAt: '2026-04-10T08:00:10.000Z',
        ruleSet: {
          code: 'company-commercial-v1',
          version: '2026.04',
          title: 'å…¬å¸åˆåŒå®¡æ ¸è§„åˆ™',
          summary: 'å›´ç»•ä¸»ä½“ã€ä»˜æ¬¾ã€çŸ¥è¯†äº§æƒå’Œæ•°æ®è¾¹ç•Œè¿›è¡Œå®¡æ ¸ã€‚',
        },
        issues: [],
        artifacts: [],
      });

    const wrapper = mount(ContractReviewDetailPage);
    await flushPromises();

    expect(wrapper.text()).toContain('AI è¡¥å……å®¡æ ¸ä¸­');
    expect(wrapper.text()).toContain('AI è¡¥å……å®¡æ ¸ä¸­ï¼Œå½“å‰å…ˆå±•ç¤ºè§„åˆ™å¿«å®¡ç»“æžœã€‚');

    await vi.advanceTimersByTimeAsync(5000);
    await flushPromises();

    expect(contractReviewService.getTaskDetail).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).not.toContain('AI è¡¥å……å®¡æ ¸ä¸­');
  });
});

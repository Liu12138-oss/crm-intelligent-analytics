import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import ContractReviewWorkbenchPage from '@/pages/contract-review/ContractReviewWorkbenchPage.vue';
import { contractReviewService } from '@/services/contract-review.service';
import { useAuthStore } from '@/stores/auth.store';
import type {
  ContractReviewSourceContractDetail,
  ContractReviewSourceContractSummary,
} from '@/types/contract-review';

const pushMock = vi.fn();
const replaceMock = vi.fn();
const mockRoute = {
  path: '/contract-review',
  params: {} as Record<string, string>,
  query: {} as Record<string, string>,
};

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
  },
}));

/**
 * 刷新 Promise 与 Vue 更新队列，确保异步渲染在断言前完成。
 *
 * @returns 无返回值
 */
async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await nextTick();
  await Promise.resolve();
  await nextTick();
}

/**
 * 生成待审批合同列表样例，覆盖工作台表格展示字段。
 *
 * @param overrides 需要覆盖的合同摘要字段
 * @returns 合同摘要样例
 */
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

/**
 * 生成合同详情样例，覆盖详情抽屉与发起审核前校对场景。
 *
 * @param overrides 需要覆盖的合同详情字段
 * @returns 合同详情样例
 */
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
    sourceSummary:
      '合同名称：联软科技年度服务合同；客户：联软科技集团；负责人：张琳；审批状态：待审批；待审级次：第 1 级。',
    ...overrides,
  };
}

describe('contract review crm source flow', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    pushMock.mockReset();
    replaceMock.mockReset();

    vi.mocked(contractReviewService.listPendingApprovalContracts).mockReset();
    vi.mocked(contractReviewService.getPendingApprovalContractDetail).mockReset();
    vi.mocked(contractReviewService.createTaskFromContract).mockReset();
    vi.mocked(contractReviewService.listRecentTasks).mockReset();
    vi.mocked(contractReviewService.uploadContract).mockReset();

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
      expiresAt: '2026-04-23T18:00:00.000Z',
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

  it('应展示 CRM 待审批合同表格，并在点击合同时打开详情抽屉', async () => {
    const wrapper = mount(ContractReviewWorkbenchPage, {
      global: {
        stubs: {
          ElTimeline: {
            template: '<ol class="el-timeline"><slot /></ol>',
          },
          ElTimelineItem: {
            template: '<li class="el-timeline-item"><slot /></li>',
          },
        },
      },
    });
    await flushPromises();

    expect(contractReviewService.listPendingApprovalContracts).toHaveBeenCalledTimes(1);
    expect(contractReviewService.getPendingApprovalContractDetail).toHaveBeenCalledWith(
      'con_pending_001',
    );
    expect(wrapper.text()).toContain('CRM合同列表');
    expect(wrapper.text()).toContain('联软科技年度服务合同');
    expect(wrapper.text()).toContain('HT-2026-001');
    expect(wrapper.text()).not.toContain('审批历史');
    expect(wrapper.find('.contract-name-cell .contract-table-actions').exists()).toBe(false);
    expect(wrapper.find('.contract-table-actions').text()).toContain('查看详情');
    expect(wrapper.find('.contract-table-actions').text()).toContain('发起审核');

    const detailButton = wrapper
      .findAll('.contract-table-actions button')
      .find((button) => button.text().includes('查看详情'));

    expect(detailButton).toBeDefined();

    await detailButton!.trigger('click');
    await flushPromises();

    const drawer = wrapper.findComponent({ name: 'ElDrawer' });
    expect(drawer.props('modelValue')).toBe(true);
    expect(drawer.props('size')).toBe('680px');
    expect(wrapper.text()).toContain('审批历史');
    expect(wrapper.text()).toContain('请重点核对付款账期和知识产权归属');
    expect(wrapper.find('[data-test="contract-special-terms"]').exists()).toBe(true);
    expect(wrapper.find('.contract-approval-timeline').exists()).toBe(true);
    expect(wrapper.findAll('.contract-approval-timeline .el-timeline-item')).toHaveLength(1);
    expect(wrapper.find('[data-test="contract-audit-steps"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-test="contract-audit-step"]')).toHaveLength(3);
  });

  it('关闭详情抽屉后应清空当前合同详情状态', async () => {
    const wrapper = mount(ContractReviewWorkbenchPage);
    await flushPromises();

    const detailButton = wrapper
      .findAll('.contract-table-actions button')
      .find((button) => button.text().includes('查看详情'));

    expect(detailButton).toBeDefined();

    await detailButton!.trigger('click');
    await flushPromises();

    wrapper.findComponent({ name: 'ElDrawer' }).vm.$emit('update:modelValue', false);
    await flushPromises();

    expect(wrapper.findComponent({ name: 'ElDrawer' }).props('modelValue')).toBe(false);
    expect(wrapper.text()).not.toContain('审批历史');
  });

  it('点击发起审核后应基于合同 ID 创建任务并跳转详情页', async () => {
    vi.mocked(contractReviewService.createTaskFromContract).mockResolvedValue({
      taskId: 'task_from_contract',
      status: 'UPLOADED',
      createdAt: '2026-04-23T09:30:00.000Z',
    });

    const wrapper = mount(ContractReviewWorkbenchPage);
    await flushPromises();

    const reviewButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('发起审核'));

    expect(reviewButton).toBeDefined();

    await reviewButton!.trigger('click');
    await flushPromises();

    expect(contractReviewService.createTaskFromContract).toHaveBeenCalledWith(
      'con_pending_001',
    );
    expect(pushMock).toHaveBeenCalledWith({
      name: 'contract-review-detail',
      params: { taskId: 'task_from_contract' },
    });
  });

  it('合同列表应支持分页切换并保留已缓存的合同详情', async () => {
    const pagedContracts = Array.from({ length: 16 }, (_, index) => {
      const serial = String(index + 1).padStart(3, '0');

      return buildPendingApprovalContractSummary({
        contractId: `con_pending_${serial}`,
        contractCode: `HT-2026-${serial}`,
        contractName: `分页合同 ${serial}`,
      });
    });

    vi.mocked(contractReviewService.listPendingApprovalContracts)
      .mockResolvedValueOnce({
        items: pagedContracts.slice(0, 15),
        page: 1,
        pageSize: 15,
        total: pagedContracts.length,
      })
      .mockResolvedValueOnce({
        items: pagedContracts.slice(15),
        page: 2,
        pageSize: 15,
        total: pagedContracts.length,
      });
    vi.mocked(contractReviewService.getPendingApprovalContractDetail).mockResolvedValue(
      buildPendingApprovalContractDetail({
        contractId: 'con_pending_001',
        contractCode: 'HT-2026-001',
        contractName: '分页合同 001',
      }),
    );

    const wrapper = mount(ContractReviewWorkbenchPage);
    await flushPromises();

    expect(wrapper.text()).not.toContain('分页合同 016');

    wrapper.findComponent({ name: 'ElPagination' }).vm.$emit('current-change', 2);
    await flushPromises();

    expect(wrapper.text()).toContain('分页合同 016');
    expect(contractReviewService.listPendingApprovalContracts).toHaveBeenNthCalledWith(2, 2, 15);
    expect(contractReviewService.getPendingApprovalContractDetail).toHaveBeenCalledTimes(2);
  });
});

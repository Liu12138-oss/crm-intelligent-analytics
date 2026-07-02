import { NotFoundException } from '@nestjs/common';
import type {
  PendingApprovalContractSourceDetailRecord,
  PendingApprovalContractSourceRecord,
} from '../../../src/database/crm-readonly/crm-readonly.service';
import { ContractReviewCrmSourceService } from '../../../src/modules/contract-review/contract-review.crm-source.service';
import type { CrmUser, ScopeSnapshot } from '../../../src/shared/types/domain';

/**
 * 构造合同列表记录，便于验证 CRM 合同列表作用域过滤。
 * @param overrides 需要覆盖的字段
 * @returns 合同列表记录
 */
function buildContractRecord(
  overrides: Partial<PendingApprovalContractSourceRecord> = {},
): PendingApprovalContractSourceRecord {
  return {
    contractId: 'contract_001',
    contractCode: 'HT-2026-001',
    contractName: '企业服务合同',
    customerName: '示例客户',
    ownerId: 'owner_001',
    ownerName: '张三',
    organizationId: 'org_001',
    departmentId: 'dept_sales',
    departmentName: '销售部',
    totalAmount: 128000,
    approveStatus: '审批中',
    pendingStep: 1,
    submitApplyingAt: '2026-04-24T09:30:00.000Z',
    ...overrides,
  };
}

function buildContractDetailRecord(
  overrides: Partial<PendingApprovalContractSourceDetailRecord> = {},
): PendingApprovalContractSourceDetailRecord {
  const baseRecord = buildContractRecord();
  const finishApproveAt =
    overrides.finishApproveAt ??
    (overrides.pendingStep === 0 ? '2026-04-24T11:30:00.000Z' : undefined);

  return {
    ...baseRecord,
    approvalHistory: [],
    finishApproveAt,
    ...overrides,
  };
}

/**
 * 构造测试用户，覆盖合同审核工作台的最小鉴权字段。
 * @param overrides 需要覆盖的字段
 * @returns CRM 用户
 */
function buildUser(overrides: Partial<CrmUser> = {}): CrmUser {
  return {
    id: 'user_sales_director',
    name: '销售负责人',
    roleIds: ['role_sales_director'],
    roleNames: ['销售负责人'],
    organizationIds: ['org_001'],
    departmentIds: ['dept_sales'],
    ownerIds: [],
    isAdmin: false,
    exportAllowed: true,
    channels: ['web-console'],
    ...overrides,
  };
}

/**
 * 创建带有最小依赖桩的 CRM 合同源服务。
 * @param scopeSnapshot 当前用户作用域
 * @param records CRM 合同列表记录
 * @returns 服务实例及依赖桩
 */
function createService(
  scopeSnapshot: ScopeSnapshot,
  records: PendingApprovalContractSourceRecord[],
  detailRecord: PendingApprovalContractSourceDetailRecord = buildContractDetailRecord(),
  options: {
    allowedActionKeys?: string[];
  } = {},
) {
  const crmReadonlyService = {
    listPendingApprovalContracts: jest.fn().mockResolvedValue({
      items: records,
      page: 1,
      pageSize: 15,
      total: records.length,
    }),
    getPendingApprovalContractDetail: jest.fn().mockResolvedValue(detailRecord),
  };
  const auditEventRepository = {
    create: jest.fn(),
  };
  const userScopeService = {
    resolveScope: jest.fn().mockReturnValue(scopeSnapshot),
  };
  const permissionEnforcementService = {
    ensureVisibleMenu: jest.fn(),
    hasAction: jest.fn((_: CrmUser, actionKey: string) =>
      (options.allowedActionKeys ?? []).includes(actionKey),
    ),
  };

  const service = new ContractReviewCrmSourceService(
    crmReadonlyService as never,
    auditEventRepository as never,
    userScopeService as never,
    permissionEnforcementService as never,
  );

  return {
    service,
    crmReadonlyService,
    permissionEnforcementService,
  };
}

describe('ContractReviewCrmSourceService 合同列表作用域过滤', () => {
  it('owner 为空时应保留同组织下的跨部门合同', async () => {
    const scopeSnapshot: ScopeSnapshot = {
      organizationIds: ['org_001'],
      departmentIds: ['dept_sales'],
      ownerIds: [],
      scopeSummary: '华北组织范围',
    };
    const records = [
      buildContractRecord({
        contractId: 'contract_001',
        ownerId: 'owner_001',
        departmentId: 'dept_sales',
      }),
      buildContractRecord({
        contractId: 'contract_002',
        ownerId: 'owner_002',
        departmentId: 'dept_legal',
        departmentName: '法务部',
      }),
      buildContractRecord({
        contractId: 'contract_003',
        ownerId: 'owner_003',
        organizationId: 'org_002',
        departmentId: 'dept_other',
      }),
    ];
    const { service, crmReadonlyService, permissionEnforcementService } = createService(
      scopeSnapshot,
      records,
    );

    const result = await service.listPendingApprovalContracts(buildUser());

    expect(permissionEnforcementService.ensureVisibleMenu).toHaveBeenCalledTimes(1);
    expect(crmReadonlyService.listPendingApprovalContracts).toHaveBeenCalledWith({
      scopeSnapshot,
      page: 1,
      pageSize: 15,
    });
    expect(result.items.map((item) => item.contractId)).toEqual([
      'contract_001',
      'contract_002',
      'contract_003',
    ]);
    expect(result.total).toBe(records.length);
  });

  it('owner 作用域存在时仍应按 owner 过滤合同', async () => {
    const scopeSnapshot: ScopeSnapshot = {
      organizationIds: ['org_001'],
      departmentIds: ['dept_sales'],
      ownerIds: ['owner_002'],
      scopeSummary: '负责人范围',
    };
    const records = [
      buildContractRecord({
        contractId: 'contract_001',
        ownerId: 'owner_001',
        departmentId: 'dept_sales',
      }),
      buildContractRecord({
        contractId: 'contract_002',
        ownerId: 'owner_002',
        departmentId: 'dept_legal',
        departmentName: '法务部',
      }),
    ];
    const { service, crmReadonlyService } = createService(scopeSnapshot, records);

    const result = await service.listPendingApprovalContracts(
      buildUser({ ownerIds: ['owner_002'] }),
    );

    expect(crmReadonlyService.listPendingApprovalContracts).toHaveBeenCalledWith({
      scopeSnapshot,
      page: 1,
      pageSize: 15,
    });
    expect(result.items.map((item) => item.contractId)).toEqual([
      'contract_001',
      'contract_002',
    ]);
  });

  it('具备查询他人合同权限时，待审批合同列表不应再按本人 owner 收口', async () => {
    const scopeSnapshot: ScopeSnapshot = {
      organizationIds: ['org_001'],
      departmentIds: ['dept_president_office'],
      ownerIds: ['user_assistant'],
      scopeSummary: '助理本人范围',
    };
    const records = [
      buildContractRecord({
        contractId: 'contract_001',
        ownerId: 'owner_001',
        departmentId: 'dept_sales',
      }),
      buildContractRecord({
        contractId: 'contract_002',
        ownerId: 'owner_002',
        departmentId: 'dept_legal',
        departmentName: '法务部',
      }),
    ];
    const { service, crmReadonlyService } = createService(
      scopeSnapshot,
      records,
      buildContractDetailRecord(),
      {
        allowedActionKeys: ['contract.review.cross_view'],
      },
    );

    await service.listPendingApprovalContracts(
      buildUser({
        id: 'user_assistant',
        name: '总裁办助理',
        ownerIds: ['user_assistant'],
      }),
    );

    expect(crmReadonlyService.listPendingApprovalContracts).toHaveBeenCalledWith({
      scopeSnapshot: {
        ...scopeSnapshot,
        ownerIds: [],
      },
      page: 1,
      pageSize: 15,
    });
  });

  it('应用超级管理员全量范围下，待审批合同列表不应按本人 owner 收口', async () => {
    const scopeSnapshot: ScopeSnapshot = {
      organizationIds: ['org_001'],
      departmentIds: [],
      ownerIds: [],
      scopeSource: 'application-super-admin',
      isFullAccess: true,
      fullAccessSource: 'application-super-admin',
      scopeSummary: '当前已开通应用超级管理员授权，可查看全公司数据。',
    };
    const records = [
      buildContractRecord({
        contractId: 'contract_001',
        ownerId: 'owner_001',
        departmentId: 'dept_sales',
      }),
      buildContractRecord({
        contractId: 'contract_002',
        ownerId: 'owner_002',
        departmentId: 'dept_legal',
        departmentName: '法务部',
      }),
    ];
    const { service, crmReadonlyService } = createService(scopeSnapshot, records);

    const result = await service.listPendingApprovalContracts(
      buildUser({
        id: 'user_ceo',
        name: '经营负责人',
        ownerIds: ['user_ceo'],
      }),
    );

    expect(crmReadonlyService.listPendingApprovalContracts).toHaveBeenCalledWith({
      scopeSnapshot,
      page: 1,
      pageSize: 15,
    });
    expect(result.items.map((item) => item.contractId)).toEqual([
      'contract_001',
      'contract_002',
    ]);
  });

  it('应用超级管理员全量范围下，详情允许查看同组织非本人负责的待审批合同', async () => {
    const scopeSnapshot: ScopeSnapshot = {
      organizationIds: ['org_001'],
      departmentIds: [],
      ownerIds: [],
      scopeSource: 'application-super-admin',
      isFullAccess: true,
      fullAccessSource: 'application-super-admin',
      scopeSummary: '当前已开通应用超级管理员授权，可查看全公司数据。',
    };
    const detailRecord = buildContractDetailRecord({
      contractId: 'contract_cross_001',
      ownerId: 'owner_002',
      organizationId: 'org_001',
      pendingStep: 1,
      submitApplyingAt: '2026-05-22T09:00:00.000Z',
    });
    const { service } = createService(
      scopeSnapshot,
      [buildContractRecord()],
      detailRecord,
    );

    const result = await service.getPendingApprovalContractDetail(
      buildUser({
        id: 'user_ceo',
        name: '经营负责人',
        ownerIds: ['user_ceo'],
      }),
      'contract_cross_001',
    );

    expect(result.contractId).toBe('contract_cross_001');
  });

  it('具备查询他人合同权限时，详情允许查看同组织非本人负责的待审批合同', async () => {
    const scopeSnapshot: ScopeSnapshot = {
      organizationIds: ['org_001'],
      departmentIds: ['dept_president_office'],
      ownerIds: ['user_assistant'],
      scopeSummary: '助理本人范围',
    };
    const detailRecord = buildContractDetailRecord({
      contractId: 'contract_cross_001',
      ownerId: 'owner_002',
      organizationId: 'org_001',
      pendingStep: 1,
      submitApplyingAt: '2026-05-22T09:00:00.000Z',
    });
    const { service, crmReadonlyService } = createService(
      scopeSnapshot,
      [buildContractRecord()],
      detailRecord,
      {
        allowedActionKeys: ['contract.review.cross_view'],
      },
    );

    const result = await service.getPendingApprovalContractDetail(
      buildUser({
        id: 'user_assistant',
        name: '总裁办助理',
        ownerIds: ['user_assistant'],
      }),
      'contract_cross_001',
    );

    expect(crmReadonlyService.getPendingApprovalContractDetail).toHaveBeenCalledWith(
      'contract_cross_001',
    );
    expect(result.contractId).toBe('contract_cross_001');
  });

  it('详情或发起审核前若合同已不在待审批中，应拒绝继续访问', async () => {
    const scopeSnapshot: ScopeSnapshot = {
      organizationIds: ['org_001'],
      departmentIds: ['dept_sales'],
      ownerIds: [],
      scopeSummary: '北区销售组织范围',
    };
    const detailRecord = buildContractDetailRecord({
      contractId: 'contract_finished_001',
      pendingStep: 0,
      approveStatus: '审批完成',
    });
    const { service, crmReadonlyService } = createService(
      scopeSnapshot,
      [buildContractRecord()],
      detailRecord,
    );

    await expect(
      service.getPendingApprovalContractDetail(
        buildUser(),
        'contract_finished_001',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(crmReadonlyService.getPendingApprovalContractDetail).toHaveBeenCalledWith(
      'contract_finished_001',
    );
  });
});

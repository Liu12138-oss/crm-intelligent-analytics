import { CrmReadonlyService } from '../../../src/database/crm-readonly/crm-readonly.service';

describe('CrmReadonlyService 合同来源查询', () => {
  it('应兼容数字型合同审批状态并返回稳定文案', () => {
    const service = new CrmReadonlyService({} as never, {} as never, {} as never);
    const summary = (
      service as unknown as {
        mapPendingApprovalContractSummary: (row: {
          id: string | number;
          sn: string | null;
          title: string | null;
          customer_name: string | null;
          user_id: string | number;
          owner_name: string | null;
          organization_id: string | number;
          department_id: string | number | null;
          department_name: string | null;
          total_amount: number | string | null;
          approve_status: string | number | null;
          pending_step: number | string | null;
          submit_applying_at: Date | string | null;
          finish_approve_at: Date | string | null;
        }) => { approveStatus: string };
      }
    ).mapPendingApprovalContractSummary({
      id: 101,
      sn: 'HT-2026-101',
      title: '测试合同',
      customer_name: '测试客户',
      user_id: 11,
      owner_name: '张三',
      organization_id: 9,
      department_id: 3,
      department_name: '商务部',
      total_amount: 98000,
      approve_status: 3,
      pending_step: 1,
      submit_applying_at: '2026-04-24 10:00:00',
      finish_approve_at: null,
    });

    expect(summary.approveStatus).toBe('待审批');
  });

  it('应兼容数字型审批历史状态并避免详情映射抛错', () => {
    const service = new CrmReadonlyService({} as never, {} as never, {} as never);
    const detail = (
      service as unknown as {
        mapPendingApprovalContractDetail: (
          row: {
            id: string | number;
            sn: string | null;
            title: string | null;
            customer_name: string | null;
            opportunity_title: string | null;
            user_id: string | number;
            owner_name: string | null;
            organization_id: string | number;
            department_id: string | number | null;
            department_name: string | null;
            total_amount: number | string | null;
            approve_status: string | number | null;
            pending_step: number | string | null;
            submit_applying_at: Date | string | null;
            finish_approve_at: Date | string | null;
            start_at: Date | string | null;
            end_at: Date | string | null;
            sign_date: Date | string | null;
            customer_signer: string | null;
            our_signer: string | null;
            special_terms: string | null;
          },
          approvalRows: Array<{
            step: number | string | null;
            status: string | number | null;
            user_id: string | number | null;
            approver_name: string | null;
            approve_at: Date | string | null;
            content: string | null;
          }>,
        ) => {
          approveStatus: string;
          approvalHistory: Array<{ status: string }>;
        };
      }
    ).mapPendingApprovalContractDetail(
      {
        id: 101,
        sn: 'HT-2026-101',
        title: '测试合同',
        customer_name: '测试客户',
        opportunity_title: '年度续约',
        user_id: 11,
        owner_name: '张三',
        organization_id: 9,
        department_id: 3,
        department_name: '商务部',
        total_amount: 98000,
        approve_status: 3,
        pending_step: 1,
        submit_applying_at: '2026-04-24 10:00:00',
        finish_approve_at: null,
        start_at: '2026-05-01',
        end_at: '2027-04-30',
        sign_date: '2026-04-20',
        customer_signer: '李四',
        our_signer: '王五',
        special_terms: '账期 30 天',
      },
      [
        {
          step: 1,
          status: 1,
          user_id: 21,
          approver_name: '法务经理',
          approve_at: null,
          content: '请继续补充付款条件',
        },
      ],
    );

    expect(detail.approveStatus).toBe('待审批');
    expect(detail.approvalHistory[0]?.status).toBe('状态1');
  });

  it('应去掉合同列表查询中的待一级审批过滤条件', async () => {
    const service = new CrmReadonlyService({} as never, {} as never, {} as never);
    const queryMock = jest.fn().mockResolvedValue([[]]);
    const originalNodeEnv = process.env.NODE_ENV;

    (service as unknown as { ensurePool: () => Promise<boolean> }).ensurePool =
      jest.fn(async () => true);
    (service as unknown as { pool: { query: typeof queryMock } }).pool = {
      query: queryMock,
    };

    process.env.NODE_ENV = 'development';
    try {
      await service.listPendingApprovalContracts();
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }

    const executedSql = String(queryMock.mock.calls[0]?.[0] ?? '');
    expect(executedSql).not.toContain('c.pending_step = 1');
    expect(executedSql).toContain('c.finish_approve_at IS NULL');
    expect(executedSql).toContain('c.submit_applying_at IS NOT NULL');
  });

  it('应去掉合同详情查询中的待一级审批过滤条件', async () => {
    const service = new CrmReadonlyService({} as never, {} as never, {} as never);
    const queryMock = jest
      .fn()
      .mockResolvedValueOnce([
        [
          {
            id: 101,
            sn: 'HT-2026-101',
            title: '测试合同',
            customer_name: '测试客户',
            opportunity_title: '年度续约',
            user_id: 11,
            owner_name: '张三',
            organization_id: 9,
            department_id: 3,
            department_name: '商务部',
            total_amount: 98000,
            approve_status: 3,
            pending_step: 0,
            submit_applying_at: '2026-04-24 10:00:00',
            finish_approve_at: null,
            start_at: '2026-05-01',
            end_at: '2027-04-30',
            sign_date: '2026-04-20',
            customer_signer: '李四',
            our_signer: '王五',
            special_terms: '账期 30 天',
          },
        ],
      ])
      .mockResolvedValueOnce([[]]);
    const originalNodeEnv = process.env.NODE_ENV;

    (service as unknown as { ensurePool: () => Promise<boolean> }).ensurePool =
      jest.fn(async () => true);
    (service as unknown as { pool: { query: typeof queryMock } }).pool = {
      query: queryMock,
    };

    process.env.NODE_ENV = 'development';
    try {
      await service.getPendingApprovalContractDetail('101');
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }

    const executedSql = String(queryMock.mock.calls[0]?.[0] ?? '');
    expect(executedSql).not.toContain('c.pending_step = 1');
    expect(executedSql).not.toContain('c.finish_approve_at =');
  });
});

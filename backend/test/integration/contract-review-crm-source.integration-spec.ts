import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { ContractReviewCrmSourceService } from '../../src/modules/contract-review/contract-review.crm-source.service';
import { ContractReviewService } from '../../src/modules/contract-review/contract-review.service';
import type {
  ContractReviewCreateTaskResponse,
  ContractReviewSourceContractDetailView,
  ContractReviewSourceContractListResponse,
} from '../../src/modules/contract-review/contract-review.types';
import type { ContractReviewSourceContractSnapshotRecord } from '../../src/shared/types/domain';
import { loginAs } from '../auth-test.helper';
import { createTestApp } from '../test-app';

describe('合同审核 CRM 来源集成', () => {
  let app: INestApplication;
  let crmSourceService: ContractReviewCrmSourceService;
  let contractReviewService: ContractReviewService;

  beforeAll(async () => {
    app = await createTestApp();
    crmSourceService = app.get(ContractReviewCrmSourceService);
    contractReviewService = app.get(ContractReviewService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('应返回待一级审批合同列表', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const listResponse = {
      items: [
        {
          contractId: 'contract_pending_001',
          contractCode: 'HT-2026-001',
          contractName: '测试待审合同',
          customerName: '测试客户',
          ownerName: '张三',
          totalAmount: 128000,
          submitApplyingAt: '2026-04-24T09:30:00.000Z',
          approveStatus: '待1级审批',
          pendingStep: 1,
        },
      ],
      page: 1,
      pageSize: 15,
      total: 1,
    } satisfies ContractReviewSourceContractListResponse;

    const listSpy = jest
      .spyOn(crmSourceService, 'listPendingApprovalContracts')
      .mockResolvedValue(listResponse);

    const response = await request(app.getHttpServer())
      .get('/api/v1/contract-reviews/contracts/pending-approval')
      .set('Cookie', cookies)
      .expect(200);

    expect(listSpy).toHaveBeenCalledWith(expect.anything(), {
      page: 1,
      pageSize: 15,
    });
    expect(response.body).toEqual(listResponse);
  });

  it('应返回待一级审批合同详情', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const detailResponse = {
      contractId: 'contract_pending_001',
      contractCode: 'HT-2026-001',
      contractName: '测试待审合同',
      customerName: '测试客户',
      opportunityTitle: '华东区续约',
      ownerId: 'owner_001',
      ownerName: '张三',
      organizationId: 'org_001',
      departmentId: 'dept_001',
      departmentName: '华东销售一部',
      totalAmount: 128000,
      startAt: '2026-05-01',
      endAt: '2027-04-30',
      signDate: '2026-04-20',
      customerSigner: '李四',
      ourSigner: '王五',
      specialTerms: '账期 30 天',
      specialTermBlocks: ['账期 30 天'],
      approvalComment: '请优先核对付款责任',
      approvalHistory: [
        {
          step: 1,
          status: 'PENDING',
          approverId: 'leader_001',
          approverName: '商务经理',
        },
      ],
      approveStatus: '待1级审批',
      pendingStep: 1,
      submitApplyingAt: '2026-04-24T09:30:00.000Z',
      sourceSummary: '测试待审合同 / 测试客户 / 张三 / 待1级审批',
    } satisfies ContractReviewSourceContractDetailView;

    const detailSpy = jest
      .spyOn(crmSourceService, 'getPendingApprovalContractDetail')
      .mockResolvedValue(detailResponse);

    const response = await request(app.getHttpServer())
      .get('/api/v1/contract-reviews/contracts/contract_pending_001')
      .set('Cookie', cookies)
      .expect(200);

    expect(detailSpy).toHaveBeenCalledWith(expect.anything(), 'contract_pending_001');
    expect(response.body).toEqual(detailResponse);
  });

  it('应基于待一级审批合同创建审核任务', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const contractSnapshot = {
      contractId: 'contract_pending_001',
      contractCode: 'HT-2026-001',
      contractName: '测试待审合同',
      customerName: '测试客户',
      opportunityTitle: '华东区续约',
      ownerId: 'owner_001',
      ownerName: '张三',
      organizationId: 'org_001',
      departmentId: 'dept_001',
      departmentName: '华东销售一部',
      totalAmount: 128000,
      startAt: '2026-05-01',
      endAt: '2027-04-30',
      signDate: '2026-04-20',
      customerSigner: '李四',
      ourSigner: '王五',
      specialTerms: '账期 30 天',
      specialTermBlocks: ['账期 30 天'],
      approvalComment: '请优先核对付款责任',
      approvalHistory: [
        {
          step: 1,
          status: 'PENDING',
          approverId: 'leader_001',
          approverName: '商务经理',
        },
      ],
      approveStatus: '待1级审批',
      pendingStep: 1,
      submitApplyingAt: '2026-04-24T09:30:00.000Z',
      sourceSummary: '测试待审合同 / 测试客户 / 张三 / 待1级审批',
      reviewContent: '合同名称：测试待审合同',
    } satisfies ContractReviewSourceContractSnapshotRecord;
    const createTaskResponse = {
      taskId: 'review_task_001',
      status: 'REVIEWING',
      createdAt: '2026-04-24T10:00:00.000Z',
    } satisfies ContractReviewCreateTaskResponse;

    const snapshotSpy = jest
      .spyOn(crmSourceService, 'getPendingApprovalContractSnapshot')
      .mockResolvedValue(contractSnapshot);
    const createTaskSpy = jest
      .spyOn(contractReviewService, 'createTaskFromCrmContract')
      .mockResolvedValue(createTaskResponse);

    const response = await request(app.getHttpServer())
      .post('/api/v1/contract-reviews/contracts/contract_pending_001/tasks')
      .set('Cookie', cookies)
      .expect(201);

    expect(snapshotSpy).toHaveBeenCalledWith(expect.anything(), 'contract_pending_001');
    expect(createTaskSpy).toHaveBeenCalledWith(expect.anything(), contractSnapshot);
    expect(response.body).toEqual(createTaskResponse);
  });
});

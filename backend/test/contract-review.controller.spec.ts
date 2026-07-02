import type { Request, Response } from 'express';
import { ContractReviewController } from '../src/modules/contract-review/contract-review.controller';

function createResponseMock(): Response {
  const headerStore = new Map<string, string>();
  const responseMock: {
    setHeader: jest.MockedFunction<(name: string, value: string) => unknown>;
    getHeader: jest.MockedFunction<(name: string) => string | undefined>;
    download: jest.MockedFunction<(...args: unknown[]) => unknown>;
  } = {
    setHeader: jest.fn((name: string, value: string) => {
      headerStore.set(name, value);
      return responseMock;
    }),
    getHeader: jest.fn((name: string) => headerStore.get(name)),
    download: jest.fn(),
  };

  return responseMock as unknown as Response;
}

describe('ContractReviewController 缓存控制', () => {
  it('待审批合同列表应返回禁止缓存的响应头，避免不同账号复用旧缓存', () => {
    const contractReviewService = {
      listRecentTasks: jest.fn(),
      getTaskDetail: jest.fn(),
      getArtifactDownload: jest.fn(),
      createTask: jest.fn(),
      createTaskFromCrmContract: jest.fn(),
    };
    const contractReviewCrmSourceService = {
      listPendingApprovalContracts: jest.fn().mockReturnValue({
        items: [],
        page: 2,
        pageSize: 30,
        total: 0,
      }),
      getPendingApprovalContractDetail: jest.fn(),
      getPendingApprovalContractSnapshot: jest.fn(),
    };
    const controller = new ContractReviewController(
      contractReviewService as never,
      contractReviewCrmSourceService as never,
    );
    const request = {
      crmUser: {
        id: 'user_001',
      },
    } as Request & { crmUser: any };
    const response = createResponseMock();

    const result = controller.listPendingApprovalContracts(request, response, '2', '30');

    expect(result).toEqual({
      items: [],
      page: 2,
      pageSize: 30,
      total: 0,
    });
    expect(contractReviewCrmSourceService.listPendingApprovalContracts).toHaveBeenCalledWith(
      request.crmUser,
      {
        page: 2,
        pageSize: 30,
      },
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'private, no-store, no-cache, max-age=0, must-revalidate',
    );
    expect(response.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
    expect(response.setHeader).toHaveBeenCalledWith('Expires', '0');
    expect(response.setHeader).toHaveBeenCalledWith('Surrogate-Control', 'no-store');
    expect(response.setHeader).toHaveBeenCalledWith('Vary', 'Origin, Cookie');
  });

  it('最近审核记录接口也应返回禁止缓存的响应头', () => {
    const contractReviewService = {
      listRecentTasks: jest.fn().mockReturnValue({
        items: [],
      }),
      getTaskDetail: jest.fn(),
      getArtifactDownload: jest.fn(),
      createTask: jest.fn(),
      createTaskFromCrmContract: jest.fn(),
    };
    const contractReviewCrmSourceService = {
      listPendingApprovalContracts: jest.fn(),
      getPendingApprovalContractDetail: jest.fn(),
      getPendingApprovalContractSnapshot: jest.fn(),
    };
    const controller = new ContractReviewController(
      contractReviewService as never,
      contractReviewCrmSourceService as never,
    );
    const request = {
      crmUser: {
        id: 'user_002',
      },
    } as Request & { crmUser: any };
    const response = createResponseMock();

    const result = controller.listRecentTasks(request, response);

    expect(result).toEqual({
      items: [],
    });
    expect(contractReviewService.listRecentTasks).toHaveBeenCalledWith(request.crmUser);
    expect(response.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'private, no-store, no-cache, max-age=0, must-revalidate',
    );
    expect(response.setHeader).toHaveBeenCalledWith('Vary', 'Origin, Cookie');
  });
});

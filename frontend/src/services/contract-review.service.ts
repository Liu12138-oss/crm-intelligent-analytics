import { buildApiUrl, httpClient } from './http-client';
import type {
  ContractReviewCreateTaskResponse,
  ContractReviewSourceContractListResponse,
  ContractReviewSourceContractDetail,
  ContractReviewTaskDetail,
  ContractReviewTaskSummary,
} from '@/types/contract-review';

const CONTRACT_REVIEW_NO_STORE_REQUEST_INIT = {
  cache: 'no-store' as RequestCache,
  headers: {
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  },
};

export const contractReviewService = {
  listPendingApprovalContracts(
    page = 1,
    pageSize = 15,
  ): Promise<ContractReviewSourceContractListResponse> {
    return httpClient.get(
      `/contract-reviews/contracts/pending-approval?page=${page}&pageSize=${pageSize}`,
      CONTRACT_REVIEW_NO_STORE_REQUEST_INIT,
    );
  },

  getPendingApprovalContractDetail(
    contractId: string,
  ): Promise<ContractReviewSourceContractDetail> {
    return httpClient.get(
      `/contract-reviews/contracts/${contractId}`,
      CONTRACT_REVIEW_NO_STORE_REQUEST_INIT,
    );
  },

  createTaskFromContract(
    contractId: string,
  ): Promise<ContractReviewCreateTaskResponse> {
    return httpClient.post(`/contract-reviews/contracts/${contractId}/tasks`);
  },

  listRecentTasks(): Promise<{ items: ContractReviewTaskSummary[] }> {
    return httpClient.get(
      '/contract-reviews/tasks',
      CONTRACT_REVIEW_NO_STORE_REQUEST_INIT,
    );
  },

  uploadContract(file: File): Promise<ContractReviewCreateTaskResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return httpClient.postForm('/contract-reviews/tasks', formData);
  },

  getTaskDetail(taskId: string): Promise<ContractReviewTaskDetail> {
    return httpClient.get(
      `/contract-reviews/tasks/${taskId}`,
      CONTRACT_REVIEW_NO_STORE_REQUEST_INIT,
    );
  },

  buildArtifactDownloadUrl(taskId: string, artifactId: string): string {
    return buildApiUrl(`/contract-reviews/tasks/${taskId}/artifacts/${artifactId}/download`);
  },
};

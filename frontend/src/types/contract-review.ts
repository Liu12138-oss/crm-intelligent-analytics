export type ContractReviewTaskStatus =
  | 'UPLOADED'
  | 'PARSING'
  | 'REVIEWING'
  | 'GENERATING_REPORT'
  | 'COMPLETED'
  | 'FAILED'
  | 'BLOCKED';

export type ContractReviewDecision = 'APPROVE' | 'REVISE' | 'REJECT';

export type ContractReviewArtifactType =
  | 'REPORT'
  | 'ANNOTATED_DOCX'
  | 'STRUCTURED_RESULT';

export type ContractReviewArtifactStatus = 'AVAILABLE' | 'PENDING' | 'FAILED';

export type ContractReviewExecutionMode =
  | 'AI_HYBRID'
  | 'DETERMINISTIC_ONLY'
  | 'BLOCKED';

export type ContractReviewSupplementalReviewStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED';

export type ContractReviewTaskSourceType =
  | 'UPLOAD'
  | 'CRM_PENDING_APPROVAL';

export interface ContractReviewPromptFingerprints {
  planner: string;
  reviewer: string;
  summarizer: string;
}

export interface ContractReviewReviewBasis {
  packCode: string;
  packVersion: string;
  packChecksum: string;
  packChecksumSummary: string;
  modelProfile: string;
  executionMode: ContractReviewExecutionMode;
  degradationReason?: string;
  promptFingerprints?: ContractReviewPromptFingerprints;
}

export interface ContractReviewTaskSummary {
  taskId: string;
  contractName: string;
  sourceType?: ContractReviewTaskSourceType;
  status: ContractReviewTaskStatus;
  overallDecision: ContractReviewDecision;
  reviewBasis: ContractReviewReviewBasis;
  latestResultSummary: string;
  vetoCount: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  supplementalReviewStatus?: ContractReviewSupplementalReviewStatus;
  supplementalReviewMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ContractReviewIssue {
  issueId: string;
  title: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  isVeto: boolean;
  description: string;
  suggestion: string;
  quote: string;
  ruleCode: string;
  ruleTitle: string;
  sourceClause: string;
}

export interface ContractReviewArtifact {
  artifactId: string;
  artifactType: ContractReviewArtifactType;
  fileName: string;
  status: ContractReviewArtifactStatus;
  failureReason?: string;
  reviewBasis: ContractReviewReviewBasis;
}

export interface ContractReviewTaskDetail {
  taskId: string;
  contractName: string;
  sourceType?: ContractReviewTaskSourceType;
  status: ContractReviewTaskStatus;
  latestStageMessage: string;
  overallDecision: ContractReviewDecision;
  summary: string;
  reviewBasis: ContractReviewReviewBasis;
  latestResultSummary: string;
  vetoCount: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  totalIssueCount: number;
  supplementalReviewStatus?: ContractReviewSupplementalReviewStatus;
  supplementalReviewMessage?: string;
  supplementalCompletedAt?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  ruleSet: {
    code: string;
    version: string;
    title: string;
    summary: string;
  };
  issues: ContractReviewIssue[];
  artifacts: ContractReviewArtifact[];
}

export interface ContractReviewCreateTaskResponse {
  taskId: string;
  status: ContractReviewTaskStatus;
  createdAt: string;
}

export interface ContractReviewSourceApprovalRecord {
  step: number;
  status: string;
  approverId?: string;
  approverName?: string;
  approveAt?: string;
  comment?: string;
}

export interface ContractReviewSourceContractSummary {
  contractId: string;
  contractCode?: string;
  contractName: string;
  customerName?: string;
  ownerName: string;
  totalAmount: number;
  submitApplyingAt?: string;
  approveStatus: string;
  pendingStep: number;
}

export interface ContractReviewSourceContractDetail {
  contractId: string;
  contractCode?: string;
  contractName: string;
  customerName?: string;
  opportunityTitle?: string;
  ownerId: string;
  ownerName: string;
  organizationId: string;
  departmentId?: string;
  departmentName?: string;
  totalAmount: number;
  startAt?: string;
  endAt?: string;
  signDate?: string;
  customerSigner?: string;
  ourSigner?: string;
  specialTerms?: string;
  specialTermBlocks: string[];
  approvalComment?: string;
  approvalHistory: ContractReviewSourceApprovalRecord[];
  approveStatus: string;
  pendingStep: number;
  submitApplyingAt?: string;
  sourceSummary: string;
}

export interface ContractReviewSourceContractListResponse {
  items: ContractReviewSourceContractSummary[];
  page: number;
  pageSize: number;
  total: number;
}

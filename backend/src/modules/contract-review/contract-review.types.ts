import type {
  AiEntryTargetWorkflow,
  ContractReviewArtifactStatus,
  ContractReviewArtifactType,
  ContractReviewDecision,
  ContractReviewSourceApprovalRecord,
  ContractReviewSourceContractSnapshotRecord,
  ContractReviewReviewBasisRecord,
  ContractReviewSupplementalReviewStatus,
  ContractReviewTaskSourceType,
  ContractReviewTaskStatus,
  RiskLevel,
} from '../../shared/types/domain';

export interface UploadedContractFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface ContractReviewDocumentFragment {
  index: number;
  text: string;
  locator: string;
  source: 'document' | 'header' | 'footer';
  style?: string;
}

export interface ContractReviewDocumentSnapshot {
  title: string;
  summary: string;
  fullText: string;
  paragraphs: ContractReviewDocumentFragment[];
  headings: ContractReviewDocumentFragment[];
  clauses: ContractReviewDocumentFragment[];
}

export interface ContractReviewTaskSummaryView {
  taskId: string;
  contractName: string;
  sourceType?: ContractReviewTaskSourceType;
  status: ContractReviewTaskStatus;
  overallDecision: ContractReviewDecision;
  reviewBasis: ContractReviewReviewBasisRecord;
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

export interface ContractReviewIssueView {
  issueId: string;
  title: string;
  riskLevel: RiskLevel;
  isVeto: boolean;
  description: string;
  suggestion: string;
  quote: string;
  ruleCode: string;
  ruleTitle: string;
  sourceClause: string;
}

export interface ContractReviewArtifactView {
  artifactId: string;
  artifactType: ContractReviewArtifactType;
  fileName: string;
  status: ContractReviewArtifactStatus;
  failureReason?: string;
  reviewBasis: ContractReviewReviewBasisRecord;
}

export interface ContractReviewNaturalLanguageEntryCapability {
  status: 'RESERVED';
  aiEntryRequired: true;
  targetWorkflow: AiEntryTargetWorkflow;
  fixedPrecheckSteps: string[];
}

export interface ContractReviewTaskDetailView {
  taskId: string;
  contractName: string;
  sourceType?: ContractReviewTaskSourceType;
  status: ContractReviewTaskStatus;
  latestStageMessage: string;
  overallDecision: ContractReviewDecision;
  summary: string;
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
  reviewBasis: ContractReviewReviewBasisRecord;
  naturalLanguageEntryCapability: ContractReviewNaturalLanguageEntryCapability;
  ruleSet: {
    code: string;
    version: string;
    title: string;
    summary: string;
  };
  issues: ContractReviewIssueView[];
  artifacts: ContractReviewArtifactView[];
}

export interface ContractReviewCreateTaskResponse {
  taskId: string;
  status: ContractReviewTaskStatus;
  createdAt: string;
}

export interface ContractReviewSourceContractSummaryView {
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

export interface ContractReviewSourceContractDetailView {
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
  items: ContractReviewSourceContractSummaryView[];
  page: number;
  pageSize: number;
  total: number;
}

export type ContractReviewSourceContractSnapshotPayload =
  ContractReviewSourceContractSnapshotRecord;

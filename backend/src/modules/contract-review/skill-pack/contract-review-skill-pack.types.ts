import type { RiskLevel } from '../../../shared/types/domain';

export type ContractReviewSkillPackExecutionMode =
  | 'AI_HYBRID'
  | 'DETERMINISTIC_ONLY';

export interface ContractReviewSkillPackProfile {
  code: string;
  version: string;
  title: string;
  summary: string;
  issuedAt: string;
  requirementsFile: string;
  workflowFile: string;
  checksFile: string;
  plannerPromptFile: string;
  reviewerPromptFile: string;
  summarizerPromptFile: string;
  defaultExecutionMode: ContractReviewSkillPackExecutionMode;
  defaultModelProfile: string;
  applicableContractTypes: string[];
  deterministicValidators: string[];
}

export interface ContractReviewSkillPackCheck {
  code: string;
  group: string;
  category: string;
  title: string;
  description: string;
  riskLevel: RiskLevel;
  isVeto: boolean;
  sourceClause: string;
  keywords: string[];
  suggestion: string;
  applicableContractTypes: string[];
  validatorBindings: string[];
}

export interface ContractReviewSkillPackPromptSet {
  planner: string;
  reviewer: string;
  summarizer: string;
}

export interface ContractReviewSkillPackFileSet {
  profile: string;
  requirements: string;
  workflow: string;
  checks: string;
  plannerPrompt: string;
  reviewerPrompt: string;
  summarizerPrompt: string;
}

export interface ContractReviewSkillPack {
  rootDir: string;
  files: ContractReviewSkillPackFileSet;
  code: string;
  version: string;
  title: string;
  summary: string;
  issuedAt: string;
  requirements: string;
  workflow: string;
  prompts: ContractReviewSkillPackPromptSet;
  checks: ContractReviewSkillPackCheck[];
  defaultExecutionMode: ContractReviewSkillPackExecutionMode;
  defaultModelProfile: string;
  applicableContractTypes: string[];
  deterministicValidators: string[];
  checksum: string;
  checksumSummary: string;
}

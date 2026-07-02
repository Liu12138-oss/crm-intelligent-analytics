import type { RiskLevel } from '../../shared/types/domain';
import type { ContractReviewSkillPackExecutionMode } from './skill-pack/contract-review-skill-pack.types';

export type ContractReviewExecutionMode =
  | ContractReviewSkillPackExecutionMode
  | 'BLOCKED';

export interface ContractReviewPromptFingerprintSet {
  planner: string;
  reviewer: string;
  summarizer: string;
}

export interface ContractReviewCompiledCheck {
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

export interface ContractReviewCheckGroupSnapshot {
  group: string;
  checkCodes: string[];
}

export interface ContractReviewSkillPackSnapshot {
  packCode: string;
  packVersion: string;
  packTitle: string;
  packSummary: string;
  packChecksum: string;
  packChecksumSummary: string;
  compiledAt: string;
  executionMode: ContractReviewExecutionMode;
  modelProfile: string;
  selectedContractTypes: string[];
  promptFingerprints: ContractReviewPromptFingerprintSet;
  deterministicValidators: string[];
  checkCount: number;
  groups: ContractReviewCheckGroupSnapshot[];
  checks: ContractReviewCompiledCheck[];
}

export interface ContractReviewFactLocator {
  locator: string;
  text: string;
}

export interface ContractReviewAmountFact extends ContractReviewFactLocator {
  label: string;
  amount: number;
  currency: 'CNY';
}

export interface ContractReviewTaxRateFact extends ContractReviewFactLocator {
  taxRate: number;
  kind: 'PRODUCT' | 'SERVICE' | 'UNKNOWN';
}

export interface ContractReviewPaymentFact extends ContractReviewFactLocator {
  stage: string;
  days?: number;
  percentage?: number;
}

export interface ContractReviewDiscountFact extends ContractReviewFactLocator {
  discountRatePercent: number;
  expression: string;
}

export interface ContractReviewPenaltyFact extends ContractReviewFactLocator {
  dailyRatePermille?: number;
  capPercent?: number;
  unlimitedLiability: boolean;
}

export interface ContractReviewInvoiceFact extends ContractReviewFactLocator {
  invoiceType: 'VAT_SPECIAL' | 'VAT_NORMAL' | 'UNKNOWN';
  invoiceName?: string;
  hasSoftwarePrefix: boolean;
}

export interface ContractReviewIntellectualPropertyFact extends ContractReviewFactLocator {
  ownership: 'PARTY_A' | 'PARTY_B' | 'SHARED' | 'UNKNOWN';
  hasExclusiveLanguage: boolean;
  allowsReverseEngineering: boolean;
}

export interface ContractReviewLicenseDeliveryFact extends ContractReviewFactLocator {
  mentionsTemporaryLicense: boolean;
  mentionsPermanentLicense: boolean;
  mentionsFullPaymentRequired: boolean;
  mentionsAdvanceDelivery: boolean;
}

export interface ContractReviewTemplateMatchFact {
  templateCode: string;
  templateLabel: string;
  matched: boolean;
  score: number;
  signals: string[];
}

export type ContractReviewTemplateSlotStatus =
  | 'FILLED'
  | 'PLACEHOLDER'
  | 'MISSING'
  | 'PRESENT'
  | 'AMBIGUOUS';

export interface ContractReviewTemplateSlotFact extends ContractReviewFactLocator {
  templateCode: string;
  slotCode: string;
  slotLabel: string;
  status: ContractReviewTemplateSlotStatus;
  value?: string;
  note?: string;
}

export interface ContractReviewDeterministicIssueCandidate {
  ruleCode: string;
  validatorBinding: string;
  locator: string;
  quote: string;
  reason: string;
  suggestion: string;
  riskLevel: RiskLevel;
  isVeto: boolean;
}

export interface ContractReviewReviewExecutionSummary {
  mode: ContractReviewExecutionMode;
  degradationReason?: string;
  aiIssueCount: number;
  deterministicIssueCount: number;
}

export interface ContractReviewFactExtractionResult {
  extractedAt: string;
  contractTypes: string[];
  amountFacts: ContractReviewAmountFact[];
  taxRateFacts: ContractReviewTaxRateFact[];
  paymentFacts: ContractReviewPaymentFact[];
  discountFacts: ContractReviewDiscountFact[];
  penaltyFacts: ContractReviewPenaltyFact[];
  invoiceFacts: ContractReviewInvoiceFact[];
  intellectualPropertyFacts: ContractReviewIntellectualPropertyFact[];
  licenseDeliveryFacts: ContractReviewLicenseDeliveryFact[];
  templateMatchFacts: ContractReviewTemplateMatchFact[];
  templateSlotFacts: ContractReviewTemplateSlotFact[];
  summary: string;
}

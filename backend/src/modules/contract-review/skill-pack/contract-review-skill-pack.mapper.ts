import type { ContractReviewRuleSetRecord } from '../../../shared/types/domain';
import type { ContractReviewSkillPack } from './contract-review-skill-pack.types';

export function mapSkillPackToRuleSet(
  pack: ContractReviewSkillPack,
): ContractReviewRuleSetRecord {
  return {
    id: `rule_set_${normalizeIdentifier(pack.code)}_${normalizeIdentifier(pack.version)}`,
    code: pack.code,
    version: pack.version,
    title: pack.title,
    summary: pack.summary,
    issuedAt: pack.issuedAt,
    itemCount: pack.checks.length,
    items: pack.checks.map((check) => ({
      code: check.code,
      category: check.category,
      title: check.title,
      description: check.description,
      riskLevel: check.riskLevel,
      isVeto: check.isVeto,
      sourceClause: check.sourceClause,
      keywords: [...check.keywords],
      suggestion: check.suggestion,
    })),
  };
}

function normalizeIdentifier(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
}

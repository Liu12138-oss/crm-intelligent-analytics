import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type {
  ContractReviewFactExtractionResult,
  ContractReviewSkillPackSnapshot,
} from './contract-review.runtime.types';
import type { ContractReviewSkillPack } from './skill-pack/contract-review-skill-pack.types';

@Injectable()
export class ContractReviewSnapshotCompilerService {
  compile(
    pack: ContractReviewSkillPack,
    factExtraction: ContractReviewFactExtractionResult,
    options?: {
      executionModeOverride?: ContractReviewSkillPack['defaultExecutionMode'];
    },
  ): ContractReviewSkillPackSnapshot {
    const selectedContractTypes = this.resolveSelectedContractTypes(pack, factExtraction);
    const executionMode = options?.executionModeOverride ?? pack.defaultExecutionMode;
    const selectedChecks = pack.checks.filter((check) =>
      check.applicableContractTypes.some((contractType) =>
        selectedContractTypes.includes(contractType),
      ),
    );
    const checks = this.filterChecksByExecutionMode(
      selectedChecks.length > 0 ? selectedChecks : pack.checks,
      executionMode,
    );
    const groups = [...new Set(checks.map((check) => check.group))].map((group) => ({
      group,
      checkCodes: checks
        .filter((check) => check.group === group)
        .map((check) => check.code),
    }));

    return {
      packCode: pack.code,
      packVersion: pack.version,
      packTitle: pack.title,
      packSummary: pack.summary,
      packChecksum: pack.checksum,
      packChecksumSummary: pack.checksumSummary,
      compiledAt: new Date().toISOString(),
      executionMode,
      modelProfile: pack.defaultModelProfile,
      selectedContractTypes,
      promptFingerprints: {
        planner: this.fingerprint(pack.prompts.planner),
        reviewer: this.fingerprint(pack.prompts.reviewer),
        summarizer: this.fingerprint(pack.prompts.summarizer),
      },
      deterministicValidators: [...pack.deterministicValidators],
      checkCount: checks.length,
      groups,
      checks: checks.map((check) => ({
        ...check,
        keywords: [...check.keywords],
        applicableContractTypes: [...check.applicableContractTypes],
        validatorBindings: [...check.validatorBindings],
      })),
    };
  }

  private resolveSelectedContractTypes(
    pack: ContractReviewSkillPack,
    factExtraction: ContractReviewFactExtractionResult,
  ): string[] {
    const matchedTypes = factExtraction.contractTypes.filter((contractType) =>
      pack.applicableContractTypes.includes(contractType),
    );

    return matchedTypes.length > 0 ? matchedTypes : [...pack.applicableContractTypes];
  }

  private filterChecksByExecutionMode(
    checks: ContractReviewSkillPack['checks'],
    executionMode: ContractReviewSkillPack['defaultExecutionMode'],
  ): ContractReviewSkillPack['checks'] {
    if (executionMode !== 'DETERMINISTIC_ONLY') {
      return checks;
    }

    return checks.filter((check) => check.validatorBindings.length > 0);
  }

  private fingerprint(content: string): string {
    return createHash('sha256').update(content).digest('hex').slice(0, 12);
  }
}

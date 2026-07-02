import { Injectable } from '@nestjs/common';
import type { ContractReviewRuleSetRecord } from '../../../shared/types/domain';
import { mapSkillPackToRuleSet } from './contract-review-skill-pack.mapper';
import { ContractReviewSkillPackLoader } from './contract-review-skill-pack.loader';
import type { ContractReviewSkillPack } from './contract-review-skill-pack.types';

@Injectable()
export class ContractReviewSkillPackRuntimeService {
  private activePackCache?: ContractReviewSkillPack;
  private activeRuleSetCache?: ContractReviewRuleSetRecord;

  constructor(private readonly loader: ContractReviewSkillPackLoader) {}

  getActivePack(): ContractReviewSkillPack {
    this.ensureActivePackLoaded();
    return this.clonePack(this.activePackCache as ContractReviewSkillPack);
  }

  getActiveRuleSet(): ContractReviewRuleSetRecord {
    this.ensureActivePackLoaded();
    return this.cloneRuleSet(this.activeRuleSetCache as ContractReviewRuleSetRecord);
  }

  reloadActivePack(): ContractReviewSkillPack {
    this.activePackCache = this.loader.loadActivePack();
    this.activeRuleSetCache = mapSkillPackToRuleSet(this.activePackCache);
    return this.clonePack(this.activePackCache);
  }

  private ensureActivePackLoaded(): void {
    if (this.activePackCache && this.activeRuleSetCache) {
      return;
    }

    this.activePackCache = this.loader.loadActivePack();
    this.activeRuleSetCache = mapSkillPackToRuleSet(this.activePackCache);
  }

  private clonePack(pack: ContractReviewSkillPack): ContractReviewSkillPack {
    return {
      ...pack,
      files: { ...pack.files },
      prompts: { ...pack.prompts },
      checks: pack.checks.map((check) => ({
        ...check,
        keywords: [...check.keywords],
        applicableContractTypes: [...check.applicableContractTypes],
        validatorBindings: [...check.validatorBindings],
      })),
      applicableContractTypes: [...pack.applicableContractTypes],
      deterministicValidators: [...pack.deterministicValidators],
    };
  }

  private cloneRuleSet(ruleSet: ContractReviewRuleSetRecord): ContractReviewRuleSetRecord {
    return {
      ...ruleSet,
      items: ruleSet.items.map((item) => ({
        ...item,
        keywords: [...item.keywords],
      })),
    };
  }
}

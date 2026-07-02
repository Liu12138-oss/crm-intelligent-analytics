import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type {
  ContractReviewSkillPack,
  ContractReviewSkillPackCheck,
  ContractReviewSkillPackProfile,
} from './contract-review-skill-pack.types';

const nonEmptyStringSchema = z.string().trim().min(1);

const skillPackProfileSchema = z.object({
  code: nonEmptyStringSchema,
  version: nonEmptyStringSchema,
  title: nonEmptyStringSchema,
  summary: nonEmptyStringSchema,
  issuedAt: nonEmptyStringSchema.datetime({ offset: true }),
  requirementsFile: nonEmptyStringSchema,
  workflowFile: nonEmptyStringSchema,
  checksFile: nonEmptyStringSchema,
  plannerPromptFile: nonEmptyStringSchema,
  reviewerPromptFile: nonEmptyStringSchema,
  summarizerPromptFile: nonEmptyStringSchema,
  defaultExecutionMode: z.enum(['AI_HYBRID', 'DETERMINISTIC_ONLY']),
  defaultModelProfile: nonEmptyStringSchema,
  applicableContractTypes: z.array(nonEmptyStringSchema).min(1),
  deterministicValidators: z.array(nonEmptyStringSchema),
});

const skillPackCheckSchema = z.object({
  code: nonEmptyStringSchema,
  group: nonEmptyStringSchema,
  category: nonEmptyStringSchema,
  title: nonEmptyStringSchema,
  description: nonEmptyStringSchema,
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  isVeto: z.boolean(),
  sourceClause: nonEmptyStringSchema,
  keywords: z.array(nonEmptyStringSchema).min(1),
  suggestion: nonEmptyStringSchema,
  applicableContractTypes: z.array(nonEmptyStringSchema).min(1),
  validatorBindings: z.array(nonEmptyStringSchema),
});

@Injectable()
export class ContractReviewSkillPackValidator {
  validateProfile(
    rawProfile: Record<string, unknown>,
    filePath: string,
  ): ContractReviewSkillPackProfile {
    const parsed = skillPackProfileSchema.safeParse(rawProfile);
    if (!parsed.success) {
      throw new Error(
        `合同审核 skill pack profile 校验失败（${filePath}）：${parsed.error.issues
          .map((issue) => `${issue.path.join('.') || 'root'} ${issue.message}`)
          .join('；')}`,
      );
    }

    return parsed.data;
  }

  validateChecks(rawChecks: unknown, filePath: string): ContractReviewSkillPackCheck[] {
    const parsed = z.array(skillPackCheckSchema).min(1).safeParse(rawChecks);
    if (!parsed.success) {
      throw new Error(
        `合同审核 skill pack checks 校验失败（${filePath}）：${parsed.error.issues
          .map((issue) => `${issue.path.join('.') || 'root'} ${issue.message}`)
          .join('；')}`,
      );
    }

    const duplicatedCodes = this.collectDuplicatedValues(parsed.data.map((item) => item.code));
    if (duplicatedCodes.length > 0) {
      throw new Error(
        `合同审核 skill pack checks 存在重复 code（${filePath}）：${duplicatedCodes.join('、')}`,
      );
    }

    return parsed.data;
  }

  validateTextAsset(label: string, content: string, filePath: string): void {
    if (!content.trim()) {
      throw new Error(`合同审核 skill pack ${label} 不能为空（${filePath}）。`);
    }
  }

  validatePack(pack: ContractReviewSkillPack): void {
    const unsupportedBindings = pack.checks.flatMap((check) =>
      check.validatorBindings.filter(
        (binding) => !pack.deterministicValidators.includes(binding),
      ),
    );
    if (unsupportedBindings.length > 0) {
      throw new Error(
        `合同审核 skill pack 声明了未注册的 validatorBindings：${[
          ...new Set(unsupportedBindings),
        ].join('、')}`,
      );
    }

    const unsupportedContractTypes = pack.checks.flatMap((check) =>
      check.applicableContractTypes.filter(
        (contractType) => !pack.applicableContractTypes.includes(contractType),
      ),
    );
    if (unsupportedContractTypes.length > 0) {
      throw new Error(
        `合同审核 skill pack 检查项引用了未声明的合同类型：${[
          ...new Set(unsupportedContractTypes),
        ].join('、')}`,
      );
    }
  }

  private collectDuplicatedValues(values: string[]): string[] {
    const seen = new Set<string>();
    const duplicated = new Set<string>();

    for (const value of values) {
      if (seen.has(value)) {
        duplicated.add(value);
        continue;
      }

      seen.add(value);
    }

    return [...duplicated];
  }
}

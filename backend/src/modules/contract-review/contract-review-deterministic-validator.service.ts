import { Injectable } from '@nestjs/common';
import type {
  ContractReviewCompiledCheck,
  ContractReviewDeterministicIssueCandidate,
  ContractReviewDiscountFact,
  ContractReviewFactExtractionResult,
  ContractReviewInvoiceFact,
  ContractReviewLicenseDeliveryFact,
  ContractReviewPaymentFact,
  ContractReviewPenaltyFact,
  ContractReviewSkillPackSnapshot,
  ContractReviewTaxRateFact,
} from './contract-review.runtime.types';

@Injectable()
export class ContractReviewDeterministicValidatorService {
  validate(
    packSnapshot: ContractReviewSkillPackSnapshot,
    factExtraction: ContractReviewFactExtractionResult,
  ): ContractReviewDeterministicIssueCandidate[] {
    const issues: ContractReviewDeterministicIssueCandidate[] = [];

    for (const check of packSnapshot.checks) {
      for (const validatorBinding of check.validatorBindings) {
        const issue = this.validateByBinding(
          check,
          validatorBinding,
          factExtraction,
        );
        if (issue) {
          issues.push(issue);
          break;
        }
      }
    }

    return issues;
  }

  private validateByBinding(
    check: ContractReviewCompiledCheck,
    validatorBinding: string,
    factExtraction: ContractReviewFactExtractionResult,
  ): ContractReviewDeterministicIssueCandidate | null {
    switch (validatorBinding) {
      case 'payment-term-limit':
        return this.validatePaymentTermLimit(check, validatorBinding, factExtraction.paymentFacts);
      case 'tax-rate-limit':
        return this.validateTaxRateLimit(check, validatorBinding, factExtraction.taxRateFacts);
      case 'discount-threshold':
        return this.validateDiscountThreshold(
          check,
          validatorBinding,
          factExtraction.discountFacts,
        );
      case 'penalty-cap-limit':
        return this.validatePenaltyCapLimit(
          check,
          validatorBinding,
          factExtraction.penaltyFacts,
        );
      case 'invoice-prefix':
        return this.validateInvoicePrefix(check, validatorBinding, factExtraction.invoiceFacts);
      case 'license-delivery-gate':
        return this.validateLicenseDeliveryGate(
          check,
          validatorBinding,
          factExtraction.licenseDeliveryFacts,
        );
      default:
        return null;
    }
  }

  private validatePaymentTermLimit(
    check: ContractReviewCompiledCheck,
    validatorBinding: string,
    paymentFacts: ContractReviewPaymentFact[],
  ): ContractReviewDeterministicIssueCandidate | null {
    const stageThresholds: Record<string, number> = {
      首付款: 30,
      到货款: 60,
      验收款: 30,
    };

    const offendingFact = paymentFacts.find((fact) => {
      if (fact.days === undefined) {
        return false;
      }

      const threshold = stageThresholds[fact.stage];
      if (threshold !== undefined) {
        return fact.days > threshold;
      }

      return fact.days > 60;
    });

    if (!offendingFact || offendingFact.days === undefined) {
      return null;
    }

    const threshold = stageThresholds[offendingFact.stage] ?? 60;
    return this.buildIssue(
      check,
      validatorBinding,
      offendingFact.locator,
      offendingFact.text,
      `检测到${offendingFact.stage}账期为 ${offendingFact.days} 天，超过公司标准 ${threshold} 天。`,
    );
  }

  private validateTaxRateLimit(
    check: ContractReviewCompiledCheck,
    validatorBinding: string,
    taxRateFacts: ContractReviewTaxRateFact[],
  ): ContractReviewDeterministicIssueCandidate | null {
    const offendingFact = taxRateFacts.find((fact) => {
      if (fact.kind === 'PRODUCT') {
        return fact.taxRate !== 13;
      }

      if (fact.kind === 'SERVICE') {
        return fact.taxRate !== 6;
      }

      return false;
    });

    if (!offendingFact) {
      return null;
    }

    const expectedRate = offendingFact.kind === 'PRODUCT' ? 13 : 6;
    return this.buildIssue(
      check,
      validatorBinding,
      offendingFact.locator,
      offendingFact.text,
      `检测到${offendingFact.kind === 'PRODUCT' ? '产品' : '服务'}税率为 ${offendingFact.taxRate}%，与公司标准 ${expectedRate}% 不一致。`,
    );
  }

  private validateDiscountThreshold(
    check: ContractReviewCompiledCheck,
    validatorBinding: string,
    discountFacts: ContractReviewDiscountFact[],
  ): ContractReviewDeterministicIssueCandidate | null {
    const offendingFact = discountFacts.find((fact) => fact.discountRatePercent < 20);
    if (!offendingFact) {
      return null;
    }

    return this.buildIssue(
      check,
      validatorBinding,
      offendingFact.locator,
      offendingFact.text,
      `检测到折扣为 ${offendingFact.expression}（约 ${offendingFact.discountRatePercent}%），低于 2 折红线，应补充特价审批依据。`,
    );
  }

  private validatePenaltyCapLimit(
    check: ContractReviewCompiledCheck,
    validatorBinding: string,
    penaltyFacts: ContractReviewPenaltyFact[],
  ): ContractReviewDeterministicIssueCandidate | null {
    const offendingFact = penaltyFacts.find(
      (fact) =>
        fact.unlimitedLiability ||
        (fact.capPercent !== undefined && fact.capPercent > 100) ||
        (fact.dailyRatePermille !== undefined && fact.dailyRatePermille > 5),
    );

    if (!offendingFact) {
      return null;
    }

    const reason = offendingFact.unlimitedLiability
      ? '检测到违约责任存在“全部赔偿”或无限责任表述，超出公司责任边界。'
      : offendingFact.capPercent !== undefined && offendingFact.capPercent > 100
        ? `检测到违约责任上限为 ${offendingFact.capPercent}%，超过合同金额 100% 上限。`
        : `检测到日违约金为千分之${offendingFact.dailyRatePermille}，高于公司标准千分之五。`;

    return this.buildIssue(
      check,
      validatorBinding,
      offendingFact.locator,
      offendingFact.text,
      reason,
    );
  }

  private validateInvoicePrefix(
    check: ContractReviewCompiledCheck,
    validatorBinding: string,
    invoiceFacts: ContractReviewInvoiceFact[],
  ): ContractReviewDeterministicIssueCandidate | null {
    const offendingFact = invoiceFacts.find(
      (fact) =>
        !fact.hasSoftwarePrefix &&
        /开票|发票|软件|产品名称/.test(fact.text),
    );

    if (!offendingFact) {
      return null;
    }

    return this.buildIssue(
      check,
      validatorBinding,
      offendingFact.locator,
      offendingFact.text,
      '检测到开票条款未体现“*软件*”前缀，存在退税与票税合规风险。',
    );
  }

  private validateLicenseDeliveryGate(
    check: ContractReviewCompiledCheck,
    validatorBinding: string,
    licenseDeliveryFacts: ContractReviewLicenseDeliveryFact[],
  ): ContractReviewDeterministicIssueCandidate | null {
    const offendingFact = licenseDeliveryFacts.find(
      (fact) =>
        fact.mentionsPermanentLicense &&
        fact.mentionsAdvanceDelivery &&
        !fact.mentionsFullPaymentRequired,
    );

    if (!offendingFact) {
      return null;
    }

    return this.buildIssue(
      check,
      validatorBinding,
      offendingFact.locator,
      offendingFact.text,
      '检测到永久许可可能在未收全款前交付，违反“全款后交付永久许可”的硬性要求。',
    );
  }

  private buildIssue(
    check: ContractReviewCompiledCheck,
    validatorBinding: string,
    locator: string,
    quote: string,
    reason: string,
  ): ContractReviewDeterministicIssueCandidate {
    return {
      ruleCode: check.code,
      validatorBinding,
      locator,
      quote,
      reason,
      suggestion: check.suggestion,
      riskLevel: check.riskLevel,
      isVeto: check.isVeto,
    };
  }
}

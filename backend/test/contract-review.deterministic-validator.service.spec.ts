import { ContractReviewDeterministicValidatorService } from '../src/modules/contract-review/contract-review-deterministic-validator.service';
import type {
  ContractReviewCompiledCheck,
  ContractReviewFactExtractionResult,
  ContractReviewSkillPackSnapshot,
} from '../src/modules/contract-review/contract-review.runtime.types';

describe('ContractReviewDeterministicValidatorService', () => {
  const service = new ContractReviewDeterministicValidatorService();

  const buildCheck = (
    code: string,
    validatorBinding: string,
  ): ContractReviewCompiledCheck => ({
    code,
    group: '测试分组',
    category: '测试分类',
    title: `${code} 标题`,
    description: `${code} 描述`,
    riskLevel: 'HIGH',
    isVeto: false,
    sourceClause: `${code} 条款`,
    keywords: [],
    suggestion: `${code} 建议`,
    applicableContractTypes: ['销售合同'],
    validatorBindings: [validatorBinding],
  });

  const buildSnapshot = (...checks: ContractReviewCompiledCheck[]): ContractReviewSkillPackSnapshot => ({
    packCode: 'company-commercial-v1',
    packVersion: '2026.04',
    packTitle: '公司商务合同审核标准',
    packSummary: '测试用 skill pack snapshot',
    packChecksum: 'mock-checksum',
    packChecksumSummary: 'mock-sum',
    compiledAt: '2026-04-06T00:00:00.000Z',
    executionMode: 'AI_HYBRID',
    modelProfile: 'codex-high',
    selectedContractTypes: ['销售合同'],
    promptFingerprints: {
      planner: 'planner-hash',
      reviewer: 'reviewer-hash',
      summarizer: 'summarizer-hash',
    },
    deterministicValidators: checks.flatMap((check) => check.validatorBindings),
    checkCount: checks.length,
    groups: [
      {
        group: '测试分组',
        checkCodes: checks.map((check) => check.code),
      },
    ],
    checks,
  });

  const buildFacts = (
    overrides: Partial<ContractReviewFactExtractionResult> = {},
  ): ContractReviewFactExtractionResult => ({
    extractedAt: '2026-04-06T00:00:00.000Z',
    contractTypes: ['销售合同'],
    amountFacts: [],
    taxRateFacts: [],
    paymentFacts: [],
    discountFacts: [],
    penaltyFacts: [],
    invoiceFacts: [],
    intellectualPropertyFacts: [],
    licenseDeliveryFacts: [],
    templateMatchFacts: [],
    templateSlotFacts: [],
    summary: '测试摘要',
    ...overrides,
  });

  it.each([
    {
      name: 'payment-term-limit',
      check: buildCheck('CR-PAY-001', 'payment-term-limit'),
      facts: buildFacts({
        paymentFacts: [
          {
            locator: '正文条款3',
            text: '乙方应在验收后60日内收款。',
            stage: '验收款',
            days: 60,
          },
        ],
      }),
      expectedRuleCode: 'CR-PAY-001',
    },
    {
      name: 'tax-rate-limit',
      check: buildCheck('CR-TAX-001', 'tax-rate-limit'),
      facts: buildFacts({
        taxRateFacts: [
          {
            locator: '正文条款2',
            text: '产品税率为9%。',
            taxRate: 9,
            kind: 'PRODUCT',
          },
        ],
      }),
      expectedRuleCode: 'CR-TAX-001',
    },
    {
      name: 'discount-threshold',
      check: buildCheck('CR-DISCOUNT-001', 'discount-threshold'),
      facts: buildFacts({
        discountFacts: [
          {
            locator: '商务报价',
            text: '本次特价按1.5折执行。',
            discountRatePercent: 15,
            expression: '1.5折',
          },
        ],
      }),
      expectedRuleCode: 'CR-DISCOUNT-001',
    },
    {
      name: 'penalty-cap-limit',
      check: buildCheck('CR-PENALTY-001', 'penalty-cap-limit'),
      facts: buildFacts({
        penaltyFacts: [
          {
            locator: '违约责任条款',
            text: '乙方承担全部赔偿责任。',
            unlimitedLiability: true,
          },
        ],
      }),
      expectedRuleCode: 'CR-PENALTY-001',
    },
    {
      name: 'invoice-prefix',
      check: buildCheck('CR-INVOICE-001', 'invoice-prefix'),
      facts: buildFacts({
        invoiceFacts: [
          {
            locator: '开票条款',
            text: '开票名称为企业安全监测保护平台软件。',
            invoiceType: 'VAT_SPECIAL',
            invoiceName: '企业安全监测保护平台软件',
            hasSoftwarePrefix: false,
          },
        ],
      }),
      expectedRuleCode: 'CR-INVOICE-001',
    },
    {
      name: 'license-delivery-gate',
      check: buildCheck('CR-LICENSE-001', 'license-delivery-gate'),
      facts: buildFacts({
        licenseDeliveryFacts: [
          {
            locator: '许可交付条款',
            text: '乙方在收到首付款后即可交付永久许可。',
            mentionsTemporaryLicense: false,
            mentionsPermanentLicense: true,
            mentionsFullPaymentRequired: false,
            mentionsAdvanceDelivery: true,
          },
        ],
      }),
      expectedRuleCode: 'CR-LICENSE-001',
    },
  ])('应命中确定性校验规则：$name', ({ check, facts, expectedRuleCode }) => {
    const issues = service.validate(buildSnapshot(check), facts);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      ruleCode: expectedRuleCode,
      validatorBinding: check.validatorBindings[0],
      riskLevel: 'HIGH',
    });
  });

  it('未命中任何硬规则时应返回空数组', () => {
    const issues = service.validate(
      buildSnapshot(buildCheck('CR-PAY-001', 'payment-term-limit')),
      buildFacts({
        paymentFacts: [
          {
            locator: '正文条款3',
            text: '乙方应在验收后30日内收款。',
            stage: '验收款',
            days: 30,
          },
        ],
      }),
    );

    expect(issues).toEqual([]);
  });
});

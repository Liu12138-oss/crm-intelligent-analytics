import { ContractReviewSnapshotCompilerService } from '../src/modules/contract-review/contract-review-snapshot.compiler.service';
import type { ContractReviewFactExtractionResult } from '../src/modules/contract-review/contract-review.runtime.types';
import type { ContractReviewSkillPack } from '../src/modules/contract-review/skill-pack/contract-review-skill-pack.types';

describe('ContractReviewSnapshotCompilerService', () => {
  const service = new ContractReviewSnapshotCompilerService();

  const pack: ContractReviewSkillPack = {
    rootDir: 'c:/tmp/company-commercial-v1',
    files: {
      profile: 'c:/tmp/profile.yaml',
      requirements: 'c:/tmp/requirements.md',
      workflow: 'c:/tmp/workflow.md',
      checks: 'c:/tmp/checks.json',
      plannerPrompt: 'c:/tmp/prompts/planner.md',
      reviewerPrompt: 'c:/tmp/prompts/reviewer.md',
      summarizerPrompt: 'c:/tmp/prompts/summarizer.md',
    },
    code: 'company-commercial-v1',
    version: '2026.04',
    title: '公司商务合同审核标准',
    summary: '测试用审核标准包',
    issuedAt: '2026-04-06T00:00:00.000Z',
    requirements: '# requirements',
    workflow: '# workflow',
    prompts: {
      planner: 'planner prompt body',
      reviewer: 'reviewer prompt body',
      summarizer: 'summarizer prompt body',
    },
    checks: [
      {
        code: 'CR-SALES-001',
        group: '销售条款',
        category: '付款条件',
        title: '账期不得超过 30 天',
        description: '销售合同账期必须控制在 30 天内',
        riskLevel: 'HIGH',
        isVeto: false,
        sourceClause: '付款与回款',
        keywords: ['付款', '账期'],
        suggestion: '调整账期',
        applicableContractTypes: ['购销合同'],
        validatorBindings: ['payment-term-limit'],
      },
      {
        code: 'CR-SERVICE-001',
        group: '服务与交付',
        category: '知识产权',
        title: '服务成果知识产权不得整体转移',
        description: '服务合同不得将全部知识产权转移给客户',
        riskLevel: 'HIGH',
        isVeto: true,
        sourceClause: '知识产权与成果归属',
        keywords: ['知识产权', '成果'],
        suggestion: '调整知识产权条款',
        applicableContractTypes: ['服务合同'],
        validatorBindings: [],
      },
    ],
    defaultExecutionMode: 'AI_HYBRID',
    defaultModelProfile: 'codex-high',
    applicableContractTypes: ['购销合同', '服务合同'],
    deterministicValidators: ['payment-term-limit', 'tax-rate-limit'],
    checksum: 'mock-checksum',
    checksumSummary: 'mock-sum',
  };

  const buildFacts = (
    contractTypes: string[],
  ): ContractReviewFactExtractionResult => ({
    extractedAt: '2026-04-06T00:00:00.000Z',
    contractTypes,
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
    summary: '测试事实提取摘要',
  });

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-07T08:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('应按识别出的合同类型筛选检查项并生成提示词指纹', () => {
    const snapshot = service.compile(pack, buildFacts(['服务合同']));

    expect(snapshot.compiledAt).toBe('2026-04-07T08:00:00.000Z');
    expect(snapshot.selectedContractTypes).toEqual(['服务合同']);
    expect(snapshot.checkCount).toBe(1);
    expect(snapshot.groups).toEqual([
      {
        group: '服务与交付',
        checkCodes: ['CR-SERVICE-001'],
      },
    ]);
    expect(snapshot.checks).toEqual([
      expect.objectContaining({
        code: 'CR-SERVICE-001',
        applicableContractTypes: ['服务合同'],
      }),
    ]);
    expect(snapshot.promptFingerprints).toEqual({
      planner: expect.stringMatching(/^[0-9a-f]{12}$/),
      reviewer: expect.stringMatching(/^[0-9a-f]{12}$/),
      summarizer: expect.stringMatching(/^[0-9a-f]{12}$/),
    });
  });

  it('未命中合同类型时应回退到 pack 全量检查项', () => {
    const snapshot = service.compile(pack, buildFacts(['未知合同']));

    expect(snapshot.selectedContractTypes).toEqual(['购销合同', '服务合同']);
    expect(snapshot.checkCount).toBe(2);
    expect(snapshot.groups).toEqual([
      {
        group: '销售条款',
        checkCodes: ['CR-SALES-001'],
      },
      {
        group: '服务与交付',
        checkCodes: ['CR-SERVICE-001'],
      },
    ]);
    expect(snapshot.deterministicValidators).toEqual([
      'payment-term-limit',
      'tax-rate-limit',
    ]);
  });

  it('规则快审模式下应过滤未绑定明确校验器的检查项', () => {
    const snapshot = service.compile(
      {
        ...pack,
        defaultExecutionMode: 'DETERMINISTIC_ONLY',
      },
      buildFacts(['购销合同', '服务合同']),
    );

    expect(snapshot.executionMode).toBe('DETERMINISTIC_ONLY');
    expect(snapshot.checkCount).toBe(1);
    expect(snapshot.groups).toEqual([
      {
        group: '销售条款',
        checkCodes: ['CR-SALES-001'],
      },
    ]);
    expect(snapshot.checks).toEqual([
      expect.objectContaining({
        code: 'CR-SALES-001',
        validatorBindings: ['payment-term-limit'],
      }),
    ]);
  });
});

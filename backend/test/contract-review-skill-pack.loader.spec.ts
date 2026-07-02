import { join } from 'node:path';
import { ContractReviewConfigService } from '../src/modules/contract-review/contract-review.config';
import { ContractReviewSkillPackLoader } from '../src/modules/contract-review/skill-pack/contract-review-skill-pack.loader';
import { ContractReviewSkillPackValidator } from '../src/modules/contract-review/skill-pack/contract-review-skill-pack.validator';

describe('ContractReviewSkillPackLoader', () => {
  const originalRootDir = process.env.CONTRACT_REVIEW_SKILL_PACK_ROOT_DIR;
  const originalPackCode = process.env.CONTRACT_REVIEW_SKILL_PACK_CODE;

  const buildLoader = () =>
    new ContractReviewSkillPackLoader(
      new ContractReviewConfigService(),
      new ContractReviewSkillPackValidator(),
    );

  beforeEach(() => {
    process.env.CONTRACT_REVIEW_SKILL_PACK_ROOT_DIR = join(
      process.cwd(),
      'resources',
      'contract-review-skill-packs',
    );
    process.env.CONTRACT_REVIEW_SKILL_PACK_CODE = 'company-commercial-v1';
  });

  afterAll(() => {
    if (originalRootDir === undefined) {
      delete process.env.CONTRACT_REVIEW_SKILL_PACK_ROOT_DIR;
    } else {
      process.env.CONTRACT_REVIEW_SKILL_PACK_ROOT_DIR = originalRootDir;
    }

    if (originalPackCode === undefined) {
      delete process.env.CONTRACT_REVIEW_SKILL_PACK_CODE;
    } else {
      process.env.CONTRACT_REVIEW_SKILL_PACK_CODE = originalPackCode;
    }
  });

  it('应加载激活的 skill pack 并生成校验摘要', () => {
    const loader = buildLoader();

    const pack = loader.loadActivePack();

    expect(pack.code).toBe('company-commercial-v1');
    expect(pack.version).toBe('2026.04');
    expect(pack.title).toBe('公司商务合同审核标准');
    expect(pack.defaultExecutionMode).toBe('AI_HYBRID');
    expect(pack.defaultModelProfile).toBe('codex-high');
    expect(pack.checksum).toHaveLength(64);
    expect(pack.checksumSummary).toBe(pack.checksum.slice(0, 12));
    expect(pack.files.profile).toContain('profile.yaml');
    expect(pack.prompts.planner.trim().length).toBeGreaterThan(0);
    expect(pack.prompts.reviewer.trim().length).toBeGreaterThan(0);
    expect(pack.prompts.summarizer.trim().length).toBeGreaterThan(0);
    expect(pack.checks.length).toBeGreaterThan(0);
    expect(pack.deterministicValidators).toEqual(
      expect.arrayContaining(['payment-term-limit', 'tax-rate-limit']),
    );
  });

  it('激活的 skill pack 目录不存在时应报错', () => {
    process.env.CONTRACT_REVIEW_SKILL_PACK_CODE = 'missing-pack';
    const loader = buildLoader();

    expect(() => loader.loadActivePack()).toThrow('未找到激活的合同审核 skill pack 目录');
  });

  it('skill pack 文件路径越界时应报错', () => {
    const loader = buildLoader();
    const packRootDir = join(
      process.cwd(),
      'resources',
      'contract-review-skill-packs',
      'company-commercial-v1',
    );

    expect(() =>
      (loader as any).resolvePackFilePath(
        packRootDir,
        '../profile.yaml',
        'profile.yaml',
      ),
    ).toThrow('合同审核 skill pack profile.yaml 路径越界');
  });
});

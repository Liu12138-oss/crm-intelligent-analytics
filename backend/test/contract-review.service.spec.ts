import { BadRequestException } from '@nestjs/common';
import { ContractReviewService } from '../src/modules/contract-review/contract-review.service';
import { CONTRACT_REVIEW_RULE_SET } from '../src/modules/contract-review/contract-review.rule-set';
import type {
  ContractReviewIssueRecord,
  ContractReviewArtifactRecord,
  ContractReviewSourceContractSnapshotRecord,
  ContractReviewTaskRecord,
  CrmUser,
  ScopeSnapshot,
} from '../src/shared/types/domain';

describe('ContractReviewService', () => {
  const user: CrmUser = {
    id: 'user_sales_director',
    name: '销售总监',
    roleIds: ['role_sales_director'],
    roleNames: ['销售总监'],
    organizationIds: ['org_north'],
    departmentIds: ['dept_sales'],
    ownerIds: ['owner_zhang'],
    isAdmin: false,
    exportAllowed: true,
    channels: ['web-console'],
  };

  const scopeSnapshot: ScopeSnapshot = {
    organizationIds: ['org_north'],
    departmentIds: ['dept_sales'],
    ownerIds: ['owner_zhang'],
    scopeSummary: '北区销售范围',
  };

  const buildConfigService = (options?: {
    reviewerRoleIds?: string[];
    downloaderRoleIds?: string[];
  }) => ({
    getAllowedExtensions: jest.fn(() => ['.docx']),
    getMaxFileSizeBytes: jest.fn(() => 10 * 1024 * 1024),
    getReviewerRoleIds: jest.fn(() => options?.reviewerRoleIds ?? ['role_admin']),
    getDownloaderRoleIds: jest.fn(() => options?.downloaderRoleIds ?? ['role_admin']),
  });

  const buildFactExtraction = () => ({
    extractedAt: '2026-04-06T00:00:00.000Z',
    contractTypes: ['购销合同'],
    amountFacts: [
      {
        locator: '正文条款1',
        text: '合同金额为人民币 120000 元。',
        label: '合同金额',
        amount: 120000,
        currency: 'CNY',
      },
    ],
    taxRateFacts: [],
    paymentFacts: [],
    discountFacts: [],
    penaltyFacts: [],
    invoiceFacts: [],
    intellectualPropertyFacts: [],
    licenseDeliveryFacts: [],
    templateMatchFacts: [],
    templateSlotFacts: [],
    summary:
      '识别合同类型：购销合同；金额 1 项；税率 0 项；付款 0 项；折扣 0 项；违约 0 项；开票 0 项；知识产权 0 项；许可交付 0 项',
  });

  const buildDeterministicValidatorService = (
    issues: Array<Record<string, unknown>> = [],
  ) => ({
    validate: jest.fn(() => issues),
  });

  const buildPackRuntimeService = (options?: {
    defaultExecutionMode?: 'AI_HYBRID' | 'DETERMINISTIC_ONLY';
    checks?: Array<Record<string, unknown>>;
  }) => ({
    getActivePack: jest.fn(() => ({
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
      code: CONTRACT_REVIEW_RULE_SET.code,
      version: CONTRACT_REVIEW_RULE_SET.version,
      title: CONTRACT_REVIEW_RULE_SET.title,
      summary: CONTRACT_REVIEW_RULE_SET.summary,
      issuedAt: CONTRACT_REVIEW_RULE_SET.issuedAt,
      requirements: '# mock requirements',
      workflow: '# mock workflow',
      prompts: {
        planner: 'planner',
        reviewer: 'reviewer',
        summarizer: 'summarizer',
      },
      checks:
        options?.checks ??
        CONTRACT_REVIEW_RULE_SET.items.map((item) => ({
          ...item,
          group: item.category,
          applicableContractTypes: ['购销合同'],
          validatorBindings: [],
        })),
      defaultExecutionMode: options?.defaultExecutionMode ?? 'AI_HYBRID',
      defaultModelProfile: 'codex-high',
      applicableContractTypes: ['购销合同'],
      deterministicValidators: [],
      checksum: 'mock-checksum',
      checksumSummary: 'mock-sum',
    })),
  });

  const buildAccessDecisionService = (options?: {
    allowedActionKeys?: string[];
    visibleMenus?: string[];
  }) => {
    const allowedActionKeys = options?.allowedActionKeys ?? ['contract.review.upload'];
    const visibleMenus = options?.visibleMenus ?? ['contract-review'];

    return {
      hasAction: jest.fn((_: CrmUser, actionKey: string) =>
        allowedActionKeys.includes(actionKey),
      ),
      hasVisibleMenu: jest.fn((_: CrmUser, menuKey: string) =>
        visibleMenus.includes(menuKey),
      ),
      ensureAction: jest.fn((_: CrmUser, actionKey: string, reason: string) => {
        if (!allowedActionKeys.includes(actionKey)) {
          throw new BadRequestException(reason);
        }
      }),
    };
  };

  const buildPermissionEnforcementService = () => ({
    ensureAction: jest.fn(),
    ensureVisibleMenu: jest.fn(),
    hasAction: jest.fn(() => true),
    hasVisibleMenu: jest.fn(() => true),
  });

  const buildSnapshotCompilerService = (
    ruleSet = CONTRACT_REVIEW_RULE_SET,
    options?: {
      executionMode?: 'AI_HYBRID' | 'DETERMINISTIC_ONLY';
      checks?: Array<Record<string, unknown>>;
    },
  ) => ({
    compile: jest.fn(() => {
      const checks =
        options?.checks ??
        ruleSet.items.map((item) => ({
          ...item,
          group: item.category,
          applicableContractTypes: ['购销合同'],
          validatorBindings: [],
        }));

      return {
        packCode: ruleSet.code,
        packVersion: ruleSet.version,
        packTitle: ruleSet.title,
        packSummary: ruleSet.summary,
        packChecksum: 'mock-checksum',
        packChecksumSummary: 'mock-sum',
        compiledAt: '2026-04-06T00:00:00.000Z',
        executionMode: options?.executionMode ?? 'AI_HYBRID',
        modelProfile: 'codex-high',
        selectedContractTypes: ['购销合同'],
        promptFingerprints: {
          planner: 'planner-hash',
          reviewer: 'reviewer-hash',
          summarizer: 'summarizer-hash',
        },
        deterministicValidators: [],
        checkCount: checks.length,
        groups: [...new Set(checks.map((item) => item.group as string))].map((group) => ({
          group,
          checkCodes: checks
            .filter((item) => item.group === group)
            .map((item) => item.code as string),
        })),
        checks,
      };
    }),
  });

  it.each([
    [
      '未上传文件',
      undefined,
      '请先上传待审核的 .docx 合同文件。',
    ],
    [
      '扩展名不合法',
      {
        originalname: '采购合同.pdf',
        mimetype: 'application/pdf',
        size: 2048,
        buffer: Buffer.from('mock-pdf'),
      },
      '当前仅支持上传 .docx 合同文件。',
    ],
    [
      '空文件',
      {
        originalname: '采购合同.docx',
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 0,
        buffer: Buffer.alloc(0),
      },
      '上传文件为空，请重新选择有效合同。',
    ],
    [
      '超出大小限制',
      {
        originalname: '采购合同.docx',
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 11 * 1024 * 1024,
        buffer: Buffer.from('mock-docx'),
      },
      '上传文件超过当前大小限制，请压缩后重试。',
    ],
  ])('应拒绝非法上传文件：%s', async (_caseName, file, expectedMessage) => {
    const repository = {
      getCurrentRuleSet: jest.fn(() => CONTRACT_REVIEW_RULE_SET),
      saveTask: jest.fn(),
      replaceIssues: jest.fn(),
      replaceArtifacts: jest.fn(),
      listVisibleTasks: jest.fn(),
      findTaskById: jest.fn(),
      listIssuesByTaskId: jest.fn(),
      listArtifactsByTaskId: jest.fn(),
      findArtifactById: jest.fn(),
      findRuleSetByCodeVersion: jest.fn(),
    };
    const auditEventRepository = {
      create: jest.fn(),
    };

    const service = new ContractReviewService(
      repository as never,
      buildConfigService() as never,
      { buildAnnotatedDocx: jest.fn() } as never,
      { reviewDocument: jest.fn() } as never,
      buildDeterministicValidatorService() as never,
      { extract: jest.fn() } as never,
      { extract: jest.fn(() => buildFactExtraction()) } as never,
      { saveSourceFile: jest.fn(), saveTextArtifact: jest.fn(), saveBinaryArtifact: jest.fn() } as never,
      buildSnapshotCompilerService() as never,
      buildPackRuntimeService() as never,
      auditEventRepository as never,
      { resolveScope: jest.fn(() => scopeSnapshot) } as never,
      buildAccessDecisionService() as never,
     buildPermissionEnforcementService() as never,
    );

    await expect(service.createTask(user, file as never)).rejects.toThrow(expectedMessage);
    expect(repository.saveTask).not.toHaveBeenCalled();
    expect(auditEventRepository.create).not.toHaveBeenCalled();
  });

  it('应根据 AI 命中结果生成结构化问题并标记一票否决', async () => {
    const ruleSet: typeof CONTRACT_REVIEW_RULE_SET = {
      ...CONTRACT_REVIEW_RULE_SET,
      items: CONTRACT_REVIEW_RULE_SET.items.map((item) => ({ ...item })),
    };
    const savedTasks: ContractReviewTaskRecord[] = [];
    const savedIssues: ContractReviewIssueRecord[][] = [];

    const repository = {
      getCurrentRuleSet: jest.fn(() => ruleSet),
      saveTask: jest.fn((task: ContractReviewTaskRecord) => {
        savedTasks.push(task);
        return task;
      }),
      replaceIssues: jest.fn((taskId: string, issues: ContractReviewIssueRecord[]) => {
        savedIssues.push(issues);
        return issues;
      }),
      replaceArtifacts: jest.fn(),
      listVisibleTasks: jest.fn(),
      findTaskById: jest.fn(),
      listIssuesByTaskId: jest.fn(),
      listArtifactsByTaskId: jest.fn(),
      findArtifactById: jest.fn(),
      findRuleSetByCodeVersion: jest.fn(),
    };
    const configService = buildConfigService();
    const annotatedDocxService = {
      buildAnnotatedDocx: jest.fn(() => Buffer.from('annotated-docx')),
    };
    const aiReviewService = {
      reviewDocument: jest.fn().mockResolvedValue([
        {
          ruleCode: 'CR-IP-001',
          locator: '正文条款1',
          quote: '知识产权及源代码归甲方独占所有。',
          analysis: '合同把知识产权和源代码成果归给甲方，命中公司一票否决项。',
        },
      ]),
    };
    const docxExtractorService = {
      extract: jest.fn().mockReturnValue({
        title: '采购合作协议',
        summary: '已提取合同正文，准备进入规则审核。',
        fullText: '知识产权及源代码归甲方独占所有。',
        paragraphs: [
          {
            index: 1,
            text: '知识产权及源代码归甲方独占所有。',
            locator: '正文条款1',
            source: 'document',
          },
        ],
        headings: [],
        clauses: [
          {
            index: 1,
            text: '知识产权及源代码归甲方独占所有。',
            locator: '正文条款1',
            source: 'document',
          },
        ],
      }),
    };
    const fileStorageService = {
      saveSourceFile: jest.fn().mockResolvedValue('c:/tmp/source.docx'),
      saveTextArtifact: jest
        .fn()
        .mockResolvedValueOnce('c:/tmp/review-report.md')
        .mockResolvedValueOnce('c:/tmp/review-result.json'),
      saveBinaryArtifact: jest.fn().mockResolvedValue('c:/tmp/annotated-review.docx'),
    };
    const auditEventRepository = {
      create: jest.fn(),
    };
    const userScopeService = {
      resolveScope: jest.fn(() => scopeSnapshot),
    };
    const factExtractorService = {
      extract: jest.fn(() => buildFactExtraction()),
    };
    const deterministicValidatorService = buildDeterministicValidatorService();
    const snapshotCompilerService = buildSnapshotCompilerService(ruleSet);
    const skillPackRuntimeService = buildPackRuntimeService();

    const service = new ContractReviewService(
      repository as never,
      configService as never,
      annotatedDocxService as never,
      aiReviewService as never,
      deterministicValidatorService as never,
      docxExtractorService as never,
      factExtractorService as never,
      fileStorageService as never,
      snapshotCompilerService as never,
      skillPackRuntimeService as never,
      auditEventRepository as never,
      userScopeService as never,
      buildAccessDecisionService() as never,
    buildPermissionEnforcementService() as never,
    );

    const garbledFileName = Buffer.from('采购合作协议.docx', 'utf8').toString('latin1');
    const result = await service.createTask(user, {
      originalname: garbledFileName,
      mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 2048,
      buffer: Buffer.from('mock-docx'),
    });

    expect(result.status).toBe('UPLOADED');
    await service.waitForTaskExecution();
    expect(aiReviewService.reviewDocument).toHaveBeenCalledTimes(1);
    expect(savedTasks.map((task) => task.status)).toEqual([
      'UPLOADED',
      'PARSING',
      'REVIEWING',
      'GENERATING_REPORT',
      'COMPLETED',
    ]);
    expect(savedIssues).toHaveLength(1);
    expect(savedIssues[0]).toHaveLength(1);
    expect(savedIssues[0][0]).toMatchObject({
      ruleCode: 'CR-IP-001',
      isVeto: true,
      quote: '正文条款1：知识产权及源代码归甲方独占所有。',
    });

    expect(savedIssues[0][0].reviewBasis).toMatchObject({
      packCode: ruleSet.code,
      packVersion: ruleSet.version,
      modelProfile: 'codex-high',
      executionMode: 'AI_HYBRID',
    });

    const completedTask = savedTasks.at(-1);
    expect(completedTask).toBeDefined();
    expect(completedTask).toMatchObject({
      status: 'COMPLETED',
      originalFileName: '采购合作协议.docx',
      overallDecision: 'REJECT',
      vetoCount: 1,
      highRiskCount: 0,
      totalIssueCount: 1,
    });

    expect(completedTask?.reviewBasis).toMatchObject({
      packCode: ruleSet.code,
      packVersion: ruleSet.version,
      packChecksum: 'mock-checksum',
      modelProfile: 'codex-high',
      executionMode: 'AI_HYBRID',
    });

    expect(fileStorageService.saveTextArtifact).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      'review-result.json',
      expect.stringContaining('"ruleCode": "CR-IP-001"'),
    );
    expect(fileStorageService.saveBinaryArtifact).toHaveBeenCalledWith(
      expect.any(String),
      'annotated-review.docx',
      expect.any(Buffer),
    );
    expect(repository.replaceArtifacts).toHaveBeenCalled();
    expect(auditEventRepository.create.mock.calls.map(([event]) => event.eventType)).toEqual([
      'CONTRACT_REVIEW_FILE_UPLOADED',
      'CONTRACT_REVIEW_TASK_CREATED',
      'CONTRACT_REVIEW_TASK_COMPLETED',
    ]);
    expect(auditEventRepository.create.mock.calls[2][0]).toMatchObject({
      relatedRequestId: completedTask?.id,
      riskLevel: 'HIGH',
      contractReviewReviewBasis: expect.objectContaining({
        packCode: ruleSet.code,
        packVersion: ruleSet.version,
        executionMode: 'AI_HYBRID',
      }),
    });
  });

  it('AI 不可用时应降级为确定性初筛并输出降级说明', async () => {
    const ruleSet: typeof CONTRACT_REVIEW_RULE_SET = {
      ...CONTRACT_REVIEW_RULE_SET,
      items: CONTRACT_REVIEW_RULE_SET.items.map((item) => ({ ...item })),
    };
    const savedTasks: ContractReviewTaskRecord[] = [];
    const savedIssues: ContractReviewIssueRecord[][] = [];
    const repository = {
      getCurrentRuleSet: jest.fn(() => ruleSet),
      saveTask: jest.fn((task: ContractReviewTaskRecord) => {
        savedTasks.push(task);
        return task;
      }),
      replaceIssues: jest.fn((taskId: string, issues: ContractReviewIssueRecord[]) => {
        savedIssues.push(issues);
        return issues;
      }),
      replaceArtifacts: jest.fn(),
      listVisibleTasks: jest.fn(),
      findTaskById: jest.fn(),
      listIssuesByTaskId: jest.fn(),
      listArtifactsByTaskId: jest.fn(),
      findArtifactById: jest.fn(),
      findRuleSetByCodeVersion: jest.fn(),
    };
    const fileStorageService = {
      saveSourceFile: jest.fn().mockResolvedValue('c:/tmp/source.docx'),
      saveTextArtifact: jest
        .fn()
        .mockResolvedValueOnce('c:/tmp/review-report.md')
        .mockResolvedValueOnce('c:/tmp/review-result.json'),
      saveBinaryArtifact: jest.fn().mockResolvedValue('c:/tmp/annotated-review.docx'),
    };

    const service = new ContractReviewService(
      repository as never,
      buildConfigService() as never,
      { buildAnnotatedDocx: jest.fn(() => Buffer.from('annotated-docx')) } as never,
      {
        reviewDocument: jest.fn().mockResolvedValue(null),
        consumeLastFailureReason: jest.fn(
          () =>
            'AI 服务请求失败，请检查后端出站网络、网关地址或 TLS 连接。Provider=anthropic-claude，Model=claude-sonnet-4-20250514，协议=chat_completions',
        ),
      } as never,
      buildDeterministicValidatorService([
        {
          ruleCode: 'CR-PAY-001',
          validatorBinding: 'payment-term-limit',
          locator: '正文条款3',
          quote: '乙方应在验收后60日内收款。',
          reason: '检测到验收款账期为 60 天，超过公司标准 30 天。',
          suggestion: '控制账期',
          riskLevel: 'HIGH' as const,
          isVeto: false,
        },
      ]) as never,
      {
        extract: jest.fn().mockReturnValue({
          title: '采购合作协议',
          summary: '已提取合同正文，准备进入规则审核。',
          fullText: '乙方应在验收后60日内收款。',
          paragraphs: [
            {
              index: 1,
              text: '乙方应在验收后60日内收款。',
              locator: '正文条款3',
              source: 'document',
            },
          ],
          headings: [],
          clauses: [
            {
              index: 1,
              text: '乙方应在验收后60日内收款。',
              locator: '正文条款3',
              source: 'document',
            },
          ],
        }),
      } as never,
      {
        extract: jest.fn(() => ({
          ...buildFactExtraction(),
          paymentFacts: [
            {
              locator: '正文条款3',
              text: '乙方应在验收后60日内收款。',
              stage: '验收款',
              days: 60,
            },
          ],
          summary:
            '识别合同类型：购销合同；金额 1 项；税率 0 项；付款 1 项；折扣 0 项；违约 0 项；开票 0 项；知识产权 0 项；许可交付 0 项',
        })),
      } as never,
      fileStorageService as never,
      buildSnapshotCompilerService(ruleSet) as never,
      buildPackRuntimeService() as never,
      { create: jest.fn() } as never,
      { resolveScope: jest.fn(() => scopeSnapshot) } as never,
      buildAccessDecisionService() as never,
    buildPermissionEnforcementService() as never,
    );

    const result = await service.createTask(user, {
      originalname: '采购合作协议.docx',
      mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 2048,
      buffer: Buffer.from('mock-docx'),
    });

    expect(result.status).toBe('UPLOADED');
    await service.waitForTaskExecution();
    expect(savedIssues[0]).toHaveLength(1);
    expect(savedIssues[0][0]).toMatchObject({
      ruleCode: 'CR-PAY-001',
      description: expect.stringContaining('命中确定性校验'),
    });
    expect(savedTasks.at(-1)).toMatchObject({
      latestStageMessage: expect.stringContaining('AI 审核不可用'),
      latestResultSummary: expect.stringContaining('降级快审'),
    });
    expect(fileStorageService.saveTextArtifact).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      'review-result.json',
      expect.stringContaining('"mode": "DETERMINISTIC_ONLY"'),
    );
    expect(fileStorageService.saveTextArtifact).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      'review-result.json',
      expect.stringContaining('失败原因：AI 服务请求失败'),
    );
  });

  it('规则快审模式应跳过 AI 并仅输出有明确规则绑定的审核项', async () => {
    const repository = {
      getCurrentRuleSet: jest.fn(() => CONTRACT_REVIEW_RULE_SET),
      saveTask: jest.fn((task: ContractReviewTaskRecord) => task),
      replaceIssues: jest.fn(),
      replaceArtifacts: jest.fn(),
      listVisibleTasks: jest.fn(),
      findTaskById: jest.fn(),
      listIssuesByTaskId: jest.fn(() => []),
      listArtifactsByTaskId: jest.fn(() => []),
      findArtifactById: jest.fn(),
      findRuleSetByCodeVersion: jest.fn(),
    };
    const aiReviewService = {
      reviewDocument: jest.fn(),
    };
    const deterministicValidatorService = buildDeterministicValidatorService([
      {
        ruleCode: 'CR-PAY-001',
        validatorBinding: 'payment-term-limit',
        locator: '正文条款3',
        quote: '乙方应在验收后60日内收款。',
        reason: '检测到验收款账期为 60 天，超过公司标准 30 天。',
        suggestion: '控制账期',
        riskLevel: 'HIGH' as const,
        isVeto: false,
      },
    ]);

    const service = new ContractReviewService(
      repository as never,
      buildConfigService() as never,
      { buildAnnotatedDocx: jest.fn(() => Buffer.from('annotated-docx')) } as never,
      aiReviewService as never,
      deterministicValidatorService as never,
      {
        extract: jest.fn().mockReturnValue({
          title: '采购合作协议',
          summary: '已提取合同正文，准备进入规则审核。',
          fullText: '乙方应在验收后60日内收款。',
          paragraphs: [],
          headings: [],
          clauses: [],
        }),
      } as never,
      {
        extract: jest.fn(() => ({
          ...buildFactExtraction(),
          paymentFacts: [
            {
              locator: '正文条款3',
              text: '乙方应在验收后60日内收款。',
              stage: '验收款',
              days: 60,
            },
          ],
        })),
      } as never,
      {
        saveSourceFile: jest.fn().mockResolvedValue('c:/tmp/source.docx'),
        saveTextArtifact: jest
          .fn()
          .mockResolvedValueOnce('c:/tmp/review-report.md')
          .mockResolvedValueOnce('c:/tmp/review-result.json'),
        saveBinaryArtifact: jest.fn().mockResolvedValue('c:/tmp/annotated-review.docx'),
      } as never,
      buildSnapshotCompilerService(CONTRACT_REVIEW_RULE_SET, {
        executionMode: 'DETERMINISTIC_ONLY',
        checks: [
          {
            ...(CONTRACT_REVIEW_RULE_SET.items.find(
              (item) => item.code === 'CR-PAY-001',
            ) as unknown as Record<string, unknown>),
            group: '付款与回款',
            applicableContractTypes: ['购销合同'],
            validatorBindings: ['payment-term-limit'],
          },
          {
            ...(CONTRACT_REVIEW_RULE_SET.items.find(
              (item) => item.code === 'CR-IP-001',
            ) as unknown as Record<string, unknown>),
            group: '知识产权与许可',
            applicableContractTypes: ['购销合同'],
            validatorBindings: [],
          },
        ],
      }) as never,
      buildPackRuntimeService({
        defaultExecutionMode: 'DETERMINISTIC_ONLY',
      }) as never,
      { create: jest.fn() } as never,
      { resolveScope: jest.fn(() => scopeSnapshot) } as never,
      buildAccessDecisionService() as never,
    buildPermissionEnforcementService() as never,
    );

    await service.createTask(user, {
      originalname: '采购合作协议.docx',
      mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 2048,
      buffer: Buffer.from('mock-docx'),
    });

    await service.waitForTaskExecution();

    expect(aiReviewService.reviewDocument).not.toHaveBeenCalled();
    expect(deterministicValidatorService.validate).toHaveBeenCalled();
    expect(repository.replaceIssues).toHaveBeenCalledWith(expect.any(String), [
      expect.objectContaining({
        ruleCode: 'CR-PAY-001',
        description: expect.stringContaining('命中确定性校验'),
      }),
    ]);
    expect(repository.saveTask).toHaveBeenLastCalledWith(
      expect.objectContaining({
        latestStageMessage: expect.stringContaining('规则快审'),
        latestResultSummary: expect.stringContaining('规则快审'),
        reviewBasis: expect.objectContaining({
          executionMode: 'DETERMINISTIC_ONLY',
          degradationReason: undefined,
        }),
      }),
    );
  });

  it('AI 与确定性校验命中同一规则时应去重合并为一条问题', async () => {
    const ruleSet: typeof CONTRACT_REVIEW_RULE_SET = {
      ...CONTRACT_REVIEW_RULE_SET,
      items: [
        ...CONTRACT_REVIEW_RULE_SET.items.map((item) => ({ ...item })),
        {
          code: 'CR-INVOICE-001',
          category: '票税与结算',
          title: '开票名称缺少“*软件*”前缀',
          description: '软件产品开票名称必须保留“*软件*”前缀。',
          riskLevel: 'HIGH' as const,
          isVeto: true,
          sourceClause: '2.11 开票',
          keywords: ['开票', '软件', '发票'],
          suggestion: '按标准模板修正开票名称。',
        },
      ],
    };
    const savedIssues: ContractReviewIssueRecord[][] = [];
    const repository = {
      getCurrentRuleSet: jest.fn(() => ruleSet),
      saveTask: jest.fn((task: ContractReviewTaskRecord) => task),
      replaceIssues: jest.fn((taskId: string, issues: ContractReviewIssueRecord[]) => {
        savedIssues.push(issues);
        return issues;
      }),
      replaceArtifacts: jest.fn(),
      listVisibleTasks: jest.fn(),
      findTaskById: jest.fn(),
      listIssuesByTaskId: jest.fn(),
      listArtifactsByTaskId: jest.fn(),
      findArtifactById: jest.fn(),
      findRuleSetByCodeVersion: jest.fn(),
    };

    const service = new ContractReviewService(
      repository as never,
      buildConfigService() as never,
      { buildAnnotatedDocx: jest.fn(() => Buffer.from('annotated-docx')) } as never,
      {
        reviewDocument: jest.fn().mockResolvedValue([
          {
            ruleCode: 'CR-INVOICE-001',
            group: '票税与结算',
            locator: '正文条款2',
            quote: '开票名称为联软ESPP企业安全监测保护平台软件。',
            reason: 'AI 判断开票名称未保留“*软件*”前缀。',
            suggestion: '按模板修正开票名称。',
            confidence: 'HIGH',
            riskLevel: 'HIGH',
            isVeto: true,
          },
        ]),
      } as never,
      buildDeterministicValidatorService([
        {
          ruleCode: 'CR-INVOICE-001',
          validatorBinding: 'invoice-prefix',
          locator: '正文条款2',
          quote: '开票名称为联软ESPP企业安全监测保护平台软件。',
          reason: '检测到开票条款未体现“*软件*”前缀，存在退税与票税合规风险。',
          suggestion: '按标准报价清单修正。',
          riskLevel: 'HIGH',
          isVeto: true,
        },
      ]) as never,
      {
        extract: jest.fn().mockReturnValue({
          title: '采购合作协议',
          summary: '已提取合同正文，准备进入规则审核。',
          fullText: '开票名称为联软ESPP企业安全监测保护平台软件。',
          paragraphs: [
            {
              index: 1,
              text: '开票名称为联软ESPP企业安全监测保护平台软件。',
              locator: '正文条款2',
              source: 'document',
            },
          ],
          headings: [],
          clauses: [
            {
              index: 1,
              text: '开票名称为联软ESPP企业安全监测保护平台软件。',
              locator: '正文条款2',
              source: 'document',
            },
          ],
        }),
      } as never,
      { extract: jest.fn(() => buildFactExtraction()) } as never,
      {
        saveSourceFile: jest.fn().mockResolvedValue('c:/tmp/source.docx'),
        saveTextArtifact: jest
          .fn()
          .mockResolvedValueOnce('c:/tmp/review-report.md')
          .mockResolvedValueOnce('c:/tmp/review-result.json'),
        saveBinaryArtifact: jest.fn().mockResolvedValue('c:/tmp/annotated-review.docx'),
      } as never,
      buildSnapshotCompilerService(ruleSet) as never,
      buildPackRuntimeService() as never,
      { create: jest.fn() } as never,
      { resolveScope: jest.fn(() => scopeSnapshot) } as never,
      buildAccessDecisionService() as never,
    buildPermissionEnforcementService() as never,
    );

    await service.createTask(user, {
      originalname: '采购合作协议.docx',
      mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 2048,
      buffer: Buffer.from('mock-docx'),
    });
    await service.waitForTaskExecution();

    expect(savedIssues[0]).toHaveLength(1);
    expect(savedIssues[0][0]).toMatchObject({
      ruleCode: 'CR-INVOICE-001',
      description: expect.stringContaining('AI'),
      isVeto: true,
    });
  });

  it('应为历史任务纠正乱码合同名，并按问题列表重新计算风险统计口径', () => {
    const garbledFileName = Buffer.from(
      '2025年信息安全运维服务协议.docx',
      'utf8',
    ).toString('latin1');
    const task: ContractReviewTaskRecord = {
      id: 'task_legacy',
      requesterId: user.id,
      requesterName: user.name,
      originalFileName: garbledFileName,
      storedFilePath: 'c:/tmp/source.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileSize: 4096,
      status: 'COMPLETED',
      latestStageMessage: '审核完成',
      ruleSetCode: CONTRACT_REVIEW_RULE_SET.code,
      ruleSetVersion: CONTRACT_REVIEW_RULE_SET.version,
      overallDecision: 'REJECT',
      summary: '已完成审核。',
      latestResultSummary: '建议修改后再签署 · 一票否决 2 项 · 高风险 4 项',
      vetoCount: 2,
      highRiskCount: 4,
      mediumRiskCount: 1,
      lowRiskCount: 0,
      totalIssueCount: 5,
      createdAt: '2026-04-06T00:00:00.000Z',
      updatedAt: '2026-04-06T00:10:00.000Z',
      completedAt: '2026-04-06T00:10:00.000Z',
    };
    const issues: ContractReviewIssueRecord[] = [
      {
        id: 'issue_1',
        taskId: task.id,
        title: '知识产权归属异常',
        riskLevel: 'HIGH',
        isVeto: true,
        description: '命中一票否决项',
        suggestion: '调整知识产权归属',
        quote: '正文条款1：知识产权归客户独占所有。',
        ruleCode: 'CR-IP-001',
        ruleTitle: '知识产权条款',
        sourceClause: '知识产权条款',
        createdAt: '2026-04-06T00:00:00.000Z',
      },
      {
        id: 'issue_2',
        taskId: task.id,
        title: '发票抬头异常',
        riskLevel: 'HIGH',
        isVeto: true,
        description: '命中一票否决项',
        suggestion: '按模板修正发票名称',
        quote: '正文条款2：开票名称缺少“软件”前缀。',
        ruleCode: 'CR-INVOICE-001',
        ruleTitle: '开票条款',
        sourceClause: '开票条款',
        createdAt: '2026-04-06T00:01:00.000Z',
      },
      {
        id: 'issue_3',
        taskId: task.id,
        title: '付款节点缺少验收前置条件',
        riskLevel: 'HIGH',
        isVeto: false,
        description: '高风险问题',
        suggestion: '补充验收条件',
        quote: '正文条款3：验收前先付款。',
        ruleCode: 'CR-PAY-001',
        ruleTitle: '付款条款',
        sourceClause: '付款条款',
        createdAt: '2026-04-06T00:02:00.000Z',
      },
      {
        id: 'issue_4',
        taskId: task.id,
        title: '违约责任上限缺失',
        riskLevel: 'HIGH',
        isVeto: false,
        description: '高风险问题',
        suggestion: '补充赔付上限',
        quote: '正文条款4：违约责任不限额。',
        ruleCode: 'CR-LIABILITY-001',
        ruleTitle: '违约责任',
        sourceClause: '违约责任条款',
        createdAt: '2026-04-06T00:03:00.000Z',
      },
      {
        id: 'issue_5',
        taskId: task.id,
        title: '数据使用范围表述过宽',
        riskLevel: 'MEDIUM',
        isVeto: false,
        description: '中风险问题',
        suggestion: '补充使用范围限制',
        quote: '正文条款5：可使用客户全部资料。',
        ruleCode: 'CR-DATA-001',
        ruleTitle: '数据条款',
        sourceClause: '数据条款',
        createdAt: '2026-04-06T00:04:00.000Z',
      },
    ];
    const repository = {
      findTaskById: jest.fn(() => task),
      findRuleSetByCodeVersion: jest.fn(() => CONTRACT_REVIEW_RULE_SET),
      getCurrentRuleSet: jest.fn(() => CONTRACT_REVIEW_RULE_SET),
      listIssuesByTaskId: jest.fn(() => issues),
      listArtifactsByTaskId: jest.fn(() => []),
      findArtifactById: jest.fn(),
      listVisibleTasks: jest.fn(() => [task]),
      saveTask: jest.fn(),
      replaceIssues: jest.fn(),
      replaceArtifacts: jest.fn(),
    };
    const service = new ContractReviewService(
      repository as never,
      buildConfigService() as never,
      { buildAnnotatedDocx: jest.fn() } as never,
      { reviewDocument: jest.fn() } as never,
      buildDeterministicValidatorService() as never,
      { extract: jest.fn() } as never,
      { extract: jest.fn(() => buildFactExtraction()) } as never,
      { saveSourceFile: jest.fn(), saveTextArtifact: jest.fn(), saveBinaryArtifact: jest.fn() } as never,
      buildSnapshotCompilerService() as never,
      buildPackRuntimeService() as never,
      { create: jest.fn() } as never,
      { resolveScope: jest.fn(() => scopeSnapshot) } as never,
      buildAccessDecisionService() as never,
    buildPermissionEnforcementService() as never,
    );

    const detail = service.getTaskDetail(user, task.id);
    const list = service.listRecentTasks(user);

    expect(detail.contractName).toBe('2025年信息安全运维服务协议.docx');
    expect(detail.vetoCount).toBe(2);
    expect(detail.highRiskCount).toBe(2);
    expect(detail.mediumRiskCount).toBe(1);
    expect(detail.latestResultSummary).toBe(
      '建议修改后再签署 · 一票否决 2 项 · 高风险 2 项 · 中风险 1 项',
    );
    expect(detail.reviewBasis).toMatchObject({
      packCode: task.ruleSetCode,
      packVersion: task.ruleSetVersion,
      packChecksumSummary: 'mock-sum',
      modelProfile: 'codex-high',
      executionMode: 'AI_HYBRID',
    });
    expect(detail.naturalLanguageEntryCapability).toEqual({
      status: 'RESERVED',
      aiEntryRequired: true,
      targetWorkflow: 'CONTRACT_REVIEW_NATURAL_LANGUAGE_ROUTER',
      fixedPrecheckSteps: ['文件类型校验', '文件大小校验', '任务创建', '权限校验'],
    });
    expect(list.items[0]).toMatchObject({
      contractName: '2025年信息安全运维服务协议.docx',
      vetoCount: 2,
      highRiskCount: 2,
      mediumRiskCount: 1,
      reviewBasis: expect.objectContaining({
        packCode: task.ruleSetCode,
        packVersion: task.ruleSetVersion,
        packChecksumSummary: 'mock-sum',
        executionMode: 'AI_HYBRID',
      }),
      latestResultSummary: '建议修改后再签署 · 一票否决 2 项 · 高风险 2 项 · 中风险 1 项',
    });
  });

  it('应在单个产物生成失败时保留其他产物并标记失败原因', async () => {
    const ruleSet = {
      ...CONTRACT_REVIEW_RULE_SET,
      items: CONTRACT_REVIEW_RULE_SET.items.map((item) => ({ ...item })),
    };
    const artifactSnapshots: Array<Array<Record<string, unknown>>> = [];

    const repository = {
      getCurrentRuleSet: jest.fn(() => ruleSet),
      saveTask: jest.fn((task: ContractReviewTaskRecord) => task),
      replaceIssues: jest.fn(),
      replaceArtifacts: jest.fn((taskId: string, artifacts: Array<Record<string, unknown>>) => {
        artifactSnapshots.push(artifacts.map((artifact) => ({ ...artifact })));
        return artifacts;
      }),
      listVisibleTasks: jest.fn(),
      findTaskById: jest.fn(),
      listIssuesByTaskId: jest.fn(),
      listArtifactsByTaskId: jest.fn(),
      findArtifactById: jest.fn(),
      findRuleSetByCodeVersion: jest.fn(),
    };
    const configService = buildConfigService();
    const annotatedDocxService = {
      buildAnnotatedDocx: jest.fn(() => {
        throw new Error('批注生成失败');
      }),
    };
    const aiReviewService = {
      reviewDocument: jest.fn().mockResolvedValue([]),
    };
    const docxExtractorService = {
      extract: jest.fn().mockReturnValue({
        title: '标准合同',
        summary: '已提取合同正文，准备进入规则审核。',
        fullText: '付款需在验收通过后五个工作日内完成。',
        paragraphs: [
          {
            index: 1,
            text: '付款需在验收通过后五个工作日内完成。',
            locator: '正文条款1',
            source: 'document',
          },
        ],
        headings: [],
        clauses: [
          {
            index: 1,
            text: '付款需在验收通过后五个工作日内完成。',
            locator: '正文条款1',
            source: 'document',
          },
        ],
      }),
    };
    const fileStorageService = {
      saveSourceFile: jest.fn().mockResolvedValue('c:/tmp/source.docx'),
      saveTextArtifact: jest
        .fn()
        .mockResolvedValueOnce('c:/tmp/review-report.md')
        .mockResolvedValueOnce('c:/tmp/review-result.json'),
      saveBinaryArtifact: jest.fn(),
    };
    const auditEventRepository = {
      create: jest.fn(),
    };
    const userScopeService = {
      resolveScope: jest.fn(() => scopeSnapshot),
    };
    const factExtractorService = {
      extract: jest.fn(() => buildFactExtraction()),
    };
    const deterministicValidatorService = buildDeterministicValidatorService();
    const snapshotCompilerService = buildSnapshotCompilerService(ruleSet);
    const skillPackRuntimeService = buildPackRuntimeService();

    const service = new ContractReviewService(
      repository as never,
      configService as never,
      annotatedDocxService as never,
      aiReviewService as never,
      deterministicValidatorService as never,
      docxExtractorService as never,
      factExtractorService as never,
      fileStorageService as never,
      snapshotCompilerService as never,
      skillPackRuntimeService as never,
      auditEventRepository as never,
      userScopeService as never,
      buildAccessDecisionService() as never,
    buildPermissionEnforcementService() as never,
    );

    const result = await service.createTask(user, {
      originalname: '标准采购合同.docx',
      mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 2048,
      buffer: Buffer.from('mock-docx'),
    });

    expect(result.status).toBe('UPLOADED');
    await service.waitForTaskExecution();
    const finalArtifacts = artifactSnapshots.at(-1);
    expect(finalArtifacts).toBeDefined();
    expect(finalArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          artifactType: 'REPORT',
          status: 'AVAILABLE',
          reviewBasis: expect.objectContaining({
            packCode: ruleSet.code,
            packVersion: ruleSet.version,
            executionMode: 'AI_HYBRID',
          }),
        }),
        expect.objectContaining({
          artifactType: 'STRUCTURED_RESULT',
          status: 'AVAILABLE',
          reviewBasis: expect.objectContaining({
            packCode: ruleSet.code,
            packVersion: ruleSet.version,
            executionMode: 'AI_HYBRID',
          }),
        }),
        expect.objectContaining({
          artifactType: 'ANNOTATED_DOCX',
          status: 'FAILED',
          failureReason: '批注生成失败',
        }),
      ]),
    );
    expect(finalArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          artifactType: 'ANNOTATED_DOCX',
          reviewBasis: expect.objectContaining({
            packCode: ruleSet.code,
            packVersion: ruleSet.version,
            executionMode: 'AI_HYBRID',
          }),
        }),
      ]),
    );
  });

  it('正文提取失败时应阻断任务并写入阻断审计事件', async () => {
    const savedTasks: ContractReviewTaskRecord[] = [];
    const repository = {
      getCurrentRuleSet: jest.fn(() => CONTRACT_REVIEW_RULE_SET),
      saveTask: jest.fn((task: ContractReviewTaskRecord) => {
        savedTasks.push(task);
        return task;
      }),
      replaceIssues: jest.fn(),
      replaceArtifacts: jest.fn(),
      listVisibleTasks: jest.fn(),
      findTaskById: jest.fn(),
      listIssuesByTaskId: jest.fn(),
      listArtifactsByTaskId: jest.fn(),
      findArtifactById: jest.fn(),
      findRuleSetByCodeVersion: jest.fn(),
    };
    const auditEventRepository = {
      create: jest.fn(),
    };
    const service = new ContractReviewService(
      repository as never,
      buildConfigService() as never,
      { buildAnnotatedDocx: jest.fn() } as never,
      { reviewDocument: jest.fn() } as never,
      buildDeterministicValidatorService() as never,
      {
        extract: jest.fn(() => {
          throw new BadRequestException('当前 .docx 文件缺少正文内容，无法继续审核。');
        }),
      } as never,
      { extract: jest.fn(() => buildFactExtraction()) } as never,
      {
        saveSourceFile: jest.fn().mockResolvedValue('c:/tmp/source.docx'),
        saveTextArtifact: jest.fn(),
        saveBinaryArtifact: jest.fn(),
      } as never,
      buildSnapshotCompilerService() as never,
      buildPackRuntimeService() as never,
      auditEventRepository as never,
      { resolveScope: jest.fn(() => scopeSnapshot) } as never,
      buildAccessDecisionService() as never,
    buildPermissionEnforcementService() as never,
    );

    const result = await service.createTask(user, {
      originalname: '损坏合同.docx',
      mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 2048,
      buffer: Buffer.from('broken-docx'),
    });
    expect(result.status).toBe('UPLOADED');
    await service.waitForTaskExecution();

    expect(savedTasks.map((task) => task.status)).toEqual(['UPLOADED', 'PARSING', 'BLOCKED']);
    expect(savedTasks.at(-1)).toMatchObject({
      status: 'BLOCKED',
      ruleSetCode: CONTRACT_REVIEW_RULE_SET.code,
      ruleSetVersion: CONTRACT_REVIEW_RULE_SET.version,
      latestStageMessage: '当前 .docx 文件缺少正文内容，无法继续审核。',
    });
    expect(savedTasks.at(-1)?.reviewBasis).toMatchObject({
      packCode: CONTRACT_REVIEW_RULE_SET.code,
      packVersion: CONTRACT_REVIEW_RULE_SET.version,
      executionMode: 'BLOCKED',
    });
    expect(auditEventRepository.create.mock.calls.map(([event]) => event.eventType)).toEqual([
      'CONTRACT_REVIEW_FILE_UPLOADED',
      'CONTRACT_REVIEW_TASK_CREATED',
      'CONTRACT_REVIEW_TASK_BLOCKED',
    ]);
    expect(auditEventRepository.create.mock.calls[2][0]).toMatchObject({
      contractReviewReviewBasis: expect.objectContaining({
        packCode: CONTRACT_REVIEW_RULE_SET.code,
        packVersion: CONTRACT_REVIEW_RULE_SET.version,
        executionMode: 'BLOCKED',
      }),
    });
  });

  it('任务详情应优先返回任务绑定的规则快照', () => {
    const historicalRuleSet = {
      ...CONTRACT_REVIEW_RULE_SET,
      version: '2026-03-01',
      title: '历史合同审核规则快照',
      summary: '历史规则快照摘要',
      items: CONTRACT_REVIEW_RULE_SET.items.map((item) => ({ ...item })),
    };
    const currentRuleSet = {
      ...CONTRACT_REVIEW_RULE_SET,
      version: '2026-04-01',
      title: '当前合同审核规则',
      summary: '当前规则摘要',
      items: CONTRACT_REVIEW_RULE_SET.items.map((item) => ({ ...item })),
    };
    const task: ContractReviewTaskRecord = {
      id: 'task_snapshot',
      requesterId: user.id,
      requesterName: user.name,
      originalFileName: '历史合同.docx',
      storedFilePath: 'c:/tmp/source.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileSize: 4096,
      status: 'COMPLETED',
      latestStageMessage: '审核完成',
      ruleSetCode: historicalRuleSet.code,
      ruleSetVersion: historicalRuleSet.version,
      overallDecision: 'REVISE',
      summary: '已基于历史规则完成审核。',
      latestResultSummary: '建议修改后再签署',
      vetoCount: 0,
      highRiskCount: 1,
      mediumRiskCount: 0,
      lowRiskCount: 0,
      totalIssueCount: 1,
      createdAt: '2026-04-06T00:00:00.000Z',
      updatedAt: '2026-04-06T00:10:00.000Z',
      completedAt: '2026-04-06T00:10:00.000Z',
    };
    const repository = {
      findTaskById: jest.fn(() => task),
      findRuleSetByCodeVersion: jest.fn(() => historicalRuleSet),
      getCurrentRuleSet: jest.fn(() => currentRuleSet),
      listIssuesByTaskId: jest.fn(() => []),
      listArtifactsByTaskId: jest.fn(() => []),
      findArtifactById: jest.fn(),
      listVisibleTasks: jest.fn(),
      saveTask: jest.fn(),
      replaceIssues: jest.fn(),
      replaceArtifacts: jest.fn(),
    };
    const service = new ContractReviewService(
      repository as never,
      buildConfigService() as never,
      { buildAnnotatedDocx: jest.fn() } as never,
      { reviewDocument: jest.fn() } as never,
      buildDeterministicValidatorService() as never,
      { extract: jest.fn() } as never,
      { extract: jest.fn(() => buildFactExtraction()) } as never,
      { saveSourceFile: jest.fn(), saveTextArtifact: jest.fn(), saveBinaryArtifact: jest.fn() } as never,
      buildSnapshotCompilerService() as never,
      buildPackRuntimeService() as never,
      { create: jest.fn() } as never,
      { resolveScope: jest.fn(() => scopeSnapshot) } as never,
      buildAccessDecisionService() as never,
    buildPermissionEnforcementService() as never,
    );

    const detail = service.getTaskDetail(user, task.id);

    expect(detail.ruleSet).toEqual({
      code: historicalRuleSet.code,
      version: historicalRuleSet.version,
      title: historicalRuleSet.title,
      summary: historicalRuleSet.summary,
    });
    expect(detail.reviewBasis).toMatchObject({
      packCode: historicalRuleSet.code,
      packVersion: historicalRuleSet.version,
      packChecksumSummary: 'legacy',
      modelProfile: 'unknown',
      executionMode: 'AI_HYBRID',
    });
    expect(repository.findRuleSetByCodeVersion).toHaveBeenCalledWith(
      historicalRuleSet.code,
      historicalRuleSet.version,
    );
    expect(repository.getCurrentRuleSet).not.toHaveBeenCalled();
  });

  it('未授权用户访问他人任务详情或下载产物时应拒绝', () => {
    const anotherUser: CrmUser = {
      ...user,
      id: 'user_region_manager',
      name: '区域经理',
      roleIds: ['role_region_manager'],
      roleNames: ['区域经理'],
      exportAllowed: false,
    };
    const task: ContractReviewTaskRecord = {
      id: 'task_other',
      requesterId: 'user_sales_director',
      requesterName: '销售总监',
      originalFileName: '采购合同.docx',
      storedFilePath: 'c:/tmp/source.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileSize: 2048,
      status: 'COMPLETED',
      latestStageMessage: '审核完成',
      ruleSetCode: CONTRACT_REVIEW_RULE_SET.code,
      ruleSetVersion: CONTRACT_REVIEW_RULE_SET.version,
      overallDecision: 'REJECT',
      summary: '审核完成',
      latestResultSummary: '建议修改后再签署',
      vetoCount: 1,
      highRiskCount: 1,
      mediumRiskCount: 0,
      lowRiskCount: 0,
      totalIssueCount: 1,
      createdAt: '2026-04-06T00:00:00.000Z',
      updatedAt: '2026-04-06T00:10:00.000Z',
      completedAt: '2026-04-06T00:10:00.000Z',
    };
    const artifact: ContractReviewArtifactRecord = {
      id: 'artifact_1',
      taskId: task.id,
      artifactType: 'REPORT',
      fileName: '审核报告.md',
      filePath: 'c:/tmp/review-report.md',
      mimeType: 'text/markdown',
      status: 'AVAILABLE',
      createdAt: '2026-04-06T00:00:00.000Z',
      updatedAt: '2026-04-06T00:10:00.000Z',
    };
    const repository = {
      findTaskById: jest.fn(() => task),
      findRuleSetByCodeVersion: jest.fn(() => CONTRACT_REVIEW_RULE_SET),
      getCurrentRuleSet: jest.fn(() => CONTRACT_REVIEW_RULE_SET),
      listIssuesByTaskId: jest.fn(() => []),
      listArtifactsByTaskId: jest.fn(() => [artifact]),
      findArtifactById: jest.fn(() => artifact),
      listVisibleTasks: jest.fn(),
      saveTask: jest.fn(),
      replaceIssues: jest.fn(),
      replaceArtifacts: jest.fn(),
    };
    const service = new ContractReviewService(
      repository as never,
      buildConfigService() as never,
      { buildAnnotatedDocx: jest.fn() } as never,
      { reviewDocument: jest.fn() } as never,
      buildDeterministicValidatorService() as never,
      { extract: jest.fn() } as never,
      { extract: jest.fn(() => buildFactExtraction()) } as never,
      { saveSourceFile: jest.fn(), saveTextArtifact: jest.fn(), saveBinaryArtifact: jest.fn() } as never,
      buildSnapshotCompilerService() as never,
      buildPackRuntimeService() as never,
      { create: jest.fn() } as never,
      { resolveScope: jest.fn(() => scopeSnapshot) } as never,
      buildAccessDecisionService() as never,
    buildPermissionEnforcementService() as never,
    );

    expect(() => service.getTaskDetail(anotherUser, task.id)).toThrow(
      '当前仅允许查看本人创建的合同审核任务，或由授权角色查看。',
    );
    expect(() => service.getArtifactDownload(anotherUser, task.id, artifact.id)).toThrow(
      '当前无权下载该合同审核产物。',
    );
  });

  it('授权查看角色可查看他人任务详情，授权下载角色可下载他人产物', () => {
    const reviewerUser: CrmUser = {
      ...user,
      id: 'user_auditor',
      name: '审计管理员',
      roleIds: ['role_contract_auditor'],
      roleNames: ['审计管理员'],
      exportAllowed: false,
    };
    const downloaderUser: CrmUser = {
      ...user,
      id: 'user_legal',
      name: '法务复核',
      roleIds: ['role_contract_downloader'],
      roleNames: ['法务复核'],
      exportAllowed: false,
    };
    const task: ContractReviewTaskRecord = {
      id: 'task_other',
      requesterId: 'user_sales_director',
      requesterName: '销售总监',
      originalFileName: '采购合同.docx',
      storedFilePath: 'c:/tmp/source.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileSize: 2048,
      status: 'COMPLETED',
      latestStageMessage: '审核完成',
      ruleSetCode: CONTRACT_REVIEW_RULE_SET.code,
      ruleSetVersion: CONTRACT_REVIEW_RULE_SET.version,
      overallDecision: 'REJECT',
      summary: '审核完成',
      latestResultSummary: '建议修改后再签署',
      vetoCount: 1,
      highRiskCount: 1,
      mediumRiskCount: 0,
      lowRiskCount: 0,
      totalIssueCount: 1,
      createdAt: '2026-04-06T00:00:00.000Z',
      updatedAt: '2026-04-06T00:10:00.000Z',
      completedAt: '2026-04-06T00:10:00.000Z',
    };
    const artifact: ContractReviewArtifactRecord = {
      id: 'artifact_1',
      taskId: task.id,
      artifactType: 'REPORT',
      fileName: '审核报告.md',
      filePath: 'c:/tmp/review-report.md',
      mimeType: 'text/markdown',
      status: 'AVAILABLE',
      createdAt: '2026-04-06T00:00:00.000Z',
      updatedAt: '2026-04-06T00:10:00.000Z',
    };
    const repository = {
      findTaskById: jest.fn(() => task),
      findRuleSetByCodeVersion: jest.fn(() => CONTRACT_REVIEW_RULE_SET),
      getCurrentRuleSet: jest.fn(() => CONTRACT_REVIEW_RULE_SET),
      listIssuesByTaskId: jest.fn(() => []),
      listArtifactsByTaskId: jest.fn(() => [artifact]),
      findArtifactById: jest.fn(() => artifact),
      listVisibleTasks: jest.fn((currentUser: CrmUser, allowAllVisible: boolean) => {
        if (currentUser.id === reviewerUser.id) {
          return allowAllVisible ? [task] : [];
        }

        return currentUser.id === task.requesterId ? [task] : [];
      }),
      saveTask: jest.fn(),
      replaceIssues: jest.fn(),
      replaceArtifacts: jest.fn(),
    };
    const auditEventRepository = {
      create: jest.fn(),
    };
    const service = new ContractReviewService(
      repository as never,
      buildConfigService({
        reviewerRoleIds: ['role_contract_auditor'],
        downloaderRoleIds: ['role_contract_downloader'],
      }) as never,
      { buildAnnotatedDocx: jest.fn() } as never,
      { reviewDocument: jest.fn() } as never,
      buildDeterministicValidatorService() as never,
      { extract: jest.fn() } as never,
      { extract: jest.fn(() => buildFactExtraction()) } as never,
      { saveSourceFile: jest.fn(), saveTextArtifact: jest.fn(), saveBinaryArtifact: jest.fn() } as never,
      buildSnapshotCompilerService() as never,
      buildPackRuntimeService() as never,
      auditEventRepository as never,
      { resolveScope: jest.fn(() => scopeSnapshot) } as never,
      buildAccessDecisionService({
        allowedActionKeys: [
          'contract.review.cross_view',
          'contract.review.cross_download',
        ],
      }) as never,
      buildPermissionEnforcementService() as never,
    );

    const detail = service.getTaskDetail(reviewerUser, task.id);
    const artifactRecord = service.getArtifactDownload(
      downloaderUser,
      task.id,
      artifact.id,
    );
    const list = service.listRecentTasks(reviewerUser);

    expect(detail.taskId).toBe(task.id);
    expect(detail.reviewBasis).toMatchObject({
      packCode: task.ruleSetCode,
      packVersion: task.ruleSetVersion,
      packChecksum: 'mock-checksum',
      modelProfile: 'codex-high',
      executionMode: 'AI_HYBRID',
    });
    expect(artifactRecord.id).toBe(artifact.id);
    expect(artifactRecord.reviewBasis).toMatchObject({
      packCode: task.ruleSetCode,
      packVersion: task.ruleSetVersion,
      packChecksum: 'mock-checksum',
      modelProfile: 'codex-high',
      executionMode: 'AI_HYBRID',
    });
    expect(repository.listVisibleTasks).toHaveBeenCalledWith(reviewerUser, false);
    expect(list.items).toHaveLength(0);
    expect(auditEventRepository.create.mock.calls.map(([event]) => event.eventType)).toEqual([
      'CONTRACT_REVIEW_ARTIFACT_DOWNLOADED',
    ]);
  });

  it('支持将 AI 补充发现映射为审核问题记录', async () => {
    const snapshotCompilerService = buildSnapshotCompilerService();
    const packSnapshot = snapshotCompilerService.compile();
    const service = new ContractReviewService(
      {} as never,
      buildConfigService() as never,
      {} as never,
      {
        reviewDocument: jest.fn().mockResolvedValue([
          {
            reviewType: 'SUPPLEMENTAL',
            ruleCode: 'AI-SUPPLEMENTAL-001',
            title: '主体信息缺失',
            sourceClause: '1.1 乙方信息完整性',
            locator: '第1条',
            quote: '乙方统一社会信用代码未填写',
            reason: '合同缺少乙方主体信息，无法满足公司审核要求。',
            suggestion: '补齐乙方统一社会信用代码、注册地址和法定代表人。',
            confidence: 'HIGH',
            riskLevel: 'HIGH',
            isVeto: false,
          },
        ]),
      } as never,
      buildDeterministicValidatorService() as never,
      {} as never,
      {} as never,
      {} as never,
      snapshotCompilerService as never,
      buildPackRuntimeService() as never,
      {} as never,
      {} as never,
      buildAccessDecisionService() as never,
    buildPermissionEnforcementService() as never,
    );

    const issues = await (service as any).buildAiReviewedIssues(
      'task_supplemental',
      {
        title: '测试合同',
        summary: '测试摘要',
        fullText: '测试正文',
        paragraphs: [],
        headings: [],
        clauses: [],
      },
      packSnapshot,
      buildFactExtraction(),
      '# requirements',
      '# workflow',
      {
        planner: 'planner',
        reviewer: 'reviewer',
        summarizer: 'summarizer',
      },
      '2026-04-07T00:00:00.000Z',
    );

    expect(issues).toEqual([
      expect.objectContaining({
        ruleCode: 'AI-SUPPLEMENTAL-001',
        title: '主体信息缺失',
        ruleTitle: '主体信息缺失',
        sourceClause: '1.1 乙方信息完整性',
        riskLevel: 'HIGH',
        isVeto: false,
      }),
    ]);
  });

  it('会清理 AI_HYBRID 模式下遗留的降级说明', () => {
    const task: ContractReviewTaskRecord = {
      id: 'task_hybrid_stale_reason',
      requesterId: user.id,
      requesterName: user.name,
      originalFileName: '测试合同.docx',
      storedFilePath: 'c:/tmp/source.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileSize: 2048,
      status: 'COMPLETED',
      latestStageMessage: '审核完成',
      ruleSetCode: CONTRACT_REVIEW_RULE_SET.code,
      ruleSetVersion: CONTRACT_REVIEW_RULE_SET.version,
      overallDecision: 'REVISE',
      summary: '测试摘要',
      latestResultSummary: '建议修改后再签署',
      vetoCount: 0,
      highRiskCount: 1,
      mediumRiskCount: 0,
      lowRiskCount: 0,
      totalIssueCount: 1,
      reviewBasis: {
        packCode: CONTRACT_REVIEW_RULE_SET.code,
        packVersion: CONTRACT_REVIEW_RULE_SET.version,
        packChecksum: 'mock-checksum',
        packChecksumSummary: 'mock-sum',
        modelProfile: 'codex-high',
        executionMode: 'AI_HYBRID',
        degradationReason: 'AI 审核不可用，当前结果基于确定性校验生成，仅供初筛。',
      },
      createdAt: '2026-04-07T00:00:00.000Z',
      updatedAt: '2026-04-07T00:10:00.000Z',
      completedAt: '2026-04-07T00:10:00.000Z',
    };
    const repository = {
      findTaskById: jest.fn(() => task),
      findRuleSetByCodeVersion: jest.fn(() => CONTRACT_REVIEW_RULE_SET),
      getCurrentRuleSet: jest.fn(() => CONTRACT_REVIEW_RULE_SET),
      listIssuesByTaskId: jest.fn(() => []),
      listArtifactsByTaskId: jest.fn(() => []),
      findArtifactById: jest.fn(),
      listVisibleTasks: jest.fn(() => [task]),
      saveTask: jest.fn(),
      replaceIssues: jest.fn(),
      replaceArtifacts: jest.fn(),
    };
    const service = new ContractReviewService(
      repository as never,
      buildConfigService() as never,
      {} as never,
      {} as never,
      buildDeterministicValidatorService() as never,
      {} as never,
      {} as never,
      {} as never,
      buildSnapshotCompilerService() as never,
      buildPackRuntimeService() as never,
      { create: jest.fn() } as never,
      { resolveScope: jest.fn(() => scopeSnapshot) } as never,
      buildAccessDecisionService() as never,
    buildPermissionEnforcementService() as never,
    );

    const detail = service.getTaskDetail(user, task.id);
    const list = service.listRecentTasks(user);

    expect(detail.reviewBasis.executionMode).toBe('AI_HYBRID');
    expect(detail.reviewBasis.degradationReason).toBeUndefined();
    expect(list.items[0].reviewBasis.executionMode).toBe('AI_HYBRID');
    expect(list.items[0].reviewBasis.degradationReason).toBeUndefined();
  });

  it('应在 CRM 合同快照缺少审核正文时仍能创建任务并回退生成最小正文', async () => {
    const savedTasks: ContractReviewTaskRecord[] = [];
    const repository = {
      getCurrentRuleSet: jest.fn(() => CONTRACT_REVIEW_RULE_SET),
      saveTask: jest.fn((task: ContractReviewTaskRecord) => {
        savedTasks.push(task);
        return task;
      }),
      replaceIssues: jest.fn(),
      replaceArtifacts: jest.fn(),
      listVisibleTasks: jest.fn(),
      findTaskById: jest.fn(),
      listIssuesByTaskId: jest.fn(() => []),
      listArtifactsByTaskId: jest.fn(() => []),
      findArtifactById: jest.fn(),
      findRuleSetByCodeVersion: jest.fn(() => CONTRACT_REVIEW_RULE_SET),
    };
    const auditEventRepository = {
      create: jest.fn(),
    };
    const service = new ContractReviewService(
      repository as never,
      buildConfigService() as never,
      { buildAnnotatedDocx: jest.fn(() => Buffer.from('mock-docx')) } as never,
      { reviewDocument: jest.fn(async () => []), reviewSupplementalChecks: jest.fn() } as never,
      buildDeterministicValidatorService() as never,
      { extract: jest.fn() } as never,
      { extract: jest.fn(() => buildFactExtraction()) } as never,
      {
        saveSourceFile: jest.fn(),
        saveTextArtifact: jest.fn(async () => 'artifact.txt'),
        saveBinaryArtifact: jest.fn(async () => 'artifact.docx'),
      } as never,
      buildSnapshotCompilerService() as never,
      buildPackRuntimeService() as never,
      auditEventRepository as never,
      { resolveScope: jest.fn(() => scopeSnapshot) } as never,
      buildAccessDecisionService() as never,
      buildPermissionEnforcementService() as never,
    );
    const malformedSourceContract = {
      contractId: 80057,
      contractName: '  华东续约合同  ',
      customerName: '  华东客户  ',
      ownerId: 7001,
      ownerName: '  张三  ',
      organizationId: 9,
      totalAmount: '128000.50',
      specialTermBlocks: ['  回款节点 30 天内  ', '   '],
      approvalHistory: [
        {
          step: '1',
          status: 1,
          approverId: 6001,
          approverName: '  法务经理  ',
          comment: '  请重点核对回款条款  ',
        },
      ],
      approveStatus: 3,
      pendingStep: '1',
      sourceSummary: '   ',
      reviewContent: '   ',
    } as unknown as ContractReviewSourceContractSnapshotRecord;

    const response = await service.createTaskFromCrmContract(
      user,
      malformedSourceContract,
    );

    expect(response.taskId).toBeTruthy();
    expect(savedTasks[0]).toMatchObject({
      sourceType: 'CRM_PENDING_APPROVAL',
      sourceContractId: '80057',
      originalFileName: '华东续约合同',
      summary: '合同名称：华东续约合同 / 客户：华东客户 / 负责人：张三 / 审批状态：3 / 审批级次：第 1 级',
    });
    expect(savedTasks[0]?.sourceContractSnapshot?.reviewContent).toContain('合同名称：华东续约合同');
    expect(savedTasks[0]?.sourceContractSnapshot?.reviewContent).toContain('审批历史');
    expect(savedTasks[0]?.fileSize).toBeGreaterThan(0);

    await service.waitForTaskExecution();
  });
});

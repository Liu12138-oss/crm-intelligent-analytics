import { ContractReviewAiReviewService } from '../src/modules/contract-review/contract-review.ai-review.service';
import type { ContractReviewFactExtractionResult, ContractReviewSkillPackSnapshot } from '../src/modules/contract-review/contract-review.runtime.types';
import type { ContractReviewDocumentSnapshot } from '../src/modules/contract-review/contract-review.types';

describe('ContractReviewAiReviewService', () => {
  const documentSnapshot: ContractReviewDocumentSnapshot = {
    title: '采购合作协议',
    summary: '已提取合同正文，准备进入按组审查阶段。',
    fullText:
      '知识产权及源代码归甲方独占所有。产品税率为13%。乙方应在验收后60日内收款。',
    paragraphs: [
      {
        index: 1,
        text: '知识产权及源代码归甲方独占所有。',
        locator: '正文条款1',
        source: 'document',
      },
      {
        index: 2,
        text: '产品税率为13%。',
        locator: '正文条款2',
        source: 'document',
      },
      {
        index: 3,
        text: '乙方应在验收后60日内收款。',
        locator: '正文条款3',
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
      {
        index: 2,
        text: '产品税率为13%。',
        locator: '正文条款2',
        source: 'document',
      },
      {
        index: 3,
        text: '乙方应在验收后60日内收款。',
        locator: '正文条款3',
        source: 'document',
      },
    ],
  };

  const factExtraction = {
    extractedAt: '2026-04-06T00:00:00.000Z',
    contractTypes: ['购销合同'],
    amountFacts: [],
    taxRateFacts: [
      {
        locator: '正文条款2',
        text: '产品税率为13%。',
        taxRate: 13,
        kind: 'PRODUCT',
      },
    ],
    paymentFacts: [
      {
        locator: '正文条款3',
        text: '乙方应在验收后60日内收款。',
        stage: '验收款',
        days: 60,
      },
    ],
    discountFacts: [],
    penaltyFacts: [],
    invoiceFacts: [],
    intellectualPropertyFacts: [
      {
        locator: '正文条款1',
        text: '知识产权及源代码归甲方独占所有。',
        ownership: 'PARTY_A',
        hasExclusiveLanguage: true,
        allowsReverseEngineering: false,
      },
    ],
    licenseDeliveryFacts: [],
    templateMatchFacts: [
      {
        templateCode: 'sales-purchase-standard-v2025',
        templateLabel: '联软购销合同标准模板（含廉洁协议）',
        matched: true,
        score: 3,
        signals: ['标题命中', '乙方固定主体信息命中', '付款方式分支结构命中'],
      },
    ],
    templateSlotFacts: [
      {
        templateCode: 'sales-purchase-standard-v2025',
        slotCode: 'sales-contract-number',
        slotLabel: '合同编号',
        status: 'PLACEHOLDER',
        locator: '正文条款0',
        text: '合同编号：',
        value: 'LS年月日-邮箱地址-区号-合同编号',
        note: '仍为模板占位或未填写内容。',
      },
    ],
    summary: '识别合同类型：购销合同；金额 0 项；税率 1 项；付款 1 项；违约 0 项；开票 0 项；知识产权 1 项',
  } as unknown as ContractReviewFactExtractionResult;

  const packSnapshot: ContractReviewSkillPackSnapshot = {
    packCode: 'company-commercial-v1',
    packVersion: '2026.04',
    packTitle: '公司商务合同审核标准',
    packSummary: '测试用 pack snapshot',
    packChecksum: 'mock-checksum',
    packChecksumSummary: 'mock-sum',
    compiledAt: '2026-04-06T00:00:00.000Z',
    executionMode: 'AI_HYBRID',
    modelProfile: 'codex-high',
    selectedContractTypes: ['购销合同'],
    promptFingerprints: {
      planner: 'planner-hash',
      reviewer: 'reviewer-hash',
      summarizer: 'summarizer-hash',
    },
    deterministicValidators: [],
    checkCount: 3,
    groups: [
      {
        group: '知识产权与许可',
        checkCodes: ['CR-IP-001'],
      },
      {
        group: '票税与结算',
        checkCodes: ['CR-TAX-001'],
      },
      {
        group: '付款与回款',
        checkCodes: ['CR-PAY-001'],
      },
    ],
    checks: [
      {
        code: 'CR-IP-001',
        group: '知识产权与许可',
        category: '知识产权',
        title: '知识产权、源代码不得归客户独有',
        description: '命中知识产权一票否决项',
        riskLevel: 'HIGH',
        isVeto: true,
        sourceClause: '二、2.7',
        keywords: ['知识产权', '源代码'],
        suggestion: '改为乙方所有',
        applicableContractTypes: ['购销合同'],
        validatorBindings: [],
      },
      {
        code: 'CR-TAX-001',
        group: '票税与结算',
        category: '税率',
        title: '税率必须符合标准',
        description: '命中税率检查项',
        riskLevel: 'MEDIUM',
        isVeto: false,
        sourceClause: '二、2.2',
        keywords: ['税率'],
        suggestion: '核对税率',
        applicableContractTypes: ['购销合同'],
        validatorBindings: [],
      },
      {
        code: 'CR-PAY-001',
        group: '付款与回款',
        category: '付款条件',
        title: '付款账期需符合标准',
        description: '命中付款账期检查项',
        riskLevel: 'HIGH',
        isVeto: false,
        sourceClause: '一、1.3',
        keywords: ['付款', '验收款'],
        suggestion: '控制账期',
        applicableContractTypes: ['购销合同'],
        validatorBindings: [],
      },
    ],
  };

  const promptSet = {
    planner: 'planner prompt',
    reviewer: 'reviewer prompt',
    summarizer: 'summarizer prompt',
  };
  const requirementsText = '# requirements\n## 主体信息\n- 甲乙方主体信息必须完整。';
  const workflowText = '# workflow\n## 审核步骤\n- 发现未纳入 checks 的高风险时，补充输出风险发现。';

  const buildService = (enabled = true, maxParallelGroups = 2) =>
    new ContractReviewAiReviewService(
      {
        getAiConfig: jest.fn(() => ({
          enabled,
          sdkType: enabled ? 'openai-compatible-http' : undefined,
          baseUrl: enabled ? 'http://mock-ai.local' : undefined,
          model: enabled ? 'gpt-5.4' : undefined,
          apiKey: enabled ? 'mock-key' : undefined,
          modelProvider: enabled ? 'aicodex_codex_codex' : undefined,
          reasoningEffort: 'high',
          wireApi: enabled ? 'responses' : undefined,
          requiresOpenaiAuth: enabled ? true : undefined,
          disableResponseStorage: enabled ? true : undefined,
          codexPath: enabled ? 'codex' : undefined,
          proxyEnv: enabled ? { HTTPS_PROXY: 'http://127.0.0.1:7890' } : undefined,
        })),
        getRepoRoot: jest.fn(() => 'c:/code/CRM-Agent'),
      } as never,
      {
        logStep: jest.fn(),
        logWarn: jest.fn(),
      } as never,
      {
        getAiReviewTimeoutMs: jest.fn(() => 90000),
        getAiMaxParallelGroups: jest.fn(() => maxParallelGroups),
      } as never,
    );

  it('应在 AI 可用时按检查组构建审查输入', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      const service = buildService(true);
      const runSpy = jest
        .spyOn(service as any, 'runGroupedCodexReviewPrompts')
        .mockResolvedValue([
          {
            ruleCode: 'CR-IP-001',
            group: '知识产权与许可',
            locator: '正文条款1',
            quote: '知识产权及源代码归甲方独占所有。',
            reason: '命中知识产权独占条款。',
            suggestion: '改为乙方所有。',
            confidence: 'HIGH',
            riskLevel: 'HIGH',
            isVeto: true,
          },
        ]);

      const result = await service.reviewDocument({
        documentSnapshot,
        packSnapshot,
        factExtraction,
        requirementsText,
        workflowText,
        promptSet,
      });

      expect(result).toHaveLength(1);
      expect(runSpy).toHaveBeenCalledTimes(1);
      expect(runSpy.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          sdkType: 'openai-compatible-http',
          apiKey: 'mock-key',
          baseUrl: 'http://mock-ai.local',
          model: 'gpt-5.4',
          modelProvider: 'aicodex_codex_codex',
          wireApi: 'responses',
          requiresOpenaiAuth: true,
          disableResponseStorage: true,
          codexPath: 'codex',
          proxyEnv: { HTTPS_PROXY: 'http://127.0.0.1:7890' },
        }),
      );
      expect(runSpy.mock.calls[0][2]).toEqual([
        expect.objectContaining({
          group: expect.stringContaining('合并批次'),
          checks: expect.arrayContaining([
            expect.objectContaining({ code: 'CR-IP-001' }),
            expect.objectContaining({ code: 'CR-TAX-001' }),
            expect.objectContaining({ code: 'CR-PAY-001' }),
          ]),
        }),
      ]);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('应生成包含固定字段的 JSON schema', () => {
    const service = buildService(true);
    const schema = (service as any).buildGroupOutputSchema({
      group: '知识产权与许可',
      checks: [packSnapshot.checks[0]],
    }) as {
      properties: {
        results: {
          items: {
            required: string[];
            properties: Record<string, unknown>;
          };
        };
        additionalFindings: {
          items: {
            required: string[];
            properties: Record<string, unknown>;
          };
        };
      };
    };

    expect(schema.properties.results.items.required).toEqual(
      expect.arrayContaining([
        'checkId',
        'result',
        'riskLevel',
        'isVeto',
        'quote',
        'locator',
        'reason',
        'suggestion',
        'confidence',
      ]),
    );
    expect(schema.properties.results.items.properties).toHaveProperty('checkId');
    expect(schema.properties.results.items.properties).toHaveProperty('result');
    expect(schema.properties.results.items.properties).toHaveProperty('reason');
    expect(schema.properties.additionalFindings.items.required).toEqual(
      expect.arrayContaining([
        'title',
        'riskLevel',
        'isVeto',
        'quote',
        'locator',
        'reason',
        'suggestion',
        'confidence',
        'sourceClause',
        'requirementTopic',
      ]),
    );
    expect(schema.properties.additionalFindings.items.properties).toHaveProperty(
      'sourceClause',
    );
  });

  it('应在分组提示中附带标准模板与异常槽位上下文', () => {
    const service = buildService(true);
    const prompt = (service as any).buildGroupPrompt(
      {
        documentSnapshot,
        packSnapshot,
        factExtraction,
        requirementsText,
        workflowText,
        promptSet,
      },
      {
        group: '付款与回款',
        checks: [packSnapshot.checks[2]],
      },
    ) as string;

    expect(prompt).toContain('标准模板识别：');
    expect(prompt).toContain('联软购销合同标准模板（含廉洁协议）');
    expect(prompt).toContain('关键模板槽位：');
    expect(prompt).toContain('合同编号：状态=仍为模板占位');
    expect(prompt).toContain('合同审核AI提示词（正式版）');
    expect(prompt).not.toContain('requirements.md');
    expect(prompt).not.toContain('workflow.md');
  });

  it('应将模型返回结果归一化，并为遗漏检查项补 NO_HIT', () => {
    const service = buildService(true);
    const normalized = (service as any).normalizeGroupReviewResult(
      {
        group: '票税与结算',
        checks: [packSnapshot.checks[1], packSnapshot.checks[2]],
      },
      {
        group: '票税与结算',
        results: [
          {
            checkId: 'CR-TAX-001',
            result: 'HIT',
            riskLevel: 'LOW',
            isVeto: false,
            quote: '产品税率为13%。',
            locator: '正文条款2',
            reason: '根据workflow.md阶段4要求，税率条款已识别。',
            suggestion: '根据requirements.md 2.2税率要求，继续核对票种。',
            confidence: 'HIGH',
          },
        ],
        additionalFindings: [
          {
            title: '根据workflow.md阶段5要求，主体信息缺失',
            riskLevel: 'HIGH',
            isVeto: true,
            quote: '乙方统一社会信用代码未填写',
            locator: 'å§ï½†æžƒé‰â„ƒîƒ™1',
            reason: '根据workflow.md阶段4要求，合同缺少乙方主体信息，无法满足公司审核要求。',
            suggestion: '根据requirements.md 1.1主体资格，补齐乙方统一社会信用代码、注册地址和法定代表人。',
            confidence: 'HIGH',
            sourceClause: 'requirements.md 1.1主体资格',
            requirementTopic: '依据workflow.md阶段5要求',
          },
        ],
      },
    ) as {
      results: Array<{ checkId: string; result: string; reason: string; riskLevel: string }>;
      additionalFindings: Array<{ title: string; sourceClause: string; riskLevel: string }>;
    };

    expect(normalized.results).toEqual([
      expect.objectContaining({
        checkId: 'CR-TAX-001',
        result: 'HIT',
        reason: '根据公司审核流程第4阶段要求，税率条款已识别。',
        riskLevel: 'MEDIUM',
        suggestion: '根据公司税率要求（2.2），继续核对票种。',
      }),
      expect.objectContaining({
        checkId: 'CR-PAY-001',
        result: 'NO_HIT',
        reason: '未发现充分依据',
        riskLevel: 'HIGH',
      }),
    ]);
    expect(normalized.additionalFindings).toEqual([
      expect.objectContaining({
        title: '根据公司审核流程第5阶段要求，主体信息缺失',
        sourceClause: '公司主体资格要求（1.1）',
        riskLevel: 'HIGH',
        reason: '根据公司审核流程第4阶段要求，合同缺少乙方主体信息，无法满足公司审核要求。',
        suggestion: '根据公司主体资格要求（1.1），补齐乙方统一社会信用代码、注册地址和法定代表人。',
        requirementTopic: '依据公司审核流程第5阶段要求',
      }),
    ]);
  });

  it('AI 配置不可用时应直接返回 null', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      const service = buildService(false);
      const runSpy = jest.spyOn(service as any, 'runGroupedCodexReviewPrompts');

      const result = await service.reviewDocument({
        documentSnapshot,
        packSnapshot,
        factExtraction,
        requirementsText,
        workflowText,
        promptSet,
      });

      expect(result).toBeNull();
      expect(runSpy).not.toHaveBeenCalled();
      expect(service.consumeLastFailureReason()).toContain('AI 运行时配置不可用');
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('AI 请求失败时应记录可读的降级原因', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      const service = buildService(true);
      jest
        .spyOn(service as any, 'runGroupedCodexReviewPrompts')
        .mockRejectedValue(new Error('fetch failed'));

      const result = await service.reviewDocument({
        documentSnapshot,
        packSnapshot,
        factExtraction,
        requirementsText,
        workflowText,
        promptSet,
      });

      expect(result).toBeNull();
      const failureReason = service.consumeLastFailureReason();
      expect(failureReason).toContain('AI 服务请求失败');
      expect(failureReason).toContain('Provider=');
      expect(failureReason).toContain('Model=');
      expect(service.consumeLastFailureReason()).toBeUndefined();
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('应优先按 pack 的 modelProfile 收敛合同审核推理档位', () => {
    const service = buildService(true);

    expect(
      (service as any).resolveReviewReasoningEffort('codex-high', 'xhigh'),
    ).toBe('high');
    expect(
      (service as any).resolveReviewReasoningEffort('codex-medium', 'xhigh'),
    ).toBe('medium');
    expect(
      (service as any).resolveReviewReasoningEffort('codex-low', 'xhigh'),
    ).toBe('low');
    expect(
      (service as any).resolveReviewReasoningEffort('custom-profile', 'xhigh'),
    ).toBe('xhigh');
  });

  it('合同审核未显式配置推理等级时应回退到最低档位', () => {
    const service = buildService(true);

    expect((service as any).mapReasoningEffort(undefined)).toBe('low');
  });

  it('统一执行门面不可用时不得回退本机 Codex CLI', async () => {
    const service = buildService(true);

    await expect(
      (service as any).runGroupedCodexReviewPrompts(
        {
          sdkType: 'openai-compatible-http',
          apiKey: 'mock-key',
          baseUrl: 'http://mock-ai.local',
          model: 'gpt-5.4',
          modelProvider: 'internal-openai-gateway',
          reasoningEffort: 'high',
          timeoutMs: 90000,
          wireApi: 'responses',
          disableResponseStorage: true,
          proxyEnv: {},
        },
        {
          documentSnapshot,
          packSnapshot,
          factExtraction,
          requirementsText,
          workflowText,
          promptSet,
        },
        [
          {
            group: packSnapshot.groups[0].group,
            checks: [packSnapshot.checks[0]],
          },
        ],
      ),
    ).rejects.toThrow('UNIFIED_AI_EXECUTION_UNAVAILABLE');
  });

  it('应记录合同审核 AI 分组耗时日志', async () => {
    const logStep = jest.fn();
    const logWarn = jest.fn();
    const reviewGroup = {
      group: packSnapshot.groups[0].group,
      checks: [packSnapshot.checks[0]],
    };
    const invokeStructured = jest.fn().mockResolvedValue({
      group: reviewGroup.group,
      results: [
        {
          checkId: 'CR-IP-001',
          result: 'HIT',
          riskLevel: 'HIGH',
          isVeto: true,
          quote: '知识产权条款示例',
          locator: '第1条',
          reason: '知识产权归属不符合要求',
          suggestion: '调整为乙方保留知识产权',
          confidence: 'HIGH',
        },
      ],
      additionalFindings: [],
    });
    const service = new ContractReviewAiReviewService(
      {
        getRepoRoot: jest.fn(() => 'c:/code/CRM-Agent'),
      } as never,
      {
        logStep,
        logWarn,
      } as never,
      {
        getAiReviewTimeoutMs: jest.fn(() => 90000),
        getAiMaxParallelGroups: jest.fn(() => 2),
      } as never,
      undefined,
      {
        invokeStructured,
      } as never,
    );

    const nowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1100)
      .mockReturnValueOnce(1600)
      .mockReturnValueOnce(1900);

    try {
      const result = await (service as any).runGroupedCodexReviewPrompts(
        {
          sdkType: 'openai-compatible-http',
          apiKey: 'mock-key',
          baseUrl: 'http://mock-ai.local',
          model: 'gpt-5.4',
          modelProvider: 'internal-openai-gateway',
          reasoningEffort: 'high',
          timeoutMs: 90000,
          wireApi: 'responses',
          disableResponseStorage: true,
          proxyEnv: {},
        },
        {
          documentSnapshot,
          packSnapshot,
          factExtraction,
          requirementsText,
          workflowText,
          promptSet,
        },
        [reviewGroup],
      );

      expect(result).toEqual([
        expect.objectContaining({
          reviewType: 'CHECK',
          ruleCode: 'CR-IP-001',
          group: reviewGroup.group,
        }),
      ]);
      expect(invokeStructured).toHaveBeenCalledWith(
        expect.objectContaining({
          requestOverrides: expect.objectContaining({
            maxTokens: 4096,
            timeoutMs: 90000,
          }),
        }),
      );
      expect(logStep).toHaveBeenCalledWith(
        '合同审核 AI 审查分组开始。',
        expect.objectContaining({
          group: reviewGroup.group,
          groupIndex: 1,
          reviewGroupCount: 1,
          checkCount: 1,
          timeoutMs: 90000,
          maxParallelGroups: 1,
          activeGroupCount: 1,
          queuedGroupCount: 0,
        }),
      );
      expect(logStep).toHaveBeenCalledWith(
        '合同审核 AI 审查分组完成。',
        expect.objectContaining({
          group: reviewGroup.group,
          durationMs: expect.any(Number),
          hitCount: 1,
          supplementalFindingCount: 0,
        }),
      );
      expect(logStep).toHaveBeenCalledWith(
        '合同审核 AI 审查完成。',
        expect.objectContaining({
          reviewGroupCount: 1,
          maxParallelGroups: 1,
          issueHitCount: 1,
          supplementalFindingCount: 0,
          durationMs: 900,
        }),
      );
      expect(logWarn).not.toHaveBeenCalled();
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('应记录合同审核 AI 分组失败耗时日志', async () => {
    const logStep = jest.fn();
    const logWarn = jest.fn();
    const reviewGroup = {
      group: packSnapshot.groups[0].group,
      checks: [packSnapshot.checks[0]],
    };
    const invokeStructured = jest.fn().mockRejectedValue(new Error('mock group failure'));
    const service = new ContractReviewAiReviewService(
      {
        getRepoRoot: jest.fn(() => 'c:/code/CRM-Agent'),
      } as never,
      {
        logStep,
        logWarn,
      } as never,
      {
        getAiReviewTimeoutMs: jest.fn(() => 90000),
        getAiMaxParallelGroups: jest.fn(() => 2),
      } as never,
      undefined,
      {
        invokeStructured,
      } as never,
    );

    const nowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(2000)
      .mockReturnValueOnce(2100)
      .mockReturnValueOnce(2600);

    try {
      await expect(
        (service as any).runGroupedCodexReviewPrompts(
          {
            sdkType: 'openai-compatible-http',
            apiKey: 'mock-key',
            baseUrl: 'http://mock-ai.local',
            model: 'gpt-5.4',
            modelProvider: 'internal-openai-gateway',
            reasoningEffort: 'high',
            wireApi: 'responses',
            disableResponseStorage: true,
            proxyEnv: {},
          },
          {
            documentSnapshot,
            packSnapshot,
            factExtraction,
            requirementsText,
            workflowText,
            promptSet,
          },
          [reviewGroup],
        ),
      ).rejects.toThrow('mock group failure');

      expect(logWarn).toHaveBeenCalledWith(
        '合同审核 AI 审查分组失败。',
        expect.objectContaining({
          group: reviewGroup.group,
          groupIndex: 1,
          reviewGroupCount: 1,
          checkCount: 1,
          durationMs: expect.any(Number),
          timeoutMs: 90000,
          failureType: 'ERROR',
          reason: 'mock group failure',
        }),
      );
    } finally {
      nowSpy.mockRestore();
    }
  });
  it('应按最大并发数限制合同审核分组启动', async () => {
    const reviewGroups = [
      {
        group: packSnapshot.groups[0].group,
        checks: [packSnapshot.checks[0]],
      },
      {
        group: packSnapshot.groups[1].group,
        checks: [packSnapshot.checks[1]],
      },
      {
        group: packSnapshot.groups[2].group,
        checks: [packSnapshot.checks[2]],
      },
    ];
    const service = new ContractReviewAiReviewService(
      {
        getRepoRoot: jest.fn(() => 'c:/code/CRM-Agent'),
      } as never,
      {
        logStep: jest.fn(),
        logWarn: jest.fn(),
      } as never,
      {
        getAiReviewTimeoutMs: jest.fn(() => 90000),
        getAiMaxParallelGroups: jest.fn(() => 2),
      } as never,
    );

    let resolveFirstGroup!: (
      value: {
        checkHits: Array<{ ruleCode: string; group: string }>;
        supplementalFindings: Array<unknown>;
      },
    ) => void;
    let resolveSecondGroup!: (
      value: {
        checkHits: Array<{ ruleCode: string; group: string }>;
        supplementalFindings: Array<unknown>;
      },
    ) => void;

    const runReviewGroupSpy = jest
      .spyOn(service as any, 'runReviewGroup')
      .mockImplementation(async (...args: unknown[]) => {
        const reviewGroup = args[3] as { group: string };

        if (reviewGroup.group === reviewGroups[0].group) {
          return new Promise((resolve) => {
            resolveFirstGroup = resolve as typeof resolveFirstGroup;
          });
        }

        if (reviewGroup.group === reviewGroups[1].group) {
          return new Promise((resolve) => {
            resolveSecondGroup = resolve as typeof resolveSecondGroup;
          });
        }

        return {
          checkHits: [
            {
              ruleCode: 'CR-PAY-001',
              group: reviewGroups[2].group,
            },
          ],
          supplementalFindings: [],
        };
      });

    const runPromise = (service as any).runReviewGroupsWithConcurrency(
      {} as never,
      {
        model: 'gpt-5.4',
        reasoningEffort: 'high',
      },
      {
        documentSnapshot,
        packSnapshot,
        factExtraction,
        requirementsText,
        workflowText,
        promptSet,
      },
      reviewGroups,
      90000,
      2,
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(runReviewGroupSpy).toHaveBeenCalledTimes(2);
    expect(runReviewGroupSpy.mock.calls[0][3]).toMatchObject({
      group: reviewGroups[0].group,
    });
    expect(runReviewGroupSpy.mock.calls[1][3]).toMatchObject({
      group: reviewGroups[1].group,
    });

    resolveFirstGroup({
      checkHits: [
        {
          ruleCode: 'CR-IP-001',
          group: reviewGroups[0].group,
        },
      ],
      supplementalFindings: [],
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(runReviewGroupSpy).toHaveBeenCalledTimes(3);
    expect(runReviewGroupSpy.mock.calls[2][3]).toMatchObject({
      group: reviewGroups[2].group,
    });

    resolveSecondGroup({
      checkHits: [
        {
          ruleCode: 'CR-TAX-001',
          group: reviewGroups[1].group,
        },
      ],
      supplementalFindings: [],
    });

    await expect(runPromise).resolves.toEqual([
      expect.objectContaining({
        status: 'fulfilled',
        value: expect.objectContaining({
          checkHits: [expect.objectContaining({ ruleCode: 'CR-IP-001' })],
        }),
      }),
      expect.objectContaining({
        status: 'fulfilled',
        value: expect.objectContaining({
          checkHits: [expect.objectContaining({ ruleCode: 'CR-TAX-001' })],
        }),
      }),
      expect.objectContaining({
        status: 'fulfilled',
        value: expect.objectContaining({
          checkHits: [expect.objectContaining({ ruleCode: 'CR-PAY-001' })],
        }),
      }),
    ]);
  });

  it('存在 AI runtime resolver 时应优先使用激活 Profile 配置', () => {
    const service = new ContractReviewAiReviewService(
      {
        getAiConfig: jest.fn(() => ({
          enabled: true,
          apiKey: 'env-key',
          baseUrl: 'https://env.example.com/v1',
          model: 'env-model',
        })),
        getRepoRoot: jest.fn(() => 'c:/code/CRM-Agent'),
      } as never,
      {
        logStep: jest.fn(),
        logWarn: jest.fn(),
      } as never,
      {
        getAiReviewTimeoutMs: jest.fn(() => 90000),
        getAiMaxParallelGroups: jest.fn(() => 2),
      } as never,
      {
        getCurrentConfig: jest.fn(() => ({
          enabled: true,
          source: 'profile',
          apiKey: 'profile-key',
          baseUrl: 'https://profile.example.com/v1',
          model: 'profile-model',
          sdkType: 'codex-sdk',
        })),
      } as never,
    );

    const resolved = (service as never as {
      getCurrentAiConfig: () => Record<string, unknown>;
    }).getCurrentAiConfig();

    expect(resolved).toMatchObject({
      source: 'profile',
      apiKey: 'profile-key',
      baseUrl: 'https://profile.example.com/v1',
      model: 'profile-model',
    });
  });

  it('合同审核分组审查在存在统一执行门面时应优先走门面调用', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      const invokeStructured = jest.fn().mockResolvedValue({
        group: '知识产权与许可',
        results: [
          {
            checkId: 'CR-IP-001',
            result: 'HIT',
            riskLevel: 'HIGH',
            isVeto: true,
            quote: '知识产权及源代码归甲方独占所有。',
            locator: '正文条款1',
            reason: '命中知识产权独占条款。',
            suggestion: '改为乙方所有。',
            confidence: 'HIGH',
          },
        ],
        additionalFindings: [],
      });
      const service = new ContractReviewAiReviewService(
        {
          getAiConfig: jest.fn(() => ({
            enabled: true,
            apiKey: 'env-key',
            baseUrl: 'https://env.example.com/v1',
            model: 'env-model',
          })),
          getRepoRoot: jest.fn(() => 'c:/code/CRM-Agent'),
        } as never,
        {
          logStep: jest.fn(),
          logWarn: jest.fn(),
        } as never,
        {
          getAiReviewTimeoutMs: jest.fn(() => 90000),
          getAiMaxParallelGroups: jest.fn(() => 2),
          getAiSupplementalReviewTimeoutMs: jest.fn(() => 45000),
          getAiSupplementalMaxChecksPerBatch: jest.fn(() => 1),
        } as never,
        undefined,
        {
          invokeStructured,
        } as never,
      );

      const result = await (service as never as {
        runGroupedCodexReviewPrompts: (
          config: Record<string, unknown>,
          input: unknown,
          reviewGroups: unknown[],
        ) => Promise<unknown[]>;
      }).runGroupedCodexReviewPrompts(
        {
          enabled: true,
          sdkType: 'claude-agent-sdk',
          apiKey: 'profile-key',
          baseUrl: 'https://profile.example.com/v1',
          model: 'claude-sonnet-4-20250514',
        },
        {
          documentSnapshot,
          packSnapshot,
          factExtraction,
          requirementsText,
          workflowText,
          promptSet,
        },
        [
          {
            group: '知识产权与许可',
            checks: [packSnapshot.checks[0]],
          },
        ],
      );

      expect(invokeStructured).toHaveBeenCalled();
      expect(result).toEqual([
        expect.objectContaining({
          ruleCode: 'CR-IP-001',
          group: '知识产权与许可',
        }),
      ]);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});

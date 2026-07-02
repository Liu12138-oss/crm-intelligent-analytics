import { AiGatewayService } from '../../../src/modules/analysis/ai-gateway.service';

describe('AiGatewayService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-23T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('Codex 意图解析 schema 应该显式要求 blockReason', () => {
    const service = new AiGatewayService(
      {
        getAiConfig: jest.fn(),
        getRepoRoot: jest.fn(),
      } as never,
      {
        logWarn: jest.fn(),
      } as never,
    );

    const schema = (service as never as {
      buildIntentSchema: () => { required?: string[] };
    }).buildIntentSchema();

    expect(schema.required).toContain('blockReason');
  });

  it('企业微信 semantic reply lane 应与结构化草稿 lane 分离', () => {
    const service = new AiGatewayService(
      {
        getAiConfig: jest.fn(),
        getRepoRoot: jest.fn(),
      } as never,
      {
        logWarn: jest.fn(),
      } as never,
    );

    const semanticLane = (service as never as {
      resolveCodexQueueLane: (lane: string) => string;
    }).resolveCodexQueueLane('wecom-semantic-reply');
    const structuredDraftLane = (service as never as {
      resolveCodexQueueLane: (lane: string) => string;
    }).resolveCodexQueueLane('wecom-structured-draft');

    expect(semanticLane).toBe('wecom-semantic-reply');
    expect(structuredDraftLane).toBe('wecom-structured-draft');
    expect(semanticLane).not.toBe(structuredDraftLane);
  });

  it('企业微信 semantic reply lane 默认应降到轻量推理档位', () => {
    const service = new AiGatewayService(
      {
        getAiConfig: jest.fn(),
        getRepoRoot: jest.fn(),
      } as never,
      {
        logWarn: jest.fn(),
      } as never,
    );

    const reasoningEffort = (service as never as {
      resolveLaneReasoningEffort: (
        lane: string,
        configured?: string,
      ) => string | undefined;
    }).resolveLaneReasoningEffort('wecom-semantic-reply', 'high');

    expect(reasoningEffort).toBe('low');
  });

  it('测试环境下的统一 AI 入口桩应返回结构化问数意图，而不是直接回退 null', async () => {
    const service = new AiGatewayService(
      {
        getAiConfig: jest.fn(),
        getRepoRoot: jest.fn(),
      } as never,
      {
        logWarn: jest.fn(),
      } as never,
    );

    const result = await service.parseStructuredIntent(
      '本月各销售负责人新增商机金额排名',
    );

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      requestedAction: 'READONLY_ANALYSIS',
      metrics: ['新增商机金额'],
      dimensions: ['销售负责人'],
    });
  });

  it('测试环境下的统一 AI 入口桩应把“前三个月的商机情况”识别为近三个月趋势查询', async () => {
    const service = new AiGatewayService(
      {
        getAiConfig: jest.fn(),
        getRepoRoot: jest.fn(),
      } as never,
      {
        logWarn: jest.fn(),
      } as never,
    );

    const result = await service.parseStructuredIntent(
      '请分析一下前三个月的商机情况',
    );

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      requestedAction: 'READONLY_ANALYSIS',
      resultKindHint: 'time-trend',
      resultIntent: 'trend',
      timeRangeText: '前三个月',
      temporalSlot: {
        rawText: '前三个月',
        normalizedLabel: '前三个月',
        startAt: '2025-12-31T16:00:00.000Z',
        endAt: '2026-03-31T16:00:00.000Z',
        timezone: 'Asia/Shanghai',
        granularity: 'month',
        relativity: 'relative',
        confidence: 'HIGH',
      },
      filters: {
        timeRange: '前三个月',
        startAt: '2025-12-31T16:00:00.000Z',
        endAt: '2026-03-31T16:00:00.000Z',
      },
    });
  });

  it.each([
    ['最近四个月', '2025-11-30T16:00:00.000Z', '2026-03-31T16:00:00.000Z', 'month'],
    ['前四个月', '2025-11-30T16:00:00.000Z', '2026-03-31T16:00:00.000Z', 'month'],
    ['近 6 月', '2025-09-30T16:00:00.000Z', '2026-03-31T16:00:00.000Z', 'month'],
    ['过去 12 个月', '2025-03-31T16:00:00.000Z', '2026-03-31T16:00:00.000Z', 'month'],
    ['上季度', '2025-09-30T16:00:00.000Z', '2025-12-31T16:00:00.000Z', 'quarter'],
    ['去年同期', '2025-02-28T16:00:00.000Z', '2025-03-31T16:00:00.000Z', 'month'],
    ['2026 年一季度', '2025-12-31T16:00:00.000Z', '2026-03-31T16:00:00.000Z', 'quarter'],
    ['本财年', '2025-12-31T16:00:00.000Z', '2026-12-31T16:00:00.000Z', 'year'],
  ])('测试环境 AI 桩应为“%s”返回标准时间槽', async (timeText, startAt, endAt, granularity) => {
    const service = new AiGatewayService(
      {
        getAiConfig: jest.fn(),
        getRepoRoot: jest.fn(),
      } as never,
      {
        logWarn: jest.fn(),
      } as never,
    );

    const result = await service.parseStructuredIntent(
      `请分析一下${timeText}的商机情况`,
    );

    expect(result).toMatchObject({
      temporalSlot: {
        rawText: timeText,
        normalizedLabel: timeText,
        startAt,
        endAt,
        timezone: 'Asia/Shanghai',
        granularity,
        confidence: 'HIGH',
      },
      filters: {
        timeRange: timeText,
        startAt,
        endAt,
      },
    });
  });

  it('测试环境下的统一 AI 入口桩应识别解释型追问语义', async () => {
    const service = new AiGatewayService(
      {
        getAiConfig: jest.fn(),
        getRepoRoot: jest.fn(),
      } as never,
      {
        logWarn: jest.fn(),
      } as never,
    );

    const result = await service.classifyAnalysisFollowUpIntent({
      questionText: '这说明什么？',
      latestQuestion: '本月各销售负责人新增商机金额排名',
      latestSummary: '王敏暂列第一',
      channel: 'web-console',
    });

    expect(result).toBe('EXPLAIN_RESULT');
  });

  it('分析意图能力包应透传短超时并在超时后回退 null', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalIntentTimeout = process.env.ANALYSIS_AI_INTENT_TIMEOUT_MS;
    process.env.NODE_ENV = 'development';
    delete process.env.ANALYSIS_AI_INTENT_TIMEOUT_MS;

    try {
      const executeStructuredPack = jest.fn().mockResolvedValue({
        status: 'FAILED',
        failureReason: 'PROVIDER_TIMEOUT',
        fallbackReason: 'PROVIDER_TIMEOUT',
        packCode: 'analysis-intent-pack',
        packVersion: 'test-fixture',
        providerCode: 'test-provider',
        model: 'test-model',
      });
      const service = new AiGatewayService(
        {
          getAiConfig: jest.fn(() => ({
            enabled: true,
            apiKey: 'test-key',
            baseUrl: 'https://example.com/v1',
            model: 'test-model',
          })),
          getRepoRoot: jest.fn(() => 'D:\\code\\CRM'),
        } as never,
        {
          logWarn: jest.fn(),
        } as never,
        undefined,
        undefined,
        {
          executeStructuredPack,
        } as never,
      );

      const result = await service.parseStructuredIntent(
        '最近一个月山东的商机情况',
      );

      expect(result).toBeNull();
      expect(executeStructuredPack).toHaveBeenCalledWith(
        expect.objectContaining({
          packCode: 'analysis-intent-pack',
          requestOverrides: {
            timeoutMs: 10000,
            retryOnTimeout: false,
          },
        }),
      );
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      if (originalIntentTimeout === undefined) {
        delete process.env.ANALYSIS_AI_INTENT_TIMEOUT_MS;
      } else {
        process.env.ANALYSIS_AI_INTENT_TIMEOUT_MS = originalIntentTimeout;
      }
    }
  });

  it('测试环境下的统一 AI 入口桩应识别企业微信新增客户入口语义', async () => {
    const service = new AiGatewayService(
      {
        getAiConfig: jest.fn(),
        getRepoRoot: jest.fn(),
      } as never,
      {
        logWarn: jest.fn(),
      } as never,
    );

    const result = await service.classifyWecomIdleConversationIntent({
      messageText: '新增客户',
      latestQuestion: undefined,
      latestSummary: undefined,
      hasPendingSlots: false,
    });

    expect(result).toMatchObject({
      intent: 'CRM_CREATE_CUSTOMER',
    });
  });

  it('测试环境下的统一 AI 入口桩应识别明显的自由跟进叙述', async () => {
    const service = new AiGatewayService(
      {
        getAiConfig: jest.fn(),
        getRepoRoot: jest.fn(),
      } as never,
      {
        logWarn: jest.fn(),
      } as never,
    );

    const result = await service.classifyWecomIdleConversationIntent({
      messageText:
        '今天跟进了安恒信息，尬聊了一天，无进度更新，客户不好沟通，推进缓慢，明天继续跟进',
      latestQuestion: undefined,
      latestSummary: undefined,
      hasPendingSlots: false,
    });

    expect(result).toMatchObject({
      intent: 'DAILY_REPORT',
      dailyReportPrompt: 'FOLLOW_UP_TEMPLATE_ENTRY',
    });
  });

  it('企业微信空闲态 AI 若把经营分析问句误判为新建商机，服务端应降级为 NONE 而不是进入创建链路', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      const service = new AiGatewayService(
        {
          getAiConfig: jest.fn(() => ({
            enabled: true,
            apiKey: 'test-key',
            baseUrl: 'https://example.com/v1',
            model: 'test-model',
          })),
          getRepoRoot: jest.fn(() => 'D:\\code\\CRM'),
        } as never,
        {
          logWarn: jest.fn(),
        } as never,
        undefined,
        undefined,
        {
          executeStructuredPack: jest.fn().mockResolvedValue({
            status: 'SUCCEEDED',
            output: {
              intent: 'CRM_CREATE_OPPORTUNITY',
            },
            packCode: 'wecom-idle-entry-pack',
            packVersion: 'test-fixture',
            providerCode: 'test-provider',
            model: 'test-model',
          }),
        } as never,
      );

      const result = await service.classifyWecomIdleConversationIntent({
        messageText: '请分析一下最近四个月的商机情况',
        latestQuestion: undefined,
        latestSummary: undefined,
        hasPendingSlots: false,
      });

      expect(result).toMatchObject({
        intent: 'NONE',
        packCode: 'wecom-idle-entry-pack',
        packVersion: 'test-fixture',
      });
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('受控直查任务若与计划器期望的 resultKind 不一致，应直接回退统一编排', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      const service = new AiGatewayService(
        {
          getAiConfig: jest.fn(() => ({
            enabled: true,
            apiKey: 'test-key',
            baseUrl: 'https://example.com/v1',
            model: 'test-model',
          })),
          getRepoRoot: jest.fn(() => 'D:\\code\\CRM'),
        } as never,
        {
          logWarn: jest.fn(),
        } as never,
        undefined,
        undefined,
        undefined,
      );

      const runPromptSpy = jest.spyOn(
        service as never as {
          runCodexControlledDirectQueryTaskPrompt: (
            config: Record<string, unknown>,
            params: Record<string, unknown>,
          ) => Promise<Record<string, unknown>>;
        },
        'runCodexControlledDirectQueryTaskPrompt',
      );
      runPromptSpy.mockResolvedValue({
        taskTitle: 'AI误判线索漏斗结构',
        resultKind: 'stage-distribution',
        sql: 'SELECT ...',
        tables: ['opportunities'],
        fieldEntries: [{ table: 'opportunities', fields: ['stage', 'expect_amount'] }],
        joinPaths: [],
        allowedFunctions: ['SUM', 'COUNT'],
        rowLimit: 8,
        timeoutMs: 2500,
      });

      const generatedTask = await service.generateControlledDirectQueryTask(
        {
          questionText: '本月各销售负责人新增商机金额排名',
          channel: 'wecom-bot',
          domain: 'opportunity-analysis',
          metrics: ['新增商机金额'],
          dimensions: ['销售负责人'],
          filters: {},
          knowledgeContextText: '测试知识上下文',
          expectedTaskTitle: '新增商机金额负责人排名',
          expectedResultKind: 'owner-ranking',
          expectedPurpose: 'primary-summary',
        },
      );

      expect(generatedTask).toBeNull();
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('企业微信任务回复 schema 只应把 intent 作为公共必填字段', () => {
    const service = new AiGatewayService(
      {
        getAiConfig: jest.fn(),
        getRepoRoot: jest.fn(),
      } as never,
      {
        logWarn: jest.fn(),
      } as never,
    );

    const schema = (service as never as {
      buildWecomTaskReplyIntentSchema: () => {
        required?: string[];
        properties?: Record<string, unknown>;
      };
    }).buildWecomTaskReplyIntentSchema();

    expect(schema.required).toEqual(['intent']);
    expect(schema.properties?.target).toBeDefined();
  });

  it('企业微信空闲态入口 schema 只应把 intent 作为公共必填字段', () => {
    const service = new AiGatewayService(
      {
        getAiConfig: jest.fn(),
        getRepoRoot: jest.fn(),
      } as never,
      {
        logWarn: jest.fn(),
      } as never,
    );

    const schema = (service as never as {
      buildWecomIdleConversationIntentSchema: () => {
        required?: string[];
        properties?: Record<string, unknown>;
      };
    }).buildWecomIdleConversationIntentSchema();

    expect(schema.required).toEqual(['intent']);
    expect(schema.properties?.helpScene).toBeDefined();
    expect(schema.properties?.dailyReportPrompt).toBeDefined();
    expect(schema.properties?.leaderNameQuery).toBeDefined();
    expect(schema.properties?.lookupText).toBeDefined();
  });

  it('企业微信 idle intent 默认超时预算应统一提升到 60s', () => {
    const service = new AiGatewayService(
      {
        getAiConfig: jest.fn(),
        getRepoRoot: jest.fn(),
      } as never,
      {
        logWarn: jest.fn(),
      } as never,
    );

    const helpTimeout = (service as never as {
      resolveWecomIdleIntentTimeoutMs: (messageText: string) => number;
    }).resolveWecomIdleIntentTimeoutMs('你好');
    const normalTimeout = (service as never as {
      resolveWecomIdleIntentTimeoutMs: (messageText: string) => number;
    }).resolveWecomIdleIntentTimeoutMs('本月各销售负责人新增商机金额排名');

    expect(helpTimeout).toBeLessThanOrEqual(normalTimeout);
    expect(helpTimeout).toBe(60000);
    expect(normalTimeout).toBe(60000);
  });

  it('默认问数意图分类 lane 也应降到轻量推理档位，避免 provider 长时间卡在 xhigh', () => {
    const service = new AiGatewayService(
      {
        getAiConfig: jest.fn(),
        getRepoRoot: jest.fn(),
      } as never,
      {
        logWarn: jest.fn(),
      } as never,
    );

    const reasoningEffort = (service as never as {
      resolveLaneReasoningEffort: (
        lane: string,
        configured?: string,
      ) => string | undefined;
    }).resolveLaneReasoningEffort('default', 'xhigh');

    expect(reasoningEffort).toBe('low');
  });

  it('统一执行门面不可用时不得回退到 Codex SDK 直连', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const service = new AiGatewayService(
      {
        getAiConfig: jest.fn(),
        getRepoRoot: jest.fn(() => process.cwd()),
      } as never,
      {
        logWarn: jest.fn(),
        logStep: jest.fn(),
      } as never,
    );

    try {
      await expect(
        (service as never as {
          runCodexIntentPrompt: (
            config: Record<string, unknown>,
            questionText: string,
          ) => Promise<Record<string, unknown>>;
        }).runCodexIntentPrompt(
          {
            sdkType: 'openai-compatible-http',
            model: 'gpt-5.4',
          },
          '本月各销售负责人新增商机金额排名',
        ),
      ).rejects.toThrow('UNIFIED_AI_EXECUTION_UNAVAILABLE');
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('存在 AI runtime resolver 时应优先使用激活 Profile 配置', () => {
    const service = new AiGatewayService(
      {
        getAiConfig: jest.fn(() => ({
          enabled: true,
          apiKey: 'env-key',
          baseUrl: 'https://env.example.com/v1',
          model: 'env-model',
        })),
        getRepoRoot: jest.fn(),
      } as never,
      {
        logWarn: jest.fn(),
      } as never,
      {
        getCurrentConfig: jest.fn(() => ({
          enabled: true,
          source: 'profile',
          apiKey: 'profile-key',
          baseUrl: 'https://profile.example.com/v1',
          model: 'profile-model',
          sdkType: 'openai-compatible-http',
          wireApi: 'responses',
          structuredOutputMode: 'json_schema',
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

  it('结构化意图解析在存在统一执行门面时应优先走门面调用', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      const invokeStructured = jest.fn().mockResolvedValue({
        domain: 'opportunity-analysis',
        metrics: ['新增商机金额'],
        dimensions: ['销售负责人'],
        missingConditions: [],
        normalizedQuestion: '本月各销售负责人新增商机金额排名',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'HIGH',
        blockReason: '',
        timeRange: '本月',
      });
      const service = new AiGatewayService(
        {
          getAiConfig: jest.fn(),
          getRepoRoot: jest.fn(() => process.cwd()),
        } as never,
        {
          logWarn: jest.fn(),
          logStep: jest.fn(),
        } as never,
        undefined,
        {
          invokeStructured,
        } as never,
      );

      const result = await (service as never as {
        runCodexIntentPrompt: (
          config: Record<string, unknown>,
          questionText: string,
        ) => Promise<Record<string, unknown>>;
      }).runCodexIntentPrompt(
        {
          sdkType: 'openai-compatible-http',
          model: 'gpt-5.4',
        },
        '本月各销售负责人新增商机金额排名',
      );

      expect(invokeStructured).toHaveBeenCalled();
      expect(result).toMatchObject({
        domain: 'opportunity-analysis',
        metrics: ['新增商机金额'],
        dimensions: ['销售负责人'],
        filters: {
          timeRange: '本月',
        },
      });
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('企业微信任务回复意图在存在统一执行门面时应优先走门面调用', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      const invokeStructured = jest.fn().mockResolvedValue({
        intent: 'TASK_CANCEL',
        target: 'FOLLOW_UP_TEMPLATE',
      });
      const service = new AiGatewayService(
        {
          getAiConfig: jest.fn(),
          getRepoRoot: jest.fn(() => process.cwd()),
        } as never,
        {
          logWarn: jest.fn(),
          logStep: jest.fn(),
        } as never,
        undefined,
        {
          invokeStructured,
        } as never,
      );

      const result = await (service as never as {
        runCodexWecomTaskReplyIntentPrompt: (
          config: Record<string, unknown>,
          params: Record<string, unknown>,
        ) => Promise<Record<string, unknown>>;
      }).runCodexWecomTaskReplyIntentPrompt(
        {
          sdkType: 'openai-compatible-http',
          model: 'gpt-5.4',
        },
        {
          messageText: '取消这次操作',
          activeTaskLabel: '跟进写回',
        },
      );

      expect(invokeStructured).toHaveBeenCalled();
      expect(result).toEqual({
        intent: 'TASK_CANCEL',
        target: 'FOLLOW_UP_TEMPLATE',
      });
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('能力包主动判空时应记录普通步骤日志而不是告警', () => {
    const logWarn = jest.fn();
    const logStep = jest.fn();
    const service = new AiGatewayService(
      {
        getAiConfig: jest.fn(),
        getRepoRoot: jest.fn(),
      } as never,
      {
        logWarn,
        logStep,
      } as never,
    );

    (service as never as {
      logCapabilityPackFailure: (
        scene: string,
        result: Record<string, unknown>,
      ) => void;
    }).logCapabilityPackFailure('宽业务意图解析', {
      status: 'NONE',
      packCode: 'business-analysis-intent-pack',
      packVersion: 'test-version',
      providerCode: 'test-provider',
      model: 'test-model',
      failureReason: 'PACK_NONE',
      fallbackReason: 'PACK_NONE',
    });

    expect(logWarn).not.toHaveBeenCalled();
    expect(logStep).toHaveBeenCalledWith(
      '宽业务意图解析 capability pack 未选中，已使用受控兜底链路。',
      expect.objectContaining({
        packCode: 'business-analysis-intent-pack',
        failureReason: 'PACK_NONE',
      }),
    );
  });

  it('能力包结构化校验失败时应保留告警并说明进入受控失败处理', () => {
    const logWarn = jest.fn();
    const logStep = jest.fn();
    const service = new AiGatewayService(
      {
        getAiConfig: jest.fn(),
        getRepoRoot: jest.fn(),
      } as never,
      {
        logWarn,
        logStep,
      } as never,
    );

    (service as never as {
      logCapabilityPackFailure: (
        scene: string,
        result: Record<string, unknown>,
      ) => void;
    }).logCapabilityPackFailure('企业微信空闲态消息意图分类', {
      status: 'FAILED',
      packCode: 'wecom-idle-entry-pack',
      packVersion: 'test-version',
      providerCode: 'test-provider',
      model: 'test-model',
      failureReason: 'PACK_VALIDATION_FAILED',
      fallbackReason: 'PACK_VALIDATION_FAILED',
      validationFailureReason: '模型响应缺少最终文本。',
    });

    expect(logStep).not.toHaveBeenCalled();
    expect(logWarn).toHaveBeenCalledWith(
      '企业微信空闲态消息意图分类 capability pack 结构化输出未通过校验，已进入受控失败处理。',
      expect.objectContaining({
        packCode: 'wecom-idle-entry-pack',
        failureReason: 'PACK_VALIDATION_FAILED',
        validationFailureReason: '模型响应缺少最终文本。',
      }),
    );
  });
});

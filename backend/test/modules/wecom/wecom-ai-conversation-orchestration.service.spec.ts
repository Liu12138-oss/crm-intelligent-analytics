import { WecomAiConversationOrchestrationService } from '../../../src/modules/wecom/wecom-ai-conversation-orchestration.service';

/**
 * 测试场景只关心意图分流，因此依赖统一使用最小桩对象，避免把外部服务行为混入断言。
 */
function createService(): WecomAiConversationOrchestrationService {
  return new WecomAiConversationOrchestrationService(
    {
      classifyWecomIdleConversationIntent: jest.fn(),
      classifyAnalysisFollowUpIntent: jest.fn(),
      generateWecomExplanationReply: jest.fn(async () => 'AI解释回复'),
    } as never,
    {
      mergeClarificationQuestion: jest.fn(),
      mergeFollowUpQuestion: jest.fn(),
    } as never,
    {
      findBySessionId: jest.fn(),
      save: jest.fn((value) => value),
    } as never,
    {
      getCurrent: jest.fn(() => ({
        id: 'ai_context_policy_current',
        turnRetentionLimit: 8,
        historySummaryMaxLength: 600,
        latestQuestionMaxLength: 200,
        latestSummaryMaxLength: 800,
        analysisSessionIdleTimeoutSeconds: 1800,
        taskSessionIdleTimeoutSeconds: 7200,
      })),
      trimTextByLimit: jest.fn((value: string | undefined, limit: number) => {
        const normalizedValue = value?.trim();
        if (!normalizedValue) {
          return undefined;
        }

        return normalizedValue.length <= limit
          ? normalizedValue
          : normalizedValue.slice(0, limit);
      }),
      trimLatestQuestion: jest.fn((value: string | undefined) => {
        const normalizedValue = value?.trim();
        if (!normalizedValue) {
          return undefined;
        }

        return normalizedValue.length <= 200
          ? normalizedValue
          : normalizedValue.slice(0, 200);
      }),
      trimLatestSummary: jest.fn((value: string | undefined) => {
        const normalizedValue = value?.trim();
        if (!normalizedValue) {
          return undefined;
        }

        return normalizedValue.length <= 800
          ? normalizedValue
          : normalizedValue.slice(0, 800);
      }),
      trimHistorySummary: jest.fn((value: string | undefined) => {
        const normalizedValue = value?.trim();
        if (!normalizedValue) {
          return undefined;
        }

        return normalizedValue.length <= 600
          ? normalizedValue
          : normalizedValue.slice(0, 600);
      }),
      isAnalysisSessionExpired: jest.fn((updatedAt: string | undefined, referenceAt: string) => {
        const updatedValue = Date.parse(updatedAt ?? '');
        const referenceValue = Date.parse(referenceAt);
        return Number.isFinite(updatedValue) && Number.isFinite(referenceValue)
          ? referenceValue - updatedValue > 1800 * 1000
          : false;
      }),
      isTaskSessionExpired: jest.fn((updatedAt: string | undefined, referenceAt: string) => {
        const updatedValue = Date.parse(updatedAt ?? '');
        const referenceValue = Date.parse(referenceAt);
        return Number.isFinite(updatedValue) && Number.isFinite(referenceValue)
          ? referenceValue - updatedValue > 7200 * 1000
          : false;
      }),
    } as never,
  );
}

describe('WecomAiConversationOrchestrationService', () => {
  it('空闲态帮助提示应优先走统一 AI semantic lane 判断', async () => {
    const service = createService();
    const aiGateway = service['aiGatewayService'] as unknown as {
      classifyWecomIdleConversationIntent: jest.Mock;
    };
    aiGateway.classifyWecomIdleConversationIntent.mockResolvedValue({
      intent: 'HELP_GUIDANCE',
      helpScene: 'CAPABILITY',
      packCode: 'wecom-idle-entry-pack',
      packVersion: 'test-fixture',
    });

    const decision = await service.decideNextAction(
      {
        turns: [],
        workMemory: {
          metrics: [],
          dimensions: [],
          filters: {},
          pendingSlots: [],
        },
      } as never,
      {
        messageText: '你现在能帮我处理什么',
      } as never,
      {
        scopeSummary: '测试权限范围',
      } as never,
    );

    expect(decision.action).toBe('HELP_GUIDANCE');
    expect(decision.directReply).toContain('CRM 智能小助手');
    expect(decision.entryInterpretationSnapshot).toMatchObject({
      packCode: 'wecom-idle-entry-pack',
      packVersion: 'test-fixture',
    });
  });

  it('空闲态跟进主题入口应优先走统一 AI semantic lane 判断', async () => {
    const service = createService();
    const aiGateway = service['aiGatewayService'] as unknown as {
      classifyWecomIdleConversationIntent: jest.Mock;
    };
    aiGateway.classifyWecomIdleConversationIntent.mockResolvedValue({
      intent: 'DAILY_REPORT',
      dailyReportPrompt: 'FOLLOW_UP_TEMPLATE_ENTRY',
    });

    const decision = await service.decideNextAction(
      {
        turns: [],
        workMemory: {
          metrics: [],
          dimensions: [],
          filters: {},
          pendingSlots: [],
        },
      } as never,
      {
        messageText: '我今天要跟进商机',
      } as never,
      {
        scopeSummary: '测试权限范围',
      } as never,
    );

    expect(decision.action).toBe('DAILY_REPORT');
    expect(decision.directReply).toContain('本次跟进由我来统一整理');
    expect(decision.entryInterpretationSnapshot?.structuredSlots).toMatchObject({
      entryMode: 'FIXED_WORKFLOW',
      fixedWorkflow: 'DAILY_REPORT',
    });
  });

  it('空闲态小组日报预览应优先走统一 AI semantic lane 判断', async () => {
    const service = createService();
    const aiGateway = service['aiGatewayService'] as unknown as {
      classifyWecomIdleConversationIntent: jest.Mock;
    };
    aiGateway.classifyWecomIdleConversationIntent.mockResolvedValue({
      intent: 'TEAM_DAILY_REPORT_QUERY',
      leaderNameQuery: '王文定',
    });

    const decision = await service.decideNextAction(
      {
        turns: [],
        workMemory: {
          metrics: [],
          dimensions: [],
          filters: {},
          pendingSlots: [],
        },
      } as never,
      {
        messageText: '把王文定小组日报发给我',
      } as never,
      {
        scopeSummary: '测试权限范围',
      } as never,
    );

    expect(decision.action).toBe('TEAM_DAILY_REPORT_QUERY');
    expect(decision.leaderNameQuery).toBe('王文定');
  });

  it('空闲态新增客户入口应优先走统一 AI semantic lane 判断', async () => {
    const service = createService();
    const aiGateway = service['aiGatewayService'] as unknown as {
      classifyWecomIdleConversationIntent: jest.Mock;
    };
    aiGateway.classifyWecomIdleConversationIntent.mockResolvedValue({
      intent: 'CRM_CREATE_CUSTOMER',
      packCode: 'wecom-idle-entry-pack',
      packVersion: 'test-fixture',
    });

    const decision = await service.decideNextAction(
      {
        turns: [],
        workMemory: {
          metrics: [],
          dimensions: [],
          filters: {},
          pendingSlots: [],
        },
      } as never,
      {
        messageText: '新增客户',
      } as never,
      {
        scopeSummary: '测试权限范围',
      } as never,
    );

    expect(decision.action).toBe('CRM_CREATE_CUSTOMER');
    expect(decision.entryInterpretationSnapshot).toMatchObject({
      packCode: 'wecom-idle-entry-pack',
      packVersion: 'test-fixture',
    });
  });

  it('空闲态显式项目查询应优先走统一 AI semantic lane 判断', async () => {
    const service = createService();
    const aiGateway = service['aiGatewayService'] as unknown as {
      classifyWecomIdleConversationIntent: jest.Mock;
    };
    aiGateway.classifyWecomIdleConversationIntent.mockResolvedValue({
      intent: 'OPPORTUNITY_LOOKUP',
      lookupText: '安恒信息',
    });

    const decision = await service.decideNextAction(
      {
        turns: [],
        workMemory: {
          metrics: [],
          dimensions: [],
          filters: {},
          pendingSlots: [],
        },
      } as never,
      {
        messageText: '查安恒信息项目',
      } as never,
      {
        scopeSummary: '测试权限范围',
      } as never,
    );

    expect(decision.action).toBe('OPPORTUNITY_LOOKUP');
    expect(decision.effectiveQuestionText).toBe('安恒信息');
  });

  it('空闲态客户列表查询应优先走统一 AI semantic lane 判断', async () => {
    const service = createService();
    const aiGateway = service['aiGatewayService'] as unknown as {
      classifyWecomIdleConversationIntent: jest.Mock;
    };
    aiGateway.classifyWecomIdleConversationIntent.mockResolvedValue({
      intent: 'ENTITY_LOOKUP',
      entityLookupAction: 'LIST',
      entityType: 'Customer',
      queryText: '我当前跟进的客户',
      confidence: 'HIGH',
      referenceTarget: 'NONE',
    });

    const decision = await service.decideNextAction(
      {
        turns: [],
        workMemory: {
          metrics: [],
          dimensions: [],
          filters: {},
          pendingSlots: [],
        },
      } as never,
      {
        messageText: '查我当前跟进的客户',
      } as never,
      {
        scopeSummary: '测试权限范围',
      } as never,
    );

    const entityLookupDecision = decision as typeof decision & {
      entityLookupAction?: string;
      entityLookupEntityType?: string;
      entityLookupQueryText?: string;
    };

    expect(entityLookupDecision.action).toBe('ENTITY_LOOKUP');
    expect(entityLookupDecision.entityLookupAction).toBe('LIST');
    expect(entityLookupDecision.entityLookupEntityType).toBe('Customer');
    expect(entityLookupDecision.entityLookupQueryText).toBe('我当前跟进的客户');
  });

  it('应能写入并清理 entityLookupMemory，且不污染现有跟进草稿状态', () => {
    const service = createService();
    const context = service.loadOrCreateContext(
      {
        id: 'session_entity_lookup',
        requesterId: 'user_sales_director',
      } as never,
      {
        externalConversationId: 'conv_entity_lookup',
        senderId: 'wx_sales_director',
        receivedAt: '2026-04-29T10:00:00.000Z',
      } as never,
    );

    const withListMemory = service.updateEntityLookupMemory(context, {
      mode: 'LIST_RETURNED',
      entityType: 'Customer',
      queryText: '查我的客户列表',
      listItems: [
        {
          id: 'cus_001',
          entityType: 'Customer',
          displayTitle: '山东农信',
          ownerName: '销售总监',
          summaryFields: ['重点客户'],
        },
      ],
      source: 'DIRECT_QUERY',
      expiresAt: '2026-04-29T10:30:00.000Z',
    });

    expect(withListMemory.workMemory.entityLookupMemory).toMatchObject({
      mode: 'LIST_RETURNED',
      entityType: 'Customer',
      queryText: '查我的客户列表',
    });

    const cleared = service.clearEntityLookupMemory(withListMemory);
    expect(cleared.workMemory.entityLookupMemory).toMatchObject({
      mode: 'IDLE',
      listItems: [],
    });
  });

  it('应该把“帮我写今日跟进”识别为日报入口', async () => {
    const service = createService();
    const aiGateway = service['aiGatewayService'] as unknown as {
      classifyWecomIdleConversationIntent: jest.Mock;
    };
    aiGateway.classifyWecomIdleConversationIntent.mockResolvedValue({
      intent: 'DAILY_REPORT',
      dailyReportPrompt: 'FOLLOW_UP_TEMPLATE_ENTRY',
    });

    const decision = await service.decideNextAction(
      {
        turns: [],
        workMemory: {
          metrics: [],
          dimensions: [],
          filters: {},
          pendingSlots: [],
        },
      } as never,
      {
        messageText: '帮我写今日跟进',
      } as never,
      {
        scopeSummary: '测试权限范围',
      } as never,
    );

    expect(decision.action).toBe('DAILY_REPORT');
    expect(decision.directReply).toContain('本次跟进由我来统一整理');
  });

  it('应该把“跟进商机”识别为今日跟进入口', async () => {
    const service = createService();
    const aiGateway = service['aiGatewayService'] as unknown as {
      classifyWecomIdleConversationIntent: jest.Mock;
    };
    aiGateway.classifyWecomIdleConversationIntent.mockResolvedValue({
      intent: 'DAILY_REPORT',
      dailyReportPrompt: 'FOLLOW_UP_TEMPLATE_ENTRY',
    });

    const decision = await service.decideNextAction(
      {
        turns: [],
        workMemory: {
          metrics: [],
          dimensions: [],
          filters: {},
          pendingSlots: [],
        },
      } as never,
      {
        messageText: '跟进商机',
      } as never,
      {
        scopeSummary: '测试权限范围',
      } as never,
    );

    expect(decision.action).toBe('DAILY_REPORT');
    expect(decision.directReply).toContain('本次跟进由我来统一整理');
    expect(decision.directReply).toContain('你可直接发送一段简洁通顺的文字汇报跟进情况');
    expect(decision.directReply).not.toContain('辛苦尽量按下面模板回复我');
  });

  it('应该把“跟进今日商机”识别为今日跟进入口', async () => {
    const service = createService();
    const aiGateway = service['aiGatewayService'] as unknown as {
      classifyWecomIdleConversationIntent: jest.Mock;
    };
    aiGateway.classifyWecomIdleConversationIntent.mockResolvedValue({
      intent: 'DAILY_REPORT',
      dailyReportPrompt: 'FOLLOW_UP_TEMPLATE_ENTRY',
    });

    const decision = await service.decideNextAction(
      {
        turns: [],
        workMemory: {
          metrics: [],
          dimensions: [],
          filters: {},
          pendingSlots: [],
        },
      } as never,
      {
        messageText: '跟进今日商机',
      } as never,
      {
        scopeSummary: '测试权限范围',
      } as never,
    );

    expect(decision.action).toBe('DAILY_REPORT');
    expect(decision.directReply).toContain('本次跟进由我来统一整理');
  });

  it('应该把“今日跟进：...”识别为今日跟进入口', async () => {
    const service = createService();
    const aiGateway = service['aiGatewayService'] as unknown as {
      classifyWecomIdleConversationIntent: jest.Mock;
    };
    aiGateway.classifyWecomIdleConversationIntent.mockResolvedValue({
      intent: 'DAILY_REPORT',
      dailyReportPrompt: 'FOLLOW_UP_TEMPLATE_ENTRY',
    });

    const decision = await service.decideNextAction(
      {
        turns: [],
        workMemory: {
          metrics: [],
          dimensions: [],
          filters: {},
          pendingSlots: [],
        },
      } as never,
      {
        messageText: '今日跟进：去了下项目现场',
      } as never,
      {
        scopeSummary: '测试权限范围',
      } as never,
    );

    expect(decision.action).toBe('DAILY_REPORT');
    expect(decision.directReply).toContain('本次跟进由我来统一整理');
  });

  it('应该把“你好”识别为帮助提示而不是进入分析', async () => {
    const service = createService();
    const aiGateway = service['aiGatewayService'] as unknown as {
      classifyWecomIdleConversationIntent: jest.Mock;
    };
    aiGateway.classifyWecomIdleConversationIntent.mockResolvedValue({
      intent: 'HELP_GUIDANCE',
      helpScene: 'GREETING',
    });

    const decision = await service.decideNextAction(
      {
        turns: [],
        workMemory: {
          metrics: [],
          dimensions: [],
          filters: {},
          pendingSlots: [],
        },
      } as never,
      {
        messageText: '你好',
      } as never,
      {
        scopeSummary: '测试权限范围',
      } as never,
    );

    expect(decision.action).toBe('HELP_GUIDANCE');
    expect(decision.directReply).toContain('CRM 智能小助手');
    expect(decision.directReply).toContain('经营分析问数');
  });

  it('空闲态普通经营分析问句应标记为自由问数主链', async () => {
    const service = createService();
    const aiGateway = service['aiGatewayService'] as unknown as {
      classifyWecomIdleConversationIntent: jest.Mock;
    };
    aiGateway.classifyWecomIdleConversationIntent.mockResolvedValue({
      intent: 'ANALYZE',
      packCode: 'wecom-idle-entry-pack',
      packVersion: 'test-fixture',
    });

    const decision = await service.decideNextAction(
      {
        turns: [],
        workMemory: {
          metrics: [],
          dimensions: [],
          filters: {},
          pendingSlots: [],
        },
      } as never,
      {
        messageText: '本月华东区域新增商机金额排名',
      } as never,
      {
        scopeSummary: '测试权限范围',
      } as never,
    );

    expect(decision.action).toBe('ANALYZE');
    expect(decision.entryInterpretationSnapshot).toMatchObject({
      targetWorkflow: 'ANALYSIS_QUERY_EXECUTION',
      packCode: 'wecom-idle-entry-pack',
      packVersion: 'test-fixture',
    });
    expect(decision.entryInterpretationSnapshot?.structuredSlots).toMatchObject({
      entryMode: 'FREE_QUERY',
      freeQueryIntent: 'ANALYZE',
    });
  });

  it('300问目录问题即使被空闲态 AI 误判为帮助也应进入分析', async () => {
    const service = createService();
    const aiGateway = service['aiGatewayService'] as unknown as {
      classifyWecomIdleConversationIntent: jest.Mock;
    };
    aiGateway.classifyWecomIdleConversationIntent.mockResolvedValue({
      intent: 'HELP_GUIDANCE',
      helpScene: 'CAPABILITY',
      packCode: 'wecom-idle-entry-pack',
      packVersion: 'test-fixture',
    });

    const decision = await service.decideNextAction(
      {
        turns: [],
        workMemory: {
          metrics: [],
          dimensions: [],
          filters: {},
          pendingSlots: [],
        },
      } as never,
      {
        messageText: '哪些报价最可能本周转订单',
      } as never,
      {
        scopeSummary: '测试权限范围',
      } as never,
    );

    expect(decision.action).toBe('ANALYZE');
    expect(decision.entryInterpretationSnapshot).toMatchObject({
      targetWorkflow: 'ANALYSIS_QUERY_EXECUTION',
      fallbackReason: 'crm-analysis-question-catalog-overrides-idle-intent',
    });
  });

  it('完整新分析问题不应携带上一轮分析上下文，避免对象串线', async () => {
    const service = createService();
    const aiGateway = service['aiGatewayService'] as unknown as {
      classifyWecomIdleConversationIntent: jest.Mock;
      classifyAnalysisFollowUpIntent: jest.Mock;
    };
    aiGateway.classifyWecomIdleConversationIntent.mockResolvedValue({
      intent: 'ANALYZE',
      packCode: 'wecom-idle-entry-pack',
      packVersion: 'test-fixture',
    });

    const decision = await service.decideNextAction(
      {
        turns: [],
        workMemory: {
          latestQuestion: '帮我查询分析下，公司当前的合作伙伴开拓情况、客户商机报备及订单情况',
          latestSummary: '上一轮是综合经营分析结果',
          metrics: [],
          dimensions: [],
          filters: {},
          pendingSlots: [],
        },
      } as never,
      {
        messageText: '帮我分析一下最近3个月的商机',
      } as never,
      {
        scopeSummary: '测试权限范围',
      } as never,
    );

    expect(aiGateway.classifyWecomIdleConversationIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        messageText: '帮我分析一下最近3个月的商机',
        latestQuestion: undefined,
        latestSummary: undefined,
      }),
    );
    expect(aiGateway.classifyAnalysisFollowUpIntent).not.toHaveBeenCalled();
    expect(decision.action).toBe('ANALYZE');
    expect(decision.effectiveQuestionText).toBe('帮我分析一下最近3个月的商机');
  });

  it('省略式追问应携带上一轮分析上下文并合并为追问分析', async () => {
    const service = createService();
    const aiGateway = service['aiGatewayService'] as unknown as {
      classifyWecomIdleConversationIntent: jest.Mock;
    };
    const clarificationService = service['clarificationService'] as unknown as {
      mergeFollowUpQuestion: jest.Mock;
    };
    aiGateway.classifyWecomIdleConversationIntent.mockResolvedValue({
      intent: 'FOLLOW_UP_ANALYZE',
      packCode: 'wecom-idle-entry-pack',
      packVersion: 'test-fixture',
    });
    clarificationService.mergeFollowUpQuestion.mockReturnValue(
      '帮我分析一下全部商机情况；换成最近3个月',
    );

    const decision = await service.decideNextAction(
      {
        turns: [],
        workMemory: {
          latestQuestion: '帮我分析一下全部商机情况',
          latestSummary: '上一轮是商机整体分析结果',
          metrics: [],
          dimensions: [],
          filters: {},
          pendingSlots: [],
        },
      } as never,
      {
        messageText: '换成最近3个月',
      } as never,
      {
        scopeSummary: '测试权限范围',
      } as never,
    );

    expect(aiGateway.classifyWecomIdleConversationIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        latestQuestion: '帮我分析一下全部商机情况',
        latestSummary: '上一轮是商机整体分析结果',
      }),
    );
    expect(decision.action).toBe('FOLLOW_UP_ANALYZE');
    expect(decision.effectiveQuestionText).toBe('帮我分析一下全部商机情况；换成最近3个月');
  });

  it('指代式追问应携带上一轮已验证结果上下文并合并为追问分析', async () => {
    const service = createService();
    const aiGateway = service['aiGatewayService'] as unknown as {
      classifyWecomIdleConversationIntent: jest.Mock;
      classifyAnalysisFollowUpIntent: jest.Mock;
    };
    const clarificationService = service['clarificationService'] as unknown as {
      mergeFollowUpQuestion: jest.Mock;
    };
    const latestResultContext = {
      queryId: 'analysis_query_latest',
      questionText: '最近三个月山东区域服务商商机贡献',
      title: '山东区域服务商商机贡献',
      summary: '山东华安赛服智能科技有限公司贡献 10 万元。',
      entities: [
        {
          type: 'RESULT_ROW',
          value: '山东华安赛服智能科技有限公司',
          source: 'tableRows',
        },
      ],
      appliedFilters: [
        {
          label: '区域',
          value: '山东',
        },
      ],
      topRows: [
        {
          label: '山东华安赛服智能科技有限公司',
          summaryFields: ['金额：10 万元', '数量：8'],
        },
      ],
      updatedAt: '2026-06-08T00:00:00.000Z',
    };
    aiGateway.classifyWecomIdleConversationIntent.mockResolvedValue({
      intent: 'NONE',
    });
    aiGateway.classifyAnalysisFollowUpIntent.mockResolvedValue('RUN_NEW_ANALYSIS');
    clarificationService.mergeFollowUpQuestion.mockImplementation(
      (baseQuestion: string | undefined, userQuestion: string) =>
        `${baseQuestion ?? ''}；${userQuestion}`,
    );

    const decision = await service.decideNextAction(
      {
        turns: [],
        workMemory: {
          latestQuestion: '最近三个月山东区域服务商商机贡献',
          latestSummary: '山东华安赛服智能科技有限公司贡献 10 万元。',
          latestQueryId: 'analysis_query_latest',
          latestResultContext,
          metrics: [],
          dimensions: [],
          filters: {},
          pendingSlots: [],
        },
      } as never,
      {
        messageText: '他最近跟进怎么样',
      } as never,
      {
        scopeSummary: '测试权限范围',
      } as never,
    );

    expect(aiGateway.classifyWecomIdleConversationIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        latestResultContext: expect.objectContaining({
          queryId: 'analysis_query_latest',
        }),
      }),
    );
    expect(aiGateway.classifyAnalysisFollowUpIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        latestResultContext: expect.objectContaining({
          queryId: 'analysis_query_latest',
        }),
      }),
    );
    expect(clarificationService.mergeFollowUpQuestion).toHaveBeenCalledWith(
      expect.stringContaining('山东华安赛服智能科技有限公司'),
      '他最近跟进怎么样',
    );
    expect(decision.action).toBe('FOLLOW_UP_ANALYZE');
    expect(decision.effectiveQuestionText).toContain('上一轮已验证结果上下文');
  });

  it('客户未报备商机和创建时长问句即使被 AI 误判为帮助也应回到自由问数主链', async () => {
    const service = createService();
    const aiGateway = service['aiGatewayService'] as unknown as {
      classifyWecomIdleConversationIntent: jest.Mock;
    };
    aiGateway.classifyWecomIdleConversationIntent.mockResolvedValue({
      intent: 'HELP_GUIDANCE',
      helpScene: 'CAPABILITY',
      packCode: 'wecom-idle-entry-pack',
      packVersion: 'test-fixture',
    });

    const decision = await service.decideNextAction(
      {
        turns: [],
        workMemory: {
          metrics: [],
          dimensions: [],
          filters: {},
          pendingSlots: [],
        },
      } as never,
      {
        messageText: '有多少客户是没有报备商机的，分别创建了多长时间',
      } as never,
      {
        scopeSummary: '测试权限范围',
      } as never,
    );

    expect(decision.action).toBe('ANALYZE');
    expect(decision.directReply).toBeUndefined();
    expect(decision.entryInterpretationSnapshot).toMatchObject({
      targetWorkflow: 'ANALYSIS_QUERY_EXECUTION',
      fallbackReason: 'readonly-customer-lifecycle-overrides-idle-intent',
    });
  });

  it('应该把“你能做什么”识别为帮助提示而不是进入分析', async () => {
    const service = createService();
    const aiGateway = service['aiGatewayService'] as unknown as {
      classifyWecomIdleConversationIntent: jest.Mock;
    };
    aiGateway.classifyWecomIdleConversationIntent.mockResolvedValue({
      intent: 'HELP_GUIDANCE',
      helpScene: 'CAPABILITY',
    });

    const decision = await service.decideNextAction(
      {
        turns: [],
        workMemory: {
          metrics: [],
          dimensions: [],
          filters: {},
          pendingSlots: [],
        },
      } as never,
      {
        messageText: '你能做什么',
      } as never,
      {
        scopeSummary: '测试权限范围',
      } as never,
    );

    expect(decision.action).toBe('HELP_GUIDANCE');
    expect(decision.directReply).toContain('跟进整理与受控写回');
    expect(decision.directReply).toContain('受控新增客户');
  });

  it('AI 未识别空闲态主题入口时不应退回旧规则主链', async () => {
    const service = createService();
    const aiGateway = service['aiGatewayService'] as unknown as {
      classifyWecomIdleConversationIntent: jest.Mock;
    };
    aiGateway.classifyWecomIdleConversationIntent.mockResolvedValue({
      intent: 'NONE',
    });

    const decision = await service.decideNextAction(
      {
        turns: [],
        workMemory: {
          metrics: [],
          dimensions: [],
          filters: {},
          pendingSlots: [],
        },
      } as never,
      {
        messageText: '新增客户',
      } as never,
      {
        scopeSummary: '测试权限范围',
      } as never,
    );

    expect(decision.action).toBe('ANALYZE');
    expect(decision.entryInterpretationSnapshot).toMatchObject({
      usedFallback: true,
      fallbackReason: 'idle-intent-none-default-analyze',
    });
  });

  it('有活跃日报时发送“你好”也应优先返回帮助提示', async () => {
    const service = createService();

    const decision = await service.decideNextAction(
      {
        turns: [],
        workMemory: {
          metrics: [],
          dimensions: [],
          filters: {},
          pendingSlots: [],
          dailyReportFlowStatus: 'COLLECTING',
        },
      } as never,
      {
        messageText: '你好',
      } as never,
      {
        scopeSummary: '测试权限范围',
      } as never,
    );

    expect(decision.action).toBe('HELP_GUIDANCE');
    expect(decision.directReply).toContain('CRM 智能小助手');
  });

  it('不应把统计查询误识别为帮助提示或今日跟进', async () => {
    const service = createService();

    const decision = await service.decideNextAction(
      {
        turns: [],
        workMemory: {
          metrics: [],
          dimensions: [],
          filters: {},
          pendingSlots: [],
        },
      } as never,
      {
        messageText: '今日商机金额排名',
      } as never,
      {
        scopeSummary: '测试权限范围',
      } as never,
    );

    expect(decision.action).toBe('ANALYZE');
    expect(decision.action).not.toBe('DAILY_REPORT');
  });

  it('企业微信解释型追问在关键词未命中时也应优先走统一 AI 判断', async () => {
    const service = createService();
    const aiGateway = service['aiGatewayService'] as unknown as {
      classifyAnalysisFollowUpIntent: jest.Mock;
    };
    aiGateway.classifyAnalysisFollowUpIntent.mockResolvedValue('EXPLAIN_RESULT');

    const decision = await service.decideNextAction(
      {
        turns: [],
        workMemory: {
          metrics: [],
          dimensions: [],
          filters: {},
          pendingSlots: [],
          latestQuestion: '本月各销售负责人新增商机金额排名',
          latestSummary: '王敏暂列第一',
        },
      } as never,
      {
        messageText: '重点原因是什么',
      } as never,
      {
        scopeSummary: '测试权限范围',
      } as never,
    );

    expect(decision.action).toBe('EXPLAIN_RESULT');
    expect(decision.directReply).toBe('AI解释回复');
  });

  it('明确 CRM 新查询不应被上一轮摘要误导成解释回复', async () => {
    const service = createService();
    const aiGateway = service['aiGatewayService'] as unknown as {
      classifyAnalysisFollowUpIntent: jest.Mock;
      generateWecomExplanationReply: jest.Mock;
    };
    aiGateway.classifyAnalysisFollowUpIntent.mockResolvedValue('EXPLAIN_RESULT');

    const decision = await service.decideNextAction(
      {
        turns: [],
        workMemory: {
          metrics: [],
          dimensions: [],
          filters: {},
          pendingSlots: [],
          latestQuestion: '上一次问的是别的主题',
          latestSummary: '上一轮结果摘要可能与本轮无关',
        },
      } as never,
      {
        messageText:
          '最近三个月山东区商机情况，整理成表格给我，按行业、商机阶段、字段需要金额、服务商、负责人',
      } as never,
      {
        scopeSummary: '测试权限范围',
      } as never,
    );

    expect(decision.action).toBe('ANALYZE');
    expect(decision.effectiveQuestionText).toContain('最近三个月山东区商机情况');
    expect(aiGateway.generateWecomExplanationReply).not.toHaveBeenCalled();
  });

  it('系统下发的图表快捷动作应复用上一轮 queryId 重发展示', async () => {
    const service = createService();
    const aiGateway = service['aiGatewayService'] as unknown as {
      classifyWecomIdleConversationIntent: jest.Mock;
      classifyAnalysisFollowUpIntent: jest.Mock;
      generateWecomExplanationReply: jest.Mock;
    };

    const decision = await service.decideNextAction(
      {
        turns: [],
        workMemory: {
          metrics: [],
          dimensions: [],
          filters: {},
          pendingSlots: [],
          latestQuestion: '最近三个月山东区域服务商商机贡献',
          latestSummary: '山东华安赛服智能科技有限公司贡献 10 万元。',
          latestQueryId: 'analysis_query_latest',
        },
      } as never,
      {
        messageText: '看分布图',
      } as never,
      {
        scopeSummary: '测试权限范围',
      } as never,
    );

    expect(decision.action).toBe('REDISPLAY_RESULT');
    expect(decision.redisplayMode).toBe('IMAGE');
    expect(decision.redisplayQueryId).toBe('analysis_query_latest');
    expect(aiGateway.classifyWecomIdleConversationIntent).not.toHaveBeenCalled();
    expect(aiGateway.classifyAnalysisFollowUpIntent).not.toHaveBeenCalled();
    expect(aiGateway.generateWecomExplanationReply).not.toHaveBeenCalled();
  });

  it('系统下发的解释快捷动作仍应基于上一轮摘要生成解释', async () => {
    const service = createService();
    const aiGateway = service['aiGatewayService'] as unknown as {
      classifyWecomIdleConversationIntent: jest.Mock;
      classifyAnalysisFollowUpIntent: jest.Mock;
      generateWecomExplanationReply: jest.Mock;
    };

    const decision = await service.decideNextAction(
      {
        turns: [],
        workMemory: {
          metrics: [],
          dimensions: [],
          filters: {},
          pendingSlots: [],
          latestQuestion: '最近三个月山东区域服务商商机贡献',
          latestSummary: '山东华安赛服智能科技有限公司贡献 10 万元。',
          latestQueryId: 'analysis_query_latest',
        },
      } as never,
      {
        messageText: '分析原因',
      } as never,
      {
        scopeSummary: '测试权限范围',
      } as never,
    );

    expect(decision.action).toBe('EXPLAIN_RESULT');
    expect(decision.directReply).toBe('AI解释回复');
    expect(aiGateway.classifyWecomIdleConversationIntent).not.toHaveBeenCalled();
    expect(aiGateway.classifyAnalysisFollowUpIntent).not.toHaveBeenCalled();
    expect(aiGateway.generateWecomExplanationReply).toHaveBeenCalledTimes(1);
  });

  it('企业微信改条件追问在关键词未命中时也应优先走统一 AI 判断', async () => {
    const service = createService();
    const aiGateway = service['aiGatewayService'] as unknown as {
      classifyAnalysisFollowUpIntent: jest.Mock;
    };
    aiGateway.classifyAnalysisFollowUpIntent.mockResolvedValue('RUN_NEW_ANALYSIS');
    const clarificationService = service['clarificationService'] as unknown as {
      mergeFollowUpQuestion: jest.Mock;
    };
    clarificationService.mergeFollowUpQuestion.mockReturnValue(
      '本月各销售负责人新增商机金额排名 苏州区域也看一下',
    );

    const decision = await service.decideNextAction(
      {
        turns: [],
        workMemory: {
          metrics: [],
          dimensions: [],
          filters: {},
          pendingSlots: [],
          latestQuestion: '本月各销售负责人新增商机金额排名',
          latestSummary: '王敏暂列第一',
        },
      } as never,
      {
        messageText: '苏州区域也看一下',
      } as never,
      {
        scopeSummary: '测试权限范围',
      } as never,
    );

    expect(decision.action).toBe('FOLLOW_UP_ANALYZE');
    expect(decision.effectiveQuestionText).toContain('苏州区域也看一下');
  });

  it('补问场景也应先经过统一 AI 理解层，再决定是否进入澄清回复', async () => {
    const service = createService();
    const aiGateway = service['aiGatewayService'] as unknown as {
      classifyWecomIdleConversationIntent: jest.Mock;
    };
    aiGateway.classifyWecomIdleConversationIntent.mockResolvedValue({
      intent: 'NONE',
    });
    const clarificationService = service['clarificationService'] as unknown as {
      mergeClarificationQuestion: jest.Mock;
    };
    clarificationService.mergeClarificationQuestion.mockReturnValue(
      '本月各销售负责人新增商机金额排名；补充说明：最近30天',
    );

    const decision = await service.decideNextAction(
      {
        turns: [],
        workMemory: {
          metrics: [],
          dimensions: [],
          filters: {},
          pendingSlots: ['时间范围'],
          latestQuestion: '本月各销售负责人新增商机金额排名',
        },
      } as never,
      {
        messageText: '最近30天',
      } as never,
      {
        scopeSummary: '测试权限范围',
      } as never,
    );

    expect(aiGateway.classifyWecomIdleConversationIntent).toHaveBeenCalledWith({
      messageText: '最近30天',
      latestQuestion: '本月各销售负责人新增商机金额排名',
      latestSummary: undefined,
      hasPendingSlots: true,
    });
    expect(decision.action).toBe('CLARIFICATION_REPLY');
  });

  it('写入上一轮问题与摘要时应按上下文策略截断', () => {
    const service = createService();
    const contextPolicyService = service['aiContextPolicyService'] as unknown as {
      getCurrent: jest.Mock;
      trimLatestQuestion: jest.Mock;
      trimLatestSummary: jest.Mock;
    };
    contextPolicyService.getCurrent.mockReturnValue({
      turnRetentionLimit: 8,
      historySummaryMaxLength: 600,
      latestQuestionMaxLength: 6,
      latestSummaryMaxLength: 8,
      analysisSessionIdleTimeoutSeconds: 1800,
      taskSessionIdleTimeoutSeconds: 7200,
    });
    contextPolicyService.trimLatestQuestion.mockImplementation((value: string | undefined) => {
      const normalizedValue = value?.trim();
      return normalizedValue ? normalizedValue.slice(0, 6) : undefined;
    });
    contextPolicyService.trimLatestSummary.mockImplementation((value: string | undefined) => {
      const normalizedValue = value?.trim();
      return normalizedValue ? normalizedValue.slice(0, 8) : undefined;
    });

    const updated = service.updateWorkMemoryAfterResponse(
      {
        workMemory: {
          metrics: [],
          dimensions: [],
          filters: {},
          pendingSlots: [],
        },
      } as never,
      {
        questionText: '  最近三个月华东区域排名  ',
        summary: '  王敏暂列第一，苏州区域贡献最高  ',
      },
    );

    expect(updated.workMemory.latestQuestion).toBe('最近三个月华');
    expect(updated.workMemory.latestSummary).toBe('王敏暂列第一，苏');
  });

  it('会话轮次超过阈值后应压缩旧消息并限制历史摘要长度', () => {
    const service = createService();
    const contextPolicyService = service['aiContextPolicyService'] as unknown as {
      getCurrent: jest.Mock;
      trimHistorySummary: jest.Mock;
    };
    contextPolicyService.getCurrent.mockReturnValue({
      turnRetentionLimit: 3,
      historySummaryMaxLength: 12,
      latestQuestionMaxLength: 200,
      latestSummaryMaxLength: 800,
      analysisSessionIdleTimeoutSeconds: 1800,
      taskSessionIdleTimeoutSeconds: 7200,
    });
    contextPolicyService.trimHistorySummary.mockImplementation((value: string | undefined) => {
      const normalizedValue = value?.trim();
      return normalizedValue ? normalizedValue.slice(0, 12) : undefined;
    });

    const updated = service.appendUserTurn(
      {
        turns: [
          { role: 'user', content: '第一轮问题内容很长', createdAt: '2026-04-27T10:00:00.000Z' },
          { role: 'assistant', content: '第一轮回答内容很长', createdAt: '2026-04-27T10:01:00.000Z' },
          { role: 'user', content: '第二轮问题', createdAt: '2026-04-27T10:02:00.000Z' },
        ],
        workMemory: {
          metrics: [],
          dimensions: [],
          filters: {},
          pendingSlots: [],
        },
      } as never,
      {
        messageText: '第三轮问题',
        channelMessageId: 'msg_001',
        receivedAt: '2026-04-27T10:03:00.000Z',
      } as never,
    );

    expect(updated.turns).toHaveLength(3);
    expect(updated.turns[0].role).toBe('system');
    expect(updated.turns[0].content).toContain('历史摘要：');
    expect(updated.turns[0].content.length).toBeLessThanOrEqual(17);
  });

  it('任务态上下文超过失活时长后应先清空旧任务状态', () => {
    const service = createService();
    const contextPolicyService = service['aiContextPolicyService'] as unknown as {
      getCurrent: jest.Mock;
      isTaskSessionExpired: jest.Mock;
    };
    contextPolicyService.getCurrent.mockReturnValue({
      turnRetentionLimit: 8,
      historySummaryMaxLength: 600,
      latestQuestionMaxLength: 200,
      latestSummaryMaxLength: 800,
      analysisSessionIdleTimeoutSeconds: 1800,
      taskSessionIdleTimeoutSeconds: 300,
    });
    contextPolicyService.isTaskSessionExpired.mockReturnValue(true);

    const updated = service.applyContextPolicy(
      {
        turns: [],
        workMemory: {
          metrics: [],
          dimensions: [],
          filters: {},
          pendingSlots: [],
          dailyReportFlowStatus: 'COLLECTING',
          dailyReportReportId: 'report_001',
          followUpTemplateDraft: {
            requesterName: '销售总监',
            followUpContent: '今日已拜访客户',
          },
          crmCreateStatus: 'COLLECTING',
        },
        updatedAt: '2026-04-27T10:00:00.000Z',
      } as never,
      '2026-04-27T10:10:00.000Z',
    );

    expect(updated.workMemory.dailyReportFlowStatus).toBe('IDLE');
    expect(updated.workMemory.followUpTemplateDraft).toBeUndefined();
    expect(updated.workMemory.crmCreateStatus).toBeUndefined();
  });

  it('routes opportunity detail follow-up to readonly analysis instead of CRM create', async () => {
    const service = createService();
    const aiGateway = service['aiGatewayService'] as unknown as {
      classifyWecomIdleConversationIntent: jest.Mock;
    };
    const clarificationService = service['clarificationService'] as unknown as {
      mergeFollowUpQuestion: jest.Mock;
    };
    clarificationService.mergeFollowUpQuestion.mockReturnValue(
      '最近一年商机情况，查看这批商机明细',
    );

    const decision = await service.decideNextAction(
      {
        turns: [],
        workMemory: {
          metrics: [],
          dimensions: [],
          filters: {},
          pendingSlots: [],
          latestQuestion: '最近一年商机情况',
          latestSummary: '共 41 条商机，金额 15 万元。',
          latestQueryId: 'analysis_query_latest',
        },
      } as never,
      {
        messageText: '查看这批商机明细',
      } as never,
      {
        scopeSummary: '测试权限范围',
      } as never,
    );

    expect(decision.action).toBe('FOLLOW_UP_ANALYZE');
    expect(decision.effectiveQuestionText).toBe('最近一年商机情况，查看这批商机明细');
    expect(decision.entryInterpretationSnapshot?.fallbackReason).toBe(
      'readonly-opportunity-detail-reuses-latest-analysis',
    );
    expect(aiGateway.classifyWecomIdleConversationIntent).not.toHaveBeenCalled();
  });

  it('routes standalone opportunity detail request to readonly entity lookup', async () => {
    const service = createService();
    const aiGateway = service['aiGatewayService'] as unknown as {
      classifyWecomIdleConversationIntent: jest.Mock;
    };

    const decision = await service.decideNextAction(
      {
        turns: [],
        workMemory: {
          metrics: [],
          dimensions: [],
          filters: {},
          pendingSlots: [],
        },
      } as never,
      {
        messageText: '查看所有商机明细列表',
      } as never,
      {
        scopeSummary: '测试权限范围',
      } as never,
    );

    expect(decision.action).toBe('ENTITY_LOOKUP');
    expect(decision.entityLookupAction).toBe('LIST');
    expect(decision.entityLookupEntityType).toBe('Opportunity');
    expect(decision.entryInterpretationSnapshot?.fallbackReason).toBe(
      'readonly-opportunity-detail-entity-lookup',
    );
    expect(aiGateway.classifyWecomIdleConversationIntent).not.toHaveBeenCalled();
  });

  it('routes opportunity table presentation request to ANALYZE not ENTITY_LOOKUP', async () => {
    const service = createService();
    const aiGateway = service['aiGatewayService'] as unknown as {
      classifyWecomIdleConversationIntent: jest.Mock;
    };

    const decision = await service.decideNextAction(
      {
        turns: [],
        workMemory: {
          metrics: [],
          dimensions: [],
          filters: {},
          pendingSlots: [],
        },
      } as never,
      {
        messageText: '把所有的商机，用表格方式呈现',
      } as never,
      {
        scopeSummary: '测试权限范围',
      } as never,
    );

    expect(decision.action).toBe('ANALYZE');
    expect(decision.entryInterpretationSnapshot?.fallbackReason).toBe(
      'readonly-opportunity-table-presentation-runs-analysis',
    );
    expect(aiGateway.classifyWecomIdleConversationIntent).not.toHaveBeenCalled();
  });

  it('overrides mistaken opportunity create intent unless explicit create verb exists', async () => {
    const service = createService();
    const aiGateway = service['aiGatewayService'] as unknown as {
      classifyWecomIdleConversationIntent: jest.Mock;
    };
    aiGateway.classifyWecomIdleConversationIntent.mockResolvedValue({
      intent: 'CRM_CREATE_OPPORTUNITY',
    });

    const decision = await service.decideNextAction(
      {
        turns: [],
        workMemory: {
          metrics: [],
          dimensions: [],
          filters: {},
          pendingSlots: [],
        },
      } as never,
      {
        messageText: '最近一年商机情况',
      } as never,
      {
        scopeSummary: '测试权限范围',
      } as never,
    );

    expect(decision.action).toBe('ANALYZE');
    expect(decision.entryInterpretationSnapshot?.fallbackReason).toBe(
      'readonly-opportunity-query-overrides-create-intent',
    );
  });
});

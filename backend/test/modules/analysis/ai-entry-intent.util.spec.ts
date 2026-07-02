import {
  createAiEntryInterpretationSnapshot,
  createAiWorkflowRoutingSnapshot,
  detectAiEntryLanguage,
} from '../../../src/shared/utils/ai-entry-intent.util';

describe('AiEntryIntent utilities', () => {
  it('应为 Web 首次问数快照补齐语言并校验结构化槽位', () => {
    const snapshot = createAiEntryInterpretationSnapshot({
      channel: 'web-console',
      scene: 'WEB_ANALYSIS_QUERY',
      targetWorkflow: 'ANALYSIS_QUERY_EXECUTION',
      originalText: '本月各销售负责人新增商机金额排名',
      intent: 'ANALYZE',
      requestedAction: 'READONLY_ANALYSIS',
      confidence: 'HIGH',
      usedFallback: false,
      structuredSlots: {
        domain: 'opportunity-analysis',
        metrics: ['新增商机金额'],
        dimensions: ['销售负责人'],
        filters: {
          timeRange: '本月',
        },
        missingConditions: [],
        resultKindHint: 'owner-ranking',
      },
      generatedAt: '2026-04-16T00:00:00.000Z',
    });

    expect(snapshot.language).toBe('zh-CN');
    expect(snapshot.structuredSlots).toMatchObject({
      domain: 'opportunity-analysis',
      metrics: ['新增商机金额'],
    });
  });

  it('缺少团队日报关键槽位时应拒绝构造快照', () => {
    expect(() =>
      createAiEntryInterpretationSnapshot({
        channel: 'wecom-bot',
        scene: 'WECOM_IDLE_MESSAGE',
        targetWorkflow: 'WECOM_TEAM_DAILY_REPORT_QUERY',
        originalText: '把王文定小组日报发给我',
        intent: 'ANALYZE',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'HIGH',
        usedFallback: false,
        structuredSlots: {},
        generatedAt: '2026-04-16T00:00:00.000Z',
      }),
    ).toThrow('统一 AI 入口结构化槽位校验失败');
  });

  it('应支持活跃任务回复场景的确认语义快照', () => {
    const snapshot = createAiEntryInterpretationSnapshot({
      channel: 'wecom-bot',
      scene: 'WECOM_ACTIVE_TASK_REPLY',
      targetWorkflow: 'WECOM_TASK_ROUTER',
      originalText: 'sure',
      intent: 'CONFIRM',
      replyIntent: 'CONTINUE_EXECUTION',
      confidence: 'HIGH',
      usedFallback: false,
      structuredSlots: {
        activeTaskLabel: '当前CRM跟进写入',
      },
      generatedAt: '2026-04-16T00:00:00.000Z',
    });

    expect(snapshot.language).toBe('en');
    expect(snapshot.intent).toBe('CONFIRM');
  });

  it('程序路由快照应保留执行门闩结果', () => {
    const snapshot = createAiWorkflowRoutingSnapshot({
      targetWorkflow: 'ANALYSIS_QUERY_EXECUTION',
      finalProgram: ' analysis-workflow-orchestrator.run ',
      requiresConfirmation: false,
      gateResult: 'BYPASSED',
      generatedAt: '2026-04-16T00:00:00.000Z',
    });

    expect(snapshot.finalProgram).toBe('analysis-workflow-orchestrator.run');
    expect(snapshot.gateResult).toBe('BYPASSED');
  });

  it('应把中英混写识别为 mixed 语言', () => {
    expect(detectAiEntryLanguage('帮我 explain 一下')).toBe('mixed');
  });

  it('应识别韩文与日文输入语言', () => {
    expect(detectAiEntryLanguage('안녕하세요')).toBe('ko');
    expect(detectAiEntryLanguage('こんにちは')).toBe('ja');
  });

  it('纯符号和数字应回退为 unknown', () => {
    expect(detectAiEntryLanguage('12345 ???')).toBe('unknown');
  });
});

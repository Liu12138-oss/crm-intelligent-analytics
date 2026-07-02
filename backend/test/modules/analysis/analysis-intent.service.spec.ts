import { AnalysisIntentService } from '../../../src/modules/analysis/analysis-intent.service';
import { BusinessAnalysisIntentMapperService } from '../../../src/modules/analysis/business-analysis-intent-mapper.service';
import type { BusinessAnalysisIntent } from '../../../src/modules/analysis/business-analysis-intent.types';
import { LianruanCrmFieldCapabilityRegistry } from '../../../src/modules/crm-standard-api/lianruan-crm-field-capability.registry';

describe('AnalysisIntentService', () => {
  const businessMapper = new BusinessAnalysisIntentMapperService(
    new LianruanCrmFieldCapabilityRegistry(),
  );

  /**
   * 构造宽业务意图测试数据。
   *
   * 参数说明：`overrides` 用于覆盖默认的订单渠道分析意图。
   * 返回值说明：返回符合宽业务解析 contract 的最小完整结构。
   * 调用注意事项：测试只验证入口编排，不在这里模拟联软 OpenAPI 返回数据。
   */
  function createBusinessIntent(
    overrides: Partial<BusinessAnalysisIntent> = {},
  ): BusinessAnalysisIntent {
    return {
      objectTypes: ['order', 'partner'],
      metrics: ['order_count', 'order_amount', 'total_amount'],
      dimensions: ['region', 'partner', 'month'],
      filters: [
        {
          field: 'region',
          operator: 'contains',
          value: '山东',
          label: '山东区域',
        },
      ],
      timeRange: {
        rawText: '最近三个月',
        normalizedLabel: '最近三个月',
        startAt: '2026-03-01T00:00:00+08:00',
        endAt: '2026-06-01T00:00:00+08:00',
        timezone: 'Asia/Shanghai',
        granularity: 'month',
        relativity: 'relative',
        inclusivity: { start: 'inclusive', end: 'exclusive' },
        confidence: 'HIGH',
      },
      analysisMode: 'summary_report',
      outputPreference: ['text_summary', 'table', 'chart'],
      comparison: [],
      entities: [{ type: 'region', value: '山东' }],
      confidence: 'HIGH',
      missingConditions: [],
      unsupportedHints: [],
      requestedAction: 'READONLY_ANALYSIS',
      blockReason: '',
      normalizedQuestion:
        '最近三个月山东区域，有下单的服务商，对应订单数量、订单金额和总金额',
      ...overrides,
    };
  }

  it('应在宽业务主链命中时映射为统一 AnalysisIntent 并记录非 fallback 快照', async () => {
    const parseStructuredIntent = jest.fn(async () => null);
    const parseBusinessAnalysisIntent = jest.fn(async () =>
      createBusinessIntent({
        objectTypes: ['order'],
        metrics: ['order_amount'],
        dimensions: ['region'],
        analysisMode: 'ranking',
        normalizedQuestion: '本月华东区域订单金额',
        timeRange: {
          rawText: '本月',
          normalizedLabel: '本月',
          startAt: '2026-06-01T00:00:00+08:00',
          endAt: '2026-07-01T00:00:00+08:00',
          timezone: 'Asia/Shanghai',
          granularity: 'month',
          relativity: 'relative',
          inclusivity: { start: 'inclusive', end: 'exclusive' },
          confidence: 'HIGH',
        },
      }),
    );
    const service = new AnalysisIntentService(
      {
        summarizeQuestion: jest.fn((value: string) => value.trim()),
        parseBusinessAnalysisIntent,
        parseStructuredIntent,
      } as never,
      businessMapper,
    );

    const result = await service.parseWithEntrySnapshot(' 本月华东区域订单金额 ');

    expect(parseBusinessAnalysisIntent).toHaveBeenCalledWith('本月华东区域订单金额');
    expect(parseStructuredIntent).not.toHaveBeenCalled();
    expect(result.intent).toMatchObject({
      domain: 'contract-conversion',
      metrics: ['转合同金额'],
      dimensions: expect.arrayContaining(['区域']),
      requestedAction: 'READONLY_ANALYSIS',
      confidence: 'HIGH',
      resultKindHint: 'department-contribution',
      timeRangeText: '本月',
    });
    expect(result.entryInterpretationSnapshot.usedFallback).toBe(false);
    expect(result.entryInterpretationSnapshot.language).toBe('zh-CN');
    expect(result.entryInterpretationSnapshot.targetWorkflow).toBe(
      'ANALYSIS_QUERY_EXECUTION',
    );
    expect(result.entryInterpretationSnapshot.structuredSlots).toMatchObject({
      domain: 'contract-conversion',
      metrics: ['转合同金额'],
      entryMode: 'FREE_QUERY',
      resultIntent: 'ranking',
      timeRangeText: '本月',
      analysisDepth: 'snapshot',
      analysisFocus: expect.any(Array),
    });
  });

  it('宽业务解析失败时应对明确 CRM 只读问题启用受控主链补偿且不再调用窄业务解析', async () => {
    const parseStructuredIntent = jest.fn(async () => {
      throw new Error('窄业务解析不应被正式主链调用');
    });
    const service = new AnalysisIntentService(
      {
        summarizeQuestion: jest.fn((value: string) => value.trim()),
        parseBusinessAnalysisIntent: jest.fn(async () => null),
        parseStructuredIntent,
      } as never,
      businessMapper,
    );

    const result = await service.parseWithEntrySnapshot(
      '最近三个月山东区商机情况，整理成表格给我',
    );

    expect(parseStructuredIntent).not.toHaveBeenCalled();
    expect(result.intent.requestedAction).toBe('READONLY_ANALYSIS');
    expect(result.intent.domain).toBe('opportunity-analysis');
    expect(result.intent.metrics).toEqual(expect.arrayContaining(['商机数量']));
    expect(result.intent.businessIntentHint?.metrics).toEqual(
      expect.arrayContaining(['opportunity_count', 'opportunity_amount']),
    );
    expect(result.intent.dimensions).toEqual(
      expect.arrayContaining(['渠道商', '区域', '商机阶段']),
    );
    expect(result.entryInterpretationSnapshot.usedFallback).toBe(true);
    expect(result.entryInterpretationSnapshot.fallbackReason).toBe(
      'business-analysis-intent-controlled-compensation',
    );
    expect(result.entryInterpretationSnapshot.targetWorkflow).toBe(
      'ANALYSIS_QUERY_EXECUTION',
    );
  });

  it('未注入宽业务映射器时不得退回本地词表生成可执行意图', async () => {
    const parseStructuredIntent = jest.fn(async () => null);
    const service = new AnalysisIntentService({
      summarizeQuestion: jest.fn((value: string) => value.trim()),
      parseBusinessAnalysisIntent: jest.fn(async () => createBusinessIntent()),
      parseStructuredIntent,
    } as never);

    const result = await service.parseWithEntrySnapshot(
      '最近三个月山东区域商机数量统计',
    );

    expect(parseStructuredIntent).not.toHaveBeenCalled();
    expect(result.intent.requestedAction).toBe('BLOCK');
    expect(result.intent.metrics).toEqual([]);
    expect(result.entryInterpretationSnapshot.fallbackReason).toBe(
      'business-analysis-intent-unavailable',
    );
  });

  it('宽业务明确阻断时应透传业务阻断原因', async () => {
    const parseStructuredIntent = jest.fn(async () => null);
    const service = new AnalysisIntentService(
      {
        summarizeQuestion: jest.fn((value: string) => value.trim()),
        parseBusinessAnalysisIntent: jest.fn(async () =>
          createBusinessIntent({
            requestedAction: 'BLOCK',
            blockReason: '当前请求包含写入动作，不属于受控只读 CRM 分析范围。',
          }),
        ),
        parseStructuredIntent,
      } as never,
      businessMapper,
    );

    const result = await service.parseWithEntrySnapshot('帮我创建一个新商机');

    expect(parseStructuredIntent).not.toHaveBeenCalled();
    expect(result.intent.requestedAction).toBe('BLOCK');
    expect(result.intent.blockReason).toBe(
      '当前请求包含写入动作，不属于受控只读 CRM 分析范围。',
    );
    expect(result.entryInterpretationSnapshot.usedFallback).toBe(false);
  });

  it('应优先使用宽业务意图并映射为订单渠道贡献分析', async () => {
    const parseStructuredIntent = jest.fn(async () => null);
    const service = new AnalysisIntentService(
      {
        summarizeQuestion: jest.fn((value: string) => value.trim()),
        parseBusinessAnalysisIntent: jest.fn(async () => createBusinessIntent()),
        parseStructuredIntent,
      } as never,
      businessMapper,
    );

    const result = await service.parseWithEntrySnapshot(
      '最近三个月山东区域，有下单的服务商，对应订单数量、订单金额和总金额',
    );

    expect(parseStructuredIntent).not.toHaveBeenCalled();
    expect(result.intent).toMatchObject({
      domain: 'contract-conversion',
      resultKindHint: 'partner-contribution',
      dimensions: expect.arrayContaining(['区域', '渠道商', '月份']),
      analysisDepth: 'deep-dive',
    });
    expect(result.entryInterpretationSnapshot.structuredSlots).toMatchObject({
      domain: 'contract-conversion',
      resultKindHint: 'partner-contribution',
    });
  });

  it('宽业务解析失败时应把客户报备和商机类问题补偿为只读分析意图', async () => {
    const service = new AnalysisIntentService(
      {
        summarizeQuestion: jest.fn((value: string) => value.trim()),
        parseBusinessAnalysisIntent: jest.fn(async () => null),
        parseStructuredIntent: jest.fn(async () => null),
      } as never,
      businessMapper,
    );

    const result = await service.parseWithEntrySnapshot(
      '有多少客户是没有报备商机的，分别创建了多长时间',
    );

    expect(result.intent.requestedAction).toBe('READONLY_ANALYSIS');
    expect(result.intent.domain).toBe('opportunity-analysis');
    expect(result.intent.businessIntentHint?.objectTypes).toEqual(
      expect.arrayContaining(['registration', 'opportunity', 'partner']),
    );
    expect(result.entryInterpretationSnapshot.fallbackReason).toBe(
      'business-analysis-intent-controlled-compensation',
    );
  });

  it('宽业务解析失败时非 CRM 问题仍应安全阻断', async () => {
    const service = new AnalysisIntentService(
      {
        summarizeQuestion: jest.fn((value: string) => value.trim()),
        parseBusinessAnalysisIntent: jest.fn(async () => null),
        parseStructuredIntent: jest.fn(async () => null),
      } as never,
      businessMapper,
    );

    const result = await service.parseWithEntrySnapshot('明天广州天气怎么样');

    expect(result.intent.requestedAction).toBe('BLOCK');
    expect(result.intent.blockReason).toContain('统一业务语义解析');
    expect(result.entryInterpretationSnapshot.targetWorkflow).toBe(
      'ANALYSIS_BLOCKED',
    );
  });

  it('宽业务解析失败时写入动作仍应阻断，不进入只读补偿', async () => {
    const service = new AnalysisIntentService(
      {
        summarizeQuestion: jest.fn((value: string) => value.trim()),
        parseBusinessAnalysisIntent: jest.fn(async () => null),
        parseStructuredIntent: jest.fn(async () => null),
      } as never,
      businessMapper,
    );

    const result = await service.parseWithEntrySnapshot('帮我新增一个渠道商');

    expect(result.intent.requestedAction).toBe('BLOCK');
    expect(result.intent.blockReason).toContain('不属于受控只读 CRM 分析范围');
    expect(result.entryInterpretationSnapshot.fallbackReason).toBe(
      'business-analysis-intent-controlled-compensation',
    );
  });

  it('渠道商商机趋势分析应映射为时间趋势而非渠道商贡献', async () => {
    const service = new AnalysisIntentService(
      {
        summarizeQuestion: jest.fn((value: string) => value.trim()),
        parseBusinessAnalysisIntent: jest.fn(async () => null),
        parseStructuredIntent: jest.fn(async () => null),
      } as never,
      businessMapper,
    );

    const result = await service.parseWithEntrySnapshot('渠道商商机趋势分析');

    expect(result.intent.requestedAction).toBe('READONLY_ANALYSIS');
    expect(result.intent.resultKindHint).toBe('time-trend');
    expect(result.intent.resultIntent).toBe('trend');
    expect(result.entryInterpretationSnapshot.fallbackReason).toBe(
      'business-analysis-intent-controlled-compensation',
    );
  });

  it('追问"你并没有分析趋势"应识别为趋势意图而非明细意图', async () => {
    const service = new AnalysisIntentService(
      {
        summarizeQuestion: jest.fn((value: string) => value.trim()),
        parseBusinessAnalysisIntent: jest.fn(async () => null),
        parseStructuredIntent: jest.fn(async () => null),
      } as never,
      businessMapper,
    );

    const result = await service.parseWithEntrySnapshot(
      '你并没有分析商机趋势，你只是给我列出了商机明细',
    );

    expect(result.intent.requestedAction).toBe('READONLY_ANALYSIS');
    expect(result.intent.resultKindHint).toBe('time-trend');
    expect(result.intent.resultIntent).toBe('trend');
  });

  it('渠道商商机明细应仍映射为明细而非趋势', async () => {
    const service = new AnalysisIntentService(
      {
        summarizeQuestion: jest.fn((value: string) => value.trim()),
        parseBusinessAnalysisIntent: jest.fn(async () => null),
        parseStructuredIntent: jest.fn(async () => null),
      } as never,
      businessMapper,
    );

    const result = await service.parseWithEntrySnapshot('渠道商商机明细');

    expect(result.intent.requestedAction).toBe('READONLY_ANALYSIS');
    expect(result.intent.resultKindHint).toBe('owner-ranking');
    expect(result.intent.resultIntent).toBe('detail');
  });
});

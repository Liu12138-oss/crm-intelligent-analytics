import { analysisIntentPack } from '../../../src/modules/analysis/capability-packs/packs/analysis-intent.pack';

describe('analysisIntentPack', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-23T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('应把趋势型结果意图映射为 time-trend，而不是固定回退排名', () => {
    const intent = analysisIntentPack.normalize(
      {
        domain: 'opportunity-analysis',
        metrics: ['新增商机金额'],
        dimensions: ['月份'],
        missingConditions: [],
        normalizedQuestion: '请分析一下前三个月的商机情况',
        timeRange: '前三个月',
        timeRangeText: '前三个月',
        resultIntent: 'trend',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'HIGH',
        blockReason: '',
      },
      {
        questionText: '请分析一下前三个月的商机情况',
      },
    );

    expect(intent.resultIntent).toBe('trend');
    expect(intent.resultKindHint).toBe('time-trend');
  });

  it('应把服务商/渠道商维度映射为渠道商贡献结果类型', () => {
    const intent = analysisIntentPack.normalize(
      {
        domain: 'opportunity-analysis',
        metrics: ['新增商机金额', '商机数量'],
        dimensions: ['渠道商', '区域'],
        missingConditions: [],
        normalizedQuestion: '最近三个月山东区域有商机的服务商商机数量和金额',
        temporalSlot: {
          rawText: '最近三个月',
          normalizedLabel: '最近三个月',
          startAt: '2026-01-31T16:00:00.000Z',
          endAt: '2026-04-30T16:00:00.000Z',
          timezone: 'Asia/Shanghai',
          granularity: 'month',
          relativity: 'relative',
          inclusivity: { start: 'inclusive', end: 'exclusive' },
          confidence: 'HIGH',
        },
        resultIntent: 'ranking',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'HIGH',
        blockReason: '',
      },
      {
        questionText: '最近三个月山东区域有商机的服务商商机数量和金额',
      },
    );

    expect(intent.dimensions).toEqual(expect.arrayContaining(['渠道商', '区域']));
    expect(intent.resultKindHint).toBe('partner-contribution');
  });

  it('应保留 AI 返回的标准时间槽并写入 filters', () => {
    const intent = analysisIntentPack.normalize(
      {
        domain: 'opportunity-analysis',
        metrics: ['新增商机金额'],
        dimensions: ['月份'],
        missingConditions: [],
        normalizedQuestion: '请分析一下前三个月的商机情况',
        temporalSlot: {
          rawText: '前三个月',
          normalizedLabel: '前三个月',
          startAt: '2026-01-31T16:00:00.000Z',
          endAt: '2026-04-30T16:00:00.000Z',
          timezone: 'Asia/Shanghai',
          granularity: 'month',
          relativity: 'relative',
          inclusivity: { start: 'inclusive', end: 'exclusive' },
          confidence: 'HIGH',
        },
        resultIntent: 'trend',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'HIGH',
        blockReason: '',
      },
      {
        questionText: '请分析一下前三个月的商机情况',
      },
    );

    expect(intent.filters).toEqual({
      timeRange: '前三个月',
      startAt: '2026-01-31T16:00:00.000Z',
      endAt: '2026-04-30T16:00:00.000Z',
    });
    expect(intent.temporalSlot).toEqual(
      expect.objectContaining({
        rawText: '前三个月',
        normalizedLabel: '前三个月',
        granularity: 'month',
        timezone: 'Asia/Shanghai',
        confidence: 'HIGH',
      }),
    );
    expect(intent.timeRangeText).toBe('前三个月');
    expect(intent.missingConditions).not.toContain('时间范围');
  });

  it('AI 主链成功但缺少时间槽时不得用本地词表伪造可执行时间范围', () => {
    const intent = analysisIntentPack.normalize(
      {
        domain: 'opportunity-analysis',
        metrics: ['新增商机金额'],
        dimensions: ['月份'],
        missingConditions: ['时间范围'],
        normalizedQuestion: '请分析一下最近四个月的商机情况',
        resultIntent: 'trend',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'HIGH',
        blockReason: '',
      },
      {
        questionText: '请分析一下最近四个月的商机情况',
      },
    );

    expect(intent.filters).toEqual({});
    expect(intent.temporalSlot).toBeUndefined();
    expect(intent.missingConditions).toContain('时间范围');
    expect(intent.timeRangeText).toBeUndefined();
    expect(intent.resultKindHint).toBe('time-trend');
  });

  it('用户未限定时间时应默认当前权限全量范围，不要求补充时间', () => {
    const intent = analysisIntentPack.normalize(
      {
        domain: 'customer-relationship',
        metrics: ['客户贡献度'],
        dimensions: ['客户分类'],
        missingConditions: ['时间范围'],
        normalizedQuestion: '有多少客户是没有报备商机的',
        resultIntent: 'summary',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'MEDIUM',
        blockReason: '',
      },
      {
        questionText: '有多少客户是没有报备商机的',
      },
    );

    expect(intent.filters).toEqual({});
    expect(intent.temporalSlot).toBeUndefined();
    expect(intent.missingConditions).not.toContain('时间范围');
    expect(intent.requestedAction).toBe('READONLY_ANALYSIS');
  });

  it('应移除默认可执行的缺口说明，避免商机进展问法被误追问', () => {
    const intent = analysisIntentPack.normalize(
      {
        domain: 'opportunity-analysis',
        metrics: ['商机数量', '新增商机金额'],
        dimensions: ['商机阶段', '销售负责人', '渠道商'],
        missingConditions: [
          '未指定商机进展的具体衡量指标，默认提供商机数量、金额及停滞商机数量',
          '未指定时间范围，将展示全量商机数据',
          '未指定分析维度，默认按阶段、负责人、合作伙伴、区域展示',
        ],
        normalizedQuestion: '帮我分析一下商机的进展',
        resultIntent: 'summary',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'MEDIUM',
        blockReason: '',
      },
      {
        questionText: '帮我分析一下商机的进展',
      },
    );

    expect(intent.missingConditions).toEqual([]);
    expect(intent.requestedAction).toBe('READONLY_ANALYSIS');
    expect(intent.analysisDepth).toBe('standard');
  });

  it('客户创建时长统计即使被 AI 原始输出为 BLOCK，也应归一为只读分析', () => {
    const intent = analysisIntentPack.normalize(
      {
        domain: 'customer-relationship',
        metrics: ['客户贡献度'],
        dimensions: ['客户分类'],
        missingConditions: [],
        normalizedQuestion: '有多少客户是没有报备商机的，分别创建了多长时间',
        resultIntent: 'summary',
        requestedAction: 'BLOCK',
        confidence: 'LOW',
        blockReason: '包含创建，误判为写操作',
      },
      {
        questionText: '有多少客户是没有报备商机的，分别创建了多长时间',
      },
    );

    expect(intent.requestedAction).toBe('READONLY_ANALYSIS');
    expect(intent.blockReason).toBe('');
    expect(intent.confidence).toBe('MEDIUM');
    expect(intent.missingConditions).not.toContain('时间范围');
  });

  it('低置信时间槽不得变成可执行时间过滤条件', () => {
    const intent = analysisIntentPack.normalize(
      {
        domain: 'opportunity-analysis',
        metrics: ['新增商机金额'],
        dimensions: ['月份'],
        missingConditions: [],
        normalizedQuestion: '从那段时间开始看一下商机情况',
        temporalSlot: {
          rawText: '那段时间',
          normalizedLabel: '未确定时间范围',
          timezone: 'Asia/Shanghai',
          granularity: 'custom',
          relativity: 'mixed',
          inclusivity: { start: 'inclusive', end: 'exclusive' },
          confidence: 'LOW',
          unresolvedReason: '上下文无法确定“那段时间”的起止边界',
        },
        resultIntent: 'trend',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'MEDIUM',
        blockReason: '',
      },
      {
        questionText: '从那段时间开始看一下商机情况',
      },
    );

    expect(intent.filters).toEqual({});
    expect(intent.missingConditions).toContain('时间范围');
    expect(intent.temporalSlot?.unresolvedReason).toContain('无法确定');
  });

  it('AI 已识别相对时间但缺少边界时，应基于当前时间基准补齐最近一年的可执行边界', () => {
    const intent = analysisIntentPack.normalize(
      {
        domain: 'opportunity-analysis',
        metrics: ['新增商机金额'],
        dimensions: ['销售负责人'],
        missingConditions: [],
        normalizedQuestion: '最近一年各销售负责人新增商机金额排名',
        temporalSlot: {
          rawText: '最近一年',
          normalizedLabel: '最近一年',
          timezone: 'Asia/Shanghai',
          granularity: 'year',
          relativity: 'relative',
          inclusivity: { start: 'inclusive', end: 'inclusive' },
          confidence: 'LOW',
          unresolvedReason: '相对时间需要结合当前日期计算',
        },
        resultIntent: 'ranking',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'HIGH',
        blockReason: '',
      },
      {
        questionText: '最近一年各销售负责人新增商机金额排名',
        referenceNowIso: '2026-04-24T01:37:43.746Z',
        timezone: 'Asia/Shanghai',
      },
    );

    expect(intent.filters).toEqual({
      timeRange: '最近一年',
      startAt: '2025-03-31T16:00:00.000Z',
      endAt: '2026-04-30T16:00:00.000Z',
    });
    expect(intent.temporalSlot).toEqual(
      expect.objectContaining({
        rawText: '最近一年',
        startAt: '2025-03-31T16:00:00.000Z',
        endAt: '2026-04-30T16:00:00.000Z',
        confidence: 'HIGH',
      }),
    );
    expect(intent.missingConditions).not.toContain('时间范围');
  });

  it('应保留负责人经营主题档案、报告深度和分析侧重点', () => {
    const intent = analysisIntentPack.normalize(
      {
        domain: 'opportunity-analysis',
        metrics: ['新增商机金额'],
        dimensions: ['销售负责人'],
        missingConditions: [],
        normalizedQuestion: '最近一年各销售负责人新增商机金额排名，请做详细分析总结',
        temporalSlot: {
          rawText: '最近一年',
          normalizedLabel: '最近一年',
          startAt: '2025-03-31T16:00:00.000Z',
          endAt: '2026-04-30T16:00:00.000Z',
          timezone: 'Asia/Shanghai',
          granularity: 'year',
          relativity: 'relative',
          inclusivity: { start: 'inclusive', end: 'exclusive' },
          confidence: 'HIGH',
        },
        resultIntent: 'ranking',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'HIGH',
        blockReason: '',
        analysisFacetProfile: 'owner-performance-ranking',
        analysisDepth: 'deep-dive',
        analysisFocus: ['trend', 'risk', 'customer-contribution'],
      } as never,
      {
        questionText: '最近一年各销售负责人新增商机金额排名，请做详细分析总结',
        referenceNowIso: '2026-04-24T01:37:43.746Z',
        timezone: 'Asia/Shanghai',
      },
    );

    expect(intent.analysisFacetProfile).toBe('owner-performance-ranking');
    expect(intent.analysisDepth).toBe('deep-dive');
    expect(intent.analysisFocus).toEqual(
      expect.arrayContaining(['trend', 'risk', 'customer-contribution']),
    );
  });

  it('AI 未显式返回主题字段时，仍应从高风险问法归一为商机风险主题', () => {
    const intent = analysisIntentPack.normalize(
      {
        domain: 'opportunity-analysis',
        metrics: ['商机数量'],
        dimensions: ['销售负责人'],
        missingConditions: [],
        normalizedQuestion: '最近三个月有哪些高风险商机',
        temporalSlot: {
          rawText: '最近三个月',
          normalizedLabel: '最近三个月',
          startAt: '2026-01-31T16:00:00.000Z',
          endAt: '2026-04-30T16:00:00.000Z',
          timezone: 'Asia/Shanghai',
          granularity: 'month',
          relativity: 'relative',
          inclusivity: { start: 'inclusive', end: 'exclusive' },
          confidence: 'HIGH',
        },
        resultIntent: 'detail',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'HIGH',
        blockReason: '',
      },
      {
        questionText: '最近三个月有哪些高风险商机',
        referenceNowIso: '2026-04-24T01:37:43.746Z',
        timezone: 'Asia/Shanghai',
      },
    );

    expect(intent.analysisFacetProfile).toBe('opportunity-risk');
    expect(intent.analysisDepth).toBe('standard');
    expect(intent.analysisFocus).toEqual(expect.arrayContaining(['risk']));
  });

  it('应把独立“赢单”排行纠偏为合同签单口径，而不是赢单率商机排行', () => {
    const intent = analysisIntentPack.normalize(
      {
        domain: 'opportunity-analysis',
        metrics: ['赢单率'],
        dimensions: ['销售负责人'],
        missingConditions: [],
        normalizedQuestion: '昨天销售赢单排名',
        temporalSlot: {
          rawText: '昨天',
          normalizedLabel: '昨天',
          startAt: '2026-05-26T16:00:00.000Z',
          endAt: '2026-05-27T16:00:00.000Z',
          timezone: 'Asia/Shanghai',
          granularity: 'day',
          relativity: 'relative',
          inclusivity: { start: 'inclusive', end: 'exclusive' },
          confidence: 'HIGH',
        },
        resultIntent: 'ranking',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'HIGH',
        blockReason: '',
      },
      {
        questionText: '昨天销售赢单排名',
        referenceNowIso: '2026-05-28T07:15:00.000Z',
        timezone: 'Asia/Shanghai',
      },
    );

    expect(intent.domain).toBe('contract-conversion');
    expect(intent.metrics).toEqual(['转合同金额']);
    expect(intent.queryEntities).toEqual(expect.arrayContaining(['合同', '销售负责人']));
    expect(intent.resultKindHint).toBe('owner-ranking');
  });

  it('应把“昨天”的包容式日末边界归一为次日零点排他边界', () => {
    const intent = analysisIntentPack.normalize(
      {
        domain: 'contract-conversion',
        metrics: ['转合同金额'],
        dimensions: ['销售负责人'],
        missingConditions: [],
        normalizedQuestion: '昨天销售签单排名',
        temporalSlot: {
          rawText: '昨天',
          normalizedLabel: '昨天',
          startAt: '2026-05-27T00:00:00+08:00',
          endAt: '2026-05-27T23:59:59+08:00',
          timezone: 'Asia/Shanghai',
          granularity: 'day',
          relativity: 'relative',
          inclusivity: { start: 'inclusive', end: 'inclusive' },
          confidence: 'HIGH',
        },
        resultIntent: 'ranking',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'HIGH',
        blockReason: '',
      },
      {
        questionText: '昨天销售签单排名',
        referenceNowIso: '2026-05-28T07:15:00.000Z',
        timezone: 'Asia/Shanghai',
      },
    );

    expect(intent.filters).toMatchObject({
      startAt: '2026-05-27T00:00:00+08:00',
      endAt: '2026-05-28T00:00:00+08:00',
    });
    expect(intent.temporalSlot).toEqual(
      expect.objectContaining({
        endAt: '2026-05-28T00:00:00+08:00',
        inclusivity: { start: 'inclusive', end: 'exclusive' },
      }),
    );
  });

  it('应在规范化阶段把渠道下单问题纠偏为订单渠道贡献意图', () => {
    const intent = analysisIntentPack.normalize(
      {
        domain: 'opportunity-analysis',
        metrics: ['商机数量'],
        dimensions: ['区域'],
        missingConditions: [],
        normalizedQuestion:
          '最近三个月山东区域，有下单的服务商，对应的订单数量、订单金额以及总金额，生成汇总分析报告',
        temporalSlot: {
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
        resultIntent: 'summary',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'HIGH',
        blockReason: '',
      },
      {
        questionText:
          '最近三个月山东区域，有下单的服务商，对应的订单数量、订单金额以及总金额，生成汇总分析报告',
        referenceNowIso: '2026-06-08T02:00:00.000Z',
        timezone: 'Asia/Shanghai',
      },
    );

    expect(intent.domain).toBe('contract-conversion');
    expect(intent.metrics).toEqual(['转合同金额']);
    expect(intent.dimensions).toEqual(expect.arrayContaining(['区域', '渠道商', '月份']));
    expect(intent.queryEntities).toEqual(expect.arrayContaining(['订单', '渠道商']));
    expect(intent.resultKindHint).toBe('partner-contribution');
  });

  it('追问改时间范围不应被归类为写操作阻断', () => {
    const intent = analysisIntentPack.normalize(
      {
        domain: 'opportunity-analysis',
        metrics: ['新增商机金额'],
        dimensions: ['月份'],
        missingConditions: [],
        normalizedQuestion: '本月各销售负责人新增商机金额排名；继续分析：请把实际改成一月份',
        temporalSlot: {
          rawText: '一月份',
          normalizedLabel: '2026年1月',
          startAt: '2025-12-31T16:00:00.000Z',
          endAt: '2026-01-31T16:00:00.000Z',
          timezone: 'Asia/Shanghai',
          granularity: 'month',
          relativity: 'absolute',
          inclusivity: { start: 'inclusive', end: 'exclusive' },
          confidence: 'HIGH',
        },
        resultIntent: 'trend',
        requestedAction: 'BLOCK',
        confidence: 'LOW',
        blockReason: '用户问题包含“改”操作，属于写操作/修改操作，不符合只读分析范围，予以阻断',
      },
      {
        questionText: '本月各销售负责人新增商机金额排名；继续分析：请把实际改成一月份',
        referenceNowIso: '2026-05-29T03:37:08.553Z',
        timezone: 'Asia/Shanghai',
      },
    );

    expect(intent.requestedAction).toBe('READONLY_ANALYSIS');
    expect(intent.blockReason).toBe('');
    expect(intent.temporalSlot).toEqual(
      expect.objectContaining({
        rawText: '一月份',
        normalizedLabel: '2026年1月',
      }),
    );
  });
});

import { BusinessAnalysisIntentMapperService } from '../../../src/modules/analysis/business-analysis-intent-mapper.service';
import type { BusinessAnalysisIntent } from '../../../src/modules/analysis/business-analysis-intent.types';
import { LianruanCrmFieldCapabilityRegistry } from '../../../src/modules/crm-standard-api/lianruan-crm-field-capability.registry';

describe('BusinessAnalysisIntentMapperService', () => {
  const service = new BusinessAnalysisIntentMapperService(
    new LianruanCrmFieldCapabilityRegistry(),
  );

  afterEach(() => {
    jest.useRealTimers();
  });

  it('应把渠道下单宽意图映射为订单渠道贡献分析', () => {
    const result = service.mapToAnalysisIntent(
      '最近三个月山东区域，有下单的服务商，对应订单数量、订单金额和总金额',
      {
        objectTypes: ['order', 'partner'],
        metrics: ['order_count', 'order_amount', 'total_amount'],
        dimensions: ['region', 'partner', 'month'],
        filters: [{ field: 'region', operator: 'contains', value: '山东', label: '山东区域' }],
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
      },
    );

    expect(result.sourceResource).toBe('orders');
    expect(result.unsupportedHints).toEqual([]);
    expect(result.intent).toMatchObject({
      domain: 'contract-conversion',
      metrics: ['转合同金额'],
      dimensions: expect.arrayContaining(['区域', '渠道商', '月份']),
      resultKindHint: 'partner-contribution',
      analysisDepth: 'deep-dive',
      requestedAction: 'READONLY_ANALYSIS',
    });
  });

  it('应把服务商画像宽意图映射为服务商资料分析', () => {
    const result = service.mapToAnalysisIntent(
      '最近一年加入的服务商有多少家，按合作等级和是否技术服务商分布',
      {
        objectTypes: ['partner'],
        metrics: ['partner_count', 'technical_partner_count'],
        dimensions: ['partner_level', 'is_technical_service_provider'],
        filters: [],
        timeRange: {
          rawText: '最近一年',
          normalizedLabel: '最近一年',
          startAt: '2025-06-01T00:00:00+08:00',
          endAt: '2026-06-01T00:00:00+08:00',
          timezone: 'Asia/Shanghai',
          granularity: 'year',
          relativity: 'relative',
          inclusivity: { start: 'inclusive', end: 'exclusive' },
          confidence: 'HIGH',
        },
        analysisMode: 'distribution',
        outputPreference: ['text_summary', 'table'],
        comparison: [],
        entities: [{ type: 'partner', value: '服务商' }],
        confidence: 'HIGH',
        missingConditions: [],
        unsupportedHints: [],
        requestedAction: 'READONLY_ANALYSIS',
        blockReason: '',
        normalizedQuestion: '最近一年加入的服务商有多少家，按合作等级和是否技术服务商分布',
      },
    );

    expect(result.sourceResource).toBe('partners');
    expect(result.unsupportedHints).toEqual([]);
    expect(result.intent).toMatchObject({
      domain: 'customer-relationship',
      dimensions: expect.arrayContaining(['渠道商', '客户分类']),
      resultKindHint: 'partner-contribution',
    });
  });

  it('服务商发展运营宽意图应映射为经营链分析而不是单纯服务商画像', () => {
    const result = service.mapToAnalysisIntent(
      '全国代理商发展运营数据看板',
      {
        objectTypes: ['partner', 'registration', 'opportunity', 'order'],
        metrics: [
          'partner_count',
          'registration_count',
          'opportunity_count',
          'opportunity_amount',
          'order_count',
          'order_amount',
        ],
        dimensions: ['big_region', 'region', 'partner', 'partner_level', 'is_technical_service_provider', 'stage', 'status'],
        filters: [],
        analysisMode: 'dashboard',
        outputPreference: ['text_summary', 'table', 'chart', 'html_report'],
        comparison: [],
        entities: [{ type: 'partner', value: '代理商' }],
        confidence: 'HIGH',
        missingConditions: [],
        unsupportedHints: [],
        requestedAction: 'READONLY_ANALYSIS',
        blockReason: '',
        normalizedQuestion: '全国代理商发展运营数据看板',
      },
    );

    expect(result.sourceResource).toBe('orders');
    expect(result.unsupportedHints).toEqual([]);
    expect(result.intent).toMatchObject({
      domain: 'contract-conversion',
      resultKindHint: 'partner-contribution',
      analysisDepth: 'deep-dive',
      requestedAction: 'READONLY_ANALYSIS',
    });
    expect(result.intent.dimensions).toEqual(
      expect.arrayContaining(['区域', '渠道商', '商机阶段', '客户分类']),
    );
  });

  it('报价未下单问法应保留报价和订单业务对象', () => {
    const result = service.mapToAnalysisIntent(
      '报价情况，特别是有报价但未下单的客户',
      {
        objectTypes: ['quote', 'order', 'customer', 'partner'],
        metrics: ['quote_count', 'quote_amount', 'order_count', 'conversion_rate'],
        dimensions: ['partner', 'status', 'customer'],
        filters: [],
        analysisMode: 'risk_analysis',
        outputPreference: ['text_summary', 'table'],
        comparison: [],
        entities: [{ type: 'keyword', value: '报价未下单' }],
        confidence: 'HIGH',
        missingConditions: [],
        unsupportedHints: [],
        requestedAction: 'READONLY_ANALYSIS',
        blockReason: '',
        normalizedQuestion: '报价情况，特别是有报价但未下单的客户',
      },
    );

    expect(result.sourceResource).toBe('orders');
    expect(result.unsupportedHints).toEqual([]);
    expect(result.intent.businessIntentHint).toMatchObject({
      objectTypes: ['quote', 'order', 'customer', 'partner'],
      sourceResource: 'orders',
    });
    expect(result.intent.requestedAction).toBe('READONLY_ANALYSIS');
  });

  it('字段能力表未声明时应阻断而不是编造字段', () => {
    const unsupportedIntent: BusinessAnalysisIntent = {
      objectTypes: ['order'],
      metrics: ['order_amount'],
      dimensions: ['customer_category'],
      filters: [],
      analysisMode: 'distribution',
      outputPreference: ['text_summary'],
      comparison: [],
      entities: [],
      confidence: 'HIGH',
      missingConditions: [],
      unsupportedHints: [],
      requestedAction: 'READONLY_ANALYSIS',
      blockReason: '',
      normalizedQuestion: '按客户分类统计订单金额',
    };

    const result = service.mapToAnalysisIntent(
      '按客户分类统计订单金额',
      unsupportedIntent,
    );

    expect(result.intent.requestedAction).toBe('BLOCK');
    expect(result.unsupportedHints).toEqual([
      expect.objectContaining({
        resource: 'orders',
        label: '客户分类',
      }),
    ]);
    expect(result.intent.blockReason).toContain('字段能力暂不支持');
  });

  it('客户未报备商机和创建时长问题应映射到客户主数据分析', () => {
    const result = service.mapToAnalysisIntent(
      '有多少客户是没有报备商机的，分别创建了多长时间',
      {
        objectTypes: ['customer', 'registration', 'opportunity'],
        metrics: ['unlinked_customer_count', 'customer_age_days'],
        dimensions: ['customer_age_bucket'],
        filters: [],
        analysisMode: 'distribution',
        outputPreference: ['text_summary', 'table'],
        comparison: [],
        entities: [{ type: 'customer', value: '客户' }],
        confidence: 'HIGH',
        missingConditions: [],
        unsupportedHints: [],
        requestedAction: 'READONLY_ANALYSIS',
        blockReason: '',
        normalizedQuestion: '有多少客户是没有报备商机的，分别创建了多长时间',
      },
    );

    expect(result.sourceResource).toBe('customers');
    expect(result.unsupportedHints).toEqual([]);
    expect(result.intent).toMatchObject({
      domain: 'customer-relationship',
      requestedAction: 'READONLY_ANALYSIS',
      resultKindHint: 'category-distribution',
      dimensions: expect.arrayContaining(['客户分类']),
    });
  });

  it('超两周未更新商机应映射为商机风险分析且不提示字段缺失', () => {
    const result = service.mapToAnalysisIntent(
      '本区域超两周未更新的商机有哪些',
      {
        objectTypes: ['opportunity'],
        metrics: ['stale_opportunity_count'],
        dimensions: ['region', 'owner', 'partner', 'stage'],
        filters: [{ field: 'region', operator: 'contains', value: '本区域', label: '本区域' }],
        analysisMode: 'risk_analysis',
        outputPreference: ['text_summary', 'table'],
        comparison: [],
        entities: [{ type: 'region', value: '本区域' }],
        confidence: 'HIGH',
        missingConditions: [],
        unsupportedHints: [],
        requestedAction: 'READONLY_ANALYSIS',
        blockReason: '',
        normalizedQuestion: '本区域超两周未更新的商机有哪些',
      },
    );

    expect(result.sourceResource).toBe('opportunities');
    expect(result.unsupportedHints).toEqual([]);
    expect(result.intent).toMatchObject({
      domain: 'opportunity-analysis',
      resultKindHint: 'risk-overview',
      requestedAction: 'READONLY_ANALYSIS',
    });
    expect(result.intent.dimensions).toEqual(
      expect.arrayContaining(['区域', '销售负责人', '渠道商', '商机阶段']),
    );
  });

  it('报备到订单转化漏斗应优先选择订单主资源并保留漏斗结果意图', () => {
    const result = service.mapToAnalysisIntent(
      '报备到订单整体转化率是多少',
      {
        objectTypes: ['registration', 'opportunity', 'quote', 'order'],
        metrics: ['registration_count', 'opportunity_count', 'quote_count', 'order_count', 'conversion_rate'],
        dimensions: ['region'],
        filters: [],
        analysisMode: 'summary_report',
        outputPreference: ['text_summary', 'table', 'chart'],
        comparison: ['funnel'],
        entities: [{ type: 'keyword', value: '报备到订单' }],
        confidence: 'HIGH',
        missingConditions: [],
        unsupportedHints: [],
        requestedAction: 'READONLY_ANALYSIS',
        blockReason: '',
        normalizedQuestion: '报备到订单整体转化率是多少',
      },
    );

    expect(result.sourceResource).toBe('orders');
    expect(result.unsupportedHints).toEqual([]);
    expect(result.intent.requestedAction).toBe('READONLY_ANALYSIS');
    expect(result.intent.analysisDepth).toBe('deep-dive');
  });

  it('宽业务意图漏掉时间槽但原文包含最近一年时应补齐时间并清除缺项', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-10T12:00:00.000Z'));
    const result = service.mapToAnalysisIntent(
      '帮我分析一下最近一年全国的订单情况、商机情况。',
      {
        objectTypes: ['order', 'opportunity'],
        metrics: ['order_count', 'order_amount', 'opportunity_count', 'opportunity_amount'],
        dimensions: ['region', 'month'],
        filters: [],
        analysisMode: 'summary_report',
        outputPreference: ['text_summary', 'table', 'chart'],
        comparison: [],
        entities: [{ type: 'region', value: '全国' }],
        confidence: 'HIGH',
        missingConditions: ['时间范围'],
        unsupportedHints: [],
        requestedAction: 'READONLY_ANALYSIS',
        blockReason: '',
        normalizedQuestion: '帮我分析一下最近一年全国的订单情况、商机情况。',
      },
    );

    expect(result.intent.missingConditions).not.toContain('时间范围');
    expect(result.intent.filters).toMatchObject({
      timeRange: '最近一年',
      startAt: '2025-05-31T16:00:00.000Z',
    });
    expect(result.intent.temporalSlot).toEqual(
      expect.objectContaining({
        rawText: '最近一年',
        normalizedLabel: '最近一年',
        timezone: 'Asia/Shanghai',
        granularity: 'month',
      }),
    );
  });

  it('默认主题缺少维度时应补齐渠道商业务维度', () => {
    const opportunityResult = service.mapToAnalysisIntent(
      '帮我分析一下全部的商机情况',
      {
        objectTypes: ['opportunity'],
        metrics: ['opportunity_count', 'opportunity_amount'],
        dimensions: [],
        filters: [],
        analysisMode: 'summary_report',
        outputPreference: ['text_summary', 'table'],
        comparison: [],
        entities: [],
        confidence: 'HIGH',
        missingConditions: [],
        unsupportedHints: [],
        requestedAction: 'READONLY_ANALYSIS',
        blockReason: '',
        normalizedQuestion: '帮我分析一下全部的商机情况',
      },
    );
    const orderResult = service.mapToAnalysisIntent(
      '帮我分析一下订单情况',
      {
        objectTypes: ['order'],
        metrics: ['order_count', 'order_amount'],
        dimensions: [],
        filters: [],
        analysisMode: 'summary_report',
        outputPreference: ['text_summary', 'table'],
        comparison: [],
        entities: [],
        confidence: 'HIGH',
        missingConditions: [],
        unsupportedHints: [],
        requestedAction: 'READONLY_ANALYSIS',
        blockReason: '',
        normalizedQuestion: '帮我分析一下订单情况',
      },
    );
    const registrationResult = service.mapToAnalysisIntent(
      '帮我分析一下客户报备情况',
      {
        objectTypes: ['registration'],
        metrics: ['registration_count'],
        dimensions: [],
        filters: [],
        analysisMode: 'summary_report',
        outputPreference: ['text_summary', 'table'],
        comparison: [],
        entities: [],
        confidence: 'HIGH',
        missingConditions: [],
        unsupportedHints: [],
        requestedAction: 'READONLY_ANALYSIS',
        blockReason: '',
        normalizedQuestion: '帮我分析一下客户报备情况',
      },
    );

    expect(opportunityResult.intent).toMatchObject({
      domain: 'opportunity-analysis',
      dimensions: expect.arrayContaining(['渠道商', '商机阶段']),
      resultKindHint: 'partner-contribution',
    });
    expect(orderResult.intent).toMatchObject({
      domain: 'contract-conversion',
      dimensions: expect.arrayContaining(['渠道商']),
      resultKindHint: 'partner-contribution',
    });
    expect(registrationResult.intent).toMatchObject({
      domain: 'customer-relationship',
      dimensions: expect.arrayContaining(['渠道商', '客户分类']),
      resultKindHint: 'category-distribution',
    });
  });
});

import { businessAnalysisIntentPack } from '../../../src/modules/analysis/capability-packs/packs/business-analysis-intent.pack';

describe('businessAnalysisIntentPack', () => {
  it('宽业务意图请求应强约束模型只返回 JSON 并覆盖复合经营问题正例', () => {
    const structuredRequest = businessAnalysisIntentPack.buildStructuredRequest({
      questionText:
        '帮我查询分析下，公司当前的合作伙伴开拓情况、客户商机报备及订单情况，并且给出后续经营建议',
    }, {});

    expect(structuredRequest.system).toContain('第一个非空字符必须是 {');
    expect(structuredRequest.system).toContain('不得把 reasoning/thinking 内容作为最终消息正文返回');
    expect(structuredRequest.prompt).toContain('合作伙伴开拓情况、客户商机报备及订单情况');
    expect(structuredRequest.prompt).toContain('objectTypes=[partner,registration,opportunity,order]');
    expect(structuredRequest.prompt).toContain('requestedAction=READONLY_ANALYSIS');
    expect(structuredRequest.prompt).toContain('全国代理商发展运营数据看板');
    expect(structuredRequest.prompt).toContain('报价情况，特别是有报价但未下单的客户');
    expect(structuredRequest.prompt).toContain('不要因为用户来自企业微信就输出 wecom_image');
    expect(structuredRequest.outputSchema.required as string[]).not.toContain('blockReason');
  });

  it('非阻断宽业务意图省略 blockReason 时应归一化为空字符串', () => {
    const intent = businessAnalysisIntentPack.normalize(
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
        dimensions: ['partner', 'stage', 'status'],
        filters: [],
        analysisMode: 'summary_report',
        outputPreference: ['text_summary', 'table'],
        comparison: [],
        entities: [],
        confidence: 'HIGH',
        missingConditions: [],
        unsupportedHints: [],
        requestedAction: 'READONLY_ANALYSIS',
        normalizedQuestion:
          '帮我查询分析下，公司当前的合作伙伴开拓情况、客户商机报备及订单情况，并且给出后续经营建议',
      },
      {
        questionText:
          '帮我查询分析下，公司当前的合作伙伴开拓情况、客户商机报备及订单情况，并且给出后续经营建议',
      },
    );

    expect(intent.requestedAction).toBe('READONLY_ANALYSIS');
    expect(intent.blockReason).toBe('');
    expect(intent.missingConditions).toEqual([]);
  });

  it('应兼容模型把全部明细 limit 输出为 all，并归一化排序字段', () => {
    const structuredRequest = businessAnalysisIntentPack.buildStructuredRequest({
      questionText: '帮我分析一下商机的进展',
    }, {});
    expect(JSON.stringify(structuredRequest.outputSchema)).toContain('"all"');

    const intent = businessAnalysisIntentPack.normalize(
      {
        objectTypes: ['opportunity'],
        metrics: ['opportunity_count', 'opportunity_amount'],
        dimensions: ['stage', 'month'],
        filters: [],
        analysisMode: 'trend',
        outputPreference: ['text_summary', 'table', 'chart'],
        comparison: [],
        sort: { field: 'amount', direction: 'desc' },
        limit: 'all',
        entities: [],
        confidence: 'MEDIUM',
        missingConditions: [],
        unsupportedHints: [],
        requestedAction: 'READONLY_ANALYSIS',
        blockReason: '',
        normalizedQuestion: '帮我分析一下商机的进展',
      },
      {
        questionText: '帮我分析一下商机的进展',
      },
    );

    expect(intent.limit).toBeUndefined();
    expect(intent.sort).toEqual({ by: 'amount', direction: 'DESC' });
    expect(intent.dimensions).toEqual(['stage', 'month']);
  });

  it('用户未限定时间时应默认当前权限全量范围，不要求补充时间', () => {
    const intent = businessAnalysisIntentPack.normalize(
      {
        objectTypes: ['customer', 'registration', 'opportunity'],
        metrics: ['count'],
        dimensions: ['customer'],
        filters: [],
        analysisMode: 'single_metric',
        outputPreference: ['text_summary', 'table'],
        comparison: [],
        entities: [],
        confidence: 'MEDIUM',
        missingConditions: ['时间范围'],
        unsupportedHints: [],
        requestedAction: 'READONLY_ANALYSIS',
        blockReason: '',
        normalizedQuestion: '有多少客户是没有报备商机的',
      },
      {
        questionText: '有多少客户是没有报备商机的',
      },
    );

    expect(intent.timeRange).toBeUndefined();
    expect(intent.missingConditions).not.toContain('时间范围');
    expect(intent.requestedAction).toBe('READONLY_ANALYSIS');
  });

  it('应移除默认可执行的缺口说明，避免商机进展问法被误追问', () => {
    const intent = businessAnalysisIntentPack.normalize(
      {
        objectTypes: ['opportunity'],
        metrics: ['opportunity_count', 'opportunity_amount', 'stale_opportunity_count'],
        dimensions: ['stage', 'owner', 'partner', 'region'],
        filters: [],
        analysisMode: 'summary_report',
        outputPreference: ['text_summary', 'table'],
        comparison: [],
        entities: [{ type: 'opportunity', value: '商机' }],
        confidence: 'MEDIUM',
        missingConditions: [
          '未指定商机进展的具体衡量指标，默认提供商机数量、金额及停滞商机数量',
          '未指定时间范围，将展示全量商机数据',
          '未指定分析维度，默认按阶段、负责人、合作伙伴、区域展示',
        ],
        unsupportedHints: [],
        requestedAction: 'READONLY_ANALYSIS',
        blockReason: '',
        normalizedQuestion: '帮我分析一下商机的进展',
      },
      {
        questionText: '帮我分析一下商机的进展',
      },
    );

    expect(intent.missingConditions).toEqual([]);
    expect(intent.analysisMode).toBe('summary_report');
    expect(intent.requestedAction).toBe('READONLY_ANALYSIS');
  });

  it('当前经营现状不应被误认为必须补充时间范围', () => {
    const intent = businessAnalysisIntentPack.normalize(
      {
        objectTypes: ['partner', 'opportunity', 'order'],
        metrics: ['partner_count', 'opportunity_count', 'order_count', 'order_amount'],
        dimensions: ['partner', 'stage'],
        filters: [],
        analysisMode: 'summary_report',
        outputPreference: ['text_summary', 'table'],
        comparison: [],
        entities: [],
        confidence: 'MEDIUM',
        missingConditions: ['未指定时间范围，将展示全量经营数据'],
        unsupportedHints: [],
        requestedAction: 'READONLY_ANALYSIS',
        blockReason: '',
        normalizedQuestion: '公司当前的合作伙伴开拓情况、客户商机报备及订单情况',
      },
      {
        questionText: '公司当前的合作伙伴开拓情况、客户商机报备及订单情况',
      },
    );

    expect(intent.missingConditions).not.toContain('时间范围');
  });

  it('用户明确给了时间但缺少可执行边界时仍应提示补充时间', () => {
    const intent = businessAnalysisIntentPack.normalize(
      {
        objectTypes: ['opportunity'],
        metrics: ['opportunity_amount'],
        dimensions: ['month'],
        filters: [],
        analysisMode: 'trend',
        outputPreference: ['text_summary', 'table'],
        comparison: [],
        entities: [],
        confidence: 'MEDIUM',
        missingConditions: [],
        unsupportedHints: [],
        requestedAction: 'READONLY_ANALYSIS',
        blockReason: '',
        normalizedQuestion: '最近一段时间商机金额趋势',
      },
      {
        questionText: '最近一段时间商机金额趋势',
      },
    );

    expect(intent.timeRange).toBeUndefined();
    expect(intent.missingConditions).toContain('时间范围');
  });

  it('应保留客户未报备商机和创建时长的宽业务意图', () => {
    const intent = businessAnalysisIntentPack.normalize(
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
      {
        questionText: '有多少客户是没有报备商机的，分别创建了多长时间',
      },
    );

    expect(intent.objectTypes).toEqual(['customer', 'registration', 'opportunity']);
    expect(intent.metrics).toEqual(['unlinked_customer_count', 'customer_age_days']);
    expect(intent.dimensions).toEqual(['customer_age_bucket']);
    expect(intent.missingConditions).toEqual([]);
  });

  it('应保留联软 P3 风险和活跃度指标枚举', () => {
    const intent = businessAnalysisIntentPack.normalize(
      {
        objectTypes: ['opportunity', 'customer'],
        metrics: ['stale_opportunity_count', 'inactive_customer_count'],
        dimensions: ['region', 'owner', 'stage'],
        filters: [],
        analysisMode: 'risk_analysis',
        outputPreference: ['text_summary', 'table'],
        comparison: [],
        entities: [],
        confidence: 'HIGH',
        missingConditions: [],
        unsupportedHints: [],
        requestedAction: 'READONLY_ANALYSIS',
        blockReason: '',
        normalizedQuestion: '本区域超两周未更新的商机和最近30天未活跃客户有哪些',
      },
      {
        questionText: '本区域超两周未更新的商机和最近30天未活跃客户有哪些',
      },
    );

    expect(intent.metrics).toEqual(['stale_opportunity_count', 'inactive_customer_count']);
    expect(intent.dimensions).toEqual(['region', 'owner', 'stage']);
    expect(intent.analysisMode).toBe('risk_analysis');
  });

  it('模型漏掉显式信号时应按用户原文补齐结构化意图槽', () => {
    const intent = businessAnalysisIntentPack.normalize(
      {
        objectTypes: [],
        metrics: [],
        dimensions: [],
        filters: [],
        analysisMode: 'single_metric',
        outputPreference: [],
        comparison: [],
        entities: [],
        confidence: 'MEDIUM',
        missingConditions: [
          '未指定指标',
          '未指定维度',
        ],
        unsupportedHints: [],
        requestedAction: 'READONLY_ANALYSIS',
        blockReason: '',
        normalizedQuestion: '帮我分析一下业务情况',
      },
      {
        questionText: '帮我分析商机情况，再加趋势和阶段分布，用表格和图表呈现',
      },
    );

    expect(intent.objectTypes).toEqual(['opportunity']);
    expect(intent.metrics).toEqual(['opportunity_count', 'opportunity_amount']);
    expect(intent.dimensions).toEqual(['month', 'stage']);
    expect(intent.analysisMode).toBe('trend');
    expect(intent.outputPreference).toEqual(['chart', 'table', 'text_summary']);
    expect(intent.missingConditions).toEqual([]);
  });
});

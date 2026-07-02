import { AnalysisQueryPlannerService } from '../../../src/modules/analysis/analysis-query-planner.service';
import { AnalysisReadToolRegistryService } from '../../../src/modules/analysis/analysis-read-tool.registry';
import { QueryCompilerService } from '../../../src/modules/analysis/query-compiler.service';

describe('AnalysisQueryPlannerService', () => {
  const service = new AnalysisQueryPlannerService(new QueryCompilerService());
  const compiler = new QueryCompilerService();
  const registry = new AnalysisReadToolRegistryService();

  it('主结果已经是趋势时不应重复追加同口径趋势任务', () => {
    const temporalSlot = {
      rawText: '前三个月',
      normalizedLabel: '前三个月',
      startAt: '2026-01-31T16:00:00.000Z',
      endAt: '2026-04-30T16:00:00.000Z',
      timezone: 'Asia/Shanghai' as const,
      granularity: 'month' as const,
      relativity: 'relative' as const,
      inclusivity: { start: 'inclusive' as const, end: 'exclusive' as const },
      confidence: 'HIGH' as const,
    };
    const workflow = service.buildWorkflow(
      '请分析一下前三个月的商机情况',
      {
        domain: 'opportunity-analysis',
        metrics: ['新增商机金额'],
        dimensions: ['月份'],
        filters: {
          timeRange: '前三个月',
          startAt: '2026-01-31T16:00:00.000Z',
          endAt: '2026-04-30T16:00:00.000Z',
        },
        temporalSlot,
        missingConditions: [],
        normalizedQuestion: '请分析一下前三个月的商机情况',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'HIGH',
        blockReason: '',
        orderBy: [{ field: 'bucket_label', direction: 'ASC' }],
        resultKindHint: 'time-trend',
      },
      'web-console',
    );

    expect(workflow.tasks).toHaveLength(1);
    expect(workflow.temporalSlot).toEqual(temporalSlot);
    expect(workflow.tasks[0]?.plan.temporalSlot).toEqual(temporalSlot);
    expect(workflow.tasks[0]?.title).toBe('新增商机金额趋势分析');
    expect(workflow.tasks[0]?.purpose).toBe('primary-summary');
  });

  it('负责人经营标准报告应按主题档案生成 5 个受控任务，并区分必选与可选任务', () => {
    const temporalSlot = {
      rawText: '最近一年',
      normalizedLabel: '最近一年',
      startAt: '2025-03-31T16:00:00.000Z',
      endAt: '2026-04-30T16:00:00.000Z',
      timezone: 'Asia/Shanghai' as const,
      granularity: 'year' as const,
      relativity: 'relative' as const,
      inclusivity: { start: 'inclusive' as const, end: 'exclusive' as const },
      confidence: 'HIGH' as const,
    };
    const workflow = service.buildWorkflow(
      '最近一年各销售负责人新增商机金额排名，请做详细分析总结',
      {
        domain: 'opportunity-analysis',
        metrics: ['新增商机金额'],
        dimensions: ['销售负责人'],
        filters: {
          timeRange: '最近一年',
          startAt: '2025-03-31T16:00:00.000Z',
          endAt: '2026-04-30T16:00:00.000Z',
        },
        temporalSlot,
        missingConditions: [],
        normalizedQuestion: '最近一年各销售负责人新增商机金额排名，请做详细分析总结',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'HIGH',
        blockReason: '',
        orderBy: [{ field: 'amount', direction: 'DESC' }],
        resultKindHint: 'owner-ranking',
        resultIntent: 'ranking',
        analysisFacetProfile: 'owner-performance-ranking',
        analysisDepth: 'deep-dive',
        analysisFocus: ['trend', 'risk', 'customer-contribution'],
      } as never,
      'web-console',
    );

    expect(workflow.analysisFacetProfile).toBe('owner-performance-ranking');
    expect(workflow.analysisDepth).toBe('deep-dive');
    expect(workflow.tasks).toHaveLength(5);
    expect(workflow.tasks.map((item) => item.plan.resultKind)).toEqual([
      'owner-ranking',
      'time-trend',
      'stage-distribution',
      'department-contribution',
      'risk-overview',
    ]);
    expect(workflow.tasks[0]?.required).toBe(true);
    expect(workflow.tasks.slice(1).every((item) => item.required === false)).toBe(true);
  });

  it('区域经营贡献查询应联查部门名称，避免结果里直接展示部门 ID', () => {
    const compiled = compiler.compile({
      taskId: 'task_region',
      taskTitle: '区域经营贡献',
      purpose: 'primary-summary',
      domain: 'opportunity-analysis',
      baseTable: 'opportunities',
      resultKind: 'department-contribution',
      groupBy: ['department_id'],
      metrics: ['新增商机金额'],
      filters: {
        organizationIds: ['10804'],
        startAt: '2026-01-01T00:00:00+08:00',
        endAt: '2026-03-01T00:00:00+08:00',
      },
      temporalSlot: {
        rawText: '1-2月份',
        normalizedLabel: '2026年1月至2月',
        startAt: '2026-01-01T00:00:00+08:00',
        endAt: '2026-03-01T00:00:00+08:00',
        timezone: 'Asia/Shanghai',
        granularity: 'month',
        relativity: 'absolute',
        inclusivity: { start: 'inclusive', end: 'exclusive' },
        confidence: 'HIGH',
      },
      orderBy: [{ field: 'amount', direction: 'DESC' }],
    } as never);

    expect(compiled.sql).toContain('LEFT JOIN departments d ON d.id = o.department_id');
    expect(compiled.sql).toContain("COALESCE(d.name, '未命名部门') AS department_name");
    expect(compiled.sql).toContain('GROUP BY o.department_id, d.name');
    expect(compiled.fieldMap).toEqual(
      expect.objectContaining({
        departments: ['id', 'name'],
      }),
    );
    expect(compiled.joinPaths).toEqual(
      expect.arrayContaining(['departments.id=opportunities.department_id']),
    );
  });

  it('服务商商机金额查询应优先生成渠道商贡献任务而不是负责人排名', () => {
    const workflow = service.buildWorkflow(
      '最近三个月山东区域，有商机的服务商，对应商机数量和商机金额',
      {
        domain: 'opportunity-analysis',
        metrics: ['新增商机金额', '商机数量'],
        dimensions: ['渠道商', '区域', '月份'],
        filters: {
          timeRange: '最近三个月',
          startAt: '2026-03-01T00:00:00+08:00',
          endAt: '2026-06-01T00:00:00+08:00',
        },
        missingConditions: [],
        normalizedQuestion: '最近三个月山东区域，有商机的服务商，对应商机数量和商机金额',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'HIGH',
        blockReason: '',
        orderBy: [{ field: 'amount', direction: 'DESC' }],
        resultKindHint: 'partner-contribution',
        resultIntent: 'ranking',
      } as never,
      'wecom-bot',
    );

    expect(workflow.tasks.map((item) => item.plan.resultKind)).toEqual([
      'partner-contribution',
    ]);
    expect(workflow.tasks[0]?.title).toBe('新增商机金额渠道商贡献');
    expect(workflow.tasks[0]?.plan.groupBy).toEqual(['partner_id']);
  });

  it('P0 渠道贡献排行问题应强制生成渠道商贡献任务', () => {
    const workflow = service.buildWorkflow(
      '本月渠道贡献排名前十',
      {
        domain: 'opportunity-analysis',
        metrics: ['新增商机金额'],
        dimensions: ['渠道商'],
        filters: {
          timeRange: '本月',
        },
        missingConditions: [],
        normalizedQuestion: '本月渠道贡献排名前十',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'MEDIUM',
        blockReason: '',
        orderBy: [{ field: 'amount', direction: 'DESC' }],
        resultKindHint: 'owner-ranking',
        resultIntent: 'ranking',
      } as never,
      'wecom-bot',
    );

    expect(workflow.tasks).toHaveLength(1);
    expect(workflow.tasks[0]?.title).toBe('渠道贡献前十排名');
    expect(workflow.tasks[0]?.plan.resultKind).toBe('partner-contribution');
    expect(workflow.tasks[0]?.plan.groupBy).toEqual(['partner_id']);
    expect(workflow.tasks[0]?.plan.filters.rowLimit).toBe(10);
  });

  it('P0 普通漏斗问法应进入报备到订单漏斗任务', () => {
    const workflow = service.buildWorkflow(
      '本月业务漏斗哪里流失最严重？',
      {
        domain: 'opportunity-analysis',
        metrics: ['新增商机金额'],
        dimensions: ['销售负责人'],
        filters: {
          timeRange: '本月',
        },
        missingConditions: [],
        normalizedQuestion: '本月业务漏斗哪里流失最严重？',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'MEDIUM',
        blockReason: '',
        orderBy: [{ field: 'amount', direction: 'DESC' }],
        resultKindHint: 'owner-ranking',
        resultIntent: 'summary',
      } as never,
      'wecom-bot',
    );

    expect(workflow.tasks).toHaveLength(1);
    expect(workflow.tasks[0]?.title).toBe('报备到订单转化漏斗');
    expect(workflow.tasks[0]?.plan.resultKind).toBe('partner-contribution');
    expect(workflow.tasks[0]?.description).toContain('报备、商机、报价和订单');
  });

  it('单一商机整体问题应生成商机总览、阶段分布和渠道商维度，不应扩大成综合经营', () => {
    const workflow = service.buildWorkflow(
      '帮我分析一下最近3个月的商机',
      {
        domain: 'opportunity-analysis',
        metrics: ['新增商机金额'],
        dimensions: [],
        filters: {
          timeRange: '最近3个月',
        },
        missingConditions: [],
        normalizedQuestion: '帮我分析一下最近3个月的商机',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'HIGH',
        blockReason: '',
        orderBy: [{ field: 'amount', direction: 'DESC' }],
        resultKindHint: 'partner-contribution',
        resultIntent: 'summary',
        businessIntentHint: {
          objectTypes: ['partner', 'opportunity', 'order'],
          metrics: ['opportunity_count', 'opportunity_amount'],
          dimensions: ['partner'],
          analysisMode: 'summary_report',
          outputPreference: ['text_summary', 'table'],
          comparison: [],
          sourceResource: 'opportunities',
        },
      } as never,
      'wecom-bot',
    );

    expect(workflow.tasks.map((item) => item.title)).toEqual([
      '商机整体总览',
      '商机阶段分布',
      '商机渠道商维度',
    ]);
    expect(workflow.tasks.map((item) => item.plan.resultKind)).toEqual([
      'metric-summary',
      'stage-distribution',
      'partner-contribution',
    ]);
    expect(workflow.tasks.every((item) => item.plan.domain === 'opportunity-analysis')).toBe(true);

    const routes = compiler
      .compileTasks(workflow.tasks)
      .map((task) => registry.resolveReadRoute(task, 'PLAN_EXECUTION'));
    expect(routes.map((route) => route.matchedAdapter)).toEqual([
      'crm-official-api.opportunity-metric-summary',
      'crm-official-api.opportunity-stage-distribution',
      'crm-official-api.opportunity-partner-contribution',
    ]);
  });

  it('用户自由追加分析内容和呈现方式时应补充受控任务并记录输出偏好', () => {
    const workflow = service.buildWorkflow(
      '帮我分析商机情况，再加趋势和阶段分布，用表格和图表呈现',
      {
        domain: 'opportunity-analysis',
        metrics: ['新增商机金额', '商机数量'],
        dimensions: ['月份', '商机阶段'],
        filters: {},
        missingConditions: [],
        normalizedQuestion: '帮我分析商机情况，再加趋势和阶段分布，用表格和图表呈现',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'HIGH',
        blockReason: '',
        orderBy: [{ field: 'amount', direction: 'DESC' }],
        resultKindHint: 'metric-summary',
        resultIntent: 'summary',
        analysisFacetProfile: 'generic-analysis',
        analysisDepth: 'standard',
        analysisFocus: ['trend', 'structure', 'detail'],
        outputPreference: ['table', 'chart'],
      } as never,
      'wecom-bot',
    );

    expect(workflow.outputPreference).toEqual(['table', 'chart']);
    expect(workflow.analysisFocus).toEqual(['trend', 'structure', 'detail']);
    expect(workflow.tasks.map((item) => item.plan.resultKind)).toEqual([
      'metric-summary',
      'time-trend',
      'stage-distribution',
    ]);
    expect(workflow.tasks.map((item) => item.reportSection)).toEqual([
      'detail-table',
      'trend',
      'distribution',
    ]);
    expect(workflow.tasks.slice(1).every((item) => item.required === false)).toBe(true);
  });

  it('服务商画像问题即使被 AI 识别为客户经营主题，也应纠偏到渠道商官方 API 任务', () => {
    const workflow = service.buildWorkflow(
      '最近一年加入的服务商有多少家，合作级别、等级、是否技术服务商维度一起给我。',
      {
        domain: 'customer-relationship',
        metrics: [],
        dimensions: ['渠道商', '客户分类'],
        filters: {
          timeRange: '最近一年',
          startAt: '2025-06-08T00:00:00+08:00',
          endAt: '2026-06-08T00:00:00+08:00',
        },
        temporalSlot: {
          rawText: '最近一年',
          normalizedLabel: '最近一年',
          startAt: '2025-06-08T00:00:00+08:00',
          endAt: '2026-06-08T00:00:00+08:00',
          timezone: 'Asia/Shanghai',
          granularity: 'year',
          relativity: 'relative',
          inclusivity: { start: 'inclusive', end: 'exclusive' },
          confidence: 'HIGH',
        },
        missingConditions: [],
        normalizedQuestion:
          '最近一年加入的服务商有多少家，合作级别、等级、是否技术服务商维度一起给我。',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'MEDIUM',
        blockReason: '',
        orderBy: [{ field: 'amount', direction: 'DESC' }],
        resultKindHint: 'partner-contribution',
        resultIntent: 'distribution',
        analysisFacetProfile: 'customer-operations',
        analysisDepth: 'standard',
        analysisFocus: ['structure'],
      } as never,
      'web-console',
    );

    expect(workflow.tasks).toHaveLength(1);
    expect(workflow.tasks[0]?.plan.domain).toBe('opportunity-analysis');
    expect(workflow.tasks[0]?.plan.baseTable).toBe('opportunities');
    expect(workflow.tasks[0]?.plan.resultKind).toBe('partner-contribution');
    expect(workflow.tasks[0]?.plan.joinTables).toEqual(['partners']);
  });

  it('渠道商数量和类型明细问题应规划为渠道商类型明细，不走商机贡献标题', () => {
    const workflow = service.buildWorkflow(
      '山东区域有多少个渠道商，分别是什么类型的单独列一下。',
      {
        domain: 'customer-relationship',
        metrics: ['客户贡献度'],
        dimensions: ['渠道商'],
        filters: {},
        missingConditions: [],
        normalizedQuestion: '山东区域有多少个渠道商，分别是什么类型的单独列一下。',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'HIGH',
        blockReason: '',
        orderBy: [{ field: 'count', direction: 'DESC' }],
        resultKindHint: 'partner-contribution',
        resultIntent: 'detail',
      } as never,
      'wecom-bot',
    );

    expect(workflow.tasks).toHaveLength(1);
    expect(workflow.tasks[0]?.title).toBe('渠道商类型明细');
    expect(workflow.tasks[0]?.title).not.toContain('新增商机金额');
    expect(workflow.tasks[0]?.plan.resultKind).toBe('partner-contribution');
  });

  it('合作伙伴开拓情况不应被标题化为新增商机金额渠道商贡献', () => {
    const workflow = service.buildWorkflow(
      '分析一下公司当前的合作伙伴开拓情况',
      {
        domain: 'opportunity-analysis',
        metrics: ['新增商机金额'],
        dimensions: ['渠道商'],
        filters: {},
        missingConditions: [],
        normalizedQuestion: '分析一下公司当前的合作伙伴开拓情况',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'MEDIUM',
        blockReason: '',
        orderBy: [{ field: 'amount', direction: 'DESC' }],
        resultKindHint: 'partner-contribution',
        resultIntent: 'summary',
      } as never,
      'wecom-bot',
    );

    expect(workflow.tasks).toHaveLength(1);
    expect(workflow.tasks[0]?.title).toBe('服务商开拓情况');
    expect(workflow.tasks[0]?.title).not.toContain('新增商机金额');
    expect(workflow.tasks[0]?.plan.resultKind).toBe('partner-contribution');
  });

  it('订单情况被上游误判为商机渠道贡献时应纠回订单口径', () => {
    const workflow = service.buildWorkflow(
      '分析一下公司当前订单情况，并给出后续经营建议',
      {
        domain: 'opportunity-analysis',
        metrics: ['新增商机金额'],
        dimensions: ['渠道商'],
        filters: {},
        missingConditions: [],
        normalizedQuestion: '分析一下公司当前订单情况，并给出后续经营建议',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'MEDIUM',
        blockReason: '',
        orderBy: [{ field: 'amount', direction: 'DESC' }],
        resultKindHint: 'partner-contribution',
        resultIntent: 'summary',
      } as never,
      'wecom-bot',
    );

    expect(workflow.domain).toBe('contract-conversion');
    expect(workflow.tasks[0]?.title).toBe('订单金额总览');
    expect(workflow.tasks[0]?.plan.domain).toBe('contract-conversion');
    expect(workflow.tasks[0]?.plan.resultKind).toBe('metric-summary');
    expect(workflow.tasks[0]?.title).not.toContain('新增商机金额');
  });

  it('综合经营问题应拆成伙伴、报备、商机和订单 OpenAPI 任务', () => {
    const workflow = service.buildWorkflow(
      '帮我查询分析下，公司当前的合作伙伴开拓情况、客户商机报备及订单情况，并且给出后续经营建议',
      {
        domain: 'contract-conversion',
        metrics: ['转合同金额'],
        dimensions: ['渠道商'],
        filters: {},
        missingConditions: [],
        normalizedQuestion:
          '帮我查询分析下，公司当前的合作伙伴开拓情况、客户商机报备及订单情况，并且给出后续经营建议',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'HIGH',
        blockReason: '',
        orderBy: [{ field: 'amount', direction: 'DESC' }],
        resultKindHint: 'partner-contribution',
        resultIntent: 'summary',
        analysisDepth: 'deep-dive',
        analysisFocus: ['summary', 'structure'],
        businessIntentHint: {
          objectTypes: ['partner', 'registration', 'opportunity', 'order'],
          metrics: ['partner_count', 'registration_count', 'opportunity_count', 'order_count'],
          dimensions: ['partner'],
          analysisMode: 'summary_report',
          outputPreference: ['text_summary', 'table'],
          comparison: [],
          sourceResource: 'orders',
        },
      } as never,
      'wecom-bot',
    );

    expect(workflow.tasks.map((item) => item.title)).toEqual([
      '合作伙伴开拓情况',
      '客户报备情况',
      '客户商机及渠道商维度',
      '订单情况及渠道商贡献',
    ]);
    expect(workflow.tasks.map((item) => item.plan.domain)).toEqual([
      'opportunity-analysis',
      'customer-relationship',
      'opportunity-analysis',
      'contract-conversion',
    ]);
    expect(workflow.tasks.map((item) => item.plan.resultKind)).toEqual([
      'partner-contribution',
      'category-distribution',
      'partner-contribution',
      'partner-contribution',
    ]);
    expect(workflow.tasks[0]?.title).not.toContain('合同转化');
    expect(workflow.tasks[0]?.title).not.toContain('订单金额渠道商贡献');

    const routes = compiler
      .compileTasks(workflow.tasks)
      .map((task) => registry.resolveReadRoute(task, 'PLAN_EXECUTION'));
    expect(routes.every((route) => route.executionSource === 'CRM_OFFICIAL_API')).toBe(true);
    expect(routes.map((route) => route.matchedAdapter)).toEqual([
      'crm-official-api.opportunity-partner-contribution',
      'crm-official-api.customer-category-distribution',
      'crm-official-api.opportunity-partner-contribution',
      'crm-official-api.order-partner-contribution',
    ]);
  });

  it('渠道商经营情况默认应拉通客户报备、商机和订单', () => {
    const workflow = service.buildWorkflow(
      '帮我分析一下渠道商经营情况',
      {
        domain: 'customer-relationship',
        metrics: ['客户贡献度'],
        dimensions: ['渠道商'],
        filters: {},
        missingConditions: [],
        normalizedQuestion: '帮我分析一下渠道商经营情况',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'HIGH',
        blockReason: '',
        orderBy: [{ field: 'amount', direction: 'DESC' }],
        resultKindHint: 'partner-contribution',
        resultIntent: 'summary',
        businessIntentHint: {
          objectTypes: ['partner'],
          metrics: ['partner_count'],
          dimensions: ['partner'],
          analysisMode: 'summary_report',
          outputPreference: ['text_summary', 'table'],
          comparison: [],
          sourceResource: 'partners',
        },
      } as never,
      'wecom-bot',
    );

    expect(workflow.tasks.map((item) => item.title)).toEqual([
      '合作伙伴开拓情况',
      '客户报备情况',
      '客户商机及渠道商维度',
      '订单情况及渠道商贡献',
    ]);
  });

  it('服务商发展运营看板应按经营链而不是单纯画像拆分', () => {
    const workflow = service.buildWorkflow(
      '全国代理商发展运营数据看板',
      {
        domain: 'customer-relationship',
        metrics: ['客户贡献度'],
        dimensions: ['渠道商'],
        filters: {},
        missingConditions: [],
        normalizedQuestion: '全国代理商发展运营数据看板',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'HIGH',
        blockReason: '',
        orderBy: [{ field: 'amount', direction: 'DESC' }],
        resultKindHint: 'partner-contribution',
        resultIntent: 'summary',
        businessIntentHint: {
          objectTypes: ['partner', 'registration', 'opportunity', 'order'],
          metrics: ['partner_count', 'registration_count', 'opportunity_count', 'order_count'],
          dimensions: ['partner', 'partner_level', 'is_technical_service_provider'],
          analysisMode: 'dashboard',
          outputPreference: ['text_summary', 'table', 'chart', 'html_report'],
          comparison: [],
          sourceResource: 'orders',
        },
      } as never,
      'wecom-bot',
    );

    expect(workflow.tasks.map((item) => item.title)).toEqual([
      '合作伙伴开拓情况',
      '客户报备情况',
      '客户商机及渠道商维度',
      '订单情况及渠道商贡献',
    ]);
    expect(workflow.tasks[0]?.title).not.toBe('服务商画像统计');
  });

  it('只问订单情况时应默认补充渠道商贡献任务', () => {
    const workflow = service.buildWorkflow(
      '帮我分析一下订单情况',
      {
        domain: 'contract-conversion',
        metrics: ['转合同金额'],
        dimensions: [],
        filters: {},
        missingConditions: [],
        normalizedQuestion: '帮我分析一下订单情况',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'HIGH',
        blockReason: '',
        orderBy: [{ field: 'amount', direction: 'DESC' }],
        resultKindHint: 'metric-summary',
        resultIntent: 'summary',
      } as never,
      'wecom-bot',
    );

    expect(workflow.tasks.map((item) => item.title)).toEqual([
      '订单金额总览',
      '订单金额渠道商贡献',
    ]);
    expect(workflow.tasks.map((item) => item.plan.resultKind)).toEqual([
      'metric-summary',
      'partner-contribution',
    ]);
  });

  it('渠道商贡献查询应保留渠道表关联字段，便于 OpenAPI 结果展示渠道名称', () => {
    const compiled = compiler.compile(
      compiler.buildPlanForResultKind(
        {
          domain: 'opportunity-analysis',
          metrics: ['新增商机金额'],
          dimensions: ['渠道商'],
          filters: { organizationIds: ['10804'] },
          confidence: 'HIGH',
        },
        'partner-contribution',
      ),
    );

    expect(compiled.sql).toContain('LEFT JOIN partners p ON p.id = o.partner_id');
    expect(compiled.sql).toContain('COALESCE(p.name');
    expect(compiled.resultKind).toBe('partner-contribution');
    expect(compiled.fieldMap).toEqual(
      expect.objectContaining({
        partners: expect.arrayContaining(['id', 'name', 'partnerLevel', 'status']),
      }),
    );
  });

  it('渠道下单汇总报告应拆成订单总览、渠道商贡献和月度趋势任务', () => {
    const workflow = service.buildWorkflow(
      '最近三个月山东区域，有下单的服务商，对应的订单数量、订单金额以及总金额，生成汇总分析报告',
      {
        domain: 'contract-conversion',
        metrics: ['转合同金额'],
        dimensions: ['渠道商', '区域', '月份'],
        filters: {
          timeRange: '最近三个月',
          startAt: '2026-03-01T00:00:00+08:00',
          endAt: '2026-06-01T00:00:00+08:00',
        },
        missingConditions: [],
        normalizedQuestion:
          '最近三个月山东区域，有下单的服务商，对应的订单数量、订单金额以及总金额，生成汇总分析报告',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'HIGH',
        blockReason: '',
        orderBy: [{ field: 'amount', direction: 'DESC' }],
        resultKindHint: 'partner-contribution',
        resultIntent: 'summary',
        analysisDepth: 'deep-dive',
        analysisFocus: ['summary', 'ranking', 'trend'],
      } as never,
      'wecom-bot',
    );

    expect(workflow.tasks.map((item) => item.plan.resultKind)).toEqual([
      'metric-summary',
      'partner-contribution',
      'time-trend',
    ]);
    expect(workflow.tasks[0]?.title).toBe('订单金额总览');
    expect(workflow.tasks[1]?.title).toBe('订单金额渠道商贡献');
    expect(workflow.tasks[1]?.plan.domain).toBe('contract-conversion');
    expect(workflow.tasks[1]?.plan.groupBy).toEqual(['partner_id']);
    expect(workflow.tasks[2]?.title).toBe('订单金额月度趋势');

    const compiledPartnerTask = compiler.compile(workflow.tasks[1]!.plan);
    expect(compiledPartnerTask.resultKind).toBe('partner-contribution');
    expect(compiledPartnerTask.tables).toEqual(
      expect.arrayContaining(['contracts', 'partners']),
    );
  });

  it('合同金额总额加前三排名问题应拆成全量总额和前三负责人排名任务', () => {
    const temporalSlot = {
      rawText: '26年',
      normalizedLabel: '2026年',
      startAt: '2026-01-01T00:00:00+08:00',
      endAt: '2027-01-01T00:00:00+08:00',
      timezone: 'Asia/Shanghai' as const,
      granularity: 'year' as const,
      relativity: 'absolute' as const,
      inclusivity: { start: 'inclusive' as const, end: 'exclusive' as const },
      confidence: 'HIGH' as const,
    };
    const workflow = service.buildWorkflow(
      '26年公司合同金额是多少？排名前三的销售分别是谁？',
      {
        domain: 'contract-conversion',
        metrics: ['转合同金额'],
        dimensions: ['销售负责人'],
        filters: {
          timeRange: '2026年',
          startAt: '2026-01-01T00:00:00+08:00',
          endAt: '2027-01-01T00:00:00+08:00',
        },
        temporalSlot,
        missingConditions: [],
        normalizedQuestion: '26年公司合同金额是多少？排名前三的销售分别是谁？',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'HIGH',
        blockReason: '',
        orderBy: [{ field: 'amount', direction: 'DESC' }],
        resultKindHint: 'owner-ranking',
        resultIntent: 'ranking',
        analysisFacetProfile: 'owner-performance-ranking',
        analysisDepth: 'deep-dive',
        analysisFocus: ['ranking'],
      } as never,
      'web-console',
    );

    expect(workflow.tasks.map((item) => item.plan.resultKind)).toEqual([
      'metric-summary',
      'owner-ranking',
    ]);
    expect(workflow.tasks[0]?.title).toBe('合同金额总览');
    expect(workflow.tasks[1]?.title).toBe('合同金额负责人前三排名');
    expect(workflow.tasks[1]?.plan.filters.rowLimit).toBe(3);

    const compiledTotal = compiler.compile(workflow.tasks[0]!.plan);
    const compiledRanking = compiler.compile(workflow.tasks[1]!.plan);
    expect(compiledTotal.sql).toContain('contract_assets ca_valid_income');
    expect(compiledTotal.sql).toContain("ca_valid_income.custom_field_name = 'numeric_asset_7ee237'");
    expect(compiledTotal.sql).toContain('SUM(COALESCE(ca_valid_income.numeric_asset, 0)) AS amount');
    expect(compiledTotal.sql).toContain('c.created_at >= ?');
    expect(compiledTotal.sql).toContain('c.created_at < ?');
    expect(compiledTotal.sql).toContain('c.approve_status = 3');
    expect(compiledTotal.sql).toContain('c.finish_approve_at < ?');
    expect(compiledTotal.sql).not.toContain('c.total_amount');
    expect(compiledTotal.sql).not.toContain('c.sign_date');
    expect(compiledTotal.sql).not.toContain('GROUP BY');
    expect(compiledTotal.rowLimit).toBe(1);
    expect(compiledTotal.params).toContain('2027-01-01T00:00:00+08:00');
    expect(compiledRanking.sql).toContain('GROUP BY c.user_id, u.name');
    expect(compiledRanking.params.at(-1)).toBe(3);
  });
});

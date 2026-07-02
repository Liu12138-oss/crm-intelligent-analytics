import type { QueryTemplateRecord } from '../../../src/shared/types/domain';
import { AnalysisQueryKnowledgeService } from '../../../src/modules/analysis/analysis-query-knowledge.service';

describe('AnalysisQueryKnowledgeService', () => {
  function createTemplate(partial: Partial<QueryTemplateRecord>): QueryTemplateRecord {
    return {
      id: partial.id ?? 'tpl-test',
      name: partial.name ?? '默认模板',
      description: partial.description ?? '默认模板描述',
      defaultQuestionText:
        partial.defaultQuestionText ?? '本月各销售负责人新增商机金额排名',
      defaultFilters: partial.defaultFilters ?? {},
      defaultViewType: partial.defaultViewType ?? 'BAR_CHART',
      queryMode: partial.queryMode ?? 'FIXED_SQL',
      sqlText:
        partial.sqlText ??
        'SELECT user_id, SUM(expect_amount) AS total_amount FROM opportunities GROUP BY user_id',
      sqlVersion: partial.sqlVersion ?? '2026.05.11',
      parameterSchema: partial.parameterSchema ?? [],
      renderConfig: partial.renderConfig ?? {
        primaryViewType: 'BAR_CHART',
        primaryTitle: '默认模板结果',
      },
      visibleRoleIds: partial.visibleRoleIds ?? ['sales_director'],
      displayOrder: partial.displayOrder ?? 1,
      clickCount7d: partial.clickCount7d ?? 0,
      hitRatePercent: partial.hitRatePercent ?? 0,
      optimizationStatus: partial.optimizationStatus ?? 'HEALTHY',
      status: partial.status ?? 'ACTIVE',
      ownedBy: partial.ownedBy ?? 'system',
      updatedAt: partial.updatedAt ?? '2026-04-23T00:00:00.000Z',
      validationSnapshot: partial.validationSnapshot,
      lastValidatedAt: partial.lastValidatedAt,
    };
  }

  it('应为自由问数返回别名提示、模板候选和已验证示例', () => {
    const service = new AnalysisQueryKnowledgeService({
      listAll: jest.fn(() => [
        createTemplate({
          id: 'tpl-contract-ranking',
          name: '合同金额排行',
          defaultQuestionText: '本月各销售负责人签约金额排名',
        }),
      ]),
    } as never);

    const knowledgeContext = service.buildKnowledgeContext(
      '本月各销售负责人签约金额排名，顺便看看已回款',
    );

    expect(knowledgeContext.aliasHints).toEqual(
      expect.arrayContaining(['签约金额 -> 转合同金额', '已回款 -> contracts.received_payments_amount']),
    );
    expect(knowledgeContext.templateCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'GOVERNED_TEMPLATE',
          templateId: 'tpl-contract-ranking',
        }),
        expect.objectContaining({
          source: 'VALIDATED_EXAMPLE',
        }),
      ]),
    );
    expect(knowledgeContext.normalizationRules).toContain(
      '按部门、区域、团队汇总时必须先应用归一部门规则，不能直接按原始部门名分组。',
    );
  });

  it('应支持口语化表达命中已验证模板与码表提示', () => {
    const service = new AnalysisQueryKnowledgeService({
      listAll: jest.fn(() => [
        createTemplate({
          id: 'tpl-opportunity-ranking',
          name: '商机金额排行',
          defaultQuestionText: '本月各销售负责人新增商机金额排名',
        }),
      ]),
    } as never);

    const knowledgeContext = service.buildKnowledgeContext('最近30天华东团队赢率和商机额走势');

    expect(knowledgeContext.aliasHints).toEqual(
      expect.arrayContaining(['赢率 -> 赢单率', '商机额 -> 新增商机金额']),
    );
    expect(knowledgeContext.codebookHints).toEqual(
      expect.arrayContaining([
        '销售阶段字段使用 field_values 映射，不得直接把 stage 数值当中文标签输出。',
      ]),
    );
    expect(knowledgeContext.templateCandidates.length).toBeGreaterThan(0);
  });

  it('应补充联软 P3-P5 漏斗、报价未下单和有效订单语义口径', () => {
    const service = new AnalysisQueryKnowledgeService({
      listAll: jest.fn(() => []),
    } as never);

    const knowledgeContext = service.buildKnowledgeContext(
      '找出有报价但未下单的客户，并分析报备到订单漏斗转化，订单只看有效订单',
    );

    expect(knowledgeContext.aliasHints).toEqual(
      expect.arrayContaining([
        '有报价但未下单/报价未转订单 -> 报价未匹配有效订单客户',
        '报备/商机/报价/订单转化 -> 漏斗转化',
        '有效订单 -> confirmed/completed 计入，pending/processing 仅作为过程订单',
      ]),
    );
    expect(knowledgeContext.codebookHints).toEqual(
      expect.arrayContaining([
        '联软有效订单默认仅统计 confirmed/completed；pending/processing 作为过程订单展示，rejected/cancelled/deleted 排除。',
      ]),
    );
    expect(knowledgeContext.templateCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'VALIDATED_EXAMPLE',
          name: '联软有报价未下单客户',
        }),
        expect.objectContaining({
          source: 'VALIDATED_EXAMPLE',
          name: '联软报备到订单转化漏斗',
        }),
      ]),
    );
  });

  it('应为时间槽直查补充默认时间字段、禁用字段和 Hermes 只读边界提示', () => {
    const service = new AnalysisQueryKnowledgeService({
      listAll: jest.fn(() => []),
    } as never);

    const knowledgeContext = service.buildKnowledgeContext('最近四个月新增商机金额趋势');
    const formatted = service.formatKnowledgeContext(knowledgeContext);

    expect(knowledgeContext.temporalFieldHints).toEqual(
      expect.arrayContaining([
        expect.stringContaining('商机新增默认使用 opportunities.created_at'),
        expect.stringContaining('不得使用 updated_at'),
      ]),
    );
    expect(knowledgeContext.temporalExampleHints).toEqual(
      expect.arrayContaining([
        expect.stringContaining('最近四个月'),
        expect.stringContaining('反例'),
      ]),
    );
    expect(formatted).toContain('时间字段白名单');
    expect(formatted).toContain('只读工具边界');
  });

  it('应补充主题知识资产、推荐区块和 Hermes 模板优先工作流', () => {
    const service = new AnalysisQueryKnowledgeService({
      listAll: jest.fn(() => []),
    } as never);

    const knowledgeContext = service.buildKnowledgeContext(
      '最近一年各销售负责人新增商机金额排名，请做详细分析总结',
    );
    const formatted = service.formatKnowledgeContext(knowledgeContext);

    expect(knowledgeContext.topicAssetHints).toEqual(
      expect.arrayContaining([
        expect.stringContaining('owner-performance-ranking'),
        expect.stringContaining('推荐区块'),
      ]),
    );
    expect(knowledgeContext.workflowHints).toEqual(
      expect.arrayContaining([
        expect.stringContaining('模板优先'),
        expect.stringContaining('对象'),
      ]),
    );
    expect(formatted).toContain('主题知识资产');
    expect(formatted).toContain('Hermes 工作流');
  });

  it('应优先消费已发布语义资产中的别名、时间提示、组织归一和负例样例', () => {
    const service = new (AnalysisQueryKnowledgeService as any)(
      {
        listAll: jest.fn(() => []),
      },
      {
        listPublishedActive: jest.fn(() => [
          {
            id: 'asset_alias_opportunity_amount',
            type: 'ALIAS',
            name: '商机额别名',
            status: 'ACTIVE',
            canonicalLabel: '新增商机金额',
            synonyms: ['商机额'],
            hint: '商机额 -> 新增商机金额（已发布）',
            matchKeywords: ['商机额'],
          },
          {
            id: 'asset_temporal_opportunity',
            type: 'TEMPORAL_FIELD_HINT',
            name: '商机时间口径',
            status: 'ACTIVE',
            matchKeywords: ['商机', '新增商机金额'],
            hint: '商机新增统一按 opportunities.created_at 统计（已发布）。',
          },
          {
            id: 'asset_org_shandong',
            type: 'ORGANIZATION_NORMALIZATION',
            name: '山东区归一提示',
            status: 'ACTIVE',
            matchKeywords: ['山东区'],
            hint: '山东区统一映射到已批准的大区归一口径（已发布）。',
          },
          {
            id: 'asset_negative_raw_export',
            type: 'NEGATIVE_EXAMPLE',
            name: '全量原始明细阻断',
            status: 'ACTIVE',
            matchKeywords: ['导出全部原始明细'],
            questionText: '帮我导出全部原始明细',
            blockReason: '当前请求命中已发布高风险问法样例，应先阻断。',
            hint: '当前请求命中已发布高风险问法样例，应先阻断。',
          },
        ]),
      },
    );

    const knowledgeContext = service.buildKnowledgeContext(
      '最近四个月山东区商机额趋势，另外帮我导出全部原始明细',
    );

    expect(knowledgeContext.aliasHints).toEqual(
      expect.arrayContaining(['商机额 -> 新增商机金额（已发布）']),
    );
    expect(knowledgeContext.temporalFieldHints).toEqual(
      expect.arrayContaining([
        expect.stringContaining('opportunities.created_at 统计（已发布）'),
      ]),
    );
    expect(knowledgeContext.normalizationRules).toEqual(
      expect.arrayContaining([
        '山东区统一映射到已批准的大区归一口径（已发布）。',
      ]),
    );
    expect(knowledgeContext.blockedReason).toBe(
      '当前请求命中已发布高风险问法样例，应先阻断。',
    );
  });
});

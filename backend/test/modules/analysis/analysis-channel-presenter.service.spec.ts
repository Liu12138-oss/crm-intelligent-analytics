import type { AnalysisResultRecord } from '../../../src/shared/types/domain';
import { AnalysisChannelPresenterService } from '../../../src/modules/analysis/analysis-channel-presenter.service';

describe('AnalysisChannelPresenterService', () => {
  function createResultRecord(): AnalysisResultRecord {
    return {
      requestId: 'query-test',
      title: 'CRM 智能分析报告',
      summary: '本月华东区域新增商机金额排名已生成。',
      report: {
        variant: 'ranking',
        reportTitle: 'CRM 智能分析报告',
        executiveSummary: '本月华东区域新增商机金额排名已生成。',
        keyFindings: [],
        metricCards: [],
        chartBlocks: [],
        tableBlocks: [],
        sections: [],
        datasetReferences: [],
        scopeSummary: '测试权限范围',
        appliedFilters: [],
        sourceNotes: [
          {
            key: 'analysis-scope',
            label: '分析范围',
            description: '测试权限范围',
          },
        ],
        footnotes: ['当前结果中的摘要、图表、表格共用同一份一致性标识。'],
        executionTraceSummary: {
          normalizedQuestion: '本月华东区域新增商机金额排名',
          consistencyToken: 'consistency-test',
          knowledgeHits: [
            {
              assetId: 'semantic_alias_001',
              assetType: 'ALIAS',
              source: 'PUBLISHED_ASSET',
              name: '商机额别名',
            },
          ],
          taskSummaries: [],
          datasetReferences: [],
          createdAt: '2026-04-23T00:00:00.000Z',
        },
        availableActions: [],
        groundedMarkdown: '## 完整结果\n- 这里是 Web 完整 Markdown。',
        wecomMarkdown: '## 摘要\n- 这里是企微裁剪 Markdown。',
        markdownOutline: ['完整结果'],
      } as any,
      scopeSummary: '测试权限范围',
      appliedFilters: [],
      metricCards: [],
      secondaryViews: [],
      tableRows: Array.from({ length: 12 }, (_, index) => ({
        ownerName: `负责人${index + 1}`,
        amount: 100 - index,
      })),
      keyFindings: [],
      rowCount: 1,
      dataFreshnessAt: '2026-04-23T00:00:00.000Z',
      consistencyToken: 'consistency-test',
      executionTraceSummary: {
        normalizedQuestion: '本月华东区域新增商机金额排名',
        consistencyToken: 'consistency-test',
        knowledgeHits: [
          {
            assetId: 'semantic_alias_001',
            assetType: 'ALIAS',
            source: 'PUBLISHED_ASSET',
            name: '商机额别名',
          },
        ],
        taskSummaries: [],
        datasetReferences: [],
        createdAt: '2026-04-23T00:00:00.000Z',
      },
      groundedMarkdown: '## 完整结果\n- 这里是 Web 完整 Markdown。',
      wecomMarkdown: '## 摘要\n- 这里是企微裁剪 Markdown。',
      markdownOutline: ['完整结果'],
      streamBlocks: [],
      availableActions: [],
      returnedAt: '2026-04-23T00:00:00.000Z',
    } as any;
  }

  it('Web 应保留完整 Markdown 载荷', () => {
    const service = new AnalysisChannelPresenterService();
    const result = createResultRecord();

    const presented = service.presentResult(result, 'web-console') as any;

    expect(presented.groundedMarkdown).toBe('## 完整结果\n- 这里是 Web 完整 Markdown。');
    expect(presented.report.groundedMarkdown).toBe(
      '## 完整结果\n- 这里是 Web 完整 Markdown。',
    );
  });

  it('企业微信应消费裁剪后的 Markdown 载荷', () => {
    const service = new AnalysisChannelPresenterService();
    const result = createResultRecord();

    const presented = service.presentResult(result, 'wecom-bot') as any;

    expect(presented.groundedMarkdown).toBe(
      [
        '【展示模板】区域经营对比卡',
        '【回复结构】问题复述 / 数据口径 / 区域分层 / 重点区域 / 管理建议',
        '【建议追问】按区域拆分；查看缺口最大区域；生成区域看板',
        '【问题复述】本次问题已按 CRM 智能分析标准模板处理。',
        '【数据口径】使用当前用户可见范围内的本地 OpenAPI Markdown 快照；金额按元读取并以万元展示，统计对象只包含快照中真实返回的报备、商机、报价、订单和渠道商记录。',
        '【权限口径】本次结论只代表当前登录用户可见数据；涉及全平台、全国或跨角色判断时，需先确认是否已获得对应授权。',
        '【维度判断】重点按区域或大区比较报备、商机、报价、订单贡献，识别高贡献、低活跃和贡献集中区域。',
        '【核心指标】当前结果未形成可展示指标，需先补齐快照或放宽筛选条件。',
        '【明细摘要】核心视图应包含：区域经营对比；已命中 1 条明细，企微仅展示前若干条，完整明细请进入结果页查看。',
        '【缺口说明】若区域管理员响应时效、连续周期或区域目标字段缺失，只输出区域经营差异和需补字段清单。',
        '【风险建议】优先复盘高商机低订单区域、渠道多产出低区域和连续下滑区域。',
        '## 摘要',
        '- 这里是企微裁剪 Markdown。',
      ].join('\n'),
    );
    expect(presented.report.groundedMarkdown).toBe(presented.groundedMarkdown);
    expect(presented.report.wecomMarkdown).toBe(
      [
        '【展示模板】区域经营对比卡',
        '【回复结构】问题复述 / 数据口径 / 区域分层 / 重点区域 / 管理建议',
        '【建议追问】按区域拆分；查看缺口最大区域；生成区域看板',
        '【问题复述】本次问题已按 CRM 智能分析标准模板处理。',
        '【数据口径】使用当前用户可见范围内的本地 OpenAPI Markdown 快照；金额按元读取并以万元展示，统计对象只包含快照中真实返回的报备、商机、报价、订单和渠道商记录。',
        '【权限口径】本次结论只代表当前登录用户可见数据；涉及全平台、全国或跨角色判断时，需先确认是否已获得对应授权。',
        '【维度判断】重点按区域或大区比较报备、商机、报价、订单贡献，识别高贡献、低活跃和贡献集中区域。',
        '【核心指标】当前结果未形成可展示指标，需先补齐快照或放宽筛选条件。',
        '【明细摘要】核心视图应包含：区域经营对比；已命中 1 条明细，企微仅展示前若干条，完整明细请进入结果页查看。',
        '【缺口说明】若区域管理员响应时效、连续周期或区域目标字段缺失，只输出区域经营差异和需补字段清单。',
        '【风险建议】优先复盘高商机低订单区域、渠道多产出低区域和连续下滑区域。',
        '## 摘要',
        '- 这里是企微裁剪 Markdown。',
      ].join('\n'),
    );
    expect(presented.report.presentationTemplate).toEqual(
      expect.objectContaining({
        templateType: 'REGION_COMPARISON',
        templateName: '区域经营对比卡',
      }),
    );
    expect(presented.markdownOutline).toContain('执行摘要');
    expect(presented.tableRows).toHaveLength(12);
    expect(presented.executionTraceSummary).toEqual(
      expect.objectContaining({
        consistencyToken: 'consistency-test',
      }),
    );
    expect(presented.report.executionTraceSummary).toEqual(
      expect.objectContaining({
        consistencyToken: 'consistency-test',
      }),
    );
    expect(presented.report.sourceNotes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: '分析范围',
        }),
      ]),
    );
    expect(presented.report.footnotes).toEqual(
      expect.arrayContaining(['当前结果中的摘要、图表、表格共用同一份一致性标识。']),
    );
  });

  it('企业微信排名结果至多保留前 20 条明细', () => {
    const service = new AnalysisChannelPresenterService();
    const result = createResultRecord();
    (result as any).tableRows = Array.from({ length: 25 }, (_, index) => ({
      ownerName: `负责人${index + 1}`,
      amount: 100 - index,
    }));
    (result.report as any).variant = 'ranking';
    (result.report as any).tableBlocks = [
      {
        blockId: 'table-1',
        title: '明细',
        rows: (result as any).tableRows,
        datasetId: 'dataset-1',
      },
    ];

    const presented = service.presentResult(result, 'wecom-bot') as any;

    expect(presented.tableRows).toHaveLength(20);
    expect(presented.report.tableBlocks[0].rows).toHaveLength(20);
  });
});

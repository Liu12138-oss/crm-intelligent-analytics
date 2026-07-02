import type { AnalysisReportPayload } from '../../../src/shared/types/domain';
import { ResultNormalizerService } from '../../../src/modules/analysis/result-normalizer.service';

describe('ResultNormalizerService', () => {
  it('应把统一结果包里的 Markdown 载荷透传到标准结果记录', () => {
    const service = new ResultNormalizerService();
    const report = {
      variant: 'ranking',
      reportTitle: 'CRM 智能分析报告',
      executiveSummary: '本月华东区域新增商机金额排名已生成。',
      keyFindings: [],
      metricCards: [],
      chartBlocks: [],
      tableBlocks: [],
      datasetReferences: [],
      scopeSummary: '测试权限范围',
      appliedFilters: [],
      availableActions: [],
      groundedMarkdown: '## 执行摘要\n- 本月华东区域新增商机金额排名已生成。',
      wecomMarkdown: '## 执行摘要\n- 本月新增商机金额排名已生成。',
      markdownOutline: ['执行摘要'],
      temporalScope: {
        rawText: '本月',
        normalizedLabel: '本月',
        startAt: '2026-03-31T16:00:00.000Z',
        endAt: '2026-04-30T16:00:00.000Z',
        granularity: 'month',
        timezone: 'Asia/Shanghai',
        source: 'AI_TEMPORAL_SLOT',
      },
    } as unknown as AnalysisReportPayload;

    const result = service.normalize({
      requestId: 'query-test',
      report,
      dataFreshnessAt: '2026-04-23T00:00:00.000Z',
      consistencyToken: 'consistency-test',
    });

    expect((result as any).groundedMarkdown).toBe((report as any).groundedMarkdown);
    expect((result as any).wecomMarkdown).toBe((report as any).wecomMarkdown);
    expect((result as any).markdownOutline).toEqual(['执行摘要']);
    expect((result as any).temporalScope).toEqual((report as any).temporalScope);
  });

  it('主图表和首个表格不属于同一数据集时，应按图表 datasetId 选择明细表', () => {
    const service = new ResultNormalizerService();
    const report = {
      variant: 'trend',
      reportTitle: '新增商机金额趋势分析报告',
      executiveSummary: '最近四个月新增商机金额趋势已生成。',
      keyFindings: [],
      metricCards: [],
      chartBlocks: [
        {
          blockId: 'chart-dataset_trend',
          title: '新增商机金额趋势分析',
          viewType: 'LINE_CHART',
          datasetId: 'dataset_trend',
          series: [{ label: '2026-04', value: 100 }],
        },
      ],
      tableBlocks: [
        {
          blockId: 'table-dataset_ranking',
          title: '新增商机金额排名明细',
          datasetId: 'dataset_ranking',
          rows: [{ ownerName: '张鑫', amount: 200 }],
        },
        {
          blockId: 'table-dataset_trend',
          title: '新增商机金额趋势分析明细',
          datasetId: 'dataset_trend',
          rows: [{ bucket_label: '2026-04', ownerName: '2026-04', amount: 100 }],
        },
      ],
      datasetReferences: [],
      scopeSummary: '测试权限范围',
      appliedFilters: [],
      availableActions: [],
    } as unknown as AnalysisReportPayload;

    const result = service.normalize({
      requestId: 'query-test',
      report,
      dataFreshnessAt: '2026-04-23T00:00:00.000Z',
      consistencyToken: 'consistency-test',
    });

    expect(result.tableRows).toEqual([
      { bucket_label: '2026-04', ownerName: '2026-04', amount: 100 },
    ]);
  });
});

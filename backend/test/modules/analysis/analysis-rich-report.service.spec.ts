import { AnalysisForecastService } from '../../../src/modules/analysis/analysis-forecast.service';
import { AnalysisInsightEvidenceService } from '../../../src/modules/analysis/analysis-insight-evidence.service';
import { AnalysisRichReportService } from '../../../src/modules/analysis/analysis-rich-report.service';
import type { AnalysisResultRecord } from '../../../src/shared/types/domain';

describe('AnalysisRichReportService', () => {
  function createBaseResult(): AnalysisResultRecord {
    return {
      requestId: 'query-rich-report',
      title: '新增商机金额趋势分析',
      summary: '最近四个月新增商机金额趋势已生成。',
      report: {
        variant: 'trend',
        reportTitle: '新增商机金额趋势分析',
        executiveSummary: '最近四个月新增商机金额趋势已生成。',
        keyFindings: [],
        metricCards: [{ name: '累计金额', value: '565' }],
        chartBlocks: [],
        tableBlocks: [],
        sections: [],
        datasetReferences: [
          {
            datasetId: 'dataset_001',
            taskId: 'task_001',
            taskTitle: '新增商机金额趋势分析',
            purpose: 'trend-series',
            rowCount: 4,
          },
        ],
        scopeSummary: '测试范围',
        appliedFilters: [],
        availableActions: [],
      },
      temporalScope: {
        rawText: '最近四个月',
        normalizedLabel: '最近四个月',
        startAt: '2025-12-31T16:00:00.000Z',
        endAt: '2026-04-30T16:00:00.000Z',
        granularity: 'month',
        timezone: 'Asia/Shanghai',
        source: 'AI_TEMPORAL_SLOT',
      },
      scopeSummary: '测试范围',
      appliedFilters: [],
      metricCards: [{ name: '累计金额', value: '565' }],
      secondaryViews: [],
      tableRows: [
        { bucket_label: '2026-01', amount: 120, count: 2 },
        { bucket_label: '2026-02', amount: 135, count: 2 },
        { bucket_label: '2026-03', amount: 148, count: 3 },
        { bucket_label: '2026-04', amount: 162, count: 3 },
      ],
      keyFindings: [],
      rowCount: 4,
      dataFreshnessAt: '2026-05-13T00:00:00.000Z',
      consistencyToken: 'consistency-token',
      streamBlocks: [],
      availableActions: [],
      returnedAt: '2026-05-13T00:00:00.000Z',
    } as AnalysisResultRecord;
  }

  it('应生成完整版与工作台版 Markdown，并补齐 richer report 字段', async () => {
    const service = new AnalysisRichReportService(
      new AnalysisInsightEvidenceService(new AnalysisForecastService()),
      {
        generateRichAnalysisReport: jest.fn(async () => ({
          executiveSummary: '近一周新增商机明细显示新增商机主要集中在头部团队，建议优先复盘高贡献区域的推进节奏。',
          keyFindings: [
            {
              title: '团队分布集中',
              detail: '头部团队贡献度明显高于其他团队，近一周新增主要由少数区域拉动。',
              tone: 'neutral',
            },
          ],
          trendNarrative: '当前结果虽缺少完整时间序列，但从新增结构看，线索正在向头部团队集中。',
          riskNarratives: ['当前样本主要覆盖最近一周，结论适合用于短期观察。'],
          recommendationNarratives: ['建议优先复盘头部团队的机会来源、阶段推进和口径变化。'],
          evidenceNarrative: '上述判断基于当前指标卡、明细预览和统一权限范围内的结构事实。',
        })),
      } as never,
    );

    const enriched = await service.enrich(createBaseResult());

      expect(enriched.report.analysisConfidence).toMatch(/HIGH|MEDIUM|LOW/);
    expect(enriched.report.executiveSummary).toContain('头部团队');
    expect(enriched.report.keyFindings?.[0]?.title).toContain('团队分布集中');
    expect(enriched.report.trendInsight?.summary).toContain('头部团队集中');
    expect(enriched.report.trendInsight?.summary).not.toContain('缺少完整时间序列');
    expect(enriched.report.forecastInsight?.status).toBe('READY');
    expect(enriched.report.recommendations?.[0]?.action).toContain('复盘头部团队');
    expect(enriched.report.workbenchMarkdown).toContain('## 执行摘要');
    expect(enriched.report.detailMarkdown).toContain('## 趋势预测');
    expect(enriched.report.detailMarkdown).toContain('## 经营建议');
    expect(enriched.report.detailMarkdown).toContain('头部团队');
    expect(enriched.report.wecomMarkdown).not.toContain('## 结果依据');
    expect(enriched.groundedMarkdown).toBe(enriched.report.detailMarkdown);
  });

  it('AI 不可用时应基于真实明细生成可读分析报告', async () => {
    const service = new AnalysisRichReportService(
      new AnalysisInsightEvidenceService(new AnalysisForecastService()),
      {
        generateRichAnalysisReport: jest.fn(async () => null),
      } as never,
    );

    const baseResult = createBaseResult();
    const enriched = await service.enrich({
      ...baseResult,
      report: {
        ...baseResult.report,
        reportTitle: '近一周新增商机明细',
        executiveSummary: '近一周新增商机明细 已生成数据结果。',
      },
      title: '近一周新增商机明细',
      summary: '近一周新增商机明细 已生成数据结果。',
      metricCards: [
        { name: '新增商机数', value: 50 },
        { name: '新增金额', value: 551.33 },
      ],
      tableRows: [
        {
          customer_name: '华北数科集团',
          project_name: '统一安全平台升级',
          stage_name: '50%控标或唯一品牌',
          owner_name: '张三',
          expected_amount: 180,
        },
        {
          customer_name: '联软科技集团',
          project_name: '数据交换平台扩容',
          stage_name: '30%有预算且最认可',
          owner_name: '李四',
          expected_amount: 80,
        },
      ],
      rowCount: 2,
    });

    expect(enriched.report.executiveSummary).toContain('新增商机数 50');
    expect(enriched.report.keyFindings?.length).toBeGreaterThan(0);
    expect(enriched.report.keyFindings?.[1]?.detail).toContain('华北数科集团');
    expect(enriched.report.recommendations?.[0]?.action).toContain('统一安全平台升级');
    expect(enriched.report.detailMarkdown).toContain('重点明细');
    expect(enriched.report.detailMarkdown).not.toContain('已生成数据结果。\n## 结果解读');
    expect(enriched.report.detailMarkdown).not.toContain('不做同比、环比或外推预测');
    expect(enriched.report.detailMarkdown).not.toContain('预测暂不可用');
  });

  it('汇总模板结果不应被描述为明细数据或重点明细', async () => {
    const service = new AnalysisRichReportService(
      new AnalysisInsightEvidenceService(new AnalysisForecastService()),
      {
        generateRichAnalysisReport: jest.fn(async () => null),
      } as never,
    );

    const baseResult = createBaseResult();
    const enriched = await service.enrich({
      ...baseResult,
      title: '承诺商机季度拆分',
      summary: '承诺商机季度拆分 已生成数据结果。',
      report: {
        ...baseResult.report,
        variant: 'ranking',
        reportTitle: '承诺商机季度拆分',
        executiveSummary: '承诺商机季度拆分 已生成数据结果。',
        tableBlocks: [
          {
            blockId: 'table_1',
            datasetId: 'dataset_001',
            title: '承诺商机季度拆分',
            rows: [
              {
                team_name: '大北区-北区金融部',
                committed_amount: 2151.52,
                q2_committed_amount: 856.99,
                opportunity_count: 496,
              },
              {
                team_name: '大南区-南区金融部',
                committed_amount: 1715.8,
                q2_committed_amount: 890.37,
                opportunity_count: 707,
              },
            ],
          },
        ],
      },
      metricCards: [
        { name: '承诺商机', value: 3867.32 },
        { name: '商机总额', value: 19793.76 },
      ],
      tableRows: [
        {
          team_name: '大北区-北区金融部',
          committed_amount: 2151.52,
          q2_committed_amount: 856.99,
          opportunity_count: 496,
        },
        {
          team_name: '大南区-南区金融部',
          committed_amount: 1715.8,
          q2_committed_amount: 890.37,
          opportunity_count: 707,
        },
      ],
      rowCount: 2,
    });

    const visibleReportText = [
      enriched.report.executiveSummary,
      ...(enriched.report.keyFindings ?? []).map((item) => `${item.title} ${item.detail}`),
      ...(enriched.report.recommendations ?? []).map((item) => `${item.title} ${item.action}`),
      enriched.report.evidenceSummary,
      enriched.report.detailMarkdown,
    ].join('\n');

    expect(visibleReportText).toContain('汇总');
    expect(visibleReportText).not.toContain('条明细');
    expect(visibleReportText).not.toContain('重点明细');
    expect(visibleReportText).not.toContain('统一明细记录');
  });

  it('非空模板结果应清理 AI 返回的不可预测旧口径并避免关键发现重复污染', async () => {
    const service = new AnalysisRichReportService(
      new AnalysisInsightEvidenceService(new AnalysisForecastService()),
      {
        generateRichAnalysisReport: jest.fn(async () => ({
          executiveSummary: '价值客户历史提单趋势已基于年度合同数据生成，可用于观察合同数、合同总额和有效收入变化。',
          keyFindings: [
            {
              title: '关键指标缺失，系统返回异常',
              detail:
                '关键指标字段为空，趋势事实与预测事实均提示无计算数值，表明当前查询未触发有效聚合逻辑或数据权限配置存在偏差。',
              tone: 'risk',
            },
            {
              title: '合同额年度变化',
              detail: '价值客户合同总额在已返回年份中保持可观察波动，2025 年对应金额最高。',
              tone: 'neutral',
            },
          ],
          trendNarrative: '当前结果不具备预测条件。',
          riskNarratives: ['缺少可预测数据：当前没有可计算数值。'],
          recommendationNarratives: ['建议先按年度合同额和有效收入复核价值客户经营节奏。'],
          evidenceNarrative: '上述判断基于当前返回的年度合同数、合同总额和有效收入。',
        })),
      } as never,
    );

    const baseResult = createBaseResult();
    const enriched = await service.enrich({
      ...baseResult,
      title: '价值客户历史提单趋势',
      summary: '价值客户历史提单趋势 已生成数据结果。',
      report: {
        ...baseResult.report,
        reportTitle: '价值客户历史提单趋势',
        executiveSummary: '价值客户历史提单趋势 已生成数据结果。',
        metricCards: [],
      },
      metricCards: [],
      tableRows: [
        { year_label: 2024, contract_count: 8, contract_amount: 1120, valid_income: 840 },
        { year_label: 2025, contract_count: 9, contract_amount: 1260, valid_income: 930 },
        { year_label: 2026, contract_count: 5, contract_amount: 870, valid_income: 640 },
      ],
      rowCount: 3,
    });

    const visibleReportText = [
      ...(enriched.report.keyFindings ?? []).map((item) => `${item.title} ${item.detail}`),
      enriched.report.trendInsight?.summary,
      ...(enriched.report.riskInsights ?? []).map((item) => `${item.title} ${item.detail}`),
      enriched.report.detailMarkdown,
    ].join('\n');

    expect(enriched.report.keyFindings?.some((item) => item.title === '合同额年度变化')).toBe(true);
    expect(visibleReportText).not.toContain('关键指标字段为空');
    expect(visibleReportText).not.toContain('未触发有效聚合逻辑');
    expect(visibleReportText).not.toContain('不具备预测条件');
    expect(visibleReportText).not.toContain('缺少可预测数据');
    expect(enriched.report.forecastInsight?.status).toBe('LOW_CONFIDENCE');
    expect(enriched.report.detailMarkdown).toContain('## 趋势预测');
  });

  it('读取 Markdown 快照材料时应优先使用原始用户问题', async () => {
    const aiGateway = {
      generateRichAnalysisReport: jest.fn(async () => null),
    };
    const snapshotReader = {
      readRelevantSnapshotContext: jest.fn(() => '合作伙伴、客户报备、商机、订单 Markdown 材料'),
    };
    const service = new AnalysisRichReportService(
      new AnalysisInsightEvidenceService(new AnalysisForecastService()),
      aiGateway as never,
      snapshotReader as never,
    );
    const baseResult = createBaseResult();

    await service.enrich({
      ...baseResult,
      questionText:
        '帮我查询分析下，公司当前的合作伙伴开拓情况、客户商机报备及订单情况，并且给出后续经营建议',
      title: '合同转化分析报告',
      summary: '合同转化分析报告已生成。',
      report: {
        ...baseResult.report,
        reportTitle: '合同转化分析报告',
        executiveSummary: '合同转化分析报告已生成。',
      },
    });

    expect(snapshotReader.readRelevantSnapshotContext).toHaveBeenCalledWith(
      expect.stringContaining('合作伙伴开拓情况'),
    );
    expect(snapshotReader.readRelevantSnapshotContext).toHaveBeenCalledWith(
      expect.stringContaining('合同转化分析报告'),
    );
    expect(aiGateway.generateRichAnalysisReport).toHaveBeenCalledWith(
      expect.objectContaining({
        markdownSnapshotContext: '合作伙伴、客户报备、商机、订单 Markdown 材料',
      }),
    );
  });
});

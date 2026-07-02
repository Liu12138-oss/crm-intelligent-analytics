import { richAnalysisReportPack } from '../../../src/modules/analysis/capability-packs/packs/rich-analysis-report.pack';

describe('richAnalysisReportPack', () => {
  it('真实分析报告生成应使用单次长窗口，避免短超时挤占前端等待预算', () => {
    const tuning = richAnalysisReportPack.resolveProviderTuning?.({
      providerCode: 'anthropic-claude',
      model: 'claude-sonnet-4-20250514',
    });

    expect(tuning?.requestOverrides).toMatchObject({
      maxTokens: 1400,
      timeoutMs: 50000,
      retryOnTimeout: false,
    });
  });

  it('非空结果报告提示词应要求输出方向性预测，不能继续引导不可预测口径', () => {
    const request = richAnalysisReportPack.buildStructuredRequest(
      {
        title: '季度商机健康度总览',
        summary: '新增商机金额 797.43，新增商机数 571。',
        scopeSummary: '测试范围',
        metricCards: [
          { name: '新增商机金额', value: 797.43 },
          { name: '新增商机数', value: 571 },
        ],
        rowPreview: [{ team_name: '华东区', expected_amount: 120 }],
        trendSummary: '当前基于结果快照形成方向性判断。',
        forecastSummary: '预计下一周期大概率落在 638 到 957 之间。',
        anomalySummaries: [],
        riskSummaries: [],
        recommendationSummaries: [],
      },
      {},
    );

    expect(request.prompt).toContain('必须基于已给事实输出短期方向性预测');
    expect(request.prompt).toContain('禁止把非空结果写成不可预测');
    expect(request.prompt).not.toContain('只能明确说明“当前只适合做结构观察”');
  });
});

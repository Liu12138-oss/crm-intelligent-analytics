import { AnalysisForecastService } from '../../../src/modules/analysis/analysis-forecast.service';
import { AnalysisInsightEvidenceService } from '../../../src/modules/analysis/analysis-insight-evidence.service';

describe('AnalysisInsightEvidenceService', () => {
  const service = new AnalysisInsightEvidenceService(new AnalysisForecastService());

  it('趋势数据上行时应输出趋势判断、预测结果和建议输入事实', () => {
    const evidence = service.buildEvidence({
      reportTitle: '新增商机金额趋势分析',
      variant: 'trend',
      tableRows: [
        { bucket_label: '2026-01', amount: 120, count: 2 },
        { bucket_label: '2026-02', amount: 135, count: 2 },
        { bucket_label: '2026-03', amount: 148, count: 3 },
        { bucket_label: '2026-04', amount: 162, count: 3 },
      ],
      metricCards: [{ name: '累计金额', value: '565' }],
      keyFindings: [],
    });

    expect(evidence.trendInsight.status).toBe('READY');
    expect(evidence.trendInsight.direction).toBe('UP');
    expect(evidence.forecastInsight.status).toBe('READY');
    expect(evidence.forecastInsight.metricLabel).toBe('金额');
    expect(evidence.forecastInsight.summary).toContain('预计下一周期的金额');
    expect(evidence.recommendations.length).toBeGreaterThan(0);
  });

  it('少量时间序列数据应输出低置信方向预测，不应生成样本不足或预测不可用风险', () => {
    const evidence = service.buildEvidence({
      reportTitle: '新增商机金额趋势分析',
      variant: 'trend',
      tableRows: [
        { bucket_label: '2026-03', amount: 100, count: 1 },
        { bucket_label: '2026-04', amount: 350, count: 1 },
      ],
      metricCards: [{ name: '累计金额', value: '450' }],
      keyFindings: [],
    });

    expect(evidence.forecastInsight.status).toBe('LOW_CONFIDENCE');
    expect(evidence.forecastInsight.metricLabel).toBe('金额');
    expect(evidence.forecastInsight.summary).toContain('预计下一周期的金额');
    expect(evidence.anomalyInsights.map((item) => item.title)).not.toContain('样本点偏少');
    expect(evidence.riskInsights.map((item) => item.title)).not.toContain('预测暂不可用');
  });

  it('近一周新增商机明细应输出结构判断，不应外推下一周期金额', () => {
    const evidence = service.buildEvidence({
      reportTitle: '近一周新增商机明细',
      variant: 'summary',
      templateId: 'tpl_company_weekly_new_opportunity',
      tableRows: [
        { customer_name: '客户A', project_name: '项目A', expected_amount: '15.00', stage_name: '30%有预算且最认可' },
        { customer_name: '客户B', project_name: '项目B', expected_amount: '20.00', stage_name: '10%见面且对产品感兴趣' },
        { customer_name: '客户C', project_name: '项目C', expected_amount: '4.00', stage_name: '50%控标或唯一品牌' },
      ],
      metricCards: [
        { name: '新增商机数', value: 3 },
        { name: '新增金额', value: 39 },
      ],
      keyFindings: [],
    });

    expect(evidence.trendInsight.status).toBe('READY');
    expect(evidence.forecastInsight.status).toBe('UNAVAILABLE');
    expect(evidence.forecastInsight.metricLabel).toBe('新增商机结构');
    expect(evidence.forecastInsight.summary).toContain('本模板不直接预测下一周期金额');
    expect(evidence.forecastInsight.summary).toContain('本周新增 3 条');
    expect(evidence.riskInsights.map((item) => item.title)).not.toContain('预测暂不可用');
  });

  it('团队完成预测模板应按年度完成口径输出完成率区间', () => {
    const evidence = service.buildEvidence({
      reportTitle: '2026 各团队完成预测',
      variant: 'ranking',
      templateId: 'tpl_company_2026_completion',
      tableRows: [
        {
          team_name: '大北区-北区金融部',
          annual_target: 6000,
          valid_income: 1200,
          committed_amount: 2600,
          q1_committed_amount: 100,
          q2_committed_amount: 900,
          q3_committed_amount: 800,
          q4_committed_amount: 800,
          annual_forecast: 3800,
          completion_rate: 63.33,
        },
        {
          team_name: '大南区-南区金融部',
          annual_target: 4800,
          valid_income: 1500,
          committed_amount: 1800,
          q1_committed_amount: 50,
          q2_committed_amount: 550,
          q3_committed_amount: 600,
          q4_committed_amount: 600,
          annual_forecast: 3300,
          completion_rate: 68.75,
        },
      ],
      metricCards: [
        { name: '全年目标', value: 10800 },
        { name: '当前有效收入', value: 2700 },
        { name: '全年预测', value: 7100 },
      ],
      keyFindings: [],
    });

    expect(evidence.forecastInsight.status).toBe('LOW_CONFIDENCE');
    expect(evidence.forecastInsight.horizonLabel).toBe('2026 全年');
    expect(evidence.forecastInsight.metricLabel).toBe('年度完成率');
    expect(evidence.forecastInsight.summary).toContain('年度完成率');
    expect(evidence.forecastInsight.summary).not.toContain('下一周期');
  });
});

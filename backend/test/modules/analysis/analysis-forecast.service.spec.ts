import { AnalysisForecastService } from '../../../src/modules/analysis/analysis-forecast.service';

describe('AnalysisForecastService', () => {
  const service = new AnalysisForecastService();

  it('满足四个连续时间点时应输出带指标名称的区间预测与中等以上置信等级', () => {
    const result = service.buildForecast(
      [
        { label: '2026-01', value: 120 },
        { label: '2026-02', value: 135 },
        { label: '2026-03', value: 148 },
        { label: '2026-04', value: 162 },
      ],
      '新增商机金额',
    );

    expect(result.status).toBe('READY');
    expect(result.metricLabel).toBe('新增商机金额');
    expect(result.predictedValue).toBeGreaterThan(0);
    expect(result.predictedRangeLow).toBeLessThan(result.predictedRangeHigh!);
    expect(result.confidenceLevel).toMatch(/HIGH|MEDIUM/);
    expect(result.summary).toContain('预计下一周期的新增商机金额');
  });

  it('单点数据也应输出低置信方向预测，并用大白话说明可信边界', () => {
    const result = service.buildForecast([{ label: '2026-04', value: 162 }], '预计金额');

    expect(result.status).toBe('LOW_CONFIDENCE');
    expect(result.metricLabel).toBe('预计金额');
    expect(result.predictedValue).toBeGreaterThan(0);
    expect(result.predictedRangeLow).toBeLessThan(result.predictedRangeHigh!);
    expect(result.confidenceLevel).toBe('LOW');
    expect(result.summary).toContain('预计下一周期的预计金额');
    expect(result.summary).not.toContain('不具备预测条件');
  });
});

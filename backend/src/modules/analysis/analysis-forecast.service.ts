import { Injectable } from '@nestjs/common';
import type { AnalysisForecastInsight } from '../../shared/types/domain';

interface ForecastPoint {
  label: string;
  value: number;
}

interface ForecastOptions {
  horizonLabel?: string;
}

@Injectable()
export class AnalysisForecastService {
  /**
   * 基于当前结果事实做短期区间预测。
   *
   * 参数说明：
   * - `points`：按时间或业务顺序排列的数值点；非空即可输出方向预测。
   * 返回值：连续点充足时返回 `READY`，点数较少时返回低置信方向预测。
   */
  buildForecast(
    points: ForecastPoint[],
    metricLabel = '指标值',
    options: ForecastOptions = {},
  ): AnalysisForecastInsight {
    const horizonLabel = options.horizonLabel ?? '下一周期';

    if (points.length === 0) {
      return {
        status: 'UNAVAILABLE',
        horizonLabel,
        metricLabel,
        confidenceLevel: 'LOW',
        drivers: ['当前未返回可计算数值'],
        caveats: ['当前没有可参与预测的数值结果。'],
        summary: '当前未返回可计算数值，暂无法形成预测区间。',
      };
    }

    const weightedMean = this.calculateWeightedMean(points);
    const spread = this.calculateSpread(points, weightedMean);
    const ratio = spread / Math.max(weightedMean, 1);
    const hasSufficientSeries = points.length >= 4;
    const rangeLow = this.roundNumber(Math.max(0, weightedMean - spread));
    const rangeHigh = this.roundNumber(weightedMean + spread);

    return {
      status: hasSufficientSeries && ratio <= 0.25 ? 'READY' : 'LOW_CONFIDENCE',
      horizonLabel,
      metricLabel,
      predictedValue: this.roundNumber(weightedMean),
      predictedRangeLow: rangeLow,
      predictedRangeHigh: rangeHigh,
      confidenceLevel: hasSufficientSeries ? (ratio < 0.15 ? 'HIGH' : ratio < 0.3 ? 'MEDIUM' : 'LOW') : 'LOW',
      drivers: hasSufficientSeries
        ? ['连续结果趋势延续', '最新一期权重更高']
        : ['当前结果规模', '明细金额分布', '业务阶段结构'],
      caveats: hasSufficientSeries
        ? ['该预测基于当前结果事实做短期区间推断。']
        : ['不是确定结论，只基于当前已返回数据做粗略估计；请结合下一周期真实数据复核。'],
      summary: `预计${horizonLabel}的${metricLabel}大概率在 ${formatForecastNumber(rangeLow)} 到 ${formatForecastNumber(rangeHigh)} 之间。`,
    };
  }

  /**
   * 计算按最新点加权的均值，让最近结果对预测影响更大。
   *
   * 参数说明：`points` 为时间序列点。
   * 返回值：加权平均值。
   */
  private calculateWeightedMean(points: ForecastPoint[]): number {
    const totalWeight = points.reduce((sum, _item, index) => sum + index + 1, 0);
    const weightedSum = points.reduce((sum, item, index) => sum + item.value * (index + 1), 0);
    return weightedSum / Math.max(totalWeight, 1);
  }

  /**
   * 计算预测区间宽度，优先考虑序列标准差与最新两期变化幅度。
   *
   * 参数说明：
   * - `points`：时间序列点。
   * - `mean`：序列中心值。
   * 返回值：预测区间半宽。
   */
  private calculateSpread(points: ForecastPoint[], mean: number): number {
    const variance =
      points.reduce((sum, item) => sum + (item.value - mean) ** 2, 0) / Math.max(points.length, 1);
    const standardDeviation = Math.sqrt(variance);
    const latestDelta =
      points.length > 1
        ? Math.abs(points[points.length - 1].value - points[points.length - 2].value)
        : 0;
    const minimumSpreadRatio = points.length >= 4 ? 0.05 : 0.2;
    return Math.max(standardDeviation, latestDelta * 0.8, mean * minimumSpreadRatio, 1);
  }

  /**
   * 统一把预测数值收敛到两位小数，避免把浮点细碎误差暴露到报告层。
   *
   * 参数说明：`value` 为待收敛数值。
   * 返回值：保留两位小数后的数值。
   */
  private roundNumber(value: number): number {
    return Number(value.toFixed(2));
  }
}

function formatForecastNumber(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString('zh-CN')
    : value.toLocaleString('zh-CN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
}

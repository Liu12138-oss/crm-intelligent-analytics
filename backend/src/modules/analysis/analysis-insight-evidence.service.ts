import { Injectable } from '@nestjs/common';
import type {
  AnalysisForecastInsight,
  AnalysisInsightItem,
  AnalysisKeyFinding,
  AnalysisRecommendationItem,
  AnalysisReportPayload,
  AnalysisTrendInsight,
  MetricCard,
} from '../../shared/types/domain';
import { AnalysisForecastService } from './analysis-forecast.service';

interface EvidenceInput {
  reportTitle: string;
  variant: AnalysisReportPayload['variant'];
  templateId?: string;
  tableRows: Array<Record<string, unknown>>;
  metricCards: MetricCard[];
  keyFindings: AnalysisKeyFinding[];
}

interface EvidenceOutput {
  trendInsight: AnalysisTrendInsight;
  forecastInsight: AnalysisForecastInsight;
  anomalyInsights: AnalysisInsightItem[];
  riskInsights: AnalysisInsightItem[];
  recommendations: AnalysisRecommendationItem[];
}

type TemplateForecastStrategy =
  | 'GENERIC'
  | 'MONTHLY_OPPORTUNITY'
  | 'WEEKLY_OPPORTUNITY_DETAIL'
  | 'YEAR_COMPLETION_SNAPSHOT'
  | 'TEAM_COMPLETION_FORECAST'
  | 'CONTRACT_INCOME_TREND'
  | 'HIGH_PROBABILITY_OPPORTUNITY_TREND'
  | 'COMMITTED_OPPORTUNITY_QUARTER'
  | 'VALUABLE_CUSTOMER_CONTRACT_HISTORY'
  | 'CUSTOMER_CONTRACT_DIMENSION';

interface ForecastContext {
  strategy: TemplateForecastStrategy;
  points: Array<{ label: string; value: number }>;
  metricLabel: string;
  horizonLabel: string;
}

@Injectable()
export class AnalysisInsightEvidenceService {
  constructor(private readonly analysisForecastService: AnalysisForecastService) {}

  /**
   * 基于统一结果包提炼趋势、预测、异常、风险和建议输入事实。
   *
   * 参数说明：
   * - `reportTitle`：当前报告标题，用于补足解释上下文。
   * - `variant`：当前主报告类型。
   * - `tableRows`：统一明细行。
   * - `metricCards`：统一指标卡。
   * - `keyFindings`：已有关键发现，可作为建议补充线索。
   * 返回值：供 richer report 与 AI 洞察编排复用的结构化事实包。
   */
  buildEvidence(input: EvidenceInput): EvidenceOutput {
    const forecastContext = this.resolveForecastContext(input);
    const trendPoints = forecastContext.points;
    const trendInsight = this.buildTrendInsight(trendPoints, input.reportTitle);
    const forecastInsight = this.buildForecastInsight(input, forecastContext);
    const anomalyInsights = this.buildAnomalyInsights(trendPoints);
    const riskInsights = this.buildRiskInsights(trendPoints, forecastInsight, forecastContext);
    const recommendations = this.buildRecommendations({
      trendInsight,
      forecastInsight,
      anomalyInsights,
      riskInsights,
      keyFindings: input.keyFindings,
    });

    return {
      trendInsight,
      forecastInsight,
      anomalyInsights,
      riskInsights,
      recommendations,
    };
  }

  /**
   * 解析模板预测策略，避免把团队、客户、项目等横截面结果误当成时间序列。
   *
   * 参数说明：`input` 包含模板编号、标题、结果行和指标卡。
   * 返回值：模板对应的预测策略、可比较数值点、指标名称和预测周期。
   */
  private resolveForecastContext(input: EvidenceInput): ForecastContext {
    const strategy = this.resolveTemplateStrategy(input.templateId, input.reportTitle);
    switch (strategy) {
      case 'MONTHLY_OPPORTUNITY':
        return {
          strategy,
          points: this.extractMonthlyOpportunityPoints(input.tableRows),
          metricLabel: '新增商机金额',
          horizonLabel: '下一月',
        };
      case 'CONTRACT_INCOME_TREND':
        return {
          strategy,
          points: this.extractMetricSeries(input.tableRows, 'quarter_label', 'valid_income'),
          metricLabel: '有效收入',
          horizonLabel: '下一季度',
        };
      case 'HIGH_PROBABILITY_OPPORTUNITY_TREND':
        return {
          strategy,
          points: this.extractMetricSeries(input.tableRows, 'quarter_label', 'opportunity_amount'),
          metricLabel: '10%+ 新增商机金额',
          horizonLabel: '下一季度',
        };
      case 'VALUABLE_CUSTOMER_CONTRACT_HISTORY':
        return {
          strategy,
          points: this.extractMetricSeries(input.tableRows, 'year_label', 'contract_amount'),
          metricLabel: '价值客户提单金额',
          horizonLabel: '下一年度',
        };
      case 'WEEKLY_OPPORTUNITY_DETAIL':
        return {
          strategy,
          points: this.extractDetailStructurePoints(input.tableRows),
          metricLabel: '新增商机结构',
          horizonLabel: '下一周',
        };
      case 'YEAR_COMPLETION_SNAPSHOT':
      case 'TEAM_COMPLETION_FORECAST':
      case 'COMMITTED_OPPORTUNITY_QUARTER':
      case 'CUSTOMER_CONTRACT_DIMENSION':
        return {
          strategy,
          points: this.extractAggregateStructurePoints(input.tableRows, input.metricCards),
          metricLabel: this.resolveForecastMetricLabel(input.tableRows, input.metricCards),
          horizonLabel: '2026 全年',
        };
      case 'GENERIC':
      default:
        return {
          strategy: 'GENERIC',
          points: this.extractTrendPoints(input.tableRows, input.metricCards),
          metricLabel: this.resolveForecastMetricLabel(input.tableRows, input.metricCards),
          horizonLabel: '下一周期',
        };
    }
  }

  /**
   * 根据模板编号和标题选择预测策略。
   *
   * 参数说明：
   * - `templateId`：模板执行链路写入的固定模板编号。
   * - `reportTitle`：自由问数或旧数据的标题兜底。
   * 返回值：模板预测策略。
   */
  private resolveTemplateStrategy(
    templateId: string | undefined,
    reportTitle: string,
  ): TemplateForecastStrategy {
    const key = templateId || reportTitle;
    if (key.includes('tpl_company_quarterly_opportunity_health') || reportTitle.includes('新增商机月度分布')) {
      return 'MONTHLY_OPPORTUNITY';
    }
    if (key.includes('tpl_company_weekly_new_opportunity') || reportTitle.includes('近一周新增商机明细')) {
      return 'WEEKLY_OPPORTUNITY_DETAIL';
    }
    if (key.includes('tpl_company_year_completion_snapshot') || reportTitle.includes('全年完成预测总览')) {
      return 'YEAR_COMPLETION_SNAPSHOT';
    }
    if (key.includes('tpl_company_2026_completion') || reportTitle.includes('各团队完成预测')) {
      return 'TEAM_COMPLETION_FORECAST';
    }
    if (key.includes('tpl_company_contract_effective_income_trend') || reportTitle.includes('提单合同与有效收入趋势')) {
      return 'CONTRACT_INCOME_TREND';
    }
    if (key.includes('tpl_company_ten_percent_opportunity_trend') || reportTitle.includes('10%')) {
      return 'HIGH_PROBABILITY_OPPORTUNITY_TREND';
    }
    if (key.includes('tpl_company_committed_opportunity_summary') || reportTitle.includes('承诺商机季度拆分')) {
      return 'COMMITTED_OPPORTUNITY_QUARTER';
    }
    if (key.includes('tpl_company_valuable_customer_contract_history') || reportTitle.includes('价值客户历史提单趋势')) {
      return 'VALUABLE_CUSTOMER_CONTRACT_HISTORY';
    }
    if (key.includes('tpl_company_customer_contract_dimension') || reportTitle.includes('客户维度提单数据')) {
      return 'CUSTOMER_CONTRACT_DIMENSION';
    }
    return 'GENERIC';
  }

  /**
   * 按模板策略生成预测事实，确保明细和横截面模板不会输出误导性的下一周期金额。
   */
  private buildForecastInsight(
    input: EvidenceInput,
    context: ForecastContext,
  ): AnalysisForecastInsight {
    switch (context.strategy) {
      case 'WEEKLY_OPPORTUNITY_DETAIL':
        return this.buildWeeklyDetailForecast(input.tableRows);
      case 'YEAR_COMPLETION_SNAPSHOT':
        return this.buildAnnualCompletionForecast(input.tableRows);
      case 'TEAM_COMPLETION_FORECAST':
        return this.buildTeamCompletionForecast(input.tableRows);
      case 'COMMITTED_OPPORTUNITY_QUARTER':
        return this.buildCommittedOpportunityForecast(input.tableRows);
      case 'CUSTOMER_CONTRACT_DIMENSION':
        return this.buildCustomerContractPotentialForecast(input.tableRows);
      case 'MONTHLY_OPPORTUNITY':
      case 'CONTRACT_INCOME_TREND':
      case 'HIGH_PROBABILITY_OPPORTUNITY_TREND':
      case 'VALUABLE_CUSTOMER_CONTRACT_HISTORY':
      case 'GENERIC':
      default:
        return this.analysisForecastService.buildForecast(context.points, context.metricLabel, {
          horizonLabel: context.horizonLabel,
        });
    }
  }

  /**
   * 从统一明细行中抽取趋势点，优先读取金额字段并保留时间标签。
   *
   * 参数说明：`rows` 为统一明细行。
   * 返回值：可供趋势与预测计算的时间点数组。
   */
  private extractTrendPoints(
    rows: Array<Record<string, unknown>>,
    metricCards: MetricCard[],
  ): Array<{ label: string; value: number }> {
    const rowPoints = rows
      .map((row) => ({
        label: String(
          row.year_label ??
            row.yearLabel ??
            row.quarter_label ??
            row.quarterLabel ??
            row.month_label ??
            row.monthLabel ??
            row.bucket_label ??
            row.bucketLabel ??
            row.label ??
            row.team_name ??
            row.teamName ??
            row.customer_name ??
            row.project_name ??
            row.ownerName ??
            '--',
        ),
        value: this.toNumber(
          row.expected_amount ??
            row.amount ??
            row.contract_amount ??
            row.annual_forecast ??
            row.valid_income ??
            row.committed_amount ??
            row.total_amount ??
            row.value ??
            row.count,
        ),
      }))
      .filter((item) => item.label !== '--' && Number.isFinite(item.value) && item.value > 0);

    if (rowPoints.length > 0) {
      return rowPoints;
    }

    return metricCards
      .map((metric) => ({
        label: metric.name,
        value: this.toNumber(metric.value),
      }))
      .filter((item) => item.label.trim() && Number.isFinite(item.value) && item.value > 0);
  }

  /**
   * 从团队月度矩阵中汇总公司级月度新增商机金额序列。
   */
  private extractMonthlyOpportunityPoints(rows: Array<Record<string, unknown>>): Array<{ label: string; value: number }> {
    const monthKeys = [
      ['jan_amount', '1月'],
      ['feb_amount', '2月'],
      ['mar_amount', '3月'],
      ['apr_amount', '4月'],
      ['may_amount', '5月'],
      ['jun_amount', '6月'],
      ['jul_amount', '7月'],
      ['aug_amount', '8月'],
      ['sep_amount', '9月'],
      ['oct_amount', '10月'],
      ['nov_amount', '11月'],
      ['dec_amount', '12月'],
    ] as const;

    return monthKeys
      .map(([key, label]) => ({
        label,
        value: rows.reduce((sum, row) => sum + this.toNumber(row[key]), 0),
      }))
      .filter((item) => item.value > 0);
  }

  /**
   * 从标准时间字段和指标字段中抽取连续趋势点。
   */
  private extractMetricSeries(
    rows: Array<Record<string, unknown>>,
    labelKey: string,
    metricKey: string,
  ): Array<{ label: string; value: number }> {
    return rows
      .map((row) => ({
        label: String(row[labelKey] ?? '--'),
        value: this.toNumber(row[metricKey]),
      }))
      .filter((item) => item.label !== '--' && item.value > 0);
  }

  /**
   * 明细模板只提取结构判断点，不把每条项目金额当作时间序列预测输入。
   */
  private extractDetailStructurePoints(rows: Array<Record<string, unknown>>): Array<{ label: string; value: number }> {
    const totalAmount = rows.reduce((sum, row) => sum + this.toNumber(row.expected_amount), 0);
    const highStageAmount = rows
      .filter((row) => /50%|70%|90%|控标|唯一|承诺/u.test(String(row.stage_name ?? '')))
      .reduce((sum, row) => sum + this.toNumber(row.expected_amount), 0);
    return [
      { label: '新增商机数', value: rows.length },
      { label: '新增金额', value: totalAmount },
      { label: '高阶段金额', value: highStageAmount },
    ].filter((item) => item.value > 0);
  }

  /**
   * 横截面模板只保留结构规模点，供趋势区块表达“结构判断”，不直接外推下一期。
   */
  private extractAggregateStructurePoints(
    rows: Array<Record<string, unknown>>,
    metricCards: MetricCard[],
  ): Array<{ label: string; value: number }> {
    const metricPoints = metricCards
      .map((metric) => ({
        label: metric.name,
        value: this.toNumber(metric.value),
      }))
      .filter((item) => item.value > 0);
    if (metricPoints.length > 0) {
      return metricPoints;
    }

    return rows
      .map((row) => ({
        label: String(row.team_name ?? row.customer_name ?? row.department_name ?? '--'),
        value: this.toNumber(
          row.annual_forecast ??
            row.committed_amount ??
            row.contract_amount ??
            row.valid_income ??
            row.total_amount,
        ),
      }))
      .filter((item) => item.label !== '--' && item.value > 0);
  }

  /**
   * 推导预测数值对应的业务指标，避免报告只给数值区间却不说明预测对象。
   *
   * 参数说明：
   * - `rows`：统一明细行，用于识别实际参与预测的金额或数量字段。
   * - `metricCards`：指标卡兜底来源。
   * 返回值：面向业务用户的指标名称。
   */
  private resolveForecastMetricLabel(
    rows: Array<Record<string, unknown>>,
    metricCards: MetricCard[],
  ): string {
    const rowMetricCandidates: Array<{ key: string; label: string }> = [
      { key: 'expected_amount', label: '预计金额' },
      { key: 'amount', label: '金额' },
      { key: 'contract_amount', label: '合同金额' },
      { key: 'contract_count', label: '合同数' },
      { key: 'annual_forecast', label: '全年预测' },
      { key: 'valid_income', label: '有效收入' },
      { key: 'committed_amount', label: '承诺商机金额' },
      { key: 'total_amount', label: '总金额' },
      { key: 'value', label: metricCards[0]?.name ? String(metricCards[0].name) : '指标值' },
      { key: 'count', label: metricCards.find((item) => item.name.includes('数'))?.name ?? '记录数' },
    ];

    for (const row of rows) {
      for (const candidate of rowMetricCandidates) {
        if (this.toNumber(row[candidate.key]) > 0) {
          return candidate.label;
        }
      }
    }

    return metricCards.find((item) => this.toNumber(item.value) > 0)?.name ?? '指标值';
  }

  /**
   * 近一周新增商机明细只输出结构判断，不输出下一周金额区间。
   */
  private buildWeeklyDetailForecast(rows: Array<Record<string, unknown>>): AnalysisForecastInsight {
    const totalCount = rows.length;
    const totalAmount = rows.reduce((sum, row) => sum + this.toNumber(row.expected_amount), 0);
    const highStageCount = rows.filter((row) => /50%|70%|90%|控标|唯一|承诺/u.test(String(row.stage_name ?? ''))).length;

    return {
      status: 'UNAVAILABLE',
      horizonLabel: '下一周',
      metricLabel: '新增商机结构',
      confidenceLevel: 'MEDIUM',
      drivers: ['近一周新增明细', '销售阶段结构', '预计金额分布'],
      caveats: ['当前模板返回的是近一周明细，不包含连续周度历史，因此不直接预测下一周期金额。'],
      summary: `本模板不直接预测下一周期金额；本周新增 ${totalCount} 条，金额合计 ${this.formatNumber(totalAmount)}，其中高阶段商机 ${highStageCount} 条，适合用于安排优先跟进和复核。`,
    };
  }

  /**
   * 全年完成总览按“已确认收入 + 承诺商机折算”生成年度完成金额区间。
   */
  private buildAnnualCompletionForecast(rows: Array<Record<string, unknown>>): AnalysisForecastInsight {
    const row = rows[0] ?? {};
    const validIncome = this.toNumber(row.valid_income);
    const baseCommitted = this.calculateWeightedCommittedAmount(row, {
      q1: 0.85,
      q2: 0.75,
      q3: 0.65,
      q4: 0.6,
    });
    const lowCommitted = this.calculateWeightedCommittedAmount(row, {
      q1: 0.6,
      q2: 0.55,
      q3: 0.45,
      q4: 0.4,
    });
    const highCommitted = this.calculateWeightedCommittedAmount(row, {
      q1: 0.95,
      q2: 0.9,
      q3: 0.8,
      q4: 0.75,
    });

    return {
      status: 'LOW_CONFIDENCE',
      horizonLabel: `${row.year_label ?? '本年'} 全年`,
      metricLabel: '年度完成金额',
      predictedValue: this.roundNumber(validIncome + baseCommitted),
      predictedRangeLow: this.roundNumber(validIncome + lowCommitted),
      predictedRangeHigh: this.roundNumber(validIncome + highCommitted),
      confidenceLevel: 'MEDIUM',
      drivers: ['当前有效收入', '承诺商机季度分布', '承诺商机兑现折算'],
      caveats: ['该结果是年度完成测算，不是下一周期外推；承诺商机仍需结合最新阶段和负责人反馈复核。'],
      summary: `按当前有效收入和承诺商机折算，预计年度完成金额约在 ${this.formatNumber(validIncome + lowCommitted)} 到 ${this.formatNumber(validIncome + highCommitted)} 之间，基准值约 ${this.formatNumber(validIncome + baseCommitted)}。`,
    };
  }

  /**
   * 团队完成预测按目标加权汇总，输出年度完成率区间。
   */
  private buildTeamCompletionForecast(rows: Array<Record<string, unknown>>): AnalysisForecastInsight {
    const totalTarget = rows.reduce((sum, row) => sum + this.toNumber(row.annual_target), 0);
    const lowAmount = rows.reduce((sum, row) => sum + this.toNumber(row.valid_income) + this.calculateWeightedCommittedAmount(row, {
      q1: 0.6,
      q2: 0.55,
      q3: 0.45,
      q4: 0.4,
    }), 0);
    const baseAmount = rows.reduce((sum, row) => sum + this.toNumber(row.valid_income) + this.calculateWeightedCommittedAmount(row, {
      q1: 0.85,
      q2: 0.75,
      q3: 0.65,
      q4: 0.6,
    }), 0);
    const highAmount = rows.reduce((sum, row) => sum + this.toNumber(row.valid_income) + this.calculateWeightedCommittedAmount(row, {
      q1: 0.95,
      q2: 0.9,
      q3: 0.8,
      q4: 0.75,
    }), 0);
    const lowRate = totalTarget > 0 ? (lowAmount / totalTarget) * 100 : 0;
    const baseRate = totalTarget > 0 ? (baseAmount / totalTarget) * 100 : 0;
    const highRate = totalTarget > 0 ? (highAmount / totalTarget) * 100 : 0;

    return {
      status: 'LOW_CONFIDENCE',
      horizonLabel: '2026 全年',
      metricLabel: '年度完成率',
      predictedValue: this.roundNumber(baseRate),
      predictedRangeLow: this.roundNumber(lowRate),
      predictedRangeHigh: this.roundNumber(highRate),
      confidenceLevel: 'MEDIUM',
      drivers: ['团队年度目标', '当前有效收入', '承诺商机季度兑现权重'],
      caveats: ['该预测按团队目标加权汇总，适合判断年度达成压力，不代表下一周期金额。'],
      summary: `按当前有效收入和承诺商机季度折算，预计年度完成率约在 ${this.formatNumber(lowRate)}% 到 ${this.formatNumber(highRate)}% 之间，基准值约 ${this.formatNumber(baseRate)}%。`,
    };
  }

  /**
   * 承诺商机季度拆分按季度兑现权重估算本年可落地金额。
   */
  private buildCommittedOpportunityForecast(rows: Array<Record<string, unknown>>): AnalysisForecastInsight {
    const lowAmount = rows.reduce((sum, row) => sum + this.calculateWeightedCommittedAmount(row, {
      q1: 0.6,
      q2: 0.55,
      q3: 0.45,
      q4: 0.4,
    }), 0);
    const baseAmount = rows.reduce((sum, row) => sum + this.calculateWeightedCommittedAmount(row, {
      q1: 0.85,
      q2: 0.75,
      q3: 0.65,
      q4: 0.6,
    }), 0);
    const highAmount = rows.reduce((sum, row) => sum + this.calculateWeightedCommittedAmount(row, {
      q1: 0.95,
      q2: 0.9,
      q3: 0.8,
      q4: 0.75,
    }), 0);

    return {
      status: 'LOW_CONFIDENCE',
      horizonLabel: '2026 全年',
      metricLabel: '承诺商机可落地金额',
      predictedValue: this.roundNumber(baseAmount),
      predictedRangeLow: this.roundNumber(lowAmount),
      predictedRangeHigh: this.roundNumber(highAmount),
      confidenceLevel: 'MEDIUM',
      drivers: ['承诺商机金额', '预计签单季度拆分', '季度兑现权重'],
      caveats: ['承诺商机仍受阶段推进、客户采购节奏和签约确认影响，需持续复核。'],
      summary: `按季度兑现权重估算，本年承诺商机可落地金额约在 ${this.formatNumber(lowAmount)} 到 ${this.formatNumber(highAmount)} 之间，基准值约 ${this.formatNumber(baseAmount)}。`,
    };
  }

  /**
   * 客户维度模板按客户历史金额估算 2026 全年潜力，不按客户行预测下一周期。
   */
  private buildCustomerContractPotentialForecast(rows: Array<Record<string, unknown>>): AnalysisForecastInsight {
    const potentialAmount = rows.reduce((sum, row) => {
      const amount2026 = this.toNumber(row.amount_2026);
      const amount2025 = this.toNumber(row.amount_2025);
      const historyAverage =
        [row.amount_2023, row.amount_2024, row.amount_2025]
          .map((value) => this.toNumber(value))
          .filter((value) => value > 0)
          .reduce((total, value, _index, values) => total + value / Math.max(values.length, 1), 0);
      return sum + amount2026 * 0.5 + amount2025 * 0.3 + historyAverage * 0.2;
    }, 0);

    return {
      status: potentialAmount > 0 ? 'LOW_CONFIDENCE' : 'UNAVAILABLE',
      horizonLabel: '2026 全年',
      metricLabel: '2026 全年客户提单潜力',
      predictedValue: this.roundNumber(potentialAmount),
      predictedRangeLow: this.roundNumber(potentialAmount * 0.8),
      predictedRangeHigh: this.roundNumber(potentialAmount * 1.2),
      confidenceLevel: potentialAmount > 0 ? 'MEDIUM' : 'LOW',
      drivers: ['客户 2026 已发生金额', '上一年提单金额', '近三年历史均值'],
      caveats: ['客户维度结果是横截面分析，金额区间用于识别客户贡献潜力，不代表下一周期预测。'],
      summary:
        potentialAmount > 0
          ? `按客户历史提单和 2026 已发生金额估算，2026 全年客户提单潜力约在 ${this.formatNumber(potentialAmount * 0.8)} 到 ${this.formatNumber(potentialAmount * 1.2)} 之间。`
          : '当前客户维度结果缺少可用于估算 2026 全年潜力的历史金额。',
    };
  }

  /**
   * 生成趋势判断，用于支撑 richer report 的趋势区块和 AI 解释输入。
   *
   * 参数说明：
   * - `points`：按时间顺序排列的趋势点。
   * - `reportTitle`：当前报告标题。
   * 返回值：趋势方向、峰谷和驱动摘要。
   */
  private buildTrendInsight(
    points: Array<{ label: string; value: number }>,
    reportTitle: string,
  ): AnalysisTrendInsight {
    if (points.length < 2) {
      const onlyPoint = points[0];
      if (onlyPoint) {
        return {
          status: 'READY',
          direction: 'FLAT',
          changeValue: 0,
          changeRate: 0,
          peakLabel: onlyPoint.label,
          troughLabel: onlyPoint.label,
          volatilityLevel: 'LOW',
          drivers: ['当前结果规模', '业务结构分布'],
          summary: `${reportTitle} 已基于当前结果形成方向性判断：当前规模为 ${this.formatNumber(onlyPoint.value)}，短期应围绕现有规模、重点对象和阶段结构安排跟进。`,
        };
      }

      return {
        status: 'UNAVAILABLE',
        drivers: [],
        summary: `${reportTitle} 当前没有可计算数值，暂时无法形成趋势判断。`,
      };
    }

    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const peakPoint = points.reduce((best, current) => (current.value > best.value ? current : best), points[0]);
    const troughPoint = points.reduce((best, current) => (current.value < best.value ? current : best), points[0]);
    const changeValue = lastPoint.value - firstPoint.value;
    const changeRate = firstPoint.value === 0 ? 0 : changeValue / firstPoint.value;
    const absoluteRate = Math.abs(changeRate);

    return {
      status: 'READY',
      direction:
        absoluteRate < 0.03 ? 'FLAT' : changeValue > 0 ? 'UP' : changeValue < 0 ? 'DOWN' : 'FLAT',
      changeValue: this.roundNumber(changeValue),
      changeRate: this.roundNumber(changeRate),
      peakLabel: peakPoint.label,
      troughLabel: troughPoint.label,
      volatilityLevel: absoluteRate > 0.35 ? 'HIGH' : absoluteRate > 0.15 ? 'MEDIUM' : 'LOW',
      drivers: ['时间序列首尾变化', '峰值与谷值位置'],
      summary:
        changeValue >= 0
        ? `${reportTitle} 当前结果呈上行或高位延续特征，峰值出现在 ${peakPoint.label}。`
        : `${reportTitle} 当前结果呈回落或低位波动特征，低点出现在 ${troughPoint.label}。`,
    };
  }

  /**
   * 识别趋势中的异常波动或样本不足告警。
   *
   * 参数说明：`points` 为趋势点。
   * 返回值：异常洞察列表。
   */
  private buildAnomalyInsights(
    points: Array<{ label: string; value: number }>,
  ): AnalysisInsightItem[] {
    const anomalies: AnalysisInsightItem[] = [];
    if (points.length < 3) {
      return anomalies;
    }

    const deltas = points.slice(1).map((point, index) => Math.abs(point.value - points[index].value));
    const averageDelta = deltas.reduce((sum, value) => sum + value, 0) / Math.max(deltas.length, 1);
    const latestDelta = deltas[deltas.length - 1] ?? 0;

    if (averageDelta > 0 && latestDelta >= averageDelta * 1.8) {
      anomalies.push({
        type: 'SHARP_CHANGE',
        title: '最近一期波动异常',
        detail: `${points[points.length - 1].label} 相比上一期波动明显放大，建议结合业务事件复核。`,
        severity: 'HIGH',
      });
    }

    return anomalies;
  }

  /**
   * 生成经营风险与结果风险提示，确保预测降级原因可见。
   *
   * 参数说明：
   * - `points`：趋势点。
   * - `forecastInsight`：预测结果。
   * 返回值：风险洞察列表。
   */
  private buildRiskInsights(
    points: Array<{ label: string; value: number }>,
    forecastInsight: AnalysisForecastInsight,
    forecastContext: ForecastContext,
  ): AnalysisInsightItem[] {
    const risks: AnalysisInsightItem[] = [];
    if (
      forecastInsight.status === 'UNAVAILABLE' &&
      points.length === 0 &&
      forecastContext.strategy === 'GENERIC'
    ) {
      risks.push({
        riskType: 'RESULT_RISK',
        title: '缺少可预测数据',
        detail: '当前没有可计算数值，需先确认查询条件或权限范围是否返回有效结果。',
        severity: 'MEDIUM',
      });
    }

    if (points.length >= 2 && points[points.length - 1].value < points[0].value) {
      risks.push({
        riskType: 'BUSINESS_RISK',
        title: '当前趋势存在下滑风险',
        detail: '最近一期指标低于首期水平，建议关注商机推进质量与转化节奏。',
        severity: 'MEDIUM',
      });
    }

    return risks;
  }

  /**
   * 基于趋势、预测和风险事实生成动作建议输入事实。
   *
   * 参数说明：包含趋势、预测、异常、风险和关键发现。
   * 返回值：优先级化的建议列表。
   */
  private buildRecommendations(params: {
    trendInsight: AnalysisTrendInsight;
    forecastInsight: AnalysisForecastInsight;
    anomalyInsights: AnalysisInsightItem[];
    riskInsights: AnalysisInsightItem[];
    keyFindings: AnalysisKeyFinding[];
  }): AnalysisRecommendationItem[] {
    const recommendations: AnalysisRecommendationItem[] = [];

    if (params.anomalyInsights.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        title: '优先复核异常波动来源',
        action: '结合业务事件、项目推进状态和口径变化排查最近一期异常波动。',
        reason: params.anomalyInsights[0]?.detail ?? '最近一期波动异常。',
        evidenceKeys: ['anomaly-latest-change'],
      });
    }

    if (params.forecastInsight.status === 'READY' || params.forecastInsight.status === 'LOW_CONFIDENCE') {
      recommendations.push({
        priority: 'MEDIUM',
        title: '围绕短期预测提前配置资源',
        action: '根据短期预测区间预排跟进节奏，并在下一周期开始前复核关键商机推进状态。',
        reason: params.forecastInsight.summary,
        evidenceKeys: ['forecast-range'],
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'LOW',
        title: '持续观察当前趋势',
        action: '保持当前观察节奏，并在下一个周期更新趋势与风险判断。',
        reason: params.trendInsight.summary,
        evidenceKeys: ['trend-summary'],
      });
    }

    return recommendations;
  }

  /**
   * 把字符串或未知数值统一转成 number，避免事实计算阶段反复写兼容逻辑。
   *
   * 参数说明：`value` 为原始数值。
   * 返回值：可参与计算的数值。
   */
  private toNumber(value: unknown): number {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value.replace(/,/gu, ''));
      return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
  }

  /**
   * 统一收敛趋势计算中的浮点结果，避免直接把长小数暴露到上层报告。
   *
   * 参数说明：`value` 为待收敛数值。
   * 返回值：保留四位小数后的数值。
   */
  private roundNumber(value: number): number {
    return Number(value.toFixed(4));
  }

  /**
   * 按季度兑现权重计算承诺商机折算金额。
   */
  private calculateWeightedCommittedAmount(
    row: Record<string, unknown>,
    weights: { q1: number; q2: number; q3: number; q4: number },
  ): number {
    const quarterlyAmount =
      this.toNumber(row.q1_committed_amount) * weights.q1 +
      this.toNumber(row.q2_committed_amount) * weights.q2 +
      this.toNumber(row.q3_committed_amount) * weights.q3 +
      this.toNumber(row.q4_committed_amount) * weights.q4;
    if (quarterlyAmount > 0) {
      return quarterlyAmount;
    }

    return this.toNumber(row.committed_amount) * 0.7;
  }

  private formatNumber(value: number): string {
    return Number.isInteger(value)
      ? value.toLocaleString('zh-CN')
      : value.toLocaleString('zh-CN', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        });
  }
}

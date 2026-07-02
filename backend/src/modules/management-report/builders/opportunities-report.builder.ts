import type { ManagementReportQueryService } from '../management-report-query.service';
import { createEmptyPreviewBlock } from '../management-report.types';
import type { ManagementReportContext, ManagementReportSectionData } from '../management-report.types';

/**
 * 组装商机专题，优先补齐旧报表里最有经营价值的十类分析块。
 */
export function buildOpportunitiesReport(
  queryService: ManagementReportQueryService,
  context: ManagementReportContext,
): ManagementReportSectionData {
  const opportunities = queryService.listOpportunitiesInPeriod(context);
  const openOpportunities = queryService.listOpenOpportunitiesByEndDate(context);
  const monthlySummaryMap = new Map<string, { count: number; amount: number }>();
  for (const opportunity of opportunities) {
    const monthLabel = (opportunity.getTime ?? opportunity.createdAt).slice(0, 7);
    const current = monthlySummaryMap.get(monthLabel) ?? { count: 0, amount: 0 };
    current.count += 1;
    current.amount += opportunity.amount;
    monthlySummaryMap.set(monthLabel, current);
  }
  const monthlySummaryRows = Array.from(monthlySummaryMap.entries())
    .map(([monthLabel, summary]) => ({
      monthLabel,
      count: summary.count,
      amount: summary.amount,
    }))
    .sort((left, right) => left.monthLabel.localeCompare(right.monthLabel));
  const monthlyCount = monthlySummaryRows.map((item) => ({
    label: item.monthLabel,
    value: item.count,
  }));
  const stageAmount = queryService.groupSumBy(openOpportunities, (item) => item.stage, (item) => item.amount);
  const stageCount = queryService.groupCountBy(openOpportunities, (item) => item.stage);
  const ownerAmount = queryService.groupSumBy(openOpportunities, (item) => item.ownerName, (item) => item.amount);
  const ownerStageLabels = [...new Set(openOpportunities.map((item) => item.stage))];
  const signMonthLabels = [...new Set(openOpportunities.map((item) => (item.expectSignDate ?? '--').slice(0, 7)))];
  const riskOpportunities = queryService.listRiskOpportunities(context);

  return {
    sectionKey: 'opportunities',
    title: '商机',
    summary: '商机专题补齐趋势、阶段、负责人、签单月份和风险对象，形成真正可管理的盘子。',
    metricKeys: ['opportunityAmount', 'riskOpportunityCount'],
    blocks: [
      {
        blockId: 'opportunity-monthly-count',
        blockType: 'trend',
        title: '近 18 个月新增商机数趋势',
        size: 'wide',
        points: monthlyCount,
        unitLabel: '个',
      },
      {
        blockId: 'opportunity-monthly-amount-breakdown',
        blockType: 'detail-table',
        title: '月度新增金额拆解',
        size: 'wide',
        columns: [
          { key: 'monthLabel', label: '月份' },
          { key: 'count', label: '新增商机数' },
          { key: 'amount', label: '新增商机金额' },
          { key: 'averageAmount', label: '单笔均额' },
        ],
        rows: monthlySummaryRows.map((item) => ({
          monthLabel: item.monthLabel,
          count: String(item.count),
          amount: queryService.formatCurrency(item.amount),
          averageAmount: queryService.formatCurrency(item.amount / item.count),
        })),
      },
      {
        blockId: 'opportunity-pool-summary',
        blockType: 'metric-strip',
        title: '在手盘子摘要',
        size: 'full',
        layoutHint: 'metric-row',
        items: [
          { label: '在手商机数', value: String(openOpportunities.length), tone: 'primary' },
          { label: '在手商机金额', value: queryService.formatCurrency(queryService.sumValues(openOpportunities.map((item) => item.amount))), tone: 'success' },
          { label: '承诺项目数', value: String(openOpportunities.filter((item) => item.promised).length), tone: 'warning' },
          { label: '风险商机数', value: String(riskOpportunities.length), tone: 'danger' },
        ],
      },
      {
        blockId: 'opportunity-weekly-new',
        blockType: 'detail-table',
        title: '本周新增',
        size: 'compact',
        columns: [
          { key: 'ownerName', label: '负责人' },
          { key: 'customerName', label: '客户' },
          { key: 'amount', label: '金额' },
        ],
        rows: opportunities
          .slice(-4)
          .map((item) => ({
            ownerName: item.ownerName,
            customerName: item.customerName,
            amount: queryService.formatCurrency(item.amount),
          })),
      },
      {
        blockId: 'opportunity-stage-amount',
        blockType: 'detail-table',
        title: '阶段金额结构',
        size: 'wide',
        columns: [
          { key: 'stage', label: '阶段' },
          { key: 'amount', label: '金额' },
        ],
        rows: stageAmount.map((item) => ({
          stage: item.label,
          amount: queryService.formatCurrency(item.value),
        })),
      },
      {
        blockId: 'opportunity-stage-count',
        blockType: 'detail-table',
        title: '阶段数量结构',
        size: 'compact',
        columns: [
          { key: 'stage', label: '阶段' },
          { key: 'count', label: '数量' },
        ],
        rows: stageCount.map((item) => ({
          stage: item.label,
          count: String(item.value),
        })),
      },
      {
        blockId: 'opportunity-owner-ranking',
        blockType: 'bar-ranking',
        title: '负责人在手商机金额排行',
        size: 'wide',
        rows: ownerAmount.map((item) => ({
          ...item,
          value: queryService.toWanAmount(item.value),
        })),
        unitLabel: '万元',
      },
      {
        blockId: 'opportunity-owner-stage-matrix',
        blockType: 'matrix-table',
        title: '负责人 × 在手阶段金额',
        size: 'full',
        columns: ownerStageLabels,
        rows: [...new Set(openOpportunities.map((item) => item.ownerName))].map((ownerName) => ({
          label: ownerName,
          values: ownerStageLabels.map((stage) =>
            queryService.formatCurrency(
              queryService.sumValues(
                openOpportunities
                  .filter((item) => item.ownerName === ownerName && item.stage === stage)
                  .map((item) => item.amount),
              ),
            ),
          ),
        })),
      },
      {
        blockId: 'opportunity-owner-sign-month',
        blockType: 'matrix-table',
        title: '负责人 × 预计签单月份',
        size: 'full',
        columns: signMonthLabels,
        rows: [...new Set(openOpportunities.map((item) => item.ownerName))].map((ownerName) => ({
          label: ownerName,
          values: signMonthLabels.map((monthLabel) =>
            String(
              openOpportunities.filter(
                (item) =>
                  item.ownerName === ownerName &&
                  (item.expectSignDate ?? '--').slice(0, 7) === monthLabel,
              ).length,
            ),
          ),
        })),
      },
      riskOpportunities.length > 0
        ? {
            blockId: 'opportunity-risk-preview',
            blockType: 'record-preview',
            title: '高金额风险商机预览',
            size: 'full',
            columns: [
              { key: 'ownerName', label: '负责人' },
              { key: 'customerName', label: '最终客户' },
              { key: 'amount', label: '预计收入' },
              { key: 'stage', label: '阶段' },
              { key: 'expectSignDate', label: '预计签单' },
            ],
            rows: riskOpportunities.map((item) => ({
              ownerName: item.ownerName,
              customerName: item.customerName,
              amount: queryService.formatCurrency(item.amount),
              stage: item.stage,
              expectSignDate: item.expectSignDate ?? '--',
            })),
          }
        : createEmptyPreviewBlock({
            blockId: 'opportunity-risk-preview',
            title: '高金额风险商机预览',
          }),
    ],
    footnotes: ['商机专题重点观察阶段结构、负责人承接和签约节奏。'],
  };
}

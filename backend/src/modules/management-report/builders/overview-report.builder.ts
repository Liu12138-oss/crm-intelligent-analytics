import type { ManagementReportQueryService } from '../management-report-query.service';
import { createMetricCard } from '../management-report.types';
import type { ManagementReportContext, ManagementReportSectionData } from '../management-report.types';

/**
 * 组装总览专题，强调页首 KPI 与统一漏斗。
 */
export function buildOverviewReport(
  queryService: ManagementReportQueryService,
  context: ManagementReportContext,
): ManagementReportSectionData {
  const leads = queryService.listLeadsInPeriod(context);
  const customers = queryService.listCustomersInPeriod(context);
  const opportunities = queryService.listOpportunitiesInPeriod(context);
  const contracts = queryService.listContractsInPeriod(context);
  const payments = queryService.listPaymentsInPeriod(context);
  const riskOpportunities = queryService.listRiskOpportunities(context);
  const overduePlans = queryService.listOverduePlansByEndDate(context);

  const metricCards = [
    createMetricCard({ key: 'leadCount', label: '新增线索', value: String(leads.length), tone: 'primary' }),
    createMetricCard({ key: 'customerCount', label: '新增客户', value: String(customers.length), tone: 'success' }),
    createMetricCard({
      key: 'opportunityAmount',
      label: '新增商机金额',
      value: queryService.formatCurrency(queryService.sumValues(opportunities.map((item) => item.amount))),
      tone: 'primary',
    }),
    createMetricCard({
      key: 'contractAmount',
      label: '有效收入',
      value: queryService.formatCurrency(queryService.sumValues(contracts.map((item) => item.amount))),
      tone: 'success',
    }),
    createMetricCard({
      key: 'receivedAmount',
      label: '期内回款',
      value: queryService.formatCurrency(queryService.sumValues(payments.map((item) => item.amount))),
      tone: 'warning',
    }),
    createMetricCard({
      key: 'riskCount',
      label: '风险对象',
      value: String(riskOpportunities.length + overduePlans.length),
      tone: 'danger',
    }),
  ];

  return {
    sectionKey: 'overview',
    title: '总览',
    summary: '首屏优先返回核心经营指标、漏斗和口径摘要。',
    metricKeys: [
      'leadCount',
      'customerCount',
      'opportunityAmount',
      'contractAmount',
      'receivedAmount',
      'riskOpportunityCount',
    ],
    metricCards,
    blocks: [
      {
        blockId: 'overview-funnel',
        blockType: 'funnel',
        title: '线索-客户-商机漏斗',
        size: 'wide',
        stages: [
          { label: '新增线索', value: leads.length },
          {
            label: '转客户',
            value: leads.filter((item) => item.convertedCustomerAt).length,
            conversionLabel: queryService.formatPercent(
              leads.filter((item) => item.convertedCustomerAt).length,
              leads.length,
            ),
          },
          {
            label: '转商机',
            value: leads.filter((item) => item.convertedOpportunityAt).length,
            conversionLabel: queryService.formatPercent(
              leads.filter((item) => item.convertedOpportunityAt).length,
              leads.length,
            ),
          },
          {
            label: '已赢单',
            value: opportunities.filter((item) => item.stage === '赢单').length,
            conversionLabel: queryService.formatPercent(
              opportunities.filter((item) => item.stage === '赢单').length,
              opportunities.length,
            ),
          },
        ],
      },
      {
        blockId: 'overview-caliber',
        blockType: 'insight-table',
        title: '核心口径摘要',
        size: 'compact',
        rows: [
          { label: '统计周期', value: `${context.filter.startDate} 至 ${context.filter.endDate}` },
          { label: '统计范围', value: context.filter.departmentLabel },
          { label: '风险对象', value: `${riskOpportunities.length} 个风险商机，${overduePlans.length} 条逾期计划` },
        ],
      },
    ],
    footnotes: ['总览只保留关键结果，详细口径可通过“查看口径”查看。'],
  };
}

import type { ManagementReportQueryService } from '../management-report-query.service';
import { createMetricCard, createMetricStripItems } from '../management-report.types';
import type { ManagementReportContext, ManagementReportSectionData } from '../management-report.types';

/**
 * 组装经营摘要专题，专门服务管理层快速汇报。
 */
export function buildExecutiveSummaryReport(
  queryService: ManagementReportQueryService,
  context: ManagementReportContext,
): ManagementReportSectionData {
  const leads = queryService.listLeadsInPeriod(context);
  const customerPool = queryService.listCustomersByEndDate(context);
  const openOpportunities = queryService.listOpenOpportunitiesByEndDate(context);
  const overduePlans = queryService.listOverduePlansByEndDate(context);
  const pendingAcceptanceContracts = queryService.listPendingAcceptanceContracts(context);
  const payments = queryService.listPaymentsInPeriod(context);
  const convertedCustomerCount = leads.filter((item) => item.convertedCustomerAt).length;
  const activeCustomerCount = customerPool.filter((item) => item.activeSince).length;

  const summaryMetrics = [
    createMetricCard({
      key: 'receivedAmount',
      label: '期内回款',
      value: queryService.formatCurrency(queryService.sumValues(payments.map((item) => item.amount))),
      tone: 'success',
    }),
    createMetricCard({
      key: 'overdueAmount',
      label: '逾期应收',
      value: queryService.formatCurrency(queryService.sumValues(overduePlans.map((item) => item.amount))),
      tone: 'danger',
    }),
    createMetricCard({
      key: 'leadConversionRate',
      label: '线索转客户率',
      value: queryService.formatPercent(convertedCustomerCount, leads.length),
      tone: 'primary',
    }),
    createMetricCard({
      key: 'customerActivationRate',
      label: '客户激活率',
      value: queryService.formatPercent(activeCustomerCount, customerPool.length),
      tone: 'warning',
    }),
  ];

  return {
    sectionKey: 'executive-summary',
    title: '经营摘要',
    summary: '保留管理层最关心的结论、动作、风险和关键指标。',
    metricKeys: [
      'receivedAmount',
      'overdueAmount',
      'leadConversionRate',
      'customerActivationRate',
    ],
    metricCards: summaryMetrics,
    blocks: [
      {
        blockId: 'executive-conclusion',
        blockType: 'insight-table',
        title: '一句话经营结论',
        size: 'compact',
        rows: [
          {
            label: '商机',
            value: openOpportunities.length > 0
              ? `当前在手商机 ${openOpportunities.length} 个，高阶段与承诺项目需要继续压实。`
              : '当前在手商机偏少，需要尽快补充机会池。',
          },
          {
            label: '客户',
            value: `客户池 ${customerPool.length} 家，激活率 ${queryService.formatPercent(activeCustomerCount, customerPool.length)}。`,
          },
          {
            label: '现金',
            value: overduePlans.length > 0
              ? `当前存在 ${overduePlans.length} 条逾期应收，需要优先催收。`
              : '当前逾期应收压力可控。',
          },
        ],
      },
      {
        blockId: 'executive-actions',
        blockType: 'detail-table',
        title: '本周经营动作',
        size: 'wide',
        columns: [
          { key: 'topic', label: '行动项' },
          { key: 'action', label: '建议' },
        ],
        rows: [
          { topic: '收款', action: '优先催收逾期金额高的合同，并同步排查未验收合同。' },
          { topic: '线索', action: '清理待处理和高风险线索，缩短从线索到商机的推进时间。' },
          { topic: '商机', action: '逐人核对高阶段和承诺项目，避免签约节奏继续后移。' },
        ],
      },
      {
        blockId: 'executive-risks',
        blockType: 'detail-table',
        title: '核心经营风险',
        size: 'wide',
        columns: [
          { key: 'risk', label: '风险类别' },
          { key: 'value', label: '当前值' },
          { key: 'impact', label: '经营影响' },
        ],
        rows: [
          {
            risk: '逾期应收',
            value: queryService.formatCurrency(queryService.sumValues(overduePlans.map((item) => item.amount))),
            impact: '直接影响现金流和销售目标完成节奏。',
          },
          {
            risk: '待验收合同',
            value: String(pendingAcceptanceContracts.length),
            impact: '验收滞后会延后收入生效与回款推进。',
          },
          {
            risk: '在手商机风险池',
            value: String(queryService.listRiskOpportunities(context).length),
            impact: '机会池老化会削弱未来一到两个月的签约把握。',
          },
        ],
      },
      {
        blockId: 'executive-kpis',
        blockType: 'metric-strip',
        title: '关键经营指标',
        size: 'full',
        layoutHint: 'metric-row',
        items: createMetricStripItems([
          createMetricCard({ key: 'leadCount', label: '线索总数', value: String(leads.length), tone: 'primary' }),
          createMetricCard({ key: 'customerCount', label: '客户总数', value: String(customerPool.length), tone: 'success' }),
          createMetricCard({ key: 'opportunityCount', label: '商机总数', value: String(openOpportunities.length), tone: 'primary' }),
          createMetricCard({
            key: 'acceptancePending',
            label: '待验收合同',
            value: String(pendingAcceptanceContracts.length),
            tone: 'warning',
          }),
        ]),
      },
    ],
    footnotes: ['经营摘要突出结论、动作和风险，便于管理层快速判断。'],
  };
}

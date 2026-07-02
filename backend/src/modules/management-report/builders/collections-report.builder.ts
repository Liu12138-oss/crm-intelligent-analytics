import type { ManagementReportQueryService } from '../management-report-query.service';
import { createEmptyPreviewBlock } from '../management-report.types';
import type { ManagementReportContext, ManagementReportSectionData } from '../management-report.types';

/**
 * 组装收款情况专题。
 */
export function buildCollectionsReport(
  queryService: ManagementReportQueryService,
  context: ManagementReportContext,
): ManagementReportSectionData {
  const payments = queryService.listPaymentsInPeriod(context);
  const plans = queryService.listPaymentPlansInPeriod(context);
  const overduePlans = queryService.listOverduePlansByEndDate(context);
  const ownerRows = [...new Set(plans.map((item) => item.ownerName))].map((ownerName) => {
    const ownerPlans = plans.filter((item) => item.ownerName === ownerName);
    const ownerPayments = payments.filter((item) => item.ownerName === ownerName);
    const ownerOverdue = overduePlans.filter((item) => item.ownerName === ownerName);
    return {
      ownerName,
      plannedAmount: queryService.formatCurrency(queryService.sumValues(ownerPlans.map((item) => item.amount))),
      receivedAmount: queryService.formatCurrency(queryService.sumValues(ownerPayments.map((item) => item.amount))),
      overdueAmount: queryService.formatCurrency(queryService.sumValues(ownerOverdue.map((item) => item.amount))),
    };
  });
  const monthlyTrend = queryService.groupSumBy(payments, (item) => item.receiveDate.slice(0, 7), (item) => item.amount);
  const statusRows = [
    {
      status: '未到期',
      count: String(plans.filter((item) => item.status === 'PLANNED').length),
      amount: queryService.formatCurrency(queryService.sumValues(plans.filter((item) => item.status === 'PLANNED').map((item) => item.amount))),
    },
    {
      status: '已逾期',
      count: String(overduePlans.length),
      amount: queryService.formatCurrency(queryService.sumValues(overduePlans.map((item) => item.amount))),
    },
    {
      status: '已收款',
      count: String(plans.filter((item) => item.status === 'RECEIVED').length),
      amount: queryService.formatCurrency(queryService.sumValues(plans.filter((item) => item.status === 'RECEIVED').map((item) => item.amount))),
    },
  ];

  return {
    sectionKey: 'collections',
    title: '收款情况',
    summary: '收款专题按区域经营视角展开为摘要、销售、趋势、状态和逾期项目。',
    metricKeys: ['receivedAmount', 'overdueAmount'],
    blocks: [
      {
        blockId: 'collections-summary',
        blockType: 'metric-strip',
        title: '收款摘要',
        size: 'full',
        items: [
          { label: '期内回款', value: queryService.formatCurrency(queryService.sumValues(payments.map((item) => item.amount))), tone: 'success' },
          { label: '计划应收', value: queryService.formatCurrency(queryService.sumValues(plans.map((item) => item.amount))), tone: 'warning' },
          { label: '逾期应收', value: queryService.formatCurrency(queryService.sumValues(overduePlans.map((item) => item.amount))), tone: 'danger' },
          { label: '回款率', value: queryService.formatPercent(queryService.sumValues(payments.map((item) => item.amount)), queryService.sumValues(plans.map((item) => item.amount))), tone: 'primary' },
        ],
      },
      {
        blockId: 'collections-sales',
        blockType: 'detail-table',
        title: '销售收款情况',
        size: 'wide',
        columns: [
          { key: 'ownerName', label: '销售' },
          { key: 'plannedAmount', label: '计划应收' },
          { key: 'receivedAmount', label: '期内回款' },
          { key: 'overdueAmount', label: '逾期应收' },
        ],
        rows: ownerRows,
      },
      {
        blockId: 'collections-monthly-trend',
        blockType: 'trend',
        title: '月度回款趋势',
        size: 'wide',
        points: monthlyTrend.map((item) => ({
          ...item,
          value: queryService.toWanAmount(item.value),
        })),
        unitLabel: '万元',
      },
      {
        blockId: 'collections-status',
        blockType: 'detail-table',
        title: '应收状态',
        size: 'compact',
        columns: [
          { key: 'status', label: '回款状态' },
          { key: 'count', label: '条数' },
          { key: 'amount', label: '应收金额' },
        ],
        rows: statusRows,
      },
      overduePlans.length > 0
        ? {
            blockId: 'collections-overdue-projects',
            blockType: 'record-preview',
            title: '逾期项目',
            size: 'wide',
            columns: [
              { key: 'customerName', label: '客户' },
              { key: 'ownerName', label: '负责人' },
              { key: 'amount', label: '逾期金额' },
              { key: 'receiveDate', label: '计划回款日' },
            ],
            rows: overduePlans.map((item) => ({
              customerName: item.customerName,
              ownerName: item.ownerName,
              amount: queryService.formatCurrency(item.amount),
              receiveDate: item.receiveDate,
            })),
          }
        : createEmptyPreviewBlock({
            blockId: 'collections-overdue-projects',
            title: '逾期项目',
          }),
    ],
    footnotes: ['收款专题重点观察计划应收、实际回款和逾期项目。'],
  };
}

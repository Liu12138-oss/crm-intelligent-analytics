import type { ManagementReportQueryService } from '../management-report-query.service';
import { createEmptyPreviewBlock } from '../management-report.types';
import type { ManagementReportContext, ManagementReportSectionData } from '../management-report.types';

/**
 * 组装客户专题，覆盖客户池、行业/负责人、激活、新老客户和风险池。
 */
export function buildCustomersReport(
  queryService: ManagementReportQueryService,
  context: ManagementReportContext,
): ManagementReportSectionData {
  const customerPool = queryService.listCustomersByEndDate(context);
  const newCustomers = queryService.listCustomersInPeriod(context);
  const industryRows = queryService.groupCountBy(customerPool, (item) => item.industry);
  const ownerRows = queryService.groupCountBy(customerPool, (item) => item.ownerName);
  const historyRows = [
    {
      label: '历史成交客户',
      value: customerPool.filter((item) => item.historyDeal).length,
    },
    {
      label: '未成交客户',
      value: customerPool.filter((item) => !item.historyDeal).length,
    },
  ];
  const activationRows = [
    {
      label: '有商机客户',
      value: customerPool.filter((item) => item.hasOpportunity).length,
    },
    {
      label: '无商机客户',
      value: customerPool.filter((item) => !item.hasOpportunity).length,
    },
  ];
  const blankCustomers = customerPool.filter((item) => !item.hasOpportunity);
  const followUpCustomers = customerPool.filter(
    (item) => !item.hasOpportunity && item.followUpStatus !== '停滞观察',
  );

  return {
    sectionKey: 'customers',
    title: '客户',
    summary: '客户专题补齐客户池总览、行业/负责人结构、激活率和重点风险客户池。',
    metricKeys: ['customerCount', 'customerActivationRate'],
    blocks: [
      {
        blockId: 'customers-pool-summary',
        blockType: 'metric-strip',
        title: '客户池总览',
        size: 'full',
        layoutHint: 'metric-row',
        items: [
          { label: '客户总数', value: String(customerPool.length), tone: 'primary' },
          { label: '新建客户', value: String(newCustomers.length), tone: 'success' },
          { label: '有商机客户', value: String(customerPool.filter((item) => item.hasOpportunity).length), tone: 'warning' },
          { label: '无商机客户', value: String(blankCustomers.length), tone: 'danger' },
        ],
      },
      {
        blockId: 'customers-industry-top',
        blockType: 'bar-ranking',
        title: '客户行业 Top',
        size: 'wide',
        rows: industryRows,
        unitLabel: '家',
      },
      {
        blockId: 'customers-owner-top',
        blockType: 'bar-ranking',
        title: '客户负责人 Top',
        size: 'wide',
        rows: ownerRows,
        unitLabel: '家',
      },
      {
        blockId: 'customers-structure-strip',
        blockType: 'metric-strip',
        title: '客户结构摘要',
        size: 'full',
        layoutHint: 'metric-row',
        items: [
          { label: '本期新建', value: String(newCustomers.length), tone: 'success' },
          { label: '存量客户池', value: String(customerPool.length - newCustomers.length), tone: 'primary' },
          { label: historyRows[0].label, value: String(historyRows[0].value), tone: 'warning' },
          { label: historyRows[1].label, value: String(historyRows[1].value), tone: 'neutral' },
          { label: activationRows[0].label, value: String(activationRows[0].value), tone: 'success' },
          { label: activationRows[1].label, value: String(activationRows[1].value), tone: 'danger' },
        ],
      },
      blankCustomers.length > 0
        ? {
            blockId: 'customers-blank-market',
            blockType: 'record-preview',
            title: '市场空白客户',
            size: 'wide',
            columns: [
              { key: 'name', label: '客户' },
              { key: 'industry', label: '行业' },
              { key: 'city', label: '城市' },
            ],
            rows: blankCustomers.map((item) => ({
              name: item.name,
              industry: item.industry,
              city: item.city,
            })),
          }
        : createEmptyPreviewBlock({
            blockId: 'customers-blank-market',
            title: '市场空白客户',
          }),
      followUpCustomers.length > 0
        ? {
            blockId: 'customers-follow-up-without-opportunity',
            blockType: 'record-preview',
            title: '无商机但仍在跟进客户',
            size: 'wide',
            columns: [
              { key: 'name', label: '客户' },
              { key: 'ownerName', label: '负责人' },
              { key: 'followUpStatus', label: '当前状态' },
            ],
            rows: followUpCustomers.map((item) => ({
              name: item.name,
              ownerName: item.ownerName,
              followUpStatus: item.followUpStatus,
            })),
          }
        : createEmptyPreviewBlock({
            blockId: 'customers-follow-up-without-opportunity',
            title: '无商机但仍在跟进客户',
          }),
    ],
    footnotes: ['客户专题重点识别待激活客户和持续跟进客户。'],
  };
}

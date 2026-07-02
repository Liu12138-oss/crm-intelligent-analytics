import type { ManagementReportQueryService } from '../management-report-query.service';
import type { ManagementReportContext, ManagementReportSectionData } from '../management-report.types';

/**
 * 组装区域经营专题，聚焦区域作战地图、行业聚焦和城市聚焦。
 */
export function buildRegionalReport(
  queryService: ManagementReportQueryService,
  context: ManagementReportContext,
): ManagementReportSectionData {
  const opportunities = queryService.listOpportunitiesInPeriod(context);
  const customerPool = queryService.listCustomersByEndDate(context);
  const regionAmounts = queryService.groupSumBy(opportunities, (item) => item.region, (item) => item.amount);
  const industryAmounts = queryService.groupSumBy(opportunities, (item) => item.industry, (item) => item.amount);
  const cityAmounts = queryService.groupSumBy(opportunities, (item) => item.city, (item) => item.amount);

  const cityCustomerRows = cityAmounts.map((item) => {
    const cityCustomers = customerPool.filter((customer) => customer.city === item.label);
    const activeCustomerCount = cityCustomers.filter((customer) => customer.hasOpportunity).length;
    return {
      city: item.label,
      customerCount: String(cityCustomers.length),
      activeCustomerCount: String(activeCustomerCount),
      amount: queryService.formatCurrency(item.value),
      activeRate: queryService.formatPercent(activeCustomerCount, cityCustomers.length),
    };
  });

  return {
    sectionKey: 'regional',
    title: '区域经营',
    summary: '把区域经营从单一分布图扩展成作战地图、行业和城市三类视角。',
    metricKeys: ['opportunityAmount', 'customerActivationRate'],
    blocks: [
      {
        blockId: 'regional-playbook-summary',
        blockType: 'insight-table',
        title: '销售抓手总览',
        size: 'compact',
        rows: [
          { label: '哪里最值得打', value: `${regionAmounts[0]?.label ?? '--'} 当前商机金额最高。` },
          { label: '先找谁', value: '优先找高质量线索池、高潜未转化客户和核心伙伴。' },
          { label: '先推什么', value: `${industryAmounts[0]?.label ?? '--'} 行业机会最集中，先推对应行业方案。` },
        ],
      },
      {
        blockId: 'regional-playbook-map',
        blockType: 'detail-table',
        title: '区域作战地图',
        size: 'wide',
        columns: [
          { key: 'region', label: '区域' },
          { key: 'amount', label: '在手商机金额' },
          { key: 'focus', label: '建议抓手' },
        ],
        rows: regionAmounts.map((item) => ({
          region: item.label,
          amount: queryService.formatCurrency(item.value),
          focus: item.label === regionAmounts[0]?.label ? '优先配置高阶段项目和重点客户联动。' : '持续补线索和激活客户池。',
        })),
      },
      {
        blockId: 'regional-industry-focus',
        blockType: 'detail-table',
        title: '区域行业聚焦',
        size: 'wide',
        columns: [
          { key: 'industry', label: '客户主行业' },
          { key: 'opportunityCount', label: '商机数' },
          { key: 'amount', label: '在手商机金额' },
        ],
        rows: industryAmounts.map((item) => ({
          industry: item.label,
          opportunityCount: String(opportunities.filter((opportunity) => opportunity.industry === item.label).length),
          amount: queryService.formatCurrency(item.value),
        })),
      },
      {
        blockId: 'regional-city-focus',
        blockType: 'detail-table',
        title: '区域城市聚焦',
        size: 'wide',
        columns: [
          { key: 'city', label: '城市' },
          { key: 'customerCount', label: '客户数' },
          { key: 'activeCustomerCount', label: '有商机客户数' },
          { key: 'amount', label: '在手商机金额' },
          { key: 'activeRate', label: '客户激活率' },
        ],
        rows: cityCustomerRows,
      },
      {
        blockId: 'regional-city-ranking',
        blockType: 'bar-ranking',
        title: '地市作战图',
        size: 'wide',
        rows: cityAmounts.map((item) => ({
          label: item.label,
          value: queryService.toWanAmount(item.value),
          secondaryLabel: '建议',
          secondaryValue: item.value === cityAmounts[0]?.value ? '优先排布地面拜访' : '保持项目跟进频率',
        })),
        unitLabel: '万元',
      },
    ],
    footnotes: ['区域专题重点观察内部客户与商机分布，支持销售排兵布阵。'],
  };
}

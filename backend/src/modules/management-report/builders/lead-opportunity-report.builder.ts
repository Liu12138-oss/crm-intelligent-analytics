import type { ManagementReportQueryService } from '../management-report-query.service';
import { createEmptyPreviewBlock } from '../management-report.types';
import type { ManagementReportContext, ManagementReportSectionData } from '../management-report.types';

/**
 * 组装线索机会专题，沉淀高潜线索、潜在伙伴和缺少高阶段商机的客户。
 */
export function buildLeadOpportunityReport(
  queryService: ManagementReportQueryService,
  context: ManagementReportContext,
): ManagementReportSectionData {
  const leads = queryService.listLeadsInPeriod(context);
  const notConvertedLeads = leads.filter((item) => !item.convertedOpportunityAt);
  const partnerRows = queryService.groupCountBy(
    notConvertedLeads.filter((item) => item.customerRole !== '最终客户'),
    (item) => `${item.customerRole} / ${item.source}`,
  );
  const highPotentialCustomers = notConvertedLeads.filter(
    (item) => item.qualityLevel === '高质量' || item.qualityLevel === '中质量',
  );
  const partnerLeads = notConvertedLeads.filter(
    (item) => item.customerRole === '代理商' || item.customerRole === '集成商',
  );
  const customersWithoutHighStage = notConvertedLeads.filter((item) => {
    const opportunities = queryService.listOpportunitiesByCustomerName(context, item.companyName);
    return opportunities.every(
      (opportunity) => queryService.resolveStageScore(opportunity.stage) < 30,
    );
  });

  return {
    sectionKey: 'lead-opportunity',
    title: '线索机会',
    summary: '把线索机会沉淀成潜在渠道、潜在客户和缺高阶段商机的对象池。',
    metricKeys: ['leadCount'],
    blocks: [
      partnerRows.length > 0
        ? {
            blockId: 'lead-opportunity-channel-top',
            blockType: 'bar-ranking',
            title: '潜在渠道 / 伙伴排行',
            size: 'wide',
            rows: partnerRows,
            unitLabel: '条',
          }
        : createEmptyPreviewBlock({
            blockId: 'lead-opportunity-channel-top',
            title: '潜在渠道 / 伙伴排行',
          }),
      highPotentialCustomers.length > 0
        ? {
            blockId: 'lead-opportunity-high-potential',
            blockType: 'record-preview',
            title: '高潜未转化客户',
            size: 'wide',
            columns: [
              { key: 'companyName', label: '公司' },
              { key: 'qualityLevel', label: '质量等级' },
              { key: 'demandTag', label: '需求标签' },
            ],
            rows: highPotentialCustomers.map((item) => ({
              companyName: item.companyName,
              qualityLevel: item.qualityLevel,
              demandTag: item.demandTag,
            })),
          }
        : createEmptyPreviewBlock({
            blockId: 'lead-opportunity-high-potential',
            title: '高潜未转化客户',
          }),
      partnerLeads.length > 0
        ? {
            blockId: 'lead-opportunity-partner-preview',
            blockType: 'record-preview',
            title: '未成交代理商 / 集成商线索',
            size: 'wide',
            columns: [
              { key: 'companyName', label: '公司' },
              { key: 'customerRole', label: '角色' },
              { key: 'source', label: '来源' },
            ],
            rows: partnerLeads.map((item) => ({
              companyName: item.companyName,
              customerRole: item.customerRole,
              source: item.source,
            })),
          }
        : createEmptyPreviewBlock({
            blockId: 'lead-opportunity-partner-preview',
            title: '未成交代理商 / 集成商线索',
          }),
      customersWithoutHighStage.length > 0
        ? {
            blockId: 'lead-opportunity-no-high-stage',
            blockType: 'record-preview',
            title: '未成交且无 10%+ 商机客户',
            size: 'wide',
            columns: [
              { key: 'companyName', label: '客户' },
              { key: 'ownerName', label: '负责人' },
              { key: 'followUpStatus', label: '当前状态' },
            ],
            rows: customersWithoutHighStage.map((item) => ({
              companyName: item.companyName,
              ownerName: item.ownerName,
              followUpStatus: item.followUpStatus,
            })),
          }
        : createEmptyPreviewBlock({
            blockId: 'lead-opportunity-no-high-stage',
            title: '未成交且无 10%+ 商机客户',
          }),
    ],
    footnotes: ['线索机会专题重点帮助销售判断先推进谁、先补哪类高潜客户。'],
  };
}

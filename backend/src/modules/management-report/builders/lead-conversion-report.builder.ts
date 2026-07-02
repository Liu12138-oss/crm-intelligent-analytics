import type { ManagementReportQueryService } from '../management-report-query.service';
import { createEmptyPreviewBlock } from '../management-report.types';
import type { ManagementReportContext, ManagementReportSectionData } from '../management-report.types';

interface LeadCompanyAggregate {
  leadCount: number;
  wonCount: number;
}

/**
 * 组装线索转化专题，按 cohort 口径展示阶段转化和回流对象。
 */
export function buildLeadConversionReport(
  queryService: ManagementReportQueryService,
  context: ManagementReportContext,
): ManagementReportSectionData {
  const leads = queryService.listLeadsInPeriod(context);
  const oldCustomerNames = new Set(
    queryService
      .listCustomersByEndDate(context)
      .filter((item) => item.createdAt < context.filter.startDate)
      .map((item) => item.name),
  );
  const companyAggregateMap = new Map<string, LeadCompanyAggregate>();
  const oldCustomerReentry = [];
  const noOpportunityLeads = [];
  let convertedCustomerCount = 0;
  let convertedOpportunityCount = 0;
  let wonLeadCount = 0;

  for (const lead of leads) {
    if (lead.convertedCustomerAt) {
      convertedCustomerCount += 1;
    }
    if (lead.convertedOpportunityAt) {
      convertedOpportunityCount += 1;
    } else {
      noOpportunityLeads.push(lead);
    }
    if (lead.wonAt) {
      wonLeadCount += 1;
    }
    if (oldCustomerNames.has(lead.companyName)) {
      oldCustomerReentry.push(lead);
    }

    const companyAggregate = companyAggregateMap.get(lead.companyName) ?? {
      leadCount: 0,
      wonCount: 0,
    };
    companyAggregate.leadCount += 1;
    if (lead.wonAt) {
      companyAggregate.wonCount += 1;
    }
    companyAggregateMap.set(lead.companyName, companyAggregate);
  }

  const multiLeadCompanies = Array.from(companyAggregateMap.entries())
    .map(([companyName, aggregate]) => ({
      companyName,
      leadCount: aggregate.leadCount,
      wonCount: aggregate.wonCount,
    }))
    .filter((item) => item.leadCount > 1);

  return {
    sectionKey: 'lead-conversion',
    title: '线索转化',
    summary: '线索转化专题按 cohort 口径展示阶段转化、老客户回流和未转化对象。',
    metricKeys: ['leadConversionRate'],
    blocks: [
      {
        blockId: 'lead-conversion-funnel',
        blockType: 'funnel',
        title: '线索转化漏斗',
        size: 'wide',
        stages: [
          { label: '新增线索', value: leads.length },
          {
            label: '转客户',
            value: convertedCustomerCount,
            conversionLabel: queryService.formatPercent(convertedCustomerCount, leads.length),
          },
          {
            label: '转商机',
            value: convertedOpportunityCount,
            conversionLabel: queryService.formatPercent(convertedOpportunityCount, leads.length),
          },
          {
            label: '已成交',
            value: wonLeadCount,
            conversionLabel: queryService.formatPercent(wonLeadCount, leads.length),
          },
        ],
      },
      {
        blockId: 'lead-conversion-stage-table',
        blockType: 'detail-table',
        title: '阶段转化表',
        size: 'compact',
        columns: [
          { key: 'stage', label: '阶段' },
          { key: 'count', label: '数量' },
          { key: 'rate', label: '转化率' },
        ],
        rows: [
          {
            stage: '转客户',
            count: String(convertedCustomerCount),
            rate: queryService.formatPercent(convertedCustomerCount, leads.length),
          },
          {
            stage: '转商机',
            count: String(convertedOpportunityCount),
            rate: queryService.formatPercent(convertedOpportunityCount, leads.length),
          },
          {
            stage: '已成交',
            count: String(wonLeadCount),
            rate: queryService.formatPercent(wonLeadCount, leads.length),
          },
        ],
      },
      multiLeadCompanies.length > 0
        ? {
            blockId: 'lead-conversion-multi-lead',
            blockType: 'record-preview',
            title: '多线索成交客户',
            size: 'wide',
            columns: [
              { key: 'companyName', label: '公司' },
              { key: 'leadCount', label: '线索数' },
              { key: 'wonCount', label: '成交数' },
            ],
            rows: multiLeadCompanies.map((item) => ({
              companyName: item.companyName,
              leadCount: String(item.leadCount),
              wonCount: String(item.wonCount),
            })),
          }
        : createEmptyPreviewBlock({
            blockId: 'lead-conversion-multi-lead',
            title: '多线索成交客户',
          }),
      oldCustomerReentry.length > 0
        ? {
            blockId: 'lead-conversion-old-customer',
            blockType: 'record-preview',
            title: '老客户再次进入线索池',
            size: 'wide',
            columns: [
              { key: 'companyName', label: '客户' },
              { key: 'source', label: '来源' },
              { key: 'ownerName', label: '负责人' },
            ],
            rows: oldCustomerReentry.map((item) => ({
              companyName: item.companyName,
              source: item.source,
              ownerName: item.ownerName,
            })),
          }
        : createEmptyPreviewBlock({
            blockId: 'lead-conversion-old-customer',
            title: '老客户再次进入线索池',
          }),
      noOpportunityLeads.length > 0
        ? {
            blockId: 'lead-conversion-no-opportunity',
            blockType: 'record-preview',
            title: '无商机未成交线索',
            size: 'wide',
            columns: [
              { key: 'companyName', label: '公司' },
              { key: 'qualityLevel', label: '质量等级' },
              { key: 'followUpStatus', label: '当前状态' },
            ],
            rows: noOpportunityLeads.map((item) => ({
              companyName: item.companyName,
              qualityLevel: item.qualityLevel,
              followUpStatus: item.followUpStatus,
            })),
          }
        : createEmptyPreviewBlock({
            blockId: 'lead-conversion-no-opportunity',
            title: '无商机未成交线索',
          }),
    ],
    footnotes: ['转化专题重点观察本期线索从建联到成交的承接情况。'],
  };
}

import type { ManagementReportQueryService } from '../management-report-query.service';
import { createEmptyPreviewBlock } from '../management-report.types';
import type { ManagementReportContext, ManagementReportSectionData } from '../management-report.types';

/**
 * 组装经营风险与建议专题。
 */
export function buildRisksReport(
  queryService: ManagementReportQueryService,
  context: ManagementReportContext,
): ManagementReportSectionData {
  const leads = queryService.listLeadsInPeriod(context);
  const customerPool = queryService.listCustomersByEndDate(context);
  const riskOpportunities = queryService.listRiskOpportunities(context);
  const overduePlans = queryService.listOverduePlansByEndDate(context);
  const pendingContracts = queryService.listPendingAcceptanceContracts(context);
  const noOpportunityCustomers = customerPool.filter((item) => !item.hasOpportunity);

  return {
    sectionKey: 'risks',
    title: '经营风险与建议',
    summary: '风险专题从风险、建议、汇总、数据质量和风险预览五个方向给经营动作支撑。',
    metricKeys: ['riskOpportunityCount', 'overdueAmount'],
    blocks: [
      {
        blockId: 'risks-core',
        blockType: 'detail-table',
        title: '核心经营风险',
        size: 'wide',
        columns: [
          { key: 'riskCategory', label: '风险类别' },
          { key: 'currentValue', label: '当前值' },
          { key: 'impact', label: '经营影响' },
        ],
        rows: [
          { riskCategory: '线索风险', currentValue: String(leads.filter((item) => item.riskFlag).length), impact: '高风险线索积压会直接削弱机会池补充。' },
          { riskCategory: '商机风险', currentValue: String(riskOpportunities.length), impact: '机会池老化会拖慢未来签约节奏。' },
          { riskCategory: '验收风险', currentValue: String(pendingContracts.length), impact: '待验收合同会延后回款兑现。' },
          { riskCategory: '收款风险', currentValue: queryService.formatCurrency(queryService.sumValues(overduePlans.map((item) => item.amount))), impact: '逾期应收会挤压现金流。' },
        ],
      },
      {
        blockId: 'risks-actions',
        blockType: 'detail-table',
        title: '经营建议',
        size: 'wide',
        columns: [
          { key: 'topic', label: '经营主题' },
          { key: 'action', label: '建议动作' },
        ],
        rows: [
          { topic: '线索经营', action: '建立本周必跟池，优先处理高质量和高风险线索。' },
          { topic: '商机经营', action: '逐人复盘高金额低阶段和超期未跟进商机。' },
          { topic: '现金经营', action: '按销售和合同负责人双维度催收逾期项目。' },
        ],
      },
      {
        blockId: 'risks-summary',
        blockType: 'insight-table',
        title: '风险汇总',
        size: 'compact',
        rows: [
          { label: '待处理 / 风险线索', value: String(leads.filter((item) => item.riskFlag).length) },
          { label: '风险商机', value: String(riskOpportunities.length) },
          { label: '无商机客户', value: String(noOpportunityCustomers.length) },
          { label: '逾期应收计划', value: String(overduePlans.length) },
        ],
      },
      {
        blockId: 'risks-data-quality',
        blockType: 'data-quality',
        title: '基础信息完善度',
        size: 'wide',
        rows: [
          queryService.buildDataQualityRow('线索资料', '需求标签', leads.filter((item) => item.demandTag).length, leads.length),
          queryService.buildDataQualityRow('客户资料', '客户等级', customerPool.filter((item) => item.level).length, customerPool.length),
          queryService.buildDataQualityRow('方案信息', '产品方案', queryService.listOpportunitiesInPeriod(context).filter((item) => item.productSolution).length, queryService.listOpportunitiesInPeriod(context).length),
          queryService.buildDataQualityRow('伙伴信息', '合作伙伴', queryService.listOpportunitiesInPeriod(context).filter((item) => item.agentName).length, queryService.listOpportunitiesInPeriod(context).length),
        ],
      },
      riskOpportunities.length > 0
        ? {
            blockId: 'risks-opportunity-preview',
            blockType: 'record-preview',
            title: '风险商机预览',
            size: 'wide',
            columns: [
              { key: 'customerName', label: '客户' },
              { key: 'ownerName', label: '负责人' },
              { key: 'stage', label: '阶段' },
              { key: 'amount', label: '预计收入' },
            ],
            rows: riskOpportunities.map((item) => ({
              customerName: item.customerName,
              ownerName: item.ownerName,
              stage: item.stage,
              amount: queryService.formatCurrency(item.amount),
            })),
          }
        : createEmptyPreviewBlock({
            blockId: 'risks-opportunity-preview',
            title: '风险商机预览',
          }),
      noOpportunityCustomers.length > 0
        ? {
            blockId: 'risks-customer-preview',
            blockType: 'record-preview',
            title: '风险客户预览',
            size: 'wide',
            columns: [
              { key: 'name', label: '客户' },
              { key: 'ownerName', label: '负责人' },
              { key: 'followUpStatus', label: '跟进状态' },
            ],
            rows: noOpportunityCustomers.map((item) => ({
              name: item.name,
              ownerName: item.ownerName,
              followUpStatus: item.followUpStatus,
            })),
          }
        : createEmptyPreviewBlock({
            blockId: 'risks-customer-preview',
            title: '风险客户预览',
          }),
    ],
    footnotes: ['风险专题重点是让经营管理者能直接把风险转成行动，而不是只看异常列表。'],
  };
}

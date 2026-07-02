import type { ManagementReportQueryService } from '../management-report-query.service';
import type { ManagementReportContext, ManagementReportSectionData } from '../management-report.types';

/**
 * 组装代理商 / 生态专题，哪怕字段有限也返回有数值支撑的厚退化专题。
 */
export function buildAgentsReport(
  queryService: ManagementReportQueryService,
  context: ManagementReportContext,
): ManagementReportSectionData {
  const opportunities = queryService.listOpportunitiesInPeriod(context);
  const validAgentOpportunities = opportunities.filter((item) => item.agentName);
  const agentRows = queryService.groupSumBy(
    validAgentOpportunities,
    (item) => item.agentName ?? '未填写',
    (item) => item.amount,
  );
  const ecosystemRows = queryService.groupCountBy(
    validAgentOpportunities,
    (item) => item.ecosystemType ?? '未分类',
  );

  return {
    sectionKey: 'agents',
    title: '代理商/生态',
    summary: '伙伴专题先覆盖规模、贡献质量、结构和字段完整度，不再只有一句退化提示。',
    state: 'degraded',
    blocks: [
      {
        blockId: 'agents-summary',
        blockType: 'metric-strip',
        title: '合作伙伴池总览',
        size: 'full',
        items: [
          { label: '伙伴数', value: String(new Set(validAgentOpportunities.map((item) => item.agentName)).size), tone: 'primary' },
          { label: '伙伴商机数', value: String(validAgentOpportunities.length), tone: 'success' },
          { label: '核心伙伴商机', value: String(validAgentOpportunities.filter((item) => item.ecosystemType === '核心伙伴').length), tone: 'warning' },
        ],
      },
      {
        blockId: 'agents-ranking',
        blockType: 'bar-ranking',
        title: '核心伙伴在手金额 Top',
        size: 'wide',
        rows: agentRows.map((item) => ({
          ...item,
          value: queryService.toWanAmount(item.value),
        })),
        unitLabel: '万元',
      },
      {
        blockId: 'agents-structure',
        blockType: 'detail-table',
        title: '伙伴生态结构',
        size: 'compact',
        columns: [
          { key: 'label', label: '伙伴类型' },
          { key: 'count', label: '商机数' },
        ],
        rows: ecosystemRows.map((item) => ({
          label: item.label,
          count: String(item.value),
        })),
      },
      {
        blockId: 'agents-quality',
        blockType: 'data-quality',
        title: '伙伴信息完善度',
        size: 'wide',
        rows: [
          queryService.buildDataQualityRow('伙伴信息', '伙伴名称', validAgentOpportunities.length, opportunities.length),
          queryService.buildDataQualityRow('伙伴信息', '合作类型', validAgentOpportunities.filter((item) => item.ecosystemType).length, opportunities.length),
        ],
      },
    ],
    footnotes: ['伙伴专题重点观察伙伴覆盖、合作类型和机会贡献情况。'],
  };
}

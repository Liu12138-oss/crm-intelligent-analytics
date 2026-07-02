import type { ManagementReportQueryService } from '../management-report-query.service';
import type { ManagementReportContext, ManagementReportSectionData } from '../management-report.types';

/**
 * 组装产品方案专题，先把方案总览、Top 排行和字段完整度做出来。
 */
export function buildProductsReport(
  queryService: ManagementReportQueryService,
  context: ManagementReportContext,
): ManagementReportSectionData {
  const opportunities = queryService.listOpportunitiesInPeriod(context);
  const productRows = queryService.groupCountBy(opportunities, (item) => item.productSolution);
  const industrySolutionRows = queryService.groupCountBy(opportunities, (item) => item.industrySolution);

  return {
    sectionKey: 'products',
    title: '产品方案',
    summary: '产品专题先覆盖方案总览、方案排行和字段完整度，避免继续只有占位文案。',
    state: 'degraded',
    blocks: [
      {
        blockId: 'products-summary',
        blockType: 'metric-strip',
        title: '产品经营总览',
        size: 'full',
        items: [
          { label: '产品方案数', value: String(new Set(opportunities.map((item) => item.productSolution)).size), tone: 'primary' },
          { label: '行业方案数', value: String(new Set(opportunities.map((item) => item.industrySolution)).size), tone: 'success' },
          { label: '方案商机数', value: String(opportunities.length), tone: 'warning' },
        ],
      },
      {
        blockId: 'products-product-top',
        blockType: 'bar-ranking',
        title: '产品解决方案机会规模 Top',
        size: 'wide',
        rows: productRows,
        unitLabel: '个',
      },
      {
        blockId: 'products-industry-top',
        blockType: 'bar-ranking',
        title: '行业解决方案机会规模 Top',
        size: 'wide',
        rows: industrySolutionRows,
        unitLabel: '个',
      },
      {
        blockId: 'products-quality',
        blockType: 'data-quality',
        title: '方案信息完善度',
        size: 'wide',
        rows: [
          queryService.buildDataQualityRow('方案信息', '产品方案', opportunities.filter((item) => item.productSolution).length, opportunities.length),
          queryService.buildDataQualityRow('方案信息', '行业方案', opportunities.filter((item) => item.industrySolution).length, opportunities.length),
        ],
      },
    ],
    footnotes: ['产品方案专题重点观察方案覆盖和机会集中方向。'],
  };
}

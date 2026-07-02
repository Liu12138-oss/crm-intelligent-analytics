const verticalChartSeriesThreshold = 6;
const rankingTitlePattern = /(排名|排行|榜|Top|TOP)/;

/**
 * 判断分析图表是否应使用纵向榜单展示。
 * 参数：图表标题、视图类型、序列数量；返回：排名类或多维度柱状图返回 true。
 * 调用注意：该规则同时服务常用模板、自由查询和详情页，避免多维度结果被横向卡片挤出页面。
 */
export function shouldUseVerticalAnalysisChart(
  title: string | undefined,
  viewType: string | undefined,
  seriesCount: number,
): boolean {
  if (viewType === 'LINE_CHART') {
    return false;
  }

  if (seriesCount >= verticalChartSeriesThreshold) {
    return true;
  }

  return Boolean(title && rankingTitlePattern.test(title));
}

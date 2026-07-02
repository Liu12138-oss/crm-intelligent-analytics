/**
 * 企微动态看板卡片指标选择器。
 *
 * 设计目的：
 * - 从 DashboardComposeResult 的 KPI、漏斗、排行、区域、集中度、分布等区块中抽取卡片候选指标。
 * - 按 14 类模板的主指标和辅助指标优先级选择企微卡片首屏指标。
 * - 只做展示编排，不重算业务口径，不改变底层分析结果。
 */

import { Injectable } from '@nestjs/common';
import type {
  DashboardBlock,
  DashboardComposeResult,
} from '../crm-standard-api/dashboard-report-composer.service';
import type { DashboardCardKpiItem } from './wecom-dashboard-card-builder.service';
import type { WecomDashboardTemplateDefinition } from './wecom-dashboard-template.registry';

interface SelectDashboardCardKpiItemsParams {
  dashboardResult: DashboardComposeResult;
  template: WecomDashboardTemplateDefinition;
}

@Injectable()
export class WecomDashboardKpiSelectorService {
  /**
   * 选择企微动态卡片指标。
   *
   * 参数说明：`params.dashboardResult` 为看板组装结果，`params.template` 为已解析的展示模板。
   * 返回值说明：返回第一个元素作为主指标，其余元素作为横向辅助指标。
   * 调用注意事项：为了满足企微首屏可读性，返回结果至少包含 1 个主指标和 3 个辅助指标。
   */
  selectCardKpiItems(params: SelectDashboardCardKpiItemsParams): DashboardCardKpiItem[] {
    const candidates = this.collectCandidateItems(params.dashboardResult);
    const primary = this.selectFirstByPriority(
      candidates,
      params.template.primaryMetricPriority,
    ) ?? candidates[0] ?? { label: '分析状态', value: '已生成' };

    const selectedSecondary = this.selectManyByPriority(
      candidates,
      params.template.secondaryMetricPriority,
      new Set([this.buildItemKey(primary)]),
    );

    const selectedKeys = new Set([
      this.buildItemKey(primary),
      ...selectedSecondary.map((item) => this.buildItemKey(item)),
    ]);
    const remainingCandidates = candidates.filter((item) => !selectedKeys.has(this.buildItemKey(item)));
    const fallbackItems = [
      ...params.template.fallbackSecondaryMetrics,
      { label: '数据来源', value: this.resolveDataSourceLabel(params.dashboardResult.dataSource) },
      { label: '完整看板', value: '可查看' },
    ];

    const secondaryItems = [
      ...selectedSecondary,
      ...remainingCandidates,
      ...fallbackItems,
    ].filter((item, index, allItems) => {
      const itemKey = this.buildItemKey(item);
      return allItems.findIndex((candidate) => this.buildItemKey(candidate) === itemKey) === index;
    });

    return [primary, ...secondaryItems.slice(0, 6)];
  }

  /**
   * 收集卡片候选指标。
   *
   * 参数说明：`dashboardResult` 为看板组装结果。
   * 返回值说明：返回去重后的候选指标列表。
   */
  private collectCandidateItems(dashboardResult: DashboardComposeResult): DashboardCardKpiItem[] {
    const items: DashboardCardKpiItem[] = [];
    items.push({ label: '可见范围', value: dashboardResult.scopeSummary || '当前权限' });
    items.push({ label: '数据来源', value: this.resolveDataSourceLabel(dashboardResult.dataSource) });

    if (dashboardResult.errors.length > 0) {
      items.push({ label: '异常接口', value: `${dashboardResult.errors.length}项` });
    }

    for (const block of dashboardResult.blocks) {
      items.push(...this.collectBlockItems(block));
    }

    return this.dedupeItems(items);
  }

  /**
   * 从单个看板区块收集候选指标。
   *
   * 参数说明：`block` 为看板区块。
   * 返回值说明：返回该区块可用于企微卡片的短指标。
   */
  private collectBlockItems(block: DashboardBlock): DashboardCardKpiItem[] {
    switch (block.blockType) {
      case 'kpi-matrix':
        return block.metrics.map((metric) => ({
          label: metric.label,
          value: `${metric.value}${metric.unit ?? ''}`,
        }));
      case 'funnel':
        return this.collectFunnelItems(block);
      case 'concentration':
        return [
          ...block.tiers.map((tier) => ({
            label: `${tier.label}占比`,
            value: `${tier.percentage}%`,
          })),
          ...(typeof block.oneTimeCount === 'number'
            ? [{ label: '长尾渠道', value: `${block.oneTimeCount}家` }]
            : []),
        ];
      case 'geo-map':
        return [
          ...(typeof block.coveredRegionCount === 'number'
            ? [{
                label: '覆盖省份',
                value: this.formatCoverageValue(block.coveredRegionCount, block.totalRegionCount ?? 31),
              }]
            : []),
          ...this.collectLeadingRegionItem(block.regions),
        ];
      case 'grouped-bar':
        return this.collectGroupedBarItems(block);
      case 'pie-distribution':
        return this.collectPieDistributionItems(block);
      case 'sortable-table':
        return this.collectTableItems(block);
      case 'composite-trend':
        return this.collectTrendItems(block);
      default:
        return [];
    }
  }

  /**
   * 收集漏斗区块指标。
   *
   * 参数说明：`block` 为漏斗区块。
   * 返回值说明：返回阶段数量、阶段转化率和最大断点。
   */
  private collectFunnelItems(
    block: Extract<DashboardBlock, { blockType: 'funnel' }>,
  ): DashboardCardKpiItem[] {
    const stageItems = block.stages.map((stage) => ({
      label: stage.name,
      value: `${stage.value}${this.resolveStageUnit(stage.name)}`,
    }));
    const rateItems = block.stages.flatMap((stage, index) => {
      if (index === 0 || typeof stage.rate !== 'number') {
        return [];
      }

      const previousStage = block.stages[index - 1];
      return [{
        label: `${previousStage.name}转${stage.name}率`,
        value: `${(stage.rate * 100).toFixed(1)}%`,
      }];
    });
    const weakestRate = block.stages
      .map((stage, index) => ({ stage, index }))
      .filter((item) => item.index > 0 && typeof item.stage.rate === 'number')
      .sort((left, right) => (left.stage.rate ?? 1) - (right.stage.rate ?? 1))[0];
    const weaknessItems = weakestRate
      ? [{
          label: '最大断点',
          value: `${block.stages[weakestRate.index - 1].name}转${weakestRate.stage.name}`,
        }]
      : [];

    return [...weaknessItems, ...rateItems, ...stageItems];
  }

  /**
   * 收集表格区块指标。
   *
   * 参数说明：`block` 为排序表格区块。
   * 返回值说明：返回 TOP1 或领先区域等适合卡片展示的摘要。
   */
  private collectTableItems(
    block: Extract<DashboardBlock, { blockType: 'sortable-table' }>,
  ): DashboardCardKpiItem[] {
    const firstRow = block.rows[0];
    if (!firstRow) {
      return [];
    }

    const name = String(firstRow.name ?? firstRow.region ?? firstRow.bigRegion ?? firstRow.ownerName ?? '--');
    const metricLabel = this.resolveComparisonMetricLabel(block.title);
    const metricValue = this.resolveRowMetricValue(firstRow, metricLabel);
    const value = metricValue === undefined
      ? name
      : `${name} ${this.formatSeriesValue(metricLabel ?? '', metricValue)}`;
    if (/区域|大区/u.test(block.title)) {
      return [{ label: `${metricLabel ?? ''}领先区域`, value }];
    }

    if (/渠道|代理商|服务商|排行/u.test(block.title)) {
      return [{ label: metricLabel ? `${metricLabel}TOP1渠道` : 'TOP1', value }];
    }

    return [{ label: metricLabel ? `${metricLabel}TOP1` : 'TOP1', value }];
  }

  /**
   * 选择第一个命中优先级的指标。
   *
   * 参数说明：`items` 为候选指标，`priorityPatterns` 为模板指标优先级。
   * 返回值说明：返回第一个命中的指标；无命中时返回 `undefined`。
   */
  private selectFirstByPriority(
    items: DashboardCardKpiItem[],
    priorityPatterns: RegExp[],
  ): DashboardCardKpiItem | undefined {
    for (const pattern of priorityPatterns) {
      const matchedItem = items.find((item) => this.matchesItem(pattern, item));
      if (matchedItem) {
        return matchedItem;
      }
    }

    return undefined;
  }

  /**
   * 按优先级选择多个指标。
   *
   * 参数说明：`excludeKeys` 为已选指标键，避免主指标重复进入横向指标。
   * 返回值说明：返回按优先级排序且去重的辅助指标。
   */
  private selectManyByPriority(
    items: DashboardCardKpiItem[],
    priorityPatterns: RegExp[],
    excludeKeys: Set<string>,
  ): DashboardCardKpiItem[] {
    const selected: DashboardCardKpiItem[] = [];
    const selectedKeys = new Set(excludeKeys);

    for (const pattern of priorityPatterns) {
      for (const item of items) {
        const itemKey = this.buildItemKey(item);
        if (selectedKeys.has(itemKey) || !this.matchesItem(pattern, item)) {
          continue;
        }

        selected.push(item);
        selectedKeys.add(itemKey);
      }
    }

    return selected;
  }

  /**
   * 判断指标是否命中规则。
   *
   * 参数说明：`pattern` 为模板指标规则，`item` 为候选指标。
   * 返回值说明：指标名称或指标值命中时返回 `true`。
   */
  private matchesItem(pattern: RegExp, item: DashboardCardKpiItem): boolean {
    return pattern.test(`${item.label} ${item.value}`);
  }

  /**
   * 候选指标去重。
   *
   * 参数说明：`items` 为候选指标列表。
   * 返回值说明：按指标名称优先去重，保留先出现的业务口径。
   */
  private dedupeItems(items: DashboardCardKpiItem[]): DashboardCardKpiItem[] {
    const seenLabels = new Set<string>();
    return items.filter((item) => {
      const normalizedLabel = item.label.trim();
      if (!normalizedLabel || seenLabels.has(normalizedLabel)) {
        return false;
      }

      seenLabels.add(normalizedLabel);
      return true;
    });
  }

  /**
   * 构造指标唯一键。
   *
   * 参数说明：`item` 为卡片指标。
   * 返回值说明：返回由名称和值组成的唯一键。
   */
  private buildItemKey(item: DashboardCardKpiItem): string {
    return `${item.label}::${item.value}`;
  }

  /**
   * 解析漏斗阶段单位。
   *
   * 参数说明：`stageName` 为漏斗阶段名称。
   * 返回值说明：返回更贴近业务语义的单位。
   */
  private resolveStageUnit(stageName: string): string {
    if (/订单/u.test(stageName)) {
      return '单';
    }

    if (/报备|商机|报价/u.test(stageName)) {
      return '个';
    }

    return '项';
  }

  /**
   * 收集领先区域指标。
   *
   * 参数说明：`regions` 为地图区域数据。
   * 返回值说明：返回排名第一的区域名称。
   */
  private collectLeadingRegionItem(
    regions: Array<{ name: string; value: number }>,
  ): DashboardCardKpiItem[] {
    const leadingRegion = [...regions].sort((left, right) => right.value - left.value)[0];
    return leadingRegion ? [{ label: '领先区域', value: `${leadingRegion.name} ${leadingRegion.value}` }] : [];
  }

  /**
   * 收集分组柱状图区块中的领先项。
   *
   * 参数说明：`block` 为分组柱状图区块。
   * 返回值说明：返回每个系列的领先区域或领先渠道，便于企微卡片直接展示对比结论。
   */
  private collectGroupedBarItems(
    block: Extract<DashboardBlock, { blockType: 'grouped-bar' }>,
  ): DashboardCardKpiItem[] {
    return block.series.slice(0, 3).map((series) => {
      const topIndex = this.findMaxValueIndex(series.values);
      const topCategory = block.categories[topIndex] ?? '未命名';
      const topValue = series.values[topIndex] ?? 0;
      const categoryLabel = /区域|大区/u.test(block.title) ? '区域' : /渠道|代理商|服务商/u.test(block.title) ? '渠道' : '';
      const label = `${this.normalizeMetricLabel(series.name)}领先${categoryLabel}`;
      return {
        label,
        value: `${topCategory} ${this.formatSeriesValue(series.name, topValue)}`,
      };
    });
  }

  /**
   * 收集占比分布区块中的头部结构项。
   *
   * 参数说明：`block` 为占比分布区块。
   * 返回值说明：返回占比最高项和前几个分布项。
   */
  private collectPieDistributionItems(
    block: Extract<DashboardBlock, { blockType: 'pie-distribution' }>,
  ): DashboardCardKpiItem[] {
    const totalValue =
      block.totalValue ??
      block.segments.reduce((sum, segment) => sum + segment.value, 0);
    const sortedSegments = [...block.segments].sort((left, right) => right.value - left.value);
    const topSegment = sortedSegments[0];
    const topItem = topSegment
      ? [{
          label: `${this.truncateMetricLabel(block.title)}最高`,
          value: `${topSegment.name} ${this.formatPercentage(topSegment.value, totalValue)}`,
        }]
      : [];
    const segmentItems = sortedSegments.slice(0, 3).map((segment) => ({
      label: segment.name,
      value: `${segment.value}${block.unitLabel ?? ''}，${this.formatPercentage(segment.value, totalValue)}`,
    }));

    return [...topItem, ...segmentItems];
  }

  /**
   * 收集趋势区块中的最新值和环比变化。
   *
   * 参数说明：`block` 为柱线组合趋势区块。
   * 返回值说明：返回每个系列最新一期及较上一期变化。
   */
  private collectTrendItems(
    block: Extract<DashboardBlock, { blockType: 'composite-trend' }>,
  ): DashboardCardKpiItem[] {
    return [...block.barSeries, ...(block.lineSeries ?? [])].slice(0, 4).map((series) => {
      const latestIndex = Math.max(0, series.values.length - 1);
      const latestValue = series.values[latestIndex] ?? 0;
      const previousValue = latestIndex > 0 ? series.values[latestIndex - 1] ?? 0 : undefined;
      return {
        label: `${this.normalizeMetricLabel(series.name)}最新`,
        value: this.formatTrendValue(series.name, latestValue, previousValue),
      };
    });
  }

  /**
   * 格式化分组柱状图指标值。
   *
   * 参数说明：`seriesName` 为系列名称，`values` 为系列数值。
   * 返回值说明：金额类默认追加“万”，数量类直接返回合计值。
   */
  private formatGroupedBarValue(seriesName: string, values: number[]): string {
    const totalValue = values.reduce((sum, value) => sum + value, 0);
    return this.formatSeriesValue(seriesName, totalValue);
  }

  /**
   * 格式化单个系列数值。
   *
   * 参数说明：`seriesName` 为系列名称，`value` 为数值。
   * 返回值说明：金额类追加万元单位，数量类保留短数值。
   */
  private formatSeriesValue(seriesName: string, value: number): string {
    if (/金额|万/u.test(seriesName)) {
      return `${Number(value.toFixed(2))}万`;
    }

    return String(Number(value.toFixed(2)));
  }

  /**
   * 标准化指标名称。
   *
   * 参数说明：`label` 为原始系列名。
   * 返回值说明：移除括号单位后的短指标名。
   */
  private normalizeMetricLabel(label: string): string {
    return label.replace(/（.*?）/gu, '').replace(/\(.*?\)/gu, '').trim();
  }

  /**
   * 从区块标题中解析对比指标名。
   *
   * 参数说明：`title` 为看板区块标题。
   * 返回值说明：能识别时返回“订单金额、商机数”等单一口径指标。
   */
  private resolveComparisonMetricLabel(title: string): string | undefined {
    const normalizedTitle = title.trim();
    const byMetric = normalizedTitle.match(/按(.+?)）/u)?.[1];
    if (byMetric) {
      return byMetric;
    }

    return normalizedTitle.match(/(?:区域|大区|负责人|团队)(.+?)(?:排行|对比|明细)/u)?.[1];
  }

  /**
   * 根据指标名读取同口径数值。
   *
   * 参数说明：`row` 为排行表首行，`metricLabel` 为标题解析出的指标口径。
   * 返回值说明：返回该口径对应的数值；无明确口径时返回 undefined。
   */
  private resolveRowMetricValue(
    row: Record<string, string | number>,
    metricLabel?: string,
  ): number | undefined {
    if (!metricLabel) {
      return undefined;
    }

    const fieldByMetric: Array<[RegExp, string[]]> = [
      [/订单金额/u, ['orderAmount', 'amount']],
      [/报价金额/u, ['quoteAmount', 'amount']],
      [/商机金额/u, ['opportunityAmount', 'oppAmount', 'amount']],
      [/订单数|下单数/u, ['orderCount', 'count']],
      [/报价数/u, ['quoteCount', 'count']],
      [/商机数/u, ['opportunityCount', 'oppCount', 'count']],
      [/报备数/u, ['registrationCount', 'count']],
    ];
    const fields = fieldByMetric.find(([pattern]) => pattern.test(metricLabel))?.[1] ?? [];
    for (const field of fields) {
      const value = this.toNumber(row[field]);
      if (value > 0) {
        return value;
      }
    }

    return undefined;
  }

  /**
   * 将卡片候选值转为数字。
   */
  private toNumber(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = Number(value.replace(/[,，万%％]/gu, ''));
      return Number.isFinite(normalized) ? normalized : 0;
    }
    return 0;
  }

  /**
   * 格式化地图覆盖率。
   *
   * 参数说明：`covered/total` 分别为已覆盖区域数和总区域数。
   * 返回值说明：返回“已覆盖/总数（占比）”。
   */
  private formatCoverageValue(covered: number, total: number): string {
    return `${covered}/${total}（${this.formatPercentage(covered, total)}）`;
  }

  /**
   * 格式化趋势最新值。
   *
   * 参数说明：`seriesName/latestValue/previousValue` 分别为系列名称、最新值和上一期值。
   * 返回值说明：包含最新值和较上一期变化。
   */
  private formatTrendValue(
    seriesName: string,
    latestValue: number,
    previousValue?: number,
  ): string {
    const latestText = this.formatSeriesValue(seriesName, latestValue);
    if (previousValue === undefined) {
      return latestText;
    }

    const diff = latestValue - previousValue;
    const sign = diff > 0 ? '+' : '';
    return `${latestText}，较前${sign}${this.formatSeriesValue(seriesName, diff)}`;
  }

  /**
   * 格式化占比。
   *
   * 参数说明：`value/total` 分别为当前值和总值。
   * 返回值说明：返回一位小数百分比。
   */
  private formatPercentage(value: number, total: number): string {
    if (!Number.isFinite(total) || total <= 0) {
      return '0.0%';
    }

    return `${((value / total) * 100).toFixed(1)}%`;
  }

  /**
   * 查找最大值下标。
   *
   * 参数说明：`values` 为数值数组。
   * 返回值说明：返回最大值所在下标，空数组返回 0。
   */
  private findMaxValueIndex(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }

    return values.reduce((maxIndex, value, index) => value > values[maxIndex] ? index : maxIndex, 0);
  }

  /**
   * 裁剪指标名称。
   *
   * 参数说明：`label` 为原始指标名。
   * 返回值说明：返回适合企微卡片短标签的指标名。
   */
  private truncateMetricLabel(label: string): string {
    const normalizedLabel = this.normalizeMetricLabel(label);
    return normalizedLabel.length > 4 ? normalizedLabel.slice(0, 4) : normalizedLabel;
  }

  /**
   * 解析数据来源中文标签。
   *
   * 参数说明：`dataSource` 为看板数据来源枚举。
   * 返回值说明：返回面向业务用户的中文数据来源。
   */
  private resolveDataSourceLabel(dataSource: DashboardComposeResult['dataSource']): string {
    return dataSource === 'OPENAPI_REALTIME' ? '实时数据' : 'CRM 同步数据';
  }
}

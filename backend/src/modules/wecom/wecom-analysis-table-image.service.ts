import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import {
  buildWecomMarkdownTableModel,
  formatWecomMarkdownTableCellValue,
  type WecomMarkdownTableColumn,
} from '../analysis/analysis-wecom-markdown-table.util';
import type { MetricCard } from '../../shared/types/domain';

interface WecomAnalysisTableImageInput {
  title?: string;
  summary?: string;
  metricCards?: MetricCard[];
  variant?: 'ranking' | 'trend' | 'distribution' | 'map' | 'summary';
  layout?: 'detail' | 'card';
  rows: Array<Record<string, unknown>>;
}

export interface WecomAnalysisTableImageArtifact {
  filename: string;
  buffer: Buffer;
  previewText: string;
  width: number;
  height: number;
  aspectRatio: number;
}

@Injectable()
export class WecomAnalysisTableImageService {
  private readonly imageWidth = 1160;
  private readonly sidePadding = 44;
  private readonly titleHeight = 112;
  private readonly metricCardHeight = 86;
  private readonly tableHeaderHeight = 48;
  private readonly rowHeight = 48;
  private readonly footerHeight = 58;
  private readonly sequenceColumnWidth = 72;
  private readonly fontFamily =
    'Noto Sans CJK SC, Source Han Sans SC, WenQuanYi Micro Hei, WenQuanYi Zen Hei, Microsoft YaHei, PingFang SC, SimHei, sans-serif';

  /**
   * 生成企微可上传的分析结果表格图片。
   *
   * 参数说明：`input` 包含标题、摘要和统一结果明细行。
   * 返回值说明：有可展示表格时返回 PNG 图片；没有行或没有列时返回 `undefined`。
   * 调用注意事项：该能力只做展示增强，失败时外层应继续发送 Markdown 文本，不能阻断主分析结果回传。
   */
  async renderTableImage(
    input: WecomAnalysisTableImageInput,
  ): Promise<WecomAnalysisTableImageArtifact | undefined> {
    const tableModel = buildWecomMarkdownTableModel(input.rows);
    if (tableModel.columns.length === 0 || tableModel.visibleRows.length === 0) {
      return undefined;
    }

    const svgResult =
      input.layout === 'card'
        ? this.buildCardSvg(input, tableModel)
        : { svg: this.buildSvg(input, tableModel), height: this.resolveDetailImageHeight(input, tableModel) };
    const svg = svgResult.svg;
    const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
    return {
      filename:
        input.layout === 'card'
          ? `crm-analysis-card-${Date.now()}.png`
          : `crm-analysis-table-${Date.now()}.png`,
      buffer,
      previewText:
        input.layout === 'card'
          ? `分析结果卡片图表，共 ${tableModel.totalRowCount} 条，展示核心趋势和指标。`
          : `分析结果表格图片，共 ${tableModel.totalRowCount} 条，展示 ${tableModel.visibleRows.length} 条。`,
      width: this.imageWidth,
      height: svgResult.height,
      aspectRatio: Number((this.imageWidth / svgResult.height).toFixed(2)),
    };
  }

  /**
   * 解析明细图片高度。
   *
   * 参数说明：`input` 为图片输入，`tableModel` 为企微表格模型。
   * 返回值说明：返回完整表格海报高度，供 PNG 元数据和企微卡片宽高比使用。
   */
  private resolveDetailImageHeight(
    input: WecomAnalysisTableImageInput,
    tableModel: ReturnType<typeof buildWecomMarkdownTableModel>,
  ): number {
    const metricCards = (input.metricCards ?? []).slice(0, 4);
    const metricSectionHeight = metricCards.length > 0 ? this.metricCardHeight : 0;
    const chartModel = this.buildChartModel(input, tableModel);
    const chartSectionHeight = chartModel
      ? this.resolveChartSectionHeight(chartModel)
      : 0;

    return (
      this.titleHeight +
      metricSectionHeight +
      chartSectionHeight +
      this.tableHeaderHeight +
      tableModel.visibleRows.length * this.rowHeight +
      this.footerHeight
    );
  }

  /**
   * 构造 SVG 版式，再交给 sharp 转 PNG。
   *
   * 参数说明：`input` 为表格基础信息，`tableModel` 为已裁剪的企微表格模型。
   * 返回值说明：返回完整 SVG 字符串。
   */
  private buildSvg(
    input: WecomAnalysisTableImageInput,
    tableModel: ReturnType<typeof buildWecomMarkdownTableModel>,
  ): string {
    const tableWidth = this.imageWidth - this.sidePadding * 2;
    const businessColumnWidth =
      (tableWidth - this.sequenceColumnWidth) / tableModel.columns.length;
    const metricCards = (input.metricCards ?? []).slice(0, 4);
    const metricSectionHeight = metricCards.length > 0 ? this.metricCardHeight : 0;
    const chartModel = this.buildChartModel(input, tableModel);
    const chartSectionHeight = chartModel
      ? this.resolveChartSectionHeight(chartModel)
      : 0;
    const imageHeight = this.resolveDetailImageHeight(input, tableModel);
    const chartTop = this.titleHeight + metricSectionHeight;
    const tableTop = this.titleHeight + metricSectionHeight + chartSectionHeight;
    const title = this.truncate(input.title || 'CRM 智能分析结果', 34);
    const summary = this.truncate(
      this.sanitizeSummary(input.summary || '以下为企业微信图片版结果，便于截图和转发。'),
      54,
    );
    const metricCardsSvg = this.buildMetricCards(metricCards, this.titleHeight - 8, tableWidth);
    const chartSvg = chartModel
      ? this.buildChart(chartModel, chartTop, tableWidth)
      : '';
    const headerCells = [
      this.buildTextCell('序号', this.sidePadding, tableTop, this.sequenceColumnWidth, true),
      ...tableModel.columns.map((column, index) =>
        this.buildTextCell(
          column.label,
          this.sidePadding + this.sequenceColumnWidth + index * businessColumnWidth,
          tableTop,
          businessColumnWidth,
          true,
        ),
      ),
    ].join('');
    const rowCells = tableModel.visibleRows
      .map((row, rowIndex) => {
        const y = tableTop + this.tableHeaderHeight + rowIndex * this.rowHeight;
        const background = rowIndex % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        const cells = [
          this.buildTextCell(String(rowIndex + 1), this.sidePadding, y, this.sequenceColumnWidth),
          ...tableModel.columns.map((column, columnIndex) =>
            this.buildTextCell(
              this.truncate(
                formatWecomMarkdownTableCellValue(row[column.key], column, row),
                this.resolveCellTextLimit(businessColumnWidth),
              ),
              this.sidePadding +
                this.sequenceColumnWidth +
                columnIndex * businessColumnWidth,
              y,
              businessColumnWidth,
            ),
          ),
        ].join('');

        return `<rect x="${this.sidePadding}" y="${y}" width="${tableWidth}" height="${this.rowHeight}" fill="${background}"/>${cells}`;
      })
      .join('');
    const footerText =
      tableModel.totalRowCount > tableModel.visibleRows.length
        ? `共 ${tableModel.totalRowCount} 条，图片展示前 ${tableModel.visibleRows.length} 条；可继续补充筛选条件缩小范围。`
        : `共 ${tableModel.totalRowCount} 条。`;

    return `
<svg xmlns="http://www.w3.org/2000/svg" width="${this.imageWidth}" height="${imageHeight}" viewBox="0 0 ${this.imageWidth} ${imageHeight}">
  <rect width="100%" height="100%" fill="#F3F6F8"/>
  <rect x="24" y="24" width="${this.imageWidth - 48}" height="${imageHeight - 48}" rx="26" fill="#FFFFFF"/>
  <text x="${this.sidePadding}" y="64" font-family="${this.fontFamily}" font-size="30" font-weight="700" fill="#15202B">${this.escapeXml(title)}</text>
  <text x="${this.sidePadding}" y="94" font-family="${this.fontFamily}" font-size="16" fill="#5C6670">${this.escapeXml(summary)}</text>
  ${metricCardsSvg}
  ${chartSvg}
  <rect x="${this.sidePadding}" y="${tableTop}" width="${tableWidth}" height="${this.tableHeaderHeight}" rx="14" fill="#20322E"/>
  ${headerCells}
  ${rowCells}
  <rect x="${this.sidePadding}" y="${tableTop}" width="${tableWidth}" height="${this.tableHeaderHeight + tableModel.visibleRows.length * this.rowHeight}" rx="14" fill="none" stroke="#D6DEE4"/>
  <text x="${this.sidePadding}" y="${imageHeight - 30}" font-family="${this.fontFamily}" font-size="15" fill="#68727D">${this.escapeXml(footerText)}</text>
</svg>`.trim();
  }

  /**
   * 构造适合企微 news_notice 卡片首屏展示的紧凑图表。
   *
   * 参数说明：`input` 为图片输入，`tableModel` 为已归一化的结果表。
   * 返回值说明：返回 SVG 字符串和图片高度。
   * 调用注意事项：卡片版只放指标和图表，不放长表格，避免企微卡片中内容被挤到下方。
   */
  private buildCardSvg(
    input: WecomAnalysisTableImageInput,
    tableModel: ReturnType<typeof buildWecomMarkdownTableModel>,
  ): { svg: string; height: number } {
    const tableWidth = this.imageWidth - this.sidePadding * 2;
    const metricCards = (input.metricCards ?? []).slice(0, 4);
    const metricSectionHeight = metricCards.length > 0 ? this.metricCardHeight : 0;
    const chartModel = this.buildChartModel(input, tableModel);
    const chartSectionHeight = chartModel
      ? this.resolveChartSectionHeight(chartModel)
      : 0;
    const imageHeight = Math.max(
      560,
      this.titleHeight + metricSectionHeight + chartSectionHeight + this.footerHeight,
    );
    const chartTop = this.titleHeight + metricSectionHeight;
    const title = this.truncate(input.title || 'CRM 智能分析图表', 34);
    const summary = this.truncate(
      this.sanitizeSummary(input.summary || '以下为企业微信卡片版图表，便于直接查看趋势和对比。'),
      54,
    );
    const metricCardsSvg = this.buildMetricCards(metricCards, this.titleHeight - 8, tableWidth);
    const chartSvg = chartModel
      ? this.buildChart(chartModel, chartTop, tableWidth)
      : this.buildCardFallbackList(tableModel, chartTop, tableWidth);
    const footerText = `图表基于本次返回数据生成，共 ${tableModel.totalRowCount} 条；完整明细请打开备查报告。`;

    return {
      height: imageHeight,
      svg: `
<svg xmlns="http://www.w3.org/2000/svg" width="${this.imageWidth}" height="${imageHeight}" viewBox="0 0 ${this.imageWidth} ${imageHeight}">
  <rect width="100%" height="100%" fill="#F3F6F8"/>
  <rect x="24" y="24" width="${this.imageWidth - 48}" height="${imageHeight - 48}" rx="26" fill="#FFFFFF"/>
  <text x="${this.sidePadding}" y="64" font-family="${this.fontFamily}" font-size="30" font-weight="700" fill="#15202B">${this.escapeXml(title)}</text>
  <text x="${this.sidePadding}" y="94" font-family="${this.fontFamily}" font-size="16" fill="#5C6670">${this.escapeXml(summary)}</text>
  ${metricCardsSvg}
  ${chartSvg}
  <text x="${this.sidePadding}" y="${imageHeight - 30}" font-family="${this.fontFamily}" font-size="15" fill="#68727D">${this.escapeXml(footerText)}</text>
</svg>`.trim(),
    };
  }

  /**
   * 构造无数值图表时的卡片兜底列表。
   *
   * 参数说明：`tableModel` 为表格模型，`top/tableWidth` 控制绘制区域。
   * 返回值说明：返回前三条关键明细，保证图片不为空。
   */
  private buildCardFallbackList(
    tableModel: ReturnType<typeof buildWecomMarkdownTableModel>,
    top: number,
    tableWidth: number,
  ): string {
    const rows = tableModel.visibleRows.slice(0, 4);
    const columns = tableModel.columns.slice(0, 3);
    const rowSvg = rows
      .map((row, rowIndex) => {
        const y = top + 62 + rowIndex * 54;
        const text = columns
          .map((column) => formatWecomMarkdownTableCellValue(row[column.key], column, row))
          .filter((item) => item.trim() !== '')
          .slice(0, 3)
          .join(' / ');
        return `
  <rect x="${this.sidePadding}" y="${y - 30}" width="${tableWidth}" height="42" rx="12" fill="${rowIndex % 2 === 0 ? '#F8FAFC' : '#FFFFFF'}" stroke="#DDE5E0"/>
  <text x="${this.sidePadding + 18}" y="${y - 4}" font-family="${this.fontFamily}" font-size="15" fill="#20303C">${this.escapeXml(this.truncate(text || `第 ${rowIndex + 1} 条`, 56))}</text>`;
      })
      .join('');

    return `
  <text x="${this.sidePadding}" y="${top + 30}" font-family="${this.fontFamily}" font-size="18" font-weight="700" fill="#15202B">${this.escapeXml('关键明细')}</text>
  ${rowSvg}`;
  }

  /**
   * 构造企微图片顶部指标卡。
   *
   * 参数说明：`metricCards` 为结果中的关键指标，`top` 为卡片区域顶部，`tableWidth` 为内容宽度。
   * 返回值说明：返回 SVG 片段；无指标时返回空字符串。
   * 调用注意事项：这里只展示前 4 个指标，避免手机端图片首屏过密。
   */
  private buildMetricCards(
    metricCards: MetricCard[],
    top: number,
    tableWidth: number,
  ): string {
    if (metricCards.length === 0) {
      return '';
    }

    const gap = 14;
    const cardWidth = (tableWidth - gap * (metricCards.length - 1)) / metricCards.length;
    return metricCards
      .map((metric, index) => {
        const x = this.sidePadding + index * (cardWidth + gap);
        return `
  <rect x="${x}" y="${top}" width="${cardWidth}" height="62" rx="16" fill="#F5F8F6" stroke="#DCE7E1"/>
  <text x="${x + 18}" y="${top + 25}" font-family="${this.fontFamily}" font-size="14" fill="#66736D">${this.escapeXml(this.truncate(metric.name, 12))}</text>
  <text x="${x + 18}" y="${top + 50}" font-family="${this.fontFamily}" font-size="22" font-weight="700" fill="#18362F">${this.escapeXml(this.truncate(String(metric.value), 16))}</text>`;
      })
      .join('');
  }

  /**
   * 从结果表格中提炼适合图片化展示的条形图模型。
   *
   * 参数说明：`input` 为结果上下文，`tableModel` 为企微裁剪后的表格模型。
   * 返回值说明：有数值列时返回最多 6 条图示数据；否则返回 undefined。
   * 调用注意事项：图示只用于增强阅读，不参与事实计算，必须基于已返回结果行生成。
   */
  private buildChartModel(
    input: WecomAnalysisTableImageInput,
    tableModel: ReturnType<typeof buildWecomMarkdownTableModel>,
  ):
    | {
        title: string;
        valueColumn: WecomMarkdownTableColumn;
        labelColumn?: WecomMarkdownTableColumn;
        variant: NonNullable<WecomAnalysisTableImageInput['variant']>;
        maxValue: number;
        items: Array<{ label: string; value: number; valueText: string }>;
      }
    | undefined {
    const valueColumn =
      tableModel.columns.find((column) => column.valueType === 'amount') ??
      tableModel.columns.find((column) => column.valueType === 'number') ??
      this.resolveFallbackChartValueColumn(input.rows);
    if (!valueColumn) {
      return undefined;
    }

    const labelColumn =
      tableModel.columns.find((column) => column.key !== valueColumn.key) ??
      this.resolveFallbackChartLabelColumn(input.rows, valueColumn.key);
    const items = tableModel.visibleRows
      .slice(0, 6)
      .map((row, index) => {
        const value = this.toNumber(row[valueColumn.key]);
        return {
          label: this.truncate(
            String(labelColumn ? row[labelColumn.key] ?? `第 ${index + 1} 项` : `第 ${index + 1} 项`),
            16,
          ),
          value,
          valueText: formatWecomMarkdownTableCellValue(row[valueColumn.key], valueColumn),
        };
      })
      .filter((item) => item.value > 0);

    if (items.length === 0) {
      return undefined;
    }

    const titleMap: Record<NonNullable<WecomAnalysisTableImageInput['variant']>, string> = {
      ranking: '贡献排行图示',
      trend: '趋势图示',
      distribution: '分布图示',
      map: '省份覆盖热力图',
      summary: '重点图示',
    };

    return {
      title: titleMap[input.variant ?? 'summary'],
      valueColumn,
      labelColumn,
      variant: input.variant ?? 'summary',
      maxValue: Math.max(...items.map((item) => item.value)),
      items,
    };
  }

  /**
   * 识别图表兜底数值列。
   *
   * 参数说明：`rows` 为图片数据行。
   * 返回值说明：当企微表格白名单没有收录中文数值列时，返回适合画图的第一列数值。
   */
  private resolveFallbackChartValueColumn(
    rows: Array<Record<string, unknown>>,
  ): WecomMarkdownTableColumn | undefined {
    const firstRow = rows[0];
    if (!firstRow) {
      return undefined;
    }

    const keys = Object.keys(firstRow);
    const valueKey = keys.find((key) => {
      if (this.isLikelyLabelColumnKey(key)) {
        return false;
      }

      return rows.some((row) => this.toNumber(row[key]) > 0);
    });
    if (!valueKey) {
      return undefined;
    }

    return {
      key: valueKey,
      label: valueKey,
      valueType: this.isLikelyAmountColumnKey(valueKey) ? 'amount' : 'number',
    };
  }

  /**
   * 识别图表兜底标签列。
   *
   * 参数说明：`rows` 为图片数据行，`valueKey` 为已选数值列。
   * 返回值说明：优先返回月份、阶段、区域、分组等可读标签列。
   */
  private resolveFallbackChartLabelColumn(
    rows: Array<Record<string, unknown>>,
    valueKey: string,
  ): WecomMarkdownTableColumn | undefined {
    const firstRow = rows[0];
    if (!firstRow) {
      return undefined;
    }

    const keys = Object.keys(firstRow).filter((key) => key !== valueKey);
    const labelKey =
      keys.find((key) => this.isLikelyLabelColumnKey(key)) ??
      keys.find((key) => rows.some((row) => String(row[key] ?? '').trim() !== ''));
    if (!labelKey) {
      return undefined;
    }

    return {
      key: labelKey,
      label: labelKey,
      valueType: 'text',
    };
  }

  private isLikelyLabelColumnKey(key: string): boolean {
    return /(月份|季度|日期|阶段|区域|大区|分组|分类|渠道|客户|名称|name|label|month|date|region|category|stage)/iu.test(
      key,
    );
  }

  private isLikelyAmountColumnKey(key: string): boolean {
    return /(金额|额|收入|回款|amount|amt|income|revenue|price|money)/iu.test(key);
  }

  /**
   * 解析图示区域高度。
   *
   * 参数说明：`chartModel` 为已提炼的图示数据。
   * 返回值说明：趋势图和占比图使用固定绘图区，排行图按行数伸缩。
   */
  private resolveChartSectionHeight(
    chartModel: NonNullable<ReturnType<WecomAnalysisTableImageService['buildChartModel']>>,
  ): number {
    if (chartModel.variant === 'trend' || chartModel.variant === 'distribution') {
      return 252;
    }

    if (chartModel.variant === 'map') {
      return 360;
    }

    return 82 + chartModel.items.length * 58;
  }

  /**
   * 根据图片看板类型构造对应 SVG 图示。
   *
   * 参数说明：`chartModel` 为已提炼的图示数据，`top` 控制图示区域顶部。
   * 返回值说明：返回适合嵌入结果海报的 SVG 片段。
   */
  private buildChart(
    chartModel: NonNullable<ReturnType<WecomAnalysisTableImageService['buildChartModel']>>,
    top: number,
    tableWidth: number,
  ): string {
    if (chartModel.variant === 'trend') {
      return this.buildLineChart(chartModel, top, tableWidth);
    }

    if (chartModel.variant === 'distribution') {
      return this.buildDonutChart(chartModel, top, tableWidth);
    }

    if (chartModel.variant === 'map') {
      return this.buildProvinceHeatMapChart(chartModel, top, tableWidth);
    }

    return this.buildBarChart(chartModel, top, tableWidth);
  }

  /**
   * 构造排行和概览场景的条形图 SVG。
   *
   * 参数说明：`chartModel` 为图示模型，`top/tableWidth` 控制绘制区域。
   * 返回值说明：返回条形图 SVG 片段。
   */
  private buildBarChart(
    chartModel: NonNullable<ReturnType<WecomAnalysisTableImageService['buildChartModel']>>,
    top: number,
    tableWidth: number,
  ): string {
    const chartTop = top + 12;
    const valueWidth = 150;
    const barAreaWidth = tableWidth - valueWidth - 18;
    const rows = chartModel.items
      .map((item, index) => {
        const y = chartTop + 46 + index * 58;
        const barWidth = Math.max(8, (item.value / chartModel.maxValue) * barAreaWidth);
        return `
  <text x="${this.sidePadding + 18}" y="${y}" font-family="${this.fontFamily}" font-size="15" fill="#34433D">${this.escapeXml(item.label)}</text>
  <rect x="${this.sidePadding + 18}" y="${y + 14}" width="${barAreaWidth}" height="18" rx="9" fill="#EDF3F0"/>
  <rect x="${this.sidePadding + 18}" y="${y + 14}" width="${barWidth}" height="18" rx="9" fill="#2F6B57"/>
  <text x="${this.sidePadding + 18 + barAreaWidth + 18}" y="${y + 30}" font-family="${this.fontFamily}" font-size="14" font-weight="700" fill="#18362F">${this.escapeXml(this.truncate(item.valueText, 12))}</text>`;
      })
      .join('');

    return `
  <text x="${this.sidePadding}" y="${chartTop + 20}" font-family="${this.fontFamily}" font-size="18" font-weight="700" fill="#15202B">${this.escapeXml(chartModel.title)}</text>
  <text x="${this.sidePadding + 110}" y="${chartTop + 20}" font-family="${this.fontFamily}" font-size="14" fill="#68727D">按 ${this.escapeXml(chartModel.valueColumn.label)} 展示前 ${chartModel.items.length} 项</text>
  ${rows}`;
  }

  /**
   * 构造趋势场景的折线图 SVG。
   *
   * 参数说明：`chartModel` 为图示模型，`top/tableWidth` 控制绘制区域。
   * 返回值说明：返回折线图 SVG 片段。
   * 调用注意事项：折线只表达图片中可见行的走势，不替代完整报告中的交互图。
   */
  private buildLineChart(
    chartModel: NonNullable<ReturnType<WecomAnalysisTableImageService['buildChartModel']>>,
    top: number,
    tableWidth: number,
  ): string {
    const chartTop = top + 12;
    const plotX = this.sidePadding + 46;
    const plotY = chartTop + 54;
    const plotWidth = tableWidth - 92;
    const plotHeight = 132;
    const safeMaxValue = Math.max(1, chartModel.maxValue);
    const points = chartModel.items.map((item, index) => {
      const x = plotX + (chartModel.items.length === 1 ? plotWidth / 2 : (index / (chartModel.items.length - 1)) * plotWidth);
      const y = plotY + plotHeight - (item.value / safeMaxValue) * plotHeight;
      return { ...item, x, y };
    });
    const polylinePoints = points.map((point) => `${point.x},${point.y}`).join(' ');
    const pointSvg = points
      .map(
        (point, index) => `
  <circle cx="${point.x}" cy="${point.y}" r="5.5" fill="#2F6B57" stroke="#FFFFFF" stroke-width="3"/>
  <text x="${point.x}" y="${point.y - 12}" text-anchor="middle" font-family="${this.fontFamily}" font-size="12" font-weight="700" fill="#18362F">${this.escapeXml(this.truncate(point.valueText, 10))}</text>
  <text x="${point.x}" y="${plotY + plotHeight + 28}" text-anchor="middle" font-family="${this.fontFamily}" font-size="12" fill="#68727D">${this.escapeXml(this.truncate(index % 2 === 0 || points.length <= 5 ? point.label : '', 8))}</text>`,
      )
      .join('');

    return `
  <text x="${this.sidePadding}" y="${chartTop + 20}" font-family="${this.fontFamily}" font-size="18" font-weight="700" fill="#15202B">${this.escapeXml(chartModel.title)}</text>
  <text x="${this.sidePadding + 90}" y="${chartTop + 20}" font-family="${this.fontFamily}" font-size="14" fill="#68727D">按 ${this.escapeXml(chartModel.valueColumn.label)} 展示走势</text>
  <line x1="${plotX}" y1="${plotY + plotHeight}" x2="${plotX + plotWidth}" y2="${plotY + plotHeight}" stroke="#D6DEE4" stroke-width="1"/>
  <line x1="${plotX}" y1="${plotY}" x2="${plotX}" y2="${plotY + plotHeight}" stroke="#D6DEE4" stroke-width="1"/>
  <polyline points="${polylinePoints}" fill="none" stroke="#2F6B57" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  ${pointSvg}`;
  }

  /**
   * 构造分布场景的占比环图 SVG。
   *
   * 参数说明：`chartModel` 为图示模型，`top/tableWidth` 控制绘制区域。
   * 返回值说明：返回占比环图和图例 SVG 片段。
   * 调用注意事项：占比基于当前图片可见行聚合，完整结构以 HTML 报告图表为准。
   */
  private buildDonutChart(
    chartModel: NonNullable<ReturnType<WecomAnalysisTableImageService['buildChartModel']>>,
    top: number,
    tableWidth: number,
  ): string {
    const chartTop = top + 12;
    const centerX = this.sidePadding + 132;
    const centerY = chartTop + 126;
    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    const totalValue = Math.max(1, chartModel.items.reduce((sum, item) => sum + item.value, 0));
    const colors = ['#2F6B57', '#68A87D', '#D5A33A', '#4F82C4', '#A06CC7', '#D66F5D'];
    let offset = 0;
    const segmentSvg = chartModel.items
      .map((item, index) => {
        const segmentLength = (item.value / totalValue) * circumference;
        const dashOffset = -offset;
        offset += segmentLength;
        return `<circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="none" stroke="${colors[index % colors.length]}" stroke-width="28" stroke-dasharray="${segmentLength} ${circumference - segmentLength}" stroke-dashoffset="${dashOffset}" transform="rotate(-90 ${centerX} ${centerY})"/>`;
      })
      .join('');
    const legendSvg = chartModel.items
      .slice(0, 6)
      .map((item, index) => {
        const y = chartTop + 70 + index * 28;
        const percentage = `${((item.value / totalValue) * 100).toFixed(1)}%`;
        return `
  <rect x="${this.sidePadding + 292}" y="${y - 12}" width="12" height="12" rx="3" fill="${colors[index % colors.length]}"/>
  <text x="${this.sidePadding + 314}" y="${y}" font-family="${this.fontFamily}" font-size="14" fill="#34433D">${this.escapeXml(this.truncate(item.label, 18))}</text>
  <text x="${this.sidePadding + tableWidth - 120}" y="${y}" font-family="${this.fontFamily}" font-size="14" font-weight="700" fill="#18362F">${this.escapeXml(percentage)}</text>`;
      })
      .join('');

    return `
  <text x="${this.sidePadding}" y="${chartTop + 20}" font-family="${this.fontFamily}" font-size="18" font-weight="700" fill="#15202B">${this.escapeXml(chartModel.title)}</text>
  <text x="${this.sidePadding + 90}" y="${chartTop + 20}" font-family="${this.fontFamily}" font-size="14" fill="#68727D">按 ${this.escapeXml(chartModel.valueColumn.label)} 计算占比</text>
  <circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="none" stroke="#EDF3F0" stroke-width="28"/>
  ${segmentSvg}
  <circle cx="${centerX}" cy="${centerY}" r="43" fill="#FFFFFF"/>
  <text x="${centerX}" y="${centerY - 5}" text-anchor="middle" font-family="${this.fontFamily}" font-size="15" fill="#68727D">合计</text>
  <text x="${centerX}" y="${centerY + 23}" text-anchor="middle" font-family="${this.fontFamily}" font-size="18" font-weight="700" fill="#18362F">${this.escapeXml(this.truncate(String(Math.round(totalValue)), 10))}</text>
  ${legendSvg}`;
  }

  /**
   * 构造企微图片版省份覆盖热力图。
   *
   * 参数说明：`chartModel` 为图示模型，`top/tableWidth` 控制绘制区域。
   * 返回值说明：返回省份矩阵热力图 SVG 片段。
   * 调用注意事项：这是企微内可直接查看的静态覆盖图，不依赖 HTML 或交互地图脚本。
   */
  private buildProvinceHeatMapChart(
    chartModel: NonNullable<ReturnType<WecomAnalysisTableImageService['buildChartModel']>>,
    top: number,
    tableWidth: number,
  ): string {
    const chartTop = top + 12;
    const provinceValues = new Map(
      chartModel.items.map((item) => [this.normalizeProvinceName(item.label), item.value]),
    );
    const provinceCells = this.resolveProvinceHeatMapCells();
    const gridLeft = this.sidePadding + 18;
    const gridTop = chartTop + 54;
    const cellWidth = 82;
    const cellHeight = 42;
    const cellGap = 8;
    const maxValue = Math.max(1, ...chartModel.items.map((item) => item.value));
    const coveredCount = provinceCells.filter((cell) => (provinceValues.get(cell.name) ?? 0) > 0).length;
    const cellsSvg = provinceCells
      .map((cell) => {
        const value = provinceValues.get(cell.name) ?? 0;
        const ratio = Math.min(1, value / maxValue);
        const fill = value > 0 ? this.resolveHeatMapColor(ratio) : '#F3F6F8';
        const stroke = value > 0 ? '#2F6B57' : '#DDE5E0';
        const x = gridLeft + cell.col * (cellWidth + cellGap);
        const y = gridTop + cell.row * (cellHeight + cellGap);
        return `
  <rect x="${x}" y="${y}" width="${cellWidth}" height="${cellHeight}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>
  <text x="${x + 12}" y="${y + 18}" font-family="${this.fontFamily}" font-size="13" font-weight="700" fill="#18362F">${this.escapeXml(cell.name)}</text>
  <text x="${x + 12}" y="${y + 34}" font-family="${this.fontFamily}" font-size="12" fill="#34433D">${this.escapeXml(value > 0 ? `${value}` : '未覆盖')}</text>`;
      })
      .join('');

    return `
  <text x="${this.sidePadding}" y="${chartTop + 20}" font-family="${this.fontFamily}" font-size="18" font-weight="700" fill="#15202B">${this.escapeXml(chartModel.title || '省份覆盖热力图')}</text>
  <text x="${this.sidePadding + 142}" y="${chartTop + 20}" font-family="${this.fontFamily}" font-size="14" fill="#68727D">覆盖 ${coveredCount}/${provinceCells.length} 个省级区域，颜色越深表示数量越高</text>
  ${cellsSvg}`;
  }

  /**
   * 解析省份热力图矩阵位置。
   *
   * 返回值说明：返回 31 个省级区域的固定矩阵坐标。
   */
  private resolveProvinceHeatMapCells(): Array<{ name: string; row: number; col: number }> {
    const names = [
      '北京', '天津', '河北', '山西', '内蒙古', '辽宁', '吉林', '黑龙江',
      '上海', '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南',
      '湖北', '湖南', '广东', '广西', '海南', '重庆', '四川', '贵州',
      '云南', '西藏', '陕西', '甘肃', '青海', '宁夏', '新疆',
    ];
    return names.map((name, index) => ({
      name,
      row: Math.floor(index / 8),
      col: index % 8,
    }));
  }

  /**
   * 解析热力颜色。
   *
   * 参数说明：`ratio` 为当前值与最大值的比例。
   * 返回值说明：返回绿色系热力颜色。
   */
  private resolveHeatMapColor(ratio: number): string {
    if (ratio >= 0.75) {
      return '#5EA777';
    }

    if (ratio >= 0.45) {
      return '#91C7A3';
    }

    if (ratio >= 0.2) {
      return '#C7E6D2';
    }

    return '#E7F5ED';
  }

  /**
   * 构造表格单元格文本。
   *
   * 参数说明：`text` 为展示文本，`x/y/width` 控制单元格位置，`isHeader` 表示是否表头。
   * 返回值说明：返回 SVG 文本元素。
   */
  private buildTextCell(
    text: string,
    x: number,
    y: number,
    width: number,
    isHeader = false,
  ): string {
    const fill = isHeader ? '#FFFFFF' : '#20303C';
    const weight = isHeader ? 700 : 500;
    const size = isHeader ? 16 : 15;
    const centerY = y + (isHeader ? this.tableHeaderHeight : this.rowHeight) / 2 + 5;
    return `<text x="${x + 18}" y="${centerY}" font-family="${this.fontFamily}" font-size="${size}" font-weight="${weight}" fill="${fill}">${this.escapeXml(this.truncate(text, this.resolveCellTextLimit(width)))}</text>`;
  }

  /**
   * 按单元格宽度估算最大文本长度。
   *
   * 参数说明：`width` 为单元格像素宽度。
   * 返回值说明：返回适合单行展示的中文字符数上限。
   */
  private resolveCellTextLimit(width: number): number {
    return Math.max(6, Math.floor((width - 28) / 15));
  }

  /**
   * 截断长文本，避免图片单元格互相覆盖。
   *
   * 参数说明：`value` 为原始文本，`maxLength` 为最大字符数。
   * 返回值说明：超过上限时返回带省略号的文本。
   */
  private truncate(value: string, maxLength: number): string {
    const normalizedValue = value.replace(/\s+/gu, ' ').trim();
    if (normalizedValue.length <= maxLength) {
      return normalizedValue;
    }

    return `${normalizedValue.slice(0, Math.max(1, maxLength - 1))}…`;
  }

  /**
   * 清理图片摘要中的会话追问噪声。
   *
   * 参数说明：`value` 为统一报告摘要，可能拼入“继续分析”等会话上下文。
   * 返回值说明：返回更适合图片头部展示的单句摘要。
   */
  private sanitizeSummary(value: string): string {
    return value
      .split(/；继续分析[:：]?/u)[0]
      .replace(/\s+/gu, ' ')
      .trim();
  }

  /**
   * 将结果行中的数值字段转为数字。
   *
   * 参数说明：`value` 为 CRM 或标准 API 返回的原始值。
   * 返回值说明：无法解析时返回 0，避免图片增强逻辑抛错影响主回复。
   */
  private toNumber(value: unknown): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === 'string') {
      const parsed = Number(value.replace(/,/gu, '').trim());
      return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
  }

  /**
   * 标准化省份名称。
   *
   * 参数说明：`value` 为行标签或区域名称。
   * 返回值说明：返回可与热力图省份矩阵匹配的简称。
   */
  private normalizeProvinceName(value: string): string {
    return value
      .replace(/省|市|自治区|壮族|回族|维吾尔|特别行政区|区域|大区|区/gu, '')
      .trim();
  }

  /**
   * 转义 SVG XML 特殊字符。
   *
   * 参数说明：`value` 为待写入 SVG 的文本。
   * 返回值说明：返回 XML 安全文本。
   */
  private escapeXml(value: string): string {
    return value
      .replace(/&/gu, '&amp;')
      .replace(/</gu, '&lt;')
      .replace(/>/gu, '&gt;')
      .replace(/"/gu, '&quot;')
      .replace(/'/gu, '&apos;');
  }
}

import { Injectable } from '@nestjs/common';
import type {
  AnalysisReportPayload,
  AnalysisResultRecord,
  MetricCard,
} from '../../shared/types/domain';
import { parseDisplayAmountToYuan } from '../../shared/utils/business-amount.util';
import { ResultAccuracyError } from './analysis.errors';
import {
  formatTemporalScopeLabel,
  isSameTemporalScope,
} from './temporal-scope.util';

@Injectable()
export class ResultConsistencyService {
  buildToken(
    requestId: string,
    tableRows: Array<Record<string, unknown>>,
    metricCards: MetricCard[],
    temporalScope?: AnalysisResultRecord['temporalScope'],
  ): string {
    const payload = JSON.stringify({
      rows: tableRows,
      metrics: metricCards,
      temporalScope,
    });
    const checksum = [...payload].reduce((accumulator, character) => {
      return (accumulator + character.charCodeAt(0)) % 100000;
    }, 0);
    return `${requestId}-rows-${tableRows.length}-sum-${checksum}`;
  }

  ensureConsistent(result: Pick<
    AnalysisResultRecord,
    'title' | 'summary' | 'metricCards' | 'tableRows' | 'primaryView'
    | 'temporalScope'
  > & {
    report?: AnalysisReportPayload;
  }): void {
    if (!result.title || !result.summary) {
      throw new ResultAccuracyError('结果准确性校验失败，缺少必要标题或摘要。');
    }

    if (result.report) {
      this.ensureReportReferences(result.report);
      this.ensureTemporalScopeConsistent(result.temporalScope, result.report);
      this.ensureMarkdownConsistent(result.summary, result.report);
      this.ensureRichReportConsistent(result.report);
    }
    this.ensureNoDuplicateGroups(result.tableRows);
    this.ensureMetricCardsBackfilled(result.metricCards, result.tableRows, result.report);
    this.ensurePrimaryViewAligned(result.primaryView?.series ?? [], result.tableRows);
  }

  private ensureReportReferences(report: AnalysisReportPayload): void {
    const referenceIds = new Set(report.datasetReferences.map((item) => item.datasetId));

    if (referenceIds.size === 0) {
      throw new ResultAccuracyError('结果准确性校验失败，报告缺少数据集引用。');
    }

    const hasUnknownChart = report.chartBlocks.some(
      (item) => !referenceIds.has(item.datasetId),
    );
    const hasUnknownTable = report.tableBlocks.some(
      (item) => !referenceIds.has(item.datasetId),
    );
    const hasUnknownFinding = report.keyFindings.some(
      (item) => !referenceIds.has(item.datasetId),
    );
    const hasUnknownSection = (report.sections ?? []).some(
      (item) => item.datasetId && !referenceIds.has(item.datasetId),
    );

    if (hasUnknownChart || hasUnknownTable || hasUnknownFinding || hasUnknownSection) {
      throw new ResultAccuracyError('结果准确性校验失败，报告块引用了未登记的数据集。');
    }
  }

  private ensureNoDuplicateGroups(rows: Array<Record<string, unknown>>): void {
    const keys = rows
      .map((row) => this.resolveAggregateGroupKey(row))
      .filter((key): key is string => Boolean(key));
    if (keys.length === 0) {
      return;
    }

    const uniqueKeys = new Set(keys);
    if (keys.length !== uniqueKeys.size) {
      throw new ResultAccuracyError('结果准确性校验失败，结果集中存在重复业务分组。');
    }
  }

  /**
   * 读取聚合结果行的业务分组键。
   *
   * 参数说明：`row` 为统一分析结果表格行。
   * 返回值：聚合排行、趋势、分类分布等结果返回稳定分组键；普通明细表返回 `undefined`。
   * 调用注意：服务商画像、详情明细这类结果可能没有 `ownerId/bucket_label/category`
   * 等聚合字段，不能把它们统一落成 `unknown`，否则多行明细会被误判为重复业务分组。
   */
  private resolveAggregateGroupKey(row: Record<string, unknown>): string | undefined {
    const rawKey =
      row.ownerId ??
      row.bucket_label ??
      row.bucketLabel ??
      row.category ??
      row.ownerName;
    const key = String(rawKey ?? '').trim();
    return key || undefined;
  }

  private ensureMetricCardsBackfilled(
    metricCards: MetricCard[],
    rows: Array<Record<string, unknown>>,
    report?: AnalysisReportPayload,
  ): void {
    if (rows.length === 0) {
      return;
    }

    const amountCard = this.findTotalAmountMetricCard(metricCards);
    const backfillRows = this.resolveMetricBackfillRows(amountCard, rows, report);
    const totalAmount = backfillRows.reduce((sum, row) => sum + this.toNumber(row.amount), 0);
    if (
      amountCard &&
      totalAmount > 0 &&
      this.hasMeaningfulNumericDifference(
        this.toNumber(amountCard.value),
        totalAmount,
        this.resolveAmountDisplayTolerance(amountCard.value),
      )
    ) {
      throw new ResultAccuracyError('结果准确性校验失败，金额汇总与结果明细不一致。');
    }

    const countCard = this.findRecordCountMetricCard(metricCards);
    const countBackfillRows = this.resolveMetricCountBackfillRows(countCard, rows, report);
    const totalCount = countBackfillRows.reduce((sum, row) => sum + this.toNumber(row.count), 0);
    const expectedCount = this.toNumber(countCard?.value);
    if (
      countCard &&
      expectedCount > 0 &&
      totalCount > expectedCount
    ) {
      throw new ResultAccuracyError('结果准确性校验失败，记录数与结果明细不一致。');
    }
  }

  /**
   * 选择指标卡回算使用的数据行。
   *
   * 参数说明：
   * - `amountCard`：需要校验的主金额指标卡。
   * - `rows`：当前前端主表展示行，可能是排名明细而不是总览行。
   * - `report`：结构化报告，包含所有查询任务对应的表格数据集。
   * 返回值：用于回算指标卡的事实行。
   * 调用注意：合同分析允许“全量合同总览 + TOP 排名明细”同时存在，合同总额必须按总览数据集回算。
   */
  private resolveMetricBackfillRows(
    amountCard: MetricCard | undefined,
    rows: Array<Record<string, unknown>>,
    report?: AnalysisReportPayload,
  ): Array<Record<string, unknown>> {
    if (!amountCard) {
      return rows;
    }

    const expectedAmount = this.toNumber(amountCard.value);
    if (expectedAmount <= 0) {
      return rows;
    }

    const tolerance = this.resolveAmountDisplayTolerance(amountCard.value);
    if (this.rowsAmountMatches(rows, expectedAmount, tolerance)) {
      return rows;
    }

    const matchedRows = this.resolveRowsMatchingAmount(report, expectedAmount, tolerance);
    if (matchedRows.length > 0) {
      return matchedRows;
    }

    const contractSummaryRows = this.resolveContractSummaryRows(report);
    return contractSummaryRows.length > 0 ? contractSummaryRows : rows;
  }

  /**
   * 从 richer report 中查找能回算指定金额的数据集。
   *
   * 参数说明：
   * - `report`：结构化报告，可为空。
   * - `expectedAmount`：指标卡声明的元级总额。
   * 返回值：金额合计与指标卡一致的表格行；找不到时返回空数组。
   * 调用注意：多任务报告会把“总览”和“排名”拆成不同表块，准确性校验应按事实数值匹配来源。
   */
  private resolveRowsMatchingAmount(
    report: AnalysisReportPayload | undefined,
    expectedAmount: number,
    tolerance: number,
  ): Array<Record<string, unknown>> {
    if (!report) {
      return [];
    }

    const preferredBlocks = report.tableBlocks.filter((item) =>
      this.isPrimarySummaryDataset(report, item.datasetId),
    );
    const candidateBlocks = [
      ...preferredBlocks,
      ...report.tableBlocks.filter((item) => !this.isPrimarySummaryDataset(report, item.datasetId)),
    ];

    for (const block of candidateBlocks) {
      if (this.rowsAmountMatches(block.rows, expectedAmount, tolerance)) {
        return block.rows;
      }
    }

    return [];
  }

  /**
   * 查找用于记录数回算的指标卡。
   *
   * 参数说明：`metricCards` 为报告指标卡。
   * 返回值：返回表示总记录数、商机数或命中对象数的指标卡；找不到时返回 `undefined`。
   * 调用注意：`分组数量` 不是业务记录总数，不能参与明细行 count 回算。
   */
  private findRecordCountMetricCard(metricCards: MetricCard[]): MetricCard | undefined {
    return metricCards.find((item) =>
      item.name === '记录数' ||
      item.name === '商机数量' ||
      /^命中.+数$/u.test(item.name),
    );
  }

  /**
   * 选择记录数回算使用的数据行。
   *
   * 参数说明：
   * - `countCard`：需要校验的记录数指标卡。
   * - `rows`：当前主展示表行，可能是趋势桶、阶段桶或裁剪后的 Top 明细。
   * - `report`：结构化报告，可能包含完整的主数据集或其它补充数据集。
   * 返回值：优先返回能与指标卡数量一致的数据行；找不到时返回当前展示行。
   * 调用注意：当展示行只是部分明细时，数量加总小于指标卡属于合法裁剪，不能误判为不一致。
   */
  private resolveMetricCountBackfillRows(
    countCard: MetricCard | undefined,
    rows: Array<Record<string, unknown>>,
    report?: AnalysisReportPayload,
  ): Array<Record<string, unknown>> {
    if (!countCard) {
      return rows;
    }

    const expectedCount = this.toNumber(countCard.value);
    if (expectedCount <= 0 || this.rowsCountMatches(rows, expectedCount)) {
      return rows;
    }

    const matchedRows = this.resolveRowsMatchingCount(report, expectedCount);
    return matchedRows.length > 0 ? matchedRows : rows;
  }

  /**
   * 从 richer report 中查找能回算指定记录数的数据集。
   *
   * 参数说明：`report` 为结构化报告，`expectedCount` 为指标卡声明的记录数。
   * 返回值：count 加总与指标卡一致的表格行；找不到时返回空数组。
   */
  private resolveRowsMatchingCount(
    report: AnalysisReportPayload | undefined,
    expectedCount: number,
  ): Array<Record<string, unknown>> {
    if (!report) {
      return [];
    }

    const preferredBlocks = report.tableBlocks.filter((item) =>
      this.isPrimarySummaryDataset(report, item.datasetId),
    );
    const candidateBlocks = [
      ...preferredBlocks,
      ...report.tableBlocks.filter((item) => !this.isPrimarySummaryDataset(report, item.datasetId)),
    ];

    for (const block of candidateBlocks) {
      if (this.rowsCountMatches(block.rows, expectedCount)) {
        return block.rows;
      }
    }

    return [];
  }

  /**
   * 判断一组行的 count 加总是否等于指标卡数量。
   *
   * 参数说明：`rows` 为候选事实行，`expectedCount` 为指标卡声明的记录数。
   * 返回值：行内存在 count 且合计一致时返回 true。
   */
  private rowsCountMatches(
    rows: Array<Record<string, unknown>>,
    expectedCount: number,
  ): boolean {
    if (rows.length === 0) {
      return false;
    }

    const rowCount = rows.reduce((sum, row) => sum + this.toNumber(row.count), 0);
    return rowCount > 0 && rowCount === expectedCount;
  }

  /**
   * 判断数据集是否为主汇总任务。
   *
   * 参数说明：
   * - `report`：结构化报告。
   * - `datasetId`：待判断的数据集编号。
   * 返回值：该数据集来自 `primary-summary` 任务时返回 `true`。
   */
  private isPrimarySummaryDataset(
    report: AnalysisReportPayload,
    datasetId: string,
  ): boolean {
    return report.datasetReferences.some(
      (item) => item.datasetId === datasetId && item.purpose === 'primary-summary',
    );
  }

  /**
   * 判断一组行的金额合计是否等于指标卡金额。
   *
   * 参数说明：
   * - `rows`：候选事实行。
   * - `expectedAmount`：指标卡声明的元级总额。
   * 返回值：金额差异在业务精度内返回 `true`。
   */
  private rowsAmountMatches(
    rows: Array<Record<string, unknown>>,
    expectedAmount: number,
    tolerance: number,
  ): boolean {
    if (rows.length === 0) {
      return false;
    }

    const rowAmount = rows.reduce((sum, row) => sum + this.toNumber(row.amount), 0);
    return !this.hasMeaningfulNumericDifference(expectedAmount, rowAmount, tolerance);
  }

  /**
   * 从 richer report 中提取合同金额总览数据集。
   *
   * 参数说明：`report` 为结构化报告，可为空。
   * 返回值：匹配“合同金额总览”的表格行；找不到时返回空数组。
   * 调用注意：这里不依赖前端主表，因为主表可能为了用户阅读体验切到负责人排名。
   */
  private resolveContractSummaryRows(
    report?: AnalysisReportPayload,
  ): Array<Record<string, unknown>> {
    if (!report) {
      return [];
    }

    const summaryDatasetIds = new Set(
      report.datasetReferences
        .filter((item) => item.taskTitle.includes('合同金额总览'))
        .map((item) => item.datasetId),
    );
    const matchedBlocks = report.tableBlocks.filter((item) =>
      summaryDatasetIds.has(item.datasetId) || item.title.includes('合同金额总览'),
    );
    const summaryRows = matchedBlocks.flatMap((item) =>
      item.rows.filter((row) => this.isContractSummaryRow(row)),
    );

    if (summaryRows.length > 0) {
      return summaryRows;
    }

    return matchedBlocks.flatMap((item) => item.rows);
  }

  /**
   * 判断一行是否为合同总览汇总行。
   *
   * 参数说明：`row` 为结构化表格行。
   * 返回值：命中汇总行标识返回 `true`。
   * 调用注意：线上历史结果可能只保留 `ownerName`，因此同时兼容 `ownerId` 和展示名。
   */
  private isContractSummaryRow(row: Record<string, unknown>): boolean {
    return row.ownerId === 'summary' || row.ownerName === '合同金额总览';
  }

  private ensurePrimaryViewAligned(
    series: Array<Record<string, unknown>>,
    rows: Array<Record<string, unknown>>,
  ): void {
    if (series.length === 0 || rows.length === 0) {
      return;
    }

    const rowMap = new Map<string, number>();
    for (const row of rows) {
      const label = String(row.ownerName ?? row.bucket_label ?? row.bucketLabel ?? row.category ?? '');
      const value = this.toNumber(row.amount) || this.toNumber(row.count);
      rowMap.set(label, value);
    }

    let comparableCount = 0;
    const hasMismatch = series.some((item) => {
      const label = String(item.label ?? item.name ?? '');
      const value = this.toNumber(item.value);
      if (!rowMap.has(label)) {
        return false;
      }

      comparableCount += 1;
      return rowMap.get(label) !== value;
    });

    const minimumComparableCount = Math.min(series.length, rows.length);
    if (comparableCount > 0 && comparableCount < minimumComparableCount) {
      return;
    }

    if (comparableCount > 0 && hasMismatch) {
      throw new ResultAccuracyError('结果准确性校验失败，图表与结果明细不一致。');
    }
  }

  private ensureMarkdownConsistent(
    summary: string,
    report: AnalysisReportPayload,
  ): void {
    if (!report.groundedMarkdown) {
      return;
    }

    if (!report.groundedMarkdown.includes(summary)) {
      throw new ResultAccuracyError(
        '结果准确性校验失败，Markdown 总结与结构化结果不一致。',
      );
    }

    if (report.temporalScope) {
      const temporalLabel = report.temporalScope.normalizedLabel;
      const temporalBoundary = formatTemporalScopeLabel(report.temporalScope);
      if (
        !report.groundedMarkdown.includes(temporalLabel) ||
        !report.groundedMarkdown.includes(temporalBoundary)
      ) {
        throw new ResultAccuracyError('结果时间口径不一致，已阻止交付。');
      }
    }
  }

  /**
   * 校验 richer report 的结构化洞察是否与多版本 Markdown 保持一致。
   *
   * 参数说明：`report` 为准备交付的 richer report。
   * 返回值：无；若结构化预测或建议未体现在完整版 Markdown 中则抛错。
   */
  private ensureRichReportConsistent(report: AnalysisReportPayload): void {
    if (
      report.forecastInsight &&
      report.forecastInsight.status !== 'UNAVAILABLE' &&
      report.detailMarkdown &&
      !report.detailMarkdown.includes('## 趋势预测')
    ) {
      throw new ResultAccuracyError('richer report 内容与结构化洞察不一致');
    }

    if (
      (report.recommendations?.length ?? 0) > 0 &&
      report.detailMarkdown &&
      !report.detailMarkdown.includes('## 经营建议')
    ) {
      throw new ResultAccuracyError('richer report 内容与结构化洞察不一致');
    }
  }

  /**
   * 校验结构化报告内所有展示块是否共享同一时间口径。
   *
   * 参数说明：
   * - `resultTemporalScope`：标准结果记录上的实际执行时间口径。
   * - `report`：准备交付的统一报告载荷。
   * 返回值：无；任一口径不一致时抛出 `ResultAccuracyError`。
   */
  private ensureTemporalScopeConsistent(
    resultTemporalScope: AnalysisResultRecord['temporalScope'],
    report: AnalysisReportPayload,
  ): void {
    const reportTemporalScope = report.temporalScope ?? resultTemporalScope;
    if (!isSameTemporalScope(resultTemporalScope, reportTemporalScope)) {
      throw new ResultAccuracyError('结果时间口径不一致，已阻止交付。');
    }

    const allBlocks = [...report.chartBlocks, ...report.tableBlocks];
    // 图表、表格和 Markdown 只允许引用统一结果包中的同一时间口径。
    for (const block of allBlocks) {
      if (block.temporalScope && !isSameTemporalScope(reportTemporalScope, block.temporalScope)) {
        throw new ResultAccuracyError('结果时间口径不一致，已阻止交付。');
      }
    }

    for (const section of report.sections ?? []) {
      if (
        section.temporalScope &&
        !isSameTemporalScope(reportTemporalScope, section.temporalScope)
      ) {
        throw new ResultAccuracyError('结果时间口径不一致，已阻止交付。');
      }
    }
  }

  private toNumber(value: string | number | unknown): number {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value !== 'string') {
      return 0;
    }

    return parseDisplayAmountToYuan(value);
  }

  /**
   * 按金额展示精度推导一致性校验容差。
   *
   * 参数说明：`value` 为指标卡展示值，可能是元级数字或“万元”文本。
   * 返回值：允许的元级舍入误差。
   * 调用注意：“万元”指标卡会经过展示层四舍五入，校验不能再按分级精度硬比。
   */
  private resolveAmountDisplayTolerance(value: string | number | unknown): number {
    if (typeof value !== 'string' || !value.includes('万元')) {
      return 0.01;
    }

    const numericPart = value
      .replace(/万元/gu, '')
      .replace(/[,\s￥¥元]/gu, '')
      .trim();
    const decimalLength = numericPart.includes('.')
      ? numericPart.split('.')[1]?.length ?? 0
      : 0;
    const displayUnitInYuan = 10000 / (10 ** decimalLength);
    return displayUnitInYuan / 2 + 0.01;
  }

  /**
   * 识别用于总额回填校验的主金额指标卡。
   *
   * 参数说明：`metricCards` 为统一结果包中的指标卡列表。
   * 返回值：优先返回累计金额类主指标；若不存在则返回 `undefined`。
   * 调用注意：不得把“平均单笔商机金额”“第一名领先第二名差距”等派生金额指标误当成总额。
   */
  private findTotalAmountMetricCard(metricCards: MetricCard[]): MetricCard | undefined {
    const preferredMetricNames = ['累计金额', '新增商机金额', '转合同金额', '合同金额'];
    return preferredMetricNames
      .map((metricName) => metricCards.find((item) => item.name === metricName))
      .find((item): item is MetricCard => Boolean(item));
  }

  /**
   * 判断两个数值是否超过业务允许误差。
   *
   * 参数说明：
   * - `left/right`：待比较的两个数值。
   * - `tolerance`：允许误差，金额默认按分级精度处理。
   * 返回值：超过误差返回 `true`。
   */
  private hasMeaningfulNumericDifference(
    left: number,
    right: number,
    tolerance: number,
  ): boolean {
    return Math.abs(left - right) > tolerance;
  }
}

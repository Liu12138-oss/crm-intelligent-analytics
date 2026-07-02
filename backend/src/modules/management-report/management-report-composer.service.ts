import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { MANAGEMENT_REPORT_METRIC_DICTIONARY } from './management-report.metrics';
import { MANAGEMENT_REPORT_SECTION_DEFINITIONS } from './management-report.types';
import { ManagementReportQueryService } from './management-report-query.service';
import type {
  ManagementMetricDefinition,
  ManagementReportBlock,
  ManagementReportContext,
  ManagementReportExportPayload,
  ManagementReportSectionData,
  ManagementReportSectionKey,
  ManagementReportSectionMeta,
  ManagementReportSectionPayload,
  ManagementReportSnapshotPayload,
} from './management-report.types';

/**
 * 经营报表组装层负责统一拼装 DTO、补齐来源说明并执行轻量一致性校验。
 */
@Injectable()
export class ManagementReportComposerService {
  constructor(
    private readonly managementReportQueryService: ManagementReportQueryService,
  ) {}

  /**
   * 组装首屏快照，参数为统一报表上下文，返回只包含核心摘要与专题导航的首屏结果。
   */
  composeSnapshot(context: ManagementReportContext): ManagementReportSnapshotPayload {
    const overview = this.attachSourceNotes(
      this.managementReportQueryService.buildOverview(context),
    );
    const executiveSummary = this.attachSourceNotes(
      this.managementReportQueryService.buildExecutiveSummary(context),
    );

    this.validateCoreSnapshot(
      overview.metricCards?.length ?? 0,
      executiveSummary.metricCards?.length ?? 0,
    );

    return {
      reportId: context.reportId,
      meta: {
        departmentId: context.filter.departmentId,
        departmentLabel: context.filter.departmentLabel,
        presetKey: context.filter.presetKey,
        startDate: context.filter.startDate,
        endDate: context.filter.endDate,
        scopeSummary: context.scopeSummary,
        generatedAt: context.generatedAt,
      },
      overview,
      executiveSummary,
      sections: MANAGEMENT_REPORT_SECTION_DEFINITIONS.map((item) => ({
        sectionKey: item.sectionKey,
        title: item.title,
        loadMode: 'lazy',
        available: item.available,
        state: item.state,
        summary: item.summary,
        timeBasis: item.timeBasis,
        unavailableReason: item.available ? undefined : '字段仍在核对，暂以退化态占位。',
      })) as ManagementReportSectionMeta[],
    };
  }

  /**
   * 组装专题详情，参数为统一报表上下文与专题键，返回对应专题的完整负载。
   */
  composeSection(
    context: ManagementReportContext,
    sectionKey: ManagementReportSectionKey,
  ): ManagementReportSectionPayload {
    const definition = MANAGEMENT_REPORT_SECTION_DEFINITIONS.find(
      (item) => item.sectionKey === sectionKey,
    );
    const section = this.attachSourceNotes(
      this.managementReportQueryService.buildSection(context, sectionKey),
    );

    return {
      reportId: context.reportId,
      sectionKey,
      generatedAt: context.generatedAt,
      timeBasis: definition?.timeBasis ?? '当前专题时间口径未配置。',
      scopeBasis: context.scopeSummary,
      section,
    };
  }

  /**
   * 组装导出结果，参数为当前快照和已加载的专题详情，返回可直接下载的 CSV 文本。
   */
  composeExport(
    snapshot: ManagementReportSnapshotPayload,
    sections: ManagementReportSectionPayload[],
  ): ManagementReportExportPayload {
    const lines: string[] = [
      '经营报表,当前值',
      `部门范围,${snapshot.meta.departmentLabel}`,
      `时间范围,${snapshot.meta.startDate} ~ ${snapshot.meta.endDate}`,
      `数据生成时间,${snapshot.meta.generatedAt}`,
      '',
      '总览指标,指标值',
    ];

    for (const metric of snapshot.overview.metricCards ?? []) {
      lines.push(`${metric.label},${metric.value}`);
    }

    for (const block of snapshot.overview.blocks) {
      lines.push('', `${block.title},内容`);
      this.appendBlockLines(lines, block);
    }

    for (const block of snapshot.executiveSummary.blocks) {
      lines.push('', `${block.title},内容`);
      this.appendBlockLines(lines, block);
    }

    for (const payload of sections) {
      lines.push('', `${payload.section.title},内容`);
      for (const block of payload.section.blocks) {
        lines.push(`${block.title},内容`);
        this.appendBlockLines(lines, block);
      }
    }

    return {
      reportId: snapshot.reportId,
      fileName: `经营报表-${snapshot.meta.startDate}-${snapshot.meta.endDate}.csv`,
      mimeType: 'text/csv;charset=utf-8',
      format: 'csv',
      content: lines.join('\n'),
    };
  }

  /**
   * 根据指标键补齐来源说明，确保前端能直接展示口径说明。
   */
  private attachSourceNotes<T extends ManagementReportSectionData>(
    section: T,
  ): T & { sourceNotes: ManagementMetricDefinition[] } {
    const metricKeys = section.metricKeys ?? [];
    const sourceNotes = metricKeys
      .map((item) => MANAGEMENT_REPORT_METRIC_DICTIONARY[item])
      .filter((item): item is ManagementMetricDefinition => Boolean(item));

    return {
      ...section,
      sourceNotes,
    };
  }

  /**
   * 在核心摘要正式返回前执行轻量校验，避免空快照继续交付。
   */
  private validateCoreSnapshot(
    overviewMetricCount: number,
    summaryMetricCount: number,
  ): void {
    if (overviewMetricCount <= 0 || summaryMetricCount <= 0) {
      throw new ServiceUnavailableException('经营报表核心摘要暂不可用，请稍后重试。');
    }
  }

  /**
   * 将专题 block 扁平化为导出行，保证导出和页面使用同一组结构化结果。
   */
  private appendBlockLines(lines: string[], block: ManagementReportBlock): void {
    switch (block.blockType) {
      case 'metric-strip':
        for (const item of block.items) {
          lines.push(`${item.label},${item.value}`);
        }
        return;
      case 'bar-ranking':
        for (const item of block.rows) {
          lines.push(`${item.label},${this.formatBlockNumber(item.value, block.unitLabel)}`);
        }
        return;
      case 'trend':
        for (const item of block.points) {
          lines.push(`${item.label},${this.formatBlockNumber(item.value, block.unitLabel)}`);
        }
        return;
      case 'funnel':
        for (const item of block.stages) {
          lines.push(`${item.label},${item.value.toLocaleString('zh-CN')}`);
        }
        return;
      case 'matrix-table':
        lines.push(`维度,${block.columns.join(',')}`);
        for (const row of block.rows) {
          lines.push(`${row.label},${row.values.join(',')}`);
        }
        return;
      case 'data-quality':
        lines.push('表,字段,有值数,缺失数,完整率');
        for (const row of block.rows) {
          lines.push(
            `${row.tableName},${row.fieldName},${row.filledCount},${row.missingCount},${row.completeness}`,
          );
        }
        return;
      case 'detail-table':
      case 'record-preview':
        lines.push(block.columns.map((item) => item.label).join(','));
        for (const row of block.rows) {
          lines.push(block.columns.map((item) => row[item.key] ?? '').join(','));
        }
        return;
      case 'insight-table':
        for (const row of block.rows) {
          lines.push(`${row.label},${row.value}`);
        }
        return;
    }
  }

  /**
   * 格式化图表导出数值，保留页面中的业务单位。
   *
   * 参数说明：`value` 为图表数值，`unitLabel` 为可选单位。
   * 返回值：带千分位和单位的导出文本。
   */
  private formatBlockNumber(value: number, unitLabel?: string): string {
    const formatted = value.toLocaleString('zh-CN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    return unitLabel ? `${formatted} ${unitLabel}` : formatted;
  }
}

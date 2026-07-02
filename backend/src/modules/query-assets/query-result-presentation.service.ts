import { Injectable } from '@nestjs/common';
import type {
  QueryTemplateRecord,
  QueryTemplateScopeValidationSnapshot,
  ScopeSnapshot,
} from '../../shared/types/domain';
import { formatWanAmount } from '../../shared/utils/business-amount.util';

@Injectable()
export class QueryResultPresentationService {
  present(params: {
    template: QueryTemplateRecord;
    rows: Array<Record<string, unknown>>;
    parameters: Record<string, unknown>;
    scopeSnapshot?: ScopeSnapshot;
    scopeGovernance?: QueryTemplateScopeValidationSnapshot;
  }) {
    const { template, rows, parameters, scopeSnapshot, scopeGovernance } = params;
    const metricCards = this.buildMetricCards(template, rows);
    const chartSeries = this.buildChartSeries(template, rows);
    const primaryBlock = {
      viewType: template.renderConfig.primaryViewType,
      title: template.renderConfig.primaryTitle,
      rows,
      series: chartSeries,
      columns: this.normalizeTableColumns(template.renderConfig.tableColumns ?? []),
    };

    return {
      metricCards,
      primaryBlock,
      emptyStateBlock:
        rows.length === 0
          ? {
              title: '当前条件下未查到数据',
              reason: `模板 ${template.name} 在当前条件下没有返回结果。`,
              scopeSummary: JSON.stringify(parameters),
              suggestions: ['放宽时间范围后重试', '切换相邻模板继续查看'],
            }
          : undefined,
      scopeSummary:
        scopeGovernance && scopeGovernance.riskFindings.length > 0
          ? `${scopeSnapshot?.scopeSummary ?? '当前按权限范围展示。'} ${scopeGovernance.friendlyMessage}`
          : (scopeSnapshot?.scopeSummary ?? undefined),
      scopeGovernance,
    };
  }

  private buildMetricCards(
    template: QueryTemplateRecord,
    rows: Array<Record<string, unknown>>,
  ) {
    return (template.renderConfig.metricFields ?? []).map((item) => ({
      name: item.label,
      value: this.formatMetricValue(
        item.key,
        item.label,
        this.resolveMetricValue(rows, item.key),
      ),
    }));
  }

  /**
   * 为金额类表格列补齐万元单位，避免页面只显示裸数字。
   *
   * 参数说明：`columns` 为模板声明的表格列。
   * 返回值：金额列带“（万元）”后缀，其余列保持原样。
   */
  private normalizeTableColumns(
    columns: NonNullable<QueryTemplateRecord['renderConfig']['tableColumns']>,
  ): NonNullable<QueryTemplateRecord['renderConfig']['tableColumns']> {
    return columns.map((item) => {
      if (!this.isWanAmountField(item.key, item.label) || item.label.includes('万元')) {
        return item;
      }

      return {
        ...item,
        label: `${item.label}（万元）`,
      };
    });
  }

  /**
   * 格式化模板指标卡，模板 SQL 中金额字段已按万元返回，因此这里只追加展示单位。
   *
   * 参数说明：字段 key、中文 label 和原始聚合值。
   * 返回值：金额字段展示为“x 万元”，非金额字段保持原值。
   */
  private formatMetricValue(
    key: string,
    label: string,
    value: string | number,
  ): string | number {
    if (!this.isWanAmountField(key, label)) {
      return value;
    }

    if (String(value).includes('万元')) {
      return value;
    }

    return formatWanAmount(value, 'wan');
  }

  /**
   * 判断模板字段是否代表万元金额。
   *
   * 参数说明：`key` 为字段名，`label` 为中文展示名。
   * 返回值：金额、收入、目标、预测类字段返回 true。
   */
  private isWanAmountField(key: string, label: string): boolean {
    return /amount|income|target|forecast/iu.test(key) || /金额|收入|目标|预测/u.test(label);
  }

  private resolveMetricValue(
    rows: Array<Record<string, unknown>>,
    key: string,
  ): string | number {
    if (rows.length === 0) {
      return 0;
    }

    const numericValues = rows
      .map((row) => row[key])
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    if (numericValues.length === rows.length && numericValues.length > 0) {
      return Number(
        numericValues.reduce((total, value) => total + value, 0).toFixed(2),
      );
    }

    const directValue = rows[0]?.[key];
    if (typeof directValue === 'number' || typeof directValue === 'string') {
      return directValue;
    }

    if (key === 'total_count') {
      return rows.length;
    }

    if (key === 'total_amount') {
      return rows.reduce((total, row) => total + Number(row.expected_amount ?? 0), 0);
    }

    return 0;
  }

  private buildChartSeries(
    template: QueryTemplateRecord,
    rows: Array<Record<string, unknown>>,
  ): Array<Record<string, unknown>> | undefined {
    const dimensionKey = template.renderConfig.chartDimensionKey;
    const metricKey = template.renderConfig.chartMetricKey;
    if (!dimensionKey || !metricKey) {
      return undefined;
    }

    return rows.map((row) => ({
      label: String(row[dimensionKey] ?? '未命名'),
      value: Number(row[metricKey] ?? 0),
      ...row,
    }));
  }
}

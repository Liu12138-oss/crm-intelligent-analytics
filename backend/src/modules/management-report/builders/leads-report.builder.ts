import type { ManagementReportQueryService } from '../management-report-query.service';
import { createEmptyPreviewBlock } from '../management-report.types';
import type { ManagementReportContext, ManagementReportSectionData } from '../management-report.types';

interface LeadOwnerAggregate {
  leadCount: number;
  responseHoursSum: number;
  highQualityCount: number;
}

/**
 * 将计数 Map 转成与现有专题一致的排序结果，避免重构后图表顺序抖动。
 */
function toSortedCountRows(counter: Map<string, number>) {
  return Array.from(counter.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label));
}

/**
 * 组装线索专题，补齐来源、状态、质量、需求标签、响应和风险预览。
 */
export function buildLeadsReport(
  queryService: ManagementReportQueryService,
  context: ManagementReportContext,
): ManagementReportSectionData {
  const leads = queryService.listLeadsInPeriod(context);
  const sourceCounter = new Map<string, number>();
  const statusCounter = new Map<string, number>();
  const qualityCounter = new Map<string, number>();
  const demandCounter = new Map<string, number>();
  const trendCounter = new Map<string, number>();
  const ownerAggregateMap = new Map<string, LeadOwnerAggregate>();
  const sourceStatusMatrix = new Map<string, Map<string, number>>();
  const riskLeads = leads.filter((item) => item.riskFlag);

  for (const lead of leads) {
    sourceCounter.set(lead.source, (sourceCounter.get(lead.source) ?? 0) + 1);
    statusCounter.set(
      lead.followUpStatus,
      (statusCounter.get(lead.followUpStatus) ?? 0) + 1,
    );
    qualityCounter.set(
      lead.qualityLevel,
      (qualityCounter.get(lead.qualityLevel) ?? 0) + 1,
    );
    demandCounter.set(lead.demandTag, (demandCounter.get(lead.demandTag) ?? 0) + 1);
    const monthLabel = lead.createdAt.slice(0, 7);
    trendCounter.set(monthLabel, (trendCounter.get(monthLabel) ?? 0) + 1);

    const ownerAggregate = ownerAggregateMap.get(lead.ownerName) ?? {
      leadCount: 0,
      responseHoursSum: 0,
      highQualityCount: 0,
    };
    ownerAggregate.leadCount += 1;
    ownerAggregate.responseHoursSum += lead.responseHours;
    if (lead.qualityLevel === '高质量') {
      ownerAggregate.highQualityCount += 1;
    }
    ownerAggregateMap.set(lead.ownerName, ownerAggregate);

    const statusCounterBySource =
      sourceStatusMatrix.get(lead.source) ?? new Map<string, number>();
    statusCounterBySource.set(
      lead.followUpStatus,
      (statusCounterBySource.get(lead.followUpStatus) ?? 0) + 1,
    );
    sourceStatusMatrix.set(lead.source, statusCounterBySource);
  }

  const sourceRows = toSortedCountRows(sourceCounter);
  const statusRows = toSortedCountRows(statusCounter);
  const qualityRows = toSortedCountRows(qualityCounter);
  const demandRows = toSortedCountRows(demandCounter);
  const trendRows = toSortedCountRows(trendCounter);
  const matrixSourceLabels = Array.from(sourceCounter.keys());
  const matrixStatusLabels = Array.from(statusCounter.keys());
  const ownerRows = Array.from(ownerAggregateMap.entries()).map(([ownerName, aggregate]) => ({
    ownerName,
    leadCount: String(aggregate.leadCount),
    avgResponseHours: `${(aggregate.responseHoursSum / aggregate.leadCount).toFixed(1)} 小时`,
    highQualityCount: String(aggregate.highQualityCount),
  }));

  return {
    sectionKey: 'leads',
    title: '线索',
    summary: '线索专题现在覆盖来源、状态、质量、需求标签、响应效率和风险样本。',
    metricKeys: ['leadCount'],
    blocks: [
      {
        blockId: 'leads-source-top',
        blockType: 'bar-ranking',
        title: '线索来源 Top',
        size: 'wide',
        rows: sourceRows,
        unitLabel: '条',
      },
      {
        blockId: 'leads-status',
        blockType: 'detail-table',
        title: '线索跟进状态',
        size: 'compact',
        columns: [
          { key: 'status', label: '状态' },
          { key: 'count', label: '数量' },
        ],
        rows: statusRows.map((item) => ({
          status: item.label,
          count: String(item.value),
        })),
      },
      {
        blockId: 'leads-quality',
        blockType: 'detail-table',
        title: '线索质量等级',
        size: 'compact',
        columns: [
          { key: 'quality', label: '等级' },
          { key: 'count', label: '数量' },
        ],
        rows: qualityRows.map((item) => ({
          quality: item.label,
          count: String(item.value),
        })),
      },
      {
        blockId: 'leads-demand-tags',
        blockType: 'bar-ranking',
        title: '需求标签 Top',
        size: 'wide',
        rows: demandRows,
        unitLabel: '条',
      },
      {
        blockId: 'leads-trend',
        blockType: 'trend',
        title: '月度新增趋势',
        size: 'wide',
        points: trendRows,
        unitLabel: '条',
      },
      {
        blockId: 'leads-owner-response',
        blockType: 'detail-table',
        title: '负责人响应与质量',
        size: 'wide',
        columns: [
          { key: 'ownerName', label: '负责人' },
          { key: 'leadCount', label: '线索数' },
          { key: 'avgResponseHours', label: '平均响应' },
          { key: 'highQualityCount', label: '高质量线索' },
        ],
        rows: ownerRows,
      },
      {
        blockId: 'leads-source-status-matrix',
        blockType: 'matrix-table',
        title: '来源 × 状态矩阵',
        size: 'wide',
        columns: matrixStatusLabels,
        rows: matrixSourceLabels.map((source) => ({
          label: source,
          values: matrixStatusLabels.map((status) => {
            const statusCounterBySource = sourceStatusMatrix.get(source);
            return String(statusCounterBySource?.get(status) ?? 0);
          }),
        })),
      },
      riskLeads.length > 0
        ? {
            blockId: 'leads-risk-preview',
            blockType: 'record-preview',
            title: '风险线索预览',
            size: 'wide',
            columns: [
              { key: 'companyName', label: '公司' },
              { key: 'ownerName', label: '负责人' },
              { key: 'source', label: '来源' },
              { key: 'responseHours', label: '响应时长' },
            ],
            rows: riskLeads.map((item) => ({
              companyName: item.companyName,
              ownerName: item.ownerName,
              source: item.source,
              responseHours: `${item.responseHours} 小时`,
            })),
          }
        : createEmptyPreviewBlock({
            blockId: 'leads-risk-preview',
            title: '风险线索预览',
          }),
    ],
    footnotes: ['线索专题重点观察来源结构、跟进效率和风险线索。'],
  };
}

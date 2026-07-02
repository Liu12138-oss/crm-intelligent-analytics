import type {
  AiCapabilityPackDefinition,
} from '../ai-capability-pack.types';

export interface RichAnalysisReportPackContext {
  title: string;
  summary?: string;
  scopeSummary?: string;
  metricCards: Array<{ name: string; value: string | number }>;
  rowPreview: Array<Record<string, unknown>>;
  appliedFilters?: Array<{ label: string; value: string }>;
  trendSummary?: string;
  forecastSummary?: string;
  anomalySummaries: string[];
  riskSummaries: string[];
  recommendationSummaries: string[];
  markdownSnapshotContext?: string;
}

type RichAnalysisReportRawOutput = {
  executiveSummary?: string;
  keyFindings?: Array<{
    title?: string;
    detail?: string;
    tone?: 'positive' | 'neutral' | 'risk';
  }>;
  trendNarrative?: string;
  riskNarratives?: string[];
  recommendationNarratives?: string[];
  evidenceNarrative?: string;
};

export interface RichAnalysisReportPackOutput {
  executiveSummary: string;
  keyFindings: Array<{
    title: string;
    detail: string;
    tone: 'positive' | 'neutral' | 'risk';
  }>;
  trendNarrative: string;
  riskNarratives: string[];
  recommendationNarratives: string[];
  evidenceNarrative: string;
}

function normalizeString(value: unknown, fallback: string): string {
  return (typeof value === 'string' && value.replace(/\s+/gu, ' ').trim()) || fallback;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.replace(/\s+/gu, ' ').trim())
    .filter(Boolean);
}

export const richAnalysisReportPack: AiCapabilityPackDefinition<
  RichAnalysisReportPackContext,
  RichAnalysisReportRawOutput,
  RichAnalysisReportPackOutput
> = {
  packCode: 'rich-analysis-report-pack',
  packVersion: '2026-05-14.1',
  resolveProviderTuning: () => ({
    requestOverrides: {
      disableResponseStorage: true,
      enableThinking: false,
      maxTokens: 1400,
      timeoutMs: 50000,
      retryOnTimeout: false,
    },
  }),
  buildStructuredRequest: (context) => ({
    prompt: [
      '你是 CRM 智能分析系统里的经营分析报告编排器。',
      '请只基于提供的结果事实生成更像经营分析的中文报告摘要。',
      '当前结果事实、代表性明细和过滤条件优先级高于 OpenAPI Markdown 快照材料。',
      '如果提供了 OpenAPI Markdown 快照材料，可以用它理解业务对象、状态口径和相关明细，但不能引入材料中不存在的数值。',
      '如果过滤条件包含区域、大区、时间或对象范围，快照只用于字段释义；禁止把未在当前结果命中的全量明细写入报告。',
      '不要编造不存在的数值、对象、同比、环比或时间跨度。',
      '只要关键指标或代表性明细非空，必须基于已给事实输出短期方向性预测；连续周期不足时降低置信度并说明需要后续校准。',
      '禁止把非空结果写成不可预测、预测不可用、时间序列不足或不具备预测条件。',
      '输出必须是 JSON。',
      `标题：${context.title}`,
      `数据摘要：${context.summary ?? '无'}`,
      `权限范围：${context.scopeSummary ?? '无'}`,
      `过滤条件：${context.appliedFilters?.map((item) => `${item.label}=${item.value}`).join('；') || '无'}`,
      `关键指标：${context.metricCards.map((item) => `${item.name}=${item.value}`).join('；') || '无'}`,
      `趋势事实：${context.trendSummary ?? '无'}`,
      `预测事实：${context.forecastSummary ?? '无'}`,
      `异常事实：${context.anomalySummaries.join('；') || '无'}`,
      `风险事实：${context.riskSummaries.join('；') || '无'}`,
      `现有建议：${context.recommendationSummaries.join('；') || '无'}`,
      `代表性明细：${context.rowPreview.map((item) => Object.entries(item).map(([key, value]) => `${key}=${value}`).join('，')).join('；') || '无'}`,
      `OpenAPI Markdown 快照材料：${context.markdownSnapshotContext?.trim() || '无'}`,
    ].join('\n'),
    outputSchema: {
      type: 'object',
      additionalProperties: false,
      required: [
        'executiveSummary',
        'keyFindings',
        'trendNarrative',
        'riskNarratives',
        'recommendationNarratives',
        'evidenceNarrative',
      ],
      properties: {
        executiveSummary: { type: 'string' },
        keyFindings: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['title', 'detail', 'tone'],
            properties: {
              title: { type: 'string' },
              detail: { type: 'string' },
              tone: { type: 'string', enum: ['positive', 'neutral', 'risk'] },
            },
          },
        },
        trendNarrative: { type: 'string' },
        riskNarratives: {
          type: 'array',
          items: { type: 'string' },
        },
        recommendationNarratives: {
          type: 'array',
          items: { type: 'string' },
        },
        evidenceNarrative: { type: 'string' },
      },
    },
  }),
  normalize: (raw, context) => ({
    executiveSummary: normalizeString(
      raw.executiveSummary,
      context.summary ?? `${context.title} 已生成数据结果。`,
    ),
    keyFindings: Array.isArray(raw.keyFindings)
      ? raw.keyFindings
          .map((item, index) => ({
            title: normalizeString(item?.title, `关键发现 ${index + 1}`),
            detail: normalizeString(item?.detail, ''),
            tone:
              item?.tone === 'positive'
                ? ('positive' as const)
                : item?.tone === 'risk'
                  ? ('risk' as const)
                  : ('neutral' as const),
          }))
          .filter((item) => item.detail)
          .slice(0, 4)
      : [],
    trendNarrative: normalizeString(
      raw.trendNarrative,
      context.trendSummary ?? `${context.title} 已生成结果。`,
    ),
    riskNarratives: normalizeStringArray(raw.riskNarratives).slice(0, 4),
    recommendationNarratives: normalizeStringArray(raw.recommendationNarratives).slice(0, 4),
    evidenceNarrative: normalizeString(
      raw.evidenceNarrative,
      '以上判断仅基于当前结果事实、指标卡和明细预览生成。',
    ),
  }),
};

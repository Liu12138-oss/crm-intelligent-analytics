import type { AiCapabilityPackDefinition } from '../ai-capability-pack.types';
import type { WecomLatestResultContext } from '../../../../shared/types/domain';

export interface AnalysisFollowUpPackContext {
  questionText: string;
  latestQuestion?: string;
  latestSummary?: string;
  latestResultContext?: WecomLatestResultContext;
  channel: 'web-console' | 'wecom-bot';
}

type AnalysisFollowUpRawOutput = {
  intent?: 'EXPLAIN_RESULT' | 'RUN_NEW_ANALYSIS';
};

export interface AnalysisFollowUpPackOutput {
  intent: 'EXPLAIN_RESULT' | 'RUN_NEW_ANALYSIS';
}

function formatLatestResultContext(
  context: WecomLatestResultContext | undefined,
): string {
  if (!context) {
    return '无';
  }

  const entityText = context.entities
    .map((item) => item.value)
    .filter(Boolean)
    .slice(0, 8)
    .join('、');
  const filterText = context.appliedFilters
    .map((item) => `${item.label}=${item.value}`)
    .filter(Boolean)
    .slice(0, 6)
    .join('；');
  const topRowText = context.topRows
    .map((item) =>
      [item.label, ...item.summaryFields].filter(Boolean).join('，'),
    )
    .filter(Boolean)
    .slice(0, 5)
    .join('；');

  return [
    context.queryId ? `结果ID：${context.queryId}` : undefined,
    context.title ? `标题：${context.title}` : undefined,
    context.summary ? `摘要：${context.summary}` : undefined,
    entityText ? `已验证对象：${entityText}` : undefined,
    filterText ? `筛选：${filterText}` : undefined,
    topRowText ? `代表性结果：${topRowText}` : undefined,
  ]
    .filter(Boolean)
    .join('\n') || '无';
}

export const analysisFollowUpPack: AiCapabilityPackDefinition<
  AnalysisFollowUpPackContext,
  AnalysisFollowUpRawOutput,
  AnalysisFollowUpPackOutput
> = {
  packCode: 'analysis-follow-up-pack',
  packVersion: '2026-04-21.1',
  buildStructuredRequest: (context) => ({
    prompt: [
      '你是 CRM 智能分析系统的追问分流器。',
      '请判断当前追问属于 EXPLAIN_RESULT 还是 RUN_NEW_ANALYSIS。',
      'EXPLAIN_RESULT 表示用户想继续解释、理解、确认上一轮结果，不需要重新取数。',
      'RUN_NEW_ANALYSIS 表示用户想改条件、改维度、改时间范围、继续比较或重新分析，需要重新取数。',
      '只输出 JSON。',
      `入口渠道：${context.channel}`,
      `当前追问：${context.questionText}`,
      `上一轮问题：${context.latestQuestion ?? '无'}`,
      `上一轮结果摘要：${context.latestSummary ?? '无'}`,
      `上一轮已验证结果上下文：\n${formatLatestResultContext(context.latestResultContext)}`,
      '如果追问包含“他/她/这个/这些/对比一下/继续看/看明细”等省略表达，必须结合上一轮已验证结果上下文判断是否需要重新取数。',
      '如果用户要求新增时间、维度、对象、明细、对比、筛选或风险观察，输出 RUN_NEW_ANALYSIS；如果只是问“为什么/说明什么/怎么看”，输出 EXPLAIN_RESULT。',
    ].join('\n'),
    outputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['intent'],
      properties: {
        intent: {
          type: 'string',
          enum: ['EXPLAIN_RESULT', 'RUN_NEW_ANALYSIS'],
        },
      },
    },
  }),
  normalize: (raw) => ({
    intent: raw.intent ?? 'RUN_NEW_ANALYSIS',
  }),
};

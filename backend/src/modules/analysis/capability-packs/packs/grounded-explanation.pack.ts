import type { AiCapabilityPackDefinition } from '../ai-capability-pack.types';

export interface GroundedExplanationPackContext {
  title?: string;
  summary?: string;
  scopeSummary?: string;
  keyFindings: string[];
}

type GroundedExplanationRawOutput = {
  groundedExplanation?: string;
  nextBestQuestions?: string[];
};

export interface GroundedExplanationPackOutput {
  groundedExplanation: string;
  nextBestQuestions: string[];
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

export const groundedExplanationPack: AiCapabilityPackDefinition<
  GroundedExplanationPackContext,
  GroundedExplanationRawOutput,
  GroundedExplanationPackOutput
> = {
  packCode: 'grounded-explanation-pack',
  packVersion: '2026-04-21.1',
  buildStructuredRequest: (context) => ({
    prompt: [
      '你是 CRM 智能分析系统里的 grounded 洞察生成器。',
      '请只基于当前结果事实生成 groundedExplanation 和 nextBestQuestions。',
      '不得编造结果包中不存在的数值、排名、趋势或对象事实。',
      '只输出 JSON。',
      `标题：${context.title ?? '无'}`,
      `摘要：${context.summary ?? '无'}`,
      `权限范围摘要：${context.scopeSummary ?? '无'}`,
      `关键发现：${context.keyFindings.join('；')}`,
    ].join('\n'),
    outputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['groundedExplanation', 'nextBestQuestions'],
      properties: {
        groundedExplanation: {
          type: 'string',
        },
        nextBestQuestions: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  }),
  normalize: (raw) => ({
    groundedExplanation:
      (typeof raw.groundedExplanation === 'string' &&
        raw.groundedExplanation.replace(/\s+/gu, ' ').trim()) ||
      '当前结果已生成，但 AI 洞察内容为空。',
    nextBestQuestions: normalizeStringArray(raw.nextBestQuestions).slice(0, 3),
  }),
};

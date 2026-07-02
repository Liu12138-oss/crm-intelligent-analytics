import type { AiCapabilityPackDefinition } from '../ai-capability-pack.types';

export interface WecomExplanationReplyPackContext {
  prompt: string;
}

type WecomExplanationReplyRawOutput = {
  replyText?: string;
};

export interface WecomExplanationReplyPackOutput {
  replyText: string;
}

export const wecomExplanationReplyPack: AiCapabilityPackDefinition<
  WecomExplanationReplyPackContext,
  WecomExplanationReplyRawOutput,
  WecomExplanationReplyPackOutput
> = {
  packCode: 'wecom-explanation-reply-pack',
  packVersion: '2026-04-21.1',
  buildStructuredRequest: (context) => ({
    prompt: [
      '你是 CRM 智能分析系统里的企业微信结果解释助手。',
      '请基于给定提示生成一段简洁、可直接发给企业微信用户的中文解释。',
      '只输出 JSON。',
      context.prompt,
    ].join('\n\n'),
    outputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['replyText'],
      properties: {
        replyText: {
          type: 'string',
        },
      },
    },
  }),
  normalize: (raw) => ({
    replyText:
      (typeof raw.replyText === 'string' && raw.replyText.trim()) ||
      '当前已基于上一轮 CRM 结果继续解释，请结合结果摘要继续查看。',
  }),
};

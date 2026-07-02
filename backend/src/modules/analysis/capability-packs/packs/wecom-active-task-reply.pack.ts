import type {
  AiCapabilityPackDefinition,
  AiCapabilityProviderContext,
} from '../ai-capability-pack.types';
import { resolveQwenCapabilityTuning } from '../provider-tuning/qwen.provider';

export interface WecomActiveTaskReplyPackContext {
  messageText: string;
  activeTaskLabel: string;
}

type WecomActiveTaskReplyRawOutput = {
  intent?: string;
  target?: string | null;
};

export interface WecomActiveTaskReplyPackOutput {
  intent:
    | 'HELP_GUIDANCE'
    | 'TASK_CANCEL'
    | 'TASK_SWITCH'
    | 'DIRECT_SUBMIT'
    | 'CONTINUE_EXECUTION'
    | 'MODIFY_CONTENT'
    | 'NONE';
  target?:
    | 'DAILY_REPORT_ENTRY'
    | 'DAILY_REPORT_QUERY'
    | 'TEAM_DAILY_REPORT_QUERY'
    | 'FOLLOW_UP_TEMPLATE'
    | 'CRM_CREATE_CUSTOMER'
    | 'CRM_CREATE_OPPORTUNITY'
    | 'ENTITY_LOOKUP';
}

function normalizeNullableString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalizedValue = value.trim();
  return normalizedValue || undefined;
}

export const wecomActiveTaskReplyPack: AiCapabilityPackDefinition<
  WecomActiveTaskReplyPackContext,
  WecomActiveTaskReplyRawOutput,
  WecomActiveTaskReplyPackOutput
> = {
  packCode: 'wecom-active-task-reply-pack',
  packVersion: '2026-04-21.1',
  buildStructuredRequest: (context, tuning) => ({
    prompt: [
      '你是 CRM 智能分析系统的企业微信任务回复意图分类器。',
      '当前用户已经处于一个进行中的任务，请判断这条回复属于 HELP_GUIDANCE、TASK_CANCEL、TASK_SWITCH、DIRECT_SUBMIT、CONTINUE_EXECUTION、MODIFY_CONTENT 还是 NONE。',
      '如果是 TASK_SWITCH，target 只能从以下值中选择：DAILY_REPORT_ENTRY、DAILY_REPORT_QUERY、TEAM_DAILY_REPORT_QUERY、FOLLOW_UP_TEMPLATE、CRM_CREATE_CUSTOMER、CRM_CREATE_OPPORTUNITY、ENTITY_LOOKUP。',
      'DIRECT_SUBMIT 表示按当前草稿继续流程；CONTINUE_EXECUTION 表示继续当前确认流程；MODIFY_CONTENT 表示用户想修改内容，或当前消息本身就是一段新的业务正文/字段补充。',
      '必须优先理解上下文，不得把长正文、带字段标签的补充内容、跟进事实补充、问题描述或后续计划，误判成 CONTINUE_EXECUTION。',
      '如果消息是长正文、自然语言补充、带字段标签的草稿内容，哪怕其中出现“明天继续跟进”“客户不好沟通”等表述，也应优先输出 MODIFY_CONTENT。',
      '如果当前系统已经提示“也可以直接提交”，用户回复“不补充”“先不补充”“不补了”“不用补充”或语义等价表达时，应输出 DIRECT_SUBMIT，而不是 TASK_CANCEL。',
      'CONTINUE_EXECUTION 只适用于“确认、继续、可以、好的、就按这个走”这类没有新增实质正文的短确认语句。',
      'TASK_CANCEL 只适用于“取消、不做了、先停一下”这类明确结束当前任务的表达。',
      '只输出 JSON。',
      ...(tuning.fewShotExamples?.length
        ? ['参考示例：', ...tuning.fewShotExamples]
        : []),
      `当前任务：${context.activeTaskLabel}`,
      `用户回复：${context.messageText}`,
    ].join('\n'),
    outputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['intent'],
      properties: {
        intent: {
          type: 'string',
          enum: [
            'HELP_GUIDANCE',
            'TASK_CANCEL',
            'TASK_SWITCH',
            'DIRECT_SUBMIT',
            'CONTINUE_EXECUTION',
            'MODIFY_CONTENT',
            'NONE',
          ],
        },
        target: {
          type: 'string',
          enum: [
            'DAILY_REPORT_ENTRY',
            'DAILY_REPORT_QUERY',
            'TEAM_DAILY_REPORT_QUERY',
            'FOLLOW_UP_TEMPLATE',
            'CRM_CREATE_CUSTOMER',
            'CRM_CREATE_OPPORTUNITY',
            'ENTITY_LOOKUP',
          ],
        },
      },
    },
  }),
  normalize: (raw) => ({
    intent:
      (normalizeNullableString(raw.intent) as WecomActiveTaskReplyPackOutput['intent']) ??
      'NONE',
    target: normalizeNullableString(
      raw.target,
    ) as WecomActiveTaskReplyPackOutput['target'],
  }),
  validate: (output) => {
    if (output.intent === 'TASK_SWITCH' && !output.target) {
      return '缺少 target';
    }
    return undefined;
  },
  isNone: (output) => output.intent === 'NONE',
  resolveProviderTuning: (providerContext: AiCapabilityProviderContext) =>
    resolveQwenCapabilityTuning(providerContext, 'wecom-active-task-reply-pack'),
};

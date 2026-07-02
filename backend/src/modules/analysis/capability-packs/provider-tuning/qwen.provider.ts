import type {
  AiCapabilityProviderContext,
  AiCapabilityProviderTuning,
} from '../ai-capability-pack.types';

function isQwenProvider(context: AiCapabilityProviderContext): boolean {
  const providerCode = context.providerCode.trim().toLowerCase();
  const model = context.model.trim().toLowerCase();
  return providerCode === 'qwen' || model.startsWith('qwen');
}

function buildFewShotExamples(packCode: string): string[] {
  if (packCode === 'wecom-idle-entry-pack') {
    return [
      '示例1：用户输入“你好”，返回 {"intent":"HELP_GUIDANCE","helpScene":"GREETING"}',
      '示例2：用户输入“跟进商机”，返回 {"intent":"DAILY_REPORT","dailyReportPrompt":"FOLLOW_UP_TEMPLATE_ENTRY"}',
      '示例3：用户输入“新增客户”，返回 {"intent":"CRM_CREATE_CUSTOMER"}',
      '示例4：用户输入“查我当前跟进的客户”，返回 {"intent":"ENTITY_LOOKUP","entityLookupAction":"LIST","entityType":"Customer","queryText":"我当前跟进的客户","referenceTarget":"NONE","confidence":"HIGH"}',
    ];
  }

  if (packCode === 'wecom-active-task-reply-pack') {
    return [
      '示例1：用户输入“取消”，返回 {"intent":"TASK_CANCEL"}',
      '示例2：用户输入“生成日报”，返回 {"intent":"TASK_SWITCH","target":"DAILY_REPORT_QUERY"}',
      '示例3：长正文场景，用户输入“今天跟进了安恒信息，客户不好沟通，推进缓慢，明天继续跟进”，返回 {"intent":"MODIFY_CONTENT"}',
      '示例4：可选缺项阶段，用户输入“不补充”，返回 {"intent":"DIRECT_SUBMIT"}',
      '示例5：用户输入“我再改一下”，返回 {"intent":"MODIFY_CONTENT"}',
      '示例6：用户输入“先去查一下我当前跟进的客户”，返回 {"intent":"TASK_SWITCH","target":"ENTITY_LOOKUP"}',
    ];
  }

  return [];
}

export function resolveQwenCapabilityTuning(
  context: AiCapabilityProviderContext,
  packCode: string,
): AiCapabilityProviderTuning | undefined {
  if (!isQwenProvider(context)) {
    return undefined;
  }

  return {
    requestOverrides: {
      wireApi: 'chat_completions',
      structuredOutputMode: 'json_object',
    },
    fewShotExamples: buildFewShotExamples(packCode),
  };
}

import type {
  AiCapabilityProviderContext,
  AiCapabilityProviderTuning,
} from '../ai-capability-pack.types';

/**
 * 判断当前能力包是否运行在 DeepSeek 或 DeepSeek 兼容网关上。
 *
 * 参数说明：`context` 为当前激活 AI Profile 的 provider、model、协议和扩展配置摘要。
 * 返回值说明：命中 DeepSeek 相关 provider、模型名或平台预设时返回 `true`。
 * 调用注意事项：治理后台里经常把 providerCode 写成 `deepseek-v4-pro` 这类模型别名，
 * 因此这里不能只判断严格等于 `deepseek`，否则真实企微链路会漏掉兼容调优。
 */
function isDeepSeekProvider(context: AiCapabilityProviderContext): boolean {
  const providerCode = context.providerCode.trim().toLowerCase();
  const model = context.model.trim().toLowerCase();
  const platformPreset =
    typeof context.sdkOptions?.platformPreset === 'string'
      ? context.sdkOptions.platformPreset.trim().toLowerCase()
      : '';

  return (
    providerCode.includes('deepseek') ||
    model.includes('deepseek') ||
    platformPreset === 'deepseek'
  );
}

/**
 * 为 DeepSeek 兼容网关提供能力包结构化输出调优。
 *
 * 参数说明：`context` 为当前激活 AI Profile 的运行态配置摘要。
 * 返回值说明：命中 DeepSeek 时返回受控 requestOverrides，否则返回 `undefined`。
 * 设计原因：DeepSeek 兼容接口主能力是 Chat Completions，复杂 JSON Schema 在部分网关上
 * 容易出现“有响应但没有 Responses 最终文本”的解析失败；推理模型还可能把 token 全部消耗在
 * `reasoning_content`，导致最终 `content` 没有 JSON。统一改走 `chat/completions`
 * 与 `json_object`，关闭 thinking 并提高结构化输出上限，再由本地 schema 做强校验，
 * 可以保留 AI 语义主链，同时避免恢复旧规则兜底。
 */
export function resolveDeepSeekCapabilityTuning(
  context: AiCapabilityProviderContext,
): AiCapabilityProviderTuning | undefined {
  if (!isDeepSeekProvider(context)) {
    return undefined;
  }

  return {
    requestOverrides: {
      wireApi: 'chat_completions',
      structuredOutputMode: 'json_object',
      enableThinking: false,
      maxTokens: 4096,
    },
  };
}

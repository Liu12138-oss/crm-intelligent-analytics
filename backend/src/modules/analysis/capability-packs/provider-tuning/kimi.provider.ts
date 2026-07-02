import type {
  AiCapabilityProviderContext,
  AiCapabilityProviderTuning,
} from '../ai-capability-pack.types';

/**
 * 判断当前能力包是否运行在 Kimi / Moonshot 兼容网关上。
 *
 * 参数说明：
 * - `context`：当前激活 AI Profile 解析出的 provider、model、协议和 sdkOptions。
 * 返回值：命中 Kimi 或 Moonshot 风格配置时返回 `true`。
 * 注意事项：管理员可能把 providerCode 写成具体模型名，也可能只在平台预设里标识来源，
 * 因此这里同时兼容 providerCode、model 与 platformPreset，避免漏掉手工配置的本地联调场景。
 */
function isKimiProvider(context: AiCapabilityProviderContext): boolean {
  const providerCode = context.providerCode.trim().toLowerCase();
  const model = context.model.trim().toLowerCase();
  const platformPreset =
    typeof context.sdkOptions?.platformPreset === 'string'
      ? context.sdkOptions.platformPreset.trim().toLowerCase()
      : '';

  return (
    providerCode.includes('kimi') ||
    providerCode.includes('moonshot') ||
    model.startsWith('kimi') ||
    model.includes('moonshot') ||
    platformPreset === 'kimi' ||
    platformPreset === 'moonshot'
  );
}

/**
 * 为 Kimi / Moonshot 兼容网关提供能力包结构化输出调优。
 *
 * 参数说明：
 * - `context`：当前激活 AI Profile 的运行态配置摘要。
 * 返回值：命中 Kimi 时返回受控 requestOverrides，否则返回 `undefined`。
 * 设计原因：AI 配置页的最小健康检查只证明小 schema 可用；智能分析意图解析、
 * 经营报告等能力包 schema 更复杂，部分 Kimi 兼容网关在 `json_schema` 严格模式下
 * 容易拒绝请求或返回不稳定内容。这里降级为 `json_object`，仍由本地 JSON Schema 校验兜底，
 * 既提升兼容性，也不放松白名单、权限和审计边界。
 */
export function resolveKimiCapabilityTuning(
  context: AiCapabilityProviderContext,
): AiCapabilityProviderTuning | undefined {
  if (!isKimiProvider(context)) {
    return undefined;
  }

  return {
    requestOverrides: {
      structuredOutputMode: 'json_object',
    },
  };
}

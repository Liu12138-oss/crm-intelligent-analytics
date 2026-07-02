import type { AiSdkType } from '../types/domain';

export type AiReasoningEffort =
  | 'none'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | 'max';

export const DEFAULT_CODEX_REASONING_EFFORT: AiReasoningEffort = 'none';
export const DEFAULT_CLAUDE_REASONING_EFFORT: AiReasoningEffort = 'low';
export const DEFAULT_OPENAI_HTTP_REASONING_EFFORT: AiReasoningEffort = 'low';

/**
 * 统一归一化 AI 推理等级。
 *
 * 设计原因：
 * 1. 治理页、环境引导、运行时解析和执行链路需要统一默认值口径；
 * 2. 不同 Provider 对最低档位支持不同，OpenAI 兼容 HTTP 不再复用 Codex 的 `none`；
 * 3. 兼容历史已存的 `minimal` 值，避免升级后旧数据直接失效。
 */
export function normalizeAiReasoningEffort(
  value?: string,
  sdkType?: AiSdkType,
): AiReasoningEffort {
  const normalizedValue = value?.trim().toLowerCase();
  const options = getReasoningEffortOptions(sdkType);

  if (normalizedValue === 'minimal') {
    return resolveDefaultAiReasoningEffort(sdkType);
  }

  if (normalizedValue === 'none') {
    if (sdkType === 'claude-agent-sdk') {
      return DEFAULT_CLAUDE_REASONING_EFFORT;
    }
    if (sdkType === 'openai-compatible-http') {
      return DEFAULT_OPENAI_HTTP_REASONING_EFFORT;
    }

    return 'none';
  }

  if (
    normalizedValue === 'low' ||
    normalizedValue === 'medium' ||
    normalizedValue === 'high' ||
    normalizedValue === 'xhigh' ||
    normalizedValue === 'max'
  ) {
    return options.includes(normalizedValue as AiReasoningEffort)
      ? (normalizedValue as AiReasoningEffort)
      : resolveDefaultAiReasoningEffort(sdkType);
  }

  return resolveDefaultAiReasoningEffort(sdkType);
}

/**
 * 返回不同 Provider 当前可用的推理等级候选。
 */
export function getReasoningEffortOptions(
  sdkType?: AiSdkType,
): AiReasoningEffort[] {
  if (sdkType === 'openai-compatible-http') {
    return ['low', 'medium', 'high'];
  }

  if (sdkType === 'claude-agent-sdk') {
    return ['low', 'medium', 'high', 'xhigh', 'max'];
  }

  return ['none', 'low', 'medium', 'high', 'xhigh'];
}

/**
 * 解析不同 Provider 的默认推理等级。
 */
export function resolveDefaultAiReasoningEffort(
  sdkType?: AiSdkType,
): AiReasoningEffort {
  if (sdkType === 'openai-compatible-http') {
    return DEFAULT_OPENAI_HTTP_REASONING_EFFORT;
  }

  if (sdkType === 'claude-agent-sdk') {
    return DEFAULT_CLAUDE_REASONING_EFFORT;
  }

  return DEFAULT_CODEX_REASONING_EFFORT;
}

/**
 * 将通用治理字段映射为 Codex SDK 可接受的真实推理档位。
 */
export function normalizeCodexReasoningEffort(
  value?: string,
): 'none' | 'low' | 'medium' | 'high' | 'xhigh' {
  const normalizedValue = normalizeAiReasoningEffort(value, 'codex-sdk');
  if (
    normalizedValue === 'low' ||
    normalizedValue === 'medium' ||
    normalizedValue === 'high' ||
    normalizedValue === 'xhigh'
  ) {
    return normalizedValue;
  }

  return 'none';
}

/**
 * 将通用治理字段映射为 Claude 直连 API 的 effort 档位。
 */
export function normalizeClaudeDirectEffort(
  value?: string,
): 'low' | 'medium' | 'high' | 'max' {
  const normalizedValue = normalizeAiReasoningEffort(
    value,
    'claude-agent-sdk',
  );

  if (
    normalizedValue === 'medium' ||
    normalizedValue === 'high' ||
    normalizedValue === 'max'
  ) {
    return normalizedValue;
  }

  if (normalizedValue === 'xhigh') {
    return 'high';
  }

  return 'low';
}

import {
  getReasoningEffortOptions,
  normalizeAiReasoningEffort,
  resolveDefaultAiReasoningEffort,
} from '../../src/shared/utils/ai-reasoning-effort.util';

describe('ai reasoning effort util', () => {
  it('Codex 缺省推理等级应回退为 none', () => {
    expect(resolveDefaultAiReasoningEffort('codex-sdk')).toBe('none');
    expect(normalizeAiReasoningEffort(undefined, 'codex-sdk')).toBe('none');
    expect(normalizeAiReasoningEffort('minimal', 'codex-sdk')).toBe('none');
  });

  it('Claude 缺省推理等级应回退为 low', () => {
    expect(resolveDefaultAiReasoningEffort('claude-agent-sdk')).toBe('low');
    expect(normalizeAiReasoningEffort(undefined, 'claude-agent-sdk')).toBe('low');
    expect(normalizeAiReasoningEffort('minimal', 'claude-agent-sdk')).toBe('low');
    expect(normalizeAiReasoningEffort('none', 'claude-agent-sdk')).toBe('low');
  });

  it('不同 Provider 应暴露各自可用的推理等级选项', () => {
    expect(getReasoningEffortOptions('codex-sdk')).toEqual([
      'none',
      'low',
      'medium',
      'high',
      'xhigh',
    ]);
    expect(getReasoningEffortOptions('claude-agent-sdk')).toEqual([
      'low',
      'medium',
      'high',
      'xhigh',
      'max',
    ]);
  });

  it('OpenAI 兼容 HTTP 缺省推理等级不应继续套用 Codex none 档位', () => {
    expect(resolveDefaultAiReasoningEffort('openai-compatible-http')).toBe('low');
    expect(normalizeAiReasoningEffort(undefined, 'openai-compatible-http')).toBe('low');
    expect(normalizeAiReasoningEffort('minimal', 'openai-compatible-http')).toBe('low');
    expect(normalizeAiReasoningEffort('none', 'openai-compatible-http')).toBe('low');
  });

  it('OpenAI 兼容 HTTP 仅暴露通用低中高推理等级', () => {
    expect(getReasoningEffortOptions('openai-compatible-http')).toEqual([
      'low',
      'medium',
      'high',
    ]);
  });
});

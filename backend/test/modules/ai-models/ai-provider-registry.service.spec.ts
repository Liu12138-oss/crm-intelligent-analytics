import { AiProviderRegistryService } from '../../../src/modules/ai-models/ai-provider-registry.service';
import { ClaudeProviderAdapter } from '../../../src/modules/ai-models/adapters/claude-provider.adapter';
import { CodexProviderAdapter } from '../../../src/modules/ai-models/adapters/codex-provider.adapter';
import { OpenAiCompatibleHttpAdapter } from '../../../src/modules/ai-models/adapters/openai-compatible-http.adapter';

describe('AiProviderRegistryService', () => {
  it('应按 sdkType 返回对应的 Provider adapter', () => {
    const codexAdapter = new CodexProviderAdapter();
    const claudeAdapter = new ClaudeProviderAdapter();
    const httpAdapter = new OpenAiCompatibleHttpAdapter();
    const registry = new AiProviderRegistryService([
      codexAdapter,
      claudeAdapter,
      httpAdapter,
    ]);

    expect(registry.getAdapter('codex-sdk')).toBe(codexAdapter);
    expect(registry.getAdapter('claude-agent-sdk')).toBe(claudeAdapter);
    expect(registry.getAdapter('openai-compatible-http')).toBe(httpAdapter);
  });
});

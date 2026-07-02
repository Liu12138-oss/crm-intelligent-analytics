import { readFileSync } from 'node:fs';
import { ClaudeProviderAdapter } from '../../../src/modules/ai-models/adapters/claude-provider.adapter';

describe('ClaudeProviderAdapter', () => {
  it('历史 Claude Agent Profile 健康检查应返回迁移提示而不是拉起 SDK 或 MCP', async () => {
    const adapter = new ClaudeProviderAdapter();

    const result = await adapter.healthCheck({
      id: 'profile_claude',
      name: '历史 Claude 配置',
      providerCode: 'anthropic-claude',
      sdkType: 'claude-agent-sdk',
      model: 'claude-sonnet-4-20250514',
      baseUrl: 'https://claude.example.com',
      apiKey: 'secret-claude-key',
      secretConfigured: true,
      status: 'INACTIVE',
      sdkOptions: {
        mcpConfigPath: 'C:\\Users\\test\\.claude\\settings.json',
        enableMcpValidation: true,
      },
      createdBy: 'user_admin',
      updatedBy: 'user_admin',
      createdAt: '2026-04-18T16:50:00.000Z',
      updatedAt: '2026-04-18T16:50:00.000Z',
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: 'FAILED',
        failureStage: 'STATIC_VALIDATION',
        failureReason: expect.stringContaining('迁移为 OpenAI 兼容 HTTP Profile'),
      }),
    );
    expect(result.mcpStatuses).toBeUndefined();
  });

  it('历史 Claude adapter 源码不得再动态导入 Claude Agent SDK', () => {
    const removedPackageName = ['@anthropic-ai', 'claude-agent-sdk'].join('/');
    const source = readFileSync(
      'src/modules/ai-models/adapters/claude-provider.adapter.ts',
      'utf8',
    );

    expect(source).not.toContain(removedPackageName);
    expect(source).not.toContain('importClaudeSdk');
  });
});

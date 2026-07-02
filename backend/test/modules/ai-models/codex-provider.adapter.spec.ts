import { readFileSync } from 'node:fs';
import { CodexProviderAdapter } from '../../../src/modules/ai-models/adapters/codex-provider.adapter';

describe('CodexProviderAdapter', () => {
  it('历史 Codex Profile 健康检查应返回迁移提示而不是拉起 SDK', async () => {
    const adapter = new CodexProviderAdapter();

    const result = await adapter.healthCheck({
      id: 'profile_codex',
      name: '历史 Codex 配置',
      providerCode: 'openai-codex',
      sdkType: 'codex-sdk',
      model: 'gpt-5-codex',
      baseUrl: 'https://codex.example.com/v1',
      apiKey: 'secret-codex-key',
      secretConfigured: true,
      status: 'INACTIVE',
      sdkOptions: {
        codexPath: 'codex',
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
  });

  it('历史 Codex adapter 源码不得再动态导入旧 Agent SDK', () => {
    const removedPackageName = ['@openai', 'codex-sdk'].join('/');
    const source = readFileSync(
      'src/modules/ai-models/adapters/codex-provider.adapter.ts',
      'utf8',
    );

    expect(source).not.toContain(removedPackageName);
    expect(source).not.toContain('importCodexSdk');
  });
});

import { createDefaultAppStorageState } from '../../../src/shared/mock/sample-data';
import { AiModelProfileService } from '../../../src/modules/ai-models/ai-model-profile.service';
import { AiSecretCryptoService } from '../../../src/modules/ai-models/ai-secret-crypto.service';

describe('AiModelProfileService', () => {
  function createService() {
    const state = createDefaultAppStorageState();
    const appStorage = {
      state,
      persist: jest.fn(),
    } as never;
    const cryptoService = new AiSecretCryptoService({
      getRepoRoot: jest.fn().mockReturnValue('D:\\code\\CRM'),
    } as never);

    return {
      state,
      service: new AiModelProfileService(appStorage, cryptoService),
    };
  }

  it('默认应用存储应包含 AI Profile 目录与激活记录', () => {
    const state = createDefaultAppStorageState();

    expect(state.aiModelProfiles).toEqual([]);
    expect(state.aiModelActivation).toEqual({
      activeProfileId: undefined,
      activatedAt: undefined,
      activatedBy: undefined,
      lastVerifiedAt: undefined,
      lastVerificationStatus: undefined,
    });
  });

  it('创建 Profile 时应加密保存密钥且不返回明文', () => {
    const { state, service } = createService();

    const created = service.create('user_admin', {
      name: 'Claude 生产',
      providerCode: 'anthropic-claude',
      sdkType: 'claude-agent-sdk',
      model: 'claude-sonnet-4-20250514',
      baseUrl: 'https://example.com',
      apiKey: 'secret-claude-key',
      timeoutMs: 12000,
      sdkOptions: {
        cwd: 'D:\\code\\CRM',
      },
    });

    expect(created.secretConfigured).toBe(true);
    expect(created.secretMask).toBe('已配置');
    expect((created as { apiKey?: string }).apiKey).toBeUndefined();
    expect(state.aiModelProfiles).toHaveLength(1);
    expect(state.aiModelProfiles[0].secretCiphertext).toBeTruthy();
    expect(state.aiModelProfiles[0].secretCiphertext).not.toContain('secret-claude-key');
  });

  it('创建 OpenAI 兼容 HTTP Profile 且未显式填写推理等级时应默认写入低档位', () => {
    const { state, service } = createService();

    const created = service.create('user_admin', {
      name: 'HTTP 默认推理档位',
      providerCode: 'internal-openai-gateway',
      sdkType: 'openai-compatible-http',
      model: 'gpt-5.4',
      baseUrl: 'https://example.com/v1',
      apiKey: 'secret-openai-compatible-key',
      sdkOptions: {},
    });

    expect(created.reasoningEffort).toBe('low');
    expect(state.aiModelProfiles[0].reasoningEffort).toBe('low');
  });

  it('创建 OpenAI 兼容 HTTP Profile 时应保留结构化输出模式', () => {
    const { state, service } = createService();

    service.create('user_admin', {
      name: 'HTTP 主配置',
      providerCode: 'internal-openai-gateway',
      sdkType: 'openai-compatible-http',
      model: 'gpt-5.4',
      baseUrl: 'https://example.com/v1',
      apiKey: 'secret-openai-compatible-key',
      sdkOptions: {
        wireApi: 'responses',
        structuredOutputMode: 'json_schema',
        disableResponseStorage: true,
      },
    });

    expect(state.aiModelProfiles[0].sdkOptions).toEqual(
      expect.objectContaining({
        wireApi: 'responses',
        structuredOutputMode: 'json_schema',
        disableResponseStorage: true,
      }),
    );
  });

  it('编辑 Profile 时密钥留空应保留原密钥', () => {
    const { state, service } = createService();
    const created = service.create('user_admin', {
      name: 'Codex 主配置',
      providerCode: 'openai-codex',
      sdkType: 'codex-sdk',
      model: 'gpt-5-codex',
      baseUrl: 'https://example.com/v1',
      apiKey: 'secret-codex-key',
      sdkOptions: {},
    });

    const beforeCiphertext = state.aiModelProfiles[0].secretCiphertext;
    const updated = service.update('user_admin', created.id, {
      name: 'Codex 主配置-更新',
      providerCode: 'openai-codex',
      sdkType: 'codex-sdk',
      model: 'gpt-5-codex',
      baseUrl: 'https://example.com/v1',
      apiKey: '',
      sdkOptions: {},
    });

    expect(updated.name).toBe('Codex 主配置-更新');
    expect(state.aiModelProfiles[0].secretCiphertext).toBe(beforeCiphertext);
  });

  it('复制历史空值 Profile 时应补齐最低推理档位', () => {
    const { state, service } = createService();
    const created = service.create('user_admin', {
      name: 'Codex 历史空值',
      providerCode: 'openai-codex',
      sdkType: 'codex-sdk',
      model: 'gpt-5-codex',
      baseUrl: 'https://example.com/v1',
      apiKey: 'secret-codex-key',
      sdkOptions: {},
    });

    state.aiModelProfiles[0].reasoningEffort = undefined;

    const copied = service.copy('user_admin', created.id);

    expect(copied.reasoningEffort).toBe('none');
    expect(
      state.aiModelProfiles.find((profile) => profile.id === copied.id)?.reasoningEffort,
    ).toBe('none');
  });

  it('状态切换为 INACTIVE 时不应单独阻止其后续被设为当前生效配置', () => {
    const { state, service } = createService();
    const created = service.create('user_admin', {
      name: 'Codex 主配置',
      providerCode: 'openai-codex',
      sdkType: 'codex-sdk',
      model: 'gpt-5-codex',
      baseUrl: 'https://example.com/v1',
      apiKey: 'secret-codex-key',
      sdkOptions: {},
    });

    service.setStatus('user_admin', created.id, 'INACTIVE');
    state.aiModelProfiles[0].lastHealthCheckStatus = 'SUCCEEDED';

    expect(() => service.assertActivatable(created.id)).not.toThrow();
  });

  it('最近一次测试未通过时应阻止其继续作为激活目标', () => {
    const { state, service } = createService();
    const created = service.create('user_admin', {
      name: 'Codex 主配置',
      providerCode: 'openai-codex',
      sdkType: 'codex-sdk',
      model: 'gpt-5-codex',
      baseUrl: 'https://example.com/v1',
      apiKey: 'secret-codex-key',
      sdkOptions: {},
    });

    state.aiModelProfiles[0].lastHealthCheckStatus = 'FAILED';

    expect(() =>
      service.assertActivatable(created.id),
    ).toThrow('当前 AI Profile 最近一次测试未通过，不能被激活。');
  });
});

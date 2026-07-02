import { createDefaultAppStorageState } from '../../../src/shared/mock/sample-data';
import { AiRuntimeConfigResolver } from '../../../src/modules/ai-models/ai-runtime-config.resolver';

describe('AiRuntimeConfigResolver', () => {
  function createResolver(overrides?: {
    profileState?: ReturnType<typeof createDefaultAppStorageState>;
    envConfig?: Record<string, unknown>;
  }) {
    const state = overrides?.profileState ?? createDefaultAppStorageState();
    const appStorage = { state } as never;
    const localRuntimeConfigService = {
      getAiConfig: jest.fn().mockReturnValue({
        enabled: true,
        baseUrl: 'https://env-default.example.com/v1',
        model: 'env-default-model',
        modelProvider: 'env-default-provider',
        apiKey: 'env-default-key',
        sdkType: 'openai-compatible-http',
        reasoningEffort: 'low',
        wireApi: 'responses',
        structuredOutputMode: 'json_schema',
        ...overrides?.envConfig,
      }),
    } as never;

    return new AiRuntimeConfigResolver(appStorage, localRuntimeConfigService);
  }

  it('无激活 Profile 时应回退环境默认配置', () => {
    const resolver = createResolver();

    const resolved = resolver.getCurrentConfig();

    expect(resolved.model).toBe('env-default-model');
    expect(resolved.modelProvider).toBe('env-default-provider');
    expect(resolved.baseUrl).toBe('https://env-default.example.com/v1');
  });

  it('存在激活 Profile 时应优先返回激活 Profile 配置', () => {
    const state = createDefaultAppStorageState();
    state.aiModelProfiles.push({
      id: 'profile_http_active',
      name: 'HTTP 激活配置',
      providerCode: 'internal-openai-gateway',
      sdkType: 'openai-compatible-http',
      model: 'gpt-5.4',
      baseUrl: 'https://gateway.example.com/v1',
      secretCiphertext: 'ciphertext',
      secretConfigured: true,
      reasoningEffort: 'low',
      serviceTier: 'fast',
      timeoutMs: 10000,
      status: 'ACTIVE',
      sdkOptions: {
        wireApi: 'responses',
        structuredOutputMode: 'json_schema',
        disableResponseStorage: true,
        proxyEnv: {
          HTTPS_PROXY: 'http://127.0.0.1:7890',
        },
      },
      createdBy: 'user_admin',
      updatedBy: 'user_admin',
      createdAt: '2026-04-18T16:10:00.000Z',
      updatedAt: '2026-04-18T16:10:00.000Z',
    });
    state.aiModelActivation = {
      activeProfileId: 'profile_http_active',
      activatedAt: '2026-04-18T16:10:00.000Z',
      activatedBy: 'user_admin',
      lastVerifiedAt: '2026-04-18T16:10:10.000Z',
      lastVerificationStatus: 'SUCCEEDED',
    };

    const resolver = createResolver({ profileState: state });
    const resolved = resolver.getCurrentConfig();

    expect(resolved.model).toBe('gpt-5.4');
    expect(resolved.baseUrl).toBe('https://gateway.example.com/v1');
    expect(resolved.sdkType).toBe('openai-compatible-http');
    expect(resolved.structuredOutputMode).toBe('json_schema');
    expect(resolved.disableResponseStorage).toBe(true);
    expect(resolved.proxyEnv).toEqual({
      HTTPS_PROXY: 'http://127.0.0.1:7890',
    });
    expect(resolved.source).toBe('profile');
  });

  it('OpenAI 兼容 HTTP 激活 Profile 未配置推理等级时应回退为低档位', () => {
    const state = createDefaultAppStorageState();
    state.aiModelProfiles.push({
      id: 'profile_http_active',
      name: 'HTTP 激活配置',
      providerCode: 'internal-openai-gateway',
      sdkType: 'openai-compatible-http',
      model: 'gpt-5.4',
      baseUrl: 'https://gateway.example.com/v1',
      secretCiphertext: 'ciphertext',
      secretConfigured: true,
      reasoningEffort: undefined,
      serviceTier: 'fast',
      timeoutMs: 10000,
      status: 'ACTIVE',
      sdkOptions: {
        wireApi: 'chat_completions',
        structuredOutputMode: 'json_object',
      },
      createdBy: 'user_admin',
      updatedBy: 'user_admin',
      createdAt: '2026-04-18T16:10:00.000Z',
      updatedAt: '2026-04-18T16:10:00.000Z',
    });
    state.aiModelActivation = {
      activeProfileId: 'profile_http_active',
      activatedAt: '2026-04-18T16:10:00.000Z',
      activatedBy: 'user_admin',
      lastVerifiedAt: '2026-04-18T16:10:10.000Z',
      lastVerificationStatus: 'SUCCEEDED',
    };

    const resolver = createResolver({ profileState: state });
    const resolved = resolver.getCurrentConfig();

    expect(resolved.reasoningEffort).toBe('low');
    expect(resolved.wireApi).toBe('chat_completions');
    expect(resolved.structuredOutputMode).toBe('json_object');
  });

  it('激活 Profile 缺失时应自动回退环境默认配置', () => {
    const state = createDefaultAppStorageState();
    state.aiModelActivation = {
      activeProfileId: 'missing_profile',
      activatedAt: '2026-04-18T16:10:00.000Z',
      activatedBy: 'user_admin',
      lastVerifiedAt: '2026-04-18T16:10:10.000Z',
      lastVerificationStatus: 'FAILED',
    };

    const resolver = createResolver({ profileState: state });
    const resolved = resolver.getCurrentConfig();

    expect(resolved.source).toBe('env');
    expect(resolved.model).toBe('env-default-model');
  });
});

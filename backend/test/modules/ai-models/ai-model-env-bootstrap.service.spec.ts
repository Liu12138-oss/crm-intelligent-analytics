import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AppStorageService } from '../../../src/database/app-storage/app-storage.service';
import { createDefaultAppStorageState } from '../../../src/shared/mock/sample-data';
import { AiModelEnvBootstrapService } from '../../../src/modules/ai-models/ai-model-env-bootstrap.service';
import { AiModelProfileService } from '../../../src/modules/ai-models/ai-model-profile.service';
import { AiSecretCryptoService } from '../../../src/modules/ai-models/ai-secret-crypto.service';

describe('AiModelEnvBootstrapService', () => {
  function createService() {
    const state = createDefaultAppStorageState();
    const appStorage = {
      state,
      persist: jest.fn(),
    } as never;
    const cryptoService = new AiSecretCryptoService({
      getRepoRoot: jest.fn().mockReturnValue('D:\\code\\CRM'),
    } as never);
    const profileService = new AiModelProfileService(appStorage, cryptoService);
    const localRuntimeConfigService = {
      getOpenAiCompatibleHttpEnvConfig: jest.fn().mockReturnValue({
        providerCode: 'anthropic-claude',
        sdkType: 'openai-compatible-http',
        baseUrl: 'https://api.leagsoft.ai/v1',
        model: 'claude-sonnet-4-20250514',
        apiKey: 'secret-claude-key',
        reasoningEffort: 'low',
        serviceTier: 'standard',
        sdkOptions: {
          wireApi: 'chat_completions',
          structuredOutputMode: 'json_object',
          requiresOpenaiAuth: true,
          disableResponseStorage: true,
        },
        warnings: [],
      }),
      getClaudeEnvConfig: jest.fn(),
      getAiConfig: jest.fn(),
    } as never;

    return {
      state,
      service: new AiModelEnvBootstrapService(
        appStorage,
        localRuntimeConfigService,
        profileService,
      ),
    };
  }

  it('应按环境配置生成唯一的 OpenAI 兼容 HTTP 默认档案', () => {
    const { state, service } = createService();

    service.ensureBootstrapped();

    expect(state.aiModelProfiles).toEqual([
      expect.objectContaining({
        bootstrapKey: 'env_openai_compatible_http_default',
        sourceType: 'ENV_BOOTSTRAPPED',
        providerCode: 'anthropic-claude',
        sdkType: 'openai-compatible-http',
        model: 'claude-sonnet-4-20250514',
        baseUrl: 'https://api.leagsoft.ai/v1',
        reasoningEffort: 'low',
        status: 'ACTIVE',
        sdkOptions: expect.objectContaining({
          wireApi: 'chat_completions',
          structuredOutputMode: 'json_object',
        }),
      }),
    ]);
    expect(state.aiModelActivation.activeProfileId).toBeTruthy();
  });

  it('已存在环境默认 HTTP 档案时应原位更新，而不是重复创建', () => {
    const { state, service } = createService();

    service.ensureBootstrapped();
    const existingProfileId = state.aiModelProfiles[0].id;

    service.ensureBootstrapped();

    expect(state.aiModelProfiles).toHaveLength(1);
    expect(state.aiModelProfiles[0].id).toBe(existingProfileId);
  });

  it('管理员手工修正过环境默认档案后，后续启动不应再被环境值覆盖', () => {
    const { state, service } = createService();

    service.ensureBootstrapped();
    state.aiModelProfiles[0] = {
      ...state.aiModelProfiles[0],
      baseUrl: 'https://manual-gateway.example.com/v1',
      model: 'gpt-5-mini',
      updatedBy: 'liulonghai',
      updatedAt: '2026-06-04T08:30:00.000Z',
    };

    service.ensureBootstrapped();

    expect(state.aiModelProfiles).toHaveLength(1);
    expect(state.aiModelProfiles[0]).toEqual(
      expect.objectContaining({
        baseUrl: 'https://manual-gateway.example.com/v1',
        model: 'gpt-5-mini',
        updatedBy: 'liulonghai',
      }),
    );
  });

  it('启动时应清理所有历史 SDK 默认档案', () => {
    const { state, service } = createService();
    state.aiModelProfiles.push(
      {
        id: 'legacy_codex_profile',
        name: '环境默认 Codex',
        providerCode: 'aicodex',
        sourceType: 'ENV_BOOTSTRAPPED',
        bootstrapKey: 'env_codex_default',
        sdkType: 'codex-sdk',
        model: 'gpt-5.4',
        baseUrl: 'https://legacy-codex.example.com',
        secretConfigured: true,
        status: 'INACTIVE',
        sdkOptions: {},
        createdBy: 'system_env_bootstrap',
        updatedBy: 'system_env_bootstrap',
        createdAt: '2026-04-20T10:00:00.000Z',
        updatedAt: '2026-04-20T10:00:00.000Z',
      } as never,
      {
        id: 'legacy_claude_profile',
        name: '环境默认 Claude',
        providerCode: 'anthropic-claude',
        sourceType: 'ENV_BOOTSTRAPPED',
        bootstrapKey: 'env_claude_default',
        sdkType: 'claude-agent-sdk',
        model: 'claude-sonnet-4-20250514',
        baseUrl: 'https://legacy-claude.example.com',
        secretConfigured: true,
        status: 'ACTIVE',
        sdkOptions: {},
        createdBy: 'system_env_bootstrap',
        updatedBy: 'system_env_bootstrap',
        createdAt: '2026-04-20T10:00:00.000Z',
        updatedAt: '2026-04-20T10:00:00.000Z',
      } as never,
    );
    state.aiModelActivation = {
      activeProfileId: 'legacy_claude_profile',
      activatedAt: '2026-04-20T10:00:00.000Z',
      activatedBy: 'system_env_bootstrap',
      lastVerifiedAt: '2026-04-20T10:00:00.000Z',
      lastVerificationStatus: 'SUCCEEDED',
    };

    service.ensureBootstrapped();

    expect(state.aiModelProfiles).toHaveLength(1);
    expect(state.aiModelProfiles[0].sdkType).toBe('openai-compatible-http');
    expect(state.aiModelActivation.activeProfileId).toBe(state.aiModelProfiles[0].id);
  });

  it('引导默认档案后，重新加载应用状态时应保留同一批 Profile 与激活记录', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'crm-ai-bootstrap-'));
    const originalNodeEnv = process.env.NODE_ENV;
    const repoRuntimeConfig = {
      getRepoRoot: jest.fn().mockReturnValue(repoRoot),
    } as never;
    const envRuntimeConfig = {
      getOpenAiCompatibleHttpEnvConfig: jest.fn().mockReturnValue({
        providerCode: 'anthropic-claude',
        sdkType: 'openai-compatible-http',
        baseUrl: 'https://api.leagsoft.ai/v1',
        model: 'claude-sonnet-4-20250514',
        apiKey: 'secret-claude-key',
        reasoningEffort: 'low',
        serviceTier: 'standard',
        sdkOptions: {
          wireApi: 'chat_completions',
          structuredOutputMode: 'json_object',
          requiresOpenaiAuth: true,
          disableResponseStorage: true,
        },
        warnings: [],
      }),
      getClaudeEnvConfig: jest.fn(),
      getAiConfig: jest.fn(),
    } as never;

    try {
      process.env.NODE_ENV = 'development';
      const appStorage = new AppStorageService(repoRuntimeConfig);
      const cryptoService = new AiSecretCryptoService(repoRuntimeConfig);
      const profileService = new AiModelProfileService(appStorage, cryptoService);
      const bootstrapService = new AiModelEnvBootstrapService(
        appStorage,
        envRuntimeConfig,
        profileService,
      );

      bootstrapService.ensureBootstrapped();

      const firstProfiles = appStorage.state.aiModelProfiles.map((item) => ({
        id: item.id,
        bootstrapKey: item.bootstrapKey,
      }));
      const firstActivationId = appStorage.state.aiModelActivation.activeProfileId;

      const reloadedStorage = new AppStorageService(repoRuntimeConfig);

      expect(
        reloadedStorage.state.aiModelProfiles.map((item) => ({
          id: item.id,
          bootstrapKey: item.bootstrapKey,
        })),
      ).toEqual(firstProfiles);
      expect(reloadedStorage.state.aiModelActivation.activeProfileId).toBe(
        firstActivationId,
      );
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});

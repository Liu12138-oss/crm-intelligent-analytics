import { createDefaultAppStorageState } from '../../../src/shared/mock/sample-data';
import { AiHealthCheckService } from '../../../src/modules/ai-models/ai-health-check.service';
import { AiModelProfileService } from '../../../src/modules/ai-models/ai-model-profile.service';
import { AiProviderRegistryService } from '../../../src/modules/ai-models/ai-provider-registry.service';
import { AiSecretCryptoService } from '../../../src/modules/ai-models/ai-secret-crypto.service';

describe('AiHealthCheckService', () => {
  it('执行健康检查后应回写最近测试结果', async () => {
    const state = createDefaultAppStorageState();
    const appStorage = {
      state,
      persist: jest.fn(),
    } as never;
    const cryptoService = new AiSecretCryptoService({
      getRepoRoot: jest.fn().mockReturnValue('D:\\code\\CRM'),
    } as never);
    const profileService = new AiModelProfileService(appStorage, cryptoService);
    const created = profileService.create('user_admin', {
      name: 'HTTP 主配置',
      providerCode: 'internal-openai-gateway',
      sdkType: 'openai-compatible-http',
      model: 'gpt-5.4',
      baseUrl: 'https://gateway.example.com/v1',
      apiKey: 'secret-openai-compatible-key',
      sdkOptions: {},
    });
    const registry = {
      getAdapter: jest.fn().mockReturnValue({
        healthCheck: jest.fn().mockResolvedValue({
          status: 'SUCCEEDED',
          latencyMs: 128,
        providerSummary: 'internal-openai-gateway:gpt-5.4',
        }),
      }),
    } as unknown as AiProviderRegistryService;
    const service = new AiHealthCheckService(profileService, registry, cryptoService);

    const result = await service.runHealthCheck(created.id);

    expect(result).toEqual(
      expect.objectContaining({
        status: 'SUCCEEDED',
        latencyMs: 128,
      }),
    );
    expect(state.aiModelProfiles[0]).toEqual(
      expect.objectContaining({
        lastHealthCheckStatus: 'SUCCEEDED',
        lastHealthCheckLatencyMs: 128,
      }),
    );
  });

  it('草稿测试在编辑场景下应复用已保存密钥', async () => {
    const state = createDefaultAppStorageState();
    const appStorage = {
      state,
      persist: jest.fn(),
    } as never;
    const cryptoService = new AiSecretCryptoService({
      getRepoRoot: jest.fn().mockReturnValue('D:\\code\\CRM'),
    } as never);
    const profileService = new AiModelProfileService(appStorage, cryptoService);
    const created = profileService.create('user_admin', {
      name: 'HTTP 主配置',
      providerCode: 'internal-openai-gateway',
      sdkType: 'openai-compatible-http',
      model: 'gpt-5.4',
      baseUrl: 'https://gateway.example.com/v1',
      apiKey: 'secret-openai-compatible-key',
      sdkOptions: {
        wireApi: 'responses',
        structuredOutputMode: 'json_schema',
      },
    });
    const healthCheck = jest.fn().mockResolvedValue({
      status: 'SUCCEEDED',
      latencyMs: 48,
      providerSummary: 'internal-openai-gateway:gpt-5.4',
    });
    const registry = {
      getAdapter: jest.fn().mockReturnValue({
        healthCheck,
      }),
    } as unknown as AiProviderRegistryService;
    const service = new AiHealthCheckService(profileService, registry, cryptoService);

    await service.runDraftHealthCheck({
      profileId: created.id,
      name: 'HTTP 主配置',
      providerCode: 'internal-openai-gateway',
      sdkType: 'openai-compatible-http',
      model: 'gpt-5.4',
      baseUrl: 'https://gateway.example.com/v1',
      apiKey: '',
      sdkOptions: {
        wireApi: 'responses',
        structuredOutputMode: 'json_schema',
      },
    });

    expect(healthCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        id: created.id,
        apiKey: 'secret-openai-compatible-key',
        secretConfigured: true,
      }),
    );
    expect(state.aiModelProfiles[0].lastHealthCheckStatus).toBeUndefined();
  });
});

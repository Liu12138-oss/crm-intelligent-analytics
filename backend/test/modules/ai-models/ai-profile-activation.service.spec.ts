import { createDefaultAppStorageState } from '../../../src/shared/mock/sample-data';
import type { AiProviderHealthCheckResult } from '../../../src/modules/ai-models/adapters/ai-provider.adapter';
import { AiModelProfileService } from '../../../src/modules/ai-models/ai-model-profile.service';
import { AiProfileActivationService } from '../../../src/modules/ai-models/ai-profile-activation.service';
import { AiSecretCryptoService } from '../../../src/modules/ai-models/ai-secret-crypto.service';

describe('AiProfileActivationService', () => {
  function createServices() {
    const state = createDefaultAppStorageState();
    const appStorage = {
      state,
      persist: jest.fn(),
    } as never;
    const cryptoService = new AiSecretCryptoService({
      getRepoRoot: jest.fn().mockReturnValue('D:\\code\\CRM'),
    } as never);
    const profileService = new AiModelProfileService(appStorage, cryptoService);
    const activationService = new AiProfileActivationService(
      appStorage,
      profileService,
      {
        createEvent: jest.fn(),
      } as never,
    );

    return {
      state,
      profileService,
      activationService,
    };
  }

  it('激活新 Profile 时应覆盖旧激活记录，保证全局唯一激活', () => {
    const { state, profileService, activationService } = createServices();
    const codexProfile = profileService.create('user_admin', {
      name: 'Codex 主配置',
      providerCode: 'openai-codex',
      sdkType: 'codex-sdk',
      model: 'gpt-5-codex',
      baseUrl: 'https://codex.example.com/v1',
      apiKey: 'secret-codex-key',
      sdkOptions: {},
    });
    const claudeProfile = profileService.create('user_admin', {
      name: 'Claude 主配置',
      providerCode: 'anthropic-claude',
      sdkType: 'claude-agent-sdk',
      model: 'claude-sonnet-4-20250514',
      baseUrl: 'https://claude.example.com',
      apiKey: 'secret-claude-key',
      sdkOptions: {},
    });

    state.aiModelProfiles[0].lastHealthCheckStatus = 'SUCCEEDED';
    state.aiModelProfiles[1].lastHealthCheckStatus = 'SUCCEEDED';

    activationService.activate('user_admin', codexProfile.id);
    activationService.activate('user_admin', claudeProfile.id);

    expect(state.aiModelActivation.activeProfileId).toBe(claudeProfile.id);
    expect(state.aiModelActivation.activatedBy).toBe('user_admin');
    expect(state.aiModelProfiles[0].status).toBe('INACTIVE');
    expect(state.aiModelProfiles[1].status).toBe('ACTIVE');
  });

  it('切换后验证失败时应回滚到上一个激活 Profile', async () => {
    const { state, profileService, activationService } = createServices();
    const firstProfile = profileService.create('user_admin', {
      name: 'Codex 主配置',
      providerCode: 'openai-codex',
      sdkType: 'codex-sdk',
      model: 'gpt-5-codex',
      baseUrl: 'https://codex.example.com/v1',
      apiKey: 'secret-codex-key',
      sdkOptions: {},
    });
    const secondProfile = profileService.create('user_admin', {
      name: 'Claude 主配置',
      providerCode: 'anthropic-claude',
      sdkType: 'claude-agent-sdk',
      model: 'claude-sonnet-4-20250514',
      baseUrl: 'https://claude.example.com',
      apiKey: 'secret-claude-key',
      sdkOptions: {},
    });

    state.aiModelProfiles[0].lastHealthCheckStatus = 'SUCCEEDED';
    state.aiModelProfiles[1].lastHealthCheckStatus = 'SUCCEEDED';
    activationService.activate('user_admin', firstProfile.id);

    await expect(
      activationService.activateWithVerification(
        {
          id: 'user_admin',
          roleIds: ['role_admin'],
          organizationIds: ['org_north'],
          departmentIds: ['dept_admin'],
          ownerIds: [],
          isAdmin: true,
        },
        secondProfile.id,
        async (): Promise<AiProviderHealthCheckResult> => ({
          status: 'FAILED',
          latencyMs: 15,
          failureStage: 'SDK_CALL',
          failureReason: 'mock verification failed',
          providerSummary: 'anthropic-claude:claude-sonnet-4-20250514',
        }),
      ),
    ).rejects.toThrow('切换后的 AI Profile 验证失败，已回滚到上一条配置。');

    expect(state.aiModelActivation.activeProfileId).toBe(firstProfile.id);
  });
});

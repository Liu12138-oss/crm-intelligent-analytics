import { LianruanCrmConnectionConfigService } from '../../../src/modules/governance/lianruan-crm-connection-config.service';
import type { AppStorageState, CrmUser } from '../../../src/shared/types/domain';
import { createDefaultAppStorageState } from '../../../src/shared/mock/sample-data';

const adminUser: CrmUser = {
  id: 'user_admin',
  name: '治理管理员',
  roleIds: ['role_admin'],
  roleNames: ['治理管理员'],
  organizationIds: [],
  departmentIds: [],
  ownerIds: [],
  isAdmin: true,
  exportAllowed: true,
  channels: ['web-console'],
};

function createFixture(stateOverride?: Partial<AppStorageState>) {
  const state = {
    ...createDefaultAppStorageState(),
    ...stateOverride,
  };
  const appStorage = {
    state,
    persist: jest.fn(),
  };
  const localRuntimeConfigService = {
    getCrmStandardOpenApiConfig: jest.fn(() => ({
      enabled: true,
      baseUrl: 'http://10.18.16.114:3000/api/open/v1',
      appKey: 'oak_env_key',
      appSecret: 'oas_env_secret',
      timeoutMs: 12000,
      tokenCacheBufferSeconds: 60,
    })),
  };
  const permissionEnforcementService = {
    ensureAction: jest.fn(),
  };
  const service = new LianruanCrmConnectionConfigService(
    appStorage as never,
    localRuntimeConfigService as never,
    permissionEnforcementService as never,
  );

  return {
    service,
    appStorage,
    permissionEnforcementService,
  };
}

describe('LianruanCrmConnectionConfigService', () => {
  it('未保存页面配置时应读取 env 兜底并脱敏展示凭证', () => {
    const { service } = createFixture();

    const view = service.getConfigView(adminUser);

    expect(view).toMatchObject({
      useRuntimeConfig: false,
      effectiveEnabled: true,
      source: 'env',
      baseUrl: 'http://10.18.16.114:3000/api/open/v1',
      appKeyPresent: true,
      appSecretPresent: true,
      timeoutMs: 12000,
      tokenCacheBufferSeconds: 60,
    });
    expect(view.appKeyMasked).toBe('oak_****_key');
    expect(JSON.stringify(view)).not.toContain('oas_env_secret');
  });

  it('保存页面配置后应覆盖地址并继续沿用未重填的 env Secret', () => {
    const { service, appStorage } = createFixture();

    const view = service.updateConfig(adminUser, {
      enabled: true,
      baseUrl: 'http://10.18.16.254:3000/api/open/v1/',
      timeoutMs: 15000,
      tokenCacheBufferSeconds: 90,
    });
    const effective = service.getEffectiveRuntimeConfig();

    expect(view).toMatchObject({
      useRuntimeConfig: true,
      source: 'mixed',
      baseUrl: 'http://10.18.16.254:3000/api/open/v1',
      timeoutMs: 15000,
      tokenCacheBufferSeconds: 90,
      appSecretPresent: true,
    });
    expect(effective).toMatchObject({
      enabled: true,
      baseUrl: 'http://10.18.16.254:3000/api/open/v1',
      appKey: 'oak_env_key',
      appSecret: 'oas_env_secret',
    });
    expect(appStorage.persist).toHaveBeenCalledTimes(1);
  });

  it('连接测试成功时不应返回 accessToken 或 Secret', async () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          message: 'ok',
          data: {
            accessToken: 'openapi_should_not_return',
            expiresIn: 7200,
            tokenType: 'Bearer',
            clientId: 'client_001',
            clientName: 'AI-agent-superadmin-sit',
            boundUser: {
              id: 'A030',
              username: 'liulonghai',
              name: '刘龙海',
              role: 'superadmin',
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          message: 'ok',
          data: {
            client: {
              id: 'client_001',
              name: 'AI-agent-superadmin-sit',
              boundUserId: 'A030',
              status: 'active',
              allowedResources: ['*'],
              ipWhitelist: ['10.18.16.114'],
            },
            user: {
              id: 'A030',
              username: 'liulonghai',
              name: '刘龙海',
              role: 'superadmin',
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          message: 'ok',
          data: {
            user: { id: 'A030', name: '刘龙海', role: 'superadmin' },
            scopeType: 'all',
            regions: [],
            partnerIds: [],
            userIds: [],
          },
        }),
      });
    global.fetch = fetchMock as typeof global.fetch;
    const { service } = createFixture();

    const result = await service.testConfig(adminUser);

    expect(result.success).toBe(true);
    expect(result.context).toMatchObject({
      boundUserId: 'A030',
      boundUserName: '刘龙海',
    });
    expect(JSON.stringify(result)).not.toContain('openapi_should_not_return');
    expect(JSON.stringify(result)).not.toContain('oas_env_secret');
    global.fetch = originalFetch;
  });

  it('连接测试遇到 40112 时应明确提示 client 无效', async () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn().mockResolvedValueOnce({
      json: async () => ({
        code: 40112,
        message: 'client invalid',
        requestId: 'req_invalid_client',
      }),
    });
    global.fetch = fetchMock as typeof global.fetch;
    const { service } = createFixture();

    const result = await service.testConfig(adminUser);

    expect(result.success).toBe(false);
    expect(result.message).toContain('client 无效');
    expect(result.message).toContain('App Key');
    expect(result.steps[0]?.message).toContain('client 无效');
    expect(result.steps[0]?.message).toContain('code=40112');
    global.fetch = originalFetch;
  });
});

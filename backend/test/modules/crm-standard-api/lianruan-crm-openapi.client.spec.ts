import type { LianruanCrmConnectionConfigService } from '../../../src/modules/governance/lianruan-crm-connection-config.service';
import { LianruanCrmOpenApiClient } from '../../../src/modules/crm-standard-api/lianruan-crm-openapi.client';

describe('LianruanCrmOpenApiClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('应缓存 access token，并在后续请求中自动带上 Bearer 头', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          code: 0,
          message: 'ok',
          data: {
            accessToken: 'openapi_token_001',
            expiresIn: 7200,
            tokenType: 'Bearer',
            clientId: 'client_001',
            clientName: 'AI-agent-test',
            boundUser: {
              id: 'A002',
              username: 'admin_sh',
              name: '上海区管理员',
              role: 'admin',
              region: '上海区（非金）',
              bigRegion: '大东区',
              status: 'active',
            },
          },
          requestId: 'req_token_001',
        }),
      })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          code: 0,
          message: 'ok',
          data: {
            client: {
              id: 'client_001',
              name: 'AI-agent-test',
              boundUserId: 'A002',
              status: 'active',
              allowedResources: ['users', 'opportunities'],
              ipWhitelist: ['10.0.0.10'],
            },
            user: {
              id: 'A002',
              username: 'admin_sh',
              name: '上海区管理员',
              role: 'admin',
              region: '上海区（非金）',
              bigRegion: '大东区',
              partnerId: '',
              partnerName: '',
              status: 'active',
            },
          },
          requestId: 'req_me_001',
        }),
      })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          code: 0,
          message: 'ok',
          data: {
            user: {
              id: 'A002',
              name: '上海区管理员',
              role: 'admin',
            },
            scopeType: 'region',
            regions: ['上海区（非金）'],
            partnerIds: [],
            userIds: [],
          },
          requestId: 'req_scope_001',
        }),
      });

    global.fetch = fetchMock as typeof global.fetch;

    const configService = {
      getEffectiveRuntimeConfig: () => ({
        enabled: true,
        baseUrl: 'https://crm.example.com/api/open/v1',
        appKey: 'oak_test',
        appSecret: 'oas_test',
        timeoutMs: 12000,
        tokenCacheBufferSeconds: 60,
        source: 'env',
      }),
    } as Pick<LianruanCrmConnectionConfigService, 'getEffectiveRuntimeConfig'> as LianruanCrmConnectionConfigService;
    const logger = {
      logStep: jest.fn(),
      logWarn: jest.fn(),
    };

    const client = new LianruanCrmOpenApiClient(
      configService,
      logger as never,
    );

    const context = await client.getCurrentContext();
    const permissionScope = await client.getPermissionScope();

    expect(context.user.id).toBe('A002');
    expect(permissionScope.scopeType).toBe('region');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://crm.example.com/api/open/v1/auth/token',
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://crm.example.com/api/open/v1/auth/me',
    );
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: 'GET',
      headers: expect.objectContaining({
        Authorization: 'Bearer openapi_token_001',
      }),
    });
    expect(fetchMock.mock.calls[2][1]).toMatchObject({
      method: 'GET',
      headers: expect.objectContaining({
        Authorization: 'Bearer openapi_token_001',
      }),
    });
  });

  it('应读取渠道贡献统计接口并透传统计筛选参数', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          code: 0,
          message: 'ok',
          data: {
            accessToken: 'openapi_token_002',
            expiresIn: 7200,
            tokenType: 'Bearer',
            clientId: 'client_002',
            clientName: 'AI-agent-test',
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
        status: 200,
        ok: true,
        json: async () => ({
          code: 0,
          message: 'ok',
          data: [
            {
              partnerId: 'P001',
              partnerName: '山东联软服务商',
              opportunityCount: 2,
              opportunityAmount: 1300000,
            },
          ],
          requestId: 'req_partner_contribution_001',
        }),
      });

    global.fetch = fetchMock as typeof global.fetch;

    const configService = {
      getEffectiveRuntimeConfig: () => ({
        enabled: true,
        baseUrl: 'https://crm.example.com/api/open/v1',
        appKey: 'oak_test',
        appSecret: 'oas_test',
        timeoutMs: 12000,
        tokenCacheBufferSeconds: 60,
        source: 'env',
      }),
    } as Pick<LianruanCrmConnectionConfigService, 'getEffectiveRuntimeConfig'> as LianruanCrmConnectionConfigService;
    const client = new LianruanCrmOpenApiClient(
      configService,
      {
        logStep: jest.fn(),
        logWarn: jest.fn(),
      } as never,
    );

    const result = await client.listPartnerContributions({
      region: '山东区',
      createdAfter: '2026-06-01T00:00:00.000Z',
      createdBefore: '2026-07-01T00:00:00.000Z',
    });

    expect(result).toEqual([
      expect.objectContaining({
        partnerId: 'P001',
        opportunityCount: 2,
        opportunityAmount: 1300000,
      }),
    ]);
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      'https://crm.example.com/api/open/v1/analytics/partners/contribution?region=%E5%B1%B1%E4%B8%9C%E5%8C%BA&createdAfter=2026-06-01T00%3A00%3A00.000Z&createdBefore=2026-07-01T00%3A00%3A00.000Z',
    );
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: 'GET',
      headers: expect.objectContaining({
        Authorization: 'Bearer openapi_token_002',
      }),
    });
  });

  it('应读取服务商画像统计接口并透传技术服务商筛选参数', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          code: 0,
          message: 'ok',
          data: {
            accessToken: 'openapi_token_003',
            expiresIn: 7200,
            tokenType: 'Bearer',
            clientId: 'client_003',
            clientName: 'AI-agent-test',
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
        status: 200,
        ok: true,
        json: async () => ({
          code: 0,
          message: 'ok',
          data: {
            totalCount: 12,
            activeCount: 10,
            technicalServiceProviderCount: 3,
            byTechnicalServiceProvider: [
              { value: true, count: 3 },
              { value: false, count: 9 },
            ],
          },
          requestId: 'req_partner_profile_001',
        }),
      });

    global.fetch = fetchMock as typeof global.fetch;

    const configService = {
      getEffectiveRuntimeConfig: () => ({
        enabled: true,
        baseUrl: 'https://crm.example.com/api/open/v1',
        appKey: 'oak_test',
        appSecret: 'oas_test',
        timeoutMs: 12000,
        tokenCacheBufferSeconds: 60,
        source: 'env',
      }),
    } as Pick<LianruanCrmConnectionConfigService, 'getEffectiveRuntimeConfig'> as LianruanCrmConnectionConfigService;
    const client = new LianruanCrmOpenApiClient(
      configService,
      {
        logStep: jest.fn(),
        logWarn: jest.fn(),
      } as never,
    );

    const result = await client.getPartnerProfileAnalytics({
      region: '山东区',
      isTechnicalServiceProvider: true,
    });

    expect(result).toMatchObject({
      totalCount: 12,
      technicalServiceProviderCount: 3,
    });
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      'https://crm.example.com/api/open/v1/analytics/partners/profile?region=%E5%B1%B1%E4%B8%9C%E5%8C%BA&isTechnicalServiceProvider=true',
    );
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: 'GET',
      headers: expect.objectContaining({
        Authorization: 'Bearer openapi_token_003',
      }),
    });
  });

  it('远端返回 HTML 时应抛出中文格式异常，不暴露底层 JSON 解析错误', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          code: 0,
          message: 'ok',
          data: {
            accessToken: 'openapi_token_004',
            expiresIn: 7200,
            tokenType: 'Bearer',
            clientId: 'client_004',
            clientName: 'AI-agent-test',
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
        status: 200,
        ok: true,
        headers: {
          get: (name: string) => name.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : '',
        },
        text: async () => '<!DOCTYPE html><html><body>login</body></html>',
      });

    global.fetch = fetchMock as typeof global.fetch;

    const configService = {
      getEffectiveRuntimeConfig: () => ({
        enabled: true,
        baseUrl: 'https://crm.example.com/api/open/v1',
        appKey: 'oak_test',
        appSecret: 'oas_test',
        timeoutMs: 12000,
        tokenCacheBufferSeconds: 60,
        source: 'env',
      }),
    } as Pick<LianruanCrmConnectionConfigService, 'getEffectiveRuntimeConfig'> as LianruanCrmConnectionConfigService;
    const logger = {
      logStep: jest.fn(),
      logWarn: jest.fn(),
    };
    const client = new LianruanCrmOpenApiClient(
      configService,
      logger as never,
    );

    await expect(client.getCustomerLifecycleAnalytics()).rejects.toThrow(
      '联软标准 OpenAPI 返回格式异常：期望 JSON，实际返回 HTML。',
    );
    expect(logger.logWarn).toHaveBeenCalledWith(
      '联软标准 OpenAPI 返回格式异常。',
      expect.objectContaining({
        path: '/analytics/customers/lifecycle',
        bodyKind: 'HTML',
      }),
    );
  });

  it('负责人贡献统计不应把指标词误作为 ownerName 筛选下推', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({
          code: 0,
          message: 'ok',
          data: {
            accessToken: 'openapi_token_005',
            expiresIn: 7200,
            tokenType: 'Bearer',
            clientId: 'client_005',
            clientName: 'AI-agent-test',
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
        status: 200,
        ok: true,
        json: async () => ({
          code: 0,
          message: 'ok',
          data: [
            {
              ownerId: 'A031',
              ownerName: '王小红',
              opportunityCount: 3,
              opportunityAmount: 1800000,
            },
          ],
        }),
      });

    global.fetch = fetchMock as typeof global.fetch;

    const configService = {
      getEffectiveRuntimeConfig: () => ({
        enabled: true,
        baseUrl: 'https://crm.example.com/api/open/v1',
        appKey: 'oak_test',
        appSecret: 'oas_test',
        timeoutMs: 12000,
        tokenCacheBufferSeconds: 60,
        source: 'env',
      }),
    } as Pick<LianruanCrmConnectionConfigService, 'getEffectiveRuntimeConfig'> as LianruanCrmConnectionConfigService;
    const client = new LianruanCrmOpenApiClient(
      configService,
      {
        logStep: jest.fn(),
        logWarn: jest.fn(),
      } as never,
    );

    await client.listOwnerContributions({
      createdAfter: '2026-06-01T00:00:00.000Z',
      createdBefore: '2026-07-01T00:00:00.000Z',
      pageNo: 1,
      pageSize: 50,
    });

    const requestUrl = String(fetchMock.mock.calls[1][0]);
    expect(requestUrl).toContain('/analytics/owners/contribution?');
    expect(requestUrl).not.toContain('ownerName=');
    expect(requestUrl).not.toContain('%E5%95%86%E6%9C%BA%E9%87%91%E9%A2%9D');
  });
});

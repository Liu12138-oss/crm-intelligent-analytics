import { ForbiddenException } from '@nestjs/common';
import { QueryExecutionTimeoutError } from '../../../src/modules/analysis/analysis.errors';
import { WecomAuthService } from '../../../src/modules/wecom/wecom-auth.service';

describe('WecomAuthService', () => {
  it('会话缓存身份查询超时后，应提示稍后重试而不是无限等待', async () => {
    const service = new WecomAuthService(
      {
        getUserById: jest.fn(async () => {
          throw new QueryExecutionTimeoutError('身份查询超时');
        }),
        getUserByWecomSenderId: jest.fn(async () => {
          throw new QueryExecutionTimeoutError('身份查询超时');
        }),
      } as never,
      {
        getCurrent: jest.fn(() => ({
          enabledChannels: ['web-console', 'wecom-bot'],
        })),
      } as never,
      {
        buildDecision: jest.fn(() => ({
          allowed: true,
          channel: 'wecom-bot',
          state: 'ALLOWED',
          matchedRoleIds: [],
          visibleMenus: [],
          actionKeys: [],
          scopeSnapshot: {
            organizationIds: [],
            departmentIds: [],
            ownerIds: [],
            scopeSummary: 'mock',
          },
          contractPermissions: {
            uploadAllowed: false,
            crossViewAllowed: false,
            crossDownloadAllowed: false,
          },
        })),
      } as never,
      {} as never,
      { create: jest.fn() } as never,
    );

    await expect(
      service.resolveSenderFromSessionCache({
        senderId: 'WangLiang02',
        requesterId: '2224755',
      }),
    ).rejects.toThrow(
      new ForbiddenException('当前无法确认你的 CRM 身份，请稍后重试。'),
    );
  });

  it('企业微信实时身份映射查询超时后，应提示稍后重试', async () => {
    const service = new WecomAuthService(
      {
        getUserByWecomSenderId: jest.fn(async () => {
          throw new QueryExecutionTimeoutError('身份查询超时');
        }),
      } as never,
      {
        getCurrent: jest.fn(() => ({
          enabledChannels: ['web-console', 'wecom-bot'],
        })),
      } as never,
      {
        buildDecision: jest.fn(),
      } as never,
      {} as never,
      { create: jest.fn() } as never,
    );

    await expect(service.resolveSender('WangLiang02')).rejects.toThrow(
      new ForbiddenException('当前无法确认你的 CRM 身份，请稍后重试。'),
    );
  });

  it('企业微信旧映射不可用但标准 OpenAPI 可用时，应使用绑定用户作为联调身份兜底', async () => {
    const buildDecision = jest.fn((user) => ({
      allowed: true,
      channel: 'wecom-bot',
      state: 'ALLOWED',
      matchedRoleIds: user.roleIds,
      visibleMenus: [],
      actionKeys: ['wecom.analysis.use'],
      scopeSnapshot: {
        organizationIds: user.organizationIds,
        departmentIds: user.departmentIds,
        ownerIds: user.ownerIds,
        scopeSummary: '联软标准 OpenAPI 绑定用户',
      },
      contractPermissions: {
        uploadAllowed: false,
        crossViewAllowed: false,
        crossDownloadAllowed: false,
      },
    }));
    const service = new WecomAuthService(
      {
        getUserByWecomSenderId: jest.fn(async () => {
          throw new QueryExecutionTimeoutError('身份查询超时');
        }),
      } as never,
      {
        getCurrent: jest.fn(() => ({
          enabledChannels: ['web-console', 'wecom-bot'],
        })),
      } as never,
      {
        buildDecision,
      } as never,
      {
        getCrmStandardOpenApiConfig: jest.fn(() => ({
          enabled: true,
        })),
      } as never,
      { create: jest.fn() } as never,
      {
        isEnabled: jest.fn(() => true),
        getCurrentContext: jest.fn(async () => ({
          client: {
            id: 'client-001',
            name: '联调 Client',
            boundUserId: 'A030',
            status: 'ACTIVE',
            allowedResources: ['opportunities'],
            ipWhitelist: [],
          },
          user: {
            id: 'A030',
            username: 'openapi-user',
            name: '联调用户',
            role: '区域经理',
            region: '山东',
            bigRegion: '华北',
            status: 'ACTIVE',
          },
        })),
      } as never,
    );

    await expect(service.resolveSender('WangLiang02')).resolves.toMatchObject({
      id: 'A030',
      name: '联调用户',
      roleIds: ['role_region_manager'],
      channels: ['web-console', 'wecom-bot'],
      wecomSenderId: 'WangLiang02',
      identitySource: 'crm-api',
    });
    expect(buildDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'A030',
        identitySource: 'crm-api',
      }),
      'wecom-bot',
    );
  });

  it('当会话缓存中的 requesterId 已过期时，应优先使用当前 senderId 的实时映射结果', async () => {
    const mappedUser = {
      id: '2224753',
      name: '王亮2',
      roleIds: ['2621'],
      roleNames: ['普通用户'],
      organizationIds: ['10804'],
      departmentIds: [],
      ownerIds: [],
      isAdmin: false,
      exportAllowed: false,
      channels: ['web-console', 'wecom-bot'],
      identitySource: 'database',
    };
    const staleUser = {
      id: '2224755',
      name: '刘涛',
      roleIds: [],
      roleNames: [],
      organizationIds: ['10804'],
      departmentIds: [],
      ownerIds: [],
      isAdmin: false,
      exportAllowed: false,
      channels: ['web-console', 'wecom-bot'],
      identitySource: 'database',
    };
    const getUserByWecomSenderId = jest.fn().mockResolvedValue(mappedUser);
    const getUserById = jest.fn().mockResolvedValue(staleUser);
    const buildDecision = jest.fn((user) => ({
      allowed: user.id === '2224753',
      channel: 'wecom-bot',
      state: user.id === '2224753' ? 'ALLOWED' : 'ROLE_NOT_ENABLED',
      reason: user.id === '2224753' ? undefined : '当前用户无权使用企业微信问数能力。',
      matchedRoleIds: user.roleIds,
      visibleMenus: [],
      actionKeys: [],
      scopeSnapshot: {
        organizationIds: user.organizationIds,
        departmentIds: user.departmentIds,
        ownerIds: user.ownerIds,
        scopeSummary: 'mock',
      },
      contractPermissions: {
        uploadAllowed: false,
        crossViewAllowed: false,
        crossDownloadAllowed: false,
      },
    }));
    const service = new WecomAuthService(
      {
        getUserByWecomSenderId,
        getUserById,
      } as never,
      {
        getCurrent: jest.fn(() => ({
          enabledChannels: ['web-console', 'wecom-bot'],
        })),
      } as never,
      {
        buildDecision,
      } as never,
      {} as never,
      { create: jest.fn() } as never,
    );

    await expect(
      service.resolveSenderFromSessionCache({
        senderId: 'WangLiang02',
        requesterId: '2224755',
      }),
    ).resolves.toMatchObject({
      id: '2224753',
      roleIds: ['2621'],
    });
    expect(getUserByWecomSenderId).toHaveBeenCalledWith('WangLiang02');
    expect(buildDecision).toHaveBeenCalledWith(mappedUser, 'wecom-bot');
  });
});

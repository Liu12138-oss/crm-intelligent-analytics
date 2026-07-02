import { CrmReadonlyService } from '../../../src/database/crm-readonly/crm-readonly.service';
import { QueryExecutionTimeoutError } from '../../../src/modules/analysis/analysis.errors';
import { OrganizationScopeService } from '../../../src/modules/governance/organization-scope.service';
import { createDefaultAppStorageState } from '../../../src/shared/mock/sample-data';
import type { AppStorageState } from '../../../src/shared/types/domain';

function createCrmReadonlyService(): CrmReadonlyService {
  return new CrmReadonlyService(
    {} as never,
    {
      logStep: jest.fn(),
      logWarn: jest.fn(),
    } as never,
    {} as never,
  );
}

describe('CrmReadonlyService query timeout', () => {
  it('实时 CRM 用户缺少本地企业微信映射缓存时，仍应补齐 senderId 并解析下级范围', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const appStorageState: AppStorageState = {
      ...createDefaultAppStorageState(),
      crmWxUsers: [],
      crmWxUserMaps: [],
      wecomSyncedUsers: [
        {
          id: 'sync_wangzhi',
          wxUserid: 'wangzhi',
          originUserid: 'wangzhi',
          userName: '王志',
          organizationExternalId: '1',
          primaryDepartmentId: '469',
          departmentIds: ['469'],
          directLeaderUserids: [],
          rawPayload: { userid: 'wangzhi' },
          syncStatus: 'ACTIVE',
          lastSyncedAt: '2026-05-11T09:00:00.000Z',
        },
        {
          id: 'sync_director_a',
          wxUserid: 'director_a',
          originUserid: 'director_a',
          userName: '经营负责人A',
          organizationExternalId: '1',
          primaryDepartmentId: '578',
          departmentIds: ['578'],
          directLeaderUserids: ['wangzhi'],
          rawPayload: { userid: 'director_a', direct_leader: ['wangzhi'] },
          syncStatus: 'ACTIVE',
          lastSyncedAt: '2026-05-11T09:00:00.000Z',
        },
      ],
    };

    const service = new CrmReadonlyService(
      {} as never,
      {
        logStep: jest.fn(),
        logWarn: jest.fn(),
      } as never,
      { state: appStorageState } as never,
    );

    const queryMock = jest
      .fn<Promise<unknown>, [string, unknown[]?]>()
      .mockResolvedValueOnce([[
        {
          id: 2224755,
          name: '王志',
          organization_id: 10804,
          role_id: null,
          wecom_userid: 'wangzhi',
        },
      ]])
      .mockResolvedValueOnce([[{ id: 901, name: '产品经营高层' }]])
      .mockResolvedValueOnce([[{ department_id: 469 }]])
      .mockResolvedValueOnce([[
        {
          wx_user_id: 1001,
          wx_organization_id: 1,
          userid: 'wangzhi',
          origin_userid: 'wangzhi',
          name: '王志',
          mobile: '13688800909',
          tel: null,
          email: 'wangz@leagsoft.com',
          gender: 1,
          position: null,
          avatar: null,
          english_name: null,
          status: 1,
          extattr: null,
          department: JSON.stringify([469]),
          user_id: 2224755,
        },
        {
          wx_user_id: 1002,
          wx_organization_id: 1,
          userid: 'director_a',
          origin_userid: 'director_a',
          name: '经营负责人A',
          mobile: '13800138000',
          tel: null,
          email: 'director_a@leagsoft.com',
          gender: 1,
          position: null,
          avatar: null,
          english_name: null,
          status: 1,
          extattr: null,
          department: JSON.stringify([578]),
          user_id: 2224888,
        },
      ]]);

    const mockedService = service as unknown as {
      ensurePool: () => Promise<boolean>;
      pool?: { query: typeof queryMock };
    };
    mockedService.pool = {
      query: queryMock,
    };
    mockedService.ensurePool = jest.fn(async () => true);

    try {
      const user = await service.getUserById('2224755');

      expect(user).toMatchObject({
        id: '2224755',
        name: '王志',
        wecomSenderId: 'wangzhi',
      });

      const scope = new OrganizationScopeService({
        state: appStorageState,
      } as never).resolveScope(user!);

      expect(scope.ownerIds).toEqual(
        expect.arrayContaining(['2224755', '2224888']),
      );
      expect(scope.scopeSummary).toContain('团队');
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('真实查询超过 timeoutMs 时应返回执行超时错误', async () => {
    const service = createCrmReadonlyService();
    (service as unknown as { ensurePool: () => Promise<boolean> }).ensurePool =
      jest.fn(async () => true);
    (service as unknown as { pool: { query: () => Promise<unknown> } }).pool = {
      query: jest.fn(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve([[]]), 50);
          }),
      ),
    };

    await expect(
      service.executeQuery('SELECT 1', [], { timeoutMs: 1 }),
    ).rejects.toThrow(QueryExecutionTimeoutError);
  });

  it('阶段码标签映射应按 field_values.id 查询，而不是按 value 文本查询', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const service = createCrmReadonlyService();
    (service as unknown as { ensurePool: () => Promise<boolean> }).ensurePool =
      jest.fn(async () => true);
    const queryMock = jest.fn(async () => [[
      {
        id: 89057,
        name: null,
        value: '10%见面且对产品感兴趣',
      },
    ]]);
    (service as unknown as { pool: { query: typeof queryMock } }).pool = {
      query: queryMock,
    };

    try {
      const labels = await service.resolveFieldValueLabels({
        fieldName: 'stage',
        values: ['89057'],
        organizationIds: ['10804'],
        klassNameLike: '%Opportunity%',
      });

      const firstSql = (queryMock.mock.calls[0] as unknown as [string])[0];
      expect(firstSql).toContain('fv.id IN (?)');
      expect(labels).toEqual({
        '89057': '10%见面且对产品感兴趣',
      });
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('企业微信发送者身份查询超过受控超时后，应返回执行超时错误', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalTimeoutEnv = process.env.CRM_READONLY_IDENTITY_QUERY_TIMEOUT_MS;
    process.env.NODE_ENV = 'development';
    process.env.CRM_READONLY_IDENTITY_QUERY_TIMEOUT_MS = '1';

    const service = createCrmReadonlyService();
    const queryMock = jest.fn(
      () =>
        new Promise(() => {
          // 这里故意保持悬挂，用于验证身份查询必须受超时保护。
        }),
    );
    const mockedService = service as unknown as {
      ensurePool: () => Promise<boolean>;
      pool?: { query: typeof queryMock; end: () => Promise<void> };
    };
    mockedService.pool = {
      query: queryMock,
      end: jest.fn(async () => undefined),
    };
    mockedService.ensurePool = jest.fn(async () => {
      mockedService.pool = {
        query: queryMock,
        end: jest.fn(async () => undefined),
      };
      return true;
    });

    try {
      await expect(
        service.getUserByWecomSenderId('wx_timeout_user'),
      ).rejects.toThrow(QueryExecutionTimeoutError);
      expect(queryMock).toHaveBeenCalledTimes(2);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      process.env.CRM_READONLY_IDENTITY_QUERY_TIMEOUT_MS = originalTimeoutEnv;
    }
  });

  it('CRM 用户身份查询超过受控超时后，应返回执行超时错误', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalTimeoutEnv = process.env.CRM_READONLY_IDENTITY_QUERY_TIMEOUT_MS;
    process.env.NODE_ENV = 'development';
    process.env.CRM_READONLY_IDENTITY_QUERY_TIMEOUT_MS = '1';

    const service = createCrmReadonlyService();
    const queryMock = jest.fn(
      () =>
        new Promise(() => {
          // 这里故意保持悬挂，用于验证会话缓存身份解析不能无限等待。
        }),
    );
    const mockedService = service as unknown as {
      ensurePool: () => Promise<boolean>;
      pool?: { query: typeof queryMock; end: () => Promise<void> };
    };
    mockedService.pool = {
      query: queryMock,
      end: jest.fn(async () => undefined),
    };
    mockedService.ensurePool = jest.fn(async () => {
      mockedService.pool = {
        query: queryMock,
        end: jest.fn(async () => undefined),
      };
      return true;
    });

    try {
      await expect(service.getUserById('2224755')).rejects.toThrow(
        QueryExecutionTimeoutError,
      );
      expect(queryMock).toHaveBeenCalledTimes(2);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      process.env.CRM_READONLY_IDENTITY_QUERY_TIMEOUT_MS = originalTimeoutEnv;
    }
  });

  it('CRM 用户身份查询首次超时后应重建连接池并重试成功', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalTimeoutEnv = process.env.CRM_READONLY_IDENTITY_QUERY_TIMEOUT_MS;
    process.env.NODE_ENV = 'development';
    process.env.CRM_READONLY_IDENTITY_QUERY_TIMEOUT_MS = '1';

    const service = createCrmReadonlyService();
    const userRow = {
      id: 2224755,
      name: '王亮2',
      organization_id: 10804,
      role_id: null,
    };
    const roleRows = [{ id: 2619, name: '超级管理员' }];
    const departmentRows = [{ department_id: 5434 }];
    const queryMock = jest
      .fn<Promise<unknown>, [string, unknown[]?]>()
      .mockImplementationOnce(
        () =>
          new Promise(() => {
            // 首次身份查询故意悬挂，模拟线上偶发的连接池阻塞。
          }),
      )
      .mockResolvedValueOnce([[userRow]])
      .mockResolvedValueOnce([roleRows])
      .mockResolvedValueOnce([departmentRows]);

    const mockedService = service as unknown as {
      ensurePool: () => Promise<boolean>;
      pool?: { query: typeof queryMock; end: () => Promise<void> };
    };
    mockedService.pool = {
      query: queryMock,
      end: jest.fn(async () => undefined),
    };
    mockedService.ensurePool = jest.fn(async () => {
      mockedService.pool = {
        query: queryMock,
        end: jest.fn(async () => undefined),
      };
      return true;
    });

    try {
      await expect(service.getUserById('2224755')).resolves.toMatchObject({
        id: '2224755',
        name: '王亮2',
        roleNames: ['超级管理员'],
        departmentIds: ['5434'],
      });
      expect(queryMock).toHaveBeenCalledTimes(4);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      process.env.CRM_READONLY_IDENTITY_QUERY_TIMEOUT_MS = originalTimeoutEnv;
    }
  });
});

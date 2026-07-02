import { readFileSync } from 'node:fs';
import { CrmReadonlyService } from '../../src/database/crm-readonly/crm-readonly.service';
import type { CrmUser } from '../../src/shared/types/domain';

describe('CrmReadonlyService 治理元数据缓存', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  it('短时间重复读取角色选项时应复用缓存，避免重复查询 CRM 只读库', async () => {
    process.env.NODE_ENV = 'production';
    const service = new CrmReadonlyService(
      {} as never,
      { logStep: jest.fn(), logWarn: jest.fn() } as never,
      { state: {} } as never,
      {} as never,
    );
    const query = jest.fn(async () => [
      [
        {
          id: 'role_sales_director',
          name: '销售总监',
          organization_id: 'org_north',
        },
      ],
      [],
    ]);
    Object.assign(service as unknown as Record<string, unknown>, {
      poolInitialized: true,
      liveQueryEnabled: true,
      pool: { query },
    });
    const user: CrmUser = {
      id: 'user_sales_director',
      name: '销售总监',
      roleIds: ['role_sales_director'],
      roleNames: ['销售总监'],
      organizationIds: ['org_north'],
      departmentIds: ['dept_sales'],
      ownerIds: ['owner_sales_director'],
      isAdmin: false,
      exportAllowed: true,
      channels: ['web-console', 'wecom-bot'],
      identitySource: 'database',
    };

    const first = await service.listAccessGovernanceRoles(user);
    const second = await service.listAccessGovernanceRoles(user);

    expect(first).toEqual(second);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('CRM 只读库不可用时仍应把内置模板创建人解析为中文姓名', async () => {
    process.env.NODE_ENV = 'production';
    const service = new CrmReadonlyService(
      {} as never,
      { logStep: jest.fn(), logWarn: jest.fn() } as never,
      { state: {} } as never,
      {} as never,
    );
    (service as unknown as { ensurePool: () => Promise<boolean> }).ensurePool =
      jest.fn(async () => false);

    const displayNameMap = await service.listUserDisplayNamesByIdentifiers(
      ['user_admin'],
      { audit: false },
    );

    expect(displayNameMap.get('user_admin')).toBe('系统管理员');
  });

  it('CRM 分析数据源建连超时默认值应收敛为 8 秒，避免分析页长时间挂起', () => {
    const sourceText = readFileSync(
      'src/database/crm-readonly/crm-readonly.service.ts',
      'utf8',
    );

    expect(sourceText).toContain(
      "process.env.CRM_READONLY_DB_CONNECT_TIMEOUT_MS ?? '8000'",
    );
  });
});

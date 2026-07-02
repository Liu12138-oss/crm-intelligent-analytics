import { AccessDecisionService } from '../../../src/modules/governance/access-decision.service';
import { FEATURE_PERMISSION_CATALOG } from '../../../src/modules/governance/feature-permission-catalog';
import type {
  AccessPolicyRecord,
  CrmUser,
  RolePermissionRecord,
  ScopeSnapshot,
  WecomPilotPolicyRecord,
} from '../../../src/shared/types/domain';

describe('AccessDecisionService', () => {
  const policy: AccessPolicyRecord = {
    id: 'policy_current',
    enabledRoleIds: ['role_sales_director', 'role_admin'],
    exportRoleIds: ['role_admin'],
    enabledChannels: ['web-console', 'wecom-bot'],
    allowedDomains: ['opportunity-analysis'],
    allowedTables: ['opportunities'],
    allowedFields: {
      opportunities: ['id'],
    },
    maskedFields: {},
    exportRowLimit: 1000,
    exportDailyLimit: 3,
    maxOnlineSessions: 200,
    maxConcurrentQueries: 50,
    heartbeatIntervalSeconds: 30,
    idleTimeoutSeconds: 120,
    historyRetentionDays: 30,
    status: 'ACTIVE',
    updatedBy: 'system',
    updatedAt: '2026-04-22T00:00:00.000Z',
  };

  const pilotPolicy: WecomPilotPolicyRecord = {
    channel: 'wecom-bot',
    mode: 'FULL',
    allowUserIds: [],
    allowRoleIds: [],
    allowDepartmentIds: [],
    denyUserIds: [],
    updatedBy: 'system',
    updatedAt: '2026-04-22T00:00:00.000Z',
  };

  const scopeSnapshot: ScopeSnapshot = {
    organizationIds: ['org_all'],
    departmentIds: ['dept_all'],
    ownerIds: [],
    scopeSummary: '当前为管理员视角，可查看已授权的全组织结果。',
  };

  function createService(
    rolePermissions: RolePermissionRecord[] = [],
    options: {
      superAdminUserIds?: string[];
      superAdminRoleIds?: string[];
      policyOverride?: Partial<AccessPolicyRecord>;
      pilotPolicyOverride?: Partial<WecomPilotPolicyRecord>;
    } = {},
  ) {
    return new AccessDecisionService(
      {
        getCurrent: jest.fn(() => ({ ...policy, ...options.policyOverride })),
      } as never,
      {
        listAll: jest.fn(() => rolePermissions),
      } as never,
      {
        getCurrent: jest.fn(() => ({ ...pilotPolicy, ...options.pilotPolicyOverride })),
      } as never,
      {
        resolveScope: jest.fn(() => scopeSnapshot),
      } as never,
      {
        isSuperAdminSubject: jest.fn((user: CrmUser) =>
          (options.superAdminUserIds ?? []).includes(user.id) ||
          user.roleIds.some((roleId) => (options.superAdminRoleIds ?? []).includes(roleId)),
        ),
      } as never,
    );
  }

  it('真实数据库管理员角色未显式配置时，仍应回退为系统级治理能力', () => {
    const service = createService([]);
    const user: CrmUser = {
      id: '2224755',
      name: '王亮2',
      roleIds: ['2619'],
      roleNames: ['超级管理员'],
      organizationIds: ['10804'],
      departmentIds: ['5434'],
      ownerIds: [],
      isAdmin: true,
      exportAllowed: true,
      channels: ['web-console', 'wecom-bot'],
      identitySource: 'database',
    };

    const decision = service.buildDecision(user, 'web-console');

    expect(decision.allowed).toBe(true);
    expect(decision.visibleMenus).toEqual(
      expect.arrayContaining([
        'analysis-workbench',
        'contract-review',
        'connection-policy',
        'permission-center',
        'audit-center',
        'ai-model-governance',
      ]),
    );
    expect(decision.actionKeys).toEqual(
      expect.arrayContaining([
        'analysis.use',
        'analysis.export',
        'wecom.analysis.use',
        'wecom.customer.create',
        'wecom.opportunity.create',
        'wecom.followup.writeback',
        'wecom.daily_report.preview',
        'governance.policy.manage',
        'audit.view',
        'audit.sql.view',
        'audit.sql.view_sensitive',
        'ai_profile.manage',
      ]),
    );
    expect(decision.channel).toBe('web-console');
  });

  it('首次部署默认管理员角色应具备企业微信入口资格', () => {
    const service = createService([]);
    const user: CrmUser = {
      id: '2224755',
      name: '王亮2',
      roleIds: ['2619'],
      roleNames: ['超级管理员'],
      organizationIds: ['10804'],
      departmentIds: ['5434'],
      ownerIds: [],
      isAdmin: true,
      exportAllowed: true,
      channels: ['web-console', 'wecom-bot'],
      identitySource: 'database',
    };

    const decision = service.buildDecision(user, 'wecom-bot');

    expect(decision.allowed).toBe(true);
    expect(decision.state).toBe('ALLOWED');
    expect(decision.actionKeys).toEqual(
      expect.arrayContaining([
        'wecom.analysis.use',
        'wecom.customer.create',
        'wecom.opportunity.create',
        'wecom.followup.writeback',
        'wecom.daily_report.preview',
      ]),
    );
  });

  it('应用超级管理员应自动获得权限目录中的全部菜单和动作', () => {
    const service = createService([], {
      superAdminUserIds: ['user_ceo'],
    });
    const user: CrmUser = {
      id: 'user_ceo',
      name: '总经理',
      roleIds: ['role_common'],
      roleNames: ['普通角色'],
      organizationIds: ['10804'],
      departmentIds: ['5434'],
      ownerIds: ['2223349'],
      isAdmin: false,
      exportAllowed: false,
      channels: ['web-console', 'wecom-bot'],
      identitySource: 'database',
    };

    const decision = service.buildDecision(user, 'web-console');
    const expectedMenus = FEATURE_PERMISSION_CATALOG
      .filter((item) => item.kind === 'menu')
      .map((item) => item.key);
    const expectedActions = FEATURE_PERMISSION_CATALOG
      .filter((item) => item.kind === 'action')
      .map((item) => item.key);

    expect(decision.allowed).toBe(true);
    expect(decision.visibleMenus).toEqual(expect.arrayContaining(expectedMenus));
    expect(decision.actionKeys).toEqual(expect.arrayContaining(expectedActions));
    expect(decision.contractPermissions).toEqual({
      uploadAllowed: true,
      crossViewAllowed: true,
      crossDownloadAllowed: true,
    });
  });

  it('角色级应用超级管理员不应绕过全局通道关闭', () => {
    const service = createService([], {
      superAdminRoleIds: ['role_boss'],
      policyOverride: {
        enabledChannels: ['web-console'],
      },
    });
    const user: CrmUser = {
      id: 'user_boss',
      name: '经营负责人',
      roleIds: ['role_boss'],
      roleNames: ['经营负责人'],
      organizationIds: ['10804'],
      departmentIds: ['5434'],
      ownerIds: [],
      isAdmin: false,
      exportAllowed: false,
      channels: ['web-console', 'wecom-bot'],
      identitySource: 'database',
    };

    const decision = service.buildDecision(user, 'wecom-bot');

    expect(decision.allowed).toBe(false);
    expect(decision.state).toBe('CHANNEL_DISABLED');
    expect(decision.actionKeys).toEqual(
      expect.arrayContaining(['wecom.analysis.use', 'governance.policy.manage']),
    );
  });
});

import { GovernanceService } from '../../../src/modules/governance/governance.service';
import { DEFAULT_ACCESS_POLICY } from '../../../src/shared/mock/sample-data';
import type { CrmUser } from '../../../src/shared/types/domain';

describe('治理变更缓存失效', () => {
  it('更新访问治理策略后应同时失效能力快照和身份短缓存', () => {
    const adminUser: CrmUser = {
      id: 'user_admin',
      name: '管理员',
      roleIds: ['role_admin'],
      roleNames: ['系统管理员'],
      organizationIds: [],
      departmentIds: [],
      ownerIds: [],
      isAdmin: true,
      exportAllowed: true,
      channels: ['web-console'],
    };
    const savedPolicies = [{ ...DEFAULT_ACCESS_POLICY }];
    const sessionCapabilitiesService = {
      invalidateAllSnapshots: jest.fn(),
    };
    const crmAuthService = {
      invalidateResolvedSessionUserCache: jest.fn(),
    };
    const service = new GovernanceService(
      {
        getCurrent: jest.fn(() => savedPolicies[0]),
        save: jest.fn((policy) => {
          savedPolicies[0] = policy;
          return policy;
        }),
      } as never,
      {
        ensureAction: jest.fn(),
      } as never,
      sessionCapabilitiesService as never,
      crmAuthService as never,
    );

    service.updateCurrent(adminUser, {
      enabledRoleIds: DEFAULT_ACCESS_POLICY.enabledRoleIds,
      exportRoleIds: DEFAULT_ACCESS_POLICY.exportRoleIds,
      enabledChannels: DEFAULT_ACCESS_POLICY.enabledChannels,
      allowedDomains: DEFAULT_ACCESS_POLICY.allowedDomains,
      allowedTables: DEFAULT_ACCESS_POLICY.allowedTables,
      allowedFields: DEFAULT_ACCESS_POLICY.allowedFields,
      maskedFields: DEFAULT_ACCESS_POLICY.maskedFields,
      exportRowLimit: DEFAULT_ACCESS_POLICY.exportRowLimit,
      exportDailyLimit: DEFAULT_ACCESS_POLICY.exportDailyLimit,
      maxOnlineSessions: DEFAULT_ACCESS_POLICY.maxOnlineSessions,
      maxConcurrentQueries: DEFAULT_ACCESS_POLICY.maxConcurrentQueries,
      heartbeatIntervalSeconds: DEFAULT_ACCESS_POLICY.heartbeatIntervalSeconds,
      idleTimeoutSeconds: DEFAULT_ACCESS_POLICY.idleTimeoutSeconds,
      historyRetentionDays: DEFAULT_ACCESS_POLICY.historyRetentionDays,
    });

    expect(sessionCapabilitiesService.invalidateAllSnapshots).toHaveBeenCalledTimes(1);
    expect(crmAuthService.invalidateResolvedSessionUserCache).toHaveBeenCalledTimes(1);
  });
});

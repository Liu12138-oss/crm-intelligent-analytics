import { ForbiddenException } from '@nestjs/common';
import { LianruanCrmDiagnosticsService } from '../../../src/modules/crm-standard-api/lianruan-crm-diagnostics.service';
import type { CrmUser } from '../../../src/shared/types/domain';

const adminUser: CrmUser = {
  id: 'user_admin',
  name: '治理管理员',
  roleIds: ['role_admin'],
  roleNames: ['治理管理员'],
  organizationIds: ['org_east'],
  departmentIds: ['dept_governance'],
  ownerIds: [],
  isAdmin: true,
  exportAllowed: true,
  channels: ['web-console'],
};

/**
 * 构造联调诊断服务测试夹具。
 *
 * 参数说明：
 * - `denyAccess`：是否模拟权限阻断。
 * - `enabled`：是否模拟标准 OpenAPI 已启用。
 * 返回值说明：返回待测服务与关键依赖 mock。
 * 调用注意事项：该夹具只覆盖联调诊断旁路，不触碰现有业务主链。
 */
function createServiceFixture(options?: {
  denyAccess?: boolean;
  enabled?: boolean;
}) {
  const lianruanCrmConnectionConfigService = {
    getEffectiveRuntimeConfig: jest.fn(() => ({
      enabled: options?.enabled ?? true,
      baseUrl: 'http://10.18.16.114:3000/api/open/v1',
      appKey: 'app_key_mock',
      appSecret: 'app_secret_mock',
      timeoutMs: 12000,
      tokenCacheBufferSeconds: 60,
      source: 'env',
    })),
  };
  const permissionEnforcementService = {
    ensureAction: jest.fn(() => {
      if (options?.denyAccess) {
        throw new ForbiddenException('当前用户无权访问联软 CRM 联调诊断能力。');
      }
    }),
  };
  const lianruanCrmOpenApiAdapterService = {
    isEnabled: jest.fn(() => options?.enabled ?? true),
    getBootstrapSnapshot: jest.fn(async () => ({
      context: {
        client: {
          id: 'client_sit_superadmin',
          name: 'AI-agent-superadmin-sit',
          boundUserId: 'A030',
          status: 'active',
          allowedResources: ['users', 'partners', 'opportunities'],
          ipWhitelist: ['10.18.16.114'],
        },
        user: {
          id: 'A030',
          username: 'liulonghai',
          name: '刘龙海',
          role: 'superadmin',
        },
      },
      permissionScope: {
        user: {
          id: 'A030',
          name: '刘龙海',
          role: 'superadmin',
        },
        scopeType: 'all',
        regions: [],
        partnerIds: [],
        userIds: [],
      },
      dictionaries: {
        roles: [{ value: 'superadmin', label: '超管' }],
        partnerLevels: [{ value: 'L1', label: '一级渠道' }],
        partnerTypes: [{ value: 'technical', label: '技术服务商' }],
        partnerCooperationLevels: [{ value: 'gold', label: '金牌' }],
        registrationStatuses: [{ value: 'created', label: '已创建' }],
        opportunityStages: [{ value: 'tracking', label: '跟进中' }],
        quoteStatuses: [{ value: 'quoted', label: '已报价' }],
        technicalServiceProviderTypes: [
          { value: 'true', label: '技术服务商' },
          { value: 'false', label: '非技术服务商' },
        ],
        regions: [{ value: '山东区', label: '山东区' }],
        bigRegions: [{ value: '华东大区', label: '华东大区' }],
      },
    })),
  };
  const lianruanCrmQueryAdapterService = {
    listByResource: jest.fn(async (resource: string) => {
      const sampleByResource: Record<string, Record<string, unknown>> = {
        users: {
          id: 'U001',
          username: 'tester',
          name: '测试用户',
          role: 'superadmin',
          region: '山东区',
          status: 'active',
        },
        partners: {
          id: 'P001',
          name: '山东联软服务商',
          partnerLevel: 'L1',
          region: '山东区',
          status: 'active',
          createdAt: '2026-01-10T00:00:00.000Z',
        },
        registrations: {
          id: 'R001',
          customer: '山东客户',
          status: 'created',
          createdBy: 'U001',
          assignedStaffId: 'U001',
          partnerId: 'P001',
          region: '山东区',
          createdAt: '2026-01-11T00:00:00.000Z',
        },
        opportunities: {
          id: 'O001',
          name: '山东商机',
          customer: '山东客户',
          stage: 'tracking',
          amount: 100000,
          ownerId: 'U001',
          partnerId: 'P001',
          region: '山东区',
          createdAt: '2026-01-12T00:00:00.000Z',
        },
        quotes: {
          id: 'Q001',
          customerName: '山东客户',
          oppId: 'O001',
          partnerId: 'P001',
          amount: 80000,
          status: 'quoted',
          createdAt: '2026-01-13T00:00:00.000Z',
        },
        orders: {
          id: 'D001',
          customerName: '山东客户',
          partnerId: 'P001',
          amount: 70000,
          status: 'paid',
          createdAt: '2026-01-14T00:00:00.000Z',
        },
      };

      return {
        items: sampleByResource[resource] ? [sampleByResource[resource]] : [],
        pageNo: 1,
        pageSize: 10,
        total: sampleByResource[resource] ? 1 : 0,
        requestId: `req_${resource}_001`,
      };
    }),
    getDetailByResource: jest.fn(async () => ({
      id: 'U001',
      name: '测试用户',
    })),
  };

  const service = new LianruanCrmDiagnosticsService(
    lianruanCrmConnectionConfigService as never,
    permissionEnforcementService as never,
    lianruanCrmOpenApiAdapterService as never,
    lianruanCrmQueryAdapterService as never,
    {
      buildDiagnostics: jest.fn((samplesByResource: Record<string, unknown>) => ({
        resources: Object.keys(samplesByResource).map((resource) => ({
          resource,
          resourceLabel: resource,
          sampleCount: 1,
          observedFields: ['id', 'name'],
          totalExpectedFieldCount: 2,
          availableFieldCount: 2,
          missingP0Fields: [],
          missingP1Fields: [],
          completeness: 1,
          fields: [],
        })),
        overall: {
          totalExpectedFieldCount: 12,
          availableFieldCount: 10,
          missingP0Fields: [
            {
              resource: 'partners',
              field: 'partnerType',
              label: '服务商类型',
            },
          ],
          completeness: 0.83,
        },
      })),
    } as never,
  );

  return {
    service,
    permissionEnforcementService,
    lianruanCrmOpenApiAdapterService,
    lianruanCrmQueryAdapterService,
  };
}

describe('LianruanCrmDiagnosticsService', () => {
  it('应返回联调诊断摘要，并计算字典完整度缺口', async () => {
    const { service, lianruanCrmOpenApiAdapterService } = createServiceFixture();

    const result = await service.getDiagnostics(adminUser);

    expect(lianruanCrmOpenApiAdapterService.getBootstrapSnapshot).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      enabled: true,
      context: {
        clientId: 'client_sit_superadmin',
        boundUserId: 'A030',
        boundUserName: '刘龙海',
      },
      permissionScope: {
        scopeType: 'all',
      },
      permissionView: {
        crmUserId: 'A030',
        role: 'superadmin',
        clientMode: 'bound-client',
        boundClientUserId: 'A030',
        resources: {
          partners: {
            status: 'AVAILABLE',
            sampleCount: 1,
          },
        },
      },
      dictionaries: {
        missingKeys: [
          'customerCategories',
          'customerTypes',
          'orderStatuses',
          'productStatuses',
          'priceTypes',
          'publishStatuses',
          'approvalTypes',
          'approvalStatuses',
          'notificationTypes',
          'channelVisitTypes',
          'channelVisitStatuses',
          'workloadProductTypes',
          'workloadDeliveryTags',
          'auditModules',
          'auditActions',
          'auditResults',
        ],
        completeness: 0.36,
      },
      fieldCapabilities: {
        overall: {
          missingP0Fields: [
            {
              resource: 'partners',
              field: 'partnerType',
              label: '服务商类型',
            },
          ],
        },
      },
      supportedResources: [
        'users',
        'customers',
        'partners',
        'registrations',
        'opportunities',
        'quotes',
        'orders',
      ],
    });
  });

  it('未启用时应返回配置缺失提示，且不请求远端快照', async () => {
    const { service, lianruanCrmOpenApiAdapterService } = createServiceFixture({
      enabled: false,
    });

    const result = await service.getDiagnostics(adminUser);

    expect(result).toMatchObject({
      enabled: false,
      message: '当前未启用联软标准 OpenAPI，请先补齐联调环境参数。',
      config: {
        baseUrlPresent: true,
        appKeyPresent: true,
        appSecretPresent: true,
      },
    });
    expect(lianruanCrmOpenApiAdapterService.getBootstrapSnapshot).not.toHaveBeenCalled();
  });

  it('应通过统一资源分发查询列表', async () => {
    const { service, lianruanCrmQueryAdapterService } = createServiceFixture();

    const result = await service.listResource(adminUser, 'users', {
      pageNo: 1,
      pageSize: 10,
      keyword: '刘',
    });

    expect(lianruanCrmQueryAdapterService.listByResource).toHaveBeenCalledWith('users', {
      pageNo: 1,
      pageSize: 10,
      keyword: '刘',
    });
    expect(result).toMatchObject({
      total: 1,
      items: [{ id: 'U001', name: '测试用户' }],
    });
  });

  it('无治理权限的用户不能访问联调诊断入口', async () => {
    const { service } = createServiceFixture({ denyAccess: true });

    await expect(service.getDiagnostics(adminUser)).rejects.toThrow(ForbiddenException);
  });
});

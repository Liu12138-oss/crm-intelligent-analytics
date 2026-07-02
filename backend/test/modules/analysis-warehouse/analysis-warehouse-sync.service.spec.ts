import { AnalysisWarehouseRepository } from '../../../src/modules/analysis-warehouse/analysis-warehouse.repository';
import { AnalysisWarehouseSyncService } from '../../../src/modules/analysis-warehouse/analysis-warehouse-sync.service';
import type {
  AppStorageState,
  CrmUser,
} from '../../../src/shared/types/domain';

const adminUser: CrmUser = {
  id: 'user_admin',
  name: '治理管理员',
  roleIds: ['role_admin'],
  roleNames: ['治理管理员'],
  organizationIds: ['org_main'],
  departmentIds: ['dept_governance'],
  ownerIds: [],
  isAdmin: true,
  exportAllowed: true,
  channels: ['web-console'],
};

/**
 * 构造数据仓库同步服务测试夹具。
 *
 * 参数说明：无。
 * 返回值说明：返回待测服务、运行态状态和关键 mock。
 * 调用注意事项：夹具只提供本测试需要的 AppStorage 字段，避免引入完整样例数据。
 */
function createFixture(options: { sqliteSnapshotImporterService?: unknown } = {}) {
  const state = {
    analysisWarehouseSyncRuns: [],
    analysisWarehouseRawRecords: [],
    analysisWarehouseSyncCheckpoints: [],
  } as unknown as AppStorageState;
  const appStorageService = {
    state,
    persist: jest.fn(),
  };
  const repository = new AnalysisWarehouseRepository(appStorageService as never);
  const permissionEnforcementService = {
    ensureAction: jest.fn(),
  };
  const lianruanCrmConnectionConfigService = {
    getEffectiveRuntimeConfig: jest.fn(() => ({
      enabled: true,
      baseUrl: 'http://10.18.16.114:3000/api/open/v1',
      appKey: 'mock_app_key',
      appSecret: 'mock_app_secret',
      timeoutMs: 12000,
      tokenCacheBufferSeconds: 60,
      source: 'runtime',
    })),
  };
  const lianruanCrmOpenApiAdapterService = {
    isEnabled: jest.fn(() => true),
    listResource: jest.fn(async () => ({
      items: [
        {
          id: 'C001',
          name: '山东客户',
          phone: '13800000000',
          email: 'customer@example.com',
          appSecret: 'should-not-store',
          updatedAt: '2026-06-01T00:00:00.000Z',
        },
      ],
      pageNo: 1,
      pageSize: 10,
      total: 1,
      requestId: 'req_customers_001',
    })),
    getBootstrapSnapshot: jest.fn(async () => ({
      context: {
        client: {
          id: 'client_001',
          name: '联调客户端',
          boundUserId: 'user_admin',
          status: 'active',
          allowedResources: ['customers'],
          ipWhitelist: [],
        },
        user: {
          id: 'user_admin',
          username: 'admin',
          name: '治理管理员',
          role: 'superadmin',
        },
      },
      permissionScope: {
        user: {
          id: 'user_admin',
          name: '治理管理员',
          role: 'superadmin',
        },
        scopeType: 'all',
        regions: [],
        partnerIds: [],
        userIds: [],
      },
      dictionaries: {
        roles: [{ value: 'superadmin', label: '超管' }],
      },
    })),
    getRolePermissions: jest.fn(async () => ({
      roles: [
        {
          role: 'superadmin',
          roleName: '超管',
          scopeType: 'all',
        },
      ],
    })),
  };

  const service = new AnalysisWarehouseSyncService(
    repository,
    permissionEnforcementService as never,
    lianruanCrmConnectionConfigService as never,
    lianruanCrmOpenApiAdapterService as never,
    options.sqliteSnapshotImporterService as never,
  );

  return {
    service,
    state,
    appStorageService,
    permissionEnforcementService,
    lianruanCrmOpenApiAdapterService,
  };
}

describe('AnalysisWarehouseSyncService', () => {
  const originalSqliteEnabled = process.env.LIANRUAN_CRM_SQLITE_SNAPSHOT_ENABLED;
  const originalSqliteDir = process.env.LIANRUAN_CRM_SQLITE_SNAPSHOT_DIR;

  afterEach(() => {
    if (originalSqliteEnabled === undefined) {
      delete process.env.LIANRUAN_CRM_SQLITE_SNAPSHOT_ENABLED;
    } else {
      process.env.LIANRUAN_CRM_SQLITE_SNAPSHOT_ENABLED = originalSqliteEnabled;
    }

    if (originalSqliteDir === undefined) {
      delete process.env.LIANRUAN_CRM_SQLITE_SNAPSHOT_DIR;
    } else {
      process.env.LIANRUAN_CRM_SQLITE_SNAPSHOT_DIR = originalSqliteDir;
    }
  });

  it('应从联软标准 OpenAPI 同步资源快照并脱敏敏感字段', async () => {
    const { service, state, lianruanCrmOpenApiAdapterService } = createFixture();

    const run = await service.runSync(adminUser, {
      sourceType: 'OPENAPI',
      resources: ['customers'],
      pageSize: 10,
      maxPages: 1,
    });

    expect(lianruanCrmOpenApiAdapterService.listResource).toHaveBeenCalledWith(
      'customers',
      {
        pageNo: 1,
        pageSize: 10,
        sortBy: 'updatedAt',
        sortOrder: 'asc',
      },
    );
    expect(run).toMatchObject({
      sourceType: 'OPENAPI',
      status: 'SUCCEEDED',
      resourceResults: [
        {
          resource: 'customers',
          status: 'SUCCEEDED',
          fetchedCount: 1,
          storedCount: 1,
        },
      ],
    });
    expect(state.analysisWarehouseRawRecords).toHaveLength(1);
    expect(state.analysisWarehouseRawRecords[0].payload).toMatchObject({
      id: 'C001',
      name: '山东客户',
      phone: '[已脱敏]',
      email: '[已脱敏]',
      appSecret: '[已脱敏]',
    });
    expect(state.analysisWarehouseSyncCheckpoints).toHaveLength(1);
    expect(state.analysisWarehouseSyncCheckpoints[0].cursor).toBe(
      '2026-06-01T00:00:00.000Z',
    );
  });

  it('增量同步应复用检查点游标并按联软推荐参数排序', async () => {
    const { service, state, lianruanCrmOpenApiAdapterService } = createFixture();
    state.analysisWarehouseSyncCheckpoints.push({
      id: 'warehouse_checkpoint_OPENAPI_customers',
      sourceType: 'OPENAPI',
      resource: 'customers',
      lastRunId: 'previous_run',
      lastSyncedAt: '2026-06-01T00:00:00.000Z',
      cursor: '2026-06-01T08:30:00.000Z',
      observedTotal: 1,
    });

    await service.runSync(adminUser, {
      sourceType: 'OPENAPI',
      resources: ['customers'],
      maxPages: 1,
    });

    expect(lianruanCrmOpenApiAdapterService.listResource).toHaveBeenCalledWith(
      'customers',
      {
        pageNo: 1,
        pageSize: 200,
        sortBy: 'updatedAt',
        sortOrder: 'asc',
        updatedAfter: '2026-06-01T08:30:00.000Z',
      },
    );
  });

  it('应同步联软角色权限矩阵元数据', async () => {
    const { service, state, lianruanCrmOpenApiAdapterService } = createFixture();

    const run = await service.runSync(adminUser, {
      sourceType: 'OPENAPI',
      resources: ['meta/role-permissions'],
    });

    expect(lianruanCrmOpenApiAdapterService.getRolePermissions).toHaveBeenCalledTimes(1);
    expect(run.resourceResults[0]).toMatchObject({
      resource: 'rolePermissions',
      status: 'SUCCEEDED',
      fetchedCount: 1,
      storedCount: 1,
    });
    expect(state.analysisWarehouseRawRecords[0].resource).toBe('rolePermissions');
    expect(state.analysisWarehouseRawRecords[0].payload).toMatchObject({
      roles: [
        {
          role: 'superadmin',
          roleName: '超管',
          scopeType: 'all',
        },
      ],
    });
  });

  it('dry-run 模式只验证可拉取数据，不写入快照和检查点', async () => {
    const { service, state } = createFixture();

    const run = await service.runSync(adminUser, {
      sourceType: 'OPENAPI',
      resources: ['customers'],
      dryRun: true,
    });

    expect(run.resourceResults[0]).toMatchObject({
      fetchedCount: 1,
      storedCount: 0,
    });
    expect(state.analysisWarehouseRawRecords).toHaveLength(0);
    expect(state.analysisWarehouseSyncCheckpoints).toHaveLength(0);
  });

  it('SQLite 快照来源未启用时应返回跳过状态，不误读生产库文件', async () => {
    const { service, lianruanCrmOpenApiAdapterService } = createFixture();

    const run = await service.runSync(adminUser, {
      sourceType: 'SQLITE_SNAPSHOT',
      resources: ['customers'],
    });

    expect(run).toMatchObject({
      sourceType: 'SQLITE_SNAPSHOT',
      status: 'SKIPPED',
      resourceResults: [
        {
          resource: 'customers',
          status: 'SKIPPED',
          fetchedCount: 0,
          storedCount: 0,
        },
      ],
    });
    expect(lianruanCrmOpenApiAdapterService.listResource).not.toHaveBeenCalled();
  });

  it('SQLite 快照来源启用时应导入快照资源并复用 ODS 脱敏写入链路', async () => {
    process.env.LIANRUAN_CRM_SQLITE_SNAPSHOT_ENABLED = 'true';
    process.env.LIANRUAN_CRM_SQLITE_SNAPSHOT_DIR = 'D:\\sqlite-snapshots';
    const sqliteSnapshotImporterService = {
      isConfigured: jest.fn(() => true),
      getStatus: jest.fn(() => ({
        enabled: true,
        snapshotDirConfigured: true,
        statusLabel: 'SQLite 只读快照',
      })),
      importResource: jest.fn(async () => ({
        resource: 'customers',
        rows: [
          {
            sourceObjectId: 'C_SQLITE_001',
            payload: {
              customer_id: 'C_SQLITE_001',
              name: 'SQLite 客户',
              phone: '13900000000',
              updated_at: '2026-06-11T08:00:00.000Z',
            },
          },
        ],
        tableName: 'crm_customers',
        snapshotFile: 'lianruan-crm-20260611.sqlite',
        latestUpdatedAt: '2026-06-11T08:00:00.000Z',
        total: 1,
      })),
    };
    const { service, state, lianruanCrmOpenApiAdapterService } = createFixture({
      sqliteSnapshotImporterService,
    });

    const run = await service.runSync(adminUser, {
      sourceType: 'SQLITE_SNAPSHOT',
      resources: ['customers', 'rolePermissions'],
      pageSize: 10,
      maxPages: 1,
    });

    expect(sqliteSnapshotImporterService.importResource).toHaveBeenCalledWith({
      resource: 'customers',
      mode: 'INCREMENTAL',
      pageSize: 10,
      maxPages: 1,
      checkpointCursor: undefined,
    });
    expect(lianruanCrmOpenApiAdapterService.listResource).not.toHaveBeenCalled();
    expect(run).toMatchObject({
      sourceType: 'SQLITE_SNAPSHOT',
      status: 'SUCCEEDED',
      resourceResults: [
        {
          resource: 'customers',
          status: 'SUCCEEDED',
          fetchedCount: 1,
          storedCount: 1,
          requestId: 'sqlite:lianruan-crm-20260611.sqlite:crm_customers',
        },
        {
          resource: 'rolePermissions',
          status: 'SKIPPED',
          fetchedCount: 0,
          storedCount: 0,
        },
      ],
    });
    expect(state.analysisWarehouseRawRecords).toHaveLength(1);
    expect(state.analysisWarehouseRawRecords[0]).toMatchObject({
      sourceType: 'SQLITE_SNAPSHOT',
      resource: 'customers',
      sourceObjectId: 'C_SQLITE_001',
      payload: {
        customer_id: 'C_SQLITE_001',
        name: 'SQLite 客户',
        phone: '[已脱敏]',
      },
    });
    expect(state.analysisWarehouseSyncCheckpoints[0]).toMatchObject({
      sourceType: 'SQLITE_SNAPSHOT',
      resource: 'customers',
      cursor: '2026-06-11T08:00:00.000Z',
      observedTotal: 1,
    });
  });
});

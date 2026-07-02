import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { AppStorageService } from '../../src/database/app-storage/app-storage.service';
import { DEFAULT_QUERY_TEMPLATES } from '../../src/shared/mock/sample-data';

describe('AppStorageService', () => {
  function createRuntimeConfig(repoRoot: string) {
    return {
      getRepoRoot: jest.fn().mockReturnValue(repoRoot),
    } as never;
  }

  function createWecomSessionRecord() {
    return {
      id: 'session_cross_process_reload',
      channel: 'wecom-bot' as const,
      externalConversationId: 'WangLiang02',
      senderId: 'WangLiang02',
      requesterId: 'user_admin',
      requesterRoleIds: ['role_admin'],
      contextStatus: 'IDLE' as const,
      lastMessageAt: '2026-05-09T09:00:00.000Z',
      pendingSequence: 0,
      createdAt: '2026-05-09T09:00:00.000Z',
      updatedAt: '2026-05-09T09:00:00.000Z',
    };
  }

  it('另一实例已落盘新权限后，当前实例再次读取时应同步最新快照', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'crm-app-storage-'));
    const originalNodeEnv = process.env.NODE_ENV;

    try {
      process.env.NODE_ENV = 'development';
      const runtimeConfig = createRuntimeConfig(repoRoot);
      const writerStorage = new AppStorageService(runtimeConfig);
      const readerStorage = new AppStorageService(runtimeConfig);
      const updatedReason = '跨进程更新后的企微权限说明';

      const writerRole = writerStorage.state.rolePermissions.find(
        (item) => item.roleId === 'role_admin',
      );
      expect(writerRole).toBeDefined();

      if (!writerRole) {
        throw new Error('未找到默认管理员角色权限。');
      }

      writerRole.changeReason = updatedReason;
      writerStorage.persist();

      expect(
        readerStorage.state.rolePermissions.find((item) => item.roleId === 'role_admin')
          ?.changeReason,
      ).toBe(updatedReason);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('旧实例保存其它运行态数据时，不应覆盖另一实例刚落盘的权限更新', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'crm-app-storage-'));
    const originalNodeEnv = process.env.NODE_ENV;

    try {
      process.env.NODE_ENV = 'development';
      const runtimeConfig = createRuntimeConfig(repoRoot);
      const writerStorage = new AppStorageService(runtimeConfig);
      const staleStorage = new AppStorageService(runtimeConfig);
      const updatedReason = '新的企业微信入口资格已生效';

      const writerRole = writerStorage.state.rolePermissions.find(
        (item) => item.roleId === 'role_admin',
      );
      expect(writerRole).toBeDefined();

      if (!writerRole) {
        throw new Error('未找到默认管理员角色权限。');
      }

      writerRole.changeReason = updatedReason;
      writerStorage.persist();

      staleStorage.state.querySessions.unshift(createWecomSessionRecord());
      staleStorage.persist();

      const reloadedStorage = new AppStorageService(runtimeConfig);
      expect(
        reloadedStorage.state.rolePermissions.find((item) => item.roleId === 'role_admin')
          ?.changeReason,
      ).toBe(updatedReason);
      expect(reloadedStorage.state.querySessions[0]?.id).toBe(
        'session_cross_process_reload',
      );
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('持久化文件仍是旧模板列表时，启动后应自动补齐公司 2026 内置模板', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'crm-app-storage-'));
    const runtimeDir = join(repoRoot, '.runtime');
    const storageFilePath = join(runtimeDir, 'app-storage.json');
    const originalNodeEnv = process.env.NODE_ENV;

    try {
      process.env.NODE_ENV = 'development';
      mkdirSync(runtimeDir, { recursive: true });
      writeFileSync(
        storageFilePath,
        JSON.stringify(
          {
            queryTemplates: [
              {
                id: 'tpl_custom_existing',
                name: '已有自定义模板',
                description: '模拟线上遗留模板。',
                defaultQuestionText: '已有自定义模板',
                defaultFilters: {
                  timeRange: '本季度',
                },
                defaultViewType: 'DETAIL_TABLE',
                visibleRoleIds: ['role_admin'],
                displayOrder: 99,
                clickCount7d: 1,
                hitRatePercent: 100,
                optimizationStatus: 'HEALTHY',
                status: 'ACTIVE',
                ownedBy: 'user_admin',
                updatedAt: '2026-05-12T10:00:00.000Z',
              },
            ],
          },
          null,
          2,
        ),
        'utf8',
      );

      const storage = new AppStorageService(createRuntimeConfig(repoRoot));
      const templateIds = storage.state.queryTemplates.map((item) => item.id);

      expect(templateIds).toContain('tpl_custom_existing');
      expect(templateIds).toContain('tpl_company_2026_completion');
      expect(templateIds).toContain('tpl_company_weekly_new_opportunity');
      expect(storage.state.queryTemplates.length).toBeGreaterThan(2);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('持久化文件仍是旧白名单时，启动后应自动补齐联软标准字段', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'crm-app-storage-'));
    const runtimeDir = join(repoRoot, '.runtime');
    const storageFilePath = join(runtimeDir, 'app-storage.json');
    const originalNodeEnv = process.env.NODE_ENV;

    try {
      process.env.NODE_ENV = 'development';
      mkdirSync(runtimeDir, { recursive: true });
      writeFileSync(
        storageFilePath,
        JSON.stringify(
          {
            policy: {
              id: 'policy_current',
              allowedTables: ['opportunities', 'partners'],
              allowedFields: {
                opportunities: ['id', 'created_at'],
                partners: ['id', 'name'],
              },
              maskedFields: {},
            },
          },
          null,
          2,
        ),
        'utf8',
      );

      const storage = new AppStorageService(createRuntimeConfig(repoRoot));

      expect(storage.state.policy.allowedTables).toEqual(
        expect.arrayContaining(['registrations', 'quotes', 'orders']),
      );
      expect(storage.state.policy.allowedFields.partners).toEqual(
        expect.arrayContaining([
          'partnerLevelName',
          'isTechnicalServiceProvider',
          'technicalServiceProviderType',
        ]),
      );
      expect(storage.state.policy.allowedFields.customers).toEqual(
        expect.arrayContaining(['user_id']),
      );
      expect(storage.state.policy.allowedFields.orders).toEqual(
        expect.arrayContaining(['partnerId', 'amount', 'dealAt', 'createdAt']),
      );

      const persistedAfterBoot = JSON.parse(
        readFileSync(storageFilePath, 'utf8'),
      ) as { policy?: { allowedFields?: Record<string, string[]> } };
      expect(persistedAfterBoot.policy?.allowedFields?.partners).toEqual(
        expect.arrayContaining(['isTechnicalServiceProvider']),
      );
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('持久化文件保留同版本旧版内置模板 SQL 时，启动后应以当前内置模板为准', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'crm-app-storage-'));
    const runtimeDir = join(repoRoot, '.runtime');
    const storageFilePath = join(runtimeDir, 'app-storage.json');
    const originalNodeEnv = process.env.NODE_ENV;

    try {
      process.env.NODE_ENV = 'development';
      mkdirSync(runtimeDir, { recursive: true });
      writeFileSync(
        storageFilePath,
        JSON.stringify(
          {
            queryTemplates: [
              {
                id: 'tpl_company_2026_completion',
                name: '2026 各团队完成预测',
                description: '旧版运行态模板。',
                defaultQuestionText: '2026 各团队完成预测',
                defaultFilters: {
                  year: 2026,
                },
                defaultViewType: 'BAR_CHART',
                queryMode: 'FIXED_SQL',
                sqlText:
                  'SELECT c.department_id AS team_name, SUM(o.expect_amount) / 10000 AS committed_amount FROM opportunities o LEFT JOIN customers c ON c.id = o.customer_id WHERE YEAR(o.expect_sign_date) = :year GROUP BY c.department_id',
                sqlVersion: '2026.05.12-grafana-aligned',
                parameterSchema: [],
                renderConfig: {
                  primaryViewType: 'BAR_CHART',
                  primaryTitle: '旧版完成预测',
                },
                visibleRoleIds: ['role_sales_director'],
                displayOrder: 4,
                clickCount7d: 28,
                hitRatePercent: 90,
                optimizationStatus: 'HEALTHY',
                status: 'ACTIVE',
                ownedBy: 'system',
                updatedAt: '2026-05-12T10:00:00.000Z',
              },
            ],
          },
          null,
          2,
        ),
        'utf8',
      );

      const storage = new AppStorageService(createRuntimeConfig(repoRoot));
      const template = storage.state.queryTemplates.find(
        (item) => item.id === 'tpl_company_2026_completion',
      );

      expect(template?.sqlText).toContain(
        "FROM (\n  SELECT '大东区-上海区（非金）' AS team_name",
      );
      expect(template?.renderConfig.tableColumns?.map((item) => item.key)).toContain(
        'annual_forecast',
      );

      const persistedAfterBoot = JSON.parse(
        readFileSync(storageFilePath, 'utf8'),
      ) as { queryTemplates?: Array<{ id?: string; sqlText?: string }> };
      const persistedTemplate = persistedAfterBoot.queryTemplates?.find(
        (item) => item.id === 'tpl_company_2026_completion',
      );
      expect(persistedTemplate?.sqlText).toContain(
        "FROM (\n  SELECT '大东区-上海区（非金）' AS team_name",
      );
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('持久化文件保留旧版内置模板说明时，启动后应改为业务用途说明', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'crm-app-storage-'));
    const runtimeDir = join(repoRoot, '.runtime');
    const storageFilePath = join(runtimeDir, 'app-storage.json');
    const originalNodeEnv = process.env.NODE_ENV;
    const defaultTemplate = DEFAULT_QUERY_TEMPLATES.find(
      (item) => item.id === 'tpl_company_2026_completion',
    );

    if (!defaultTemplate) {
      throw new Error('未找到默认完成预测模板。');
    }

    try {
      process.env.NODE_ENV = 'development';
      mkdirSync(runtimeDir, { recursive: true });
      writeFileSync(
        storageFilePath,
        JSON.stringify(
          {
            queryTemplates: [
              {
                ...defaultTemplate,
                description:
                  '源自《公司 2026》看板“2026各团队完成预测”，查看全年目标、有效收入、承诺商机与完成率预测。',
              },
            ],
          },
          null,
          2,
        ),
        'utf8',
      );

      const storage = new AppStorageService(createRuntimeConfig(repoRoot));
      const template = storage.state.queryTemplates.find(
        (item) => item.id === 'tpl_company_2026_completion',
      );

      expect(template?.description).toBe(defaultTemplate.description);
      expect(template?.description).not.toMatch(/源自|来源于/);

      const persistedAfterBoot = JSON.parse(
        readFileSync(storageFilePath, 'utf8'),
      ) as { queryTemplates?: Array<{ id?: string; description?: string }> };
      const persistedTemplate = persistedAfterBoot.queryTemplates?.find(
        (item) => item.id === 'tpl_company_2026_completion',
      );
      expect(persistedTemplate?.description).toBe(defaultTemplate.description);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('持久化文件仍是旧治理白名单时，启动后应自动补齐当前模板依赖的允许表与字段', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'crm-app-storage-'));
    const runtimeDir = join(repoRoot, '.runtime');
    const storageFilePath = join(runtimeDir, 'app-storage.json');
    const originalNodeEnv = process.env.NODE_ENV;

    try {
      process.env.NODE_ENV = 'development';
      mkdirSync(runtimeDir, { recursive: true });
      writeFileSync(
        storageFilePath,
        JSON.stringify(
          {
            policy: {
              id: 'policy_current',
              enabledRoleIds: ['role_admin'],
              exportRoleIds: ['role_admin'],
              enabledChannels: ['web-console'],
              allowedDomains: ['opportunity-analysis'],
              allowedTables: ['opportunities', 'contracts', 'customers', 'users'],
              allowedFields: {
                opportunities: ['id', 'title'],
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
              updatedBy: 'legacy_admin',
              updatedAt: '2026-03-24T10:00:00.000Z',
            },
          },
          null,
          2,
        ),
        'utf8',
      );

      const storage = new AppStorageService(createRuntimeConfig(repoRoot));

      expect(storage.state.policy.allowedTables).toEqual(
        expect.arrayContaining([
          'opportunities',
          'contracts',
          'customers',
          'users',
          'departments',
          'field_values',
          'customer_assets',
          'opportunity_assets',
          'contract_assets',
        ]),
      );
      expect(storage.state.policy.allowedFields.opportunities).toEqual(
        expect.arrayContaining(['id', 'title', 'organization_id', 'department_id']),
      );
      expect(storage.state.policy.allowedFields.departments).toEqual(
        expect.arrayContaining(['id', 'name']),
      );
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});

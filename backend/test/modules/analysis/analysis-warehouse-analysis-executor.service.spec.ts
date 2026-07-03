import { AnalysisWarehouseAnalysisExecutorService } from '../../../src/modules/analysis/analysis-warehouse-analysis-executor.service';

/**
 * 构造分析库 Text-to-SQL 执行器测试夹具。
 *
 * 参数说明：无。
 * 返回值说明：返回待测服务和关键依赖 mock。
 * 调用注意事项：该测试不连接真实 MySQL，也不调用真实 AI。
 */
function createFixture(options?: {
  lianruanCrmAnalysisExecutorService?: {
    executeStaleOpportunityDetailTask: jest.Mock;
    fetchBusinessChainSnapshot?: jest.Mock;
  };
}) {
  const mysqlService = {
    isConfigured: jest.fn(() => true),
    getUserScopeHint: jest.fn<Promise<unknown>, unknown[]>(async () => null),
    executeSelect: jest.fn(async () => [
      {
        partner_name: '山东测试服务商',
        opportunity_count: 3,
        opportunity_amount: '120000',
      },
    ]),
  };
  const sqlGuardService = {
    validateAndNormalize: jest.fn((sql: string) => ({
      normalizedSql: sql,
      tables: ['fact_lianruan_opportunity'],
      columns: ['partner_name', 'opportunity_id', 'amount'],
      appliedLimit: 100,
    })),
  };
  const sqliteSnapshotImporterService = {
    isConfigured: jest.fn(() => false),
    importResource: jest.fn(),
  };
  const aiGatewayService = {
    generateAnalysisWarehouseQueryTask: jest.fn(async () => ({
      taskTitle: '山东服务商商机统计',
      resultKind: 'partner-contribution',
      sql: 'SELECT partner_name, COUNT(opportunity_id) AS opportunity_count, SUM(amount) AS opportunity_amount FROM fact_lianruan_opportunity GROUP BY partner_name',
      tables: ['fact_lianruan_opportunity'],
      fieldEntries: [
        {
          table: 'fact_lianruan_opportunity',
          fields: ['partner_name', 'opportunity_id', 'amount'],
        },
      ],
      joinPaths: [],
      allowedFunctions: ['COUNT', 'SUM'],
      rowLimit: 100,
      timeoutMs: 3000,
    })),
  };
  const logger = {
    logStep: jest.fn(),
    logWarn: jest.fn(),
  };

  return {
    service: new AnalysisWarehouseAnalysisExecutorService(
      mysqlService as never,
      sqlGuardService as never,
      sqliteSnapshotImporterService as never,
      aiGatewayService as never,
      logger as never,
      options?.lianruanCrmAnalysisExecutorService as never,
    ),
    mysqlService,
    sqlGuardService,
    sqliteSnapshotImporterService,
    aiGatewayService,
    logger,
    lianruanCrmAnalysisExecutorService: options?.lianruanCrmAnalysisExecutorService,
  };
}

describe('AnalysisWarehouseAnalysisExecutorService', () => {
  const originalEnabled = process.env.ANALYSIS_WAREHOUSE_TEXT_TO_SQL_ENABLED;
  const originalSqliteOnly = process.env.ANALYSIS_WAREHOUSE_SQLITE_ONLY;

  afterEach(() => {
    if (originalEnabled === undefined) {
      delete process.env.ANALYSIS_WAREHOUSE_TEXT_TO_SQL_ENABLED;
    } else {
      process.env.ANALYSIS_WAREHOUSE_TEXT_TO_SQL_ENABLED = originalEnabled;
    }

    if (originalSqliteOnly === undefined) {
      delete process.env.ANALYSIS_WAREHOUSE_SQLITE_ONLY;
    } else {
      process.env.ANALYSIS_WAREHOUSE_SQLITE_ONLY = originalSqliteOnly;
    }
    jest.clearAllMocks();
  });

  it('普通角色有负责人范围时应为 AI SQL 注入行级权限后再执行', async () => {
    const lianruanCrmAnalysisExecutorService = {
      executeStaleOpportunityDetailTask: jest.fn(),
      fetchBusinessChainSnapshot: jest.fn(async () => ({
        sql: '-- 联软标准 OpenAPI 业务链真实明细临时快照\n-- GET /partners\n-- GET /registrations\n-- GET /opportunities\n-- GET /orders',
        scopeSummary: '全部数据范围',
        partners: [
          { id: 'P-REAL-001', name: '华东真实核心渠道商', createdAt: '2026-05-01T00:00:00.000Z' },
        ],
        registrations: [
          { id: 'R-REAL-001', customerId: 'C-REAL-001', customerName: '某银行总行', partnerId: 'P-REAL-001', createdAt: '2026-05-03T00:00:00.000Z' },
        ],
        opportunities: [
          { id: 'OPP-REAL-001', customerId: 'C-REAL-001', customerName: '某银行总行', partnerId: 'P-REAL-001', statusName: '草稿', amount: 200000, createdAt: '2026-05-04T00:00:00.000Z', updatedAt: '2000-01-01T00:00:00.000Z' },
        ],
        orders: [
          { id: 'ORD-REAL-001', customerId: 'C-REAL-001', customerName: '某银行总行', partnerId: 'P-REAL-001', amount: 310000, statusName: '已确认', dealAt: '2026-05-05T00:00:00.000Z' },
        ],
      })),
    };
    const fixture = createFixture({ lianruanCrmAnalysisExecutorService });

    const result = await fixture.service.tryExecute({
      questionText: '山东区域服务商商机金额',
      channel: 'wecom-bot',
      user: {
        id: 'user_region',
        name: '区域经理',
        roleIds: ['role_region_manager'],
        roleNames: ['区域经理'],
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        isAdmin: false,
        exportAllowed: false,
        channels: ['wecom-bot'],
      },
      intent: {
        domain: 'opportunity-analysis',
        metrics: [],
        dimensions: [],
        filters: {},
        missingConditions: [],
        confidence: 'HIGH',
      } as never,
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: ['user_region'],
        scopeSummary: '仅本人范围',
      },
    });

    expect(result?.slice.executionSource).toBe('ANALYSIS_WAREHOUSE');
    expect(fixture.aiGatewayService.generateAnalysisWarehouseQueryTask).toHaveBeenCalled();
    expect(fixture.sqlGuardService.validateAndNormalize).toHaveBeenCalledWith(
      expect.stringContaining('owner_id IN (?)'),
      expect.any(Object),
    );
    expect(fixture.mysqlService.executeSelect).toHaveBeenCalledWith(
      expect.stringContaining('assigned_staff_id IN (?)'),
      ['user_region', 'user_region'],
      3000,
    );
  });

  it('超管视角应生成分析库 SQL，经 SQL Guard 校验后转换为统一数据切片', async () => {
    const fixture = createFixture();

    const result = await fixture.service.tryExecute({
      questionText: '最近三个月山东区域有商机的服务商数量和金额',
      channel: 'wecom-bot',
      user: {
        id: 'liulonghai',
        name: '刘龙海',
        roleIds: ['role_superadmin'],
        roleNames: ['超管'],
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        isAdmin: true,
        exportAllowed: true,
        channels: ['wecom-bot'],
      },
      intent: {
        domain: 'opportunity-analysis',
        metrics: [],
        dimensions: [],
        filters: {},
        missingConditions: [],
        confidence: 'HIGH',
      } as never,
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        scopeSummary: '全部数据范围',
        isFullAccess: true,
      },
    });

    expect(result?.slice.executionSource).toBe('ANALYSIS_WAREHOUSE');
    expect(result?.slice.matchedAdapter).toBe('analysis-warehouse.text-to-sql');
    expect(result?.slice.tableRows).toHaveLength(1);
    expect(result?.slice.metricCards[0]?.name).toBe('商机数量');
    expect(fixture.sqlGuardService.validateAndNormalize).toHaveBeenCalled();
    expect(fixture.mysqlService.executeSelect).toHaveBeenCalledWith(
      expect.stringContaining('SELECT partner_name'),
      [],
      3000,
    );
  });

  it('固定经营分析模板遇到分析库连接失败时应返回空结果交由旧链路兜底', async () => {
    const fixture = createFixture();
    fixture.mysqlService.executeSelect.mockRejectedValueOnce(
      new Error('AI-agent 分析库尚未配置或连接不可用。'),
    );

    const result = await fixture.service.tryExecute({
      questionText: '帮我生成一份本月经营分析报告',
      channel: 'wecom-bot',
      user: {
        id: 'liulonghai',
        name: '刘龙海',
        roleIds: ['role_admin'],
        roleNames: ['管理员'],
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        isAdmin: true,
        exportAllowed: true,
        channels: ['wecom-bot'],
      },
      intent: {
        domain: 'opportunity-analysis',
        metrics: [],
        dimensions: [],
        filters: {},
        missingConditions: [],
        confidence: 'HIGH',
      } as never,
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        isFullAccess: true,
        scopeSummary: '全部数据范围',
      },
    });

    expect(result).toBeNull();
    expect(fixture.aiGatewayService.generateAnalysisWarehouseQueryTask).not.toHaveBeenCalled();
    expect(fixture.logger.logWarn).toHaveBeenCalledWith(
      '分析库固定业务模板执行失败，已停止本次离线诊断模板执行。',
      expect.objectContaining({
        reason: 'AI-agent 分析库尚未配置或连接不可用。',
      }),
    );
  });

  it('客户报备未关联商机问法应走固定受控 SQL 模板并返回创建时长明细', async () => {
    const fixture = createFixture();
    fixture.mysqlService.executeSelect.mockResolvedValueOnce([
      {
        registration_id: 'REG-001',
        customer_id: 'CUST-001',
        customer_name: '山东测试客户',
        partner_id: 'P001',
        partner_name: '山东测试服务商',
        region: '山东区',
        created_at: new Date('2026-04-29T01:18:38.310Z'),
        created_days: 41,
      },
    ] as never);

    const result = await fixture.service.tryExecute({
      questionText: '有多少客户是没有报备商机的，分别创建了多长时间',
      channel: 'wecom-bot',
      user: {
        id: 'liulonghai',
        name: '刘龙海',
        roleIds: ['role_superadmin'],
        roleNames: ['超管'],
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        isAdmin: true,
        exportAllowed: true,
        channels: ['wecom-bot'],
      },
      intent: {
        domain: 'customer-relationship',
        metrics: [],
        dimensions: [],
        filters: {},
        missingConditions: [],
        confidence: 'HIGH',
      } as never,
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        scopeSummary: '全部数据范围',
        isFullAccess: true,
      },
    });

    expect(result?.slice.matchedAdapter).toBe(
      'analysis-warehouse.fixed-registration-without-opportunity',
    );
    expect(result?.slice.metricCards).toEqual(
      expect.arrayContaining([
        { name: '未关联商机的客户报备数', value: 1 },
        { name: '平均创建时长', value: '41 天' },
      ]),
    );
    expect(result?.slice.tableRows[0]).toEqual(
      expect.objectContaining({
        customer_name: '山东测试客户',
        created_days: 41,
      }),
    );
    expect(fixture.aiGatewayService.generateAnalysisWarehouseQueryTask).not.toHaveBeenCalled();
    expect(fixture.sqlGuardService.validateAndNormalize).toHaveBeenCalledWith(
      expect.stringContaining('LEFT JOIN fact_lianruan_opportunity'),
      expect.any(Object),
    );
  });

  it('区域角色查询客户报备未关联商机时应注入联软区域权限', async () => {
    const fixture = createFixture();
    fixture.mysqlService.getUserScopeHint.mockResolvedValueOnce({
      userId: 'A013',
      username: 'admin_sd',
      roleCode: 'admin',
      roleName: '区域管理员',
      region: '山东区',
      bigRegion: '大北区',
      partnerId: undefined,
      partnerName: undefined,
      permissionScopeType: 'region',
      permissionRegions: ['山东区'],
      permissionPartnerIds: [],
      permissionUserIds: [],
    });
    fixture.mysqlService.executeSelect.mockResolvedValueOnce([
      {
        registration_id: 'REG-002',
        customer_id: 'CUST-002',
        customer_name: '山东区域客户',
        partner_id: 'P002',
        partner_name: '山东区域服务商',
        region: '山东区',
        created_at: new Date('2026-04-29T01:18:38.310Z'),
        created_days: 41,
      },
    ] as never);

    const result = await fixture.service.tryExecute({
      questionText: '有多少客户是没有报备商机的，分别创建了多长时间',
      channel: 'wecom-bot',
      user: {
        id: 'admin_sd',
        name: '山东区管理员',
        roleIds: ['role_region_admin'],
        roleNames: ['区域管理员'],
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        isAdmin: false,
        exportAllowed: false,
        channels: ['wecom-bot'],
      },
      intent: {
        domain: 'customer-relationship',
        metrics: [],
        dimensions: [],
        filters: {},
        missingConditions: [],
        confidence: 'HIGH',
      } as never,
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        scopeSummary: '山东区范围',
      },
    });

    expect(result?.slice.summary).toContain('1 条客户报备');
    expect(result?.slice.appliedFilters).toEqual(
      expect.arrayContaining([{ label: '权限范围', value: '联软 CRM 区域权限：山东区、大北区' }]),
    );
    expect(fixture.sqlGuardService.validateAndNormalize).toHaveBeenCalledWith(
      expect.stringContaining('r.region IN (?)'),
      expect.any(Object),
    );
    expect(fixture.mysqlService.executeSelect).toHaveBeenCalledWith(
      expect.stringContaining('r.region IN (?)'),
      ['山东区', '大北区'],
      5000,
    );
  });

  it('超两周未更新商机问法应走固定受控 SQL 模板并返回风险明细', async () => {
    const fixture = createFixture();
    fixture.mysqlService.executeSelect.mockResolvedValueOnce([
      {
        opportunity_id: 'OPP-001',
        opportunity_name: '山东测试商机',
        customer_name: '山东测试客户',
        partner_name: '山东测试服务商',
        owner_name: '销售一',
        stage_name: '方案沟通',
        amount: '180000',
        source_updated_at: new Date('2026-05-01T00:00:00.000Z'),
        stale_days: 39,
      },
    ] as never);

    const result = await fixture.service.tryExecute({
      questionText: '本区域超两周未更新的商机有哪些',
      channel: 'wecom-bot',
      user: {
        id: 'admin_sd',
        name: '山东区管理员',
        roleIds: ['role_region_admin'],
        roleNames: ['区域管理员'],
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        isAdmin: false,
        exportAllowed: false,
        channels: ['wecom-bot'],
      },
      intent: {
        domain: 'opportunity-analysis',
        metrics: [],
        dimensions: [],
        filters: {},
        missingConditions: [],
        confidence: 'HIGH',
      } as never,
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: ['admin_sd'],
        scopeSummary: '山东区范围',
      },
    });

    expect(result?.slice.matchedAdapter).toBe('analysis-warehouse.fixed-stale-opportunity');
    expect(result?.slice.metricCards).toEqual(
      expect.arrayContaining([
        { name: '超期商机数量', value: 1 },
        { name: '最长未更新天数', value: '39 天' },
      ]),
    );
    expect(fixture.aiGatewayService.generateAnalysisWarehouseQueryTask).not.toHaveBeenCalled();
    expect(fixture.sqlGuardService.validateAndNormalize).toHaveBeenCalledWith(
      expect.stringContaining('DATEDIFF(CURRENT_DATE(), DATE(o.source_updated_at)) > 14'),
      expect.any(Object),
    );
  });

  it('当前3个月没有进展的商机应按进展更新时间阈值查询，不按创建时间过滤', async () => {
    const fixture = createFixture();
    fixture.mysqlService.executeSelect.mockResolvedValueOnce([
      {
        opportunity_id: 'OPP-003',
        opportunity_name: '三个月未推进商机',
        customer_name: '山东测试客户',
        partner_name: '山东测试服务商',
        owner_name: '销售一',
        stage_name: '方案沟通',
        amount: '260000',
        source_updated_at: new Date('2026-02-01T00:00:00.000Z'),
        stale_days: 120,
      },
    ] as never);

    const result = await fixture.service.tryExecute({
      questionText: '分析当前3个月没有进展的商机情况',
      channel: 'wecom-bot',
      user: {
        id: 'liulonghai',
        name: '刘龙海',
        roleIds: ['role_superadmin'],
        roleNames: ['超管'],
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        isAdmin: true,
        exportAllowed: true,
        channels: ['wecom-bot'],
      },
      intent: {
        domain: 'opportunity-analysis',
        metrics: ['商机数量'],
        dimensions: ['销售负责人', '商机阶段'],
        filters: {
          timeRange: '当前3个月',
          startAt: '2026-04-01T00:00:00+08:00',
          endAt: '2026-07-01T00:00:00+08:00',
        },
        missingConditions: [],
        confidence: 'HIGH',
        resultKindHint: 'risk-overview',
        temporalSlot: {
          rawText: '当前3个月',
          normalizedLabel: '当前3个月',
          startAt: '2026-04-01T00:00:00+08:00',
          endAt: '2026-07-01T00:00:00+08:00',
          timezone: 'Asia/Shanghai',
          granularity: 'month',
          relativity: 'relative',
          inclusivity: {
            start: 'inclusive',
            end: 'exclusive',
          },
          confidence: 'HIGH',
        },
      } as never,
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        scopeSummary: '全部数据范围',
        isFullAccess: true,
      },
    });

    expect(result?.slice.matchedAdapter).toBe('analysis-warehouse.fixed-stale-opportunity');
    expect(result?.slice.taskTitle).toBe('超过3个月未更新商机分析');
    expect(result?.slice.appliedFilters).toEqual(
      expect.arrayContaining([
        {
          label: '统计口径',
          value: '按商机更新时间识别未更新商机，用户输入的月份按 30 天换算',
        },
        {
          label: '风险口径',
          value: '本次高风险仅指商机更新时间超过 90 天，且排除已成交、已失单、取消、删除状态',
        },
        {
          label: '排序口径',
          value: '按未更新天数倒序，未更新天数相同按商机金额倒序',
        },
      ]),
    );
    expect(fixture.sqlGuardService.validateAndNormalize).toHaveBeenCalledWith(
      expect.stringContaining('DATEDIFF(CURRENT_DATE(), DATE(o.source_updated_at)) > 90'),
      expect.any(Object),
    );
    expect(fixture.sqlGuardService.validateAndNormalize).toHaveBeenCalledWith(
      expect.not.stringContaining('o.created_at >='),
      expect.any(Object),
    );
  });

  it('MySQL分析库未配置时应直接使用联软SQLite快照分析当前3个月没有进展的商机', async () => {
    const fixture = createFixture();
    fixture.mysqlService.isConfigured.mockReturnValue(false);
    fixture.sqliteSnapshotImporterService.isConfigured.mockReturnValue(true);
    fixture.sqliteSnapshotImporterService.importResource.mockResolvedValueOnce({
      resource: 'opportunities',
      tableName: 'entities',
      snapshotFile: 'crm_openapi_aiagent_sanitized_20260612075556.db',
      rows: [
        {
          payload: {
            id: 'OPP-SQLITE-001',
            name: 'SQLite三个月未推进商机',
            customer: '客户001',
            partnerName: '渠道商001',
            ownerId: 'A001',
            owner: '销售一',
            stage: '10%见面并明确需求',
            status: 'draft',
            amount: 260000,
            updatedAt: '2000-01-01T00:00:00.000Z',
          },
        },
        {
          payload: {
            id: 'OPP-SQLITE-002',
            name: '已取消商机',
            stage: 'cancelled',
            status: 'cancelled',
            amount: 999999,
            updatedAt: '2000-01-01T00:00:00.000Z',
          },
        },
        {
          payload: {
            id: 'OPP-SQLITE-003',
            name: '未来更新时间商机',
            stage: '方案沟通',
            status: 'draft',
            amount: 10000,
            updatedAt: '2999-01-01T00:00:00.000Z',
          },
        },
      ],
      total: 3,
    } as never);

    const result = await fixture.service.tryExecute({
      questionText: '分析当前3个月没有进展的商机情况',
      channel: 'wecom-bot',
      user: {
        id: 'liulonghai',
        name: '刘龙海',
        roleIds: ['role_superadmin'],
        roleNames: ['超管'],
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        isAdmin: true,
        exportAllowed: true,
        channels: ['wecom-bot'],
      },
      intent: {
        domain: 'opportunity-analysis',
        metrics: ['商机数量'],
        dimensions: ['销售负责人', '商机阶段'],
        filters: {},
        missingConditions: [],
        confidence: 'HIGH',
        resultKindHint: 'risk-overview',
      } as never,
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        scopeSummary: '全部数据范围',
        isFullAccess: true,
      },
    });

    expect(result?.slice.matchedAdapter).toBe('sqlite-snapshot.fixed-stale-opportunity');
    expect(result?.slice.taskTitle).toBe('超过3个月未更新商机分析');
    expect(result?.slice.tableRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          opportunity_id: 'OPP-SQLITE-001',
          opportunity_name: 'SQLite三个月未推进商机',
          amount: 260000,
        }),
      ]),
    );
    expect(result?.slice.tableRows).toHaveLength(1);
    expect(result?.sql).toContain('联软 SQLite 脱敏快照固定模板');
    expect(fixture.sqliteSnapshotImporterService.importResource).toHaveBeenCalledWith({
      resource: 'opportunities',
      mode: 'FULL',
      pageSize: 1000,
      maxPages: 20,
    });
    expect(fixture.mysqlService.executeSelect).not.toHaveBeenCalled();
    expect(fixture.sqlGuardService.validateAndNormalize).not.toHaveBeenCalled();
    expect(fixture.aiGatewayService.generateAnalysisWarehouseQueryTask).not.toHaveBeenCalled();
  });

  it('SQLite停滞商机模板命中后应优先用联软OpenAPI真实明细替换脱敏快照名称', async () => {
    const lianruanCrmAnalysisExecutorService = {
      executeStaleOpportunityDetailTask: jest.fn(async () => ({
        sql: '-- 联软标准 OpenAPI /opportunities',
        tableRows: [
          {
            opportunityId: 'OPP-REAL-001',
            opportunityName: '某银行零信任扩容项目',
            customerName: '某银行总行',
            partnerName: '华东核心渠道商',
            salesOwnerName: '张三',
            stageName: '方案沟通',
            region: '华东',
            bigRegion: '东区',
            amount: 880000,
            sourceUpdatedAt: '2026-04-01T00:00:00.000Z',
            stale_days: 74,
          },
        ],
      })),
    };
    const fixture = createFixture({ lianruanCrmAnalysisExecutorService });
    fixture.mysqlService.isConfigured.mockReturnValue(false);
    fixture.sqliteSnapshotImporterService.isConfigured.mockReturnValue(true);
    fixture.sqliteSnapshotImporterService.importResource.mockResolvedValueOnce({
      resource: 'opportunities',
      tableName: 'entities',
      snapshotFile: 'crm_openapi_aiagent_sanitized_20260612075556.db',
      rows: [
        {
          payload: {
            id: 'OPP-SQLITE-001',
            name: '客户070项目012',
            customer: '客户070',
            partnerName: '渠道商004',
            owner: '用户025',
            stage: '方案沟通',
            amount: 260000,
            updatedAt: '2000-01-01T00:00:00.000Z',
          },
        },
      ],
      total: 1,
    } as never);

    const result = await fixture.service.tryExecute({
      questionText: '查询超过30天未更新商机明细',
      channel: 'wecom-bot',
      user: {
        id: 'A023',
        name: '当前用户',
        roleIds: ['role_superadmin'],
        roleNames: ['超管'],
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        isAdmin: true,
        exportAllowed: true,
        channels: ['wecom-bot'],
      },
      intent: {
        domain: 'opportunity-analysis',
        metrics: ['商机数量'],
        dimensions: ['商机', '客户', '渠道商'],
        filters: {},
        missingConditions: [],
        confidence: 'HIGH',
        resultKindHint: 'risk-overview',
      } as never,
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        scopeSummary: '全部数据范围',
        isFullAccess: true,
      },
    });

    expect(result?.slice.matchedAdapter).toBe('sqlite-snapshot.fixed-stale-opportunity.openapi-detail');
    expect(result?.slice.tableRows).toEqual([
      expect.objectContaining({
        opportunity_id: 'OPP-REAL-001',
        opportunity_name: '某银行零信任扩容项目',
        customer_name: '某银行总行',
        partner_name: '华东核心渠道商',
        owner_name: '张三',
      }),
    ]);
    expect(result?.slice.tableRows).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({
          opportunity_name: '客户070项目012',
        }),
      ]),
    );
    expect(result?.tables).toContain('openapi:/opportunities');
    expect(result?.sql).toContain('联软标准 OpenAPI /opportunities');
    expect(lianruanCrmAnalysisExecutorService.executeStaleOpportunityDetailTask).toHaveBeenCalledWith(
      '查询超过30天未更新商机明细',
      expect.objectContaining({ id: 'A023' }),
      '全部数据范围',
    );
    expect(fixture.mysqlService.executeSelect).not.toHaveBeenCalled();
    expect(fixture.sqlGuardService.validateAndNormalize).not.toHaveBeenCalled();
  });

  it('SQLite快照启用时应按宽业务意图优先执行订单与商机组合模板', async () => {
    const fixture = createFixture();
    fixture.mysqlService.isConfigured.mockReturnValue(false);
    fixture.sqliteSnapshotImporterService.isConfigured.mockReturnValue(true);
    fixture.sqliteSnapshotImporterService.importResource
      .mockResolvedValueOnce({
        resource: 'orders',
        tableName: 'entities',
        snapshotFile: 'crm_openapi_aiagent_sanitized_20260612075556.db',
        rows: [
          {
            payload: {
              id: 'ORD-SQLITE-001',
              amount: 360000,
              status: 'confirmed',
              dealAt: '2026-05-01T00:00:00.000Z',
            },
          },
          {
            payload: {
              id: 'ORD-SQLITE-002',
              amount: 50000,
              status: 'cancelled',
              dealAt: '2026-05-02T00:00:00.000Z',
            },
          },
        ],
        total: 2,
      } as never)
      .mockResolvedValueOnce({
        resource: 'opportunities',
        tableName: 'entities',
        snapshotFile: 'crm_openapi_aiagent_sanitized_20260612075556.db',
        rows: [
          {
            payload: {
              id: 'OPP-SQLITE-101',
              amount: 120000,
              createdAt: '2026-05-03T00:00:00.000Z',
            },
          },
          {
            payload: {
              id: 'OPP-SQLITE-102',
              amount: 80000,
              createdAt: '2026-06-03T00:00:00.000Z',
            },
          },
        ],
        total: 2,
      } as never);

    const result = await fixture.service.tryExecute({
      questionText: '帮我看下最近经营进展',
      channel: 'wecom-bot',
      user: {
        id: 'liulonghai',
        name: '刘龙海',
        roleIds: ['role_superadmin'],
        roleNames: ['超管'],
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        isAdmin: true,
        exportAllowed: true,
        channels: ['wecom-bot'],
      },
      intent: {
        domain: 'contract-conversion',
        metrics: ['转合同金额', '新增商机金额'],
        dimensions: ['月份'],
        filters: {},
        missingConditions: [],
        confidence: 'HIGH',
        resultKindHint: 'time-trend',
        businessIntentHint: {
          objectTypes: ['order', 'opportunity'],
          metrics: ['order_amount', 'opportunity_amount'],
          dimensions: ['month'],
          analysisMode: 'summary_report',
          comparison: [],
          outputPreference: ['chart'],
          sourceResource: 'orders',
        },
      } as never,
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        scopeSummary: '全部数据范围',
        isFullAccess: true,
      },
    });

    expect(result?.slice.matchedAdapter).toBe(
      'sqlite-snapshot.fixed-order-opportunity-overview',
    );
    expect(result?.slice.metricCards).toEqual(
      expect.arrayContaining([
        { name: '有效订单数量', value: 1 },
        { name: '有效订单金额', value: '36 万元' },
        { name: '商机数量', value: 2 },
        { name: '商机金额', value: '20 万元' },
      ]),
    );
    expect(result?.slice.secondaryViews.map((item) => item.title)).toEqual(
      expect.arrayContaining(['订单情况（趋势/表格）', '商机情况（趋势/表格）']),
    );
    expect(result?.sql).toContain('订单与商机分块组合模板');
    expect(fixture.sqliteSnapshotImporterService.importResource).toHaveBeenCalledWith({
      resource: 'orders',
      mode: 'FULL',
      pageSize: 1000,
      maxPages: 20,
    });
    expect(fixture.sqliteSnapshotImporterService.importResource).toHaveBeenCalledWith({
      resource: 'opportunities',
      mode: 'FULL',
      pageSize: 1000,
      maxPages: 20,
    });
    expect(fixture.mysqlService.executeSelect).not.toHaveBeenCalled();
    expect(fixture.sqlGuardService.validateAndNormalize).not.toHaveBeenCalled();
    expect(fixture.aiGatewayService.generateAnalysisWarehouseQueryTask).not.toHaveBeenCalled();
  });

  it('未活跃客户问法应走固定受控 SQL 模板并返回未活跃时长', async () => {
    const fixture = createFixture();
    fixture.mysqlService.executeSelect.mockResolvedValueOnce([
      {
        customer_id: 'CUST-001',
        customer_name: '山东沉默客户',
        partner_name: '山东测试服务商',
        owner_name: '销售一',
        region: '山东区',
        latest_activity_at: null,
        inactive_days: 80,
      },
    ] as never);

    const result = await fixture.service.tryExecute({
      questionText: '最近30天没有活跃的客户有哪些',
      channel: 'wecom-bot',
      user: {
        id: 'liulonghai',
        name: '刘龙海',
        roleIds: ['role_superadmin'],
        roleNames: ['超管'],
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        isAdmin: true,
        exportAllowed: true,
        channels: ['wecom-bot'],
      },
      intent: {
        domain: 'customer-relationship',
        metrics: [],
        dimensions: [],
        filters: {},
        missingConditions: [],
        confidence: 'HIGH',
      } as never,
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        scopeSummary: '全部数据范围',
        isFullAccess: true,
      },
    });

    expect(result?.slice.matchedAdapter).toBe('analysis-warehouse.fixed-inactive-customer');
    expect(result?.slice.summary).toContain('最近 30 天未活跃');
    expect(result?.slice.metricCards).toEqual(
      expect.arrayContaining([{ name: '最长未活跃天数', value: '80 天' }]),
    );
    expect(fixture.aiGatewayService.generateAnalysisWarehouseQueryTask).not.toHaveBeenCalled();
  });

  it('订单金额问法应走固定受控 SQL 模板并应用 AI 时间口径', async () => {
    const fixture = createFixture();
    fixture.mysqlService.executeSelect.mockResolvedValueOnce([
      {
        region: '山东区',
        big_region: '大北区',
        order_count: 2,
        order_amount: '360000',
      },
    ] as never);

    const result = await fixture.service.tryExecute({
      questionText: '山东区域本月订单金额是多少',
      channel: 'wecom-bot',
      user: {
        id: 'liulonghai',
        name: '刘龙海',
        roleIds: ['role_superadmin'],
        roleNames: ['超管'],
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        isAdmin: true,
        exportAllowed: true,
        channels: ['wecom-bot'],
      },
      intent: {
        domain: 'contract-conversion',
        metrics: [],
        dimensions: [],
        filters: {},
        missingConditions: [],
        confidence: 'HIGH',
        temporalSlot: {
          rawText: '本月',
          normalizedLabel: '2026 年 6 月',
          startAt: '2026-06-01T00:00:00+08:00',
          endAt: '2026-07-01T00:00:00+08:00',
          timezone: 'Asia/Shanghai',
          granularity: 'month',
          relativity: 'relative',
          inclusivity: {
            start: 'inclusive',
            end: 'exclusive',
          },
          confidence: 'HIGH',
        },
      } as never,
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        scopeSummary: '全部数据范围',
        isFullAccess: true,
      },
    });

    expect(result?.slice.matchedAdapter).toBe('analysis-warehouse.fixed-order-summary');
    expect(result?.slice.metricCards).toEqual(
      expect.arrayContaining([
        { name: '有效订单数量', value: 2 },
        { name: '有效订单金额', value: '36 万元' },
      ]),
    );
    expect(fixture.mysqlService.executeSelect).toHaveBeenCalledWith(
      expect.stringContaining('COALESCE(o.deal_at, o.created_at) >= ?'),
      ['山东区', '2026-06-01T00:00:00+08:00', '2026-07-01T00:00:00+08:00'],
      5000,
    );
    expect(fixture.aiGatewayService.generateAnalysisWarehouseQueryTask).not.toHaveBeenCalled();
  });

  it('报备到订单转化问法应走 P4 漏斗受控模板并输出阶段转化表', async () => {
    const fixture = createFixture();
    fixture.mysqlService.executeSelect
      .mockResolvedValueOnce([{ registration_count: 150 }] as never)
      .mockResolvedValueOnce([{ opportunity_count: 44, opportunity_amount: '264999' }] as never)
      .mockResolvedValueOnce([{ quote_count: 17, quote_amount: '1661132.5' }] as never)
      .mockResolvedValueOnce([{ order_count: 2, order_amount: '45450' }] as never);

    const result = await fixture.service.tryExecute({
      questionText: '分析山东区本季度从报备到订单的转化情况，并列出流失最多的环节',
      channel: 'wecom-bot',
      user: {
        id: 'liulonghai',
        name: '刘龙海',
        roleIds: ['role_superadmin'],
        roleNames: ['超管'],
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        isAdmin: true,
        exportAllowed: true,
        channels: ['wecom-bot'],
      },
      intent: {
        domain: 'opportunity-analysis',
        metrics: [],
        dimensions: [],
        filters: {},
        missingConditions: [],
        confidence: 'HIGH',
      } as never,
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        scopeSummary: '全部数据范围',
        isFullAccess: true,
      },
    });

    expect(result?.slice.matchedAdapter).toBe('analysis-warehouse.fixed-funnel-conversion');
    expect(result?.slice.summary).toContain('报备 150 条、商机 44 条、报价 17 条、有效订单 2 单');
    expect(result?.slice.metricCards).toEqual(
      expect.arrayContaining([
        { name: '报备数', value: 150 },
        { name: '商机数', value: 44 },
        { name: '报价数', value: 17 },
        { name: '有效订单转化率', value: '1.3%' },
      ]),
    );
    expect(result?.slice.tableRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ funnel_stage: '客户报备', stage_count: 150 }),
        expect.objectContaining({ funnel_stage: '有效订单', stage_count: 2 }),
      ]),
    );
    expect(fixture.mysqlService.executeSelect).toHaveBeenCalledTimes(4);
    expect(fixture.aiGatewayService.generateAnalysisWarehouseQueryTask).not.toHaveBeenCalled();
  });

  it('有报价未下单问法应走 P4 报价差集模板并展示客户兜底口径', async () => {
    const fixture = createFixture();
    fixture.mysqlService.executeSelect.mockResolvedValueOnce([
      {
        quote_id: 'QT-001',
        customer_id: 'CUST-001',
        customer_name: '山东测试客户',
        opportunity_id: 'OPP-001',
        partner_id: 'P001',
        partner_name: '山东测试服务商',
        owner_name: '销售一',
        assigned_staff_name: '梁翠',
        status: 'draft',
        region: '山东区',
        big_region: '大北区',
        amount: '108750',
        created_at: new Date('2026-05-27T08:36:50.532Z'),
      },
    ] as never);

    const result = await fixture.service.tryExecute({
      questionText: '找出有报价但未下单的客户，并按报价金额排序',
      channel: 'wecom-bot',
      user: {
        id: 'liulonghai',
        name: '刘龙海',
        roleIds: ['role_superadmin'],
        roleNames: ['超管'],
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        isAdmin: true,
        exportAllowed: true,
        channels: ['wecom-bot'],
      },
      intent: {
        domain: 'contract-conversion',
        metrics: [],
        dimensions: [],
        filters: {},
        missingConditions: [],
        confidence: 'HIGH',
      } as never,
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        scopeSummary: '全部数据范围',
        isFullAccess: true,
      },
    });

    expect(result?.slice.matchedAdapter).toBe('analysis-warehouse.fixed-quote-without-order');
    expect(result?.slice.summary).toContain('1 条报价尚未匹配到有效订单');
    expect(result?.slice.metricCards).toEqual(
      expect.arrayContaining([
        { name: '未下单报价数', value: 1 },
        { name: '未下单报价金额', value: '10.88 万元' },
      ]),
    );
    expect(result?.slice.appliedFilters).toEqual(
      expect.arrayContaining([
        {
          label: '统计口径',
          value: '有报价且同客户未匹配到已确认/已完成订单；当前按客户兜底关联',
        },
      ]),
    );
    expect(result?.slice.tableRows[0]).toEqual(
      expect.objectContaining({
        quote_id: 'QT-001',
        customer_name: '山东测试客户',
        status: 'draft',
      }),
    );
    expect(fixture.sqlGuardService.validateAndNormalize).toHaveBeenCalledWith(
      expect.stringContaining('LEFT JOIN fact_lianruan_order o'),
      expect.any(Object),
    );
    expect(fixture.aiGatewayService.generateAnalysisWarehouseQueryTask).not.toHaveBeenCalled();
  });

  it('经营简报问法应走 P4 多子任务报告模板并合并报告区块', async () => {
    const fixture = createFixture();
    fixture.mysqlService.executeSelect
      .mockResolvedValueOnce([{ partner_count: 12 }] as never)
      .mockResolvedValueOnce([{ customer_count: 178 }] as never)
      .mockResolvedValueOnce([{ registration_count: 150 }] as never)
      .mockResolvedValueOnce([{ opportunity_count: 44, opportunity_amount: '264999' }] as never)
      .mockResolvedValueOnce([{ order_count: 2, order_amount: '45450' }] as never)
      .mockResolvedValueOnce([
        {
          registration_id: 'REG-001',
          customer_name: '山东未建商机客户',
          created_days: 41,
        },
      ] as never)
      .mockResolvedValueOnce([
        {
          opportunity_id: 'OPP-001',
          opportunity_name: '山东超期商机',
          amount: '180000',
          stale_days: 39,
        },
      ] as never)
      .mockResolvedValueOnce([{ registration_count: 150 }] as never)
      .mockResolvedValueOnce([{ opportunity_count: 44, opportunity_amount: '264999' }] as never)
      .mockResolvedValueOnce([{ quote_count: 17, quote_amount: '1661132.5' }] as never)
      .mockResolvedValueOnce([{ order_count: 2, order_amount: '45450' }] as never)
      .mockResolvedValueOnce([
        {
          quote_id: 'QT-001',
          customer_name: '山东报价未下单客户',
          amount: '108750',
          status: 'draft',
        },
      ] as never);

    const result = await fixture.service.tryExecute({
      questionText: '生成本月经营简报',
      channel: 'wecom-bot',
      user: {
        id: 'liulonghai',
        name: '刘龙海',
        roleIds: ['role_superadmin'],
        roleNames: ['超管'],
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        isAdmin: true,
        exportAllowed: true,
        channels: ['wecom-bot'],
      },
      intent: {
        domain: 'customer-relationship',
        metrics: [],
        dimensions: [],
        filters: {},
        missingConditions: [],
        confidence: 'HIGH',
      } as never,
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        scopeSummary: '全部数据范围',
        isFullAccess: true,
      },
    });

    expect(result?.slice.matchedAdapter).toBe('analysis-warehouse.fixed-business-briefing');
    expect(result?.slice.summary).toContain('经营概览、报备到订单转化漏斗、报价未下单风险');
    expect(result?.slice.metricCards).toEqual(
      expect.arrayContaining([
        { name: '合作伙伴数', value: 12 },
        { name: '客户商机报备数', value: 150 },
        { name: '有效订单金额', value: '4.54 万元' },
        { name: '有效订单转化率', value: '1.3%' },
        { name: '未下单报价数', value: 1 },
      ]),
    );
    expect(result?.slice.tableRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ section_name: '经营概览' }),
        expect.objectContaining({ section_name: '转化漏斗' }),
        expect.objectContaining({ section_name: '报价未下单风险' }),
      ]),
    );
    expect(result?.slice.secondaryViews.map((item) => item.title)).toEqual(
      expect.arrayContaining([
        '经营简报区块总览',
        '报备到订单转化漏斗',
        '有报价但未下单客户明细',
      ]),
    );
    expect(fixture.mysqlService.executeSelect).toHaveBeenCalledTimes(12);
    expect(fixture.aiGatewayService.generateAnalysisWarehouseQueryTask).not.toHaveBeenCalled();
  });

  it('渠道商新增和商机增长问法应拆成表格与趋势数据两个区块', async () => {
    const fixture = createFixture();
    fixture.mysqlService.executeSelect
      .mockResolvedValueOnce([
        { month_label: '2026-04', new_partner_count: 2 },
        { month_label: '2026-05', new_partner_count: 3 },
        { month_label: '2026-06', new_partner_count: 4 },
      ] as never)
      .mockResolvedValueOnce([
        { month_label: '2026-04', new_opportunity_count: 8, opportunity_amount: '80000' },
        { month_label: '2026-05', new_opportunity_count: 12, opportunity_amount: '120000' },
        { month_label: '2026-06', new_opportunity_count: 18, opportunity_amount: '180000' },
      ] as never);

    const result = await fixture.service.tryExecute({
      questionText: '最近3个月的渠道商新增情况、以及商机增长情况',
      channel: 'wecom-bot',
      user: {
        id: 'liulonghai',
        name: '刘龙海',
        roleIds: ['role_superadmin'],
        roleNames: ['超管'],
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        isAdmin: true,
        exportAllowed: true,
        channels: ['wecom-bot'],
      },
      intent: {
        domain: 'opportunity-analysis',
        metrics: [],
        dimensions: [],
        filters: {},
        missingConditions: [],
        confidence: 'HIGH',
      } as never,
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        scopeSummary: '全部数据范围',
        isFullAccess: true,
      },
    });

    expect(result?.slice.matchedAdapter).toBe('analysis-warehouse.fixed-partner-opportunity-growth');
    expect(result?.slice.summary).toContain('渠道商新增 9 家，商机新增 38 个');
    expect(result?.slice.temporalScope?.normalizedLabel).toBe('最近 3 个月');
    expect(result?.slice.metricCards).toEqual(
      expect.arrayContaining([
        { name: '新增渠道商数', value: 9 },
        { name: '新增商机数', value: 38 },
        { name: '新增商机金额', value: '38 万元' },
      ]),
    );
    expect(result?.slice.secondaryViews).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          viewType: 'DETAIL_TABLE',
          title: '渠道商新增情况（表格）',
        }),
        expect.objectContaining({
          viewType: 'LINE_CHART',
          title: '商机增长情况（趋势数据）',
        }),
      ]),
    );
    expect(fixture.mysqlService.executeSelect).toHaveBeenCalledTimes(2);
    expect(fixture.mysqlService.executeSelect).toHaveBeenCalledWith(
      expect.stringContaining('DATE_FORMAT(p.created_at'),
      expect.arrayContaining([expect.any(String), expect.any(String)]),
      5000,
    );
    expect(fixture.aiGatewayService.generateAnalysisWarehouseQueryTask).not.toHaveBeenCalled();
  });

  it('订单情况和商机情况问法应拆成两个独立分析区块', async () => {
    const fixture = createFixture();
    fixture.mysqlService.executeSelect
      .mockResolvedValueOnce([
        { month_label: '2025-07', order_count: 2, order_amount: '360000' },
        { month_label: '2025-08', order_count: 3, order_amount: '420000' },
      ] as never)
      .mockResolvedValueOnce([
        { month_label: '2025-07', opportunity_count: 8, opportunity_amount: '80000' },
        { month_label: '2025-08', opportunity_count: 12, opportunity_amount: '120000' },
      ] as never);

    const result = await fixture.service.tryExecute({
      questionText: '帮我分析一下最近一年全国的订单情况、商机情况。',
      channel: 'wecom-bot',
      user: {
        id: 'liulonghai',
        name: '刘龙海',
        roleIds: ['role_superadmin'],
        roleNames: ['超管'],
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        isAdmin: true,
        exportAllowed: true,
        channels: ['wecom-bot'],
      },
      intent: {
        domain: 'contract-conversion',
        metrics: [],
        dimensions: [],
        filters: {},
        missingConditions: [],
        confidence: 'HIGH',
        temporalSlot: {
          rawText: '最近一年',
          normalizedLabel: '最近一年',
          startAt: '2025-06-10T00:00:00+08:00',
          endAt: '2026-06-11T00:00:00+08:00',
          timezone: 'Asia/Shanghai',
          granularity: 'month',
          relativity: 'relative',
          inclusivity: {
            start: 'inclusive',
            end: 'exclusive',
          },
          confidence: 'HIGH',
        },
      } as never,
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        scopeSummary: '全部数据范围',
        isFullAccess: true,
      },
    });

    expect(result?.slice.matchedAdapter).toBe(
      'analysis-warehouse.fixed-order-opportunity-overview',
    );
    expect(result?.slice.taskTitle).toBe('订单与商机分块分析');
    expect(result?.slice.summary).toContain('已按两个区块完成分析');
    expect(result?.slice.summary).not.toContain('合同转化');
    expect(result?.slice.metricCards).toEqual(
      expect.arrayContaining([
        { name: '有效订单数量', value: 5 },
        { name: '有效订单金额', value: '78 万元' },
        { name: '商机数量', value: 20 },
        { name: '商机金额', value: '20 万元' },
      ]),
    );
    expect(result?.slice.secondaryViews).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          viewType: 'LINE_CHART',
          title: '订单情况（趋势/表格）',
        }),
        expect.objectContaining({
          viewType: 'LINE_CHART',
          title: '商机情况（趋势/表格）',
        }),
      ]),
    );
    expect(fixture.mysqlService.executeSelect).toHaveBeenCalledTimes(2);
    expect(fixture.aiGatewayService.generateAnalysisWarehouseQueryTask).not.toHaveBeenCalled();
  });

  it('复杂组合问法应拆成多个受控子任务并返回组合经营分析', async () => {
    const fixture = createFixture();
    fixture.mysqlService.executeSelect
      .mockResolvedValueOnce([{ partner_count: 12 }] as never)
      .mockResolvedValueOnce([{ customer_count: 178 }] as never)
      .mockResolvedValueOnce([{ registration_count: 150 }] as never)
      .mockResolvedValueOnce([{ opportunity_count: 44, opportunity_amount: '264999' }] as never)
      .mockResolvedValueOnce([{ order_count: 2, order_amount: '360000' }] as never)
      .mockResolvedValueOnce([
        {
          registration_id: 'REG-001',
          customer_name: '山东未建商机客户',
          created_days: 41,
        },
      ] as never)
      .mockResolvedValueOnce([
        {
          opportunity_id: 'OPP-001',
          opportunity_name: '山东超期商机',
          amount: '180000',
          stale_days: 39,
        },
      ] as never);

    const result = await fixture.service.tryExecute({
      questionText:
        '帮我统计汇总下今年山东区域合作伙伴客户、商机的报备情况和下单的情况，同时统计下，有多少客户是没有报备商机的，分别创建了多长时间。有哪些商机超过两个星期没有更新进展。',
      channel: 'wecom-bot',
      user: {
        id: 'liulonghai',
        name: '刘龙海',
        roleIds: ['role_superadmin'],
        roleNames: ['超管'],
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        isAdmin: true,
        exportAllowed: true,
        channels: ['wecom-bot'],
      },
      intent: {
        domain: 'customer-relationship',
        metrics: [],
        dimensions: [],
        filters: {},
        missingConditions: [],
        confidence: 'HIGH',
        temporalSlot: {
          rawText: '今年',
          normalizedLabel: '2026 年',
          startAt: '2026-01-01T00:00:00+08:00',
          endAt: '2027-01-01T00:00:00+08:00',
          timezone: 'Asia/Shanghai',
          granularity: 'year',
          relativity: 'relative',
          inclusivity: {
            start: 'inclusive',
            end: 'exclusive',
          },
          confidence: 'HIGH',
        },
      } as never,
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        scopeSummary: '全部数据范围',
        isFullAccess: true,
      },
    });

    expect(result?.slice.matchedAdapter).toBe('analysis-warehouse.fixed-composite-operations');
    expect(result?.slice.metricCards).toEqual(
      expect.arrayContaining([
        { name: '合作伙伴数', value: 12 },
        { name: '客户商机报备数', value: 150 },
        { name: '商机数', value: 44 },
        { name: '有效订单金额', value: '36 万元' },
      ]),
    );
    expect(result?.slice.appliedFilters).toEqual(
      expect.arrayContaining([{ label: '业务范围', value: '山东区' }]),
    );
    expect(result?.slice.secondaryViews.map((item) => item.title)).toEqual(
      expect.arrayContaining(['未关联商机的客户报备明细', '超过两周未更新商机明细']),
    );
    expect(fixture.mysqlService.executeSelect).toHaveBeenCalledTimes(7);
    expect(fixture.aiGatewayService.generateAnalysisWarehouseQueryTask).not.toHaveBeenCalled();
  });

  it('合作伙伴开拓、客户商机报备及订单情况问法应走组合经营模板而不是合同转化报告', async () => {
    const fixture = createFixture();
    fixture.mysqlService.executeSelect
      .mockResolvedValueOnce([{ partner_count: 12 }] as never)
      .mockResolvedValueOnce([{ customer_count: 178 }] as never)
      .mockResolvedValueOnce([{ registration_count: 150 }] as never)
      .mockResolvedValueOnce([{ opportunity_count: 44, opportunity_amount: '264999' }] as never)
      .mockResolvedValueOnce([{ order_count: 3, order_amount: '454500' }] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);

    const result = await fixture.service.tryExecute({
      questionText:
        '帮我查询分析下，公司当前的合作伙伴开拓情况、客户商机报备及订单情况，并且给出后续经营建议',
      channel: 'wecom-bot',
      user: {
        id: 'liulonghai',
        name: '刘龙海',
        roleIds: ['role_superadmin'],
        roleNames: ['超管'],
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        isAdmin: true,
        exportAllowed: true,
        channels: ['wecom-bot'],
      },
      intent: {
        domain: 'contract-conversion',
        metrics: ['转合同金额'],
        dimensions: ['渠道商'],
        filters: {},
        missingConditions: [],
        confidence: 'HIGH',
        resultKindHint: 'partner-contribution',
        businessIntentHint: {
          objectTypes: ['partner', 'customer', 'registration', 'opportunity', 'order'],
          metrics: ['partner_count', 'registration_count', 'opportunity_count', 'order_amount'],
          dimensions: ['partner'],
          analysisMode: 'summary_report',
          comparison: [],
          outputPreference: ['text_summary'],
          sourceResource: 'orders',
        },
      } as never,
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        scopeSummary: '全部数据范围',
        isFullAccess: true,
      },
    });

    expect(result?.slice.matchedAdapter).toBe('analysis-warehouse.fixed-composite-operations');
    expect(result?.slice.taskTitle).toBe('联软 CRM 组合经营分析');
    expect(result?.slice.summary).toContain('合作伙伴开拓 12 家');
    expect(result?.slice.summary).toContain('客户商机报备 150 条');
    expect(result?.slice.summary).toContain('有效订单 3 单');
    expect(result?.slice.summary).not.toContain('合同转化');
    expect(result?.slice.metricCards).toEqual(
      expect.arrayContaining([
        { name: '合作伙伴数', value: 12 },
        { name: '客户商机报备数', value: 150 },
        { name: '有效订单金额', value: '45.45 万元' },
      ]),
    );
    expect(fixture.aiGatewayService.generateAnalysisWarehouseQueryTask).not.toHaveBeenCalled();
  });

  it('关闭Text-to-SQL时仍应允许SQLite快照组合模板承接综合经营问法', async () => {
    process.env.ANALYSIS_WAREHOUSE_TEXT_TO_SQL_ENABLED = 'false';
    const lianruanCrmAnalysisExecutorService = {
      executeStaleOpportunityDetailTask: jest.fn(),
      fetchBusinessChainSnapshot: jest.fn(async () => ({
        sql: '-- 联软标准 OpenAPI 业务链真实明细临时快照\n-- GET /partners\n-- GET /registrations\n-- GET /opportunities\n-- GET /orders',
        scopeSummary: '全部数据范围',
        partners: [
          { id: 'P-REAL-001', name: '华东真实核心渠道商', createdAt: '2026-05-01T00:00:00.000Z' },
        ],
        registrations: [
          { id: 'R-REAL-001', customerId: 'C-REAL-001', customerName: '某银行总行', partnerId: 'P-REAL-001', createdAt: '2026-05-03T00:00:00.000Z' },
        ],
        opportunities: [
          { id: 'OPP-REAL-001', customerId: 'C-REAL-001', customerName: '某银行总行', partnerId: 'P-REAL-001', statusName: '草稿', amount: 200000, createdAt: '2026-05-04T00:00:00.000Z', updatedAt: '2000-01-01T00:00:00.000Z' },
        ],
        orders: [
          { id: 'ORD-REAL-001', customerId: 'C-REAL-001', customerName: '某银行总行', partnerId: 'P-REAL-001', amount: 310000, statusName: '已确认', dealAt: '2026-05-05T00:00:00.000Z' },
        ],
      })),
    };
    const fixture = createFixture({ lianruanCrmAnalysisExecutorService });
    fixture.sqliteSnapshotImporterService.isConfigured.mockReturnValue(true);
    fixture.sqliteSnapshotImporterService.importResource
      .mockResolvedValueOnce({
        resource: 'partners',
        tableName: 'partners',
        snapshotFile: 'crm_openapi_aiagent_sanitized_20260612075556.db',
        rows: [
          {
            payload: {
              id: 'P-SQLITE-001',
              name: 'SQLite测试服务商',
              createdAt: '2026-05-01T00:00:00.000Z',
            },
          },
        ],
        total: 1,
      } as never)
      .mockRejectedValueOnce(
        new Error('SQLite 快照中未找到资源 customers 对应的白名单表。'),
      )
      .mockResolvedValueOnce({
        resource: 'registrations',
        tableName: 'registrations',
        snapshotFile: 'crm_openapi_aiagent_sanitized_20260612075556.db',
        rows: [
          {
            payload: {
              id: 'R-SQLITE-001',
              customerId: 'C-SQLITE-001',
              customerName: 'SQLite测试客户',
              createdAt: '2026-05-03T00:00:00.000Z',
            },
          },
        ],
        total: 1,
      } as never)
      .mockResolvedValueOnce({
        resource: 'opportunities',
        tableName: 'opportunities',
        snapshotFile: 'crm_openapi_aiagent_sanitized_20260612075556.db',
        rows: [
          {
            payload: {
              id: 'OPP-SQLITE-001',
              customerId: 'C-SQLITE-001',
              customerName: 'SQLite测试客户',
              partnerName: 'SQLite测试服务商',
              status: 'draft',
              amount: 200000,
              createdAt: '2026-05-04T00:00:00.000Z',
              updatedAt: '2000-01-01T00:00:00.000Z',
            },
          },
        ],
        total: 1,
      } as never)
      .mockResolvedValueOnce({
        resource: 'orders',
        tableName: 'orders',
        snapshotFile: 'crm_openapi_aiagent_sanitized_20260612075556.db',
        rows: [
          {
            payload: {
              id: 'ORD-SQLITE-001',
              amount: 310000,
              status: 'confirmed',
              dealAt: '2026-05-05T00:00:00.000Z',
            },
          },
        ],
        total: 1,
      } as never);

    const result = await fixture.service.tryExecute({
      questionText:
        '帮我查询分析下，公司当前的合作伙伴开拓情况、客户商机报备及订单情况，并且给出后续经营建议',
      channel: 'wecom-bot',
      user: {
        id: 'liulonghai',
        name: '刘龙海',
        roleIds: ['role_superadmin'],
        roleNames: ['超管'],
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        isAdmin: true,
        exportAllowed: true,
        channels: ['wecom-bot'],
      },
      intent: {
        domain: 'contract-conversion',
        metrics: ['转合同金额'],
        dimensions: ['渠道商'],
        filters: {},
        missingConditions: [],
        confidence: 'HIGH',
        resultKindHint: 'partner-contribution',
        businessIntentHint: {
          objectTypes: ['partner', 'customer', 'registration', 'opportunity', 'order'],
          metrics: ['partner_count', 'registration_count', 'opportunity_count', 'order_amount'],
          dimensions: ['partner'],
          analysisMode: 'summary_report',
          comparison: [],
          outputPreference: ['text_summary'],
          sourceResource: 'orders',
        },
      } as never,
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        scopeSummary: '全部数据范围',
        isFullAccess: true,
      },
    });

    expect(result?.slice.matchedAdapter).toBe('sqlite-snapshot.fixed-composite-operations.openapi-detail');
    expect(result?.slice.taskTitle).toBe('联软 CRM 组合经营分析');
    expect(result?.slice.summary).toContain('合作伙伴开拓 1 家');
    expect(result?.slice.summary).toContain('客户商机报备 1 条');
    expect(result?.slice.summary).toContain('有效订单 1 单');
    expect(result?.slice.summary).not.toContain('合同转化');
    expect(result?.sql).toContain('联软标准 OpenAPI 业务链真实明细临时快照');
    expect(result?.tables).toEqual(
      expect.arrayContaining(['openapi:/partners', 'openapi:/registrations', 'openapi:/opportunities', 'openapi:/orders']),
    );
    expect(JSON.stringify(result?.slice)).not.toContain('SQLite测试服务商');
    expect(JSON.stringify(result?.slice)).not.toContain('SQLite测试客户');
    expect(lianruanCrmAnalysisExecutorService.fetchBusinessChainSnapshot).toHaveBeenCalled();
    expect(fixture.mysqlService.executeSelect).not.toHaveBeenCalled();
    expect(fixture.sqlGuardService.validateAndNormalize).not.toHaveBeenCalled();
    expect(fixture.aiGatewayService.generateAnalysisWarehouseQueryTask).not.toHaveBeenCalled();
  });

  it('只问全部商机情况时应默认输出商机整体和渠道商维度', async () => {
    const lianruanCrmAnalysisExecutorService = {
      executeStaleOpportunityDetailTask: jest.fn(),
      fetchBusinessChainSnapshot: jest.fn(async () => ({
        sql: '-- 联软标准 OpenAPI 业务链真实明细临时快照\n-- GET /partners\n-- GET /opportunities',
        scopeSummary: '全部数据范围',
        partners: [
          { id: 'P-REAL-001', name: '华东真实核心渠道商' },
          { id: 'P-REAL-002', name: '华南真实核心渠道商' },
        ],
        registrations: [],
        opportunities: [
          {
            id: 'OPP-REAL-001',
            name: '某银行零信任一期商机',
            customerName: '某银行总行',
            partnerId: 'P-REAL-001',
            ownerName: '张三',
            stage: 'registered',
            amount: 500000,
            createdAt: '2026-05-01T00:00:00.000Z',
          },
          {
            id: 'OPP-REAL-002',
            name: '某制造集团终端准入扩容商机',
            customerName: '某制造集团',
            partnerId: 'P-REAL-002',
            ownerName: '李四',
            stage: 'quoted',
            amount: 300000,
            createdAt: '2026-05-02T00:00:00.000Z',
          },
        ],
        orders: [],
      })),
    };
    const fixture = createFixture({ lianruanCrmAnalysisExecutorService });
    fixture.mysqlService.isConfigured.mockReturnValue(false);
    fixture.sqliteSnapshotImporterService.isConfigured.mockReturnValue(true);
    fixture.sqliteSnapshotImporterService.importResource
      .mockResolvedValueOnce({
        resource: 'opportunities',
        tableName: 'opportunities',
        snapshotFile: 'crm_openapi_aiagent_sanitized_20260612075556.db',
        rows: [
          {
            payload: {
              id: 'OPP-001',
              name: '客户001项目001',
              customerName: '客户001',
              partnerId: 'P-001',
              partnerName: '渠道商001',
              ownerName: '用户001',
              stage: 'contacted',
              amount: 500000,
              createdAt: '2026-05-01T00:00:00.000Z',
            },
          },
          {
            payload: {
              id: 'OPP-002',
              name: '客户002项目002',
              customerName: '客户002',
              partnerId: 'P-002',
              partnerName: '渠道商002',
              ownerName: '用户002',
              stage: 'registered',
              amount: 300000,
              createdAt: '2026-05-02T00:00:00.000Z',
            },
          },
        ],
      } as never)
      .mockResolvedValueOnce({
        resource: 'partners',
        tableName: 'partners',
        snapshotFile: 'crm_openapi_aiagent_sanitized_20260612075556.db',
        rows: [
          { payload: { id: 'P-001', name: '渠道商001' } },
          { payload: { id: 'P-002', name: '渠道商002' } },
        ],
      } as never);

    const result = await fixture.service.tryExecute({
      questionText: '帮我分析一下全部的商机情况',
      channel: 'wecom-bot',
      user: {
        id: 'liulonghai',
        name: '刘龙海',
        roleIds: ['role_superadmin'],
        roleNames: ['超管'],
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        isAdmin: true,
        exportAllowed: true,
        channels: ['wecom-bot'],
      },
      intent: {
        domain: 'opportunity-analysis',
        metrics: ['商机数量'],
        dimensions: [],
        filters: {},
        missingConditions: [],
        confidence: 'HIGH',
      } as never,
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        scopeSummary: '全部数据范围',
        isFullAccess: true,
      },
    });

    expect(result?.slice.matchedAdapter).toBe('sqlite-snapshot.fixed-opportunity-partner-overview.openapi-detail');
    expect(result?.slice.taskTitle).toBe('商机与渠道商经营总览');
    expect(result?.slice.summary).toContain('商机 2 条');
    expect(result?.slice.summary).toContain('关联渠道商 2 家');
    expect(result?.sql).toContain('联软标准 OpenAPI 业务链真实明细临时快照');
    expect(result?.tables).toEqual(expect.arrayContaining(['openapi:/partners', 'openapi:/opportunities']));
    expect(result?.slice.secondaryViews.map((item) => item.title)).toEqual(
      expect.arrayContaining(['商机渠道商贡献', '商机阶段分布', '重点商机明细']),
    );
    expect(result?.slice.tableRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          partner_name: '华东真实核心渠道商',
          opportunity_count: 1,
          opportunity_amount: 500000,
        }),
      ]),
    );
    const detailRows = result?.slice.secondaryViews.find((item) => item.title === '重点商机明细')?.rows ?? [];
    const stageRows = result?.slice.secondaryViews.find((item) => item.title === '商机阶段分布')?.rows ?? [];
    expect(stageRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stage_name: '20%已登记/已报备' }),
        expect.objectContaining({ stage_name: '50%已报价' }),
      ]),
    );
    expect(detailRows).toEqual([
      expect.objectContaining({
        opportunity_name: '某银行零信任一期商机',
        customer_name: '某银行总行',
        partner_name: '华东真实核心渠道商',
        owner_name: '张三',
        stage_name: '20%已登记/已报备',
      }),
      expect.objectContaining({
        opportunity_name: '某制造集团终端准入扩容商机',
        customer_name: '某制造集团',
        partner_name: '华南真实核心渠道商',
        owner_name: '李四',
        stage_name: '50%已报价',
      }),
    ]);
    expect(JSON.stringify(result?.slice)).not.toContain('渠道商001');
    expect(JSON.stringify(result?.slice)).not.toContain('客户001');
    expect(JSON.stringify(result?.slice)).not.toContain('用户001');
    expect(lianruanCrmAnalysisExecutorService.fetchBusinessChainSnapshot).toHaveBeenCalled();
    expect(fixture.mysqlService.executeSelect).not.toHaveBeenCalled();
    expect(fixture.aiGatewayService.generateAnalysisWarehouseQueryTask).not.toHaveBeenCalled();
  });

  it('只问渠道商经营情况时应拉通客户报备、商机和订单', async () => {
    const lianruanCrmAnalysisExecutorService = {
      executeStaleOpportunityDetailTask: jest.fn(),
      fetchBusinessChainSnapshot: jest.fn(async () => ({
        sql: '-- 联软标准 OpenAPI 业务链真实明细临时快照\n-- GET /partners\n-- GET /registrations\n-- GET /opportunities\n-- GET /orders',
        scopeSummary: '全部数据范围',
        partners: [{ id: 'P-REAL-001', name: '华东真实核心渠道商' }],
        registrations: [
          { id: 'REG-REAL-001', customerName: '某银行总行', partnerId: 'P-REAL-001', createdAt: '2026-05-01T00:00:00.000Z' },
        ],
        opportunities: [
          { id: 'OPP-REAL-001', customerName: '某银行总行', partnerId: 'P-REAL-001', amount: 600000, stageName: '方案沟通', createdAt: '2026-05-02T00:00:00.000Z' },
        ],
        orders: [
          { id: 'ORD-REAL-001', customerName: '某银行总行', partnerId: 'P-REAL-001', amount: 260000, statusName: '已确认', dealAt: '2026-05-03T00:00:00.000Z' },
        ],
      })),
    };
    const fixture = createFixture({ lianruanCrmAnalysisExecutorService });
    fixture.mysqlService.isConfigured.mockReturnValue(false);
    fixture.sqliteSnapshotImporterService.isConfigured.mockReturnValue(true);
    fixture.sqliteSnapshotImporterService.importResource
      .mockResolvedValueOnce({
        resource: 'partners',
        tableName: 'partners',
        snapshotFile: 'crm_openapi_aiagent_sanitized_20260612075556.db',
        rows: [{ payload: { id: 'P-001', name: '华东核心渠道商' } }],
      } as never)
      .mockResolvedValueOnce({
        resource: 'registrations',
        tableName: 'registrations',
        snapshotFile: 'crm_openapi_aiagent_sanitized_20260612075556.db',
        rows: [{ payload: { id: 'REG-001', partnerId: 'P-001', createdAt: '2026-05-01T00:00:00.000Z' } }],
      } as never)
      .mockResolvedValueOnce({
        resource: 'opportunities',
        tableName: 'opportunities',
        snapshotFile: 'crm_openapi_aiagent_sanitized_20260612075556.db',
        rows: [{ payload: { id: 'OPP-001', partnerId: 'P-001', amount: 600000, createdAt: '2026-05-02T00:00:00.000Z' } }],
      } as never)
      .mockResolvedValueOnce({
        resource: 'orders',
        tableName: 'orders',
        snapshotFile: 'crm_openapi_aiagent_sanitized_20260612075556.db',
        rows: [{ payload: { id: 'ORD-001', partnerId: 'P-001', amount: 260000, status: 'confirmed', dealAt: '2026-05-03T00:00:00.000Z' } }],
      } as never);

    const result = await fixture.service.tryExecute({
      questionText: '帮我分析一下渠道商经营情况',
      channel: 'wecom-bot',
      user: {
        id: 'liulonghai',
        name: '刘龙海',
        roleIds: ['role_superadmin'],
        roleNames: ['超管'],
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        isAdmin: true,
        exportAllowed: true,
        channels: ['wecom-bot'],
      },
      intent: {
        domain: 'customer-relationship',
        metrics: [],
        dimensions: ['渠道商'],
        filters: {},
        missingConditions: [],
        confidence: 'HIGH',
      } as never,
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        scopeSummary: '全部数据范围',
        isFullAccess: true,
      },
    });

    expect(result?.slice.matchedAdapter).toBe('sqlite-snapshot.fixed-partner-business-chain.openapi-detail');
    expect(result?.slice.summary).toContain('客户报备 1 条、商机 1 条、有效订单 1 单');
    expect(result?.slice.tableRows).toEqual([
      expect.objectContaining({
        partner_name: '华东真实核心渠道商',
        registration_count: 1,
        opportunity_count: 1,
        order_count: 1,
        order_amount: 260000,
      }),
    ]);
    expect(result?.tables).toEqual(
      expect.arrayContaining(['openapi:/partners', 'openapi:/registrations', 'openapi:/opportunities', 'openapi:/orders']),
    );
    expect(lianruanCrmAnalysisExecutorService.fetchBusinessChainSnapshot).toHaveBeenCalled();
    expect(fixture.mysqlService.executeSelect).not.toHaveBeenCalled();
    expect(fixture.aiGatewayService.generateAnalysisWarehouseQueryTask).not.toHaveBeenCalled();
  });

  it('只问客户报备情况时应默认带渠道商和关联商机情况', async () => {
    const lianruanCrmAnalysisExecutorService = {
      executeStaleOpportunityDetailTask: jest.fn(),
      fetchBusinessChainSnapshot: jest.fn(async () => ({
        sql: '-- 联软标准 OpenAPI 业务链真实明细临时快照\n-- GET /partners\n-- GET /registrations\n-- GET /opportunities',
        scopeSummary: '全部数据范围',
        partners: [{ id: 'P-REAL-001', name: '华东真实核心渠道商' }],
        registrations: [
          { id: 'REG-REAL-001', customerId: 'C-REAL-001', customerName: '某银行总行', partnerId: 'P-REAL-001', statusName: '已通过', createdAt: '2026-05-01T00:00:00.000Z' },
          { id: 'REG-REAL-002', customerId: 'C-REAL-002', customerName: '某制造集团', partnerId: 'P-REAL-001', statusName: '已通过', createdAt: '2026-05-02T00:00:00.000Z' },
        ],
        opportunities: [
          { id: 'OPP-REAL-001', registrationId: 'REG-REAL-001', customerId: 'C-REAL-001', partnerId: 'P-REAL-001', amount: 600000 },
        ],
        orders: [],
      })),
    };
    const fixture = createFixture({ lianruanCrmAnalysisExecutorService });
    fixture.mysqlService.isConfigured.mockReturnValue(false);
    fixture.sqliteSnapshotImporterService.isConfigured.mockReturnValue(true);
    fixture.sqliteSnapshotImporterService.importResource
      .mockResolvedValueOnce({
        resource: 'registrations',
        tableName: 'registrations',
        snapshotFile: 'crm_openapi_aiagent_sanitized_20260612075556.db',
        rows: [
          { payload: { id: 'REG-001', customerId: 'C-001', customerName: '测试客户A', partnerId: 'P-001', createdAt: '2026-05-01T00:00:00.000Z' } },
          { payload: { id: 'REG-002', customerId: 'C-002', customerName: '测试客户B', partnerId: 'P-001', createdAt: '2026-05-02T00:00:00.000Z' } },
        ],
      } as never)
      .mockResolvedValueOnce({
        resource: 'opportunities',
        tableName: 'opportunities',
        snapshotFile: 'crm_openapi_aiagent_sanitized_20260612075556.db',
        rows: [{ payload: { id: 'OPP-001', registrationId: 'REG-001', customerId: 'C-001', partnerId: 'P-001' } }],
      } as never)
      .mockResolvedValueOnce({
        resource: 'partners',
        tableName: 'partners',
        snapshotFile: 'crm_openapi_aiagent_sanitized_20260612075556.db',
        rows: [{ payload: { id: 'P-001', name: '华东核心渠道商' } }],
      } as never);

    const result = await fixture.service.tryExecute({
      questionText: '帮我分析一下客户报备情况',
      channel: 'wecom-bot',
      user: {
        id: 'liulonghai',
        name: '刘龙海',
        roleIds: ['role_superadmin'],
        roleNames: ['超管'],
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        isAdmin: true,
        exportAllowed: true,
        channels: ['wecom-bot'],
      },
      intent: {
        domain: 'customer-relationship',
        metrics: [],
        dimensions: [],
        filters: {},
        missingConditions: [],
        confidence: 'HIGH',
      } as never,
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        scopeSummary: '全部数据范围',
        isFullAccess: true,
      },
    });

    expect(result?.slice.matchedAdapter).toBe('sqlite-snapshot.fixed-registration-partner-overview.openapi-detail');
    expect(result?.slice.summary).toContain('客户报备 2 条');
    expect(result?.slice.summary).toContain('已关联商机 1 条、未关联商机 1 条');
    expect(result?.slice.tableRows).toEqual([
      expect.objectContaining({
        partner_name: '华东真实核心渠道商',
        registration_count: 2,
        linked_opportunity_count: 1,
        unlinked_registration_count: 1,
      }),
    ]);
    expect(result?.slice.secondaryViews.map((item) => item.title)).toContain('未关联商机的客户报备明细');
    const detailRows = result?.slice.secondaryViews.find((item) => item.title === '客户报备明细')?.rows ?? [];
    expect(detailRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          customer_name: '某银行总行',
          partner_name: '华东真实核心渠道商',
        }),
        expect.objectContaining({
          customer_name: '某制造集团',
          partner_name: '华东真实核心渠道商',
        }),
      ]),
    );
    expect(JSON.stringify(result?.slice)).not.toContain('渠道商001');
    expect(JSON.stringify(result?.slice)).not.toContain('测试客户A');
    expect(lianruanCrmAnalysisExecutorService.fetchBusinessChainSnapshot).toHaveBeenCalled();
    expect(fixture.mysqlService.executeSelect).not.toHaveBeenCalled();
    expect(fixture.aiGatewayService.generateAnalysisWarehouseQueryTask).not.toHaveBeenCalled();
  });

  it('只问订单情况时应默认输出订单整体和渠道商贡献', async () => {
    const lianruanCrmAnalysisExecutorService = {
      executeStaleOpportunityDetailTask: jest.fn(),
      fetchBusinessChainSnapshot: jest.fn(async () => ({
        sql: '-- 联软标准 OpenAPI 业务链真实明细临时快照\n-- GET /partners\n-- GET /orders',
        scopeSummary: '全部数据范围',
        partners: [{ id: 'P-REAL-001', name: '华东真实核心渠道商' }],
        registrations: [],
        opportunities: [],
        orders: [
          { id: 'ORD-REAL-001', customerName: '某银行总行', partnerId: 'P-REAL-001', amount: 360000, statusName: '已确认', dealAt: '2026-05-03T00:00:00.000Z' },
          { id: 'ORD-REAL-002', customerName: '某制造集团', partnerId: 'P-REAL-002', amount: 100000, status: 'cancelled', dealAt: '2026-05-04T00:00:00.000Z' },
        ],
      })),
    };
    const fixture = createFixture({ lianruanCrmAnalysisExecutorService });
    fixture.mysqlService.isConfigured.mockReturnValue(false);
    fixture.sqliteSnapshotImporterService.isConfigured.mockReturnValue(true);
    fixture.sqliteSnapshotImporterService.importResource
      .mockResolvedValueOnce({
        resource: 'orders',
        tableName: 'orders',
        snapshotFile: 'crm_openapi_aiagent_sanitized_20260612075556.db',
        rows: [
          { payload: { id: 'ORD-001', customerName: '测试客户A', partnerId: 'P-001', amount: 360000, status: 'confirmed', dealAt: '2026-05-03T00:00:00.000Z' } },
          { payload: { id: 'ORD-002', customerName: '测试客户B', partnerId: 'P-002', amount: 100000, status: 'cancelled', dealAt: '2026-05-04T00:00:00.000Z' } },
        ],
      } as never)
      .mockResolvedValueOnce({
        resource: 'partners',
        tableName: 'partners',
        snapshotFile: 'crm_openapi_aiagent_sanitized_20260612075556.db',
        rows: [{ payload: { id: 'P-001', name: '华东核心渠道商' } }],
      } as never);

    const result = await fixture.service.tryExecute({
      questionText: '帮我分析一下订单情况',
      channel: 'wecom-bot',
      user: {
        id: 'liulonghai',
        name: '刘龙海',
        roleIds: ['role_superadmin'],
        roleNames: ['超管'],
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        isAdmin: true,
        exportAllowed: true,
        channels: ['wecom-bot'],
      },
      intent: {
        domain: 'contract-conversion',
        metrics: ['转合同金额'],
        dimensions: [],
        filters: {},
        missingConditions: [],
        confidence: 'HIGH',
      } as never,
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        scopeSummary: '全部数据范围',
        isFullAccess: true,
      },
    });

    expect(result?.slice.matchedAdapter).toBe('sqlite-snapshot.fixed-order-partner-overview.openapi-detail');
    expect(result?.slice.summary).toContain('有效订单 1 单');
    expect(result?.slice.summary).toContain('订单金额 36 万元');
    expect(result?.slice.tableRows).toEqual([
      expect.objectContaining({
        partner_name: '华东真实核心渠道商',
        order_count: 1,
        order_amount: 360000,
      }),
    ]);
    expect(result?.slice.secondaryViews.map((item) => item.title)).toContain('订单明细');
    const orderDetailRows = result?.slice.secondaryViews.find((item) => item.title === '订单明细')?.rows ?? [];
    expect(orderDetailRows).toEqual([
      expect.objectContaining({
        order_id: 'ORD-REAL-001',
        customer_name: '某银行总行',
        partner_name: '华东真实核心渠道商',
        order_amount: 360000,
      }),
    ]);
    expect(JSON.stringify(result?.slice)).not.toContain('测试客户A');
    expect(JSON.stringify(result?.slice)).not.toContain('渠道商001');
    expect(lianruanCrmAnalysisExecutorService.fetchBusinessChainSnapshot).toHaveBeenCalled();
    expect(fixture.mysqlService.executeSelect).not.toHaveBeenCalled();
    expect(fixture.aiGatewayService.generateAnalysisWarehouseQueryTask).not.toHaveBeenCalled();
  });

  it('SQLite-only模式下未命中快照模板时不应继续探测MySQL分析库', async () => {
    process.env.ANALYSIS_WAREHOUSE_SQLITE_ONLY = 'true';
    const fixture = createFixture();
    fixture.sqliteSnapshotImporterService.isConfigured.mockReturnValue(false);

    const result = await fixture.service.tryExecute({
      questionText: '随便看一下经营情况',
      channel: 'wecom-bot',
      user: {
        id: 'liulonghai',
        name: '刘龙海',
        roleIds: ['role_superadmin'],
        roleNames: ['超管'],
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        isAdmin: true,
        exportAllowed: true,
        channels: ['wecom-bot'],
      },
      intent: {
        domain: 'opportunity-analysis',
        metrics: [],
        dimensions: [],
        filters: {},
        missingConditions: [],
        confidence: 'HIGH',
      } as never,
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        scopeSummary: '全部数据范围',
        isFullAccess: true,
      },
    });

    expect(result).toBeNull();
    expect(fixture.mysqlService.isConfigured).not.toHaveBeenCalled();
    expect(fixture.mysqlService.executeSelect).not.toHaveBeenCalled();
    expect(fixture.aiGatewayService.generateAnalysisWarehouseQueryTask).not.toHaveBeenCalled();
  });

  it('四类角色权限提示应按联软期望口径注入全量、区域、渠道和本人范围', async () => {
    const cases = [
      {
        userId: 'liulonghai',
        hint: {
          userId: 'A030',
          username: 'liulonghai',
          roleCode: 'superadmin',
          permissionScopeType: 'all',
          permissionRegions: [],
          permissionBigRegions: [],
          permissionPartnerIds: ['P001', 'P002'],
          permissionUserIds: ['A030'],
        },
        expectedParams: [],
        expectedSql: 'FROM fact_lianruan_order o',
      },
      {
        userId: 'admin_sd',
        hint: {
          userId: 'A013',
          username: 'admin_sd',
          roleCode: 'admin',
          permissionScopeType: 'region',
          permissionRegions: ['山东区'],
          permissionBigRegions: ['大北区'],
          permissionPartnerIds: ['P001', 'P002'],
          permissionUserIds: ['A013'],
        },
        expectedParams: ['山东区', '大北区'],
        expectedSql: 'o.big_region IN (?)',
      },
      {
        userId: 'liangcui',
        hint: {
          userId: 'PA001',
          username: 'liangcui',
          roleCode: 'partner_admin',
          permissionScopeType: 'partner',
          region: '山东区',
          bigRegion: '大北区',
          partnerId: 'P001',
          partnerName: '山东诚卓信息技术有限公司',
          permissionRegions: ['山东区'],
          permissionBigRegions: ['大北区'],
          permissionPartnerIds: ['P001'],
          permissionUserIds: ['S003', 'S004', 'PA001'],
        },
        expectedParams: ['P001', 'P001', 'P001'],
        expectedSql: 'o.parent_partner_id IN (?)',
      },
      {
        userId: 'S022',
        hint: {
          userId: 'S022',
          username: 'shangxichao',
          roleCode: 'staff',
          permissionScopeType: 'user',
          region: '山东区',
          bigRegion: '大北区',
          partnerId: 'P002',
          partnerName: '山东华安赛服智能科技有限公司',
          permissionRegions: ['山东区'],
          permissionBigRegions: ['大北区'],
          permissionPartnerIds: ['P002'],
          permissionUserIds: ['S022'],
        },
        expectedParams: ['S022', 'S022'],
        expectedSql: 'o.assigned_staff_id IN (?)',
      },
    ];

    for (const regressionCase of cases) {
      const fixture = createFixture();
      fixture.mysqlService.getUserScopeHint.mockResolvedValueOnce(regressionCase.hint);
      fixture.mysqlService.executeSelect.mockResolvedValueOnce([] as never);

      await fixture.service.tryExecute({
        questionText: '订单金额是多少',
        channel: 'wecom-bot',
        user: {
          id: regressionCase.userId,
          name: regressionCase.userId,
          roleIds: [],
          roleNames: [],
          organizationIds: [],
          departmentIds: [],
          ownerIds: [],
          isAdmin: false,
          exportAllowed: false,
          channels: ['wecom-bot'],
        },
        intent: {
          domain: 'contract-conversion',
          metrics: [],
          dimensions: [],
          filters: {},
          missingConditions: [],
          confidence: 'HIGH',
        } as never,
        scopeSnapshot: {
          organizationIds: [],
          departmentIds: [],
          ownerIds: [],
          scopeSummary: '联软权限回归',
        },
      });

      expect(fixture.mysqlService.executeSelect).toHaveBeenCalledWith(
        expect.stringContaining(regressionCase.expectedSql),
        regressionCase.expectedParams,
        5000,
      );
    }
  });

  it('非全量角色遇到无法安全注入的复杂 AI SQL 时应回退旧链路', async () => {
    const fixture = createFixture();
    fixture.aiGatewayService.generateAnalysisWarehouseQueryTask.mockResolvedValueOnce({
      taskTitle: '复杂查询',
      resultKind: 'summary',
      sql: 'SELECT COUNT(*) AS total_count FROM (SELECT opportunity_id FROM fact_lianruan_opportunity) t',
      rowLimit: 100,
      timeoutMs: 3000,
    } as never);

    const result = await fixture.service.tryExecute({
      questionText: '统计复杂商机查询',
      channel: 'wecom-bot',
      user: {
        id: 'S001',
        name: '销售员工',
        roleIds: ['role_sales'],
        roleNames: ['销售'],
        organizationIds: [],
        departmentIds: [],
        ownerIds: ['S001'],
        isAdmin: false,
        exportAllowed: false,
        channels: ['wecom-bot'],
      },
      intent: {
        domain: 'opportunity-analysis',
        metrics: [],
        dimensions: [],
        filters: {},
        missingConditions: [],
        confidence: 'HIGH',
      } as never,
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: ['S001'],
        scopeSummary: '本人范围',
      },
    });

    expect(result).toBeNull();
    expect(fixture.mysqlService.executeSelect).not.toHaveBeenCalled();
    expect(fixture.logger.logStep).toHaveBeenCalledWith(
      '分析库 AI SQL 未能安全注入行级权限，已停止本次离线诊断 SQL 执行。',
      expect.any(Object),
    );
  });
});

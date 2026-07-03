import { OfficialApiFallbackToSqlError } from '../../../src/modules/analysis/analysis.errors';
import { LianruanCrmAnalysisExecutorService } from '../../../src/modules/analysis/lianruan-crm-analysis-executor.service';

describe('LianruanCrmAnalysisExecutorService', () => {
  it.skip('历史实时 OpenAPI 路线已停用：客户生命周期统计接口分析未报备商机客户创建时长', async () => {
    const getCustomerLifecycleAnalytics = jest.fn(async () => ({
      totalCount: 20,
      idleCount: 3,
      noRegistrationCount: 6,
      noOpportunityCount: 8,
      noQuoteCount: 10,
      noOrderCount: 12,
      byAgeBucket: [
        { value: '0-30', count: 2 },
        { value: '180+', count: 4 },
      ],
    }));
    const getCustomerUnregisteredOpportunityAnalytics = jest.fn(async () => ({
      noRegistrationCount: 6,
      noOpportunityCount: 8,
      noQuoteCount: 10,
      noOrderCount: 12,
      noRegistrationByAgeBucket: [
        { value: '0-30', count: 2 },
        { value: '180+', count: 4 },
      ],
      samples: [
        {
          id: 'CUS001',
          customerId: 'CUS001',
          name: '山东测试客户',
          ageBucket: '180+',
          hasRegistration: false,
          hasOpportunity: false,
          hasOrder: false,
          ownerName: '刘龙海',
          region: '山东区',
        },
      ],
    }));
    const service = new LianruanCrmAnalysisExecutorService(
      {
        isEnabled: jest.fn(() => true),
        getBootstrapSnapshot: jest.fn(async () => ({
          context: {
            client: {
              id: 'client_superadmin',
              name: 'AI-agent-superadmin-sit',
              boundUserId: 'A030',
              status: 'active',
              allowedResources: ['customers'],
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
            customerStatuses: [
              { value: 'registered', label: '已报备' },
              { value: 'ordered', label: '已下单' },
            ],
          },
        })),
      } as never,
      {
        getCustomerLifecycleAnalytics,
        getCustomerUnregisteredOpportunityAnalytics,
      } as never,
    );

    const result = await service.executeTask(
      '有多少客户是没有报备商机的，分别创建了多长时间',
      {
        id: 'A030',
        name: '刘龙海',
      } as never,
      '全部权限',
      {
        taskId: 'task_customer_lifecycle_001',
        taskTitle: '客户生命周期分类分布',
        purpose: 'primary-summary',
        required: true,
        reportSection: 'detail-table',
        sql: 'SELECT ...',
        params: [],
        tables: ['customers'],
        fieldMap: {
          customers: ['id', 'createdAt', 'ageBucket', 'hasRegistration', 'hasOpportunity'],
        },
        joinPaths: [],
        allowedFunctions: ['COUNT'],
        resultKind: 'category-distribution',
        rowLimit: 100,
        timeoutMs: 3000,
        executionMode: 'PLAN_EXECUTION',
        executionSource: 'CRM_OFFICIAL_API',
        preferredSource: 'CRM_OFFICIAL_API',
        matchedAdapter: 'crm-official-api.customer-category-distribution',
        gapReason: '',
        toolSpec: {
          toolId: 'crm-official-api.customer-category-distribution',
          toolType: 'CRM_OFFICIAL_API',
          allowedStatements: ['CRM_API_GET'],
          allowedTables: ['customers'],
          allowedFields: { customers: ['id', 'createdAt', 'ageBucket'] },
          allowedFunctions: [],
          outputShape: 'DATASET_SLICE',
          rowLimit: 100,
          timeoutMs: 3000,
        },
        plan: {
          type: 'query-plan',
          domain: 'customer-relationship',
          baseTable: 'customers',
          joinTables: [],
          metrics: ['客户贡献度'],
          dimensions: ['客户分类'],
          filters: {},
          groupBy: ['category'],
          orderBy: [{ field: 'count', direction: 'DESC' }],
          resultKind: 'category-distribution',
          confidence: 'HIGH',
        },
      } as never,
    );

    expect(getCustomerUnregisteredOpportunityAnalytics).toHaveBeenCalledTimes(1);
    expect(result.summary).toContain('未报备客户 6 个');
    expect(result.metricCards).toEqual(
      expect.arrayContaining([
        { name: '客户总数', value: 20 },
        { name: '未报备客户', value: 6 },
        { name: '未建商机客户', value: 8 },
      ]),
    );
    expect(result.tableRows).toEqual([
      expect.objectContaining({
        ownerName: '创建 0-30 天',
        count: 2,
      }),
      expect.objectContaining({
        ownerName: '创建 180 天以上',
        count: 4,
      }),
    ]);
    expect(result.sql).toContain('/analytics/customers/unregistered-opportunity');
  });

  it.skip('历史实时 OpenAPI 路线已停用：商机列表聚合负责人排名结果', async () => {
    const service = new LianruanCrmAnalysisExecutorService(
      {
        isEnabled: jest.fn(() => true),
        getBootstrapSnapshot: jest.fn(async () => ({
          context: {
            client: {
              id: 'client_superadmin',
              name: 'AI-agent-superadmin-sit',
              boundUserId: 'A030',
              status: 'active',
              allowedResources: ['opportunities'],
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
            opportunityStages: [
              { value: 'contacted', label: '初访' },
              { value: 'proposal', label: '方案' },
            ],
          },
        })),
      } as never,
      {
        listByResource: jest.fn().mockResolvedValue({
          items: [
            {
              id: 'OPP001',
              name: '项目A',
              amount: 1000000,
              stage: 'contacted',
              assignedStaffId: 'A031',
              assignedStaffName: '王小红',
              region: '山东区',
              createdAt: '2026-06-01T09:00:00.000Z',
            },
            {
              id: 'OPP002',
              name: '项目B',
              amount: 300000,
              stage: 'proposal',
              assignedStaffId: 'A031',
              assignedStaffName: '王小红',
              region: '山东区',
              createdAt: '2026-06-02T09:00:00.000Z',
            },
            {
              id: 'OPP003',
              name: '项目C',
              amount: 500000,
              stage: 'contacted',
              assignedStaffId: 'A032',
              assignedStaffName: '赵小明',
              region: '华北区',
              createdAt: '2026-06-03T09:00:00.000Z',
            },
          ],
          pageNo: 1,
          pageSize: 200,
          total: 3,
        }),
      } as never,
    );

    const result = await service.executeTask(
      '山东区最近商机负责人排名',
      {
        id: 'A030',
        name: '刘龙海',
      } as never,
      '全部权限',
      {
        taskId: 'task_001',
        taskTitle: '商机负责人排名',
        purpose: 'primary-summary',
        required: true,
        reportSection: 'summary',
        sql: 'SELECT ...',
        params: [],
        tables: ['opportunities', 'users'],
        fieldMap: {
          opportunities: ['id', 'amount', 'created_at', 'assigned_staff_id'],
        },
        joinPaths: [],
        allowedFunctions: ['SUM', 'COUNT'],
        resultKind: 'owner-ranking',
        rowLimit: 100,
        timeoutMs: 3000,
        executionMode: 'PLAN_EXECUTION',
        executionSource: 'CRM_OFFICIAL_API',
        preferredSource: 'CRM_OFFICIAL_API',
        matchedAdapter: 'crm-official-api.opportunity-owner-ranking',
        gapReason: '',
        toolSpec: {
          toolId: 'crm-official-api.opportunity-owner-ranking',
          toolType: 'CRM_OFFICIAL_API',
          allowedStatements: ['CRM_API_GET'],
          allowedTables: ['opportunities'],
          allowedFields: { opportunities: ['id', 'amount'] },
          allowedFunctions: [],
          outputShape: 'DATASET_SLICE',
          rowLimit: 100,
          timeoutMs: 3000,
        },
        plan: {
          type: 'query-plan',
          domain: 'opportunity-analysis',
          baseTable: 'opportunities',
          joinTables: ['users'],
          metrics: ['新增商机金额'],
          dimensions: ['销售负责人'],
          filters: {
            startAt: '2026-06-01T00:00:00.000Z',
            endAt: '2026-07-01T00:00:00.000Z',
            timeRange: '2026年6月',
          },
          groupBy: ['user_id', 'name'],
          orderBy: [{ field: 'amount', direction: 'DESC' }],
          resultKind: 'owner-ranking',
          confidence: 'HIGH',
        },
      } as never,
    );

    expect(result.metricCards).toEqual(
      expect.arrayContaining([
        { name: '命中商机数', value: 2 },
        { name: '分组数量', value: 1 },
      ]),
    );
    expect(result.tableRows).toEqual([
      expect.objectContaining({
        ownerId: 'A031',
        ownerName: '王小红',
        amount: 1300000,
        count: 2,
      }),
    ]);
    expect(result.sql).toContain('/opportunities');
  });

  it('有 Markdown 快照服务时普通商机分析应只读本地 details 文件，不再实时请求 OpenAPI 列表', async () => {
    const getBootstrapSnapshot = jest.fn();
    const listByResource = jest.fn();
    const readResourceRecords = jest.fn((resource: string) =>
      resource === 'opportunities'
        ? [
            {
              id: 'OPP_MD_001',
              name: '山东快照项目A',
              amount: 1000000,
              stage: 'proposal',
              assignedStaffId: 'A031',
              assignedStaffName: '王小红',
              region: '山东区',
              createdAt: '2026-06-01T09:00:00.000Z',
            },
            {
              id: 'OPP_MD_002',
              name: '山东快照项目B',
              amount: 300000,
              stage: 'proposal',
              assignedStaffId: 'A031',
              assignedStaffName: '王小红',
              region: '山东区',
              createdAt: '2026-06-02T09:00:00.000Z',
            },
          ]
        : undefined,
    );
    const service = new LianruanCrmAnalysisExecutorService(
      {
        isEnabled: jest.fn(() => true),
        getBootstrapSnapshot,
      } as never,
      {
        listByResource,
      } as never,
      undefined,
      {
        readResourceRecords,
      } as never,
    );

    const result = await service.executeTask(
      '山东区最近商机负责人排名',
      {
        id: 'A030',
        name: '刘龙海',
      } as never,
      '全部权限',
      {
        taskId: 'task_markdown_001',
        taskTitle: '商机负责人排名',
        purpose: 'primary-summary',
        required: true,
        reportSection: 'summary',
        sql: 'SELECT ...',
        params: [],
        tables: ['opportunities', 'users'],
        fieldMap: {
          opportunities: ['id', 'amount', 'created_at', 'assigned_staff_id'],
        },
        joinPaths: [],
        allowedFunctions: ['SUM', 'COUNT'],
        resultKind: 'owner-ranking',
        rowLimit: 100,
        timeoutMs: 3000,
        executionMode: 'PLAN_EXECUTION',
        executionSource: 'CRM_OFFICIAL_API',
        preferredSource: 'CRM_OFFICIAL_API',
        matchedAdapter: 'crm-official-api.opportunity-owner-ranking',
        gapReason: '',
        toolSpec: {
          toolId: 'crm-official-api.opportunity-owner-ranking',
          toolType: 'CRM_OFFICIAL_API',
          allowedStatements: ['CRM_API_GET'],
          allowedTables: ['opportunities'],
          allowedFields: { opportunities: ['id', 'amount'] },
          allowedFunctions: [],
          outputShape: 'DATASET_SLICE',
          rowLimit: 100,
          timeoutMs: 3000,
        },
        plan: {
          type: 'query-plan',
          domain: 'opportunity-analysis',
          baseTable: 'opportunities',
          joinTables: ['users'],
          metrics: ['新增商机金额'],
          dimensions: ['销售负责人'],
          filters: {
            startAt: '2026-06-01T00:00:00.000Z',
            endAt: '2026-07-01T00:00:00.000Z',
            timeRange: '2026年6月',
          },
          groupBy: ['user_id', 'name'],
          orderBy: [{ field: 'amount', direction: 'DESC' }],
          resultKind: 'owner-ranking',
          confidence: 'HIGH',
        },
      } as never,
    );

    expect(readResourceRecords).toHaveBeenCalledWith('opportunities');
    expect(getBootstrapSnapshot).not.toHaveBeenCalled();
    expect(listByResource).not.toHaveBeenCalled();
    expect(result.executionSource).toBe('OPENAPI_MARKDOWN_SNAPSHOT');
    expect(result.matchedAdapter).toBe('openapi-markdown-snapshot.opportunities');
    expect(result.sql).toContain('READ backend/analysis-snapshot/latest/details/opportunities.md');
    expect(result.sql).not.toContain('GET /opportunities');
    expect(result.metricCards).toEqual(
      expect.arrayContaining([
        { name: '命中商机数', value: 2 },
        { name: '分组数量', value: 1 },
      ]),
    );
  });

  it.skip('历史实时 OpenAPI 兜底已停用：当前3个月没有进展商机停滞明细', async () => {
    const listByResource = jest.fn().mockResolvedValue({
      items: [
        {
          id: 'OPP_STALE',
          name: '三个月未推进项目',
          amount: 100000,
          stage: 'proposal',
          stageName: '方案沟通',
          assignedStaffId: 'A031',
          assignedStaffName: '王小红',
          partnerId: 'P001',
          partnerName: '山东服务商',
          customerName: '山东测试客户',
          region: '山东区',
          updatedAt: '2026-01-01T00:00:00.000Z',
          createdAt: '2025-12-01T00:00:00.000Z',
        },
        {
          id: 'OPP_RECENT',
          name: '近期有推进项目',
          amount: 200000,
          stage: 'proposal',
          assignedStaffId: 'A032',
          assignedStaffName: '赵小明',
          region: '山东区',
          updatedAt: new Date().toISOString(),
          createdAt: '2026-06-01T00:00:00.000Z',
        },
        {
          id: 'OPP_WON',
          name: '已赢单项目',
          amount: 300000,
          stage: 'won',
          assignedStaffId: 'A033',
          assignedStaffName: '李小明',
          region: '山东区',
          updatedAt: '2026-01-01T00:00:00.000Z',
          createdAt: '2025-12-01T00:00:00.000Z',
        },
      ],
      pageNo: 1,
      pageSize: 200,
      total: 3,
    });
    const service = new LianruanCrmAnalysisExecutorService(
      {
        isEnabled: jest.fn(() => true),
        getBootstrapSnapshot: jest.fn(async () => ({
          context: {
            client: {
              id: 'client_superadmin',
              name: 'AI-agent-superadmin-sit',
              boundUserId: 'A030',
              status: 'active',
              allowedResources: ['opportunities'],
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
          dictionaries: {},
        })),
      } as never,
      {
        listByResource,
      } as never,
    );

    const result = await service.executeTask(
      '分析当前3个月没有进展的商机情况',
      {
        id: 'A030',
        name: '刘龙海',
      } as never,
      '全部权限',
      {
        taskId: 'task_stale_openapi',
        taskTitle: '停滞商机风险分析',
        purpose: 'primary-summary',
        required: true,
        reportSection: 'detail-table',
        sql: 'SELECT ...',
        params: [],
        tables: ['opportunities'],
        fieldMap: {
          opportunities: ['id', 'amount', 'updatedAt', 'stage'],
        },
        joinPaths: [],
        allowedFunctions: ['COUNT'],
        resultKind: 'risk-overview',
        rowLimit: 100,
        timeoutMs: 3000,
        executionMode: 'PLAN_EXECUTION',
        executionSource: 'CRM_OFFICIAL_API',
        preferredSource: 'ANALYSIS_WAREHOUSE',
        matchedAdapter: 'crm-official-api.opportunity-risk-overview',
        gapReason: '分析库不可用时使用标准 OpenAPI 兜底。',
        toolSpec: {
          toolId: 'crm-official-api.opportunity-risk-overview',
          toolType: 'CRM_OFFICIAL_API',
          allowedStatements: ['CRM_API_GET'],
          allowedTables: ['opportunities'],
          allowedFields: { opportunities: ['id', 'amount', 'updatedAt', 'stage'] },
          allowedFunctions: [],
          outputShape: 'DATASET_SLICE',
          rowLimit: 100,
          timeoutMs: 3000,
        },
        plan: {
          type: 'query-plan',
          domain: 'opportunity-analysis',
          baseTable: 'opportunities',
          joinTables: [],
          metrics: ['商机数量'],
          dimensions: ['销售负责人', '商机阶段'],
          filters: {},
          groupBy: ['id'],
          orderBy: [{ field: 'updatedAt', direction: 'ASC' }],
          resultKind: 'risk-overview',
          confidence: 'HIGH',
        },
      } as never,
    );

    expect(result.summary).toContain('停滞商机分析');
    expect(result.metricCards).toEqual(
      expect.arrayContaining([
        { name: '风险商机数', value: 1 },
        { name: '分组数量', value: 1 },
      ]),
    );
    expect(result.primaryView).toEqual(
      expect.objectContaining({
        viewType: 'RANKING_TABLE',
        title: '超过3个月未更新商机明细',
      }),
    );
    expect(result.primaryView).not.toHaveProperty('series');
    expect(result.tableRows).toEqual([
      expect.objectContaining({
        opportunityId: 'OPP_STALE',
        opportunityName: '三个月未推进项目',
        salesOwnerName: '王小红',
        stale_days: expect.any(Number),
      }),
    ]);
    expect(result.appliedFilters).toEqual(
      expect.arrayContaining([
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
  });

  it.skip('历史实时 OpenAPI 路线已停用：渠道贡献统计接口聚合商机数量和金额', async () => {
    const listByResource = jest.fn();
    const listPartnerContributions = jest.fn(async () => [
        {
          partnerId: 'P001',
          partnerName: '山东联软服务商',
          partnerLevel: 'primary',
          region: '山东区',
          opportunityCount: 2,
          opportunityAmount: 1300000,
        quoteCount: 1,
        quoteAmount: 100000,
        orderCount: 0,
        orderAmount: 0,
      },
        {
          partnerId: 'P002',
          partnerName: '青岛生态伙伴',
          partnerLevel: 'secondary',
          region: '山东区',
          opportunityCount: 1,
          opportunityAmount: 500000,
        quoteCount: 0,
        quoteAmount: 0,
        orderCount: 0,
        orderAmount: 0,
      },
    ]);
    const service = new LianruanCrmAnalysisExecutorService(
      {
        isEnabled: jest.fn(() => true),
        getBootstrapSnapshot: jest.fn(async () => ({
          context: {
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
            regions: [{ value: '山东区', label: '山东区' }],
          },
        })),
      } as never,
      {
        listByResource,
        listPartnerContributions,
      } as never,
    );

    const result = await service.executeTask(
      '山东区域最近三个月有商机的服务商，对应商机数量和商机金额',
      {
        id: 'A030',
        name: '刘龙海',
      } as never,
      '全部权限',
      {
        taskId: 'task_partner_001',
        taskTitle: '商机渠道商贡献',
        purpose: 'primary-summary',
        required: true,
        reportSection: 'summary',
        sql: 'SELECT ...',
        params: [],
        tables: ['opportunities', 'partners'],
        fieldMap: {
          opportunities: ['id', 'amount', 'partnerId', 'createdAt'],
          partners: ['id', 'name'],
        },
        joinPaths: [],
        allowedFunctions: ['SUM', 'COUNT'],
        resultKind: 'partner-contribution',
        rowLimit: 100,
        timeoutMs: 3000,
        executionMode: 'PLAN_EXECUTION',
        executionSource: 'CRM_OFFICIAL_API',
        preferredSource: 'CRM_OFFICIAL_API',
        matchedAdapter: 'crm-official-api.opportunity-partner-contribution',
        gapReason: '',
        toolSpec: {
          toolId: 'crm-official-api.opportunity-partner-contribution',
          toolType: 'CRM_OFFICIAL_API',
          allowedStatements: ['CRM_API_GET'],
          allowedTables: ['opportunities'],
          allowedFields: { opportunities: ['id', 'amount', 'partnerId'] },
          allowedFunctions: [],
          outputShape: 'DATASET_SLICE',
          rowLimit: 100,
          timeoutMs: 3000,
        },
        plan: {
          type: 'query-plan',
          domain: 'opportunity-analysis',
          baseTable: 'opportunities',
          joinTables: ['partners'],
          metrics: ['新增商机金额', '商机数量'],
          dimensions: ['渠道商', '区域'],
          filters: {
            startAt: '2026-06-01T00:00:00.000Z',
            endAt: '2026-07-01T00:00:00.000Z',
            timeRange: '2026年6月',
          },
          groupBy: ['partner_id'],
          orderBy: [{ field: 'amount', direction: 'DESC' }],
          resultKind: 'partner-contribution',
          confidence: 'HIGH',
        },
      } as never,
    );

    expect(listPartnerContributions).toHaveBeenCalledWith({
      createdAfter: '2026-06-01T00:00:00.000Z',
      createdBefore: '2026-07-01T00:00:00.000Z',
      region: '山东区',
    });
    expect(listByResource).not.toHaveBeenCalled();
    expect(result.sql).toContain('/analytics/partners/contribution');
    expect(result.metricCards).toEqual(
      expect.arrayContaining([
        { name: '累计商机金额', value: '180 万元' },
        { name: '命中商机数', value: 3 },
        { name: '分组数量', value: 2 },
      ]),
    );
    expect(result.tableRows).toEqual([
      expect.objectContaining({
        partnerId: 'P001',
        partnerName: '山东联软服务商',
        partnerLevel: 'primary',
        amount: 1300000,
        count: 2,
      }),
      expect.objectContaining({
        partnerId: 'P002',
        partnerName: '青岛生态伙伴',
        amount: 500000,
        count: 1,
      }),
    ]);
  });

  it.skip('历史实时 OpenAPI 兜底已停用：渠道贡献统计为空时列表聚合复核', async () => {
    const listByResource = jest.fn(async () => ({
      items: [
        {
          id: 'OPP001',
          amount: 100000,
          partnerId: 'P001',
          partnerName: '山东诚卓信息技术有限公司',
          region: '山东区',
          createdAt: '2026-05-28T05:47:00.367Z',
        },
        {
          id: 'OPP002',
          amount: 50000,
          partnerId: 'P002',
          partnerName: '临沂普悦天诚信息科技有限公司',
          region: '山东区',
          createdAt: '2026-05-27T01:57:27.385Z',
        },
      ],
      pageNo: 1,
      pageSize: 200,
      total: 2,
    }));
    const listPartnerContributions = jest.fn(async () => []);
    const service = new LianruanCrmAnalysisExecutorService(
      {
        isEnabled: jest.fn(() => true),
        getBootstrapSnapshot: jest.fn(async () => ({
          context: {
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
            regions: [{ value: '山东区', label: '山东区' }],
          },
        })),
      } as never,
      {
        listByResource,
        listPartnerContributions,
      } as never,
    );

    const result = await service.executeTask(
      '最近三个月山东区域，有商机的服务商，对应的商机数量和商机金额',
      {
        id: 'A030',
        name: '刘龙海',
      } as never,
      '全部权限',
      {
        taskId: 'task_partner_fallback',
        taskTitle: '商机渠道商贡献',
        purpose: 'primary-summary',
        required: true,
        reportSection: 'summary',
        sql: 'SELECT ...',
        params: [],
        tables: ['opportunities', 'partners'],
        fieldMap: {
          opportunities: ['id', 'amount', 'partnerId', 'createdAt'],
          partners: ['id', 'name'],
        },
        joinPaths: [],
        allowedFunctions: ['SUM', 'COUNT'],
        resultKind: 'partner-contribution',
        rowLimit: 100,
        timeoutMs: 3000,
        executionMode: 'PLAN_EXECUTION',
        executionSource: 'CRM_OFFICIAL_API',
        preferredSource: 'CRM_OFFICIAL_API',
        matchedAdapter: 'crm-official-api.opportunity-partner-contribution',
        gapReason: '',
        toolSpec: {
          toolId: 'crm-official-api.opportunity-partner-contribution',
          toolType: 'CRM_OFFICIAL_API',
          allowedStatements: ['CRM_API_GET'],
          allowedTables: ['opportunities', 'partners'],
          allowedFields: {
            opportunities: ['id', 'amount', 'partnerId', 'createdAt'],
            partners: ['id', 'name'],
          },
          allowedFunctions: [],
          outputShape: 'DATASET_SLICE',
          rowLimit: 100,
          timeoutMs: 3000,
        },
        plan: {
          type: 'query-plan',
          domain: 'opportunity-analysis',
          baseTable: 'opportunities',
          joinTables: ['partners'],
          metrics: ['新增商机金额', '商机数量'],
          dimensions: ['渠道商', '区域'],
          filters: {
            startAt: '2026-03-05T01:03:26.385Z',
            endAt: '2026-06-05T01:03:26.385Z',
            timeRange: '最近三个月',
          },
          groupBy: ['partner_id'],
          orderBy: [{ field: 'amount', direction: 'DESC' }],
          resultKind: 'partner-contribution',
          confidence: 'HIGH',
        },
      } as never,
    );

    expect(listPartnerContributions).toHaveBeenCalledTimes(1);
    expect(listByResource).toHaveBeenCalledWith(
      'opportunities',
      expect.objectContaining({
        createdAfter: '2026-03-05T01:03:26.385Z',
        createdBefore: '2026-06-05T01:03:26.385Z',
      }),
    );
    expect(result.sql).toContain('/opportunities');
    expect(result.sql).toContain('同源列表聚合复核');
    expect(result.summary).toContain('同一标准 OpenAPI 商机列表按渠道商聚合复核');
    expect(result.appliedFilters).toEqual(
      expect.arrayContaining([
        {
          label: '聚合口径',
          value: '联软渠道贡献统计接口带时间筛选未返回可用结果，已使用同一标准 OpenAPI 商机列表按渠道商聚合复核。',
        },
      ]),
    );
    expect(result.metricCards).toEqual(
      expect.arrayContaining([
        { name: '累计商机金额', value: '15 万元' },
        { name: '命中商机数', value: 2 },
        { name: '分组数量', value: 2 },
      ]),
    );
    expect(result.tableRows).toEqual([
      expect.objectContaining({
        partnerName: '山东诚卓信息技术有限公司',
        amount: 100000,
        count: 1,
      }),
      expect.objectContaining({
        partnerName: '临沂普悦天诚信息科技有限公司',
        amount: 50000,
        count: 1,
      }),
    ]);
  });

  it('业务链分析有 Markdown 快照服务时应只读本地 details 文件，不再实时请求 OpenAPI', async () => {
    const getBootstrapSnapshot = jest.fn();
    const listByResource = jest.fn();
    const readBusinessChainSnapshot = jest.fn(() => ({
      generatedAt: '2026-06-16T00:00:00.000Z',
      scopeSummary: '本地 OpenAPI Markdown 快照，生成时间：2026-06-16T00:00:00.000Z',
      partners: [
        {
          id: 'P_MD_001',
          name: '广州快照生态服务商',
          level: '金牌服务商',
          region: '广州区',
          status: 'active',
          totalAmt: 960000,
        },
      ],
      registrations: [
        {
          id: 'REG_MD_001',
          registrationId: 'REG_MD_001',
          customerName: '广州快照客户',
          partnerId: 'P_MD_001',
          partnerName: '广州快照生态服务商',
          statusName: '已通过',
          createdAt: '2026-06-01T00:00:00.000Z',
        },
      ],
      opportunities: [
        {
          id: 'OPP_MD_001',
          opportunityId: 'OPP_MD_001',
          opportunityName: '广州快照商机',
          customerName: '广州快照客户',
          partnerId: 'P_MD_001',
          partnerName: '广州快照生态服务商',
          stage: 'proposal',
          amount: 1800000,
          ownerName: '刘龙海',
          createdAt: '2026-06-02T00:00:00.000Z',
        },
      ],
      orders: [
        {
          id: 'ORD_MD_001',
          orderId: 'ORD_MD_001',
          orderName: '广州快照订单',
          customerName: '广州快照客户',
          partnerId: 'P_MD_001',
          partnerName: '广州快照生态服务商',
          statusName: '已下单',
          amount: 960000,
          dealAt: '2026-06-10T00:00:00.000Z',
        },
      ],
    }));
    const service = new LianruanCrmAnalysisExecutorService(
      {
        isEnabled: jest.fn(() => true),
        getBootstrapSnapshot,
      } as never,
      {
        listByResource,
      } as never,
      undefined,
      {
        readBusinessChainSnapshot,
      } as never,
    );

    const result = await service.executeBusinessChainSnapshotTask({
      questionText: '帮我查询分析下，公司当前的合作伙伴开拓情况、客户商机报备及订单情况，并给出建议',
      user: {
        id: 'A030',
        name: '刘龙海',
      } as never,
      scopeSummary: '全部权限',
      resources: ['partners', 'registrations', 'opportunities', 'orders'],
    });

    const serializedResult = JSON.stringify(result);

    expect(readBusinessChainSnapshot).toHaveBeenCalledWith({
      resources: ['partners', 'registrations', 'opportunities', 'orders'],
    });
    expect(getBootstrapSnapshot).not.toHaveBeenCalled();
    expect(listByResource).not.toHaveBeenCalled();
    expect(result.executionSource).toBe('OPENAPI_MARKDOWN_SNAPSHOT');
    expect(result.matchedAdapter).toBe('openapi-markdown-snapshot.business-chain');
    expect(result.sql).toContain('READ backend/analysis-snapshot/latest/details/partners.md');
    expect(result.sql).toContain('READ backend/analysis-snapshot/latest/details/opportunities.md');
    expect(result.sql).not.toContain('GET /partners');
    expect(result.appliedFilters).toEqual(
      expect.arrayContaining([
        { label: '数据来源', value: 'CRM 已同步真实明细数据' },
        {
          label: '执行口径',
          value: '正式分析复用同一批 CRM 明细结果，不在展示层重新取数',
        },
      ]),
    );
    expect(serializedResult).toContain('广州快照生态服务商');
    expect(serializedResult).toContain('广州快照商机');
    expect(serializedResult).toContain('广州快照订单');
  });

  it('北京区域渠道商商机订单分析应以北京渠道商为主口径，不混入北京客户下的外地渠道商', async () => {
    const readBusinessChainSnapshot = jest.fn(() => ({
      generatedAt: '2026-06-16T00:00:00.000Z',
      scopeSummary: '本地 OpenAPI Markdown 快照，生成时间：2026-06-16T00:00:00.000Z',
      partners: [
        {
          partnerId: 'P_BJ_001',
          partnerName: '北京华元成硕信息技术有限公司',
          region: '北京',
          status: 'active',
        },
        {
          partnerId: 'P_SD_001',
          partnerName: '山东诚卓信息技术有限公司',
          region: '山东',
          status: 'active',
        },
      ],
      registrations: [],
      opportunities: [
        {
          opportunityId: 'OPP_BJ_PARTNER',
          opportunityName: '北京渠道商外地客户商机',
          customerName: '上海制造集团',
          partnerId: 'P_BJ_001',
          partnerName: '北京华元成硕信息技术有限公司',
          stage: 'proposal',
          amount: 50000,
          ownerName: '销售A',
        },
        {
          opportunityId: 'OPP_SD_PARTNER_BJ_CUSTOMER',
          opportunityName: '北京客户山东渠道商商机',
          customerName: '测试--北京市工业设计',
          partnerId: 'P_SD_001',
          partnerName: '山东诚卓信息技术有限公司',
          stage: 'proposal',
          amount: 124213,
          ownerName: '销售B',
        },
      ],
      orders: [
        {
          orderId: 'ORD_BJ_PARTNER',
          orderName: '北京渠道商订单',
          customerName: '上海制造集团',
          partnerId: 'P_BJ_001',
          partnerName: '北京华元成硕信息技术有限公司',
          amount: 20000,
        },
        {
          orderId: 'ORD_SD_PARTNER_BJ_CUSTOMER',
          orderName: '北京客户山东渠道商订单',
          customerName: '测试--北京市工业设计',
          partnerId: 'P_SD_001',
          partnerName: '山东诚卓信息技术有限公司',
          amount: 8250,
        },
      ],
    }));
    const service = new LianruanCrmAnalysisExecutorService(
      {
        isEnabled: jest.fn(() => true),
        getBootstrapSnapshot: jest.fn(),
      } as never,
      {
        listByResource: jest.fn(),
      } as never,
      undefined,
      {
        readBusinessChainSnapshot,
      } as never,
    );

    const result = await service.executeBusinessChainSnapshotTask({
      questionText: '北京区域的渠道商商机订单分析',
      user: {
        id: 'A030',
        name: '刘龙海',
      } as never,
      scopeSummary: '全部权限',
      resources: ['partners', 'opportunities', 'orders'],
    });

    const serializedResult = JSON.stringify(result);

    expect(result.metricCards).toEqual(
      expect.arrayContaining([
        { name: '合作伙伴数', value: 1 },
        { name: '商机数', value: 1 },
        { name: '订单数', value: 1 },
      ]),
    );
    expect(serializedResult).toContain('北京华元成硕信息技术有限公司');
    expect(serializedResult).toContain('北京渠道商外地客户商机');
    expect(serializedResult).toContain('北京渠道商订单');
    expect(serializedResult).not.toContain('山东诚卓信息技术有限公司');
    expect(serializedResult).not.toContain('北京客户山东渠道商商机');
    expect(serializedResult).not.toContain('北京客户山东渠道商订单');
  });

  it('指定渠道商名称包含省份词时应按渠道商实体过滤，不退化为区域汇总', async () => {
    const readBusinessChainSnapshot = jest.fn(() => ({
      generatedAt: '2026-06-16T00:00:00.000Z',
      scopeSummary: '本地 OpenAPI Markdown 快照，生成时间：2026-06-16T00:00:00.000Z',
      partners: [
        {
          partnerId: 'P_HA_001',
          partnerName: '山东华安赛服智能科技有限公司',
          region: '山东',
          status: 'active',
        },
        {
          partnerId: 'P_SC_001',
          partnerName: '山东诚卓信息技术有限公司',
          region: '山东',
          status: 'active',
        },
      ],
      registrations: [
        {
          registrationId: 'REG_HA_001',
          customerName: '华安服务客户',
          partnerId: 'P_HA_001',
          partnerName: '山东华安赛服智能科技有限公司',
          statusName: '已通过',
        },
        {
          registrationId: 'REG_SC_001',
          customerName: '诚卓服务客户',
          partnerId: 'P_SC_001',
          partnerName: '山东诚卓信息技术有限公司',
          statusName: '已通过',
        },
      ],
      opportunities: [
        {
          opportunityId: 'OPP_HA_001',
          opportunityName: '华安指定渠道商商机',
          customerName: '华安服务客户',
          partnerId: 'P_HA_001',
          partnerName: '山东华安赛服智能科技有限公司',
          stage: 'proposal',
          amount: 700000,
        },
        {
          opportunityId: 'OPP_SC_001',
          opportunityName: '诚卓山东区域商机',
          customerName: '诚卓服务客户',
          partnerId: 'P_SC_001',
          partnerName: '山东诚卓信息技术有限公司',
          stage: 'proposal',
          amount: 1000000,
        },
      ],
      quotes: [
        {
          quoteId: 'QUOTE_HA_001',
          quoteName: '华安指定渠道商报价',
          partnerId: 'P_HA_001',
          partnerName: '山东华安赛服智能科技有限公司',
          amount: 27500,
        },
        {
          quoteId: 'QUOTE_SC_001',
          quoteName: '诚卓山东区域报价',
          partnerId: 'P_SC_001',
          partnerName: '山东诚卓信息技术有限公司',
          amount: 456570,
        },
      ],
      orders: [
        {
          orderId: 'ORD_SC_001',
          orderName: '诚卓山东区域订单',
          partnerId: 'P_SC_001',
          partnerName: '山东诚卓信息技术有限公司',
          amount: 8250,
        },
      ],
    }));
    const service = new LianruanCrmAnalysisExecutorService(
      {
        isEnabled: jest.fn(() => true),
        getBootstrapSnapshot: jest.fn(),
      } as never,
      {
        listByResource: jest.fn(),
      } as never,
      undefined,
      {
        readBusinessChainSnapshot,
      } as never,
    );

    const result = await service.executeBusinessChainSnapshotTask({
      questionText: '渠道上山东华安赛服智能科技有限公司的整体情况分析',
      user: {
        id: 'A030',
        name: '刘龙海',
      } as never,
      scopeSummary: '全部权限',
      resources: ['partners', 'registrations', 'opportunities', 'quotes', 'orders'],
    });

    const serializedResult = JSON.stringify(result);

    expect(result.sql).toContain('-- partner: 山东华安赛服智能科技有限公司');
    expect(result.sql).toContain('-- region: 未限制');
    expect(result.sql).not.toContain('-- region: 山东');
    expect(result.appliedFilters).toEqual(
      expect.arrayContaining([
        { label: '渠道商', value: '山东华安赛服智能科技有限公司' },
      ]),
    );
    expect(result.appliedFilters.find((item) => item.label === '区域')).toBeUndefined();
    expect(result.metricCards).toEqual(
      expect.arrayContaining([
        { name: '合作伙伴数', value: 1 },
        { name: '客户报备数', value: 1 },
        { name: '商机数', value: 1 },
        { name: '商机金额', value: '70 万元' },
        { name: '报价数', value: 1 },
      ]),
    );
    expect(serializedResult).toContain('山东华安赛服智能科技有限公司');
    expect(serializedResult).toContain('华安指定渠道商商机');
    expect(serializedResult).toContain('华安指定渠道商报价');
    expect(serializedResult).not.toContain('山东诚卓信息技术有限公司');
    expect(serializedResult).not.toContain('诚卓山东区域商机');
    expect(serializedResult).not.toContain('诚卓山东区域订单');
  });

  it('业务链问题明确要求商机阶段分布时应优先生成阶段视图', async () => {
    const readBusinessChainSnapshot = jest.fn(() => ({
      generatedAt: '2026-06-16T00:00:00.000Z',
      scopeSummary: '本地 OpenAPI Markdown 快照，生成时间：2026-06-16T00:00:00.000Z',
      partners: [
        {
          partnerId: 'P_BJ_001',
          partnerName: '北京华元成硕信息技术有限公司',
          region: '北京',
          status: 'active',
        },
      ],
      registrations: [],
      opportunities: [
        {
          opportunityId: 'OPP_BJ_PROPOSAL',
          opportunityName: '北京渠道商方案阶段商机',
          partnerId: 'P_BJ_001',
          partnerName: '北京华元成硕信息技术有限公司',
          stage: 'proposal',
          amount: 50000,
        },
        {
          opportunityId: 'OPP_BJ_WON',
          opportunityName: '北京渠道商赢单阶段商机',
          partnerId: 'P_BJ_001',
          partnerName: '北京华元成硕信息技术有限公司',
          stage: 'won',
          amount: 80000,
        },
      ],
      orders: [
        {
          orderId: 'ORD_BJ_PARTNER',
          orderName: '北京渠道商订单',
          partnerId: 'P_BJ_001',
          partnerName: '北京华元成硕信息技术有限公司',
          amount: 20000,
        },
      ],
    }));
    const service = new LianruanCrmAnalysisExecutorService(
      {
        isEnabled: jest.fn(() => true),
        getBootstrapSnapshot: jest.fn(),
      } as never,
      {
        listByResource: jest.fn(),
      } as never,
      undefined,
      {
        readBusinessChainSnapshot,
      } as never,
    );

    const result = await service.executeBusinessChainSnapshotTask({
      questionText: '北京区域渠道商商机阶段分布和订单分析，用图表和表格呈现',
      user: {
        id: 'A030',
        name: '刘龙海',
      } as never,
      scopeSummary: '全部权限',
      resources: ['partners', 'opportunities', 'orders'],
    });

    const viewTitles = result.secondaryViews.map((view) => view.title);

    expect(viewTitles).toContain('商机阶段分布');
    expect(viewTitles.indexOf('商机阶段分布')).toBeLessThan(viewTitles.indexOf('商机明细'));
    expect(result.secondaryViews.find((view) => view.title === '商机阶段分布')?.series).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: expect.stringContaining('方案/报价'), value: 1 }),
        expect.objectContaining({ label: expect.stringContaining('成交'), value: 1 }),
      ]),
    );
  });

  it('预计 30 天内签约但未报价问题应输出商机风险明细', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-06-30T00:00:00.000Z'));
    const readResourceRecords = jest.fn((resource: string) =>
      resource === 'opportunities'
        ? [
            {
              opportunityId: 'OPP_RISK_001',
              opportunityName: '山东核心客户扩容商机',
              customerName: '山东核心客户',
              partnerId: 'P_SD_001',
              partnerName: '山东渠道服务商',
              ownerId: 'A031',
              ownerName: '王小红',
              stage: 'proposal',
              amount: 180000,
              expectedSignDate: '2026-07-12T00:00:00.000Z',
            },
            {
              opportunityId: 'OPP_RISK_QUOTED',
              opportunityName: '已报价商机',
              customerName: '山东已报价客户',
              stage: 'proposal',
              amount: 260000,
              expectedSignDate: '2026-07-08T00:00:00.000Z',
              quoteId: 'Q_EXIST_001',
            },
            {
              opportunityId: 'OPP_RISK_FAR',
              opportunityName: '远期签约商机',
              customerName: '远期客户',
              stage: 'proposal',
              amount: 300000,
              expectedSignDate: '2026-08-15T00:00:00.000Z',
            },
          ]
        : [],
    );
    const service = new LianruanCrmAnalysisExecutorService(
      {
        isEnabled: jest.fn(() => true),
        getBootstrapSnapshot: jest.fn(),
      } as never,
      {
        listByResource: jest.fn(),
      } as never,
      undefined,
      {
        readResourceRecords,
      } as never,
    );

    try {
      const result = await service.executeTask(
        '预计 30 天内签约但还没有报价的商机有哪些？',
        {
          id: 'A030',
          name: '刘龙海',
        } as never,
        '全部权限',
        {
          taskId: 'task_expected_sign_without_quote',
          taskTitle: '预计签约未报价商机风险',
          purpose: 'primary-summary',
          required: true,
          reportSection: 'detail-table',
          sql: 'SELECT ...',
          params: [],
          tables: ['opportunities'],
          fieldMap: { opportunities: ['id', 'amount', 'expectedSignDate'] },
          joinPaths: [],
          allowedFunctions: ['COUNT'],
          resultKind: 'risk-overview',
          rowLimit: 100,
          timeoutMs: 3000,
          executionMode: 'PLAN_EXECUTION',
          executionSource: 'CRM_OFFICIAL_API',
          preferredSource: 'CRM_OFFICIAL_API',
          matchedAdapter: 'crm-official-api.opportunity-risk-overview',
          gapReason: '',
          toolSpec: {
            toolId: 'crm-official-api.opportunity-risk-overview',
            toolType: 'CRM_OFFICIAL_API',
            allowedStatements: ['CRM_API_GET'],
            allowedTables: ['opportunities'],
            allowedFields: { opportunities: ['id', 'amount', 'expectedSignDate'] },
            allowedFunctions: [],
            outputShape: 'DATASET_SLICE',
            rowLimit: 100,
            timeoutMs: 3000,
          },
          plan: {
            type: 'query-plan',
            domain: 'opportunity-analysis',
            baseTable: 'opportunities',
            joinTables: [],
            metrics: ['商机数量'],
            dimensions: ['商机风险'],
            filters: {},
            groupBy: ['risk_type'],
            orderBy: [{ field: 'amount', direction: 'DESC' }],
            resultKind: 'risk-overview',
            confidence: 'HIGH',
          },
        } as never,
      );

      expect(result.rowCount).toBe(1);
      expect(result.summary).toContain('命中 1 条预计 30 天内签约但未检测到报价关联的商机');
      expect(result.taskTitle).toBe('预计签约未报价商机分析');
      expect(result.primaryView).toEqual(
        expect.objectContaining({
          viewType: 'RANKING_TABLE',
          title: '预计签约未报价商机明细',
        }),
      );
      expect(result.tableRows).toEqual([
        expect.objectContaining({
          opportunityId: 'OPP_RISK_001',
          opportunityName: '山东核心客户扩容商机',
          expectedSignDate: '2026-07-12T00:00:00.000Z',
          riskReason: '预计 30 天内签约，但当前快照未检测到报价关联',
        }),
      ]);
      expect(result.appliedFilters).toEqual(
        expect.arrayContaining([
          {
            label: '风险口径',
            value: '预计签约日期在未来 30 天内，且当前快照未检测到报价关联；同时排除审批中、输单、赢单、取消等无效商机',
          },
          {
            label: '排序口径',
            value: '按商机金额倒序',
          },
        ]),
      );
      expect(JSON.stringify(result)).not.toContain('已报价商机');
      expect(JSON.stringify(result)).not.toContain('远期签约商机');
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('哪些报价最可能本周转订单应输出规则评分兜底', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-06-30T00:00:00.000Z'));
    const readResourceRecords = jest.fn((resource: string) =>
      resource === 'quotes'
        ? [
            {
              quoteId: 'Q_FAST_001',
              quoteNo: 'BJ-001',
              quoteName: '山东核心客户报价',
              customerName: '山东核心客户',
              opportunityName: '山东核心客户扩容商机',
              partnerName: '山东渠道服务商',
              statusName: '审批通过',
              amount: 200000,
              expectedSignDate: '2026-07-05T00:00:00.000Z',
              updatedAt: '2026-06-29T00:00:00.000Z',
            },
            {
              quoteId: 'Q_LOW_001',
              quoteName: '低分报价',
              statusName: '已作废',
              amount: 0,
              updatedAt: '2026-05-01T00:00:00.000Z',
            },
          ]
        : [],
    );
    const service = new LianruanCrmAnalysisExecutorService(
      {
        isEnabled: jest.fn(() => true),
        getBootstrapSnapshot: jest.fn(),
      } as never,
      {
        listByResource: jest.fn(),
      } as never,
      undefined,
      {
        readResourceRecords,
      } as never,
    );

    try {
      const result = await service.executeTask(
        '哪些报价最可能本周转订单',
        {
          id: 'A030',
          name: '刘龙海',
        } as never,
        '全部权限',
        {
          taskId: 'task_quote_order_score',
          taskTitle: '报价转订单规则评分',
          purpose: 'primary-summary',
          required: true,
          reportSection: 'detail-table',
          sql: 'SELECT ...',
          params: [],
          tables: ['quotes'],
          fieldMap: { quotes: ['id', 'amount', 'status'] },
          joinPaths: [],
          allowedFunctions: ['COUNT'],
          resultKind: 'owner-ranking',
          rowLimit: 10,
          timeoutMs: 3000,
          executionMode: 'PLAN_EXECUTION',
          executionSource: 'CRM_OFFICIAL_API',
          preferredSource: 'CRM_OFFICIAL_API',
          matchedAdapter: 'crm-official-api.quote-owner-ranking',
          gapReason: '',
          toolSpec: {
            toolId: 'crm-official-api.quote-owner-ranking',
            toolType: 'CRM_OFFICIAL_API',
            allowedStatements: ['CRM_API_GET'],
            allowedTables: ['quotes'],
            allowedFields: { quotes: ['id', 'amount', 'status'] },
            allowedFunctions: [],
            outputShape: 'DATASET_SLICE',
            rowLimit: 10,
            timeoutMs: 3000,
          },
          plan: {
            type: 'query-plan',
            domain: 'contract-conversion',
            baseTable: 'contracts',
            joinTables: [],
            metrics: ['报价金额'],
            dimensions: ['报价'],
            filters: {},
            groupBy: ['quote_id'],
            orderBy: [{ field: 'amount', direction: 'DESC' }],
            resultKind: 'owner-ranking',
            confidence: 'HIGH',
          },
        } as never,
      );

      expect(result.rowCount).toBe(1);
      expect(result.summary).toContain('命中 1 条报价');
      expect(result.tableRows).toEqual([
        expect.objectContaining({
          quoteId: 'Q_FAST_001',
          quoteName: '山东核心客户报价',
          ruleScore: 100,
          ruleScoreLabel: '100 分',
          suggestedAction: '本周优先催单并确认订单归属',
        }),
      ]);
      expect(JSON.stringify(result)).not.toContain('低分报价');
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('渠道商数量和类型明细问题应走 Markdown partners 画像明细，不落到商机贡献', async () => {
    const listByResource = jest.fn();
    const getPartnerProfileAnalytics = jest.fn();
    const readResourceRecords = jest.fn((resource: string) =>
      resource === 'partners'
        ? [
            {
              partnerId: 'P_SD_001',
              partnerName: '山东诚卓信息技术有限公司',
              partnerLevel: '二级渠道',
              partnerType: '渠道商',
              isTechnicalServiceProvider: false,
              technicalServiceProviderType: '非技术服务商',
              region: '山东区',
              status: 'active',
            },
            {
              partnerId: 'P_SD_002',
              partnerName: '山东旭正信息科技有限公司',
              partnerLevel: '未设置',
              partnerType: '技术服务商',
              isTechnicalServiceProvider: true,
              technicalServiceProviderType: '技术服务商',
              region: '山东区',
              status: 'active',
            },
            {
              partnerId: 'P_GD_001',
              partnerName: '广州生态服务商',
              partnerLevel: '一级渠道',
              partnerType: '渠道商',
              isTechnicalServiceProvider: false,
              technicalServiceProviderType: '非技术服务商',
              region: '广东区',
              status: 'active',
            },
          ]
        : [],
    );
    const service = new LianruanCrmAnalysisExecutorService(
      {
        isEnabled: jest.fn(() => true),
        getBootstrapSnapshot: jest.fn(),
      } as never,
      {
        listByResource,
        getPartnerProfileAnalytics,
      } as never,
      undefined,
      {
        readResourceRecords,
      } as never,
    );

    const result = await service.executeTask(
      '山东区域有多少个渠道商，分别是什么类型的单独列一下。',
      {
        id: 'A030',
        name: '刘龙海',
      } as never,
      '全部权限',
      {
        taskId: 'task_partner_type_detail',
        taskTitle: '渠道商类型明细',
        purpose: 'primary-summary',
        required: true,
        reportSection: 'detail-table',
        sql: 'SELECT ...',
        params: [],
        tables: ['opportunities', 'partners'],
        fieldMap: {
          opportunities: ['id', 'partner_id', 'expect_amount', 'created_at'],
          partners: ['id', 'name', 'partnerLevel', 'partnerType', 'region', 'status'],
        },
        joinPaths: [],
        allowedFunctions: ['SUM', 'COUNT'],
        resultKind: 'partner-contribution',
        rowLimit: 100,
        timeoutMs: 3000,
        executionMode: 'PLAN_EXECUTION',
        executionSource: 'CRM_OFFICIAL_API',
        preferredSource: 'CRM_OFFICIAL_API',
        matchedAdapter: 'crm-official-api.opportunity-partner-contribution',
        gapReason: '',
        toolSpec: {
          toolId: 'crm-official-api.opportunity-partner-contribution',
          toolType: 'CRM_OFFICIAL_API',
          allowedStatements: ['CRM_API_GET'],
          allowedTables: ['opportunities', 'partners'],
          allowedFields: {
            opportunities: ['id', 'partner_id', 'expect_amount', 'created_at'],
            partners: ['id', 'name', 'partnerLevel', 'partnerType', 'region', 'status'],
          },
          allowedFunctions: [],
          outputShape: 'DATASET_SLICE',
          rowLimit: 100,
          timeoutMs: 3000,
        },
        plan: {
          type: 'query-plan',
          domain: 'opportunity-analysis',
          baseTable: 'opportunities',
          joinTables: ['partners'],
          metrics: ['新增商机金额'],
          dimensions: ['渠道商'],
          filters: {},
          groupBy: ['partner_id'],
          orderBy: [{ field: 'count', direction: 'DESC' }],
          resultKind: 'partner-contribution',
          confidence: 'HIGH',
        },
      } as never,
    );

    const serializedResult = JSON.stringify(result);

    expect(readResourceRecords).toHaveBeenCalledWith('partners');
    expect(listByResource).not.toHaveBeenCalled();
    expect(getPartnerProfileAnalytics).not.toHaveBeenCalled();
    expect(result.executionSource).toBe('OPENAPI_MARKDOWN_SNAPSHOT');
    expect(result.matchedAdapter).toBe('openapi-markdown-snapshot.partner-profile');
    expect(result.taskTitle).toBe('渠道商类型明细');
    expect(result.metricCards).toEqual(
      expect.arrayContaining([
        { name: '渠道商数量', value: 2 },
        { name: '技术服务商', value: 1 },
      ]),
    );
    expect(result.tableRows).toHaveLength(2);
    expect(serializedResult).toContain('山东诚卓信息技术有限公司');
    expect(serializedResult).toContain('山东旭正信息科技有限公司');
    expect(serializedResult).toContain('技术服务商');
    expect(serializedResult).not.toContain('广州生态服务商');
    expect(serializedResult).not.toContain('命中商机数');
  });

  it.skip('历史实时 OpenAPI 路线已停用：业务链临时快照返回真实业务名称', async () => {
    const recordsByResource = {
      partners: [
        {
          id: 'P_REAL_001',
          name: '广州信创生态服务商',
          level: '金牌服务商',
          isTechService: true,
          techServiceType: '全栈交付',
          region: '广州区',
          status: 'active',
          joinDate: '2026-05-01T00:00:00.000Z',
          quoteCount: 2,
          orderCount: 1,
          totalAmt: 960000,
        },
      ],
      registrations: [
        {
          id: 'REG_REAL_001',
          registrationId: 'REG_REAL_001',
          customerName: '广州银行股份有限公司',
          partnerId: 'P_REAL_001',
          partnerName: '广州信创生态服务商',
          opportunityName: '广州银行信创安全扩容',
          statusName: '已通过',
          createdAt: '2026-06-01T00:00:00.000Z',
        },
      ],
      opportunities: [
        {
          id: 'OPP_REAL_001',
          opportunityId: 'OPP_REAL_001',
          opportunityName: '广州银行信创安全扩容',
          customerName: '广州银行股份有限公司',
          partnerId: 'P_REAL_001',
          partnerName: '广州信创生态服务商',
          stage: 'proposal',
          amount: 1800000,
          ownerName: '刘龙海',
          createdAt: '2026-06-02T00:00:00.000Z',
        },
      ],
      orders: [
        {
          id: 'ORD_REAL_001',
          orderId: 'ORD_REAL_001',
          orderNo: 'SO-REAL-001',
          orderName: '广州银行信创安全扩容订单',
          customerName: '广州银行股份有限公司',
          opportunityName: '广州银行信创安全扩容',
          partnerId: 'P_REAL_001',
          partnerName: '广州信创生态服务商',
          statusName: '已下单',
          amount: 960000,
          dealAt: '2026-06-10T00:00:00.000Z',
        },
      ],
    };
    const listByResource = jest.fn(async (resource: keyof typeof recordsByResource) => ({
      items: recordsByResource[resource],
      pageNo: 1,
      pageSize: 200,
      total: recordsByResource[resource].length,
    }));
    const service = new LianruanCrmAnalysisExecutorService(
      {
        isEnabled: jest.fn(() => true),
        getBootstrapSnapshot: jest.fn(async () => ({
          context: {
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
            opportunityStages: [{ value: 'proposal', label: '方案/报价' }],
          },
        })),
      } as never,
      {
        listByResource,
      } as never,
    );

    const result = await service.executeBusinessChainSnapshotTask({
      questionText: '帮我查询分析下，公司当前的合作伙伴开拓情况、客户商机报备及订单情况，并给出建议',
      user: {
        id: 'A030',
        name: '刘龙海',
      } as never,
      scopeSummary: '全部权限',
      resources: ['partners', 'registrations', 'opportunities', 'orders'],
    });

    const serializedResult = JSON.stringify(result);
    const opportunityView = result.secondaryViews.find((view) => view.title === '商机明细');
    const orderView = result.secondaryViews.find((view) => view.title === '订单明细');
    const registrationView = result.secondaryViews.find((view) => view.title === '客户报备明细');
    const partnerView = result.secondaryViews.find((view) => view.title === '合作伙伴明细');
    const partnerContributionView = result.secondaryViews.find((view) => view.title === '渠道商经营贡献汇总');

    expect(result.matchedAdapter).toBe('crm-official-api.business-chain-snapshot');
    expect(result.sql).toContain('联软标准 OpenAPI 业务链真实明细临时快照');
    expect(result.metricCards).toEqual(
      expect.arrayContaining([
        { name: '合作伙伴数', value: 1 },
        { name: '客户报备数', value: 1 },
        { name: '商机数', value: 1 },
        { name: '订单数', value: 1 },
      ]),
    );
    expect(opportunityView?.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          opportunityName: '广州银行信创安全扩容',
          customerName: '广州银行股份有限公司',
          partnerName: '广州信创生态服务商',
          stageName: '方案/报价',
        }),
      ]),
    );
    expect(orderView?.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          orderName: '广州银行信创安全扩容订单',
          customerName: '广州银行股份有限公司',
          partnerName: '广州信创生态服务商',
        }),
      ]),
    );
    expect(registrationView?.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          customerName: '广州银行股份有限公司',
          partnerName: '广州信创生态服务商',
        }),
      ]),
    );
    expect(partnerView?.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          partnerName: '广州信创生态服务商',
          partnerLevel: '金牌服务商',
          technicalServiceProvider: '技术服务商',
          technicalServiceProviderType: '全栈交付',
          status: '启用',
          quoteCount: 2,
          orderCount: 1,
          totalAmountText: '96 万元',
        }),
      ]),
    );
    expect(partnerContributionView?.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          partnerName: '广州信创生态服务商',
          registrationCount: 1,
          opportunityCount: 1,
          orderCount: 1,
        }),
      ]),
    );
    expect(serializedResult).not.toContain('渠道商001');
    expect(serializedResult).not.toContain('客户001');
  });

  it.skip('历史实时 OpenAPI 路线已停用：业务链临时快照山东范围下推区域', async () => {
    const recordsByResource = {
      partners: [
        {
          id: 'P_SD_001',
          name: '山东联软服务商',
          region: '大北区-山东区',
          status: 'active',
          totalAmt: 300000,
        },
        {
          id: 'P_GD_001',
          name: '广东联软服务商',
          region: '广东区',
          status: 'active',
          totalAmt: 900000,
        },
      ],
      registrations: [
        {
          id: 'REG_SD_001',
          registrationId: 'REG_SD_001',
          customerName: '山东能源集团',
          partnerId: 'P_SD_001',
          partnerName: '山东联软服务商',
          statusName: '已通过',
          createdAt: '2026-06-01T00:00:00.000Z',
        },
        {
          id: 'REG_GD_001',
          registrationId: 'REG_GD_001',
          customerName: '广州银行股份有限公司',
          partnerId: 'P_GD_001',
          partnerName: '广东联软服务商',
          statusName: '已通过',
          createdAt: '2026-06-01T00:00:00.000Z',
        },
      ],
      opportunities: [
        {
          id: 'OPP_SD_001',
          opportunityId: 'OPP_SD_001',
          opportunityName: '山东能源信创项目',
          customerName: '山东能源集团',
          partnerId: 'P_SD_001',
          partnerName: '山东联软服务商',
          region: '山东区',
          stage: 'proposal',
          amount: 300000,
          createdAt: '2026-06-02T00:00:00.000Z',
        },
        {
          id: 'OPP_GD_001',
          opportunityId: 'OPP_GD_001',
          opportunityName: '广州银行信创项目',
          customerName: '广州银行股份有限公司',
          partnerId: 'P_GD_001',
          partnerName: '广东联软服务商',
          region: '广东区',
          stage: 'proposal',
          amount: 900000,
          createdAt: '2026-06-02T00:00:00.000Z',
        },
      ],
      orders: [
        {
          id: 'ORD_SD_001',
          orderId: 'ORD_SD_001',
          orderName: '山东能源信创订单',
          customerName: '山东能源集团',
          partnerId: 'P_SD_001',
          partnerName: '山东联软服务商',
          amount: 280000,
          dealAt: '2026-06-10T00:00:00.000Z',
        },
        {
          id: 'ORD_GD_001',
          orderId: 'ORD_GD_001',
          orderName: '广州银行信创订单',
          customerName: '广州银行股份有限公司',
          partnerId: 'P_GD_001',
          partnerName: '广东联软服务商',
          amount: 880000,
          dealAt: '2026-06-10T00:00:00.000Z',
        },
      ],
    };
    const listByResource = jest.fn(async (resource: keyof typeof recordsByResource) => ({
      items: recordsByResource[resource],
      pageNo: 1,
      pageSize: 200,
      total: recordsByResource[resource].length,
    }));
    const service = new LianruanCrmAnalysisExecutorService(
      {
        isEnabled: jest.fn(() => true),
        getBootstrapSnapshot: jest.fn(async () => ({
          context: {
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
            regions: [
              { value: '大北区-山东区', label: '山东区' },
              { value: '广东区', label: '广东区' },
            ],
            opportunityStages: [{ value: 'proposal', label: '方案/报价' }],
          },
        })),
      } as never,
      {
        listByResource,
      } as never,
    );

    const result = await service.executeBusinessChainSnapshotTask({
      questionText: '帮我分析山东的合作伙伴开拓、客户商机报备及订单情况',
      user: {
        id: 'A030',
        name: '刘龙海',
      } as never,
      scopeSummary: '全部权限',
      resources: ['partners', 'registrations', 'opportunities', 'orders'],
    });

    const serializedResult = JSON.stringify(result);
    expect(listByResource).toHaveBeenCalledWith(
      'partners',
      expect.objectContaining({
        region: '大北区-山东区',
      }),
    );
    expect(result.metricCards).toEqual(
      expect.arrayContaining([
        { name: '合作伙伴数', value: 1 },
        { name: '客户报备数', value: 1 },
        { name: '商机数', value: 1 },
        { name: '订单数', value: 1 },
      ]),
    );
    expect(result.appliedFilters).toEqual(
      expect.arrayContaining([
        { label: '区域', value: '山东' },
        { label: '数据来源', value: '联软标准 OpenAPI 真实明细临时快照' },
      ]),
    );
    expect(serializedResult).toContain('山东联软服务商');
    expect(serializedResult).toContain('山东能源信创项目');
    expect(serializedResult).not.toContain('广东联软服务商');
    expect(serializedResult).not.toContain('广州银行信创项目');
  });

  it.skip('历史实时 OpenAPI 路线已停用：服务商画像统计接口返回技术服务商维度', async () => {
    const listByResource = jest.fn();
    const getPartnerProfileAnalytics = jest.fn(async () => ({
      totalCount: 12,
      activeCount: 10,
      technicalServiceProviderCount: 3,
      byLevel: [
        { value: 'primary', count: 8 },
        { value: 'secondary', count: 4 },
      ],
      byTechnicalServiceProvider: [
        { value: true, count: 3 },
        { value: false, count: 9 },
      ],
      byRegion: [{ value: '山东区', count: 12 }],
    }));
    const service = new LianruanCrmAnalysisExecutorService(
      {
        isEnabled: jest.fn(() => true),
        getBootstrapSnapshot: jest.fn(async () => ({
          context: {
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
            partnerLevels: [
              { value: 'primary', label: '一级服务商' },
              { value: 'secondary', label: '二级服务商' },
            ],
            technicalServiceProviderTypes: [
              { value: 'true', label: '技术服务商' },
              { value: 'false', label: '非技术服务商' },
            ],
            regions: [{ value: '山东区', label: '山东区' }],
          },
        })),
      } as never,
      {
        listByResource,
        listPartnerContributions: jest.fn(),
        getPartnerProfileAnalytics,
      } as never,
    );

    const result = await service.executeTask(
      '山东区域最近一年的服务商有多少家，合作级别、等级、是否技术服务商维度一起给我。',
      {
        id: 'A030',
        name: '刘龙海',
      } as never,
      '全部权限',
      {
        taskId: 'task_partner_profile_analytics',
        taskTitle: '新增商机金额渠道商贡献',
        purpose: 'primary-summary',
        required: true,
        reportSection: 'summary',
        sql: 'SELECT ...',
        params: [],
        tables: ['opportunities', 'partners'],
        fieldMap: {
          opportunities: ['id', 'partner_id', 'expect_amount', 'created_at'],
          partners: ['id', 'name', 'partnerLevel', 'region', 'bigRegion', 'status'],
        },
        joinPaths: [],
        allowedFunctions: ['SUM', 'COUNT'],
        resultKind: 'partner-contribution',
        rowLimit: 100,
        timeoutMs: 3000,
        executionMode: 'PLAN_EXECUTION',
        executionSource: 'CRM_OFFICIAL_API',
        preferredSource: 'CRM_OFFICIAL_API',
        matchedAdapter: 'crm-official-api.opportunity-partner-contribution',
        gapReason: '',
        toolSpec: {
          toolId: 'crm-official-api.opportunity-partner-contribution',
          toolType: 'CRM_OFFICIAL_API',
          allowedStatements: ['CRM_API_GET'],
          allowedTables: ['opportunities', 'partners'],
          allowedFields: {
            opportunities: ['id', 'partner_id', 'expect_amount', 'created_at'],
            partners: ['id', 'name', 'partnerLevel', 'region', 'bigRegion', 'status'],
          },
          allowedFunctions: [],
          outputShape: 'DATASET_SLICE',
          rowLimit: 100,
          timeoutMs: 3000,
        },
        plan: {
          type: 'query-plan',
          domain: 'opportunity-analysis',
          baseTable: 'opportunities',
          joinTables: ['partners'],
          metrics: ['新增商机金额'],
          dimensions: ['渠道商'],
          filters: {
            startAt: '2025-06-08T00:00:00.000Z',
            endAt: '2026-06-08T00:00:00.000Z',
            timeRange: '最近一年',
          },
          groupBy: ['partner_id'],
          orderBy: [{ field: 'amount', direction: 'DESC' }],
          resultKind: 'partner-contribution',
          confidence: 'HIGH',
        },
      } as never,
    );

    expect(getPartnerProfileAnalytics).toHaveBeenCalledWith({
      region: '山东区',
    });
    expect(listByResource).not.toHaveBeenCalled();
    expect(result.sql).toContain('/analytics/partners/profile');
    expect(result.summary).toContain('技术服务商 3 家');
    expect(result.metricCards).toEqual(
      expect.arrayContaining([
        { name: '服务商数量', value: 12 },
        { name: '合作等级数', value: 2 },
        { name: '技术服务商', value: 3 },
      ]),
    );
    expect(result.tableRows).toEqual(
      expect.arrayContaining([
        { dimension: '合作等级', item: '一级服务商', count: 8 },
        { dimension: '是否技术服务商', item: '技术服务商', count: 3 },
      ]),
    );
  });

  it.skip('历史实时 OpenAPI 兜底已停用：服务商画像统计接口不可用时回退 partners 列表', async () => {
    const listByResource = jest.fn(async () => ({
      items: [
        {
          id: 'P001',
          name: '山东华安赛服智能科技有限公司',
          partnerLevel: 'primary',
          region: '山东区',
          status: 'active',
          createdAt: '2026-01-10T00:00:00.000Z',
        },
        {
          id: 'P002',
          name: '青岛生态伙伴',
          partnerLevel: 'secondary',
          region: '山东区',
          status: 'inactive',
          createdAt: '2026-02-10T00:00:00.000Z',
        },
      ],
      pageNo: 1,
      pageSize: 200,
      total: 2,
    }));
    const listPartnerContributions = jest.fn();
    const getPartnerProfileAnalytics = jest.fn(async () => {
      throw new Error('画像统计接口暂不可用');
    });
    const service = new LianruanCrmAnalysisExecutorService(
      {
        isEnabled: jest.fn(() => true),
        getBootstrapSnapshot: jest.fn(async () => ({
          context: {
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
            partnerLevels: [
              { value: 'primary', label: '一级服务商' },
              { value: 'secondary', label: '二级服务商' },
            ],
          },
        })),
      } as never,
      {
        listByResource,
        listPartnerContributions,
        getPartnerProfileAnalytics,
      } as never,
    );

    const result = await service.executeTask(
      '最近一年的服务商有多少家，合作级别、等级、是否技术服务商维度一起给我。',
      {
        id: 'A030',
        name: '刘龙海',
      } as never,
      '全部权限',
      {
        taskId: 'task_partner_profile',
        taskTitle: '新增商机金额渠道商贡献',
        purpose: 'primary-summary',
        required: true,
        reportSection: 'summary',
        sql: 'SELECT ...',
        params: [],
        tables: ['opportunities', 'partners'],
        fieldMap: {
          opportunities: ['id', 'partner_id', 'expect_amount', 'created_at'],
          partners: ['id', 'name', 'partnerLevel', 'region', 'bigRegion', 'status'],
        },
        joinPaths: [],
        allowedFunctions: ['SUM', 'COUNT'],
        resultKind: 'partner-contribution',
        rowLimit: 100,
        timeoutMs: 3000,
        executionMode: 'PLAN_EXECUTION',
        executionSource: 'CRM_OFFICIAL_API',
        preferredSource: 'CRM_OFFICIAL_API',
        matchedAdapter: 'crm-official-api.opportunity-partner-contribution',
        gapReason: '',
        toolSpec: {
          toolId: 'crm-official-api.opportunity-partner-contribution',
          toolType: 'CRM_OFFICIAL_API',
          allowedStatements: ['CRM_API_GET'],
          allowedTables: ['opportunities', 'partners'],
          allowedFields: {
            opportunities: ['id', 'partner_id', 'expect_amount', 'created_at'],
            partners: ['id', 'name', 'partnerLevel', 'region', 'bigRegion', 'status'],
          },
          allowedFunctions: [],
          outputShape: 'DATASET_SLICE',
          rowLimit: 100,
          timeoutMs: 3000,
        },
        plan: {
          type: 'query-plan',
          domain: 'opportunity-analysis',
          baseTable: 'opportunities',
          joinTables: ['partners'],
          metrics: ['新增商机金额'],
          dimensions: ['渠道商'],
          filters: {
            startAt: '2025-06-08T00:00:00.000Z',
            endAt: '2026-06-08T00:00:00.000Z',
            timeRange: '最近一年',
          },
          groupBy: ['partner_id'],
          orderBy: [{ field: 'amount', direction: 'DESC' }],
          resultKind: 'partner-contribution',
          confidence: 'HIGH',
        },
      } as never,
    );

    expect(listPartnerContributions).not.toHaveBeenCalled();
    expect(getPartnerProfileAnalytics).toHaveBeenCalledTimes(1);
    expect(listByResource).toHaveBeenCalledWith(
      'partners',
      expect.objectContaining({
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      }),
    );
    const firstPartnerListQuery = (listByResource.mock.calls[0] as unknown[])[1] as Record<
      string,
      unknown
    >;
    expect(firstPartnerListQuery).not.toHaveProperty('createdAfter');
    expect(firstPartnerListQuery).not.toHaveProperty('createdBefore');
    expect(result.summary).toContain('命中 2 家服务商');
    expect(result.summary).toContain('当前授权服务商快照');
    expect(result.summary).toContain('技术服务商 0 家');
    expect(result.appliedFilters).toEqual(
      expect.arrayContaining([
        { label: '用户时间表达', value: '最近一年' },
        {
          label: '画像统计口径',
          value: '按当前授权服务商主数据快照统计，不按服务商创建时间排除历史服务商。',
        },
      ]),
    );
    expect(result.metricCards).toEqual(
      expect.arrayContaining([
        { name: '服务商数量', value: 2 },
        { name: '合作等级数', value: 2 },
        { name: '技术服务商', value: 0 },
        { name: '正常状态服务商', value: 1 },
      ]),
    );
    expect(result.tableRows).toEqual([
      expect.objectContaining({
        partnerName: '青岛生态伙伴',
        partnerLevel: '二级服务商',
        status: 'inactive',
      }),
      expect.objectContaining({
        partnerName: '山东华安赛服智能科技有限公司',
        partnerLevel: '一级服务商',
        status: 'active',
      }),
    ]);
  });

  it.skip('历史实时 OpenAPI 路线已停用：加入的服务商画像使用 joinDate 本地过滤', async () => {
    const listByResource = jest.fn(async () => ({
      items: [
        {
          id: 'P003',
          name: '济南新入驻服务商',
          partnerLevel: 'none',
          level: 'gold',
          region: '山东区',
          status: 'active',
          joinDate: '2025-08-10',
          createdAt: '',
          isTechService: true,
          techServiceType: 'full',
        },
        {
          id: 'P004',
          name: '历史服务商',
          partnerLevel: 'primary',
          region: '山东区',
          status: 'active',
          joinDate: '2024-05-10',
          createdAt: '',
        },
      ],
      pageNo: 1,
      pageSize: 200,
      total: 2,
    }));
    const service = new LianruanCrmAnalysisExecutorService(
      {
        isEnabled: jest.fn(() => true),
        getBootstrapSnapshot: jest.fn(async () => ({
          context: {
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
            partnerLevels: [{ value: 'primary', label: '一级服务商' }],
          },
        })),
      } as never,
      {
        listByResource,
        listPartnerContributions: jest.fn(),
      } as never,
    );

    const result = await service.executeTask(
      '最近一年加入的服务商有多少家，合作级别、等级、是否技术服务商维度一起给我。',
      {
        id: 'A030',
        name: '刘龙海',
      } as never,
      '全部权限',
      {
        taskId: 'task_partner_profile_created',
        taskTitle: '新增商机金额渠道商贡献',
        purpose: 'primary-summary',
        required: true,
        reportSection: 'summary',
        sql: 'SELECT ...',
        params: [],
        tables: ['opportunities', 'partners'],
        fieldMap: {
          opportunities: ['id', 'partner_id', 'expect_amount', 'created_at'],
          partners: ['id', 'name', 'partnerLevel', 'region', 'bigRegion', 'status'],
        },
        joinPaths: [],
        allowedFunctions: ['SUM', 'COUNT'],
        resultKind: 'partner-contribution',
        rowLimit: 100,
        timeoutMs: 3000,
        executionMode: 'PLAN_EXECUTION',
        executionSource: 'CRM_OFFICIAL_API',
        preferredSource: 'CRM_OFFICIAL_API',
        matchedAdapter: 'crm-official-api.opportunity-partner-contribution',
        gapReason: '',
        toolSpec: {
          toolId: 'crm-official-api.opportunity-partner-contribution',
          toolType: 'CRM_OFFICIAL_API',
          allowedStatements: ['CRM_API_GET'],
          allowedTables: ['opportunities', 'partners'],
          allowedFields: {
            opportunities: ['id', 'partner_id', 'expect_amount', 'created_at'],
            partners: ['id', 'name', 'partnerLevel', 'region', 'bigRegion', 'status'],
          },
          allowedFunctions: [],
          outputShape: 'DATASET_SLICE',
          rowLimit: 100,
          timeoutMs: 3000,
        },
        plan: {
          type: 'query-plan',
          domain: 'opportunity-analysis',
          baseTable: 'opportunities',
          joinTables: ['partners'],
          metrics: ['新增商机金额'],
          dimensions: ['渠道商'],
          filters: {
            startAt: '2025-06-08T00:00:00+08:00',
            endAt: '2026-06-08T00:00:00+08:00',
            timeRange: '最近一年',
          },
          groupBy: ['partner_id'],
          orderBy: [{ field: 'amount', direction: 'DESC' }],
          resultKind: 'partner-contribution',
          confidence: 'HIGH',
        },
      } as never,
    );

    expect(listByResource).toHaveBeenCalledWith(
      'partners',
      expect.objectContaining({
        sortBy: 'updatedAt',
      }),
    );
    const partnerListQuery = (listByResource.mock.calls[0] as unknown[])[1] as Record<
      string,
      unknown
    >;
    expect(partnerListQuery).not.toHaveProperty('createdAfter');
    expect(partnerListQuery).not.toHaveProperty('createdBefore');
    expect(result.summary).toContain('按服务商加入时间命中 1 家服务商');
    expect(result.metricCards).toEqual(
      expect.arrayContaining([
        { name: '服务商数量', value: 1 },
        { name: '技术服务商', value: 1 },
      ]),
    );
    expect(result.tableRows).toEqual([
      expect.objectContaining({
        partnerName: '济南新入驻服务商',
        partnerLevel: 'gold',
        joinDate: '2025-08-10',
        technicalServiceProvider: '是',
      }),
    ]);
    expect(result.appliedFilters).toEqual(
      expect.arrayContaining([
        { label: '画像统计口径', value: '按服务商加入时间统计。' },
      ]),
    );
  });

  it.skip('历史实时 OpenAPI 路线已停用：客户报备列表聚合状态分布结果', async () => {
    const service = new LianruanCrmAnalysisExecutorService(
      {
        isEnabled: jest.fn(() => true),
        getBootstrapSnapshot: jest.fn(async () => ({
          context: {
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
            registrationStatuses: [
              { value: 'approved', label: '已通过' },
              { value: 'pending', label: '待审批' },
            ],
          },
        })),
      } as never,
      {
        listByResource: jest.fn().mockResolvedValue({
          items: [
            {
              id: 'REG001',
              customer: '客户A',
              status: 'approved',
              assignedStaffId: 'A031',
              region: '山东区',
              createdAt: '2026-06-01T09:00:00.000Z',
            },
            {
              id: 'REG002',
              customer: '客户B',
              status: 'pending',
              assignedStaffId: 'A032',
              region: '山东区',
              createdAt: '2026-06-02T09:00:00.000Z',
            },
            {
              id: 'REG004',
              customer: '客户D',
              status: 'registered',
              assignedStaffId: 'A032',
              region: '山东区',
              createdAt: '2026-06-02T10:00:00.000Z',
            },
            {
              id: 'REG003',
              customer: '客户C',
              status: 'approved',
              assignedStaffId: 'A031',
              region: '华北区',
              createdAt: '2026-06-03T09:00:00.000Z',
            },
          ],
          pageNo: 1,
          pageSize: 200,
          total: 3,
        }),
      } as never,
    );

    const result = await service.executeTask(
      '山东区本月客户报备状态分布',
      {
        id: 'A030',
        name: '刘龙海',
      } as never,
      '全部权限',
      {
        taskId: 'task_customer_001',
        taskTitle: '客户报备状态分布',
        purpose: 'distribution',
        required: true,
        reportSection: 'distribution',
        sql: 'SELECT ...',
        params: [],
        tables: ['customers'],
        fieldMap: { customers: ['id', 'category'] },
        joinPaths: [],
        allowedFunctions: ['COUNT'],
        resultKind: 'category-distribution',
        rowLimit: 100,
        timeoutMs: 3000,
        executionMode: 'PLAN_EXECUTION',
        executionSource: 'CRM_OFFICIAL_API',
        preferredSource: 'CRM_OFFICIAL_API',
        matchedAdapter: 'crm-official-api.customer-category-distribution',
        gapReason: '',
        toolSpec: {
          toolId: 'crm-official-api.customer-category-distribution',
          toolType: 'CRM_OFFICIAL_API',
          allowedStatements: ['CRM_API_GET'],
          allowedTables: ['customers'],
          allowedFields: { customers: ['id', 'category'] },
          allowedFunctions: [],
          outputShape: 'DATASET_SLICE',
          rowLimit: 100,
          timeoutMs: 3000,
        },
        plan: {
          type: 'query-plan',
          domain: 'customer-relationship',
          baseTable: 'customers',
          joinTables: [],
          metrics: ['客户数量'],
          dimensions: ['客户分类'],
          filters: {
            startAt: '2026-06-01T00:00:00.000Z',
            endAt: '2026-07-01T00:00:00.000Z',
            timeRange: '2026年6月',
          },
          groupBy: ['category'],
          orderBy: [{ field: 'count', direction: 'DESC' }],
          resultKind: 'category-distribution',
          confidence: 'HIGH',
        },
      } as never,
    );

    expect(result.appliedFilters).toEqual(
      expect.arrayContaining([
        { label: '分析对象', value: '客户报备' },
        { label: '区域', value: '山东区' },
      ]),
    );
    expect(result.tableRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ownerName: '已通过',
          count: 1,
        }),
        expect.objectContaining({
          ownerName: '待审批',
          count: 1,
        }),
        expect.objectContaining({
          ownerName: '20%已登记/已报备',
          bucket_label: '20%已登记/已报备',
          stage: '20%已登记/已报备',
          count: 1,
        }),
      ]),
    );
    expect(result.primaryView?.series).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: '20%已登记/已报备',
        }),
      ]),
    );
    expect(result.sql).toContain('/registrations');
  });

  it.skip('历史实时 OpenAPI 路线已停用：订单列表聚合订单总览结果', async () => {
    const service = new LianruanCrmAnalysisExecutorService(
      {
        isEnabled: jest.fn(() => true),
        getBootstrapSnapshot: jest.fn(async () => ({
          context: {
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
          dictionaries: {},
        })),
      } as never,
      {
        listByResource: jest.fn().mockResolvedValue({
          items: [
            {
              id: 'ORD001',
              customerName: '客户A',
              total: 800000,
              assignedStaffId: 'A031',
              createdAt: '2026-06-01T09:00:00.000Z',
            },
            {
              id: 'ORD002',
              customerName: '客户B',
              total: 200000,
              assignedStaffId: 'A032',
              createdAt: '2026-06-02T09:00:00.000Z',
            },
          ],
          pageNo: 1,
          pageSize: 200,
          total: 2,
        }),
      } as never,
    );

    const result = await service.executeTask(
      '本月订单金额总览',
      {
        id: 'A030',
        name: '刘龙海',
      } as never,
      '全部权限',
      {
        taskId: 'task_order_001',
        taskTitle: '订单金额总览',
        purpose: 'primary-summary',
        required: true,
        reportSection: 'summary',
        sql: 'SELECT ...',
        params: [],
        tables: ['contracts'],
        fieldMap: { contracts: ['id'] },
        joinPaths: [],
        allowedFunctions: ['SUM', 'COUNT'],
        resultKind: 'metric-summary',
        rowLimit: 1,
        timeoutMs: 3000,
        executionMode: 'PLAN_EXECUTION',
        executionSource: 'CRM_OFFICIAL_API',
        preferredSource: 'CRM_OFFICIAL_API',
        matchedAdapter: 'crm-official-api.order-metric-summary',
        gapReason: '',
        toolSpec: {
          toolId: 'crm-official-api.order-metric-summary',
          toolType: 'CRM_OFFICIAL_API',
          allowedStatements: ['CRM_API_GET'],
          allowedTables: ['contracts'],
          allowedFields: { contracts: ['id'] },
          allowedFunctions: [],
          outputShape: 'DATASET_SLICE',
          rowLimit: 1,
          timeoutMs: 3000,
        },
        plan: {
          type: 'query-plan',
          domain: 'contract-conversion',
          baseTable: 'contracts',
          joinTables: [],
          metrics: ['订单金额'],
          dimensions: [],
          filters: {
            startAt: '2026-06-01T00:00:00.000Z',
            endAt: '2026-07-01T00:00:00.000Z',
            timeRange: '2026年6月',
          },
          groupBy: [],
          orderBy: [{ field: 'amount', direction: 'DESC' }],
          resultKind: 'metric-summary',
          confidence: 'HIGH',
        },
      } as never,
    );

    expect(result.metricCards).toEqual(
      expect.arrayContaining([
        { name: '累计订单金额', value: '100 万元' },
        { name: '命中订单数', value: 2 },
      ]),
    );
    expect(result.tableRows).toEqual([
      expect.objectContaining({
        ownerName: '订单总览',
        amount: 1000000,
        count: 2,
      }),
    ]);
    expect(result.sql).toContain('/orders');
  });

  it.skip('历史实时 OpenAPI 路线已停用：订单列表按服务商聚合渠道下单贡献', async () => {
    const listByResource = jest.fn(async (resource: string) => {
      if (resource === 'orders') {
        return {
          items: [
            {
              id: 'ORD001',
              totalAmount: 800000,
              partnerId: 'P001',
              partnerName: '山东联软服务商',
              region: '山东区',
              createdAt: '2026-04-01T09:00:00.000Z',
            },
            {
              id: 'ORD002',
              totalAmount: 200000,
              partnerId: 'P001',
              partnerName: '山东联软服务商',
              region: '山东区',
              createdAt: '2026-05-02T09:00:00.000Z',
            },
            {
              id: 'ORD003',
              totalAmount: 500000,
              partnerId: 'P002',
              partnerName: '济南渠道伙伴',
              region: '山东区',
              createdAt: '2026-05-20T09:00:00.000Z',
            },
          ],
          pageNo: 1,
          pageSize: 200,
          total: 3,
        };
      }

      return {
        items: [
          { id: 'P001', name: '山东联软服务商' },
          { id: 'P002', name: '济南渠道伙伴' },
        ],
        pageNo: 1,
        pageSize: 200,
        total: 2,
      };
    });
    const listPartnerContributions = jest.fn();
    const service = new LianruanCrmAnalysisExecutorService(
      {
        isEnabled: jest.fn(() => true),
        getBootstrapSnapshot: jest.fn(async () => ({
          context: {
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
          dictionaries: {},
        })),
      } as never,
      {
        listByResource,
        listPartnerContributions,
      } as never,
    );

    const result = await service.executeTask(
      '最近三个月山东区域，有下单的服务商，对应的订单数量、订单金额以及总金额，生成汇总分析报告',
      {
        id: 'A030',
        name: '刘龙海',
      } as never,
      '全部权限',
      {
        taskId: 'task_order_partner_001',
        taskTitle: '订单金额渠道商贡献',
        purpose: 'detail-table',
        required: true,
        reportSection: 'detail-table',
        sql: 'SELECT ...',
        params: [],
        tables: ['contracts', 'partners'],
        fieldMap: { contracts: ['id'], partners: ['id', 'name'] },
        joinPaths: [],
        allowedFunctions: ['SUM', 'COUNT'],
        resultKind: 'partner-contribution',
        rowLimit: 30,
        timeoutMs: 3000,
        executionMode: 'PLAN_EXECUTION',
        executionSource: 'CRM_OFFICIAL_API',
        preferredSource: 'CRM_OFFICIAL_API',
        matchedAdapter: 'crm-official-api.order-partner-contribution',
        gapReason: '',
        toolSpec: {
          toolId: 'crm-official-api.order-partner-contribution',
          toolType: 'CRM_OFFICIAL_API',
          allowedStatements: ['CRM_API_GET'],
          allowedTables: ['contracts', 'partners'],
          allowedFields: { contracts: ['id'], partners: ['id', 'name'] },
          allowedFunctions: [],
          outputShape: 'DATASET_SLICE',
          rowLimit: 30,
          timeoutMs: 3000,
        },
        plan: {
          type: 'query-plan',
          domain: 'contract-conversion',
          baseTable: 'contracts',
          joinTables: ['partners'],
          metrics: ['订单金额'],
          dimensions: ['渠道商'],
          filters: {
            startAt: '2026-03-01T00:00:00+08:00',
            endAt: '2026-06-01T00:00:00+08:00',
            timeRange: '最近三个月',
          },
          groupBy: ['partner_id'],
          orderBy: [{ field: 'amount', direction: 'DESC' }],
          resultKind: 'partner-contribution',
          confidence: 'HIGH',
        },
      } as never,
    );

    expect(listPartnerContributions).not.toHaveBeenCalled();
    expect(listByResource).toHaveBeenCalledWith('orders', expect.any(Object));
    expect(result.metricCards).toEqual(
      expect.arrayContaining([
        { name: '累计订单金额', value: '150 万元' },
        { name: '命中订单数', value: 3 },
      ]),
    );
    expect(result.tableRows).toEqual([
      expect.objectContaining({
        partnerName: '山东联软服务商',
        amount: 1000000,
        count: 2,
      }),
      expect.objectContaining({
        partnerName: '济南渠道伙伴',
        amount: 500000,
        count: 1,
      }),
    ]);
    expect(result.sql).toContain('/orders');
  });

  it.skip('历史实时 OpenAPI 路线已停用：当前时间范围为空时提示调整时间范围', async () => {
    const service = new LianruanCrmAnalysisExecutorService(
      {
        isEnabled: jest.fn(() => true),
        getBootstrapSnapshot: jest.fn(async () => ({
          context: {
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
          dictionaries: {},
        })),
      } as never,
      {
        listByResource: jest
          .fn()
          .mockResolvedValueOnce({
            items: [],
            pageNo: 1,
            pageSize: 200,
            total: 0,
          })
          .mockResolvedValueOnce({
            items: [
              {
                id: 'OPP001',
                name: 'NXG扩容',
                amount: 50000,
                region: '山东区',
                assignedStaffId: 'A031',
                assignedStaffName: '周丽姣',
                createdAt: '2026-05-28T05:47:00.367Z',
              },
            ],
            pageNo: 1,
            pageSize: 50,
            total: 1,
          }),
      } as never,
    );

    const result = await service.executeTask(
      '本月山东区商机情况',
      {
        id: 'A030',
        name: '刘龙海',
      } as never,
      '全部权限',
      {
        taskId: 'task_empty_hint_001',
        taskTitle: '区域经营贡献',
        purpose: 'primary-summary',
        required: true,
        reportSection: 'detail-table',
        sql: 'SELECT ...',
        params: [],
        tables: ['opportunities'],
        fieldMap: { opportunities: ['id', 'amount', 'created_at'] },
        joinPaths: [],
        allowedFunctions: ['SUM', 'COUNT'],
        resultKind: 'department-contribution',
        rowLimit: 100,
        timeoutMs: 3000,
        executionMode: 'PLAN_EXECUTION',
        executionSource: 'CRM_OFFICIAL_API',
        preferredSource: 'CRM_OFFICIAL_API',
        matchedAdapter: 'crm-official-api.opportunity-region-contribution',
        gapReason: '',
        toolSpec: {
          toolId: 'crm-official-api.opportunity-region-contribution',
          toolType: 'CRM_OFFICIAL_API',
          allowedStatements: ['CRM_API_GET'],
          allowedTables: ['opportunities'],
          allowedFields: { opportunities: ['id', 'amount'] },
          allowedFunctions: [],
          outputShape: 'DATASET_SLICE',
          rowLimit: 100,
          timeoutMs: 3000,
        },
        plan: {
          type: 'query-plan',
          domain: 'opportunity-analysis',
          baseTable: 'opportunities',
          joinTables: [],
          metrics: ['新增商机金额'],
          dimensions: ['区域'],
          filters: {
            startAt: '2026-06-01T00:00:00.000Z',
            endAt: '2026-07-01T00:00:00.000Z',
            timeRange: '2026年6月',
          },
          groupBy: ['department_id'],
          orderBy: [{ field: 'amount', direction: 'DESC' }],
          resultKind: 'department-contribution',
          confidence: 'HIGH',
        },
      } as never,
    );

    expect(result.rowCount).toBe(0);
    expect(result.summary).toContain('2026年6月');
    expect(result.summary).toContain('2026-05-28');
    expect(result.summary).toContain('最近三个月山东区商机情况');
  });

  it.skip('历史实时 OpenAPI 路线已停用：绑定账号不一致时阻止直接联调', async () => {
    const service = new LianruanCrmAnalysisExecutorService(
      {
        isEnabled: jest.fn(() => true),
        getBootstrapSnapshot: jest.fn(async () => ({
          context: {
            client: {
              id: 'client_superadmin',
              name: 'AI-agent-superadmin-sit',
              boundUserId: 'A030',
              status: 'active',
              allowedResources: ['opportunities'],
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
          dictionaries: {},
        })),
      } as never,
      {
        listByResource: jest.fn(),
      } as never,
    );

    await expect(
      service.executeTask(
        '最近商机情况',
        {
          id: 'A031',
          name: '王小红',
        } as never,
        '山东区',
        {
          taskId: 'task_001',
          taskTitle: '商机负责人排名',
          purpose: 'primary-summary',
          sql: 'SELECT ...',
          params: [],
          tables: ['opportunities'],
          fieldMap: { opportunities: ['id'] },
          joinPaths: [],
          allowedFunctions: ['SUM', 'COUNT'],
          resultKind: 'owner-ranking',
          rowLimit: 100,
          timeoutMs: 3000,
          executionMode: 'PLAN_EXECUTION',
          executionSource: 'CRM_OFFICIAL_API',
          preferredSource: 'CRM_OFFICIAL_API',
          matchedAdapter: 'crm-official-api.opportunity-owner-ranking',
          gapReason: '',
          toolSpec: {
            toolId: 'crm-official-api.opportunity-owner-ranking',
            toolType: 'CRM_OFFICIAL_API',
            allowedStatements: ['CRM_API_GET'],
            allowedTables: ['opportunities'],
            allowedFields: { opportunities: ['id'] },
            allowedFunctions: [],
            outputShape: 'DATASET_SLICE',
            rowLimit: 100,
            timeoutMs: 3000,
          },
          plan: {
            type: 'query-plan',
            domain: 'opportunity-analysis',
            baseTable: 'opportunities',
            joinTables: [],
            metrics: ['商机数量'],
            dimensions: ['销售负责人'],
            filters: {},
            groupBy: ['user_id', 'name'],
            orderBy: [{ field: 'amount', direction: 'DESC' }],
            resultKind: 'owner-ranking',
            confidence: 'HIGH',
          },
        } as never,
      ),
    ).rejects.toThrow(OfficialApiFallbackToSqlError);
  });

  it.skip('历史实时 OpenAPI 路线已停用：服务账号本地裁剪支持不同 CRM 用户', async () => {
    const previousAccessMode = process.env.CRM_STANDARD_OPEN_API_ACCESS_MODE;
    process.env.CRM_STANDARD_OPEN_API_ACCESS_MODE = 'service-client-with-local-scope';
    const listByResource = jest.fn(async () => ({
      items: [
        {
          id: 'OPP001',
          amount: 800000,
          partnerId: 'P001',
          partnerName: '山东联软服务商',
          region: '山东区',
          assignedStaffId: 'A031',
          assignedStaffName: '王小红',
          createdAt: '2026-06-01T09:00:00.000Z',
        },
        {
          id: 'OPP002',
          amount: 600000,
          partnerId: 'P002',
          partnerName: '青岛生态伙伴',
          region: '山东区',
          assignedStaffId: 'A032',
          assignedStaffName: '赵小明',
          createdAt: '2026-06-02T09:00:00.000Z',
        },
      ],
      pageNo: 1,
      pageSize: 200,
      total: 2,
    }));
    const listPartnerContributions = jest.fn();
    const service = new LianruanCrmAnalysisExecutorService(
      {
        isEnabled: jest.fn(() => true),
        getBootstrapSnapshot: jest.fn(async () => ({
          context: {
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
            regions: [{ value: '山东区', label: '山东区' }],
          },
        })),
      } as never,
      {
        listByResource,
        listPartnerContributions,
      } as never,
    );

    try {
      const result = await service.executeTask(
        '山东区域最近三个月有商机的服务商，对应商机数量和商机金额',
        {
          id: 'A031',
          name: '王小红',
          roleIds: ['sales'],
          roleNames: ['销售'],
          organizationIds: ['org_shandong'],
          departmentIds: ['dept_shandong'],
          ownerIds: ['A031'],
          isAdmin: false,
        } as never,
        '当前仅展示销售角色可访问的负责人范围。',
        {
          taskId: 'task_service_client_local_scope',
          taskTitle: '商机渠道商贡献',
          purpose: 'primary-summary',
          required: true,
          reportSection: 'summary',
          sql: 'SELECT ...',
          params: [],
          tables: ['opportunities', 'partners'],
          fieldMap: {
            opportunities: ['id', 'amount', 'partnerId', 'createdAt'],
            partners: ['id', 'name'],
          },
          joinPaths: [],
          allowedFunctions: ['SUM', 'COUNT'],
          resultKind: 'partner-contribution',
          rowLimit: 100,
          timeoutMs: 3000,
          executionMode: 'PLAN_EXECUTION',
          executionSource: 'CRM_OFFICIAL_API',
          preferredSource: 'CRM_OFFICIAL_API',
          matchedAdapter: 'crm-official-api.opportunity-partner-contribution',
          gapReason: '',
          toolSpec: {
            toolId: 'crm-official-api.opportunity-partner-contribution',
            toolType: 'CRM_OFFICIAL_API',
            allowedStatements: ['CRM_API_GET'],
            allowedTables: ['opportunities', 'partners'],
            allowedFields: {
              opportunities: ['id', 'amount', 'partnerId', 'createdAt'],
              partners: ['id', 'name'],
            },
            allowedFunctions: [],
            outputShape: 'DATASET_SLICE',
            rowLimit: 100,
            timeoutMs: 3000,
          },
          plan: {
            type: 'query-plan',
            domain: 'opportunity-analysis',
            baseTable: 'opportunities',
            joinTables: ['partners'],
            metrics: ['新增商机金额', '商机数量'],
            dimensions: ['渠道商', '区域'],
            filters: {
              startAt: '2026-03-01T00:00:00.000Z',
              endAt: '2026-07-01T00:00:00.000Z',
              timeRange: '最近三个月',
              ownerIds: ['A031'],
            },
            groupBy: ['partner_id'],
            orderBy: [{ field: 'amount', direction: 'DESC' }],
            resultKind: 'partner-contribution',
            confidence: 'HIGH',
          },
        } as never,
      );

      expect(listPartnerContributions).not.toHaveBeenCalled();
      expect(result.sql).toContain('/opportunities');
      expect(result.appliedFilters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            label: '权限范围',
            value: expect.stringContaining('二次裁剪'),
          }),
        ]),
      );
      expect(result.metricCards).toEqual(
        expect.arrayContaining([
          { name: '累计商机金额', value: '80 万元' },
          { name: '命中商机数', value: 1 },
          { name: '分组数量', value: 1 },
        ]),
      );
      expect(result.tableRows).toEqual([
        expect.objectContaining({
          partnerId: 'P001',
          partnerName: '山东联软服务商',
          amount: 800000,
          count: 1,
        }),
      ]);
    } finally {
      if (previousAccessMode === undefined) {
        delete process.env.CRM_STANDARD_OPEN_API_ACCESS_MODE;
      } else {
        process.env.CRM_STANDARD_OPEN_API_ACCESS_MODE = previousAccessMode;
      }
    }
  });
});

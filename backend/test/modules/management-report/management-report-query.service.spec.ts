import { ManagementReportQueryService } from '../../../src/modules/management-report/management-report-query.service';
import type { ManagementReportContext } from '../../../src/modules/management-report/management-report.types';
import {
  MANAGEMENT_REPORT_CONTRACTS,
  MANAGEMENT_REPORT_CUSTOMERS,
  MANAGEMENT_REPORT_LEADS,
  MANAGEMENT_REPORT_OPPORTUNITIES,
  MANAGEMENT_REPORT_PAYMENTS,
  type ManagementReportCustomerRecord,
  type ManagementReportLeadRecord,
  type ManagementReportOpportunityRecord,
  type ManagementReportPaymentPlanRecord,
  type ManagementReportPaymentRecord,
} from '../../../src/modules/management-report/management-report.mock-data';

describe('ManagementReportQueryService', () => {
  const service = new ManagementReportQueryService();
  const originalNodeEnv = process.env.NODE_ENV;
  const context: ManagementReportContext = {
    reportId: 'report_test',
    userId: 'user_sales_director',
    roleNames: ['销售总监'],
    scopeSummary: '测试范围',
    generatedAt: '2026-04-25T10:00:00.000Z',
    filter: {
      departmentId: 'all-company',
      departmentLabel: '全公司',
      presetKey: 'q1',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
      includedDepartmentIds: ['dept_sales', 'dept_region_east'],
    },
  };

  it('经营报表金额应统一展示为万元', () => {
    expect(service.formatCurrency(2940000)).toBe('294 万元');
    expect(service.formatCurrency(500000)).toBe('50 万元');
    expect(service.formatCurrency(66666)).toBe('6.67 万元');
  });

  it('总览核心指标应与样本基础数据一致', () => {
    const overview = service.buildOverview(context);
    const leads = MANAGEMENT_REPORT_LEADS.filter((item) => item.createdAt >= '2026-01-01' && item.createdAt <= '2026-03-31');
    const customers = MANAGEMENT_REPORT_CUSTOMERS.filter((item) => item.createdAt >= '2026-01-01' && item.createdAt <= '2026-03-31');
    const opportunities = MANAGEMENT_REPORT_OPPORTUNITIES.filter((item) => (item.getTime ?? item.createdAt) >= '2026-01-01' && (item.getTime ?? item.createdAt) <= '2026-03-31');
    const contracts = MANAGEMENT_REPORT_CONTRACTS.filter((item) => (item.signDate ?? item.createdAt) >= '2026-01-01' && (item.signDate ?? item.createdAt) <= '2026-03-31');
    const payments = MANAGEMENT_REPORT_PAYMENTS.filter((item) => item.receiveDate >= '2026-01-01' && item.receiveDate <= '2026-03-31');

    expect(overview.metricCards?.find((item) => item.key === 'leadCount')?.value).toBe(String(leads.length));
    expect(overview.metricCards?.find((item) => item.key === 'customerCount')?.value).toBe(String(customers.length));
    expect(overview.metricCards?.find((item) => item.key === 'opportunityAmount')?.value).toBe(
      service.formatCurrency(opportunities.reduce((sum, item) => sum + item.amount, 0)),
    );
    expect(overview.metricCards?.find((item) => item.key === 'contractAmount')?.value).toBe(
      service.formatCurrency(contracts.reduce((sum, item) => sum + item.amount, 0)),
    );
    expect(overview.metricCards?.find((item) => item.key === 'receivedAmount')?.value).toBe(
      service.formatCurrency(payments.reduce((sum, item) => sum + item.amount, 0)),
    );
  });

  it('总览口径摘要应只保留业务相关行项', () => {
    const overview = service.buildOverview(context);
    const caliber = overview.blocks.find((item) => item.blockId === 'overview-caliber');

    expect(caliber?.blockType).toBe('insight-table');
    expect((caliber as { rows: Array<{ label: string; value: string }> }).rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '统计周期', value: '2026-01-01 至 2026-03-31' }),
        expect.objectContaining({ label: '统计范围', value: '全公司' }),
      ]),
    );
    expect((caliber as { rows: Array<{ label: string; value: string }> }).rows).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '页面策略' }),
        expect.objectContaining({ label: '时间语义' }),
      ]),
    );
  });

  it('经营摘要的派生指标应与分子分母口径一致', () => {
    const summary = service.buildExecutiveSummary(context);
    const leads: ManagementReportLeadRecord[] = service.listLeadsInPeriod(context);
    const customerPool: ManagementReportCustomerRecord[] = service.listCustomersByEndDate(context);
    const payments: ManagementReportPaymentRecord[] = service.listPaymentsInPeriod(context);
    const overduePlans: ManagementReportPaymentPlanRecord[] = service.listOverduePlansByEndDate(context);

    expect(summary.metricCards?.find((item) => item.key === 'receivedAmount')?.value).toBe(
      service.formatCurrency(payments.reduce((sum, item) => sum + item.amount, 0)),
    );
    expect(summary.metricCards?.find((item) => item.key === 'overdueAmount')?.value).toBe(
      service.formatCurrency(overduePlans.reduce((sum, item) => sum + item.amount, 0)),
    );
    expect(summary.metricCards?.find((item) => item.key === 'leadConversionRate')?.value).toBe(
      service.formatPercent(
        leads.filter((item) => item.convertedCustomerAt).length,
        leads.length,
      ),
    );
    expect(summary.metricCards?.find((item) => item.key === 'customerActivationRate')?.value).toBe(
      service.formatPercent(
        customerPool.filter((item) => item.activeSince).length,
        customerPool.length,
      ),
    );
  });

  it('专题标题和信息完善度文案应使用业务表达', () => {
    const conversion = service.buildSection(context, 'lead-conversion');
    const agents = service.buildSection(context, 'agents');
    const products = service.buildSection(context, 'products');
    const risks = service.buildSection(context, 'risks');

    expect(conversion.blocks.find((item) => item.blockId === 'lead-conversion-funnel')?.title).toBe(
      '线索转化漏斗',
    );
    expect(agents.blocks.find((item) => item.blockId === 'agents-quality')?.title).toBe(
      '伙伴信息完善度',
    );
    expect(products.blocks.find((item) => item.blockId === 'products-quality')?.title).toBe(
      '方案信息完善度',
    );
    expect(risks.blocks.find((item) => item.blockId === 'risks-data-quality')?.title).toBe(
      '基础信息完善度',
    );

    expect(
      (agents.blocks.find((item) => item.blockId === 'agents-quality') as {
        rows: Array<{ fieldName: string }>;
      }).rows,
    ).not.toEqual(expect.arrayContaining([expect.objectContaining({ fieldName: '代理商字段' })]));
  });

  it('商机专题的负责人矩阵、排行和风险预览应与在手商机池一致', () => {
    const opportunities = service.buildSection(context, 'opportunities');
    const openOpportunities: ManagementReportOpportunityRecord[] =
      service.listOpenOpportunitiesByEndDate(context);
    const uniqueOwners = new Set(openOpportunities.map((item) => item.ownerName));
    const riskPool = service.listRiskOpportunities(context);
    const trendBlocks = opportunities.blocks.filter((item) => item.blockType === 'trend');

    const ownerMatrix = opportunities.blocks.find((item) => item.blockId === 'opportunity-owner-stage-matrix');
    const ownerRanking = opportunities.blocks.find((item) => item.blockId === 'opportunity-owner-ranking');
    const riskPreview = opportunities.blocks.find((item) => item.blockId === 'opportunity-risk-preview');
    const monthlyBreakdown = opportunities.blocks.find(
      (item) => item.blockId === 'opportunity-monthly-amount-breakdown',
    );
    const monthlyBreakdownRows = (
      monthlyBreakdown as unknown as {
        blockType: string;
        rows: Array<{
          monthLabel: string;
          count: string;
          amount: string;
          averageAmount: string;
        }>;
      }
    ).rows;

    expect(trendBlocks).toHaveLength(1);
    expect(ownerMatrix?.blockType).toBe('matrix-table');
    expect((ownerMatrix as { rows: Array<unknown> }).rows.length).toBe(uniqueOwners.size);
    expect(ownerRanking?.blockType).toBe('bar-ranking');
    expect((ownerRanking as { rows: Array<unknown> }).rows.length).toBe(uniqueOwners.size);
    expect(riskPreview?.blockType).toBe('record-preview');
    expect((riskPreview as { rows: Array<unknown> }).rows.length).toBe(riskPool.length);
    expect((monthlyBreakdown as { blockType?: string } | undefined)?.blockType).toBe('detail-table');
    expect(monthlyBreakdownRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          monthLabel: '2026-01',
        }),
        expect.objectContaining({
          monthLabel: '2026-02',
        }),
        expect.objectContaining({
          monthLabel: '2026-03',
        }),
      ]),
    );
  });

  it('真实库快照预加载应并行发起互不依赖的字段字典查询', async () => {
    process.env.NODE_ENV = 'production';
    const distinctResolvers: Array<(rows: Array<{ value: string | null }>) => void> = [];
    const executeQuery = jest.fn((sql: string) => {
      if (/select\s+distinct/iu.test(sql)) {
        return new Promise<Array<{ value: string | null }>>((resolve) => {
          distinctResolvers.push(resolve);
        });
      }

      return Promise.resolve([]);
    });
    const liveService = new ManagementReportQueryService({
      ensureLiveQueryReady: jest.fn(async () => true),
      executeQuery,
    } as never);

    try {
      const pending = liveService.prepareContextData({
        ...context,
        reportId: 'report_parallel_preload',
        organizationIds: ['org_north'],
        ownerIds: ['owner_sales_director'],
      });
      await Promise.resolve();
      await Promise.resolve();

      expect(distinctResolvers).toHaveLength(5);

      for (const resolve of distinctResolvers) {
        resolve([]);
      }
      await pending;
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('应用超级管理员真实库预加载不应生成 __none__ 范围占位参数', async () => {
    process.env.NODE_ENV = 'production';
    const executeQuery = jest.fn(async () => []);
    const liveService = new ManagementReportQueryService({
      ensureLiveQueryReady: jest.fn(async () => true),
      executeQuery,
    } as never);

    try {
      await liveService.prepareContextData({
        ...context,
        reportId: 'report_super_admin_full_access',
        organizationIds: ['org_north'],
        ownerIds: [],
        scopeSource: 'application-super-admin',
        isFullAccess: true,
        filter: {
          ...context.filter,
          includedDepartmentIds: [],
        },
      });

      const queryCalls = executeQuery.mock.calls as unknown as Array<[string, unknown[]?]>;
      const serializedParams = queryCalls
        .map((item) => JSON.stringify(item[1] ?? []))
        .join('\n');
      expect(serializedParams).not.toContain('__none__');
      expect(queryCalls.some(([sql]) =>
        String(sql).includes('where 1 = 1'),
      )).toBe(true);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('同一报表上下文并发预加载时应复用同一轮真实库查询', async () => {
    process.env.NODE_ENV = 'production';
    const distinctResolvers: Array<(rows: Array<{ value: string | null }>) => void> = [];
    const executeQuery = jest.fn((sql: string) => {
      if (/select\s+distinct/iu.test(sql)) {
        return new Promise<Array<{ value: string | null }>>((resolve) => {
          distinctResolvers.push(resolve);
        });
      }

      return Promise.resolve([]);
    });
    const liveService = new ManagementReportQueryService({
      ensureLiveQueryReady: jest.fn(async () => true),
      executeQuery,
    } as never);
    const liveContext = {
      ...context,
      reportId: 'report_dedupe_preload',
      organizationIds: ['org_north'],
      ownerIds: ['owner_sales_director'],
    };

    try {
      const firstPending = liveService.prepareContextData(liveContext);
      const secondPending = liveService.prepareContextData(liveContext);
      await Promise.resolve();
      await Promise.resolve();

      expect(distinctResolvers).toHaveLength(5);

      for (const resolve of distinctResolvers) {
        resolve([]);
      }
      await Promise.all([firstPending, secondPending]);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('线索专题的负责人汇总与来源状态矩阵应保持和底层线索池一致', () => {
    const leadsSection = service.buildSection(context, 'leads');
    const leads: ManagementReportLeadRecord[] = service.listLeadsInPeriod(context);
    const uniqueOwners = new Set(leads.map((item) => item.ownerName));
    const ownerResponseBlock = leadsSection.blocks.find(
      (item) => item.blockId === 'leads-owner-response',
    ) as unknown as {
      rows: Array<{
        ownerName: string;
        leadCount: string;
        avgResponseHours: string;
        highQualityCount: string;
      }>;
    };
    const matrixBlock = leadsSection.blocks.find(
      (item) => item.blockId === 'leads-source-status-matrix',
    ) as unknown as {
      columns: string[];
      rows: Array<{ label: string; values: string[] }>;
    };

    expect(ownerResponseBlock.rows.length).toBe(uniqueOwners.size);
    expect(ownerResponseBlock.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ownerName: '李浩',
          leadCount: '4',
          avgResponseHours: '32.0 小时',
          highQualityCount: '2',
        }),
      ]),
    );

    const sourceRow = matrixBlock.rows.find((item) => item.label === '转介绍');
    const statusIndex = matrixBlock.columns.findIndex((item) => item === '已转客户');
    expect(sourceRow).toBeDefined();
    expect(statusIndex).toBeGreaterThanOrEqual(0);
    expect(sourceRow?.values[statusIndex]).toBe('2');
  });

  it('需求标签提取应识别常见别名，避免把多种需求都压成通用安全', () => {
    const extractDemandTag = (
      service as unknown as {
        extractDemandTag: (requirement?: string | null) => string;
      }
    ).extractDemandTag.bind(service);

    const tags = [
      '客户想做 NAC 准入控制，统一管理办公终端接入。',
      '总部要求处理跨区域文件交换和安全摆渡需求。',
      '希望补齐终端防护与 EDR 告警联动。',
      '研发团队需要代码和图纸加密，防止外发泄密。',
      '移动办公安全需要覆盖手机和平板访问。',
    ].map((item) => extractDemandTag(item));

    expect(tags).toEqual([
      '终端准入',
      '跨网文件交换',
      '终端安全',
      '研发数据加密',
      '移动办公',
    ]);
  });

  it('线索转化专题的老客户回流口径应跟随筛选开始日期变化', () => {
    const customContext: ManagementReportContext = {
      ...context,
      reportId: 'report_custom_start',
      filter: {
        ...context.filter,
        presetKey: 'custom',
        startDate: '2026-02-01',
        endDate: '2026-03-31',
      },
    };
    const conversion = service.buildSection(customContext, 'lead-conversion');
    const oldCustomerBlock = conversion.blocks.find(
      (item) => item.blockId === 'lead-conversion-old-customer',
    ) as unknown as {
      rows: Array<{ companyName: string }>;
    };

    expect(oldCustomerBlock.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ companyName: '山东农信' }),
        expect.objectContaining({ companyName: '佛山智造装备' }),
      ]),
    );
  });

  it('运行态应保留同名行业字段的多个定义，并按资产 custom_field_id 解码客户行业', async () => {
    const executeQuery = jest.fn()
      .mockResolvedValueOnce([
        {
          id: 216387,
          label: '所属主行业',
          field_type: 'multi_select',
          options:
            "--- !ruby/hash:ActiveSupport::HashWithIndifferentAccess\nselect_options:\n- - 金融\n  - mul_c13a\n- - 能源电力\n  - mul_4474\n- - 制造业（包含烟草）\n  - mul_f271\n",
        },
        {
          id: 468519,
          label: '所属主行业',
          field_type: 'multi_select',
          options:
            "--- !ruby/hash:ActiveSupport::HashWithIndifferentAccess\nselect_options:\n- - 金融\n  - mul_6e7f\n- - 能源电力\n  - mul_a7bd\n- - 制造业（包含烟草）\n  - mul_090d\n",
        },
      ])
      .mockResolvedValueOnce([
        {
          customerId: 'customer_live_1',
          customFieldId: 216387,
          textAsset: 'mul_f271',
        },
        {
          customerId: 'customer_live_2',
          customFieldId: 216387,
          textAsset: 'mul_c13a,mul_4474',
        },
      ]);
    const liveService = new ManagementReportQueryService({
      executeQuery,
    } as never);

    const definitions = await (liveService as any).loadCustomFieldDefinitions(
      ['org_a'],
      ['所属主行业'],
    );
    const assetMap = await (liveService as any).loadCustomerAssetMap(
      ['customer_live_1', 'customer_live_2'],
      definitions,
    );

    expect(definitions).toHaveLength(2);
    expect(assetMap.get('customer_live_1')).toEqual({
      mainIndustry: '制造业（包含烟草）',
    });
    expect(assetMap.get('customer_live_2')).toEqual({
      mainIndustry: '金融、能源电力',
    });
  });

  it('运行态应从咨询角色、咨询内容和产品类型识别伙伴角色与需求标签', async () => {
    const executeQuery = jest.fn()
      .mockResolvedValueOnce([
        {
          id: 216323,
          label: '咨询内容',
          origin_label: '咨询内容',
          field_type: 'text_field',
          options: '',
        },
        {
          id: 216330,
          label: '咨询角色',
          origin_label: '咨询角色',
          field_type: 'multi_select',
          options:
            "--- !ruby/hash:ActiveSupport::HashWithIndifferentAccess\nselect_options:\n- - 最终用户\n  - mul_e2d9\n- - 代理商\n  - mul_69fb\n- - 同行\n  - mul_8d7e\n",
        },
        {
          id: 216398,
          label: '产品类型',
          origin_label: '产品类型',
          field_type: 'multi_select',
          options:
            "--- !ruby/hash:ActiveSupport::HashWithIndifferentAccess\nselect_options:\n- - NAC(网络准入控制系统)\n  - mul_a711\n- - NXG(安全数据摆渡系统)\n  - mul_b960\n",
        },
      ])
      .mockResolvedValueOnce([
        {
          leadId: 'lead_live_1',
          customFieldId: 216323,
          textAsset: '代理商咨询 NAC，希望做办公网终端准入。',
        },
        {
          leadId: 'lead_live_1',
          customFieldId: 216330,
          textAsset: 'mul_69fb',
        },
        {
          leadId: 'lead_live_1',
          customFieldId: 216398,
          textAsset: 'mul_a711',
        },
        {
          leadId: 'lead_live_2',
          customFieldId: 216323,
          textAsset: '同行客户咨询 NXG 摆渡需求。',
        },
        {
          leadId: 'lead_live_2',
          customFieldId: 216330,
          textAsset: 'mul_8d7e',
        },
        {
          leadId: 'lead_live_2',
          customFieldId: 216398,
          textAsset: 'mul_b960',
        },
      ]);
    const liveService = new ManagementReportQueryService({
      executeQuery,
    } as never);

    const definitions = await (liveService as any).loadCustomFieldDefinitions(
      ['org_a'],
      ['咨询内容', '咨询角色', '产品类型'],
    );
    const assetMap = await (liveService as any).loadLeadAssetMap(
      ['lead_live_1', 'lead_live_2'],
      definitions,
    );
    const resolveCustomerRole = (
      liveService as unknown as {
        resolveCustomerRole: (
          requirement?: string | null,
          companyName?: string | null,
        ) => string;
      }
    ).resolveCustomerRole.bind(liveService);
    const extractDemandTag = (
      liveService as unknown as {
        extractDemandTag: (requirement?: string | null) => string;
      }
    ).extractDemandTag.bind(liveService);

    expect(assetMap.get('lead_live_1')).toEqual({
      consultationContent: '代理商咨询 NAC，希望做办公网终端准入。',
      consultationRole: '代理商',
      productType: 'NAC(网络准入控制系统)',
    });
    expect(assetMap.get('lead_live_2')).toEqual({
      consultationContent: '同行客户咨询 NXG 摆渡需求。',
      consultationRole: '同行',
      productType: 'NXG(安全数据摆渡系统)',
    });
    expect(
      resolveCustomerRole(
        [assetMap.get('lead_live_1')?.consultationRole, assetMap.get('lead_live_1')?.consultationContent]
          .filter(Boolean)
          .join('；'),
        '某公司',
      ),
    ).toBe('代理商');
    expect(
      resolveCustomerRole(
        [assetMap.get('lead_live_2')?.consultationRole, assetMap.get('lead_live_2')?.consultationContent]
          .filter(Boolean)
          .join('；'),
        '某科技公司',
      ),
    ).toBe('集成商');
    expect(
      extractDemandTag(
        [assetMap.get('lead_live_1')?.consultationContent, assetMap.get('lead_live_1')?.productType]
          .filter(Boolean)
          .join('；'),
      ),
    ).toBe('终端准入');
    expect(
      extractDemandTag(
        [assetMap.get('lead_live_2')?.consultationContent, assetMap.get('lead_live_2')?.productType]
          .filter(Boolean)
          .join('；'),
      ),
    ).toBe('跨网文件交换');
  });

  it('运行态应能命中全局字段与改名字段的 origin_label，避免客户行业全部落成未分类', async () => {
    const executeQuery = jest.fn().mockResolvedValueOnce([
      {
        id: 700001,
        label: '客户主行业（新版）',
        origin_label: '所属主行业',
        field_type: 'multi_select',
        options:
          "--- !ruby/hash:ActiveSupport::HashWithIndifferentAccess\nselect_options:\n- - 制造\n  - mul_make\n- - 医疗\n  - mul_medical\n",
      },
      {
        id: 700002,
        label: '所属主行业',
        origin_label: '所属主行业',
        field_type: 'multi_select',
        options:
          "--- !ruby/hash:ActiveSupport::HashWithIndifferentAccess\nselect_options:\n- - 金融\n  - mul_finance\n",
      },
    ]);
    const liveService = new ManagementReportQueryService({
      executeQuery,
    } as never);

    const definitions = await (liveService as any).loadCustomFieldDefinitions(
      ['org_a'],
      ['所属主行业'],
    );

    expect(definitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 700001, label: '客户主行业（新版）' }),
        expect.objectContaining({ id: 700002, label: '所属主行业' }),
      ]),
    );
    expect(executeQuery).toHaveBeenCalledWith(
      expect.stringContaining('origin_label in (?)'),
      [['所属主行业'], ['所属主行业'], ['org_a']],
    );
  });

  it('真实库经营快照应按承诺字段、有效收入和审批完成口径取数', async () => {
    process.env.NODE_ENV = 'production';
    const executedSql: string[] = [];
    const executeQuery = jest.fn(async (sql: string) => {
      executedSql.push(sql);

      if (/select\s+distinct/iu.test(sql)) {
        return [];
      }

      if (/from\s+custom_fields/iu.test(sql)) {
        return [];
      }

      if (/from\s+customers\s+c/iu.test(sql)) {
        return [
          {
            id: 'customer_live_1',
            departmentId: 'dept_sales',
            userId: 'owner_live_1',
            ownerName: '销售一',
            name: '客户一',
            companyName: '客户一公司',
            createdAt: '2026-01-02',
            categoryCode: null,
            latestFollowUpAt: '2026-03-01',
          },
        ];
      }

      if (/from\s+customer_addresses/iu.test(sql) || /from\s+customer_assets/iu.test(sql)) {
        return [];
      }

      if (/from\s+opportunities\s+o/iu.test(sql)) {
        return [
          {
            id: 'opportunity_stage_only',
            departmentId: 'dept_sales',
            userId: 'owner_live_1',
            ownerName: '销售一',
            customerId: 'customer_live_1',
            customerName: '客户一',
            amount: 100000,
            stageCode: '30%',
            sourceCode: null,
            kindCode: null,
            createdAt: '2026-02-01',
            getTime: '2026-02-01',
            expectSignDate: '2026-03-01',
            revisitAt: '2026-02-20',
            stageUpdatedAt: '2026-02-15',
          },
          {
            id: 'opportunity_committed',
            departmentId: 'dept_sales',
            userId: 'owner_live_1',
            ownerName: '销售一',
            customerId: 'customer_live_1',
            customerName: '客户一',
            amount: 200000,
            stageCode: '10%',
            sourceCode: null,
            kindCode: null,
            createdAt: '2026-02-05',
            getTime: '2026-02-05',
            expectSignDate: '2026-03-20',
            revisitAt: '2026-02-21',
            stageUpdatedAt: '2026-02-16',
          },
        ];
      }

      if (/from\s+opportunity_assets/iu.test(sql)) {
        return [
          {
            opportunityId: 'opportunity_committed',
            customFieldId: null,
            customFieldName: 'text_asset_96585a',
            textAsset: 'sel_0cae',
          },
        ];
      }

      if (/from\s+contracts\s+ct/iu.test(sql)) {
        return [
          {
            id: 'contract_live_1',
            departmentId: 'dept_sales',
            userId: 'owner_live_1',
            ownerName: '销售一',
            customerId: 'customer_live_1',
            customerName: '客户一',
            amount: 600000,
            createdAt: '2026-02-08',
            signDate: '2026-02-10',
            statusCode: null,
            endAt: '2026-03-10',
            receivedPaymentsAmount: 0,
            unreceivedAmount: 0,
          },
        ];
      }

      if (/from\s+received_payment_plans/iu.test(sql) || /from\s+received_payments/iu.test(sql)) {
        return [];
      }

      if (/from\s+leads\s+l/iu.test(sql)) {
        return [];
      }

      return [];
    });
    const liveService = new ManagementReportQueryService({
      ensureLiveQueryReady: jest.fn(async () => true),
      executeQuery,
    } as never);
    const liveContext: ManagementReportContext = {
      ...context,
      reportId: 'report_live_caliber',
      organizationIds: ['org_live'],
      ownerIds: ['owner_live_1'],
    };

    try {
      await liveService.prepareContextData(liveContext);

      const opportunities = liveService.listOpportunitiesInPeriod(liveContext);
      const contracts = liveService.listContractsInPeriod(liveContext);

      expect(opportunities.find((item) => item.id === 'opportunity_stage_only')?.promised).toBe(false);
      expect(opportunities.find((item) => item.id === 'opportunity_committed')?.promised).toBe(true);
      expect(contracts[0]?.amount).toBe(600000);
      expect(executedSql.find((item) => /from\s+opportunities\s+o/iu.test(item))).toContain(
        "oa_commitment.custom_field_name = 'text_asset_96585a'",
      );
      expect(executedSql.find((item) => /from\s+contracts\s+ct/iu.test(item))).toContain(
        "custom_field_name = 'numeric_asset_7ee237'",
      );
      for (const tablePattern of [
        /from\s+customers\s+c/iu,
        /from\s+opportunities\s+o/iu,
        /from\s+contracts\s+ct/iu,
        /from\s+received_payments\s+rp/iu,
      ]) {
        expect(executedSql.find((item) => tablePattern.test(item))).toContain('finish_approve_at');
      }
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('客户专题的总览和风险客户预览应与客户池一致', () => {
    const customers = service.buildSection(context, 'customers');
    const customerPool: ManagementReportCustomerRecord[] = service.listCustomersByEndDate(context);
    const newCustomers: ManagementReportCustomerRecord[] = service.listCustomersInPeriod(context);
    const blankCustomers = customerPool.filter((item) => !item.hasOpportunity);
    const poolSummary = customers.blocks.find((item) => item.blockId === 'customers-pool-summary');
    const riskPreview = customers.blocks.find((item) => item.blockId === 'customers-blank-market');

    expect(poolSummary?.blockType).toBe('metric-strip');
    expect((poolSummary as { items: Array<{ label: string; value: string }> }).items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '客户总数', value: String(customerPool.length) }),
        expect.objectContaining({ label: '新建客户', value: String(newCustomers.length) }),
        expect.objectContaining({ label: '无商机客户', value: String(blankCustomers.length) }),
      ]),
    );
    expect((riskPreview as { rows: Array<unknown> }).rows.length).toBe(blankCustomers.length);
  });

  it('收款专题的回款率、销售收款和逾期项目应彼此一致', () => {
    const collections = service.buildSection(context, 'collections');
    const payments: ManagementReportPaymentRecord[] = service.listPaymentsInPeriod(context);
    const plans: ManagementReportPaymentPlanRecord[] = service.listPaymentPlansInPeriod(context);
    const overduePlans: ManagementReportPaymentPlanRecord[] = service.listOverduePlansByEndDate(context);
    const ownerRows = new Set(
      (plans as Array<ManagementReportPaymentPlanRecord & { ownerName: string }>).map(
        (item) => item.ownerName,
      ),
    );

    const summary = collections.blocks.find((item) => item.blockId === 'collections-summary');
    const sales = collections.blocks.find((item) => item.blockId === 'collections-sales');
    const overdue = collections.blocks.find((item) => item.blockId === 'collections-overdue-projects');

    expect(summary?.blockType).toBe('metric-strip');
    expect((summary as { items: Array<{ label: string; value: string }> }).items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: '期内回款',
          value: service.formatCurrency(payments.reduce((sum, item) => sum + item.amount, 0)),
        }),
        expect.objectContaining({
          label: '计划应收',
          value: service.formatCurrency(plans.reduce((sum, item) => sum + item.amount, 0)),
        }),
        expect.objectContaining({
          label: '逾期应收',
          value: service.formatCurrency(overduePlans.reduce((sum, item) => sum + item.amount, 0)),
        }),
      ]),
    );
    expect((sales as { rows: Array<unknown> }).rows.length).toBe(ownerRows.size);
    expect((overdue as { rows: Array<unknown> }).rows.length).toBe(overduePlans.length);
  });

  it('风险专题的核心风险、汇总和风险预览应引用同一组底层对象池', () => {
    const risks = service.buildSection(context, 'risks');
    const riskLeads = service
      .listLeadsInPeriod(context)
      .filter((item: ManagementReportLeadRecord) => item.riskFlag);
    const riskOpportunities: ManagementReportOpportunityRecord[] =
      service.listRiskOpportunities(context);
    const overduePlans: ManagementReportPaymentPlanRecord[] = service.listOverduePlansByEndDate(context);
    const noOpportunityCustomers = service
      .listCustomersByEndDate(context)
      .filter((item: ManagementReportCustomerRecord) => !item.hasOpportunity);

    const summary = risks.blocks.find((item) => item.blockId === 'risks-summary');
    const opportunityPreview = risks.blocks.find((item) => item.blockId === 'risks-opportunity-preview');
    const customerPreview = risks.blocks.find((item) => item.blockId === 'risks-customer-preview');

    expect(summary?.blockType).toBe('insight-table');
    expect((summary as { rows: Array<{ label: string; value: string }> }).rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '待处理 / 风险线索', value: String(riskLeads.length) }),
        expect.objectContaining({ label: '风险商机', value: String(riskOpportunities.length) }),
        expect.objectContaining({ label: '无商机客户', value: String(noOpportunityCustomers.length) }),
        expect.objectContaining({ label: '逾期应收计划', value: String(overduePlans.length) }),
      ]),
    );
    expect((opportunityPreview as { rows: Array<unknown> }).rows.length).toBe(riskOpportunities.length);
    expect((customerPreview as { rows: Array<unknown> }).rows.length).toBe(noOpportunityCustomers.length);
  });
});

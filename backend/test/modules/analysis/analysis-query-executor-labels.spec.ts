import { AnalysisQueryExecutorService } from '../../../src/modules/analysis/analysis-query-executor.service';

describe('AnalysisQueryExecutorService labels', () => {
  it('商机负责人排名结果应把底层 count 指标命名为命中商机数，而不是记录数', () => {
    const service = new AnalysisQueryExecutorService({
      listOpportunities: jest.fn(() => [
        {
          id: 'opp_001',
          title: '项目A',
          ownerId: 'owner_bu',
          ownerName: '布春雨',
          organizationId: 'org_north',
          departmentId: 'dept_sales',
          expectAmount: 13777034,
          stage: '初访',
          createdAt: '2026-04-10T09:00:00.000Z',
        },
        {
          id: 'opp_002',
          title: '项目B',
          ownerId: 'owner_bu',
          ownerName: '布春雨',
          organizationId: 'org_north',
          departmentId: 'dept_sales',
          expectAmount: 1000,
          stage: '方案',
          createdAt: '2026-04-11T09:00:00.000Z',
        },
        {
          id: 'opp_003',
          title: '项目C',
          ownerId: 'owner_wang',
          ownerName: '王亮2',
          organizationId: 'org_north',
          departmentId: 'dept_sales',
          expectAmount: 66666,
          stage: '谈判',
          createdAt: '2026-04-12T09:00:00.000Z',
        },
      ]),
      listContracts: jest.fn(() => []),
      listCustomers: jest.fn(() => []),
    } as never);

    const compiledTask = {
      taskId: 'task_001',
      taskTitle: '新增商机金额排名',
      purpose: 'primary-summary',
      resultKind: 'owner-ranking',
      sql: 'SELECT ...',
      params: [],
      tables: ['opportunities'],
      fieldMap: {},
      joinPaths: [],
      allowedFunctions: ['SUM', 'COUNT'],
      rowLimit: 100,
      timeoutMs: 3000,
      plan: {
        domain: 'opportunity-analysis',
        filters: {
          organizationIds: ['org_north'],
          startAt: '2026-03-31T16:00:00.000Z',
          endAt: '2026-04-30T16:00:00.000Z',
          timeRange: '本月',
        },
        temporalSlot: {
          rawText: '本月',
          normalizedLabel: '本月',
          startAt: '2026-03-31T16:00:00.000Z',
          endAt: '2026-04-30T16:00:00.000Z',
          timezone: 'Asia/Shanghai',
          granularity: 'month',
          relativity: 'relative',
          inclusivity: { start: 'inclusive', end: 'exclusive' },
          confidence: 'HIGH',
        },
      },
    } as never;

    const result = (service as never as {
      buildMockTaskResult: (
        questionText: string,
        compiledTask: Record<string, unknown>,
      ) => {
        metricCards: Array<{ name: string; value: string | number }>;
      };
    }).buildMockTaskResult('本月各销售负责人新增商机金额排名', compiledTask);

    expect(result.metricCards).toEqual(
      expect.arrayContaining([
        { name: '命中商机数', value: 3 },
        { name: '分组数量', value: 2 },
      ]),
    );
    expect(result.metricCards.map((item) => item.name)).not.toContain('记录数');
  });

  it('阶段分布 live 结果应把阶段码映射为中文标签，并把空值标记为未填写阶段', async () => {
    const service = new AnalysisQueryExecutorService({
      resolveFieldValueLabels: jest.fn(async () => ({
        '89057': '初步接触',
        '89058': '方案评估',
      })),
    } as never);

    const result = await (service as never as {
      buildLiveTaskResult: (
        questionText: string,
        compiledTask: Record<string, unknown>,
        rows: Array<Record<string, unknown>>,
      ) => Promise<{
        tableRows: Array<Record<string, unknown>>;
        primaryView?: { series?: Array<Record<string, unknown>> };
      }>;
    }).buildLiveTaskResult(
      '最近四个月的商机情况',
      {
        taskId: 'task_001',
        taskTitle: '线索漏斗结构',
        purpose: 'primary-summary',
        resultKind: 'stage-distribution',
        sql: 'SELECT ...',
        params: [],
        tables: ['opportunities'],
        fieldMap: {},
        joinPaths: [],
        allowedFunctions: ['SUM', 'COUNT'],
        rowLimit: 100,
        timeoutMs: 3000,
        plan: {
          domain: 'opportunity-analysis',
          filters: {
            organizationIds: ['1'],
          },
          temporalSlot: {
            rawText: '最近四个月',
            normalizedLabel: '最近四个月',
            startAt: '2025-12-31T16:00:00.000Z',
            endAt: '2026-04-30T16:00:00.000Z',
            timezone: 'Asia/Shanghai',
            granularity: 'month',
            relativity: 'relative',
            inclusivity: { start: 'inclusive', end: 'exclusive' },
            confidence: 'HIGH',
          },
        },
      },
      [
        { bucket_label: '89057', amount: 100316369, count: 10 },
        { bucket_label: '89058', amount: 22901820.4, count: 8 },
        { bucket_label: '', amount: 66666, count: 1 },
      ],
    );

    expect(result.tableRows).toEqual([
      expect.objectContaining({ bucket_label: '89057', ownerName: '初步接触' }),
      expect.objectContaining({ bucket_label: '89058', ownerName: '方案评估' }),
      expect.objectContaining({ bucket_label: '', ownerName: '未填写阶段' }),
    ]);
    expect(result.primaryView?.series).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '初步接触' }),
        expect.objectContaining({ label: '方案评估' }),
        expect.objectContaining({ label: '未填写阶段' }),
      ]),
    );
  });

  it('区域经营贡献 live 结果应优先展示部门名称，而不是部门 ID', async () => {
    const service = new AnalysisQueryExecutorService({} as never);

    const result = await (service as never as {
      buildLiveTaskResult: (
        questionText: string,
        compiledTask: Record<string, unknown>,
        rows: Array<Record<string, unknown>>,
      ) => Promise<{
        tableRows: Array<Record<string, unknown>>;
        primaryView?: { series?: Array<Record<string, unknown>> };
      }>;
    }).buildLiveTaskResult(
      '1-2月份各区域经营情况',
      {
        taskId: 'task_region',
        taskTitle: '区域经营贡献',
        purpose: 'primary-summary',
        resultKind: 'department-contribution',
        sql: 'SELECT ...',
        params: [],
        tables: ['opportunities', 'departments'],
        fieldMap: {},
        joinPaths: [],
        allowedFunctions: ['SUM', 'COUNT', 'COALESCE', 'CONCAT'],
        rowLimit: 100,
        timeoutMs: 3000,
        plan: {
          domain: 'opportunity-analysis',
          filters: {
            organizationIds: ['10804'],
          },
          temporalSlot: {
            rawText: '1-2月份',
            normalizedLabel: '2026年1月至2月',
            startAt: '2026-01-01T00:00:00+08:00',
            endAt: '2026-03-01T00:00:00+08:00',
            timezone: 'Asia/Shanghai',
            granularity: 'month',
            relativity: 'absolute',
            inclusivity: { start: 'inclusive', end: 'exclusive' },
            confidence: 'HIGH',
          },
        },
      },
      [
        {
          bucket_label: '5768',
          department_name: '北区金融部',
          amount: 15641021,
          count: 8,
        },
      ],
    );

    expect(result.tableRows).toEqual([
      expect.objectContaining({
        bucket_label: '北区金融部',
        ownerId: '5768',
        ownerName: '北区金融部',
      }),
    ]);
    expect(result.primaryView?.series).toEqual([
      expect.objectContaining({
        label: '北区金融部',
      }),
    ]);
    expect(result.primaryView?.series?.[0]?.label).not.toBe('5768');
  });

  it('合同金额总览 live 结果应使用全量合同金额和命中合同数作为指标卡', async () => {
    const service = new AnalysisQueryExecutorService({} as never);

    const result = await (service as never as {
      buildLiveTaskResult: (
        questionText: string,
        compiledTask: Record<string, unknown>,
        rows: Array<Record<string, unknown>>,
      ) => Promise<{
        metricCards: Array<{ name: string; value: string | number }>;
        tableRows: Array<Record<string, unknown>>;
      }>;
    }).buildLiveTaskResult(
      '26年公司合同金额是多少？排名前三的销售分别是谁？',
      {
        taskId: 'task_total',
        taskTitle: '合同金额总览',
        purpose: 'primary-summary',
        resultKind: 'metric-summary',
        sql: 'SELECT ...',
        params: [],
        tables: ['contracts'],
        fieldMap: {},
        joinPaths: [],
        allowedFunctions: ['SUM', 'COUNT'],
        rowLimit: 1,
        timeoutMs: 3000,
        plan: {
          domain: 'contract-conversion',
          filters: {
            organizationIds: ['10804'],
          },
          temporalSlot: {
            rawText: '26年',
            normalizedLabel: '2026年',
            startAt: '2026-01-01T00:00:00+08:00',
            endAt: '2027-01-01T00:00:00+08:00',
            timezone: 'Asia/Shanghai',
            granularity: 'year',
            relativity: 'absolute',
            inclusivity: { start: 'inclusive', end: 'exclusive' },
            confidence: 'HIGH',
          },
        },
      },
      [{ amount: 87397279.7, count: 689 }],
    );

    expect(result.metricCards).toEqual([
      { name: '合同金额', value: '87,397,279.70' },
      { name: '命中合同数', value: 689 },
    ]);
    expect(result.tableRows).toEqual([
      expect.objectContaining({
        ownerName: '合同金额总览',
        amount: 87397279.7,
        count: 689,
      }),
    ]);
  });
});

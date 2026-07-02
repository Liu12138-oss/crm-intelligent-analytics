import { AnalysisIntentService } from '../../src/modules/analysis/analysis-intent.service';
import { BusinessAnalysisIntentMapperService } from '../../src/modules/analysis/business-analysis-intent-mapper.service';
import { AiGatewayService } from '../../src/modules/analysis/ai-gateway.service';
import { QueryAstValidatorService } from '../../src/modules/analysis/query-ast-validator.service';
import { QueryCompilerService, type CompiledQuery } from '../../src/modules/analysis/query-compiler.service';
import { QueryPreflightService } from '../../src/modules/analysis/query-preflight.service';
import { QueryRiskGuardService } from '../../src/modules/analysis/query-risk-guard.service';
import { LianruanCrmFieldCapabilityRegistry } from '../../src/modules/crm-standard-api/lianruan-crm-field-capability.registry';

describe('sql validation', () => {
  const aiGatewayService = {
    summarizeQuestion: (questionText: string) => questionText.trim(),
    parseStructuredIntent: async () => null,
  } as unknown as AiGatewayService;

  const analysisIntentService = new AnalysisIntentService(aiGatewayService);
  const businessMapper = new BusinessAnalysisIntentMapperService(
    new LianruanCrmFieldCapabilityRegistry(),
  );
  const queryCompilerService = new QueryCompilerService();
  const queryAstValidatorService = new QueryAstValidatorService();
  const queryPreflightService = new QueryPreflightService({
    canUseLiveQuery: () => false,
    preflightQuery: jest.fn(),
  } as never);
  const queryRiskGuardService = new QueryRiskGuardService();

  it('应先生成查询计划 AST 再编译为只读 SQL', async () => {
    const intent = await analysisIntentService.parse('本月各销售负责人新增商机金额排名');
    const plan = queryCompilerService.buildPlan(intent);
    const compiled = queryCompilerService.compile(plan);

    expect(plan.type).toBe('query-plan');
    expect(plan.resultKind).toBe('owner-ranking');
    expect(compiled.sql.toLowerCase()).toContain('select');
    expect(compiled.sql.toLowerCase()).not.toContain('update ');
  });

  it('“前两个月的商机情况”应优先生成趋势查询而不是默认排名', async () => {
    const trendAwareIntentService = new AnalysisIntentService({
      summarizeQuestion: (questionText: string) => questionText.trim(),
      parseBusinessAnalysisIntent: async () =>
        ({
          objectTypes: ['opportunity'],
          metrics: ['opportunity_amount'],
          dimensions: ['month'],
          filters: [],
          timeRange: {
            rawText: '前两个月',
            normalizedLabel: '前两个月',
            startAt: '2026-01-31T16:00:00.000Z',
            endAt: '2026-03-31T16:00:00.000Z',
            timezone: 'Asia/Shanghai',
            granularity: 'month',
            relativity: 'relative',
            inclusivity: { start: 'inclusive', end: 'exclusive' },
            confidence: 'HIGH',
          },
          analysisMode: 'trend',
          outputPreference: ['text_summary', 'table', 'chart'],
          comparison: [],
          entities: [],
          confidence: 'HIGH',
          missingConditions: [],
          unsupportedHints: [],
          requestedAction: 'READONLY_ANALYSIS',
          blockReason: '',
          normalizedQuestion: '请分析一下前两个月的商机情况',
        }) as any,
    } as unknown as AiGatewayService, businessMapper);
    const intent = await trendAwareIntentService.parse('请分析一下前两个月的商机情况');
    const plan = queryCompilerService.buildPlan(intent);

    expect(intent.filters).toMatchObject({
      timeRange: '前两个月',
    });
    expect(intent.resultIntent).toBe('trend');
    expect(plan.resultKind).toBe('time-trend');
  });

  it('计划执行应使用 temporalSlot 编译时间边界并保留执行口径', () => {
    const temporalSlot = {
      rawText: '最近四个月',
      normalizedLabel: '最近四个月',
      startAt: '2025-12-31T16:00:00.000Z',
      endAt: '2026-04-30T16:00:00.000Z',
      timezone: 'Asia/Shanghai' as const,
      granularity: 'month' as const,
      relativity: 'relative' as const,
      inclusivity: { start: 'inclusive' as const, end: 'exclusive' as const },
      confidence: 'HIGH' as const,
    };
    const plan = queryCompilerService.buildPlan({
      domain: 'opportunity-analysis',
      metrics: ['新增商机金额'],
      dimensions: ['月份'],
      filters: {},
      temporalSlot,
      missingConditions: [],
      normalizedQuestion: '请分析一下最近四个月的商机情况',
      requestedAction: 'READONLY_ANALYSIS',
      confidence: 'HIGH',
      resultKindHint: 'time-trend',
    });
    const compiled = queryCompilerService.compile(plan);

    expect(plan.temporalSlot).toEqual(temporalSlot);
    expect(compiled.sql).toContain('o.created_at >= ?');
    expect(compiled.sql).toContain('o.created_at < ?');
    expect(compiled.params).toEqual(
      expect.arrayContaining([
        '2025-12-31T16:00:00.000Z',
        '2026-04-30T16:00:00.000Z',
      ]),
    );
  });

  it('受控直查带时间槽时必须使用对象允许的时间字段和完整边界', () => {
    const temporalSlot = {
      rawText: '最近四个月',
      normalizedLabel: '最近四个月',
      startAt: '2025-12-31T16:00:00.000Z',
      endAt: '2026-04-30T16:00:00.000Z',
      timezone: 'Asia/Shanghai' as const,
      granularity: 'month' as const,
      relativity: 'relative' as const,
      inclusivity: { start: 'inclusive' as const, end: 'exclusive' as const },
      confidence: 'HIGH' as const,
    };
    const compiled: CompiledQuery = {
      sql: `SELECT o.user_id AS owner_id,
SUM(o.expect_amount) AS amount,
COUNT(o.id) AS count
FROM opportunities o
WHERE o.organization_id IN ('org_north')
GROUP BY o.user_id
ORDER BY amount DESC
LIMIT 20`,
      params: [],
      tables: ['opportunities'],
      fieldMap: {
        opportunities: ['id', 'user_id', 'organization_id', 'expect_amount'],
      },
      joinPaths: [],
      allowedFunctions: ['SUM', 'COUNT'],
      resultKind: 'owner-ranking',
      rowLimit: 20,
      timeoutMs: 3000,
      plan: queryCompilerService.buildPlan({
        domain: 'opportunity-analysis',
        metrics: ['新增商机金额'],
        dimensions: ['销售负责人'],
        filters: {},
        temporalSlot,
        missingConditions: [],
        normalizedQuestion: '请分析一下最近四个月的商机情况',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'HIGH',
      }),
    };

    expect(() =>
      queryAstValidatorService.validateReadOnly(compiled.sql, compiled),
    ).toThrow('缺少允许的时间字段');
  });

  it('合同签单统计应使用提交日期、合同有效收入和已通过审批口径', () => {
    const temporalSlot = {
      rawText: '昨天',
      normalizedLabel: '昨天',
      startAt: '2026-05-27T00:00:00+08:00',
      endAt: '2026-05-28T00:00:00+08:00',
      timezone: 'Asia/Shanghai' as const,
      granularity: 'day' as const,
      relativity: 'relative' as const,
      inclusivity: { start: 'inclusive' as const, end: 'exclusive' as const },
      confidence: 'HIGH' as const,
    };
    const compiled = queryCompilerService.compile(
      queryCompilerService.buildPlan({
        domain: 'contract-conversion',
        metrics: ['转合同金额'],
        dimensions: ['销售负责人'],
        filters: {
          organizationIds: ['1213041'],
        },
        temporalSlot,
        missingConditions: [],
        normalizedQuestion: '昨天销售签单排名',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'HIGH',
        resultKindHint: 'owner-ranking',
      }),
    );

    expect(compiled.sql).toContain('c.created_at >= ?');
    expect(compiled.sql).toContain('c.created_at < ?');
    expect(compiled.sql).toContain('contract_assets ca_valid_income');
    expect(compiled.sql).toContain("ca_valid_income.custom_field_name = 'numeric_asset_7ee237'");
    expect(compiled.sql).toContain('SUM(COALESCE(ca_valid_income.numeric_asset, 0)) AS amount');
    expect(compiled.sql).toContain('c.approve_status = 3');
    expect(compiled.sql).toContain('c.finish_approve_at < ?');
    expect(compiled.sql).not.toContain('c.sign_date');
    expect(compiled.sql).not.toContain('c.total_amount');
    expect(compiled.params).toEqual([
      '1213041',
      '2026-05-27T00:00:00+08:00',
      '2026-05-28T00:00:00+08:00',
      '2026-05-28T00:00:00+08:00',
      100,
    ]);
    expect(() => queryAstValidatorService.validateReadOnly(compiled.sql, compiled)).not.toThrow();
  });

  it('时间槽缺少结束边界时执行前预检必须阻断', async () => {
    const compiled = queryCompilerService.compile(
      queryCompilerService.buildPlan({
        domain: 'opportunity-analysis',
        metrics: ['新增商机金额'],
        dimensions: ['月份'],
        filters: {},
        temporalSlot: {
          rawText: '那段时间',
          normalizedLabel: '未确定时间范围',
          startAt: '2026-01-31T16:00:00.000Z',
          timezone: 'Asia/Shanghai',
          granularity: 'custom',
          relativity: 'mixed',
          inclusivity: { start: 'inclusive', end: 'exclusive' },
          confidence: 'MEDIUM',
          unresolvedReason: '缺少结束边界',
        },
        missingConditions: [],
        normalizedQuestion: '从那段时间开始看一下商机情况',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'MEDIUM',
        resultKindHint: 'time-trend',
      }),
    );

    await expect(
      queryPreflightService.validate(compiled.sql, compiled.params, compiled),
    ).rejects.toThrow('时间槽缺少可执行起止边界');
  });

  it('应阻断未批准的关联路径', () => {
    const compiled: CompiledQuery = {
      sql: `SELECT o.user_id AS owner_id
FROM opportunities o
LEFT JOIN departments d ON d.id = o.department_id`,
      params: [],
      tables: ['opportunities', 'users'],
      fieldMap: {
        opportunities: ['user_id', 'department_id'],
        users: ['id', 'name'],
      },
      joinPaths: ['users.id=opportunities.user_id'],
      allowedFunctions: ['SUM', 'COUNT', 'COALESCE', 'CAST'],
      resultKind: 'owner-ranking',
      rowLimit: 100,
      timeoutMs: 3000,
      plan: queryCompilerService.buildPlan({
        domain: 'opportunity-analysis',
        metrics: ['新增商机金额'],
        dimensions: ['销售负责人'],
        filters: { organizationIds: ['org_north'] },
        missingConditions: [],
        normalizedQuestion: '本月各销售负责人新增商机金额排名',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'HIGH',
      }),
    };

    expect(() =>
      queryAstValidatorService.validateReadOnly(compiled.sql, compiled),
    ).toThrow('未批准的关联路径');
  });

  it('应阻断未批准的函数调用', () => {
    const compiled = queryCompilerService.compile(
      queryCompilerService.buildPlan({
        domain: 'opportunity-analysis',
        metrics: ['新增商机金额'],
        dimensions: ['销售负责人'],
        filters: { organizationIds: ['org_north'] },
        missingConditions: [],
        normalizedQuestion: '本月各销售负责人新增商机金额排名',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'HIGH',
      }),
    );

    const invalidSql = compiled.sql.replace('SUM(o.expect_amount)', 'MAX(o.expect_amount)');
    expect(() =>
      queryAstValidatorService.validateReadOnly(invalidSql, compiled),
    ).toThrow('未批准的函数调用');
  });

  it('应阻断 schema 探测和未声明外部调用语义', () => {
    expect(() =>
      queryRiskGuardService.ensureQuerySafe('SELECT * FROM information_schema.tables'),
    ).toThrow('schema 探测');
    expect(() =>
      queryRiskGuardService.ensureQuerySafe('SELECT load_file("/etc/passwd")'),
    ).toThrow('未声明外部调用');
  });

  it('自然语言风险护栏应放行客户创建时长只读分析，同时继续阻断真实创建动作', () => {
    expect(() =>
      queryRiskGuardService.ensureQuestionSafe(
        '有多少客户是没有报备商机的，分别创建了多长时间',
      ),
    ).not.toThrow();
    expect(() => queryRiskGuardService.ensureQuestionSafe('帮我创建客户')).toThrow(
      '当前一期仅支持受控问数，不支持写入型请求。',
    );
  });

  it('编译 SQL 应默认带行数限制，避免受控直查返回无限制结果集', async () => {
    const intent = await analysisIntentService.parse('本月各销售负责人新增商机金额排名');
    const plan = queryCompilerService.buildPlan(intent);
    const compiled = queryCompilerService.compile(plan);

    expect(compiled.sql).toMatch(/LIMIT\s+\?/i);
    expect(compiled.params.at(-1)).toBeLessThanOrEqual(100);
    expect(compiled.rowLimit).toBeLessThanOrEqual(100);
    expect(compiled.timeoutMs).toBeLessThanOrEqual(3000);
  });

  it('组织范围同时包含团队成员和白名单部门时应按并集注入', () => {
    const compiled = queryCompilerService.compile(
      queryCompilerService.buildPlan({
        domain: 'opportunity-analysis',
        metrics: ['新增商机金额'],
        dimensions: ['销售负责人'],
        filters: {
          organizationIds: ['org_north'],
          ownerIds: ['crm_wangdong', 'crm_yangang'],
          departmentIds: ['dept_authorized'],
        },
        missingConditions: [],
        normalizedQuestion: '查看我团队和授权部门的商机情况',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'HIGH',
      }),
    );

    expect(compiled.sql).toContain('(o.user_id IN (?, ?) OR o.department_id IN (?))');
    expect(compiled.params).toEqual(
      expect.arrayContaining(['crm_wangdong', 'crm_yangang', 'dept_authorized']),
    );
  });

  it('客户分类分析也必须按 CRM 负责人范围收口', () => {
    const compiled = queryCompilerService.compile(
      queryCompilerService.buildPlan({
        domain: 'customer-relationship',
        metrics: ['客户数量'],
        dimensions: ['客户分类'],
        filters: {
          organizationIds: ['org_north'],
          ownerIds: ['crm_niujin', 'crm_sd_a'],
        },
        missingConditions: [],
        normalizedQuestion: '本月客户分类分布',
        requestedAction: 'READONLY_ANALYSIS',
        confidence: 'HIGH',
      }),
    );

    expect(compiled.sql).toContain('c.user_id IN (?, ?)');
    expect(compiled.sql).not.toContain('c.department_id IN');
    expect(compiled.params).toEqual(
      expect.arrayContaining(['org_north', 'crm_niujin', 'crm_sd_a']),
    );
    expect(compiled.fieldMap.customers).toContain('user_id');
  });
});

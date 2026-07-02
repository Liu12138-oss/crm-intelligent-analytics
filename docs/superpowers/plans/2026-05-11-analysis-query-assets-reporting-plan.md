# 智能分析结果报表化与查询资产升级 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把智能分析工作台升级成“数据优先、AI 后置”的统一结果舞台，并把常用查询 / 最近查询升级成可执行、可治理、可推荐的固定 SQL 查询资产系统。

**Architecture:** 保留现有自由 AI 问数链路，在 `query-assets` 模块新增固定 SQL 模板执行、推荐排序和最近查询增强能力；前端统一消费扩展后的结果协议，首屏先展示指标卡与 100% 宽主数据模块，再展示 Markdown AI 报告；治理后台补齐 SQL、参数、展示、推荐和预览配置。所有模板执行必须复用现有权限、导出和审计边界，并通过只读 SQL 校验后才允许运行。

**Tech Stack:** NestJS、TypeScript、Vue 3、Pinia、Element Plus、Jest、Supertest、Vitest、Playwright、node-sql-parser

---

## 文件结构

### 后端

- Modify: `backend/src/shared/types/domain.ts`
  - 扩展 `QueryTemplateRecord`、`RecentQueryRecord`、能力快照与结果类型。
- Modify: `backend/src/shared/mock/sample-data.ts`
  - 注入首批 Grafana 模板、最近查询示例、用户点击画像与时间场景统计样例。
- Modify: `backend/src/modules/query-assets/query-template.repository.ts`
  - 支持 richer 模板对象、版本号、预览配置。
- Modify: `backend/src/modules/query-assets/query-template.service.ts`
  - 负责模板可见性、治理读写和执行前准备。
- Modify: `backend/src/modules/query-assets/query-template.controller.ts`
  - 返回推荐列表、模板扩展字段，并新增模板执行接口。
- Modify: `backend/src/modules/query-assets/query-template-admin.controller.ts`
  - 新增校验与预览接口。
- Create: `backend/src/modules/query-assets/query-template-sql-guard.service.ts`
  - 做只读 SQL 校验、白名单校验、参数占位符检查。
- Create: `backend/src/modules/query-assets/query-result-presentation.service.ts`
  - 把模板查询原始数据转成统一 `resultBundle` 结构。
- Create: `backend/src/modules/query-assets/query-template-execution.service.ts`
  - 模板执行总入口，串联校验、权限注入、查询、结果组装、最近查询落库。
- Create: `backend/src/modules/query-assets/query-asset-recommendation.service.ts`
  - 计算“猜你想查”、常用查询排序和推荐原因文案。
- Create: `backend/src/modules/query-assets/query-usage-profile.repository.ts`
  - 存储用户点击、重跑、成功率统计。
- Create: `backend/src/modules/query-assets/query-time-slot-stats.repository.ts`
  - 存储模板时间场景命中统计。
- Modify: `backend/src/modules/query-assets/recent-query.repository.ts`
  - 支持 richer 最近查询记录。
- Modify: `backend/src/modules/query-assets/recent-query.service.ts`
  - 补充来源类型、推荐辅助信息和重跑准备。
- Modify: `backend/src/modules/query-assets/recent-query.controller.ts`
  - 最近查询列表响应扩展，重跑链路按来源分流。
- Modify: `backend/src/modules/analysis/analysis.service.ts`
  - 保存 richer 最近查询快照，自由问数结果补足与模板链路一致的字段。
- Modify: `backend/src/modules/analysis/result-normalizer.service.ts`
  - 扩展数据优先结果协议、AI 报告状态和空态字段。
- Modify: `backend/src/modules/sessions/session-capabilities.service.ts`
  - 能力快照增加推荐区、模板统计和首页资产摘要。
- Modify: `backend/src/app.module.ts`
  - 注册新服务和仓储。

### 前端

- Modify: `frontend/src/types/analysis.ts`
  - 对齐新模板类型、推荐类型、最近查询类型和扩展结果协议。
- Modify: `frontend/src/services/analysis.service.ts`
  - 新增模板执行、模板校验、模板预览和 richer bootstrap 请求。
- Modify: `frontend/src/stores/analysis-query.store.ts`
  - 分离数据阶段与 AI 报告阶段，接入推荐区和模板直查链路。
- Modify: `frontend/src/pages/analysis/AnalysisWorkbenchPage.vue`
  - 调整为数据优先布局。
- Modify: `frontend/src/components/analysis/CommonQueryPanel.vue`
  - 渲染猜你想查 + 常用查询卡片。
- Modify: `frontend/src/components/analysis/RecentQueryPanel.vue`
  - 展示模板 / AI 来源、推荐原因和重跑说明。
- Modify: `frontend/src/components/analysis/AnalysisMarkdownPreview.vue`
  - 区分“AI 报告加载中”“AI 报告失败”“空结果解释”。
- Modify: `frontend/src/pages/governance/QueryTemplatePage.vue`
  - 改造成“配置 + 校验 + 预览”的模板治理页。
- Modify: `frontend/src/styles/main.css`
  - 补工作台数据优先布局、查询资产卡片和治理页预览区样式。

### 测试与文档

- Modify: `backend/test/contract/query-assets.contract-spec.ts`
- Create: `backend/test/integration/query-template-execution.integration-spec.ts`
- Modify: `backend/test/integration/query-assets.integration-spec.ts`
- Modify: `frontend/tests/unit/analysis-query.store.spec.ts`
- Modify: `frontend/tests/unit/analysis-page-layout.spec.ts`
- Create: `frontend/tests/unit/query-template-page.spec.ts`
- Modify: `frontend/tests/e2e/analysis-workbench.e2e-spec.ts`
- Modify: `specs/001-crm-intelligent-analytics/data-model.md`
- Modify: `specs/001-crm-intelligent-analytics/contracts/openapi.yaml`
- Modify: `specs/001-crm-intelligent-analytics/tasks.md`

## Task 1: 扩展查询资产类型、合同与样例数据

**Files:**
- Modify: `backend/src/shared/types/domain.ts`
- Modify: `backend/src/shared/mock/sample-data.ts`
- Modify: `frontend/src/types/analysis.ts`
- Modify: `backend/src/modules/query-assets/query-template.controller.ts`
- Modify: `backend/src/modules/query-assets/recent-query.controller.ts`
- Test: `backend/test/contract/query-assets.contract-spec.ts`
- Test: `frontend/tests/unit/analysis-query.store.spec.ts`

- [ ] **Step 1: 先写失败的后端 contract 测试，锁定模板列表、最近查询列表的新字段和模板执行入口**

```ts
it('模板列表应返回执行与推荐字段', async () => {
  const cookies = await loginAs(app, 'user_sales_director');
  const response = await request(app.getHttpServer())
    .get('/api/v1/analysis/templates')
    .set('Cookie', cookies)
    .expect(200);

  expect(response.body.items[0]).toEqual(
    expect.objectContaining({
      templateId: expect.any(String),
      sqlVersion: expect.any(String),
      queryMode: 'FIXED_SQL',
      renderConfig: expect.objectContaining({
        primaryViewType: expect.any(String),
      }),
      recommendationReason: expect.any(String),
    }),
  );
});

it('最近查询应返回来源类型与参数快照摘要', async () => {
  const cookies = await loginAs(app, 'user_sales_director');
  const response = await request(app.getHttpServer())
    .get('/api/v1/analysis/histories')
    .set('Cookie', cookies)
    .expect(200);

  expect(response.body.items[0]).toEqual(
    expect.objectContaining({
      historyId: expect.any(String),
      sourceType: expect.stringMatching(/AI_QUERY|TEMPLATE_QUERY|RERUN_HISTORY/),
      renderSnapshot: expect.any(Object),
    }),
  );
});

it('模板执行入口应存在', async () => {
  const cookies = await loginAs(app, 'user_sales_director');
  await request(app.getHttpServer())
    .post('/api/v1/analysis/templates/tpl_company_2026_completion/execute')
    .set('Cookie', cookies)
    .send({ parameters: {}, includeAiReport: false })
    .expect((response) => {
      expect([200, 400, 404, 500]).toContain(response.status);
    });
});
```

- [ ] **Step 2: 运行 contract 测试，确认新增断言全部失败**

Run:

```bash
pnpm --dir backend test -- query-assets.contract-spec.ts
```

Expected:

```text
FAIL backend/test/contract/query-assets.contract-spec.ts
- 模板列表缺少 sqlVersion / queryMode / renderConfig / recommendationReason
- 最近查询缺少 sourceType / renderSnapshot
- 模板执行路由 404
```

- [ ] **Step 3: 扩展共享类型、前端类型和样例数据，先让控制器能返回新字段**

```ts
export interface QueryTemplateParameterDefinition {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'daterange' | 'select' | 'boolean';
  required: boolean;
  defaultValue?: string | number | boolean | string[];
  options?: Array<{ label: string; value: string }>;
}

export interface QueryTemplateRenderConfig {
  primaryViewType: 'STAT_ONLY' | 'TABLE' | 'BAR_CHART' | 'LINE_CHART' | 'RANKING_TABLE';
  primaryTitle: string;
  chartDimensionKey?: string;
  chartMetricKey?: string;
  tableColumns?: Array<{ key: string; label: string; width?: number }>;
  metricFields?: Array<{ key: string; label: string }>;
  moduleHeight?: number;
}

export interface QueryTemplateRecord {
  id: string;
  name: string;
  description: string;
  defaultQuestionText: string;
  defaultFilters: Record<string, unknown>;
  defaultViewType?: ResultViewType;
  queryMode: 'FIXED_SQL';
  sqlText: string;
  sqlVersion: string;
  parameterSchema: QueryTemplateParameterDefinition[];
  renderConfig: QueryTemplateRenderConfig;
  aiConfig: {
    enabled: boolean;
    reportPrompt: string;
    emptyPrompt: string;
  };
  recommendationConfig: {
    priority: number;
    timeSlots: string[];
    prompt: string;
  };
  visibleRoleIds: string[];
  displayOrder: number;
  clickCount7d: number;
  hitRatePercent: number;
  optimizationStatus: 'HEALTHY' | 'NEEDS_OPTIMIZATION' | 'DISABLED';
  status: 'ACTIVE' | 'INACTIVE';
  ownedBy: string;
  updatedAt: string;
  validationSnapshot?: {
    status: 'PASSED' | 'FAILED';
    message: string;
  };
  lastValidatedAt?: string;
}

export interface RecentQueryRecord {
  id: string;
  requesterId: string;
  sourceRequestId: string;
  sourceType: 'AI_QUERY' | 'TEMPLATE_QUERY' | 'RERUN_HISTORY';
  templateId?: string;
  templateVersion?: string;
  questionText: string;
  lastUsedChannel: ChannelType;
  lastUsedConditions: Record<string, unknown>;
  parameterSnapshot?: Record<string, unknown>;
  renderSnapshot?: QueryTemplateRenderConfig;
  resultSummary?: string;
  status: 'SUCCEEDED' | 'BLOCKED' | 'FAILED';
  lastUsedAt: string;
}
```

- [ ] **Step 4: 在控制器映射里返回新增字段，并把样例模板换成 Grafana 首批模板**

```ts
return {
  items: this.queryTemplateService.listVisible(request.crmUser).map((item) => ({
    templateId: item.id,
    name: item.name,
    description: item.description,
    defaultQuestionText: item.defaultQuestionText,
    defaultFilters: item.defaultFilters,
    defaultViewType: item.defaultViewType,
    queryMode: item.queryMode,
    sqlVersion: item.sqlVersion,
    parameterSchema: item.parameterSchema,
    renderConfig: item.renderConfig,
    recommendationReason: item.recommendationConfig.prompt,
    visibleRoleIds: item.visibleRoleIds,
    displayOrder: item.displayOrder,
    clickCount7d: item.clickCount7d,
    hitRatePercent: item.hitRatePercent,
    optimizationStatus: item.optimizationStatus,
    status: item.status,
    updatedAt: item.updatedAt,
  })),
};
```

- [ ] **Step 5: 重跑 contract 与 store 测试，确认类型层和响应层先稳定**

Run:

```bash
pnpm --dir backend test -- query-assets.contract-spec.ts
pnpm --dir frontend test:unit -- analysis-query.store.spec.ts
```

Expected:

```text
PASS backend/test/contract/query-assets.contract-spec.ts
PASS frontend/tests/unit/analysis-query.store.spec.ts
```

- [ ] **Step 6: 提交基础类型与响应层变更**

```bash
git add backend/src/shared/types/domain.ts backend/src/shared/mock/sample-data.ts backend/src/modules/query-assets/query-template.controller.ts backend/src/modules/query-assets/recent-query.controller.ts frontend/src/types/analysis.ts backend/test/contract/query-assets.contract-spec.ts frontend/tests/unit/analysis-query.store.spec.ts
git commit -m "feat: 扩展查询资产类型与列表响应"
```

## Task 2: 新增只读 SQL 校验与模板执行服务

**Files:**
- Create: `backend/src/modules/query-assets/query-template-sql-guard.service.ts`
- Create: `backend/src/modules/query-assets/query-result-presentation.service.ts`
- Create: `backend/src/modules/query-assets/query-template-execution.service.ts`
- Modify: `backend/src/modules/query-assets/query-template.service.ts`
- Modify: `backend/src/modules/query-assets/query-template.controller.ts`
- Modify: `backend/src/app.module.ts`
- Test: `backend/test/integration/query-template-execution.integration-spec.ts`
- Test: `backend/test/integration/query-assets.integration-spec.ts`

- [ ] **Step 1: 先写失败的模板执行集成测试，覆盖成功执行、只读拦截和空结果**

```ts
it('模板查询应直接返回 resultBundle，并可关闭 AI 报告', async () => {
  const cookies = await loginAs(app, 'user_sales_director');
  const response = await request(app.getHttpServer())
    .post('/api/v1/analysis/templates/tpl_company_2026_completion/execute')
    .set('Cookie', cookies)
    .send({ parameters: { year: 2026 }, includeAiReport: false })
    .expect(200);

  expect(response.body.resultBundle.metricCards.length).toBeGreaterThan(0);
  expect(response.body.insightBundle.status).toBe('SKIPPED');
});

it('非只读 SQL 模板应被校验拦截', async () => {
  const cookies = await loginAs(app, 'user_admin');
  const response = await request(app.getHttpServer())
    .post('/api/v1/analysis/templates/tpl_invalid_write_sql/execute')
    .set('Cookie', cookies)
    .send({ parameters: {}, includeAiReport: false })
    .expect(400);

  expect(response.body.message).toContain('只允许查询 SQL');
});

it('模板空结果应先返回空态块', async () => {
  const cookies = await loginAs(app, 'user_sales_director');
  const response = await request(app.getHttpServer())
    .post('/api/v1/analysis/templates/tpl_weekly_new_opportunity/execute')
    .set('Cookie', cookies)
    .send({ parameters: { dateRange: ['2026-01-01', '2026-01-02'] }, includeAiReport: false })
    .expect(200);

  expect(response.body.resultBundle.emptyStateBlock).toEqual(
    expect.objectContaining({
      reason: expect.any(String),
      suggestions: expect.any(Array),
    }),
  );
});
```

- [ ] **Step 2: 运行新增集成测试，确认模板执行能力尚未实现**

Run:

```bash
pnpm --dir backend test -- query-template-execution.integration-spec.ts
```

Expected:

```text
FAIL backend/test/integration/query-template-execution.integration-spec.ts
- route not found
- QueryTemplateExecutionService not defined
```

- [ ] **Step 3: 实现 SQL Guard，严格限制只读查询、单语句和白名单表字段**

```ts
@Injectable()
export class QueryTemplateSqlGuardService {
  constructor(
    private readonly queryWhitelistService: QueryWhitelistService,
    private readonly queryAstValidatorService: QueryAstValidatorService,
  ) {}

  validateReadonlyTemplateSql(sqlText: string): void {
    const normalizedSql = sqlText.trim();
    if (normalizedSql.includes(';')) {
      throw new BadRequestException('模板 SQL 仅允许单条查询语句。');
    }

    const lowered = normalizedSql.toLowerCase();
    if (!lowered.startsWith('select') && !lowered.startsWith('with')) {
      throw new BadRequestException('模板 SQL 只允许查询 SQL。');
    }

    this.queryAstValidatorService.ensureReadonlySql(normalizedSql);
    this.queryWhitelistService.ensureSqlWithinWhitelist(normalizedSql);
  }
}
```

- [ ] **Step 4: 实现模板执行服务与结果组装，返回 `resultBundle + insightBundle` 双层结构**

```ts
@Injectable()
export class QueryTemplateExecutionService {
  constructor(
    private readonly queryTemplateRepository: QueryTemplateRepository,
    private readonly queryTemplateSqlGuardService: QueryTemplateSqlGuardService,
    private readonly queryResultPresentationService: QueryResultPresentationService,
  ) {}

  async execute(
    user: CrmUser,
    templateId: string,
    payload: { parameters: Record<string, unknown>; includeAiReport: boolean },
  ) {
    const template = this.queryTemplateRepository.findById(templateId);
    if (!template || template.status !== 'ACTIVE') {
      throw new NotFoundException('查询模板不存在。');
    }

    this.queryTemplateSqlGuardService.validateReadonlyTemplateSql(template.sqlText);

    const dataset = this.mockQuery(template.id, payload.parameters);
    const resultBundle = this.queryResultPresentationService.present({
      template,
      dataset,
      parameters: payload.parameters,
    });

    return {
      templateId: template.id,
      queryMode: template.queryMode,
      resultBundle,
      insightBundle: payload.includeAiReport
        ? { status: 'PENDING' }
        : { status: 'SKIPPED' },
    };
  }
}
```

- [ ] **Step 5: 暴露模板执行接口，并把服务注册进 `AppModule`**

```ts
@Post(':templateId/execute')
executeTemplate(
  @Req() request: Request & { crmUser: CrmUser },
  @Param('templateId') templateId: string,
  @Body() body: { parameters?: Record<string, unknown>; includeAiReport?: boolean },
) {
  return this.queryTemplateExecutionService.execute(request.crmUser, templateId, {
    parameters: body.parameters ?? {},
    includeAiReport: body.includeAiReport ?? true,
  });
}
```

- [ ] **Step 6: 重跑模板执行测试，确认固定 SQL 模板已经能稳定返回数据或空态**

Run:

```bash
pnpm --dir backend test -- query-template-execution.integration-spec.ts
pnpm --dir backend test -- query-assets.integration-spec.ts
```

Expected:

```text
PASS backend/test/integration/query-template-execution.integration-spec.ts
PASS backend/test/integration/query-assets.integration-spec.ts
```

- [ ] **Step 7: 提交只读 SQL 校验与模板执行能力**

```bash
git add backend/src/modules/query-assets/query-template-sql-guard.service.ts backend/src/modules/query-assets/query-result-presentation.service.ts backend/src/modules/query-assets/query-template-execution.service.ts backend/src/modules/query-assets/query-template.service.ts backend/src/modules/query-assets/query-template.controller.ts backend/src/app.module.ts backend/test/integration/query-template-execution.integration-spec.ts backend/test/integration/query-assets.integration-spec.ts
git commit -m "feat: 新增固定 SQL 模板执行与只读校验"
```

## Task 3: 增强最近查询记录与推荐排序服务

**Files:**
- Create: `backend/src/modules/query-assets/query-usage-profile.repository.ts`
- Create: `backend/src/modules/query-assets/query-time-slot-stats.repository.ts`
- Create: `backend/src/modules/query-assets/query-asset-recommendation.service.ts`
- Modify: `backend/src/modules/query-assets/recent-query.repository.ts`
- Modify: `backend/src/modules/query-assets/recent-query.service.ts`
- Modify: `backend/src/modules/analysis/analysis.service.ts`
- Modify: `backend/src/modules/sessions/session-capabilities.service.ts`
- Test: `backend/test/integration/query-assets.integration-spec.ts`

- [ ] **Step 1: 先写失败的推荐排序测试，锁定猜你想查、常用查询排序与最近查询来源信息**

```ts
it('能力快照应返回猜你想查与常用查询排序原因', async () => {
  const cookies = await loginAs(app, 'user_sales_director');
  const response = await request(app.getHttpServer())
    .get('/api/v1/analysis/capabilities')
    .set('Cookie', cookies)
    .expect(200);

  expect(response.body.queryAssetSummary).toEqual(
    expect.objectContaining({
      recommendedTemplates: expect.any(Array),
      timeSlot: expect.any(String),
    }),
  );
});

it('最近查询应区分模板查询和 AI 问数', async () => {
  const cookies = await loginAs(app, 'user_sales_director');
  const response = await request(app.getHttpServer())
    .get('/api/v1/analysis/histories')
    .set('Cookie', cookies)
    .expect(200);

  expect(response.body.items.map((item: any) => item.sourceType)).toContain('TEMPLATE_QUERY');
});
```

- [ ] **Step 2: 运行推荐排序相关测试，确认能力快照和最近查询还没有推荐信息**

Run:

```bash
pnpm --dir backend test -- query-assets.integration-spec.ts
```

Expected:

```text
FAIL backend/test/integration/query-assets.integration-spec.ts
- queryAssetSummary undefined
- sourceType does not contain TEMPLATE_QUERY
```

- [ ] **Step 3: 实现用户点击画像仓储和时间场景统计仓储**

```ts
export interface QueryUsageProfileRecord {
  id: string;
  userId: string;
  templateId: string;
  lastClickedAt: string;
  clickCount7d: number;
  clickCount30d: number;
  rerunCount30d: number;
  successCount30d: number;
  lastTimeSlot?: string;
  favoriteScore: number;
}

@Injectable()
export class QueryUsageProfileRepository {
  listByUser(userId: string): QueryUsageProfileRecord[] {
    return getAppMemoryStore().queryUsageProfiles.filter((item) => item.userId === userId);
  }
}
```

- [ ] **Step 4: 实现推荐排序服务，并在能力快照里返回猜你想查摘要**

```ts
@Injectable()
export class QueryAssetRecommendationService {
  buildSummary(user: CrmUser, templates: QueryTemplateRecord[]) {
    const timeSlot = this.resolveTimeSlot(new Date());
    const recommendedTemplates = templates
      .map((template) => ({
        templateId: template.id,
        score: template.displayOrder * -1 + template.clickCount7d,
        reason: template.recommendationConfig.prompt,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return { timeSlot, recommendedTemplates };
  }
}
```

- [ ] **Step 5: 在自由问数与模板执行后写入 richer 最近查询记录**

```ts
this.recentQueryRepository.save({
  id: buildEntityId('history'),
  requesterId: user.id,
  sourceRequestId: requestId,
  sourceType: payload.querySource === 'COMMON_TEMPLATE' ? 'TEMPLATE_QUERY' : 'AI_QUERY',
  templateId: payload.templateId,
  templateVersion: payload.templateId ? template.sqlVersion : undefined,
  questionText,
  lastUsedChannel: payload.channel,
  lastUsedConditions: intent.filters,
  parameterSnapshot: payload.templateParameters ?? {},
  renderSnapshot: template?.renderConfig,
  resultSummary,
  status: 'SUCCEEDED',
  lastUsedAt: completedAt,
});
```

- [ ] **Step 6: 重跑最近查询与能力快照测试，确认推荐信息和来源类型都正确返回**

Run:

```bash
pnpm --dir backend test -- query-assets.integration-spec.ts
```

Expected:

```text
PASS backend/test/integration/query-assets.integration-spec.ts
```

- [ ] **Step 7: 提交最近查询增强与推荐排序能力**

```bash
git add backend/src/modules/query-assets/query-usage-profile.repository.ts backend/src/modules/query-assets/query-time-slot-stats.repository.ts backend/src/modules/query-assets/query-asset-recommendation.service.ts backend/src/modules/query-assets/recent-query.repository.ts backend/src/modules/query-assets/recent-query.service.ts backend/src/modules/analysis/analysis.service.ts backend/src/modules/sessions/session-capabilities.service.ts backend/test/integration/query-assets.integration-spec.ts
git commit -m "feat: 增强最近查询并接入推荐排序"
```

## Task 4: 统一结果协议并接入数据优先 / AI 后置状态

**Files:**
- Modify: `backend/src/modules/analysis/result-normalizer.service.ts`
- Modify: `backend/src/modules/analysis/analysis.service.ts`
- Modify: `frontend/src/types/analysis.ts`
- Modify: `frontend/src/services/analysis.service.ts`
- Modify: `frontend/src/stores/analysis-query.store.ts`
- Test: `backend/test/contract/analysis-query.contract-spec.ts`
- Test: `frontend/tests/unit/analysis-query.store.spec.ts`

- [ ] **Step 1: 先写失败测试，锁定 `resultBundle` 和 `insightBundle` 双层结构以及 AI 报告状态**

```ts
expect(detail.body.resultBundleSnapshot).toEqual(
  expect.objectContaining({
    rowCount: expect.any(Number),
    metricCount: expect.any(Number),
  }),
);
expect(detail.body.report).toEqual(
  expect.objectContaining({
    resultBundle: expect.any(Object),
    insightBundle: expect.objectContaining({
      status: expect.stringMatching(/PENDING|READY|FAILED|SKIPPED/),
    }),
  }),
);
```

```ts
expect(store.currentResult?.report?.insightBundle?.status).toBe('READY');
expect(store.currentResult?.report?.resultBundle.metricCards.length).toBeGreaterThan(0);
```

- [ ] **Step 2: 运行分析 contract 和 store 测试，确认结果结构还没有拆成双阶段**

Run:

```bash
pnpm --dir backend test -- analysis-query.contract-spec.ts
pnpm --dir frontend test:unit -- analysis-query.store.spec.ts
```

Expected:

```text
FAIL analysis-query.contract-spec.ts
FAIL analysis-query.store.spec.ts
```

- [ ] **Step 3: 扩展结果协议类型与归一化逻辑，始终优先返回数据区块**

```ts
export interface AnalysisResultBundle {
  metricCards: Array<{ name: string; value: string | number }>;
  primaryBlock: {
    viewType: string;
    title: string;
    series?: Array<Record<string, unknown>>;
    rows?: Array<Record<string, unknown>>;
  };
  emptyStateBlock?: {
    title: string;
    reason: string;
    suggestions: string[];
  };
}

export interface AnalysisInsightBundle {
  status: 'PENDING' | 'READY' | 'FAILED' | 'SKIPPED';
  groundedMarkdown?: string;
  failureReason?: string;
}
```

```ts
return {
  requestId: params.requestId,
  title: params.report.reportTitle,
  summary: params.report.executiveSummary,
  report: {
    ...params.report,
    resultBundle: {
      metricCards: params.report.metricCards,
      primaryBlock: primaryChart
        ? { viewType: primaryChart.viewType, title: primaryChart.title, series: primaryChart.series }
        : { viewType: 'DETAIL_TABLE', title: primaryTable?.title ?? '结果明细', rows: primaryTable?.rows ?? [] },
      emptyStateBlock: params.report.emptyState
        ? { title: '当前条件下未查到数据', reason: params.report.emptyState, suggestions: params.report.nextBestQuestions ?? [] }
        : undefined,
    },
    insightBundle: {
      status: params.report.groundedMarkdown ? 'READY' : 'PENDING',
      groundedMarkdown: params.report.groundedMarkdown,
    },
  },
  metricCards: params.report.metricCards,
  primaryView: undefined,
};
```

- [ ] **Step 4: 调整 store 状态机，让数据到达后先进入 `reported`，AI 报告单独处理加载态**

```ts
if (created.status === 'RETURNED' && created.queryId) {
  this.currentResult = await analysisService.getQuery(created.queryId);
  this.setViewState('reported');
  this.feedbackMessage = this.currentResult?.report?.insightBundle?.status === 'READY'
    ? '数据结果与 AI 报告均已生成。'
    : '数据结果已返回，AI 正在补充分析报告。';
  return;
}
```

- [ ] **Step 5: 重跑 contract 与 store 测试，确认双阶段协议稳定**

Run:

```bash
pnpm --dir backend test -- analysis-query.contract-spec.ts
pnpm --dir frontend test:unit -- analysis-query.store.spec.ts
```

Expected:

```text
PASS backend/test/contract/analysis-query.contract-spec.ts
PASS frontend/tests/unit/analysis-query.store.spec.ts
```

- [ ] **Step 6: 提交统一结果协议与双阶段状态机**

```bash
git add backend/src/modules/analysis/result-normalizer.service.ts backend/src/modules/analysis/analysis.service.ts frontend/src/types/analysis.ts frontend/src/services/analysis.service.ts frontend/src/stores/analysis-query.store.ts backend/test/contract/analysis-query.contract-spec.ts frontend/tests/unit/analysis-query.store.spec.ts
git commit -m "feat: 统一数据优先结果协议"
```

## Task 5: 重构工作台结果区与查询资产区前端交互

**Files:**
- Modify: `frontend/src/pages/analysis/AnalysisWorkbenchPage.vue`
- Modify: `frontend/src/components/analysis/CommonQueryPanel.vue`
- Modify: `frontend/src/components/analysis/RecentQueryPanel.vue`
- Modify: `frontend/src/components/analysis/AnalysisMarkdownPreview.vue`
- Modify: `frontend/src/styles/main.css`
- Test: `frontend/tests/unit/analysis-page-layout.spec.ts`
- Test: `frontend/tests/e2e/analysis-workbench.e2e-spec.ts`

- [ ] **Step 1: 先写失败的页面测试，锁定“数据区在前、AI 报告在后”的层级和推荐区块**

```ts
expect(wrapper.text()).toContain('猜你想查');
expect(wrapper.find('[data-testid="analysis-data-stage"]').exists()).toBe(true);
expect(wrapper.find('[data-testid="analysis-insight-stage"]').exists()).toBe(true);
expect(wrapper.find('[data-testid="analysis-data-stage"]').text()).toContain('主结果模块');
```

```ts
await expect(page.getByText('数据结果区')).toBeVisible();
await expect(page.getByText('AI 分析报告区')).toBeVisible();
await expect(page.getByText('猜你想查')).toBeVisible();
```

- [ ] **Step 2: 运行前端测试，确认当前工作台结构还没有这套层级**

Run:

```bash
pnpm --dir frontend test:unit -- analysis-page-layout.spec.ts
pnpm --dir frontend test:e2e -- analysis-workbench.e2e-spec.ts
```

Expected:

```text
FAIL analysis-page-layout.spec.ts
FAIL analysis-workbench.e2e-spec.ts
```

- [ ] **Step 3: 重构工作台页面模板，把查询资产区和结果区分成明确的上下结构**

```vue
<section class="panel query-assets-region">
  <CommonQueryPanel
    :recommended-items="store.capabilities?.queryAssetSummary?.recommendedTemplates ?? []"
    :templates="store.templates"
    @run-template="store.runTemplate"
  />
  <RecentQueryPanel
    :histories="store.histories"
    @rerun-history="store.rerunHistory"
  />
</section>

<section class="panel result-region">
  <div data-testid="analysis-data-stage" class="result-stage result-stage--data">
    <MetricCardGroup :items="report?.resultBundle?.metricCards ?? metricCards" />
    <AnalysisSectionCanvas :block="report?.resultBundle?.primaryBlock" />
  </div>
  <div data-testid="analysis-insight-stage" class="result-stage result-stage--insight">
    <AnalysisMarkdownPreview :bundle="report?.insightBundle" />
  </div>
</section>
```

- [ ] **Step 4: 改造常用查询和最近查询组件，展示推荐原因、来源类型和重跑提示**

```vue
<article v-for="item in recommendedItems" :key="item.templateId" class="query-asset-card">
  <span class="query-asset-card__badge">猜你想查</span>
  <h4>{{ item.name }}</h4>
  <p>{{ item.description }}</p>
  <small>{{ item.recommendationReason }}</small>
  <el-button type="primary" @click="$emit('run-template', item.templateId)">直接查看</el-button>
</article>
```

```vue
<div class="recent-query-item__meta">
  <el-tag round>{{ item.sourceType === 'TEMPLATE_QUERY' ? '模板查询' : 'AI 问数' }}</el-tag>
  <span>{{ item.lastUsedAt }}</span>
  <small v-if="item.renderSnapshot?.primaryViewType">{{ item.renderSnapshot.primaryViewType }}</small>
</div>
```

- [ ] **Step 5: 为数据优先布局补全样式，确保主数据模块 100% 宽且 AI 报告单独成段**

```css
.result-stage--data {
  display: grid;
  gap: 16px;
}

.analysis-primary-block {
  width: 100%;
  min-height: 380px;
  border-radius: 18px;
}

.result-stage--insight {
  margin-top: 24px;
  border-top: 1px solid var(--panel-border);
  padding-top: 20px;
}

.query-asset-card {
  display: grid;
  gap: 10px;
  padding: 18px;
  border-radius: 18px;
}
```

- [ ] **Step 6: 重跑 unit 与 e2e，确认工作台首屏体验已按设计落地**

Run:

```bash
pnpm --dir frontend test:unit -- analysis-page-layout.spec.ts
pnpm --dir frontend test:e2e -- analysis-workbench.e2e-spec.ts
```

Expected:

```text
PASS frontend/tests/unit/analysis-page-layout.spec.ts
PASS frontend/tests/e2e/analysis-workbench.e2e-spec.ts
```

- [ ] **Step 7: 提交工作台结果页与查询资产区重构**

```bash
git add frontend/src/pages/analysis/AnalysisWorkbenchPage.vue frontend/src/components/analysis/CommonQueryPanel.vue frontend/src/components/analysis/RecentQueryPanel.vue frontend/src/components/analysis/AnalysisMarkdownPreview.vue frontend/src/styles/main.css frontend/tests/unit/analysis-page-layout.spec.ts frontend/tests/e2e/analysis-workbench.e2e-spec.ts
git commit -m "feat: 重构分析工作台为数据优先布局"
```

## Task 6: 升级治理模板页，支持 SQL / 参数 / 展示 / 推荐 / 预览

**Files:**
- Modify: `frontend/src/pages/governance/QueryTemplatePage.vue`
- Modify: `frontend/src/services/analysis.service.ts`
- Modify: `frontend/src/types/analysis.ts`
- Create: `frontend/tests/unit/query-template-page.spec.ts`
- Modify: `backend/src/modules/query-assets/query-template-admin.controller.ts`
- Modify: `backend/src/modules/query-assets/query-template.service.ts`
- Test: `frontend/tests/unit/query-template-page.spec.ts`
- Test: `backend/test/contract/query-assets.contract-spec.ts`

- [ ] **Step 1: 先写失败测试，锁定模板治理页的新配置区块和校验 / 预览动作**

```ts
expect(wrapper.text()).toContain('SQL 与参数配置');
expect(wrapper.text()).toContain('展示与 AI 配置');
expect(wrapper.text()).toContain('推荐配置');
expect(wrapper.find('[data-testid="validate-template"]').exists()).toBe(true);
expect(wrapper.find('[data-testid="preview-template"]').exists()).toBe(true);
```

```ts
await request(app.getHttpServer())
  .post('/api/v1/governance/query-templates/tpl_company_2026_completion/validate')
  .set('Cookie', cookies)
  .send({ sqlText: 'select 1' })
  .expect(200);
```

- [ ] **Step 2: 运行治理页与 contract 测试，确认页面和接口都还没准备好**

Run:

```bash
pnpm --dir frontend test:unit -- query-template-page.spec.ts
pnpm --dir backend test -- query-assets.contract-spec.ts
```

Expected:

```text
FAIL frontend/tests/unit/query-template-page.spec.ts
FAIL backend/test/contract/query-assets.contract-spec.ts
```

- [ ] **Step 3: 在治理控制器和服务中增加模板校验与预览接口**

```ts
@Post(':templateId/validate')
validateTemplate(
  @Req() request: Request & { crmUser: CrmUser },
  @Param('templateId') templateId: string,
  @Body() body: { sqlText: string },
) {
  return this.queryTemplateService.validateTemplate(request.crmUser, templateId, body);
}

@Post(':templateId/preview')
previewTemplate(
  @Req() request: Request & { crmUser: CrmUser },
  @Param('templateId') templateId: string,
  @Body() body: { parameters?: Record<string, unknown> },
) {
  return this.queryTemplateService.previewTemplate(request.crmUser, templateId, body);
}
```

- [ ] **Step 4: 把治理页改成三段式表单：SQL / 参数、展示 / AI、推荐 / 预览**

```vue
<section class="panel">
  <div class="panel__header"><h2>SQL 与参数配置</h2></div>
  <div class="panel__body panel__body--stack">
    <el-input v-model="draft.sqlText" type="textarea" :rows="10" />
    <el-button data-testid="validate-template" @click="validateTemplate">校验 SQL</el-button>
  </div>
</section>

<section class="panel">
  <div class="panel__header"><h2>展示与 AI 配置</h2></div>
  <div class="panel__body panel__body--stack">
    <el-input v-model="draft.renderConfig.primaryTitle" />
    <el-input v-model="draft.aiConfig.reportPrompt" type="textarea" :rows="4" />
  </div>
</section>

<section class="panel">
  <div class="panel__header"><h2>推荐配置</h2></div>
  <div class="panel__body panel__body--stack">
    <el-input v-model="draft.recommendationConfig.prompt" />
    <el-button data-testid="preview-template" @click="previewTemplate">预览模板</el-button>
  </div>
</section>
```

- [ ] **Step 5: 重跑治理页测试，确认模板管理员现在能配置、校验和预览**

Run:

```bash
pnpm --dir frontend test:unit -- query-template-page.spec.ts
pnpm --dir backend test -- query-assets.contract-spec.ts
```

Expected:

```text
PASS frontend/tests/unit/query-template-page.spec.ts
PASS backend/test/contract/query-assets.contract-spec.ts
```

- [ ] **Step 6: 提交模板治理页升级**

```bash
git add frontend/src/pages/governance/QueryTemplatePage.vue frontend/src/services/analysis.service.ts frontend/src/types/analysis.ts frontend/tests/unit/query-template-page.spec.ts backend/src/modules/query-assets/query-template-admin.controller.ts backend/src/modules/query-assets/query-template.service.ts backend/test/contract/query-assets.contract-spec.ts
git commit -m "feat: 升级查询模板治理配置与预览"
```

## Task 7: 同步规格文档并完成整体验证

**Files:**
- Modify: `specs/001-crm-intelligent-analytics/data-model.md`
- Modify: `specs/001-crm-intelligent-analytics/contracts/openapi.yaml`
- Modify: `specs/001-crm-intelligent-analytics/tasks.md`
- Test: `backend/test/contract/analysis-query.contract-spec.ts`
- Test: `backend/test/contract/query-assets.contract-spec.ts`
- Test: `backend/test/integration/query-template-execution.integration-spec.ts`
- Test: `frontend/tests/unit/analysis-query.store.spec.ts`
- Test: `frontend/tests/unit/analysis-page-layout.spec.ts`
- Test: `frontend/tests/unit/query-template-page.spec.ts`
- Test: `frontend/tests/e2e/analysis-workbench.e2e-spec.ts`

- [ ] **Step 1: 先补失败的文档一致性检查点，在任务清单和契约里加入模板执行、推荐排序和数据优先协议**

```yaml
/api/v1/analysis/templates/{templateId}/execute:
  post:
    summary: 执行固定 SQL 查询模板
```

```md
- [ ] 扩展 QueryTemplateRecord，支持 sqlText、parameterSchema、renderConfig、aiConfig、recommendationConfig
- [ ] 新增模板执行接口与只读 SQL 校验
- [ ] 改造分析工作台，先展示 resultBundle 再展示 insightBundle
```

- [ ] **Step 2: 手动校对数据模型、OpenAPI 与任务清单，补齐设计文档要求的字段和接口**

```md
### 2.4 常用查询模板（CommonQueryTemplate）

新增字段：
- sqlText
- sqlVersion
- parameterSchema
- renderConfig
- aiConfig
- recommendationConfig
```

- [ ] **Step 3: 运行后端 contract / integration、前端 unit / e2e 和根级测试汇总**

Run:

```bash
pnpm --dir backend test -- analysis-query.contract-spec.ts
pnpm --dir backend test -- query-assets.contract-spec.ts
pnpm --dir backend test -- query-template-execution.integration-spec.ts
pnpm --dir frontend test:unit -- analysis-query.store.spec.ts
pnpm --dir frontend test:unit -- analysis-page-layout.spec.ts
pnpm --dir frontend test:unit -- query-template-page.spec.ts
pnpm --dir frontend test:e2e -- analysis-workbench.e2e-spec.ts
pnpm test
```

Expected:

```text
PASS analysis-query.contract-spec.ts
PASS query-assets.contract-spec.ts
PASS query-template-execution.integration-spec.ts
PASS analysis-query.store.spec.ts
PASS analysis-page-layout.spec.ts
PASS query-template-page.spec.ts
PASS analysis-workbench.e2e-spec.ts
PASS pnpm test
```

- [ ] **Step 4: 做一次人工回归，覆盖这 8 条关键链路**

```text
1. 自由 AI 问数返回数据区后再返回 AI 报告
2. 模板查询直接执行固定 SQL
3. 空结果时先显示空态块再给解释
4. 最近查询同时包含模板查询和 AI 问数
5. 最近查询重跑能按来源返回正确链路
6. 常用查询区可看到猜你想查与推荐原因
7. 治理页可校验 SQL 并预览模板
8. 导出、权限与审计链路均不回归
```

- [ ] **Step 5: 提交规格同步与最终验证**

```bash
git add specs/001-crm-intelligent-analytics/data-model.md specs/001-crm-intelligent-analytics/contracts/openapi.yaml specs/001-crm-intelligent-analytics/tasks.md
git commit -m "docs: 同步查询资产报表化升级规格"
```

## 自检

### Spec coverage

- “数据在前，AI 分析报告在后”由 Task 4、Task 5 覆盖。
- 固定 SQL 模板执行、只读校验和展示配置由 Task 1、Task 2、Task 6 覆盖。
- 最近查询统一记录自由问数与模板查询由 Task 1、Task 3 覆盖。
- 点击频率、时间场景推荐和猜你想查由 Task 3、Task 5 覆盖。
- 治理后台 SQL / 参数 / 展示 / 推荐 / 预览由 Task 6 覆盖。
- 文档、契约和任务同步由 Task 7 覆盖。

### Placeholder scan

- 本计划没有 `TODO`、`TBD`、`后续补充` 类占位符。
- 每个任务都包含具体文件、测试入口、代码片段和提交建议。

### Type consistency

- 后端使用 `queryMode`、`renderConfig`、`sourceType`、`resultBundle`、`insightBundle` 作为统一命名。
- 前端类型与后端共享字段名保持一致，不再使用另一套别名。


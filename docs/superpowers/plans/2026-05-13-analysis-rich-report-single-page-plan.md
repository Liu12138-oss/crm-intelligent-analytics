# 智能分析富报告与单页展示改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把自由问数与查询模板统一升级成 richer report，并让 Web 查询页直接展示完整 AI 经营分析报告，同时保持企业微信机器人压缩渲染兼容。

**Architecture:** 在现有受控查询与结果归一化主链上新增一层“富报告增强服务”，由程序先计算趋势、预测、异常和风险事实，再由 AI 基于事实生成 grounded 洞察与建议。自由问数与查询模板都必须复用这层增强服务，前端查询页统一渲染完整结构化报告，并把 Markdown 从基础预览升级为专业阅读组件；企业微信继续消费同一份报告事实的压缩版输出。

**Tech Stack:** NestJS、TypeScript、Vue 3、Pinia、Element Plus、Jest、Supertest、Vitest、Playwright

---

## 文件结构

### 后端

- Modify: `backend/src/shared/types/domain.ts`
  - 扩展 richer report 字段、趋势预测结构、Markdown 派生字段。
- Modify: `backend/src/modules/analysis/analysis-report-composer.service.ts`
  - 保留现有基础编排，同时输出 richer report 所需的基线 section 和元信息。
- Create: `backend/src/modules/analysis/analysis-forecast.service.ts`
  - 基于时间序列计算短期区间预测、置信等级与降级说明。
- Create: `backend/src/modules/analysis/analysis-insight-evidence.service.ts`
  - 计算趋势事实、结构事实、异常事实、风险事实与建议输入事实。
- Create: `backend/src/modules/analysis/analysis-rich-report.service.ts`
  - 把统一结果记录增强成 richer report，并生成 `workbenchMarkdown`、`detailMarkdown`、`wecomMarkdown`。
- Create: `backend/src/modules/analysis/capability-packs/packs/rich-analysis-report.pack.ts`
  - 定义 richer report 的结构化 AI 输出协议。
- Modify: `backend/src/modules/analysis/ai-gateway.service.ts`
  - 新增 richer report pack 调用与 JSON 结果归一化。
- Modify: `backend/src/modules/analysis/analysis-workflow.orchestrator.ts`
  - 自由问数结果在一致性校验后接入 richer report 增强。
- Modify: `backend/src/modules/analysis/analysis-markdown.util.ts`
  - 支持 richer report 的完整版 / 工作台版 / 企业微信版 Markdown 编译。
- Modify: `backend/src/modules/analysis/analysis-channel-presenter.service.ts`
  - 企业微信渠道继续压缩 richer report，保留兼容字段。
- Modify: `backend/src/modules/query-assets/query-template-execution.service.ts`
  - 模板链路停止手拼 Markdown，改为复用 richer report 增强服务。
- Modify: `backend/src/app.module.ts`
  - 注册新增服务与 capability pack 依赖。

### 前端

- Modify: `frontend/src/types/analysis.ts`
  - 对齐 richer report 新字段。
- Create: `frontend/src/components/analysis/AnalysisRichReportPanel.vue`
  - 承载单页完整报告：趋势、预测、风险、建议、依据和可折叠 Markdown。
- Modify: `frontend/src/components/analysis/AnalysisMarkdownPreview.vue`
  - 支持受控表格、语义块、优化标题层级与说明块样式。
- Modify: `frontend/src/components/analysis/AnalysisSectionCanvas.vue`
  - 兼容 richer report 新 section 类型或筛掉已由 RichReportPanel 直接消费的区块。
- Modify: `frontend/src/pages/analysis/AnalysisWorkbenchPage.vue`
  - 查询页直接展示完整 richer report，弱化“查看详情”依赖。
- Modify: `frontend/src/pages/analysis/AnalysisResultDetailPage.vue`
  - 保持兼容入口，但复用 richer report 面板，不再承担唯一完整版阅读职责。
- Modify: `frontend/src/stores/analysis-query.store.ts`
  - 模板执行后改为拉取 `getQuery(queryId)`，不再在前端手拼模板报告。
- Modify: `frontend/src/styles/main.css`
  - 补 richer report 单页布局、折叠区、语义块和 Markdown 阅读样式。

### 测试与文档

- Create: `backend/test/modules/analysis/analysis-forecast.service.spec.ts`
- Create: `backend/test/modules/analysis/analysis-insight-evidence.service.spec.ts`
- Create: `backend/test/modules/analysis/analysis-rich-report.service.spec.ts`
- Modify: `backend/test/modules/analysis/analysis-markdown.util.spec.ts`
- Modify: `backend/test/modules/analysis/analysis-channel-presenter.service.spec.ts`
- Modify: `backend/test/modules/analysis/analysis-report-composer.service.spec.ts`
- Modify: `backend/test/integration/result-accuracy.integration-spec.ts`
- Modify: `backend/test/integration/query-template-execution.integration-spec.ts`
- Modify: `backend/test/integration/wecom-query.integration-spec.ts`
- Modify: `backend/test/contract/analysis-query.contract-spec.ts`
- Modify: `frontend/tests/unit/analysis-markdown-preview.spec.ts`
- Create: `frontend/tests/unit/analysis-rich-report-panel.spec.ts`
- Modify: `frontend/tests/unit/analysis-page-layout.spec.ts`
- Modify: `frontend/tests/unit/analysis-query.store.spec.ts`
- Modify: `frontend/tests/e2e/analysis-workbench.e2e-spec.ts`
- Modify: `specs/001-crm-intelligent-analytics/contracts/openapi.yaml`
- Modify: `specs/001-crm-intelligent-analytics/data-model.md`
- Modify: `specs/001-crm-intelligent-analytics/quickstart.md`
- Modify: `specs/001-crm-intelligent-analytics/tasks.md`

## Task 1: 扩展 richer report 类型、契约与回归基线

**Files:**
- Modify: `backend/src/shared/types/domain.ts`
- Modify: `frontend/src/types/analysis.ts`
- Modify: `backend/test/contract/analysis-query.contract-spec.ts`
- Modify: `backend/test/integration/result-accuracy.integration-spec.ts`
- Modify: `specs/001-crm-intelligent-analytics/contracts/openapi.yaml`

- [ ] **Step 1: 先写失败的 contract / integration 测试，锁定 richer report 新字段**

```ts
expect(detail.body.report).toEqual(
  expect.objectContaining({
    analysisConfidence: expect.stringMatching(/HIGH|MEDIUM|LOW/),
    trendInsight: expect.any(Object),
    forecastInsight: expect.any(Object),
    anomalyInsights: expect.any(Array),
    riskInsights: expect.any(Array),
    recommendations: expect.any(Array),
    workbenchMarkdown: expect.any(String),
    detailMarkdown: expect.any(String),
    wecomMarkdown: expect.any(String),
  }),
);

expect(detail.body.groundedMarkdown).toContain('## 执行摘要');
expect(detail.body.report.detailMarkdown).toContain('## 趋势预测');
```

- [ ] **Step 2: 运行后端契约测试，确认当前响应缺少 richer report 字段**

Run:

```bash
pnpm --dir backend test -- analysis-query.contract-spec.ts result-accuracy.integration-spec.ts
```

Expected:

```text
FAIL
- report.analysisConfidence is undefined
- report.forecastInsight is undefined
- report.detailMarkdown is undefined
```

- [ ] **Step 3: 扩展共享类型、前端类型和 OpenAPI schema，先把协议面补齐**

```ts
export interface AnalysisForecastInsight {
  status: 'READY' | 'UNAVAILABLE' | 'LOW_CONFIDENCE';
  horizonLabel: string;
  predictedValue?: number;
  predictedRangeLow?: number;
  predictedRangeHigh?: number;
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  drivers: string[];
  caveats: string[];
  summary: string;
}

export interface AnalysisRecommendationItem {
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  action: string;
  reason: string;
  evidenceKeys: string[];
}
```

- [ ] **Step 4: 重跑后端契约测试，确认新 schema 至少可被识别，剩余失败集中到实现逻辑**

Run:

```bash
pnpm --dir backend test -- analysis-query.contract-spec.ts result-accuracy.integration-spec.ts
```

Expected:

```text
FAIL
- richer report 字段已存在于类型 / schema
- 但 forecastInsight / recommendations 实际内容仍为空或不满足断言
```

- [ ] **Step 5: 提交协议层变更**

```bash
git add backend/src/shared/types/domain.ts frontend/src/types/analysis.ts specs/001-crm-intelligent-analytics/contracts/openapi.yaml backend/test/contract/analysis-query.contract-spec.ts backend/test/integration/result-accuracy.integration-spec.ts
git commit -m "feat: 扩展智能分析 richer report 协议"
```

## Task 2: 新增洞察事实与预测服务

**Files:**
- Create: `backend/src/modules/analysis/analysis-forecast.service.ts`
- Create: `backend/src/modules/analysis/analysis-insight-evidence.service.ts`
- Modify: `backend/src/app.module.ts`
- Test: `backend/test/modules/analysis/analysis-forecast.service.spec.ts`
- Test: `backend/test/modules/analysis/analysis-insight-evidence.service.spec.ts`

- [ ] **Step 1: 写失败的单元测试，锁定趋势判断、预测降级、异常与风险识别**

```ts
it('满足四个连续时间点时应输出区间预测与中等以上置信等级', () => {
  const result = service.buildForecast([
    { label: '2026-01', value: 120 },
    { label: '2026-02', value: 135 },
    { label: '2026-03', value: 148 },
    { label: '2026-04', value: 162 },
  ]);

  expect(result.status).toBe('READY');
  expect(result.predictedRangeLow).toBeLessThan(result.predictedRangeHigh!);
  expect(result.confidenceLevel).toMatch(/HIGH|MEDIUM/);
});

it('样本不足时应降级为不可预测', () => {
  expect(service.buildForecast([{ label: '2026-04', value: 162 }]).status).toBe('UNAVAILABLE');
});
```

- [ ] **Step 2: 运行单测，确认新服务尚不存在**

Run:

```bash
pnpm --dir backend test -- analysis-forecast.service.spec.ts analysis-insight-evidence.service.spec.ts
```

Expected:

```text
FAIL
- Cannot find module analysis-forecast.service
- Cannot find module analysis-insight-evidence.service
```

- [ ] **Step 3: 实现轻量预测与洞察事实计算器**

```ts
export class AnalysisForecastService {
  buildForecast(points: Array<{ label: string; value: number }>): AnalysisForecastInsight {
    if (points.length < 4) {
      return {
        status: 'UNAVAILABLE',
        horizonLabel: '下一周期',
        confidenceLevel: 'LOW',
        drivers: [],
        caveats: ['当前时间序列点数不足，暂不输出预测区间。'],
        summary: '当前结果仅支持趋势判断，暂不具备预测条件。',
      };
    }

    const weightedMean = this.calculateWeightedMean(points);
    const spread = this.calculateSpread(points);
    return {
      status: 'READY',
      horizonLabel: '下一周期',
      predictedValue: weightedMean,
      predictedRangeLow: weightedMean - spread,
      predictedRangeHigh: weightedMean + spread,
      confidenceLevel: spread / Math.max(weightedMean, 1) < 0.15 ? 'HIGH' : 'MEDIUM',
      drivers: ['近四期趋势延续', '最新一期权重更高'],
      caveats: ['该预测仅基于当前结果事实做短期区间推断。'],
      summary: `预计下一周期大概率落在 ${Math.round(weightedMean - spread)} 到 ${Math.round(weightedMean + spread)} 之间。`,
    };
  }
}
```

- [ ] **Step 4: 重跑单测，确认预测、异常、风险事实计算通过**

Run:

```bash
pnpm --dir backend test -- analysis-forecast.service.spec.ts analysis-insight-evidence.service.spec.ts
```

Expected:

```text
PASS
- 预测区间输出正确
- 样本不足时正确降级
- 异常与风险事实识别通过
```

- [ ] **Step 5: 提交洞察事实层**

```bash
git add backend/src/modules/analysis/analysis-forecast.service.ts backend/src/modules/analysis/analysis-insight-evidence.service.ts backend/src/app.module.ts backend/test/modules/analysis/analysis-forecast.service.spec.ts backend/test/modules/analysis/analysis-insight-evidence.service.spec.ts
git commit -m "feat: 新增智能分析洞察事实与预测服务"
```

## Task 3: 新增 richer report 增强服务并接入自由问数主链

**Files:**
- Create: `backend/src/modules/analysis/analysis-rich-report.service.ts`
- Create: `backend/src/modules/analysis/capability-packs/packs/rich-analysis-report.pack.ts`
- Modify: `backend/src/modules/analysis/ai-gateway.service.ts`
- Modify: `backend/src/modules/analysis/analysis-workflow.orchestrator.ts`
- Modify: `backend/src/modules/analysis/analysis-markdown.util.ts`
- Modify: `backend/src/modules/analysis/analysis-channel-presenter.service.ts`
- Test: `backend/test/modules/analysis/analysis-rich-report.service.spec.ts`
- Test: `backend/test/modules/analysis/analysis-markdown.util.spec.ts`
- Test: `backend/test/modules/analysis/analysis-channel-presenter.service.spec.ts`

- [ ] **Step 1: 写失败的 richer report 单测，锁定 Markdown 章节、建议与企业微信压缩输出**

```ts
it('应生成完整版与工作台版 Markdown，并保留企业微信压缩版', async () => {
  const enriched = await service.enrich(baseResultRecord);

  expect(enriched.report.workbenchMarkdown).toContain('## 执行摘要');
  expect(enriched.report.detailMarkdown).toContain('## 趋势预测');
  expect(enriched.report.detailMarkdown).toContain('## 经营建议');
  expect(enriched.report.wecomMarkdown).not.toContain('## 结果依据');
  expect(enriched.groundedMarkdown).toBe(enriched.report.detailMarkdown);
});
```

- [ ] **Step 2: 运行分析模块单测，确认 richer report 服务与 pack 尚未接入**

Run:

```bash
pnpm --dir backend test -- analysis-rich-report.service.spec.ts analysis-markdown.util.spec.ts analysis-channel-presenter.service.spec.ts
```

Expected:

```text
FAIL
- Cannot find module analysis-rich-report.service
- detailMarkdown / workbenchMarkdown 未生成
- wecomMarkdown 仍沿用旧摘要结构
```

- [ ] **Step 3: 实现 richer report 增强服务，并在自由问数主链接入**

```ts
const enriched = await this.analysisRichReportService.enrich(normalizedResult, {
  channel: params.channel,
  predictionMode: 'BALANCED_RANGE_FORECAST',
});

normalizedResult.report = enriched.report;
normalizedResult.groundedMarkdown = enriched.report.detailMarkdown;
normalizedResult.wecomMarkdown = enriched.report.wecomMarkdown;
normalizedResult.markdownOutline = enriched.report.markdownOutline;
normalizedResult.nextBestQuestions = enriched.report.nextBestQuestions;
```

- [ ] **Step 4: 重跑分析模块单测，确认 richer report 字段、Markdown 章节与企微压缩结果通过**

Run:

```bash
pnpm --dir backend test -- analysis-rich-report.service.spec.ts analysis-markdown.util.spec.ts analysis-channel-presenter.service.spec.ts analysis-report-composer.service.spec.ts
```

Expected:

```text
PASS
- richer report 新字段齐全
- Markdown 章节完整
- 企业微信压缩输出保留兼容字段
```

- [ ] **Step 5: 提交自由问数 richer report 主链接入**

```bash
git add backend/src/modules/analysis/analysis-rich-report.service.ts backend/src/modules/analysis/capability-packs/packs/rich-analysis-report.pack.ts backend/src/modules/analysis/ai-gateway.service.ts backend/src/modules/analysis/analysis-workflow.orchestrator.ts backend/src/modules/analysis/analysis-markdown.util.ts backend/src/modules/analysis/analysis-channel-presenter.service.ts backend/test/modules/analysis/analysis-rich-report.service.spec.ts backend/test/modules/analysis/analysis-markdown.util.spec.ts backend/test/modules/analysis/analysis-channel-presenter.service.spec.ts
git commit -m "feat: 自由问数接入智能分析 richer report"
```

## Task 4: 让查询模板复用统一 richer report 编排

**Files:**
- Modify: `backend/src/modules/query-assets/query-template-execution.service.ts`
- Modify: `backend/test/modules/query-assets/query-template-execution.service.spec.ts`
- Modify: `backend/test/integration/query-template-execution.integration-spec.ts`
- Modify: `backend/test/integration/wecom-query.integration-spec.ts`

- [ ] **Step 1: 写失败的模板链路回归测试，锁定“不再手拼 Markdown”与 richer report 统一输出**

```ts
expect(detail.body.report.detailMarkdown).toContain('## 趋势预测');
expect(detail.body.report.recommendations.length).toBeGreaterThan(0);
expect(detail.body.report.forecastInsight.status).toMatch(/READY|UNAVAILABLE|LOW_CONFIDENCE/);
expect(detail.body.report.groundedMarkdown).not.toContain('请基于返回数据给出中文经营分析');
```

- [ ] **Step 2: 运行模板集成测试，确认当前仍命中旧的模板手拼 Markdown**

Run:

```bash
pnpm --dir backend test -- query-template-execution.service.spec.ts query-template-execution.integration-spec.ts wecom-query.integration-spec.ts
```

Expected:

```text
FAIL
- report.detailMarkdown 不存在
- 模板结果仍包含“请基于返回数据给出中文经营分析”
```

- [ ] **Step 3: 重构模板结果记录构建，改为复用 richer report 增强服务**

```ts
const baseRecord = this.buildTemplateResultRecord({
  queryId,
  user,
  template,
  parameters,
  rows,
  resultBundle,
  executedAt,
  preparedQuery,
  scopeExecution: resolvedAnalysisScope,
});

const resultRecord = await this.analysisRichReportService.enrich(baseRecord, {
  channel: 'web-console',
  predictionMode: 'BALANCED_RANGE_FORECAST',
});
```

- [ ] **Step 4: 重跑模板与企微兼容测试，确认两条链路统一 richer report，同时企微兼容仍通过**

Run:

```bash
pnpm --dir backend test -- query-template-execution.service.spec.ts query-template-execution.integration-spec.ts wecom-query.integration-spec.ts result-accuracy.integration-spec.ts
```

Expected:

```text
PASS
- 模板结果不再手拼 Markdown
- 模板与自由问数都返回 richer report
- 企业微信仍能从新 report 对象派生兼容 Markdown
```

- [ ] **Step 5: 提交模板 richer report 统一改造**

```bash
git add backend/src/modules/query-assets/query-template-execution.service.ts backend/test/modules/query-assets/query-template-execution.service.spec.ts backend/test/integration/query-template-execution.integration-spec.ts backend/test/integration/wecom-query.integration-spec.ts
git commit -m "feat: 查询模板复用智能分析 richer report"
```

## Task 5: 升级 Markdown 阅读组件与 richer report 面板

**Files:**
- Create: `frontend/src/components/analysis/AnalysisRichReportPanel.vue`
- Modify: `frontend/src/components/analysis/AnalysisMarkdownPreview.vue`
- Modify: `frontend/src/components/analysis/AnalysisSectionCanvas.vue`
- Modify: `frontend/src/styles/main.css`
- Test: `frontend/tests/unit/analysis-markdown-preview.spec.ts`
- Test: `frontend/tests/unit/analysis-rich-report-panel.spec.ts`

- [ ] **Step 1: 先写失败的前端单测，锁定表格、引用块、语义区块与折叠入口**

```ts
it('应把趋势预测与经营建议渲染为语义区块，并支持折叠查看完整 Markdown', async () => {
  const wrapper = mount(AnalysisRichReportPanel, {
    props: { report: createRichReport() },
  });

  expect(wrapper.text()).toContain('趋势预测');
  expect(wrapper.text()).toContain('经营建议');
  expect(wrapper.find('.analysis-rich-report__markdown-toggle').exists()).toBe(true);
});

it('Markdown 组件应支持受控表格与引用说明块', () => {
  const wrapper = mount(AnalysisMarkdownPreview, {
    props: {
      markdown: '## 趋势预测\\n| 指标 | 内容 |\\n| --- | --- |\\n| 置信等级 | 中 |\\n> 当前预测仅供短期参考',
    },
  });

  expect(wrapper.html()).toContain('<table>');
  expect(wrapper.find('blockquote').exists()).toBe(true);
});
```

- [ ] **Step 2: 运行前端单测，确认 richer report 面板尚不存在且 Markdown 不支持表格**

Run:

```bash
pnpm --dir frontend test -- analysis-markdown-preview.spec.ts analysis-rich-report-panel.spec.ts
```

Expected:

```text
FAIL
- Cannot find module AnalysisRichReportPanel
- Markdown preview does not render table
```

- [ ] **Step 3: 创建 richer report 面板并升级 Markdown 渲染**

```vue
<AnalysisRichReportPanel
  :report="report"
  :temporal-scope="temporalScope"
  :default-open-sections="['summary', 'findings', 'trend', 'forecast', 'recommendations']"
/>
```

```ts
if (trimmedLine.startsWith('|') && currentTable.length > 0) {
  html.push(renderTable(currentTable));
}
```

- [ ] **Step 4: 重跑前端单测，确认 richer report 面板和 Markdown 语义渲染通过**

Run:

```bash
pnpm --dir frontend test -- analysis-markdown-preview.spec.ts analysis-rich-report-panel.spec.ts
```

Expected:

```text
PASS
- 语义区块、折叠入口和受控表格渲染通过
```

- [ ] **Step 5: 提交前端 richer report 基础组件**

```bash
git add frontend/src/components/analysis/AnalysisRichReportPanel.vue frontend/src/components/analysis/AnalysisMarkdownPreview.vue frontend/src/components/analysis/AnalysisSectionCanvas.vue frontend/src/styles/main.css frontend/tests/unit/analysis-markdown-preview.spec.ts frontend/tests/unit/analysis-rich-report-panel.spec.ts
git commit -m "feat: 升级智能分析 richer report 阅读组件"
```

## Task 6: 改造工作台单页完整展示与模板查询结果拉取方式

**Files:**
- Modify: `frontend/src/stores/analysis-query.store.ts`
- Modify: `frontend/src/pages/analysis/AnalysisWorkbenchPage.vue`
- Modify: `frontend/src/pages/analysis/AnalysisResultDetailPage.vue`
- Modify: `frontend/tests/unit/analysis-query.store.spec.ts`
- Modify: `frontend/tests/unit/analysis-page-layout.spec.ts`
- Modify: `frontend/tests/e2e/analysis-workbench.e2e-spec.ts`

- [ ] **Step 1: 写失败的 store / layout / e2e 测试，锁定“模板执行后必须 getQuery 回查”和“查询页直接展示完整报告”**

```ts
expect(analysisService.getQuery).toHaveBeenCalledWith('query_tpl_rich');
expect(wrapper.text()).toContain('趋势预测');
expect(wrapper.text()).toContain('经营建议');
expect(wrapper.text()).not.toContain('当前仅需跳转详情页查看完整报告');
```

- [ ] **Step 2: 运行前端测试，确认当前模板链路仍在前端手拼 currentResult**

Run:

```bash
pnpm --dir frontend test -- analysis-query.store.spec.ts analysis-page-layout.spec.ts
pnpm --dir frontend exec playwright test tests/e2e/analysis-workbench.e2e-spec.ts --project=chromium
```

Expected:

```text
FAIL
- runTemplate 未调用 getQuery
- 查询页缺少 richer report 区块
```

- [ ] **Step 3: 实现 store 拉取统一详情，并让工作台直接渲染 richer report 面板**

```ts
const executed = await analysisService.executeTemplate(templateId, {
  parameters: template?.defaultFilters ?? {},
  includeAiReport: true,
});

this.currentResult = await analysisService.getQuery(executed.queryId);
this.setViewState('reported');
```

```vue
<AnalysisRichReportPanel
  v-if="report"
  :report="report"
  :result="store.currentResult"
  :temporal-scope="temporalScope"
/>
```

- [ ] **Step 4: 重跑前端测试与 e2e，确认单页完整展示和模板统一拉详情通过**

Run:

```bash
pnpm --dir frontend test -- analysis-query.store.spec.ts analysis-page-layout.spec.ts
pnpm --dir frontend exec playwright test tests/e2e/analysis-workbench.e2e-spec.ts --project=chromium
```

Expected:

```text
PASS
- 模板执行后统一拉取 query detail
- 查询页直接展示完整 richer report
```

- [ ] **Step 5: 提交工作台单页完整展示改造**

```bash
git add frontend/src/stores/analysis-query.store.ts frontend/src/pages/analysis/AnalysisWorkbenchPage.vue frontend/src/pages/analysis/AnalysisResultDetailPage.vue frontend/tests/unit/analysis-query.store.spec.ts frontend/tests/unit/analysis-page-layout.spec.ts frontend/tests/e2e/analysis-workbench.e2e-spec.ts
git commit -m "feat: 查询页单页展示完整智能分析报告"
```

## Task 7: 同步规格文档并完成全链路回归验证

**Files:**
- Modify: `specs/001-crm-intelligent-analytics/data-model.md`
- Modify: `specs/001-crm-intelligent-analytics/quickstart.md`
- Modify: `specs/001-crm-intelligent-analytics/tasks.md`
- Verify: `backend/test/...`
- Verify: `frontend/tests/...`

- [ ] **Step 1: 同步数据模型、快速验证文档和任务清单**

```md
- 查询结果新增 richer report 字段：trendInsight、forecastInsight、anomalyInsights、riskInsights、recommendations。
- Web 查询页默认直接展示完整 richer report，不再要求先跳结果详情页。
- 查询模板执行完成后统一通过 query detail 回查完整报告。
```

- [ ] **Step 2: 运行后端全量相关回归**

Run:

```bash
pnpm --dir backend test -- analysis-query.contract-spec.ts result-accuracy.integration-spec.ts query-template-execution.integration-spec.ts wecom-query.integration-spec.ts analysis-markdown.util.spec.ts analysis-channel-presenter.service.spec.ts analysis-rich-report.service.spec.ts analysis-forecast.service.spec.ts analysis-insight-evidence.service.spec.ts
```

Expected:

```text
PASS
- 自由问数 richer report 通过
- 模板 richer report 通过
- 企业微信兼容压缩输出通过
```

- [ ] **Step 3: 运行前端单元与 E2E 回归**

Run:

```bash
pnpm --dir frontend test -- analysis-markdown-preview.spec.ts analysis-rich-report-panel.spec.ts analysis-query.store.spec.ts analysis-page-layout.spec.ts
pnpm --dir frontend exec playwright test tests/e2e/analysis-workbench.e2e-spec.ts --project=chromium
```

Expected:

```text
PASS
- 查询页完整 richer report 展示通过
- Markdown 阅读组件通过
- 模板 / 自由问数单页展示通过
```

- [ ] **Step 4: 检查工作树并确认只包含本计划预期修改**

Run:

```bash
git status --short
git diff --stat
```

Expected:

```text
仅出现 richer report、工作台展示、模板统一链路和文档同步相关文件
```

- [ ] **Step 5: 提交文档与最终回归结果**

```bash
git add specs/001-crm-intelligent-analytics/data-model.md specs/001-crm-intelligent-analytics/quickstart.md specs/001-crm-intelligent-analytics/tasks.md
git commit -m "docs: 同步智能分析富报告单页展示实现计划"
```

## Self-Review Checklist

- richer report 新字段必须同时出现在 `backend/src/shared/types/domain.ts`、`frontend/src/types/analysis.ts` 和 `openapi.yaml`。
- 模板链路前端不得继续在 `runTemplate` 中手拼 `currentResult`。
- `groundedMarkdown` 与 `report.groundedMarkdown` 必须继续存在，避免企业微信和旧详情页兼容断裂。
- 查询页直接展示完整报告，但详情页路由保留兼容，不做破坏性删除。
- 预测降级规则必须先在后端程序层落实，再交给 AI 做表达。

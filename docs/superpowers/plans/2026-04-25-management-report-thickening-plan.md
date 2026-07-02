# 经营报表加厚改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前 `management-report` 从“单专题单卡片”升级成接近旧 HTML 报表的信息密度版本，为每个可实现专题补齐足够的统计表格、图表和排行块，同时压缩文案、收紧排版并把色调调浅。

**Architecture:** 后端先把单专题 DTO 从 `metricCards + chart + table` 升级成 `blocks[]` 多块结构，并把各专题查询拆到独立 builder 文件；前端再把当前单卡片渲染器改成“专题画布 + 多 block 渲染器”，每个 tab 按 2 列或 3 列网格组织多个数据面板。视觉上保留经营驾驶舱辨识度，但从深色大横幅改成浅色、紧凑、表格优先的报表布局。

**Tech Stack:** Vue 3、TypeScript、Element Plus、NestJS、Vitest、Jest、Playwright

---

## 边界结论

- [ ] 保留并加厚：`总览`、`经营摘要`、`区域经营`、`线索`、`线索转化`、`线索机会`、`商机`、`客户`、`代理商/生态`、`产品方案`、`验收进度`、`收款情况`、`经营风险与建议`
- [ ] 明确不做：`区域热点`、`招投标信息`、`任务完成`
- [ ] 明确不引入：周报 Excel、外部资讯、外部招投标数据
- [ ] 明确策略：只做当前 CRM / mock 数据可支撑的块；字段不足的专题也要做“厚退化”，不是只放一行占位

## 目标形态

- [ ] 顶部仅保留一行标题、一行筛选栏、一行核心指标，不再默认展开大段口径说明
- [ ] 每个专题至少返回 `4` 到 `8` 个分析块；`商机` 和 `客户` 两个重专题目标 `8` 到 `12` 块
- [ ] 指标卡一律单行横向排列，桌面端不拆两排；窄屏可横向滚动
- [ ] 口径说明改成 `ElPopover / ElCollapse / Tooltip`，默认折叠
- [ ] 每个 block 必须有“数值支撑”，不能只放说明文字

## 文件结构

### 后端

**Files:**
- Create: `backend/src/modules/management-report/blocks/management-report.block.types.ts`
- Create: `backend/src/modules/management-report/builders/overview-report.builder.ts`
- Create: `backend/src/modules/management-report/builders/executive-summary-report.builder.ts`
- Create: `backend/src/modules/management-report/builders/regional-report.builder.ts`
- Create: `backend/src/modules/management-report/builders/leads-report.builder.ts`
- Create: `backend/src/modules/management-report/builders/lead-conversion-report.builder.ts`
- Create: `backend/src/modules/management-report/builders/lead-opportunity-report.builder.ts`
- Create: `backend/src/modules/management-report/builders/opportunities-report.builder.ts`
- Create: `backend/src/modules/management-report/builders/customers-report.builder.ts`
- Create: `backend/src/modules/management-report/builders/agents-report.builder.ts`
- Create: `backend/src/modules/management-report/builders/products-report.builder.ts`
- Create: `backend/src/modules/management-report/builders/acceptance-report.builder.ts`
- Create: `backend/src/modules/management-report/builders/collections-report.builder.ts`
- Create: `backend/src/modules/management-report/builders/risks-report.builder.ts`
- Modify: `backend/src/modules/management-report/management-report.types.ts`
- Modify: `backend/src/modules/management-report/management-report-query.service.ts`
- Modify: `backend/src/modules/management-report/management-report-composer.service.ts`
- Modify: `backend/src/modules/management-report/management-report.mock-data.ts`
- Test: `backend/test/integration/management-report.integration-spec.ts`

### 前端

**Files:**
- Create: `frontend/src/components/management-report/blocks/MetricStripBlock.vue`
- Create: `frontend/src/components/management-report/blocks/CompactInsightTableBlock.vue`
- Create: `frontend/src/components/management-report/blocks/TrendChartBlock.vue`
- Create: `frontend/src/components/management-report/blocks/BarRankingBlock.vue`
- Create: `frontend/src/components/management-report/blocks/FunnelBlock.vue`
- Create: `frontend/src/components/management-report/blocks/MatrixTableBlock.vue`
- Create: `frontend/src/components/management-report/blocks/DetailTableBlock.vue`
- Create: `frontend/src/components/management-report/blocks/DataQualityBlock.vue`
- Create: `frontend/src/components/management-report/blocks/SectionSourcePopover.vue`
- Create: `frontend/src/components/management-report/ManagementSectionCanvas.vue`
- Modify: `frontend/src/types/management-report.ts`
- Modify: `frontend/src/pages/management-report/ManagementReportPage.vue`
- Modify: `frontend/src/components/management-report/ManagementReportHeader.vue`
- Modify: `frontend/src/components/management-report/ManagementReportFilters.vue`
- Modify: `frontend/src/components/management-report/ManagementSectionTabs.vue`
- Replace: `frontend/src/components/management-report/ManagementSectionSummary.vue`
- Test: `frontend/tests/unit/management-report-page.spec.ts`
- Test: `frontend/tests/e2e/management-report-page.e2e-spec.ts`

## 专题实现矩阵

### Task 1: 升级报表数据契约

**Files:**
- Modify: `backend/src/modules/management-report/management-report.types.ts`
- Modify: `frontend/src/types/management-report.ts`

- [ ] 把 `ManagementReportSectionData` 从单 `chart? / table?` 升级为 `blocks: ManagementReportBlock[]`
- [ ] 支持的块类型至少包括：
  - `metric-strip`
  - `bar-ranking`
  - `trend`
  - `funnel`
  - `matrix-table`
  - `detail-table`
  - `insight-table`
  - `data-quality`
  - `record-preview`
- [ ] 保留 `metricCards` 仅用于页首 `总览` 和 `经营摘要`，专题内部全部迁移到 block
- [ ] 每个 block 带 `title`、`description?`、`size`、`layoutHint`，便于前端做紧凑网格

### Task 2: 重构专题渲染器与紧凑布局

**Files:**
- Create: `frontend/src/components/management-report/ManagementSectionCanvas.vue`
- Modify: `frontend/src/pages/management-report/ManagementReportPage.vue`
- Modify: `frontend/src/components/management-report/ManagementReportHeader.vue`
- Modify: `frontend/src/components/management-report/ManagementReportFilters.vue`
- Modify: `frontend/src/components/management-report/ManagementSectionTabs.vue`

- [ ] 页面外层 `padding` 从 `28px` 收紧到 `16px ~ 18px`
- [ ] 专题区块 `gap` 从 `22px` 收紧到 `12px ~ 14px`
- [ ] 卡片 `padding` 从 `24px` 收紧到 `14px ~ 16px`
- [ ] 头图从深色大渐变改成浅底轻渐变，不再抢占高度
- [ ] 顶部说明文案压缩成一行，不再展示长段描述
- [ ] `sourceNotes / footnotes` 默认折叠，只保留一个“口径”入口
- [ ] 指标条实现单行横向布局，桌面端不拆两排

### Task 3: 加厚 `总览` 与 `经营摘要`

**Files:**
- Create: `backend/src/modules/management-report/builders/overview-report.builder.ts`
- Create: `backend/src/modules/management-report/builders/executive-summary-report.builder.ts`

- [ ] `总览` 补成 `3` 块：
  - `核心 KPI 条`
  - `线索-客户-商机漏斗`
  - `核心口径摘要（折叠）`
- [ ] `经营摘要` 补成 `4` 块：
  - `一句话经营结论表`
  - `本周经营动作表`
  - `核心经营风险表`
  - `关键经营指标表`

### Task 4: 加厚 `区域经营`

**Files:**
- Create: `backend/src/modules/management-report/builders/regional-report.builder.ts`

- [ ] `区域经营` 补成 `4` 块：
  - `区域作战地图`
  - `区域行业聚焦`
  - `区域城市聚焦`
  - `地市作战图`
- [ ] 仅使用现有 `region / city / industry / amount / customer activation` 可支撑字段
- [ ] 不实现旧 HTML 的外部热点页，但把作战建议内嵌到本专题

### Task 5: 加厚 `线索 / 线索转化 / 线索机会`

**Files:**
- Create: `backend/src/modules/management-report/builders/leads-report.builder.ts`
- Create: `backend/src/modules/management-report/builders/lead-conversion-report.builder.ts`
- Create: `backend/src/modules/management-report/builders/lead-opportunity-report.builder.ts`

- [ ] `线索` 目标 `8` 块：
  - `来源 Top`
  - `跟进状态`
  - `质量等级`
  - `需求标签`
  - `月度新增趋势`
  - `负责人响应`
  - `来源 × 状态矩阵`
  - `风险线索预览`
- [ ] `线索转化` 目标 `5` 块：
  - `cohort 漏斗`
  - `阶段转化表`
  - `多线索成交客户`
  - `老客户再次回流`
  - `无商机未成交线索`
- [ ] `线索机会` 目标 `4` 块：
  - `潜在渠道/伙伴排行`
  - `高潜未转化客户`
  - `未成交代理商线索`
  - `未成交且无 10%+ 商机客户`

### Task 6: 加厚 `商机`

**Files:**
- Create: `backend/src/modules/management-report/builders/opportunities-report.builder.ts`

- [ ] `商机` 第一轮先做 `10` 块，覆盖旧 HTML 最硬核的视角：
  - `近12~18个月新增商机数趋势`
  - `近12~18个月新增商机金额趋势`
  - `在手盘子摘要`
  - `本周新增`
  - `阶段金额结构`
  - `阶段数量结构`
  - `负责人在手商机金额排行`
  - `负责人 × 在手阶段金额`
  - `负责人 × 预计签单月份`
  - `高金额风险商机预览`
- [ ] 第二轮再补 `渠道来源 / 区域机会 / 行业机会 / 伙伴贡献 / 赢输单`

### Task 7: 加厚 `客户`

**Files:**
- Create: `backend/src/modules/management-report/builders/customers-report.builder.ts`

- [ ] `客户` 第一轮做 `8` 块：
  - `客户池总览`
  - `客户行业 Top`
  - `客户负责人 Top`
  - `新建/存量客户`
  - `历史成交/未成交客户`
  - `客户激活情况`
  - `市场空白客户`
  - `无商机但仍在跟进客户`
- [ ] 第二轮补 `生命周期 / 激活深度 / 新客户孵化池 / 老客户二开池 / 重点客户池 / 预警池`

### Task 8: 加厚 `代理商/生态` 与 `产品方案`

**Files:**
- Create: `backend/src/modules/management-report/builders/agents-report.builder.ts`
- Create: `backend/src/modules/management-report/builders/products-report.builder.ts`

- [ ] 这两个专题不再只返回退化占位
- [ ] 即使字段不全，也至少返回 `3` 到 `4` 块：
  - `总览指标`
  - `Top 排行`
  - `结构分布`
  - `字段完整度 / 退化说明`
- [ ] 若字段仍不足，退化成“有数值支撑的退化专题”，不要只放一句“当前不可用”

### Task 9: 加厚 `验收进度 / 收款情况 / 风险`

**Files:**
- Create: `backend/src/modules/management-report/builders/acceptance-report.builder.ts`
- Create: `backend/src/modules/management-report/builders/collections-report.builder.ts`
- Create: `backend/src/modules/management-report/builders/risks-report.builder.ts`

- [ ] `验收进度` 做 `3` 块：
  - `验收进度摘要`
  - `负责人验收进度`
  - `未验收合同清单`
- [ ] `收款情况` 做 `5` 块：
  - `收款摘要`
  - `销售收款情况`
  - `月度回款趋势`
  - `应收状态`
  - `收款负责人`
- [ ] `风险` 做 `6` 块：
  - `核心经营风险`
  - `经营建议`
  - `风险汇总`
  - `数据质量`
  - `风险商机预览`
  - `风险客户预览`

### Task 10: 测试与回归

**Files:**
- Modify: `backend/test/integration/management-report.integration-spec.ts`
- Modify: `frontend/tests/unit/management-report-page.spec.ts`
- Modify: `frontend/tests/e2e/management-report-page.e2e-spec.ts`

- [ ] 后端集成测试校验每个重点专题 `blocks.length >= 4`
- [ ] 前端单测校验口径说明默认折叠、指标条单行渲染、专题切换后渲染多个 block
- [ ] E2E 校验：
  - 首屏只加载 `总览 + 经营摘要`
  - 点击 tab 后出现多个表格/图表块
  - 导出仍可用
  - 间距收紧后核心内容在首屏可见

## 实施优先级

- [ ] P0：数据 contract 升级、前端多 block 渲染器、紧凑布局
- [ ] P1：`经营摘要 / 区域经营 / 线索 / 商机 / 客户 / 收款 / 风险`
- [ ] P2：`线索转化 / 线索机会 / 验收进度`
- [ ] P3：`代理商/生态 / 产品方案` 厚退化或正式统计

## 完成标准

- [ ] 每个可实现专题至少有 `4` 个数据块
- [ ] 页面默认不出现大段口径说明
- [ ] 页首核心指标单行展示
- [ ] 页面整体视觉比当前更浅、更紧凑、更像报表
- [ ] 自动化测试通过：`pnpm --dir backend test`、`pnpm --dir frontend test:unit`、`pnpm --dir frontend test:e2e`、`pnpm build`

## Why

现有 Web 智能分析工作台已经支持自由问数、常用查询、最近查询和查询模板治理，但常用查询仍作为抽屉辅助入口存在，用户无法把高价值自由问数结果顺畅沉淀为可复用模板，也缺少“我的模板 / 其它模板”、分类标签、大列表搜索和跨部门安全复用规则。

本变更将常用查询升级为工作台左侧常驻的高频查询资产库，让业务用户可以保存、复制、筛选和执行模板，同时继续遵守实时权限、模板范围治理、只读 SQL 安全和审计边界。

## What Changes

- 在 Web 智能分析工作台左侧新增常驻常用查询模板库，默认展示“我的模板”，并提供“其它模板”标签页。
- 支持用户将成功自由问数结果保存为查询模板，优先复用后端实际执行的受控 SQL；仅存在执行计划时由后端编译为参数化 SQL 并重新校验，无法安全复现时不允许保存。
- 支持“添加到我的模板”生成个人副本：复制模板定义快照，记录来源模板 ID、来源名称、来源 SQL 版本和复制时间，副本后续不自动跟随来源模板变更。
- 支持模板标签分类；标签必须支持选择已有标签和自由输入新标签，并允许 AI 推荐后由用户确认。
- 模板列表支持关键词、标签、创建人筛选，两个标签页均按历史累计点击或执行次数优先排序，并支持几百到上千条模板的虚拟滚动或等效性能方案。
- 新增固定部门模板跨部门复用规则：无权覆盖原固定部门范围时不得执行原模板；系统可以在用户确认后将固定部门条件改写为当前可见范围，并重新执行 SQL 白名单、AST、范围注入和审计。
- 扩展受控 SQL 模板新增能力，新增最小动作权限 `template.sql.write` 或等价中文权限，仅允许编写、校验、预览和保存查询 SQL，不等同于完整模板治理权限。
- 最近查询保持抽屉入口和现有个人历史属性，重跑继续按当前实时权限重新执行。

## Capabilities

### New Capabilities

- `common-query-template-library`: 覆盖工作台常用查询资产库、我的模板 / 其它模板、自由问数保存为模板、个人副本、标签分类、模板搜索筛选、历史点击排序和左侧常驻交互。

### Modified Capabilities

- `query-template-scope-governance`: 增加固定部门模板跨部门复用的 AI 辅助改写、用户确认、阻断和审计要求。
- `controlled-analysis-orchestration`: 增加自由问数结果保存为模板时对受控 SQL / 执行计划复现、重新校验和不可保存阻断的要求。
- `feature-permission-enforcement`: 增加 `template.sql.write` 或等价查询 SQL 编写权限的运行时执行点要求。
- `ui-design-system`: 增加分析工作台左侧常驻可拖拽常用查询区、大列表虚拟滚动、最近查询继续抽屉化和模板保存交互反馈要求。

## Impact

- 后端模块：`backend/src/modules/query-assets/`、`backend/src/modules/analysis/`、`backend/src/modules/governance/`、`backend/src/modules/audit/`、权限决策相关服务和应用存储模型。
- 前端模块：`frontend/src/pages/analysis/AnalysisWorkbenchPage.vue`、`frontend/src/components/analysis/CommonQueryPanel.vue`、`frontend/src/components/analysis/RecentQueryPanel.vue`、`frontend/src/pages/governance/QueryTemplatePage.vue`、`frontend/src/stores/analysis-query.store.ts`、`frontend/src/services/analysis.service.ts`、类型定义和样式。
- API 契约：扩展工作台模板列表参数与分页；新增自由问数保存模板接口；新增复制到我的模板接口；扩展治理模板的分类、标签、来源、归属和历史点击字段。
- 数据模型：扩展查询模板记录字段，新增或迁移个人副本来源快照、分类标签和历史使用统计。
- 测试：需要补充后端契约 / 集成测试、前端组件 / store 测试、工作台 E2E 和权限 / 审计回归。

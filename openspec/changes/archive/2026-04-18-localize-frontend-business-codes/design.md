## Context

当前前端已经完成 Element Plus 化和页面视觉重构，但业务代码展示仍分散在页面 template 中。已检查的路由页面包括登录页、智能分析工作台、分析结果详情、合同审核工作台、合同审核详情、治理策略、查询模板、连接策略和审计中心；其中审计中心、分析结果详情、智能分析工作台、查询模板和治理策略存在明确的原始代码直出问题。

典型问题包括：

- `AuditEventPage.vue` 直接展示 `eventType`、`riskLevel`、`entryScene`、`entryTargetWorkflow`、`workflowTargetWorkflow`、`entryFallbackReason`、`item.level`、`item.scene` 和 `fallbackReason`。
- `AnalysisResultDetailPage.vue` 直接展示 `detail.status`、`block.blockType`、`executionMode` 和 `availableActions.actionType`。
- `AnalysisWorkbenchPage.vue` 直接展示 `serviceStatus`，并在侧栏硬编码 `ONLINE`。
- `QueryTemplatePage.vue` 直接展示模板 `status`，侧栏直接展示 `defaultViewType`。
- `GovernancePolicyPage.vue` 直接展示策略 `status`。

根因是前端缺少统一业务字典 / 展示适配层，导致每个页面独立决定如何显示后端代码。后续实现必须优先复用统一出口，而不是在页面中追加零散 `switch`。

## Goals / Non-Goals

**Goals:**

- 建立统一的前端业务代码中文标签模块，覆盖本轮发现的状态、风险、审计、入口、工作流、fallback、执行模式、数据来源、动作类型和模板视图类型。
- 逐页替换 raw code 展示，确保业务用户看到中文标签，审计人员仍能在未知码场景看到原始代码。
- 保持接口参数、后端契约、权限模型、审计记录和原始数据结构不变。
- 补齐单元测试和 E2E / 页面测试，把截图中出现的典型英文代码作为回归样例。

**Non-Goals:**

- 不要求后端接口改为返回中文标签。
- 不修改 `contracts/openapi.yaml` 的字段名或枚举值。
- 不修改数据库、CRM API 接入、权限判定、白名单、审计写入和企业微信能力边界。
- 不读取或引用任何本地敏感配置。
- 不重新设计页面视觉风格，不输出新的 `.pen` 原型。

## Decisions

### 决策 1：前端建立统一业务代码展示模块

后续实现新增 `frontend/src/ui/business-code-labels.ts` 或同等语义模块，集中导出分类格式化函数，例如 `formatStatusLabel`、`formatRiskLevelLabel`、`formatAuditEventTypeLabel`、`formatEntrySceneLabel`、`formatWorkflowLabel`、`formatFallbackReasonLabel`、`formatExecutionModeLabel`、`formatExecutionSourceLabel`、`formatActionTypeLabel` 和 `formatViewTypeLabel`。

原因：

- 同一类代码会出现在表格、卡片、标签和详情说明中，集中出口可以避免页面重复翻译。
- 审计中心和分析详情的代码类型交叉明显，逐页 `switch` 很容易漏改或翻译不一致。
- 后续新增枚举时只需要扩展字典和测试，不需要全局搜索页面 template。

备选方案：

- 后端直接返回中文字段。该方案会扩大 API 契约和多渠道展示影响，不适合作为本轮前端显示缺陷修复。
- 每个页面自行定义映射。实现最快，但会固化当前根因，后续仍然容易漏翻译。

### 决策 2：已知码显示中文，未知码显示中文兜底加原始代码

展示规则为：已知代码显示清晰中文标签；未知代码不得原样裸露，应显示“未知类型（原始代码）”“未知状态（原始代码）”或同等中文兜底。空值仍显示 `--` 或当前页面既有空状态文案。

原因：

- 业务用户需要中文标签才能理解页面。
- 审计、排障和接口联调仍需要保留原始代码线索，不能直接隐藏未知值。

备选方案：

- 未知码只显示“未知”。该方案对排障不友好。
- 未知码继续原样显示。该方案无法满足中文展示要求。

### 决策 3：按页面路由逐页替换并保留现有行为绑定

后续实现按 `frontend/src/router/index.ts` 的页面清单逐页处理，并同步检查相关分析组件。页面替换只触达展示表达式、标签文案和必要的轻量导入，不改变 `v-model`、事件绑定、service 调用、store 流程、路由路径或后端字段。

页面处理顺序建议：

1. 审计中心：优先修复截图中的 AI 治理建议、入口健康度、趋势表格和事件明细。
2. 分析结果详情：修复状态、执行模式、执行来源、流式块类型和可执行动作。
3. 智能分析工作台：修复服务状态和侧栏状态说明。
4. 治理策略与查询模板：修复策略状态、模板状态和默认视图类型。
5. 合同审核页面：保留现有中文映射，统一迁移到共享字典或至少补充测试防止回退。
6. 登录页与连接策略：确认没有新增 raw code 展示，并纳入页面级巡检。

原因：

- 审计中心是当前问题最集中页面，优先修复能最快验证字典覆盖能力。
- 按路由清单执行可以满足“每个页面都检查一遍”的验收要求。

### 决策 4：测试以“禁止典型内部代码直出”为核心断言

测试需要覆盖字典函数和页面渲染两层：

- 单元测试验证已知码中文化、未知码兜底和空值处理。
- 审计页测试使用 `WECOM_IDLE_MESSAGE`、`WECOM_DAILY_REPORT_ENTRY`、`active-conversation-flow-continue`、`LOW`、`critical`、`info` 等截图样例，断言页面显示中文标签且不再裸露这些代码。
- 分析结果详情、工作台、治理策略、查询模板和合同审核测试覆盖各自状态码和动作码。
- E2E 测试继续使用后端 raw code mock，验证浏览器页面最终展示中文。

原因：

- 当前部分测试仍断言 raw code 出现在页面中，测试需要从“接受原始代码”改为“拒绝原始代码裸露”。
- 截图样例可直接作为回归输入，防止同类问题再次出现。

## Risks / Trade-offs

- [字典覆盖不全导致仍有未知码] → 初版先覆盖现有接口和截图样例，未知码通过中文兜底保留原值，并在测试中覆盖兜底。
- [同一代码在不同上下文含义不同] → 格式化函数必须按分类命名，禁止使用单个全局 map 盲目翻译所有字段。
- [页面替换遗漏] → 以 `router/index.ts` 页面清单和 `rg` 搜索结果作为检查清单，任务中要求逐页勾选。
- [测试快照仍保留英文期望] → 更新单元测试和 E2E mock 断言，明确禁止截图样例 raw code 裸露。
- [中文标签过长影响表格布局] → 继续遵循 `DESIGN.md` 的标签不换行和表格可读性要求，必要时用 tooltip 或窄屏横向滚动承载完整文本。

## Migration Plan

1. 新增业务代码展示模块和对应单元测试。
2. 先替换审计中心所有 raw code 展示，并更新审计页单元测试和 E2E。
3. 替换分析工作台、分析结果详情和分析组件中的状态 / 动作展示。
4. 替换治理策略、查询模板和连接策略的状态 / 视图展示。
5. 复查合同审核工作台与详情页，把现有局部映射纳入统一字典或测试保护。
6. 运行 `rg` 检查典型 raw code 是否仍出现在用户可见 template 断言中。
7. 运行前端 lint、单元测试、E2E 相关用例和 build。

## Open Questions

无。默认本轮只做前端展示本地化，不改后端枚举和接口契约。

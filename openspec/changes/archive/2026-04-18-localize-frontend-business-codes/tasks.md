## 1. 统一字典与基础测试

- [x] 1.1 以 `frontend/src/router/index.ts` 为准建立页面巡检清单，记录每个页面需要检查的业务代码展示字段
- [x] 1.2 新增 `frontend/src/ui/business-code-labels.ts` 或同等模块，按分类提供状态、风险、审计事件、入口场景、工作流、fallback 原因、执行模式、执行来源、动作类型、服务状态和视图类型的中文格式化函数
- [x] 1.3 为业务代码展示模块补充单元测试，覆盖已知码中文标签、未知码中文兜底、空值显示和不同分类同名代码隔离
- [x] 1.4 搜索前端页面和组件中直接插值的 `status`、`riskLevel`、`eventType`、`entryScene`、`workflowTargetWorkflow`、`fallbackReason`、`actionType`、`viewType` 等字段，形成实施前后对照

## 2. 审计中心中文化

- [x] 2.1 更新 `AuditEventPage.vue` 的 AI 阈值预警和 AI 治理建议标签，将 `critical`、`warning`、`info` 转为中文等级
- [x] 2.2 更新 `AuditEventPage.vue` 的入口场景健康度、入口目标工作流健康度、fallback 原因分布、入口场景趋势和 fallback 原因趋势，使用统一字典显示中文
- [x] 2.3 更新 `AuditEventPage.vue` 的事件明细表格，将事件类型、入口场景、入口目标工作流、最终程序工作流、fallback 原因、风险等级和结果统一转换为中文标签
- [x] 2.4 更新 `frontend/tests/unit/audit-event-page.spec.ts` 和相关 E2E mock，使用截图中的 raw code 作为输入并断言页面不再裸露 `WECOM_IDLE_MESSAGE`、`active-conversation-flow-continue`、`LOW`、`critical` 和 `info`

## 3. 智能分析页面中文化

- [x] 3.1 更新 `AnalysisWorkbenchPage.vue` 的服务状态标签和侧栏状态说明，将 `ONLINE`、`DEGRADED`、`OFFLINE` 转为中文，并移除硬编码 `ONLINE` 展示
- [x] 3.2 更新 `AnalysisResultDetailPage.vue` 的结果状态、执行模式、执行来源、流式块类型和可执行动作展示，统一转换为中文标签
- [x] 3.3 检查 `CommonQueryPanel.vue`、`RecentQueryPanel.vue`、`ResultSummaryPanel.vue`、`ResultChartView.vue`、`ResultTableView.vue` 和 `MetricCardGroup.vue`，对用户可见的系统字段使用统一字典，避免误翻译真实 CRM 业务数据值
- [x] 3.4 更新分析工作台、结果详情和分析组件相关单元测试 / E2E，覆盖 `RETURNED`、`BLOCKED`、`PLAN_EXECUTION`、`GUARDED_READONLY_SQL` 和动作类型中文展示

## 4. 治理、合同与登录页面巡检

- [x] 4.1 更新 `GovernancePolicyPage.vue` 的策略状态展示，将 `ACTIVE` 等状态转为中文
- [x] 4.2 更新 `QueryTemplatePage.vue` 的模板状态和默认视图类型展示，将 `ACTIVE`、`RANKING_TABLE` 等代码转为中文
- [x] 4.3 检查 `ConnectionPolicyPage.vue` 和 `LoginPage.vue`，确认不存在新增 raw code 裸露；如发现状态或原因码展示，接入统一字典
- [x] 4.4 检查 `ContractReviewWorkbenchPage.vue` 和 `ContractReviewDetailPage.vue`，保留现有中文展示效果，并将可复用的任务状态、风险等级、执行模式和补充审核状态纳入统一字典或测试保护
- [x] 4.5 更新治理、合同和登录相关测试，确保每个已注册路由页面均通过中文展示巡检

## 5. 验证与回归

- [x] 5.1 运行 `rg -n "WECOM_|AUTH_|LOW|MEDIUM|HIGH|critical|warning|info|RETURNED|BLOCKED|ACTIVE|RANKING_TABLE|active-conversation-flow-continue" frontend/src/pages frontend/src/components frontend/tests`，确认剩余命中不是用户可见 raw code 直出或旧断言
- [x] 5.2 运行 `pnpm --dir frontend lint`
- [x] 5.3 运行 `pnpm --dir frontend test:unit`
- [x] 5.4 运行覆盖分析、治理、审计、合同页面的 E2E 测试
- [x] 5.5 运行 `pnpm --dir frontend build`
- [x] 5.6 运行 `openspec validate localize-frontend-business-codes --strict`
- [x] 5.7 人工打开登录页、智能分析工作台、分析结果详情、合同审核工作台、合同审核详情、治理策略、查询模板、连接策略和审计中心，确认典型内部代码不再裸露且原有交互行为不变

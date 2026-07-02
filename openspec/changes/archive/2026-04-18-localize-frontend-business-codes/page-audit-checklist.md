## 页面巡检清单

本清单以 `frontend/src/router/index.ts` 注册路由和当前分析组件为准，用于记录本次业务代码中文化检查范围。检查结论只针对用户可见展示，不包含筛选输入框中用户主动输入的 raw code，也不包含代码中的条件判断。

## 路由页面

- 登录页 `LoginPage.vue`：未发现用户可见后端业务代码直出；`snsapi_privateinfo` 属于企业微信网页登录协议参数，仅在脚本中使用，不展示给用户。
- 智能分析工作台 `AnalysisWorkbenchPage.vue`：服务状态已通过统一字典显示为中文；原 `ONLINE` 仅保留为默认状态判断输入。
- 分析结果详情 `AnalysisResultDetailPage.vue`：结果状态、执行模式、执行来源、流式块类型和可执行动作已通过统一字典显示为中文。
- 智能合同审核工作台 `ContractReviewWorkbenchPage.vue`：任务执行模式已有中文映射，页面未直接展示任务状态 raw code；后续如新增任务状态标签应复用统一字典。
- 智能合同审核详情 `ContractReviewDetailPage.vue`：任务状态、风险等级和执行模式已有中文展示，并已有单元测试保护不展示 `COMPLETED` 等原始状态。
- 治理策略 `GovernancePolicyPage.vue`：策略状态已通过统一字典显示为中文。
- 查询模板管理 `QueryTemplatePage.vue`：模板状态和默认视图类型已通过统一字典显示为中文；`ACTIVE` 仅保留为标签样式判断。
- 连接策略管理 `ConnectionPolicyPage.vue`：页面仅展示数值阈值和中文配置文案，未发现后端业务代码直出。
- 审计中心 `AuditEventPage.vue`：审计等级、入口场景、目标工作流、fallback 原因、事件类型和风险等级已通过统一字典显示为中文。

## 分析组件

- `CommonQueryPanel.vue`：只展示模板名称、说明和按钮文案，未直接展示模板状态或视图类型。
- `RecentQueryPanel.vue`：只展示问题、摘要和时间，未直接展示历史状态。
- `MetricCardGroup.vue`：展示受控结果中的指标名和值，属于真实业务数据，不应套用系统代码字典。
- `ResultChartView.vue`：展示图表标题和结果序列，属于真实业务数据，不应套用系统代码字典。
- `ResultSummaryPanel.vue`：展示结果摘要、口径、解释和数据时间，未直接展示系统代码字段。
- `ResultTableView.vue`：展示查询结果明细，字段值可能来自 CRM 真实数据，不应全局替换业务字典，避免误翻译客户或项目数据。

## 回归样例

- 审计中心必须把 `WECOM_IDLE_MESSAGE` 显示为“企业微信空闲消息”。
- 审计中心必须把 `active-conversation-flow-continue` 显示为“活跃会话流程继续”。
- 审计中心必须把 `LOW` / `HIGH` 等风险等级显示为“低风险” / “高风险”。
- 分析详情必须把 `RETURNED` 显示为“已返回结果”。
- 分析详情必须把 `GUARDED_DIRECT_QUERY` 显示为“受控直查”。
- 分析详情必须把 `GUARDED_READONLY_SQL` 显示为“受控只读 SQL”。
- 治理策略和查询模板必须把 `ACTIVE` 显示为“启用”。
- 查询模板必须把 `RANKING_TABLE` 显示为“排名表”。

## Why

当前分析链路同时存在宽业务解析、窄业务解析、本地只读兜底、SQLite 快照模板、MySQL 分析库和 OpenAPI 执行路径。同一类问题可能因为某个环节超时或校验失败而落到不同历史路径，导致标题、明细、统计口径和用户真实意图不一致。

联软已经提供标准 OpenAPI，当前阶段应把 CRM 智能分析收敛为“统一业务语义解析 + OpenAPI 真实取数 + 本地受控分析 + 结果校验交付”的主链，SQLite 脱敏资料只作为业务结构和模板知识输入，不再参与正式结果取数。

## What Changes

- **BREAKING**：自由问数主链不再调用 `analysis-intent-pack` 窄业务解析作为第二主链；业务语义解析失败时进入安全阻断或明确缺口提示，不再用本地 CRM 只读词表生成可执行意图。
- **BREAKING**：CRM 分析执行默认不再自动尝试 SQLite 快照、MySQL 分析库、Text-to-SQL 或受控 SQL 兜底；OpenAPI 不能覆盖的分析必须返回能力缺口，等待联软补 API 或补字段。
- 统一保留 `business-analysis-intent-pack` 作为自由问数业务语义入口，并通过映射层输出现有 `AnalysisIntent`，保障后续计划、执行和交付兼容。
- SQLite 脱敏库、DDL、字段字典、关系说明、状态枚举和样例数据只作为分析知识资产、测试资料和模板验证材料，不作为正式结果明细来源。
- 四类默认业务主题统一走 OpenAPI 真实取数：商机、渠道商、客户报备、订单；综合经营问题必须拆成组合业务任务，不得误压成单一合同转化或订单贡献报告。
- 结果明细必须来自联软 OpenAPI 返回的真实业务对象，不得展示脱敏占位名或 SQLite 样例名；若 OpenAPI 缺字段或缺接口，必须返回可交付给联软的缺口清单。
- 企业微信和 Web 交付继续消费统一结果包；AI 总结只能基于已校验事实结果生成经营建议。

## Capabilities

### New Capabilities

- `openapi-first-crm-analysis-mainline`: 定义联软 OpenAPI 作为 CRM 智能分析唯一真实取数主链的意图、执行、缺口和交付要求。

### Modified Capabilities

- `ai-entry-intent-orchestration`: 自由问数主链从多层历史解析收敛为统一业务语义解析，窄业务解析和本地词表不得继续承担主链。
- `controlled-analysis-orchestration`: 受控分析编排默认只允许 OpenAPI 真实取数；SQLite、MySQL 分析库、Text-to-SQL 和受控 SQL 不再作为正式结果自动兜底。
- `crm-api-first-integration`: 联软 OpenAPI 已可用的 CRM 分析阶段，官方 API 缺口必须显式返回，不得自动绕到数据库或脱敏快照路径。

## Impact

- 影响后端分析入口：`AnalysisIntentService`、`AiGatewayService`、`BusinessAnalysisIntentMapperService`。
- 影响分析执行编排：`AnalysisWorkflowOrchestrator`、`AnalysisReadToolRegistryService`、`AnalysisWarehouseAnalysisExecutorService` 调用关系。
- 影响联软 OpenAPI 执行器和结果校验：必须确保真实明细、阶段中文释义、渠道商/客户/商机/订单名称来自 OpenAPI。
- 影响企业微信结果交付：继续只发模板卡片，明细折叠/下拉规则保留。
- 不新增外部依赖，不修改用户认证、企业微信登录和 CRM 写入链路。

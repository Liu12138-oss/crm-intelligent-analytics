## Context

当前仓库已经具备以下与 SQL 审计相关的基础能力：

- Web 审计中心已有 [AuditEventPage.vue](/D:/code/CRM/frontend/src/pages/audit/AuditEventPage.vue) 和 `GET /audit-events` 业务事件检索接口；
- 受控问数主链已经输出 `executionTraceSummary`、`matchedAdapter`、`fallbackReason` 等执行依据摘要；
- `CrmReadonlyService` 已经承担大量 CRM 只读查询真实入口，经营报表也优先通过 `executeQuery()` 访问真实 CRM 只读库；
- 企业微信目录同步和登录兜底修复仍存在直接 `pool.query(...)` 的写库路径。

但这些能力还不足以回答管理层最关心的问题：

- 这套系统到底向 CRM 发了哪些 SQL？
- 哪些 SQL 只是预检，哪些真正打到了数据库？
- 有哪些 SQL 是写库，具体写了哪几张表？
- 某条 SQL 是哪个用户、哪个页面、哪次问数或哪个后台动作触发的？
- 管理员查看完整 SQL / 参数时，系统自己是否留下了二次审计？

如果继续把 SQL 信息塞入现有 `AuditEventRecord`，会出现三类问题：

- 业务事件流与 SQL 明细流体量差异太大，分页、保留期和权限要求完全不同；
- 原始 SQL 和完整参数属于更高敏感级别，不能和普通事件详情混放；
- 未来要覆盖“本系统后端服务自己发出的所有 CRM SQL”，必须有独立的统一采集入口和查询接口。

因此，本次变更不把目标定义成“数据库级全局 SQL 审计”，而是明确限定为：

> 只审计“本系统后端服务自己发出的所有 CRM SQL”，包括只读查询、预检 SQL 和受控写库 SQL；不覆盖其它系统、人工脚本或 DBA 手工执行。

## Goals / Non-Goals

**Goals**

- 在审计中心新增独立 `SQL 审计` Tab，支持治理用户查看 SQL 摘要、筛选、明细和受控详情。
- 建立独立 `SqlAuditRecord` 审计流，记录本系统后端访问 CRM 数据库时的 SQL 生命周期。
- 统一收口本系统访问 CRM 的 SQL 执行入口，至少覆盖：
  - `CrmReadonlyService.executeQuery()`
  - `CrmReadonlyService.preflightQuery()`
  - `CrmReadonlyService` 内部身份 / 角色 / 部门 / 码表查询
  - `CrmWecomIdentityRepository` 的 `wx_*` 写库 SQL
  - `CrmPhoneConfirmationRepairService` 的 `users` 写库 SQL
- 为完整 SQL 与完整参数建立单独敏感权限和 reveal 行为留痕。
- 让 SQL 审计记录与业务审计事件、分析请求、会话、执行模式、适配器和 fallback 原因可关联追溯。

**Non-Goals**

- 不承诺数据库级全局 SQL 审计，不覆盖其它系统或人工脚本执行的 SQL。
- 不在本次提案中接入数据库代理、中间件或数据库原生审计插件。
- 不在首版中提供 SQL 审计导出、离线归档或长期压缩存储策略自动化。
- 不在首版中对所有业务模块一口气做 SQL 指纹治理建议或容量治理，只先提供执行追踪型审计。

## Decisions

### 决策 1：新增独立 `SqlAuditRecord`，不复用 `AuditEventRecord`

本次新增独立 SQL 审计流，而不是继续把 SQL 文本、参数和耗时塞进现有 `AuditEventRecord` 的 `querySnapshot` 或 `sessionSnapshot`。

原因：

- 业务审计和 SQL 审计的查询密度、体量、权限等级和保留策略明显不同；
- 原始 SQL 和参数需要更细权限控制，复用业务事件接口会让普通审计查看者被动接触高敏数据；
- 独立模型更容易实现 SQL 指纹、按表聚合、按执行阶段筛选等专业查询能力。

建议字段：

- 基础：`id`、`createdAt`、`stage`、`status`、`riskLevel`
- 责任人上下文：`actorId`、`actorRoleIds`、`channel`、`sessionId`、`requestId`
- 模块上下文：`moduleKey`、`programName`、`databaseRole`
- SQL 元数据：`operationType`、`tables`、`sqlText`、`paramsJson`、`normalizedSql`、`sqlFingerprint`
- 结果元数据：`rowCount`、`affectedRows`、`durationMs`、`timeoutMs`
- 分析链追溯：`executionMode`、`executionSource`、`matchedAdapter`、`fallbackReason`
- 异常与阻断：`blockedReason`、`errorMessage`

### 决策 2：SQL 审计记录采用生命周期阶段模型

SQL 审计不是只在执行成功后落一条结果，而是记录以下阶段：

- `PREPARED`：SQL 已生成，准备执行
- `PREFLIGHT`：执行前 `EXPLAIN` 或等价预检
- `EXECUTED`：成功发往数据库并返回
- `FAILED`：发往数据库后失败
- `BLOCKED`：在到库前被风控、白名单、AST、权限或参数校验阻断

原因：

- 领导关心的是“破坏力”，不仅要知道有没有执行成功，还要知道系统是否做过前置安全检查；
- 对问数链来说，很多高风险 SQL 会在执行前被阻断，如果没有 `BLOCKED` 阶段，就无法证明系统已经安全拦截；
- 对写库链来说，需要区分“准备写”“实际写成”“写失败”。

### 决策 3：通过统一 SQL 包装层覆盖本系统所有 CRM SQL

本次不采用数据库代理或驱动层黑盒拦截，而是通过统一执行包装层显式收口。

设计：

- 在 `CrmReadonlyService` 中新增统一包装方法：
  - `executeAuditedQuery(...)`
  - `executeAuditedPreflight(...)`
- 在写库路径中新增统一包装方法：
  - `executeAuditedWriteQuery(...)`
- `executeQuery()`、`preflightQuery()` 和散落的 `pool.query(...)` 最终都改为消费这些包装方法。

原因：

- 当前仓库访问 CRM 的主要 SQL 已经集中在少数服务里，可通过有限改造实现“本系统全部 SQL”覆盖；
- 显式包装比驱动级 monkey patch 更可控，且能保留业务上下文；
- 便于后续对不同模块打不同 `moduleKey`、`statementStage` 和 `databaseRole`。

### 决策 4：引入 `SqlAuditContextService` 透传业务上下文

仅记录 SQL 文本和参数不够，必须把“是谁触发的”与“为什么触发”也打到 SQL 审计里。  
本次建议新增基于 `AsyncLocalStorage` 的 `SqlAuditContextService`，在 SQL 执行前写入上下文，并由统一包装层读取。

上下文字段至少包括：

- `actorId`
- `actorRoleIds`
- `channel`
- `sessionId`
- `requestId`
- `moduleKey`
- `programName`
- `executionMode`
- `executionSource`
- `matchedAdapter`
- `fallbackReason`

使用方式：

- `AnalysisService` 创建问数执行前写入分析上下文
- `ManagementReportService` / 查询服务在生成快照前写入经营报表上下文
- `CrmAuthService` 登录兜底修复前写入认证上下文
- `WecomDirectorySyncService` 触发目录同步前写入同步上下文

### 决策 5：完整 SQL 与完整参数通过专门 reveal 接口读取

虽然需求已经确认“完整 SQL + 完整参数只给最高权限管理员可见”，但不建议通过普通详情接口默认下发敏感字段。  
推荐新增单独 reveal 接口，例如：

- `POST /api/v1/audit-events/sql/{sqlAuditId}/reveal`

要求：

- 必须校验 `audit.sql.view_sensitive`
- 必须返回完整 `sqlText`、`paramsJson`、必要错误原文
- 必须额外写一条业务审计事件，例如 `SQL_AUDIT_RAW_VIEWED`

原因：

- 这样可以让“查看敏感 SQL 行为本身也可审计”
- 可以在前端加入二次确认，不把高敏细节默认暴露到常规详情响应
- 后续如果领导要求加审批、加水印或加查看频控，也能在 reveal 接口层收口

### 决策 6：审计中心新增第三个 `SQL 审计` Tab，而不是新建独立页面

前端继续复用现有审计中心页 [AuditEventPage.vue](/D:/code/CRM/frontend/src/pages/audit/AuditEventPage.vue)，在现有：

- `AI 审计`
- `用户行为审计`

基础上新增：

- `SQL 审计`

首版布局建议：

- 顶部摘要卡：总 SQL 数、写 SQL 数、失败数、阻断数、高风险数、平均耗时
- 筛选栏：用户、模块、数据库角色、执行阶段、操作类型、状态、表名、时间范围、请求 ID、会话 ID
- 明细表：时间、用户、模块、阶段、操作类型、表名、状态、耗时、行数 / 影响行数、数据库角色
- 详情抽屉：基础上下文、适配器 / fallback、脱敏 SQL 摘要、参数摘要、错误摘要
- reveal 按钮：仅敏感权限管理员可用

原因：

- 保持治理入口稳定，不新增新的一级导航
- 与现有 AI 审计、用户行为审计形成同一治理心智
- 便于从同一个页面完成“业务事件追溯 -> SQL 明细追溯”

### 决策 7：新增专门的 SQL 审计权限动作

在现有权限模型中新增：

- `audit.sql.view`
- `audit.sql.view_sensitive`

约束：

- `audit.view` 只保证能进入审计中心
- `audit.sql.view` 才允许看到 `SQL 审计` Tab 和 SQL 摘要列表
- `audit.sql.view_sensitive` 才允许 reveal 完整 SQL / 参数

原因：

- 领导关心安全，不能把“看普通审计”与“看完整 SQL 明细”混成一层权限
- 与现有权限中心模型保持一致，前后端都能做真实动作校验

### 决策 8：首版不承诺数据库级全局审计，只审计本系统后端发出的 CRM SQL

这是本次设计里必须写死的边界：

- 覆盖：本系统后端服务访问 CRM 的所有 SQL
- 不覆盖：其它系统、人工脚本、DBA 手工 SQL

原因：

- 当前需求是“领导关心这个系统对 CRM 的破坏力”，焦点是“这套系统自己到底做了什么”
- 若承诺数据库级全局审计，就必须接入数据库代理、中间件或数据库原生审计，不属于本次前后端增量范围
- 用错误范围承诺会让 SQL 审计 Tab 后续陷入“为什么查不到别的系统 SQL”的误解

## Risks / Trade-offs

- [SQL 体量增大，应用库存储压力提升] → 首版以应用库独立记录为主，后续可单独扩展保留期与归档策略；列表接口默认只返回摘要，不返回完整 SQL。
- [上下文透传遗漏导致部分 SQL 没有责任人或 requestId] → 统一通过 `SqlAuditContextService` 收口，并为缺上下文场景定义系统级 `actorId`。
- [改造 `CrmReadonlyService` 内部散落查询可能影响稳定性] → 首版优先保持查询逻辑不变，只包裹统一审计记录；不在本次同时重构业务 SQL 本身。
- [完整 SQL 与参数暴露风险] → 增加 `audit.sql.view_sensitive`、reveal 接口、二次确认和查看行为二次审计。
- [领导误解成数据库级全局审计] → 在 proposal、spec、接口文档和页面说明中明确边界仅限“本系统后端服务发出的 CRM SQL”。

## Migration Plan

1. 在 OpenSpec 中新增 `sql-execution-auditability` 能力，并为审计中心、权限执行和受控分析补充增量 spec。
2. 扩展领域模型与应用库存储，新增 `SqlAuditRecord` 与对应仓储、查询接口模型。
3. 新增 `SqlAuditContextService`，为分析、经营报表、认证修复和目录同步等链路透传上下文。
4. 改造 `CrmReadonlyService`，让 `executeQuery()`、`preflightQuery()` 以及内部散落 `pool.query(...)` 统一走 SQL 审计包装。
5. 改造 `CrmWecomIdentityRepository` 和 `CrmPhoneConfirmationRepairService`，让写库 SQL 统一走写审计包装。
6. 新增 SQL 审计后端接口：摘要、列表、详情、reveal。
7. 前端扩展审计中心，新增 `SQL 审计` Tab、筛选、明细表、详情抽屉和 reveal 确认交互。
8. 补齐权限目录、权限中心文案、接口权限校验和自动化测试。

回滚策略：

- 若 SQL 审计 UI 或查询接口存在问题，可先隐藏 `SQL 审计` Tab，保留底层 SQL 审计记录，不影响现有业务事件审计中心；
- 若统一包装层引发只读查询稳定性问题，可先回退业务调用路径到旧逻辑，同时保留 `SqlAuditRecord` 结构与只读 API，不影响现有功能主链；
- 若 reveal 权限或敏感展示策略存在争议，可保留摘要接口和 Tab，临时关闭 reveal 接口，只允许摘要级检索。

## Open Questions

- 原始 SQL 与完整参数的保留期是固定天数，还是跟应用库存储策略统一配置；若管理层没有额外要求，首版建议先按固定窗口保留。
- `SQL_AUDIT_RAW_VIEWED` 是否需要单独纳入高风险审计列表；若安全部门希望重点追踪敏感信息访问，可在实施时直接设为 `MEDIUM` 或 `HIGH`。
- 是否需要为 `SQL 审计` Tab 提供与现有业务审计事件的双向跳转入口；首版建议至少从 SQL 详情跳回关联 `requestId` / `sessionId`。

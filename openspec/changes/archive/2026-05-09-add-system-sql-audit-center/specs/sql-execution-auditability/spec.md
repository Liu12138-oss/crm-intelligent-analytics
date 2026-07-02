## ADDED Requirements

### Requirement: 系统必须审计本系统后端服务发出的所有 CRM SQL

系统 MUST 为本系统后端服务访问 CRM 数据库时发出的全部 SQL 建立统一可检索审计记录。覆盖范围 MUST 至少包括受控问数只读 SQL、经营报表真实查询 SQL、权限装载与身份映射 SQL、自定义字段与地址补查 SQL、企业微信目录同步写库 SQL、登录兜底修复写库 SQL 以及执行前的 `EXPLAIN` / 预检 SQL。该能力 MUST 明确限定为“本系统后端服务自己发出的 CRM SQL”，不得误表述为数据库级全局 SQL 审计。

#### Scenario: 本系统问数链的只读 SQL 被记录

- **WHEN** Web 或企业微信问数请求最终命中 CRM 只读 SQL 路径
- **THEN** 系统必须为该次 SQL 执行生成可检索 SQL 审计记录
- **THEN** 审计记录必须能关联到对应用户、请求 ID、会话 ID 和执行来源

#### Scenario: 本系统写库 SQL 被记录

- **WHEN** 企业微信目录同步或登录兜底修复触发 CRM 写库 SQL
- **THEN** 系统必须为该次写库生成 SQL 审计记录
- **THEN** 审计记录必须能区分写入表、影响行数和最终执行状态

#### Scenario: 非本系统来源 SQL 不在能力范围内

- **WHEN** 其它系统、人工脚本或 DBA 手工执行 CRM SQL
- **THEN** 当前 SQL 审计能力不要求记录这些 SQL
- **THEN** 页面或文档必须明确说明 SQL 审计范围仅限本系统后端服务发出的 CRM SQL

### Requirement: SQL 审计必须记录统一的执行生命周期阶段

系统 MUST 将 SQL 审计建模为执行生命周期流，而不是只在最终成功时补一条结果记录。生命周期 MUST 至少覆盖 `PREPARED`、`PREFLIGHT`、`EXECUTED`、`FAILED` 和 `BLOCKED` 五类阶段，并允许同一业务请求下的多条 SQL 审计记录通过请求或会话标识建立关联。

#### Scenario: 执行前预检 SQL 被单独记录

- **WHEN** 系统在正式执行只读 SQL 前对其执行 `EXPLAIN` 或等价预检
- **THEN** 系统必须记录一条 `PREFLIGHT` 阶段的 SQL 审计记录
- **THEN** 该记录必须能关联后续正式执行记录，而不是丢失上下文关系

#### Scenario: 到库前被阻断的 SQL 也留下记录

- **WHEN** 候选 SQL 在 AST、白名单、权限范围、时间边界或风险校验阶段被阻断
- **THEN** 系统必须记录一条 `BLOCKED` 阶段的 SQL 审计记录
- **THEN** 审计中必须保留阻断原因与阶段，不得只在普通业务审计中留下笼统失败结果

### Requirement: SQL 审计记录必须保存业务上下文与技术上下文

系统 MUST 在 SQL 审计记录中同时保存业务上下文和技术上下文。记录内容 MUST 至少包含操作者、角色快照、入口通道、请求 ID、会话 ID、模块标识、程序入口、数据库角色、操作类型、命中表集合、SQL 指纹、执行耗时、结果行数或影响行数、执行来源、命中适配器、fallback 原因和错误摘要。若当前 SQL 属于系统任务或后台治理行为，系统 MUST 使用明确的系统行为人标识，而不是留空责任人。

#### Scenario: 分析 SQL 可追溯到执行来源与适配器

- **WHEN** 受控分析请求命中 SQL 路径
- **THEN** SQL 审计记录必须包含 `executionMode`、`executionSource`、`matchedAdapter` 和 `fallbackReason`
- **THEN** 治理用户必须能够从 SQL 审计反查该 SQL 为什么由当前路径触发

#### Scenario: 后台系统任务拥有明确责任人标识

- **WHEN** 目录同步、后台治理或定时任务触发 CRM SQL，但不存在前台真实用户
- **THEN** 系统必须使用明确的系统行为人标识记录 SQL 审计
- **THEN** 审计记录不得因为“没有用户”而缺失责任主体

### Requirement: SQL 审计必须区分摘要视图与敏感明细视图

系统 MUST 将 SQL 审计详情分成摘要级视图与敏感明细视图。摘要级视图 MUST 支持治理用户查看时间、用户、模块、操作类型、状态、表名、SQL 指纹、耗时和脱敏 SQL 摘要；完整 SQL、完整参数和必要错误原文 MUST 仅允许具备更高敏感权限的管理员通过受控 reveal 行为读取。

#### Scenario: 普通治理用户只能看到 SQL 摘要

- **WHEN** 用户只具备 SQL 审计基础查看权限
- **THEN** 系统必须只返回脱敏 SQL 摘要和参数摘要
- **THEN** 系统不得向该用户直接下发完整 SQL 或完整参数

#### Scenario: 最高权限管理员可以 reveal 完整 SQL

- **WHEN** 具备敏感明细权限的管理员在 SQL 审计详情中主动请求查看原始 SQL 和完整参数
- **THEN** 系统必须允许其通过专门 reveal 行为获取完整明细
- **THEN** 该 reveal 行为本身必须再写入一条可检索审计记录

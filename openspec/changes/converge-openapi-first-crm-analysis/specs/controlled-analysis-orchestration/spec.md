## MODIFIED Requirements

### Requirement: 系统必须对每个读取步骤执行 OpenAPI-only 路由

系统 MUST 对正式 CRM 智能分析中的每个读取步骤先评估联软标准 OpenAPI 适配器。只要 OpenAPI 已满足对象、字段、权限语义、聚合形态和稳定性要求，系统 MUST 选择 OpenAPI 适配器执行。若 OpenAPI 无法满足当前分析步骤，系统 MUST 返回业务可读的 OpenAPI 能力缺口，并记录 `preferredSource`、缺口对象、缺口字段和当前权限快照；系统 MUST NOT 在正式主链中自动进入受控 SQL、SQLite 快照、MySQL 分析库、Text-to-SQL 或内部只读接口兜底。

#### Scenario: 读取步骤优先命中官方 API
- **WHEN** 某个读取步骤能够由 CRM 官方 API 满足
- **THEN** 系统必须优先选择官方 API 适配器
- **THEN** 系统不得因为 SQL 更方便就默认绕过该 API

#### Scenario: 读取步骤无法由 OpenAPI 满足时返回缺口
- **WHEN** 官方 API 无法满足当前分析步骤的对象、字段、聚合或稳定性要求
- **THEN** 系统必须返回 OpenAPI 能力缺口
- **THEN** 系统必须记录缺口原因、当前权限快照和建议联软补充的接口或字段
- **THEN** 系统不得自动执行受控 SQL、SQLite 快照、MySQL 分析库或 Text-to-SQL 兜底

### Requirement: 系统必须支持受控 AI 直查执行模式

系统 MUST 在受控分析编排中支持服务端受控的 OpenAPI 直查执行模式。自由问数文本 MUST 先经过统一业务语义理解层，再由服务端结合当前场景、OpenAPI 能力目录、知识层命中情况和风险边界决定进入 OpenAPI 取数、解释复用、补问或阻断路径；固定功能主题入口一旦被统一 AI 理解层明确命中，系统 MUST 继续走固定程序流，不得误降级为自由问数直查。受控直查执行中，模型或程序 MAY 生成 1 到 8 个 OpenAPI 数据需求任务；系统 MUST 在实际执行前完成权限范围注入、资源字段能力校验、结果规模限制、超时限制和审计快照记录。系统 MUST 阻止 `INSERT`、`UPDATE`、`DELETE`、`DROP`、`ALTER`、`TRUNCATE`、schema 探测、未声明写入工具、未声明外部请求，以及任何正式主链中的自由 SQL 执行。

#### Scenario: 自由自然语言问数默认进入 OpenAPI 受控直查主链
- **WHEN** Web 或企业微信用户提交一条不属于固定功能主题入口的自然语言问数
- **THEN** 系统必须优先尝试进入 OpenAPI 受控直查执行模式
- **THEN** 系统不得默认先把该问题压缩成窄枚举结构化计划后再决定是否允许直查

#### Scenario: 固定功能主题入口不得误降级为自由问数直查
- **WHEN** 企业微信或 Web 输入已经被统一 AI 理解层明确识别为跟进、创建、日报、项目查询或其它固定功能主题入口
- **THEN** 系统必须继续进入对应固定程序流
- **THEN** 系统不得因为该输入同时包含查询词或数据词就把它当作自由问数直查执行

#### Scenario: OpenAPI 数据需求任务仍需通过安全栈执行
- **WHEN** 用户提交一个允许通过 OpenAPI 回答的经营分析问题
- **THEN** 系统可以接受模型或程序生成的一个或多个 OpenAPI 读取步骤
- **THEN** 系统必须在执行前完成权限范围注入、资源字段能力校验和行数 / 超时限制
- **THEN** 系统只可将受控结果交给后续 grounded 总结与交付链路

#### Scenario: AI 尝试执行危险语句时被阻断
- **WHEN** 模型生成包含删除、更新、建表、改表或其它未声明危险动作的 SQL 或工具调用
- **THEN** 系统必须立即阻断执行
- **THEN** 系统必须记录阻断原因与对应执行快照

## MODIFIED Requirements

### Requirement: AI 读取意图必须继续命中 API-first 与 OpenAPI-only 边界

即使分析请求已经由统一 AI 理解层识别为需要受控读取，系统 MUST 继续按联软 OpenAPI 优先且正式分析主链 OpenAPI-only 的边界执行。统一 AI 理解层只能决定“需要什么读取意图”，不得绕过 OpenAPI 能力目录、权限裁剪和只读安全边界。若 OpenAPI 无法满足当前正式 CRM 分析读取意图，系统 MUST 返回能力缺口，而不是自动进入受控只读 SQL、SQLite 快照、MySQL 分析库、Text-to-SQL 或内部只读接口。

#### Scenario: AI 理解结果命中可用官方 API
- **WHEN** 统一 AI 理解层输出的读取意图可由 CRM 官方 API 满足
- **THEN** 系统必须优先选择官方 API 适配器执行
- **THEN** 系统不得因为 AI 已经完成理解就跳过 API-first 约束

#### Scenario: AI 理解结果无法由 OpenAPI 满足
- **WHEN** 官方 API 无法满足统一 AI 理解层输出的正式 CRM 分析读取意图
- **THEN** 系统必须返回业务可读的 OpenAPI 能力缺口
- **THEN** 系统必须记录 `preferredSource`、缺口对象、缺口字段、缺口原因和权限快照
- **THEN** 系统不得自动进入受控只读 SQL、SQLite 快照、MySQL 分析库、Text-to-SQL 或内部只读接口兜底

### Requirement: 官方 API 缺失时必须形成受控缺口说明

当 CRM 官方 API 不存在、权限语义不足、返回字段不满足、聚合形态不满足、时效无法满足或稳定性无法支撑业务目标时，系统 MUST 先形成缺口说明。对于正式 CRM 智能分析主链，缺口说明 MUST 直接返回给用户或治理审计，不得自动选择数据库、SQLite 快照或分析库路径继续生成正式结果。后续若确需启用非 OpenAPI 路径，必须另立变更，明确对象范围、表字段白名单、权限继承方式、审计留痕、失败降级与回退方案。

#### Scenario: 官方 API 不覆盖目标能力
- **WHEN** 需求所需的 CRM 对象或动作在官方 API 中不存在，或无法满足经过确认的业务约束
- **THEN** 设计文档必须记录 API 缺口、选用的兜底路径和对应的权限边界与审计方案后，系统才可以进入开发

#### Scenario: 官方 API 不覆盖目标分析形态
- **WHEN** 当前分析步骤需要的对象、字段、聚合形态或返回结构无法由官方 API 满足
- **THEN** 正式 CRM 分析主链必须返回能力缺口
- **THEN** 系统不得自动进入受控只读 SQL、SQLite 快照、MySQL 分析库或 Text-to-SQL 兜底

#### Scenario: 禁止无说明直连数据库
- **WHEN** 实现方案准备直接访问 CRM 数据库或新增内部直连接口
- **THEN** 若未提供官方 API 不可用证明和受控边界说明，该方案必须被视为不合规并停止推进

#### Scenario: 非 OpenAPI 路径只能通过独立变更启用
- **WHEN** 团队后续确需在正式分析中启用受控 SQL、SQLite 快照、MySQL 分析库或内部只读接口
- **THEN** 必须另立规格变更说明 API 缺口、权限继承、字段白名单、审计和回退策略
- **THEN** 不得通过运行时自动兜底绕过本次 OpenAPI-only 主链要求

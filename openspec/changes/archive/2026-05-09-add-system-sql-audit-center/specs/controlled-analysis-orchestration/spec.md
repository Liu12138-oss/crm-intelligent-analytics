## ADDED Requirements

### Requirement: 受控分析命中 SQL 路径时必须生成关联 SQL 审计记录

系统 MUST 在受控分析进入 SQL 路径时，为任务 SQL 与预检 SQL 生成可回放的 SQL 审计记录。SQL 审计记录 MUST 与分析请求、会话、执行模式、执行来源、命中适配器、fallback 原因和统一执行轨迹建立关联；若当前分析步骤未命中 SQL 路径而改走官方 API 或内部只读接口，系统 MAY 不生成 SQL 审计记录，但不得伪造“已执行 SQL”。

#### Scenario: 受控直查 SQL 在分析执行中留下阶段化审计

- **WHEN** 自由问数最终命中 `GUARDED_READONLY_SQL` 路径并生成正式 SQL 与预检 SQL
- **THEN** 系统必须分别为预检与正式执行留下 SQL 审计记录
- **THEN** 审计记录必须能关联到对应 `requestId`、`executionMode` 和 `matchedAdapter`

#### Scenario: SQL 候选在到库前被阻断时留下阻断审计

- **WHEN** AI 生成的候选 SQL 在白名单、AST、时间边界或风险校验阶段被阻断
- **THEN** 系统必须生成 `BLOCKED` 状态的 SQL 审计记录
- **THEN** 治理用户必须能够从 SQL 审计直接看到阻断原因，而不是只能从普通业务审计猜测

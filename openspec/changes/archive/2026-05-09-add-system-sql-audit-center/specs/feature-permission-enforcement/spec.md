## ADDED Requirements

### Requirement: 系统必须对 SQL 审计与敏感明细查看执行独立动作校验

系统 MUST 为 SQL 审计查看与完整 SQL / 参数 reveal 建立独立动作权限。`audit.sql.view` MUST 负责控制 SQL 审计 Tab、SQL 摘要列表和详情摘要视图；`audit.sql.view_sensitive` MUST 负责控制完整 SQL、完整参数和必要错误原文的 reveal 行为。系统 MUST 不得因为用户已经具备 `audit.view` 就自动放开 SQL 审计或敏感明细查看能力。

#### Scenario: 仅具备 audit.view 的用户不能查看 SQL 审计

- **WHEN** 某个用户具备 `audit.view`，但未被授予 `audit.sql.view`
- **THEN** 该用户可以进入普通审计中心
- **THEN** 系统必须拒绝其访问 SQL 审计接口或查看 SQL 审计 Tab

#### Scenario: 仅具备 audit.sql.view 的用户不能 reveal 完整 SQL

- **WHEN** 某个用户具备 `audit.sql.view`，但未被授予 `audit.sql.view_sensitive`
- **THEN** 系统必须允许其查看 SQL 摘要列表和详情摘要
- **THEN** 系统必须拒绝其 reveal 完整 SQL 或完整参数

#### Scenario: 具备敏感权限的管理员可以 reveal 完整 SQL

- **WHEN** 最高权限管理员同时具备 `audit.sql.view` 和 `audit.sql.view_sensitive`
- **THEN** 系统必须允许其通过受控 reveal 行为查看完整 SQL 与完整参数
- **THEN** reveal 行为本身必须留下新的审计记录

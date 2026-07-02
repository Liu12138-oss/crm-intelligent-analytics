## ADDED Requirements

### Requirement: 系统必须提供受控查询 SQL 编写权限

系统 MUST 为具备 SQL 能力但不应拥有完整模板治理能力的用户提供独立的最小动作权限。该权限建议命名为 `template.sql.write` 或等价中文权限“查询模板 SQL 编写”。该权限 MUST 只允许用户进入受控 SQL 模板新增、校验、预览和保存流程，不得自动授予完整模板治理、权限治理、审计治理或敏感 SQL reveal 能力。

#### Scenario: 具备 SQL 编写权限的用户新增查询模板
- **WHEN** 用户具备 `template.sql.write` 但不具备 `template.manage`
- **THEN** 系统必须允许其进入受控 SQL 模板新增流程
- **THEN** 系统必须允许其提交只读 SQL 进行校验、预览和保存
- **THEN** 系统不得允许其管理其它用户模板、修改全局治理策略或查看审计敏感明细

#### Scenario: 缺少 SQL 编写权限的用户被阻断
- **WHEN** 用户不具备 `template.sql.write` 且尝试直接调用 SQL 模板新增或保存接口
- **THEN** 系统必须拒绝该请求
- **THEN** 系统必须返回中文权限不足提示
- **THEN** 系统必须记录权限拒绝审计

### Requirement: SQL 编写权限不得绕过模板安全治理

系统 MUST 将 `template.sql.write` 限定为功能入口资格。具备该权限的用户保存、预览或执行模板时，仍 MUST 通过只读 SQL、字段白名单、AST 安全、危险语句拦截、范围治理、结果规模限制和审计留痕。系统 MUST NOT 因用户具备 SQL 编写权限而扩大数据范围或跳过执行期权限校验。

#### Scenario: SQL 用户提交危险语句
- **WHEN** 具备 `template.sql.write` 的用户提交包含更新、删除、建表、改表或其它危险动作的 SQL
- **THEN** 系统必须阻断保存和预览
- **THEN** 系统必须提示该模板 SQL 未通过安全校验

#### Scenario: SQL 用户预览模板仍按当前权限收口
- **WHEN** 具备 `template.sql.write` 的用户预览一条合法只读模板
- **THEN** 系统必须按该用户当前实时权限范围执行预览
- **THEN** 预览结果不得返回当前用户范围外的数据

### Requirement: 超级管理员必须自动获得新增 SQL 编写权限

系统 MUST 将 `template.sql.write` 或等价权限纳入统一权限目录。命中应用超级管理员授权的用户 MUST 自动获得该权限，但仍不得绕过 SQL 安全、范围治理和审计留痕。

#### Scenario: 应用超级管理员预览 SQL 编写权限
- **WHEN** 管理员在权限中心预览应用超级管理员用户
- **THEN** 预览结果必须包含查询模板 SQL 编写能力
- **THEN** 真实接口调用必须与预览结果保持一致

#### Scenario: 超级管理员提交 SQL 仍需校验
- **WHEN** 应用超级管理员提交查询模板 SQL
- **THEN** 系统必须继续执行只读、白名单、AST 和范围治理校验
- **THEN** 系统不得因为超级管理员身份跳过固定安全前置检查

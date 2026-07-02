## ADDED Requirements

### Requirement: SQL 审计必须使用应用库作为长期主存储

系统 MUST 将本系统后端发出的 CRM SQL 审计记录保存到独立 MySQL 应用库中的 SQL 审计表或等价表级存储。`app-storage.json` MAY 在迁移观察期内作为兼容读取和回滚快照，但不得继续作为 SQL 审计的长期主写存储。SQL 审计应用库记录 MUST 保留现有摘要视图、敏感 reveal、权限校验、业务上下文和技术上下文语义。

#### Scenario: 新 SQL 审计写入应用库

- **WHEN** 系统在双写或 MySQL 主写阶段生成新的 SQL 审计记录
- **THEN** 系统必须将该记录写入独立 MySQL 应用库
- **THEN** 记录必须保留用户、角色快照、请求 ID、会话 ID、模块、数据库角色、操作类型、表名、SQL 指纹、SQL 摘要、参数摘要、状态和执行耗时

#### Scenario: JSON 运行态不再作为长期主写

- **WHEN** 系统完成 SQL 审计应用库切换并进入 MySQL 主写阶段
- **THEN** 新增 SQL 审计不得继续依赖 `app-storage.json` 作为主写存储
- **THEN** `app-storage.json` 中的历史 SQL 审计只允许作为迁移来源、兼容读取或回滚快照使用

### Requirement: SQL 审计应用库必须支持分页检索和详情读取

系统 MUST 基于应用库索引支持 SQL 审计分页列表、条件筛选、详情读取和 reveal 权限校验。SQL 审计列表 MUST 支持按时间、用户、模块、数据库角色、阶段、操作类型、状态、表名、请求 ID 和会话 ID 过滤，不得依赖全量读取 `app-storage.json` 后在内存中过滤。

#### Scenario: 按请求 ID 检索 SQL 审计

- **WHEN** 治理用户在 SQL 审计页按请求 ID 检索
- **THEN** 系统必须通过应用库索引查询匹配记录
- **THEN** 返回结果必须与旧 JSON 运行态中同一请求 ID 的可见 SQL 审计记录语义一致

#### Scenario: 查看 SQL 审计详情

- **WHEN** 具备 SQL 审计查看权限的用户打开某条 SQL 审计详情
- **THEN** 系统必须从应用库读取该记录并返回脱敏摘要视图
- **THEN** 系统不得向未授权用户返回完整 SQL 或完整参数

#### Scenario: reveal 完整 SQL 明细

- **WHEN** 具备敏感明细权限的管理员 reveal 完整 SQL 或完整参数
- **THEN** 系统必须继续执行 reveal 权限校验
- **THEN** reveal 行为本身必须写入可检索审计记录

### Requirement: SQL 审计迁移必须支持历史导入和对账

系统 MUST 支持将 `app-storage.json` 和已存在 SQL 审计归档中的历史 SQL 审计记录导入应用库。导入 MUST 支持幂等、断点续跑、字段完整性校验、重复记录跳过、冲突报告和导入前后数量对账。`sql-audit-archive/` 中的原归档文件也 MUST 作为数据库文件对象保存，旧归档目录不得作为目标态长期在线来源。

#### Scenario: 导入运行态 SQL 审计

- **WHEN** 运维导入 `app-storage.json` 中的 `sqlAuditRecords`
- **THEN** 系统必须按 SQL 审计 ID 幂等写入应用库
- **THEN** 重复导入不得生成重复审计记录

#### Scenario: 导入历史归档 SQL 审计

- **WHEN** 运维选择导入 `sql-audit-archive` 下的历史 SQL 审计归档
- **THEN** 系统必须校验归档文件格式和必要字段
- **THEN** 系统必须输出成功、跳过、冲突和失败数量

#### Scenario: SQL 审计归档文件入库

- **WHEN** 历史 SQL 审计归档文件完成导入
- **THEN** 系统必须将原归档文件的二进制内容、文件名、字节数、MIME 类型、SHA-256 和来源路径摘要保存到数据库文件对象表
- **THEN** 治理下载或复核归档时必须从数据库文件对象读取并校验哈希
- **THEN** 旧 `sql-audit-archive/` 目录只允许作为迁移来源、观察期 fallback 或只读回滚快照

#### Scenario: SQL 审计导入字段缺失

- **WHEN** 历史 SQL 审计记录缺少 ID、时间、阶段、状态、行为人、模块、数据库角色或 SQL 摘要等必要字段
- **THEN** 导入脚本必须拒绝该条记录或标记为失败
- **THEN** 失败摘要必须进入迁移报告，且不得中断其它合法记录导入

### Requirement: SQL 审计切读必须保留旧路径兼容回退

系统 MUST 在 SQL 审计读取切换期间支持应用库主读和旧 JSON / 归档文件 fallback。fallback 发生时 MUST 记录集合名、文件对象 ID、查询条件、触发原因和差异摘要。连续对账通过并关闭 fallback 后，SQL 审计读取、reveal 和归档下载 MUST 以应用库为唯一在线来源。

#### Scenario: 应用库 SQL 审计读失败

- **WHEN** SQL 审计应用库查询失败且 fallback 已启用
- **THEN** 系统必须回退读取旧 JSON 运行态或历史归档文件兼容来源
- **THEN** 系统必须记录 fallback 事件，便于后续补数据或修复查询

#### Scenario: SQL 审计 fallback 关闭

- **WHEN** SQL 审计应用库对账连续通过且 fallback 已关闭
- **THEN** SQL 审计列表、详情、reveal 和归档下载必须以应用库为唯一在线来源
- **THEN** 旧 JSON 运行态和 `sql-audit-archive/` 目录不得继续掩盖应用库数据缺失

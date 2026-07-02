## 1. OpenSpec 与领域模型

- [x] 1.1 新增 `sql-execution-auditability` 能力 spec，并为审计中心、权限执行、受控分析与 API-first 兜底路径补增量要求
- [x] 1.2 在领域类型与应用存储模型中新增 `SqlAuditRecord`、摘要视图、详情视图和 reveal 返回模型
- [x] 1.3 为 SQL 审计定义统一枚举：`stage`、`status`、`databaseRole`、`operationType`、`moduleKey`

## 2. 后端 SQL 审计采集底座

- [x] 2.1 新增 `SqlAuditRepository`、`SqlAuditService` 和必要的查询 / 指纹 / 参数序列化辅助能力
- [x] 2.2 新增 `SqlAuditContextService`，统一透传 `actorId`、`requestId`、`moduleKey`、`executionSource` 等上下文
- [x] 2.3 改造 `CrmReadonlyService.executeQuery()`，让真实只读 SQL 统一走审计包装
- [x] 2.4 改造 `CrmReadonlyService.preflightQuery()`，让 `EXPLAIN` / 预检 SQL 统一走审计包装
- [x] 2.5 改造 `CrmReadonlyService` 内部身份装载、角色装载、部门装载、码表与合同补查等散落 `pool.query(...)`，确保不绕过 SQL 审计
- [x] 2.6 改造 `CrmWecomIdentityRepository` 的 `wx_*` 查询与写库路径，统一接入 SQL 审计
- [x] 2.7 改造 `CrmPhoneConfirmationRepairService` 的 `users` 查询与更新路径，统一接入 SQL 审计

## 3. 后端接口与权限控制

- [x] 3.1 新增 `SqlAuditController`，提供摘要、列表、详情和 reveal 接口
- [x] 3.2 在权限目录中新增 `audit.sql.view` 与 `audit.sql.view_sensitive` 两个动作，并接入后端真实校验
- [x] 3.3 为 reveal 行为新增二次业务审计事件，例如 `SQL_AUDIT_RAW_VIEWED`
- [x] 3.4 为无敏感权限场景返回统一的掩码结构和 `canRevealSensitive` 标志，避免前端自行猜测

## 4. 前端审计中心改造

- [x] 4.1 扩展 `AuditEventPage.vue`，新增第三个 `SQL 审计` Tab，并按权限控制可见性
- [x] 4.2 新增 SQL 审计摘要卡、筛选栏、分页表格和详情抽屉
- [x] 4.3 为完整 SQL / 参数查看增加显式 reveal 按钮、二次确认提示和失败反馈
- [x] 4.4 扩展前端类型与 `analysis.service.ts`，补齐 SQL 审计接口模型与调用方法
- [x] 4.5 更新 `business-code-labels.ts`、权限中心文案和状态标签映射，补齐 SQL 审计相关中文标签

## 5. 自动化测试与文档

- [x] 5.1 新增后端 contract / integration 测试，覆盖 SQL 审计摘要、列表、详情、reveal 权限和关联审计
- [x] 5.2 新增分析链、经营报表链、目录同步链和登录兜底修复链的 SQL 审计覆盖测试
- [x] 5.3 新增前端单元测试，覆盖 SQL 审计 Tab 可见性、筛选、详情抽屉和 reveal 权限分支
- [x] 5.4 更新 `specs/001-crm-intelligent-analytics/quickstart.md`、治理 / 安全文档和 DBA / 领导沟通说明，明确 SQL 审计范围与边界

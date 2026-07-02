## Why

领导当前最关注的是 CRM 智能分析系统对 CRM 生产库的实际破坏力与可追溯性。虽然现有系统已经对问数、导出、权限拒绝、企业微信同步和部分执行轨迹建立了业务级审计，但仍缺少“本系统后端到底向 CRM 发出了哪些 SQL、由谁触发、查了哪些表、有没有写、是否先经过安全预检、失败原因是什么”的统一审计视图。

现状问题主要有三类：

- SQL 审计颗粒度不足：审计中心目前以业务事件为主，无法直接回放本系统每一次 CRM SQL 的执行明细。
- SQL 采集入口分散：问数主链大量查询经过 `CrmReadonlyService`，但身份装载、治理补查、目录同步和登录兜底修复仍存在散落的 `pool.query(...)`，难以统一审计。
- 敏感信息治理不足：如果未来要把完整 SQL 和参数展示给管理员，必须同时定义专门权限、脱敏边界和“查看原始 SQL 行为本身也留痕”的治理约束。

为了回应“系统安全、可控、可追责”的治理要求，需要把当前审计中心从“业务事件检索”扩展为“业务事件 + SQL 执行追踪”双层视图，并把本系统后端访问 CRM 的所有 SQL 统一收口到可审计执行包装层。

## What Changes

- 在审计中心新增 `SQL 审计` Tab，支持查看本系统后端服务访问 CRM 的全部 SQL 摘要、筛选结果和详情抽屉。
- 新增独立 `SqlAuditRecord` 数据模型与仓储，不再把 SQL 详情继续塞入现有 `AuditEventRecord` 的混合快照字段。
- 为 CRM SQL 执行新增统一审计包装层，覆盖：
  - 受控问数只读 SQL
  - 经营报表真实查询 SQL
  - 权限装载、身份映射、自定义字段与地址补查 SQL
  - 企业微信目录同步 `wx_*` 写库 SQL
  - 登录兜底修复 `users.confirmed_phone_at` 写库 SQL
  - 执行前 `EXPLAIN` / 预检 SQL
- 在审计模型中记录 SQL 生命周期阶段，包括 `PREPARED`、`PREFLIGHT`、`EXECUTED`、`FAILED`、`BLOCKED`，使治理用户能够区分“准备执行”“执行成功”“执行失败”“执行前被阻断”。
- 新增 `audit.sql.view` 与 `audit.sql.view_sensitive` 两个权限动作，分别控制 SQL 审计 Tab 可见性，以及完整 SQL / 完整参数查看资格。
- 为“查看原始 SQL / 参数”单独增加受控 reveal 接口与二次审计事件，确保敏感明细读取本身也可追溯。

## Capabilities

### New Capabilities

- `sql-execution-auditability`: 定义本系统后端服务访问 CRM 数据库时的统一 SQL 审计范围、记录模型、权限边界和检索能力。

### Modified Capabilities

- `access-governance-center`: 扩展审计中心，新增 SQL 审计 Tab、摘要卡、筛选栏、明细表和详情抽屉。
- `feature-permission-enforcement`: 新增 SQL 审计查看与敏感明细查看权限动作，并要求前后端真实执行校验。
- `controlled-analysis-orchestration`: 在受控分析命中 SQL 路径时，为任务 SQL 与预检 SQL 建立可回放的关联 SQL 审计记录。
- `crm-api-first-integration`: 明确任何进入受控 SQL / 数据库兜底路径的读取或写入能力都必须生成 SQL 审计记录，不能只保留业务事件审计。

## Impact

- 影响后端 `backend/src/modules/audit/*`、`backend/src/database/crm-readonly/*`、`backend/src/modules/wecom/*`、`backend/src/modules/auth/*`，需要建立统一 SQL 审计服务、上下文透传和执行包装层。
- 影响现有审计中心前端 `frontend/src/pages/audit/AuditEventPage.vue`、对应类型与服务层，需要扩展第三个 Tab 与 SQL 详情交互。
- 影响权限中心目录、权限矩阵和文案映射，需要新增 `audit.sql.view`、`audit.sql.view_sensitive` 并补齐标签与拒绝校验。
- 影响 OpenAPI 契约、集成测试和前端页面测试，需要为 SQL 审计摘要、列表、详情、敏感 reveal 权限和关联审计补回归覆盖。
- 影响治理与安全文档，需要补充“SQL 审计覆盖范围仅限本系统后端服务发出的 CRM SQL，不等同于数据库级全局审计”的边界说明。

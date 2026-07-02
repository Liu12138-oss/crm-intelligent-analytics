## Context

线上当前以 systemd 运行后端进程，`/srv/crm-intelligent-analytics/current/.runtime` 指向 `/srv/crm-intelligent-analytics/shared/.runtime`。本系统自有状态主要保存在 `/srv/crm-intelligent-analytics/shared/.runtime/app-storage.json`，其中包含治理策略、AI Profile、查询模板、最近查询、分析请求与结果、业务审计、SQL 审计、会话、企业微信上下文、目录同步快照、日报、主动通知和合同审核元数据。合同审核原始文件、审核报告、结构化结果、AI 调试上下文、SQL 审计归档和运行态锁仍保存在 `.runtime/` 子目录。这些文件都属于本系统持久化数据，不能继续作为长期权威存储。

CRM 原始业务数据已经由 `CRM_READONLY_DB_*` / `CRM_WRITEBACK_DB_*` 指向真实 CRM MySQL，例如客户、商机、合同、组织、用户、角色、企业微信 `wx_*` 映射等。当前问题不是 CRM 业务库缺失，而是本系统自有应用状态和文件产物仍停留在 JSON / 文件运行态。继续使用 `.runtime/` 文件承接业务数据会放大以下风险：

- 写入是整包序列化和替换文件，缺少数据库事务、行锁、唯一约束和增量写能力。
- 审计、最近查询、会话、分析结果等高频集合共用一个文件，增长后会拖慢读写和巡检。
- 多进程、多实例、滚动发布或后台任务并发写入时，存在覆盖写和丢写风险。
- 审计检索、最近查询分页、合同审核任务列表等需要索引的场景只能全量加载后过滤。
- 合同审核文件、AI 调试上下文、SQL 审计归档和运行态锁分散在目录中，容易遗漏迁移、备份和权限收口。
- 备份、恢复、脱敏、分集合保留、文件下载授权和权限隔离都被文件系统耦合。

本变更需要把本系统全部自有持久化数据切到独立 MySQL 应用库，同时保证线上数据不丢、现有功能不变、任意阶段可回滚。文件系统在目标态只允许保存短时临时文件、部署包、操作系统日志和人工回滚快照，不允许作为业务数据权威来源。

## Goals / Non-Goals

**Goals:**

- 新增独立 MySQL 应用库，承接本系统全部自有持久化数据，停止 `app-storage.json` 和 `.runtime/` 业务文件作为长期主写或权威读取存储。
- 保留 CRM 原始业务数据的现有来源，不把应用状态写入 CRM 业务库。
- 提供 `json`、`dual`、`mysql` 三阶段存储模式，支持灰度、对账和回滚。
- 先部署双写能力，再导入历史 JSON，避免历史导入期间新增写入丢失。
- 对高增长、高检索价值数据使用表级存储和索引；对结构复杂且低频变化的数据使用 `payload_json` 保留完整对象；对合同正文、审核报告、批注文件、结构化产物、AI 调试上下文等文件使用数据库文件对象表保存二进制内容、内容哈希和访问元数据。
- SQL 审计改用应用库作为长期主存储，解除 5000 条运行态上限对审计检索的长期限制。
- 保证登录、企业微信机器人、Web 问数、常用查询、最近查询、导出、审计中心、合同审核、合同产物下载、日报和通知链路用户可见行为不变。
- 提供生产备份、导入、对账、切读、切主写、回滚和巡检操作手册。

**Non-Goals:**

- 不迁移 CRM 原始客户、商机、合同、组织、用户、角色等业务表。
- 不重构登录认证、企业微信扫码、权限模型或 CRM API-first 访问原则。
- 不迁移操作系统日志、Nginx 日志、systemd journal、部署包和可重新生成的前端静态资源；这些不作为本系统业务数据权威来源。
- 不在本变更内改造前端视觉、页面信息架构或新增用户可见功能。
- 不要求第一阶段把所有复杂 JSON 字段完全拆成第三范式表；优先保证数据安全、可检索和可回滚。

## Decisions

### 1. 独立应用库，不复用 CRM 业务库

新增 `APP_STORAGE_DB_*` 指向独立 MySQL schema，例如 `crm_ai_app_storage`。应用状态表、数据库文件对象表、运行态锁表、迁移批次表、对账报告表和审计表都放在该 schema 下。

**理由：**

- 应用状态与 CRM 原始业务对象职责不同，混写 CRM 业务库会扩大权限和备份边界。
- 独立 schema 便于配置最小权限账号，只允许本系统读写应用状态表。
- 后续可单独备份、归档、扩容和清理，包括合同文件对象和审计归档，不影响 CRM 主系统。

**替代方案：** 直接写入 CRM 业务库。该方案部署成本低，但违反 API-first 与职责隔离原则，且会把治理、审计、AI 配置和会话数据混入 CRM 原库，长期不可取。

### 2. 先保留 `AppStorageService` 外观，再逐步收敛仓储

第一阶段不要求所有业务模块立即摆脱 `appStorage.state.xxx` 访问方式，而是在数据库层引入 `AppStorageBackend` 抽象：

```text
AppStorageService
  ├─ JsonFileAppStorageBackend
  ├─ MysqlAppStorageBackend
  └─ DualWriteAppStorageBackend
```

`AppStorageService` 对外仍提供 `state` 和 `persist()` 的兼容接口，降低一次性改动面。高频仓储再逐个改为表级 Repository，最终减少全量 state 依赖。

**理由：**

- 当前依赖 `AppStorageService` 的仓储很多，直接全量重写会带来高回归风险。
- 兼容外观可以先实现双写、导入和对账，把线上数据增长风险先压住。
- 表级仓储可按优先级渐进切换，避免大爆炸式重构。

**替代方案：** 一次性把全部仓储改成 MySQL 原生 Repository。该方案最终形态更干净，但需要同时触碰分析、治理、审计、企业微信、日报、合同审核、通知、AI 配置等多个模块，风险过高。

### 3. 表级存储采用“关键字段 + payload_json + payload_hash + 数据库文件对象”

应用库表分为三类：

1. **高频流水表**：`sql_audit_records`、`audit_events`、`analysis_requests`、`analysis_results`、`recent_queries`、`auth_sessions`、`query_sessions`、`wecom_message_receipts`、`wecom_delivery_records`。这些表必须具备常用查询索引。
2. **治理配置表**：`access_policies`、`analysis_scope_policies`、`application_super_admin_policies`、`role_permissions`、`query_templates`、`ai_model_profiles`、`ai_model_activation`、`ai_context_policies`。这些表必须支持按主键或固定策略 ID 幂等更新。
3. **复杂扩展表**：合同审核、日报、主动通知、企业微信目录同步、语义资产等对象保留关键检索字段，同时保存完整 `payload_json` 和 `payload_hash`。
4. **文件对象表**：合同原始文件、批注版合同、审核报告、结构化结果、AI 调试上下文、导出文件、SQL 审计归档文件等持久化文件保存到数据库文件对象表，至少包含对象 ID、业务类型、关联业务 ID、文件名、MIME 类型、字节数、内容 SHA-256、加密状态、创建人、创建时间、二进制内容和下载权限摘要。

所有从 JSON 导入的记录都必须保存 `payload_json` 或可重建完整对象的字段集合，所有从文件目录导入的文件都必须保存二进制内容、内容哈希和元数据，避免首轮迁移因字段拆分或文件遗漏导致功能缺失。

**理由：**

- 关键字段用于列表、分页、权限过滤、时间范围检索和对账。
- `payload_json` 保证原对象完整，便于兼容现有接口和后续字段演进。
- `payload_hash` 支持导入幂等、冲突检测和双写对账。
- 数据库文件对象让合同审核、导出和审计归档具备统一备份、事务引用、下载授权和完整性校验。

**替代方案：** 合同和导出文件继续留在文件系统或对象存储。该方案能降低数据库容量压力，但不符合本次“全部自有数据进数据库”的目标，会继续留下备份、权限和遗漏迁移风险，因此不采用。

### 4. 切换顺序采用“先双写，再历史导入，再切读”

平顺切换顺序：

```text
1. 发布支持 MySQL 和双写的代码，但默认 APP_STORAGE_DRIVER=json
2. 建立独立应用库和迁移表
3. 开启 APP_STORAGE_DRIVER=dual，读仍以 JSON 为准，新增写入同时落 JSON 与 MySQL
4. 从当前 app-storage.json、contract-review、sql-audit-archive 和其它 .runtime 持久化文件执行历史导入，使用幂等 upsert 和文件哈希，不覆盖双写期间更新过的新记录
5. 执行对账，修复差异
6. 将低风险读接口切到 MySQL，保留 JSON / 文件 fallback
7. 将全部应用状态和文件读取切到 MySQL，保留 JSON / 文件 fallback
8. 将主写切到 MySQL，JSON 和文件目录改为只读回滚快照
9. 观察期结束后关闭 JSON / 文件 fallback 和旧文件主链路
```

**理由：**

- 如果先导入再部署双写，导入窗口内的线上新增数据可能只存在 JSON。
- 先双写可以捕获导入期间的新写入，历史导入遇到已存在记录时按 `updated_at` 与 `payload_hash` 判定跳过、合并或冲突。
- 读切换晚于写捕获，降低数据缺口暴露给用户的概率。

**替代方案：** 停机导入后直接切 MySQL。该方案实现简单，但停机窗口、数据核对和失败回滚压力集中，不适合当前线上状态。

#### 受保护的一键编排命令

为降低生产操作遗漏风险，需要提供两个受保护的一键编排命令：

```text
storage:switch-to-mysql
storage:rollback-to-json
```

`storage:switch-to-mysql` 负责按既定阶段推进到数据库目标态，但不得绕过校验。命令内部必须依次完成应用库健康检查、schema 防误写检查、历史文件备份校验、双写开启、历史 JSON 导入、历史文件对象导入、运行态锁导入、双写失败重放、集合和文件对象对账、低风险切读、全量切读、MySQL 主写切换、只读快照保护和发布记录输出。任一前置检查、导入、重放或对账失败时必须中断，并输出脱敏失败摘要和下一步处理建议。

`storage:rollback-to-json` 负责按当前阶段回退到旧兼容路径，但不得假设旧 JSON / 文件目录天然完整。命令内部必须识别当前阶段、检测 MySQL-only 新记录和 MySQL-only 文件对象、生成差异清单，必要时执行 JSON 快照补写或文件对象导出；只有差异处理完成或形成明确人工修复清单后，才允许恢复 JSON / 文件兼容读写。回滚命令不得删除 MySQL 数据、迁移批次、对账报告或审计记录。

两个命令都必须支持 `--dry-run`、`--from-stage`、`--to-stage`、`--require-confirmation`、`--report-path` 等参数；生产执行默认要求显式确认目标环境、目标 schema、备份批次和操作者。命令输出只能包含环境变量名、schema 名、记录数量、文件数量、哈希、批次号、耗时和脱敏错误摘要，不得输出密码、Token、Secret、合同正文或客户敏感字段。

**理由：**

- 迁移涉及 JSON、历史文件、运行态锁、文件对象和多阶段配置，人工逐条执行容易漏步骤。
- 一键入口可以降低运维复杂度，但必须通过内置检查保证不是无校验强切。
- 回滚阶段最容易丢失 MySQL 主写后新增的数据，必须把差异识别和补写作为回退前置条件。

### 5. 双写失败按数据等级处理

双写期间 JSON 仍是主读主写，MySQL 写入失败不得直接破坏现有功能，但必须记录差异和告警。切 MySQL 主写后，MySQL 写入失败必须按业务重要性返回错误或进入降级。

数据等级：

- **强一致数据**：治理策略、角色权限、应用超级管理员授权、AI Profile 激活、查询模板状态、合同审核任务状态、合同文件对象、导出文件对象、导出记录、高风险审计。MySQL 主写阶段写失败必须阻断或返回明确失败。
- **可补偿流水**：普通 SQL 审计、普通业务审计、消息投递记录、最近查询点击统计、时间槽统计、可重新生成的报表缓存。双写阶段 MySQL 失败可入差异队列，后续重放。
- **缓存/镜像数据**：企业微信同步目录快照、CRM 企业微信映射缓存、能力短缓存。失败可重新同步或从 CRM 权威来源恢复，但必须记录同步状态。

**理由：**

- 所有数据同等强一致会放大接口失败面。
- 所有数据都异步补偿会削弱治理证据可靠性。
- 分级处理能兼顾现有功能稳定和审计可靠性。

### 6. 合同审核、导出和归档文件全部进入数据库文件对象表

合同审核的 `source-*`、`review-report.md`、`review-result.json`、`ai-debug-context.json`、批注版合同、导出文件、SQL 审计归档文件等全部保存到 `app_binary_objects` 或按业务拆分的数据库文件对象表。原 `CONTRACT_REVIEW_STORAGE_DIR` 只作为迁移来源和短时 staging 目录；迁移完成后，业务读取和下载必须从数据库文件对象读取。文件对象表必须保存内容哈希、字节数、MIME 类型、业务归属、下载权限摘要和加密状态。

**理由：**

- 用户要求本次彻底迁移所有本系统数据，继续保留文件系统主存储会造成数据盘点和备份遗漏。
- 合同审核文件和 AI 调试上下文与任务、问题、审计强关联，放入同一应用库可以保证引用一致性和回滚边界。
- 通过内容哈希和下载权限摘要，可以验证文件完整性并保持现有下载权限行为。

**替代方案：** 使用对象存储。对象存储适合大文件，但会引入新的基础设施和权限模型；本次明确要求全部进数据库，因此不作为目标态。后续若文件规模超过 MySQL 承载边界，需要另立 OpenSpec 变更评审对象存储方案。

### 7. 回滚必须只靠配置切换，不依赖代码回退

核心开关：

```text
APP_STORAGE_DRIVER=json|dual|mysql
APP_STORAGE_READ_PRIMARY=json|mysql
APP_STORAGE_MYSQL_FALLBACK_TO_JSON=true|false
APP_STORAGE_DUAL_WRITE_REQUIRED=false|true
APP_STORAGE_MIGRATION_BATCH_SIZE=500
APP_STORAGE_MIGRATION_VERIFY_ENABLED=true
APP_STORAGE_JSON_SNAPSHOT_READONLY=true|false
APP_STORAGE_FILE_STAGING_DIR=/path/to/temp
APP_STORAGE_FILE_OBJECT_MAX_MB=配置值
```

任意阶段发现 MySQL 读写异常，优先通过配置回退到 JSON 读；代码回退只作为最后手段。

**理由：**

- 线上数据迁移期间代码回退可能遇到新旧 schema 不一致。
- 配置回退可缩短恢复时间，并保留对账现场。

## Data Model

首轮应用库表结构遵循以下原则：

- 所有业务表必须有 `id` 或固定主键、`created_at`、`updated_at`、`payload_json`、`payload_hash`。
- 高频检索字段必须单独成列并加索引，例如 `actor_id`、`request_id`、`session_id`、`created_at`、`status`、`module_key`、`requester_id`、`template_id`。
- 复杂对象先以 `payload_json` 作为完整事实来源，拆出的列只服务查询、唯一约束和排序。
- 所有持久化文件必须进入数据库文件对象表，至少保存 `id`、`object_type`、`owner_resource_type`、`owner_resource_id`、`file_name`、`mime_type`、`byte_size`、`sha256`、`storage_status`、`encryption_status`、`content_blob`、`payload_json`、`created_by`、`created_at`。
- 运行态锁、后台任务水位和一次性迁移水位必须进入数据库锁表或水位表，不得依赖 `.runtime/*.lock` 作为恢复所需状态。
- 迁移批次表记录来源文件路径、来源文件大小、来源文件哈希、集合名、批次号、起止位置、成功数、跳过数、冲突数、失败数和操作者。

建议新增核心表：

```text
app_storage_migration_batches
app_storage_migration_items
app_storage_reconcile_reports
app_storage_dual_write_failures
app_runtime_locks
app_binary_objects
app_binary_object_access_audits

sql_audit_records
audit_events
analysis_requests
analysis_results
recent_queries
query_sessions
auth_sessions
export_requests

query_templates
query_usage_profiles
query_time_slot_stats
access_policies
analysis_scope_policies
application_super_admin_policies
role_permissions
data_scope_grants
wecom_pilot_policies

ai_model_profiles
ai_model_activation
ai_context_policies
analysis_semantic_knowledge_assets
analysis_semantic_knowledge_publications

wecom_message_receipts
wecom_delivery_records
wecom_conversation_contexts
pending_follow_up_writebacks
wecom_synced_departments
wecom_synced_users
wecom_user_dept_changes
wecom_sync_checkpoints
wecom_sync_runs
crm_wx_users
crm_wx_user_maps

contract_review_rule_sets
contract_review_tasks
contract_review_issues
contract_review_artifacts
contract_review_file_objects

proactive_notification_tasks
daily_reports
daily_report_summary_batches
daily_report_assistance_escalations
daily_report_department_policies
daily_report_recipient_overrides
daily_report_sales_group_configs
```

## Migration Plan

### 阶段 0：准备与备份

1. 确认生产 `APP_STORAGE_DB_*` 独立应用库账号只具备目标 schema 权限，不具备 CRM 业务库写权限。
2. 完整备份 `/srv/crm-intelligent-analytics/shared/.runtime/app-storage.json`、`contract-review/`、`sql-audit-archive/`、运行态锁文件和其它 `.runtime/` 持久化文件。
3. 计算备份文件大小、mtime 和 SHA-256，记录到发布记录，不记录敏感内容。
4. 在测试环境使用生产结构相同但脱敏的 JSON 验证导入和对账。

### 阶段 1：发布兼容代码

1. 发布应用库连接、迁移执行器、MySQL backend、dual backend、对账脚本和受保护的一键编排命令。
2. 默认保持 `APP_STORAGE_DRIVER=json`，确认现有功能完全不变。
3. 执行健康检查，确认 MySQL 应用库可连接但未接管读写。
4. 执行 `storage:switch-to-mysql --dry-run`，确认备份、导入、对账和切换计划可生成但不改变线上状态。

### 阶段 2：开启双写捕获新增数据

1. 设置 `APP_STORAGE_DRIVER=dual`、`APP_STORAGE_READ_PRIMARY=json`、`APP_STORAGE_MYSQL_FALLBACK_TO_JSON=true`。
2. 线上新增写入同时写 JSON 与 MySQL。
3. 双写失败进入 `app_storage_dual_write_failures` 或等价告警，不影响 JSON 主链路。
4. 验证登录、问数、审计、合同审核、企业微信会话、治理保存等主链路。

> 生产环境可由 `storage:switch-to-mysql --to-stage=dual` 编排完成本阶段，但命令必须在健康检查和备份校验通过后才允许改配置。

### 阶段 3：导入历史 JSON

1. 以当前 `app-storage.json` 为来源，按集合批量导入。
2. 每条记录按主键和 `payload_hash` 幂等 upsert。
3. 如果 MySQL 中已存在双写产生的新记录，导入脚本不得用旧 payload 静默覆盖；必须比较 `updated_at`、`created_at`、`payload_hash` 后跳过或记录冲突。
4. 以 `contract-review/`、`sql-audit-archive/` 和其它 `.runtime/` 持久化文件为来源，按文件对象导入数据库，校验字节数和 SHA-256。
5. 导入完成后生成集合级和文件对象级对账报告。

> 生产环境可由 `storage:switch-to-mysql --from-stage=dual --to-stage=reconciled` 编排完成本阶段；若存在冲突、未知持久化文件或文件哈希不一致，命令必须中断。

### 阶段 4：灰度切读

1. 先切低风险读接口：SQL 审计列表、普通业务审计列表、最近查询列表、查询模板列表。
2. 再切分析结果详情、会话恢复、合同审核任务列表、合同产物下载和治理配置读取。
3. 读 MySQL 未命中但 JSON 或旧文件目录命中时，返回 fallback 并记录差异。
4. 连续观察无差异后扩大范围。

> 生产环境可由 `storage:switch-to-mysql --from-stage=reconciled --to-stage=mysql-read` 编排完成本阶段；命令必须确认双写失败队列已清零或已有明确豁免。

### 阶段 5：MySQL 主写

1. 设置 `APP_STORAGE_DRIVER=mysql` 或 `APP_STORAGE_DUAL_WRITE_REQUIRED=true` 并关闭 JSON 主写。
2. `app-storage.json`、`contract-review/` 和 `sql-audit-archive/` 改为只读快照，不再随业务写入增长。
3. 保留 JSON / 文件 fallback 至少一个观察周期。
4. 对所有核心集合和文件对象执行每日对账，确认 MySQL 记录与文件内容完整。

> 生产环境可由 `storage:switch-to-mysql --from-stage=mysql-read --to-stage=mysql-write` 编排完成本阶段；命令必须先确认 JSON 和历史文件目录已设置只读快照保护。

### 阶段 6：收尾

1. 下线 JSON 主写、文件目录主写和整包 `persist()` 依赖。
2. 将 `app-storage.json`、合同审核历史目录、SQL 审计归档目录和锁文件归档到受控备份目录，保留恢复说明。
3. 更新 README、quickstart、部署参数清单和数据库说明。
4. 根据运行情况逐步把 payload-heavy 表拆出更多查询字段。

## Rollback Strategy

- 所有阶段优先使用 `storage:rollback-to-json` 编排回退，直接手工修改配置只作为命令不可用时的应急手段，且必须补写同等发布记录。
- 双写阶段异常：设置 `APP_STORAGE_DRIVER=json`，继续使用 JSON 主链路；保留已写 MySQL 数据供排查。
- 历史导入异常：停止导入，保留批次记录，修复后从上次成功批次重跑；不得删除 JSON 源文件。
- 切读异常：设置 `APP_STORAGE_READ_PRIMARY=json` 并启用文件目录 fallback，保留 dual 写入，修复 MySQL 查询或补数据后再切。
- MySQL 主写异常：如 JSON 和历史文件只读快照尚未过期，切回 `dual + read json`；如果已有 MySQL-only 写入或 MySQL-only 文件对象，先导出差异补回回滚快照或执行数据修复脚本，再回退。
- 合同审核文件对象异常：在观察期可临时读取旧文件目录 fallback，但必须记录差异；fallback 关闭后，数据库文件对象是唯一在线来源。

## Risks / Trade-offs

- **风险：双写期间 MySQL 写失败但 JSON 成功，导致切读后缺数据。**  
  缓解：记录双写失败队列，对账必须覆盖失败重放；未清零前不得进入 MySQL 主读。

- **风险：历史导入覆盖双写期间的新记录。**  
  缓解：upsert 必须比较 `updated_at` 与 `payload_hash`，旧 payload 不得静默覆盖新 payload。

- **风险：某些集合没有稳定 `updatedAt` 字段。**  
  缓解：以主键、`createdAt`、导入批次时间和 payload hash 组合判定；冲突进入人工复核报告。

- **风险：保留 `AppStorageService` 外观会延续部分全量 state 加载。**  
  缓解：这是迁移安全换来的过渡成本；高频集合优先改为表级读取，最终移除主链路全量 state 依赖。

- **风险：MySQL schema 首轮字段拆分不足，影响复杂筛选。**  
  缓解：关键检索字段先成列，其它字段保存在 `payload_json`；后续按慢查询和业务需要补列。

- **风险：合同和导出文件入库导致数据库容量增长。**  
  缓解：首轮记录文件大小分布，设置单文件上限、压缩/加密策略和容量告警；超过上限的文件必须阻断并给出用户可读提示，不得悄悄落回文件系统。

- **风险：文件对象导入遗漏导致合同审核详情或下载失败。**  
  缓解：按任务目录、artifact 元数据和文件对象三方对账，校验文件数量、字节数和 SHA-256；未通过对账不得关闭文件 fallback。

- **风险：应用库连接配置错误连接到 CRM 业务库。**  
  缓解：启动健康检查必须校验 schema 名、只允许表名前缀/迁移表存在、禁止在 CRM 原始业务库执行应用库迁移。

- **风险：文档或日志泄露数据库密码。**  
  缓解：所有巡检、对账、迁移报告只输出环境变量名、主机脱敏摘要、schema 名、记录数和哈希，不输出密码、Token、Secret。

## Verification

必须至少验证以下场景：

- JSON 模式下现有测试全通过，功能不变。
- dual 模式下新增和更新同时落 JSON 与 MySQL。
- dual 模式下新增合同审核文件、报告、结构化结果、AI 调试上下文和导出文件同时落旧路径与数据库文件对象。
- 历史导入脚本可重跑，重复导入不产生重复记录。
- 导入期间新增写入不会被历史导入覆盖。
- SQL 审计列表、详情、reveal 在 MySQL 读路径下结果一致。
- 最近查询、常用查询、分析结果详情、导出、合同审核任务详情、企业微信上下文恢复在 MySQL 读路径下正常。
- 合同审核原文、审核报告、结构化结果、AI 调试上下文和导出文件可从数据库读取、下载和校验哈希。
- 治理策略、角色权限、应用超级管理员授权变更在 MySQL 主写下立即生效并写审计。
- MySQL 读失败时 JSON / 文件 fallback 生效且记录差异。
- MySQL 主写阶段 JSON 文件不再持续增长。
- MySQL 主写阶段 `.runtime/contract-review`、`sql-audit-archive` 和运行态锁文件不再作为业务主写路径增长。
- 回滚到 JSON / 文件兼容读后用户可继续登录、问数、下载历史文件和查看历史结果。

## Open Questions

- 独立应用库 schema 名和账号是否由运维提供，还是由部署脚本创建占位库后交付运维授权。
- 观察期保留多久后关闭 JSON / 文件 fallback，建议至少 7 到 14 天。
- 历史 SQL 审计超过当前运行态保留上限之前的归档文件默认必须一并导入 MySQL；只允许在导入报告中标记格式不可识别或损坏文件，并进入人工处理清单。
- 数据库文件对象的单文件大小上限、压缩策略和加密方式需要结合生产 MySQL 容量确认；确认前实现必须提供可配置上限和容量告警。

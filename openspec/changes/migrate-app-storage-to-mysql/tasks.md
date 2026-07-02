## 1. 应用库连接与迁移底座

- [ ] 1.1 梳理线上 `shared/.runtime/app-storage.json`、`contract-review/`、`sql-audit-archive/`、运行态锁文件和其它 `.runtime/` 持久化文件的集合、记录数量、文件数量、总大小和更新时间，形成脱敏基线记录。
- [ ] 1.2 新增 `APP_STORAGE_DB_HOST`、`APP_STORAGE_DB_PORT`、`APP_STORAGE_DB_NAME`、`APP_STORAGE_DB_USER`、`APP_STORAGE_DB_PASSWORD`、`APP_STORAGE_DB_CONNECT_TIMEOUT_MS` 配置读取与敏感值脱敏输出。
- [ ] 1.3 实现应用库连接池服务，启动时校验目标 schema 是独立应用库，禁止对 CRM 业务库执行应用库迁移。
- [ ] 1.4 新增应用库健康检查，返回连接状态、schema 名、迁移版本和脱敏错误摘要。
- [ ] 1.5 新增应用库迁移执行器，支持按版本顺序执行 SQL、记录已执行版本、重复执行跳过和失败中断。
- [ ] 1.6 新增迁移脚本，创建 `app_storage_migration_batches`、`app_storage_migration_items`、`app_storage_reconcile_reports`、`app_storage_dual_write_failures`、`app_runtime_locks`、`app_binary_objects` 和 `app_binary_object_access_audits`。
- [ ] 1.7 新增核心业务表迁移，至少覆盖 SQL 审计、业务审计、分析请求、分析结果、最近查询、查询会话、认证会话、导出请求和查询模板。
- [ ] 1.8 新增扩展业务表迁移，覆盖治理配置、AI Profile、语义资产、企业微信上下文、目录同步、合同审核、合同文件对象、日报和主动通知。
- [ ] 1.9 为高频查询字段补充索引，包括 `created_at`、`actor_id`、`requester_id`、`request_id`、`session_id`、`status`、`module_key`、`template_id`。
- [ ] 1.10 为迁移执行器和连接健康检查补充单元测试，覆盖配置缺失、连接失败、schema 防误写和敏感值脱敏。

## 2. 存储驱动抽象与兼容外观

- [ ] 2.1 定义 `AppStorageBackend` 接口，覆盖加载完整状态、保存完整状态、按集合 upsert、按集合列表、按主键读取、删除或标记失效、文件对象写入、文件对象读取、文件对象访问审计和健康检查。
- [ ] 2.2 将现有 JSON 文件读写封装为 `JsonFileAppStorageBackend`，保持现有 `app-storage.json` 合并默认模板和策略补齐行为。
- [ ] 2.3 实现 `MysqlAppStorageBackend`，支持从应用库恢复完整 `AppStorageState`，并能按集合写入 `payload_json`、关键字段、`payload_hash` 和数据库文件对象。
- [ ] 2.4 实现 `DualWriteAppStorageBackend`，主路径读写 JSON / 文件目录，同时把新增和更新的集合记录、文件对象和运行态锁同步写入 MySQL。
- [ ] 2.5 在 `AppStorageService` 中接入 `APP_STORAGE_DRIVER=json|dual|mysql` 和 `APP_STORAGE_READ_PRIMARY=json|mysql`。
- [ ] 2.6 保持 `AppStorageService.state` 与 `persist()` 对现有仓储兼容，避免第一阶段大面积改业务模块。
- [ ] 2.7 为双写失败实现统一记录，写入 `app_storage_dual_write_failures` 或等价故障集合，并记录集合名、主键、操作、失败摘要和重试状态。
- [ ] 2.8 为 JSON、dual、mysql 三种模式补充单元测试，验证读取来源、写入目标、失败记录和兼容行为。

## 3. 集合映射与表级仓储

- [ ] 3.1 建立 `AppStorageCollectionRegistry`，集中定义每个 `AppStorageState` 集合的表名、主键、时间字段、关键索引字段、payload hash 计算规则。
- [ ] 3.2 为 `sqlAuditRecords` 实现表级 mapper 和仓储，支持创建、分页列表、详情、按 ID 查询、按条件筛选和 reveal 所需原始字段读取。
- [ ] 3.3 为 `auditEvents` 实现表级 mapper 和仓储，支持按用户、时间、事件类型、风险等级、复核状态、请求 ID 查询。
- [ ] 3.4 为 `analysisRequests` 与 `analysisResults` 实现表级 mapper 和仓储，保持结果详情、导出一致性 token 和解释追问读取兼容。
- [ ] 3.5 为 `recentQueries`、`queryTemplates`、`queryUsageProfiles`、`queryTimeSlotStats` 实现表级 mapper 和仓储，保持常用查询、我的模板、其它模板和最近查询排序兼容。
- [ ] 3.6 为 `querySessions`、`authSessions`、`wecomConversationContexts` 实现表级 mapper 和仓储，保持 Web 会话和企业微信上下文恢复兼容。
- [ ] 3.7 为治理配置集合实现固定主键或策略主键存储，覆盖访问策略、范围策略、应用超级管理员授权、角色权限、数据范围授权和企业微信试点策略。
- [ ] 3.8 为 AI 配置集合实现表级存储，覆盖 AI Profile、激活记录和上下文策略，并确保密钥密文只保存到受控字段。
- [ ] 3.9 为企业微信同步集合实现表级存储，覆盖同步用户、同步部门、同步任务、同步水位、CRM 企业微信映射缓存。
- [ ] 3.10 为合同审核集合实现表级存储，覆盖任务、问题、产物、规则集元数据和审核依据快照；合同原文、审核报告、结构化结果、AI 调试上下文和批注版合同必须写入数据库文件对象表，不得继续把 `CONTRACT_REVIEW_STORAGE_DIR` 作为长期权威存储。
- [ ] 3.11 为日报和主动通知集合实现表级存储，覆盖任务、批次、协助升级、部门策略、收件人覆盖和销售小组配置。
- [ ] 3.12 为导出文件、SQL 审计归档文件和其它持久化产物实现数据库文件对象仓储，覆盖写入、读取、下载、权限摘要、访问审计、SHA-256 校验和单文件大小限制。
- [ ] 3.13 为运行态锁、后台任务水位和迁移水位实现数据库化存储，覆盖持有者、过期时间、续租、强制释放和释放审计。
- [ ] 3.14 为所有 mapper 和文件对象仓储补充 round-trip 测试，验证从 JSON 记录或历史文件写入 MySQL 后可恢复为等价领域对象和等价文件内容。

## 4. 历史导入、断点续跑与对账

- [ ] 4.1 编写只读 JSON 和历史文件快照加载器，显式使用 UTF-8 或二进制安全读取，读取前校验文件存在、大小、mtime 和 SHA-256。
- [ ] 4.2 实现历史导入命令，支持指定来源 JSON、来源目录、集合名、文件对象类型、批大小、dry-run、断点续跑和导入报告输出。
- [ ] 4.3 导入命令必须按集合和文件对象逐批处理，并在 `app_storage_migration_batches` 记录批次状态、水位、成功数、跳过数、冲突数、失败数、来源大小和来源哈希。
- [ ] 4.4 实现记录级幂等 upsert：同一集合和主键、同一 `payload_hash` 时跳过；hash 不一致时按 `updated_at` 判定或记录冲突。
- [ ] 4.5 对没有稳定 `updatedAt` 的集合实现保守冲突策略，不得用旧 JSON payload 静默覆盖 MySQL 中的双写新记录。
- [ ] 4.6 支持导入 `contract-review/` 中的合同审核历史目录，按任务关系导入合同原文、审核报告、结构化结果、AI 调试上下文和批注版合同，输出文件数量、字节数、成功、跳过、冲突和失败数量。
- [ ] 4.7 支持导入 `sql-audit-archive/` 中的历史 SQL 审计归档，既导入可检索 SQL 审计记录，也将原归档文件作为数据库文件对象留存，输出成功、跳过、冲突和失败数量。
- [ ] 4.8 支持导入运行态锁、后台水位和其它 `.runtime/` 持久化文件；对无法识别的文件必须进入待确认清单，不得静默忽略。
- [ ] 4.9 实现集合级和文件对象级对账命令，比较 JSON / 历史目录与 MySQL 的记录数量、文件数量、总字节数、最近记录 ID、关键字段哈希、文件 SHA-256 和双写失败队列。
- [ ] 4.10 实现对账报告持久化，保存到应用库并输出脱敏摘要。
- [ ] 4.11 实现受保护的一键迁移编排命令 `storage:switch-to-mysql`，支持 `--dry-run`、`--from-stage`、`--to-stage`、`--require-confirmation`、`--report-path`，按备份校验、健康检查、双写、导入、重放、对账、切读、切主写和只读快照保护顺序推进。
- [ ] 4.12 `storage:switch-to-mysql` 必须在应用库不可用、schema 疑似 CRM 业务库、备份缺失、导入冲突未处理、双写失败未清零、文件对象对账不一致或确认信息缺失时中断，不得修改下一阶段配置。
- [ ] 4.13 实现受保护的一键回滚编排命令 `storage:rollback-to-json`，支持按当前阶段回退，回退前识别 MySQL-only 新记录和 MySQL-only 文件对象，并生成差异清单、JSON 快照补写或文件对象导出。
- [ ] 4.14 `storage:rollback-to-json` 不得删除 MySQL 数据、迁移批次、对账报告或审计记录；存在未处理差异时不得恢复 JSON / 文件主读写。
- [ ] 4.15 为导入、对账和编排命令补充测试，覆盖重复导入、中断续跑、双写新记录不被覆盖、坏记录跳过、文件哈希不一致、未知持久化文件进入待确认清单、dry-run 不改状态、前置检查失败中断、回滚差异未处理时拒绝切回和敏感值不输出。

## 5. 双写灰度与失败补偿

- [ ] 5.1 接入 `APP_STORAGE_DRIVER=dual`，确保线上主读仍为 JSON，新增写入同步进入 MySQL。
- [ ] 5.2 为强一致数据配置双写失败策略，覆盖治理策略、角色权限、应用超级管理员授权、AI Profile 激活、查询模板状态、合同审核任务状态、合同文件对象、导出文件对象、运行态锁和高风险审计。
- [ ] 5.3 为可补偿流水配置失败补偿策略，覆盖普通 SQL 审计、普通业务审计、最近查询统计、消息投递记录和时间槽统计。
- [ ] 5.4 实现双写失败重放命令，按集合、文件对象、时间和失败原因重试写入 MySQL。
- [ ] 5.5 实现双写失败告警摘要，不输出 payload 原文、密码、Token、Secret、合同正文或客户敏感字段。
- [ ] 5.6 补充集成测试，验证 JSON / 文件目录成功而 MySQL 失败时现有功能仍可用，且集合记录、文件对象和运行态锁失败记录可重放。

## 6. MySQL 切读与 JSON / 文件 fallback

- [ ] 6.1 为 SQL 审计列表、SQL 审计详情、SQL 审计归档对象和 reveal 路径接入 MySQL 主读，并保留 JSON / 文件 fallback。
- [ ] 6.2 为业务审计列表和摘要接入 MySQL 主读，并保留 JSON fallback。
- [ ] 6.3 为最近查询、常用查询、我的模板和其它模板接入 MySQL 主读，并保留 JSON fallback。
- [ ] 6.4 为分析结果详情、导出文件、解释追问和历史重跑读取接入 MySQL 主读，并保留 JSON / 文件 fallback。
- [ ] 6.5 为会话恢复、企业微信上下文、合同审核任务列表、任务详情和合同审核文件下载接入 MySQL 主读，并保留 JSON / 文件 fallback。
- [ ] 6.6 为治理配置读取接入 MySQL 主读，确保权限变更、模板治理和应用超级管理员授权即时生效。
- [ ] 6.7 为运行态锁和后台任务水位接入 MySQL 主读写，观察期保留旧锁文件兼容读取并记录差异。
- [ ] 6.8 实现 fallback 差异事件，记录集合名、文件对象 ID、主键、查询条件、失败摘要和入口，不记录敏感正文。
- [ ] 6.9 补充契约和集成测试，覆盖 MySQL 命中、MySQL 未命中 JSON / 文件命中、MySQL 异常 fallback、文件哈希校验失败、fallback 关闭后返回明确错误。

## 7. MySQL 主写与 JSON 只读快照

- [ ] 7.1 接入 `APP_STORAGE_DRIVER=mysql`，以 MySQL 作为应用状态主写存储。
- [ ] 7.2 实现 `APP_STORAGE_JSON_SNAPSHOT_READONLY=true`，阻止业务主链路继续整包写入 `app-storage.json`。
- [ ] 7.3 实现 `APP_STORAGE_FILE_SNAPSHOT_READONLY=true` 或等价保护，阻止业务主链路继续向 `contract-review/`、`sql-audit-archive/` 和运行态锁文件写入持久化业务数据。
- [ ] 7.4 在 MySQL 主写阶段保留观察期对账任务，确认 JSON 文件、合同审核目录、SQL 审计归档目录和运行态锁文件不再持续增长。
- [ ] 7.5 实现 MySQL-only 新记录和 MySQL-only 文件对象识别命令，用于回滚前识别无法直接切回 JSON / 文件目录的差异。
- [ ] 7.6 实现必要的 JSON 快照补写、文件对象导出或差异导出工具，供紧急回滚使用。
- [ ] 7.7 补充测试，验证 MySQL 主写下登录、问数、审计、最近查询、常用查询、治理保存、合同审核、文件下载、导出和企业微信上下文写入正常。

## 8. SQL 审计长期主存储改造

- [ ] 8.1 将 `SqlAuditRepository` 的长期存储实现切换为应用库表级仓储，保留旧 JSON 运行态读取作为迁移期兼容路径。
- [ ] 8.2 确保 SQL 审计应用库记录保存完整 `sqlText`、`paramsJson`、脱敏摘要、指纹、上下文、状态、耗时和风险等级。
- [ ] 8.3 改造 SQL 审计控制器分页查询，使用应用库索引字段过滤，不再全量读取 JSON 后内存过滤。
- [ ] 8.4 保持 SQL 审计 reveal 权限校验和 reveal 行为审计不变。
- [ ] 8.5 支持导入历史 `app-storage.json` 和 `sql-audit-archive/` 中 SQL 审计记录，并将原归档文件保存为数据库文件对象。
- [ ] 8.6 观察期结束后关闭 SQL 审计旧 JSON / 文件 fallback，确保 SQL 审计列表、详情、reveal 和归档下载以应用库为唯一在线来源。
- [ ] 8.7 补充 SQL 审计单元、集成和权限测试，覆盖列表、详情、reveal、fallback、归档导入、归档文件对象下载和旧路径兼容关闭。

## 9. 回归测试与性能验证

- [ ] 9.1 执行后端单元测试，覆盖应用库连接、存储驱动、mapper、文件对象仓储、运行态锁、导入、对账、双写、fallback 和 SQL 审计。
- [ ] 9.2 执行后端契约和集成测试，覆盖登录、会话恢复、权限中心、治理配置、分析问数、最近查询、常用查询、导出、审计中心、合同审核、合同文件下载和企业微信入口。
- [ ] 9.3 执行前端单元测试和关键 Playwright 流程，确认页面接口返回结构和用户可见文案不变。
- [ ] 9.4 使用膨胀版 `app-storage.json` 和历史文件目录样本验证 MySQL 读路径下审计列表、最近查询、模板列表、分析结果详情、合同文件下载和导出不会随 JSON 文件或目录规模线性变慢。
- [ ] 9.5 在测试环境演练完整切换：`json/file -> dual -> 导入 -> 对账 -> mysql read -> mysql write -> fallback 关闭`，并使用 `storage:switch-to-mysql` 覆盖 dry-run、分阶段推进和失败中断。
- [ ] 9.6 在测试环境演练回滚：双写阶段回滚、切读阶段回滚、MySQL 主写阶段差异识别和回退，并使用 `storage:rollback-to-json` 覆盖 MySQL-only 数据识别、补写或差异报告。

## 10. 生产发布与文档

- [ ] 10.1 更新 `README.md`，说明线上本系统自有状态和持久化业务文件已由独立 MySQL 应用库承接，`.runtime/app-storage.json`、`contract-review/`、`sql-audit-archive/` 和运行态锁文件仅作为迁移期或回滚快照。
- [ ] 10.2 更新 `specs/001-crm-intelligent-analytics/plan.md`、`quickstart.md`、`data-model.md` 和 `contracts/openapi.yaml` 中与应用库存储、审计、最近查询、合同审核、导出文件、运行态锁和文件对象相关的说明。
- [ ] 10.3 新增生产应用库部署参数清单，列出 `APP_STORAGE_DB_*`、驱动模式、双写、fallback、导入、对账、文件 staging、单文件大小上限、压缩和加密配置，不包含敏感值。
- [ ] 10.4 新增线上迁移操作手册，覆盖备份、开双写、导入 JSON、导入文件目录、导入运行态锁、对账、切读、切主写、观察、关闭 fallback 和回滚，并以 `storage:switch-to-mysql` / `storage:rollback-to-json` 作为首选操作入口。
- [ ] 10.5 新增只读巡检脚本，输出应用库健康、双写失败、对账状态、JSON 文件大小、文件目录增长、文件对象数量和容量、SQL 审计数量和最近导入批次。
- [ ] 10.6 在生产低峰期执行阶段 0 到阶段 4，并记录脱敏验收结果。
- [ ] 10.7 在观察期稳定后执行 MySQL 主写切换，并确认 `app-storage.json`、`contract-review/`、`sql-audit-archive/` 和运行态锁文件不再持续增长。
- [ ] 10.8 观察期结束后关闭 JSON / 文件 fallback，归档 `app-storage.json` 和历史文件目录，保留恢复快照和审计记录。

## ADDED Requirements

### Requirement: 系统必须使用独立 MySQL 应用库存储全部自有持久化数据

系统 MUST 使用独立 MySQL 应用库承接本系统全部自有持久化数据，包括治理配置、查询模板、最近查询、分析请求与结果、业务审计、SQL 审计、会话、企业微信上下文、目录同步快照、日报、主动通知、AI Profile、合同审核元数据、合同审核原始文件、审核报告、结构化结果、AI 调试上下文、导出文件、SQL 审计归档、迁移状态、对账报告和运行态锁。该应用库 MUST 与 CRM 业务库职责隔离，不得把本系统自有持久化数据写入 CRM 客户、商机、合同、组织、用户、角色或其它 CRM 原始业务表。

#### Scenario: 应用状态写入独立应用库

- **WHEN** 系统保存最近查询、审计事件、查询模板、会话、合同审核任务、合同审核文件、导出文件或 SQL 审计归档
- **THEN** 系统必须写入 `APP_STORAGE_DB_*` 指向的独立应用库
- **THEN** 系统不得将这些本系统自有持久化数据写入 CRM 业务库

#### Scenario: CRM 原始业务数据仍来自 CRM 数据源

- **WHEN** 系统查询客户、商机、合同、组织、部门、用户或角色等 CRM 原始对象
- **THEN** 系统必须继续通过 CRM 官方 API 或受控 CRM 数据源读取
- **THEN** 应用库不得被当作 CRM 原始业务对象的权威来源

#### Scenario: 文件系统不再作为业务数据权威来源

- **WHEN** 系统完成 MySQL 主写切换和观察期
- **THEN** `.runtime/app-storage.json`、`.runtime/contract-review`、`.runtime/sql-audit-archive` 和 `.runtime/*.lock` 不得继续作为业务数据权威来源
- **THEN** 文件系统只允许保留临时文件、部署文件、操作系统日志和只读回滚快照

### Requirement: 应用存储必须支持可灰度的驱动模式

系统 MUST 支持 `json`、`dual`、`mysql` 三类应用存储驱动模式。`json` 模式保持现有 JSON / 文件运行态主读写；`dual` 模式以 JSON / 文件运行为主读写并同步写入 MySQL；`mysql` 模式以 MySQL 为主读写，并可在观察期保留 JSON / 文件 fallback。驱动切换 MUST 通过配置完成，不得要求修改代码或重新构建。

#### Scenario: JSON 模式保持现有行为

- **WHEN** `APP_STORAGE_DRIVER=json`
- **THEN** 系统必须继续使用现有 JSON 和文件运行态读写路径
- **THEN** 现有登录、问数、审计、合同审核和企业微信功能不得因新增应用库能力改变用户可见行为

#### Scenario: 双写模式捕获新增数据

- **WHEN** `APP_STORAGE_DRIVER=dual`
- **THEN** 系统必须继续以 JSON 和文件运行为主读写路径
- **THEN** 系统必须将新增和更新的应用状态、文件对象、运行态锁和归档记录同步写入 MySQL 应用库
- **THEN** MySQL 写入失败必须记录差异和告警

#### Scenario: MySQL 模式停止 JSON 主写增长

- **WHEN** `APP_STORAGE_DRIVER=mysql`
- **THEN** 系统必须以 MySQL 应用库作为主读写存储
- **THEN** `app-storage.json`、`contract-review/`、`sql-audit-archive/` 和运行态锁文件不得继续作为业务主写文件持续增长
- **THEN** 观察期内如启用 fallback，系统必须记录每次 JSON 或文件 fallback 差异

### Requirement: 历史 JSON 和文件导入必须幂等且不丢新增写入

系统 MUST 提供从 `app-storage.json`、`contract-review/`、`sql-audit-archive/` 和其它 `.runtime/` 持久化文件到 MySQL 应用库的历史导入能力。导入 MUST 支持按集合和文件对象分批、断点续跑、幂等 upsert、payload 哈希、文件 SHA-256、冲突报告和对账。生产切换 MUST 先开启双写捕获新增数据，再执行历史导入，避免导入期间新增写入只存在 JSON 或文件目录。

#### Scenario: 重复执行历史导入

- **WHEN** 运维重复执行同一个 `app-storage.json` 的导入任务
- **THEN** 系统必须根据集合名、记录主键和 `payload_hash` 跳过已导入记录
- **THEN** 系统不得生成重复业务记录

#### Scenario: 历史导入遇到双写期间的新记录

- **WHEN** MySQL 中已经存在双写产生的新记录，而历史 JSON 中存在同一主键的旧 payload
- **THEN** 导入脚本不得用旧 payload 静默覆盖新记录
- **THEN** 导入脚本必须跳过、合并或记录冲突，并在对账报告中说明处理结果

#### Scenario: 导入过程异常中断

- **WHEN** 历史导入任务在某个集合或批次中断
- **THEN** 系统必须保留已完成批次水位
- **THEN** 后续重跑必须从未完成批次继续或安全重放已完成批次

#### Scenario: 导入合同审核历史文件

- **WHEN** 运维导入 `.runtime/contract-review` 下的合同审核历史目录
- **THEN** 系统必须将原始文件、审核报告、结构化结果、AI 调试上下文和批注产物写入数据库文件对象表
- **THEN** 系统必须校验每个文件的字节数和 SHA-256

#### Scenario: 导入运行态锁和归档文件

- **WHEN** 运维导入 `.runtime/*.lock` 或 `sql-audit-archive` 下的历史文件
- **THEN** 系统必须将所有归档记录、归档文件对象以及仍有业务恢复价值的锁和水位写入数据库表
- **THEN** 系统必须在导入报告中说明跳过的纯临时文件及跳过原因

### Requirement: 应用库记录必须支持完整对象恢复和关键字段检索

系统 MUST 为应用库记录保存可恢复完整领域对象的数据。高频和列表检索需要的字段 MUST 单独成列并建立索引；结构复杂或字段变化频繁的对象 MUST 保存 `payload_json` 和 `payload_hash`，确保现有接口可以从 MySQL 记录恢复出与 JSON 运行态一致的业务对象。

#### Scenario: 审计列表按关键字段分页

- **WHEN** 管理员按时间、用户、模块、状态或请求 ID 查询审计列表
- **THEN** 系统必须使用应用库索引字段完成过滤和分页
- **THEN** 系统不得依赖全量加载所有审计记录后在内存中过滤

#### Scenario: 复杂对象字段尚未完全拆表

- **WHEN** 合同审核任务、主动通知任务、日报汇总或企业微信上下文包含复杂嵌套字段
- **THEN** 系统必须在应用库中保存完整 `payload_json`
- **THEN** 现有详情接口必须能从该 payload 恢复完整响应所需字段

### Requirement: 数据库文件对象必须保存所有持久化业务文件

系统 MUST 使用数据库文件对象表保存本系统接收或生成的所有持久化业务文件，包括合同审核原始文件、批注版合同、审核报告、结构化结果、AI 调试上下文、导出文件、SQL 审计归档和后续新增的业务产物文件。文件对象记录 MUST 至少包含业务归属、文件名、MIME 类型、字节数、内容 SHA-256、二进制内容、创建人、创建时间、下载权限摘要和加密状态。

#### Scenario: 保存新的合同审核文件

- **WHEN** 用户从 CRM 待审批合同发起审核或兼容入口上传合同文件
- **THEN** 系统必须将合同原文和后续审核产物保存到数据库文件对象表
- **THEN** 系统不得将 `CONTRACT_REVIEW_STORAGE_DIR` 作为长期权威存储

#### Scenario: 下载合同审核产物

- **WHEN** 用户下载审核报告、结构化结果、批注版合同或 AI 调试上下文
- **THEN** 系统必须从数据库文件对象表读取文件内容
- **THEN** 系统必须继续执行现有下载权限和审计校验

#### Scenario: 文件对象完整性校验失败

- **WHEN** 数据库文件对象的实际字节数或 SHA-256 与记录不一致
- **THEN** 系统必须拒绝返回该文件
- **THEN** 系统必须记录可检索的完整性异常事件

### Requirement: 双写对账必须阻止未校验的数据切读

系统 MUST 在切换 MySQL 主读前完成集合级和文件对象级对账。对账 MUST 至少覆盖记录数量、最近记录主键、关键字段哈希、文件数量、文件字节数、文件 SHA-256、双写失败队列和冲突报告。存在未处理差异的集合或文件对象类型 MUST 不得切换为 MySQL 主读。

#### Scenario: 集合存在双写失败记录

- **WHEN** 某个集合仍存在未重放成功的双写失败记录
- **THEN** 系统不得将该集合切换为 MySQL 主读
- **THEN** 对账报告必须列出失败集合、失败数量和最近失败原因摘要

#### Scenario: MySQL 与 JSON 数量不一致

- **WHEN** 对账发现某个集合 MySQL 记录数与 JSON 运行态记录数不一致
- **THEN** 系统必须标记该集合为不可切读
- **THEN** 运维必须先完成补导入、冲突处理或明确豁免后才能继续切换

#### Scenario: 文件对象对账不一致

- **WHEN** 对账发现数据库文件对象与历史文件目录在数量、字节数或 SHA-256 上不一致
- **THEN** 系统必须标记对应文件对象类型为不可切读
- **THEN** 运维必须先完成补导入或冲突处理后才能关闭文件 fallback

### Requirement: MySQL 读路径必须支持 JSON / 文件 fallback

系统 MUST 在灰度切读阶段支持 MySQL 主读和 JSON / 文件 fallback。若 MySQL 读失败或未命中但 JSON 或历史文件目录命中，系统 MUST 按配置返回 fallback 结果并记录差异事件。fallback MUST 只作为观察期保护，不得长期掩盖 MySQL 数据缺失。

#### Scenario: MySQL 读失败但 JSON 可用

- **WHEN** 灰度切读期间 MySQL 查询应用状态或文件对象失败
- **THEN** 系统必须在启用 fallback 时读取 JSON 运行态或历史文件目录
- **THEN** 系统必须记录包含集合名、主键、请求入口和失败摘要的差异事件

#### Scenario: 观察期结束关闭 fallback

- **WHEN** 观察期结束且对账连续通过
- **THEN** 系统必须支持关闭 JSON 和文件 fallback
- **THEN** 后续 MySQL 读失败必须按业务错误处理，而不得继续静默读取旧 JSON 快照或旧文件目录

### Requirement: 生产切换必须具备可验证回滚路径

系统 MUST 为 `json`、`dual`、`mysql` 每个阶段提供回滚策略。回滚 MUST 优先通过配置切换完成，并保留已写入 MySQL 的数据和对账报告。若 MySQL 主写阶段已产生 JSON 或历史文件目录中不存在的新记录或新文件对象，回退到 JSON / 文件主读前 MUST 先处理差异。

#### Scenario: 双写阶段回滚

- **WHEN** 双写阶段 MySQL 应用库不可用或写入失败率超过阈值
- **THEN** 运维必须能通过配置切回 `APP_STORAGE_DRIVER=json`
- **THEN** 系统必须继续使用 JSON 运行态保障现有功能

#### Scenario: MySQL 主写阶段回滚

- **WHEN** MySQL 主写阶段需要回退到 JSON 主读
- **THEN** 系统必须先识别 MySQL-only 新记录和 MySQL-only 文件对象
- **THEN** 系统必须补回 JSON / 文件回滚快照或生成明确的数据修复清单后才能恢复 JSON / 文件主读

### Requirement: 生产切换必须提供受保护的一键编排命令

系统 MUST 提供受保护的一键迁移编排命令和一键回滚编排命令。命令 MAY 一键触发，但 MUST 内置前置检查、备份校验、导入、对账、分阶段配置切换、失败中断、脱敏日志和发布报告。命令不得在校验失败、差异未处理或确认信息缺失时继续修改生产读写路径。

#### Scenario: 一键迁移到 MySQL

- **WHEN** 运维执行 `storage:switch-to-mysql`
- **THEN** 系统必须依次执行应用库健康检查、schema 防误写检查、历史文件备份校验、双写开启、历史 JSON 导入、历史文件对象导入、运行态锁导入、双写失败重放、集合和文件对象对账、切读、切主写和只读快照保护
- **THEN** 任一阶段失败时必须中断并保留可重跑水位
- **THEN** 命令输出不得包含数据库密码、Token、Secret、合同正文或客户敏感字段

#### Scenario: 一键回退到 JSON 兼容路径

- **WHEN** 运维执行 `storage:rollback-to-json`
- **THEN** 系统必须识别当前阶段、MySQL-only 新记录和 MySQL-only 文件对象
- **THEN** 系统必须先补写 JSON / 文件回滚快照或生成明确的数据修复清单
- **THEN** 在差异未处理前不得恢复 JSON / 文件主读写
- **THEN** 回滚命令不得删除 MySQL 数据、迁移批次、对账报告或审计记录

#### Scenario: dry-run 不改变线上状态

- **WHEN** 运维以 `--dry-run` 执行迁移或回滚编排命令
- **THEN** 系统必须输出将要执行的阶段、检查项、预计修改的配置和报告位置
- **THEN** 系统不得修改 `APP_STORAGE_DRIVER`、`APP_STORAGE_READ_PRIMARY`、fallback 开关或任何线上数据

### Requirement: 运行态锁和后台水位必须数据库化

系统 MUST 将影响业务恢复、幂等、单实例保护或后台任务进度的运行态锁和水位保存到 MySQL 应用库。`.runtime/*.lock` MAY 在迁移观察期作为兼容输入，但不得作为目标态权威锁。数据库锁记录 MUST 支持持有者、过期时间、续租时间、业务类型和强制释放审计。

#### Scenario: 企业微信机器人监听锁入库

- **WHEN** 企业微信机器人监听器需要判断当前实例是否持有监听资格
- **THEN** 系统必须读取或写入数据库运行态锁
- **THEN** 系统不得依赖 `.runtime/wecom-bot-listener.lock` 作为目标态权威锁

#### Scenario: 后台任务水位恢复

- **WHEN** 目录同步、日报批次、主动通知或迁移任务在进程重启后恢复
- **THEN** 系统必须从数据库读取任务水位和幂等状态
- **THEN** 系统不得依赖本地文件恢复业务进度

### Requirement: 迁移和巡检输出不得暴露敏感信息

系统 MUST 在应用库迁移、对账、巡检、告警和发布记录中隐藏数据库密码、企业微信 Secret、Token、机器人密钥、完整连接串、合同正文和客户敏感数据。输出 MAY 包含环境变量名、schema 名、文件大小、记录数量、文件数量、哈希、批次号、耗时和非敏感错误摘要。

#### Scenario: 输出应用库连接检查结果

- **WHEN** 运维执行应用库连接健康检查
- **THEN** 系统可以输出 `APP_STORAGE_DB_HOST`、schema 名和连接状态
- **THEN** 系统不得输出 `APP_STORAGE_DB_PASSWORD` 明文或完整连接串

#### Scenario: 输出导入对账报告

- **WHEN** 导入脚本生成对账报告
- **THEN** 报告必须展示集合名、记录数量、哈希摘要、冲突数量和失败摘要
- **THEN** 报告不得展示合同正文、客户敏感字段、数据库密码、Token 或 Secret

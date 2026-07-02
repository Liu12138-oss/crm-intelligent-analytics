## Context

当前企业微信机器人已经能通过 SDK 接收企业微信消息，并能在未识别身份时给出明确提示，但真实用户仍频繁停在“当前企业微信账号未绑定 CRM 身份”这一步。现有识别逻辑完全依赖 CRM 主库中的 `wx_users` 与 `wx_user_maps`：

- `wx_users.userid` 对应企业微信消息中的 `from.userid`
- `wx_user_maps.wx_user_id -> wx_users.id`
- `wx_user_maps.user_id -> users.id`

仓库中的数据库快照显示 `wx_users`、`wx_user_maps`、`wx_user_department_maps` 这组表在导出时预估行数均为 0，极像未完成企业微信组织架构同步，或者至少没有形成可用映射。因此，只要外部组织架构没同步，机器人就很难识别真实企业微信用户。

用户提供的 EMM API 文档页可访问，并已确认以下关键接口：

- `POST /auth/appToken`：获取应用访问令牌
- `POST /organizational/listDepartmentByTime`：按时间戳增量获取部门
- `POST /organizational/listUserByTime`：按时间戳增量获取用户，返回 `uiduserid`、`phone`、`email`、`deptid` 等字段
- `POST /organizational/listUserDeptChangeByTime`：按时间戳获取用户部门变更记录

项目约束也很明确：一期 CRM 业务库只允许只读访问，不能新增写入路径。因此，本次同步设计不能把数据直接写回 CRM 的 `wx_*` 表，只能写入应用侧镜像，并在身份识别时优先复用 CRM 原生映射，未命中时再使用镜像兜底。

## Goals / Non-Goals

**Goals：**

- 通过外部 EMM API 获取企业微信组织、部门、用户与用户部门变更增量数据。
- 在应用存储库中建立企业微信目录镜像与同步游标，不修改 CRM 主库。
- 为机器人身份识别提供镜像兜底路径：`userid -> 手机号 -> 邮箱 -> CRM users`。
- 保留同步状态、失败原因、游标与命中来源，便于运营排障。
- 支持首次初始化、增量同步、分页续拉和失败重试。
- 提供生产环境快速恢复入口，使运维在发现企微目录未同步时可立即手动触发同步。

**Non-Goals：**

- 不向 CRM 主库写入或修复 `wx_users`、`wx_user_maps`、`wx_departments` 等表。
- 不在本次设计中引入双向同步、冲突合并或把应用镜像回灌到 EMM。
- 不改变 CRM 权限模型，只解决企业微信身份识别的目录来源问题。
- 不依赖企业微信机器人消息回调直接返回手机号/邮箱，仍以 API 同步为准。
- 不把“生产环境一键同步”做成绕过权限的公开接口，仅限内部运维或受控后台使用。

## 目标数据结构

建议在应用存储侧新增 5 类对象：

### 1. 企业微信部门镜像表

建议命名：`wecom_sync_departments`

建议核心字段：

- `id`
- `wx_department_id`
- `department_name`
- `department_alias`
- `parent_department_id`
- `organization_external_id`
- `display_order`
- `is_parent`
- `state`
- `raw_payload`
- `sync_status`
- `last_synced_at`
- `deleted_at`

用途：

- 作为企业微信部门树的本地镜像；
- 支撑用户部门归属计算；
- 支撑后续治理页排障查看“这个部门有没有同步到本地”。

### 2. 企业微信用户镜像表

建议命名：`wecom_sync_users`

建议核心字段：

- `id`
- `wx_userid`
- `origin_userid`
- `user_name`
- `user_alias`
- `mobile`
- `email`
- `tel`
- `gender`
- `position`
- `avatar`
- `status`
- `organization_external_id`
- `primary_department_id`
- `raw_payload`
- `sync_status`
- `last_synced_at`
- `deleted_at`

用途：

- 作为机器人身份识别兜底来源；
- 为手机号 / 邮箱匹配 CRM `users` 提供线索；
- 为后续扫码登录、目录对账提供统一来源。

### 3. 企业微信用户部门变更事件表

建议命名：`wecom_sync_user_dept_changes`

建议核心字段：

- `id`
- `wx_userid`
- `change_type`
- `entity_type`
- `department_id`
- `change_timestamp`
- `raw_payload`
- `synced_at`

用途：

- 保存用户“加部门 / 换部门 / 移出部门”的事件流；
- 便于同步失败恢复时重新回放；
- 便于排障“为什么这个人今天换部门了但机器人还识别不到”。

### 4. 同步游标表

建议命名：`wecom_sync_checkpoints`

建议按资源类型分开维护：

- `resource_type`：`department` / `user` / `user-dept-change`
- `cursor_value`：即 `updatetimestamp`
- `last_success_at`
- `last_attempt_at`
- `last_failure_reason`
- `last_success_page`
- `status`

用途：

- 控制增量同步起点；
- 支撑失败重试；
- 支撑运维查看“同步停在什么时候”。

### 5. 同步运行日志表

建议命名：`wecom_sync_runs`

建议核心字段：

- `id`
- `resource_type`
- `run_mode`：`bootstrap` / `incremental` / `manual-retry`
- `started_at`
- `finished_at`
- `status`
- `page_count`
- `item_count`
- `from_cursor`
- `to_cursor`
- `failure_reason`

用途：

- 保留每一轮同步的完整执行记录；
- 区分“游标在哪”和“这轮同步为什么失败”。

## 身份识别顺序

建议机器人身份识别顺序明确固定如下：

```text
1. CRM 原生映射：
   wx_users.userid -> wx_user_maps.user_id -> users.id

2. 应用镜像兜底：
   wecom_sync_users.wx_userid -> users

3. 手机号兜底：
   wecom_sync_users.mobile -> users.phone

4. 邮箱兜底：
   wecom_sync_users.email -> users.email
```

每一步都要记录命中来源，并且遵守：

- 只要上一层命中成功，后面不再继续尝试；
- 若某一步出现多命中，直接返回 `ambiguous`，不自动放行；
- 若手机号和邮箱都为空，直接返回 `unresolved`；
- 最终返回的仍然必须是 CRM `users.id`，而不是镜像用户主键。

## 同步切片

建议实现时分 4 个切片：

### 切片 1：令牌与客户端

- `POST /auth/appToken`
- 统一 HTTP 客户端
- 统一错误映射
- 令牌缓存与过期刷新

### 切片 2：部门 / 用户镜像

- `listDepartmentByTime`
- `listUserByTime`
- 首次初始化
- 分页拉取
- 游标推进

### 切片 3：用户部门变更

- `listUserDeptChangeByTime`
- 事件落库
- 关系回放
- 与用户镜像联动更新

### 切片 4：机器人身份兜底

- 优先 CRM 原生映射
- 失败后镜像兜底
- 手机号 / 邮箱兜底
- 命中来源审计

这样切的原因：

- 先把外部 API 接入和游标模型做稳；
- 再逐步让机器人真正消费镜像；
- 失败时可独立回滚某个切片，不影响全部链路。

### 切片 5：生产环境快速恢复入口

- 提供一键同步脚本
- 提供内部手动触发 API 或管理入口
- 提供执行前校验与执行后摘要输出

这样做的原因：

- 生产环境最痛的是“发现问题时不能快速补数”；
- 运维需要一条固定动作，而不是每次临时拼多次分页调用。

## Decisions

### 决策一：采用“应用侧镜像库”而不是直接写 CRM `wx_*` 表

同步结果统一写入应用存储库的新镜像表，例如：

- `wecom_sync_departments`
- `wecom_sync_users`
- `wecom_sync_user_dept_changes`
- `wecom_sync_checkpoints`
- `wecom_sync_runs`

这样做的原因：

- 当前一期明确禁止写 CRM 业务库，直接更新 CRM `wx_*` 表会违反边界。
- 应用侧镜像更利于记录同步状态、失败分页和游标。
- 即便未来 CRM 侧补齐原生同步，应用侧镜像也可作为兜底来源或比对来源。

备选方案是直接写 CRM `wx_users`、`wx_user_maps`。该方案虽然表面上最省事，但越过了一期只读约束，不采用。

### 决策二：同步策略采用“首次初始化 + 增量游标 + 分页续拉”

每类资源分别维护 `updatetimestamp` 游标。同步任务启动后：

1. 若无游标，则从配置的初始时间或最早可用窗口开始；
2. 按分页调用增量接口；
3. 只有当本页成功落库后，才推进游标；
4. 所有分页完成后再标记本轮同步成功。

这样做的原因：

- 文档中的部门、用户、用户部门变更接口都显式要求分页和时间戳。
- 先推进游标再落库会造成漏数。
- 同步失败时保留最后成功游标，便于安全重试。

备选方案是每次全量重拉。该方案在用户量增长后成本高，也不利于快速修复单次失败，因此不采用。

### 决策二补充：游标推进必须按“分页成功后推进，整轮完成后固化”执行

建议在实现上区分两个游标概念：

- `candidate_cursor`：当前分页返回中观察到的最大更新时间戳；
- `committed_cursor`：真正写入 `wecom_sync_checkpoints` 的稳定游标。

这样做的原因：

- 单页成功不代表整轮成功；
- 若中途失败，只能从 `committed_cursor` 继续，不能错误跳过后续数据。

### 决策三：机器人身份识别采用“CRM 原生映射优先，镜像兜底”顺序

`resolveSender` 的推荐顺序应调整为：

1. 先查 CRM 原生 `wx_user_maps + wx_users`
2. 若未命中，则查应用镜像 `wecom_sync_users.userid`
3. 若镜像命中且有手机号，则用手机号匹配 CRM `users.phone`
4. 若手机号未命中且有邮箱，则用邮箱匹配 CRM `users.email`
5. 命中后返回 CRM 用户主体，并标记命中来源

这样做的原因：

- 最大程度兼容 CRM 已有同步能力，不破坏已有映射。
- 当 CRM 原生 `wx_*` 为空时，机器人仍可借助镜像恢复识别能力。
- 手机号优先于邮箱更符合企业目录中手机号的稳定性。

备选方案是完全绕开 CRM `wx_user_maps`，只用镜像。该方案会与已有映射并存逻辑冲突，不采用。

### 决策三补充：`userid` 镜像兜底只在存在显式 CRM 绑定线索时使用

镜像 `userid` 本身不应直接映射到 CRM `users` 的任意字段，而应作为查找镜像用户详情的主键，再由手机号 / 邮箱或后续人工绑定关系完成到 CRM 主体的解析。

这样做的原因：

- CRM `users` 表并没有 `userid` 这个企业微信原生字段；
- 若把 `userid` 直接和 `users.name`、`users.path` 等字段模糊匹配，会产生大量误识别。

### 决策四：用户部门变更记录与用户详情同步分开处理

`listUserByTime` 负责更新用户详情快照，`listUserDeptChangeByTime` 负责维护用户部门关系与变更审计。两者必须分别保存，但在身份识别中优先消费最新用户详情快照。

这样做的原因：

- 用户部门变更接口语义更偏事件流，不一定总是返回完整用户资料。
- 用户详情和用户部门关系生命周期不同，混在一个表里后续很难恢复一致性。

备选方案是只同步用户详情，不同步部门变更。该方案会导致组织树和用户归属长期不一致，不采用。

### 决策五：同步任务对外提供“手动触发 + 状态查询”入口

除了后台定时任务外，建议提供内部接口或管理入口支持：

- 手动触发全量初始化
- 手动触发某一类资源增量同步
- 查看最近一次同步状态、游标、失败原因和统计量

这样做的原因：

- 当前问题已经影响机器人识别，必须支持运维快速补数。
- 仅靠定时任务不利于排障和验收。

备选方案是只做定时任务，不提供查询入口。该方案不利于落地排查，不采用。

### 决策五补充：生产环境同时提供“脚本入口 + 内部服务入口”

建议同时提供两类触发方式：

1. 脚本入口：面向服务器运维，执行一次即可触发目录同步；
2. 内部服务入口：面向后台或内部调试页面，便于可视化查看状态。

推荐脚本形态：

- `scripts/run-wecom-directory-sync.ps1`
- 必要时补一个后端命令入口或受控内部 API，例如：
  - `POST /internal/wecom-directory-sync/run`
  - `GET /internal/wecom-directory-sync/status`

这样做的原因：

- 脚本适合生产故障快速处理；
- 服务入口适合后续后台接入和自动化。

备选方案是只提供 API，不提供脚本。该方案在生产现场不够直接，不采用。

### 决策五补充：一键同步脚本必须具备执行前校验和摘要输出

生产环境一键同步脚本在执行前必须至少校验：

- EMM API 基础地址是否已配置；
- 应用凭证是否已配置；
- 应用存储库是否可用；
- 当前是否已有同步任务在执行中。

执行完成后必须输出摘要：

- 触发时间
- 任务类型
- 同步资源范围
- 成功条数
- 失败条数
- 最新游标
- 最近失败原因（若有）

这样做的原因：

- 运维需要“能不能执行”和“执行完结果如何”的即时反馈；
- 否则脚本虽然能跑，但不能成为标准操作方式。

### 决策六：同步任务必须容忍“外部 API 可达但部分资源为空”

外部组织架构接口在某些租户或时间点可能返回空列表。系统必须区分：

- “接口成功，但当前没有增量数据”
- “接口成功，但目标租户根本没有基础数据”
- “接口失败或鉴权失败”

这样做的原因：

- 否则很容易把“没有增量”误判成“同步成功”；
- 也很容易把“租户没配数据”误判成“代码有 bug”。

## Risks / Trade-offs

- [外部 API 与 CRM 现有 `wx_*` 口径不完全一致] → 以应用镜像作为独立来源，并保留命中来源字段，避免混淆。
- [增量游标处理不当会漏同步] → 按页落库成功后再推进游标，并对每轮同步单独记录 run 状态。
- [手机号或邮箱匹配到错误 CRM 用户] → 先保留“命中来源 + 命中字段”审计，并对多命中场景直接拒绝自动绑定。
- [外部 API 鉴权失效会导致同步全部中断] → 单独记录 `appToken` 获取失败，并提供手动重试入口。
- [组织架构镜像长期落后会影响机器人识别准确性] → 增加同步延迟告警和最近成功时间展示。
- [用户部门变更事件与用户详情快照时序不一致] → 保留原始事件时间戳，并允许在下一轮详情同步时重新收敛。
- [镜像表写入量增长后影响应用库性能] → 对 `wx_userid`、手机号、邮箱、资源类型和游标字段建立索引，并控制原始 payload 保存粒度。
- [生产环境手动触发入口被误用或重复执行] → 增加执行前校验、并发锁与操作审计。

## Migration Plan

1. 先在应用存储库增加企业微信目录镜像表和同步游标表。
2. 实现 `appToken` 获取与部门、用户、用户部门变更的增量拉取服务。
3. 实现内部同步任务入口与状态查询。
4. 增加生产环境一键同步脚本，并将脚本调用收口到同一同步服务。
5. 将 `resolveSender` 接入“CRM 原生映射优先，镜像兜底”的识别顺序。
6. 更新机器人未识别提示文案，在镜像存在但仍未命中时提示更具体的排障方向。

回退策略：

- 若镜像同步逻辑上线后异常，可关闭镜像兜底识别，仅保留 CRM 原生映射；
- 已落库的镜像表可以保留，不影响 CRM 主库；
- 同步任务可单独关闭，不影响已实现的机器人接收与回复能力。
- 一键同步脚本可单独停用，不影响定时任务和状态查询。

## Open Questions

- `POST /organizational/listDepartmentByTime` 的 `params` body 字段具体是否必须，以及需要传入哪些组织维度参数？
- `uiduserid` 是否总是与企业微信消息回调中的 `from.userid` 完全一致，还是需要做大小写或前缀归一化？
- 当手机号和邮箱都能匹配多个 CRM `users` 记录时，是否允许配置人工白名单规则？
- 是否需要把镜像同步状态展示到治理后台，而不只是内部接口？
- 生产环境一键同步脚本最终是直接调用内部 API，还是后端内置命令模式更适合当前部署方式？

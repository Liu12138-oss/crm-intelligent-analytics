## Why

当前企业微信机器人已经能接收并回复消息，但真实用户仍频繁被拦在“未绑定 CRM 身份”这一步。根因不是机器人链路本身，而是 CRM 侧 `wx_users`、`wx_user_maps` 等企业微信组织架构相关表大概率没有同步或没有建立有效映射，导致机器人拿到企业微信 `userid` 后无法解析成可用的 CRM 用户。

现在需要补一条独立的企业微信组织架构同步能力，把外部 EMM 平台中的部门、用户和用户部门变更增量同步到应用侧镜像，并在身份识别中增加手机号 / 邮箱兜底解析，避免机器人长期卡在“未绑定 CRM 身份”的不可用状态。

## What Changes

- 新增企业微信组织架构同步接入能力，使用外部 EMM API 的应用访问令牌和增量同步接口，拉取部门、用户及用户部门变更数据。
- 新增应用侧企业微信目录镜像表，保存同步得到的组织、部门、用户和变更游标，不向 CRM 业务库写入任何数据。
- 新增企业微信目录同步任务与重跑入口，支持首次全量初始化、增量拉取、分页续拉、失败重试和同步状态审计。
- 新增生产环境一键同步脚本或运维入口，在发现企业微信组织架构未同步时可立即人工触发目录同步。
- 新增机器人身份识别兜底策略：当 CRM 内 `wx_user_maps` 未命中时，可使用应用侧镜像中的 `userid`、手机号、邮箱尝试匹配 CRM `users` 主体。
- 新增企业微信目录同步与身份解析的治理与排障口径，确保能回答“上次同步到什么时候”“某个 userid 为什么没被识别”。

## Capabilities

### New Capabilities

- `wecom-directory-sync`: 定义企业微信组织、部门、用户和用户部门变更的增量同步、分页拉取、游标管理和失败恢复要求。
- `wecom-identity-fallback-resolution`: 定义机器人身份识别在 `wx_user_maps` 未命中时，基于同步镜像中的 `userid`、手机号、邮箱做兜底匹配的要求。
- `wecom-directory-sync-observability`: 定义同步任务状态、游标、失败原因、命中来源和人工排障所需的审计与查询要求。
- `wecom-directory-sync-operations`: 定义生产环境一键同步脚本、手动触发入口、执行前校验与同步完成反馈要求。

### Modified Capabilities

无。

## Impact

- 影响后端 `backend/src/modules/wecom/*`、`backend/src/modules/auth/*` 与 `backend/src/database/app-storage/migrations/*`。
- 影响应用存储模型，需要新增企业微信目录镜像表、同步游标和同步日志表。
- 影响机器人身份识别逻辑，需要在现有 `wx_user_maps -> users.id` 之外增加应用侧镜像兜底路径。
- 影响运维脚本与内部运维入口，需要补充“发现未同步时立即执行”的标准操作方式。
- 依赖外部 EMM API：`POST /auth/appToken`、`POST /organizational/listDepartmentByTime`、`POST /organizational/listUserByTime`、`POST /organizational/listUserDeptChangeByTime`。
- 必须遵守当前仓库的只读约束：不同步写回 CRM 业务库，不直接修改 CRM 内部 `wx_*` 表。

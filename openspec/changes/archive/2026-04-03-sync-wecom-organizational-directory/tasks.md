## 1. 外部 EMM API 接入

- [x] 1.1 扩展 `backend/.env.example`，新增 EMM API 基础地址、应用访问令牌参数、初始同步时间和分页参数占位。
- [x] 1.2 扩展 `backend/src/shared/config/local-runtime-config.service.ts`，装载 EMM API 访问所需运行时配置。
- [x] 1.3 在 `backend/src/modules/wecom/` 下新增 EMM 应用令牌服务，封装 `POST /auth/appToken` 与令牌缓存。
- [x] 1.4 在 `backend/src/modules/wecom/` 下新增部门增量客户端，封装 `POST /organizational/listDepartmentByTime`。
- [x] 1.5 在 `backend/src/modules/wecom/` 下新增用户增量客户端，封装 `POST /organizational/listUserByTime`。
- [x] 1.6 在 `backend/src/modules/wecom/` 下新增用户部门变更客户端，封装 `POST /organizational/listUserDeptChangeByTime`。

## 2. 应用侧镜像存储

- [x] 2.1 为应用存储库新增 `wecom_sync_departments` 表，更新 `backend/src/database/app-storage/migrations/`。
- [x] 2.2 为应用存储库新增 `wecom_sync_users` 表，更新 `backend/src/database/app-storage/migrations/`。
- [x] 2.3 为应用存储库新增 `wecom_sync_user_dept_changes` 表，更新 `backend/src/database/app-storage/migrations/`。
- [x] 2.4 为应用存储库新增 `wecom_sync_checkpoints` 与 `wecom_sync_runs` 表，更新 `backend/src/database/app-storage/migrations/`。
- [x] 2.5 新增企业微信部门镜像仓储，落点 `backend/src/modules/wecom/`。
- [x] 2.6 新增企业微信用户镜像仓储，落点 `backend/src/modules/wecom/`。
- [x] 2.7 新增企业微信用户部门变更仓储，落点 `backend/src/modules/wecom/`。
- [x] 2.8 新增同步游标与同步运行日志仓储，落点 `backend/src/modules/wecom/`。

## 3. 目录同步任务

- [x] 3.1 实现部门目录同步服务，支持首次初始化、分页增量拉取和 `department` 游标推进。
- [x] 3.2 实现用户目录同步服务，支持分页增量拉取并保存 `uiduserid`、手机号、邮箱、部门信息。
- [x] 3.3 实现用户部门变更同步服务，支持分页增量拉取和事件落库。
- [x] 3.4 为同步服务增加“成功分页后更新 candidate cursor、整轮成功后提交 committed cursor”的保护逻辑。
- [x] 3.5 提供内部手动触发入口，用于触发部门 / 用户 / 用户部门变更同步。
- [x] 3.6 提供最近一次同步状态查询入口，用于查看游标、成功时间和失败原因。
- [x] 3.7 提供生产环境一键同步脚本，统一触发目录同步服务，而不是手工调用外部分页接口。

## 4. 机器人身份识别兜底

- [x] 4.1 改造 `backend/src/database/crm-readonly/crm-readonly.service.ts`，保持 CRM 原生 `wx_user_maps` 优先。
- [x] 4.2 在 `backend/src/modules/wecom/wecom-auth.service.ts` 或相关识别层增加镜像用户详情查询入口。
- [x] 4.3 增加手机号兜底识别：`wecom_sync_users.phone -> users.phone`。
- [x] 4.4 增加邮箱兜底识别：`wecom_sync_users.email -> users.email`。
- [x] 4.5 为多命中、缺字段和未命中场景增加拒绝放行与明确错误口径。
- [x] 4.6 为机器人身份识别增加命中来源审计：`crm-wx-map`、`mirror-userid`、`mirror-phone`、`mirror-email`、`unresolved`、`ambiguous`。

## 5. 观测、审计与排障

- [x] 5.1 为每轮同步任务记录开始时间、结束时间、成功状态、游标、分页统计和失败原因。
- [x] 5.2 区分“成功但无增量”和“同步失败”两类状态，避免误导排障。
- [x] 5.3 提供最近一次同步状态查询能力，至少可查看部门、用户、用户部门变更三类任务的最后成功时间与失败原因。
- [x] 5.4 为生产环境一键同步脚本和内部触发入口增加运维审计记录。

## 6. 测试与文档

- [x] 6.1 新增 EMM API 客户端与同步逻辑的契约 / 集成测试，覆盖令牌获取、分页增量、游标推进和失败恢复。
- [x] 6.2 新增机器人身份兜底识别测试，覆盖 `userid`、手机号、邮箱命中，以及多命中 / 未命中场景。
- [x] 6.3 更新 `docs/需求文档/企业微信机器人.md`，补充企业微信目录同步与身份兜底识别说明。
- [x] 6.4 更新相关 OpenSpec / quickstart 文档，补充同步任务的联调与验收步骤。
- [x] 6.5 为生产环境一键同步脚本补充操作说明与执行前校验清单。

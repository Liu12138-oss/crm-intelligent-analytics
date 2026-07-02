## 1. 官方通讯录配置与客户端

- [x] 1.1 扩展 `backend/.env.example` 与 `backend/.env.local`，新增企业微信官方通讯录同步配置并删除 `EMM_API_*` 配置。
- [x] 1.2 扩展 `backend/src/shared/config/local-runtime-config.service.ts`，新增企业微信官方通讯录同步运行时配置并移除 EMM 配置装载。
- [x] 1.3 在 `backend/src/modules/wecom/` 下新增企业微信官方 token 客户端，封装 `gettoken`。
- [x] 1.4 在 `backend/src/modules/wecom/` 下新增部门列表客户端，封装 `department/list`。
- [x] 1.5 在 `backend/src/modules/wecom/` 下新增部门成员详情客户端，封装 `user/list`。
- [x] 1.6 在 `backend/src/modules/wecom/` 下新增成员详情客户端，封装 `user/get`。

## 2. 官方目录同步替换

- [x] 2.1 改造目录同步服务，使用企业微信官方 API 替换 EMM 调用。
- [x] 2.2 改造同步入口与一键同步脚本，默认只同步“联软科技集团”授权范围。
- [x] 2.3 将同步运行状态和执行摘要的来源统一改成企业微信官方 API。

## 3. 身份识别切换

- [x] 3.1 改造机器人身份识别逻辑，优先以企业微信原生 `userid` 命中镜像成员。
- [x] 3.2 保留 CRM `wx_user_maps` 优先级，但删除对 EMM `uiduserid` 的依赖。
- [x] 3.3 继续保留手机号 / 邮箱 兜底识别，并明确“userid 未命中镜像”的错误口径。

## 4. 移除 EMM 方案

- [x] 4.1 删除 EMM 客户端、类型定义、脚本与相关同步逻辑。
- [x] 4.2 删除 `EMM_API_*`、`EMM_SYNC_*` 配置及其文档说明。
- [x] 4.3 更新模块装配，移除 EMM 相关 provider / import / 测试。

## 5. 测试与文档

- [x] 5.1 新增或更新企业微信官方通讯录同步测试，覆盖 token、部门、成员、成员详情补齐。
- [x] 5.2 更新机器人身份识别测试，验证 `from.userid` 可直接命中镜像成员。
- [x] 5.3 更新企业微信运维文档与 quickstart，改为企业微信官方 API 同步说明。

## Why

当前 EMM 目录同步虽然能够拉到用户数据，但企业微信消息回调中的 `from.userid` 与 EMM 同步结果中的 `uiduserid` 并不是同一套标识，导致机器人身份识别无法稳定把企业微信发送者解析成 CRM 用户。继续围绕 EMM 做兜底，只会把同步和识别逻辑变得更复杂，却无法从根上解决标识不一致的问题。

企业微信官方通讯录 API 可以直接基于企业微信原生 `userid` 读取成员、部门和部门成员详情，更契合机器人消息回调里已经拿到的数据。因此需要彻底替换 EMM 目录同步方案，改为企业微信官方通讯录 API，并移除 EMM 相关配置、脚本和代码。

## What Changes

- 新增基于企业微信官方通讯录 API 的组织架构同步能力，使用企业微信 `access_token` 获取部门列表、部门成员详情和成员详情。
- 新增基于企业微信官方 `userid` 的身份识别同步路径，直接围绕消息回调中的 `from.userid` 建模，不再依赖 EMM 的 `uiduserid`。
- 移除 EMM 目录同步相关配置、客户端、同步服务、脚本和文档说明。
- 调整生产运维方式：当发现目录未同步时，改为执行企业微信官方 API 的一键同步脚本或内部同步入口。

## Capabilities

### New Capabilities

- `wecom-official-directory-sync`: 定义企业微信官方通讯录 API 的部门、成员、部门成员详情同步要求。
- `wecom-official-identity-resolution`: 定义基于企业微信官方 `userid` 的身份识别和 CRM 映射要求。
- `wecom-official-sync-operations`: 定义生产环境一键同步脚本、内部同步入口和执行摘要要求。

### Modified Capabilities

- `wecom-directory-sync-observability`: 将同步状态、游标和运维审计的来源从 EMM 调整为企业微信官方 API。

## Impact

- 影响后端 `backend/src/modules/wecom/*`、`backend/src/shared/config/*` 与相关同步脚本。
- 影响本地与生产环境配置，需要从 `EMM_API_*` 切换到企业微信官方通讯录配置。
- 影响文档，需要删除 EMM 目录同步说明，改写为企业微信官方 API 同步说明。
- 需要清理已完成但已不再采用的 `sync-wecom-organizational-directory` 实现引用，避免两套目录同步并存。

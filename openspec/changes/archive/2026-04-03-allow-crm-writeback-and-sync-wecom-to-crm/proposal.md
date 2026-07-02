## Why

当前仓库和一期规格默认把“CRM 全局只读”作为系统总约束，但业务方向已经明确变化：后续不仅要支持查询，还要逐步支持写入型能力。如果继续保留“全局只读”表述，后续所有能力设计都会与真实目标冲突。

同时，企业微信机器人当前仍频繁停在“未绑定 CRM 身份”，根因不是机器人链路本身，而是企业微信目录同步没有正式写回 CRM 原生 `wx_users`、`wx_user_maps` 等映射表，导致机器人拿到 `from.userid` 后无法沿用 CRM 现有映射链完成认证。

## What Changes

- **BREAKING**：删除“CRM 全局只读”这一系统级总约束，改为“不同业务链路按能力边界分别定义读写权限”。
- 保留分析问数链路的受控查询、安全校验和审计要求，但不再将其上升为整个系统的全局只读约束。
- 新增企业微信目录同步正式写回 CRM 原生 `wx_*` 表的能力，目标表至少包括 `wx_users`、`wx_user_maps`，并根据需要补齐 `wx_departments`、`wx_user_department_maps`、`wx_organization_maps`。
- 新增基于企业微信官方通讯录接口的 CRM 原生映射同步链路：拉取部门成员 `userid/mobile/email`，同步到 CRM，并按手机号/邮箱唯一匹配 `users` 生成 `wx_user_maps`。
- 调整企业微信机器人认证策略，优先依赖 CRM 原生 `wx_user_maps -> wx_users` 映射链，不再把应用侧内存镜像作为长期认证主来源。
- 调整生产运维方式：当发现组织架构未同步或机器人持续提示未绑定 CRM 身份时，执行企业微信到 CRM 原生映射的一键同步。

## Capabilities

### New Capabilities
- `crm-writeback-boundary`: 定义系统级“非全局只读”边界，明确分析链路、同步链路及后续写入链路的权限范围与约束。
- `wecom-crm-native-directory-sync`: 定义企业微信官方通讯录到 CRM 原生 `wx_*` 表的部门与成员同步要求。
- `wecom-crm-native-identity-mapping`: 定义基于手机号/邮箱唯一匹配 CRM `users` 并生成 `wx_user_maps` 的规则与冲突处理要求。
- `wecom-crm-native-sync-operations`: 定义生产环境一键同步入口、执行前校验、执行摘要与排障要求。

### Modified Capabilities

## Impact

- 影响规格与文档：`README.md`、`AGENTS.md`、`specs/001-crm-intelligent-analytics/` 下关于“CRM 全局只读”的表述需要统一调整。
- 影响后端模块：`backend/src/modules/wecom/*`、`backend/src/database/crm-readonly/*`、同步脚本与运维入口。
- 影响数据写入边界：目录同步不再只写应用侧镜像，而是受控写入 CRM 原生 `wx_*` 映射表。
- 影响机器人认证：企业微信发送者识别将以 CRM 原生映射链为主，应用侧镜像兜底将被弱化或下线。

## ADDED Requirements

### Requirement: 机器人身份识别必须优先使用企业微信原生 userid
系统在处理企业微信机器人消息时，必须优先使用消息回调中的 `from.userid` 作为用户镜像主键进行识别，而不是继续依赖 EMM 的 `uiduserid`。

#### Scenario: 回调 userid 命中镜像用户
- **WHEN** 企业微信消息中的 `from.userid` 在应用侧镜像用户表中存在
- **THEN** 系统必须直接使用该镜像用户进入后续 CRM 识别流程

### Requirement: 成员镜像必须支持手机号与邮箱兜底映射 CRM 用户
系统在企业微信原生 `userid` 命中镜像用户后，若 CRM 原生 `wx_user_maps` 未命中，必须支持用镜像中的手机号和邮箱匹配 CRM `users.phone` / `users.email`。

#### Scenario: 手机号唯一匹配 CRM 用户
- **WHEN** 镜像用户手机号唯一匹配 CRM `users.phone`
- **THEN** 系统必须将该用户识别为对应 CRM 用户

#### Scenario: 邮箱唯一匹配 CRM 用户
- **WHEN** 镜像用户邮箱唯一匹配 CRM `users.email`
- **THEN** 系统必须将该用户识别为对应 CRM 用户

### Requirement: 多命中与未命中不得自动放行
当手机号或邮箱匹配多个 CRM 用户，或镜像中根本没有对应企业微信 `userid` 时，系统不得自动选择任意用户放行。

#### Scenario: 企业微信 userid 未命中镜像
- **WHEN** 企业微信消息中的 `from.userid` 在当前同步后的镜像表中不存在
- **THEN** 系统必须返回明确的未绑定提示，并指出目录同步或授权范围可能存在问题

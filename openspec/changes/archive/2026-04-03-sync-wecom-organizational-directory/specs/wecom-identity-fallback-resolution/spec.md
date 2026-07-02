## ADDED Requirements

### Requirement: 机器人身份识别必须优先使用 CRM 原生企业微信映射
系统在处理企业微信机器人消息时，必须优先使用 CRM 主库中的 `wx_user_maps + wx_users` 完成发送者到 `users.id` 的身份解析。只有当原生映射未命中时，才允许进入应用侧镜像兜底路径。

#### Scenario: CRM 原生映射命中
- **WHEN** 企业微信发送者 `userid` 能在 CRM `wx_users` 和 `wx_user_maps` 中找到有效映射
- **THEN** 系统必须直接使用该 CRM 主体进入后续权限判断，而不再继续走镜像兜底匹配

#### Scenario: CRM 原生映射未命中
- **WHEN** 企业微信发送者 `userid` 在 CRM `wx_users` 或 `wx_user_maps` 中未命中
- **THEN** 系统必须进入应用侧镜像兜底识别流程

### Requirement: 镜像兜底识别必须支持 userid、手机号、邮箱三层匹配
系统在镜像兜底识别中，必须按以下顺序匹配：

1. `wecom_sync_users.uiduserid -> CRM users`
2. `wecom_sync_users.phone -> CRM users.phone`
3. `wecom_sync_users.email -> CRM users.email`

任一匹配成功后，系统必须返回对应 CRM 用户主体并记录命中来源。

#### Scenario: 手机号兜底识别成功
- **WHEN** 企业微信发送者 `userid` 未在 CRM 原生映射中命中，但其镜像用户的手机号能唯一匹配 CRM `users.phone`
- **THEN** 系统必须使用该手机号匹配结果完成身份识别，并记录命中来源为 `phone`

#### Scenario: 邮箱兜底识别成功
- **WHEN** 企业微信发送者 `userid` 未在 CRM 原生映射与手机号匹配中命中，但其镜像用户邮箱能唯一匹配 CRM `users.email`
- **THEN** 系统必须使用该邮箱匹配结果完成身份识别，并记录命中来源为 `email`

#### Scenario: CRM 原生映射优先于镜像兜底
- **WHEN** 同一个企业微信发送者既能命中 CRM 原生 `wx_user_maps`，也能通过镜像手机号或邮箱匹配到 CRM 用户
- **THEN** 系统必须优先采用 CRM 原生映射结果，并记录命中来源为 `crm-wx-map`

### Requirement: 多命中或无命中的兜底识别不得自动放行
当镜像兜底识别出现多命中、无命中或关键字段缺失时，系统不得自动选择任意 CRM 用户放行。此类情况必须返回明确的未绑定或待人工处理结果。

#### Scenario: 手机号匹配多个 CRM 用户
- **WHEN** 企业微信镜像用户手机号匹配到多个 CRM `users` 记录
- **THEN** 系统必须拒绝自动识别，并返回需要人工确认绑定的结果

#### Scenario: 镜像中没有手机号和邮箱
- **WHEN** 企业微信镜像用户存在，但未同步到手机号和邮箱
- **THEN** 系统必须返回未识别结果，并记录缺失字段原因

#### Scenario: 镜像用户不存在
- **WHEN** 企业微信发送者在 CRM 原生映射和应用镜像中都不存在
- **THEN** 系统必须返回未识别结果，并记录失败原因是目录未同步或镜像缺失

## ADDED Requirements

### Requirement: 系统必须基于手机号和邮箱唯一匹配生成 `wx_user_maps`
系统在完成 `wx_users` 写回后，必须基于企业微信成员的手机号和邮箱与 CRM `users` 做唯一匹配，并在唯一命中时生成或更新 CRM 原生 `wx_user_maps`。

#### Scenario: 手机号唯一命中时自动绑定
- **WHEN** 某个企业微信成员的手机号在 CRM `users.phone` 中唯一命中
- **THEN** 系统必须为该成员生成或更新 `wx_user_maps`
- **THEN** 系统必须将 `wx_user_maps.wx_user_id` 指向对应 `wx_users.id`
- **THEN** 系统必须将 `wx_user_maps.user_id` 指向唯一命中的 `users.id`

#### Scenario: 邮箱唯一命中时自动绑定
- **WHEN** 某个企业微信成员手机号未命中且邮箱在 CRM `users.email` 中唯一命中
- **THEN** 系统必须为该成员生成或更新 `wx_user_maps`
- **THEN** 系统必须记录本次绑定来源为邮箱唯一匹配

### Requirement: 非唯一或字段缺失时不得自动绑定
系统不得在手机号或邮箱多命中、零命中或字段缺失时自动生成错误映射。此类情况必须保留可观测结果，并等待后续人工处理或下一轮同步。

#### Scenario: 手机号和邮箱均缺失
- **WHEN** 企业微信成员未返回手机号且未返回邮箱
- **THEN** 系统必须写入或更新 `wx_users`
- **THEN** 系统不得自动生成 `wx_user_maps`
- **THEN** 系统必须在同步摘要中将该成员标记为“缺少绑定字段”

#### Scenario: 多命中冲突
- **WHEN** 企业微信成员手机号或邮箱匹配到多个 CRM 用户
- **THEN** 系统不得自动生成或覆盖 `wx_user_maps`
- **THEN** 系统必须记录冲突原因、候选 CRM 用户数量和成员 `userid`

#### Scenario: 已有映射与新匹配结果冲突
- **WHEN** 某个企业微信成员已存在 `wx_user_maps`，但新一轮唯一匹配到不同的 CRM `users.id`
- **THEN** 系统不得静默覆盖原映射
- **THEN** 系统必须将该情况记录为待人工确认的冲突

### Requirement: 机器人必须继续优先复用 CRM 原生映射链认证
企业微信机器人认证必须继续优先通过 CRM 原生 `wx_user_maps -> wx_users` 完成发送者到 `users.id` 的解析，不得把应用侧镜像兜底继续作为长期认证主来源。

#### Scenario: 原生映射已存在时直接认证
- **WHEN** 企业微信机器人收到某成员消息，且该成员已在 CRM `wx_user_maps -> wx_users` 中形成有效映射
- **THEN** 系统必须直接命中该 CRM 用户并继续后续问数或业务处理链路
- **THEN** 系统不得再要求该成员重新绑定

## ADDED Requirements

### Requirement: 系统必须将企业微信成员同步写回 CRM 原生 `wx_users`
系统必须使用企业微信官方通讯录接口拉取授权范围内的部门成员信息，并将成员主数据写回 CRM 原生 `wx_users` 表。同步链路必须以企业微信原生 `userid` 作为成员主键，不得再围绕非原生标识做主路径建模。

#### Scenario: 拉取授权范围内全部成员
- **WHEN** 生产或开发环境执行企业微信目录同步
- **THEN** 系统必须使用现有项目凭证获取企业微信 `access_token`
- **THEN** 系统必须基于授权范围递归拉取目标组织下全部部门成员
- **THEN** 系统必须按 `userid` 去重后形成完整成员集合

#### Scenario: 写回 CRM 原生成员表
- **WHEN** 成员集合已完成标准化
- **THEN** 系统必须将 `userid`、`name`、`mobile`、`email`、`tel`、`position`、`status`、`extattr` 等字段写入 CRM `wx_users`
- **THEN** 系统必须以 `(wx_organization_id, userid)` 作为幂等键进行新增或更新
- **THEN** 系统必须保留本次同步时间与原始字段快照，便于后续排障

### Requirement: 系统必须优先复用已验证的企业微信通讯录拉取链路
系统首版目录同步必须优先复用已验证可用的企业微信通讯录拉取方式，与现有 `get_userid.py` 的接口路径保持一致，避免在字段可得性上引入新的不确定性。

#### Scenario: 对齐已验证接口顺序
- **WHEN** 系统执行企业微信目录同步
- **THEN** 系统必须优先采用 `gettoken -> department/simplelist -> user/list` 作为主链路
- **THEN** 系统仅在补齐必要字段时才可追加 `user/get`

#### Scenario: 保留授权范围限制
- **WHEN** 系统在生产环境执行一键同步
- **THEN** 系统必须默认只同步“联软科技集团”授权范围
- **THEN** 系统不得默认同步 ROOT 全量组织树

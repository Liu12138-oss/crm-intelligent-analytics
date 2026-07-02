## ADDED Requirements

### Requirement: 企业微信新增客户链路必须校验 wecom.customer.create
系统 MUST 在企业微信新增客户入口、字段采集完成后的确认执行、失败重试以及对应受控客户创建 HTTP 入口上校验 `wecom.customer.create`。用户即使已经通过企业微信通道准入，也不得因为拥有其它 `wecom.*` 动作而自动获得新增客户能力。

#### Scenario: 缺少 wecom.customer.create 的用户不能进入新增客户链路
- **WHEN** 某用户已通过企业微信通道准入，但未被授予 `wecom.customer.create`，并发送“新增客户”
- **THEN** 系统必须拒绝进入新增客户字段采集流程
- **THEN** 不得为其创建客户草稿或进入摘要确认阶段

#### Scenario: 直接调用客户创建接口也必须命中 wecom.customer.create
- **WHEN** 某个已登录用户未被授予 `wecom.customer.create`，但直接调用受控客户创建接口
- **THEN** 系统必须拒绝该请求
- **THEN** 不得因为请求绕过了企业微信消息入口就跳过权限校验

### Requirement: 新增客户草稿在确认执行时必须再次校验实时权限
系统 MUST 在客户草稿已生成后、真正调用 CRM 创建接口前再次校验当前用户是否仍具备 `wecom.customer.create`。若权限在草稿生成后被撤销，系统 MUST 拒绝最终创建，并保留草稿与失败原因，允许管理员排障或用户在重新授权后重试。

#### Scenario: 草稿生成后权限被撤销时最终创建被阻断
- **WHEN** 某用户先生成了客户创建草稿，后续在点击确认或发送确认回复前被撤销 `wecom.customer.create`
- **THEN** 系统必须拒绝最终创建动作
- **THEN** 系统必须保留当前草稿和明确的权限不足原因

## ADDED Requirements

### Requirement: 企业微信新增商机链路必须校验 wecom.opportunity.create
系统 MUST 在企业微信新增商机入口、字段补齐后的确认执行、失败重试以及对应受控商机创建 HTTP 入口上校验 `wecom.opportunity.create`。用户即使已被允许使用企业微信机器人，也不得因为拥有其它 `wecom.*` 动作而获得新增商机资格。

#### Scenario: 缺少 wecom.opportunity.create 的用户不能进入新增商机链路
- **WHEN** 某用户已通过企业微信通道准入，但未被授予 `wecom.opportunity.create`，并发送“新增商机”
- **THEN** 系统必须拒绝进入新增商机字段采集流程
- **THEN** 不得为其创建商机草稿或进入确认阶段

#### Scenario: 直接调用商机创建接口也必须命中 wecom.opportunity.create
- **WHEN** 某个已登录用户未被授予 `wecom.opportunity.create`，但直接调用受控商机创建接口
- **THEN** 系统必须拒绝该请求
- **THEN** 不得因为该请求绕过了企业微信聊天入口就继续执行

### Requirement: 新增商机确认执行前必须再次校验实时权限
系统 MUST 在商机草稿已经补齐并等待确认时，于真正调用 CRM 创建接口前再次校验当前用户的 `wecom.opportunity.create`。若权限已被撤销，系统 MUST 中止创建，并保留草稿和失败原因。

#### Scenario: 草稿阶段权限撤销后最终创建被阻断
- **WHEN** 某用户已经生成商机草稿，但在确认前被撤销 `wecom.opportunity.create`
- **THEN** 系统必须拒绝最终商机创建
- **THEN** 系统必须保留草稿状态和权限不足原因，供后续重试或排障

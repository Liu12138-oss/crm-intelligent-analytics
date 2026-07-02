## ADDED Requirements

### Requirement: 企业微信跟进写回链路必须校验 wecom.followup.writeback
系统 MUST 在企业微信跟进草稿创建、意图确认、内容补充、最终写回执行、失败后重试和重复确认拦截阶段校验 `wecom.followup.writeback`。企业微信用户即使具备问数能力，也不得因为已进入同一会话而自动获得跟进写回资格。

#### Scenario: 缺少 wecom.followup.writeback 的用户不能创建跟进写回草稿
- **WHEN** 某用户已通过企业微信通道准入，但未被授予 `wecom.followup.writeback`，并尝试发起跟进写回
- **THEN** 系统必须拒绝创建跟进写回草稿
- **THEN** 不得把该用户推进到对象确认、内容确认或最终写回阶段

#### Scenario: 已有草稿但权限被撤销时最终写回被阻断
- **WHEN** 某用户已经拥有待确认的跟进写回草稿，但在最终确认前被撤销 `wecom.followup.writeback`
- **THEN** 系统必须拒绝本次最终写回
- **THEN** 系统必须保留草稿与失败原因，不得误记为写回成功

### Requirement: 跟进写回拒绝与重试必须写入统一权限拒绝审计
系统 MUST 为因缺少 `wecom.followup.writeback` 导致的草稿创建失败、最终执行失败和重试失败写入统一权限拒绝审计，记录目标对象、草稿 ID、当前会话、权限点和拒绝原因。

#### Scenario: 写回确认阶段因权限不足失败时写入审计
- **WHEN** 某用户在确认跟进写回时因缺少 `wecom.followup.writeback` 被拒绝
- **THEN** 系统必须写入一条权限拒绝审计事件
- **THEN** 该审计事件必须能够关联到当前草稿和目标对象

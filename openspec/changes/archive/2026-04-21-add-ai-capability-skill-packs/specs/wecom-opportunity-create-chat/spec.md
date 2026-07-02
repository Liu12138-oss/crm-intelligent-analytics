## ADDED Requirements

### Requirement: 新增商机入口必须消费 capability pack 的 idle / active task 结果
企业微信新增商机入口 MUST 消费统一 AI capability pack 输出的空闲态入口结果与活跃任务回复结果进入既有商机创建链路。只要 idle entry pack 已经将消息识别为 `CRM_CREATE_OPPORTUNITY`，系统 MUST 直接进入受控新建商机流程，不得因为无关可选字段缺失而回落帮助兜底；进入商机创建流程后的取消、切换、继续和确认语义 MUST 优先由 active task reply pack 识别。

#### Scenario: 空闲态新增商机入口直接进入创建流程
- **WHEN** 企业微信空闲会话收到 `新增商机`、`帮我建一个商机` 或语义等价表达，且 idle entry pack 返回 `CRM_CREATE_OPPORTUNITY`
- **THEN** 系统必须进入既有受控新建商机字段采集链路
- **THEN** 系统不得因为 capability pack 未返回 `helpScene` 或其它无关字段而进入帮助兜底

#### Scenario: 商机创建中的取消与切换优先由 active task pack 识别
- **WHEN** 用户已经处于商机创建流程中，并回复“先停一下”或“切到生成日报”
- **THEN** 系统必须优先消费 active task reply pack 的语义结果决定取消当前创建或切换任务
- **THEN** 系统不得继续仅依赖旧确认词表或局部关键词推进状态

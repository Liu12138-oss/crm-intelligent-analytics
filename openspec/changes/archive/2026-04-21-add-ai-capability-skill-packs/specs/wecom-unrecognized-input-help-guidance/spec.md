## ADDED Requirements

### Requirement: 无关可选字段缺失不得触发企业微信未识别帮助兜底
当企业微信空闲态入口分类已经返回可被 capability pack 归一化并通过条件校验的结果时，系统 MUST 将其视为已识别输入，不得因为无关可选字段缺失而进入未识别帮助兜底。只有当 capability pack 明确返回 `NONE`、归一化失败、条件校验失败或 AI 主链不可用时，系统才 MAY 返回统一帮助提示。

#### Scenario: 跟进商机不再因 helpScene 缺失而回帮助
- **WHEN** 模型对 `跟进商机` 返回 `DAILY_REPORT` 且 `dailyReportPrompt` 合法，但未返回 `helpScene`
- **THEN** 系统必须按已识别日报/跟进入口继续处理
- **THEN** 系统不得把该消息误判为未识别输入并返回帮助能力清单

#### Scenario: 你好不再因日报字段缺失而回未识别错误
- **WHEN** 模型对 `你好` 返回 `HELP_GUIDANCE` 且 `helpScene` 合法，但未返回日报或查询相关字段
- **THEN** 系统必须直接返回帮助开场
- **THEN** 系统不得因为缺少 `dailyReportPrompt`、`leaderNameQuery` 或 `lookupText` 而触发未识别帮助兜底

#### Scenario: 新增客户不再因无关字段缺失而回帮助
- **WHEN** 模型对 `新增客户` 返回 `CRM_CREATE_CUSTOMER`，且未返回 `helpScene`、`dailyReportPrompt`、`leaderNameQuery` 或 `lookupText`
- **THEN** 系统必须进入既有受控新建客户链路
- **THEN** 系统不得把该消息误判为未识别输入并返回帮助能力清单

#### Scenario: 新增商机不再因无关字段缺失而回帮助
- **WHEN** 模型对 `新增商机` 返回 `CRM_CREATE_OPPORTUNITY`，且未返回 `helpScene`、`dailyReportPrompt`、`leaderNameQuery` 或 `lookupText`
- **THEN** 系统必须进入既有受控新建商机链路
- **THEN** 系统不得把该消息误判为未识别输入并返回帮助能力清单

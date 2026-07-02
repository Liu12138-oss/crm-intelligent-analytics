# wecom-unrecognized-input-help-guidance Specification

## Purpose
TBD - created by archiving change fix-wecom-unrecognized-input-help-guidance. Update Purpose after archive.
## Requirements
### Requirement: 空闲低置信或未识别输入必须返回统一帮助提示
当企业微信机器人处于空闲会话，且固定前置校验已通过，但统一 AI 理解层对用户消息返回低置信、不可用或 fallback 后仍无法安全确定当前工作流时，系统 MUST 返回统一帮助提示和当前已支持功能清单。系统 MUST 不得为这类未识别输入创建正式分析请求、商机直查写回草稿或日报采集状态。

#### Scenario: 空闲低置信短文本不再误查商机
- **WHEN** 空闲企业微信会话收到 `相关内`，且统一 AI 理解层无法安全识别其目标工作流
- **THEN** 系统必须返回统一帮助提示和当前已支持功能清单
- **THEN** 系统不得返回 `未按「相关内」查到商机记录`
- **THEN** 系统不得创建分析请求或待写回草稿

#### Scenario: 空闲非入口日报文本在低置信时不进入日报采集
- **WHEN** 空闲企业微信会话收到 `王文定小组日报`，且统一 AI 理解层未将其识别为已支持正式入口
- **THEN** 系统必须返回统一帮助提示和当前已支持功能清单
- **THEN** 系统不得追问用户主要跟进了哪些项目
- **THEN** 系统不得建立日报采集或跟进模板草稿

### Requirement: 空闲实体直查必须来自显式查询表达
当企业微信机器人处于空闲会话时，系统 MUST 只在用户明确表达查询公司、客户、项目或商机的意图时进入实体直查。系统 MUST 在查询前剥离常见查询前缀，并将剩余实体名称传给既有受控商机查询服务。系统 MUST 不得把没有查询动词或查询语义的孤立短句直接当成商机、项目或公司查询条件。

#### Scenario: 明确查询项目仍可直查
- **WHEN** 空闲企业微信会话收到 `查年度样本`
- **THEN** 系统可以把 `年度样本` 作为查询条件进入既有受控商机直查
- **THEN** 若查询结果不唯一，系统不得生成待写回草稿

#### Scenario: 裸项目名在活跃跟进任务里仍可用于定位
- **WHEN** 用户已经进入跟进模板或实体候选确认链路
- **WHEN** 用户回复一个模糊项目名或客户名
- **THEN** 系统必须继续按当前任务上下文执行受控模糊召回或候选选择
- **THEN** 系统不得因为空闲兜底规则而返回通用帮助

### Requirement: 低置信兜底不得吞掉明确支持入口
企业微信机器人 MUST 在返回空闲未识别帮助前，优先保留当前已支持的明确入口和问数链路。问候 / 能力询问、今日跟进、跟进商机、跟进客户、新增客户、新增商机、查看或生成今日日报、明确 CRM 受控问数、明确越界或写入阻断请求，仍 MUST 进入既有帮助、任务、分析或阻断链路。

#### Scenario: 受控问数继续执行
- **WHEN** 空闲企业微信会话收到 `本月各销售负责人新增商机金额排名`
- **THEN** 系统必须继续进入受控分析链路
- **THEN** 系统不得把该问题当成未识别输入直接返回帮助

#### Scenario: 明确日报预览入口继续执行
- **WHEN** 空闲企业微信会话收到 `生成日报`
- **THEN** 系统必须继续进入个人今日日报预览链路
- **THEN** 系统不得把该入口当成未识别输入直接返回帮助

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


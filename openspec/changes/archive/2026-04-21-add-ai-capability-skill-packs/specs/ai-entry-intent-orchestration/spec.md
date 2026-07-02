## ADDED Requirements

### Requirement: 统一 AI 入口理解必须通过 capability pack 驱动
系统 MUST 将企业微信空闲态入口分类、活跃任务回复分类、Web 分析意图识别和追问分流统一迁移到应用层 `AI capability pack` 运行时。`AiGatewayService` 与后续入口编排服务 MUST 仅负责选择能力包、传入上下文、消费归一化后的结构化结果和执行固定程序路由，不得继续在业务服务中直接维护完整 prompt、few-shot 与 provider 差异。

#### Scenario: 企业微信空闲态入口通过专用 pack 识别
- **WHEN** 企业微信空闲会话收到业务自然语言输入
- **THEN** 系统必须通过企业微信空闲态入口 capability pack 进行分类
- **THEN** 业务层只允许消费归一化后的结构化结果决定后续固定程序

#### Scenario: 活跃任务回复通过专用 pack 识别
- **WHEN** 企业微信会话已经处于跟进、日报或创建等活跃任务状态
- **THEN** 系统必须通过活跃任务回复 capability pack 识别取消、切换、继续、修改或确认语义
- **THEN** 业务层不得继续在任务状态机里直接拼装完整分类 prompt

#### Scenario: Web 首次问数通过 analysis intent pack 识别
- **WHEN** Web 用户提交新的经营分析问题
- **THEN** 系统必须通过 analysis intent capability pack 识别该输入属于受控问数、阻断、澄清或其它分析入口语义
- **THEN** 业务层不得继续在分析入口服务中直接维护完整 prompt 与 provider 差异

#### Scenario: Web 解释追问与改条件追问通过 analysis follow-up pack 分流
- **WHEN** Web 或企业微信用户在已有结果后继续输入解释型追问或改条件追问
- **THEN** 系统必须通过 analysis follow-up capability pack 判断当前输入属于 `EXPLAIN_RESULT` 还是 `RUN_NEW_ANALYSIS`
- **THEN** 业务层不得继续分别在多个服务中硬编码这两类追问的分类 prompt

### Requirement: 统一 AI 入口 schema 必须采用最小公共 contract 与条件必填校验
统一 AI 入口理解 MUST 采用“最小公共 contract + 条件必填校验”模式。对于企业微信空闲态入口分类，系统 MUST 至少保证 `intent` 为必填公共字段；`helpScene`、`dailyReportPrompt`、`leaderNameQuery`、`lookupText` 等场景字段 MUST 按 `intent` 做条件必填校验，而不是作为所有意图的静态必填字段。

#### Scenario: DAILY_REPORT 只校验日报入口字段
- **WHEN** 模型将企业微信消息识别为 `DAILY_REPORT`
- **THEN** 系统必须只要求 `dailyReportPrompt` 这类与日报入口直接相关的字段满足条件必填
- **THEN** 系统不得因为未返回 `helpScene` 或 `lookupText` 而判定本次识别失败

#### Scenario: HELP_GUIDANCE 只校验帮助入口字段
- **WHEN** 模型将企业微信消息识别为 `HELP_GUIDANCE`
- **THEN** 系统必须只要求 `helpScene` 满足条件必填
- **THEN** 系统不得因为未返回 `dailyReportPrompt`、`leaderNameQuery` 或 `lookupText` 而判定本次识别失败

### Requirement: 统一 AI 入口快照必须记录 capability pack 元信息与失败语义
统一 AI 入口理解的审计快照 MUST 记录本次使用的 `packCode`、`packVersion`、`usedFallback`、`fallbackReason` 和 `validationFailureReason` 或等价字段。若 pack 被显式关闭、返回 `NONE`、条件校验失败或 provider 调用失败，上层快照 MUST 能区分具体失败类型，而不是统一收敛为模糊的帮助兜底结果。

#### Scenario: 企业微信入口快照可追溯具体 pack
- **WHEN** 企业微信 idle 或 active task 的一次 AI 理解完成
- **THEN** 审计快照必须能够看到本次使用的 `packCode` 与 `packVersion`
- **THEN** 后续排查必须能够区分这是哪个 capability pack 的结果

#### Scenario: fallback 快照保留 pack 失败语义
- **WHEN** 入口理解因 `PACK_DISABLED`、`PACK_NONE`、`PACK_VALIDATION_FAILED` 或 provider 错误进入 fallback
- **THEN** 审计快照必须保留对应失败语义
- **THEN** 系统不得把这些场景全部记录成同一个笼统的“帮助兜底”

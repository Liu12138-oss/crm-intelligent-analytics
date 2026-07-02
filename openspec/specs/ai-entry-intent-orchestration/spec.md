# ai-entry-intent-orchestration Specification

## Purpose
TBD - created by archiving change enforce-unified-ai-entry-understanding. Update Purpose after archive.
## Requirements
### Requirement: 所有业务自然语言输入必须先经过统一 AI 理解层

系统 MUST 在完成固定安全前置检查后，将企业微信机器人、Web 智能分析工作台以及后续相关自然语言业务入口中的自由文本输入统一送入 AI 理解层。统一 AI 理解层 MUST 先识别当前输入属于固定功能主题入口、自由自然语言问数、解释型追问、改条件追问、帮助、取消、切换任务、继续执行或阻断类请求，再将结果交给固定程序消费；系统不得继续让帮助词表、日报入口词表、创建入口关键词、项目查询正则或本地语义规则承担主理解链路。对于自由自然语言问数，统一 AI 理解层 MUST 支持完全自由表达，而不是要求用户只能按固定模板提问。

#### Scenario: 企业微信业务文本先进入统一 AI 理解层
- **WHEN** 企业微信消息已经通过签名校验、来源校验和基础结构校验，且消息正文属于业务自然语言输入
- **THEN** 系统必须先将该正文送入统一 AI 理解层
- **THEN** 系统不得在 AI 主链可用时直接跳过理解层并仅靠本地关键词决定帮助、日报、跟进、创建或分析路由

#### Scenario: Web 自由问数先由统一 AI 理解层判定固定功能或自由问数
- **WHEN** Web 用户提交一条自然语言输入，且该输入可能是固定功能主题入口、自由问数、解释追问或改条件追问
- **THEN** 系统必须先通过统一 AI 理解层识别当前输入属于哪一类目标工作流
- **THEN** 系统不得继续默认依赖本地中文词表或窄枚举规则直接决定主处理路径

#### Scenario: 自由问法不得被要求改写成固定模板才可进入问数
- **WHEN** 用户使用口语化、长句、中英混写、错别字或业务简称发起自然语言问数
- **THEN** 系统必须先尝试通过统一 AI 理解层识别该输入
- **THEN** 系统不得仅因未命中固定提问模板就直接要求用户重写为固定句式

### Requirement: 统一 AI 理解层必须输出受控结构化 schema
统一 AI 理解层 MUST 输出稳定、可审计、可校验的结构化 schema。该 schema MUST 至少包含 `scene`、`targetWorkflow`、`intent` 或 `replyIntent`、`structuredSlots`、`confidence`、`language`、`usedFallback`、`fallbackReason` 和 `blockReason`。固定程序 MUST 仅消费该 schema 做路由、补问、阻断或执行门闩判定；系统不得接受未通过 schema 校验的自由文本输出直接驱动执行。

#### Scenario: AI 返回合法结构化结果
- **WHEN** 系统对一条业务文本发起统一 AI 理解
- **THEN** AI 理解层必须返回满足 schema 的结构化结果
- **THEN** 固定程序必须基于该结构化结果决定下一步路由

#### Scenario: AI 返回非法结构时禁止直接执行
- **WHEN** AI 返回自由文本、缺失关键字段或结构不满足 schema
- **THEN** 系统必须拒绝将该结果直接用于执行
- **THEN** 系统必须进入最小安全 fallback，而不是伪造一个“看起来差不多”的路由结果

### Requirement: 文本语义理解与高风险执行确认必须分层
系统 MUST 将“语义理解”与“执行确认门闩”分层处理。统一 AI 理解层可以识别 `CONFIRM`、`CANCEL`、`MODIFY`、`CONTINUE`、`TASK_SWITCH` 或 `UNKNOWN` 等回复语义，但真正的写回、提交、创建、状态推进和其它高风险动作 MUST 继续由固定程序根据当前任务状态、草稿完整性、对象唯一性、权限与幂等约束做确定性门闩判断。系统不得让 AI 输出直接替代执行确认。

#### Scenario: 确认语义命中后仍需通过执行门闩
- **WHEN** 用户在跟进写回、创建客户、创建商机或其它高风险确认阶段回复“可以，按这个提交”
- **THEN** 系统必须先通过统一 AI 理解层识别该回复属于确认语义
- **THEN** 系统仍必须校验当前会话处于允许确认的状态后才可执行正式提交

#### Scenario: 歧义回复被识别为修改而不是直接确认
- **WHEN** 用户回复“好，但最后一段我想改一下”或其它同时包含确认与修改含义的表达
- **THEN** 系统必须优先将该回复识别为修改或继续澄清
- **THEN** 系统不得仅因命中“好”之类短词就直接推进高风险执行

### Requirement: AI 不可用时系统必须收敛到最小安全 fallback
当统一 AI 理解层不可用、超时、返回非法结构或当前场景置信度不足时，系统 MUST 进入最小安全 fallback。fallback 只允许返回帮助能力清单、请求用户澄清或明确阻断请求；系统不得继续使用旧的关键词表、正则或本地语义规则承担长期主理解链路，也不得把 fallback 结果伪装成 AI 主链成功。

#### Scenario: AI 超时后回退到帮助或澄清
- **WHEN** 统一 AI 理解层超时或网关不可用
- **THEN** 系统必须回退到帮助、澄清或阻断中的最小安全路径
- **THEN** 系统不得继续以旧规则主链直接判断日报、跟进、创建或查询路由

#### Scenario: fallback 命中必须留下明确标记
- **WHEN** 一条业务文本因为 AI 不可用或结构非法而走 fallback
- **THEN** 系统必须记录 `usedFallback=true` 和具体 `fallbackReason`
- **THEN** 审计侧必须能够区分该请求并非 AI 主链成功

### Requirement: 统一 AI 理解必须支持表达变体并形成审计快照

系统 MUST 支持对语义等价的多语言和表达变体进行统一理解，至少覆盖英文、中英混写、错别字、口语化中文、歧义短句以及首期批准范围内的常见外文表达。对于自由自然语言问数，系统 MUST 进一步支持用户围绕对象、时间、范围、排序、排行、趋势、分布、明细、比较和解释等维度进行完全自由表达，不得因为问题没有显式落在既有窄枚举指标 / 维度集合中就直接丢失主理解能力。系统 MUST 为每次理解过程记录审计快照，至少包含原始输入、入口渠道、语言、AI 结构化结果、目标工作流、置信度、fallback 情况和最终固定程序。

#### Scenario: 非纯中文自由问数仍能进入统一 AI 理解层
- **WHEN** 用户使用英文、中英混写、非标准中文或错别字描述同一经营分析意图
- **THEN** 系统必须先将该输入送入统一 AI 理解层
- **THEN** 系统不得因为未命中固定中文关键词就直接绕过 AI 或落入错误主链

#### Scenario: 自由问数可识别对象、时间和范围等最小语义
- **WHEN** 用户围绕客户、商机、合同、回款、负责人、区域、时间范围、排行、趋势、分布或明细进行自由问法提问
- **THEN** 系统必须能够从统一 AI 理解结果中提取这些最小受控语义
- **THEN** 系统不得把自由问数能力继续限定为只能识别少量固定指标和维度枚举

#### Scenario: 每次理解都留下可检索审计快照
- **WHEN** 一条业务文本完成统一 AI 理解并进入后续固定程序
- **THEN** 系统必须保存该次理解的审计快照
- **THEN** 审计侧必须能够检索“原始输入、AI 理解结果、fallback 原因和最终程序”四类关键信息

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

### Requirement: 自由问数 AI 入口必须输出标准时间槽
系统 MUST 在自由问数入口理解结果中输出标准时间槽 `temporalSlot` 或等价结构。该时间槽 MUST 至少包含用户原始时间表达、归一化标签、时区、粒度、相对 / 绝对时间类型、置信度，以及可执行时的 `startAt` 和 `endAt` 边界；当无法可靠解析时，必须输出无法解析原因，并不得伪造可执行时间范围。

#### Scenario: 最近四个月被归一为标准时间槽
- **WHEN** 用户输入“请分析一下最近四个月的商机情况”
- **THEN** 统一 AI 入口理解结果必须包含原始表达“最近四个月”
- **THEN** `temporalSlot` 必须给出可执行的起止边界、`Asia/Shanghai` 时区和 `month` 粒度

#### Scenario: 低置信时间表达不得直接执行
- **WHEN** 用户输入“从那段时间开始看一下商机情况”且当前上下文无法确定“那段时间”
- **THEN** 统一 AI 入口理解结果必须标记时间槽低置信或无法解析
- **THEN** 系统必须进入补问或阻断路径，不得继续用本地规则猜测时间范围并执行查询

### Requirement: 本地时间词表不得承担自由问数主理解链路
系统 MUST 将本地时间识别逻辑降级为测试辅助、迁移兼容或最小安全 fallback。自由问数主链可用时，系统 MUST 优先消费 AI 输出的标准时间槽；系统不得继续通过追加本地时间关键词、正则或枚举分支来承担主要自然语言时间理解。

#### Scenario: AI 主链可用时不使用本地词表决定时间范围
- **WHEN** `analysis-intent-pack` 返回合法 `temporalSlot`
- **THEN** 分析入口服务必须以该时间槽作为后续执行事实
- **THEN** 系统不得再用本地 `detectTimeRange` 或等价词表覆盖该时间槽

#### Scenario: AI 不可用时只允许最小安全 fallback
- **WHEN** AI 时间槽解析不可用、超时或结构非法
- **THEN** 系统可以返回澄清问题或安全阻断
- **THEN** 系统不得把本地时间词表识别结果伪装成 AI 主链成功

### Requirement: 自由自然语言问数必须输出最小受控语义抽取结果

统一 AI 理解层在自由自然语言问数场景下 MUST 输出“最小受控语义抽取结果”，供受控查询任务生成器消费。该结果 MUST 至少覆盖查询对象、时间范围、范围条件、排序或比较意图、结果形态偏好以及是否属于解释复用或重新取数。系统 MAY 继续为高频问数补充领域枚举或结构化槽位，但这些附加枚举不得成为自由问数主链的唯一入口 contract。

#### Scenario: 自由问数输出最小受控语义后再进入查询任务生成
- **WHEN** 用户提交一条自由自然语言问数
- **THEN** 统一 AI 理解层必须先输出最小受控语义抽取结果
- **THEN** 后续受控查询任务生成器必须消费该结果，而不是直接消费未经约束的原始自然语言

#### Scenario: 附加枚举缺失时仍可保留自由问数主链
- **WHEN** 用户问题中的某个业务指标、维度或表达方式尚未落入当前附加枚举集合
- **THEN** 系统仍必须尽量输出对象、时间、范围和结果意图等最小受控语义
- **THEN** 系统不得仅因为缺少附加枚举命中就直接宣布该问题不属于问数范围


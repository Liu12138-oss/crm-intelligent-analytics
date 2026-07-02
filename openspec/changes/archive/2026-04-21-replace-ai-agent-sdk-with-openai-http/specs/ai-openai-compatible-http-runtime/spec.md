## ADDED Requirements

### Requirement: 系统必须通过 OpenAI 兼容 HTTP 执行 AI 调用
系统 MUST 提供服务端 OpenAI 兼容 HTTP 运行时，用于替代 Agent SDK / 本地 CLI 型模型调用。该运行时 MUST 通过后端 HTTP 请求访问模型网关，默认使用 Responses 协议，并在配置声明时支持 Chat Completions 协议兼容；系统 MUST NOT 要求部署环境安装 `codex`、`claude` 或其它本地 Agent CLI 才能完成 Web 问数、企业微信 AI 理解或合同审核 AI 审查。

#### Scenario: 使用 Responses 协议执行文本调用
- **WHEN** 当前激活 Profile 的协议类型为 `responses`，且业务服务发起纯文本 AI 调用
- **THEN** 系统必须由后端向配置的模型服务地址发起 Responses 兼容 HTTP 请求
- **THEN** 系统必须从响应中提取模型最终文本并返回给统一执行门面
- **THEN** 本次调用不得启动本地 Agent CLI、沙箱线程或工具执行进程

#### Scenario: 使用 Chat Completions 协议兼容旧网关
- **WHEN** 当前激活 Profile 的协议类型为 `chat_completions`
- **THEN** 系统必须由后端向配置的模型服务地址发起 Chat Completions 兼容 HTTP 请求
- **THEN** 系统必须从 `choices` 响应中提取模型最终文本
- **THEN** 系统不得因为未安装 Codex SDK 或 Claude Agent SDK 而导致调用失败

### Requirement: 系统必须支持常见 Chat Completions 兼容模型平台
OpenAI 兼容 HTTP 运行时 MUST 支持通过 Profile 接入 Qwen、DeepSeek、GLM 等常见 Chat Completions 兼容模型平台。系统 MUST 将这些平台视为 OpenAI 兼容 HTTP 的配置变体，而不是为每个模型平台复制一套业务调用链路；平台差异必须通过 Base URL、模型名、协议类型、结构化输出模式和少量受控选项表达。

#### Scenario: 管理员配置 Qwen 兼容模型
- **WHEN** 管理员创建 Qwen 平台的 OpenAI 兼容 HTTP Profile，并填写该平台要求的 Base URL、模型名、密钥和协议类型
- **THEN** 系统必须通过同一个 OpenAI 兼容 HTTP adapter 发起模型调用
- **THEN** Web 问数、企业微信 AI 理解和合同审核不得因为模型平台变为 Qwen 而改动业务调用代码

#### Scenario: 管理员配置 DeepSeek 或 GLM 兼容模型
- **WHEN** 管理员创建 DeepSeek 或 GLM 平台的 OpenAI 兼容 HTTP Profile，并选择 `chat_completions` 协议
- **THEN** 系统必须允许管理员选择适合该平台的结构化输出模式
- **THEN** 系统必须通过健康检查验证该 Profile 是否能返回合法文本和结构化结果

### Requirement: 系统必须统一支持多种结构化输出模式
OpenAI 兼容 HTTP 运行时 MUST 支持结构化调用。调用方传入 JSON Schema 时，系统 MUST 根据当前 Profile 的结构化输出模式将 schema 映射为当前协议支持的结构化输出约束。结构化输出模式 MUST 至少覆盖 `json_schema`、`json_object` 和 `prompt_schema`；若模型返回自由文本、空输出、不可解析 JSON 或缺失必要结构，系统 MUST 将本次调用标记为失败并交由上层进入安全 fallback，不得伪造结构化结果。

#### Scenario: Responses 结构化调用返回合法 JSON
- **WHEN** 业务服务通过统一执行门面发起结构化调用，且当前协议为 `responses`
- **THEN** 系统必须按 `json_schema` 模式把 JSON Schema 放入 Responses 兼容结构化输出字段
- **THEN** 模型返回合法结构化结果后，系统必须解析为对象并返回给业务服务
- **THEN** 业务服务只能消费该对象继续执行受控路由或审核合并

#### Scenario: Chat Completions 使用 JSON Schema 模式
- **WHEN** 业务服务通过统一执行门面发起结构化调用，且当前协议为 `chat_completions`、结构化输出模式为 `json_schema`
- **THEN** 系统必须把调用方 schema 映射为 Chat Completions 兼容的 `response_format.json_schema`
- **THEN** 系统必须从模型消息内容中解析 JSON 并执行本地结构校验

#### Scenario: Chat Completions 使用 JSON object 模式
- **WHEN** 当前模型平台只稳定支持 JSON object 输出模式
- **THEN** 系统必须允许 Profile 将结构化输出模式配置为 `json_object`
- **THEN** 系统必须在请求中声明 JSON object 输出，并在提示词中补充字段结构、枚举范围和只返回 JSON 的约束
- **THEN** 系统必须在响应后执行本地 JSON 解析和 schema 校验

#### Scenario: 仅支持 prompt schema 的兼容网关
- **WHEN** 当前模型网关不支持结构化 `response_format`，但可以通过提示词稳定返回 JSON
- **THEN** 系统必须允许 Profile 将结构化输出模式配置为 `prompt_schema`
- **THEN** 系统不得发送不被上游支持的结构化 `response_format`
- **THEN** 系统必须把 schema 约束写入系统提示词，并在响应后执行本地结构校验

#### Scenario: 模型返回非法结构时失败
- **WHEN** 模型返回的内容无法按调用方声明的结构化输出解析
- **THEN** 系统必须返回明确的结构化解析失败
- **THEN** 企业微信、Web 分析或合同审核链路必须进入各自已定义的安全 fallback 或降级路径
- **THEN** 系统不得把不可解析文本直接用于执行确认、查询编排或合同风险命中

### Requirement: 系统必须由应用层显式管理 AI 上下文
OpenAI 兼容 HTTP 运行时 MUST 保持无 provider 线程依赖。企业微信机器人需要上下文时，系统 MUST 从应用层会话工作记忆中显式传入上一轮问题、上一轮结果摘要、活跃任务状态、待确认草稿或候选集合；Web 智能分析和合同审核 AI 调用默认按一次性请求执行。系统 MUST NOT 依赖 Agent SDK thread、Claude query 会话或 provider 侧隐式历史来保持业务上下文。

#### Scenario: 企业微信上下文显式进入当前请求
- **WHEN** 企业微信用户在已有会话上下文中发起解释、改条件、确认、修改或取消类回复
- **THEN** 系统必须从当前企业微信会话读取必要工作记忆并显式放入本次 AI 请求
- **THEN** 系统必须只传入当前业务判断所需的摘要、槽位和候选集合
- **THEN** 系统不得依赖模型端历史消息来推断当前用户或当前任务状态

### Requirement: 企业微信机器人上下文必须继续由系统会话仓储持有
在 OpenAI 兼容 HTTP 模式下，企业微信机器人上下文 MUST 继续由系统自己的会话仓储和上下文仓储持有。系统 MUST 复用当前 `session -> conversation context -> workMemory` 三层结构保存最近问题、最近结果摘要、待补充槽位、日报流转状态、跟进草稿、写回状态和创建草稿等任务态信息；HTTP adapter MUST 只消费这些上下文快照构造请求，不得接管或持久化业务会话状态。

#### Scenario: 活跃任务回复复用现有工作记忆
- **WHEN** 企业微信会话当前处于日报收集、跟进草稿确认、写回确认或客户/商机创建等活跃任务状态
- **THEN** 系统必须先从现有工作记忆读取任务态字段，再决定本次 AI 请求所需的上下文片段
- **THEN** 模型返回后，任务态更新必须仍由固定程序写回系统上下文仓储
- **THEN** HTTP adapter 不得把模型返回结果当作新的隐式会话状态直接保存

#### Scenario: 历史消息继续由应用层压缩
- **WHEN** 企业微信会话历史超过系统设定的最近消息保留阈值
- **THEN** 系统必须继续由应用层将较早消息压缩为摘要，并保留最近几轮消息
- **THEN** 本次 AI 请求只能消费压缩后的摘要和最近必要消息
- **THEN** HTTP adapter 不得自行扩展、恢复或依赖 provider 侧历史线程

#### Scenario: Web 追问按一次性请求处理
- **WHEN** Web 用户在结果详情页发起解释型追问或改条件追问
- **THEN** 系统可以把上一轮已验证结果摘要作为本次请求输入
- **THEN** 系统不得要求 provider 侧持久保存上一轮对话才能完成追问识别
- **THEN** 不同 Web 用户之间的请求上下文必须继续严格隔离

#### Scenario: 合同审核分组独立调用
- **WHEN** 系统对某一组合同检查项发起 AI 审核
- **THEN** 本次请求必须包含当前检查组、合同片段、事实摘要和规则依据
- **THEN** 系统不得依赖上一组模型输出或 provider 侧会话历史补齐当前检查依据

### Requirement: 系统必须统一处理鉴权、超时和错误摘要
OpenAI 兼容 HTTP 运行时 MUST 在服务端集中处理模型网关鉴权、请求超时、非 2xx 响应、响应解析失败和上游错误摘要。系统 MUST 使用 Profile 中保存的密钥发起鉴权，但任何日志、审计、错误响应和健康检查结果中都 MUST NOT 包含真实密钥、完整 Authorization 头或敏感业务正文。

#### Scenario: HTTP 请求超时
- **WHEN** 模型服务在当前调用超时时间内未返回可用响应
- **THEN** 系统必须中止本次 HTTP 请求
- **THEN** 系统必须向上层返回超时类失败摘要
- **THEN** 上层业务必须按现有安全降级规则处理该失败

#### Scenario: 上游返回非成功状态
- **WHEN** 模型服务返回非 2xx HTTP 状态
- **THEN** 系统必须将该响应标记为模型调用失败
- **THEN** 失败摘要可以包含状态码和脱敏错误摘要
- **THEN** 失败摘要不得包含密钥、完整请求体、合同全文或 CRM 敏感数据

### Requirement: 系统必须允许在无新增 npm SDK 的情况下部署
OpenAI 兼容 HTTP 运行时 MUST 优先使用 Node.js 20 内置 HTTP 能力或 `fetch` 实现模型调用。系统 MUST NOT 因缺少官方 OpenAI npm SDK、Codex SDK、Claude Agent SDK 或本地 CLI 而影响主 AI 运行时启动；若后续引入额外 SDK，必须单独说明必要性、部署影响和回滚策略。

#### Scenario: 生产环境未安装 Agent SDK 和 CLI
- **WHEN** 生产环境只安装项目运行依赖、配置模型网关地址和密钥，但没有安装本地 `codex` 或 `claude` 命令
- **THEN** Web 问数、企业微信 AI 理解和合同审核 AI 审查必须仍可通过 OpenAI 兼容 HTTP Profile 完成调用
- **THEN** 系统启动阶段不得因为缺少 Agent SDK 或 CLI 路径探测而失败

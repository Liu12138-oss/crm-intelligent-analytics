## Context

当前后端已经形成 `AiRuntimeConfigResolver -> UnifiedAiExecutionService -> AiProviderRegistryService -> ProviderAdapter` 的统一模型调用门面，业务侧的 Web 问数、企业微信 AI 理解和合同审核 AI 审查理论上不需要直接感知具体 Provider。问题在于现有 Provider 适配层仍然使用 `@openai/codex-sdk` 与 `@anthropic-ai/claude-agent-sdk`，这两类 SDK 面向 Agent/CLI 场景，会拉起本地可执行文件并附带线程、沙箱、工具、MCP、工作目录和 PATH 探测等复杂行为。

本系统现阶段的 AI 场景集中在：

- 文本问答与解释：企业微信解释回复、Web 结果解释、日报摘要。
- 结构化理解：自然语言问数意图、企业微信空闲态入口、活跃任务短回复、跟进四段草稿、候选实体重排。
- 结构化审核：合同审核按检查组输出 JSON Schema 结果。

这些场景不需要模型操作本地文件、不需要工具调用、不需要 Agent 多轮自主执行，也不需要 provider 侧持久会话。企业微信机器人确实需要上下文，但该上下文属于业务会话工作记忆，应继续由系统保存、裁剪和审计，而不是交给 SDK 线程或模型端会话隐式保存。

当前企业微信上下文已经有明确的数据承载层：

- `QuerySessionRecord`：按企业微信会话维度保存会话标识、请求人、渠道状态和心跳状态。
- `WecomConversationContextRecord`：按 session 绑定企业微信对话上下文。
- `WecomConversationWorkMemory`：保存 `latestQuestion`、`latestSummary`、`pendingSlots`、日报流转状态、跟进四段草稿、写回确认状态、客户/商机创建草稿等任务态业务记忆。

现有 `wecom-ai-conversation-orchestration.service.ts` 已经负责读取、更新和压缩这些上下文；本变更必须沿用这套上下文模型，而不是在接入 HTTP 模式时退回为“把最近几轮原始聊天全文直接塞给模型”。

约束条件：

- 新增或修改文档正文必须使用中文。
- 不得把真实密钥、代理地址、网关凭证写入文档、日志、测试夹具或截图说明。
- AI-first 业务约束不变：固定安全前置检查先执行，业务自然语言再进入统一 AI 理解层，最后由固定受控程序执行。
- 结构化输出必须可校验；非法结构不能直接驱动执行。
- Web 工作台已有解释型追问和改条件追问验收口径，但不要求 provider 侧保存会话；可以由应用层显式传入上一轮结果摘要或重新发起一次性调用。

## Goals / Non-Goals

**Goals:**

- 使用 OpenAI 兼容 HTTP 协议替代 Agent SDK / 本地 CLI 作为主 AI 运行时。
- 不新增 OpenAI npm SDK 依赖，优先使用 Node.js 20 内置 `fetch`，降低安装和部署复杂度。
- 保留现有 AI Profile 治理、激活、加密密钥、健康检查、运行时切换和审计能力。
- 统一支持文本调用与多种结构化输出模式，至少覆盖严格 JSON Schema、JSON object 和 prompt schema 三类。
- 默认使用 Responses 协议，保留 Chat Completions 协议兼容旧网关。
- 让 Qwen、DeepSeek、GLM 等常见 OpenAI Chat Completions 兼容模型可以通过页面 Profile 配置接入，而不需要为每个模型单独改业务代码。
- 明确企业微信上下文由应用层显式传入；Web 与合同审核默认一次性调用。
- 移除业务服务中的 Codex SDK fallback，让所有 AI 调用都走统一执行门面。
- 为历史 Codex / Claude Profile 提供迁移或重新配置路径，避免运行时静默失效。

**Non-Goals:**

- 不重新设计 Web 分析、企业微信机器人、合同审核的业务流程和用户可见能力。
- 不引入模型工具调用、函数调用、文件上传、多模态图片理解或 Realtime 能力。
- 不在本变更中接入新的外部模型厂商私有协议；只定义 OpenAI 兼容 HTTP 主路径。
- 不让前端直接调用模型服务；所有模型调用仍由后端集中处理。
- 不把旧关键词规则恢复为主理解链路；AI 不可用时仍只允许最小安全 fallback。

## Decisions

### 1. 新增 `openai-compatible-http` Provider adapter

后端新增 `OpenAiCompatibleHttpAdapter`，实现现有 `AiProviderAdapter` 接口，提供 `validateProfile`、`healthCheck`、`invokeText` 和 `invokeStructured`。该 adapter 使用服务端 `fetch` 直接访问模型网关，不动态导入 `@openai/codex-sdk`、`@anthropic-ai/claude-agent-sdk` 或官方 OpenAI npm SDK。

选择该方案的原因：

- 部署时只需要 Node.js 20、模型网关地址和密钥，不再依赖本地 CLI 是否安装、PATH 是否正确、Windows shim 是否可 spawn。
- 当前业务只需要文本和 JSON Schema 输出，HTTP 协议足够覆盖。
- 统一执行门面已经存在，新增 adapter 可以最小化业务层改动。

备选方案：

- 继续使用 Codex SDK：保留 outputSchema 便利性，但仍依赖本地 CLI 和 Agent 线程，不符合部署简化目标。
- 使用官方 `openai` npm SDK：比 Agent SDK 简单，但仍增加 SDK 依赖；本项目当前需求可以直接用 HTTP 实现。
- 仅改 Claude 为 HTTP、保留 Codex SDK：会继续保留双路径复杂度，不利于统一治理。

### 2. 协议默认 Responses，兼容 Chat Completions

Profile 的 `sdkOptions.wireApi` 保留为协议选择字段，允许值建议收敛为 `responses` 与 `chat_completions`。默认使用 `responses`，仅当内部网关或外部平台不支持 Responses 时切到 `chat_completions`。Qwen、DeepSeek、GLM 这类常见平台通常优先按 Chat Completions 兼容方式接入。

Responses 请求形态：

- 文本调用：`POST {baseUrl}/responses`，携带 `model`、`input`、必要的 `instructions`、`store=false`。
- 结构化调用：在文本调用基础上携带 `text.format` 的 JSON Schema 配置，要求模型返回可解析对象。

Chat Completions 兼容形态：

- 文本调用：`POST {baseUrl}/chat/completions`，携带 `model` 与 `messages`。
- 结构化调用：根据 Profile 的 `structuredOutputMode` 决定使用 `response_format.json_schema`、`response_format: {"type":"json_object"}` 或仅通过 prompt 约束 JSON 输出，并从 `choices[0].message.content` 解析 JSON。

设计约束：

- `baseUrl` 可配置为包含或不包含 `/v1` 的服务地址；adapter 内只负责拼接协议路径，不把密钥放入 URL。
- 鉴权默认使用 `Authorization: Bearer <apiKey>`；若后续需要非 OpenAI 风格鉴权，必须以显式 `sdkOptions` 增加，不得在日志中输出密钥。
- 响应解析必须兼容常见 Responses 输出结构，但最终只返回纯文本或对象给统一执行门面。

### 3. 结构化输出模式必须可配置且后端必须校验

新增 `structuredOutputMode` 作为 OpenAI 兼容 HTTP Profile 的受控运行时选项：

- `json_schema`：优先用于完整支持 JSON Schema 结构化输出的 OpenAI 兼容服务。Responses 下映射到 `text.format`，Chat Completions 下映射到 `response_format.json_schema`。
- `json_object`：用于 DeepSeek、GLM 等支持 JSON mode 但不完整支持 JSON Schema response_format 的服务。adapter 在请求中声明 JSON object，同时把调用方 JSON Schema 转成 system prompt 中的中文结构约束和示例。
- `prompt_schema`：用于仅能通过 prompt 约束输出 JSON 的兼容网关。adapter 不发送结构化 response_format，只在 system prompt 中追加 schema 说明、字段要求和“只返回 JSON”的硬约束。

无论选择哪种模式，后端都必须在响应后执行本地解析与结构校验：

- 先提取模型最终文本；
- 再解析 JSON；
- 再按调用方传入的 schema 或内部校验函数校验必填字段、枚举值、数组边界和禁止额外字段；
- 校验失败则向上层返回结构化解析失败，触发现有安全 fallback。

选择该方案的原因：

- 不同厂商对 OpenAI 兼容的覆盖深度不同；只支持 `json_schema` 会让 Qwen、DeepSeek、GLM 等常见模型接入不稳定。
- 结构化输出不能完全信任上游声明，CRM 问数、企业微信确认和合同审核都必须经过本地校验后才能进入固定程序。
- 页面可暴露结构化输出模式选择，但不能让管理员配置任意请求体模板或任意响应解析路径。

### 4. 页面配置支持平台预设，但协议逻辑仍收口在 adapter

治理页可以提供常见模型平台预设，降低配置成本：

- Qwen / 阿里百炼：预设协议为 `chat_completions`，结构化输出模式优先 `json_object` 或按实测选择 `json_schema`。
- DeepSeek：预设协议为 `chat_completions`，结构化输出模式优先 `json_object`。
- GLM / 智谱：预设协议为 `chat_completions`，结构化输出模式优先 `json_object`。
- 内部 OpenAI 兼容网关：默认协议为 `responses`，结构化输出模式优先 `json_schema`。

预设只负责填充建议值，管理员仍可手工修改 `baseUrl`、`model`、协议类型、结构化输出模式、超时和推理等级。请求体构造、鉴权、响应解析和错误分类必须继续由后端 adapter 内置，不能让页面提供任意 JSON 请求模板。

选择该方案的原因：

- 页面配置足够覆盖多数 OpenAI 兼容模型，不需要每接一个模型都改业务代码。
- 后端保留协议边界，可以稳定做密钥脱敏、审计、超时、schema 校验和 fallback。
- 避免把治理页面变成“任意 HTTP 客户端”，降低误配和安全风险。

这里需要明确产品口径：

- 兼容 OpenAI HTTP 协议的新模型，原则上通过治理页面新增或复制 Profile 即可接入。
- 不兼容 OpenAI HTTP 协议的新模型，不允许仅通过页面拼请求体或响应解析脚本接入；必须新增后端 adapter，再暴露为受控可配置 Profile。

### 5. 上下文由应用层管理，不依赖 provider 线程

新版运行时不使用 Codex thread、Claude query 会话或 Responses `previous_response_id` 作为主上下文机制。所有上下文都必须由业务服务显式拼入 prompt 或 system/instructions：

- 企业微信机器人：从会话工作记忆读取 `latestQuestion`、`latestSummary`、待确认草稿、活跃任务标签、候选集合和缺项槽位，按当前能力 prompt 显式传入模型。
- Web 工作台：首次问数、解释追问和改条件追问都按一次性请求处理；解释追问只可使用系统保存的上一轮已验证结果包摘要，不依赖模型端历史。
- 合同审核：每个检查组都是独立结构化调用，输入包含当前合同片段、规则检查项和事实摘要，不依赖上一组模型输出作为隐式上下文。

企业微信需要保持以下具体策略不变：

- 上下文读取顺序仍然是 `session -> conversation context -> workMemory`，不能直接从模型返回文本反推当前任务态。
- AI 入口分类、活跃任务短回复、草稿抽取和解释回复都只消费“当前需要的最小上下文”，例如上一轮问题、上一轮摘要、当前任务标签、待确认草稿或候选集合，不传整个会话全文。
- 对话历史继续由应用层压缩，保留最近几轮消息，并把更早历史折叠成系统摘要；HTTP adapter 不负责历史压缩。
- 任务态字段如日报收集状态、跟进草稿、写回状态、客户/商机创建草稿仍然由固定程序更新，模型只负责理解，不负责保存状态。

选择该方案的原因：

- 上下文来源可审计、可裁剪、可脱敏。
- 不绑定具体供应商会话存储能力。
- 更容易做到不同用户、不同企业微信会话和不同合同任务之间的严格隔离。
- 与现有企业微信会话编排实现一致，迁移到 HTTP 模式时不需要重写上下文模型。

### 6. 统一超时、错误分类和最小安全 fallback

adapter 内使用 `AbortController` 执行请求超时。超时值优先级：

1. 调用方针对能力传入的超时；
2. 当前 Profile 的 `timeoutMs`；
3. 运行时默认值。

错误分类建议：

- `STATIC_VALIDATION`：Profile 缺少模型、地址或密钥。
- `HTTP_REQUEST`：网络失败、DNS、TLS、连接超时。
- `HTTP_STATUS`：上游返回非 2xx。
- `RESPONSE_PARSE`：响应体无法解析、缺少模型输出、结构化 JSON 不合法。
- `SCHEMA_VALIDATION`：后续若补充 JSON Schema 校验，结构不满足要求。

统一执行门面只向业务层抛出明确错误；业务层继续按现有规则进入帮助、澄清、阻断、模板 fallback 或确定性校验降级，并记录 `fallbackReason`。adapter 日志与错误摘要不得包含密钥、完整合同正文或超长 CRM 结果包。

### 7. Profile 治理字段收敛

治理层保留：

- 配置名称、Provider 标识、平台预设、接入类型、模型名称、服务地址、密钥、推理等级、服务等级、超时、协议类型、结构化输出模式、是否禁用响应存储、代理环境变量。

治理层移除或降级为历史迁移字段：

- `codexPath`、Claude CLI 路径、`cwd`、`maxTurns`、`permissionMode`、`allowedTools`、`mcpConfigPath`、`enableMcpValidation`、`anthropicApiStyle`。

原因：

- 新版运行时不执行本地 Agent，不应再暴露本地 CLI、工具白名单和 MCP 字段。
- 继续保留这些字段会误导管理员以为系统仍支持 Agent 工具能力。

历史 Profile 处理：

- 已保存的 Codex SDK / Claude SDK Profile 不应静默转换为可激活新版 Profile。
- 管理员可复制历史配置并选择 OpenAI 兼容 HTTP 接入类型，补齐协议字段后重新测试。
- 后续实现可提供一次性迁移提示：对能映射的字段自动带入 `baseUrl`、`model`、`apiKey`、`reasoningEffort`，对不能映射的 CLI/MCP 字段显示弃用说明。

### 8. 业务服务只依赖统一执行门面

实施后，`AiGatewayService` 和 `ContractReviewAiReviewService` 中的 `importCodexSdk`、`startCodexThread`、`buildCodexClientOptions` 和旧 fallback 分支应删除。业务服务只调用：

- `UnifiedAiExecutionService.invokeText`
- `UnifiedAiExecutionService.invokeStructured`

这样可以保证新增 Provider 或调整协议时只改 adapter 与运行时配置，不再污染业务 prompt 和编排逻辑。

## Risks / Trade-offs

- [风险] 部分内部网关的 Responses 或 Chat Completions 结构化输出字段与 OpenAI 官方格式不完全一致。→ [缓解] adapter 支持协议开关，先为当前网关写契约测试；解析逻辑只兼容明确需要的字段，不做无限制猜测。
- [风险] 直接 HTTP 失去 Codex SDK 的 `outputSchema` 封装便利。→ [缓解] 在 adapter 内统一封装 JSON Schema 请求体与响应解析，并由单测覆盖各类结构化输出。
- [风险] Qwen、DeepSeek、GLM 等平台对 JSON Schema 支持深度不同，可能只支持 JSON object 或需要 prompt 约束。→ [缓解] 引入 `structuredOutputMode`，并始终执行后端本地 schema 校验。
- [风险] 页面平台预设可能过期或与某个租户网关配置不一致。→ [缓解] 预设只作为建议值，最终以管理员填写和健康检查结果为准；文档明确需要按实际网关验证。
- [风险] 历史 Claude Agent SDK Profile 的 MCP / 工具能力无法平滑迁移。→ [缓解] 本系统当前业务不依赖模型工具调用；治理页显示历史字段弃用提示，要求重新测试后才可激活。
- [风险] 供应商侧支持 `reasoningEffort` 的参数名称不统一。→ [缓解] 先将该字段作为治理和审计字段保留，adapter 只对明确支持的协议映射；未支持时不强行透传。
- [风险] 企业微信上下文显式拼接可能导致 prompt 变长。→ [缓解] 继续使用会话工作记忆摘要，只传上一轮问题、上一轮结果摘要、活跃任务标签和必要槽位，不传完整聊天历史。
- [风险] HTTP 改造时如果错误地把企业微信上下文退化成“仅传最近几轮原文”，会破坏日报、跟进、写回和创建流程的任务态判断。→ [缓解] 明确复用 `WecomConversationContextRecord` / `WecomConversationWorkMemory`，并为活跃任务、日报、跟进草稿和解释追问补回归测试。
- [风险] 移除 legacy SDK fallback 后，如果新 adapter 有缺陷会影响多个 AI 链路。→ [缓解] 先通过 Profile 测试、单元测试、合同审核分组测试、企业微信语义测试和 Web 问数回归；部署时保留环境变量开关回滚到上一个版本。

## Migration Plan

1. 扩展类型与配置：新增 `openai-compatible-http` 接入类型，更新运行时配置解析、推理等级归一化和治理 schema。
2. 新增 adapter：实现 OpenAI 兼容 HTTP 文本调用、结构化调用、健康检查、协议路径拼接、结构化输出模式映射、超时和错误摘要。
3. 注册 adapter：在 `AiModelsModule` 中注册新 adapter，并让 `AiProviderRegistryService` 可按新类型返回。
4. 更新环境引导：将 `ANALYSIS_AI_*` 与 `OPENAI_API_KEY` 引导为 OpenAI 兼容 HTTP 默认档案，保留历史档案但标记需迁移。
5. 更新治理 UI：表单接入类型改为 OpenAI 兼容 HTTP，补充 Qwen / DeepSeek / GLM 等平台预设、结构化输出模式选择，移除或隐藏 Agent CLI / MCP 字段。
6. 收敛业务调用：移除 `AiGatewayService` 和 `ContractReviewAiReviewService` 中 Codex SDK fallback，统一走执行门面，同时保持企业微信 `session/context/workMemory` 三层上下文模型不变。
7. 删除依赖：移除不再需要的 Agent SDK 依赖和相关锁文件条目。
8. 更新文档：同步 README、架构说明、quickstart、验证清单中关于 SDK、CLI、MCP 和 Profile 字段的描述。
9. 回归验证：执行后端单测、AI 模型治理契约测试、Web 问数集成测试、企业微信对话集成测试和合同审核 AI 回归测试。

回滚策略：

- 代码部署层面回滚到上一版本即可恢复旧 Agent SDK 运行时。
- 数据层面不删除历史 Profile；新增的 OpenAI 兼容 HTTP Profile 与旧 Profile 共存，回滚时旧版本仍可读取原有 Codex / Claude Profile。
- 若只需临时禁用新 adapter，可在治理后台切回旧版本部署前的可用 Profile，或关闭对应 AI 灰度开关让业务进入现有安全 fallback。

## Open Questions

- 内部模型网关当前是否完全兼容 Responses 的 `text.format` 结构化输出，还是需要优先使用 Chat Completions 的 `json_schema` / `json_object` 模式？
- 当前生产环境是否存在实际依赖 Claude Agent SDK MCP 工具能力的 Profile？若存在，需要单独立项保留 Agent 型 Provider，而不是在本变更中强行删除。
- `reasoningEffort` 在当前内部网关中的真实参数名是否统一？若未统一，本变更先保留治理字段，不强制透传。

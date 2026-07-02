## ADDED Requirements

### Requirement: 系统必须支持 OpenAI 兼容 HTTP Profile
系统 MUST 在 AI 模型治理目录中支持 OpenAI 兼容 HTTP Profile。该 Profile MUST 至少包含名称、Provider 标识、平台预设、接入类型、模型名、服务地址、密钥配置状态、协议类型、结构化输出模式、推理等级、服务等级、超时时间和运行时选项。管理员录入完整配置后，系统 MUST 能完成保存、测试连接、启停和激活切换，并让企业微信 AI 理解、Web 智能分析和合同审核 AI 审查统一读取该 Profile。

#### Scenario: 管理员新增 OpenAI 兼容 HTTP Profile
- **WHEN** 管理员在治理后台新增一条 OpenAI 兼容 HTTP Profile，并填写服务地址、模型名、协议类型、结构化输出模式和密钥
- **THEN** 系统必须保存该 Profile
- **THEN** 治理列表必须展示其 Provider、模型名、接入类型、启停状态和密钥配置状态
- **THEN** 该 Profile 通过测试后必须允许被激活为当前全系统 AI 运行时

#### Scenario: OpenAI 兼容 HTTP Profile 被激活后统一生效
- **WHEN** 管理员将测试通过的 OpenAI 兼容 HTTP Profile 设置为当前激活配置
- **THEN** 后续企业微信、Web 分析和合同审核 AI 调用必须统一读取该 Profile
- **THEN** 系统不得再绕过统一执行门面直接读取 Codex SDK 或 Claude Agent SDK 配置

### Requirement: 治理页面必须收敛为 HTTP 运行时字段
系统 MUST 在 OpenAI 兼容 HTTP Profile 的治理表单中展示与 HTTP 调用直接相关的字段，并隐藏或标记废弃 Agent CLI、MCP 和工具执行字段。`codexPath`、Claude CLI 路径、`cwd`、`maxTurns`、`permissionMode`、`allowedTools`、`mcpConfigPath`、`enableMcpValidation` 和 `anthropicApiStyle` 不得作为新版 OpenAI 兼容 HTTP Profile 的必填或推荐字段。

#### Scenario: 新建 HTTP Profile 时不展示本地 CLI 字段
- **WHEN** 管理员选择新建 OpenAI 兼容 HTTP Profile
- **THEN** 表单必须要求填写模型服务地址、模型名、协议类型和密钥等 HTTP 运行时字段
- **THEN** 表单不得要求管理员填写本地 Codex 可执行路径、Claude CLI 路径或 MCP 配置文件路径

#### Scenario: 历史 Agent 字段仅作为迁移提示
- **WHEN** 管理员查看或复制一条历史 Codex SDK 或 Claude Agent SDK Profile
- **THEN** 系统可以展示其历史字段摘要
- **THEN** 系统必须提示这些 Agent CLI / MCP 字段不会进入新版 OpenAI 兼容 HTTP 运行时
- **THEN** 管理员必须重新测试通过后才可激活迁移后的 Profile

### Requirement: 系统必须以真实 HTTP 调用验证 Profile
系统 MUST 在 OpenAI 兼容 HTTP Profile 测试连接与激活验证阶段发起至少一次真实 HTTP 模型调用，而不是只校验字段完整性或网络端口可达。健康检查 MUST 使用当前 Profile 的服务地址、模型名、协议类型和密钥执行最小 smoke test，并记录成功 / 失败状态、耗时、失败阶段和脱敏失败原因。

#### Scenario: HTTP Profile 测试连接成功
- **WHEN** 管理员对一条 OpenAI 兼容 HTTP Profile 发起测试连接，且模型服务返回合法最小响应
- **THEN** 系统必须记录该 Profile 最近一次测试成功时间和耗时
- **THEN** 页面必须展示成功反馈
- **THEN** 该测试不得依赖本地 Agent CLI 或 SDK thread

#### Scenario: HTTP Profile 测试连接失败
- **WHEN** 模型服务不可达、鉴权失败、返回非成功状态或响应无法解析
- **THEN** 系统必须将测试结果标记为失败
- **THEN** 页面必须展示脱敏失败原因
- **THEN** 该 Profile 不得被激活为当前生效配置

### Requirement: 治理页面必须提供常见模型平台预设
系统 MUST 允许治理页面为常见 OpenAI 兼容模型平台提供受控预设。预设 MAY 覆盖 Qwen、DeepSeek、GLM 和内部 OpenAI 兼容网关等平台，并为管理员填充建议的协议类型、结构化输出模式、服务地址示例和模型名提示。预设只作为配置辅助，最终调用仍 MUST 经过后端 HTTP adapter、健康检查和结构化输出校验。

#### Scenario: 管理员选择 Qwen 平台预设
- **WHEN** 管理员在新增 Profile 时选择 Qwen 平台预设
- **THEN** 页面必须填充或提示 Qwen 平台常用的 Chat Completions 兼容配置项
- **THEN** 管理员仍必须填写真实密钥和实际模型名
- **THEN** 保存或激活前仍必须通过服务端健康检查

#### Scenario: 管理员选择 DeepSeek 或 GLM 平台预设
- **WHEN** 管理员选择 DeepSeek 或 GLM 平台预设
- **THEN** 页面必须建议使用 `chat_completions` 协议和适配该平台的结构化输出模式
- **THEN** 页面不得要求管理员填写任意请求体模板或任意响应解析脚本
- **THEN** 后端必须继续负责请求构造、响应解析、密钥脱敏和错误分类

### Requirement: 兼容模型必须优先通过页面配置接入，非兼容模型必须新增 adapter
对于后续新增模型，系统 MUST 先判断其是否兼容 OpenAI HTTP 协议。若兼容，系统 MUST 允许管理员通过治理页面新增或复制 OpenAI 兼容 HTTP Profile 完成接入，而不需要修改业务调用链路；若不兼容，系统 MUST 新增对应后端 adapter 并通过统一执行门面注册后，才允许该模型以新接入类型出现在治理页面中。系统 MUST NOT 允许管理员仅通过页面自定义任意请求体模板、任意鉴权脚本或任意响应解析脚本来接入非兼容模型。

#### Scenario: 新增兼容 OpenAI HTTP 的模型
- **WHEN** 管理员需要接入一条新的 OpenAI HTTP 兼容模型
- **THEN** 系统必须允许其通过治理页面新增或复制 Profile 并填写受控字段完成接入
- **THEN** Web 问数、企业微信 AI 理解和合同审核业务代码不得因为该模型接入而单独修改

#### Scenario: 新增不兼容 OpenAI HTTP 的模型
- **WHEN** 管理员需要接入一条不兼容 OpenAI HTTP 协议的模型
- **THEN** 系统必须要求先新增后端 adapter 并注册新的接入类型
- **THEN** 在该 adapter 未完成前，治理页面不得仅靠自由配置表单宣称该模型已可用

### Requirement: 治理页面必须受控配置结构化输出模式
系统 MUST 在 OpenAI 兼容 HTTP Profile 中提供结构化输出模式配置。结构化输出模式 MUST 至少包含 `json_schema`、`json_object` 和 `prompt_schema`，并由后端 adapter 解释为对应请求构造和响应校验策略。页面不得允许管理员配置任意 JSON 请求模板、任意 header 模板或任意响应解析表达式。

#### Scenario: 管理员选择 JSON Schema 模式
- **WHEN** 管理员选择 `json_schema` 结构化输出模式
- **THEN** 系统必须在测试连接或结构化 smoke test 中验证当前模型服务是否支持该模式
- **THEN** 如果上游不支持该模式，系统必须返回明确失败原因或建议改用 `json_object`

#### Scenario: 管理员选择 JSON object 模式
- **WHEN** 管理员选择 `json_object` 结构化输出模式
- **THEN** 系统必须提示该模式仍会由后端执行本地 schema 校验
- **THEN** 系统不得把模型返回的任意 JSON 直接用于业务执行

#### Scenario: 管理员选择 prompt schema 模式
- **WHEN** 管理员选择 `prompt_schema` 结构化输出模式
- **THEN** 系统必须提示该模式兼容性更强但稳定性更依赖模型输出
- **THEN** 系统必须通过本地 schema 校验决定本次调用是否成功

## MODIFIED Requirements

### Requirement: 系统必须支持多 Provider / 多 Profile 的 AI 配置治理目录
系统 MUST 提供可持久化的 AI 模型 Profile 目录，允许管理员维护多条可复用配置。每条 Profile MUST 至少包含名称、Provider 标识、平台预设、接入类型、模型名、基础接入地址、鉴权方式、协议类型、结构化输出模式、启停状态以及全系统运行时所需的关键参数；系统 MUST 支持新增、编辑、复制和停用 Profile，并保证 Profile 标识唯一、名称可读且可区分。接入类型 MUST 能区分 OpenAI 兼容 HTTP 运行时与历史 Agent SDK 运行时，且业务调用 MUST 只通过统一执行门面消费当前激活 Profile。

#### Scenario: 管理员新增一条 OpenAI 兼容 HTTP Profile
- **WHEN** 管理员在治理后台提交一条新的 OpenAI 兼容 HTTP Profile，且必填字段完整
- **THEN** 系统必须持久化该 Profile，并在治理列表中展示其 Provider、模型名、接入类型、启停状态和是否已配置密钥

#### Scenario: 管理员复制现有 Profile 作为新配置
- **WHEN** 管理员选择复制一条现有 Profile
- **THEN** 系统必须基于原 Profile 生成一条新的可编辑 Profile
- **THEN** 新 Profile 不得沿用原 Profile 的唯一标识与激活状态
- **THEN** 若原 Profile 属于历史 Agent SDK 类型，复制后的配置必须明确提示需要转换并重新测试后才可激活

## REMOVED Requirements

### Requirement: 系统必须首批支持 Codex SDK 与 Claude SDK 两类可用 Profile
**Reason**: 新版主运行时改为 OpenAI 兼容 HTTP 调用，不再要求首批可运行配置依赖 Codex SDK 或 Claude Agent SDK。本系统当前文字问答、结构化分析、企业微信语义理解和合同审核场景不需要本地 Agent、工具调用、沙箱或 MCP 能力。

**Migration**: 历史 Codex SDK / Claude Agent SDK Profile 保留为历史配置或迁移来源；管理员需要创建或复制为 OpenAI 兼容 HTTP Profile，补齐协议类型、服务地址、模型名和密钥，并通过真实 HTTP 健康检查后再激活。

#### Scenario: 管理员录入 Codex SDK Profile
- **WHEN** 管理员新增一条 Codex SDK Profile，并填写现有 Codex 所需的接入参数
- **THEN** 系统必须能够保存该 Profile，并允许后续执行真实测试与激活切换

#### Scenario: 管理员录入 Claude SDK Profile
- **WHEN** 管理员新增一条 Claude SDK Profile，并填写现有 Claude 所需的接入参数
- **THEN** 系统必须能够保存该 Profile，并允许后续执行真实测试与激活切换

### Requirement: 系统必须以真实 SDK 调用验证切换结果
**Reason**: 新版运行时不再以 SDK / CLI 为主验证路径。继续要求真实 SDK 调用会保留本地 CLI、PATH 探测、MCP 和 Agent thread 依赖，与部署简化目标冲突。

**Migration**: 连接测试与激活验证改为真实 HTTP smoke test。对于历史 Agent SDK Profile，系统必须提示需要迁移为 OpenAI 兼容 HTTP Profile；若后续确需保留 Agent 型 Provider，应单独立项定义其接入边界。

#### Scenario: Codex Profile 通过真实 SDK 调用验证
- **WHEN** 管理员对一条 Codex SDK Profile 发起测试连接
- **THEN** 系统必须通过后台代码触发一次真实 Codex SDK 调用
- **THEN** 只有调用成功后，该 Profile 才可被标记为测试通过

#### Scenario: Claude Profile 通过真实 SDK 调用与 MCP 校验
- **WHEN** 管理员对一条启用 MCP 校验的 Claude SDK Profile 发起测试连接
- **THEN** 系统必须通过后台代码触发一次真实 Claude SDK 调用
- **THEN** 系统必须记录 MCP 服务器连接状态
- **THEN** 只要 Claude 调用失败或 MCP 连接失败，测试结果都必须标记为失败

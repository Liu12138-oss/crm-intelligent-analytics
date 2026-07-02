# AI 配置治理技术说明

## 1. 目标

本文档说明当前仓库中“AI配置治理”能力的实现边界、模块拆分、OpenAI 兼容 HTTP adapter、上下文策略、结构化输出模式、健康检查和历史 Agent Profile 迁移策略。

当前目标不是做一个抽象过度的模型平台，而是在不破坏 Web 智能分析、企业微信 AI 理解和合同审核主链的前提下，把主 AI 运行时统一收敛到服务端 OpenAI 兼容 HTTP 调用。后端不再依赖本地 Agent CLI、SDK thread、MCP、工具执行或本机可执行路径探测。

## 2. 模块拆分

后端核心模块位于 `backend/src/modules/ai-models/`：

- `ai-model-profile.service.ts`：负责 Profile 的创建、更新、复制、启停、密钥留空不改、显式清空和最近测试结果回写。
- `ai-context-policy.service.ts`：负责 AI 上下文治理策略的读取、更新、长度裁剪和超时判断。
- `ai-secret-crypto.service.ts`：负责 Profile 密钥的加解密，不允许明文落库。
- `ai-runtime-config.resolver.ts`：负责统一解析当前生效配置，优先级为“后台激活 Profile -> 环境默认 `ANALYSIS_AI_*` -> AI 不可用降级”。
- `ai-provider-registry.service.ts`：负责按 `sdkType` 返回对应 Provider adapter。
- `unified-ai-execution.service.ts`：负责统一把业务调用分发到当前激活 Provider。
- `adapters/openai-compatible-http.adapter.ts`：主运行时 adapter，负责 OpenAI 兼容 HTTP 文本调用、结构化调用、健康检查、超时、响应解析、错误脱敏和本地 schema 校验。

治理接口位于 `backend/src/modules/governance/ai-model-governance.controller.ts` 与 `backend/src/modules/governance/ai-context-governance.controller.ts`。

前端页面与组件位于：

- `frontend/src/pages/governance/AiModelProfilePage.vue`
- `frontend/src/components/governance/AiContextPolicyPanel.vue`
- `frontend/src/components/governance/AiProfileSummaryCard.vue`
- `frontend/src/components/governance/AiProfileTable.vue`
- `frontend/src/components/governance/AiProfileFormDrawer.vue`
- `frontend/src/components/governance/AiProfileHealthCheckDialog.vue`

## 3. 运行时切换逻辑

所有 AI 调用统一通过 `AiRuntimeConfigResolver` 获取生效配置：

1. 若后台存在已激活 Profile，则优先读取该 Profile。
2. 若后台没有已激活 Profile，则回退到 `LocalRuntimeConfigService.getAiConfig()` 解析出的 OpenAI 兼容 HTTP 环境默认配置。
3. 若两者都不可用，则交由上层进入既有降级逻辑。

当前已接入统一解析和统一执行门面的链路包括：

- Web 智能分析问数、解释型追问、候选执行模式判断和 grounded 洞察。
- 企业微信 AI 入口分类、活跃任务短回复、跟进四段草稿、候选重排、日报摘要和解释回复。
- 合同审核 AI 审查和补充审查。

企业微信上下文继续由应用层 `session -> conversation context -> workMemory` 三层模型保存和裁剪。HTTP adapter 只消费当前请求显式传入的 prompt，不保存 provider 侧会话状态。

AI配置中心中的上下文策略与模型档案使用同一个治理入口，但由独立的数据对象持久化。当前可治理的上下文阈值至少包括：

- 问答上下文保留轮次上限
- 历史摘要保留上限
- 上一轮问题保留上限
- 上一轮结果摘要保留上限
- 普通分析会话失活时长
- 任务态会话失活时长

企业微信会话压缩、活跃任务恢复和 Web 解释型追问复用统一消费这组策略，不再依赖服务内硬编码阈值。

## 4. Profile 字段映射

OpenAI 兼容 HTTP Profile 的关键字段如下：

| 字段 | 说明 |
|------|------|
| `providerCode` | 平台或内部网关标识，用于治理、审计和平台预设联动。 |
| `sdkType` | 新版主运行时固定为 `openai-compatible-http`。 |
| `model` | 传给模型网关的模型 ID。 |
| `baseUrl` | 模型服务 Base URL，可包含 `/v1`，adapter 只追加协议路径。 |
| `apiKey` | 加密保存，调用时通过 `Authorization: Bearer <密钥>` 发送。 |
| `reasoningEffort` | OpenAI 兼容 HTTP 默认 `low`，当前可选 `low / medium / high`。 |
| `serviceTier` | 治理和审计保留字段，只有明确支持时才应由 adapter 映射。 |
| `timeoutMs` | HTTP 请求超时时间，未配置时由 adapter 使用默认值。 |
| `sdkOptions.wireApi` | 协议类型，可选 `responses` 或 `chat_completions`。 |
| `sdkOptions.structuredOutputMode` | 结构化输出模式，可选 `json_schema`、`json_object`、`prompt_schema`。 |
| `sdkOptions.disableResponseStorage` | 是否请求上游禁用响应存储。 |
| `sdkOptions.proxyEnv` | 后端访问模型网关需要代理时使用的环境变量映射。 |

## 5. 结构化输出模式

`openai-compatible-http.adapter.ts` 支持三种结构化输出模式：

- `json_schema`：优先用于完整支持 JSON Schema 的服务。Responses 映射到 `text.format`，Chat Completions 映射到 `response_format.json_schema`。
- `json_object`：用于 DeepSeek、GLM 等稳定支持 JSON mode 但不完整支持 JSON Schema response format 的服务。adapter 会发送 `response_format: {"type":"json_object"}`，并把 schema 约束写入中文系统提示词。
- `prompt_schema`：用于不支持结构化 response format、但可通过提示词约束输出 JSON 的兼容网关。adapter 不发送 `response_format`，仅通过系统提示词要求“只返回 JSON”。

无论选择哪种模式，后端都会在响应后执行本地 JSON 解析和 schema 校验。缺少必填字段、枚举不合法、类型不匹配或返回非法 JSON 时，本次模型调用必须失败，并由上层业务进入既有安全降级。

## 6. 健康检查和错误处理

OpenAI 兼容 HTTP Profile 的健康检查必须发起一次最小真实 HTTP 模型调用，而不是只校验字段完整性。检查结果记录：

- 成功或失败状态。
- 耗时。
- 失败阶段，例如 `STATIC_VALIDATION`、`HTTP_REQUEST`、`HTTP_STATUS`、`RESPONSE_PARSE`、`SCHEMA_VALIDATION`。
- 脱敏失败原因。

错误摘要不得包含真实密钥、完整 `Authorization` 头、完整合同正文或超长 CRM 结果包。

## 7. 平台预设

治理页可以提供常见 OpenAI 兼容平台预设：

- 内部 OpenAI 兼容网关：默认 `responses` + `json_schema`。
- Qwen / 阿里百炼：默认 `chat_completions` + `json_object`。
- DeepSeek：默认 `chat_completions` + `json_object`。
- GLM / 智谱：默认 `chat_completions` + `json_object`。
- 手动配置：管理员自行填写受控字段。

预设只填建议值，不允许提供任意请求体模板、任意 header 模板或任意响应解析脚本。请求构造、鉴权、响应解析、错误脱敏和本地 schema 校验必须继续收口在后端 adapter。

## 8. 新增模型扩展规则

后续新增模型必须先判断是否兼容 OpenAI HTTP 协议：

- 若兼容，优先通过治理页面新增或复制 OpenAI 兼容 HTTP Profile 接入，不需要修改 Web、企业微信或合同审核业务代码。
- 若不兼容，必须新增对应后端 adapter，注册到 `AiProviderRegistryService`，补充健康检查、单元测试、契约测试和业务回归后，才能作为新的受控接入类型暴露给治理页。

不得通过页面自定义任意请求体模板、鉴权脚本或响应解析脚本来绕过后端 adapter 边界。

## 1. 运行时类型与配置基础

- [x] 1.1 将 `AiSdkType` 扩展为支持 `openai-compatible-http`，并同步更新后端治理 schema、契约测试和相关类型引用。
- [x] 1.2 调整 AI 推理等级归一化逻辑，为 OpenAI 兼容 HTTP Profile 提供默认档位和可选档位，并避免继续套用 Codex / Claude 专属默认值。
- [x] 1.3 新增结构化输出模式类型，支持 `json_schema`、`json_object` 和 `prompt_schema`，并同步后端 schema 与默认值。
- [x] 1.4 更新 `AiRuntimeConfig` 与 `AiRuntimeConfigResolver`，确保协议类型、结构化输出模式、超时时间、服务等级、代理环境变量和 `disableResponseStorage` 可供 HTTP adapter 消费。
- [x] 1.5 调整 `LocalRuntimeConfigService.getAiConfig()`，将环境默认 AI 配置解析为 OpenAI 兼容 HTTP 运行时，并保留 `ANALYSIS_AI_WIRE_API` 的 `responses` / `chat_completions` 协议选择。
- [x] 1.6 支持 `ANALYSIS_AI_STRUCTURED_OUTPUT_MODE` 环境键位，未配置时按协议和平台预设补齐结构化输出默认值。

## 2. OpenAI 兼容 HTTP Adapter

- [x] 2.1 新增 `openai-compatible-http.adapter.ts`，实现 `AiProviderAdapter` 的 `validateProfile`、`healthCheck`、`invokeText` 和 `invokeStructured`。
- [x] 2.2 实现 Responses 协议请求构造，覆盖纯文本调用、结构化 JSON Schema 调用、`store=false` 或等价禁用响应存储配置。
- [x] 2.3 实现 Chat Completions 协议请求构造，覆盖纯文本调用、`response_format.json_schema`、`response_format: {"type":"json_object"}` 和 prompt schema 三种结构化模式。
- [x] 2.4 实现 schema-to-prompt 辅助逻辑，将调用方 JSON Schema 转成中文字段约束、枚举范围和“只返回 JSON”的系统提示词。
- [x] 2.5 实现统一响应解析，分别从 Responses 与 Chat Completions 响应中提取最终文本和结构化对象。
- [x] 2.6 实现本地 JSON 解析与 schema 校验，确保 `json_object` 和 `prompt_schema` 模式也不能绕过结构约束。
- [x] 2.7 实现 `AbortController` 超时控制、非 2xx 状态处理、JSON 解析失败处理和脱敏错误摘要。
- [x] 2.8 为 adapter 增加单元测试，覆盖成功文本调用、`json_schema`、`json_object`、`prompt_schema`、超时、非 2xx、非法 JSON、缺失密钥和协议类型不支持。
- [x] 2.9 增加 Qwen、DeepSeek、GLM 风格的 Chat Completions mock 测试，验证 Base URL、模型名、结构化输出模式和响应解析兼容。
- [x] 2.10 将新 adapter 注册到 `AiModelsModule` 与 `AiProviderRegistryService`，并补充 registry 单测。

## 3. AI Profile 治理与环境引导

- [x] 3.1 更新 AI Profile 创建、编辑、复制、测试和激活逻辑，支持 `openai-compatible-http` 并阻止未测试通过的 HTTP Profile 激活。
- [x] 3.2 更新 `AiModelEnvBootstrapService`，将 `ANALYSIS_AI_*` 与 `OPENAI_API_KEY` 引导为环境默认 OpenAI 兼容 HTTP 档案。
- [x] 3.3 为历史 Codex SDK / Claude Agent SDK 档案补迁移提示逻辑，避免静默把 CLI / MCP 字段当作新版 HTTP 运行时配置。
- [x] 3.4 增加 Qwen、DeepSeek、GLM 和内部 OpenAI 兼容网关平台预设定义，预设只填建议值，不允许配置任意请求体模板。
- [x] 3.5 在治理与后端配置约束中明确“兼容 OpenAI HTTP 的新模型走页面 Profile，非兼容模型必须先补 adapter”的接入规则。
- [x] 3.6 更新 AI Profile 健康检查测试，验证 HTTP Profile 使用真实 HTTP smoke test，且失败原因不包含密钥。
- [x] 3.7 更新治理契约测试，覆盖新建 HTTP Profile、平台预设、结构化输出模式、草稿测试、激活、回滚和非管理员访问边界。

## 4. 治理前端表单与展示

- [x] 4.1 更新 AI Profile 表单接入类型选项，将 OpenAI 兼容 HTTP 作为主选项，并调整表单校验文案。
- [x] 4.2 增加平台预设选择，至少覆盖内部 OpenAI 兼容网关、Qwen、DeepSeek、GLM 和手动配置。
- [x] 4.3 增加结构化输出模式选择与中文说明，解释 `json_schema`、`json_object`、`prompt_schema` 的兼容性和稳定性差异。
- [x] 4.4 隐藏或标记废弃 `codexPath`、Claude CLI 路径、MCP 配置、权限模式、工具白名单等 Agent 专属字段。
- [x] 4.5 增加协议类型、超时时间、服务等级、禁用响应存储、代理环境变量等 HTTP Profile 字段的中文说明。
- [x] 4.6 更新 Profile 列表、摘要卡和健康检查弹窗，展示 HTTP Profile 的接入类型、平台预设、协议类型、结构化输出模式和测试结果。
- [x] 4.7 补充前端单元测试，覆盖 HTTP Profile 新建、编辑、平台预设联动、结构化输出模式显示、测试失败反馈和密钥不回显。

## 5. 业务 AI 调用链路收敛

- [x] 5.1 移除 `AiGatewayService` 中 Codex SDK 动态导入、线程启动、Codex client options 和 legacy fallback 分支。
- [x] 5.2 确保 Web 问数、企业微信入口分类、活跃任务回复、跟进四段草稿、候选重排、日报摘要和 grounded 洞察均只通过 `UnifiedAiExecutionService` 发起 AI 调用。
- [x] 5.3 移除 `ContractReviewAiReviewService` 中 Codex SDK 动态导入、线程启动和 legacy fallback 分支。
- [x] 5.4 保持企业微信 `session -> conversation context -> workMemory` 三层上下文模型不变，禁止把任务态记忆下沉到 adapter 或 provider 会话。
- [x] 5.5 复查企业微信 prompt 组装逻辑，确保只显式传入最小必要上下文，如 `latestQuestion`、`latestSummary`、活跃任务标签、待确认草稿、候选集合和缺项槽位。
- [x] 5.6 保持企业微信历史压缩逻辑继续在应用层执行，验证 HTTP 改造后不会退化为直接传递整段聊天原文。
- [x] 5.7 保持 Web 解释型追问使用上一轮已验证结果包摘要作为一次性输入，验证不依赖模型端会话状态。
- [x] 5.8 确认合同审核每个检查组独立传入合同片段、事实摘要和规则检查项，不依赖上一组模型隐式上下文。

## 6. 依赖清理与构建配置

- [x] 6.1 从 `backend/package.json` 移除 `@openai/codex`、`@openai/codex-sdk` 和 `@anthropic-ai/claude-agent-sdk`。
- [x] 6.2 更新 `pnpm-lock.yaml`，确认不再安装 Codex / Claude Agent SDK 及其 CLI 平台包。
- [x] 6.3 检查后端构建输出，确保没有残留 `import('@openai/codex-sdk')`、`import('@anthropic-ai/claude-agent-sdk')` 或本地 CLI 路径探测逻辑。
- [x] 6.4 确认企业微信机器人 `@wecom/aibot-node-sdk` 依赖保持不变，不被本次 AI 运行时清理误删。

## 7. 文档与规格同步

- [x] 7.1 更新 `README.md` 的 AI 配置抽屉填写说明，将 Codex SDK / Claude SDK 说明改为 OpenAI 兼容 HTTP 说明，并补充 Qwen、DeepSeek、GLM 配置示例。
- [x] 7.2 更新 `docs/architecture/ai-model-profile-governance.md`，补充新版 HTTP adapter 架构、字段映射、结构化输出模式、健康检查和迁移策略。
- [x] 7.3 更新 `specs/001-crm-intelligent-analytics/quickstart.md`，将 AI 模型治理验证场景改为 OpenAI 兼容 HTTP Profile 测试、激活和回滚。
- [x] 7.4 检查 `specs/001-crm-intelligent-analytics/plan.md`、`research.md` 和 `README.md` 是否仍有“Codex SDK / Claude SDK 是主运行时”的过期描述并同步修正。
- [x] 7.5 更新或删除 `docs/需求文档/codex-sdk文档使用说明.md`，避免协作者继续按本地 Codex CLI SDK 作为主接入方式。

## 8. 回归验证

- [x] 8.1 运行 `pnpm --dir backend test -- modules/ai-models`，验证治理、运行时配置、registry 和 adapter 测试通过。
- [x] 8.2 运行 `pnpm --dir backend test -- modules/analysis`，验证 Web 问数、企业微信语义分流和 AI fallback 回归通过。
- [x] 8.3 运行企业微信上下文相关测试，验证活跃任务回复、日报流转、跟进草稿、写回确认和上下文压缩在 HTTP 模式下仍可正确复用工作记忆。
- [x] 8.4 运行 `pnpm --dir backend test -- contract-review`，验证合同审核 AI 结构化调用与降级回归通过。
- [x] 8.5 运行 `pnpm --dir frontend test:unit -- governance`，验证 AI Profile 治理页面回归通过。
- [x] 8.6 运行 `pnpm --dir backend build` 和 `pnpm --dir frontend build`，确认生产构建不再依赖 Agent SDK / 本地 CLI。
- [x] 8.7 使用一条真实或 mock OpenAI 兼容 HTTP Profile 执行健康检查，确认响应成功且日志、接口响应和审计中不包含密钥。
- [x] 8.8 分别使用 Qwen、DeepSeek、GLM 风格 mock Profile 执行结构化 smoke test，确认 `json_object` 或 `prompt_schema` 模式下仍能通过本地 schema 校验。

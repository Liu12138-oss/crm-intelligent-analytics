## Why

当前 AI 运行时使用 `@openai/codex-sdk` 与 `@anthropic-ai/claude-agent-sdk` 这类 Agent/CLI 型 SDK，实际会引入本地 CLI、线程、沙箱、MCP、工具执行和本机可执行路径等额外复杂度。现阶段系统主要使用文字问答、结构化分析、企业微信语义分流、合同审核和摘要生成能力，直接通过 OpenAI 兼容 HTTP 接口调用模型即可满足需求，并能降低部署、排障和运行时依赖成本。

本变更将 AI 运行时从 Agent SDK / 本地 CLI 依赖迁移为服务端直连 OpenAI 兼容 HTTP 协议，保留现有 AI Profile 治理、激活、密钥保护、审计、结构化输出和安全降级边界。

## What Changes

- 新增 OpenAI 兼容 HTTP 运行时适配能力，使用 Node.js 服务端 HTTP 调用模型，不依赖本地 `codex`、`claude` 或其它 Agent CLI。
- 默认使用 OpenAI Responses 协议，保留 Chat Completions 协议作为旧网关兼容选项。
- 统一支持纯文本调用和结构化输出调用，结构化输出模式至少覆盖 `json_schema`、`json_object` 和 `prompt_schema`，满足意图解析、候选重排、日报摘要、grounded 洞察和合同审核等现有场景。
- 治理页支持通过 OpenAI 兼容 HTTP Profile 接入 Qwen、DeepSeek、GLM 等市面常见 Chat Completions 兼容模型；管理员可选择平台预设或手工填写 Base URL、模型名、协议类型和结构化输出模式。
- 后续新增模型若兼容 OpenAI HTTP 协议，原则上只需在治理页面新增或复制 Profile 配置，不需要修改业务代码；只有当模型不兼容 OpenAI HTTP 协议时，才需要新增后端 adapter。
- 企业微信机器人需要上下文时继续复用现有会话与上下文仓储，由应用层显式传入工作记忆、上一轮问题、上一轮结果摘要、待确认草稿、活跃任务标签和候选集合，不依赖模型端线程或 SDK 会话状态。
- Web 智能分析和合同审核的 AI 调用默认按一次性请求处理；解释型追问仍可复用系统保存的上一轮结果摘要，但不得依赖 provider 侧会话状态。
- AI Profile 治理页新增或调整接入类型为 `openai-compatible-http`，并收敛不再需要的 CLI / MCP / Agent 工具字段。
- 环境默认 AI 配置引导从 Codex/Claude SDK 档案调整为 OpenAI 兼容 HTTP 档案，继续复用 `ANALYSIS_AI_*`、`OPENAI_API_KEY` 和协议配置。
- 后续实施阶段移除业务链路中的 Codex SDK fallback，并删除不再需要的 Agent SDK 依赖。
- **BREAKING**：既有 `codexPath`、Claude CLI 路径、MCP 服务器校验、Agent 工具白名单等字段不再作为新版主运行时配置；历史 Profile 需要迁移或转换为 OpenAI 兼容 HTTP Profile 后再激活。

## Capabilities

### New Capabilities

- `ai-openai-compatible-http-runtime`：定义服务端通过 OpenAI 兼容 HTTP 协议执行文本与结构化模型调用的运行时能力，包括协议选择、鉴权、超时、`json_schema` / `json_object` / `prompt_schema` 结构化输出、上下文输入和失败降级边界。

### Modified Capabilities

- `ai-model-profile-governance`：将治理目录从首批支持 Codex SDK / Claude SDK 调整为支持 OpenAI 兼容 HTTP Profile，并明确不再要求本地 CLI / Agent SDK 连通性验证。
- `ai-model-runtime-bootstrap`：将环境默认 AI 档案引导从 Codex / Claude SDK 档案调整为 OpenAI 兼容 HTTP 档案，保留后台无激活 Profile 时的环境兜底。

## Impact

- 后端模块：`backend/src/modules/ai-models/`、`backend/src/modules/analysis/ai-gateway.service.ts`、`backend/src/modules/contract-review/contract-review.ai-review.service.ts`、`backend/src/shared/config/local-runtime-config.service.ts`、`backend/src/shared/types/domain.ts`。
- 企业微信上下文模块：`backend/src/modules/wecom/wecom-ai-conversation-orchestration.service.ts`、`backend/src/modules/wecom/wecom-bot.service.ts`、`backend/src/modules/wecom/wecom-conversation-context.repository.ts`、`backend/src/modules/sessions/query-session.repository.ts`。
- 前端治理页面：`frontend/src/pages/governance/AiModelProfilePage.vue`、`frontend/src/components/governance/AiProfileFormDrawer.vue`、`frontend/src/components/governance/AiProfileHealthCheckDialog.vue` 及相关 Profile 展示组件。
- 依赖管理：后续可移除 `@openai/codex`、`@openai/codex-sdk`、`@anthropic-ai/claude-agent-sdk` 及其锁文件条目；不新增 OpenAI npm SDK 依赖，优先使用 Node.js 20 内置 `fetch`。
- 配置与文档：需要同步更新 `README.md`、`docs/architecture/ai-model-profile-governance.md`、`specs/001-crm-intelligent-analytics/quickstart.md` 中关于 Codex SDK、Claude SDK、CLI 路径、MCP 校验和协议字段的描述。
- 测试：需要补充 OpenAI 兼容 HTTP adapter 单测、AI Profile 治理契约测试、运行时配置解析测试、Qwen / DeepSeek / GLM 风格配置样例测试、Web 问数 / 企业微信语义 / 合同审核的统一执行门面回归测试。

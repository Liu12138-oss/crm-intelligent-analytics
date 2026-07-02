# ai-model-runtime-bootstrap Specification

## Purpose
TBD - created by archiving change sync-env-ai-profiles-with-single-activation. Update Purpose after archive.
## Requirements
### Requirement: 系统必须从环境配置引导默认 AI 档案
系统 MUST 在治理能力初始化时读取本地环境中的 OpenAI 兼容 HTTP 相关配置，并将可识别的环境配置引导为后台可见的默认 AI 档案。每条环境默认档案 MUST 标记来源、最近引导时间和缺失字段提示；对于已被管理员手工编辑过的同名保留档案，系统 MUST NOT 在后续启动时强制覆盖其配置内容。环境引导 MUST 优先读取 `ANALYSIS_AI_BASE_URL`、`ANALYSIS_AI_MODEL_PROVIDER`、`ANALYSIS_AI_MODEL`、`ANALYSIS_AI_REASONING_EFFORT`、`ANALYSIS_AI_WIRE_API`、`ANALYSIS_AI_STRUCTURED_OUTPUT_MODE`、`ANALYSIS_AI_SERVICE_TIER` 和 `OPENAI_API_KEY` 等键位，并生成 OpenAI 兼容 HTTP Profile，而不是默认生成依赖本地 CLI 的 Codex SDK 或 Claude Agent SDK Profile。

#### Scenario: 系统发现完整的 OpenAI 兼容 HTTP 环境配置
- **WHEN** 系统读取到完整的 `ANALYSIS_AI_*` 与 `OPENAI_API_KEY` 配置，且后台尚不存在对应的 OpenAI 兼容 HTTP 环境默认档案
- **THEN** 系统必须自动创建一条来源为环境默认的 OpenAI 兼容 HTTP 档案
- **THEN** 该档案必须在治理列表中展示为可测试、可启用的默认配置
- **THEN** 该档案必须包含协议类型和结构化输出模式；若未显式配置，系统必须按默认规则补齐
- **THEN** 该档案不得要求配置本地 Codex 可执行路径、Claude CLI 路径或 MCP 配置

#### Scenario: 系统发现不完整的 HTTP 环境配置
- **WHEN** 系统读取到模型服务地址或模型名，但缺少密钥、协议类型或其它必需运行时字段
- **THEN** 系统必须仍然创建或更新一条来源为环境默认的 OpenAI 兼容 HTTP 档案摘要
- **THEN** 该档案必须记录明确缺失提示
- **THEN** 在管理员补齐缺失字段并测试通过前，该档案不得被启用为当前生效配置

#### Scenario: 系统发现旧 Claude 环境键位
- **WHEN** 系统只读取到 `ANTHROPIC_BASE_URL`、`ANTHROPIC_AUTH_TOKEN`、`CLAUDE_API_KEY` 或其它 Claude Agent SDK 专用键位
- **THEN** 系统可以创建历史迁移提示或待补齐草稿
- **THEN** 系统不得将其直接引导为新版 OpenAI 兼容 HTTP 可激活档案
- **THEN** 管理员必须显式确认服务地址兼容 OpenAI HTTP 协议并补齐密钥后才能测试激活

### Requirement: 系统必须在后台缺少可用启用项时保留环境兜底链路
当后台尚未形成可用启用档案时，系统 MUST 继续保留现有环境默认 AI 运行时兜底，避免企业微信 AI 理解、Web 问数和合同审核因治理目录尚未完成初始化而中断。

#### Scenario: 后台没有当前启用档案
- **WHEN** 后台不存在可用的启用档案，或当前引导出的环境默认档案仍有缺失字段
- **THEN** 系统必须继续按现有环境变量解析默认 AI 运行时配置
- **THEN** 业务调用链路不得因为治理目录为空或默认档案待补齐而直接报“未配置 AI 模型”

### Requirement: 系统必须为环境默认 AI 档案补齐缺省推理等级
系统 MUST 在引导环境默认 AI 档案时补齐 `reasoningEffort`。当本地环境配置未显式提供推理等级时，系统 MUST 为环境默认 Codex / Claude 档案写入最低推理等级，避免环境默认档案在治理页面和运行时解析中继续以空值存在。

#### Scenario: 系统发现未声明推理等级的 Codex 环境配置
- **WHEN** 系统读取到完整的 Codex 环境配置，但未读取到显式推理等级
- **THEN** 系统自动创建的环境默认 Codex 档案必须写入最低推理等级
- **THEN** 该档案在治理页面中必须展示该默认值

#### Scenario: 系统发现未声明推理等级的 Claude 环境配置
- **WHEN** 系统读取到可引导的 Claude 环境配置，但未读取到显式推理等级
- **THEN** 系统自动创建的环境默认 Claude 档案必须写入最低推理等级
- **THEN** 管理员后续打开该档案进行编辑时必须看到该默认值，而不是空白

### Requirement: 系统必须保留历史 Agent SDK 档案的迁移提示
系统 MUST 在环境引导或治理目录初始化时识别历史 Codex SDK / Claude Agent SDK 档案，并为管理员提供迁移提示。系统 MUST NOT 静默把依赖本地 CLI、MCP 或 Agent 工具字段的历史 Profile 当作新版 OpenAI 兼容 HTTP Profile 激活；只有在管理员确认配置、完成真实 HTTP 健康检查后，迁移后的 Profile 才可成为当前生效配置。

#### Scenario: 发现历史 Codex SDK 默认档案
- **WHEN** 治理目录中已经存在来源为环境默认的 Codex SDK 档案
- **THEN** 系统必须保留该档案的非敏感摘要
- **THEN** 系统必须提示管理员将其迁移为 OpenAI 兼容 HTTP Profile 后再测试激活
- **THEN** 系统不得继续要求部署环境安装本地 `codex` 命令来验证新版运行时

#### Scenario: 发现历史 Claude Agent SDK 默认档案
- **WHEN** 治理目录中已经存在来源为环境默认的 Claude Agent SDK 档案
- **THEN** 系统必须保留该档案的非敏感摘要
- **THEN** 系统必须提示 Claude CLI、MCP 和工具白名单字段不会进入新版 OpenAI 兼容 HTTP 主运行时
- **THEN** 系统不得静默把 MCP 校验状态作为新版 HTTP Profile 的激活依据


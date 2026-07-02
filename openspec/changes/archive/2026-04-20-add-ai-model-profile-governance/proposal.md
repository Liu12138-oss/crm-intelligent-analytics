## Why

当前后端 AI 运行时仍以单份 `ANALYSIS_AI_*` 配置为主，默认服务于 Codex SDK；当企业微信机器人链路遇到响应慢、需要切换到 Claude SDK，或后续继续接入其它模型时，只能改 `.env.local` 或本地配置文件，切换效率低，也缺少统一治理、真实可用性校验、审计和回退能力。现在需要把 AI 模型配置提升为后台可管理能力，让管理员可以维护多 Provider / 多 Profile，并在不暴露密钥的前提下快速切换全系统当前生效配置，同时确保首批 Codex 与 Claude 两类 SDK 都能通过真实调用验证。

## What Changes

- 新增后台 AI 模型治理能力，支持管理员维护多 Provider / 多 Profile 的完整配置，包括 provider 标识、SDK 类型、baseUrl、model、推理档位、协议类型、超时与密钥等运行时参数。
- 新增“全系统当前生效 AI 配置”切换机制，企业微信机器人、Web 智能分析、合同审核等统一从当前激活 Profile 读取 AI 运行时配置，不再各自只读单份环境变量。
- 新增统一 AI Provider 适配层，首批内置 `@openai/codex-sdk` 与 Claude SDK 适配器，避免业务模块直接耦合到某一家 SDK 的实例化细节。
- 新增 AI 模型治理页面，作为 Web 治理后台的新入口，支持配置列表、当前激活状态、快速切换、新增编辑、复制配置、启停状态、连通性校验和切换反馈。
- 新增密钥保护约束：后台列表、详情回显、接口返回和审计展示中不得返回真实密钥，仅允许展示掩码、更新时间和是否已配置；密钥更新必须按“留空不改、显式输入才覆盖”的规则处理。
- 新增配置持久化与审计留痕，记录 Profile 的创建、修改、启停、切换、测试连接和失败原因，支持回溯“何时由谁把系统切到哪套 AI 配置”。
- 新增真实可用性验证链路，切换前后必须通过后台代码发起一次真实 SDK 调用；Claude SDK 额外支持用 MCP 连接状态做扩展验证，避免只做静态表单校验就误判可用。
- 将当前 `LocalRuntimeConfigService` 的单份 AI 配置解析方式扩展为“环境默认值 + 后台治理配置”的统一解析顺序，并为后续新增其它模型 Provider 预留扩展字段。
- 将设计文档补充为可执行的技术改造说明，明确模块拆分、组件封装、SDK 安装方式、切换实现思路以及后续新增模型时应扩展的适配器入口。

## Capabilities

### New Capabilities
- `ai-model-profile-governance`: 定义 AI 多 Provider / 多 Profile 的后台治理、密钥保护、全局激活切换、运行时统一解析和审计要求。

### Modified Capabilities

## Impact

- 影响后端 `backend/src/shared/config`、`backend/src/modules/governance`、新增 AI Provider 适配模块、`backend/src/modules/analysis`、`backend/src/modules/contract-review`、`backend/src/modules/audit` 和应用存储模型，需要新增 AI Profile 持久化、激活切换、真实连通性测试与统一读取逻辑。
- 影响前端 `frontend/src/layouts`、`frontend/src/router`、`frontend/src/pages/governance`、`frontend/src/services` 与相关类型定义，需要新增治理页面、导航入口和 AI 配置管理接口。
- 影响 `backend/package.json` 与安装说明，需要补充 Claude SDK 依赖、Provider 适配层测试和未来新增模型的接入规范。
- 影响运行时配置来源与运维文档，需要补充 `.env.example`、快速开始和治理操作说明，明确后台配置与环境变量的覆盖关系、密钥保护、真实测试方式与回滚方式。

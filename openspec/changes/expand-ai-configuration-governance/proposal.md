## Why

当前治理后台已经提供 AI Profile 的新增、编辑、测试和激活能力，但“AI 模型”菜单名称过窄，无法承载管理员对 AI 运行时其它关键策略的统一治理。另一方面，企业微信会话追问、Web 解释型追问和结果摘要复用已经依赖应用层上下文，但上下文长度与失活时间仍主要由代码内固定值控制，管理员无法在后台按运行反馈做收敛调整，也无法把“为什么这次追问失效”与当前 AI 配置一起排查。

现在需要把 AI Profile 治理入口升级成统一的“AI配置”中心：既继续管理模型接入参数，也要集中管理 AI 上下文保留与过期策略，并保证后台展示全部使用中文业务文案，不把 `latestQuestion`、`latestSummary` 这类内部字段直接暴露给治理用户。

## What Changes

- 将治理后台“AI模型”菜单统一重命名为“AI配置”，保持原有权限边界与路由能力不变，但让导航、页面标题、权限说明和操作反馈统一使用新的中文名称。
- 在现有 AI Profile 治理页内新增“上下文策略”治理区，允许管理员配置上一轮问题保留上限、上一轮结果摘要保留上限、历史轮次压缩阈值、普通分析会话失活时长和任务态会话失活时长。
- 为上下文策略补充统一的后端持久化、读写接口、表单校验、默认值和治理回显，避免继续依赖代码里的硬编码阈值。
- 将企业微信会话编排、Web 解释型追问与改条件追问、结果摘要复用和历史轮次压缩统一改为消费后台上下文策略，而不是继续散落在不同服务里各自写死长度或时间常量。
- 明确后台治理文案必须使用中文业务表述，例如“上一轮问题保留上限”“上一轮结果摘要保留上限”，不得把内部实现字段名直接展示给用户。
- 为上下文裁剪、超时失效、追问复用失败和治理更新补充审计与验证要求，确保管理员能够确认配置生效范围和触发原因。

## Capabilities

### New Capabilities
- `ai-context-governance-policy`: 定义 AI 上下文长度、摘要压缩和失活时间策略的后台治理、中文文案约束、运行时持久化与统一生效边界。

### Modified Capabilities
- `ai-model-profile-governance`: 将现有 AI 模型治理入口扩展为“AI配置”中心，并要求在同一治理目录下同时承载 AI Profile 治理与上下文策略治理。
- `ai-entry-intent-orchestration`: 将企业微信空闲态 / 活跃态 AI 理解与工作记忆裁剪改为消费后台可配置的上下文长度与会话失活策略。
- `controlled-analysis-orchestration`: 将 Web 解释型追问、改条件追问、结果摘要复用和历史结果继续分析改为消费后台可配置的上下文保留与超时策略。

## Impact

- 影响前端 `frontend/src/layouts/AppShell.vue`、`frontend/src/router/index.ts`、`frontend/src/pages/governance/AiModelProfilePage.vue`、相关治理组件、业务文案映射和类型定义，需要把页面入口、标题、分区结构和表单交互统一调整为“AI配置”。
- 影响后端 `backend/src/modules/governance`、`backend/src/shared/types/domain.ts`、`backend/src/shared/mock/sample-data.ts`、AI 配置治理接口以及现有策略仓储，需要扩展上下文策略字段、校验规则和治理返回模型。
- 影响 `backend/src/modules/wecom/wecom-ai-conversation-orchestration.service.ts`、`backend/src/modules/wecom/wecom-bot.service.ts`、`backend/src/modules/analysis/analysis.service.ts` 等上下文消费链路，需要把固定裁剪值和失活判断改成统一策略读取。
- 影响审计、联调与操作文档，需要补充“AI配置中心”命名、上下文策略说明、默认值口径、超时失效行为和配置生效验证步骤。

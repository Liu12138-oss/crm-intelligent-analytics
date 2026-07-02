## Why

当前智能合同审核虽然已经完成上传、结果展示、产物生成和审计闭环，但核心审核标准仍主要固化在后端代码中，并在 AI 不可用时回退到简单关键词命中。这种实现无法满足商务人员对“像 AI + skill 一样审合同”的预期，也不利于后续按文档维护审核标准、提升语义判断能力和沉淀可追溯的审核依据。

## What Changes

- 将合同审核标准从硬编码 `rule-set.ts` 升级为外部 `skill pack` 驱动，使用版本化文档和配置描述检查项、工作流、提示词和执行策略。
- 将合同审核主链路升级为“确定性规则快审优先 + AI 补充审核”的受控编排，而不是以关键词命中作为默认兜底主路径。
- 为每个审核任务固化 `skill pack` 版本、模型信息、提示词摘要、执行模式和校验器结果，提升可审计性与可复盘性。
- 在结果详情中补充“审核依据版本 / 执行模式 / 规则快审或降级快审提示 / AI 补充审核状态”，让商务人员知道当前结果是否来自完整 AI 混合审核。
- 保留现有工作台、权限、产物和风险优先展示结构，不新起独立系统，不引入独立在线规则编辑后台。

## Capabilities

### New Capabilities
- `contract-review-skill-runtime`: 以版本化 `skill pack` 文档和配置驱动合同审核标准、执行策略与任务快照。

### Modified Capabilities
- `contract-review-orchestration`: 将审核链路升级为确定性规则快审优先、AI 补充审核追加的受控编排，并在 AI 不可用时进入受控降级模式。
- `contract-review-auditability`: 为任务、问题、产物和审计事件补充 `skill pack`、模型、提示词和执行模式追溯信息。
- `contract-review-workbench`: 在风险优先结果页中展示审核依据版本、规则快审或降级快审提示，以及 AI 补充审核状态，帮助业务理解当前结果来源。

## Impact

- 受影响后端模块：`backend/src/modules/contract-review/*`、运行时配置装载、应用库存储模型、审计事件模型。
- 受影响前端模块：合同审核结果详情页与最近任务摘要展示。
- 受影响文档与资产：`智能合同审核系统相关资料/contract-review/`、OpenAPI、quickstart、测试清单、OpenSpec 主 specs。
- 可能新增依赖：Markdown/YAML 解析、提示词模板装载与 `skill pack` 校验相关工具。

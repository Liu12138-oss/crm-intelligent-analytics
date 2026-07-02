## Why

当前 AI 模型治理虽然已经支持 `Codex SDK` 与 `Claude SDK` 的手工维护、测试和激活，但运行时默认配置仍主要停留在 `backend/.env.local` 的单份 Codex 路径，Claude 也只是“可填写”而非“已实际接入”。这导致管理员首次落地时仍要手工把环境配置再录一遍，且列表同时存在“状态”和“激活”两套语义，不符合“最后只能单选启用一个”的治理诉求。

## What Changes

- 新增环境默认 AI 档案同步能力：系统启动或治理页初始化时，读取 `backend/.env.local` 中现有的 Codex 与 Claude 相关配置，自动生成或刷新两条默认 AI Profile，避免管理员首次上线时重复录入。
- 新增环境来源标记与同步摘要：治理页需要明确区分“来源于环境默认值的档案”和“后台手工维护的档案”，并展示最近同步时间、缺失字段提示和是否允许继续编辑。
- **BREAKING** 将当前列表中的“状态 + 激活”双轨治理收敛为“单选启用”模式：同一时刻最多只能有一条配置处于启用并生效状态，管理员切换时系统自动取消上一条已启用项。
- 调整 AI 模型列表交互：列表改为单选启用控件，操作区围绕“编辑、测试、复制”收敛，不再要求管理员同时理解“启用”和“激活”两套概念。
- 在 AI 模型配置抽屉中新增“测试连接”能力与测试按钮，支持管理员在保存前或编辑过程中直接验证当前表单内容，而不是只能回到列表后再点测试。
- 扩展后端校验与解析顺序：当存在环境默认档案时，企业微信 AI 理解、Web 问数和合同审核继续统一读取“当前单选启用项”；若后台尚未形成可用档案，则仍允许回退现有环境默认配置，避免中断现有链路。
- 补充前后端测试与文档，覆盖环境档案同步、单选启用约束、配置页测试按钮、Codex/Claude 默认档案展示以及失败反馈。

## Capabilities

### New Capabilities
- `ai-model-runtime-bootstrap`: 定义从环境配置自动生成 Codex / Claude 默认 AI 档案、在治理页展示来源与同步状态，以及缺失配置时的降级规则。
- `ai-model-governance-exclusive-selection`: 定义 AI 模型列表单选启用、配置页内测试按钮、单条启用即生效和管理员反馈流程。

### Modified Capabilities
<!-- 无。当前主规格基线尚未存在已归档的 AI 模型治理能力目录，本次以新增正式能力收敛现状。 -->

## Impact

- 影响后端 `backend/src/shared/config/local-runtime-config.service.ts`、`backend/src/modules/ai-models/*`、`backend/src/modules/governance/ai-model-governance.controller.ts` 的环境配置解析、默认档案生成、唯一启用约束与测试接口。
- 影响前端 `frontend/src/pages/governance/AiModelProfilePage.vue`、`frontend/src/components/governance/AiProfileTable.vue`、`frontend/src/components/governance/AiProfileFormDrawer.vue`、`frontend/src/services/analysis.service.ts` 与相关类型定义。
- 影响单元测试与契约测试，尤其是 `frontend/tests/unit/ai-model-profile-page.spec.ts`、后端 AI 模型治理测试、环境兜底解析测试。
- 影响 `backend/.env.example`、`specs/001-crm-intelligent-analytics/quickstart.md` 等文档，需要补充 Codex / Claude 环境键位如何映射为默认档案，以及“列表单选启用”的新操作口径。

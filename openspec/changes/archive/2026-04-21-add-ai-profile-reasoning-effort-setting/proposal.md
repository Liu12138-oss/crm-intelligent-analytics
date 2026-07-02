## Why

当前 AI Profile 治理后端已经保留 `reasoningEffort` 字段，但治理后台的新增/编辑抽屉没有把“推理等级”作为可编辑配置项，导致管理员无法显式控制模型速度与推理深度，也无法统一把新建档案默认落在最快档位。现在需要把推理等级补齐为正式治理能力，让新建、复制、环境引导和手工补齐后的默认行为都可预期且可审计。

## What Changes

- 在 AI 模型治理后台的新增/编辑配置抽屉中新增“推理等级”可编辑项，作为 Codex / Claude Profile 的通用治理字段展示。
- 为 AI Profile 的新建、复制、环境默认档案引导和缺省保存补充统一默认值策略：当管理员未显式填写推理等级时，系统默认写入最低等级，以优先保障响应速度。
- 明确治理页、接口返回、健康检查上下文和当前激活摘要中的推理等级展示与回写规则，避免字段只在后端存在但前端不可见。
- 明确运行时消费约束：当前已支持显式推理等级映射的 Provider 必须消费该字段；暂未支持显式映射的 Provider 仍需保留该配置并在文档中说明当前行为边界。
- 更新 AI 模型治理与环境引导规格，补充“默认最低等级”“可编辑可回显”“环境默认档案缺省补齐”的验收口径。

## Capabilities

### New Capabilities

### Modified Capabilities

- `ai-model-profile-governance`: 增加 AI Profile 推理等级的可编辑、可展示、可持久化与默认最低等级要求。
- `ai-model-runtime-bootstrap`: 增加环境默认 AI 档案在缺少显式推理等级时自动补齐最低等级的要求。

## Impact

- 影响前端 `frontend/src/components/governance/AiProfileFormDrawer.vue`、治理页相关类型与服务调用，需要新增推理等级表单项、默认值策略和展示文案。
- 影响后端 `backend/src/modules/governance`、`backend/src/modules/ai-models`、`backend/src/shared/config`，需要统一推理等级缺省写入、环境默认档案补齐和运行时解析口径。
- 影响 OpenSpec 中 AI 模型治理与环境引导两条既有规格，需要补充新的 requirement / scenario。
- 影响相关文档与操作说明，需要同步说明“默认最低等级优先速度”的治理策略，以及不同 Provider 对推理等级的实际消费边界。

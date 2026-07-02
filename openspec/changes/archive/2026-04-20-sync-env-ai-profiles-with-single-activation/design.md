## Context

当前仓库已经有一套可运行的 AI 模型治理实现：

- 后端存在 `AiModelProfileService`、`AiProfileActivationService`、`AiHealthCheckService`、`AiRuntimeConfigResolver` 与 Codex / Claude 两类 adapter；
- 前端已有 `AiModelProfilePage`、列表、配置抽屉和列表级“测试 / 激活”按钮；
- 运行时真实兜底仍由 `LocalRuntimeConfigService.getAiConfig()` 提供，默认只消费 `ANALYSIS_AI_*` + `OPENAI_API_KEY` 这一组 Codex 风格环境变量。

这带来三个现实缺口：

1. `backend/.env.local` 里的 Codex 与 Claude 相关配置没有真正落成后台可见档案，管理员首次使用治理页还要重复录入。
2. 当前列表同时存在“状态”和“激活”两套语义，管理员可以看到多条 `ACTIVE`，但真正生效的只有 `activation.activeProfileId`，不符合“最后单选启用一个”的心智。
3. 配置抽屉只有“保存”，没有“测试连接”；管理员必须先保存再回到列表测试，无法直接验证当前表单内容。

另外，现有 `backend/.env.local` 已确认存在：

- Codex：`ANALYSIS_AI_BASE_URL`、`ANALYSIS_AI_MODEL_PROVIDER`、`ANALYSIS_AI_MODEL`、`ANALYSIS_AI_REASONING_EFFORT`、`ANALYSIS_AI_SERVICE_TIER`、`OPENAI_API_KEY`
- Claude：`ANTHROPIC_BASE_URL`、`ANTHROPIC_AUTH_TOKEN`

但尚未看到独立 Claude 模型名键位。因此设计必须允许“环境档案已识别，但仍有缺失字段需要管理员补齐”这一状态，不能假设 Claude 永远能一次性自动启用。

## Goals / Non-Goals

**Goals:**

- 将 `backend/.env.local` 中现有的 Codex / Claude 配置自动落成后台 AI Profile，避免首次上线重复录入。
- 让治理页明确展示档案来源、缺失字段和最近引导状态，管理员能知道哪些配置来自环境默认值。
- 将治理交互收敛为“列表单选启用且只能启用一个”，减少“状态 / 激活”双概念。
- 在配置抽屉内增加表单级测试按钮，支持保存前直接 smoke test。
- 保持企业微信 AI 理解、Web 问数和合同审核继续统一读取唯一生效配置，并在没有后台可用档案时保留环境兜底。

**Non-Goals:**

- 不做多模型并行启用、按业务线分模、A/B 测试或流量分配。
- 不在本次引入“环境配置双向同步”或“后台修改自动回写 `.env.local`”。
- 不在本次重写现有 Codex / Claude adapter 的调用协议，只复用现有适配层。
- 不把“列表单选启用”扩展成复杂审批流或变更审核流程。

## Decisions

### 决策 1：新增 `AiModelEnvBootstrapService`，以“缺失时自动落表”为主，不覆盖管理员已编辑档案

后端新增环境档案引导服务，建议放在 `backend/src/modules/ai-models/ai-model-env-bootstrap.service.ts`，职责是：

- 读取 `LocalRuntimeConfigService` 中现有 Codex 默认配置；
- 读取新增的 Claude 环境读取方法，识别 `ANTHROPIC_BASE_URL`、`ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN`、可选 `ANTHROPIC_MODEL`；
- 将识别结果映射成两条保留 `bootstrapKey` 的默认档案；
- 仅在对应保留档案不存在时自动创建；
- 对已存在且已经被管理员编辑过的档案不做强制覆盖。

建议为 `AiModelProfileRecord` 增加以下元数据：

```ts
sourceType: 'MANUAL' | 'ENV_BOOTSTRAPPED';
bootstrapKey?: 'env_codex_default' | 'env_claude_default';
bootstrapWarnings?: string[];
lastBootstrapAt?: string;
```

其中：

- `sourceType` 用于前端展示“环境默认”标签；
- `bootstrapKey` 作为环境默认档案的稳定主键；
- `bootstrapWarnings` 用于展示“缺少模型名”“缺少密钥”等补齐提示；
- `lastBootstrapAt` 用于摘要卡和列表提示最近引导时间。

采用“缺失时自动落表”的原因：

- 用户明确希望“把 Codex 和 Claude 实际配置上去”，因此不能只保留环境兜底而后台列表为空；
- 但如果每次启动都强刷，会覆盖管理员在页面上补齐 Claude 模型名或调整其它字段后的结果；
- 单向 bootstrap 比“持续同步”更安全，也更容易解释。

备选方案：

- 每次启动强制同步环境默认档案。缺点是会覆盖手工修正内容。
- 完全不落表，只在页面临时拼装环境默认项。缺点是测试、审计、启用状态都难以与现有 Profile 机制复用。

### 决策 2：Claude 环境档案允许以“待补齐”状态进入后台，而不是因为缺少模型名直接忽略

当前 `backend/.env.local` 已识别到 Claude 的地址与鉴权，但未发现模型名键位。设计上不应直接丢弃这条档案，而应：

- 仍然创建 `Claude` 环境档案；
- 将 `model` 留空并写入 `bootstrapWarnings=['缺少 Claude 模型名']`；
- 阻止该档案通过测试与启用；
- 允许管理员进入配置抽屉补齐模型名后，再直接点击“测试连接”。

同时补充 `.env.example` 与快速开始文档，新增推荐键位：

- `ANTHROPIC_MODEL`

若未来仍使用其它键名（如 `CLAUDE_MODEL`），只允许在 `LocalRuntimeConfigService` 内部兼容读取，不把分支散落到业务层。

采用“待补齐”而不是“忽略”的原因：

- 用户已经说明 Claude 相关配置在 `env.local`；
- 页面应真实反映“系统发现了 Claude 接入信息，但还差最后一步”；
- 这能直接解释为什么要在配置抽屉里增加测试按钮。

### 决策 3：保留现有 `activate` 服务语义，但把它升级为“单选启用”操作

当前后端运行时真实来源是 `aiModelActivation.activeProfileId`，但列表又允许多条记录保持 `status='ACTIVE'`。本次不重写运行时入口，而是收敛语义：

- `activate` 仍作为唯一启用入口；
- 激活成功后，目标 Profile 的 `status` 设为 `ACTIVE`，其它 Profile 统一回写为 `INACTIVE`；
- 前端列表不再暴露独立“停用 / 启用”按钮，只保留单选启用控件；
- `activation.activeProfileId` 继续作为运行时唯一真值，避免影响 `AiRuntimeConfigResolver`。

这样可以最小化后端改动：

- `AiProfileActivationService.activateWithVerification()` 负责切换成功后的唯一化回写；
- `AiModelProfileService.setStatus()` 与 `/status` 接口本轮不再作为页面主入口，先保留兼容，后续再决定是否删除。

备选方案：

- 删除 `activation` 记录，只用 `status` 表示当前启用项。缺点是会扩大 `AiRuntimeConfigResolver`、审计和现有测试的改动面。

### 决策 4：新增“草稿测试”接口，配置抽屉测试不依赖先保存

当前 `health-check` 只支持针对已保存的 `profileId` 调用，无法满足“抽屉里先测试再保存”的需求。因此新增一个草稿测试接口，建议路径：

- `POST /governance/ai-models/draft-health-check`

请求体沿用 `aiModelProfileWriteSchema`，但增加两条处理规则：

1. 新建草稿：直接使用本次请求里的 `apiKey`、`model`、`baseUrl`、`sdkOptions` 进行静态校验与 smoke test。
2. 编辑已有档案：若 `apiKey` 留空且请求体包含 `profileId`，后端复用已保存密钥，仅以当前表单内容覆盖其它字段进行测试。

这样前端可以：

- 在抽屉 footer 中增加 `测试连接` 按钮；
- 点击后直接展示成功 / 失败、耗时、失败阶段；
- 只有用户确认通过后再点击保存。

列表级 `测试` 按钮保留，用于对已保存配置做回归验证；两者底层都复用 `AiHealthCheckService`，只是数据来源不同。

### 决策 5：环境档案首次引导时自动选中 Codex 默认项，以保持现有运行时行为连续

当前系统若后台未激活 Profile，会回退到 `ANALYSIS_AI_*` 的 Codex 默认配置。为了避免本次引导后页面出现两条环境档案但“一个都没启用”的认知断层，启动 bootstrap 时采用以下规则：

- 若系统当前没有 `activeProfileId`，且 Codex 环境档案字段完整并可测试通过，则自动将其设为当前启用项；
- 若已有后台启用项，bootstrap 不改动现有启用结果；
- 若 Codex 环境档案本身不完整，则保持无启用项，由运行时继续使用旧环境兜底。

这样做的原因：

- 对现有链路最稳，用户不会因为接入治理页而突然失去当前 Codex 默认模型；
- Claude 默认档案存在但未补齐时，也不会误抢当前生效配置。

### 决策 6：前端列表与抽屉同时补充来源、缺失提示与测试反馈

前端组件层面的收敛如下：

- `AiProfileTable.vue`
  - 新增“来源”展示（环境默认 / 手工维护）；
  - 将“状态 + 激活”收敛为单一“启用”列，使用 radio 或等价单选控件；
  - 移除列表中的“停用 / 启用”按钮；
  - 保留“编辑、复制、测试”操作。

- `AiProfileFormDrawer.vue`
  - 新增 `sourceType`、`bootstrapWarnings` 只读提示区；
  - footer 调整为“取消 / 测试连接 / 保存”；
  - 为测试态单独维护 `testing` 与 `testResult`，避免和 `saving` 混用；
  - 若表单字段未通过本地必填校验，测试按钮直接提示，不发请求。

- `AiModelProfilePage.vue`
  - 新增环境引导摘要，如“已发现 2 条环境默认配置，其中 1 条待补齐”；
  - 启用切换后统一刷新摘要卡、列表和最近验证状态。

## Risks / Trade-offs

- [Claude 环境变量缺少模型名] → 允许生成“待补齐”档案并在页面明确提示，阻止误启用。
- [环境默认档案与管理员手工修改可能产生漂移] → 本次采用“缺失时自动落表，不强制覆盖已编辑记录”；文档明确后续如需重新同步，应通过单独入口实现。
- [单选启用会改变管理员既有操作习惯] → 保留现有 `activate` 接口与摘要卡，只收敛页面心智，减少一次性重构范围。
- [草稿测试新增接口后，密钥更容易被误打到日志] → 请求日志和审计只记录测试结论、失败阶段与 Profile 标识，不记录草稿密钥原文。
- [自动选中 Codex 默认项可能掩盖后台“尚未启用任何档案”的事实] → 仅在原本就依赖环境默认 Codex 的场景下执行自动选中，并在摘要卡明确标注来源为“环境默认”。

## Migration Plan

1. 扩展 `AiModelProfileRecord` 与前端类型，增加环境来源与引导警告字段。
2. 在后端新增 `AiModelEnvBootstrapService`，完成 Codex / Claude 环境映射与缺失时自动落表。
3. 为 Claude 环境默认配置补充推荐键位 `ANTHROPIC_MODEL`，同步更新 `.env.example`、`quickstart.md`。
4. 改造 `AiProfileActivationService`，让激活动作在验证成功后自动把其它档案回写为 `INACTIVE`。
5. 新增草稿测试接口，并让配置抽屉接入“测试连接”按钮。
6. 改造治理页列表为单选启用心智，移除页面层面的双状态操作。
7. 补齐前后端单测、契约测试与文档，验证 Codex 默认档案可自动落表且保持当前默认生效，Claude 档案在缺少模型名时能提示补齐。

## Open Questions

- 环境默认档案后续是否需要提供“从环境重新同步”按钮。当前设计假设先不做，避免覆盖管理员手工修正内容；若后续确需支持，可在不改变本次单选启用与抽屉测试主链的前提下追加入口。

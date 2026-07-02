## Context

当前仓库的 AI 运行时能力已经明显依赖 `@openai/codex-sdk`：

- [ai-gateway.service.ts](/d:/code/CRM/backend/src/modules/analysis/ai-gateway.service.ts) 负责问数、企业微信意图理解、日报摘要等主链路；
- [contract-review.ai-review.service.ts](/d:/code/CRM/backend/src/modules/contract-review/contract-review.ai-review.service.ts) 负责合同审核的 AI 编排；
- [local-runtime-config.service.ts](/d:/code/CRM/backend/src/shared/config/local-runtime-config.service.ts) 仍只解析单份 `ANALYSIS_AI_*` / `OPENAI_API_KEY` 风格配置。

当前后端还没有 Claude SDK 依赖，也没有统一的“多模型 Provider 适配层”。这会直接带来几个问题：

- 切换模型只能改 `.env.local`，无法后台热切换；
- 业务模块直接耦合 Codex SDK 的初始化、配置映射和调用方式；
- 即使新增 Claude 配置，也很容易演变成在多个服务里各写一套接入逻辑；
- 没有真实 SDK smoke test，切换成功只代表“字段保存成功”，不代表“企业微信机器人真的能回”；
- 未来如果再加其它模型，会继续复制一套 `if provider === xxx` 的分支，而不是形成可扩展架构。

这次提案的目标不是只补一个配置页面，而是把“AI 模型接入”抽成独立、可测试、可扩展的模块，首批保证 Codex 和 Claude 两类 SDK 都能正常工作，并把切换验证、密钥保护、审计回溯一起定下来。

## Goals / Non-Goals

**Goals:**

- 支持管理员在后台维护多 Provider / 多 Profile 的 AI 配置，并统一激活一套全局生效配置。
- 首批保证 Codex SDK 与 Claude SDK 都能真实调用成功，而不是只做表单保存。
- 用模块化与适配器模式收口 AI 接入层，避免分析、企业微信、合同审核继续直接耦合具体 SDK。
- 支持切换前后的真实 smoke test；Claude Profile 在需要时支持 MCP 可用性附加校验。
- 保留环境变量兜底，降低迁移和回滚成本。
- 为未来新增模型定义明确扩展方式，新增模型时尽量只增 adapter，不改业务调用方。

**Non-Goals:**

- 不做按业务线分别激活不同模型；本次只允许全系统唯一激活 Profile。
- 不做模型流量路由、按请求自动选模、A/B 测试或多模型竞速。
- 不把 prompt、skill pack、审核规则包治理合并到本次变更。
- 不把“新增模型”做成无限抽象平台；首版只落 Codex / Claude 两类 SDK 的清晰实现。

## Decisions

### 决策 1：新增独立 `ai-models` 模块，而不是继续把逻辑分散在 `shared/config` 与业务服务里

后端新增独立模块，建议目录边界如下：

- `backend/src/modules/ai-models/ai-models.module.ts`
- `backend/src/modules/ai-models/ai-model-profile.service.ts`
- `backend/src/modules/ai-models/ai-profile-activation.service.ts`
- `backend/src/modules/ai-models/ai-runtime-config.resolver.ts`
- `backend/src/modules/ai-models/ai-health-check.service.ts`
- `backend/src/modules/ai-models/ai-provider-registry.service.ts`
- `backend/src/modules/ai-models/ai-secret-crypto.service.ts`
- `backend/src/modules/ai-models/adapters/ai-provider.adapter.ts`
- `backend/src/modules/ai-models/adapters/codex-provider.adapter.ts`
- `backend/src/modules/ai-models/adapters/claude-provider.adapter.ts`

治理接口仍放在治理语义下，但控制器单独拆文件：

- `backend/src/modules/governance/ai-model-governance.controller.ts`

原因：

- 这类能力已经跨分析、企业微信、合同审核三条主链，继续塞进 `LocalRuntimeConfigService` 会越改越重。
- 独立模块能让“Profile 管理”“密钥处理”“运行时解析”“SDK 调用”“健康检查”各自单一职责。

备选方案：

- 继续在 `LocalRuntimeConfigService` 上打补丁。问题是服务会同时承担配置读取、持久化、加密、切换和测试，边界失控。

### 决策 2：采用“Profile 服务 + Provider 适配器 + 统一执行门面”的分层结构

核心分层如下：

1. `AiModelProfileService`
   负责 Profile 的增删改查、复制、启停、密钥更新和静态校验。

2. `AiProfileActivationService`
   负责“全系统唯一激活”切换、切换前检查、缓存失效、回滚与审计。

3. `AiRuntimeConfigResolver`
   负责生成当前真正生效的 `AiRuntimeConfig`，顺序为：
   `激活 Profile -> 环境默认值 -> AI 不可用降级`

4. `AiProviderAdapter`
   定义统一接口：
   - `validateProfile(profile)`
   - `healthCheck(profile, options)`
   - `invokeStructured(request)`
   - `invokeText(request)`

5. `AiProviderRegistryService`
   负责按 `sdkType` 找到对应 adapter。

6. `UnifiedAiExecutionService` 或等价门面
   给 `AiGatewayService` 与合同审核服务提供稳定调用接口，屏蔽底层到底是 Codex 还是 Claude。

原因：

- 业务模块不应知道“Codex 要 startThread，Claude 要 query/messages.create”这类细节。
- 后续新增模型时，只要补 adapter 和注册表，不应该再改企业微信/分析/合同审核的主业务代码。

备选方案：

- 在 `AiGatewayService` 内直接 `if sdkType === 'codex-sdk' ... else if sdkType === 'claude-sdk' ...`。问题是合同审核还要再复制一遍，扩展性差。

### 决策 3：Profile 数据模型采用“通用核心字段 + SDK 专属扩展字段”结构

建议新增领域模型：

```ts
type AiSdkType = 'codex-sdk' | 'claude-agent-sdk';

interface AiModelProfileRecord {
  id: string;
  name: string;
  description?: string;
  providerCode: string;
  sdkType: AiSdkType;
  model: string;
  baseUrl?: string;
  secretCiphertext?: string;
  secretConfigured: boolean;
  reasoningEffort?: string;
  serviceTier?: string;
  timeoutMs?: number;
  status: 'ACTIVE' | 'INACTIVE';
  sdkOptions: Record<string, unknown>;
  lastHealthCheckAt?: string;
  lastHealthCheckStatus?: 'SUCCEEDED' | 'FAILED';
  lastHealthCheckLatencyMs?: number;
  lastHealthCheckFailureReason?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}
```

其中：

- 通用核心字段覆盖所有模型都可能用到的概念；
- `sdkOptions` 留给各 adapter 解释，避免把所有模型的专属字段平铺在顶层；
- 全局激活状态单独存放，不写在每条记录里反复同步。

Codex 首批专属字段建议放在 `sdkOptions`：

- `wireApi`
- `requiresOpenaiAuth`
- `disableResponseStorage`
- `codexPath`
- `proxyEnv`

Claude 首批专属字段建议放在 `sdkOptions`：

- `cwd`
- `maxTurns`
- `permissionMode`
- `allowedTools`
- `mcpConfigPath`
- `enableMcpValidation`
- `anthropicApiStyle`（为兼容 `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` 预留）

原因：

- 这样既能保留技术细节，又不会把模型专属字段污染通用运行时结构。
- 新增模型时，只需扩充 `sdkOptions` schema 与对应 adapter 校验器。

### 决策 4：Codex 与 Claude 采用不同 adapter，但共享同一调用门面

#### 4.1 Codex adapter

Codex adapter 复用现有稳定实现，主要把下面这些逻辑从业务服务搬出：

- `importCodexSdk()`
- `buildCodexClientOptions()`
- `buildCodexConfigOverrides()`
- `resolveCodexPathOverride()`
- `startThread().run()` 的通用包装

迁移后：

- `AiGatewayService` 不再自己 import `@openai/codex-sdk`
- 合同审核服务不再自己构建 Codex client
- 两者统一调用门面提供的 `invokeStructured` / `invokeText`

#### 4.2 Claude adapter

Claude 侧优先按当前官方 Agent SDK 文档接入 `@anthropic-ai/claude-agent-sdk`。若团队后续必须兼容旧版 Claude Code SDK 包名，只允许在 adapter 内部做兼容，不得向上层泄露差异。

安装方式写入设计与任务：

```bash
pnpm --filter crm-intelligent-analytics-backend add @anthropic-ai/claude-agent-sdk
```

Claude adapter 的实现边界：

- 动态导入 Claude SDK，避免未启用 Claude 时增加启动耦合
- 将后台存储的密钥统一映射到 SDK 所需环境
- 如现网网关仍要求 `ANTHROPIC_AUTH_TOKEN`，adapter 同时兼容注入 `ANTHROPIC_API_KEY` 与 `ANTHROPIC_AUTH_TOKEN`
- 将 `baseUrl`、`model`、`cwd`、`maxTurns`、`allowedTools`、`permissionMode`、`mcpConfigPath` 转成 SDK 初始化参数
- 为结构化调用和纯文本调用提供统一返回格式

原因：

- 用户已经明确给了 Claude 配置，并希望切换后真实可用。
- Claude SDK 与 Codex SDK 的调用风格不同，必须在 adapter 层消化差异。

备选方案：

- 使用 `@anthropic-ai/sdk` 直连 Messages API。问题是这更适合普通 API 调用，不适合当前仓库这种强调 SDK / Agent / MCP 验证的目标。

### 决策 5：业务层通过统一执行门面消费模型，不再直接依赖具体 SDK

建议新增门面接口：

```ts
interface UnifiedAiExecutionService {
  invokeStructured(params: UnifiedStructuredRequest): Promise<string>;
  invokeText(params: UnifiedTextRequest): Promise<string>;
  healthCheck(profileId: string): Promise<AiHealthCheckResult>;
}
```

迁移方式：

- [ai-gateway.service.ts](/d:/code/CRM/backend/src/modules/analysis/ai-gateway.service.ts) 继续负责业务 prompt、schema、lane 和 fallback，但把“如何初始化 SDK、如何执行调用”下沉到门面。
- [contract-review.ai-review.service.ts](/d:/code/CRM/backend/src/modules/contract-review/contract-review.ai-review.service.ts) 保留合同审核分组、批次、去重和风控逻辑，但移除直接 import Codex SDK 的职责。

这样做的结果是：

- 问数、企业微信、合同审核共用一条 Provider 选择与切换逻辑；
- 后续新增模型时，不需要同时改三条业务主链。

### 决策 6：切换前后的验证必须是真实 SDK smoke test，不是伪测试

测试分三级：

1. 静态校验
   - 必填字段
   - `sdkType` 与 `sdkOptions` 匹配关系
   - 密钥是否已配置

2. 真实 SDK smoke test
   - Codex：通过 adapter 发起最小单轮结构化或文本调用
   - Claude：通过 adapter 发起最小单轮 query / run 调用

3. 可选 MCP 附加校验
   - 仅对 Claude Profile 且 `enableMcpValidation=true` 时启用
   - 验证 `mcpConfigPath` 可读取、MCP server 能初始化、工具列表可见或连接状态可获取

返回结果统一为：

```ts
interface AiHealthCheckResult {
  status: 'SUCCEEDED' | 'FAILED';
  latencyMs: number;
  failureStage?: 'STATIC_VALIDATION' | 'SDK_INIT' | 'SDK_CALL' | 'MCP_INIT';
  failureReason?: string;
  providerSummary: string;
}
```

激活规则：

- 最近测试失败的 Profile 默认不得激活
- 激活成功后再执行一次轻量“切换后验证”，确认全局 resolver 已切到新 Profile

原因：

- 用户明确要求“切换配置后测试通过”。
- 只测保存成功不够，必须证明后台代码真的跑通 SDK。

### 决策 7：前端按页面容器 + 可复用组件拆分，不做大页面混写

建议前端拆分如下：

- `frontend/src/pages/governance/AiModelProfilePage.vue`
- `frontend/src/components/governance/AiProfileSummaryCard.vue`
- `frontend/src/components/governance/AiProfileTable.vue`
- `frontend/src/components/governance/AiProfileFormDrawer.vue`
- `frontend/src/components/governance/AiProfileHealthCheckDialog.vue`

页面容器职责：

- 拉取列表
- 管理抽屉开关、选中项和刷新

组件职责：

- 摘要卡：展示当前激活项与最近测试结果
- 表格：展示 Profile 列表、激活状态、操作列
- 表单抽屉：负责创建、编辑、复制、密钥输入
- 测试弹层：展示测试过程、耗时、失败阶段

原因：

- 用户明确要求注意组件封装与模块化。
- 治理页后续还会继续加字段，单文件堆满会很快超过项目约束。

### 决策 8：密钥采用服务端加密存储，读取接口只返回掩码状态

密钥处理规则保持不变，但这里写清技术实现：

- `AiSecretCryptoService` 负责加密与解密
- 主密钥来源：新增环境变量，例如 `AI_PROFILE_MASTER_KEY`
- 本地开发缺失时，可允许生成 `.runtime/ai-profile-master.key` 作为回退，但绝不进仓库
- Profile 详情接口只返回：
  - `secretConfigured`
  - `secretMask`
  - `secretUpdatedAt`

同时在审计里只记录：

- 是否变更密钥
- 谁变更
- 何时变更

不记录：

- 明文
- 密文
- 截断后的真实前缀

### 决策 9：未来新增模型按“新增 adapter + 注册 + schema 扩展”接入

后续如新增模型，约束如下：

1. 若是 SDK 型模型
   - 新增 `xxx-provider.adapter.ts`
   - 在 registry 注册
   - 为 `sdkOptions` 增加校验器
   - 为 health check 增加 smoke test

2. 若是 OpenAI-compatible HTTP 模型
   - 优先新增一个 `openai-compatible-http.adapter.ts`
   - 复用现有 JSON / 文本调用门面
   - 不要把 HTTP 兼容逻辑散落到业务模块

3. 若是 Anthropic 原生 HTTP 模型
   - 优先新增 `anthropic-http.adapter.ts`
   - 保持 Claude Agent SDK adapter 与 HTTP adapter 分离

新增模型时必须改动的最小点位应被控制在：

- adapter
- registry
- profile 静态校验
- health check
- 前端表单 schema

而不是：

- `AiGatewayService`
- `ContractReviewAiReviewService`
- 企业微信业务服务

## Risks / Trade-offs

- [Claude 官方 SDK 包名与文档入口存在新旧差异] → 统一在 adapter 层隔离，并在文档中明确首选当前 Agent SDK 包名与兼容策略。
- [切换后热生效可能受旧缓存影响] → 所有运行时读取统一经过 resolver，激活后强制失效缓存。
- [Codex 与 Claude 的调用风格不同，容易把统一门面做得过度抽象] → 只抽象文本调用、结构化调用和健康检查三类公共能力，不抽象 prompt 构建。
- [MCP 校验过重可能拖慢测试体验] → MCP 作为 Claude Profile 的可选附加校验，默认先做最小 SDK smoke test。
- [新增模型时字段持续膨胀] → 使用 `sdkOptions` + adapter 私有校验，避免顶层字段失控。

## Migration Plan

1. 在 `backend/package.json` 增加 Claude Agent SDK 依赖，并引入 `ai-models` 模块骨架。
2. 先把 Codex 的现有初始化与调用代码迁入 `codex-provider.adapter.ts`，保证无行为回归。
3. 新增 `claude-provider.adapter.ts`，接入你当前已有的 Claude 配置，并完成最小 smoke test。
4. 落地 Profile 持久化、密钥加密、全局激活与 resolver；此时仍保留环境变量兜底。
5. 改造 `AiGatewayService` 与合同审核 AI 服务，统一走 `UnifiedAiExecutionService`。
6. 增加治理后台页面、测试按钮、激活按钮与审计展示。
7. 完成 Codex / Claude 双路径测试，并验证切换后企业微信、智能分析、合同审核三条主链统一读到新配置。

## Open Questions

- Claude Profile 的 MCP 校验是否默认开启；当前建议默认关闭，仅对明确配置了 `mcpConfigPath` 的 Profile 开启。
- 是否需要在切换成功后自动回跑一条“企业微信解释回复 smoke case”；当前建议首版先做统一 SDK smoke test，不直接触发真实业务链。

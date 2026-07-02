## Context

当前项目的 AI 调用已经统一收敛到 `OpenAI 兼容 HTTP + invokeText/invokeStructured + 本地 schema 校验`，企业微信入口分类、活跃任务回复分类、经营分析意图识别、追问分流、grounded 洞察和合同审核补充审查都共享这条运行时链路。现有实现的主要问题不是“没有 AI”，而是“AI 能力组织方式仍然停留在把 prompt、few-shot、schema 和 fallback 直接写在业务服务里”：

- `backend/src/modules/analysis/ai-gateway.service.ts` 直接承载企业微信入口分类、任务回复分类、分析意图和 grounded 文案的 prompt 与 schema；
- `backend/src/modules/ai-models/adapters/openai-compatible-http.adapter.ts` 会对模型输出执行严格本地 schema 校验；
- 企业微信未识别帮助兜底策略已明确禁止“AI miss 后偷偷回旧规则主链”，因此一旦结构化校验过严，就会把原本方向正确的结果直接打回帮助文案；
- 合同审核已经有一套可版本化 `skill pack` 范式，但该范式尚未推广到通用 AI 理解能力。

`qwen-turbo-latest` 暴露出的日志问题正好说明了这个缺口：模型可以自然输出 `{ intent: "DAILY_REPORT", dailyReportPrompt: "FOLLOW_UP_TEMPLATE_ENTRY" }` 这类稀疏 JSON，但当前空闲态 schema 把 `helpScene`、`dailyReportPrompt`、`leaderNameQuery`、`lookupText` 全部放进 `required`，导致无关字段缺失即失败，随后被帮助兜底吞掉。

本次设计的目标，是在不引入 agent runtime、MCP 或 provider 原生 skill 的前提下，建立“应用层 AI capability pack”机制：把 prompt、few-shot、最小公共 contract、归一化、条件校验和 provider 定制从业务服务代码中抽离出来，并复用合同审核 `skill pack` 的版本化思想。

## Terminology

- `AI capability skill pack`：指项目内、代码托管、可评审、可版本化的应用层 AI 能力包。本文后续简称 `capability pack`。
- `provider 原生 skill / tool / MCP`：指模型供应商或 agent runtime 自带的工具能力，不在本次设计范围内。
- `最小公共 contract`：只声明跨全部意图都真正公共的字段，例如 `intent`；其它字段一律改由 capability pack 的条件校验表达。
- `pack runtime`：指装载 pack、渲染 prompt、选择 provider tuning、归一化结果、执行条件校验并返回统一错误语义的共享运行时。

## Goals / Non-Goals

**Goals：**

- 建立应用层 `AI capability pack` 运行时，统一承载企业微信入口分类、活跃任务回复分类、分析意图识别、追问分流和 grounded 文案生成。
- 把当前企业微信空闲态和活跃任务回复从“静态全字段必填 schema”改为“最小公共 contract + 按 intent 的条件校验”。
- 为 `qwen-turbo-latest`、`qwen-plus-latest` 等模型提供 capability 级 provider 定制参数与示例集，而不把 provider 适配散落到业务服务里。
- 明确 capability pack 的代码来源、版本规则、pack 级启停与回滚边界，避免提示词与 provider tuning 脱离代码审查链路。
- 明确“AI 主理解、程序守边界”的分工：上下文理解、意图识别、字段抽取、缺项提示内容和短回复语义默认先通过 pack 内提示词、few-shot 和负例优化解决，程序只负责安全前置检查、状态门闩、权限边界、白名单和审计。
- 保持现有执行边界不变：模型只负责理解与生成受控意图，固定程序继续负责签名校验、权限、白名单、确认、写回和审计。
- 将通用 AI pack 的组织方式与合同审核现有 `skill pack` 范式对齐，形成一致的版本化和审计语义。
- 让测试、调试和灰度观察复用同一套 pack fixture / golden case，避免测试环境长期漂移成第二套语义实现。

**Non-Goals：**

- 不引入 provider 原生 agent/tool-calling/MCP 能力，不把当前运行时升级为真正的 agent 平台。
- 不在本轮重做 AI 模型治理后台，不要求前端立即支持可视化编辑 capability pack。
- 不支持从数据库、环境变量大段文本或远端配置中心动态加载未注册 pack；pack 必须跟随仓库与版本发布。
- 不改变现有企业微信、Web 分析和合同审核的固定程序执行边界，不允许 AI 直接替代确认门闩或数据访问控制。
- 不追求在一个提交里重写全部 AI 调用；迁移按“企业微信入口与活跃任务优先，Web 分析与 grounded pack 随后接入”的阶段推进。

## Decisions

### 决策 1：新增应用层 AI capability pack 运行时，并坚持“代码托管 registry”而不是继续在业务服务中堆 prompt

新增一个共享运行时层，用于按 `packCode` 装载通用 AI 能力包。每个 pack 至少包含：

- `metadata`：`packCode`、`packVersion`、适用场景、所有者；
- `promptBuilder`：系统提示词、上下文裁剪、few-shot 组装；
- `outputContract`：最小公共 JSON contract；
- `normalizer`：对模型输出做字段归一化、默认值补齐、别名映射；
- `validator`：按业务语义做条件必填校验；
- `providerTuning`：按 provider/model 注入少量受控请求体参数和 provider 专用 few-shot。

所有 pack 定义必须来自仓库内显式注册的文件：

- pack 不从数据库、环境变量大段文本或远端配置中心动态下发；
- pack 的 `packCode`、`packVersion`、few-shot 与 provider tuning 必须进入代码评审与发布流程；
- runtime 只允许加载 registry 中登记过的 pack，避免线上出现不可追溯的提示词漂移。

原因：

- 现有 `AiGatewayService` 已经同时承载 prompt、schema、fallback 和业务路由，持续追加只会继续膨胀；
- `skill pack` 已经在合同审核链路验证可行，继续在应用层扩展这一路线，比引入全新 agent runtime 风险更低；
- 把通用 AI pack 独立出来后，可以先局部替换企业微信入口分类，再逐步覆盖 Web 问数和 grounded 文案。

备选方案：

- 继续在 `AiGatewayService` 里追加 prompt 和 few-shot。好处是改动小，但无法解决 prompt/validator/provider 逻辑交叉污染问题。
- 引入 provider 原生 Agent SDK / tools / MCP。当前项目既无该运行时，也不符合现有 OpenAI 兼容 HTTP 主链。

### 决策 2：统一采用“最小公共 contract + normalizer + 条件 validator”，只保留真正公共字段为必填

对于入口分类类 capability pack，`outputContract` 只保留跨所有意图都必须存在的字段。例如空闲态入口分类首批仅要求：

- `intent`

其它字段改为可选：

- `helpScene`
- `dailyReportPrompt`
- `leaderNameQuery`
- `lookupText`

随后由 `validator` 做条件校验：

- `HELP_GUIDANCE` 必须带 `helpScene`
- `DAILY_REPORT` 必须带 `dailyReportPrompt`
- `TEAM_DAILY_REPORT_QUERY` 必须带 `leaderNameQuery`
- `OPPORTUNITY_LOOKUP` 必须带 `lookupText`

原因：

- `qwen-turbo-latest`、`qwen-plus-latest` 在 `json_object` 模式下更自然的行为是只返回当前意图相关字段，而不是无关字段也补 `null`；
- 现在的失败日志表明模型输出方向基本正确，但被静态 schema 错误拦掉；
- 条件 validator 比静态全字段 required 更符合业务语义，也更容易做审计与错误定位。

备选方案：

- 继续要求模型对所有字段输出 `null`。这对 prompt 更脆弱，对不同 provider 的稳定性更差。
- 取消本地校验，只相信模型输出。会直接削弱当前受控执行边界，不可接受。

### 决策 3：provider 适配收敛到 capability pack 层的受控 tuning，而不是散落在业务 prompt 中

为通用 AI pack 提供 provider/model 定制层，首批支持：

- 请求体附加字段，如 `enable_thinking: false`
- provider 专用 few-shot
- 默认结构化输出模式偏好
- provider 级输出归一化（如字符串枚举别名收敛）

具体约束：

- 只有 capability runtime 可以为 pack 注入 provider tuning；
- adapter 只负责把受控 overrides 合并进请求体，不理解业务语义；
- pack 只能声明白名单字段，禁止任意透传原始 body。

原因：

- `qwen3` 已经证明部分 provider 必须追加额外参数；
- `qwen-turbo-latest` 这类模型更依赖示例格式和条件校验，不适合把 provider 差异散落在每个业务 prompt 中；
- provider tuning 进入 capability runtime 后，后续更换模型时只需调整 pack 配置，不必同步改多处业务服务。

备选方案：

- 继续在 adapter 里写死 provider if/else。短期可行，但随着能力包增多会快速失控。
- 继续在 prompt 中“提醒模型自己补齐字段”。不能从根本上解决 provider 稀疏输出和非标准请求参数问题。

### 决策 3.5：语义误判默认先回到 prompt / few-shot / 负例优化，而不是继续堆程序分支

对于以下问题，默认修复顺序必须是：

1. 先补 capability pack 内的系统提示词、few-shot、反例和结构化 contract；
2. 再用 fixture / golden case 固定问题单；
3. 只有在涉及安全边界、状态推进门闩、权限约束、对象唯一性或高风险执行拦截时，才允许新增程序条件。

首批明确纳入该原则的问题类型：

- 长正文被误判成 `CONTINUE_EXECUTION`、`DIRECT_SUBMIT` 或其它短回复语义；
- `不补充`、`先不补充` 这类上下文相关表达被误判成取消；
- 四段草稿已经识别出 2 到 3 个字段，却继续提示补已存在字段；
- 原文里已经出现“客户不好沟通”“推进缓慢”“明天继续跟进”这类明确信号，却未被抽到 `helpNeeded` 或 `visitPlan`；
- 解释型追问与改条件追问在已有上下文下被混淆。

原因：

- 这些问题本质属于自然语言理解和上下文对齐，长期靠程序分支加码只会让状态机越来越脆；
- capability pack 已经提供了提示词、few-shot、负例、provider tuning 和 fixture 的统一出口，应该先用这一层承接真实问题；
- 程序分支只该处理“不能错执行”的边界，而不该继续承担主语义理解职责。

### 决策 4：按阶段组织 pack，先止血企业微信入口，再在同一运行时推广到 Web 分析与 grounded pack

首批 pack 范围：

- `wecom-idle-entry-pack`
- `wecom-active-task-reply-pack`

第二批 pack 范围：

- `analysis-intent-pack`
- `analysis-follow-up-pack`
- `grounded-explanation-pack`

合同审核仍保留现有 `skill pack` 体系，但共享底层 pack registry / metadata / audit 模式。

原因：

- 当前线上最明显的用户可见问题来自企业微信入口分类，必须优先止血；
- 同一 change 仍需要把 Web 分析入口、追问分流和 grounded 文案的 pack 接线边界写清，否则 proposal 与 tasks、spec 会再次脱节；
- 先把最复杂、最容易误判的企业微信链路跑通，再推广到 Web 分析能力，能降低迁移风险；
- 合同审核已有成熟 `skill pack`，本轮只做抽象对齐，不急着重写。

备选方案：

- 一次性把所有 AI 调用都切到新 pack runtime。实施跨度过大，回归面太宽。
- 只修企业微信 idle schema，不引入 pack runtime。能止血，但无法解决长期组织问题。

### 决策 5：把 capability pack 运行结果纳入统一审计与日志字段

每次 pack 调用至少记录：

- `packCode`
- `packVersion`
- `providerCode`
- `model`
- `wireApi`
- `structuredOutputMode`
- `usedFallback`
- `fallbackReason`
- `validationFailureReason`
- `targetWorkflow`

在企业微信入口、Web 分析入口和合同审核补充审核中统一输出。

原因：

- 当前日志只能看到“结构化输出缺少必填字段”，但无法直接定位是哪一个能力 pack、哪个 provider tuning 和哪组 few-shot；
- 把 pack 元信息显式写进日志和审计后，后续更换模型或调整 few-shot 时才能定量分析效果。

### 决策 6：pack runtime 必须内建 pack 级启停、失败分类与应急回滚语义

除统一环境开关外，新增 `packCode` 级别的启停和失败分类约束：

- runtime 必须能够识别 `PACK_DISABLED`、`PACK_NONE`、`PACK_VALIDATION_FAILED`、`PROVIDER_ERROR`、`PROVIDER_TIMEOUT` 等失败类别；
- 企业微信 idle / active task、Web 分析入口和 grounded 洞察必须把上述失败类别透传到 `fallbackReason` / `validationFailureReason` 或等价审计字段；
- 系统必须支持按 `packCode` 关闭单个 pack，并保留既有最小安全 fallback，而不是要求整条统一 AI 运行时一起回退。

原因：

- 当前截图问题之所以定位成本高，根因之一就是日志里只有“schema 缺字段”，却看不出是 pack 本身问题、provider 稀疏输出还是开关回退；
- 新 runtime 上线初期一定会灰度，不支持 pack 级关闭就无法低成本止损；
- 把失败语义显式化后，企业微信帮助兜底、Web 阻断提示和 grounded fallback 才能共享同一套可观测口径。

### 决策 7：测试、调试和回归必须复用 pack fixture，不能维护第二套语义实现

新增 capability pack 后，测试环境不得继续长期维护与运行时脱节的独立 prompt 语义分支。为此：

- 每个 pack 必须提供最少一组 golden case / fixture，覆盖正常命中、稀疏输出、条件字段缺失、provider 定制和 fallback 场景；
- 单元测试优先对 pack 的 normalizer / validator / provider tuning 直接断言，而不是只在 `NODE_ENV=test` 下依赖硬编码返回值；
- 若必须保留测试桩，测试桩也只能复用 pack fixture 或 pack runtime 的归一化结果，不得重新实现另一套意图判定规则。

原因：

- 当前 `AiGatewayService` 已有较多 test-only 分支，若不收口，后续 pack 改动极易出现“测试全绿、线上仍误判”；
- golden case 能直接覆盖截图暴露的稀疏 JSON 失败问题，比只测最终回复更容易定位；
- provider tuning 最容易因模型切换而回归，必须有 fixture 约束输出期望。

### 决策 8：采用文件级分层实现，避免再次把 pack 逻辑回灌进 `AiGatewayService`

文件级实现方案如下：

- 新增 `backend/src/modules/analysis/capability-packs/ai-capability-pack.types.ts`
  定义 pack metadata、prompt builder、output contract、normalizer、validator、provider tuning 类型。

- 新增 `backend/src/modules/analysis/capability-packs/ai-capability-pack.registry.ts`
  统一注册 `wecom-idle-entry-pack`、`wecom-active-task-reply-pack` 和后续分析类 pack。

- 新增 `backend/src/modules/analysis/capability-packs/ai-capability-pack.runtime.ts`
  负责：
  - 根据 `packCode` 取 pack
  - 组装 prompt
  - 调用 `UnifiedAiExecutionService`
  - 执行 normalizer / validator
  - 产出统一运行结果与失败原因

- 新增 `backend/src/modules/analysis/capability-packs/packs/wecom-idle-entry.pack.ts`
  迁出当前 `buildWecomIdleConversationIntentPrompt` 的系统提示词、few-shot、最小 contract、条件 validator 和 `qwen-turbo-latest` provider tuning。

- 新增 `backend/src/modules/analysis/capability-packs/packs/wecom-active-task-reply.pack.ts`
  迁出当前 `buildWecomTaskReplyIntentPrompt` / schema 的提示词与条件校验。

- 新增 `backend/src/modules/analysis/capability-packs/provider-tuning/qwen.provider.ts`
  收敛 `qwen-turbo-latest`、`qwen-plus-latest`、`qwen3-*` 等 provider/model 的受控参数与 few-shot 选择逻辑。

- 新增 `backend/src/modules/analysis/capability-packs/packs/analysis-intent.pack.ts`
  迁出问数入口的核心 prompt、最小 contract、provider tuning 选择和结构化结果归一化逻辑，供 Web 首次问数与企业微信分析入口共用。

- 新增 `backend/src/modules/analysis/capability-packs/packs/analysis-follow-up.pack.ts`
  迁出解释型追问 / 改条件追问分流语义，统一 `EXPLAIN_RESULT` 与 `RUN_NEW_ANALYSIS` 的 few-shot、条件校验和 fallback 语义。

- 新增 `backend/src/modules/analysis/capability-packs/packs/grounded-explanation.pack.ts`
  迁出 grounded explanation / next questions 的提示词、provider tuning 和结构校验，统一 Web 与企业微信解释文案组织方式。

- 新增 `backend/src/modules/analysis/capability-packs/runtime/pack-rollout.policy.ts`
  管理 pack 级启停、灰度与默认回退策略，确保可以按 `packCode` 单独关闭新 pack。

- 新增 `backend/src/modules/analysis/capability-packs/fixtures/`
  存放 pack golden case、稀疏输出样例、provider 覆盖样例与条件校验失败样例，供单测和调试共享。

- 新增 / 补强 capability pack 内的提示词资源与 few-shot 样例
  - `wecom-active-task-reply-pack` 补充“长正文不是确认短句”“`不补充` 在可选缺项阶段表示跳过并继续”的正反例
  - 跟进四段草稿抽取相关 pack 补充“问题/阻塞 -> helpNeeded”“下一步/明天/后续安排 -> visitPlan”的对照样例
  - 缺项补充提示生成逻辑只围绕真实缺失字段组织，不再展示已识别字段的提示样例

- 修改 `backend/src/modules/analysis/ai-gateway.service.ts`
  - 删除企业微信 idle / active task prompt 拼装细节
  - 改为调用 capability pack runtime
  - 在运行结果上保留业务层 `targetWorkflow` / `replyIntent` 转换
  - 逐步接入 `parseStructuredIntent`、`classifyAnalysisFollowUpIntent`、`generateGroundedAnalysisInsight`、`generateWecomExplanationReply` 等 analysis / grounded 能力
  - 为旧 fallback 保留最小安全兜底，但不再把 pack 实现逻辑写回本文件

- 修改 `backend/src/modules/ai-models/adapters/openai-compatible-http.adapter.ts`
  - 支持从 capability runtime 接收受控 provider request overrides
  - 保持 adapter 只做 transport，不感知业务场景

- 修改 `backend/src/modules/ai-models/unified-ai-execution.service.ts`
  - 增加可选 `requestOverrides` 透传
  - 不破坏现有调用方

- 修改 `backend/src/modules/wecom/wecom-ai-conversation-orchestration.service.ts`
  - 仍只消费 `AiGatewayService` 输出，但增加对 pack 失败原因、packCode、packVersion 的日志和 fallback 标记透传

- 修改 `backend/src/modules/wecom/wecom-bot.service.ts`
  - 保留现有固定程序边界
  - 调整“未识别帮助兜底”逻辑：只有 pack runtime 真正返回 `NONE` 或验证失败才进入帮助兜底

- 修改 `backend/src/modules/analysis/analysis-intent.service.ts` 或等价分析入口服务
  - 消费 `analysis-intent-pack` / `analysis-follow-up-pack` 的归一化结果
  - 统一 Web 首问、解释追问、改条件追问的 pack 接线与 fallback 留痕

- 修改 grounded 洞察相关服务
  - 将 grounded explanation / next questions 的 prompt 迁到 `grounded-explanation-pack`
  - 保持结果包事实边界与模板 fallback 不变

- 修改测试：
  - `backend/test/modules/analysis/ai-gateway.service.spec.ts`
  - `backend/test/modules/wecom/wecom-ai-conversation-orchestration.service.spec.ts`
  - `backend/test/integration/wecom-ai-conversation.integration-spec.ts`
  - `backend/test/modules/ai-models/openai-compatible-http.adapter.spec.ts`
  - `backend/test/modules/analysis/analysis-intent.service.spec.ts`
  - `backend/test/integration/controlled-analysis-orchestration.integration-spec.ts`
  - pack runtime / fixtures 对应单测
  - 增加针对“AI 误判长正文”“`不补充` 继续流程”“缺项提示只展示真实缺失字段”的 golden case 与集成测试

- 可选新增文档：
  - `backend/src/modules/analysis/capability-packs/README.md`
    说明 pack 结构、版本规则、few-shot 编写约束和 provider tuning 白名单。

## Risks / Trade-offs

- [pack runtime 成为新的共享层，初期理解成本上升] → 通过文件分层、类型约束和 README 降低维护门槛，并按“企业微信入口优先、分析与 grounded 随后接入”的阶段推进。
- [provider tuning 滥用导致 runtime 重新变成 provider if/else 堆场] → 限制 tuning 只能通过白名单字段和独立 provider 模块注册。
- [旧测试大量依赖当前 schema 细节] → 首批同步更新企业微信 idle / task reply 相关单测和集成测试，明确断言改为条件校验语义。
- [pack 级灰度和默认开关配置混乱] → 统一通过 rollout policy 管理 pack 启停，不允许业务服务各自声明私有回滚开关。
- [测试环境继续保留第二套语义实现导致漂移] → pack fixture 成为单测、集成测试和调试样例的唯一来源，test-only 逻辑只允许复用 fixture。
- [pack 版本化后审计字段增多] → 先在日志和内存态快照中落库，后续再评估是否进入更独立的审计表结构。
- [热修当前问题和长期抽象混在一起，影响交付速度] → 分阶段交付：第一阶段先落企业微信 pack 和 schema/validator 热修，第二阶段再推广到 analysis packs。

## Migration Plan

1. 新增 capability pack registry/runtime、rollout policy 和企业微信两个首批 pack，不移除原业务 fallback。
2. 将 `AiGatewayService` 的企业微信 idle / active task 分支改接 pack runtime，并保留原 fallback 入口。
3. 将 `qwen-turbo-latest`、`qwen-plus-latest` 的 provider tuning 与示例集接入 `wecom-idle-entry-pack` / `wecom-active-task-reply-pack`。
4. 更新本地 schema 校验断言、pack fixture 与相关测试，确认 `你好`、`你好，你是谁`、`跟进商机`、`新增客户`、`新增商机` 等输入不再因无关字段缺失而失败或误入帮助兜底。
5. 灰度观察企业微信入口日志中的：
   - `validationFailureReason`
   - `fallbackReason`
   - `packDisabledReason`
   - `packCode/packVersion`
   - `targetWorkflow`
6. 稳定后将 `analysis-intent`、`analysis-follow-up`、`grounded-explanation` 三类 pack 接入 Web 分析入口、解释追问和 grounded 洞察链路，并补齐对应集成测试。

回滚策略：

- 保留 `AiGatewayService` 当前 fallback 路径与环境开关；
- 若 pack runtime 在生产环境下误判率升高，可按 packCode 级别关闭新 pack，恢复到原最小安全 fallback；
- provider tuning 出现兼容问题时，可只回退单个 provider 模块，不需要整体回滚 capability runtime。

## Open Questions

- capability pack 的版本号是代码内手工维护，还是按构建产物自动注入。
- 后续是否需要在 AI 模型治理后台展示“当前入口使用的 capability pack 版本”和最近验证结果。
- 通用分析类 pack 迁移后，是否要把 grounded explanation / daily report summary 的模板 fallback 进一步外置为 pack 内资源，而不是继续写在业务服务里。

## Why

当前项目已经把企业微信入口、Web 问数入口和合同审核入口统一切到 `OpenAI 兼容 HTTP + 结构化输出` 路径，但业务理解层仍然把 prompt、few-shot、schema 和 fallback 规则直接散落在后端服务代码中。随着 `qwen-turbo-latest` 等模型接入，企业微信空闲态入口分类已经暴露出“模型输出方向基本正确，但因静态 schema 过严而被本地校验打回，随后又被帮助兜底吞掉”的问题，截图里的“`跟进商机` 再次落回整段帮助清单”就是这一缺口的直接表现。

这里要引入的不是 provider 原生 tools / skills / MCP，而是项目内、代码托管、可评审、可版本化的应用层 `AI capability skill pack`。它负责把“系统提示词、few-shot 示例、最小输出 contract、条件校验、provider 定制参数和 fallback 语义”从业务服务中抽离出来，让空闲态入口、活跃任务短回复、Web 问数入口、追问分流和 grounded 文案生成都复用同一套受控组织方式。

本次变更既要先止住企业微信入口误判，也要补齐后续扩展时最容易再次出问题的几个治理缺口：pack 来源必须可追溯、pack 级回滚必须可控、验证失败原因必须可定位、测试桩不能再维护第二套语义逻辑。

## What Changes

- 新增应用层 `AI capability skill pack` 运行时，用代码内 registry 装载并管理企业微信入口分类、活跃任务回复分类、分析意图识别、追问分流和 grounded 文案生成等能力包；运行时只允许加载仓库内已注册、已版本化的 pack。
- 首批将企业微信空闲态入口分类从“静态 prompt + 全字段必填 schema”改为“最小公共输出 contract + 按 intent 的条件校验”，修复 `qwen-turbo-latest` 下 `helpScene` / `dailyReportPrompt` / `leaderNameQuery` / `lookupText` 缺失即失败的问题，并同步覆盖 `新增客户`、`新增商机`、`查项目`、解释追问等同属 idle entry 的入口。
- 同步将活跃任务回复分类迁入 capability pack，统一取消、切换、继续、修改、确认等短回复语义的最小 contract、条件校验和 fallback 语义，避免在客户创建、商机创建、日报确认、跟进确认等上下文中继续分散维护 prompt。
- 对企业微信活跃任务回复分类、跟进四段草稿抽取、缺项补充提示和 grounded 解释链路补充“提示词优化优先”要求：后续遇到语义误判、字段漏提、上下文理解偏差或可选缺项提示不贴合真实缺口时，默认先优化 pack 内系统提示词、few-shot、负例和结构化 contract，再评估是否需要程序边界兜底。
- 在同一运行时补齐 `analysis-intent-pack`、`analysis-follow-up-pack` 与 `grounded-explanation-pack` 的接线约束，使 Web 问数入口、解释型追问、改条件追问与 grounded 洞察生成也逐步脱离 `AiGatewayService` 内联 prompt。
- 为 capability pack 引入 provider 定制层，支持按模型族声明少量受控参数、few-shot 和结构化输出策略；首批覆盖 `qwen-turbo-latest` / `qwen-plus-latest` 的 `json_object` 输出习惯、结构化模式偏好与入口示例。
- 为 capability pack 增加 pack 级启停、灰度和应急回滚约束。系统必须支持按 `packCode` 或场景关闭新 pack，回退到既有最小安全 fallback，而不是整条 AI 运行时一起回滚。
- 统一 capability pack 的审计与观测字段，至少记录 `packCode`、`packVersion`、`provider/model`、`fallbackReason`、`validationFailureReason`、`usedFallback`、`targetWorkflow`，并区分 `PACK_DISABLED`、`PACK_NONE`、`PACK_VALIDATION_FAILED`、`PROVIDER_ERROR` 等失败类别。
- 要求 pack 相关测试改为复用同一套 pack fixture / golden case，不再让 `NODE_ENV=test` 维护一套与运行时脱节的第二语义实现。
- 要求 pack 内提示词、few-shot 和负例样例与真实问题单保持闭环；凡是出现“长正文被误判成确认短句”“`不补充` 被误判成取消”“只缺某个字段却提示补全部字段”“草稿漏提可从原文直接确认的字段”这类问题时，必须优先补 `golden case + prompt/few-shot`，不能只在程序里继续加关键词和状态分支。
- **BREAKING**：企业微信空闲态入口分类与活跃任务回复分类的本地校验方式从“静态对象全字段 required”改为“intent 必填 + 场景条件必填”；旧断言、调试脚本、审计快照字段和测试桩需要同步更新。

## Capabilities

### New Capabilities
- `ai-capability-skill-runtime`: 定义应用层 AI capability skill pack 的装载、版本化、provider 定制、归一化、条件校验、pack 级开关与审计记录运行时。

### Modified Capabilities
- `ai-entry-intent-orchestration`: 将统一 AI 理解层升级为基于 capability pack 的场景化编排，并要求企业微信 idle / active task、Web 首次问数和追问分流都通过 pack 消费最小公共 contract 与条件校验结果。
- `ai-openai-compatible-http-runtime`: 为 OpenAI 兼容 HTTP 运行时增加 capability 级 provider 定制参数和受控请求体覆盖能力，支持 `qwen-turbo-latest` 等模型的能力包级调优，并拒绝未登记覆盖项。
- `wecom-unrecognized-input-help-guidance`: 调整企业微信未识别帮助兜底边界，要求在 capability pack 归一化与条件校验完成前，不得因为无关可选字段缺失而误落帮助兜底。
- `wecom-task-cancel-guidance`: 将活跃任务短回复的提示词、few-shot 和条件校验迁入 capability pack，统一继续、取消、切换和修改语义的 AI-first 判定方式。
- `wecom-follow-up-guided-template`: 跟进主题入口改为依赖 capability pack 输出的 `DAILY_REPORT + dailyReportPrompt` 路由结果，避免模型输出字段稀疏时被帮助兜底吞掉。
- `wecom-customer-create-chat`: 新增客户入口与续填回复改为显式消费 idle / active task pack 的结构化结果，避免创建入口被帮助兜底或旧关键词链路吞掉。
- `wecom-opportunity-create-chat`: 新增商机入口与续填回复改为显式消费 idle / active task pack 的结构化结果，保持对象唯一化与确认门闩不变。
- `controlled-analysis-orchestration`: Web 首次问数与改条件追问改为消费 analysis intent / follow-up packs 的归一化结果进入计划执行、受控直查或澄清分支。
- `structured-analysis-result-delivery`: grounded explanation / next questions 生成改为消费 grounded capability pack 的版本化提示词、provider tuning 与 fallback 语义。

## Impact

- 影响后端 `backend/src/modules/analysis`、`backend/src/modules/ai-models`、`backend/src/modules/wecom` 中的 prompt 构造、结构化 schema、provider 参数透传、入口 fallback、grounded 文案生成和审计快照。
- 预计新增 `backend/src/modules/analysis/capability-packs/` 或等价目录，以及共享的 pack registry、runtime、normalizer、validator、provider tuning、fixture / golden case 工具。
- 影响现有企业微信入口相关测试：`backend/test/modules/analysis/ai-gateway.service.spec.ts`、`backend/test/modules/wecom/wecom-ai-conversation-orchestration.service.spec.ts`、`backend/test/integration/wecom-ai-conversation.integration-spec.ts`。
- 影响 Web 分析与 grounded 相关测试：`backend/test/modules/analysis/analysis-intent.service.spec.ts`、`backend/test/integration/controlled-analysis-orchestration.integration-spec.ts`。
- 影响 OpenAI 兼容 HTTP adapter 的请求体构造与 provider 特化逻辑，需继续保持对 Qwen、DeepSeek、GLM 的兼容，不引入新的本地 Agent SDK / CLI 依赖。

## Why

现有仓库虽然已经引入统一 AI 理解层与多处 AI 调用，但企业微信与 Web 自然语言入口仍残留规则前置分流、关键词确认、正则直达与本地语义兜底，导致系统尚不能满足“所有业务自然语言输入先经过统一 AI 理解层”的验收口径。继续依赖中文关键词主链会直接暴露多语言、口语变体、错别字、方言式表达和短句歧义的识别缺口，也会让后续审计无法明确区分“AI 主链命中”和“规则主链短路”。

## What Changes

- 新增统一 `ai-entry-intent-orchestration` capability，明确所有业务自然语言输入在通过固定安全前置检查后，必须先进入统一 AI 理解层，并输出受控 schema、最小安全 fallback 与统一审计快照。
- 收紧 Web 智能分析入口，要求首次问数、解释型追问、改条件追问和执行模式决策统一消费 AI 入口结果，本地规则仅保留为安全阻断与最小澄清 fallback。
- 收紧企业微信跟进、日报、客户创建、商机创建、活跃任务取消 / 切换 / 确认链路，禁止继续由关键词表、短句正则或精确确认词承担主理解职责。
- 明确“AI 理解”和“执行确认门闩”分层：AI 负责识别 `CONFIRM / CANCEL / MODIFY / CONTINUE / UNKNOWN` 等语义，真正的写回、提交、创建与状态推进仍必须经过确定性执行门闩。
- 新增多语言与表达变体验收要求，覆盖英文、中英混写、韩文 / 日文、错别字、口语化中文、歧义确认句等场景，并要求 fallback 只能退到帮助、澄清或阻断，不得回退为长期规则主链。

## Capabilities

### New Capabilities
- `ai-entry-intent-orchestration`: 统一定义所有业务自然语言输入的 AI 入口理解、结构化路由 schema、最小安全 fallback、执行门闩分层和审计快照要求。

### Modified Capabilities
- `controlled-analysis-orchestration`: 收紧 Web 分析问数与追问入口，要求统一先消费 AI 入口结果，再决定查询执行、结果复用或阻断路径。
- `wecom-follow-up-guided-template`: 收紧企业微信跟进自由文本、草稿确认、直接提交与修改语义，要求统一先走 AI 理解层，再进入确定性提交门闩。
- `wecom-on-demand-team-daily-report-delivery`: 收紧企业微信日报查看与团队预览自然语言识别，禁止继续依赖固定关键词组合作为主入口判断链路。
- `wecom-customer-create-chat`: 收紧新增客户自然语言入口、字段续填与确认 / 修改 / 取消语义，要求统一先走 AI 理解层。
- `wecom-opportunity-create-chat`: 收紧新增商机自然语言入口、字段续填与确认 / 修改 / 取消语义，要求统一先走 AI 理解层。
- `wecom-task-cancel-guidance`: 收紧活跃任务中的取消、切换、继续、修改和短回复确认识别，要求 AI 主链承担主理解，规则仅保留 fallback。

## Impact

- 影响后端模块：`backend/src/modules/analysis/`、`backend/src/modules/wecom/`、`backend/src/modules/daily-report/`、`backend/src/modules/opportunities/`、`backend/src/modules/audit/`。
- 影响运行时能力：统一 AI 入口 schema、企业微信活跃 / 空闲态消息编排、Web 问数与追问编排、创建与写回确认门闩、审计快照模型。
- 影响测试与灰度：需要新增按入口与场景拆分的多语言 / 多表达集成测试，并收紧现有特性开关语义，确保 AI 关闭时只退到最小安全 fallback。

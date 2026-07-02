## 1. 通用 capability pack 运行时骨架

- [x] 1.1 在 `backend/src/modules/analysis/capability-packs/ai-capability-pack.types.ts` 定义 capability pack metadata、prompt builder、normalizer、validator、provider tuning 与运行结果类型
- [x] 1.2 在 `backend/src/modules/analysis/capability-packs/ai-capability-pack.registry.ts` 建立 pack 注册表，并预留 `wecom-idle-entry-pack`、`wecom-active-task-reply-pack`、后续 analysis packs 的注册入口
- [x] 1.3 在 `backend/src/modules/analysis/capability-packs/ai-capability-pack.runtime.ts` 实现“装载 pack -> 渲染 prompt -> 调用统一执行门面 -> normalizer -> validator -> 返回运行结果”的统一流程
- [x] 1.4 新增 pack rollout policy 与失败分类工具，统一表达 `PACK_DISABLED`、`PACK_NONE`、`PACK_VALIDATION_FAILED`、`PROVIDER_ERROR`、`PROVIDER_TIMEOUT` 等状态
- [x] 1.5 新增 capability pack fixture / golden case 目录，沉淀稀疏 JSON、条件字段缺失、provider 覆盖和 fallback 样例，供单测与调试复用

## 2. 企业微信入口分类与任务回复 capability pack

- [x] 2.1 在 `backend/src/modules/analysis/capability-packs/packs/wecom-idle-entry.pack.ts` 迁移企业微信空闲态入口分类 prompt、few-shot、最小公共 contract 与条件校验
- [x] 2.2 在 `backend/src/modules/analysis/capability-packs/packs/wecom-active-task-reply.pack.ts` 迁移企业微信活跃任务回复分类 prompt、few-shot、最小公共 contract 与条件校验
- [x] 2.3 在 `backend/src/modules/analysis/capability-packs/provider-tuning/qwen.provider.ts` 为 `qwen-turbo-latest`、`qwen-plus-latest`、`qwen3-*` 增加入口分类相关 provider tuning 与 few-shot 选择逻辑
- [x] 2.4 为 idle entry pack 补齐 `新增客户`、`新增商机`、`查项目`、`EXPLAIN_RESULT`、`FOLLOW_UP_ANALYZE`、`ANALYZE` 等同属空闲态入口的 fixture 与条件校验覆盖
- [x] 2.5 强化 `wecom-active-task-reply-pack` 的提示词、few-shot 与负例，显式区分“长正文补充”“确认短句”“`不补充` 跳过可选字段”“取消任务”四类语义
- [x] 2.6 为活跃任务回复 pack 增加真实问题单回归样例，至少覆盖“长正文误判为 CONTINUE_EXECUTION”“`不补充` 误判为 TASK_CANCEL”“候选数字回复语义保持稳定”

## 2A. 跟进四段草稿与缺项提示优化

- [x] 2A.1 强化跟进四段草稿抽取提示词与 few-shot，显式覆盖“问题/阻塞 -> `helpNeeded`”“下一步/明天/后续安排 -> `visitPlan`”“未出现则留空”的样例
- [x] 2A.2 为四段草稿抽取增加真实线上话术 golden case，覆盖“客户不好沟通、推进缓慢、明天继续跟进”等口语化表达
- [x] 2A.3 调整缺项提示文案生成逻辑，只围绕当前真实缺失字段给出示例，不得继续提示已识别字段
- [x] 2A.4 为“可选缺项阶段的 `不补充 / 先不补充 / 不补了`”增加 AI-first 语义说明与回归测试，确保默认继续后续确认流程而不是结束任务

## 3. Web 分析入口、追问与 grounded capability pack

- [x] 3.1 在 `backend/src/modules/analysis/capability-packs/packs/analysis-intent.pack.ts` 迁移问数入口 prompt、few-shot、最小公共 contract 与 provider tuning 选择逻辑
- [x] 3.2 在 `backend/src/modules/analysis/capability-packs/packs/analysis-follow-up.pack.ts` 迁移解释型追问 / 改条件追问分流 prompt、few-shot 与条件校验
- [x] 3.3 在 `backend/src/modules/analysis/capability-packs/packs/grounded-explanation.pack.ts` 迁移 grounded explanation / next questions 的提示词、结构约束与 provider tuning
- [x] 3.4 修改分析入口接线，让 `parseStructuredIntent`、`classifyAnalysisFollowUpIntent`、`generateGroundedAnalysisInsight`、`generateWecomExplanationReply` 等能力通过 capability pack runtime 执行

## 4. 统一 AI 网关与企业微信编排接线

- [x] 4.1 修改 `backend/src/modules/analysis/ai-gateway.service.ts`，让 `classifyWecomIdleConversationIntent` 通过 capability pack runtime 执行，而不是直接拼装 prompt 和静态 schema
- [x] 4.2 修改 `backend/src/modules/analysis/ai-gateway.service.ts`，让 `classifyWecomTaskReplyIntent` 通过 capability pack runtime 执行，并移除旧的全字段静态 required schema 依赖
- [x] 4.3 修改 `backend/src/modules/wecom/wecom-bot.service.ts` 与 `backend/src/modules/wecom/wecom-ai-conversation-orchestration.service.ts`，仅在 pack 返回 `NONE`、validation 失败、pack 被禁用或 AI 不可用时才进入帮助兜底
- [x] 4.4 修改企业微信入口与活跃任务快照组装逻辑，透传 `packCode`、`packVersion`、`fallbackReason`、`validationFailureReason`

## 5. OpenAI 兼容 HTTP 运行时增强

- [x] 5.1 修改 `backend/src/modules/ai-models/unified-ai-execution.service.ts`，为文本与结构化调用增加 capability 级受控 request overrides 透传口
- [x] 5.2 修改 `backend/src/modules/ai-models/adapters/openai-compatible-http.adapter.ts`，支持合并 capability pack 声明的 provider 请求覆盖项，同时保持现有默认逻辑兼容
- [x] 5.3 为 `backend/src/modules/ai-models/adapters/openai-compatible-http.adapter.ts` 增加 provider 覆盖白名单约束，防止业务层任意透传原始请求体
- [x] 5.4 为未知 override key、非法 structured output mode 或未登记 provider 覆盖增加拒绝与日志断言

## 6. 文件级观测、审计与文档

- [x] 6.1 在 `backend/src/modules/analysis/capability-packs/README.md` 说明 capability pack 目录结构、版本规则、few-shot 编写约束、fixture 用法和 provider tuning 白名单
- [x] 6.2 修改 `backend/src/modules/analysis/ai-gateway.service.ts` 和相关日志埋点，统一输出 `packCode`、`packVersion`、`validationFailureReason`、`fallbackReason`、`providerCode`、`model`
- [x] 6.3 修改企业微信入口、Web 分析入口和 grounded 洞察相关审计快照组装逻辑，保证 capability pack 运行结果能进入现有 `entryInterpretationSnapshot`、`workflowRoutingSnapshot` 或等价结果快照
- [x] 6.4 补充 pack 级开关、灰度和应急回滚说明，确保运维可按 `packCode` 单独回退而不影响其它 pack

## 7. 回归测试与问题验证

- [x] 7.1 修改 `backend/test/modules/analysis/ai-gateway.service.spec.ts`，覆盖企业微信 idle/task reply pack 的最小公共 contract、条件校验、pack 禁用与 failure taxonomy 行为
- [x] 7.2 修改 `backend/test/modules/wecom/wecom-ai-conversation-orchestration.service.spec.ts`，覆盖 `你好`、`你好，你是谁`、`跟进商机`、`新增客户`、`新增商机`、`查看今日日报` 在 `qwen-turbo-latest` 下的路由结果
- [x] 7.3 修改 `backend/test/integration/wecom-ai-conversation.integration-spec.ts`，验证企业微信入口不再因为无关可选字段缺失误落帮助兜底
- [x] 7.4 修改 `backend/test/modules/ai-models/openai-compatible-http.adapter.spec.ts`，覆盖 capability pack request overrides 的透传、白名单约束与兼容回归
- [x] 7.5 修改 `backend/test/modules/analysis/analysis-intent.service.spec.ts` 与 `backend/test/integration/controlled-analysis-orchestration.integration-spec.ts`，覆盖 analysis intent / follow-up / grounded packs 的路由与 fallback 行为
- [x] 7.6 调整测试桩与 fixture 组织方式，确保测试环境复用 pack fixture，而不是维护第二套硬编码意图语义

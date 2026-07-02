## 1. 第一阶段：正式接入基础

- [x] 1.1 扩展 `backend/.env.example`，新增企业微信正式回调、结果回传、重试阈值和测试 transport 所需环境变量占位。
- [x] 1.2 扩展 `backend/src/shared/config/local-runtime-config.service.ts`，让运行时配置能够装载企业微信正式接入与回传参数。
- [x] 1.3 扩展 `backend/src/shared/types/domain.ts`，新增统一入站消息、消息受理状态和结果下发状态所需类型。
- [x] 1.4 在 `backend/src/modules/wecom/` 下新增正式企业微信通道适配器，负责官方 SDK / webhook 回调解析和协议错误映射。
- [x] 1.5 在 `backend/src/modules/wecom/` 下新增统一入站消息模型与 transport 抽象，区分正式下发与测试 transport。
- [x] 1.6 改造 `backend/src/modules/wecom/wecom-bot.controller.ts`，让入口只接收正式回调并输出统一受理结果，同时保留测试环境可控的联调入口。
- [x] 1.7 补充企业微信群聊 / 多发送者场景的归一化字段与限制策略到 `backend/src/modules/wecom/` 的适配层模型中。
- [x] 1.8 新增或更新 `backend/test/contract/wecom-bot.contract-spec.ts`，覆盖正式回调结构、协议错误、不支持消息类型和统一受理结果的契约验证。

## 2. 第一阶段：消息台账、会话隔离与审计

- [x] 2.1 更新 `backend/src/database/app-storage/migrations/001_initial_schema.sql`，新增企业微信消息受理台账与结果下发表结构。
- [x] 2.2 在 `backend/src/modules/wecom/` 下新增企业微信消息受理仓储，按 `messageId` 和会话信息保存受理记录。
- [x] 2.3 在 `backend/src/modules/wecom/` 下新增企业微信结果下发记录仓储，记录每个结果块的发送、重试和失败状态。
- [x] 2.4 改造 `backend/src/modules/wecom/wecom-bot.service.ts`，接入消息幂等判断、重复回调复用、受理状态落库和按 `messageId` 去重逻辑。
- [x] 2.5 扩展 `backend/src/modules/sessions/query-session.repository.ts`，支持按“发送者 + 外部会话”查找和更新会话。
- [x] 2.6 重写 `backend/src/modules/sessions/session-queue.service.ts`，从全局简单并发控制升级为“全局并发 + 会话串行”的双层模型。
- [x] 2.7 扩展 `backend/src/modules/sessions/session-heartbeat.service.ts`，支持更细的会话状态迁移和失活回收。
- [x] 2.8 扩展 `backend/src/modules/audit/` 相关逻辑，记录企业微信消息受理、回传失败、幂等命中和会话状态迁移审计事件。
- [x] 2.9 为同一群聊内不同发送者的隔离键规则补充实现与测试，重点更新 `backend/src/modules/sessions/` 和 `backend/test/integration/`。
- [x] 2.10 新增企业微信消息受理记录查询或内部调试辅助能力，便于后续排查幂等命中、重试和状态迁移问题。
- [x] 2.11 补充 `backend/test/integration/wecom-session-governance.integration-spec.ts`，验证连续追问承接、重复消息去重、多人并发隔离、同会话乱序保护和超时回收场景。

## 3. 第一阶段：真实结果回传

- [x] 3.1 重写 `backend/src/modules/wecom/wecom-stream-dispatcher.service.ts`，实现处理中提示、摘要块、关键指标块、失败终止和有限重试的真实回传流程。
- [x] 3.2 改造 `backend/src/modules/analysis/result-streamer.service.ts`，输出更适合企业微信真实回传的事实结果块。
- [x] 3.3 改造 `backend/src/modules/analysis/analysis-channel-presenter.service.ts`，增加企业微信移动端块裁剪、超长结果回退到 Web 查看提示的规则。
- [x] 3.4 将真实结果分发器接入 `backend/src/modules/wecom/wecom-bot.service.ts`，串联查询受理、异步分发、下发状态更新和失败审计。
- [x] 3.5 为企业微信回答块补充“事实结果层 + AI 解释层”双层结构预留接口，落点在 `backend/src/modules/wecom/` 与 `backend/src/modules/analysis/` 的返回模型。
- [x] 3.6 在 `backend/src/app.module.ts` 或 `backend/src/modules/wecom/wecom.module.ts` 中完成第一阶段企业微信 provider 装配，避免控制器和服务继续散落注册。
- [x] 3.7 补充 `backend/test/integration/wecom-stream-delivery.integration-spec.ts`，覆盖处理中提示、长结果分块、失败停止和重试上限场景。

## 4. 第二阶段：AI 会话编排

- [x] 4.1 在 `backend/src/modules/wecom/` 或 `backend/src/modules/analysis/` 下新增 `wecom-ai-conversation-orchestration` 相关服务，负责识别当前轮次是新问题、补问回复、结果解释还是追问改条件。
- [x] 4.2 扩展会话状态模型与仓储，持久化结构化工作记忆，包括主题域、时间范围、指标、维度、待补问槽位和最近一次结果摘要。
- [x] 4.3 改造 `backend/src/modules/analysis/ai-gateway.service.ts` 或新增专用 AI 编排器，使 AI 只能通过受控工具读取权限上下文、调用分析执行和解释真实结果。
- [x] 4.4 补充 `backend/test/integration/wecom-ai-conversation.integration-spec.ts`，验证 AI 直接解释、补问后续跑、基于上一轮结果追问和禁止绕开受控查询工具的场景。
- [x] 4.5 新增企业微信 AI 对话提示词 / 语义上下文配置，明确一期主题域、指标维度词典、同义词、只读边界和拒答口径。
- [x] 4.6 为 AI 工具调用增加审计记录，覆盖读取上下文、执行受控分析、读取最近结果和模板复用行为。
- [x] 4.7 设计并实现会话原文、结构化工作记忆、长会话摘要三层上下文模型的持久化结构。

## 5. 第三阶段：多轮体验增强与维护期降级

- [x] 5.1 改造 `backend/src/modules/analysis/clarification.service.ts` 与相关会话逻辑，支持补问填槽、条件覆盖和追问继承，而不是把每轮补充都视为新问题。
- [x] 5.2 在 `backend/src/modules/wecom/`、`backend/src/modules/analysis/` 与 `backend/src/database/` 相关层新增维护期降级判断与错误映射，区分 CRM 数据源不可用、身份映射源不可用和会话存储不可用。
- [x] 5.3 扩展企业微信回答生成逻辑，让 AI 基于真实结果生成更自然的业务化解释、下一步建议和多轮承接回复，同时保持事实来源受控。
- [x] 5.4 补充 `backend/test/integration/wecom-maintenance-degradation.integration-spec.ts`，验证数据库维护、身份源不可用、会话存储不可用时的明确降级提示与独立审计口径。
- [x] 5.5 实现长会话摘要压缩与上下文裁剪策略，避免企业微信多轮会话无限堆积历史消息。
- [x] 5.6 为维护期降级补充恢复事件、恢复后重新进入正常会话模式和禁止返回样例业务结果的验证。
- [x] 5.7 优化企业微信追问体验，支持“按负责人看”“换成最近三个月”这类条件继承与覆盖型追问。

## 6. 文档与联调收口

- [x] 6.1 更新 `specs/001-crm-intelligent-analytics/contracts/openapi.yaml` 与 `specs/001-crm-intelligent-analytics/quickstart.md`，同步正式企业微信机器人回调、AI 会话编排和维护期降级验证口径。
- [x] 6.2 更新 `docs/需求文档/企业微信机器人.md`，补齐正式接入模式、AI 会话职责、结构化工作记忆、结果回传约束和维护期降级说明。
- [x] 6.3 补充企业微信通道的自动化夹具或联调脚本到 `backend/test/fixtures/` 或 `scripts/`，用于回放正式回调样例、AI 会话样例和维护期降级样例。
- [x] 6.4 为三阶段能力分别补充验收清单或里程碑说明，明确哪些能力属于第一阶段上线必备，哪些属于后续体验增强。

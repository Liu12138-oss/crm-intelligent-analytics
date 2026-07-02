## Why

一期 `generate-daily-report` 已经把日报域、Web 工作台和基础企业微信收口链路立住了，但当前实现又向前走了一步：销售不再只是一段段手工补片段，而是直接在企业微信里用自然口述描述当天跟进，系统需要先把口述拆成固定五类日报字段，再识别客户/项目主数据、给出确认摘要，并在需要时衔接受控 CRM 跟进写回。若这批行为没有独立规格，日报入口、实体识别、候选选择和写回衔接会继续散落在实现里，后续很难判断哪些属于日报二期约束，哪些属于临时提示词。

## What Changes

- 新增企业微信“日报二期”收集能力：只有命中明确主题入口时才进入日报收集，避免普通聊天被误识别为日报。
- 新增自由口述拆解能力：系统把一段日报口述自动拆成“客户/商机跟进、是否有新增客户/商机、是否需要信息共享、是否需要困难/协助、明日计划”五类结构化片段。
- 新增日报主数据识别与确认摘要：系统在正式落片段前先识别客户/项目候选、生成逐条跟进摘要，允许用户修正未命中名称或在多候选中明确选择。
- 新增日报多轮追问规则：系统按固定顺序补问缺失字段，接受“没有”“无需共享”等负向回答作为有效输入，并在同一会话中持续留在日报链路。
- 新增日报到受控 CRM 跟进写回的桥接：当用户在日报口述中明确要求“写入 CRM 跟进记录”时，系统可在实体确认后挂起待写回草稿，并在写回完成后继续日报剩余收集。

## Capabilities

### New Capabilities
- `generate-daily-report2`: 定义企业微信日报自由口述拆解、客户/项目识别确认、固定五问补录，以及日报场景下受控 CRM 跟进写回桥接能力。

### Modified Capabilities
- `generate-daily-report`: 二期能力依赖一期日报域、日报片段顺序和确认状态，但不改写一期已定义的日报域聚合、确认、提醒和汇总边界。

## Impact

- 影响 `backend/src/modules/wecom/wecom-bot.service.ts` 的日报入口识别、补问顺序、实体确认、多候选选择和会话衔接逻辑。
- 影响 `backend/src/modules/wecom/wecom-daily-report-intake.service.ts` 的自然语言拆句、五类片段识别、公司/项目候选提取和确认摘要生成逻辑。
- 影响 `backend/src/modules/wecom/wecom-ai-prompt.config.ts` 的日报主题入口词、分步追问文案和阻断提示语。
- 影响 `backend/src/modules/opportunities/*` 与 `backend/src/modules/wecom/follow-up-writeback.repository.ts` 的日报内受控写回桥接，但不改变独立写回能力的审计与幂等边界。
- 影响 `backend/test/integration/wecom-ai-conversation.integration-spec.ts`、`backend/test/modules/wecom/wecom-daily-report-intake.service.spec.ts` 等测试用例，需要把日报二期口述场景固化为回归样例。

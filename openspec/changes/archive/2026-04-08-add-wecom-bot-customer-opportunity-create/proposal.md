## Why

当前仓库已经具备企业微信“今日跟进”受控写回链路，以及受会话鉴权保护的新增客户、新增商机内部接口口子，但企业微信机器人仍会把“新增客户”“新建商机”统一拒绝，导致一线销售只能切回 Web 或人工补录。现在需要把这两类高频录入动作按“仿照商机跟进”的受控模式接入企业微信机器人，在不放宽白名单、确认、审计和 CRM 官方 API 约束的前提下，补齐移动端创建闭环。

## What Changes

- 在企业微信机器人中新增“新建客户”“新建商机”两条受控创建链路，允许用户通过主题入口触发收集、补齐、确认、取消和重试。
- 复用既有新增客户、新增商机服务与 CRM 官方 Open API，不新增数据库直写路径，也不绕过现有字段映射和必填校验。
- 为机器人创建链路补充内置 CRM 账号 token 解析、明确失败提示和审计留痕，避免依赖发送人的 Web 登录态。
- 将企业微信一期边界从“仅允许唯一 Opportunity 跟进写回”调整为“允许受控跟进写回 + 受控新增客户/新增商机”，并同步更新主规格、快速验证、数据模型与接口契约。

## Capabilities

### New Capabilities
- `wecom-bot-customer-create`: 定义企业微信机器人受控新建客户的触发方式、字段补齐、确认执行与失败处理。
- `wecom-bot-opportunity-create`: 定义企业微信机器人受控新建商机的触发方式、客户解析、字段补齐、确认执行与失败处理。
- `wecom-bot-crm-create-authentication`: 定义企业微信机器人执行新增客户、新增商机时的内置 CRM 账号认证、审计与失败反馈要求。

### Modified Capabilities
- `crm-api-first-integration`: 明确企业微信机器人新增客户/新增商机链路同样必须优先复用 CRM 官方创建接口，不得因为已有聊天状态机而引入数据库直写或未审计写入。

## Impact

- 影响 `backend/src/modules/wecom/` 下的会话编排、提示文案、上下文状态和机器人回复。
- 影响 `backend/src/modules/opportunities/` 下的新增客户、新增商机服务在企业微信场景下的复用方式。
- 影响 `backend/test/integration/wecom-ai-conversation.integration-spec.ts` 以及相关单元测试、契约测试。
- 影响 [`specs/001-crm-intelligent-analytics/spec.md`](/d:/code/CRM/specs/001-crm-intelligent-analytics/spec.md)、[`specs/001-crm-intelligent-analytics/plan.md`](/d:/code/CRM/specs/001-crm-intelligent-analytics/plan.md)、[`specs/001-crm-intelligent-analytics/data-model.md`](/d:/code/CRM/specs/001-crm-intelligent-analytics/data-model.md)、[`specs/001-crm-intelligent-analytics/quickstart.md`](/d:/code/CRM/specs/001-crm-intelligent-analytics/quickstart.md)、[`specs/001-crm-intelligent-analytics/contracts/openapi.yaml`](/d:/code/CRM/specs/001-crm-intelligent-analytics/contracts/openapi.yaml)。

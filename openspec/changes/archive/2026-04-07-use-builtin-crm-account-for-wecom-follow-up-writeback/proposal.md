## Why

当前企业微信机器人在执行 CRM 跟进写回时，仍依赖发送人的本地登录会话中的 `CRM access token`。这导致企业微信用户即使已经完成身份映射并进入受控写回确认流程，最终仍可能因为没有有效 Web 登录态而写回失败，影响机器人链路的可用性。

## What Changes

- 为企业微信机器人跟进写回新增独立的内置 CRM 账号认证配置，包含用户名和密码两个配置项。
- 新增机器人写回专用的 CRM token 获取逻辑，通过内置账号登录 CRM Open API 后执行 `POST /api/v2/revisit_logs`，不再依赖当前发送人的会话 token。
- 保持跟进写回仍走现有受控确认、失败保留、审计留痕与幂等保护链路，不调整 Web 登录、扫码登录和普通查询认证逻辑。
- 在机器人写回草稿与最终写回内容中，统一追加实际企微发送人的署名，格式为 `实际跟进人：跟进内容`，用于区分系统账号代写与真实业务跟进人。

## Capabilities

### New Capabilities
- `wecom-follow-up-writeback-authentication`: 定义企业微信机器人跟进写回的内置 CRM 账号认证、失败反馈和实际跟进人署名要求。

### Modified Capabilities
- `crm-api-first-integration`: 机器人跟进写回在继续优先复用 CRM 官方 API 的前提下，补充“可通过受控内置账号换取 API token”的执行约束。

## Impact

- 影响 `backend/src/shared/config/local-runtime-config.service.ts` 的 CRM Open API 运行时配置读取。
- 影响 `backend/src/modules/opportunities/crm-follow-up-writeback.service.ts` 的写回认证与请求头生成逻辑。
- 影响 `backend/src/modules/wecom/wecom-bot.service.ts` 的跟进草稿内容生成与确认展示逻辑。
- 影响 `backend/.env.example`、`specs/001-crm-intelligent-analytics/spec.md`、`specs/001-crm-intelligent-analytics/quickstart.md` 的配置与验收说明。
- 影响企业微信跟进写回相关单测与集成测试。

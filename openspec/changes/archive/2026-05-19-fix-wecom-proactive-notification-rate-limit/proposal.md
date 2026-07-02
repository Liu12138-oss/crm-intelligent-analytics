## Why

2026-05-18 试点首日的用户行为审计显示，3 条 22 点无 CRM 数据日报提醒均发送失败。排查确认接收人映射与真实发送开关均正常，底层企业微信 AI 机器人 WebSocket 返回 `errcode=846607`，含义为机器人发送频率超限。

当前主动通知底座把用户可见正式通知全部收敛到企业微信机器人通道，并在失败后以较短间隔连续重试。这个策略在低频交互场景可用，但不适合日报提醒、团队汇总等定时批量通知，会放大机器人通道限流风险，并且审计里只显示泛化失败原因，无法直接定位为企业微信频率限制。

## What Changes

- 调整企业微信主动通知通道路由：会话上下文强相关的异步回推继续走企业微信机器人；日报提醒、日报确认、团队汇总等固定周期系统通知默认走企业微信自建应用消息。
- 保留统一通知中心入口，业务模块仍只提交标准化主动通知任务，不允许绕过接收人解析、权限校验、幂等、重试和审计。
- 为企业微信机器人主动推送增加全局串行队列、最小发送间隔和频率限制退避策略，避免短时间内连续撞限。
- 识别企业微信 AI 机器人频率限制错误 `846607`，把失败原因归一为“企业微信机器人发送频率超限”，并在通知任务、尝试记录和审计快照中保留外部错误码、外部错误信息、重试策略和下一次可重试时间。
- 修正日报调度审计时间口径：审计事件创建时间记录实际事件发生时间，计划触发时间、实际发送尝试时间和调度业务日期进入 `sessionSnapshot`，避免页面同时出现 `22:00` 与 `22:41` 但缺少解释。
- 调整生产运维配置建议：短期将机器人重试间隔提升到分钟级；正式代码上线后由路由和限流队列承担长期防护。
- 补齐日报通知、主动通知路由、机器人限流、错误归因和审计时间口径的自动化回归测试。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `wecom-proactive-notification-delivery`: 修改用户可见主动通知的通道路由原则，新增机器人通道限流、频率限制错误归因、退避重试和审计可解释性要求。
- `wecom-daily-report-reminder-summary`: 修改日报通知发送通道要求，日报固定周期通知默认走企业微信自建应用消息，同时继续复用统一主动通知底座、真实发送开关、测试改投、幂等和审计。

## Impact

- 后端通知模块：`backend/src/modules/notifications/proactive-notification.service.ts`、`wecom-bot-notification.service.ts`、`wecom-app-message.service.ts`、`notification.module.ts` 及相关类型。
- 企业微信传输模块：`backend/src/modules/wecom/wecom-transport.service.ts` 或新增 Bot 发送队列/错误归因辅助模块。
- 日报模块：`backend/src/modules/daily-report/daily-report-dispatcher.service.ts`、`daily-report.service.ts`、`daily-report-scheduler.service.ts` 的发送与审计时间口径。
- 运行配置：新增或明确 `WECOM_BOT_PROACTIVE_MIN_INTERVAL_MS`、`WECOM_BOT_RATE_LIMIT_RETRY_DELAYS_MS`、`WECOM_BOT_DELIVERY_RETRY_DELAY_MS` 等配置含义；现有 `WECOM_NOTIFY_*` 继续生效。
- 测试：更新主动通知、日报联调、审计检索相关 Jest / Supertest / Vitest 用例。
- 文档：同步更新日报生产联调清单、生产部署参数说明和企业微信主动通知排障口径。

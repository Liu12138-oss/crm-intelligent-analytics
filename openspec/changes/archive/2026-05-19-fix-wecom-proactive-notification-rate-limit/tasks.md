## 1. 生产止血与现状固化

- [x] 1.1 在生产环境将 `WECOM_BOT_DELIVERY_RETRY_DELAY_MS` 调整为 `60000`，并记录变更时间、当前值和回滚值
- [x] 1.2 导出或记录 2026-05-18 三条失败任务与 `846607` 日志证据，作为回归验证样例
- [x] 1.3 若需要补发失败提醒，按罗岩、曹晓敬、史鹏勇逐条补发，并保证每条间隔 1 到 2 分钟
- [x] 1.4 在日报生产联调记录中标明短期止血配置只是临时措施，长期修复以通道路由和 Bot 限流为准

## 2. 通知通道路由改造

- [x] 2.1 扩展主动通知输入或元数据，支持 `deliveryClass` 区分 `SYSTEM_SCHEDULED`、`FORMAL_NOTICE`、`CONVERSATION_CONTEXT`
- [x] 2.2 修改 `ProactiveNotificationService.resolveChannel()`，将日报固定周期通知和 `SYSTEM_SCHEDULED` 路由到 `WECOM_APP_MESSAGE`
- [x] 2.3 保留 `CONVERSATION_CONTEXT` 与 `WECOM_CONVERSATION` 场景走 `WECOM_BOT_MESSAGE`
- [x] 2.4 将 `WecomAppMessageService` 注入通知模块并接入 `deliverWithRetry()`，使最终通道决定实际发送适配器
- [x] 2.5 确保业务模块仍只调用 `ProactiveNotificationService`，不得在日报模块直接调用企业微信应用消息或机器人 SDK
- [x] 2.6 更新通知任务记录，保证 `preferredChannel`、`resolvedChannel`、`testModeApplied`、`realMessageEnabled` 在新路由下语义准确
- [x] 2.7 修改 `WecomAppMessageService` 的测试改投行为：非自动化测试运行环境即使 `realMessageEnabled=false`，也必须真实发送给已改投的测试接收人
- [x] 2.8 为 `WecomAppMessageService` 增加统一异常捕获，确保 access_token、fetch、请求体构造和企业微信业务错误都返回标准失败结果
- [x] 2.9 为 `WecomAppMessageService` 接入自建应用消息发送队列，保证批量通知逐条发送且相邻消息满足最小间隔

## 3. 企业微信机器人限流与错误归因

- [x] 3.1 新增企业微信机器人主动发送队列，保证同一服务进程内 Bot 主动通知串行发送
- [x] 3.2 新增 `WECOM_BOT_PROACTIVE_MIN_INTERVAL_MS` 配置，默认相邻 Bot 主动发送至少间隔 `15000ms`
- [x] 3.3 新增 `WECOM_BOT_RATE_LIMIT_RETRY_DELAYS_MS` 配置，默认使用 `60000,180000,300000`
- [x] 3.4 实现企业微信 SDK 错误解析器，提取 `errcode`、`errmsg`、`hint` 等外部错误上下文
- [x] 3.5 将 `846607` 归一为“企业微信机器人发送频率超限”，并按频率限制退避配置重试
- [x] 3.6 普通网络失败继续使用有限重试，但不得低于配置的最小安全间隔
- [x] 3.7 若 SDK 只写日志不抛出 ACK 错误，补充 SDK 事件监听或响应包装，确保调用方能拿到失败状态

## 3A. 企业微信自建应用消息限流与批量间隔

- [x] 3A.1 新增 `WECOM_APP_MESSAGE_MIN_INTERVAL_MS` 配置，默认相邻自建应用消息至少间隔 `3000ms`
- [x] 3A.2 新增 `WECOM_APP_MESSAGE_MAX_RETRIES` 配置，默认自建应用消息最多重试 `2` 次
- [x] 3A.3 新增 `WECOM_APP_MESSAGE_RATE_LIMIT_RETRY_DELAYS_MS` 配置，默认使用 `60000,180000,300000`
- [x] 3A.4 新增或复用统一主动通知发送队列，确保自建应用消息批量发送并发数为 `1`
- [x] 3A.5 识别企业微信自建应用消息频率限制、系统繁忙、临时不可用等错误，并按退避配置重试
- [x] 3A.6 确认测试改投、手工补发、22 点催报和团队汇总都进入同一个自建应用消息队列，不允许并发发送

## 4. 任务记录与审计可解释性

- [x] 4.1 扩展发送尝试记录，保存外部错误码、外部错误信息、重试策略、下一次可重试时间和最后尝试时间
- [x] 4.2 修改 `PROACTIVE_NOTIFICATION_FAILED` 审计快照，写入通知任务 ID、最终通道、发送统计、外部错误码、中文失败原因和重试次数
- [x] 4.3 修改日报提醒审计创建时间，`createdAt` 使用实际写入审计时间
- [x] 4.4 在日报审计 `sessionSnapshot` 中写入 `scheduledAt`、`actualDispatchStartedAt`、`lastAttemptAt`、`notificationTaskId`、`resolvedChannel`
- [x] 4.5 前端审计中心如展示失败详情，必须把 `846607` 显示为中文“企业微信机器人发送频率超限”，技术字段只放在治理排障区域
- [x] 4.6 增加通知任务异常兜底，任何发送适配器抛出的异常都必须落为失败任务和失败审计，不能让任务停留在 `PENDING`

## 5. 日报通知链路调整

- [x] 5.1 为日报催报、个人确认、正式对上推送和团队汇总设置 `deliveryClass=SYSTEM_SCHEDULED`
- [x] 5.2 确认 `WECOM_NOTIFY_REAL_MESSAGE_ENABLED=false` 时，日报应用消息仍改投 `WECOM_NOTIFY_TEST_USER_ID`
- [x] 5.3 确认 `WECOM_NOTIFY_REAL_MESSAGE_ENABLED=true` 时，日报固定周期通知走企业微信自建应用消息真实发送
- [x] 5.4 保留日报会话型异步结果回推走企业微信机器人通道
- [x] 5.5 为自建应用消息正文补充后续处理入口文案，明确继续回到 CRM 智能分析机器人或 Web 工作台处理
- [x] 5.6 确认 22 点催报、个人确认、正式对上推送和团队汇总批量发送时均按最小间隔逐条投递

## 6. 自动化测试

- [x] 6.1 更新 `proactive-notification.integration-spec.ts`，覆盖日报固定周期通知默认走 `WECOM_APP_MESSAGE`
- [x] 6.2 增加会话型通知仍走 `WECOM_BOT_MESSAGE` 的回归测试
- [x] 6.3 增加真实发送关闭时应用消息测试改投测试接收人的测试
- [x] 6.4 增加 `846607` 错误解析、中文归因和退避重试测试
- [x] 6.5 增加 Bot 主动发送队列串行与最小间隔测试，避免并发发送回归
- [x] 6.6 更新日报集成测试，验证 22 点提醒审计包含计划时间、实际发送时间和通知任务 ID
- [x] 6.7 更新审计页面单元测试，验证频率限制错误显示为中文业务可读文案
- [x] 6.8 增加企业微信自建应用消息 access_token 获取失败、HTTP 失败、网络异常和无效接收人的适配器测试
- [x] 6.9 增加发送适配器抛异常时主动通知任务仍落库为失败并写审计的集成测试
- [x] 6.10 增加自建应用消息批量发送队列测试，验证并发数为 `1` 且相邻消息满足 `WECOM_APP_MESSAGE_MIN_INTERVAL_MS`
- [x] 6.11 增加自建应用消息频率限制、系统繁忙和临时不可用错误的退避重试测试

## 7. 文档与部署说明

- [x] 7.1 更新 `docs/architecture/日报生产联调清单.md`，补充自建应用消息联调、频率限制排查和补发间隔要求
- [x] 7.2 更新 `docs/architecture/生产部署指南.md`，补充新配置项和 `WECOM_NOTIFY_*` 健康检查口径
- [x] 7.3 更新 `docs/architecture/deploy-examples/生产部署参数清单.md`，补充 Bot 与自建应用消息限流配置默认值和说明
- [x] 7.4 检查 `README.md` 中企业微信机器人当前支持能力章节，如用户可见能力列表受影响则同步更新

## 8. 验证与上线

- [x] 8.1 运行后端通知、日报、审计相关单元与集成测试
- [x] 8.2 在测试环境执行日报测试改投，确认审计保留真实目标预览和最终通道
- [x] 8.3 在测试环境开启真实发送到小范围测试成员，确认自建应用消息可送达
- [x] 8.4 检查 journal 中不再出现日报固定周期通知触发的 `846607`
- [ ] 8.5 上线后观察首个 22 点日报提醒批次，确认失败审计为 0 或能显示明确中文失败原因
- [x] 8.6 准备回滚步骤：保留分钟级 Bot 重试间隔，必要时关闭日报真实发送并改投测试接收人
- [x] 8.7 上线后抽查首个批量发送批次的发送时间戳，确认相邻自建应用消息满足配置间隔

> 说明：生产配置、失败样例、补发、测试改投、小范围真实发送、journal 检查和批量间隔证据见 `verification.md`。`8.5` 需要等待代码上线后的首个真实 22 点日报提醒批次发生后补充结果；生产机已预置只读观察 timer，批次后可读取 `verification.md` 中记录的输出文件。

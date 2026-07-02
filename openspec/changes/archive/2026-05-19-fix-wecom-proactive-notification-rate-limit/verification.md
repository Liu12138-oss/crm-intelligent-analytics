# 执行与验证记录

## 生产配置止血

- 生产服务：`crm-intelligent-analytics.service`
- 当前发布目录：`/srv/crm-intelligent-analytics/releases/20260518-225033-wecom-rate-limit`
- 配置文件：`/srv/crm-intelligent-analytics/shared/backend.env`
- 变更时间：服务端时间 `2026-05-18 22:44:49 -0400`
- 当前值：`WECOM_BOT_DELIVERY_RETRY_DELAY_MS=60000`
- 回滚值：移除该变量并恢复到代码默认值，或恢复备份文件 `/srv/crm-intelligent-analytics/shared/backend.env.backup-before-wecom-bot-delay-20260518-224447`
- 当前长期防护配置：
  - `WECOM_BOT_PROACTIVE_MIN_INTERVAL_MS=15000`
  - `WECOM_BOT_RATE_LIMIT_RETRY_DELAYS_MS=60000,180000,300000`
  - `WECOM_APP_MESSAGE_MIN_INTERVAL_MS=3000`
  - `WECOM_APP_MESSAGE_MAX_RETRIES=2`
  - `WECOM_APP_MESSAGE_RATE_LIMIT_RETRY_DELAYS_MS=60000,180000,300000`
  - `WECOM_PROACTIVE_BULK_MAX_CONCURRENCY=1`

## 2026-05-18 失败样例

2026-05-18 首日试点共有 3 条 22 点无 CRM 数据日报提醒失败。journal 中 `846607` 命中 9 次，企业微信返回含义为机器人发送频率超限。

| 失败任务 | 接收人 | CRM 用户 ID | 企业微信成员 | 场景 | 状态 | 尝试次数 | 最后失败时间 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `notify_task_7430cebf` | 罗岩 | `2223594` | `luoyan` | `daily-report.missing-source-reminder` | `FAILED` | 3 | `2026-05-18T14:41:01.086Z` |
| `notify_task_29902f74` | 曹晓敬 | `2224186` | `caoxiaojing` | `daily-report.missing-source-reminder` | `FAILED` | 3 | `2026-05-18T14:41:13.146Z` |
| `notify_task_1e9f4935` | 史鹏勇 | `2224497` | `shipengyong` | `daily-report.missing-source-reminder` | `FAILED` | 3 | `2026-05-18T14:41:25.433Z` |

对应审计事件包括 `DAILY_REPORT_REMINDER_SENT` 失败记录与 `PROACTIVE_NOTIFICATION_FAILED` 记录，失败原因已作为本次回归样例固化。

## 生产补发记录

已对 2026-05-18 失败提醒执行人工补发，三条均通过企业微信自建应用消息通道真实投递。

| 补发任务 | 接收人 | CRM 用户 ID | 最终通道 | 状态 | 发送开始时间 | 发送完成时间 |
| --- | --- | --- | --- | --- | --- | --- |
| `notify_task_15f3e9b6` | 罗岩 | `2223594` | `WECOM_APP_MESSAGE` | `SENT` | `2026-05-19T03:25:15.069Z` | `2026-05-19T03:25:31.227Z` |
| `notify_task_37054db1` | 曹晓敬 | `2224186` | `WECOM_APP_MESSAGE` | `SENT` | `2026-05-19T03:26:47.839Z` | `2026-05-19T03:26:58.189Z` |
| `notify_task_c3b87f3f` | 史鹏勇 | `2224497` | `WECOM_APP_MESSAGE` | `SENT` | `2026-05-19T03:28:14.990Z` | `2026-05-19T03:28:20.226Z` |

相邻补发发送开始时间间隔为 `92770ms`、`87151ms`，满足每条间隔 1 到 2 分钟的要求。

## 联调验证

### 日报测试改投

- 验证任务：`notify_task_cd4777a6`
- 场景：`daily-report.missing-source-reminder`
- 真实发送开关：`false`
- 最终通道：`WECOM_APP_MESSAGE`
- 改投状态：`testModeApplied=true`
- 真实目标预览：`CRM 用户 2223594`
- 最终接收人：测试接收人
- 发送结果：`SENT`

该验证确认真实发送关闭时，日报固定周期通知不会投递给真实业务对象，但仍按最终通道真实发送给测试接收人，并保留真实目标预览。

### 小范围真实发送

- 验证任务：`notify_task_0104bf57`
- 场景：`daily-report.app-message-smoke`
- 真实发送开关：`true`
- 最终通道：`WECOM_APP_MESSAGE`
- 测试成员：小范围测试成员
- 发送结果：`SENT`

该验证确认企业微信自建应用消息在小范围真实成员上可送达。

### 批量发送间隔

- 验证任务：`notify_task_b77cc5ff`、`notify_task_712ccac9`
- 场景：`daily-report.app-message-bulk-smoke`
- 最终通道：`WECOM_APP_MESSAGE`
- 发送结果：均为 `SENT`
- 发送开始时间：
  - `notify_task_b77cc5ff`：`2026-05-19T03:21:08.727Z`
  - `notify_task_712ccac9`：`2026-05-19T03:21:19.999Z`
- 相邻开始时间间隔：`11272ms`

该验证确认上线后批量自建应用消息进入同一发送队列，且相邻发送开始时间大于 `WECOM_APP_MESSAGE_MIN_INTERVAL_MS=3000`。

## journal 检查

- 检查时间：服务端时间 `2026-05-18 23:30:09 -0400`
- 自当前 release 切换时间 `2026-05-18 22:50:00 -0400` 起，journal 中 `846607` 计数为 `0`
- 自当前 release 切换时间起，journal 中 `frequency limit` 计数为 `0`
- 最新重启后未发现 `error`、`exception`、`846607`、`frequency limit` 或 `failed` 相关异常日志

## 待观察事项

当前服务端时间已晚于本次发布日的 22 点日报批次，代码上线后的首个真实 22 点日报提醒批次尚未发生。因此 `8.5` 需要在下一个真实 22 点批次执行后补充审计结果：确认失败审计为 0，或失败详情能够显示明确中文原因。

已在生产机预置只读观察任务：

- systemd timer：`crm-observe-next-22-daily-report.timer`
- 计划执行时间：服务端本地时间 `2026-05-19 11:05:00 EDT`，用于覆盖北京时间 `2026-05-19 22:00` 后的批次观察窗口
- 输出文件：`/srv/crm-intelligent-analytics/shared/ops/wecom-rate-limit-next-22-observation-20260519.log`
- 观察内容：服务状态、journal 中 `846607` 与 `frequency limit` 计数、日报通知任务数量、失败数量、最终通道、失败中文原因和发送尝试时间

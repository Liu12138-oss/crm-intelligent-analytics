## 1. 企业微信入口识别与权限边界

- [x] 1.1 在 `backend/src/modules/wecom/` 中新增“显式索取小组今日日报”的意图识别，要求同时命中日报主题、小组目标、今天 / 今日时间和主动索取动作
- [x] 1.2 复用 `backend/src/modules/daily-report/sales-leader-mapping.service.ts` 解析负责人 / 小组目标，并补充“本人负责小组 / 直属下级负责小组 / 管理员任意小组”的权限校验
- [x] 1.3 保持 `王文定小组日报` 这类低置信短句继续返回帮助兜底，避免误命中新能力

## 2. 小组日报预览服务复用

- [x] 2.1 在 `backend/src/modules/daily-report/daily-report.service.ts` 中新增按负责人生成当天小组日报预览的服务出口，复用现有成员快照与团队正文拼装逻辑
- [x] 2.2 明确该预览出口“不创建 summary batch、不触发主动通知”的边界，并补充负责人未命中、无权限、空状态的中文返回口径
- [x] 2.3 在 `backend/src/modules/wecom/wecom-bot.service.ts` 中接入该预览链路，确保企业微信当前会话能直接返回结果

## 3. 验证与文档同步

- [x] 3.1 新增企业微信集成测试，覆盖显式索取成功、低置信短句继续帮助、无权限阻断、负责人未命中澄清和空状态预览
- [x] 3.2 为日报服务补充集成测试，验证聊天预览不会创建正式汇总批次，也不会触发主动通知任务
- [x] 3.3 同步更新 `README.md`、企业微信统一能力目录和 `specs/001-crm-intelligent-analytics/quickstart.md` 中的用户可见能力与验证场景说明

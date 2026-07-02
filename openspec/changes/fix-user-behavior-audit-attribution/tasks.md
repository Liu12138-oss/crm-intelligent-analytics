## 1. 审计模型与统一构建

- [x] 1.1 在 `backend/src/shared/types/domain.ts` 为 `AuditEventRecord` 增加可选展示与归因字段
- [x] 1.2 新增或抽取 `backend/src/modules/audit/audit-event-builder.service.ts`
- [x] 1.3 在 builder 中实现 CRM 用户 actor 构建逻辑
- [x] 1.4 在 builder 中实现未绑定企业微信用户 actor 构建逻辑，统一使用 `wecom:<senderId>`
- [x] 1.5 在 builder 中实现系统任务 actor 构建逻辑
- [x] 1.6 在 builder 中实现通道代理字段构建逻辑，区分真实 actor 与机器人 channel agent
- [x] 1.7 为 builder 补单元测试，覆盖 CRM 用户、未绑定企业微信用户、系统任务和机器人代理四类输入
- [x] 1.8 确认新增字段全部为可选字段，并用旧审计记录样例验证列表接口和前端展示不报错

## 2. 企业微信入站真实发送人修复

- [x] 2.1 修改 `backend/src/modules/wecom/wecom-message-adapter.service.ts` 的 sender 解析优先级，优先使用 `from.userid`
- [x] 2.2 在入站消息模型中保留 `rawSenderId`、`botId` 或等价通道代理字段
- [x] 2.3 当顶层 `senderId` 与机器人 ID 相同时，不得将其作为真实用户
- [x] 2.4 群聊消息缺少真实发送人时继续拒绝进入正式链路
- [x] 2.5 补充 `wecom-message-adapter` 单测，覆盖 SDK body、webhook body、顶层 senderId 为机器人、群聊真实发送人四类场景

## 3. 企业微信审计归因修复

- [x] 3.1 改造 `WecomBotService` 的通用 `audit(...)` 方法，默认写入 `channel: 'wecom-bot'` 和通道代理摘要
- [x] 3.2 改造 `MAINTENANCE_DEGRADED` 审计，未解析 CRM 用户时记录未绑定企业微信用户而不是机器人
- [x] 3.3 改造 `WECOM_MESSAGE_REJECTED` 审计，保留真实 senderId、botId、会话和消息 ID
- [x] 3.4 改造 `WECOM_AUTH_FAILED` 审计，优先记录 `wecom:<senderId>`，无法获得 senderId 时才使用系统入口 actor
- [x] 3.5 改造 `MAINTENANCE_RECOVERED` 审计，能解析 CRM 用户时记录 CRM 用户，不能解析时记录未绑定企业微信用户
- [x] 3.6 为企业微信查询成功链路补集成测试，断言审计 actor 是 CRM 用户 ID 而不是机器人 ID
- [x] 3.7 为未绑定企业微信用户被拒绝链路补集成测试，断言页面可用字段中显示未绑定企业微信用户

## 4. 查询审计字段与统计修复

- [x] 4.1 修改 `AnalysisService` 查询成功审计，写入真实 `channel`
- [x] 4.2 修改 `AnalysisService` 查询阻断、澄清和解释审计，补齐 `channel`、动作摘要和对象摘要
- [x] 4.3 检查日报、主动通知、跟进写回、企业微信 CRM 创建、合同审核和治理审计写入点，补齐可展示摘要字段
- [x] 4.4 修改 `AuditController` 的 `wecomQueryRatioPercent`，按真实企业微信查询事件计算
- [x] 4.5 补合约测试或集成测试，覆盖企业微信占比不是固定值

## 5. 审计列表接口兼容

- [x] 5.1 修改 `AuditController.mapAuditEventItem`，返回 actor 类型、展示名、外部 ID、绑定状态、通道代理、动作摘要和对象摘要
- [x] 5.2 修改 `resolveActorName`，优先使用事件自带展示名，再解析 CRM 用户、企业微信映射、未绑定企业微信用户和系统任务
- [x] 5.3 修改 actor 筛选逻辑，支持按用户名、CRM 用户 ID、企业微信 senderId 和 `wecom:<senderId>` 匹配
- [x] 5.4 保持旧审计记录兼容，旧记录缺少新增字段时不得导致列表接口失败
- [x] 5.5 补 `governance-audit.contract-spec.ts`，覆盖新增字段和旧记录兼容

## 6. 前端事件类型字典

- [x] 6.1 补齐 `frontend/src/ui/business-code-labels.ts` 中所有当前后端 `AuditEventType` 中文标签
- [x] 6.2 将 `fallback` 相关展示文案统一调整为“AI 兜底”，避免用户行为审计主区出现英文术语
- [x] 6.3 修改 `frontend/tests/unit/business-code-labels.spec.ts`，覆盖日报、主动通知、跟进写回、合同审核和语义知识治理事件
- [x] 6.4 增加字典覆盖测试，确保当前后端已定义事件不会显示为“未知事件类型”

## 7. 前端用户行为审计页面

- [x] 7.1 修改 `frontend/src/types/analysis.ts` 的 `AuditEventList` 类型，增加新增审计展示字段
- [x] 7.2 将用户行为审计表格主列调整为时间、用户、绑定状态、入口、事件类型、业务对象、操作摘要、结果和风险等级
- [x] 7.3 将入口场景、目标工作流、AI 兜底和执行轨迹保留在 AI 审计分区或详情展示中
- [x] 7.4 将事件类型筛选改为可搜索下拉，显示中文标签并提交事件码
- [x] 7.5 未绑定企业微信用户显示为“未绑定 CRM 用户（企业微信：xxx）”或同等中文
- [x] 7.6 修改 `frontend/tests/unit/audit-event-page.spec.ts`，覆盖用户行为审计不再展示大量 AI 专属空列
- [x] 7.7 修改前端测试，覆盖未绑定企业微信用户不显示为机器人

## 8. 历史数据修复脚本

- [x] 8.1 新增 `backend/scripts/repair-audit-actor-attribution.ts`
- [x] 8.2 实现 dry-run 模式，输出疑似机器人归因、可映射、未绑定和无法判断数量
- [x] 8.3 实现 `--apply` 模式，按 CRM 映射或 `wecom:<senderId>` 回填 actor
- [x] 8.4 将原机器人或应用 ID 保留到通道代理字段或迁移备注
- [x] 8.5 补脚本单测或最小集成测试，确保 dry-run 不写入、apply 才写入

## 9. 回归验证

- [x] 9.1 运行 `pnpm --dir backend test -- wecom-query.integration-spec.ts`
- [x] 9.2 运行 `pnpm --dir backend test -- governance-audit.contract-spec.ts`
- [x] 9.3 运行 `pnpm --dir backend test -- audit-persistence.spec.ts`
- [x] 9.4 运行 `pnpm --dir frontend test:unit -- business-code-labels.spec.ts`
- [x] 9.5 运行 `pnpm --dir frontend test:unit -- audit-event-page.spec.ts`
- [x] 9.6 运行 `pnpm --dir backend build`
- [x] 9.7 运行 `pnpm --dir frontend build`
- [x] 9.8 回归验证 Web 问数、企业微信问数、日报提醒/汇总、跟进写回、主动通知、权限治理、合同审核、导出和 SQL 审计的既有主链路未被本次修改破坏

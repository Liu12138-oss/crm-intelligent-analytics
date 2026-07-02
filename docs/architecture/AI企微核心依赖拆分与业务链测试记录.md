# AI 企微核心依赖拆分与业务链测试记录

## 1. 本次目标

本次在上一轮入口收敛基础上继续拆分默认依赖，目标是让默认运行态真正收敛为：

1. AI 配置、健康检查、激活和统一调用。
2. 企业微信机器人消息接入、会话、回执、普通 AI 对话和未启用能力提示。

CRM 问数、渠道 CRM、合同评审、日报、客户/商机创建、跟进写回、导出、通知、看板、模板和管理报表不再进入默认 `AppModule` 依赖图。

## 2. 备份

本次依赖拆分前已创建项目备份：

` .tmp/backups/crm-agent-base-before-dependency-split-20260627-152855.zip `

该备份用于回滚到第二阶段拆分前状态。

## 3. 默认依赖图调整

### 3.1 保留的默认模块

`backend/src/app.module.ts` 当前只导入：

- `DatabaseModule`：继续提供本地运行配置、应用存储、日志和现有登录链路所需基础能力。
- `AiModelsModule`：提供 AI Profile、健康检查、激活、运行时解析和统一 AI 执行。

### 3.2 保留的默认控制器

- `AnalysisController`：仅保留 `/analysis/capabilities`，其余分析查询、结果和模板接口固定返回未启用。
- `AiContextGovernanceController`
- `AiModelGovernanceController`
- `WecomBotController`
- `AuthController`

### 3.3 默认剥离的业务 provider

以下 provider 不再由默认 `AppModule` 注册：

- `AnalysisService` 及 CRM 问数执行链。
- `QueryTemplateService`、最近查询和模板推荐链。
- `DailyReportModule` 和日报调度链。
- `NotificationModule` 和主动通知链。
- `ContractReview*` 合同评审链。
- `CrmCustomerApiService`、`CrmOpportunityApiService`、`CrmFollowUpWritebackService` 等 CRM 写回链。
- `ExportService` 导出链。
- `ManagementReportService` 管理报表链。
- `LianruanCrmOpenApi*`、看板、分析仓库等渠道 CRM / 看板链。

旧源码文件未物理删除，后续恢复或归档仍有来源；但默认启动、默认控制器和默认企业微信机器人链路已经不再构造这些业务服务。

## 4. 企业微信机器人链路

### 4.1 新核心服务

新增：

`backend/src/modules/wecom/wecom-core-bot.service.ts`

职责：

- 校验企业微信 HTTP 回调签名和来源。
- 归一化 SDK / HTTP 入站消息。
- 按 `channelMessageId` 去重。
- 按企业微信会话和发送人创建轻量 `QuerySessionRecord`。
- 保存消息回执和投递记录。
- 普通文本进入 `UnifiedAiExecutionService.invokeText()`。
- 已收敛业务请求返回统一未启用提示。
- AI 未配置或调用失败时返回友好降级提示。

### 4.2 控制器切换

`WecomBotController` 已从原 `WecomBotService` 切换到 `WecomCoreBotService`。

外部接口路径不变：

- `POST /wecom/messages`
- `GET /wecom/sessions/:sessionId`
- `GET /wecom/messages/:messageId/receipt`
- `POST /wecom/sessions/:sessionId/heartbeat`

### 4.3 传输层拆 CRM 依赖

`WecomTransportService` 已移除对 `CrmReadonlyService` 的构造依赖。

入站监听前置条件由“CRM 数据源可用”改为“企业微信 SDK 传输配置完整”：

- `botTransportMode === 'sdk'`
- `botWsUrl` 存在
- `botId` 存在
- `botSecret` 存在

因此 CRM 数据库、CRM OpenAPI、渠道 CRM 未配置时，不再阻断企业微信普通 AI 对话链路。

## 5. 能力快照收敛

`SessionCapabilitiesService` 已改为核心能力快照：

- `templateCount = 0`
- `historyEnabled = false`
- `exportAllowed = false`
- `followUpAllowed = false`
- `templateViewAllowed = false`
- `contractWorkspaceAllowed = false`
- `metrics = []`
- `dimensions = []`
- `domains = []`
- 前端可见菜单只保留 `ai-model-governance`
- 动作权限只保留 `ai_profile.manage`

这样 `/analysis/capabilities` 不再为了生成快照而构造模板、分析路线、数据新鲜度、CRM 查询资产等旧服务。

## 6. 业务请求边界

企业微信机器人当前默认处理规则：

| 请求类型 | 当前行为 |
| --- | --- |
| 普通知识、写作、总结、翻译、方案梳理 | 调用统一 AI 执行服务生成回复 |
| CRM 问数、客户、商机、渠道、回款、订单、销售数据 | 返回“当前机器人已收敛为普通 AI 对话模式”提示 |
| 合同评审、合同审核 | 返回未启用提示，不生成合同风险结论 |
| 日报、周报、月报 | 返回未启用提示，不进入日报链路 |
| 新增客户、新增商机、跟进写回 | 返回未启用提示，不调用 CRM 写回 |
| 导出、下载、数据明细 | 返回未启用提示，不生成导出任务 |
| AI 未配置或失败 | 返回 AI 配置/可用性提示，不暴露密钥、堆栈或内部地址 |

## 7. 保留但未默认启用的内容

以下内容仍保留在仓库中，但不进入默认运行链：

- 历史 CRM 分析源码和测试。
- 合同评审源码、标准包相关逻辑和测试。
- 日报、通知、写回、看板、导出源码。
- 历史前端页面源码。
- 历史文档和规格。

保留原因：

1. 用户未要求不可恢复的物理删除。
2. 后续可能按模块重新启用。
3. 部分历史测试和文档仍可作为业务恢复参考。

## 8. 验证结果

### 8.1 Nest 默认模块编译

已通过：

```powershell
pnpm --dir backend exec ts-node --transpile-only -e "process.env.NODE_ENV='test'; const { Test } = require('@nestjs/testing'); const { AppModule } = require('./src/app.module'); Test.createTestingModule({ imports: [AppModule] }).compile().then(m => { console.log('nest app module compiled'); return m.close(); }).catch(error => { console.error(error); process.exit(1); });"
```

结果：

```text
nest app module compiled
```

### 8.2 核心单元测试

已通过：

```powershell
pnpm --dir backend exec jest --runInBand --runTestsByPath test/modules/wecom/wecom-core-bot.service.spec.ts test/modules/wecom/wecom-message-adapter.service.spec.ts test/modules/wecom/wecom-stream-dispatcher.service.spec.ts test/modules/wecom/wecom-transport.service.spec.ts test/modules/wecom/wecom-maintenance-degradation.service.spec.ts test/modules/ai-models/ai-runtime-config.resolver.spec.ts test/modules/ai-models/unified-ai-execution.service.spec.ts
```

结果：

```text
Test Suites: 7 passed, 7 total
Tests: 24 passed, 24 total
```

### 8.3 企业微信业务请求冒烟

通过 `WecomBotController.receiveMessage()` 走真实默认 `AppModule`：

输入：

```text
帮我查询本月客户和商机排名
```

结果摘要：

```json
{
  "status": "BUSINESS_DISABLED",
  "deliveryStatus": "SENT",
  "deliveredBlockCount": 1,
  "receiptStatus": "ACCEPTED",
  "sessionStatus": "IDLE"
}
```

说明：

- 企业微信入口可用。
- 消息回执已保存。
- 会话已创建并回到 `IDLE`。
- 业务请求被收敛提示拦截。
- 未调用 CRM 分析、客户、商机或写回链路。

### 8.4 普通 AI 对话降级冒烟

在 AI 环境变量置空时输入：

```text
帮我写一段会议纪要开头
```

结果摘要：

```json
{
  "status": "AI_UNAVAILABLE",
  "deliveryStatus": "SENT",
  "deliveredBlockCount": 1,
  "receiptStatus": "ACCEPTED"
}
```

投递内容包含：

```text
AI 服务暂时不可用或尚未配置完成。
```

说明：

- 普通 AI 对话链路没有被 CRM、合同、日报依赖阻断。
- AI 未配置时可控降级。
- 配置恢复后会继续通过 `UnifiedAiExecutionService` 调用当前 AI Profile。

### 8.5 完整后端构建

执行：

```powershell
pnpm --dir backend build
```

结果：未通过。

失败原因仍为仓库既有 TypeScript 环境/类型问题，主要集中在：

- Express `Request` / `Response` 类型缺失或不匹配。
- Fetch `Response` / `RequestInit` 类型缺失或被其它类型遮蔽。
- Supertest `Test` 类型缺少 `set`、`send`、`query` 等方法。
- 历史合同、CRM、通知、机会、集成测试文件仍参与 `tsc` 编译。

对本轮修改文件名过滤后，未发现以下文件产生新的构建错误：

- `backend/src/app.module.ts`
- `backend/src/modules/analysis/analysis.controller.ts`
- `backend/src/modules/sessions/session-capabilities.service.ts`
- `backend/src/modules/wecom/wecom-bot.controller.ts`
- `backend/src/modules/wecom/wecom-core-bot.service.ts`
- `backend/src/modules/wecom/wecom-transport.service.ts`

## 9. 当前项目状态

当前默认项目状态为“AI + 企业微信机器人核心收敛态”：

- 默认后端依赖图已瘦身。
- 企业微信机器人不再默认构造大业务编排服务。
- 企业微信入站监听不再依赖 CRM 数据源。
- 能力快照不再依赖 CRM 分析、模板、合同、导出和查询资产。
- CRM、渠道 CRM、合同评审、日报、写回、通知、导出等旧业务代码仍在仓库中，但不再进入默认启动链。
- Web 登录和会话鉴权链路保持原样，仍保留其既有 CRM 登录/身份能力；这是基础认证能力，不属于机器人业务执行链。

## 10. 后续清理建议

如果下一步要继续“物理清理”，建议按以下顺序单独执行：

1. 将历史业务源码移动到 `archive/` 或独立分支前，再做一次完整备份。
2. 为 `auth` 拆出非 CRM 的最小管理登录或只读配置入口，避免 AI 配置页继续依赖 CRM 登录。
3. 将 `DatabaseModule` 拆成 `CoreStorageModule` 和 CRM 数据模块，进一步减少基础模块对 CRM 只读服务的暴露。
4. 清理历史集成测试和 `tsconfig` 包含范围，让完整 `pnpm --dir backend build` 不再编译已封存业务。
5. 再物理删除合同、日报、写回、渠道 CRM、导出等未启用模块。

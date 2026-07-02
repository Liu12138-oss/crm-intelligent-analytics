## Overview

本变更把业务审计拆成三层责任：

1. 入站身份解析层负责从 Web 会话、企业微信回调、系统任务中识别“真实行为主体”。
2. 审计事件构建层负责把行为主体、入口通道、业务对象、动作摘要和风险结果写成统一事件。
3. 审计中心展示层负责把事件转换成中文业务视图，并把 AI 专属字段和通用行为字段分区展示。

核心原则是：真实用户是 actor，机器人只是 channel agent。任何时候都不能因为消息经由机器人而把机器人当成查询人、写回人或拒绝对象。

## Data Model

在现有 `AuditEventRecord` 基础上新增可选字段，保持历史数据兼容：

```ts
actorType?: 'crm-user' | 'wecom-user' | 'system' | 'bot';
actorDisplayName?: string;
actorExternalId?: string;
actorBindingStatus?: 'BOUND_CRM' | 'UNBOUND_WECOM' | 'SYSTEM' | 'UNKNOWN';
channelAgentId?: string;
channelAgentType?: 'wecom-bot' | 'web-console' | 'scheduler' | 'system';
actionSummary?: string;
targetType?: string;
targetId?: string;
targetSummary?: string;
```

字段含义：

- `actorId`：真实行为主体的稳定 ID。已绑定用户用 CRM 用户 ID，未绑定企业微信用户用 `wecom:<senderId>`。
- `actorDisplayName`：页面优先展示的中文名或业务可读名。
- `actorExternalId`：企业微信用户 ID、外部发送者 ID 或其它入口外部身份。
- `actorBindingStatus`：说明行为主体是否已绑定 CRM。
- `channelAgentId`：机器人 ID、企业微信应用 ID、系统任务 ID 等代理标识。
- `actionSummary`：审计列表中的“做了什么”。
- `targetSummary`：审计列表中的“对什么对象做”。

这些字段只保存业务摘要和非敏感标识，不保存密钥、Token、数据库连接、完整 SQL 或大段原始报文。

## Backend Design

### 0. 兼容性原则

本变更必须以“审计口径修复”为边界，不能借机重构或改变无关业务链路。所有新增字段必须是可选字段，所有旧审计记录必须继续能被 `AuditController`、前端审计页面和现有测试数据读取。实现时应优先在现有审计写入口补充字段和归因，不改变原有业务执行顺序、权限判断、消息幂等、日报发送、跟进写回、合同审核、导出或 SQL 审计的主流程。

对于企业微信入站解析，新增真实发送人和通道代理的区分必须保持现有单聊、群聊、SDK body、webhook body、进度流回传和错误提示兼容。任何无法确认的字段形态必须通过测试或诊断日志先验证，不能用一次性假设覆盖所有回调。

### 1. 审计事件构建服务

新增或抽取 `AuditEventBuilderService`，集中生成业务审计事件。

职责：

- 接收 CRM 用户、企业微信入站身份、系统任务身份三类 actor 输入。
- 统一生成 `actorId`、`actorType`、`actorDisplayName`、`actorExternalId`、`actorBindingStatus`。
- 统一生成 `channel`、`channelAgentId`、`channelAgentType`。
- 给常见事件补齐 `actionSummary`、`targetType`、`targetId`、`targetSummary`。
- 对旧调用保持渐进兼容，允许只传现有字段，但新修复链路必须使用 builder。

优先改造顺序：

1. 企业微信消息适配和机器人审计。
2. 分析查询成功、阻断、解释、澄清审计。
3. 日报、通知、跟进写回和企业微信创建类审计。
4. 治理、合同审核和导出审计。

### 2. 企业微信入站身份解析

修改 `WecomMessageAdapterService.normalizeIncomingMessage` 的 sender 解析优先级：

1. `from.userid`
2. `sender.id`
3. `userid`
4. 顶层 `senderId`

同时读取 `aibotid`、`botId`、网关 source 等代理信息。若顶层 `senderId` 与 botId 相同，或命中本地机器人配置，不能将其当作真实用户；必须继续尝试 `from.userid` 等真实发送人字段。群聊场景仍必须有可靠发送者，否则拒绝进入正式链路。

归一化结果建议增加：

```ts
senderId: string;
rawSenderId?: string;
botId?: string;
channelAgentId?: string;
```

其中 `senderId` 始终代表真实发送人，`rawSenderId` 记录原始顶层字段，`botId/channelAgentId` 记录机器人。

### 3. 企业微信审计归因

改造 `WecomBotService` 中直接写审计的前置失败链路：

- `MAINTENANCE_DEGRADED`
- `WECOM_MESSAGE_REJECTED`
- `WECOM_AUTH_FAILED`
- `MAINTENANCE_RECOVERED`

规则：

- 如果已经解析出 CRM 用户，则使用 CRM 用户作为 actor。
- 如果只有企业微信 senderId，则使用 `wecom:<senderId>` 作为 actor，并显示未绑定 CRM 用户。
- 如果连 senderId 都没有，则使用 `system:wecom-bot-ingress` 或等价系统入口标识，并将风险等级置为高。
- 机器人 ID 只写入 `channelAgentId`。

### 4. 查询审计和统计

分析查询、模板查询、历史重跑和查询阻断必须写入真实 `channel`，用于后续统计：

- Web 工作台：`web-console`
- 企业微信机器人：`wecom-bot`
- 系统任务：按真实任务通道或 `system`

`wecomQueryRatioPercent` 改为：

```text
企业微信查询事件数 / 全部查询事件数 * 100
```

查询事件范围至少包括 `QUERY_SUCCEEDED`、`QUERY_BLOCKED`、`TEMPLATE_EXECUTED`、`HISTORY_RERUN` 中有实际问数语义的事件。

### 5. 审计列表接口

`AuditController.mapAuditEventItem` 返回新增展示字段，并兼容历史数据：

- 优先使用事件自身 `actorDisplayName`。
- 其次按 CRM 用户 ID 查姓名。
- 再按企业微信 senderId 查 CRM 映射。
- 对 `wecom:<senderId>` 显示未绑定企业微信用户。
- 对 `system:*` 和已知系统任务返回中文标签。

非管理员仍只能查看自己的记录；对于 `wecom:<senderId>` 这类未绑定用户记录，仅管理员可见。

## Frontend Design

### 1. 事件类型标签

`business-code-labels.ts` 必须覆盖后端所有当前 `AuditEventType`：

- AI 语义知识
- 权限治理
- 查询与导出
- 登录与企业微信认证
- 企业微信消息、维护和目录同步
- 日报
- 主动通知
- 跟进写回与分享
- 企业微信 CRM 创建
- AI 模型治理
- 合同审核
- SQL reveal 行为

未来新增事件仍保留未知兜底，但当前已定义事件不得进入兜底。

### 2. 用户行为审计列表

用户行为审计主表列调整为：

- 时间
- 用户
- 绑定状态
- 入口
- 事件类型
- 业务对象
- 操作摘要
- 结果
- 风险等级

AI 专属字段不再作为用户行为审计主表列。它们继续在 AI 审计分区或详情抽屉展示：

- 入口场景
- 入口目标工作流
- 最终程序工作流
- AI 兜底
- AI 兜底原因
- 执行轨迹摘要

### 3. 筛选体验

事件类型筛选使用可搜索下拉：

- 下拉展示中文事件名。
- 选中值仍为事件码。
- 支持输入事件码或中文关键字搜索。

用户筛选继续支持用户 ID、用户名和企业微信 senderId。后端负责匹配 `actorId`、`actorDisplayName`、CRM 用户名和企业微信映射。

## Migration

提供维护脚本或命令，例如：

```text
pnpm --dir backend tsx scripts/repair-audit-actor-attribution.ts --dry-run
pnpm --dir backend tsx scripts/repair-audit-actor-attribution.ts --apply
```

修复策略：

1. 扫描历史审计事件中疑似机器人、应用或 `unknown_wecom_sender` 的 actor。
2. 从 `sessionSnapshot.senderId`、`sessionSnapshot.rawSenderId`、`sessionSnapshot.externalConversationId` 或历史 payload 摘要中提取真实 senderId。
3. 用 `CrmReadonlyService.getUserByWecomSenderId` 尝试映射 CRM 用户。
4. 映射成功则回填 CRM 用户 actor。
5. 映射失败则写成 `wecom:<senderId>` 并标记未绑定。
6. 原 actor 写入 `channelAgentId` 或 migration 备注，不覆盖历史排障信息。

脚本默认 dry-run，输出修复数量、可映射数量、未绑定数量和无法判断数量；只有显式 `--apply` 才写入。

## Risks

- 历史审计记录结构不完整，无法 100% 恢复真实用户；需要保留“无法判断”的安全分类。
- 企业微信不同回调形态字段可能不同；修复时必须用测试覆盖 SDK body、webhook body、群聊和单聊。
- 审计模型新增字段会影响前后端类型；必须保持可选字段兼容旧数据。
- 若只改前端字典，会掩盖归因错误；本变更必须同时修后端归因和前端展示。
- 归因修复会触碰企业微信、分析、日报、通知、跟进、治理和前端审计页面等多条链路；实现必须小步修改并同步跑相关回归，避免“审计修好了但业务功能被带坏”。

## Verification

后端验证：

```bash
pnpm --dir backend test -- wecom-query.integration-spec.ts
pnpm --dir backend test -- governance-audit.contract-spec.ts
pnpm --dir backend test -- audit-persistence.spec.ts
pnpm --dir backend build
```

前端验证：

```bash
pnpm --dir frontend test:unit -- business-code-labels.spec.ts
pnpm --dir frontend test:unit -- audit-event-page.spec.ts
pnpm --dir frontend build
```

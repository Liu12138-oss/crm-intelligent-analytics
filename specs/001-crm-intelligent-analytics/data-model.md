# 数据模型：CRM智能分析系统（一期：企业微信 AI 问数与智能分析工作台）

## 1. 设计范围

本数据模型覆盖三类对象：

- 分析系统自有对象：查询会话、分析请求、分析结果、语义资产、语义资产发布快照、执行轨迹摘要、常用查询模板、最近查询记录、待写回跟进记录、访问策略、导出请求、审计事件、工作台能力快照、审计摘要、合同审核任务、合同审核问题、合同审核产物、合同审核审核依据快照、主动通知任务、主动通知接收人快照和主动通知发送尝试。
- CRM 业务对象：组织、部门、用户、角色、客户、商机、合同。
- 外部接入对象：企业微信消息上下文、Web 工作台会话上下文、连接状态快照和企业微信身份映射对象。

## 2. 核心实体

### 2.1 查询会话（QuerySession）

| 字段 | 说明 | 必填 | 规则 |
| --- | --- | --- | --- |
| id | 会话唯一标识 | 是 | 全局唯一 |
| channel | 会话渠道 | 是 | `wecom-bot` 或 `web-console` |
| externalConversationId | 外部会话标识 | 否 | 企业微信场景必填 |
| webSessionKey | Web 页面会话标识 | 否 | Web 场景必填 |
| requesterId | 当前会话对应的 CRM 用户 ID | 是 | 必须存在于 CRM 用户范围 |
| requesterRoleIds | 当前会话用户角色集合 | 是 | 至少 1 个角色 |
| contextStatus | 会话上下文状态 | 是 | `ACTIVE`、`IDLE`、`EXPIRED`、`CLOSED` |
| lastMessageAt | 最近一条消息时间 | 是 | 系统生成 |
| lastHeartbeatAt | 最近一次保活时间 | 否 | 长连接或活跃页面场景写入 |
| activeRequestId | 当前进行中的分析请求 ID | 否 | 同一时刻最多 1 个主请求 |
| pendingSequence | 最近已发送的流式序号 | 否 | 非负整数 |
| disconnectReason | 最近一次断开原因 | 否 | 异常断开时必填 |
| createdAt | 创建时间 | 是 | 系统生成 |
| updatedAt | 更新时间 | 是 | 系统生成 |

**状态流转**：

`ACTIVE -> IDLE -> EXPIRED`

异常分支：

- `ACTIVE -> CLOSED`
- `IDLE -> CLOSED`

### 2.2 分析请求（AnalysisRequest）

| 字段 | 说明 | 必填 | 规则 |
| --- | --- | --- | --- |
| id | 请求唯一标识 | 是 | 全局唯一 |
| questionText | 用户原始问题 | 否 | 自由提问时必填，1 到 500 个字符 |
| requesterId | 提问用户 ID | 是 | 必须存在于 CRM 用户范围 |
| requesterRoleIds | 提问用户角色集合 | 是 | 至少 1 个角色 |
| sessionId | 所属查询会话 ID | 是 | 必须存在于 QuerySession |
| entryChannel | 请求入口渠道 | 是 | `wecom-bot` 或 `web-console` |
| querySource | 请求来源类型 | 是 | `FREE_TEXT`、`COMMON_TEMPLATE`、`RECENT_RERUN` |
| templateId | 来源常用查询模板 ID | 否 | 模板执行时必填 |
| rerunFromHistoryId | 来源最近查询记录 ID | 否 | 历史重跑时必填 |
| organizationScope | 生效组织范围 | 是 | 来源于现有 CRM 权限 |
| departmentScope | 生效部门范围 | 否 | 来源于现有 CRM 权限 |
| ownerScope | 生效负责人范围 | 否 | 来源于现有 CRM 权限 |
| intentDomain | 识别出的分析主题 | 是 | 一期允许 `opportunity-analysis`、`contract-conversion`、`customer-relationship` |
| metrics | 指标集合 | 是 | 仅允许白名单指标 |
| dimensions | 维度集合 | 否 | 仅允许白名单维度 |
| filters | 过滤条件集合 | 否 | 仅允许白名单字段 |
| followUpToRequestId | 关联的上一轮补问请求 ID | 否 | 仅在补问后继续提问时填写 |
| missingConditions | 缺失限定条件集合 | 否 | 仅允许时间范围、统计口径、比较对象等白名单类型 |
| clarificationPrompt | 补问提示文本 | 否 | `CLARIFICATION_REQUIRED` 状态时必填 |
| generatedQuery | 实际执行的受控查询/执行快照 | 否 | 仅允许单条受控查询、受控接口调用摘要或受控执行计划 |
| resultConsistencyToken | 结果一致性校验标识 | 否 | 成功执行后生成 |
| status | 请求状态 | 是 | 见状态流转 |
| errorMessage | 失败或拦截原因 | 否 | 用户可读 |
| createdAt | 创建时间 | 是 | 系统生成 |
| completedAt | 完成时间 | 否 | 执行结束后写入 |

**状态流转**：

`RECEIVED -> PARSED -> VALIDATED -> EXECUTED -> RENDERED -> RETURNED`

异常分支：

- `PARSED -> CLARIFICATION_REQUIRED -> PARSED`
- `PARSED -> BLOCKED`
- `VALIDATED -> BLOCKED`
- `EXECUTED -> TIMEOUT`
- `RENDERED -> FAILED`
- `EXECUTED -> FAILED`

### 2.3 分析结果（AnalysisResult）

| 字段 | 说明 | 必填 | 规则 |
| --- | --- | --- | --- |
| requestId | 对应分析请求 ID | 是 | 与 AnalysisRequest 一一对应 |
| title | 业务化标题 | 是 | 不能为空 |
| summary | 结果摘要 | 否 | 面向业务用户的说明 |
| scopeSummary | 本次数据范围说明 | 是 | 必须可读 |
| appliedFilters | 已应用筛选条件集合 | 是 | 必须与实际执行条件一致 |
| metricCards | 汇总指标集合 | 否 | 指标名称和值的键值结构 |
| primaryView | 主视图 | 否 | 图表或表格，必须能回答用户核心问题 |
| secondaryViews | 辅助视图集合 | 否 | 可包含趋势图、占比图、排行表等 |
| tableRows | 表格结果集 | 否 | 默认分页返回 |
| rowCount | 结果总条数 | 是 | 非负整数 |
| dataFreshnessAt | 数据更新时间 | 是 | 用于说明结果时效性 |
| consistencyToken | 一致性校验标识 | 是 | 摘要、图表、表格和导出必须共用 |
| sourceNotes | 区块与指标来源说明集合 | 否 | 用于结果页与共享区块浮层展示 |
| footnotes | 边界、缺失区块和降级脚注 | 否 | 中文输出 |
| executionTraceSummary | 对外执行轨迹摘要 | 否 | 只允许引用同一结果包与同一数据集边界 |
| explanation | 口径解释或不可用说明 | 否 | 中文输出 |
| analysisConfidence | 结果可信度等级 | 否 | `HIGH`、`MEDIUM`、`LOW` |
| trendInsight | 趋势洞察 | 否 | 包含方向、变化幅度、峰谷与驱动因素 |
| forecastInsight | 短期预测洞察 | 否 | 仅在满足预测条件时返回，必须同时包含区间和置信提示 |
| anomalyInsights | 异常洞察集合 | 否 | 用于提示波动异常、样本不足或数据缺口 |
| riskInsights | 风险洞察集合 | 否 | 必须区分经营风险与结果风险 |
| recommendations | 经营建议集合 | 否 | 按优先级排序的动作建议 |
| evidenceSummary | 结果依据摘要 | 否 | 用于说明趋势、预测和建议的事实来源 |
| workbenchMarkdown | 查询页阅读稿 | 否 | 面向 Web 查询页的完整阅读稿摘要版 |
| detailMarkdown | 完整阅读稿 | 否 | 面向 Web 查询页与兼容详情页的完整版 Markdown |
| emptyReason | 空结果原因 | 否 | 仅在无数据时出现 |
| streamBlocks | 流式结果块集合 | 否 | 按发送顺序保存 |
| availableActions | 当前允许动作 | 否 | 可包含追问、导出、再次运行 |
| returnedAt | 返回时间 | 是 | 系统生成 |

补充说明：

- 自由问数与查询模板都必须生成同一套 richer report 字段，不允许模板链路继续单独手拼占位式 Markdown。
- Web 查询页默认直接展示完整 richer report；结果详情页仅作为兼容入口保留，不再承担完整版阅读唯一职责。
- 企业微信机器人继续消费压缩版 `wecomMarkdown`，但其摘要、趋势和建议必须与 richer report 中的统一事实保持一致。

### 2.3A 语义资产（AnalysisSemanticKnowledgeAsset）

| 字段 | 说明 | 必填 | 规则 |
| --- | --- | --- | --- |
| id | 语义资产唯一标识 | 是 | 全局唯一 |
| type | 资产类型 | 是 | `ALIAS`、`TEMPORAL_FIELD_HINT`、`ORGANIZATION_NORMALIZATION`、`VALIDATED_EXAMPLE`、`NEGATIVE_EXAMPLE` |
| name | 资产名称 | 是 | 中文业务名称 |
| status | 资产状态 | 是 | `ACTIVE` 或 `INACTIVE` |
| matchKeywords | 匹配关键词集合 | 是 | 至少 1 个 |
| canonicalLabel | 规范标签 | 否 | 别名资产必填 |
| synonyms | 同义表达集合 | 否 | 别名资产至少 1 个 |
| questionText | 示例问法 | 否 | 已验证问法和高风险问法推荐填写 |
| sqlHint | 执行提示 | 否 | 已验证问法推荐填写 |
| hint | 提示文案 | 否 | 提示型资产推荐填写 |
| blockReason | 阻断原因 | 否 | 高风险问法样例必填 |
| updatedBy | 最后更新人 | 是 | 管理员用户 ID |
| updatedAt | 更新时间 | 是 | 系统生成 |

### 2.3B 语义资产发布快照（AnalysisSemanticKnowledgePublication）

| 字段 | 说明 | 必填 | 规则 |
| --- | --- | --- | --- |
| version | 发布版本号 | 是 | 全局唯一 |
| changeSummary | 发布说明 | 否 | 中文说明 |
| assetCount | 本次发布资产数 | 是 | 非负整数 |
| publishedBy | 发布人 | 是 | 管理员用户 ID |
| publishedAt | 发布时间 | 是 | 系统生成 |
| snapshot | 已发布语义资产快照集合 | 是 | 只允许引用已校验通过的资产内容 |

### 2.3C 执行轨迹摘要（AnalysisExecutionTraceSummary）

| 字段 | 说明 | 必填 | 规则 |
| --- | --- | --- | --- |
| normalizedQuestion | 标准化问题 | 是 | 必须可读 |
| consistencyToken | 对应结果一致性标识 | 否 | 与 AnalysisResult 共用 |
| fallbackReason | 当前 fallback 原因 | 否 | 命中 fallback 时返回 |
| blockedReason | 当前阻断原因 | 否 | 阻断时返回 |
| knowledgeHits | 命中的语义资产摘要 | 是 | 可为空数组，但必须显式返回 |
| taskSummaries | 任务级执行摘要集合 | 是 | 至少包含任务 ID、标题、结果类型和执行来源 |
| datasetReferences | 结果数据集引用摘要 | 是 | 与结果包中的数据集引用保持一致 |
| createdAt | 摘要生成时间 | 是 | 系统生成 |

### 2.4 常用查询模板（CommonQueryTemplate）

| 字段 | 说明 | 必填 | 规则 |
| --- | --- | --- | --- |
| id | 模板唯一标识 | 是 | 全局唯一 |
| name | 模板名称 | 是 | 不能为空 |
| description | 模板用途说明 | 是 | 面向业务用户 |
| tags | 标签 | 否 | 可为空数组，支持选择已有标签或自由输入新标签，统一承担模板分类能力 |
| defaultQuestionText | 默认问题表达 | 是 | 用于生成标准问法 |
| defaultFilters | 默认筛选条件 | 是 | 允许为空对象，但必须符合白名单 |
| defaultViewType | 默认主视图类型 | 否 | `LINE_CHART`、`BAR_CHART`、`RANKING_TABLE` 等 |
| queryMode | 查询模式 | 是 | 当前固定为 `FIXED_SQL` |
| sqlText | 只读 SQL 模板原文 | 是 | 仅允许查询语句 |
| sqlVersion | SQL 模板版本号 | 是 | 模板发布后递增 |
| sourceType | 模板来源类型 | 是 | `GOVERNANCE_CREATED`、`FREE_QUERY_SAVED`、`COPIED_FROM_TEMPLATE`、`LEGACY_MIGRATED` |
| sourceQueryId | 来源自由问数 ID | 否 | 自由问数保存时记录 |
| sourceTemplateId | 来源模板 ID | 否 | 复制到我的模板时记录 |
| sourceSnapshot | 来源快照 | 否 | 记录来源模板名称、SQL 版本、来源问题和复制 / 保存时间 |
| scopeMode | 模板范围模式 | 否 | `AUTO_SCOPE`、`DECLARED_SCOPE` |
| parameterSchema | 参数定义集合 | 是 | 用于参数装配与校验 |
| renderConfig | 数据区展示配置 | 是 | 固定主展示类型、指标卡与列映射 |
| visibleRoleIds | 可见角色集合 | 是 | 至少 1 个角色 |
| ownerUserId | 模板归属用户 | 是 | “我的模板”按该字段判断 |
| visibilityType | 可见性 | 是 | `PRIVATE` 或 `SHARED`，普通保存默认 `SHARED` |
| displayOrder | 展示顺序 | 是 | 非负整数 |
| clickCount7d | 最近 7 天点击次数 | 是 | 非负整数 |
| usageCountTotal | 历史累计执行次数 | 是 | 用于默认排序，“添加到我的模板”不计入 |
| lastUsedAt | 最近执行时间 | 否 | 模板执行成功后更新 |
| hitRatePercent | 最近 7 天命中率 | 是 | 0 到 100 |
| optimizationStatus | 模板优化状态 | 是 | `HEALTHY`、`NEEDS_OPTIMIZATION`、`DISABLED` |
| status | 模板状态 | 是 | `ACTIVE`、`INACTIVE` |
| ownedBy | 维护人 | 是 | 管理员用户 ID |
| validationSnapshot | 最近一次 SQL 校验结果 | 否 | 失败时记录原因 |
| lastValidatedAt | 最近一次校验时间 | 否 | 系统生成 |
| updatedAt | 更新时间 | 是 | 系统生成 |

补充说明：

- `AUTO_SCOPE`：模板原始 SQL 未显式写组织 / 部门 / 负责人范围，执行时由系统按当前用户权限自动收口。
- `DECLARED_SCOPE`：模板原始 SQL 已显式写组织 / 部门 / 负责人范围，执行时不再重复注入，而是校验模板声明范围是否被当前用户权限覆盖。
- 个人副本：用户点击“添加到我的模板”时创建新的模板记录，`ownerUserId` 为当前用户，`sourceSnapshot` 保留来源信息，后续来源模板变更不自动影响个人副本。
- 自由问数保存：后端必须从服务端 `queryId` 读取成功执行快照，优先复用实际执行的受控 SQL；无法安全复现时拒绝保存并记录审计。

### 2.5 最近查询记录（RecentQueryRecord）

| 字段 | 说明 | 必填 | 规则 |
| --- | --- | --- | --- |
| id | 历史记录唯一标识 | 是 | 全局唯一 |
| requesterId | 所属用户 ID | 是 | 只能由本人查看 |
| sourceRequestId | 来源分析请求 ID | 是 | 必须存在于 AnalysisRequest |
| sourceType | 来源类型 | 是 | `AI_QUERY`、`TEMPLATE_QUERY`、`RERUN_HISTORY` |
| templateId | 来源模板 ID | 否 | 模板查询时必填 |
| templateVersion | 执行时模板版本 | 否 | 模板查询时建议保存 |
| questionText | 最近一次执行的问题表达 | 是 | 用于列表展示 |
| lastUsedChannel | 最近一次执行渠道 | 是 | `wecom-bot` 或 `web-console` |
| lastUsedConditions | 最近一次执行条件 | 是 | 只保存允许回显的条件 |
| parameterSnapshot | 参数快照 | 否 | 模板执行时保存 |
| renderSnapshot | 展示快照 | 否 | 保存主展示类型与标题 |
| resultSummary | 最近一次结果摘要 | 否 | 用于列表预览 |
| status | 最近一次执行状态 | 是 | `SUCCEEDED`、`BLOCKED`、`FAILED` |
| lastUsedAt | 最近一次执行时间 | 是 | 系统生成 |

### 2.6 访问策略（AccessPolicy）

| 字段 | 说明 | 必填 | 规则 |
| --- | --- | --- | --- |
| id | 策略 ID | 是 | 全局唯一 |
| enabledRoleIds | 允许使用分析功能的角色 | 是 | 至少 1 个角色 |
| exportRoleIds | 允许导出的角色 | 是 | 可为空集合 |
| enabledChannels | 允许使用的入口渠道 | 是 | 至少包含一个渠道 |
| allowedDomains | 允许分析的主题 | 是 | 一期至少包含商机分析 |
| allowedTables | 允许访问的数据表 | 是 | 白名单集合 |
| allowedFields | 允许访问的字段 | 是 | 按表配置 |
| maskedFields | 需要屏蔽的敏感字段 | 否 | 默认优先级高于 allowedFields |
| exportRowLimit | 单次导出上限 | 是 | 一期固定为 1000 |
| exportDailyLimit | 每用户每日导出次数上限 | 是 | 一期固定为 3 |
| maxOnlineSessions | 在线会话上限 | 是 | 一期建议值为 200 |
| maxConcurrentQueries | 并发查询上限 | 是 | 一期建议值为 50 |
| heartbeatIntervalSeconds | 心跳检测周期 | 是 | 大于 0 |
| idleTimeoutSeconds | 会话失活超时 | 是 | 大于心跳周期 |
| historyRetentionDays | 最近查询保留天数 | 是 | 大于 0 |
| status | 策略状态 | 是 | `ACTIVE`、`INACTIVE`、`SUPERSEDED` |
| updatedBy | 最后更新人 | 是 | 管理员用户 ID |
| updatedAt | 最后更新时间 | 是 | 系统生成 |

**状态流转**：

`INACTIVE -> ACTIVE -> SUPERSEDED`

### 2.6A 应用超级管理员授权策略（ApplicationSuperAdminPolicy）

| 字段 | 说明 | 必填 | 规则 |
| --- | --- | --- | --- |
| policyId | 策略主键 | 是 | 固定为当前生效策略 |
| subjects | 授权主体列表 | 是 | 支持 CRM 用户和 CRM 角色 |
| subjectType | 授权主体类型 | 是 | `USER` 或 `ROLE` |
| subjectId | 授权主体 ID | 是 | 对应 CRM 用户 ID 或 CRM 角色 ID |
| status | 授权状态 | 是 | `ACTIVE` 或 `INACTIVE` |
| updatedBy | 最后更新人 | 是 | 管理员用户 ID |
| updatedAt | 最后更新时间 | 是 | 系统生成 |
| changeReason | 调整原因 | 是 | 200 字以内中文说明 |

补充说明：

- 命中有效用户主体或角色主体的用户，视为本系统应用超级管理员，获得权限目录中的全部菜单、全部动作和全量数据范围。
- 应用超级管理员授权只覆盖系统内业务能力和数据范围，不得绕过登录认证、企业微信签名与来源校验、文件安全限制、SQL 白名单、字段白名单、危险动作确认和审计留痕。
- 历史 `AnalysisScopePolicy.fullAccessUserIds` 仅作为兼容迁移来源保留；读取时迁移为用户级应用超级管理员主体，保存新策略后不得继续写入旧全量名单。
- 查询模板、自由 AI 问数、最近查询重跑、导出补查、经营报表和合同审批必须消费统一范围快照；命中应用超级管理员时，范围快照必须明确标记为全量范围。

### 2.7 导出请求（ExportRequest）

| 字段 | 说明 | 必填 | 规则 |
| --- | --- | --- | --- |
| id | 导出请求 ID | 是 | 全局唯一 |
| analysisRequestId | 来源分析请求 ID | 是 | 必须已执行成功 |
| requesterId | 导出人 ID | 是 | 必须具备导出权限 |
| rowCount | 导出条数 | 是 | 不得超过策略上限 |
| consistencyToken | 导出一致性标识 | 是 | 必须与 AnalysisResult 一致 |
| status | 导出状态 | 是 | `REQUESTED`、`COMPLETED`、`BLOCKED` |
| blockedReason | 被阻止原因 | 否 | 超限或越权时必填 |
| exportedAt | 导出完成时间 | 否 | 仅成功时写入 |
| createdAt | 创建时间 | 是 | 系统生成 |

**状态流转**：

`REQUESTED -> COMPLETED`

异常分支：

- `REQUESTED -> BLOCKED`

### 2.8 审计事件（AuditEvent）

| 字段 | 说明 | 必填 | 规则 |
| --- | --- | --- | --- |
| id | 审计事件 ID | 是 | 全局唯一 |
| eventType | 事件类型 | 是 | `QUERY_*`、`EXPORT_*`、`AUTH_LOGIN_*`、`WECOM_AUTH_*`、`WECOM_MESSAGE_*`、`WECOM_SESSION_STATE_CHANGED`、`WECOM_DELIVERY_SUCCEEDED`、`AI_*`、`DAILY_REPORT_*`、`PROACTIVE_NOTIFICATION_*`、`WECOM_DIRECTORY_SYNC_*`、`WECOM_IDENTITY_RESOLVED`、`FOLLOW_UP_*`、`WECOM_CRM_CREATE_*`、`SECURITY_INTERCEPTED`、`CONNECTION_INTERRUPTED`、`STREAM_DELIVERY_FAILED`、`CONTRACT_REVIEW_*` |
| actorId | 行为人 ID | 是 | 来源于 CRM 用户 |
| actorRoleIds | 行为人角色集合 | 是 | 快照保存 |
| relatedRequestId | 关联分析请求 ID | 否 | 查询或导出相关时必填 |
| relatedTemplateId | 关联模板 ID | 否 | 模板执行时保存 |
| relatedHistoryId | 关联最近查询记录 ID | 否 | 历史重跑时保存 |
| originalQuestion | 原始问题快照 | 否 | 查询相关时保存 |
| querySnapshot | 实际执行查询快照 | 否 | 执行前后固定保存 |
| scopeSnapshot | 当时生效的数据范围快照 | 是 | 用于追溯 |
| sessionSnapshot | 当时会话状态快照 | 否 | 连接异常和流式失败时必填 |
| resultCount | 返回或导出条数 | 否 | 非负整数 |
| riskLevel | 风险等级 | 是 | `LOW`、`MEDIUM`、`HIGH` |
| reviewStatus | 复核状态 | 是 | `PENDING`、`CONFIRMED`、`IGNORED` |
| reviewedBy | 复核人 | 否 | 高风险事件复核时填写 |
| reviewedAt | 复核时间 | 否 | 高风险事件复核时填写 |
| outcome | 执行结果摘要 | 是 | 中文说明 |
| failureReason | 失败或拦截原因 | 否 | 失败时必填 |
| contractReviewReviewBasis | 合同审核审核依据快照 | 否 | 合同审核相关审计事件必填 |
| createdAt | 事件时间 | 是 | 系统生成 |

**约束**：

- 审计事件不可修改、不可删除。
- 所有成功查询、被拦截查询、补问、模板执行、历史重跑、成功导出、被拦截导出，以及合同审核、跟进写回/共享、CRM 受控创建、主动通知、日报编排、目录同步、安全拦截、连接异常和流式失败等关键动作都必须记录。

### 2.9 待写回跟进记录（PendingFollowUpWriteback）

| 字段 | 说明 | 必填 | 规则 |
| --- | --- | --- | --- |
| id | 待写回记录 ID | 是 | 全局唯一 |
| sessionId | 来源企业微信会话 ID | 是 | 必须存在于 QuerySession |
| requesterId | 发起人 CRM 用户 ID | 是 | 必须存在于 CRM 用户范围 |
| requesterName | 发起人姓名快照 | 是 | 便于审计追溯 |
| sourceReceiptId | 来源消息受理 ID | 是 | 必须存在于企业微信消息受理记录 |
| sourceMessageId | 来源企业微信消息 ID | 是 | 用于消息重放排查 |
| sourceQueryText | 触发草稿的原始查询文本 | 是 | 可以来自唯一 Opportunity 查询文本或主题型跟进入口原文 |
| objectType | 目标对象类型 | 是 | `Customer` 或 `Opportunity` |
| objectId | 目标对象 ID | 是 | 与 `objectType` 一起唯一定位写回目标 |
| objectTitle | 目标对象标题 | 是 | 客户跟进为客户名称，商机跟进为商机标题 |
| opportunityId | 兼容旧链路保留的目标 ID | 是 | 首版沿用，值与 `objectId` 保持一致 |
| opportunityTitle | 兼容旧链路保留的目标标题 | 是 | 首版沿用，值与 `objectTitle` 保持一致 |
| customerName | 关联客户名称 | 否 | 客户跟进时通常等于 `objectTitle`，商机跟进时用于提示与审计 |
| ownerId | 当前负责人 ID | 是 | 来源于最终命中的 `Customer` 或 `Opportunity` |
| ownerName | 当前负责人名称 | 是 | 来源于最终命中的 `Customer` 或 `Opportunity` |
| draftContent | 待确认跟进内容草稿 | 是 | 不能为空 |
| status | 当前状态 | 是 | `DRAFTED`、`AWAITING_CONTENT_CONFIRMATION`、`WRITING`、`COMPLETED`、`CANCELLED`、`FAILED` |
| idempotencyKey | 幂等键 | 是 | 同一待写回记录最多成功写入一次 |
| confirmedWriteIntentAt | 确认现在写入时间 | 否 | 首次确认时写入 |
| confirmedContentAt | 确认内容正确时间 | 否 | 内容确认时写入 |
| writtenAt | 正式写回时间 | 否 | 成功写入 CRM 后写入 |
| externalRevisitLogId | CRM 跟进记录 ID | 否 | 成功写入后返回 |
| failureReason | 最近一次失败原因 | 否 | 写回失败时必填 |
| createdAt | 创建时间 | 是 | 系统生成 |
| updatedAt | 更新时间 | 是 | 系统生成 |

**状态流转**：

`DRAFTED -> AWAITING_CONTENT_CONFIRMATION -> WRITING -> COMPLETED`

异常分支：

- `DRAFTED -> CANCELLED`
- `AWAITING_CONTENT_CONFIRMATION -> CANCELLED`
- `WRITING -> FAILED -> AWAITING_CONTENT_CONFIRMATION`

### 2.10 工作台能力快照（AnalysisCapabilitySnapshot）

| 字段 | 说明 | 必填 | 规则 |
| --- | --- | --- | --- |
| requesterId | 当前用户 ID | 是 | 必须存在于 CRM 用户范围 |
| roleNames | 当前角色名称集合 | 是 | 至少 1 个角色 |
| scopeSummary | 当前权限摘要 | 是 | 用于页面展示 |
| channels | 当前可用入口 | 是 | 至少 1 个渠道 |
| domains | 当前允许主题 | 是 | 来源于生效策略 |
| metrics | 当前允许指标 | 是 | 来源于白名单 |
| dimensions | 当前允许维度 | 是 | 来源于白名单 |
| exportAllowed | 当前是否允许导出 | 是 | 布尔值 |
| exportRowLimit | 单次导出上限 | 是 | 读取自当前策略 |
| exportDailyLimit | 每日导出上限 | 是 | 读取自当前策略 |
| remainingDailyExports | 当前用户当日剩余导出次数 | 是 | 非负整数 |
| templateCount | 当前可见模板数量 | 是 | 非负整数 |
| dataFreshnessAt | 当前数据新鲜度时间 | 是 | 用于“数据已同步”展示 |
| serviceStatus | 分析服务状态 | 是 | `ONLINE`、`DEGRADED`、`OFFLINE` |

### 2.11 审计摘要（AuditSummarySnapshot）

| 字段 | 说明 | 必填 | 规则 |
| --- | --- | --- | --- |
| todayQueryCount | 当日查询事件数 | 是 | 非负整数 |
| wecomQueryRatioPercent | 企业微信查询占比 | 是 | 0 到 100 |
| todayBlockedCount | 当日被拦截事件数 | 是 | 非负整数 |
| todaySensitiveInterceptCount | 当日敏感字段拦截数 | 是 | 非负整数 |
| todayExportCount | 当日导出事件数 | 是 | 非负整数 |
| todayExportBlockedCount | 当日导出超限拦截数 | 是 | 非负整数 |
| pendingHighRiskReviewCount | 待复核高风险事件数 | 是 | 非负整数 |

### 2.12 合同审核任务（ContractReviewTask）

| 字段 | 说明 | 必填 | 规则 |
| --- | --- | --- | --- |
| id | 合同审核任务 ID | 是 | 全局唯一 |
| requesterId | 任务发起人与任务归属用户 ID | 是 | 默认仅本人可见 |
| requesterName | 任务发起人名称快照 | 是 | 中文展示 |
| originalFileName | 原始合同文件名或来源合同展示名 | 是 | 上传任务保留 `.docx` 文件名；CRM 来源任务使用合同名称快照 |
| storedFilePath | 原始合同存储路径或来源快照定位串 | 是 | 上传任务为服务端文件路径；CRM 来源任务允许保存来源定位串 |
| mimeType | 文件类型 | 是 | 上传任务为 DOCX 对应 MIME；CRM 来源任务允许使用受控来源类型标识 |
| fileSize | 文件大小或来源正文长度 | 是 | 必须大于 0；CRM 来源任务记录审核正文快照字节数 |
| status | 任务状态 | 是 | `UPLOADED`、`PARSING`、`REVIEWING`、`GENERATING_REPORT`、`COMPLETED`、`FAILED`、`BLOCKED` |
| latestStageMessage | 当前阶段说明 | 是 | 面向用户可读 |
| ruleSetCode | 当前审核标准编码 | 是 | 来源于激活的 `skill pack` |
| ruleSetVersion | 当前审核标准版本 | 是 | 来源于激活的 `skill pack` |
| overallDecision | 总体结论 | 是 | `APPROVE`、`REVISE`、`REJECT` |
| summary | 合同摘要 | 是 | 上传任务由文本提取与事实抽取生成；CRM 来源任务由合同快照摘要生成 |
| latestResultSummary | 列表摘要 | 是 | 风险优先；`DETERMINISTIC_ONLY` 时需区分“规则快审”与“降级快审”摘要 |
| vetoCount | 一票否决数量 | 是 | 非负整数 |
| highRiskCount | 非一票否决高风险数量 | 是 | 非负整数 |
| mediumRiskCount | 中风险数量 | 是 | 非负整数 |
| lowRiskCount | 低风险数量 | 是 | 非负整数 |
| totalIssueCount | 总问题数 | 是 | 非负整数 |
| reviewBasis | 审核依据快照 | 否 | 新任务和兼容回填任务都必须可解析 |
| supplementalReviewStatus | AI 补充审核状态 | 否 | `PENDING`、`RUNNING`、`COMPLETED`、`FAILED` |
| supplementalReviewMessage | AI 补充审核说明 | 否 | 面向用户可读 |
| supplementalCompletedAt | AI 补充审核完成时间 | 否 | 仅补充审核完成时写入 |
| createdAt | 创建时间 | 是 | 系统生成 |
| updatedAt | 更新时间 | 是 | 系统生成 |

**权限约束**：

- 草稿创建前必须同时通过 `wecom.followup.writeback` 动作权限与目标对象负责人关系校验。
- 对象级关系仅允许：负责人本人、协作人本人、负责人递归上级领导、协作人递归上级领导、管理员。
- 最终写回前必须重新读取目标对象当前负责人、当前协作人集合，并按最新企业微信组织事实重算对象关系；若关系失效，必须阻断写回并保留草稿。
| completedAt | 完成时间 | 否 | 仅完成时写入 |

**状态流转**：

`UPLOADED -> PARSING -> REVIEWING -> GENERATING_REPORT -> COMPLETED`

异常分支：

- `PARSING -> BLOCKED`
- `REVIEWING -> BLOCKED`
- `GENERATING_REPORT -> FAILED`
- `REVIEWING -> FAILED`

#### 2.12A 合同审核来源扩展建模

| 字段 | 说明 | 必填 | 规则 |
| --- | --- | --- | --- |
| sourceType | 任务来源类型 | 否 | `UPLOAD` 或 `CRM_PENDING_APPROVAL`；历史任务允许为空 |
| sourceContractId | 源合同 ID | 否 | `sourceType=CRM_PENDING_APPROVAL` 时必填 |
| sourceContractSnapshot.contractId | 源合同 ID | 否 | 必须与 `sourceContractId` 一致 |
| sourceContractSnapshot.contractName | 源合同名称 | 否 | 用于任务标题和详情展示 |
| sourceContractSnapshot.reviewContent | 审核正文快照 | 否 | 仅允许由合同白名单字段、特殊条款、审批备注和审批历史拼接生成 |
| sourceContractSnapshot.sourceSummary | 来源摘要 | 否 | 用于详情页和最近任务快速说明 |
| sourceContractSnapshot.specialTermBlocks | 特殊条款分块 | 否 | 供详情页查看与审核链路复用 |
| sourceContractSnapshot.approvalHistory | 审批历史 | 否 | 仅保留当前功能所需白名单字段 |

补充约束：

- 合同审核主流程改为 CRM 待 1 级审批合同驱动；本地 `.docx` 上传只作为兼容补录入口保留。
- 当 `sourceType=CRM_PENDING_APPROVAL` 时，`originalFileName` 使用合同名称快照，`storedFilePath` 允许保存为 `crm-pending-approval:{contractId}` 这类来源定位串，`mimeType` 与 `fileSize` 用于描述来源快照而不是物理文件。
- CRM 来源任务与上传任务共享同一条审核主链路，但 `ANNOTATED_DOCX` 允许因为缺少原始 `.docx` 文件而失败，并返回明确失败原因。

### 2.13 合同审核问题（ContractReviewIssue）

| 字段 | 说明 | 必填 | 规则 |
| --- | --- | --- | --- |
| id | 问题 ID | 是 | 全局唯一 |
| taskId | 所属合同审核任务 ID | 是 | 必须存在于 ContractReviewTask |
| title | 风险标题 | 是 | 面向业务用户 |
| riskLevel | 风险等级 | 是 | `LOW`、`MEDIUM`、`HIGH` |
| isVeto | 是否一票否决 | 是 | 布尔值 |
| description | 风险说明 | 是 | 中文输出 |
| suggestion | 修改建议 | 是 | 中文输出 |
| quote | 原文片段与定位摘要 | 是 | 只在授权上下文返回必要摘要 |
| ruleCode | 命中的检查项编码 | 是 | 来源于审核标准快照 |
| ruleTitle | 命中的检查项标题 | 是 | 来源于审核标准快照 |
| sourceClause | 适用条款或条款类别 | 是 | 中文输出 |
| reviewBasis | 审核依据快照 | 否 | 默认继承任务级审核依据 |
| createdAt | 创建时间 | 是 | 系统生成 |

### 2.14 合同审核产物（ContractReviewArtifact）

| 字段 | 说明 | 必填 | 规则 |
| --- | --- | --- | --- |
| id | 产物 ID | 是 | 全局唯一 |
| taskId | 所属合同审核任务 ID | 是 | 必须存在于 ContractReviewTask |
| artifactType | 产物类型 | 是 | `REPORT`、`ANNOTATED_DOCX`、`STRUCTURED_RESULT` |
| fileName | 产物文件名 | 是 | 面向用户展示 |
| filePath | 产物文件路径 | 否 | 仅在已生成成功时存在 |
| mimeType | 产物 MIME 类型 | 是 | 与文件类型一致 |
| status | 产物状态 | 是 | `PENDING`、`AVAILABLE`、`FAILED` |
| failureReason | 生成失败原因 | 否 | 失败时必填 |
| reviewBasis | 审核依据快照 | 否 | 默认与任务级审核依据一致 |
| createdAt | 创建时间 | 是 | 系统生成 |
| updatedAt | 更新时间 | 是 | 系统生成 |

### 2.15 合同审核审核依据快照（ContractReviewReviewBasis）

| 字段 | 说明 | 必填 | 规则 |
| --- | --- | --- | --- |
| packCode | 审核标准包编码 | 是 | 来源于激活或回填的 `skill pack` |
| packVersion | 审核标准包版本 | 是 | 用于页面展示与追溯 |
| packChecksum | 审核标准包完整校验值 | 是 | 用于审计核验 |
| packChecksumSummary | 审核标准包校验摘要 | 是 | 用于列表、日志与人工核对 |
| modelProfile | 审核使用的模型档位 | 是 | 来源于 `skill pack` 或历史兼容映射 |
| executionMode | 执行模式 | 是 | `AI_HYBRID`、`DETERMINISTIC_ONLY`、`BLOCKED` |
| degradationReason | 降级或阻断原因 | 否 | 降级快审或阻断时建议必填 |
| promptFingerprints | 三类提示词指纹 | 否 | 包含 `planner`、`reviewer`、`summarizer` |

**约束**：

- `AI_HYBRID` 表示已执行 AI + 确定性校验混合审核，允许视为正式审核结果。
- `DETERMINISTIC_ONLY` 表示当前结果基于规则快审或降级快审。若存在 `degradationReason`，表示 AI 不可用、超时或失败导致停留在降级快审；若不存在，则表示当前结果仅覆盖已配置的明确判定项，页面可继续展示规则快审说明与 AI 补充审核状态。
- `BLOCKED` 表示任务被阻断，尚未形成正式审核结果。

### 2.16 主动通知任务（ProactiveNotificationTask）

| 字段 | 说明 | 必填 | 规则 |
| --- | --- | --- | --- |
| id | 通知任务唯一标识 | 是 | 全局唯一 |
| sceneKey | 业务场景标识 | 是 | 用于区分日报、治理复核、异步结果等业务来源 |
| title | 通知标题 | 是 | 不能为空 |
| kind | 通知类型 | 是 | `FORMAL` 或 `CONVERSATION_CONTEXT` |
| preferredChannel | 业务侧期望通道 | 否 | `WECOM_APP_MESSAGE` 或 `WECOM_BOT_MESSAGE` |
| resolvedChannel | 最终路由通道 | 否 | 当前用户可见通知固定为 `WECOM_BOT_MESSAGE` |
| messageType | 消息类型 | 是 | 首版支持 `markdown`、`template_card` |
| markdownContent | Markdown 通知正文 | 否 | `messageType=markdown` 时必填 |
| templateCardPayload | 模板卡片负载 | 否 | `messageType=template_card` 时必填 |
| dedupeKey | 幂等键 | 否 | 同一业务任务同一时间窗内应唯一 |
| duplicateOfTaskId | 被复用的任务 ID | 否 | 命中幂等时填写 |
| status | 任务状态 | 是 | `PENDING`、`SENT`、`PARTIAL_FAILED`、`FAILED`、`BLOCKED`、`DEDUPED` |
| originalAudienceSummary | 原始接收人摘要 | 是 | 用于审计和排查 |
| testModeApplied | 是否命中测试收件人覆盖 | 是 | 布尔值 |
| realMessageEnabled | 真实消息发送开关状态 | 是 | 布尔值 |
| recipientSnapshots | 接收人快照集合 | 是 | 至少保存一次最终解析结果 |
| attempts | 发送尝试集合 | 是 | 至少保存一次投递尝试或阻断记录 |
| metadata | 业务扩展元数据 | 否 | 仅允许受控字段 |
| failureReason | 最终失败或阻断原因 | 否 | `FAILED`、`BLOCKED`、`PARTIAL_FAILED` 时建议填写 |
| createdAt | 创建时间 | 是 | 系统生成 |
| lastAttemptAt | 最近一次发送尝试时间 | 否 | 有投递行为时填写 |
| sentAt | 最终发送完成时间 | 否 | 有成功投递时填写 |

**状态流转**：

`PENDING -> SENT`

异常分支：

- `PENDING -> PARTIAL_FAILED`
- `PENDING -> FAILED`
- `PENDING -> BLOCKED`
- `PENDING -> DEDUPED`

### 2.17 主动通知接收人快照（ProactiveNotificationRecipientSnapshot）

| 字段 | 说明 | 必填 | 规则 |
| --- | --- | --- | --- |
| id | 接收人快照 ID | 是 | 全局唯一 |
| recipientType | 接收人类型 | 是 | `CRM_USER`、`WECOM_USER`、`WECOM_PARTY`、`WECOM_TAG`、`WECOM_CONVERSATION` |
| status | 解析状态 | 是 | `READY`、`TEST_OVERRIDDEN`、`BLOCKED` |
| displayName | 接收人展示名称 | 否 | 便于审计追溯 |
| crmUserId | 关联 CRM 用户 ID | 否 | 走 CRM 用户映射时填写 |
| wecomUserId | 企业微信用户 ID | 否 | 机器人单聊通知时填写 |
| partyId | 企业微信部门 ID | 否 | 部门通知时填写 |
| tagId | 企业微信标签 ID | 否 | 标签通知时填写 |
| deliveryTargetId | 实际投递目标标识 | 是 | 发送器直接使用 |
| chatType | 会话类型 | 否 | 会话型通知时填写 `single` 或 `group` |
| externalConversationId | 外部会话标识 | 否 | 会话型通知时填写 |
| resolutionReason | 解析说明或阻断原因 | 否 | `TEST_OVERRIDDEN` 或 `BLOCKED` 时建议填写 |

### 2.18 主动通知发送尝试（ProactiveNotificationAttempt）

| 字段 | 说明 | 必填 | 规则 |
| --- | --- | --- | --- |
| id | 发送尝试 ID | 是 | 全局唯一 |
| recipientSnapshotId | 关联接收人快照 ID | 是 | 必须存在于接收人快照集合 |
| channel | 实际发送通道 | 是 | `WECOM_APP_MESSAGE` 或 `WECOM_BOT_MESSAGE` |
| status | 尝试状态 | 是 | `PENDING`、`SENT`、`FAILED`、`SKIPPED` |
| attemptCount | 当前尝试次数 | 是 | 非负整数 |
| externalMessageId | 外部消息 ID | 否 | 发送成功时填写 |
| invalidUserIds | 无效用户 ID 列表 | 否 | 机器人单聊目标无效或接收失败时填写 |
| invalidPartyIds | 无效部门 ID 列表 | 否 | 当前阶段保留扩展字段，不作为主路径使用 |
| invalidTagIds | 无效标签 ID 列表 | 否 | 当前阶段保留扩展字段，不作为主路径使用 |
| failureReason | 失败原因 | 否 | 失败或跳过时填写 |
| createdAt | 创建时间 | 是 | 系统生成 |
| lastAttemptAt | 最近一次尝试时间 | 否 | 有发送尝试时填写 |
| deliveredAt | 发送成功时间 | 否 | `status=SENT` 时填写 |

## 3. CRM 业务对象

### 3.1 组织（Organization）

关键字段：`id`、`name`、`usersCount`、`createdAt`、`updatedAt`

关系：

- 一个组织包含多个部门。
- 一个组织包含多个用户。
- 商机、合同、客户均归属于组织。

### 3.2 部门（Department）

关键字段：`id`、`name`、`organizationId`、`parentId`、`path`、`status`

关系：

- 一个部门属于一个组织。
- 一个部门可有上级部门。
- 商机、合同、客户可归属于部门。

### 3.3 用户（User）

关键字段：`id`、`name`、`organizationId`、`roleId`、`status`、`usable`

关系：

- 一个用户至少归属一个组织。
- 一个用户可关联多个角色和多个部门。
- 用户可作为商机、合同、客户负责人。

### 3.4 角色与权限（Role / Permission）

关键字段：

- Role：`id`、`name`、`organizationId`
- Permission：`id`、`name`、`subject`、`action`
- RoleUserMap：`roles_users.role_id`、`roles_users.user_id`
- PermissionRoleMap：`permissions_roles.role_id`、`permissions_roles.permission_id`
- UserDepartmentMap：`users_departments.user_id`、`users_departments.department_id`
- Ownership：`ownerships.owner_id`、`ownerships.owner_type`、`ownerships.subject_id`、`ownerships.subject_type`、`ownerships.organization_id`

关系：

- 角色与权限通过映射关系关联。
- 用户所属部门除了 `users.department_id` 以外，还要通过 `users_departments` 补齐多部门映射。
- 分析功能、模板可见性和导出功能的可用性由角色集合决定。
- 当存在更细粒度主体授权时，需要结合 `ownerships` 等主体归属关系追加范围限制。

### 3.5 客户（Customer）

关键字段：`id`、`name`、`category`、`source`、`organizationId`、`departmentId`、`userId`

关系：

- 一个客户可对应多个商机。
- 一个客户可对应多个合同。

### 3.6 商机（Opportunity）

关键字段：`id`、`title`、`customerId`、`stage`、`expectAmount`、`organizationId`、`departmentId`、`userId`、`createdAt`

关系：

- 一个商机属于一个客户。
- 一个商机可关联零个或多个合同。
- 商机是一期分析的主对象。

### 3.7 合同（Contract）

关键字段：`id`、`title`、`customerId`、`opportunityId`、`status`、`totalAmount`、`organizationId`、`departmentId`、`userId`

关系：

- 一个合同可关联一个来源商机。
- 合同是一期转合同分析的主对象。

### 3.8 企业微信身份映射（WecomIdentityMapping）

关键字段：

- WecomUser：`wx_users.id`、`wx_users.wx_organization_id`、`wx_users.userid`、`wx_users.name`、`wx_users.mobile`、`wx_users.email`、`wx_users.weixinid`、`wx_users.status`
- WecomUserMap：`wx_user_maps.wx_user_id`、`wx_user_maps.user_id`、`wx_user_maps.wx_organization_id`、`wx_user_maps.user_ticket`、`wx_user_maps.user_ticket_expired_at`
- WecomOrganizationMap：`wx_organization_maps.wx_organization_id`、`wx_organization_maps.organization_id`
- WecomDepartment：`wx_departments.wx_organization_id`、`wx_departments.dept_id`、`wx_departments.parent_id`、`wx_departments.name`、`wx_departments.path`
- WecomUserDepartmentMap：`wx_user_department_maps.wx_user_id`、`wx_user_department_maps.wx_department_id`、`wx_user_department_maps.wx_organization_id`

关系：

- 企业微信消息进入系统后，先通过 `wx_user_maps` 将企业微信用户映射到 CRM `users.id`。
- 企业微信组织通过 `wx_organization_maps` 映射到 CRM `organizations.id`。
- 企业微信部门树与成员部门关系分别通过 `wx_departments` 和 `wx_user_department_maps` 补齐，用于会话上下文和部门级权限校验。
- 任意一级映射缺失、失效或状态不可用时，当前企业微信会话不得进入分析执行态。

### 3.9 CRM 内部创建命令（CrmCustomerCreateCommand / CrmOpportunityCreateCommand）

这两类对象属于**不落库的受控请求模型**，用于承接后续机器人或其它内部调用方对“新增客户”“新增商机”能力的统一调用，不直接暴露 CRM 原始表单键名。

#### 3.9.1 新增客户命令（CrmCustomerCreateCommand）

| 字段 | 说明 | 必填 | 规则 |
| --- | --- | --- | --- |
| name | 名称 | 是 | 对应截图必填字段，不能为空 |
| phone | 电话 | 是 | 对应截图必填字段，写入 CRM 客户地址电话字段 |
| itDecisionLocation | IT决策权所在地 | 是 | 对应截图必填字段，需映射到 CRM 自定义字段 |
| unifiedSocialCreditCode | 统一社会信用代码 | 是 | 对应截图必填字段，需映射到 CRM 自定义字段 |
| ownerUserId | 负责人 ID | 否 | 未传时默认取当前会话用户 |
| wantDepartmentId | 所属部门 ID | 否 | 未传时默认取当前会话用户首个部门 |
| category | 客户类型 | 否 | 未传时允许使用环境默认值；最终必须满足 CRM 官方必填 |
| source | 客户来源 | 否 | 未传时允许使用环境默认值；最终必须满足 CRM 官方必填 |
| note | 备注 | 否 | 直接映射到 CRM 标准字段 |
| parentCustomerId | 上级客户 ID | 否 | 直接映射到 CRM 标准字段 |
| industry | 行业 | 否 | 直接映射到 CRM 标准字段 |
| customFields | 扩展自定义字段 | 否 | 仅允许键值对；键为 CRM 自定义字段 key |

#### 3.9.2 新增商机命令（CrmOpportunityCreateCommand）

| 字段 | 说明 | 必填 | 规则 |
| --- | --- | --- | --- |
| title | 项目名称 | 是 | 对应截图必填字段，不能为空 |
| customerId | 最终客户 ID | 是 | 对应截图必填字段，写入 CRM `customer_id` |
| customerName | 最终客户名称 | 否 | 主要用于回显与调用方上下文，不参与必填校验 |
| leadCode | 线索编号 | 是 | 对应截图必填字段，需映射到 CRM 自定义字段 |
| productAssets | 关联产品列表 | 是 | 对应截图必填字段，至少包含 1 个 `productId` |
| expectAmount | 预计有效收入 | 是 | 对应截图必填字段，必须大于 0 |
| expectSignDate | 预计签单日期 | 是 | 对应截图必填字段，写入 CRM 标准字段 |
| renewalContractCode | 被续签合同号 | 是 | 对应截图必填字段，需映射到 CRM 自定义字段 |
| agentFullName | 代理商全称 | 是 | 对应截图必填字段，需映射到 CRM 自定义字段 |
| projectStatusSummary | 项目现状及关键点 | 是 | 对应截图必填字段，需映射到 CRM 自定义字段 |
| preSalesName | 售前 | 是 | 对应截图必填字段，需映射到 CRM 自定义字段 |
| ownerUserId | 负责人 ID | 否 | 未传时默认取当前会话用户 |
| wantDepartmentId | 所属部门 ID | 否 | 未传时默认取当前会话用户首个部门 |
| stage | 销售阶段 | 否 | 未传时允许使用环境默认值 |
| source | 商机来源 | 否 | 未传时允许使用环境默认值 |
| kind | 商机类型 | 否 | 未传时允许使用环境默认值 |
| note | 备注 | 否 | 直接映射到 CRM 标准字段 |
| customerRequirement | 客户需求 | 否 | 直接映射到 CRM 标准字段 |
| getTime | 商机获取日期 | 否 | 直接映射到 CRM 标准字段 |
| contactIds | 关联联系人 ID 列表 | 否 | 映射为 CRM `contact_assetships_attributes` |
| customFields | 扩展自定义字段 | 否 | 仅允许键值对；键为 CRM 自定义字段 key |

**校验约束：**

- 新增客户命令必须在进入 CRM Open API 前完成截图必填字段校验、默认值补齐与自定义字段映射校验。
- 新增商机命令必须在进入 CRM Open API 前完成截图必填字段校验、至少一条关联产品校验与自定义字段映射校验。
- Web 会话下的新增客户/新增商机命令必须优先使用当前会话中的 CRM access token；企业微信受控创建场景在发送人缺少 Web 登录态时，允许改用受控内置账号换取 CRM Open API token，但审计中仍必须保留真实企微发起人。
- 企业微信商机创建中的 `productAssets` 允许由受控产品别名映射补齐为 `productId`，但在未解析出至少一条 `productId` 前不得进入创建确认。

## 4. 关系汇总

- `Organization 1-N Department`
- `Organization 1-N User`
- `Customer 1-N Opportunity`
- `Customer 1-N Contract`
- `Opportunity 0..N Contract`
- `QuerySession 1-N AnalysisRequest`
- `User 1-N QuerySession`
- `User 1-N AnalysisRequest`
- `AnalysisRequest 1-1 AnalysisResult`
- `CommonQueryTemplate 0..N AnalysisRequest`
- `User 1-N RecentQueryRecord`
- `AnalysisRequest 0..1 RecentQueryRecord`
- `AnalysisRequest 1-N AuditEvent`
- `QuerySession 1-N PendingFollowUpWriteback`
- `User 1-N ContractReviewTask`
- `ContractReviewTask 1-N ContractReviewIssue`
- `ContractReviewTask 1-N ContractReviewArtifact`
- `AnalysisRequest 0..N ExportRequest`
- `AccessPolicy` 作用于 `AnalysisRequest`、`CommonQueryTemplate` 与 `ExportRequest`
- `User 1-1 AnalysisCapabilitySnapshot`
- `AuditEvent N-1 AuditSummarySnapshot`（按时间窗口聚合）
- `User 1-N ProactiveNotificationTask`
- `ProactiveNotificationTask 1-N ProactiveNotificationRecipientSnapshot`
- `ProactiveNotificationTask 1-N ProactiveNotificationAttempt`
- `WecomUserMap N-1 User`
- `WecomOrganizationMap N-1 Organization`

## 5. 关键校验规则

- 自然语言问题必须先转换为结构化意图，意图中的主题、指标、维度和过滤条件都必须命中白名单。
- 当问题缺少关键限定条件时，请求进入 `CLARIFICATION_REQUIRED` 状态，并保存补问提示与缺失条件。
- 任何请求只要命中未授权组织、部门、负责人、表或字段，即进入 `BLOCKED` 状态。
- 常用查询模板只能提供问题骨架和默认条件，不能绕过实时权限校验。
- 最近查询重跑必须重新注入当前权限和当前字段可见性，而不是复用旧执行结果。
- 同一结果中的摘要、图表、表格和导出必须共享同一 `consistencyToken`。
- 同一会话中的流式结果块必须带顺序语义，发送顺序不能回退、跳号或混入其他会话内容。
- 同一时间超出允许并发上限的新请求必须被标记为排队或稍后重试，而不是直接进入执行态。
- 导出请求只能基于已成功返回的分析结果发起，且必须再次校验权限、次数和一致性标识。
- 空结果是合法业务结果，不视为失败，但仍需写入审计事件。
- 合同审核任务、问题、产物和审计事件必须能够追溯到同一份 `reviewBasis`；任务详情、列表摘要与产物元数据中的 `packVersion`、`packChecksumSummary`、`executionMode` 必须一致。
- 合同审核默认先返回 `DETERMINISTIC_ONLY` 规则快审结果，并在可用时继续进行 AI 补充审核；若 AI 不可用而停留在 `DETERMINISTIC_ONLY`，系统必须根据 `degradationReason` 区分“规则快审”与“降级快审”，不得伪装成完整 AI 混合审核结果。
- 合同审核任务若因文档损坏、审核标准缺失或关键前置条件不满足而被阻断，必须进入 `BLOCKED` 或 `FAILED`，不得生成风险结论或可下载产物。
- 企业微信请求必须先命中 `wx_user_maps -> wx_users -> wx_organization_maps` 映射链，任何一段缺失都要直接阻止并记录审计事件。
- 正式主动通知在发送前必须先完成统一接收人解析与当前权限校验；接收人映射缺失、权限失效或目标上下文不可靠时，通知任务必须进入 `BLOCKED` 状态。
- 当真实消息发送开关未开启时，主动通知必须通过企业微信机器人通道改投测试接收人或进入等效测试模式，不得直接向真实业务对象发送。
- 同一业务任务、同一接收目标、同一时间窗内重复触发的主动通知必须命中幂等保护，而不是重复发送。
- 日报生产发送链路必须额外维护“日报部门启停策略”和“日报收件人覆盖规则”两类治理数据；它们只控制日报发送范围与默认收件人，不替代 `wecom.daily_report.preview` 等主动查看权限点。
- 销售日报团队汇总的最小发送单元必须是“销售小组”，并记录每个销售小组的最终收件人列表、规则来源、成员名单、成员数和发送状态；同一个小组允许配置多个组长接收汇总，但仍需保留小组维度，避免只保留一个扁平 `recipientIds` 列表而无法解释“为什么这个小组发给这些人”。
- 日报销售小组配置必须允许在自动识别结果之上人工新增、编辑、删除手工小组，并允许覆盖小组收件人和成员名单；真实发送链路必须使用后台确认后的有效小组配置，不得只依赖部门名称自动识别。
- 当真实发送开关关闭时，日报发送预览与审计仍必须保留真实目标收件人和规则来源；测试改投只影响投递层，不得覆盖规则解析层产出的真实收件人快照。
- 只有在企业微信唯一命中一个 `Opportunity`、已生成有效草稿且用户完成“是否现在写入”“内容是否正确”两层确认后，才能调用 CRM 官方写跟进接口。
- 跟进写回失败时必须保留待写回草稿与失败原因，允许用户修改后再次确认，不得静默降级为数据库直写。
- 高风险审计事件创建后默认进入 `PENDING` 复核状态，只有管理员处理后才允许变更为 `CONFIRMED` 或 `IGNORED`。

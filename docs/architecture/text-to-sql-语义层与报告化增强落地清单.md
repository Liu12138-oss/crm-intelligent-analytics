# Text-to-SQL 语义层与报告化增强落地清单

## 1. 目的

本文基于外部文章中“语义层先行、模型只做理解与规划、执行链路受控、结果以报告承接”的思路，结合当前 CRM 智能分析系统一期现状，整理一份适合本项目的落地改造清单。

本文不讨论自由 SQL、Notebook 生产化或放宽受控边界，而是聚焦以下目标：

- 提升自然语言问数的稳定性、可解释性和可治理性。
- 让知识口径、模板命中、执行轨迹和报告表达形成闭环。
- 在不破坏现有白名单、权限注入、AST 校验和审计留痕前提下，增强系统的可维护性。

## 2. 当前现状判断

### 2.1 已有基础

当前仓库已经具备较好的受控问数底座，外部文章里最关键的安全与编排思想，你们并不缺：

- 问数知识层雏形已经存在：`backend/src/modules/analysis/analysis-query-knowledge.service.ts`
- 结构化编译链已经存在：`backend/src/modules/analysis/query-compiler.service.ts`
- 只读 AST 校验已经存在：`backend/src/modules/analysis/query-ast-validator.service.ts`
- 工作流编排已经存在：`backend/src/modules/analysis/analysis-workflow.orchestrator.ts`
- 结果报告组装已经存在：`backend/src/modules/analysis/analysis-report-composer.service.ts`
- 经营报表区块化渲染已经存在：`backend/src/modules/management-report/` 与 `frontend/src/components/management-report/`
- 口径悬浮说明组件已经存在：`frontend/src/components/management-report/blocks/SectionSourcePopover.vue`

### 2.2 当前短板

对照文章思路，当前最明显的缺口不是“模型能力不够”，而是工程资产化程度不够：

- 问数知识层仍以代码内常量为主，业务无法独立维护别名、口径、负例和推荐问法。
- 执行链虽然安全，但用户和治理端还看不到足够清晰的“命中了什么知识、走了什么执行路径、为什么 fallback”。
- 智能分析结果页与经营报表页都在做“报告化”，但两套区块 schema 还没有完全统一。
- 当前更多是“能执行”，还缺“语义资产评测与回归”这套持续优化闭环。

## 3. 总体原则

后续改造建议继续坚持以下原则，不建议回退：

- AI 负责语义理解、字段抽取、补问建议和报告摘要，不直接成为最终执行器。
- 程序继续负责白名单、权限注入、AST 校验、超时、导出限制和审计留痕。
- Web 是完整报告承载面，企业微信只承接摘要、确认和深链跳转。
- 所有口径、别名、模板、负例、执行轨迹和 fallback 原因都应逐步资产化、可审计、可灰度。

## 4. P0 改造清单

P0 目标是“先把语义层、执行轨迹、报告协议三件事做实”，优先级最高，建议作为下一轮主线。

### 4.1 语义知识层治理化

#### 改造目标

把当前内置在代码里的问数别名、码表提示、时间字段口径、已验证问法和模板命中提示，升级为可治理、可发布、可回滚的业务资产。

#### 为什么先做

这是文章里最值得借鉴的一层，也是当前最容易直接增益问数质量的部分。只优化提示词而不治理知识资产，会让后续维护继续依赖研发改代码。

#### 建议改动点

后端：

- 新增语义资产治理模型，建议落点在 `backend/src/modules/governance/` 下新增一组模块，例如：
  - `semantic-knowledge.repository.ts`
  - `semantic-knowledge.service.ts`
  - `semantic-knowledge.controller.ts`
- `backend/src/modules/analysis/analysis-query-knowledge.service.ts`
  - 从“静态常量 + 模板仓库”改成“治理资产优先 + 静态常量兜底”
  - 保留 `ANALYSIS_QUERY_KNOWLEDGE_ENABLED` 灰度开关
- `backend/src/modules/analysis/analysis-workflow.orchestrator.ts`
  - 保留知识层注入机制
  - 增加“命中知识资产 ID / 版本 / 类型”的快照
- `specs/001-crm-intelligent-analytics/data-model.md`
  - 补充“语义资产”实体定义
- `specs/001-crm-intelligent-analytics/contracts/openapi.yaml`
  - 补充治理端读写语义资产接口

前端：

- 在 `frontend/src/pages/governance/` 下新增“语义资产治理”页面，建议能力包括：
  - 指标别名管理
  - 时间字段口径管理
  - 组织别名与归一规则管理
  - 已验证问法管理
  - 负例与阻断示例管理
- 若本轮不想新增一级导航，可先挂到模板治理页的次级 tab 中。

#### 最小可交付范围

P0 不需要一次性做成全量 CMS，先覆盖以下 5 类资产：

- 指标别名
- 时间字段与默认时间口径
- 组织别名与归一提示
- 已验证问法示例
- 负例 / 易错问法示例

#### 验收标准

- 治理端可以不改代码直接新增或停用一条别名或示例。
- 问数执行快照中可以看到本次命中了哪些知识资产。
- 关闭知识层开关后，基础受控问数链仍可运行。
- 语义资产变更有审计记录，有版本号或更新时间快照。

### 4.2 执行轨迹与可解释审计增强

#### 改造目标

把“系统实际如何把一句话变成结果”的关键轨迹展示出来，让业务、实施、治理和研发都能排障。

#### 为什么先做

当前链路虽然安全，但黑盒感仍然偏强。文章里值得吸收的一点，是把理解层、桥接层、执行层分开看清楚。你们已经有这些层，只差可见化。

#### 建议改动点

后端：

- `backend/src/modules/analysis/analysis.service.ts`
  - 在请求与结果快照中补充统一 `executionTrace` 结构
- `backend/src/modules/analysis/analysis-workflow.orchestrator.ts`
  - 输出以下关键信息到快照：
    - 命中的知识资产
    - 计划出的任务列表
    - 每个任务的 `resultKind`
    - 每个任务的 `executionSource`
    - 最终生成的受控 SQL
    - 命中的 `matchedAdapter`
    - `fallbackReason`
- `backend/src/modules/audit/`
  - 审计详情支持显示执行轨迹摘要
  - fallback 原因聚合继续保留，并扩展到“知识层命中率 / 执行源分布 / 失败阶段分布”
  - 已补充独立 SQL 审计流，用于检索本系统后端服务发出的 CRM SQL；治理口径明确限定为“本系统后端发出的 CRM SQL”，不承诺数据库级全局 SQL 审计

前端：

- `frontend/src/pages/analysis/AnalysisResultDetailPage.vue`
  - 新增“执行轨迹”折叠区或抽屉
- `frontend/src/pages/analysis/AnalysisWorkbenchPage.vue`
  - 结果卡片增加“本次执行依据”摘要入口
- `frontend/src/pages/audit/AuditEventPage.vue`
  - 审计详情增加轨迹摘要、fallback 原因、命中资产类型

#### 建议展示字段

- 入口问题原文
- 标准化问题
- 命中模板 / 已验证问法 / 别名提示
- 结构化意图摘要
- 补问与缺失条件
- 执行模式
- 执行来源
- 任务级 SQL 摘要
- 结果数据集数量
- 一致性 token
- fallback 原因

#### 验收标准

- 单次结果详情中可查看完整执行轨迹摘要。
- 审计页可检索主要 fallback 原因与执行来源。
- SQL 审计页可按模块、数据库角色、执行阶段、表名、请求 ID 和会话 ID 检索，并可对完整 SQL / 参数执行受控 reveal。
- 业务侧能区分“模型理解问题”“知识层缺口”“执行边界阻断”“数据本身无结果”。

### 4.3 统一智能分析与经营报表的报告协议

#### 改造目标

把智能分析结果页和经营报表页逐步收敛到一套区块化报告协议，避免两套报告系统平行演进。

#### 为什么先做

文章里“最后落到报告表达”这一点，对你们最有价值。你们当前已经有分析报告组装器和经营报表区块组件，如果不统一，后面会出现双份组件、双份口径、双份来源说明。

#### 建议改动点

后端：

- 统一 `analysis` 与 `management-report` 的区块定义，建议抽一个共享 schema
- 优先对齐以下区块类型：
  - 指标条
  - 趋势图
  - 排行表
  - 明细表
  - 风险块
  - 数据质量 / 口径说明块
- `backend/src/modules/analysis/analysis-report-composer.service.ts`
  - 补 `sourceNotes`、`footnotes`、`datasetReferences`
  - 输出更贴近经营报表区块协议的结构

前端：

- `frontend/src/pages/analysis/AnalysisWorkbenchPage.vue`
  - 不再只拼装“摘要 + 图 + 表”，而是逐步转向统一 section 渲染
- 抽一个可复用的分析报告画布组件，优先复用经营报表现有能力：
  - `frontend/src/components/management-report/ManagementSectionCanvas.vue`
  - `frontend/src/components/management-report/blocks/SectionSourcePopover.vue`

#### 最小可交付范围

P0 不要求完全合并模块，只要求先统一协议与渲染思路：

- 智能分析结果页先接入统一 section schema
- 每个 section 都可带口径说明与来源说明
- 企业微信仍只消费精简摘要块

#### 验收标准

- 分析结果页至少 70% 的主内容区块使用统一报告 schema 输出。
- 关键指标、趋势图、排行表都可显示口径与来源说明。
- Web 报告与企业微信摘要在结论口径上保持一致。

## 5. P1 改造清单

P1 目标是“让语义资产和报告系统进入可运营状态”，在 P0 稳定后推进。

### 5.1 语义资产评测与回归

#### 改造目标

建立一套固定样例集，验证每次知识层、提示词或模板调整后，问数结果是否更稳定，而不是靠人工感觉。

#### 建议改动点

- 在 `backend/test/` 增加语义回归用例，覆盖：
  - 别名命中
  - 时间范围抽取
  - 长正文补充与确认短句区分
  - 容易误判的负例
- 在治理端新增“已验证问法”命中率与失败原因统计
- 在 `docs/testing/` 下补一份语义回归清单

#### 验收标准

- 每次语义资产更新都有回归结果。
- 能明确知道哪一类问法退化了。

### 5.2 模板、知识层与审计的闭环优化

#### 改造目标

让“常用查询模板”“已验证问法”“fallback 原因”“人工修正结论”互相联动，形成优化闭环。

#### 建议改动点

- fallback 高频问题自动进入待优化列表
- 高命中自由问法可一键沉淀为已验证示例
- 治理端显示：
  - 模板命中率
  - 知识层命中率
  - fallback 原因排行
  - 需要补知识资产的问题清单

#### 验收标准

- 业务治理人员能从审计直接定位“该补模板”还是“该补知识层”。

### 5.3 企业微信摘要与 Web 报告的深链联动

#### 改造目标

让企业微信真正成为移动入口，而不是另一个独立结果系统。

#### 建议改动点

- 企业微信摘要返回统一的结论块、指标块、风险块
- 当结果结构复杂时，明确提示去 Web 查看完整报告
- Web 详情页支持从企微结果直接深链打开同一 queryId

#### 验收标准

- 同一 queryId 的企微摘要与 Web 完整报告可一一对应。
- 复杂结果不再在企微里硬塞长表格。

## 6. P2 改造清单

P2 目标是“把系统从能用提升到可持续扩展”，不建议抢在 P0 前做。

### 6.1 离线分析师验证工作台

#### 改造目标

为分析师或运营同学提供一个离线验证环境，用于调试问法、观察命中知识资产、对比报告输出。

#### 说明

这里可以借鉴文章里 Notebook 的“探索体验”，但不建议把 Notebook 或任意执行环境带入生产主链路。

#### 建议范围

- 仅限内网、仅限测试数据或脱敏数据
- 只读
- 带完整执行轨迹
- 不直接触发正式审计或正式对话消息

### 6.2 主题报告包扩展

在当前商机、合同、客户之外，后续若要扩展更多主题，建议继续沿用“主题资产包”思路，而不是在主流程里堆条件判断。

建议扩展顺序：

- 先扩主题报告包
- 再扩语义资产
- 最后扩执行器映射

## 7. 明确不建议当前做的事

以下事项不建议作为当前阶段方向：

- 直接开放自由 Text-to-SQL，让模型输出任意 SQL 后执行
- 在生产环境引入 Jupyter / Notebook 作为正式执行面
- 继续用本地关键词、短句表和状态机承担主要语义理解职责
- 把企微和 Web 做成两套结果口径不同的输出系统
- 在没有统一报告协议前分别扩分析页和经营报表页

## 8. 推荐实施顺序

建议按以下顺序推进：

1. 先做语义知识层治理化
2. 再做执行轨迹与可解释审计
3. 再统一报告协议与结果渲染
4. 然后补语义评测与治理闭环
5. 最后再考虑离线验证工作台与更多主题扩展

## 9. 建议触发的同步文档

如果确认按本文推进，至少需要同步检查以下文档：

- `specs/001-crm-intelligent-analytics/spec.md`
- `specs/001-crm-intelligent-analytics/plan.md`
- `specs/001-crm-intelligent-analytics/data-model.md`
- `specs/001-crm-intelligent-analytics/contracts/openapi.yaml`
- `specs/001-crm-intelligent-analytics/tasks.md`
- `docs/testing/` 下相关验证清单

## 10. 下一步建议

如果决定正式推进，建议下一步不是直接写代码，而是先补一个小型 OpenSpec 变更，范围只覆盖以下三件事：

- 语义资产治理
- 执行轨迹快照与展示
- 分析报告区块协议统一

这样能避免目标过大，导致本轮把“语义层”“报告层”“治理层”“企微摘要层”混成一坨同时开工。

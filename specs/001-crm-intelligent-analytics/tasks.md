# Tasks: CRM智能分析系统（一期：企业微信 AI 问数与智能分析工作台）

**Input**: 设计文档来自 `D:\code\CRM\specs\001-crm-intelligent-analytics\`  
**Prerequisites**: `plan.md`、`spec.md`；已参考 `research.md`、`data-model.md`、`contracts/openapi.yaml`、`quickstart.md`

**Tests**: 因实施计划已承诺关键链路自动化验证，本清单为高风险路径补充 Vitest、Jest + Supertest、Playwright 和并发压测任务；不要求所有故事严格 TDD，但数据准确性、权限边界、会话隔离、查询复用、导出限制和治理审计必须有自动化覆盖。  
**Organization**: 任务按用户故事分组，确保每个故事可独立实现、独立验证、独立演示。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行执行（不同文件、且不依赖未完成任务）
- **[Story]**: 用户故事标签，仅用于用户故事阶段任务（`[US1]`、`[US2]`、`[US3]`、`[US4]`）
- 每条任务都包含明确文件路径

## Phase 1: Setup（项目初始化）

**Purpose**: 建立前后端分离工程骨架、统一编码约束和测试基础设施

- [X] T001 创建 pnpm 工作区配置于 `pnpm-workspace.yaml`
- [X] T002 创建根脚本与共享依赖清单于 `package.json`
- [X] T003 [P] 初始化后端依赖清单于 `backend/package.json`
- [X] T004 [P] 初始化前端依赖清单于 `frontend/package.json`
- [X] T005 [P] 配置后端 TypeScript 编译参数于 `backend/tsconfig.json`
- [X] T006 [P] 配置前端 Vite 与 TypeScript 于 `frontend/vite.config.ts`
- [X] T007 [P] 配置统一代码规范于 `.eslintrc.cjs`
- [X] T008 [P] 创建后端环境变量模板于 `backend/.env.example`
- [X] T009 [P] 创建前端环境变量模板于 `frontend/.env.example`
- [X] T010 [P] 配置后端 Jest 与 Supertest 入口于 `backend/jest.config.ts`
- [X] T011 [P] 配置前端 Vitest 入口于 `frontend/vitest.config.ts`
- [X] T012 [P] 配置前端 Playwright 入口于 `frontend/playwright.config.ts`

---

## Phase 2: Foundational（阻塞性基础能力）

**Purpose**: 构建所有用户故事共享的运行时基础设施与安全底座

**⚠️ CRITICAL**: 本阶段完成前，任何用户故事都不应开始实施

- [X] T013 创建后端启动入口于 `backend/src/main.ts`
- [X] T014 [P] 创建后端根模块于 `backend/src/app.module.ts`
- [X] T015 [P] 创建双数据源连接模块于 `backend/src/database/database.module.ts`
- [X] T016 [P] 创建应用库初始迁移脚本于 `backend/src/database/app-storage/migrations/001_initial_schema.sql`
- [X] T017 [P] 创建应用库迁移执行入口于 `backend/src/database/app-storage/migrate.ts`
- [X] T018 [P] 创建 CRM 会话鉴权守卫于 `backend/src/modules/auth/session-auth.guard.ts`
- [X] T019 [P] 创建访问策略仓储于 `backend/src/modules/governance/access-policy.repository.ts`
- [X] T020 [P] 创建审计事件仓储于 `backend/src/modules/audit/audit-event.repository.ts`
- [X] T021 [P] 创建查询模板仓储于 `backend/src/modules/query-assets/query-template.repository.ts`
- [X] T022 [P] 创建最近查询仓储于 `backend/src/modules/query-assets/recent-query.repository.ts`
- [X] T023 [P] 创建分析请求仓储于 `backend/src/modules/analysis/analysis-request.repository.ts`
- [X] T024 [P] 创建结果归一化服务骨架于 `backend/src/modules/analysis/result-normalizer.service.ts`
- [X] T025 [P] 创建受控查询编译器骨架于 `backend/src/modules/analysis/query-compiler.service.ts`
- [X] T026 [P] 创建查询 AST 安全校验服务于 `backend/src/modules/analysis/query-ast-validator.service.ts`
- [X] T027 [P] 创建表字段白名单校验服务于 `backend/src/modules/analysis/query-whitelist.service.ts`
- [X] T028 [P] 创建危险语句拦截服务于 `backend/src/modules/analysis/query-risk-guard.service.ts`
- [X] T029 [P] 创建 AI 网关调用适配服务于 `backend/src/modules/analysis/ai-gateway.service.ts`
- [X] T030 [P] 创建前端启动入口于 `frontend/src/main.ts`
- [X] T031 [P] 创建前端路由骨架于 `frontend/src/router/index.ts`
- [X] T032 [P] 创建统一 HTTP 客户端于 `frontend/src/services/http-client.ts`
- [X] T033 [P] 创建 Web 智能分析工作台页面骨架于 `frontend/src/pages/analysis/AnalysisWorkbenchPage.vue`
- [X] T034 [P] 创建企业微信机器人接入模块骨架于 `backend/src/modules/wecom/wecom.module.ts`
- [X] T035 [P] 创建查询会话仓储于 `backend/src/modules/sessions/query-session.repository.ts`
- [X] T036 [P] 创建连接心跳与超时回收服务于 `backend/src/modules/sessions/session-heartbeat.service.ts`

**Checkpoint**: 前后端基础框架、应用库迁移、鉴权、审计、查询资产仓储和受控执行安全底座已就绪，可开始用户故事实现

---

## Phase 3: User Story 1 - 双入口自然语言即时问数（Priority: P1） 🎯 MVP

**Goal**: 让已授权用户通过企业微信或 Web 工作台提交自然语言问题，并获得结构化分析结果与必要补问

**Independent Test**: 使用销售总监账号从企业微信和 Web 页面分别输入“本月各销售负责人新增商机金额排名”，系统返回业务化标题、结果摘要、时间范围和筛选说明；缺少必要限定条件时先补问

- [X] T037 [P] [US1] 创建自然语言问数接口契约测试于 `backend/test/contract/analysis-query.contract-spec.ts`
- [X] T038 [P] [US1] 创建企业微信问数集成测试于 `backend/test/integration/wecom-query.integration-spec.ts`
- [X] T039 [P] [US1] 创建 Web 工作台问数集成测试于 `backend/test/integration/web-query.integration-spec.ts`
- [X] T040 [P] [US1] 创建分析指标与维度白名单目录于 `backend/src/modules/analysis/analysis-catalog.ts`
- [X] T041 [US1] 实现自然语言意图解析服务于 `backend/src/modules/analysis/analysis-intent.service.ts`
- [X] T042 [US1] 实现必要条件补问服务于 `backend/src/modules/analysis/clarification.service.ts`
- [X] T043 [US1] 实现分析执行服务于 `backend/src/modules/analysis/analysis.service.ts`
- [X] T044 [US1] 实现结果流式分段服务于 `backend/src/modules/analysis/result-streamer.service.ts`
- [X] T045 [US1] 实现企业微信机器人消息入口于 `backend/src/modules/wecom/wecom-bot.controller.ts`
- [X] T046 [P] [US1] 创建机器人消息验签与身份映射服务于 `backend/src/modules/wecom/wecom-auth.service.ts`
- [X] T047 [P] [US1] 创建企业微信会话编排服务于 `backend/src/modules/wecom/wecom-bot.service.ts`
- [X] T048 [P] [US1] 创建结果流式下发服务于 `backend/src/modules/wecom/wecom-stream-dispatcher.service.ts`
- [X] T049 [P] [US1] 创建 Web 工作台查询服务于 `frontend/src/services/analysis.service.ts`
- [X] T050 [P] [US1] 创建 Web 工作台查询状态仓库于 `frontend/src/stores/analysis-query.store.ts`
- [X] T051 [US1] 实现 Web 工作台问题输入与结果拉取逻辑于 `frontend/src/pages/analysis/AnalysisWorkbenchPage.vue`

**Checkpoint**: 已授权用户可以通过企业微信和 Web 工作台独立完成一次智能分析提问，在条件不足时收到补问提示，并查看结构化结果

---

## Phase 4: User Story 2 - 结构化结果展示与查询复用（Priority: P1）

**Goal**: 让用户在 Web 工作台查看清晰一致的结构化报表，并通过常用查询与最近查询快速复用高频问题

**Independent Test**: 执行一个标准问题后，页面显示摘要、指标卡、主图表、表格、口径说明和更新时间；常用查询可一键执行，最近查询可重跑并生成新记录

- [X] T052 [P] [US2] 创建查询模板与最近查询接口契约测试于 `backend/test/contract/query-assets.contract-spec.ts`
- [X] T053 [P] [US2] 创建查询复用集成测试于 `backend/test/integration/query-assets.integration-spec.ts`
- [X] T054 [P] [US2] 实现查询模板服务于 `backend/src/modules/query-assets/query-template.service.ts`
- [X] T055 [P] [US2] 实现最近查询服务于 `backend/src/modules/query-assets/recent-query.service.ts`
- [X] T056 [US2] 实现查询模板接口于 `backend/src/modules/query-assets/query-template.controller.ts`
- [X] T057 [US2] 实现最近查询与重跑接口于 `backend/src/modules/query-assets/recent-query.controller.ts`
- [X] T058 [P] [US2] 创建结果摘要组件于 `frontend/src/components/analysis/ResultSummaryPanel.vue`
- [X] T059 [P] [US2] 创建指标卡组件于 `frontend/src/components/analysis/MetricCardGroup.vue`
- [X] T060 [P] [US2] 创建图表渲染组件于 `frontend/src/components/analysis/ResultChartView.vue`
- [X] T061 [P] [US2] 创建表格渲染组件于 `frontend/src/components/analysis/ResultTableView.vue`
- [X] T062 [P] [US2] 创建常用查询面板于 `frontend/src/components/analysis/CommonQueryPanel.vue`
- [X] T063 [P] [US2] 创建最近查询面板于 `frontend/src/components/analysis/RecentQueryPanel.vue`
- [X] T064 [US2] 将结果展示组件装配到工作台页面于 `frontend/src/pages/analysis/AnalysisWorkbenchPage.vue`
- [X] T065 [US2] 实现常用查询与最近查询交互逻辑于 `frontend/src/stores/analysis-query.store.ts`
- [X] T066 [US2] 扩展固定 SQL 模板执行与只读校验于 `backend/src/modules/query-assets/query-template-execution.service.ts`
- [X] T067 [US2] 扩展查询模板治理页的 SQL / 参数 / 推荐 / 预览能力于 `frontend/src/pages/governance/QueryTemplatePage.vue`
- [X] T068 [US2] 将结果页改为“数据结果区在前、AI 分析报告区在后”于 `frontend/src/pages/analysis/AnalysisWorkbenchPage.vue`
- [X] T069 [US2] 为常用查询与最近查询增加推荐原因、来源类型与展示快照于 `backend/src/modules/query-assets/` 与 `frontend/src/components/analysis/`
- [X] T069A [US2] 将常用查询升级为左侧常驻资产库，支持我的模板 / 其它模板、标签分类、个人副本、自由问数保存和历史累计点击排序
- [X] T070 [US2] 引入能力快照中的“猜你想查”摘要于 `backend/src/modules/sessions/session-capabilities.service.ts`

**Checkpoint**: 用户可在 Web 工作台先看到数据结果区，再看到 AI 分析报告，并可通过固定 SQL 模板、常用查询、最近查询和猜你想查快速复用高频问题

---

## Phase 5: User Story 3 - 数据准确、权限边界与稳定会话（Priority: P1）

**Goal**: 让系统在所有入口中都只返回权限范围内、条件一致且会话隔离的分析结果，并在高并发和异常连接下保持稳定

**Independent Test**: 使用部门级权限用户查询部门数据时只能看到授权范围；摘要、图表和表格数值一致；并发多用户查询时不出现串话、串数据或错发结果

- [X] T066 [P] [US3] 创建分析范围与一致性接口契约测试于 `backend/test/contract/analysis-scope.contract-spec.ts`
- [X] T067 [P] [US3] 创建权限隔离与一致性集成测试于 `backend/test/integration/analysis-scope.integration-spec.ts`
- [X] T068 [P] [US3] 创建用户数据范围解析服务于 `backend/src/modules/auth/user-scope.service.ts`
- [X] T069 [P] [US3] 创建查询范围注入服务于 `backend/src/modules/analysis/query-scope.service.ts`
- [X] T070 [P] [US3] 创建结果一致性校验服务于 `backend/src/modules/analysis/result-consistency.service.ts`
- [X] T071 [P] [US3] 创建数据新鲜度说明服务于 `backend/src/modules/analysis/data-freshness.service.ts`
- [X] T072 [US3] 将范围注入、白名单校验、AST 校验和一致性校验串联到分析执行链路于 `backend/src/modules/analysis/analysis.service.ts`
- [X] T073 [US3] 实现越权与风险响应映射于 `backend/src/modules/analysis/analysis-response.mapper.ts`
- [X] T074 [P] [US3] 创建会话能力缓存于 `backend/src/modules/sessions/session-capabilities.service.ts`
- [X] T075 [P] [US3] 创建会话排队与限流服务于 `backend/src/modules/sessions/session-queue.service.ts`
- [X] T076 [US3] 将会话稳定性与并发控制接入企业微信返回链路于 `backend/src/modules/wecom/wecom-bot.service.ts`

**Checkpoint**: 所有入口中的分析结果都在当前权限范围内保持一致，高并发场景下仍能稳定返回且无串话问题

---

## Phase 6: User Story 4 - 管理治理、受限导出与审计（Priority: P2）

**Goal**: 让管理员配置访问策略、模板可见性和导出规则，并能够检索查询、重跑、导出和异常事件

**Independent Test**: 管理员更新治理策略和模板配置后新策略立即生效；导出超限被拦截；审计页面可按用户和时间范围回溯查询、模板点击、历史重跑与导出事件

- [X] T077 [P] [US4] 创建导出接口契约测试于 `backend/test/contract/export.contract-spec.ts`
- [X] T078 [P] [US4] 创建治理与审计接口契约测试于 `backend/test/contract/governance-audit.contract-spec.ts`
- [X] T079 [P] [US4] 创建导出限制与审计集成测试于 `backend/test/integration/export-policy.integration-spec.ts`
- [X] T080 [P] [US4] 创建治理策略即时生效集成测试于 `backend/test/integration/governance-audit.integration-spec.ts`
- [X] T081 [P] [US4] 创建导出请求仓储于 `backend/src/modules/export/export-request.repository.ts`
- [X] T082 [P] [US4] 创建导出额度校验服务于 `backend/src/modules/export/export-policy.service.ts`
- [X] T083 [US4] 实现导出文件生成服务于 `backend/src/modules/export/export.service.ts`
- [X] T084 [US4] 实现结果导出接口于 `backend/src/modules/export/export.controller.ts`
- [X] T085 [P] [US4] 创建治理策略校验模式于 `backend/src/modules/governance/access-policy.schema.ts`
- [X] T086 [US4] 实现访问策略管理服务于 `backend/src/modules/governance/governance.service.ts`
- [X] T087 [US4] 实现治理策略接口于 `backend/src/modules/governance/governance.controller.ts`
- [X] T088 [US4] 实现模板治理接口于 `backend/src/modules/query-assets/query-template-admin.controller.ts`
- [X] T089 [US4] 实现审计事件查询接口于 `backend/src/modules/audit/audit.controller.ts`
- [X] T090 [P] [US4] 创建治理策略页面于 `frontend/src/pages/governance/GovernancePolicyPage.vue`
- [X] T091 [P] [US4] 创建查询模板管理页面于 `frontend/src/pages/governance/QueryTemplatePage.vue`
- [X] T092 [P] [US4] 创建连接策略管理页面于 `frontend/src/pages/governance/ConnectionPolicyPage.vue`
- [X] T093 [P] [US4] 创建审计查询页面于 `frontend/src/pages/audit/AuditEventPage.vue`
- [X] T094 [US4] 注册工作台、治理与审计路由于 `frontend/src/router/index.ts`

**Checkpoint**: 管理员可以独立完成治理配置、模板维护、导出控制和审计检索，不依赖其他页面手工查库

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 完善跨故事的一致性、性能、安全性和交付文档

- [X] T095 [P] 补充后端结构化日志、连接状态与耗时指标于 `backend/src/shared/logging/analysis-logger.service.ts`
- [X] T096 [P] 补充性能、并发和连接稳定性非功能验证于 `backend/test/integration/nonfunctional.integration-spec.ts`
- [X] T097 [P] 补充工作台结果展示和查询复用端到端验证于 `frontend/tests/e2e/analysis-workbench.e2e-spec.ts`
- [X] T098 [P] 补充系统架构说明于 `docs/architecture/crm-intelligent-analytics.md`
- [X] T099 根据 `specs/001-crm-intelligent-analytics/quickstart.md` 记录人工验证结果于 `docs/testing/crm-intelligent-analytics-quickstart-checklist.md`
- [X] T100 [P] 为自由问数与查询模板统一 richer report 协议于 `backend/src/shared/types/domain.ts`、`frontend/src/types/analysis.ts`
- [X] T101 [P] 为智能分析结果增加趋势预测、异常风险与经营建议事实计算于 `backend/src/modules/analysis/analysis-forecast.service.ts`、`backend/src/modules/analysis/analysis-insight-evidence.service.ts`
- [X] T102 [P] 让自由问数与查询模板共用 richer report 编排与多版本 Markdown 于 `backend/src/modules/analysis/analysis-rich-report.service.ts`、`backend/src/modules/query-assets/query-template-execution.service.ts`
- [X] T103 [P] 将 Web 查询页升级为单页完整 richer report 展示于 `frontend/src/pages/analysis/AnalysisWorkbenchPage.vue`、`frontend/src/components/analysis/AnalysisRichReportPanel.vue`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup**：无依赖，可立即开始
- **Phase 2: Foundational**：依赖 Phase 1 完成；阻塞所有用户故事
- **Phase 3: US1**：依赖 Phase 2 完成；形成最小可演示双入口 AI 问数 MVP
- **Phase 4: US2**：依赖 US1 的主链路与结果归一化能力；用于补齐工作台展示和查询复用闭环
- **Phase 5: US3**：依赖 US1 的执行链路、US2 的结果结构和 Phase 2 的安全底座；用于补齐权限、一致性和稳定性闭环
- **Phase 6: US4**：依赖 Phase 2；若要完成完整审计验收，建议在 US1-US3 之后执行
- **Phase 7: Polish**：依赖所有目标用户故事完成

### User Story Dependency Graph

```text
Setup -> Foundational -> US1 -> US2 -> US3
                    \--------------------> US4

推荐交付顺序：US1 -> US2 -> US3 -> US4
推荐完整验收顺序：US1 + US2 -> US3 -> US4
```

### Story Independence Notes

- **US1**：可独立提供企业微信与 Web 双入口自然语言问数、补问澄清与结果返回能力
- **US2**：可独立验证结构化结果展示、常用查询和最近查询复用体验
- **US3**：可独立验证权限范围控制、结果一致性、AST 安全校验和会话稳定性
- **US4**：治理页面可独立构建，但完整审计回放需要 US1-US3 先产生事件数据

---

## Parallel Execution Examples

### User Story 1

```text
T037 backend/test/contract/analysis-query.contract-spec.ts
T040 backend/src/modules/analysis/analysis-catalog.ts
T046 backend/src/modules/wecom/wecom-auth.service.ts
T049 frontend/src/services/analysis.service.ts
```

### User Story 2

```text
T052 backend/test/contract/query-assets.contract-spec.ts
T054 backend/src/modules/query-assets/query-template.service.ts
T058 frontend/src/components/analysis/ResultSummaryPanel.vue
T062 frontend/src/components/analysis/CommonQueryPanel.vue
```

### User Story 3

```text
T066 backend/test/contract/analysis-scope.contract-spec.ts
T068 backend/src/modules/auth/user-scope.service.ts
T070 backend/src/modules/analysis/result-consistency.service.ts
T075 backend/src/modules/sessions/session-queue.service.ts
```

### User Story 4

```text
T077 backend/test/contract/export.contract-spec.ts
T085 backend/src/modules/governance/access-policy.schema.ts
T091 frontend/src/pages/governance/QueryTemplatePage.vue
T093 frontend/src/pages/audit/AuditEventPage.vue
```

---

## Implementation Strategy

### MVP First

1. 完成 Phase 1 和 Phase 2
2. 完成 US1，先打通企业微信与 Web 的自然语言问数主链路
3. 按 `specs/001-crm-intelligent-analytics/quickstart.md` 验证 US1 的独立可用性
4. 再进入 US2，补齐结果展示与查询复用能力
5. 最后完成 US3 与 US4，补齐安全边界和治理闭环

### Incremental Delivery

1. Setup + Foundational 完成后，先交付 US1 形成双入口 AI 问数 MVP
2. 紧接着交付 US2，补齐结构化结果展示、常用查询和最近查询，形成可内测版本
3. 再交付 US3，补齐权限隔离、一致性校验和稳定性治理
4. 最后交付 US4，开放受限导出、治理与审计后台
5. 完成 Polish，统一性能、日志、安全与文档

### Parallel Team Strategy

1. 全员先完成 Setup 与 Foundational
2. 基础能力完成后：
   - 开发 A：US1 双入口问数主链路与补问体验
   - 开发 B：US2 结果展示、常用查询和最近查询
   - 开发 C：US3 权限范围、安全校验与会话稳定性
   - 开发 D：US4 治理后台、导出和审计检索

---

## Notes

- 只有带 `[P]` 的任务才适合并行执行
- 只有用户故事阶段任务带 `[USx]` 标签
- 每条任务都包含明确文件路径，适合直接交给实现代理执行
- 关键链路自动化验证已显式进入任务清单，不再与实施计划中的测试承诺冲突

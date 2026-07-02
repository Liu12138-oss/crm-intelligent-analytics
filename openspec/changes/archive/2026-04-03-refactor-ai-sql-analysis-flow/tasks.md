## 1. 后端分析编排重构

- [x] 1.1 扩展 `backend/src/shared/types/domain.ts`，新增分析工作流计划、查询任务、统一数据集、报告载荷与渠道输出所需类型
- [x] 1.2 新建 `backend/src/modules/analysis/analysis-query-planner.service.ts`，并调整 `analysis-intent.service.ts` 使其能够产出单任务或多任务分析计划
- [x] 1.3 重构 `backend/src/modules/analysis/query-compiler.service.ts`，让其支持按任务编译多条受控只读 SQL，并限制单次分析的查询任务数量
- [x] 1.4 新建查询执行与数据组装服务，将多条 SQL 执行结果整理为统一数据集，并保留任务用途与数据来源标识
- [x] 1.5 新建报告生成服务，并重构 `backend/src/modules/analysis/analysis.service.ts` 使其通过统一编排器串起“理解 -> 查询 -> 汇总 -> 报告”主链路

## 2. 校验、一致性与渠道输出

- [x] 2.1 调整白名单、风险拦截、AST 校验和预检服务，使其对每条查询任务分别生效，并在任一任务失败时阻断整次分析
- [x] 2.2 扩展结果一致性与关键指标回算逻辑，确保摘要、关键发现、图表、表格和导出都引用同一份统一数据集
- [x] 2.3 重写 `backend/src/modules/analysis/result-streamer.service.ts`，细化工作流阶段输出，覆盖规划、执行、汇总、校验和完成状态
- [x] 2.4 增加统一报告结果到 Web / 企业微信输出的适配层，并通过 `analysis-response.mapper.ts` 保持当前接口的兼容过渡
- [x] 2.5 盘点并移除已被新流程覆盖的旧分析分支、样例结果拼装逻辑和与主链路不一致的冗余代码

## 3. 前端工作台与交互体验改版

- [x] 3.1 扩展 `frontend/src/types/analysis.ts` 与 `frontend/src/services/analysis.service.ts`，接入统一报告结果模型与渠道兼容字段
- [x] 3.2 重构 `frontend/src/stores/analysis-query.store.ts`，将页面状态收敛为 `idle`、`clarifying`、`running`、`reported`、`blocked`、`failed` 等明确状态
- [x] 3.3 重构 `frontend/src/pages/analysis/AnalysisWorkbenchPage.vue` 与相关分析组件，让输入区、报告区、过程反馈区和查询资产区符合新主次结构
- [x] 3.4 为按钮、模板项、最近查询项、导出入口和过程提示补齐悬浮、禁用、加载、成功、失败、空态与轻量动效反馈
- [x] 3.5 调整常用查询、最近查询、补问区和报告细节展示，使其支持就近复用、失败重试和过程回看

## 4. 验证、清理与回归

- [x] 4.1 补充后端单元与集成测试，覆盖多任务规划、多条 SQL 编译执行、非法任务阻断、统一数据集组装和报告生成场景
- [x] 4.2 补充后端一致性测试，覆盖关键指标回算失败、数据来源不一致、低置信度拒答和渠道输出一致性场景
- [x] 4.3 更新前端单元与 E2E 测试，覆盖报告优先布局、过程反馈、查询资产复用、悬浮禁用态和失败重试场景
- [x] 4.4 对照 `.pen` 原型、UI 规范和一期主规格执行手工回归，确认一级分区未破坏且交互反馈符合新增协作规约
- [x] 4.5 删除最终确认无调用的旧代码与样例分支后，再执行一次全量构建、测试和关键页面回归检查

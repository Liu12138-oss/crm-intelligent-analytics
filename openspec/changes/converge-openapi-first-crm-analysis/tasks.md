## 1. 统一业务语义入口

- [x] 1.1 改造 `AnalysisIntentService`，正式自由问数只调用宽业务意图解析并映射为统一 `AnalysisIntent`
- [x] 1.2 移除正式主链对 `analysis-intent-pack` 窄业务解析和本地 CRM 只读词表可执行兜底的调用
- [x] 1.3 为业务语义解析失败补安全阻断文案和审计快照，确保不会继续生成可执行旧意图

## 2. OpenAPI-only 执行路由

- [x] 2.1 改造 `AnalysisWorkflowOrchestrator`，正式主链默认跳过 SQLite / MySQL 分析库执行器
- [x] 2.2 改造 `AnalysisReadToolRegistryService`，未命中 OpenAPI 适配器时返回能力缺口，不自动路由受控 SQL
- [x] 2.3 确保缺口进入用户可读阻断结果，并记录 OpenAPI 优先来源、缺口原因和权限快照

## 3. 主题默认口径与真实明细

- [x] 3.1 校验商机、渠道商、客户报备、订单四类默认问法均落到 OpenAPI 可执行任务或明确 OpenAPI 缺口
- [x] 3.2 校验综合经营问题不会再被压成单一合同转化或订单贡献报告
- [x] 3.3 保证正式结果中不展示 SQLite 脱敏样例名或占位明细

## 4. 回归测试与验证

- [x] 4.1 补充意图解析回归测试，覆盖宽业务成功、宽业务失败阻断、窄业务不再被调用、本地兜底不再生成可执行意图
- [x] 4.2 补充执行路由回归测试，覆盖分析库默认不执行、未命中 OpenAPI 时不走 SQL 兜底
- [x] 4.3 跑后端目标单测、构建和 OpenSpec 严格校验，输出需要联软补充的 OpenAPI 能力清单

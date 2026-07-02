## Why

当前 AI 智能分析实现仍然混杂了规则识别、样例数据回填、页面平铺展示等多条支线，没有真正围绕“自然语言转受控 SQL，执行一到多次查询，再由 AI 基于真实结果产出分析报告”这一主链路收敛。若继续在现有链路上叠加功能，会同时放大结果不可信、前后端职责发散以及企业微信复用困难的问题，因此需要先重构规格，把核心能力和非目标能力切清楚。

## What Changes

- 将智能分析主流程重定义为“自然语言理解 -> 受控查询计划 -> 一次或多次只读 SQL 执行 -> 数据汇总 -> AI 生成分析报告”，禁止偏离该主链路的无关处理分支继续扩张。
- 要求 Web 工作台与后续企业微信机器人共用同一套分析编排能力，只允许在输入适配和结果呈现层做渠道差异化。
- 要求分析结果以报告为中心输出，支持文字结论、关键数值、图表、表格等组合形态，但所有内容必须来自同一批受控查询结果。
- 明确需要清理当前前后端中与主目标不一致、无法支撑真实 SQL 查询分析、仅为过渡演示存在或重复表达的功能与代码路径。
- 调整工作台交互重点，突出输入反馈、执行进度、成功失败提示、空结果说明和最终报告展示，而不是保留分散注意力的次要模块。

## Capabilities

### New Capabilities

- `ai-sql-analysis-orchestration`: 定义自然语言到多次只读 SQL 执行，再到统一数据集与 AI 分析报告生成的后端编排能力。
- `analysis-report-workbench`: 定义 Web 工作台与企业微信复用的分析报告输出、进度反馈、异常提示和结果展示要求。

### Modified Capabilities

- 无

## Impact

- 影响后端分析模块：`backend/src/modules/analysis/*` 中的语义识别、查询计划构建、SQL 编译、执行编排、结果汇总和报告输出逻辑。
- 影响前端工作台：`frontend/src/pages/analysis/AnalysisWorkbenchPage.vue`、`frontend/src/components/analysis/*`、`frontend/src/stores/analysis-query.store.ts`、`frontend/src/services/analysis.service.ts`。
- 影响后续企业微信接入：Web 与企业微信都要对接统一的分析编排结果结构，而不是各自维护独立逻辑。
- 影响测试与验收：需要补齐多次查询编排、受控 SQL 执行、报告生成一致性、前端反馈体验和无关功能清理后的回归测试。

## Why

在新的 `unify-ai-first-entry-orchestration` 总提案下，分析编排不再只是“给现有 orchestrator 多加一个模式标签”，而必须成为统一 AI 入口理解层路由后的受控执行主链。当前代码已经补出执行快照、结果包和展示基础，但 `GUARDED_DIRECT_QUERY` 仍未真正落成“AI 生成受控读取意图并进入安全栈”的形态，必须回收错误完成状态。

## What Changes

- 基于统一 AI 入口理解层重做问数入口，让服务端根据 AI 理解结果决定是结果复用、计划执行、受控 AI 直查还是阻断，而不是主要依赖客户端模式标签。
- 将 `GUARDED_DIRECT_QUERY` 落成真正的 AI 驱动读取模式：AI 生成受控读取意图、受控查询或受控工具调用，再进入现有安全栈与 API-first 路由。
- 将 grounded explanation 和建议下一步问题切换为 AI 基于当前结果包生成，现有模板 explanation 退为 fallback。
- 保留当前已补齐的结果快照、执行来源、结果详情展示和渠道裁剪基础设施，但不再把这些基础设施等同于“AI 直查已完成”。

## Capabilities

### New Capabilities

- `controlled-analysis-orchestration`: 定义统一 AI 理解层路由后的受控读取执行、最小纠错与解释 / 改条件追问分流。
- `structured-analysis-result-delivery`: 定义同源结果包、grounded AI 洞察主链、fallback 策略与跨渠道一致交付。

### Modified Capabilities

- `crm-api-first-integration`: 在统一 AI 理解层之后继续执行 API-first 与受控只读兜底，不接受客户端直接绕过服务端路由。

## Impact

- 影响后端 `backend/src/modules/analysis`、`backend/src/modules/query-assets`、`backend/src/modules/export`、`backend/src/modules/audit` 和部分企业微信结果解释链路。
- 影响前端工作台与企业微信结果适配层，需要从“静态 explanation”切换为“AI 主链 explanation + fallback 标识”。
- 影响当前任务状态：已有执行快照、展示字段和安全栈可保留，但 `GUARDED_DIRECT_QUERY` 与 grounded explanation 仍需继续实现，不能再标记为已完成。
- 依赖 `unify-ai-first-entry-orchestration` 作为统一入口理解边界，本变更不再单独定义入口语义分类协议。

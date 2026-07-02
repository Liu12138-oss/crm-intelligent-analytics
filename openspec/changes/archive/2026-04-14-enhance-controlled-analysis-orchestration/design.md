## Context

分析编排是统一 AI 入口理解层后的核心执行程序。它负责把用户的分析意图、安全边界、API-first 路由、只读 SQL 兜底、结果包组装和渠道裁剪串成一个可审计闭环。

当前已有基础包括：

- 执行模式字段与结果详情展示；
- `executionSnapshot`、`resultBundleSnapshot`、`insightSnapshot`、`deliverySnapshot`；
- 风险拦截、字段白名单、预检和 API-first 静态路由；
- Web 与企业微信共享的结果包展示基础。

但当前仍存在两个核心缺口：

- `GUARDED_DIRECT_QUERY` 还没有真正由 AI 驱动读取意图与查询生成；
- grounded explanation 与建议下一步问题仍主要是模板文案，不是 AI 主链。

## Goals / Non-Goals

**Goals：**

- 让分析入口消费统一 AI 理解层结果，而不是继续让客户端主导执行模式。
- 将 `GUARDED_DIRECT_QUERY` 变成真正的 AI 驱动只读执行模式。
- 将 explanation 和建议下一步问题切换为 AI 基于结果包生成。
- 保留现有安全栈、结果包和审计快照基础设施。

**Non-Goals：**

- 不放开任何绕过 API-first、白名单、权限和审计的读取路径。
- 不在本变更中修改登录、会话与统一鉴权链路。
- 不让 AI 在 explanation 阶段重新取数。

## Decisions

### 决策 1：执行模式由服务端根据统一 AI 理解结果决定

Web 和企业微信提交的分析文本先经过统一 AI 理解层，再由服务端决定进入：

- 结果包解释复用；
- `PLAN_EXECUTION`；
- `GUARDED_DIRECT_QUERY`；
- 阻断或补问。

原因：

- 客户端模式标签只能是偏好，不能是权威路由来源。

### 决策 2：受控 AI 直查必须是真正的 AI 驱动读取，而不是静态计划换标签

`GUARDED_DIRECT_QUERY` 下，AI 负责生成受控读取意图、受控 SQL 或受控工具调用，再进入当前安全栈、API-first 路由和执行器。

原因：

- 否则该模式只是“计划执行的另一种命名”，不符合提案目标。

### 决策 3：Grounded explanation 改为 AI 主链，模板 explanation 退为 fallback

当前结果包与快照继续保留，但 explanation 和建议下一步问题改由 AI 基于结果包、权限摘要和执行快照生成。模板 explanation 只在 AI 不可用时作为 fallback。

原因：

- 当前基础设施已经到位，真正缺的是 AI 洞察主链。

### 决策 4：当前快照和前端展示基础设施保留，不回退

已有快照模型、执行来源字段和结果详情展示继续保留，作为下一阶段 AI 主链落地的可视化和审计基础。

原因：

- 这些基础设施方向正确，不应因为主链未完成而被一起推翻。

## Risks / Trade-offs

- [AI 读取意图生成错误导致执行失败上升] → 保留现有安全栈和有限次最小纠错。
- [前端已展示执行模式，用户可能误以为功能已完整] → 在文档和特性开关里明确当前 AI 主链与 fallback 状态。
- [解释型追问与改条件追问误分流] → 统一由入口 AI 理解层判定，不再由多个局部规则共同决定。

## Migration Plan

1. 先让分析入口改由统一 AI 理解层输出路由结果。
2. 再切换 `GUARDED_DIRECT_QUERY` 的真正执行主链。
3. 最后替换 explanation 和建议下一步问题主链。
4. 若 AI 主链不稳定，保留现有模板 explanation 和计划执行路径作为 fallback。

## Open Questions

- `GUARDED_DIRECT_QUERY` 首版是否直接输出 SQL，还是先输出中间读取 DSL 再编译为 SQL / 工具调用。
- 建议下一步问题是否允许按用户角色做差异化 prompt 收敛。

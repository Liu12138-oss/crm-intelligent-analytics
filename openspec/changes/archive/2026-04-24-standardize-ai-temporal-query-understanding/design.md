## Context

当前自由问数已经朝 Hermes 风格演进，但时间理解仍残留两套旧路径：

- 入口层仍通过 `time-range.util` 等本地规则识别“本月、前三个月、最近四个月”等自然语言时间表达。
- 受控直查和计划执行对时间范围的消费不完全统一，AI 若未输出 `startAt`，程序会尝试用本地词表补齐；本地词表未覆盖时，可能导致缺时间过滤、历史数据混入或误判为补问。

这类问题无法通过继续追加表达词表根治，因为真实用户会持续使用“近 6 月、上季度、去年同期、本财年、从春节后到现在、Q1、近两个自然季度”等自由表达。Hermes 项目的可参考点是：模型负责理解自然语言并生成受控查询；程序只负责只读工具边界、SQL 安全、权限、行数、超时和审计。

本设计在当前项目安全栈基础上落地同一原则：AI 负责时间语义归一，程序负责可执行边界和一致性交付。

## Goals / Non-Goals

**Goals:**

- 建立自由问数统一时间槽 contract，覆盖相对时间、绝对时间、区间时间、粒度和置信度。
- 让 `analysis-intent-pack`、受控直查任务生成和计划执行统一消费同一份时间槽。
- 将本地时间解析从主理解链路降级为测试辅助、兼容迁移或最小安全 fallback，不再通过不断扩词表修问题。
- 支持 AI 生成参数化时间边界或 SQL 内部安全时间表达，并由程序统一校验。
- 保证结果包、Markdown、图表、表格、最近查询和追问复用展示同一份时间口径。

**Non-Goals:**

- 不开放 AI 自由连接数据库、自由写库、自由 schema 探测或绕过白名单执行。
- 不取消 API-first、权限注入、AST 校验、只读校验、预检、行数限制和审计。
- 不要求固定功能入口（日报、创建、跟进、帮助、项目查询）改成自由问数代理。
- 不在本次变更内重做全部 SQL 生成器和全部分析页面视觉。

## Decisions

### 决策 1：新增 `TemporalSlot` 作为自由问数时间 contract

自由问数 AI 输出必须包含结构化时间槽，而不是只返回 `timeRange` 字符串。建议字段：

```ts
interface TemporalSlot {
  rawText: string;
  normalizedLabel: string;
  startAt?: string;
  endAt?: string;
  timezone: 'Asia/Shanghai';
  granularity: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  relativity: 'absolute' | 'relative' | 'mixed';
  inclusivity: {
    start: 'inclusive';
    end: 'exclusive' | 'inclusive';
  };
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  unresolvedReason?: string;
}
```

原因：

- `timeRange: "最近四个月"` 不能表达粒度、时区、闭开区间和解析失败原因。
- 程序需要明确的 `startAt/endAt` 才能参数化注入、校验和审计。
- 对“去年同期”“上季度”这类表达，必须知道 AI 的归一化结果和置信度。

备选方案：

- 继续扩展 `timeRange/startAt` 两字段。问题是表达能力不足，后续仍会补字段。
- 完全让 AI 写 SQL 时间条件，不保留时间槽。问题是入口审计和跨渠道展示缺少稳定口径。

### 决策 2：AI 主链负责时间解析，程序只做确定性校验和最小 fallback

入口理解和受控直查任务生成必须优先使用 AI 输出的 `TemporalSlot`。程序侧只允许执行：

- 校验时间槽是否满足执行要求。
- 对缺失或低置信时间槽发起补问。
- 对过宽时间范围应用系统上限或阻断。
- 将时间槽注入查询参数、执行快照和结果包。
- 在 AI 不可用时进入最小安全 fallback，不再以本地时间词表直接承接主执行。

原因：

- 用户的自然语言时间表达不可穷举。
- 程序适合做确定性边界，不适合做开放语义理解。

备选方案：

- 继续维护本地时间词表作为主链。问题是扩展无止境，且不符合 AI-first 约束。
- AI 低置信时程序强行猜测。问题是容易错误取数，风险高于补问。

### 决策 3：受控直查生成必须以时间槽为输入并输出可审计时间条件

受控直查任务生成器应将 `TemporalSlot` 放入提示上下文和输出 contract。生成任务时可以选择：

- 使用参数化边界：`created_at >= ? AND created_at < ?`。
- 对经批准的相对表达使用数据库安全函数，例如 `DATE_SUB(CURDATE(), INTERVAL 4 MONTH)`，但必须在任务元数据中保留原始 `TemporalSlot`。

执行前程序必须校验：

- 时间字段是否属于该对象允许字段，如商机新增默认 `opportunities.created_at`。
- 时间边界是否与权限和数据白名单兼容。
- 查询是否包含时间过滤，除非用户明确要求全量且权限允许。

原因：

- Hermes 允许模型生成 SQL，但靠只读桥接器和规则约束执行。
- 当前项目还要保留更强的 API-first、权限和审计，因此时间槽必须进入执行快照。

备选方案：

- 只让编译器根据时间槽生成 SQL，不让受控直查生成时间条件。问题是会削弱自由问数覆盖面。
- 只让 AI 写 SQL，不校验时间字段。问题是可能选错口径字段或扩大读取范围。

### 决策 4：结果包必须显式记录 `temporalScope`

统一结果包、Markdown 和企业微信裁剪结果应统一展示同一份时间口径。建议在结果包中增加：

```ts
interface ResultTemporalScope {
  rawText: string;
  normalizedLabel: string;
  startAt?: string;
  endAt?: string;
  granularity: string;
  timezone: string;
  source: 'AI_TEMPORAL_SLOT' | 'USER_EXPLICIT' | 'FALLBACK_CLARIFICATION';
}
```

结果一致性校验应确保：

- 图表、表格、摘要和 Markdown 引用同一 `temporalScope`。
- 最近查询和重跑复用该时间槽，而不是重新解析历史问题文本。
- 改条件追问生成新的时间槽和新的结果包。

原因：

- 之前“图表与明细不一致”和 `2019-01` 问题都与事实口径和展示口径未被统一锁定有关。
- 时间口径是分析结果可解释性的核心事实，应进入结果包而不是只作为 SQL 细节。

备选方案：

- 只在 `appliedFilters` 中展示时间范围。问题是结构太弱，不足以支持重跑、审计和一致性校验。

### 决策 5：回归测试从词表测试改为语义样例测试

测试不再围绕“某个关键词是否命中某个 if 分支”，而应围绕 AI 时间槽和执行结果验证：

- `最近四个月` 输出四个月窗口。
- `前四个月`、`近 4 月`、`过去 6 个月` 输出相应窗口。
- `上季度` 输出上一个自然季度。
- `去年同期` 输出相对当前时间的去年同范围。
- `2026 年一季度` 输出绝对季度。
- 低置信或歧义表达进入补问，不执行查询。

原因：

- 真实质量目标是“语义正确 + 执行安全”，不是“规则命中”。

## Risks / Trade-offs

- [AI 时间槽解析错误] → 增加 schema 校验、置信度、低置信补问和回归样例；关键报表可配置模板优先。
- [受控直查 SQL 生成使用了错误时间字段] → 通过对象到时间字段白名单和执行前校验阻断。
- [相对时间依赖运行日期导致测试不稳定] → 测试注入固定 `now` 和 `timezone`，避免直接依赖机器当前时间。
- [迁移期间 PLAN_EXECUTION 与 GUARDED_DIRECT_QUERY 口径不一致] → 两条链路都必须消费同一个 `TemporalSlot`，并在结果包记录 `temporalScope`。
- [AI 不可用导致问数覆盖下降] → 只允许最小安全 fallback 与补问；可在治理后台记录失败率，必要时临时回退到计划执行但不恢复本地词表主链。

## Migration Plan

1. 扩展 `analysis-intent-pack` 输出 schema，加入 `TemporalSlot`。
2. 将受控直查任务生成、计划执行编译和查询知识层改为消费 `TemporalSlot`。
3. 将 `time-range.util` 降级为测试辅助或兼容迁移工具，移除其在自由问数主执行链路中的兜底职责。
4. 在统一结果包中增加 `temporalScope`，并扩展 Markdown、企业微信、最近查询和重跑使用该字段。
5. 补充语义回归样例和结果一致性测试。
6. 灰度开启后监控 AI 时间槽低置信、补问、阻断和执行失败比例。

回退策略：

- 若 AI 时间槽质量不足，可临时让自由问数回到 `PLAN_EXECUTION`，但仍必须消费同一时间槽 contract。
- 若 `temporalScope` 展示异常，可暂时仅在审计和 applied filters 中展示，保留执行侧时间槽。
- 不建议恢复本地时间词表主链；最多保留极少数安全默认，如“今天/本月”用于 AI 不可用时的补问提示。

## Open Questions

- `endAt` 是否统一采用开区间，历史 API 或 SQL 适配器是否存在必须用闭区间的场景。
- “前三个月”在业务上是否包含当前月，还是完整过去三个自然月，需要由产品口径明确。
- 是否需要在治理后台增加时间槽解析失败和低置信样例的维护入口。

## Why

在新的 `unify-ai-first-entry-orchestration` 总提案下，企业微信不再适合继续以“规则状态机增强”作为主方向，而应成为统一 AI 入口理解层的首个重点落地场景。当前仓库里的企业微信改动已经补出了一批快照、提示和测试基础，但自由文本草稿抽取、候选重排和日报洞察仍大量停留在规则过渡版，必须回收到 fallback 口径。

## What Changes

- 基于统一 AI 入口理解层，重做企业微信跟进、日报、候选选择、帮助、取消、切换任务和草稿确认等场景的入口编排。
- 将跟进自由文本四段草稿抽取改为 AI 主链，现有 `wecom-follow-up-template.helper.ts` 中的规则归类只保留为 fallback 和校验层。
- 将候选实体排序改为“受控召回 + AI 重排 + 用户确认”，当前规则评分仅在 AI 不可用时作为 fallback。
- 将个人日报确认、小组日报预览和团队汇总中的 grounded 摘要 / 主管建议改为 AI 主链，固定模板文案退为 fallback。
- 保留并扩展当前已补齐的会话快照、审计留痕、提示文案和测试样例，但不得再把这些规则过渡实现描述为 AI 主链已完成。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `wecom-follow-up-guided-template`: 跟进主题入口升级为“统一 AI 理解层驱动的自由文本整理 + 结构化草稿确认 + fallback 校验”。
- `wecom-fuzzy-entity-selection`: 候选实体识别升级为“受控召回 + AI 重排 + 用户最终确认”，规则评分退为 fallback。
- `wecom-daily-report-reminder-summary`: 个人日报确认和团队汇总中的摘要与建议升级为 grounded AI 主链，模板拼装退为 fallback。
- `wecom-on-demand-team-daily-report-delivery`: 小组日报预览继续保留聊天预览定位，但主管视角洞察必须由 grounded AI 主链生成。
- `wecom-task-cancel-guidance`: 活跃任务中的取消、切换、帮助、直接提交和继续执行等回复语义改由统一 AI 理解层优先识别。

## Impact

- 影响后端 `backend/src/modules/wecom`、`backend/src/modules/daily-report`、`backend/src/modules/audit`、`backend/src/modules/notifications` 的会话编排、AI 网关调用、摘要生成与留痕逻辑。
- 影响企业微信对话提示、候选确认文案和缺项补充提示，需要把现有文案与统一 AI 路由结果对齐。
- 影响当前变更任务状态：现有规则实现只能视为 fallback 或基础设施，不再等同于 AI 主链完成。
- 依赖 `unify-ai-first-entry-orchestration` 作为统一边界定义，本变更不再单独定义另一套入口理解 contract。

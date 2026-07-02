## ADDED Requirements

### Requirement: 日报摘要与主管建议必须优先使用 grounded AI 生成

系统 MUST 基于当日已验证的 CRM 源数据、结构化跟进字段和成员快照，优先使用统一 AI 理解层或其专用摘要子链路生成个人日报摘要、团队预览摘要和主管建议。系统 MAY 保留固定模板摘要作为 fallback，但在 AI 主链可用时不得继续默认使用模板拼装代替 AI 生成。

#### Scenario: 个人日报确认消息优先使用 grounded AI 摘要
- **WHEN** 系统在 `22:00` 为某用户基于当日源数据生成个人日报确认内容
- **THEN** 系统必须优先使用 grounded AI 生成可读摘要和建议
- **THEN** 系统不得默认只返回按数量和字段拼接的固定模板文案

#### Scenario: 团队预览和主管建议优先使用 grounded AI 生成
- **WHEN** 系统为负责人生成团队汇总或小组日报预览
- **THEN** 系统必须优先使用 grounded AI 输出摘要、阻塞项和关注建议
- **THEN** 系统不得把固定模板拼接结果伪装为 AI 洞察

### Requirement: AI 摘要失败时必须明确回退到模板 fallback

当日报摘要或主管建议的 AI 主链不可用、超时、结构非法或事实不足时，系统 MAY 回退到既有事实模板摘要，但 MUST 明确记录并暴露当前结果来自 fallback，不得将其继续描述为 grounded AI 摘要。

#### Scenario: AI 不可用时回退到事实模板摘要
- **WHEN** 日报摘要 AI 主链不可用或返回非法结构
- **THEN** 系统可以继续返回基于事实的模板摘要
- **THEN** 系统必须明确记录当前摘要来自 fallback，而不是 AI 主链成功

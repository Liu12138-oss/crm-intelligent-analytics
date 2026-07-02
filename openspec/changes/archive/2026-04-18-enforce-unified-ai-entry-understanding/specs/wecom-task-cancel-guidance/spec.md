## ADDED Requirements

### Requirement: 活跃任务短回复必须由 AI 主链识别，执行推进仍走确定性门闩
系统 MUST 将企业微信活跃任务中的取消、切换、继续、修改、确认和未知短回复统一接入 `ai-entry-intent-orchestration`。统一 AI 理解层 MUST 优先识别 `CANCEL`、`TASK_SWITCH`、`CONTINUE`、`MODIFY`、`CONFIRM` 和 `UNKNOWN` 语义；规则关键词与精确确认词表仅可作为 fallback。对会导致正式写回、提交、创建或状态推进的回复，系统 MUST 在 AI 识别后继续通过确定性执行门闩校验当前上下文与权限，不得让短回复直接驱动高风险执行。

#### Scenario: 活跃任务中的确认短句先由 AI 识别
- **WHEN** 用户在活跃任务中回复“好的，继续”“sure”或语义等价的短句
- **THEN** 系统必须先通过统一 AI 理解层识别该回复的语义
- **THEN** 系统不得继续把固定确认词表作为主判断链路

#### Scenario: 活跃任务中的歧义短句不得直接推进执行
- **WHEN** 用户回复“好，但我还想改一下”
- **THEN** 系统必须将该回复识别为修改或继续澄清
- **THEN** 系统不得因为命中“好”而直接推进正式执行

#### Scenario: AI 主链不可用时只允许安全 fallback
- **WHEN** 活跃任务短回复识别的 AI 主链不可用、超时或返回非法结构
- **THEN** 系统可以回退到最小安全 fallback
- **THEN** 系统不得恢复为长期依赖纯关键词确认与切换的主链实现

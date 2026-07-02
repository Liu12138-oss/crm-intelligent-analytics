## ADDED Requirements

### Requirement: 活跃任务回复语义必须通过 capability pack 的最小 contract 与条件校验识别
企业微信活跃任务中的取消、切换、继续、修改、确认和未知短回复 MUST 通过专用 capability pack 识别。该能力包 MUST 使用最小公共 contract 承载 `intent` 等公共字段，并按回复语义对 `target` 或其它场景字段执行条件必填校验；系统 MUST NOT 再将 `target` 等非公共字段定义为所有回复语义的静态必填项。

#### Scenario: TASK_CANCEL 不再因 target 缺失而失败
- **WHEN** 用户在活跃任务中回复取消语义，模型返回 `TASK_CANCEL` 且未返回 `target`
- **THEN** 系统必须将该结果视为合法取消语义
- **THEN** 系统不得因为缺少 `target` 而判定本次活跃任务回复识别失败

#### Scenario: TASK_SWITCH 仍需校验目标任务
- **WHEN** 用户在活跃任务中回复新的明确任务入口，模型返回 `TASK_SWITCH`
- **THEN** 系统必须要求 `target` 满足条件必填
- **THEN** 若 `target` 缺失，系统必须进入最小安全 fallback，而不是伪造任务切换成功

### Requirement: 活跃任务 pack 必须优先理解上下文，不得把长正文和跳过补充语义默认压成短回复规则
企业微信活跃任务回复 pack MUST 优先基于当前任务上下文区分“长正文补充”“确认短句”“跳过可选补充”“取消任务”“切换任务”。对于长正文、字段续填、草稿补充和 `不补充` 这类上下文相关表达，系统 MUST 先通过提示词、few-shot 与负例让模型理解其真实语义，不得继续默认依赖短词规则把它们压成 `CONTINUE_EXECUTION`、`DIRECT_SUBMIT` 或 `TASK_CANCEL`。

#### Scenario: 长正文不得默认压成 CONTINUE_EXECUTION
- **WHEN** 用户在跟进模板或日报整理中发送一整段新的业务正文
- **THEN** 活跃任务 reply pack 必须优先把该消息理解为内容补充或草稿更新
- **THEN** 系统不得因为当前处于活跃任务中就把长正文默认压成 `CONTINUE_EXECUTION`

#### Scenario: 不补充在可选缺项阶段表示继续而不是取消
- **WHEN** 当前草稿只缺可选字段，系统已明确提示“也可以直接提交”，用户回复 `不补充`、`先不补充` 或语义等价表达
- **THEN** 活跃任务 reply pack 必须优先将该回复理解为按当前草稿继续
- **THEN** 系统不得把该回复默认视为取消任务

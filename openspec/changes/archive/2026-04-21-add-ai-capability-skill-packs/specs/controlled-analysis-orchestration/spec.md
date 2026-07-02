## ADDED Requirements

### Requirement: 受控分析编排必须消费 analysis intent 与 follow-up capability pack 结果
Web 智能分析工作台和企业微信分析入口 MUST 通过 `analysis-intent-pack` 与 `analysis-follow-up-pack` 消费统一 AI capability pack 的归一化结果，再决定进入计划执行、受控直查、解释复用、补问澄清或阻断路径。业务服务 MUST 不再直接内联问数入口 prompt、few-shot 和 provider 差异。

#### Scenario: 首次问数通过 analysis intent pack 决定执行路径
- **WHEN** 用户提交新的经营分析问题
- **THEN** 系统必须先通过 `analysis-intent-pack` 输出的归一化结果决定进入计划执行、受控直查、补问或阻断
- **THEN** 系统不得继续在分析入口服务中直接拼装完整 prompt

#### Scenario: 解释追问与改条件追问通过 follow-up pack 分流
- **WHEN** 用户在已有结果后继续追问“这说明什么”或“近三个月也看看”
- **THEN** 系统必须先通过 `analysis-follow-up-pack` 识别该输入属于解释型追问还是改条件追问
- **THEN** 系统不得继续分别在多个调用点硬编码这两类追问的分类逻辑

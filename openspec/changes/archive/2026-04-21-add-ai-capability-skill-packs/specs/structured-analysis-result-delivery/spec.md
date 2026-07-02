## ADDED Requirements

### Requirement: grounded 洞察生成必须通过 capability pack 运行时执行
系统生成 grounded explanation、建议下一步问题或等价结果说明时 MUST 通过 `grounded-explanation-pack` 或等价 capability pack 运行时执行。该 capability pack MUST 提供版本化提示词、provider tuning、最小输出 contract 和 fallback 语义；结果交付链路 MUST 记录本次 grounded 生成使用的 `packCode`、`packVersion` 与失败原因。

#### Scenario: grounded explanation 通过 capability pack 生成
- **WHEN** 一条分析结果需要生成 grounded explanation 或建议下一步问题
- **THEN** 系统必须通过 grounded capability pack 运行时生成相应文案
- **THEN** 业务服务不得继续在结果交付服务中直接维护完整 grounded prompt

#### Scenario: grounded fallback 保留 pack 元信息
- **WHEN** grounded capability pack 因 provider 错误、超时、校验失败或显式禁用而进入模板 fallback
- **THEN** 系统必须记录对应的 `packCode`、`packVersion`、`fallbackReason` 和失败类别
- **THEN** 结果交付侧不得把该场景描述为 grounded AI 主链成功

## ADDED Requirements

### Requirement: 系统必须为环境默认 AI 档案补齐缺省推理等级
系统 MUST 在引导环境默认 AI 档案时补齐 `reasoningEffort`。当本地环境配置未显式提供推理等级时，系统 MUST 为环境默认 Codex / Claude 档案写入最低推理等级，避免环境默认档案在治理页面和运行时解析中继续以空值存在。

#### Scenario: 系统发现未声明推理等级的 Codex 环境配置
- **WHEN** 系统读取到完整的 Codex 环境配置，但未读取到显式推理等级
- **THEN** 系统自动创建的环境默认 Codex 档案必须写入最低推理等级
- **THEN** 该档案在治理页面中必须展示该默认值

#### Scenario: 系统发现未声明推理等级的 Claude 环境配置
- **WHEN** 系统读取到可引导的 Claude 环境配置，但未读取到显式推理等级
- **THEN** 系统自动创建的环境默认 Claude 档案必须写入最低推理等级
- **THEN** 管理员后续打开该档案进行编辑时必须看到该默认值，而不是空白

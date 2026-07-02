## ADDED Requirements

### Requirement: OpenAI 兼容 HTTP 运行时必须支持 capability 级请求覆盖
OpenAI 兼容 HTTP 运行时 MUST 支持由应用层 capability pack 声明少量受控请求覆盖项，并在文本调用与结构化调用中统一透传。该覆盖项 MUST 仅允许使用白名单字段表达 provider/model 专用参数、结构化输出策略或 provider 特化默认值；运行时 MUST NOT 允许业务侧任意透传原始请求体。

#### Scenario: capability pack 为 Chat Completions 注入受控参数
- **WHEN** 某个 capability pack 在 Chat Completions 协议下声明了受控 provider 请求参数
- **THEN** 系统必须在对应的 HTTP 请求体中透传这些覆盖项
- **THEN** 该透传过程不得要求业务服务直接改写 adapter 内部实现

#### Scenario: 未声明覆盖项时保持默认请求体
- **WHEN** 当前 capability pack 没有声明任何 provider 请求覆盖
- **THEN** 系统必须继续沿用现有默认请求体构造方式
- **THEN** 不得因为 capability runtime 引入而改变其它能力的既有请求行为

#### Scenario: 未登记覆盖项被拒绝
- **WHEN** 某个 capability pack 试图声明白名单之外的 provider 请求覆盖字段
- **THEN** 系统必须拒绝透传该覆盖项
- **THEN** adapter 必须留下明确日志或错误原因，而不是静默把原始请求体直接放行

### Requirement: provider 特化默认值必须可由 capability pack 显式覆盖
对于 `enable_thinking`、`response_format`、provider 专用 few-shot 或其它已批准的兼容参数，系统 MUST 允许 capability pack 显式覆盖默认值。若 capability pack 未声明显式覆盖，则运行时 MAY 继续使用现有 provider 默认逻辑。

#### Scenario: capability pack 覆盖 Qwen 入口分类默认参数
- **WHEN** 企业微信入口分类 capability pack 为 Qwen 模型声明了特化默认值
- **THEN** 系统必须优先使用 capability pack 声明的 provider 参数
- **THEN** 现有 adapter 的 provider 默认逻辑只能作为未声明时的兜底

#### Scenario: capability pack 可显式切换结构化输出策略
- **WHEN** 某个 capability pack 因 provider 差异需要在 `json_schema`、`json_object` 或等价受控结构化策略之间切换
- **THEN** 系统必须允许该切换以白名单方式表达
- **THEN** 业务服务不得为此直接拼装 provider 原始请求体

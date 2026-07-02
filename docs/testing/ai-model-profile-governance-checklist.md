# AI 模型治理验证与排障清单

## 1. 验证清单

### 1.1 后台治理页

- 能看到 `AI 模型` 导航入口。
- 非管理员不能进入该页面。
- 可新增 `OpenAI 兼容 HTTP` Profile。
- 可选择内部 OpenAI 兼容网关、Qwen、DeepSeek、GLM 和手动配置平台预设。
- 可配置协议类型、结构化输出模式、推理等级、超时时间、禁用响应存储和代理环境变量。
- 新建 HTTP Profile 时不要求本地 CLI、MCP、权限模式或工具白名单字段。
- 列表、详情和审计中均不回显真实密钥。
- “清空已保存密钥”后状态变为“未配置”。

### 1.2 健康检查

- OpenAI 兼容 HTTP Profile 点击测试后会发起服务端真实 HTTP smoke test。
- `responses + json_schema` 模式可返回 `SUCCEEDED`。
- `chat_completions + json_object` 模式可返回 `SUCCEEDED`。
- 上游返回非 2xx、响应无法解析或结构化结果不满足 schema 时，测试结果返回 `FAILED`。
- 失败原因不得包含真实密钥、完整 `Authorization` 头、合同正文或超长 CRM 结果包。
- 健康检查结果会更新到列表状态中。

### 1.3 激活与回滚

- 未测试通过的 Profile 不能激活。
- 激活新 Profile 后，摘要区会更新“当前激活配置”。
- 切换后再次验证失败时，会自动回滚到上一条激活 Profile。
- 审计中能查到创建、更新、测试、激活、回滚事件。

### 1.4 链路验证

- Web 智能分析会读取当前激活 HTTP Profile。
- 企业微信 AI 理解会读取当前激活 HTTP Profile，并继续使用应用层工作记忆。
- 合同审核 AI 审查会读取当前激活 HTTP Profile，并按检查组独立传入合同片段、事实摘要和规则项。

## 2. 常见问题与排查

### 2.1 切换后没有生效

优先检查：

- 当前 Profile 是否真的显示为“当前生效”。
- 当前 Profile 最近一次测试是否为 `SUCCEEDED`。
- 审计里是否存在“激活成功”事件。
- 当前请求是否命中了后台激活 Profile，而不是环境默认配置。

### 2.2 HTTP 测试失败

优先检查：

- `baseUrl` 是否为后端服务器可访问的模型网关地址。
- `model` 是否为该网关支持的模型 ID。
- 密钥是否有效，且没有写入 URL、日志或截图。
- `wireApi` 是否与网关兼容：Responses 选 `responses`，旧兼容平台选 `chat_completions`。
- `structuredOutputMode` 是否与平台能力匹配：完整 JSON Schema 选 `json_schema`，仅 JSON mode 选 `json_object`，仅提示词约束选 `prompt_schema`。
- 代理环境变量是否配置错误导致请求不可达。

### 2.3 结构化结果失败

优先检查：

- 模型返回是否为纯 JSON，而不是 Markdown 或解释文本。
- 必填字段是否缺失。
- 枚举值是否超出 schema 允许范围。
- 数组与对象结构是否符合调用方 schema。

### 2.4 密钥显示异常

正常行为应为：

- 列表和详情只显示“已配置 / 未配置”。
- 接口响应、审计和日志不出现任何明文密钥。
- 若出现明文，视为高优先级缺陷，应立即停止使用该页面并回滚。

## 3. 审计检索建议

建议在审计中心按以下关键词或维度检索：

- Profile 创建人。
- Profile 名称。
- Provider 标识。
- 激活时间段。
- 测试失败时间段。
- `failureReason`。
- `HTTP_REQUEST`。
- `HTTP_STATUS`。
- `RESPONSE_PARSE`。
- `SCHEMA_VALIDATION`。

通过这些字段可快速定位配置错误、网关不可达、上游协议不兼容或结构化输出不符合 schema 的问题。

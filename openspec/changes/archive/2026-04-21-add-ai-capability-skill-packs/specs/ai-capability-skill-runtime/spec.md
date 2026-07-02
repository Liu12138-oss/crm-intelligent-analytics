## ADDED Requirements

### Requirement: 系统必须提供应用层 AI capability pack 运行时
系统 MUST 提供应用层 `AI capability pack` 运行时，用于统一装载企业微信入口分类、活跃任务回复分类、分析意图识别、追问分流和 grounded 文案生成等通用 AI 能力。每个 capability pack MUST 至少声明 `packCode`、`packVersion`、提示词构造逻辑、最小输出 contract、归一化逻辑、条件校验逻辑和 provider 定制配置；业务服务 MUST 通过 pack 运行时调用模型，不得继续在业务服务中各自堆叠完整 prompt、few-shot、schema 和 provider 适配。

#### Scenario: 按 packCode 装载企业微信入口分类能力包
- **WHEN** 企业微信空闲态入口分类请求进入统一 AI 理解层
- **THEN** 系统必须按预定义 `packCode` 装载对应 capability pack
- **THEN** 该 pack 必须负责提供本次分类所需的提示词、最小输出 contract 和条件校验规则

#### Scenario: capability pack 版本进入运行时记录
- **WHEN** 任一 capability pack 完成一次模型调用
- **THEN** 系统必须记录本次调用对应的 `packCode` 和 `packVersion`
- **THEN** 后续日志、审计或调试信息必须能够追溯该调用使用了哪个能力包版本

### Requirement: capability pack 必须来自代码托管 registry，禁止动态加载未注册能力包
系统 MUST 只允许从仓库内已注册、已版本化的 capability pack registry 加载能力包。capability pack 的 `packCode`、`packVersion`、few-shot、provider tuning 和最小 contract MUST 进入代码评审与发布流程；系统 MUST NOT 从数据库、远端配置中心或环境变量大段文本动态加载未注册 pack 并直接生效。

#### Scenario: 运行时只加载 registry 中登记的 pack
- **WHEN** 业务服务请求执行某个 `packCode`
- **THEN** 系统必须仅从本地 registry 中装载对应 capability pack
- **THEN** 若该 `packCode` 未登记，系统必须返回明确失败原因，而不是隐式回退到一段散落 prompt

#### Scenario: 未注册 pack 不得通过远端配置直接启用
- **WHEN** 运维或开发尝试通过环境变量或外部配置注入一份未注册的 capability pack
- **THEN** 系统必须拒绝将该 pack 作为正式运行时能力启用
- **THEN** 提示词、few-shot 和 provider tuning 仍必须通过代码变更进入发布链路

### Requirement: capability pack 运行时必须执行归一化与条件校验
系统 MUST 在模型返回结构化结果后，先执行 capability pack 的归一化逻辑，再执行 capability pack 的条件校验逻辑。条件校验 MUST 允许能力包仅对与当前意图相关的字段声明必填要求；系统 MUST NOT 再依赖“所有场景字段静态全量 required”的方式判断结构合法性。若归一化或条件校验失败，系统 MUST 返回明确的 `validationFailureReason`，并交由上层进入既有最小安全 fallback。

#### Scenario: 稀疏 JSON 经过归一化后通过校验
- **WHEN** 模型对企业微信入口分类返回仅包含当前意图相关字段的稀疏 JSON
- **THEN** 系统必须先执行 capability pack 归一化与条件校验
- **THEN** 只要当前意图所需字段齐全，系统就不得因为无关字段缺失而判定本次调用失败

#### Scenario: 条件必填字段缺失时进入最小安全 fallback
- **WHEN** 模型返回的结构中缺少当前意图实际所需的关键字段
- **THEN** capability pack 必须返回明确的条件校验失败原因
- **THEN** 上层系统必须进入最小安全 fallback，而不是继续伪造主链路成功

### Requirement: capability pack 运行时必须支持 pack 级启停与失败分类
系统 MUST 支持按 `packCode` 或等价场景维度关闭单个 capability pack，并保留既有最小安全 fallback。runtime MUST 对 pack 运行失败进行显式分类，至少覆盖 `PACK_DISABLED`、`PACK_NONE`、`PACK_VALIDATION_FAILED`、`PROVIDER_ERROR`、`PROVIDER_TIMEOUT`；这些失败类别 MUST 可被上层日志、审计和 fallback 路由消费。

#### Scenario: 单个 pack 被关闭时进入最小安全 fallback
- **WHEN** 某个 capability pack 被运维或灰度策略按 `packCode` 关闭
- **THEN** 只有该 pack 对应的入口必须回退到既有最小安全 fallback
- **THEN** 其它未关闭的 capability pack 不得被连带停用

#### Scenario: pack 失败类别进入审计与日志
- **WHEN** 任一 capability pack 因 provider 超时、校验失败或显式禁用而未返回主链成功结果
- **THEN** 系统必须记录明确的 pack 失败类别
- **THEN** 上层系统不得只留下模糊的“AI 失败”或“schema 错误”描述

### Requirement: capability pack 必须支持 provider 定制参数与示例
系统 MUST 允许 capability pack 为不同 provider/model 声明少量受控定制参数、few-shot 示例和结构化输出策略。provider 定制 MUST 通过受控白名单字段表达，并由统一运行时或 HTTP adapter 透传给模型请求；业务服务 MUST NOT 直接拼装 provider 专用请求体细节。

#### Scenario: Qwen pack 使用 provider 定制示例与请求参数
- **WHEN** 当前 capability pack 运行在 Qwen 模型上
- **THEN** 系统必须允许该 pack 注入 Qwen 专用 few-shot 和受控请求参数
- **THEN** 业务服务不得因为 provider 变更而复制一套新的入口分类实现

### Requirement: capability pack 必须优先通过提示词、few-shot 与负例优化解决语义理解问题
对于上下文理解、短回复语义识别、字段抽取、缺项提示内容和可选字段跳过等自然语言理解问题，系统 MUST 优先在 capability pack 内通过系统提示词、few-shot、负例样例和最小 contract 调整解决。业务服务 MUST NOT 在未先优化 pack 的前提下，直接通过新增关键词表、状态分支或模糊字符串判断承担主要语义修复。

#### Scenario: 长正文误判先回到 pack 提示词优化
- **WHEN** 企业微信活跃任务中的长正文被误判成确认短句或继续执行语义
- **THEN** 系统必须先通过对应 capability pack 的提示词、few-shot 和负例样例修正该问题
- **THEN** 程序层只允许保留安全边界与状态门闩相关的最小兜底

#### Scenario: 可选缺项跳过语义先回到 pack 提示词优化
- **WHEN** 用户回复 `不补充`、`先不补充` 或语义等价表达时，需要基于当前上下文判断是“继续”还是“取消”
- **THEN** 系统必须先通过 capability pack 的上下文提示和 few-shot 让模型理解该语义
- **THEN** 程序层不得继续默认把这类表达一律当成取消

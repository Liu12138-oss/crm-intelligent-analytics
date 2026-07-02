# ai-model-profile-governance Specification

## Purpose
TBD - created by archiving change add-ai-model-profile-governance. Update Purpose after archive.
## Requirements
### Requirement: 系统必须支持多 Provider / 多 Profile 的 AI 配置治理目录
系统 MUST 提供可持久化的 AI 模型 Profile 目录，允许管理员维护多条可复用配置。每条 Profile MUST 至少包含名称、Provider 标识、平台预设、接入类型、模型名、基础接入地址、鉴权方式、协议类型、结构化输出模式、启停状态以及全系统运行时所需的关键参数；系统 MUST 支持新增、编辑、复制和停用 Profile，并保证 Profile 标识唯一、名称可读且可区分。接入类型 MUST 能区分 OpenAI 兼容 HTTP 运行时与历史 Agent SDK 运行时，且业务调用 MUST 只通过统一执行门面消费当前激活 Profile。

#### Scenario: 管理员新增一条 OpenAI 兼容 HTTP Profile
- **WHEN** 管理员在治理后台提交一条新的 OpenAI 兼容 HTTP Profile，且必填字段完整
- **THEN** 系统必须持久化该 Profile，并在治理列表中展示其 Provider、模型名、接入类型、启停状态和是否已配置密钥

#### Scenario: 管理员复制现有 Profile 作为新配置
- **WHEN** 管理员选择复制一条现有 Profile
- **THEN** 系统必须基于原 Profile 生成一条新的可编辑 Profile
- **THEN** 新 Profile 不得沿用原 Profile 的唯一标识与激活状态
- **THEN** 若原 Profile 属于历史 Agent SDK 类型，复制后的配置必须明确提示需要转换并重新测试后才可激活

### Requirement: 系统必须以全局唯一激活 Profile 解析 AI 运行时配置
系统 MUST 保证任一时刻最多只有一条后台 Profile 处于“全系统激活”状态。企业微信 AI 理解、Web 智能分析和合同审核 AI 编排 MUST 统一从当前激活 Profile 解析运行时配置，并在切换成功后于下一次请求生效；当后台不存在激活 Profile 时，系统 MUST 回退到现有环境变量 / 本地配置文件提供的默认 AI 配置。若激活 Profile 或环境默认配置缺少显式推理等级，系统 MUST 按最低推理等级解析，而不是继续依赖调用链各自的隐式回退值。

#### Scenario: 激活新 Profile 后全系统统一生效
- **WHEN** 管理员将一条已启用且校验通过的 Profile 设为当前激活配置
- **THEN** 系统必须取消原激活 Profile 的激活状态
- **THEN** 企业微信、智能分析和合同审核后续请求必须统一读取新激活 Profile

#### Scenario: 后台没有激活 Profile 时回退环境默认配置
- **WHEN** 后台尚未配置任何激活 Profile，或当前激活 Profile 被移除
- **THEN** 系统必须回退到现有 `ANALYSIS_AI_*` 与相关本地配置文件解析出的默认 AI 配置
- **THEN** 不得因为后台治理目录为空而直接使现有 AI 链路失效

#### Scenario: 激活 Profile 缺少显式推理等级
- **WHEN** 当前激活的 Profile 历史上未配置 `reasoningEffort`
- **THEN** 系统必须按最低推理等级解析当前运行时配置
- **THEN** 不得继续按不同业务链路各自的隐式默认值执行

### Requirement: 系统必须保护密钥字段且禁止明文回显
系统 MUST 允许管理员录入和更新 AI Profile 的真实密钥，但 MUST 在服务端安全存储该密钥，并在任何列表接口、详情接口、页面回显、日志与审计结果中禁止返回明文。系统 MUST 支持“留空不修改密钥”“显式输入覆盖密钥”和“显式清空密钥”三种更新动作，且后续读取仅返回“是否已配置”和掩码状态。

#### Scenario: Profile 列表与详情不返回真实密钥
- **WHEN** 管理员打开 AI 模型治理列表或 Profile 详情
- **THEN** 系统返回的字段中不得包含真实密钥值
- **THEN** 页面只可展示“已配置 / 未配置”或等价掩码信息

#### Scenario: 编辑 Profile 且未输入新密钥时保留旧密钥
- **WHEN** 管理员更新一条已配置密钥的 Profile，但密钥输入框保持为空
- **THEN** 系统必须保留原有密钥不变
- **THEN** 不得因空值提交而把原密钥清空

#### Scenario: 管理员显式清空密钥
- **WHEN** 管理员在编辑 Profile 时执行“清空密钥”动作
- **THEN** 系统必须删除该 Profile 已存密钥
- **THEN** 后续读取仍不得返回历史明文，只能返回未配置状态

### Requirement: 系统必须提供管理员专用的 AI 模型治理页面
系统 MUST 在 Web 治理后台提供独立的 AI 模型治理页面，并作为现有治理导航的新入口。该页面 MUST 支持查看当前激活配置、浏览 Profile 列表、执行新增编辑、复制、测试连接、启停与激活动作。系统 MUST 仅允许具备 `ai_profile.manage` 动作的用户访问该页面及相关接口；未被授予该动作的用户 MUST 被阻断。系统 MUST 不得继续仅凭 `isAdmin` 或角色名称包含“管理员”放行 AI 模型治理能力。

#### Scenario: 被授予 ai_profile.manage 的非管理员用户可以进入治理页
- **WHEN** 某个业务管理角色未被标记为管理员，但被显式授予 `ai_profile.manage`
- **THEN** 系统必须允许其访问 AI 模型治理页面和相关接口
- **THEN** 该用户必须可以查看当前激活配置、浏览列表并执行被授权的治理动作

#### Scenario: 历史管理员未授予 ai_profile.manage 时被阻断
- **WHEN** 某个历史管理员用户未在当前权限矩阵中被授予 `ai_profile.manage`，并尝试访问 AI 模型治理页面或调用对应接口
- **THEN** 系统必须拒绝访问
- **THEN** 不得仅凭管理员身份或角色名称自动放行

### Requirement: 系统必须在保存与激活前执行配置校验和连通性测试
系统 MUST 在 Profile 保存前执行静态字段校验，并在管理员显式发起测试或准备激活时执行服务端连通性校验。测试结果 MUST 返回成功 / 失败状态、测试时间、耗时和失败原因摘要。系统 MUST 阻止激活未通过必填校验或最近一次测试失败的 Profile。

#### Scenario: 管理员测试 Profile 连通性成功
- **WHEN** 管理员对一条合法 Profile 发起连接测试，且目标模型服务可访问
- **THEN** 系统必须记录该 Profile 最近一次测试成功时间和耗时
- **THEN** 页面必须展示成功反馈

#### Scenario: 测试失败的 Profile 不能被激活
- **WHEN** 管理员尝试激活一条最近一次测试失败或必填字段不完整的 Profile
- **THEN** 系统必须阻断该激活动作
- **THEN** 系统必须向管理员返回明确失败原因

### Requirement: 系统必须审计 AI Profile 生命周期与激活切换
系统 MUST 为 AI Profile 的创建、更新、密钥变更、启停、测试、激活和回滚动作记录审计事件。审计记录 MUST 至少包含操作者、Profile 标识、动作类型、发生时间、非敏感配置摘要、测试结果与失败原因；审计中 MUST NOT 包含真实密钥。

#### Scenario: Profile 激活生成审计记录
- **WHEN** 管理员成功将系统从一条 Profile 切换到另一条 Profile
- **THEN** 系统必须记录一条包含切换前后目标的审计事件
- **THEN** 审计记录中不得包含密钥明文

#### Scenario: Profile 测试失败生成审计记录
- **WHEN** 管理员对某条 Profile 发起连接测试且测试失败
- **THEN** 系统必须记录测试失败审计事件
- **THEN** 审计记录必须包含失败原因摘要与测试时间

### Requirement: 系统必须允许管理员治理 AI Profile 的推理等级
系统 MUST 在 AI 模型治理的新增、编辑、复制与展示流程中支持 `reasoningEffort` 字段。治理页面 MUST 提供可编辑的推理等级选择项，并在列表、详情或等价治理回显位置展示当前值；当管理员未显式填写该字段，系统 MUST 自动按最低等级写入默认值，而不是保留为空。

#### Scenario: 管理员新建 Profile 时未显式选择推理等级
- **WHEN** 管理员在 AI 模型治理页面新建一条 Codex 或 Claude Profile，且未手工修改推理等级
- **THEN** 系统必须以最低推理等级作为默认值保存该 Profile
- **THEN** 保存成功后治理页面必须能展示该默认值，而不是空白

#### Scenario: 管理员编辑历史空值 Profile
- **WHEN** 管理员打开一条历史上未配置推理等级的 Profile 进行编辑
- **THEN** 表单中的推理等级字段必须默认回显为最低等级
- **THEN** 管理员保存后系统必须将该值持久化到 Profile 记录中

#### Scenario: 管理员修改已存在的推理等级
- **WHEN** 管理员在治理页面把某条 Profile 的推理等级从一个值改为另一个值并保存
- **THEN** 系统必须持久化新的推理等级
- **THEN** 后续治理列表、详情和再次打开编辑抽屉时都必须回显更新后的值

### Requirement: 系统必须支持 OpenAI 兼容 HTTP Profile
系统 MUST 在 AI 模型治理目录中支持 OpenAI 兼容 HTTP Profile。该 Profile MUST 至少包含名称、Provider 标识、平台预设、接入类型、模型名、服务地址、密钥配置状态、协议类型、结构化输出模式、推理等级、服务等级、超时时间和运行时选项。管理员录入完整配置后，系统 MUST 能完成保存、测试连接、启停和激活切换，并让企业微信 AI 理解、Web 智能分析和合同审核 AI 审查统一读取该 Profile。

#### Scenario: 管理员新增 OpenAI 兼容 HTTP Profile
- **WHEN** 管理员在治理后台新增一条 OpenAI 兼容 HTTP Profile，并填写服务地址、模型名、协议类型、结构化输出模式和密钥
- **THEN** 系统必须保存该 Profile
- **THEN** 治理列表必须展示其 Provider、模型名、接入类型、启停状态和密钥配置状态
- **THEN** 该 Profile 通过测试后必须允许被激活为当前全系统 AI 运行时

#### Scenario: OpenAI 兼容 HTTP Profile 被激活后统一生效
- **WHEN** 管理员将测试通过的 OpenAI 兼容 HTTP Profile 设置为当前激活配置
- **THEN** 后续企业微信、Web 分析和合同审核 AI 调用必须统一读取该 Profile
- **THEN** 系统不得再绕过统一执行门面直接读取 Codex SDK 或 Claude Agent SDK 配置

### Requirement: 治理页面必须收敛为 HTTP 运行时字段
系统 MUST 在 OpenAI 兼容 HTTP Profile 的治理表单中展示与 HTTP 调用直接相关的字段，并隐藏或标记废弃 Agent CLI、MCP 和工具执行字段。`codexPath`、Claude CLI 路径、`cwd`、`maxTurns`、`permissionMode`、`allowedTools`、`mcpConfigPath`、`enableMcpValidation` 和 `anthropicApiStyle` 不得作为新版 OpenAI 兼容 HTTP Profile 的必填或推荐字段。

#### Scenario: 新建 HTTP Profile 时不展示本地 CLI 字段
- **WHEN** 管理员选择新建 OpenAI 兼容 HTTP Profile
- **THEN** 表单必须要求填写模型服务地址、模型名、协议类型和密钥等 HTTP 运行时字段
- **THEN** 表单不得要求管理员填写本地 Codex 可执行路径、Claude CLI 路径或 MCP 配置文件路径

#### Scenario: 历史 Agent 字段仅作为迁移提示
- **WHEN** 管理员查看或复制一条历史 Codex SDK 或 Claude Agent SDK Profile
- **THEN** 系统可以展示其历史字段摘要
- **THEN** 系统必须提示这些 Agent CLI / MCP 字段不会进入新版 OpenAI 兼容 HTTP 运行时
- **THEN** 管理员必须重新测试通过后才可激活迁移后的 Profile

### Requirement: 系统必须以真实 HTTP 调用验证 Profile
系统 MUST 在 OpenAI 兼容 HTTP Profile 测试连接与激活验证阶段发起至少一次真实 HTTP 模型调用，而不是只校验字段完整性或网络端口可达。健康检查 MUST 使用当前 Profile 的服务地址、模型名、协议类型和密钥执行最小 smoke test，并记录成功 / 失败状态、耗时、失败阶段和脱敏失败原因。

#### Scenario: HTTP Profile 测试连接成功
- **WHEN** 管理员对一条 OpenAI 兼容 HTTP Profile 发起测试连接，且模型服务返回合法最小响应
- **THEN** 系统必须记录该 Profile 最近一次测试成功时间和耗时
- **THEN** 页面必须展示成功反馈
- **THEN** 该测试不得依赖本地 Agent CLI 或 SDK thread

#### Scenario: HTTP Profile 测试连接失败
- **WHEN** 模型服务不可达、鉴权失败、返回非成功状态或响应无法解析
- **THEN** 系统必须将测试结果标记为失败
- **THEN** 页面必须展示脱敏失败原因
- **THEN** 该 Profile 不得被激活为当前生效配置

### Requirement: 治理页面必须提供常见模型平台预设
系统 MUST 允许治理页面为常见 OpenAI 兼容模型平台提供受控预设。预设 MAY 覆盖 Qwen、DeepSeek、GLM 和内部 OpenAI 兼容网关等平台，并为管理员填充建议的协议类型、结构化输出模式、服务地址示例和模型名提示。预设只作为配置辅助，最终调用仍 MUST 经过后端 HTTP adapter、健康检查和结构化输出校验。

#### Scenario: 管理员选择 Qwen 平台预设
- **WHEN** 管理员在新增 Profile 时选择 Qwen 平台预设
- **THEN** 页面必须填充或提示 Qwen 平台常用的 Chat Completions 兼容配置项
- **THEN** 管理员仍必须填写真实密钥和实际模型名
- **THEN** 保存或激活前仍必须通过服务端健康检查

#### Scenario: 管理员选择 DeepSeek 或 GLM 平台预设
- **WHEN** 管理员选择 DeepSeek 或 GLM 平台预设
- **THEN** 页面必须建议使用 `chat_completions` 协议和适配该平台的结构化输出模式
- **THEN** 页面不得要求管理员填写任意请求体模板或任意响应解析脚本
- **THEN** 后端必须继续负责请求构造、响应解析、密钥脱敏和错误分类

### Requirement: 兼容模型必须优先通过页面配置接入，非兼容模型必须新增 adapter
对于后续新增模型，系统 MUST 先判断其是否兼容 OpenAI HTTP 协议。若兼容，系统 MUST 允许管理员通过治理页面新增或复制 OpenAI 兼容 HTTP Profile 完成接入，而不需要修改业务调用链路；若不兼容，系统 MUST 新增对应后端 adapter 并通过统一执行门面注册后，才允许该模型以新接入类型出现在治理页面中。系统 MUST NOT 允许管理员仅通过页面自定义任意请求体模板、任意鉴权脚本或任意响应解析脚本来接入非兼容模型。

#### Scenario: 新增兼容 OpenAI HTTP 的模型
- **WHEN** 管理员需要接入一条新的 OpenAI HTTP 兼容模型
- **THEN** 系统必须允许其通过治理页面新增或复制 Profile 并填写受控字段完成接入
- **THEN** Web 问数、企业微信 AI 理解和合同审核业务代码不得因为该模型接入而单独修改

#### Scenario: 新增不兼容 OpenAI HTTP 的模型
- **WHEN** 管理员需要接入一条不兼容 OpenAI HTTP 协议的模型
- **THEN** 系统必须要求先新增后端 adapter 并注册新的接入类型
- **THEN** 在该 adapter 未完成前，治理页面不得仅靠自由配置表单宣称该模型已可用

### Requirement: 治理页面必须受控配置结构化输出模式
系统 MUST 在 OpenAI 兼容 HTTP Profile 中提供结构化输出模式配置。结构化输出模式 MUST 至少包含 `json_schema`、`json_object` 和 `prompt_schema`，并由后端 adapter 解释为对应请求构造和响应校验策略。页面不得允许管理员配置任意 JSON 请求模板、任意 header 模板或任意响应解析表达式。

#### Scenario: 管理员选择 JSON Schema 模式
- **WHEN** 管理员选择 `json_schema` 结构化输出模式
- **THEN** 系统必须在测试连接或结构化 smoke test 中验证当前模型服务是否支持该模式
- **THEN** 如果上游不支持该模式，系统必须返回明确失败原因或建议改用 `json_object`

#### Scenario: 管理员选择 JSON object 模式
- **WHEN** 管理员选择 `json_object` 结构化输出模式
- **THEN** 系统必须提示该模式仍会由后端执行本地 schema 校验
- **THEN** 系统不得把模型返回的任意 JSON 直接用于业务执行

#### Scenario: 管理员选择 prompt schema 模式
- **WHEN** 管理员选择 `prompt_schema` 结构化输出模式
- **THEN** 系统必须提示该模式兼容性更强但稳定性更依赖模型输出
- **THEN** 系统必须通过本地 schema 校验决定本次调用是否成功


## ADDED Requirements

### Requirement: 系统必须支持多 Provider / 多 Profile 的 AI 配置治理目录
系统 MUST 提供可持久化的 AI 模型 Profile 目录，允许管理员维护多条可复用配置。每条 Profile MUST 至少包含名称、Provider 标识、SDK 类型、模型名、基础接入地址、鉴权方式、启停状态以及全系统运行时所需的关键参数；系统 MUST 支持新增、编辑、复制和停用 Profile，并保证 Profile 标识唯一、名称可读且可区分。

#### Scenario: 管理员新增一条 Claude Profile
- **WHEN** 管理员在治理后台提交一条新的 Claude SDK Profile，且必填字段完整
- **THEN** 系统必须持久化该 Profile，并在治理列表中展示其 Provider、模型名、启停状态和是否已配置密钥

#### Scenario: 管理员复制现有 Profile 作为新配置
- **WHEN** 管理员选择复制一条现有 Profile
- **THEN** 系统必须基于原 Profile 生成一条新的可编辑 Profile
- **THEN** 新 Profile 不得沿用原 Profile 的唯一标识与激活状态

### Requirement: 系统必须首批支持 Codex SDK 与 Claude SDK 两类可用 Profile
系统 MUST 在首批治理能力中直接支持 Codex SDK Profile 与 Claude SDK Profile 两类配置，不得只保留抽象字段而缺少真实可运行接入。管理员录入现有 Codex 配置与 Claude 配置后，系统 MUST 能分别完成保存、测试和切换。后续新增模型类型时，系统 MUST 保持现有治理接口与业务消费方式不变。

#### Scenario: 管理员录入 Codex SDK Profile
- **WHEN** 管理员新增一条 Codex SDK Profile，并填写现有 Codex 所需的接入参数
- **THEN** 系统必须能够保存该 Profile，并允许后续执行真实测试与激活切换

#### Scenario: 管理员录入 Claude SDK Profile
- **WHEN** 管理员新增一条 Claude SDK Profile，并填写现有 Claude 所需的接入参数
- **THEN** 系统必须能够保存该 Profile，并允许后续执行真实测试与激活切换

### Requirement: 系统必须以全局唯一激活 Profile 解析 AI 运行时配置
系统 MUST 保证任一时刻最多只有一条后台 Profile 处于“全系统激活”状态。企业微信 AI 理解、Web 智能分析和合同审核 AI 编排 MUST 统一从当前激活 Profile 解析运行时配置，并在切换成功后于下一次请求生效；当后台不存在激活 Profile 时，系统 MUST 回退到现有环境变量 / 本地配置文件提供的默认 AI 配置。

#### Scenario: 激活新 Profile 后全系统统一生效
- **WHEN** 管理员将一条已启用且校验通过的 Profile 设为当前激活配置
- **THEN** 系统必须取消原激活 Profile 的激活状态
- **THEN** 企业微信、智能分析和合同审核后续请求必须统一读取新激活 Profile

#### Scenario: 后台没有激活 Profile 时回退环境默认配置
- **WHEN** 后台尚未配置任何激活 Profile，或当前激活 Profile 被移除
- **THEN** 系统必须回退到现有 `ANALYSIS_AI_*` 与相关本地配置文件解析出的默认 AI 配置
- **THEN** 不得因为后台治理目录为空而直接使现有 AI 链路失效

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
系统 MUST 在 Web 治理后台提供独立的 AI 模型治理页面，并作为现有治理导航的新入口。该页面 MUST 支持查看当前激活配置、浏览 Profile 列表、执行新增编辑、复制、测试连接、启停与激活动作。系统 MUST 仅允许管理员访问该页面及相关接口，非管理员 MUST 被阻断。

#### Scenario: 管理员在治理后台切换当前 AI 配置
- **WHEN** 管理员进入 AI 模型治理页面并选择激活另一条 Profile
- **THEN** 页面必须展示当前激活项、待切换目标和切换反馈
- **THEN** 激活成功后页面必须同步刷新列表状态

#### Scenario: 非管理员访问治理页被阻断
- **WHEN** 非管理员用户尝试访问 AI 模型治理页面或调用对应接口
- **THEN** 系统必须拒绝访问
- **THEN** 非管理员不得读取任何 Profile 明细或激活状态

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

### Requirement: 系统必须以真实 SDK 调用验证切换结果
系统 MUST 在测试连接与切换验证阶段发起至少一次真实 SDK 调用，而不是只校验字段完整性或网络端口可达。Codex SDK Profile 与 Claude SDK Profile MUST 分别按各自 SDK 的最小调用路径完成 smoke test；当 Claude Profile 启用 MCP 校验时，系统 MUST 额外记录 MCP 服务器连接状态，并在连接失败时将测试结果标记为失败。

#### Scenario: Codex Profile 通过真实 SDK 调用验证
- **WHEN** 管理员对一条 Codex SDK Profile 发起测试连接
- **THEN** 系统必须通过后台代码触发一次真实 Codex SDK 调用
- **THEN** 只有调用成功后，该 Profile 才可被标记为测试通过

#### Scenario: Claude Profile 通过真实 SDK 调用与 MCP 校验
- **WHEN** 管理员对一条启用 MCP 校验的 Claude SDK Profile 发起测试连接
- **THEN** 系统必须通过后台代码触发一次真实 Claude SDK 调用
- **THEN** 系统必须记录 MCP 服务器连接状态
- **THEN** 只要 Claude 调用失败或 MCP 连接失败，测试结果都必须标记为失败

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

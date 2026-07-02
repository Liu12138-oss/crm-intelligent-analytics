## ADDED Requirements

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

## MODIFIED Requirements

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

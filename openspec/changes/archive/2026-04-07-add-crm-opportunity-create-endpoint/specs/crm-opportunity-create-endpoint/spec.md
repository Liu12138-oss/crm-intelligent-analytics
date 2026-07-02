## ADDED Requirements

### Requirement: 受控新增商机接口
系统 MUST 提供受会话鉴权保护的新增商机接口 `/api/v1/crm/opportunities`。该接口 MUST 使用当前登录会话中的 CRM access token 调用 CRM 官方 `/api/v2/opportunities`，并向调用方暴露业务化字段模型，而不是要求调用方直接构造 CRM 原始表单键名。

#### Scenario: 使用当前会话创建商机
- **WHEN** 已登录用户调用 `/api/v1/crm/opportunities` 并提交满足必填约束的新增商机请求
- **THEN** 系统 MUST 调用 CRM 官方 `/api/v2/opportunities`
- **THEN** 系统 MUST 返回标准化的商机创建结果，至少包含商机 ID、商机标题、客户信息、负责人、所属部门、创建时间和结果提示

#### Scenario: 未显式传入负责人和所属部门
- **WHEN** 已登录用户调用 `/api/v1/crm/opportunities`，请求中未显式传入负责人 ID 与所属部门 ID
- **THEN** 系统 MUST 默认使用当前会话用户 ID 作为负责人
- **THEN** 系统 MUST 在当前会话用户存在部门信息时默认使用其首个部门 ID 作为所属部门

### Requirement: 截图必填字段校验
系统 MUST 对截图中标记为必填的“项目名称、最终客户、线索编号、关联产品、预计有效收入、预计签单日期、被续签合同号、代理商全称、项目现状及关键点、售前”执行服务端校验，且不得因为调用方绕过页面而放宽约束。

#### Scenario: 所有截图必填字段齐全
- **WHEN** 调用方提交完整的项目名称、客户 ID、至少一条关联产品、预计有效收入、预计签单日期及各业务必填文本字段
- **THEN** 系统 MUST 允许继续组装 CRM 创建请求

#### Scenario: 缺少任一截图必填字段
- **WHEN** 调用方缺少项目名称、最终客户、线索编号、关联产品、预计有效收入、预计签单日期、被续签合同号、代理商全称、项目现状及关键点或售前中的任一项
- **THEN** 系统 MUST 拒绝创建请求并返回 `400`
- **THEN** 返回信息 MUST 明确指出缺失字段名称

### Requirement: 标准字段、产品字段与自定义字段映射
系统 MUST 把新增商机请求拆分映射为 CRM 标准字段、`product_assets_attributes` 产品关联字段和环境配置指定的自定义字段键名。系统 MUST 支持 `stage`、`source`、`kind` 在调用方显式传值优先，否则使用环境默认值；若缺少所需自定义字段映射配置，则 MUST 直接拒绝请求。

#### Scenario: 映射产品关联字段
- **WHEN** 调用方提交至少一条带 `productId` 的关联产品
- **THEN** 系统 MUST 将其映射为 CRM `opportunity[product_assets_attributes][][...]` 结构后再发起创建

#### Scenario: 使用环境默认阶段与来源
- **WHEN** 调用方未显式传入 `stage`、`source` 或 `kind`，但环境已配置默认值
- **THEN** 系统 MUST 使用环境默认值组装 CRM 创建请求

#### Scenario: 缺少业务字段映射配置
- **WHEN** 调用方提交线索编号、被续签合同号、代理商全称、项目现状及关键点或售前字段，但服务端未配置其对应的 CRM 自定义字段键名
- **THEN** 系统 MUST 拒绝创建请求并返回 `400`
- **THEN** 返回信息 MUST 指出缺失的映射配置项

### Requirement: 创建失败的错误边界
系统 MUST 对新增商机链路中的鉴权失败、上游不可达和业务失败做一致化错误处理，不得返回未结构化异常。

#### Scenario: 登录态失效
- **WHEN** 调用 `/api/v1/crm/opportunities` 时当前登录会话失效，或者会话中不存在有效 CRM access token
- **THEN** 系统 MUST 返回 `401`

#### Scenario: CRM Open API 不可达
- **WHEN** 系统无法连接 CRM 官方 `/api/v2/opportunities`
- **THEN** 系统 MUST 返回 `503`
- **THEN** 返回信息 MUST 说明 CRM Open API 当前不可用

#### Scenario: CRM 返回业务失败
- **WHEN** CRM 官方创建商机接口返回非零业务码或显式错误消息
- **THEN** 系统 MUST 中止创建并返回非成功响应
- **THEN** 返回信息 MUST 保留足够的上游错误上下文供调用方判断失败原因

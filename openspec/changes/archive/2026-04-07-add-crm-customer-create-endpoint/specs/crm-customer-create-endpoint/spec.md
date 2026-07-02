## ADDED Requirements

### Requirement: 受控新增客户接口
系统 MUST 提供受会话鉴权保护的新增客户接口 `/api/v1/crm/customers`。该接口 MUST 使用当前登录会话中的 CRM access token 调用 CRM 官方 `/api/v2/customers`，并将请求收敛为本系统定义的业务化入参，而不是直接透传外部 CRM 原始字段结构。

#### Scenario: 使用当前会话创建客户
- **WHEN** 已登录用户调用 `/api/v1/crm/customers`，并提交满足必填约束的新增客户请求
- **THEN** 系统调用 CRM 官方 `/api/v2/customers`
- **THEN** 系统返回标准化的客户创建结果，至少包含客户 ID、客户名称、负责人、所属部门、创建时间和结果提示

#### Scenario: 未提供负责人和所属部门时使用默认值
- **WHEN** 已登录用户调用 `/api/v1/crm/customers`，请求中未显式传入负责人 ID 和所属部门 ID
- **THEN** 系统 MUST 默认使用当前会话用户 ID 作为负责人
- **THEN** 系统 MUST 在当前会话用户存在部门信息时默认使用其首个部门 ID 作为所属部门

### Requirement: 截图必填字段校验与映射
系统 MUST 对截图中标记为必填的“名称、IT决策权所在地、统一社会信用代码、电话”执行服务端校验。系统 MUST 把 `IT决策权所在地` 和 `统一社会信用代码` 映射为环境配置指定的 CRM 自定义字段键名，并把 `电话` 映射到 CRM 客户地址电话字段。

#### Scenario: 必填字段齐全且映射配置完整
- **WHEN** 调用方提交名称、IT决策权所在地、统一社会信用代码、电话，且环境中已配置对应自定义字段键名
- **THEN** 系统 MUST 组装完整的 CRM 创建请求并写入标准字段与自定义字段

#### Scenario: 缺少截图必填字段
- **WHEN** 调用方缺少名称、IT决策权所在地、统一社会信用代码或电话中的任一项
- **THEN** 系统 MUST 拒绝创建请求并返回 `400`
- **THEN** 返回信息 MUST 明确指出缺失字段名称

#### Scenario: 缺少自定义字段映射配置
- **WHEN** 调用方提交了 IT决策权所在地 或 统一社会信用代码，但服务端未配置其对应的 CRM 自定义字段键名
- **THEN** 系统 MUST 拒绝创建请求并返回 `400`
- **THEN** 返回信息 MUST 指出缺失的映射配置项

### Requirement: CRM 标准必填字段兜底策略
CRM 官方新增客户接口要求 `category`、`source`、`want_department_id` 等标准字段。系统 MUST 支持“调用方显式传值优先，其次使用环境默认值或会话默认值”的兜底策略；当兜底后仍缺少 CRM 官方必填字段时，系统 MUST 拒绝请求而不是发送不完整写入。

#### Scenario: 使用环境默认 category 和 source
- **WHEN** 调用方未显式传入 `category` 和 `source`，但环境已配置默认值
- **THEN** 系统 MUST 使用环境默认值组装 CRM 创建请求

#### Scenario: 无法补齐 CRM 官方必填字段
- **WHEN** 调用方未提供 `category`、`source` 或 `want_department_id`，且系统也无法从环境配置或会话信息中补齐
- **THEN** 系统 MUST 拒绝请求并返回 `400`
- **THEN** 返回信息 MUST 明确指出无法补齐的 CRM 官方必填字段

### Requirement: 创建失败的错误边界
系统 MUST 对新增客户链路中的鉴权失败、上游不可达和业务失败做一致化错误处理，避免把原始异常直接暴露为未结构化错误。

#### Scenario: 登录态失效
- **WHEN** 调用 `/api/v1/crm/customers` 时当前登录会话已失效，或者会话中不存在有效 CRM access token
- **THEN** 系统 MUST 返回 `401`

#### Scenario: CRM Open API 不可达
- **WHEN** 系统无法连接 CRM 官方 `/api/v2/customers`
- **THEN** 系统 MUST 返回 `503`
- **THEN** 返回信息 MUST 说明 CRM Open API 当前不可用

#### Scenario: CRM 返回业务错误
- **WHEN** CRM 官方接口返回非零业务码或显式错误消息
- **THEN** 系统 MUST 中止创建并返回非成功响应
- **THEN** 返回信息 MUST 保留足够的上游错误上下文，供调用方判断失败原因

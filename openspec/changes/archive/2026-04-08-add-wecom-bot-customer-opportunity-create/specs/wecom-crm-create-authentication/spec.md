## ADDED Requirements

### Requirement: 企业微信机器人客户/商机创建必须支持内置 CRM 账号认证
系统 MUST 为企业微信机器人执行客户创建和商机创建提供独立的内置 CRM 账号认证能力。机器人进入创建确认后，系统 MUST 通过受控配置的内置账号换取 CRM Open API token，再调用官方创建接口，而不是依赖发送人的 Web 登录会话 token。若内置账号未配置、登录失败或 token 换取失败，系统 MUST 保留当前草稿并返回明确失败原因。

#### Scenario: 发送人没有 Web 登录态时仍可执行机器人创建
- **WHEN** 企业微信发送人已完成身份映射并确认创建摘要，但当前没有可用的 `CRM access token`
- **THEN** 系统改用受控内置 CRM 账号换取 Open API token 并继续执行创建
- **THEN** 系统不得要求发送人先去 Web 端重新登录

#### Scenario: 内置账号认证失败时保留草稿
- **WHEN** 企业微信机器人执行客户创建或商机创建时，内置 CRM 账号未配置、密码错误或 CRM 登录接口返回失败
- **THEN** 系统将本次创建标记为失败并保留草稿内容
- **THEN** 系统向当前会话返回可理解的失败提示，说明是机器人创建内置账号认证失败

### Requirement: 内置 CRM token 必须支持短时缓存与失效刷新
系统 MUST 对机器人创建使用的内置 CRM token 做短时缓存，避免每次创建都重新登录。若官方创建接口返回鉴权失败，系统 MUST 先清空缓存并强制刷新 token 后重试一次；重试仍失败时才向用户返回失败结果。

#### Scenario: 有效 token 命中缓存
- **WHEN** 同一内置 CRM 账号在 token 有效期内连续执行多次客户或商机创建
- **THEN** 系统复用缓存中的 token，而不是每次都重新调用 CRM 登录接口

#### Scenario: token 失效后刷新并重试一次
- **WHEN** 创建请求命中已缓存 token，但 CRM 官方接口返回 401、403 或明确的 token 失效错误
- **THEN** 系统先清空本地缓存并重新登录获取 token
- **THEN** 系统使用新 token 自动重试一次官方创建请求

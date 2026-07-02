## ADDED Requirements

### Requirement: Web 受保护接口必须基于正式认证会话鉴权
后台管理系统的受保护接口必须基于正式认证会话完成鉴权。系统不得在正式运行链路中接受裸 `x-crm-user-id`、`crm_session_user` 或其他仅包含用户标识的降级凭证来直接放行请求。

#### Scenario: 缺少正式会话时拒绝访问
- **WHEN** 请求访问受保护接口时未携带有效认证会话
- **THEN** 系统必须返回未认证结果，而不能仅根据用户 ID 直接装载用户

#### Scenario: 裸用户标识不得替代正式会话
- **WHEN** 请求仅携带 `x-crm-user-id` 或 `crm_session_user` 这类裸用户标识
- **THEN** 系统必须拒绝该请求进入正式 Web 后台受保护接口

### Requirement: 浏览器登录态必须以后端 HttpOnly 会话 Cookie 为主
Web 后台浏览器登录态必须以后端签发的 HttpOnly 会话 Cookie 为唯一正式承载。前端不得把 `sessionId` 当作可复用凭证长期保存到 `localStorage`、`sessionStorage` 或请求头中。

#### Scenario: 登录成功后使用 Cookie 承载会话
- **WHEN** 用户通过用户名密码或企业微信扫码登录成功
- **THEN** 系统必须通过 HttpOnly Cookie 建立会话，前端只通过会话接口水合当前用户状态

#### Scenario: 前端刷新后通过会话接口恢复状态
- **WHEN** 浏览器仍持有有效会话 Cookie 且用户刷新页面或重新打开后台
- **THEN** 前端必须通过 `/auth/session` 恢复当前登录态，而不能依赖本地保存的 `sessionId`

### Requirement: 登录态失效后必须统一清理并重新登录
当正式认证会话失效或被登出时，系统必须统一清理当前前端登录态，并引导用户回到登录页重新建立正式会话。

#### Scenario: 会话失效后跳回登录页
- **WHEN** 前端访问会话接口或受保护接口时收到未认证结果
- **THEN** 系统必须清理当前登录态并跳转到登录页，同时保留原目标页作为回跳地址

#### Scenario: 登出后不得继续访问后台
- **WHEN** 用户主动退出登录
- **THEN** 系统必须清理服务端会话与浏览器会话 Cookie，后续访问受保护接口时应返回未认证结果

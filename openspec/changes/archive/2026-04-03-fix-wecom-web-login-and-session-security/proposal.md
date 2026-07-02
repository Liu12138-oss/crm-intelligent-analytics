## Why

企业微信组织架构已经成功同步到 CRM 原生 `wx_*` 映射链路，但当前 Web 扫码登录仍优先依赖进程内临时绑定仓库，导致“已同步可识别用户”依然可能被要求再次输入用户名密码。与此同时，后台受保护接口仍保留基于裸用户标识的降级放行路径，前端还把会话 ID 持久化到 `localStorage`，登录态边界与当前规格要求不一致。

## What Changes

- 调整企业微信 Web 扫码登录链路，优先复用 CRM 原生 `wx_user_maps -> wx_users` 映射结果，已同步用户应可直接完成扫码登录。
- 调整扫码未命中时的手工绑定逻辑，用户名密码认证成功后不再只写入进程内绑定仓库，而是正式写回 CRM 原生映射表。
- 收敛 Web 后台登录态实现，移除受保护接口对裸 `x-crm-user-id` / `crm_session_user` 的生产放行路径。
- 调整前端登录态承载方式，改为以后端 HttpOnly 会话 Cookie 为主，不再把 `sessionId` 当作浏览器可读令牌长期保存。
- 补充回归测试，覆盖“已同步用户扫码直登”“手工绑定后写回 CRM 原生映射”“无正式会话不得访问受保护接口”三类场景。

## Capabilities

### New Capabilities
- `wecom-web-login-native-mapping`: 定义企业微信 Web 扫码登录如何优先复用 CRM 原生映射，并在缺失时通过手工认证补齐原生映射。
- `web-auth-session-hardening`: 定义 Web 后台登录态、受保护接口鉴权和前端会话承载的收口要求。

### Modified Capabilities

无。

## Impact

- 影响后端认证与扫码登录链路，重点涉及 `backend/src/modules/auth/*`、`backend/src/modules/wecom/*`、`backend/src/database/crm-readonly/*`。
- 影响前端登录态、水合与路由守卫，重点涉及 `frontend/src/services/*`、`frontend/src/stores/*`、`frontend/src/router/*`。
- 影响认证相关测试与回归场景，重点涉及 `backend/test/integration/*`、`frontend/tests/unit/*`。
- 影响一期登录与企业微信扫码验证口径，需要同步 OpenSpec 任务与相关文档说明。

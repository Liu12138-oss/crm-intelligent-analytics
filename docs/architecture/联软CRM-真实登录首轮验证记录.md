# 联软CRM-真实登录首轮验证记录

## 1. 文档目的

本文档用于记录 2026-06-04 对联软 CRM 第二阶段真实登录链路的首轮落地与验证结果。

本轮重点回答 3 个问题：

1. 我方真实登录配置是否已具备落地条件
2. 对方当前环境是否已开放正式真实登录接口
3. 在对方正式接口未开放前，是否可以先用远端 mock 真实登录链完成首轮联调

---

## 2. 本轮配置落地内容

本轮已完成以下配置与代码落地：

1. 我方后端已支持 `CRM_OPEN_API_LOGIN_PATH`，不再把登录路径写死为 `/api/v2/auth/login`。
2. 我方后端已支持 `CRM_AUTH_IDENTITY_API_*` 作为真实登录后的身份查询 API 兜底。
3. 本地开发环境已落入以下“远端 mock 真实登录联调参数”：
   - `CRM_OPEN_API_BASE_URL=http://10.18.16.114:3000`
   - `CRM_OPEN_API_LOGIN_PATH=/api/mock/crm-open-api/v2/auth/login`
   - `CRM_AUTH_IDENTITY_API_BASE_URL=http://10.18.16.114:3000`
   - `CRM_AUTH_IDENTITY_API_USER_PATH=/api/mock/crm-open-api/v1/identity/users/{userId}`
   - `CRM_AUTH_IDENTITY_API_AUTH_MODE=none`
4. `CRM_AUTH_MOCK_ENABLED` 仍保留为 `true`，避免影响当前本地默认登录；首轮验证时通过进程环境临时切为 `false`。

---

## 3. 对方环境首轮探测结果

### 3.1 正式真实登录路径探测

直接请求：

```text
POST http://10.18.16.114:3000/api/v2/auth/login
```

实测结果：

```text
404 Cannot POST /api/v2/auth/login
```

结论：

1. 对方当前 `10.18.16.114:3000` 上，正式真实登录路径尚未开放。
2. 这说明第一阶段标准 OpenAPI 已部署，但第二阶段正式真实登录入口还未在该路径挂出。

### 3.2 远端 mock 真实登录路径探测

直接请求：

```text
POST http://10.18.16.114:3000/api/mock/crm-open-api/v2/auth/login
```

实测结果：

1. 返回 `code=0`
2. 返回 `data.user_id`
3. 返回 `data.user_token`

说明：

1. 对方当前环境已开放“远端 mock 真实登录”路径。
2. 这条链可用于我们做第二阶段首轮端到端联调。

### 3.3 远端 mock 身份查询路径探测

直接请求：

```text
GET http://10.18.16.114:3000/api/mock/crm-open-api/v1/identity/users/A030
```

实测结果：

1. 返回 `code=0`
2. 返回 `id/name/roleIds/roleNames`
3. 返回 `organizationIds/departmentIds/isAdmin`

结论：

1. 远端 mock 身份 API 已可用。
2. 当前足以支撑我方“真实登录成功后按 `user_id` 落身份”的首轮验证。

---

## 4. 我方系统首轮端到端验证结果

### 4.1 验证方式

验证方式为：

1. 启动我方后端临时实例，端口改为 `3002`
2. 临时设置：
   - `CRM_AUTH_MOCK_ENABLED=false`
   - `CRM_OPEN_API_LOGIN_PATH=/api/mock/crm-open-api/v2/auth/login`
   - `CRM_AUTH_IDENTITY_API_BASE_URL=http://10.18.16.114:3000`
   - `CRM_AUTH_IDENTITY_API_USER_PATH=/api/mock/crm-open-api/v1/identity/users/{userId}`
   - `CRM_AUTH_IDENTITY_API_AUTH_MODE=none`
3. 直接调用我方：
   - `POST /api/v1/auth/login`
   - `GET /api/v1/auth/session`

说明：

1. 这次验证的是“通过我方真实登录链进入当前系统”，不是直接调对方 mock 接口。
2. 只要我方 `/api/v1/auth/login` 成功，说明真实登录适配链、身份回填链和本地会话链都已打通。

### 4.2 验证结果

| 账号视角 | 用户名 | 预期 | 登录结果 | 会话结果 | 会话用户 |
|---|---|---|---|---|---|
| 超管 | `liulonghai` | 成功 | 成功 | 成功 | `A030 / 刘龙海 / superadmin` |
| 区管 | `admin_sd` | 成功 | 成功 | 成功 | `A013 / 山东区管理员 / admin` |
| 渠道管理员 | `liangcui` | 成功 | 成功 | 成功 | `PA001 / 梁翠 / partner_admin` |
| 员工 | `shangxichao` | 成功 | 成功 | 成功 | `S022 / 商希超 / staff` |
| 待审批样例 | `15192888211` | 失败 | 失败 | 未建会话 | 返回 `user pending approval` |

结论：

1. 4 类业务账号已可通过我方真实登录链成功进入当前系统。
2. 登录成功后，我方本地会话可正常建立。
3. 待审批账号按预期失败，说明失败链路也符合预期。

---

## 5. 本轮额外发现的问题

本轮联调中额外发现并已修复两个我方问题：

1. `CRM_AUTH_MOCK_ENABLED=false` 时，进程环境原本不能覆盖本地环境文件中的 `true`
   - 已修复环境优先级
2. `DailyReportModule` 中复用 `CrmAuthService` 时，缺少新加的身份 API 依赖
   - 已补齐模块依赖

说明：

1. 这两个问题都属于我方真实登录改造收口问题，现已修复。
2. 修复后，严格模式下我方后端已可正常启动并完成首轮验证。

---

## 6. 当前阶段结论

截至 2026-06-04，当前结论如下：

1. 我方第二阶段真实登录代码链已可用。
2. 对方当前 `10.18.16.114:3000` 正式 `/api/v2/auth/login` 尚未开放。
3. 对方当前已开放“远端 mock 真实登录 + 远端 mock 身份查询”。
4. 基于远端 mock 链路，我方已完成首轮端到端真实登录验证。

综合判断：

```text
第二阶段已完成首轮联调落地，但当前仍属于“远端 mock 真实登录联调通过”，尚不能判定为“正式真实登录接口已通过”。
```

---

## 7. 下一步建议

建议按以下顺序继续推进：

1. 先保持当前开发环境中的远端 mock 登录参数，作为第二阶段稳定基线。
2. 请对方补齐正式真实登录接口：
   - 正式 `Base URL`
   - 正式 `loginPath`
   - `corp_id` 规则
3. 若对方正式身份查询 API 路径与当前 mock 路径不同，请一并回传正式路径。
4. 对方正式接口挂出后，我方只需替换：
   - `CRM_OPEN_API_LOGIN_PATH`
   - `CRM_AUTH_IDENTITY_API_USER_PATH`
   即可继续第二轮正式联调。

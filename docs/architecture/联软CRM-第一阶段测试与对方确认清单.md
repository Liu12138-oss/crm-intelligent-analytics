# 联软CRM-第一阶段测试与对方确认清单

## 1. 目的

本文档用于指导我方在本地或联调环境测试联软 CRM 第一阶段标准 OpenAPI 接入情况，并整理当前仍需对方确认或补充的项目。

第一阶段范围仅包含标准 OpenAPI 只读联调：

1. `auth/token`
2. `auth/me`
3. `meta/permission-scope`
4. `meta/dictionaries`
5. 六类对象列表与详情：
   - `users`
   - `partners`
   - `registrations`
   - `opportunities`
   - `quotes`
   - `orders`

---

## 2. 当前本地端口约定

当前项目本地开发默认约定如下：

| 服务 | 端口 | 说明 |
|---|---:|---|
| 前端 Vite | `5173` | 本地页面入口 |
| 我方后端 | `3001` | 本地 API 与治理诊断入口 |
| 对方标准 OpenAPI | `3000` | 当前对方联调服务 |

说明：

1. 前端固定运行在 `5173`。
2. 我方后端当前本地配置为 `3001`。
3. 对方标准 OpenAPI 当前在 `10.18.16.114:3000/api/open/v1`。

---

## 3. 第一阶段测试前准备

## 3.1 启动方式

推荐命令：

```powershell
pnpm dev:backend
```

如需同时启动前后端：

```powershell
pnpm dev
```

说明：

1. `pnpm dev:backend` 会自动加载本地 `.env.development.local`。
2. 如果只跑前端，不足以做第一阶段联调测试。
3. 第一阶段测试核心在后端标准 OpenAPI 适配层是否能连通对方服务。

## 3.2 本地登录账号

当前内部治理诊断入口可先使用本地 mock 登录账号：

| 账号 | 密码 | 用途 |
|---|---|---|
| `admin` | `admin123` | 推荐，便于进入治理与诊断能力 |
| `director` | `director123` | 可选 |
| `manager` | `manager123` | 可选 |

说明：

1. 这里的登录是“我方项目后台登录”，不是对方标准 OpenAPI 的 `appKey/appSecret` 鉴权。
2. 第一阶段内部测试时，我们先登录我方系统，再通过治理诊断接口代测对方标准 OpenAPI。

---

## 4. 推荐测试方法

## 4.1 方法一：快速运行态验证

这是最快的测试方式，用来确认“标准 OpenAPI 是否已配置并且可连通”。

命令：

```powershell
. .\scripts\load-local-runtime-env.ps1 | Out-Null
pnpm --dir backend verify:runtime
```

预期结果重点关注：

1. `standardApiConfigured = true`
2. `standardApiBaseUrlPresent = true`
3. `standardApiConnected = true`
4. `standardApiBoundUserId = "A030"`
5. `standardApiScopeType = "all"`

如果出现以下结果，含义如下：

| 结果 | 含义 |
|---|---|
| `standardApiConfigured = false` | 本地环境变量未加载，或缺少 `CRM_STANDARD_OPEN_API_*` |
| `standardApiConfigured = true` 但 `standardApiConnected = false` | 地址、白名单、`appKey/appSecret` 或网络连通有问题 |
| `standardApiBoundUserId` 不是预期账号 | 当前使用的 client 与预期联调身份不一致 |

---

## 4.2 方法二：内部治理诊断接口测试

这是最推荐的第一阶段验证方式，能直接在我方项目里核对：

1. 标准 OpenAPI 是否已启用
2. 当前绑定的是哪个 client / 用户
3. 权限范围是什么
4. 六类对象列表与详情是否能查通

### 步骤 1：登录我方后端

```powershell
$body = @{
  login = 'admin'
  password = 'admin123'
} | ConvertTo-Json

Invoke-WebRequest `
  -Uri 'http://127.0.0.1:3001/api/v1/auth/login' `
  -Method POST `
  -ContentType 'application/json' `
  -Body $body `
  -SessionVariable session
```

说明：

1. 登录参数名是 `login`、`password`，不是 `username`。
2. 登录成功后，PowerShell 会保存 `crm_auth_session` Cookie。

### 步骤 2：读取联调诊断摘要

```powershell
Invoke-RestMethod `
  -Uri 'http://127.0.0.1:3001/api/v1/governance/crm-standard-api/diagnostics' `
  -WebSession $session
```

预期重点字段：

1. `enabled = true`
2. `context.clientId`
3. `context.clientName`
4. `context.boundUserId`
5. `context.allowedResources`
6. `permissionScope.scopeType`
7. `dictionaries.completeness`

### 步骤 3：验证六类对象列表

示例：

```powershell
Invoke-RestMethod `
  -Uri 'http://127.0.0.1:3001/api/v1/governance/crm-standard-api/resources/users?pageNo=1&pageSize=5' `
  -WebSession $session
```

六类资源建议逐个测一遍：

1. `users`
2. `partners`
3. `registrations`
4. `opportunities`
5. `quotes`
6. `orders`

示例地址模板：

```text
http://127.0.0.1:3001/api/v1/governance/crm-standard-api/resources/{resource}?pageNo=1&pageSize=5
```

### 步骤 4：验证六类对象详情

建议使用当前样例数据中的已知 ID：

| 资源 | 建议详情 ID |
|---|---|
| `users` | `A030` |
| `partners` | `P001` |
| `registrations` | `REG-1777427902052-0` |
| `opportunities` | `OPP-1778134298304-10` |
| `quotes` | `QT-1779950384836` |
| `orders` | `ORD-1779871019160` |

示例：

```powershell
Invoke-RestMethod `
  -Uri 'http://127.0.0.1:3001/api/v1/governance/crm-standard-api/resources/partners/P001' `
  -WebSession $session
```

---

## 4.3 方法三：对方标准 OpenAPI 直连联调

这是“对方 AI-agent 团队”或我方联调同学可直接按契约测试的方法。

推荐顺序：

1. `POST /api/open/v1/auth/token`
2. `GET /api/open/v1/auth/me`
3. `GET /api/open/v1/meta/permission-scope`
4. `GET /api/open/v1/meta/dictionaries`
5. 六类对象列表
6. 六类对象详情

这部分以对方提供的以下文档为准：

1. `AI-agent标准API契约.md`
2. `联软CRM-第一阶段对外联调交付说明.md`
3. `对外联调参数回传表.md`

---

## 5. 第一阶段通过标准

建议按以下口径判断“第一阶段是否通过”：

1. `verify:runtime` 返回 `standardApiConnected = true`
2. 治理诊断摘要显示 `enabled = true`
3. `auth/me` 能返回绑定用户与 `allowedResources`
4. `meta/permission-scope` 能返回权限范围
5. `meta/dictionaries` 能返回主要字典
6. 六类对象列表都可返回数据
7. 六类对象详情都可查到样例 ID
8. 权限范围与对方回传矩阵一致

---

## 6. 常见问题判断

| 现象 | 优先检查项 |
|---|---|
| 后端接口 401 | 是否已先登录我方系统并带上 `crm_auth_session` |
| 诊断摘要 `enabled=false` | `CRM_STANDARD_OPEN_API_BASE_URL / APP_KEY / APP_SECRET` 是否已生效 |
| 能拿到 token 但资源 403 | 对方 client `allowedResources` 或绑定用户权限是否不一致 |
| 列表正常但详情 404 | 样例 ID 是否写错，或该 ID 当前绑定用户无权限查看 |
| 字典不全 | 对方 `meta/dictionaries` 是否缺少对应字典项 |
| 前端能打开但 API 报网络错误 | 后端 `3001` 是否已启动 |

---

## 7. 当前仍需对方确认或补充

## 7.1 第一阶段联调仍建议确认

虽然第一阶段资料已基本齐备，但为了减少联调来回，仍建议让对方再确认以下项目：

| 项目 | 当前状态 | 建议动作 |
|---|---|---|
| 联调 Base URL | 已提供 | 请对方确认当前仍以 `http://10.18.16.114:3000/api/open/v1` 为准 |
| 4 组 client 凭证 | 已提供 | 请对方确认未重置、未失效 |
| 白名单 | 已配置 | 请对方确认 `8.129.9.164` 及当前内网访问策略仍有效 |
| 六类样例数据 | 已提供初稿 | 请对方确认样例 ID 仍存在、仍可查 |
| 权限矩阵 | 已提供首轮结果 | 请对方确认当前页面权限口径未发生变化 |
| 字典完整度 | 基本可用 | 请对方确认 `opportunityStages`、`quoteStatuses`、`orderStatuses` 是否完整 |

## 7.2 第二阶段真实登录仍待确认

这部分不是第一阶段阻塞项，但如果后面要接着切真实登录，建议现在就让对方一并确认：

1. 真实登录 Base URL
2. 是否必须传 `corp_id`
3. 如必须传，固定 `corp_id` 值是什么
4. 正式联调环境建议 `device`
5. 正式联调环境建议 `version_code`
6. 正式联调环境建议 `timeout`
7. 真实登录成功响应是否与 mock 样例完全一致
8. 当前手册里的 `123456` 是否就是 SIT 真实联调密码
9. `user_id` 落权限的数据源到底走：
   - 只读库
   - 身份查询 API

---

## 8. 建议直接发给对方的确认消息

下面这段可以直接发：

> 我们这边会先按第一阶段标准 OpenAPI 开始联调验证。  
> 为了减少双方联调来回，还请你们帮忙再确认以下几项：  
> 1. 当前第一阶段联调仍以 `http://10.18.16.114:3000/api/open/v1` 为准；  
> 2. 已提供的 4 组 client 凭证当前仍有效、未重置；  
> 3. 白名单策略当前仍有效；  
> 4. 六类对象样例 ID 当前仍存在且可查询；  
> 5. 权限矩阵口径与当前 CRM 页面权限一致；  
> 6. `meta/dictionaries` 中商机阶段、报价状态、订单状态字典是否已完整。  
> 另外，为后续第二阶段真实登录做准备，也请一并确认：真实登录 Base URL、是否必传 `corp_id`、正式联调建议 `device/version_code/timeout`、手册中的 `123456` 是否为 SIT 实际联调密码，以及 `user_id` 落权限的数据源是只读库还是身份查询 API。

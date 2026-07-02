# 联调专用 Client 创建说明

> 版本：V1.0  
> 日期：2026-06-03  
> 适用对象：实施、运维、项目交付、联调支持人员  
> 用途：指导创建 AI-agent 第一阶段联调使用的 OpenAPI client

---

## 1. 目的

联调 client 用于给对方 AI-agent 提供独立、可控、可审计的标准 OpenAPI 调用身份。

每个 client 绑定一个 CRM 用户，因此：

1. client 本身不直接定义业务权限。
2. 真正的数据权限继承自绑定的 CRM 用户。
3. 如需多个权限视角，必须创建多个 client。

---

## 2. 推荐创建的联调 client

第一阶段建议至少创建 4 组 client：

| 用途 | 建议名称 | 绑定角色 | 用途说明 |
|---|---|---|---|
| 超管联调 | `AI-agent-superadmin-test` | `superadmin` | 绑定 `A030 / liulonghai`，验证全量数据口径 |
| 区管联调 | `AI-agent-admin-test` | `admin` | 绑定 `A013 / admin_sd`，验证山东区区域权限口径 |
| 渠道联调 | `AI-agent-partner-admin-test` | `partner_admin` | 绑定 `PA001 / liangcui`，验证 P001 渠道权限口径 |
| 员工联调 | `AI-agent-staff-test` | `staff` | 绑定 `S022 / shangxichao`，验证个人权限口径 |

如需区分环境，建议命名后缀加环境标识：

1. `-sit`
2. `-uat`
3. `-prod`

示例：

1. `AI-agent-superadmin-sit`
2. `AI-agent-admin-sit`
3. `AI-agent-partner-admin-sit`
4. `AI-agent-staff-sit`

---

## 3. 创建前准备

创建前请先确认：

1. 已有可用联调环境 Base URL
2. 已确定对方 AI-agent 出口 IP
3. 已确认联调使用的 4 个 CRM 测试账号
4. 已确认第一阶段只开只读查询资源

---

## 4. 当前支持的资源授权值

第一阶段建议只授权以下资源：

```json
[
  "users",
  "partners",
  "registrations",
  "opportunities",
  "quotes",
  "orders"
]
```

如需调试元数据接口，当前系统允许通过任意已授权 client 访问：

1. `GET /api/open/v1/auth/me`
2. `GET /api/open/v1/meta/permission-scope`
3. `GET /api/open/v1/meta/dictionaries`

因此第一阶段不建议直接给 `["*"]`，除非是内部运维或排障场景。

---

## 5. 创建方式

当前项目支持通过管理接口创建 OpenAPI client。

直观理解如下：

1. 我们 CRM 这边创建 4 个 client
2. 每个 client 绑定 1 个 CRM 测试账号
3. 系统当场生成 `clientId / appKey / appSecret`
4. 我们把这 4 组凭证回传给对方 AI-agent
5. 对方再用这些凭证换 token 并调用我们的 OpenAPI

### 5.1 管理接口

1. 查询 client 列表
   - `GET /api/open-api/clients`
2. 创建 client
   - `POST /api/open-api/clients`
3. 更新 client
   - `PUT /api/open-api/clients/{id}`
4. 重置密钥
   - `POST /api/open-api/clients/{id}/reset-secret`

说明：

1. 以上接口仅超级管理员可操作。
2. 调用时需要传 `operatorId`，且该 `operatorId` 必须对应 `superadmin`。

### 5.2 这次联调的推荐创建顺序

建议严格按下面顺序创建，方便先通主链路，再验证权限裁剪：

1. 创建 `AI-agent-superadmin-sit`
2. 创建 `AI-agent-admin-sit`
3. 创建 `AI-agent-partner-admin-sit`
4. 创建 `AI-agent-staff-sit`

推荐绑定关系如下：

| clientName | 绑定用户ID | 绑定用户名 | 绑定角色 | 用途 |
|---|---|---|---|---|
| `AI-agent-superadmin-sit` | `A030` | `liulonghai` | `superadmin` | 先打通全量查询 |
| `AI-agent-admin-sit` | `A013` | `admin_sd` | `admin` | 验证山东区区域隔离 |
| `AI-agent-partner-admin-sit` | `PA001` | `liangcui` | `partner_admin` | 验证 P001 渠道隔离 |
| `AI-agent-staff-sit` | `S022` | `shangxichao` | `staff` | 验证个人可见范围 |

### 5.3 创建前检查清单

实际创建前，实施同事先逐项确认：

1. CRM 服务已启动，且可访问 `Base URL`
2. 对方出口 IP `8.129.9.164` 已确认
3. 当前环境存在 4 个测试账号
4. 创建人使用的是超管账号，对应 `operatorId = A030`
5. 第一阶段 `allowedResources` 固定为：

```json
[
  "users",
  "partners",
  "registrations",
  "opportunities",
  "quotes",
  "orders"
]
```

---

## 6. 创建请求示例

### 6.1 创建超管联调 client

请求：

```http
POST /api/open-api/clients
Content-Type: application/json
X-Operator-Id: A030
```

```json
{
  "name": "AI-agent-superadmin-sit",
  "boundUserId": "A030",
  "ipWhitelist": [
    "8.129.9.164"
  ],
  "allowedResources": [
    "users",
    "partners",
    "registrations",
    "opportunities",
    "quotes",
    "orders"
  ],
  "expiresAt": "",
  "remark": "AI-agent 第一阶段联调-超管视角，绑定 liulonghai"
}
```

成功响应示例：

```json
{
  "success": true,
  "data": {
    "id": "OAC-1717310000000",
    "name": "AI-agent-superadmin-sit",
    "appKey": "oak_xxxxxxxxx",
    "boundUserId": "A030",
    "status": "active",
    "ipWhitelist": [
      "10.10.10.10"
    ],
    "allowedResources": [
      "users",
      "partners",
      "registrations",
      "opportunities",
      "quotes",
      "orders"
    ],
    "expiresAt": "",
    "remark": "AI-agent 第一阶段联调-超管视角",
    "createdBy": "A030",
    "createdByName": "刘龙海",
    "createdAt": "2026-06-03T10:00:00.000Z",
    "updatedAt": "2026-06-03T10:00:00.000Z",
    "appSecret": "oas_xxxxxxxxx"
  },
  "message": "开放接口应用创建成功，请妥善保存 appSecret"
}
```

### 6.2 创建区管联调 client

```json
{
  "name": "AI-agent-admin-sit",
  "boundUserId": "A013",
  "ipWhitelist": [
    "8.129.9.164"
  ],
  "allowedResources": [
    "users",
    "partners",
    "registrations",
    "opportunities",
    "quotes",
    "orders"
  ],
  "expiresAt": "",
  "remark": "AI-agent 第一阶段联调-区管视角，绑定 admin_sd"
}
```

### 6.3 创建渠道联调 client

```json
{
  "name": "AI-agent-partner-admin-sit",
  "boundUserId": "PA001",
  "ipWhitelist": [
    "8.129.9.164"
  ],
  "allowedResources": [
    "users",
    "partners",
    "registrations",
    "opportunities",
    "quotes",
    "orders"
  ],
  "expiresAt": "",
  "remark": "AI-agent 第一阶段联调-渠道视角，绑定 liangcui"
}
```

### 6.4 创建员工联调 client

```json
{
  "name": "AI-agent-staff-sit",
  "boundUserId": "S022",
  "ipWhitelist": [
    "8.129.9.164"
  ],
  "allowedResources": [
    "users",
    "partners",
    "registrations",
    "opportunities",
    "quotes",
    "orders"
  ],
  "expiresAt": "",
  "remark": "AI-agent 第一阶段联调-员工视角，绑定 shangxichao"
}
```

### 6.5 可直接执行的 4 次创建请求

如果实施侧使用接口工具直接创建，可按下面 4 次请求顺序执行。

请求地址：

```http
POST {BaseURL}/api/open-api/clients
Content-Type: application/json
X-Operator-Id: A030
```

请求 1：超管 client

```json
{
  "name": "AI-agent-superadmin-sit",
  "boundUserId": "A030",
  "ipWhitelist": ["8.129.9.164"],
  "allowedResources": ["users", "partners", "registrations", "opportunities", "quotes", "orders"],
  "expiresAt": "",
  "remark": "AI-agent 第一阶段联调-超管视角，绑定 liulonghai"
}
```

请求 2：区管 client

```json
{
  "name": "AI-agent-admin-sit",
  "boundUserId": "A013",
  "ipWhitelist": ["8.129.9.164"],
  "allowedResources": ["users", "partners", "registrations", "opportunities", "quotes", "orders"],
  "expiresAt": "",
  "remark": "AI-agent 第一阶段联调-区管视角，绑定 admin_sd"
}
```

请求 3：企业管理员 client

```json
{
  "name": "AI-agent-partner-admin-sit",
  "boundUserId": "PA001",
  "ipWhitelist": ["8.129.9.164"],
  "allowedResources": ["users", "partners", "registrations", "opportunities", "quotes", "orders"],
  "expiresAt": "",
  "remark": "AI-agent 第一阶段联调-渠道视角，绑定 liangcui"
}
```

请求 4：员工 client

```json
{
  "name": "AI-agent-staff-sit",
  "boundUserId": "S022",
  "ipWhitelist": ["8.129.9.164"],
  "allowedResources": ["users", "partners", "registrations", "opportunities", "quotes", "orders"],
  "expiresAt": "",
  "remark": "AI-agent 第一阶段联调-员工视角，绑定 shangxichao"
}
```

### 6.6 创建成功后要立即保存什么

每次创建成功后，响应里会返回：

1. `id`
2. `appKey`
3. `appSecret`

其中：

1. `id` 就是这份文档里说的 `clientId`
2. `appSecret` 只会在创建成功当次返回
3. 如果当时没保存，后面只能走“重置密钥”，不能再次查询明文

建议创建一条记一条，不要 4 条全建完再回头整理。

---

## 7. 创建后需要回传给对方的信息

每个 client 创建完成后，建议整理成表发给对方：

| 环境 | clientName | clientId | 绑定用户ID | 绑定角色 | appKey | appSecret | 白名单IP | 备注 |
|---|---|---|---|---|---|---|---|---|
| SIT | AI-agent-superadmin-sit | OAC-xxx | A030 | superadmin | `oak_xxx` | `oas_xxx` | `8.129.9.164` | 超管视角 |

注意：

1. `appSecret` 只在创建或重置时可见。
2. 发给对方前建议通过加密渠道传递。
3. 不建议把 `appSecret` 放进普通微信群、邮件正文或长期共享文档。

### 7.1 创建完成后的自检步骤

每创建完 1 个 client，建议立即做 3 步校验：

1. 用 `GET /api/open-api/clients?operatorId=A030` 确认 client 已存在，绑定用户正确
2. 用 `POST /api/open/v1/auth/token` 测试该 `appKey/appSecret` 是否能成功换 token
3. 用拿到的 token 调一次 `GET /api/open/v1/auth/me`，确认返回的绑定账号信息正确

推荐最小验证链路：

```http
POST /api/open/v1/auth/token
Content-Type: application/json
```

```json
{
  "appKey": "创建成功返回的 appKey",
  "appSecret": "创建成功返回的 appSecret"
}
```

拿到 token 后再调：

```http
GET /api/open/v1/auth/me
Authorization: Bearer {accessToken}
```

如果 `auth/me` 返回的 `id / username / role` 与预期绑定账号一致，说明这组 client 可交付给对方。

### 7.2 建议最终回传给对方的内容

第一批建议只回这几项，不要多给：

1. `Base URL`
2. 白名单已生效说明
3. 4 组 `clientId / appKey / appSecret`
4. 4 组 client 对应的角色说明
5. 第一阶段可访问资源列表

建议附带一行统一说明：

`第一阶段仅开放 users、partners、registrations、opportunities、quotes、orders 六类标准查询接口，权限继承各 client 绑定的 CRM 用户。`

> 2026-06-09 补充：智能分析阶段新增 `customers` 客户主数据只读视图。新建 client 时建议将 `customers` 加入 `allowedResources`；已创建的旧联调 client 如已授权 `registrations`，系统会兼容允许访问 `customers`，无需立即重建凭证。

---

## 8. 推荐配置策略

### 8.1 白名单策略

建议：

1. 联调环境仅加入对方固定出口 IP
2. 如对方存在多个出口 IP，逐条登记
3. 不建议联调环境开放 `0.0.0.0/0`

### 8.2 过期策略

联调环境建议：

1. `expiresAt` 可先留空
2. 或设置到当前联调结束日期

正式环境建议：

1. 明确有效期
2. 配合周期轮换密钥

### 8.3 资源授权策略

第一阶段建议最小授权：

1. 仅开放六类对象查询资源
2. 不开放其他产品、分类、模块等无关资源
3. 不开放管理接口

---

## 9. 排障建议

### 9.1 token 获取失败

优先检查：

1. `appKey/appSecret` 是否正确
2. client 状态是否为 `active`
3. client 是否已过期
4. 来源 IP 是否在白名单中
5. 绑定用户状态是否为 `active`

### 9.2 有 token 但查询 403

优先检查：

1. `allowedResources` 是否包含对应资源
2. 绑定 CRM 用户是否可用
3. 调用资源名是否正确

### 9.3 返回数据比预期少

优先检查：

1. 该 client 绑定的是哪个 CRM 用户
2. 该用户本身在页面上能看到多少数据
3. 是否命中了区域、渠道、人员权限裁剪

---

## 10. 建议交付物

实施侧最终建议输出 2 份材料：

1. `联调 client 凭证表`
2. `联调环境 IP 白名单表`

如果要给实施同事一个最短执行口径，可直接按下面做：

1. 用超管 `A030` 调 `POST /api/open-api/clients`
2. 连续创建 4 个 client，分别绑定 `A030 / A013 / PA001 / S022`
3. 白名单统一填 `8.129.9.164`
4. `allowedResources` 统一填六类资源
5. 每创建一个就保存 `id/appKey/appSecret`
6. 每创建一个就立即换 token 并调用 `auth/me` 验证
7. 最后把 4 组凭证和 `Base URL` 一起回传给对方

建议和以下文档一起交给对方：

1. [联软CRM-第一阶段对外联调交付说明.md](/D:/远程交付中心文件/建设材料/AI项目及frp/redclaw/lianruan-crm-deploy-v2.2.0_back202605271516/lianruan-crm-deploy-v2.2.0/docs/联软CRM-第一阶段对外联调交付说明.md)
2. [AI-agent标准API契约.md](/D:/远程交付中心文件/建设材料/AI项目及frp/redclaw/lianruan-crm-deploy-v2.2.0_back202605271516/lianruan-crm-deploy-v2.2.0/docs/AI-agent标准API契约.md)

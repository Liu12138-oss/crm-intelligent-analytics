# 联软 CRM 对接 AI-agent 标准 API 契约

> 版本：V1.0  
> 日期：2026-06-03  
> 适用范围：AI-agent 第一阶段标准查询接口  
> 说明：本文是“正式对接契约”，用于开发、联调、验收

---

## 1. 总体约定

### 1.1 Base URL

```text
{CRM_BASE_URL}/api/open/v1
```

示例：

```text
https://crm.example.com/api/open/v1
```

### 1.2 数据格式

1. 请求与响应统一使用 `application/json`
2. 字符集统一 `UTF-8`
3. 时间字段统一使用 ISO 8601 字符串

### 1.3 认证流程

1. AI-agent 持有 `appKey`、`appSecret`
2. 调用 `POST /auth/token` 获取 `accessToken`
3. 后续请求在 Header 中传：

```http
Authorization: Bearer {accessToken}
```

---

## 2. 标准响应结构

### 2.1 成功响应

```json
{
  "code": 0,
  "message": "ok",
  "data": {},
  "requestId": "req_20260603_xxx"
}
```

列表接口会额外返回分页字段：

```json
{
  "code": 0,
  "message": "ok",
  "data": [],
  "requestId": "req_20260603_xxx",
  "pageNo": 1,
  "pageSize": 20,
  "total": 138
}
```

### 2.2 错误响应

```json
{
  "code": 40101,
  "message": "missing access token",
  "requestId": "req_20260603_xxx"
}
```

---

## 3. 通用查询参数

除个别接口特殊说明外，列表接口统一支持以下参数：

| 参数 | 类型 | 必选 | 说明 |
|---|---|---:|---|
| `pageNo` | int | 否 | 页码，默认 1 |
| `pageSize` | int | 否 | 每页条数，默认系统值 |
| `keyword` | string | 否 | 关键字模糊搜索 |
| `status` | string | 否 | 状态过滤 |
| `region` | string | 否 | 区域过滤 |
| `partnerId` | string | 否 | 渠道过滤 |
| `createdAfter` | string | 否 | 创建时间起 |
| `createdBefore` | string | 否 | 创建时间止 |
| `updatedAfter` | string | 否 | 更新时间起 |
| `updatedBefore` | string | 否 | 更新时间止 |
| `sortBy` | string | 否 | 排序字段 |
| `sortOrder` | string | 否 | `asc` 或 `desc` |

附加规则：

1. 所有过滤都在当前绑定 CRM 用户权限范围内生效。
2. 即使传了 `region/partnerId`，也不能突破权限边界。

---

## 4. 错误码约定

| HTTP | code | 含义 |
|---|---:|---|
| 400 | `40111` | 缺少 `appKey` 或 `appSecret` |
| 401 | `40112` | client 无效 |
| 401 | `40113` | `appSecret` 无效 |
| 401 | `40101` | 缺少 `accessToken` |
| 401 | `40102` | `accessToken` 无效或过期 |
| 403 | `40312` | IP 不在白名单 |
| 403 | `40313` | 绑定 CRM 用户不可用 |
| 403 | `40301` | client 被禁用或已过期 |
| 403 | `40302` | 当前请求 IP 不允许 |
| 403 | `40303` | 资源未授权 |
| 403 | `40304` | 绑定 CRM 用户不可访问 |
| 404 | `40401` | 用户不存在 |
| 404 | `40402` | 渠道不存在 |
| 404 | `40403` | 报备不存在 |
| 404 | `40404` | 商机不存在 |
| 404 | `40405` | 报价不存在 |
| 404 | `40406` | 订单不存在 |

---

## 5. 资源授权值

创建 OpenAPI client 时，`allowedResources` 建议使用以下资源名：

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

如需全部放开，可使用：

```json
["*"]
```

---

## 6. 鉴权接口

### 6.1 获取访问令牌

`POST /auth/token`

请求体：

```json
{
  "appKey": "oak_xxxxxxxxx",
  "appSecret": "oas_xxxxxxxxx"
}
```

响应示例：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "accessToken": "openapi_xxxxxxxxx",
    "expiresIn": 7200,
    "tokenType": "Bearer",
    "clientId": "OAC-1717310000000",
    "clientName": "AI-agent-prod",
    "boundUser": {
      "id": "A002",
      "username": "admin_sh",
      "name": "上海区管理员",
      "role": "admin",
      "region": "上海区（非金）",
      "bigRegion": "大东区",
      "partnerId": "",
      "partnerName": "",
      "status": "active"
    }
  },
  "requestId": "req_20260603_xxx"
}
```

### 6.2 获取当前身份上下文

`GET /auth/me`

响应示例：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "client": {
      "id": "OAC-1717310000000",
      "name": "AI-agent-prod",
      "boundUserId": "A002",
      "status": "active",
      "allowedResources": [
        "users",
        "partners",
        "registrations",
        "opportunities",
        "quotes",
        "orders"
      ],
      "ipWhitelist": [
        "10.0.0.10"
      ],
      "expiresAt": "",
      "remark": "",
      "createdAt": "2026-06-03T09:00:00.000Z",
      "updatedAt": "2026-06-03T09:00:00.000Z"
    },
    "user": {
      "id": "A002",
      "username": "admin_sh",
      "name": "上海区管理员",
      "role": "admin",
      "region": "上海区（非金）",
      "bigRegion": "大东区",
      "partnerId": "",
      "partnerName": "",
      "status": "active"
    }
  },
  "requestId": "req_20260603_xxx"
}
```

---

## 7. 权限与字典接口

### 7.1 获取当前权限范围

`GET /meta/permission-scope`

用途：

1. 让 AI-agent 确认当前绑定身份是谁。
2. 明确当前可见范围是全量、区域、渠道还是本人。
3. 便于前置提示和兜底文案生成。

响应示例：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "user": {
      "id": "A002",
      "name": "上海区管理员",
      "role": "admin"
    },
    "scopeType": "region",
    "regions": [
      "上海区（非金）"
    ],
    "partnerIds": [],
    "userIds": []
  },
  "requestId": "req_20260603_xxx"
}
```

### 7.2 获取字典

`GET /meta/dictionaries`

用途：

1. 获取角色字典
2. 获取对象状态字典
3. 获取渠道层级字典
4. 减少对方硬编码

响应示例：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "roles": [
      { "value": "superadmin", "label": "超级管理员" },
      { "value": "admin", "label": "区域管理员" },
      { "value": "partner_admin", "label": "渠道管理员" },
      { "value": "staff", "label": "员工" }
    ],
    "partnerLevels": [
      { "value": "none", "label": "未设置" },
      { "value": "primary", "label": "一级渠道" },
      { "value": "secondary", "label": "二级渠道" }
    ],
    "registrationStatuses": [
      { "value": "pending", "label": "待审批" },
      { "value": "approved", "label": "已通过" },
      { "value": "rejected", "label": "已驳回" }
    ]
  },
  "requestId": "req_20260603_xxx"
}
```

---

## 8. 用户接口

### 8.1 用户列表

`GET /users`

额外参数：

| 参数 | 类型 | 说明 |
|---|---|---|
| `role` | string | 角色过滤 |

响应字段重点：

`id` `username` `name` `role` `region` `bigRegion` `partnerId` `partnerName` `status`

### 8.2 用户详情

`GET /users/{id}`

---

## 9. 渠道接口

### 9.1 渠道列表

`GET /partners`

搜索字段建议：

1. `id`
2. `name`
3. `level`
4. `region`
5. `contact`
6. `phone`
7. `email`

响应字段重点：

`id` `name` `partnerLevel` `parentPartnerId` `parentPartnerIds` `region` `bigRegion` `status`

### 9.2 渠道详情

`GET /partners/{id}`

---

## 10. 客户报备接口

### 10.1 报备列表

`GET /registrations`

搜索字段建议：

1. `id`
2. `customer`
3. `industry`
4. `contact`
5. `phone`
6. `partnerName`
7. `createdByName`

响应字段重点：

`id` `customer` `contact` `phone` `creditCode` `status` `createdBy` `assignedStaffId` `partnerId` `region` `createdAt`

### 10.2 报备详情

`GET /registrations/{id}`

详情响应示例：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "REG-1717310000000",
    "customer": "上海XX公司",
    "project": "终端安全项目",
    "industry": "制造业",
    "contact": "张三",
    "phone": "13800138000",
    "creditCode": "9131XXXXXXXXXXXX",
    "status": "approved",
    "createdBy": "S002",
    "createdByName": "王小红",
    "assignedStaffId": "S002",
    "assignedStaffName": "王小红",
    "partnerId": "P002",
    "partnerName": "上海锐行信息",
    "assignedPartnerId": "P002",
    "assignedPartnerName": "上海锐行信息",
    "region": "上海区（非金）",
    "estimatedAmt": 800000,
    "signDate": "2026-07-01",
    "createdAt": "2026-06-03T10:00:00.000Z",
    "updatedAt": "2026-06-03T10:30:00.000Z"
  },
  "requestId": "req_20260603_xxx"
}
```

---

## 11. 商机接口

### 11.1 商机列表

`GET /opportunities`

搜索字段建议：

1. `id`
2. `name`
3. `customer`
4. `contact`
5. `phone`
6. `partnerName`
7. `createdByName`

说明：

1. `status` 参数在商机列表中实际过滤 `stage` 字段。
2. AI-agent 对接时建议按“阶段”理解该筛选条件。

### 11.2 商机详情

`GET /opportunities/{id}`

响应字段重点：

`id` `name` `customer` `stage` `amount` `expectedClose` `assignedStaffId` `partnerId` `regId` `quoteId` `createdAt`

---

## 12. 报价接口

### 12.1 报价列表

`GET /quotes`

搜索字段建议：

1. `id`
2. `customer`
3. `partnerName`
4. `createdByName`

响应字段重点：

`id` `oppId` `oppIds` `partnerId` `assignedStaffId` `status` `createdAt`

### 12.2 报价详情

`GET /quotes/{id}`

---

## 13. 订单接口

### 13.1 订单列表

`GET /orders`

搜索字段建议：

1. `id`
2. `customer`
3. `partnerName`
4. `createdByName`
5. `deliveryAddr`

响应字段重点：

`id` `partnerId` `parentPartnerId` `assignedPartnerId` `assignedStaffId` `status` `createdAt`

### 13.2 订单详情

`GET /orders/{id}`

---

## 14. 调用示例

### 14.1 获取 token

```bash
curl -X POST "https://crm.example.com/api/open/v1/auth/token" \
  -H "Content-Type: application/json" \
  -d '{
    "appKey": "oak_xxx",
    "appSecret": "oas_xxx"
  }'
```

### 14.2 查询最近 30 天本权限内的商机

```bash
curl "https://crm.example.com/api/open/v1/opportunities?pageNo=1&pageSize=20&createdAfter=2026-05-01T00:00:00.000Z" \
  -H "Authorization: Bearer openapi_xxx"
```

### 14.3 查询某渠道下的订单

```bash
curl "https://crm.example.com/api/open/v1/orders?pageNo=1&pageSize=20&partnerId=P002" \
  -H "Authorization: Bearer openapi_xxx"
```

---

## 15. 第一阶段验收口径

满足以下条件即可视为第一阶段 API 可开联调：

1. `auth/token`、`auth/me` 可用。
2. `meta/permission-scope`、`meta/dictionaries` 可用。
3. 六类对象列表和详情接口可用。
4. 权限裁剪结果与 CRM 页面口径一致。
5. 返回结构稳定、带 `requestId`、支持分页。
6. 审计日志可回溯外部调用记录。

---

## 16. 第二阶段预留

以下接口不在本契约实施范围内，但允许后续扩展：

1. 统计分析接口
2. 客户/商机/报价草稿写入接口
3. 审批触发接口
4. 企业微信身份映射辅助接口

---

## 17. 已补充的只读辅助接口

> 更新时间：2026-06-05  
> 说明：以下接口均为只读接口，沿用 `Authorization: Bearer {accessToken}`，并继续按当前 token 绑定的 CRM 用户权限裁剪数据。

### 17.1 身份查询

`GET /identity/users/{userId}`

用途：

1. 查询当前 CRM 用户身份上下文。
2. 返回角色、区域、大区、渠道、个人可见范围等权限口径。
3. 非超管只能查询当前绑定用户，避免误取其他用户权限上下文。

响应重点字段：

```json
{
  "id": "A030",
  "user_id": "A030",
  "username": "liulonghai",
  "name": "刘龙海",
  "role": "superadmin",
  "roleIds": ["superadmin"],
  "roleNames": ["超级管理员"],
  "scopeType": "all",
  "scopeDescription": "可查看全量数据",
  "regions": [],
  "bigRegions": [],
  "partnerIds": [],
  "userIds": []
}
```

### 17.2 联调诊断

`GET /diagnostics/self-check`

用途：

1. 检查当前 client、绑定用户、权限范围。
2. 检查字典数量。
3. 检查六类对象是否授权、可见数量和样例 ID。
4. 辅助联调排障，不返回敏感密钥、密码或业务详情。

### 17.3 单对象统计摘要

`GET /analytics/{resource}/summary`

当前支持：

1. `partners`
2. `registrations`
3. `opportunities`
4. `quotes`
5. `orders`

支持常用过滤参数：

1. `createdAfter`
2. `createdBefore`
3. `updatedAfter`
4. `updatedBefore`
5. `region`
6. `bigRegion`
7. `partnerId`
8. `assignedStaffId`
9. `ownerId`
10. `createdBy`
11. `status`
12. `stage`

返回内容：

1. `totalCount`
2. `totalAmount`
3. `byStatus`
4. `byRegion`
5. `byBigRegion`
6. `byMonth`
7. `topPartners`
8. `topStaff`
9. `dataSource`

### 17.4 转化漏斗

`GET /analytics/funnel/registration-opportunity-order`

用途：

按当前权限范围返回：

```text
客户报备 -> 商机 -> 报价 -> 订单
```

返回每个阶段数量、订单金额和阶段转化率。

### 17.5 经营总览

`GET /analytics/business-overview`

用途：

一次性返回当前权限范围内的渠道、客户报备、商机、报价、订单汇总，适合 AI-agent 做智能分析首页、经营概览、上下文预加载。

返回内容：

1. `summaries.partners`
2. `summaries.registrations`
3. `summaries.opportunities`
4. `summaries.quotes`
5. `summaries.orders`
6. `funnel`
7. `scope`

### 17.6 渠道贡献

`GET /analytics/partners/contribution`

用途：

按当前权限范围返回渠道维度贡献排行，包括：

1. 报备数量
2. 商机数量和金额
3. 报价数量和金额
4. 订单数量和金额

---

## 18. 通用筛选参数增强

截至 2026-06-05，列表与统计接口已增强支持以下通用筛选：

| 参数 | 说明 |
|---|---|
| `bigRegion` | 大区过滤 |
| `partnerId` | 渠道过滤，兼容 `partnerId / assignedPartnerId / parentPartnerId / parentPartnerIds` |
| `assignedStaffId` | 指派员工过滤 |
| `ownerId` | 负责人过滤 |
| `createdBy` | 创建人过滤 |
| `stage` | 商机阶段过滤 |
| `partnerLevel` | 渠道等级过滤 |

注意：所有筛选都只能在当前绑定 CRM 用户可见范围内生效，不能突破权限边界。

---

## 19. 2026-06-08 字段与统计接口增强

### 19.1 字段增强

| 对象 | 新增/标准化字段 |
|---|---|
| `users` | `roleName`、`wecomUserId`、`departmentId`、`departmentName` |
| `partners` | `shortName`、`partnerLevelName`、`isTechnicalServiceProvider`、`technicalServiceProviderType` |
| `opportunities` | `stageName`、`status`、`ownerId`、`ownerName` |
| `quotes` | `ownerId`、`ownerName`、`amount`、`totalAmount` |
| `orders` | `ownerId`、`ownerName`、`amount`、`totalAmount`、`dealAt` |

### 19.2 新增筛选

服务商列表和相关统计支持按是否技术服务商筛选：

```http
GET /api/open/v1/partners?isTechnicalServiceProvider=true
GET /api/open/v1/partners?isTechnicalServiceProvider=false
```

### 19.3 新增字典

```text
GET /api/open/v1/meta/dictionaries

technicalServiceProviderTypes:
- true: 技术服务商
- false: 非技术服务商
```

### 19.4 新增统计接口

```http
GET /api/open/v1/analytics/partners/profile
GET /api/open/v1/analytics/funnel
GET /api/open/v1/analytics/regions/contribution
GET /api/open/v1/analytics/owners/contribution
```

上述接口均沿用 OpenAPI token 鉴权、client 资源授权和绑定 CRM 用户权限裁剪。

---

## 20. 2026-06-08 角色权限与企微映射增强

### 20.1 用户字段增强

`GET /auth/me`、`GET /users`、`GET /users/{id}`、`GET /identity/users/{userId}` 均建议按以下增强字段适配：

| 字段 | 类型 | 说明 |
|---|---|---|
| `wecomUserId` | string | 企业微信 userid，无映射时为空字符串。 |
| `mobile` | string | 手机号兼容字段，由 `mobile || phone` 兜底。 |
| `email` | string | 邮箱。 |
| `roleName` | string | 单角色中文名。 |
| `roleIds` | array | 角色编码数组。 |
| `roleNames` | array | 角色中文名数组。 |
| `isAdmin` | boolean | `superadmin/admin` 为 `true`，其他为 `false`。 |
| `departmentId` | string | 部门 ID，无映射时为空。 |
| `departmentIds` | array | 部门 ID 数组，无映射时为空数组。 |
| `organizationId` | string | 组织 ID，无映射时为空。 |
| `organizationIds` | array | 组织 ID 数组，无映射时为空数组。 |
| `managedUserIds` | array | 当前用户权限范围内可见用户 ID。 |
| `ownerIds` | array | 当前用户可见负责人 ID，第一阶段与 `managedUserIds` 同步。 |

### 20.2 查询指定用户权限范围

`GET /users/{userId}/permission-scope`

说明：

1. 需要 OpenAPI client 具备 `users` 资源授权。
2. 只能查询当前 token 绑定 CRM 用户可见范围内的用户。
3. `userId` 支持 CRM 用户 `id` 或 `username`。

响应示例：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "user": {
      "id": "A013",
      "username": "admin_sd",
      "name": "山东区管理员",
      "role": "admin",
      "roleName": "区域管理员",
      "isAdmin": true,
      "wecomUserId": "",
      "departmentId": "",
      "organizationId": ""
    },
    "scopeType": "region",
    "isFullAccess": false,
    "regions": ["山东区"],
    "bigRegions": ["华东大区"],
    "partnerIds": ["P001"],
    "userIds": ["A013", "S022"],
    "ownerIds": ["A013", "S022"],
    "managedUserIds": ["A013", "S022"],
    "departmentIds": [],
    "organizationIds": [],
    "includeChildPartners": false,
    "description": "可查看本区域数据"
  },
  "requestId": "req_xxx"
}
```

### 20.3 查询角色权限矩阵

`GET /meta/role-permissions`

用途：

1. 返回 `superadmin/admin/partner_admin/staff` 四类角色的数据范围。
2. 返回六类对象的过滤规则。
3. 返回 AI-agent 做本地二次裁剪时建议依赖的稳定对象字段。

响应重点字段：

```json
{
  "roles": [
    {
      "role": "staff",
      "roleName": "员工",
      "isFullAccess": false,
      "scopeType": "user",
      "objectRules": {
        "registrations": "registration.createdBy == currentUser.id || registration.assignedStaffId == currentUser.id",
        "opportunities": "opportunity.createdBy == currentUser.id || opportunity.ownerId == currentUser.id || opportunity.assignedStaffId == currentUser.id"
      }
    }
  ],
  "stableObjectFields": [
    "ownerId",
    "assignedStaffId",
    "createdBy",
    "partnerId",
    "region",
    "bigRegion",
    "departmentId",
    "organizationId"
  ],
  "dataSource": "CRM_STANDARD_OPEN_API"
}
```

### 20.4 六类对象归属字段

用于 AI-agent 二次裁剪的归属字段已稳定输出：

| 对象 | 字段 |
|---|---|
| `partners` | `ownerId`、`ownerName`、`region`、`bigRegion`、`departmentId`、`organizationId`、`parentPartnerId`、`parentPartnerIds` |
| `registrations` | `ownerId`、`ownerName`、`assignedStaffId`、`assignedStaffName`、`createdBy`、`createdByName`、`partnerId`、`partnerName`、`region`、`bigRegion`、`departmentId`、`organizationId` |
| `opportunities` | `ownerId`、`ownerName`、`assignedStaffId`、`assignedStaffName`、`createdBy`、`createdByName`、`partnerId`、`partnerName`、`region`、`bigRegion`、`departmentId`、`organizationId` |
| `quotes` | `ownerId`、`ownerName`、`assignedStaffId`、`assignedStaffName`、`createdBy`、`createdByName`、`partnerId`、`partnerName`、`region`、`bigRegion`、`departmentId`、`organizationId` |
| `orders` | `ownerId`、`ownerName`、`assignedStaffId`、`assignedStaffName`、`createdBy`、`createdByName`、`partnerId`、`partnerName`、`region`、`bigRegion`、`departmentId`、`organizationId` |

---

## 21. 2026-06-09 客户主数据与智能分析增强

### 21.1 客户主数据接口

```http
GET /customers
GET /customers/{id}
GET /customers/{id}/registrations
GET /customers/{id}/opportunities
GET /customers/{id}/quotes
GET /customers/{id}/orders
```

说明：

1. 当前 `customers` 为 OpenAPI 只读客户主数据视图，由报备、商机、报价、订单归并生成。
2. 所有结果仍按当前 token 绑定 CRM 用户权限裁剪。
3. 新建 OpenAPI client 建议显式授权 `customers`；为兼容旧联调 client，已授权 `registrations` 的 client 也可访问 `customers` 视图。

### 21.2 客户字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` / `customerId` | string | 客户稳定 ID。 |
| `name` / `customer` | string | 客户名称。 |
| `createdAt` | string | 客户创建/最早业务时间。 |
| `updatedAt` | string | 客户更新/最近业务时间。 |
| `latestActivityAt` | string | 最近报备、商机、报价或订单活动时间。 |
| `status` / `statusName` | string | 生命周期状态及中文名。 |
| `region` / `bigRegion` | string | 区域/大区。 |
| `ownerId` / `ownerName` | string | 负责人。 |
| `assignedStaffId` / `assignedStaffName` | string | 分配员工。 |
| `partnerId` / `partnerName` | string | 关联服务商。 |
| `departmentId` / `departmentName` | string | 部门字段，无值时为空。 |
| `organizationId` | string | 组织字段，无值时为空。 |
| `source` | string | 来源对象或来源字段。 |
| `category` / `categoryName` | string | 客户分类，无值时为空。 |
| `hasRegistration` / `registrationCount` | boolean/int | 是否有报备及数量。 |
| `hasOpportunity` / `opportunityCount` | boolean/int | 是否有商机及数量。 |
| `hasQuote` / `quoteCount` | boolean/int | 是否有报价及数量。 |
| `hasOrder` / `orderCount` | boolean/int | 是否有订单及数量。 |
| `ageBucket` | string | 创建时长分桶：`0-30`、`31-90`、`91-180`、`180+`、`unknown`。 |
| `customerIdRule` | string | 客户 ID 生成规则。 |
| `matchKey` | string | 标准化名称匹配键。 |

### 21.3 跨对象客户关联键

`registrations`、`opportunities`、`quotes`、`orders` 已稳定输出：

```text
customerId
customerIdRule
```

`customerIdRule` 取值：

| 值 | 说明 |
|---|---|
| `customerId` | 对象已有真实客户 ID。 |
| `creditCodeHash` | 按统一社会信用代码/税号等生成稳定 ID。 |
| `normalizedNameHash` | 按标准化客户名称生成稳定 ID。 |
| `empty` | 缺少客户信息。 |

### 21.4 客户分析接口

```http
GET /analytics/customers/lifecycle
GET /analytics/customers/unregistered-opportunity
GET /analytics/customers/idle?idleDays=90
GET /analytics/customers/summary
```

说明：

1. `lifecycle` 返回客户生命周期、创建时长分布、沉睡客户样例。
2. `unregistered-opportunity` 返回未报备、未建商机、未报价、未下单统计。
3. `idle` 返回沉睡客户分页列表，`idleDays` 默认 90。
4. `summary` 复用通用摘要接口。

### 21.5 权限兼容路径

新增兼容路径：

```http
GET /auth/permission-scope
```

返回内容与：

```http
GET /meta/permission-scope
```

保持一致。

---

## 22. 只读库 Text-to-SQL 边界说明

当前标准 API 契约仍作为第一阶段正式对接契约。

关于只读库和 Text-to-SQL：

1. 第一阶段不把生产业务 SQLite 裸表作为正式对外契约。
2. 第一阶段不提供生产业务 SQLite 直连参数。
3. AI-agent 如需自然语言问数，建议先转为结构化查询参数并调用本契约中的 OpenAPI。
4. 后续如建设只读分析镜像，将另行补充分析库连接参数、语义视图 DDL、字段白名单、SQL 安全规则和同步说明。
5. Text-to-SQL 不得绕过 CRM 用户权限、资源授权、IP 白名单和审计要求。

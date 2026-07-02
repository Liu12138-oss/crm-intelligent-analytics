# 发给对方：联软 CRM 标准 OpenAPI 最新对接说明

> 日期：2026-06-05  
> 环境：SIT / 联调环境  
> 用途：提供给 crm-agent / AI-agent 团队进行接口适配、数据分析联调和权限验证。  
> 重要说明：当前接口均为只读查询与只读统计能力，不涉及客户、商机、报价、订单等业务写回。

---

## 1. 当前结论

联软 CRM 侧当前已可向 crm-agent 提供：

1. 标准 OpenAPI 鉴权。
2. 当前绑定 CRM 用户身份。
3. CRM 权限范围。
4. 字典与状态口径。
5. 用户、渠道商、客户报备、商机、报价单、订单六类对象明细查询。
6. 身份查询、联调诊断。
7. 渠道、客户报备、商机、报价单、订单的基础统计分析。
8. 报备 -> 商机 -> 报价 -> 订单转化漏斗。
9. 渠道贡献排行。
10. 经营总览。

所有接口都按当前 token 绑定的 CRM 用户做权限裁剪，crm-agent 不需要自行还原 CRM 权限逻辑。

---

## 2. Base URL

```text
http://10.18.16.114:3000/api/open/v1
```

说明：

1. `10.18.16.114` 为私网地址。
2. 当前为 SIT / 联调环境。
3. 当前服务已加载最新接口版本。
4. 后端最近一次重启生效时间：2026-06-05。
5. 后端当前监听端口：`3000`。

---

## 3. 白名单

已加入白名单：

```text
8.129.9.164
10.18.16.114
```

其中：

1. `8.129.9.164` 为对方 AI-agent 出口 IP。
2. `10.18.16.114` 为本地/内网联调 IP。

---

## 4. 鉴权方式

### 4.1 获取 token

```http
POST /auth/token
Content-Type: application/json
```

请求体：

```json
{
  "appKey": "oak_xxx",
  "appSecret": "oas_xxx"
}
```

响应重点：

```json
{
  "code": 0,
  "data": {
    "accessToken": "openapi_xxx",
    "expiresIn": 7200,
    "tokenType": "Bearer",
    "clientName": "AI-agent-superadmin-sit",
    "boundUser": {
      "id": "A030",
      "username": "liulonghai",
      "role": "superadmin"
    }
  }
}
```

### 4.2 后续请求 Header

```http
Authorization: Bearer {accessToken}
```

注意：

1. 后端重启后，旧 `accessToken` 会失效。
2. 如遇 `40102 access token invalid`，请重新调用 `/auth/token`。

---

## 5. 四组联调 client

| 视角 | clientName | 绑定用户 | 角色 | 用途 |
|---|---|---|---|---|
| 超管 | `AI-agent-superadmin-sit` | `A030 / liulonghai` | `superadmin` | 全量数据验证 |
| 区管 | `AI-agent-admin-sit` | `A013 / admin_sd` | `admin` | 山东区区域权限验证 |
| 渠道管理员 | `AI-agent-partner-admin-sit` | `PA001 / liangcui` | `partner_admin` | P001 渠道权限验证 |
| 员工 | `AI-agent-staff-sit` | `S022 / shangxichao` | `staff` | 个人权限验证 |

凭证详见《对外联调参数回传表》。如需安全传输，可单独发送 `appSecret`。

---

## 6. 当前可查业务数据

| 业务对象 | 列表接口 | 详情接口 | 当前超管可见数量 | 说明 |
|---|---|---|---:|---|
| 用户 | `GET /users` | `GET /users/{id}` | 61 | CRM 用户、角色、组织、渠道归属 |
| 渠道商 | `GET /partners` | `GET /partners/{id}` | 174 | 渠道基础资料、层级、区域、状态 |
| 客户报备 | `GET /registrations` | `GET /registrations/{id}` | 150 | 客户入口、报备状态、渠道归属 |
| 商机 | `GET /opportunities` | `GET /opportunities/{id}` | 44 | 商机金额、阶段、负责人、关联报备/报价 |
| 报价单 | `GET /quotes` | `GET /quotes/{id}` | 17 | 报价金额、状态、关联商机 |
| 订单 | `GET /orders` | `GET /orders/{id}` | 2 | 订单金额、状态、关联报价/商机 |

---

## 7. 可用于分析的重点字段

### 7.1 渠道商 `partners`

重点字段：

```text
id, name, partnerLevel, parentPartnerId, parentPartnerIds,
region, bigRegion, status, contact, phone, email,
quoteCount, orderCount, totalAmt, createdBy, createdAt, updatedAt
```

### 7.2 客户报备 `registrations`

重点字段：

```text
id, customer, creditCode, industry, contact, phone, city,
status, region, bigRegion, createdBy, createdByName,
partnerId, partnerName, assignedPartnerId, assignedPartnerName,
assignedStaffId, assignedStaffName, hasOpportunity,
createdAt, updatedAt, approvedAt, expireAt
```

### 7.3 商机 `opportunities`

重点字段：

```text
id, name, customer, industry, contact, phone,
stage, amount, expectedClose, source,
ownerId, owner, createdBy, createdByName,
assignedStaffId, assignedStaffName,
partnerId, partnerName, assignedPartnerId, assignedPartnerName,
region, bigRegion, regId, quoteId,
createdAt, updatedAt
```

### 7.4 报价单 `quotes`

重点字段：

```text
id, customer, customerName, regId, oppId, oppIds,
amount, total, originalTotal, discountAmount,
status, endpoints, products, quoteMode,
ownerId, createdBy, createdByName,
assignedStaffId, assignedStaffName,
partnerId, partnerName, assignedPartnerId, assignedPartnerName,
region, bigRegion, createdAt, updatedAt
```

### 7.5 订单 `orders`

重点字段：

```text
id, customer, customerName, quoteId, oppId, regId,
amount, total, status, deliveryAddr, contacts,
createdBy, createdByName,
assignedStaffId, assignedStaffName,
partnerId, partnerName, parentPartnerId,
assignedPartnerId, assignedPartnerName,
region, bigRegion, createdAt, updatedAt
```

---

## 8. 对象关联关系

建议 crm-agent 按以下关系做跨对象分析：

| 来源 | 目标 | 关联字段 |
|---|---|---|
| 用户 | 渠道商 | `users.partnerId = partners.id` |
| 客户报备 | 商机 | `opportunities.regId = registrations.id` |
| 商机 | 报价单 | `quotes.oppId / quotes.oppIds = opportunities.id`，或 `opportunities.quoteId = quotes.id` |
| 报价单 | 订单 | `orders.quoteId = quotes.id` |
| 商机 | 订单 | `orders.oppId = opportunities.id` |
| 渠道商 | 报备/商机/报价/订单 | `partnerId / assignedPartnerId / parentPartnerId / parentPartnerIds` |
| 员工 | 报备/商机/报价/订单 | `createdBy / ownerId / assignedStaffId` |

---

## 9. 通用筛选参数

列表接口和统计接口均支持以下常用筛选：

| 参数 | 说明 |
|---|---|
| `pageNo` | 页码 |
| `pageSize` | 每页数量，当前最大 200 |
| `keyword` | 关键词模糊搜索 |
| `createdAfter` | 创建时间开始 |
| `createdBefore` | 创建时间结束 |
| `updatedAfter` | 更新时间开始 |
| `updatedBefore` | 更新时间结束 |
| `region` | 区域 |
| `bigRegion` | 大区 |
| `partnerId` | 渠道 |
| `assignedStaffId` | 指派员工 |
| `ownerId` | 负责人 |
| `createdBy` | 创建人 |
| `status` | 状态 |
| `stage` | 商机阶段 |
| `partnerLevel` | 渠道等级 |
| `sortBy` | 排序字段 |
| `sortOrder` | `asc` / `desc` |

说明：所有筛选只能在当前绑定用户权限范围内生效，不能突破 CRM 权限边界。

---

## 10. 统计分析接口

### 10.1 单对象统计摘要

```http
GET /analytics/{resource}/summary
```

当前 `resource` 支持：

```text
partners
registrations
opportunities
quotes
orders
```

返回内容：

1. `totalCount`
2. `totalAmount`
3. `byStatus`
4. `byRegion`
5. `byBigRegion`
6. `byMonth`
7. `topCustomers`
8. `topPartners`
9. `topStaff`
10. `topOwners`
11. `dataSource`

示例：

```http
GET /analytics/opportunities/summary?region=山东区&createdAfter=2026-05-01T00:00:00.000Z
```

### 10.2 经营总览

```http
GET /analytics/business-overview
```

用途：

一次性返回当前权限范围内的渠道、客户报备、商机、报价单、订单汇总，以及转化漏斗。

适合：

1. 智能分析首页。
2. 自然语言问数上下文预加载。
3. “当前经营情况怎么样”这类总览问题。

### 10.3 转化漏斗

```http
GET /analytics/funnel/registration-opportunity-order
```

返回：

```text
客户报备 -> 商机 -> 报价 -> 订单
```

### 10.4 渠道贡献

```http
GET /analytics/partners/contribution
```

返回渠道维度：

1. 报备数量。
2. 商机数量和金额。
3. 报价数量和金额。
4. 订单数量和金额。

---

## 11. 身份、权限和诊断接口

| 接口 | 用途 |
|---|---|
| `GET /auth/me` | 查看当前 token 绑定 client 和 CRM 用户 |
| `GET /meta/permission-scope` | 查看当前 CRM 用户权限范围 |
| `GET /meta/dictionaries` | 查看角色、状态、区域、大区、渠道等级等字典 |
| `GET /identity/users/{userId}` | 查询 CRM 身份上下文，非超管只能查当前绑定用户 |
| `GET /diagnostics/self-check` | 联调自检，返回授权资源、可见数量、样例 ID |

---

## 12. 当前已复测结果

复测时间：2026-06-05  
复测环境：`http://10.18.16.114:3000/api/open/v1`

| 项目 | 结果 |
|---|---|
| 业务登录 | 通过 |
| `POST /auth/token` | 通过 |
| `GET /auth/me` | 通过 |
| `GET /meta/permission-scope` | 通过 |
| `GET /meta/dictionaries` | 通过，含 `regions`、`bigRegions` |
| `GET /partners` | 通过，超管可见 174 |
| `GET /registrations` | 通过，超管可见 150 |
| `GET /opportunities` | 通过，超管可见 44 |
| `GET /quotes` | 通过，超管可见 17 |
| `GET /orders` | 通过，超管可见 2 |
| `GET /analytics/partners/summary` | 通过 |
| `GET /analytics/business-overview` | 通过 |
| `GET /analytics/funnel/registration-opportunity-order` | 通过 |
| `GET /analytics/partners/contribution` | 通过 |

---

## 13. 对方建议测试顺序

1. `POST /auth/token`
2. `GET /auth/me`
3. `GET /meta/permission-scope`
4. `GET /meta/dictionaries`
5. `GET /diagnostics/self-check`
6. `GET /partners?pageNo=1&pageSize=1`
7. `GET /registrations?pageNo=1&pageSize=1`
8. `GET /opportunities?pageNo=1&pageSize=1`
9. `GET /quotes?pageNo=1&pageSize=1`
10. `GET /orders?pageNo=1&pageSize=1`
11. `GET /analytics/business-overview`
12. 分别用 4 组 client 验证权限差异。

---

## 14. 注意事项

1. 当前接口为联调环境，只读开放。
2. `appSecret` 请不要写入前端或日志。
3. 后端重启后旧 token 会失效，请重新获取 token。
4. 如出现 404，请先确认 Base URL 是否包含 `/api/open/v1`。
5. 如出现 403，请检查来源 IP、client 授权资源和绑定用户状态。
6. 如出现数据量差异，以当前 token 绑定 CRM 用户权限范围为准。

---

## 15. 2026-06-08 字段完善补充

对照贵方《联软CRM-需补充完善字段与资料清单》，本轮已补充以下 OpenAPI 输出字段：

| 对象 | 补充字段 |
|---|---|
| 用户 | `roleName`、`wecomUserId`、`departmentId`、`departmentName` |
| 服务商/渠道商 | `shortName`、`partnerLevelName`、`isTechnicalServiceProvider`、`technicalServiceProviderType` |
| 商机 | `stageName`、`status`、`ownerId`、`ownerName` |
| 报价 | `ownerId`、`ownerName`、`amount`、`totalAmount` |
| 订单 | `ownerId`、`ownerName`、`amount`、`totalAmount`、`dealAt` |

服务商是否技术服务商支持筛选：

```http
GET /partners?isTechnicalServiceProvider=true
GET /partners?isTechnicalServiceProvider=false
```

字典已补充：

```text
technicalServiceProviderTypes
```

新增统计接口：

```http
GET /analytics/partners/profile
GET /analytics/funnel
GET /analytics/regions/contribution
GET /analytics/owners/contribution
```

仍需双方继续确认：

1. CRM 用户与企微 `userid` 映射资料。
2. 四类角色可见/不可见样例数据 ID。
3. 订单 `dealAt` 最终业务口径。
4. 生产环境 Base URL 与内外网访问方式。

---

## 16. 2026-06-08 角色权限与企微映射补充

对照贵方《联软CRM-角色权限与企微映射字段补充清单》，本轮继续补齐以下接口和字段：

```http
GET /users/{userId}/permission-scope
GET /meta/role-permissions
```

用户对象新增/稳定返回：

```text
wecomUserId、mobile、email、roleName、roleIds、roleNames、isAdmin、
departmentId、departmentIds、organizationId、organizationIds、
managedUserIds、ownerIds
```

六类对象稳定返回以下二次裁剪字段：

```text
ownerId、ownerName、assignedStaffId、assignedStaffName、createdBy、createdByName、
partnerId、partnerName、region、bigRegion、departmentId、organizationId
```

建议贵方本轮额外验证：

1. `GET /meta/role-permissions`
2. `GET /users?pageNo=1&pageSize=5`
3. `GET /users/{userId}/permission-scope`
4. `GET /identity/users/{userId}`
5. 六类对象各拉 1 条，检查归属字段是否稳定出现。

---

## 17. 2026-06-09 智能分析全量补充

对照贵方《发给联软CRM-智能分析OpenAPI全量补充清单》，本轮补充客户主数据视图、跨对象客户关联键和客户生命周期分析接口。

新增接口：

```http
GET /customers
GET /customers/{id}
GET /customers/{id}/registrations
GET /customers/{id}/opportunities
GET /customers/{id}/quotes
GET /customers/{id}/orders
GET /auth/permission-scope
GET /analytics/customers/lifecycle
GET /analytics/customers/unregistered-opportunity
GET /analytics/customers/idle
GET /analytics/customers/summary
```

新增/稳定字段：

```text
customers:
id、customerId、name、createdAt、updatedAt、latestActivityAt、
status、statusName、region、bigRegion、ownerId、ownerName、
assignedStaffId、assignedStaffName、partnerId、partnerName、
departmentId、departmentName、organizationId、source、category、
categoryName、hasRegistration、hasOpportunity、hasQuote、hasOrder、
registrationCount、opportunityCount、quoteCount、orderCount、ageBucket、
customerIdRule、matchKey

registrations/opportunities/quotes/orders:
customerId、customerIdRule
```

客户 ID 生成规则：

1. 优先使用对象已有 `customerId/customer_id`。
2. 其次按统一社会信用代码/税号生成稳定 ID。
3. 再按标准化客户名称生成稳定 ID。
4. 缺少客户信息时为空。

兼容说明：

1. 当前 `customers` 为只读客户视图，不改 CRM 业务表。
2. 新建 client 建议显式授权 `customers`。
3. 已授权 `registrations` 的旧联调 client 可兼容访问 `customers`，避免现有联调凭证立即 403。

---

## 18. 2026-06-09 只读库 Text-to-SQL 补充口径

对照贵方《只读库 Text-to-SQL 接入资料清单与我方实施方案》，联软 CRM 当前建议如下：

1. 第一阶段正式联调仍以标准 OpenAPI 为主。
2. 当前不提供生产业务 SQLite 的直连账号、文件路径或裸表访问权限。
3. 如果后续需要 Text-to-SQL，建议建设受控只读分析镜像或 MySQL 语义视图层。
4. Text-to-SQL 阶段必须由程序做字段白名单、SQL 只读校验、权限注入、脱敏、超时、LIMIT 和审计。
5. 当前可先提供 OpenAPI 字段字典、指标口径、权限规则、样例数据和对象关系，供 AI-agent 建立语义层。

配套回复文档：

```text
发给crm-agent-联软CRM只读库Text-to-SQL接入回复与落地建议.md
```

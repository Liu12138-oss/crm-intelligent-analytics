# 发给 crm-agent：联软 CRM 智能分析 OpenAPI 全量补充回复

> 日期：2026-06-09  
> 对应材料：《发给联软CRM-智能分析OpenAPI全量补充清单》  
> 适用对象：crm-agent / AI-agent 智能分析联调团队  
> 说明：本文不包含明文 `appSecret`。OpenAPI 凭证仍通过 CRM OpenAPI 管理页创建或重置后一次性交付。

## 1. 总体结论

联软 CRM 本轮已按清单补充智能分析所需的客户主数据视图、跨对象客户关联键、客户生命周期/反关联统计接口和权限兼容接口。

本轮不改 CRM 业务表结构，不写业务数据，不影响原 CRM 页面功能。`customers` 采用只读兼容视图方式生成：

```text
registrations / opportunities / quotes / orders
  -> 按 customerId / 信用代码 / 标准化客户名称生成稳定客户 ID
  -> 合并为 OpenAPI customers 客户主数据视图
  -> 按当前 accessToken 绑定 CRM 用户权限裁剪后返回
```

## 2. 本轮新增接口

| 接口 | 状态 | 说明 |
|---|---|---|
| `GET /customers` | 已补 | 客户主数据列表，当前为只读客户视图。 |
| `GET /customers/{id}` | 已补 | 客户详情。 |
| `GET /customers/{id}/registrations` | 已补 | 客户关联报备。 |
| `GET /customers/{id}/opportunities` | 已补 | 客户关联商机。 |
| `GET /customers/{id}/quotes` | 已补 | 客户关联报价。 |
| `GET /customers/{id}/orders` | 已补 | 客户关联订单。 |
| `GET /auth/permission-scope` | 已补 | 兼容清单路径，返回内容同 `/meta/permission-scope`。 |
| `GET /analytics/customers/lifecycle` | 已补 | 客户生命周期总览。 |
| `GET /analytics/customers/unregistered-opportunity` | 已补 | 未报备/未建商机/未报价/未下单客户统计。 |
| `GET /analytics/customers/idle` | 已补 | 沉睡客户列表，支持 `idleDays`。 |

已有并继续可用：

```http
GET /auth/me
GET /meta/permission-scope
GET /meta/dictionaries
GET /meta/role-permissions
GET /users
GET /partners
GET /registrations
GET /opportunities
GET /quotes
GET /orders
GET /analytics/partners/contribution
GET /analytics/partners/profile
GET /analytics/funnel
GET /analytics/regions/contribution
GET /analytics/owners/contribution
```

## 3. 客户主数据字段

`GET /customers` 返回字段如下：

| 字段 | 说明 |
|---|---|
| `id` / `customerId` | 客户稳定 ID。 |
| `name` / `customer` | 客户名称。 |
| `createdAt` | 客户视图创建时间，按该客户最早业务记录时间兜底。 |
| `updatedAt` | 客户视图更新时间，按最近业务记录时间兜底。 |
| `latestActivityAt` | 最近报备/商机/报价/订单活动时间。 |
| `status` / `statusName` | 生命周期状态及中文名，如 `registered/已报备`、`ordered/已下单`。 |
| `region` / `bigRegion` | 区域/大区。 |
| `ownerId` / `ownerName` | 负责人。 |
| `assignedStaffId` / `assignedStaffName` | 分配员工。 |
| `partnerId` / `partnerName` | 关联服务商。 |
| `departmentId` / `departmentName` | 部门字段，无数据时为空。 |
| `organizationId` | 组织字段，无数据时为空。 |
| `source` | 客户来源，当前按来源对象兜底。 |
| `category` / `categoryName` | 客户分类，无数据时为空。 |
| `hasRegistration` / `registrationCount` | 是否有报备及数量。 |
| `hasOpportunity` / `opportunityCount` | 是否有商机及数量。 |
| `hasQuote` / `quoteCount` | 是否有报价及数量。 |
| `hasOrder` / `orderCount` | 是否有订单及数量。 |
| `ageBucket` | 创建时长分桶：`0-30`、`31-90`、`91-180`、`180+`、`unknown`。 |
| `customerIdRule` | 客户 ID 生成规则。 |
| `matchKey` | 标准化客户名称匹配键。 |

## 4. 客户 ID 与跨对象关联规则

为支持反关联分析，报备、商机、报价、订单已稳定输出：

```text
customerId
customerIdRule
```

当前 `customerId` 生成优先级：

| 优先级 | 规则 | `customerIdRule` |
|---:|---|---|
| 1 | 对象已有 `customerId/customer_id` | `customerId` |
| 2 | 有统一社会信用代码/税号等字段 | `creditCodeHash` |
| 3 | 使用标准化客户名称生成稳定哈希 | `normalizedNameHash` |
| 4 | 无客户信息 | `empty` |

说明：

1. 当前历史库没有独立客户主表时，`customers` 是 OpenAPI 只读兼容视图。
2. 若后续 CRM 补真实客户主表，`customerIdRule=customerId` 会优先使用真实主键。
3. 同名客户历史脏数据仍建议后续由业务侧补充信用代码或真实客户 ID，以减少名称归并误差。

## 5. 新增客户分析接口

### 5.1 客户生命周期

```http
GET /api/open/v1/analytics/customers/lifecycle
```

返回：

```text
totalCount、idleCount、noRegistrationCount、noOpportunityCount、
noQuoteCount、noOrderCount、byStatus、byAgeBucket、byRegion、
byBigRegion、byOwner、byPartner、idleSamples
```

### 5.2 未报备/未建商机统计

```http
GET /api/open/v1/analytics/customers/unregistered-opportunity
```

返回：

```text
noRegistrationCount、noOpportunityCount、noQuoteCount、noOrderCount、
noRegistrationByAgeBucket、noOpportunityByOwner、noOpportunityByRegion、samples
```

### 5.3 沉睡客户

```http
GET /api/open/v1/analytics/customers/idle?idleDays=90&pageNo=1&pageSize=20
```

说明：

1. `idleDays` 默认 90。
2. 根据 `latestActivityAt || updatedAt || createdAt` 判断。
3. 返回分页列表和 `total`。

## 6. 字典补充

`GET /meta/dictionaries` 已补充：

```text
customerStatuses
customerCategories
```

已有并继续返回：

```text
roles、regions、bigRegions、partnerLevels、technicalServiceProviderTypes、
registrationStatuses、opportunityStages、quoteStatuses、orderStatuses
```

## 7. 权限与授权说明

所有新增接口仍按当前 `accessToken` 绑定 CRM 用户裁剪：

| 角色 | 范围 |
|---|---|
| `superadmin` | 全量。 |
| `admin` | 本区域。 |
| `partner_admin` | 本渠道及关联下级渠道。 |
| `staff` | 本人创建、负责或分配的数据。 |

兼容说明：

1. 新增资源名为 `customers`。
2. 为兼容已创建的 4 组联调 client，如 client 已授权 `registrations`，也允许访问当前由报备/业务链路生成的 `customers` 视图。
3. 后续新建 client 建议显式加入 `customers`。

## 8. 建议对方本轮验证顺序

1. `POST /auth/token`
2. `GET /auth/me`
3. `GET /auth/permission-scope`
4. `GET /meta/dictionaries`
5. `GET /customers?pageNo=1&pageSize=5`
6. `GET /customers/{id}`
7. `GET /customers/{id}/registrations`
8. `GET /customers/{id}/opportunities`
9. `GET /customers/{id}/quotes`
10. `GET /customers/{id}/orders`
11. `GET /analytics/customers/lifecycle`
12. `GET /analytics/customers/unregistered-opportunity`
13. `GET /analytics/customers/idle?idleDays=90`
14. 使用超管、区管、渠道管理员、员工 4 组 client 验证权限差异。

## 9. 仍需后续业务侧完善项

| 项 | 当前处理 | 后续建议 |
|---|---|---|
| 真实客户主表 | 当前为 OpenAPI 兼容视图 | 后续如 CRM 有客户主表，可直接映射真实 `customerId`。 |
| 同名客户去重 | 当前名称标准化哈希兜底 | 建议补统一社会信用代码或真实客户 ID。 |
| 客户分类 | 字段已预留 | 建议业务侧维护 `category/categoryName`。 |
| 部门/组织树 | 字段已预留 | 后续按企微/组织架构映射维护。 |
| 样例数据 | 接口已支持 | 建议补 10 个客户完整链路样例，覆盖未报备、已报备、已商机、已报价、已下单。 |

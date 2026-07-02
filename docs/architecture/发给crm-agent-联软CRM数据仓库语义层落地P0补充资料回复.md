# 发给 crm-agent：联软 CRM 数据仓库语义层落地 P0 补充资料回复

> 日期：2026-06-09  
> 对应贵方文档：《发给联软CRM-数据仓库语义层落地P0补充资料清单》  
> 用途：提供 AI-agent 建设 MySQL 分析库、ODS/DWD/DWS、语义层字段目录和受控 Text-to-SQL 所需的 P0 资料。  
> 说明：本文不包含明文 `appSecret`、Token、数据库密码、机器人 Secret 或生产库连接信息。

---

## 1. 本轮回复结论

联软 CRM 侧确认配合贵方进入 P0/P1 落地。

当前可先提供：

1. OpenAPI 同步对象、分页、增量参数和同步顺序。
2. P0 对象字段白名单和字段中文含义。
3. 客户、伙伴、报备、商机、报价、订单主键与关联关系。
4. MVP 指标口径和金额/时间字段优先级。
5. 四类账号权限口径和权限字段。
6. 敏感字段同步、分析、展示和脱敏规则初稿。
7. 企微 `userid` 与 CRM 用户映射字段结构。
8. 首批 20 条高频问题回归集。

2026-06-09 追加确认：

1. 权限桥表已稳定输出 `scopeType / regions / bigRegions / partnerIds / userIds / ownerIds / managedUserIds`。
2. 报价、订单已补齐标准化 `region / bigRegion` 输出和权限过滤兜底，支持从关联商机、报价、渠道、负责人继承。
3. 字段全量清单、关系口径、指标口径、字典枚举、四类角色样例问题已整理到《发给 crm-agent：联软 CRM 权限、字段、关系、指标、字典、样例补充回复》。

仍需联调环境实测后补充：

1. 六类样例数据 ID。
2. 四类账号权限矩阵实测值。
3. 20 条高频问题的当前期望结果。
4. 正式企微 `userid` 映射清单。
5. 敏感字段最终业务确认。

---

## 2. OpenAPI 同步通道

### 2.1 Base URL

```text
http://10.18.16.114:3000/api/open/v1
```

### 2.2 鉴权方式

```http
POST /auth/token
Authorization: Bearer {accessToken}
```

Token 默认有效期：

```text
7200 秒
```

### 2.3 推荐同步顺序

| 顺序 | 接口 | 用途 |
|---:|---|---|
| 1 | `GET /meta/dictionaries` | 字典枚举、状态中文名、区域/大区 |
| 2 | `GET /meta/role-permissions` | 角色权限矩阵、二次裁剪字段 |
| 3 | `GET /users` | 用户、角色、区域、伙伴、企微映射字段 |
| 4 | `GET /partners` | 渠道/伙伴/服务商 |
| 5 | `GET /customers` | 客户只读视图 |
| 6 | `GET /registrations` | 客户报备 |
| 7 | `GET /opportunities` | 商机 |
| 8 | `GET /quotes` | 报价 |
| 9 | `GET /orders` | 订单 |
| 10 | `GET /meta/permission-scope` | 当前 client 绑定用户权限快照 |

### 2.4 分页和增量参数

| 参数 | 类型 | 默认 | 最大值 | 说明 |
|---|---|---:|---:|---|
| `pageNo` | int | `1` | - | 页码，从 1 开始 |
| `pageSize` | int | `20` | `200` | 每页数量 |
| `createdAfter` | datetime | - | - | 创建时间起 |
| `createdBefore` | datetime | - | - | 创建时间止 |
| `updatedAfter` | datetime | - | - | 更新时间起 |
| `updatedBefore` | datetime | - | - | 更新时间止 |
| `sortBy` | string | `updatedAt` | - | 排序字段 |
| `sortOrder` | string | `desc` | - | `asc` / `desc` |

增量同步建议：

```http
GET /opportunities?pageNo=1&pageSize=200&updatedAfter=2026-06-09T00:00:00.000Z&sortBy=updatedAt&sortOrder=asc
```

---

## 3. P0 字段白名单

以下字段建议作为 AI-agent ODS/DWD 和语义层 P0 白名单。未列字段可先进入 ODS 原始 JSON，但不建议进入语义层、Text-to-SQL 白名单或企微展示。

### 3.1 用户 `users`

| 字段 | 中文名 | 类型 | 主键 | 关联键 | 可同步 | 可分析 | 可展示 | 脱敏 |
|---|---|---|---|---|---|---|---|---|
| `id` | CRM 用户 ID | string | 是 | 是 | 是 | 是 | 是 | 否 |
| `username` | 登录账号 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `name` | 姓名 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `role` | 角色编码 | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `roleName` | 角色名称 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `roleIds` | 角色编码数组 | array | 否 | 否 | 是 | 是 | 否 | 否 |
| `roleNames` | 角色名称数组 | array | 否 | 否 | 是 | 是 | 否 | 否 |
| `isAdmin` | 是否管理类账号 | boolean | 否 | 否 | 是 | 是 | 是 | 否 |
| `status` | 用户状态 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `wecomUserId` | 企业微信 userid | string | 否 | 是 | 是 | 是 | 否 | 是 |
| `mobile` | 手机号 | string | 否 | 否 | 是 | 否 | 权限展示 | 是 |
| `phone` | 联系电话 | string | 否 | 否 | 是 | 否 | 权限展示 | 是 |
| `email` | 邮箱 | string | 否 | 否 | 是 | 否 | 权限展示 | 是 |
| `departmentId` | 部门 ID | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `departmentName` | 部门名称 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `departmentIds` | 部门 ID 数组 | array | 否 | 是 | 是 | 是 | 否 | 否 |
| `organizationId` | 组织 ID | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `organizationIds` | 组织 ID 数组 | array | 否 | 是 | 是 | 是 | 否 | 否 |
| `region` | 区域 | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `bigRegion` | 大区 | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `partnerId` | 所属伙伴 ID | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `partnerName` | 所属伙伴名称 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `managedUserIds` | 可见用户 ID | array | 否 | 是 | 是 | 是 | 否 | 否 |
| `ownerIds` | 可见负责人 ID | array | 否 | 是 | 是 | 是 | 否 | 否 |
| `createdAt` | 创建时间 | datetime | 否 | 否 | 是 | 是 | 否 | 否 |
| `updatedAt` | 更新时间 | datetime | 否 | 否 | 是 | 是 | 否 | 否 |

### 3.2 伙伴/服务商 `partners`

| 字段 | 中文名 | 类型 | 主键 | 关联键 | 可同步 | 可分析 | 可展示 | 脱敏 |
|---|---|---|---|---|---|---|---|---|
| `id` | 伙伴 ID | string | 是 | 是 | 是 | 是 | 是 | 否 |
| `name` | 伙伴名称 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `shortName` | 伙伴简称 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `partnerLevel` | 伙伴等级编码 | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `partnerLevelName` | 伙伴等级名称 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `parentPartnerId` | 上级伙伴 ID | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `parentPartnerIds` | 上级伙伴链 | array | 否 | 是 | 是 | 是 | 否 | 否 |
| `region` | 区域 | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `bigRegion` | 大区 | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `contact` | 联系人 | string | 否 | 否 | 是 | 否 | 权限展示 | 是 |
| `phone` | 联系电话 | string | 否 | 否 | 是 | 否 | 权限展示 | 是 |
| `email` | 邮箱 | string | 否 | 否 | 是 | 否 | 权限展示 | 是 |
| `status` | 状态 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `joinDate` | 加入日期 | date | 否 | 否 | 是 | 是 | 是 | 否 |
| `isTechnicalServiceProvider` | 是否技术服务商 | boolean | 否 | 否 | 是 | 是 | 是 | 否 |
| `technicalServiceProviderType` | 技术服务商类型 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `ownerId` | 负责人 ID | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `ownerName` | 负责人姓名 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `departmentId` | 部门 ID | string | 否 | 是 | 是 | 是 | 否 | 否 |
| `organizationId` | 组织 ID | string | 否 | 是 | 是 | 是 | 否 | 否 |
| `createdBy` | 创建人 ID | string | 否 | 是 | 是 | 是 | 否 | 否 |
| `createdAt` | 创建时间 | datetime | 否 | 否 | 是 | 是 | 否 | 否 |
| `updatedAt` | 更新时间 | datetime | 否 | 否 | 是 | 是 | 否 | 否 |

### 3.3 客户 `customers`

`customers` 是 OpenAPI 只读客户视图，由报备、商机、报价、订单归并生成。

| 字段 | 中文名 | 类型 | 主键 | 关联键 | 可同步 | 可分析 | 可展示 | 脱敏 |
|---|---|---|---|---|---|---|---|---|
| `id` | 客户 ID | string | 是 | 是 | 是 | 是 | 是 | 否 |
| `customerId` | 客户关联 ID | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `name` | 客户名称 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `customer` | 客户名称兼容字段 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `status` | 生命周期状态 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `statusName` | 生命周期状态名称 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `region` | 区域 | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `bigRegion` | 大区 | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `ownerId` | 负责人 ID | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `ownerName` | 负责人姓名 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `assignedStaffId` | 指派员工 ID | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `assignedStaffName` | 指派员工姓名 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `partnerId` | 伙伴 ID | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `partnerName` | 伙伴名称 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `departmentId` | 部门 ID | string | 否 | 是 | 是 | 是 | 否 | 否 |
| `departmentName` | 部门名称 | string | 否 | 否 | 是 | 是 | 否 | 否 |
| `organizationId` | 组织 ID | string | 否 | 是 | 是 | 是 | 否 | 否 |
| `source` | 来源对象 | string | 否 | 否 | 是 | 是 | 否 | 否 |
| `category` | 客户分类编码 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `categoryName` | 客户分类名称 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `hasRegistration` | 是否有报备 | boolean | 否 | 否 | 是 | 是 | 是 | 否 |
| `registrationCount` | 报备数量 | number | 否 | 否 | 是 | 是 | 是 | 否 |
| `hasOpportunity` | 是否有商机 | boolean | 否 | 否 | 是 | 是 | 是 | 否 |
| `opportunityCount` | 商机数量 | number | 否 | 否 | 是 | 是 | 是 | 否 |
| `hasQuote` | 是否有报价 | boolean | 否 | 否 | 是 | 是 | 是 | 否 |
| `quoteCount` | 报价数量 | number | 否 | 否 | 是 | 是 | 是 | 否 |
| `hasOrder` | 是否有订单 | boolean | 否 | 否 | 是 | 是 | 是 | 否 |
| `orderCount` | 订单数量 | number | 否 | 否 | 是 | 是 | 是 | 否 |
| `ageBucket` | 创建时长分桶 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `customerIdRule` | 客户 ID 生成规则 | string | 否 | 否 | 是 | 是 | 否 | 否 |
| `matchKey` | 名称匹配键 | string | 否 | 否 | 是 | 是 | 否 | 否 |
| `createdAt` | 最早业务时间 | datetime | 否 | 否 | 是 | 是 | 是 | 否 |
| `updatedAt` | 最近更新时间 | datetime | 否 | 否 | 是 | 是 | 否 | 否 |
| `latestActivityAt` | 最近活动时间 | datetime | 否 | 否 | 是 | 是 | 是 | 否 |

### 3.4 报备 `registrations`

| 字段 | 中文名 | 类型 | 主键 | 关联键 | 可同步 | 可分析 | 可展示 | 脱敏 |
|---|---|---|---|---|---|---|---|---|
| `id` | 报备 ID | string | 是 | 是 | 是 | 是 | 是 | 否 |
| `customerId` | 客户 ID | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `customerIdRule` | 客户 ID 规则 | string | 否 | 否 | 是 | 是 | 否 | 否 |
| `customer` | 客户名称 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `project` | 项目名称 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `industry` | 行业 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `contact` | 联系人 | string | 否 | 否 | 是 | 否 | 权限展示 | 是 |
| `phone` | 联系电话 | string | 否 | 否 | 是 | 否 | 权限展示 | 是 |
| `creditCode` | 统一社会信用代码 | string | 否 | 是 | 是 | 否 | 权限展示 | 是 |
| `status` | 报备状态 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `ownerId` | 负责人 ID | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `ownerName` | 负责人姓名 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `createdBy` | 创建人 ID | string | 否 | 是 | 是 | 是 | 否 | 否 |
| `createdByName` | 创建人姓名 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `assignedStaffId` | 指派员工 ID | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `assignedStaffName` | 指派员工姓名 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `partnerId` | 伙伴 ID | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `partnerName` | 伙伴名称 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `assignedPartnerId` | 归属伙伴 ID | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `assignedPartnerName` | 归属伙伴名称 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `region` | 区域 | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `bigRegion` | 大区 | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `estimatedAmt` | 预计金额 | number | 否 | 否 | 是 | 是 | 权限展示 | 否 |
| `signDate` | 预计签约时间 | date | 否 | 否 | 是 | 是 | 是 | 否 |
| `approvedAt` | 审批时间 | datetime | 否 | 否 | 是 | 是 | 否 | 否 |
| `departmentId` | 部门 ID | string | 否 | 是 | 是 | 是 | 否 | 否 |
| `organizationId` | 组织 ID | string | 否 | 是 | 是 | 是 | 否 | 否 |
| `createdAt` | 创建时间 | datetime | 否 | 否 | 是 | 是 | 是 | 否 |
| `updatedAt` | 更新时间 | datetime | 否 | 否 | 是 | 是 | 否 | 否 |

### 3.5 商机 `opportunities`

| 字段 | 中文名 | 类型 | 主键 | 关联键 | 可同步 | 可分析 | 可展示 | 脱敏 |
|---|---|---|---|---|---|---|---|---|
| `id` | 商机 ID | string | 是 | 是 | 是 | 是 | 是 | 否 |
| `customerId` | 客户 ID | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `customerIdRule` | 客户 ID 规则 | string | 否 | 否 | 是 | 是 | 否 | 否 |
| `name` | 商机名称 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `customer` | 客户名称 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `industry` | 行业 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `contact` | 联系人 | string | 否 | 否 | 是 | 否 | 权限展示 | 是 |
| `phone` | 联系电话 | string | 否 | 否 | 是 | 否 | 权限展示 | 是 |
| `stage` | 商机阶段 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `stageName` | 商机阶段名称 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `status` | 商机状态兼容字段 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `amount` | 商机金额 | number | 否 | 否 | 是 | 是 | 权限展示 | 否 |
| `probability` | 成交概率 | number | 否 | 否 | 是 | 是 | 是 | 否 |
| `expectedClose` | 预计成交时间 | date | 否 | 否 | 是 | 是 | 是 | 否 |
| `source` | 商机来源 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `ownerId` | 负责人 ID | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `ownerName` | 负责人姓名 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `assignedStaffId` | 指派员工 ID | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `assignedStaffName` | 指派员工姓名 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `createdBy` | 创建人 ID | string | 否 | 是 | 是 | 是 | 否 | 否 |
| `createdByName` | 创建人姓名 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `partnerId` | 伙伴 ID | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `partnerName` | 伙伴名称 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `assignedPartnerId` | 归属伙伴 ID | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `assignedPartnerName` | 归属伙伴名称 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `regId` | 来源报备 ID | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `quoteId` | 关联报价 ID | string | 否 | 是 | 是 | 是 | 否 | 否 |
| `region` | 区域 | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `bigRegion` | 大区 | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `departmentId` | 部门 ID | string | 否 | 是 | 是 | 是 | 否 | 否 |
| `organizationId` | 组织 ID | string | 否 | 是 | 是 | 是 | 否 | 否 |
| `createdAt` | 创建时间 | datetime | 否 | 否 | 是 | 是 | 是 | 否 |
| `updatedAt` | 更新时间 | datetime | 否 | 否 | 是 | 是 | 是 | 否 |

### 3.6 报价 `quotes`

| 字段 | 中文名 | 类型 | 主键 | 关联键 | 可同步 | 可分析 | 可展示 | 脱敏 |
|---|---|---|---|---|---|---|---|---|
| `id` | 报价 ID | string | 是 | 是 | 是 | 是 | 是 | 否 |
| `customerId` | 客户 ID | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `customerIdRule` | 客户 ID 规则 | string | 否 | 否 | 是 | 是 | 否 | 否 |
| `customer` | 客户名称 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `customerName` | 客户名称兼容字段 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `oppId` | 关联商机 ID | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `oppIds` | 关联商机 ID 数组 | array | 否 | 是 | 是 | 是 | 否 | 否 |
| `amount` | 报价金额 | number | 否 | 否 | 是 | 是 | 权限展示 | 否 |
| `totalAmount` | 报价总额兼容字段 | number | 否 | 否 | 是 | 是 | 权限展示 | 否 |
| `status` | 报价状态 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `ownerId` | 负责人 ID | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `ownerName` | 负责人姓名 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `assignedStaffId` | 指派员工 ID | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `assignedStaffName` | 指派员工姓名 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `createdBy` | 创建人 ID | string | 否 | 是 | 是 | 是 | 否 | 否 |
| `createdByName` | 创建人姓名 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `partnerId` | 伙伴 ID | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `partnerName` | 伙伴名称 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `assignedPartnerId` | 归属伙伴 ID | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `assignedPartnerName` | 归属伙伴名称 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `region` | 区域 | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `bigRegion` | 大区 | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `departmentId` | 部门 ID | string | 否 | 是 | 是 | 是 | 否 | 否 |
| `organizationId` | 组织 ID | string | 否 | 是 | 是 | 是 | 否 | 否 |
| `createdAt` | 创建时间 | datetime | 否 | 否 | 是 | 是 | 是 | 否 |
| `updatedAt` | 更新时间 | datetime | 否 | 否 | 是 | 是 | 否 | 否 |

### 3.7 订单 `orders`

| 字段 | 中文名 | 类型 | 主键 | 关联键 | 可同步 | 可分析 | 可展示 | 脱敏 |
|---|---|---|---|---|---|---|---|---|
| `id` | 订单 ID | string | 是 | 是 | 是 | 是 | 是 | 否 |
| `customerId` | 客户 ID | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `customerIdRule` | 客户 ID 规则 | string | 否 | 否 | 是 | 是 | 否 | 否 |
| `customer` | 客户名称 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `customerName` | 客户名称兼容字段 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `quoteId` | 关联报价 ID | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `oppId` | 关联商机 ID | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `amount` | 订单金额 | number | 否 | 否 | 是 | 是 | 权限展示 | 否 |
| `totalAmount` | 订单总额兼容字段 | number | 否 | 否 | 是 | 是 | 权限展示 | 否 |
| `status` | 订单状态 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `dealAt` | 下单/成交时间 | datetime | 否 | 否 | 是 | 是 | 是 | 否 |
| `ownerId` | 负责人 ID | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `ownerName` | 负责人姓名 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `assignedStaffId` | 指派员工 ID | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `assignedStaffName` | 指派员工姓名 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `createdBy` | 创建人 ID | string | 否 | 是 | 是 | 是 | 否 | 否 |
| `createdByName` | 创建人姓名 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `partnerId` | 伙伴 ID | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `partnerName` | 伙伴名称 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `assignedPartnerId` | 归属伙伴 ID | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `assignedPartnerName` | 归属伙伴名称 | string | 否 | 否 | 是 | 是 | 是 | 否 |
| `parentPartnerId` | 上级伙伴 ID | string | 否 | 是 | 是 | 是 | 否 | 否 |
| `region` | 区域 | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `bigRegion` | 大区 | string | 否 | 是 | 是 | 是 | 是 | 否 |
| `deliveryAddr` | 交付地址 | string | 否 | 否 | 是 | 否 | 权限展示 | 是 |
| `departmentId` | 部门 ID | string | 否 | 是 | 是 | 是 | 否 | 否 |
| `organizationId` | 组织 ID | string | 否 | 是 | 是 | 是 | 否 | 否 |
| `createdAt` | 创建时间 | datetime | 否 | 否 | 是 | 是 | 是 | 否 |
| `updatedAt` | 更新时间 | datetime | 否 | 否 | 是 | 是 | 否 | 否 |

---

## 4. 主键与关联关系

### 4.1 主键

| 对象 | 主键字段 | 说明 |
|---|---|---|
| 用户 | `users.id` | CRM 用户唯一 ID |
| 伙伴/服务商 | `partners.id` | 渠道/伙伴唯一 ID |
| 客户 | `customers.id` / `customers.customerId` | 客户视图稳定 ID |
| 报备 | `registrations.id` | 报备唯一 ID |
| 商机 | `opportunities.id` | 商机唯一 ID |
| 报价 | `quotes.id` | 报价唯一 ID |
| 订单 | `orders.id` | 订单唯一 ID |

### 4.2 关联关系

| 关系 | 关联字段 | 口径 |
|---|---|---|
| 客户 -> 报备 | `customers.customerId = registrations.customerId` | 一客户可多报备 |
| 客户 -> 商机 | `customers.customerId = opportunities.customerId` | 一客户可多商机 |
| 客户 -> 报价 | `customers.customerId = quotes.customerId` | 报价客户 ID 由商机/客户名称归并 |
| 客户 -> 订单 | `customers.customerId = orders.customerId` | 订单客户 ID 由报价/商机/客户名称归并 |
| 报备 -> 商机 | `registrations.id = opportunities.regId` | 报备转商机关联 |
| 商机 -> 报价 | `opportunities.id = quotes.oppId` 或 `quotes.oppIds` 包含商机 ID | 支持一商机多报价或一报价关联多商机 |
| 报价 -> 订单 | `quotes.id = orders.quoteId` | 订单保留来源报价 ID 时关联 |
| 商机 -> 订单 | `opportunities.id = orders.oppId` | 订单可能直接保留商机 ID |
| 伙伴 -> 伙伴 | `partners.parentPartnerId` / `partners.parentPartnerIds` | 渠道父子层级 |
| 伙伴 -> 业务对象 | `partnerId`、`assignedPartnerId`、`parentPartnerId`、`parentPartnerIds` | 用于渠道归属和权限 |
| 用户 -> 业务对象 | `ownerId`、`assignedStaffId`、`createdBy` | 负责人、指派员工、创建人 |
| 区域 -> 业务对象 | `region`、`bigRegion` | 区域和大区统计 |

### 4.3 客户 ID 生成规则

| `customerIdRule` | 含义 |
|---|---|
| `customerId` | 对象已有真实客户 ID |
| `creditCodeHash` | 按统一社会信用代码/税号生成稳定 ID |
| `normalizedNameHash` | 按标准化客户名称生成稳定 ID |
| `empty` | 缺少客户信息 |

---

## 5. MVP 指标最终建议口径

### 5.1 金额口径

| 指标 | 字段优先级 | 说明 |
|---|---|---|
| 商机金额 | `opportunities.amount` | P0 主口径 |
| 报价金额 | `quotes.amount` -> `quotes.totalAmount` -> `quotes.total` -> `quotes.originalTotal` | `amount` 为标准分析字段 |
| 订单金额 / 下单金额 | `orders.amount` -> `orders.totalAmount` -> `orders.total` -> `orders.originalTotal` | `amount` 为标准分析字段 |
| 报备预计金额 | `registrations.estimatedAmt` | 仅用于预计，不等于成交 |

注意：

1. `orders.amount` 是 P0 下单金额主口径。
2. `orders.totalAmount` 是兼容字段。
3. 下单金额暂不等于合同金额、有效收入或回款金额。
4. 后续如 CRM 提供合同/回款字段，应单独建模为 `contractAmount`、`validIncome`、`receivedAmount`。

### 5.2 时间口径

| 场景 | 字段优先级 | 说明 |
|---|---|---|
| 创建时间 | `createdAt` | 所有对象通用 |
| 更新时间 | `updatedAt` -> `createdAt` | 增量同步和活跃判断 |
| 下单/成交时间 | `orders.dealAt` -> `orders.createdAt` | `dealAt` 无值时用订单创建时间 |
| 客户创建时间 | `customers.createdAt` | 客户视图最早业务时间 |
| 客户最近活动 | `customers.latestActivityAt` -> `customers.updatedAt` | 用于沉睡客户 |
| 商机超期未更新 | `opportunities.lastFollowUpAt` -> `opportunities.updatedAt` | 当前无稳定跟进字段时用 `updatedAt` |

### 5.3 业务指标口径

| 指标 | P0 口径 |
|---|---|
| 客户数 | `customers` 当前权限范围内去重数量 |
| 伙伴数 | `partners` 当前权限范围内数量 |
| 报备数 | `registrations` 当前权限范围内数量 |
| 有效报备数 | P0 先按 `status = approved` |
| 商机数 | `opportunities` 当前权限范围内数量 |
| 有效商机数 | P0 先排除 `stage = lost`，最终可业务确认 |
| 报价数 | `quotes` 当前权限范围内数量 |
| 订单数 | `orders` 当前权限范围内数量 |
| 未报备客户 | `customers.registrationCount = 0` |
| 未建商机客户 | `customers.opportunityCount = 0` |
| 未报价客户 | `customers.quoteCount = 0` |
| 未下单客户 | `customers.orderCount = 0` |
| 沉睡客户 | `latestActivityAt` 距今天数大于 `idleDays`，默认 90 天 |
| 商机超过两周未更新 | `COALESCE(lastFollowUpAt, updatedAt)` 超过 14 个自然日 |
| 报备到商机转化率 | `商机数 / 报备数` |
| 商机到报价转化率 | `报价数 / 商机数` |
| 报价到订单转化率 | `订单数 / 报价数` |

### 5.4 时间自然语言

| 用户说法 | P0 解释 |
|---|---|
| 今天 | Asia/Shanghai 当日 00:00:00 到 23:59:59 |
| 最近 7 天 | 含当天往前 7 个自然日 |
| 最近 30 天 | 含当天往前 30 个自然日 |
| 最近三个月 | 从当前日期往前 3 个自然月 |
| 本月 | 当前自然月 |
| 上个月 | 上一自然月 |
| 本季度 | 当前自然季度 |
| 今年 | 当前自然年 |

---

## 6. 权限路径和字段

### 6.1 权限接口

| 接口 | 用途 |
|---|---|
| `GET /auth/me` | 当前 token 绑定 client 和 CRM 用户 |
| `GET /meta/permission-scope` | 当前绑定用户权限范围 |
| `GET /auth/permission-scope` | 权限范围兼容路径 |
| `GET /meta/role-permissions` | 四类角色权限矩阵 |
| `GET /users/{userId}/permission-scope` | 指定用户权限范围 |

### 6.2 角色权限

| 角色 | 范围 | SQL 权限注入建议 |
|---|---|---|
| `superadmin` | 全量可见 | 不加业务归属裁剪，但记录权限快照 |
| `admin` | 本区域/大区 | `region IN (:allowedRegions)` |
| `partner_admin` | 本渠道、本渠道下级和关联归属 | `partnerId/assignedPartnerId/parentPartnerId/parentPartnerIds` 命中 `allowedPartnerIds` |
| `staff` | 本人创建、本人负责或本人被指派 | `createdBy/ownerId/assignedStaffId` 命中当前用户 |

### 6.3 权限字段

AI-agent 构建权限桥表时，建议优先使用：

```text
scopeType
isFullAccess
regions
bigRegions
partnerIds
includeChildPartners
userIds
managedUserIds
ownerIds
departmentIds
organizationIds
```

业务对象裁剪建议字段：

```text
region
bigRegion
partnerId
assignedPartnerId
parentPartnerId
parentPartnerIds
ownerId
assignedStaffId
createdBy
departmentId
organizationId
```

---

## 7. 敏感字段规则

### 7.1 禁止同步或禁止进入 AI 上下文

| 字段类型 | 示例 |
|---|---|
| 密码 | `password`、`passwd`、`pwd` |
| Token | `token`、`access_token`、`refresh_token` |
| 密钥 | `secret`、`appSecret`、`privateKey` |
| 会话 | `session`、`cookie`、`captcha` |
| 内部审批敏感意见 | `approvalOpinion`，P0 暂不纳入 |
| 内部备注 | `remark`、`comment`，P0 暂不进入 AI 上下文 |

### 7.2 可同步但需脱敏/限制展示

| 字段类型 | 示例字段 | 同步 | 分析 | 企微展示 | Web 展示 |
|---|---|---|---|---|---|
| 手机号 | `phone`、`mobile` | 是 | 否 | 默认脱敏 | 按权限 |
| 联系人 | `contact` | 是 | 谨慎 | 默认脱敏或隐藏 | 按权限 |
| 统一社会信用代码 | `creditCode` | 是 | 用于关联，不进正文 | 默认脱敏 | 按权限 |
| 地址 | `deliveryAddr`、`address` | 是 | 否 | 展示到省市 | 按权限 |
| 金额 | `amount`、`totalAmount` | 是 | 是 | 聚合值可展示 | 按权限 |

### 7.3 脱敏格式

| 类型 | 格式 |
|---|---|
| 手机号 | `138****8000` |
| 信用代码 | 前 4 位 + `************` + 后 2 位 |
| 地址 | 企微默认仅展示省市 |
| 联系人 | 企微默认隐藏或只展示姓氏，最终按业务确认 |

---

## 8. 企微 userid 与 CRM 用户映射

当前用户对象已稳定预留：

```text
wecomUserId
id
username
name
role
roleName
departmentId
departmentName
region
bigRegion
partnerId
partnerName
status
```

建议 AI-agent 映射表：

| 字段 | 说明 |
|---|---|
| `wecomUserId` | 企业微信 userid |
| `crmUserId` | CRM 用户 ID，对应 `users.id` |
| `username` | CRM 登录名 |
| `name` | 用户姓名 |
| `role` | 角色编码 |
| `roleName` | 角色名称 |
| `departmentId` | 部门 ID |
| `departmentName` | 部门名称 |
| `region` | 区域 |
| `bigRegion` | 大区 |
| `partnerId` | 伙伴 ID |
| `partnerName` | 伙伴名称 |
| `status` | 用户状态 |

当前 SIT 可先用测试账号人工映射；生产企微机器人正式上线前，需要业务侧补齐真实 `wecomUserId`。

---

## 9. 样例数据和回归问题

### 9.1 首批 20 条回归问题

| 序号 | 问题 | 期望输出 |
|---:|---|---|
| 1 | 今年山东区域合作伙伴客户、报备、商机和下单整体情况 | 经营汇总报告 |
| 2 | 最近三个月山东区域有商机的服务商，商机数量和商机金额是多少 | 服务商商机汇总表 |
| 3 | 最近三个月山东区域有下单的服务商，订单数量和订单金额是多少 | 服务商订单汇总表 |
| 4 | 有多少客户没有报备商机，分别创建了多长时间 | 客户生命周期分布 |
| 5 | 有哪些商机超过两个星期没有更新进展 | 风险商机清单 |
| 6 | 最近一年加入的服务商按合作级别、等级、是否技术服务商分析 | 服务商画像分布 |
| 7 | 本月各区域商机数量和金额对比 | 区域商机排行 |
| 8 | 本月各负责人商机金额排行 | 负责人排行 |
| 9 | 报备到商机、报价、订单的转化漏斗 | 漏斗指标 |
| 10 | 当前账号权限范围内高风险商机清单 | 风险清单 |
| 11 | 最近 30 天没有活跃的客户有哪些 | 沉睡客户列表 |
| 12 | 最近 90 天未下单但有商机的客户有哪些 | 客户跟进清单 |
| 13 | 山东区域订单金额排名前 10 的渠道有哪些 | 渠道排行 |
| 14 | 各渠道的报备数、商机数、订单数分别是多少 | 渠道贡献汇总 |
| 15 | 哪些客户只有报备但没有商机 | 客户明细 |
| 16 | 哪些客户有商机但没有报价 | 客户/商机明细 |
| 17 | 哪些客户有报价但没有下单 | 客户/报价明细 |
| 18 | 本季度新增商机按阶段分布 | 阶段分布 |
| 19 | 本季度订单金额按月份趋势 | 月度趋势 |
| 20 | 同一问题用四类账号分别查询，结果差异是否符合权限 | 权限验证报告 |

### 9.2 待实测回传项

以下内容需要基于当前 SIT 环境和四组 client 跑数后回传：

| 项目 | 回传形式 |
|---|---|
| 六类样例数据 ID | 对象、ID、名称、区域、伙伴、负责人、可见账号 |
| 四类账号权限矩阵 | 账号、问题、返回总数、金额、样例 ID、是否符合预期 |
| 20 条问题期望结果 | 指标值、明细数量、样例 ID、数据截至时间 |
| 统计接口核对结果 | 接口、参数、账号、关键指标、requestId |

---

## 10. 变更通知机制

建议双方采用以下机制：

| 变更类型 | 通知内容 | 建议提前时间 |
|---|---|---|
| 新增字段 | 字段名、中文名、类型、示例、是否可分析 | 3 天 |
| 删除字段 | 字段名、影响接口、替代字段 | 7 天 |
| 字段含义变化 | 旧口径、新口径、生效时间 | 7 天 |
| 枚举变化 | 字典键、新增/删除值、中文名 | 3 天 |
| 权限口径变化 | 角色、对象、过滤规则变化 | 7 天 |
| 指标口径变化 | 指标名、旧公式、新公式、生效时间 | 7 天 |

---

## 11. 本轮可直接确认给贵方

```text
联软 CRM 侧已补充 P0 字段白名单、主键关联、MVP 指标口径、权限路径、脱敏规则和企微映射字段。AI-agent 可先按本文建设 MySQL ODS/DWD/DWS 与语义层字段目录。样例数据 ID、四类账号权限矩阵实测值、20 条问题期望结果和正式企微 userid 映射，将在当前 SIT 环境跑数和业务确认后继续补充。
```

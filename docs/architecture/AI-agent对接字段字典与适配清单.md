# 联软 CRM 对接 AI-agent 字段字典与权限口径

> 版本：V2.0  
> 日期：2026-06-03  
> 用途：提供给 AI-agent 适配团队，用于对象映射、字段理解、权限裁剪和联调

---

## 1. 使用原则

本清单只整理第一阶段标准 API 对外需要稳定输出的字段，不追求把 CRM 内部所有字段一次性暴露给对方。

字段治理原则：

1. 先稳定主键、名称、状态、归属、关联、时间字段。
2. 扩展业务字段允许后续增量补充。
3. AI-agent 只依赖“标准字段”，不依赖页面临时字段或前端拼装字段。

---

## 2. 标准对象清单

第一阶段统一对外 6 类对象：

1. `users`
2. `partners`
3. `registrations`
4. `opportunities`
5. `quotes`
6. `orders`

---

## 3. 字段分类口径

每个对象字段统一按下列类型理解：

1. 主键字段
   - `id`
2. 名称字段
   - `name`、`customer`
3. 状态字段
   - `status`、`stage`
4. 组织归属字段
   - `region`、`bigRegion`、`partnerId`、`assignedPartnerId`
5. 人员归属字段
   - `createdBy`、`ownerId`、`assignedStaffId`
6. 关联字段
   - `regId`、`quoteId`、`oppId`、`oppIds`
7. 时间字段
   - `createdAt`、`updatedAt`、`approvedAt`、`expectedClose`

---

## 4. 用户对象 `users`

### 4.1 标准字段

| 字段 | 类型 | 必选 | 示例 | 说明 |
|---|---|---:|---|---|
| `id` | string | 是 | `A001` | 用户唯一标识 |
| `username` | string | 是 | `admin` | 登录名 |
| `name` | string | 是 | `联软科技超级管理员` | 用户姓名 |
| `role` | string | 是 | `superadmin` | 角色 |
| `region` | string | 否 | `安徽区` | 所属区域 |
| `bigRegion` | string | 否 | `大东区` | 所属大区 |
| `partnerId` | string | 否 | `P002` | 所属渠道 ID |
| `partnerName` | string | 否 | `上海锐行信息` | 所属渠道名称 |
| `status` | string | 是 | `active` | 用户状态 |
| `phone` | string | 否 | `13800138000` | 联系电话 |
| `email` | string | 否 | `user@example.com` | 邮箱 |
| `staffRole` | string | 否 | `销售代表` | 员工岗位描述 |
| `createdBy` | string | 否 | `A001` | 创建人 ID |
| `createdAt` | string | 否 | `2026-06-03T10:00:00.000Z` | 创建时间 |
| `updatedAt` | string | 否 | `2026-06-03T11:00:00.000Z` | 更新时间 |

### 4.2 角色字典

| 值 | 含义 | 可见范围 |
|---|---|---|
| `superadmin` | 超级管理员 | 全量 |
| `admin` | 区域管理员 | 本区域 |
| `partner_admin` | 渠道管理员 | 本渠道及关联渠道 |
| `staff` | 员工 | 本人 |

### 4.3 状态字典

| 值 | 含义 |
|---|---|
| `active` | 正常可用 |
| `pending` | 待审批 |
| `disabled` | 禁用 |
| `inactive` | 未激活/停用 |

---

## 5. 渠道对象 `partners`

### 5.1 标准字段

| 字段 | 类型 | 必选 | 示例 | 说明 |
|---|---|---:|---|---|
| `id` | string | 是 | `P001` | 渠道唯一标识 |
| `name` | string | 是 | `北京安盾网络` | 渠道名称 |
| `partnerLevel` | string | 否 | `primary` | 渠道层级 |
| `parentPartnerId` | string | 否 | `P0001` | 直接上级渠道 |
| `parentPartnerIds` | array | 否 | `["P0001"]` | 上级渠道链 |
| `region` | string | 否 | `北区（政企）` | 所属区域 |
| `bigRegion` | string | 否 | `大北区` | 所属大区 |
| `contact` | string | 否 | `张三` | 联系人 |
| `phone` | string | 否 | `13800138001` | 联系电话 |
| `email` | string | 否 | `zhang@example.com` | 邮箱 |
| `status` | string | 是 | `active` | 渠道状态 |
| `joinDate` | string | 否 | `2024-01-15` | 加入日期 |
| `createdBy` | string | 否 | `A002` | 创建人 ID |
| `createdAt` | string | 否 | `2026-06-03T10:00:00.000Z` | 创建时间 |
| `updatedAt` | string | 否 | `2026-06-03T11:00:00.000Z` | 更新时间 |

### 5.2 渠道层级字典

| 值 | 含义 |
|---|---|
| `none` | 未设置层级 |
| `primary` | 一级渠道 |
| `secondary` | 二级渠道 |

### 5.3 状态字典

| 值 | 含义 |
|---|---|
| `active` | 已激活 |
| `pending` | 待审批 |
| `disabled` | 禁用 |

---

## 6. 客户报备对象 `registrations`

说明：当前系统中 `registrations` 同时承担“客户报备”和“客户入口档案”职责。第一阶段对外统一按“客户主入口”理解。

### 6.1 标准字段

| 字段 | 类型 | 必选 | 示例 | 说明 |
|---|---|---:|---|---|
| `id` | string | 是 | `REG-1717310000000` | 报备 ID |
| `customer` | string | 是 | `上海XX公司` | 客户名称 |
| `project` | string | 否 | `终端安全项目` | 项目名称 |
| `industry` | string | 否 | `制造业` | 行业 |
| `contact` | string | 否 | `张三` | 联系人 |
| `phone` | string | 否 | `13800138000` | 联系电话 |
| `creditCode` | string | 否 | `9131XXXXXXXXXXXX` | 统一社会信用代码 |
| `status` | string | 是 | `approved` | 报备状态 |
| `createdBy` | string | 是 | `S002` | 创建人 ID |
| `createdByName` | string | 否 | `王小红` | 创建人姓名 |
| `assignedStaffId` | string | 否 | `S002` | 指派员工 ID |
| `assignedStaffName` | string | 否 | `王小红` | 指派员工姓名 |
| `partnerId` | string | 否 | `P002` | 关联渠道 ID |
| `partnerName` | string | 否 | `上海锐行信息` | 关联渠道名称 |
| `assignedPartnerId` | string | 否 | `P002` | 业务归属渠道 ID |
| `assignedPartnerName` | string | 否 | `上海锐行信息` | 业务归属渠道名称 |
| `region` | string | 否 | `上海区（非金）` | 所属区域 |
| `estimatedAmt` | number | 否 | `800000` | 预计金额 |
| `signDate` | string | 否 | `2026-07-01` | 预计签约时间 |
| `endpointRange` | string | 否 | `500-1000` | 终端范围 |
| `approvedAt` | string | 否 | `2026-06-03T10:05:00.000Z` | 审批时间 |
| `approvedBy` | string | 否 | `A001` | 审批人 ID |
| `createdAt` | string | 是 | `2026-06-03T10:00:00.000Z` | 创建时间 |
| `updatedAt` | string | 否 | `2026-06-03T10:30:00.000Z` | 更新时间 |

### 6.2 状态字典

| 值 | 含义 |
|---|---|
| `pending` | 待审批 |
| `approved` | 已通过 |
| `rejected` | 已驳回 |

---

## 7. 商机对象 `opportunities`

### 7.1 标准字段

| 字段 | 类型 | 必选 | 示例 | 说明 |
|---|---|---:|---|---|
| `id` | string | 是 | `OPP-1717310000000` | 商机 ID |
| `name` | string | 是 | `上海XX公司项目` | 商机名称 |
| `customer` | string | 是 | `上海XX公司` | 客户名称 |
| `industry` | string | 否 | `制造业` | 行业 |
| `contact` | string | 否 | `张三` | 联系人 |
| `phone` | string | 否 | `13800138000` | 联系电话 |
| `stage` | string | 是 | `contacted` | 商机阶段 |
| `amount` | number | 否 | `800000` | 商机金额 |
| `probability` | number | 否 | `30` | 成交概率 |
| `expectedClose` | string | 否 | `2026-07-01` | 预计成交时间 |
| `source` | string | 否 | `渠道推荐` | 商机来源 |
| `ownerId` | string | 否 | `S002` | 责任人 ID |
| `owner` | string | 否 | `王小红` | 责任人姓名 |
| `createdBy` | string | 否 | `S002` | 创建人 ID |
| `assignedStaffId` | string | 否 | `S002` | 指派员工 ID |
| `assignedStaffName` | string | 否 | `王小红` | 指派员工姓名 |
| `partnerId` | string | 否 | `P002` | 关联渠道 ID |
| `partnerName` | string | 否 | `上海锐行信息` | 关联渠道名称 |
| `assignedPartnerId` | string | 否 | `P002` | 业务归属渠道 ID |
| `assignedPartnerName` | string | 否 | `上海锐行信息` | 业务归属渠道名称 |
| `regId` | string | 否 | `REG-1717310000000` | 来源报备 ID |
| `quoteId` | string | 否 | `QT-1717310000000` | 关联报价 ID |
| `region` | string | 否 | `上海区（非金）` | 所属区域 |
| `createdAt` | string | 是 | `2026-06-03T10:00:00.000Z` | 创建时间 |
| `updatedAt` | string | 否 | `2026-06-03T10:30:00.000Z` | 更新时间 |

### 7.2 阶段字典

第一阶段建议对方按字符串枚举处理，当前常见值包括但不限于：

1. `contacted`
2. `qualified`
3. `proposal`
4. `negotiation`
5. `won`
6. `lost`

最终联调时，以 `meta/dictionaries` 返回结果为准。

---

## 8. 报价对象 `quotes`

### 8.1 标准字段

| 字段 | 类型 | 必选 | 示例 | 说明 |
|---|---|---:|---|---|
| `id` | string | 是 | `QT-1717310000000` | 报价 ID |
| `oppId` | string | 否 | `OPP-1` | 单商机关联 |
| `oppIds` | array | 否 | `["OPP-1","OPP-2"]` | 多商机关联 |
| `customer` | string | 否 | `上海XX公司` | 客户名称，第一阶段标准字段 |
| `customerName` | string | 否 | `上海XX公司` | 客户名称兼容字段，建议后续统一到 `customer` |
| `partnerId` | string | 否 | `P002` | 关联渠道 ID |
| `partnerName` | string | 否 | `上海锐行信息` | 关联渠道名称 |
| `assignedPartnerId` | string | 否 | `P002` | 业务归属渠道 ID |
| `assignedPartnerName` | string | 否 | `上海锐行信息` | 业务归属渠道名称 |
| `assignedStaffId` | string | 否 | `S002` | 指派员工 ID |
| `assignedStaffName` | string | 否 | `王小红` | 指派员工姓名 |
| `createdBy` | string | 否 | `S002` | 创建人 ID |
| `createdByName` | string | 否 | `王小红` | 创建人姓名 |
| `region` | string | 否 | `上海区（非金）` | 所属区域 |
| `status` | string | 是 | `draft` | 报价状态 |
| `totalAmount` | number | 否 | `980000` | 报价总额 |
| `discount` | number | 否 | `0.9` | 折扣 |
| `taxRate` | number | 否 | `0.13` | 税率 |
| `createdAt` | string | 是 | `2026-06-03T10:00:00.000Z` | 创建时间 |
| `updatedAt` | string | 否 | `2026-06-03T10:30:00.000Z` | 更新时间 |

### 8.2 状态字典

| 值 | 含义 |
|---|---|
| `draft` | 草稿 |
| `submitted` | 已提交 |
| `approved` | 已通过 |
| `rejected` | 已驳回 |

### 8.3 字段说明

报价对象存在 `固定字段 + 业务扩展字段` 的特点。对方适配时：

1. 固定字段按本表处理。
2. 未列出的业务字段按扩展 JSON 容忍，不作为第一阶段强依赖。

---

## 9. 订单对象 `orders`

### 9.1 标准字段

| 字段 | 类型 | 必选 | 示例 | 说明 |
|---|---|---:|---|---|
| `id` | string | 是 | `ORD-1717310000000` | 订单 ID |
| `quoteId` | string | 否 | `QT-1717310000000` | 来源报价 ID |
| `customer` | string | 否 | `上海XX公司` | 客户名称，第一阶段标准字段 |
| `customerName` | string | 否 | `上海XX公司` | 客户名称兼容字段，建议后续统一到 `customer` |
| `partnerId` | string | 否 | `P002` | 关联渠道 ID |
| `partnerName` | string | 否 | `上海锐行信息` | 关联渠道名称 |
| `parentPartnerId` | string | 否 | `P001` | 上级渠道 ID |
| `assignedPartnerId` | string | 否 | `P002` | 业务归属渠道 ID |
| `assignedPartnerName` | string | 否 | `上海锐行信息` | 业务归属渠道名称 |
| `assignedStaffId` | string | 否 | `S002` | 指派员工 ID |
| `assignedStaffName` | string | 否 | `王小红` | 指派员工姓名 |
| `createdBy` | string | 否 | `S002` | 创建人 ID |
| `createdByName` | string | 否 | `王小红` | 创建人姓名 |
| `region` | string | 否 | `上海区（非金）` | 所属区域 |
| `status` | string | 是 | `pending` | 订单状态 |
| `totalAmount` | number | 否 | `980000` | 订单总额 |
| `deliveryAddr` | string | 否 | `上海市浦东新区...` | 交付地址 |
| `createdAt` | string | 是 | `2026-06-03T10:00:00.000Z` | 创建时间 |
| `updatedAt` | string | 否 | `2026-06-03T10:30:00.000Z` | 更新时间 |

### 9.2 状态字典

| 值 | 含义 |
|---|---|
| `pending` | 待处理 |
| `confirmed` | 已确认 |
| `rejected` | 已驳回 |
| `completed` | 已完成 |

---

## 10. 关键关系映射

| 上游对象 | 下游对象 | 关系字段 | 说明 |
|---|---|---|---|
| `users` | `partners` | `users.partnerId -> partners.id` | 用户所属渠道 |
| `registrations` | `opportunities` | `opportunities.regId -> registrations.id` | 报备转商机 |
| `opportunities` | `quotes` | `quotes.oppId / oppIds -> opportunities.id` | 商机关联报价 |
| `quotes` | `orders` | `orders.quoteId -> quotes.id` | 报价转订单 |
| `partners` | `partners` | `parentPartnerId / parentPartnerIds` | 渠道层级 |

---

## 11. 权限口径说明

### 11.1 用户侧权限主字段

以下字段用于决定“这个 client 绑定用户可以看到什么”：

1. `role`
2. `region`
3. `bigRegion`
4. `partnerId`
5. `partnerName`
6. `status`

### 11.2 业务对象侧过滤主字段

以下字段用于决定“这条业务数据是否属于当前用户可见范围”：

1. `region`
2. `partnerId`
3. `assignedPartnerId`
4. `parentPartnerId`
5. `assignedStaffId`
6. `createdBy`
7. `ownerId`

### 11.3 角色过滤规则

#### `superadmin`

1. 全部对象全量可见。

#### `admin`

1. `users`：本区域及无区域用户。
2. `partners`：本区域已激活渠道，加本人创建的待审渠道。
3. `registrations/opportunities/quotes/orders`：按 `region = 当前用户.region`。

#### `partner_admin`

1. `users`：本渠道用户。
2. `partners`：本渠道、本渠道下级或父子映射命中的渠道。
3. `registrations/opportunities/quotes/orders`：命中以下任一字段即可视为同渠道范围：
   - `partnerId`
   - `assignedPartnerId`
   - `parentPartnerId`

#### `staff`

1. `users`：仅本人。
2. `partners`：仅本人所属渠道。
3. `registrations`：`createdBy = 本人` 或 `assignedStaffId = 本人`
4. `opportunities/quotes/orders`：`createdBy = 本人` 或 `ownerId = 本人` 或 `assignedStaffId = 本人`

---

## 12. 推荐给 AI-agent 的最小依赖字段

如果对方第一阶段只想做“最小可用适配”，建议优先使用以下字段：

### users

`id` `username` `name` `role` `region` `bigRegion` `partnerId` `partnerName` `status`

### partners

`id` `name` `partnerLevel` `parentPartnerId` `parentPartnerIds` `region` `bigRegion` `status`

### registrations

`id` `customer` `contact` `phone` `creditCode` `status` `createdBy` `assignedStaffId` `partnerId` `region` `createdAt`

### opportunities

`id` `name` `customer` `stage` `amount` `expectedClose` `assignedStaffId` `partnerId` `regId` `quoteId` `createdAt`

### quotes

`id` `oppId` `oppIds` `partnerId` `assignedStaffId` `status` `createdAt`

### orders

`id` `partnerId` `parentPartnerId` `assignedPartnerId` `assignedStaffId` `status` `createdAt`

---

## 13. 联调提示

1. 对方不要把“数据库列名存在”直接等同于“业务含义稳定”。
2. 所有权限判断以标准 API 返回结果为准，不以字段自行推演为准。
3. 如遇扩展字段、状态值、个别对象兼容字段差异，统一通过 `meta/dictionaries` 和联调清单补充。

---

## 14. 2026-06-08 字段增强补充

依据对方《联软CRM-需补充完善字段与资料清单》，OpenAPI 输出层已补充以下标准字段：

| 对象 | 新增/标准化字段 |
|---|---|
| `users` | `roleName`、`wecomUserId`、`departmentId`、`departmentName` |
| `partners` | `shortName`、`partnerLevelName`、`isTechnicalServiceProvider`、`technicalServiceProviderType` |
| `registrations` | `assignedStaffId` 兜底、`assignedStaffName` 兜底、`createdByName` 兜底 |
| `opportunities` | `stageName`、`status`、`ownerId` 兜底、`ownerName`、`assignedStaffName` 兜底 |
| `quotes` | `ownerId`、`ownerName`、`amount`、`totalAmount`、`assignedStaffName` 兜底 |
| `orders` | `ownerId`、`ownerName`、`amount`、`totalAmount`、`dealAt`、`assignedStaffName` 兜底 |

技术服务商字段口径：

```text
partners.isTechnicalServiceProvider = isTechnicalServiceProvider || isTechService || techServiceType != none
```

新增字典：

```text
meta/dictionaries.technicalServiceProviderTypes
```

新增统计接口：

```text
GET /analytics/partners/profile
GET /analytics/funnel
GET /analytics/regions/contribution
GET /analytics/owners/contribution
```

---

## 15. 角色权限与企微映射字段补充

### 15.1 用户与企微映射字段

以下字段用于 AI-agent 将企业微信用户映射为 CRM 用户，并按 CRM 权限做分析：

| 字段 | 类型 | 示例 | 说明 |
|---|---|---|---|
| `id` | string | `A030` | CRM 用户唯一 ID。 |
| `username` | string | `liulonghai` | CRM 登录账号。 |
| `name` | string | `刘龙海` | 姓名。 |
| `status` | string | `active` | 用户状态，非 `active` 不建议参与问数。 |
| `role` | string | `superadmin` | CRM 角色编码。 |
| `roleName` | string | `超级管理员` | CRM 角色名称。 |
| `roleIds` | array | `["superadmin"]` | 角色编码数组，便于后续多角色扩展。 |
| `roleNames` | array | `["超级管理员"]` | 角色名称数组。 |
| `isAdmin` | boolean | `true` | 是否管理类账号。 |
| `wecomUserId` | string | `zhangsan` | 企业微信 userid，当前未维护时为空字符串。 |
| `mobile` | string | `13800138000` | 手机号兼容字段。 |
| `email` | string | `user@example.com` | 邮箱。 |
| `departmentId` | string | `dept_001` | 部门 ID，无映射时为空。 |
| `departmentName` | string | `山东销售部` | 部门名称，无映射时为空。 |
| `departmentIds` | array | `["dept_001"]` | 部门 ID 数组。 |
| `organizationId` | string | `org_001` | 组织 ID，无映射时为空。 |
| `organizationIds` | array | `["org_001"]` | 组织 ID 数组。 |
| `region` | string | `山东区` | 区域。 |
| `bigRegion` | string | `华东大区` | 大区。 |
| `partnerId` | string | `P001` | 绑定渠道 ID。 |
| `partnerName` | string | `山东联软服务商` | 绑定渠道名称。 |
| `managedUserIds` | array | `["A013","S022"]` | 当前用户权限内可见用户。 |
| `ownerIds` | array | `["A013","S022"]` | 当前用户可见负责人，第一阶段与 `managedUserIds` 一致。 |

### 15.2 权限范围接口字段

`GET /users/{userId}/permission-scope` 与 `GET /meta/permission-scope` 返回以下权限范围字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `scopeType` | string | `all`、`region`、`partner`、`user`。 |
| `isFullAccess` | boolean | 是否全量可见。 |
| `regions` | array | 可见区域。 |
| `bigRegions` | array | 可见大区。 |
| `partnerIds` | array | 可见渠道 ID。 |
| `includeChildPartners` | boolean | 是否包含下级渠道。 |
| `userIds` | array | 可见用户 ID。 |
| `managedUserIds` | array | 可管理/可见用户 ID。 |
| `ownerIds` | array | 可见负责人 ID。 |
| `departmentIds` | array | 可见部门 ID。 |
| `organizationIds` | array | 可见组织 ID。 |
| `description` | string | 权限说明。 |

### 15.3 角色权限矩阵

`GET /meta/role-permissions` 返回 CRM 当前四类角色口径：

| 角色 | 范围 | 对象过滤主字段 |
|---|---|---|
| `superadmin` | 全量 | 不按归属裁剪。 |
| `admin` | 本区域 | `region == currentUser.region`。 |
| `partner_admin` | 本渠道及下级渠道 | `partnerId/assignedPartnerId/parentPartnerId/parentPartnerIds` 命中当前渠道。 |
| `staff` | 本人 | `createdBy/ownerId/assignedStaffId` 命中当前用户。 |

### 15.4 六类对象二次裁剪字段

AI-agent 如使用服务 client 拉明细后做本地二次裁剪，建议只依赖以下稳定字段：

| 对象 | 字段 |
|---|---|
| `partners` | `id`、`ownerId`、`ownerName`、`region`、`bigRegion`、`departmentId`、`organizationId`、`parentPartnerId`、`parentPartnerIds` |
| `registrations` | `id`、`ownerId`、`ownerName`、`assignedStaffId`、`assignedStaffName`、`createdBy`、`createdByName`、`partnerId`、`partnerName`、`region`、`bigRegion`、`departmentId`、`organizationId` |
| `opportunities` | `id`、`ownerId`、`ownerName`、`assignedStaffId`、`assignedStaffName`、`createdBy`、`createdByName`、`partnerId`、`partnerName`、`region`、`bigRegion`、`departmentId`、`organizationId` |
| `quotes` | `id`、`ownerId`、`ownerName`、`assignedStaffId`、`assignedStaffName`、`createdBy`、`createdByName`、`partnerId`、`partnerName`、`region`、`bigRegion`、`departmentId`、`organizationId` |
| `orders` | `id`、`ownerId`、`ownerName`、`assignedStaffId`、`assignedStaffName`、`createdBy`、`createdByName`、`partnerId`、`partnerName`、`region`、`bigRegion`、`departmentId`、`organizationId` |

---

## 16. 客户主数据与跨对象关联键补充

### 16.1 客户对象 `customers`

当前 `customers` 为 OpenAPI 只读客户主数据视图，由 `registrations/opportunities/quotes/orders` 归并生成。

| 字段 | 类型 | 示例 | 说明 |
|---|---|---|---|
| `id` | string | `CUST-NAME-xxxx` | 客户稳定 ID。 |
| `customerId` | string | `CUST-NAME-xxxx` | 与 `id` 同步，供跨对象关联。 |
| `name` | string | `山东XX公司` | 客户名称。 |
| `customer` | string | `山东XX公司` | 客户名称兼容字段。 |
| `createdAt` | string | `2026-01-01T00:00:00.000Z` | 客户最早业务时间。 |
| `updatedAt` | string | `2026-06-01T00:00:00.000Z` | 客户最近更新时间。 |
| `latestActivityAt` | string | `2026-06-01T00:00:00.000Z` | 最近报备/商机/报价/订单时间。 |
| `status` | string | `ordered` | 生命周期状态。 |
| `statusName` | string | `已下单` | 生命周期状态中文名。 |
| `region` | string | `山东区` | 区域。 |
| `bigRegion` | string | `大北区` | 大区。 |
| `ownerId` | string | `S022` | 负责人 ID。 |
| `ownerName` | string | `商希超` | 负责人姓名。 |
| `assignedStaffId` | string | `S022` | 分配员工 ID。 |
| `assignedStaffName` | string | `商希超` | 分配员工姓名。 |
| `partnerId` | string | `P002` | 关联服务商 ID。 |
| `partnerName` | string | `山东华安赛服智能科技有限公司` | 关联服务商名称。 |
| `departmentId` | string | `dept_001` | 部门 ID，无值时为空。 |
| `departmentName` | string | `山东销售部` | 部门名称，无值时为空。 |
| `organizationId` | string | `org_001` | 组织 ID，无值时为空。 |
| `source` | string | `registrations` | 来源对象或来源字段。 |
| `category` | string | `key_account` | 客户分类编码，无值时为空。 |
| `categoryName` | string | `重点客户` | 客户分类中文名，无值时为空。 |
| `hasRegistration` | boolean | `true` | 是否有报备。 |
| `registrationCount` | number | `1` | 报备数量。 |
| `hasOpportunity` | boolean | `true` | 是否有商机。 |
| `opportunityCount` | number | `1` | 商机数量。 |
| `hasQuote` | boolean | `true` | 是否有报价。 |
| `quoteCount` | number | `1` | 报价数量。 |
| `hasOrder` | boolean | `false` | 是否有订单。 |
| `orderCount` | number | `0` | 订单数量。 |
| `ageBucket` | string | `31-90` | 创建时长分桶。 |
| `customerIdRule` | string | `normalizedNameHash` | 客户 ID 生成规则。 |
| `matchKey` | string | `山东xx公司` | 标准化名称匹配键。 |

### 16.2 跨对象关联键

以下对象均稳定返回 `customerId` 和 `customerIdRule`：

| 对象 | 关联字段 |
|---|---|
| `registrations` | `customerId`、`customerIdRule`、`customer` |
| `opportunities` | `customerId`、`customerIdRule`、`regId`、`customer` |
| `quotes` | `customerId`、`customerIdRule`、`oppId`、`oppIds`、`customerName` |
| `orders` | `customerId`、`customerIdRule`、`quoteId`、`oppId`、`customerName` |

`customerIdRule` 优先级：

| 值 | 说明 |
|---|---|
| `customerId` | 使用对象已有真实客户 ID。 |
| `creditCodeHash` | 使用信用代码或税号生成稳定 ID。 |
| `normalizedNameHash` | 使用标准化客户名称生成稳定 ID。 |
| `empty` | 缺少客户信息。 |

### 16.3 客户生命周期状态

| 状态 | 中文名 | 说明 |
|---|---|---|
| `active` | 有效 | 仅有客户基础记录或默认状态。 |
| `registered` | 已报备 | 有报备但暂无商机。 |
| `opportunity` | 已建商机 | 有商机但暂无报价。 |
| `quoted` | 已报价 | 有报价但暂无订单。 |
| `ordered` | 已下单 | 已形成订单。 |
| `inactive` | 停用 | 后续真实客户主表可映射。 |
| `disabled` | 禁用 | 后续真实客户主表可映射。 |

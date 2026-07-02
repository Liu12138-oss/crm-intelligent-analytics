# 发给 crm-agent：联软 CRM 权限、字段、关系、指标、字典、样例补充回复

> 日期：2026-06-09  
> 用途：回复 AI-agent 本轮补充项，供 MySQL 分析库、语义层、Text-to-SQL、企微问答和回归验证使用。  
> Base URL：`http://10.18.16.114:3000/api/open/v1`  
> 说明：本文不包含 `appSecret`、Token、数据库密码等敏感凭证。

---

## 1. 本轮补充结论

本轮联软 CRM 侧已按 OpenAPI 标准视图补齐以下内容：

| 补充项 | 当前结论 |
|---|---|
| 权限桥表 | `GET /meta/permission-scope`、`GET /auth/permission-scope`、`GET /users/{userId}/permission-scope` 稳定返回 `scopeType / regions / bigRegions / partnerIds / userIds / ownerIds / managedUserIds`。 |
| 订单/报价区域字段 | `quotes`、`orders` 均稳定输出 `region / bigRegion`。若对象自身为空，按关联商机、报价、渠道、负责人顺序继承。 |
| 字段全量清单 | 本文第 3 节给出 P0/P1 分析字段清单，含中文名、类型、敏感标识、是否允许分析、是否允许企微展示。 |
| 关系口径 | 本文第 4 节给出客户、服务商、报备、商机、报价、订单的主外键和匹配规则。 |
| 指标口径 | 本文第 5 节给出商机金额、订单金额、有效订单、转化、沉默/未建链路等口径。 |
| 字典枚举 | 本文第 6 节给出阶段、状态、等级、区域、大区、角色等枚举来源和兜底翻译。 |
| 样例问题 | 本文第 7 节按超管、区管、渠道、销售员工给出回归样例和期望行为。 |

---

## 2. 权限桥表口径

### 2.1 推荐接口

| 场景 | 接口 | 说明 |
|---|---|---|
| 当前 client 绑定用户权限 | `GET /meta/permission-scope` | 推荐 AI-agent 每次建会话或刷新 Token 后读取。 |
| 当前 client 绑定用户权限兼容路径 | `GET /auth/permission-scope` | 与上方返回结构一致。 |
| 查询指定 CRM 用户权限 | `GET /users/{userId}/permission-scope` | 用于 AI-agent 身份映射、回归测试、权限诊断。 |
| 静态角色规则 | `GET /meta/role-permissions` | 用于构建角色权限矩阵和二次裁剪规则。 |

### 2.2 稳定返回字段

| 字段 | 类型 | 含义 | 示例 |
|---|---|---|---|
| `scopeType` | string | 权限范围类型：`all / region / partner / user` | `region` |
| `isFullAccess` | boolean | 是否全量可见 | `false` |
| `regions` | array | 可见区域。超管为空数组表示全量 | `["山东"]` |
| `bigRegions` | array | 可见大区。超管为空数组表示全量 | `["华东大区"]` |
| `partnerIds` | array | 可见渠道/服务商 ID | `["P001"]` |
| `includeChildPartners` | boolean | 是否包含下级渠道链 | `true` |
| `userIds` | array | 可见 CRM 用户 ID | `["A030"]` |
| `ownerIds` | array | 可见业务负责人 ID | `["A030"]` |
| `managedUserIds` | array | 管理范围内用户 ID | `["A030", "A031"]` |
| `departmentIds` | array | 可见部门 ID | `["D-SD"]` |
| `organizationIds` | array | 可见组织 ID | `["ORG-001"]` |
| `description` | string | 权限说明 | `可查看本区域数据` |

### 2.3 四类账号权限矩阵

| CRM 角色 | scopeType | regions | partnerIds | userIds | 业务对象可见规则 |
|---|---|---|---|---|---|
| 超管 `superadmin` | `all` | `[]` 表示全量 | 全量可见 | 全量可见 | 六类对象全量可见。 |
| 区管 `admin` | `region` | 当前用户 `region` | 当前区域渠道 | 当前区域用户 | 按 `region` 裁剪客户、服务商、报备、商机、报价、订单。 |
| 渠道账号 `partner_admin` | `partner` | 当前账号区域 | 本渠道及下级渠道 | 本渠道关联用户 | 按 `partnerId / assignedPartnerId / parentPartnerId / parentPartnerIds` 裁剪。 |
| 销售员工 `staff` | `user` | 当前账号区域 | 当前账号渠道 | 当前用户 | 仅本人创建、负责、分配的数据。 |

### 2.4 区域字段继承规则

`quotes`、`orders` 现在都按以下顺序补齐 `region / bigRegion`：

```text
对象自身 region/bigRegion
  -> 关联商机 opportunity.region/bigRegion
  -> 关联报价 quote.region/bigRegion，仅订单适用
  -> 关联渠道 partner.region/bigRegion
  -> 负责人/创建人 user.region/bigRegion
  -> 空字符串
```

该规则只作用于 OpenAPI 标准只读输出和 OpenAPI 权限过滤，不回写 CRM 原业务数据。

---

## 3. 字段全量清单

字段标识说明：

| 标识 | 含义 |
|---|---|
| 是否敏感 | `是` 表示个人联系方式、统一信用代码、企微 userid 等需脱敏或受控展示。 |
| 是否允许分析 | `是` 表示可进入分析库、语义层和 Text-to-SQL 白名单。 |
| 是否允许企微展示 | `是` 可直接展示；`权限展示` 表示只对有权限用户展示且建议脱敏；`否` 不建议企微直接展示。 |

### 3.1 权限桥表 `permission_scope`

| 字段名 | 中文名 | 类型 | 是否敏感 | 是否允许分析 | 是否允许企微展示 |
|---|---|---|---|---|---|
| `scopeType` | 权限范围类型 | string | 否 | 是 | 是 |
| `isFullAccess` | 是否全量权限 | boolean | 否 | 是 | 是 |
| `regions` | 可见区域 | array | 否 | 是 | 是 |
| `bigRegions` | 可见大区 | array | 否 | 是 | 是 |
| `partnerIds` | 可见渠道 ID | array | 否 | 是 | 否 |
| `userIds` | 可见用户 ID | array | 否 | 是 | 否 |
| `ownerIds` | 可见负责人 ID | array | 否 | 是 | 否 |
| `managedUserIds` | 管理用户 ID | array | 否 | 是 | 否 |
| `departmentIds` | 部门 ID | array | 否 | 是 | 否 |
| `organizationIds` | 组织 ID | array | 否 | 是 | 否 |

### 3.2 客户 `customers`

| 字段名 | 中文名 | 类型 | 是否敏感 | 是否允许分析 | 是否允许企微展示 |
|---|---|---|---|---|---|
| `id` | 客户 ID | string | 否 | 是 | 是 |
| `customerId` | 客户关联 ID | string | 否 | 是 | 是 |
| `name` | 客户名称 | string | 否 | 是 | 是 |
| `customer` | 客户名称兼容字段 | string | 否 | 是 | 是 |
| `status` | 生命周期状态编码 | string | 否 | 是 | 是 |
| `statusName` | 生命周期状态名称 | string | 否 | 是 | 是 |
| `region` | 区域 | string | 否 | 是 | 是 |
| `bigRegion` | 大区 | string | 否 | 是 | 是 |
| `ownerId` | 负责人 ID | string | 否 | 是 | 否 |
| `ownerName` | 负责人姓名 | string | 否 | 是 | 是 |
| `assignedStaffId` | 指派员工 ID | string | 否 | 是 | 否 |
| `assignedStaffName` | 指派员工姓名 | string | 否 | 是 | 是 |
| `partnerId` | 渠道 ID | string | 否 | 是 | 是 |
| `partnerName` | 渠道名称 | string | 否 | 是 | 是 |
| `departmentId` | 部门 ID | string | 否 | 是 | 否 |
| `organizationId` | 组织 ID | string | 否 | 是 | 否 |
| `hasRegistration` | 是否有报备 | boolean | 否 | 是 | 是 |
| `registrationCount` | 报备数 | number | 否 | 是 | 是 |
| `hasOpportunity` | 是否有商机 | boolean | 否 | 是 | 是 |
| `opportunityCount` | 商机数 | number | 否 | 是 | 是 |
| `hasQuote` | 是否有报价 | boolean | 否 | 是 | 是 |
| `quoteCount` | 报价数 | number | 否 | 是 | 是 |
| `hasOrder` | 是否有订单 | boolean | 否 | 是 | 是 |
| `orderCount` | 订单数 | number | 否 | 是 | 是 |
| `latestActivityAt` | 最近活动时间 | datetime | 否 | 是 | 是 |
| `createdAt` | 创建时间 | datetime | 否 | 是 | 是 |
| `updatedAt` | 更新时间 | datetime | 否 | 是 | 是 |

### 3.3 服务商/渠道 `partners`

| 字段名 | 中文名 | 类型 | 是否敏感 | 是否允许分析 | 是否允许企微展示 |
|---|---|---|---|---|---|
| `id` | 服务商 ID | string | 否 | 是 | 是 |
| `name` | 服务商名称 | string | 否 | 是 | 是 |
| `shortName` | 服务商简称 | string | 否 | 是 | 是 |
| `partnerLevel` | 合作级别编码 | string | 否 | 是 | 是 |
| `partnerLevelName` | 合作级别名称 | string | 否 | 是 | 是 |
| `parentPartnerId` | 上级服务商 ID | string | 否 | 是 | 是 |
| `parentPartnerIds` | 上级服务商链 | array | 否 | 是 | 否 |
| `region` | 区域 | string | 否 | 是 | 是 |
| `bigRegion` | 大区 | string | 否 | 是 | 是 |
| `contact` | 联系人 | string | 是 | 否 | 权限展示 |
| `phone` | 联系电话 | string | 是 | 否 | 权限展示 |
| `email` | 邮箱 | string | 是 | 否 | 权限展示 |
| `status` | 状态编码 | string | 否 | 是 | 是 |
| `joinDate` | 加入日期 | date | 否 | 是 | 是 |
| `isTechnicalServiceProvider` | 是否技术服务商 | boolean | 否 | 是 | 是 |
| `technicalServiceProviderType` | 技术服务商类型 | string | 否 | 是 | 是 |
| `ownerId` | 负责人 ID | string | 否 | 是 | 否 |
| `ownerName` | 负责人姓名 | string | 否 | 是 | 是 |
| `createdAt` | 创建时间 | datetime | 否 | 是 | 是 |
| `updatedAt` | 更新时间 | datetime | 否 | 是 | 是 |

### 3.4 报备 `registrations`

| 字段名 | 中文名 | 类型 | 是否敏感 | 是否允许分析 | 是否允许企微展示 |
|---|---|---|---|---|---|
| `id` | 报备 ID | string | 否 | 是 | 是 |
| `customerId` | 客户 ID | string | 否 | 是 | 是 |
| `customer` | 客户名称 | string | 否 | 是 | 是 |
| `project` | 项目名称 | string | 否 | 是 | 是 |
| `industry` | 行业 | string | 否 | 是 | 是 |
| `contact` | 联系人 | string | 是 | 否 | 权限展示 |
| `phone` | 联系电话 | string | 是 | 否 | 权限展示 |
| `creditCode` | 统一社会信用代码 | string | 是 | 否 | 权限展示 |
| `status` | 报备状态编码 | string | 否 | 是 | 是 |
| `ownerId` | 负责人 ID | string | 否 | 是 | 否 |
| `ownerName` | 负责人姓名 | string | 否 | 是 | 是 |
| `createdBy` | 创建人 ID | string | 否 | 是 | 否 |
| `createdByName` | 创建人姓名 | string | 否 | 是 | 是 |
| `assignedStaffId` | 指派员工 ID | string | 否 | 是 | 否 |
| `assignedStaffName` | 指派员工姓名 | string | 否 | 是 | 是 |
| `partnerId` | 渠道 ID | string | 否 | 是 | 是 |
| `partnerName` | 渠道名称 | string | 否 | 是 | 是 |
| `assignedPartnerId` | 归属渠道 ID | string | 否 | 是 | 是 |
| `assignedPartnerName` | 归属渠道名称 | string | 否 | 是 | 是 |
| `region` | 区域 | string | 否 | 是 | 是 |
| `bigRegion` | 大区 | string | 否 | 是 | 是 |
| `estimatedAmt` | 预计金额 | number | 否 | 是 | 权限展示 |
| `signDate` | 预计签约日期 | date | 否 | 是 | 是 |
| `createdAt` | 创建时间 | datetime | 否 | 是 | 是 |
| `updatedAt` | 更新时间 | datetime | 否 | 是 | 是 |

### 3.5 商机 `opportunities`

| 字段名 | 中文名 | 类型 | 是否敏感 | 是否允许分析 | 是否允许企微展示 |
|---|---|---|---|---|---|
| `id` | 商机 ID | string | 否 | 是 | 是 |
| `customerId` | 客户 ID | string | 否 | 是 | 是 |
| `name` | 商机名称 | string | 否 | 是 | 是 |
| `customer` | 客户名称 | string | 否 | 是 | 是 |
| `stage` | 商机阶段编码 | string | 否 | 是 | 是 |
| `stageName` | 商机阶段名称 | string | 否 | 是 | 是 |
| `status` | 商机状态兼容字段 | string | 否 | 是 | 是 |
| `amount` | 商机金额 | number | 否 | 是 | 权限展示 |
| `expectedAmount` | 预计金额 | number | 否 | 是 | 权限展示 |
| `ownerId` | 负责人 ID | string | 否 | 是 | 否 |
| `ownerName` | 负责人姓名 | string | 否 | 是 | 是 |
| `assignedStaffId` | 指派员工 ID | string | 否 | 是 | 否 |
| `assignedStaffName` | 指派员工姓名 | string | 否 | 是 | 是 |
| `partnerId` | 渠道 ID | string | 否 | 是 | 是 |
| `partnerName` | 渠道名称 | string | 否 | 是 | 是 |
| `assignedPartnerId` | 归属渠道 ID | string | 否 | 是 | 是 |
| `region` | 区域 | string | 否 | 是 | 是 |
| `bigRegion` | 大区 | string | 否 | 是 | 是 |
| `createdAt` | 创建时间 | datetime | 否 | 是 | 是 |
| `updatedAt` | 更新时间 | datetime | 否 | 是 | 是 |

### 3.6 报价 `quotes`

| 字段名 | 中文名 | 类型 | 是否敏感 | 是否允许分析 | 是否允许企微展示 |
|---|---|---|---|---|---|
| `id` | 报价 ID | string | 否 | 是 | 是 |
| `quoteNo` | 报价单号 | string | 否 | 是 | 是 |
| `customerId` | 客户 ID | string | 否 | 是 | 是 |
| `customer` | 客户名称 | string | 否 | 是 | 是 |
| `oppId` | 主商机 ID | string | 否 | 是 | 是 |
| `oppIds` | 关联商机 ID 数组 | array | 否 | 是 | 否 |
| `amount` | 报价金额 | number | 否 | 是 | 权限展示 |
| `totalAmount` | 报价总金额 | number | 否 | 是 | 权限展示 |
| `status` | 报价状态编码 | string | 否 | 是 | 是 |
| `ownerId` | 负责人 ID | string | 否 | 是 | 否 |
| `ownerName` | 负责人姓名 | string | 否 | 是 | 是 |
| `assignedStaffId` | 指派员工 ID | string | 否 | 是 | 否 |
| `assignedStaffName` | 指派员工姓名 | string | 否 | 是 | 是 |
| `partnerId` | 渠道 ID | string | 否 | 是 | 是 |
| `assignedPartnerId` | 归属渠道 ID | string | 否 | 是 | 是 |
| `parentPartnerId` | 上级渠道 ID | string | 否 | 是 | 否 |
| `parentPartnerIds` | 上级渠道链 | array | 否 | 是 | 否 |
| `region` | 区域，支持继承兜底 | string | 否 | 是 | 是 |
| `bigRegion` | 大区，支持继承兜底 | string | 否 | 是 | 是 |
| `createdAt` | 创建时间 | datetime | 否 | 是 | 是 |
| `updatedAt` | 更新时间 | datetime | 否 | 是 | 是 |

### 3.7 订单 `orders`

| 字段名 | 中文名 | 类型 | 是否敏感 | 是否允许分析 | 是否允许企微展示 |
|---|---|---|---|---|---|
| `id` | 订单 ID | string | 否 | 是 | 是 |
| `orderNo` | 订单编号 | string | 否 | 是 | 是 |
| `customerId` | 客户 ID | string | 否 | 是 | 是 |
| `customer` | 客户名称 | string | 否 | 是 | 是 |
| `quoteId` | 报价 ID | string | 否 | 是 | 是 |
| `oppId` | 商机 ID | string | 否 | 是 | 是 |
| `amount` | 订单金额 | number | 否 | 是 | 权限展示 |
| `totalAmount` | 订单总金额 | number | 否 | 是 | 权限展示 |
| `status` | 订单状态编码 | string | 否 | 是 | 是 |
| `dealAt` | 成交/完成时间 | datetime | 否 | 是 | 是 |
| `ownerId` | 负责人 ID | string | 否 | 是 | 否 |
| `ownerName` | 负责人姓名 | string | 否 | 是 | 是 |
| `assignedStaffId` | 指派员工 ID | string | 否 | 是 | 否 |
| `assignedStaffName` | 指派员工姓名 | string | 否 | 是 | 是 |
| `partnerId` | 渠道 ID | string | 否 | 是 | 是 |
| `assignedPartnerId` | 归属渠道 ID | string | 否 | 是 | 是 |
| `parentPartnerId` | 上级渠道 ID | string | 否 | 是 | 否 |
| `parentPartnerIds` | 上级渠道链 | array | 否 | 是 | 否 |
| `region` | 区域，支持继承兜底 | string | 否 | 是 | 是 |
| `bigRegion` | 大区，支持继承兜底 | string | 否 | 是 | 是 |
| `createdAt` | 创建时间 | datetime | 否 | 是 | 是 |
| `updatedAt` | 更新时间 | datetime | 否 | 是 | 是 |

---

## 4. 关系口径

### 4.1 主键

| 对象 | 主键 |
|---|---|
| 客户 | `customers.customerId`，无显式 ID 时按统一信用代码或规范化客户名生成稳定 ID |
| 服务商/渠道 | `partners.id` |
| 报备 | `registrations.id` |
| 商机 | `opportunities.id` |
| 报价 | `quotes.id` |
| 订单 | `orders.id` |
| 用户 | `users.id` |

### 4.2 外键与匹配规则

| 关系 | 优先匹配 | 兜底匹配 |
|---|---|---|
| 客户-报备 | `registrations.customerId = customers.customerId` | 统一信用代码 hash；规范化客户名 hash |
| 客户-商机 | `opportunities.customerId = customers.customerId` | 统一信用代码 hash；规范化客户名 hash |
| 客户-报价 | `quotes.customerId = customers.customerId` | 报价关联商机的客户；规范化客户名 hash |
| 客户-订单 | `orders.customerId = customers.customerId` | 订单关联报价、商机的客户；规范化客户名 hash |
| 报备-商机 | 同一 `customerId` | 同客户名、同渠道或同区域、时间在报备之后 |
| 商机-报价 | `quotes.oppId / quotes.oppIds` 包含 `opportunities.id` | 同 `customerId` 且报价创建时间晚于商机 |
| 报价-订单 | `orders.quoteId = quotes.id` | 同 `customerId` 且订单创建时间晚于报价 |
| 服务商-业务对象 | `partnerId / assignedPartnerId` | `parentPartnerId / parentPartnerIds` 渠道链 |
| 用户-业务对象 | `ownerId / assignedStaffId / createdBy` | 关联报价/商机继承负责人 |

### 4.3 区域归属规则

区域分析统一使用对象标准化后的 `region / bigRegion`：

```text
registrations/opportunities: 优先对象自身字段
quotes: 对象自身 -> 关联商机 -> 渠道 -> 负责人
orders: 对象自身 -> 关联报价 -> 关联商机 -> 渠道 -> 负责人
customers: 来源业务对象归并后的最近/主归属字段
partners/users: 对象自身字段
```

---

## 5. 指标口径

| 指标 | 口径 |
|---|---|
| 商机金额 | 优先 `opportunities.amount`，为空时取 `expectedAmount / estimatedAmt / totalAmount` 中第一个有效数值。 |
| 报价金额 | 优先 `quotes.amount`，为空时取 `totalAmount / quoteAmount / price`。 |
| 订单金额 | 优先 `orders.amount`，为空时取 `totalAmount / orderAmount / dealAmount / contractAmount`。 |
| 有效订单 | 默认排除 `cancelled / canceled / void / rejected / deleted`；`completed / paid / confirmed / signed` 优先视为有效。 |
| 报备转商机 | 同一 `customerId` 下存在商机，或同客户名/信用代码命中商机；转化时间以商机 `createdAt` 为准。 |
| 商机转报价 | 商机 ID 被 `quotes.oppId / oppIds` 引用，或同 `customerId` 后续产生报价。 |
| 报价转订单 | 订单 `quoteId` 命中报价，或同 `customerId` 后续产生订单。 |
| 超两周未更新商机 | `opportunities.updatedAt` 距当前时间超过 14 天，且阶段不在 `won / lost`。 |
| 最近 30 天未活跃客户 | 客户归并后的 `latestActivityAt` 距当前时间超过 30 天，或无任何报备/商机/报价/订单更新。 |
| 客户未报备 | 客户视图 `hasRegistration = false` 或 `registrationCount = 0`。 |
| 客户未建商机 | 客户视图 `hasOpportunity = false` 或 `opportunityCount = 0`。 |
| 区域业绩 | 按标准化 `region` 聚合订单金额、报价金额、商机金额、报备数。 |
| 大区业绩 | 按标准化 `bigRegion` 聚合订单金额、报价金额、商机金额、报备数。 |
| 渠道贡献 | 按 `partnerId / assignedPartnerId` 聚合报备数、商机数、报价数、订单数和金额。 |
| 复购率 | 同一 `customerId` 有 2 笔及以上有效订单的客户数 / 有有效订单客户数。 |
| 成交率 | 有效订单数 / 商机数；按实际分析也可提供有效订单客户数 / 商机客户数口径。 |

---

## 6. 字典枚举

推荐优先读取：

```http
GET /meta/dictionaries
```

### 6.1 角色

| 编码 | 中文名 |
|---|---|
| `superadmin` | 超级管理员 |
| `admin` | 区域管理员 |
| `partner_admin` | 渠道管理员 |
| `staff` | 员工 |

### 6.2 商机阶段

| 编码 | 中文名 |
|---|---|
| `contacted` | 已接触 |
| `qualified` | 已确认 |
| `proposal` | 方案/报价中 |
| `negotiation` | 商务谈判 |
| `won` | 已成交 |
| `lost` | 已失单 |

### 6.3 常用状态

| 对象 | 编码 | 中文名 |
|---|---|---|
| 报备 | `pending` | 待审批 |
| 报备 | `approved` | 已通过 |
| 报备 | `rejected` | 已驳回 |
| 报价 | `draft` | 草稿 |
| 报价 | `submitted` | 已提交 |
| 报价 | `approved` | 已审批 |
| 报价 | `rejected` | 已驳回 |
| 订单 | `pending` | 待处理 |
| 订单 | `confirmed` | 已确认 |
| 订单 | `completed` | 已完成 |
| 订单 | `cancelled` | 已取消 |
| 服务商 | `active` | 有效 |
| 服务商 | `pending` | 待审核 |
| 服务商 | `inactive` | 停用 |

### 6.4 合作级别

| 编码 | 中文名 |
|---|---|
| `none` | 未设置 |
| `primary` | 一级渠道 |
| `secondary` | 二级渠道 |

### 6.5 区域与大区

区域、大区不写死在 AI-agent，统一从以下来源取值：

```http
GET /meta/dictionaries
```

返回字段：

```text
regions
bigRegions
```

如业务对象存在新区域值，字典接口会自动从用户、客户、渠道、报备、商机、报价、订单中归集。

---

## 7. 样例问题和期望结果

以下样例用于回归验证。实际数值以联调环境实时数据为准，期望重点是“不越权、字段完整、口径一致、可解释”。

### 7.1 超管 `liulonghai`

| 样例问题 | 期望结果 |
|---|---|
| 上个月各大区签了多少单，金额多少？ | 返回全量大区订单数、有效订单金额，按 `bigRegion` 分组。 |
| 最近 30 天没有活跃的客户有哪些？ | 返回全量客户，按 `latestActivityAt` 判断，包含客户、区域、负责人、最近活动时间。 |
| 哪些渠道贡献最高？ | 返回全量渠道贡献，包含报备、商机、报价、订单和金额。 |
| 报备到订单整体转化率是多少？ | 返回全量漏斗：报备数、商机数、报价数、订单数和各阶段转化率。 |

### 7.2 区管 `admin_sd`

| 样例问题 | 期望结果 |
|---|---|
| 山东区域本月订单金额是多少？ | 只返回 `regions` 内订单，订单/报价可使用继承后的 `region` 命中。 |
| 本区域超两周未更新的商机有哪些？ | 只返回该区域商机，排除已赢单/已失单。 |
| 本区域哪些客户还没有建商机？ | 只返回该区域客户，按 `hasOpportunity = false` 判断。 |
| 本区域渠道商活跃度排行？ | 只返回该区域渠道，聚合报备、商机、报价、订单活跃情况。 |

### 7.3 渠道账号 `liangcui`

| 样例问题 | 期望结果 |
|---|---|
| 我们渠道最近有哪些报备？ | 只返回本渠道及下级渠道链路内报备。 |
| 我们渠道本季度订单金额是多少？ | 只统计 `partnerId / assignedPartnerId / parentPartnerIds` 命中的订单。 |
| 我们渠道哪些客户已有报价但未下单？ | 返回本渠道可见客户，报价存在、有效订单不存在。 |
| 我们渠道商机转报价率是多少？ | 只基于本渠道可见商机和报价计算。 |

### 7.4 销售员工 `shangxichao`

| 样例问题 | 期望结果 |
|---|---|
| 我负责的商机有哪些超两周没更新？ | 只返回本人创建、负责或分配的商机。 |
| 我最近 30 天跟进的客户有哪些？ | 只返回本人权限内客户，包含客户名、最近活动时间、业务来源。 |
| 我本月报价金额多少？ | 只统计本人创建、负责或分配的报价。 |
| 我负责的客户哪些还没报备？ | 只返回本人权限内客户，按 `hasRegistration = false` 判断。 |

---

## 8. AI-agent 建议校验步骤

1. 使用四组 client 分别获取 Token。
2. 调用 `GET /meta/permission-scope`，确认四类账号 `scopeType / regions / partnerIds / userIds` 与预期一致。
3. 调用 `GET /quotes?pageNo=1&pageSize=20`，确认每条记录含 `region / bigRegion`。
4. 调用 `GET /orders?pageNo=1&pageSize=20`，确认每条记录含 `region / bigRegion`。
5. 使用区管 client 查询订单、报价，确认不会因原始订单/报价区域为空而漏掉可继承归属的数据。
6. 调用 `GET /meta/dictionaries`，同步 `regions / bigRegions / roles / stages / statuses / partnerLevels`。
7. 按第 7 节样例问题跑回归，重点校验权限边界和指标口径。


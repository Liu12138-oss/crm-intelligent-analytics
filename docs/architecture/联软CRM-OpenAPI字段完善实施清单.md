# 联软CRM-OpenAPI字段完善实施清单

> 日期：2026-06-08  
> 依据：对方《联软CRM-需补充完善字段与资料清单》  
> 目标：逐步补齐 AI-agent 智能分析所需的字段、字典、权限口径、样例与统计接口。

## 1. 本轮已完成

### 1.1 六类对象字段增强

| 对象 | 本轮补充字段 | 说明 |
|---|---|---|
| `users` | `roleName`、`wecomUserId`、`departmentId`、`departmentName` | 其中企微和部门字段如当前库无值则返回空字符串，字段名保持稳定。 |
| `partners` | `shortName`、`partnerLevelName`、`isTechnicalServiceProvider`、`technicalServiceProviderType` | `isTechnicalServiceProvider` 由现有 `isTechService` / `techServiceType` 标准化输出。 |
| `registrations` | `assignedStaffId` 兜底、`assignedStaffName` 兜底、`createdByName` 兜底 | 用于客户报备负责人和权限诊断。 |
| `opportunities` | `stageName`、`status`、`ownerId` 兜底、`ownerName`、`assignedStaffName` 兜底 | `status` 当前兼容输出为商机阶段，便于对方统一筛选。 |
| `quotes` | `ownerId`、`ownerName`、`amount`、`totalAmount`、`assignedStaffName` 兜底 | 金额统一可通过 `amount` 或 `totalAmount` 分析。 |
| `orders` | `ownerId`、`ownerName`、`amount`、`totalAmount`、`dealAt`、`assignedStaffName` 兜底 | `dealAt` 当前按成交/完成相关字段兜底，无成交字段时为空。 |

### 1.2 字典增强

`GET /api/open/v1/meta/dictionaries` 已补充：

| 字典 | 字段名 | 说明 |
|---|---|---|
| 技术服务商字典 | `technicalServiceProviderTypes` | `true=技术服务商`，`false=非技术服务商`。 |
| 角色字典 | `roles` | 已含超管、区域管理员、渠道管理员、员工。 |
| 服务商等级 | `partnerLevels` | 已含未设置、一级渠道、二级渠道。 |
| 区域/大区 | `regions`、`bigRegions` | 从当前业务对象动态聚合。 |

### 1.3 筛选增强

服务商列表与统计已支持：

```text
GET /api/open/v1/partners?isTechnicalServiceProvider=true
GET /api/open/v1/partners?isTechnicalServiceProvider=false
```

### 1.4 统计接口增强

| 能力 | 路径 | 状态 |
|---|---|---|
| 服务商画像统计 | `GET /api/open/v1/analytics/partners/profile` | 已补充 |
| 转化漏斗简写 | `GET /api/open/v1/analytics/funnel` | 已补充 |
| 转化漏斗兼容路径 | `GET /api/open/v1/analytics/funnel/registration-opportunity-order` | 已有 |
| 区域经营统计 | `GET /api/open/v1/analytics/regions/contribution` | 已补充 |
| 负责人经营统计 | `GET /api/open/v1/analytics/owners/contribution` | 已补充 |
| 服务商贡献统计 | `GET /api/open/v1/analytics/partners/contribution` | 已有 |

## 2. 当前字段口径说明

### 2.1 技术服务商

标准输出字段：

```json
{
  "isTechnicalServiceProvider": true,
  "technicalServiceProviderType": "full"
}
```

当前映射规则：

| 内部字段 | 标准字段 |
|---|---|
| `isTechnicalServiceProvider` | 优先直接使用 |
| `isTechService` | 映射为 `isTechnicalServiceProvider` |
| `techServiceType != none` | 映射为 `isTechnicalServiceProvider=true` |

### 2.2 金额字段

标准分析字段统一优先使用 `amount`。为兼容历史对象，OpenAPI 会从以下字段兜底取金额：

```text
amount、totalAmount、total、totalAmt、orderAmount、quoteAmount、estimatedAmt、expectedAmount
```

### 2.3 时间字段

| 场景 | 建议字段 |
|---|---|
| 创建/加入时间 | `createdAt` |
| 服务商加入时间 | `createdAt`，无值时由 `joinDate` 兜底 |
| 更新时间 | `updatedAt` |
| 订单成交时间 | `dealAt`，无值时暂不强行推断 |

### 2.4 权限裁剪

所有新增统计接口均复用现有 OpenAPI 鉴权和权限裁剪：

| 角色 | 数据范围 |
|---|---|
| 超管 | 全量 |
| 区域管理员 | 本区域 |
| 渠道管理员 | 本渠道及关联上下级渠道 |
| 员工 | 本人创建、负责或分配的数据 |

## 3. 待对方/业务侧继续确认

| 优先级 | 待确认项 | 原因 |
|---|---|---|
| P0 | 企微 `userid` 与 CRM 用户 ID 映射 | 当前字段已预留，但多数用户可能无 `wecomUserId`。 |
| P0 | 四类角色的可见/不可见样例 ID | 用于对方做权限矩阵实测。 |
| P0 | 生产 Base URL、内外网访问方式 | 影响 AI-agent 正式配置。 |
| P0 | 真实 AppSecret 交付方式 | 历史密钥不可反查，只能新建或重置后一次性保存。 |
| P1 | 订单 `dealAt` 最终业务口径 | 当前仅兜底输出，正式成交时间需业务确认。 |
| P1 | 服务商简称是否需要人工维护 | 当前 `shortName` 无值时兜底为 `name`。 |
| P1 | 样例数据是否需要补充到 5 条完整转化链路 | 当前真实库订单数量偏少，漏斗样例不够丰满。 |

## 4. 建议下一步

1. 先把本轮字段增强部署到测试环境，让 AI-agent 重新拉取字段。
2. 对方按四类 client 分别测试：超管、区域、渠道、员工。
3. 双方共同确认 `isTechnicalServiceProvider`、金额、服务商加入时间和订单成交时间口径。
4. 根据测试结果补第二批：企微映射、样例数据、增量同步字段、限流错误码。

---

## 5. 角色权限与企微映射补充实施

### 5.1 已补接口

| 接口 | 状态 | 说明 |
|---|---|---|
| `GET /api/open/v1/users/{userId}/permission-scope` | 已补 | 查询指定 CRM 用户权限范围，按当前 token 可见用户范围限制。 |
| `GET /api/open/v1/meta/role-permissions` | 已补 | 返回四类角色权限矩阵、对象过滤规则和稳定二次裁剪字段。 |

### 5.2 已补用户字段

| 字段 | 状态 | 说明 |
|---|---|---|
| `wecomUserId` | 已补 | 当前无企微映射时为空字符串。 |
| `mobile` | 已补 | 由 `mobile || phone` 兜底。 |
| `email` | 已补 | 原字段透出。 |
| `roleName`、`roleIds`、`roleNames`、`isAdmin` | 已补 | 支持角色识别和后续多角色扩展。 |
| `departmentId`、`departmentIds`、`departmentName` | 已补 | 当前无部门映射时为空。 |
| `organizationId`、`organizationIds` | 已补 | 当前无组织映射时为空。 |
| `managedUserIds`、`ownerIds` | 已补 | 按现有 CRM 权限范围计算。 |

### 5.3 已补对象归属字段

| 对象 | 状态 |
|---|---|
| `partners` | 已补 `ownerId/ownerName/departmentId/organizationId`，保留 `parentPartnerId/parentPartnerIds`。 |
| `registrations` | 已补 `ownerId/ownerName/departmentId/organizationId`，保留 `assignedStaffId/createdBy/partnerId/region/bigRegion`。 |
| `opportunities` | 已补 `departmentId/organizationId`，保留 `ownerId/assignedStaffId/createdBy/partnerId/region/bigRegion`。 |
| `quotes` | 已补 `departmentId/organizationId`，保留 `ownerId/assignedStaffId/createdBy/partnerId/region/bigRegion`。 |
| `orders` | 已补 `departmentId/organizationId`，保留 `ownerId/assignedStaffId/createdBy/partnerId/region/bigRegion`。 |

### 5.4 待真实数据继续确认

| 项 | 当前处理 |
|---|---|
| 企业微信 userid 真实映射 | 字段已预留，需后续导入或维护 `wecomUserId`。 |
| 部门/组织真实树 | 字段已预留，当前没有映射时返回空。 |
| 可见/不可见样例数据 | 接口已支持，需在联调环境按四类测试账号导出实测矩阵。 |

---

## 6. 智能分析全量补充实施

### 6.1 已补接口

| 接口 | 状态 | 说明 |
|---|---|---|
| `GET /api/open/v1/customers` | 已补 | 客户主数据只读视图。 |
| `GET /api/open/v1/customers/{id}` | 已补 | 客户详情。 |
| `GET /api/open/v1/customers/{id}/registrations` | 已补 | 客户关联报备。 |
| `GET /api/open/v1/customers/{id}/opportunities` | 已补 | 客户关联商机。 |
| `GET /api/open/v1/customers/{id}/quotes` | 已补 | 客户关联报价。 |
| `GET /api/open/v1/customers/{id}/orders` | 已补 | 客户关联订单。 |
| `GET /api/open/v1/auth/permission-scope` | 已补 | 兼容对方清单路径。 |
| `GET /api/open/v1/analytics/customers/lifecycle` | 已补 | 客户生命周期总览。 |
| `GET /api/open/v1/analytics/customers/unregistered-opportunity` | 已补 | 未报备/未建商机/未报价/未下单统计。 |
| `GET /api/open/v1/analytics/customers/idle` | 已补 | 沉睡客户列表。 |
| `GET /api/open/v1/analytics/customers/summary` | 已补 | 客户通用摘要统计。 |

### 6.2 已补字段

| 对象 | 字段 |
|---|---|
| `customers` | `id/customerId/name/createdAt/updatedAt/latestActivityAt/status/statusName/region/bigRegion/ownerId/ownerName/assignedStaffId/assignedStaffName/partnerId/partnerName/departmentId/departmentName/organizationId/source/category/categoryName/hasRegistration/hasOpportunity/hasQuote/hasOrder/ageBucket/customerIdRule/matchKey` |
| `registrations` | 已补 `customerId/customerIdRule`。 |
| `opportunities` | 已补 `customerId/customerIdRule`。 |
| `quotes` | 已补 `customerId/customerIdRule`。 |
| `orders` | 已补 `customerId/customerIdRule`。 |

### 6.3 当前实现口径

1. 不改数据库表结构，不写客户表。
2. `customers` 由当前权限范围内的报备、商机、报价、订单归并生成。
3. `customerId` 优先级为真实客户 ID、信用代码哈希、标准化名称哈希。
4. 已授权 `registrations` 的旧 client 可兼容访问 `customers`，新 client 建议显式加入 `customers`。

### 6.4 后续建议

| 项 | 建议 |
|---|---|
| 真实客户主表 | 后续如有独立客户表，直接映射真实 `customerId`。 |
| 同名客户 | 建议补统一社会信用代码或真实客户 ID，减少名称归并误差。 |
| 样例数据 | 建议补 10 个客户完整链路样例，覆盖未报备、已报备未商机、已商机未报价、已报价未下单、已下单。 |

# 发给 crm-agent：联软 CRM OpenAPI 字段与统计接口更新说明

> 日期：2026-06-08  
> 适用对象：crm-agent / AI-agent 对接团队  
> 目的：同步联软 CRM 标准 OpenAPI 在字段、字典、统计接口、权限口径上的最新增强，便于对方更新适配与联调脚本。  
> 说明：本文不包含明文 `appSecret`。如需凭证，请通过安全渠道单独交付或在 CRM OpenAPI 管理页重置后一次性复制。

## 1. 当前对接方式

联软 CRM 第一阶段仍建议 crm-agent 统一走标准 OpenAPI，不建议直接读取 CRM SQLite。

```text
crm-agent / AI-agent
  -> 联软 CRM OpenAPI
  -> CRM 原有权限裁剪
  -> 六类业务对象与统计分析
```

OpenAPI 前缀：

```text
/api/open/v1
```

联调 Base URL 以实际部署环境为准，例如：

```text
http://10.18.16.114:3000/api/open/v1
```

## 2. 本轮已补充字段

### 2.1 用户 `users`

新增/标准化字段：

| 字段 | 说明 |
|---|---|
| `roleName` | 角色中文名 |
| `wecomUserId` | 企业微信 userid，当前无映射时返回空字符串 |
| `departmentId` | 部门 ID，当前无映射时返回空字符串 |
| `departmentName` | 部门名称，当前无映射时返回空字符串 |

### 2.2 服务商/渠道商 `partners`

新增/标准化字段：

| 字段 | 说明 |
|---|---|
| `shortName` | 服务商简称，无简称时兜底为 `name` |
| `partnerLevelName` | 渠道等级中文名 |
| `isTechnicalServiceProvider` | 是否技术服务商，boolean |
| `technicalServiceProviderType` | 技术服务商类型，当前由内部 `techServiceType` 兜底 |
| `createdAt` | 加入/创建时间，无 `createdAt` 时由 `joinDate` 兜底 |

技术服务商映射口径：

```text
isTechnicalServiceProvider = isTechnicalServiceProvider || isTechService || techServiceType != none
```

### 2.3 客户报备 `registrations`

补齐负责人展示相关字段兜底：

| 字段 | 说明 |
|---|---|
| `assignedStaffId` | 指派/负责员工 ID，缺失时按创建人兜底 |
| `assignedStaffName` | 指派/负责员工姓名 |
| `createdByName` | 创建人姓名 |

### 2.4 商机 `opportunities`

新增/标准化字段：

| 字段 | 说明 |
|---|---|
| `stageName` | 商机阶段中文名 |
| `status` | 当前兼容输出为商机阶段，便于统一筛选 |
| `ownerId` | 负责人 ID |
| `ownerName` | 负责人姓名 |
| `assignedStaffName` | 指派员工姓名 |

### 2.5 报价 `quotes`

新增/标准化字段：

| 字段 | 说明 |
|---|---|
| `ownerId` | 负责人 ID |
| `ownerName` | 负责人姓名 |
| `amount` | 报价金额标准分析字段 |
| `totalAmount` | 报价金额兼容字段 |
| `assignedStaffName` | 指派员工姓名 |

### 2.6 订单 `orders`

新增/标准化字段：

| 字段 | 说明 |
|---|---|
| `ownerId` | 负责人 ID |
| `ownerName` | 负责人姓名 |
| `amount` | 订单金额标准分析字段 |
| `totalAmount` | 订单金额兼容字段 |
| `dealAt` | 成交/完成时间，当前无明确业务字段时可能为空 |
| `assignedStaffName` | 指派员工姓名 |

## 3. 字典接口更新

接口：

```http
GET /api/open/v1/meta/dictionaries
```

新增字典：

```json
{
  "technicalServiceProviderTypes": [
    { "value": "true", "label": "技术服务商", "enabled": true },
    { "value": "false", "label": "非技术服务商", "enabled": true }
  ]
}
```

## 4. 新增筛选

服务商列表支持按是否技术服务商筛选：

```http
GET /api/open/v1/partners?isTechnicalServiceProvider=true
GET /api/open/v1/partners?isTechnicalServiceProvider=false
```

注意：筛选仍然只在当前 token 绑定 CRM 用户可见范围内生效，不能突破权限。

## 5. 新增统计接口

### 5.1 服务商画像统计

```http
GET /api/open/v1/analytics/partners/profile
```

用途：

按当前权限范围返回服务商总数、有效数、技术服务商数量，并按等级、技术服务商、状态、区域、大区聚合。

### 5.2 转化漏斗简写接口

```http
GET /api/open/v1/analytics/funnel
```

用途：

返回：

```text
客户报备 -> 商机 -> 报价 -> 订单
```

兼容旧路径：

```http
GET /api/open/v1/analytics/funnel/registration-opportunity-order
```

### 5.3 区域经营贡献

```http
GET /api/open/v1/analytics/regions/contribution
GET /api/open/v1/analytics/regions/contribution?groupBy=bigRegion
```

用途：

按区域或大区聚合报备数、商机数/金额、报价数/金额、订单数/金额。

### 5.4 负责人经营贡献

```http
GET /api/open/v1/analytics/owners/contribution
```

用途：

按负责人聚合报备数、商机数/金额、报价数/金额、订单数/金额。

## 6. 权限口径

所有新增接口都复用联软 CRM 原有权限裁剪：

| 绑定角色 | 数据范围 |
|---|---|
| `superadmin` | 全量 |
| `admin` | 本区域 |
| `partner_admin` | 本渠道及关联上下级渠道 |
| `staff` | 本人创建、负责或分配的数据 |

无权限访问资源时返回 403，不伪装成全量空数据。权限内无数据时才返回空数组或统计为 0。

## 7. 建议 crm-agent 重新验证顺序

1. `POST /auth/token`
2. `GET /auth/me`
3. `GET /meta/permission-scope`
4. `GET /meta/dictionaries`
5. `GET /partners?pageNo=1&pageSize=1`
6. `GET /partners?isTechnicalServiceProvider=true&pageNo=1&pageSize=3`
7. `GET /opportunities?pageNo=1&pageSize=1`
8. `GET /analytics/partners/profile`
9. `GET /analytics/funnel`
10. `GET /analytics/regions/contribution`
11. `GET /analytics/owners/contribution`
12. 分别使用超管、区域、渠道、员工 4 组 client 验证权限差异。

## 8. 本轮本地验证结果

本轮在本地临时后端验证通过：

| 验证项 | 结果 |
|---|---|
| `partners.isTechnicalServiceProvider` | 可返回 |
| `partners.partnerLevelName` | 可返回 |
| `opportunities.stageName` | 可返回 |
| `opportunities.ownerName` | 可返回 |
| `technicalServiceProviderTypes` | 可返回 |
| `partners?isTechnicalServiceProvider=true` | 可筛选 |
| `analytics/partners/profile` | 可返回 |
| `analytics/funnel` | 可返回 |
| `analytics/regions/contribution` | 可返回 |
| `analytics/owners/contribution` | 可返回 |

## 9. 仍需双方确认

| 优先级 | 待确认项 | 说明 |
|---|---|---|
| P0 | CRM 用户与企微 `userid` 映射 | 当前字段已预留，无映射时返回空字符串。 |
| P0 | 四类角色可见/不可见样例 ID | 用于 crm-agent 权限矩阵自动化验收。 |
| P0 | 生产 Base URL 与内外网访问方式 | 影响正式联调配置。 |
| P0 | AppSecret 交付方式 | 历史密钥不可反查，只能新建或重置后一次性展示。 |
| P1 | 订单 `dealAt` 最终业务口径 | 当前按已有成交/完成字段兜底，无明确值时为空。 |
| P1 | 样例数据完整转化链路 | 当前真实库订单数量偏少，漏斗样例建议后续补齐。 |

## 10. 建议对方本轮更新点

1. 字段模型新增 `isTechnicalServiceProvider`、`partnerLevelName`、`stageName`、`ownerName`、`dealAt` 等字段。
2. 语义层增加“技术服务商/非技术服务商”维度。
3. 智能分析优先调用统计接口，减少分页拉全量。
4. 若问“最近一年加入的服务商”，优先使用 `partners.createdAt`。
5. 若问“按负责人排行”，优先使用 `analytics/owners/contribution`。

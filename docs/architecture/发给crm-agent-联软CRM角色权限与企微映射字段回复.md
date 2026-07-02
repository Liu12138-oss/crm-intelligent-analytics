# 发给 crm-agent：联软 CRM 角色权限与企微映射字段回复

> 日期：2026-06-08  
> 适用对象：crm-agent / AI-agent 对接团队  
> 对应材料：《联软CRM-角色权限与企微映射字段补充清单》  
> 说明：本文不包含明文 `appSecret`。凭证仍通过 CRM OpenAPI 管理页新建或重置后一次性交付。

## 1. 总体结论

联软 CRM 本轮按 AI-agent 清单补齐了角色权限、企微映射和二次裁剪字段。第一阶段仍建议 AI-agent 走标准 OpenAPI，不直接读取 CRM 库表。

```text
AI-agent
  -> 联软 CRM OpenAPI
  -> CRM token/client 鉴权
  -> CRM 原有角色权限裁剪
  -> 返回用户、权限范围、六类业务对象、统计结果
```

OpenAPI 前缀：

```text
/api/open/v1
```

## 2. 本轮新增/确认接口

| 接口 | 状态 | 用途 |
|---|---|---|
| `GET /auth/me` | 已有并增强 | 查询当前 client 和绑定 CRM 用户。 |
| `GET /identity/users/{userId}` | 已有并增强 | 查询 CRM 用户身份上下文。 |
| `GET /meta/permission-scope` | 已有并增强 | 查询当前 token 绑定用户权限范围。 |
| `GET /users/{userId}/permission-scope` | 本轮新增 | 查询指定 CRM 用户权限范围。 |
| `GET /meta/role-permissions` | 本轮新增 | 查询四类角色权限矩阵和对象裁剪规则。 |
| `GET /meta/dictionaries` | 已有 | 查询角色、状态、区域、大区、技术服务商等字典。 |

## 3. 用户与企微映射字段

以下字段会在 `users` 列表、用户详情、`auth/me`、`identity/users/{userId}` 中稳定返回。无真实映射时返回空字符串或空数组，不会缺字段。

| 字段 | 示例 | 说明 |
|---|---|---|
| `id` | `A030` | CRM 用户唯一 ID。 |
| `username` | `liulonghai` | CRM 登录账号。 |
| `name` | `刘龙海` | 姓名。 |
| `status` | `active` | 用户状态。 |
| `role` | `superadmin` | CRM 角色编码。 |
| `roleName` | `超级管理员` | CRM 角色名称。 |
| `roleIds` | `["superadmin"]` | 角色编码数组。 |
| `roleNames` | `["超级管理员"]` | 角色名称数组。 |
| `isAdmin` | `true` | `superadmin/admin` 为 `true`。 |
| `wecomUserId` | `zhangsan` | 企业微信 userid，未维护时为空。 |
| `mobile` | `13800138000` | 手机号兼容字段。 |
| `email` | `user@example.com` | 邮箱。 |
| `departmentId` | `dept_001` | 部门 ID，未维护时为空。 |
| `departmentName` | `山东销售部` | 部门名称，未维护时为空。 |
| `departmentIds` | `["dept_001"]` | 部门 ID 数组。 |
| `organizationId` | `org_001` | 组织 ID，未维护时为空。 |
| `organizationIds` | `["org_001"]` | 组织 ID 数组。 |
| `region` | `山东区` | 区域。 |
| `bigRegion` | `华东大区` | 大区。 |
| `partnerId` | `P001` | 绑定渠道 ID。 |
| `partnerName` | `山东联软服务商` | 绑定渠道名称。 |
| `managedUserIds` | `["A013","S022"]` | 当前用户权限内可见用户 ID。 |
| `ownerIds` | `["A013","S022"]` | 当前用户可见负责人 ID，第一阶段与 `managedUserIds` 同步。 |

## 4. 指定用户权限范围接口

```http
GET /api/open/v1/users/{userId}/permission-scope
```

调用规则：

1. client 需要具备 `users` 资源授权。
2. `userId` 可传 CRM 用户 `id` 或 `username`。
3. 只能查询当前 token 绑定 CRM 用户可见范围内的用户；不可见返回 `40401 user not found`。

返回重点字段：

```json
{
  "scopeType": "region",
  "isFullAccess": false,
  "regions": ["山东区"],
  "bigRegions": ["华东大区"],
  "partnerIds": ["P001"],
  "userIds": ["A013", "S022"],
  "managedUserIds": ["A013", "S022"],
  "ownerIds": ["A013", "S022"],
  "departmentIds": [],
  "organizationIds": [],
  "includeChildPartners": false,
  "description": "可查看本区域数据"
}
```

## 5. 角色权限矩阵接口

```http
GET /api/open/v1/meta/role-permissions
```

当前四类角色口径：

| 角色 | 范围 | 裁剪主字段 |
|---|---|---|
| `superadmin` | 全量 | 不按对象归属裁剪。 |
| `admin` | 本区域 | `region == currentUser.region`。 |
| `partner_admin` | 本渠道及下级渠道 | `partnerId/assignedPartnerId/parentPartnerId/parentPartnerIds` 命中当前渠道。 |
| `staff` | 本人 | `createdBy/ownerId/assignedStaffId` 命中当前用户。 |

## 6. 六类对象稳定归属字段

AI-agent 如需使用服务 client 拉明细后做本地二次裁剪，建议依赖以下字段：

| 对象 | 字段 |
|---|---|
| `users` | `id`、`role`、`region`、`bigRegion`、`partnerId`、`departmentId`、`organizationId`、`managedUserIds`、`ownerIds` |
| `partners` | `id`、`ownerId`、`ownerName`、`region`、`bigRegion`、`departmentId`、`organizationId`、`parentPartnerId`、`parentPartnerIds` |
| `registrations` | `id`、`ownerId`、`ownerName`、`assignedStaffId`、`assignedStaffName`、`createdBy`、`createdByName`、`partnerId`、`partnerName`、`region`、`bigRegion`、`departmentId`、`organizationId` |
| `opportunities` | `id`、`ownerId`、`ownerName`、`assignedStaffId`、`assignedStaffName`、`createdBy`、`createdByName`、`partnerId`、`partnerName`、`region`、`bigRegion`、`departmentId`、`organizationId` |
| `quotes` | `id`、`ownerId`、`ownerName`、`assignedStaffId`、`assignedStaffName`、`createdBy`、`createdByName`、`partnerId`、`partnerName`、`region`、`bigRegion`、`departmentId`、`organizationId` |
| `orders` | `id`、`ownerId`、`ownerName`、`assignedStaffId`、`assignedStaffName`、`createdBy`、`createdByName`、`partnerId`、`partnerName`、`region`、`bigRegion`、`departmentId`、`organizationId` |

## 7. 建议 AI-agent 联调验证顺序

1. `POST /auth/token`
2. `GET /auth/me`
3. `GET /meta/permission-scope`
4. `GET /meta/role-permissions`
5. `GET /users?pageNo=1&pageSize=5`
6. `GET /users/{userId}/permission-scope`
7. `GET /identity/users/{userId}`
8. `GET /partners?pageNo=1&pageSize=1`
9. `GET /registrations?pageNo=1&pageSize=1`
10. `GET /opportunities?pageNo=1&pageSize=1`
11. `GET /quotes?pageNo=1&pageSize=1`
12. `GET /orders?pageNo=1&pageSize=1`

## 8. 仍需双方后续确认

| 项 | 当前状态 |
|---|---|
| 企业微信 userid 真实映射 | OpenAPI 字段已预留，需后续导入或维护真实 `wecomUserId`。 |
| 部门/组织真实映射 | OpenAPI 字段已预留，当前无值时返回空。 |
| 可见/不可见样例数据矩阵 | 接口已支持，需在联调环境按四类测试账号实测导出。 |
| 生产 Base URL 和公网访问方式 | 以最终部署/网络策略为准。 |

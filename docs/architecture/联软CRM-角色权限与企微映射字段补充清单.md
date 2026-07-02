# 联软CRM-角色权限与企微映射字段补充清单

> 用途：发给联软渠道 CRM 对接方，确认“企微不同用户使用同一组 OpenAPI client，也能按联软 CRM 角色权限进行智能分析”所需的字段、接口和样例数据。  
> 原则：角色、数据范围和权限口径以联软渠道 CRM 为准，AI-agent 不另建独立 CRM 角色体系，只做身份映射、权限装载、本地二次裁剪、审计和展示。

## 1. 我方目标

当前希望实现以下链路：

```text
企业微信用户发起问数
  -> AI-agent 根据企微 userid / 手机号 / 邮箱匹配联软 CRM 用户
  -> 读取该 CRM 用户的角色、状态、组织、区域、服务商和可见负责人范围
  -> 使用一组联软 OpenAPI 服务 client 拉取标准明细数据
  -> AI-agent 按当前 CRM 用户权限范围做二次裁剪
  -> 只对裁剪后的数据做聚合和 AI 分析
  -> 企业微信 / Web 返回当前角色可见结果
```

如果联软后续支持“用户态 token”或“代入用户 ID 调用”，则可以改成由联软 OpenAPI 直接按真实用户权限裁剪；在此之前，需要联软提供足够完整的用户、角色、权限范围和对象归属字段，供 AI-agent 做本地二次裁剪。

## 2. 需要联软确认的接口

| 优先级 | 接口能力 | 建议路径 | 用途 |
|---|---|---|---|
| P0 | 当前 client 绑定用户 | `GET /api/open/v1/auth/me` | 判断当前 OpenAPI client 是否为超管或服务账号 |
| P0 | 当前 client 权限范围 | `GET /api/open/v1/meta/permission-scope` | 联调诊断和服务账号合法性校验 |
| P0 | 用户列表 | `GET /api/open/v1/users` | 根据企微用户匹配 CRM 用户 |
| P0 | 用户详情 | `GET /api/open/v1/users/{userId}` | 读取单个 CRM 用户角色、状态和权限范围 |
| P0 | 用户权限范围 | `GET /api/open/v1/users/{userId}/permission-scope` | 推荐新增；返回该用户可见区域、服务商、负责人、部门等范围 |
| P0 | 角色字典 | `GET /api/open/v1/meta/dictionaries` 中 `roles` | 角色编码和中文名翻译 |
| P0 | 六类对象列表 | `partners`、`registrations`、`opportunities`、`quotes`、`orders` | 明细取数后本地权限裁剪 |
| P1 | 角色权限矩阵 | `GET /api/open/v1/meta/role-permissions` | 推荐新增；说明不同角色功能权限和数据范围规则 |

## 3. 用户与企微映射字段

请联软在 `users` 列表和详情中稳定返回以下字段。

| 字段 | 必需级别 | 示例 | 用途 |
|---|---|---|---|
| `id` | P0 | `A031` | CRM 用户唯一 ID，作为权限和审计主键 |
| `username` | P0 | `wangxiaohong` | CRM 登录账号，辅助匹配和诊断 |
| `name` | P0 | `王小红` | 展示名称 |
| `status` | P0 | `active` | 禁用、离职、待审批账号需要阻断 |
| `role` | P0 | `region_manager` | 联软 CRM 角色编码 |
| `roleName` | P0 | `区域负责人` | 用户可读角色名 |
| `roleIds` | P1 | `["region_manager"]` | 如一个用户多角色，建议返回数组 |
| `roleNames` | P1 | `["区域负责人"]` | 多角色中文名 |
| `isAdmin` | P0 | `false` | 是否超管 / 全量权限 |
| `wecomUserId` | P0 | `zhangsan` | 企业微信 userid，企微问数优先匹配字段 |
| `mobile` | P1 | `138****0000` | 企微 userid 缺失时可用手机号匹配，返回时可脱敏 |
| `email` | P2 | `user@example.com` | 备用匹配 |
| `departmentId` | P0 | `dept_001` | CRM 部门 ID |
| `departmentName` | P1 | `山东销售部` | 展示和诊断 |
| `departmentIds` | P1 | `["dept_001"]` | 多部门用户建议返回数组 |
| `organizationId` | P1 | `org_001` | CRM 组织 ID |
| `organizationIds` | P1 | `["org_001"]` | 多组织权限 |
| `region` | P0 | `山东区` | 区域权限和区域筛选 |
| `bigRegion` | P1 | `华东大区` | 大区权限和大区分析 |
| `partnerId` | 角色相关 P0 | `P001` | 渠道/服务商账号绑定服务商 |
| `partnerName` | 角色相关 P1 | `山东联软服务商` | 渠道账号展示和诊断 |
| `managedUserIds` | P0 | `["A031","A032"]` | 区域负责人、主管可见员工范围 |
| `ownerIds` | P0 | `["A031","A032"]` | 可见负责人范围，建议与 `managedUserIds` 同步 |

## 4. 用户权限范围接口建议

建议联软新增或确认以下接口：

```text
GET /api/open/v1/users/{userId}/permission-scope
```

建议响应结构：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "user": {
      "id": "A031",
      "name": "王小红",
      "role": "region_manager",
      "roleName": "区域负责人",
      "isAdmin": false,
      "status": "active",
      "wecomUserId": "wangxiaohong"
    },
    "scopeType": "region",
    "isFullAccess": false,
    "regions": ["山东区"],
    "bigRegions": ["华东大区"],
    "organizationIds": ["org_shandong"],
    "departmentIds": ["dept_shandong_sales"],
    "partnerIds": [],
    "includeChildPartners": false,
    "ownerIds": ["A031", "A032"],
    "managedUserIds": ["A031", "A032"],
    "scopeSummary": "区域负责人，仅可查看山东区及下属销售人员数据。"
  },
  "requestId": "req_xxx"
}
```

字段说明：

| 字段 | 必需级别 | 说明 |
|---|---|---|
| `scopeType` | P0 | 建议枚举：`all`、`region`、`department`、`partner`、`owner`、`custom` |
| `isFullAccess` | P0 | 是否全量可见 |
| `regions` | P0 | 可见区域列表 |
| `bigRegions` | P1 | 可见大区列表 |
| `organizationIds` | P1 | 可见组织列表 |
| `departmentIds` | P0 | 可见部门列表 |
| `partnerIds` | P0 | 可见服务商列表 |
| `includeChildPartners` | P1 | 渠道管理员是否包含下级服务商 |
| `ownerIds` | P0 | 可见负责人 ID 列表 |
| `managedUserIds` | P0 | 管辖员工 ID 列表 |
| `scopeSummary` | P1 | 面向用户的权限说明 |

## 5. 六类对象必须补齐的权限裁剪字段

使用一组服务 client 时，AI-agent 必须根据每条对象记录上的归属字段做本地二次裁剪。因此下面字段需要在对象列表接口中稳定返回。

### 5.1 服务商 `partners`

| 字段 | 必需级别 | 用途 |
|---|---|---|
| `id` | P0 | 服务商主键 |
| `name` | P0 | 服务商名称 |
| `region` | P0 | 区域权限裁剪 |
| `bigRegion` | P1 | 大区权限裁剪 |
| `departmentId` | P1 | 部门权限裁剪 |
| `organizationId` | P1 | 组织权限裁剪 |
| `ownerId` | P1 | 服务商负责人权限裁剪 |
| `ownerName` | P1 | 展示 |
| `partnerLevel` | P0 | 等级分析 |
| `partnerLevelName` | P1 | 展示 |
| `isTechnicalServiceProvider` | P0 | 技术服务商维度 |
| `parentPartnerId` | P1 | 上级服务商 |
| `parentPartnerIds` | P1 | 渠道树权限 |
| `createdAt` / `joinDate` | P0 | 加入时间分析 |
| `status` | P0 | 有效服务商统计 |

### 5.2 客户报备 `registrations`

| 字段 | 必需级别 | 用途 |
|---|---|---|
| `id` | P0 | 报备主键 |
| `customer` | P0 | 客户展示 |
| `createdBy` | P0 | 创建人权限 |
| `createdByName` | P1 | 展示 |
| `ownerId` | P1 | 负责人权限 |
| `assignedStaffId` | P0 | 分配员工权限 |
| `assignedStaffName` | P1 | 展示 |
| `partnerId` | P0 | 服务商权限 |
| `partnerName` | P1 | 展示 |
| `region` | P0 | 区域权限 |
| `bigRegion` | P1 | 大区权限 |
| `departmentId` | P1 | 部门权限 |
| `organizationId` | P1 | 组织权限 |
| `status` | P0 | 状态分析 |
| `createdAt` | P0 | 时间筛选 |

### 5.3 商机 `opportunities`

| 字段 | 必需级别 | 用途 |
|---|---|---|
| `id` | P0 | 商机主键 |
| `name` | P0 | 展示 |
| `amount` | P0 | 金额分析 |
| `stage` / `stageName` | P0 | 阶段分析 |
| `status` | P1 | 状态过滤 |
| `createdBy` | P1 | 创建人权限 |
| `ownerId` | P0 | 负责人权限 |
| `ownerName` | P1 | 展示 |
| `assignedStaffId` | P0 | 分配员工权限 |
| `assignedStaffName` | P1 | 展示 |
| `partnerId` | P0 | 服务商权限和贡献分析 |
| `partnerName` | P1 | 展示 |
| `region` | P0 | 区域权限 |
| `bigRegion` | P1 | 大区权限 |
| `departmentId` | P1 | 部门权限 |
| `organizationId` | P1 | 组织权限 |
| `createdAt` | P0 | 时间筛选 |
| `updatedAt` | P1 | 排序和诊断 |

### 5.4 报价 `quotes`

| 字段 | 必需级别 | 用途 |
|---|---|---|
| `id` | P0 | 报价主键 |
| `amount` / `totalAmount` | P0 | 报价金额 |
| `status` | P0 | 报价状态 |
| `oppId` / `oppIds` | P1 | 商机关联 |
| `ownerId` / `assignedStaffId` | P0 | 负责人权限 |
| `ownerName` / `assignedStaffName` | P1 | 展示 |
| `partnerId` | P0 | 服务商权限 |
| `partnerName` | P1 | 展示 |
| `region` | P0 | 区域权限 |
| `bigRegion` | P1 | 大区权限 |
| `departmentId` | P1 | 部门权限 |
| `organizationId` | P1 | 组织权限 |
| `createdAt` | P0 | 时间筛选 |

### 5.5 订单 `orders`

| 字段 | 必需级别 | 用途 |
|---|---|---|
| `id` | P0 | 订单主键 |
| `amount` / `totalAmount` | P0 | 订单金额 |
| `status` | P0 | 订单状态 |
| `oppId` | P1 | 商机关联 |
| `quoteId` | P1 | 报价关联 |
| `ownerId` / `assignedStaffId` | P0 | 负责人权限 |
| `ownerName` / `assignedStaffName` | P1 | 展示 |
| `partnerId` | P0 | 服务商权限 |
| `partnerName` | P1 | 展示 |
| `region` | P0 | 区域权限 |
| `bigRegion` | P1 | 大区权限 |
| `departmentId` | P1 | 部门权限 |
| `organizationId` | P1 | 组织权限 |
| `createdAt` | P0 | 时间筛选 |
| `dealAt` | P1 | 成交时间口径 |

## 6. 角色权限矩阵需要联软确认

请联软提供每类角色的数据范围规则，建议按下表回传。

| 角色编码 | 角色名称 | 是否全量 | 可见区域 | 可见服务商 | 可见负责人 | 是否含下级服务商 | 典型说明 |
|---|---|---|---|---|---|---|---|
| `superadmin` | 超管 | 是 | 全部 | 全部 | 全部 | 是 | 可看全部数据 |
| `region_manager` | 区域负责人 | 否 | 所属区域 | 区域内服务商 | 区域下员工 | 视规则 | 只看本区域数据 |
| `partner_admin` | 渠道管理员 | 否 | 绑定服务商区域 | 绑定服务商 | 服务商相关负责人 | 需确认 | 只看本渠道及授权数据 |
| `sales` | 普通员工 | 否 | 所属区域 | 负责/分配服务商 | 自己 | 否 | 只看自己负责、创建或分配的数据 |
| `disabled` | 禁用账号 | 否 | 无 | 无 | 无 | 否 | 不允许登录或查询 |

重点请确认：

1. 区域负责人是否按 `region`、`bigRegion`、`departmentId` 还是组织树裁剪。
2. 渠道管理员是否可以看下级服务商，以下级链路 `parentPartnerIds` 还是其它字段为准。
3. 普通员工可见数据以 `ownerId`、`assignedStaffId`、`createdBy` 哪个为主，优先级是什么。
4. 多角色用户是否取并集权限，还是按最高角色权限。
5. 离职、禁用、待审批账号是否禁止登录和查询。

## 7. 样例账号和样例数据要求

为了验证不同角色同一问题返回不同结果，请联软提供以下样例。

### 7.1 样例账号

| 角色 | 数量 | 需提供信息 |
|---|---:|---|
| 超管 | 1 个 | CRM 用户 ID、用户名、角色、企微 userid |
| 区域负责人 | 1 个 | 所属区域、下属员工、可见服务商 |
| 渠道管理员 | 1 个 | 绑定服务商、是否含下级服务商 |
| 普通员工 | 1 个 | 自己负责/创建/分配的数据 |
| 禁用账号 | 1 个 | 预期错误码和提示 |

### 7.2 样例数据

每个角色建议至少提供：

| 数据类型 | 可见样例 | 不可见样例 | 用途 |
|---|---:|---:|---|
| 服务商 | 3 条 | 3 条 | 验证服务商画像和渠道权限 |
| 商机 | 3 条 | 3 条 | 验证商机数量、金额和负责人权限 |
| 报备 | 3 条 | 3 条 | 验证报备权限 |
| 报价 | 3 条 | 3 条 | 验证报价权限 |
| 订单 | 3 条 | 3 条 | 验证订单权限 |

建议同时给出以下标准问题的预期结果：

| 测试问题 | 需要联软给出的预期 |
|---|---|
| 最近三个月山东区域有商机的服务商，对应商机数量和商机金额 | 每个角色可见服务商、商机数、金额 |
| 最近一年加入的服务商有多少家，按合作级别和是否技术服务商统计 | 每个角色服务商数量、等级分布、技术服务商数量 |
| 本年度订单金额按服务商排名 | 每个角色可见订单金额和服务商排名 |
| 本月报价转订单情况 | 每个角色报价数、订单数、转化关系 |

## 8. 错误码和安全要求

请联软确认以下错误码或等价返回。

| 场景 | 建议错误码 | 用途 |
|---|---|---|
| token 失效 | `40101` | AI-agent 自动重新获取 token |
| client 无效 | `40112` | 页面提示检查 appKey/appSecret |
| 当前用户不存在 | `40401` | 企微映射失败提示 |
| 当前用户禁用 | `40301` | 阻断问数 |
| 当前用户无权限 | `40302` | 友好提示权限不足 |
| 字段不支持 | `40021` | 提示联软字段未开放 |
| 筛选参数不支持 | `40022` | 降级为本地筛选 |
| 服务异常 | `50000` | 诊断和重试 |

每个响应建议返回 `requestId`，便于双方排查。

## 9. 我方接入后的处理方式

AI-agent 收到以上字段后，会按以下原则处理：

1. 企业微信用户优先用 `wecomUserId` 匹配 CRM 用户；缺失时再考虑手机号或邮箱。
2. 角色、数据范围、是否超管以联软 CRM 返回为准。
3. 一组 OpenAPI 服务 client 只负责取明细，不直接代表当前问数用户权限。
4. 当前用户不是超管时，所有对象明细必须按 `ownerId`、`assignedStaffId`、`createdBy`、`departmentId`、`organizationId`、`region`、`partnerId` 等字段二次裁剪。
5. 二次裁剪后再聚合、生成报告和发送企微。
6. 如果关键权限字段缺失，AI-agent 会保守返回“当前字段不足，无法确认权限范围”，不会用服务账号全量数据直接分析。

## 10. 请联软本次优先回复的内容

请联软优先确认或补充以下 P0 项：

1. `users` 是否能返回 `wecomUserId`、`role`、`roleName`、`isAdmin`、`status`、`ownerIds/managedUserIds`、`region`、`departmentId`、`partnerId`。
2. 是否能提供 `GET /users/{userId}/permission-scope`，或在用户详情中直接返回同等权限范围。
3. 六类对象列表是否能稳定返回 `ownerId`、`assignedStaffId`、`createdBy`、`partnerId`、`region`、`departmentId`、`organizationId`。
4. 渠道管理员是否包含下级服务商，以下级链路哪个字段为准。
5. 四类角色测试账号及每类可见 / 不可见样例数据。
6. 同一测试问题在不同角色下的预期数量、金额和服务商列表。

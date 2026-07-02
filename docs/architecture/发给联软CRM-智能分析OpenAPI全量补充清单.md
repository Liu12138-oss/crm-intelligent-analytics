# 发给联软 CRM：智能分析 OpenAPI 全量补充清单

## 1. 背景与目标

本文用于联软渠道 CRM 与我方 CRM 智能分析系统继续联调。当前我方已经接入联软标准 OpenAPI，并可基于当前 token 权限查询用户、服务商、客户报备、商机、报价、订单等对象。

下一阶段目标是支持更完整的自然语言智能分析，例如：

- “有多少客户没有报备商机，分别创建了多长时间？”
- “最近一年加入的服务商有多少家，按合作等级、等级、是否技术服务商维度分析。”
- “广州办渠道下单汇总分析，输出报告、表格和分布图。”
- “按当前企微用户对应的联软 CRM 角色权限，查询当前可见范围内所有经营数据。”

为避免我方根据字段名猜测、反推或编造数据口径，请联软侧按本文补齐标准接口、字段、权限说明和样例数据。

## 2. 接入原则

- 联软侧继续按当前标准 OpenAPI 提供只读数据与统计能力。
- 所有接口结果必须已经按当前 `accessToken` 绑定用户的真实联软 CRM 角色权限裁剪。
- 我方不会绕过联软权限直接操作数据库，也不会把 AI 生成的任意 SQL 发给联软执行。
- AI 只负责理解用户问题和生成受控查询计划，最终执行必须落在联软已声明的 OpenAPI 资源、字段和统计接口内。
- 所有字段枚举值请尽量同时返回编码和中文名称，避免企微端展示 `registered`、`ACTIVE` 等内部值。

## 3. P0 必须补齐接口

| 接口 | 用途 | 当前缺口影响 | 优先级 |
| --- | --- | --- | --- |
| `GET /customers` | 客户主数据列表 | 无法分析“从未报备商机的客户”“客户创建时长”“客户生命周期” | P0 |
| `GET /customers/{id}` | 客户详情 | 无法在企微追问某个客户详情、负责人、归属 | P0 |
| `GET /auth/me` | 当前 client 和绑定用户 | 用于诊断当前 token 对应哪个联软用户 | P0 |
| `GET /auth/permission-scope` | 当前 token 权限范围 | 用于展示当前角色能看哪些区域、服务商、负责人 | P0 |
| `GET /meta/dictionaries` | 字典与枚举 | 用于把状态、阶段、等级翻译成中文 | P0 |
| `GET /registrations` | 客户报备列表 | 已接入，需补稳定关联键 | P0 |
| `GET /opportunities` | 商机列表 | 已接入，需补稳定关联键和金额口径 | P0 |
| `GET /quotes` | 报价列表 | 已接入，需补稳定关联键和金额口径 | P0 |
| `GET /orders` | 订单列表 | 已接入，需补稳定关联键和成交口径 | P0 |
| `GET /partners` | 服务商列表 | 已接入，需持续补齐等级、技术服务商、区域归属 | P0 |
| `GET /users` | 用户列表 | 已接入，需补企业微信映射和角色中文名 | P0 |

## 4. P0 客户主数据字段

`GET /customers` 至少需要返回以下字段：

| 字段 | 中文含义 | 用途 | 必要性 |
| --- | --- | --- | --- |
| `id` | 客户 ID | 跨对象关联主键 | 必须 |
| `name` | 客户名称 | 展示、搜索、去重辅助 | 必须 |
| `createdAt` | 客户创建时间 | 计算客户创建时长、沉睡周期 | 必须 |
| `updatedAt` | 客户更新时间 | 判断客户活跃度 | 建议 |
| `status` | 客户状态编码 | 有效、无效、停用等筛选 | 必须 |
| `statusName` | 客户状态名称 | 中文展示 | 建议 |
| `region` | 区域 | 区域筛选和分组 | 必须 |
| `bigRegion` | 大区 | 大区筛选和分组 | 建议 |
| `ownerId` | 负责人 ID | 负责人权限和排行 | 必须 |
| `ownerName` | 负责人姓名 | 企微展示 | 建议 |
| `assignedStaffId` | 分配员工 ID | 与报备、商机口径对齐 | 建议 |
| `assignedStaffName` | 分配员工姓名 | 企微展示 | 建议 |
| `partnerId` | 关联服务商 ID | 服务商维度分析 | 必须 |
| `partnerName` | 关联服务商名称 | 企微展示 | 建议 |
| `departmentId` | 部门 ID | 部门权限和组织口径 | 建议 |
| `departmentName` | 部门名称 | 企微展示 | 建议 |
| `source` | 客户来源 | 来源分析 | 可选 |
| `category` | 客户分类编码 | 客户分层分析 | 可选 |
| `categoryName` | 客户分类名称 | 中文展示 | 可选 |

## 5. P0 跨对象稳定关联键

为支持“客户是否有报备、是否有商机、是否报价、是否下单”等反关联分析，请确保以下对象都返回稳定关联键。

| 对象 | 必须字段 | 说明 |
| --- | --- | --- |
| `customers` | `id` | 客户主键 |
| `registrations` | `customerId`、`customer` | `customerId` 必须可关联 `customers.id` |
| `opportunities` | `customerId`、`regId`、`customer` | `customerId` 优先，`regId` 用于报备转商机 |
| `quotes` | `customerId`、`oppId`、`customerName` | 用于客户报价链路 |
| `orders` | `customerId`、`quoteId`、`customerName` | 用于客户成交链路 |

如果短期无法提供 `customerId`，请提供联软侧确认的客户去重匹配规则，例如“统一社会信用代码优先，其次客户标准化名称”，并明确：

- 字段来源。
- 去重优先级。
- 同名客户如何处理。
- 历史脏数据是否已清洗。
- 匹配失败时应返回什么标识。

## 6. P0 反关联与生命周期分析能力

我方需要支持以下问题。若联软侧不提供统计接口，我方可以分页拉取当前权限内的标准对象后在内存中做只读聚合；但前提是必须有客户主数据和稳定关联键。

| 分析能力 | 所需数据 | 期望输出 |
| --- | --- | --- |
| 未报备商机客户 | `customers.id`、`customers.createdAt`、`registrations.customerId`、`opportunities.customerId` | 客户数、客户明细、创建时长分桶 |
| 未建商机客户 | `customers.id`、`opportunities.customerId` | 客户数、按负责人/区域/服务商分布 |
| 未报价商机 | `opportunities.id`、`quotes.oppId` | 商机数、金额、阶段分布 |
| 未下单报价 | `quotes.id`、`orders.quoteId` | 报价数、金额、报价时长 |
| 客户沉睡分析 | `customers.updatedAt`、最近报备/商机/报价/订单时间 | 沉睡客户数、沉睡周期、负责人 |
| 客户创建时长 | `customers.createdAt` | 0-30 天、31-90 天、91-180 天、180 天以上 |

## 7. P1 建议补充统计接口

为减少分页拉取和提升企微问数响应速度，建议联软侧提供以下统计接口。统计结果仍必须按当前 token 权限裁剪。

| 接口 | 用途 |
| --- | --- |
| `GET /analytics/customers/lifecycle` | 客户生命周期总览 |
| `GET /analytics/customers/unregistered-opportunity` | 未报备/未建商机客户统计 |
| `GET /analytics/customers/idle` | 沉睡客户统计 |
| `GET /analytics/partners/contribution` | 服务商报备、商机、报价、订单贡献 |
| `GET /analytics/partners/profile` | 服务商画像、等级、技术服务商分布 |
| `GET /analytics/funnel` | 报备到商机、报价、订单转化漏斗 |
| `GET /analytics/regions/contribution` | 区域/大区经营贡献 |
| `GET /analytics/owners/contribution` | 负责人经营贡献 |

## 8. 分页、筛选、排序和总数要求

所有列表接口建议统一支持：

- `pageNo`：页码，从 1 开始。
- `pageSize`：每页数量，建议最大 200。
- `keyword`：名称或关键字搜索。
- `status`：状态筛选。
- `region`：区域筛选。
- `bigRegion`：大区筛选。
- `partnerId`：服务商筛选。
- `ownerId`：负责人筛选。
- `createdAfter` / `createdBefore`：创建时间筛选。
- `updatedAfter` / `updatedBefore`：更新时间筛选。
- `sortBy` / `sortOrder`：排序字段和方向。
- `total`：必须返回当前权限和筛选条件下的总数。

所有时间字段请使用 ISO 8601 格式，并明确时区；建议使用 `Asia/Shanghai`。

## 9. 权限与角色口径

请联软侧确认并提供以下说明：

- 超管角色是否能访问全部区域、服务商、负责人和客户。
- 区域经理能访问哪些区域或大区。
- 服务商账号是否只能访问本服务商及下级服务商。
- 销售账号是否只能访问本人负责客户和商机。
- 绑定一组 client 时，是否支持我方按企业微信用户映射到联软真实用户后，再按真实用户角色权限查询。
- 如果标准 OpenAPI token 仍只代表固定绑定用户，请提供“按用户身份查询权限范围”的方案，例如 `X-CRM-User-Id` 受控透传或身份查询 API。

## 10. 企业微信用户映射字段

为了让不同企微用户使用同一企微机器人时按联软 CRM 角色权限查询，请补齐：

| 字段 | 对象 | 说明 |
| --- | --- | --- |
| `wecomUserId` | `users` | 企业微信用户 ID |
| `username` | `users` | 联软登录账号 |
| `id` | `users` | 联软用户 ID |
| `role` | `users` | 角色编码 |
| `roleName` | `users` | 角色中文名 |
| `departmentId` | `users` | 部门 ID |
| `departmentName` | `users` | 部门中文名 |
| `region` | `users` | 所属区域 |
| `bigRegion` | `users` | 所属大区 |
| `partnerId` | `users` | 绑定服务商 |

## 11. 字典与中文展示

`GET /meta/dictionaries` 建议至少返回：

- `roles`：角色编码与中文名。
- `regions`：区域编码与中文名。
- `bigRegions`：大区编码与中文名。
- `partnerLevels`：合作等级。
- `technicalServiceProviderTypes`：技术服务商类型。
- `customerStatuses`：客户状态。
- `customerCategories`：客户分类。
- `registrationStatuses`：报备状态。
- `opportunityStages`：商机阶段。
- `quoteStatuses`：报价状态。
- `orderStatuses`：订单状态。

## 12. 错误码和响应样例要求

请提供以下响应样例：

- token 获取成功。
- token 过期。
- client 无效。
- client 未授权资源。
- IP 未在白名单。
- 当前用户无权限。
- 参数错误。
- 查询成功但无数据。
- 分页查询成功且包含 `total`。

错误响应请包含：

- `code`：稳定错误码。
- `message`：中文错误说明。
- `requestId`：排障请求 ID。

## 13. 样例数据要求

请至少提供以下样例，且样例之间能通过主键真实关联：

- 1 个超管用户。
- 1 个区域经理用户。
- 1 个服务商用户。
- 1 个普通销售用户。
- 10 个客户，其中至少包含未报备、已报备未建商机、已建商机未报价、已报价未下单、已下单五类。
- 5 个服务商，覆盖不同合作等级和是否技术服务商。
- 10 条报备。
- 10 条商机。
- 5 条报价。
- 5 条订单。

## 14. 联软侧自测问题

请联软侧在交付前用标准 OpenAPI 自测以下问题所需数据是否可得：

- 当前超管 token 下，客户总数是否能返回。
- 当前超管 token 下，没有报备商机的客户数量是否可计算。
- 当前超管 token 下，没有报备商机的客户创建时长是否可计算。
- 当前区域经理 token 下，是否只返回该区域客户、服务商、商机、报价、订单。
- 当前服务商 token 下，是否只返回该服务商及其授权下级的数据。
- 当前销售 token 下，是否只返回本人负责或被授权的数据。
- 同一客户在客户、报备、商机、报价、订单中是否能通过稳定主键串起来。

## 15. 我方接收标准

我方认为联软侧交付满足下一阶段联调条件，需要同时满足：

- `GET /customers` 可用，并返回客户 ID、客户名称、创建时间、负责人、区域、服务商关联字段。
- 报备、商机、报价、订单至少有一种稳定客户关联键。
- 所有列表接口返回 `total`。
- 字典接口能返回核心枚举中文名。
- 权限接口能说明当前 token 对应用户和权限范围。
- 超管、区域、服务商、销售四类账号样例均可验证权限差异。
- 对“未报备商机客户”和“客户创建时长”类问题，不再需要我方猜测字段或依赖客户名称模糊匹配。

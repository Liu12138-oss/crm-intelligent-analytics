# 发给 crm-agent：四类角色权限回归期望结果与截图口径

> 日期：2026-06-10  
> 环境：SIT / 联调环境  
> Base URL：`http://10.18.16.114:3000/api/open/v1`  
> 用途：提供超管、区管、渠道账号、销售员工四类角色的权限回归口径、当前期望数量和截图取证要求。  
> 安全说明：本文不包含 `appSecret`、accessToken、数据库密码。截图时请遮挡 `Authorization`、`accessToken`、`appSecret`。

---

## 1. 结论

本轮建议给 AI-agent 的回归材料分为两类：

| 类型 | 说明 | 是否固定 |
|---|---|---|
| 权限口径 | 四类角色的 `scopeType / regions / bigRegions / partnerIds / userIds` 和对象过滤规则。 | 固定，除非 CRM 权限模型调整。 |
| 当前期望结果 | 基于当前 SIT 库在 `2026-06-10 09:39:30 CST` 生成的对象可见数量和样例 ID。 | 非永久固定，数据变化后需重新跑数。 |

对方做回归时，判断优先级如下：

1. 必须满足权限口径，不允许越权。
2. 同一数据快照下，数量应与本文当前期望结果一致。
3. 若 SIT 数据发生新增、删除、审批、归属调整，以重新导出的最新 JSON 结果为准。

---

## 2. 四类角色基准账号

| 角色 | clientName | CRM 用户 | 用户 ID | scopeType | 基准口径 |
|---|---|---|---|---|---|
| 超管 | `AI-agent-superadmin-sit` | `liulonghai / 刘龙海` | `A030` | `all` | 全量可见。 |
| 区管 | `AI-agent-admin-sit` | `admin_sd / 山东区管理员` | `A013` | `region` | 仅可见 `山东区 / 大北区` 范围数据。 |
| 渠道账号 | `AI-agent-partner-admin-sit` | `liangcui / 梁翠` | `PA001` | `partner` | 仅可见 `P001 / 山东诚卓信息技术有限公司` 及下级渠道链路数据。 |
| 销售员工 | `AI-agent-staff-sit` | `shangxichao / 商希超` | `S022` | `user` | 仅可见本人创建、负责或分配的数据。 |

---

## 3. 当前期望数量矩阵

生成方式：只读读取当前 `backend/crm.db`，按 OpenAPI 权限裁剪规则计算，不改业务数据、不改 client。

| 角色 | 用户 | users | partners | customers | registrations | opportunities | quotes | orders |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 超管 | `liulonghai` | 61 | 174 | 178 | 150 | 44 | 17 | 2 |
| 区管 | `admin_sd` | 46 | 32 | 178 | 150 | 44 | 17 | 2 |
| 渠道账号 | `liangcui` | 9 | 1 | 83 | 81 | 15 | 16 | 1 |
| 销售员工 | `shangxichao` | 1 | 1 | 7 | 4 | 3 | 0 | 0 |

说明：

1. 当前 SIT 业务样例大部分集中在 `山东区`，所以区管在客户、报备、商机、报价、订单上的数量接近超管，这是当前样例数据特点，不代表区管全量权限。
2. 区管查询报价、订单时，使用标准化后的 `region / bigRegion`，订单和报价可从关联商机、报价、渠道、负责人继承区域。
3. 渠道账号按 `partnerId / assignedPartnerId / parentPartnerId / parentPartnerIds` 判断渠道链路。
4. 销售员工按 `createdBy / ownerId / assignedStaffId` 判断本人相关数据。

---

## 4. 权限快照期望

### 4.1 超管 `liulonghai`

| 字段 | 期望 |
|---|---|
| `scopeType` | `all` |
| `isFullAccess` | `true` |
| `regions` | `[]`，空数组表示全量 |
| `bigRegions` | `[]`，空数组表示全量 |
| `partnerIds` | 全部服务商 ID，当前 174 个 |
| `userIds` | 全部用户 ID，当前 61 个 |
| 核心断言 | 任意对象列表均不按区域、渠道、负责人裁剪。 |

### 4.2 区管 `admin_sd`

| 字段 | 期望 |
|---|---|
| `scopeType` | `region` |
| `isFullAccess` | `false` |
| `regions` | `["山东区"]` |
| `bigRegions` | `["大北区"]` |
| `partnerIds` | 当前山东区可见服务商，当前 32 个 |
| `userIds` | 当前山东区及空区域用户，当前 46 个 |
| 核心断言 | 不允许看到非山东区服务商；业务对象按标准化 `region=山东区` 裁剪。 |

### 4.3 渠道账号 `liangcui`

| 字段 | 期望 |
|---|---|
| `scopeType` | `partner` |
| `isFullAccess` | `false` |
| `regions` | `["山东区"]` |
| `bigRegions` | `["大北区"]` |
| `partnerIds` | `["P001"]` |
| `userIds` | `P001` 渠道下用户，当前 9 个 |
| 核心断言 | 仅允许 `P001` 及其下级渠道链路内数据，不允许看 `P002` 员工个人数据。 |

### 4.4 销售员工 `shangxichao`

| 字段 | 期望 |
|---|---|
| `scopeType` | `user` |
| `isFullAccess` | `false` |
| `regions` | `["山东区"]` |
| `bigRegions` | `["大北区"]` |
| `partnerIds` | `["P002"]` |
| `userIds` | `["S022"]` |
| 核心断言 | 仅允许本人 `S022` 创建、负责或分配的数据；当前报价和订单期望为 0。 |

---

## 5. 可见样例 ID

### 5.1 超管

| 对象 | 可见样例 ID |
|---|---|
| users | `A001`, `A002`, `A003` |
| partners | `P001`, `P002`, `P003` |
| customers | `91371600706390568b`, `91370000163045062f`, `91370000164102287b` |
| registrations | `REG-1777425518310-1`, `REG-1777425518310-2`, `REG-1777425518310-3` |
| opportunities | `OPP-1778134298304-1`, `OPP-1778134298304-2`, `OPP-1778134298304-3` |
| quotes | `QT-1779870200797`, `QT-1779871010532`, `QT-1779947285796` |
| orders | `ORD-1779871019160`, `ORD-1779947494707` |

### 5.2 区管

| 对象 | 可见样例 ID |
|---|---|
| users | `A001`, `A013`, `A016` |
| partners | `P001`, `P002`, `P003` |
| customers | `91371600706390568b`, `91370000163045062f`, `91370000164102287b` |
| registrations | `REG-1777425518310-1`, `REG-1777425518310-2`, `REG-1777425518310-3` |
| opportunities | `OPP-1778134298304-1`, `OPP-1778134298304-2`, `OPP-1778134298304-3` |
| quotes | `QT-1779870200797`, `QT-1779871010532`, `QT-1779947285796` |
| orders | `ORD-1779871019160`, `ORD-1779947494707` |

### 5.3 渠道账号

| 对象 | 可见样例 ID |
|---|---|
| users | `S003`, `S004`, `S005` |
| partners | `P001` |
| customers | `91371600706390568b`, `91370000163045062f`, `91370000164102287b` |
| registrations | `REG-1777425518310-1`, `REG-1777425518310-2`, `REG-1777425518310-3` |
| opportunities | `OPP-1778134298304-1`, `OPP-1778134298304-2`, `OPP-1778134298304-3` |
| quotes | `QT-1779871010532`, `QT-1779947285796`, `QT-1779948086577` |
| orders | `ORD-1779871019160` |

### 5.4 销售员工

| 对象 | 可见样例 ID |
|---|---|
| users | `S022` |
| partners | `P002` |
| customers | `913706007409860229`, `91371081553351288b`, `91370600766652758l` |
| registrations | `REG-1778134844577-1`, `REG-1778134844577-2`, `REG-1778134844577-3` |
| opportunities | `OPP-1778134857787-1`, `OPP-1778134857787-2`, `OPP-1778134857787-5` |
| quotes | 无，期望列表为空 |
| orders | 无，期望列表为空 |

---

## 6. 越权回归用例

| 测试角色 | 请求 | 期望 |
|---|---|---|
| 区管 `admin_sd` | `GET /partners/P088` | 若 `P088` 为非山东区服务商，应返回 `404 / not found` 或不出现在列表中。 |
| 渠道账号 `liangcui` | `GET /partners/P002` | `P002` 非 `P001` 渠道链路，应返回 `404 / not found` 或不出现在列表中。 |
| 渠道账号 `liangcui` | `GET /users/S022` | `S022` 属于 `P002`，应返回 `404 / not found` 或不出现在列表中。 |
| 销售员工 `shangxichao` | `GET /quotes/QT-1779871010532` | 当前员工报价可见数为 0，应返回 `404 / not found`。 |
| 销售员工 `shangxichao` | `GET /orders/ORD-1779871019160` | 当前员工订单可见数为 0，应返回 `404 / not found`。 |
| 销售员工 `shangxichao` | `GET /users/A030` | 员工不能查看超管用户详情，应返回 `404 / not found`。 |

说明：

1. 详情接口对无权限数据按不可见处理，建议对方按 `404 / not found` 做回归断言。
2. 列表接口不能出现越权 ID。
3. 统计接口不能把越权数据计入数量或金额。

---

## 7. 截图取证口径

每类角色建议至少保留 5 张截图。截图可来自 Apifox、Postman、curl 控制台、AI-agent 平台调试台，要求能看到请求路径、绑定用户、关键响应字段和返回数量。

### 7.1 每个角色必截

| 截图编号 | 请求 | 截图重点 | 不应出现 |
|---|---|---|---|
| S1 | `GET /auth/me` | `user.id / username / role / region / partnerId` | accessToken、Authorization |
| S2 | `GET /meta/permission-scope` | `scopeType / regions / bigRegions / partnerIds / userIds` | appSecret |
| S3 | `GET /users?pageNo=1&pageSize=3` | `pagination.total` 和前 3 条 ID | 手机号明文如非必要应遮挡 |
| S4 | `GET /partners?pageNo=1&pageSize=3` | `pagination.total` 和前 3 条 ID | 联系电话明文如非必要应遮挡 |
| S5 | `GET /registrations?pageNo=1&pageSize=3` | `pagination.total`、客户、区域、负责人 | 手机、信用代码明文建议遮挡 |
| S6 | `GET /opportunities?pageNo=1&pageSize=3` | `pagination.total`、阶段、金额、区域 | 无 |
| S7 | `GET /quotes?pageNo=1&pageSize=3` | `pagination.total`、`region / bigRegion` | 无 |
| S8 | `GET /orders?pageNo=1&pageSize=3` | `pagination.total`、`region / bigRegion` | 无 |
| S9 | 一个可见详情接口 | 返回 `code=0` 和对象 ID | 敏感字段明文 |
| S10 | 一个越权详情接口 | 返回 `404 / not found` | 不应返回对象详情 |

### 7.2 角色对应截图断言

| 角色 | 截图核心断言 |
|---|---|
| 超管 | `scopeType=all`，列表数量等于全量基准。 |
| 区管 | `scopeType=region`，`regions=["山东区"]`，服务商数量小于超管，业务对象区域均为山东区或由关联对象继承为山东区。 |
| 渠道账号 | `scopeType=partner`，`partnerIds` 包含 `P001`，服务商列表仅 `P001`，业务对象不出现 `P002` 越权数据。 |
| 销售员工 | `scopeType=user`，`userIds=["S022"]`，users 仅 1 条，quotes/orders 为 0。 |

---

## 8. 对方自动化回归建议

建议 AI-agent 将以下断言写入自动化：

```text
1. 四类角色均能成功调用 /auth/me 和 /meta/permission-scope。
2. scopeType 分别为 all / region / partner / user。
3. 区管 regions 必须只包含山东区。
4. 渠道账号 partnerIds 必须只包含 P001 或 P001 渠道链路。
5. 员工 userIds 必须只包含 S022。
6. 同一数据快照下，各对象 pagination.total 与本文矩阵一致。
7. 越权详情接口必须返回 404，不允许返回对象内容。
8. 报价、订单列表中的 region / bigRegion 必须有标准化输出，区管统计不能漏数。
```

---

## 9. 我方生成脚本

本次期望矩阵由以下只读脚本生成：

```bash
node scripts/generate-openapi-role-regression.js
```

输出文件：

```text
docs/openapi-role-regression/role-regression-expected-20260610.json
```

如果 SIT 数据变化，重新执行脚本并同步本文第 3、5、6 节即可。


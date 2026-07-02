# 联软CRM-第一阶段联调验证记录

## 1. 文档目的

本文档用于沉淀 2026-06-04 对联软 CRM 第一阶段标准 OpenAPI 的实际联调结果，重点覆盖：

1. 标准 OpenAPI 连通性
2. 四类角色权限视角验证
3. 六类对象列表与详情验证
4. 字典与权限矩阵一致性验证

本文档可作为第一阶段“已联通、可继续推进第二阶段真实登录”的内部记录。

---

## 2. 验证环境

| 项目 | 值 | 说明 |
|---|---|---|
| 验证日期 | `2026-06-04` | 本次记录形成时间 |
| CRM 标准 OpenAPI Base URL | `http://10.18.16.114:3000/api/open/v1` | 对方提供的第一阶段联调地址 |
| 我方后端本地端口 | `3001` | 用于治理诊断与运行态校验 |
| 验证方式 | 直连 OpenAPI + 本地运行态检查 | 双路径交叉验证 |

---

## 3. 验证范围

本次实际验证覆盖以下接口：

1. `POST /auth/token`
2. `GET /auth/me`
3. `GET /meta/permission-scope`
4. `GET /meta/dictionaries`
5. 六类对象列表：
   - `GET /users`
   - `GET /partners`
   - `GET /registrations`
   - `GET /opportunities`
   - `GET /quotes`
   - `GET /orders`
6. 六类对象详情样例验证：
   - `GET /users/{id}`
   - `GET /partners/{id}`
   - `GET /registrations/{id}`
   - `GET /opportunities/{id}`
   - `GET /quotes/{id}`
   - `GET /orders/{id}`

---

## 4. 角色权限视角验证结果

本次实际验证了 4 组联调 client，对应 4 类权限视角：

| 角色视角 | 绑定用户ID | 实测绑定用户ID | scopeType | 关键范围 | 结论 |
|---|---|---|---|---|---|
| `superadmin` | `A030` | `A030` | `all` | 全量范围 | 通过 |
| `admin` | `A013` | `A013` | `region` | `regions=["山东区"]` | 通过 |
| `partner_admin` | `PA001` | `PA001` | `partner` | `partnerIds=["P001"]` | 通过 |
| `staff` | `S022` | `S022` | `user` | `partnerIds=["P002"]`、`userIds=["S022"]` | 通过 |

说明：

1. `auth/token` 返回的绑定用户与 `auth/me` 返回的当前用户一致。
2. `meta/permission-scope` 返回结果与对方提供的角色口径一致。
3. 当前 4 组 client 的权限范围可稳定区分全量、区域、渠道、个人四种视角。

---

## 5. 六类对象实测可见总量

以下数据为 2026-06-04 当次实测结果，仅代表当时联调库快照：

| 角色视角 | users | partners | registrations | opportunities | quotes | orders |
|---|---:|---:|---:|---:|---:|---:|
| `superadmin` | 61 | 174 | 150 | 44 | 17 | 2 |
| `admin` | 46 | 32 | 150 | 44 | 17 | 2 |
| `partner_admin` | 9 | 1 | 81 | 15 | 16 | 1 |
| `staff` | 1 | 1 | 4 | 3 | 0 | 0 |

观察结论：

1. 区域管理员在 `users/partners` 上已体现明显区域裁剪。
2. 渠道管理员在 `partners/orders` 上已体现明显渠道裁剪。
3. 员工账号已收敛到个人视角，`quotes/orders` 当前为 `0`，符合样例矩阵预期。
4. `registrations/opportunities` 在区域级仍保持较高可见量，说明当前数据主要集中在同一区域样例内。

---

## 6. 字典与元数据验证结果

4 组角色视角下，`GET /meta/dictionaries` 返回的核心字典键一致，至少包含：

1. `roles`
2. `partnerLevels`
3. `registrationStatuses`
4. `opportunityStages`
5. `quoteStatuses`
6. `orderStatuses`
7. `userStatuses`
8. `partnerStatuses`
9. `timeFields`

结论：

1. 第一阶段问数适配所需的主要角色、状态、阶段类字典已具备。
2. 当前无明显“某个角色拿不到字典”的权限异常。

---

## 7. 权限矩阵验证结果

本次按对方提供的关键样例矩阵，对 4 类角色 x 17 条关键样例做了详情可见性校验。

实测结论：

```text
ALL_MATCH
```

含义：

1. 所有关键样例的“应可见 / 应不可见”结果，与对方提供的权限矩阵一致。
2. 当前第一阶段标准 OpenAPI 的权限边界，没有发现与文档口径相反的样例。

重点已验证样例包括：

1. `users`：`A030`、`PA001`、`S022`、`S025-001`
2. `partners`：`P001`、`P002`、`P088`
3. `registrations`：`REG-1777427902052-0`、`REG-1778134844577-1`、`REG-1777425518311-48`
4. `opportunities`：`OPP-1778134298304-10`、`OPP-1778134857787-1`、`OPP-1778134319471-0`
5. `quotes`：`QT-1779871010532`、`QT-1779870200797`
6. `orders`：`ORD-1779871019160`、`ORD-1779947494707`

---

## 8. 我方运行态校验结果

本地加载环境变量后，执行：

```powershell
. .\scripts\load-local-runtime-env.ps1 | Out-Null
pnpm --dir backend verify:runtime
```

关键结果如下：

| 项目 | 结果 |
|---|---|
| `standardApiConfigured` | `true` |
| `standardApiBaseUrlPresent` | `true` |
| `standardApiConnected` | `true` |
| `standardApiBoundUserId` | `A030` |
| `standardApiScopeType` | `all` |

结论：

1. 我方本地运行态可稳定连接第一阶段标准 OpenAPI。
2. 当前后端标准 OpenAPI 配置已生效。

---

## 9. 第一阶段结论

截至 2026-06-04，本项目对联软 CRM 第一阶段标准 OpenAPI 的联调结论为：

1. 标准 OpenAPI 已连通。
2. 4 组角色视角已跑通。
3. 六类对象列表与关键详情样例已验证通过。
4. 字典返回完整度满足第一阶段接入要求。
5. 权限矩阵实测结果与对方文档一致。

综合判断：

```text
第一阶段可判定为通过，可继续进入第二阶段真实登录联调准备。
```

---

## 10. 进入第二阶段前的建议动作

建议按以下顺序继续推进：

1. 维持第一阶段标准 OpenAPI 配置不动，作为只读联调稳定基线。
2. 单独补齐第二阶段真实登录参数，不与第一阶段配置混用。
3. 先在我方本地以 mock 或 SIT 方式验证真实登录链路。
4. 等 `user_id` 身份落位方式最终确认后，再灰度切换真实登录。

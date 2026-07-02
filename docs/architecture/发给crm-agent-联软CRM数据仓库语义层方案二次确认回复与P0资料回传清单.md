# 发给 crm-agent：联软 CRM 数据仓库语义层方案二次确认回复与 P0 资料回传清单

> 日期：2026-06-09  
> 对应贵方文档：《发给联软CRM-数据仓库语义层方案我方确认回复》  
> 用途：回复 AI-agent 已确认事项，并回传联软 CRM 当前可确认的 P0/P1 资料、MVP 业务口径和待实测清单。  
> 说明：本文不包含明文 `appSecret`、Token、数据库密码、机器人 Secret 或生产库连接信息。

---

## 1. 我方收到后的总体结论

已收到贵方确认回复。联软 CRM 侧确认双方架构方向一致：

```text
联软 CRM 标准 OpenAPI
  -> AI-agent 同步
  -> AI-agent 分析库 / 数仓
  -> 标准模型
  -> 语义层
  -> AI 查询计划
  -> 受控 SQL
  -> 企微 / Web 分析报告
```

联软 CRM 侧继续确认：

1. 第一阶段以联软 CRM 标准 OpenAPI 作为优先数据同步源和权限来源。
2. 不要求 AI-agent 直接连接联软生产业务库。
3. 不建议 AI-agent 直接读取生产运行中的 SQLite 文件。
4. Text-to-SQL 仅面向 AI-agent 分析库或只读语义视图层执行。
5. SQL 安全校验、字段白名单、权限注入、脱敏、超时、LIMIT 和审计由 AI-agent 侧执行链承接。
6. 联软 CRM 侧负责提供可信数据源、字段字典、指标口径、权限口径、样例数据和业务确认。

---

## 2. OpenAPI 同步参数与分页规则

### 2.1 Base URL

```text
http://10.18.16.114:3000/api/open/v1
```

### 2.2 鉴权

```http
POST /auth/token
Authorization: Bearer {accessToken}
```

Token 默认有效期：

```text
7200 秒
```

后端重启后，旧 token 需要重新获取。

### 2.3 推荐同步顺序

建议 AI-agent 按以下顺序同步：

1. `GET /meta/dictionaries`
2. `GET /meta/role-permissions`
3. `GET /users`
4. `GET /partners`
5. `GET /customers`
6. `GET /registrations`
7. `GET /opportunities`
8. `GET /quotes`
9. `GET /orders`
10. `GET /meta/permission-scope`

说明：

1. 字典和角色权限建议先同步，便于后续数据入仓时做中文翻译和权限桥表。
2. 客户 `customers` 是只读客户视图，由报备、商机、报价、订单归并生成。
3. 权限接口按当前 token 绑定用户返回，建议四组 client 分别同步权限快照。

### 2.4 通用分页参数

| 参数 | 类型 | 默认 | 最大值 | 说明 |
|---|---|---:|---:|---|
| `pageNo` | int | `1` | - | 页码，从 1 开始 |
| `pageSize` | int | `20` | `200` | 每页数量 |

响应包含：

```json
{
  "pageNo": 1,
  "pageSize": 200,
  "total": 150
}
```

### 2.5 通用增量过滤参数

列表接口建议使用以下参数做增量同步：

| 参数 | 说明 |
|---|---|
| `createdAfter` | 创建时间起，ISO 8601 字符串 |
| `createdBefore` | 创建时间止，ISO 8601 字符串 |
| `updatedAfter` | 更新时间起，ISO 8601 字符串 |
| `updatedBefore` | 更新时间止，ISO 8601 字符串 |
| `sortBy` | 排序字段，建议 `updatedAt` |
| `sortOrder` | `asc` 或 `desc`，增量同步建议 `asc` |

推荐增量拉取示例：

```http
GET /opportunities?pageNo=1&pageSize=200&updatedAfter=2026-06-09T00:00:00.000Z&sortBy=updatedAt&sortOrder=asc
```

### 2.6 各对象同步建议

| 对象 | 接口 | 增量字段 | 稳定排序建议 | 删除口径 |
|---|---|---|---|---|
| 用户 | `GET /users` | `updatedAt`，无值时可用全量刷新 | `updatedAt asc, id asc` | 第一阶段按 `status` 判断启停 |
| 渠道/服务商 | `GET /partners` | `updatedAt`，无值时可用全量刷新 | `updatedAt asc, id asc` | 第一阶段按 `status` 判断启停 |
| 客户 | `GET /customers` | `updatedAt`、`latestActivityAt` | `updatedAt asc, id asc` | 客户视图暂不提供物理删除，按生命周期状态判断 |
| 报备 | `GET /registrations` | `updatedAt`、`createdAt` | `updatedAt asc, id asc` | 当前以状态为准，物理删除不建议作为同步口径 |
| 商机 | `GET /opportunities` | `updatedAt`、`createdAt` | `updatedAt asc, id asc` | 当前以阶段/状态为准 |
| 报价 | `GET /quotes` | `updatedAt`、`createdAt` | `updatedAt asc, id asc` | 当前以状态为准 |
| 订单 | `GET /orders` | `updatedAt`、`createdAt`、`dealAt` | `updatedAt asc, id asc` | 当前以状态为准 |
| 字典 | `GET /meta/dictionaries` | 暂无增量字段 | 定时全量刷新 | 全量覆盖 |
| 角色权限 | `GET /meta/role-permissions` | 暂无增量字段 | 定时全量刷新 | 全量覆盖 |

注意：

1. 当前 OpenAPI 支持按 `updatedAfter/updatedBefore` 做增量过滤，但如历史数据缺少 `updatedAt`，建议 AI-agent 对该对象采用定时全量或准全量刷新。
2. 第一阶段暂不承诺所有对象都有稳定 `deletedAt` 字段。
3. 如需严格删除同步，建议后续增加对象级 `deletedAt/isDeleted` 或通过快照差异处理。

---

## 3. SQLite / 文件快照补充同步口径

第一阶段不需要 AI-agent 直连生产库。如 OpenAPI 字段暂时不足，可讨论补充同步源。

联软 CRM 当前建议优先级：

| 优先级 | 方式 | 建议 |
|---|---|---|
| 1 | 标准 OpenAPI | 第一阶段正式通道 |
| 2 | SQLite 只读副本文件 | 仅作为补充，不读取生产运行文件 |
| 3 | SQLite 快照文件 | 按批次交付，适合联调和校验 |
| 4 | CSV / JSON 导出文件 | 可做单对象补充 |
| 5 | 生产 SQLite 直连 | 不建议 |

如后续启用 SQLite / 文件快照补充，同步规则另行确认：

| 项目 | 建议口径 |
|---|---|
| 生成频率 | MVP 可每日或手动，试运行可每小时 |
| 文件命名 | `lianruan_crm_{env}_{yyyyMMddHHmmss}_{batchId}.db` |
| 传输方式 | 内网共享目录、SFTP、对象存储或现场交付 |
| 一致性 | 建议同一批次完整快照 |
| 校验方式 | 文件 hash、对象记录数、schema 版本 |
| 安全要求 | 不包含明文密码、token、密钥字段 |

---

## 4. 四类账号与权限验证口径

当前联调账号继续沿用：

| 角色 | 用户名 | 用户 ID | client |
|---|---|---|---|
| 超管 | `liulonghai` | `A030` | `AI-agent-superadmin-sit` |
| 区管 | `admin_sd` | `A013` | `AI-agent-admin-sit` |
| 企业/渠道管理员 | `liangcui` | `PA001` | `AI-agent-partner-admin-sit` |
| 员工 | `shangxichao` | `S022` | `AI-agent-staff-sit` |

建议 AI-agent 用同一批问题分别调用四组 client，验证结果差异：

| 角色 | 预期 |
|---|---|
| 超管 | 可见全量数据 |
| 区管 | 仅可见本区域/大区范围数据 |
| 渠道管理员 | 仅可见本渠道、本渠道下级和关联归属数据 |
| 员工 | 仅可见本人创建、本人负责或本人被指派数据 |

六类样例数据 ID 和四类账号实测结果仍需基于当前环境再次跑数后补充，建议作为 P0 联调实测产物交付，不在本文中编造固定值。

---

## 5. MVP 指标口径初稿

### 5.1 商机超过两周未更新

MVP 口径：

```text
当前先使用 opportunities.updatedAt 判断。
超过 14 个自然日未更新，即视为“超过两周未更新”。
```

后续增强口径：

```text
如果后续 CRM 提供稳定跟进记录或 lastFollowUpAt 字段，
则优先使用最后跟进时间；
缺失时再回退 opportunities.updatedAt。
```

SQL / 语义层建议：

```text
stale_opportunity = now() - COALESCE(lastFollowUpAt, updatedAt) > 14 days
```

### 5.2 下单金额

MVP 口径：

```text
订单金额优先使用 orders.amount；
如为空，依次回退 totalAmount、total、originalTotal。
```

展示名称：

```text
订单金额 / 下单金额
```

暂不等同于：

```text
有效收入、合同金额、回款金额
```

如后续 CRM 提供合同金额、有效收入、回款金额，建议分别建模，不与订单金额混用。

### 5.3 商机金额

MVP 口径：

```text
商机金额使用 opportunities.amount。
```

### 5.4 报价金额

MVP 口径：

```text
报价金额优先使用 quotes.amount；
如为空，回退 totalAmount、total、originalTotal。
```

### 5.5 未报备 / 未建商机客户

MVP 口径：

| 指标 | 口径 |
|---|---|
| 未报备客户 | `customers.registrationCount = 0` |
| 未建商机客户 | `customers.opportunityCount = 0` |
| 未下单客户 | `customers.orderCount = 0` |

### 5.6 合作伙伴、服务商、渠道商、代理商

MVP 口径：

```text
合作伙伴 / 服务商 / 渠道商 / 代理商 第一阶段统一映射为 partners。
```

如需区分主体类型，建议后续增加或使用：

```text
partnerType
partnerTypeName
partnerLevel
partnerLevelName
isTechnicalServiceProvider
technicalServiceProviderType
```

---

## 6. 敏感字段与脱敏规则初稿

建议 AI-agent 第一阶段按以下规则处理：

| 字段类型 | 示例字段 | 是否同步 | 是否进 AI 上下文 | 企微展示 | Web 展示 |
|---|---|---|---|---|---|
| 密码/Token/密钥 | `password`、`token`、`secret`、`appSecret` | 否 | 否 | 否 | 否 |
| 手机号 | `phone`、`mobile` | 可同步 | 谨慎，仅必要场景 | 默认脱敏 | 按权限脱敏/明文 |
| 联系人 | `contact` | 可同步 | 谨慎 | 默认脱敏或不展示明细 | 按权限展示 |
| 统一社会信用代码 | `creditCode` | 可同步 | 一般不放入报告正文 | 默认脱敏 | 按权限脱敏/明文 |
| 地址 | `deliveryAddr`、`address` | 可同步 | 默认不进入 AI 上下文 | 默认只展示区域/城市 | 按权限展示 |
| 金额 | `amount`、`totalAmount` | 可同步 | 可用于聚合分析 | 可展示聚合值 | 按权限展示 |
| 内部备注 | `remark`、`comment` | 暂不建议 | 否 | 否 | 待确认 |
| 审批意见 | `approvalOpinion` | 暂不建议 | 否 | 否 | 待确认 |

脱敏示例：

| 类型 | 示例 | 脱敏后 |
|---|---|---|
| 手机号 | `13800138000` | `138****8000` |
| 信用代码 | `91310000XXXXXXXXXX` | `9131************XX` |
| 地址 | `山东省济南市历下区xxx` | `山东省济南市` |

---

## 7. 企业微信 userid 与 CRM 用户映射

当前 OpenAPI 用户对象已预留并输出以下字段：

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

当前说明：

1. 如果 `wecomUserId` 已维护，AI-agent 可优先使用 `wecomUserId -> CRM user.id` 映射。
2. 如果 `wecomUserId` 暂为空，SIT 阶段可先用测试账号用户名人工映射。
3. 生产企业微信机器人正式上线前，需要双方确认正式 `wecomUserId` 映射清单。

建议映射表结构：

| 字段 | 说明 |
|---|---|
| `wecomUserId` | 企业微信 userid |
| `crmUserId` | CRM 用户 ID |
| `username` | CRM 登录名 |
| `name` | 用户姓名 |
| `role` | CRM 角色编码 |
| `roleName` | CRM 角色中文名 |
| `departmentId` | 部门 ID |
| `departmentName` | 部门名称 |
| `region` | 区域 |
| `bigRegion` | 大区 |
| `partnerId` | 渠道 ID |
| `status` | 是否启用 |

---

## 8. 首批 20 条高频问题回归集初稿

建议双方先用以下 20 条作为 MVP 回归问题。每条问题需分别用超管、区管、渠道管理员、员工四类账号验证权限差异。

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

建议每条样例补充：

1. 测试账号。
2. 问题原文。
3. 时间范围。
4. 权限范围。
5. 期望指标值。
6. 期望明细数量。
7. 数据截至时间。

---

## 9. 当前需要继续实测后回传的内容

以下内容不建议凭空写死，需要用当前联调环境跑数后回传：

| 内容 | 处理方式 |
|---|---|
| 六类样例数据 ID | 用四类 client 调 `diagnostics/self-check` 和各对象列表后提取 |
| 四类账号权限实测结果 | 同题查询后形成矩阵 |
| 各对象当前总数 | 以超管 client 当前返回为准 |
| 每个高频问题的期望指标值 | 以当前数据跑数结果为准 |
| 企微 userid 正式映射 | 需业务侧确认后提供 |
| 敏感字段最终规则 | 需业务侧确认后固化 |

---

## 10. 给贵方的下一步建议

建议双方并行启动：

### 联软 CRM 侧

1. 基于当前 OpenAPI 跑一次四类账号实测。
2. 补充六类样例数据 ID。
3. 确认商机超期和下单金额最终口径。
4. 确认敏感字段最终脱敏规则。
5. 补正式企微 userid 映射。

### AI-agent 侧

1. 按本文同步规则搭建 OpenAPI 同步任务。
2. 建 ODS 原始层和同步日志。
3. 建 DWD 标准模型初稿。
4. 建权限桥表和四类账号权限快照。
5. 用首批 20 条问题建立语义回归集。
6. 实现查询计划到受控 SQL 的校验链路。

---

## 11. 可直接确认的一句话

```text
联软 CRM 侧确认贵方数据仓库语义层方案可进入 P0/P1 实作。第一阶段以标准 OpenAPI 作为正式同步源和权限来源；Text-to-SQL 仅在 AI-agent 分析库执行，不直连联软生产库。本文先回传 OpenAPI 同步规则、MVP 指标口径、脱敏规则初稿、企微映射字段和首批 20 条回归问题；样例数据 ID、权限矩阵实测值和最终敏感字段规则将在当前联调环境跑数和业务确认后继续补充。
```

---

## 12. 2026-06-09 P0 落地补充资料

对照贵方《发给联软CRM-数据仓库语义层落地P0补充资料清单》，联软 CRM 侧已补充一份更细的落地材料：

```text
发给crm-agent-联软CRM数据仓库语义层落地P0补充资料回复.md
```

该材料包含：

1. P0 字段白名单。
2. 字段中文名、类型、是否主键、是否关联键、是否可同步/分析/展示。
3. 客户、伙伴、报备、商机、报价、订单主键与关联关系。
4. 商机金额、报价金额、订单金额、下单时间、商机超期等 MVP 指标口径。
5. 四类角色权限路径和 SQL 权限注入建议。
6. 敏感字段同步、分析、企微展示和 Web 展示规则。
7. 企微 userid 与 CRM 用户映射字段。
8. 首批 20 条回归问题和待实测回传项。

# 发给 crm-agent：联软 CRM 只读库 Text-to-SQL 接入回复与落地建议

> 日期：2026-06-09  
> 适用范围：crm-agent / AI-agent 智能分析联调、只读问数、Text-to-SQL 方案评估  
> 依据：贵方《只读库 Text-to-SQL 接入资料清单与我方实施方案》、联软 CRM 当前 OpenAPI 与业务权限现状  
> 结论：当前第一阶段继续以联软 CRM 标准 OpenAPI 作为正式联调通道；Text-to-SQL 建议放到后续“受控只读分析镜像 / 语义视图层”中实施，不建议直接连接生产业务 SQLite 作为正式对接底座。

---

## 1. 先给结论

贵方提出的“只读库 + AI 受控 SQL”方向可以作为后续智能分析增强方案，但结合联软 CRM 当前系统实际，建议按以下口径推进：

1. 第一阶段正式对接仍走 `标准 OpenAPI`。
2. 当前不提供生产业务 SQLite 的直接连接账号、文件路径或裸表访问权限。
3. 如后续确需 Text-to-SQL，建议新增一层 `只读分析镜像 / MySQL 语义视图层`，由 CRM 侧控制数据同步、字段白名单、权限口径、脱敏和审计。
4. AI-agent 可以继续负责自然语言理解、查询计划生成、结果解释和报告生成，但最终数据访问建议由 CRM 标准接口或受控只读分析层承接。

一句话口径：

```text
第一阶段：AI-agent 调联软 CRM OpenAPI。
后续增强：CRM 提供受控只读分析镜像，AI-agent 做 Text-to-SQL。
不建议：AI-agent 直接裸连生产业务 SQLite。
```

---

## 2. 为什么不建议直接开放生产 SQLite

当前联软 CRM 的真实业务语义并不完全等同于数据库表结构，主要原因如下：

1. 权限裁剪在 CRM 服务层完成，包括超管、区管、渠道管理员、员工等角色的数据范围。
2. 客户、渠道、报备、商机、报价、订单存在运行时补齐字段和兼容字段。
3. 客户主数据目前是 OpenAPI 只读视图，由报备、商机、报价、订单归并生成，并非简单单表。
4. 渠道层级、区域、大区、负责人、指派员工等归属关系需要代码规则综合判断。
5. 直接开放内部业务库会导致字段变更、权限口径、敏感字段、审计留痕都外溢到对方系统，长期维护风险较高。

因此，生产直连 SQLite 不作为第一阶段正式交付内容。

---

## 3. 当前正式可用对接方式

当前联软 CRM 已提供标准 OpenAPI，所有接口均为只读能力，并按 token 绑定的 CRM 用户自动做权限裁剪。

Base URL：

```text
http://10.18.16.114:3000/api/open/v1
```

鉴权：

```http
POST /auth/token
Authorization: Bearer {accessToken}
```

当前可覆盖对象：

| 对象 | OpenAPI 资源 | 说明 |
|---|---|---|
| 用户 | `users` | CRM 用户、角色、组织、区域、渠道归属 |
| 渠道商/服务商 | `partners` | 渠道基础资料、层级、区域、技术服务商标识 |
| 客户主数据 | `customers` | 只读客户视图，聚合报备、商机、报价、订单形成 |
| 客户报备 | `registrations` | 客户入口、报备状态、渠道归属 |
| 商机 | `opportunities` | 商机阶段、金额、负责人、关联报备/报价 |
| 报价单 | `quotes` | 报价金额、状态、关联商机 |
| 订单 | `orders` | 订单金额、状态、关联报价/商机 |

当前可覆盖分析：

| 类型 | 接口 |
|---|---|
| 单对象摘要 | `GET /analytics/{resource}/summary` |
| 经营总览 | `GET /analytics/business-overview` |
| 报备-商机-报价-订单漏斗 | `GET /analytics/funnel/registration-opportunity-order` |
| 渠道贡献 | `GET /analytics/partners/contribution` |
| 服务商画像 | `GET /analytics/partners/profile` |
| 区域贡献 | `GET /analytics/regions/contribution` |
| 负责人贡献 | `GET /analytics/owners/contribution` |
| 客户生命周期 | `GET /analytics/customers/lifecycle` |
| 未报备/未建商机客户 | `GET /analytics/customers/unregistered-opportunity` |
| 沉睡客户 | `GET /analytics/customers/idle` |

---

## 4. 对贵方资料清单的逐项回复

| 贵方所需资料 | 当前回复 | 交付方式 |
|---|---|---|
| 只读库连接参数 | 第一阶段暂不提供生产业务库直连；后续如建设分析镜像再单独提供连接参数 | 暂不交付明文连接信息 |
| 数据库类型 | 当前 CRM 内部使用轻量本地数据持久化/SQLite 相关逻辑，但不作为正式对外契约 | 仅作现状说明 |
| 表结构/DDL | 不建议以内部业务表作为对外稳定契约；当前提供 OpenAPI 字段字典和对象关系 | 见字段字典文档 |
| 字段语义 | 已整理 OpenAPI 字段字典、客户关联键、角色权限字段 | 见《AI-agent对接字段字典与适配清单》 |
| 表关系/业务链路 | 当前按客户、报备、商机、报价、订单、渠道关系输出 | 见本文第 7 节 |
| 指标口径 | 已整理统计指标口径 | 见《统计指标口径定义表》 |
| 字典枚举 | 已通过 `GET /meta/dictionaries` 输出 | OpenAPI 接口 |
| 权限规则 | 已通过 `GET /meta/permission-scope`、`GET /meta/role-permissions` 输出 | OpenAPI 接口 |
| 企微用户映射 | 当前字段已预留 `wecomUserId`，真实映射资料需双方继续确认 | 字段已输出，映射待确认 |
| 敏感字段/脱敏 | OpenAPI 当前默认不返回密码、密钥等敏感字段，手机号等字段需按角色和场景继续确认 | 建议后续补脱敏矩阵 |
| 样例数据与预期结果 | 已提供样例测试账号与样例数据清单模板，实测结果可继续补充 | 文档模板 + 联调实测 |
| 同步频率 | 第一阶段走实时 OpenAPI；如后续建设镜像，建议分钟级或小时级同步 | 后续镜像方案确认 |

---

## 5. 如果后续要做 Text-to-SQL，推荐架构

推荐不要让 AI-agent 直接连接生产业务库，而是建设受控分析层：

```text
企业微信机器人 / Web 智能分析
        |
        v
AI-agent 自然语言理解
        |
        v
结构化查询计划
        |
        v
SQL 安全校验 / 字段白名单 / 权限注入 / 审计
        |
        v
联软 CRM 只读分析镜像或语义视图层
        |
        v
标准化结果
        |
        v
AI-agent 生成分析报告
```

建议的分析镜像形态：

| 方案 | 说明 | 建议 |
|---|---|---|
| OpenAPI 继续作为主通道 | 适合身份、权限、明细、标准统计 | 第一阶段立即使用 |
| MySQL 只读分析镜像 | 适合复杂聚合、趋势、Text-to-SQL | 第二阶段推荐 |
| SQLite 文件副本 | 适合临时验证或小范围测试 | 可做测试，不建议生产正式化 |
| 直接连接生产 SQLite | 绕过服务层权限和审计 | 不建议 |

---

## 6. Text-to-SQL 安全边界建议

如进入 Text-to-SQL 阶段，建议双方按以下规则实施：

1. AI 只生成查询计划或 SQL 草稿，不直接执行生产查询。
2. 程序只允许单条 `SELECT`。
3. 禁止 `INSERT`、`UPDATE`、`DELETE`、`DROP`、`ALTER`、`TRUNCATE`、`ATTACH` 等写入或跨库操作。
4. 只允许访问白名单表和白名单字段。
5. 所有 SQL 必须参数化，不能拼接用户原始输入。
6. 所有查询必须注入当前 CRM 用户权限范围。
7. 默认分页，默认 `LIMIT 100`，最大不超过 `1000`。
8. 查询超时建议默认 5 秒，复杂分析最大不超过 30 秒。
9. 金额、手机号、联系人、统一社会信用代码等敏感字段按脱敏矩阵处理。
10. 记录用户、问题、查询计划、SQL、参数、权限快照、返回行数、耗时、结果摘要。

---

## 7. 当前业务对象关系口径

当前建议 AI-agent 按以下对象关系理解联软 CRM 数据：

```text
客户 customers
  ├─ 客户报备 registrations
  ├─ 商机 opportunities
  ├─ 报价 quotes
  └─ 订单 orders

渠道商 partners
  ├─ 客户报备 registrations
  ├─ 商机 opportunities
  ├─ 报价 quotes
  └─ 订单 orders

用户 users
  ├─ 创建人 createdBy
  ├─ 负责人 ownerId
  └─ 指派员工 assignedStaffId
```

主要关联字段：

| 来源 | 目标 | 关联字段 |
|---|---|---|
| 客户视图 | 报备/商机/报价/订单 | `customerId` |
| 报备 | 商机 | `opportunities.regId = registrations.id` |
| 商机 | 报价 | `quotes.oppId / quotes.oppIds = opportunities.id` |
| 报价 | 订单 | `orders.quoteId = quotes.id` |
| 商机 | 订单 | `orders.oppId = opportunities.id` |
| 渠道 | 业务对象 | `partnerId / assignedPartnerId / parentPartnerId / parentPartnerIds` |
| 用户 | 业务对象 | `createdBy / ownerId / assignedStaffId` |

客户 ID 规则：

| `customerIdRule` | 说明 |
|---|---|
| `customerId` | 对象已有真实客户 ID |
| `creditCodeHash` | 按统一社会信用代码/税号生成稳定 ID |
| `normalizedNameHash` | 按标准化客户名称生成稳定 ID |
| `empty` | 缺少客户信息 |

---

## 8. 权限口径

当前 OpenAPI 侧已按绑定用户做权限裁剪。Text-to-SQL 阶段也必须沿用同一权限口径。

| 角色 | 权限范围 |
|---|---|
| 超管 `superadmin` | 全量可见，但仍记录权限快照和审计 |
| 区管 `admin` | 本区域/大区范围内数据 |
| 渠道管理员 `partner_admin` | 本渠道、本渠道下级或关联归属数据 |
| 员工 `staff` | 本人创建、本人负责或本人被指派数据 |

当前可通过以下接口获取权限：

```http
GET /meta/permission-scope
GET /auth/permission-scope
GET /meta/role-permissions
GET /users/{userId}/permission-scope
```

关键原则：

1. AI-agent 不自行推断权限。
2. 权限条件由 CRM 服务侧或受控 SQL 执行层强制注入。
3. 任何查询如果无法确认用户映射或权限范围，应拒绝执行，而不是默认按高权限执行。

---

## 9. 可先交付给贵方的资料

建议贵方第一轮继续使用以下资料完成 OpenAPI 与语义适配：

1. 《发给对方-联软CRM标准OpenAPI最新对接说明》
2. 《AI-agent标准API契约》
3. 《AI-agent对接字段字典与适配清单》
4. 《统计指标口径定义表》
5. 《样例测试账号与样例数据清单模板》
6. 《联调专用Client创建说明》
7. 《发给crm-agent-联软CRM角色权限与企微映射字段回复》
8. 《发给crm-agent-联软CRM智能分析OpenAPI全量补充回复》
9. 《发给crm-agent-联软CRM只读库Text-to-SQL接入回复与落地建议》

说明：

1. 上述资料不包含明文 `appSecret`。
2. 明文密钥、生产地址、数据库账号等敏感内容只通过安全渠道单独交付。
3. 如后续建设只读分析镜像，再补充镜像库连接参数、视图 DDL 和同步说明。

---

## 10. 建议双方下一步分工

### 10.1 联软 CRM 侧

1. 继续以 OpenAPI 支撑第一阶段联调。
2. 补充并确认客户、渠道、报备、商机、报价、订单字段口径。
3. 继续完善样例数据 ID 和权限矩阵实测结果。
4. 评估第二阶段是否建设 MySQL 只读分析镜像。
5. 如建设镜像，先输出语义视图设计，而不是直接暴露内部业务表。

### 10.2 AI-agent 侧

1. 第一阶段按 OpenAPI 完成身份、权限、字段、统计接口适配。
2. 自然语言问数先转成结构化查询参数，再调用 OpenAPI。
3. 对于 OpenAPI 暂不支持的问题，记录为能力缺口，不直接要求裸库查询。
4. 后续 Text-to-SQL 阶段按 CRM 提供的语义视图和字段白名单生成 SQL。
5. 执行前必须经过 SQL 安全校验、权限注入和审计。

---

## 11. 后续 Text-to-SQL 分阶段计划

| 阶段 | 目标 | 交付物 |
|---|---|---|
| T0 | 继续跑通 OpenAPI 问数 | 接口联调、字段字典、指标口径、样例问题 |
| T1 | 设计只读分析语义层 | 语义视图清单、字段白名单、敏感字段矩阵 |
| T2 | 建设只读分析镜像 | MySQL 只读库、同步任务、同步监控 |
| T3 | 接入受控 SQL | SQL 校验、权限注入、超时、LIMIT、审计 |
| T4 | 回归与运营 | 问题样例集、失败问题沉淀、字段变更通知机制 |

---

## 12. 首轮验收建议

当前第一阶段建议先按 OpenAPI 验收：

1. 4 组 client 均可获取 token。
2. `auth/me` 能返回绑定用户。
3. `permission-scope` 能返回权限范围。
4. `dictionaries` 能返回区域、大区、角色、状态等字典。
5. `users / partners / customers / registrations / opportunities / quotes / orders` 均可按权限查询。
6. 统计接口能返回当前权限范围内汇总。
7. 超管、区管、渠道管理员、员工返回结果存在符合预期的权限差异。
8. 所有调用可在 CRM 侧审计追踪。

Text-to-SQL 验收建议放到第二阶段：

1. 只读分析库连接成功。
2. SQL 白名单和字段白名单生效。
3. 写入、删改、跨库、危险函数全部被阻断。
4. 权限注入后的结果与 OpenAPI 同口径一致。
5. 查询超时、分页、行数限制生效。
6. SQL 审计日志完整。

---

## 13. 当前需双方确认的问题

1. 第一阶段是否继续确认以 OpenAPI 为唯一正式联调通道。
2. 贵方 Text-to-SQL 是否可以延后到第二阶段，只针对受控分析镜像实施。
3. 如建设 MySQL 分析镜像，是否由联软 CRM 侧提供语义视图和同步任务，由 AI-agent 侧按语义视图适配。
4. 企微 `userid` 与 CRM 用户的正式映射数据何时提供。
5. 敏感字段脱敏矩阵是否按“手机号、联系人、统一社会信用代码、详细地址、内部审批意见、金额”分级确认。

---

## 14. 最终建议

当前建议双方不要把第一阶段联调复杂化为数据库直连工程。

推荐处理方式：

```text
现在：OpenAPI 正式联调，把身份、权限、字段和统计跑稳。
后续：如数据量和复杂问数增长，再建设 MySQL 只读分析镜像。
Text-to-SQL：只在受控语义视图层执行，不直接操作生产业务库。
```

这样既能满足 AI-agent 智能分析能力，也能保证联软 CRM 的安全、业务连续性、可维护性和后续扩展空间。

---

## 15. 2026-06-09 数据仓库语义层方案补充

对照贵方后续提出的《联软CRM-数据仓库语义层AI智能分析总体方案与双方分工》，联软 CRM 侧认可该方向作为长期方案。

当前补充确认：

1. 数据仓库、标准模型、语义层和受控 SQL 建议由 AI-agent 侧承接。
2. 联软 CRM 第一阶段提供标准 OpenAPI 作为数据同步源和权限来源。
3. 不建议直接连接联软生产业务库。
4. 后续 Text-to-SQL 建议只面向 AI-agent 分析库或只读语义视图层执行。
5. 阶段计划、双方分工和可先确认内容见：

```text
发给crm-agent-联软CRM数据仓库语义层AI智能分析方案确认与阶段清单.md
```

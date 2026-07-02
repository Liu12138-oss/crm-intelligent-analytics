# 联软 CRM 对接 AI-agent 标准 API 接口总体技术方案

> 版本：V2.0  
> 日期：2026-06-03  
> 适用对象：CRM 项目组、AI-agent 对接团队、实施与联调团队  
> 本文定位：作为第一阶段正式对外方案，指导双方按标准 API 方式对接

---

## 1. 方案结论

本项目建议采用：

`AI-agent -> 联软 CRM 标准 OpenAPI -> CRM 业务数据与权限逻辑`

不建议采用：

`AI-agent -> 直接访问 CRM 生产 SQLite`

第一阶段目标不是一次性做完所有 AI 能力，而是先把以下三件事稳定打通：

1. 打通 AI-agent 到 CRM 的标准查询接口。
2. 打通“绑定 CRM 用户即带权限”的安全访问链路。
3. 打通 6 类核心对象的查询、检索、详情和基础过滤能力。

一句话口径：

`先标准 API，后扩展分析；先查，后写；先身份和权限，后深度业务动作。`

---

## 2. 背景与判断

结合当前项目代码和对方评估方案，直接走数据库适配有几个明显问题：

1. 当前 CRM 的真实业务语义并不只在表结构中，很多归属补齐、权限裁剪、状态判断在 [server.js](/D:/远程交付中心文件/建设材料/AI项目及frp/redclaw/lianruan-crm-deploy-v2.2.0_back202605271516/lianruan-crm-deploy-v2.2.0/backend/server.js) 里完成。
2. `registrations`、`opportunities`、`quotes`、`orders` 虽然有稳定主对象，但仍存在运行时补字段、兼容字段、扩展字段的情况。
3. 对方如果直接适配 SQLite，会同时承接表结构理解、权限还原、业务语义还原、后续结构变更跟随，长期维护成本高。
4. 我方项目已经存在一套 `open/v1` 风格开放接口基础，包含客户端、密钥、令牌、资源授权、IP 白名单、审计日志和按绑定用户做权限裁剪的能力，适合直接升级为正式标准 API。

因此，最稳的做法不是“把库给对方”，而是“把标准接口给对方”。

---

## 3. 当前可复用基础

当前项目中已经具备以下 OpenAPI 基础能力：

1. 应用鉴权
   - `POST /api/open/v1/auth/token`
2. 当前绑定用户上下文
   - `GET /api/open/v1/auth/me`
3. 核心对象开放查询
   - `users`
   - `partners`
   - `registrations`
   - `opportunities`
   - `quotes`
   - `orders`
4. 应用管理能力
   - OpenAPI client 创建、更新、重置密钥、查看访问日志
5. 安全控制能力
   - `appKey/appSecret`
   - `Bearer accessToken`
   - `allowedResources`
   - `ipWhitelist`
   - 绑定 CRM 用户
   - 审计留痕
   - 敏感字段自动脱敏输出

这意味着第一阶段不需要重做一套独立网关，建议直接把当前 `open/v1` 体系标准化、补齐文档、补齐少量缺口后对外提供。

---

## 4. 第一阶段标准 API 范围

### 4.1 接口范围

第一阶段建议只开放查询类标准 API，覆盖以下接口组：

1. 鉴权与上下文
   - `POST /api/open/v1/auth/token`
   - `GET /api/open/v1/auth/me`
2. 权限与字典
   - `GET /api/open/v1/meta/permission-scope`
   - `GET /api/open/v1/meta/dictionaries`
3. 用户
   - `GET /api/open/v1/users`
   - `GET /api/open/v1/users/:id`
4. 渠道
   - `GET /api/open/v1/partners`
   - `GET /api/open/v1/partners/:id`
5. 客户报备/客户入口
   - `GET /api/open/v1/registrations`
   - `GET /api/open/v1/registrations/:id`
6. 商机
   - `GET /api/open/v1/opportunities`
   - `GET /api/open/v1/opportunities/:id`
7. 报价
   - `GET /api/open/v1/quotes`
   - `GET /api/open/v1/quotes/:id`
8. 订单
   - `GET /api/open/v1/orders`
   - `GET /api/open/v1/orders/:id`

### 4.2 本阶段不纳入

以下能力暂不纳入第一阶段正式承诺：

1. AI 直接写回 CRM
2. 跟进记录新增/修改
3. 审批动作写回
4. 企业微信扫码登录映射细节
5. 复杂统计分析接口
6. SQLite -> MySQL 分析镜像
7. 直接面向 LLM 的自然语言接口

### 4.3 已预留第二阶段真实登录适配能力

在不影响第一阶段标准 OpenAPI 联调的前提下，当前后端已预留第二阶段“真实 CRM 登录”适配层，特点如下：

1. 默认关闭，不影响现有 `POST /api/auth/login` 本地登录。
2. 可通过环境变量启用“真实登录优先、本地登录回退”模式。
3. 可通过本地 mock 真实登录接口先完成自测，再切换到对方真实登录地址。
4. 真实登录成功后，当前先按 `user_id / username` 映射回本地 CRM 用户做权限落位。
5. 后续如对方提供只读库或身份查询 API，可再替换为正式身份映射源。

建议推进顺序：

1. 先完成标准 OpenAPI 第一阶段联调。
2. 再在本地环境完成真实登录模式自测。
3. 自测稳定后，再切到对方提供的真实登录地址联调。
4. 最后再评估生产联调切换。

---

## 5. 目标架构

```text
企业微信机器人 / 企业微信扫码 / Web 智能分析工作台
                    |
                    v
            对方统一智能中台 AI-agent
                    |
        +-----------+-----------+
        |                       |
        | 1. AI 理解/编排/审计   |
        | 2. 调标准 API 查询数据 |
        | 3. 按返回结果组织回答   |
        +-----------+-----------+
                    |
                    v
         联软 CRM 标准 OpenAPI（本次交付重点）
                    |
        +-----------+-----------+
        |                       |
        | 1. client 鉴权         |
        | 2. 绑定 CRM 用户权限    |
        | 3. 资源授权与 IP 白名单 |
        | 4. 对象查询与过滤       |
        | 5. 审计日志             |
        +-----------+-----------+
                    |
                    v
         联软 CRM 现有业务服务与 SQLite 数据
```

图文对应说明：

### OpenAPI 层做什么

1. 接收 AI-agent 的标准 HTTP 调用。
2. 校验 `appKey/appSecret` 或 `accessToken`。
3. 将 AI-agent 应用绑定到一个 CRM 用户。
4. 按该 CRM 用户的角色、区域、渠道、人员归属裁剪数据范围。
5. 返回脱敏后的标准 JSON 结果。
6. 记录每一次外部访问的审计日志。

### AI-agent 做什么

1. 统一接入企业微信机器人、扫码登录和 Web 工作台。
2. 负责自然语言理解、意图识别、参数提取。
3. 决定调哪个标准 API。
4. 把多次 API 返回结果组织成最终回答。
5. 做中台侧的执行管控、上下文会话和审计。

### CRM 做什么

1. 提供可信业务数据。
2. 提供真实权限口径。
3. 提供标准 OpenAPI 契约。
4. 保持对自身业务逻辑最小侵入。

补充：

真实登录模式下，CRM 还承担两类能力：

1. 真实登录入口适配
2. 登录成功后的身份映射与权限落位

---

## 6. 安全设计

### 6.1 认证方式

建议沿用当前机制：

1. 为 AI-agent 创建专用 OpenAPI client。
2. 分配 `appKey`、`appSecret`。
3. 通过 `POST /api/open/v1/auth/token` 换取 `accessToken`。
4. 后续请求通过 `Authorization: Bearer <token>` 访问。

### 6.2 授权方式

授权以“绑定 CRM 用户”作为核心：

1. 每个 OpenAPI client 绑定一个 CRM 用户。
2. 所有对外查询都继承该用户的数据权限。
3. AI-agent 不直接指定“看谁的数据”，而是在权限内查询。
4. 如需多个权限视角，创建多个绑定不同用户的 client。

### 6.3 附加安全控制

1. `allowedResources` 控制可访问资源集合。
2. `ipWhitelist` 控制来源 IP。
3. `expiresAt` 控制应用有效期。
4. `OPEN_API_TOKEN_TTL_MS` 当前为 2 小时。
5. 返回结果自动去除敏感字段。
6. 每次请求带 `requestId`，便于排障和审计。

### 6.4 真实登录模式安全原则

第二阶段真实登录模式按以下原则设计：

1. 默认不开启 `CRM_REAL_LOGIN_ENABLED`，避免误影响现有登录。
2. 本地自测阶段可开启 `CRM_AUTH_MOCK_ENABLED=true`，允许真实登录失败时回退本地登录。
3. 正式联调阶段建议设置 `CRM_AUTH_MOCK_ENABLED=false`，确保问题暴露清晰，不走隐式回退。
4. 若真实登录已成功，但本地仍无对应身份映射，则直接报错，不自动降级为高权限。
5. 真实登录资料未补齐时，不切生产。

相关手册见：

[真实登录联调测试与迁移手册.md](/D:/远程交付中心文件/建设材料/AI项目及frp/redclaw/lianruan-crm-deploy-v2.2.0_back202605271516/lianruan-crm-deploy-v2.2.0/docs/真实登录联调测试与迁移手册.md)

---

## 7. 权限口径

第一阶段对外统一采用以下权限口径：

### 7.1 用户角色

1. `superadmin`
   - 可查看全量数据。
2. `admin`
   - 可查看本区域数据。
3. `partner_admin`
   - 可查看本渠道及关联归属范围数据。
4. `staff`
   - 仅查看本人创建、本人负责或本人被指派的数据。

### 7.2 对象过滤口径

#### users

1. `superadmin`：全部用户
2. `admin`：本区域用户及无区域用户
3. `partner_admin`：本渠道用户
4. `staff`：仅本人

#### partners

1. `superadmin`：全部渠道
2. `admin`：本区域已激活渠道，以及本人创建的待审渠道
3. `partner_admin`：本渠道、本渠道下级渠道、父子映射关联渠道
4. `staff`：仅本人所属渠道

#### registrations

1. `admin`：本区域
2. `partner_admin`：`partnerId / assignedPartnerId / parentPartnerId` 与本人渠道一致
3. `staff`：`createdBy = 本人` 或 `assignedStaffId = 本人`

#### opportunities / quotes / orders

1. `admin`：本区域
2. `partner_admin`：`partnerId / assignedPartnerId / parentPartnerId` 命中本人渠道
3. `staff`：`createdBy = 本人` 或 `ownerId = 本人` 或 `assignedStaffId = 本人`

### 7.3 关键说明

1. AI-agent 不需要自己实现 CRM 权限逻辑。
2. AI-agent 只需要选择正确的绑定 client 调接口。
3. CRM 侧返回什么，就代表该身份真正可见的数据范围。

---

## 8. 标准对象范围

第一阶段对外只固化 6 类核心对象：

1. 用户 `users`
2. 渠道 `partners`
3. 客户报备/客户入口 `registrations`
4. 商机 `opportunities`
5. 报价 `quotes`
6. 订单 `orders`

对象关系主链如下：

```text
users
  └─ partnerId -> partners.id

registrations
  └─ regId -> opportunities.regId

opportunities
  └─ oppId / oppIds -> quotes

quotes
  └─ quoteId -> orders.quoteId（如存在）

partners
  └─ parentPartnerId / parentPartnerIds -> partners.id
```

---

## 9. 对外交付清单

建议当前正式交付给对方的文档只保留以下三份：

1. [AI-agent对接接口总体技术方案.md](/D:/远程交付中心文件/建设材料/AI项目及frp/redclaw/lianruan-crm-deploy-v2.2.0_back202605271516/lianruan-crm-deploy-v2.2.0/docs/AI-agent对接接口总体技术方案.md)
2. [AI-agent对接字段字典与适配清单.md](/D:/远程交付中心文件/建设材料/AI项目及frp/redclaw/lianruan-crm-deploy-v2.2.0_back202605271516/lianruan-crm-deploy-v2.2.0/docs/AI-agent对接字段字典与适配清单.md)
3. [AI-agent标准API契约.md](/D:/远程交付中心文件/建设材料/AI项目及frp/redclaw/lianruan-crm-deploy-v2.2.0_back202605271516/lianruan-crm-deploy-v2.2.0/docs/AI-agent标准API契约.md)

---

## 10. 开工前建议

### 10.1 我方先做

1. 复核现有 `/api/open/v1/*` 返回字段是否稳定。
2. 补齐 `meta/permission-scope` 和 `meta/dictionaries` 两个标准接口。
3. 统一各对象的时间字段、状态字段、归属字段命名说明。
4. 清理不应对外暴露的非标准字段。
5. 补一份联调用测试数据。

### 10.2 对方配合

1. 确认 AI-agent 调用的鉴权方式就是 HTTP OpenAPI。
2. 确认一个机器人/工作台对应一个还是多个 CRM 权限身份。
3. 确认第一阶段只做查询，不做写回。
4. 按本标准 API 契约完成适配，不直接读取数据库。

---

## 11. 实施顺序建议

### 阶段 1：标准查询 API

目标：

1. 鉴权打通
2. 权限打通
3. 6 类对象查询打通

### 阶段 2：分析增强

目标：

1. 补复杂统计指标
2. 视数据量评估 SQLite -> MySQL 分析镜像
3. 支持更稳定的聚合分析和趋势问答

### 阶段 3：受控写回

目标：

1. 新增客户/商机/报价草稿
2. 审批流或人工确认后写回
3. 接入幂等、审计、回滚规则

---

## 12. 最终建议

当前最适合开工的正式口径是：

`AI-agent 不直连库，统一走 CRM 标准 OpenAPI。`

`第一阶段只做查询接口、权限继承、字段标准化和联调。`

`后续再根据数据量和业务深度决定是否补分析镜像与写回能力。`

---

## 13. 只读库 Text-to-SQL 补充建议

针对 AI-agent 新增提出的“只读库 + Text-to-SQL”资料清单，当前建议保持以下边界：

1. 第一阶段仍以标准 OpenAPI 作为正式联调和验收通道。
2. 不建议直接开放生产 SQLite 文件或内部业务表给 AI-agent 作为正式接入底座。
3. 如果后续确实需要 Text-to-SQL，建议由联软 CRM 侧建设只读分析镜像或 MySQL 语义视图层。
4. Text-to-SQL 只能访问白名单表和白名单字段，并由程序统一注入当前 CRM 用户权限。
5. SQL 执行必须具备只读校验、参数化、超时、分页、最大行数限制、脱敏和审计。

推荐目标架构：

```text
AI-agent 自然语言理解
        |
        v
结构化查询计划
        |
        v
SQL 安全校验 / 权限注入 / 审计
        |
        v
联软 CRM 只读分析镜像或语义视图层
```

配套说明见：

[发给crm-agent-联软CRM只读库Text-to-SQL接入回复与落地建议.md](/D:/远程交付中心文件/建设材料/AI项目及frp/redclaw/lianruan-crm-deploy-v2.2.0_back202605271516/lianruan-crm-deploy-v2.2.0/docs/发给crm-agent-联软CRM只读库Text-to-SQL接入回复与落地建议.md)

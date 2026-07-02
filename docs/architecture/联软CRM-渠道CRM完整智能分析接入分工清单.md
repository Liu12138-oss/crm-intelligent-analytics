# 联软CRM-渠道CRM完整智能分析接入分工清单

## 1. 文档目的

本文档用于说明“联软渠道 CRM 系统接入 AI-agent 后，实现完整智能分析能力”时，双方需要分别完成的工作、接口与数据要求、验收标准和推进顺序。

本文档可直接提供给联软 CRM 对接方，用于明确后续开发边界，避免双方只停留在第一阶段六类对象查询联调，而无法形成真实可用的智能分析闭环。

---

## 2. 我方目标

本次接入的目标不是简单把 CRM 页面嵌入 AI-agent，也不是只做六类对象列表查询，而是让用户可以在 AI-agent 中完成以下闭环：

1. 使用联软 CRM 真实账号登录 AI-agent。
2. AI-agent 能识别当前登录用户的 CRM 身份、角色和数据权限。
3. 用户在智能分析页输入自然语言问题，例如“最近一个月山东区渠道商机情况”“本季度各渠道订单转化情况”。
4. AI-agent 调用联软 CRM 标准接口获取授权范围内数据。
5. AI-agent 按统一语义层完成指标、维度、时间、区域、渠道、负责人等口径计算。
6. 页面展示可信的指标卡、趋势图、排行表、明细表、AI 经营摘要、风险提示和下一步建议。
7. 查询、权限、接口调用、异常和结果口径均可审计、可诊断、可回溯。

---

## 3. 当前状态

截至当前联调阶段，双方已具备以下基础：

1. 联软标准 OpenAPI 已可连通。
2. `auth/token`、`auth/me`、`meta/permission-scope`、`meta/dictionaries` 已完成首轮验证。
3. 六类对象列表和详情已具备第一阶段联调基础：
   - `users`
   - `partners`
   - `registrations`
   - `opportunities`
   - `quotes`
   - `orders`
4. 我方已实现联软标准 OpenAPI 后端适配层。
5. 我方已实现联软标准 OpenAPI 联调诊断后端接口。
6. 我方已实现首批标准 OpenAPI 智能分析执行器，当前覆盖商机、客户报备、渠道、报价、订单的列表聚合能力。
7. 我方已补齐标准 OpenAPI 分析路由，支持总览、负责人排名、时间趋势、状态/阶段/等级分布、区域贡献等首批结果形态。
8. 我方已完成远端 mock 真实登录链路首轮验证。

当前仍需注意：

1. 正式真实登录接口尚未完成最终联调。
2. 当前标准 OpenAPI 仍是 `client` 绑定用户模式，尚未形成“真实登录用户 -> 对应数据权限 -> 智能分析”的完整生产闭环。
3. 当前标准 OpenAPI 仍保留绑定用户一致性校验，多角色真实分析需要继续接入多 client 映射或用户态 token。
4. 当前多对象分析属于首批列表聚合，报备转商机、报价转订单、渠道层级穿透等跨对象转化漏斗仍需继续补齐。
5. 当前前端缺少面向实施和运维人员的联软 CRM 页面化诊断入口。

---

## 4. 推荐总体架构

推荐采用“API-first + 语义层适配 + 可选分析镜像库”的架构。

```text
用户
  |
  | 真实账号登录 / 企业微信入口
  v
AI-agent 前端
  |
  | 自然语言问题
  v
AI-agent 后端
  |
  | 1. 登录会话与 CRM 身份落位
  | 2. 权限范围装载
  | 3. AI 意图解析
  | 4. 渠道 CRM 语义层映射
  | 5. 标准 API 查询 / 可选镜像库查询
  | 6. 结果聚合与 AI 报告生成
  v
联软 CRM 标准 OpenAPI
  |
  | 封装 SQLite 内部结构
  v
联软 CRM SQLite 数据库
```

架构原则：

1. 第一优先级走联软标准 OpenAPI，不建议 AI-agent 直接读取联软 SQLite。
2. 联软 CRM 内部 SQLite 表结构由联软侧封装，不作为我方长期稳定依赖。
3. AI-agent 只依赖双方确认过的标准接口、字段字典和业务语义契约。
4. 若后续复杂统计性能不足，可增加“只读分析镜像库”，但仍不替代标准 OpenAPI 的身份、权限和对象契约。
5. 登录链路和只读分析链路分离，避免真实登录改造影响第一阶段标准 OpenAPI 稳定能力。

---

## 5. 完整智能分析需要覆盖的业务主题

完整智能分析至少建议覆盖以下主题。

| 主题 | 主要对象 | 示例问题 | 当前状态 |
|---|---|---|---|
| 商机分析 | `opportunities` | 最近一个月山东区商机金额和阶段分布 | 已有首批能力，需要扩展与验收 |
| 渠道分析 | `partners`、`opportunities`、`orders` | 各渠道商机和订单贡献排名 | 待补语义层与聚合接口 |
| 报备分析 | `registrations` | 本月各渠道报备数量、通过率、转商机情况 | 待补 |
| 报价分析 | `quotes` | 本季度报价数量、报价状态分布、关联商机情况 | 待补 |
| 订单转化分析 | `orders`、`quotes`、`opportunities` | 报备到订单的转化漏斗和金额趋势 | 待补 |
| 客户关系分析 | `registrations`、`orders` | 重点客户贡献、活跃客户、沉默客户 | 待补 |
| 区域/大区分析 | 多对象 | 山东区与其他区域商机、报备、订单对比 | 待补 |
| 负责人分析 | `users` + 业务对象 | 各销售负责人商机金额、订单金额、跟进风险 | 部分依赖商机字段，待扩展 |

---

## 6. 联软 CRM 需要完成的事项

## 6.1 正式真实登录接口

联软 CRM 需要开放正式真实登录接口，并确认以下内容：

| 项目 | 要求 |
|---|---|
| 正式登录 Base URL | 提供正式联调地址，不再仅使用 mock 路径 |
| 登录路径 | 明确是否为 `/api/v2/auth/login`，如不是请提供真实路径 |
| 请求字段 | 至少支持 `login`、`password`、`device`，如必须传 `corp_id` 请提供固定值 |
| `device` | 给出建议固定值 |
| `version_code` | 如接口鉴权需要，请给出建议固定值 |
| 超时时间 | 给出建议毫秒值 |
| 成功响应样例 | 必须包含 `code=0`、`data.user_id`、`data.user_token` |
| 失败响应样例 | 覆盖账号不存在、密码错误、账号禁用、待审批等场景 |
| `user_token` 有效期 | 明确 token 有效期和刷新策略 |

## 6.2 真实登录后的身份查询接口

登录成功后，AI-agent 必须把 `user_id` 转换为可用于权限判断的用户对象。联软 CRM 需要提供身份查询能力，推荐接口如下：

```text
GET /api/open/v1/identity/users/{userId}
```

返回字段至少包括：

| 字段 | 是否必须 | 说明 |
|---|---|---|
| `id` 或 `user_id` | 是 | CRM 用户唯一 ID |
| `name` | 是 | 用户显示名称 |
| `roleIds` 或 `role` | 是 | 角色标识 |
| `roleNames` | 建议 | 中文角色名 |
| `region` / `regions` | 条件必填 | 区域权限 |
| `bigRegion` / `bigRegions` | 建议 | 大区权限 |
| `partnerIds` | 条件必填 | 渠道权限 |
| `userIds` 或 `ownerIds` | 条件必填 | 个人可见用户范围 |
| `isAdmin` | 建议 | 是否管理员 |
| `channels` | 建议 | 可登录入口，如 `web-console`、`wecom-bot` |
| `wecomUserId` | 后续企微必填 | 企业微信用户 ID |

## 6.3 标准 OpenAPI 多用户权限模式

当前第一阶段标准 OpenAPI 是 `appKey/appSecret` 换取 `client` 绑定用户 token。为了支持真实用户智能分析，需要联软 CRM 确认以下二选一方案。

### 方案 A：按角色/用户提供多组 client 凭证

联软 CRM 为不同角色或不同测试用户提供对应 `appKey/appSecret`：

1. 超管 client
2. 区域管理员 client
3. 渠道管理员 client
4. 员工 client

AI-agent 根据登录用户选择对应 client。

适用场景：第一阶段联调、角色视角验证、样例环境。

### 方案 B：标准 OpenAPI 支持用户态 token

联软 CRM 的标准 OpenAPI 支持使用真实登录返回的 `user_token` 访问六类对象，并按该用户权限自动裁剪数据。

推荐鉴权示例：

```text
Authorization: Token token={user_token}, device={device}, version_code={version_code}
```

适用场景：生产环境真实用户使用。

建议结论：生产环境优先采用方案 B；如果短期无法完成，可先采用方案 A 做角色级灰度联调。

## 6.4 六类对象字段补齐与稳定承诺

联软 CRM 需要确认以下字段在标准 API 中长期稳定可用。

### 用户 `users`

必须字段：

1. `id`
2. `username`
3. `name`
4. `role`
5. `status`
6. `region`
7. `bigRegion`
8. `partnerId`
9. `partnerName`

建议字段：

1. `supervisorId`
2. `mobile`
3. `wecomUserId`

### 渠道 `partners`

必须字段：

1. `id`
2. `name`
3. `partnerLevel`
4. `parentPartnerId`
5. `parentPartnerIds`
6. `region`
7. `bigRegion`
8. `status`

### 报备 `registrations`

必须字段：

1. `id`
2. `customer`
3. `status`
4. `createdBy`
5. `assignedStaffId`
6. `partnerId`
7. `region`
8. `createdAt`
9. `updatedAt`

建议字段：

1. `convertedOpportunityId`
2. `convertedAt`
3. `rejectReason`

### 商机 `opportunities`

必须字段：

1. `id`
2. `name`
3. `customer`
4. `stage`
5. `amount`
6. `createdBy`
7. `ownerId`
8. `ownerName`
9. `assignedStaffId`
10. `assignedStaffName`
11. `partnerId`
12. `assignedPartnerId`
13. `region`
14. `bigRegion`
15. `regId`
16. `quoteId`
17. `createdAt`
18. `updatedAt`

建议字段：

1. `expectedClose`
2. `lostReason`
3. `riskLevel`

### 报价 `quotes`

必须字段：

1. `id`
2. `customer`
3. `customerName`
4. `oppId`
5. `oppIds`
6. `partnerId`
7. `assignedStaffId`
8. `status`
9. `amount`
10. `createdAt`
11. `updatedAt`

### 订单 `orders`

必须字段：

1. `id`
2. `customer`
3. `customerName`
4. `partnerId`
5. `parentPartnerId`
6. `assignedPartnerId`
7. `assignedStaffId`
8. `status`
9. `amount`
10. `quoteId`
11. `oppId`
12. `createdAt`
13. `updatedAt`

## 6.5 关联关系字段

为了实现完整智能分析，联软 CRM 必须保证以下关联字段可用：

| 来源对象 | 目标对象 | 推荐关联字段 |
|---|---|---|
| 报备 | 商机 | `registrations.id = opportunities.regId` |
| 商机 | 报价 | `opportunities.quoteId = quotes.id` 或 `quotes.oppId / quotes.oppIds` |
| 报价 | 订单 | `orders.quoteId = quotes.id` |
| 商机 | 订单 | `orders.oppId = opportunities.id` |
| 渠道 | 报备 | `registrations.partnerId = partners.id` |
| 渠道 | 商机 | `opportunities.partnerId / assignedPartnerId = partners.id` |
| 用户 | 商机 | `opportunities.assignedStaffId / ownerId / createdBy = users.id` |
| 用户 | 报备 | `registrations.assignedStaffId / createdBy = users.id` |
| 用户 | 报价/订单 | `assignedStaffId = users.id` |

## 6.6 统计类接口或分页能力增强

完整智能分析会涉及聚合、排行、趋势和漏斗。如果只提供分页列表，AI-agent 需要拉取大量数据后本地聚合，性能和准确性会受限制。

建议联软 CRM 至少二选一：

### 方案 A：增强列表接口筛选能力

列表接口支持以下筛选：

1. `createdAfter`
2. `createdBefore`
3. `updatedAfter`
4. `updatedBefore`
5. `region`
6. `bigRegion`
7. `partnerId`
8. `assignedStaffId`
9. `status`
10. `stage`
11. `pageNo`
12. `pageSize`
13. `sortBy`
14. `sortOrder`

并明确最大 `pageSize`、最大可翻页数量和总量统计准确性。

### 方案 B：提供聚合分析接口

建议新增：

```text
GET /analytics/opportunities/summary
GET /analytics/registrations/summary
GET /analytics/quotes/summary
GET /analytics/orders/summary
GET /analytics/funnel/registration-opportunity-order
GET /analytics/partners/contribution
```

每个接口支持：

1. 时间范围
2. 区域
3. 大区
4. 渠道
5. 负责人
6. 分组维度
7. 指标集合

建议结论：短期可走方案 A；中长期建议补方案 B，减少分页拉全量带来的性能风险。

## 6.7 字典接口补齐

`meta/dictionaries` 需要稳定提供以下字典：

1. `roles`
2. `userStatuses`
3. `partnerLevels`
4. `partnerStatuses`
5. `registrationStatuses`
6. `opportunityStages`
7. `quoteStatuses`
8. `orderStatuses`
9. `regions`
10. `bigRegions`
11. `timeFields`

每个字典项建议包含：

1. `value`
2. `label`
3. `sort`
4. `enabled`

## 6.8 样例数据和权限矩阵

联软 CRM 需要继续提供并维护以下测试资料：

1. 四类角色测试账号：
   - 超管
   - 区域管理员
   - 渠道管理员
   - 员工
2. 每类账号可见的数据总量。
3. 六类对象详情样例 ID。
4. 应可见 / 应不可见权限矩阵。
5. 至少 10 条典型自然语言分析问题及预期结果口径。
6. 样例数据更新说明，避免双方拿过期 ID 反复排查。

## 6.9 企微身份映射资料

如果要继续接企业微信入口，联软 CRM 需要补充：

1. CRM 用户 ID 与企业微信 `userid` 的映射来源。
2. 企业微信手机号是否可与 CRM 用户手机号唯一匹配。
3. 企业微信部门与 CRM 区域 / 渠道 / 组织的对应关系。
4. 映射失败时的处理方式。
5. 是否允许 AI-agent 保存一份映射表。

---

## 7. AI-agent 我方需要完成的事项

## 7.1 登录与身份落位

我方需要完成：

1. 接入联软正式真实登录接口。
2. 支持正式 `CRM_OPEN_API_LOGIN_PATH`。
3. 支持 `corp_id`、`device`、`version_code` 等参数。
4. 登录成功后按 `user_id` 调用身份查询 API。
5. 把联软用户角色、区域、渠道、负责人范围映射为 AI-agent 的统一权限上下文。
6. 保留 mock 登录灰度开关，避免正式联调失败影响本地开发。
7. 补充真实登录成功、失败、账号禁用、待审批等页面提示。

## 7.2 标准 OpenAPI 多用户适配

我方需要根据双方最终方案实现：

1. 若采用多 client 凭证：
   - 增加“登录用户 / 角色 -> client 凭证”的映射配置。
   - 按当前登录用户选择对应标准 API client。
   - 联调四类角色智能分析视角。
2. 若采用用户态 token：
   - 标准 API 客户端支持真实登录 `user_token` 鉴权。
   - 移除单 client 绑定用户限制。
   - 每次查询按当前登录用户实时权限访问。

## 7.3 渠道 CRM 语义层

我方需要补一层“联软渠道 CRM 语义层”，把自然语言问题映射到联软业务对象：

| 我方统一语义 | 联软对象与字段 |
|---|---|
| 客户 | 优先映射 `registrations.customer / customerName` |
| 渠道 | 映射 `partners` 及各对象 `partnerId / assignedPartnerId` |
| 商机 | 映射 `opportunities` |
| 报价 | 映射 `quotes` |
| 订单 / 成交 | 映射 `orders` |
| 合同转化 | 第一阶段暂按 `quotes -> orders` 或 `opportunities -> orders` 近似 |
| 区域 | 映射 `region` |
| 大区 | 映射 `bigRegion` |
| 负责人 | 映射 `assignedStaffId / ownerId / createdBy` |

需要注意：

1. `registrations` 不能简单等同于稳定客户主数据，需要明确叫“客户报备 / 客户入口”。
2. `quotes` 不能直接等同于合同审批对象，只能作为报价或合同前置对象。
3. `orders` 可作为成交 / 订单结果对象。
4. 合同审核能力暂不纳入本次完整智能分析主线，后续单独评估。

## 7.4 智能分析执行器扩展

我方需要把当前首批商机分析执行器扩展为多对象执行器：

1. `opportunities`：商机金额、数量、阶段分布、负责人排名、区域趋势。
2. `partners`：渠道数量、渠道层级、渠道贡献。
3. `registrations`：报备数量、状态分布、报备转商机。
4. `quotes`：报价数量、报价状态、报价关联商机。
5. `orders`：订单数量、订单金额、订单状态、成交趋势。
6. 跨对象漏斗：报备 -> 商机 -> 报价 -> 订单。

每类执行器都需要：

1. 时间过滤。
2. 权限范围过滤。
3. 区域 / 渠道 / 负责人过滤。
4. 字典翻译。
5. 指标卡。
6. 图表数据。
7. 明细表。
8. 数据来源说明。
9. 异常和空状态提示。

## 7.5 AI 意图与模板问题补齐

我方需要补充适合联软渠道 CRM 的自然语言问题样例：

1. 最近一个月山东区商机情况。
2. 本季度各渠道商机金额排名。
3. 最近三个月报备转商机情况。
4. 本月报价状态分布。
5. 本季度订单金额趋势。
6. 各区域订单贡献对比。
7. 某渠道从报备到订单的转化漏斗。
8. 员工个人可见范围内的商机风险。
9. 大区维度商机和订单趋势。
10. 报备未转商机的客户清单。

这些样例需要进入：

1. AI 意图解析提示词。
2. 查询模板。
3. 回归测试。
4. 页面直测清单。

## 7.6 页面化联调诊断

我方需要补一个联软 CRM 接入诊断页面，供实施和运维人员直接页面测试：

1. 标准 API 总诊断。
2. 当前绑定 client / 当前登录用户。
3. 权限范围展示。
4. 字典完整度。
5. 六类对象列表测试。
6. 六类对象详情测试。
7. 角色视角测试。
8. 智能分析试跑入口。
9. 最近一次错误原因。
10. 对方 `requestId` 回显。

## 7.7 审计与排障增强

我方需要保证所有联软 CRM 分析调用都可追踪：

1. 记录本次使用的 CRM 用户 ID。
2. 记录使用的标准 API 鉴权模式。
3. 记录调用的资源和筛选条件。
4. 记录执行来源为 `CRM_OFFICIAL_API`。
5. 记录是否发生降级。
6. 记录联软返回的 `requestId`。
7. 不记录 `appSecret`、`user_token`、密码等敏感信息。

## 7.8 部署配置补齐

我方需要补齐生产部署配置清单：

1. `CRM_STANDARD_OPEN_API_BASE_URL`
2. `CRM_STANDARD_OPEN_API_APP_KEY`
3. `CRM_STANDARD_OPEN_API_APP_SECRET`
4. `CRM_STANDARD_OPEN_API_TIMEOUT_MS`
5. `CRM_STANDARD_OPEN_API_TOKEN_CACHE_BUFFER_SECONDS`
6. `CRM_OPEN_API_BASE_URL`
7. `CRM_OPEN_API_LOGIN_PATH`
8. `CRM_OPEN_API_CORP_ID`
9. `CRM_OPEN_API_DEVICE`
10. `CRM_OPEN_API_VERSION_CODE`
11. `CRM_OPEN_API_TIMEOUT_MS`
12. `CRM_AUTH_IDENTITY_API_BASE_URL`
13. `CRM_AUTH_IDENTITY_API_USER_PATH`
14. `CRM_AUTH_IDENTITY_API_AUTH_MODE`
15. `CRM_AUTH_IDENTITY_API_TIMEOUT_MS`

---

## 8. 推荐推进阶段

## 8.1 阶段一：标准 API 稳定基线

目标：确保六类对象查询稳定，权限矩阵稳定。

联软 CRM 需要：

1. 确认标准 API 地址不变。
2. 确认 4 组 client 凭证有效。
3. 确认六类对象样例 ID 有效。
4. 确认字典完整。
5. 确认权限矩阵与页面权限一致。

AI-agent 需要：

1. 保持标准 API 诊断接口可用。
2. 补页面化诊断入口。
3. 补生产配置样例。

验收标准：

1. 四类角色诊断通过。
2. 六类对象列表和详情通过。
3. 权限矩阵全部匹配。

## 8.2 阶段二：正式真实登录闭环

目标：真实账号登录 AI-agent 后，能落位到正确 CRM 身份与权限。

联软 CRM 需要：

1. 开放正式登录接口。
2. 提供身份查询 API。
3. 确认正式账号和密码策略。
4. 确认成功 / 失败响应样例。

AI-agent 需要：

1. 接入正式登录路径。
2. 接入身份查询 API。
3. 完成四类真实账号页面登录验证。
4. 登录后展示正确角色和权限范围。

验收标准：

1. 超管、区域管理员、渠道管理员、员工账号均可登录。
2. 待审批 / 禁用 / 密码错误账号返回友好提示。
3. 登录后权限范围与联软 CRM 页面一致。

## 8.3 阶段三：首批完整智能分析

目标：真实用户可以完成首批核心渠道 CRM 智能分析。

建议首批问题：

1. 最近一个月山东区商机情况。
2. 本季度各渠道商机金额排名。
3. 本月商机阶段分布。
4. 最近三个月报备转商机情况。
5. 本季度报价状态分布。
6. 本季度订单金额趋势。
7. 各渠道订单贡献排名。
8. 报备 -> 商机 -> 报价 -> 订单转化漏斗。

联软 CRM 需要：

1. 确认以上问题涉及字段都可通过标准 API 获取。
2. 如分页性能不足，提供聚合接口或提高筛选能力。
3. 提供每个问题的样例数据和预期口径。

AI-agent 需要：

1. 扩展多对象分析执行器。
2. 补联软渠道 CRM 语义层。
3. 补查询模板和 AI 意图样例。
4. 补页面直测和回归测试。

验收标准：

1. 每个问题在 4 类角色下均能返回符合权限的数据。
2. 页面展示指标卡、图表、表格和 AI 摘要。
3. 空数据、无权限、接口失败、超时都有明确中文提示。

## 8.4 阶段四：企业微信入口

目标：企业微信用户也可以按 CRM 权限完成智能分析。

联软 CRM 需要：

1. 提供企业微信用户与 CRM 用户映射规则。
2. 提供手机号 / userid 唯一匹配规则。
3. 确认映射失败处理方式。

AI-agent 需要：

1. 接入企微身份映射。
2. 复用 Web 智能分析能力。
3. 补企业微信问数回复格式。
4. 补企微权限阻断和审计。

验收标准：

1. 企微用户能被唯一映射到 CRM 用户。
2. 企微问数结果与 Web 同账号同权限一致。

## 8.5 阶段五：性能与生产化

目标：满足真实生产数据量和并发要求。

双方需要共同完成：

1. 确认最大数据量。
2. 确认接口限流策略。
3. 确认超时策略。
4. 确认慢查询和大分页处理方式。
5. 确认生产白名单。
6. 确认日志和 `requestId` 排障流程。
7. 评估是否需要 MySQL / PostgreSQL 分析镜像库。

---

## 9. 双方分工总表

| 工作项 | 联软 CRM | AI-agent |
|---|---|---|
| 标准 OpenAPI 六类对象 | 提供并维护接口、字段、权限 | 已接入，继续扩展诊断和分析 |
| 正式真实登录 | 开放正式接口和响应契约 | 接入登录和会话 |
| 身份查询 | 提供按 `user_id` 查身份 API | 映射为统一 `CrmUser` |
| 多用户权限分析 | 提供用户态 token 或多 client 凭证 | 按登录用户选择鉴权和权限上下文 |
| 字段字典 | 提供稳定完整字典 | 做中文展示和口径翻译 |
| 渠道 CRM 语义层 | 确认对象关系和业务口径 | 实现语义映射和 AI prompt |
| 智能分析执行器 | 提供可查询数据和筛选能力 | 实现聚合、趋势、排行、漏斗 |
| 页面诊断 | 配合验证样例和 requestId | 实现诊断页面 |
| 企微映射 | 提供 CRM 用户与企微用户映射 | 接入企微问数入口 |
| 性能生产化 | 提供接口限流、索引和聚合能力 | 做缓存、超时、降级和审计 |

---

## 10. 需要联软 CRM 优先回复的问题

请联软 CRM 优先确认以下问题：

1. 正式真实登录接口是否已开放？正式路径是什么？
2. 登录接口是否必须传 `corp_id`？固定值是什么？
3. 登录成功后的 `user_token` 是否可用于标准 OpenAPI 查询？
4. 标准 OpenAPI 是否支持用户态 `user_token` 鉴权？
5. 如果不支持用户态 token，是否能为每类角色或每个用户提供独立 client 凭证？
6. 身份查询 API 正式路径是什么？
7. `identity/users/{userId}` 是否能返回角色、区域、渠道、负责人范围？
8. 六类对象是否都包含金额字段？尤其 `quotes.amount`、`orders.amount` 是否可提供？
9. `registrations -> opportunities -> quotes -> orders` 的关联字段是否稳定？
10. 是否可以提供 8 到 10 条典型自然语言问题及预期统计口径？
11. 分页列表最大 `pageSize` 和最大可翻页数量是多少？
12. 是否计划提供聚合分析接口？
13. 是否有企业微信 `userid` 与 CRM 用户的映射字段？

---

## 11. AI-agent 优先落地清单

我方建议按以下顺序落地：

1. 补联软 CRM 页面化诊断入口。
2. 补生产配置示例中的 `CRM_STANDARD_OPEN_API_*`。
3. 接入正式真实登录和身份查询 API。
4. 实现标准 API 多用户鉴权模式。
5. 扩展联软渠道 CRM 语义层。
6. 扩展 `registrations / partners / quotes / orders` 智能分析执行器。
7. 补首批 8 个自然语言问题模板。
8. 补四类角色权限视角的页面直测记录。
9. 补企业微信身份映射方案。
10. 评估生产性能和是否需要分析镜像库。

---

## 12. 第一批验收问题建议

建议第一批完整智能分析验收使用以下问题：

1. 最近一个月山东区商机情况。
2. 最近一个月山东区商机阶段分布。
3. 本季度各渠道商机金额排名。
4. 本季度各销售负责人商机金额排名。
5. 最近三个月报备数量和转商机情况。
6. 本季度报价状态分布。
7. 本季度订单金额趋势。
8. 各渠道订单贡献排名。
9. 报备到订单的转化漏斗。
10. 员工账号查看自己可见范围内的商机风险。

每个问题至少验证：

1. 超管视角。
2. 区域管理员视角。
3. 渠道管理员视角。
4. 员工视角。
5. 数据来源说明。
6. 权限范围说明。
7. 图表和表格是否一致。
8. AI 摘要是否没有编造不存在的数据。

---

## 13. 结论

要实现“渠道 CRM 系统接入后可完整智能分析”，双方下一步重点不是继续讨论是否直连 SQLite，而是围绕标准 OpenAPI 和真实登录补齐生产闭环。

推荐路径如下：

1. 联软 CRM 继续封装 SQLite，对外提供稳定标准 API。
2. AI-agent 不直接依赖 SQLite 内部表结构。
3. 联软 CRM 补齐正式登录、身份查询、多用户权限 API 和跨对象关联字段。
4. AI-agent 补齐渠道 CRM 语义层、多对象分析执行器、页面诊断、模板和回归测试。
5. 双方用 4 类角色和 10 条典型自然语言问题完成首批验收。

完成以上内容后，才能从“标准 API 已联调”升级为“联软渠道 CRM 已完整接入智能分析”。

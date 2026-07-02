# 联软 CRM 第一阶段联调接口清单

## 1. 文档目的

本文档用于明确联软 CRM 与本项目 `AI-agent` 第一阶段联调的接口范围、联调顺序、验收口径和双方准备项。

第一阶段目标聚焦“只读查询联调”，优先打通以下能力：

1. 身份上下文获取
2. 权限范围识别
3. 基础字典读取
4. 六类业务对象查询
5. Web 问数与企业微信问数的最小可用链路

本阶段暂不纳入：

1. 企业微信扫码登录落位
2. 跟进写回
3. 新增客户 / 新增商机
4. 审批触发
5. 合同审核

## 2. 联调范围

本阶段以对方已提供的标准 API 契约为准：

- [AI-agent标准API契约.md](</D:/远程交付中心文件/建设材料/AI项目及frp/redclaw/lianruan-crm-deploy-v2.2.0_back202605271516/lianruan-crm-deploy-v2.2.0/docs/AI-agent标准API契约.md>)
- [AI-agent对接字段字典与适配清单.md](</D:/远程交付中心文件/建设材料/AI项目及frp/redclaw/lianruan-crm-deploy-v2.2.0_back202605271516/lianruan-crm-deploy-v2.2.0/docs/AI-agent对接字段字典与适配清单.md>)
- [联软CRM-AI-agent对接评估方案.md](D:/远程交付中心文件/建设材料/AI项目及frp/redclaw/CRM-Agent-master/crm-agent/docs/architecture/联软CRM-AI-agent对接评估方案.md)

本阶段对象范围：

1. `users`
2. `partners`
3. `registrations`
4. `opportunities`
5. `quotes`
6. `orders`

## 3. 联调前提

开始联调前，双方至少准备以下内容。

### 3.1 对方 CRM 需准备

1. 联调环境 Base URL
2. `appKey`
3. `appSecret`
4. OpenAPI 白名单 IP
5. 至少 2 个可用测试账号对应的 client 绑定关系
6. 六类对象的联调测试数据
7. 接口调用日志或审计日志查询方式

### 3.2 我方 AI-agent 需准备

1. API 接入配置项
2. 统一认证封装
3. 用户上下文适配层
4. 字典适配层
5. 六类对象查询适配层
6. 第一阶段问数主题映射

## 4. 接口优先级

建议按以下优先级联调，不要一开始并行打所有接口。

### P0：必须先通

1. `POST /auth/token`
2. `GET /auth/me`
3. `GET /meta/permission-scope`
4. `GET /meta/dictionaries`

### P1：第一批业务对象

1. `GET /users`
2. `GET /users/{id}`
3. `GET /partners`
4. `GET /partners/{id}`

### P2：问数主对象

1. `GET /registrations`
2. `GET /registrations/{id}`
3. `GET /opportunities`
4. `GET /opportunities/{id}`
5. `GET /quotes`
6. `GET /quotes/{id}`
7. `GET /orders`
8. `GET /orders/{id}`

## 5. 逐接口联调清单

## 5.1 鉴权接口

### 5.1.1 获取访问令牌

- 接口：`POST /auth/token`
- 用途：
  1. 获取后续调用所需 `accessToken`
  2. 校验 `appKey` / `appSecret` 是否可用
  3. 确认绑定 CRM 用户上下文是否正确
- 我方联调要点：
  1. Token 获取成功
  2. `expiresIn`、`tokenType` 字段稳定
  3. `boundUser` 结构完整
- 验收口径：
  1. 成功返回 `code=0`
  2. 返回 `accessToken`
  3. 返回绑定用户 `id/name/role/region/partnerId/status`

### 5.1.2 获取当前身份上下文

- 接口：`GET /auth/me`
- 用途：
  1. 获取当前 OpenAPI client 和绑定用户信息
  2. 作为我方统一“当前 CRM 用户上下文”的事实来源
- 我方联调要点：
  1. `client.allowedResources` 是否符合授权范围
  2. `user` 信息是否与 `token` 接口返回一致
- 验收口径：
  1. `client`、`user` 两个对象都返回
  2. 返回的用户字段可直接用于我方会话映射

## 5.2 元数据接口

### 5.2.1 获取当前权限范围

- 接口：`GET /meta/permission-scope`
- 用途：
  1. 识别当前绑定用户是全量、区域、渠道还是人员范围
  2. 作为我方问数前置提示和结果治理的权限事实来源
- 我方联调要点：
  1. `scopeType` 是否稳定
  2. `regions`、`partnerIds`、`userIds` 是否与实际账号口径一致
- 验收口径：
  1. 至少支持 `all`、`region`、`partner`、`user` 中的实际可用类型
  2. 同账号多次请求返回一致

### 5.2.2 获取字典

- 接口：`GET /meta/dictionaries`
- 用途：
  1. 获取角色、状态、渠道层级等字典
  2. 避免我方硬编码状态值
- 我方联调要点：
  1. 角色字典是否完整
  2. `registrationStatuses` 是否完整
  3. 是否补充 `opportunityStages`、`quoteStatuses`、`orderStatuses`
- 验收口径：
  1. 至少返回 `roles`、`partnerLevels`、`registrationStatuses`
  2. 最好补齐商机阶段、报价状态、订单状态

## 5.3 用户接口

### 5.3.1 用户列表

- 接口：`GET /users`
- 用途：
  1. 权限预览
  2. 用户检索
  3. 后续企微用户映射诊断的基础数据来源
- 我方联调要点：
  1. `role` 过滤可用
  2. `keyword` 搜索可用
  3. 权限范围内结果裁剪正确
- 验收口径：
  1. 返回字段覆盖 `id/username/name/role/region/bigRegion/partnerId/partnerName/status`
  2. 分页字段正常

### 5.3.2 用户详情

- 接口：`GET /users/{id}`
- 用途：
  1. 查询单个用户详情
  2. 诊断绑定关系
- 我方联调要点：
  1. 越权查询是否被阻断
  2. 用户不存在时错误码是否稳定
- 验收口径：
  1. 正常账号返回对象详情
  2. 非法 ID 返回明确错误

## 5.4 渠道接口

### 5.4.1 渠道列表

- 接口：`GET /partners`
- 用途：
  1. 渠道组织结构识别
  2. 区域 / 渠道问数过滤
  3. 后续把渠道树映射成我方可消费的组织层
- 我方联调要点：
  1. `partnerLevel`、`parentPartnerId`、`parentPartnerIds` 是否稳定
  2. 区域过滤是否生效
- 验收口径：
  1. 返回字段覆盖 `id/name/partnerLevel/parentPartnerId/parentPartnerIds/region/bigRegion/status`
  2. 能区分一级 / 二级渠道

### 5.4.2 渠道详情

- 接口：`GET /partners/{id}`
- 用途：
  1. 查看单个渠道详情
  2. 后续组织映射和权限调试
- 我方联调要点：
  1. 父子渠道关系是否完整
  2. 联系方式和状态字段是否稳定
- 验收口径：
  1. 单个渠道详情可稳定返回

## 5.5 报备接口

### 5.5.1 报备列表

- 接口：`GET /registrations`
- 用途：
  1. 客户报备查询
  2. 客户主入口问数
  3. 客户到商机链路分析
- 我方联调要点：
  1. `customer`、`contact`、`phone` 搜索效果
  2. `status` 过滤效果
  3. `partnerId` 与权限边界一致性
- 验收口径：
  1. 返回字段覆盖 `id/customer/contact/phone/creditCode/status/createdBy/assignedStaffId/partnerId/region/createdAt`

### 5.5.2 报备详情

- 接口：`GET /registrations/{id}`
- 用途：
  1. 单条报备详情
  2. 识别客户、负责人、区域、渠道归属
- 我方联调要点：
  1. `estimatedAmt`、`signDate` 是否稳定
  2. `assignedPartnerId`、`assignedStaffId` 是否可用
- 验收口径：
  1. 返回详情足够支持客户详情问答

## 5.6 商机接口

### 5.6.1 商机列表

- 接口：`GET /opportunities`
- 用途：
  1. 商机问数主对象
  2. 阶段分析、金额分析、负责人分析
- 我方联调要点：
  1. `status` 实际过滤 `stage`，需确认对方实现一致
  2. `amount`、`expectedClose` 字段是否稳定
  3. `assignedStaffId`、`partnerId` 是否与权限逻辑一致
- 验收口径：
  1. 返回字段覆盖 `id/name/customer/stage/amount/expectedClose/assignedStaffId/partnerId/regId/quoteId/createdAt`

### 5.6.2 商机详情

- 接口：`GET /opportunities/{id}`
- 用途：
  1. 单条商机详情
  2. 后续支持结果详情页、解释型问答
- 我方联调要点：
  1. `ownerId` 与 `assignedStaffId` 是否存在差异
  2. `followUps`、`tags` 是否稳定
- 验收口径：
  1. 返回详情足够支撑商机详情分析

## 5.7 报价接口

### 5.7.1 报价列表

- 接口：`GET /quotes`
- 用途：
  1. 报价查询
  2. 商机到报价链路分析
- 我方联调要点：
  1. `oppId` 与 `oppIds` 的兼容关系
  2. `status` 字段可用性
- 验收口径：
  1. 返回字段覆盖 `id/oppId/oppIds/partnerId/assignedStaffId/status/createdAt`

### 5.7.2 报价详情

- 接口：`GET /quotes/{id}`
- 用途：
  1. 单条报价详情
  2. 判断是否可映射到后续审查或明细问答
- 我方联调要点：
  1. 扩展字段是否稳定
  2. 是否存在 `customerName`、`totalAmount` 等常用字段
- 验收口径：
  1. 至少能稳定返回核心字段和主要扩展字段

## 5.8 订单接口

### 5.8.1 订单列表

- 接口：`GET /orders`
- 用途：
  1. 订单查询
  2. 成交结果分析
  3. 渠道订单归属分析
- 我方联调要点：
  1. `parentPartnerId`、`assignedPartnerId` 关系
  2. `deliveryAddr` 是否可检索
- 验收口径：
  1. 返回字段覆盖 `id/partnerId/parentPartnerId/assignedPartnerId/assignedStaffId/status/createdAt`

### 5.8.2 订单详情

- 接口：`GET /orders/{id}`
- 用途：
  1. 单条订单详情
  2. 后续成交类分析结果详情
- 我方联调要点：
  1. 扩展字段稳定性
  2. 是否存在 `customerName`、`quoteId`、`deliveryAddr`
- 验收口径：
  1. 至少能稳定返回核心字段和常用扩展字段

## 6. 建议联调顺序

建议按以下步骤推进：

1. 先联调 `auth/token`
2. 再联调 `auth/me`
3. 再联调 `meta/permission-scope`
4. 再联调 `meta/dictionaries`
5. 再联调 `users`、`partners`
6. 再联调 `registrations`、`opportunities`
7. 最后联调 `quotes`、`orders`
8. 六类对象都通后，再挂接我方问数主题映射

## 7. 我方第一阶段接入建议

我方第一阶段建议只消费以下能力：

1. 当前身份上下文
2. 权限范围
3. 角色 / 状态 / 渠道层级字典
4. 六类对象的列表与详情

我方第一阶段建议优先开放以下问数主题：

1. 区域商机金额
2. 商机阶段分布
3. 渠道商机排行
4. 客户报备数量与状态
5. 报价数量与状态
6. 订单数量与状态

## 8. 第一阶段验收口径

满足以下条件即可视为第一阶段联调通过：

1. `auth/token`、`auth/me` 正常可用
2. `meta/permission-scope`、`meta/dictionaries` 正常可用
3. 六类对象列表与详情接口正常可用
4. 权限边界与 CRM 页面口径一致
5. 错误码、分页、`requestId` 返回稳定
6. 我方可基于这些接口完成至少 6 个主题的只读问数验证

## 9. 联调记录建议

建议双方联调时统一记录以下内容：

1. 调用时间
2. 接口路径
3. 请求参数
4. 返回 `requestId`
5. 是否命中权限裁剪
6. 是否与 CRM 页面结果一致
7. 差异说明
8. 处理人


# 联软CRM-对方增强后业务链核对记录

## 1. 核对范围

本次核对基于联软 CRM 新提供的三份材料：

1. `联软CRM-完整智能分析接入我方方案与计划.md`
2. `联软CRM-OpenAPI增强实施与自测记录.md`
3. `AI-agent标准API契约.md`

核对目标是确认“真实登录 / 标准 OpenAPI / 六类对象 / 统计分析 / 智能分析展示”这条业务链是否可以闭环。

## 2. 结论摘要

当前方向正确，标准 OpenAPI 继续作为正式接入边界是合理的，不建议生产链路直连 SQLite。

但当前业务链还没有完全闭环，主要原因有三类：

1. 对方新增接口尚未发布到当前 `3000` 联调服务。
2. 身份查询接口的鉴权方式与真实登录链路仍需确认。
3. 报价、订单、渠道金额字段与契约中的 `amount` 命名不完全一致，我方已补兼容。

## 3. 当前实测结果

当前我方本地配置指向的标准 OpenAPI 服务仍为 `http://10.18.16.114:3000/api/open/v1`。

已验证可用：

1. `POST /auth/token`
2. `GET /auth/me`
3. `GET /meta/permission-scope`
4. `GET /meta/dictionaries`
5. 六类对象列表接口仍可访问

当前 `3000` 上尚不可用：

1. `GET /identity/users/{userId}`
2. `GET /diagnostics/self-check`
3. `GET /analytics/{resource}/summary`
4. `GET /analytics/funnel/registration-opportunity-order`
5. `GET /analytics/partners/contribution`

实测结果均为 `404`。结合对方文档“临时端口 3012 自测、未重启当前 3000 联调服务”的说明，判断这些增强尚未发布到当前联调服务。

## 4. 业务链核对

### 4.1 标准 OpenAPI 基线

状态：基本可用。

当前 `auth/token`、`auth/me`、`permission-scope`、`dictionaries` 和六类对象列表可用，能支撑第一阶段六类对象查询。

注意点：

1. 当前 `meta/dictionaries` 尚未在 `3000` 返回 `regions`、`bigRegions`，仍是旧字典集合。
2. 对方增强后的筛选和统计接口需要等 `3000` 发布后再复测。

### 4.2 真实登录与身份查询

状态：链路设计可行，但契约仍需确认。

对方新增的 `GET /api/open/v1/identity/users/{userId}` 写在标准 OpenAPI 下，鉴权方式是：

```text
Authorization: Bearer {accessToken}
```

我方真实登录身份查询当前支持：

1. `crm-token`：复用真实登录返回的 `user_token`
2. `none`：白名单免鉴权

因此这里存在一个关键确认点：

1. 如果身份查询只允许标准 OpenAPI `accessToken`，它只能代表当前 client 绑定用户，不等于真实登录用户态权限。
2. 如果要服务真实登录闭环，需要确认真实登录返回的 `user_token` 是否也能调用身份查询或标准 OpenAPI。
3. 如果 `user_token` 不能调用标准 OpenAPI，则生产多用户分析仍需要“真实登录用户 -> 角色/用户 -> 对应 client”的映射策略。

### 4.3 六类对象字段

状态：大体可用，但金额字段命名存在差异。

当前 `3000` 实测字段：

1. `opportunities` 有 `amount`
2. `quotes` 主要是 `total`、`originalTotal`、`discountAmount`
3. `orders` 主要是 `total`
4. `partners` 有 `totalAmt`
5. `registrations` 当前列表未见 `estimatedAmt`，但详情契约中有

我方已补充金额字段兼容：

```text
amount / totalAmount / orderAmount / quoteAmount / contractAmount / total / totalAmt / originalTotal / estimatedAmt / price / total_price
```

这样订单、报价、渠道相关分析不会因为字段不是 `amount` 而只统计数量。

### 4.4 智能分析执行链

状态：首批列表聚合可跑，统计接口待接。

当前我方已支持通过六类对象列表做首批聚合：

1. 商机
2. 客户报备
3. 渠道
4. 报价
5. 订单

已支持结果形态：

1. 总览
2. 负责人排名
3. 时间趋势
4. 状态 / 阶段 / 等级分布
5. 区域贡献

待对方 `analytics` 接口发布后，建议我方第二步接入对方统计接口：

1. 单对象摘要优先走 `/analytics/{resource}/summary`
2. 转化漏斗优先走 `/analytics/funnel/registration-opportunity-order`
3. 渠道贡献优先走 `/analytics/partners/contribution`

这样可以减少分页拉全量，提升生产稳定性。

## 5. 当前主要问题清单

| 优先级 | 问题 | 影响 | 建议 |
|---|---|---|---|
| P0 | 新增接口未发布到当前 `3000` | 身份查询、诊断、统计接口当前不可用 | 请对方在联调窗口重启或发布 `3000` 服务后，我方再复测 |
| P0 | 真实登录用户态 token 是否能访问标准 OpenAPI 未确认 | 多用户真实智能分析无法闭环 | 请对方明确 `user_token` 是否支持 `/api/open/v1` |
| P0 | 身份查询鉴权方式与我方真实登录身份查询配置不完全一致 | 真实登录后可能查不到用户权限上下文 | 若走标准 OpenAPI Bearer，需要我方增加对应模式；若走 user_token，请对方明确请求头 |
| P1 | 统计接口契约已有，但我方尚未接入 | 大数据量下仍需分页聚合 | 待 `3000` 发布后优先接入 summary、funnel、partner contribution |
| P1 | 契约前文仍写“统计分析接口为第二阶段预留”，后文又写“已补充” | 文档理解容易混乱 | 建议对方统一契约版本，明确哪些接口已经可联调 |
| P1 | 报价/订单金额字段实际为 `total`，不完全是 `amount` | 金额分析可能丢值 | 我方已兼容，建议对方契约也写清字段别名和口径 |

## 6. 对方需要先做的确认

建议发给对方确认：

1. 新增接口是否已发布到 `10.18.16.114:3000`？如果没有，预计什么时候重启或发布？
2. `GET /identity/users/{userId}` 正式鉴权到底使用哪一种：
   - 标准 OpenAPI `Bearer accessToken`
   - 真实登录 `user_token`
   - 白名单免鉴权
3. 真实登录返回的 `user_token` 是否可以直接访问 `/api/open/v1` 六类对象和统计接口？
4. 如果不能，是否确认采用“四类角色 / 用户映射到对应 client”的过渡方案？
5. `quotes.total`、`orders.total`、`partners.totalAmt` 是否就是报价金额、订单金额、渠道累计金额的正式口径？
6. `analytics` 三类接口是否已具备完整 `requestId` 和权限裁剪日志？
7. 当前 `meta/dictionaries` 是否会补 `regions`、`bigRegions` 到 `3000` 正式联调服务？

## 7. 我方已处理

1. 已保留标准 OpenAPI 作为正式接入边界，不直连 SQLite。
2. 已完成六类对象首批列表聚合适配。
3. 已保留标准 API 绑定用户一致性校验，避免普通用户借超管 client 扩权。
4. 已补充报价、订单、渠道金额字段兼容。
5. 已通过后端构建和联软分析执行器回归测试。

## 8. 下一步建议

建议按以下顺序推进：

1. 先让对方把增强接口发布到 `3000`。
2. 我方复测新增接口：身份查询、诊断、四个 summary、漏斗、渠道贡献。
3. 我方补标准 OpenAPI 身份查询鉴权模式，或确认继续使用真实登录 `user_token` 模式。
4. 我方接入 `analytics` 统计接口作为优先数据源，列表分页聚合作为兜底。
5. 再做四类账号真实角色视角的页面智能分析验证。

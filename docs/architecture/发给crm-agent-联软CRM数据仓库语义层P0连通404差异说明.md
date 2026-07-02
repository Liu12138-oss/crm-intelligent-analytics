# 发给 crm-agent：联软 CRM 数据仓库语义层 P0 连通 404 差异说明

> 日期：2026-06-09  
> 对应材料：《联软CRM-数据仓库语义层P0连通验证记录》  
> 用途：说明本轮 P0 连通验证中 `customers`、`role-permissions`、`auth/permission-scope`、客户分析接口返回 404 的原因判断和处理方式。  
> 说明：本文不包含明文 `appSecret`、Token、数据库密码或生产库连接信息。

---

## 1. 结论

贵方验证记录中返回 404 的接口，在联软 CRM 当前代码和最新升级包中已经存在。

本轮 404 更可能是：

```text
10.18.16.114:3000 当前运行进程仍是旧版本
或升级包尚未部署 / 部署后服务未重启
```

不是接口设计取消，也不是 Base URL 变更。

---

## 2. 本轮 404 接口状态

| 接口 | 文档声明 | 当前最新代码 | 最新升级包 | 判断 |
|---|---|---|---|---|
| `GET /meta/role-permissions` | 应可用 | 已存在 | 已包含 | 联调机疑似旧版本 |
| `GET /customers` | 应可用 | 已存在 | 已包含 | 联调机疑似旧版本 |
| `GET /auth/permission-scope` | 兼容路径，应可用 | 已存在 | 已包含 | 联调机疑似旧版本 |
| `GET /analytics/customers/lifecycle` | 应可用 | 已存在 | 已包含 | 联调机疑似旧版本 |

对应完整路径均基于：

```text
http://10.18.16.114:3000/api/open/v1
```

例如：

```http
GET /api/open/v1/customers
GET /api/open/v1/meta/role-permissions
GET /api/open/v1/auth/permission-scope
GET /api/open/v1/analytics/customers/lifecycle
```

---

## 3. 最新升级包已包含的路由标记

最新升级包内 `files/backend/server.js` 已包含以下路由：

```text
app.get('/api/open/v1/auth/permission-scope', ...)
app.get('/api/open/v1/meta/role-permissions', ...)
app.get('/api/open/v1/customers', ...)
app.get('/api/open/v1/customers/:id', ...)
app.get('/api/open/v1/customers/:id/:relatedResource', ...)
app.get('/api/open/v1/analytics/customers/lifecycle', ...)
app.get('/api/open/v1/analytics/customers/unregistered-opportunity', ...)
app.get('/api/open/v1/analytics/customers/idle', ...)
```

---

## 4. 需要联软 CRM 侧处理

建议在 `10.18.16.114` 联调机执行最新升级包，并确认服务重启成功。

升级包：

```text
upgrade-package/openapi-ui-management-upgrade-v2.2.0-20260608.zip
```

执行目录建议：

```bash
cd /home/liulonghai/tmp
unzip -o openapi-ui-management-upgrade-v2.2.0-20260608.zip
cd openapi-ui-management-upgrade-v2.2.0-20260608
bash upgrade.sh /home/liulonghai/lianruan-crm-deploy-v2.2.0
```

升级脚本已增强校验：

1. 静态检查 `server.js` 是否包含 P0 路由标记。
2. 启动后检查这些接口不再返回 404。
3. 未带 token 时预期可返回 `401`，只要不是 `404/000` 即代表路由已加载。

---

## 5. 升级后建议复测

升级并重启后，请重新验证：

```http
GET /api/open/v1/meta/role-permissions
GET /api/open/v1/customers?pageNo=1&pageSize=1
GET /api/open/v1/auth/permission-scope
GET /api/open/v1/analytics/customers/lifecycle
GET /api/open/v1/analytics/customers/unregistered-opportunity
GET /api/open/v1/analytics/customers/idle?pageNo=1&pageSize=1
```

未带 token 时，预期结果：

```text
HTTP 401 或 403，不能是 404。
```

带有效 token 时，预期结果：

```text
HTTP 200。
```

如果 `GET /customers` 返回 `403 resource not allowed`，说明服务已是新版本，但 client 的 `allowedResources` 未显式授权 `customers`。当前兼容规则允许已授权 `registrations` 的旧 client 访问 `customers`，如仍出现 403，请检查该 client 是否包含 `registrations`、`customers` 或 `*`。

---

## 6. 给 AI-agent 的临时说明

在联软 CRM 联调机完成升级前，AI-agent 可以先继续使用已通过的接口：

```text
users
partners
registrations
opportunities
quotes
orders
analytics/partners/contribution
meta/permission-scope
meta/dictionaries
diagnostics/self-check
```

但客户生命周期、未报备客户、客户视图入仓和角色权限矩阵建议等升级完成后再正式进入 P0 验收。

---

## 7. 当前判断

```text
404 原因不是接口方案不一致，而是联调机运行版本与最新文档/升级包不一致。
```

处理动作：

```text
部署最新升级包 -> 重启服务 -> 用 P0 连通清单复测 -> 再继续样例数据和权限矩阵实测。
```

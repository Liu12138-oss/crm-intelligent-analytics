# 联软 CRM 数据仓库语义层 P0 连通验证记录

> 验证日期：2026-06-09  
> 验证目标：确认联软 CRM 标准 OpenAPI 是否已满足 AI-agent 数据仓库、语义层和受控 Text-to-SQL 的 P0 同步前置条件。  
> 敏感信息说明：本文不记录 `appKey`、`appSecret`、Token、数据库密码或机器人密钥。

## 1. 总体结论

当前应先做并持续补做连通验证。验证结果表明：

1. 网络层已连通，`10.18.16.114:3000` 端口可访问。
2. 页面运行态配置中的 OpenAPI 凭证可成功换取 Token。
3. 当前联软服务可访问身份、权限范围、字典、诊断接口和 5 类业务对象。
4. 最新文档声明的 `customers` 客户视图、`meta/role-permissions` 角色权限矩阵、部分兼容/统计接口在当前服务上仍返回 404，需要联软 CRM 确认是否已部署、路径是否变更或当前 client 是否缺少资源授权。
5. 我方开发环境 `.env.development.local` 中保存的 OpenAPI 凭证与当前联软服务不一致，直接使用该文件会返回 `40113 appSecret invalid`；当前应用页面运行态配置可用，后续建议同步更新本地环境凭证或统一以治理页面配置为准。
6. 我方分析库 `ANALYSIS_WAREHOUSE_DB_*` 尚未配置，因此本轮只能验证 OpenAPI 和同步前置能力，不能完成 MySQL 分析库落库验证。

## 2. 已通过验证

| 验证项 | 结果 | 说明 |
|---|---|---|
| 网络端口 | 通过 | `10.18.16.114:3000` 可连接 |
| `POST /auth/token` | 通过 | 页面运行态配置可获取 Token，Token 有效期为 `7200` 秒 |
| `GET /auth/me` | 通过 | 当前绑定 client 为超管联调 client，绑定用户为 `A030 / liulonghai` |
| `GET /meta/permission-scope` | 通过 | 可读取当前 client 权限范围 |
| `GET /meta/dictionaries` | 通过 | 可读取字典，当前返回 11 组字典 |
| `GET /diagnostics/self-check` | 通过 | 可返回标准诊断结果 |
| `GET /users` | 通过 | 当前返回总数 `61` |
| `GET /partners` | 通过 | 当前返回总数 `174` |
| `GET /registrations` | 通过 | 当前返回总数 `150` |
| `GET /opportunities` | 通过 | 当前返回总数 `44` |
| `GET /quotes` | 通过 | 当前返回总数 `17` |
| `GET /orders` | 通过 | 当前返回总数 `2` |
| `GET /analytics/partners/contribution` | 通过 | 渠道贡献统计接口可访问 |

## 3. 当前未通过或需联软确认

| 验证项 | 当前结果 | 影响 | 建议处理 |
|---|---|---|---|
| `GET /meta/role-permissions` | 404 | 我方无法同步角色权限矩阵，权限桥表只能先依赖 `permission-scope` 和用户字段 | 请联软确认接口是否已部署、路径是否为最新契约，或是否需要重新授权 client |
| `GET /customers` | 404 | 客户只读视图无法入仓，未报备、未建商机、客户生命周期等分析会受影响 | 请联软确认客户视图是否已发布，或提供兼容路径/授权说明 |
| `GET /auth/permission-scope` | 404 | 兼容路径不可用，但不阻塞主流程 | 主路径 `GET /meta/permission-scope` 已可用，可删除兼容路径依赖或请联软补兼容 |
| `GET /analytics/customers/lifecycle` | 404 | 客户生命周期聚合接口不可用，相关问题需先通过明细入仓后本地聚合 | 请联软确认统计接口是否已部署，或我方先基于 `customers` 视图和业务对象本地建模 |
| `.env.development.local` 凭证 | `40113 appSecret invalid` | 重启或禁用页面运行态配置后可能回到无效凭证 | 请更新本地环境凭证，或确认页面运行态配置作为当前唯一有效配置 |
| `ANALYSIS_WAREHOUSE_DB_*` | 未配置 | 无法验证 MySQL ODS/DWD/语义层落库 | 我方需要配置独立 MySQL 分析库后再跑落库验证 |

## 4. 建议下一步

### 4.1 先请联软 CRM 确认

1. 当前 `10.18.16.114:3000` 服务是否已部署包含 `customers` 和 `meta/role-permissions` 的最新版本。
2. `GET /customers` 是否需要额外加入 `allowedResources`，或是否存在不同路径。
3. `GET /meta/role-permissions` 的正式路径是否仍为文档中的 `/meta/role-permissions`。
4. `GET /analytics/customers/lifecycle` 是否属于本阶段已发布接口。
5. 当前四组 client 的 `appSecret` 是否发生过重置；如已重置，请重新回传最新凭证。
6. 是否可以补充六类样例数据 ID、四类账号权限矩阵实测值和 20 条高频问题期望结果。

### 4.2 我方继续推进

1. 先用已通过接口继续验证 `users`、`partners`、`registrations`、`opportunities`、`quotes`、`orders` 的同步稳定性。
2. 配置 `ANALYSIS_WAREHOUSE_DB_*` 后验证 MySQL 建表、ODS 原始层落库、DWD 标准模型 upsert 和语义目录初始化。
3. 在 `customers` 未恢复前，客户相关问题先标记为受限能力，避免企微和 Web 报告误报“无数据”。
4. 在 `role-permissions` 未恢复前，权限矩阵先不固化为最终口径，只用当前 token 的 `permission-scope` 做临时权限校验。
5. 对本次 404 接口补联调记录，待联软重新部署或确认路径后按同一清单复测。

## 5. 当前判断

本阶段不是继续讨论方案，而是应该进入“接口连通验证 + 差异修正 + 分析库落库验证”的阶段。

当前 OpenAPI 主链路已经具备 P0 开始条件，但还不能视为完整闭环。完整闭环需要满足：

1. `customers` 客户视图可访问。
2. `meta/role-permissions` 角色权限矩阵可访问。
3. 我方 MySQL 分析库配置完成并通过落库验证。
4. 四类角色 client 都完成同题权限差异验证。
5. 20 条高频问题形成可回归的期望结果。

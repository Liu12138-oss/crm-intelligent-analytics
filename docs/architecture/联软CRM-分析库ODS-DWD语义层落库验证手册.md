# 联软 CRM 分析库 ODS/DWD/语义层落库验证手册

> 适用日期：2026-06-09  
> 适用范围：AI-agent 自建 MySQL 分析库、联软 CRM 标准 OpenAPI 同步、ODS 原始层、DWD 标准模型、语义字段/指标目录和受控 Text-to-SQL 验证。  
> 敏感信息说明：本文只写环境变量名和占位符，不记录数据库密码、OpenAPI 密钥、Token 或机器人密钥。

## 1. 当前状态

我方已补齐可执行的分析库落库验证链路：

1. `schema.sql` 会自动创建 ODS 同步记录表、ODS 原始快照表、同步检查点表、DWD 维表/事实表、权限桥表、语义字段目录和语义指标目录。
2. 后端已有 MySQL 分析库适配层，配置 `ANALYSIS_WAREHOUSE_DB_*` 后会自动建表。
3. 新增验证命令 `pnpm --dir backend verify:analysis-warehouse`，会复用后端现有同步服务，不另写一套业务同步逻辑。
4. 语义层 P0 种子已扩展到用户、服务商、客户、报备、商机、报价、订单和核心指标。
5. 受控 SQL 验证仍经过 SQL Guard，只允许访问 DWD/Facts/语义目录表，禁止访问 ODS 原始 JSON。

## 2. 需要先配置的分析库参数

在 `backend/.env.development.local` 或生产环境变量中补充：

```env
ANALYSIS_WAREHOUSE_DB_HOST=replace_with_analysis_warehouse_host
ANALYSIS_WAREHOUSE_DB_PORT=3306
ANALYSIS_WAREHOUSE_DB_NAME=crm_agent_analysis
ANALYSIS_WAREHOUSE_DB_USER=replace_with_analysis_warehouse_user
ANALYSIS_WAREHOUSE_DB_PASSWORD=replace_with_analysis_warehouse_password
ANALYSIS_WAREHOUSE_DB_CONNECT_TIMEOUT_MS=8000
```

数据库账号建议：

1. 只授权 `crm_agent_analysis` 这个独立库。
2. 首次建表阶段需要 `CREATE`、`ALTER`、`INDEX`、`INSERT`、`UPDATE`、`SELECT` 权限。
3. 稳定后可拆分同步账号和查询账号，但 P0 阶段先使用同一个受控账号降低联调复杂度。
4. 不要填写联软生产 SQLite 地址，也不要让 AI-agent 直接连接联软生产业务库。

## 3. 首轮验证命令

默认小批量验证：

```powershell
pnpm --dir backend verify:analysis-warehouse
```

默认同步资源：

```text
dictionaries
users
partners
registrations
opportunities
quotes
orders
permissions
```

说明：

1. 当前联软服务 `GET /customers` 和 `GET /meta/role-permissions` 仍待对方确认 404 问题，所以默认不纳入首轮落库验证。
2. 默认 `pageSize=50`、`maxPages=2`，用于验证链路，不代表全量同步。
3. 命令会输出分析库配置状态、同步结果、MySQL 落库概览和 3 条受控 SQL 抽样结果。

## 4. 对方修复 404 后复测命令

联软确认 `customers` 和 `role-permissions` 可访问后，执行：

```powershell
pnpm --dir backend verify:analysis-warehouse -- --include-contract-pending
```

如需指定资源：

```powershell
pnpm --dir backend verify:analysis-warehouse -- --resources=customers,rolePermissions --page-size=50 --max-pages=2
```

如需扩大同步页数：

```powershell
pnpm --dir backend verify:analysis-warehouse -- --page-size=200 --max-pages=20
```

## 5. 验证通过标准

| 验证项 | 通过标准 |
|---|---|
| 分析库配置 | 输出 `configured=true`，且显示正确的 host、port、database |
| 建表 | 首次运行不报建表错误，后续重复运行保持幂等 |
| ODS 原始层 | `ods_lianruan_raw_records` 按资源产生记录 |
| DWD 标准模型 | `dim_lianruan_user`、`dim_lianruan_partner`、`fact_lianruan_opportunity` 等表有对应记录 |
| 语义字段目录 | `semantic_field_catalog` 有用户、服务商、客户、报备、商机、报价、订单字段 |
| 语义指标目录 | `semantic_metric_catalog` 有服务商数量、客户数量、报备数量、商机数量/金额、报价数量/金额、订单数量/金额等指标 |
| 受控 SQL | 服务商数量、商机数量/金额、语义字段目录 3 条抽样查询可执行 |
| 审计边界 | 受控 SQL 不允许访问 ODS 原始 JSON，不允许 `SELECT *`，不允许多语句 |

## 6. 当前已知限制

1. `customers` 客户视图未通前，客户维度表会先为空，未报备客户、未建商机客户、客户生命周期等问题不能视为完整可用。
2. `meta/role-permissions` 未通前，角色权限矩阵不能固化为最终权限桥表，只能先同步当前 client 的 `permission-scope`。
3. 当前验证脚本使用页面运行态 OpenAPI 配置，因此如果页面配置可用但 `.env.development.local` 已过期，脚本仍能按页面配置验证；后续建议把有效凭证同步到受控环境变量或继续统一使用治理页面配置。
4. P0 同步默认小批量，真实全量同步需要结合联软接口性能、分页总量和业务时间窗口单独制定定时任务策略。

## 7. 失败排查

| 现象 | 可能原因 | 处理建议 |
|---|---|---|
| 提示分析库未配置 | 缺少 `ANALYSIS_WAREHOUSE_DB_*` | 补齐 MySQL 分析库环境变量后重试 |
| MySQL 连接失败 | 地址、端口、账号、密码或网络不通 | 用数据库客户端验证同一组配置，不在文档里粘贴密码 |
| 建表失败 | 账号缺少建表权限或库不存在 | 先创建独立库并补足建表权限 |
| OpenAPI 同步部分失败 | 联软接口 404、403 或 5xx | 结合资源结果反馈联软，已成功资源不需要回滚 |
| 受控 SQL 被阻断 | SQL 访问了未授权字段、使用 `SELECT *` 或函数不在白名单 | 改用语义字段目录中的字段，并让 AI 生成更受控的 SELECT |

## 8. 与后续智能分析的关系

落库验证通过后，后续智能分析链路应按以下顺序推进：

1. OpenAPI 定时同步写入 ODS。
2. ODS 上卷到 DWD 维表和事实表。
3. 语义层登记字段、指标、中文口径和敏感等级。
4. AI 先生成查询计划和候选 SQL。
5. 程序执行 SQL 安全校验、权限注入、超时、LIMIT 和审计。
6. 查询结果进入 AI 总结和企微/Web 报告展示。

这条链路可以让 AI 理解复杂问题，但不让 AI 直接碰生产库或绕过权限边界。

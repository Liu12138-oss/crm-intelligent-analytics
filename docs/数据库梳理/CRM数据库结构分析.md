# CRM数据库结构分析文档

## 1. 文档说明

- 数据源：`数据库.md` 中提供的只读 MySQL 连接信息。
- 分析范围：排除系统库后，实际业务库共 2 个。
- 输出方式：本文档负责总览分析，逐表字段明细见 `docs/db/` 目录。
- 安全说明：文档中不落地保存数据库明文密码。

## 2. 数据库总览

| 数据库 | 表数量 | 字段数量 | 索引数量 | 外键数量 | 预计总容量 | 无表注释占比 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `ikcrm_cms_production` | 29 | 572 | 67 | 0 | 1.05 MB | 100.0% |
| `vcooline_ikcrm_production` | 297 | 3316 | 1000 | 3 | 4.46 GB | 99.3% |

## 3. 结构分析结论

### 3.1 `ikcrm_cms_production`

- 该库只有 29 张表，体量很小，更像 CRM 外围的渠道/CMS/代理管理库，而不是主交易库。
- 典型表包括 `agents`、`agent_users`、`clients`、`risk_packages`、`sms_packages`、`upgrade_notices`。
- 业务重点偏向代理、客户套餐、通知和试用申请，适合承载官网/渠道侧配置。
- 表行数整体较小，说明该库以配置类和关系映射类数据为主。

### 3.2 `vcooline_ikcrm_production`

- 该库有 297 张表，是 CRM 主业务库，覆盖线索、客户、联系人、商机、合同、订单、回款、发票、费用、审批、知识库、通讯和生态集成。
- 存在大量按业务域拆分的资产表、附属表和映射表，如 `customer_assets`、`contract_assets`、`roles_users`、`users_departments`。
- 集成面较广，包含钉钉、企业微信、King、阿里等生态表，平台属性明显。
- 大表主要集中在日志、活动、资产和通知类表，运维和容量治理应优先关注这些热点对象。

### 3.3 设计特征

- 绝大多数表没有表注释，字段注释也较少，说明数据库自解释能力弱，后续维护更依赖应用代码和业务口径。
- 只有极少数外键约束，属于典型的“应用层保证关联关系”的互联网业务库设计。优点是写入灵活，缺点是数据一致性依赖业务代码。
- 命名总体采用复数英文表名，辅以 `_assets`、`_maps`、`_logs`、`_tracks`、`_reports` 等后缀，具备一定规则性。
- 多个业务实体采用主表 + 扩展表 + 审批表 + 通知映射表的组合模式，表明系统对审批流、提醒和附加字段扩展较重。

## 4. 模块分布

### 4.1 `ikcrm_cms_production`

| 模块 | 表数量 |
| --- | ---: |
| 其他支撑 | 12 |
| 渠道与代理 | 10 |
| 通信与触达 | 3 |
| CRM核心业务 | 2 |
| 生态集成 | 2 |

### 4.2 `vcooline_ikcrm_production`

| 模块 | 表数量 |
| --- | ---: |
| 其他支撑 | 63 |
| 生态集成 | 62 |
| CRM核心业务 | 58 |
| 通信与触达 | 28 |
| 财务结算 | 22 |
| 平台配置 | 19 |
| 报表分析 | 17 |
| 内容与知识 | 13 |
| 流程协同 | 6 |
| 日志与运维 | 6 |
| 渠道与代理 | 3 |

## 5. 大表与容量关注点

### 5.1 `ikcrm_cms_production`

| 表名 | 预估行数 | 预估容量 |
| --- | ---: | ---: |
| `clients` | 1 | 0.23 MB |
| `agent_users` | 0 | 0.06 MB |
| `clients_risk_packages` | 0 | 0.05 MB |
| `clients_sms_packages` | 0 | 0.05 MB |
| `sms_packages_sms_channels` | 0 | 0.05 MB |
| `telesale_assistants` | 0 | 0.05 MB |
| `users` | 0 | 0.05 MB |
| `client_profiles` | 0 | 0.03 MB |
| `dingding_upgrade_notices` | 0 | 0.03 MB |
| `insert_kebao_informations` | 0 | 0.03 MB |

### 5.2 `vcooline_ikcrm_production`

| 表名 | 预估行数 | 预估容量 |
| --- | ---: | ---: |
| `operation_logs` | 2176676 | 1.33 GB |
| `sales_activities` | 853996 | 647.03 MB |
| `token_logs` | 2406271 | 598.66 MB |
| `customer_assets` | 1132085 | 244.42 MB |
| `opportunity_assets` | 1020532 | 231.42 MB |
| `notifications` | 191277 | 218.44 MB |
| `contract_assets` | 889596 | 187.31 MB |
| `custom_fields` | 263865 | 179.30 MB |
| `archivers` | 28746 | 125.11 MB |
| `revisit_logs` | 144799 | 77.67 MB |

## 6. 风险与建议

1. 元数据治理偏弱。建议补齐核心表和关键字段注释，至少覆盖客户、商机、合同、订单、回款、权限相关表。
2. 主业务库存在较多超大日志/资产表。建议结合分区、归档和冷热分层策略优化 `operation_logs`、`token_logs`、`sales_activities` 等对象。
3. 外键约束很少，建议在应用侧补充关联完整性校验，并为关键映射表建立巡检 SQL。
4. 命名虽有规律，但仍存在并行命名，如 `callagents` 与 `call_agents`、`callcenters` 与 `call_centers`，建议评估历史兼容表并整理标准。
5. 由于 `ikcrm_cms_production` 和 `vcooline_ikcrm_production` 分别承担外围渠道与核心 CRM 职责，建议后续文档和开发也按此边界维护。

## 7. 明细文档

- `ikcrm_cms_production`：`docs/db/ikcrm_cms_production.md`
- `vcooline_ikcrm_production`：`docs/db/vcooline_ikcrm_production.md`

## 8. 重点表抽样

### ikcrm_cms_production.agent_users

- 引擎：`InnoDB`；字段数：32；索引数：4； 预估行数：0；预估容量：0.06 MB。
- 前 8 个字段：`id, name, agent_id, created_at, updated_at, encrypted_password, reset_password_token, reset_password_sent_at`。
- 外键：未在 `information_schema` 中发现显式外键约束。

### vcooline_ikcrm_production.customers

- 引擎：`InnoDB`；字段数：38；索引数：10； 预估行数：29170；预估容量：26.16 MB。
- 前 8 个字段：`id, name, category, source, industry, staff_size, note, created_at`。
- 外键：未在 `information_schema` 中发现显式外键约束。

### vcooline_ikcrm_production.opportunities

- 引擎：`InnoDB`；字段数：33；索引数：7； 预估行数：57351；预估容量：28.64 MB。
- 前 8 个字段：`id, organization_id, user_id, created_at, updated_at, title, customer_id, get_time`。
- 外键：未在 `information_schema` 中发现显式外键约束。

### vcooline_ikcrm_production.contracts

- 引擎：`InnoDB`；字段数：37；索引数：9； 预估行数：17312；预估容量：17.12 MB。
- 前 8 个字段：`id, category, payment_type, status, organization_id, user_id, created_at, updated_at`。
- 外键：未在 `information_schema` 中发现显式外键约束。

### vcooline_ikcrm_production.users

- 引擎：`InnoDB`；字段数：42；索引数：9； 预估行数：1390；预估容量：0.84 MB。
- 前 8 个字段：`id, email, encrypted_password, reset_password_token, reset_password_sent_at, remember_created_at, sign_in_count, current_sign_in_at`。
- 外键：未在 `information_schema` 中发现显式外键约束。


# CRM数据库业务模块梳理

## 1. 文档目标

- 这份文档不是逐表字典，而是把数据库按业务域重新组织，方便产品、开发、实施和数据同学快速理解系统边界。
- 逐表字段、索引、外键明细仍以 `CRM数据库结构分析.md` 和 `docs/db/*.md` 为准。
- 模块归类基于表名前缀、字段模式和核心实体关系推断，适合作为数据库阅读地图。

## 2. 核心业务链路

1. `ikcrm_cms_production` 负责渠道代理、套餐和试用入口，为核心 CRM 输送外围客户与配置。
2. `leads` 承接线索录入和分配，通过 `turned_customer_id` 将有效线索转成客户。
3. `customers`/`contacts` 形成客户主数据层，承接回访、状态轨迹、扩展属性和联系人关系。
4. `opportunities` 跟踪成交机会，`contracts` 负责正式签约。
5. `received_payments`、`invoices`、`expenses` 形成签约后的财务闭环；`orders`、`payments` 则承担平台通用交易能力。
6. `organizations`、`departments`、`users`、`roles`、`permissions` 贯穿所有业务域，构成组织和权限底座。

## 3. 模块总览

| 模块 | 所属库 | 表数量 | 预估行数 | 预估容量 | 核心表 |
| --- | --- | ---: | ---: | ---: | --- |
| 渠道/CMS与代理 | `ikcrm_cms_production` | 29 | 1 | 1.05 MB | `agents`, `agent_users`, `clients` |
| 线索管理 | `vcooline_ikcrm_production` | 5 | 202465 | 58.81 MB | `leads` |
| 客户与联系人 | `vcooline_ikcrm_production` | 17 | 1302514 | 320.23 MB | `customers`, `contacts` |
| 商机与合同 | `vcooline_ikcrm_production` | 9 | 2175460 | 497.81 MB | `opportunities`, `contracts` |
| 财务结算 | `vcooline_ikcrm_production` | 19 | 97631 | 38.52 MB | `received_payments`, `invoices`, `expenses`, `orders`, `payments` |
| 组织与权限 | `vcooline_ikcrm_production` | 15 | 263344 | 46.12 MB | `organizations`, `departments`, `users`, `roles`, `permissions` |
| 通信与营销触达 | `vcooline_ikcrm_production` | 41 | 1423708 | 1.02 GB | `notifications`, `sales_activities`, `call_records`, `sms_records` |
| 生态集成与平台支撑 | `vcooline_ikcrm_production` | 110 | 5235436 | 2.18 GB | `operation_logs`, `token_logs`, `custom_fields`, `knowledge_articles` |

## 4. 核心实体通用字段模式

| 字段 | 出现于核心表数量 | 典型含义 |
| --- | ---: | --- |
| `updated_at` | 26 | 更新时间 |
| `id` | 26 | - |
| `created_at` | 26 | 创建时间 |
| `organization_id` | 20 | 组织归属 |
| `user_id` | 16 | 负责人或所属用户 |
| `name` | 12 | - |
| `status` | 12 | - |
| `note` | 8 | - |
| `amount` | 6 | - |
| `source` | 6 | - |
| `creator_id` | 6 | 创建人 |
| `category` | 6 | - |

## 5. 模块详解

### 5.1 渠道/CMS与代理

- 模块定位：承载 CRM 外围的代理商、客户套餐、试用申请、升级通知和电话池配置，更像官网/渠道运营侧库。
- 范围统计：覆盖 `ikcrm_cms_production` 中 29 张表，预估总行数 1，预估总容量 1.05 MB。
- 核心表：`agents`, `agent_users`, `clients`
- 附属/映射表：`agent_leads`, `aliyun_upgrade_notices`, `client_profiles`, `clients_risk_packages`, `clients_sms_packages`, `customer_services`, `dingding_communication_codes`, `dingding_payments`, `dingding_trial_applications`, `dingding_upgrade_notices` 等 26 张表
- 模块内较大的表：`clients` (1 行, 0.23 MB)、`agent_users` (0 行, 0.06 MB)、`clients_risk_packages` (0 行, 0.05 MB)、`clients_sms_packages` (0 行, 0.05 MB)、`sms_packages_sms_channels` (0 行, 0.05 MB)

| 主表 | 关键字段 | 该表主动关联对象 | 其他表对它的依赖 |
| --- | --- | --- | --- |
| `agents` | `id` (`int(11)`), `name` (`varchar(255)`), `source` (`int(11)`), `email` (`varchar(255)`), `created_at` (`datetime`), `updated_at` (`datetime`), `amount` (`float`), `user_id` (`int(11)`), `address` (`varchar(255)`), `agent_type` (`int(11)`), `note` (`text`), `shorter_name` (`varchar(255)`) | `user_id` -> `users` | `agent_users.agent_id`、`clients.agent_id`、`dingding_payments.agent_id`、`kebao_agents.agent_id`、`supplier_applies.agent_id`、`users.agent_id` |
| `agent_users` | `id` (`int(11)`), `name` (`varchar(255)`), `agent_id` (`int(11)`), `status` (`int(11)`), `source` (`varchar(255)`), `phone` (`varchar(255)`), `email` (`varchar(255)`), `crm_user_id` (`int(11)`), `created_at` (`datetime`), `updated_at` (`datetime`), `encrypted_password` (`varchar(255)`), `reset_password_token` (`varchar(255)`) | `agent_id` -> `agents` | `clients.agent_user_id`、`supplier_applies.agent_user_id` |
| `clients` | `id` (`int(11)`), `name` (`varchar(255)`), `agent_id` (`int(11)`), `source` (`int(11)`), `email` (`varchar(255)`), `created_at` (`datetime`), `updated_at` (`datetime`), `organization_id` (`int(11)`), `user_id` (`int(11)`), `contacts_count` (`int(11)`), `contracts_count` (`int(11)`), `customers_count` (`int(11)`) | `user_id` -> `users`、`agent_id` -> `agents`、`agent_user_id` -> `agent_users`、`supplier_apply_id` -> `supplier_applies`、`sms_channel_id` -> `sms_channels` | `clients_risk_packages.client_id`、`clients_sms_packages.client_id`、`client_profiles.client_id`、`dingding_payments.client_id`、`dingding_trial_applications.client_id`、`insert_kebao_informations.client_id` 等 10 条 |

- 观察：该模块基本覆盖整个 `ikcrm_cms_production` 库，边界相对独立。
- 观察：大量表围绕套餐、升级通知、试用申请展开，适合作为外围商业化配置中心。

### 5.2 线索管理

- 模块定位：负责潜客录入、线索分配、跟进、转客户，以及线索扩展信息沉淀。
- 范围统计：覆盖 `vcooline_ikcrm_production` 中 5 张表，预估总行数 202465，预估总容量 58.81 MB。
- 核心表：`leads`
- 附属/映射表：`lead_addresses`, `lead_assets`, `lead_extras`, `leads_social_shares`
- 模块内较大的表：`lead_assets` (176179 行, 45.09 MB)、`leads` (12526 行, 7.31 MB)、`lead_addresses` (13760 行, 6.33 MB)、`leads_social_shares` (0 行, 0.05 MB)、`lead_extras` (0 行, 0.03 MB)

| 主表 | 关键字段 | 该表主动关联对象 | 其他表对它的依赖 |
| --- | --- | --- | --- |
| `leads` | `id` (`int(11)`), `name` (`varchar(255)`), `company_name` (`varchar(255)`), `source` (`varchar(255)`), `status` (`varchar(255)`), `organization_id` (`int(11)`), `user_id` (`int(11)`), `department_id` (`int(11)`), `turned_customer_id` (`int(11)`), `turned_at` (`datetime`), `revisit_at` (`datetime`), `channel_code` (`int(11)`) | `user_id` -> `users`、`organization_id` -> `organizations`、`department_id` -> `departments` | `leads_social_shares.lead_id`、`lead_extras.lead_id`、`sales_activities.lead_id` |

- 观察：主表内同时保留 `turned_customer_id` 和 `turned_at`，说明线索转客户是核心流程节点。
- 观察：`lead_addresses`、`lead_assets`、`lead_extras` 表明线索支持地址、附件和扩展属性的柔性扩展。

### 5.3 客户与联系人

- 模块定位：覆盖客户主数据、联系人、客户状态、回访和扩展属性，是 CRM 主数据中台的核心部分。
- 范围统计：覆盖 `vcooline_ikcrm_production` 中 17 张表，预估总行数 1302514，预估总容量 320.23 MB。
- 核心表：`customers`, `contacts`
- 附属/映射表：`contact_addresses`, `contact_assets`, `contact_assetships`, `contacts_expenses`, `contacts_revisit_logs`, `customer_addresses`, `customer_addresses_30`, `customer_assets`, `customer_assets_30`, `customer_common_settings` 等 15 张表
- 模块内较大的表：`customer_assets` (1132085 行, 244.42 MB)、`customers` (29170 行, 26.16 MB)、`customer_addresses` (27389 行, 17.64 MB)、`customer_multistep_approves` (47668 行, 17.06 MB)、`customer_status_tracks` (37743 行, 5.03 MB)

| 主表 | 关键字段 | 该表主动关联对象 | 其他表对它的依赖 |
| --- | --- | --- | --- |
| `customers` | `id` (`int(11)`), `name` (`varchar(255)`), `company_name` (`varchar(255)`), `category` (`varchar(255)`), `source` (`varchar(255)`), `industry` (`varchar(255)`), `status` (`varchar(255)`), `organization_id` (`int(11)`), `user_id` (`int(11)`), `department_id` (`int(11)`), `customer_common_setting_id` (`int(11)`), `approve_status` (`tinyint(4)`) | `organization_id` -> `organizations`、`user_id` -> `users`、`department_id` -> `departments`、`customer_common_setting_id` -> `customer_common_settings`、`custom_field_template_id` -> `custom_field_templates` | `business_query_subscriptions.customer_id`、`checkins.customer_id`、`contacts.customer_id`、`contracts.customer_id`、`customer_extras.customer_id`、`customer_multistep_approves.customer_id` 等 15 条 |
| `contacts` | `id` (`int(11)`), `name` (`varchar(255)`), `category` (`varchar(255)`), `organization_id` (`int(11)`), `user_id` (`int(11)`), `created_at` (`datetime`), `updated_at` (`datetime`), `customer_id` (`int(11)`), `creator_id` (`int(11)`), `parent_id` (`int(11)`), `department` (`varchar(255)`), `job` (`varchar(255)`) | `user_id` -> `users`、`organization_id` -> `organizations`、`customer_id` -> `customers` | `contacts_expenses.contact_id`、`contacts_revisit_logs.contact_id`、`contact_assetships.contact_id`、`ding_contacts.contact_id`、`sales_activities.contact_id` |

- 观察：存在 `_30` 表，说明客户相关对象可能有分表、归档或分区策略。
- 观察：客户模块下挂审批、通知、状态轨迹、通用设置等多类附属表，业务流程复杂度高。

### 5.4 商机与合同

- 模块定位：承载从销售机会到合同签订的成交过程，包含阶段推进、审批和资产附件。
- 范围统计：覆盖 `vcooline_ikcrm_production` 中 9 张表，预估总行数 2175460，预估总容量 497.81 MB。
- 核心表：`opportunities`, `contracts`
- 附属/映射表：`contract_assets`, `contract_multistep_approves`, `contract_notify_user_maps`, `opportunity_assets`, `opportunity_multistep_approves`, `opportunity_notify_user_maps`, `opportunity_stage_tracks`
- 模块内较大的表：`opportunity_assets` (1020532 行, 231.42 MB)、`contract_assets` (889596 行, 187.31 MB)、`opportunities` (57351 行, 28.64 MB)、`contracts` (17312 行, 17.12 MB)、`opportunity_stage_tracks` (132650 行, 16.03 MB)

| 主表 | 关键字段 | 该表主动关联对象 | 其他表对它的依赖 |
| --- | --- | --- | --- |
| `opportunities` | `id` (`int(11)`), `title` (`varchar(255)`), `stage` (`varchar(255)`), `customer_id` (`int(11)`), `organization_id` (`int(11)`), `user_id` (`int(11)`), `department_id` (`int(11)`), `expect_amount` (`decimal(24,6)`), `approve_status` (`tinyint(4)`), `created_at` (`datetime`), `updated_at` (`datetime`), `source` (`varchar(255)`) | `organization_id` -> `organizations`、`user_id` -> `users`、`customer_id` -> `customers`、`department_id` -> `departments` | `checkins.opportunity_id`、`contracts.opportunity_id`、`opportunity_multistep_approves.opportunity_id`、`opportunity_notify_user_maps.opportunity_id`、`opportunity_stage_tracks.opportunity_id`、`sales_activities.opportunity_id` |
| `contracts` | `id` (`int(11)`), `title` (`varchar(255)`), `status` (`varchar(255)`), `customer_id` (`int(11)`), `opportunity_id` (`int(11)`), `organization_id` (`int(11)`), `user_id` (`int(11)`), `department_id` (`int(11)`), `total_amount` (`decimal(24,6)`), `approve_status` (`tinyint(4)`), `sign_date` (`date`), `created_at` (`datetime`) | `organization_id` -> `organizations`、`user_id` -> `users`、`customer_id` -> `customers`、`opportunity_id` -> `opportunities`、`department_id` -> `departments` | `contract_multistep_approves.contract_id`、`contract_notify_user_maps.contract_id`、`invoiced_payments.contract_id`、`received_payments.contract_id`、`received_payment_plans.contract_id`、`sales_activities.contract_id` |

- 观察：商机表按阶段推进，合同表按审批和收款金额跟踪，属于典型 B2B 销售漏斗设计。
- 观察：`contract_assets` 和 `opportunity_assets` 体量都较大，说明系统对附件/明细资料留存较重。

### 5.5 财务结算

- 模块定位：覆盖回款、发票、费用、订单与支付，是 CRM 成交后的财务闭环。
- 范围统计：覆盖 `vcooline_ikcrm_production` 中 19 张表，预估总行数 97631，预估总容量 38.52 MB。
- 核心表：`received_payments`, `invoices`, `expenses`, `orders`, `payments`
- 附属/映射表：`acceptances`, `agent_bills`, `bills`, `expense_account_assets`, `expense_account_multistep_approves`, `expense_account_notify_user_maps`, `expense_accounts`, `expense_assets`, `invoice_items`, `invoiced_payments` 等 14 张表
- 模块内较大的表：`received_payments` (29046 行, 11.58 MB)、`invoiced_payments` (28787 行, 11.06 MB)、`received_payment_plans` (25819 行, 9.06 MB)、`expenses` (5510 行, 3.52 MB)、`expense_accounts` (4309 行, 1.94 MB)

| 主表 | 关键字段 | 该表主动关联对象 | 其他表对它的依赖 |
| --- | --- | --- | --- |
| `received_payments` | `id` (`int(11)`), `amount` (`decimal(24,6)`), `contract_id` (`int(11)`), `organization_id` (`int(11)`), `user_id` (`int(11)`), `payment_type` (`varchar(255)`), `receive_date` (`date`), `invoice_status` (`int(11)`), `approve_status` (`tinyint(4)`), `created_at` (`datetime`), `updated_at` (`datetime`), `note` (`text`) | `contract_id` -> `contracts`、`user_id` -> `users`、`organization_id` -> `organizations`、`received_payment_plan_id` -> `received_payment_plans` | `received_payment_notify_user_maps.received_payment_id` |
| `invoices` | `id` (`int(11)`), `amount` (`decimal(12,3)`), `organization_id` (`int(11)`), `user_id` (`int(11)`), `created_at` (`datetime`), `updated_at` (`datetime`), `company_name` (`varchar(255)`), `invoice_type` (`int(11)`), `company_address` (`varchar(255)`), `tax_number` (`varchar(255)`), `opening_bank` (`varchar(255)`), `bank_account` (`varchar(255)`) | `organization_id` -> `organizations`、`user_id` -> `users` | `invoice_items.invoice_id` |
| `expenses` | `id` (`int(11)`), `sn` (`varchar(255)`), `amount` (`decimal(24,6)`), `expense_account_id` (`int(11)`), `organization_id` (`int(11)`), `user_id` (`int(11)`), `created_at` (`datetime`), `updated_at` (`datetime`), `category` (`varchar(255)`), `customer_id` (`int(11)`), `creator_id` (`int(11)`), `expense_status` (`int(11)`) | `expense_account_id` -> `expense_accounts`、`organization_id` -> `organizations`、`user_id` -> `users`、`customer_id` -> `customers`、`revisit_log_id` -> `revisit_logs`、`checkin_id` -> `checkins` | `contacts_expenses.expense_id` |
| `orders` | `id` (`int(11)`), `status` (`int(11)`), `amount` (`int(11)`), `organization_id` (`int(11)`), `created_at` (`datetime`), `updated_at` (`datetime`), `currency` (`varchar(255)`), `order_number` (`varchar(255)`), `orderable_id` (`int(11)`), `orderable_type` (`varchar(255)`), `subject` (`varchar(255)`), `body` (`varchar(255)`) | `organization_id` -> `organizations` | `ding_orders.order_id`、`payments.order_id` |
| `payments` | `id` (`int(11)`), `status` (`int(11)`), `amount` (`int(11)`), `organization_id` (`int(11)`), `order_id` (`int(11)`), `created_at` (`datetime`), `updated_at` (`datetime`), `currency` (`varchar(255)`), `live_mode` (`int(11)`), `order_number` (`varchar(255)`), `transaction_number` (`varchar(255)`), `channel` (`varchar(255)`) | `organization_id` -> `organizations`、`order_id` -> `orders`、`app_id` -> `apps` | 未从字段命名中推断到稳定关系。 |

- 观察：合同、回款、发票、费用之间通过应用层字段串联，而不是大量外键约束。
- 观察：`orders`/`payments` 更像平台通用交易层，`received_payments`/`invoices`/`expenses` 更偏 CRM 财务业务层。

### 5.6 组织与权限

- 模块定位：提供组织、部门、用户、角色、权限与岗位等基础能力，贯穿所有核心业务实体。
- 范围统计：覆盖 `vcooline_ikcrm_production` 中 15 张表，预估总行数 263344，预估总容量 46.12 MB。
- 核心表：`organizations`, `departments`, `users`, `roles`, `permissions`
- 附属/映射表：`admins_departments`, `admins_organizations`, `common_entity_owners`, `grants`, `ownerships`, `permissions_roles`, `roles_users`, `stations`, `users_assist_departments`, `users_departments`
- 模块内较大的表：`permissions_roles` (216953 行, 31.55 MB)、`ownerships` (37089 行, 9.06 MB)、`roles` (3156 行, 3.62 MB)、`users` (1390 行, 0.84 MB)、`users_departments` (1379 行, 0.25 MB)

| 主表 | 关键字段 | 该表主动关联对象 | 其他表对它的依赖 |
| --- | --- | --- | --- |
| `organizations` | `id` (`int(11)`), `name` (`varchar(255)`), `created_at` (`datetime`), `updated_at` (`datetime`), `user_id` (`int(11)`), `contacts_count` (`int(11)`), `contracts_count` (`int(11)`), `customers_count` (`int(11)`), `leads_count` (`int(11)`), `opportunities_count` (`int(11)`), `tasks_count` (`int(11)`), `users_count` (`int(11)`) | `user_id` -> `users` | `acceptances.organization_id`、`accounts.organization_id`、`addresses.organization_id`、`admins_organizations.organization_id`、`alim_organizations.organization_id`、`announcements.organization_id` 等 143 条 |
| `departments` | `id` (`int(11)`), `name` (`varchar(255)`), `organization_id` (`int(11)`), `status` (`int(11)`), `path` (`varchar(255)`), `created_at` (`datetime`), `updated_at` (`datetime`), `parent_id` (`int(11)`), `description` (`text`), `position` (`int(11)`), `deleted_at` (`datetime`) | `organization_id` -> `organizations` | `admins_departments.department_id`、`alim_departments.department_id`、`contracts.department_id`、`customers.department_id`、`customers_30.department_id`、`ding_departments.department_id` 等 13 条 |
| `users` | `id` (`int(11)`), `name` (`varchar(255)`), `organization_id` (`int(11)`), `role_id` (`int(11)`), `station_id` (`int(11)`), `status` (`int(11)`), `usable` (`tinyint(1)`), `user_type` (`tinyint(4)`), `superior_id` (`int(11)`), `path` (`varchar(255)`), `created_at` (`datetime`), `updated_at` (`datetime`) | `organization_id` -> `organizations`、`role_id` -> `roles`、`station_id` -> `stations` | `acceptances.user_id`、`admins_departments.user_id`、`admins_organizations.user_id`、`alim_users.user_id`、`announcements.user_id`、`api_keys.user_id` 等 113 条 |
| `roles` | `id` (`int(11)`), `name` (`varchar(255)`), `organization_id` (`int(11)`), `created_at` (`datetime`), `updated_at` (`datetime`), `description` (`text`), `settings` (`text`), `entity_grant_scope` (`int(11)`), `field_permission_setting` (`text`), `field_permission_grant_scope` (`int(11)`) | `organization_id` -> `organizations` | `custom_field_template_roles.role_id`、`permissions_roles.role_id`、`roles_users.role_id`、`users.role_id` |
| `permissions` | `id` (`int(11)`), `name` (`varchar(255)`), `created_at` (`datetime`), `updated_at` (`datetime`), `subject` (`varchar(255)`), `action` (`varchar(255)`) | 未从字段命名中推断到稳定关系。 | `permissions_roles.permission_id` |

- 观察：绝大多数业务主表都带 `organization_id`、`user_id`、`department_id`，说明数据权限是全局一等公民。
- 观察：`roles_users`、`permissions_roles`、`users_departments` 这些映射表是权限落地的关键对象。

### 5.7 通信与营销触达

- 模块定位：负责呼叫、短信、社交裂变、短链、通知和销售动态触达。
- 范围统计：覆盖 `vcooline_ikcrm_production` 中 41 张表，预估总行数 1423708，预估总容量 1.02 GB。
- 核心表：`notifications`, `sales_activities`, `call_records`, `sms_records`
- 附属/映射表：`call_agents`, `call_centers`, `call_queues`, `callagents`, `callcenters`, `dial_logs`, `expire_reminders`, `ikcall_server_confs`, `iksms_records`, `reminders` 等 37 张表
- 模块内较大的表：`sales_activities` (853996 行, 647.03 MB)、`notifications` (191277 行, 218.44 MB)、`revisit_logs` (144799 行, 77.67 MB)、`reminders` (25744 行, 54.66 MB)、`sales_circles` (176964 行, 33.58 MB)

| 主表 | 关键字段 | 该表主动关联对象 | 其他表对它的依赖 |
| --- | --- | --- | --- |
| `notifications` | `id` (`int(11)`), `status` (`int(11)`), `organization_id` (`int(11)`), `created_at` (`datetime`), `updated_at` (`datetime`), `title` (`varchar(255)`), `category` (`int(11)`), `notifiable_id` (`int(11)`), `notifiable_type` (`varchar(255)`), `subject_id` (`int(11)`), `subject_type` (`varchar(255)`), `type` (`varchar(255)`) | `organization_id` -> `organizations` | 未从字段命名中推断到稳定关系。 |
| `sales_activities` | `id` (`int(11)`), `organization_id` (`int(11)`), `user_id` (`int(11)`), `customer_id` (`int(11)`), `contact_id` (`int(11)`), `created_at` (`datetime`), `updated_at` (`datetime`), `title` (`varchar(255)`), `opportunity_id` (`int(11)`), `contract_id` (`int(11)`), `saleable_id` (`int(11)`), `saleable_type` (`varchar(255)`) | `user_id` -> `users`、`organization_id` -> `organizations`、`customer_id` -> `customers`、`lead_id` -> `leads`、`opportunity_id` -> `opportunities`、`contract_id` -> `contracts` 等 7 条 | `sales_activity_comments.sales_activity_id` |
| `call_records` | `id` (`int(11)`), `status` (`tinyint(4)`), `organization_id` (`int(11)`), `user_id` (`int(11)`), `created_at` (`datetime`), `updated_at` (`datetime`), `recordable_id` (`int(11)`), `recordable_type` (`varchar(255)`), `agent_id` (`varchar(255)`), `call_type` (`tinyint(4)`), `device_type` (`tinyint(4)`), `call_id` (`varchar(255)`) | `organization_id` -> `organizations`、`user_id` -> `users` | `record_items.call_record_id` |
| `sms_records` | `id` (`int(11)`), `status` (`int(11)`), `organization_id` (`int(11)`), `user_id` (`int(11)`), `created_at` (`datetime`), `updated_at` (`datetime`), `social_share_id` (`int(11)`), `msg` (`text`), `reason` (`varchar(255)`), `sms_type` (`int(11)`), `sent_quantity` (`int(11)`), `reached_quantity` (`int(11)`) | `organization_id` -> `organizations`、`user_id` -> `users`、`social_share_id` -> `social_shares` | `sms_record_details.sms_record_id` |

- 观察：该模块存在多套触达能力并存，包括呼叫中心、短信通道、社交分享和系统通知。
- 观察：历史兼容命名明显，如 `callagents`/`call_agents`、`callcenters`/`call_centers` 并存。

### 5.8 生态集成与平台支撑

- 模块定位：覆盖钉钉、企业微信、King、阿里生态接入，以及平台配置、知识库、报表和运维元数据。
- 范围统计：覆盖 `vcooline_ikcrm_production` 中 110 张表，预估总行数 5235436，预估总容量 2.18 GB。
- 核心表：`operation_logs`, `token_logs`, `custom_fields`, `knowledge_articles`
- 附属/映射表：`alim_app_subscribers`, `alim_departments`, `alim_organizations`, `alim_user_assist_department_maps`, `alim_user_department_maps`, `alim_users`, `api_keys`, `app_versions`, `apps`, `custom_columns` 等 106 张表
- 模块内较大的表：`operation_logs` (2176676 行, 1.33 GB)、`token_logs` (2406271 行, 598.66 MB)、`custom_fields` (263865 行, 179.30 MB)、`login_logs` (175029 行, 38.58 MB)、`custom_field_groups` (41860 行, 17.06 MB)

| 主表 | 关键字段 | 该表主动关联对象 | 其他表对它的依赖 |
| --- | --- | --- | --- |
| `operation_logs` | `id` (`int(11)`), `organization_id` (`int(11)`), `user_id` (`int(11)`), `created_at` (`datetime`), `updated_at` (`datetime`), `loggable_id` (`int(11)`), `loggable_type` (`varchar(255)`), `action` (`varchar(255)`), `operation_changes` (`text`), `operate_no` (`varchar(128)`), `trans_no` (`varchar(128)`), `trans_module` (`int(11)`) | `user_id` -> `users`、`organization_id` -> `organizations`、`login_log_id` -> `login_logs` | 未从字段命名中推断到稳定关系。 |
| `token_logs` | `id` (`int(11)`), `created_at` (`datetime`), `updated_at` (`datetime`), `model_id` (`int(11)`), `model_type` (`varchar(255)`), `token_name` (`varchar(255)`), `token` (`varchar(1000)`), `expires_at` (`datetime`), `extras` (`text`) | 未从字段命名中推断到稳定关系。 | 未从字段命名中推断到稳定关系。 |
| `custom_fields` | `id` (`int(11)`), `name` (`varchar(255)`), `organization_id` (`int(11)`), `status` (`int(11)`), `created_at` (`datetime`), `updated_at` (`datetime`), `category` (`int(11)`), `label` (`varchar(255)`), `origin_label` (`varchar(255)`), `field_type` (`varchar(255)`), `position` (`int(11)`), `label_html_options` (`text`) | `organization_id` -> `organizations`、`custom_field_setting_id` -> `custom_field_settings`、`custom_field_group_id` -> `custom_field_groups` | `contact_assets.custom_field_id`、`contract_assets.custom_field_id`、`customer_assets.custom_field_id`、`customer_assets_30.custom_field_id`、`custom_field_template_fields.custom_field_id`、`expense_account_assets.custom_field_id` 等 13 条 |
| `knowledge_articles` | `id` (`int(11)`), `user_id` (`int(11)`), `created_at` (`datetime`), `updated_at` (`datetime`), `title` (`varchar(255)`), `content` (`mediumtext`), `views` (`int(11)`), `sticky_at` (`datetime`), `knowledge_section_id` (`int(11)`), `deleted_at` (`datetime`), `update_user_id` (`int(11)`) | `knowledge_section_id` -> `knowledge_sections`、`user_id` -> `users` | 未从字段命名中推断到稳定关系。 |

- 观察：日志、报表、自定义字段、知识库和第三方生态表共同构成平台化能力层。
- 观察：大表压力主要集中在该模块内的日志表和自定义字段相关表。

## 6. 阅读建议

1. 先看本文件的业务链路和模块详解，再去 `docs/db/*.md` 查单表字段。
2. 对没有显式外键的关系，优先关注 `_id` 字段、映射表和审批/通知附表。
3. 如果后续要做数据治理，建议先从 `组织与权限`、`客户与联系人`、`商机与合同` 三个模块补注释和口径。


# ikcrm_cms_production 表结构明细

## 1. 数据库概况

| 指标 | 值 |
| --- | ---: |
| 表数量 | 29 |
| 字段数量 | 572 |
| 索引数量 | 67 |
| 外键数量 | 0 |
| 预计总容量 | 1.05 MB |

## 2. 表清单

| 表名 | 字段数 | 索引数 | 外键数 | 预估行数 | 预估容量 | 表注释 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `agent_leads` | 11 | 1 | 0 | 0 | 0.02 MB | - |
| `agent_users` | 32 | 4 | 0 | 0 | 0.06 MB | - |
| `agents` | 70 | 1 | 0 | 0 | 0.02 MB | - |
| `aliyun_upgrade_notices` | 6 | 1 | 0 | 0 | 0.02 MB | - |
| `client_profiles` | 28 | 2 | 0 | 0 | 0.03 MB | - |
| `clients` | 149 | 15 | 0 | 1 | 0.23 MB | - |
| `clients_risk_packages` | 5 | 3 | 0 | 0 | 0.05 MB | - |
| `clients_sms_packages` | 5 | 3 | 0 | 0 | 0.05 MB | - |
| `customer_services` | 14 | 1 | 0 | 0 | 0.02 MB | - |
| `dingding_communication_codes` | 10 | 1 | 0 | 0 | 0.02 MB | - |
| `dingding_payments` | 24 | 1 | 0 | 0 | 0.02 MB | - |
| `dingding_trial_applications` | 7 | 1 | 0 | 0 | 0.02 MB | - |
| `dingding_upgrade_notices` | 8 | 2 | 0 | 0 | 0.03 MB | - |
| `insert_kebao_informations` | 7 | 2 | 0 | 0 | 0.03 MB | - |
| `kebao_agents` | 6 | 2 | 0 | 0 | 0.03 MB | - |
| `phone_pools` | 11 | 1 | 0 | 0 | 0.02 MB | - |
| `purchase_intentions` | 8 | 1 | 0 | 0 | 0.02 MB | - |
| `risk_packages` | 15 | 2 | 0 | 0 | 0.03 MB | - |
| `sms_channels` | 9 | 1 | 0 | 0 | 0.02 MB | - |
| `sms_packages` | 15 | 2 | 0 | 0 | 0.03 MB | - |
| `sms_packages_sms_channels` | 5 | 3 | 0 | 0 | 0.05 MB | - |
| `supplier_applies` | 33 | 2 | 0 | 0 | 0.03 MB | - |
| `system_notices` | 15 | 2 | 0 | 0 | 0.03 MB | - |
| `telesale_assistants` | 9 | 3 | 0 | 0 | 0.05 MB | - |
| `upgrade_notices` | 16 | 2 | 0 | 0 | 0.03 MB | - |
| `users` | 22 | 3 | 0 | 0 | 0.05 MB | - |
| `wx_trial_applications` | 12 | 1 | 0 | 0 | 0.02 MB | - |
| `wx_upgrade_notices` | 8 | 2 | 0 | 0 | 0.03 MB | - |
| `yunhu_exten_lists` | 12 | 2 | 0 | 0 | 0.03 MB | - |

## 3. 逐表详情

## agent_leads

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:11:41 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `province_id` | `int(11)` | YES | NULL | - | - | - |
| 4 | `city_id` | `int(11)` | YES | NULL | - | - | - |
| 5 | `district_id` | `int(11)` | YES | NULL | - | - | - |
| 6 | `phone` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `user_name` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `email` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `source` | `int(11)` | YES | 0 | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## agent_users

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-03 11:11:41 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | UNI | - | - |
| 3 | `agent_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `encrypted_password` | `varchar(255)` | NO |  | - | - | - |
| 7 | `reset_password_token` | `varchar(255)` | YES | NULL | UNI | - | - |
| 8 | `reset_password_sent_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `remember_created_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `sign_in_count` | `int(11)` | NO | 0 | - | - | - |
| 11 | `current_sign_in_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `last_sign_in_at` | `datetime` | YES | NULL | - | - | - |
| 13 | `current_sign_in_ip` | `varchar(255)` | YES | NULL | - | - | - |
| 14 | `last_sign_in_ip` | `varchar(255)` | YES | NULL | - | - | - |
| 15 | `status` | `int(11)` | NO | 0 | - | - | - |
| 16 | `email` | `varchar(255)` | YES | NULL | - | - | - |
| 17 | `source` | `varchar(255)` | YES | NULL | - | - | - |
| 18 | `admin_type` | `int(11)` | NO | 0 | - | - | - |
| 19 | `auth_token` | `varchar(255)` | YES | NULL | - | - | - |
| 20 | `real_name` | `varchar(255)` | YES | NULL | - | - | - |
| 21 | `can_create_normal` | `tinyint(1)` | YES | 1 | - | - | - |
| 22 | `can_create_trial` | `tinyint(1)` | YES | 1 | - | - | - |
| 23 | `can_create_test` | `tinyint(1)` | YES | 1 | - | - | - |
| 24 | `can_create_dingding_client` | `tinyint(1)` | YES | 1 | - | - | - |
| 25 | `phone` | `varchar(255)` | YES | NULL | - | - | - |
| 26 | `can_purchase` | `tinyint(1)` | YES | NULL | - | - | - |
| 27 | `can_edit_client` | `tinyint(1)` | YES | NULL | - | - | - |
| 28 | `can_recharge_child` | `tinyint(1)` | YES | NULL | - | - | - |
| 29 | `crm_user_id` | `int(11)` | YES | NULL | - | - | - |
| 30 | `crm_phone` | `varchar(255)` | YES | NULL | - | - | - |
| 31 | `dinguserid` | `varchar(255)` | YES | NULL | - | - | - |
| 32 | `data_permission` | `tinyint(4)` | NO | 0 | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_agent_users_on_agent_id` | BTREE | 非唯一 | `agent_id` |
| `index_agent_users_on_name` | BTREE | 唯一 | `name` |
| `index_agent_users_on_reset_password_token` | BTREE | 唯一 | `reset_password_token` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## agents

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:11:41 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `address` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `agent_type` | `int(11)` | YES | NULL | - | - | - |
| 5 | `note` | `text` | YES | NULL | - | - | - |
| 6 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `shorter_name` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `address2` | `varchar(255)` | YES | NULL | - | - | - |
| 10 | `tel` | `varchar(255)` | YES | NULL | - | - | - |
| 11 | `email` | `varchar(255)` | YES | NULL | - | - | - |
| 12 | `website` | `varchar(255)` | YES | NULL | - | - | - |
| 13 | `locked` | `tinyint(1)` | YES | 0 | - | - | - |
| 14 | `amount` | `float` | YES | 0 | - | - | - |
| 15 | `discount` | `float` | NO | 0.5 | - | - | - |
| 16 | `agent_category` | `int(11)` | YES | 0 | - | - | - |
| 17 | `parent_agent_id` | `int(11)` | YES | NULL | - | - | - |
| 18 | `user_id` | `int(11)` | YES | NULL | - | - | - |
| 19 | `monthly_lading_bill_count` | `int(11)` | YES | 0 | - | - | - |
| 20 | `crm_enabled` | `tinyint(1)` | YES | NULL | - | - | - |
| 21 | `orm_enabled` | `tinyint(1)` | YES | NULL | - | - | - |
| 22 | `orm_discount` | `float` | NO | 0.4 | - | - | - |
| 23 | `orm_note` | `text` | YES | NULL | - | - | - |
| 24 | `orm_amount` | `float` | YES | 0 | - | - | - |
| 25 | `assess_status` | `int(11)` | YES | 0 | - | - | - |
| 26 | `crm_contract_file_name` | `varchar(255)` | YES | NULL | - | - | - |
| 27 | `crm_contract_content_type` | `varchar(255)` | YES | NULL | - | - | - |
| 28 | `crm_contract_file_size` | `int(11)` | YES | NULL | - | - | - |
| 29 | `crm_contract_updated_at` | `datetime` | YES | NULL | - | - | - |
| 30 | `orm_contract_file_name` | `varchar(255)` | YES | NULL | - | - | - |
| 31 | `orm_contract_content_type` | `varchar(255)` | YES | NULL | - | - | - |
| 32 | `orm_contract_file_size` | `int(11)` | YES | NULL | - | - | - |
| 33 | `orm_contract_updated_at` | `datetime` | YES | NULL | - | - | - |
| 34 | `manager_user_id` | `int(11)` | YES | NULL | - | - | - |
| 35 | `crm_start_at` | `date` | YES | NULL | - | - | - |
| 36 | `crm_end_at` | `date` | YES | NULL | - | - | - |
| 37 | `dingding_crm_enabled` | `tinyint(1)` | YES | 0 | - | - | - |
| 38 | `dingding_crm_discount` | `float` | YES | 0.4 | - | - | - |
| 39 | `dingding_crm_note` | `text` | YES | NULL | - | - | - |
| 40 | `dingding_crm_amount` | `float` | YES | 0 | - | - | - |
| 41 | `kingdee_crm_enabled` | `tinyint(1)` | YES | 0 | - | - | - |
| 42 | `kingdee_crm_discount` | `float` | YES | 0.4 | - | - | - |
| 43 | `kingdee_crm_note` | `text` | YES | NULL | - | - | - |
| 44 | `rebate` | `varchar(255)` | YES | NULL | - | - | - |
| 45 | `account_type` | `int(11)` | YES | 0 | - | - | - |
| 46 | `telemarketing_enabled` | `tinyint(1)` | YES | 0 | - | - | - |
| 47 | `telemarketing_recharge_discount` | `float` | YES | 1 | - | - | - |
| 48 | `dingding_invoicing_enabled` | `tinyint(1)` | YES | 0 | - | - | - |
| 49 | `dingding_invoicing_note` | `text` | YES | NULL | - | - | - |
| 50 | `dingding_invoicing_discount` | `float` | YES | 1 | - | - | - |
| 51 | `allow_permanent_package` | `tinyint(1)` | YES | 0 | - | - | - |
| 52 | `source` | `int(11)` | YES | 0 | - | - | - |
| 53 | `grade` | `int(11)` | YES | NULL | - | - | - |
| 54 | `wx_crm_enabled` | `tinyint(1)` | YES | 0 | - | - | - |
| 55 | `wx_crm_discount` | `float` | YES | 0.4 | - | - | - |
| 56 | `wx_crm_note` | `text` | YES | NULL | - | - | - |
| 57 | `aliyun_crm_enabled` | `tinyint(1)` | YES | 0 | - | - | - |
| 58 | `aliyun_crm_discount` | `float` | YES | 0.4 | - | - | - |
| 59 | `aliyun_crm_note` | `text` | YES | NULL | - | - | - |
| 60 | `crm_channel_url` | `varchar(255)` | YES | NULL | - | - | - |
| 61 | `jxc_channel_url` | `varchar(255)` | YES | NULL | - | - | - |
| 62 | `wx_invoicing_enabled` | `tinyint(1)` | YES | 0 | - | - | - |
| 63 | `wx_invoicing_discount` | `float` | YES | 0.4 | - | - | - |
| 64 | `wx_invoicing_note` | `text` | YES | NULL | - | - | - |
| 65 | `payment_method` | `tinyint(4)` | YES | 0 | - | - | - |
| 66 | `qualification_name` | `varchar(255)` | YES | NULL | - | - | - |
| 67 | `litui_enabled` | `tinyint(1)` | YES | 0 | - | - | - |
| 68 | `litui_discount` | `float` | YES | 0.4 | - | - | - |
| 69 | `litui_note` | `text` | YES | NULL | - | - | - |
| 70 | `litui_channel_url` | `varchar(255)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## aliyun_upgrade_notices

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:11:41 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `title` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `content` | `text` | YES | NULL | - | - | - |
| 4 | `intro` | `text` | YES | NULL | - | - | - |
| 5 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## client_profiles

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:11:41 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `contact_name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `contact_job` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `contact_tel` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `contact_mobile` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `contact_qq` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `contact_email` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `secondary_contact_name` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `secondary_contact_job` | `varchar(255)` | YES | NULL | - | - | - |
| 10 | `secondary_contact_tel` | `varchar(255)` | YES | NULL | - | - | - |
| 11 | `secondary_contact_mobile` | `varchar(255)` | YES | NULL | - | - | - |
| 12 | `secondary_contact_qq` | `varchar(255)` | YES | NULL | - | - | - |
| 13 | `secondary_contact_email` | `varchar(255)` | YES | NULL | - | - | - |
| 14 | `client_id` | `int(11)` | YES | NULL | MUL | - | - |
| 15 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 16 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 17 | `contact_gender` | `varchar(255)` | YES | NULL | - | - | - |
| 18 | `contact_tel2` | `varchar(255)` | YES | NULL | - | - | - |
| 19 | `contact_tel3` | `varchar(255)` | YES | NULL | - | - | - |
| 20 | `contact_wechat` | `varchar(255)` | YES | NULL | - | - | - |
| 21 | `contact_address` | `varchar(255)` | YES | NULL | - | - | - |
| 22 | `secondary_contact_gender` | `varchar(255)` | YES | NULL | - | - | - |
| 23 | `secondary_contact_tel2` | `varchar(255)` | YES | NULL | - | - | - |
| 24 | `secondary_contact_tel3` | `varchar(255)` | YES | NULL | - | - | - |
| 25 | `secondary_contact_wechat` | `varchar(255)` | YES | NULL | - | - | - |
| 26 | `secondary_contact_address` | `varchar(255)` | YES | NULL | - | - | - |
| 27 | `contact_zipcode` | `varchar(255)` | YES | NULL | - | - | - |
| 28 | `secondary_contact_zipcode` | `varchar(255)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_client_profiles_on_client_id` | BTREE | 非唯一 | `client_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## clients

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 1 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.22 MB |
| 总容量 | 0.23 MB |
| 创建时间 | 2026-03-03 11:11:41 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `email` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 7 | `contacts_count` | `int(11)` | YES | NULL | - | - | - |
| 8 | `contracts_count` | `int(11)` | YES | NULL | - | - | - |
| 9 | `customers_count` | `int(11)` | YES | NULL | - | - | - |
| 10 | `leads_count` | `int(11)` | YES | NULL | - | - | - |
| 11 | `opportunities_count` | `int(11)` | YES | NULL | - | - | - |
| 12 | `tasks_count` | `int(11)` | YES | NULL | - | - | - |
| 13 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 14 | `account_type` | `int(11)` | YES | NULL | - | - | - |
| 15 | `users_count` | `int(11)` | YES | NULL | - | - | - |
| 16 | `province_id` | `int(11)` | YES | NULL | MUL | - | - |
| 17 | `city_id` | `int(11)` | YES | NULL | MUL | - | - |
| 18 | `subscription_id` | `int(11)` | YES | NULL | - | - | - |
| 19 | `address_detail` | `text` | YES | NULL | - | - | - |
| 20 | `knowledge_entities_count` | `int(11)` | YES | NULL | - | - | - |
| 21 | `source` | `int(11)` | YES | NULL | - | - | - |
| 22 | `schedule_reports_count` | `int(11)` | YES | NULL | - | - | - |
| 23 | `position` | `int(11)` | YES | NULL | - | - | - |
| 24 | `industry` | `int(11)` | YES | NULL | - | - | - |
| 25 | `senior_industry_id` | `int(11)` | YES | NULL | - | - | - |
| 26 | `second_industry_id` | `int(11)` | YES | NULL | - | - | - |
| 27 | `staff_size` | `int(11)` | YES | NULL | - | - | - |
| 28 | `shorter_name` | `varchar(255)` | YES | NULL | - | - | - |
| 29 | `organization_tel` | `varchar(255)` | YES | NULL | - | - | - |
| 30 | `website` | `varchar(255)` | YES | NULL | - | - | - |
| 31 | `agent_id` | `int(11)` | YES | NULL | - | - | - |
| 32 | `account_id` | `int(11)` | YES | NULL | MUL | - | - |
| 33 | `locked` | `tinyint(1)` | YES | 1 | - | - | - |
| 34 | `expires_at` | `datetime` | YES | NULL | - | - | - |
| 35 | `users_seat_count` | `int(11)` | YES | NULL | - | - | - |
| 36 | `r_user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 37 | `business_license_file_name` | `varchar(255)` | YES | NULL | - | - | - |
| 38 | `business_license_content_type` | `varchar(255)` | YES | NULL | - | - | - |
| 39 | `business_license_file_size` | `int(11)` | YES | NULL | - | - | - |
| 40 | `business_license_updated_at` | `datetime` | YES | NULL | - | - | - |
| 41 | `check` | `int(11)` | YES | 0 | - | - | - |
| 42 | `check_at` | `datetime` | YES | NULL | MUL | - | - |
| 43 | `district_id` | `int(11)` | YES | NULL | - | - | - |
| 44 | `follow_status` | `int(11)` | NO | 0 | - | - | - |
| 45 | `is_open` | `tinyint(1)` | NO | 0 | - | - | - |
| 46 | `brisk_status` | `int(11)` | NO | 0 | - | - | - |
| 47 | `agent_assign_status` | `tinyint(1)` | NO | 0 | - | - | - |
| 48 | `agent_assign_at` | `datetime` | YES | NULL | - | - | - |
| 49 | `follow_assign_status` | `tinyint(1)` | NO | 0 | - | - | - |
| 50 | `follow_people` | `varchar(255)` | YES | NULL | - | - | - |
| 51 | `follow_assign_at` | `datetime` | YES | NULL | - | - | - |
| 52 | `business_type` | `int(11)` | NO | 0 | - | - | - |
| 53 | `implement_type` | `int(11)` | NO | 0 | - | - | - |
| 54 | `agent_user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 55 | `refund_status` | `int(11)` | YES | 0 | - | - | - |
| 56 | `supplier_apply_id` | `int(11)` | YES | NULL | - | - | - |
| 57 | `parent_agent_id` | `int(11)` | YES | NULL | - | - | - |
| 58 | `implement_way` | `int(11)` | YES | NULL | - | - | - |
| 59 | `submit_check_at` | `datetime` | YES | NULL | - | - | - |
| 60 | `call_status` | `int(11)` | YES | 0 | - | - | - |
| 61 | `sales_man_id` | `int(11)` | YES | NULL | MUL | - | - |
| 62 | `soukebao_status` | `int(11)` | YES | 0 | - | - | - |
| 63 | `password_sent` | `tinyint(1)` | YES | 0 | - | - | - |
| 64 | `lading_user_id` | `int(11)` | YES | NULL | - | - | - |
| 65 | `inactive_days` | `int(11)` | YES | 0 | - | - | - |
| 66 | `note` | `text` | YES | NULL | - | - | - |
| 67 | `product_type` | `int(11)` | YES | 0 | MUL | - | - |
| 68 | `dingding_account_type` | `int(11)` | YES | 0 | - | - | - |
| 69 | `dingding_crm_plan_status` | `int(11)` | YES | 0 | - | - | - |
| 70 | `serial_number` | `varchar(255)` | YES | NULL | - | - | - |
| 71 | `dingding_status` | `int(11)` | YES | 0 | - | - | - |
| 72 | `dingding_permission_type` | `int(11)` | YES | 1 | - | - | - |
| 73 | `kingdee_permission_type` | `int(11)` | YES | 0 | - | - | - |
| 74 | `kingdee_status` | `int(11)` | YES | 0 | - | - | - |
| 75 | `dingding_corp_id` | `varchar(255)` | YES | NULL | - | - | - |
| 76 | `dingding_alter_name` | `varchar(255)` | YES | NULL | - | - | - |
| 77 | `dingding_category` | `int(11)` | YES | 0 | - | - | - |
| 78 | `dingding_follow_status` | `int(11)` | YES | 0 | - | - | - |
| 79 | `dingding_account_conversion` | `int(11)` | YES | 0 | - | - | - |
| 80 | `agent_assigned_at` | `datetime` | YES | NULL | - | - | - |
| 81 | `kingdee_account_type` | `int(11)` | YES | 0 | - | - | - |
| 82 | `kingdee_crm_plan_status` | `int(11)` | YES | 0 | - | - | - |
| 83 | `kingdee_category` | `int(11)` | YES | 0 | - | - | - |
| 84 | `kingdee_follow_status` | `int(11)` | YES | 0 | - | - | - |
| 85 | `unicom_status` | `int(11)` | YES | 0 | - | - | - |
| 86 | `dingding_source` | `int(11)` | YES | NULL | - | - | - |
| 87 | `aliyun_reconciliation_at` | `datetime` | YES | NULL | - | - | - |
| 88 | `aliyun_dingding_plan_status` | `int(11)` | YES | 0 | - | - | - |
| 89 | `aliyun_purchased_users_count` | `int(11)` | YES | NULL | - | - | - |
| 90 | `telemarketing_status` | `int(11)` | YES | 0 | - | - | - |
| 91 | `dingding_trial_apply_status` | `int(11)` | YES | 0 | - | - | - |
| 92 | `alim_permission_type` | `int(11)` | YES | 1 | - | - | - |
| 93 | `alim_account_type` | `int(11)` | YES | 1 | - | - | - |
| 94 | `legal_person_identity_front_file_name` | `varchar(255)` | YES | NULL | - | - | - |
| 95 | `legal_person_identity_front_content_type` | `varchar(255)` | YES | NULL | - | - | - |
| 96 | `legal_person_identity_front_file_size` | `int(11)` | YES | NULL | - | - | - |
| 97 | `legal_person_identity_front_updated_at` | `datetime` | YES | NULL | - | - | - |
| 98 | `legal_person_identity_back_file_name` | `varchar(255)` | YES | NULL | - | - | - |
| 99 | `legal_person_identity_back_content_type` | `varchar(255)` | YES | NULL | - | - | - |
| 100 | `legal_person_identity_back_file_size` | `int(11)` | YES | NULL | - | - | - |
| 101 | `legal_person_identity_back_updated_at` | `datetime` | YES | NULL | - | - | - |
| 102 | `info_security_agreement_file_file_name` | `varchar(255)` | YES | NULL | - | - | - |
| 103 | `info_security_agreement_file_content_type` | `varchar(255)` | YES | NULL | - | - | - |
| 104 | `info_security_agreement_file_file_size` | `int(11)` | YES | NULL | - | - | - |
| 105 | `info_security_agreement_file_updated_at` | `datetime` | YES | NULL | - | - | - |
| 106 | `alim_status` | `int(11)` | YES | 0 | - | - | - |
| 107 | `dingding_invoicing_plan_status` | `int(11)` | YES | 0 | - | - | - |
| 108 | `dingding_invoicing_permission_type` | `int(11)` | YES | 0 | - | - | - |
| 109 | `wx_corp_id` | `varchar(255)` | YES | NULL | - | - | - |
| 110 | `wx_crm_plan_status` | `int(11)` | YES | 0 | - | - | - |
| 111 | `wx_permission_type` | `int(11)` | YES | 0 | - | - | - |
| 112 | `wx_status` | `int(11)` | YES | 0 | - | - | - |
| 113 | `wx_account_type` | `int(11)` | YES | 0 | - | - | - |
| 114 | `wx_category` | `int(11)` | YES | 0 | - | - | - |
| 115 | `wx_follow_status` | `int(11)` | YES | 0 | - | - | - |
| 116 | `wx_invoicing_plan_status` | `int(11)` | YES | 0 | - | - | - |
| 117 | `wx_invoicing_permission_type` | `int(11)` | YES | 0 | - | - | - |
| 118 | `wx_source` | `int(11)` | YES | 0 | - | - | - |
| 119 | `opened_users_count` | `int(11)` | YES | NULL | - | - | - |
| 120 | `is_exped` | `int(11)` | YES | 0 | - | - | - |
| 121 | `info_security_agreement_file_2_file_name` | `varchar(255)` | YES | NULL | - | - | - |
| 122 | `info_security_agreement_file_2_content_type` | `varchar(255)` | YES | NULL | - | - | - |
| 123 | `info_security_agreement_file_2_file_size` | `int(11)` | YES | NULL | - | - | - |
| 124 | `info_security_agreement_file_2_updated_at` | `datetime` | YES | NULL | - | - | - |
| 125 | `online_pay` | `tinyint(1)` | YES | 0 | - | - | - |
| 126 | `buyout_check` | `int(11)` | YES | 0 | - | - | - |
| 127 | `buyout_check_at` | `datetime` | YES | NULL | - | - | - |
| 128 | `package_type` | `int(11)` | YES | 0 | - | - | - |
| 129 | `renewal_status` | `int(11)` | YES | NULL | - | - | - |
| 130 | `renewed_at` | `datetime` | YES | NULL | - | - | - |
| 131 | `current_package` | `varchar(255)` | YES | NULL | - | - | - |
| 132 | `renewal_duration` | `int(11)` | YES | NULL | - | - | - |
| 133 | `normal_crm_plan_status` | `int(11)` | YES | 0 | - | - | - |
| 134 | `buy_sms_status` | `int(11)` | YES | 0 | - | - | - |
| 135 | `specialist_id` | `int(11)` | YES | NULL | - | - | - |
| 136 | `achievement` | `int(11)` | YES | 0 | - | - | - |
| 137 | `wx_trial_apply_status` | `int(11)` | YES | 0 | - | - | - |
| 138 | `aliyun_order_id` | `varchar(255)` | YES | NULL | - | - | - |
| 139 | `aliyun_related_status` | `tinyint(1)` | NO | 0 | - | - | - |
| 140 | `intro` | `text` | YES | NULL | - | - | - |
| 141 | `achievement_at` | `datetime` | YES | NULL | - | - | - |
| 142 | `is_achievement_trial` | `tinyint(1)` | YES | 0 | - | - | - |
| 143 | `is_achievement_purchase` | `tinyint(1)` | YES | 0 | - | - | - |
| 144 | `ad_source` | `varchar(255)` | YES | NULL | - | - | - |
| 145 | `prev_due_at` | `datetime` | YES | NULL | MUL | - | - |
| 146 | `due_at` | `datetime` | YES | NULL | MUL | - | - |
| 147 | `renewal_at` | `datetime` | YES | NULL | - | - | - |
| 148 | `sms_channel_id` | `int(11)` | YES | 0 | - | - | - |
| 149 | `litui_plan_status` | `int(11)` | YES | 0 | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_clients_on_account_id` | BTREE | 非唯一 | `account_id` |
| `index_clients_on_agent_user_id` | BTREE | 非唯一 | `agent_user_id` |
| `index_clients_on_check_at` | BTREE | 非唯一 | `check_at` |
| `index_clients_on_city_id` | BTREE | 非唯一 | `city_id` |
| `index_clients_on_due_at` | BTREE | 非唯一 | `due_at` |
| `index_clients_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_clients_on_prev_due_at` | BTREE | 非唯一 | `prev_due_at` |
| `index_clients_on_product_type_and_due_at` | BTREE | 非唯一 | `product_type`, `due_at` |
| `index_clients_on_product_type_and_organization_id` | BTREE | 非唯一 | `product_type`, `organization_id` |
| `index_clients_on_product_type_and_prev_due_at` | BTREE | 非唯一 | `product_type`, `prev_due_at` |
| `index_clients_on_province_id` | BTREE | 非唯一 | `province_id` |
| `index_clients_on_r_user_id` | BTREE | 非唯一 | `r_user_id` |
| `index_clients_on_sales_man_id` | BTREE | 非唯一 | `sales_man_id` |
| `index_clients_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## clients_risk_packages

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:11:41 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `client_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `risk_package_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_clients_risk_packages_on_client_id` | BTREE | 非唯一 | `client_id` |
| `index_clients_risk_packages_on_risk_package_id` | BTREE | 非唯一 | `risk_package_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## clients_sms_packages

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:11:41 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `client_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `sms_package_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_clients_sms_packages_on_client_id` | BTREE | 非唯一 | `client_id` |
| `index_clients_sms_packages_on_sms_package_id` | BTREE | 非唯一 | `sms_package_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## customer_services

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:11:41 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | - | - | - |
| 3 | `real_name` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `nickname` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `qq` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `telephone` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `is_default` | `tinyint(1)` | YES | 0 | - | - | - |
| 8 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `dingding_qr_code_file_name` | `varchar(255)` | YES | NULL | - | - | - |
| 11 | `dingding_qr_code_content_type` | `varchar(255)` | YES | NULL | - | - | - |
| 12 | `dingding_qr_code_file_size` | `int(11)` | YES | NULL | - | - | - |
| 13 | `dingding_qr_code_updated_at` | `datetime` | YES | NULL | - | - | - |
| 14 | `qq_link` | `varchar(255)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## dingding_communication_codes

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:11:42 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 3 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 4 | `qr_code_file_name` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `qr_code_content_type` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `qr_code_file_size` | `int(11)` | YES | NULL | - | - | - |
| 7 | `qr_code_updated_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `link` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `app_type` | `int(11)` | YES | 0 | - | - | - |
| 10 | `auth_channel_type` | `int(11)` | YES | 0 | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## dingding_payments

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:11:42 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `client_id` | `int(11)` | YES | NULL | - | - | - |
| 3 | `month` | `int(11)` | YES | NULL | - | - | - |
| 4 | `start_date` | `date` | YES | NULL | - | - | - |
| 5 | `expires_date` | `date` | YES | NULL | - | - | - |
| 6 | `status` | `int(11)` | YES | NULL | - | - | - |
| 7 | `description` | `text` | YES | NULL | - | - | - |
| 8 | `agent_id` | `int(11)` | YES | NULL | - | - | - |
| 9 | `amount` | `float` | YES | NULL | - | - | - |
| 10 | `market_amount` | `float` | YES | NULL | - | - | - |
| 11 | `verified_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `buy_type` | `int(11)` | YES | 0 | - | - | - |
| 13 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 14 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 15 | `gift_month` | `int(11)` | YES | 0 | - | - | - |
| 16 | `package_id` | `int(11)` | YES | NULL | - | - | - |
| 17 | `order_id` | `int(11)` | YES | NULL | - | - | - |
| 18 | `paid_amount` | `decimal(10,2)` | YES | 0.00 | - | - | - |
| 19 | `total_months` | `int(11)` | YES | NULL | - | - | - |
| 20 | `package_type` | `int(11)` | YES | 0 | - | - | - |
| 21 | `payment_status` | `tinyint(4)` | YES | 0 | - | - | - |
| 22 | `payee_amount` | `decimal(10,2)` | YES | 0.00 | - | - | - |
| 23 | `invoice_amount` | `decimal(10,2)` | YES | 0.00 | - | - | - |
| 24 | `current_paid_amount` | `decimal(10,2)` | YES | 0.00 | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## dingding_trial_applications

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:11:42 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `client_id` | `int(11)` | YES | NULL | - | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | - | - | - |
| 4 | `submit_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `phone` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## dingding_upgrade_notices

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:11:42 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `title` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `content` | `text` | YES | NULL | - | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `intro` | `text` | YES | NULL | - | - | - |
| 7 | `range_type` | `int(11)` | YES | 0 | - | - | - |
| 8 | `upgrade_label_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_dingding_upgrade_notices_on_upgrade_label_id` | BTREE | 非唯一 | `upgrade_label_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## insert_kebao_informations

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:11:42 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `client_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `supplier_apply_id` | `int(11)` | YES | NULL | - | - | - |
| 4 | `crm_customer_id` | `int(11)` | YES | NULL | - | - | - |
| 5 | `description` | `text` | YES | NULL | - | - | - |
| 6 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_insert_kebao_informations_on_client_id` | BTREE | 非唯一 | `client_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## kebao_agents

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:11:42 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `agent_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `crm_user_id` | `int(11)` | YES | NULL | - | - | - |
| 4 | `product_type` | `int(11)` | YES | 0 | - | - | - |
| 5 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_kebao_agents_on_agent_id` | BTREE | 非唯一 | `agent_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## phone_pools

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:11:42 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `phone` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `status` | `int(11)` | YES | 0 | - | - | - |
| 4 | `verify_status` | `int(11)` | YES | 0 | - | - | - |
| 5 | `client_id` | `int(11)` | YES | NULL | - | - | - |
| 6 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `submit_verify_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `verified_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `fail_verified_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `source` | `int(11)` | YES | 0 | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## purchase_intentions

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:11:42 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `client_id` | `int(11)` | YES | NULL | - | - | - |
| 3 | `organization_id` | `int(11)` | YES | NULL | - | - | - |
| 4 | `user_id` | `int(11)` | YES | NULL | - | - | - |
| 5 | `phone` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `app_type` | `int(11)` | YES | 3 | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## risk_packages

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:11:42 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `status` | `int(11)` | YES | 0 | - | - | - |
| 5 | `visible_range` | `int(11)` | YES | 0 | - | - | - |
| 6 | `total_amount` | `decimal(10,3)` | YES | 0.000 | - | - | - |
| 7 | `buy_count` | `int(11)` | YES | 0 | - | - | - |
| 8 | `give_count` | `int(11)` | YES | 0 | - | - | - |
| 9 | `total_count` | `int(11)` | YES | 0 | - | - | - |
| 10 | `buy_price` | `decimal(10,3)` | YES | 0.000 | - | - | - |
| 11 | `actual_price` | `decimal(10,3)` | YES | 0.000 | - | - | - |
| 12 | `product_type` | `int(11)` | YES | 0 | - | - | - |
| 13 | `position` | `int(11)` | YES | NULL | - | - | - |
| 14 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 15 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_risk_packages_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## sms_channels

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:11:43 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `channel_type` | `tinyint(4)` | NO | 0 | - | - | - |
| 4 | `category` | `tinyint(4)` | NO | 0 | - | - | - |
| 5 | `userid` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `password` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `status` | `tinyint(4)` | NO | 0 | - | - | - |
| 8 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## sms_packages

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:11:43 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `status` | `int(11)` | YES | 0 | - | - | - |
| 5 | `visible_range` | `int(11)` | YES | 0 | - | - | - |
| 6 | `total_amount` | `decimal(10,3)` | YES | 0.000 | - | - | - |
| 7 | `buy_count` | `int(11)` | YES | 0 | - | - | - |
| 8 | `give_count` | `int(11)` | YES | 0 | - | - | - |
| 9 | `total_count` | `int(11)` | YES | 0 | - | - | - |
| 10 | `buy_price` | `decimal(10,3)` | YES | 0.000 | - | - | - |
| 11 | `actual_price` | `decimal(10,3)` | YES | 0.000 | - | - | - |
| 12 | `product_type` | `int(11)` | YES | 0 | - | - | - |
| 13 | `position` | `int(11)` | YES | NULL | - | - | - |
| 14 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 15 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_sms_packages_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## sms_packages_sms_channels

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:11:43 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `sms_package_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `sms_channel_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_sms_packages_sms_channels_on_sms_channel_id` | BTREE | 非唯一 | `sms_channel_id` |
| `index_sms_packages_sms_channels_on_sms_package_id` | BTREE | 非唯一 | `sms_package_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## supplier_applies

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:11:43 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `company_name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `phone` | `varchar(255)` | YES | NULL | MUL | - | - |
| 5 | `otp_secret_key` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `otp_secret_counter` | `int(11)` | YES | NULL | - | - | - |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `status` | `int(11)` | YES | NULL | - | - | - |
| 10 | `agent_assign_status` | `tinyint(1)` | NO | 0 | - | - | - |
| 11 | `agent_id` | `int(11)` | YES | NULL | - | - | - |
| 12 | `agent_assign_at` | `datetime` | YES | NULL | - | - | - |
| 13 | `follow_assign_status` | `tinyint(1)` | NO | 0 | - | - | - |
| 14 | `follow_people` | `varchar(255)` | YES | NULL | - | - | - |
| 15 | `follow_assign_at` | `datetime` | YES | NULL | - | - | - |
| 16 | `province_id` | `int(11)` | YES | NULL | - | - | - |
| 17 | `city_id` | `int(11)` | YES | NULL | - | - | - |
| 18 | `description` | `text` | YES | NULL | - | - | - |
| 19 | `follow_status` | `int(11)` | YES | 0 | - | - | - |
| 20 | `last_followed_at` | `datetime` | YES | NULL | - | - | - |
| 21 | `agent_user_id` | `int(11)` | YES | NULL | - | - | - |
| 22 | `phone_belong_to` | `varchar(255)` | YES | NULL | - | - | - |
| 23 | `ip_belong_to` | `varchar(255)` | YES | NULL | - | - | - |
| 24 | `request_ip` | `varchar(255)` | YES | NULL | - | - | - |
| 25 | `request_referer` | `varchar(255)` | YES | NULL | - | - | - |
| 26 | `source` | `int(11)` | YES | NULL | - | - | - |
| 27 | `first_exp` | `int(11)` | YES | 0 | - | - | - |
| 28 | `ad_source` | `varchar(255)` | YES | NULL | - | - | - |
| 29 | `agent_user_status` | `tinyint(1)` | NO | 0 | - | - | - |
| 30 | `into_kebao_status` | `tinyint(4)` | YES | 0 | - | - | - |
| 31 | `into_kebao_at` | `datetime` | YES | NULL | - | - | - |
| 32 | `product_type` | `int(11)` | YES | NULL | - | - | - |
| 33 | `is_real` | `tinyint(1)` | YES | 0 | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_supplier_applies_on_phone_and_status` | BTREE | 非唯一 | `phone`, `status` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## system_notices

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:11:43 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `publish_type` | `int(11)` | NO | 1 | - | - | - |
| 4 | `publish_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `send_type` | `int(11)` | NO | 1 | - | - | - |
| 6 | `subject` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `content` | `text` | YES | NULL | - | - | - |
| 8 | `publish_status` | `int(11)` | NO | 0 | - | - | - |
| 9 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `cover_image` | `varchar(255)` | YES | NULL | - | - | - |
| 12 | `summary` | `text` | YES | NULL | - | - | - |
| 13 | `link` | `varchar(255)` | YES | NULL | - | - | - |
| 14 | `notice_type` | `tinyint(4)` | YES | 0 | - | - | - |
| 15 | `image` | `varchar(255)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_system_notices_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## telesale_assistants

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:11:43 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | MUL | - | - |
| 3 | `software_type` | `tinyint(4)` | YES | 0 | - | - | - |
| 4 | `version_name` | `varchar(255)` | YES | NULL | MUL | - | - |
| 5 | `download_url` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `changelogs` | `text` | YES | NULL | - | - | - |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `project_type` | `int(11)` | YES | 0 | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_telesale_assistants_on_name` | BTREE | 非唯一 | `name` |
| `index_telesale_assistants_on_version_name` | BTREE | 非唯一 | `version_name` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## upgrade_notices

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:11:43 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `publish_type` | `int(11)` | NO | 1 | - | - | - |
| 4 | `publish_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `upgrade_type` | `int(11)` | NO | 1 | - | - | - |
| 6 | `subject` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `content` | `text` | YES | NULL | - | - | - |
| 8 | `publish_status` | `int(11)` | NO | 0 | - | - | - |
| 9 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `popup` | `tinyint(1)` | YES | 0 | - | - | - |
| 12 | `cover_image` | `varchar(255)` | YES | NULL | - | - | - |
| 13 | `summary` | `text` | YES | NULL | - | - | - |
| 14 | `link` | `varchar(255)` | YES | NULL | - | - | - |
| 15 | `notice_type` | `tinyint(4)` | YES | 0 | - | - | - |
| 16 | `image` | `varchar(255)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_upgrade_notices_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## users

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:11:43 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | NO |  | UNI | - | - |
| 3 | `encrypted_password` | `varchar(255)` | NO |  | - | - | - |
| 4 | `reset_password_token` | `varchar(255)` | YES | NULL | UNI | - | - |
| 5 | `reset_password_sent_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `remember_created_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `sign_in_count` | `int(11)` | NO | 0 | - | - | - |
| 8 | `current_sign_in_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `last_sign_in_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `current_sign_in_ip` | `varchar(255)` | YES | NULL | - | - | - |
| 11 | `last_sign_in_ip` | `varchar(255)` | YES | NULL | - | - | - |
| 12 | `status` | `int(11)` | NO | 0 | - | - | - |
| 13 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 14 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 15 | `auth_token` | `varchar(255)` | YES | NULL | - | - | - |
| 16 | `email` | `varchar(255)` | YES | NULL | - | - | - |
| 17 | `real_name` | `varchar(255)` | YES | NULL | - | - | - |
| 18 | `agent_id` | `int(11)` | YES | NULL | - | - | - |
| 19 | `enable_cms` | `tinyint(1)` | YES | 0 | - | - | - |
| 20 | `enable_kefu` | `tinyint(1)` | YES | 0 | - | - | - |
| 21 | `kefu_role` | `int(11)` | YES | 0 | - | - | - |
| 22 | `data_authority` | `int(11)` | YES | 0 | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_users_on_name` | BTREE | 唯一 | `name` |
| `index_users_on_reset_password_token` | BTREE | 唯一 | `reset_password_token` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## wx_trial_applications

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:11:43 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `client_id` | `int(11)` | YES | NULL | - | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | - | - | - |
| 4 | `submit_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `phone` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `province_id` | `int(11)` | YES | NULL | - | - | - |
| 9 | `city_id` | `int(11)` | YES | NULL | - | - | - |
| 10 | `transfer_status` | `int(11)` | YES | 0 | - | - | - |
| 11 | `transfer_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `transfer_description` | `varchar(255)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## wx_upgrade_notices

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:11:44 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `title` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `content` | `text` | YES | NULL | - | - | - |
| 4 | `intro` | `text` | YES | NULL | - | - | - |
| 5 | `range_type` | `int(11)` | YES | 0 | - | - | - |
| 6 | `upgrade_label_id` | `int(11)` | YES | NULL | MUL | - | - |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_wx_upgrade_notices_on_upgrade_label_id` | BTREE | 非唯一 | `upgrade_label_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## yunhu_exten_lists

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:11:44 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `account_id` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `login` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `password` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `status` | `int(11)` | YES | 0 | - | - | - |
| 6 | `source` | `int(11)` | YES | 1 | - | - | - |
| 7 | `client_id` | `int(11)` | YES | NULL | MUL | - | - |
| 8 | `ownerable_type` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `ownerable_id` | `int(11)` | YES | NULL | - | - | - |
| 10 | `product_type` | `int(11)` | YES | 0 | - | - | - |
| 11 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_yunhu_exten_lists_on_client_id` | BTREE | 非唯一 | `client_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |


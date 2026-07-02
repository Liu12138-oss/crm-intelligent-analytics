# vcooline_ikcrm_production 表结构明细

## 1. 数据库概况

| 指标 | 值 |
| --- | ---: |
| 表数量 | 297 |
| 字段数量 | 3316 |
| 索引数量 | 1000 |
| 外键数量 | 3 |
| 预计总容量 | 4.46 GB |

## 2. 表清单

| 表名 | 字段数 | 索引数 | 外键数 | 预估行数 | 预估容量 | 表注释 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `__drds__system__lock__` | 7 | 2 | 0 | 0 | 0.03 MB | - |
| `acceptances` | 13 | 3 | 0 | 0 | 0.05 MB | - |
| `accounts` | 16 | 4 | 0 | 0 | 0.06 MB | - |
| `addresses` | 25 | 10 | 0 | 136 | 0.16 MB | - |
| `admins_departments` | 5 | 3 | 0 | 0 | 0.05 MB | - |
| `admins_organizations` | 5 | 3 | 0 | 0 | 0.05 MB | - |
| `agent_bills` | 37 | 5 | 0 | 0 | 0.08 MB | - |
| `agent_queue_maps` | 5 | 3 | 0 | 0 | 0.05 MB | - |
| `alim_app_subscribers` | 8 | 2 | 0 | 0 | 0.03 MB | - |
| `alim_departments` | 12 | 5 | 0 | 0 | 0.08 MB | - |
| `alim_organizations` | 9 | 3 | 0 | 0 | 0.05 MB | - |
| `alim_user_assist_department_maps` | 5 | 1 | 0 | 0 | 0.02 MB | - |
| `alim_user_department_maps` | 5 | 1 | 0 | 0 | 0.02 MB | - |
| `alim_users` | 14 | 4 | 0 | 0 | 0.06 MB | - |
| `announcements` | 11 | 2 | 0 | 0 | 0.03 MB | - |
| `api_keys` | 5 | 3 | 0 | 1397 | 0.28 MB | - |
| `app_versions` | 10 | 1 | 0 | 2 | 0.02 MB | - |
| `approvals` | 8 | 4 | 0 | 87938 | 21.06 MB | - |
| `apps` | 8 | 1 | 0 | 16 | 0.02 MB | - |
| `archivers` | 8 | 4 | 0 | 28746 | 125.11 MB | - |
| `asr_entity_maps` | 6 | 3 | 0 | 0 | 0.05 MB | - |
| `asset_addresses` | 14 | 7 | 0 | 0 | 0.11 MB | - |
| `ats` | 8 | 5 | 0 | 52493 | 16.58 MB | - |
| `attachments` | 18 | 5 | 0 | 62325 | 33.61 MB | - |
| `audios` | 16 | 4 | 0 | 71 | 0.06 MB | - |
| `authentications` | 9 | 3 | 0 | 0 | 0.05 MB | - |
| `bills` | 27 | 5 | 0 | 0 | 0.08 MB | - |
| `business_query_accounts` | 13 | 3 | 0 | 1001 | 0.22 MB | - |
| `business_query_event_notifications` | 12 | 1 | 0 | 0 | 0.02 MB | - |
| `business_query_orders` | 14 | 5 | 0 | 0 | 0.08 MB | - |
| `business_query_subscriptions` | 12 | 5 | 0 | 0 | 0.08 MB | - |
| `call_agents` | 31 | 5 | 0 | 0 | 0.08 MB | - |
| `call_centers` | 23 | 4 | 0 | 0 | 0.06 MB | - |
| `call_queues` | 11 | 4 | 0 | 0 | 0.06 MB | - |
| `call_records` | 24 | 6 | 0 | 0 | 0.09 MB | - |
| `callagents` | 12 | 1 | 0 | 0 | 0.02 MB | - |
| `callcenters` | 13 | 1 | 0 | 0 | 0.02 MB | - |
| `checkins` | 18 | 6 | 0 | 0 | 0.09 MB | - |
| `cities` | 8 | 4 | 0 | 379 | 0.11 MB | - |
| `cms_material_users` | 8 | 1 | 0 | 0 | 0.02 MB | - |
| `cms_materials` | 11 | 3 | 0 | 0 | 0.05 MB | - |
| `commission_rules` | 13 | 3 | 0 | 0 | 0.05 MB | - |
| `commission_rules_stations` | 3 | 3 | 0 | 0 | 0.05 MB | - |
| `commission_stats` | 12 | 4 | 0 | 0 | 0.06 MB | - |
| `common_entity_owners` | 7 | 3 | 0 | 0 | 0.05 MB | - |
| `contact_addresses` | 25 | 9 | 0 | 7612 | 4.11 MB | - |
| `contact_assets` | 12 | 4 | 0 | 0 | 0.06 MB | - |
| `contact_assetships` | 8 | 4 | 0 | 1227 | 0.30 MB | - |
| `contacts` | 19 | 7 | 0 | 8107 | 2.56 MB | - |
| `contacts_expenses` | 5 | 3 | 0 | 0 | 0.05 MB | - |
| `contacts_revisit_logs` | 2 | 2 | 0 | 9573 | 0.81 MB | - |
| `contract_assets` | 12 | 4 | 0 | 889596 | 187.31 MB | - |
| `contract_multistep_approves` | 10 | 4 | 0 | 46686 | 15.06 MB | - |
| `contract_notify_user_maps` | 5 | 3 | 0 | 11333 | 2.11 MB | - |
| `contracts` | 37 | 9 | 0 | 17312 | 17.12 MB | - |
| `countries` | 6 | 3 | 0 | 243 | 0.05 MB | - |
| `cross_site_entities` | 10 | 2 | 0 | 0 | 0.03 MB | - |
| `custom_columns` | 6 | 2 | 0 | 1250 | 0.58 MB | - |
| `custom_field_groups` | 10 | 4 | 0 | 41860 | 17.06 MB | - |
| `custom_field_settings` | 5 | 3 | 0 | 13345 | 3.36 MB | - |
| `custom_field_template_fields` | 8 | 3 | 0 | 214 | 0.05 MB | ??????? |
| `custom_field_template_roles` | 6 | 4 | 0 | 74 | 0.06 MB | ??????? |
| `custom_field_templates` | 10 | 3 | 0 | 2 | 0.05 MB | - |
| `custom_fields` | 21 | 4 | 0 | 263865 | 179.30 MB | - |
| `custom_print_templates` | 8 | 2 | 0 | 0 | 0.03 MB | - |
| `custom_reports` | 11 | 3 | 0 | 1279 | 2.61 MB | - |
| `customer_addresses` | 25 | 9 | 0 | 27389 | 17.64 MB | - |
| `customer_addresses_30` | 25 | 9 | 0 | 0 | 0.14 MB | - |
| `customer_assets` | 12 | 4 | 0 | 1132085 | 244.42 MB | - |
| `customer_assets_30` | 12 | 4 | 0 | 0 | 0.06 MB | - |
| `customer_common_settings` | 14 | 2 | 0 | 971 | 1.53 MB | - |
| `customer_extras` | 6 | 2 | 0 | 0 | 0.03 MB | - |
| `customer_multistep_approves` | 10 | 4 | 0 | 47668 | 17.06 MB | - |
| `customer_notify_user_maps` | 5 | 3 | 0 | 969 | 0.11 MB | - |
| `customer_status_tracks` | 6 | 2 | 0 | 37743 | 5.03 MB | - |
| `customers` | 38 | 10 | 0 | 29170 | 26.16 MB | - |
| `customers_30` | 38 | 10 | 0 | 0 | 0.16 MB | - |
| `data_report_areas` | 9 | 3 | 0 | 1004 | 0.14 MB | - |
| `data_report_content_items` | 7 | 1 | 0 | 0 | 0.02 MB | - |
| `data_report_contents` | 12 | 4 | 0 | 0 | 0.06 MB | - |
| `data_report_items` | 6 | 2 | 0 | 2 | 0.03 MB | - |
| `data_report_readers` | 6 | 3 | 0 | 4 | 0.05 MB | - |
| `data_report_stores` | 7 | 3 | 0 | 0 | 0.05 MB | - |
| `data_reports` | 6 | 1 | 0 | 0 | 0.02 MB | - |
| `departments` | 11 | 4 | 0 | 379 | 0.11 MB | - |
| `dial_logs` | 10 | 2 | 0 | 28 | 0.03 MB | - |
| `ding_activation_award_applies` | 7 | 2 | 0 | 0 | 0.03 MB | - |
| `ding_activation_invite_acceptions` | 21 | 7 | 0 | 0 | 0.11 MB | - |
| `ding_activation_invites` | 10 | 3 | 0 | 0 | 0.05 MB | - |
| `ding_agents` | 17 | 5 | 0 | 0 | 0.08 MB | - |
| `ding_apps` | 14 | 1 | 0 | 0 | 0.02 MB | - |
| `ding_blocked_corp_ids` | 3 | 2 | 0 | 0 | 0.03 MB | - |
| `ding_contacts` | 9 | 5 | 0 | 0 | 0.08 MB | - |
| `ding_corp_apps` | 16 | 2 | 0 | 0 | 0.03 MB | - |
| `ding_coupons` | 13 | 3 | 0 | 0 | 0.05 MB | - |
| `ding_customers` | 9 | 5 | 0 | 0 | 0.08 MB | - |
| `ding_departments` | 15 | 6 | 0 | 0 | 0.09 MB | - |
| `ding_forms` | 9 | 2 | 0 | 0 | 0.03 MB | - |
| `ding_message_logs` | 8 | 4 | 0 | 0 | 0.06 MB | - |
| `ding_micro_apps` | 22 | 3 | 0 | 0 | 0.05 MB | - |
| `ding_orders` | 19 | 2 | 0 | 0 | 0.03 MB | - |
| `ding_organizations` | 13 | 4 | 0 | 0 | 0.06 MB | - |
| `ding_reading_logs` | 9 | 4 | 0 | 0 | 0.06 MB | - |
| `ding_star_activity_codes` | 5 | 2 | 0 | 0 | 0.03 MB | - |
| `ding_star_activity_orders` | 9 | 5 | 0 | 0 | 0.08 MB | - |
| `ding_suite_subscribers` | 29 | 5 | 0 | 0 | 0.08 MB | - |
| `ding_suites` | 23 | 1 | 0 | 0 | 0.02 MB | - |
| `ding_syn_logs` | 12 | 7 | 0 | 0 | 0.11 MB | - |
| `ding_upgrade_notice_logs` | 5 | 2 | 0 | 0 | 0.03 MB | - |
| `ding_user_assist_department_maps` | 5 | 3 | 0 | 0 | 0.05 MB | - |
| `ding_user_department_maps` | 6 | 4 | 0 | 0 | 0.06 MB | - |
| `ding_users` | 21 | 4 | 0 | 0 | 0.06 MB | - |
| `ding_visible_departments` | 5 | 5 | 0 | 0 | 0.08 MB | - |
| `districts` | 8 | 4 | 0 | 4583 | 0.75 MB | - |
| `entities_assist_users` | 6 | 3 | 0 | 140481 | 26.55 MB | - |
| `entities_share_users` | 6 | 3 | 0 | 0 | 0.05 MB | - |
| `event_users` | 5 | 1 | 0 | 6 | 0.02 MB | - |
| `events` | 15 | 4 | 0 | 6 | 0.06 MB | - |
| `expense_account_assets` | 12 | 1 | 0 | 0 | 0.02 MB | - |
| `expense_account_multistep_approves` | 10 | 4 | 0 | 4160 | 0.66 MB | - |
| `expense_account_notify_user_maps` | 5 | 3 | 0 | 0 | 0.05 MB | - |
| `expense_accounts` | 16 | 5 | 0 | 4309 | 1.94 MB | - |
| `expense_assets` | 12 | 1 | 0 | 0 | 0.02 MB | - |
| `expenses` | 18 | 7 | 0 | 5510 | 3.52 MB | - |
| `expire_reminders` | 9 | 1 | 0 | 0 | 0.02 MB | - |
| `faq_categories` | 7 | 1 | 0 | 0 | 0.02 MB | - |
| `faqs` | 9 | 2 | 0 | 0 | 0.03 MB | - |
| `feedback_replies` | 6 | 3 | 0 | 0 | 0.05 MB | - |
| `feedbacks` | 9 | 2 | 0 | 0 | 0.03 MB | - |
| `field_maps` | 9 | 2 | 0 | 17995 | 2.94 MB | - |
| `field_values` | 10 | 4 | 1 | 102242 | 12.06 MB | - |
| `grants` | 8 | 6 | 0 | 0 | 0.09 MB | - |
| `ik_invoicing_customers` | 7 | 2 | 0 | 0 | 0.03 MB | - |
| `ik_invoicing_product_categories` | 7 | 2 | 0 | 0 | 0.03 MB | - |
| `ik_invoicing_products` | 9 | 2 | 0 | 0 | 0.03 MB | - |
| `ik_invoicing_users` | 8 | 4 | 0 | 0 | 0.06 MB | - |
| `ik_taggings` | 6 | 3 | 0 | 0 | 0.05 MB | - |
| `ik_tags` | 6 | 2 | 0 | 0 | 0.03 MB | - |
| `ik_teams` | 14 | 4 | 0 | 0 | 0.06 MB | - |
| `ikcall_server_confs` | 5 | 1 | 0 | 0 | 0.02 MB | - |
| `iksms_records` | 12 | 6 | 0 | 0 | 0.09 MB | - |
| `import_histories` | 13 | 3 | 0 | 261 | 0.09 MB | - |
| `invite_codes` | 13 | 3 | 0 | 0 | 0.05 MB | - |
| `invoice_items` | 4 | 1 | 0 | 0 | 0.02 MB | - |
| `invoiced_payments` | 13 | 4 | 0 | 28787 | 11.06 MB | - |
| `invoices` | 22 | 5 | 0 | 0 | 0.08 MB | - |
| `invoicing_orders` | 8 | 2 | 0 | 0 | 0.03 MB | - |
| `ip_whitelists` | 6 | 2 | 0 | 0 | 0.03 MB | - |
| `king_app_subscribers` | 12 | 1 | 0 | 0 | 0.02 MB | - |
| `king_apps` | 14 | 1 | 0 | 0 | 0.02 MB | - |
| `king_departments` | 11 | 1 | 0 | 0 | 0.02 MB | - |
| `king_organizations` | 13 | 3 | 0 | 0 | 0.05 MB | - |
| `king_upgrade_notice_logs` | 5 | 1 | 0 | 0 | 0.02 MB | - |
| `king_user_assist_department_maps` | 5 | 1 | 0 | 0 | 0.02 MB | - |
| `king_user_department_maps` | 5 | 1 | 0 | 0 | 0.02 MB | - |
| `king_users` | 18 | 3 | 0 | 0 | 0.05 MB | - |
| `knowledge_articles` | 11 | 3 | 0 | 0 | 0.05 MB | - |
| `knowledge_catalogs` | 9 | 4 | 0 | 0 | 0.06 MB | - |
| `knowledge_entities` | 9 | 5 | 0 | 0 | 0.08 MB | - |
| `knowledge_sections` | 7 | 2 | 0 | 3003 | 0.34 MB | - |
| `largess_sms_activities` | 8 | 3 | 0 | 0 | 0.05 MB | - |
| `lead_addresses` | 25 | 9 | 0 | 13760 | 6.33 MB | - |
| `lead_assets` | 12 | 4 | 0 | 176179 | 45.09 MB | - |
| `lead_extras` | 5 | 2 | 0 | 0 | 0.03 MB | - |
| `leads` | 28 | 6 | 0 | 12526 | 7.31 MB | - |
| `leads_social_shares` | 5 | 3 | 0 | 0 | 0.05 MB | - |
| `likes` | 6 | 3 | 0 | 4 | 0.05 MB | - |
| `liteapp_subscribes` | 8 | 4 | 0 | 1005 | 0.12 MB | - |
| `liteapps` | 16 | 3 | 0 | 6 | 0.05 MB | - |
| `login_logs` | 9 | 3 | 0 | 175029 | 38.58 MB | - |
| `manual_categories` | 7 | 1 | 0 | 0 | 0.02 MB | - |
| `manuals` | 8 | 1 | 0 | 0 | 0.02 MB | - |
| `markings` | 11 | 5 | 0 | 501 | 0.17 MB | - |
| `mina_users` | 7 | 2 | 1 | 1069 | 0.09 MB | - |
| `notifications` | 18 | 4 | 0 | 191277 | 218.44 MB | - |
| `novice_task_item_maps` | 7 | 4 | 0 | 0 | 0.06 MB | - |
| `novice_task_items` | 5 | 2 | 0 | 0 | 0.03 MB | - |
| `novice_task_maps` | 7 | 3 | 0 | 1001 | 0.12 MB | - |
| `novice_tasks` | 6 | 1 | 0 | 1 | 0.02 MB | - |
| `oauth_access_grants` | 9 | 2 | 0 | 0 | 0.03 MB | - |
| `oauth_access_tokens` | 9 | 4 | 0 | 0 | 0.06 MB | - |
| `oauth_applications` | 10 | 3 | 0 | 0 | 0.05 MB | - |
| `operation_logs` | 18 | 10 | 0 | 2176676 | 1.33 GB | - |
| `opportunities` | 33 | 7 | 0 | 57351 | 28.64 MB | - |
| `opportunity_assets` | 12 | 4 | 0 | 1020532 | 231.42 MB | - |
| `opportunity_multistep_approves` | 10 | 4 | 0 | 0 | 0.06 MB | - |
| `opportunity_notify_user_maps` | 5 | 3 | 0 | 0 | 0.05 MB | - |
| `opportunity_stage_tracks` | 6 | 2 | 0 | 132650 | 16.03 MB | - |
| `orders` | 18 | 6 | 0 | 0 | 0.09 MB | - |
| `org_clients` | 26 | 2 | 0 | 1 | 0.03 MB | - |
| `organization_entity_daily_reports` | 21 | 2 | 0 | 0 | 0.03 MB | - |
| `organization_entity_summary_daily_reports` | 21 | 1 | 0 | 0 | 0.02 MB | - |
| `organizations` | 20 | 4 | 0 | 1001 | 0.12 MB | - |
| `organizations_kpi_daily_reports` | 11 | 1 | 0 | 0 | 0.02 MB | - |
| `ownerships` | 8 | 4 | 0 | 37089 | 9.06 MB | - |
| `packages` | 24 | 3 | 0 | 0 | 0.05 MB | - |
| `partitioning_configs` | 6 | 2 | 0 | 0 | 0.03 MB | - |
| `payments` | 24 | 7 | 0 | 0 | 0.11 MB | - |
| `payslip_commission_stats` | 3 | 3 | 0 | 0 | 0.05 MB | - |
| `payslip_stats` | 12 | 2 | 0 | 0 | 0.03 MB | - |
| `payslips` | 13 | 4 | 0 | 0 | 0.06 MB | - |
| `performance_daily_stats` | 9 | 4 | 0 | 0 | 0.06 MB | - |
| `performance_indicators` | 9 | 2 | 0 | 0 | 0.03 MB | - |
| `performance_monthly_stats` | 9 | 4 | 0 | 0 | 0.06 MB | - |
| `permissions` | 6 | 1 | 0 | 268 | 0.05 MB | - |
| `permissions_roles` | 3 | 3 | 0 | 216953 | 31.55 MB | - |
| `prepared_organizations` | 6 | 2 | 1 | 1000 | 0.09 MB | - |
| `print_templates` | 8 | 3 | 0 | 0 | 0.05 MB | - |
| `private_enterprises` | 8 | 2 | 0 | 0 | 0.03 MB | - |
| `product_assets` | 13 | 5 | 0 | 158143 | 47.61 MB | - |
| `product_attrs` | 8 | 2 | 0 | 0 | 0.03 MB | - |
| `product_categories` | 8 | 2 | 0 | 1296 | 0.17 MB | - |
| `product_field_assets` | 12 | 4 | 0 | 2496 | 0.58 MB | - |
| `products` | 13 | 3 | 0 | 1239 | 1.61 MB | - |
| `provinces` | 8 | 4 | 0 | 34 | 0.06 MB | - |
| `received_payment_assets` | 12 | 1 | 0 | 0 | 0.02 MB | - |
| `received_payment_notify_user_maps` | 5 | 3 | 0 | 0 | 0.05 MB | - |
| `received_payment_plans` | 16 | 4 | 0 | 25819 | 9.06 MB | - |
| `received_payments` | 20 | 5 | 0 | 29046 | 11.58 MB | - |
| `recharge_records` | 12 | 4 | 0 | 0 | 0.06 MB | - |
| `record_items` | 10 | 4 | 0 | 0 | 0.06 MB | - |
| `reminders` | 17 | 5 | 0 | 25744 | 54.66 MB | - |
| `report_cc_users` | 5 | 3 | 0 | 22956 | 3.52 MB | - |
| `report_reminder_configs` | 5 | 2 | 0 | 12 | 0.03 MB | - |
| `revisit_logs` | 15 | 7 | 0 | 144799 | 77.67 MB | - |
| `revisit_logs_30` | 15 | 6 | 0 | 0 | 0.09 MB | - |
| `roles` | 10 | 2 | 0 | 3156 | 3.62 MB | - |
| `roles_users` | 3 | 3 | 0 | 1379 | 0.20 MB | - |
| `sales_activities` | 20 | 10 | 0 | 853996 | 647.03 MB | - |
| `sales_activity_comments` | 8 | 2 | 0 | 493 | 0.11 MB | - |
| `sales_circle_comments` | 9 | 3 | 0 | 0 | 0.05 MB | - |
| `sales_circle_msgs` | 11 | 6 | 0 | 30406 | 11.09 MB | - |
| `sales_circles` | 13 | 3 | 0 | 176964 | 33.58 MB | - |
| `sales_goal_yearlies` | 26 | 6 | 0 | 24754 | 9.06 MB | - |
| `schedule_report_assets` | 12 | 4 | 0 | 14458 | 4.62 MB | - |
| `schedule_report_reads` | 5 | 3 | 0 | 1833 | 0.25 MB | - |
| `schedule_reports` | 13 | 4 | 0 | 6341 | 29.36 MB | - |
| `schema_migrations` | 1 | 1 | 0 | 1044 | 0.08 MB | - |
| `sequence` | 4 | 2 | 0 | 0 | 0.03 MB | - |
| `settings` | 7 | 2 | 0 | 3553 | 5.75 MB | - |
| `short_link_social_shares` | 7 | 4 | 0 | 0 | 0.06 MB | - |
| `sms_accounts` | 13 | 2 | 0 | 1 | 0.03 MB | - |
| `sms_channel_sms_account_maps` | 7 | 4 | 0 | 0 | 0.06 MB | - |
| `sms_channels` | 5 | 1 | 0 | 0 | 0.02 MB | - |
| `sms_identities` | 10 | 2 | 0 | 0 | 0.03 MB | - |
| `sms_identity_sources` | 8 | 3 | 0 | 0 | 0.05 MB | - |
| `sms_orders` | 14 | 4 | 0 | 0 | 0.06 MB | - |
| `sms_quota` | 6 | 2 | 0 | 0 | 0.03 MB | - |
| `sms_record_details` | 16 | 7 | 0 | 0 | 0.11 MB | - |
| `sms_records` | 20 | 4 | 0 | 0 | 0.06 MB | - |
| `sms_template_sources` | 8 | 3 | 0 | 0 | 0.05 MB | - |
| `sms_templates` | 18 | 3 | 0 | 0 | 0.05 MB | - |
| `sms_user_quota` | 6 | 4 | 0 | 0 | 0.06 MB | - |
| `social_share_assets` | 7 | 3 | 0 | 0 | 0.05 MB | - |
| `social_share_fields` | 8 | 3 | 0 | 0 | 0.05 MB | - |
| `social_share_items` | 4 | 2 | 0 | 0 | 0.03 MB | - |
| `social_share_records` | 7 | 1 | 0 | 0 | 0.02 MB | - |
| `social_share_relates` | 8 | 4 | 0 | 0 | 0.06 MB | - |
| `social_share_statistics` | 7 | 2 | 0 | 0 | 0.03 MB | - |
| `social_share_user_statistics` | 8 | 3 | 0 | 0 | 0.05 MB | - |
| `social_shares` | 17 | 4 | 0 | 0 | 0.06 MB | - |
| `soukebox_accounts` | 18 | 6 | 0 | 0 | 0.09 MB | - |
| `stations` | 6 | 2 | 0 | 0 | 0.03 MB | - |
| `subscribers` | 8 | 4 | 0 | 0 | 0.06 MB | - |
| `taggings` | 8 | 3 | 0 | 0 | 0.05 MB | - |
| `tags` | 3 | 2 | 0 | 0 | 0.03 MB | - |
| `tddl_rule` | 12 | 2 | 0 | 0 | 0.03 MB | - |
| `tddl_rule_status` | 7 | 0 | 0 | 0 | 0.02 MB | - |
| `token_logs` | 9 | 3 | 0 | 2406271 | 598.66 MB | - |
| `travelrecord` | 5 | 1 | 0 | 0 | 0.02 MB | - |
| `upgrade_notice_logs` | 7 | 4 | 0 | 0 | 0.06 MB | - |
| `user_access_records` | 5 | 2 | 0 | 0 | 0.03 MB | - |
| `user_devices` | 17 | 5 | 0 | 8528 | 4.64 MB | - |
| `user_event_notifications` | 7 | 4 | 0 | 0 | 0.06 MB | - |
| `user_sign_in_logs` | 5 | 3 | 0 | 0 | 0.05 MB | - |
| `users` | 42 | 9 | 0 | 1390 | 0.84 MB | - |
| `users_assist_departments` | 5 | 3 | 0 | 350 | 0.05 MB | - |
| `users_departments` | 3 | 3 | 0 | 1379 | 0.25 MB | - |
| `wechat_users` | 12 | 2 | 0 | 1070 | 0.09 MB | - |
| `wx_agents` | 17 | 5 | 0 | 0 | 0.08 MB | - |
| `wx_apps` | 11 | 2 | 0 | 0 | 0.03 MB | - |
| `wx_department_maps` | 3 | 3 | 0 | 0 | 0.05 MB | - |
| `wx_departments` | 13 | 3 | 0 | 0 | 0.05 MB | - |
| `wx_external_contact_maps` | 8 | 3 | 0 | 0 | 0.05 MB | - |
| `wx_globals` | 9 | 1 | 0 | 0 | 0.02 MB | - |
| `wx_organization_maps` | 3 | 3 | 0 | 0 | 0.05 MB | - |
| `wx_organizations` | 16 | 1 | 0 | 0 | 0.02 MB | - |
| `wx_register_templates` | 5 | 1 | 0 | 0 | 0.02 MB | - |
| `wx_registers` | 6 | 2 | 0 | 0 | 0.03 MB | - |
| `wx_suite_subscribers` | 17 | 3 | 0 | 0 | 0.05 MB | - |
| `wx_suites` | 14 | 1 | 0 | 0 | 0.02 MB | - |
| `wx_syn_logs` | 11 | 3 | 0 | 0 | 0.05 MB | - |
| `wx_upgrade_notice_logs` | 5 | 3 | 0 | 0 | 0.05 MB | - |
| `wx_user_department_maps` | 4 | 4 | 0 | 0 | 0.06 MB | - |
| `wx_user_maps` | 6 | 4 | 0 | 0 | 0.06 MB | - |
| `wx_users` | 24 | 3 | 0 | 0 | 0.05 MB | - |
| `wx_visible_departments` | 4 | 4 | 0 | 0 | 0.06 MB | - |

## 3. 逐表详情

## __drds__system__lock__

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
| 1 | `id` | `bigint(20) unsigned` | NO | NULL | PRI | auto_increment | ?? |
| 2 | `gmt_create` | `datetime` | NO | NULL | - | - | ???? |
| 3 | `gmt_modified` | `datetime` | NO | NULL | - | - | ???? |
| 4 | `name` | `varchar(255)` | NO | NULL | UNI | - | name |
| 5 | `token` | `varchar(255)` | NO | NULL | - | - | token |
| 6 | `identity` | `varchar(255)` | NO | NULL | - | - | identity |
| 7 | `operator` | `varchar(255)` | NO | NULL | - | - | operator |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `UNIQ_NAME` | BTREE | 唯一 | `name` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## acceptances

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:11:44 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `first_entry` | `tinyint(1)` | YES | 1 | - | - | - |
| 3 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `acceptance_day3` | `tinyint(1)` | YES | 0 | - | - | - |
| 6 | `acceptance_day8` | `tinyint(1)` | YES | 0 | - | - | - |
| 7 | `phone` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `alerted_day3` | `tinyint(1)` | YES | 0 | - | - | - |
| 11 | `alerted_day8` | `tinyint(1)` | YES | 0 | - | - | - |
| 12 | `app_type` | `int(11)` | YES | 3 | - | - | - |
| 13 | `exp_alerted` | `tinyint(1)` | YES | 0 | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_acceptances_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_acceptances_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## accounts

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-03 11:11:44 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `deposit` | `decimal(12,3)` | YES | 0.000 | - | - | - |
| 5 | `balance` | `decimal(12,3)` | YES | 0.000 | - | - | - |
| 6 | `warned_threshold` | `decimal(10,0)` | YES | 10000 | - | - | - |
| 7 | `prev_locked_threshold` | `int(11)` | YES | 24 | - | - | - |
| 8 | `status` | `int(11)` | YES | 0 | MUL | - | - |
| 9 | `actived_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `warned_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `prev_locked_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `locked_at` | `datetime` | YES | NULL | - | - | - |
| 13 | `package_id` | `int(11)` | YES | NULL | - | - | - |
| 14 | `deleted_at` | `datetime` | YES | NULL | MUL | - | - |
| 15 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 16 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_accounts_on_deleted_at` | BTREE | 非唯一 | `deleted_at` |
| `index_accounts_on_organization_id_and_status` | BTREE | 非唯一 | `organization_id`, `status` |
| `index_accounts_on_status` | BTREE | 非唯一 | `status` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## addresses

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 136 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.14 MB |
| 总容量 | 0.16 MB |
| 创建时间 | 2026-03-03 11:11:44 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `addressable_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `addressable_type` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `country_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `province_id` | `int(11)` | YES | NULL | MUL | - | - |
| 6 | `city_id` | `int(11)` | YES | NULL | MUL | - | - |
| 7 | `district_id` | `int(11)` | YES | NULL | MUL | - | - |
| 8 | `tel` | `varchar(255)` | YES | NULL | MUL | - | - |
| 9 | `phone` | `varchar(255)` | YES | NULL | MUL | - | - |
| 10 | `email` | `varchar(255)` | YES | NULL | - | - | - |
| 11 | `qq` | `varchar(255)` | YES | NULL | - | - | - |
| 12 | `fax` | `varchar(255)` | YES | NULL | - | - | - |
| 13 | `wechat` | `varchar(255)` | YES | NULL | - | - | - |
| 14 | `wangwang` | `varchar(255)` | YES | NULL | - | - | - |
| 15 | `zip` | `varchar(255)` | YES | NULL | - | - | - |
| 16 | `url` | `varchar(255)` | YES | NULL | - | - | - |
| 17 | `detail_address` | `varchar(255)` | YES | NULL | - | - | - |
| 18 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 19 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 20 | `lat` | `decimal(10,6)` | YES | NULL | MUL | - | - |
| 21 | `lng` | `decimal(10,6)` | YES | NULL | - | - | - |
| 22 | `off_distance` | `float` | YES | NULL | - | - | - |
| 23 | `region_info` | `varchar(255)` | YES | NULL | - | - | - |
| 24 | `snippet` | `varchar(255)` | YES | NULL | - | - | - |
| 25 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_addresses_on_addressable_id_and_addressable_type` | BTREE | 非唯一 | `addressable_id`, `addressable_type` |
| `index_addresses_on_city_id` | BTREE | 非唯一 | `city_id` |
| `index_addresses_on_country_id` | BTREE | 非唯一 | `country_id` |
| `index_addresses_on_district_id` | BTREE | 非唯一 | `district_id` |
| `index_addresses_on_lat_and_lng` | BTREE | 非唯一 | `lat`, `lng` |
| `index_addresses_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_addresses_on_phone` | BTREE | 非唯一 | `phone` |
| `index_addresses_on_province_id` | BTREE | 非唯一 | `province_id` |
| `index_addresses_on_tel` | BTREE | 非唯一 | `tel` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## admins_departments

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:11:45 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `department_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_admins_departments_on_department_id` | BTREE | 非唯一 | `department_id` |
| `index_admins_departments_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## admins_organizations

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:11:45 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_admins_organizations_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_admins_organizations_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## agent_bills

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.06 MB |
| 总容量 | 0.08 MB |
| 创建时间 | 2026-03-03 11:11:46 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `account_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `call_agent_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `package_id` | `int(11)` | YES | NULL | - | - | - |
| 5 | `start` | `date` | YES | NULL | - | - | - |
| 6 | `end` | `date` | YES | NULL | - | - | - |
| 7 | `amount` | `decimal(12,3)` | YES | 0.000 | - | - | - |
| 8 | `package_amount` | `decimal(12,3)` | YES | 0.000 | - | - | - |
| 9 | `package_paid_amount` | `decimal(12,3)` | YES | 0.000 | - | - | - |
| 10 | `paid_amount` | `decimal(12,3)` | YES | 0.000 | - | - | - |
| 11 | `pstn_duration_out` | `int(11)` | YES | 0 | - | - | - |
| 12 | `pstn_duration_in` | `int(11)` | YES | 0 | - | - | - |
| 13 | `pstn_duration_out_out_package` | `int(11)` | YES | 0 | - | - | - |
| 14 | `pstn_duration_in_out_package` | `int(11)` | YES | 0 | - | - | - |
| 15 | `pstn_amount` | `decimal(12,3)` | YES | 0.000 | - | - | - |
| 16 | `pstn_amount_out_out_package` | `decimal(12,3)` | YES | 0.000 | - | - | - |
| 17 | `pstn_amount_in_out_package` | `decimal(12,3)` | YES | 0.000 | - | - | - |
| 18 | `sip_duration_out` | `int(11)` | YES | 0 | - | - | - |
| 19 | `sip_duration_in` | `int(11)` | YES | 0 | - | - | - |
| 20 | `sip_duration_out_out_package` | `int(11)` | YES | 0 | - | - | - |
| 21 | `sip_duration_in_out_package` | `int(11)` | YES | 0 | - | - | - |
| 22 | `sip_amount` | `decimal(12,3)` | YES | 0.000 | - | - | - |
| 23 | `sip_amount_out_out_package` | `decimal(12,3)` | YES | 0.000 | - | - | - |
| 24 | `sip_amount_in_out_package` | `decimal(12,3)` | YES | 0.000 | - | - | - |
| 25 | `recording_duration_out` | `int(11)` | YES | 0 | - | - | - |
| 26 | `recording_duration_in` | `int(11)` | YES | 0 | - | - | - |
| 27 | `recording_duration_out_out_package` | `int(11)` | YES | 0 | - | - | - |
| 28 | `recording_duration_in_out_package` | `int(11)` | YES | 0 | - | - | - |
| 29 | `recording_amount` | `decimal(12,3)` | YES | 0.000 | - | - | - |
| 30 | `recording_amount_out_out_package` | `decimal(12,3)` | YES | 0.000 | - | - | - |
| 31 | `recording_amount_in_out_package` | `decimal(12,3)` | YES | 0.000 | - | - | - |
| 32 | `status` | `int(11)` | YES | 0 | MUL | - | - |
| 33 | `package_status` | `int(11)` | YES | 0 | - | - | - |
| 34 | `paid_at` | `datetime` | YES | NULL | - | - | - |
| 35 | `deleted_at` | `datetime` | YES | NULL | MUL | - | - |
| 36 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 37 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_agent_bills_on_account_id_and_status` | BTREE | 非唯一 | `account_id`, `status` |
| `index_agent_bills_on_call_agent_id` | BTREE | 非唯一 | `call_agent_id` |
| `index_agent_bills_on_deleted_at` | BTREE | 非唯一 | `deleted_at` |
| `index_agent_bills_on_status` | BTREE | 非唯一 | `status` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## agent_queue_maps

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:11:46 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `call_agent_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `call_queue_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_agent_queue_maps_on_call_agent_id` | BTREE | 非唯一 | `call_agent_id` |
| `index_agent_queue_maps_on_call_queue_id` | BTREE | 非唯一 | `call_queue_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## alim_app_subscribers

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:11:46 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `alim_organization_id` | `int(11)` | YES | NULL | - | - | - |
| 3 | `alim_app_id` | `int(11)` | YES | NULL | - | - | - |
| 4 | `status` | `int(11)` | YES | 0 | - | - | - |
| 5 | `deleted_at` | `datetime` | YES | NULL | MUL | - | - |
| 6 | `actived_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_alim_app_subscribers_on_deleted_at` | BTREE | 非唯一 | `deleted_at` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## alim_departments

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.06 MB |
| 总容量 | 0.08 MB |
| 创建时间 | 2026-03-03 11:11:46 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `department_id` | `int(11)` | YES | NULL | - | - | - |
| 3 | `alim_organization_id` | `int(11)` | YES | NULL | - | - | - |
| 4 | `parent_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `dept_id` | `varchar(255)` | YES | NULL | MUL | - | - |
| 6 | `dept_parent_id` | `varchar(255)` | YES | NULL | MUL | - | - |
| 7 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `status` | `int(11)` | YES | 0 | - | - | - |
| 9 | `path` | `varchar(255)` | YES | NULL | - | - | - |
| 10 | `deleted_at` | `datetime` | YES | NULL | MUL | - | - |
| 11 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_alim_departments_on_deleted_at` | BTREE | 非唯一 | `deleted_at` |
| `index_alim_departments_on_dept_id` | BTREE | 非唯一 | `dept_id` |
| `index_alim_departments_on_dept_parent_id` | BTREE | 非唯一 | `dept_parent_id` |
| `index_alim_departments_on_parent_id` | BTREE | 非唯一 | `parent_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## alim_organizations

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:11:46 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | - | - | - |
| 3 | `domain_id` | `varchar(255)` | YES | NULL | MUL | - | - |
| 4 | `corp_name` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `increment_id` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `root_department_id` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `deleted_at` | `datetime` | YES | NULL | MUL | - | - |
| 8 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_alim_organizations_on_deleted_at` | BTREE | 非唯一 | `deleted_at` |
| `index_alim_organizations_on_domain_id` | BTREE | 非唯一 | `domain_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## alim_user_assist_department_maps

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:11:46 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `alim_department_id` | `int(11)` | YES | NULL | - | - | - |
| 3 | `alim_user_id` | `int(11)` | YES | NULL | - | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## alim_user_department_maps

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:11:46 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `alim_department_id` | `int(11)` | YES | NULL | - | - | - |
| 3 | `alim_user_id` | `int(11)` | YES | NULL | - | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## alim_users

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-03 11:11:46 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | - | - | - |
| 3 | `alim_organization_id` | `int(11)` | YES | NULL | - | - | - |
| 4 | `uid` | `varchar(255)` | YES | NULL | MUL | - | - |
| 5 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `nickname` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `email` | `varchar(255)` | YES | NULL | MUL | - | - |
| 8 | `avatar` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `mobile` | `varchar(255)` | YES | NULL | - | - | - |
| 10 | `status` | `int(11)` | YES | NULL | - | - | - |
| 11 | `role` | `int(11)` | YES | NULL | - | - | - |
| 12 | `deleted_at` | `datetime` | YES | NULL | MUL | - | - |
| 13 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 14 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_alim_users_on_deleted_at` | BTREE | 非唯一 | `deleted_at` |
| `index_alim_users_on_email` | BTREE | 非唯一 | `email` |
| `index_alim_users_on_uid` | BTREE | 非唯一 | `uid` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## announcements

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:11:47 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `title` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `visible_ids` | `text` | YES | NULL | - | - | - |
| 4 | `visible_category` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `content` | `text` | YES | NULL | - | - | - |
| 6 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 7 | `user_id` | `int(11)` | YES | NULL | - | - | - |
| 8 | `read_count` | `int(11)` | YES | 0 | - | - | - |
| 9 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `top` | `tinyint(1)` | YES | 0 | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_announcements_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## api_keys

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 1397 |
| 数据容量 | 0.14 MB |
| 索引容量 | 0.14 MB |
| 总容量 | 0.28 MB |
| 创建时间 | 2026-03-03 11:11:47 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `access_token` | `varchar(255)` | YES | NULL | MUL | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_api_keys_on_access_token` | BTREE | 非唯一 | `access_token` |
| `index_api_keys_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## app_versions

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 2 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:11:48 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `app_type` | `int(11)` | YES | NULL | - | - | - |
| 4 | `version_name` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `version_code` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `download_url` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `upgrade` | `int(11)` | YES | NULL | - | - | - |
| 8 | `changelogs` | `text` | YES | NULL | - | - | - |
| 9 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## approvals

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 87938 |
| 数据容量 | 10.52 MB |
| 索引容量 | 10.55 MB |
| 总容量 | 21.06 MB |
| 创建时间 | 2026-03-03 11:11:49 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `approvable_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `approvable_type` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `approve_status` | `tinyint(4)` | YES | 3 | - | - | - |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_approvals_on_approvable_id_and_approvable_type` | BTREE | 非唯一 | `approvable_id`, `approvable_type` |
| `index_approvals_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_approvals_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## apps

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 16 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:12:15 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `app_id` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `app_secret` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `access_token` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `app_type` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `app_name` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## archivers

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 28746 |
| 数据容量 | 120.56 MB |
| 索引容量 | 4.55 MB |
| 总容量 | 125.11 MB |
| 创建时间 | 2026-03-03 11:12:16 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `model_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `model_type` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `value` | `longtext` | YES | NULL | - | - | - |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_archivers_on_model_id_and_model_type` | BTREE | 非唯一 | `model_id`, `model_type` |
| `index_archivers_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_archivers_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## asr_entity_maps

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:12:28 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `request_id` | `varchar(255)` | YES | NULL | UNI | - | - |
| 3 | `entity_type` | `varchar(255)` | YES | NULL | MUL | - | - |
| 4 | `entity_id` | `int(11)` | YES | NULL | - | - | - |
| 5 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_asr_entity_maps_on_entity_type_and_entity_id` | BTREE | 非唯一 | `entity_type`, `entity_id` |
| `index_asr_entity_maps_on_request_id` | BTREE | 唯一 | `request_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## asset_addresses

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.09 MB |
| 总容量 | 0.11 MB |
| 创建时间 | 2026-03-03 11:12:28 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `addressable_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `addressable_type` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `title` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `snippet` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `province_id` | `int(11)` | YES | NULL | MUL | - | - |
| 7 | `city_id` | `int(11)` | YES | NULL | MUL | - | - |
| 8 | `district_id` | `int(11)` | YES | NULL | MUL | - | - |
| 9 | `zip` | `varchar(255)` | YES | NULL | - | - | - |
| 10 | `lat` | `float` | YES | NULL | MUL | - | - |
| 11 | `lon` | `float` | YES | NULL | - | - | - |
| 12 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 13 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 14 | `country_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_asset_addresses_on_addressable_id_and_addressable_type` | BTREE | 非唯一 | `addressable_id`, `addressable_type` |
| `index_asset_addresses_on_city_id` | BTREE | 非唯一 | `city_id` |
| `index_asset_addresses_on_country_id` | BTREE | 非唯一 | `country_id` |
| `index_asset_addresses_on_district_id` | BTREE | 非唯一 | `district_id` |
| `index_asset_addresses_on_lat_and_lon` | BTREE | 非唯一 | `lat`, `lon` |
| `index_asset_addresses_on_province_id` | BTREE | 非唯一 | `province_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ats

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 52493 |
| 数据容量 | 7.52 MB |
| 索引容量 | 9.06 MB |
| 总容量 | 16.58 MB |
| 创建时间 | 2026-03-03 11:12:28 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `atable_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `atable_type` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `at_user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_ats_on_at_user_id` | BTREE | 非唯一 | `at_user_id` |
| `index_ats_on_atable_id_and_atable_type` | BTREE | 非唯一 | `atable_id`, `atable_type` |
| `index_ats_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_ats_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## attachments

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 62325 |
| 数据容量 | 24.55 MB |
| 索引容量 | 9.06 MB |
| 总容量 | 33.61 MB |
| 创建时间 | 2026-03-03 11:12:41 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `attachmentable_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `attachmentable_type` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `file_file_name` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `file_content_type` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `file_file_size` | `int(11)` | YES | NULL | - | - | - |
| 10 | `file_updated_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 12 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 13 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 14 | `note` | `text` | YES | NULL | - | - | - |
| 15 | `sub_type` | `varchar(255)` | YES | NULL | - | - | - |
| 16 | `qiniu_persistent_id` | `varchar(255)` | YES | NULL | MUL | - | - |
| 17 | `attachment_position` | `int(11)` | YES | NULL | - | - | - |
| 18 | `wx_media_id` | `varchar(255)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_attachments_on_attachmentable_id_and_attachmentable_type` | BTREE | 非唯一 | `attachmentable_id`, `attachmentable_type` |
| `index_attachments_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_attachments_on_qiniu_persistent_id` | BTREE | 非唯一 | `qiniu_persistent_id` |
| `index_attachments_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## audios

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 71 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-03 11:13:03 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `audio_type` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `audioable_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `audioable_type` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `sub_type` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `file_file_name` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `file_content_type` | `varchar(255)` | YES | NULL | - | - | - |
| 10 | `file_file_size` | `int(11)` | YES | NULL | - | - | - |
| 11 | `file_updated_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `duration` | `float` | YES | NULL | - | - | - |
| 13 | `qiniu_persistent_id` | `varchar(255)` | YES | NULL | MUL | - | - |
| 14 | `dingtalk_media_id` | `varchar(255)` | YES | NULL | - | - | - |
| 15 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 16 | `wx_media_id` | `varchar(255)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_audios_on_audioable_id_and_audioable_type` | BTREE | 非唯一 | `audioable_id`, `audioable_type` |
| `index_audios_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_audios_on_qiniu_persistent_id` | BTREE | 非唯一 | `qiniu_persistent_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## authentications

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:13:04 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `open_id` | `varchar(255)` | YES | NULL | MUL | - | - |
| 4 | `provider` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `access_token` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `refresh_token` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `expired_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_authentications_on_open_id` | BTREE | 非唯一 | `open_id` |
| `index_authentications_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## bills

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.06 MB |
| 总容量 | 0.08 MB |
| 创建时间 | 2026-03-03 11:13:04 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `account_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `package_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `package_count` | `int(11)` | YES | NULL | - | - | - |
| 5 | `start` | `date` | YES | NULL | - | - | - |
| 6 | `end` | `date` | YES | NULL | - | - | - |
| 7 | `amount` | `decimal(12,3)` | YES | 0.000 | - | - | - |
| 8 | `paid_amount` | `decimal(12,3)` | YES | 0.000 | - | - | - |
| 9 | `package_amount` | `decimal(12,3)` | YES | 0.000 | - | - | - |
| 10 | `package_paid_amount` | `decimal(12,2)` | YES | 0.00 | - | - | - |
| 11 | `pstn_duration_out_out_package` | `int(11)` | YES | 0 | - | - | - |
| 12 | `pstn_duration_in_out_package` | `int(11)` | YES | 0 | - | - | - |
| 13 | `pstn_amount_out_out_package` | `decimal(12,3)` | YES | 0.000 | - | - | - |
| 14 | `pstn_amount_in_out_package` | `decimal(12,3)` | YES | 0.000 | - | - | - |
| 15 | `sip_duration_out_out_package` | `int(11)` | YES | 0 | - | - | - |
| 16 | `sip_duration_in_out_package` | `int(11)` | YES | 0 | - | - | - |
| 17 | `sip_amount_out_out_package` | `decimal(12,3)` | YES | 0.000 | - | - | - |
| 18 | `sip_amount_in_out_package` | `decimal(12,3)` | YES | 0.000 | - | - | - |
| 19 | `recording_duration_out_out_package` | `int(11)` | YES | 0 | - | - | - |
| 20 | `recording_duration_in_out_package` | `int(11)` | YES | 0 | - | - | - |
| 21 | `recording_amount_out_out_package` | `decimal(12,3)` | YES | 0.000 | - | - | - |
| 22 | `recording_amount_in_out_package` | `decimal(12,3)` | YES | 0.000 | - | - | - |
| 23 | `status` | `int(11)` | YES | 0 | MUL | - | - |
| 24 | `paid_at` | `datetime` | YES | NULL | - | - | - |
| 25 | `deleted_at` | `datetime` | YES | NULL | MUL | - | - |
| 26 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 27 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_bills_on_account_id_and_status` | BTREE | 非唯一 | `account_id`, `status` |
| `index_bills_on_deleted_at` | BTREE | 非唯一 | `deleted_at` |
| `index_bills_on_package_id` | BTREE | 非唯一 | `package_id` |
| `index_bills_on_status` | BTREE | 非唯一 | `status` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## business_query_accounts

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 1001 |
| 数据容量 | 0.19 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.22 MB |
| 创建时间 | 2026-03-03 11:13:04 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `count` | `int(11)` | YES | 0 | - | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `status` | `int(11)` | YES | NULL | - | - | - |
| 6 | `cio_uid` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `access_token` | `text` | YES | NULL | - | - | - |
| 8 | `access_token_expire_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `user_token` | `varchar(255)` | YES | NULL | - | - | - |
| 10 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `last_month_residue_count` | `int(11)` | YES | 0 | - | - | - |
| 13 | `last_month_renew_use_count` | `int(11)` | YES | 0 | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_business_query_accounts_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_business_query_accounts_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## business_query_event_notifications

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:13:06 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `pid` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `event_id` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `user_id` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `event_name` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `event_content` | `text` | YES | NULL | - | - | - |
| 7 | `entname` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `category` | `int(11)` | YES | NULL | - | - | - |
| 9 | `level` | `int(11)` | YES | NULL | - | - | - |
| 10 | `happen_date` | `datetime` | YES | NULL | - | - | - |
| 11 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## business_query_orders

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.06 MB |
| 总容量 | 0.08 MB |
| 创建时间 | 2026-03-03 11:13:06 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `status` | `int(11)` | YES | NULL | - | - | - |
| 3 | `amount` | `decimal(10,2)` | YES | 0.00 | - | - | - |
| 4 | `balance_count` | `int(11)` | YES | 0 | - | - | - |
| 5 | `count` | `int(11)` | YES | 0 | - | - | - |
| 6 | `dealt_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 8 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 9 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `order_number` | `varchar(255)` | YES | NULL | MUL | - | - |
| 12 | `business_query_account_id` | `int(11)` | YES | NULL | MUL | - | - |
| 13 | `risk_package_id` | `int(11)` | YES | NULL | - | - | - |
| 14 | `source` | `int(11)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_business_query_orders_on_business_query_account_id` | BTREE | 非唯一 | `business_query_account_id` |
| `index_business_query_orders_on_order_number` | BTREE | 非唯一 | `order_number` |
| `index_business_query_orders_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_business_query_orders_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## business_query_subscriptions

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.06 MB |
| 总容量 | 0.08 MB |
| 创建时间 | 2026-03-03 11:13:06 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `customer_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `cio_pid` | `varchar(255)` | YES | NULL | MUL | - | - |
| 4 | `cio_company_name` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `subscribe_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `expire_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `is_renewal` | `tinyint(1)` | YES | NULL | - | - | - |
| 8 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 9 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 10 | `status` | `int(11)` | YES | NULL | - | - | - |
| 11 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_business_query_subscriptions_on_cio_pid` | BTREE | 非唯一 | `cio_pid` |
| `index_business_query_subscriptions_on_customer_id` | BTREE | 非唯一 | `customer_id` |
| `index_business_query_subscriptions_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_business_query_subscriptions_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## call_agents

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.06 MB |
| 总容量 | 0.08 MB |
| 创建时间 | 2026-03-03 11:13:06 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `call_center_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `agent_id` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `package_id` | `int(11)` | YES | NULL | - | - | - |
| 7 | `prev_package_id` | `int(11)` | YES | NULL | - | - | - |
| 8 | `login` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `password` | `varchar(255)` | YES | NULL | - | - | - |
| 10 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 11 | `mobile` | `varchar(255)` | YES | NULL | - | - | - |
| 12 | `bind_tel` | `varchar(255)` | YES | NULL | - | - | - |
| 13 | `call_display_number` | `varchar(255)` | YES | NULL | - | - | - |
| 14 | `transfer_tel` | `varchar(255)` | YES | NULL | - | - | - |
| 15 | `enabled_transfer` | `tinyint(1)` | YES | 0 | - | - | - |
| 16 | `enabled` | `tinyint(1)` | YES | 1 | - | - | - |
| 17 | `status` | `int(11)` | YES | NULL | - | - | - |
| 18 | `package_status` | `int(11)` | YES | 0 | - | - | - |
| 19 | `agent_type` | `int(11)` | YES | 0 | - | - | - |
| 20 | `warned_threshold` | `int(11)` | YES | 10000 | - | - | - |
| 21 | `prev_locked_threshold` | `int(11)` | YES | 24 | - | - | - |
| 22 | `changed_at` | `datetime` | YES | NULL | - | - | - |
| 23 | `actived_at` | `datetime` | YES | NULL | - | - | - |
| 24 | `warned_at` | `datetime` | YES | NULL | - | - | - |
| 25 | `prev_locked_at` | `datetime` | YES | NULL | - | - | - |
| 26 | `locked_at` | `datetime` | YES | NULL | - | - | - |
| 27 | `deleted_at` | `datetime` | YES | NULL | MUL | - | - |
| 28 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 29 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 30 | `call_private_protect` | `tinyint(1)` | YES | 0 | - | - | - |
| 31 | `email` | `varchar(255)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_call_agents_on_call_center_id` | BTREE | 非唯一 | `call_center_id` |
| `index_call_agents_on_deleted_at` | BTREE | 非唯一 | `deleted_at` |
| `index_call_agents_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_call_agents_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## call_centers

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-03 11:13:06 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `center_id` | `varchar(255)` | YES | NULL | MUL | - | - |
| 4 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `hotline` | `text` | YES | NULL | - | - | - |
| 6 | `agents_count` | `int(11)` | YES | 0 | - | - | - |
| 7 | `login` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `password` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `status` | `int(11)` | YES | NULL | - | - | - |
| 10 | `prev_source` | `int(11)` | YES | NULL | - | - | - |
| 11 | `source` | `int(11)` | YES | NULL | - | - | - |
| 12 | `strategy` | `varchar(255)` | YES | base | - | - | - |
| 13 | `package_id` | `int(11)` | YES | NULL | - | - | - |
| 14 | `enabled` | `tinyint(1)` | YES | 1 | - | - | - |
| 15 | `deleted_at` | `datetime` | YES | NULL | MUL | - | - |
| 16 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 17 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 18 | `sub_account_sid` | `varchar(255)` | YES | NULL | - | - | - |
| 19 | `sub_auth_token` | `varchar(255)` | YES | NULL | - | - | - |
| 20 | `channel_type` | `int(11)` | YES | NULL | - | - | - |
| 21 | `instance_id` | `varchar(255)` | YES | NULL | - | - | - |
| 22 | `agent_group_id` | `varchar(255)` | YES | NULL | - | - | - |
| 23 | `expired_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_call_centers_on_center_id` | BTREE | 非唯一 | `center_id` |
| `index_call_centers_on_deleted_at` | BTREE | 非唯一 | `deleted_at` |
| `index_call_centers_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## call_queues

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-03 11:13:07 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `call_center_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `queue_id` | `varchar(255)` | YES | NULL | MUL | - | - |
| 5 | `hotline` | `varchar(255)` | YES | NULL | MUL | - | - |
| 6 | `strategy` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `voice` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `max_number` | `int(11)` | YES | NULL | - | - | - |
| 9 | `status` | `int(11)` | YES | 0 | - | - | - |
| 10 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_call_queues_on_call_center_id` | BTREE | 非唯一 | `call_center_id` |
| `index_call_queues_on_hotline` | BTREE | 非唯一 | `hotline` |
| `index_call_queues_on_queue_id` | BTREE | 非唯一 | `queue_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## call_records

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.08 MB |
| 总容量 | 0.09 MB |
| 创建时间 | 2026-03-03 11:13:07 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `recordable_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `recordable_type` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `agent_id` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `call_type` | `tinyint(4)` | YES | 0 | - | - | - |
| 8 | `device_type` | `tinyint(4)` | YES | 0 | - | - | - |
| 9 | `status` | `tinyint(4)` | YES | 0 | - | - | - |
| 10 | `call_id` | `varchar(255)` | YES | NULL | UNI | - | - |
| 11 | `calling_number` | `varchar(255)` | YES | NULL | - | - | - |
| 12 | `called_number` | `varchar(255)` | YES | NULL | - | - | - |
| 13 | `total_time` | `int(11)` | YES | NULL | - | - | - |
| 14 | `ivr_time` | `int(11)` | YES | NULL | - | - | - |
| 15 | `agent_time` | `int(11)` | YES | NULL | - | - | - |
| 16 | `user_time` | `int(11)` | YES | NULL | - | - | - |
| 17 | `charge` | `decimal(10,0)` | YES | NULL | - | - | - |
| 18 | `tts` | `int(11)` | YES | NULL | - | - | - |
| 19 | `file_name` | `varchar(255)` | YES | NULL | - | - | - |
| 20 | `key` | `varchar(255)` | YES | NULL | MUL | - | - |
| 21 | `wav_key` | `varchar(255)` | YES | NULL | - | - | - |
| 22 | `content` | `text` | YES | NULL | - | - | - |
| 23 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 24 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_call_records_on_call_id` | BTREE | 唯一 | `call_id` |
| `index_call_records_on_key` | BTREE | 非唯一 | `key` |
| `index_call_records_on_organization_id_and_created_at` | BTREE | 非唯一 | `organization_id`, `created_at` |
| `index_call_records_on_recordable_id_and_recordable_type` | BTREE | 非唯一 | `recordable_id`, `recordable_type` |
| `index_call_records_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## callagents

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:13:07 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | - | - | - |
| 3 | `callcenter_id` | `int(11)` | YES | NULL | - | - | - |
| 4 | `user_id` | `int(11)` | YES | NULL | - | - | - |
| 5 | `login` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `job_number` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `password` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `bind_tel` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `status` | `int(11)` | YES | NULL | - | - | - |
| 10 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## callcenters

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:13:07 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | - | - | - |
| 3 | `center_id` | `int(11)` | YES | NULL | - | - | - |
| 4 | `hotline` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `login_host` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `login` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `password` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `source` | `int(11)` | YES | NULL | - | - | - |
| 9 | `status` | `int(11)` | YES | NULL | - | - | - |
| 10 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 13 | `access_token` | `varchar(255)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## checkins

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.08 MB |
| 总容量 | 0.09 MB |
| 创建时间 | 2026-03-03 11:13:07 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `app` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `message` | `text` | YES | NULL | - | - | - |
| 6 | `lat` | `float` | YES | NULL | - | - | - |
| 7 | `lng` | `float` | YES | NULL | - | - | - |
| 8 | `checkable_id` | `int(11)` | YES | NULL | MUL | - | - |
| 9 | `checkable_type` | `varchar(255)` | YES | NULL | - | - | - |
| 10 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `customer_id` | `int(11)` | YES | NULL | MUL | - | - |
| 13 | `opportunity_id` | `int(11)` | YES | NULL | MUL | - | - |
| 14 | `category` | `int(11)` | YES | NULL | - | - | - |
| 15 | `remind_at` | `datetime` | YES | NULL | - | - | - |
| 16 | `off_distance` | `float` | YES | NULL | - | - | - |
| 17 | `checkin_at` | `datetime` | YES | NULL | - | - | - |
| 18 | `device_info` | `varchar(255)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_checkins_on_checkable_id_and_checkable_type` | BTREE | 非唯一 | `checkable_id`, `checkable_type` |
| `index_checkins_on_customer_id` | BTREE | 非唯一 | `customer_id` |
| `index_checkins_on_opportunity_id` | BTREE | 非唯一 | `opportunity_id` |
| `index_checkins_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_checkins_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## cities

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 379 |
| 数据容量 | 0.06 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.11 MB |
| 创建时间 | 2026-03-03 11:13:07 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | MUL | - | - |
| 3 | `pinyin` | `varchar(255)` | YES | NULL | MUL | - | - |
| 4 | `gbt_code` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `province_id` | `int(11)` | YES | NULL | MUL | - | - |
| 6 | `sort` | `int(11)` | YES | NULL | - | - | - |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_cities_on_name` | BTREE | 非唯一 | `name` |
| `index_cities_on_pinyin` | BTREE | 非唯一 | `pinyin` |
| `index_cities_on_province_id` | BTREE | 非唯一 | `province_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## cms_material_users

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:13:08 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | - | - | - |
| 3 | `cms_id` | `int(11)` | YES | NULL | - | - | - |
| 4 | `show_count` | `int(11)` | YES | 0 | - | - | - |
| 5 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `max_show_count` | `int(11)` | YES | 1 | - | - | - |
| 8 | `platform_type` | `int(11)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## cms_materials

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:13:08 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `cms_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `start_at` | `datetime` | YES | NULL | - | - | - |
| 4 | `end_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `forbidden_status` | `int(11)` | YES | NULL | - | - | - |
| 6 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `organization_id` | `int(11)` | YES | NULL | - | - | - |
| 9 | `role_type` | `int(11)` | YES | NULL | - | - | - |
| 10 | `is_all` | `int(11)` | YES | NULL | MUL | - | - |
| 11 | `platform_type` | `int(11)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_cms_materials_on_cms_id_and_platform_type` | BTREE | 非唯一 | `cms_id`, `platform_type` |
| `index_cms_materials_on_is_all_and_platform_type` | BTREE | 非唯一 | `is_all`, `platform_type` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## commission_rules

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:13:09 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | MUL | - | - |
| 3 | `rule_type` | `int(11)` | YES | 0 | - | - | - |
| 4 | `own_type` | `int(11)` | YES | 0 | - | - | - |
| 5 | `range_indicator` | `int(11)` | YES | NULL | - | - | - |
| 6 | `range_indicator_period` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `commission_indicator_type` | `int(11)` | YES | NULL | - | - | - |
| 8 | `commission_indicator` | `int(11)` | YES | NULL | - | - | - |
| 9 | `commission_indicator_period` | `varchar(255)` | YES | NULL | - | - | - |
| 10 | `commission_rule_setting` | `text` | YES | NULL | - | - | - |
| 11 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 12 | `created_at` | `datetime` | NO | NULL | - | - | - |
| 13 | `updated_at` | `datetime` | NO | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_commission_rules_on_name` | BTREE | 非唯一 | `name` |
| `index_commission_rules_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## commission_rules_stations

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:13:09 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `station_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `commission_rule_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_commission_rules_stations_on_commission_rule_id` | BTREE | 非唯一 | `commission_rule_id` |
| `index_commission_rules_stations_on_station_id` | BTREE | 非唯一 | `station_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## commission_stats

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-03 11:13:09 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `value` | `decimal(24,6)` | YES | NULL | - | - | - |
| 3 | `ratio` | `text` | YES | NULL | - | - | - |
| 4 | `range_value` | `decimal(24,6)` | YES | NULL | - | - | - |
| 5 | `commission_value` | `decimal(24,6)` | YES | NULL | - | - | - |
| 6 | `commission_rule_id` | `int(11)` | YES | NULL | MUL | - | - |
| 7 | `stat_date` | `date` | YES | NULL | - | - | - |
| 8 | `rule_range` | `text` | YES | NULL | - | - | - |
| 9 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 10 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 11 | `created_at` | `datetime` | NO | NULL | - | - | - |
| 12 | `updated_at` | `datetime` | NO | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_commission_stats_on_commission_rule_id` | BTREE | 非唯一 | `commission_rule_id` |
| `index_commission_stats_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_commission_stats_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## common_entity_owners

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:13:09 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `entity_klass_name` | `int(11)` | YES | NULL | - | - | - |
| 3 | `ownerable_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `ownerable_type` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 6 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_common_entity_owners_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_common_entity_owners_on_ownerable_id_and_ownerable_type` | BTREE | 非唯一 | `ownerable_id`, `ownerable_type` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## contact_addresses

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 7612 |
| 数据容量 | 2.52 MB |
| 索引容量 | 1.59 MB |
| 总容量 | 4.11 MB |
| 创建时间 | 2026-03-03 11:13:09 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `addressable_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `addressable_type` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `country_id` | `int(11)` | YES | NULL | - | - | - |
| 5 | `province_id` | `int(11)` | YES | NULL | MUL | - | - |
| 6 | `city_id` | `int(11)` | YES | NULL | MUL | - | - |
| 7 | `district_id` | `int(11)` | YES | NULL | MUL | - | - |
| 8 | `tel` | `varchar(255)` | YES | NULL | MUL | - | - |
| 9 | `phone` | `varchar(255)` | YES | NULL | MUL | - | - |
| 10 | `email` | `varchar(255)` | YES | NULL | - | - | - |
| 11 | `qq` | `varchar(255)` | YES | NULL | - | - | - |
| 12 | `fax` | `varchar(255)` | YES | NULL | - | - | - |
| 13 | `wechat` | `varchar(255)` | YES | NULL | - | - | - |
| 14 | `wangwang` | `varchar(255)` | YES | NULL | - | - | - |
| 15 | `zip` | `varchar(255)` | YES | NULL | - | - | - |
| 16 | `url` | `varchar(255)` | YES | NULL | - | - | - |
| 17 | `detail_address` | `varchar(255)` | YES | NULL | - | - | - |
| 18 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 19 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 20 | `lat` | `decimal(10,6)` | YES | NULL | MUL | - | - |
| 21 | `lng` | `decimal(10,6)` | YES | NULL | - | - | - |
| 22 | `off_distance` | `float` | YES | NULL | - | - | - |
| 23 | `region_info` | `varchar(255)` | YES | NULL | - | - | - |
| 24 | `snippet` | `varchar(255)` | YES | NULL | - | - | - |
| 25 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_addresses_on_city_id` | BTREE | 非唯一 | `city_id` |
| `index_addresses_on_district_id` | BTREE | 非唯一 | `district_id` |
| `index_addresses_on_lat_and_lng` | BTREE | 非唯一 | `lat`, `lng` |
| `index_addresses_on_phone` | BTREE | 非唯一 | `phone` |
| `index_addresses_on_province_id` | BTREE | 非唯一 | `province_id` |
| `index_addresses_on_tel` | BTREE | 非唯一 | `tel` |
| `index_contact_addresses_on_addressable_id` | BTREE | 非唯一 | `addressable_id` |
| `index_contact_addresses_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## contact_assets

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-03 11:13:13 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `text_asset` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `text_area_asset` | `text` | YES | NULL | - | - | - |
| 4 | `date_asset` | `date` | YES | NULL | - | - | - |
| 5 | `datetime_asset` | `datetime` | YES | NULL | - | - | - |
| 6 | `numeric_asset` | `decimal(24,6)` | YES | NULL | - | - | - |
| 7 | `entity_id` | `int(11)` | YES | NULL | MUL | - | - |
| 8 | `custom_field_name` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `custom_field_id` | `int(11)` | YES | NULL | MUL | - | - |
| 10 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 11 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_contact_assets_on_custom_field_id` | BTREE | 非唯一 | `custom_field_id` |
| `index_contact_assets_on_entity_id` | BTREE | 非唯一 | `entity_id` |
| `index_contact_assets_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## contact_assetships

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 1227 |
| 数据容量 | 0.14 MB |
| 索引容量 | 0.16 MB |
| 总容量 | 0.30 MB |
| 创建时间 | 2026-03-03 11:13:14 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `assetable_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `assetable_type` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `contact_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 6 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `category` | `varchar(255)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_contact_assetships_on_assetable_id_and_assetable_type` | BTREE | 非唯一 | `assetable_id`, `assetable_type` |
| `index_contact_assetships_on_contact_id` | BTREE | 非唯一 | `contact_id` |
| `index_contact_assetships_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## contacts

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 8107 |
| 数据容量 | 1.52 MB |
| 索引容量 | 1.05 MB |
| 总容量 | 2.56 MB |
| 创建时间 | 2026-03-03 11:13:15 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `department` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `job` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 9 | `parent_id` | `int(11)` | YES | NULL | - | - | - |
| 10 | `gender` | `int(11)` | YES | NULL | - | - | - |
| 11 | `category` | `varchar(255)` | YES | NULL | - | - | - |
| 12 | `customer_id` | `int(11)` | YES | NULL | MUL | - | - |
| 13 | `note` | `text` | YES | NULL | - | - | - |
| 14 | `birth_date` | `date` | YES | NULL | MUL | - | - |
| 15 | `name_pinyin` | `varchar(255)` | YES | NULL | - | - | - |
| 16 | `born_from` | `int(11)` | YES | NULL | - | - | - |
| 17 | `creator_id` | `int(11)` | YES | NULL | MUL | - | - |
| 18 | `before_user_id` | `int(11)` | YES | NULL | - | - | - |
| 19 | `ding_ext_contact_id` | `varchar(255)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_contacts_on_birth_date` | BTREE | 非唯一 | `birth_date` |
| `index_contacts_on_creator_id` | BTREE | 非唯一 | `creator_id` |
| `index_contacts_on_customer_id` | BTREE | 非唯一 | `customer_id` |
| `index_contacts_on_ding_ext_contact_id` | BTREE | 非唯一 | `ding_ext_contact_id` |
| `index_contacts_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_contacts_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## contacts_expenses

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:13:18 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `expense_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `contact_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_contacts_expenses_on_contact_id` | BTREE | 非唯一 | `contact_id` |
| `index_contacts_expenses_on_expense_id` | BTREE | 非唯一 | `expense_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## contacts_revisit_logs

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 9573 |
| 数据容量 | 0.34 MB |
| 索引容量 | 0.47 MB |
| 总容量 | 0.81 MB |
| 创建时间 | 2026-03-03 11:13:18 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `revisit_log_id` | `int(11)` | NO | NULL | MUL | - | - |
| 2 | `contact_id` | `int(11)` | NO | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `index_contacts_revisit_logs_on_contact_id_and_revisit_log_id` | BTREE | 非唯一 | `contact_id`, `revisit_log_id` |
| `index_contacts_revisit_logs_on_revisit_log_id_and_contact_id` | BTREE | 非唯一 | `revisit_log_id`, `contact_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## contract_assets

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 889596 |
| 数据容量 | 119.67 MB |
| 索引容量 | 67.64 MB |
| 总容量 | 187.31 MB |
| 创建时间 | 2026-03-03 11:13:24 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `text_asset` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `text_area_asset` | `text` | YES | NULL | - | - | - |
| 4 | `date_asset` | `date` | YES | NULL | - | - | - |
| 5 | `datetime_asset` | `datetime` | YES | NULL | - | - | - |
| 6 | `numeric_asset` | `decimal(24,6)` | YES | NULL | - | - | - |
| 7 | `entity_id` | `int(11)` | YES | NULL | MUL | - | - |
| 8 | `custom_field_name` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `custom_field_id` | `int(11)` | YES | NULL | MUL | - | - |
| 10 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 11 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_contract_assets_on_custom_field_id` | BTREE | 非唯一 | `custom_field_id` |
| `index_contract_assets_on_entity_id` | BTREE | 非唯一 | `entity_id` |
| `index_contract_assets_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## contract_multistep_approves

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 46686 |
| 数据容量 | 10.52 MB |
| 索引容量 | 4.55 MB |
| 总容量 | 15.06 MB |
| 创建时间 | 2026-03-03 11:16:12 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `contract_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `step` | `int(11)` | YES | NULL | - | - | - |
| 6 | `status` | `int(11)` | YES | NULL | - | - | - |
| 7 | `approve_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `content` | `text` | YES | NULL | - | - | - |
| 9 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_contract_multistep_approves_on_contract_id` | BTREE | 非唯一 | `contract_id` |
| `index_contract_multistep_approves_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_contract_multistep_approves_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## contract_notify_user_maps

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 11333 |
| 数据容量 | 1.52 MB |
| 索引容量 | 0.59 MB |
| 总容量 | 2.11 MB |
| 创建时间 | 2026-03-03 11:16:21 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `contract_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_contract_notify_user_maps_on_contract_id` | BTREE | 非唯一 | `contract_id` |
| `index_contract_notify_user_maps_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## contracts

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 17312 |
| 数据容量 | 12.52 MB |
| 索引容量 | 4.61 MB |
| 总容量 | 17.12 MB |
| 创建时间 | 2026-03-03 11:16:24 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `category` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `payment_type` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `status` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 6 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `title` | `varchar(255)` | YES | NULL | - | - | - |
| 10 | `customer_id` | `int(11)` | YES | NULL | MUL | - | - |
| 11 | `opportunity_id` | `int(11)` | YES | NULL | MUL | - | - |
| 12 | `total_amount` | `decimal(24,6)` | YES | NULL | - | - | - |
| 13 | `start_at` | `date` | YES | NULL | - | - | - |
| 14 | `end_at` | `date` | YES | NULL | - | - | - |
| 15 | `customer_signer` | `varchar(255)` | YES | NULL | - | - | - |
| 16 | `our_signer` | `varchar(255)` | YES | NULL | - | - | - |
| 17 | `special_terms` | `text` | YES | NULL | - | - | - |
| 18 | `sn` | `varchar(255)` | YES | NULL | - | - | - |
| 19 | `sign_date` | `date` | YES | NULL | - | - | - |
| 20 | `department_id` | `int(11)` | YES | NULL | MUL | - | - |
| 21 | `title_pinyin` | `varchar(255)` | YES | NULL | - | - | - |
| 22 | `revisit_at` | `datetime` | YES | NULL | MUL | - | - |
| 23 | `real_revisit_at` | `datetime` | YES | NULL | - | - | - |
| 24 | `revisit_remind_at` | `datetime` | YES | NULL | MUL | - | - |
| 25 | `approve_status` | `tinyint(4)` | YES | 3 | - | - | - |
| 26 | `approve_deny_type` | `tinyint(4)` | YES | 0 | - | - | - |
| 27 | `creator_id` | `int(11)` | YES | NULL | MUL | - | - |
| 28 | `before_user_id` | `int(11)` | YES | NULL | - | - | - |
| 29 | `before_department_id` | `int(11)` | YES | NULL | - | - | - |
| 30 | `received_payments_amount` | `decimal(24,6)` | YES | NULL | - | - | - |
| 31 | `unreceived_amount` | `decimal(24,6)` | YES | NULL | - | - | - |
| 32 | `checking_payments_amount` | `decimal(24,6)` | YES | NULL | - | - | - |
| 33 | `unchecking_payments_amount` | `decimal(24,6)` | YES | NULL | - | - | - |
| 34 | `step` | `int(11)` | YES | 0 | - | - | - |
| 35 | `submit_applying_at` | `datetime` | YES | NULL | - | - | - |
| 36 | `finish_approve_at` | `datetime` | YES | NULL | - | - | - |
| 37 | `pending_step` | `int(11)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_contracts_on_creator_id` | BTREE | 非唯一 | `creator_id` |
| `index_contracts_on_customer_id` | BTREE | 非唯一 | `customer_id` |
| `index_contracts_on_department_id` | BTREE | 非唯一 | `department_id` |
| `index_contracts_on_opportunity_id` | BTREE | 非唯一 | `opportunity_id` |
| `index_contracts_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_contracts_on_revisit_at` | BTREE | 非唯一 | `revisit_at` |
| `index_contracts_on_revisit_remind_at` | BTREE | 非唯一 | `revisit_remind_at` |
| `index_contracts_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## countries

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 243 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:16:33 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | MUL | - | - |
| 3 | `pinyin` | `varchar(255)` | YES | NULL | MUL | - | - |
| 4 | `sort` | `int(11)` | YES | NULL | - | - | - |
| 5 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_countries_on_name` | BTREE | 非唯一 | `name` |
| `index_countries_on_pinyin` | BTREE | 非唯一 | `pinyin` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## cross_site_entities

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:16:34 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `cross_siteable_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `cross_siteable_type` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `source` | `int(11)` | YES | NULL | - | - | - |
| 5 | `uid` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `token` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `status` | `int(11)` | YES | NULL | - | - | - |
| 10 | `data` | `text` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_cs_entities_on_cs_id_and_cs_type` | BTREE | 非唯一 | `cross_siteable_id`, `cross_siteable_type` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## custom_columns

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 1250 |
| 数据容量 | 0.52 MB |
| 索引容量 | 0.06 MB |
| 总容量 | 0.58 MB |
| 创建时间 | 2026-03-03 11:16:34 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `model_klass` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `display_columns` | `text` | YES | NULL | - | - | - |
| 5 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_custom_columns_on_user_id_and_model_klass` | BTREE | 非唯一 | `user_id`, `model_klass` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## custom_field_groups

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 41860 |
| 数据容量 | 12.52 MB |
| 索引容量 | 4.55 MB |
| 总容量 | 17.06 MB |
| 创建时间 | 2026-03-03 11:16:36 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `label` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `position` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `status` | `int(11)` | YES | NULL | - | - | - |
| 5 | `html_options` | `text` | YES | NULL | - | - | - |
| 6 | `custom_field_setting_id` | `int(11)` | YES | NULL | MUL | - | - |
| 7 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 8 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `options` | `text` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_custom_field_groups_on_custom_field_setting_id` | BTREE | 非唯一 | `custom_field_setting_id` |
| `index_custom_field_groups_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_custom_field_groups_on_position` | BTREE | 非唯一 | `position` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## custom_field_settings

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 13345 |
| 数据容量 | 1.52 MB |
| 索引容量 | 1.84 MB |
| 总容量 | 3.36 MB |
| 创建时间 | 2026-03-03 11:16:46 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `model_klass` | `varchar(255)` | YES | NULL | MUL | - | - |
| 3 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_custom_field_settings_on_model_klass` | BTREE | 非唯一 | `model_klass` |
| `index_custom_field_settings_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## custom_field_template_fields

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 214 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:16:49 |
| 更新时间 | - |
| 表注释 | ??????? |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | ?? |
| 2 | `custom_field_id` | `int(11)` | YES | NULL | MUL | - | ??id |
| 3 | `custom_field_template_id` | `int(11)` | NO | NULL | MUL | - | ??id |
| 4 | `status` | `int(11)` | YES | NULL | - | - | ??? 0??? ?1??? |
| 5 | `required` | `tinyint(1)` | YES | NULL | - | - | ???? ? 0????  1???  ; |
| 6 | `category` | `int(11)` | YES | NULL | - | - | - |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | ???? |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | ???? |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `custom_field_template_fields_on_custom_field_id` | BTREE | 非唯一 | `custom_field_id` |
| `custom_field_template_fields_on_custom_field_template_id` | BTREE | 非唯一 | `custom_field_template_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## custom_field_template_roles

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 74 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-03 11:16:51 |
| 更新时间 | - |
| 表注释 | ??????? |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | ?? |
| 2 | `organization_id` | `int(11)` | NO | NULL | MUL | - | ??id |
| 3 | `custom_field_template_id` | `int(11)` | NO | NULL | MUL | - | ??id |
| 4 | `role_id` | `int(11)` | NO | NULL | MUL | - | ??id |
| 5 | `created_at` | `datetime` | YES | NULL | - | - | ???? |
| 6 | `updated_at` | `datetime` | YES | NULL | - | - | ???? |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `custom_field_template_roles_on_custom_field_template_id` | BTREE | 非唯一 | `custom_field_template_id` |
| `custom_field_template_roles_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `custom_field_template_roles_on_role_id` | BTREE | 非唯一 | `role_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## custom_field_templates

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 2 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:16:52 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | ?? |
| 2 | `custom_field_setting_id` | `int(11)` | NO | NULL | MUL | - | ??id |
| 3 | `organization_id` | `int(11)` | NO | NULL | MUL | - | ??id |
| 4 | `name` | `varchar(255)` | NO | NULL | - | - | ???? |
| 5 | `status` | `int(11)` | YES | NULL | - | - | ?? 0??? 1??? |
| 6 | `position` | `int(11)` | YES | NULL | - | - | ?? |
| 7 | `apply_type` | `int(11)` | YES | NULL | - | - | ???? 0,??? 1,???? |
| 8 | `is_deleted` | `tinyint(1)` | YES | NULL | - | - | ???? 0 ????1?? |
| 9 | `created_at` | `datetime` | YES | NULL | - | - | ???? |
| 10 | `updated_at` | `datetime` | YES | NULL | - | - | ???? |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `custom_field_templates_on_custom_field_setting_id` | BTREE | 非唯一 | `custom_field_setting_id` |
| `custom_field_templates_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## custom_fields

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 263865 |
| 数据容量 | 153.75 MB |
| 索引容量 | 25.55 MB |
| 总容量 | 179.30 MB |
| 创建时间 | 2026-03-03 11:16:52 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `label` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `origin_label` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `field_type` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `category` | `int(11)` | YES | NULL | - | - | - |
| 7 | `position` | `int(11)` | YES | NULL | - | - | - |
| 8 | `label_html_options` | `text` | YES | NULL | - | - | - |
| 9 | `input_html_options` | `text` | YES | NULL | - | - | - |
| 10 | `status` | `int(11)` | YES | NULL | - | - | - |
| 11 | `required` | `tinyint(1)` | YES | NULL | - | - | - |
| 12 | `is_special_column` | `tinyint(1)` | YES | NULL | - | - | - |
| 13 | `is_user_custom_column` | `tinyint(1)` | YES | NULL | - | - | 1???????? |
| 14 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 15 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 16 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 17 | `exclude_place` | `text` | YES | NULL | - | - | - |
| 18 | `custom_field_setting_id` | `int(11)` | YES | NULL | MUL | - | - |
| 19 | `custom_field_group_id` | `int(11)` | YES | NULL | MUL | - | - |
| 20 | `options` | `text` | YES | NULL | - | - | - |
| 21 | `field_update_options` | `text` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_custom_fields_on_custom_field_group_id` | BTREE | 非唯一 | `custom_field_group_id` |
| `index_custom_fields_on_custom_field_setting_id` | BTREE | 非唯一 | `custom_field_setting_id` |
| `index_custom_fields_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## custom_print_templates

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:18:39 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | NO | NULL | MUL | - | ??ID |
| 3 | `template_type` | `int(11)` | NO | NULL | - | - | 0:????  1?????  2?????? |
| 4 | `name` | `varchar(100)` | NO | NULL | - | - | - |
| 5 | `template_html_text` | `text` | NO | NULL | - | - | html?? |
| 6 | `descr` | `varchar(500)` | YES | NULL | - | - | ???? |
| 7 | `create_at` | `datetime` | YES | NULL | - | - | ???? |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | ???? |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_custom_print_templates_on_organization_id_and_name` | BTREE | 非唯一 | `organization_id`, `name` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## custom_reports

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 1279 |
| 数据容量 | 2.52 MB |
| 索引容量 | 0.09 MB |
| 总容量 | 2.61 MB |
| 创建时间 | 2026-03-03 11:18:39 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `source` | `int(11)` | YES | NULL | - | - | - |
| 4 | `description` | `text` | YES | NULL | - | - | - |
| 5 | `conditions` | `text` | YES | NULL | - | - | - |
| 6 | `custom_columns` | `text` | YES | NULL | - | - | - |
| 7 | `amount_columns` | `text` | YES | NULL | - | - | - |
| 8 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 9 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_custom_reports_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_custom_reports_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## customer_addresses

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 27389 |
| 数据容量 | 6.52 MB |
| 索引容量 | 11.12 MB |
| 总容量 | 17.64 MB |
| 创建时间 | 2026-03-03 11:18:40 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `addressable_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `addressable_type` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `country_id` | `int(11)` | YES | NULL | - | - | - |
| 5 | `province_id` | `int(11)` | YES | NULL | MUL | - | - |
| 6 | `city_id` | `int(11)` | YES | NULL | MUL | - | - |
| 7 | `district_id` | `int(11)` | YES | NULL | MUL | - | - |
| 8 | `tel` | `varchar(255)` | YES | NULL | MUL | - | - |
| 9 | `phone` | `varchar(255)` | YES | NULL | MUL | - | - |
| 10 | `email` | `varchar(255)` | YES | NULL | - | - | - |
| 11 | `qq` | `varchar(255)` | YES | NULL | - | - | - |
| 12 | `fax` | `varchar(255)` | YES | NULL | - | - | - |
| 13 | `wechat` | `varchar(255)` | YES | NULL | - | - | - |
| 14 | `wangwang` | `varchar(255)` | YES | NULL | - | - | - |
| 15 | `zip` | `varchar(255)` | YES | NULL | - | - | - |
| 16 | `url` | `varchar(255)` | YES | NULL | - | - | - |
| 17 | `detail_address` | `varchar(255)` | YES | NULL | - | - | - |
| 18 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 19 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 20 | `lat` | `decimal(10,6)` | YES | NULL | MUL | - | - |
| 21 | `lng` | `decimal(10,6)` | YES | NULL | - | - | - |
| 22 | `off_distance` | `float` | YES | NULL | - | - | - |
| 23 | `region_info` | `varchar(255)` | YES | NULL | - | - | - |
| 24 | `snippet` | `varchar(255)` | YES | NULL | - | - | - |
| 25 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_addresses_on_city_id` | BTREE | 非唯一 | `city_id` |
| `index_addresses_on_district_id` | BTREE | 非唯一 | `district_id` |
| `index_addresses_on_lat_and_lng` | BTREE | 非唯一 | `lat`, `lng` |
| `index_addresses_on_phone` | BTREE | 非唯一 | `phone` |
| `index_addresses_on_province_id` | BTREE | 非唯一 | `province_id` |
| `index_addresses_on_tel` | BTREE | 非唯一 | `tel` |
| `index_customer_addresses_on_addressable_id` | BTREE | 非唯一 | `addressable_id` |
| `index_customer_addresses_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## customer_addresses_30

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.12 MB |
| 总容量 | 0.14 MB |
| 创建时间 | 2026-03-03 11:18:53 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `addressable_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `addressable_type` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `country_id` | `int(11)` | YES | NULL | - | - | - |
| 5 | `province_id` | `int(11)` | YES | NULL | MUL | - | - |
| 6 | `city_id` | `int(11)` | YES | NULL | MUL | - | - |
| 7 | `district_id` | `int(11)` | YES | NULL | MUL | - | - |
| 8 | `tel` | `varchar(255)` | YES | NULL | MUL | - | - |
| 9 | `phone` | `varchar(255)` | YES | NULL | MUL | - | - |
| 10 | `email` | `varchar(255)` | YES | NULL | - | - | - |
| 11 | `qq` | `varchar(255)` | YES | NULL | - | - | - |
| 12 | `fax` | `varchar(255)` | YES | NULL | - | - | - |
| 13 | `wechat` | `varchar(255)` | YES | NULL | - | - | - |
| 14 | `wangwang` | `varchar(255)` | YES | NULL | - | - | - |
| 15 | `zip` | `varchar(255)` | YES | NULL | - | - | - |
| 16 | `url` | `varchar(255)` | YES | NULL | - | - | - |
| 17 | `detail_address` | `varchar(255)` | YES | NULL | - | - | - |
| 18 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 19 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 20 | `lat` | `decimal(10,6)` | YES | NULL | MUL | - | - |
| 21 | `lng` | `decimal(10,6)` | YES | NULL | - | - | - |
| 22 | `off_distance` | `float` | YES | NULL | - | - | - |
| 23 | `region_info` | `varchar(255)` | YES | NULL | - | - | - |
| 24 | `snippet` | `varchar(255)` | YES | NULL | - | - | - |
| 25 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_addresses_on_city_id` | BTREE | 非唯一 | `city_id` |
| `index_addresses_on_district_id` | BTREE | 非唯一 | `district_id` |
| `index_addresses_on_lat_and_lng` | BTREE | 非唯一 | `lat`, `lng` |
| `index_addresses_on_phone` | BTREE | 非唯一 | `phone` |
| `index_addresses_on_province_id` | BTREE | 非唯一 | `province_id` |
| `index_addresses_on_tel` | BTREE | 非唯一 | `tel` |
| `index_customer_addresses_30_on_addressable_id` | BTREE | 非唯一 | `addressable_id` |
| `index_customer_addresses_30_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## customer_assets

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 1132085 |
| 数据容量 | 146.72 MB |
| 索引容量 | 97.70 MB |
| 总容量 | 244.42 MB |
| 创建时间 | 2026-03-03 11:18:53 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `text_asset` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `text_area_asset` | `text` | YES | NULL | - | - | - |
| 4 | `date_asset` | `date` | YES | NULL | - | - | - |
| 5 | `datetime_asset` | `datetime` | YES | NULL | - | - | - |
| 6 | `numeric_asset` | `decimal(24,6)` | YES | NULL | - | - | - |
| 7 | `entity_id` | `int(11)` | YES | NULL | MUL | - | - |
| 8 | `custom_field_name` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `custom_field_id` | `int(11)` | YES | NULL | MUL | - | - |
| 10 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 11 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_customer_assets_on_custom_field_id` | BTREE | 非唯一 | `custom_field_id` |
| `index_customer_assets_on_entity_id` | BTREE | 非唯一 | `entity_id` |
| `index_customer_assets_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## customer_assets_30

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-03 11:23:27 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `text_asset` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `text_area_asset` | `text` | YES | NULL | - | - | - |
| 4 | `date_asset` | `date` | YES | NULL | - | - | - |
| 5 | `datetime_asset` | `datetime` | YES | NULL | - | - | - |
| 6 | `numeric_asset` | `decimal(24,6)` | YES | NULL | - | - | - |
| 7 | `entity_id` | `int(11)` | YES | NULL | MUL | - | - |
| 8 | `custom_field_name` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `custom_field_id` | `int(11)` | YES | NULL | MUL | - | - |
| 10 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 11 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_customer_assets_30_on_custom_field_id` | BTREE | 非唯一 | `custom_field_id` |
| `index_customer_assets_30_on_entity_id` | BTREE | 非唯一 | `entity_id` |
| `index_customer_assets_30_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## customer_common_settings

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 971 |
| 数据容量 | 1.52 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 1.53 MB |
| 创建时间 | 2026-03-03 11:23:28 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `admin_list` | `text` | YES | NULL | - | - | - |
| 5 | `member_list` | `text` | YES | NULL | - | - | - |
| 6 | `rule_type` | `int(11)` | YES | NULL | - | - | - |
| 7 | `rule_config` | `text` | YES | NULL | - | - | - |
| 8 | `limit_grab_enable` | `tinyint(1)` | YES | 0 | - | - | - |
| 9 | `limit_grab_day` | `int(11)` | YES | NULL | - | - | - |
| 10 | `limit_grab_enable_time` | `datetime` | YES | NULL | - | - | - |
| 11 | `custom_column_list` | `text` | YES | NULL | - | - | - |
| 12 | `filter_column_list` | `text` | YES | NULL | - | - | - |
| 13 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 14 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_customer_common_settings_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## customer_extras

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:23:29 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `biz_pid` | `varchar(255)` | NO |  | - | - | - |
| 3 | `customer_id` | `int(11)` | NO | NULL | MUL | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `agent_soukebox_account_id` | `int(11)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_customer_extras_on_customer_id` | BTREE | 非唯一 | `customer_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## customer_multistep_approves

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 47668 |
| 数据容量 | 12.52 MB |
| 索引容量 | 4.55 MB |
| 总容量 | 17.06 MB |
| 创建时间 | 2026-03-03 11:23:29 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `customer_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `step` | `int(11)` | YES | NULL | - | - | - |
| 6 | `status` | `int(11)` | YES | NULL | - | - | - |
| 7 | `approve_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `content` | `text` | YES | NULL | - | - | - |
| 9 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_customer_multistep_approves_on_customer_id` | BTREE | 非唯一 | `customer_id` |
| `index_customer_multistep_approves_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_customer_multistep_approves_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## customer_notify_user_maps

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 969 |
| 数据容量 | 0.08 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.11 MB |
| 创建时间 | 2026-03-03 11:23:40 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `customer_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_customer_notify_user_maps_on_customer_id` | BTREE | 非唯一 | `customer_id` |
| `index_customer_notify_user_maps_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## customer_status_tracks

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 37743 |
| 数据容量 | 3.52 MB |
| 索引容量 | 1.52 MB |
| 总容量 | 5.03 MB |
| 创建时间 | 2026-03-03 11:23:41 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `customer_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `status` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `previous_status` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_customer_status_tracks_on_customer_id` | BTREE | 非唯一 | `customer_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## customers

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 29170 |
| 数据容量 | 12.52 MB |
| 索引容量 | 13.64 MB |
| 总容量 | 26.16 MB |
| 创建时间 | 2026-03-03 11:23:49 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `category` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `source` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `industry` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `staff_size` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `note` | `text` | YES | NULL | - | - | - |
| 8 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 11 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 12 | `parent_id` | `int(11)` | YES | NULL | MUL | - | - |
| 13 | `path` | `varchar(255)` | YES | NULL | MUL | - | - |
| 14 | `status` | `varchar(255)` | YES | NULL | - | - | - |
| 15 | `department_id` | `int(11)` | YES | NULL | MUL | - | - |
| 16 | `name_pinyin` | `varchar(255)` | YES | NULL | - | - | - |
| 17 | `revisit_at` | `datetime` | YES | NULL | - | - | - |
| 18 | `real_revisit_at` | `datetime` | YES | NULL | - | - | - |
| 19 | `revisit_remind_at` | `datetime` | YES | NULL | - | - | - |
| 20 | `company_name` | `varchar(255)` | YES | NULL | - | - | - |
| 21 | `qixinbao_id` | `varchar(255)` | YES | NULL | - | - | - |
| 22 | `cio_pid` | `varchar(255)` | YES | NULL | - | - | - |
| 23 | `creator_id` | `int(11)` | YES | NULL | MUL | - | - |
| 24 | `before_user_id` | `int(11)` | YES | NULL | - | - | - |
| 25 | `before_department_id` | `int(11)` | YES | NULL | - | - | - |
| 26 | `flow_into_at` | `datetime` | YES | NULL | - | - | - |
| 27 | `status_updated_at` | `datetime` | YES | NULL | - | - | - |
| 28 | `customer_common_setting_id` | `int(11)` | YES | NULL | MUL | - | - |
| 29 | `before_customer_common_setting_id` | `int(11)` | YES | NULL | - | - | - |
| 30 | `approve_status` | `tinyint(4)` | YES | 3 | - | - | - |
| 31 | `approve_deny_type` | `tinyint(4)` | YES | 0 | - | - | - |
| 32 | `step` | `int(11)` | YES | NULL | - | - | - |
| 33 | `submit_applying_at` | `datetime` | YES | NULL | - | - | - |
| 34 | `finish_approve_at` | `datetime` | YES | NULL | - | - | - |
| 35 | `pending_step` | `int(11)` | YES | NULL | - | - | - |
| 36 | `industry_category` | `int(11)` | YES | NULL | - | - | - |
| 37 | `custom_field_template_id` | `int(11)` | YES | NULL | MUL | - | - |
| 38 | `channel_code` | `int(11)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_customers_on_common_setting_id_flow_into_at` | BTREE | 非唯一 | `customer_common_setting_id`, `flow_into_at` |
| `index_customers_on_creator_id` | BTREE | 非唯一 | `creator_id` |
| `index_customers_on_custom_field_template_id` | BTREE | 非唯一 | `custom_field_template_id` |
| `index_customers_on_department_id` | BTREE | 非唯一 | `department_id` |
| `index_customers_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_customers_on_parent_id` | BTREE | 非唯一 | `parent_id` |
| `index_customers_on_path` | BTREE | 非唯一 | `path` |
| `index_customers_on_user_id` | BTREE | 非唯一 | `user_id` |
| `index_on_customers_organization_id_user_id` | BTREE | 非唯一 | `organization_id`, `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## customers_30

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.14 MB |
| 总容量 | 0.16 MB |
| 创建时间 | 2026-03-03 11:24:00 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `category` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `source` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `industry` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `staff_size` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `note` | `text` | YES | NULL | - | - | - |
| 8 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 11 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 12 | `parent_id` | `int(11)` | YES | NULL | MUL | - | - |
| 13 | `path` | `varchar(255)` | YES | NULL | MUL | - | - |
| 14 | `status` | `varchar(255)` | YES | NULL | - | - | - |
| 15 | `department_id` | `int(11)` | YES | NULL | MUL | - | - |
| 16 | `name_pinyin` | `varchar(255)` | YES | NULL | - | - | - |
| 17 | `revisit_at` | `datetime` | YES | NULL | - | - | - |
| 18 | `real_revisit_at` | `datetime` | YES | NULL | - | - | - |
| 19 | `revisit_remind_at` | `datetime` | YES | NULL | - | - | - |
| 20 | `company_name` | `varchar(255)` | YES | NULL | - | - | - |
| 21 | `qixinbao_id` | `varchar(255)` | YES | NULL | - | - | - |
| 22 | `cio_pid` | `varchar(255)` | YES | NULL | - | - | - |
| 23 | `creator_id` | `int(11)` | YES | NULL | MUL | - | - |
| 24 | `before_user_id` | `int(11)` | YES | NULL | - | - | - |
| 25 | `before_department_id` | `int(11)` | YES | NULL | - | - | - |
| 26 | `flow_into_at` | `datetime` | YES | NULL | - | - | - |
| 27 | `status_updated_at` | `datetime` | YES | NULL | - | - | - |
| 28 | `customer_common_setting_id` | `int(11)` | YES | NULL | MUL | - | - |
| 29 | `before_customer_common_setting_id` | `int(11)` | YES | NULL | - | - | - |
| 30 | `approve_status` | `tinyint(4)` | YES | 3 | - | - | - |
| 31 | `approve_deny_type` | `tinyint(4)` | YES | 0 | - | - | - |
| 32 | `step` | `int(11)` | YES | NULL | - | - | - |
| 33 | `submit_applying_at` | `datetime` | YES | NULL | - | - | - |
| 34 | `finish_approve_at` | `datetime` | YES | NULL | - | - | - |
| 35 | `pending_step` | `int(11)` | YES | NULL | - | - | - |
| 36 | `industry_category` | `int(11)` | YES | NULL | - | - | - |
| 37 | `custom_field_template_id` | `int(11)` | YES | NULL | MUL | - | - |
| 38 | `channel_code` | `int(11)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_customers_30_on_common_setting_id_flow_into_at` | BTREE | 非唯一 | `customer_common_setting_id`, `flow_into_at` |
| `index_customers_30_on_creator_id` | BTREE | 非唯一 | `creator_id` |
| `index_customers_30_on_custom_field_template_id` | BTREE | 非唯一 | `custom_field_template_id` |
| `index_customers_30_on_department_id` | BTREE | 非唯一 | `department_id` |
| `index_customers_30_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_customers_30_on_parent_id` | BTREE | 非唯一 | `parent_id` |
| `index_customers_30_on_path` | BTREE | 非唯一 | `path` |
| `index_customers_30_on_user_id` | BTREE | 非唯一 | `user_id` |
| `index_on_customers_30_organization_id_user_id` | BTREE | 非唯一 | `organization_id`, `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## data_report_areas

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 1004 |
| 数据容量 | 0.11 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.14 MB |
| 创建时间 | 2026-03-03 11:24:01 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `parent_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `position` | `int(11)` | YES | NULL | - | - | - |
| 6 | `path` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_data_report_areas_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_data_report_areas_on_parent_id` | BTREE | 非唯一 | `parent_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## data_report_content_items

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:24:02 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `data_report_item_id` | `int(11)` | YES | NULL | - | - | - |
| 3 | `data_report_content_id` | `int(11)` | YES | NULL | - | - | - |
| 4 | `content` | `float` | YES | NULL | - | - | - |
| 5 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
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

## data_report_contents

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-03 11:24:02 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `data_report_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `data_report_store_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `remark` | `text` | YES | NULL | - | - | - |
| 6 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `lat` | `float` | YES | NULL | - | - | - |
| 10 | `lng` | `float` | YES | NULL | - | - | - |
| 11 | `address_detail` | `varchar(255)` | YES | NULL | - | - | - |
| 12 | `data_report_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_data_report_contents_on_data_report_id` | BTREE | 非唯一 | `data_report_id` |
| `index_data_report_contents_on_data_report_store_id` | BTREE | 非唯一 | `data_report_store_id` |
| `index_data_report_contents_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## data_report_items

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 2 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:24:02 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `data_report_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_data_report_items_on_data_report_id` | BTREE | 非唯一 | `data_report_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## data_report_readers

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 4 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:24:02 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `data_report_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_data_report_readers_on_data_report_id` | BTREE | 非唯一 | `data_report_id` |
| `index_data_report_readers_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## data_report_stores

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:24:02 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `data_report_area_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_data_report_stores_on_data_report_area_id` | BTREE | 非唯一 | `data_report_area_id` |
| `index_data_report_stores_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## data_reports

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:24:03 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `organization_id` | `int(11)` | YES | NULL | - | - | - |
| 4 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
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

## departments

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 379 |
| 数据容量 | 0.06 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.11 MB |
| 创建时间 | 2026-03-03 11:24:03 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `description` | `text` | YES | NULL | - | - | - |
| 4 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `parent_id` | `int(11)` | YES | NULL | MUL | - | - |
| 6 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `position` | `int(11)` | YES | NULL | - | - | - |
| 9 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `path` | `varchar(255)` | YES | NULL | MUL | - | - |
| 11 | `status` | `int(11)` | YES | 1 | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_departments_on_organization_id_deleted_at_status` | BTREE | 非唯一 | `organization_id`, `deleted_at`, `status` |
| `index_departments_on_parent_id` | BTREE | 非唯一 | `parent_id` |
| `index_departments_on_path` | BTREE | 非唯一 | `path` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## dial_logs

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 28 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:24:05 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `caller_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `caller_type` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `user_id` | `int(11)` | YES | NULL | - | - | - |
| 5 | `organization_id` | `int(11)` | YES | NULL | - | - | - |
| 6 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `number` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `app_type` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_dial_logs_on_caller_id_and_caller_type` | BTREE | 非唯一 | `caller_id`, `caller_type` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ding_activation_award_applies

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:24:06 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `dingid` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `username` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `phone` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_ding_activation_award_applies_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ding_activation_invite_acceptions

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.09 MB |
| 总容量 | 0.11 MB |
| 创建时间 | 2026-03-03 11:24:06 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `ding_activation_invite_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `inviter_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `inviter_dingid` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `inviter_name` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `inviter_phone` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `accepter_phone` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `accepter_org_name` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 10 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 11 | `client_id` | `int(11)` | YES | NULL | MUL | - | - |
| 12 | `invite_status` | `int(11)` | YES | 0 | - | - | - |
| 13 | `activation_status` | `int(11)` | YES | 0 | - | - | - |
| 14 | `award_applied_at` | `datetime` | YES | NULL | - | - | - |
| 15 | `awarded_at` | `datetime` | YES | NULL | - | - | - |
| 16 | `extras` | `text` | YES | NULL | - | - | - |
| 17 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 18 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 19 | `award_giver_id` | `int(11)` | YES | NULL | - | - | - |
| 20 | `acceptor_dingid` | `varchar(255)` | YES | NULL | MUL | - | - |
| 21 | `award_amount` | `decimal(12,2)` | YES | 0.00 | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_ding_activation_invite_acceptions_on_acceptor_dingid` | BTREE | 非唯一 | `acceptor_dingid` |
| `index_ding_activation_invite_acceptions_on_client_id` | BTREE | 非唯一 | `client_id` |
| `index_ding_activation_invite_acceptions_on_inviter_id` | BTREE | 非唯一 | `inviter_id` |
| `index_ding_activation_invite_acceptions_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_ding_activation_invite_acceptions_on_user_id` | BTREE | 非唯一 | `user_id` |
| `index_ding_invite_acceptions_on_inviter_id` | BTREE | 非唯一 | `ding_activation_invite_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ding_activation_invites

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:24:06 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `dingid` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `username` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 6 | `phone` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `code` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `client_id` | `int(11)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_ding_activation_invites_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_ding_activation_invites_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ding_agents

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.06 MB |
| 总容量 | 0.08 MB |
| 创建时间 | 2026-03-03 11:24:06 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `ding_organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `ding_suite_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `ding_app_id` | `int(11)` | YES | NULL | - | - | - |
| 5 | `ding_suite_subscriber_id` | `int(11)` | YES | NULL | MUL | - | - |
| 6 | `suite_key` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `app_id` | `int(11)` | YES | NULL | - | - | - |
| 8 | `agent_id` | `int(11)` | YES | NULL | MUL | - | - |
| 9 | `status` | `int(11)` | YES | 1 | - | - | - |
| 10 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 11 | `logo_url` | `varchar(255)` | YES | NULL | - | - | - |
| 12 | `auth_org_scopes` | `text` | YES | NULL | - | - | - |
| 13 | `visible_org_scopes` | `text` | YES | NULL | - | - | - |
| 14 | `description` | `varchar(255)` | YES | NULL | - | - | - |
| 15 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 16 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 17 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_ding_agents_on_agent_id` | BTREE | 非唯一 | `agent_id` |
| `index_ding_agents_on_ding_organization_id` | BTREE | 非唯一 | `ding_organization_id` |
| `index_ding_agents_on_ding_suite_id` | BTREE | 非唯一 | `ding_suite_id` |
| `index_ding_agents_on_ding_suite_subscriber_id` | BTREE | 非唯一 | `ding_suite_subscriber_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ding_apps

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:24:06 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `ding_suite_id` | `int(11)` | YES | NULL | - | - | - |
| 3 | `app_id` | `int(11)` | YES | NULL | - | - | - |
| 4 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `description` | `text` | YES | NULL | - | - | - |
| 6 | `log_url` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `home_url` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `admin_url` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `admin_pc_url` | `varchar(255)` | YES | NULL | - | - | - |
| 10 | `permissions` | `varchar(255)` | YES | NULL | - | - | - |
| 11 | `interfaces` | `varchar(255)` | YES | NULL | - | - | - |
| 12 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 13 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 14 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ding_blocked_corp_ids

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:24:07 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `corp_id` | `varchar(255)` | YES | NULL | UNI | - | - |
| 3 | `created_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_ding_blocked_corp_ids_on_corp_id` | BTREE | 唯一 | `corp_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ding_contacts

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.06 MB |
| 总容量 | 0.08 MB |
| 创建时间 | 2026-03-03 11:24:07 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `ding_organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `ding_customerId` | `varchar(255)` | YES | NULL | MUL | - | - |
| 4 | `ding_contactId` | `varchar(255)` | YES | NULL | MUL | - | - |
| 5 | `ding_contactName` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `ding_content` | `text` | YES | NULL | - | - | - |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `contact_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_ding_contacts_on_contact_id` | BTREE | 非唯一 | `contact_id` |
| `index_ding_contacts_on_ding_contactId` | BTREE | 非唯一 | `ding_contactId` |
| `index_ding_contacts_on_ding_customerId` | BTREE | 非唯一 | `ding_customerId` |
| `index_ding_contacts_on_ding_organization_id` | BTREE | 非唯一 | `ding_organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ding_corp_apps

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:24:07 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `app_type` | `tinyint(4)` | YES | 0 | - | - | - |
| 3 | `ding_organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `suite_key` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `aes_key` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `corp_id` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `agent_id` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `corp_secret` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `sso_secret` | `varchar(255)` | YES | NULL | - | - | - |
| 10 | `channel_secret` | `varchar(255)` | YES | NULL | - | - | - |
| 11 | `access_token` | `varchar(255)` | YES | NULL | - | - | - |
| 12 | `access_token_expires_at` | `datetime` | YES | NULL | - | - | - |
| 13 | `jsapi_ticket` | `varchar(255)` | YES | NULL | - | - | - |
| 14 | `jsapi_ticket_expires_at` | `datetime` | YES | NULL | - | - | - |
| 15 | `created_at` | `datetime` | NO | NULL | - | - | - |
| 16 | `updated_at` | `datetime` | NO | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_ding_corp_apps_on_ding_organization_id` | BTREE | 非唯一 | `ding_organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ding_coupons

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:24:07 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `batch_no` | `int(11)` | YES | 1 | - | - | - |
| 3 | `owner_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `owner_type` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `category` | `tinyint(4)` | YES | 0 | - | - | - |
| 6 | `card_no` | `varchar(255)` | YES | NULL | UNI | - | - |
| 7 | `password` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `price` | `float` | YES | NULL | - | - | - |
| 9 | `channel_code` | `varchar(255)` | YES | NULL | - | - | - |
| 10 | `extras` | `text` | YES | NULL | - | - | - |
| 11 | `expired_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 13 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_ding_coupons_on_card_no` | BTREE | 唯一 | `card_no` |
| `index_ding_coupons_on_owner_id_and_owner_type` | BTREE | 非唯一 | `owner_id`, `owner_type` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ding_customers

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.06 MB |
| 总容量 | 0.08 MB |
| 创建时间 | 2026-03-03 11:24:07 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `customer_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `ding_organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `ding_customerId` | `varchar(255)` | YES | NULL | MUL | - | - |
| 5 | `ding_customerName` | `varchar(255)` | YES | NULL | MUL | - | - |
| 6 | `ding_followStaffIds` | `text` | YES | NULL | - | - | - |
| 7 | `ding_content` | `text` | YES | NULL | - | - | - |
| 8 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_ding_customers_on_customer_id` | BTREE | 非唯一 | `customer_id` |
| `index_ding_customers_on_ding_customerId` | BTREE | 非唯一 | `ding_customerId` |
| `index_ding_customers_on_ding_customerName` | BTREE | 非唯一 | `ding_customerName` |
| `index_ding_customers_on_ding_organization_id` | BTREE | 非唯一 | `ding_organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ding_departments

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.08 MB |
| 总容量 | 0.09 MB |
| 创建时间 | 2026-03-03 11:24:07 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `department_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `ding_organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `dept_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `dept_parent_id` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `parent_id` | `int(11)` | YES | NULL | MUL | - | - |
| 7 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `status` | `int(11)` | YES | 1 | - | - | - |
| 9 | `dept_group_owner` | `varchar(255)` | YES | NULL | - | - | - |
| 10 | `dept_group` | `tinyint(1)` | YES | NULL | - | - | - |
| 11 | `hide` | `tinyint(1)` | YES | 0 | - | - | - |
| 12 | `path` | `varchar(255)` | YES | NULL | MUL | - | - |
| 13 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 14 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 15 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_dept_id_unique` | BTREE | 唯一 | `ding_organization_id`, `dept_id` |
| `index_ding_departments_on_department_id` | BTREE | 非唯一 | `department_id` |
| `index_ding_departments_on_dept_id` | BTREE | 非唯一 | `dept_id` |
| `index_ding_departments_on_parent_id` | BTREE | 非唯一 | `parent_id` |
| `index_ding_departments_on_path` | BTREE | 非唯一 | `path` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ding_forms

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:24:07 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `ding_organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `klass_name` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `ding_formUuid` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `ding_status` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `ding_content` | `text` | YES | NULL | - | - | - |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `use_status` | `int(11)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_ding_forms_on_ding_organization_id` | BTREE | 非唯一 | `ding_organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ding_message_logs

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-03 11:24:07 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `corp_id` | `varchar(255)` | YES | NULL | MUL | - | - |
| 3 | `access_token` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `ding_userid` | `text` | YES | NULL | MUL | - | - |
| 5 | `params` | `text` | YES | NULL | - | - | - |
| 6 | `response_status` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `response_body` | `text` | YES | NULL | - | - | - |
| 8 | `created_at` | `datetime` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_ding_message_logs_on_corp_id` | BTREE | 非唯一 | `corp_id` |
| `index_ding_message_logs_on_created_at` | BTREE | 非唯一 | `created_at` |
| `index_ding_message_logs_on_ding_userid` | BTREE | 非唯一 | `ding_userid`(38) |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ding_micro_apps

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:24:08 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `corp_id` | `varchar(255)` | NO |  | MUL | - | - |
| 3 | `corp_secret` | `varchar(255)` | NO |  | - | - | - |
| 4 | `suite_key` | `varchar(255)` | NO |  | - | - | - |
| 5 | `aes_key` | `varchar(255)` | NO |  | - | - | - |
| 6 | `agent_id` | `varchar(255)` | NO |  | - | - | - |
| 7 | `sso_secret` | `varchar(255)` | NO |  | - | - | - |
| 8 | `channel_secret` | `varchar(255)` | NO |  | - | - | - |
| 9 | `access_token` | `varchar(255)` | NO |  | - | - | - |
| 10 | `access_token_expired_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `jsapi_ticket` | `varchar(255)` | NO |  | - | - | - |
| 12 | `jsapi_ticket_expired_at` | `datetime` | YES | NULL | - | - | - |
| 13 | `auth_org_scopes` | `text` | YES | NULL | - | - | - |
| 14 | `visible_org_scopes` | `text` | YES | NULL | - | - | - |
| 15 | `auth_user_field` | `text` | YES | NULL | - | - | - |
| 16 | `auth_channel` | `varchar(255)` | YES | NULL | - | - | - |
| 17 | `status` | `int(11)` | YES | 0 | - | - | - |
| 18 | `auth_user_info` | `text` | YES | NULL | - | - | - |
| 19 | `ding_organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 20 | `host` | `varchar(255)` | YES | NULL | - | - | - |
| 21 | `created_at` | `datetime` | NO | NULL | - | - | - |
| 22 | `updated_at` | `datetime` | NO | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_ding_micro_apps_on_corp_id` | BTREE | 非唯一 | `corp_id` |
| `index_ding_micro_apps_on_ding_organization_id` | BTREE | 非唯一 | `ding_organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ding_orders

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:24:08 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `ding_organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `suite_key` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `buy_corp_id` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `goods_code` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `item_code` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `item_name` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `max_of_people` | `int(11)` | YES | 0 | - | - | - |
| 9 | `min_of_people` | `int(11)` | YES | 0 | - | - | - |
| 10 | `order_id` | `varchar(255)` | YES | NULL | - | - | - |
| 11 | `paidtime` | `datetime` | YES | NULL | - | - | - |
| 12 | `service_stop_time` | `datetime` | YES | NULL | - | - | - |
| 13 | `pay_fee` | `decimal(12,2)` | YES | NULL | - | - | - |
| 14 | `order_create_source` | `varchar(255)` | YES | NULL | - | - | - |
| 15 | `nominal_pay_fee` | `decimal(12,2)` | YES | NULL | - | - | - |
| 16 | `discount_fee` | `decimal(12,2)` | YES | NULL | - | - | - |
| 17 | `discount` | `decimal(12,2)` | YES | NULL | - | - | - |
| 18 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 19 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_ding_orders_on_ding_organization_id` | BTREE | 非唯一 | `ding_organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ding_organizations

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-03 11:24:08 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `corp_name` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `corp_id` | `varchar(255)` | YES | NULL | MUL | - | - |
| 5 | `industry` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `logo_url` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `admin_id` | `varchar(255)` | YES | 0 | MUL | - | - |
| 8 | `admin_name` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `admin_mobile` | `varchar(255)` | YES | NULL | - | - | - |
| 10 | `ding_users_count` | `int(11)` | YES | -1 | - | - | - |
| 11 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 13 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_ding_organizations_on_admin_id` | BTREE | 非唯一 | `admin_id` |
| `index_ding_organizations_on_corp_id` | BTREE | 非唯一 | `corp_id` |
| `index_ding_organizations_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ding_reading_logs

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-03 11:24:08 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `loggable_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `loggable_type` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `context` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `reading_count` | `int(11)` | YES | 1 | - | - | - |
| 8 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_ding_reading_logs_on_loggable_id_and_loggable_type` | BTREE | 非唯一 | `loggable_id`, `loggable_type` |
| `index_ding_reading_logs_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_ding_reading_logs_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ding_star_activity_codes

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:24:08 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `channel_code` | `varchar(255)` | YES | NULL | UNI | - | - |
| 3 | `price` | `float` | YES | NULL | - | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_ding_star_activity_codes_on_channel_code` | BTREE | 唯一 | `channel_code` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ding_star_activity_orders

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.06 MB |
| 总容量 | 0.08 MB |
| 创建时间 | 2026-03-03 11:24:08 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `dingid` | `varchar(255)` | YES | NULL | MUL | - | - |
| 5 | `user_phone` | `varchar(255)` | YES | NULL | MUL | - | - |
| 6 | `status` | `int(11)` | YES | 0 | - | - | - |
| 7 | `awarded_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_ding_star_activity_orders_on_dingid` | BTREE | 非唯一 | `dingid` |
| `index_ding_star_activity_orders_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_ding_star_activity_orders_on_user_id` | BTREE | 非唯一 | `user_id` |
| `index_ding_star_activity_orders_on_user_phone` | BTREE | 非唯一 | `user_phone` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ding_suite_subscribers

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.06 MB |
| 总容量 | 0.08 MB |
| 创建时间 | 2026-03-03 11:24:08 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `ding_suite_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `ding_organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `suite_key` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `corp_id` | `varchar(255)` | YES | NULL | MUL | - | - |
| 6 | `permanent_code` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `invite_code` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `serial_number` | `varchar(255)` | YES | NULL | MUL | - | - |
| 9 | `auth_channel` | `varchar(255)` | YES | NULL | - | - | - |
| 10 | `auth_channel_type` | `varchar(255)` | YES | NULL | - | - | - |
| 11 | `access_token` | `varchar(255)` | YES | NULL | - | - | - |
| 12 | `expired_at` | `datetime` | YES | NULL | - | - | - |
| 13 | `auth_user_info` | `text` | YES | NULL | - | - | - |
| 14 | `status` | `int(11)` | YES | 0 | - | - | - |
| 15 | `actived_at` | `datetime` | YES | NULL | - | - | - |
| 16 | `phonebook_token` | `varchar(255)` | YES | NULL | - | - | - |
| 17 | `phonebook_aes_key` | `varchar(255)` | YES | NULL | - | - | - |
| 18 | `jsapi_ticket` | `varchar(255)` | YES | NULL | - | - | - |
| 19 | `jsapi_ticket_expired_at` | `datetime` | YES | NULL | - | - | - |
| 20 | `auth_user_field` | `text` | YES | NULL | - | - | - |
| 21 | `condition_field` | `text` | YES | NULL | - | - | - |
| 22 | `auth_org_scopes` | `text` | YES | NULL | - | - | - |
| 23 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 24 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 25 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 26 | `sku_id` | `varchar(255)` | YES | NULL | - | - | - |
| 27 | `instance_id` | `varchar(255)` | YES | NULL | - | - | - |
| 28 | `suite_expired_on` | `datetime` | YES | NULL | - | - | - |
| 29 | `trial` | `tinyint(1)` | YES | 0 | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_ding_suite_subscribers_on_corp_id` | BTREE | 非唯一 | `corp_id` |
| `index_ding_suite_subscribers_on_ding_organization_id` | BTREE | 非唯一 | `ding_organization_id` |
| `index_ding_suite_subscribers_on_ding_suite_id` | BTREE | 非唯一 | `ding_suite_id` |
| `index_ding_suite_subscribers_on_serial_number` | BTREE | 非唯一 | `serial_number` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ding_suites

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:24:08 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `suite_id` | `int(11)` | YES | NULL | - | - | - |
| 4 | `suite_key` | `varchar(255)` | YES | suite4xxxxxxxxxxxxxxx | - | - | - |
| 5 | `suite_secret` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `suite_ticket` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `suite_access_token` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `expired_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `aes_key` | `varchar(255)` | YES | NULL | - | - | - |
| 10 | `token` | `varchar(255)` | YES | NULL | - | - | - |
| 11 | `callback_url` | `varchar(255)` | YES | NULL | - | - | - |
| 12 | `logo_url` | `varchar(255)` | YES | NULL | - | - | - |
| 13 | `status` | `int(11)` | YES | NULL | - | - | - |
| 14 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 15 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 16 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 17 | `suite_type` | `int(11)` | YES | 0 | - | - | - |
| 18 | `aliyun_suite_api_domain` | `varchar(255)` | YES | NULL | - | - | - |
| 19 | `suite_uuid` | `varchar(255)` | YES | NULL | - | - | - |
| 20 | `sso_corp_id` | `varchar(255)` | YES | NULL | - | - | - |
| 21 | `sso_secret` | `varchar(255)` | YES | NULL | - | - | - |
| 22 | `sso_token` | `varchar(255)` | YES | NULL | - | - | - |
| 23 | `sso_token_expired_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ding_syn_logs

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.09 MB |
| 总容量 | 0.11 MB |
| 创建时间 | 2026-03-03 11:24:09 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `ding_suite_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `ding_organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `corp_id` | `varchar(255)` | YES | NULL | MUL | - | - |
| 5 | `event_type` | `int(11)` | YES | NULL | MUL | - | - |
| 6 | `status` | `int(11)` | YES | 0 | MUL | - | - |
| 7 | `data` | `text` | YES | NULL | - | - | - |
| 8 | `finish_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `description` | `text` | YES | NULL | - | - | - |
| 10 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `ding_micro_app_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_ding_syn_logs_on_corp_id` | BTREE | 非唯一 | `corp_id` |
| `index_ding_syn_logs_on_ding_micro_app_id` | BTREE | 非唯一 | `ding_micro_app_id` |
| `index_ding_syn_logs_on_ding_organization_id_id` | BTREE | 非唯一 | `ding_organization_id` |
| `index_ding_syn_logs_on_ding_suite_id` | BTREE | 非唯一 | `ding_suite_id` |
| `index_ding_syn_logs_on_event_type` | BTREE | 非唯一 | `event_type` |
| `index_ding_syn_logs_on_status` | BTREE | 非唯一 | `status` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ding_upgrade_notice_logs

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:24:09 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `notice_id` | `int(11)` | YES | NULL | - | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_ding_upgrade_notice_logs_on_user_id_and_notice_id` | BTREE | 非唯一 | `user_id`, `notice_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ding_user_assist_department_maps

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:24:09 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `ding_user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `ding_department_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_ding_user_assist_department_maps_on_ding_department_id` | BTREE | 非唯一 | `ding_department_id` |
| `index_ding_user_assist_department_maps_on_ding_user_id` | BTREE | 非唯一 | `ding_user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ding_user_department_maps

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-03 11:24:09 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `ding_user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `ding_department_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `ding_organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_ding_user_department_maps_on_ding_department_id` | BTREE | 非唯一 | `ding_department_id` |
| `index_ding_user_department_maps_on_ding_organization_id` | BTREE | 非唯一 | `ding_organization_id` |
| `index_ding_user_department_maps_on_ding_user_id` | BTREE | 非唯一 | `ding_user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ding_users

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-03 11:24:09 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `ding_organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `mobile` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `tel` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `email` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `workplace` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `position` | `varchar(255)` | YES | NULL | - | - | - |
| 10 | `userid` | `varchar(255)` | YES | NULL | - | - | - |
| 11 | `jobnumber` | `varchar(255)` | YES | NULL | - | - | - |
| 12 | `dingid` | `varchar(255)` | YES | NULL | MUL | - | - |
| 13 | `avatar` | `varchar(255)` | YES | NULL | - | - | - |
| 14 | `department` | `text` | YES | NULL | - | - | - |
| 15 | `status` | `int(11)` | YES | 1 | - | - | - |
| 16 | `role` | `int(11)` | YES | 0 | - | - | - |
| 17 | `hide` | `tinyint(1)` | YES | 0 | - | - | - |
| 18 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 19 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 20 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 21 | `usable` | `tinyint(1)` | YES | 1 | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_ding_users_on_dingid` | BTREE | 非唯一 | `dingid` |
| `index_ding_users_on_user_id` | BTREE | 非唯一 | `user_id` |
| `index_userid_uniq` | BTREE | 唯一 | `ding_organization_id`, `userid` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ding_visible_departments

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.06 MB |
| 总容量 | 0.08 MB |
| 创建时间 | 2026-03-03 11:24:09 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `ding_suite_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `ding_organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `ding_department_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `ding_micro_app_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_ding_visible_departments_on_ding_department_id` | BTREE | 非唯一 | `ding_department_id` |
| `index_ding_visible_departments_on_ding_micro_app_id` | BTREE | 非唯一 | `ding_micro_app_id` |
| `index_ding_visible_departments_on_ding_organization_id` | BTREE | 非唯一 | `ding_organization_id` |
| `index_ding_visible_departments_on_ding_suite_id` | BTREE | 非唯一 | `ding_suite_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## districts

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 4583 |
| 数据容量 | 0.41 MB |
| 索引容量 | 0.34 MB |
| 总容量 | 0.75 MB |
| 创建时间 | 2026-03-03 11:24:10 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | MUL | - | - |
| 3 | `pinyin` | `varchar(255)` | YES | NULL | MUL | - | - |
| 4 | `gbt_code` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `city_id` | `int(11)` | YES | NULL | MUL | - | - |
| 6 | `sort` | `int(11)` | YES | NULL | - | - | - |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_districts_on_city_id` | BTREE | 非唯一 | `city_id` |
| `index_districts_on_name` | BTREE | 非唯一 | `name` |
| `index_districts_on_pinyin` | BTREE | 非唯一 | `pinyin` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## entities_assist_users

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 140481 |
| 数据容量 | 15.52 MB |
| 索引容量 | 11.03 MB |
| 总容量 | 26.55 MB |
| 创建时间 | 2026-03-03 11:24:11 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `subject_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `subject_type` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_entities_assist_users_on_subject_id_and_subject_type` | BTREE | 非唯一 | `subject_id`, `subject_type` |
| `index_entities_assist_users_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## entities_share_users

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:24:33 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `subject_id` | `int(11)` | YES | NULL | - | - | - |
| 3 | `subject_type` | `varchar(255)` | YES | NULL | MUL | - | - |
| 4 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `created_at` | `datetime` | NO | NULL | - | - | - |
| 6 | `updated_at` | `datetime` | NO | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_entities_share_users_on_subject_type_and_subject_id` | BTREE | 非唯一 | `subject_type`, `subject_id` |
| `index_entities_share_users_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## event_users

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 6 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:24:34 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `event_id` | `int(11)` | YES | NULL | - | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | - | - | - |
| 4 | `created_at` | `datetime` | NO | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | NO | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## events

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 6 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-03 11:24:34 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `title` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `start_at` | `datetime` | YES | NULL | - | - | - |
| 4 | `due_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `note` | `text` | YES | NULL | - | - | - |
| 6 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 7 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 8 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `remind_type` | `int(11)` | YES | NULL | - | - | - |
| 12 | `remind_at` | `datetime` | YES | NULL | - | - | - |
| 13 | `related_item_id` | `int(11)` | YES | NULL | MUL | - | - |
| 14 | `related_item_type` | `varchar(255)` | YES | NULL | - | - | - |
| 15 | `event_identifier` | `varchar(255)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_events_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_events_on_related_item_id_and_related_item_type` | BTREE | 非唯一 | `related_item_id`, `related_item_type` |
| `index_events_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## expense_account_assets

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:24:35 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `text_asset` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `text_area_asset` | `text` | YES | NULL | - | - | - |
| 4 | `date_asset` | `date` | YES | NULL | - | - | - |
| 5 | `datetime_asset` | `datetime` | YES | NULL | - | - | - |
| 6 | `numeric_asset` | `decimal(24,6)` | YES | NULL | - | - | - |
| 7 | `entity_id` | `int(11)` | YES | NULL | - | - | - |
| 8 | `custom_field_name` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `custom_field_id` | `int(11)` | YES | NULL | - | - | - |
| 10 | `organization_id` | `int(11)` | YES | NULL | - | - | - |
| 11 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## expense_account_multistep_approves

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 4160 |
| 数据容量 | 0.38 MB |
| 索引容量 | 0.28 MB |
| 总容量 | 0.66 MB |
| 创建时间 | 2026-03-03 11:24:35 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `expense_account_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `step` | `int(11)` | YES | NULL | - | - | - |
| 6 | `status` | `int(11)` | YES | NULL | - | - | - |
| 7 | `approve_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `content` | `text` | YES | NULL | - | - | - |
| 9 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_expense_account_multistep_approves_on_expense_account_id` | BTREE | 非唯一 | `expense_account_id` |
| `index_expense_account_multistep_approves_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_expense_account_multistep_approves_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## expense_account_notify_user_maps

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:24:37 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `expense_account_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_expense_account_notify_user_maps_on_expense_account_id` | BTREE | 非唯一 | `expense_account_id` |
| `index_expense_account_notify_user_maps_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## expense_accounts

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 4309 |
| 数据容量 | 1.52 MB |
| 索引容量 | 0.42 MB |
| 总容量 | 1.94 MB |
| 创建时间 | 2026-03-03 11:24:38 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `department_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `sn` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `amount` | `decimal(24,6)` | YES | 0.000000 | - | - | - |
| 7 | `note` | `text` | YES | NULL | - | - | - |
| 8 | `creator_id` | `int(11)` | YES | NULL | MUL | - | - |
| 9 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `approve_status` | `tinyint(4)` | YES | 3 | - | - | - |
| 12 | `approve_deny_type` | `tinyint(4)` | YES | 0 | - | - | - |
| 13 | `step` | `int(11)` | YES | NULL | - | - | - |
| 14 | `pending_step` | `int(11)` | YES | NULL | - | - | - |
| 15 | `submit_applying_at` | `datetime` | YES | NULL | - | - | - |
| 16 | `finish_approve_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_expense_accounts_on_creator_id` | BTREE | 非唯一 | `creator_id` |
| `index_expense_accounts_on_department_id` | BTREE | 非唯一 | `department_id` |
| `index_expense_accounts_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_expense_accounts_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## expense_assets

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:24:39 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `text_asset` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `text_area_asset` | `text` | YES | NULL | - | - | - |
| 4 | `date_asset` | `date` | YES | NULL | - | - | - |
| 5 | `datetime_asset` | `datetime` | YES | NULL | - | - | - |
| 6 | `numeric_asset` | `decimal(24,6)` | YES | NULL | - | - | - |
| 7 | `entity_id` | `int(11)` | YES | NULL | - | - | - |
| 8 | `custom_field_name` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `custom_field_id` | `int(11)` | YES | NULL | - | - | - |
| 10 | `organization_id` | `int(11)` | YES | NULL | - | - | - |
| 11 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## expenses

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 5510 |
| 数据容量 | 2.52 MB |
| 索引容量 | 1.00 MB |
| 总容量 | 3.52 MB |
| 创建时间 | 2026-03-03 11:24:40 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `expense_account_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `expense_status` | `int(11)` | YES | 0 | - | - | - |
| 4 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 6 | `sn` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `category` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `description` | `text` | YES | NULL | - | - | - |
| 9 | `amount` | `decimal(24,6)` | YES | 0.000000 | - | - | - |
| 10 | `incurred_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `customer_id` | `int(11)` | YES | NULL | MUL | - | - |
| 12 | `related_item_id` | `int(11)` | YES | NULL | MUL | - | - |
| 13 | `related_item_type` | `varchar(255)` | YES | NULL | - | - | - |
| 14 | `revisit_log_id` | `int(11)` | YES | NULL | - | - | - |
| 15 | `checkin_id` | `int(11)` | YES | NULL | - | - | - |
| 16 | `creator_id` | `int(11)` | YES | NULL | MUL | - | - |
| 17 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 18 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_expenses_on_creator_id` | BTREE | 非唯一 | `creator_id` |
| `index_expenses_on_customer_id` | BTREE | 非唯一 | `customer_id` |
| `index_expenses_on_expense_account_id` | BTREE | 非唯一 | `expense_account_id` |
| `index_expenses_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_expenses_on_related_item_id_and_related_item_type` | BTREE | 非唯一 | `related_item_id`, `related_item_type` |
| `index_expenses_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## expire_reminders

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:24:42 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | - | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | - | - | - |
| 4 | `alerted_day` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `app_type` | `int(11)` | YES | 4 | - | - | - |
| 6 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `expires_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `alerted_expired` | `tinyint(1)` | YES | 0 | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## faq_categories

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:24:42 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `position` | `int(11)` | YES | NULL | - | - | - |
| 4 | `app_type` | `int(11)` | YES | NULL | - | - | - |
| 5 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `icon` | `varchar(255)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## faqs

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:24:42 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `title` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `content` | `text` | YES | NULL | - | - | - |
| 4 | `app_type` | `int(11)` | YES | NULL | - | - | - |
| 5 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `category` | `int(11)` | YES | NULL | - | - | - |
| 8 | `faq_category_id` | `int(11)` | YES | NULL | MUL | - | - |
| 9 | `position` | `int(11)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_faqs_on_faq_category_id` | BTREE | 非唯一 | `faq_category_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## feedback_replies

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:24:42 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `replier_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `feedback_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `content` | `text` | YES | NULL | - | - | - |
| 5 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_feedback_replies_on_feedback_id` | BTREE | 非唯一 | `feedback_id` |
| `index_feedback_replies_on_replier_id` | BTREE | 非唯一 | `replier_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## feedbacks

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:24:42 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `content` | `text` | YES | NULL | - | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `app_type` | `int(11)` | YES | NULL | - | - | - |
| 7 | `feedback_type` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `email` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `phone` | `varchar(255)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_feedbacks_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## field_maps

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 17995 |
| 数据容量 | 2.52 MB |
| 索引容量 | 0.42 MB |
| 总容量 | 2.94 MB |
| 创建时间 | 2026-03-03 11:24:42 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `field_name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `klass_name` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `field_type` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `column_type` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `default_value_origin` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 8 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_field_maps_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## field_values

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 102242 |
| 数据容量 | 7.52 MB |
| 索引容量 | 4.55 MB |
| 总容量 | 12.06 MB |
| 创建时间 | 2026-03-03 11:24:46 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `field_map_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `value` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `status` | `int(11)` | YES | NULL | - | - | - |
| 6 | `position` | `int(11)` | YES | 0 | MUL | - | - |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `setting_html_options` | `text` | YES | NULL | - | - | - |
| 10 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_field_values_on_field_map_id` | BTREE | 非唯一 | `field_map_id` |
| `index_field_values_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_field_values_on_position` | BTREE | 非唯一 | `position` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| `fk_rails_68e24f30df` | `organization_id` | `organizations` | `id` |

## grants

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.08 MB |
| 总容量 | 0.09 MB |
| 创建时间 | 2026-03-03 11:25:37 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `grantee_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `grantee_type` | `varchar(255)` | YES | NULL | MUL | - | - |
| 4 | `subject_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `subject_type` | `varchar(255)` | YES | NULL | MUL | - | - |
| 6 | `grant_type` | `varchar(255)` | YES | NULL | MUL | - | - |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_grants_on_grant_type` | BTREE | 非唯一 | `grant_type` |
| `index_grants_on_grantee_id` | BTREE | 非唯一 | `grantee_id` |
| `index_grants_on_grantee_type` | BTREE | 非唯一 | `grantee_type` |
| `index_grants_on_subject_id` | BTREE | 非唯一 | `subject_id` |
| `index_grants_on_subject_type` | BTREE | 非唯一 | `subject_type` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ik_invoicing_customers

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:25:37 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `customer_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `number` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `ik_invoicing_id` | `int(11)` | YES | NULL | - | - | - |
| 5 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_ik_invoicing_customers_on_customer_id` | BTREE | 非唯一 | `customer_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ik_invoicing_product_categories

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:25:37 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `product_category_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `number` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `ik_invoicing_id` | `int(11)` | YES | NULL | - | - | - |
| 5 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_ik_invoicing_product_categories_on_product_category_id` | BTREE | 非唯一 | `product_category_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ik_invoicing_products

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:25:37 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `product_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `number` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `ik_invoicing_id` | `int(11)` | YES | NULL | - | - | - |
| 5 | `attr_status` | `int(11)` | YES | NULL | - | - | - |
| 6 | `unit_setting` | `int(11)` | YES | NULL | - | - | - |
| 7 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_ik_invoicing_products_on_product_id` | BTREE | 非唯一 | `product_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ik_invoicing_users

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-03 11:25:37 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `userid` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `ik_invoicing_user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 6 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_ik_invoicing_users_on_ik_invoicing_user_id` | BTREE | 非唯一 | `ik_invoicing_user_id` |
| `index_ik_invoicing_users_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_ik_invoicing_users_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ik_taggings

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:25:38 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `ik_tag_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `taggable_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `taggable_type` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_ik_taggings_on_ik_tag_id` | BTREE | 非唯一 | `ik_tag_id` |
| `index_ik_taggings_on_taggable_id_and_taggable_type` | BTREE | 非唯一 | `taggable_id`, `taggable_type` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ik_tags

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:25:38 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `taggings_count` | `int(11)` | YES | 0 | - | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_ik_tags_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ik_teams

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-03 11:25:38 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `admin_user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `message_source_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `message_source_type` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `client_type` | `tinyint(4)` | YES | 0 | - | - | - |
| 7 | `title` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `image` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `summary` | `text` | YES | NULL | - | - | - |
| 10 | `content` | `text` | YES | NULL | - | - | - |
| 11 | `link_url` | `varchar(255)` | YES | NULL | - | - | - |
| 12 | `read` | `tinyint(1)` | YES | 0 | - | - | - |
| 13 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 14 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_ik_teams_on_admin_user_id` | BTREE | 非唯一 | `admin_user_id` |
| `index_ik_teams_on_message_source_id_and_message_source_type` | BTREE | 非唯一 | `message_source_id`, `message_source_type` |
| `index_ik_teams_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ikcall_server_confs

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:25:38 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `environment` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `domain` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## iksms_records

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.08 MB |
| 总容量 | 0.09 MB |
| 创建时间 | 2026-03-03 11:25:38 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `sid` | `varchar(255)` | YES |  | - | - | - |
| 5 | `sub_sid` | `varchar(255)` | YES |  | - | - | - |
| 6 | `mobile` | `varchar(255)` | YES | NULL | MUL | - | - |
| 7 | `status` | `int(11)` | YES | NULL | - | - | - |
| 8 | `quantity` | `int(11)` | YES | NULL | - | - | - |
| 9 | `msg` | `text` | YES | NULL | - | - | - |
| 10 | `sent_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_iksms_records_on_mobile` | BTREE | 非唯一 | `mobile` |
| `index_iksms_records_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_iksms_records_on_organization_id_and_created_at` | BTREE | 非唯一 | `organization_id`, `created_at` |
| `index_iksms_records_on_organization_id_and_mobile` | BTREE | 非唯一 | `organization_id`, `mobile` |
| `index_iksms_records_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## import_histories

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 261 |
| 数据容量 | 0.06 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.09 MB |
| 创建时间 | 2026-03-03 11:25:38 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `file_path` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `importable_type` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `total_count` | `int(11)` | YES | NULL | - | - | - |
| 9 | `success_count` | `int(11)` | YES | NULL | - | - | - |
| 10 | `fail_count` | `int(11)` | YES | NULL | - | - | - |
| 11 | `has_error_data` | `tinyint(1)` | YES | 1 | - | - | - |
| 12 | `associate_type` | `varchar(255)` | YES | NULL | - | - | - |
| 13 | `attachment_id` | `int(11)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_import_histories_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_import_histories_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## invite_codes

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:25:39 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `invitation_token` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `invitation_type` | `int(11)` | YES | NULL | - | - | - |
| 4 | `invitation_created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `invitation_send_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `invitation_accepted_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `invitable_id` | `int(11)` | YES | NULL | MUL | - | - |
| 8 | `invitable_type` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `invited_by_id` | `int(11)` | YES | NULL | MUL | - | - |
| 10 | `invited_by_type` | `varchar(255)` | YES | NULL | - | - | - |
| 11 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 13 | `status` | `int(11)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_invite_codes_on_invitable_id_and_invitable_type` | BTREE | 非唯一 | `invitable_id`, `invitable_type` |
| `index_invite_codes_on_invited_by_id_and_invited_by_type` | BTREE | 非唯一 | `invited_by_id`, `invited_by_type` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## invoice_items

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:25:40 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `invoice_id` | `int(11)` | YES | NULL | - | - | - |
| 3 | `itemable_id` | `int(11)` | YES | NULL | - | - | - |
| 4 | `itemable_type` | `varchar(255)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## invoiced_payments

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 28787 |
| 数据容量 | 6.52 MB |
| 索引容量 | 4.55 MB |
| 总容量 | 11.06 MB |
| 创建时间 | 2026-03-03 11:25:40 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `contract_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `invoice_types` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `amount` | `decimal(24,6)` | YES | NULL | - | - | - |
| 6 | `note` | `text` | YES | NULL | - | - | - |
| 7 | `invoiced_date` | `date` | YES | NULL | - | - | - |
| 8 | `invoice_no` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `content` | `varchar(255)` | YES | NULL | - | - | - |
| 10 | `broker_user_id` | `int(11)` | YES | NULL | - | - | - |
| 11 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 13 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_invoiced_payments_on_contract_id` | BTREE | 非唯一 | `contract_id` |
| `index_invoiced_payments_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_invoiced_payments_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## invoices

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.06 MB |
| 总容量 | 0.08 MB |
| 创建时间 | 2026-03-03 11:25:49 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `invoice_type` | `int(11)` | YES | 0 | MUL | - | - |
| 5 | `amount` | `decimal(12,3)` | YES | 0.000 | - | - | - |
| 6 | `company_name` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `company_address` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `tax_number` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `opening_bank` | `varchar(255)` | YES | NULL | - | - | - |
| 10 | `bank_account` | `varchar(255)` | YES | NULL | - | - | - |
| 11 | `tel` | `varchar(255)` | YES | NULL | - | - | - |
| 12 | `recipient_name` | `varchar(255)` | YES | NULL | - | - | - |
| 13 | `recipient_address` | `varchar(255)` | YES | NULL | - | - | - |
| 14 | `recipient_tel` | `varchar(255)` | YES | NULL | - | - | - |
| 15 | `tracking_number` | `varchar(255)` | YES | NULL | - | - | - |
| 16 | `express_brand` | `varchar(255)` | YES | NULL | - | - | - |
| 17 | `express_sent_at` | `datetime` | YES | NULL | - | - | - |
| 18 | `check_status` | `int(11)` | YES | 0 | - | - | - |
| 19 | `checked_at` | `datetime` | YES | NULL | - | - | - |
| 20 | `deleted_at` | `datetime` | YES | NULL | MUL | - | - |
| 21 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 22 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_invoices_on_deleted_at` | BTREE | 非唯一 | `deleted_at` |
| `index_invoices_on_invoice_type` | BTREE | 非唯一 | `invoice_type` |
| `index_invoices_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_invoices_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## invoicing_orders

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:25:49 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `orderable_id` | `int(11)` | YES | NULL | - | - | - |
| 3 | `orderable_type` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `ik_invoicing_id` | `int(11)` | YES | NULL | - | - | - |
| 6 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_invoicing_orders_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ip_whitelists

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:25:49 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `ip` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `description` | `text` | YES | NULL | - | - | - |
| 4 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_ip_whitelists_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## king_app_subscribers

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:25:50 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `king_app_id` | `int(11)` | YES | NULL | - | - | - |
| 3 | `king_organization_id` | `int(11)` | YES | NULL | - | - | - |
| 4 | `app_id` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `corp_id` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `status` | `int(11)` | YES | 0 | - | - | - |
| 7 | `actived_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `access_token` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `expired_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## king_apps

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:25:50 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `app_id` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `app_secret` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `description` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `home` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `logo_url` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `status` | `int(11)` | YES | NULL | - | - | - |
| 9 | `corp_id` | `varchar(255)` | YES | NULL | - | - | - |
| 10 | `public_number` | `varchar(255)` | YES | NULL | - | - | - |
| 11 | `public_key` | `varchar(255)` | YES | NULL | - | - | - |
| 12 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 13 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 14 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## king_departments

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:25:50 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `department_id` | `int(11)` | YES | NULL | - | - | - |
| 3 | `king_organization_id` | `int(11)` | YES | NULL | - | - | - |
| 4 | `dept_id` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `dept_parent_id` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `full_name` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `status` | `int(11)` | YES | 1 | - | - | - |
| 9 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## king_organizations

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:25:50 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `corp_name` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `corp_id` | `varchar(255)` | YES | NULL | UNI | - | - |
| 5 | `industry` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `logo_url` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `user_count` | `int(11)` | YES | 0 | - | - | - |
| 8 | `admin_id` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `admin_name` | `varchar(255)` | YES | NULL | - | - | - |
| 10 | `admin_mobile` | `varchar(255)` | YES | NULL | - | - | - |
| 11 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 13 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_king_organizations_on_corp_id` | BTREE | 唯一 | `corp_id` |
| `index_king_organizations_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## king_upgrade_notice_logs

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:25:50 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | - | - | - |
| 3 | `notice_id` | `int(11)` | YES | NULL | - | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## king_user_assist_department_maps

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:25:50 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `king_user_id` | `int(11)` | YES | NULL | - | - | - |
| 3 | `king_department_id` | `int(11)` | YES | NULL | - | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## king_user_department_maps

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:25:50 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `king_user_id` | `int(11)` | YES | NULL | - | - | - |
| 3 | `king_department_id` | `int(11)` | YES | NULL | - | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## king_users

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:25:50 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `king_organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `openid` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `mobile` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `tel` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `email` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `avatar` | `varchar(255)` | YES | NULL | - | - | - |
| 10 | `title` | `varchar(255)` | YES | NULL | - | - | - |
| 11 | `workplace` | `varchar(255)` | YES | NULL | - | - | - |
| 12 | `jobnumber` | `varchar(255)` | YES | NULL | - | - | - |
| 13 | `status` | `int(11)` | YES | NULL | - | - | - |
| 14 | `role` | `int(11)` | YES | NULL | - | - | - |
| 15 | `gender` | `int(11)` | YES | NULL | - | - | - |
| 16 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 17 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 18 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_king_users_on_king_organization_id` | BTREE | 非唯一 | `king_organization_id` |
| `index_king_users_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## knowledge_articles

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:25:51 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `title` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `content` | `mediumtext` | YES | NULL | - | - | - |
| 4 | `views` | `int(11)` | YES | 0 | - | - | - |
| 5 | `sticky_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `knowledge_section_id` | `int(11)` | YES | NULL | MUL | - | - |
| 7 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 8 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `update_user_id` | `int(11)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_knowledge_articles_on_knowledge_section_id` | BTREE | 非唯一 | `knowledge_section_id` |
| `index_knowledge_articles_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## knowledge_catalogs

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-03 11:25:51 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `position` | `int(11)` | YES | NULL | - | - | - |
| 6 | `parent_id` | `int(11)` | YES | NULL | - | - | - |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `deleted_at` | `datetime` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_knowledge_catalogs_on_deleted_at` | BTREE | 非唯一 | `deleted_at` |
| `index_knowledge_catalogs_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_knowledge_catalogs_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## knowledge_entities

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.06 MB |
| 总容量 | 0.08 MB |
| 创建时间 | 2026-03-03 11:25:51 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `download_count` | `int(11)` | YES | NULL | - | - | - |
| 4 | `knowledge_catalog_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 6 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `deleted_at` | `datetime` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_knowledge_entities_on_deleted_at` | BTREE | 非唯一 | `deleted_at` |
| `index_knowledge_entities_on_knowledge_catalog_id` | BTREE | 非唯一 | `knowledge_catalog_id` |
| `index_knowledge_entities_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_knowledge_entities_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## knowledge_sections

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 3003 |
| 数据容量 | 0.27 MB |
| 索引容量 | 0.08 MB |
| 总容量 | 0.34 MB |
| 创建时间 | 2026-03-03 11:25:51 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `position` | `int(11)` | YES | NULL | - | - | - |
| 4 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_knowledge_sections_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## largess_sms_activities

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:25:53 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | NO | NULL | MUL | - | - |
| 3 | `user_id` | `int(11)` | NO | NULL | MUL | - | - |
| 4 | `before_quantity` | `int(11)` | YES | 0 | - | - | - |
| 5 | `quantity` | `int(11)` | YES | 0 | - | - | - |
| 6 | `after_quantity` | `int(11)` | YES | 0 | - | - | - |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_largess_sms_activities_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_largess_sms_activities_on_user_id_and_created_at` | BTREE | 非唯一 | `user_id`, `created_at` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## lead_addresses

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 13760 |
| 数据容量 | 3.52 MB |
| 索引容量 | 2.81 MB |
| 总容量 | 6.33 MB |
| 创建时间 | 2026-03-03 11:25:53 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `addressable_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `addressable_type` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `country_id` | `int(11)` | YES | NULL | - | - | - |
| 5 | `province_id` | `int(11)` | YES | NULL | MUL | - | - |
| 6 | `city_id` | `int(11)` | YES | NULL | MUL | - | - |
| 7 | `district_id` | `int(11)` | YES | NULL | MUL | - | - |
| 8 | `tel` | `varchar(255)` | YES | NULL | MUL | - | - |
| 9 | `phone` | `varchar(255)` | YES | NULL | MUL | - | - |
| 10 | `email` | `varchar(255)` | YES | NULL | - | - | - |
| 11 | `qq` | `varchar(255)` | YES | NULL | - | - | - |
| 12 | `fax` | `varchar(255)` | YES | NULL | - | - | - |
| 13 | `wechat` | `varchar(255)` | YES | NULL | - | - | - |
| 14 | `wangwang` | `varchar(255)` | YES | NULL | - | - | - |
| 15 | `zip` | `varchar(255)` | YES | NULL | - | - | - |
| 16 | `url` | `varchar(255)` | YES | NULL | - | - | - |
| 17 | `detail_address` | `varchar(255)` | YES | NULL | - | - | - |
| 18 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 19 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 20 | `lat` | `decimal(10,6)` | YES | NULL | MUL | - | - |
| 21 | `lng` | `decimal(10,6)` | YES | NULL | - | - | - |
| 22 | `off_distance` | `float` | YES | NULL | - | - | - |
| 23 | `region_info` | `varchar(255)` | YES | NULL | - | - | - |
| 24 | `snippet` | `varchar(255)` | YES | NULL | - | - | - |
| 25 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_addresses_on_city_id` | BTREE | 非唯一 | `city_id` |
| `index_addresses_on_district_id` | BTREE | 非唯一 | `district_id` |
| `index_addresses_on_lat_and_lng` | BTREE | 非唯一 | `lat`, `lng` |
| `index_addresses_on_phone` | BTREE | 非唯一 | `phone` |
| `index_addresses_on_province_id` | BTREE | 非唯一 | `province_id` |
| `index_addresses_on_tel` | BTREE | 非唯一 | `tel` |
| `index_lead_addresses_on_addressable_id` | BTREE | 非唯一 | `addressable_id` |
| `index_lead_addresses_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## lead_assets

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 176179 |
| 数据容量 | 27.55 MB |
| 索引容量 | 17.55 MB |
| 总容量 | 45.09 MB |
| 创建时间 | 2026-03-03 11:25:58 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `text_asset` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `text_area_asset` | `text` | YES | NULL | - | - | - |
| 4 | `date_asset` | `date` | YES | NULL | - | - | - |
| 5 | `datetime_asset` | `datetime` | YES | NULL | - | - | - |
| 6 | `numeric_asset` | `decimal(24,6)` | YES | NULL | - | - | - |
| 7 | `entity_id` | `int(11)` | YES | NULL | MUL | - | - |
| 8 | `custom_field_id` | `int(11)` | YES | NULL | MUL | - | - |
| 9 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 10 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `custom_field_name` | `varchar(255)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_lead_assets_on_custom_field_id` | BTREE | 非唯一 | `custom_field_id` |
| `index_lead_assets_on_entity_id` | BTREE | 非唯一 | `entity_id` |
| `index_lead_assets_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## lead_extras

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:26:36 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `agent_soukebox_account_id` | `int(11)` | YES | NULL | - | - | - |
| 3 | `lead_id` | `int(11)` | NO | NULL | MUL | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_lead_extras_on_lead_id` | BTREE | 非唯一 | `lead_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## leads

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 12526 |
| 数据容量 | 5.52 MB |
| 索引容量 | 1.80 MB |
| 总容量 | 7.31 MB |
| 创建时间 | 2026-03-03 11:26:36 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `company_name` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `source` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `department` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `job` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `note` | `text` | YES | NULL | - | - | - |
| 10 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `status` | `varchar(255)` | YES | NULL | - | - | - |
| 13 | `turned_customer_id` | `int(11)` | YES | NULL | - | - | - |
| 14 | `department_id` | `int(11)` | YES | NULL | MUL | - | - |
| 15 | `name_pinyin` | `varchar(255)` | YES | NULL | - | - | - |
| 16 | `company_name_pinyin` | `varchar(255)` | YES | NULL | - | - | - |
| 17 | `creator_id` | `int(11)` | YES | NULL | MUL | - | - |
| 18 | `customer_requirement` | `text` | YES | NULL | - | - | - |
| 19 | `revisit_at` | `datetime` | YES | NULL | MUL | - | - |
| 20 | `real_revisit_at` | `datetime` | YES | NULL | - | - | - |
| 21 | `revisit_remind_at` | `datetime` | YES | NULL | - | - | - |
| 22 | `qixinbao_id` | `varchar(255)` | YES | NULL | - | - | - |
| 23 | `before_user_id` | `int(11)` | YES | NULL | - | - | - |
| 24 | `before_department_id` | `int(11)` | YES | NULL | - | - | - |
| 25 | `turned_at` | `datetime` | YES | NULL | - | - | - |
| 26 | `channel_code` | `int(11)` | YES | NULL | - | - | - |
| 27 | `is_draft` | `tinyint(1)` | NO | 0 | - | - | - |
| 28 | `biz_pid` | `varchar(255)` | NO |  | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_leads_on_creator_id` | BTREE | 非唯一 | `creator_id` |
| `index_leads_on_department_id` | BTREE | 非唯一 | `department_id` |
| `index_leads_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_leads_on_revisit_at` | BTREE | 非唯一 | `revisit_at` |
| `index_leads_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## leads_social_shares

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:26:41 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `lead_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `social_share_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_leads_social_shares_on_lead_id` | BTREE | 非唯一 | `lead_id` |
| `index_leads_social_shares_on_social_share_id` | BTREE | 非唯一 | `social_share_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## likes

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 4 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:26:41 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `likeable_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `likeable_type` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_likes_on_likeable_id_and_likeable_type` | BTREE | 非唯一 | `likeable_id`, `likeable_type` |
| `index_likes_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## liteapp_subscribes

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 1005 |
| 数据容量 | 0.08 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.12 MB |
| 创建时间 | 2026-03-03 11:26:42 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `liteapp_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `expired_at` | `date` | YES | NULL | - | - | - |
| 5 | `app_status` | `int(11)` | YES | 0 | MUL | - | - |
| 6 | `tried` | `tinyint(1)` | YES | 0 | - | - | - |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_liteapp_subscribes_on_app_status` | BTREE | 非唯一 | `app_status` |
| `index_liteapp_subscribes_on_liteapp_id` | BTREE | 非唯一 | `liteapp_id` |
| `index_liteapp_subscribes_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## liteapps

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 6 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:26:44 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | UNI | - | - |
| 3 | `nickname` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `logo_url` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `url` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `brief` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `description` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `description_url` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `qr_code_url` | `varchar(255)` | YES | NULL | - | - | - |
| 10 | `price` | `decimal(12,3)` | YES | 0.000 | - | - | - |
| 11 | `app_type` | `int(11)` | YES | 0 | MUL | - | - |
| 12 | `status` | `int(11)` | YES | 0 | - | - | - |
| 13 | `can_trial` | `tinyint(1)` | YES | 0 | - | - | - |
| 14 | `position` | `int(11)` | YES | NULL | - | - | - |
| 15 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 16 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_liteapps_on_app_type` | BTREE | 非唯一 | `app_type` |
| `index_liteapps_on_name` | BTREE | 唯一 | `name` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## login_logs

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 175029 |
| 数据容量 | 27.55 MB |
| 索引容量 | 11.03 MB |
| 总容量 | 38.58 MB |
| 创建时间 | 2026-03-03 11:26:45 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `ip` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 7 | `app_type` | `int(11)` | YES | NULL | - | - | - |
| 8 | `ip_belong_to` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `device_infos` | `text` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_login_logs_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_login_logs_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## manual_categories

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:27:22 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `position` | `int(11)` | YES | NULL | - | - | - |
| 4 | `app_type` | `int(11)` | YES | NULL | - | - | - |
| 5 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `icon` | `varchar(255)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## manuals

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:27:22 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `title` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `content` | `text` | YES | NULL | - | - | - |
| 4 | `app_type` | `int(11)` | YES | NULL | - | - | - |
| 5 | `position` | `int(11)` | YES | NULL | - | - | - |
| 6 | `manual_category_id` | `int(11)` | YES | NULL | - | - | - |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## markings

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 501 |
| 数据容量 | 0.08 MB |
| 索引容量 | 0.09 MB |
| 总容量 | 0.17 MB |
| 创建时间 | 2026-03-03 11:27:22 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `parent_id` | `int(11)` | YES | NULL | - | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `to_user_id` | `int(11)` | YES | NULL | - | - | - |
| 5 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 6 | `content` | `text` | YES | NULL | - | - | - |
| 7 | `markable_id` | `int(11)` | YES | NULL | MUL | - | - |
| 8 | `markable_type` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `marked_report_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_markings_on_markable_id_and_markable_type` | BTREE | 非唯一 | `markable_id`, `markable_type` |
| `index_markings_on_marked_report_id` | BTREE | 非唯一 | `marked_report_id` |
| `index_markings_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_markings_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## mina_users

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 1069 |
| 数据容量 | 0.08 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.09 MB |
| 创建时间 | 2026-03-03 11:27:24 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `openid` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `nick_name` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `prompt_time` | `int(11)` | YES | 0 | - | - | - |
| 5 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 6 | `created_at` | `datetime` | NO | NULL | - | - | - |
| 7 | `updated_at` | `datetime` | NO | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_mina_users_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| `fk_rails_4f35bd0e2d` | `user_id` | `users` | `id` |

## notifications

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 191277 |
| 数据容量 | 189.84 MB |
| 索引容量 | 28.59 MB |
| 总容量 | 218.44 MB |
| 创建时间 | 2026-03-03 11:27:27 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `notifiable_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `notifiable_type` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `subject_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `subject_type` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `type` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `notify_type` | `int(11)` | YES | NULL | - | - | - |
| 8 | `status` | `int(11)` | YES | NULL | - | - | - |
| 9 | `title` | `varchar(255)` | YES | NULL | - | - | - |
| 10 | `body` | `text` | YES | NULL | - | - | - |
| 11 | `path` | `varchar(255)` | YES | NULL | - | - | - |
| 12 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 13 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 14 | `body_html` | `text` | YES | NULL | - | - | - |
| 15 | `category` | `int(11)` | YES | NULL | - | - | - |
| 16 | `extras` | `text` | YES | NULL | - | - | - |
| 17 | `receive_platform` | `int(11)` | YES | NULL | - | - | - |
| 18 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_notifications_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_notifications_on_subject_id_and_subject_type` | BTREE | 非唯一 | `subject_id`, `subject_type` |
| `index_on_notifications_notifiable_id_compound` | BTREE | 非唯一 | `notifiable_id`, `receive_platform`, `status`, `subject_type`, `notify_type` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## novice_task_item_maps

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-03 11:28:16 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `status` | `int(11)` | YES | 0 | - | - | - |
| 3 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `novice_task_item_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `novice_task_map_id` | `int(11)` | YES | NULL | MUL | - | - |
| 6 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_novice_task_item_maps_on_novice_task_item_id` | BTREE | 非唯一 | `novice_task_item_id` |
| `index_novice_task_item_maps_on_novice_task_map_id` | BTREE | 非唯一 | `novice_task_map_id` |
| `index_novice_task_item_maps_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## novice_task_items

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:28:16 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `category` | `int(11)` | YES | NULL | - | - | - |
| 3 | `novice_task_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_novice_task_items_on_novice_task_id` | BTREE | 非唯一 | `novice_task_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## novice_task_maps

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 1001 |
| 数据容量 | 0.09 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.12 MB |
| 创建时间 | 2026-03-03 11:28:16 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `status` | `int(11)` | YES | 0 | - | - | - |
| 3 | `completed_item_count` | `int(11)` | YES | 0 | - | - | - |
| 4 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `novice_task_id` | `int(11)` | YES | NULL | MUL | - | - |
| 6 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_novice_task_maps_on_novice_task_id` | BTREE | 非唯一 | `novice_task_id` |
| `index_novice_task_maps_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## novice_tasks

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 1 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:28:17 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `largess_type` | `int(11)` | YES | NULL | - | - | - |
| 3 | `item_total_count` | `int(11)` | YES | NULL | - | - | - |
| 4 | `largess_detail` | `text` | YES | NULL | - | - | - |
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

## oauth_access_grants

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:28:18 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `resource_owner_id` | `int(11)` | NO | NULL | - | - | - |
| 3 | `application_id` | `int(11)` | NO | NULL | - | - | - |
| 4 | `token` | `varchar(255)` | NO | NULL | UNI | - | - |
| 5 | `expires_in` | `int(11)` | NO | NULL | - | - | - |
| 6 | `redirect_uri` | `text` | NO | NULL | - | - | - |
| 7 | `created_at` | `datetime` | NO | NULL | - | - | - |
| 8 | `revoked_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `scopes` | `varchar(255)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_oauth_access_grants_on_token` | BTREE | 唯一 | `token` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## oauth_access_tokens

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-03 11:28:18 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `resource_owner_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `application_id` | `int(11)` | YES | NULL | - | - | - |
| 4 | `token` | `varchar(255)` | NO | NULL | UNI | - | - |
| 5 | `refresh_token` | `varchar(255)` | YES | NULL | UNI | - | - |
| 6 | `expires_in` | `int(11)` | YES | NULL | - | - | - |
| 7 | `revoked_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `created_at` | `datetime` | NO | NULL | - | - | - |
| 9 | `scopes` | `varchar(255)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_oauth_access_tokens_on_refresh_token` | BTREE | 唯一 | `refresh_token` |
| `index_oauth_access_tokens_on_resource_owner_id` | BTREE | 非唯一 | `resource_owner_id` |
| `index_oauth_access_tokens_on_token` | BTREE | 唯一 | `token` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## oauth_applications

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:28:19 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | NO | NULL | - | - | - |
| 3 | `uid` | `varchar(255)` | NO | NULL | UNI | - | - |
| 4 | `secret` | `varchar(255)` | NO | NULL | - | - | - |
| 5 | `redirect_uri` | `text` | NO | NULL | - | - | - |
| 6 | `scopes` | `varchar(255)` | NO |  | - | - | - |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `owner_id` | `int(11)` | YES | NULL | MUL | - | - |
| 10 | `owner_type` | `varchar(255)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_oauth_applications_on_owner_id_and_owner_type` | BTREE | 非唯一 | `owner_id`, `owner_type` |
| `index_oauth_applications_on_uid` | BTREE | 唯一 | `uid` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## operation_logs

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 2176676 |
| 数据容量 | 820.98 MB |
| 索引容量 | 543.56 MB |
| 总容量 | 1.33 GB |
| 创建时间 | 2026-03-03 11:28:19 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `loggable_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `loggable_type` | `varchar(255)` | YES | NULL | MUL | - | - |
| 6 | `action` | `varchar(255)` | YES | NULL | MUL | - | - |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `operation_changes` | `text` | YES | NULL | - | - | - |
| 10 | `operate_no` | `varchar(128)` | YES | NULL | MUL | - | - |
| 11 | `trans_no` | `varchar(128)` | YES | NULL | MUL | - | - |
| 12 | `trans_module` | `int(11)` | YES | NULL | MUL | - | - |
| 13 | `field_name` | `varchar(32)` | YES | NULL | - | - | - |
| 14 | `old_val` | `text` | YES | NULL | - | - | - |
| 15 | `val` | `text` | YES | NULL | - | - | - |
| 16 | `options` | `text` | YES | NULL | - | - | - |
| 17 | `note` | `text` | YES | NULL | - | - | - |
| 18 | `login_log_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_operation_logs_on_action` | BTREE | 非唯一 | `action` |
| `index_operation_logs_on_loggable_id` | BTREE | 非唯一 | `loggable_id` |
| `index_operation_logs_on_loggable_type` | BTREE | 非唯一 | `loggable_type` |
| `index_operation_logs_on_login_log_id` | BTREE | 非唯一 | `login_log_id` |
| `index_operation_logs_on_operate_no` | BTREE | 非唯一 | `operate_no` |
| `index_operation_logs_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_operation_logs_on_trans_module` | BTREE | 非唯一 | `trans_module` |
| `index_operation_logs_on_trans_no` | BTREE | 非唯一 | `trans_no` |
| `index_operation_logs_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## opportunities

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 57351 |
| 数据容量 | 17.55 MB |
| 索引容量 | 11.09 MB |
| 总容量 | 28.64 MB |
| 创建时间 | 2026-03-03 11:37:38 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `title` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `customer_id` | `int(11)` | YES | NULL | MUL | - | - |
| 8 | `get_time` | `date` | YES | NULL | - | - | - |
| 9 | `person_in_charge` | `varchar(255)` | YES | NULL | - | - | - |
| 10 | `provider` | `varchar(255)` | YES | NULL | - | - | - |
| 11 | `customer_requirement` | `text` | YES | NULL | - | - | - |
| 12 | `expect_sign_date` | `date` | YES | NULL | - | - | - |
| 13 | `expect_amount` | `decimal(24,6)` | YES | NULL | - | - | - |
| 14 | `sign_possibility` | `int(11)` | YES | NULL | - | - | - |
| 15 | `note` | `text` | YES | NULL | - | - | - |
| 16 | `kind` | `varchar(255)` | YES | NULL | - | - | - |
| 17 | `source` | `varchar(255)` | YES | NULL | - | - | - |
| 18 | `stage` | `varchar(255)` | YES | NULL | - | - | - |
| 19 | `department_id` | `int(11)` | YES | NULL | MUL | - | - |
| 20 | `revisit_at` | `datetime` | YES | NULL | MUL | - | - |
| 21 | `real_revisit_at` | `datetime` | YES | NULL | - | - | - |
| 22 | `revisit_remind_at` | `datetime` | YES | NULL | - | - | - |
| 23 | `title_pinyin` | `varchar(255)` | YES | NULL | - | - | - |
| 24 | `creator_id` | `int(11)` | YES | NULL | MUL | - | - |
| 25 | `before_user_id` | `int(11)` | YES | NULL | - | - | - |
| 26 | `before_department_id` | `int(11)` | YES | NULL | - | - | - |
| 27 | `stage_updated_at` | `datetime` | YES | NULL | - | - | - |
| 28 | `approve_status` | `tinyint(4)` | YES | 3 | - | - | - |
| 29 | `approve_deny_type` | `tinyint(4)` | YES | 0 | - | - | - |
| 30 | `step` | `int(11)` | YES | NULL | - | - | - |
| 31 | `pending_step` | `int(11)` | YES | NULL | - | - | - |
| 32 | `submit_applying_at` | `datetime` | YES | NULL | - | - | - |
| 33 | `finish_approve_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_opportunities_on_creator_id` | BTREE | 非唯一 | `creator_id` |
| `index_opportunities_on_customer_id` | BTREE | 非唯一 | `customer_id` |
| `index_opportunities_on_department_id` | BTREE | 非唯一 | `department_id` |
| `index_opportunities_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_opportunities_on_revisit_at` | BTREE | 非唯一 | `revisit_at` |
| `index_opportunities_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## opportunity_assets

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 1020532 |
| 数据容量 | 140.73 MB |
| 索引容量 | 90.69 MB |
| 总容量 | 231.42 MB |
| 创建时间 | 2026-03-03 11:38:00 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `text_asset` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `text_area_asset` | `text` | YES | NULL | - | - | - |
| 4 | `date_asset` | `date` | YES | NULL | - | - | - |
| 5 | `datetime_asset` | `datetime` | YES | NULL | - | - | - |
| 6 | `numeric_asset` | `decimal(24,6)` | YES | NULL | - | - | - |
| 7 | `entity_id` | `int(11)` | YES | NULL | MUL | - | - |
| 8 | `custom_field_name` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `custom_field_id` | `int(11)` | YES | NULL | MUL | - | - |
| 10 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 11 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_opportunity_assets_on_custom_field_id` | BTREE | 非唯一 | `custom_field_id` |
| `index_opportunity_assets_on_entity_id` | BTREE | 非唯一 | `entity_id` |
| `index_opportunity_assets_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## opportunity_multistep_approves

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-03 11:41:24 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `opportunity_id` | `int(11)` | NO | NULL | MUL | - | - |
| 3 | `organization_id` | `int(11)` | NO | NULL | MUL | - | - |
| 4 | `user_id` | `int(11)` | NO | NULL | - | - | - |
| 5 | `step` | `int(11)` | YES | NULL | - | - | - |
| 6 | `status` | `int(11)` | YES | NULL | - | - | - |
| 7 | `approve_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `content` | `text` | YES | NULL | - | - | - |
| 9 | `created_at` | `datetime` | NO | NULL | - | - | - |
| 10 | `updated_at` | `datetime` | NO | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `idx_organization_id_user_id` | BTREE | 非唯一 | `organization_id`, `user_id` |
| `index_opportunity_multistep_approves_on_opportunity_id` | BTREE | 非唯一 | `opportunity_id` |
| `index_opportunity_multistep_approves_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## opportunity_notify_user_maps

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-03 11:41:24 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `opportunity_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `created_at` | `datetime` | NO | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | NO | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_opportunity_notify_user_maps_on_opportunity_id` | BTREE | 非唯一 | `opportunity_id` |
| `index_opportunity_notify_user_maps_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## opportunity_stage_tracks

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 132650 |
| 数据容量 | 12.52 MB |
| 索引容量 | 3.52 MB |
| 总容量 | 16.03 MB |
| 创建时间 | 2026-03-03 11:41:24 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `opportunity_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `status` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `previous_status` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_opportunity_stage_tracks_on_opportunity_id` | BTREE | 非唯一 | `opportunity_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## orders

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.08 MB |
| 总容量 | 0.09 MB |
| 创建时间 | 2026-03-03 11:41:44 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `amount` | `int(11)` | YES | 0 | - | - | - |
| 4 | `currency` | `varchar(255)` | YES | cny | - | - | - |
| 5 | `order_number` | `varchar(255)` | YES | NULL | MUL | - | - |
| 6 | `status` | `int(11)` | YES | 0 | MUL | - | - |
| 7 | `orderable_id` | `int(11)` | YES | NULL | MUL | - | - |
| 8 | `orderable_type` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `subject` | `varchar(255)` | YES | NULL | - | - | - |
| 10 | `body` | `varchar(255)` | YES | NULL | - | - | - |
| 11 | `description` | `varchar(255)` | YES | NULL | - | - | - |
| 12 | `applied_at` | `datetime` | YES | NULL | - | - | - |
| 13 | `paid_at` | `datetime` | YES | NULL | - | - | - |
| 14 | `refunded_at` | `datetime` | YES | NULL | - | - | - |
| 15 | `expired_at` | `datetime` | YES | NULL | - | - | - |
| 16 | `deleted_at` | `datetime` | YES | NULL | MUL | - | - |
| 17 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 18 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_orders_on_deleted_at` | BTREE | 非唯一 | `deleted_at` |
| `index_orders_on_order_number` | BTREE | 非唯一 | `order_number` |
| `index_orders_on_orderable_id_and_orderable_type` | BTREE | 非唯一 | `orderable_id`, `orderable_type` |
| `index_orders_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_orders_on_status` | BTREE | 非唯一 | `status` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## org_clients

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 1 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:41:44 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `account_type` | `int(11)` | YES | NULL | - | - | - |
| 5 | `users_count` | `int(11)` | YES | NULL | - | - | - |
| 6 | `shorter_name` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `agent_id` | `int(11)` | YES | NULL | - | - | - |
| 8 | `locked` | `tinyint(1)` | YES | 1 | - | - | - |
| 9 | `expires_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `business_type` | `int(11)` | NO | 0 | - | - | - |
| 11 | `soukebao_status` | `int(11)` | YES | 0 | - | - | - |
| 12 | `dingding_account_type` | `int(11)` | YES | 0 | - | - | - |
| 13 | `dingding_status` | `int(11)` | YES | 0 | - | - | - |
| 14 | `dingding_permission_type` | `int(11)` | YES | 1 | - | - | - |
| 15 | `dingding_trial_apply_status` | `tinyint(4)` | YES | 0 | - | - | - |
| 16 | `wx_corp_id` | `varchar(255)` | YES | NULL | - | - | - |
| 17 | `wx_crm_plan_status` | `int(11)` | YES | NULL | - | - | - |
| 18 | `wx_permission_type` | `int(11)` | YES | NULL | - | - | - |
| 19 | `wx_status` | `int(11)` | YES | NULL | - | - | - |
| 20 | `wx_account_type` | `int(11)` | YES | NULL | - | - | - |
| 21 | `wx_category` | `int(11)` | YES | NULL | - | - | - |
| 22 | `wx_follow_status` | `int(11)` | YES | NULL | - | - | - |
| 23 | `wx_trial_apply_status` | `int(11)` | YES | 0 | - | - | - |
| 24 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 25 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 26 | `achievement` | `int(11)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_org_clients_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## organization_entity_daily_reports

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-03 11:41:44 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `lead_count` | `int(11)` | YES | NULL | - | - | - |
| 3 | `lead_increase_count` | `int(11)` | YES | NULL | - | - | - |
| 4 | `contact_count` | `int(11)` | YES | NULL | - | - | - |
| 5 | `contact_increase_count` | `int(11)` | YES | NULL | - | - | - |
| 6 | `opportunity_count` | `int(11)` | YES | NULL | - | - | - |
| 7 | `opportunity_increase_count` | `int(11)` | YES | NULL | - | - | - |
| 8 | `contract_count` | `int(11)` | YES | NULL | - | - | - |
| 9 | `contract_increase_count` | `int(11)` | YES | NULL | - | - | - |
| 10 | `task_count` | `int(11)` | YES | NULL | - | - | - |
| 11 | `task_increase_count` | `int(11)` | YES | NULL | - | - | - |
| 12 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 13 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 14 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 15 | `customer_count` | `int(11)` | YES | NULL | - | - | - |
| 16 | `customer_increase_count` | `int(11)` | YES | NULL | - | - | - |
| 17 | `reported_at` | `datetime` | YES | NULL | - | - | - |
| 18 | `knowledge_entity_count` | `int(11)` | YES | NULL | - | - | - |
| 19 | `knowledge_entity_increase_count` | `int(11)` | YES | NULL | - | - | - |
| 20 | `schedule_report_count` | `int(11)` | YES | NULL | - | - | - |
| 21 | `schedule_report_increase_count` | `int(11)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_organization_entity_daily_reports_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## organization_entity_summary_daily_reports

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-03 11:41:44 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `lead_count` | `int(11)` | YES | 0 | - | - | - |
| 3 | `lead_increase_count` | `int(11)` | YES | 0 | - | - | - |
| 4 | `contact_count` | `int(11)` | YES | 0 | - | - | - |
| 5 | `contact_increase_count` | `int(11)` | YES | 0 | - | - | - |
| 6 | `opportunity_count` | `int(11)` | YES | 0 | - | - | - |
| 7 | `opportunity_increase_count` | `int(11)` | YES | 0 | - | - | - |
| 8 | `contract_count` | `int(11)` | YES | 0 | - | - | - |
| 9 | `contract_increase_count` | `int(11)` | YES | 0 | - | - | - |
| 10 | `task_count` | `int(11)` | YES | 0 | - | - | - |
| 11 | `task_increase_count` | `int(11)` | YES | 0 | - | - | - |
| 12 | `organization_id` | `int(11)` | YES | 0 | - | - | - |
| 13 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 14 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 15 | `customer_count` | `int(11)` | YES | 0 | - | - | - |
| 16 | `customer_increase_count` | `int(11)` | YES | 0 | - | - | - |
| 17 | `reported_at` | `datetime` | YES | NULL | - | - | - |
| 18 | `knowledge_entity_count` | `int(11)` | YES | 0 | - | - | - |
| 19 | `knowledge_entity_increase_count` | `int(11)` | YES | 0 | - | - | - |
| 20 | `schedule_report_count` | `int(11)` | YES | 0 | - | - | - |
| 21 | `schedule_report_increase_count` | `int(11)` | YES | 0 | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## organizations

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 1001 |
| 数据容量 | 0.08 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.12 MB |
| 创建时间 | 2022-06-07 03:30:25 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 4 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 6 | `contacts_count` | `int(11)` | YES | NULL | - | - | - |
| 7 | `contracts_count` | `int(11)` | YES | NULL | - | - | - |
| 8 | `customers_count` | `int(11)` | YES | NULL | - | - | - |
| 9 | `leads_count` | `int(11)` | YES | NULL | - | - | - |
| 10 | `opportunities_count` | `int(11)` | YES | NULL | - | - | - |
| 11 | `tasks_count` | `int(11)` | YES | NULL | - | - | - |
| 12 | `users_count` | `int(11)` | YES | NULL | - | - | - |
| 13 | `knowledge_entities_count` | `int(11)` | YES | NULL | - | - | - |
| 14 | `schedule_reports_count` | `int(11)` | YES | NULL | - | - | - |
| 15 | `position` | `int(11)` | YES | NULL | - | - | - |
| 16 | `client_id` | `int(11)` | YES | NULL | UNI | - | - |
| 17 | `locked` | `varchar(255)` | YES | NULL | - | - | - |
| 18 | `joined_invoicing` | `int(11)` | YES | 0 | - | - | - |
| 19 | `setting_updated_at` | `datetime` | YES | NULL | - | - | - |
| 20 | `activity_at` | `datetime` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_organizations_on_activity_at` | BTREE | 非唯一 | `activity_at` |
| `index_organizations_on_client_id` | BTREE | 唯一 | `client_id` |
| `index_organizations_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## organizations_kpi_daily_reports

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-05 10:25:34 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `total_count` | `int(11)` | YES | NULL | - | - | - |
| 3 | `increase_count` | `int(11)` | YES | NULL | - | - | - |
| 4 | `active_count` | `int(11)` | YES | NULL | - | - | - |
| 5 | `active_rate` | `float` | YES | NULL | - | - | - |
| 6 | `user_count` | `int(11)` | YES | NULL | - | - | - |
| 7 | `increase_user_count` | `int(11)` | YES | NULL | - | - | - |
| 8 | `organization_average_user_count` | `int(11)` | YES | NULL | - | - | - |
| 9 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `reported_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## ownerships

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 37089 |
| 数据容量 | 4.52 MB |
| 索引容量 | 4.55 MB |
| 总容量 | 9.06 MB |
| 创建时间 | 2026-03-05 10:25:34 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `owner_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `owner_type` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `subject_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `subject_type` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_ownerships_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_ownerships_on_owner_id_and_owner_type` | BTREE | 非唯一 | `owner_id`, `owner_type` |
| `index_ownerships_on_subject_id_and_subject_type` | BTREE | 非唯一 | `subject_id`, `subject_type` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## packages

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-05 10:25:44 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES |  | - | - | - |
| 3 | `paid_type` | `int(11)` | YES | 0 | - | - | - |
| 4 | `package_type` | `int(11)` | YES | 0 | - | - | - |
| 5 | `amount` | `int(11)` | YES | 0 | - | - | - |
| 6 | `pstn_duration_out` | `int(11)` | YES | 0 | - | - | - |
| 7 | `pstn_duration_in` | `int(11)` | YES | 0 | - | - | - |
| 8 | `pstn_rate_out` | `int(11)` | YES | 0 | - | - | - |
| 9 | `pstn_rate_in` | `int(11)` | YES | 0 | - | - | - |
| 10 | `pstn_amount` | `int(11)` | YES | 0 | - | - | - |
| 11 | `sip_duration_out` | `int(11)` | YES | 0 | - | - | - |
| 12 | `sip_duration_in` | `int(11)` | YES | 0 | - | - | - |
| 13 | `sip_rate_out` | `int(11)` | YES | 0 | - | - | - |
| 14 | `sip_rate_in` | `int(11)` | YES | 0 | - | - | - |
| 15 | `sip_amount` | `int(11)` | YES | 0 | - | - | - |
| 16 | `recording_duration_out` | `int(11)` | YES | 0 | - | - | - |
| 17 | `recording_duration_in` | `int(11)` | YES | 0 | - | - | - |
| 18 | `recording_rate_out` | `int(11)` | YES | 0 | - | - | - |
| 19 | `recording_rate_in` | `int(11)` | YES | 0 | - | - | - |
| 20 | `recording_amount` | `int(11)` | YES | 0 | - | - | - |
| 21 | `status` | `int(11)` | YES | 0 | MUL | - | - |
| 22 | `deleted_at` | `datetime` | YES | NULL | MUL | - | - |
| 23 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 24 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_packages_on_deleted_at` | BTREE | 非唯一 | `deleted_at` |
| `index_packages_on_status` | BTREE | 非唯一 | `status` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## partitioning_configs

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-05 10:25:44 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `model_type` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `enabled` | `tinyint(1)` | YES | 1 | - | - | - |
| 5 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_partitioning_configs_on_organization_id_and_model_type` | BTREE | 唯一 | `organization_id`, `model_type` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## payments

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.09 MB |
| 总容量 | 0.11 MB |
| 创建时间 | 2026-03-05 10:25:44 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `order_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `amount` | `int(11)` | YES | 0 | - | - | - |
| 5 | `currency` | `varchar(255)` | YES | cny | - | - | - |
| 6 | `status` | `int(11)` | YES | 0 | - | - | - |
| 7 | `live_mode` | `int(11)` | YES | 0 | - | - | - |
| 8 | `order_number` | `varchar(255)` | YES | NULL | MUL | - | - |
| 9 | `transaction_number` | `varchar(255)` | YES | NULL | MUL | - | - |
| 10 | `channel` | `varchar(255)` | YES | alipay_pc_direct | - | - | - |
| 11 | `subchannel` | `varchar(255)` | YES | NULL | - | - | - |
| 12 | `client_ip` | `varchar(255)` | YES | NULL | - | - | - |
| 13 | `paid_at` | `datetime` | YES | NULL | - | - | - |
| 14 | `expired_at` | `datetime` | YES | NULL | - | - | - |
| 15 | `subject` | `varchar(255)` | YES | NULL | - | - | - |
| 16 | `body` | `varchar(255)` | YES | NULL | - | - | - |
| 17 | `description` | `varchar(255)` | YES | NULL | - | - | - |
| 18 | `app_id` | `varchar(255)` | YES | NULL | - | - | - |
| 19 | `object_id` | `varchar(255)` | YES | NULL | MUL | - | - |
| 20 | `credential` | `text` | YES | NULL | - | - | - |
| 21 | `extra` | `text` | YES | NULL | - | - | - |
| 22 | `deleted_at` | `datetime` | YES | NULL | MUL | - | - |
| 23 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 24 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_payments_on_deleted_at` | BTREE | 非唯一 | `deleted_at` |
| `index_payments_on_object_id` | BTREE | 非唯一 | `object_id` |
| `index_payments_on_order_id` | BTREE | 非唯一 | `order_id` |
| `index_payments_on_order_number` | BTREE | 非唯一 | `order_number` |
| `index_payments_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_payments_on_transaction_number` | BTREE | 非唯一 | `transaction_number` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## payslip_commission_stats

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-05 10:25:44 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `payslip_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `commission_stat_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_payslip_commission_stats_on_commission_stat_id` | BTREE | 非唯一 | `commission_stat_id` |
| `index_payslip_commission_stats_on_payslip_id` | BTREE | 非唯一 | `payslip_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## payslip_stats

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-05 10:25:45 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `stat_date` | `date` | YES | NULL | - | - | - |
| 3 | `note` | `text` | YES | NULL | - | - | - |
| 4 | `status` | `int(11)` | YES | 0 | - | - | - |
| 5 | `total_pay` | `decimal(24,6)` | YES | NULL | - | - | - |
| 6 | `basic_pay` | `decimal(24,6)` | YES | NULL | - | - | - |
| 7 | `commission_pay` | `decimal(24,6)` | YES | NULL | - | - | - |
| 8 | `final_commission_pay` | `decimal(24,6)` | YES | NULL | - | - | - |
| 9 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 10 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `used_time` | `int(11)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_payslip_stats_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## payslips

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-05 10:25:45 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `stat_date` | `date` | YES | NULL | - | - | - |
| 3 | `note` | `text` | YES | NULL | - | - | - |
| 4 | `station_title` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `total_pay` | `decimal(24,6)` | YES | NULL | - | - | - |
| 6 | `basic_pay` | `decimal(24,6)` | YES | NULL | - | - | - |
| 7 | `commission_pay` | `decimal(24,6)` | YES | NULL | - | - | - |
| 8 | `final_commission_pay` | `decimal(24,6)` | YES | NULL | - | - | - |
| 9 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 10 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 11 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 13 | `payslip_stat_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_payslips_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_payslips_on_payslip_stat_id` | BTREE | 非唯一 | `payslip_stat_id` |
| `index_payslips_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## performance_daily_stats

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-05 10:25:45 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `value` | `decimal(24,6)` | YES | NULL | - | - | - |
| 3 | `stat_date` | `date` | YES | NULL | - | - | - |
| 4 | `own_type` | `int(11)` | YES | NULL | - | - | - |
| 5 | `performance_indicator_id` | `int(11)` | YES | NULL | MUL | - | - |
| 6 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 7 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 8 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_performance_daily_stats_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_performance_daily_stats_on_performance_indicator_id` | BTREE | 非唯一 | `performance_indicator_id` |
| `index_performance_daily_stats_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## performance_indicators

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-05 10:25:45 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `source` | `int(11)` | YES | NULL | - | - | - |
| 4 | `filter_conditions` | `text` | YES | NULL | - | - | - |
| 5 | `own_column` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `time_column` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 8 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_performance_indicators_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## performance_monthly_stats

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-05 10:25:45 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `value` | `decimal(24,6)` | YES | NULL | - | - | - |
| 3 | `stat_date` | `date` | YES | NULL | - | - | - |
| 4 | `own_type` | `int(11)` | YES | NULL | - | - | - |
| 5 | `performance_indicator_id` | `int(11)` | YES | NULL | MUL | - | - |
| 6 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 7 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 8 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_performance_monthly_stats_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_performance_monthly_stats_on_performance_indicator_id` | BTREE | 非唯一 | `performance_indicator_id` |
| `index_performance_monthly_stats_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## permissions

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 268 |
| 数据容量 | 0.05 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-05 10:25:45 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `subject` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `action` | `varchar(255)` | YES | NULL | - | - | - |
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

## permissions_roles

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 216953 |
| 数据容量 | 16.52 MB |
| 索引容量 | 15.03 MB |
| 总容量 | 31.55 MB |
| 创建时间 | 2026-03-05 10:25:46 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `role_id` | `int(11)` | YES | NULL | MUL | - | - |
| 2 | `permission_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_permissions_roles_on_permission_id` | BTREE | 非唯一 | `permission_id` |
| `index_permissions_roles_on_role_id` | BTREE | 非唯一 | `role_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## prepared_organizations

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 1000 |
| 数据容量 | 0.08 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.09 MB |
| 创建时间 | 2026-03-05 10:26:20 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `status` | `mediumint(9)` | YES | 0 | - | - | - |
| 4 | `bind_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `created_at` | `datetime` | NO | NULL | - | - | - |
| 6 | `updated_at` | `datetime` | NO | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_prepared_organizations_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| `fk_rails_2dd05b62ae` | `organization_id` | `organizations` | `id` |

## print_templates

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-05 10:26:23 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | MUL | - | - |
| 3 | `model_klass` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `template_html_text` | `text` | YES | NULL | - | - | - |
| 5 | `note` | `text` | YES | NULL | - | - | - |
| 6 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 7 | `created_at` | `datetime` | NO | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | NO | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_print_templates_on_name` | BTREE | 非唯一 | `name` |
| `index_print_templates_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## private_enterprises

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-05 10:26:23 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `code` | `varchar(255)` | YES | NULL | MUL | - | - |
| 4 | `api_host` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `expired_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `enabled` | `tinyint(1)` | YES | 0 | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_private_enterprises_on_code` | BTREE | 非唯一 | `code` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## product_assets

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 158143 |
| 数据容量 | 26.55 MB |
| 索引容量 | 21.06 MB |
| 总容量 | 47.61 MB |
| 创建时间 | 2026-03-05 10:26:23 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `assetable_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `assetable_type` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `quantity` | `decimal(24,6)` | YES | NULL | - | - | - |
| 5 | `product_id` | `int(11)` | YES | NULL | MUL | - | - |
| 6 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 7 | `product_attr_id` | `int(11)` | YES | NULL | MUL | - | - |
| 8 | `spec` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `standard_unit_price` | `decimal(24,6)` | YES | NULL | - | - | - |
| 10 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `recommended_unit_price` | `decimal(24,6)` | YES | NULL | - | - | - |
| 13 | `remark` | `text` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_product_assets_on_assetable_id_and_assetable_type` | BTREE | 非唯一 | `assetable_id`, `assetable_type` |
| `index_product_assets_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_product_assets_on_product_attr_id` | BTREE | 非唯一 | `product_attr_id` |
| `index_product_assets_on_product_id` | BTREE | 非唯一 | `product_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## product_attrs

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-05 10:26:56 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `product_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `ik_invoicing_id` | `int(11)` | YES | NULL | - | - | - |
| 4 | `sale_price` | `decimal(10,0)` | YES | NULL | - | - | - |
| 5 | `value` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_product_attrs_on_product_id` | BTREE | 非唯一 | `product_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## product_categories

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 1296 |
| 数据容量 | 0.12 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.17 MB |
| 创建时间 | 2026-03-05 10:26:56 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `parent_id` | `int(11)` | YES | NULL | - | - | - |
| 5 | `position` | `int(11)` | YES | NULL | - | - | - |
| 6 | `path` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_product_categories_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## product_field_assets

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 2496 |
| 数据容量 | 0.36 MB |
| 索引容量 | 0.22 MB |
| 总容量 | 0.58 MB |
| 创建时间 | 2026-03-05 10:26:58 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `text_asset` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `text_area_asset` | `text` | YES | NULL | - | - | - |
| 4 | `date_asset` | `date` | YES | NULL | - | - | - |
| 5 | `datetime_asset` | `datetime` | YES | NULL | - | - | - |
| 6 | `numeric_asset` | `decimal(24,6)` | YES | NULL | - | - | - |
| 7 | `entity_id` | `int(11)` | YES | NULL | MUL | - | - |
| 8 | `custom_field_name` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `custom_field_id` | `int(11)` | YES | NULL | MUL | - | - |
| 10 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 11 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_product_field_assets_on_custom_field_id` | BTREE | 非唯一 | `custom_field_id` |
| `index_product_field_assets_on_entity_id` | BTREE | 非唯一 | `entity_id` |
| `index_product_field_assets_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## products

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 1239 |
| 数据容量 | 1.52 MB |
| 索引容量 | 0.09 MB |
| 总容量 | 1.61 MB |
| 创建时间 | 2026-03-05 10:27:00 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `product_no` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `standard_unit_price` | `decimal(24,6)` | YES | NULL | - | - | - |
| 5 | `sale_unit` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `introduction` | `text` | YES | NULL | - | - | - |
| 7 | `iced` | `tinyint(1)` | YES | 0 | - | - | - |
| 8 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 9 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `unit_cost` | `decimal(24,6)` | YES | 0.000000 | - | - | - |
| 12 | `gross_margin` | `decimal(20,2)` | YES | NULL | - | - | - |
| 13 | `product_category_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_products_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_products_on_product_category_id` | BTREE | 非唯一 | `product_category_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## provinces

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 34 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-05 10:27:01 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | MUL | - | - |
| 3 | `pinyin` | `varchar(255)` | YES | NULL | MUL | - | - |
| 4 | `gbt_code` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `sort` | `int(11)` | YES | NULL | - | - | - |
| 6 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `country_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_provinces_on_country_id` | BTREE | 非唯一 | `country_id` |
| `index_provinces_on_name` | BTREE | 非唯一 | `name` |
| `index_provinces_on_pinyin` | BTREE | 非唯一 | `pinyin` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## received_payment_assets

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-05 10:27:02 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `text_asset` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `text_area_asset` | `text` | YES | NULL | - | - | - |
| 4 | `date_asset` | `date` | YES | NULL | - | - | - |
| 5 | `datetime_asset` | `datetime` | YES | NULL | - | - | - |
| 6 | `numeric_asset` | `decimal(24,6)` | YES | NULL | - | - | - |
| 7 | `entity_id` | `int(11)` | YES | NULL | - | - | - |
| 8 | `custom_field_name` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `custom_field_id` | `int(11)` | YES | NULL | - | - | - |
| 10 | `organization_id` | `int(11)` | YES | NULL | - | - | - |
| 11 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## received_payment_notify_user_maps

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-05 10:27:02 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `received_payment_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_received_payment_notify_user_maps_on_received_payment_id` | BTREE | 非唯一 | `received_payment_id` |
| `index_received_payment_notify_user_maps_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## received_payment_plans

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 25819 |
| 数据容量 | 5.52 MB |
| 索引容量 | 3.55 MB |
| 总容量 | 9.06 MB |
| 创建时间 | 2026-03-05 10:27:03 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `contract_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | - | - | - |
| 4 | `receive_stage` | `int(11)` | YES | 1 | - | - | - |
| 5 | `receive_date` | `date` | YES | NULL | MUL | - | - |
| 6 | `amount` | `decimal(24,6)` | YES | 0.000000 | - | - | - |
| 7 | `invoice_amount` | `decimal(24,6)` | YES | 0.000000 | - | - | - |
| 8 | `received_amount` | `decimal(24,6)` | YES | 0.000000 | - | - | - |
| 9 | `receive_user_id` | `int(11)` | YES | NULL | - | - | - |
| 10 | `received_types` | `varchar(255)` | YES | 0 | - | - | - |
| 11 | `payment_type` | `varchar(255)` | YES | NULL | - | - | - |
| 12 | `note` | `text` | YES | NULL | - | - | - |
| 13 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 14 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 15 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 16 | `status` | `int(11)` | YES | 0 | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_received_payment_plans_on_contract_id` | BTREE | 非唯一 | `contract_id` |
| `index_received_payment_plans_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_received_payment_plans_on_receive_date` | BTREE | 非唯一 | `receive_date` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## received_payments

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 29046 |
| 数据容量 | 5.52 MB |
| 索引容量 | 6.06 MB |
| 总容量 | 11.58 MB |
| 创建时间 | 2026-03-05 10:27:11 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `contract_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `payment_type` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `amount` | `decimal(24,6)` | YES | NULL | - | - | - |
| 5 | `note` | `text` | YES | NULL | - | - | - |
| 6 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 9 | `receive_date` | `date` | YES | NULL | - | - | - |
| 10 | `invoice_status` | `int(11)` | YES | NULL | - | - | - |
| 11 | `receive_user_id` | `int(11)` | YES | NULL | - | - | - |
| 12 | `received_types` | `varchar(255)` | YES | 0 | - | - | - |
| 13 | `receive_stage` | `int(11)` | YES | 1 | - | - | - |
| 14 | `invoice_amount` | `decimal(20,2)` | YES | 0.00 | - | - | - |
| 15 | `approve_status` | `tinyint(4)` | YES | 3 | - | - | - |
| 16 | `submit_applying_at` | `datetime` | YES | NULL | - | - | - |
| 17 | `finish_approve_at` | `datetime` | YES | NULL | - | - | - |
| 18 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 19 | `received_payment_plan_id` | `int(11)` | YES | NULL | MUL | - | - |
| 20 | `overdue_status` | `int(11)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_received_payments_on_contract_id` | BTREE | 非唯一 | `contract_id` |
| `index_received_payments_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_received_payments_on_received_payment_plan_id` | BTREE | 非唯一 | `received_payment_plan_id` |
| `index_received_payments_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## recharge_records

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-05 10:27:20 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `account_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `amount` | `decimal(12,3)` | YES | 0.000 | - | - | - |
| 4 | `balance` | `decimal(12,3)` | YES | 0.000 | - | - | - |
| 5 | `status` | `int(11)` | YES | 0 | - | - | - |
| 6 | `invoice_status` | `int(11)` | YES | 0 | - | - | - |
| 7 | `source` | `int(11)` | YES | 0 | - | - | - |
| 8 | `recharged_at` | `datetime` | YES | NULL | MUL | - | - |
| 9 | `invoice_applied_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `deleted_at` | `datetime` | YES | NULL | MUL | - | - |
| 11 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_recharge_records_on_account_id` | BTREE | 非唯一 | `account_id` |
| `index_recharge_records_on_deleted_at` | BTREE | 非唯一 | `deleted_at` |
| `index_recharge_records_on_recharged_at` | BTREE | 非唯一 | `recharged_at` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## record_items

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-05 10:27:21 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `call_record_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `agent_type` | `int(11)` | YES | 0 | - | - | - |
| 5 | `agent_id` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `agent_time` | `int(11)` | YES | NULL | - | - | - |
| 7 | `start_time` | `datetime` | YES | NULL | - | - | - |
| 8 | `deleted_at` | `datetime` | YES | NULL | MUL | - | - |
| 9 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_record_items_on_call_record_id` | BTREE | 非唯一 | `call_record_id` |
| `index_record_items_on_deleted_at` | BTREE | 非唯一 | `deleted_at` |
| `index_record_items_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## reminders

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 25744 |
| 数据容量 | 48.59 MB |
| 索引容量 | 6.06 MB |
| 总容量 | 54.66 MB |
| 创建时间 | 2026-03-05 10:27:21 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `title` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `content` | `text` | YES | NULL | - | - | - |
| 4 | `status` | `int(11)` | YES | NULL | - | - | - |
| 5 | `attempts` | `int(11)` | YES | NULL | - | - | - |
| 6 | `remind_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `offset_seconds` | `int(11)` | YES | NULL | - | - | - |
| 8 | `priority` | `int(11)` | YES | NULL | - | - | - |
| 9 | `notify_params` | `text` | YES | NULL | - | - | - |
| 10 | `remindable_id` | `int(11)` | YES | NULL | MUL | - | - |
| 11 | `remindable_type` | `varchar(255)` | YES | NULL | - | - | - |
| 12 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 13 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 14 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 15 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 16 | `remind_status` | `int(11)` | YES | 0 | - | - | - |
| 17 | `expired_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_on_reminders_notifiable_id_compound` | BTREE | 非唯一 | `user_id`, `remind_status`, `remind_at` |
| `index_reminders_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_reminders_on_remindable_id_and_remindable_type` | BTREE | 非唯一 | `remindable_id`, `remindable_type` |
| `index_reminders_on_user_id_and_remind_at` | BTREE | 非唯一 | `user_id`, `remind_at` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## report_cc_users

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 22956 |
| 数据容量 | 2.52 MB |
| 索引容量 | 1.00 MB |
| 总容量 | 3.52 MB |
| 创建时间 | 2026-03-05 10:27:32 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `schedule_report_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_report_cc_users_on_schedule_report_id` | BTREE | 非唯一 | `schedule_report_id` |
| `index_report_cc_users_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## report_reminder_configs

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 12 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-05 10:27:36 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `report_type` | `int(11)` | YES | NULL | - | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_report_reminder_configs_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## revisit_logs

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 144799 |
| 数据容量 | 43.58 MB |
| 索引容量 | 34.09 MB |
| 总容量 | 77.67 MB |
| 创建时间 | 2026-03-05 10:27:37 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `content` | `text` | YES | NULL | - | - | - |
| 3 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 4 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `loggable_id` | `int(11)` | YES | NULL | MUL | - | - |
| 6 | `loggable_type` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 8 | `category` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `remind_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `lat` | `float` | YES | NULL | - | - | - |
| 11 | `lng` | `float` | YES | NULL | - | - | - |
| 12 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 13 | `event_identifier` | `varchar(255)` | YES | NULL | - | - | - |
| 14 | `real_revisit_at` | `datetime` | YES | NULL | - | - | - |
| 15 | `customer_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `idx_orgid_real_revisit_at_loggable_type` | BTREE | 非唯一 | `organization_id`, `real_revisit_at`, `loggable_type` |
| `index_revisit_logs_on_customer_id` | BTREE | 非唯一 | `customer_id` |
| `index_revisit_logs_on_loggable_id_and_loggable_type` | BTREE | 非唯一 | `loggable_id`, `loggable_type` |
| `index_revisit_logs_on_organization_id_and_created_at` | BTREE | 非唯一 | `organization_id`, `created_at` |
| `index_revisit_logs_on_organization_id_and_loggable_type` | BTREE | 非唯一 | `organization_id`, `loggable_type` |
| `index_revisit_logs_on_user_id_and_real_revisit_at` | BTREE | 非唯一 | `user_id`, `real_revisit_at` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## revisit_logs_30

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.08 MB |
| 总容量 | 0.09 MB |
| 创建时间 | 2026-03-05 10:28:13 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `content` | `text` | YES | NULL | - | - | - |
| 3 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 4 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `loggable_id` | `int(11)` | YES | NULL | MUL | - | - |
| 6 | `loggable_type` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 8 | `category` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `remind_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `lat` | `float` | YES | NULL | - | - | - |
| 11 | `lng` | `float` | YES | NULL | - | - | - |
| 12 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 13 | `event_identifier` | `varchar(255)` | YES | NULL | - | - | - |
| 14 | `real_revisit_at` | `datetime` | YES | NULL | - | - | - |
| 15 | `customer_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_revisit_logs_30_on_customer_id` | BTREE | 非唯一 | `customer_id` |
| `index_revisit_logs_30_on_loggable_id_and_loggable_type` | BTREE | 非唯一 | `loggable_id`, `loggable_type` |
| `index_revisit_logs_30_on_organization_id_and_created_at` | BTREE | 非唯一 | `organization_id`, `created_at` |
| `index_revisit_logs_30_on_organization_id_and_loggable_type` | BTREE | 非唯一 | `organization_id`, `loggable_type` |
| `index_revisit_logs_30_on_user_id_and_real_revisit_at` | BTREE | 非唯一 | `user_id`, `real_revisit_at` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## roles

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 3156 |
| 数据容量 | 3.52 MB |
| 索引容量 | 0.11 MB |
| 总容量 | 3.62 MB |
| 创建时间 | 2026-03-05 10:28:14 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `description` | `text` | YES | NULL | - | - | - |
| 4 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `settings` | `text` | YES | NULL | - | - | - |
| 8 | `entity_grant_scope` | `int(11)` | YES | NULL | - | - | - |
| 9 | `field_permission_setting` | `text` | YES | NULL | - | - | - |
| 10 | `field_permission_grant_scope` | `int(11)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_roles_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## roles_users

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 1379 |
| 数据容量 | 0.09 MB |
| 索引容量 | 0.11 MB |
| 总容量 | 0.20 MB |
| 创建时间 | 2026-03-05 10:28:15 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `role_id` | `int(11)` | YES | NULL | MUL | - | - |
| 2 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_roles_users_on_role_id` | BTREE | 非唯一 | `role_id` |
| `index_roles_users_on_user_id_and_role_id` | BTREE | 非唯一 | `user_id`, `role_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## sales_activities

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 853996 |
| 数据容量 | 391.00 MB |
| 索引容量 | 256.03 MB |
| 总容量 | 647.03 MB |
| 创建时间 | 2026-03-05 10:28:17 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `saleable_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `saleable_type` | `varchar(255)` | YES | NULL | MUL | - | - |
| 6 | `activity_type` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `app` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `title` | `varchar(255)` | YES | NULL | - | - | - |
| 11 | `description` | `text` | YES | NULL | - | - | - |
| 12 | `user_name` | `varchar(255)` | YES | NULL | - | - | - |
| 13 | `refer_id` | `int(11)` | YES | NULL | - | - | - |
| 14 | `refer_name` | `varchar(255)` | YES | NULL | - | - | - |
| 15 | `refer_type` | `varchar(255)` | YES | NULL | - | - | - |
| 16 | `customer_id` | `int(11)` | YES | NULL | MUL | - | - |
| 17 | `lead_id` | `int(11)` | YES | NULL | MUL | - | - |
| 18 | `opportunity_id` | `int(11)` | YES | NULL | MUL | - | - |
| 19 | `contract_id` | `int(11)` | YES | NULL | MUL | - | - |
| 20 | `contact_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_sales_activities_on_contact_id` | BTREE | 非唯一 | `contact_id` |
| `index_sales_activities_on_contract_id` | BTREE | 非唯一 | `contract_id` |
| `index_sales_activities_on_customer_id` | BTREE | 非唯一 | `customer_id` |
| `index_sales_activities_on_lead_id` | BTREE | 非唯一 | `lead_id` |
| `index_sales_activities_on_loggable_id` | BTREE | 非唯一 | `saleable_id` |
| `index_sales_activities_on_loggable_type` | BTREE | 非唯一 | `saleable_type` |
| `index_sales_activities_on_opportunity_id` | BTREE | 非唯一 | `opportunity_id` |
| `index_sales_activities_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_sales_activities_on_user_id_and_created_at` | BTREE | 非唯一 | `user_id`, `created_at` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## sales_activity_comments

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 493 |
| 数据容量 | 0.09 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.11 MB |
| 创建时间 | 2026-03-05 10:33:09 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `sales_activity_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `parent_id` | `int(11)` | YES | NULL | - | - | - |
| 4 | `user_id` | `int(11)` | YES | NULL | - | - | - |
| 5 | `to_user_id` | `int(11)` | YES | NULL | - | - | - |
| 6 | `content` | `text` | YES | NULL | - | - | - |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_sales_activity_comments_on_sales_activity_id` | BTREE | 非唯一 | `sales_activity_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## sales_circle_comments

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-05 10:33:11 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `sales_circle_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `parent_id` | `int(11)` | YES | NULL | - | - | - |
| 5 | `reply_to_user_id` | `int(11)` | YES | NULL | - | - | - |
| 6 | `content` | `text` | YES | NULL | - | - | - |
| 7 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_sales_circle_comments_on_sales_circle_id` | BTREE | 非唯一 | `sales_circle_id` |
| `index_sales_circle_comments_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## sales_circle_msgs

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 30406 |
| 数据容量 | 3.52 MB |
| 索引容量 | 7.58 MB |
| 总容量 | 11.09 MB |
| 创建时间 | 2026-03-05 10:33:11 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `send_from_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `sales_circle_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `sales_circle_comment_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `msg_types` | `int(11)` | YES | NULL | - | - | - |
| 6 | `is_read` | `tinyint(1)` | YES | 0 | - | - | - |
| 7 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `send_to_id` | `int(11)` | YES | NULL | MUL | - | - |
| 11 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_sales_circle_msgs_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_sales_circle_msgs_on_sales_circle_comment_id` | BTREE | 非唯一 | `sales_circle_comment_id` |
| `index_sales_circle_msgs_on_sales_circle_id` | BTREE | 非唯一 | `sales_circle_id` |
| `index_sales_circle_msgs_on_send_from_id` | BTREE | 非唯一 | `send_from_id` |
| `index_sales_circle_msgs_on_send_to_id` | BTREE | 非唯一 | `send_to_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## sales_circles

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 176964 |
| 数据容量 | 19.55 MB |
| 索引容量 | 14.03 MB |
| 总容量 | 33.58 MB |
| 创建时间 | 2026-03-05 10:33:21 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | - | - | - |
| 3 | `organization_id` | `int(11)` | NO | 0 | PRI | - | - |
| 4 | `title` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `content` | `text` | YES | NULL | - | - | - |
| 6 | `content_type` | `int(11)` | YES | NULL | - | - | - |
| 7 | `working_type` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `working_id` | `int(11)` | YES | NULL | - | - | - |
| 9 | `likes_count` | `int(11)` | YES | 0 | - | - | - |
| 10 | `at_user_ids` | `text` | YES | NULL | - | - | - |
| 11 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 13 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id`, `organization_id` |
| `index_on_sales_circles_organization_id_and_working` | BTREE | 非唯一 | `organization_id`, `working_id`, `working_type` |
| `index_sales_circles_on_organization_id_and_user_id` | BTREE | 非唯一 | `organization_id`, `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## sales_goal_yearlies

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 24754 |
| 数据容量 | 3.52 MB |
| 索引容量 | 5.55 MB |
| 总容量 | 9.06 MB |
| 创建时间 | 2026-03-05 10:34:00 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `goal_amount` | `decimal(24,6)` | YES | NULL | - | - | - |
| 3 | `quarter_1_amount` | `decimal(24,6)` | YES | NULL | - | - | - |
| 4 | `quarter_2_amount` | `decimal(24,6)` | YES | NULL | - | - | - |
| 5 | `quarter_3_amount` | `decimal(24,6)` | YES | NULL | - | - | - |
| 6 | `quarter_4_amount` | `decimal(24,6)` | YES | NULL | - | - | - |
| 7 | `month_1_amount` | `decimal(24,6)` | YES | NULL | - | - | - |
| 8 | `month_2_amount` | `decimal(24,6)` | YES | NULL | - | - | - |
| 9 | `month_3_amount` | `decimal(24,6)` | YES | NULL | - | - | - |
| 10 | `month_4_amount` | `decimal(24,6)` | YES | NULL | - | - | - |
| 11 | `month_5_amount` | `decimal(24,6)` | YES | NULL | - | - | - |
| 12 | `month_6_amount` | `decimal(24,6)` | YES | NULL | - | - | - |
| 13 | `month_7_amount` | `decimal(24,6)` | YES | NULL | - | - | - |
| 14 | `month_8_amount` | `decimal(24,6)` | YES | NULL | - | - | - |
| 15 | `month_9_amount` | `decimal(24,6)` | YES | NULL | - | - | - |
| 16 | `month_10_amount` | `decimal(24,6)` | YES | NULL | - | - | - |
| 17 | `month_11_amount` | `decimal(24,6)` | YES | NULL | - | - | - |
| 18 | `month_12_amount` | `decimal(24,6)` | YES | NULL | - | - | - |
| 19 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 20 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 21 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 22 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 23 | `due_at_year` | `int(11)` | YES | NULL | MUL | - | - |
| 24 | `goal_type` | `int(11)` | YES | 0 | - | - | - |
| 25 | `product_id` | `int(11)` | YES | NULL | MUL | - | - |
| 26 | `product_category_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_sales_goal_yearlies_on_due_at_year` | BTREE | 非唯一 | `due_at_year` |
| `index_sales_goal_yearlies_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_sales_goal_yearlies_on_product_category_id` | BTREE | 非唯一 | `product_category_id` |
| `index_sales_goal_yearlies_on_product_id` | BTREE | 非唯一 | `product_id` |
| `index_sales_goal_yearlies_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## schedule_report_assets

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 14458 |
| 数据容量 | 3.52 MB |
| 索引容量 | 1.11 MB |
| 总容量 | 4.62 MB |
| 创建时间 | 2026-03-05 10:34:09 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `entity_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `custom_field_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `custom_field_name` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `text_asset` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `text_area_asset` | `text` | YES | NULL | - | - | - |
| 8 | `date_asset` | `date` | YES | NULL | - | - | - |
| 9 | `datetime_asset` | `datetime` | YES | NULL | - | - | - |
| 10 | `numeric_asset` | `decimal(10,0)` | YES | NULL | - | - | - |
| 11 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_schedule_report_assets_on_custom_field_id` | BTREE | 非唯一 | `custom_field_id` |
| `index_schedule_report_assets_on_entity_id` | BTREE | 非唯一 | `entity_id` |
| `index_schedule_report_assets_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## schedule_report_reads

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 1833 |
| 数据容量 | 0.14 MB |
| 索引容量 | 0.11 MB |
| 总容量 | 0.25 MB |
| 创建时间 | 2026-03-05 10:34:13 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `schedule_report_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_schedule_report_reads_on_schedule_report_id` | BTREE | 非唯一 | `schedule_report_id` |
| `index_schedule_report_reads_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## schedule_reports

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 6341 |
| 数据容量 | 28.55 MB |
| 索引容量 | 0.81 MB |
| 总容量 | 29.36 MB |
| 创建时间 | 2026-03-05 10:34:14 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `cycle` | `int(11)` | YES | NULL | - | - | - |
| 3 | `summary` | `text` | YES | NULL | - | - | - |
| 4 | `schedule` | `text` | YES | NULL | - | - | - |
| 5 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 6 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 7 | `due_at` | `date` | YES | NULL | - | - | - |
| 8 | `type` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `marking_user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 12 | `marked` | `tinyint(1)` | YES | 0 | - | - | - |
| 13 | `last_marking_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_schedule_reports_on_marking_user_id_and_marked` | BTREE | 非唯一 | `marking_user_id`, `marked` |
| `index_schedule_reports_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_schedule_reports_on_user_id_and_due_at` | BTREE | 非唯一 | `user_id`, `due_at` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## schema_migrations

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 1044 |
| 数据容量 | 0.08 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.08 MB |
| 创建时间 | 2026-03-05 10:34:18 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `version` | `varchar(255)` | NO | NULL | PRI | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `unique_schema_migrations` | BTREE | 唯一 | `version` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## sequence

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-05 10:34:19 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `bigint(20) unsigned` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(64)` | NO | NULL | UNI | - | - |
| 3 | `value` | `bigint(20)` | NO | NULL | - | - | - |
| 4 | `gmt_modified` | `datetime` | NO | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `unique_name` | BTREE | 唯一 | `name` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## settings

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 3553 |
| 数据容量 | 5.52 MB |
| 索引容量 | 0.23 MB |
| 总容量 | 5.75 MB |
| 创建时间 | 2026-03-05 10:34:19 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `var` | `varchar(255)` | NO | NULL | - | - | - |
| 3 | `value` | `text` | YES | NULL | - | - | - |
| 4 | `target_id` | `int(11)` | NO | NULL | - | - | - |
| 5 | `target_type` | `varchar(255)` | NO | NULL | MUL | - | - |
| 6 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_settings_on_target_type_and_target_id_and_var` | BTREE | 唯一 | `target_type`, `target_id`, `var` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## short_link_social_shares

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-05 10:34:21 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `social_share_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `channel` | `int(11)` | YES | 0 | - | - | - |
| 5 | `short_link` | `varchar(255)` | YES | NULL | MUL | - | - |
| 6 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_short_link_social_shares_on_short_link` | BTREE | 非唯一 | `short_link` |
| `index_short_link_social_shares_on_user_id` | BTREE | 非唯一 | `user_id` |
| `social_channel_user` | BTREE | 非唯一 | `social_share_id`, `channel`, `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## sms_accounts

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 1 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-05 10:34:22 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `quantity` | `int(11)` | YES | 0 | - | - | - |
| 4 | `warned_threshold` | `int(11)` | YES | NULL | - | - | - |
| 5 | `prev_locked_threshold` | `int(11)` | YES | NULL | - | - | - |
| 6 | `status` | `int(11)` | NO | 0 | - | - | - |
| 7 | `source` | `int(11)` | YES | 0 | - | - | - |
| 8 | `quota_enable` | `tinyint(1)` | YES | NULL | - | - | - |
| 9 | `warned_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `prev_locked_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `locked_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 13 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_sms_accounts_on_organization_id_and_status` | BTREE | 非唯一 | `organization_id`, `status` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## sms_channel_sms_account_maps

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-05 10:34:22 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `sms_channel_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `sms_account_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `sms_channel_account_id` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `created_at` | `datetime` | NO | NULL | - | - | - |
| 6 | `updated_at` | `datetime` | NO | NULL | - | - | - |
| 7 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_sms_channel_sms_account_maps_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_sms_channel_sms_account_maps_on_sms_account_id` | BTREE | 非唯一 | `sms_account_id` |
| `index_sms_channel_sms_account_maps_on_sms_channel_id` | BTREE | 非唯一 | `sms_channel_id` |

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
| 创建时间 | 2026-03-05 10:34:22 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `channel` | `int(11)` | YES | 0 | - | - | - |
| 3 | `source` | `int(11)` | YES | 0 | - | - | - |
| 4 | `created_at` | `datetime` | NO | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | NO | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## sms_identities

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-05 10:34:22 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `identity` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `status` | `int(11)` | NO | 0 | - | - | - |
| 5 | `inn_status` | `int(11)` | YES | 0 | - | - | - |
| 6 | `reason` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `settings` | `text` | YES | NULL | - | - | - |
| 8 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `channel` | `int(11)` | YES | 1 | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_sms_identities_on_organization_id_and_source_and_status` | BTREE | 非唯一 | `organization_id`, `status` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## sms_identity_sources

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-05 10:34:22 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `sms_identity_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `identity_id` | `varchar(255)` | YES | NULL | MUL | - | - |
| 4 | `status` | `int(11)` | YES | 0 | - | - | - |
| 5 | `reason` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `source` | `int(11)` | YES | 0 | - | - | - |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_sms_identity_sources_on_identity_id` | BTREE | 非唯一 | `identity_id` |
| `index_sms_identity_sources_on_sms_identity_id` | BTREE | 非唯一 | `sms_identity_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## sms_orders

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-05 10:34:22 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `amount` | `decimal(12,3)` | YES | 0.000 | - | - | - |
| 5 | `balance` | `int(11)` | YES | 0 | - | - | - |
| 6 | `status` | `int(11)` | NO | 0 | - | - | - |
| 7 | `sms_package_id` | `int(11)` | YES | NULL | - | - | - |
| 8 | `source` | `int(11)` | YES | 0 | - | - | - |
| 9 | `quantity` | `int(11)` | YES | 0 | - | - | - |
| 10 | `dealt_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 13 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 14 | `order_number` | `varchar(255)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_sms_orders_on_order_number` | BTREE | 非唯一 | `order_number` |
| `index_sms_orders_on_organization_id_and_status` | BTREE | 非唯一 | `organization_id`, `status` |
| `index_sms_orders_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## sms_quota

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-05 10:34:23 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `quota_type` | `int(11)` | YES | 0 | - | - | - |
| 4 | `quota` | `int(11)` | YES | 0 | - | - | - |
| 5 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_sms_quota_on_organization_id_and_quota_type` | BTREE | 非唯一 | `organization_id`, `quota_type` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## sms_record_details

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.09 MB |
| 总容量 | 0.11 MB |
| 创建时间 | 2026-03-05 10:34:23 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `sms_record_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `entityable_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `entityable_type` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `mobile` | `varchar(255)` | YES | NULL | MUL | - | - |
| 7 | `nation_code` | `varchar(255)` | YES | 86 | - | - | - |
| 8 | `status` | `int(11)` | NO | 0 | - | - | - |
| 9 | `reason` | `varchar(255)` | YES | NULL | - | - | - |
| 10 | `sid` | `varchar(255)` | YES | NULL | - | - | - |
| 11 | `source` | `int(11)` | NO | 0 | MUL | - | - |
| 12 | `quantity` | `int(11)` | YES | 0 | - | - | - |
| 13 | `sent_at` | `datetime` | YES | NULL | - | - | - |
| 14 | `reached_at` | `datetime` | YES | NULL | - | - | - |
| 15 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 16 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_sms_record_details_on_entityable_id_and_entityable_type` | BTREE | 非唯一 | `entityable_id`, `entityable_type` |
| `index_sms_record_details_on_mobile` | BTREE | 非唯一 | `mobile` |
| `index_sms_record_details_on_organization_id_and_sms_record_id` | BTREE | 非唯一 | `organization_id`, `sms_record_id` |
| `index_sms_record_details_on_sms_record_id_and_mobile` | BTREE | 非唯一 | `sms_record_id`, `mobile` |
| `index_sms_record_details_on_sms_record_id_and_status` | BTREE | 非唯一 | `sms_record_id`, `status` |
| `index_sms_record_details_on_source_and_sid` | BTREE | 非唯一 | `source`, `sid` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## sms_records

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-05 10:34:23 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `social_share_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `msg` | `text` | YES | NULL | - | - | - |
| 6 | `status` | `int(11)` | YES | 0 | - | - | - |
| 7 | `reason` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `sms_type` | `int(11)` | YES | 0 | - | - | - |
| 9 | `sent_quantity` | `int(11)` | YES | 0 | - | - | - |
| 10 | `reached_quantity` | `int(11)` | YES | 0 | - | - | - |
| 11 | `paid_quantity` | `int(11)` | YES | 0 | - | - | - |
| 12 | `delayed_at` | `datetime` | YES | NULL | - | - | - |
| 13 | `sent_at` | `datetime` | YES | NULL | - | - | - |
| 14 | `names` | `varchar(255)` | YES | NULL | - | - | - |
| 15 | `settings` | `text` | YES | NULL | - | - | - |
| 16 | `pv_count` | `int(11)` | YES | 0 | - | - | - |
| 17 | `lead_count` | `int(11)` | YES | 0 | - | - | - |
| 18 | `call_count` | `int(11)` | YES | 0 | - | - | - |
| 19 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 20 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_sms_records_on_organization_id_and_sent_at` | BTREE | 非唯一 | `organization_id`, `sent_at` |
| `index_sms_records_on_social_share_id` | BTREE | 非唯一 | `social_share_id` |
| `index_sms_records_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## sms_template_sources

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-05 10:34:23 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `sms_template_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `template_id` | `varchar(255)` | YES | NULL | MUL | - | - |
| 4 | `status` | `int(11)` | YES | 0 | - | - | - |
| 5 | `reason` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `source` | `int(11)` | YES | 0 | - | - | - |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_sms_template_sources_on_sms_template_id` | BTREE | 非唯一 | `sms_template_id` |
| `index_sms_template_sources_on_template_id` | BTREE | 非唯一 | `template_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## sms_templates

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-05 10:34:23 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `title` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `template` | `text` | YES | NULL | - | - | - |
| 5 | `status` | `int(11)` | NO | 0 | - | - | - |
| 6 | `inn_status` | `int(11)` | YES | 0 | - | - | - |
| 7 | `template_type` | `int(11)` | YES | 0 | - | - | - |
| 8 | `reason` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `settings` | `text` | YES | NULL | - | - | - |
| 10 | `care_status` | `int(11)` | YES | 0 | - | - | - |
| 11 | `care_type` | `int(11)` | YES | 0 | - | - | - |
| 12 | `schedule_at` | `varchar(255)` | YES | NULL | MUL | - | - |
| 13 | `schedule_begin` | `time` | YES | NULL | - | - | - |
| 14 | `schedule_end` | `time` | YES | NULL | - | - | - |
| 15 | `schedule_type` | `int(11)` | YES | NULL | - | - | - |
| 16 | `receivers` | `text` | YES | NULL | - | - | - |
| 17 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 18 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_sms_templates_on_organization_id_and_source_and_status` | BTREE | 非唯一 | `organization_id`, `status` |
| `index_sms_templates_on_schedule_at` | BTREE | 非唯一 | `schedule_at` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## sms_user_quota

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-05 10:34:23 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `sms_quota_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `quota_used` | `int(11)` | YES | 0 | MUL | - | - |
| 5 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_sms_user_quota_on_quota_used` | BTREE | 非唯一 | `quota_used` |
| `index_sms_user_quota_on_sms_quota_id` | BTREE | 非唯一 | `sms_quota_id` |
| `index_sms_user_quota_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## social_share_assets

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-05 10:34:23 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `social_share_field_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `entity_id` | `int(11)` | YES | NULL | - | - | - |
| 5 | `input_options` | `text` | YES | NULL | - | - | - |
| 6 | `created_at` | `datetime` | NO | NULL | - | - | - |
| 7 | `updated_at` | `datetime` | NO | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_social_share_assets_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_social_share_assets_on_social_share_field_id` | BTREE | 非唯一 | `social_share_field_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## social_share_fields

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-05 10:34:23 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `social_share_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `custom_field_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `required` | `tinyint(1)` | YES | NULL | - | - | - |
| 5 | `page_label` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `position` | `int(11)` | YES | NULL | - | - | - |
| 7 | `created_at` | `datetime` | NO | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | NO | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_social_share_fields_on_custom_field_id` | BTREE | 非唯一 | `custom_field_id` |
| `index_social_share_fields_on_social_share_id` | BTREE | 非唯一 | `social_share_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## social_share_items

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-05 10:34:23 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `social_share_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 4 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_social_share_items_on_social_share_id` | BTREE | 非唯一 | `social_share_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## social_share_records

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-05 10:34:23 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `social_share_id` | `int(11)` | YES | NULL | - | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | - | - | - |
| 4 | `organization_id` | `int(11)` | YES | NULL | - | - | - |
| 5 | `channel_code` | `int(11)` | YES | NULL | - | - | - |
| 6 | `created_at` | `datetime` | NO | NULL | - | - | - |
| 7 | `updated_at` | `datetime` | NO | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## social_share_relates

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-05 10:34:24 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `social_share_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `social_share_record_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `relateable_id` | `int(11)` | YES | NULL | - | - | - |
| 5 | `relateable_type` | `varchar(255)` | YES | NULL | MUL | - | - |
| 6 | `created_at` | `datetime` | NO | NULL | - | - | - |
| 7 | `updated_at` | `datetime` | NO | NULL | - | - | - |
| 8 | `create_relate_time` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_social_share_relates_on_relateable_type_and_relateable_id` | BTREE | 非唯一 | `relateable_type`, `relateable_id` |
| `index_social_share_relates_on_social_share_id` | BTREE | 非唯一 | `social_share_id` |
| `index_social_share_relates_on_social_share_record_id` | BTREE | 非唯一 | `social_share_record_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## social_share_statistics

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-05 10:34:24 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `social_share_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `pv_count` | `int(11)` | YES | NULL | - | - | - |
| 4 | `leads_count` | `int(11)` | YES | NULL | - | - | - |
| 5 | `cal_tel_count` | `int(11)` | YES | NULL | - | - | - |
| 6 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_social_share_statistics_on_social_share_id` | BTREE | 非唯一 | `social_share_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## social_share_user_statistics

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-05 10:34:24 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `social_share_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `pv_count` | `int(11)` | YES | NULL | - | - | - |
| 5 | `leads_count` | `int(11)` | YES | NULL | - | - | - |
| 6 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `channel_code` | `int(11)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_social_share_user_statistics_on_social_share_id` | BTREE | 非唯一 | `social_share_id` |
| `index_social_share_user_statistics_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## social_shares

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-05 10:34:24 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `title` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `description` | `text` | YES | NULL | - | - | - |
| 4 | `form_enabled` | `tinyint(1)` | YES | NULL | - | - | - |
| 5 | `form_description` | `text` | YES | NULL | - | - | - |
| 6 | `contact_tel` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `contact_tel_enabled` | `tinyint(1)` | YES | NULL | - | - | - |
| 8 | `form_schema` | `text` | YES | NULL | - | - | - |
| 9 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 10 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 11 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 13 | `read_count` | `int(11)` | YES | NULL | - | - | - |
| 14 | `deleted_at` | `datetime` | YES | NULL | MUL | - | - |
| 15 | `out_url` | `varchar(255)` | YES | NULL | - | - | - |
| 16 | `status` | `int(11)` | YES | 0 | - | - | - |
| 17 | `abstract` | `text` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_social_shares_on_deleted_at` | BTREE | 非唯一 | `deleted_at` |
| `index_social_shares_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_social_shares_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## soukebox_accounts

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.08 MB |
| 总容量 | 0.09 MB |
| 创建时间 | 2026-03-05 10:34:24 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | 0 | MUL | - | - |
| 3 | `parent_account_id` | `int(11)` | YES | 0 | MUL | - | - |
| 4 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `status` | `int(11)` | NO | 0 | MUL | - | - |
| 6 | `level` | `int(11)` | YES | NULL | MUL | - | - |
| 7 | `biz_uid` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `access_token` | `text` | YES | NULL | - | - | - |
| 9 | `access_token_expire_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `user_token` | `varchar(255)` | YES | NULL | - | - | - |
| 11 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 13 | `expired_at` | `datetime` | NO | NULL | - | - | - |
| 14 | `after_user_id` | `int(11)` | YES | NULL | - | - | - |
| 15 | `before_user_id` | `int(11)` | YES | NULL | - | - | - |
| 16 | `account_type` | `int(11)` | NO | 0 | - | - | - |
| 17 | `biz_master_phone` | `varchar(255)` | YES | NULL | - | - | - |
| 18 | `out_biz_uid` | `varchar(255)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_soukebox_accounts_on_level` | BTREE | 非唯一 | `level` |
| `index_soukebox_accounts_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_soukebox_accounts_on_parent_account_id` | BTREE | 非唯一 | `parent_account_id` |
| `index_soukebox_accounts_on_status` | BTREE | 非唯一 | `status` |
| `index_soukebox_accounts_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## stations

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-05 10:34:24 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `salaries` | `decimal(24,6)` | YES | NULL | - | - | - |
| 4 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_stations_on_organization_id` | BTREE | 非唯一 | `organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## subscribers

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-05 10:34:24 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `business_query_subscription_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `category` | `int(11)` | YES | NULL | - | - | - |
| 6 | `own_type` | `int(11)` | YES | NULL | - | - | - |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_subscribers_on_business_query_subscription_id` | BTREE | 非唯一 | `business_query_subscription_id` |
| `index_subscribers_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_subscribers_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## taggings

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-05 10:34:24 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `tag_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `taggable_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `taggable_type` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `tagger_id` | `int(11)` | YES | NULL | - | - | - |
| 6 | `tagger_type` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `context` | `varchar(128)` | YES | NULL | - | - | - |
| 8 | `created_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_taggings_on_taggable_id_and_taggable_type_and_context` | BTREE | 非唯一 | `taggable_id`, `taggable_type`, `context` |
| `taggings_idx` | BTREE | 唯一 | `tag_id`, `taggable_id`, `taggable_type`, `context`, `tagger_id`, `tagger_type` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## tags

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-05 10:34:25 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | UNI | - | - |
| 3 | `taggings_count` | `int(11)` | YES | 0 | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_tags_on_name` | BTREE | 唯一 | `name` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## tddl_rule

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-05 10:34:25 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `version` | `bigint(20) unsigned` | NO | NULL | PRI | - | - |
| 2 | `data_id` | `varchar(128)` | NO | NULL | UNI | - | - |
| 3 | `content` | `longtext` | NO | NULL | - | - | - |
| 4 | `content_md5` | `varchar(64)` | NO | NULL | - | - | - |
| 5 | `diamond` | `tinyint(4)` | NO | 0 | - | - | - |
| 6 | `manager` | `tinyint(4)` | NO | 0 | - | - | - |
| 7 | `sender_diamond` | `varchar(64)` | NO | NULL | - | - | - |
| 8 | `sender_manager` | `varchar(64)` | NO | NULL | - | - | - |
| 9 | `gmt_created` | `timestamp` | NO | CURRENT_TIMESTAMP | - | - | - |
| 10 | `gmt_modified` | `timestamp` | NO | 1970-02-01 00:00:00 | - | - | - |
| 11 | `gmt_modified_diamond` | `timestamp` | NO | 1970-02-01 00:00:00 | - | - | - |
| 12 | `gmt_modified_manager` | `timestamp` | NO | 1970-02-01 00:00:00 | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `version` |
| `uk_data_id` | BTREE | 唯一 | `data_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## tddl_rule_status

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-05 10:34:25 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `version_using` | `bigint(20) unsigned` | NO | NULL | - | - | - |
| 2 | `version_diamond` | `bigint(20) unsigned` | NO | NULL | - | - | - |
| 3 | `version_manager` | `bigint(20) unsigned` | NO | NULL | - | - | - |
| 4 | `gmt_created` | `timestamp` | NO | CURRENT_TIMESTAMP | - | - | - |
| 5 | `gmt_modified_using` | `timestamp` | NO | 1970-02-01 00:00:00 | - | - | - |
| 6 | `gmt_modified_diamond` | `timestamp` | NO | 1970-02-01 00:00:00 | - | - | - |
| 7 | `gmt_modified_manager` | `timestamp` | NO | 1970-02-01 00:00:00 | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| - | - | - | - |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## token_logs

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 2406271 |
| 数据容量 | 365.00 MB |
| 索引容量 | 233.66 MB |
| 总容量 | 598.66 MB |
| 创建时间 | 2026-03-05 10:34:25 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `model_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `model_type` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `token_name` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `token` | `varchar(1000)` | YES | NULL | MUL | - | - |
| 6 | `expires_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `extras` | `text` | YES | NULL | - | - | - |
| 8 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_token_logs_on_model_id_and_model_type` | BTREE | 非唯一 | `model_id`, `model_type` |
| `index_token_logs_on_token` | BTREE | 非唯一 | `token`(255) |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## travelrecord

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-05 10:41:43 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `bigint(20)` | NO | NULL | PRI | - | - |
| 2 | `user_id` | `varchar(100)` | YES | NULL | - | - | - |
| 3 | `traveldate` | `date` | YES | NULL | - | - | - |
| 4 | `fee` | `decimal(10,0)` | YES | NULL | - | - | - |
| 5 | `days` | `int(11)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## upgrade_notice_logs

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-05 10:41:43 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `upgrade_notice_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `read` | `tinyint(1)` | YES | 0 | - | - | - |
| 6 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_on_upgrade_notice_logs` | BTREE | 非唯一 | `upgrade_notice_id`, `user_id`, `read` |
| `index_upgrade_notice_logs_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_upgrade_notice_logs_on_user_id_and_upgrade_notice_id` | BTREE | 非唯一 | `user_id`, `upgrade_notice_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## user_access_records

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-05 10:41:43 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | NO | NULL | - | - | - |
| 3 | `organization_id` | `int(11)` | NO | NULL | MUL | - | - |
| 4 | `app_type` | `varchar(50)` | YES | NULL | - | - | - |
| 5 | `created_at` | `datetime` | NO | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_user_access_records_on_organization_id_and_created_at` | BTREE | 非唯一 | `organization_id`, `created_at` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## user_devices

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 8528 |
| 数据容量 | 2.52 MB |
| 索引容量 | 2.12 MB |
| 总容量 | 4.64 MB |
| 创建时间 | 2026-03-05 10:41:43 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `uid` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `device_token` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `client_id` | `varchar(255)` | YES | NULL | MUL | - | - |
| 5 | `platform` | `int(11)` | YES | NULL | - | - | - |
| 6 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 7 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 8 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `device_platform` | `int(11)` | YES | NULL | - | - | - |
| 11 | `device_model` | `varchar(255)` | YES | NULL | - | - | - |
| 12 | `device_id` | `varchar(255)` | YES | NULL | - | - | - |
| 13 | `device_version` | `varchar(255)` | YES | NULL | - | - | - |
| 14 | `device_phone` | `varchar(255)` | YES | NULL | - | - | - |
| 15 | `login_at` | `datetime` | YES | NULL | - | - | - |
| 16 | `ip` | `varchar(255)` | YES | NULL | - | - | - |
| 17 | `deleted_at` | `datetime` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_user_devices_on_client_id` | BTREE | 非唯一 | `client_id` |
| `index_user_devices_on_deleted_at` | BTREE | 非唯一 | `deleted_at` |
| `index_user_devices_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_user_devices_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## user_event_notifications

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-05 10:41:46 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `event_notification_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `is_read` | `tinyint(1)` | YES | 0 | - | - | - |
| 6 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_user_event_notifications_on_event_notification_id` | BTREE | 非唯一 | `event_notification_id` |
| `index_user_event_notifications_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_user_event_notifications_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## user_sign_in_logs

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-05 10:41:46 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `sign_in_at` | `datetime` | YES | NULL | MUL | - | - |
| 4 | `sign_in_ip` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `is_first_sign_in` | `tinyint(1)` | YES | 0 | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_user_sign_in_logs_on_sign_in_at` | BTREE | 非唯一 | `sign_in_at` |
| `index_user_sign_in_logs_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## users

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 1390 |
| 数据容量 | 0.50 MB |
| 索引容量 | 0.34 MB |
| 总容量 | 0.84 MB |
| 创建时间 | 2022-06-07 03:31:14 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `email` | `varchar(255)` | YES |  | MUL | - | - |
| 3 | `encrypted_password` | `varchar(255)` | NO |  | - | - | - |
| 4 | `reset_password_token` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `reset_password_sent_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `remember_created_at` | `datetime` | YES | NULL | - | - | - |
| 7 | `sign_in_count` | `int(11)` | NO | 0 | - | - | - |
| 8 | `current_sign_in_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `last_sign_in_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `current_sign_in_ip` | `varchar(255)` | YES | NULL | - | - | - |
| 11 | `last_sign_in_ip` | `varchar(255)` | YES | NULL | - | - | - |
| 12 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 13 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 14 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 15 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 16 | `confirmation_token` | `varchar(255)` | YES | NULL | - | - | - |
| 17 | `confirmed_at` | `datetime` | YES | NULL | - | - | - |
| 18 | `confirmation_sent_at` | `datetime` | YES | NULL | - | - | - |
| 19 | `unconfirmed_email` | `varchar(255)` | YES | NULL | - | - | - |
| 20 | `failed_attempts` | `int(11)` | YES | NULL | - | - | - |
| 21 | `unlock_token` | `varchar(255)` | YES | NULL | - | - | - |
| 22 | `locked_at` | `datetime` | YES | NULL | - | - | - |
| 23 | `phone` | `varchar(255)` | YES | NULL | MUL | - | - |
| 24 | `role_id` | `int(11)` | YES | NULL | MUL | - | - |
| 25 | `otp_secret_key` | `varchar(255)` | YES | NULL | - | - | - |
| 26 | `workflow_state` | `varchar(255)` | YES | NULL | - | - | - |
| 27 | `job` | `varchar(255)` | YES | NULL | - | - | - |
| 28 | `tel` | `varchar(255)` | YES | NULL | - | - | - |
| 29 | `gender` | `varchar(255)` | YES | NULL | - | - | - |
| 30 | `confirmed_phone_at` | `datetime` | YES | NULL | - | - | - |
| 31 | `pending_report` | `tinyint(1)` | YES | 0 | - | - | - |
| 32 | `superior_id` | `int(11)` | YES | NULL | MUL | - | - |
| 33 | `password_set_at` | `datetime` | YES | NULL | - | - | - |
| 34 | `otp_secret_counter` | `int(11)` | YES | NULL | - | - | - |
| 35 | `deleted_at` | `datetime` | YES | NULL | MUL | - | - |
| 36 | `path` | `varchar(255)` | YES | NULL | MUL | - | - |
| 37 | `name_pinyin` | `varchar(255)` | YES | NULL | - | - | - |
| 38 | `user_type` | `tinyint(4)` | NO | 0 | - | - | - |
| 39 | `status` | `int(11)` | YES | 1 | - | - | - |
| 40 | `usable` | `tinyint(1)` | YES | 1 | - | - | - |
| 41 | `salaries` | `decimal(24,6)` | YES | NULL | - | - | - |
| 42 | `station_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_users_on_deleted_at` | BTREE | 非唯一 | `deleted_at` |
| `index_users_on_email` | BTREE | 非唯一 | `email` |
| `index_users_on_organization_id_deleted_at_status` | BTREE | 非唯一 | `organization_id`, `deleted_at`, `status` |
| `index_users_on_path` | BTREE | 非唯一 | `path` |
| `index_users_on_phone` | BTREE | 非唯一 | `phone` |
| `index_users_on_role_id` | BTREE | 非唯一 | `role_id` |
| `index_users_on_station_id` | BTREE | 非唯一 | `station_id` |
| `index_users_on_superior_id` | BTREE | 非唯一 | `superior_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## users_assist_departments

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 350 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-05 10:42:44 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `department_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_users_assist_departments_on_department_id_and_user_id` | BTREE | 非唯一 | `department_id`, `user_id` |
| `index_users_assist_departments_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## users_departments

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 1379 |
| 数据容量 | 0.16 MB |
| 索引容量 | 0.09 MB |
| 总容量 | 0.25 MB |
| 创建时间 | 2026-03-05 10:42:47 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `department_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_users_departments_on_department_id_and_user_id` | BTREE | 唯一 | `department_id`, `user_id` |
| `index_users_departments_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## wechat_users

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 1070 |
| 数据容量 | 0.08 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.09 MB |
| 创建时间 | 2026-03-05 10:42:48 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `openid` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `prompt_time` | `int(11)` | YES | 0 | - | - | - |
| 7 | `nick_name` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `headimage_url` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `sex` | `int(11)` | YES | NULL | - | - | - |
| 10 | `city` | `varchar(255)` | YES | NULL | - | - | - |
| 11 | `province` | `varchar(255)` | YES | NULL | - | - | - |
| 12 | `country` | `varchar(255)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_wechat_users_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## wx_agents

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.06 MB |
| 总容量 | 0.08 MB |
| 创建时间 | 2026-03-05 10:42:50 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `wx_organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `wx_suite_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `wx_suite_subscriber_id` | `int(11)` | YES | NULL | MUL | - | - |
| 5 | `wx_app_id` | `int(11)` | YES | NULL | MUL | - | - |
| 6 | `suite_id` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `app_id` | `int(11)` | YES | NULL | - | - | - |
| 8 | `agent_id` | `int(11)` | YES | NULL | - | - | - |
| 9 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 10 | `square_logo_url` | `varchar(255)` | YES | NULL | - | - | - |
| 11 | `api_group` | `text` | YES | NULL | - | - | - |
| 12 | `privilege` | `text` | YES | NULL | - | - | - |
| 13 | `description` | `text` | YES | NULL | - | - | - |
| 14 | `status` | `int(11)` | YES | 1 | - | - | - |
| 15 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 16 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 17 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_wx_agents_on_wx_app_id` | BTREE | 非唯一 | `wx_app_id` |
| `index_wx_agents_on_wx_organization_id` | BTREE | 非唯一 | `wx_organization_id` |
| `index_wx_agents_on_wx_suite_id` | BTREE | 非唯一 | `wx_suite_id` |
| `index_wx_agents_on_wx_suite_subscriber_id` | BTREE | 非唯一 | `wx_suite_subscriber_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## wx_apps

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-05 10:42:50 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `wx_suite_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `agent_id` | `int(11)` | YES | NULL | - | - | - |
| 4 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `logo_url` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `home_url` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `description` | `text` | YES | NULL | - | - | - |
| 8 | `callback_url` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_wx_apps_on_wx_suite_id` | BTREE | 非唯一 | `wx_suite_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## wx_department_maps

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-05 10:42:50 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `wx_department_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `department_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_wx_department_maps_on_department_id` | BTREE | 非唯一 | `department_id` |
| `index_wx_department_maps_on_wx_department_id` | BTREE | 非唯一 | `wx_department_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## wx_departments

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-05 10:42:50 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `wx_organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `dept_id` | `int(11)` | YES | NULL | - | - | - |
| 4 | `origin_dept_id` | `int(11)` | YES | NULL | - | - | - |
| 5 | `dept_parent_id` | `int(11)` | YES | NULL | - | - | - |
| 6 | `parent_id` | `int(11)` | YES | NULL | - | - | - |
| 7 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `order` | `bigint(32)` | YES | NULL | - | - | - |
| 9 | `status` | `int(11)` | YES | 1 | - | - | - |
| 10 | `path` | `varchar(255)` | YES | NULL | - | - | - |
| 11 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 12 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 13 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_wx_departments_on_wx_organization_id` | BTREE | 非唯一 | `wx_organization_id` |
| `index_wx_departments_on_wx_organization_id_and_dept_id` | BTREE | 唯一 | `wx_organization_id`, `dept_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## wx_external_contact_maps

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-05 10:42:51 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `organization_id` | `int(11)` | NO | NULL | MUL | - | ??id |
| 3 | `transfer_id` | `int(11)` | NO | NULL | MUL | - | ???????? |
| 4 | `transfer_type` | `varchar(50)` | NO | NULL | - | - | ???????? |
| 5 | `external_userid` | `varchar(255)` | YES | NULL | - | - | ?????????userid |
| 6 | `contact_type` | `int(11)` | YES | NULL | - | - | ??????????? |
| 7 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_wx_external_contact_maps_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_wx_external_contact_maps_on_transfer_id_and_transfer_type` | BTREE | 非唯一 | `transfer_id`, `transfer_type` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## wx_globals

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-05 10:42:51 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `corp_id` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `token` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `aes_key` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `provider_secret` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `provider_access_token` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `provider_access_token_expired_at` | `datetime` | YES | NULL | - | - | - |
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

## wx_organization_maps

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-05 10:42:51 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `wx_organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `organization_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_wx_organization_maps_on_organization_id` | BTREE | 非唯一 | `organization_id` |
| `index_wx_organization_maps_on_wx_organization_id` | BTREE | 非唯一 | `wx_organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## wx_organizations

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-05 10:42:51 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `corp_name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `corp_full_name` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `corp_id` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `corp_type` | `int(11)` | YES | NULL | - | - | - |
| 6 | `corp_round_logo_url` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `corp_square_logo_url` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `corp_user_max` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `corp_agent_max` | `varchar(255)` | YES | NULL | - | - | - |
| 10 | `corp_wxqrcode` | `varchar(255)` | YES | NULL | - | - | - |
| 11 | `subject_type` | `int(11)` | YES | NULL | - | - | - |
| 12 | `verified_end_time` | `datetime` | YES | NULL | - | - | - |
| 13 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 14 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 15 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 16 | `wx_users_count` | `int(11)` | YES | 0 | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## wx_register_templates

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-05 10:42:51 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `service_corp_id` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `template_id` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `callback_url` | `varchar(255)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## wx_registers

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.02 MB |
| 总容量 | 0.03 MB |
| 创建时间 | 2026-03-05 10:42:51 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `wx_register_template_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `service_corp_id` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `corp_id` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `register_code` | `varchar(1000)` | YES | NULL | - | - | - |
| 6 | `data` | `text` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_wx_registers_on_wx_register_template_id` | BTREE | 非唯一 | `wx_register_template_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## wx_suite_subscribers

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-05 10:42:52 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `wx_suite_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `wx_organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `suite_id` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `corp_id` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `permanent_code` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `access_token` | `varchar(1000)` | YES | NULL | - | - | - |
| 8 | `access_token_expired_at` | `datetime` | YES | NULL | - | - | - |
| 9 | `jsapi_ticket` | `varchar(1000)` | YES | NULL | - | - | - |
| 10 | `jsapi_ticket_expired_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `auth_user_info` | `text` | YES | NULL | - | - | - |
| 12 | `status` | `int(11)` | YES | 0 | - | - | - |
| 13 | `auth_channel` | `varchar(255)` | YES | NULL | - | - | - |
| 14 | `actived_at` | `datetime` | YES | NULL | - | - | - |
| 15 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 16 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 17 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_wx_suite_subscribers_on_wx_organization_id` | BTREE | 非唯一 | `wx_organization_id` |
| `index_wx_suite_subscribers_on_wx_suite_id` | BTREE | 非唯一 | `wx_suite_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## wx_suites

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0 MB |
| 总容量 | 0.02 MB |
| 创建时间 | 2026-03-05 10:42:52 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 3 | `suite_id` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `token` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `aes_key` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `secret` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `ticket` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `access_token` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `access_token_expired_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `logo_url` | `varchar(255)` | YES | NULL | - | - | - |
| 11 | `callback_url` | `varchar(255)` | YES | NULL | - | - | - |
| 12 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 13 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 14 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## wx_syn_logs

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-05 10:42:52 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `wx_suite_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `wx_organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `corp_id` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `status` | `int(11)` | YES | 0 | - | - | - |
| 6 | `data` | `text` | YES | NULL | - | - | - |
| 7 | `finish_at` | `datetime` | YES | NULL | - | - | - |
| 8 | `description` | `text` | YES | NULL | - | - | - |
| 9 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 10 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 11 | `event_type` | `int(11)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_wx_syn_logs_on_wx_organization_id` | BTREE | 非唯一 | `wx_organization_id` |
| `index_wx_syn_logs_on_wx_suite_id` | BTREE | 非唯一 | `wx_suite_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## wx_upgrade_notice_logs

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-05 10:42:52 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `notice_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 5 | `updated_at` | `datetime` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_wx_upgrade_notice_logs_on_notice_id` | BTREE | 非唯一 | `notice_id` |
| `index_wx_upgrade_notice_logs_on_user_id` | BTREE | 非唯一 | `user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## wx_user_department_maps

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-05 10:42:52 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `wx_user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `wx_department_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `wx_organization_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_wx_user_department_maps_on_wx_department_id` | BTREE | 非唯一 | `wx_department_id` |
| `index_wx_user_department_maps_on_wx_organization_id` | BTREE | 非唯一 | `wx_organization_id` |
| `index_wx_user_department_maps_on_wx_user_id` | BTREE | 非唯一 | `wx_user_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## wx_user_maps

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-05 10:42:52 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `wx_user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `user_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `user_ticket` | `varchar(1000)` | YES | NULL | - | - | - |
| 5 | `user_ticket_expired_at` | `datetime` | YES | NULL | - | - | - |
| 6 | `wx_organization_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_wx_user_maps_on_user_id` | BTREE | 非唯一 | `user_id` |
| `index_wx_user_maps_on_wx_user_id` | BTREE | 非唯一 | `wx_user_id` |
| `orgnizationid` | BTREE | 非唯一 | `wx_organization_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## wx_users

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.03 MB |
| 总容量 | 0.05 MB |
| 创建时间 | 2026-03-05 10:42:52 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `wx_organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `userid` | `varchar(255)` | YES | NULL | - | - | - |
| 4 | `origin_userid` | `varchar(255)` | YES | NULL | - | - | - |
| 5 | `name` | `varchar(255)` | YES | NULL | - | - | - |
| 6 | `mobile` | `varchar(255)` | YES | NULL | - | - | - |
| 7 | `tel` | `varchar(255)` | YES | NULL | - | - | - |
| 8 | `email` | `varchar(255)` | YES | NULL | - | - | - |
| 9 | `gender` | `int(11)` | YES | NULL | - | - | - |
| 10 | `weixinid` | `varchar(255)` | YES | NULL | - | - | - |
| 11 | `position` | `varchar(255)` | YES | NULL | - | - | - |
| 12 | `is_leader` | `int(11)` | YES | NULL | - | - | - |
| 13 | `avatar` | `varchar(255)` | YES | NULL | - | - | - |
| 14 | `english_name` | `varchar(255)` | YES | NULL | - | - | - |
| 15 | `status` | `int(11)` | YES | 1 | - | - | - |
| 16 | `wxplugin_status` | `int(11)` | YES | NULL | - | - | - |
| 17 | `extattr` | `text` | YES | NULL | - | - | - |
| 18 | `deleted_at` | `datetime` | YES | NULL | - | - | - |
| 19 | `created_at` | `datetime` | YES | NULL | - | - | - |
| 20 | `updated_at` | `datetime` | YES | NULL | - | - | - |
| 21 | `user_ticket` | `varchar(1000)` | YES | NULL | - | - | - |
| 22 | `user_ticket_expired_at` | `datetime` | YES | NULL | - | - | - |
| 23 | `department` | `text` | YES | NULL | - | - | - |
| 24 | `user_type` | `int(11)` | YES | NULL | - | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_wx_users_on_wx_organization_id` | BTREE | 非唯一 | `wx_organization_id` |
| `index_wx_users_on_wx_organization_id_and_userid` | BTREE | 唯一 | `wx_organization_id`, `userid` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |

## wx_visible_departments

| 属性 | 值 |
| --- | --- |
| 存储引擎 | `InnoDB` |
| 预估行数 | 0 |
| 数据容量 | 0.02 MB |
| 索引容量 | 0.05 MB |
| 总容量 | 0.06 MB |
| 创建时间 | 2026-03-05 10:42:53 |
| 更新时间 | - |
| 表注释 | - |

### 字段

| 序号 | 字段名 | 类型 | 可空 | 默认值 | 键 | 额外属性 | 注释 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `int(11)` | NO | NULL | PRI | auto_increment | - |
| 2 | `wx_suite_id` | `int(11)` | YES | NULL | MUL | - | - |
| 3 | `wx_organization_id` | `int(11)` | YES | NULL | MUL | - | - |
| 4 | `wx_department_id` | `int(11)` | YES | NULL | MUL | - | - |

### 索引

| 索引名 | 类型 | 唯一性 | 列 |
| --- | --- | --- | --- |
| `PRIMARY` | BTREE | 唯一 | `id` |
| `index_wx_visible_departments_on_wx_department_id` | BTREE | 非唯一 | `wx_department_id` |
| `index_wx_visible_departments_on_wx_organization_id` | BTREE | 非唯一 | `wx_organization_id` |
| `index_wx_visible_departments_on_wx_suite_id` | BTREE | 非唯一 | `wx_suite_id` |

### 外键

| 约束名 | 字段 | 引用表 | 引用字段 |
| --- | --- | --- | --- |
| - | - | - | - |


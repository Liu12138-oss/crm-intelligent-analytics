CREATE TABLE IF NOT EXISTS query_sessions (
  id VARCHAR(64) PRIMARY KEY,
  channel VARCHAR(32) NOT NULL,
  requester_id VARCHAR(64) NOT NULL,
  context_status VARCHAR(32) NOT NULL,
  external_conversation_id VARCHAR(128) NULL,
  web_session_key VARCHAR(128) NULL,
  last_message_at DATETIME NOT NULL,
  last_heartbeat_at DATETIME NULL,
  active_request_id VARCHAR(64) NULL,
  pending_sequence INT NOT NULL DEFAULT 0,
  disconnect_reason VARCHAR(255) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id VARCHAR(64) PRIMARY KEY,
  requester_id VARCHAR(64) NOT NULL,
  source VARCHAR(32) NOT NULL,
  session_status VARCHAR(32) NOT NULL,
  crm_corp_id VARCHAR(64) NULL,
  crm_access_token TEXT NULL,
  last_access_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS wecom_login_bindings (
  id VARCHAR(64) PRIMARY KEY,
  wecom_user_id VARCHAR(128) NOT NULL,
  wecom_user_name VARCHAR(255) NULL,
  crm_user_id VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS pending_wecom_bindings (
  id VARCHAR(64) PRIMARY KEY,
  bind_token VARCHAR(128) NOT NULL,
  state VARCHAR(128) NOT NULL,
  wecom_user_id VARCHAR(128) NOT NULL,
  wecom_user_name VARCHAR(255) NULL,
  prompt TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS wecom_message_receipts (
  id VARCHAR(64) PRIMARY KEY,
  channel_message_id VARCHAR(128) NOT NULL,
  external_conversation_id VARCHAR(128) NOT NULL,
  sender_id VARCHAR(128) NOT NULL,
  requester_id VARCHAR(64) NULL,
  session_id VARCHAR(64) NULL,
  query_id VARCHAR(64) NULL,
  chat_type VARCHAR(32) NOT NULL,
  message_type VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL,
  reason TEXT NULL,
  raw_payload_summary TEXT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS wecom_delivery_records (
  id VARCHAR(64) PRIMARY KEY,
  receipt_id VARCHAR(64) NOT NULL,
  session_id VARCHAR(64) NOT NULL,
  query_id VARCHAR(64) NULL,
  delivery_target_id VARCHAR(128) NOT NULL,
  block_sequence INT NOT NULL,
  block_type VARCHAR(32) NOT NULL,
  content_preview TEXT NOT NULL,
  status VARCHAR(32) NOT NULL,
  attempt_count INT NOT NULL DEFAULT 0,
  external_message_id VARCHAR(128) NULL,
  failure_reason TEXT NULL,
  created_at DATETIME NOT NULL,
  last_attempt_at DATETIME NULL,
  delivered_at DATETIME NULL
);

CREATE TABLE IF NOT EXISTS proactive_notification_tasks (
  id VARCHAR(64) PRIMARY KEY,
  scene_key VARCHAR(128) NOT NULL,
  title VARCHAR(255) NOT NULL,
  kind VARCHAR(48) NOT NULL,
  preferred_channel VARCHAR(48) NULL,
  resolved_channel VARCHAR(48) NULL,
  message_type VARCHAR(48) NOT NULL,
  markdown_content TEXT NULL,
  template_card_payload TEXT NULL,
  dedupe_key VARCHAR(255) NULL,
  duplicate_of_task_id VARCHAR(64) NULL,
  status VARCHAR(48) NOT NULL,
  original_audience_summary TEXT NOT NULL,
  test_mode_applied TINYINT(1) NOT NULL DEFAULT 0,
  real_message_enabled TINYINT(1) NOT NULL DEFAULT 0,
  recipient_snapshots TEXT NOT NULL,
  attempts TEXT NOT NULL,
  metadata TEXT NULL,
  failure_reason TEXT NULL,
  created_at DATETIME NOT NULL,
  last_attempt_at DATETIME NULL,
  sent_at DATETIME NULL
);

CREATE TABLE IF NOT EXISTS pending_follow_up_writebacks (
  id VARCHAR(64) PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL,
  requester_id VARCHAR(64) NOT NULL,
  requester_name VARCHAR(255) NOT NULL,
  source_receipt_id VARCHAR(64) NOT NULL,
  source_message_id VARCHAR(128) NOT NULL,
  source_query_text TEXT NOT NULL,
  opportunity_id VARCHAR(64) NOT NULL,
  opportunity_title VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255) NULL,
  owner_id VARCHAR(64) NOT NULL,
  owner_name VARCHAR(255) NOT NULL,
  draft_content TEXT NOT NULL,
  status VARCHAR(48) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  confirmed_write_intent_at DATETIME NULL,
  confirmed_content_at DATETIME NULL,
  written_at DATETIME NULL,
  external_revisit_log_id VARCHAR(128) NULL,
  failure_reason TEXT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS wecom_sync_departments (
  id VARCHAR(64) PRIMARY KEY,
  wx_department_id VARCHAR(64) NOT NULL,
  department_name VARCHAR(255) NOT NULL,
  department_alias VARCHAR(255) NULL,
  parent_department_id VARCHAR(64) NULL,
  organization_external_id VARCHAR(64) NULL,
  display_order INT NULL,
  is_parent TINYINT(1) NULL,
  state VARCHAR(64) NULL,
  raw_payload TEXT NOT NULL,
  sync_status VARCHAR(32) NOT NULL,
  last_synced_at DATETIME NOT NULL,
  deleted_at DATETIME NULL
);

CREATE TABLE IF NOT EXISTS wecom_sync_users (
  id VARCHAR(64) PRIMARY KEY,
  wx_userid VARCHAR(255) NOT NULL,
  origin_userid VARCHAR(255) NULL,
  user_name VARCHAR(255) NOT NULL,
  user_alias VARCHAR(255) NULL,
  mobile VARCHAR(255) NULL,
  email VARCHAR(255) NULL,
  tel VARCHAR(255) NULL,
  gender VARCHAR(32) NULL,
  position VARCHAR(255) NULL,
  avatar VARCHAR(255) NULL,
  status VARCHAR(64) NULL,
  organization_external_id VARCHAR(64) NULL,
  primary_department_id VARCHAR(64) NULL,
  raw_payload TEXT NOT NULL,
  sync_status VARCHAR(32) NOT NULL,
  last_synced_at DATETIME NOT NULL,
  deleted_at DATETIME NULL
);

CREATE TABLE IF NOT EXISTS wecom_sync_user_dept_changes (
  id VARCHAR(64) PRIMARY KEY,
  wx_userid VARCHAR(255) NOT NULL,
  change_type VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  department_id VARCHAR(64) NULL,
  change_timestamp DATETIME NOT NULL,
  raw_payload TEXT NOT NULL,
  synced_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS wecom_sync_checkpoints (
  id VARCHAR(64) PRIMARY KEY,
  resource_type VARCHAR(64) NOT NULL,
  candidate_cursor VARCHAR(128) NOT NULL,
  committed_cursor VARCHAR(128) NOT NULL,
  last_success_at DATETIME NULL,
  last_attempt_at DATETIME NULL,
  last_failure_reason TEXT NULL,
  last_success_page INT NULL,
  status VARCHAR(32) NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS wecom_sync_runs (
  id VARCHAR(64) PRIMARY KEY,
  resource_type VARCHAR(64) NOT NULL,
  run_mode VARCHAR(32) NOT NULL,
  started_at DATETIME NOT NULL,
  finished_at DATETIME NULL,
  status VARCHAR(32) NOT NULL,
  page_count INT NOT NULL DEFAULT 0,
  item_count INT NOT NULL DEFAULT 0,
  from_cursor VARCHAR(128) NOT NULL,
  to_cursor VARCHAR(128) NULL,
  failure_reason TEXT NULL
);

CREATE TABLE IF NOT EXISTS analysis_requests (
  id VARCHAR(64) PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL,
  requester_id VARCHAR(64) NOT NULL,
  entry_channel VARCHAR(32) NOT NULL,
  query_source VARCHAR(32) NOT NULL,
  intent_domain VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  question_text TEXT NULL,
  clarification_prompt TEXT NULL,
  generated_query TEXT NULL,
  error_message TEXT NULL,
  created_at DATETIME NOT NULL,
  completed_at DATETIME NULL
);

CREATE TABLE IF NOT EXISTS analysis_results (
  request_id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  summary TEXT NULL,
  scope_summary TEXT NOT NULL,
  row_count INT NOT NULL DEFAULT 0,
  consistency_token VARCHAR(128) NOT NULL,
  data_freshness_at DATETIME NOT NULL,
  returned_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS query_templates (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(32) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS recent_queries (
  id VARCHAR(64) PRIMARY KEY,
  requester_id VARCHAR(64) NOT NULL,
  source_request_id VARCHAR(64) NOT NULL,
  question_text TEXT NOT NULL,
  status VARCHAR(32) NOT NULL,
  last_used_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS access_policies (
  id VARCHAR(64) PRIMARY KEY,
  status VARCHAR(32) NOT NULL,
  export_row_limit INT NOT NULL,
  export_daily_limit INT NOT NULL,
  max_online_sessions INT NOT NULL,
  max_concurrent_queries INT NOT NULL,
  heartbeat_interval_seconds INT NOT NULL,
  idle_timeout_seconds INT NOT NULL,
  history_retention_days INT NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id VARCHAR(64) PRIMARY KEY,
  event_type VARCHAR(64) NOT NULL,
  actor_id VARCHAR(64) NOT NULL,
  risk_level VARCHAR(16) NOT NULL,
  review_status VARCHAR(16) NOT NULL,
  outcome TEXT NOT NULL,
  failure_reason TEXT NULL,
  created_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS export_requests (
  id VARCHAR(64) PRIMARY KEY,
  analysis_request_id VARCHAR(64) NOT NULL,
  requester_id VARCHAR(64) NOT NULL,
  row_count INT NOT NULL DEFAULT 0,
  consistency_token VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL,
  blocked_reason TEXT NULL,
  download_url TEXT NULL,
  created_at DATETIME NOT NULL,
  exported_at DATETIME NULL
);

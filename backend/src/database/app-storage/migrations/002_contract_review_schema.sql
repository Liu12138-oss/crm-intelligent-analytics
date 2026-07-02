CREATE TABLE IF NOT EXISTS contract_review_rule_sets (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(64) NOT NULL,
  version VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  issued_at DATETIME NOT NULL,
  item_count INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS contract_review_tasks (
  id VARCHAR(64) PRIMARY KEY,
  requester_id VARCHAR(64) NOT NULL,
  requester_name VARCHAR(255) NOT NULL,
  original_file_name VARCHAR(255) NOT NULL,
  stored_file_path TEXT NOT NULL,
  mime_type VARCHAR(128) NOT NULL,
  file_size BIGINT NOT NULL,
  status VARCHAR(32) NOT NULL,
  latest_stage_message TEXT NOT NULL,
  rule_set_code VARCHAR(64) NOT NULL,
  rule_set_version VARCHAR(32) NOT NULL,
  overall_decision VARCHAR(32) NOT NULL,
  summary TEXT NOT NULL,
  latest_result_summary TEXT NOT NULL,
  veto_count INT NOT NULL DEFAULT 0,
  high_risk_count INT NOT NULL DEFAULT 0,
  medium_risk_count INT NOT NULL DEFAULT 0,
  low_risk_count INT NOT NULL DEFAULT 0,
  total_issue_count INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  completed_at DATETIME NULL
);

CREATE TABLE IF NOT EXISTS contract_review_issues (
  id VARCHAR(64) PRIMARY KEY,
  task_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  risk_level VARCHAR(16) NOT NULL,
  is_veto TINYINT(1) NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  suggestion TEXT NOT NULL,
  quote_text TEXT NOT NULL,
  rule_code VARCHAR(64) NOT NULL,
  rule_title VARCHAR(255) NOT NULL,
  source_clause VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS contract_review_artifacts (
  id VARCHAR(64) PRIMARY KEY,
  task_id VARCHAR(64) NOT NULL,
  artifact_type VARCHAR(32) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NULL,
  mime_type VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  failure_reason TEXT NULL
);

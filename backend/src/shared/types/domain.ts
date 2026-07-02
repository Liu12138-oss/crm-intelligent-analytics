export type ChannelType = 'wecom-bot' | 'web-console';

export type QuerySourceType = 'FREE_TEXT' | 'COMMON_TEMPLATE' | 'RECENT_RERUN';

export type AnalysisExecutionMode =
  | 'PLAN_EXECUTION'
  | 'GUARDED_DIRECT_QUERY';

export type AnalysisRoute =
  | 'OPENAPI'
  | 'SQLITE_READONLY';

export type AnalysisExecutionSource =
  | 'CRM_OFFICIAL_API'
  | 'OPENAPI_MARKDOWN_SNAPSHOT'
  | 'CRM_SQLITE_READONLY'
  | 'GUARDED_READONLY_SQL'
  | 'ANALYSIS_WAREHOUSE'
  | 'INTERNAL_READONLY_API';

export type AnalysisSemanticKnowledgeAssetType =
  | 'ALIAS'
  | 'TEMPORAL_FIELD_HINT'
  | 'ORGANIZATION_NORMALIZATION'
  | 'VALIDATED_EXAMPLE'
  | 'NEGATIVE_EXAMPLE';

export type AnalysisSemanticKnowledgeAssetStatus = 'ACTIVE' | 'INACTIVE';

/**
 * 语义知识资产来源类型。
 *
 * - MANUAL：管理员手工创建和维护
 * - AUTO_DERIVED：学习闭环沉淀器自动生成，需管理员审核后生效
 */
export type AnalysisSemanticKnowledgeAssetSource = 'MANUAL' | 'AUTO_DERIVED';

/**
 * 语义知识资产审核状态（学习闭环用）。
 *
 * - PROPOSED：沉淀器生成的候选，尚未审核，不注入 AI 理解层
 * - ACTIVE：已审核通过（或手工创建直接生效），注入 AI 理解层
 * - REJECTED：管理员驳回，保留记录用于去重和规则调优
 * - EXPIRED：候选超过 30 天未审核自动过期
 */
export type AnalysisSemanticKnowledgeAssetReviewStatus =
  | 'PROPOSED'
  | 'ACTIVE'
  | 'REJECTED'
  | 'EXPIRED';

export type AnalysisRequestStatus =
  | 'RECEIVED'
  | 'PARSED'
  | 'CLARIFICATION_REQUIRED'
  | 'VALIDATED'
  | 'EXECUTED'
  | 'RENDERED'
  | 'RETURNED'
  | 'BLOCKED'
  | 'TIMEOUT'
  | 'FAILED'
  | 'QUEUED';

export type QuerySessionStatus =
  | 'NEW'
  | 'ACTIVE'
  | 'CLARIFYING'
  | 'EXECUTING'
  | 'ANSWERING'
  | 'IDLE'
  | 'DEGRADED'
  | 'EXPIRED'
  | 'CLOSED';

export type DailyReportFlowStatus = 'IDLE' | 'COLLECTING' | 'AWAITING_CONFIRMATION';

export type FollowUpWritebackStatus =
  | 'DRAFTED'
  | 'AWAITING_CONTENT_CONFIRMATION'
  | 'WRITING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED';

export type FollowUpLoggableType = 'Opportunity' | 'Customer';

export type FollowUpShareStatus = 'IDLE' | 'AWAITING_CONFIRMATION';

export type CrmCreateEntityType = 'Customer' | 'Opportunity';

export type CrmCreateFlowStatus =
  | 'COLLECTING'
  | 'AWAITING_CONFIRMATION'
  | 'COMPLETED'
  | 'FAILED';

export type ExportStatus = 'REQUESTED' | 'COMPLETED' | 'BLOCKED';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type ContractReviewTaskStatus =
  | 'UPLOADED'
  | 'PARSING'
  | 'REVIEWING'
  | 'GENERATING_REPORT'
  | 'COMPLETED'
  | 'FAILED'
  | 'BLOCKED';

export type ContractReviewDecision = 'APPROVE' | 'REVISE' | 'REJECT';

export type ContractReviewArtifactType =
  | 'REPORT'
  | 'ANNOTATED_DOCX'
  | 'STRUCTURED_RESULT'
  | 'AI_DEBUG_CONTEXT';

export type ContractReviewArtifactStatus = 'AVAILABLE' | 'PENDING' | 'FAILED';

export type ContractReviewExecutionMode =
  | 'AI_HYBRID'
  | 'DETERMINISTIC_ONLY'
  | 'BLOCKED';

export type ContractReviewSupplementalReviewStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED';

export interface ContractReviewPromptFingerprintRecord {
  planner: string;
  reviewer: string;
  summarizer: string;
}

export interface ContractReviewReviewBasisRecord {
  packCode: string;
  packVersion: string;
  packChecksum: string;
  packChecksumSummary: string;
  modelProfile: string;
  executionMode: ContractReviewExecutionMode;
  degradationReason?: string;
  promptFingerprints?: ContractReviewPromptFingerprintRecord;
}

export type ContractReviewTaskSourceType =
  | 'UPLOAD'
  | 'CRM_PENDING_APPROVAL';

export interface ContractReviewSourceApprovalRecord {
  step: number;
  status: string;
  approverId?: string;
  approverName?: string;
  approveAt?: string;
  comment?: string;
}

export interface ContractReviewSourceContractSnapshotRecord {
  contractId: string;
  contractCode?: string;
  contractName: string;
  customerName?: string;
  opportunityTitle?: string;
  ownerId: string;
  ownerName: string;
  organizationId: string;
  departmentId?: string;
  departmentName?: string;
  totalAmount: number;
  startAt?: string;
  endAt?: string;
  signDate?: string;
  customerSigner?: string;
  ourSigner?: string;
  specialTerms?: string;
  specialTermBlocks: string[];
  approvalComment?: string;
  approvalHistory: ContractReviewSourceApprovalRecord[];
  approveStatus: string;
  pendingStep: number;
  submitApplyingAt?: string;
  sourceSummary: string;
  reviewContent: string;
}

export type AuditReviewStatus = 'PENDING' | 'CONFIRMED' | 'IGNORED';

export type AuditEventType =
  | 'ANALYSIS_SEMANTIC_KNOWLEDGE_ASSET_SAVED'
  | 'ANALYSIS_SEMANTIC_KNOWLEDGE_ASSET_STATUS_UPDATED'
  | 'ANALYSIS_SEMANTIC_KNOWLEDGE_PUBLISHED'
  | 'ANALYSIS_SEMANTIC_KNOWLEDGE_ROLLED_BACK'
  | 'ACCESS_ACTION_DENIED'
  | 'ACCESS_MENU_DENIED'
  | 'ACCESS_CHANNEL_DENIED'
  | 'ANALYSIS_SCOPE_POLICY_UPDATED'
  | 'APPLICATION_SUPER_ADMIN_POLICY_UPDATED'
  | 'ACCESS_ROLE_PERMISSION_UPDATED'
  | 'ACCESS_ROLE_PERMISSION_PUBLISHED'
  | 'ACCESS_PREVIEW_EXECUTED'
  | 'DATA_SCOPE_GRANT_UPDATED'
  | 'DATA_SCOPE_PREVIEW_EXECUTED'
  | 'DAILY_REPORT_DELIVERY_POLICY_UPDATED'
  | 'DAILY_REPORT_DELIVERY_PREVIEW_EXECUTED'
  | 'IDENTITY_MAPPING_DIAGNOSTIC_QUERIED'
  | 'WECOM_PILOT_POLICY_UPDATED'
  | 'WECOM_PILOT_POLICY_PREVIEWED'
  | 'WECOM_PILOT_ACCESS_DENIED'
  | 'QUERY_SUCCEEDED'
  | 'QUERY_BLOCKED'
  | 'QUERY_TEMPLATE_COPIED'
  | 'QUERY_TEMPLATE_USAGE_UPDATED'
  | 'QUERY_TEMPLATE_TAGS_UPDATED'
  | 'QUERY_TEMPLATE_SAVE_SUCCEEDED'
  | 'QUERY_TEMPLATE_SAVE_FAILED'
  | 'QUERY_TEMPLATE_FIXED_SCOPE_BLOCKED'
  | 'QUERY_TEMPLATE_FIXED_SCOPE_REWRITTEN'
  | 'MANAGEMENT_REPORT_VIEWED'
  | 'MANAGEMENT_REPORT_EXPORTED'
  | 'MANAGEMENT_REPORT_SCOPE_BLOCKED'
  | 'CLARIFICATION_REQUESTED'
  | 'TEMPLATE_EXECUTED'
  | 'HISTORY_RERUN'
  | 'EXPORT_SUCCEEDED'
  | 'EXPORT_BLOCKED'
  | 'DASHBOARD_COMPOSED'
  | 'DASHBOARD_VIEWED'
  | 'DASHBOARD_TEMPLATE_EXECUTED'
  | 'AUTH_LOGIN_SUCCEEDED'
  | 'AUTH_LOGIN_FAILED'
  | 'WECOM_AUTH_SUCCEEDED'
  | 'WECOM_AUTH_FAILED'
  | 'WECOM_MESSAGE_ACCEPTED'
  | 'WECOM_MESSAGE_DEDUPED'
  | 'WECOM_MESSAGE_REJECTED'
  | 'WECOM_SESSION_STATE_CHANGED'
  | 'WECOM_DELIVERY_SUCCEEDED'
  | 'WECOM_BOT_CONFIG_UPDATED'
  | 'WECOM_BOT_CONFIG_TESTED'
  | 'WECOM_CRM_READONLY_QUESTION_ANSWERED'
  | 'WECOM_CRM_READONLY_QUESTION_BLOCKED'
  | 'CRM_OPENAPI_CONFIG_UPDATED'
  | 'CRM_OPENAPI_CONFIG_TESTED'
  | 'PROACTIVE_NOTIFICATION_REQUESTED'
  | 'PROACTIVE_NOTIFICATION_DEDUPED'
  | 'PROACTIVE_NOTIFICATION_SENT'
  | 'PROACTIVE_NOTIFICATION_FAILED'
  | 'PROACTIVE_NOTIFICATION_BLOCKED'
  | 'AI_CONTEXT_READ'
  | 'AI_ANALYSIS_REQUESTED'
  | 'AI_RESULT_EXPLAINED'
  | 'DAILY_REPORT_DRAFT_SAVED'
  | 'DAILY_REPORT_CONFIRMED'
  | 'DAILY_REPORT_DELIVERY_SENT'
  | 'DAILY_REPORT_ASSISTANCE_SENT'
  | 'DAILY_REPORT_ASSISTANCE_BLOCKED'
  | 'DAILY_REPORT_ASSISTANCE_FAILED'
  | 'DAILY_REPORT_REMINDER_SENT'
  | 'DAILY_REPORT_CLOSED'
  | 'DAILY_REPORT_SUMMARIZED'
  | 'MAINTENANCE_DEGRADED'
  | 'MAINTENANCE_RECOVERED'
  | 'WECOM_DIRECTORY_SYNC_TRIGGERED'
  | 'WECOM_DIRECTORY_SYNC_FINISHED'
  | 'WECOM_IDENTITY_RESOLVED'
  | 'FOLLOW_UP_WRITEBACK_DRAFTED'
  | 'FOLLOW_UP_WRITEBACK_INTENT_CONFIRMED'
  | 'FOLLOW_UP_WRITEBACK_CONTENT_CONFIRMED'
  | 'FOLLOW_UP_WRITEBACK_CANCELLED'
  | 'FOLLOW_UP_WRITEBACK_SUCCEEDED'
  | 'FOLLOW_UP_WRITEBACK_FAILED'
  | 'FOLLOW_UP_WRITEBACK_DUPLICATE_BLOCKED'
  | 'FOLLOW_UP_SHARE_PENDING_CONFIRMATION'
  | 'FOLLOW_UP_SHARE_SUCCEEDED'
  | 'FOLLOW_UP_SHARE_CANCELLED'
  | 'FOLLOW_UP_SHARE_FAILED'
  | 'WECOM_CRM_CREATE_DRAFTED'
  | 'WECOM_CRM_CREATE_CONFIRMED'
  | 'WECOM_CRM_CREATE_CANCELLED'
  | 'WECOM_CRM_CREATE_SUCCEEDED'
  | 'WECOM_CRM_CREATE_FAILED'
  | 'WECOM_CRM_CREATE_DUPLICATE_BLOCKED'
  | 'WECOM_AI_DRAFT_STRUCTURED'
  | 'WECOM_CANDIDATE_RERANKED'
  | 'AI_MODEL_PROFILE_CREATED'
  | 'AI_MODEL_PROFILE_UPDATED'
  | 'AI_MODEL_PROFILE_SECRET_CLEARED'
  | 'AI_MODEL_PROFILE_HEALTH_CHECKED'
  | 'AI_MODEL_PROFILE_ACTIVATED'
  | 'AI_MODEL_PROFILE_ACTIVATION_ROLLED_BACK'
  | 'AI_CONTEXT_POLICY_READ'
  | 'AI_CONTEXT_POLICY_UPDATED'
  | 'AI_CONTEXT_POLICY_UPDATE_FAILED'
  | 'SECURITY_INTERCEPTED'
  | 'CONNECTION_INTERRUPTED'
  | 'STREAM_DELIVERY_FAILED'
  | 'CONTRACT_REVIEW_FILE_UPLOADED'
  | 'CONTRACT_REVIEW_SOURCE_CONTRACT_VIEWED'
  | 'CONTRACT_REVIEW_SOURCE_REVIEW_STARTED'
  | 'CONTRACT_REVIEW_TASK_CREATED'
  | 'CONTRACT_REVIEW_TASK_COMPLETED'
  | 'CONTRACT_REVIEW_TASK_FAILED'
  | 'CONTRACT_REVIEW_TASK_BLOCKED'
  | 'CONTRACT_REVIEW_ARTIFACT_DOWNLOADED'
  | 'SQL_AUDIT_RAW_VIEWED'
  // ===== 学习闭环审计事件类型（第 5 期）=====
  | 'ANALYSIS_RESULT_FEEDBACK'
  | 'KNOWLEDGE_ASSET_PROPOSED'
  | 'KNOWLEDGE_ASSET_APPROVED'
  | 'KNOWLEDGE_ASSET_REJECTED'
  | 'KNOWLEDGE_ASSET_EXPIRED'
  | 'CALIBRATION_CONFLICT_DETECTED'
  | 'CALIBRATION_CONFLICT_RESOLVED'
  | 'DASHBOARD_TEMPLATE_PROPOSED'
  | 'DASHBOARD_TEMPLATE_APPROVED';

export type SqlAuditStage =
  | 'PREPARED'
  | 'PREFLIGHT'
  | 'EXECUTED'
  | 'FAILED'
  | 'BLOCKED';

export type SqlAuditStatus = 'SUCCEEDED' | 'FAILED' | 'BLOCKED';

export type SqlAuditDatabaseRole =
  | 'CRM_READONLY'
  | 'CRM_WRITEBACK'
  | 'ANALYSIS_WAREHOUSE';

export type SqlAuditOperationType =
  | 'SELECT'
  | 'INSERT'
  | 'UPDATE'
  | 'DELETE'
  | 'EXPLAIN'
  | 'UNKNOWN';

export type SqlAuditModuleKey =
  | 'analysis-workbench'
  | 'query-assets'
  | 'management-report'
  | 'audit-center'
  | 'access-governance'
  | 'contract-review'
  | 'crm-identity'
  | 'wecom-directory-sync'
  | 'wecom-bot'
  | 'wecom-auth'
  | 'daily-report'
  | 'auth-phone-repair'
  | 'crm-readonly'
  | 'system';

export type WecomInboundMessageType =
  | 'text'
  | 'image'
  | 'mixed'
  | 'voice'
  | 'file'
  | 'unknown';

export type WecomChatType = 'single' | 'group';

export type WecomMessageReceiptStatus = 'ACCEPTED' | 'DUPLICATE' | 'REJECTED';

export type WecomDeliveryStatus =
  | 'PENDING'
  | 'SENT'
  | 'RETRYING'
  | 'FAILED'
  | 'SKIPPED';

export type ProactiveNotificationChannel =
  | 'WECOM_APP_MESSAGE'
  | 'WECOM_BOT_MESSAGE';

export type ProactiveNotificationKind =
  | 'FORMAL'
  | 'FORMAL_NOTICE'
  | 'CONVERSATION_CONTEXT';

export type ProactiveNotificationTaskStatus =
  | 'PENDING'
  | 'SENT'
  | 'PARTIAL_FAILED'
  | 'FAILED'
  | 'BLOCKED'
  | 'DEDUPED';

export type ProactiveNotificationRecipientType =
  | 'CRM_USER'
  | 'WECOM_USER'
  | 'WECOM_PARTY'
  | 'WECOM_TAG'
  | 'WECOM_CONVERSATION';

export type ProactiveNotificationRecipientStatus =
  | 'READY'
  | 'TEST_OVERRIDDEN'
  | 'BLOCKED';

export type ProactiveNotificationAttemptStatus =
  | 'PENDING'
  | 'SENT'
  | 'FAILED'
  | 'SKIPPED';

export type ResultViewType =
  | 'METRIC_CARDS'
  | 'LINE_CHART'
  | 'BAR_CHART'
  | 'PIE_CHART'
  | 'RANKING_TABLE'
  | 'DETAIL_TABLE';

export type AnalysisDomain =
  | 'opportunity-analysis'
  | 'contract-conversion'
  | 'customer-relationship';

export type QueryConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export type AnalysisEntryMode = 'FREE_QUERY' | 'FIXED_WORKFLOW';

export type AnalysisResultIntent =
  | 'ranking'
  | 'trend'
  | 'distribution'
  | 'detail'
  | 'comparison'
  | 'summary'
  | 'unknown';

export type TemporalGranularity =
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year'
  | 'custom';

export type TemporalRelativity = 'absolute' | 'relative' | 'mixed';

export interface TemporalSlot {
  rawText: string;
  normalizedLabel: string;
  startAt?: string;
  endAt?: string;
  timezone: 'Asia/Shanghai';
  granularity: TemporalGranularity;
  relativity: TemporalRelativity;
  inclusivity: {
    start: 'inclusive';
    end: 'exclusive' | 'inclusive';
  };
  confidence: QueryConfidence;
  unresolvedReason?: string;
}

export interface ResultTemporalScope {
  rawText: string;
  normalizedLabel: string;
  startAt?: string;
  endAt?: string;
  granularity: TemporalGranularity | string;
  timezone: string;
  source: 'AI_TEMPORAL_SLOT' | 'USER_EXPLICIT' | 'FALLBACK_CLARIFICATION';
}

export type AiEntryLanguage =
  | 'zh-CN'
  | 'en'
  | 'ko'
  | 'ja'
  | 'mixed'
  | 'unknown';

export type AiEntryIntent =
  | 'ANALYZE'
  | 'ENTITY_LOOKUP'
  | 'EXPLAIN_RESULT'
  | 'FOLLOW_UP_ANALYZE'
  | 'HELP_GUIDANCE'
  | 'TASK_CANCEL'
  | 'TASK_SWITCH'
  | 'CONFIRM'
  | 'MODIFY'
  | 'CONTINUE'
  | 'BLOCK'
  | 'UNKNOWN';

export type AiEntryScene =
  | 'WEB_ANALYSIS_QUERY'
  | 'WEB_ANALYSIS_FOLLOW_UP'
  | 'WECOM_IDLE_MESSAGE'
  | 'WECOM_ACTIVE_TASK_REPLY'
  | 'CONTRACT_REVIEW_NATURAL_LANGUAGE';

export type AiEntryTargetWorkflow =
  | 'ANALYSIS_QUERY_EXECUTION'
  | 'WECOM_ENTITY_LOOKUP'
  | 'ANALYSIS_RESULT_EXPLANATION'
  | 'ANALYSIS_CLARIFICATION'
  | 'ANALYSIS_BLOCKED'
  | 'WECOM_HELP_GUIDANCE'
  | 'WECOM_TASK_ROUTER'
  | 'WECOM_DAILY_REPORT_ENTRY'
  | 'WECOM_DAILY_REPORT_QUERY'
  | 'WECOM_TEAM_DAILY_REPORT_QUERY'
  | 'WECOM_CRM_CREATE_CUSTOMER'
  | 'WECOM_CRM_CREATE_OPPORTUNITY'
  | 'WECOM_OPPORTUNITY_LOOKUP'
  | 'CONTRACT_REVIEW_UPLOAD_PRECHECK'
  | 'CONTRACT_REVIEW_NATURAL_LANGUAGE_ROUTER';

export type AiExecutionGateResult =
  | 'BYPASSED'
  | 'BLOCKED'
  | 'CLARIFICATION_REQUIRED'
  | 'PENDING_CONFIRMATION'
  | 'CONFIRMED'
  | 'CANCELLED';

export type AiSdkType =
  | 'openai-compatible-http'
  | 'codex-sdk'
  | 'claude-agent-sdk';

export type AiWireApi = 'responses' | 'chat_completions';

export type AiStructuredOutputMode =
  | 'json_schema'
  | 'json_object'
  | 'prompt_schema';

export type AiModelProfileStatus = 'ACTIVE' | 'INACTIVE';

export type AiHealthCheckStatus = 'SUCCEEDED' | 'FAILED';

export interface AiModelProfileRecord {
  id: string;
  name: string;
  description?: string;
  providerCode: string;
  sourceType?: 'MANUAL' | 'ENV_BOOTSTRAPPED';
  bootstrapKey?:
    | 'env_openai_compatible_http_default'
    | 'env_codex_default'
    | 'env_claude_default';
  bootstrapWarnings?: string[];
  lastBootstrapAt?: string;
  sdkType: AiSdkType;
  model: string;
  baseUrl?: string;
  secretCiphertext?: string;
  secretConfigured: boolean;
  reasoningEffort?: string;
  serviceTier?: string;
  timeoutMs?: number;
  status: AiModelProfileStatus;
  sdkOptions: Record<string, unknown>;
  lastHealthCheckAt?: string;
  lastHealthCheckStatus?: AiHealthCheckStatus;
  lastHealthCheckLatencyMs?: number;
  lastHealthCheckFailureReason?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiModelActivationRecord {
  activeProfileId?: string;
  activatedAt?: string;
  activatedBy?: string;
  lastVerifiedAt?: string;
  lastVerificationStatus?: AiHealthCheckStatus;
}

export interface AiContextPolicyRecord {
  id: string;
  turnRetentionLimit: number;
  historySummaryMaxLength: number;
  latestQuestionMaxLength: number;
  latestSummaryMaxLength: number;
  analysisSessionIdleTimeoutSeconds: number;
  taskSessionIdleTimeoutSeconds: number;
  updatedBy: string;
  updatedAt: string;
}

export interface AiEntryInterpretationSnapshot {
  channel: ChannelType;
  scene: AiEntryScene;
  targetWorkflow: AiEntryTargetWorkflow;
  originalText: string;
  language: AiEntryLanguage;
  intent?: AiEntryIntent;
  requestedAction?: string;
  replyIntent?: string;
  confidence: QueryConfidence;
  usedFallback: boolean;
  fallbackReason?: string;
  packCode?: string;
  packVersion?: string;
  validationFailureReason?: string;
  providerCode?: string;
  model?: string;
  blockReason?: string;
  structuredSlots?: Record<string, unknown>;
  generatedAt: string;
}

export interface AiWorkflowRoutingSnapshot {
  targetWorkflow: AiEntryTargetWorkflow;
  finalProgram: string;
  requiresConfirmation: boolean;
  gateResult?: AiExecutionGateResult;
  executionMode?: AnalysisExecutionMode;
  blockedReason?: string;
  generatedAt: string;
}

export type QueryPlanResultKind =
  | 'metric-summary'
  | 'owner-ranking'
  | 'time-trend'
  | 'stage-distribution'
  | 'category-distribution'
  | 'department-contribution'
  | 'partner-contribution'
  | 'risk-overview';

export type AnalysisFacetProfile =
  | 'owner-performance-ranking'
  | 'region-operations'
  | 'customer-operations'
  | 'opportunity-risk'
  | 'lead-funnel'
  | 'generic-analysis';

export type AnalysisDepth = 'snapshot' | 'standard' | 'deep-dive';

export type AnalysisFocus =
  | 'ranking'
  | 'trend'
  | 'risk'
  | 'region'
  | 'customer-contribution'
  | 'structure'
  | 'detail'
  | 'summary';

export type AnalysisOutputPreference =
  | 'text_summary'
  | 'table'
  | 'chart'
  | 'wecom_image'
  | 'html_report'
  | 'export_file';

export type AnalysisTaskPurpose =
  | 'primary-summary'
  | 'trend-series'
  | 'distribution'
  | 'detail-table'
  | 'focus-contribution'
  | 'risk-observation';

export interface QueryOrderBy {
  field: string;
  direction: 'ASC' | 'DESC';
}

export interface QueryPlanAst {
  type: 'query-plan';
  domain: AnalysisDomain;
  baseTable: 'opportunities' | 'contracts' | 'customers';
  joinTables: string[];
  metrics: string[];
  dimensions: string[];
  filters: Record<string, unknown>;
  groupBy: string[];
  orderBy: QueryOrderBy[];
  resultKind: QueryPlanResultKind;
  temporalSlot?: TemporalSlot;
  limit?: number;
  confidence: QueryConfidence;
}

export interface ScopeSnapshot {
  organizationIds: string[];
  departmentIds: string[];
  ownerIds: string[];
  scopeSummary: string;
  defaultOwnerIds?: string[];
  defaultDepartmentIds?: string[];
  ownerIdsBeforeDepartmentPrune?: string[];
  prunedOwnerIds?: string[];
  departmentPruneSummary?: string;
  grantedDepartmentIds?: string[];
  grantSummaries?: string[];
  scopeSource?: 'crm-user' | 'wecom-organization' | 'mixed' | 'application-super-admin';
  isFullAccess?: boolean;
  fullAccessSource?: 'application-super-admin' | 'crm-admin' | 'analysis-scope-policy';
  failureReason?: string;
}

export interface CrmUser {
  id: string;
  name: string;
  roleIds: string[];
  roleNames: string[];
  organizationIds: string[];
  departmentIds: string[];
  ownerIds: string[];
  isAdmin: boolean;
  exportAllowed: boolean;
  channels: ChannelType[];
  wecomSenderId?: string;
  supervisorId?: string;
  supervisorName?: string;
  identitySource?:
    | 'mock'
    | 'database'
    | 'crm-api'
    | 'mirror-userid'
    | 'mirror-phone'
    | 'mirror-email';
}

export interface AuthSessionRecord {
  id: string;
  requesterId: string;
  source: 'password-login' | 'wecom-scan';
  sessionStatus: 'ACTIVE' | 'EXPIRED' | 'CLOSED';
  crmCorpId?: string;
  crmAccessToken?: string;
  userSnapshot: CrmUser;
  lastAccessAt: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface WecomLoginBindingRecord {
  id: string;
  wecomUserId: string;
  wecomUserName?: string;
  crmUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PendingWecomBindingRecord {
  id: string;
  bindToken: string;
  state: string;
  wecomUserId: string;
  wecomUserName?: string;
  mobile?: string;
  email?: string;
  prompt: string;
  createdAt: string;
  expiresAt: string;
}

export interface WecomInboundMessage {
  channelMessageId: string;
  externalConversationId: string;
  senderId: string;
  rawSenderId?: string;
  deliveryTargetId: string;
  chatType: WecomChatType;
  messageType: WecomInboundMessageType;
  messageText?: string;
  botId?: string;
  channelAgentId?: string;
  responseUrl?: string;
  replyFrameHeaders?: {
    req_id: string;
  };
  rawPayload: Record<string, unknown>;
  receivedAt: string;
}

export interface WecomMessageReceiptRecord {
  id: string;
  channelMessageId: string;
  externalConversationId: string;
  senderId: string;
  requesterId?: string;
  sessionId?: string;
  queryId?: string;
  chatType: WecomChatType;
  messageType: WecomInboundMessageType;
  status: WecomMessageReceiptStatus;
  reason?: string;
  rawPayloadSummary?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WecomDeliveryRecord {
  id: string;
  receiptId: string;
  sessionId: string;
  queryId?: string;
  deliveryTargetId: string;
  blockSequence: number;
  blockType: StreamBlock['blockType'];
  contentPreview: string;
  status: WecomDeliveryStatus;
  attemptCount: number;
  externalMessageId?: string;
  failureReason?: string;
  createdAt: string;
  lastAttemptAt?: string;
  deliveredAt?: string;
}

export interface ProactiveNotificationRecipientSnapshot {
  id: string;
  recipientType: ProactiveNotificationRecipientType;
  status: ProactiveNotificationRecipientStatus;
  displayName?: string;
  crmUserId?: string;
  wecomUserId?: string;
  partyId?: string;
  tagId?: string;
  deliveryTargetId: string;
  chatType?: WecomChatType;
  externalConversationId?: string;
  resolutionReason?: string;
}

export interface ProactiveNotificationAttemptRecord {
  id: string;
  recipientSnapshotId: string;
  channel: ProactiveNotificationChannel;
  status: ProactiveNotificationAttemptStatus;
  attemptCount: number;
  externalMessageId?: string;
  externalErrorCode?: string;
  externalErrorMessage?: string;
  retryStrategy?: 'NONE' | 'STANDARD_RETRY' | 'RATE_LIMIT_BACKOFF';
  nextRetryAt?: string;
  invalidUserIds?: string[];
  invalidPartyIds?: string[];
  invalidTagIds?: string[];
  failureReason?: string;
  createdAt: string;
  lastAttemptAt?: string;
  deliveredAt?: string;
}

export interface ProactiveNotificationTaskRecord {
  id: string;
  sceneKey: string;
  title: string;
  kind: ProactiveNotificationKind;
  preferredChannel?: ProactiveNotificationChannel;
  resolvedChannel?: ProactiveNotificationChannel;
  messageType: 'markdown' | 'template_card';
  markdownContent?: string;
  templateCardPayload?: Record<string, unknown>;
  dedupeKey?: string;
  duplicateOfTaskId?: string;
  status: ProactiveNotificationTaskStatus;
  originalAudienceSummary: string;
  testModeApplied: boolean;
  realMessageEnabled: boolean;
  recipientSnapshots: ProactiveNotificationRecipientSnapshot[];
  attempts: ProactiveNotificationAttemptRecord[];
  metadata?: Record<string, unknown>;
  failureReason?: string;
  createdAt: string;
  lastAttemptAt?: string;
  sentAt?: string;
}

export interface WecomConversationTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
  messageId?: string;
  requestId?: string;
  createdAt: string;
}

export interface WecomCustomerCreateDraft {
  name?: string;
  phone?: string;
  itDecisionLocation?: string;
  unifiedSocialCreditCode?: string;
  ownerUserId?: string;
  wantDepartmentId?: string;
  category?: string;
  source?: string;
  note?: string;
  parentCustomerId?: string;
  industry?: string;
}

export interface WecomCustomerLookupCandidate {
  id: string;
  name: string;
  ownerName?: string;
  category?: string;
}

export interface WecomOpportunityCreateDraft {
  title?: string;
  customerId?: string;
  customerName?: string;
  leadCode?: string;
  expectAmount?: number;
  expectSignDate?: string;
  renewalContractCode?: string;
  agentFullName?: string;
  projectStatusSummary?: string;
  preSalesName?: string;
  ownerUserId?: string;
  wantDepartmentId?: string;
  stage?: string;
  source?: string;
  kind?: string;
  note?: string;
  customerRequirement?: string;
  getTime?: string;
  productIds?: string[];
  contactIds?: string[];
  customerCandidates?: WecomCustomerLookupCandidate[];
}

export interface WecomFollowUpTemplateDraft {
  requesterName: string;
  followUpContent?: string;
  helpNeeded?: string;
  informationShare?: string;
  visitPlan?: string;
  missingLabels?: string[];
  optionalMissingPromptShown?: boolean;
  directSubmitSource?: 'QUICK_ACTION' | 'NATURAL_LANGUAGE';
}

export interface WecomEntityLookupListItem {
  id: string;
  entityType: 'Customer' | 'Opportunity';
  displayTitle: string;
  ownerName?: string;
  summaryFields: string[];
}

export interface WecomEntityLookupMemory {
  mode: 'IDLE' | 'LIST_RETURNED' | 'DETAIL_RETURNED';
  entityType?: 'Customer' | 'Opportunity';
  queryText?: string;
  listItems: WecomEntityLookupListItem[];
  selectedItemId?: string;
  source?: 'DIRECT_QUERY' | 'AI_SELECTION_FROM_LAST_LIST';
  expiresAt?: string;
}

export interface WecomLatestResultEntity {
  type: 'QUERY_ENTITY' | 'FILTER' | 'RESULT_ROW';
  value: string;
  source?: string;
}

export interface WecomLatestResultTopRow {
  label: string;
  summaryFields: string[];
}

export interface WecomLatestResultContext {
  queryId?: string;
  questionText: string;
  title?: string;
  summary?: string;
  entities: WecomLatestResultEntity[];
  temporalScope?: Record<string, unknown>;
  appliedFilters: AppliedFilter[];
  topRows: WecomLatestResultTopRow[];
  updatedAt: string;
}

export interface WecomConversationWorkMemory {
  latestQuestion?: string;
  latestQueryId?: string;
  latestSummary?: string;
  latestResultContext?: WecomLatestResultContext;
  latestEntryInterpretationSnapshot?: AiEntryInterpretationSnapshot;
  latestWorkflowRoutingSnapshot?: AiWorkflowRoutingSnapshot;
  domain?: AnalysisDomain;
  timeRange?: string;
  metrics: string[];
  dimensions: string[];
  filters: Record<string, unknown>;
  pendingSlots: string[];
  dailyReportFlowStatus?: DailyReportFlowStatus;
  dailyReportReportId?: string;
  dailyReportBusinessDate?: string;
  dailyReportNextFragmentType?: DailyReportFragmentType;
  dailyReportCollectedFragmentTypes?: DailyReportFragmentType[];
  dailyReportSupervisorId?: string;
  dailyReportSupervisorName?: string;
  dailyReportDraftSummary?: string;
  dailyReportEntityLookupStatus?: 'IDLE' | 'AWAITING_CONFIRMATION';
  dailyReportEntityLookupStep?:
    | 'INITIAL_CONFIRM'
    | 'BATCH_WRITEBACK_CONFIRM'
    | 'SELECT_TARGET';
  dailyReportEntityLookupText?: string;
  dailyReportEntityLookupQueryText?: string;
  dailyReportEntityLookupCompanyName?: string;
  dailyReportEntityLookupProjectName?: string;
  dailyReportEntityLookupCompanyNames?: string[];
  dailyReportEntityLookupProjectNames?: string[];
  dailyReportEntityLookupMatchedCompanyNames?: string[];
  dailyReportEntityLookupSummary?: string;
  activeFollowUpWritebackId?: string;
  followUpWritebackStatus?: FollowUpWritebackStatus;
  followUpWritebackObjectType?: FollowUpLoggableType;
  followUpWritebackObjectId?: string;
  followUpWritebackObjectTitle?: string;
  followUpWritebackOpportunityId?: string;
  followUpWritebackOpportunityTitle?: string;
  followUpWritebackDraftContent?: string;
  followUpWritebackFailureReason?: string;
  followUpShareStatus?: FollowUpShareStatus;
  followUpShareTargetId?: string;
  followUpShareChatType?: WecomChatType;
  followUpShareFailureReason?: string;
  followUpTemplateDraft?: WecomFollowUpTemplateDraft;
  entityLookupMemory?: WecomEntityLookupMemory;
  crmCreateStatus?: CrmCreateFlowStatus;
  crmCreateEntityType?: CrmCreateEntityType;
  crmCreateCustomerDraft?: WecomCustomerCreateDraft;
  crmCreateOpportunityDraft?: WecomOpportunityCreateDraft;
  crmCreateFailureReason?: string;
  crmCreateResultId?: string;
  crmCreateResultSummary?: string;
}

export interface WecomConversationContextRecord {
  id: string;
  sessionId: string;
  requesterId: string;
  externalConversationId: string;
  senderId: string;
  turns: WecomConversationTurn[];
  workMemory: WecomConversationWorkMemory;
  summaryText?: string;
  createdAt: string;
  updatedAt: string;
}

export type WecomSyncResourceType =
  | 'department'
  | 'user'
  | 'user-dept-change';

export type WecomSyncRunStatus =
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'SUCCEEDED_WITHOUT_CHANGES'
  | 'BLOCKED';

export interface WecomSyncedDepartmentRecord {
  id: string;
  wxDepartmentId: string;
  departmentName: string;
  departmentAlias?: string;
  parentDepartmentId?: string;
  leaderUserids?: string[];
  organizationExternalId?: string;
  displayOrder?: number;
  isParent?: boolean;
  state?: string;
  rawPayload: Record<string, unknown>;
  syncStatus: 'ACTIVE' | 'DELETED';
  lastSyncedAt: string;
  deletedAt?: string;
}

export interface WecomSyncedUserRecord {
  id: string;
  wxUserid: string;
  originUserid?: string;
  userName: string;
  userAlias?: string;
  mobile?: string;
  email?: string;
  tel?: string;
  gender?: string;
  position?: string;
  avatar?: string;
  status?: string;
  organizationExternalId?: string;
  primaryDepartmentId?: string;
  departmentIds?: string[];
  directLeaderUserids?: string[];
  rawPayload: Record<string, unknown>;
  syncStatus: 'ACTIVE' | 'DELETED';
  lastSyncedAt: string;
  deletedAt?: string;
}

export interface DataScopeGrantRecord {
  id: string;
  subjectType: 'USER' | 'ROLE';
  subjectId: string;
  departmentIds: string[];
  includeSubDepartments: boolean;
  reason: string;
  expiresAt?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
  updatedBy: string;
  updatedAt: string;
}

export type DailyReportDepartmentPolicyStatus =
  | 'ENABLED'
  | 'DISABLED'
  | 'INHERIT';

export type DailyReportDepartmentType =
  | 'REGION'
  | 'SALES'
  | 'NON_SALES'
  | 'UNCLASSIFIED';

export type DailyReportRecipientOverrideScopeType =
  | 'REGION'
  | 'SALES_GROUP';

export interface DailyReportDepartmentPolicyRecord {
  departmentId: string;
  departmentName: string;
  status: DailyReportDepartmentPolicyStatus;
  departmentType: DailyReportDepartmentType;
  applyToChildren: boolean;
  updatedBy: string;
  updatedAt: string;
  reason: string;
}

export interface DailyReportRecipientOverrideRecord {
  departmentId: string;
  departmentName: string;
  scopeType: DailyReportRecipientOverrideScopeType;
  crmUserId: string;
  recipientName?: string;
  updatedBy: string;
  updatedAt: string;
  reason: string;
}

export interface DailyReportSalesGroupConfigRecord {
  groupId: string;
  groupName: string;
  source: 'AUTO' | 'MANUAL';
  linkedDepartmentId?: string;
  regionDepartmentId?: string;
  regionDepartmentName?: string;
  status: 'ENABLED' | 'DISABLED';
  recipientCrmUserIds?: string[];
  recipientCrmUserId?: string;
  memberCrmUserIds: string[];
  memberOverrideEnabled: boolean;
  updatedBy: string;
  updatedAt: string;
  reason: string;
}

export interface DailyReportResolvedRecipientRecord {
  crmUserId?: string;
  recipientName?: string;
  wecomUserId?: string;
  resolutionStatus: 'READY' | 'MISSING_OWNER' | 'MISSING_WECOM_MAPPING';
  resolutionReason?: string;
  source:
    | 'AUTO'
    | 'REGION_OVERRIDE'
    | 'SALES_GROUP_OVERRIDE'
    | 'MANUAL_GROUP_CONFIG';
}

export interface WecomUserDeptChangeRecord {
  id: string;
  wxUserid: string;
  changeType: string;
  entityType: string;
  departmentId?: string;
  changeTimestamp: string;
  rawPayload: Record<string, unknown>;
  syncedAt: string;
}

export interface CrmWxUserRecord {
  id: string;
  wxOrganizationId: string;
  userid: string;
  originUserid?: string;
  name?: string;
  mobile?: string;
  tel?: string;
  email?: string;
  gender?: number;
  position?: string;
  avatar?: string;
  englishName?: string;
  status?: number;
  extattr?: Record<string, unknown>;
  departmentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CrmWxUserMapRecord {
  id: string;
  wxOrganizationId: string;
  wxUserId: string;
  crmUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface WecomSyncCheckpointRecord {
  id: string;
  resourceType: WecomSyncResourceType;
  candidateCursor: string;
  committedCursor: string;
  lastSuccessAt?: string;
  lastAttemptAt?: string;
  lastFailureReason?: string;
  lastSuccessPage?: number;
  status: WecomSyncRunStatus;
  updatedAt: string;
}

export interface WecomSyncRunRecord {
  id: string;
  resourceType: WecomSyncResourceType;
  runMode: 'bootstrap' | 'incremental' | 'manual-retry';
  startedAt: string;
  finishedAt?: string;
  status: WecomSyncRunStatus;
  pageCount: number;
  itemCount: number;
  fromCursor: string;
  toCursor?: string;
  failureReason?: string;
  wxUserUpsertedCount?: number;
  wxUserMapCreatedCount?: number;
  wxUserMapUpdatedCount?: number;
  missingContactCount?: number;
  unmatchedCount?: number;
  conflictCount?: number;
}

export interface QueryTemplateRecord {
  id: string;
  name: string;
  description: string;
  tags?: string[];
  defaultQuestionText: string;
  defaultFilters: Record<string, unknown>;
  defaultViewType?: ResultViewType;
  queryMode: 'FIXED_SQL';
  sqlText: string;
  sqlVersion: string;
  sourceType?: QueryTemplateSourceType;
  sourceQueryId?: string;
  sourceTemplateId?: string;
  sourceSnapshot?: QueryTemplateSourceSnapshot;
  scopeMode?: QueryTemplateScopeMode;
  scopeGovernanceSnapshot?: TemplateScopeGovernanceSnapshot;
  parameterSchema: QueryTemplateParameterDefinition[];
  renderConfig: QueryTemplateRenderConfig;
  visibleRoleIds: string[];
  ownerUserId?: string;
  visibilityType?: QueryTemplateVisibilityType;
  displayOrder: number;
  clickCount7d: number;
  usageCountTotal?: number;
  lastUsedAt?: string;
  hitRatePercent: number;
  optimizationStatus: 'HEALTHY' | 'NEEDS_OPTIMIZATION' | 'DISABLED';
  status: 'ACTIVE' | 'INACTIVE';
  ownedBy: string;
  updatedAt: string;
  validationSnapshot?: QueryTemplateValidationSnapshot;
  lastValidatedAt?: string;
}

export type QueryTemplateSourceType =
  | 'GOVERNANCE_CREATED'
  | 'FREE_QUERY_SAVED'
  | 'COPIED_FROM_TEMPLATE'
  | 'LEGACY_MIGRATED';

export type QueryTemplateVisibilityType = 'PRIVATE' | 'SHARED';

export interface QueryTemplateSourceSnapshot {
  sourceTemplateId?: string;
  sourceTemplateName?: string;
  sourceSqlVersion?: string;
  sourceQueryId?: string;
  sourceQuestionText?: string;
  copiedAt?: string;
  savedAt?: string;
}

export interface QueryTemplateParameterDefinition {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'daterange' | 'select' | 'boolean';
  required: boolean;
  defaultValue?: string | number | boolean | string[];
  options?: Array<{ label: string; value: string }>;
}

export interface QueryTemplateRenderConfig {
  primaryViewType:
    | 'STAT_ONLY'
    | 'TABLE'
    | 'BAR_CHART'
    | 'LINE_CHART'
    | 'RANKING_TABLE';
  primaryTitle: string;
  chartDimensionKey?: string;
  chartMetricKey?: string;
  tableColumns?: Array<{ key: string; label: string; width?: number }>;
  metricFields?: Array<{ key: string; label: string }>;
  moduleHeight?: number;
}

export interface QueryTemplateValidationSnapshot {
  status: 'PASSED' | 'FAILED';
  message: string;
  scopeAnalysis?: QueryTemplateScopeValidationSnapshot;
}

export type QueryTemplateScopeMode = 'AUTO_SCOPE' | 'DECLARED_SCOPE';

export type QueryTemplateScopeGovernanceMode = 'observe' | 'enforce';

export type QueryTemplateScopeClassification =
  | 'AUTO_SCOPABLE'
  | 'DECLARED_DYNAMIC_SCOPE'
  | 'FIXED_SCOPE'
  | 'COMPLEX_REVIEW_REQUIRED'
  | 'UNSAFE_SCOPE';

export type QueryTemplateScopeReviewStatus =
  | 'PENDING_VALIDATION'
  | 'REVIEW_REQUIRED'
  | 'APPROVED'
  | 'BLOCKED';

export interface QueryTemplateDataSourceRef {
  table: string;
  alias?: string;
}

export interface QueryTemplateScopePredicateSource {
  table?: string;
  alias?: string;
  field: 'organization_id' | 'department_id' | 'user_id';
  sourceType: 'PARAMETER' | 'FIXED_VALUE' | 'MIXED' | 'UNKNOWN';
  values?: string[];
}

export interface QueryTemplateDisplayDimensionSource {
  outputName: string;
  sourceTable?: string;
  sourceAlias?: string;
  sourceColumn?: string;
  lineageTable?: string;
  lineageAlias?: string;
  lineageColumn?: string;
  expressionSummary?: string;
}

export interface QueryTemplateStaticDimensionSource {
  sourceType: 'UNION_TEAM_LIST' | 'HARDCODED_DEPARTMENT' | 'HARDCODED_OWNER';
  values: string[];
  detail: string;
}

export interface QueryTemplateScopeRiskFinding {
  code:
    | 'DISPLAY_SCOPE_MISMATCH'
    | 'STATIC_TEAM_LIST'
    | 'MULTI_PRIMARY_SOURCE'
    | 'FIXED_SCOPE'
    | 'SQL_PARSE_FAILED'
    | 'UNSCOPED_TABLE'
    | 'UNSAFE_SQL';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  suggestion: string;
}

export interface QueryTemplateScopeValidationSnapshot {
  scopeMode: QueryTemplateScopeMode;
  scopeClassification: QueryTemplateScopeClassification;
  reviewStatus: QueryTemplateScopeReviewStatus;
  detectedScopeFields: Array<'organization_id' | 'department_id' | 'user_id'>;
  primaryDataSources: QueryTemplateDataSourceRef[];
  scopePredicateSources: QueryTemplateScopePredicateSource[];
  displayDimensionSources: QueryTemplateDisplayDimensionSource[];
  staticDimensionSources: QueryTemplateStaticDimensionSource[];
  riskFindings: QueryTemplateScopeRiskFinding[];
  friendlyMessage: string;
  fixSuggestions?: string[];
  snapshotHash?: string;
  unsupportedReason?: string;
}

export interface TemplateScopeGovernanceSnapshot extends QueryTemplateScopeValidationSnapshot {
  generatedAt: string;
  governanceVersion: string;
}

export interface AccessPolicyRecord {
  id: string;
  enabledRoleIds: string[];
  exportRoleIds: string[];
  enabledChannels: ChannelType[];
  allowedDomains: AnalysisDomain[];
  allowedTables: string[];
  allowedFields: Record<string, string[]>;
  maskedFields: Record<string, string[]>;
  exportRowLimit: number;
  exportDailyLimit: number;
  maxOnlineSessions: number;
  maxConcurrentQueries: number;
  heartbeatIntervalSeconds: number;
  idleTimeoutSeconds: number;
  historyRetentionDays: number;
  status: 'ACTIVE' | 'INACTIVE' | 'SUPERSEDED';
  updatedBy: string;
  updatedAt: string;
}

export interface LianruanCrmConnectionConfigRecord {
  id: 'lianruan_crm_standard_openapi';
  useRuntimeConfig: boolean;
  enabled: boolean;
  baseUrl?: string;
  appKey?: string;
  appSecret?: string;
  timeoutMs?: number;
  tokenCacheBufferSeconds?: number;
  updatedBy?: string;
  updatedAt?: string;
}

export interface WecomBotConnectionConfigRecord {
  id: 'wecom_bot_connection';
  useRuntimeConfig: boolean;
  enabled: boolean;
  botId?: string;
  botSecret?: string;
  botSignature?: string;
  botSource?: string;
  botTransportMode?: 'mock' | 'sdk';
  botWsUrl?: string;
  botMaxReconnectAttempts?: number;
  botHeartbeatIntervalMs?: number;
  deliveryMaxRetries?: number;
  deliveryRetryDelayMs?: number;
  deliveryChunkMaxLength?: number;
  updatedBy?: string;
  updatedAt?: string;
}

export interface RolePermissionRecord {
  roleId: string;
  roleNameSnapshot: string;
  status: 'ACTIVE' | 'INACTIVE';
  visibleMenus: string[];
  actionKeys: string[];
  webConsoleEnabled: boolean;
  wecomBotEligible: boolean;
  exportAllowed: boolean;
  templateManageAllowed: boolean;
  contractReviewUploadAllowed: boolean;
  contractReviewCrossViewAllowed: boolean;
  contractReviewCrossDownloadAllowed: boolean;
  updatedBy: string;
  updatedAt: string;
  changeReason?: string;
  simplifiedPermissionProfile?: SimplifiedPermissionProfile;
}

export interface SimplifiedPermissionMenuProfile {
  analysis: boolean;
  managementReport: boolean;
  contractReview: boolean;
  wecomBot: boolean;
  permissionCenter: boolean;
  templateGovernance: boolean;
  connectionPolicy: boolean;
  aiModelGovernance: boolean;
  auditCenter: boolean;
}

export interface SimplifiedPermissionRiskProfile {
  analysisExport: boolean;
  managementReportExport: boolean;
  contractCrossView: boolean;
  contractCrossDownload: boolean;
}

export interface SimplifiedPermissionProfile {
  menus: SimplifiedPermissionMenuProfile;
  risks: SimplifiedPermissionRiskProfile;
  legacyWarnings?: Array<'WEB_CONSOLE_WITHOUT_MENU'>;
}

export interface WecomPilotPolicyRecord {
  channel: 'wecom-bot';
  mode: 'DISABLED' | 'PILOT_ONLY' | 'FULL';
  allowUserIds: string[];
  allowRoleIds: string[];
  allowDepartmentIds: string[];
  denyUserIds: string[];
  note?: string;
  updatedBy: string;
  updatedAt: string;
}

export type AccessDecisionState =
  | 'ALLOWED'
  | 'CHANNEL_DISABLED'
  | 'ROLE_NOT_ENABLED'
  | 'PILOT_REQUIRED'
  | 'EXPLICITLY_DENIED'
  | 'UNMAPPED_CRM_IDENTITY'
  | 'RESOURCE_FORBIDDEN';

export interface ContractPermissionSnapshot {
  uploadAllowed: boolean;
  crossViewAllowed: boolean;
  crossDownloadAllowed: boolean;
}

export interface AccessDecisionRecord {
  allowed: boolean;
  channel: ChannelType;
  state: AccessDecisionState;
  reason?: string;
  matchedRoleIds: string[];
  visibleMenus: string[];
  actionKeys: string[];
  scopeSnapshot: ScopeSnapshot;
  contractPermissions: ContractPermissionSnapshot;
  wecomPilotSnapshot?: {
    mode: WecomPilotPolicyRecord['mode'];
    matchedBy?: 'user' | 'role' | 'department';
    deniedByUserId?: string;
  };
}

export interface AccessPreviewRecord {
  crmUserId?: string;
  crmUserName?: string;
  wecomUserId?: string;
  mappingStatus: 'MAPPED' | 'UNMAPPED' | 'CONFLICTED';
  analysisScopeMode?: AnalysisScopeMode;
  analysisScopeSummary?: string;
  roleNames: string[];
  visibleMenus: string[];
  actionKeys: string[];
  scopeSummary: string;
  wecomBotAccessState: AccessDecisionState;
  wecomBotAccessReason?: string;
  contractPermissions: ContractPermissionSnapshot;
  simplifiedPermissionProfile?: SimplifiedPermissionProfile;
  isApplicationSuperAdmin?: boolean;
  applicationSuperAdminSubjects?: ApplicationSuperAdminSubjectRecord[];
}

export interface IdentityMappingDiagnosticRecord {
  wecomUserId: string;
  wecomName?: string;
  mappingStatus: 'MAPPED' | 'UNMAPPED' | 'CONFLICTED';
  crmUserId?: string;
  crmUserName?: string;
  crmRoleNames: string[];
  crmDepartmentIds: string[];
  wecomDepartmentIds?: string[];
  directLeaderUserids?: string[];
  organizationScopeSummary?: string;
  dataScopeGrantSummaries?: string[];
  analysisEnabled: boolean;
  wecomBotAccessState: AccessDecisionState;
  failedReason?: string;
  lastDirectorySyncAt?: string;
}

export interface AccessOptionRecord {
  value: string;
  label: string;
  parentDepartmentId?: string;
}

export interface AccessOptionsRecord {
  users: AccessOptionRecord[];
  roles: AccessOptionRecord[];
  departments: AccessOptionRecord[];
  wecomUsers: AccessOptionRecord[];
}

export type WecomOrgSubjectMappingStatus =
  | 'MAPPED'
  | 'UNMAPPED'
  | 'CONFLICTED'
  | 'DELETED';

export interface WecomOrgDepartmentSubjectRecord {
  departmentId: string;
  name: string;
  parentDepartmentId?: string;
  displayOrder?: number;
  syncStatus: 'ACTIVE' | 'DELETED';
  crmDepartmentId?: string;
  crmDepartmentName?: string;
  mappingStatus: WecomOrgSubjectMappingStatus;
  disabledReason?: string;
  lastSyncedAt?: string;
}

export interface WecomOrgUserSubjectRecord {
  wecomUserId: string;
  name: string;
  departmentIds: string[];
  primaryDepartmentId?: string;
  crmUserId?: string;
  crmUserName?: string;
  position?: string;
  avatar?: string;
  syncStatus: 'ACTIVE' | 'DELETED';
  mappingStatus: WecomOrgSubjectMappingStatus;
  disabledReason?: string;
  lastSyncedAt?: string;
}

export interface WecomOrgSubjectOptionsRecord {
  departments: WecomOrgDepartmentSubjectRecord[];
  users: WecomOrgUserSubjectRecord[];
  lastSyncedAt?: string;
}

export type AnalysisScopeMode =
  | 'FULL_ANALYSIS_SCOPE'
  | 'DEPARTMENT_ANALYSIS_SCOPE';

export interface AnalysisScopePolicyRecord {
  policyId: string;
  fullAccessUserIds: string[];
  updatedBy: string;
  updatedAt: string;
  changeReason?: string;
}

export interface ApplicationSuperAdminSubjectRecord {
  subjectType: 'USER' | 'ROLE';
  subjectId: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface ApplicationSuperAdminPolicyRecord {
  policyId: string;
  subjects: ApplicationSuperAdminSubjectRecord[];
  updatedBy: string;
  updatedAt: string;
  changeReason?: string;
}

export interface AnalysisCapabilitySnapshotRecord {
  serviceStatus: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  scopeSummary: string;
  defaultAnalysisRoute: AnalysisRoute;
  analysisRoutes: Array<{
    route: AnalysisRoute;
    label: string;
    enabled: boolean;
    description: string;
  }>;
  analysisScopeMode?: AnalysisScopeMode;
  analysisScopeSummary?: string;
  roleNames: string[];
  channels: string[];
  domains: string[];
  metrics: string[];
  dimensions: string[];
  exportAllowed: boolean;
  exportRowLimit: number;
  exportDailyLimit: number;
  remainingDailyExports: number;
  historyEnabled: boolean;
  templateCount: number;
  dataFreshnessAt: string;
  visibleMenus: string[];
  actionKeys: string[];
  followUpAllowed: boolean;
  templateViewAllowed: boolean;
  contractWorkspaceAllowed: boolean;
  wecomBotAccessState: AccessDecisionState;
  wecomBotAccessReason?: string;
  queryAssetSummary?: QueryAssetSummaryRecord;
  contractPermissions: ContractPermissionSnapshot;
  isApplicationSuperAdmin?: boolean;
  applicationSuperAdminSubjects?: ApplicationSuperAdminSubjectRecord[];
}

export interface QueryAssetSummaryRecord {
  timeSlot: string;
  recommendedTemplates: QueryAssetRecommendedItem[];
}

export interface QueryAssetRecommendedItem {
  templateId: string;
  name: string;
  description: string;
  recommendationReason: string;
}

export interface QuerySessionRecord {
  id: string;
  channel: ChannelType;
  externalConversationId?: string;
  senderId?: string;
  webSessionKey?: string;
  requesterId: string;
  requesterRoleIds: string[];
  contextStatus: QuerySessionStatus;
  lastMessageAt: string;
  lastHeartbeatAt?: string;
  activeRequestId?: string;
  lastReceiptId?: string;
  pendingSequence: number;
  disconnectReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisIntent {
  domain: AnalysisDomain;
  metrics: string[];
  dimensions: string[];
  filters: Record<string, unknown>;
  temporalSlot?: TemporalSlot;
  missingConditions: string[];
  normalizedQuestion: string;
  requestedAction: 'READONLY_ANALYSIS' | 'BLOCK';
  confidence: QueryConfidence;
  blockReason?: string;
  orderBy?: QueryOrderBy[];
  resultKindHint?: QueryPlanResultKind;
  queryEntities?: string[];
  resultIntent?: AnalysisResultIntent;
  timeRangeText?: string;
  analysisFacetProfile?: AnalysisFacetProfile;
  analysisDepth?: AnalysisDepth;
  analysisFocus?: AnalysisFocus[];
  outputPreference?: AnalysisOutputPreference[];
  businessIntentHint?: {
    objectTypes: string[];
    metrics: string[];
    dimensions: string[];
    analysisMode?: string;
    outputPreference?: AnalysisOutputPreference[];
    comparison?: string[];
    sourceResource?: string;
  };
}

export interface AnalysisQueryTask {
  id: string;
  title: string;
  description: string;
  purpose: AnalysisTaskPurpose;
  required?: boolean;
  reportSection?: AnalysisReportSectionType;
  plan: QueryPlanAst;
}

export interface AnalysisWorkflowPlan {
  workflowId: string;
  channel: ChannelType;
  questionText: string;
  normalizedQuestion: string;
  domain: AnalysisDomain;
  temporalSlot?: TemporalSlot;
  confidence: QueryConfidence;
  requestedAction: AnalysisIntent['requestedAction'];
  missingConditions: string[];
  analysisFacetProfile?: AnalysisFacetProfile;
  analysisDepth?: AnalysisDepth;
  analysisFocus?: AnalysisFocus[];
  outputPreference?: AnalysisOutputPreference[];
  tasks: AnalysisQueryTask[];
}

export interface AnalysisRequestRecord {
  id: string;
  questionText?: string;
  requesterId: string;
  requesterRoleIds: string[];
  sessionId: string;
  entryChannel: ChannelType;
  querySource: QuerySourceType;
  templateId?: string;
  rerunFromHistoryId?: string;
  organizationScope: string[];
  departmentScope: string[];
  ownerScope: string[];
  intentDomain: AnalysisDomain;
  metrics: string[];
  dimensions: string[];
  filters: Record<string, unknown>;
  temporalSlot?: TemporalSlot;
  followUpToRequestId?: string;
  missingConditions: string[];
  clarificationPrompt?: string;
  generatedQuery?: string;
  resultConsistencyToken?: string;
  entryInterpretationSnapshot?: AiEntryInterpretationSnapshot;
  workflowRoutingSnapshot?: AiWorkflowRoutingSnapshot;
  analysisRoute?: AnalysisRoute;
  executionMode?: AnalysisExecutionMode;
  executionSource?: AnalysisExecutionSource;
  preferredSource?: AnalysisExecutionSource;
  matchedAdapter?: string;
  gapReason?: string;
  executionSnapshot?: AnalysisExecutionSnapshot;
  executionTraceSummary?: AnalysisExecutionTraceSummary;
  resultBundleSnapshot?: AnalysisResultBundleSnapshot;
  insightSnapshot?: AnalysisInsightSnapshot;
  deliverySnapshot?: AnalysisDeliverySnapshot;
  status: AnalysisRequestStatus;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export interface AppliedFilter {
  label: string;
  value: string;
}

export interface MetricCard {
  name: string;
  value: string | number;
}

export interface ResultView {
  viewType: ResultViewType;
  title: string;
  description?: string;
  series?: Array<Record<string, unknown>>;
  rows?: Array<Record<string, unknown>>;
  columns?: Array<{ key: string; label: string; width?: number }>;
}

export interface StreamBlock {
  sequence: number;
  blockType:
    | 'PROCESSING_NOTICE'
    | 'PLANNING'
    | 'EXECUTION'
    | 'VALIDATION'
    | 'REPORT'
    | 'CLARIFICATION'
    | 'SUMMARY'
    | 'TABLE_SEGMENT'
    | 'EXPLANATION'
    | 'ERROR'
    | 'COMPLETE';
  content: string;
}

export interface AnalysisDatasetSlice {
  datasetId: string;
  taskId: string;
  taskTitle: string;
  resultKind: QueryPlanResultKind;
  purpose: AnalysisTaskPurpose;
  sql: string;
  executionMode?: AnalysisExecutionMode;
  executionSource?: AnalysisExecutionSource;
  matchedAdapter?: string;
  gapReason?: string;
  summary: string;
  temporalScope?: ResultTemporalScope;
  appliedFilters: AppliedFilter[];
  metricCards: MetricCard[];
  primaryView?: ResultView;
  secondaryViews: ResultView[];
  tableRows: Array<Record<string, unknown>>;
  rowCount: number;
}

export interface AnalysisDatasetBundle {
  workflowId: string;
  scopeSummary: string;
  slices: AnalysisDatasetSlice[];
  mergedRows: Array<Record<string, unknown>>;
  temporalScope?: ResultTemporalScope;
  totalRowCount: number;
  appliedFilters: AppliedFilter[];
  missingSections?: AnalysisMissingSection[];
}

export interface AvailableAction {
  actionType: 'FOLLOW_UP' | 'EXPORT' | 'SAVE_TO_RECENT' | 'RERUN';
  enabled: boolean;
  reason?: string;
}

export interface AnalysisKeyFinding {
  title: string;
  detail: string;
  tone: 'positive' | 'neutral' | 'risk';
  datasetId: string;
}

export interface AnalysisChartBlock {
  blockId: string;
  title: string;
  viewType: ResultViewType;
  series: Array<Record<string, unknown>>;
  datasetId: string;
  temporalScope?: ResultTemporalScope;
}

export interface AnalysisTableBlock {
  blockId: string;
  title: string;
  rows: Array<Record<string, unknown>>;
  columns?: Array<{ key: string; label: string; width?: number }>;
  datasetId: string;
  temporalScope?: ResultTemporalScope;
}

export interface AnalysisDatasetReference {
  datasetId: string;
  taskId: string;
  taskTitle: string;
  purpose: AnalysisTaskPurpose;
  rowCount: number;
}

export interface AnalysisSourceNote {
  key: string;
  label: string;
  description: string;
}

export interface AnalysisExecutionTraceSummary {
  normalizedQuestion: string;
  consistencyToken?: string;
  fallbackReason?: string;
  blockedReason?: string;
  knowledgeHits: Array<{
    assetId: string;
    assetType: AnalysisSemanticKnowledgeAssetType | 'STATIC_FALLBACK' | 'GOVERNED_TEMPLATE';
    source: 'PUBLISHED_ASSET' | 'STATIC_FALLBACK' | 'GOVERNED_TEMPLATE';
    name: string;
    detail?: string;
    version?: string;
  }>;
  taskSummaries: Array<{
    taskId: string;
    taskTitle: string;
    resultKind: QueryPlanResultKind;
    executionSource: AnalysisExecutionSource;
    preferredSource?: AnalysisExecutionSource;
    matchedAdapter?: string;
    gapReason?: string;
  }>;
  datasetReferences: AnalysisDatasetReference[];
  createdAt: string;
}

export type AnalysisConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface AnalysisTrendInsight {
  status: 'READY' | 'UNAVAILABLE';
  direction?: 'UP' | 'DOWN' | 'FLAT' | 'VOLATILE';
  changeValue?: number;
  changeRate?: number;
  peakLabel?: string;
  troughLabel?: string;
  volatilityLevel?: 'HIGH' | 'MEDIUM' | 'LOW';
  drivers: string[];
  summary: string;
}

export interface AnalysisForecastInsight {
  status: 'READY' | 'UNAVAILABLE' | 'LOW_CONFIDENCE';
  horizonLabel: string;
  metricLabel?: string;
  predictedValue?: number;
  predictedRangeLow?: number;
  predictedRangeHigh?: number;
  confidenceLevel: AnalysisConfidenceLevel;
  drivers: string[];
  caveats: string[];
  summary: string;
}

export interface AnalysisInsightItem {
  type?: string;
  riskType?: 'BUSINESS_RISK' | 'RESULT_RISK';
  title: string;
  detail: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  datasetId?: string;
}

export interface AnalysisRecommendationItem {
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  action: string;
  reason: string;
  evidenceKeys: string[];
}

export type AnalysisReportSectionType =
  | 'summary'
  | 'metric-strip'
  | 'distribution'
  | 'trend'
  | 'forecast'
  | 'anomaly'
  | 'risk'
  | 'recommendation'
  | 'evidence'
  | 'focus-list'
  | 'detail-table'
  | 'actions';

export interface AnalysisReportSection {
  sectionType: AnalysisReportSectionType;
  title: string;
  datasetId?: string;
  description?: string;
  summary?: string;
  metricCards?: MetricCard[];
  series?: Array<Record<string, unknown>>;
  rows?: Array<Record<string, unknown>>;
  items?: string[];
  temporalScope?: ResultTemporalScope;
  sourceNotes?: AnalysisSourceNote[];
  footnotes?: string[];
}

export interface AnalysisMissingSection {
  sectionType: AnalysisReportSectionType;
  title: string;
  reason: string;
  taskId?: string;
}

export type AnalysisReportVariant =
  | 'ranking'
  | 'trend'
  | 'distribution'
  | 'summary';

export interface AnalysisReportPayload {
  variant: AnalysisReportVariant;
  reportTitle: string;
  executiveSummary: string;
  analysisConfidence?: AnalysisConfidenceLevel;
  predictionMode?: 'BALANCED_RANGE_FORECAST';
  predictionHorizon?: string;
  temporalScope?: ResultTemporalScope;
  trendInsight?: AnalysisTrendInsight;
  forecastInsight?: AnalysisForecastInsight;
  anomalyInsights?: AnalysisInsightItem[];
  riskInsights?: AnalysisInsightItem[];
  recommendations?: AnalysisRecommendationItem[];
  confidenceSummary?: string;
  keyFindings: AnalysisKeyFinding[];
  metricCards: MetricCard[];
  chartBlocks: AnalysisChartBlock[];
  tableBlocks: AnalysisTableBlock[];
  sections: AnalysisReportSection[];
  missingSections?: AnalysisMissingSection[];
  datasetReferences: AnalysisDatasetReference[];
  scopeSummary: string;
  appliedFilters: AppliedFilter[];
  sourceNotes?: AnalysisSourceNote[];
  footnotes?: string[];
  executionTraceSummary?: AnalysisExecutionTraceSummary;
  explanation?: string;
  evidenceSummary?: string;
  groundedExplanation?: string;
  nextBestQuestions?: string[];
  presentationTemplate?: CrmAnalysisPresentationTemplate;
  groundedMarkdown?: string;
  workbenchMarkdown?: string;
  detailMarkdown?: string;
  wecomMarkdown?: string;
  markdownOutline?: string[];
  emptyState?: string;
  errorState?: string;
  availableActions: AvailableAction[];
}

export type CrmAnalysisPresentationTemplateType =
  | 'BUSINESS_OVERVIEW'
  | 'FUNNEL_DIAGNOSIS'
  | 'REGION_COMPARISON'
  | 'CHANNEL_RANKING'
  | 'CHANNEL_PROFILE'
  | 'DISTRIBUTION_HIERARCHY'
  | 'TECH_SERVICE_ECOSYSTEM'
  | 'REGISTRATION_PROTECTION'
  | 'OPPORTUNITY_RISK'
  | 'QUOTE_ORDER_CONVERSION'
  | 'DATA_SCOPE_QUALITY'
  | 'OPERATING_CADENCE'
  | 'PRODUCT_SOLUTION_STRUCTURE'
  | 'CUSTOMER_SUCCESS_RENEWAL'
  | 'OWNER_ORG_COLLABORATION'
  | 'ALERT_AUDIT_GOVERNANCE';

export interface CrmAnalysisPresentationTemplate {
  templateType: CrmAnalysisPresentationTemplateType;
  templateName: string;
  priority: 'P0' | 'P1' | 'P2';
  matchedQuestionGroups: string[];
  displayMode: Array<'TEXT_SUMMARY' | 'IMAGE_CARD' | 'MARKDOWN_TABLE' | 'TEMPLATE_CARD' | 'REPORT_LINK'>;
  replySections: string[];
  recommendedActions: string[];
  imageCardRequired: boolean;
  renderHints: {
    layout: 'METRIC_CARD' | 'FUNNEL' | 'RANKING' | 'RISK_LIST' | 'SCOPE_NOTICE' | 'MEETING_BRIEF';
    maxMetricCount: number;
    maxRowCount: number;
    tone: 'SUMMARY' | 'GROWTH' | 'RISK' | 'GOVERNANCE';
  };
}

export interface AnalysisExecutionSnapshot {
  analysisRoute?: AnalysisRoute;
  executionMode: AnalysisExecutionMode;
  executionSource: AnalysisExecutionSource;
  preferredSource: AnalysisExecutionSource;
  matchedAdapter?: string;
  gapReason?: string;
  fallbackReason?: string;
  scopeSnapshot: ScopeSnapshot;
  taskSnapshots: Array<{
    taskId: string;
    taskTitle: string;
    temporalSlot?: TemporalSlot;
    executionSource: AnalysisExecutionSource;
    matchedAdapter?: string;
    gapReason?: string;
    rowLimit: number;
    timeoutMs: number;
    tables: string[];
    toolId?: string;
    allowedStatements?: string[];
    outputShape?: string;
  }>;
  blockedReason?: string;
  createdAt: string;
}

export interface AnalysisResultBundleSnapshot {
  requestId: string;
  consistencyToken: string;
  rowCount: number;
  metricCount: number;
  tableBlockCount: number;
  chartBlockCount: number;
}

export interface AnalysisInsightSnapshot {
  grounded: boolean;
  reusedResultBundle: boolean;
  generatedAt: string;
  explanationLength: number;
  nextQuestionCount: number;
  failureReason?: string;
  packCode?: string;
  packVersion?: string;
  providerCode?: string;
  model?: string;
}

export interface AnalysisDeliverySnapshot {
  channel: ChannelType;
  deliveredFromSingleBundle: boolean;
  streamBlockCount: number;
  generatedAt: string;
}

export interface AnalysisResultRecord {
  requestId: string;
  questionText?: string;
  title: string;
  summary?: string;
  report: AnalysisReportPayload;
  temporalScope?: ResultTemporalScope;
  scopeSummary: string;
  appliedFilters: AppliedFilter[];
  metricCards: MetricCard[];
  primaryView?: ResultView;
  secondaryViews: ResultView[];
  tableRows: Array<Record<string, unknown>>;
  keyFindings: AnalysisKeyFinding[];
  rowCount: number;
  dataFreshnessAt: string;
  consistencyToken: string;
  analysisRoute?: AnalysisRoute;
  executionMode?: AnalysisExecutionMode;
  executionSource?: AnalysisExecutionSource;
  preferredSource?: AnalysisExecutionSource;
  matchedAdapter?: string;
  gapReason?: string;
  entryInterpretationSnapshot?: AiEntryInterpretationSnapshot;
  workflowRoutingSnapshot?: AiWorkflowRoutingSnapshot;
  executionSnapshot?: AnalysisExecutionSnapshot;
  executionTraceSummary?: AnalysisExecutionTraceSummary;
  resultBundleSnapshot?: AnalysisResultBundleSnapshot;
  insightSnapshot?: AnalysisInsightSnapshot;
  deliverySnapshot?: AnalysisDeliverySnapshot;
  explanation?: string;
  groundedExplanation?: string;
  nextBestQuestions?: string[];
  groundedMarkdown?: string;
  wecomMarkdown?: string;
  markdownOutline?: string[];
  emptyReason?: string;
  streamBlocks: StreamBlock[];
  availableActions: AvailableAction[];
  returnedAt: string;
}

export interface RecentQueryRecord {
  id: string;
  requesterId: string;
  sourceRequestId: string;
  sourceType: 'AI_QUERY' | 'TEMPLATE_QUERY' | 'RERUN_HISTORY';
  templateId?: string;
  templateVersion?: string;
  questionText: string;
  lastUsedChannel: ChannelType;
  lastUsedConditions: Record<string, unknown>;
  parameterSnapshot?: Record<string, unknown>;
  renderSnapshot?: QueryTemplateRenderConfig;
  templateScopeGovernanceSummary?: {
    scopeClassification: QueryTemplateScopeClassification;
    reviewStatus: QueryTemplateScopeReviewStatus;
    riskCodes: string[];
    snapshotHash?: string;
  };
  lastTemporalScope?: ResultTemporalScope;
  resultSummary?: string;
  analysisRoute?: AnalysisRoute;
  executionMode?: AnalysisExecutionMode;
  executionSource?: AnalysisExecutionSource;
  matchedAdapter?: string;
  gapReason?: string;
  status: 'SUCCEEDED' | 'BLOCKED' | 'FAILED';
  lastUsedAt: string;
}

export interface QueryUsageProfileRecord {
  id: string;
  userId: string;
  templateId: string;
  lastClickedAt: string;
  clickCount7d: number;
  clickCount30d: number;
  rerunCount30d: number;
  successCount30d: number;
  lastTimeSlot?: string;
  favoriteScore: number;
  // ===== 学习闭环新增字段（全部可选，向后兼容）=====
  /** 30 天正面反馈数。 */
  positiveFeedbackCount30d?: number;
  /** 30 天负面反馈数。 */
  negativeFeedbackCount30d?: number;
  /** 30 天补问率（补问次数 / 总查询次数）。 */
  clarificationRate30d?: number;
  /** 最近反馈时间。 */
  lastFeedbackAt?: string;
}

export interface QueryTimeSlotStatRecord {
  id: string;
  templateId: string;
  timeSlot: string;
  globalClickCount: number;
  globalUserCount: number;
  successRate: number;
  updatedAt: string;
}

export interface ExportRequestRecord {
  id: string;
  analysisRequestId: string;
  requesterId: string;
  rowCount: number;
  consistencyToken: string;
  status: ExportStatus;
  blockedReason?: string;
  downloadUrl?: string;
  createdAt: string;
  exportedAt?: string;
}

export interface ContractReviewRuleItem {
  code: string;
  category: string;
  title: string;
  description: string;
  riskLevel: RiskLevel;
  isVeto: boolean;
  sourceClause: string;
  keywords: string[];
  suggestion: string;
}

export interface ContractReviewRuleSetRecord {
  id: string;
  code: string;
  version: string;
  title: string;
  summary: string;
  issuedAt: string;
  itemCount: number;
  items: ContractReviewRuleItem[];
}

export interface ContractReviewTaskRecord {
  id: string;
  requesterId: string;
  requesterName: string;
  originalFileName: string;
  sourceType?: ContractReviewTaskSourceType;
  sourceContractId?: string;
  sourceContractSnapshot?: ContractReviewSourceContractSnapshotRecord;
  storedFilePath: string;
  mimeType: string;
  fileSize: number;
  status: ContractReviewTaskStatus;
  latestStageMessage: string;
  ruleSetCode: string;
  ruleSetVersion: string;
  overallDecision: ContractReviewDecision;
  summary: string;
  latestResultSummary: string;
  vetoCount: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  totalIssueCount: number;
  reviewBasis?: ContractReviewReviewBasisRecord;
  supplementalReviewStatus?: ContractReviewSupplementalReviewStatus;
  supplementalReviewMessage?: string;
  supplementalCompletedAt?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface ContractReviewIssueRecord {
  id: string;
  taskId: string;
  title: string;
  riskLevel: RiskLevel;
  isVeto: boolean;
  description: string;
  suggestion: string;
  quote: string;
  ruleCode: string;
  ruleTitle: string;
  sourceClause: string;
  reviewBasis?: ContractReviewReviewBasisRecord;
  createdAt: string;
}

export interface ContractReviewArtifactRecord {
  id: string;
  taskId: string;
  artifactType: ContractReviewArtifactType;
  fileName: string;
  filePath?: string;
  mimeType: string;
  status: ContractReviewArtifactStatus;
  createdAt: string;
  updatedAt: string;
  failureReason?: string;
  reviewBasis?: ContractReviewReviewBasisRecord;
}

export type DailyReportFragmentType =
  | 'TODAY_FOLLOW_UP'
  | 'CUSTOMER_OR_OPPORTUNITY_CHANGE'
  | 'HELP_REQUIRED'
  | 'INFORMATION_SHARE'
  | 'TOMORROW_PLAN';

export type DailyReportStatus =
  | 'DRAFT'
  | 'PENDING_CONFIRMATION'
  | 'CONFIRMED'
  | 'LATE_CONFIRMED'
  | 'CLOSED'
  | 'SUMMARIZED';

export type DailyReportSourceInterface =
  | '/api/v2/opportunities'
  | '/api/v2/revisit_logs'
  | 'manual';

export interface DailyReportFragmentRecord {
  id: string;
  fragmentType: DailyReportFragmentType;
  content: string;
  sourceLabel?: string;
  sourceInterface?: DailyReportSourceInterface;
  sourceObjectId?: string;
  sourceOperatorId?: string;
  sourceOperatorName?: string;
  sourceCode?: number;
  capturedAt: string;
}

export interface DailyReportConfirmationRecord {
  confirmedAt: string;
  confirmedBy: string;
}

export interface DailyReportReminderRecord {
  id: string;
  reminderType: 'REMINDER_22_00';
  recipientId: string;
  sentAt: string;
  dedupeKey: string;
  messageText: string;
}

export interface DailyReportClosureRecord {
  id: string;
  closedAt: string;
  closedBy: string;
  closureReason: string;
}

export interface DailyReportDeliveryRecord {
  id: string;
  deliveryType?:
    | 'PERSONAL_CONFIRMATION'
    | 'SUPERVISOR_DELIVERY'
    | 'SUMMARY_BATCH'
    | 'REMINDER';
  targetUserId: string;
  targetUserName?: string;
  status: 'SENT' | 'FAILED' | 'SKIPPED';
  contentPreview: string;
  deliveredAt?: string;
  failureReason?: string;
}

export interface DailyReportSummaryGroupRecord {
  groupDepartmentId: string;
  groupDepartmentName: string;
  regionDepartmentId?: string;
  regionDepartmentName?: string;
  recipientCrmUserIds?: string[];
  recipientNames?: string[];
  recipientWecomUserIds?: string[];
  recipientCrmUserId?: string;
  recipientName?: string;
  recipientWecomUserId?: string;
  ruleSource:
    | 'AUTO'
    | 'REGION_OVERRIDE'
    | 'SALES_GROUP_OVERRIDE'
    | 'MANUAL_GROUP_CONFIG';
  deliveryStatus: 'READY' | 'BLOCKED' | 'SENT' | 'FAILED';
  deliveryReason?: string;
  memberRequesterIds: string[];
  memberCount: number;
  summaryText: string;
}

export interface DailyReportSummaryBatchRecord {
  id: string;
  businessDate: string;
  generatedAt: string;
  confirmedCount: number;
  lateCount: number;
  missingCount: number;
  recipientIds: string[];
  deliveryStatus: 'SENT' | 'FAILED';
  summaryText: string;
  groupSummaries: DailyReportSummaryGroupRecord[];
  aiInsightSnapshot?: DailyReportAiInsightSnapshot;
  deliveredAt?: string;
  failureReason?: string;
}

export interface DailyReportAiInsightSnapshot {
  scene:
    | 'PERSONAL_CONFIRMATION'
    | 'TEAM_PREVIEW'
    | 'SUMMARY_BATCH';
  grounded: boolean;
  degraded: boolean;
  factCount: number;
  generatedAt: string;
  failureReason?: string;
}

export type DailyReportAssistanceEscalationStatus =
  | 'PENDING'
  | 'SENT'
  | 'PARTIAL_FAILED'
  | 'FAILED'
  | 'BLOCKED';

export interface DailyReportAssistanceEscalationRecord {
  id: string;
  reportId: string;
  businessDate: string;
  requesterId: string;
  requesterName: string;
  sourceFragmentId?: string;
  helperQueryText: string;
  helperUserId?: string;
  helperUserName?: string;
  helperSupervisorUserId?: string;
  helperSupervisorUserName?: string;
  issueSummary: string;
  relatedContexts: string[];
  fingerprint: string;
  status: DailyReportAssistanceEscalationStatus;
  helperNotificationTaskId?: string;
  helperSupervisorNotificationTaskId?: string;
  auditEventIds: string[];
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyReportRecord {
  id: string;
  requesterId: string;
  requesterName: string;
  supervisorId: string;
  supervisorName?: string;
  businessDate: string;
  status: DailyReportStatus;
  draftTitle: string;
  draftSummary: string;
  sectionTypes: DailyReportFragmentType[];
  fragments: DailyReportFragmentRecord[];
  confirmation?: DailyReportConfirmationRecord;
  reminders: DailyReportReminderRecord[];
  closure?: DailyReportClosureRecord;
  deliveries: DailyReportDeliveryRecord[];
  aiInsightSnapshot?: DailyReportAiInsightSnapshot;
  summaryBatchId?: string;
  lateConfirmed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEventRecord {
  id: string;
  eventType: AuditEventType;
  actorId: string;
  actorRoleIds: string[];
  actorType?: 'crm-user' | 'wecom-user' | 'system' | 'bot';
  actorDisplayName?: string;
  actorExternalId?: string;
  actorBindingStatus?: 'BOUND_CRM' | 'UNBOUND_WECOM' | 'SYSTEM' | 'UNKNOWN';
  permissionKey?: string;
  resourceType?: string;
  resourceId?: string;
  channel?: ChannelType;
  channelAgentId?: string;
  channelAgentType?: 'wecom-bot' | 'web-console' | 'scheduler' | 'system';
  relatedRequestId?: string;
  relatedTemplateId?: string;
  relatedHistoryId?: string;
  originalQuestion?: string;
  querySnapshot?: string;
  scopeSnapshot: ScopeSnapshot;
  sessionSnapshot?: Record<string, unknown>;
  resultCount?: number;
  riskLevel: RiskLevel;
  reviewStatus: AuditReviewStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  outcome: string;
  failureReason?: string;
  actionSummary?: string;
  targetType?: string;
  targetId?: string;
  targetSummary?: string;
  contractReviewReviewBasis?: ContractReviewReviewBasisRecord;
  createdAt: string;
}

export interface SqlAuditRecord {
  id: string;
  createdAt: string;
  stage: SqlAuditStage;
  status: SqlAuditStatus;
  riskLevel: RiskLevel;
  actorId: string;
  actorRoleIds: string[];
  channel?: ChannelType;
  sessionId?: string;
  requestId?: string;
  moduleKey: SqlAuditModuleKey;
  programName: string;
  databaseRole: SqlAuditDatabaseRole;
  operationType: SqlAuditOperationType;
  tables: string[];
  sqlText: string;
  sqlSummary: string;
  paramsJson: string;
  paramSummary: string;
  normalizedSql: string;
  sqlFingerprint: string;
  rowCount?: number;
  affectedRows?: number;
  durationMs?: number;
  timeoutMs?: number;
  executionMode?: AnalysisExecutionMode;
  executionSource?: AnalysisExecutionSource;
  matchedAdapter?: string;
  fallbackReason?: string;
  blockedReason?: string;
  errorMessage?: string;
}

export interface CrmOpportunity {
  id: string;
  title: string;
  ownerId: string;
  ownerName: string;
  organizationId: string;
  departmentId: string;
  expectAmount: number;
  stage: string;
  createdAt: string;
}

export interface CrmEntityAssistUser {
  id: string;
  name: string;
}

export interface PendingFollowUpWritebackRecord {
  id: string;
  sessionId: string;
  requesterId: string;
  requesterName: string;
  sourceReceiptId: string;
  sourceMessageId: string;
  sourceQueryText: string;
  objectType: FollowUpLoggableType;
  objectId: string;
  objectTitle: string;
  opportunityId: string;
  opportunityTitle: string;
  customerName?: string;
  structuredFollowUpContent?: string;
  structuredHelpNeeded?: string;
  structuredInformationShare?: string;
  structuredVisitPlan?: string;
  ownerId: string;
  ownerName: string;
  assistUserIds?: string[];
  assistUserNames?: string[];
  assistUsersResolved?: boolean;
  draftContent: string;
  status: FollowUpWritebackStatus;
  idempotencyKey: string;
  confirmedWriteIntentAt?: string;
  confirmedContentAt?: string;
  writtenAt?: string;
  externalRevisitLogId?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrmContract {
  id: string;
  title: string;
  ownerId: string;
  ownerName: string;
  organizationId: string;
  departmentId: string;
  totalAmount: number;
  status: string;
  signDate: string;
}

export interface CrmCustomer {
  id: string;
  name: string;
  ownerId: string;
  organizationId: string;
  departmentId: string;
  category: string;
  createdAt?: string;
}

export interface AnalysisSemanticKnowledgeAssetRecord {
  id: string;
  type: AnalysisSemanticKnowledgeAssetType;
  name: string;
  status: AnalysisSemanticKnowledgeAssetStatus;
  matchKeywords: string[];
  canonicalLabel?: string;
  synonyms?: string[];
  questionText?: string;
  sqlHint?: string;
  hint?: string;
  blockReason?: string;
  updatedBy: string;
  updatedAt: string;
  // ===== 学习闭环新增字段（全部可选，向后兼容）=====
  /** 来源：手工维护 or 自动沉淀。默认 MANUAL。 */
  source?: AnalysisSemanticKnowledgeAssetSource;
  /** 审核状态。现有资产默认 ACTIVE。 */
  reviewStatus?: AnalysisSemanticKnowledgeAssetReviewStatus;
  /** 候选来源的查询 ID 列表（仅 AUTO_DERIVED）。 */
  derivedFromQueryIds?: string[];
  /** 证据次数（仅 AUTO_DERIVED）。 */
  evidenceCount?: number;
  /** 置信度 0-1（仅 AUTO_DERIVED）。 */
  confidence?: number;
  /** 候选生成时间（仅 AUTO_DERIVED）。 */
  proposedAt?: string;
  /** 审核人（仅 AUTO_DERIVED）。 */
  reviewedBy?: string;
  /** 审核时间（仅 AUTO_DERIVED）。 */
  reviewedAt?: string;
  /** 候选过期时间（仅 PROPOSED）。 */
  expiresAt?: string;
}

export interface AnalysisSemanticKnowledgePublicationRecord {
  version: string;
  changeSummary?: string;
  assetCount: number;
  publishedBy: string;
  publishedAt: string;
  snapshot: AnalysisSemanticKnowledgeAssetRecord[];
}

export type AnalysisWarehouseSyncSourceType =
  | 'OPENAPI'
  | 'SQLITE_SNAPSHOT'
  | 'FILE_EXPORT';

export type AnalysisWarehouseSyncMode = 'FULL' | 'INCREMENTAL';

export type AnalysisWarehouseResource =
  | 'users'
  | 'customers'
  | 'partners'
  | 'registrations'
  | 'opportunities'
  | 'quotes'
  | 'orders'
  | 'dictionaries'
  | 'rolePermissions'
  | 'permissions';

export type AnalysisWarehouseSyncRunStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'PARTIAL_FAILED'
  | 'FAILED'
  | 'SKIPPED';

export type AnalysisWarehouseResourceSyncStatus =
  | 'SUCCEEDED'
  | 'EMPTY'
  | 'FAILED'
  | 'SKIPPED';

export interface AnalysisWarehouseResourceSyncSnapshot {
  resource: AnalysisWarehouseResource;
  status: AnalysisWarehouseResourceSyncStatus;
  fetchedCount: number;
  storedCount: number;
  total?: number;
  requestId?: string;
  checkpointAt?: string;
  failureReason?: string;
}

export interface AnalysisWarehouseSyncRunRecord {
  id: string;
  sourceType: AnalysisWarehouseSyncSourceType;
  mode: AnalysisWarehouseSyncMode;
  dryRun: boolean;
  status: AnalysisWarehouseSyncRunStatus;
  requestedBy: string;
  requestedByName?: string;
  resources: AnalysisWarehouseResource[];
  resourceResults: AnalysisWarehouseResourceSyncSnapshot[];
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  failureReason?: string;
  configSnapshot: {
    sourceConfigured: boolean;
    openApiEnabled: boolean;
    sqliteSnapshotEnabled: boolean;
    fileExportEnabled: boolean;
  };
}

export interface AnalysisWarehouseRawRecord {
  id: string;
  sourceType: AnalysisWarehouseSyncSourceType;
  resource: AnalysisWarehouseResource;
  sourceObjectId: string;
  syncRunId: string;
  payload: Record<string, unknown>;
  payloadFieldNames: string[];
  payloadHash: string;
  syncedAt: string;
  updatedAt?: string;
}

export interface AnalysisWarehouseSyncCheckpointRecord {
  id: string;
  sourceType: AnalysisWarehouseSyncSourceType;
  resource: AnalysisWarehouseResource;
  lastRunId: string;
  lastSyncedAt: string;
  cursor?: string;
  observedTotal?: number;
}

export interface AppStorageState {
  policy: AccessPolicyRecord;
  lianruanCrmConnectionConfig: LianruanCrmConnectionConfigRecord;
  wecomBotConnectionConfig: WecomBotConnectionConfigRecord;
  analysisScopePolicy: AnalysisScopePolicyRecord;
  applicationSuperAdminPolicy?: ApplicationSuperAdminPolicyRecord;
  rolePermissions: RolePermissionRecord[];
  wecomPilotPolicy: WecomPilotPolicyRecord;
  queryTemplates: QueryTemplateRecord[];
  analysisSemanticKnowledgeDraftAssets: AnalysisSemanticKnowledgeAssetRecord[];
  analysisSemanticKnowledgePublishedAssets: AnalysisSemanticKnowledgeAssetRecord[];
  analysisSemanticKnowledgePublications: AnalysisSemanticKnowledgePublicationRecord[];
  analysisWarehouseSyncRuns: AnalysisWarehouseSyncRunRecord[];
  analysisWarehouseRawRecords: AnalysisWarehouseRawRecord[];
  analysisWarehouseSyncCheckpoints: AnalysisWarehouseSyncCheckpointRecord[];
  aiModelProfiles: AiModelProfileRecord[];
  aiModelActivation: AiModelActivationRecord;
  aiContextPolicy: AiContextPolicyRecord;
  recentQueries: RecentQueryRecord[];
  queryUsageProfiles: QueryUsageProfileRecord[];
  queryTimeSlotStats: QueryTimeSlotStatRecord[];
  analysisRequests: AnalysisRequestRecord[];
  analysisResults: AnalysisResultRecord[];
  auditEvents: AuditEventRecord[];
  sqlAuditRecords: SqlAuditRecord[];
  exportRequests: ExportRequestRecord[];
  querySessions: QuerySessionRecord[];
  authSessions: AuthSessionRecord[];
  wecomLoginBindings: WecomLoginBindingRecord[];
  pendingWecomBindings: PendingWecomBindingRecord[];
  wecomMessageReceipts: WecomMessageReceiptRecord[];
  wecomDeliveryRecords: WecomDeliveryRecord[];
  wecomConversationContexts: WecomConversationContextRecord[];
  pendingFollowUpWritebacks: PendingFollowUpWritebackRecord[];
  wecomSyncedDepartments: WecomSyncedDepartmentRecord[];
  wecomSyncedUsers: WecomSyncedUserRecord[];
  wecomUserDeptChanges: WecomUserDeptChangeRecord[];
  dataScopeGrants: DataScopeGrantRecord[];
  dailyReportDepartmentPolicies: DailyReportDepartmentPolicyRecord[];
  dailyReportRecipientOverrides: DailyReportRecipientOverrideRecord[];
  dailyReportSalesGroupConfigs: DailyReportSalesGroupConfigRecord[];
  wecomSyncCheckpoints: WecomSyncCheckpointRecord[];
  wecomSyncRuns: WecomSyncRunRecord[];
  crmWxUsers: CrmWxUserRecord[];
  crmWxUserMaps: CrmWxUserMapRecord[];
  contractReviewRuleSets: ContractReviewRuleSetRecord[];
  contractReviewTasks: ContractReviewTaskRecord[];
  contractReviewIssues: ContractReviewIssueRecord[];
  contractReviewArtifacts: ContractReviewArtifactRecord[];
  proactiveNotificationTasks: ProactiveNotificationTaskRecord[];
  dailyReports: DailyReportRecord[];
  dailyReportSummaryBatches: DailyReportSummaryBatchRecord[];
  dailyReportAssistanceEscalations: DailyReportAssistanceEscalationRecord[];
}

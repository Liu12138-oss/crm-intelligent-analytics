export interface AnalysisCapability {
  serviceStatus: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  scopeSummary: string;
  defaultAnalysisRoute?: AnalysisRoute;
  analysisRoutes?: Array<{
    route: AnalysisRoute;
    label: string;
    enabled: boolean;
    description: string;
  }>;
  analysisScopeMode?: 'FULL_ANALYSIS_SCOPE' | 'DEPARTMENT_ANALYSIS_SCOPE';
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
  wecomBotAccessState:
    | 'ALLOWED'
    | 'CHANNEL_DISABLED'
    | 'ROLE_NOT_ENABLED'
    | 'PILOT_REQUIRED'
    | 'EXPLICITLY_DENIED'
    | 'UNMAPPED_CRM_IDENTITY'
    | 'RESOURCE_FORBIDDEN';
  wecomBotAccessReason?: string;
  queryAssetSummary?: {
    timeSlot: string;
    recommendedTemplates: QueryAssetRecommendationItem[];
  };
  contractPermissions: {
    uploadAllowed: boolean;
    crossViewAllowed: boolean;
    crossDownloadAllowed: boolean;
  };
  isApplicationSuperAdmin?: boolean;
  applicationSuperAdminSubjects?: ApplicationSuperAdminSubjectView[];
}

export interface LianruanCrmConfigView {
  useRuntimeConfig: boolean;
  enabled: boolean;
  effectiveEnabled: boolean;
  source: 'env' | 'runtime' | 'mixed';
  baseUrl?: string;
  appKeyMasked?: string;
  appKeyPresent: boolean;
  appSecretPresent: boolean;
  timeoutMs: number;
  tokenCacheBufferSeconds: number;
  updatedBy?: string;
  updatedAt?: string;
}

export interface LianruanCrmConfigTestResult {
  success: boolean;
  checkedAt: string;
  durationMs: number;
  message: string;
  config: Pick<
    LianruanCrmConfigView,
    | 'effectiveEnabled'
    | 'source'
    | 'baseUrl'
    | 'appKeyMasked'
    | 'appKeyPresent'
    | 'appSecretPresent'
    | 'timeoutMs'
    | 'tokenCacheBufferSeconds'
  >;
  steps: Array<{
    name: string;
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
    message: string;
    durationMs?: number;
  }>;
  context?: {
    clientId?: string;
    clientName?: string;
    boundUserId?: string;
    boundUserName?: string;
    boundUserRole?: string;
    allowedResources?: string[];
  };
  permissionScope?: {
    user?: {
      id: string;
      name: string;
      role: string;
    };
    scopeType: string;
    regions: string[];
    partnerIds: string[];
    userIds: string[];
  };
}

export interface LianruanCrmDiagnosticsView {
  enabled: boolean;
  message?: string;
  config: {
    baseUrl?: string;
    baseUrlPresent?: boolean;
    appKeyPresent?: boolean;
    appSecretPresent?: boolean;
    timeoutMs?: number;
    tokenCacheBufferSeconds?: number;
  };
  context?: {
    clientId?: string;
    clientName?: string;
    boundUserId?: string;
    boundUserName?: string;
    boundUserRole?: string;
    allowedResources?: string[];
  };
  permissionScope?: {
    user?: {
      id: string;
      name: string;
      role: string;
    };
    scopeType: string;
    regions: string[];
    partnerIds: string[];
    userIds: string[];
  };
  permissionView?: {
    crmUserId?: string;
    userName?: string;
    role?: string;
    scopeType?: string;
    regions?: string[];
    partnerIds?: string[];
    userIds?: string[];
    clientMode?: string;
    boundClientUserId?: string;
    currentLoginUserId?: string;
    boundUserMatchesCurrentLogin?: boolean;
    resources?: Record<
      string,
      {
        status: 'AVAILABLE' | 'EMPTY' | 'FAILED';
        sampleCount: number;
        total: number;
        requestId?: string;
        failureReason?: string;
      }
    >;
  };
  dictionaries?: {
    availableKeys: string[];
    missingKeys: string[];
    completeness: number;
  };
  fieldCapabilities?: {
    overall: {
      totalExpectedFieldCount: number;
      availableFieldCount: number;
      completeness: number;
      missingP0Fields: Array<{
        resource: string;
        field: string;
        label: string;
      }>;
    };
    resources: Array<{
      resource: string;
      resourceLabel: string;
      sampleCount: number;
      observedFields: string[];
      totalExpectedFieldCount: number;
      availableFieldCount: number;
      missingP0Fields: string[];
      missingP1Fields: string[];
      completeness: number;
    }>;
  };
  supportedResources?: string[];
}

export interface QueryAssetRecommendationItem {
  templateId: string;
  name: string;
  description: string;
  recommendationReason: string;
}

export interface QueryTemplateItem {
  templateId: string;
  name: string;
  description: string;
  tags?: string[];
  defaultQuestionText: string;
  defaultFilters: Record<string, unknown>;
  defaultViewType?: string;
  queryMode?: 'FIXED_SQL';
  sqlText?: string;
  sqlVersion?: string;
  sourceType?: QueryTemplateSourceType;
  sourceQueryId?: string;
  sourceTemplateId?: string;
  sourceSnapshot?: QueryTemplateSourceSnapshot;
  scopeMode?: 'AUTO_SCOPE' | 'DECLARED_SCOPE';
  scopeGovernanceSnapshot?: QueryTemplateScopeAnalysis;
  parameterSchema?: Array<{
    key: string;
    label: string;
    type: string;
    required: boolean;
    defaultValue?: string | number | boolean | string[];
    options?: Array<{ label: string; value: string }>;
  }>;
  renderConfig?: {
    primaryViewType: string;
    primaryTitle: string;
    chartDimensionKey?: string;
    chartMetricKey?: string;
    tableColumns?: Array<{ key: string; label: string; width?: number }>;
    metricFields?: Array<{ key: string; label: string }>;
    moduleHeight?: number;
  };
  recommendationReason?: string;
  validationSnapshot?: {
    status: 'PASSED' | 'FAILED';
    message: string;
    scopeAnalysis?: QueryTemplateScopeAnalysis;
  };
  lastValidatedAt?: string;
  visibleRoleIds: string[];
  ownerUserId?: string;
  ownerName?: string;
  visibilityType?: QueryTemplateVisibilityType;
  displayOrder: number;
  clickCount7d: number;
  usageCountTotal?: number;
  lastUsedAt?: string;
  hitRatePercent: number;
  optimizationStatus: string;
  status: string;
  updatedAt: string;
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

export interface QueryTemplateListParams {
  scope?: 'mine' | 'others' | 'all';
  keyword?: string;
  tag?: string;
  ownerUserId?: string;
  page?: number;
  pageSize?: number;
  sort?: 'usage_desc' | 'display_order';
}

export interface QueryTemplateListResponse {
  items: QueryTemplateItem[];
  page?: number;
  pageSize?: number;
  total?: number;
  tags?: string[];
}

export interface SaveQueryAsTemplatePayload {
  name: string;
  description: string;
  tags: string[];
  visibilityType?: QueryTemplateVisibilityType;
  renderConfig?: QueryTemplateItem['renderConfig'];
}

export interface UpdateMyQueryTemplatePayload {
  name: string;
  description: string;
  defaultQuestionText: string;
  defaultViewType?: string;
  tags: string[];
}

export type AnalysisExecutionMode = 'PLAN_EXECUTION' | 'GUARDED_DIRECT_QUERY';

export type AnalysisRoute = 'OPENAPI' | 'SQLITE_READONLY';

export type AnalysisExecutionSource =
  | 'CRM_OFFICIAL_API'
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

export interface ResultTemporalScope {
  rawText: string;
  normalizedLabel: string;
  startAt?: string;
  endAt?: string;
  granularity: string;
  timezone: string;
  source: 'AI_TEMPORAL_SLOT' | 'USER_EXPLICIT' | 'FALLBACK_CLARIFICATION';
}

export interface AnalysisExecutionSnapshot {
  analysisRoute?: AnalysisRoute;
  executionMode: AnalysisExecutionMode;
  executionSource: AnalysisExecutionSource;
  preferredSource: AnalysisExecutionSource;
  matchedAdapter?: string;
  gapReason?: string;
  fallbackReason?: string;
  taskSnapshots: Array<{
    taskId: string;
    taskTitle: string;
    temporalSlot?: Record<string, unknown>;
    executionSource: AnalysisExecutionSource;
    matchedAdapter?: string;
    gapReason?: string;
    rowLimit: number;
    timeoutMs: number;
    tables: string[];
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
    resultKind: string;
    executionSource: AnalysisExecutionSource;
    preferredSource?: AnalysisExecutionSource;
    matchedAdapter?: string;
    gapReason?: string;
  }>;
  datasetReferences: AnalysisDatasetReference[];
  createdAt: string;
}

export interface QueryTemplateScopeAnalysis {
  scopeMode: 'AUTO_SCOPE' | 'DECLARED_SCOPE';
  scopeClassification:
    | 'AUTO_SCOPABLE'
    | 'DECLARED_DYNAMIC_SCOPE'
    | 'FIXED_SCOPE'
    | 'COMPLEX_REVIEW_REQUIRED'
    | 'UNSAFE_SCOPE';
  reviewStatus: 'PENDING_VALIDATION' | 'REVIEW_REQUIRED' | 'APPROVED' | 'BLOCKED';
  detectedScopeFields: Array<'organization_id' | 'department_id' | 'user_id'>;
  primaryDataSources?: Array<{ table: string; alias?: string }>;
  scopePredicateSources?: Array<{
    table?: string;
    alias?: string;
    field: 'organization_id' | 'department_id' | 'user_id';
    sourceType: 'PARAMETER' | 'FIXED_VALUE' | 'MIXED' | 'UNKNOWN';
    values?: string[];
  }>;
  displayDimensionSources?: Array<{
    outputName: string;
    sourceTable?: string;
    sourceAlias?: string;
    sourceColumn?: string;
    lineageTable?: string;
    lineageAlias?: string;
    lineageColumn?: string;
    expressionSummary?: string;
  }>;
  staticDimensionSources?: Array<{
    sourceType: 'UNION_TEAM_LIST' | 'HARDCODED_DEPARTMENT' | 'HARDCODED_OWNER';
    values: string[];
    detail: string;
  }>;
  riskFindings?: Array<{
    code: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    title: string;
    description: string;
    suggestion: string;
  }>;
  friendlyMessage: string;
  fixSuggestions?: string[];
  snapshotHash?: string;
  unsupportedReason?: string;
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

export interface AnalysisInsightSnapshot {
  grounded: boolean;
  reusedResultBundle: boolean;
  generatedAt: string;
  explanationLength: number;
  nextQuestionCount: number;
  failureReason?: string;
}

export interface AnalysisDeliverySnapshot {
  channel: string;
  deliveredFromSingleBundle: boolean;
  streamBlockCount: number;
  generatedAt: string;
}

export interface RecentQueryItem {
  historyId: string;
  sourceType?: 'AI_QUERY' | 'TEMPLATE_QUERY' | 'RERUN_HISTORY';
  templateId?: string;
  templateVersion?: string;
  questionText: string;
  lastUsedChannel: string;
  parameterSnapshot?: Record<string, unknown>;
  renderSnapshot?: {
    primaryViewType: string;
    primaryTitle: string;
  };
  resultSummary?: string;
  lastTemporalScope?: ResultTemporalScope;
  analysisRoute?: AnalysisRoute;
  executionMode?: AnalysisExecutionMode;
  executionSource?: AnalysisExecutionSource;
  matchedAdapter?: string;
  gapReason?: string;
  status: string;
  lastUsedAt: string;
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
  viewType: string;
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
  metricCards?: Array<{ name: string; value: string | number }>;
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

export interface AnalysisDatasetReference {
  datasetId: string;
  taskId: string;
  taskTitle: string;
  purpose: string;
  rowCount: number;
}

export interface AnalysisReportPayload {
  variant: 'ranking' | 'trend' | 'distribution' | 'summary';
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
  metricCards: Array<{ name: string; value: string | number }>;
  chartBlocks: AnalysisChartBlock[];
  tableBlocks: AnalysisTableBlock[];
  sections: AnalysisReportSection[];
  missingSections?: AnalysisMissingSection[];
  datasetReferences: AnalysisDatasetReference[];
  scopeSummary: string;
  appliedFilters: Array<{ label: string; value: string }>;
  sourceNotes?: AnalysisSourceNote[];
  footnotes?: string[];
  executionTraceSummary?: AnalysisExecutionTraceSummary;
  explanation?: string;
  evidenceSummary?: string;
  groundedExplanation?: string;
  nextBestQuestions?: string[];
  groundedMarkdown?: string;
  workbenchMarkdown?: string;
  detailMarkdown?: string;
  wecomMarkdown?: string;
  markdownOutline?: string[];
  emptyState?: string;
  errorState?: string;
  resultBundle?: {
    metricCards: Array<{ name: string; value: string | number }>;
    primaryBlock: {
      viewType: string;
      title: string;
      series?: Array<Record<string, unknown>>;
      rows?: Array<Record<string, unknown>>;
      columns?: Array<{ key: string; label: string; width?: number }>;
    };
    emptyStateBlock?: {
      title: string;
      reason: string;
      scopeSummary?: string;
      suggestions: string[];
    };
  };
  insightBundle?: {
    status: 'PENDING' | 'READY' | 'FAILED' | 'SKIPPED';
    groundedMarkdown?: string;
    failureReason?: string;
  };
  availableActions: Array<{ actionType: string; enabled: boolean; reason?: string }>;
}

export interface AnalysisQueryResult {
  queryId: string;
  status: string;
  title?: string;
  summary?: string;
  analysisRoute?: AnalysisRoute;
  executionMode?: AnalysisExecutionMode;
  executionSource?: AnalysisExecutionSource;
  preferredSource?: AnalysisExecutionSource;
  matchedAdapter?: string;
  gapReason?: string;
  report?: AnalysisReportPayload;
  temporalScope?: ResultTemporalScope;
  keyFindings?: AnalysisKeyFinding[];
  scopeSummary?: string;
  clarificationPrompt?: string;
  missingConditions?: string[];
  queueNotice?: string;
  appliedFilters?: Array<{ label: string; value: string }>;
  metricCards?: Array<{ name: string; value: string | number }>;
  primaryView?: {
    viewType: string;
    title: string;
    description?: string;
    series?: Array<Record<string, unknown>>;
    rows?: Array<Record<string, unknown>>;
    columns?: Array<{ key: string; label: string; width?: number }>;
  };
  secondaryViews?: Array<{
    viewType: string;
    title: string;
    rows?: Array<Record<string, unknown>>;
    series?: Array<Record<string, unknown>>;
  }>;
  tableRows?: Array<Record<string, unknown>>;
  rowCount?: number;
  dataFreshnessAt?: string;
  consistencyToken?: string;
  explanation?: string;
  groundedExplanation?: string;
  nextBestQuestions?: string[];
  groundedMarkdown?: string;
  wecomMarkdown?: string;
  markdownOutline?: string[];
  executionSnapshot?: AnalysisExecutionSnapshot;
  executionTraceSummary?: AnalysisExecutionTraceSummary;
  resultBundleSnapshot?: AnalysisResultBundleSnapshot;
  insightSnapshot?: AnalysisInsightSnapshot;
  deliverySnapshot?: AnalysisDeliverySnapshot;
  emptyReason?: string;
  availableActions?: Array<{ actionType: string; enabled: boolean; reason?: string }>;
  streamBlocks?: Array<{ sequence: number; blockType: string; content: string }>;
  createdAt?: string;
  completedAt?: string;
}

export interface AnalysisExportPayload {
  exportId: string;
  status: 'COMPLETED' | 'BLOCKED';
  rowCount: number;
  blockedReason?: string;
  fileName?: string;
  mimeType?: string;
  content?: string;
  downloadUrl?: string;
  executionSource?: AnalysisExecutionSource;
  matchedAdapter?: string;
  gapReason?: string;
  createdAt?: string;
  exportedAt?: string;
}

export interface AccessPolicyView {
  policyId: string;
  enabledRoleIds: string[];
  exportRoleIds: string[];
  enabledChannels: string[];
  allowedDomains: string[];
  allowedTables: string[];
  allowedFields: Record<string, string[]>;
  maskedFields?: Record<string, string[]>;
  exportRowLimit: number;
  exportDailyLimit: number;
  maxOnlineSessions: number;
  maxConcurrentQueries: number;
  heartbeatIntervalSeconds: number;
  idleTimeoutSeconds: number;
  historyRetentionDays: number;
  status: string;
  updatedAt: string;
}

export interface AuditEventList {
  summary: {
    todayQueryCount: number;
    wecomQueryRatioPercent: number;
    todayBlockedCount: number;
    todaySensitiveInterceptCount: number;
    todayExportCount: number;
    todayExportBlockedCount: number;
    pendingHighRiskReviewCount: number;
    todayAiEntryCount: number;
    todayAiFallbackCount: number;
    todayAiFallbackRatePercent: number;
    todayWecomEntryCount: number;
    entrySceneBreakdown: Array<{
      scene: string;
      count: number;
      fallbackCount: number;
      fallbackRatePercent: number;
    }>;
    entryTargetWorkflowBreakdown: Array<{
      targetWorkflow: string;
      count: number;
      fallbackCount: number;
      fallbackRatePercent: number;
    }>;
    entryFallbackReasonBreakdown: Array<{
      fallbackReason: string;
      count: number;
    }>;
    entryDailyTrend: Array<{
      date: string;
      aiEntryCount: number;
      aiFallbackCount: number;
      aiFallbackRatePercent: number;
      wecomEntryCount: number;
    }>;
    entrySceneDailyTrend: Array<{
      date: string;
      scene: string;
      count: number;
      fallbackCount: number;
      fallbackRatePercent: number;
    }>;
    entryFallbackReasonDailyTrend: Array<{
      date: string;
      fallbackReason: string;
      count: number;
    }>;
    aiGovernanceSuggestions: Array<{
      level: 'info' | 'warning' | 'critical';
      title: string;
      detail: string;
      action: string;
    }>;
    aiGovernanceAlerts: Array<{
      level: 'warning' | 'critical';
      title: string;
      detail: string;
    }>;
  };
  items: Array<{
    eventId: string;
    eventType: string;
    actorId: string;
    actorName?: string;
    actorType?: string;
    actorDisplayName?: string;
    actorExternalId?: string;
    actorBindingStatus?: string;
    permissionKey?: string;
    resourceType?: string;
    resourceId?: string;
    channel?: string;
    channelAgentId?: string;
    channelAgentType?: string;
    queryId?: string;
    templateId?: string;
    historyId?: string;
    originalQuestion?: string;
    scopeSummary: string;
    resultCount?: number;
    riskLevel: string;
    reviewStatus: string;
    outcome: string;
    failureReason?: string;
    actionSummary?: string;
    targetType?: string;
    targetId?: string;
    targetSummary?: string;
    sessionId?: string;
    entryInterpretationSnapshot?: Record<string, unknown>;
    workflowRoutingSnapshot?: Record<string, unknown>;
    entryScene?: string;
    entryTargetWorkflow?: string;
    entryUsedFallback?: boolean;
    entryFallbackReason?: string;
    workflowFinalProgram?: string;
    workflowTargetWorkflow?: string;
    sessionSnapshot?: Record<string, unknown>;
    createdAt: string;
  }>;
  page: number;
  pageSize: number;
  total: number;
}

export interface SqlAuditSummaryView {
  totalCount: number;
  writeCount: number;
  failedCount: number;
  blockedCount: number;
  highRiskCount: number;
  averageDurationMs: number;
  canRevealSensitive: boolean;
}

export interface SqlAuditListItem {
  auditId: string;
  actorId: string;
  actorName?: string;
  channel?: string;
  requestId?: string;
  sessionId?: string;
  moduleKey: string;
  programName: string;
  databaseRole: string;
  operationType: string;
  stage: string;
  status: string;
  riskLevel: string;
  tables: string[];
  sqlFingerprint: string;
  sqlSummary: string;
  paramSummary: string;
  rowCount?: number;
  affectedRows?: number;
  durationMs?: number;
  executionMode?: string;
  executionSource?: string;
  matchedAdapter?: string;
  fallbackReason?: string;
  blockedReason?: string;
  errorSummary?: string;
  canRevealSensitive: boolean;
  createdAt: string;
}

export interface SqlAuditListResponse {
  summary: SqlAuditSummaryView;
  items: SqlAuditListItem[];
  page: number;
  pageSize: number;
  total: number;
}

export interface SqlAuditDetailView {
  auditId: string;
  actorId: string;
  actorName?: string;
  channel?: string;
  requestId?: string;
  sessionId?: string;
  moduleKey: string;
  programName: string;
  databaseRole: string;
  operationType: string;
  stage: string;
  status: string;
  riskLevel: string;
  tables: string[];
  sqlFingerprint: string;
  sqlSummary: string;
  paramSummary: string;
  rowCount?: number;
  affectedRows?: number;
  durationMs?: number;
  timeoutMs?: number;
  executionMode?: string;
  executionSource?: string;
  matchedAdapter?: string;
  fallbackReason?: string;
  blockedReason?: string;
  errorSummary?: string;
  canRevealSensitive: boolean;
  behaviorContext?: {
    title: string;
    summary: string;
    requestStatus?: string;
    originalQuestion?: string;
    temporalLabel?: string;
    taskTitles?: string[];
  };
  createdAt: string;
}

export interface SqlAuditRevealView {
  auditId: string;
  sqlText: string;
  params: unknown[];
  errorMessage?: string;
  revealedAt: string;
}

export interface AiModelProfileItem {
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
  sdkType: 'openai-compatible-http';
  model: string;
  baseUrl?: string;
  secretConfigured: boolean;
  secretMask: '已配置' | '未配置';
  secretUpdatedAt?: string;
  reasoningEffort?: string;
  serviceTier?: string;
  timeoutMs?: number;
  status: 'ACTIVE' | 'INACTIVE';
  sdkOptions: Record<string, unknown>;
  lastHealthCheckAt?: string;
  lastHealthCheckStatus?: 'SUCCEEDED' | 'FAILED';
  lastHealthCheckLatencyMs?: number;
  lastHealthCheckFailureReason?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccessGovernanceOverview {
  analysisEnabledRoleCount: number;
  wecomPilotMode: 'DISABLED' | 'PILOT_ONLY' | 'FULL';
  wecomPilotWhitelistUserCount: number;
  exportEnabledRoleCount: number;
  identityMappingIssueCount: number;
}

export interface RolePermissionItem {
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

export interface RolePermissionListResponse {
  items: RolePermissionItem[];
  page: number;
  pageSize: number;
  total: number;
}

export interface WecomPilotPolicyView {
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

export interface AccessPreviewView {
  crmUserId?: string;
  crmUserName?: string;
  wecomUserId?: string;
  mappingStatus: 'MAPPED' | 'UNMAPPED' | 'CONFLICTED';
  analysisScopeMode?: 'FULL_ANALYSIS_SCOPE' | 'DEPARTMENT_ANALYSIS_SCOPE';
  analysisScopeSummary?: string;
  roleNames: string[];
  visibleMenus: string[];
  actionKeys: string[];
  scopeSummary: string;
  wecomBotAccessState:
    | 'ALLOWED'
    | 'CHANNEL_DISABLED'
    | 'ROLE_NOT_ENABLED'
    | 'PILOT_REQUIRED'
    | 'EXPLICITLY_DENIED'
    | 'UNMAPPED_CRM_IDENTITY'
    | 'RESOURCE_FORBIDDEN';
  wecomBotAccessReason?: string;
  contractPermissions: {
    uploadAllowed: boolean;
    crossViewAllowed: boolean;
    crossDownloadAllowed: boolean;
  };
  simplifiedPermissionProfile?: SimplifiedPermissionProfile;
  isApplicationSuperAdmin?: boolean;
  applicationSuperAdminSubjects?: ApplicationSuperAdminSubjectView[];
}

export interface IdentityMappingDiagnosticItem {
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
  wecomBotAccessState:
    | 'ALLOWED'
    | 'CHANNEL_DISABLED'
    | 'ROLE_NOT_ENABLED'
    | 'PILOT_REQUIRED'
    | 'EXPLICITLY_DENIED'
    | 'UNMAPPED_CRM_IDENTITY'
    | 'RESOURCE_FORBIDDEN';
  failedReason?: string;
  lastDirectorySyncAt?: string;
}

export interface DataScopeGrantItem {
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

export interface AnalysisSemanticKnowledgeAssetItem {
  id: string;
  type: AnalysisSemanticKnowledgeAssetType;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  matchKeywords?: string[];
  canonicalLabel?: string;
  synonyms?: string[];
  questionText?: string;
  sqlHint?: string;
  hint?: string;
  blockReason?: string;
  latestPublishedVersion?: string;
  updatedBy?: string;
  updatedAt?: string;
}

export interface AnalysisSemanticKnowledgeListView {
  draftItems: AnalysisSemanticKnowledgeAssetItem[];
  publishedSummary: {
    version?: string;
    assetCount: number;
    publishedBy?: string;
    publishedAt?: string;
    changeSummary?: string;
  };
}

export interface DataScopePreviewView {
  crmUserId?: string;
  crmUserName?: string;
  wecomUserId?: string;
  mappingStatus: 'MAPPED' | 'UNMAPPED' | 'CONFLICTED';
  organizationIds: string[];
  departmentIds: string[];
  ownerIds: string[];
  grantSummaries: string[];
  scopeSummary: string;
}

export interface DailyReportDepartmentPolicyItem {
  departmentId: string;
  departmentName: string;
  parentDepartmentId?: string;
  status: 'ENABLED' | 'DISABLED' | 'INHERIT';
  departmentType: 'REGION' | 'SALES' | 'NON_SALES' | 'UNCLASSIFIED';
  applyToChildren: boolean;
  updatedBy: string;
  updatedAt: string;
  reason: string;
  resolvedRecipientName?: string;
  resolvedRecipientCrmUserId?: string;
  resolvedRecipientWecomUserId?: string;
  resolvedRecipientSource?: 'AUTO' | 'REGION_OVERRIDE' | 'SALES_GROUP_OVERRIDE';
}

export interface DailyReportDepartmentPolicyListResponse {
  items: DailyReportDepartmentPolicyItem[];
  strategies: DailyReportDepartmentPolicyItem[];
}

export interface DailyReportDeliveryPreviewGroupView {
  groupDepartmentId: string;
  groupDepartmentName: string;
  regionDepartmentId?: string;
  regionDepartmentName?: string;
  effectivePolicy: 'ENABLED' | 'DISABLED' | 'INHERIT';
  recipientCrmUserIds?: string[];
  recipientNames?: string[];
  recipientWecomUserIds?: string[];
  recipients?: Array<{
    crmUserId?: string;
    name?: string;
    wecomUserId?: string;
  }>;
  recipientCrmUserId?: string;
  recipientName?: string;
  recipientWecomUserId?: string;
  ruleSource: 'AUTO' | 'REGION_OVERRIDE' | 'SALES_GROUP_OVERRIDE' | 'MANUAL_GROUP_CONFIG';
  ruleSourceLabel?: string;
  deliveryStatus: 'READY' | 'BLOCKED';
  deliveryStatusLabel?: string;
  deliveryReason?: string;
  memberRequesterIds: string[];
  members?: Array<{
    crmUserId?: string;
    memberName?: string;
    wecomUserId?: string;
    mappingStatus: 'MAPPED' | 'MISSING_CRM_USER' | 'MISSING_WECOM_MAPPING';
    mappingStatusLabel?: string;
  }>;
  memberCount: number;
}

export interface DailyReportDeliveryPreviewView {
  businessDate: string;
  groups: DailyReportDeliveryPreviewGroupView[];
}

export interface DailyReportSalesGroupConfigView {
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

export interface AccessOptionItem {
  value: string;
  label: string;
  parentDepartmentId?: string;
}

export interface AccessOptionsView {
  users: AccessOptionItem[];
  roles: AccessOptionItem[];
  departments: AccessOptionItem[];
  wecomUsers: AccessOptionItem[];
}

export type WecomOrgSubjectMappingStatus =
  | 'MAPPED'
  | 'UNMAPPED'
  | 'CONFLICTED'
  | 'DELETED';

export type WecomOrgSubjectType = 'user' | 'department';

export type WecomOrgSubjectValueType =
  | 'crmUserId'
  | 'wecomUserId'
  | 'crmDepartmentId'
  | 'wecomDepartmentId';

export interface WecomOrgDepartmentSubjectItem {
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

export interface WecomOrgUserSubjectItem {
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

export interface WecomOrgSubjectOptionsView {
  departments: WecomOrgDepartmentSubjectItem[];
  users: WecomOrgUserSubjectItem[];
  lastSyncedAt?: string;
}

export interface ApplicationSuperAdminSubjectView {
  subjectType: 'USER' | 'ROLE';
  subjectId: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface ApplicationSuperAdminPolicyView {
  policyId: string;
  subjects: ApplicationSuperAdminSubjectView[];
  fullAccessUserIds: string[];
  fullAccessRoleIds: string[];
  updatedBy: string;
  updatedAt: string;
  changeReason?: string;
}

export type AnalysisScopePolicyView = ApplicationSuperAdminPolicyView;

export interface AiModelActivationView {
  activeProfileId?: string;
  activatedAt?: string;
  activatedBy?: string;
  lastVerifiedAt?: string;
  lastVerificationStatus?: 'SUCCEEDED' | 'FAILED';
}

export interface AiContextPolicyView {
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

export interface AiModelProfileListResponse {
  items: AiModelProfileItem[];
  activation: AiModelActivationView;
}

export interface AiModelHealthCheckResult {
  status: 'SUCCEEDED' | 'FAILED';
  latencyMs: number;
  failureStage?:
    | 'STATIC_VALIDATION'
    | 'SDK_INIT'
    | 'SDK_CALL'
    | 'MCP_INIT'
    | 'HTTP_REQUEST'
    | 'HTTP_STATUS'
    | 'RESPONSE_PARSE'
    | 'SCHEMA_VALIDATION';
  failureReason?: string;
  providerSummary: string;
}

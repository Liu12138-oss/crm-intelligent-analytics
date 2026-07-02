import { httpClient } from './http-client';
import type {
  AccessPolicyView,
  AccessOptionsView,
  AccessGovernanceOverview,
  AccessPreviewView,
  ApplicationSuperAdminPolicyView,
  WecomOrgSubjectOptionsView,
  AiModelHealthCheckResult,
  AiContextPolicyView,
  AiModelProfileItem,
  AiModelProfileListResponse,
  AnalysisSemanticKnowledgeAssetItem,
  AnalysisSemanticKnowledgeListView,
  AnalysisCapability,
  AnalysisExportPayload,
  AnalysisQueryResult,
  LianruanCrmConfigTestResult,
  LianruanCrmConfigView,
  LianruanCrmDiagnosticsView,
  AuditEventList,
  SqlAuditDetailView,
  SqlAuditListResponse,
  SqlAuditRevealView,
  SqlAuditSummaryView,
  DataScopeGrantItem,
  DataScopePreviewView,
  DailyReportDepartmentPolicyListResponse,
  DailyReportDepartmentPolicyItem,
  DailyReportDeliveryPreviewView,
  DailyReportSalesGroupConfigView,
  IdentityMappingDiagnosticItem,
  QueryTemplateItem,
  QueryTemplateListParams,
  QueryTemplateListResponse,
  SaveQueryAsTemplatePayload,
  UpdateMyQueryTemplatePayload,
  RecentQueryItem,
  RolePermissionItem,
  RolePermissionListResponse,
  WecomPilotPolicyView,
} from '@/types/analysis';

const AI_MODEL_HEALTH_CHECK_TIMEOUT_MS = 90000;
const ANALYSIS_QUERY_TIMEOUT_MS = 60000;
const ANALYSIS_REPORT_TIMEOUT_MS = 65000;
const CRM_CONNECTION_TEST_TIMEOUT_MS = 30000;

export const analysisService = {
  getCapabilities(): Promise<AnalysisCapability> {
    return httpClient.get('/analysis/capabilities');
  },
  listTemplates(params?: QueryTemplateListParams): Promise<QueryTemplateListResponse> {
    const search = new URLSearchParams();
    if (params?.scope) search.set('scope', params.scope);
    if (params?.keyword?.trim()) search.set('keyword', params.keyword.trim());
    if (params?.tag?.trim()) search.set('tag', params.tag.trim());
    if (params?.ownerUserId?.trim()) search.set('ownerUserId', params.ownerUserId.trim());
    search.set('page', String(params?.page ?? 1));
    search.set('pageSize', String(params?.pageSize ?? 20));
    search.set('sort', params?.sort ?? 'usage_desc');
    return httpClient.get(`/analysis/templates?${search.toString()}`);
  },
  listTemplateFacets(): Promise<{ tags: string[] }> {
    return httpClient.get('/analysis/templates/facets');
  },
  getTemplate(templateId: string): Promise<QueryTemplateItem> {
    return httpClient.get(`/analysis/templates/${templateId}`);
  },
  copyTemplateToMine(templateId: string): Promise<QueryTemplateItem> {
    return httpClient.post(`/analysis/templates/${templateId}/copy-to-mine`, {});
  },
  deleteMyTemplate(templateId: string): Promise<{ success: boolean; templateId: string }> {
    return httpClient.delete(`/analysis/templates/${templateId}`);
  },
  updateMyTemplate(
    templateId: string,
    payload: UpdateMyQueryTemplatePayload,
  ): Promise<QueryTemplateItem> {
    return httpClient.put(`/analysis/templates/${templateId}`, payload);
  },
  saveQueryAsTemplate(
    queryId: string,
    payload: SaveQueryAsTemplatePayload,
  ): Promise<QueryTemplateItem> {
    return httpClient.post(`/analysis/queries/${queryId}/templates`, payload);
  },
  executeTemplate(
    templateId: string,
    payload: {
      parameters?: Record<string, unknown>;
      includeAiReport?: boolean;
      scopeRewriteConfirmed?: boolean;
    },
  ): Promise<{
    queryId: string;
    templateId: string;
    queryMode: string;
    sqlVersion: string;
    scopeExecution?: {
      analysisScopeMode: 'FULL_ANALYSIS_SCOPE' | 'DEPARTMENT_ANALYSIS_SCOPE';
      analysisScopeSummary: string;
      templateScopeMode: 'AUTO_SCOPE' | 'DECLARED_SCOPE';
    };
    resultBundle: Record<string, unknown>;
    insightBundle: Record<string, unknown>;
    executedAt: string;
  }> {
    return httpClient.post(`/analysis/templates/${templateId}/execute`, payload, {
      timeoutMs: ANALYSIS_QUERY_TIMEOUT_MS,
    });
  },
  listRecentQueries(page = 1, pageSize = 10): Promise<{
    items: RecentQueryItem[];
    page: number;
    pageSize: number;
    total: number;
  }> {
    return httpClient.get(`/analysis/histories?page=${page}&pageSize=${pageSize}`);
  },
  createQuery(payload: Record<string, unknown>): Promise<AnalysisQueryResult> {
    return httpClient.post('/analysis/queries', payload, {
      timeoutMs: ANALYSIS_QUERY_TIMEOUT_MS,
    });
  },
  getQuery(queryId: string): Promise<AnalysisQueryResult> {
    return httpClient.get(`/analysis/queries/${queryId}`);
  },
  getPublicQuery(queryId: string): Promise<AnalysisQueryResult> {
    return httpClient.get(`/public/analysis-results/${queryId}`, {
      suppressAuthExpired: true,
    });
  },
  getQueryReport(
    queryId: string,
    payload?: { waitMs?: number },
  ): Promise<{
    queryId: string;
    status: 'READY' | 'PENDING';
    report?: AnalysisQueryResult['report'];
    keyFindings?: AnalysisQueryResult['keyFindings'];
    groundedMarkdown?: string;
    wecomMarkdown?: string;
    markdownOutline?: string[];
    completedAt?: string;
  }> {
    return httpClient.post(`/analysis/queries/${queryId}/report`, payload ?? {}, {
      timeoutMs: ANALYSIS_REPORT_TIMEOUT_MS,
    });
  },
  rerunHistory(historyId: string, payload: Record<string, unknown>): Promise<AnalysisQueryResult> {
    return httpClient.post(`/analysis/histories/${historyId}/rerun`, payload, {
      timeoutMs: ANALYSIS_QUERY_TIMEOUT_MS,
    });
  },
  createExport(
    queryId: string,
    format: 'xlsx' | 'csv' = 'csv',
  ): Promise<AnalysisExportPayload> {
    return httpClient.post(`/analysis/queries/${queryId}/exports`, { format });
  },
  getCurrentPolicy(): Promise<AccessPolicyView> {
    return httpClient.get('/governance/policies/current');
  },
  updateCurrentPolicy(payload: Record<string, unknown>): Promise<AccessPolicyView> {
    return httpClient.put('/governance/policies/current', payload);
  },
  getLianruanCrmConfig(): Promise<LianruanCrmConfigView> {
    return httpClient.get('/governance/lianruan-crm-config');
  },
  updateLianruanCrmConfig(payload: Record<string, unknown>): Promise<LianruanCrmConfigView> {
    return httpClient.put('/governance/lianruan-crm-config', payload);
  },
  testLianruanCrmConfig(payload?: Record<string, unknown>): Promise<LianruanCrmConfigTestResult> {
    return httpClient.post('/governance/lianruan-crm-config/test', payload ?? {}, {
      timeoutMs: CRM_CONNECTION_TEST_TIMEOUT_MS,
    });
  },
  getLianruanCrmDiagnostics(): Promise<LianruanCrmDiagnosticsView> {
    return httpClient.get('/governance/crm-standard-api/diagnostics');
  },
  listAccessOptions(): Promise<AccessOptionsView> {
    return httpClient.get('/governance/access-options');
  },
  listWecomOrgSubjects(): Promise<WecomOrgSubjectOptionsView> {
    return httpClient.get('/governance/wecom-organization-subjects');
  },
  getAccessGovernanceOverview(): Promise<AccessGovernanceOverview> {
    return httpClient.get('/governance/permissions/overview');
  },
  getAnalysisScopePolicy(): Promise<ApplicationSuperAdminPolicyView> {
    return httpClient.get('/governance/analysis-scope-policy');
  },
  updateAnalysisScopePolicy(
    payload: Record<string, unknown>,
  ): Promise<ApplicationSuperAdminPolicyView> {
    return httpClient.put('/governance/analysis-scope-policy', payload);
  },
  getApplicationSuperAdminPolicy(): Promise<ApplicationSuperAdminPolicyView> {
    return httpClient.get('/governance/application-super-admin-policy');
  },
  updateApplicationSuperAdminPolicy(
    payload: Record<string, unknown>,
  ): Promise<ApplicationSuperAdminPolicyView> {
    return httpClient.put('/governance/application-super-admin-policy', payload);
  },
  listRolePermissions(params?: {
    keyword?: string;
    status?: 'ACTIVE' | 'INACTIVE';
    page?: number;
    pageSize?: number;
  }): Promise<RolePermissionListResponse> {
    const search = new URLSearchParams();
    if (params?.keyword?.trim()) {
      search.set('keyword', params.keyword.trim());
    }
    if (params?.status) {
      search.set('status', params.status);
    }
    search.set('page', String(params?.page ?? 1));
    search.set('pageSize', String(params?.pageSize ?? 10));
    return httpClient.get(`/governance/role-permissions?${search.toString()}`);
  },
  updateRolePermission(
    roleId: string,
    payload: Record<string, unknown>,
  ): Promise<RolePermissionItem> {
    return httpClient.put(`/governance/role-permissions/${roleId}`, payload);
  },
  getWecomPilotPolicy(): Promise<WecomPilotPolicyView> {
    return httpClient.get('/governance/channels/wecom-bot/pilot-policy');
  },
  updateWecomPilotPolicy(
    payload: Record<string, unknown>,
  ): Promise<WecomPilotPolicyView> {
    return httpClient.put('/governance/channels/wecom-bot/pilot-policy', payload);
  },
  previewAccess(payload: Record<string, unknown>): Promise<AccessPreviewView> {
    return httpClient.post('/governance/access-preview', payload);
  },
  listIdentityMappings(params: URLSearchParams): Promise<{ items: IdentityMappingDiagnosticItem[] }> {
    return httpClient.get(`/governance/identity-mappings?${params.toString()}`);
  },
  listDataScopeGrants(): Promise<{ items: DataScopeGrantItem[] }> {
    return httpClient.get('/governance/data-scope-grants');
  },
  updateDataScopeGrant(
    grantId: string,
    payload: Record<string, unknown>,
  ): Promise<DataScopeGrantItem> {
    return httpClient.put(`/governance/data-scope-grants/${grantId}`, payload);
  },
  previewDataScope(payload: Record<string, unknown>): Promise<DataScopePreviewView> {
    return httpClient.post('/governance/data-scope-preview', payload);
  },
  listDailyReportDeliveryDepartments(): Promise<DailyReportDepartmentPolicyListResponse> {
    return httpClient.get('/governance/daily-report-delivery/departments');
  },
  updateDailyReportDeliveryDepartment(
    departmentId: string,
    payload: Record<string, unknown>,
  ): Promise<DailyReportDepartmentPolicyItem> {
    return httpClient.put(
      `/governance/daily-report-delivery/departments/${departmentId}`,
      payload,
    );
  },
  deleteDailyReportDeliveryDepartment(
    departmentId: string,
  ): Promise<{ success: boolean; departmentId: string }> {
    return httpClient.delete(`/governance/daily-report-delivery/departments/${departmentId}`);
  },
  previewDailyReportDelivery(
    payload: Record<string, unknown>,
  ): Promise<DailyReportDeliveryPreviewView> {
    return httpClient.post('/governance/daily-report-delivery/preview', payload);
  },
  createDailyReportSalesGroup(
    payload: Record<string, unknown>,
  ): Promise<DailyReportSalesGroupConfigView> {
    return httpClient.post('/governance/daily-report-delivery/groups', payload);
  },
  updateDailyReportSalesGroup(
    groupId: string,
    payload: Record<string, unknown>,
  ): Promise<DailyReportSalesGroupConfigView> {
    return httpClient.put(`/governance/daily-report-delivery/groups/${groupId}`, payload);
  },
  deleteDailyReportSalesGroup(
    groupId: string,
  ): Promise<{ success: boolean; groupId: string }> {
    return httpClient.delete(`/governance/daily-report-delivery/groups/${groupId}`);
  },
  listGovernanceTemplates(): Promise<{ items: QueryTemplateItem[] }> {
    return httpClient.get('/governance/query-templates');
  },
  listGovernanceTemplateFacets(): Promise<{ tags: string[] }> {
    return httpClient.get('/governance/query-templates/facets');
  },
  createGovernanceTemplate(payload: Record<string, unknown>): Promise<QueryTemplateItem> {
    return httpClient.post('/governance/query-templates', payload);
  },
  updateGovernanceTemplate(
    templateId: string,
    payload: Record<string, unknown>,
  ): Promise<QueryTemplateItem> {
    return httpClient.put(`/governance/query-templates/${templateId}`, payload);
  },
  deleteGovernanceTemplate(
    templateId: string,
  ): Promise<{ success: boolean; templateId: string }> {
    return httpClient.delete(`/governance/query-templates/${templateId}`);
  },
  validateGovernanceTemplate(
    templateId: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return httpClient.post(`/governance/query-templates/${templateId}/validate`, payload);
  },
  previewGovernanceTemplate(
    templateId: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return httpClient.post(`/governance/query-templates/${templateId}/preview`, payload, {
      timeoutMs: ANALYSIS_QUERY_TIMEOUT_MS,
    });
  },
  listAnalysisSemanticKnowledgeAssets(): Promise<AnalysisSemanticKnowledgeListView> {
    return httpClient.get('/governance/semantic-knowledge');
  },
  createAnalysisSemanticKnowledgeAsset(
    payload: Record<string, unknown>,
  ): Promise<AnalysisSemanticKnowledgeAssetItem> {
    return httpClient.post('/governance/semantic-knowledge', payload);
  },
  updateAnalysisSemanticKnowledgeAsset(
    assetId: string,
    payload: Record<string, unknown>,
  ): Promise<AnalysisSemanticKnowledgeAssetItem> {
    return httpClient.put(`/governance/semantic-knowledge/${assetId}`, payload);
  },
  setAnalysisSemanticKnowledgeAssetStatus(
    assetId: string,
    status: 'ACTIVE' | 'INACTIVE',
  ): Promise<AnalysisSemanticKnowledgeAssetItem> {
    return httpClient.post(`/governance/semantic-knowledge/${assetId}/status`, { status });
  },
  publishAnalysisSemanticKnowledgeAssets(
    changeSummary: string,
  ): Promise<Record<string, unknown>> {
    return httpClient.post('/governance/semantic-knowledge/publish', {
      changeSummary,
    });
  },
  listAuditEvents(params: URLSearchParams): Promise<AuditEventList> {
    return httpClient.get(`/audit-events?${params.toString()}`);
  },
  getSqlAuditSummary(params: URLSearchParams): Promise<SqlAuditSummaryView> {
    return httpClient.get(`/audit-events/sql/summary?${params.toString()}`);
  },
  listSqlAudits(params: URLSearchParams): Promise<SqlAuditListResponse> {
    return httpClient.get(`/audit-events/sql?${params.toString()}`);
  },
  getSqlAuditDetail(auditId: string): Promise<SqlAuditDetailView> {
    return httpClient.get(`/audit-events/sql/${auditId}`);
  },
  revealSqlAudit(auditId: string): Promise<SqlAuditRevealView> {
    return httpClient.post(`/audit-events/sql/${auditId}/reveal`);
  },
  listAiModelProfiles(): Promise<AiModelProfileListResponse> {
    return httpClient.get('/governance/ai-models');
  },
  getAiContextPolicy(): Promise<AiContextPolicyView> {
    return httpClient.get('/governance/ai-models/context-policy');
  },
  updateAiContextPolicy(
    payload: Record<string, unknown>,
  ): Promise<AiContextPolicyView> {
    return httpClient.put('/governance/ai-models/context-policy', payload);
  },
  getAiModelProfile(profileId: string): Promise<AiModelProfileItem> {
    return httpClient.get(`/governance/ai-models/${profileId}`);
  },
  createAiModelProfile(payload: Record<string, unknown>): Promise<AiModelProfileItem> {
    return httpClient.post('/governance/ai-models', payload);
  },
  draftHealthCheckAiModelProfile(
    payload: Record<string, unknown>,
  ): Promise<AiModelHealthCheckResult> {
    return httpClient.post('/governance/ai-models/draft-health-check', payload, {
      timeoutMs: AI_MODEL_HEALTH_CHECK_TIMEOUT_MS,
    });
  },
  updateAiModelProfile(
    profileId: string,
    payload: Record<string, unknown>,
  ): Promise<AiModelProfileItem> {
    return httpClient.put(`/governance/ai-models/${profileId}`, payload);
  },
  copyAiModelProfile(profileId: string): Promise<AiModelProfileItem> {
    return httpClient.post(`/governance/ai-models/${profileId}/copy`);
  },
  deleteAiModelProfile(profileId: string): Promise<Record<string, unknown>> {
    return httpClient.delete(`/governance/ai-models/${profileId}`);
  },
  clearAiModelProfileSecret(profileId: string): Promise<AiModelProfileItem> {
    return httpClient.post(`/governance/ai-models/${profileId}/clear-secret`);
  },
  setAiModelProfileStatus(
    profileId: string,
    status: 'ACTIVE' | 'INACTIVE',
  ): Promise<AiModelProfileItem> {
    return httpClient.post(`/governance/ai-models/${profileId}/status`, { status });
  },
  healthCheckAiModelProfile(profileId: string): Promise<AiModelHealthCheckResult> {
    return httpClient.post(`/governance/ai-models/${profileId}/health-check`, undefined, {
      timeoutMs: AI_MODEL_HEALTH_CHECK_TIMEOUT_MS,
    });
  },
  activateAiModelProfile(profileId: string): Promise<Record<string, unknown>> {
    return httpClient.post(`/governance/ai-models/${profileId}/activate`, undefined, {
      timeoutMs: AI_MODEL_HEALTH_CHECK_TIMEOUT_MS,
    });
  },
};

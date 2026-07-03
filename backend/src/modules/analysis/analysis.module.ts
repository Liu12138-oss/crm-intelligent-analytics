import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AnalysisWarehouseMysqlService } from '../../database/analysis-warehouse/analysis-warehouse-mysql.service';
import { CrmReadonlyService } from '../../database/crm-readonly/crm-readonly.service';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import { AiModelsModule } from '../ai-models/ai-models.module';
import { AiContextPolicyRepository } from '../ai-models/ai-context-policy.repository';
import { AiContextPolicyService } from '../ai-models/ai-context-policy.service';
import { AuditEventRepository } from '../audit/audit-event.repository';
import { SqlAuditContextService } from '../audit/sql-audit-context.service';
import { SqlAuditFileStore } from '../audit/sql-audit-file.store';
import { SqlAuditRepository } from '../audit/sql-audit.repository';
import { SqlAuditService } from '../audit/sql-audit.service';
import { UserScopeService } from '../auth/user-scope.service';
import { LianruanCrmOpenApiAdapterService } from '../crm-standard-api/lianruan-crm-openapi.adapter.service';
import { LianruanCrmOpenApiClient } from '../crm-standard-api/lianruan-crm-openapi.client';
import { LianruanCrmFieldCapabilityRegistry } from '../crm-standard-api/lianruan-crm-field-capability.registry';
import { LianruanCrmQueryAdapterService } from '../crm-standard-api/lianruan-crm-query-adapter.service';
import { AccessDecisionService } from '../governance/access-decision.service';
import { AccessPolicyRepository } from '../governance/access-policy.repository';
import { ApplicationSuperAdminPolicyRepository } from '../governance/application-super-admin-policy.repository';
import { LianruanCrmConnectionConfigService } from '../governance/lianruan-crm-connection-config.service';
import { OrganizationScopeService } from '../governance/organization-scope.service';
import { PermissionEnforcementService } from '../governance/permission-enforcement.service';
import { RolePermissionRepository } from '../governance/role-permission.repository';
import { WecomPilotPolicyRepository } from '../governance/wecom-pilot-policy.repository';
import { AnalysisSemanticKnowledgeRepository } from '../governance/analysis-semantic-knowledge.repository';
import { QuerySessionRepository } from '../sessions/query-session.repository';
import { SessionQueueService } from '../sessions/session-queue.service';
import { AiCapabilityPackRegistry } from './capability-packs/ai-capability-pack.registry';
import { AiCapabilityPackRuntimeService } from './capability-packs/ai-capability-pack.runtime';
import { AiCapabilityPackRolloutPolicy } from './capability-packs/runtime/pack-rollout.policy';
import { AiGatewayService } from './ai-gateway.service';
import { AnalysisChannelPresenterService } from './analysis-channel-presenter.service';
import { AnalysisDatasetAssemblerService } from './analysis-dataset-assembler.service';
import { AnalysisForecastService } from './analysis-forecast.service';
import { AnalysisInsightEvidenceService } from './analysis-insight-evidence.service';
import { AnalysisIntentService } from './analysis-intent.service';
import { AnalysisQueryExecutorService } from './analysis-query-executor.service';
import { AnalysisQueryKnowledgeService } from './analysis-query-knowledge.service';
import { AnalysisQueryPlannerService } from './analysis-query-planner.service';
import { AnalysisReadToolRegistryService } from './analysis-read-tool.registry';
import { AnalysisReportComposerService } from './analysis-report-composer.service';
import { AnalysisRequestRepository } from './analysis-request.repository';
import { AnalysisResponseMapper } from './analysis-response.mapper';
import { AnalysisRichReportService } from './analysis-rich-report.service';
import { AnalysisRouteConfigService } from './analysis-route-config.service';
import { AnalysisScopeModeService } from './analysis-scope-mode.service';
import { AnalysisService } from './analysis.service';
import { AnalysisWarehouseAnalysisExecutorService } from './analysis-warehouse-analysis-executor.service';
import { AnalysisWorkflowOrchestrator } from './analysis-workflow.orchestrator';
import { AnalysisWarehouseSqlGuardService } from '../analysis-warehouse/analysis-warehouse-sql-guard.service';
import { AnalysisWarehouseSqliteSnapshotImporterService } from '../analysis-warehouse/analysis-warehouse-sqlite-snapshot-importer.service';
import { BusinessAnalysisIntentMapperService } from './business-analysis-intent-mapper.service';
import { ClarificationService } from './clarification.service';
import { CrmAnalysisPresentationTemplateService } from './crm-analysis-presentation-template.service';
import { CrmSqliteReadonlyService } from './crm-sqlite-readonly.service';
import { CrmSqliteReadonlyAnalysisExecutorService } from './crm-sqlite-readonly-analysis-executor.service';
import { CrmSqliteReadonlySqlGuardService } from './crm-sqlite-readonly-sql-guard.service';
import { DataFreshnessService } from './data-freshness.service';
import { KnowledgeSedimentationService } from './knowledge-sedimentation.service';
import { LianruanCrmAnalysisExecutorService } from './lianruan-crm-analysis-executor.service';
import { OpenApiMarkdownSnapshotSchedulerService } from './openapi-markdown-snapshot-scheduler.service';
import { OpenApiMarkdownSnapshotService } from './openapi-markdown-snapshot.service';
import {
  PublicAnalysisAssetController,
  PublicAnalysisResultController,
  PublicWecomDashboardImageController,
} from './public-analysis-result.controller';
import { QueryAstValidatorService } from './query-ast-validator.service';
import { QueryCompilerService } from './query-compiler.service';
import { QueryPreflightService } from './query-preflight.service';
import { QueryRiskGuardService } from './query-risk-guard.service';
import { QueryScopeService } from './query-scope.service';
import { QueryWhitelistService } from './query-whitelist.service';
import { ResultConsistencyService } from './result-consistency.service';
import { ResultNormalizerService } from './result-normalizer.service';
import { ResultStreamerService } from './result-streamer.service';
import { RecentQueryRepository } from '../query-assets/recent-query.repository';
import { QueryTemplateRepository } from '../query-assets/query-template.repository';

@Module({
  imports: [DatabaseModule, AiModelsModule],
  controllers: [PublicAnalysisResultController, PublicAnalysisAssetController, PublicWecomDashboardImageController],
  providers: [
    AccessDecisionService,
    AccessPolicyRepository,
    AiCapabilityPackRegistry,
    AiCapabilityPackRolloutPolicy,
    AiCapabilityPackRuntimeService,
    AiContextPolicyRepository,
    AiContextPolicyService,
    AiGatewayService,
    AnalysisChannelPresenterService,
    AnalysisDatasetAssemblerService,
    AnalysisForecastService,
    AnalysisInsightEvidenceService,
    AnalysisIntentService,
    AnalysisLoggerService,
    AnalysisQueryExecutorService,
    AnalysisQueryKnowledgeService,
    AnalysisQueryPlannerService,
    AnalysisReadToolRegistryService,
    AnalysisReportComposerService,
    AnalysisRequestRepository,
    AnalysisResponseMapper,
    AnalysisRichReportService,
    AnalysisRouteConfigService,
    AnalysisScopeModeService,
    AnalysisSemanticKnowledgeRepository,
    AnalysisService,
    AnalysisWarehouseAnalysisExecutorService,
    AnalysisWorkflowOrchestrator,
    AnalysisWarehouseMysqlService,
    AnalysisWarehouseSqlGuardService,
    AnalysisWarehouseSqliteSnapshotImporterService,
    ApplicationSuperAdminPolicyRepository,
    AuditEventRepository,
    BusinessAnalysisIntentMapperService,
    ClarificationService,
    CrmAnalysisPresentationTemplateService,
    CrmReadonlyService,
    CrmSqliteReadonlyAnalysisExecutorService,
    CrmSqliteReadonlyService,
    CrmSqliteReadonlySqlGuardService,
    DataFreshnessService,
    KnowledgeSedimentationService,
    LianruanCrmAnalysisExecutorService,
    LianruanCrmConnectionConfigService,
    LianruanCrmFieldCapabilityRegistry,
    LianruanCrmOpenApiAdapterService,
    LianruanCrmOpenApiClient,
    LianruanCrmQueryAdapterService,
    LocalRuntimeConfigService,
    OpenApiMarkdownSnapshotSchedulerService,
    OpenApiMarkdownSnapshotService,
    OrganizationScopeService,
    PermissionEnforcementService,
    QueryAstValidatorService,
    QueryCompilerService,
    QueryPreflightService,
    QueryRiskGuardService,
    QueryScopeService,
    QuerySessionRepository,
    QueryTemplateRepository,
    RecentQueryRepository,
    ResultConsistencyService,
    ResultNormalizerService,
    ResultStreamerService,
    RolePermissionRepository,
    SessionQueueService,
    SqlAuditContextService,
    SqlAuditFileStore,
    SqlAuditRepository,
    SqlAuditService,
    UserScopeService,
    WecomPilotPolicyRepository,
    QueryWhitelistService,
  ],
  exports: [
    AiGatewayService,
    AiContextPolicyService,
    AnalysisChannelPresenterService,
    AnalysisLoggerService,
    AnalysisRequestRepository,
    AnalysisService,
    ClarificationService,
    CrmAnalysisPresentationTemplateService,
    LianruanCrmOpenApiAdapterService,
    LianruanCrmOpenApiClient,
    LianruanCrmQueryAdapterService,
  ],
})
export class AnalysisModule {}

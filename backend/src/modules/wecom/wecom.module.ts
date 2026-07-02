import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CrmReadonlyService } from '../../database/crm-readonly/crm-readonly.service';
import { LocalRuntimeConfigService } from '../../shared/config/local-runtime-config.service';
import { AnalysisModule } from '../analysis/analysis.module';
import { AuditEventRepository } from '../audit/audit-event.repository';
import { AuditEventBuilderService } from '../audit/audit-event-builder.service';
import { UserScopeService } from '../auth/user-scope.service';
import { AuthSessionRepository } from '../auth/auth-session.repository';
import { AccessDecisionService } from '../governance/access-decision.service';
import { OrganizationScopeService } from '../governance/organization-scope.service';
import { AccessPolicyRepository } from '../governance/access-policy.repository';
import { RolePermissionRepository } from '../governance/role-permission.repository';
import { WecomPilotPolicyRepository } from '../governance/wecom-pilot-policy.repository';
import { ApplicationSuperAdminPolicyRepository } from '../governance/application-super-admin-policy.repository';
import { PermissionEnforcementService } from '../governance/permission-enforcement.service';
import { DailyReportModule } from '../daily-report/daily-report.module';
import { NotificationModule } from '../notifications/notification.module';
import { DailyReportService } from '../daily-report/daily-report.service';
import { DashboardAnalyticsService } from '../crm-standard-api/dashboard-analytics.service';
import { DashboardReportComposer } from '../crm-standard-api/dashboard-report-composer.service';
import { CrmBuiltinAccountTokenService } from '../opportunities/crm-builtin-account-token.service';
import { CrmCustomerApiService } from '../opportunities/crm-customer-api.service';
import { CrmFollowUpWritebackService } from '../opportunities/crm-follow-up-writeback.service';
import { CrmOpportunityApiService } from '../opportunities/crm-opportunity-api.service';
import { CustomerLookupService } from '../opportunities/customer-lookup.service';
import { FollowUpAuthorizationService } from '../opportunities/follow-up-authorization.service';
import { FollowUpAuthorizationTargetService } from '../opportunities/follow-up-authorization-target.service';
import { OpportunityLookupService } from '../opportunities/opportunity-lookup.service';
import { QuerySessionRepository } from '../sessions/query-session.repository';
import { SessionHeartbeatService } from '../sessions/session-heartbeat.service';
import { WecomAiConversationOrchestrationService } from './wecom-ai-conversation-orchestration.service';
import { WecomAuthService } from './wecom-auth.service';
import { WecomBotController } from './wecom-bot.controller';
import { WecomBotService } from './wecom-bot.service';
import { WecomConversationContextRepository } from './wecom-conversation-context.repository';
import { CrmWecomIdentityRepository } from './crm-wecom-identity.repository';
import { WecomDirectorySyncController } from './wecom-directory-sync.controller';
import { WecomDirectorySyncService } from './wecom-directory-sync.service';
import { WecomDeliveryRecordRepository } from './wecom-delivery-record.repository';
import { FollowUpWritebackRepository } from './follow-up-writeback.repository';
import { WecomMessageAdapterService } from './wecom-message-adapter.service';
import { WecomMessageReceiptRepository } from './wecom-message-receipt.repository';
import { WecomMaintenanceDegradationService } from './wecom-maintenance-degradation.service';
import { WecomAnalysisTableImageService } from './wecom-analysis-table-image.service';
import { WecomDashboardCardBuilder } from './wecom-dashboard-card-builder.service';
import { WecomDashboardKpiSelectorService } from './wecom-dashboard-kpi-selector.service';
import { WecomDashboardMarkdownRendererService } from './wecom-dashboard-markdown-renderer.service';
import { WecomDashboardTemplateResolverService } from './wecom-dashboard-template-resolver.service';
import { WecomDailyReportIntakeService } from './wecom-daily-report-intake.service';
import { WecomEntityLookupService } from './wecom-entity-lookup.service';
import { WecomOfficialDirectoryClient } from './wecom-official-directory.client';
import { WecomSyncedDepartmentRepository } from './wecom-synced-department.repository';
import { WecomSyncedUserRepository } from './wecom-synced-user.repository';
import { WecomStreamDispatcherService } from './wecom-stream-dispatcher.service';
import { WecomSyncCheckpointRepository } from './wecom-sync-checkpoint.repository';
import { WecomSyncRunRepository } from './wecom-sync-run.repository';
import { WecomUserDeptChangeRepository } from './wecom-user-dept-change.repository';

@Module({
  imports: [DatabaseModule, AnalysisModule, DailyReportModule, NotificationModule],
  controllers: [WecomBotController, WecomDirectorySyncController],
  providers: [
    WecomAuthService,
    AccessPolicyRepository,
    RolePermissionRepository,
    WecomPilotPolicyRepository,
    ApplicationSuperAdminPolicyRepository,
    AccessDecisionService,
    OrganizationScopeService,
    PermissionEnforcementService,
    AuditEventRepository,
    AuditEventBuilderService,
    AuthSessionRepository,
    UserScopeService,
    LocalRuntimeConfigService,
    CrmReadonlyService,
    QuerySessionRepository,
    SessionHeartbeatService,
    DailyReportService,
    DashboardAnalyticsService,
    DashboardReportComposer,
    CrmBuiltinAccountTokenService,
    CrmCustomerApiService,
    CrmFollowUpWritebackService,
    CrmOpportunityApiService,
    CustomerLookupService,
    OpportunityLookupService,
    WecomConversationContextRepository,
    CrmWecomIdentityRepository,
    WecomAiConversationOrchestrationService,
    WecomMaintenanceDegradationService,
    WecomOfficialDirectoryClient,
    WecomDirectorySyncService,
    WecomMessageAdapterService,
    WecomMessageReceiptRepository,
    WecomDeliveryRecordRepository,
    FollowUpWritebackRepository,
    WecomSyncedDepartmentRepository,
    WecomSyncedUserRepository,
    WecomUserDeptChangeRepository,
    WecomSyncCheckpointRepository,
    WecomSyncRunRepository,
    FollowUpAuthorizationService,
    FollowUpAuthorizationTargetService,
    WecomDailyReportIntakeService,
    WecomEntityLookupService,
    WecomAnalysisTableImageService,
    WecomStreamDispatcherService,
    WecomDashboardCardBuilder,
    WecomDashboardTemplateResolverService,
    WecomDashboardKpiSelectorService,
    WecomDashboardMarkdownRendererService,
    WecomBotService,
  ],
  exports: [
    WecomAuthService,
    WecomConversationContextRepository,
    CrmWecomIdentityRepository,
    WecomAiConversationOrchestrationService,
    WecomMaintenanceDegradationService,
    WecomOfficialDirectoryClient,
    WecomDirectorySyncService,
    WecomMessageAdapterService,
    WecomMessageReceiptRepository,
    WecomDeliveryRecordRepository,
    FollowUpWritebackRepository,
    WecomSyncedDepartmentRepository,
    WecomSyncedUserRepository,
    WecomUserDeptChangeRepository,
    WecomSyncCheckpointRepository,
    WecomSyncRunRepository,
    FollowUpAuthorizationService,
    FollowUpAuthorizationTargetService,
    NotificationModule,
    WecomStreamDispatcherService,
    WecomDashboardCardBuilder,
    WecomDashboardTemplateResolverService,
    WecomDashboardKpiSelectorService,
    WecomDashboardMarkdownRendererService,
    WecomBotService,
  ],
})
export class WecomModule {}

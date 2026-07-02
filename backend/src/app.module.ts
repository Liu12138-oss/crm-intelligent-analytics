import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { AiModelsModule } from './modules/ai-models/ai-models.module';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { AnalysisController } from './modules/analysis/analysis.controller';
import { AuthController } from './modules/auth/auth.controller';
import { CoreAuditController } from './modules/audit/core-audit.controller';
import { AuthSessionRepository } from './modules/auth/auth-session.repository';
import { CrmAuthService } from './modules/auth/crm-auth.service';
import { CrmLoginIdentityApiService } from './modules/auth/crm-login-identity-api.service';
import { CrmPhoneConfirmationRepairService } from './modules/auth/crm-phone-confirmation-repair.service';
import { SessionAuthGuard } from './modules/auth/session-auth.guard';
import { UserScopeService } from './modules/auth/user-scope.service';
import { WecomLoginBindingRepository } from './modules/auth/wecom-login-binding.repository';
import { WecomWebLoginService } from './modules/auth/wecom-web-login.service';
import { AuditEventRepository } from './modules/audit/audit-event.repository';
import { AccessDecisionService } from './modules/governance/access-decision.service';
import { AccessPolicyRepository } from './modules/governance/access-policy.repository';
import { AiContextGovernanceController } from './modules/governance/ai-context-governance.controller';
import { AiModelGovernanceController } from './modules/governance/ai-model-governance.controller';
import { ApplicationSuperAdminPolicyRepository } from './modules/governance/application-super-admin-policy.repository';
import { IntegrationsGovernanceController } from './modules/governance/integrations-governance.controller';
import { IntegrationsGovernanceService } from './modules/governance/integrations-governance.service';
import { LianruanCrmConnectionConfigService } from './modules/governance/lianruan-crm-connection-config.service';
import { LianruanCrmDiagnosticsController } from './modules/governance/lianruan-crm-diagnostics.controller';
import { PermissionEnforcementService } from './modules/governance/permission-enforcement.service';
import { RolePermissionRepository } from './modules/governance/role-permission.repository';
import { WecomBotConnectionConfigService } from './modules/governance/wecom-bot-connection-config.service';
import { WecomPilotPolicyRepository } from './modules/governance/wecom-pilot-policy.repository';
import { LianruanCrmDiagnosticsService } from './modules/crm-standard-api/lianruan-crm-diagnostics.service';
import { LianruanCrmFieldCapabilityRegistry } from './modules/crm-standard-api/lianruan-crm-field-capability.registry';
import { LianruanCrmOpenApiAdapterService } from './modules/crm-standard-api/lianruan-crm-openapi.adapter.service';
import { LianruanCrmOpenApiClient } from './modules/crm-standard-api/lianruan-crm-openapi.client';
import { LianruanCrmQueryAdapterService } from './modules/crm-standard-api/lianruan-crm-query-adapter.service';
import { QuerySessionRepository } from './modules/sessions/query-session.repository';
import { SessionCapabilitiesService } from './modules/sessions/session-capabilities.service';
import { SessionHeartbeatService } from './modules/sessions/session-heartbeat.service';
import { WecomModule } from './modules/wecom/wecom.module';

@Module({
  imports: [DatabaseModule, AiModelsModule, AnalysisModule, WecomModule],
  controllers: [
    AnalysisController,
    AiContextGovernanceController,
    AiModelGovernanceController,
    IntegrationsGovernanceController,
    LianruanCrmDiagnosticsController,
    AuthController,
    CoreAuditController,
  ],
  providers: [
    SessionAuthGuard,
    UserScopeService,
    AuthSessionRepository,
    WecomLoginBindingRepository,
    CrmAuthService,
    CrmLoginIdentityApiService,
    CrmPhoneConfirmationRepairService,
    WecomWebLoginService,
    AuditEventRepository,
    AccessPolicyRepository,
    ApplicationSuperAdminPolicyRepository,
    RolePermissionRepository,
    WecomPilotPolicyRepository,
    WecomBotConnectionConfigService,
    LianruanCrmConnectionConfigService,
    LianruanCrmOpenApiClient,
    LianruanCrmOpenApiAdapterService,
    LianruanCrmQueryAdapterService,
    LianruanCrmDiagnosticsService,
    LianruanCrmFieldCapabilityRegistry,
    IntegrationsGovernanceService,
    AccessDecisionService,
    PermissionEnforcementService,
    QuerySessionRepository,
    SessionHeartbeatService,
    SessionCapabilitiesService,
  ],
})
export class AppModule {}

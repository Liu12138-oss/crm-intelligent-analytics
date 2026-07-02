import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AccessPolicyRepository } from '../governance/access-policy.repository';
import { AccessDecisionService } from '../governance/access-decision.service';
import { OrganizationScopeService } from '../governance/organization-scope.service';
import { RolePermissionRepository } from '../governance/role-permission.repository';
import { WecomPilotPolicyRepository } from '../governance/wecom-pilot-policy.repository';
import { ApplicationSuperAdminPolicyRepository } from '../governance/application-super-admin-policy.repository';
import { NotificationModule } from '../notifications/notification.module';
import { AuditEventRepository } from '../audit/audit-event.repository';
import { AuthSessionRepository } from '../auth/auth-session.repository';
import { CrmAuthService } from '../auth/crm-auth.service';
import { CrmLoginIdentityApiService } from '../auth/crm-login-identity-api.service';
import { CrmPhoneConfirmationRepairService } from '../auth/crm-phone-confirmation-repair.service';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { UserScopeService } from '../auth/user-scope.service';
import { WecomLoginBindingRepository } from '../auth/wecom-login-binding.repository';
import { CrmWecomIdentityRepository } from '../wecom/crm-wecom-identity.repository';
import { WecomAuthService } from '../wecom/wecom-auth.service';
import { DailyReportController } from './daily-report.controller';
import { DailyReportAssistanceEscalationService } from './daily-report-assistance-escalation.service';
import { DailyReportAssistanceRepository } from './daily-report-assistance.repository';
import { DailyReportDeliveryPolicyRepository } from './daily-report-delivery-policy.repository';
import { DailyReportDeliveryRoutingService } from './daily-report-delivery-routing.service';
import { DailyReportDispatcherService } from './daily-report-dispatcher.service';
import { DailyReportRepository } from './daily-report.repository';
import { DailyReportSchedulerService } from './daily-report-scheduler.service';
import { DailyReportService } from './daily-report.service';
import { SalesLeaderMappingService } from './sales-leader-mapping.service';

@Module({
  imports: [DatabaseModule, NotificationModule],
  controllers: [DailyReportController],
  providers: [
    DailyReportRepository,
    DailyReportAssistanceRepository,
    DailyReportDeliveryPolicyRepository,
    DailyReportDeliveryRoutingService,
    DailyReportDispatcherService,
    DailyReportAssistanceEscalationService,
    SalesLeaderMappingService,
    DailyReportService,
    DailyReportSchedulerService,
    SessionAuthGuard,
    CrmAuthService,
    CrmLoginIdentityApiService,
    CrmPhoneConfirmationRepairService,
    AuthSessionRepository,
    WecomLoginBindingRepository,
    CrmWecomIdentityRepository,
    WecomAuthService,
    AccessPolicyRepository,
    RolePermissionRepository,
    WecomPilotPolicyRepository,
    ApplicationSuperAdminPolicyRepository,
    AccessDecisionService,
    OrganizationScopeService,
    AuditEventRepository,
    UserScopeService,
  ],
  exports: [
    DailyReportRepository,
    DailyReportAssistanceRepository,
    DailyReportDeliveryPolicyRepository,
    DailyReportDeliveryRoutingService,
    DailyReportDispatcherService,
    DailyReportAssistanceEscalationService,
    SalesLeaderMappingService,
    DailyReportService,
    DailyReportSchedulerService,
  ],
})
export class DailyReportModule {}

import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { GovernanceService } from './governance.service';

@Controller('governance/policies')
@UseGuards(SessionAuthGuard)
export class GovernanceController {
  constructor(private readonly governanceService: GovernanceService) {}

  @Get('current')
  getCurrentPolicy(@Req() request: Request & { crmUser: any }) {
    const policy = this.governanceService.getCurrent(request.crmUser);
    return {
      policyId: policy.id,
      enabledRoleIds: policy.enabledRoleIds,
      exportRoleIds: policy.exportRoleIds,
      enabledChannels: policy.enabledChannels,
      allowedDomains: policy.allowedDomains,
      allowedTables: policy.allowedTables,
      allowedFields: policy.allowedFields,
      maskedFields: policy.maskedFields,
      exportRowLimit: policy.exportRowLimit,
      exportDailyLimit: policy.exportDailyLimit,
      maxOnlineSessions: policy.maxOnlineSessions,
      maxConcurrentQueries: policy.maxConcurrentQueries,
      heartbeatIntervalSeconds: policy.heartbeatIntervalSeconds,
      idleTimeoutSeconds: policy.idleTimeoutSeconds,
      historyRetentionDays: policy.historyRetentionDays,
      status: policy.status,
      updatedAt: policy.updatedAt,
    };
  }

  @Put('current')
  updateCurrentPolicy(
    @Req() request: Request & { crmUser: any },
    @Body() body: Record<string, any>,
  ) {
    const policy = this.governanceService.updateCurrent(request.crmUser, body);
    return {
      policyId: policy.id,
      enabledRoleIds: policy.enabledRoleIds,
      exportRoleIds: policy.exportRoleIds,
      enabledChannels: policy.enabledChannels,
      allowedDomains: policy.allowedDomains,
      allowedTables: policy.allowedTables,
      allowedFields: policy.allowedFields,
      maskedFields: policy.maskedFields,
      exportRowLimit: policy.exportRowLimit,
      exportDailyLimit: policy.exportDailyLimit,
      maxOnlineSessions: policy.maxOnlineSessions,
      maxConcurrentQueries: policy.maxConcurrentQueries,
      heartbeatIntervalSeconds: policy.heartbeatIntervalSeconds,
      idleTimeoutSeconds: policy.idleTimeoutSeconds,
      historyRetentionDays: policy.historyRetentionDays,
      status: policy.status,
      updatedAt: policy.updatedAt,
    };
  }
}

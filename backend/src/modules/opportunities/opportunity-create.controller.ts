import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { PermissionEnforcementService } from '../governance/permission-enforcement.service';
import { createOpportunityRequestSchema } from './crm-create.schemas';
import { CrmOpportunityApiService } from './crm-opportunity-api.service';

@Controller('crm/opportunities')
@UseGuards(SessionAuthGuard)
export class OpportunityCreateController {
  constructor(
    private readonly crmOpportunityApiService: CrmOpportunityApiService,
    private readonly analysisLoggerService: AnalysisLoggerService,
    private readonly permissionEnforcementService: PermissionEnforcementService,
  ) {}

  @Post()
  async createOpportunity(
    @Req()
    request: Request & {
      crmUser: any;
      authSession?: { crmAccessToken?: string };
    },
    @Body() body: unknown,
  ) {
    this.permissionEnforcementService.ensureAction(
      request.crmUser,
      'wecom.opportunity.create',
      '当前用户无权新增商机。',
      {
        channel: 'web-console',
        resourceType: 'crm-opportunity',
      },
    );
    const parsed = createOpportunityRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues.map((issue) => issue.message).join('；'),
      );
    }

    this.analysisLoggerService.logStep('新增商机接口已接收请求', {
      requesterId: request.crmUser?.id,
      requesterName: request.crmUser?.name,
      path: '/api/v1/crm/opportunities',
      title: parsed.data.title,
      customerId: parsed.data.customerId,
      productCount: parsed.data.productAssets.length,
    });

    return await this.crmOpportunityApiService.createOpportunity(
      request.crmUser,
      parsed.data,
      {
        accessToken: request.authSession?.crmAccessToken,
      },
    );
  }
}

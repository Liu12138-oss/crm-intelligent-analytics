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
import { createCustomerRequestSchema } from './crm-create.schemas';
import { CrmCustomerApiService } from './crm-customer-api.service';

@Controller('crm/customers')
@UseGuards(SessionAuthGuard)
export class CustomerCreateController {
  constructor(
    private readonly crmCustomerApiService: CrmCustomerApiService,
    private readonly analysisLoggerService: AnalysisLoggerService,
    private readonly permissionEnforcementService: PermissionEnforcementService,
  ) {}

  @Post()
  async createCustomer(
    @Req()
    request: Request & {
      crmUser: any;
      authSession?: { crmAccessToken?: string };
    },
    @Body() body: unknown,
  ) {
    this.permissionEnforcementService.ensureAction(
      request.crmUser,
      'wecom.customer.create',
      '当前用户无权新增客户。',
      {
        channel: 'web-console',
        resourceType: 'crm-customer',
      },
    );
    const parsed = createCustomerRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues.map((issue) => issue.message).join('；'),
      );
    }

    this.analysisLoggerService.logStep('新增客户接口已接收请求', {
      requesterId: request.crmUser?.id,
      requesterName: request.crmUser?.name,
      path: '/api/v1/crm/customers',
      customerName: parsed.data.name,
      hasExplicitOwner: Boolean(parsed.data.ownerUserId),
      hasExplicitDepartment: Boolean(parsed.data.wantDepartmentId),
    });

    return await this.crmCustomerApiService.createCustomer(
      request.crmUser,
      parsed.data,
      {
        accessToken: request.authSession?.crmAccessToken,
      },
    );
  }
}

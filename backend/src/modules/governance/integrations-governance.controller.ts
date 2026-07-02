import { Body, Controller, Get, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { CrmUser } from '../../shared/types/domain';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { IntegrationsGovernanceService } from './integrations-governance.service';

@Controller('governance/integrations')
@UseGuards(SessionAuthGuard)
export class IntegrationsGovernanceController {
  constructor(
    private readonly integrationsGovernanceService: IntegrationsGovernanceService,
  ) {}

  @Get('status')
  getStatus(@Req() request: Request & { crmUser: CrmUser }) {
    return this.integrationsGovernanceService.getStatus(request.crmUser);
  }

  @Get('wecom')
  getWecomConfig(@Req() request: Request & { crmUser: CrmUser }) {
    return this.integrationsGovernanceService.getWecomConfig(request.crmUser);
  }

  @Put('wecom')
  updateWecomConfig(
    @Req() request: Request & { crmUser: CrmUser },
    @Body() body: Record<string, unknown>,
  ) {
    return this.integrationsGovernanceService.updateWecomConfig(
      request.crmUser,
      body,
    );
  }

  @Post('wecom/test')
  async testWecomConfig(
    @Req() request: Request & { crmUser: CrmUser },
    @Body() body: Record<string, unknown>,
  ) {
    return await this.integrationsGovernanceService.testWecomConfig(
      request.crmUser,
      Object.keys(body ?? {}).length > 0 ? body : undefined,
    );
  }

  @Get('crm-openapi')
  getCrmOpenApiConfig(@Req() request: Request & { crmUser: CrmUser }) {
    return this.integrationsGovernanceService.getCrmOpenApiConfig(
      request.crmUser,
    );
  }

  @Put('crm-openapi')
  updateCrmOpenApiConfig(
    @Req() request: Request & { crmUser: CrmUser },
    @Body() body: Record<string, unknown>,
  ) {
    return this.integrationsGovernanceService.updateCrmOpenApiConfig(
      request.crmUser,
      body,
    );
  }

  @Post('crm-openapi/test')
  async testCrmOpenApiConfig(
    @Req() request: Request & { crmUser: CrmUser },
    @Body() body: Record<string, unknown>,
  ) {
    return await this.integrationsGovernanceService.testCrmOpenApiConfig(
      request.crmUser,
      Object.keys(body ?? {}).length > 0 ? body : undefined,
    );
  }

  @Get('crm-openapi/diagnostics')
  async getCrmOpenApiDiagnostics(
    @Req() request: Request & { crmUser: CrmUser },
  ) {
    return await this.integrationsGovernanceService.getCrmOpenApiDiagnostics(
      request.crmUser,
    );
  }

  @Get('identity-mappings')
  listIdentityMappings(
    @Req() request: Request & { crmUser: CrmUser },
    @Query('wecomUserId') wecomUserId?: string,
  ) {
    return this.integrationsGovernanceService.listIdentityMappings(
      request.crmUser,
      { wecomUserId },
    );
  }

  @Post('identity-mappings')
  upsertIdentityMapping(
    @Req() request: Request & { crmUser: CrmUser },
    @Body() body: {
      wecomUserId: string;
      wecomUserName?: string;
      crmUserId: string;
      departmentIds?: string[];
    },
  ) {
    return this.integrationsGovernanceService.upsertIdentityMapping(
      request.crmUser,
      body,
    );
  }

  @Get('pilot-policy')
  getPilotPolicy(@Req() request: Request & { crmUser: CrmUser }) {
    return this.integrationsGovernanceService.getPilotPolicy(request.crmUser);
  }

  @Put('pilot-policy')
  updatePilotPolicy(
    @Req() request: Request & { crmUser: CrmUser },
    @Body() body: Record<string, unknown>,
  ) {
    return this.integrationsGovernanceService.updatePilotPolicy(
      request.crmUser,
      body,
    );
  }

  @Get('audit-events')
  listAuditEvents(
    @Req() request: Request & { crmUser: CrmUser },
    @Query('eventType') eventType?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.integrationsGovernanceService.listAuditEvents(request.crmUser, {
      eventType,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  }
}

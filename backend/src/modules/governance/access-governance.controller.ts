import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AccessGovernanceService } from './access-governance.service';

@Controller('governance')
@UseGuards(SessionAuthGuard)
export class AccessGovernanceController {
  constructor(private readonly accessGovernanceService: AccessGovernanceService) {}

  @Get('permissions/overview')
  getOverview(@Req() request: Request & { crmUser: any }) {
    return this.accessGovernanceService.getOverview(request.crmUser);
  }

  @Get('analysis-scope-policy')
  getAnalysisScopePolicy(@Req() request: Request & { crmUser: any }) {
    return this.accessGovernanceService.getAnalysisScopePolicy(request.crmUser);
  }

  @Get('application-super-admin-policy')
  getApplicationSuperAdminPolicy(@Req() request: Request & { crmUser: any }) {
    return this.accessGovernanceService.getApplicationSuperAdminPolicy(request.crmUser);
  }

  @Put('analysis-scope-policy')
  updateAnalysisScopePolicy(
    @Req() request: Request & { crmUser: any },
    @Body() body: Record<string, unknown>,
  ) {
    return this.accessGovernanceService.updateAnalysisScopePolicy(
      request.crmUser,
      body,
    );
  }

  @Get('role-permissions')
  listRolePermissions(
    @Req() request: Request & { crmUser: any },
    @Query('keyword') keyword?: string,
    @Query('status') status?: 'ACTIVE' | 'INACTIVE',
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '10',
  ) {
    return this.accessGovernanceService.listRolePermissions(request.crmUser, {
      keyword,
      status,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  }

  @Get('access-options')
  getAccessOptions(@Req() request: Request & { crmUser: any }) {
    return this.accessGovernanceService.getAccessOptions(request.crmUser);
  }

  @Get('wecom-organization-subjects')
  getWecomOrganizationSubjects(@Req() request: Request & { crmUser: any }) {
    return this.accessGovernanceService.getWecomOrganizationSubjects(request.crmUser);
  }

  @Put('role-permissions/:roleId')
  updateRolePermission(
    @Req() request: Request & { crmUser: any },
    @Param('roleId') roleId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.accessGovernanceService.updateRolePermission(
      request.crmUser,
      roleId,
      body,
    );
  }

  @Get('channels/wecom-bot/pilot-policy')
  getWecomPilotPolicy(@Req() request: Request & { crmUser: any }) {
    return this.accessGovernanceService.getWecomPilotPolicy(request.crmUser);
  }

  @Put('channels/wecom-bot/pilot-policy')
  updateWecomPilotPolicy(
    @Req() request: Request & { crmUser: any },
    @Body() body: Record<string, unknown>,
  ) {
    return this.accessGovernanceService.updateWecomPilotPolicy(
      request.crmUser,
      body,
    );
  }

  @Post('access-preview')
  @HttpCode(200)
  previewAccess(
    @Req() request: Request & { crmUser: any },
    @Body() body: Record<string, unknown>,
  ) {
    return this.accessGovernanceService.previewAccess(request.crmUser, body);
  }

  @Get('identity-mappings')
  listIdentityMappings(
    @Req() request: Request & { crmUser: any },
    @Query('wecomUserId') wecomUserId?: string,
  ) {
    return this.accessGovernanceService.listIdentityMappings(request.crmUser, {
      wecomUserId,
    });
  }

  @Get('data-scope-grants')
  listDataScopeGrants(@Req() request: Request & { crmUser: any }) {
    return this.accessGovernanceService.listDataScopeGrants(request.crmUser);
  }

  @Put('data-scope-grants/:grantId')
  updateDataScopeGrant(
    @Req() request: Request & { crmUser: any },
    @Param('grantId') grantId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.accessGovernanceService.updateDataScopeGrant(
      request.crmUser,
      grantId,
      body,
    );
  }

  @Post('data-scope-preview')
  @HttpCode(200)
  previewDataScope(
    @Req() request: Request & { crmUser: any },
    @Body() body: Record<string, unknown>,
  ) {
    return this.accessGovernanceService.previewDataScope(request.crmUser, body);
  }

  @Get('daily-report-delivery/departments')
  listDailyReportDepartments(@Req() request: Request & { crmUser: any }) {
    return this.accessGovernanceService.listDailyReportDepartments(
      request.crmUser,
    );
  }

  @Put('daily-report-delivery/departments/:departmentId')
  updateDailyReportDepartmentPolicy(
    @Req() request: Request & { crmUser: any },
    @Param('departmentId') departmentId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.accessGovernanceService.updateDailyReportDepartmentPolicy(
      request.crmUser,
      departmentId,
      body,
    );
  }

  @Delete('daily-report-delivery/departments/:departmentId')
  deleteDailyReportDepartmentPolicy(
    @Req() request: Request & { crmUser: any },
    @Param('departmentId') departmentId: string,
  ) {
    return this.accessGovernanceService.deleteDailyReportDepartmentPolicy(
      request.crmUser,
      departmentId,
    );
  }

  @Put('application-super-admin-policy')
  updateApplicationSuperAdminPolicy(
    @Req() request: Request & { crmUser: any },
    @Body() body: Record<string, unknown>,
  ) {
    return this.accessGovernanceService.updateApplicationSuperAdminPolicy(
      request.crmUser,
      body,
    );
  }

  @Post('daily-report-delivery/groups')
  createDailyReportSalesGroup(
    @Req() request: Request & { crmUser: any },
    @Body() body: Record<string, unknown>,
  ) {
    return this.accessGovernanceService.createDailyReportSalesGroup(
      request.crmUser,
      body,
    );
  }

  @Put('daily-report-delivery/groups/:groupId')
  updateDailyReportSalesGroup(
    @Req() request: Request & { crmUser: any },
    @Param('groupId') groupId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.accessGovernanceService.updateDailyReportSalesGroup(
      request.crmUser,
      groupId,
      body,
    );
  }

  @Delete('daily-report-delivery/groups/:groupId')
  deleteDailyReportSalesGroup(
    @Req() request: Request & { crmUser: any },
    @Param('groupId') groupId: string,
  ) {
    return this.accessGovernanceService.deleteDailyReportSalesGroup(
      request.crmUser,
      groupId,
    );
  }

  @Post('daily-report-delivery/preview')
  @HttpCode(200)
  previewDailyReportDelivery(
    @Req() request: Request & { crmUser: any },
    @Body() body: Record<string, unknown>,
  ) {
    return this.accessGovernanceService.previewDailyReportDelivery(
      request.crmUser,
      body,
    );
  }
}

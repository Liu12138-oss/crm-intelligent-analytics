import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { ManagementReportService } from './management-report.service';
import type {
  ManagementReportExportRequest,
  ManagementReportFilterInput,
  ManagementReportSectionKey,
  ManagementReportSectionRequest,
} from './management-report.types';

/**
 * 经营报表控制器统一暴露初始化、快照、专题详情和导出接口。
 */
@Controller('management-report')
@UseGuards(SessionAuthGuard)
export class ManagementReportController {
  constructor(
    private readonly managementReportService: ManagementReportService,
  ) {}

  /**
   * 获取经营报表初始化选项。
   */
  @Get('options')
  async getOptions(@Req() request: Request & { crmUser: any }) {
    return this.managementReportService.getOptions(request.crmUser);
  }

  /**
   * 生成经营报表核心快照。
   */
  @Post('snapshot')
  async createSnapshot(
    @Req() request: Request & { crmUser: any },
    @Body() body: ManagementReportFilterInput,
  ) {
    return this.managementReportService.createSnapshot(request.crmUser, body);
  }

  /**
   * 加载经营报表专题详情。
   */
  @Post('sections/:sectionKey')
  async getSection(
    @Req() request: Request & { crmUser: any },
    @Param('sectionKey') sectionKey: ManagementReportSectionKey,
    @Body() body: ManagementReportSectionRequest,
  ) {
    return this.managementReportService.getSectionDetail(
      request.crmUser,
      sectionKey,
      body,
    );
  }

  /**
   * 导出经营报表当前上下文。
   */
  @Post('export')
  async exportReport(
    @Req() request: Request & { crmUser: any },
    @Body() body: ManagementReportExportRequest,
  ) {
    return this.managementReportService.exportReport(request.crmUser, body);
  }
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { DailyReportService } from './daily-report.service';

@Controller('daily-reports')
@UseGuards(SessionAuthGuard)
export class DailyReportController {
  constructor(private readonly dailyReportService: DailyReportService) {}

  @Post('fragments')
  recordFragment(
    @Req() request: Request & { crmUser: any },
    @Body()
    body: {
      fragmentType: string;
      content: string;
      businessDate?: string;
      supervisorId?: string;
      supervisorName?: string;
      sourceLabel?: string;
      sourceInterface?: '/api/v2/opportunities' | '/api/v2/revisit_logs' | 'manual';
      sourceObjectId?: string;
      sourceOperatorId?: string;
      sourceOperatorName?: string;
      sourceCode?: number;
      capturedAt?: string;
    },
  ) {
    return this.dailyReportService.recordFragment(request.crmUser, {
      fragmentType: body.fragmentType as any,
      content: body.content,
      businessDate: body.businessDate,
      supervisorId: body.supervisorId,
      supervisorName: body.supervisorName,
      sourceLabel: body.sourceLabel,
      sourceInterface: body.sourceInterface,
      sourceObjectId: body.sourceObjectId,
      sourceOperatorId: body.sourceOperatorId,
      sourceOperatorName: body.sourceOperatorName,
      sourceCode: body.sourceCode,
      capturedAt: body.capturedAt,
    });
  }

  @Get()
  listReports(
    @Req() request: Request & { crmUser: any },
    @Query('businessDate') businessDate?: string,
    @Query('status') status?: string,
    @Query('requesterId') requesterId?: string,
  ) {
    return this.dailyReportService.listReports(request.crmUser, {
      businessDate,
      status: status as any,
      requesterId,
    });
  }

  @Get('audit')
  listAuditSnapshot(
    @Req() request: Request & { crmUser: any },
    @Query('businessDate') businessDate?: string,
    @Query('status') status?: string,
  ) {
    return this.dailyReportService.getAuditSnapshot(request.crmUser, {
      businessDate,
      status: status as any,
    });
  }

  @Get('summary-batches')
  listSummaryBatches(@Req() request: Request & { crmUser: any }) {
    return this.dailyReportService.listSummaryBatches(request.crmUser);
  }

  @Post('cron/reminders')
  @HttpCode(200)
  async runReminderSweep(
    @Req() request: Request & { crmUser: any },
    @Body() body: { businessDate: string; sentAt?: string },
  ) {
    return await this.dailyReportService.runReminderSweep(
      request.crmUser,
      body.businessDate,
      body.sentAt,
    );
  }

  @Post('cron/close')
  @HttpCode(200)
  runClosureSweep(
    @Req() request: Request & { crmUser: any },
    @Body() body: { businessDate: string; closedAt?: string },
  ) {
    return this.dailyReportService.runClosureSweep(
      request.crmUser,
      body.businessDate,
      body.closedAt,
    );
  }

  @Post('cron/summaries')
  @HttpCode(200)
  async runSummarySweep(
    @Req() request: Request & { crmUser: any },
    @Body()
    body: {
      businessDate: string;
      recipientIds?: string[];
      generatedAt?: string;
    },
  ) {
    return await this.dailyReportService.runSummarySweep(
      request.crmUser,
      body.businessDate,
      body.recipientIds,
      body.generatedAt,
    );
  }

  @Get(':reportId')
  getReport(
    @Req() request: Request & { crmUser: any },
    @Param('reportId') reportId: string,
  ) {
    return this.dailyReportService.getReport(request.crmUser, reportId);
  }

  @Post(':reportId/confirm')
  async confirmReport(
    @Req() request: Request & { crmUser: any },
    @Param('reportId') reportId: string,
    @Body() body: { confirmedAt?: string },
  ) {
    return await this.dailyReportService.confirmReport(
      request.crmUser,
      reportId,
      body.confirmedAt,
    );
  }
}

import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { ExportService } from './export.service';

@Controller('analysis/queries')
@UseGuards(SessionAuthGuard)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Post(':queryId/exports')
  createExport(
    @Req() request: Request & { crmUser: any },
    @Param('queryId') queryId: string,
    @Body() body: Record<string, any>,
  ) {
    return this.exportService.createExport(
      request.crmUser,
      queryId,
      body.format ?? 'xlsx',
    );
  }
}

import { Module } from '@nestjs/common';
import { ManagementReportComposerService } from './management-report-composer.service';
import { ManagementReportController } from './management-report.controller';
import { ManagementReportQueryService } from './management-report-query.service';
import { ManagementReportService } from './management-report.service';

/**
 * 经营报表模块文件用于沉淀模块边界，实际运行时仍由根模块统一装配。
 */
@Module({
  controllers: [ManagementReportController],
  providers: [
    ManagementReportService,
    ManagementReportQueryService,
    ManagementReportComposerService,
  ],
})
export class ManagementReportModule {}

import { BadRequestException, Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { CrmOpportunityApiService } from './crm-opportunity-api.service';

@Controller('api/v2/opportunities')
@UseGuards(SessionAuthGuard)
export class OpportunityLookupController {
  constructor(
    private readonly opportunityLookupService: CrmOpportunityApiService,
    private readonly analysisLoggerService: AnalysisLoggerService,
  ) {}

  @Get('by_name')
  async listOpportunitiesByName(
    @Req() request: Request & { crmUser: any },
    @Query('query') query?: string,
    @Query('companyName') companyName?: string,
    @Query('q') q?: string,
    @Query('custom_field_name') customFieldName?: string,
    @Query('limit') limit?: string,
  ) {
    const searchText = (query ?? companyName ?? q ?? '').trim();
    if (!searchText) {
      throw new BadRequestException('请输入公司名称。');
    }

    this.analysisLoggerService.logStep('商机名称查询接口已接收。', {
      requesterId: request.crmUser?.id,
      requesterName: request.crmUser?.name,
      path: '/api/v2/opportunities/by_name',
      query: searchText,
      customFieldName: customFieldName?.trim() ?? 'title',
      limit: limit ? Number(limit) : 5,
      tokenPresent: Boolean((request as Request & { authSession?: { crmAccessToken?: string } }).authSession?.crmAccessToken),
    });

    const result = await this.opportunityLookupService.lookupByCompanyName(
      request.crmUser,
      searchText,
      {
        limit: limit ? Number(limit) : 5,
        customFieldName: customFieldName?.trim(),
        accessToken: (request as Request & { authSession?: { crmAccessToken?: string } }).authSession?.crmAccessToken,
      },
    );

    this.analysisLoggerService.logStep('商机名称查询接口准备返回。', {
      requesterId: request.crmUser?.id,
      searchKey: result.companyName,
      customFieldName: result.customFieldName,
      totalCount: result.totalCount,
      limit: result.limit,
      preview: result.records.slice(0, 3).map((item) => ({
        id: item.id,
        title: item.title,
        customerName: item.customerName,
        ownerName: item.ownerName,
        stage: item.stage,
        expectAmount: item.expectAmount,
      })),
    });

    return result;
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AnalysisService } from '../analysis/analysis.service';
import { RecentQueryService } from './recent-query.service';

@Controller('analysis/histories')
@UseGuards(SessionAuthGuard)
export class RecentQueryController {
  constructor(
    private readonly recentQueryService: RecentQueryService,
    private readonly analysisService: AnalysisService,
  ) {}

  @Get()
  listRecentQueries(
    @Req() request: Request & { crmUser: any },
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '10',
  ) {
    const result = this.recentQueryService.listByUser(
      request.crmUser,
      Number(page),
      Number(pageSize),
    );

    return {
      ...result,
      items: result.items.map((item) => ({
        historyId: item.id,
        sourceType: item.sourceType,
        templateId: item.templateId,
        templateVersion: item.templateVersion,
        questionText: item.questionText,
        lastUsedChannel: item.lastUsedChannel,
        parameterSnapshot: item.parameterSnapshot,
        renderSnapshot: item.renderSnapshot,
        resultSummary: item.resultSummary,
        lastTemporalScope: item.lastTemporalScope,
        analysisRoute: item.analysisRoute,
        executionMode: item.executionMode,
        executionSource: item.executionSource,
        matchedAdapter: item.matchedAdapter,
        gapReason: item.gapReason,
        status: item.status,
        lastUsedAt: item.lastUsedAt,
      })),
    };
  }

  @Post(':historyId/rerun')
  async rerunRecentQuery(
    @Req() request: Request & { crmUser: any },
    @Param('historyId') historyId: string,
    @Body() body: Record<string, any>,
  ) {
    const history = this.recentQueryService.getOwnedHistory(request.crmUser, historyId);
    return await this.analysisService.createQuery(request.crmUser, {
      querySource: 'RECENT_RERUN',
      channel: body.channel ?? 'web-console',
      historyId,
      questionText: body.overrideQuestionText,
      sessionId: body.sessionId,
      analysisRoute: body.analysisRoute ?? history.analysisRoute,
    });
  }
}

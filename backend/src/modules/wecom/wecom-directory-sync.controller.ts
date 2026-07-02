import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { WecomDirectorySyncService } from './wecom-directory-sync.service';

@Controller('internal/wecom-directory-sync')
export class WecomDirectorySyncController {
  constructor(
    private readonly wecomDirectorySyncService: WecomDirectorySyncService,
  ) {}

  @Post('run')
  @HttpCode(202)
  async runSync(
    @Body()
    body: {
      resourceType?: 'department' | 'user' | 'all';
    },
  ) {
    const resourceType = body.resourceType ?? 'all';
    if (resourceType === 'all') {
      const result = await this.wecomDirectorySyncService.runAllSync();
      return {
        accepted: true,
        resourceType,
        runs: result.runs,
      };
    }

    const run = await this.wecomDirectorySyncService.runSync(resourceType);
    return {
      accepted: true,
      resourceType,
      runId: run.id,
      status: run.status,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      itemCount: run.itemCount,
      pageCount: run.pageCount,
      latestCursor: run.toCursor,
      failureReason: run.failureReason,
      wxUserUpsertedCount: run.wxUserUpsertedCount,
      wxUserMapCreatedCount: run.wxUserMapCreatedCount,
      wxUserMapUpdatedCount: run.wxUserMapUpdatedCount,
      missingContactCount: run.missingContactCount,
      unmatchedCount: run.unmatchedCount,
      conflictCount: run.conflictCount,
    };
  }

  @Get('status')
  async getStatus(@Query('userid') userid?: string) {
    return this.wecomDirectorySyncService.getSyncStatus(userid);
  }
}

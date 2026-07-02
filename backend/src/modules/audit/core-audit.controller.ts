import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AuditEventRepository } from './audit-event.repository';

@Controller('audit-events')
@UseGuards(SessionAuthGuard)
export class CoreAuditController {
  constructor(private readonly auditEventRepository: AuditEventRepository) {}

  /**
   * 查询核心模式保留的最小审计事件。
   *
   * 参数说明：支持按操作者、事件类型和分页查询。
   * 返回值说明：管理员可查看全部记录，普通用户只查看自己的记录。
   * 调用注意事项：该接口只用于 AI 配置等核心治理留痕，不代表恢复审计中心页面。
   */
  @Get()
  listAuditEvents(
    @Req() request: Request & { crmUser: any },
    @Query('actorId') actorId?: string,
    @Query('eventType') eventType?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    const currentPage = Math.max(Number(page) || 1, 1);
    const currentPageSize = Math.min(Math.max(Number(pageSize) || 20, 1), 200);
    const start = (currentPage - 1) * currentPageSize;
    const events = this.auditEventRepository
      .list()
      .filter((item) => (request.crmUser.isAdmin ? true : item.actorId === request.crmUser.id))
      .filter((item) => (actorId ? item.actorId === actorId : true))
      .filter((item) => (eventType ? item.eventType === eventType : true));

    return {
      summary: {
        totalCount: events.length,
        aiGovernanceCount: events.filter((item) => item.eventType.startsWith('AI_')).length,
      },
      items: events.slice(start, start + currentPageSize),
      page: currentPage,
      pageSize: currentPageSize,
      total: events.length,
    };
  }
}

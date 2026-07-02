import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { CrmUser, RecentQueryRecord } from '../../shared/types/domain';
import { RecentQueryRepository } from './recent-query.repository';

@Injectable()
export class RecentQueryService {
  constructor(private readonly recentQueryRepository: RecentQueryRepository) {}

  listByUser(user: CrmUser, page: number, pageSize: number): {
    items: RecentQueryRecord[];
    page: number;
    pageSize: number;
    total: number;
  } {
    const list = this.recentQueryRepository.listByRequesterId(user.id);
    const start = (page - 1) * pageSize;

    return {
      items: list.slice(start, start + pageSize),
      page,
      pageSize,
      total: list.length,
    };
  }

  getOwnedHistory(user: CrmUser, historyId: string): RecentQueryRecord {
    const history = this.recentQueryRepository.findById(historyId);
    if (!history) {
      throw new NotFoundException('最近查询记录不存在。');
    }

    if (history.requesterId !== user.id) {
      throw new ForbiddenException('当前用户无权访问该最近查询记录。');
    }

    return history;
  }
}

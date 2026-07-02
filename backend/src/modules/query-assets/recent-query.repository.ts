import { Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type { RecentQueryRecord } from '../../shared/types/domain';

@Injectable()
export class RecentQueryRepository {
  constructor(private readonly appStorage: AppStorageService) {}

  listByRequesterId(requesterId: string): RecentQueryRecord[] {
    return this.appStorage.state.recentQueries
      .filter((item) => item.requesterId === requesterId)
      .sort((left, right) => right.lastUsedAt.localeCompare(left.lastUsedAt));
  }

  findById(historyId: string): RecentQueryRecord | undefined {
    return this.appStorage.state.recentQueries.find((item) => item.id === historyId);
  }

  save(record: RecentQueryRecord): RecentQueryRecord {
    const currentIndex = this.appStorage.state.recentQueries.findIndex(
      (item) => item.id === record.id,
    );

    if (currentIndex >= 0) {
      this.appStorage.state.recentQueries[currentIndex] = record;
      return record;
    }

    this.appStorage.state.recentQueries.unshift(record);
    return record;
  }
}

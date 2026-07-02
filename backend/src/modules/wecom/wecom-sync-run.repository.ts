import { Inject, Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type { WecomSyncRunRecord } from '../../shared/types/domain';

@Injectable()
export class WecomSyncRunRepository {
  constructor(
    @Inject(AppStorageService)
    private readonly appStorage: AppStorageService,
  ) {}

  save(record: WecomSyncRunRecord): WecomSyncRunRecord {
    const currentIndex = this.appStorage.state.wecomSyncRuns.findIndex(
      (item) => item.id === record.id,
    );

    if (currentIndex >= 0) {
      this.appStorage.state.wecomSyncRuns[currentIndex] = record;
      return record;
    }

    this.appStorage.state.wecomSyncRuns.unshift(record);
    return record;
  }

  list(): WecomSyncRunRecord[] {
    return [...this.appStorage.state.wecomSyncRuns];
  }
}

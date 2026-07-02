import { Inject, Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type { ProactiveNotificationTaskRecord } from '../../shared/types/domain';

@Injectable()
export class ProactiveNotificationRepository {
  constructor(
    @Inject(AppStorageService)
    private readonly appStorage: AppStorageService,
  ) {}

  save(record: ProactiveNotificationTaskRecord): ProactiveNotificationTaskRecord {
    const index = this.appStorage.state.proactiveNotificationTasks.findIndex(
      (item) => item.id === record.id,
    );

    if (index >= 0) {
      this.appStorage.state.proactiveNotificationTasks[index] = record;
      return record;
    }

    this.appStorage.state.proactiveNotificationTasks.unshift(record);
    return record;
  }

  findById(id: string): ProactiveNotificationTaskRecord | undefined {
    return this.appStorage.state.proactiveNotificationTasks.find(
      (item) => item.id === id,
    );
  }

  findLatestByDedupeKey(
    dedupeKey: string,
  ): ProactiveNotificationTaskRecord | undefined {
    return this.appStorage.state.proactiveNotificationTasks.find(
      (item) => item.dedupeKey === dedupeKey,
    );
  }

  list(): ProactiveNotificationTaskRecord[] {
    return [...this.appStorage.state.proactiveNotificationTasks];
  }
}

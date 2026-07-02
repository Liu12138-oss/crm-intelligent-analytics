import { Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type { QueryUsageProfileRecord } from '../../shared/types/domain';

@Injectable()
export class QueryUsageProfileRepository {
  constructor(private readonly appStorage: AppStorageService) {}

  listByUser(userId: string): QueryUsageProfileRecord[] {
    return this.appStorage.state.queryUsageProfiles.filter((item) => item.userId === userId);
  }

  save(record: QueryUsageProfileRecord): QueryUsageProfileRecord {
    const currentIndex = this.appStorage.state.queryUsageProfiles.findIndex(
      (item) => item.id === record.id,
    );
    if (currentIndex >= 0) {
      this.appStorage.state.queryUsageProfiles[currentIndex] = record;
      return record;
    }

    this.appStorage.state.queryUsageProfiles.push(record);
    return record;
  }
}

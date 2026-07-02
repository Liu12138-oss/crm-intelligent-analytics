import { Inject, Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type { WecomUserDeptChangeRecord } from '../../shared/types/domain';

@Injectable()
export class WecomUserDeptChangeRepository {
  constructor(
    @Inject(AppStorageService)
    private readonly appStorage: AppStorageService,
  ) {}

  save(record: WecomUserDeptChangeRecord): WecomUserDeptChangeRecord {
    const currentIndex = this.appStorage.state.wecomUserDeptChanges.findIndex(
      (item) => item.id === record.id,
    );

    if (currentIndex >= 0) {
      this.appStorage.state.wecomUserDeptChanges[currentIndex] = record;
      return record;
    }

    this.appStorage.state.wecomUserDeptChanges.unshift(record);
    return record;
  }

  list(): WecomUserDeptChangeRecord[] {
    return [...this.appStorage.state.wecomUserDeptChanges];
  }
}

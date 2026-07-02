import { Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type { ExportRequestRecord } from '../../shared/types/domain';

@Injectable()
export class ExportRequestRepository {
  constructor(private readonly appStorage: AppStorageService) {}

  listByRequesterId(requesterId: string): ExportRequestRecord[] {
    return this.appStorage.state.exportRequests.filter(
      (item) => item.requesterId === requesterId,
    );
  }

  save(record: ExportRequestRecord): ExportRequestRecord {
    const currentIndex = this.appStorage.state.exportRequests.findIndex(
      (item) => item.id === record.id,
    );

    if (currentIndex >= 0) {
      this.appStorage.state.exportRequests[currentIndex] = record;
      return record;
    }

    this.appStorage.state.exportRequests.unshift(record);
    return record;
  }
}

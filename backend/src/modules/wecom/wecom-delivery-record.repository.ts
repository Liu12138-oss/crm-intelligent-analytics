import { Inject, Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type { WecomDeliveryRecord } from '../../shared/types/domain';

@Injectable()
export class WecomDeliveryRecordRepository {
  constructor(
    @Inject(AppStorageService)
    private readonly appStorage: AppStorageService,
  ) {}

  save(record: WecomDeliveryRecord): WecomDeliveryRecord {
    const currentIndex = this.appStorage.state.wecomDeliveryRecords.findIndex(
      (item) => item.id === record.id,
    );

    if (currentIndex >= 0) {
      this.appStorage.state.wecomDeliveryRecords[currentIndex] = record;
      this.appStorage.persist();
      return record;
    }

    this.appStorage.state.wecomDeliveryRecords.unshift(record);
    this.appStorage.persist();
    return record;
  }

  listByReceiptId(receiptId: string): WecomDeliveryRecord[] {
    return this.appStorage.state.wecomDeliveryRecords.filter(
      (item) => item.receiptId === receiptId,
    );
  }

  list(): WecomDeliveryRecord[] {
    return [...this.appStorage.state.wecomDeliveryRecords];
  }
}

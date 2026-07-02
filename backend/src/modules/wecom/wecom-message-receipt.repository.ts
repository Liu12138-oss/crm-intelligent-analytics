import { Inject, Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type { WecomMessageReceiptRecord } from '../../shared/types/domain';

@Injectable()
export class WecomMessageReceiptRepository {
  constructor(
    @Inject(AppStorageService)
    private readonly appStorage: AppStorageService,
  ) {}

  findByChannelMessageId(
    channelMessageId: string,
  ): WecomMessageReceiptRecord | undefined {
    return this.appStorage.state.wecomMessageReceipts.find(
      (item) => item.channelMessageId === channelMessageId,
    );
  }

  save(record: WecomMessageReceiptRecord): WecomMessageReceiptRecord {
    const currentIndex = this.appStorage.state.wecomMessageReceipts.findIndex(
      (item) => item.id === record.id,
    );

    if (currentIndex >= 0) {
      this.appStorage.state.wecomMessageReceipts[currentIndex] = record;
      this.appStorage.persist();
      return record;
    }

    this.appStorage.state.wecomMessageReceipts.unshift(record);
    this.appStorage.persist();
    return record;
  }

  list(): WecomMessageReceiptRecord[] {
    return [...this.appStorage.state.wecomMessageReceipts];
  }
}

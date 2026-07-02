import { Inject, Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type {
  FollowUpWritebackStatus,
  PendingFollowUpWritebackRecord,
} from '../../shared/types/domain';

@Injectable()
export class FollowUpWritebackRepository {
  constructor(
    @Inject(AppStorageService)
    private readonly appStorage: AppStorageService,
  ) {}

  findById(id: string): PendingFollowUpWritebackRecord | undefined {
    return this.appStorage.state.pendingFollowUpWritebacks.find((item) => item.id === id);
  }

  findLatestActiveBySessionId(
    sessionId: string,
  ): PendingFollowUpWritebackRecord | undefined {
    return this.appStorage.state.pendingFollowUpWritebacks.find(
      (item) => item.sessionId === sessionId && this.isActiveStatus(item.status),
    );
  }

  save(
    record: PendingFollowUpWritebackRecord,
  ): PendingFollowUpWritebackRecord {
    const index = this.appStorage.state.pendingFollowUpWritebacks.findIndex(
      (item) => item.id === record.id,
    );

    if (index >= 0) {
      this.appStorage.state.pendingFollowUpWritebacks[index] = record;
      this.appStorage.persist();
      return record;
    }

    this.appStorage.state.pendingFollowUpWritebacks.unshift(record);
    this.appStorage.persist();
    return record;
  }

  private isActiveStatus(status: FollowUpWritebackStatus): boolean {
    return (
      status === 'DRAFTED' ||
      status === 'AWAITING_CONTENT_CONFIRMATION' ||
      status === 'FAILED' ||
      status === 'WRITING'
    );
  }
}

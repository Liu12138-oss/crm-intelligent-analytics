import { Inject, Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type {
  WecomSyncCheckpointRecord,
  WecomSyncResourceType,
} from '../../shared/types/domain';

@Injectable()
export class WecomSyncCheckpointRepository {
  constructor(
    @Inject(AppStorageService)
    private readonly appStorage: AppStorageService,
  ) {}

  findByResourceType(
    resourceType: WecomSyncResourceType,
  ): WecomSyncCheckpointRecord | undefined {
    return this.appStorage.state.wecomSyncCheckpoints.find(
      (item) => item.resourceType === resourceType,
    );
  }

  save(record: WecomSyncCheckpointRecord): WecomSyncCheckpointRecord {
    const currentIndex = this.appStorage.state.wecomSyncCheckpoints.findIndex(
      (item) => item.id === record.id || item.resourceType === record.resourceType,
    );

    if (currentIndex >= 0) {
      this.appStorage.state.wecomSyncCheckpoints[currentIndex] = record;
      return record;
    }

    this.appStorage.state.wecomSyncCheckpoints.unshift(record);
    return record;
  }

  list(): WecomSyncCheckpointRecord[] {
    return [...this.appStorage.state.wecomSyncCheckpoints];
  }
}

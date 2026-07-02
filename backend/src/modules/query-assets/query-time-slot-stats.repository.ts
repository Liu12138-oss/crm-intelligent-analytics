import { Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type { QueryTimeSlotStatRecord } from '../../shared/types/domain';

@Injectable()
export class QueryTimeSlotStatsRepository {
  constructor(private readonly appStorage: AppStorageService) {}

  listByTimeSlot(timeSlot: string): QueryTimeSlotStatRecord[] {
    return this.appStorage.state.queryTimeSlotStats.filter((item) => item.timeSlot === timeSlot);
  }
}

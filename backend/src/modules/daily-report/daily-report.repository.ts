import { Inject, Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type {
  DailyReportRecord,
  DailyReportSummaryBatchRecord,
} from '../../shared/types/domain';

@Injectable()
export class DailyReportRepository {
  constructor(
    @Inject(AppStorageService)
    private readonly appStorage: AppStorageService,
  ) {}

  save(record: DailyReportRecord): DailyReportRecord {
    const index = this.appStorage.state.dailyReports.findIndex(
      (item) => item.id === record.id,
    );

    if (index >= 0) {
      this.appStorage.state.dailyReports[index] = record;
      this.appStorage.persist();
      return record;
    }

    this.appStorage.state.dailyReports.unshift(record);
    this.appStorage.persist();
    return record;
  }

  list(): DailyReportRecord[] {
    return [...this.appStorage.state.dailyReports];
  }

  findById(reportId: string): DailyReportRecord | undefined {
    return this.appStorage.state.dailyReports.find((item) => item.id === reportId);
  }

  findByRequesterAndBusinessDate(
    requesterId: string,
    businessDate: string,
  ): DailyReportRecord | undefined {
    return this.appStorage.state.dailyReports.find(
      (item) =>
        item.requesterId === requesterId && item.businessDate === businessDate,
    );
  }

  listByBusinessDate(businessDate: string): DailyReportRecord[] {
    return this.appStorage.state.dailyReports.filter(
      (item) => item.businessDate === businessDate,
    );
  }

  listByRequesterId(requesterId: string): DailyReportRecord[] {
    return this.appStorage.state.dailyReports.filter(
      (item) => item.requesterId === requesterId,
    );
  }

  findLatestPendingByRequesterId(
    requesterId: string,
  ): DailyReportRecord | undefined {
    return this.appStorage.state.dailyReports
      .filter(
        (item) =>
          item.requesterId === requesterId &&
          item.status === 'PENDING_CONFIRMATION',
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  }

  listBySupervisorId(supervisorId: string): DailyReportRecord[] {
    return this.appStorage.state.dailyReports.filter(
      (item) => item.supervisorId === supervisorId,
    );
  }

  saveSummaryBatch(batch: DailyReportSummaryBatchRecord): DailyReportSummaryBatchRecord {
    const index = this.appStorage.state.dailyReportSummaryBatches.findIndex(
      (item) => item.id === batch.id,
    );

    if (index >= 0) {
      this.appStorage.state.dailyReportSummaryBatches[index] = batch;
      this.appStorage.persist();
      return batch;
    }

    this.appStorage.state.dailyReportSummaryBatches.unshift(batch);
    this.appStorage.persist();
    return batch;
  }

  findSummaryBatchByBusinessDate(
    businessDate: string,
  ): DailyReportSummaryBatchRecord | undefined {
    return this.appStorage.state.dailyReportSummaryBatches.find(
      (item) => item.businessDate === businessDate,
    );
  }

  listSummaryBatches(): DailyReportSummaryBatchRecord[] {
    return [...this.appStorage.state.dailyReportSummaryBatches];
  }
}

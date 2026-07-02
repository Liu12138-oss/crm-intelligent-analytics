import { Inject, Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type { DailyReportAssistanceEscalationRecord } from '../../shared/types/domain';

@Injectable()
export class DailyReportAssistanceRepository {
  constructor(
    @Inject(AppStorageService)
    private readonly appStorage: AppStorageService,
  ) {}

  /** 保存日报协助升级记录，若已存在则覆盖旧值。 */
  save(
    record: DailyReportAssistanceEscalationRecord,
  ): DailyReportAssistanceEscalationRecord {
    const index = this.appStorage.state.dailyReportAssistanceEscalations.findIndex(
      (item) => item.id === record.id,
    );

    if (index >= 0) {
      this.appStorage.state.dailyReportAssistanceEscalations[index] = record;
      return record;
    }

    this.appStorage.state.dailyReportAssistanceEscalations.unshift(record);
    return record;
  }

  /** 按日报与指纹查询既有协助升级记录，供重复送达时复用状态。 */
  findByReportIdAndFingerprint(
    reportId: string,
    fingerprint: string,
  ): DailyReportAssistanceEscalationRecord | undefined {
    return this.appStorage.state.dailyReportAssistanceEscalations.find(
      (item) => item.reportId === reportId && item.fingerprint === fingerprint,
    );
  }

  /** 返回指定日报关联的全部协助升级记录。 */
  listByReportId(reportId: string): DailyReportAssistanceEscalationRecord[] {
    return this.appStorage.state.dailyReportAssistanceEscalations.filter(
      (item) => item.reportId === reportId,
    );
  }
}

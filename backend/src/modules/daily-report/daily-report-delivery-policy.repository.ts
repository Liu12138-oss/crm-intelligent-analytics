import { Inject, Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type {
  DailyReportDepartmentPolicyRecord,
  DailyReportRecipientOverrideRecord,
  DailyReportSalesGroupConfigRecord,
} from '../../shared/types/domain';

@Injectable()
export class DailyReportDeliveryPolicyRepository {
  constructor(
    @Inject(AppStorageService)
    private readonly appStorage: AppStorageService,
  ) {}

  listDepartmentPolicies(): DailyReportDepartmentPolicyRecord[] {
    return [...this.appStorage.state.dailyReportDepartmentPolicies];
  }

  saveDepartmentPolicy(
    record: DailyReportDepartmentPolicyRecord,
  ): DailyReportDepartmentPolicyRecord {
    const currentIndex = this.appStorage.state.dailyReportDepartmentPolicies.findIndex(
      (item) => item.departmentId === record.departmentId,
    );

    if (currentIndex >= 0) {
      this.appStorage.state.dailyReportDepartmentPolicies[currentIndex] = record;
      this.appStorage.persist();
      return record;
    }

    this.appStorage.state.dailyReportDepartmentPolicies.unshift(record);
    this.appStorage.persist();
    return record;
  }

  deleteDepartmentPolicy(departmentId: string): void {
    this.appStorage.state.dailyReportDepartmentPolicies =
      this.appStorage.state.dailyReportDepartmentPolicies.filter(
        (item) => item.departmentId !== departmentId,
      );
    this.appStorage.persist();
  }

  listRecipientOverrides(): DailyReportRecipientOverrideRecord[] {
    return [...this.appStorage.state.dailyReportRecipientOverrides];
  }

  saveRecipientOverride(
    record: DailyReportRecipientOverrideRecord,
  ): DailyReportRecipientOverrideRecord {
    const currentIndex = this.appStorage.state.dailyReportRecipientOverrides.findIndex(
      (item) =>
        item.departmentId === record.departmentId &&
        item.scopeType === record.scopeType,
    );

    if (currentIndex >= 0) {
      this.appStorage.state.dailyReportRecipientOverrides[currentIndex] = record;
      this.appStorage.persist();
      return record;
    }

    this.appStorage.state.dailyReportRecipientOverrides.unshift(record);
    this.appStorage.persist();
    return record;
  }

  deleteRecipientOverride(
    departmentId: string,
    scopeType: DailyReportRecipientOverrideRecord['scopeType'],
  ): void {
    this.appStorage.state.dailyReportRecipientOverrides =
      this.appStorage.state.dailyReportRecipientOverrides.filter(
        (item) =>
          !(
            item.departmentId === departmentId &&
            item.scopeType === scopeType
          ),
      );
    this.appStorage.persist();
  }

  deleteRecipientOverridesByDepartment(departmentId: string): void {
    this.appStorage.state.dailyReportRecipientOverrides =
      this.appStorage.state.dailyReportRecipientOverrides.filter(
        (item) => item.departmentId !== departmentId,
      );
    this.appStorage.persist();
  }

  listSalesGroupConfigs(): DailyReportSalesGroupConfigRecord[] {
    return this.appStorage.state.dailyReportSalesGroupConfigs.map((item) => ({
      ...item,
      recipientCrmUserIds: [...(item.recipientCrmUserIds ?? [])],
      memberCrmUserIds: [...item.memberCrmUserIds],
    }));
  }

  findSalesGroupConfig(
    groupId: string,
  ): DailyReportSalesGroupConfigRecord | undefined {
    const record = this.appStorage.state.dailyReportSalesGroupConfigs.find(
      (item) => item.groupId === groupId,
    );
    return record
      ? {
          ...record,
          recipientCrmUserIds: [...(record.recipientCrmUserIds ?? [])],
          memberCrmUserIds: [...record.memberCrmUserIds],
        }
      : undefined;
  }

  saveSalesGroupConfig(
    record: DailyReportSalesGroupConfigRecord,
  ): DailyReportSalesGroupConfigRecord {
    const currentIndex = this.appStorage.state.dailyReportSalesGroupConfigs.findIndex(
      (item) => item.groupId === record.groupId,
    );

    if (currentIndex >= 0) {
      this.appStorage.state.dailyReportSalesGroupConfigs[currentIndex] = {
        ...record,
        recipientCrmUserIds: [...(record.recipientCrmUserIds ?? [])],
        memberCrmUserIds: [...record.memberCrmUserIds],
      };
      this.appStorage.persist();
      return record;
    }

    this.appStorage.state.dailyReportSalesGroupConfigs.unshift({
      ...record,
      recipientCrmUserIds: [...(record.recipientCrmUserIds ?? [])],
      memberCrmUserIds: [...record.memberCrmUserIds],
    });
    this.appStorage.persist();
    return record;
  }

  deleteSalesGroupConfig(groupId: string): void {
    this.appStorage.state.dailyReportSalesGroupConfigs =
      this.appStorage.state.dailyReportSalesGroupConfigs.filter(
        (item) => item.groupId !== groupId,
      );
    this.appStorage.persist();
  }
}

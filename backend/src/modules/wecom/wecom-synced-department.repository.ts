import { Inject, Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type { WecomSyncedDepartmentRecord } from '../../shared/types/domain';

@Injectable()
export class WecomSyncedDepartmentRepository {
  constructor(
    @Inject(AppStorageService)
    private readonly appStorage: AppStorageService,
  ) {}

  save(record: WecomSyncedDepartmentRecord): WecomSyncedDepartmentRecord {
    const currentIndex = this.appStorage.state.wecomSyncedDepartments.findIndex(
      (item) => item.id === record.id || item.wxDepartmentId === record.wxDepartmentId,
    );

    if (currentIndex >= 0) {
      this.appStorage.state.wecomSyncedDepartments[currentIndex] = record;
      return record;
    }

    this.appStorage.state.wecomSyncedDepartments.unshift(record);
    return record;
  }

  list(): WecomSyncedDepartmentRecord[] {
    return [...this.appStorage.state.wecomSyncedDepartments];
  }

  /** 按企业微信部门 ID 查询同步镜像，用于组织范围诊断和父子树重建。 */
  findByWxDepartmentId(wxDepartmentId: string): WecomSyncedDepartmentRecord | undefined {
    return this.appStorage.state.wecomSyncedDepartments.find(
      (item) => item.wxDepartmentId === wxDepartmentId,
    );
  }

  /** 查询指定父部门下的直接子部门，用于递归展开授权部门。 */
  listByParentDepartmentId(parentDepartmentId: string): WecomSyncedDepartmentRecord[] {
    return this.appStorage.state.wecomSyncedDepartments.filter(
      (item) => item.parentDepartmentId === parentDepartmentId,
    );
  }

  /** 查询由指定企业微信用户挂名负责的部门，用于排查部门负责人配置。 */
  listByLeaderUserid(userid: string): WecomSyncedDepartmentRecord[] {
    return this.appStorage.state.wecomSyncedDepartments.filter((item) =>
      (item.leaderUserids ?? []).includes(userid),
    );
  }
}

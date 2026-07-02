import { Inject, Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type { WecomSyncedUserRecord } from '../../shared/types/domain';

@Injectable()
export class WecomSyncedUserRepository {
  constructor(
    @Inject(AppStorageService)
    private readonly appStorage: AppStorageService,
  ) {}

  save(record: WecomSyncedUserRecord): WecomSyncedUserRecord {
    const currentIndex = this.appStorage.state.wecomSyncedUsers.findIndex(
      (item) => item.id === record.id || item.wxUserid === record.wxUserid,
    );

    if (currentIndex >= 0) {
      this.appStorage.state.wecomSyncedUsers[currentIndex] = record;
      return record;
    }

    this.appStorage.state.wecomSyncedUsers.unshift(record);
    return record;
  }

  findByWxUserid(wxUserid: string): WecomSyncedUserRecord | undefined {
    return this.appStorage.state.wecomSyncedUsers.find(
      (item) => item.wxUserid === wxUserid,
    );
  }

  list(): WecomSyncedUserRecord[] {
    return [...this.appStorage.state.wecomSyncedUsers];
  }

  /** 查询指定企业微信部门下的同步成员，用于数据范围白名单诊断。 */
  listByDepartmentId(departmentId: string): WecomSyncedUserRecord[] {
    return this.appStorage.state.wecomSyncedUsers.filter((item) =>
      (item.departmentIds ?? []).includes(departmentId),
    );
  }

  /** 查询指定直属上级的下级成员，用于递归团队范围推导。 */
  listByDirectLeaderUserid(userid: string): WecomSyncedUserRecord[] {
    return this.appStorage.state.wecomSyncedUsers.filter((item) =>
      (item.directLeaderUserids ?? []).includes(userid),
    );
  }
}

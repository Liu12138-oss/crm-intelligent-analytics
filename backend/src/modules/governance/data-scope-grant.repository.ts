import { Inject, Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type { DataScopeGrantRecord } from '../../shared/types/domain';

@Injectable()
export class DataScopeGrantRepository {
  constructor(
    @Inject(AppStorageService)
    private readonly appStorage: AppStorageService,
  ) {}

  /**
   * 列出当前全部数据范围白名单授权。
   * 参数：无。
   * 返回：授权记录快照数组。
   */
  listAll(): DataScopeGrantRecord[] {
    this.ensureInitialized();
    return [...this.appStorage.state.dataScopeGrants];
  }

  /**
   * 按 ID 查找数据范围白名单授权。
   * 参数：授权记录 ID。
   * 返回：命中的授权记录；不存在时返回 undefined。
   */
  findById(id: string): DataScopeGrantRecord | undefined {
    this.ensureInitialized();
    return this.appStorage.state.dataScopeGrants.find((item) => item.id === id);
  }

  /**
   * 新增或更新数据范围白名单授权。
   * 参数：完整授权记录。
   * 返回：保存后的授权记录。
   */
  save(record: DataScopeGrantRecord): DataScopeGrantRecord {
    this.ensureInitialized();
    const currentIndex = this.appStorage.state.dataScopeGrants.findIndex(
      (item) => item.id === record.id,
    );

    if (currentIndex >= 0) {
      this.appStorage.state.dataScopeGrants[currentIndex] = record;
      this.appStorage.persist();
      return record;
    }

    this.appStorage.state.dataScopeGrants.unshift(record);
    this.appStorage.persist();
    return record;
  }

  /**
   * 兼容旧持久化快照中不存在白名单数组的场景。
   */
  private ensureInitialized(): void {
    if (!Array.isArray(this.appStorage.state.dataScopeGrants)) {
      this.appStorage.state.dataScopeGrants = [];
      this.appStorage.persist();
    }
  }
}

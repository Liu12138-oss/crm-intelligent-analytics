import { Inject, Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type { SqlAuditRecord } from '../../shared/types/domain';
import { SqlAuditFileStore } from './sql-audit-file.store';

@Injectable()
export class SqlAuditRepository {
  constructor(
    @Inject(AppStorageService)
    private readonly appStorage: AppStorageService,
    private readonly sqlAuditFileStore?: SqlAuditFileStore,
  ) {}

  /**
   * 写入 SQL 审计记录，参数为已经完成标准化的审计实体，返回已保存记录。
   */
  create(record: SqlAuditRecord): SqlAuditRecord {
    if (this.sqlAuditFileStore?.isEnabled()) {
      this.sqlAuditFileStore.create(record);
    }

    this.appStorage.state.sqlAuditRecords.unshift(record);
    this.trimRuntimeRecordsIfNeeded();
    this.appStorage.persist();
    return record;
  }

  /**
   * 返回当前应用库存储中的 SQL 审计记录快照，避免调用方直接修改底层数组。
   */
  list(): SqlAuditRecord[] {
    if (this.sqlAuditFileStore?.isEnabled()) {
      return this.sqlAuditFileStore.list().items;
    }

    return [...this.appStorage.state.sqlAuditRecords];
  }

  /**
   * 按主键查找单条 SQL 审计记录，参数为审计 ID，未命中时返回空值。
   */
  findById(id: string): SqlAuditRecord | undefined {
    if (this.sqlAuditFileStore?.isEnabled()) {
      return this.sqlAuditFileStore.findById(id);
    }

    return this.appStorage.state.sqlAuditRecords.find((item) => item.id === id);
  }

  /**
   * 对运行态 SQL 审计执行保留上限，避免 `.runtime/app-storage.json` 因流水无限增长。
   *
   * @returns 无返回值。
   * @throws 不抛出异常；无效配置会回退到不裁剪，避免误删审计记录。
   */
  private trimRuntimeRecordsIfNeeded(): void {
    const maxRecords = Number(process.env.SQL_AUDIT_RUNTIME_MAX_RECORDS ?? '0');
    if (!Number.isFinite(maxRecords) || maxRecords <= 0) {
      return;
    }

    if (this.appStorage.state.sqlAuditRecords.length <= maxRecords) {
      return;
    }

    this.appStorage.state.sqlAuditRecords.splice(maxRecords);
  }
}

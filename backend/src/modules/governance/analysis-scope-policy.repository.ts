import { Inject, Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type { AnalysisScopePolicyRecord } from '../../shared/types/domain';

@Injectable()
export class AnalysisScopePolicyRepository {
  // 旧分析全量名单只作为升级兼容存储保留，新功能不得继续直接依赖该仓储做权限放行。
  private readonly legacyPlaceholderUserIds = new Set(['user_admin']);

  constructor(
    @Inject(AppStorageService)
    private readonly appStorage: AppStorageService,
  ) {}

  /**
   * 读取历史分析范围策略。
   * 参数：无。
   * 返回：清理占位账号后的旧策略。
   * 注意：运行时权限应优先使用 ApplicationSuperAdminPolicyRepository 完成迁移与判断。
   */
  getCurrent(): AnalysisScopePolicyRecord {
    return this.normalizePolicy(this.appStorage.state.analysisScopePolicy);
  }

  /**
   * 保存历史分析范围策略。
   * 参数：旧策略记录。
   * 返回：归一化后的旧策略记录。
   * 注意：仅兼容旧接口；新权限中心保存会清空该名单，避免形成第二套全量授权。
   */
  save(record: AnalysisScopePolicyRecord): AnalysisScopePolicyRecord {
    this.appStorage.state.analysisScopePolicy = this.normalizePolicy(record);
    this.appStorage.persist();
    return this.appStorage.state.analysisScopePolicy;
  }

  /**
   * 归一化历史分析范围策略。
   * 参数：旧策略记录。
   * 返回：去重并移除历史占位账号后的旧策略。
   * 注意：该方法不授予应用超级管理员资格，仅为迁移读取提供干净输入。
   */
  private normalizePolicy(record: AnalysisScopePolicyRecord): AnalysisScopePolicyRecord {
    const cleanedUserIds = record.fullAccessUserIds.filter(
      (item) => !this.legacyPlaceholderUserIds.has(item),
    );
    return {
      ...record,
      fullAccessUserIds: Array.from(new Set(cleanedUserIds)),
    };
  }
}

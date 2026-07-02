import { Inject, Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type {
  ApplicationSuperAdminPolicyRecord,
  ApplicationSuperAdminSubjectRecord,
  CrmUser,
} from '../../shared/types/domain';

const CURRENT_POLICY_ID = 'application_super_admin_policy_current';

@Injectable()
export class ApplicationSuperAdminPolicyRepository {
  private readonly legacyPlaceholderUserIds = new Set(['user_admin']);

  constructor(
    @Inject(AppStorageService)
    private readonly appStorage: AppStorageService,
  ) {}

  /**
   * 读取当前应用超级管理员策略。
   * 参数：无。
   * 返回：归一化后的超级管理员授权策略。
   * 注意：读取阶段兼容历史分析全量名单，避免升级后已授权人员突然失效。
   */
  getCurrent(): ApplicationSuperAdminPolicyRecord {
    const current = this.appStorage.state.applicationSuperAdminPolicy;
    if (current) {
      const normalizedCurrent = this.normalizePolicy(current);
      const legacyPolicy = this.buildPolicyFromLegacyAnalysisScope();
      if (legacyPolicy.subjects.length === 0) {
        return normalizedCurrent;
      }

      return this.normalizePolicy({
        ...normalizedCurrent,
        subjects: [...normalizedCurrent.subjects, ...legacyPolicy.subjects],
        changeReason: legacyPolicy.changeReason || normalizedCurrent.changeReason,
      });
    }

    return this.buildPolicyFromLegacyAnalysisScope();
  }

  /**
   * 保存应用超级管理员策略。
   * 参数：完整策略记录。
   * 返回：持久化后的归一化策略。
   * 注意：保存新策略后清空旧分析全量名单，避免后续链路继续接入旧概念。
   */
  save(record: ApplicationSuperAdminPolicyRecord): ApplicationSuperAdminPolicyRecord {
    const normalized = this.normalizePolicy(record);
    this.appStorage.state.applicationSuperAdminPolicy = normalized;
    this.appStorage.state.analysisScopePolicy = {
      ...this.appStorage.state.analysisScopePolicy,
      fullAccessUserIds: [],
      updatedBy: record.updatedBy,
      updatedAt: record.updatedAt,
      changeReason: '已迁移至应用超级管理员授权。',
    };
    this.appStorage.persist();
    return normalized;
  }

  /**
   * 判断当前用户是否命中应用超级管理员授权。
   * 参数：当前 CRM 用户快照。
   * 返回：命中用户级或角色级有效授权时返回 true。
   */
  isSuperAdminSubject(user: CrmUser): boolean {
    const policy = this.getCurrent();
    return policy.subjects.some((subject) => {
      if (subject.status !== 'ACTIVE') {
        return false;
      }

      if (subject.subjectType === 'USER') {
        return subject.subjectId === user.id;
      }

      return user.roleIds.includes(subject.subjectId);
    });
  }

  /**
   * 从历史分析全量名单生成兼容策略。
   * 参数：无。
   * 返回：只包含用户级主体的应用超级管理员策略。
   */
  private buildPolicyFromLegacyAnalysisScope(): ApplicationSuperAdminPolicyRecord {
    const legacyPolicy = this.appStorage.state.analysisScopePolicy;
    return this.normalizePolicy({
      policyId: CURRENT_POLICY_ID,
      subjects: legacyPolicy.fullAccessUserIds
        .filter((item) => !this.legacyPlaceholderUserIds.has(item))
        .map((userId) => ({
          subjectType: 'USER',
          subjectId: userId,
          status: 'ACTIVE',
        })),
      updatedBy: legacyPolicy.updatedBy,
      updatedAt: legacyPolicy.updatedAt,
      changeReason: legacyPolicy.changeReason
        ? `由历史全量查询名单迁移：${legacyPolicy.changeReason}`
        : '由历史全量查询名单迁移。',
    });
  }

  /**
   * 归一化策略主体，移除空值并按主体类型与 ID 去重。
   * 参数：原始策略记录。
   * 返回：可持久化的策略记录。
   */
  private normalizePolicy(
    record: ApplicationSuperAdminPolicyRecord,
  ): ApplicationSuperAdminPolicyRecord {
    const subjectByKey = new Map<string, ApplicationSuperAdminSubjectRecord>();

    for (const subject of record.subjects ?? []) {
      const subjectId = subject.subjectId.trim();
      if (!subjectId) {
        continue;
      }

      const key = `${subject.subjectType}:${subjectId}`;
      // 同一主体只能保留一条最终状态，后续停用或恢复操作必须覆盖前序状态。
      subjectByKey.set(key, {
        subjectType: subject.subjectType,
        subjectId,
        status: subject.status,
      });
    }

    return {
      policyId: record.policyId || CURRENT_POLICY_ID,
      subjects: [...subjectByKey.values()],
      updatedBy: record.updatedBy,
      updatedAt: record.updatedAt,
      changeReason: record.changeReason,
    };
  }
}

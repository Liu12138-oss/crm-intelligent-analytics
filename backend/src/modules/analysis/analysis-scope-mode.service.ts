import { Injectable } from '@nestjs/common';
import type {
  AnalysisScopeMode,
  CrmUser,
  ScopeSnapshot,
} from '../../shared/types/domain';
import { UserScopeService } from '../auth/user-scope.service';

@Injectable()
export class AnalysisScopeModeService {
  constructor(
    private readonly userScopeService: UserScopeService,
  ) {}

  /**
   * 解析分析链路应使用的范围模式。
   * 参数：当前 CRM 用户快照。
   * 返回：分析范围模式和统一范围快照。
   * 注意：历史全量名单只允许在超级管理员策略仓储中迁移，这里只消费统一范围结果。
   */
  resolve(user: CrmUser): {
    mode: AnalysisScopeMode;
    scopeSnapshot: ScopeSnapshot;
  } {
    const scopeSnapshot = this.userScopeService.resolveScope(user);
    if (scopeSnapshot.isFullAccess) {
      return {
        mode: 'FULL_ANALYSIS_SCOPE',
        scopeSnapshot,
      };
    }

    return {
      mode: 'DEPARTMENT_ANALYSIS_SCOPE',
      scopeSnapshot,
    };
  }
}

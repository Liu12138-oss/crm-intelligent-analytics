import { ForbiddenException, Injectable } from '@nestjs/common';
import type { ScopeSnapshot } from '../../shared/types/domain';

@Injectable()
export class QueryTemplateScopeCompatibilityService {
  ensureCompatible(
    declaredScope: {
      organizationIds: string[];
      departmentIds: string[];
      ownerIds: string[];
    },
    userScope: ScopeSnapshot,
  ): void {
    const organizationAllowed = declaredScope.organizationIds.every((item) =>
      userScope.organizationIds.includes(item),
    );
    const departmentAllowed = declaredScope.departmentIds.every((item) =>
      userScope.departmentIds.includes(item),
    );
    const ownerAllowed = declaredScope.ownerIds.every((item) =>
      userScope.ownerIds.includes(item),
    );

    if (organizationAllowed && departmentAllowed && ownerAllowed) {
      return;
    }

    throw new ForbiddenException(
      `这个模板已经限定了特定部门或负责人范围，但你当前只开通了「${userScope.scopeSummary}」的数据权限，暂时不能直接使用。你可以联系管理员调整模板范围，或去掉范围条件后让系统按当前权限自动收口。`,
    );
  }
}

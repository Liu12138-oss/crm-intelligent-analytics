import { Inject, Injectable, Optional } from '@nestjs/common';
import type { CrmUser, ScopeSnapshot } from '../../shared/types/domain';
import { OrganizationScopeService } from '../governance/organization-scope.service';

@Injectable()
export class UserScopeService {
  constructor(
    @Optional()
    @Inject(OrganizationScopeService)
    private readonly organizationScopeService?: OrganizationScopeService,
  ) {}

  /**
   * 解析当前用户的数据访问范围。
   * 参数：当前 CRM 用户快照。
   * 返回：问数、导出、审计和治理预览复用的范围快照。
   * 注意：优先使用企业微信组织范围服务；未注册该服务时保留旧 CRM 快照范围，避免非分析模块启动失败。
   */
  resolveScope(user: CrmUser): ScopeSnapshot {
    if (this.organizationScopeService) {
      return this.organizationScopeService.resolveScope(user);
    }

    const scopeSummary = user.isAdmin
      ? '当前为管理员视角，可查看已授权的全组织结果。'
      : `当前仅展示 ${user.roleNames.join('、')} 角色可访问的组织与部门范围。`;

    return {
      organizationIds: [...user.organizationIds],
      departmentIds: [...user.departmentIds],
      ownerIds: [...user.ownerIds],
      isFullAccess: user.isAdmin ? true : undefined,
      fullAccessSource: user.isAdmin ? 'crm-admin' : undefined,
      scopeSummary,
    };
  }
}

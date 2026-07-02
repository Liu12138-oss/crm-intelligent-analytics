import { Inject, Injectable, Optional } from '@nestjs/common';
import { CrmReadonlyService } from '../../database/crm-readonly/crm-readonly.service';
import type { CrmUser } from '../../shared/types/domain';
import { OrganizationScopeService } from '../governance/organization-scope.service';

export interface SalesLeaderGroup {
  area: string;
  region: string;
  leader: CrmUser;
  leaderName: string;
  members: CrmUser[];
}

@Injectable()
export class SalesLeaderMappingService {
  constructor(
    private readonly crmReadonlyService: CrmReadonlyService,
    @Optional()
    @Inject(OrganizationScopeService)
    private readonly organizationScopeService?: OrganizationScopeService,
  ) {}

  async listMappedSalesGroups(
    recipientIds?: string[],
  ): Promise<SalesLeaderGroup[]> {
    return this.listOrganizationScopeGroups(recipientIds);
  }

  async listMappedSalesMembers(recipientIds?: string[]): Promise<CrmUser[]> {
    const groups = await this.listMappedSalesGroups(recipientIds);
    const memberMap = new Map<string, CrmUser>();
    for (const group of groups) {
      for (const member of group.members) {
        memberMap.set(member.id, member);
      }
    }

    return [...memberMap.values()];
  }

  async resolveSalesLeaderForUser(
    user: CrmUser,
  ): Promise<{ id: string; name: string } | undefined> {
    const groups = await this.listMappedSalesGroups();
    const targetGroup = groups.find((group) =>
      group.members.some((member) => member.id === user.id),
    );
    if (!targetGroup) {
      return undefined;
    }

    return {
      id: targetGroup.leader.id,
      name: targetGroup.leader.name,
    };
  }

  private filterGroupsByRecipientIds(
    groups: SalesLeaderGroup[],
    recipientIds?: string[],
  ): SalesLeaderGroup[] {
    if (!recipientIds || recipientIds.length === 0) {
      return groups;
    }

    const recipientIdSet = new Set(recipientIds);
    return groups.filter((group) => recipientIdSet.has(group.leader.id));
  }

  /**
   * 从统一组织范围服务生成日报负责人团队。
   * 参数：可选接收人 ID 过滤。
   * 返回：按负责人聚合的成员列表；没有组织事实时返回空数组。
   * 注意：日报负责人映射只允许消费企业微信组织事实，不再回退读取静态 Excel。
   */
  private async listOrganizationScopeGroups(
    recipientIds?: string[],
  ): Promise<SalesLeaderGroup[]> {
    if (!this.organizationScopeService?.hasOrganizationFacts()) {
      return [];
    }

    const users = await this.crmReadonlyService.listDailyReportUsers();
    const userMap = new Map(users.map((item) => [item.id, item]));
    const groups = users
      .map((leader) => {
        const scope = this.organizationScopeService?.resolveScope(leader);
        const members = (scope?.ownerIds ?? [])
          .filter((ownerId) => ownerId !== leader.id)
          .map((ownerId) => userMap.get(ownerId))
          .filter((item): item is CrmUser => Boolean(item));

        if (members.length === 0) {
          return undefined;
        }

        return {
          area: leader.departmentIds[0] ?? '',
          region: leader.departmentIds[0] ?? '',
          leader,
          leaderName: leader.name,
          members,
        } satisfies SalesLeaderGroup;
      })
      .filter((item): item is SalesLeaderGroup => Boolean(item));

    return this.filterGroupsByRecipientIds(groups, recipientIds);
  }
}

import { Inject, Injectable, Optional } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type {
  CrmUser,
  DataScopeGrantRecord,
  ScopeSnapshot,
  WecomSyncedUserRecord,
} from '../../shared/types/domain';
import { ApplicationSuperAdminPolicyRepository } from './application-super-admin-policy.repository';

@Injectable()
export class OrganizationScopeService {
  constructor(
    @Inject(AppStorageService)
    private readonly appStorage: AppStorageService,
    @Optional()
    private readonly applicationSuperAdminPolicyRepository?: ApplicationSuperAdminPolicyRepository,
  ) {}

  /**
   * 判断当前是否已有可用于组织范围推导的企业微信组织事实。
   * 参数：无。
   * 返回：存在有效同步成员时返回 true。
   */
  hasOrganizationFacts(): boolean {
    return this.appStorage.state.wecomSyncedUsers.some(
      (item) => item.syncStatus === 'ACTIVE',
    );
  }

  /**
   * 基于企业微信当前组织事实和数据范围白名单解析最终数据范围。
   * 参数：当前 CRM 用户快照，以及可选的当前时间字符串，用于测试过期授权。
   * 返回：可直接注入问数链路和审计事件的范围快照。
   * 注意：当组织事实缺失时只允许回退到既有 CRM 用户范围，不得扩大到部门或全组织。
   */
  resolveScope(
    user: CrmUser,
    options: { now?: string } = {},
  ): ScopeSnapshot {
    if (this.applicationSuperAdminPolicyRepository?.isSuperAdminSubject(user)) {
      return this.resolveApplicationSuperAdminScope(user);
    }

    if (user.isAdmin) {
      return this.resolveAdminScope(user);
    }

    const ownerIdsBeforeDepartmentPrune = this.resolveDefaultOwnerIds(user);
    const defaultDepartmentIds = this.resolveDefaultDepartmentIds(user);
    const defaultOwnerIds = this.pruneOwnerIdsByDefaultDepartments(
      user,
      ownerIdsBeforeDepartmentPrune,
      defaultDepartmentIds,
    );
    const activeGrants = this.resolveActiveGrants(user, options.now);
    const grantedDepartmentIds = this.unique(
      activeGrants.flatMap((item) => this.expandGrantDepartmentIds(item)),
    );
    const grantSummaries = activeGrants.map((item) =>
      this.buildGrantSummary(item),
    );

    return {
      organizationIds: [...user.organizationIds],
      departmentIds: grantedDepartmentIds,
      ownerIds: defaultOwnerIds,
      defaultOwnerIds,
      defaultDepartmentIds,
      ownerIdsBeforeDepartmentPrune,
      prunedOwnerIds: ownerIdsBeforeDepartmentPrune.filter(
        (item) => !defaultOwnerIds.includes(item),
      ),
      departmentPruneSummary: this.buildDepartmentPruneSummary(
        ownerIdsBeforeDepartmentPrune,
        defaultOwnerIds,
        defaultDepartmentIds,
      ),
      grantedDepartmentIds,
      grantSummaries,
      scopeSource: grantedDepartmentIds.length > 0 ? 'mixed' : 'wecom-organization',
      scopeSummary: this.buildScopeSummary(
        user,
        defaultOwnerIds,
        grantSummaries,
        this.buildDepartmentPruneSummary(
          ownerIdsBeforeDepartmentPrune,
          defaultOwnerIds,
          defaultDepartmentIds,
        ),
      ),
    };
  }

  /**
   * 解析当前用户负责的团队成员 CRM 标识。
   * 参数：当前 CRM 用户快照。
   * 返回：包含本人和递归下属的 CRM 用户 ID 列表。
   * 注意：没有企业微信组织事实时回退到既有 ownerIds 或本人，避免静默扩权。
   */
  resolveDefaultOwnerIds(user: CrmUser): string[] {
    if (!this.hasOrganizationFacts()) {
      return this.resolveFallbackOwnerIds(user);
    }

    const rootWxUserid = this.resolveWxUseridByCrmUser(user);
    if (!rootWxUserid) {
      return this.resolveFallbackOwnerIds(user);
    }

    const descendantWxUserids = this.collectDescendantWxUserids(rootWxUserid);
    const ownerIds = this.unique(
      descendantWxUserids
        .map((wxUserid) => this.resolveCrmUserIdByWxUserid(wxUserid))
        .filter((item): item is string => Boolean(item)),
    );

    return ownerIds.length > 0 ? ownerIds : this.resolveFallbackOwnerIds(user);
  }

  /**
   * 通过 CRM 用户 ID 反查企业微信 userid。
   * 参数：CRM 用户 ID。
   * 返回：企业微信 userid；缺失映射时返回 undefined。
   */
  resolveWxUseridByCrmUserId(crmUserId: string): string | undefined {
    const map = this.appStorage.state.crmWxUserMaps.find(
      (item) => item.crmUserId === crmUserId,
    );
    const wxUser = this.appStorage.state.crmWxUsers.find(
      (item) => item.id === map?.wxUserId,
    );
    return wxUser?.userid;
  }

  /**
   * 通过企业微信 userid 反查 CRM 用户 ID。
   * 参数：企业微信 userid。
   * 返回：CRM 用户 ID；缺失映射时返回 undefined。
   */
  resolveCrmUserIdByWxUserid(wxUserid: string): string | undefined {
    const wxUser = this.appStorage.state.crmWxUsers.find(
      (item) => item.userid === wxUserid,
    );
    const map = this.appStorage.state.crmWxUserMaps.find(
      (item) => item.wxUserId === wxUser?.id,
    );
    return map?.crmUserId;
  }

  /**
   * 基于目标 CRM 用户解析同一直属上级下的其它 CRM 成员。
   * 参数：目标 CRM 用户 ID。
   * 返回：同直属团队成员的 CRM 用户 ID 列表，不包含目标本人。
   */
  collectSiblingCrmUserIdsByCrmUserId(crmUserId: string): string[] {
    const wxUserid = this.resolveWxUseridByCrmUserId(crmUserId);
    if (!wxUserid) {
      return [];
    }

    const targetUser = this.findActiveSyncedUserByWxUserid(wxUserid);
    if (!targetUser) {
      return [];
    }

    const directLeaderSet = new Set(targetUser.directLeaderUserids ?? []);
    if (directLeaderSet.size === 0) {
      return [];
    }

    return this.unique(
      this.appStorage.state.wecomSyncedUsers
        .filter(
          (item) =>
            item.syncStatus === 'ACTIVE' &&
            item.wxUserid !== wxUserid &&
            (item.directLeaderUserids ?? []).some((leaderUserid) =>
              directLeaderSet.has(leaderUserid),
            ),
        )
        .map((item) => this.resolveCrmUserIdByWxUserid(item.wxUserid))
        .filter((item): item is string => Boolean(item)),
    );
  }

  /**
   * 基于目标 CRM 用户递归向上解析全部上级 CRM 用户。
   * 参数：目标 CRM 用户 ID。
   * 返回：从直属上级到更高层上级的去重 CRM 用户 ID 列表。
   */
  collectAncestorCrmUserIdsByCrmUserId(crmUserId: string): string[] {
    const wxUserid = this.resolveWxUseridByCrmUserId(crmUserId);
    if (!wxUserid) {
      return [];
    }

    const targetUser = this.findActiveSyncedUserByWxUserid(wxUserid);
    if (!targetUser) {
      return [];
    }

    const visited = new Set<string>();
    const queue = [...(targetUser.directLeaderUserids ?? [])];
    const ancestorCrmUserIds: string[] = [];

    while (queue.length > 0) {
      const currentLeaderUserid = queue.shift();
      if (!currentLeaderUserid || visited.has(currentLeaderUserid)) {
        continue;
      }

      visited.add(currentLeaderUserid);
      const crmUserId = this.resolveCrmUserIdByWxUserid(currentLeaderUserid);
      if (crmUserId) {
        ancestorCrmUserIds.push(crmUserId);
      }

      const leaderUser = this.findActiveSyncedUserByWxUserid(currentLeaderUserid);
      for (const parentLeaderUserid of leaderUser?.directLeaderUserids ?? []) {
        if (!visited.has(parentLeaderUserid)) {
          queue.push(parentLeaderUserid);
        }
      }
    }

    return this.unique(ancestorCrmUserIds);
  }

  /**
   * 基于多个 CRM 用户递归向上解析全部上级 CRM 用户，并返回缺少企业微信映射的主体。
   * 参数：目标 CRM 用户 ID 列表。
   * 返回：去重后的上级 CRM 用户列表，以及缺少企业微信映射的主体列表。
   */
  collectAncestorCrmUserIdsByCrmUserIds(crmUserIds: string[]): {
    ancestorCrmUserIds: string[];
    missingCrmUserIds: string[];
  } {
    const uniqueCrmUserIds = this.unique(crmUserIds);
    const ancestorCrmUserIds = new Set<string>();
    const missingCrmUserIds: string[] = [];

    for (const crmUserId of uniqueCrmUserIds) {
      if (!this.resolveWxUseridByCrmUserId(crmUserId)) {
        missingCrmUserIds.push(crmUserId);
        continue;
      }

      for (const ancestorCrmUserId of this.collectAncestorCrmUserIdsByCrmUserId(
        crmUserId,
      )) {
        ancestorCrmUserIds.add(ancestorCrmUserId);
      }
    }

    return {
      ancestorCrmUserIds: [...ancestorCrmUserIds],
      missingCrmUserIds: this.unique(missingCrmUserIds),
    };
  }

  /**
   * 基于 CRM 用户反查企业微信 userid。
   * 参数：当前 CRM 用户快照。
   * 返回：企业微信 userid，未映射时返回 undefined。
   */
  private resolveWxUseridByCrmUser(user: CrmUser): string | undefined {
    if (user.wecomSenderId?.trim()) {
      return user.wecomSenderId;
    }

    return this.resolveWxUseridByCrmUserId(user.id);
  }

  /**
   * 递归收集指定企业微信用户的所有下级企业微信 userid。
   * 参数：根企业微信 userid。
   * 返回：包含根用户自己的去重 userid 列表。
   */
  private collectDescendantWxUserids(rootWxUserid: string): string[] {
    const activeUsers = this.appStorage.state.wecomSyncedUsers.filter(
      (item) => item.syncStatus === 'ACTIVE',
    );
    const childrenByLeader = this.buildChildrenByLeader(activeUsers);
    const visited = new Set<string>();
    const queue = [rootWxUserid];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current)) {
        continue;
      }

      visited.add(current);
      for (const child of childrenByLeader.get(current) ?? []) {
        if (!visited.has(child)) {
          queue.push(child);
        }
      }
    }

    return [...visited];
  }

  /**
   * 解析当前用户默认业务部门及子部门。
   * 参数：当前 CRM 用户快照。
   * 返回：用于裁剪直属链默认负责人范围的部门集合。
   * 注意：这里不直接写入 `departmentIds` 执行过滤，避免普通成员因登录部门被扩大到整个部门。
   */
  private resolveDefaultDepartmentIds(user: CrmUser): string[] {
    if (!this.hasOrganizationFacts() || user.departmentIds.length === 0) {
      return [];
    }

    const hasDepartmentFacts = this.appStorage.state.wecomSyncedDepartments.some(
      (item) => item.syncStatus === 'ACTIVE',
    );
    if (!hasDepartmentFacts) {
      return [];
    }

    const seedDepartmentIds = this.resolveDefaultWecomDepartmentIds(user);
    const result = new Set(
      seedDepartmentIds.length > 0 ? seedDepartmentIds : user.departmentIds,
    );
    const queue = [...result];
    while (queue.length > 0) {
      const currentDepartmentId = queue.shift();
      if (!currentDepartmentId) {
        continue;
      }

      const childDepartments = this.appStorage.state.wecomSyncedDepartments.filter(
        (item) =>
          item.syncStatus === 'ACTIVE' &&
          item.parentDepartmentId === currentDepartmentId,
      );
      for (const childDepartment of childDepartments) {
        if (!result.has(childDepartment.wxDepartmentId)) {
          result.add(childDepartment.wxDepartmentId);
          queue.push(childDepartment.wxDepartmentId);
        }
      }
    }

    return [...result];
  }

  /**
   * 解析当前用户在企业微信组织事实里的默认部门。
   * 参数：当前 CRM 用户快照。
   * 返回：企业微信部门 ID 列表；未同步到企业微信成员时返回空数组。
   * 设计原因：生产中 CRM 部门 ID 与企业微信部门 ID 是两套口径，裁剪企业微信直属链时必须先统一到企业微信部门口径，
   * 否则山东区这类区域负责人会被误裁成仅本人，导致智能分析查询不到团队商机。
   */
  private resolveDefaultWecomDepartmentIds(user: CrmUser): string[] {
    const rootWxUserid = this.resolveWxUseridByCrmUser(user);
    if (!rootWxUserid) {
      return [];
    }

    const syncedUser = this.findActiveSyncedUserByWxUserid(rootWxUserid);
    if (!syncedUser) {
      return [];
    }

    if (syncedUser.primaryDepartmentId?.trim()) {
      return [syncedUser.primaryDepartmentId.trim()];
    }

    return this.unique(syncedUser.departmentIds ?? []);
  }

  /**
   * 按默认业务部门裁剪直属链负责人范围。
   * 参数：当前用户、裁剪前负责人 ID、默认业务部门集合。
   * 返回：只保留本人及默认业务部门内成员后的负责人 ID。
   * 设计原因：企业微信直属链可能跨技术、服务或其它区域，智能分析默认范围不能因此扩权。
   */
  private pruneOwnerIdsByDefaultDepartments(
    user: CrmUser,
    ownerIds: string[],
    defaultDepartmentIds: string[],
  ): string[] {
    if (!this.hasOrganizationFacts() || defaultDepartmentIds.length === 0) {
      return ownerIds;
    }

    const hasDepartmentTreeFacts = this.appStorage.state.wecomSyncedDepartments.some(
      (item) => item.syncStatus === 'ACTIVE',
    );
    if (!hasDepartmentTreeFacts) {
      return ownerIds;
    }

    const allowedDepartmentSet = new Set(defaultDepartmentIds);
    const prunedOwnerIds = ownerIds.filter((ownerId) => {
      if (ownerId === user.id) {
        return true;
      }

      const wxUserid = this.resolveWxUseridByCrmUserId(ownerId);
      if (!wxUserid) {
        return false;
      }

      const syncedUser = this.findActiveSyncedUserByWxUserid(wxUserid);
      return (syncedUser?.departmentIds ?? []).some((departmentId) =>
        allowedDepartmentSet.has(departmentId),
      );
    });

    return prunedOwnerIds.length > 0 ? prunedOwnerIds : this.resolveFallbackOwnerIds(user);
  }

  /**
   * 构造直属上级到下级成员的索引。
   * 参数：企业微信同步成员列表。
   * 返回：leader userid 到 child userid 的映射。
   */
  private buildChildrenByLeader(
    users: WecomSyncedUserRecord[],
  ): Map<string, string[]> {
    const childrenByLeader = new Map<string, string[]>();
    for (const user of users) {
      for (const leaderUserid of user.directLeaderUserids ?? []) {
        const current = childrenByLeader.get(leaderUserid) ?? [];
        current.push(user.wxUserid);
        childrenByLeader.set(leaderUserid, current);
      }
    }

    return childrenByLeader;
  }

  /**
   * 将企业微信 userid 映射为 CRM 用户 ID。
   * 参数：企业微信 userid。
   * 返回：CRM 用户 ID，未映射时返回 undefined。
   */
  private findActiveSyncedUserByWxUserid(
    wxUserid: string,
  ): WecomSyncedUserRecord | undefined {
    return this.appStorage.state.wecomSyncedUsers.find(
      (item) => item.syncStatus === 'ACTIVE' && item.wxUserid === wxUserid,
    );
  }

  /**
   * 解析用户或角色命中的有效数据范围白名单。
   * 参数：当前 CRM 用户快照与可选当前时间。
   * 返回：未过期且状态启用的授权记录。
   */
  private resolveActiveGrants(
    user: CrmUser,
    now = new Date().toISOString(),
  ): DataScopeGrantRecord[] {
    return (this.appStorage.state.dataScopeGrants ?? []).filter((grant) => {
      if (grant.status !== 'ACTIVE') {
        return false;
      }

      if (grant.expiresAt && grant.expiresAt <= now) {
        return false;
      }

      if (grant.subjectType === 'USER') {
        return grant.subjectId === user.id;
      }

      return user.roleIds.includes(grant.subjectId);
    });
  }

  /**
   * 构造管理员范围快照。
   * 参数：当前 CRM 用户快照。
   * 返回：管理员可用的兼容范围快照。
   */
  private resolveAdminScope(user: CrmUser): ScopeSnapshot {
    return {
      organizationIds: [...user.organizationIds],
      // 管理员口径只保留组织边界，不得把登录快照里的单部门或单负责人误当成正式数据范围。
      departmentIds: [],
      ownerIds: [],
      defaultOwnerIds: [],
      defaultDepartmentIds: [],
      grantedDepartmentIds: [],
      grantSummaries: [],
      scopeSource: 'crm-user',
      isFullAccess: true,
      fullAccessSource: 'crm-admin',
      scopeSummary: '当前为管理员视角，可查看已授权的全组织结果。',
    };
  }

  /**
   * 构造应用超级管理员全量范围快照。
   * 参数：当前 CRM 用户快照。
   * 返回：不按部门或负责人收口的全量范围。
   * 注意：该范围只影响业务数据访问，不绕过登录、SQL 白名单、字段白名单和审计边界。
   */
  private resolveApplicationSuperAdminScope(user: CrmUser): ScopeSnapshot {
    return {
      organizationIds: [...user.organizationIds],
      departmentIds: [],
      ownerIds: [],
      defaultOwnerIds: [],
      defaultDepartmentIds: [],
      grantedDepartmentIds: [],
      grantSummaries: [],
      scopeSource: 'application-super-admin',
      isFullAccess: true,
      fullAccessSource: 'application-super-admin',
      scopeSummary: '当前已开通应用超级管理员授权，可查看全公司数据。',
    };
  }

  /**
   * 在组织事实缺失时生成最小安全回退范围。
   * 参数：当前 CRM 用户快照。
   * 返回：优先使用既有 ownerIds，否则退回本人 ID。
   */
  private resolveFallbackOwnerIds(user: CrmUser): string[] {
    return user.ownerIds.length > 0 ? [...user.ownerIds] : [user.id];
  }

  /**
   * 构造白名单命中摘要。
   * 参数：数据范围授权记录。
   * 返回：用于页面与审计展示的中文摘要。
   */
  private buildGrantSummary(grant: DataScopeGrantRecord): string {
    const subjectLabel = grant.subjectType === 'USER' ? '用户' : '角色';
    const subDepartmentText = grant.includeSubDepartments ? '（含子部门）' : '';
    return `${subjectLabel} ${grant.subjectId} 授权部门：${grant.departmentIds.join('、')}${subDepartmentText}`;
  }

  /**
   * 按授权配置展开部门范围。
   * 参数：数据范围授权记录。
   * 返回：授权部门及按需递归展开的子部门 ID。
   */
  private expandGrantDepartmentIds(grant: DataScopeGrantRecord): string[] {
    if (!grant.includeSubDepartments) {
      return [...grant.departmentIds];
    }

    const result = new Set(grant.departmentIds);
    const queue = [...grant.departmentIds];
    while (queue.length > 0) {
      const currentDepartmentId = queue.shift();
      if (!currentDepartmentId) {
        continue;
      }

      const childDepartments = this.appStorage.state.wecomSyncedDepartments.filter(
        (item) => item.parentDepartmentId === currentDepartmentId,
      );
      for (const childDepartment of childDepartments) {
        if (!result.has(childDepartment.wxDepartmentId)) {
          result.add(childDepartment.wxDepartmentId);
          queue.push(childDepartment.wxDepartmentId);
        }
      }
    }

    return [...result];
  }

  /**
   * 构造最终范围说明。
   * 参数：当前用户、默认负责人范围和白名单摘要。
   * 返回：面向用户可读的中文范围说明。
   */
  private buildScopeSummary(
    user: CrmUser,
    ownerIds: string[],
    grantSummaries: string[],
    departmentPruneSummary?: string,
  ): string {
    const baseSummary =
      ownerIds.length > 1
        ? `当前按企业微信组织架构展示 ${user.name} 团队范围。`
        : `当前仅展示 ${user.name} 本人范围。`;
    const prunedSummary = departmentPruneSummary
      ? `${baseSummary}${departmentPruneSummary}`
      : baseSummary;

    if (grantSummaries.length === 0) {
      return prunedSummary;
    }

    return `${prunedSummary} 已叠加数据范围白名单：${grantSummaries.join('；')}。`;
  }

  /**
   * 生成默认部门裁剪说明。
   * 参数：裁剪前后负责人集合与默认部门集合。
   * 返回：裁剪发生时的中文说明，否则返回 undefined。
   */
  private buildDepartmentPruneSummary(
    ownerIdsBeforePrune: string[],
    ownerIdsAfterPrune: string[],
    defaultDepartmentIds: string[],
  ): string | undefined {
    const prunedCount = ownerIdsBeforePrune.length - ownerIdsAfterPrune.length;
    if (prunedCount <= 0 || defaultDepartmentIds.length === 0) {
      return undefined;
    }

    return `已按默认业务部门裁剪 ${prunedCount} 个跨部门负责人。`;
  }

  /**
   * 字符串数组去重并移除空值。
   * 参数：原始字符串数组。
   * 返回：去重后的有效字符串数组。
   */
  private unique(values: string[]): string[] {
    return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
  }
}

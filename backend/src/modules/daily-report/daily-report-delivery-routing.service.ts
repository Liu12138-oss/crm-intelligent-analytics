import { Inject, Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import { CrmReadonlyService } from '../../database/crm-readonly/crm-readonly.service';
import type {
  DailyReportDepartmentPolicyRecord,
  DailyReportDepartmentPolicyStatus,
  DailyReportDepartmentType,
  DailyReportRecipientOverrideRecord,
  DailyReportResolvedRecipientRecord,
  DailyReportSalesGroupConfigRecord,
  AccessOptionRecord,
  CrmUser,
  CrmWxUserRecord,
  WecomSyncedDepartmentRecord,
  WecomSyncedUserRecord,
} from '../../shared/types/domain';
import { DailyReportDeliveryPolicyRepository } from './daily-report-delivery-policy.repository';

export const DAILY_REPORT_GLOBAL_DEPARTMENT_ID = '__GLOBAL_ALL__';
export const DAILY_REPORT_GLOBAL_DEPARTMENT_NAME = '全公司';

export interface DailyReportResolvedSalesGroup {
  groupDepartmentId: string;
  groupDepartmentName: string;
  regionDepartmentId?: string;
  regionDepartmentName?: string;
  effectivePolicy: DailyReportDepartmentPolicyStatus;
  resolvedRecipient: DailyReportResolvedRecipientRecord;
  resolvedRecipients: DailyReportResolvedRecipientRecord[];
  memberCrmUserIds: string[];
  members: DailyReportResolvedSalesGroupMember[];
  blockedReason?: string;
}

export interface DailyReportResolvedSalesGroupMember {
  crmUserId?: string;
  memberName?: string;
  wecomUserId?: string;
  mappingStatus: 'MAPPED' | 'MISSING_CRM_USER' | 'MISSING_WECOM_MAPPING';
}

@Injectable()
export class DailyReportDeliveryRoutingService {
  private readonly salesDepartmentPatterns = [/销售/u, /售前/u];

  private readonly nonSalesDepartmentPatterns = [
    /技术/u,
    /运营/u,
    /职能/u,
    /产品/u,
    /行政/u,
    /财务/u,
    /人事/u,
    /客服/u,
    /交付/u,
  ];

  constructor(
    private readonly crmReadonlyService: CrmReadonlyService,
    private readonly dailyReportDeliveryPolicyRepository: DailyReportDeliveryPolicyRepository,
    @Inject(AppStorageService)
    private readonly appStorage: AppStorageService,
  ) {}

  async listResolvedSalesGroups(): Promise<DailyReportResolvedSalesGroup[]> {
    const departments = this.listActiveDepartments();
    const policyMap = new Map(
      this.dailyReportDeliveryPolicyRepository
        .listDepartmentPolicies()
        .map((item) => [item.departmentId, item] as const),
    );
    const overrides =
      this.dailyReportDeliveryPolicyRepository.listRecipientOverrides();
    const salesGroupConfigs =
      this.dailyReportDeliveryPolicyRepository.listSalesGroupConfigs();

    if (departments.length === 0) {
      return await this.listCrmFallbackResolvedSalesGroups({
        policyMap,
        overrides,
        salesGroupConfigs,
      });
    }

    const salesGroupConfigMap = new Map(
      salesGroupConfigs.map((item) => [item.groupId, item] as const),
    );
    const linkedDepartmentConfigMap = new Map(
      salesGroupConfigs
        .filter((item) => item.linkedDepartmentId)
        .map((item) => [item.linkedDepartmentId!, item] as const),
    );

    const salesGroupDepartments = this.resolveSalesGroupDepartments(
      departments,
      policyMap,
    );

    const groups = await Promise.all(
      salesGroupDepartments
        .map(async (department) => {
          const config =
            salesGroupConfigMap.get(department.wxDepartmentId) ??
            linkedDepartmentConfigMap.get(department.wxDepartmentId);
          const region =
            this.findConfiguredRegion(config, departments) ??
            this.findParentDepartment(department, departments);
          const groupDepartmentName =
            config?.groupName ??
            this.buildAutoSalesGroupDepartmentName(
              department,
              region,
              policyMap,
            );
          const effectivePolicy = config
            ? config.status
            : this.resolveEffectivePolicy(
                department,
                policyMap,
                departments,
              );
          const resolvedRecipients = await this.resolveConfiguredOrAutoRecipients({
            config,
            salesDepartment: department,
            regionDepartment: region,
            overrides,
          });
          const resolvedRecipient =
            this.pickPrimaryResolvedRecipient(resolvedRecipients);
          const members = config?.memberOverrideEnabled
            ? await this.resolveSalesGroupMembers(config.memberCrmUserIds)
            : this.resolveDepartmentMembers(department.wxDepartmentId);
          const memberCrmUserIds = config?.memberOverrideEnabled
            ? [...config.memberCrmUserIds]
            : this.pickMappedMemberCrmUserIds(members);

          return {
            groupDepartmentId: department.wxDepartmentId,
            groupDepartmentName,
            regionDepartmentId: config?.regionDepartmentId ?? region?.wxDepartmentId,
            regionDepartmentName:
              config?.regionDepartmentName ?? region?.departmentName,
            effectivePolicy,
            resolvedRecipient,
            resolvedRecipients,
            memberCrmUserIds,
            members,
            blockedReason:
              effectivePolicy === 'DISABLED'
                ? '该销售小组已被停用。'
                : this.resolveRecipientBlockedReason(resolvedRecipients),
          } satisfies DailyReportResolvedSalesGroup;
        }),
    );

    const autoGroupIds = new Set(groups.map((item) => item.groupDepartmentId));
    const manualGroups = await Promise.all(
      salesGroupConfigs
        .filter(
          (config) =>
            config.source === 'MANUAL' &&
            !autoGroupIds.has(config.groupId) &&
            (!config.linkedDepartmentId || !autoGroupIds.has(config.linkedDepartmentId)),
        )
        .map((config) => this.buildManualResolvedSalesGroup(config, departments)),
    );

    return [...groups, ...manualGroups];
  }

  /**
   * 企业微信目录快照为空时，按 CRM 部门策略兜底解析日报销售组。
   * 参数：当前页面保存的部门策略、收件覆盖和手工小组配置。
   * 返回值：可供预览、22 点提醒和 08 点汇总共用的销售组解析结果。
   * 异常场景：CRM 用户或部门只读查询不可用时，下游服务会回退到本地快照。
   * 调用注意：企业微信目录同步恢复后，主链路仍优先使用企业微信组织事实。
   */
  private async listCrmFallbackResolvedSalesGroups(params: {
    policyMap: Map<string, DailyReportDepartmentPolicyRecord>;
    overrides: DailyReportRecipientOverrideRecord[];
    salesGroupConfigs: DailyReportSalesGroupConfigRecord[];
  }): Promise<DailyReportResolvedSalesGroup[]> {
    const departmentOptions = await this.crmReadonlyService.listDailyReportDepartments();
    const fallbackDepartments = this.buildFallbackDepartments(departmentOptions);
    const users = await this.crmReadonlyService.listDailyReportUsers();
    const salesPolicies = [...params.policyMap.values()].filter(
      (item) => item.departmentType === 'SALES',
    );

    const policyGroups = await Promise.all(
      salesPolicies.map(async (policy) => {
        const department =
          fallbackDepartments.find(
            (item) => item.wxDepartmentId === policy.departmentId,
          ) ??
          this.buildFallbackDepartmentFromPolicy(policy);
        const region = this.findParentDepartment(department, fallbackDepartments);
        const members = this.resolveCrmFallbackMembers(policy.departmentId, users);
        const resolvedRecipient = await this.resolveCrmFallbackRecipient({
          salesDepartment: department,
          regionDepartment: region,
          overrides: params.overrides,
          members,
        });
        const resolvedRecipients = [resolvedRecipient];

        return {
          groupDepartmentId: department.wxDepartmentId,
          groupDepartmentName: department.departmentName,
          regionDepartmentId: region?.wxDepartmentId,
          regionDepartmentName: region?.departmentName,
          effectivePolicy: policy.status,
          resolvedRecipient,
          resolvedRecipients,
          memberCrmUserIds: members.map((item) => item.crmUserId!),
          members,
          blockedReason:
            policy.status === 'DISABLED'
              ? '该销售小组已被停用。'
              : this.resolveRecipientBlockedReason(resolvedRecipients),
        } satisfies DailyReportResolvedSalesGroup;
      }),
    );

    const manualGroups = await Promise.all(
      params.salesGroupConfigs
        .filter((config) => config.source === 'MANUAL')
        .map((config) => this.buildManualResolvedSalesGroup(config, fallbackDepartments)),
    );

    return [...policyGroups, ...manualGroups];
  }

  /**
   * 将 CRM 部门选项转换为与企业微信部门快照兼容的内部结构。
   */
  private buildFallbackDepartments(
    options: AccessOptionRecord[],
  ): WecomSyncedDepartmentRecord[] {
    return options.map((item) => ({
      id: `crm_fallback_department_${item.value}`,
      wxDepartmentId: item.value,
      departmentName: item.label,
      parentDepartmentId: item.parentDepartmentId,
      leaderUserids: [],
      rawPayload: {},
      syncStatus: 'ACTIVE',
      lastSyncedAt: new Date().toISOString(),
    }));
  }

  /**
   * 为只有页面策略、没有部门快照的销售部门生成最小可解析结构。
   */
  private buildFallbackDepartmentFromPolicy(
    policy: DailyReportDepartmentPolicyRecord,
  ): WecomSyncedDepartmentRecord {
    return {
      id: `crm_fallback_department_${policy.departmentId}`,
      wxDepartmentId: policy.departmentId,
      departmentName: policy.departmentName,
      leaderUserids: [],
      rawPayload: {},
      syncStatus: 'ACTIVE',
      lastSyncedAt: policy.updatedAt,
    };
  }

  /**
   * 通过 CRM 用户快照解析销售部门成员。
   */
  private resolveCrmFallbackMembers(
    departmentId: string,
    users: CrmUser[],
  ): DailyReportResolvedSalesGroupMember[] {
    return users
      .filter(
        (user) =>
          !user.isAdmin &&
          user.channels.includes('wecom-bot') &&
          user.departmentIds.includes(departmentId) &&
          user.ownerIds.length > 0,
      )
      .map((user) => this.buildCrmFallbackMember(user));
  }

  /**
   * 将 CRM 用户转为日报销售组成员快照。
   */
  private buildCrmFallbackMember(user: CrmUser): DailyReportResolvedSalesGroupMember {
    const mappedWecomUser = this.resolveMappedWecomUserByCrmUserId(user.id);
    const wecomUserId = user.wecomSenderId ?? mappedWecomUser?.userid;
    return {
      crmUserId: user.id,
      memberName: user.name,
      wecomUserId,
      mappingStatus: wecomUserId ? 'MAPPED' : 'MISSING_WECOM_MAPPING',
    };
  }

  /**
   * 在 CRM 兜底链路中解析日报收件人。
   */
  private async resolveCrmFallbackRecipient(params: {
    salesDepartment: WecomSyncedDepartmentRecord;
    regionDepartment?: WecomSyncedDepartmentRecord;
    overrides: DailyReportRecipientOverrideRecord[];
    members: DailyReportResolvedSalesGroupMember[];
  }): Promise<DailyReportResolvedRecipientRecord> {
    const salesOverride = params.overrides.find(
      (item) =>
        item.departmentId === params.salesDepartment.wxDepartmentId &&
        item.scopeType === 'SALES_GROUP',
    );
    if (salesOverride) {
      return await this.buildResolvedRecipientFromCrmUserId(
        salesOverride.crmUserId,
        salesOverride.recipientName,
        'SALES_GROUP_OVERRIDE',
      );
    }

    const regionOverride = params.regionDepartment
      ? params.overrides.find(
          (item) =>
            item.departmentId === params.regionDepartment!.wxDepartmentId &&
            item.scopeType === 'REGION',
        )
      : undefined;
    if (regionOverride) {
      return await this.buildResolvedRecipientFromCrmUserId(
        regionOverride.crmUserId,
        regionOverride.recipientName,
        'REGION_OVERRIDE',
      );
    }

    const supervisorId = this.resolveFallbackSupervisorId(params.members);
    if (supervisorId) {
      return await this.buildResolvedRecipientFromCrmUserId(
        supervisorId,
        undefined,
        'AUTO',
      );
    }

    return {
      resolutionStatus: 'MISSING_OWNER',
      resolutionReason: '当前团队未解析到有效组长。',
      source: 'AUTO',
    };
  }

  /**
   * 从销售成员的 CRM 上级字段中推导默认日报收件人。
   */
  private resolveFallbackSupervisorId(
    members: DailyReportResolvedSalesGroupMember[],
  ): string | undefined {
    const supervisorCounts = new Map<string, number>();
    const users = this.crmReadonlyService.listUsers();
    for (const member of members) {
      const user = users.find((item) => item.id === member.crmUserId);
      if (!user?.supervisorId) {
        continue;
      }

      supervisorCounts.set(
        user.supervisorId,
        (supervisorCounts.get(user.supervisorId) ?? 0) + 1,
      );
    }

    return [...supervisorCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
  }

  async listDepartmentConfigurationTree(): Promise<
    Array<{
      departmentId: string;
      departmentName: string;
      parentDepartmentId?: string;
      status: DailyReportDepartmentPolicyStatus;
      departmentType: DailyReportDepartmentType;
      applyToChildren: boolean;
      updatedBy?: string;
      updatedAt?: string;
      reason?: string;
      resolvedRecipientName?: string;
      resolvedRecipientCrmUserId?: string;
      resolvedRecipientWecomUserId?: string;
      resolvedRecipientSource?: DailyReportResolvedRecipientRecord['source'];
    }>
  > {
    const departments = this.listActiveDepartments();
    const groups = await this.listResolvedSalesGroups();
    const groupMap = new Map(
      groups.map((item) => [item.groupDepartmentId, item] as const),
    );
    const policyMap = new Map(
      this.dailyReportDeliveryPolicyRepository
        .listDepartmentPolicies()
        .map((item) => [item.departmentId, item] as const),
    );
    const overrideMap = new Map(
      this.dailyReportDeliveryPolicyRepository
        .listRecipientOverrides()
        .map((item) => [`${item.scopeType}:${item.departmentId}`, item] as const),
    );

    const items = departments.map((department) => {
      const policy = policyMap.get(department.wxDepartmentId);
      const group = groupMap.get(department.wxDepartmentId);
      const regionOverride = overrideMap.get(
        `REGION:${department.wxDepartmentId}`,
      );
      const salesOverride = overrideMap.get(
        `SALES_GROUP:${department.wxDepartmentId}`,
      );
      const effectiveOverride = salesOverride ?? regionOverride;
      return {
        departmentId: department.wxDepartmentId,
        departmentName: department.departmentName,
        parentDepartmentId: department.parentDepartmentId,
        status: policy?.status ?? 'INHERIT',
        departmentType: this.classifyDepartmentType(
          department.departmentName,
          policy,
        ),
        applyToChildren: policy?.applyToChildren ?? false,
        updatedBy: policy?.updatedBy,
        updatedAt: policy?.updatedAt,
        reason: policy?.reason,
        resolvedRecipientName:
          group?.resolvedRecipient.recipientName ?? effectiveOverride?.recipientName,
        resolvedRecipientCrmUserId:
          group?.resolvedRecipient.crmUserId ?? effectiveOverride?.crmUserId,
        resolvedRecipientWecomUserId: group?.resolvedRecipient.wecomUserId,
        resolvedRecipientSource:
          group?.resolvedRecipient.source ??
          (salesOverride
            ? 'SALES_GROUP_OVERRIDE'
            : regionOverride
              ? 'REGION_OVERRIDE'
              : undefined),
        };
    });

    const globalPolicy = policyMap.get(DAILY_REPORT_GLOBAL_DEPARTMENT_ID);
    const globalOverride = overrideMap.get(
      `REGION:${DAILY_REPORT_GLOBAL_DEPARTMENT_ID}`,
    );

    return [
      {
        departmentId: DAILY_REPORT_GLOBAL_DEPARTMENT_ID,
        departmentName: DAILY_REPORT_GLOBAL_DEPARTMENT_NAME,
        parentDepartmentId: undefined,
        status: globalPolicy?.status ?? 'INHERIT',
        departmentType: globalPolicy?.departmentType ?? 'UNCLASSIFIED',
        applyToChildren: globalPolicy?.applyToChildren ?? true,
        updatedBy: globalPolicy?.updatedBy,
        updatedAt: globalPolicy?.updatedAt,
        reason: globalPolicy?.reason,
        resolvedRecipientName: globalOverride?.recipientName,
        resolvedRecipientCrmUserId: globalOverride?.crmUserId,
        resolvedRecipientSource: globalOverride ? 'REGION_OVERRIDE' : undefined,
      },
      ...items,
    ];
  }

  resolveDepartmentName(departmentId: string): string {
    if (departmentId === DAILY_REPORT_GLOBAL_DEPARTMENT_ID) {
      return DAILY_REPORT_GLOBAL_DEPARTMENT_NAME;
    }

    return (
      this.listActiveDepartments().find(
        (item) => item.wxDepartmentId === departmentId,
      )?.departmentName ?? departmentId
    );
  }

  private listActiveDepartments(): WecomSyncedDepartmentRecord[] {
    return this.appStorage.state.wecomSyncedDepartments.filter(
      (item) => item.syncStatus === 'ACTIVE',
    );
  }

  private classifyDepartmentType(
    departmentName: string,
    policy?: DailyReportDepartmentPolicyRecord,
  ): DailyReportDepartmentType {
    if (policy?.departmentType && policy.departmentType !== 'UNCLASSIFIED') {
      return policy.departmentType;
    }

    if (
      this.nonSalesDepartmentPatterns.some((pattern) =>
        pattern.test(departmentName),
      )
    ) {
      return 'NON_SALES';
    }

    if (
      this.salesDepartmentPatterns.some((pattern) => pattern.test(departmentName))
    ) {
      return 'SALES';
    }

    return 'UNCLASSIFIED';
  }

  /**
   * 从企业微信部门树中解析真正需要进入日报的销售小组。
   * 参数：当前有效部门列表与已配置的日报部门策略。
   * 返回：销售/售前部门，或挂在销售/售前容器下且未被非销售规则排除的下级小组。
   * 异常场景：部门树缺少父级时只按当前部门自身名称和策略判断，避免错误扩大范围。
   * 调用注意：当“西区销售”这类容器下已有“西南组 / 西北组”时，空容器本身不再重复作为日报团队。
   */
  private resolveSalesGroupDepartments(
    departments: WecomSyncedDepartmentRecord[],
    policyMap: Map<string, DailyReportDepartmentPolicyRecord>,
  ): WecomSyncedDepartmentRecord[] {
    const candidateDepartments = departments.filter((department) =>
      this.isSalesGroupDepartmentCandidate(department, departments, policyMap),
    );
    const candidateParentIds = new Set(
      candidateDepartments
        .map((department) => department.parentDepartmentId)
        .filter((departmentId): departmentId is string => Boolean(departmentId)),
    );

    return candidateDepartments.filter((department) => {
      const hasChildGroup = candidateParentIds.has(department.wxDepartmentId);
      const hasDirectMember =
        this.resolveDepartmentMembers(department.wxDepartmentId).length > 0;

      return hasDirectMember || !hasChildGroup;
    });
  }

  /**
   * 判断单个部门是否具备日报销售小组候选资格。
   * 参数：待判断部门、完整部门树和日报部门策略。
   * 返回：是否应参与后续日报团队解析。
   * 异常场景：显式配置为非销售或区域时优先遵循配置，不再被父级销售容器继承覆盖。
   * 调用注意：名称不含“销售/售前”的小组可从上级销售容器继承候选资格。
   */
  private isSalesGroupDepartmentCandidate(
    department: WecomSyncedDepartmentRecord,
    departments: WecomSyncedDepartmentRecord[],
    policyMap: Map<string, DailyReportDepartmentPolicyRecord>,
  ): boolean {
    const policy = policyMap.get(department.wxDepartmentId);
    const departmentType = this.classifyDepartmentType(
      department.departmentName,
      policy,
    );

    if (policy?.departmentType === 'REGION' || departmentType === 'NON_SALES') {
      return false;
    }

    if (departmentType === 'SALES') {
      return true;
    }

    return this.hasSalesAncestorDepartment(department, departments, policyMap);
  }

  /**
   * 沿父级链查找销售/售前容器部门。
   * 参数：待判断部门、完整部门树和日报部门策略。
   * 返回：是否存在销售/售前祖先部门。
   * 异常场景：父级链断裂或出现环时停止查找，防止异常组织数据导致死循环。
   * 调用注意：非销售祖先不会继续向下授予日报团队资格。
   */
  private hasSalesAncestorDepartment(
    department: WecomSyncedDepartmentRecord,
    departments: WecomSyncedDepartmentRecord[],
    policyMap: Map<string, DailyReportDepartmentPolicyRecord>,
  ): boolean {
    const departmentMap = new Map(
      departments.map((item) => [item.wxDepartmentId, item] as const),
    );
    const visitedDepartmentIds = new Set<string>();
    let parentDepartmentId = department.parentDepartmentId;

    while (parentDepartmentId && !visitedDepartmentIds.has(parentDepartmentId)) {
      visitedDepartmentIds.add(parentDepartmentId);
      const parentDepartment = departmentMap.get(parentDepartmentId);
      if (!parentDepartment) {
        return false;
      }

      const parentPolicy = policyMap.get(parentDepartment.wxDepartmentId);
      const parentType = this.classifyDepartmentType(
        parentDepartment.departmentName,
        parentPolicy,
      );
      if (parentPolicy?.departmentType === 'REGION' || parentType === 'NON_SALES') {
        return false;
      }

      if (parentType === 'SALES') {
        return true;
      }

      parentDepartmentId = parentDepartment.parentDepartmentId;
    }

    return false;
  }

  /**
   * 生成自动识别销售小组的展示名称。
   * 参数：当前销售小组、父级销售容器和日报部门策略。
   * 返回：普通销售部门保留原名；挂在销售容器下的小组使用“销售容器-小组”。
   * 异常场景：缺少父级或父级不是销售容器时不拼接，避免把区域名误当作小组前缀。
   * 调用注意：手工小组配置的名称由治理页面维护，不进入该自动命名规则。
   */
  private buildAutoSalesGroupDepartmentName(
    department: WecomSyncedDepartmentRecord,
    parentDepartment: WecomSyncedDepartmentRecord | undefined,
    policyMap: Map<string, DailyReportDepartmentPolicyRecord>,
  ): string {
    if (!parentDepartment) {
      return department.departmentName;
    }

    const parentPolicy = policyMap.get(parentDepartment.wxDepartmentId);
    const parentType = this.classifyDepartmentType(
      parentDepartment.departmentName,
      parentPolicy,
    );
    if (parentType !== 'SALES') {
      return department.departmentName;
    }

    const prefixedDepartmentNames = [
      `${parentDepartment.departmentName}-${department.departmentName}`,
      `${parentDepartment.departmentName}－${department.departmentName}`,
      `${parentDepartment.departmentName}/${department.departmentName}`,
    ];
    if (
      department.departmentName === parentDepartment.departmentName ||
      prefixedDepartmentNames.includes(department.departmentName)
    ) {
      return department.departmentName;
    }

    return `${parentDepartment.departmentName}-${department.departmentName}`;
  }

  private resolveEffectivePolicy(
    department: WecomSyncedDepartmentRecord,
    policyMap: Map<string, DailyReportDepartmentPolicyRecord>,
    departments: WecomSyncedDepartmentRecord[],
  ): DailyReportDepartmentPolicyStatus {
    const currentPolicy = policyMap.get(department.wxDepartmentId);
    if (currentPolicy && currentPolicy.status !== 'INHERIT') {
      return currentPolicy.status;
    }

    const parentDepartment = this.findParentDepartment(department, departments);
    if (!parentDepartment) {
      return 'DISABLED';
    }

    const parentPolicy = policyMap.get(parentDepartment.wxDepartmentId);
    if (!parentPolicy || !parentPolicy.applyToChildren) {
      const globalPolicy = policyMap.get(DAILY_REPORT_GLOBAL_DEPARTMENT_ID);
      if (!globalPolicy || !globalPolicy.applyToChildren) {
        return 'DISABLED';
      }

      return globalPolicy.status === 'INHERIT'
        ? 'DISABLED'
        : globalPolicy.status;
    }

    return parentPolicy.status === 'INHERIT'
      ? 'DISABLED'
      : parentPolicy.status;
  }

  private findParentDepartment(
    department: WecomSyncedDepartmentRecord,
    departments: WecomSyncedDepartmentRecord[],
  ): WecomSyncedDepartmentRecord | undefined {
    return departments.find(
      (item) => item.wxDepartmentId === department.parentDepartmentId,
    );
  }

  private findConfiguredRegion(
    config: DailyReportSalesGroupConfigRecord | undefined,
    departments: WecomSyncedDepartmentRecord[],
  ): WecomSyncedDepartmentRecord | undefined {
    if (!config?.regionDepartmentId) {
      return undefined;
    }

    return departments.find(
      (item) => item.wxDepartmentId === config.regionDepartmentId,
    );
  }

  private async buildManualResolvedSalesGroup(
    config: DailyReportSalesGroupConfigRecord,
    departments: WecomSyncedDepartmentRecord[],
  ): Promise<DailyReportResolvedSalesGroup> {
    const region = this.findConfiguredRegion(config, departments);
    const configuredRecipientCrmUserIds =
      this.pickConfiguredRecipientCrmUserIds(config);
    const resolvedRecipients = configuredRecipientCrmUserIds.length > 0
      ? await this.buildResolvedRecipientsFromCrmUserIds(
          configuredRecipientCrmUserIds,
          'MANUAL_GROUP_CONFIG',
        )
      : [
          {
            resolutionStatus: 'MISSING_OWNER' as const,
            resolutionReason: '当前手工小组尚未配置最终收件人。',
            source: 'MANUAL_GROUP_CONFIG' as const,
          },
        ];
    const resolvedRecipient =
      this.pickPrimaryResolvedRecipient(resolvedRecipients);

    return {
      groupDepartmentId: config.groupId,
      groupDepartmentName: config.groupName,
      regionDepartmentId: config.regionDepartmentId ?? region?.wxDepartmentId,
      regionDepartmentName: config.regionDepartmentName ?? region?.departmentName,
      effectivePolicy: config.status,
      resolvedRecipient,
      resolvedRecipients,
      memberCrmUserIds: [...config.memberCrmUserIds],
      members: await this.resolveSalesGroupMembers(config.memberCrmUserIds),
      blockedReason:
        config.status === 'DISABLED'
          ? '该销售小组已被停用。'
          : this.resolveRecipientBlockedReason(resolvedRecipients),
    };
  }

  /**
   * 解析销售小组收件人列表，手工配置优先使用多组长数组，未配置时回退自动组长识别。
   */
  private async resolveConfiguredOrAutoRecipients(params: {
    config?: DailyReportSalesGroupConfigRecord;
    salesDepartment: WecomSyncedDepartmentRecord;
    regionDepartment?: WecomSyncedDepartmentRecord;
    overrides: DailyReportRecipientOverrideRecord[];
  }): Promise<DailyReportResolvedRecipientRecord[]> {
    const configuredRecipientCrmUserIds =
      this.pickConfiguredRecipientCrmUserIds(params.config);
    if (configuredRecipientCrmUserIds.length > 0) {
      return await this.buildResolvedRecipientsFromCrmUserIds(
        configuredRecipientCrmUserIds,
        'MANUAL_GROUP_CONFIG',
      );
    }

    return [
      await this.resolveRecipientForDepartment({
        salesDepartment: params.salesDepartment,
        regionDepartment: params.regionDepartment,
        overrides: params.overrides,
      }),
    ];
  }

  /**
   * 从新旧配置字段中提取组长 CRM 用户 ID，确保历史单人配置和新多选配置都能发送。
   */
  private pickConfiguredRecipientCrmUserIds(
    config?: DailyReportSalesGroupConfigRecord,
  ): string[] {
    if (!config) {
      return [];
    }

    return Array.from(
      new Set([
        ...(config.recipientCrmUserIds ?? []),
        ...(config.recipientCrmUserId ? [config.recipientCrmUserId] : []),
      ].filter(Boolean)),
    );
  }

  /**
   * 批量解析手工配置的多个组长，并保留每个收件人的映射状态供预览和发送链路判断。
   */
  private async buildResolvedRecipientsFromCrmUserIds(
    crmUserIds: string[],
    source: DailyReportResolvedRecipientRecord['source'],
  ): Promise<DailyReportResolvedRecipientRecord[]> {
    return await Promise.all(
      crmUserIds.map((crmUserId) =>
        this.buildResolvedRecipientFromCrmUserId(crmUserId, undefined, source),
      ),
    );
  }

  /**
   * 多个组长并存时优先取可发送收件人作为兼容旧字段的主展示值。
   */
  private pickPrimaryResolvedRecipient(
    recipients: DailyReportResolvedRecipientRecord[],
  ): DailyReportResolvedRecipientRecord {
    return (
      recipients.find((recipient) => recipient.resolutionStatus === 'READY') ??
      recipients[0] ?? {
        resolutionStatus: 'MISSING_OWNER',
        resolutionReason: '当前团队未解析到有效组长。',
        source: 'AUTO',
      }
    );
  }

  /**
   * 只有全部组长不可发送时才阻断团队；部分组长缺失映射时保留可发送收件人继续发送。
   */
  private resolveRecipientBlockedReason(
    recipients: DailyReportResolvedRecipientRecord[],
  ): string | undefined {
    if (recipients.some((recipient) => recipient.resolutionStatus === 'READY')) {
      return undefined;
    }

    return recipients[0]?.resolutionReason;
  }

  private async resolveRecipientForDepartment(params: {
    salesDepartment: WecomSyncedDepartmentRecord;
    regionDepartment?: WecomSyncedDepartmentRecord;
    overrides: DailyReportRecipientOverrideRecord[];
  }): Promise<DailyReportResolvedRecipientRecord> {
    const salesOverride = params.overrides.find(
      (item) =>
        item.departmentId === params.salesDepartment.wxDepartmentId &&
        item.scopeType === 'SALES_GROUP',
    );
    if (salesOverride) {
      return await this.buildResolvedRecipientFromCrmUserId(
        salesOverride.crmUserId,
        salesOverride.recipientName,
        'SALES_GROUP_OVERRIDE',
      );
    }

    const regionOverride = params.regionDepartment
      ? params.overrides.find(
          (item) =>
            item.departmentId === params.regionDepartment!.wxDepartmentId &&
            item.scopeType === 'REGION',
        )
      : undefined;
    if (regionOverride) {
      return await this.buildResolvedRecipientFromCrmUserId(
        regionOverride.crmUserId,
        regionOverride.recipientName,
        'REGION_OVERRIDE',
      );
    }

    const leaderUserid = this.resolveLeaderUseridForDepartment(
      params.salesDepartment,
      params.regionDepartment,
    );
    if (!leaderUserid) {
      return {
        resolutionStatus: 'MISSING_OWNER',
        resolutionReason: '当前团队未解析到有效组长。',
        source: 'AUTO',
      };
    }

    const crmUserId = this.resolveCrmUserIdByWxUserid(leaderUserid);
    if (!crmUserId) {
      const syncedLeader = this.resolveSyncedWecomUserByUserid(leaderUserid);
      const crmWxLeader = this.resolveCrmWxUserByUserid(leaderUserid);
      return {
        recipientName: syncedLeader?.userName ?? crmWxLeader?.name,
        wecomUserId: leaderUserid,
        resolutionStatus: 'MISSING_WECOM_MAPPING',
        resolutionReason: '当前区域负责人缺少可用的 CRM / 企微映射。',
        source: 'AUTO',
      };
    }

    return await this.buildResolvedRecipientFromCrmUserId(
      crmUserId,
      undefined,
      'AUTO',
      leaderUserid,
    );
  }

  private async buildResolvedRecipientFromCrmUserId(
    crmUserId: string,
    recipientName: string | undefined,
    source: DailyReportResolvedRecipientRecord['source'],
    wecomUserId?: string,
  ): Promise<DailyReportResolvedRecipientRecord> {
    const mappedWecomUser = this.resolveMappedWecomUserByCrmUserId(crmUserId);
    const resolvedWecomUserId =
      wecomUserId ??
      mappedWecomUser?.userid ??
      (await this.safeGetWecomSenderIdByUserId(crmUserId));
    const syncedWecomUser = resolvedWecomUserId
      ? this.resolveSyncedWecomUserByUserid(resolvedWecomUserId)
      : undefined;
    const user =
      recipientName || syncedWecomUser?.userName || mappedWecomUser?.name
        ? undefined
        : await this.safeGetUserById(crmUserId);
    const resolvedRecipientName =
      recipientName ?? user?.name ?? syncedWecomUser?.userName ?? mappedWecomUser?.name;

    if (!resolvedWecomUserId) {
      return {
        crmUserId,
        recipientName: resolvedRecipientName,
        resolutionStatus: 'MISSING_WECOM_MAPPING',
        resolutionReason: '当前默认收件人尚未绑定可用企业微信账号。',
        source,
      };
    }

    return {
      crmUserId,
      recipientName: resolvedRecipientName,
      wecomUserId: resolvedWecomUserId,
      resolutionStatus: 'READY',
      source,
    };
  }

  /**
   * 解析日报团队组长。
   * 参数：团队部门与父级区域部门。
   * 返回：企业微信 userid；优先团队负责人，其次成员直属上级，最后兜底父级区域负责人。
   */
  private resolveLeaderUseridForDepartment(
    department: WecomSyncedDepartmentRecord,
    regionDepartment?: WecomSyncedDepartmentRecord,
  ): string | undefined {
    const departmentLeader = department.leaderUserids?.[0];
    if (departmentLeader) {
      return departmentLeader;
    }

    const inferredLeader = this.inferLeaderUseridFromDepartmentMembers(
      department.wxDepartmentId,
    );
    if (inferredLeader) {
      return inferredLeader;
    }

    return regionDepartment?.leaderUserids?.[0];
  }

  /**
   * 从团队成员直属上级中推导组长。
   * 参数：企业微信部门 ID。
   * 返回：出现次数最多的直属上级 userid；用于企业微信部门未维护负责人字段时的自动识别。
   */
  private inferLeaderUseridFromDepartmentMembers(
    departmentId: string,
  ): string | undefined {
    const leaderCounts = new Map<string, number>();
    for (const user of this.appStorage.state.wecomSyncedUsers) {
      if (
        user.syncStatus !== 'ACTIVE' ||
        (
          user.primaryDepartmentId !== departmentId &&
          !(user.departmentIds ?? []).includes(departmentId)
        )
      ) {
        continue;
      }

      for (const leaderUserid of user.directLeaderUserids ?? []) {
        leaderCounts.set(
          leaderUserid,
          (leaderCounts.get(leaderUserid) ?? 0) + 1,
        );
      }
    }

    return [...leaderCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
  }

  private resolveCrmUserIdByWxUserid(wxUserid: string): string | undefined {
    const wxUser = this.resolveCrmWxUserByUserid(wxUserid);
    const map = this.appStorage.state.crmWxUserMaps.find(
      (item) => item.wxUserId === wxUser?.id,
    );
    return map?.crmUserId;
  }

  private async resolveSalesGroupMembers(
    crmUserIds: string[],
  ): Promise<DailyReportResolvedSalesGroupMember[]> {
    const uniqueCrmUserIds = Array.from(new Set(crmUserIds));
    return await Promise.all(
      uniqueCrmUserIds.map(async (crmUserId) => {
        const mappedWecomUser = this.resolveMappedWecomUserByCrmUserId(crmUserId);
        const wecomUserId =
          mappedWecomUser?.userid ??
          (await this.safeGetWecomSenderIdByUserId(crmUserId));
        const syncedWecomUser = wecomUserId
          ? this.resolveSyncedWecomUserByUserid(wecomUserId)
          : undefined;
        const user =
          syncedWecomUser?.userName || mappedWecomUser?.name
            ? undefined
            : await this.safeGetUserById(crmUserId);
        const memberName = user?.name ?? syncedWecomUser?.userName ?? mappedWecomUser?.name;

        if (!user && !memberName && !wecomUserId) {
          return {
            crmUserId,
            wecomUserId,
            mappingStatus: 'MISSING_CRM_USER' as const,
          };
        }

        return {
          crmUserId,
          memberName,
          wecomUserId,
          mappingStatus: wecomUserId
            ? ('MAPPED' as const)
            : ('MISSING_WECOM_MAPPING' as const),
        };
      }),
    );
  }

  /**
   * 按企业微信部门快照解析展示成员。
   * 参数：企业微信部门 ID。
   * 返回：部门内所有有效企业微信成员；CRM 映射只影响发送可用性，不影响治理页展示。
   */
  private resolveDepartmentMembers(
    departmentId: string,
  ): DailyReportResolvedSalesGroupMember[] {
    const members = this.appStorage.state.wecomSyncedUsers
      .filter(
        (item) =>
          item.syncStatus === 'ACTIVE' &&
          (item.primaryDepartmentId === departmentId ||
            (item.departmentIds ?? []).includes(departmentId)),
      )
      .map((item) => {
        const crmUserId = this.resolveCrmUserIdByWxUserid(item.wxUserid);
        return {
          crmUserId,
          memberName: item.userName,
          wecomUserId: item.wxUserid,
          mappingStatus: crmUserId
            ? ('MAPPED' as const)
            : ('MISSING_CRM_USER' as const),
        };
      });

    const seen = new Set<string>();
    return members.filter((item) => {
      const dedupeKey = item.wecomUserId ?? item.crmUserId;
      if (!dedupeKey || seen.has(dedupeKey)) {
        return false;
      }
      seen.add(dedupeKey);
      return true;
    });
  }

  /**
   * 从展示成员中提取可用于日报生成的 CRM 用户 ID。
   * 参数：已解析的团队成员。
   * 返回：去重后的 CRM 用户 ID 列表；未映射企业微信成员不参与 CRM 日报查询。
   */
  private pickMappedMemberCrmUserIds(
    members: DailyReportResolvedSalesGroupMember[],
  ): string[] {
    return Array.from(
      new Set(
        members
          .map((item) => item.crmUserId)
          .filter((item): item is string => Boolean(item)),
      ),
    );
  }

  /**
   * 查询 CRM 用户时做异常隔离。
   * 参数：CRM 用户 ID。
   * 返回：CRM 用户上下文；当只读库连接关闭或超时时返回 undefined，由企业微信同步数据兜底展示。
   */
  private async safeGetUserById(crmUserId: string): Promise<CrmUser | undefined> {
    try {
      return await this.crmReadonlyService.getUserById(crmUserId);
    } catch {
      return undefined;
    }
  }

  /**
   * 查询 CRM 到企业微信账号映射时做异常隔离。
   * 参数：CRM 用户 ID。
   * 返回：企业微信 userid；当只读库不可用时返回 undefined，后续改用本地同步映射表。
   */
  private async safeGetWecomSenderIdByUserId(
    crmUserId: string,
  ): Promise<string | undefined> {
    try {
      return await this.crmReadonlyService.getWecomSenderIdByUserId(crmUserId);
    } catch {
      return undefined;
    }
  }

  /**
   * 从本地企业微信映射快照反查账号。
   * 参数：CRM 用户 ID。
   * 返回：已同步的企业微信用户；用于治理页降级展示，避免 CRM 连接异常拖垮日报团队接口。
   */
  private resolveMappedWecomUserByCrmUserId(
    crmUserId: string,
  ): CrmWxUserRecord | undefined {
    const map = this.appStorage.state.crmWxUserMaps.find(
      (item) => item.crmUserId === crmUserId,
    );
    return this.appStorage.state.crmWxUsers.find(
      (item) => item.id === map?.wxUserId,
    );
  }

  /**
   * 从企业微信用户快照中按 userid 或原始 userid 查找账号。
   * 参数：企业微信 userid。
   * 返回：已入库的企业微信用户；用于兼容同步前后的账号字段差异。
   */
  private resolveCrmWxUserByUserid(wxUserid: string): CrmWxUserRecord | undefined {
    return this.appStorage.state.crmWxUsers.find(
      (item) => item.userid === wxUserid || item.originUserid === wxUserid,
    );
  }

  /**
   * 从企业微信组织架构同步快照中查找用户。
   * 参数：企业微信 userid。
   * 返回：同步用户记录；优先用于展示团队成员中文名。
   */
  private resolveSyncedWecomUserByUserid(
    wxUserid: string,
  ): WecomSyncedUserRecord | undefined {
    return this.appStorage.state.wecomSyncedUsers.find(
      (item) =>
        item.syncStatus === 'ACTIVE' &&
        (item.wxUserid === wxUserid || item.originUserid === wxUserid),
    );
  }

}

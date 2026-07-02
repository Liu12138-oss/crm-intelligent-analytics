import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { CrmReadonlyService } from '../../database/crm-readonly/crm-readonly.service';
import type {
  AccessOptionsRecord,
  AccessPreviewRecord,
  ApplicationSuperAdminPolicyRecord,
  ApplicationSuperAdminSubjectRecord,
  CrmUser,
  DataScopeGrantRecord,
  IdentityMappingDiagnosticRecord,
  RolePermissionRecord,
  WecomOrgSubjectOptionsRecord,
  WecomPilotPolicyRecord,
} from '../../shared/types/domain';
import { buildEntityId } from '../../shared/utils/id.util';
import { AuditEventRepository } from '../audit/audit-event.repository';
import { AccessDecisionService } from './access-decision.service';
import { AccessPolicyRepository } from './access-policy.repository';
import {
  accessPreviewSchema,
  dataScopePreviewSchema,
  dailyReportDeliveryPreviewSchema,
  updateApplicationSuperAdminPolicySchema,
  updateDailyReportDepartmentPolicySchema,
  updateRolePermissionSchema,
  updateDataScopeGrantSchema,
  upsertDailyReportSalesGroupSchema,
  updateWecomPilotPolicySchema,
} from './access-governance.schema';
import { RolePermissionRepository } from './role-permission.repository';
import { WecomPilotPolicyRepository } from './wecom-pilot-policy.repository';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import { DataScopeGrantRepository } from './data-scope-grant.repository';
import { OrganizationScopeService } from './organization-scope.service';
import { ApplicationSuperAdminPolicyRepository } from './application-super-admin-policy.repository';
import { DailyReportDeliveryPolicyRepository } from '../daily-report/daily-report-delivery-policy.repository';
import {
  DAILY_REPORT_GLOBAL_DEPARTMENT_ID,
  DAILY_REPORT_GLOBAL_DEPARTMENT_NAME,
  DailyReportDeliveryRoutingService,
} from '../daily-report/daily-report-delivery-routing.service';
import { QueryExecutionTimeoutError } from '../analysis/analysis.errors';
import { SessionCapabilitiesService } from '../sessions/session-capabilities.service';
import { AnalysisScopeModeService } from '../analysis/analysis-scope-mode.service';
import { CrmAuthService } from '../auth/crm-auth.service';
import {
  buildRolePermissionFromSimplifiedProfile,
  buildSimplifiedPermissionProfile,
} from './simplified-permission-profile';

@Injectable()
export class AccessGovernanceService {
  constructor(
    private readonly accessPolicyRepository: AccessPolicyRepository,
    private readonly rolePermissionRepository: RolePermissionRepository,
    private readonly wecomPilotPolicyRepository: WecomPilotPolicyRepository,
    private readonly applicationSuperAdminPolicyRepository: ApplicationSuperAdminPolicyRepository,
    private readonly accessDecisionService: AccessDecisionService,
    private readonly crmReadonlyService: CrmReadonlyService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly appStorageService: AppStorageService,
    private readonly dataScopeGrantRepository: DataScopeGrantRepository,
    private readonly organizationScopeService: OrganizationScopeService,
    private readonly dailyReportDeliveryPolicyRepository: DailyReportDeliveryPolicyRepository,
    private readonly dailyReportDeliveryRoutingService: DailyReportDeliveryRoutingService,
    private readonly sessionCapabilitiesService: SessionCapabilitiesService,
    private readonly analysisScopeModeService: AnalysisScopeModeService,
    @Optional()
    private readonly crmAuthService?: CrmAuthService,
  ) {}

  getOverview(user: CrmUser) {
    this.ensureGovernanceAccess(user);

    const rolePermissions = this.rolePermissionRepository.listAll();
    const pilotPolicy = this.wecomPilotPolicyRepository.getCurrent();
    const identityMappingIssueCount = this.countIdentityMappingIssues();

    return {
      analysisEnabledRoleCount: rolePermissions.filter((item) =>
        item.actionKeys.includes('analysis.use'),
      ).length,
      wecomPilotMode: pilotPolicy.mode,
      wecomPilotWhitelistUserCount: pilotPolicy.allowUserIds.length,
      exportEnabledRoleCount: rolePermissions.filter(
        (item) => item.exportAllowed || item.actionKeys.includes('analysis.export'),
      ).length,
      identityMappingIssueCount,
    };
  }

  getAnalysisScopePolicy(user: CrmUser) {
    return this.getApplicationSuperAdminPolicy(user);
  }

  updateAnalysisScopePolicy(
    user: CrmUser,
    payload: unknown,
  ) {
    return this.updateApplicationSuperAdminPolicy(user, payload);
  }

  getApplicationSuperAdminPolicy(user: CrmUser) {
    this.ensureGovernanceAccess(user);
    return this.buildApplicationSuperAdminPolicyView(
      this.applicationSuperAdminPolicyRepository.getCurrent(),
    );
  }

  updateApplicationSuperAdminPolicy(
    user: CrmUser,
    payload: unknown,
  ) {
    this.ensureGovernanceAccess(user);
    const parsed = updateApplicationSuperAdminPolicySchema.parse(payload);
    const current = this.applicationSuperAdminPolicyRepository.getCurrent();
    const saved = this.applicationSuperAdminPolicyRepository.save({
      policyId: current.policyId,
      subjects: parsed.subjects,
      updatedBy: user.id,
      updatedAt: new Date().toISOString(),
      changeReason: parsed.changeReason,
    });
    const savedView = this.buildApplicationSuperAdminPolicyView(saved);

    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'APPLICATION_SUPER_ADMIN_POLICY_UPDATED',
      actorId: user.id,
      actorRoleIds: user.roleIds,
      scopeSnapshot: {
        organizationIds: user.organizationIds,
        departmentIds: user.departmentIds,
        ownerIds: user.ownerIds,
        scopeSummary: '已更新应用超级管理员授权。',
      },
      sessionSnapshot: {
        before: current,
        after: savedView,
        subjectCount: saved.subjects.length,
      },
      riskLevel: 'HIGH',
      reviewStatus: 'CONFIRMED',
      outcome: '应用超级管理员授权已更新。',
      createdAt: new Date().toISOString(),
    });

    this.invalidatePermissionRelatedCaches();
    return savedView;
  }

  listRolePermissions(
    user: CrmUser,
    params: {
      keyword?: string;
      status?: RolePermissionRecord['status'];
      page?: number;
      pageSize?: number;
    },
  ) {
    this.ensureGovernanceAccess(user);
    const storedMap = new Map(
      this.rolePermissionRepository.listAll().map((item) => [item.roleId, item] as const),
    );
    return this.crmReadonlyService.listAccessGovernanceRoles(user).then((roles) => {
      const mergedRoles = roles.map((role) => {
        const current = storedMap.get(role.value);
        if (current) {
          return current;
        }

        return this.withSimplifiedPermissionProfile({
          roleId: role.value,
          roleNameSnapshot: role.label,
          status: 'INACTIVE',
          visibleMenus: [],
          actionKeys: [],
          webConsoleEnabled: false,
          wecomBotEligible: false,
          exportAllowed: false,
          templateManageAllowed: false,
          contractReviewUploadAllowed: false,
          contractReviewCrossViewAllowed: false,
          contractReviewCrossDownloadAllowed: false,
          updatedBy: 'system',
          updatedAt: new Date().toISOString(),
          changeReason: '尚未配置应用层权限矩阵，当前继续以 CRM 角色为权威源。',
        });
      });
      const keyword = params.keyword?.trim();
      const filteredRoles = mergedRoles.filter((item) => {
        const matchedKeyword = keyword ? item.roleNameSnapshot.includes(keyword) : true;
        const matchedStatus = params.status ? item.status === params.status : true;
        return matchedKeyword && matchedStatus;
      });
      const currentPage =
        Number.isFinite(params.page) && (params.page ?? 1) > 0
          ? Math.floor(params.page ?? 1)
          : 1;
      const currentPageSize =
        Number.isFinite(params.pageSize) && (params.pageSize ?? 10) > 0
          ? Math.min(Math.floor(params.pageSize ?? 10), 100)
          : 10;
      const start = (currentPage - 1) * currentPageSize;
      return {
        items: filteredRoles
          .slice(start, start + currentPageSize)
          .map((item) => this.withSimplifiedPermissionProfile(item)),
        page: currentPage,
        pageSize: currentPageSize,
        total: filteredRoles.length,
      };
    });
  }

  async getAccessOptions(user: CrmUser): Promise<AccessOptionsRecord> {
    this.ensureGovernanceAccess(user);
    const [users, roles, departments, wecomUsers] = await Promise.all([
      this.crmReadonlyService.listAccessGovernanceUsers(user),
      this.crmReadonlyService.listAccessGovernanceRoles(user),
      this.crmReadonlyService.listAccessGovernanceDepartments(user),
      this.crmReadonlyService.listAccessGovernanceWecomUsers(user),
    ]);

    return {
      users,
      roles,
      departments,
      wecomUsers,
    };
  }

  /**
   * 汇总企业微信组织对象选择器需要的部门、成员和 CRM 映射状态。
   * 参数：当前 CRM 用户，必须具备权限中心访问资格。
   * 返回值：企业微信部门、成员、CRM 映射状态和最近同步时间。
   * 异常场景：无治理权限时抛出 403；候选项读取失败时向上抛出只读库错误。
   * 调用注意：该方法只组织选择器展示事实，不扩大授权范围，也不创建新的人员或部门模型。
   */
  async getWecomOrganizationSubjects(
    user: CrmUser,
  ): Promise<WecomOrgSubjectOptionsRecord> {
    this.ensureGovernanceAccess(user);
    const [crmUsers, crmDepartments] = await Promise.all([
      this.crmReadonlyService.listAccessGovernanceUsers(user),
      this.crmReadonlyService.listAccessGovernanceDepartments(user),
    ]);
    const crmUserById = new Map(crmUsers.map((item) => [item.value, item] as const));
    const crmDepartmentById = new Map(crmDepartments.map((item) => [item.value, item] as const));
    const syncTimes = [
      ...this.appStorageService.state.wecomSyncedDepartments.map((item) => item.lastSyncedAt),
      ...this.appStorageService.state.wecomSyncedUsers.map((item) => item.lastSyncedAt),
    ].filter((item): item is string => Boolean(item));

    return {
      departments: this.appStorageService.state.wecomSyncedDepartments.map((department) => {
        const crmDepartment = crmDepartmentById.get(department.wxDepartmentId);
        if (department.syncStatus === 'DELETED') {
          return {
            departmentId: department.wxDepartmentId,
            name: department.departmentName,
            parentDepartmentId: department.parentDepartmentId,
            displayOrder: department.displayOrder,
            syncStatus: department.syncStatus,
            mappingStatus: 'DELETED',
            disabledReason: '该部门已从企业微信通讯录删除。',
            lastSyncedAt: department.lastSyncedAt,
          };
        }

        if (!crmDepartment) {
          return {
            departmentId: department.wxDepartmentId,
            name: department.departmentName,
            parentDepartmentId: department.parentDepartmentId,
            displayOrder: department.displayOrder,
            syncStatus: department.syncStatus,
            mappingStatus: 'UNMAPPED',
            disabledReason: '未绑定 CRM 部门，不能保存为授权部门。',
            lastSyncedAt: department.lastSyncedAt,
          };
        }

        return {
          departmentId: department.wxDepartmentId,
          name: department.departmentName,
          parentDepartmentId: department.parentDepartmentId,
          displayOrder: department.displayOrder,
          syncStatus: department.syncStatus,
          crmDepartmentId: crmDepartment.value,
          crmDepartmentName: crmDepartment.label,
          mappingStatus: 'MAPPED',
          lastSyncedAt: department.lastSyncedAt,
        };
      }),
      users: this.appStorageService.state.wecomSyncedUsers.map((syncedUser) => {
        const baseUser = {
          wecomUserId: syncedUser.wxUserid,
          name: syncedUser.userName,
          departmentIds: syncedUser.departmentIds ?? [],
          primaryDepartmentId: syncedUser.primaryDepartmentId,
          position: syncedUser.position,
          avatar: syncedUser.avatar,
          syncStatus: syncedUser.syncStatus,
          lastSyncedAt: syncedUser.lastSyncedAt,
        };

        if (syncedUser.syncStatus === 'DELETED') {
          return {
            ...baseUser,
            mappingStatus: 'DELETED',
            disabledReason: '该成员已从企业微信通讯录删除。',
          };
        }

        const wxUsers = this.appStorageService.state.crmWxUsers.filter(
          (item) => item.userid === syncedUser.wxUserid,
        );
        if (wxUsers.length !== 1) {
          return {
            ...baseUser,
            mappingStatus: wxUsers.length > 1 ? 'CONFLICTED' : 'UNMAPPED',
            disabledReason:
              wxUsers.length > 1
                ? '企业微信成员存在多个 CRM 映射，请先修复身份映射。'
                : '未绑定 CRM 用户，不能保存为授权人员。',
          };
        }

        const maps = this.appStorageService.state.crmWxUserMaps.filter(
          (item) => item.wxUserId === wxUsers[0].id,
        );
        if (maps.length !== 1) {
          return {
            ...baseUser,
            mappingStatus: maps.length > 1 ? 'CONFLICTED' : 'UNMAPPED',
            disabledReason:
              maps.length > 1
                ? '企业微信成员存在多个 CRM 映射，请先修复身份映射。'
                : '未绑定 CRM 用户，不能保存为授权人员。',
          };
        }

        const crmUser = crmUserById.get(maps[0].crmUserId);
        if (!crmUser) {
          return {
            ...baseUser,
            crmUserId: maps[0].crmUserId,
            mappingStatus: 'CONFLICTED',
            disabledReason: '已绑定的 CRM 用户不在当前权限范围内，请先修复身份映射。',
          };
        }

        return {
          ...baseUser,
          crmUserId: crmUser.value,
          crmUserName: this.extractAccessOptionName(crmUser.label),
          mappingStatus: 'MAPPED',
        };
      }),
      lastSyncedAt: syncTimes.sort().at(-1),
    };
  }

  listDataScopeGrants(user: CrmUser): { items: DataScopeGrantRecord[] } {
    this.ensureGovernanceAccess(user);
    return {
      items: this.dataScopeGrantRepository.listAll(),
    };
  }

  updateDataScopeGrant(
    user: CrmUser,
    grantId: string,
    payload: unknown,
  ): DataScopeGrantRecord {
    this.ensureGovernanceAccess(user);
    const parsed = updateDataScopeGrantSchema.parse(payload);
    const current = this.dataScopeGrantRepository.findById(grantId);
    const saved = this.dataScopeGrantRepository.save({
      id: grantId,
      subjectType: parsed.subjectType,
      subjectId: parsed.subjectId,
      departmentIds: [...parsed.departmentIds],
      includeSubDepartments: parsed.includeSubDepartments,
      reason: parsed.reason,
      expiresAt: parsed.expiresAt,
      status: parsed.status,
      updatedBy: user.id,
      updatedAt: new Date().toISOString(),
    });

    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'DATA_SCOPE_GRANT_UPDATED',
      actorId: user.id,
      actorRoleIds: user.roleIds,
      scopeSnapshot: {
        organizationIds: user.organizationIds,
        departmentIds: user.departmentIds,
        ownerIds: user.ownerIds,
        scopeSummary: `数据范围白名单已更新：${grantId}`,
      },
      sessionSnapshot: {
        grantId,
        before: current,
        after: saved,
      },
      riskLevel: 'MEDIUM',
      reviewStatus: 'CONFIRMED',
      outcome: `数据范围白名单 ${grantId} 已更新。`,
      createdAt: new Date().toISOString(),
    });

    this.invalidatePermissionRelatedCaches();

    return saved;
  }

  async previewDataScope(user: CrmUser, payload: unknown) {
    this.ensureGovernanceAccess(user);
    const parsed = dataScopePreviewSchema.parse(payload);
    const targetUser = await this.resolvePreviewUser(parsed.crmUserId, parsed.wecomUserId);

    if (!targetUser) {
      return {
        crmUserId: parsed.crmUserId,
        wecomUserId: parsed.wecomUserId,
        mappingStatus: 'UNMAPPED',
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        grantSummaries: [],
        scopeSummary: '当前用户未完成有效 CRM 身份映射，无法解析数据范围。',
      };
    }

    const scope = this.organizationScopeService.resolveScope(targetUser);
    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'DATA_SCOPE_PREVIEW_EXECUTED',
      actorId: user.id,
      actorRoleIds: user.roleIds,
      scopeSnapshot: {
        organizationIds: user.organizationIds,
        departmentIds: user.departmentIds,
        ownerIds: user.ownerIds,
        scopeSummary: '已执行数据范围预览。',
      },
      sessionSnapshot: {
        targetUserId: targetUser.id,
        scope,
      },
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome: '数据范围预览已完成。',
      createdAt: new Date().toISOString(),
    });

    return {
      crmUserId: targetUser.id,
      crmUserName: targetUser.name,
      mappingStatus: 'MAPPED',
      ...scope,
    };
  }

  async listDailyReportDepartments(user: CrmUser): Promise<{
    items: Array<{
      departmentId: string;
      departmentName: string;
      parentDepartmentId?: string;
      status: 'ENABLED' | 'DISABLED' | 'INHERIT';
      departmentType: 'REGION' | 'SALES' | 'NON_SALES' | 'UNCLASSIFIED';
      applyToChildren: boolean;
      updatedBy?: string;
      updatedAt?: string;
      reason?: string;
      resolvedRecipientName?: string;
      resolvedRecipientCrmUserId?: string;
      resolvedRecipientWecomUserId?: string;
      resolvedRecipientSource?: 'AUTO' | 'REGION_OVERRIDE' | 'SALES_GROUP_OVERRIDE' | 'MANUAL_GROUP_CONFIG';
    }>;
    strategies: Array<{
      departmentId: string;
      departmentName: string;
      parentDepartmentId?: string;
      status: 'ENABLED' | 'DISABLED' | 'INHERIT';
      departmentType: 'REGION' | 'SALES' | 'NON_SALES' | 'UNCLASSIFIED';
      applyToChildren: boolean;
      updatedBy?: string;
      updatedAt?: string;
      reason?: string;
      resolvedRecipientName?: string;
      resolvedRecipientCrmUserId?: string;
      resolvedRecipientWecomUserId?: string;
      resolvedRecipientSource?: 'AUTO' | 'REGION_OVERRIDE' | 'SALES_GROUP_OVERRIDE' | 'MANUAL_GROUP_CONFIG';
    }>;
  }> {
    this.ensureGovernanceAccess(user);
    type DailyReportDepartmentTreeItem = {
      departmentId: string;
      departmentName: string;
      parentDepartmentId?: string;
      status: 'ENABLED' | 'DISABLED' | 'INHERIT';
      departmentType: 'REGION' | 'SALES' | 'NON_SALES' | 'UNCLASSIFIED';
      applyToChildren: boolean;
      updatedBy?: string;
      updatedAt?: string;
      reason?: string;
      resolvedRecipientName?: string;
      resolvedRecipientCrmUserId?: string;
      resolvedRecipientWecomUserId?: string;
      resolvedRecipientSource?: 'AUTO' | 'REGION_OVERRIDE' | 'SALES_GROUP_OVERRIDE' | 'MANUAL_GROUP_CONFIG';
    };

    const configuredTreeItems =
      await this.dailyReportDeliveryRoutingService.listDepartmentConfigurationTree();
    const configuredItemMap = new Map(
      configuredTreeItems.map((item) => [item.departmentId, item] as const),
    );
    const accessDepartments =
      await this.crmReadonlyService.listAccessGovernanceDepartments(user);
    const fallbackItems: DailyReportDepartmentTreeItem[] = accessDepartments
      .filter((item) => !configuredItemMap.has(item.value))
      .map((item) => ({
        departmentId: item.value,
        departmentName: item.label,
        parentDepartmentId: item.parentDepartmentId ?? DAILY_REPORT_GLOBAL_DEPARTMENT_ID,
        status: 'INHERIT' as const,
        departmentType: 'UNCLASSIFIED' as const,
        applyToChildren: false,
      }));

    const items: DailyReportDepartmentTreeItem[] = [
      ...configuredTreeItems,
      ...fallbackItems,
    ].map((item) =>
      item.departmentId === DAILY_REPORT_GLOBAL_DEPARTMENT_ID
        ? item
        : {
            ...item,
            parentDepartmentId:
              item.parentDepartmentId ?? DAILY_REPORT_GLOBAL_DEPARTMENT_ID,
          },
    );

    const itemMap = new Map(items.map((item) => [item.departmentId, item] as const));
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
    const strategyDepartmentIds = Array.from(
      new Set([
        ...policyMap.keys(),
        ...this.dailyReportDeliveryPolicyRepository
          .listRecipientOverrides()
          .map((item) => item.departmentId),
      ]),
    );

    return {
      items,
      strategies: strategyDepartmentIds.map((departmentId) => {
        const policy = policyMap.get(departmentId);
        const regionOverride = overrideMap.get(`REGION:${departmentId}`);
        const salesOverride = overrideMap.get(`SALES_GROUP:${departmentId}`);
        const item =
          itemMap.get(departmentId) ?? {
            departmentId,
            departmentName:
              departmentId === DAILY_REPORT_GLOBAL_DEPARTMENT_ID
                ? DAILY_REPORT_GLOBAL_DEPARTMENT_NAME
                : this.dailyReportDeliveryRoutingService.resolveDepartmentName(
                    departmentId,
                  ),
            status: 'INHERIT' as const,
            departmentType: 'UNCLASSIFIED' as const,
            applyToChildren: false,
          };
        const effectiveOverride = salesOverride ?? regionOverride;

        return {
          departmentId,
          departmentName: item.departmentName,
          parentDepartmentId: item.parentDepartmentId,
          status: policy?.status ?? item.status,
          departmentType: policy?.departmentType ?? item.departmentType,
          applyToChildren: policy?.applyToChildren ?? item.applyToChildren,
          updatedBy: policy?.updatedBy,
          updatedAt: policy?.updatedAt,
          reason: policy?.reason ?? effectiveOverride?.reason,
          resolvedRecipientName:
            item.resolvedRecipientName ?? effectiveOverride?.recipientName,
          resolvedRecipientCrmUserId:
            item.resolvedRecipientCrmUserId ?? effectiveOverride?.crmUserId,
          resolvedRecipientWecomUserId: item.resolvedRecipientWecomUserId,
          resolvedRecipientSource:
            item.resolvedRecipientSource ??
            (salesOverride
              ? 'SALES_GROUP_OVERRIDE'
              : regionOverride
                ? 'REGION_OVERRIDE'
                : undefined),
        };
      }),
    };
  }

  updateDailyReportDepartmentPolicy(
    user: CrmUser,
    departmentId: string,
    payload: unknown,
  ) {
    this.ensureGovernanceAccess(user);
    const shouldUpdateOverrideRecipient =
      typeof payload === 'object' &&
      payload !== null &&
      Object.prototype.hasOwnProperty.call(payload, 'overrideRecipientCrmUserId');
    const parsedResult = updateDailyReportDepartmentPolicySchema.safeParse(payload);
    if (!parsedResult.success) {
      throw new BadRequestException(
        parsedResult.error.issues[0]?.message ?? '日报策略参数校验失败。',
      );
    }
    const parsed = parsedResult.data;
    const now = new Date().toISOString();
    const departmentName =
      this.dailyReportDeliveryRoutingService.resolveDepartmentName(departmentId);
    const scopeType =
      parsed.departmentType === 'REGION' ? 'REGION' : 'SALES_GROUP';
    const savedPolicy = this.dailyReportDeliveryPolicyRepository.saveDepartmentPolicy({
      departmentId,
      departmentName,
      status: parsed.status,
      departmentType: parsed.departmentType,
      applyToChildren: parsed.applyToChildren,
      updatedBy: user.id,
      updatedAt: now,
      reason: parsed.reason,
    });

    if (shouldUpdateOverrideRecipient) {
      if (parsed.overrideRecipientCrmUserId) {
        const recipientName =
          this.appStorageService.state.crmWxUsers.find((wxUser) => {
            const map = this.appStorageService.state.crmWxUserMaps.find(
              (item) => item.wxUserId === wxUser.id,
            );
            return map?.crmUserId === parsed.overrideRecipientCrmUserId;
          })?.name;
        this.dailyReportDeliveryPolicyRepository.saveRecipientOverride({
          departmentId,
          departmentName,
          scopeType,
          crmUserId: parsed.overrideRecipientCrmUserId,
          recipientName,
          updatedBy: user.id,
          updatedAt: now,
          reason: parsed.reason,
        });
      } else {
        this.dailyReportDeliveryPolicyRepository.deleteRecipientOverride(
          departmentId,
          scopeType,
        );
      }
    }

    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'DAILY_REPORT_DELIVERY_POLICY_UPDATED',
      actorId: user.id,
      actorRoleIds: user.roleIds,
      scopeSnapshot: {
        organizationIds: user.organizationIds,
        departmentIds: user.departmentIds,
        ownerIds: user.ownerIds,
        scopeSummary: `日报发送策略已更新：${departmentName}`,
      },
      sessionSnapshot: {
        departmentId,
        departmentName,
        status: parsed.status,
        departmentType: parsed.departmentType,
        applyToChildren: parsed.applyToChildren,
        overrideRecipientCrmUserId: parsed.overrideRecipientCrmUserId,
      },
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome: `日报发送策略 ${departmentName} 已更新。`,
      createdAt: now,
    });

    this.invalidatePermissionRelatedCaches();

    return {
      ...savedPolicy,
      overrideRecipientCrmUserId: parsed.overrideRecipientCrmUserId,
    };
  }

  deleteDailyReportDepartmentPolicy(user: CrmUser, departmentId: string) {
    this.ensureGovernanceAccess(user);
    const now = new Date().toISOString();
    const departmentName =
      this.dailyReportDeliveryRoutingService.resolveDepartmentName(departmentId);

    this.dailyReportDeliveryPolicyRepository.deleteDepartmentPolicy(departmentId);
    this.dailyReportDeliveryPolicyRepository.deleteRecipientOverridesByDepartment(
      departmentId,
    );

    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'DAILY_REPORT_DELIVERY_POLICY_UPDATED',
      actorId: user.id,
      actorRoleIds: user.roleIds,
      scopeSnapshot: {
        organizationIds: user.organizationIds,
        departmentIds: user.departmentIds,
        ownerIds: user.ownerIds,
        scopeSummary: `日报发送策略已删除：${departmentName}`,
      },
      sessionSnapshot: {
        departmentId,
        departmentName,
        action: 'DELETE',
      },
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome: `日报发送策略 ${departmentName} 已删除并回退为继承状态。`,
      createdAt: now,
    });

    this.invalidatePermissionRelatedCaches();

    return {
      success: true,
      departmentId,
    };
  }

  createDailyReportSalesGroup(user: CrmUser, payload: unknown) {
    this.ensureGovernanceAccess(user);
    const parsed = upsertDailyReportSalesGroupSchema.parse(payload);
    const now = new Date().toISOString();
    const recipientCrmUserIds =
      this.normalizeDailyReportRecipientCrmUserIds(parsed);
    const saved = this.dailyReportDeliveryPolicyRepository.saveSalesGroupConfig({
      groupId: buildEntityId('daily_report_sales_group'),
      groupName: parsed.groupName,
      source: 'MANUAL',
      linkedDepartmentId: parsed.linkedDepartmentId,
      regionDepartmentId: parsed.regionDepartmentId,
      regionDepartmentName: parsed.regionDepartmentName,
      status: parsed.status,
      recipientCrmUserIds,
      recipientCrmUserId: recipientCrmUserIds[0],
      memberCrmUserIds: [...new Set(parsed.memberCrmUserIds)],
      memberOverrideEnabled: parsed.memberOverrideEnabled,
      updatedBy: user.id,
      updatedAt: now,
      reason: parsed.reason,
    });

    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'DAILY_REPORT_DELIVERY_POLICY_UPDATED',
      actorId: user.id,
      actorRoleIds: user.roleIds,
      scopeSnapshot: {
        organizationIds: user.organizationIds,
        departmentIds: user.departmentIds,
        ownerIds: user.ownerIds,
        scopeSummary: `日报销售小组已新增：${saved.groupName}`,
      },
      sessionSnapshot: {
        after: saved,
      },
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome: `日报销售小组 ${saved.groupName} 已新增。`,
      createdAt: now,
    });

    return saved;
  }

  updateDailyReportSalesGroup(user: CrmUser, groupId: string, payload: unknown) {
    this.ensureGovernanceAccess(user);
    const parsed = upsertDailyReportSalesGroupSchema.parse(payload);
    const current =
      this.dailyReportDeliveryPolicyRepository.findSalesGroupConfig(groupId);
    const now = new Date().toISOString();
    const recipientCrmUserIds =
      this.normalizeDailyReportRecipientCrmUserIds(parsed);
    const saved = this.dailyReportDeliveryPolicyRepository.saveSalesGroupConfig({
      groupId,
      groupName: parsed.groupName,
      source: current?.source ?? 'MANUAL',
      linkedDepartmentId: parsed.linkedDepartmentId ?? current?.linkedDepartmentId,
      regionDepartmentId: parsed.regionDepartmentId,
      regionDepartmentName: parsed.regionDepartmentName,
      status: parsed.status,
      recipientCrmUserIds,
      recipientCrmUserId: recipientCrmUserIds[0],
      memberCrmUserIds: [...new Set(parsed.memberCrmUserIds)],
      memberOverrideEnabled: parsed.memberOverrideEnabled,
      updatedBy: user.id,
      updatedAt: now,
      reason: parsed.reason,
    });

    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'DAILY_REPORT_DELIVERY_POLICY_UPDATED',
      actorId: user.id,
      actorRoleIds: user.roleIds,
      scopeSnapshot: {
        organizationIds: user.organizationIds,
        departmentIds: user.departmentIds,
        ownerIds: user.ownerIds,
        scopeSummary: `日报销售小组已更新：${saved.groupName}`,
      },
      sessionSnapshot: {
        before: current,
        after: saved,
      },
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome: `日报销售小组 ${saved.groupName} 已更新。`,
      createdAt: now,
    });

    return saved;
  }

  deleteDailyReportSalesGroup(user: CrmUser, groupId: string) {
    this.ensureGovernanceAccess(user);
    const current =
      this.dailyReportDeliveryPolicyRepository.findSalesGroupConfig(groupId);
    if (!current) {
      throw new NotFoundException('当前日报销售小组配置不存在。');
    }

    this.dailyReportDeliveryPolicyRepository.deleteSalesGroupConfig(groupId);
    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'DAILY_REPORT_DELIVERY_POLICY_UPDATED',
      actorId: user.id,
      actorRoleIds: user.roleIds,
      scopeSnapshot: {
        organizationIds: user.organizationIds,
        departmentIds: user.departmentIds,
        ownerIds: user.ownerIds,
        scopeSummary: `日报销售小组已删除：${current.groupName}`,
      },
      sessionSnapshot: {
        action: 'DELETE',
        before: current,
      },
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome: `日报销售小组 ${current.groupName} 已删除。`,
      createdAt: new Date().toISOString(),
    });

    return {
      success: true,
      groupId,
    };
  }

  async previewDailyReportDelivery(
    user: CrmUser,
    payload: unknown,
  ): Promise<{
    businessDate: string;
    groups: Array<{
      groupDepartmentId: string;
      groupDepartmentName: string;
      regionDepartmentId?: string;
      regionDepartmentName?: string;
      effectivePolicy: 'ENABLED' | 'DISABLED' | 'INHERIT';
      recipientCrmUserIds?: string[];
      recipientNames?: string[];
      recipientWecomUserIds?: string[];
      recipients?: Array<{
        crmUserId?: string;
        name?: string;
        wecomUserId?: string;
      }>;
      recipientCrmUserId?: string;
      recipientName?: string;
      recipientWecomUserId?: string;
      ruleSource:
        | 'AUTO'
        | 'REGION_OVERRIDE'
        | 'SALES_GROUP_OVERRIDE'
        | 'MANUAL_GROUP_CONFIG';
      ruleSourceLabel: string;
      deliveryStatus: 'READY' | 'BLOCKED';
      deliveryStatusLabel: string;
      deliveryReason?: string;
      memberRequesterIds: string[];
      members: Array<{
        crmUserId?: string;
        memberName?: string;
        wecomUserId?: string;
        mappingStatus: 'MAPPED' | 'MISSING_CRM_USER' | 'MISSING_WECOM_MAPPING';
        mappingStatusLabel: string;
      }>;
      memberCount: number;
    }>;
  }> {
    this.ensureGovernanceAccess(user);
    const parsed = dailyReportDeliveryPreviewSchema.parse(payload);
    const groups =
      await this.dailyReportDeliveryRoutingService.listResolvedSalesGroups();

    const response = {
      businessDate: parsed.businessDate,
      groups: groups
        .map((item) => ({
          groupDepartmentId: item.groupDepartmentId,
          groupDepartmentName: item.groupDepartmentName,
          regionDepartmentId: item.regionDepartmentId,
          regionDepartmentName: item.regionDepartmentName,
          effectivePolicy: item.effectivePolicy,
          recipientCrmUserIds: item.resolvedRecipients
            .map((recipient) => recipient.crmUserId)
            .filter((value): value is string => Boolean(value)),
          recipientNames: item.resolvedRecipients
            .map((recipient) => recipient.recipientName)
            .filter((value): value is string => Boolean(value)),
          recipientWecomUserIds: item.resolvedRecipients
            .map((recipient) => recipient.wecomUserId)
            .filter((value): value is string => Boolean(value)),
          recipients: item.resolvedRecipients.map((recipient) => ({
            crmUserId: recipient.crmUserId,
            name: recipient.recipientName,
            wecomUserId: recipient.wecomUserId,
          })),
          recipientCrmUserId: item.resolvedRecipient.crmUserId,
          recipientName: item.resolvedRecipient.recipientName,
          recipientWecomUserId: item.resolvedRecipient.wecomUserId,
          ruleSource: item.resolvedRecipient.source,
          ruleSourceLabel: this.formatDailyReportRuleSource(
            item.resolvedRecipient.source,
          ),
          deliveryStatus:
            item.effectivePolicy !== 'DISABLED' &&
            item.resolvedRecipients.some(
              (recipient) => recipient.resolutionStatus === 'READY',
            )
              ? ('READY' as const)
              : ('BLOCKED' as const),
          deliveryStatusLabel: this.formatDailyReportDeliveryStatus(
            item.effectivePolicy,
            item.resolvedRecipient.resolutionStatus,
          ),
          deliveryReason:
            item.blockedReason ?? item.resolvedRecipient.resolutionReason,
          memberRequesterIds: item.memberCrmUserIds,
          members: item.members.map((member) => ({
            ...member,
            mappingStatusLabel: this.formatDailyReportMemberMappingStatus(
              member.mappingStatus,
            ),
          })),
          memberCount: item.members.length,
        })),
    };

    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'DAILY_REPORT_DELIVERY_PREVIEW_EXECUTED',
      actorId: user.id,
      actorRoleIds: user.roleIds,
      scopeSnapshot: {
        organizationIds: user.organizationIds,
        departmentIds: user.departmentIds,
        ownerIds: user.ownerIds,
        scopeSummary: '已执行日报发送预览。',
      },
      sessionSnapshot: response,
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome: '日报发送预览已完成。',
      createdAt: new Date().toISOString(),
    });

    return response;
  }

  /**
   * 归一化日报团队组长收件人，兼容旧单人字段和新多人字段。
   * 参数：治理页面保存日报团队的解析结果。
   * 返回值：去重后的 CRM 用户 ID 数组，第一项会继续同步到旧字段用于兼容历史消费者。
   */
  private normalizeDailyReportRecipientCrmUserIds(parsed: {
    recipientCrmUserIds?: string[];
    recipientCrmUserId?: string;
  }): string[] {
    return Array.from(
      new Set([
        ...(parsed.recipientCrmUserIds ?? []),
        ...(parsed.recipientCrmUserId ? [parsed.recipientCrmUserId] : []),
      ]),
    );
  }

  private formatDailyReportRuleSource(
    source: 'AUTO' | 'REGION_OVERRIDE' | 'SALES_GROUP_OVERRIDE' | 'MANUAL_GROUP_CONFIG',
  ): string {
    const labels: Record<typeof source, string> = {
      AUTO: '自动识别',
      REGION_OVERRIDE: '区域继承',
      SALES_GROUP_OVERRIDE: '小组覆盖',
      MANUAL_GROUP_CONFIG: '手工配置',
    };
    return labels[source];
  }

  private formatDailyReportDeliveryStatus(
    policy: 'ENABLED' | 'DISABLED' | 'INHERIT',
    resolutionStatus: 'READY' | 'MISSING_OWNER' | 'MISSING_WECOM_MAPPING',
  ): string {
    if (policy === 'DISABLED') {
      return '已停用';
    }

    return resolutionStatus === 'READY' ? '可发送' : '已阻断';
  }

  private formatDailyReportMemberMappingStatus(
    status: 'MAPPED' | 'MISSING_CRM_USER' | 'MISSING_WECOM_MAPPING',
  ): string {
    const labels: Record<typeof status, string> = {
      MAPPED: '已映射',
      MISSING_CRM_USER: '缺少 CRM 用户',
      MISSING_WECOM_MAPPING: '缺少企业微信映射',
    };
    return labels[status];
  }

  updateRolePermission(user: CrmUser, roleId: string, payload: unknown): RolePermissionRecord {
    this.ensureGovernanceAccess(user);
    const parsed = updateRolePermissionSchema.parse(payload);
    const current = this.rolePermissionRepository.findByRoleId(roleId);
    const baseRecord: RolePermissionRecord = {
      roleId,
      roleNameSnapshot: parsed.roleNameSnapshot,
      status: parsed.status,
      visibleMenus: [],
      actionKeys: [],
      webConsoleEnabled: false,
      wecomBotEligible: false,
      exportAllowed: false,
      templateManageAllowed: false,
      contractReviewUploadAllowed: false,
      contractReviewCrossViewAllowed: false,
      contractReviewCrossDownloadAllowed: false,
      updatedBy: user.id,
      updatedAt: new Date().toISOString(),
      changeReason: parsed.changeReason,
    };
    const record: RolePermissionRecord = parsed.simplifiedPermissionProfile
      ? buildRolePermissionFromSimplifiedProfile(baseRecord, parsed.simplifiedPermissionProfile)
      : this.withSimplifiedPermissionProfile({
          ...baseRecord,
          visibleMenus: [...(parsed.visibleMenus ?? [])],
          actionKeys: [...(parsed.actionKeys ?? [])],
          webConsoleEnabled: Boolean(parsed.webConsoleEnabled),
          wecomBotEligible: Boolean(parsed.wecomBotEligible),
          exportAllowed: Boolean(parsed.exportAllowed),
          templateManageAllowed: Boolean(parsed.templateManageAllowed),
          contractReviewUploadAllowed: Boolean(parsed.contractReviewUploadAllowed),
          contractReviewCrossViewAllowed: Boolean(parsed.contractReviewCrossViewAllowed),
          contractReviewCrossDownloadAllowed: Boolean(parsed.contractReviewCrossDownloadAllowed),
        });
    const saved = this.rolePermissionRepository.save(record);

    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'ACCESS_ROLE_PERMISSION_UPDATED',
      actorId: user.id,
      actorRoleIds: user.roleIds,
      scopeSnapshot: {
        organizationIds: user.organizationIds,
        departmentIds: user.departmentIds,
        ownerIds: user.ownerIds,
        scopeSummary: `角色权限已更新：${roleId}`,
      },
      sessionSnapshot: {
        roleId,
        before: current,
        after: saved,
      },
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome: `角色 ${roleId} 权限已更新。`,
      createdAt: new Date().toISOString(),
    });

    this.invalidatePermissionRelatedCaches();

    return this.withSimplifiedPermissionProfile(saved);
  }

  getWecomPilotPolicy(user: CrmUser): WecomPilotPolicyRecord {
    this.ensureGovernanceAccess(user);
    return this.wecomPilotPolicyRepository.getCurrent();
  }

  updateWecomPilotPolicy(user: CrmUser, payload: unknown): WecomPilotPolicyRecord {
    this.ensureGovernanceAccess(user);
    const parsed = updateWecomPilotPolicySchema.parse(payload);
    const current = this.wecomPilotPolicyRepository.getCurrent();
    const saved = this.wecomPilotPolicyRepository.save({
      channel: 'wecom-bot',
      mode: parsed.mode,
      allowUserIds: [...parsed.allowUserIds],
      allowRoleIds: [...parsed.allowRoleIds],
      allowDepartmentIds: [...parsed.allowDepartmentIds],
      denyUserIds: [...parsed.denyUserIds],
      note: parsed.note,
      updatedBy: user.id,
      updatedAt: new Date().toISOString(),
    });

    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'WECOM_PILOT_POLICY_UPDATED',
      actorId: user.id,
      actorRoleIds: user.roleIds,
      scopeSnapshot: {
        organizationIds: user.organizationIds,
        departmentIds: user.departmentIds,
        ownerIds: user.ownerIds,
        scopeSummary: '企业微信灰度策略已更新。',
      },
      sessionSnapshot: {
        before: current,
        after: saved,
      },
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome: `企业微信灰度策略已切换为 ${saved.mode}。`,
      createdAt: new Date().toISOString(),
    });

    this.invalidatePermissionRelatedCaches();

    return saved;
  }

  async previewAccess(user: CrmUser, payload: unknown): Promise<AccessPreviewRecord> {
    this.ensureGovernanceAccess(user);
    const parsed = accessPreviewSchema.parse(payload);
    const preview = await this.resolveAccessPreview(parsed.crmUserId, parsed.wecomUserId);

    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'ACCESS_PREVIEW_EXECUTED',
      actorId: user.id,
      actorRoleIds: user.roleIds,
      scopeSnapshot: {
        organizationIds: user.organizationIds,
        departmentIds: user.departmentIds,
        ownerIds: user.ownerIds,
        scopeSummary: '已执行用户权限预览。',
      },
      sessionSnapshot: {
        crmUserId: parsed.crmUserId,
        wecomUserId: parsed.wecomUserId,
        preview,
      },
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome: '用户权限预览已完成。',
      createdAt: new Date().toISOString(),
    });

    return preview;
  }

  async listIdentityMappings(
    user: CrmUser,
    filters: { wecomUserId?: string },
  ): Promise<{ items: IdentityMappingDiagnosticRecord[] }> {
    this.ensureGovernanceAccess(user);
    const targetUsers = this.appStorageService.state.crmWxUsers.filter((item) =>
      filters.wecomUserId ? item.userid === filters.wecomUserId : true,
    );

    const items: IdentityMappingDiagnosticRecord[] = [];
    for (const item of targetUsers) {
      items.push(await this.buildIdentityDiagnostic(item.userid));
    }

    this.auditEventRepository.create({
      id: buildEntityId('audit'),
      eventType: 'IDENTITY_MAPPING_DIAGNOSTIC_QUERIED',
      actorId: user.id,
      actorRoleIds: user.roleIds,
      scopeSnapshot: {
        organizationIds: user.organizationIds,
        departmentIds: user.departmentIds,
        ownerIds: user.ownerIds,
        scopeSummary: '已查询企业微信身份映射诊断。',
      },
      sessionSnapshot: {
        wecomUserId: filters.wecomUserId,
        resultCount: items.length,
      },
      riskLevel: 'LOW',
      reviewStatus: 'CONFIRMED',
      outcome: '企业微信身份映射诊断查询完成。',
      createdAt: new Date().toISOString(),
    });

    return { items };
  }

  private ensureGovernanceAccess(user: CrmUser): void {
    if (!user.isAdmin && !this.accessDecisionService.hasAction(user, 'governance.policy.manage')) {
      throw new ForbiddenException('当前用户无权访问权限中心。');
    }
  }

  /**
   * 从权限中心候选项标签中提取主体名称。
   * 参数：候选项展示标签，通常包含“姓名（角色）”。
   * 返回值：去除角色补充说明后的名称。
   * 异常场景：空标签时返回空字符串，由调用方决定兜底。
   * 调用注意：仅用于组织对象接口的姓名字段，前端展示完整说明时仍可使用原候选项标签。
   */
  private extractAccessOptionName(label: string): string {
    return label.split(/[（(]/u)[0]?.trim() || label.trim();
  }

  private countIdentityMappingIssues(): number {
    return this.appStorageService.state.crmWxUsers.filter((wxUser) => {
      const map = this.appStorageService.state.crmWxUserMaps.find(
        (item) => item.wxUserId === wxUser.id,
      );
      return !map;
    }).length;
  }

  private async resolveAccessPreview(
    crmUserId?: string,
    wecomUserId?: string,
  ): Promise<AccessPreviewRecord> {
    let resolvedWecomUserId = wecomUserId;
    let resolvedUser: CrmUser | undefined;

    if (crmUserId) {
      resolvedUser = await this.crmReadonlyService.getUserById(crmUserId);
      resolvedWecomUserId =
        resolvedWecomUserId ?? (await this.crmReadonlyService.getWecomSenderIdByUserId(crmUserId));
    } else if (wecomUserId) {
      resolvedUser = await this.crmReadonlyService.getUserByWecomSenderId(wecomUserId);
    }

    if (!resolvedUser) {
      return {
        crmUserId,
        wecomUserId,
        mappingStatus: 'UNMAPPED',
        roleNames: [],
        visibleMenus: [],
        actionKeys: [],
        scopeSummary: '当前企业微信账号未绑定有效的 CRM 身份。',
        wecomBotAccessState: 'UNMAPPED_CRM_IDENTITY',
        wecomBotAccessReason: '当前企业微信账号未绑定有效的 CRM 身份。',
        contractPermissions: {
          uploadAllowed: false,
          crossViewAllowed: false,
          crossDownloadAllowed: false,
        },
      };
    }

    const webDecision = this.accessDecisionService.buildDecision(resolvedUser, 'web-console');
    const wecomDecision = this.accessDecisionService.buildDecision(resolvedUser, 'wecom-bot');
    const analysisScope = this.analysisScopeModeService.resolve(resolvedUser);
    const matchedSuperAdminSubjects = this.resolveApplicationSuperAdminSubjects(resolvedUser);

    return {
      crmUserId: resolvedUser.id,
      crmUserName: resolvedUser.name,
      wecomUserId: resolvedWecomUserId,
      mappingStatus: resolvedWecomUserId ? 'MAPPED' : 'UNMAPPED',
      analysisScopeMode: analysisScope.mode,
      analysisScopeSummary: analysisScope.scopeSnapshot.scopeSummary,
      roleNames: resolvedUser.roleNames,
      visibleMenus: webDecision.visibleMenus,
      actionKeys: webDecision.actionKeys,
      scopeSummary: webDecision.scopeSnapshot.scopeSummary,
      wecomBotAccessState: wecomDecision.state,
      wecomBotAccessReason: wecomDecision.reason,
      contractPermissions: webDecision.contractPermissions,
      isApplicationSuperAdmin: matchedSuperAdminSubjects.length > 0,
      applicationSuperAdminSubjects: matchedSuperAdminSubjects,
      simplifiedPermissionProfile: buildSimplifiedPermissionProfile({
        roleId: 'preview',
        roleNameSnapshot: resolvedUser.roleNames.join('、') || resolvedUser.id,
        status: 'ACTIVE',
        visibleMenus: webDecision.visibleMenus,
        actionKeys: webDecision.actionKeys,
        webConsoleEnabled: webDecision.visibleMenus.length > 0,
        wecomBotEligible: wecomDecision.allowed,
        exportAllowed: this.accessDecisionService.hasAction(resolvedUser, 'analysis.export'),
        templateManageAllowed: this.accessDecisionService.hasAction(resolvedUser, 'template.manage'),
        contractReviewUploadAllowed: webDecision.contractPermissions.uploadAllowed,
        contractReviewCrossViewAllowed: webDecision.contractPermissions.crossViewAllowed,
        contractReviewCrossDownloadAllowed: webDecision.contractPermissions.crossDownloadAllowed,
        updatedBy: 'system',
        updatedAt: new Date().toISOString(),
      }),
    };
  }

  /**
   * 构造兼容前端使用的应用超级管理员策略视图。
   * 参数：应用超级管理员策略记录。
   * 返回：包含新主体结构和旧用户/角色数组的视图。
   */
  private buildApplicationSuperAdminPolicyView(
    policy: ApplicationSuperAdminPolicyRecord,
  ) {
    const activeSubjects = policy.subjects.filter((item) => item.status === 'ACTIVE');
    return {
      ...policy,
      fullAccessUserIds: activeSubjects
        .filter((item) => item.subjectType === 'USER')
        .map((item) => item.subjectId),
      fullAccessRoleIds: activeSubjects
        .filter((item) => item.subjectType === 'ROLE')
        .map((item) => item.subjectId),
    };
  }

  /**
   * 解析当前用户命中的应用超级管理员授权主体。
   * 参数：当前 CRM 用户快照。
   * 返回：命中的用户级或角色级主体列表。
   */
  private resolveApplicationSuperAdminSubjects(
    user: CrmUser,
  ): ApplicationSuperAdminSubjectRecord[] {
    return this.applicationSuperAdminPolicyRepository.getCurrent().subjects.filter((subject) => {
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
   * 统一补充简化权限树，避免列表、保存返回和预览各自复制一套回显规则。
   */
  private withSimplifiedPermissionProfile(
    record: RolePermissionRecord,
  ): RolePermissionRecord {
    return {
      ...record,
      simplifiedPermissionProfile: buildSimplifiedPermissionProfile(record),
    };
  }

  private async resolvePreviewUser(
    crmUserId?: string,
    wecomUserId?: string,
  ): Promise<CrmUser | undefined> {
    if (crmUserId) {
      return this.crmReadonlyService.getUserById(crmUserId);
    }

    if (wecomUserId) {
      return this.crmReadonlyService.getUserByWecomSenderId(wecomUserId);
    }

    return undefined;
  }

  private async buildIdentityDiagnostic(
    wecomUserId: string,
  ): Promise<IdentityMappingDiagnosticRecord> {
    const wxUser = this.appStorageService.state.crmWxUsers.find(
      (item) => item.userid === wecomUserId,
    );
    if (!wxUser) {
      throw new NotFoundException('未找到对应的企业微信用户。');
    }

    const syncedUser = this.appStorageService.state.wecomSyncedUsers.find(
      (item) => item.wxUserid === wecomUserId,
    );
    const wxUserMap = this.appStorageService.state.crmWxUserMaps.find(
      (item) => item.wxUserId === wxUser.id,
    );
    if (!wxUserMap) {
      return {
        wecomUserId,
        wecomName: wxUser.name,
        mappingStatus: 'UNMAPPED',
        crmRoleNames: [],
        crmDepartmentIds: wxUser.departmentIds,
        wecomDepartmentIds: syncedUser?.departmentIds ?? wxUser.departmentIds,
        directLeaderUserids: syncedUser?.directLeaderUserids ?? [],
        analysisEnabled: false,
        wecomBotAccessState: 'UNMAPPED_CRM_IDENTITY',
        failedReason: '当前企业微信账号未绑定有效的 CRM 身份。',
        lastDirectorySyncAt: wxUser.updatedAt,
      };
    }

    const mappedUser = await this.resolveIdentityDiagnosticMappedUser(wxUserMap.crmUserId);
    if (!mappedUser) {
      return {
        wecomUserId,
        wecomName: wxUser.name,
        mappingStatus: 'MAPPED',
        crmUserId: wxUserMap.crmUserId,
        crmRoleNames: [],
        crmDepartmentIds: [],
        wecomDepartmentIds: syncedUser?.departmentIds ?? wxUser.departmentIds,
        directLeaderUserids: syncedUser?.directLeaderUserids ?? [],
        analysisEnabled: false,
        wecomBotAccessState: 'RESOURCE_FORBIDDEN',
        failedReason: '已命中 CRM 映射，但实时权限快照加载超时，请稍后重试。',
        lastDirectorySyncAt: wxUser.updatedAt,
      };
    }

    const wecomDecision = this.accessDecisionService.buildDecision(mappedUser, 'wecom-bot');
    const organizationScope = this.organizationScopeService.resolveScope(mappedUser);
    return {
      wecomUserId,
      wecomName: wxUser.name,
      mappingStatus: 'MAPPED',
      crmUserId: mappedUser.id,
      crmUserName: mappedUser.name,
      crmRoleNames: mappedUser.roleNames,
      crmDepartmentIds: mappedUser.departmentIds,
      wecomDepartmentIds: syncedUser?.departmentIds ?? wxUser.departmentIds,
      directLeaderUserids: syncedUser?.directLeaderUserids ?? [],
      organizationScopeSummary: organizationScope.scopeSummary,
      dataScopeGrantSummaries: organizationScope.grantSummaries ?? [],
      analysisEnabled: this.accessDecisionService.hasAction(mappedUser, 'analysis.use'),
      wecomBotAccessState: wecomDecision.state,
      failedReason: wecomDecision.allowed ? undefined : wecomDecision.reason,
      lastDirectorySyncAt: wxUser.updatedAt,
    };
  }

  /**
   * 身份映射诊断优先保证“可诊断”，当实时 CRM 身份装载超时时返回空值做降级，而不是让整接口 500。
   */
  private async resolveIdentityDiagnosticMappedUser(
    crmUserId: string,
  ): Promise<CrmUser | undefined> {
    try {
      return await this.crmReadonlyService.getUserById(crmUserId);
    } catch (error) {
      if (error instanceof QueryExecutionTimeoutError) {
        return undefined;
      }

      throw error;
    }
  }

  /**
   * 治理策略、角色权限和数据范围变更后统一清理短缓存。
   *
   * @returns 无返回值。
   * @throws 不抛出异常；缓存清理失败不应影响已完成的治理配置保存。
   */
  private invalidatePermissionRelatedCaches(): void {
    this.sessionCapabilitiesService.invalidateAllSnapshots();
    this.crmAuthService?.invalidateResolvedSessionUserCache();
  }
}

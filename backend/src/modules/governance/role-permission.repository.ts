import { Inject, Injectable } from '@nestjs/common';
import { AppStorageService } from '../../database/app-storage/app-storage.service';
import type { AccessPolicyRecord, RolePermissionRecord } from '../../shared/types/domain';

const ROLE_NAME_SNAPSHOT_MAP: Record<string, string> = {
  role_sales_director: '销售总监',
  role_region_manager: '区域经理',
  role_sales_vp: '销售副总',
  role_product_manager: '产品经理',
  role_product_director: '产品总监',
  role_admin: '系统管理员',
};

@Injectable()
export class RolePermissionRepository {
  constructor(
    @Inject(AppStorageService)
    private readonly appStorage: AppStorageService,
  ) {}

  listAll(): RolePermissionRecord[] {
    this.ensureInitialized();
    this.backfillManagementReportPermissions();
    this.backfillAdminConnectionPolicyMenu();
    this.backfillSqlAuditPermissions();
    this.pruneDeprecatedTemplateGovernanceMenu();
    return [...(this.appStorage.state.rolePermissions ?? [])];
  }

  findByRoleId(roleId: string): RolePermissionRecord | undefined {
    this.ensureInitialized();
    this.backfillManagementReportPermissions();
    this.backfillAdminConnectionPolicyMenu();
    this.backfillSqlAuditPermissions();
    this.pruneDeprecatedTemplateGovernanceMenu();
    return this.appStorage.state.rolePermissions.find((item) => item.roleId === roleId);
  }

  save(record: RolePermissionRecord): RolePermissionRecord {
    this.ensureInitialized();
    const currentIndex = this.appStorage.state.rolePermissions.findIndex(
      (item) => item.roleId === record.roleId,
    );

    if (currentIndex >= 0) {
      this.appStorage.state.rolePermissions[currentIndex] = record;
      this.appStorage.persist();
      return record;
    }

    this.appStorage.state.rolePermissions.push(record);
    this.appStorage.persist();
    return record;
  }

  private ensureInitialized(): void {
    if (Array.isArray(this.appStorage.state.rolePermissions)) {
      if (this.appStorage.state.rolePermissions.length > 0) {
        return;
      }
    }

    this.appStorage.state.rolePermissions = this.buildLegacyRolePermissions(
      this.appStorage.state.policy,
    );
    this.appStorage.persist();
  }

  /**
   * 为历史持久化的角色权限快照回填经营报表菜单与动作，避免新增权限点后老数据永远缺项。
   */
  private backfillManagementReportPermissions(): void {
    if (!Array.isArray(this.appStorage.state.rolePermissions)) {
      return;
    }

    this.appStorage.state.rolePermissions = this.appStorage.state.rolePermissions.map((item) => {
      if (item.visibleMenus.includes('management-report')) {
        return item;
      }

      const shouldGrantView =
        item.status === 'ACTIVE' &&
        (item.visibleMenus.includes('analysis-workbench') || item.actionKeys.includes('analysis.use'));
      if (!shouldGrantView) {
        return item;
      }

      const nextVisibleMenus = Array.from(
        new Set([...item.visibleMenus, 'management-report']),
      );
      const nextActionKeys = Array.from(
        new Set([
          ...item.actionKeys,
          'management.report.view',
          ...(item.exportAllowed || item.actionKeys.includes('analysis.export')
            ? ['management.report.export']
            : []),
        ]),
      );

      return {
        ...item,
        visibleMenus: nextVisibleMenus,
        actionKeys: nextActionKeys,
        changeReason: item.changeReason
          ? `${item.changeReason}；已自动回填经营报表权限。`
          : '已自动回填经营报表权限。',
      };
    });
  }

  /**
   * 为已具备普通审计能力的系统管理员回填 SQL 审计动作，避免历史快照缺少新动作位。
   */
  private backfillSqlAuditPermissions(): void {
    if (!Array.isArray(this.appStorage.state.rolePermissions)) {
      return;
    }

    this.appStorage.state.rolePermissions = this.appStorage.state.rolePermissions.map((item) => {
      if (
        item.actionKeys.includes('audit.sql.view') &&
        item.actionKeys.includes('audit.sql.view_sensitive')
      ) {
        return item;
      }

      const shouldGrantSqlAudit = item.roleId === 'role_admin';
      if (!shouldGrantSqlAudit) {
        return item;
      }

      return {
        ...item,
        actionKeys: Array.from(
          new Set([
            ...item.actionKeys,
            'audit.sql.view',
            ...(item.roleId === 'role_admin' ? ['audit.sql.view_sensitive'] : []),
          ]),
        ),
        changeReason: item.changeReason
          ? `${item.changeReason}；已自动回填 SQL 审计权限。`
          : '已自动回填 SQL 审计权限。',
      };
    });
  }

  /**
   * 为历史系统管理员快照补齐连接策略菜单。
   * 连接策略仍复用系统级治理动作，只补菜单可见性，避免普通业务角色默认权限被动扩大。
   */
  private backfillAdminConnectionPolicyMenu(): void {
    if (!Array.isArray(this.appStorage.state.rolePermissions)) {
      return;
    }

    this.appStorage.state.rolePermissions = this.appStorage.state.rolePermissions.map((item) => {
      if (item.visibleMenus.includes('connection-policy')) {
        return item;
      }

      const shouldGrantConnectionPolicy =
        item.roleId === 'role_admin' && item.actionKeys.includes('governance.policy.manage');
      if (!shouldGrantConnectionPolicy) {
        return item;
      }

      return {
        ...item,
        visibleMenus: Array.from(new Set([...item.visibleMenus, 'connection-policy'])),
        changeReason: item.changeReason
          ? `${item.changeReason}；已自动回填连接策略菜单。`
          : '已自动回填连接策略菜单。',
      };
    });
  }

  /**
   * 查询模板已迁移到智能分析页，历史角色快照中残留的独立模板菜单需要剔除。
   * 这里只移除菜单可见性，不清理 `template.manage` / `template.sql.write` 动作，避免影响智能分析页内的模板治理入口。
   */
  private pruneDeprecatedTemplateGovernanceMenu(): void {
    if (!Array.isArray(this.appStorage.state.rolePermissions)) {
      return;
    }

    this.appStorage.state.rolePermissions = this.appStorage.state.rolePermissions.map((item) => {
      if (!item.visibleMenus.includes('template-governance')) {
        return item;
      }

      return {
        ...item,
        visibleMenus: item.visibleMenus.filter((menuKey) => menuKey !== 'template-governance'),
        changeReason: item.changeReason
          ? `${item.changeReason}；已移除独立查询模板菜单。`
          : '已移除独立查询模板菜单。',
      };
    });
  }

  private buildLegacyRolePermissions(
    policy: AccessPolicyRecord,
  ): RolePermissionRecord[] {
    const reviewerRoleIds = this.parseRoleIds(
      process.env.CONTRACT_REVIEW_REVIEWER_ROLE_IDS,
      ['role_admin'],
    );
    const downloaderRoleIds = this.parseRoleIds(
      process.env.CONTRACT_REVIEW_DOWNLOADER_ROLE_IDS,
      ['role_admin'],
    );
    const roleIds = Array.from(
      new Set([
        ...policy.enabledRoleIds,
        ...policy.exportRoleIds,
        ...reviewerRoleIds,
        ...downloaderRoleIds,
      ]),
    );

    return roleIds.map((roleId) => {
      const isAdmin = roleId === 'role_admin';
      const analysisEnabled = isAdmin || policy.enabledRoleIds.includes(roleId);
      const exportAllowed = isAdmin || policy.exportRoleIds.includes(roleId);
      const crossViewAllowed = reviewerRoleIds.includes(roleId);
      const crossDownloadAllowed = downloaderRoleIds.includes(roleId);
      const visibleMenus = analysisEnabled ? ['analysis-workbench', 'management-report'] : [];

      if (crossViewAllowed || crossDownloadAllowed) {
        visibleMenus.push('contract-review');
      }

      if (isAdmin) {
        visibleMenus.push(
          'contract-review',
          'permission-center',
          'connection-policy',
          'audit-center',
          'ai-model-governance',
        );
      }

      const actionKeys = analysisEnabled
        ? ['analysis.use', 'analysis.follow_up', 'management.report.view', 'template.view']
        : [];

      if (policy.enabledChannels.includes('wecom-bot') && analysisEnabled) {
        actionKeys.push('wecom.analysis.use');
      }

      if (exportAllowed) {
        actionKeys.push('analysis.export');
        actionKeys.push('management.report.export');
      }

      if (crossViewAllowed) {
        actionKeys.push('contract.review.cross_view');
      }

      if (crossDownloadAllowed) {
        actionKeys.push('contract.review.cross_download');
      }

      if (isAdmin) {
        actionKeys.push(
          'template.manage',
          'wecom.customer.create',
          'wecom.opportunity.create',
          'wecom.followup.writeback',
          'wecom.daily_report.preview',
          'governance.policy.manage',
          'audit.view',
          'audit.sql.view',
          'audit.sql.view_sensitive',
          'ai_profile.manage',
          'contract.review.upload',
        );
      }

      return {
        roleId,
        roleNameSnapshot: ROLE_NAME_SNAPSHOT_MAP[roleId] ?? roleId,
        status: 'ACTIVE',
        visibleMenus: Array.from(new Set(visibleMenus)),
        actionKeys: Array.from(new Set(actionKeys)),
        webConsoleEnabled: analysisEnabled || crossViewAllowed || crossDownloadAllowed || isAdmin,
        wecomBotEligible:
          policy.enabledChannels.includes('wecom-bot') && analysisEnabled,
        exportAllowed,
        templateManageAllowed: isAdmin,
        contractReviewUploadAllowed: isAdmin,
        contractReviewCrossViewAllowed: crossViewAllowed,
        contractReviewCrossDownloadAllowed: crossDownloadAllowed,
        updatedBy: 'system',
        updatedAt: new Date().toISOString(),
        changeReason: isAdmin
          ? '首次部署默认向系统管理员开放全量权限，确保可直接进入权限中心完成后续配置'
          : '从历史全局策略自动迁移生成默认角色权限',
      };
    });
  }

  private parseRoleIds(value: string | undefined, defaults: string[]): string[] {
    const roleIds = value
      ?.split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    return roleIds && roleIds.length > 0 ? roleIds : defaults;
  }
}

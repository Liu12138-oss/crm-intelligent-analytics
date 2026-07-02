import {
  buildRolePermissionFromSimplifiedProfile,
  buildSimplifiedPermissionProfile,
} from '../../../src/modules/governance/simplified-permission-profile';
import type { RolePermissionRecord } from '../../../src/shared/types/domain';

function createRolePermission(
  overrides: Partial<RolePermissionRecord> = {},
): RolePermissionRecord {
  return {
    roleId: 'role_sales',
    roleNameSnapshot: '销售角色',
    status: 'ACTIVE',
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
    updatedAt: '2026-05-22T00:00:00.000Z',
    ...overrides,
  };
}

describe('simplified permission profile', () => {
  it('应按历史可用能力回显菜单包和风险子权限', () => {
    const profile = buildSimplifiedPermissionProfile(
      createRolePermission({
        visibleMenus: ['analysis-workbench', 'contract-review', 'audit-center'],
        actionKeys: [
          'analysis.follow_up',
          'analysis.export',
          'contract.review.cross_download',
          'audit.sql.view',
        ],
        wecomBotEligible: true,
      }),
    );

    expect(profile).toMatchObject({
      menus: {
        analysis: true,
        contractReview: true,
        auditCenter: true,
        wecomBot: true,
      },
      risks: {
        analysisExport: true,
        contractCrossDownload: true,
      },
      legacyWarnings: [],
    });
  });

  it('应将简化配置规范化保存为旧运行时字段', () => {
    const record = buildRolePermissionFromSimplifiedProfile(
      createRolePermission({
        roleId: 'role_admin',
        roleNameSnapshot: '系统管理员',
      }),
      {
        menus: {
          analysis: true,
          managementReport: true,
          contractReview: true,
          wecomBot: true,
          permissionCenter: true,
          connectionPolicy: true,
          aiModelGovernance: true,
          auditCenter: true,
        },
        risks: {
          analysisExport: true,
          managementReportExport: true,
          contractCrossView: true,
          contractCrossDownload: true,
        },
      },
    );

    expect(record.visibleMenus).toEqual([
      'analysis-workbench',
      'management-report',
      'contract-review',
      'permission-center',
      'connection-policy',
      'ai-model-governance',
      'audit-center',
    ]);
    expect(record.actionKeys).toEqual([
      'analysis.use',
      'analysis.follow_up',
      'template.view',
      'analysis.export',
      'management.report.view',
      'management.report.export',
      'contract.review.upload',
      'contract.review.cross_view',
      'contract.review.cross_download',
      'wecom.analysis.use',
      'wecom.customer.create',
      'wecom.opportunity.create',
      'wecom.followup.writeback',
      'wecom.daily_report.preview',
      'governance.policy.manage',
      'ai_profile.manage',
      'audit.view',
      'audit.sql.view',
      'audit.sql.view_sensitive',
    ]);
    expect(record).toMatchObject({
      webConsoleEnabled: true,
      wecomBotEligible: true,
      exportAllowed: true,
      templateManageAllowed: false,
      contractReviewUploadAllowed: true,
      contractReviewCrossViewAllowed: true,
      contractReviewCrossDownloadAllowed: true,
    });
  });

  it('未勾选主菜单时应清理其风险子权限并派生关闭 Web 入口', () => {
    const record = buildRolePermissionFromSimplifiedProfile(
      createRolePermission(),
      {
        menus: {
          analysis: false,
          managementReport: false,
          contractReview: false,
          wecomBot: false,
          permissionCenter: false,
          templateGovernance: false,
          connectionPolicy: false,
          aiModelGovernance: false,
          auditCenter: false,
        },
        risks: {
          analysisExport: true,
          managementReportExport: true,
          contractCrossView: true,
          contractCrossDownload: true,
        },
      },
    );

    expect(record.visibleMenus).toEqual([]);
    expect(record.actionKeys).toEqual([]);
    expect(record.webConsoleEnabled).toBe(false);
    expect(record.exportAllowed).toBe(false);
    expect(record.contractReviewCrossViewAllowed).toBe(false);
    expect(record.contractReviewCrossDownloadAllowed).toBe(false);
  });

  it('历史仅开启 Web 入口但没有 Web 菜单时应给出待确认提示', () => {
    const profile = buildSimplifiedPermissionProfile(
      createRolePermission({
        webConsoleEnabled: true,
      }),
    );

    expect(profile.legacyWarnings).toContain('WEB_CONSOLE_WITHOUT_MENU');
    expect(Object.values(profile.menus).some(Boolean)).toBe(false);
  });
});

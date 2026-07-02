import type {
  RolePermissionItem,
  SimplifiedPermissionProfile,
} from '@/types/analysis';

const emptyProfile: SimplifiedPermissionProfile = {
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
    analysisExport: false,
    managementReportExport: false,
    contractCrossView: false,
    contractCrossDownload: false,
  },
  legacyWarnings: [],
};

const wecomActionKeys = [
  'wecom.analysis.use',
  'wecom.customer.create',
  'wecom.opportunity.create',
  'wecom.followup.writeback',
  'wecom.daily_report.preview',
];

const webMenuKeys = [
  'analysis-workbench',
  'management-report',
  'contract-review',
  'permission-center',
  'connection-policy',
  'ai-model-governance',
  'audit-center',
];

/**
 * 前端兜底生成简化权限树，主要兼容尚未升级或缓存中的旧接口响应。
 */
function buildSimplifiedPermissionProfile(
  role: RolePermissionItem | null,
): SimplifiedPermissionProfile {
  if (!role) {
    return structuredClone(emptyProfile);
  }

  if (role.simplifiedPermissionProfile) {
    return {
      menus: {
        ...emptyProfile.menus,
        ...role.simplifiedPermissionProfile.menus,
      },
      risks: {
        ...emptyProfile.risks,
        ...role.simplifiedPermissionProfile.risks,
      },
      legacyWarnings: role.simplifiedPermissionProfile.legacyWarnings ?? [],
    };
  }

  const visibleMenus = new Set(role.visibleMenus);
  const actionKeys = new Set(role.actionKeys);
  const hasMenu = (...keys: string[]) => keys.some((key) => visibleMenus.has(key));
  const hasAction = (...keys: string[]) => keys.some((key) => actionKeys.has(key));
  const legacyWarnings: SimplifiedPermissionProfile['legacyWarnings'] = [];

  if (role.webConsoleEnabled && !webMenuKeys.some((key) => visibleMenus.has(key))) {
    legacyWarnings.push('WEB_CONSOLE_WITHOUT_MENU');
  }

  return {
    menus: {
      analysis: hasMenu('analysis-workbench') || hasAction('analysis.use', 'analysis.follow_up', 'template.view'),
      managementReport: hasMenu('management-report') || hasAction('management.report.view'),
      contractReview:
        hasMenu('contract-review') ||
        hasAction('contract.review.upload') ||
        role.contractReviewUploadAllowed ||
        role.contractReviewCrossViewAllowed ||
        role.contractReviewCrossDownloadAllowed,
      wecomBot: role.wecomBotEligible || wecomActionKeys.some((key) => actionKeys.has(key)),
      permissionCenter: hasMenu('permission-center') || hasAction('governance.policy.manage'),
      templateGovernance: false,
      connectionPolicy: hasMenu('connection-policy') || hasAction('governance.policy.manage'),
      aiModelGovernance: hasMenu('ai-model-governance') || hasAction('ai_profile.manage'),
      auditCenter:
        hasMenu('audit-center') ||
        hasAction('audit.view', 'audit.sql.view', 'audit.sql.view_sensitive'),
    },
    risks: {
      analysisExport: hasAction('analysis.export') || role.exportAllowed,
      managementReportExport: hasAction('management.report.export'),
      contractCrossView:
        hasAction('contract.review.cross_view') || role.contractReviewCrossViewAllowed,
      contractCrossDownload:
        hasAction('contract.review.cross_download') || role.contractReviewCrossDownloadAllowed,
    },
    legacyWarnings,
  };
}

export { buildSimplifiedPermissionProfile };

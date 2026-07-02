import type {
  RolePermissionRecord,
  SimplifiedPermissionMenuProfile,
  SimplifiedPermissionProfile,
  SimplifiedPermissionRiskProfile,
} from '../../shared/types/domain';

const emptyMenus: SimplifiedPermissionMenuProfile = {
  analysis: false,
  managementReport: false,
  contractReview: false,
  wecomBot: false,
  permissionCenter: false,
  templateGovernance: false,
  connectionPolicy: false,
  aiModelGovernance: false,
  auditCenter: false,
};

const emptyRisks: SimplifiedPermissionRiskProfile = {
  analysisExport: false,
  managementReportExport: false,
  contractCrossView: false,
  contractCrossDownload: false,
};

const webMenuKeys = [
  'analysis-workbench',
  'management-report',
  'contract-review',
  'permission-center',
  'connection-policy',
  'ai-model-governance',
  'audit-center',
];

const wecomActionKeys = [
  'wecom.analysis.use',
  'wecom.customer.create',
  'wecom.opportunity.create',
  'wecom.followup.writeback',
  'wecom.daily_report.preview',
];

/**
 * 将历史运行时权限记录回显为管理员可理解的菜单包。
 *
 * @param record 角色权限运行时记录，允许来自历史细粒度字段或新模型规范化字段。
 * @returns 简化权限树；`legacyWarnings` 用于提示历史半配置角色需要管理员确认。
 * @throws 不主动抛出异常；缺失字段按空权限处理。
 */
export function buildSimplifiedPermissionProfile(
  record: RolePermissionRecord,
): SimplifiedPermissionProfile {
  const visibleMenus = new Set(record.visibleMenus ?? []);
  const actionKeys = new Set(record.actionKeys ?? []);
  const hasMenu = (...keys: string[]) => keys.some((key) => visibleMenus.has(key));
  const hasAction = (...keys: string[]) => keys.some((key) => actionKeys.has(key));

  const menus: SimplifiedPermissionMenuProfile = {
    analysis: hasMenu('analysis-workbench') || hasAction('analysis.use', 'analysis.follow_up', 'template.view'),
    managementReport: hasMenu('management-report') || hasAction('management.report.view'),
    contractReview:
      hasMenu('contract-review') ||
      hasAction('contract.review.upload') ||
      record.contractReviewUploadAllowed ||
      record.contractReviewCrossViewAllowed ||
      record.contractReviewCrossDownloadAllowed,
    wecomBot: record.wecomBotEligible || wecomActionKeys.some((key) => actionKeys.has(key)),
    permissionCenter: hasMenu('permission-center') || hasAction('governance.policy.manage'),
    templateGovernance: false,
    connectionPolicy: hasMenu('connection-policy') || hasAction('governance.policy.manage'),
    aiModelGovernance: hasMenu('ai-model-governance') || hasAction('ai_profile.manage'),
    auditCenter:
      hasMenu('audit-center') ||
      hasAction('audit.view', 'audit.sql.view', 'audit.sql.view_sensitive'),
  };

  const risks: SimplifiedPermissionRiskProfile = {
    analysisExport: hasAction('analysis.export') || record.exportAllowed,
    managementReportExport: hasAction('management.report.export'),
    contractCrossView:
      hasAction('contract.review.cross_view') || record.contractReviewCrossViewAllowed,
    contractCrossDownload:
      hasAction('contract.review.cross_download') ||
      record.contractReviewCrossDownloadAllowed,
  };

  const legacyWarnings: SimplifiedPermissionProfile['legacyWarnings'] = [];
  if (record.webConsoleEnabled && !webMenuKeys.some((key) => visibleMenus.has(key))) {
    legacyWarnings.push('WEB_CONSOLE_WITHOUT_MENU');
  }

  return {
    menus,
    risks,
    legacyWarnings,
  };
}

/**
 * 将管理员提交的菜单包规范化为现有后端执行链路消费的运行时字段。
 *
 * @param baseRecord 原角色记录或待创建默认记录，用于保留角色标识、名称、状态和审计字段。
 * @param profile 简化权限树载荷。
 * @returns 已生成 `visibleMenus`、`actionKeys` 和兼容布尔字段的角色权限记录。
 * @throws 不主动抛出异常；未知字段会被忽略。
 */
export function buildRolePermissionFromSimplifiedProfile(
  baseRecord: RolePermissionRecord,
  profile: {
    menus?: Partial<SimplifiedPermissionMenuProfile>;
    risks?: Partial<SimplifiedPermissionRiskProfile>;
  },
): RolePermissionRecord {
  const menus = {
    ...emptyMenus,
    ...(profile.menus ?? {}),
  };
  const risks = {
    ...emptyRisks,
    ...(profile.risks ?? {}),
  };
  const visibleMenus: string[] = [];
  const actionKeys: string[] = [];

  if (menus.analysis) {
    visibleMenus.push('analysis-workbench');
    actionKeys.push('analysis.use', 'analysis.follow_up', 'template.view');
    if (risks.analysisExport) {
      actionKeys.push('analysis.export');
    }
  }

  if (menus.managementReport) {
    visibleMenus.push('management-report');
    actionKeys.push('management.report.view');
    if (risks.managementReportExport) {
      actionKeys.push('management.report.export');
    }
  }

  if (menus.contractReview) {
    visibleMenus.push('contract-review');
    actionKeys.push('contract.review.upload');
    if (risks.contractCrossView) {
      actionKeys.push('contract.review.cross_view');
    }
    if (risks.contractCrossDownload) {
      actionKeys.push('contract.review.cross_download');
    }
  }

  if (menus.wecomBot) {
    actionKeys.push(...wecomActionKeys);
  }

  if (menus.permissionCenter) {
    visibleMenus.push('permission-center');
    actionKeys.push('governance.policy.manage');
  }

  if (menus.connectionPolicy) {
    visibleMenus.push('connection-policy');
    actionKeys.push('governance.policy.manage');
  }

  if (menus.aiModelGovernance) {
    visibleMenus.push('ai-model-governance');
    actionKeys.push('ai_profile.manage');
  }

  if (menus.auditCenter) {
    visibleMenus.push('audit-center');
    actionKeys.push('audit.view', 'audit.sql.view', 'audit.sql.view_sensitive');
  }

  const normalizedVisibleMenus = Array.from(new Set(visibleMenus));
  const normalizedActionKeys = Array.from(new Set(actionKeys));
  const normalizedProfile = buildSimplifiedPermissionProfile({
    ...baseRecord,
    visibleMenus: normalizedVisibleMenus,
    actionKeys: normalizedActionKeys,
    webConsoleEnabled: normalizedVisibleMenus.length > 0,
    wecomBotEligible: menus.wecomBot,
    exportAllowed: menus.analysis && risks.analysisExport,
    templateManageAllowed: false,
    contractReviewUploadAllowed: menus.contractReview,
    contractReviewCrossViewAllowed: menus.contractReview && risks.contractCrossView,
    contractReviewCrossDownloadAllowed:
      menus.contractReview && risks.contractCrossDownload,
  });

  return {
    ...baseRecord,
    visibleMenus: normalizedVisibleMenus,
    actionKeys: normalizedActionKeys,
    webConsoleEnabled: normalizedVisibleMenus.length > 0,
    wecomBotEligible: menus.wecomBot,
    exportAllowed: menus.analysis && risks.analysisExport,
    templateManageAllowed: false,
    contractReviewUploadAllowed: menus.contractReview,
    contractReviewCrossViewAllowed: menus.contractReview && risks.contractCrossView,
    contractReviewCrossDownloadAllowed:
      menus.contractReview && risks.contractCrossDownload,
    simplifiedPermissionProfile: normalizedProfile,
  };
}

import { z } from 'zod';

const simplifiedPermissionProfileSchema = z.object({
  menus: z
    .object({
      analysis: z.boolean().optional(),
      managementReport: z.boolean().optional(),
      contractReview: z.boolean().optional(),
      wecomBot: z.boolean().optional(),
      permissionCenter: z.boolean().optional(),
      templateGovernance: z.boolean().optional(),
      connectionPolicy: z.boolean().optional(),
      aiModelGovernance: z.boolean().optional(),
      auditCenter: z.boolean().optional(),
    })
    .default({}),
  risks: z
    .object({
      analysisExport: z.boolean().optional(),
      managementReportExport: z.boolean().optional(),
      contractCrossView: z.boolean().optional(),
      contractCrossDownload: z.boolean().optional(),
    })
    .default({}),
});

export const updateRolePermissionSchema = z.object({
  roleNameSnapshot: z.string().min(1),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  visibleMenus: z.array(z.string()).optional(),
  actionKeys: z.array(z.string()).optional(),
  webConsoleEnabled: z.boolean().optional(),
  wecomBotEligible: z.boolean().optional(),
  exportAllowed: z.boolean().optional(),
  templateManageAllowed: z.boolean().optional(),
  contractReviewUploadAllowed: z.boolean().optional(),
  contractReviewCrossViewAllowed: z.boolean().optional(),
  contractReviewCrossDownloadAllowed: z.boolean().optional(),
  simplifiedPermissionProfile: simplifiedPermissionProfileSchema.optional(),
  changeReason: z.string().trim().min(1).max(200).optional(),
}).superRefine((value, context) => {
  if (value.simplifiedPermissionProfile) {
    return;
  }

  const requiredLegacyFields = [
    'visibleMenus',
    'actionKeys',
    'webConsoleEnabled',
    'wecomBotEligible',
    'exportAllowed',
    'templateManageAllowed',
    'contractReviewUploadAllowed',
    'contractReviewCrossViewAllowed',
    'contractReviewCrossDownloadAllowed',
  ] as const;

  for (const field of requiredLegacyFields) {
    if (typeof value[field] === 'undefined') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: '缺少旧版权限字段或简化权限树。',
      });
    }
  }
});

export const updateWecomPilotPolicySchema = z.object({
  mode: z.enum(['DISABLED', 'PILOT_ONLY', 'FULL']),
  allowUserIds: z.array(z.string()),
  allowRoleIds: z.array(z.string()),
  allowDepartmentIds: z.array(z.string()),
  denyUserIds: z.array(z.string()),
  note: z.string().trim().max(200).optional(),
});

const applicationSuperAdminSubjectSchema = z.object({
  subjectType: z.enum(['USER', 'ROLE']),
  subjectId: z.string().trim().min(1),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export const updateApplicationSuperAdminPolicySchema = z
  .object({
    subjects: z.array(applicationSuperAdminSubjectSchema).optional(),
    fullAccessUserIds: z.array(z.string().trim().min(1)).optional(),
    fullAccessRoleIds: z.array(z.string().trim().min(1)).optional(),
    changeReason: z
      .string()
      .trim()
      .min(1, '请填写调整原因。')
      .max(200, '调整原因不能超过 200 个字符。'),
  })
  .transform((value) => {
    const legacyUserSubjects = (value.fullAccessUserIds ?? []).map((subjectId) => ({
      subjectType: 'USER' as const,
      subjectId,
      status: 'ACTIVE' as const,
    }));
    const legacyRoleSubjects = (value.fullAccessRoleIds ?? []).map((subjectId) => ({
      subjectType: 'ROLE' as const,
      subjectId,
      status: 'ACTIVE' as const,
    }));

    return {
      subjects: [
        ...(value.subjects ?? []),
        ...legacyUserSubjects,
        ...legacyRoleSubjects,
      ],
      changeReason: value.changeReason,
    };
  });

export const updateAnalysisScopePolicySchema = z.object({
  fullAccessUserIds: z.array(z.string().trim().min(1)),
  changeReason: z
    .string()
    .trim()
    .min(1, '请填写调整原因。')
    .max(200, '调整原因不能超过 200 个字符。'),
});

export const accessPreviewSchema = z
  .object({
    crmUserId: z.string().trim().min(1).optional(),
    wecomUserId: z.string().trim().min(1).optional(),
  })
  .refine((value) => Boolean(value.crmUserId || value.wecomUserId), {
    message: '至少需要提供 crmUserId 或 wecomUserId。',
  });

export const updateDataScopeGrantSchema = z.object({
  subjectType: z.enum(['USER', 'ROLE']),
  subjectId: z.string().trim().min(1),
  departmentIds: z.array(z.string().trim().min(1)).min(1),
  includeSubDepartments: z.boolean(),
  reason: z.string().trim().min(1).max(200),
  expiresAt: z.string().trim().min(1).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'EXPIRED']),
});

export const dataScopePreviewSchema = z
  .object({
    crmUserId: z.string().trim().min(1).optional(),
    wecomUserId: z.string().trim().min(1).optional(),
  })
  .refine((value) => Boolean(value.crmUserId || value.wecomUserId), {
    message: '至少需要提供 crmUserId 或 wecomUserId。',
  });

export const updateDailyReportDepartmentPolicySchema = z.object({
  status: z.enum(['ENABLED', 'DISABLED', 'INHERIT']),
  departmentType: z.enum(['REGION', 'SALES', 'NON_SALES', 'UNCLASSIFIED']),
  applyToChildren: z.boolean(),
  overrideRecipientCrmUserId: z.string().trim().min(1).optional(),
  reason: z
    .string()
    .trim()
    .min(1, '请填写策略原因。')
    .max(200, '策略原因不能超过 200 个字符。'),
});

export const dailyReportDeliveryPreviewSchema = z.object({
  businessDate: z.string().trim().min(10),
});

export const upsertDailyReportSalesGroupSchema = z.object({
  groupName: z.string().trim().min(1, '请填写销售小组名称。').max(80),
  linkedDepartmentId: z.string().trim().min(1).optional(),
  regionDepartmentId: z.string().trim().min(1).optional(),
  regionDepartmentName: z.string().trim().min(1).max(80).optional(),
  status: z.enum(['ENABLED', 'DISABLED']),
  recipientCrmUserIds: z.array(z.string().trim().min(1)).optional(),
  recipientCrmUserId: z.string().trim().min(1).optional(),
  memberCrmUserIds: z.array(z.string().trim().min(1)),
  memberOverrideEnabled: z.boolean().default(true),
  reason: z
    .string()
    .trim()
    .min(1, '请填写小组调整原因。')
    .max(200, '小组调整原因不能超过 200 个字符。'),
});

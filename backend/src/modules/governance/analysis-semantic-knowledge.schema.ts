import { z } from 'zod';

const semanticKnowledgeAssetBaseSchema = z.object({
  type: z.enum([
    'ALIAS',
    'TEMPORAL_FIELD_HINT',
    'ORGANIZATION_NORMALIZATION',
    'VALIDATED_EXAMPLE',
    'NEGATIVE_EXAMPLE',
  ]),
  name: z.string().trim().min(1, '请填写资产名称。').max(60, '资产名称不能超过 60 个字符。'),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  matchKeywords: z
    .array(z.string().trim().min(1, '匹配关键词不能为空。'))
    .min(1, '至少需要配置一个匹配关键词。'),
  canonicalLabel: z.string().trim().min(1).max(60).optional(),
  synonyms: z.array(z.string().trim().min(1)).optional(),
  questionText: z.string().trim().min(1).max(200).optional(),
  sqlHint: z.string().trim().min(1).max(200).optional(),
  hint: z.string().trim().min(1).max(200).optional(),
  blockReason: z.string().trim().min(1).max(200).optional(),
  // ===== 学习闭环新增字段（全部可选，向后兼容）=====
  source: z.enum(['MANUAL', 'AUTO_DERIVED']).optional(),
  reviewStatus: z.enum(['PROPOSED', 'ACTIVE', 'REJECTED', 'EXPIRED']).optional(),
  derivedFromQueryIds: z.array(z.string().trim().min(1)).max(20).optional(),
  evidenceCount: z.number().int().min(0).max(9999).optional(),
  confidence: z.number().min(0).max(1).optional(),
  proposedAt: z.string().trim().min(1).optional(),
  reviewedBy: z.string().trim().min(1).optional(),
  reviewedAt: z.string().trim().min(1).optional(),
  expiresAt: z.string().trim().min(1).optional(),
});

export const semanticKnowledgeAssetWriteSchema = semanticKnowledgeAssetBaseSchema.superRefine(
  (value, context) => {
    if (value.type === 'ALIAS') {
      if (!value.canonicalLabel) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: '别名资产必须填写规范标签。',
          path: ['canonicalLabel'],
        });
      }
      if (!value.synonyms?.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: '别名资产必须至少配置一个同义表达。',
          path: ['synonyms'],
        });
      }
      if (!value.hint) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: '别名资产必须填写提示文案。',
          path: ['hint'],
        });
      }
    }

    if (
      value.type === 'TEMPORAL_FIELD_HINT' ||
      value.type === 'ORGANIZATION_NORMALIZATION'
    ) {
      if (!value.hint) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: '提示型资产必须填写提示文案。',
          path: ['hint'],
        });
      }
    }

    if (value.type === 'VALIDATED_EXAMPLE') {
      if (!value.questionText) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: '已验证问法必须填写示例问题。',
          path: ['questionText'],
        });
      }
      if (!value.sqlHint) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: '已验证问法必须填写执行提示。',
          path: ['sqlHint'],
        });
      }
    }

    if (value.type === 'NEGATIVE_EXAMPLE' && !value.blockReason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: '高风险问法必须填写阻断原因。',
        path: ['blockReason'],
      });
    }
  },
);

export const semanticKnowledgeAssetStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']),
});

export const semanticKnowledgePublishSchema = z.object({
  changeSummary: z
    .string()
    .trim()
    .min(1, '请填写发布说明。')
    .max(200, '发布说明不能超过 200 个字符。'),
});

export const semanticKnowledgeRollbackSchema = z.object({
  version: z.string().trim().min(1, '请提供需要回退的版本号。'),
  reason: z
    .string()
    .trim()
    .min(1, '请填写回退原因。')
    .max(200, '回退原因不能超过 200 个字符。'),
});

/**
 * 候选资产审核 schema。
 *
 * 管理员在治理后台对 PROPOSED 候选进行审核（通过或驳回）时使用。
 */
export const semanticKnowledgeAssetReviewSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  reason: z
    .string()
    .trim()
    .max(200, '审核理由不能超过 200 个字符。')
    .optional(),
});

/**
 * 学习闭环反馈 schema。
 *
 * Web 端和企微端统一使用该结构提交用户对分析结果的反馈。
 */
export const analysisResultFeedbackSchema = z.object({
  queryId: z.string().trim().min(1, '请提供查询 ID。'),
  feedbackType: z.enum(['USEFUL', 'NOT_USEFUL', 'CALIBRATION_ISSUE', 'DIMENSION_REQUEST']),
  feedbackText: z
    .string()
    .trim()
    .max(500, '反馈内容不能超过 500 个字符。')
    .optional(),
  requestedDimensions: z.array(z.string().trim().min(1)).max(10).optional(),
  feedbackSource: z.enum(['WEB', 'WECOM_FEEDBACK_EVENT']).optional(),
});

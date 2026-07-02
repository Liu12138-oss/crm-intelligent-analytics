import { z } from 'zod';

const nonEmptyTrimmedString = (fieldLabel: string) =>
  z
    .string({
      required_error: `${fieldLabel}不能为空`,
      invalid_type_error: `${fieldLabel}格式不正确`,
    })
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, {
      message: `${fieldLabel}不能为空`,
    });

const optionalTrimmedString = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}, z.string().optional());

const optionalNumber = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }

  return value;
}, z.number().finite().optional());

const requiredPositiveNumber = (fieldLabel: string) =>
  z.preprocess((value) => {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return undefined;
      }

      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : value;
    }

    return value;
  }, z.number({
    required_error: `${fieldLabel}不能为空`,
    invalid_type_error: `${fieldLabel}格式不正确`,
  }).positive(`${fieldLabel}必须大于 0`));

const customFieldValueSchema = z.union([z.string(), z.number(), z.boolean()]);

export const createCustomerRequestSchema = z.object({
  name: nonEmptyTrimmedString('名称'),
  phone: nonEmptyTrimmedString('电话'),
  itDecisionLocation: nonEmptyTrimmedString('IT决策权所在地'),
  unifiedSocialCreditCode: nonEmptyTrimmedString('统一社会信用代码'),
  ownerUserId: optionalTrimmedString,
  wantDepartmentId: optionalTrimmedString,
  category: optionalTrimmedString,
  source: optionalTrimmedString,
  note: optionalTrimmedString,
  parentCustomerId: optionalTrimmedString,
  industry: optionalTrimmedString,
  customFields: z.record(customFieldValueSchema).optional(),
});

export type CreateCustomerRequest = z.infer<typeof createCustomerRequestSchema>;

export const createOpportunityProductSchema = z.object({
  productId: nonEmptyTrimmedString('关联产品'),
  recommendedUnitPrice: optionalNumber,
  quantity: optionalNumber,
  remark: optionalTrimmedString,
});

export const createOpportunityRequestSchema = z.object({
  title: nonEmptyTrimmedString('项目名称'),
  customerId: nonEmptyTrimmedString('最终客户'),
  customerName: optionalTrimmedString,
  leadCode: nonEmptyTrimmedString('线索编号'),
  expectAmount: requiredPositiveNumber('预计有效收入'),
  expectSignDate: nonEmptyTrimmedString('预计签单日期'),
  renewalContractCode: nonEmptyTrimmedString('被续签合同号'),
  agentFullName: nonEmptyTrimmedString('代理商全称'),
  projectStatusSummary: nonEmptyTrimmedString('项目现状及关键点'),
  preSalesName: nonEmptyTrimmedString('售前'),
  ownerUserId: optionalTrimmedString,
  wantDepartmentId: optionalTrimmedString,
  stage: optionalTrimmedString,
  source: optionalTrimmedString,
  kind: optionalTrimmedString,
  note: optionalTrimmedString,
  customerRequirement: optionalTrimmedString,
  getTime: optionalTrimmedString,
  customFields: z.record(customFieldValueSchema).optional(),
  productAssets: z
    .array(createOpportunityProductSchema, {
      required_error: '关联产品不能为空',
      invalid_type_error: '关联产品格式不正确',
    })
    .min(1, '关联产品不能为空'),
  contactIds: z
    .array(nonEmptyTrimmedString('关联联系人'))
    .optional(),
});

export type CreateOpportunityRequest = z.infer<typeof createOpportunityRequestSchema>;

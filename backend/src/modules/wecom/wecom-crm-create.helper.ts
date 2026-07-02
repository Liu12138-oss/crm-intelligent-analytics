import type {
  CrmCreateEntityType,
  CrmUser,
  WecomCustomerCreateDraft,
  WecomOpportunityCreateDraft,
} from '../../shared/types/domain';
import {
  matchesWecomExactReply,
  WECOM_COMMON_CONFIRM_REPLIES,
} from './wecom-reply-intent.helper';
import { selectWecomCandidateByReply } from './wecom-candidate-selection.helper';

const CUSTOMER_FIELD_ALIASES: Record<string, keyof WecomCustomerCreateDraft> = {
  名称: 'name',
  客户名称: 'name',
  电话: 'phone',
  联系电话: 'phone',
  IT决策权所在地: 'itDecisionLocation',
  统一社会信用代码: 'unifiedSocialCreditCode',
  负责人ID: 'ownerUserId',
  所属部门ID: 'wantDepartmentId',
  客户类型: 'category',
  客户来源: 'source',
  备注: 'note',
  父客户ID: 'parentCustomerId',
  行业: 'industry',
};

const OPPORTUNITY_FIELD_ALIASES: Record<
  string,
  keyof WecomOpportunityCreateDraft | 'productInput'
> = {
  项目名称: 'title',
  最终客户: 'customerName',
  最终客户ID: 'customerId',
  线索编号: 'leadCode',
  关联产品: 'productInput',
  关联产品ID: 'productInput',
  预计有效收入: 'expectAmount',
  预计签单日期: 'expectSignDate',
  被续签合同号: 'renewalContractCode',
  代理商全称: 'agentFullName',
  项目现状及关键点: 'projectStatusSummary',
  售前: 'preSalesName',
  负责人ID: 'ownerUserId',
  所属部门ID: 'wantDepartmentId',
  销售阶段: 'stage',
  商机来源: 'source',
  商机类型: 'kind',
  备注: 'note',
  客户诉求: 'customerRequirement',
  获得时间: 'getTime',
};

export const WECOM_CRM_CREATE_CONFIRM_KEYWORDS = [...WECOM_COMMON_CONFIRM_REPLIES];
export const WECOM_CRM_CREATE_CANCEL_KEYWORDS = [
  '取消',
  '不建了',
  '先不建',
  '先不用',
  '不做了',
  '先不做了',
  '先停一下',
  '停止',
  '停一下',
];
export const WECOM_CRM_CREATE_RETRY_KEYWORDS = ['重试', '再试一次', '重新创建'];
export const WECOM_CUSTOMER_CREATE_ENTRY_KEYWORDS = [
  '新增客户',
  '新建客户',
  '创建客户',
  '建客户',
  '帮我新增客户',
  '帮我新建客户',
  '帮我创建客户',
];
export const WECOM_OPPORTUNITY_CREATE_ENTRY_KEYWORDS = [
  '新增商机',
  '新建商机',
  '创建商机',
  '建商机',
  '帮我新增商机',
  '帮我新建商机',
  '帮我创建商机',
];

const WECOM_CRM_CREATE_ANALYSIS_BLOCK_TOKENS = [
  '金额',
  '排名',
  '趋势',
  '分析',
  '统计',
  '查询',
  '明细',
  '多少',
  '多久',
  '多长时间',
  '时长',
  '报备',
  '未报备',
  '没有报备',
  '未建商机',
  '无商机',
  '赢单率',
  '转化率',
  '本月',
  '本季度',
  '本年',
  '最近',
  '环比',
  '同比',
];

export function detectWecomCrmCreateIntent(
  messageText?: string,
): CrmCreateEntityType | undefined {
  const normalizedText = normalizeText(messageText);
  if (!normalizedText) {
    return undefined;
  }

  if (
    WECOM_CRM_CREATE_ANALYSIS_BLOCK_TOKENS.some((item) =>
      normalizedText.includes(item),
    )
  ) {
    return undefined;
  }

  if (
    WECOM_CUSTOMER_CREATE_ENTRY_KEYWORDS.some(
      (item) => normalizedText === item || normalizedText.startsWith(item),
    )
  ) {
    return 'Customer';
  }

  if (
    WECOM_OPPORTUNITY_CREATE_ENTRY_KEYWORDS.some((item) =>
      normalizedText === item || normalizedText.startsWith(item),
    )
  ) {
    return 'Opportunity';
  }

  return undefined;
}

export function isWecomCrmCreateConfirmMessage(messageText?: string): boolean {
  return matchesWecomExactReply(messageText, WECOM_CRM_CREATE_CONFIRM_KEYWORDS);
}

export function isWecomCrmCreateCancelMessage(messageText?: string): boolean {
  return WECOM_CRM_CREATE_CANCEL_KEYWORDS.some((item) =>
    normalizeText(messageText).includes(item),
  );
}

export function isWecomCrmCreateRetryMessage(messageText?: string): boolean {
  return WECOM_CRM_CREATE_RETRY_KEYWORDS.some((item) =>
    normalizeText(messageText).includes(item),
  );
}

export function parseCustomerDraftUpdates(
  messageText?: string,
): Partial<WecomCustomerCreateDraft> {
  const updates: Partial<WecomCustomerCreateDraft> = {};
  for (const { key, value } of extractLabeledPairs(messageText)) {
    const fieldKey = CUSTOMER_FIELD_ALIASES[key];
    if (!fieldKey) {
      continue;
    }

    updates[fieldKey] = value;
  }

  return updates;
}

export function parseOpportunityDraftUpdates(
  messageText: string | undefined,
  productAliasMap: Record<string, string>,
): {
  updates: Partial<WecomOpportunityCreateDraft>;
  unresolvedProducts: string[];
} {
  const updates: Partial<WecomOpportunityCreateDraft> = {};
  const unresolvedProducts: string[] = [];

  for (const { key, value } of extractLabeledPairs(messageText)) {
    const fieldKey = OPPORTUNITY_FIELD_ALIASES[key];
    if (!fieldKey) {
      continue;
    }

    if (fieldKey === 'productInput') {
      const resolution = resolveProductIds(value, productAliasMap);
      if (resolution.productIds.length > 0) {
        updates.productIds = resolution.productIds;
      }
      unresolvedProducts.push(...resolution.unresolvedNames);
      continue;
    }

    if (fieldKey === 'expectAmount') {
      const parsedAmount = parseAmount(value);
      if (parsedAmount !== undefined) {
        updates.expectAmount = parsedAmount;
      }
      continue;
    }

    (updates as Record<string, unknown>)[fieldKey] = value;
  }

  return {
    updates,
    unresolvedProducts,
  };
}

export function getMissingCustomerFields(
  draft: WecomCustomerCreateDraft,
  options?: {
    requireCategory?: boolean;
    requireSource?: boolean;
  },
): string[] {
  const missingFields: string[] = [];
  if (!draft.name) {
    missingFields.push('名称');
  }
  if (!draft.phone) {
    missingFields.push('电话');
  }
  if (!draft.itDecisionLocation) {
    missingFields.push('IT决策权所在地');
  }
  if (!draft.unifiedSocialCreditCode) {
    missingFields.push('统一社会信用代码');
  }
  if (options?.requireCategory && !draft.category) {
    missingFields.push('客户类型');
  }
  if (options?.requireSource && !draft.source) {
    missingFields.push('客户来源');
  }

  return missingFields;
}

export function getMissingOpportunityFields(
  draft: WecomOpportunityCreateDraft,
): string[] {
  const missingFields: string[] = [];
  if (!draft.title) {
    missingFields.push('项目名称');
  }
  if (!draft.customerId && !draft.customerName) {
    missingFields.push('最终客户');
  }
  if (!draft.leadCode) {
    missingFields.push('线索编号');
  }
  if (!draft.productIds?.length) {
    missingFields.push('关联产品');
  }
  if (!draft.expectAmount) {
    missingFields.push('预计有效收入');
  }
  if (!draft.expectSignDate) {
    missingFields.push('预计签单日期');
  }
  if (!draft.renewalContractCode) {
    missingFields.push('被续签合同号');
  }
  if (!draft.agentFullName) {
    missingFields.push('代理商全称');
  }
  if (!draft.projectStatusSummary) {
    missingFields.push('项目现状及关键点');
  }
  if (!draft.preSalesName) {
    missingFields.push('售前');
  }

  return missingFields;
}

export function buildCustomerCreateEntryPrompt(options?: {
  requireCategory?: boolean;
  requireSource?: boolean;
}): string {
  const lines = [
    '已进入受控新建客户流程，请按以下格式补充客户信息：',
    '名称：',
    '电话：',
    'IT决策权所在地：',
    '统一社会信用代码：',
  ];

  if (options?.requireCategory) {
    lines.push('客户类型：');
  }
  if (options?.requireSource) {
    lines.push('客户来源：');
  }

  lines.push('如果已有部分信息，也可以只发缺失字段，我会继续合并。');
  return lines.join('\n');
}

export function buildCustomerCreateCollectPrompt(
  draft: WecomCustomerCreateDraft,
  missingFields: string[],
  failureReason?: string,
): string {
  const filledLines = buildFilledLines([
    ['名称', draft.name],
    ['电话', draft.phone],
    ['IT决策权所在地', draft.itDecisionLocation],
    ['统一社会信用代码', draft.unifiedSocialCreditCode],
    ['客户类型', draft.category],
    ['客户来源', draft.source],
  ]);

  return [
    failureReason ? `上次创建失败：${failureReason}` : undefined,
    filledLines.length > 0 ? '我已记录这些客户信息：' : undefined,
    ...filledLines,
    `当前还缺少：${missingFields.join('、')}`,
    '请继续按“字段名：字段值”的格式补充；回复“取消”可结束本次创建。',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildCustomerCreateSummaryPrompt(
  draft: WecomCustomerCreateDraft,
  user: CrmUser,
  options?: {
    defaultCategory?: string;
    defaultSource?: string;
  },
): string {
  return [
    '请确认以下客户创建摘要：',
    `名称：${draft.name ?? '-'}`,
    `电话：${draft.phone ?? '-'}`,
    `IT决策权所在地：${draft.itDecisionLocation ?? '-'}`,
    `统一社会信用代码：${draft.unifiedSocialCreditCode ?? '-'}`,
    `客户类型：${draft.category ?? options?.defaultCategory ?? '-'}`,
    `客户来源：${draft.source ?? options?.defaultSource ?? '-'}`,
    `负责人ID：${draft.ownerUserId ?? user.id}`,
    `所属部门ID：${draft.wantDepartmentId ?? user.departmentIds[0] ?? '-'}`,
    '回复“确认”立即创建；继续发送“字段名：字段值”可覆盖草稿；回复“取消”可结束本次创建。',
  ].join('\n');
}

export function buildOpportunityCreateEntryPrompt(): string {
  return [
    '已进入受控新建商机流程，请按以下格式补充商机信息：',
    '项目名称：',
    '最终客户：客户名称或客户ID',
    '线索编号：',
    '关联产品：产品别名或产品ID，多个可用顿号/逗号分隔',
    '预计有效收入：',
    '预计签单日期：',
    '被续签合同号：',
    '代理商全称：',
    '项目现状及关键点：',
    '售前：',
    '如果已有部分信息，也可以只发缺失字段，我会继续合并。',
  ].join('\n');
}

export function buildOpportunityCreateCollectPrompt(
  draft: WecomOpportunityCreateDraft,
  missingFields: string[],
  params?: {
    unresolvedProducts?: string[];
    failureReason?: string;
    customerCandidateLines?: string[];
    candidateRetryHint?: string;
  },
): string {
  const filledLines = buildFilledLines([
    ['项目名称', draft.title],
    ['最终客户', draft.customerName ?? draft.customerId],
    ['线索编号', draft.leadCode],
    ['关联产品ID', draft.productIds?.join('、')],
    ['预计有效收入', draft.expectAmount ? String(draft.expectAmount) : undefined],
    ['预计签单日期', draft.expectSignDate],
    ['被续签合同号', draft.renewalContractCode],
    ['代理商全称', draft.agentFullName],
    ['项目现状及关键点', draft.projectStatusSummary],
    ['售前', draft.preSalesName],
  ]);

  return [
    params?.failureReason ? `上次创建失败：${params.failureReason}` : undefined,
    filledLines.length > 0 ? '我已记录这些商机信息：' : undefined,
    ...filledLines,
    params?.customerCandidateLines?.length ? '当前客户有多个候选，请从下面选择：' : undefined,
    ...(params?.customerCandidateLines ?? []),
    params?.unresolvedProducts?.length
      ? `以下关联产品暂未识别：${params.unresolvedProducts.join('、')}`
      : undefined,
    missingFields.length > 0 ? `当前还缺少：${missingFields.join('、')}` : undefined,
    '请继续按“字段名：字段值”的格式补充；回复“取消”可结束本次创建。',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildOpportunityCreateSummaryPrompt(
  draft: WecomOpportunityCreateDraft,
  user: CrmUser,
): string {
  return [
    '请确认以下商机创建摘要：',
    `项目名称：${draft.title ?? '-'}`,
    `最终客户：${draft.customerName ?? draft.customerId ?? '-'}`,
    `线索编号：${draft.leadCode ?? '-'}`,
    `关联产品ID：${draft.productIds?.join('、') ?? '-'}`,
    `预计有效收入：${draft.expectAmount ?? '-'}`,
    `预计签单日期：${draft.expectSignDate ?? '-'}`,
    `被续签合同号：${draft.renewalContractCode ?? '-'}`,
    `代理商全称：${draft.agentFullName ?? '-'}`,
    `项目现状及关键点：${draft.projectStatusSummary ?? '-'}`,
    `售前：${draft.preSalesName ?? '-'}`,
    `负责人ID：${draft.ownerUserId ?? user.id}`,
    `所属部门ID：${draft.wantDepartmentId ?? user.departmentIds[0] ?? '-'}`,
    '回复“确认”立即创建；继续发送“字段名：字段值”可覆盖草稿；回复“取消”可结束本次创建。',
  ].join('\n');
}

export function buildCrmCreateSuccessPrompt(params: {
  entityType: CrmCreateEntityType;
  title: string;
  resultId: string;
  createdAt: string;
}): string {
  const entityLabel = params.entityType === 'Customer' ? '客户' : '商机';
  return `${entityLabel}「${params.title}」已创建成功，ID：${params.resultId}，创建时间：${params.createdAt}。`;
}

export function buildCrmCreateCancelledPrompt(
  entityType: CrmCreateEntityType,
): string {
  return `已取消本次${entityType === 'Customer' ? '客户' : '商机'}创建。`;
}

export function buildCrmCreateDuplicatePrompt(
  entityType: CrmCreateEntityType,
  resultSummary?: string,
): string {
  return resultSummary ??
    `${entityType === 'Customer' ? '客户' : '商机'}已创建成功，本次不会重复执行。`;
}

export function selectCustomerCandidateByReply(
  messageText: string | undefined,
  candidates: Array<{ id: string; name: string }>,
): { id: string; name: string } | undefined {
  return selectWecomCandidateByReply(messageText, candidates).candidate;
}

function resolveProductIds(
  rawValue: string,
  productAliasMap: Record<string, string>,
): {
  productIds: string[];
  unresolvedNames: string[];
} {
  const tokens = rawValue
    .split(/[、,，;；]/u)
    .map((item) => item.trim())
    .filter(Boolean);
  const productIds: string[] = [];
  const unresolvedNames: string[] = [];

  for (const token of tokens) {
    if (/^[A-Za-z0-9_-]{4,}$/u.test(token)) {
      productIds.push(token);
      continue;
    }

    const mappedId =
      productAliasMap[token] ??
      productAliasMap[normalizeText(token)] ??
      productAliasMap[token.replace(/\s+/gu, '')];
    if (mappedId) {
      productIds.push(mappedId);
      continue;
    }

    unresolvedNames.push(token);
  }

  return {
    productIds: Array.from(new Set(productIds)),
    unresolvedNames,
  };
}

function extractLabeledPairs(
  messageText?: string,
): Array<{ key: string; value: string }> {
  if (!messageText?.trim()) {
    return [];
  }

  const pairs: Array<{ key: string; value: string }> = [];
  const segments = messageText
    .split(/\r?\n/u)
    .flatMap((line) => line.split(/[；;]/u))
    .map((item) => item.trim())
    .filter(Boolean);

  for (const segment of segments) {
    const matched = segment.match(/^([^：:]+)[：:]\s*(.+)$/u);
    if (!matched) {
      continue;
    }

    pairs.push({
      key: matched[1].trim(),
      value: matched[2].trim(),
    });
  }

  return pairs;
}

function buildFilledLines(items: Array<[string, string | undefined]>): string[] {
  return items
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => `${label}：${value}`);
}

function parseAmount(rawValue: string): number | undefined {
  const normalizedValue = rawValue.replace(/[,\s元]/gu, '').trim();
  if (!normalizedValue) {
    return undefined;
  }

  const amount = Number(normalizedValue);
  return Number.isFinite(amount) && amount > 0 ? amount : undefined;
}

function normalizeText(messageText?: string): string {
  return messageText?.replace(/\s+/gu, '').trim() ?? '';
}

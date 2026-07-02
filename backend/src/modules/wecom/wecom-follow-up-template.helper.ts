import type { WecomFollowUpTemplateDraft } from '../../shared/types/domain';

type WecomFollowUpTemplateTextField =
  | 'followUpContent'
  | 'helpNeeded'
  | 'informationShare'
  | 'visitPlan';

const FOLLOW_UP_TEMPLATE_FIELD_ALIASES: Record<
  string,
  WecomFollowUpTemplateTextField | 'ignore'
> = {
  姓名: 'ignore',
  跟进内容: 'followUpContent',
  今日跟进: 'followUpContent',
  跟进摘要: 'followUpContent',
  遇到与协助: 'helpNeeded',
  问题与协助: 'helpNeeded',
  遇到问题与协助: 'helpNeeded',
  遇到的问题与协助: 'helpNeeded',
  需要协助: 'helpNeeded',
  信息共享: 'informationShare',
  信息分享: 'informationShare',
  共享信息: 'informationShare',
  干货分享: 'informationShare',
  拜访计划: 'visitPlan',
  计划: 'visitPlan',
};

export const WECOM_FOLLOW_UP_TEMPLATE_FIELD_LABELS = {
  followUpContent: '跟进内容',
  helpNeeded: '遇到与协助',
  informationShare: '信息共享',
  visitPlan: '拜访计划',
} as const;

const FOLLOW_UP_TEMPLATE_PLAN_KEYWORDS = [
  '明天',
  '后天',
  '下周',
  '下次',
  '稍后',
  '后续计划',
  '安排',
  '计划',
  '继续跟进',
  '继续推进',
  '再次拜访',
];

const FOLLOW_UP_TEMPLATE_HELP_KEYWORDS = [
  '需要',
  '协助',
  '困难',
  '卡住',
  '阻碍',
  '阻塞',
  '不好沟通',
  '推进缓慢',
  '推进很慢',
  '推进受阻',
  '难推进',
  '审批卡住',
  '资源不足',
];

const FOLLOW_UP_TEMPLATE_SHARE_KEYWORDS = [
  '信息共享',
  '信息分享',
  '共享',
  '同步',
  '反馈',
  '更关注',
  '更关心',
  '友商',
  '政策变化',
  '行业信息',
  '客户反馈',
];

export function createWecomFollowUpTemplateDraft(
  requesterName: string,
): WecomFollowUpTemplateDraft {
  return {
    requesterName,
  };
}

export function parseWecomFollowUpTemplateUpdates(
  messageText?: string,
): Partial<WecomFollowUpTemplateDraft> {
  const updates: Partial<WecomFollowUpTemplateDraft> = {};

  for (const { key, value } of extractLabeledPairs(messageText)) {
    const fieldKey = FOLLOW_UP_TEMPLATE_FIELD_ALIASES[key];
    if (!fieldKey || fieldKey === 'ignore') {
      continue;
    }

    updates[fieldKey] = value;
  }

  return updates;
}

export function parseWecomFollowUpTemplateFreeformDraft(params: {
  requesterName: string;
  messageText?: string;
}): WecomFollowUpTemplateDraft {
  const draft: WecomFollowUpTemplateDraft = {
    requesterName: params.requesterName,
  };
  const clauses = splitFreeformClauses(params.messageText);
  const followUpClauses: string[] = [];
  const helpClauses: string[] = [];
  const shareClauses: string[] = [];
  const visitClauses: string[] = [];

  for (const clause of clauses) {
    if (isPlanClause(clause)) {
      visitClauses.push(clause);
      continue;
    }

    if (isHelpClause(clause)) {
      helpClauses.push(clause);
      continue;
    }

    if (isShareClause(clause)) {
      shareClauses.push(clause);
      continue;
    }

    followUpClauses.push(clause);
  }

  draft.followUpContent = compactFreeformClauses(
    followUpClauses.length > 0 ? followUpClauses : clauses.slice(0, 1),
  );
  draft.helpNeeded = compactFreeformClauses(helpClauses);
  draft.informationShare = compactFreeformClauses(shareClauses);
  draft.visitPlan = compactFreeformClauses(visitClauses);
  draft.missingLabels = getMissingWecomFollowUpTemplateLabels(draft);
  return draft;
}

/**
 * 合并 AI 草稿与规则草稿，优先使用 AI 已明确识别出的字段，
 * 但当 AI 把某些可选字段留空时，仍允许用规则拆分结果补齐。
 *
 * 这样做的原因：
 * 1. 线上模型有时只会稳定返回“跟进内容”，不会把问题、共享、计划全部补齐；
 * 2. 用户原文里已经明确出现“客户不好沟通”“明天继续跟进”这类信号时，不应因为 AI 留空而直接丢失；
 * 3. 合并只发生在空字段上，不会覆盖 AI 已给出的明确判断。
 */
export function mergeWecomFollowUpTemplateDrafts(params: {
  requesterName: string;
  aiDraft?: WecomFollowUpTemplateDraft | null;
  ruleDraft?: WecomFollowUpTemplateDraft;
}): WecomFollowUpTemplateDraft | undefined {
  const aiDraft = params.aiDraft;
  const ruleDraft = params.ruleDraft;

  if (!aiDraft && !ruleDraft) {
    return undefined;
  }

  const mergedDraft: WecomFollowUpTemplateDraft = {
    requesterName:
      normalizeTemplateValue(aiDraft?.requesterName) ??
      normalizeTemplateValue(ruleDraft?.requesterName) ??
      params.requesterName,
    followUpContent:
      normalizeTemplateValue(aiDraft?.followUpContent) ??
      normalizeTemplateValue(ruleDraft?.followUpContent),
    helpNeeded:
      normalizeTemplateValue(aiDraft?.helpNeeded) ??
      normalizeTemplateValue(ruleDraft?.helpNeeded),
    informationShare:
      normalizeTemplateValue(aiDraft?.informationShare) ??
      normalizeTemplateValue(ruleDraft?.informationShare),
    visitPlan:
      normalizeTemplateValue(aiDraft?.visitPlan) ??
      normalizeTemplateValue(ruleDraft?.visitPlan),
    directSubmitSource:
      aiDraft?.directSubmitSource ?? ruleDraft?.directSubmitSource,
    optionalMissingPromptShown:
      aiDraft?.optionalMissingPromptShown ?? ruleDraft?.optionalMissingPromptShown,
  };
  mergedDraft.missingLabels = getMissingWecomFollowUpTemplateLabels(mergedDraft);
  return mergedDraft;
}

export function getMissingWecomFollowUpTemplateLabels(
  draft: WecomFollowUpTemplateDraft,
): string[] {
  const missingLabels: string[] = [];

  if (!draft.followUpContent) {
    missingLabels.push(WECOM_FOLLOW_UP_TEMPLATE_FIELD_LABELS.followUpContent);
  }
  if (!draft.helpNeeded) {
    missingLabels.push(WECOM_FOLLOW_UP_TEMPLATE_FIELD_LABELS.helpNeeded);
  }
  if (!draft.informationShare) {
    missingLabels.push(WECOM_FOLLOW_UP_TEMPLATE_FIELD_LABELS.informationShare);
  }
  if (!draft.visitPlan) {
    missingLabels.push(WECOM_FOLLOW_UP_TEMPLATE_FIELD_LABELS.visitPlan);
  }

  return missingLabels;
}

export function hasRequiredWecomFollowUpTemplateContent(
  draft: WecomFollowUpTemplateDraft,
): boolean {
  return Boolean(draft.followUpContent?.trim());
}

export function getOptionalMissingWecomFollowUpTemplateLabels(
  draft: WecomFollowUpTemplateDraft,
): string[] {
  return getMissingWecomFollowUpTemplateLabels(draft).filter(
    (item) => item !== WECOM_FOLLOW_UP_TEMPLATE_FIELD_LABELS.followUpContent,
  );
}

export function isWecomFollowUpTemplateDirectSubmitIntent(
  messageText?: string,
): boolean {
  const normalizedText = messageText?.replace(/\s+/gu, '').trim() ?? '';
  if (!normalizedText) {
    return false;
  }

  const normalizedCompactText = normalizedText
    .replace(/[，,。.!！？?；;、]/gu, '')
    .trim();

  if (normalizedCompactText === '提交') {
    return true;
  }

  if (
    /^(?:可以|可|好的|好|行|行的|没问题|可以的)?(?:直接)?提交(?:吧|把)?$/u.test(
      normalizedCompactText,
    )
  ) {
    return true;
  }

  return [
    '直接提交',
    '先这样提交',
    '先这样吧',
    '不补充',
    '先不补充',
    '不补了',
    '先不补了',
    '不用补充',
    '就这样提交',
    '就这样吧',
    '先按这个提交',
    '按当前提交',
    '提交当前草稿',
    '提交吧',
    '提交把',
    '可以提交',
    '可以直接提交',
  ].some((keyword) => normalizedCompactText.includes(keyword));
}

export function buildWecomFollowUpTemplateOptionalMissingPrompt(params: {
  filledLines: string[];
  missingLabels: string[];
}): string {
  const missingText = params.missingLabels.join('、');
  const filledText =
    params.filledLines.length > 0
      ? params.filledLines.join('\n')
      : '跟进内容：已收到你的跟进描述。';

  const exampleByLabel: Record<string, string> = {
    [WECOM_FOLLOW_UP_TEMPLATE_FIELD_LABELS.helpNeeded]:
      '需要协助：需要区域经理确认折扣底线。',
    [WECOM_FOLLOW_UP_TEMPLATE_FIELD_LABELS.informationShare]:
      '信息共享：客户更关注交付周期。',
    [WECOM_FOLLOW_UP_TEMPLATE_FIELD_LABELS.visitPlan]:
      '拜访计划：明天继续跟客户确认 POC 时间。',
  };
  const exampleLines = params.missingLabels
    .map((label) => exampleByLabel[label])
    .filter((item): item is string => Boolean(item))
    .map((item, index) => `${index + 1}. ${item}`);

  return [
    '我先帮你整理到这里，已经整理好你提供的有效跟进内容啦：',
    filledText,
    '',
    missingText
      ? `如果方便，也可以继续补充「${missingText}」，例如：`
      : '如果方便，也可以继续补充更多上下文，例如：',
    ...exampleLines,
    '如果现在不想补充，也可以直接提交，我会按当前草稿继续后续确认流程。',
  ].join('\n');
}

export function buildWecomFollowUpTemplateFilledLines(
  draft: WecomFollowUpTemplateDraft,
): string[] {
  return [
    buildTemplateLine(
      WECOM_FOLLOW_UP_TEMPLATE_FIELD_LABELS.followUpContent,
      draft.followUpContent,
    ),
    buildTemplateLine(
      WECOM_FOLLOW_UP_TEMPLATE_FIELD_LABELS.helpNeeded,
      draft.helpNeeded,
    ),
    buildTemplateLine(
      WECOM_FOLLOW_UP_TEMPLATE_FIELD_LABELS.informationShare,
      draft.informationShare,
    ),
    buildTemplateLine(
      WECOM_FOLLOW_UP_TEMPLATE_FIELD_LABELS.visitPlan,
      draft.visitPlan,
    ),
  ].filter((item): item is string => Boolean(item));
}

export function buildWecomFollowUpTemplateBody(
  draft: WecomFollowUpTemplateDraft,
): string {
  return [
    buildTemplateLine(
      WECOM_FOLLOW_UP_TEMPLATE_FIELD_LABELS.followUpContent,
      draft.followUpContent,
    ),
    buildTemplateLine(
      WECOM_FOLLOW_UP_TEMPLATE_FIELD_LABELS.helpNeeded,
      draft.helpNeeded,
    ),
    buildTemplateLine(
      WECOM_FOLLOW_UP_TEMPLATE_FIELD_LABELS.informationShare,
      draft.informationShare,
    ),
    buildTemplateLine(
      WECOM_FOLLOW_UP_TEMPLATE_FIELD_LABELS.visitPlan,
      draft.visitPlan,
    ),
  ]
    .filter((item): item is string => Boolean(item))
    .join('\n');
}

export function buildWecomFollowUpTemplateFinalContent(
  requesterName: string,
  draft: WecomFollowUpTemplateDraft,
): string {
  const body = buildWecomFollowUpTemplateBody(draft);
  if (!body.trim()) {
    return `【${requesterName}】：`;
  }

  return `【${requesterName}】：\n${body}`;
}

export function normalizeWecomFollowUpTemplateFinalContent(
  requesterName: string,
  rawContent: string,
): string {
  const trimmedContent = rawContent.trim();
  if (!trimmedContent) {
    return `【${requesterName}】：`;
  }

  const normalizedContent = trimmedContent
    .replace(new RegExp(`^【\\s*${escapeForRegex(requesterName)}\\s*】[:：]?\\s*`, 'u'), '')
    .replace(new RegExp(`^${escapeForRegex(requesterName)}[:：]\\s*`, 'u'), '')
    .trim();

  const hasTemplateLabels =
    /^跟进内容[:：]/mu.test(normalizedContent) ||
    /^(?:遇到与协助|问题与协助)[:：]/mu.test(normalizedContent) ||
    /^(?:信息共享|信息分享)[:：]/mu.test(normalizedContent) ||
    /^拜访计划[:：]/mu.test(normalizedContent);

  const normalizedBody = hasTemplateLabels
    ? normalizedContent
    : `跟进内容：${normalizedContent}`;

  return `【${requesterName}】：\n${normalizedBody}`;
}

function buildTemplateLine(label: string, value?: string): string | undefined {
  const normalizedValue = normalizeTemplateValue(value);
  return normalizedValue ? `${label}：${normalizedValue}` : undefined;
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
    const matched = segment.match(/^([^:：]+)[:：]\s*(.+)$/u);
    if (!matched) {
      continue;
    }

    pairs.push({
      key: matched[1].trim(),
      value: normalizeTemplateValue(matched[2]) ?? '',
    });
  }

  return pairs;
}

function normalizeTemplateValue(value?: string): string | undefined {
  const normalizedValue = value?.replace(/\s+/gu, ' ').trim();
  return normalizedValue ? normalizedValue : undefined;
}

function splitFreeformClauses(messageText?: string): string[] {
  return (messageText ?? '')
    .split(/[。！？!?；;\n，,]/u)
    .map((item) =>
      item
        .replace(/^\s*(?:但|但是|不过|并且|而且|同时)\s*/u, '')
        .replace(/\s+/gu, ' ')
        .trim(),
    )
    .filter(Boolean);
}

function compactFreeformClauses(clauses: string[]): string | undefined {
  const normalizedClauses = Array.from(new Set(clauses))
    .map((item) => item.trim())
    .filter(Boolean);
  return normalizedClauses.length > 0 ? normalizedClauses.join('；') : undefined;
}

function matchesAnyKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function isPlanClause(text: string): boolean {
  return matchesAnyKeyword(text, FOLLOW_UP_TEMPLATE_PLAN_KEYWORDS);
}

function isHelpClause(text: string): boolean {
  return matchesAnyKeyword(text, FOLLOW_UP_TEMPLATE_HELP_KEYWORDS);
}

function isShareClause(text: string): boolean {
  return matchesAnyKeyword(text, FOLLOW_UP_TEMPLATE_SHARE_KEYWORDS);
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

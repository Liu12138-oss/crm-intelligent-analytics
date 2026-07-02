import type {
  AiCapabilityPackDefinition,
  AiCapabilityProviderContext,
} from '../ai-capability-pack.types';
import type { WecomLatestResultContext } from '../../../../shared/types/domain';
import { resolveQwenCapabilityTuning } from '../provider-tuning/qwen.provider';

export interface WecomIdleEntryPackContext {
  messageText: string;
  latestQuestion?: string;
  latestSummary?: string;
  latestResultContext?: WecomLatestResultContext;
  hasPendingSlots: boolean;
}

type WecomIdleEntryRawOutput = {
  intent?: string;
  helpScene?: string | null;
  dailyReportPrompt?: string | null;
  leaderNameQuery?: string | null;
  lookupText?: string | null;
  entityLookupAction?: string | null;
  entityType?: string | null;
  queryText?: string | null;
  selectionIndex?: number | null;
  referenceTarget?: string | null;
  confidence?: string | null;
};

export interface WecomIdleEntryPackOutput {
  intent:
    | 'HELP_GUIDANCE'
    | 'DAILY_REPORT'
    | 'DAILY_REPORT_QUERY'
    | 'TEAM_DAILY_REPORT_QUERY'
    | 'CRM_CREATE_CUSTOMER'
    | 'CRM_CREATE_OPPORTUNITY'
    | 'OPPORTUNITY_LOOKUP'
    | 'ENTITY_LOOKUP'
    | 'EXPLAIN_RESULT'
    | 'FOLLOW_UP_ANALYZE'
    | 'ANALYZE'
    | 'NONE';
  helpScene?: 'GREETING' | 'CAPABILITY';
  dailyReportPrompt?: 'FOLLOW_UP_TEMPLATE_ENTRY' | 'DAILY_REPORT_THEME_ENTRY';
  leaderNameQuery?: string;
  lookupText?: string;
  entityLookupAction?: 'LIST' | 'DETAIL' | 'SELECT_FROM_LAST_LIST';
  entityType?: 'Customer' | 'Opportunity' | 'Unknown';
  queryText?: string;
  selectionIndex?: number;
  referenceTarget?: 'LAST_LIST' | 'NONE';
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
}

function formatLatestResultContext(
  context: WecomLatestResultContext | undefined,
): string {
  if (!context) {
    return '无';
  }

  const entityText = context.entities
    .map((item) => item.value)
    .filter(Boolean)
    .slice(0, 8)
    .join('、');
  const topRowText = context.topRows
    .map((item) =>
      [item.label, ...item.summaryFields].filter(Boolean).join('，'),
    )
    .filter(Boolean)
    .slice(0, 5)
    .join('；');

  return [
    context.queryId ? `结果ID：${context.queryId}` : undefined,
    context.title ? `标题：${context.title}` : undefined,
    context.summary ? `摘要：${context.summary}` : undefined,
    entityText ? `已验证对象：${entityText}` : undefined,
    topRowText ? `代表性结果：${topRowText}` : undefined,
  ]
    .filter(Boolean)
    .join('\n') || '无';
}

function buildPrompt(
  context: WecomIdleEntryPackContext,
  fewShotExamples: string[],
): string {
  return [
    '你是 CRM 智能分析系统的企业微信空闲态入口分类器。',
    '请判断这条消息更适合进入 HELP_GUIDANCE、DAILY_REPORT、DAILY_REPORT_QUERY、TEAM_DAILY_REPORT_QUERY、CRM_CREATE_CUSTOMER、CRM_CREATE_OPPORTUNITY、OPPORTUNITY_LOOKUP、ENTITY_LOOKUP、EXPLAIN_RESULT、FOLLOW_UP_ANALYZE、ANALYZE 还是 NONE。',
    '必须遵守以下限制：',
    '1. HELP_GUIDANCE 用于打招呼、能力询问、求帮助；helpScene 只能是 GREETING 或 CAPABILITY。',
    '2. DAILY_REPORT 用于今日跟进 / 跟进商机 / 跟进客户 / 帮我写今日跟进，以及“今天跟进了某客户 / 商机、推进缓慢、明天继续跟进”这类明显跟进叙述；dailyReportPrompt 只能是 FOLLOW_UP_TEMPLATE_ENTRY 或 DAILY_REPORT_THEME_ENTRY。',
    '3. DAILY_REPORT_QUERY 用于查看今日日报 / 生成日报 / 查看我的日报这类个人日报查看。',
    '4. TEAM_DAILY_REPORT_QUERY 用于“把王文定小组日报发给我”这类查看指定小组今日日报的请求；需要同时输出 leaderNameQuery。',
    '5. CRM_CREATE_CUSTOMER / CRM_CREATE_OPPORTUNITY 只用于“新增客户 / 新建客户 / 创建客户 / 新增商机 / 新建商机 / 创建商机”这类显式创建主题入口；如果只是问“商机情况 / 商机分析 / 商机排名 / 商机趋势”，必须归到 ANALYZE。',
    '5.1 “客户创建了多久、创建多长时间、没有报备商机、未建商机、无商机客户、客户生命周期分布”都是只读经营分析，必须归到 ANALYZE，不能归到 CRM_CREATE_CUSTOMER 或 HELP_GUIDANCE。',
    '6. OPPORTUNITY_LOOKUP 用于“查苏州制造 / 查安恒信息项目 / 查这个客户”这类显式查项目、查客户、查商机；需要输出 lookupText。',
    '7. ENTITY_LOOKUP 用于“查我的客户列表”“看山东农信详情”“看第2个详情”这类客户/商机列表与详情浏览请求；需要输出 entityLookupAction、entityType、queryText，若引用上一轮列表则输出 selectionIndex 和 referenceTarget。',
    '8. EXPLAIN_RESULT 只在已有 latestSummary 时使用，表示当前消息是在追问“为什么 / 这说明什么 / 怎么理解”。',
    '9. FOLLOW_UP_ANALYZE 只在已有 latestQuestion 或 latestSummary 时使用，表示当前消息是在改时间范围、改维度或补充筛选条件。',
    '10. ANALYZE 用于普通经营分析问句。',
    '11. 如果当前消息无法安全判定，或更像待补问里的简短续填，返回 NONE。',
    '12. 只输出 JSON。',
    ...(fewShotExamples.length > 0 ? ['参考示例：', ...fewShotExamples] : []),
    '反例：',
    '- “请分析一下最近四个月的商机情况” -> ANALYZE，不是 CRM_CREATE_OPPORTUNITY。',
    '- “最近四个月商机趋势怎么样” -> ANALYZE，不是 CRM_CREATE_OPPORTUNITY。',
    '- “有多少客户是没有报备商机的，分别创建了多长时间” -> ANALYZE，不是 CRM_CREATE_CUSTOMER，也不是 HELP_GUIDANCE。',
    `当前消息：${context.messageText}`,
    `上一轮问题：${context.latestQuestion ?? '无'}`,
    `上一轮结果摘要：${context.latestSummary ?? '无'}`,
    `上一轮已验证结果上下文：\n${formatLatestResultContext(context.latestResultContext)}`,
    `当前是否存在待补问：${context.hasPendingSlots ? '是' : '否'}`,
  ].join('\n');
}

function normalizeNullableString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalizedValue = value.trim();
  return normalizedValue || undefined;
}

export const wecomIdleEntryPack: AiCapabilityPackDefinition<
  WecomIdleEntryPackContext,
  WecomIdleEntryRawOutput,
  WecomIdleEntryPackOutput
> = {
  packCode: 'wecom-idle-entry-pack',
  packVersion: '2026-04-21.1',
  buildStructuredRequest: (context, tuning) => ({
    prompt: buildPrompt(context, tuning.fewShotExamples ?? []),
    outputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['intent'],
      properties: {
        intent: {
          type: 'string',
          enum: [
            'HELP_GUIDANCE',
            'DAILY_REPORT',
            'DAILY_REPORT_QUERY',
            'TEAM_DAILY_REPORT_QUERY',
            'CRM_CREATE_CUSTOMER',
            'CRM_CREATE_OPPORTUNITY',
            'OPPORTUNITY_LOOKUP',
            'ENTITY_LOOKUP',
            'EXPLAIN_RESULT',
            'FOLLOW_UP_ANALYZE',
            'ANALYZE',
            'NONE',
          ],
        },
        helpScene: {
          type: 'string',
          enum: ['GREETING', 'CAPABILITY'],
        },
        dailyReportPrompt: {
          type: 'string',
          enum: ['FOLLOW_UP_TEMPLATE_ENTRY', 'DAILY_REPORT_THEME_ENTRY'],
        },
        leaderNameQuery: {
          type: 'string',
        },
        lookupText: {
          type: 'string',
        },
        entityLookupAction: {
          type: 'string',
          enum: ['LIST', 'DETAIL', 'SELECT_FROM_LAST_LIST'],
        },
        entityType: {
          type: 'string',
          enum: ['Customer', 'Opportunity', 'Unknown'],
        },
        queryText: {
          type: 'string',
        },
        selectionIndex: {
          type: 'integer',
          minimum: 1,
        },
        referenceTarget: {
          type: 'string',
          enum: ['LAST_LIST', 'NONE'],
        },
        confidence: {
          type: 'string',
          enum: ['HIGH', 'MEDIUM', 'LOW'],
        },
      },
    },
  }),
  normalize: (raw) => ({
    intent:
      (normalizeNullableString(raw.intent) as WecomIdleEntryPackOutput['intent']) ??
      'NONE',
    helpScene:
      normalizeNullableString(raw.helpScene) as WecomIdleEntryPackOutput['helpScene'],
    dailyReportPrompt: normalizeNullableString(
      raw.dailyReportPrompt,
    ) as WecomIdleEntryPackOutput['dailyReportPrompt'],
    leaderNameQuery: normalizeNullableString(raw.leaderNameQuery),
    lookupText: normalizeNullableString(raw.lookupText),
    entityLookupAction: normalizeNullableString(
      raw.entityLookupAction,
    ) as WecomIdleEntryPackOutput['entityLookupAction'],
    entityType: normalizeNullableString(
      raw.entityType,
    ) as WecomIdleEntryPackOutput['entityType'],
    queryText: normalizeNullableString(raw.queryText),
    selectionIndex:
      typeof raw.selectionIndex === 'number' && Number.isFinite(raw.selectionIndex)
        ? Math.trunc(raw.selectionIndex)
        : undefined,
    referenceTarget: normalizeNullableString(
      raw.referenceTarget,
    ) as WecomIdleEntryPackOutput['referenceTarget'],
    confidence: normalizeNullableString(
      raw.confidence,
    ) as WecomIdleEntryPackOutput['confidence'],
  }),
  validate: (output) => {
    if (output.intent === 'HELP_GUIDANCE' && !output.helpScene) {
      return '缺少 helpScene';
    }
    if (output.intent === 'DAILY_REPORT' && !output.dailyReportPrompt) {
      return '缺少 dailyReportPrompt';
    }
    if (
      output.intent === 'TEAM_DAILY_REPORT_QUERY' &&
      !output.leaderNameQuery
    ) {
      return '缺少 leaderNameQuery';
    }
    if (output.intent === 'OPPORTUNITY_LOOKUP' && !output.lookupText) {
      return '缺少 lookupText';
    }
    if (output.intent === 'ENTITY_LOOKUP') {
      if (!output.entityLookupAction) {
        return '缺少 entityLookupAction';
      }
      if (!output.entityType) {
        return '缺少 entityType';
      }
      if (
        output.entityLookupAction === 'SELECT_FROM_LAST_LIST' &&
        output.referenceTarget !== 'LAST_LIST'
      ) {
        return '列表引用缺少 referenceTarget';
      }
      if (
        output.entityLookupAction === 'SELECT_FROM_LAST_LIST' &&
        !output.selectionIndex
      ) {
        return '列表引用缺少 selectionIndex';
      }
      if (
        output.entityLookupAction !== 'SELECT_FROM_LAST_LIST' &&
        !output.queryText
      ) {
        return '缺少 queryText';
      }
    }

    return undefined;
  },
  isNone: (output) => output.intent === 'NONE',
  resolveProviderTuning: (providerContext: AiCapabilityProviderContext) =>
    resolveQwenCapabilityTuning(providerContext, 'wecom-idle-entry-pack'),
};

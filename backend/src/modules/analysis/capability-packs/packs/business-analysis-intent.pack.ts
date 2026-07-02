import type { QueryConfidence, TemporalGranularity, TemporalRelativity, TemporalSlot } from '../../../../shared/types/domain';
import type { AiCapabilityPackDefinition } from '../ai-capability-pack.types';
import type {
  BusinessAnalysisIntent,
  BusinessAnalysisMode,
  BusinessDimension,
  BusinessEntity,
  BusinessFilter,
  BusinessMetric,
  BusinessObjectType,
  BusinessOutputPreference,
} from '../../business-analysis-intent.types';
import { normalizeAnalysisMissingConditions } from '../../missing-conditions.util';

export interface BusinessAnalysisIntentPackContext {
  questionText: string;
  referenceNowIso?: string;
  timezone?: 'Asia/Shanghai';
}

type BusinessAnalysisIntentRawOutput = Omit<Partial<BusinessAnalysisIntent>, 'limit' | 'sort'> & {
  limit?: unknown;
  sort?: {
    by?: unknown;
    field?: unknown;
    direction?: unknown;
  };
};

const OBJECT_TYPES: BusinessObjectType[] = [
  'opportunity',
  'registration',
  'quote',
  'order',
  'partner',
  'customer',
  'contract',
  'payment',
];

const METRICS: BusinessMetric[] = [
  'count',
  'amount',
  'total_amount',
  'opportunity_count',
  'opportunity_amount',
  'registration_count',
  'quote_count',
  'quote_amount',
  'order_count',
  'order_amount',
  'contract_amount',
  'payment_amount',
  'conversion_rate',
  'win_rate',
  'partner_count',
  'technical_partner_count',
  'concentration_ratio',
  'unlinked_customer_count',
  'customer_age_days',
  'stale_opportunity_count',
  'inactive_customer_count',
];

const DIMENSIONS: BusinessDimension[] = [
  'region',
  'big_region',
  'department',
  'owner',
  'partner',
  'customer',
  'month',
  'quarter',
  'year',
  'stage',
  'status',
  'partner_level',
  'is_technical_service_provider',
  'customer_category',
  'customer_age_bucket',
];

const ANALYSIS_MODES: BusinessAnalysisMode[] = [
  'single_metric',
  'ranking',
  'trend',
  'distribution',
  'detail',
  'comparison',
  'summary_report',
  'dashboard',
  'risk_analysis',
];

const OUTPUT_PREFERENCES: BusinessOutputPreference[] = [
  'text_summary',
  'table',
  'chart',
  'wecom_image',
  'html_report',
  'export_file',
];

/**
 * 归一化枚举数组，过滤 AI 输出中的未知枚举。
 *
 * 参数说明：`value` 为 AI 原始输出，`allowedValues` 为受控枚举清单。
 * 返回值说明：返回去重后的合法枚举数组。
 * 调用注意事项：未知枚举不参与执行，避免 AI 编造对象或字段。
 */
function normalizeEnumArray<T extends string>(value: unknown, allowedValues: T[]): T[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowedSet = new Set<string>(allowedValues);
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item): item is T => allowedSet.has(item)),
    ),
  );
}

/**
 * 归一化排序字段。
 *
 * 参数说明：`value` 为模型输出的排序对象，兼容 `by` 与 `field` 两种常见写法。
 * 返回值说明：字段和方向均命中受控枚举时返回排序配置，否则返回 `undefined`。
 * 调用注意事项：排序只影响受控查询计划，不允许模型输出任意数据库字段。
 */
function normalizeSort(value: unknown): BusinessAnalysisIntent['sort'] | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const raw = value as Record<string, unknown>;
  const rawField =
    typeof raw.by === 'string'
      ? raw.by.trim()
      : typeof raw.field === 'string'
        ? raw.field.trim()
        : '';
  const allowedFields = new Set<string>([...METRICS, ...DIMENSIONS]);
  if (!allowedFields.has(rawField)) {
    return undefined;
  }

  const direction = typeof raw.direction === 'string'
    ? raw.direction.trim().toUpperCase()
    : '';
  if (direction !== 'ASC' && direction !== 'DESC') {
    return undefined;
  }

  return {
    by: rawField as BusinessMetric | BusinessDimension,
    direction,
  };
}

/**
 * 归一化置信度。
 *
 * 参数说明：`value` 为 AI 原始输出，`fallback` 为兜底置信度。
 * 返回值说明：返回合法置信度枚举。
 * 调用注意事项：置信度只影响澄清和审计，不直接放宽执行边界。
 */
function normalizeConfidence(value: unknown, fallback: QueryConfidence): QueryConfidence {
  if (value === 'HIGH' || value === 'MEDIUM' || value === 'LOW') {
    return value;
  }

  return fallback;
}

/**
 * 归一化分析模式。
 *
 * 参数说明：`value` 为 AI 原始输出。
 * 返回值说明：返回合法分析模式；无法识别时返回 `single_metric`。
 * 调用注意事项：分析模式只影响任务拆分，最终查询仍由程序映射。
 */
function normalizeAnalysisMode(value: unknown): BusinessAnalysisMode {
  if (typeof value === 'string' && (ANALYSIS_MODES as string[]).includes(value)) {
    return value as BusinessAnalysisMode;
  }

  return 'single_metric';
}

/**
 * 归一化时间粒度。
 *
 * 参数说明：`value` 为 AI 原始输出。
 * 返回值说明：返回合法时间粒度。
 * 调用注意事项：无法识别时使用 `custom`，不编造具体时间边界。
 */
function normalizeTemporalGranularity(value: unknown): TemporalGranularity {
  if (
    value === 'day' ||
    value === 'week' ||
    value === 'month' ||
    value === 'quarter' ||
    value === 'year' ||
    value === 'custom'
  ) {
    return value;
  }

  return 'custom';
}

/**
 * 归一化时间相对性。
 *
 * 参数说明：`value` 为 AI 原始输出。
 * 返回值说明：返回合法相对性枚举。
 * 调用注意事项：无法识别时使用 `mixed`，交给后续时间校验处理。
 */
function normalizeTemporalRelativity(value: unknown): TemporalRelativity {
  if (value === 'absolute' || value === 'relative' || value === 'mixed') {
    return value;
  }

  return 'mixed';
}

/**
 * 归一化时间槽。
 *
 * 参数说明：`value` 为 AI 原始时间槽输出。
 * 返回值说明：返回合法 `TemporalSlot` 或 `undefined`。
 * 调用注意事项：没有可靠原文和标签时不生成时间槽，避免伪造时间范围。
 */
function normalizeTemporalSlot(value: unknown): TemporalSlot | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const raw = value as Partial<TemporalSlot>;
  const rawText = typeof raw.rawText === 'string' ? raw.rawText.trim() : '';
  const normalizedLabel =
    typeof raw.normalizedLabel === 'string' ? raw.normalizedLabel.trim() : rawText;
  if (!rawText && !normalizedLabel) {
    return undefined;
  }

  return {
    rawText: rawText || normalizedLabel,
    normalizedLabel: normalizedLabel || rawText,
    ...(typeof raw.startAt === 'string' && raw.startAt.trim()
      ? { startAt: raw.startAt.trim() }
      : {}),
    ...(typeof raw.endAt === 'string' && raw.endAt.trim()
      ? { endAt: raw.endAt.trim() }
      : {}),
    timezone: 'Asia/Shanghai',
    granularity: normalizeTemporalGranularity(raw.granularity),
    relativity: normalizeTemporalRelativity(raw.relativity),
    inclusivity: {
      start: 'inclusive',
      end: raw.inclusivity?.end === 'inclusive' ? 'inclusive' : 'exclusive',
    },
    confidence: normalizeConfidence(raw.confidence, 'MEDIUM'),
    ...(typeof raw.unresolvedReason === 'string' && raw.unresolvedReason.trim()
      ? { unresolvedReason: raw.unresolvedReason.trim() }
      : {}),
  };
}

/**
 * 判断用户是否明确限定了时间。
 *
 * 参数说明：`questionText` 为用户原始问题或规范化问题。
 * 返回值说明：出现明确日期、月份、季度、年度或相对时间表达时返回 `true`。
 * 调用注意事项：未出现时间限制时默认查询当前权限内全量可见数据，不要求补充时间。
 */
function hasExplicitTemporalConstraint(questionText: string): boolean {
  return /(今天|昨日|昨天|明天|本周|上周|本月|上月|当月|本季度|上季度|本年|今年|去年|本财年|当前\s*(?:\d+|[一二两三四五六七八九十]+)\s*个?(?:天|周|月|季度|年)|最近|近\s*\d+|过去|前\s*\d+|\d{4}\s*年|\d{1,2}\s*月|一月份|二月份|三月份|四月份|五月份|六月份|七月份|八月份|九月份|十月份|十一月份|十二月份)/u.test(
    questionText,
  );
}

/**
 * 归一化过滤条件。
 *
 * 参数说明：`value` 为 AI 输出的过滤条件数组。
 * 返回值说明：返回合法过滤条件数组。
 * 调用注意事项：过滤条件只保留业务标签，实际字段下推由映射层按能力表决定。
 */
function normalizeFilters(value: unknown): BusinessFilter[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Partial<BusinessFilter> => Boolean(item) && typeof item === 'object')
    .map((item) => {
      const rawField = typeof item.field === 'string' ? item.field : 'keyword';
      const field = ([...DIMENSIONS, 'keyword', 'time'] as string[]).includes(rawField)
        ? (rawField as BusinessFilter['field'])
        : 'keyword';
      const operator =
        item.operator === 'eq' ||
        item.operator === 'contains' ||
        item.operator === 'in' ||
        item.operator === 'between'
          ? item.operator
          : 'contains';
      const rawValue = Array.isArray(item.value)
        ? item.value.filter((child): child is string => typeof child === 'string')
        : typeof item.value === 'string'
          ? item.value
          : '';
      const label =
        typeof item.label === 'string' && item.label.trim()
          ? item.label.trim()
          : Array.isArray(rawValue)
            ? rawValue.join('、')
            : rawValue;

      return {
        field,
        operator,
        value: rawValue,
        label,
      };
    })
    .filter((item) => item.label);
}

/**
 * 归一化实体列表。
 *
 * 参数说明：`value` 为 AI 输出的实体数组。
 * 返回值说明：返回合法业务实体数组。
 * 调用注意事项：实体只用于审计和提示，不直接作为字段名执行。
 */
function normalizeEntities(value: unknown): BusinessEntity[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Partial<BusinessEntity> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      type:
        typeof item.type === 'string' &&
        ([...OBJECT_TYPES, ...DIMENSIONS, 'keyword'] as string[]).includes(item.type)
          ? (item.type as BusinessEntity['type'])
          : 'keyword',
      value: typeof item.value === 'string' ? item.value.trim() : '',
      ...(typeof item.normalizedValue === 'string' && item.normalizedValue.trim()
        ? { normalizedValue: item.normalizedValue.trim() }
        : {}),
    }))
    .filter((item) => item.value);
}

/**
 * 读取当前参考时间。
 *
 * 参数说明：`context` 为能力包上下文。
 * 返回值说明：返回合法 `Date`。
 * 调用注意事项：参考时间只供提示词约束相对时间解析。
 */
function getReferenceNow(context: BusinessAnalysisIntentPackContext): Date {
  const rawNow = context.referenceNowIso?.trim();
  const parsedNow = rawNow ? Date.parse(rawNow) : NaN;
  return Number.isFinite(parsedNow) ? new Date(parsedNow) : new Date();
}

/**
 * 根据原文里的高置信业务信号补齐 AI 漏掉的受控意图槽。
 *
 * 参数说明：`questionText` 为用户规范化问题，`slots` 为模型已通过枚举校验的槽位。
 * 返回值说明：返回补齐后的对象、指标、维度、分析模式、输出偏好和比较意图。
 * 调用注意事项：这里只补充原文已经明确表达的查询形态，不新增用户没问到的业务范围。
 */
function compensateExplicitQuestionSignals(
  questionText: string,
  slots: {
    objectTypes: BusinessObjectType[];
    metrics: BusinessMetric[];
    dimensions: BusinessDimension[];
    analysisMode: BusinessAnalysisMode;
    outputPreference: BusinessOutputPreference[];
    comparison: BusinessAnalysisIntent['comparison'];
  },
): Pick<
  BusinessAnalysisIntent,
  'objectTypes' | 'metrics' | 'dimensions' | 'analysisMode' | 'outputPreference' | 'comparison'
> {
  const objectTypes = new Set(slots.objectTypes);
  const metrics = new Set(slots.metrics);
  const dimensions = new Set(slots.dimensions);
  const outputPreference = new Set(slots.outputPreference);
  const comparison = new Set(slots.comparison);
  let analysisMode = slots.analysisMode;

  const hasOpportunity = /(商机|机会)/u.test(questionText);
  const hasRegistration = /(客户报备|报备)/u.test(questionText);
  const hasPartner = /(服务商|渠道商|渠道|合作伙伴|代理商|经销商|伙伴)/u.test(questionText);
  const hasOrder = /(订单|下单|成单|签单|成交)/u.test(questionText) && !/(报价|报价单)/u.test(questionText);
  const hasQuote = /(报价|报价单)/u.test(questionText);
  const hasCustomer = /(客户|客资|客群)/u.test(questionText);
  const hasCustomerLifecycleSignal =
    /(没有报备商机|未报备商机|未建商机|无商机客户|创建了多久|创建多长时间|创建多长)/u.test(
      questionText,
    );
  const hasOpportunityRiskSignal =
    /(风险|未更新|没进展|没有进展|停滞|超期|逾期|异常)/u.test(questionText);

  if (hasOpportunity) {
    objectTypes.add('opportunity');
    if (!hasCustomerLifecycleSignal && !hasOpportunityRiskSignal) {
      metrics.add('opportunity_count');
    }
    if (
      !hasCustomerLifecycleSignal &&
      !hasOpportunityRiskSignal &&
      !/(数量|个数|多少|几条|几单)/u.test(questionText)
    ) {
      metrics.add('opportunity_amount');
    }
  }
  if (hasRegistration) {
    objectTypes.add('registration');
    if (!hasCustomerLifecycleSignal) {
      metrics.add('registration_count');
    }
  }
  if (hasPartner) {
    objectTypes.add('partner');
    dimensions.add('partner');
  }
  if (hasOrder) {
    objectTypes.add('order');
    metrics.add('order_count');
    metrics.add('order_amount');
  }
  if (hasQuote) {
    objectTypes.add('quote');
    metrics.add('quote_count');
    metrics.add('quote_amount');
  }
  if (hasCustomer && !hasRegistration) {
    objectTypes.add('customer');
  }

  if (/(趋势|走势|按月|月度|同比|环比)/u.test(questionText)) {
    dimensions.add(/年度|按年|年趋势/u.test(questionText) ? 'year' : 'month');
    outputPreference.add('chart');
    outputPreference.add('table');
    analysisMode = analysisMode === 'single_metric' ? 'trend' : analysisMode;
  }

  if (/(阶段分布|销售阶段|按阶段|阶段结构)/u.test(questionText)) {
    dimensions.add('stage');
    outputPreference.add('chart');
    outputPreference.add('table');
    analysisMode = analysisMode === 'single_metric' ? 'distribution' : analysisMode;
  }

  if (/(明细|详情|清单|列表|有哪些|哪几)/u.test(questionText)) {
    outputPreference.add('table');
    analysisMode = analysisMode === 'single_metric' ? 'detail' : analysisMode;
  }

  if (/(风险|未更新|没进展|没有进展|停滞|超期|逾期|异常)/u.test(questionText)) {
    if (hasOpportunity || objectTypes.has('opportunity')) {
      objectTypes.add('opportunity');
      metrics.add('stale_opportunity_count');
      dimensions.add('stage');
    }
    outputPreference.add('table');
    analysisMode = 'risk_analysis';
  }

  if (/(对比|比较|PK|pk|相比|环比|同比)/u.test(questionText)) {
    analysisMode = 'comparison';
    if (/(同比|去年)/u.test(questionText)) {
      comparison.add('year_over_year');
    }
    if (/(环比|上月|上周)/u.test(questionText)) {
      comparison.add('month_over_month');
    }
  }

  if (/(排名|排行|TOP|top|前\d+)/u.test(questionText)) {
    analysisMode = analysisMode === 'single_metric' ? 'ranking' : analysisMode;
    comparison.add('top_n');
    outputPreference.add('table');
  }

  if (/(报告|分析|情况|总览|看板|汇总|经营建议|建议)/u.test(questionText)) {
    analysisMode = /看板/u.test(questionText) ? 'dashboard' : analysisMode;
    if (analysisMode === 'single_metric') {
      analysisMode = 'summary_report';
    }
    outputPreference.add('text_summary');
    outputPreference.add('table');
  }

  return {
    objectTypes: [...objectTypes],
    metrics: [...metrics],
    dimensions: [...dimensions],
    analysisMode,
    outputPreference: [...outputPreference],
    comparison: [...comparison],
  };
}

export const businessAnalysisIntentPack: AiCapabilityPackDefinition<
  BusinessAnalysisIntentPackContext,
  BusinessAnalysisIntentRawOutput,
  BusinessAnalysisIntent
> = {
  packCode: 'business-analysis-intent-pack',
  packVersion: '2026-06-15.2',
  buildStructuredRequest: (context) => ({
    system: [
      '你是 CRM 智能分析系统的宽意图理解器，只负责把用户问题转换为一个 JSON 对象。',
      '严禁输出思考过程、解释文字、Markdown、代码块、前后缀说明或自然语言总结。',
      '最终回答第一个非空字符必须是 {，最后一个非空字符必须是 }。',
      '如果模型支持 reasoning/thinking 通道，推理只能在内部完成，不得把 reasoning/thinking 内容作为最终消息正文返回。',
    ].join('\n'),
    prompt: [
      '你是 CRM 智能分析系统的宽意图理解器。',
      '请先理解用户自然语言里的业务对象、指标、维度、时间、分析模式和输出偏好，只输出 JSON。',
      '重要边界：你不能编造字段、接口或数据；如果不确定字段是否存在，只表达用户意图，字段可用性由后端程序检查。',
      'objectTypes 只能从 opportunity、registration、quote、order、partner、customer、contract、payment 中选择。',
      'metrics 只能从 count、amount、total_amount、opportunity_count、opportunity_amount、registration_count、quote_count、quote_amount、order_count、order_amount、contract_amount、payment_amount、conversion_rate、win_rate、partner_count、technical_partner_count、concentration_ratio、unlinked_customer_count、customer_age_days、stale_opportunity_count、inactive_customer_count 中选择。',
      'dimensions 只能从 region、big_region、department、owner、partner、customer、month、quarter、year、stage、status、partner_level、is_technical_service_provider、customer_category、customer_age_bucket 中选择。',
      'analysisMode 只能从 single_metric、ranking、trend、distribution、detail、comparison、summary_report、dashboard、risk_analysis 中选择。',
      'outputPreference 只能从 text_summary、table、chart、wecom_image、html_report、export_file 中选择。',
      '企业微信分析交付默认使用模板卡片摘要、短文本导读和只读 HTML 报告链接；不要因为用户来自企业微信就输出 wecom_image，除非用户明确要求“图片/截图/海报”。',
      'limit 只能输出数字；如果用户表达“全部、所有、不限、all”，请省略 limit 字段，不要输出字符串。',
      '“服务商、渠道商、渠道、合作渠道、代理商、经销商、伙伴”统一理解为 partner。',
      '“订单、下单、成单”统一理解为 order；“报价、报价单”统一理解为 quote；“报备、客户报备”统一理解为 registration。',
      '“没有报备商机、未报备商机、未建商机、无商机客户、客户创建了多久、创建多长时间”属于客户生命周期和反关联分析，应输出 objectTypes=[customer,registration,opportunity]，metrics 至少包含 unlinked_customer_count，涉及创建时长时补充 customer_age_days，dimensions 可包含 customer_age_bucket。',
      '“超两周未更新商机、超过14天没有进展、当前3个月没有进展的商机、商机停滞、长期没跟进”属于商机风险分析，应输出 objectTypes=[opportunity]，metrics 至少包含 stale_opportunity_count，dimensions 可包含 owner、partner、stage。',
      '“最近30天未活跃客户、沉默客户、没有活动客户”属于客户活跃分析，应输出 objectTypes=[customer]，metrics 至少包含 inactive_customer_count，dimensions 可包含 region、owner、customer_age_bucket。',
      '“报备到订单转化、报备转商机、商机转报价、报价转订单、漏斗”属于转化漏斗，应输出相关 objectTypes，metrics 包含 conversion_rate，并在 comparison 中包含 funnel。',
      '“有效订单”默认排除 cancelled、canceled、void、rejected、deleted；completed、paid、confirmed、signed 优先视为有效。',
      '“看板、经营看板、汇总分析、分析报告、经营报告”应优先输出 summary_report 或 dashboard，并补充 table、chart、text_summary 输出偏好。',
      '如果用户说“再加、补充、顺便看、同时看、展开、重点看”等追加分析内容，要把追加内容映射到 dimensions、comparison、analysisMode 和 outputPreference；例如“加趋势”补充 month/quarter/year 维度和 chart，“加阶段分布”补充 stage 和 chart/table，“加明细/清单”补充 table。',
      '如果用户指定呈现方式，例如“用表格、图表、看板、完整报告、导出 Excel”，只写入 outputPreference，不要编造数据或字段；字段可用性仍由后端校验。',
      '如果用户要求创建、修改、删除、写入、更新状态、提醒等真实写操作，requestedAction 必须是 BLOCK。',
      '如果 requestedAction 不是 BLOCK，blockReason 可以输出空字符串；如果遗漏，后端也会按空字符串处理。',
      `当前时间基准为 ${getReferenceNow(context).toISOString()}，时区固定为 ${context.timezone ?? 'Asia/Shanghai'}。如果用户完全没有限定时间，不要把“时间范围”放入 missingConditions，后续默认查询当前账号权限内全部可见数据；如果用户说了相对时间，必须尽量输出 timeRange.startAt/endAt，无法可靠解析时才把“时间范围”放入 missingConditions。`,
      'missingConditions 只允许填写真正阻断执行、必须用户补充的缺口；如果问题已能按默认指标、默认维度或权限内全量范围执行，不要把“未指定指标/维度/时间但默认提供...”写入 missingConditions。',
      '正例：“最近三个月山东区域有下单的服务商，订单数量、订单金额和总金额” 应输出 objectTypes=[order,partner]，metrics=[order_count,order_amount,total_amount]，dimensions=[region,partner,month]。',
      '正例：“最近一年加入的服务商有多少家，按合作等级和是否技术服务商分布” 应输出 objectTypes=[partner]，metrics=[partner_count,technical_partner_count]，dimensions=[partner_level,is_technical_service_provider]。',
      '正例：“有多少客户是没有报备商机的，分别创建了多长时间” 应输出 objectTypes=[customer,registration,opportunity]，metrics=[unlinked_customer_count,customer_age_days]，dimensions=[customer_age_bucket]。',
      '正例：“本区域超两周未更新的商机有哪些” 应输出 objectTypes=[opportunity]，metrics=[stale_opportunity_count]，dimensions=[region,owner,partner,stage]，analysisMode=risk_analysis。',
      '正例：“分析当前3个月没有进展的商机情况” 应输出 objectTypes=[opportunity]，metrics=[stale_opportunity_count]，dimensions=[owner,partner,stage]，analysisMode=risk_analysis，outputPreference=[text_summary,table]。',
      '正例：“最近30天没有活跃的客户有哪些” 应输出 objectTypes=[customer]，metrics=[inactive_customer_count]，dimensions=[region,owner,customer_age_bucket]，analysisMode=detail。',
      '正例：“报备到订单整体转化率是多少” 应输出 objectTypes=[registration,opportunity,quote,order]，metrics=[registration_count,opportunity_count,quote_count,order_count,conversion_rate]，comparison=[funnel]。',
      '正例：“广州办渠道下单汇总分析” 应输出 objectTypes=[order,partner]，metrics=[order_count,order_amount,total_amount]，dimensions=[region,partner,month]，analysisMode=summary_report。',
      '正例：“全国代理商发展运营数据看板” 应输出 objectTypes=[partner,registration,opportunity,order]，metrics=[partner_count,registration_count,opportunity_count,opportunity_amount,order_count,order_amount]，dimensions=[big_region,region,partner,partner_level,is_technical_service_provider,stage,status]，analysisMode=dashboard，outputPreference=[text_summary,table,chart,html_report]。',
      '正例：“服务商发展和开拓、运营情况” 应输出 objectTypes=[partner,registration,opportunity,order]，metrics=[partner_count,registration_count,opportunity_count,opportunity_amount,order_count,order_amount]，dimensions=[partner,partner_level,is_technical_service_provider,stage,status]，analysisMode=summary_report。',
      '正例：“客户报备情况，带上对应渠道商和未关联商机报备” 应输出 objectTypes=[registration,partner,opportunity]，metrics=[registration_count,opportunity_count,unlinked_customer_count]，dimensions=[partner,status]，analysisMode=summary_report。',
      '正例：“全部商机情况，按阶段、渠道商、重点商机明细输出” 应输出 objectTypes=[opportunity,partner]，metrics=[opportunity_count,opportunity_amount]，dimensions=[stage,partner]，analysisMode=summary_report，outputPreference=[text_summary,table,chart]。',
      '正例：“报价情况，特别是有报价但未下单的客户” 应输出 objectTypes=[quote,order,customer,partner]，metrics=[quote_count,quote_amount,order_count,conversion_rate]，dimensions=[partner,status,customer]，analysisMode=risk_analysis，outputPreference=[text_summary,table]。',
      '正例：“订单情况，以广州办渠道下单汇总分析的结构展示” 应输出 objectTypes=[order,partner]，metrics=[order_count,order_amount,total_amount]，dimensions=[region,partner,month,status]，analysisMode=summary_report，outputPreference=[text_summary,table,chart,html_report]。',
      '正例：“报备保护期快到期的客户有哪些” 应输出 objectTypes=[registration,partner,customer]，metrics=[registration_count]，dimensions=[partner,status,customer]，analysisMode=risk_analysis，outputPreference=[text_summary,table]。',
      '正例：“帮我分析商机情况，再加趋势和阶段分布，用表格和图表呈现” 应输出 objectTypes=[opportunity]，metrics=[opportunity_count,opportunity_amount]，dimensions=[month,stage,partner]，analysisMode=summary_report，outputPreference=[text_summary,table,chart]。',
      '正例：“帮我查询分析下，公司当前的合作伙伴开拓情况、客户商机报备及订单情况，并且给出后续经营建议” 应输出 objectTypes=[partner,registration,opportunity,order]，metrics 至少包含 partner_count、registration_count、opportunity_count、opportunity_amount、order_count、order_amount，dimensions 至少包含 partner、stage、status，analysisMode=summary_report，outputPreference=[text_summary,table]，missingConditions=[]，requestedAction=READONLY_ANALYSIS。',
      `用户问题：${context.questionText}`,
    ].join('\n'),
    outputSchema: {
      type: 'object',
      additionalProperties: false,
      required: [
        'objectTypes',
        'metrics',
        'dimensions',
        'filters',
        'analysisMode',
        'outputPreference',
        'comparison',
        'entities',
        'confidence',
        'missingConditions',
        'unsupportedHints',
        'requestedAction',
        'normalizedQuestion',
      ],
      properties: {
        objectTypes: { type: 'array', items: { type: 'string', enum: OBJECT_TYPES } },
        metrics: { type: 'array', items: { type: 'string', enum: METRICS } },
        dimensions: { type: 'array', items: { type: 'string', enum: DIMENSIONS } },
        filters: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['field', 'operator', 'value', 'label'],
            properties: {
              field: { type: 'string' },
              operator: { type: 'string', enum: ['eq', 'contains', 'in', 'between'] },
              value: { anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
              label: { type: 'string' },
            },
          },
        },
        timeRange: {
          type: 'object',
          additionalProperties: false,
          properties: {
            rawText: { type: 'string' },
            normalizedLabel: { type: 'string' },
            startAt: { type: 'string' },
            endAt: { type: 'string' },
            timezone: { type: 'string', enum: ['Asia/Shanghai'] },
            granularity: { type: 'string', enum: ['day', 'week', 'month', 'quarter', 'year', 'custom'] },
            relativity: { type: 'string', enum: ['absolute', 'relative', 'mixed'] },
            inclusivity: {
              type: 'object',
              additionalProperties: false,
              properties: {
                start: { type: 'string', enum: ['inclusive'] },
                end: { type: 'string', enum: ['exclusive', 'inclusive'] },
              },
            },
            confidence: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
            unresolvedReason: { type: 'string' },
          },
        },
        analysisMode: { type: 'string', enum: ANALYSIS_MODES },
        outputPreference: { type: 'array', items: { type: 'string', enum: OUTPUT_PREFERENCES } },
        comparison: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['top_n', 'year_over_year', 'month_over_month', 'concentration', 'funnel'],
          },
        },
        sort: {
          type: 'object',
          additionalProperties: false,
          properties: {
            by: { type: 'string' },
            field: { type: 'string' },
            direction: { type: 'string', enum: ['ASC', 'DESC', 'asc', 'desc'] },
          },
        },
        limit: {
          anyOf: [
            { type: 'number' },
            { type: 'string', enum: ['all', 'ALL', '全部', '所有', '不限', '无限制'] },
          ],
        },
        entities: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'value'],
            properties: {
              type: { type: 'string' },
              value: { type: 'string' },
              normalizedValue: { type: 'string' },
              confidence: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
            },
          },
        },
        confidence: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
        missingConditions: { type: 'array', items: { type: 'string' } },
        unsupportedHints: { type: 'array', items: { type: 'object' } },
        requestedAction: { type: 'string', enum: ['READONLY_ANALYSIS', 'BLOCK'] },
        blockReason: { type: 'string' },
        normalizedQuestion: { type: 'string' },
      },
    },
  }),
  normalize: (raw, context) => {
    const normalizedQuestion =
      typeof raw.normalizedQuestion === 'string' && raw.normalizedQuestion.trim()
        ? raw.normalizedQuestion.trim()
        : context.questionText.trim();
    const timeRange = normalizeTemporalSlot(raw.timeRange);
    const hasIncompleteTimeRange = Boolean(timeRange && !timeRange.startAt && !timeRange.endAt);
    const questionHasTemporalConstraint = hasExplicitTemporalConstraint(normalizedQuestion);
    const normalizedObjectTypes = normalizeEnumArray(raw.objectTypes, OBJECT_TYPES);
    const normalizedMetrics = normalizeEnumArray(raw.metrics, METRICS);
    const normalizedDimensions = normalizeEnumArray(raw.dimensions, DIMENSIONS);
    const normalizedAnalysisMode = normalizeAnalysisMode(raw.analysisMode);
    const normalizedOutputPreference = normalizeEnumArray(raw.outputPreference, OUTPUT_PREFERENCES);
    const normalizedComparison = normalizeEnumArray(raw.comparison, [
      'top_n',
      'year_over_year',
      'month_over_month',
      'concentration',
      'funnel',
    ]);
    const compensatedSlots = compensateExplicitQuestionSignals(
      `${context.questionText.trim()} ${normalizedQuestion}`.trim(),
      {
        objectTypes: normalizedObjectTypes,
        metrics: normalizedMetrics,
        dimensions: normalizedDimensions,
        analysisMode: normalizedAnalysisMode,
        outputPreference: normalizedOutputPreference,
        comparison: normalizedComparison,
      },
    );
    const normalizedSort = normalizeSort(raw.sort);
    const missingConditions = normalizeAnalysisMissingConditions(raw.missingConditions, {
      keepTimeRangeCondition:
        hasIncompleteTimeRange || (!timeRange && questionHasTemporalConstraint),
      dropDefaultableMetricOrDimension:
        compensatedSlots.objectTypes.length > 0 &&
        (compensatedSlots.metrics.length > 0 ||
          compensatedSlots.dimensions.length > 0 ||
          compensatedSlots.analysisMode !== 'single_metric'),
    });
    if (!timeRange && questionHasTemporalConstraint && !missingConditions.includes('时间范围')) {
      missingConditions.push('时间范围');
    }

    return {
      objectTypes: compensatedSlots.objectTypes,
      metrics: compensatedSlots.metrics,
      dimensions: compensatedSlots.dimensions,
      filters: normalizeFilters(raw.filters),
      ...(timeRange ? { timeRange } : {}),
      analysisMode: compensatedSlots.analysisMode,
      outputPreference: compensatedSlots.outputPreference,
      comparison: compensatedSlots.comparison,
      ...(normalizedSort ? { sort: normalizedSort } : {}),
      ...(typeof raw.limit === 'number' && Number.isFinite(raw.limit)
        ? { limit: Math.max(1, Math.min(Math.floor(raw.limit), 100)) }
        : {}),
      entities: normalizeEntities(raw.entities),
      confidence: normalizeConfidence(raw.confidence, 'MEDIUM'),
      missingConditions: timeRange
        ? missingConditions.filter((item) => item !== '时间范围')
        : missingConditions,
      unsupportedHints: [],
      requestedAction: raw.requestedAction === 'BLOCK' ? 'BLOCK' : 'READONLY_ANALYSIS',
      blockReason:
        raw.requestedAction === 'BLOCK' && typeof raw.blockReason === 'string'
          ? raw.blockReason.trim()
          : '',
      normalizedQuestion,
    };
  },
  isNone: (output) =>
    output.requestedAction !== 'BLOCK' &&
    output.objectTypes.length === 0 &&
    output.metrics.length === 0 &&
    output.dimensions.length === 0,
};

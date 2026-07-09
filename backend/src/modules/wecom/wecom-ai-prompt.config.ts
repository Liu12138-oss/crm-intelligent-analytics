import type { DailyReportFragmentType } from '../../shared/types/domain';
import {
  DAILY_REPORT_SECTION_LABELS,
  DAILY_REPORT_SECTION_ORDER,
} from '../daily-report/daily-report.constants';
import { WECOM_COMMON_CONFIRM_REPLIES } from './wecom-reply-intent.helper';

export const WECOM_EXPLANATION_KEYWORDS = [
  '这说明什么',
  '为什么',
  '怎么理解',
  '意味着什么',
  '有什么风险',
  '怎么回事',
];

export const WECOM_FOLLOW_UP_KEYWORDS = [
  '按负责人',
  '按区域',
  '换成',
  '改成',
  '最近三个月',
  '近三个月',
  '再看',
  '再按',
];

export const WECOM_DAILY_REPORT_KEYWORDS = [
  '日报',
  '销售日报',
  '生成日报',
  '提交日报',
  '写日报',
  '收口日报',
];

export const WECOM_TASK_CANCEL_KEYWORDS = [
  '取消',
  '不做了',
  '先不做了',
  '先停一下',
  '先停下',
  '停止',
  '停一下',
  '先不用了',
  '不用了',
  '不跟进了',
  '不建了',
  '不写了',
  '先不写了',
];

export const WECOM_FOLLOW_UP_POST_WRITEBACK_REMINDER_HINT =
  '为了日报完整，如果还有其它跟进信息，或者新增商机、客户，请及时录入信息哦！';

export const WECOM_DAILY_REPORT_THEME_ENTRY_KEYWORDS = [
  '今日跟进',
  '今天跟进',
  '本日跟进',
  '当天跟进',
  '帮我写今天的跟进',
  '帮我写今日跟进',
  '帮我整理今天的跟进',
  '帮我整理今日跟进',
  '帮我生成今天的跟进',
  '帮我生成今日跟进',
  '帮我写今天客户跟进',
  '帮我写今日客户跟进',
  '帮我写今天商机跟进',
  '帮我写今日商机跟进',
  '写今天的跟进',
  '写今日跟进',
  '整理今天的跟进',
  '整理今日跟进',
  '生成今天的跟进',
  '生成今日跟进',
  '今日客户跟进',
  '今天客户跟进',
  '今日商机跟进',
  '今天商机跟进',
  '写今天客户跟进',
  '写今日客户跟进',
  '写今天商机跟进',
  '写今日商机跟进',
];

export const WECOM_DAILY_REPORT_SELF_VIEW_KEYWORDS = [
  '生成日报',
  '生成今日日报',
  '生成今天日报',
  '帮我生成日报',
  '帮我生成今日日报',
  '帮我生成今天日报',
  '生成我的日报',
  '生成我今天的日报',
  '查看我今天的日报',
  '查看今天日报',
  '查看今日日报',
  '查看今日日报',
  '查看我的日报',
  '看看今天日报',
  '看看我今天的日报',
  '看看今日日报',
  '看看今日日报',
  '看看我的日报',
  '输出今天日报',
  '输出我今天的日报',
  '输出今日日报',
  '输出今日日报',
  '今天日报',
  '我的今天日报',
  '我的今日日报',
  '我今天的日报',
  '今天的日报',
  '今日日报',
  '本日日报',
  '当天日报',
  '日报预览',
  '今天日报预览',
  '今日日报预览',
];

const WECOM_DAILY_REPORT_THEME_FOLLOW_UP_TOKENS = [
  '跟进',
  '写',
  '整理',
  '生成',
  '记录',
];

const WECOM_DAILY_REPORT_THEME_OBJECT_TOKENS = [
  '商机',
  '客户',
  '项目',
];

const WECOM_DAILY_REPORT_THEME_TIME_TOKENS = [
  '今日',
  '今天',
  '本日',
  '当天',
];

const WECOM_DAILY_REPORT_ANALYSIS_BLOCK_TOKENS = [
  '分析',
  '统计',
  '排名',
  '金额',
  '赢单率',
  '转化率',
  '趋势',
  '明细',
  '报表',
  '查询',
  '怎么看',
  '怎么样',
  '多少',
  '数据',
  '范围',
];

const WECOM_DAILY_REPORT_COLLECTION_TOKENS = [
  '写',
  '补',
  '补充',
  '提交',
  '收口',
  '整理',
  '录入',
  '填写',
  '跟进',
];

const WECOM_TEAM_DAILY_REPORT_TARGET_TOKENS = ['小组', '团队'];

const WECOM_TEAM_DAILY_REPORT_UNSUPPORTED_TIME_TOKENS = [
  '昨天',
  '昨日',
  '前天',
  '明天',
  '后天',
  '本周',
  '这周',
  '上周',
  '下周',
  '本月',
  '上月',
  '下月',
  '本季度',
  '上季度',
  '下季度',
];

const WECOM_TEAM_DAILY_REPORT_ACTION_TOKENS = [
  '发给我',
  '发我',
  '给我看',
  '给我看看',
  '看看',
  '查看',
  '输出',
  '发一下',
];

const WECOM_TEAM_DAILY_REPORT_GENERIC_TARGETS = [
  '我',
  '我的',
  '我们',
  '本组',
  '本团队',
  '这个',
  '那个',
];

export const WECOM_DAILY_REPORT_CONFIRM_KEYWORDS = [
  ...WECOM_COMMON_CONFIRM_REPLIES,
  '正确',
];

interface WecomSupportedCapability {
  title: string;
  description: string;
  examples: string[];
}

export interface WecomTeamDailyReportPreviewIntent {
  leaderNameQuery: string;
}

export type WecomHelpIntentKind = 'GREETING' | 'CAPABILITY';

export type WecomHelpPromptScene =
  | 'GREETING'
  | 'CAPABILITY'
  | 'LOW_CONFIDENCE'
  | 'OUT_OF_SCOPE'
  | 'WRITE_BLOCKED';

const WECOM_SUPPORTED_CAPABILITIES: WecomSupportedCapability[] = [
  {
    title: '经营分析问数',
    description: '可查询商机、客户、报价、订单、合同、负责人、区域、大区、渠道商和技术服务商等经营数据，自动匹配动态看板、趋势图、漏斗图、地图、占比图、排行表和明细摘要，并给出经营判断、风险原因和动作建议',
    examples: ['全国渠道商发展运营情况', '大北区26年一季度与二季度商机对比分析', '山东华安赛服智能科技有限公司整体情况分析'],
  },
  {
    title: '跟进整理与受控写回',
    description: '支持“今日跟进”“跟进商机”“跟进客户”等入口，整理后写入 CRM',
    examples: ['跟进商机', '今日跟进'],
  },
  {
    title: '受控新增客户',
    description: '分步补齐客户字段，展示摘要并确认创建',
    examples: ['新增客户'],
  },
  {
    title: '受控新增商机',
    description: '分步补齐商机字段，识别客户后展示摘要并确认创建',
    examples: ['新增商机'],
  },
  {
    title: '今日日报查看',
    description: '查看个人今日日报预览，或继续补充日报相关内容',
    examples: ['查看今日日报', '生成日报'],
  },
  {
    title: '小组今日日报查看',
    description: '按负责人查看指定小组今天的日报预览',
    examples: ['把王文定小组日报发给我', '给我看看赵阳团队今日日报'],
  },
  {
    title: '客户 / 商机列表与详情查询',
    description: '查询当前可跟进范围内的客户或商机列表，并支持继续查看某一项详情',
    examples: ['查中国银行客户列表', '安恒信息这个商机详情', '看第2个详情'],
  },
];

const WECOM_ANALYSIS_MAIN_CHAIN_GUIDANCE_LINES = [
  '说明：正式经营分析以当前 CRM 主链可访问数据和你的权限范围为准，示例问题只用于引导提问，不作为线上数据源。',
  '分析类问题会尽量返回企微卡片、Markdown 摘要和完整报告链接；折线图、饼图、对比柱状图等完整图表放在报告页，内容包含问题复述、数据口径、核心判断、指标拆解、图表对比、排行明细、风险原因、动作建议和建议追问。',
  '可以这样问：',
  '· 总览看板：全国渠道商发展运营情况、经营数据总览、技术服务商开拓情况。',
  '· 对比分析：北区一季度和二季度商机对比、大北区与大东区渠道贡献对比、某销售本季度与上季度订单对比。',
  '· 维度拆解：按区域、大区、渠道商、技术服务商、销售负责人、商机阶段、报价状态、订单状态、贡献占比和风险原因拆解。',
];

const WECOM_GREETING_HELP_KEYWORDS = ['你好', '您好', 'hi', 'hello', '在吗'];

const WECOM_CAPABILITY_HELP_KEYWORDS = [
  '你是谁',
  '你能做什么',
  '你会什么',
  '帮助',
  'help',
];

function normalizeWecomThemeIntentText(messageText: string): {
  trimmedText: string;
  coreText: string;
  normalizedText: string;
} {
  const trimmedText = messageText.trim();
  const coreText = trimmedText.replace(/[：:。！？!?，,；;\s]+$/gu, '');
  const normalizedText = coreText.replace(/\s+/g, '');
  return {
    trimmedText,
    coreText,
    normalizedText,
  };
}

/**
 * 统一渲染企业微信机器人当前已支持能力，避免取消提示、帮助提示和阻断提示各自维护一份列表。
 */
function buildWecomCapabilityLines(): string[] {
  return WECOM_SUPPORTED_CAPABILITIES.map((item, index) => {
    const exampleText =
      item.examples.length > 0
        ? `，例如：${item.examples.map((example) => `“${example}”`).join('、')}`
        : '';
    return `${index + 1}. ${item.title}：${item.description}${exampleText}`;
  });
}

/**
 * 将通用帮助开场与统一能力目录拼装为企业微信可直接下发的引导文案。
 */
function buildWecomCapabilityGuidancePrompt(lines: string[]): string {
  return [
    ...lines,
    ...WECOM_ANALYSIS_MAIN_CHAIN_GUIDANCE_LINES,
    '你把想查的、想办的直接发我就行，我会按下面这些能力继续帮你：',
    ...buildWecomCapabilityLines(),
  ].join('\n');
}

/**
 * 识别企业微信里的寒暄、身份询问和能力询问，避免这类短句误落到分析问数链路。
 */
export function detectWecomHelpIntent(
  messageText?: string,
): WecomHelpIntentKind | undefined {
  const { normalizedText } = normalizeWecomThemeIntentText(messageText ?? '');
  if (!normalizedText) {
    return undefined;
  }

  const normalizedGreetingKeywords = WECOM_GREETING_HELP_KEYWORDS.map((keyword) =>
    keyword.replace(/[：:。！？!?，,；;\s]/gu, '').toLowerCase(),
  );
  if (normalizedGreetingKeywords.includes(normalizedText.toLowerCase())) {
    return 'GREETING';
  }

  const normalizedCapabilityKeywords = WECOM_CAPABILITY_HELP_KEYWORDS.map((keyword) =>
    keyword.replace(/[：:。！？!?，,；;\s]/gu, '').toLowerCase(),
  );
  if (normalizedCapabilityKeywords.includes(normalizedText.toLowerCase())) {
    return 'CAPABILITY';
  }

  return undefined;
}

/**
 * 将分析链路中的部分阻断原因映射为统一帮助提示场景，保证用户侧看到的是可继续操作的引导文案。
 */
export function resolveWecomHelpPromptSceneFromBlockedReason(
  blockedReason: string,
): WecomHelpPromptScene | undefined {
  if (
    blockedReason.includes('语义不够明确') ||
    blockedReason.includes('请补充 CRM 对象、时间范围或分析指标')
  ) {
    return 'LOW_CONFIDENCE';
  }

  if (
    blockedReason.includes('仅支持 CRM 智能分析相关问题') ||
    blockedReason.includes('改为商机、合同、客户')
  ) {
    return 'OUT_OF_SCOPE';
  }

  if (
    blockedReason.includes('仅支持受控问数') ||
    blockedReason.includes('不支持写入') ||
    blockedReason.includes('不支持写入、修改、删除或提醒创建类请求')
  ) {
    return 'WRITE_BLOCKED';
  }

  return undefined;
}

export function isWecomDailyReportThemeEntryIntent(messageText: string): boolean {
  const { coreText, normalizedText } = normalizeWecomThemeIntentText(messageText);

  if (!normalizedText) {
    return false;
  }

  const normalizedKeywords = WECOM_DAILY_REPORT_THEME_ENTRY_KEYWORDS.map((keyword) =>
    keyword.replace(/[：:。！？!?，,；;\s]/gu, ''),
  );
  if (normalizedKeywords.some((keyword) => normalizedText === keyword)) {
    return true;
  }
  if (
    normalizedKeywords.some((keyword) => normalizedText.startsWith(keyword)) &&
    /[:：]/u.test(coreText)
  ) {
    return true;
  }

  if (
    coreText.length > 12 ||
    /[:：,，。！？!?；;\n"'“”‘’]/u.test(coreText)
  ) {
    return false;
  }

  if (
    WECOM_DAILY_REPORT_ANALYSIS_BLOCK_TOKENS.some((token) =>
      normalizedText.includes(token),
    )
  ) {
    return false;
  }

  const hasFollowUpAction = WECOM_DAILY_REPORT_THEME_FOLLOW_UP_TOKENS.some(
    (token) => normalizedText.includes(token),
  );
  const hasFollowUpTarget = WECOM_DAILY_REPORT_THEME_OBJECT_TOKENS.some(
    (token) => normalizedText.includes(token),
  );
  const hasTodayHint = WECOM_DAILY_REPORT_THEME_TIME_TOKENS.some((token) =>
    normalizedText.includes(token),
  );

  return (
    (normalizedText.includes('跟进') && (hasFollowUpTarget || hasTodayHint)) ||
    (hasFollowUpAction && hasFollowUpTarget && hasTodayHint)
  );
}

export function isWecomDailyReportThemeOnlyMessage(messageText: string): boolean {
  const { coreText, normalizedText } = normalizeWecomThemeIntentText(messageText);
  if (!isWecomDailyReportThemeEntryIntent(messageText)) {
    return false;
  }

  return (
    coreText.length <= 12 &&
    !/[:：,，。！？!?；;\n"'“”‘’]/u.test(coreText) &&
    normalizedText.length > 0
  );
}

export function isWecomDailyReportEntryOnlyMessage(messageText: string): boolean {
  const { coreText, normalizedText } = normalizeWecomThemeIntentText(messageText);
  if (!normalizedText) {
    return false;
  }

  const normalizedKeywords = WECOM_DAILY_REPORT_KEYWORDS.map((keyword) =>
    keyword.replace(/[，。！？：；\s]/gu, ''),
  );
  if (normalizedKeywords.some((keyword) => normalizedText === keyword)) {
    return true;
  }

  if (
    coreText.length > 12 ||
    /[:：，。！？；\n"'“”‘’]/u.test(coreText)
  ) {
    return false;
  }

  return normalizedKeywords.some((keyword) => normalizedText.startsWith(keyword));
}

export function isWecomDailyReportSelfViewIntent(messageText: string): boolean {
  const { coreText, normalizedText } = normalizeWecomThemeIntentText(messageText);
  if (!normalizedText) {
    return false;
  }

  if (
    WECOM_TEAM_DAILY_REPORT_TARGET_TOKENS.some((token) =>
      normalizedText.includes(token),
    )
  ) {
    return false;
  }

  const normalizedKeywords = WECOM_DAILY_REPORT_SELF_VIEW_KEYWORDS.map((keyword) =>
    keyword.replace(/[：:。！？!?，,；;\s]/gu, ''),
  );
  if (normalizedKeywords.some((keyword) => normalizedText === keyword)) {
    return true;
  }

  if (/[:：]/u.test(coreText)) {
    return false;
  }

  if (
    WECOM_DAILY_REPORT_ANALYSIS_BLOCK_TOKENS.some((token) =>
      normalizedText.includes(token),
    )
  ) {
    return false;
  }

  const hasTodayHint =
    normalizedText.includes('今天') ||
    normalizedText.includes('今日') ||
    normalizedText.includes('本日') ||
    normalizedText.includes('当天');
  const hasCollectionIntent = WECOM_DAILY_REPORT_COLLECTION_TOKENS.some((token) =>
    normalizedText.includes(token),
  );
  if (
    normalizedText.includes('日报') &&
    hasTodayHint &&
    !hasCollectionIntent &&
    coreText.length <= 12
  ) {
    return true;
  }

  return (
    normalizedText.includes('日报') &&
    hasTodayHint &&
    (normalizedText.includes('我') || normalizedText.includes('我的') || normalizedText.includes('看看') || normalizedText.includes('查看') || normalizedText.includes('输出'))
  );
}

/**
 * 识别“把王文定小组日报发给我”这类高置信小组日报预览入口。
 * 只有同时命中小组目标、日报主题和主动索取动作时才返回；若未写时间则默认按今天处理，
 * 仍需避免误伤“王文定小组日报”这类低置信短句。
 */
export function parseWecomTeamDailyReportPreviewIntent(
  messageText: string,
): WecomTeamDailyReportPreviewIntent | undefined {
  const { normalizedText } = normalizeWecomThemeIntentText(messageText);
  if (!normalizedText || !normalizedText.includes('日报')) {
    return undefined;
  }

  const hasTargetToken = WECOM_TEAM_DAILY_REPORT_TARGET_TOKENS.some((token) =>
    normalizedText.includes(token),
  );
  const hasActionToken = WECOM_TEAM_DAILY_REPORT_ACTION_TOKENS.some((token) =>
    normalizedText.includes(token),
  );
  if (!hasTargetToken || !hasActionToken) {
    return undefined;
  }

  if (
    WECOM_TEAM_DAILY_REPORT_UNSUPPORTED_TIME_TOKENS.some((token) =>
      normalizedText.includes(token),
    )
  ) {
    return undefined;
  }

  const leaderNameQuery =
    normalizedText.match(/(?:把|给我看看|给我看|看看|查看|输出)?(?<leader>[\u4e00-\u9fa5A-Za-z0-9·]{2,20}?)(?:小组|团队)(?:今天|今日|本日|当天)?(?:的)?日报/u)
      ?.groups?.leader?.trim() ??
    normalizedText.match(/(?<leader>[\u4e00-\u9fa5A-Za-z0-9·]{2,20}?)(?:小组|团队)/u)?.groups?.leader?.trim();
  const normalizedLeaderNameQuery = leaderNameQuery
    ?.replace(/^(?:请|麻烦|帮我|把|给我看看|给我看|看看|查看|输出)+/u, '')
    .trim();
  if (!normalizedLeaderNameQuery) {
    return undefined;
  }

  if (
    WECOM_TEAM_DAILY_REPORT_GENERIC_TARGETS.some(
      (token) => normalizedLeaderNameQuery === token,
    )
  ) {
    return undefined;
  }

  return {
    leaderNameQuery: normalizedLeaderNameQuery,
  };
}

export const WECOM_DAILY_REPORT_REVISE_KEYWORDS = [
  '修改',
  '重写',
  '重新',
  '改成',
  '不对',
  '有问题',
  '调整',
];

export const WECOM_FOLLOW_UP_WRITEBACK_CONFIRM_KEYWORDS = [
  ...WECOM_COMMON_CONFIRM_REPLIES,
  '现在写',
  '写入',
  '写吧',
];

export const WECOM_FOLLOW_UP_WRITEBACK_CANCEL_KEYWORDS = [
  '取消',
  '不用',
  '不写',
  '暂不',
  '稍后',
  '先不写',
  '不做了',
  '先不做了',
  '先停一下',
  '停止',
  '不跟进了',
];

export const WECOM_FOLLOW_UP_WRITEBACK_RETRY_KEYWORDS = [
  '重试',
  '再试一次',
  '重新写入',
];

export const WECOM_FOLLOW_UP_WRITEBACK_MODIFY_KEYWORDS = [
  '修改',
  '改成',
  '不对',
  '重写',
  '调整',
];

export const WECOM_FOLLOW_UP_SHARE_CONFIRM_KEYWORDS = [
  ...WECOM_COMMON_CONFIRM_REPLIES,
  '分享',
  '转发',
  '发到群',
  '分享到群',
  '需要分享',
];

export const WECOM_FOLLOW_UP_SHARE_CANCEL_KEYWORDS = [
  '取消',
  '不用',
  '不分享',
  '不用分享',
  '先不分享',
  '不做了',
  '先不做了',
  '先停一下',
  '停止',
];

function getDailyReportStepHint(stepType: DailyReportFragmentType): string {
  switch (stepType) {
    case 'TODAY_FOLLOW_UP':
      return '请先告诉我跟进客户和跟进信息，一句话也可以。';
    case 'CUSTOMER_OR_OPPORTUNITY_CHANGE':
      return '本轮有没有新增客户或商机？有就补一句，没有就直接回“没有”。';
    case 'INFORMATION_SHARE':
      return '这条信息需要共享给谁或哪些同事？没有就回“无需共享”。';
    case 'HELP_REQUIRED':
      return '有没有困难或需要协助？没有就回“没有”。';
    case 'TOMORROW_PLAN':
      return '最后补一句后续计划。';
    default:
      return '请继续补充当前日报内容。';
  }
}

function getDailyReportMissingLabelHint(label: string): string {
  switch (label) {
    case DAILY_REPORT_SECTION_LABELS.TODAY_FOLLOW_UP:
      return '请先补充跟进客户和跟进信息。';
    case DAILY_REPORT_SECTION_LABELS.CUSTOMER_OR_OPPORTUNITY_CHANGE:
      return '请继续补充有没有新增客户或商机；没有就直接回“没有”。';
    case DAILY_REPORT_SECTION_LABELS.INFORMATION_SHARE:
      return '请继续补充是否需要信息共享；没有就回“无需共享”。';
    case DAILY_REPORT_SECTION_LABELS.HELP_REQUIRED:
      return '请继续补充有没有困难或需要协助；没有就回“没有”。';
    case DAILY_REPORT_SECTION_LABELS.TOMORROW_PLAN:
      return '请补一句后续计划。';
    default:
      return `请继续补充：${label}。`;
  }
}

export const WECOM_SUPPORTED_SEMANTICS = [
  '主题域仅限商机、合同、客户相关经营分析',
  '只支持只读分析，不支持新增、修改、删除、提醒等写入动作',
  '分析必须继承当前用户 CRM 权限范围',
  '当条件不足时，优先补问，不允许编造默认业务事实',
];

export function buildWecomExplanationPrompt(params: {
  userQuestion: string;
  latestQuestion?: string;
  latestSummary?: string;
  scopeSummary?: string;
}): string {
  return [
    '你是 CRM 智能分析系统中的企业微信 AI 助手。',
    '请基于真实查询结果，用企业微信友好的中文简短解释回答用户。',
    '必须遵守以下约束：',
    ...WECOM_SUPPORTED_SEMANTICS.map((item, index) => `${index + 1}. ${item}`),
    `当前用户追问：${params.userQuestion}`,
    `上一轮问题：${params.latestQuestion ?? '无'}`,
    `上一轮结果摘要：${params.latestSummary ?? '无'}`,
    `权限范围摘要：${params.scopeSummary ?? '无'}`,
  ].join('\n');
}

export function buildWecomDailyReportPrompt(params: {
  stepType: DailyReportFragmentType;
  latestQuestion?: string;
  latestSummary?: string;
}): string {
  return [
    '你是 CRM 智能分析系统中的企业微信日报助手。',
    `当前需要补充：${DAILY_REPORT_SECTION_LABELS[params.stepType]}。`,
    getDailyReportStepHint(params.stepType),
    '如果用户已经发来一段话，先自动归纳出已识别内容，再只追问下一项。',
    '如果内容不完整，也要先整理已识别部分，再告诉用户还缺什么。',
    `上一轮日报上下文：${params.latestQuestion ?? '无'}`,
    `当前日报摘要：${params.latestSummary ?? '无'}`,
  ].join('\n');
}

export function buildWecomDailyReportThemeEntryPrompt(params: {
  requesterName: string;
}): string {
  return `好的，${params.requesterName}，请告诉我主要跟进了哪些项目？`;
}

export function buildWecomFollowUpTemplateEntryPrompt(params: {
  requesterName: string;
}): string {
  void params;
  return [
    '收到，本次跟进由我来统一整理。',
    '',
    '你可直接发送一段简洁通顺的文字汇报跟进情况，内容可涵盖：工作跟进详情、问题协助需求、后续拜访规划、行业信息同步四大板块；',
    '',
    '也可以按照以下固定格式填写提交：',
    '',
    '跟进内容：今日对接 / 拜访的完整公司及客户名称、具体工作事项、项目当前推进进度',
    '问题与协助：现阶段遇到的难点、卡点问题，及需要协同协助的事项；若无则填写「无」',
    '拜访计划：后续计划拜访时间、同行人员、拜访对象、沟通事项及预期达成目标；暂无安排则填「暂无」',
    '信息分享：同步友商动态、政策调整、行业资讯、客户真实反馈等有效干货；无相关内容填写「无」',
    '',
    '温馨提示：',
    '请务必填写完整公司全称及客户信息，便于精准识别归档。',
    '所有跟进内容将统一录入 CRM 系统，自动同步生成每日工作日报，请认真如实填写～',
  ].join('\n');
}

export function buildWecomTaskSwitchLeadInPrompt(taskLabel?: string): string {
  return taskLabel
    ? `好的，${taskLabel}我先帮你结束，接下来处理你刚发的新任务。`
    : '好的，上一项任务我先帮你结束，接下来处理你刚发的新任务。';
}

/**
 * 统一输出企业微信帮助提示，既说明当前不能直接执行的原因，也给出可落地的能力目录。
 */
export function buildWecomHelpPrompt(params: {
  scene: WecomHelpPromptScene;
  taskLabel?: string;
}): string {
  const sceneLines = (() => {
    switch (params.scene) {
      case 'GREETING':
        return ['你好呀，我是 CRM 智能小助手，可以陪你一起查数、记跟进、建客户 / 商机、看日报。'];
      case 'CAPABILITY':
        return ['我是 CRM 智能小助手，随时可以帮你处理 CRM 相关问题。'];
      case 'LOW_CONFIDENCE':
        return [
          '这句话我还没完全听明白，不过没关系，你可以换个更具体的说法，我来继续帮你。',
        ];
      case 'OUT_OF_SCOPE':
        return [
          '这个需求我暂时还帮不上，不过 CRM 相关的查询和受控流程我都可以继续陪你处理。',
        ];
      case 'WRITE_BLOCKED':
        return [
          '这类请求我现在还不能直接帮你写入或修改，不过查询、解释和受控流程我可以继续陪你处理。',
        ];
      default:
        return ['这个请求我先没法直接处理，不过我可以继续帮你看看别的 CRM 相关事项。'];
    }
  })();

  return buildWecomCapabilityGuidancePrompt([
    ...sceneLines,
    params.taskLabel
      ? `${params.taskLabel}我先替你留着，想继续的话直接接着回复我就好。`
      : '你可以从下面这些能力里直接接着发我，我来继续帮你。',
  ]);
}

export function buildWecomTaskCancelledPrompt(taskLabel?: string): string {
  const openingLine = taskLabel
    ? `好的，${taskLabel}我先帮你结束。`
    : '好的，当前任务我先帮你结束。';
  return buildWecomCapabilityGuidancePrompt([openingLine]);
}

export function buildWecomFollowUpTemplateCollectPrompt(params: {
  filledLines: string[];
  missingLabels: string[];
  needsExplicitEntityName?: boolean;
}): string {
  const reminderLines = [
    params.needsExplicitEntityName
      ? '还差一步：请在“跟进内容”里把公司名或客户名写清楚，我才能继续帮你精准识别并整理成 CRM 跟进。'
      : undefined,
    params.missingLabels.length > 0
      ? `剩下还可以继续补：${params.missingLabels.join('、')}。`
      : undefined,
  ].filter((item): item is string => Boolean(item));

  return [
    params.filledLines.length > 0 ? '我先帮你整理到这里：' : '我先帮你把模板占好位：',
    ...params.filledLines.map((item, index) => `${index + 1}. ${item}`),
    ...reminderLines,
    '没有的内容可以直接写“无”或“暂无”，我会一起整理进去。',
  ].join('\n');
}

export function buildWecomDailyReportReviewPrompt(params: {
  reportTitle: string;
  extractedSectionLines: string[];
  backendMatchLines: string[];
  fallbackCandidates: string[];
  missingSectionLabels: string[];
  confirmationSummaryLines: string[];
}): string {
  const currentMissingLabel = params.missingSectionLabels[0];
  return [
    '我先帮你整理成确认摘要：',
    ...params.confirmationSummaryLines,
    params.backendMatchLines.length > 0
      ? `命中的客户/商机：${params.backendMatchLines.slice(0, 3).join('；')}`
      : undefined,
    params.fallbackCandidates.length > 0
      ? `待核对名称：${params.fallbackCandidates.slice(0, 3).join('、')}`
      : undefined,
    currentMissingLabel
      ? `当前还需要补充：${getDailyReportMissingLabelHint(currentMissingLabel)}`
      : '内容已整理完成，请确认是否正确。',
    '回复“确认”继续，回复“修改”或直接补充新内容即可。',
  ].join('\n');
}

export function buildWecomDailyReportSharePrompt(params: {
  reportTitle: string;
  draftSummary: string;
  sectionTypes: DailyReportFragmentType[];
  requesterName: string;
}): string {
  return [
    '你是 CRM 智能分析系统中的企业微信日报分享助手。',
    '请基于已落库的日报内容，输出给销售的简短分享总结。',
    '要求中文自然、简短明确，不要编造未写入的内容。',
    `日报标题：${params.reportTitle}`,
    `销售姓名：${params.requesterName}`,
    `已完成步骤：${params.sectionTypes.map((item) => DAILY_REPORT_SECTION_LABELS[item]).join('、')}`,
    `日报摘要：${params.draftSummary}`,
  ].join('\n');
}

export function buildWecomDailyReportEntityIntentPrompt(params: {
  companyNames: string[];
  projectNames: string[];
  summaryLines?: string[];
}): string {
  const identifiedLines: string[] = [];
  const projectItems = params.projectNames.slice(0, 3);
  const customerItems = params.companyNames.slice(0, 3);

  if (projectItems.length > 0) {
    identifiedLines.push(
      ...projectItems.map((item, index) =>
        projectItems.length > 1 ? `项目${index + 1}：${item}` : `项目：${item}`,
      ),
    );
  }
  if (customerItems.length > 0) {
    identifiedLines.push(
      ...customerItems.map((item, index) =>
        customerItems.length > 1 ? `客户${index + 1}：${item}` : `客户：${item}`,
      ),
    );
  }

  if (identifiedLines.length === 0) {
    return '我还没有从这段记录里识别出明确的项目或客户名称。请补充项目名或客户名，我再继续帮你写 CRM 跟进记录。';
  }

  return [
    '我先根据你的记录识别到这些信息：',
    ...identifiedLines.map((item, index) => `${index + 1}. ${item}`),
    ...(params.summaryLines && params.summaryLines.length > 0
      ? [
          `${identifiedLines.length + 1}. 跟进摘要：`,
          ...params.summaryLines.map((item) => `   ${item}`),
        ]
      : []),
    '如果这些信息没问题，我再去 CRM 查询对应的客户或商机，并继续帮你写跟进记录。需要继续吗？',
    '回复“确认”继续；如果项目或客户不对，直接告诉我正确名称即可。',
  ].join('\n');
}

export function buildWecomDailyReportEntityQueryResultPrompt(params: {
  queryResultLines: string[];
  actionHint?: string;
  leadLine?: string;
}): string {
  return [
    params.leadLine ?? '你给出的项目/客户信息还不够准确，我先把 CRM 查询结果和候选项发你：',
    ...params.queryResultLines,
    params.actionHint ?? '请直接回复你要继续写入的项目或客户名称，我再继续整理跟进记录。',
  ].join('\n');
}

export function buildWecomFollowUpWritebackIntentPrompt(params: {
  objectType: 'Opportunity' | 'Customer';
  opportunityTitle: string;
  customerName?: string;
  draftContent: string;
}): string {
  const objectLabel = params.objectType === 'Customer' ? '客户' : '项目';
  const identifiedLines = [`1. 项目：${params.opportunityTitle}`];
  if (params.customerName) {
    identifiedLines.push(`2. 客户：${params.customerName}`);
  }
  if (params.objectType === 'Customer') {
    identifiedLines.splice(0, identifiedLines.length, `1. 客户：${params.opportunityTitle}`);
  }

  const draftContentLines = params.draftContent
    .split(/\r?\n/u)
    .map((item) => item.trim())
    .filter(Boolean);

  return [
    '我先根据你的记录识别到这些信息：',
    ...identifiedLines,
    draftContentLines.length > 1
      ? '跟进摘要：'
      : `跟进摘要：${draftContentLines[0] ?? params.draftContent}`,
    ...(draftContentLines.length > 1
      ? draftContentLines.map((item) => `   ${item}`)
      : []),
    `如果这些信息没问题，我可以继续帮你写入 CRM ${objectLabel}跟进记录。需要现在写入吗？`,
    '回复“确认”继续，回复“取消”先不写；如果项目、客户或摘要不对，直接告诉我正确内容即可。',
  ].join('\n');
}

export function buildWecomFollowUpWritebackContentPrompt(params: {
  objectType: 'Opportunity' | 'Customer';
  opportunityTitle: string;
  draftContent: string;
  failureReason?: string;
}): string {
  const objectLabel = params.objectType === 'Customer' ? '客户' : '商机';
  return [
    params.failureReason ? `上次写入失败：${params.failureReason}` : undefined,
    `准备写入 ${objectLabel}「${params.opportunityTitle}」的跟进内容如下：`,
    params.draftContent,
    '请确认内容是否正确。回复“确认”立即写入；回复“修改”或直接发送新内容可覆盖草稿；回复“取消”可结束本次写入。',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildWecomFollowUpWritebackSuccessPrompt(params: {
  objectType: 'Opportunity' | 'Customer';
  opportunityTitle: string;
  writtenAt: string;
}): string {
  const objectLabel = params.objectType === 'Customer' ? '客户' : '商机';
  return `已将 ${objectLabel}「${params.opportunityTitle}」的跟进记录写入 CRM，写入时间：${params.writtenAt}。`;
}

export function buildWecomFollowUpSharePrompt(params: {
  objectType: 'Opportunity' | 'Customer';
  opportunityTitle: string;
  failureReason?: string;
}): string {
  const objectLabel = params.objectType === 'Customer' ? '客户' : '商机';
  return [
    `已将 ${objectLabel}「${params.opportunityTitle}」的跟进记录写入 CRM。`,
    params.failureReason ? `上次群共享失败：${params.failureReason}` : undefined,
    '是否需要分享到当前群？回复“确认”立即分享，回复“取消”结束本次群共享。',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildWecomFollowUpShareSuccessPrompt(params: {
  objectType: 'Opportunity' | 'Customer';
  opportunityTitle: string;
}): string {
  const objectLabel = params.objectType === 'Customer' ? '客户' : '商机';
  return `${objectLabel}「${params.opportunityTitle}」的跟进摘要已分享到当前群。`;
}

export function buildWecomFollowUpShareUnsupportedPrompt(params: {
  objectType: 'Opportunity' | 'Customer';
  opportunityTitle: string;
}): string {
  const objectLabel = params.objectType === 'Customer' ? '客户' : '商机';
  return `${objectLabel}「${params.opportunityTitle}」的跟进记录已写入 CRM。\n${WECOM_FOLLOW_UP_POST_WRITEBACK_REMINDER_HINT}`;
}

export function buildWecomFollowUpShareMarkdown(params: {
  objectType: 'Opportunity' | 'Customer';
  opportunityTitle: string;
  customerName?: string;
  draftContent: string;
  writtenAt: string;
}): string {
  return [
    '## CRM 跟进共享',
    `${params.objectType === 'Customer' ? '客户' : '项目'}：${params.opportunityTitle}`,
    params.objectType === 'Opportunity' && params.customerName
      ? `客户：${params.customerName}`
      : undefined,
    `摘要：${params.draftContent}`,
    `写入时间：${params.writtenAt}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function getWecomDailyReportNextStep(
  sectionTypes: DailyReportFragmentType[],
): DailyReportFragmentType | undefined {
  return DAILY_REPORT_SECTION_ORDER.find(
    (sectionType) => !sectionTypes.includes(sectionType),
  );
}

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import type {
  AppStorageState,
  ChannelType,
  CrmAnalysisPresentationTemplateType,
  CrmUser,
  MetricCard,
  ResultView,
  StreamBlock,
} from '../src/shared/types/domain';
import type {
  WecomDispatchImageAttachment,
  WecomDispatchTemplateCard,
} from '../src/modules/wecom/wecom-message.types';

interface AcceptanceQuestion {
  questionNumber: number;
  questionCode: string;
  groupName: string;
  questionText: string;
  expectedTemplateType?: CrmAnalysisPresentationTemplateType;
}

interface WecomDeliverySimulation {
  queryId?: string;
  markdown: string;
  blocks: StreamBlock[];
  templateCards: WecomDispatchTemplateCard[];
  imageAttachments: WecomDispatchImageAttachment[];
  detail: Record<string, unknown>;
}

interface WecomAcceptanceResult {
  question: AcceptanceQuestion;
  status: '通过' | '失败';
  queryId?: string;
  actualTemplateType?: string;
  actualTemplateName?: string;
  blockCount: number;
  cardCount: number;
  imageCount: number;
  metricCount: number;
  secondaryViewCount: number;
  rowCount: number;
  markdownLength: number;
  cardTitle?: string;
  cardQuote?: string;
  imagePreview?: string;
  failureReasons: string[];
  warnings: string[];
  replyPreview: string;
}

interface AcceptanceAnalysisService {
  createQuery: (
    user: CrmUser,
    payload: {
      querySource: 'FREE_TEXT';
      channel: 'wecom-bot';
      questionText: string;
      executionMode: 'PLAN_EXECUTION';
    },
  ) => Promise<Record<string, unknown>>;
  getQueryDetail: (
    user: CrmUser,
    queryId: string,
    channel: ChannelType,
  ) => Record<string, unknown>;
}

const backendRoot = resolve(__dirname, '..');
const repoRoot = resolve(backendRoot, '..');
const questionListPath = resolve(
  repoRoot,
  'docs/testing/CRM智能分析300问企微验收问题清单_20260630.txt',
);
const coverageMatrixPath = resolve(
  repoRoot,
  'docs/testing/CRM智能分析300问覆盖矩阵_20260630.md',
);
const reportPath = resolve(
  repoRoot,
  'docs/testing/CRM智能分析300问20%企微机器人链路抽检交付报告_20260701.md',
);

const requiredMarkdownTokens = [
  '### AI分析报告',
  '### 关键指标',
  '### 企微展示',
  '### 你可以继续回复',
];

const internalLeakPatterns: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bBAR_CHART\b/u, label: '内部图表枚举 BAR_CHART' },
  { pattern: /\bLINE_CHART\b/u, label: '内部图表枚举 LINE_CHART' },
  { pattern: /\bPIE_CHART\b/u, label: '内部图表枚举 PIE_CHART' },
  { pattern: /\bDETAIL_TABLE\b/u, label: '内部视图枚举 DETAIL_TABLE' },
  { pattern: /\bRANKING_TABLE\b/u, label: '内部视图枚举 RANKING_TABLE' },
  { pattern: /\bPLAN_EXECUTION\b/u, label: '执行模式内部枚举 PLAN_EXECUTION' },
  { pattern: /\bOPENAPI_MARKDOWN_SNAPSHOT\b/u, label: '执行源内部枚举 OPENAPI_MARKDOWN_SNAPSHOT' },
  { pattern: /OpenAPI Markdown 快照/u, label: '内部数据链路词 OpenAPI Markdown 快照' },
  { pattern: /本地快照|快照数据|CRM 快照数据/u, label: '内部缓存口径词快照数据' },
  { pattern: /\bfallback\b/iu, label: '内部降级词 fallback' },
  { pattern: /\bschema\b/iu, label: '内部结构词 schema' },
];

/**
 * 设置 60 问抽检的安全运行环境。
 *
 * 参数说明：无。
 * 返回值说明：无。
 * 调用注意事项：必须在动态导入 Nest 模块前执行，避免真实 AI 和真实企微长连接介入验收。
 */
function prepareSafeEnvironment(): void {
  process.env.NODE_ENV = 'development';
  process.env.OPENAI_API_KEY = '';
  process.env.ANALYSIS_AI_BASE_URL = '';
  process.env.ANALYSIS_AI_MODEL = '';
  process.env.ANALYSIS_QUERY_KNOWLEDGE_ENABLED = 'false';
  process.env.WECOM_ENABLE_SDK_TRANSPORT = 'false';
  process.env.WECOM_BOT_TRANSPORT_MODE = 'mock';
  process.env.WECOM_ANALYSIS_IMAGE_ATTACHMENT_ENABLED = 'true';
  process.env.CRM_OPENAPI_MARKDOWN_SNAPSHOT_ENABLED = 'true';
  process.env.CRM_OPENAPI_MARKDOWN_SNAPSHOT_DIR = resolve(backendRoot, 'analysis-snapshot');
}

class InMemoryAppStorageService {
  private readonly stateValue: AppStorageState;

  constructor(initialState: AppStorageState) {
    this.stateValue = initialState;
  }

  get state(): AppStorageState {
    return this.stateValue;
  }

  persist(): void {
    return;
  }
}

/**
 * 读取 300 问清单。
 *
 * 参数说明：`filePath` 为企微验收问题清单路径。
 * 返回值说明：返回结构化问题数组。
 */
function readQuestionList(filePath: string): AcceptanceQuestion[] {
  const content = readFileSync(filePath, 'utf8');
  return content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [questionCode, groupName, questionText] = line.split('｜');
      const questionNumber = Number(questionCode?.replace(/^Q/u, ''));
      if (!questionCode || !groupName || !questionText || !Number.isInteger(questionNumber)) {
        throw new Error(`题库格式不正确：${line}`);
      }

      return {
        questionNumber,
        questionCode,
        groupName,
        questionText,
      };
    });
}

/**
 * 从覆盖矩阵读取期望模板。
 *
 * 参数说明：`filePath` 为覆盖矩阵路径。
 * 返回值说明：返回题号到模板编码的映射。
 */
function readCoverageTemplateMap(filePath: string): Map<number, CrmAnalysisPresentationTemplateType> {
  const templateMap = new Map<number, CrmAnalysisPresentationTemplateType>();
  if (!existsSync(filePath)) {
    return templateMap;
  }

  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/u)) {
    const match = line.match(/^\|\s*Q(?<number>\d{3})\s*\|\s*`(?<template>[A-Z_]+)`/u);
    if (!match?.groups?.number || !match.groups.template) {
      continue;
    }

    templateMap.set(
      Number(match.groups.number),
      match.groups.template as CrmAnalysisPresentationTemplateType,
    );
  }

  return templateMap;
}

/**
 * 抽取 300 问中的 20%。
 *
 * 参数说明：`questions` 为完整 300 问。
 * 返回值说明：默认按题号每 5 题抽 1 题，共 60 题，覆盖全题库周期。
 */
function sampleTwentyPercentQuestions(questions: AcceptanceQuestion[]): AcceptanceQuestion[] {
  const customQuestions = String(process.env.ACCEPT_WECOM_CUSTOM_QUESTION ?? '')
    .split('||')
    .map((item) => item.trim())
    .filter(Boolean);
  if (customQuestions.length > 0) {
    return customQuestions.map((questionText, index) => ({
      questionNumber: index + 1,
      questionCode: `自定义${String(index + 1).padStart(2, '0')}`,
      groupName: '自定义企微专项验收',
      questionText,
    }));
  }

  const configuredCodes = String(process.env.ACCEPT_WECOM_SAMPLE_CODES ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (configuredCodes.length > 0) {
    const codeSet = new Set(configuredCodes);
    return questions.filter((question) => codeSet.has(question.questionCode));
  }

  return questions.filter((question) => (question.questionNumber - 1) % 5 === 0).slice(0, 60);
}

/**
 * 执行单题企微交付模拟。
 *
 * 参数说明：`service` 为分析服务，`wecomBotService` 为企微机器人服务，`user/question` 为验收上下文。
 * 返回值说明：返回模板卡片、Markdown、图片附件和结果详情。
 */
async function simulateWecomDelivery(params: {
  service: AcceptanceAnalysisService;
  wecomBotService: Record<string, (...args: unknown[]) => unknown>;
  user: CrmUser;
  question: AcceptanceQuestion;
}): Promise<WecomDeliverySimulation> {
  const response = await params.service.createQuery(params.user, {
    querySource: 'FREE_TEXT',
    channel: 'wecom-bot',
    questionText: params.question.questionText,
    executionMode: 'PLAN_EXECUTION',
  });
  const queryId = readText(response.queryId);
  const status = readText(response.status);
  if (!queryId || status !== 'RETURNED') {
    const blockedDetail = queryId
      ? params.service.getQueryDetail(params.user, queryId, 'wecom-bot')
      : {};
    const blockReason = readText(
      readRecord(blockedDetail).blockReason ??
        readRecord(blockedDetail).errorMessage ??
        readRecord(blockedDetail).message,
    );
    throw new Error(`查询未正常返回：status=${status || '空'}，queryId=${queryId || '空'}。${blockReason ? `原因：${blockReason}` : `详情：${JSON.stringify(blockedDetail).slice(0, 2400)}`}`);
  }

  const detail = params.service.getQueryDetail(params.user, queryId, 'wecom-bot');
  const imageAttachments = await params.wecomBotService.buildAnalysisImageAttachments(detail) as WecomDispatchImageAttachment[];
  const templateCards = params.wecomBotService.buildAnalysisTemplateCards(detail, {
    hasImageAttachments: imageAttachments.length > 0,
    queryId,
  }) as WecomDispatchTemplateCard[];
  const blocks = params.wecomBotService.resolveDispatchBlocks(
    { status: 'RETURNED' },
    detail,
    undefined,
    { preferImageAttachments: imageAttachments.length > 0 },
  ) as StreamBlock[];
  const markdown = blocks.map((block) => block.content).join('\n\n').trim();

  return {
    queryId,
    markdown,
    blocks,
    templateCards,
    imageAttachments,
    detail,
  };
}

/**
 * 检查单题企微交付结果。
 *
 * 参数说明：`question` 为验收问题，`simulation` 为企微交付模拟结果。
 * 返回值说明：返回严格检查结果。
 */
function inspectWecomSimulation(
  question: AcceptanceQuestion,
  simulation: WecomDeliverySimulation,
): WecomAcceptanceResult {
  const report = readRecord(simulation.detail.report);
  const presentationTemplate = readRecord(report.presentationTemplate);
  const actualTemplateType = readText(presentationTemplate.templateType);
  const actualTemplateName = readText(presentationTemplate.templateName);
  const metricCards = readArray(report.metricCards ?? simulation.detail.metricCards) as MetricCard[];
  const secondaryViews = readArray(simulation.detail.secondaryViews) as ResultView[];
  const rowCount = Number(simulation.detail.rowCount ?? 0);
  const failureReasons: string[] = [];
  const warnings: string[] = [];
  const primaryCard = readRecord(simulation.templateCards[0]?.templateCard);
  const mainTitle = readRecord(primaryCard.main_title);
  const quoteArea = readRecord(primaryCard.quote_area);
  const jumpList = readArray(primaryCard.jump_list).map(readRecord);
  const horizontalList = readArray(primaryCard.horizontal_content_list).map(readRecord);
  const replyText = [
    simulation.markdown,
    JSON.stringify(primaryCard),
    simulation.imageAttachments.map((item) => item.contentPreview).join('；'),
  ].join('\n');

  if (question.expectedTemplateType && actualTemplateType !== question.expectedTemplateType) {
    failureReasons.push(`模板不匹配：期望 ${question.expectedTemplateType}，实际 ${actualTemplateType || '未返回'}。`);
  }

  if (simulation.blocks.length === 0 || !simulation.markdown) {
    failureReasons.push('长连接 Markdown 正文为空。');
  }

  for (const token of requiredMarkdownTokens) {
    if (!simulation.markdown.includes(token)) {
      failureReasons.push(`Markdown 缺少企微固定段落：${token}。`);
    }
  }

  if (!simulation.markdown.includes(question.questionText.slice(0, 14))) {
    failureReasons.push('Markdown 未覆盖原始问题关键文本。');
  }

  if (!/当前用户可见|权限|数据范围/u.test(simulation.markdown)) {
    failureReasons.push('正文未说明当前用户可见范围或权限口径。');
  }

  if (!/备查|企微图片|图片图表|图表/u.test(simulation.markdown)) {
    failureReasons.push('正文未说明企微内图片图表或备查报告交付口径。');
  }

  if (simulation.templateCards.length === 0) {
    failureReasons.push('未生成企微模板卡片。');
  }

  if (primaryCard.card_type !== 'text_notice') {
    failureReasons.push(`模板卡片类型异常：${readText(primaryCard.card_type) || '未返回'}。`);
  }

  if (!readText(mainTitle.title)) {
    failureReasons.push('模板卡片缺少主标题。');
  }

  if (!readText(primaryCard.emphasis_content)) {
    const emphasis = readRecord(primaryCard.emphasis_content);
    if (!readText(emphasis.title) || !readText(emphasis.desc)) {
      failureReasons.push('模板卡片缺少主指标强调区。');
    }
  }

  if (!readText(quoteArea.quote_text)) {
    failureReasons.push('模板卡片缺少关键对比 quote_area。');
  }

  if (horizontalList.length === 0) {
    failureReasons.push('模板卡片缺少横向指标列表。');
  }

  if (!jumpList.some((item) => readText(item.title).includes('备查报告'))) {
    failureReasons.push('模板卡片跳转入口未标注为备查报告。');
  }

  if (simulation.imageAttachments.length === 0) {
    failureReasons.push('未生成企微图片图表附件。');
  }

  for (const image of simulation.imageAttachments) {
    if (image.buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
      failureReasons.push(`图片附件不是有效 PNG：${image.filename}。`);
    }
  }

  if (metricCards.length < 3) {
    failureReasons.push(`核心指标不足 3 个，当前 ${metricCards.length} 个。`);
  }

  if (secondaryViews.length === 0) {
    failureReasons.push('缺少二级视图，无法支撑表格或图表展示。');
  }

  if (!Number.isFinite(rowCount) || rowCount <= 0) {
    failureReasons.push('结果行数为空，无法支撑数据明细。');
  }

  if (!/建议|动作|风险|提醒|治理|下一步/u.test(simulation.markdown)) {
    failureReasons.push('回复缺少建议、风险或下一步动作。');
  }

  if (isStrictComparisonQuestion(question.questionText)) {
    const resultRows = collectComparisonRows(simulation.detail);
    const resultRowText = JSON.stringify(resultRows);
    const strictComparisonText = [replyText, resultRowText].join('\n');
    const acceptedTemplates = resolveAcceptedStrictComparisonTemplates(question.questionText);
    if (!acceptedTemplates.includes(actualTemplateType)) {
      failureReasons.push(
        `严格对比问题模板不匹配：期望 ${acceptedTemplates.join('/')}，实际 ${actualTemplateType || '未返回'}。`,
      );
    }
    if (!/(贡献占比|占比|contributionShare|opportunityShare|orderShare|\d+(?:\.\d+)?%)/u.test(strictComparisonText)) {
      failureReasons.push('严格对比问题缺少贡献占比。');
    }
    if (!hasComparisonRowField(resultRows, ['riskReason', 'risk_reason', '风险原因']) && !/风险原因/u.test(strictComparisonText)) {
      failureReasons.push('严格对比问题缺少行级风险原因。');
    }
    if (!hasComparisonRowField(resultRows, ['actionSuggestion', 'actionAdvice', 'nextAction', '动作建议', '下一步动作']) && !/动作建议|下一步动作/u.test(strictComparisonText)) {
      failureReasons.push('严格对比问题缺少行级动作建议。');
    }
    if (!/(季度对比|区域大区季度商机对比|区域经营对比|大区经营对比|渠道商经营贡献|销售负责人经营对比|订单承接对比)/u.test(replyText)) {
      failureReasons.push('严格对比问题缺少对应对比图表或视图标题。');
    }
  }

  for (const leakPattern of internalLeakPatterns) {
    if (leakPattern.pattern.test(replyText)) {
      failureReasons.push(`泄露内部实现表达：${leakPattern.label}。`);
    }
  }

  if (!/金额|数量|占比|转化|排行|覆盖|阶段|趋势/u.test(replyText)) {
    warnings.push('本题回复中的对比维度偏弱，建议人工复核业务表达是否足够。');
  }

  return {
    question,
    status: failureReasons.length > 0 ? '失败' : '通过',
    queryId: simulation.queryId,
    actualTemplateType,
    actualTemplateName,
    blockCount: simulation.blocks.length,
    cardCount: simulation.templateCards.length,
    imageCount: simulation.imageAttachments.length,
    metricCount: metricCards.length,
    secondaryViewCount: secondaryViews.length,
    rowCount,
    markdownLength: simulation.markdown.length,
    cardTitle: readText(mainTitle.title),
    cardQuote: readText(quoteArea.quote_text),
    imagePreview: simulation.imageAttachments.map((item) => item.contentPreview).join('；'),
    failureReasons,
    warnings,
    replyPreview: simulation.markdown.replace(/\s+/gu, ' ').slice(0, 320),
  };
}

/**
 * 执行单题验收。
 *
 * 参数说明：`params` 为服务、用户和问题。
 * 返回值说明：返回单题验收结果。
 */
async function runQuestionAcceptance(params: {
  service: AcceptanceAnalysisService;
  wecomBotService: Record<string, (...args: unknown[]) => unknown>;
  user: CrmUser;
  question: AcceptanceQuestion;
}): Promise<WecomAcceptanceResult> {
  try {
    const simulation = await simulateWecomDelivery(params);
    return inspectWecomSimulation(params.question, simulation);
  } catch (error) {
    return {
      question: params.question,
      status: '失败',
      blockCount: 0,
      cardCount: 0,
      imageCount: 0,
      metricCount: 0,
      secondaryViewCount: 0,
      rowCount: 0,
      markdownLength: 0,
      failureReasons: [error instanceof Error ? error.message : String(error)],
      warnings: [],
      replyPreview: '',
    };
  }
}

/**
 * 生成 60 问企微链路交付报告。
 *
 * 参数说明：`results` 为验收结果，`durationMs` 为耗时。
 * 返回值说明：返回 Markdown 报告正文。
 */
function buildDeliveryReport(results: WecomAcceptanceResult[], durationMs: number): string {
  const passed = results.filter((item) => item.status === '通过').length;
  const failed = results.length - passed;
  const passRate = results.length > 0 ? `${((passed / results.length) * 100).toFixed(2)}%` : '0.00%';
  const totalImages = results.reduce((sum, item) => sum + item.imageCount, 0);
  const totalCards = results.reduce((sum, item) => sum + item.cardCount, 0);
  const templateStats = new Map<string, { total: number; passed: number; images: number }>();

  for (const result of results) {
    const template = result.question.expectedTemplateType ?? '未识别模板';
    const stat = templateStats.get(template) ?? { total: 0, passed: 0, images: 0 };
    stat.total += 1;
    stat.images += result.imageCount;
    if (result.status === '通过') {
      stat.passed += 1;
    }
    templateStats.set(template, stat);
  }

  return [
    '# CRM 智能分析 300 问 20% 企微机器人链路抽检交付报告',
    '',
    `生成时间：${new Date().toISOString()}`,
    `抽检范围：300 问按题号每 5 题抽 1 题，共 ${results.length} 题，覆盖 20%。`,
    '验收方式：本地模拟企微机器人对话交付链路，使用 `AnalysisService.createQuery(..., channel=wecom-bot)` 生成结果，再调用企微卡片、Markdown、图片附件构造方法检查最终可见载体；不真实发送企业微信群，避免污染真实会话。',
    '安全环境：禁用真实 AI 与真实企微 SDK 投递，启用本地 CRM 校验数据目录和企微 mock 传输。',
    `耗时：${(durationMs / 1000).toFixed(1)} 秒`,
    '',
    '## 一、总体结论',
    '',
    `- 抽检题数：${results.length}`,
    `- 严格通过：${passed}`,
    `- 严格失败：${failed}`,
    `- 严格通过率：${passRate}`,
    `- 模板卡片数：${totalCards}`,
    `- 图片图表附件数：${totalImages}`,
    '- 主交付口径：企微内卡片、长连接正文、图片图表为主；只读报告链接仅作为备查入口。',
    '',
    '## 二、验收项覆盖',
    '',
    '| 验收项 | 检查口径 | 结果 |',
    '| --- | --- | --- |',
    `| 企微对话主链 | createQuery + getQueryDetail + 模板卡片 + Markdown + 图片附件 | ${failed === 0 ? '通过' : '存在失败'} |`,
    `| 卡片格式 | text_notice、主标题、主指标、quote_area、横向指标、备查入口 | ${results.every((item) => item.cardCount > 0) ? '通过' : '存在缺失'} |`,
    `| 分析正文 | AI 分析报告、关键指标、企微展示、建议追问、权限口径 | ${results.every((item) => item.markdownLength > 0) ? '通过' : '存在缺失'} |`,
    `| 图片图表 | 每题至少 1 张 PNG 图片附件 | ${results.every((item) => item.imageCount > 0) ? '通过' : '存在缺失'} |`,
    `| 数据支撑 | 指标、二级视图、明细行均非空 | ${results.every((item) => item.metricCount >= 3 && item.secondaryViewCount > 0 && item.rowCount > 0) ? '通过' : '存在缺失'} |`,
    `| 表达治理 | 无内部枚举、无 fallback/schema 等实现词泄露 | ${results.every((item) => !item.failureReasons.some((reason) => reason.includes('泄露内部实现表达'))) ? '通过' : '存在泄露'} |`,
    '',
    '## 三、模板抽检通过率',
    '',
    '| 模板 | 通过 | 总数 | 通过率 | 图片数 |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...[...templateStats.entries()].map(([template, stat]) => {
      const templatePassRate = stat.total > 0 ? `${((stat.passed / stat.total) * 100).toFixed(2)}%` : '0.00%';
      return `| ${template} | ${stat.passed} | ${stat.total} | ${templatePassRate} | ${stat.images} |`;
    }),
    '',
    '## 四、失败与警告',
    '',
    ...buildFailureAndWarningLines(results),
    '',
    '## 五、60 问抽检明细',
    '',
    '| 题号 | 分组 | 期望模板 | 实际模板 | 结果 | 卡片 | 图片 | 指标 | 视图 | 行数 | 卡片关键对比 |',
    '| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |',
    ...results.map((result) => [
      `| ${result.question.questionCode}`,
      escapeMarkdownTableCell(result.question.groupName),
      result.question.expectedTemplateType ?? '未识别',
      result.actualTemplateType ?? '未返回',
      result.status,
      String(result.cardCount),
      String(result.imageCount),
      String(result.metricCount),
      String(result.secondaryViewCount),
      String(result.rowCount),
      `${escapeMarkdownTableCell((result.cardQuote || result.replyPreview).slice(0, 60))} |`,
    ].join(' | ')),
    '',
    '## 六、样例回复摘录',
    '',
    ...results.slice(0, 8).flatMap((result) => [
      `### ${result.question.questionCode} ${result.status}`,
      '',
      `问题：${result.question.questionText}`,
      `卡片标题：${result.cardTitle ?? '未返回'}`,
      `关键对比：${result.cardQuote ?? '未返回'}`,
      `图片：${result.imagePreview ?? '未返回'}`,
      `正文预览：${result.replyPreview}`,
      '',
    ]),
    '## 七、交付结论',
    '',
    failed === 0
      ? '本次 60 问抽检全部通过。当前主链路满足企微机器人对话交付要求：卡片可见、正文完整、图表以图片附件进入企微、数据与权限口径可核对，HTML/只读报告仅作为备查入口。'
      : '本次抽检存在失败项，需先修复失败明细后再进入真实企业微信截图验收。',
    '',
  ].join('\n');
}

/**
 * 构造失败和警告段落。
 *
 * 参数说明：`results` 为验收结果。
 * 返回值说明：返回 Markdown 行数组。
 */
function buildFailureAndWarningLines(results: WecomAcceptanceResult[]): string[] {
  const failedResults = results.filter((item) => item.status === '失败');
  const warningResults = results.filter((item) => item.warnings.length > 0);
  const lines: string[] = [];

  if (failedResults.length === 0) {
    lines.push('- 失败项：无。');
  } else {
    for (const result of failedResults) {
      lines.push(`### ${result.question.questionCode} 失败`);
      lines.push('');
      lines.push(`问题：${result.question.questionText}`);
      for (const reason of result.failureReasons) {
        lines.push(`- ${reason}`);
      }
      lines.push('');
    }
  }

  if (warningResults.length === 0) {
    lines.push('- 警告项：无。');
  } else {
    lines.push('### 警告项');
    lines.push('');
    for (const result of warningResults) {
      lines.push(`- ${result.question.questionCode}：${result.warnings.join('；')}`);
    }
  }

  return lines;
}

/**
 * 转义 Markdown 表格单元格。
 */
function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\|/gu, '\\|').replace(/\n/gu, ' ');
}

/**
 * 安全读取对象。
 */
function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * 安全读取数组。
 */
function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * 安全读取文本。
 */
function readText(value: unknown): string {
  return String(value ?? '').trim();
}

/**
 * 判断问题是否属于严格对比分析验收范围。
 *
 * 参数说明：`questionText` 为用户原始问题。
 * 返回值说明：包含对比、区域、大区、季度、销售或订单承接要求时返回 true。
 * 调用注意事项：该判断只用于验收脚本，不影响业务运行链路。
 */
function isStrictComparisonQuestion(questionText: string): boolean {
  return /(对比|比较|差异|相比|一季度|二季度|三季度|四季度|Q[1-4]|季度|区域|大区|大北|大东|大南|大西|销售负责人|订单承接|贡献占比|风险原因|动作建议)/iu.test(
    questionText,
  );
}

/**
 * 解析严格对比问题允许的展示模板。
 *
 * 参数说明：`questionText` 为用户原始问题。
 * 返回值说明：按区域、渠道、销售和订单语义返回允许模板集合。
 */
function resolveAcceptedStrictComparisonTemplates(questionText: string): string[] {
  if (/(销售|销售负责人|负责人|人员|团队|个人)/u.test(questionText)) {
    return ['OWNER_ORG_COLLABORATION', 'REGION_COMPARISON'];
  }
  if (/(渠道|渠道商|服务商|代理商|经销商|伙伴)/u.test(questionText)) {
    return ['CHANNEL_RANKING', 'REGION_COMPARISON'];
  }
  if (/(订单承接|订单|下单|成单|签单|成交)/u.test(questionText)) {
    return ['QUOTE_ORDER_CONVERSION', 'REGION_COMPARISON', 'BUSINESS_OVERVIEW'];
  }

  return ['REGION_COMPARISON'];
}

/**
 * 收集企微结果中的对比行。
 *
 * 参数说明：`detail` 为分析详情。
 * 返回值说明：返回主表和二级视图中所有对象行。
 * 调用注意事项：只读结果结构，不解析图片二进制。
 */
function collectComparisonRows(detail: Record<string, unknown>): Array<Record<string, unknown>> {
  const rows: Array<Record<string, unknown>> = [];
  for (const row of readArray(detail.tableRows)) {
    const record = readRecord(row);
    if (Object.keys(record).length > 0) {
      rows.push(record);
    }
  }

  for (const view of readArray(detail.secondaryViews)) {
    for (const row of readArray(readRecord(view).rows)) {
      const record = readRecord(row);
      if (Object.keys(record).length > 0) {
        rows.push(record);
      }
    }
  }

  return rows;
}

/**
 * 判断结果行中是否存在指定字段。
 *
 * 参数说明：`rows` 为结果行，`keys` 为候选字段名。
 * 返回值说明：任意行存在非空候选字段时返回 true。
 */
function hasComparisonRowField(rows: Array<Record<string, unknown>>, keys: string[]): boolean {
  return rows.some((row) => keys.some((key) => readText(row[key])));
}

/**
 * 主入口。
 */
async function main(): Promise<void> {
  prepareSafeEnvironment();
  await import('reflect-metadata');
  const { Test } = await import('@nestjs/testing');
  const { AppModule } = await import('../src/app.module');
  const { AppStorageService } = await import('../src/database/app-storage/app-storage.service');
  const { AnalysisService } = await import('../src/modules/analysis/analysis.service');
  const { WecomBotService } = await import('../src/modules/wecom/wecom-bot.service');
  const { CRM_USERS, createDefaultAppStorageState } = await import('../src/shared/mock/sample-data');

  const coverageTemplateMap = readCoverageTemplateMap(coverageMatrixPath);
  const allQuestions = readQuestionList(questionListPath).map((question) => ({
    ...question,
    expectedTemplateType: coverageTemplateMap.get(question.questionNumber),
  }));
  if (allQuestions.length !== 300) {
    throw new Error(`题库数量不是 300，当前为 ${allQuestions.length}。`);
  }

  const questions = sampleTwentyPercentQuestions(allQuestions);
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(AppStorageService)
    .useValue(new InMemoryAppStorageService(createDefaultAppStorageState()))
    .compile();
  const app = moduleRef.createNestApplication();
  await app.init();

  const startedAt = Date.now();
  try {
    const service = app.get<AcceptanceAnalysisService>(AnalysisService);
    const wecomBotService = app.get(WecomBotService) as unknown as Record<string, (...args: unknown[]) => unknown>;
    const userId = process.env.ACCEPT_CRM_ANALYSIS_USER_ID ?? 'user_sales_director';
    const user = (CRM_USERS as CrmUser[]).find((item) => item.id === userId);
    if (!user) {
      throw new Error(`找不到验收用户：${userId}`);
    }

    const results: WecomAcceptanceResult[] = [];
    for (const question of questions) {
      const result = await runQuestionAcceptance({ service, wecomBotService, user, question });
      results.push(result);
      const reason = result.failureReasons[0] ? `：${result.failureReasons[0]}` : '';
      console.log(`${question.questionCode} ${result.status} 卡片${result.cardCount} 图片${result.imageCount}${reason}`);
    }

    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, buildDeliveryReport(results, Date.now() - startedAt), 'utf8');

    const passed = results.filter((item) => item.status === '通过').length;
    const failed = results.length - passed;
    console.log(`企微链路 20% 抽检完成：通过 ${passed}/${results.length}，失败 ${failed}/${results.length}`);
    console.log(`报告路径：${reportPath}`);
    if (failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

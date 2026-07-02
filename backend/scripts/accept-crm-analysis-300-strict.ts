import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import type {
  AppStorageState,
  ChannelType,
  CrmAnalysisPresentationTemplateType,
  CrmUser,
} from '../src/shared/types/domain';

interface AcceptanceQuestion {
  questionNumber: number;
  questionCode: string;
  groupName: string;
  questionText: string;
  expectedTemplateType?: CrmAnalysisPresentationTemplateType;
}

interface QuestionAcceptanceResult {
  question: AcceptanceQuestion;
  status: '通过' | '失败';
  queryId?: string;
  actualTemplateType?: string;
  actualTemplateName?: string;
  rowCount?: number;
  metricCount?: number;
  secondaryViewCount?: number;
  markdownLength?: number;
  failureReasons: string[];
  warnings: string[];
  markdownPreview: string;
}

interface TemplateCheckRule {
  keywords: string[];
  viewKeywords: string[];
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
  'docs/testing/CRM智能分析300问300道严格验收报告_20260630.md',
);

const requiredMarkdownSections = [
  '【展示模板】',
  '【回复结构】',
  '【建议追问】',
  '【问题复述】',
  '【数据口径】',
  '【权限口径】',
  '【维度判断】',
  '【核心指标】',
  '【明细摘要】',
  '【缺口说明】',
  '【风险建议】',
];

const internalLeakPatterns: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bBAR_CHART\b/u, label: '图表内部枚举 BAR_CHART' },
  { pattern: /\bLINE_CHART\b/u, label: '图表内部枚举 LINE_CHART' },
  { pattern: /\bPIE_CHART\b/u, label: '图表内部枚举 PIE_CHART' },
  { pattern: /\bDETAIL_TABLE\b/u, label: '表格内部枚举 DETAIL_TABLE' },
  { pattern: /\bRANKING_TABLE\b/u, label: '表格内部枚举 RANKING_TABLE' },
  { pattern: /\bPLAN_EXECUTION\b/u, label: '执行模式内部枚举 PLAN_EXECUTION' },
  { pattern: /\bOPENAPI_MARKDOWN_SNAPSHOT\b/u, label: '执行源内部枚举 OPENAPI_MARKDOWN_SNAPSHOT' },
  { pattern: /\bCRM_OFFICIAL_API\b/u, label: '执行源内部枚举 CRM_OFFICIAL_API' },
  { pattern: /\bQUERY_BLOCKED\b/u, label: '阻断状态内部枚举 QUERY_BLOCKED' },
  { pattern: /\bfallback\b/iu, label: '内部降级词 fallback' },
  { pattern: /\bschema\b/iu, label: '内部结构词 schema' },
];

const templateCheckRules: Record<CrmAnalysisPresentationTemplateType, TemplateCheckRule> = {
  BUSINESS_OVERVIEW: {
    keywords: ['报备', '商机', '报价', '订单'],
    viewKeywords: ['经营区块', '渠道商经营贡献汇总', '区域经营对比'],
  },
  FUNNEL_DIAGNOSIS: {
    keywords: ['报备到商机', '商机到报价', '报价到订单', '流失'],
    viewKeywords: ['经营区块', '商机阶段分布', '报价明细', '订单明细'],
  },
  REGION_COMPARISON: {
    keywords: ['区域', '大区', '报备', '商机', '报价', '订单'],
    viewKeywords: ['区域经营对比'],
  },
  CHANNEL_RANKING: {
    keywords: ['渠道商', '报备', '商机', '报价', '订单'],
    viewKeywords: ['渠道商经营贡献汇总', '合作伙伴明细'],
  },
  CHANNEL_PROFILE: {
    keywords: ['活跃', '高潜力', '沉睡', '低贡献'],
    viewKeywords: ['渠道商经营贡献汇总', '合作伙伴明细'],
  },
  DISTRIBUTION_HIERARCHY: {
    keywords: ['一级渠道', '二级渠道', '无层级', '父级', '订单归属'],
    viewKeywords: ['分销层级健康汇总'],
  },
  TECH_SERVICE_ECOSYSTEM: {
    keywords: ['签约技术服务商', '提名技术服务商', '普通渠道', '转化效率'],
    viewKeywords: ['技术服务商生态对比'],
  },
  REGISTRATION_PROTECTION: {
    keywords: ['报备', '审批', '保护期', '重复报备', '到期'],
    viewKeywords: ['客户报备明细'],
  },
  OPPORTUNITY_RISK: {
    keywords: ['高金额', '预计签约', '未报价', '停滞', '负责人'],
    viewKeywords: ['商机明细', '商机阶段分布'],
  },
  QUOTE_ORDER_CONVERSION: {
    keywords: ['报价', '订单', '报价金额', '订单金额', '价格'],
    viewKeywords: ['报价明细', '订单明细'],
  },
  PRODUCT_SOLUTION_STRUCTURE: {
    keywords: ['产品', '模块', '套餐', '硬件', '价格', '工作量'],
    viewKeywords: ['报价明细', '订单明细'],
  },
  CUSTOMER_SUCCESS_RENEWAL: {
    keywords: ['客户', '生命周期', '复购', '扩容', '报价', '订单'],
    viewKeywords: ['客户报备明细', '商机明细', '报价明细', '订单明细'],
  },
  OWNER_ORG_COLLABORATION: {
    keywords: ['角色', '负责人', '创建人', '指派人', '团队'],
    viewKeywords: ['商机明细', '报价明细', '订单明细'],
  },
  ALERT_AUDIT_GOVERNANCE: {
    keywords: ['预警', '通知', '审计', '治理', '人工复核'],
    viewKeywords: ['经营区块', '客户报备明细', '商机明细'],
  },
  DATA_SCOPE_QUALITY: {
    keywords: ['权限', '字段', '关联', '当前用户可见'],
    viewKeywords: ['经营区块', '渠道商经营贡献汇总'],
  },
  OPERATING_CADENCE: {
    keywords: ['日报', '周报', '月报', '季度', '待办'],
    viewKeywords: ['经营区块', '渠道商经营贡献汇总'],
  },
};

/**
 * 设置验收脚本的安全运行环境。
 *
 * 参数说明：无。
 * 返回值说明：无。
 * 调用注意事项：必须在动态导入 Nest 模块前执行，避免真实 AI、数据库持久化或企微长连接介入验收。
 */
function prepareSafeEnvironment(): void {
  process.env.NODE_ENV = 'development';
  process.env.OPENAI_API_KEY = '';
  process.env.ANALYSIS_AI_BASE_URL = '';
  process.env.ANALYSIS_AI_MODEL = '';
  process.env.ANALYSIS_QUERY_KNOWLEDGE_ENABLED = 'false';
  process.env.WECOM_ENABLE_SDK_TRANSPORT = 'false';
  process.env.WECOM_BOT_TRANSPORT_MODE = 'mock';
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
 * 读取命令行或环境变量中的数字参数。
 *
 * 参数说明：`name` 为环境变量名，`argName` 为命令行参数名，`fallback` 为默认值。
 * 返回值说明：返回正整数；未声明或非法时返回默认值。
 */
function readPositiveIntegerOption(name: string, argName: string, fallback: number): number {
  const cliPrefix = `--${argName}=`;
  const cliValue = process.argv.find((item) => item.startsWith(cliPrefix))?.slice(cliPrefix.length);
  const rawValue = cliValue ?? process.env[name];
  const parsed = Number(rawValue);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * 读取问题清单。
 *
 * 参数说明：`filePath` 为 300 问文本文件路径。
 * 返回值说明：返回结构化题号、分组和问题文本。
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
 * 从覆盖矩阵读取每题期望模板。
 *
 * 参数说明：`filePath` 为覆盖矩阵 Markdown 路径。
 * 返回值说明：返回题号到模板类型的映射；文件不存在时返回空映射。
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
 * 校验单题企微结果。
 *
 * 参数说明：
 * - `question`：当前验收问题；
 * - `detail`：`AnalysisService.getQueryDetail(..., 'wecom-bot')` 返回值。
 * 返回值说明：返回严格验收结果，包含失败原因、警告和 Markdown 摘要。
 */
function inspectQuestionResult(
  question: AcceptanceQuestion,
  detail: Record<string, unknown>,
): Omit<QuestionAcceptanceResult, 'question' | 'queryId'> {
  const report = readRecord(detail.report);
  const markdown = readFirstText(
    detail.wecomMarkdown,
    report.wecomMarkdown,
    report.groundedMarkdown,
    detail.groundedMarkdown,
  );
  const presentationTemplate = readRecord(report.presentationTemplate);
  const actualTemplateType = readText(presentationTemplate.templateType);
  const actualTemplateName = readText(presentationTemplate.templateName);
  const metricCards = readArray(detail.metricCards);
  const secondaryViews = readArray(detail.secondaryViews);
  const rowCount = Number(detail.rowCount ?? 0);
  const hasAcceptableEmptyState = rowCount <= 0 && hasClearEmptyStateExplanation(markdown);
  const failureReasons: string[] = [];
  const warnings: string[] = [];
  const expectedTemplateType = question.expectedTemplateType;

  if (!markdown) {
    failureReasons.push('企微 Markdown 为空。');
  }

  if (expectedTemplateType && actualTemplateType !== expectedTemplateType) {
    failureReasons.push(`模板不匹配：期望 ${expectedTemplateType}，实际 ${actualTemplateType || '未识别'}。`);
  }

  for (const section of requiredMarkdownSections) {
    if (!markdown.includes(section)) {
      failureReasons.push(`缺少固定回复段落：${section}。`);
    }
  }

  if (!markdown.includes(question.questionText.slice(0, 18))) {
    failureReasons.push('问题复述未覆盖原始问题关键文本。');
  }

  if (!/当前用户可见|权限|可见范围/u.test(markdown)) {
    failureReasons.push('未说明当前用户可见范围或权限口径。');
  }

  if (!/缺口|字段|样本|补齐|不足|当前快照/u.test(markdown)) {
    failureReasons.push('未说明字段缺口、样本不足或当前快照边界。');
  }

  for (const leakPattern of internalLeakPatterns) {
    if (leakPattern.pattern.test(markdown)) {
      failureReasons.push(`泄露内部实现表达：${leakPattern.label}。`);
    }
  }

  const templateRule = expectedTemplateType ? templateCheckRules[expectedTemplateType] : undefined;
  if (templateRule) {
    const missingKeywords = templateRule.keywords.filter((keyword) => !markdown.includes(keyword));
    if (missingKeywords.length > 0) {
      failureReasons.push(`模板核心维度缺失：${missingKeywords.join('、')}。`);
    }

    const secondaryViewText = secondaryViews
      .map((item) => readText(readRecord(item).title))
      .filter(Boolean)
      .join('；');
    const hasViewHit = templateRule.viewKeywords.some((keyword) =>
      markdown.includes(keyword) || secondaryViewText.includes(keyword),
    );
    if (!hasViewHit && !hasAcceptableEmptyState) {
      failureReasons.push(`展示区块未体现模板核心视图：${templateRule.viewKeywords.join('、')}。`);
    } else if (!hasViewHit) {
      warnings.push(`当前题无命中明细，已按空态口径替代核心视图：${templateRule.viewKeywords.join('、')}。`);
    }
  }

  if (metricCards.length === 0) {
    failureReasons.push('核心指标为空，无法支撑经营判断。');
  } else if (metricCards.length < 3) {
    warnings.push(`核心指标少于 3 个，当前 ${metricCards.length} 个。`);
  }

  if (secondaryViews.length === 0 && !hasAcceptableEmptyState) {
    failureReasons.push('缺少二级视图，无法核对展示呈现方式。');
  } else if (secondaryViews.length === 0) {
    warnings.push('当前题无命中明细，企微回复已用空态口径说明展示边界。');
  }

  if ((!Number.isFinite(rowCount) || rowCount <= 0) && !hasAcceptableEmptyState) {
    failureReasons.push('结果行数为空，严格验收无法确认明细支撑。');
  } else if (rowCount <= 0) {
    warnings.push('结果行数为空，但回复已说明缺口、样本不足或当前快照边界。');
  }

  if (/订单/.test(question.questionText) && /订单数 0|订单 0 条/u.test(markdown) && !/样本不足|订单样本|缺口|无订单/u.test(markdown)) {
    failureReasons.push('订单样本不足时未说明结论边界。');
  }

  return {
    status: failureReasons.length > 0 ? '失败' : '通过',
    actualTemplateType,
    actualTemplateName,
    rowCount,
    metricCount: metricCards.length,
    secondaryViewCount: secondaryViews.length,
    markdownLength: markdown.length,
    failureReasons,
    warnings,
    markdownPreview: markdown.replace(/\s+/gu, ' ').slice(0, 260),
  };
}

/**
 * 执行单题查询并返回验收结果。
 *
 * 参数说明：`service` 为分析服务，`user` 为验收用户，`question` 为当前题。
 * 返回值说明：返回严格验收结果；服务异常会转换成失败项继续跑后续题。
 */
async function runQuestionAcceptance(params: {
  service: AcceptanceAnalysisService;
  user: CrmUser;
  question: AcceptanceQuestion;
}): Promise<QuestionAcceptanceResult> {
  try {
    const response = await params.service.createQuery(params.user, {
      querySource: 'FREE_TEXT',
      channel: 'wecom-bot',
      questionText: params.question.questionText,
      executionMode: 'PLAN_EXECUTION',
    });
    const queryId = readText(response.queryId);
    const status = readText(response.status);
    if (!queryId || status !== 'RETURNED') {
      return {
        question: params.question,
        queryId,
        status: '失败',
        failureReasons: [`查询未正常返回：status=${status || '空'}。`],
        warnings: [],
        markdownPreview: JSON.stringify(response).slice(0, 260),
      };
    }

    const detail = params.service.getQueryDetail(params.user, queryId, 'wecom-bot');
    return {
      question: params.question,
      queryId,
      ...inspectQuestionResult(params.question, detail),
    };
  } catch (error) {
    return {
      question: params.question,
      status: '失败',
      failureReasons: [error instanceof Error ? error.message : String(error)],
      warnings: [],
      markdownPreview: '',
    };
  }
}

/**
 * 生成 Markdown 验收报告。
 *
 * 参数说明：`results` 为每题验收结果，`durationMs` 为脚本耗时。
 * 返回值说明：返回可直接写入文档的中文报告。
 */
function buildAcceptanceReport(results: QuestionAcceptanceResult[], durationMs: number): string {
  const passed = results.filter((item) => item.status === '通过').length;
  const failed = results.length - passed;
  const strictPassRate = results.length > 0 ? `${((passed / results.length) * 100).toFixed(2)}%` : '0.00%';
  const templateStats = new Map<string, { total: number; passed: number }>();
  for (const result of results) {
    const templateType = result.question.expectedTemplateType ?? '未识别模板';
    const current = templateStats.get(templateType) ?? { total: 0, passed: 0 };
    current.total += 1;
    if (result.status === '通过') {
      current.passed += 1;
    }
    templateStats.set(templateType, current);
  }

  return [
    '# CRM 智能分析 300 问严格验收报告',
    '',
    `生成时间：${new Date().toISOString()}`,
    `验收范围：${results[0]?.question.questionCode ?? '无'} - ${results.at(-1)?.question.questionCode ?? '无'}`,
    `验收方式：服务层 \`AnalysisService.createQuery + getQueryDetail(..., 'wecom-bot')\` 严格检查。`,
    `安全环境：\`NODE_ENV=development\`，禁用真实 AI、真实企微长连接和语义知识扩展，应用状态使用内存存储。`,
    `耗时：${(durationMs / 1000).toFixed(1)} 秒`,
    '',
    '## 汇总结论',
    '',
    `- 严格通过：${passed} / ${results.length}`,
    `- 严格失败：${failed} / ${results.length}`,
    `- 严格通过率：${strictPassRate}`,
    '',
    '## 模板通过率',
    '',
    '| 模板 | 通过 | 总数 | 通过率 |',
    '| --- | ---: | ---: | ---: |',
    ...[...templateStats.entries()].map(([templateType, stat]) => {
      const passRate = stat.total > 0 ? `${((stat.passed / stat.total) * 100).toFixed(2)}%` : '0.00%';
      return `| ${templateType} | ${stat.passed} | ${stat.total} | ${passRate} |`;
    }),
    '',
    '## 失败明细',
    '',
    ...buildFailureReportLines(results),
    '',
    '## 全量验收明细',
    '',
    '| 题号 | 分组 | 期望模板 | 实际模板 | 结果 | 指标数 | 视图数 | 行数 | 问题摘要 |',
    '| --- | --- | --- | --- | --- | ---: | ---: | ---: | --- |',
    ...results.map((result) =>
      [
        `| ${result.question.questionCode}`,
        escapeMarkdownTableCell(result.question.groupName),
        result.question.expectedTemplateType ?? '未识别',
        result.actualTemplateType ?? '未返回',
        result.status,
        String(result.metricCount ?? 0),
        String(result.secondaryViewCount ?? 0),
        String(result.rowCount ?? 0),
        `${escapeMarkdownTableCell(result.question.questionText.slice(0, 48))} |`,
      ].join(' | '),
    ),
    '',
  ].join('\n');
}

/**
 * 构造失败报告段落。
 *
 * 参数说明：`results` 为验收结果。
 * 返回值说明：失败时返回逐题原因；全部通过时返回通过说明。
 */
function buildFailureReportLines(results: QuestionAcceptanceResult[]): string[] {
  const failedResults = results.filter((item) => item.status === '失败');
  if (failedResults.length === 0) {
    return ['全部题目通过严格验收。'];
  }

  return failedResults.flatMap((result) => [
    `### ${result.question.questionCode} ${result.question.groupName}`,
    '',
    `问题：${result.question.questionText}`,
    `期望模板：${result.question.expectedTemplateType ?? '未识别'}；实际模板：${result.actualTemplateType ?? '未返回'}`,
    ...result.failureReasons.map((reason) => `- ${reason}`),
    result.markdownPreview ? `预览：${result.markdownPreview}` : '',
    '',
  ]);
}

/**
 * 转义 Markdown 表格单元格。
 *
 * 参数说明：`value` 为待写入表格的文本。
 * 返回值说明：返回不会破坏表格竖线的文本。
 */
function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\|/gu, '\\|').replace(/\n/gu, ' ');
}

/**
 * 安全读取对象。
 *
 * 参数说明：`value` 为任意值。
 * 返回值说明：对象输入返回对象，否则返回空对象。
 */
function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * 安全读取数组。
 *
 * 参数说明：`value` 为任意值。
 * 返回值说明：数组输入返回数组，否则返回空数组。
 */
function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * 安全读取文本。
 *
 * 参数说明：`value` 为任意值。
 * 返回值说明：返回去空格文本。
 */
function readText(value: unknown): string {
  return String(value ?? '').trim();
}

/**
 * 返回第一个非空文本。
 *
 * 参数说明：`values` 为候选值。
 * 返回值说明：返回第一个非空字符串。
 */
function readFirstText(...values: unknown[]): string {
  for (const value of values) {
    const text = readText(value);
    if (text) {
      return text;
    }
  }

  return '';
}

/**
 * 判断空结果是否已有清晰业务解释。
 *
 * 参数说明：`markdown` 为企微回复全文。
 * 返回值说明：包含未命中、样本不足、缺字段或替代口径说明时返回 `true`。
 */
function hasClearEmptyStateExplanation(markdown: string): boolean {
  return /未形成可展示指标|未命中|没有命中|暂无|空结果|样本不足|缺口|字段缺失|补齐|当前快照|放宽筛选/u.test(
    markdown,
  );
}

/**
 * 主入口。
 *
 * 参数说明：无。
 * 返回值说明：无；严格验收失败时以非零退出码结束。
 */
async function main(): Promise<void> {
  prepareSafeEnvironment();
  await import('reflect-metadata');
  const { Test } = await import('@nestjs/testing');
  const { AppModule } = await import('../src/app.module');
  const { AppStorageService } = await import('../src/database/app-storage/app-storage.service');
  const { AnalysisService } = await import('../src/modules/analysis/analysis.service');
  const { CRM_USERS, createDefaultAppStorageState } = await import('../src/shared/mock/sample-data');

  const coverageTemplateMap = readCoverageTemplateMap(coverageMatrixPath);
  const startNumber = readPositiveIntegerOption('ACCEPT_CRM_ANALYSIS_START', 'start', 1);
  const limit = readPositiveIntegerOption('ACCEPT_CRM_ANALYSIS_LIMIT', 'limit', 300);
  const allQuestions = readQuestionList(questionListPath).map((question) => ({
    ...question,
    expectedTemplateType: coverageTemplateMap.get(question.questionNumber),
  }));
  const questions = allQuestions
    .filter((question) => question.questionNumber >= startNumber)
    .slice(0, limit);

  if (allQuestions.length !== 300) {
    throw new Error(`题库数量不是 300，当前为 ${allQuestions.length}。`);
  }

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
    const userId = process.env.ACCEPT_CRM_ANALYSIS_USER_ID ?? 'user_sales_director';
    const user = (CRM_USERS as CrmUser[]).find((item) => item.id === userId);
    if (!user) {
      throw new Error(`找不到验收用户：${userId}`);
    }

    const results: QuestionAcceptanceResult[] = [];
    for (const question of questions) {
      const result = await runQuestionAcceptance({ service, user, question });
      results.push(result);
      const progress = `${question.questionCode} ${result.status}`;
      const reason = result.failureReasons[0] ? `：${result.failureReasons[0]}` : '';
      console.log(`${progress}${reason}`);
    }

    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, buildAcceptanceReport(results, Date.now() - startedAt), 'utf8');

    const passed = results.filter((item) => item.status === '通过').length;
    const failed = results.length - passed;
    console.log(`严格验收完成：通过 ${passed}/${results.length}，失败 ${failed}/${results.length}`);
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

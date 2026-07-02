import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  buildCrmAnalysisQuestionEvidencePath,
  CRM_ANALYSIS_QUESTION_TEMPLATE_RULES,
  resolveCrmAnalysisQuestionTemplateRuleByQuestionNumber,
  resolveCrmAnalysisQuestionTemplateRuleByText,
  type CrmAnalysisQuestionTemplateRule,
} from '../backend/src/modules/analysis/crm-analysis-question-template.registry';

interface DemandQuestion {
  number: number;
  sectionTitle: string;
  questionText: string;
}

const projectRoot = resolve(__dirname, '..');
const defaultSourcePath = resolve(projectRoot, '../../业务运营发展分析问题清单_20260627.md');
const sourcePath = resolve(process.env.CRM_ANALYSIS_QUESTION_SOURCE ?? defaultSourcePath);
const matrixOutputPath = resolve(
  projectRoot,
  'docs/testing/CRM智能分析300问覆盖矩阵_20260630.md',
);
const questionListOutputPath = resolve(
  projectRoot,
  'docs/testing/CRM智能分析300问企微验收问题清单_20260630.txt',
);

const questions = parseDemandQuestions(readFileSync(sourcePath, 'utf8'));
if (questions.length !== 300) {
  throw new Error(`需求问题数量应为 300，当前解析到 ${questions.length} 条，请检查源文档：${sourcePath}`);
}

const matrixMarkdown = buildMatrixMarkdown(questions);
const questionListText = buildQuestionListText(questions);

mkdirSync(dirname(matrixOutputPath), { recursive: true });
mkdirSync(dirname(questionListOutputPath), { recursive: true });
for (const rule of CRM_ANALYSIS_QUESTION_TEMPLATE_RULES) {
  mkdirSync(resolve(projectRoot, rule.evidenceDirectory), { recursive: true });
}
writeFileSync(matrixOutputPath, matrixMarkdown, 'utf8');
writeFileSync(questionListOutputPath, questionListText, 'utf8');

console.log(`已生成 300 问覆盖矩阵：${matrixOutputPath}`);
console.log(`已生成企微验收问题清单：${questionListOutputPath}`);

function parseDemandQuestions(markdown: string): DemandQuestion[] {
  const questions: DemandQuestion[] = [];
  let sectionTitle = '未分组';

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    const sectionMatch = /^##\s+(.+)$/.exec(line);
    if (sectionMatch) {
      sectionTitle = sectionMatch[1];
      continue;
    }

    const questionMatch = /^(\d+)[.、]\s*(.+)$/.exec(line);
    if (!questionMatch) {
      continue;
    }

    questions.push({
      number: Number(questionMatch[1]),
      sectionTitle,
      questionText: questionMatch[2].trim(),
    });
  }

  return questions.sort((left, right) => left.number - right.number);
}

function buildMatrixMarkdown(questions: DemandQuestion[]): string {
  const resolvedRows = questions.map((question) => {
    const rule = resolveQuestionRule(question);
    return {
      question,
      rule,
      evidencePath: buildCrmAnalysisQuestionEvidencePath(rule, question.number),
    };
  });
  const templateSummary = buildTemplateSummary(resolvedRows.map((row) => row.rule));
  const statusSummary = buildStatusSummary(resolvedRows.map((row) => row.rule));
  const lines: string[] = [
    '# CRM 智能分析 300 问覆盖矩阵',
    '',
    `生成时间：2026-06-30`,
    '',
    `源需求文档：\`${sourcePath}\``,
    '',
    '说明：本矩阵由运行时同一套 300 问模板注册表生成，作为企微真实验收的举证清单。截图列为标准留存路径，真实验收时按路径保存企业微信回复截图。',
    '',
    '## 一、模板覆盖汇总',
    '',
    '| 模板类型 | 模板名称 | 问题数 | 优先级 | 数据源 | 当前状态 |',
    '| --- | --- | ---: | --- | --- | --- |',
    ...templateSummary.map((item) =>
      `| \`${item.rule.templateType}\` | ${escapeTableCell(item.rule.templateName)} | ${item.count} | ${item.rule.priority} | ${escapeTableCell(item.rule.dataSources.join('、'))} | ${escapeTableCell(item.rule.implementationStatus)} |`,
    ),
    '',
    '## 二、实现状态汇总',
    '',
    '| 状态 | 问题数 |',
    '| --- | ---: |',
    ...statusSummary.map((item) => `| ${escapeTableCell(item.status)} | ${item.count} |`),
    '',
    '## 三、300 问验收覆盖矩阵',
    '',
    '| 问题编号 | 模板类型 | 数据源 | 是否已实现 | 验收问题 | 企微截图 |',
    '| --- | --- | --- | --- | --- | --- |',
  ];

  for (const row of resolvedRows) {
    lines.push(
      `| Q${String(row.question.number).padStart(3, '0')} | \`${row.rule.templateType}\` ${escapeTableCell(row.rule.templateName)} | ${escapeTableCell(row.rule.dataSources.join('、'))} | ${escapeTableCell(row.rule.implementationStatus)} | ${escapeTableCell(row.question.questionText)} | \`${row.evidencePath}\` |`,
    );
  }

  lines.push(
    '',
    '## 四、验收执行规则',
    '',
    '1. 每条问题必须在企业微信「渠道 CRM 系统机器人」中真实发送。',
    '2. 每条回复必须检查模板名、数据口径、权限口径、核心指标、明细摘要、风险建议和建议追问。',
    '3. 每条截图必须按矩阵中的截图路径保存，截图内应包含提问、机器人答复和发送时间。',
    '4. 失败项必须在同一行追加缺陷编号，修复后复测并保留新截图。',
    '5. 数据源缺失的问题不能直接判定通过，必须输出清楚的字段缺口、接口缺口或权限缺口。',
  );

  return `${lines.join('\n')}\n`;
}

function buildQuestionListText(questions: DemandQuestion[]): string {
  return questions
    .map((question) =>
      `Q${String(question.number).padStart(3, '0')}｜${question.sectionTitle}｜${question.questionText}`,
    )
    .join('\n') + '\n';
}

function resolveQuestionRule(question: DemandQuestion): CrmAnalysisQuestionTemplateRule {
  const ruleByText = resolveCrmAnalysisQuestionTemplateRuleByText(question.questionText);
  const ruleByNumber = resolveCrmAnalysisQuestionTemplateRuleByQuestionNumber(question.number);
  const rule = ruleByText ?? ruleByNumber;
  if (!rule) {
    throw new Error(`问题 Q${question.number} 未命中任何模板规则：${question.questionText}`);
  }
  return rule;
}

function buildTemplateSummary(rules: CrmAnalysisQuestionTemplateRule[]) {
  return CRM_ANALYSIS_QUESTION_TEMPLATE_RULES
    .map((rule) => ({
      rule,
      count: rules.filter((item) => item.templateType === rule.templateType).length,
    }))
    .filter((item) => item.count > 0);
}

function buildStatusSummary(rules: CrmAnalysisQuestionTemplateRule[]) {
  const statusMap = new Map<string, number>();
  for (const rule of rules) {
    statusMap.set(rule.implementationStatus, (statusMap.get(rule.implementationStatus) ?? 0) + 1);
  }

  return Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }));
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, '｜').replace(/\n/g, ' ');
}

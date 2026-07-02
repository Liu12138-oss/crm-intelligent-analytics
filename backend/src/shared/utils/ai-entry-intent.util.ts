import { z } from 'zod';
import type {
  AiEntryInterpretationSnapshot,
  AiEntryIntent,
  AiEntryLanguage,
  AiWorkflowRoutingSnapshot,
} from '../types/domain';

const aiEntryStructuredSlotsSchema = z.record(z.unknown());

const webAnalysisQuerySlotsSchema = z.object({
  entryMode: z.enum(['FREE_QUERY', 'FIXED_WORKFLOW']).optional(),
  domain: z.string().min(1),
  metrics: z.array(z.string()),
  dimensions: z.array(z.string()),
  filters: z.record(z.unknown()),
  missingConditions: z.array(z.string()),
  resultKindHint: z.string().optional(),
  queryEntities: z.array(z.string()).optional(),
  resultIntent: z.string().optional(),
  timeRangeText: z.string().optional(),
  analysisFacetProfile: z.string().optional(),
  analysisDepth: z.string().optional(),
  analysisFocus: z.array(z.string()).optional(),
});

const wecomTeamDailyReportSlotsSchema = z.object({
  leaderNameQuery: z.string().trim().min(1),
});

const wecomActiveTaskReplySlotsSchema = z.object({
  activeTaskLabel: z.string().trim().min(1),
});

/**
 * 按场景和目标工作流校验统一 AI 入口结构化槽位。
 *
 * 这里只约束当前已经落地并被多处消费的最小关键字段，
 * 避免不同入口继续各自生产“看起来像结构化结果”的弱约定对象。
 */
function validateAiEntryStructuredSlots(snapshot: {
  scene: AiEntryInterpretationSnapshot['scene'];
  targetWorkflow: AiEntryInterpretationSnapshot['targetWorkflow'];
  structuredSlots?: Record<string, unknown>;
}): void {
  const structuredSlots = aiEntryStructuredSlotsSchema.parse(
    snapshot.structuredSlots ?? {},
  );

  if (snapshot.scene === 'WEB_ANALYSIS_QUERY') {
    webAnalysisQuerySlotsSchema.parse(structuredSlots);
    return;
  }

  if (snapshot.targetWorkflow === 'WECOM_TEAM_DAILY_REPORT_QUERY') {
    wecomTeamDailyReportSlotsSchema.parse(structuredSlots);
    return;
  }

  if (snapshot.scene === 'WECOM_ACTIVE_TASK_REPLY') {
    wecomActiveTaskReplySlotsSchema.parse(structuredSlots);
  }
}

/**
 * 识别当前文本更接近哪种语言。
 *
 * 这里只做统一入口审计所需的轻量语言归类，不做完整语言学判断。
 * 目标是把中文、英文、韩文、日文、混写和未知文本分开，便于后续治理统计。
 */
export function detectAiEntryLanguage(text: string): AiEntryLanguage {
  const normalizedText = text.trim();
  if (!normalizedText) {
    return 'unknown';
  }

  const hasChinese = /[\u4e00-\u9fff]/u.test(normalizedText);
  const hasEnglish = /[A-Za-z]/u.test(normalizedText);
  const hasKorean = /[\uac00-\ud7af]/u.test(normalizedText);
  const hasJapanese = /[\u3040-\u30ff]/u.test(normalizedText);

  const matchedLanguageCount = [
    hasChinese,
    hasEnglish,
    hasKorean,
    hasJapanese,
  ].filter(Boolean).length;
  if (matchedLanguageCount > 1) {
    return 'mixed';
  }

  if (hasChinese) {
    return 'zh-CN';
  }

  if (hasEnglish) {
    return 'en';
  }

  if (hasKorean) {
    return 'ko';
  }

  if (hasJapanese) {
    return 'ja';
  }

  return 'unknown';
}

/**
 * 构造统一 AI 入口理解快照，并在入口层补齐语言信息与基础校验。
 *
 * 这里统一收口不同模块的快照组装，避免各模块单独漏传 `language`、`intent`
 * 或把空文本误写进审计。
 */
export function createAiEntryInterpretationSnapshot(
  snapshot: Omit<AiEntryInterpretationSnapshot, 'language'> & {
    language?: AiEntryLanguage;
    intent?: AiEntryIntent;
  },
): AiEntryInterpretationSnapshot {
  const originalText = snapshot.originalText.trim();
  if (!originalText) {
    throw new Error('统一 AI 入口快照缺少原始文本。');
  }

  try {
    validateAiEntryStructuredSlots({
      scene: snapshot.scene,
      targetWorkflow: snapshot.targetWorkflow,
      structuredSlots: snapshot.structuredSlots,
    });
  } catch (error) {
    throw new Error(
      `统一 AI 入口结构化槽位校验失败：${
        error instanceof Error ? error.message : 'unknown'
      }`,
    );
  }

  return {
    ...snapshot,
    originalText,
    language: snapshot.language ?? detectAiEntryLanguage(originalText),
  };
}

/**
 * 构造统一程序路由快照。
 *
 * 当前先做最小校验，确保固定程序名与目标工作流不会以空值落审计。
 */
export function createAiWorkflowRoutingSnapshot(
  snapshot: AiWorkflowRoutingSnapshot,
): AiWorkflowRoutingSnapshot {
  if (!snapshot.finalProgram.trim()) {
    throw new Error('统一程序路由快照缺少 finalProgram。');
  }

  return {
    ...snapshot,
    finalProgram: snapshot.finalProgram.trim(),
  };
}

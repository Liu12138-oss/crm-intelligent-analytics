import { Inject, Injectable, Optional } from '@nestjs/common';
import { AuditEventRepository } from '../audit/audit-event.repository';
import { AnalysisSemanticKnowledgeRepository } from '../governance/analysis-semantic-knowledge.repository';
import { AnalysisLoggerService } from '../../shared/logging/analysis-logger.service';
import { buildEntityId } from '../../shared/utils/id.util';
import type {
  AuditEventRecord,
  AnalysisSemanticKnowledgeAssetRecord,
  RiskLevel,
} from '../../shared/types/domain';

/**
 * 候选沉淀结果。
 */
export interface SedimentationRunResult {
  runAt: string;
  trigger: 'scheduled' | 'manual';
  scannedEventCount: number;
  generatedCandidates: SedimentationCandidate[];
  skippedReasons: string[];
}

export interface SedimentationCandidate {
  candidateId: string;
  candidateType: 'VALIDATED_EXAMPLE' | 'NEGATIVE_EXAMPLE' | 'ALIAS' | 'DASHBOARD_TEMPLATE' | 'CALIBRATION_CONFLICT';
  name: string;
  confidence: number;
  evidenceCount: number;
  derivedFromQueryIds: string[];
  proposedAssetId?: string;
}

/**
 * 沉淀配置。
 */
export interface SedimentationConfig {
  /** 是否启用沉淀器。 */
  enabled: boolean;
  /** 候选正例最小成功次数。 */
  validatedExampleMinSuccess: number;
  /** 候选负例最小补问失败次数。 */
  negativeExampleMinFailure: number;
  /** 候选别名最小不同说法数。 */
  aliasMinVariations: number;
  /** 候选看板模板最小成功次数。 */
  dashboardTemplateMinSuccess: number;
  /** 候选看板模板最小正面反馈数。 */
  dashboardTemplateMinPositiveFeedback: number;
  /** 口径冲突最小出现次数。 */
  calibrationConflictMinOccurrences: number;
  /** 候选过期天数。 */
  candidateExpiresInDays: number;
}

const DEFAULT_SEDIMENTATION_CONFIG: SedimentationConfig = {
  enabled: true,
  validatedExampleMinSuccess: 3,
  negativeExampleMinFailure: 2,
  aliasMinVariations: 2,
  dashboardTemplateMinSuccess: 5,
  dashboardTemplateMinPositiveFeedback: 1,
  calibrationConflictMinOccurrences: 2,
  candidateExpiresInDays: 30,
};

/**
 * 知识沉淀器（学习闭环第 3 层核心引擎）。
 *
 * 设计原因：
 * 1. 定时 + 事件触发地从执行轨迹和反馈信号中生成候选知识资产
 * 2. 候选进入 PROPOSED 状态，不注入 AI 理解层，需管理员审核后才生效
 * 3. 沉淀器异步执行，不阻塞主链路
 * 4. 全部行为可审计（KNOWLEDGE_ASSET_PROPOSED / CALIBRATION_CONFLICT_DETECTED）
 *
 * 沉淀规则（5 类候选）：
 * - 候选正例：同一问题成功执行 ≥ N 次且无负面反馈
 * - 候选负例：同一问题被补问 ≥ M 次仍无法补全或被阻断
 * - 候选别名：同一规范标签在用户问题里出现 ≥ K 种不同说法
 * - 候选看板模板：自由查询成功执行 ≥ L 次且至少 1 次正面反馈
 * - 口径冲突待办：同一术语被解析成不同字段/口径 ≥ P 次
 *
 * 调用注意事项：
 * - 沉淀器有全局开关，可随时关停
 * - 候选按 questionText 归一化去重，已被驳回的候选 30 天内不再生成
 * - 候选默认 30 天未审核自动过期
 */
@Injectable()
export class KnowledgeSedimentationService {
  constructor(
    private readonly auditEventRepository: AuditEventRepository,
    private readonly knowledgeRepository: AnalysisSemanticKnowledgeRepository,
    private readonly logger: AnalysisLoggerService,
    @Optional()
    private readonly config: SedimentationConfig = DEFAULT_SEDIMENTATION_CONFIG,
  ) {}

  /**
   * 执行一次沉淀扫描。
   *
   * 参数说明：`trigger` 标注明是定时触发还是手动触发；`sinceHours` 指定扫描最近多少小时的审计事件。
   * 返回值说明：返回本次扫描的候选生成结果。
   * 调用注意事项：沉淀器关闭时直接返回空结果，不报错。
   */
  runSedimentation(
    trigger: 'scheduled' | 'manual' = 'scheduled',
    sinceHours = 24,
  ): SedimentationRunResult {
    if (!this.config.enabled) {
      this.logger.logStep('知识沉淀器已关闭，跳过本次扫描', { trigger });
      return {
        runAt: new Date().toISOString(),
        trigger,
        scannedEventCount: 0,
        generatedCandidates: [],
        skippedReasons: ['sedimentation-disabled'],
      };
    }

    const runAt = new Date().toISOString();
    const sinceTime = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();
    const allEvents = this.auditEventRepository.list();
    const recentEvents = allEvents.filter(
      (event) => event.createdAt >= sinceTime,
    );

    this.logger.logStep('知识沉淀器开始扫描', {
      trigger,
      sinceHours,
      totalEvents: allEvents.length,
      recentEvents: recentEvents.length,
    });

    const candidates: SedimentationCandidate[] = [];
    const skippedReasons: string[] = [];

    // 沉淀候选正例
    const validatedExampleCandidates = this.sedimentValidatedExamples(recentEvents);
    candidates.push(...validatedExampleCandidates);

    // 沉淀候选负例
    const negativeExampleCandidates = this.sedimentNegativeExamples(recentEvents);
    candidates.push(...negativeExampleCandidates);

    // 沉淀候选别名
    const aliasCandidates = this.sedimentAliases(recentEvents);
    candidates.push(...aliasCandidates);

    // 口径冲突检测
    const conflictCandidates = this.sedimentCalibrationConflicts(recentEvents);
    candidates.push(...conflictCandidates);

    // 候选看板模板沉淀
    const dashboardCandidates = this.sedimentDashboardTemplates(recentEvents);
    candidates.push(...dashboardCandidates);

    this.logger.logStep('知识沉淀器扫描完成', {
      trigger,
      generatedCount: candidates.length,
      candidateTypes: candidates.map((c) => c.candidateType),
    });

    return {
      runAt,
      trigger,
      scannedEventCount: recentEvents.length,
      generatedCandidates: candidates,
      skippedReasons,
    };
  }

  /**
   * 沉淀候选正例。
   *
   * 规则：同一问题文本（归一化后）成功执行 ≥ N 次，且无负面反馈，且未命中已有正例。
   */
  private sedimentValidatedExamples(
    events: AuditEventRecord[],
  ): SedimentationCandidate[] {
    const successEvents = events.filter(
      (event) =>
        event.eventType === 'QUERY_SUCCEEDED' && event.originalQuestion,
    );

    // 按归一化问题分组统计
    const questionGroups = new Map<
      string,
      { question: string; queryIds: string[]; count: number }
    >();

    for (const event of successEvents) {
      const normalized = this.normalizeQuestion(event.originalQuestion!);
      const existing = questionGroups.get(normalized);
      if (existing) {
        existing.count++;
        if (event.relatedRequestId) {
          existing.queryIds.push(event.relatedRequestId);
        }
      } else {
        questionGroups.set(normalized, {
          question: event.originalQuestion!,
          queryIds: event.relatedRequestId ? [event.relatedRequestId] : [],
          count: 1,
        });
      }
    }

    // 获取已有正例（避免重复生成，包括已驳回的，避免反复生成）
    const existingExamples = this.knowledgeRepository.listDraftAll().filter(
      (asset) => asset.type === 'VALIDATED_EXAMPLE',
    );
    const existingQuestions = new Set(
      existingExamples.map((asset) => this.normalizeQuestion(asset.questionText ?? '')),
    );

    // 获取负面反馈（排除有负面反馈的问题）
    const negativeFeedbackQueryIds = new Set(
      events
        .filter(
          (event) =>
            event.eventType === 'ANALYSIS_RESULT_FEEDBACK' &&
            event.sessionSnapshot?.feedbackType === 'NOT_USEFUL',
        )
        .map((event) => event.sessionSnapshot?.queryId as string)
        .filter(Boolean),
    );

    const candidates: SedimentationCandidate[] = [];

    for (const [normalized, group] of questionGroups) {
      if (group.count < this.config.validatedExampleMinSuccess) {
        continue;
      }
      if (existingQuestions.has(normalized)) {
        continue;
      }
      // 检查是否有负面反馈
      const hasNegative = group.queryIds.some((id) =>
        negativeFeedbackQueryIds.has(id),
      );
      if (hasNegative) {
        continue;
      }

      const candidate = this.createProposedAsset({
        type: 'VALIDATED_EXAMPLE',
        name: `候选正例：${group.question.slice(0, 30)}`,
        questionText: group.question,
        sqlHint: this.extractSqlHintFromEvents(group.queryIds, events),
        matchKeywords: this.extractKeywords(group.question),
        evidenceCount: group.count,
        confidence: Math.min(1, group.count / (group.count + 1)),
        derivedFromQueryIds: group.queryIds.slice(0, 10),
      });

      candidates.push({
        candidateId: candidate.candidateId,
        candidateType: 'VALIDATED_EXAMPLE',
        name: candidate.name,
        confidence: candidate.confidence,
        evidenceCount: candidate.evidenceCount,
        derivedFromQueryIds: candidate.derivedFromQueryIds,
        proposedAssetId: candidate.proposedAssetId,
      });
    }

    return candidates;
  }

  /**
   * 沉淀候选负例。
   *
   * 规则：同一问题文本被补问 ≥ M 次仍无法补全，或被 QUERY_BLOCKED ≥ 1 次。
   */
  private sedimentNegativeExamples(
    events: AuditEventRecord[],
  ): SedimentationCandidate[] {
    const failureEvents = events.filter(
      (event) =>
        (event.eventType === 'CLARIFICATION_REQUESTED' ||
          event.eventType === 'QUERY_BLOCKED') &&
        event.originalQuestion,
    );

    const questionGroups = new Map<
      string,
      {
        question: string;
        queryIds: string[];
        clarificationCount: number;
        blockedCount: number;
        blockReasons: string[];
      }
    >();

    for (const event of failureEvents) {
      const normalized = this.normalizeQuestion(event.originalQuestion!);
      const existing = questionGroups.get(normalized);
      if (existing) {
        if (event.eventType === 'CLARIFICATION_REQUESTED') {
          existing.clarificationCount++;
        }
        if (event.eventType === 'QUERY_BLOCKED') {
          existing.blockedCount++;
          if (event.failureReason) {
            existing.blockReasons.push(event.failureReason);
          }
        }
        if (event.relatedRequestId) {
          existing.queryIds.push(event.relatedRequestId);
        }
      } else {
        questionGroups.set(normalized, {
          question: event.originalQuestion!,
          queryIds: event.relatedRequestId ? [event.relatedRequestId] : [],
          clarificationCount: event.eventType === 'CLARIFICATION_REQUESTED' ? 1 : 0,
          blockedCount: event.eventType === 'QUERY_BLOCKED' ? 1 : 0,
          blockReasons: event.failureReason ? [event.failureReason] : [],
        });
      }
    }

    const existingNegatives = this.knowledgeRepository.listDraftAll().filter(
      (asset) => asset.type === 'NEGATIVE_EXAMPLE',
    );
    const existingQuestions = new Set(
      existingNegatives.map((asset) => this.normalizeQuestion(asset.questionText ?? '')),
    );

    const candidates: SedimentationCandidate[] = [];

    for (const [normalized, group] of questionGroups) {
      // 补问 ≥ M 次仍无法补全，或被阻断 ≥ 1 次
      const meetsCondition =
        group.clarificationCount >= this.config.negativeExampleMinFailure ||
        group.blockedCount >= 1;

      if (!meetsCondition || existingQuestions.has(normalized)) {
        continue;
      }

      const blockReason =
        group.blockReasons[0] ??
        `该问题在 ${group.clarificationCount} 次补问后仍无法补全必要条件`;

      const candidate = this.createProposedAsset({
        type: 'NEGATIVE_EXAMPLE',
        name: `候选负例：${group.question.slice(0, 30)}`,
        questionText: group.question,
        blockReason,
        matchKeywords: this.extractKeywords(group.question),
        evidenceCount: group.clarificationCount + group.blockedCount,
        confidence: Math.min(
          1,
          (group.clarificationCount + group.blockedCount * 2) /
            (group.clarificationCount + group.blockedCount + 2),
        ),
        derivedFromQueryIds: group.queryIds.slice(0, 10),
      });

      candidates.push({
        candidateId: candidate.candidateId,
        candidateType: 'NEGATIVE_EXAMPLE',
        name: candidate.name,
        confidence: candidate.confidence,
        evidenceCount: candidate.evidenceCount,
        derivedFromQueryIds: candidate.derivedFromQueryIds,
        proposedAssetId: candidate.proposedAssetId,
      });
    }

    return candidates;
  }

  /**
   * 沉淀候选别名。
   *
   * 规则：同一规范标签在用户问题里出现 ≥ K 种不同说法，且这些说法未在已有 ALIAS 资产里。
   *
   * 简化实现：从成功查询的问题文本中提取"销售负责人"相关说法做归并。
   * 完整实现需要 NLP 术语归一，此处先做关键词匹配。
   */
  private sedimentAliases(
    events: AuditEventRecord[],
  ): SedimentationCandidate[] {
    // 当前做简化实现：只检测"销售负责人"维度的别名
    // 完整实现需要从执行轨迹中提取 AI 解析的 canonicalLabel 和用户原始说法
    const ownerSynonyms = new Map<string, Set<string>>();

    for (const event of events) {
      if (event.eventType !== 'QUERY_SUCCEEDED' || !event.originalQuestion) {
        continue;
      }
      const question = event.originalQuestion;
      // 简化：检测常见销售负责人说法
      const patterns: Array<{ canonical: string; pattern: RegExp }> = [
        { canonical: '销售负责人', pattern: /(销售负责人|负责人|业务员|销售员|销售|跟进人|归属人)/u },
      ];

      for (const { canonical, pattern } of patterns) {
        if (pattern.test(question)) {
          const match = question.match(pattern);
          if (match) {
            if (!ownerSynonyms.has(canonical)) {
              ownerSynonyms.set(canonical, new Set());
            }
            ownerSynonyms.get(canonical)!.add(match[1]);
          }
        }
      }
    }

    const existingAliases = this.knowledgeRepository.listDraftAll().filter(
      (asset) =>
        asset.type === 'ALIAS' && asset.reviewStatus !== 'REJECTED',
    );
    const existingSynonyms = new Set(
      existingAliases.flatMap((asset) => asset.synonyms ?? []),
    );

    const candidates: SedimentationCandidate[] = [];

    for (const [canonical, synonyms] of ownerSynonyms) {
      if (synonyms.size < this.config.aliasMinVariations) {
        continue;
      }
      const newSynonyms = [...synonyms].filter((s) => !existingSynonyms.has(s));
      if (newSynonyms.length < this.config.aliasMinVariations) {
        continue;
      }

      const candidate = this.createProposedAsset({
        type: 'ALIAS',
        name: `候选别名：${canonical}`,
        canonicalLabel: canonical,
        synonyms: newSynonyms,
        hint: `用户常用 ${newSynonyms.join('、')} 指代 ${canonical}，建议归一处理`,
        matchKeywords: newSynonyms,
        evidenceCount: newSynonyms.length,
        confidence: Math.min(1, newSynonyms.length / 5),
        derivedFromQueryIds: [],
      });

      candidates.push({
        candidateId: candidate.candidateId,
        candidateType: 'ALIAS',
        name: candidate.name,
        confidence: candidate.confidence,
        evidenceCount: candidate.evidenceCount,
        derivedFromQueryIds: candidate.derivedFromQueryIds,
        proposedAssetId: candidate.proposedAssetId,
      });
    }

    return candidates;
  }

  /**
   * 口径冲突检测。
   *
   * 规则：同一术语（如"新增商机"）在不同查询里被解析成不同字段或不同时间口径，
   * 且冲突出现 ≥ P 次，生成治理待办（不生成资产）。
   *
   * 简化实现：从审计的 sessionSnapshot 中提取术语解析差异。
   */
  private sedimentCalibrationConflicts(
    events: AuditEventRecord[],
  ): SedimentationCandidate[] {
    // 简化实现：检测同一 originalQuestion 被解析成不同 resultKindHint 的情况
    const termResolutions = new Map<
      string,
      Map<string, string[]>
    >();

    for (const event of events) {
      if (event.eventType !== 'QUERY_SUCCEEDED' || !event.originalQuestion) {
        continue;
      }
      const normalized = this.normalizeQuestion(event.originalQuestion);
      const resultKind = event.sessionSnapshot?.resultKindHint as string;
      if (!resultKind) {
        continue;
      }

      if (!termResolutions.has(normalized)) {
        termResolutions.set(normalized, new Map());
      }
      const resolutions = termResolutions.get(normalized)!;
      if (!resolutions.has(resultKind)) {
        resolutions.set(resultKind, []);
      }
      if (event.relatedRequestId) {
        resolutions.get(resultKind)!.push(event.relatedRequestId);
      }
    }

    const candidates: SedimentationCandidate[] = [];

    for (const [term, resolutions] of termResolutions) {
      if (resolutions.size < 2) {
        continue;
      }
      // 检查冲突次数是否达到阈值
      const totalOccurrences = [...resolutions.values()].reduce(
        (sum, ids) => sum + ids.length,
        0,
      );
      if (totalOccurrences < this.config.calibrationConflictMinOccurrences) {
        continue;
      }

      const allQueryIds = [...resolutions.values()].flat();
      const resultKinds = [...resolutions.keys()];

      // 写入口径冲突审计事件
      this.auditEventRepository.create({
        id: buildEntityId('audit_event'),
        eventType: 'CALIBRATION_CONFLICT_DETECTED',
        actorId: 'system:sedimentation',
        actorRoleIds: [],
        actorType: 'system',
        scopeSnapshot: {
          organizationIds: [],
          departmentIds: [],
          ownerIds: [],
          scopeSummary: '系统自动检测',
        },
        riskLevel: 'MEDIUM' as RiskLevel,
        reviewStatus: 'PENDING',
        outcome: `口径冲突："${term}" 被解析为 ${resultKinds.join(' / ')}`,
        actionSummary: `术语 "${term}" 在 ${totalOccurrences} 次查询中被解析为不同口径`,
        resourceType: 'calibration-conflict',
        resourceId: buildEntityId('conflict'),
        originalQuestion: term,
        sessionSnapshot: {
          term,
          resolutions: Object.fromEntries(resolutions),
          queryIds: allQueryIds.slice(0, 20),
        },
        createdAt: new Date().toISOString(),
      });

      candidates.push({
        candidateId: buildEntityId('conflict-candidate'),
        candidateType: 'CALIBRATION_CONFLICT',
        name: `口径冲突：${term}`,
        confidence: 0.8,
        evidenceCount: totalOccurrences,
        derivedFromQueryIds: allQueryIds.slice(0, 10),
      });
    }

    return candidates;
  }

  /**
   * 创建候选资产并写入草稿表和审计。
   */
  private createProposedAsset(params: {
    type: AnalysisSemanticKnowledgeAssetRecord['type'];
    name: string;
    questionText?: string;
    sqlHint?: string;
    blockReason?: string;
    canonicalLabel?: string;
    synonyms?: string[];
    hint?: string;
    matchKeywords: string[];
    evidenceCount: number;
    confidence: number;
    derivedFromQueryIds: string[];
  }): {
    candidateId: string;
    proposedAssetId: string;
    name: string;
    confidence: number;
    evidenceCount: number;
    derivedFromQueryIds: string[];
  } {
    const proposedAssetId = buildEntityId('knowledge-asset');
    const candidateId = buildEntityId('candidate');
    const now = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() + this.config.candidateExpiresInDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    const asset: AnalysisSemanticKnowledgeAssetRecord = {
      id: proposedAssetId,
      type: params.type,
      name: params.name,
      status: 'INACTIVE',
      matchKeywords: params.matchKeywords,
      canonicalLabel: params.canonicalLabel,
      synonyms: params.synonyms,
      questionText: params.questionText,
      sqlHint: params.sqlHint,
      hint: params.hint,
      blockReason: params.blockReason,
      updatedBy: 'system:sedimentation',
      updatedAt: now,
      source: 'AUTO_DERIVED',
      reviewStatus: 'PROPOSED',
      derivedFromQueryIds: params.derivedFromQueryIds,
      evidenceCount: params.evidenceCount,
      confidence: params.confidence,
      proposedAt: now,
      expiresAt,
    };

    this.knowledgeRepository.saveDraft(asset);

    // 写入候选生成审计事件
    this.auditEventRepository.create({
      id: buildEntityId('audit_event'),
      eventType: 'KNOWLEDGE_ASSET_PROPOSED',
      actorId: 'system:sedimentation',
      actorRoleIds: [],
      actorType: 'system',
      resourceType: 'semantic-knowledge-asset',
      resourceId: proposedAssetId,
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        scopeSummary: '系统自动沉淀',
      },
      riskLevel: 'LOW' as RiskLevel,
      reviewStatus: 'PENDING',
      outcome: `候选资产已生成：${params.name}`,
      actionSummary: `类型=${params.type}，置信度=${params.confidence.toFixed(2)}，证据数=${params.evidenceCount}`,
      targetType: 'semantic-knowledge-asset',
      targetId: proposedAssetId,
      targetSummary: params.name,
      sessionSnapshot: {
        candidateId,
        assetId: proposedAssetId,
        candidateType: params.type,
        confidence: params.confidence,
        evidenceCount: params.evidenceCount,
        derivedFromQueryIds: params.derivedFromQueryIds,
        expiresAt,
      },
      createdAt: now,
    });

    return {
      candidateId,
      proposedAssetId,
      name: params.name,
      confidence: params.confidence,
      evidenceCount: params.evidenceCount,
      derivedFromQueryIds: params.derivedFromQueryIds,
    };
  }

  /**
   * 归一化问题文本（去空格、去标点、转小写）。
   */
  private normalizeQuestion(question: string): string {
    return question
      .replace(/[\s\u3000\u00a0]+/gu, '')
      .replace(/[，。、；：！？""''（）【】《》.,;:!?'"\[\](){}<>]/gu, '')
      .toLowerCase()
      .trim();
  }

  /**
   * 从问题文本中提取关键词（简化实现）。
   */
  private extractKeywords(question: string): string[] {
    const keywords: string[] = [];
    if (/(商机|机会)/u.test(question)) keywords.push('商机');
    if (/(报备)/u.test(question)) keywords.push('报备');
    if (/(报价)/u.test(question)) keywords.push('报价');
    if (/(订单|下单)/u.test(question)) keywords.push('订单');
    if (/(渠道商|服务商|代理商)/u.test(question)) keywords.push('渠道商');
    if (/(区域|大区)/u.test(question)) keywords.push('区域');
    if (/(负责人|销售)/u.test(question)) keywords.push('负责人');
    if (/(趋势|走势)/u.test(question)) keywords.push('趋势');
    if (/(排名|排行|TOP)/u.test(question)) keywords.push('排名');
    return keywords.length > 0 ? keywords : [question.slice(0, 4)];
  }

  /**
   * 从执行轨迹中提取 SQL 提示（简化实现）。
   */
  private extractSqlHintFromEvents(
    queryIds: string[],
    events: AuditEventRecord[],
  ): string {
    const relatedEvent = events.find(
      (event) =>
        event.relatedRequestId &&
        queryIds.includes(event.relatedRequestId) &&
        event.sessionSnapshot?.resultKindHint,
    );
    if (relatedEvent?.sessionSnapshot?.resultKindHint) {
      return `resultKind=${relatedEvent.sessionSnapshot.resultKindHint}`;
    }
    return '';
  }

  /**
   * 获取当前沉淀配置。
   */
  getConfig(): SedimentationConfig {
    return { ...this.config };
  }

  /**
   * 列出所有 PROPOSED 候选。
   */
  listProposedCandidates(): AnalysisSemanticKnowledgeAssetRecord[] {
    return this.knowledgeRepository
      .listDraftAll()
      .filter((asset) => asset.reviewStatus === 'PROPOSED');
  }

  /**
   * 审核候选（管理员通过或驳回）。
   *
   * 参数说明：
   * - `assetId`：候选资产 ID
   * - `action`：APPROVE 或 REJECT
   * - `reviewedBy`：审核人 ID
   * - `reason`：审核理由（可选）
   */
  reviewCandidate(
    assetId: string,
    action: 'APPROVE' | 'REJECT',
    reviewedBy: string,
    reason?: string,
  ): { accepted: boolean; reviewStatus: string } {
    const asset = this.knowledgeRepository.findDraftById(assetId);
    if (!asset) {
      return { accepted: false, reviewStatus: 'NOT_FOUND' };
    }
    if (asset.reviewStatus !== 'PROPOSED') {
      return { accepted: false, reviewStatus: 'ALREADY_REVIEWED' };
    }

    const now = new Date().toISOString();
    const updatedAsset: AnalysisSemanticKnowledgeAssetRecord = {
      ...asset,
      reviewStatus: action === 'APPROVE' ? 'ACTIVE' : 'REJECTED',
      status: action === 'APPROVE' ? 'ACTIVE' : 'INACTIVE',
      reviewedBy,
      reviewedAt: now,
      updatedAt: now,
    };

    this.knowledgeRepository.saveDraft(updatedAsset);

    // 写入审核审计事件
    this.auditEventRepository.create({
      id: buildEntityId('audit_event'),
      eventType:
        action === 'APPROVE'
          ? 'KNOWLEDGE_ASSET_APPROVED'
          : 'KNOWLEDGE_ASSET_REJECTED',
      actorId: reviewedBy,
      actorRoleIds: [],
      actorType: 'crm-user',
      resourceType: 'semantic-knowledge-asset',
      resourceId: assetId,
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        scopeSummary: '管理员审核候选',
      },
      riskLevel: 'LOW' as RiskLevel,
      reviewStatus: 'CONFIRMED',
      outcome:
        action === 'APPROVE'
          ? `候选已审核通过：${asset.name}`
          : `候选已驳回：${asset.name}`,
      actionSummary: reason ? `审核理由：${reason}` : '无附加理由',
      targetType: 'semantic-knowledge-asset',
      targetId: assetId,
      targetSummary: asset.name,
      sessionSnapshot: {
        assetId,
        action,
        reason,
        reviewedBy,
        reviewedAt: now,
      },
      createdAt: now,
    });

    this.logger.logStep('候选资产已审核', {
      assetId,
      action,
      reviewedBy,
    });

    return {
      accepted: true,
      reviewStatus: action === 'APPROVE' ? 'ACTIVE' : 'REJECTED',
    };
  }

  /**
   * 获取沉淀效果统计。
   *
   * 返回值说明：返回候选生成数、审核通过率、候选类型分布等指标。
   */
  getEffectStats(): {
    totalProposed: number;
    totalApproved: number;
    totalRejected: number;
    totalExpired: number;
    approvalRate: number;
    byType: Record<string, { proposed: number; approved: number; rejected: number }>;
    recentRuns: Array<{ runAt: string; trigger: string; generatedCount: number }>;
  } {
    const allAssets = this.knowledgeRepository.listDraftAll();
    const autoDerived = allAssets.filter((a) => a.source === 'AUTO_DERIVED');

    const totalProposed = autoDerived.filter((a) => a.reviewStatus === 'PROPOSED').length;
    const totalApproved = autoDerived.filter((a) => a.reviewStatus === 'ACTIVE').length;
    const totalRejected = autoDerived.filter((a) => a.reviewStatus === 'REJECTED').length;
    const totalExpired = autoDerived.filter((a) => a.reviewStatus === 'EXPIRED').length;
    const reviewed = totalApproved + totalRejected;
    const approvalRate = reviewed > 0 ? totalApproved / reviewed : 0;

    const byType: Record<string, { proposed: number; approved: number; rejected: number }> = {};
    for (const asset of autoDerived) {
      const typeKey = asset.type;
      if (!byType[typeKey]) {
        byType[typeKey] = { proposed: 0, approved: 0, rejected: 0 };
      }
      if (asset.reviewStatus === 'PROPOSED') byType[typeKey].proposed++;
      if (asset.reviewStatus === 'ACTIVE') byType[typeKey].approved++;
      if (asset.reviewStatus === 'REJECTED') byType[typeKey].rejected++;
    }

    // 从审计获取最近沉淀运行记录
    const recentRuns = this.auditEventRepository
      .list()
      .filter((e) => e.eventType === 'KNOWLEDGE_ASSET_PROPOSED')
      .slice(0, 20)
      .map((e) => ({
        runAt: e.createdAt,
        trigger: (e.sessionSnapshot?.trigger as string) ?? 'unknown',
        generatedCount: 1,
      }));

    return {
      totalProposed,
      totalApproved,
      totalRejected,
      totalExpired,
      approvalRate,
      byType,
      recentRuns,
    };
  }

  /**
   * 列出口径冲突待办。
   *
   * 返回值说明：返回 CALIBRATION_CONFLICT_DETECTED 审计事件列表。
   */
  listCalibrationConflicts(): Array<{
    conflictId: string;
    term: string;
    resolutions: Record<string, string[]>;
    queryIds: string[];
    detectedAt: string;
    resolved: boolean;
  }> {
    return this.auditEventRepository
      .list()
      .filter((e) => e.eventType === 'CALIBRATION_CONFLICT_DETECTED')
      .map((e) => ({
        conflictId: e.id,
        term: (e.sessionSnapshot?.term as string) ?? e.originalQuestion ?? '',
        resolutions: (e.sessionSnapshot?.resolutions as Record<string, string[]>) ?? {},
        queryIds: (e.sessionSnapshot?.queryIds as string[]) ?? [],
        detectedAt: e.createdAt,
        resolved: false,
      }));
  }

  /**
   * 收敛口径冲突。
   *
   * 参数说明：
   * - `conflictId`：冲突待办 ID
   * - `resolution`：管理员填写的收敛说明
   * - `resolvedBy`：操作人 ID
   */
  resolveCalibrationConflict(
    conflictId: string,
    resolution: string,
    resolvedBy: string,
  ): { accepted: boolean; conflictId: string } {
    const now = new Date().toISOString();
    this.auditEventRepository.create({
      id: buildEntityId('audit_event'),
      eventType: 'CALIBRATION_CONFLICT_RESOLVED',
      actorId: resolvedBy,
      actorRoleIds: [],
      actorType: 'crm-user',
      resourceType: 'calibration-conflict',
      resourceId: conflictId,
      scopeSnapshot: {
        organizationIds: [],
        departmentIds: [],
        ownerIds: [],
        scopeSummary: '管理员收敛口径冲突',
      },
      riskLevel: 'LOW' as RiskLevel,
      reviewStatus: 'CONFIRMED',
      outcome: `口径冲突已收敛：${resolution}`,
      actionSummary: resolution || '管理员已裁定',
      sessionSnapshot: {
        conflictId,
        resolution,
        resolvedBy,
        resolvedAt: now,
      },
      createdAt: now,
    });

    this.logger.logStep('口径冲突已收敛', { conflictId, resolvedBy });

    return { accepted: true, conflictId };
  }

  /**
   * 沉淀候选看板模板。
   *
   * 规则：自由查询（非模板点击）成功执行 ≥ L 次，且至少 1 次正面反馈，
   * 且问题可归一化为模板化问法。
   *
   * 简化实现：从成功查询中识别高频自由查询，生成候选看板模板审计事件。
   */
  private sedimentDashboardTemplates(
    events: AuditEventRecord[],
  ): SedimentationCandidate[] {
    const successEvents = events.filter(
      (event) =>
        event.eventType === 'QUERY_SUCCEEDED' &&
        event.originalQuestion &&
        !event.relatedTemplateId, // 自由查询，非模板点击
    );

    const questionGroups = new Map<
      string,
      { question: string; queryIds: string[]; count: number }
    >();

    for (const event of successEvents) {
      const normalized = this.normalizeQuestion(event.originalQuestion!);
      const existing = questionGroups.get(normalized);
      if (existing) {
        existing.count++;
        if (event.relatedRequestId) {
          existing.queryIds.push(event.relatedRequestId);
        }
      } else {
        questionGroups.set(normalized, {
          question: event.originalQuestion!,
          queryIds: event.relatedRequestId ? [event.relatedRequestId] : [],
          count: 1,
        });
      }
    }

    // 获取正面反馈
    const positiveFeedbackQueryIds = new Set(
      events
        .filter(
          (event) =>
            event.eventType === 'ANALYSIS_RESULT_FEEDBACK' &&
            event.sessionSnapshot?.feedbackType === 'USEFUL',
        )
        .map((event) => event.sessionSnapshot?.queryId as string)
        .filter(Boolean),
    );

    const candidates: SedimentationCandidate[] = [];

    for (const [, group] of questionGroups) {
      if (group.count < this.config.dashboardTemplateMinSuccess) {
        continue;
      }
      const hasPositive = group.queryIds.some((id) =>
        positiveFeedbackQueryIds.has(id),
      );
      if (!hasPositive) {
        continue;
      }

      // 写入候选看板模板审计事件
      const templateId = buildEntityId('dashboard-template-candidate');
      const now = new Date().toISOString();
      this.auditEventRepository.create({
        id: buildEntityId('audit_event'),
        eventType: 'DASHBOARD_TEMPLATE_PROPOSED',
        actorId: 'system:sedimentation',
        actorRoleIds: [],
        actorType: 'system',
        resourceType: 'dashboard-template',
        resourceId: templateId,
        scopeSnapshot: {
          organizationIds: [],
          departmentIds: [],
          ownerIds: [],
          scopeSummary: '系统自动沉淀候选看板模板',
        },
        riskLevel: 'LOW' as RiskLevel,
        reviewStatus: 'PENDING',
        outcome: `候选看板模板已生成：${group.question.slice(0, 30)}`,
        actionSummary: `成功执行 ${group.count} 次，含正面反馈`,
        originalQuestion: group.question,
        sessionSnapshot: {
          templateId,
          questionText: group.question,
          successCount: group.count,
          hasPositiveFeedback: true,
          queryIds: group.queryIds.slice(0, 10),
        },
        createdAt: now,
      });

      candidates.push({
        candidateId: templateId,
        candidateType: 'DASHBOARD_TEMPLATE',
        name: `候选看板模板：${group.question.slice(0, 30)}`,
        confidence: Math.min(
          1,
          (group.count * (1 + 1)) / (group.count + 5),
        ),
        evidenceCount: group.count,
        derivedFromQueryIds: group.queryIds.slice(0, 10),
      });
    }

    return candidates;
  }
}

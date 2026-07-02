import { AnalysisResultFeedbackService } from '../../../src/modules/analysis/analysis-result-feedback.service';
import { KnowledgeSedimentationService } from '../../../src/modules/analysis/knowledge-sedimentation.service';
import { AuditEventRepository } from '../../../src/modules/audit/audit-event.repository';
import { AnalysisSemanticKnowledgeRepository } from '../../../src/modules/governance/analysis-semantic-knowledge.repository';
import { AnalysisLoggerService } from '../../../src/shared/logging/analysis-logger.service';
import { buildEntityId } from '../../../src/shared/utils/id.util';
import type {
  AuditEventRecord,
  AnalysisSemanticKnowledgeAssetRecord,
} from '../../../src/shared/types/domain';

function createMockLogger(): AnalysisLoggerService {
  return {
    logStep: jest.fn(),
    logInfo: jest.fn(),
    logWarn: jest.fn(),
    logError: jest.fn(),
    logDebug: jest.fn(),
  } as never;
}

function createMockAuditRepository(
  events: AuditEventRecord[] = [],
): AuditEventRepository {
  const store = [...events];
  return {
    create: jest.fn((event: AuditEventRecord) => {
      store.unshift(event);
      return event;
    }),
    list: jest.fn(() => [...store]),
  } as never;
}

function createMockKnowledgeRepository(
  assets: AnalysisSemanticKnowledgeAssetRecord[] = [],
): AnalysisSemanticKnowledgeRepository {
  const store = [...assets];
  return {
    listDraftAll: jest.fn(() => [...store]),
    listPublishedAll: jest.fn(() => [...store]),
    listPublishedActive: jest.fn(() => store.filter((a) => a.status === 'ACTIVE')),
    findDraftById: jest.fn((id: string) => store.find((a) => a.id === id)),
    saveDraft: jest.fn((record: AnalysisSemanticKnowledgeAssetRecord) => {
      const idx = store.findIndex((a) => a.id === record.id);
      if (idx >= 0) store[idx] = record;
      else store.unshift(record);
      return record;
    }),
    replacePublishedAssets: jest.fn(),
    listPublications: jest.fn(() => []),
    findPublicationByVersion: jest.fn(),
    savePublication: jest.fn(),
  } as never;
}

function createScopeSnapshot() {
  return {
    organizationIds: [],
    departmentIds: [],
    ownerIds: [],
    scopeSummary: '测试权限范围',
  };
}

function createQuerySucceededEvent(
  question: string,
  queryId: string,
  resultKindHint?: string,
): AuditEventRecord {
  return {
    id: buildEntityId('audit_event'),
    eventType: 'QUERY_SUCCEEDED',
    actorId: 'test-user',
    actorRoleIds: [],
    scopeSnapshot: createScopeSnapshot(),
    riskLevel: 'LOW',
    reviewStatus: 'IGNORED',
    outcome: '查询成功',
    originalQuestion: question,
    relatedRequestId: queryId,
    sessionSnapshot: resultKindHint ? { resultKindHint } : undefined,
    createdAt: new Date().toISOString(),
  };
}

function createFeedbackEvent(
  queryId: string,
  feedbackType: string,
): AuditEventRecord {
  return {
    id: buildEntityId('audit_event'),
    eventType: 'ANALYSIS_RESULT_FEEDBACK',
    actorId: 'test-user',
    actorRoleIds: [],
    scopeSnapshot: createScopeSnapshot(),
    riskLevel: 'LOW',
    reviewStatus: 'IGNORED',
    outcome: '用户反馈',
    resourceId: queryId,
    sessionSnapshot: { queryId, feedbackType },
    createdAt: new Date().toISOString(),
  };
}

function createClarificationEvent(
  question: string,
  queryId: string,
): AuditEventRecord {
  return {
    id: buildEntityId('audit_event'),
    eventType: 'CLARIFICATION_REQUESTED',
    actorId: 'test-user',
    actorRoleIds: [],
    scopeSnapshot: createScopeSnapshot(),
    riskLevel: 'LOW',
    reviewStatus: 'IGNORED',
    outcome: '需要补问',
    originalQuestion: question,
    relatedRequestId: queryId,
    createdAt: new Date().toISOString(),
  };
}

describe('AnalysisResultFeedbackService', () => {
  it('应记录 USEFUL 反馈并写入审计', () => {
    const auditRepo = createMockAuditRepository();
    const logger = createMockLogger();
    const service = new AnalysisResultFeedbackService(auditRepo, logger);

    const result = service.submitFeedback({
      queryId: 'query_test_001',
      feedbackType: 'USEFUL',
      feedbackSource: 'WEB',
      actorId: 'user_001',
      actorDisplayName: '测试用户',
      channel: 'web-console',
      scopeSnapshot: createScopeSnapshot(),
    });

    expect(result.accepted).toBe(true);
    expect(result.feedbackType).toBe('USEFUL');
    expect(auditRepo.create).toHaveBeenCalledTimes(1);
    const createdEvent = (auditRepo.create as jest.Mock).mock.calls[0][0];
    expect(createdEvent.eventType).toBe('ANALYSIS_RESULT_FEEDBACK');
    expect(createdEvent.sessionSnapshot.feedbackType).toBe('USEFUL');
    expect(createdEvent.sessionSnapshot.queryId).toBe('query_test_001');
  });

  it('应记录 CALIBRATION_ISSUE 反馈并附带反馈文本', () => {
    const auditRepo = createMockAuditRepository();
    const logger = createMockLogger();
    const service = new AnalysisResultFeedbackService(auditRepo, logger);

    const result = service.submitFeedback({
      queryId: 'query_test_002',
      feedbackType: 'CALIBRATION_ISSUE',
      feedbackText: '商机数量和CRM页面不一致',
      feedbackSource: 'WECOM_FEEDBACK_EVENT',
      actorId: 'wecom_user_001',
      actorExternalId: 'wecom_id_001',
      channel: 'wecom-bot',
      scopeSnapshot: createScopeSnapshot(),
    });

    expect(result.accepted).toBe(true);
    const createdEvent = (auditRepo.create as jest.Mock).mock.calls[0][0];
    expect(createdEvent.sessionSnapshot.feedbackText).toBe('商机数量和CRM页面不一致');
    expect(createdEvent.sessionSnapshot.feedbackSource).toBe('WECOM_FEEDBACK_EVENT');
  });
});

describe('KnowledgeSedimentationService', () => {
  it('沉淀器关闭时应返回空结果', () => {
    const auditRepo = createMockAuditRepository();
    const knowledgeRepo = createMockKnowledgeRepository();
    const logger = createMockLogger();
    const service = new KnowledgeSedimentationService(auditRepo, knowledgeRepo, logger, {
      enabled: false,
      validatedExampleMinSuccess: 3,
      negativeExampleMinFailure: 2,
      aliasMinVariations: 2,
      dashboardTemplateMinSuccess: 5,
      dashboardTemplateMinPositiveFeedback: 1,
      calibrationConflictMinOccurrences: 2,
      candidateExpiresInDays: 30,
    });

    const result = service.runSedimentation('manual', 24);

    expect(result.generatedCandidates).toEqual([]);
    expect(result.skippedReasons).toContain('sedimentation-disabled');
  });

  it('同一问题成功执行 ≥ 3 次且无负面反馈应生成候选正例', () => {
    const events: AuditEventRecord[] = [
      createQuerySucceededEvent('本月各销售负责人新增商机金额排名', 'q1', 'owner-ranking'),
      createQuerySucceededEvent('本月各销售负责人新增商机金额排名', 'q2', 'owner-ranking'),
      createQuerySucceededEvent('本月各销售负责人新增商机金额排名', 'q3', 'owner-ranking'),
    ];
    const auditRepo = createMockAuditRepository(events);
    const knowledgeRepo = createMockKnowledgeRepository();
    const logger = createMockLogger();
    const service = new KnowledgeSedimentationService(auditRepo, knowledgeRepo, logger);

    const result = service.runSedimentation('manual', 24);

    const validatedCandidates = result.generatedCandidates.filter(
      (c) => c.candidateType === 'VALIDATED_EXAMPLE',
    );
    expect(validatedCandidates).toHaveLength(1);
    expect(validatedCandidates[0].evidenceCount).toBe(3);
    expect(validatedCandidates[0].confidence).toBeGreaterThan(0.7);
    expect(validatedCandidates[0].derivedFromQueryIds).toContain('q1');
  });

  it('有负面反馈的问题不应生成候选正例', () => {
    const events: AuditEventRecord[] = [
      createQuerySucceededEvent('本月商机情况', 'q1'),
      createQuerySucceededEvent('本月商机情况', 'q2'),
      createQuerySucceededEvent('本月商机情况', 'q3'),
      createFeedbackEvent('q1', 'NOT_USEFUL'),
    ];
    const auditRepo = createMockAuditRepository(events);
    const knowledgeRepo = createMockKnowledgeRepository();
    const logger = createMockLogger();
    const service = new KnowledgeSedimentationService(auditRepo, knowledgeRepo, logger);

    const result = service.runSedimentation('manual', 24);

    const validatedCandidates = result.generatedCandidates.filter(
      (c) => c.candidateType === 'VALIDATED_EXAMPLE',
    );
    expect(validatedCandidates).toHaveLength(0);
  });

  it('同一问题被补问 ≥ 2 次应生成候选负例', () => {
    const events: AuditEventRecord[] = [
      createClarificationEvent('看一下商机转化怎么样', 'q1'),
      createClarificationEvent('看一下商机转化怎么样', 'q2'),
    ];
    const auditRepo = createMockAuditRepository(events);
    const knowledgeRepo = createMockKnowledgeRepository();
    const logger = createMockLogger();
    const service = new KnowledgeSedimentationService(auditRepo, knowledgeRepo, logger);

    const result = service.runSedimentation('manual', 24);

    const negativeCandidates = result.generatedCandidates.filter(
      (c) => c.candidateType === 'NEGATIVE_EXAMPLE',
    );
    expect(negativeCandidates).toHaveLength(1);
    expect(negativeCandidates[0].evidenceCount).toBe(2);
  });

  it('候选生成应写入草稿表且 reviewStatus 为 PROPOSED', () => {
    const events: AuditEventRecord[] = [
      createQuerySucceededEvent('本月商机趋势分析', 'q1'),
      createQuerySucceededEvent('本月商机趋势分析', 'q2'),
      createQuerySucceededEvent('本月商机趋势分析', 'q3'),
    ];
    const auditRepo = createMockAuditRepository(events);
    const knowledgeRepo = createMockKnowledgeRepository();
    const logger = createMockLogger();
    const service = new KnowledgeSedimentationService(auditRepo, knowledgeRepo, logger);

    service.runSedimentation('manual', 24);

    expect(knowledgeRepo.saveDraft).toHaveBeenCalled();
    const savedAsset = (knowledgeRepo.saveDraft as jest.Mock).mock.calls[0][0];
    expect(savedAsset.source).toBe('AUTO_DERIVED');
    expect(savedAsset.reviewStatus).toBe('PROPOSED');
    expect(savedAsset.status).toBe('INACTIVE');
    expect(savedAsset.confidence).toBeGreaterThan(0);
    expect(savedAsset.evidenceCount).toBe(3);
    expect(savedAsset.expiresAt).toBeDefined();
  });

  it('已被驳回的候选不应重复生成', () => {
    const existingAsset: AnalysisSemanticKnowledgeAssetRecord = {
      id: 'existing_001',
      type: 'VALIDATED_EXAMPLE',
      name: '候选正例：已驳回',
      status: 'INACTIVE',
      matchKeywords: ['商机'],
      questionText: '本月商机趋势分析',
      sqlHint: 'resultKind=time-trend',
      updatedBy: 'admin',
      updatedAt: new Date().toISOString(),
      source: 'AUTO_DERIVED',
      reviewStatus: 'REJECTED',
      evidenceCount: 3,
      confidence: 0.75,
      proposedAt: new Date().toISOString(),
    };
    const events: AuditEventRecord[] = [
      createQuerySucceededEvent('本月商机趋势分析', 'q1'),
      createQuerySucceededEvent('本月商机趋势分析', 'q2'),
      createQuerySucceededEvent('本月商机趋势分析', 'q3'),
    ];
    const auditRepo = createMockAuditRepository(events);
    const knowledgeRepo = createMockKnowledgeRepository([existingAsset]);
    const logger = createMockLogger();
    const service = new KnowledgeSedimentationService(auditRepo, knowledgeRepo, logger);

    const result = service.runSedimentation('manual', 24);

    const validatedCandidates = result.generatedCandidates.filter(
      (c) => c.candidateType === 'VALIDATED_EXAMPLE',
    );
    expect(validatedCandidates).toHaveLength(0);
  });

  it('同一术语被解析成不同口径应生成口径冲突待办', () => {
    const events: AuditEventRecord[] = [
      createQuerySucceededEvent('新增商机分析', 'q1', 'owner-ranking'),
      createQuerySucceededEvent('新增商机分析', 'q2', 'time-trend'),
    ];
    const auditRepo = createMockAuditRepository(events);
    const knowledgeRepo = createMockKnowledgeRepository();
    const logger = createMockLogger();
    const service = new KnowledgeSedimentationService(auditRepo, knowledgeRepo, logger);

    const result = service.runSedimentation('manual', 24);

    const conflictCandidates = result.generatedCandidates.filter(
      (c) => c.candidateType === 'CALIBRATION_CONFLICT',
    );
    expect(conflictCandidates).toHaveLength(1);
    // 口径冲突应写入审计 CALIBRATION_CONFLICT_DETECTED
    const auditCalls = (auditRepo.create as jest.Mock).mock.calls;
    const conflictEvent = auditCalls
      .map((call) => call[0])
      .find((event: AuditEventRecord) => event.eventType === 'CALIBRATION_CONFLICT_DETECTED');
    expect(conflictEvent).toBeDefined();
  });

  it('管理员审核通过候选应将 reviewStatus 改为 ACTIVE', () => {
    const existingAsset: AnalysisSemanticKnowledgeAssetRecord = {
      id: 'candidate_001',
      type: 'VALIDATED_EXAMPLE',
      name: '候选正例：测试',
      status: 'INACTIVE',
      matchKeywords: ['商机'],
      questionText: '本月商机情况',
      sqlHint: 'resultKind=owner-ranking',
      updatedBy: 'system:sedimentation',
      updatedAt: new Date().toISOString(),
      source: 'AUTO_DERIVED',
      reviewStatus: 'PROPOSED',
      evidenceCount: 3,
      confidence: 0.75,
      proposedAt: new Date().toISOString(),
    };
    const auditRepo = createMockAuditRepository();
    const knowledgeRepo = createMockKnowledgeRepository([existingAsset]);
    const logger = createMockLogger();
    const service = new KnowledgeSedimentationService(auditRepo, knowledgeRepo, logger);

    const result = service.reviewCandidate('candidate_001', 'APPROVE', 'admin_001', '问题问法清晰');

    expect(result.accepted).toBe(true);
    expect(result.reviewStatus).toBe('ACTIVE');
    expect(knowledgeRepo.saveDraft).toHaveBeenCalled();
    const updatedAsset = (knowledgeRepo.saveDraft as jest.Mock).mock.calls[0][0];
    expect(updatedAsset.reviewStatus).toBe('ACTIVE');
    expect(updatedAsset.status).toBe('ACTIVE');
    expect(updatedAsset.reviewedBy).toBe('admin_001');
    expect(updatedAsset.reviewedAt).toBeDefined();

    // 应写入 KNOWLEDGE_ASSET_APPROVED 审计
    const auditCalls = (auditRepo.create as jest.Mock).mock.calls;
    const approveEvent = auditCalls
      .map((call) => call[0])
      .find((event: AuditEventRecord) => event.eventType === 'KNOWLEDGE_ASSET_APPROVED');
    expect(approveEvent).toBeDefined();
  });

  it('管理员驳回候选应将 reviewStatus 改为 REJECTED', () => {
    const existingAsset: AnalysisSemanticKnowledgeAssetRecord = {
      id: 'candidate_002',
      type: 'NEGATIVE_EXAMPLE',
      name: '候选负例：测试',
      status: 'INACTIVE',
      matchKeywords: ['商机'],
      questionText: '看商机',
      blockReason: '缺少时间范围',
      updatedBy: 'system:sedimentation',
      updatedAt: new Date().toISOString(),
      source: 'AUTO_DERIVED',
      reviewStatus: 'PROPOSED',
      evidenceCount: 2,
      confidence: 0.5,
      proposedAt: new Date().toISOString(),
    };
    const auditRepo = createMockAuditRepository();
    const knowledgeRepo = createMockKnowledgeRepository([existingAsset]);
    const logger = createMockLogger();
    const service = new KnowledgeSedimentationService(auditRepo, knowledgeRepo, logger);

    const result = service.reviewCandidate('candidate_002', 'REJECT', 'admin_001', '问题太模糊');

    expect(result.accepted).toBe(true);
    expect(result.reviewStatus).toBe('REJECTED');
    const updatedAsset = (knowledgeRepo.saveDraft as jest.Mock).mock.calls[0][0];
    expect(updatedAsset.reviewStatus).toBe('REJECTED');
    expect(updatedAsset.status).toBe('INACTIVE');
  });

  it('listProposedCandidates 应只返回 PROPOSED 状态的候选', () => {
    const proposed: AnalysisSemanticKnowledgeAssetRecord = {
      id: 'p1',
      type: 'VALIDATED_EXAMPLE',
      name: '候选1',
      status: 'INACTIVE',
      matchKeywords: ['商机'],
      questionText: '测试',
      sqlHint: 'hint',
      updatedBy: 'system',
      updatedAt: new Date().toISOString(),
      source: 'AUTO_DERIVED',
      reviewStatus: 'PROPOSED',
    };
    const active: AnalysisSemanticKnowledgeAssetRecord = {
      id: 'a1',
      type: 'ALIAS',
      name: '已通过',
      status: 'ACTIVE',
      matchKeywords: ['销售'],
      canonicalLabel: '销售负责人',
      synonyms: ['销售'],
      hint: '提示',
      updatedBy: 'admin',
      updatedAt: new Date().toISOString(),
      reviewStatus: 'ACTIVE',
    };
    const auditRepo = createMockAuditRepository();
    const knowledgeRepo = createMockKnowledgeRepository([proposed, active]);
    const logger = createMockLogger();
    const service = new KnowledgeSedimentationService(auditRepo, knowledgeRepo, logger);

    const candidates = service.listProposedCandidates();

    expect(candidates).toHaveLength(1);
    expect(candidates[0].id).toBe('p1');
    expect(candidates[0].reviewStatus).toBe('PROPOSED');
  });
});

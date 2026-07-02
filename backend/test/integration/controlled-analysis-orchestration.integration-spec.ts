import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppStorageService } from '../../src/database/app-storage/app-storage.service';
import { AiGatewayService } from '../../src/modules/analysis/ai-gateway.service';
import { loginAs } from '../auth-test.helper';
import { createTestApp } from '../test-app';

describe('controlled analysis orchestration', () => {
  let app: INestApplication;
  let appStorageService: AppStorageService;
  let aiGatewayService: AiGatewayService;
  const originalDirectQueryFlag = process.env.AI_GUARDED_DIRECT_QUERY_ENABLED;
  const originalGroundedInsightTimeout = process.env.ANALYSIS_GROUNDED_INSIGHT_TIMEOUT_MS;

  beforeEach(async () => {
    process.env.AI_GUARDED_DIRECT_QUERY_ENABLED = 'true';
    app = await createTestApp();
    appStorageService = app.get(AppStorageService);
    aiGatewayService = app.get(AiGatewayService);
  });

  afterEach(async () => {
    if (originalDirectQueryFlag === undefined) {
      delete process.env.AI_GUARDED_DIRECT_QUERY_ENABLED;
    } else {
      process.env.AI_GUARDED_DIRECT_QUERY_ENABLED = originalDirectQueryFlag;
    }
    if (originalGroundedInsightTimeout === undefined) {
      delete process.env.ANALYSIS_GROUNDED_INSIGHT_TIMEOUT_MS;
    } else {
      process.env.ANALYSIS_GROUNDED_INSIGHT_TIMEOUT_MS = originalGroundedInsightTimeout;
    }
    await app.close();
  });

  it('受控直查请求应返回执行来源、快照与 grounded 洞察', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', cookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '本月各销售负责人新增商机金额排名',
        executionMode: 'GUARDED_DIRECT_QUERY',
      })
      .expect(201);

    expect(createResponse.body.status).toBe('RETURNED');

    const detailResponse = await request(app.getHttpServer())
      .get(`/api/v1/analysis/queries/${createResponse.body.queryId}`)
      .set('Cookie', cookies)
      .expect(200);

    expect(detailResponse.body.executionMode).toBe('GUARDED_DIRECT_QUERY');
    expect(detailResponse.body.executionSource).toBe('CRM_OFFICIAL_API');
    expect(detailResponse.body.groundedExplanation).toContain('仅基于本次结果包');
    expect(detailResponse.body.nextBestQuestions).toEqual(
      expect.arrayContaining([expect.stringContaining('继续')]),
    );
    expect(detailResponse.body.executionSnapshot).toEqual(
      expect.objectContaining({
        executionMode: 'GUARDED_DIRECT_QUERY',
        executionSource: 'CRM_OFFICIAL_API',
        fallbackReason: 'ai-unavailable-or-invalid',
      }),
    );
    expect(detailResponse.body.resultBundleSnapshot).toEqual(
      expect.objectContaining({
        consistencyToken: detailResponse.body.consistencyToken,
        rowCount: detailResponse.body.rowCount,
      }),
    );
    expect(detailResponse.body.insightSnapshot).toEqual(
      expect.objectContaining({
        grounded: true,
        reusedResultBundle: true,
      }),
    );

    const auditEvent = appStorageService.state.auditEvents.find(
      (item) => item.relatedRequestId === createResponse.body.queryId,
    );
    expect(auditEvent?.sessionSnapshot).toEqual(
      expect.objectContaining({
        entryInterpretationSnapshot: expect.objectContaining({
          targetWorkflow: 'ANALYSIS_QUERY_EXECUTION',
        }),
        executionSnapshot: expect.objectContaining({
          executionMode: 'GUARDED_DIRECT_QUERY',
        }),
      }),
    );
  });

  it('显式受控直查在 AI 可用时应优先采用 AI 生成的读取任务', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const directTaskSpy = jest.spyOn(
      aiGatewayService as unknown as {
        generateControlledDirectQueryTask: (params: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
      },
      'generateControlledDirectQueryTask',
    );
    directTaskSpy.mockResolvedValue({
      taskTitle: 'AI直查新增商机金额排名',
      resultKind: 'owner-ranking',
      sql: `SELECT o.user_id AS owner_id,
SUM(o.expect_amount) AS amount,
COUNT(o.id) AS count
FROM opportunities o
WHERE o.organization_id IN ('org_north')
AND o.created_at >= '2026-02-28T16:00:00.000Z'
AND o.created_at < '2026-03-31T16:00:00.000Z'
GROUP BY o.user_id
ORDER BY amount DESC
LIMIT 3`,
      tables: ['opportunities'],
      fieldEntries: [
        {
          table: 'opportunities',
          fields: ['user_id', 'expect_amount', 'organization_id', 'id', 'created_at'],
        },
      ],
      joinPaths: [],
      allowedFunctions: ['SUM', 'COUNT'],
      rowLimit: 3,
      timeoutMs: 2500,
    });

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', cookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '本月各销售负责人新增商机金额排名',
        executionMode: 'GUARDED_DIRECT_QUERY',
      })
      .expect(201);

    const detailResponse = await request(app.getHttpServer())
      .get(`/api/v1/analysis/queries/${createResponse.body.queryId}`)
      .set('Cookie', cookies)
      .expect(200);

    expect(detailResponse.body.executionMode).toBe('GUARDED_DIRECT_QUERY');
    expect(detailResponse.body.executionSnapshot.taskSnapshots[0].taskTitle).toBe(
      'AI直查新增商机金额排名',
    );
    expect(detailResponse.body.executionSnapshot.taskSnapshots[0].rowLimit).toBe(20);
    const requestRecord = appStorageService.state.analysisRequests.find(
      (item) => item.id === createResponse.body.queryId,
    );
    expect(requestRecord?.generatedQuery).toContain('AI直查新增商机金额排名');
    expect(requestRecord?.generatedQuery).toContain('FROM opportunities');
    expect(requestRecord?.generatedQuery).not.toContain('联软标准 OpenAPI /opportunities');
    expect(requestRecord?.generatedQuery).toContain(
      'adapter: crm-official-api.opportunity-owner-ranking',
    );
    expect(directTaskSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        temporalSlot: expect.objectContaining({
          rawText: '本月',
          startAt: '2026-02-28T16:00:00.000Z',
          endAt: '2026-03-31T16:00:00.000Z',
        }),
        knowledgeContextText: expect.stringContaining('模板与已验证示例'),
      }),
    );
    expect(detailResponse.body.executionSnapshot.taskSnapshots[0].temporalSlot).toEqual(
      expect.objectContaining({
        rawText: '本月',
        startAt: '2026-02-28T16:00:00.000Z',
        endAt: '2026-03-31T16:00:00.000Z',
      }),
    );
    expect(detailResponse.body.temporalScope).toEqual(
      expect.objectContaining({
        normalizedLabel: '本月',
        source: 'AI_TEMPORAL_SLOT',
      }),
    );
  });


  it('未传 executionMode 的自由问数请求应默认进入受控直查', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', cookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '本月各销售负责人新增商机金额排名',
      })
      .expect(201);

    const detailResponse = await request(app.getHttpServer())
      .get(`/api/v1/analysis/queries/${createResponse.body.queryId}`)
      .set('Cookie', cookies)
      .expect(200);

    expect(detailResponse.body.executionMode).toBe('GUARDED_DIRECT_QUERY');
    expect(detailResponse.body.executionSource).toBeTruthy();
  });

  it('客户端未传 executionMode 时，服务端应按 AI 理解结果决定进入受控直查', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const executionModeSpy = jest.spyOn(
      aiGatewayService as unknown as {
        suggestAnalysisExecutionMode: (params: Record<string, unknown>) => Promise<'PLAN_EXECUTION' | 'GUARDED_DIRECT_QUERY' | null>;
      },
      'suggestAnalysisExecutionMode',
    );
    executionModeSpy.mockResolvedValue('GUARDED_DIRECT_QUERY');

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', cookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '本月各销售负责人新增商机金额排名',
      })
      .expect(201);

    const detailResponse = await request(app.getHttpServer())
      .get(`/api/v1/analysis/queries/${createResponse.body.queryId}`)
      .set('Cookie', cookies)
      .expect(200);

    expect(detailResponse.body.executionMode).toBe('GUARDED_DIRECT_QUERY');
  });

  it('Web 解释型追问应复用上一轮结果包，不重新生成读取 SQL', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', cookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '本月各销售负责人新增商机金额排名',
      })
      .expect(201);
    const sourceDetailResponse = await request(app.getHttpServer())
      .get(`/api/v1/analysis/queries/${createResponse.body.queryId}`)
      .set('Cookie', cookies)
      .expect(200);

    const followUpResponse = await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', cookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '这说明什么？',
        followUpQueryId: createResponse.body.queryId,
      })
      .expect(201);

    expect(followUpResponse.body.status).toBe('RETURNED');
    const followUpDetailResponse = await request(app.getHttpServer())
      .get(`/api/v1/analysis/queries/${followUpResponse.body.queryId}`)
      .set('Cookie', cookies)
      .expect(200);

    expect(followUpDetailResponse.body.consistencyToken).toBe(
      sourceDetailResponse.body.consistencyToken,
    );
    expect(followUpDetailResponse.body.temporalScope).toEqual(
      sourceDetailResponse.body.temporalScope,
    );
    expect(followUpDetailResponse.body.groundedExplanation).toContain(
      '复用上一轮结果包',
    );
    const followUpRequest = appStorageService.state.analysisRequests.find(
      (item) => item.id === followUpResponse.body.queryId,
    );
    expect(followUpRequest?.generatedQuery).toBeUndefined();
    expect(followUpRequest?.executionSnapshot?.taskSnapshots).toHaveLength(0);
  });

  it('Web 解释型追问在关键词未命中时也应优先按统一 AI 判断复用结果包', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const followUpIntentSpy = jest.spyOn(
      aiGatewayService as unknown as {
        classifyAnalysisFollowUpIntent: (params: Record<string, unknown>) => Promise<'EXPLAIN_RESULT' | 'RUN_NEW_ANALYSIS' | null>;
      },
      'classifyAnalysisFollowUpIntent',
    );
    followUpIntentSpy.mockResolvedValue('EXPLAIN_RESULT');

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', cookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '本月各销售负责人新增商机金额排名',
      })
      .expect(201);

    const sourceDetailResponse = await request(app.getHttpServer())
      .get(`/api/v1/analysis/queries/${createResponse.body.queryId}`)
      .set('Cookie', cookies)
      .expect(200);

    const followUpResponse = await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', cookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '重点原因是什么',
        followUpQueryId: createResponse.body.queryId,
      })
      .expect(201);

    const followUpDetailResponse = await request(app.getHttpServer())
      .get(`/api/v1/analysis/queries/${followUpResponse.body.queryId}`)
      .set('Cookie', cookies)
      .expect(200);

    expect(followUpDetailResponse.body.consistencyToken).toBe(
      sourceDetailResponse.body.consistencyToken,
    );
    const followUpRequest = appStorageService.state.analysisRequests.find(
      (item) => item.id === followUpResponse.body.queryId,
    );
    expect(followUpRequest?.generatedQuery).toBeUndefined();
    expect(followUpRequest?.executionSnapshot?.taskSnapshots).toHaveLength(0);
  });

  it('Web 改条件追问应重新进入受控直查主链', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const followUpIntentSpy = jest.spyOn(
      aiGatewayService as unknown as {
        classifyAnalysisFollowUpIntent: (params: Record<string, unknown>) => Promise<'EXPLAIN_RESULT' | 'RUN_NEW_ANALYSIS' | null>;
      },
      'classifyAnalysisFollowUpIntent',
    );
    followUpIntentSpy.mockResolvedValue('RUN_NEW_ANALYSIS');

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', cookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '本月各销售负责人新增商机金额排名',
      })
      .expect(201);

    const followUpResponse = await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', cookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '再看近三个月趋势',
        followUpQueryId: createResponse.body.queryId,
      })
      .expect(201);

    const followUpDetailResponse = await request(app.getHttpServer())
      .get(`/api/v1/analysis/queries/${followUpResponse.body.queryId}`)
      .set('Cookie', cookies)
      .expect(200);

    expect(followUpDetailResponse.body.executionMode).toBe('GUARDED_DIRECT_QUERY');
    expect(followUpDetailResponse.body.temporalScope).toEqual(
      expect.objectContaining({
        rawText: '近三个月',
        source: 'AI_TEMPORAL_SLOT',
      }),
    );
    expect(followUpDetailResponse.body.executionSnapshot).toEqual(
      expect.objectContaining({
        executionMode: 'GUARDED_DIRECT_QUERY',
      }),
    );
  });

  it('Web 追问把时间改成一月份应按只读改条件查询处理', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const followUpIntentSpy = jest.spyOn(
      aiGatewayService as unknown as {
        classifyAnalysisFollowUpIntent: (params: Record<string, unknown>) => Promise<'EXPLAIN_RESULT' | 'RUN_NEW_ANALYSIS' | null>;
      },
      'classifyAnalysisFollowUpIntent',
    );
    followUpIntentSpy.mockResolvedValue('RUN_NEW_ANALYSIS');

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', cookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '本月各销售负责人新增商机金额排名',
      })
      .expect(201);

    const followUpResponse = await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', cookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '请把实际改成一月份',
        followUpQueryId: createResponse.body.queryId,
      })
      .expect(201);

    expect(followUpResponse.body.status).toBe('RETURNED');

    const followUpRequest = appStorageService.state.analysisRequests.find(
      (item) => item.id === followUpResponse.body.queryId,
    );
    expect(followUpRequest?.followUpToRequestId).toBe(createResponse.body.queryId);
    expect(followUpRequest?.questionText).toBe('请把实际改成一月份');
    expect(followUpRequest?.entryInterpretationSnapshot?.originalText).toContain(
      '本月各销售负责人新增商机金额排名',
    );
    expect(followUpRequest?.temporalSlot?.rawText).toBe('一月份');
  });

  it('普通分析会话超过失活时长后，Web 追问不应继续复用旧结果上下文', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    appStorageService.state.aiContextPolicy.analysisSessionIdleTimeoutSeconds = 60;

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', cookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '本月各销售负责人新增商机金额排名',
      })
      .expect(201);

    const sourceRequest = appStorageService.state.analysisRequests.find(
      (item) => item.id === createResponse.body.queryId,
    );
    const sourceResult = appStorageService.state.analysisResults.find(
      (item) => item.requestId === createResponse.body.queryId,
    );
    expect(sourceRequest).toBeDefined();
    expect(sourceResult).toBeDefined();

    sourceRequest!.completedAt = '2026-04-27T09:00:00.000Z';
    sourceResult!.returnedAt = '2026-04-27T09:00:00.000Z';

    const followUpResponse = await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', cookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '这说明什么？',
        followUpQueryId: createResponse.body.queryId,
      })
      .expect(201);

    expect(followUpResponse.body.status).toBe('CLARIFICATION_REQUIRED');
    expect(followUpResponse.body.clarificationPrompt).toContain('上一轮分析上下文已失效');
  });

  it('AI 可用时应优先采用 grounded AI 洞察结果', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const groundedInsightSpy = jest.spyOn(
      aiGatewayService as unknown as {
        generateGroundedAnalysisInsight: (params: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
      },
      'generateGroundedAnalysisInsight',
    );
    groundedInsightSpy.mockResolvedValue({
      groundedExplanation: 'AI洞察：王敏当前暂列第一，主要由苏州区域项目推进拉动。',
      nextBestQuestions: ['继续看苏州区域近三个月趋势', '继续看王敏名下重点项目明细'],
      packCode: 'grounded-explanation-pack',
      packVersion: 'test-fixture',
    });

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', cookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '本月各销售负责人新增商机金额排名',
      })
      .expect(201);

    const detailResponse = await request(app.getHttpServer())
      .get(`/api/v1/analysis/queries/${createResponse.body.queryId}`)
      .set('Cookie', cookies)
      .expect(200);

    expect(detailResponse.body.groundedExplanation).toBe(
      'AI洞察：王敏当前暂列第一，主要由苏州区域项目推进拉动。',
    );
    expect(detailResponse.body.nextBestQuestions).toEqual([
      '继续看苏州区域近三个月趋势',
      '继续看王敏名下重点项目明细',
    ]);
    expect(detailResponse.body.insightSnapshot).toEqual(
      expect.objectContaining({
        packCode: 'grounded-explanation-pack',
        packVersion: 'test-fixture',
      }),
    );
  });

  it('grounded 洞察超时时应快速回退模板解释，而不是长期阻塞结果交付', async () => {
    process.env.ANALYSIS_GROUNDED_INSIGHT_TIMEOUT_MS = '50';
    const cookies = await loginAs(app, 'user_sales_director');
    const groundedInsightSpy = jest.spyOn(
      aiGatewayService as unknown as {
        generateGroundedAnalysisInsight: (params: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
      },
      'generateGroundedAnalysisInsight',
    );
    groundedInsightSpy.mockImplementation(
      async () =>
        await new Promise<Record<string, unknown>>(() => {
          // 模拟上游 provider 卡住不返回。
        }),
    );

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', cookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '本月各销售负责人新增商机金额排名',
      })
      .expect(201);

    const detailResponse = await request(app.getHttpServer())
      .get(`/api/v1/analysis/queries/${createResponse.body.queryId}`)
      .set('Cookie', cookies)
      .expect(200);

    expect(detailResponse.body.groundedExplanation).toContain('仅基于本次结果包');
    expect(detailResponse.body.insightSnapshot).toEqual(
      expect.objectContaining({
        failureReason: 'grounded-explanation-timeout',
      }),
    );
  });
});

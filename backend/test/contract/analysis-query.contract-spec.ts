import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppStorageService } from '../../src/database/app-storage/app-storage.service';
import { loginAs } from '../auth-test.helper';
import { createTestApp } from '../test-app';

describe('analysis query contract', () => {
  let app: INestApplication;
  let appStorageService: AppStorageService;

  beforeAll(async () => {
    app = await createTestApp();
    appStorageService = app.get(AppStorageService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('能力快照应返回分析范围模式摘要', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const response = await request(app.getHttpServer())
      .get('/api/v1/analysis/capabilities')
      .set('Cookie', cookies)
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        analysisScopeMode: expect.stringMatching(/FULL_ANALYSIS_SCOPE|DEPARTMENT_ANALYSIS_SCOPE/),
        analysisScopeSummary: expect.any(String),
      }),
    );
  });

  it('未指定时间范围时应按当前权限全量范围直接分析', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const response = await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', cookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '看一下商机转化怎么样',
      })
      .expect(201);

    expect(response.body.status).toBe('RETURNED');
    expect(response.body.clarificationPrompt).toBeUndefined();
  });

  it('条件完整时应返回分析请求标识', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const response = await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', cookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '本月各销售负责人新增商机金额排名',
      })
      .expect(201);

    expect(response.body.queryId).toBeTruthy();
    expect(response.body.status).toBe('RETURNED');
  });

  it('结果详情契约应先暴露执行来源与结果包快照，再通过二阶段接口补齐 grounded 洞察字段', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const response = await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', cookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '本月各销售负责人新增商机金额排名',
      })
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/analysis/queries/${response.body.queryId}`)
      .set('Cookie', cookies)
      .expect(200);

    expect(detail.body.executionMode).toBe('PLAN_EXECUTION');
    expect(detail.body.executionSource).toBeTruthy();
    expect(detail.body.matchedAdapter).toBeTruthy();
    expect(detail.body.executionSnapshot.taskSnapshots[0]).toEqual(
      expect.objectContaining({
        rowLimit: expect.any(Number),
        timeoutMs: expect.any(Number),
        toolId: expect.any(String),
      }),
    );
    expect(detail.body.resultBundleSnapshot).toEqual(
      expect.objectContaining({
        consistencyToken: detail.body.consistencyToken,
      }),
    );

    const reportResponse = await request(app.getHttpServer())
      .post(`/api/v1/analysis/queries/${response.body.queryId}/report`)
      .set('Cookie', cookies)
      .send({ waitMs: 12000 })
      .expect(200);

    expect(reportResponse.body.status).toBe('READY');
    expect(reportResponse.body.report).toEqual(
      expect.objectContaining({
        analysisConfidence: expect.stringMatching(/HIGH|MEDIUM|LOW/),
        trendInsight: expect.any(Object),
        forecastInsight: expect.any(Object),
        anomalyInsights: expect.any(Array),
        riskInsights: expect.any(Array),
        recommendations: expect.any(Array),
        workbenchMarkdown: expect.any(String),
        detailMarkdown: expect.any(String),
        wecomMarkdown: expect.any(String),
      }),
    );
    expect(detail.body.groundedExplanation).toContain('仅基于本次结果包');
    expect(Array.isArray(detail.body.nextBestQuestions)).toBe(true);
    expect(reportResponse.body.groundedMarkdown).toContain('## 执行摘要');
    expect(reportResponse.body.report.detailMarkdown).toContain('## 趋势预测');
  });

  it('结果详情契约应暴露统一执行轨迹摘要、来源说明和脚注说明', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const response = await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', cookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '最近四个月山东区商机额趋势',
      })
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/analysis/queries/${response.body.queryId}`)
      .set('Cookie', cookies)
      .expect(200);

    expect(detail.body.executionTraceSummary).toEqual(
      expect.objectContaining({
        normalizedQuestion: expect.any(String),
        consistencyToken: detail.body.consistencyToken,
        knowledgeHits: expect.arrayContaining([
          expect.objectContaining({
            source: expect.any(String),
            name: expect.any(String),
          }),
        ]),
        taskSummaries: expect.arrayContaining([
          expect.objectContaining({
            taskId: expect.any(String),
            taskTitle: expect.any(String),
            resultKind: expect.any(String),
            executionSource: expect.any(String),
          }),
        ]),
      }),
    );
    expect(detail.body.report.executionTraceSummary).toEqual(
      expect.objectContaining({
        consistencyToken: detail.body.consistencyToken,
      }),
    );
    expect(detail.body.report.sourceNotes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: expect.any(String),
          label: expect.any(String),
          description: expect.any(String),
        }),
      ]),
    );
    expect(detail.body.report.footnotes).toEqual(
      expect.arrayContaining([expect.any(String)]),
    );
    expect(detail.body.report.sections.some((item: any) => Array.isArray(item.sourceNotes))).toBe(true);
  });

  it.each(['今日', '今天', '明日', '明天', '后天', '本月', '当月'])(
    '应识别 %s 这类时间表达并直接进入分析',
    async (timeKeyword) => {
      const cookies = await loginAs(app, 'user_sales_director');
      const response = await request(app.getHttpServer())
        .post('/api/v1/analysis/queries')
        .set('Cookie', cookies)
        .send({
          querySource: 'FREE_TEXT',
          channel: 'web-console',
          questionText: `${timeKeyword}各销售负责人新增商机金额排名`,
        })
        .expect(201);

      expect(response.body.status).toBe('RETURNED');
      expect(response.body.clarificationPrompt).toBeUndefined();
      expect(response.body.queryId).toBeTruthy();
    },
  );

  it('低置信时间表达应进入补问路径且不生成查询结果', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const response = await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', cookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '从那段时间开始看一下商机情况',
      })
      .expect(201);

    expect(response.body.status).toBe('CLARIFICATION_REQUIRED');
    expect(response.body.missingConditions).toContain('时间范围');
    const requestRecord = appStorageService.state.analysisRequests.find(
      (item) => item.id === response.body.queryId,
    );
    expect(requestRecord?.generatedQuery).toBeUndefined();
  });

  it('负责人经营详细分析应通过统一结果包暴露 richer report 区块和派生指标', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const response = await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', cookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '最近一年各销售负责人新增商机金额排名，请做详细分析总结',
      })
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/analysis/queries/${response.body.queryId}`)
      .set('Cookie', cookies)
      .expect(200);

    expect(detail.body.report.sections.map((item: { sectionType: string }) => item.sectionType)).toEqual(
      expect.arrayContaining([
        'summary',
        'metric-strip',
        'trend',
        'distribution',
        'risk',
        'focus-list',
        'detail-table',
        'actions',
      ]),
    );
    expect(detail.body.report.missingSections ?? []).toEqual([]);
    expect(detail.body.executionSnapshot.taskSnapshots).toHaveLength(5);
    expect(detail.body.metricCards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'TOP1贡献占比' }),
        expect.objectContaining({ name: 'TOP3贡献占比' }),
        expect.objectContaining({ name: '平均单笔商机金额' }),
        expect.objectContaining({ name: '第一名领先第二名差距' }),
      ]),
    );
  });
});

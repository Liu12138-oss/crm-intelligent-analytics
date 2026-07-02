import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { loginAs } from '../auth-test.helper';
import { createTestApp } from '../test-app';

describe('query template execution integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('模板查询应直接返回 resultBundle，并可关闭 AI 报告', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const response = await request(app.getHttpServer())
      .post('/api/v1/analysis/templates/tpl_company_2026_completion/execute')
      .set('Cookie', cookies)
      .send({ parameters: { year: 2026 }, includeAiReport: false })
      .expect(201);

    expect(response.body.queryId).toEqual(expect.any(String));
    expect(response.body.resultBundle.metricCards.length).toBeGreaterThan(0);
    expect(response.body.insightBundle.status).toBe('SKIPPED');
    expect(response.body.scopeExecution).toEqual(
      expect.objectContaining({
        analysisScopeMode: 'DEPARTMENT_ANALYSIS_SCOPE',
        templateScopeMode: expect.stringMatching(/AUTO_SCOPE|DECLARED_SCOPE/),
      }),
    );
  });

  it('图表模板应先快速返回数据结果，再异步补齐 AI richer report', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const response = await request(app.getHttpServer())
      .post('/api/v1/analysis/templates/tpl_company_2026_completion/execute')
      .set('Cookie', cookies)
      .send({ parameters: { year: 2026 }, includeAiReport: true })
      .expect(201);

    expect(response.body.resultBundle.primaryBlock).toEqual(
      expect.objectContaining({
        viewType: 'BAR_CHART',
        rows: expect.any(Array),
        series: expect.any(Array),
        columns: expect.any(Array),
      }),
    );
    expect(response.body.resultBundle.primaryBlock.series[0]).toEqual(
      expect.objectContaining({
        label: '大北区-北区金融部',
        value: expect.any(Number),
      }),
    );
    expect(response.body.queryId).toEqual(expect.any(String));
    expect(response.body.resultBundle.metricCards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: '全年目标',
          value: '10,600 万元',
        }),
      ]),
    );
    expect(response.body.insightBundle.status).toBe('PENDING');

    let reportResponse: request.Response | undefined;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      reportResponse = await request(app.getHttpServer())
        .post(`/api/v1/analysis/queries/${response.body.queryId}/report`)
        .set('Cookie', cookies)
        .send({ waitMs: 12000 })
        .expect(200);
      if (reportResponse.body.status === 'READY') {
        break;
      }
    }

    expect(reportResponse).toBeDefined();
    if (!reportResponse) {
      throw new Error('report polling failed');
    }

    expect(reportResponse.body.status).toBe('READY');
    expect(reportResponse.body.report).toEqual(
      expect.objectContaining({
        analysisConfidence: expect.stringMatching(/HIGH|MEDIUM|LOW/),
        trendInsight: expect.any(Object),
        forecastInsight: expect.any(Object),
        recommendations: expect.any(Array),
        detailMarkdown: expect.any(String),
      }),
    );
    expect(String(reportResponse.body.report.detailMarkdown ?? '')).toContain('## 趋势预测');
    expect(reportResponse.body.report.tableBlocks[0].columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: expect.any(String), label: expect.any(String) }),
      ]),
    );
  });

  it('非只读 SQL 模板应被校验拦截', async () => {
    const adminCookies = await loginAs(app, 'user_admin');
    const response = await request(app.getHttpServer())
      .post('/api/v1/governance/query-templates')
      .set('Cookie', adminCookies)
      .send({
        name: '非法写入模板',
        description: '用于验证只读 SQL 拦截',
        defaultQuestionText: '非法写入模板',
        defaultFilters: {},
        defaultViewType: 'DETAIL_TABLE',
        sqlText: 'UPDATE customers SET name = :name',
        visibleRoleIds: ['role_sales_director'],
        displayOrder: 99,
        status: 'ACTIVE',
      })
      .expect(400);

    expect(response.body.message).toContain('只允许查询 SQL');
  });

  it('模板空结果应先返回空态块', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const response = await request(app.getHttpServer())
      .post('/api/v1/analysis/templates/tpl_company_weekly_new_opportunity/execute')
      .set('Cookie', cookies)
      .send({ parameters: { days: 2 }, includeAiReport: false })
      .expect(201);

    expect(response.body.resultBundle.emptyStateBlock).toEqual(
      expect.objectContaining({
        title: '当前条件下未查到数据',
        reason: expect.any(String),
        suggestions: expect.any(Array),
      }),
    );
  });

  it('模板执行返回的真实 queryId 应支持直接导出', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const executed = await request(app.getHttpServer())
      .post('/api/v1/analysis/templates/tpl_company_weekly_new_opportunity/execute')
      .set('Cookie', cookies)
      .send({ parameters: { days: 7 }, includeAiReport: true })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/analysis/queries/${executed.body.queryId}/exports`)
      .set('Cookie', cookies)
      .send({ format: 'csv' })
      .expect(201)
      .expect(({ body }) => {
        expect(body.status).toBe('COMPLETED');
        expect(body.fileName).toContain('.csv');
        expect(body.mimeType).toBe('text/csv;charset=utf-8');
        expect(String(body.content)).toContain('团队');
      });
  });
});

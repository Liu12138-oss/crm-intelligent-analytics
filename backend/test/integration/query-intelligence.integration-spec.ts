import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { loginAs } from '../auth-test.helper';
import { createTestApp } from '../test-app';

describe('query intelligence integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('应对非 CRM 问题返回友好拦截提示', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const response = await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', cookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '今天天气怎么样',
      })
      .expect(201);

    expect(response.body.status).toBe('BLOCKED');
    expect(response.body.clarificationPrompt).toContain('CRM 智能分析');
  });

  it('应阻断写入型自然语言请求', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const response = await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', cookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '把这个商机改成已成交',
      })
      .expect(201);

    expect(response.body.status).toBe('BLOCKED');
    expect(response.body.clarificationPrompt).toContain('受控问数');
  });

  it('复合分析问题应返回多任务报告结构', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const created = await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', cookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '本季度各销售负责人新增商机金额排名和趋势',
      })
      .expect(201);

    expect(created.body.status).toBe('RETURNED');

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/analysis/queries/${created.body.queryId}`)
      .set('Cookie', cookies)
      .expect(200);

    expect(detail.body.report.reportTitle).toContain('新增商机金额');
    expect(detail.body.report.datasetReferences.length).toBeGreaterThan(1);
    expect(detail.body.report.chartBlocks.length).toBeGreaterThan(0);
  });
});

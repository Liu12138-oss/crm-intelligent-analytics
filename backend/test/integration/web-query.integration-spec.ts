import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { loginAs } from '../auth-test.helper';
import { createTestApp } from '../test-app';

describe('web query integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Web 问数后应可获取结构化结果详情', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const created = await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', cookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '本月各销售负责人新增商机金额排名',
      })
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/analysis/queries/${created.body.queryId}`)
      .set('Cookie', cookies)
      .expect(200);

    expect(detail.body.title).toContain('新增商机金额');
    expect(detail.body.metricCards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: '累计金额' }),
        expect.objectContaining({ name: '命中商机数' }),
        expect.objectContaining({ name: 'TOP1贡献占比' }),
        expect.objectContaining({ name: '平均单笔商机金额' }),
      ]),
    );
    expect(detail.body.tableRows.length).toBeGreaterThan(0);
  });

  it('最近一年负责人排名不应再提示缺少时间范围，且应返回 3 个负责人', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const created = await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', cookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '最近一年各销售负责人新增商机金额排名',
      })
      .expect(201);

    expect(created.body.status).toBe('RETURNED');

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/analysis/queries/${created.body.queryId}`)
      .set('Cookie', cookies)
      .expect(200);

    expect(
      detail.body.appliedFilters.some(
        (item: { label: string; value: string }) => item.value.includes('最近一年'),
      ),
    ).toBe(true);
    expect(detail.body.tableRows).toHaveLength(3);
  });

  it('Web 问数详情应返回统一 AI 入口理解快照与程序路由快照', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const created = await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', cookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '本月各销售负责人新增商机金额排名',
      })
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/analysis/queries/${created.body.queryId}`)
      .set('Cookie', cookies)
      .expect(200);

    expect(detail.body.entryInterpretationSnapshot).toMatchObject({
      channel: 'web-console',
      scene: 'WEB_ANALYSIS_QUERY',
      targetWorkflow: 'ANALYSIS_QUERY_EXECUTION',
      usedFallback: false,
      language: 'zh-CN',
    });
    expect(detail.body.workflowRoutingSnapshot).toMatchObject({
      targetWorkflow: 'ANALYSIS_QUERY_EXECUTION',
      finalProgram: 'analysis-workflow-orchestrator.run',
      gateResult: 'BYPASSED',
    });
  });
});

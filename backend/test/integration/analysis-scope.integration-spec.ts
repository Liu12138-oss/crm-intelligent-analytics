import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { loginAs } from '../auth-test.helper';
import { createTestApp } from '../test-app';

describe('analysis scope integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('摘要、图表与表格应共享同一结果口径', async () => {
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

    expect(detail.body.consistencyToken).toContain(created.body.queryId);
    expect(detail.body.primaryView.series.length).toBe(detail.body.tableRows.length);
  });

  it('管理员问负责人经营主题时不得被登录快照中的单部门错误收窄', async () => {
    const cookies = await loginAs(app, 'user_admin');
    const created = await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', cookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '最近一年各销售负责人新增商机金额排名，请做详细分析总结',
      })
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/analysis/queries/${created.body.queryId}`)
      .set('Cookie', cookies)
      .expect(200);

    expect(detail.body.scopeSummary).toContain('管理员视角');
    expect(detail.body.tableRows).toHaveLength(3);
    expect(detail.body.executionSnapshot.scopeSnapshot.departmentIds).toEqual([]);
    expect(detail.body.executionSnapshot.scopeSnapshot.ownerIds).toEqual([]);
  });
});

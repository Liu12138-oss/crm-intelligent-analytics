import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { loginAs } from '../auth-test.helper';
import { createTestApp } from '../test-app';

describe('analysis scope contract', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('部门级用户返回结果应保持在授权范围内', async () => {
    const cookies = await loginAs(app, 'user_region_manager');
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

    expect(detail.body.scopeSummary).toContain('区域经理');
    expect(detail.body.tableRows).toHaveLength(1);
  });
});

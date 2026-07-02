import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { loginAs } from '../auth-test.helper';
import { createTestApp } from '../test-app';

describe('export policy integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('无导出权限的用户应被拦截', async () => {
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

    const exported = await request(app.getHttpServer())
      .post(`/api/v1/analysis/queries/${created.body.queryId}/exports`)
      .set('Cookie', cookies)
      .send({ format: 'xlsx' })
      .expect(201);

    expect(exported.body.status).toBe('BLOCKED');
  });

  it('撤销 analysis.export 后导出应立即失效', async () => {
    const adminCookies = await loginAs(app, 'user_admin');
    const cookies = await loginAs(app, 'user_sales_director');

    await request(app.getHttpServer())
      .put('/api/v1/governance/role-permissions/role_sales_director')
      .set('Cookie', adminCookies)
      .send({
        roleNameSnapshot: '销售总监',
        status: 'ACTIVE',
        visibleMenus: ['analysis-workbench'],
        actionKeys: ['analysis.use', 'analysis.follow_up'],
        webConsoleEnabled: true,
        wecomBotEligible: true,
        exportAllowed: false,
        templateManageAllowed: false,
        contractReviewUploadAllowed: false,
        contractReviewCrossViewAllowed: false,
        contractReviewCrossDownloadAllowed: false,
        changeReason: '用于验证导出权限撤销即时生效',
      })
      .expect(200);

    const created = await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', cookies)
      .send({
        querySource: 'FREE_TEXT',
        channel: 'web-console',
        questionText: '本月各销售负责人新增商机金额排名',
      })
      .expect(201);

    const exported = await request(app.getHttpServer())
      .post(`/api/v1/analysis/queries/${created.body.queryId}/exports`)
      .set('Cookie', cookies)
      .send({ format: 'xlsx' })
      .expect(201);

    expect(exported.body.status).toBe('BLOCKED');
    expect(String(exported.body.blockedReason)).toContain('导出权限');
  });
});

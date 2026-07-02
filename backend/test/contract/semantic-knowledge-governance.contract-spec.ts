import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { loginAs } from '../auth-test.helper';
import { createTestApp } from '../test-app';

describe('semantic knowledge governance contract', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('管理员应可创建、查看、发布并回退语义资产，且审计中心可见对应事件', async () => {
    const adminCookies = await loginAs(app, 'user_admin');

    const created = await request(app.getHttpServer())
      .post('/api/v1/governance/semantic-knowledge')
      .set('Cookie', adminCookies)
      .send({
        type: 'ALIAS',
        name: '商机额别名',
        status: 'ACTIVE',
        canonicalLabel: '新增商机金额',
        synonyms: ['商机额', '机会金额'],
        matchKeywords: ['商机额', '机会金额'],
        hint: '商机额 -> 新增商机金额（治理资产）',
      })
      .expect(201);

    expect(created.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        type: 'ALIAS',
        name: '商机额别名',
        status: 'ACTIVE',
        canonicalLabel: '新增商机金额',
      }),
    );

    const listBeforePublish = await request(app.getHttpServer())
      .get('/api/v1/governance/semantic-knowledge')
      .set('Cookie', adminCookies)
      .expect(200);

    expect(listBeforePublish.body).toEqual(
      expect.objectContaining({
        draftItems: expect.arrayContaining([
          expect.objectContaining({
            id: created.body.id,
            type: 'ALIAS',
            name: '商机额别名',
          }),
        ]),
        publishedSummary: expect.objectContaining({
          assetCount: expect.any(Number),
        }),
      }),
    );

    const published = await request(app.getHttpServer())
      .post('/api/v1/governance/semantic-knowledge/publish')
      .set('Cookie', adminCookies)
      .send({
        changeSummary: '发布首版问数语义资产',
      })
      .expect(201);

    expect(published.body).toEqual(
      expect.objectContaining({
        version: expect.any(String),
        assetCount: expect.any(Number),
        publishedBy: 'user_admin',
      }),
    );

    const detailAfterPublish = await request(app.getHttpServer())
      .get(`/api/v1/governance/semantic-knowledge/${created.body.id}`)
      .set('Cookie', adminCookies)
      .expect(200);

    expect(detailAfterPublish.body).toEqual(
      expect.objectContaining({
        id: created.body.id,
        latestPublishedVersion: published.body.version,
      }),
    );

    const rollback = await request(app.getHttpServer())
      .post('/api/v1/governance/semantic-knowledge/rollback')
      .set('Cookie', adminCookies)
      .send({
        version: published.body.version,
        reason: '验证回退能力',
      })
      .expect(200);

    expect(rollback.body).toEqual(
      expect.objectContaining({
        restoredVersion: published.body.version,
        assetCount: expect.any(Number),
      }),
    );

    const audit = await request(app.getHttpServer())
      .get('/api/v1/audit-events')
      .query({
        actorId: 'user_admin',
        pageSize: 200,
      })
      .set('Cookie', adminCookies)
      .expect(200);

    expect(audit.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: 'ANALYSIS_SEMANTIC_KNOWLEDGE_ASSET_SAVED',
        }),
        expect.objectContaining({
          eventType: 'ANALYSIS_SEMANTIC_KNOWLEDGE_PUBLISHED',
        }),
        expect.objectContaining({
          eventType: 'ANALYSIS_SEMANTIC_KNOWLEDGE_ROLLED_BACK',
        }),
      ]),
    );
  });
});

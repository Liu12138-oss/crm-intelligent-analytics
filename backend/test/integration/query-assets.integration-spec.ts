import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppStorageService } from '../../src/database/app-storage/app-storage.service';
import { loginAs } from '../auth-test.helper';
import { createTestApp } from '../test-app';

describe('query assets integration', () => {
  let app: INestApplication;
  let appStorageService: AppStorageService;

  beforeAll(async () => {
    app = await createTestApp();
    appStorageService = app.get(AppStorageService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    appStorageService.state.queryTemplates = appStorageService.state.queryTemplates.map((item) => ({
      ...item,
    }));
  });

  it('模板执行与最近查询重跑应生成新结果', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const capabilities = await request(app.getHttpServer())
      .get('/api/v1/analysis/capabilities')
      .set('Cookie', cookies)
      .expect(200);

    expect(capabilities.body.queryAssetSummary).toEqual(
      expect.objectContaining({
        timeSlot: expect.any(String),
        recommendedTemplates: expect.any(Array),
      }),
    );
    expect(capabilities.body.queryAssetSummary.recommendedTemplates[0]).toEqual(
      expect.objectContaining({
        templateId: expect.any(String),
        recommendationReason: expect.any(String),
      }),
    );

    const templateResponse = await request(app.getHttpServer())
      .get('/api/v1/analysis/templates')
      .set('Cookie', cookies)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/analysis/queries')
      .set('Cookie', cookies)
      .send({
        querySource: 'COMMON_TEMPLATE',
        channel: 'web-console',
        templateId: templateResponse.body.items[0].templateId,
      })
      .expect(201);

    const histories = await request(app.getHttpServer())
      .get('/api/v1/analysis/histories')
      .set('Cookie', cookies)
      .expect(200);

    expect(histories.body.items.length).toBeGreaterThan(0);
    expect(histories.body.items[0].sourceType).toBeTruthy();
    if (histories.body.items[0].lastTemporalScope) {
      expect(histories.body.items[0].lastTemporalScope).toEqual(
        expect.objectContaining({
          normalizedLabel: expect.any(String),
          source: 'AI_TEMPORAL_SLOT',
          startAt: expect.any(String),
          endAt: expect.any(String),
        }),
      );
    }

    const rerun = await request(app.getHttpServer())
      .post(`/api/v1/analysis/histories/${histories.body.items[0].historyId}/rerun`)
      .set('Cookie', cookies)
      .send({ channel: 'web-console' })
      .expect(201);

    expect(rerun.body.queryId).toBeTruthy();
    const rerunRequest = appStorageService.state.analysisRequests.find(
      (item) => item.id === rerun.body.queryId,
    );
    if (histories.body.items[0].lastTemporalScope) {
      expect(rerunRequest?.temporalSlot).toEqual(
        expect.objectContaining({
          rawText: histories.body.items[0].lastTemporalScope.rawText,
          startAt: histories.body.items[0].lastTemporalScope.startAt,
          endAt: histories.body.items[0].lastTemporalScope.endAt,
        }),
      );
    }
  });

  it('旧结构模板记录也应兼容返回能力快照与模板列表', async () => {
    const cookies = await loginAs(app, 'user_admin');

    appStorageService.state.queryTemplates = appStorageService.state.queryTemplates.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      defaultQuestionText: item.defaultQuestionText,
      defaultFilters: item.defaultFilters,
      defaultViewType: item.defaultViewType,
      visibleRoleIds: item.visibleRoleIds,
      displayOrder: item.displayOrder,
      clickCount7d: item.clickCount7d,
      hitRatePercent: item.hitRatePercent,
      optimizationStatus: item.optimizationStatus,
      status: item.status,
      ownedBy: item.ownedBy,
      updatedAt: item.updatedAt,
    })) as any;

    const capabilityResponse = await request(app.getHttpServer())
      .get('/api/v1/analysis/capabilities')
      .set('Cookie', cookies)
      .expect(200);

    expect(capabilityResponse.body.queryAssetSummary).toEqual(
      expect.objectContaining({
        timeSlot: expect.any(String),
        recommendedTemplates: expect.any(Array),
      }),
    );

    const templateResponse = await request(app.getHttpServer())
      .get('/api/v1/analysis/templates')
      .set('Cookie', cookies)
      .expect(200);

    expect(templateResponse.body.items[0]).toEqual(
      expect.objectContaining({
        templateId: expect.any(String),
        queryMode: 'FIXED_SQL',
        sqlVersion: expect.any(String),
        renderConfig: expect.objectContaining({
          primaryViewType: expect.any(String),
        }),
      }),
    );
  });
});

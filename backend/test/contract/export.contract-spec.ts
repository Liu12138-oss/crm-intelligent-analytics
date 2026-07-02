import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppStorageService } from '../../src/database/app-storage/app-storage.service';
import { loginAs } from '../auth-test.helper';
import { createTestApp } from '../test-app';

describe('export contract', () => {
  let app: INestApplication;
  let appStorageService: AppStorageService;

  beforeAll(async () => {
    app = await createTestApp();
    appStorageService = app.get(AppStorageService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('具备导出权限的用户应可导出当前结果', async () => {
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

    const exported = await request(app.getHttpServer())
      .post(`/api/v1/analysis/queries/${created.body.queryId}/exports`)
      .set('Cookie', cookies)
      .send({ format: 'csv' })
      .expect(201);

    expect(exported.body.exportId).toBeTruthy();
    expect(exported.body.status).toBe('COMPLETED');
    expect(exported.body.fileName).toContain('.csv');
    expect(exported.body.mimeType).toBe('text/csv;charset=utf-8');
    expect(String(exported.body.content)).toContain('负责人');
    const resultRecord = appStorageService.state.analysisResults.find(
      (item) => item.requestId === created.body.queryId,
    );
    const exportRecord = appStorageService.state.exportRequests.find(
      (item) => item.id === exported.body.exportId,
    );
    expect(resultRecord?.consistencyToken).toBeTruthy();
    expect(exportRecord?.consistencyToken).toBe(resultRecord?.consistencyToken);
  });
});

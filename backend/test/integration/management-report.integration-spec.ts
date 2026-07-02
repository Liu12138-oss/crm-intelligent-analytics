import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppStorageService } from '../../src/database/app-storage/app-storage.service';
import { loginAs } from '../auth-test.helper';
import { createTestApp } from '../test-app';

describe('management report integration', () => {
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
    appStorageService.state.auditEvents = [];
  });

  it('已授权用户打开经营报表时应返回默认筛选与厚首屏快照', async () => {
    const cookies = await loginAs(app, 'user_sales_director');

    const optionsResponse = await request(app.getHttpServer())
      .get('/api/v1/management-report/options')
      .set('Cookie', cookies)
      .expect(200);

    expect(optionsResponse.body.defaultFilter).toMatchObject({
      presetKey: 'q1',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
      departmentId: 'all-company',
    });
    expect(optionsResponse.body.departments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'all-company',
          children: expect.arrayContaining([
            expect.objectContaining({
              id: 'dept_sales',
              children: expect.arrayContaining([
                expect.objectContaining({
                  id: 'dept_region_east',
                }),
              ]),
            }),
          ]),
        }),
      ]),
    );

    const snapshotResponse = await request(app.getHttpServer())
      .post('/api/v1/management-report/snapshot')
      .set('Cookie', cookies)
      .send(optionsResponse.body.defaultFilter)
      .expect(201);

    expect(snapshotResponse.body.reportId).toEqual(expect.any(String));
    expect(snapshotResponse.body.meta.departmentLabel).toBe('全公司');
    expect(snapshotResponse.body.overview.metricCards.length).toBeGreaterThanOrEqual(6);
    expect(snapshotResponse.body.overview.blocks.length).toBeGreaterThanOrEqual(2);
    expect(snapshotResponse.body.executiveSummary.blocks.length).toBeGreaterThanOrEqual(4);
    expect(snapshotResponse.body.sections.length).toBeGreaterThanOrEqual(11);
    expect(snapshotResponse.body.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sectionKey: 'collections',
          loadMode: 'lazy',
          available: true,
        }),
      ]),
    );

    expect(
      appStorageService.state.auditEvents.some(
        (item) => item.eventType === 'MANAGEMENT_REPORT_VIEWED',
      ),
    ).toBe(true);
  });

  it('专题详情与导出应复用同一份经营报表上下文并返回多块数据', async () => {
    const cookies = await loginAs(app, 'user_sales_director');

    const snapshotResponse = await request(app.getHttpServer())
      .post('/api/v1/management-report/snapshot')
      .set('Cookie', cookies)
      .send({
        departmentId: 'all-company',
        presetKey: 'q1',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
      })
      .expect(201);

    const sectionResponse = await request(app.getHttpServer())
      .post('/api/v1/management-report/sections/collections')
      .set('Cookie', cookies)
      .send({
        reportId: snapshotResponse.body.reportId,
      })
      .expect(201);

    expect(sectionResponse.body.reportId).toBe(snapshotResponse.body.reportId);
    expect(sectionResponse.body.sectionKey).toBe('collections');
    expect(sectionResponse.body.section.blocks.length).toBeGreaterThanOrEqual(5);
    expect(sectionResponse.body.section.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ blockType: 'metric-strip' }),
        expect.objectContaining({ blockType: 'trend' }),
        expect.objectContaining({ blockType: 'detail-table' }),
      ]),
    );
    expect(
      sectionResponse.body.section.blocks.find(
        (item: { title?: string }) => item.title === '销售收款情况',
      )?.rows?.length ?? 0,
    ).toBeGreaterThanOrEqual(4);

    const exportResponse = await request(app.getHttpServer())
      .post('/api/v1/management-report/export')
      .set('Cookie', cookies)
      .send({
        reportId: snapshotResponse.body.reportId,
        format: 'csv',
      })
      .expect(201);

    expect(exportResponse.body.reportId).toBe(snapshotResponse.body.reportId);
    expect(exportResponse.body.fileName).toContain('经营报表');
    expect(String(exportResponse.body.content)).toContain('经营报表');
    expect(String(exportResponse.body.content)).toContain('收款摘要');
    expect(
      appStorageService.state.auditEvents.some(
        (item) => item.eventType === 'MANAGEMENT_REPORT_EXPORTED',
      ),
    ).toBe(true);
  });

  it('即使之前能力快照允许导出，治理撤销导出权限后真实导出接口也必须立即拒绝', async () => {
    const adminCookies = await loginAs(app, 'user_admin');
    const userCookies = await loginAs(app, 'user_sales_director');

    await request(app.getHttpServer())
      .get('/api/v1/analysis/capabilities')
      .set('Cookie', userCookies)
      .expect(200)
      .expect(({ body }) => {
        expect(body.actionKeys).toContain('management.report.export');
      });

    await request(app.getHttpServer())
      .put('/api/v1/governance/role-permissions/role_sales_director')
      .set('Cookie', adminCookies)
      .send({
        roleNameSnapshot: '销售总监',
        status: 'ACTIVE',
        visibleMenus: ['analysis-workbench', 'management-report'],
        actionKeys: ['analysis.use', 'management.report.view'],
        webConsoleEnabled: true,
        wecomBotEligible: true,
        exportAllowed: false,
        templateManageAllowed: false,
        contractReviewUploadAllowed: false,
        contractReviewCrossViewAllowed: false,
        contractReviewCrossDownloadAllowed: false,
        changeReason: '验证经营报表导出撤销后真实接口立即拒绝',
      })
      .expect(200);

    const snapshotResponse = await request(app.getHttpServer())
      .post('/api/v1/management-report/snapshot')
      .set('Cookie', userCookies)
      .send({
        departmentId: 'all-company',
        presetKey: 'q1',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/management-report/export')
      .set('Cookie', userCookies)
      .send({
        reportId: snapshotResponse.body.reportId,
        format: 'csv',
      })
      .expect(403);
  });

  it('重专题应返回足够的排行和矩阵行数，避免只有三条样本', async () => {
    const cookies = await loginAs(app, 'user_sales_director');

    const snapshotResponse = await request(app.getHttpServer())
      .post('/api/v1/management-report/snapshot')
      .set('Cookie', cookies)
      .send({
        departmentId: 'all-company',
        presetKey: 'q1',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
      })
      .expect(201);

    const opportunitiesResponse = await request(app.getHttpServer())
      .post('/api/v1/management-report/sections/opportunities')
      .set('Cookie', cookies)
      .send({
        reportId: snapshotResponse.body.reportId,
      })
      .expect(201);

    const rankingRows =
      opportunitiesResponse.body.section.blocks.find(
        (item: { title?: string }) => item.title === '负责人在手商机金额排行',
      )?.rows?.length ?? 0;
    const matrixRows =
      opportunitiesResponse.body.section.blocks.find(
        (item: { title?: string }) => item.title === '负责人 × 在手阶段金额',
      )?.rows?.length ?? 0;

    expect(rankingRows).toBeGreaterThanOrEqual(5);
    expect(matrixRows).toBeGreaterThanOrEqual(5);
  });

  it('提交越权部门筛选时应阻断并写入审计', async () => {
    const cookies = await loginAs(app, 'user_region_manager');

    await request(app.getHttpServer())
      .post('/api/v1/management-report/snapshot')
      .set('Cookie', cookies)
      .send({
        departmentId: 'dept_product',
        presetKey: 'q1',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
      })
      .expect(403);

    expect(
      appStorageService.state.auditEvents.some(
        (item) =>
          item.eventType === 'MANAGEMENT_REPORT_SCOPE_BLOCKED' &&
          String(item.failureReason).includes('dept_product'),
      ),
    ).toBe(true);
  });

  it('即使 reportId 失效，只要补齐当前筛选条件也应能继续加载专题', async () => {
    const cookies = await loginAs(app, 'user_sales_director');

    const response = await request(app.getHttpServer())
      .post('/api/v1/management-report/sections/collections')
      .set('Cookie', cookies)
      .send({
        reportId: 'expired_report_id',
        filter: {
          departmentId: 'all-company',
          presetKey: 'q1',
          startDate: '2026-01-01',
          endDate: '2026-03-31',
        },
      })
      .expect(201);

    expect(response.body.sectionKey).toBe('collections');
    expect(response.body.section.blocks.length).toBeGreaterThanOrEqual(5);
  });
});

import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { loginAs } from '../auth-test.helper';
import { createTestApp } from '../test-app';
import { DEFAULT_QUERY_TEMPLATES } from '../../src/shared/mock/sample-data';

describe('query assets contract', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('应返回当前用户可见模板列表', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const response = await request(app.getHttpServer())
      .get('/api/v1/analysis/templates')
      .set('Cookie', cookies)
      .expect(200);

    expect(Array.isArray(response.body.items)).toBe(true);
    expect(response.body).toEqual(
      expect.objectContaining({
        page: 1,
        pageSize: expect.any(Number),
        total: expect.any(Number),
        tags: expect.any(Array),
      }),
    );
    expect(response.body.items[0]).toEqual(
      expect.objectContaining({
        templateId: expect.any(String),
        tags: expect.any(Array),
        ownerName: expect.any(String),
        queryMode: 'FIXED_SQL',
        sqlVersion: expect.any(String),
        renderConfig: expect.objectContaining({
          primaryViewType: expect.any(String),
        }),
      }),
    );
    expect(response.body.tags).not.toEqual(expect.arrayContaining(['内置模板', '常用查询']));
  });

  it('超级管理员应能看到全部启用模板', async () => {
    const cookies = await loginAs(app, 'user_admin');
    const response = await request(app.getHttpServer())
      .get('/api/v1/analysis/templates')
      .set('Cookie', cookies)
      .expect(200);

    const templateIds = response.body.items.map((item: any) => item.templateId);

    expect(templateIds).toContain('tpl_company_2026_completion');
    expect(templateIds).toContain('tpl_company_weekly_new_opportunity');
    expect(templateIds.length).toBeGreaterThanOrEqual(2);
    const completionTemplate = response.body.items.find(
      (item: any) => item.templateId === 'tpl_company_2026_completion',
    );
    const defaultCompletionTemplate = DEFAULT_QUERY_TEMPLATES.find(
      (item) => item.id === 'tpl_company_2026_completion',
    );

    expect(completionTemplate).toEqual(
      expect.objectContaining({
        sqlVersion: defaultCompletionTemplate?.sqlVersion,
        sqlText: expect.stringContaining("fv_stage.VALUE = '赢单'"),
      }),
    );
  });

  it('应支持分页筛选并将其它模板复制为我的个人副本', async () => {
    const cookies = await loginAs(app, 'user_sales_director');

    const othersBeforeCopy = await request(app.getHttpServer())
      .get('/api/v1/analysis/templates?scope=others&page=1&pageSize=5&sort=usage_desc')
      .set('Cookie', cookies)
      .expect(200);
    expect(othersBeforeCopy.body.items.length).toBeGreaterThan(0);

    const sourceTemplateId = othersBeforeCopy.body.items[0].templateId;
    const copyResponse = await request(app.getHttpServer())
      .post(`/api/v1/analysis/templates/${sourceTemplateId}/copy-to-mine`)
      .set('Cookie', cookies)
      .expect(201);

    expect(copyResponse.body).toEqual(
      expect.objectContaining({
        sourceTemplateId,
        sourceType: 'COPIED_FROM_TEMPLATE',
        ownerUserId: 'user_sales_director',
        ownerName: '销售总监',
        visibilityType: 'PRIVATE',
        usageCountTotal: 0,
      }),
    );

    const mineResponse = await request(app.getHttpServer())
      .get('/api/v1/analysis/templates?scope=mine&page=1&pageSize=10')
      .set('Cookie', cookies)
      .expect(200);
    expect(mineResponse.body.items.map((item: any) => item.templateId)).toContain(
      copyResponse.body.templateId,
    );

    await request(app.getHttpServer())
      .delete(`/api/v1/analysis/templates/${sourceTemplateId}`)
      .set('Cookie', cookies)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/analysis/templates/${copyResponse.body.templateId}`)
      .set('Cookie', cookies)
      .expect(200);

    const mineAfterDelete = await request(app.getHttpServer())
      .get('/api/v1/analysis/templates?scope=mine&page=1&pageSize=10')
      .set('Cookie', cookies)
      .expect(200);
    expect(mineAfterDelete.body.items.map((item: any) => item.templateId)).not.toContain(
      copyResponse.body.templateId,
    );
  });

  it('查询模板 SQL 编写权限应允许新增受控 SQL 模板但不等同模板治理权限', async () => {
    const adminCookies = await loginAs(app, 'user_admin');
    const managerCookies = await loginAs(app, 'user_region_manager');

    await request(app.getHttpServer())
      .put('/api/v1/governance/role-permissions/role_region_manager')
      .set('Cookie', adminCookies)
      .send({
        roleNameSnapshot: '区域经理',
        status: 'ACTIVE',
        visibleMenus: ['analysis-workbench'],
        actionKeys: ['analysis.use', 'template.view', 'template.sql.write'],
        webConsoleEnabled: true,
        wecomBotEligible: false,
        exportAllowed: false,
        templateManageAllowed: false,
        contractReviewUploadAllowed: false,
        contractReviewCrossViewAllowed: false,
        contractReviewCrossDownloadAllowed: false,
        changeReason: '验证 SQL 编写最小权限',
      })
      .expect(200);

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/governance/query-templates')
      .set('Cookie', managerCookies)
      .send({
        name: 'SQL 编写权限测试模板',
        description: '用于验证仅具备 SQL 编写权限时可以创建受控查询模板。',
        tags: ['SQL 编写'],
        defaultQuestionText: 'SQL 编写权限测试模板',
        defaultFilters: {},
        defaultViewType: 'DETAIL_TABLE',
        sqlText: 'SELECT o.id, o.title FROM opportunities o LIMIT 5',
        visibleRoleIds: [],
        displayOrder: 98,
        status: 'ACTIVE',
      })
      .expect(201);

    expect(createResponse.body).not.toHaveProperty('category');

    await request(app.getHttpServer())
      .get('/api/v1/governance/query-templates')
      .set('Cookie', managerCookies)
      .expect(403);
  });

  it('缺少智能分析菜单的用户应拿到空模板列表', async () => {
    const adminCookies = await loginAs(app, 'user_admin');
    const cookies = await loginAs(app, 'user_sales_director');

    await request(app.getHttpServer())
      .put('/api/v1/governance/role-permissions/role_sales_director')
      .set('Cookie', adminCookies)
      .send({
        roleNameSnapshot: '销售总监',
        status: 'ACTIVE',
        visibleMenus: [],
        actionKeys: ['analysis.use'],
        webConsoleEnabled: true,
        wecomBotEligible: true,
        exportAllowed: false,
        templateManageAllowed: false,
        contractReviewUploadAllowed: false,
        contractReviewCrossViewAllowed: false,
        contractReviewCrossDownloadAllowed: false,
        changeReason: '用于验证智能分析菜单撤销后模板应不可见',
      })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get('/api/v1/analysis/templates')
      .set('Cookie', cookies)
      .expect(200);

    expect(response.body.items).toEqual([]);
  });

  it('最近查询应返回来源类型与展示快照摘要', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const response = await request(app.getHttpServer())
      .get('/api/v1/analysis/histories')
      .set('Cookie', cookies)
      .expect(200);

    expect(Array.isArray(response.body.items)).toBe(true);
    if (response.body.items.length > 0) {
      expect(response.body.items[0]).toEqual(
        expect.objectContaining({
          historyId: expect.any(String),
          sourceType: expect.stringMatching(/AI_QUERY|TEMPLATE_QUERY|RERUN_HISTORY/),
          renderSnapshot: expect.any(Object),
        }),
      );
    }
  });

  it('模板执行入口应可访问', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const response = await request(app.getHttpServer())
      .post('/api/v1/analysis/templates/tpl_company_2026_completion/execute')
      .set('Cookie', cookies)
      .send({ parameters: {}, includeAiReport: false });

    expect([201, 400]).toContain(response.status);
  });

  it('工作台模板详情应返回完整 SQL 内容', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    const response = await request(app.getHttpServer())
      .get('/api/v1/analysis/templates/tpl_company_2026_completion')
      .set('Cookie', cookies)
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        templateId: 'tpl_company_2026_completion',
        sqlText: expect.stringContaining('SELECT'),
        defaultQuestionText: expect.any(String),
      }),
    );
  });

  it('治理模板接口应支持 SQL 校验与预览', async () => {
    const cookies = await loginAs(app, 'user_admin');

    await request(app.getHttpServer())
      .post('/api/v1/governance/query-templates/tpl_company_2026_completion/validate')
      .set('Cookie', cookies)
      .send({
        sqlText: 'SELECT o.id FROM opportunities o LIMIT 10',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/governance/query-templates/tpl_company_2026_completion/preview')
      .set('Cookie', cookies)
      .send({ parameters: { year: 2026 } })
      .expect(201);
  });

  it('治理模板接口应支持删除模板', async () => {
    const cookies = await loginAs(app, 'user_admin');
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/governance/query-templates')
      .set('Cookie', cookies)
      .send({
        name: '待删除模板',
        description: '用于验证模板删除契约。',
        defaultQuestionText: '用于验证模板删除契约',
        defaultFilters: {
          year: 2026,
        },
        defaultViewType: 'DETAIL_TABLE',
        sqlText: 'SELECT o.id, o.title FROM opportunities o LIMIT 5',
        visibleRoleIds: ['role_admin'],
        displayOrder: 99,
        status: 'ACTIVE',
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/governance/query-templates/${createResponse.body.templateId}`)
      .set('Cookie', cookies)
      .expect(200);

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/governance/query-templates')
      .set('Cookie', cookies)
      .expect(200);

    expect(listResponse.body.items.some((item: any) => item.templateId === createResponse.body.templateId)).toBe(
      false,
    );
  });
});

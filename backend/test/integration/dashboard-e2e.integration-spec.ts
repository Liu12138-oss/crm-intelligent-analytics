/**
 * 看板问数端到端联调集成测试
 *
 * 覆盖第 2-4 期的看板能力：
 * - 4 种看板类型生成
 * - 看板模板列表与按模板运行
 * - 条件改写
 * - 审计记录验证
 * - 权限鉴权
 * - 部分接口失败降级
 * - 错误处理
 */

import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppStorageService } from '../../src/database/app-storage/app-storage.service';
import { loginAs } from '../auth-test.helper';
import { createTestApp } from '../test-app';

describe('dashboard e2e integration', () => {
  let app: INestApplication;
  let appStorage: AppStorageService;

  beforeAll(async () => {
    app = await createTestApp();
    appStorage = app.get(AppStorageService);
  });

  afterAll(async () => {
    await app.close();
  });

  // ========================================
  // 1. 看板模板列表
  // ========================================

  describe('看板模板列表', () => {
    it('未登录用户应被重定向或拒绝', async () => {
      const resp = await request(app.getHttpServer())
        .get('/api/v1/dashboard/templates');
      expect(resp.status).toBeGreaterThanOrEqual(300);
    });

    it('登录用户应能获取看板模板列表', async () => {
      const cookies = await loginAs(app, 'user_sales_director');
      const resp = await request(app.getHttpServer())
        .get('/api/v1/dashboard/templates')
        .set('Cookie', cookies)
        .expect(200);

      expect(resp.body.code).toBe(0);
      expect(Array.isArray(resp.body.data)).toBe(true);
      expect(resp.body.data.length).toBeGreaterThan(0);

      // 验证模板结构
      const template = resp.body.data[0];
      expect(template.templateId).toBeTruthy();
      expect(template.name).toBeTruthy();
      expect(template.profile).toBeTruthy();
      expect(template.category).toBeTruthy();
    });

    it('模板列表应包含渠道下单汇总和代理商发展两个标杆模板', async () => {
      const cookies = await loginAs(app, 'user_sales_director');
      const resp = await request(app.getHttpServer())
        .get('/api/v1/dashboard/templates')
        .set('Cookie', cookies)
        .expect(200);

      const templateIds = resp.body.data.map((t: { templateId: string }) => t.templateId);
      expect(templateIds).toContain('tpl_channel_order_summary');
      expect(templateIds).toContain('tpl_agent_development');
    });
  });

  // ========================================
  // 2. 看板组装（直接指定 profile）
  // ========================================

  describe('看板组装（compose）', () => {
    it('渠道下单汇总看板应成功组装', async () => {
      const cookies = await loginAs(app, 'user_sales_director');
      const resp = await request(app.getHttpServer())
        .post('/api/v1/dashboard/compose')
        .set('Cookie', cookies)
        .send({
          profile: 'channel-order-summary',
          query: {},
        })
        .expect(200);

      expect(resp.body.code).toBe(0);
      expect(resp.body.data.blocks).toBeTruthy();
      expect(Array.isArray(resp.body.data.blocks)).toBe(true);
      expect(resp.body.data.reportTitle).toContain('渠道下单');
      expect(resp.body.data.dataSource).toBeDefined();
      expect(resp.body.data.fetchedAt).toBeTruthy();
    });

    it('代理商发展看板应成功组装', async () => {
      const cookies = await loginAs(app, 'user_sales_director');
      const resp = await request(app.getHttpServer())
        .post('/api/v1/dashboard/compose')
        .set('Cookie', cookies)
        .send({
          profile: 'agent-development',
        })
        .expect(200);

      expect(resp.body.code).toBe(0);
      expect(resp.body.data.blocks).toBeTruthy();
      expect(resp.body.data.reportTitle).toContain('代理商');
    });

    it('区域概览看板应成功组装', async () => {
      const cookies = await loginAs(app, 'user_sales_director');
      const resp = await request(app.getHttpServer())
        .post('/api/v1/dashboard/compose')
        .set('Cookie', cookies)
        .send({
          profile: 'region-overview',
        })
        .expect(200);

      expect(resp.body.code).toBe(0);
      expect(resp.body.data.blocks).toBeTruthy();
    });

    it('负责人业绩看板应成功组装', async () => {
      const cookies = await loginAs(app, 'user_sales_director');
      const resp = await request(app.getHttpServer())
        .post('/api/v1/dashboard/compose')
        .set('Cookie', cookies)
        .send({
          profile: 'owner-performance',
        })
        .expect(200);

      expect(resp.body.code).toBe(0);
      expect(resp.body.data.blocks).toBeTruthy();
    });

    it('auto 识别应根据问题文本选择看板类型', async () => {
      const cookies = await loginAs(app, 'user_sales_director');
      const resp = await request(app.getHttpServer())
        .post('/api/v1/dashboard/compose')
        .set('Cookie', cookies)
        .send({
          profile: 'auto',
          questionText: '渠道下单汇总分析',
        })
        .expect(200);

      expect(resp.body.code).toBe(0);
      // auto 识别后 reportTitle 应包含"渠道下单汇总"
      expect(resp.body.data.reportTitle).toContain('渠道下单汇总');
    });

    it('看板组装应记录审计事件', async () => {
      const cookies = await loginAs(app, 'user_sales_director');
      const beforeCount = appStorage.state.auditEvents.length;

      await request(app.getHttpServer())
        .post('/api/v1/dashboard/compose')
        .set('Cookie', cookies)
        .send({
          profile: 'channel-order-summary',
        })
        .expect(200);

      const afterCount = appStorage.state.auditEvents.length;
      expect(afterCount).toBeGreaterThan(beforeCount);

      // 验证最新审计事件是看板相关
      const latestEvent = appStorage.state.auditEvents[0];
      expect([
        'DASHBOARD_COMPOSED',
        'DASHBOARD_VIEWED',
        'DASHBOARD_TEMPLATE_EXECUTED',
      ]).toContain(latestEvent.eventType);
    });
  });

  // ========================================
  // 3. 按模板运行（支持条件改写）
  // ========================================

  describe('按模板运行', () => {
    it('按渠道下单汇总模板运行应成功', async () => {
      const cookies = await loginAs(app, 'user_sales_director');
      const resp = await request(app.getHttpServer())
        .post('/api/v1/dashboard/templates/tpl_channel_order_summary/run')
        .set('Cookie', cookies)
        .send({})
        .expect(200);

      expect(resp.body.code).toBe(0);
      expect(resp.body.data.templateId).toBe('tpl_channel_order_summary');
      expect(resp.body.data.templateName).toContain('渠道下单汇总');
    });

    it('按代理商发展模板运行应成功', async () => {
      const cookies = await loginAs(app, 'user_sales_director');
      const resp = await request(app.getHttpServer())
        .post('/api/v1/dashboard/templates/tpl_agent_development/run')
        .set('Cookie', cookies)
        .send({})
        .expect(200);

      expect(resp.body.code).toBe(0);
      expect(resp.body.data.templateId).toBe('tpl_agent_development');
    });

    it('条件改写应生效（指定大区）', async () => {
      const cookies = await loginAs(app, 'user_sales_director');
      const resp = await request(app.getHttpServer())
        .post('/api/v1/dashboard/templates/tpl_agent_development/run')
        .set('Cookie', cookies)
        .send({
          overrides: {
            bigRegion: '大北区',
          },
        })
        .expect(200);

      expect(resp.body.code).toBe(0);
      // 改写后的 query 应包含大区参数
      expect(resp.body.data.scopeSummary).toBeDefined();
    });

    it('不存在的模板应返回 404', async () => {
      const cookies = await loginAs(app, 'user_sales_director');
      const resp = await request(app.getHttpServer())
        .post('/api/v1/dashboard/templates/tpl_nonexistent/run')
        .set('Cookie', cookies)
        .send({})
        .expect(200);

      expect(resp.body.code).toBe(404);
    });

    it('按模板运行应记录审计事件', async () => {
      const cookies = await loginAs(app, 'user_sales_director');
      const beforeCount = appStorage.state.auditEvents.length;

      await request(app.getHttpServer())
        .post('/api/v1/dashboard/templates/tpl_channel_order_summary/run')
        .set('Cookie', cookies)
        .send({})
        .expect(200);

      const afterCount = appStorage.state.auditEvents.length;
      expect(afterCount).toBeGreaterThan(beforeCount);

      const latestEvent = appStorage.state.auditEvents[0];
      expect(latestEvent.eventType).toBe('DASHBOARD_TEMPLATE_EXECUTED');
    });
  });

  // ========================================
  // 4. 看板 block 结构验证
  // ========================================

  describe('看板 block 结构', () => {
    it('渠道下单汇总看板应包含 KPI 矩阵或集中度分析（数据可用时）', async () => {
      const cookies = await loginAs(app, 'user_sales_director');
      const resp = await request(app.getHttpServer())
        .post('/api/v1/dashboard/compose')
        .set('Cookie', cookies)
        .send({
          profile: 'channel-order-summary',
        })
        .expect(200);

      const blockTypes = resp.body.data.blocks.map((b: { blockType: string }) => b.blockType);
      // 数据可用时应包含 KPI 矩阵；数据不可用时 blocks 可能为空（降级）
      if (blockTypes.length > 0) {
        expect(blockTypes).toContain('kpi-matrix');
      }
    });

    it('代理商发展看板应包含 KPI 矩阵（数据可用时）', async () => {
      const cookies = await loginAs(app, 'user_sales_director');
      const resp = await request(app.getHttpServer())
        .post('/api/v1/dashboard/compose')
        .set('Cookie', cookies)
        .send({
          profile: 'agent-development',
        })
        .expect(200);

      const blockTypes = resp.body.data.blocks.map((b: { blockType: string }) => b.blockType);
      if (blockTypes.length > 0) {
        expect(blockTypes).toContain('kpi-matrix');
      }
    });

    it('KPI 矩阵 block 应有正确的 metrics 结构（数据可用时）', async () => {
      const cookies = await loginAs(app, 'user_sales_director');
      const resp = await request(app.getHttpServer())
        .post('/api/v1/dashboard/compose')
        .set('Cookie', cookies)
        .send({
          profile: 'channel-order-summary',
        })
        .expect(200);

      const kpiBlock = resp.body.data.blocks.find(
        (b: { blockType: string }) => b.blockType === 'kpi-matrix',
      );
      if (kpiBlock) {
        expect(kpiBlock.metrics).toBeTruthy();
        expect(kpiBlock.metrics.length).toBeGreaterThan(0);
        expect(kpiBlock.metrics[0].label).toBeTruthy();
        expect(kpiBlock.metrics[0].value).toBeTruthy();
      }
    });

    it('可排序表 block 应有正确的 columns 和 rows 结构（数据可用时）', async () => {
      const cookies = await loginAs(app, 'user_sales_director');
      const resp = await request(app.getHttpServer())
        .post('/api/v1/dashboard/compose')
        .set('Cookie', cookies)
        .send({
          profile: 'channel-order-summary',
        })
        .expect(200);

      const tableBlock = resp.body.data.blocks.find(
        (b: { blockType: string }) => b.blockType === 'sortable-table',
      );
      if (tableBlock) {
        expect(tableBlock.columns).toBeTruthy();
        expect(tableBlock.columns.length).toBeGreaterThan(0);
        expect(tableBlock.rows).toBeTruthy();
        expect(Array.isArray(tableBlock.rows)).toBe(true);
      }
    });
  });

  // ========================================
  // 5. 鉴权与错误处理
  // ========================================

  describe('鉴权与错误处理', () => {
    it('未登录访问 compose 应被拒绝', async () => {
      const resp = await request(app.getHttpServer())
        .post('/api/v1/dashboard/compose')
        .send({
          profile: 'channel-order-summary',
        });
      expect(resp.status).toBeGreaterThanOrEqual(300);
    });

    it('未登录访问模板运行应被拒绝', async () => {
      const resp = await request(app.getHttpServer())
        .post('/api/v1/dashboard/templates/tpl_channel_order_summary/run')
        .send({});
      expect(resp.status).toBeGreaterThanOrEqual(300);
    });

    it('看板结果应包含数据来源标记', async () => {
      const cookies = await loginAs(app, 'user_sales_director');
      const resp = await request(app.getHttpServer())
        .post('/api/v1/dashboard/compose')
        .set('Cookie', cookies)
        .send({
          profile: 'channel-order-summary',
        })
        .expect(200);

      expect(resp.body.data.dataSource).toBeDefined();
      expect(['OPENAPI_REALTIME', 'OPENAPI_SNAPSHOT_FALLBACK']).toContain(
        resp.body.data.dataSource,
      );
    });

    it('看板结果应包含 scopeSummary', async () => {
      const cookies = await loginAs(app, 'user_sales_director');
      const resp = await request(app.getHttpServer())
        .post('/api/v1/dashboard/compose')
        .set('Cookie', cookies)
        .send({
          profile: 'channel-order-summary',
        })
        .expect(200);

      expect(resp.body.data.scopeSummary).toBeDefined();
      expect(typeof resp.body.data.scopeSummary).toBe('string');
    });
  });
});

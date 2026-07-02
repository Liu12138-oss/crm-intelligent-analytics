import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { loginAs } from '../auth-test.helper';
import { createTestApp } from '../test-app';

const OPPORTUNITY_CREATE_ENV_KEYS = [
  'CRM_OPPORTUNITY_CREATE_DEFAULT_STAGE',
  'CRM_OPPORTUNITY_CREATE_DEFAULT_SOURCE',
  'CRM_OPPORTUNITY_CREATE_DEFAULT_KIND',
  'CRM_OPPORTUNITY_CREATE_LEAD_CODE_FIELD',
  'CRM_OPPORTUNITY_CREATE_RENEWAL_CONTRACT_CODE_FIELD',
  'CRM_OPPORTUNITY_CREATE_AGENT_FULL_NAME_FIELD',
  'CRM_OPPORTUNITY_CREATE_PROJECT_STATUS_FIELD',
  'CRM_OPPORTUNITY_CREATE_PRE_SALES_FIELD',
] as const;

describe('crm opportunity create integration', () => {
  let app: INestApplication;
  const originalEnv = new Map<string, string | undefined>();

  beforeEach(async () => {
    for (const key of OPPORTUNITY_CREATE_ENV_KEYS) {
      originalEnv.set(key, process.env[key]);
    }

    process.env.CRM_OPPORTUNITY_CREATE_DEFAULT_STAGE = '2044';
    process.env.CRM_OPPORTUNITY_CREATE_DEFAULT_SOURCE = '400';
    process.env.CRM_OPPORTUNITY_CREATE_DEFAULT_KIND = 'standard';
    process.env.CRM_OPPORTUNITY_CREATE_LEAD_CODE_FIELD = 'text_asset_lead_code';
    process.env.CRM_OPPORTUNITY_CREATE_RENEWAL_CONTRACT_CODE_FIELD =
      'text_asset_renewal_contract_code';
    process.env.CRM_OPPORTUNITY_CREATE_AGENT_FULL_NAME_FIELD =
      'text_asset_agent_full_name';
    process.env.CRM_OPPORTUNITY_CREATE_PROJECT_STATUS_FIELD =
      'text_asset_project_status';
    process.env.CRM_OPPORTUNITY_CREATE_PRE_SALES_FIELD =
      'text_asset_pre_sales';

    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();

    for (const key of OPPORTUNITY_CREATE_ENV_KEYS) {
      const value = originalEnv.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    originalEnv.clear();
  });

  it('应按截图必填字段创建商机并补齐默认阶段配置', async () => {
    const cookies = await loginAs(app, 'user_sales_director');

    const response = await request(app.getHttpServer())
      .post('/api/v1/crm/opportunities')
      .set('Cookie', cookies)
      .send({
        title: '华东区域续签项目',
        customerId: 'customer_001',
        customerName: '华东样例客户',
        leadCode: 'LEAD-20260407-001',
        expectAmount: 400,
        expectSignDate: '2026-04-30',
        renewalContractCode: 'HT-2025-0099',
        agentFullName: '华东总代样例公司',
        projectStatusSummary: '客户已完成预算评审，等待最终商务确认',
        preSalesName: '张工',
        productAssets: [
          {
            productId: 'product_001',
            quantity: 1,
          },
        ],
      })
      .expect(201);

    expect(response.body.opportunityId).toBeTruthy();
    expect(response.body.title).toBe('华东区域续签项目');
    expect(response.body.customerId).toBe('customer_001');
    expect(response.body.ownerId).toBe('user_sales_director');
    expect(response.body.departmentId).toBe('dept_sales');
    expect(response.body.expectAmount).toBe(400);
    expect(response.body.expectSignDate).toBe('2026-04-30');
    expect(response.body.message).toContain('mock');
  });

  it('缺少关联产品时应返回 400', async () => {
    const cookies = await loginAs(app, 'user_sales_director');

    const response = await request(app.getHttpServer())
      .post('/api/v1/crm/opportunities')
      .set('Cookie', cookies)
      .send({
        title: '华东区域续签项目',
        customerId: 'customer_001',
        leadCode: 'LEAD-20260407-001',
        expectAmount: 400,
        expectSignDate: '2026-04-30',
        renewalContractCode: 'HT-2025-0099',
        agentFullName: '华东总代样例公司',
        projectStatusSummary: '客户已完成预算评审，等待最终商务确认',
        preSalesName: '张工',
        productAssets: [],
      })
      .expect(400);

    expect(String(response.body.message)).toContain('关联产品不能为空');
  });

  it('缺少商机自定义字段映射配置时应返回 400', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    delete process.env.CRM_OPPORTUNITY_CREATE_PRE_SALES_FIELD;

    const response = await request(app.getHttpServer())
      .post('/api/v1/crm/opportunities')
      .set('Cookie', cookies)
      .send({
        title: '华东区域续签项目',
        customerId: 'customer_001',
        leadCode: 'LEAD-20260407-001',
        expectAmount: 400,
        expectSignDate: '2026-04-30',
        renewalContractCode: 'HT-2025-0099',
        agentFullName: '华东总代样例公司',
        projectStatusSummary: '客户已完成预算评审，等待最终商务确认',
        preSalesName: '张工',
        productAssets: [
          {
            productId: 'product_001',
          },
        ],
      })
      .expect(400);

    expect(String(response.body.message)).toContain(
      'CRM_OPPORTUNITY_CREATE_PRE_SALES_FIELD',
    );
  });

  it('缺少 wecom.opportunity.create 的用户应被拒绝', async () => {
    const cookies = await loginAs(app, 'user_region_manager');

    await request(app.getHttpServer())
      .post('/api/v1/crm/opportunities')
      .set('Cookie', cookies)
      .send({
        title: '华东区域续签项目',
        customerId: 'customer_001',
        leadCode: 'LEAD-20260407-001',
        expectAmount: 400,
        expectSignDate: '2026-04-30',
        renewalContractCode: 'HT-2025-0099',
        agentFullName: '华东总代样例公司',
        projectStatusSummary: '客户已完成预算评审，等待最终商务确认',
        preSalesName: '张工',
        productAssets: [
          {
            productId: 'product_001',
          },
        ],
      })
      .expect(403);
  });
});

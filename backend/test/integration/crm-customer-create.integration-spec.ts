import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { loginAs } from '../auth-test.helper';
import { createTestApp } from '../test-app';

const CUSTOMER_CREATE_ENV_KEYS = [
  'CRM_CUSTOMER_CREATE_DEFAULT_CATEGORY',
  'CRM_CUSTOMER_CREATE_DEFAULT_SOURCE',
  'CRM_CUSTOMER_CREATE_IT_DECISION_LOCATION_FIELD',
  'CRM_CUSTOMER_CREATE_UNIFIED_SOCIAL_CREDIT_CODE_FIELD',
] as const;

describe('crm customer create integration', () => {
  let app: INestApplication;
  const originalEnv = new Map<string, string | undefined>();

  beforeEach(async () => {
    for (const key of CUSTOMER_CREATE_ENV_KEYS) {
      originalEnv.set(key, process.env[key]);
    }

    process.env.CRM_CUSTOMER_CREATE_DEFAULT_CATEGORY = '201';
    process.env.CRM_CUSTOMER_CREATE_DEFAULT_SOURCE = '400';
    process.env.CRM_CUSTOMER_CREATE_IT_DECISION_LOCATION_FIELD =
      'text_asset_it_decision_location';
    process.env.CRM_CUSTOMER_CREATE_UNIFIED_SOCIAL_CREDIT_CODE_FIELD =
      'text_asset_uscc';

    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();

    for (const key of CUSTOMER_CREATE_ENV_KEYS) {
      const value = originalEnv.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    originalEnv.clear();
  });

  it('应按截图必填字段创建客户并使用默认 CRM 字段值', async () => {
    const cookies = await loginAs(app, 'user_sales_director');

    const response = await request(app.getHttpServer())
      .post('/api/v1/crm/customers')
      .set('Cookie', cookies)
      .send({
        name: '华东样例客户',
        phone: '021-12345678',
        itDecisionLocation: '上海',
        unifiedSocialCreditCode: '91310000123456789A',
      })
      .expect(201);

    expect(response.body.customerId).toBeTruthy();
    expect(response.body.customerName).toBe('华东样例客户');
    expect(response.body.ownerId).toBe('user_sales_director');
    expect(response.body.departmentId).toBe('dept_sales');
    expect(response.body.phone).toBe('021-12345678');
    expect(response.body.message).toContain('mock');
  });

  it('缺少截图必填字段时应返回 400', async () => {
    const cookies = await loginAs(app, 'user_sales_director');

    const response = await request(app.getHttpServer())
      .post('/api/v1/crm/customers')
      .set('Cookie', cookies)
      .send({
        name: '华东样例客户',
        itDecisionLocation: '上海',
        unifiedSocialCreditCode: '91310000123456789A',
      })
      .expect(400);

    expect(String(response.body.message)).toContain('电话不能为空');
  });

  it('缺少自定义字段映射配置时应返回 400', async () => {
    const cookies = await loginAs(app, 'user_sales_director');
    delete process.env.CRM_CUSTOMER_CREATE_IT_DECISION_LOCATION_FIELD;

    const response = await request(app.getHttpServer())
      .post('/api/v1/crm/customers')
      .set('Cookie', cookies)
      .send({
        name: '华东样例客户',
        phone: '021-12345678',
        itDecisionLocation: '上海',
        unifiedSocialCreditCode: '91310000123456789A',
      })
      .expect(400);

    expect(String(response.body.message)).toContain(
      'CRM_CUSTOMER_CREATE_IT_DECISION_LOCATION_FIELD',
    );
  });

  it('缺少 wecom.customer.create 的用户应被拒绝', async () => {
    const cookies = await loginAs(app, 'user_region_manager');

    await request(app.getHttpServer())
      .post('/api/v1/crm/customers')
      .set('Cookie', cookies)
      .send({
        name: '华东样例客户',
        phone: '021-12345678',
        itDecisionLocation: '上海',
        unifiedSocialCreditCode: '91310000123456789A',
      })
      .expect(403);
  });
});

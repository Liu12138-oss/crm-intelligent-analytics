import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { loginAs } from '../auth-test.helper';
import { createTestApp } from '../test-app';
import { RolePermissionRepository } from '../../src/modules/governance/role-permission.repository';

describe('ai model governance contract', () => {
  let app: INestApplication;
  const originalFetch = global.fetch;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        output_text: '{"status":"OK"}',
        choices: [
          {
            message: {
              content: '{"status":"OK"}',
            },
          },
        ],
      }),
      text: jest.fn().mockResolvedValue('{"output_text":"{\\"status\\":\\"OK\\"}"}'),
    } as unknown as Response);
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    await app.close();
  });

  it('管理员应可创建、查询并激活 OpenAI 兼容 HTTP Profile，且密钥不回显', async () => {
    const adminCookies = await loginAs(app, 'user_admin');

    const created = await request(app.getHttpServer())
      .post('/api/v1/governance/ai-models')
      .set('Cookie', adminCookies)
      .send({
        name: 'OpenAI 兼容 HTTP 主配置',
        providerCode: 'internal-openai-gateway',
        sdkType: 'openai-compatible-http',
        model: 'gpt-5.4',
        baseUrl: 'https://gateway.example.com/v1',
        apiKey: 'secret-openai-compatible-key',
        sdkOptions: {
          wireApi: 'responses',
          structuredOutputMode: 'json_schema',
          disableResponseStorage: true,
        },
      })
      .expect(201);

    expect(created.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: 'OpenAI 兼容 HTTP 主配置',
        secretConfigured: true,
        secretMask: '已配置',
      }),
    );
    expect(created.body.apiKey).toBeUndefined();

    const list = await request(app.getHttpServer())
      .get('/api/v1/governance/ai-models')
      .set('Cookie', adminCookies)
      .expect(200);

    expect(list.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.body.id,
          providerCode: 'internal-openai-gateway',
          sdkType: 'openai-compatible-http',
          secretConfigured: true,
          secretMask: '已配置',
        }),
      ]),
    );

    const healthCheck = await request(app.getHttpServer())
      .post(`/api/v1/governance/ai-models/${created.body.id}/health-check`)
      .set('Cookie', adminCookies)
      .expect(200);

    expect(healthCheck.body).toEqual(
      expect.objectContaining({
        status: 'SUCCEEDED',
        latencyMs: expect.any(Number),
        providerSummary: expect.any(String),
      }),
    );

    const activated = await request(app.getHttpServer())
      .post(`/api/v1/governance/ai-models/${created.body.id}/activate`)
      .set('Cookie', adminCookies)
      .expect(200);

    expect(activated.body).toEqual(
      expect.objectContaining({
        activeProfileId: created.body.id,
        activatedBy: 'user_admin',
      }),
    );
  });

  it('管理员应可读取并更新 AI 上下文治理策略，且变更写入审计中心', async () => {
    const adminCookies = await loginAs(app, 'user_admin');

    const current = await request(app.getHttpServer())
      .get('/api/v1/governance/ai-models/context-policy')
      .set('Cookie', adminCookies)
      .expect(200);

    expect(current.body).toEqual(
      expect.objectContaining({
        turnRetentionLimit: expect.any(Number),
        historySummaryMaxLength: expect.any(Number),
        latestQuestionMaxLength: expect.any(Number),
        latestSummaryMaxLength: expect.any(Number),
        analysisSessionIdleTimeoutSeconds: expect.any(Number),
        taskSessionIdleTimeoutSeconds: expect.any(Number),
      }),
    );

    const updated = await request(app.getHttpServer())
      .put('/api/v1/governance/ai-models/context-policy')
      .set('Cookie', adminCookies)
      .send({
        turnRetentionLimit: 10,
        historySummaryMaxLength: 520,
        latestQuestionMaxLength: 180,
        latestSummaryMaxLength: 720,
        analysisSessionIdleTimeoutSeconds: 1200,
        taskSessionIdleTimeoutSeconds: 5400,
      })
      .expect(200);

    expect(updated.body).toEqual(
      expect.objectContaining({
        turnRetentionLimit: 10,
        historySummaryMaxLength: 520,
        latestQuestionMaxLength: 180,
        latestSummaryMaxLength: 720,
        analysisSessionIdleTimeoutSeconds: 1200,
        taskSessionIdleTimeoutSeconds: 5400,
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
          eventType: 'AI_CONTEXT_POLICY_UPDATED',
        }),
      ]),
    );
  });

  it('管理员应可直接测试未保存草稿，且编辑时密钥留空也可复用旧密钥', async () => {
    const adminCookies = await loginAs(app, 'user_admin');

    const created = await request(app.getHttpServer())
      .post('/api/v1/governance/ai-models')
      .set('Cookie', adminCookies)
      .send({
        name: 'HTTP 草稿测试',
        providerCode: 'internal-openai-gateway',
        sdkType: 'openai-compatible-http',
        model: 'gpt-5.4',
        baseUrl: 'https://gateway.example.com/v1',
        apiKey: 'secret-openai-compatible-key',
        sdkOptions: {
          wireApi: 'responses',
          structuredOutputMode: 'json_schema',
        },
      })
      .expect(201);

    const draftHealthCheck = await request(app.getHttpServer())
      .post('/api/v1/governance/ai-models/draft-health-check')
      .set('Cookie', adminCookies)
      .send({
        profileId: created.body.id,
        name: 'HTTP 草稿测试',
        providerCode: 'internal-openai-gateway',
        sdkType: 'openai-compatible-http',
        model: 'gpt-5.4',
        baseUrl: 'https://gateway.example.com/v1',
        apiKey: '',
        sdkOptions: {
          wireApi: 'responses',
          structuredOutputMode: 'json_schema',
        },
      })
      .expect(200);

    expect(draftHealthCheck.body).toEqual(
      expect.objectContaining({
        status: 'SUCCEEDED',
        latencyMs: expect.any(Number),
      }),
    );
  });

  it('管理员应可更新并复制 AI Profile，且复制结果不继承激活状态', async () => {
    const adminCookies = await loginAs(app, 'user_admin');

    const created = await request(app.getHttpServer())
      .post('/api/v1/governance/ai-models')
      .set('Cookie', adminCookies)
      .send({
        name: 'HTTP 预发布',
        providerCode: 'internal-openai-gateway',
        sdkType: 'openai-compatible-http',
        model: 'gpt-5.4',
        baseUrl: 'https://gateway-pre.example.com/v1',
        apiKey: 'secret-openai-compatible-key',
        sdkOptions: {
          wireApi: 'responses',
          structuredOutputMode: 'json_schema',
        },
      })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .put(`/api/v1/governance/ai-models/${created.body.id}`)
      .set('Cookie', adminCookies)
      .send({
        name: 'HTTP 正式',
        providerCode: 'internal-openai-gateway',
        sdkType: 'openai-compatible-http',
        model: 'gpt-5.4',
        baseUrl: 'https://gateway.example.com/v1',
        apiKey: '',
        sdkOptions: {
          wireApi: 'responses',
          structuredOutputMode: 'json_schema',
        },
      })
      .expect(200);

    expect(updated.body).toEqual(
      expect.objectContaining({
        id: created.body.id,
        name: 'HTTP 正式',
        secretConfigured: true,
      }),
    );

    const copied = await request(app.getHttpServer())
      .post(`/api/v1/governance/ai-models/${created.body.id}/copy`)
      .set('Cookie', adminCookies)
      .expect(201);

    expect(copied.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: expect.stringContaining('HTTP 正式'),
        secretConfigured: false,
      }),
    );
    expect(copied.body.id).not.toBe(created.body.id);
  });

  it('管理员应可删除手工复制出的 AI Profile', async () => {
    const adminCookies = await loginAs(app, 'user_admin');

    const created = await request(app.getHttpServer())
      .post('/api/v1/governance/ai-models')
      .set('Cookie', adminCookies)
      .send({
        name: 'HTTP 可删除副本来源',
        providerCode: 'internal-openai-gateway',
        sdkType: 'openai-compatible-http',
        model: 'gpt-5.4',
        baseUrl: 'https://gateway.example.com/v1',
        apiKey: 'secret-openai-compatible-key',
        sdkOptions: {},
      })
      .expect(201);

    const copied = await request(app.getHttpServer())
      .post(`/api/v1/governance/ai-models/${created.body.id}/copy`)
      .set('Cookie', adminCookies)
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/governance/ai-models/${copied.body.id}`)
      .set('Cookie', adminCookies)
      .expect(200);

    const list = await request(app.getHttpServer())
      .get('/api/v1/governance/ai-models')
      .set('Cookie', adminCookies)
      .expect(200);

    expect(list.body.items.some((item: { id: string }) => item.id === copied.body.id)).toBe(
      false,
    );
  });

  it('管理员应可显式清空 AI Profile 密钥', async () => {
    const adminCookies = await loginAs(app, 'user_admin');

    const created = await request(app.getHttpServer())
      .post('/api/v1/governance/ai-models')
      .set('Cookie', adminCookies)
      .send({
        name: 'HTTP 清密钥测试',
        providerCode: 'internal-openai-gateway',
        sdkType: 'openai-compatible-http',
        model: 'gpt-5.4',
        baseUrl: 'https://gateway.example.com/v1',
        apiKey: 'secret-openai-compatible-key',
        sdkOptions: {},
      })
      .expect(201);

    const cleared = await request(app.getHttpServer())
      .post(`/api/v1/governance/ai-models/${created.body.id}/clear-secret`)
      .set('Cookie', adminCookies)
      .expect(200);

    expect(cleared.body).toEqual(
      expect.objectContaining({
        id: created.body.id,
        secretConfigured: false,
        secretMask: '未配置',
      }),
    );
  });

  it('Chat Completions 兼容平台 Profile 也应可通过健康检查并激活', async () => {
    const adminCookies = await loginAs(app, 'user_admin');

    const created = await request(app.getHttpServer())
      .post('/api/v1/governance/ai-models')
      .set('Cookie', adminCookies)
      .send({
        name: 'DeepSeek 主配置',
        providerCode: 'deepseek',
        sdkType: 'openai-compatible-http',
        model: 'deepseek-chat',
        baseUrl: 'https://deepseek.example.com/v1',
        apiKey: 'secret-openai-compatible-key',
        sdkOptions: {
          wireApi: 'chat_completions',
          structuredOutputMode: 'json_object',
        },
      })
      .expect(201);

    const healthCheck = await request(app.getHttpServer())
      .post(`/api/v1/governance/ai-models/${created.body.id}/health-check`)
      .set('Cookie', adminCookies)
      .expect(200);

    expect(healthCheck.body).toEqual(
      expect.objectContaining({
        status: 'SUCCEEDED',
      }),
    );

    const activated = await request(app.getHttpServer())
      .post(`/api/v1/governance/ai-models/${created.body.id}/activate`)
      .set('Cookie', adminCookies)
      .expect(200);

    expect(activated.body).toEqual(
      expect.objectContaining({
        activeProfileId: created.body.id,
      }),
    );
  });

  it('新增 OpenAI 兼容 HTTP Profile 时缺少服务地址应直接校验失败', async () => {
    const adminCookies = await loginAs(app, 'user_admin');

    await request(app.getHttpServer())
      .post('/api/v1/governance/ai-models')
      .set('Cookie', adminCookies)
      .send({
        name: 'HTTP 主配置',
        providerCode: 'internal-openai-gateway',
        sdkType: 'openai-compatible-http',
        model: 'gpt-5.4',
        apiKey: 'secret-openai-compatible-key',
        sdkOptions: {
          wireApi: 'responses',
          structuredOutputMode: 'json_schema',
        },
      })
      .expect(400);
  });

  it('AI 模型治理动作应写入审计中心', async () => {
    const adminCookies = await loginAs(app, 'user_admin');

    const created = await request(app.getHttpServer())
      .post('/api/v1/governance/ai-models')
      .set('Cookie', adminCookies)
      .send({
        name: '审计测试 Profile',
        providerCode: 'internal-openai-gateway',
        sdkType: 'openai-compatible-http',
        model: 'gpt-5.4',
        baseUrl: 'https://gateway.example.com/v1',
        apiKey: 'secret-openai-compatible-key',
        sdkOptions: {},
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/governance/ai-models/${created.body.id}/health-check`)
      .set('Cookie', adminCookies)
      .expect(200);

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
          eventType: 'AI_MODEL_PROFILE_CREATED',
        }),
        expect.objectContaining({
          eventType: 'AI_MODEL_PROFILE_HEALTH_CHECKED',
        }),
      ]),
    );
  });

  it('管理员应可查询 Profile 详情并切换启停状态', async () => {
    const adminCookies = await loginAs(app, 'user_admin');

    const created = await request(app.getHttpServer())
      .post('/api/v1/governance/ai-models')
      .set('Cookie', adminCookies)
      .send({
        name: 'HTTP 预发布',
        providerCode: 'internal-openai-gateway',
        sdkType: 'openai-compatible-http',
        model: 'gpt-5.4',
        baseUrl: 'https://gateway.example.com/v1',
        apiKey: 'secret-openai-compatible-key',
        sdkOptions: {},
      })
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/governance/ai-models/${created.body.id}`)
      .set('Cookie', adminCookies)
      .expect(200);

    expect(detail.body).toEqual(
      expect.objectContaining({
        id: created.body.id,
        name: 'HTTP 预发布',
        secretConfigured: true,
        secretMask: '已配置',
      }),
    );

    const disabled = await request(app.getHttpServer())
      .post(`/api/v1/governance/ai-models/${created.body.id}/status`)
      .set('Cookie', adminCookies)
      .send({
        status: 'INACTIVE',
      })
      .expect(200);

    expect(disabled.body).toEqual(
      expect.objectContaining({
        id: created.body.id,
        status: 'INACTIVE',
      }),
    );
  });

  it('未通过测试的 Profile 不得激活', async () => {
    const adminCookies = await loginAs(app, 'user_admin');

    const created = await request(app.getHttpServer())
      .post('/api/v1/governance/ai-models')
      .set('Cookie', adminCookies)
      .send({
        name: 'HTTP 主配置',
        providerCode: 'internal-openai-gateway',
        sdkType: 'openai-compatible-http',
        model: 'gpt-5.4',
        baseUrl: 'https://gateway.example.com/v1',
        apiKey: 'secret-openai-compatible-key',
        sdkOptions: {},
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/governance/ai-models/${created.body.id}/activate`)
      .set('Cookie', adminCookies)
      .expect(400);
  });

  it('非管理员不得访问 AI 模型治理接口', async () => {
    const userCookies = await loginAs(app, 'user_sales_director');

    await request(app.getHttpServer())
      .get('/api/v1/governance/ai-models')
      .set('Cookie', userCookies)
      .expect(403);
  });

  it('被授予 ai_profile.manage 的非管理员也应可访问 AI 模型治理接口', async () => {
    const userCookies = await loginAs(app, 'user_sales_director');
    const rolePermissionRepository = app.get(RolePermissionRepository);

    rolePermissionRepository.save({
      roleId: 'role_sales_director',
      roleNameSnapshot: '销售总监',
      status: 'ACTIVE',
      visibleMenus: ['ai-model-governance'],
      actionKeys: ['ai_profile.manage'],
      webConsoleEnabled: true,
      wecomBotEligible: true,
      exportAllowed: false,
      templateManageAllowed: false,
      contractReviewUploadAllowed: false,
      contractReviewCrossViewAllowed: false,
      contractReviewCrossDownloadAllowed: false,
      updatedBy: 'user_admin',
      updatedAt: new Date().toISOString(),
    });

    await request(app.getHttpServer())
      .get('/api/v1/governance/ai-models')
      .set('Cookie', userCookies)
      .expect(200);
  });
});

import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppStorageService } from '../../src/database/app-storage/app-storage.service';
import { CrmReadonlyService } from '../../src/database/crm-readonly/crm-readonly.service';
import { QueryTemplateService } from '../../src/modules/query-assets/query-template.service';
import { CRM_USERS } from '../../src/shared/mock/sample-data';
import { WecomWebLoginService } from '../../src/modules/auth/wecom-web-login.service';
import { createTestApp } from '../test-app';

describe('auth session integration', () => {
  let app: INestApplication;
  let appStorageService: AppStorageService;
  let wecomWebLoginService: WecomWebLoginService;
  let crmReadonlyService: CrmReadonlyService;
  let queryTemplateService: QueryTemplateService;
  const originalWecomWebLoginAppId = process.env.WECOM_WEB_LOGIN_APP_ID;
  const originalWecomWebLoginSecret = process.env.WECOM_WEB_LOGIN_SECRET;

  beforeAll(async () => {
    process.env.WECOM_WEB_LOGIN_APP_ID =
      process.env.WECOM_WEB_LOGIN_APP_ID ?? 'mock-corpid';
    process.env.WECOM_WEB_LOGIN_SECRET =
      process.env.WECOM_WEB_LOGIN_SECRET ?? 'mock-web-login-secret';
    app = await createTestApp();
    appStorageService = app.get(AppStorageService);
    wecomWebLoginService = app.get(WecomWebLoginService);
    crmReadonlyService = app.get(CrmReadonlyService);
    queryTemplateService = app.get(QueryTemplateService);
  });

  afterAll(async () => {
    await app.close();

    if (originalWecomWebLoginAppId === undefined) {
      delete process.env.WECOM_WEB_LOGIN_APP_ID;
    } else {
      process.env.WECOM_WEB_LOGIN_APP_ID = originalWecomWebLoginAppId;
    }

    if (originalWecomWebLoginSecret === undefined) {
      delete process.env.WECOM_WEB_LOGIN_SECRET;
    } else {
      process.env.WECOM_WEB_LOGIN_SECRET = originalWecomWebLoginSecret;
    }
  });

  beforeEach(() => {
    appStorageService.state.pendingWecomBindings = [];
    jest.restoreAllMocks();
  });

  it('账号密码登录成功后应建立本地会话并访问受保护接口', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        login: 'director',
        password: 'director123',
        corpId: 'mock-corp',
      })
      .expect(201);

    const cookies = loginResponse.headers['set-cookie'];
    expect(cookies?.[0]).toContain('crm_auth_session=');

    const sessionResponse = await request(app.getHttpServer())
      .get('/api/v1/auth/session')
      .set('Cookie', cookies)
      .expect(200);

    expect(sessionResponse.body.authenticated).toBe(true);
    expect(sessionResponse.body.user.name).toBe('销售总监');

    const capabilityResponse = await request(app.getHttpServer())
      .get('/api/v1/analysis/capabilities')
      .set('Cookie', cookies)
      .expect(200);

    expect(capabilityResponse.body.roleNames).toContain('销售总监');
  });

  it('超级管理员能力快照应包含全部启用模板数量', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        login: 'admin',
        password: 'admin123',
        corpId: 'mock-corp',
      })
      .expect(201);

    const capabilityResponse = await request(app.getHttpServer())
      .get('/api/v1/analysis/capabilities')
      .set('Cookie', loginResponse.headers['set-cookie'])
      .expect(200);

    const templateResponse = await request(app.getHttpServer())
      .get('/api/v1/analysis/templates')
      .set('Cookie', loginResponse.headers['set-cookie'])
      .expect(200);

    expect(capabilityResponse.body.templateCount).toBe(templateResponse.body.items.length);
  });

  it('连续读取能力快照时应复用短时能力结果而不是重复重算模板可见数', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        login: 'director',
        password: 'director123',
        corpId: 'mock-corp',
      })
      .expect(201);
    const visibleTemplateSpy = jest.spyOn(queryTemplateService, 'listVisible');

    await request(app.getHttpServer())
      .get('/api/v1/analysis/capabilities')
      .set('Cookie', loginResponse.headers['set-cookie'])
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/analysis/capabilities')
      .set('Cookie', loginResponse.headers['set-cookie'])
      .expect(200);

    expect(visibleTemplateSpy).toHaveBeenCalledTimes(1);
  });

  it('账号密码错误时应拒绝登录', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        login: 'director',
        password: 'wrong-password',
        corpId: 'mock-corp',
      })
      .expect(401);
  });

  it('登出后应无法继续读取当前会话', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        login: 'manager',
        password: 'manager123',
        corpId: 'mock-corp',
      })
      .expect(201);

    const cookies = loginResponse.headers['set-cookie'];

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', cookies)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/auth/session')
      .set('Cookie', cookies)
      .expect(401);
  });

  it('仅携带裸用户标识时应拒绝访问受保护接口', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/analysis/capabilities')
      .set('x-crm-user-id', 'user_sales_director')
      .expect(401);
  });

  it('已存在 CRM 原生映射时应可直接扫码登录', async () => {
    const mappedUser = CRM_USERS.find((item) => item.id === 'user_sales_director');
    if (!mappedUser) {
      throw new Error('缺少测试所需的销售总监用户。');
    }
    jest.spyOn(wecomWebLoginService, 'resolveCallbackUser').mockResolvedValue({
      kind: 'user',
      user: { ...mappedUser, identitySource: 'database' },
    });

    const initiateResponse = await request(app.getHttpServer())
      .get('/api/v1/auth/wecom/initiate')
      .expect(200);

    const stateCookie = initiateResponse.headers['set-cookie'];
    const callbackResponse = await request(app.getHttpServer())
      .get('/api/v1/auth/wecom/callback')
      .set('Cookie', stateCookie)
      .query({
        state: initiateResponse.body.state,
        code: 'mock-wecom-direct-login',
      })
      .expect(302);

    expect(callbackResponse.headers.location).toContain('/login?');
    expect(callbackResponse.headers.location).toContain(
      `code=${encodeURIComponent('mock-wecom-direct-login')}`,
    );

    const exchangeResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/wecom/exchange')
      .set('Cookie', stateCookie)
      .send({
        code: 'mock-wecom-direct-login',
        state: initiateResponse.body.state,
      })
      .expect(201);

    expect(exchangeResponse.headers['set-cookie'][0]).toContain('crm_auth_session=');
    expect(exchangeResponse.body.authenticated).toBe(true);
  });

  it('数据库身份会话连续访问多个受保护接口时应复用实时身份解析结果', async () => {
    const mappedUser = CRM_USERS.find((item) => item.id === 'user_sales_director');
    if (!mappedUser) {
      throw new Error('缺少测试所需的销售总监用户。');
    }
    const mockedDatabaseUser = { ...mappedUser, identitySource: 'database' as const };
    jest.spyOn(wecomWebLoginService, 'resolveCallbackUser').mockResolvedValue({
      kind: 'user',
      user: mockedDatabaseUser,
    });
    const readonlyUserSpy = jest
      .spyOn(crmReadonlyService, 'getUserById')
      .mockResolvedValue(mockedDatabaseUser);

    const initiateResponse = await request(app.getHttpServer())
      .get('/api/v1/auth/wecom/initiate')
      .expect(200);

    const exchangeResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/wecom/exchange')
      .set('Cookie', initiateResponse.headers['set-cookie'])
      .send({
        code: 'mock-wecom-direct-login-cached-session',
        state: initiateResponse.body.state,
      })
      .expect(201);

    const cookies = exchangeResponse.headers['set-cookie'];

    await request(app.getHttpServer())
      .get('/api/v1/auth/session')
      .set('Cookie', cookies)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/analysis/capabilities')
      .set('Cookie', cookies)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/analysis/templates')
      .set('Cookie', cookies)
      .expect(200);

    expect(readonlyUserSpy).not.toHaveBeenCalled();
  });

  it('扫码未命中时用户名密码绑定后应写回 CRM 原生映射', async () => {
    const bindToken = 'wecom-bind-token-001';
    const bindPrompt = '当前企业微信账号尚未形成可用的 CRM 身份映射，请先输入一次账号密码完成绑定。完成后，后续可直接扫码登录。';
    const now = Date.now();
    appStorageService.state.pendingWecomBindings = [{
      id: 'pending_bind_001',
      bindToken,
      state: 'bind_state_001',
      wecomUserId: 'wx_bind_user_001',
      wecomUserName: '待绑定销售',
      mobile: 'wx_bind_user_001',
      email: 'wx_bind_user_001@example.com',
      prompt: bindPrompt,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 10 * 60 * 1000).toISOString(),
    }];
    jest.spyOn(wecomWebLoginService, 'resolveCallbackUser').mockResolvedValue({
      kind: 'bind_required',
      bindToken,
      wecomUserId: 'wx_bind_user_001',
      wecomUserName: '待绑定销售',
      prompt: bindPrompt,
    });

    const initiateResponse = await request(app.getHttpServer())
      .get('/api/v1/auth/wecom/initiate')
      .expect(200);

    const callbackResponse = await request(app.getHttpServer())
      .get('/api/v1/auth/wecom/callback')
      .set('Cookie', initiateResponse.headers['set-cookie'])
      .query({
        state: initiateResponse.body.state,
        code: 'mock-wecom-bind-login',
      })
      .expect(302);

    const redirectUrl = new URL(callbackResponse.headers.location);
    expect(redirectUrl.pathname).toBe('/login');

    const exchangeResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/wecom/exchange')
      .set('Cookie', initiateResponse.headers['set-cookie'])
      .send({
        code: 'mock-wecom-bind-login',
        state: initiateResponse.body.state,
      })
      .expect(401);

    const bindPromptPayload = exchangeResponse.body as { message?: string };
    expect(bindPromptPayload.message).toContain('当前企业微信账号尚未形成可用的 CRM 身份映射');

    expect(appStorageService.state.pendingWecomBindings[0]?.bindToken).toBe(bindToken);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        login: 'admin',
        password: 'admin123',
        corpId: 'mock-corp',
        wecomBindToken: bindToken,
      })
      .expect(201);

    expect(loginResponse.headers['set-cookie'][0]).toContain('crm_auth_session=');
    expect(
      appStorageService.state.crmWxUsers.some(
        (item) => item.userid === 'wx_bind_user_001',
      ),
    ).toBe(true);

    const createdWxUser = appStorageService.state.crmWxUsers.find(
      (item) => item.userid === 'wx_bind_user_001',
    );
    expect(createdWxUser).toBeDefined();
    expect(
      appStorageService.state.crmWxUserMaps.some(
        (item) =>
          item.wxUserId === createdWxUser?.id &&
          item.crmUserId === 'user_admin',
      ),
    ).toBe(true);
    expect(appStorageService.state.pendingWecomBindings).toHaveLength(0);
  });
});

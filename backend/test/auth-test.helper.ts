import request from 'supertest';
import type { INestApplication } from '@nestjs/common';

const AUTH_FIXTURES: Record<
  string,
  { login: string; password: string; corpId: string }
> = {
  user_sales_director: {
    login: 'director',
    password: 'director123',
    corpId: 'mock-corp',
  },
  user_region_manager: {
    login: 'manager',
    password: 'manager123',
    corpId: 'mock-corp',
  },
  user_admin: {
    login: 'admin',
    password: 'admin123',
    corpId: 'mock-corp',
  },
};

export async function loginAs(
  app: INestApplication,
  userId: keyof typeof AUTH_FIXTURES,
): Promise<string[]> {
  const fixture = AUTH_FIXTURES[userId];
  if (!fixture) {
    throw new Error(`未配置测试登录账号：${userId}`);
  }

  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send(fixture)
    .expect(201);

  const cookies = response.headers['set-cookie'];
  if (!Array.isArray(cookies) || cookies.length === 0) {
    throw new Error(`测试登录未返回 Cookie：${userId}`);
  }

  return cookies;
}

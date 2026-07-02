import { resolveAllowedCorsOrigins } from '../src/shared/http/cors-options';

describe('resolveAllowedCorsOrigins', () => {
  it('应额外放行通过运行配置声明的前端访问来源', () => {
    expect(
      resolveAllowedCorsOrigins([
        'http://10.20.13.53:5173/login',
        'http://127.0.0.1:5173/analysis',
      ]),
    ).toEqual([
      'http://127.0.0.1:5173',
      'http://localhost:5173',
      'http://10.8.11.61:5173',
      'http://10.20.13.53:5173',
    ]);
  });
});

import { buildWebAppUrl } from '../../src/shared/utils/web-app-url.util';

describe('web app url util', () => {
  it('应把带前缀的 Web 根地址与相对页面路径正确拼接', () => {
    expect(buildWebAppUrl('http://10.10.3.241/insight', '/login')).toBe(
      'http://10.10.3.241/insight/login',
    );
  });

  it('根路径部署时应继续保持原有页面地址结构', () => {
    expect(buildWebAppUrl('http://10.10.3.241', 'login')).toBe(
      'http://10.10.3.241/login',
    );
  });
});

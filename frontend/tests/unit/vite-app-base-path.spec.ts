// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { resolveViteAppBasePath } from '../../vite-app-base-path';

describe('vite app base path', () => {
  it('应优先读取前端环境中的 VITE_APP_BASE_PATH', () => {
    const loadEnvMock = vi.fn(() => ({
      VITE_APP_BASE_PATH: '/insight/',
      APP_WEB_BASE_URL: 'http://10.10.3.241/ignored',
    }));

    expect(resolveViteAppBasePath('production', process.cwd(), loadEnvMock)).toBe(
      '/insight/',
    );
  });

  it('未显式提供 VITE_APP_BASE_PATH 时，应回退到 APP_WEB_BASE_URL 的 pathname', () => {
    const loadEnvMock = vi.fn(() => ({
      APP_WEB_BASE_URL: 'http://10.10.3.241/insight',
    }));

    expect(resolveViteAppBasePath('production', process.cwd(), loadEnvMock)).toBe(
      '/insight/',
    );
  });
});

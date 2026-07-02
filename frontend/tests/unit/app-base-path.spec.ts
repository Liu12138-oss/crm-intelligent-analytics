import { describe, expect, it } from 'vitest';
import { normalizeAppBasePath } from '@/utils/app-base-path';

describe('app base path', () => {
  it('应把普通路径前缀归一化为带首尾斜杠的形式', () => {
    expect(normalizeAppBasePath('/insight')).toBe('/insight/');
  });

  it('应能从完整访问地址中提取前端基路径', () => {
    expect(normalizeAppBasePath('http://10.10.3.241/insight')).toBe('/insight/');
  });

  it('未配置时应回退到根路径', () => {
    expect(normalizeAppBasePath(undefined)).toBe('/');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('http client error message', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('应把后端技术错误归一化为用户友好提示', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          message: '模板 SQL 访问了未授权数据表：departments',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    ) as typeof fetch;

    const { httpClient } = await import('@/services/http-client');

    await expect(httpClient.get('/analysis/templates')).rejects.toThrow(
      '当前查询暂时无法执行，因为它超出了系统允许的分析范围。请换一个已开通的查询，或联系管理员调整配置后再试。',
    );
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('http client timeout override', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it('应允许单次请求覆盖默认超时阈值', async () => {
    let activeSignal: AbortSignal | undefined;
    globalThis.fetch = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) => {
        activeSignal = init?.signal as AbortSignal | undefined;
        return new Promise<Response>(() => undefined);
      },
    ) as typeof fetch;
    const { httpClient } = await import('@/services/http-client');

    void httpClient.post(
      '/governance/ai-models/draft-health-check',
      { profileId: 'profile_claude' },
      { timeoutMs: 50 },
    );

    await vi.advanceTimersByTimeAsync(49);
    expect(activeSignal?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(activeSignal?.aborted).toBe(true);
  });
});

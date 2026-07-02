import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();

vi.mock('@/services/http-client', () => ({
  httpClient: {
    post,
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    postForm: vi.fn(),
  },
}));

describe('analysis service timeout options', () => {
  beforeEach(() => {
    post.mockReset();
  });

  it('AI Profile 草稿测试应使用更长的请求超时', async () => {
    post.mockResolvedValueOnce({
      status: 'SUCCEEDED',
      latencyMs: 1,
      providerSummary: 'anthropic-claude:claude-sonnet-4-20250514',
    });
    const { analysisService } = await import('@/services/analysis.service');

    await analysisService.draftHealthCheckAiModelProfile({
      profileId: 'profile_claude',
    });

    expect(post).toHaveBeenCalledWith(
      '/governance/ai-models/draft-health-check',
      { profileId: 'profile_claude' },
      expect.objectContaining({
        timeoutMs: 90000,
      }),
    );
  });

  it('AI Profile 激活应使用更长的请求超时', async () => {
    post.mockResolvedValueOnce({
      activeProfileId: 'profile_claude',
    });
    const { analysisService } = await import('@/services/analysis.service');

    await analysisService.activateAiModelProfile('profile_claude');

    expect(post).toHaveBeenCalledWith(
      '/governance/ai-models/profile_claude/activate',
      undefined,
      expect.objectContaining({
        timeoutMs: 90000,
      }),
    );
  });

  it('问数创建应使用更长的请求超时，避免后端已完成但前端提前超时', async () => {
    post.mockResolvedValueOnce({
      queryId: 'query_001',
      status: 'RETURNED',
    });
    const { analysisService } = await import('@/services/analysis.service');

    await analysisService.createQuery({
      querySource: 'FREE_TEXT',
      channel: 'web-console',
      questionText: '请分析今年一月份的商机情况',
    });

    expect(post).toHaveBeenCalledWith(
      '/analysis/queries',
      expect.objectContaining({
        questionText: '请分析今年一月份的商机情况',
      }),
      expect.objectContaining({
        timeoutMs: 60000,
      }),
    );
  });

  it('最近查询重跑应沿用更长的请求超时', async () => {
    post.mockResolvedValueOnce({
      queryId: 'query_002',
      status: 'RETURNED',
    });
    const { analysisService } = await import('@/services/analysis.service');

    await analysisService.rerunHistory('history_001', {
      channel: 'web-console',
    });

    expect(post).toHaveBeenCalledWith(
      '/analysis/histories/history_001/rerun',
      {
        channel: 'web-console',
      },
      expect.objectContaining({
        timeoutMs: 60000,
      }),
    );
  });

  it('AI 分析报告补全应使用覆盖后端长等待窗口的请求超时', async () => {
    post.mockResolvedValueOnce({
      queryId: 'query_report_001',
      status: 'READY',
    });
    const { analysisService } = await import('@/services/analysis.service');

    await analysisService.getQueryReport('query_report_001', {
      waitMs: 55000,
    });

    expect(post).toHaveBeenCalledWith(
      '/analysis/queries/query_report_001/report',
      {
        waitMs: 55000,
      },
      expect.objectContaining({
        timeoutMs: 65000,
      }),
    );
  });
});

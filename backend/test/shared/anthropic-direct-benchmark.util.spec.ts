import {
  buildAnthropicDirectBenchmarkBody,
  buildAnthropicDirectHeaders,
  resolveAnthropicMessagesUrl,
} from '../../src/shared/utils/anthropic-direct-benchmark.util';

describe('anthropic direct benchmark util', () => {
  it('应把基础网关地址转换成 messages 接口地址', () => {
    expect(resolveAnthropicMessagesUrl('https://api.anthropic.com')).toBe(
      'https://api.anthropic.com/v1/messages',
    );
    expect(resolveAnthropicMessagesUrl('https://gateway.example.com/v1')).toBe(
      'https://gateway.example.com/v1/messages',
    );
    expect(
      resolveAnthropicMessagesUrl('https://gateway.example.com/v1/messages'),
    ).toBe('https://gateway.example.com/v1/messages');
  });

  it('应按鉴权来源构造直连 API 请求头', () => {
    expect(
      buildAnthropicDirectHeaders({
        apiKey: 'api-key',
      }),
    ).toMatchObject({
      'x-api-key': 'api-key',
      'anthropic-version': '2023-06-01',
    });

    expect(
      buildAnthropicDirectHeaders({
        authToken: 'auth-token',
      }),
    ).toMatchObject({
      Authorization: 'Bearer auth-token',
      'anthropic-version': '2023-06-01',
    });
  });

  it('应按 effort 生成 Claude 直连 benchmark 请求体', () => {
    expect(
      buildAnthropicDirectBenchmarkBody({
        model: 'claude-sonnet-4-20250514',
        prompt: '请只返回 OK',
        effort: 'high',
      }),
    ).toEqual({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 128,
      messages: [
        {
          role: 'user',
          content: '请只返回 OK',
        },
      ],
      output_config: {
        effort: 'high',
      },
    });
  });
});

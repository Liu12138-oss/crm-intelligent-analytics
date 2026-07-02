export function resolveAnthropicMessagesUrl(baseUrl: string): string {
  const trimmedBaseUrl = baseUrl.trim();
  if (
    trimmedBaseUrl.endsWith('/messages') ||
    trimmedBaseUrl.endsWith('/v1/messages')
  ) {
    return trimmedBaseUrl;
  }

  if (trimmedBaseUrl.endsWith('/v1')) {
    return `${trimmedBaseUrl}/messages`;
  }

  return `${trimmedBaseUrl.replace(/\/$/, '')}/v1/messages`;
}

export function buildAnthropicDirectHeaders(params: {
  apiKey?: string;
  authToken?: string;
}): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'anthropic-version': '2023-06-01',
  };

  if (params.apiKey?.trim()) {
    headers['x-api-key'] = params.apiKey.trim();
  }

  if (!params.apiKey?.trim() && params.authToken?.trim()) {
    headers.Authorization = `Bearer ${params.authToken.trim()}`;
  }

  return headers;
}

export function buildAnthropicDirectBenchmarkBody(params: {
  model: string;
  prompt: string;
  effort: 'low' | 'medium' | 'high' | 'max';
}): Record<string, unknown> {
  return {
    model: params.model,
    max_tokens: 128,
    messages: [
      {
        role: 'user',
        content: params.prompt,
      },
    ],
    output_config: {
      effort: params.effort,
    },
  };
}

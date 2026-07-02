import { OpenAiCompatibleHttpAdapter } from '../../../src/modules/ai-models/adapters/openai-compatible-http.adapter';
import type { AiExecutableProfile } from '../../../src/modules/ai-models/adapters/ai-provider.adapter';

describe('OpenAiCompatibleHttpAdapter', () => {
  const originalFetch = global.fetch;

  function createProfile(
    overrides: Partial<AiExecutableProfile> = {},
  ): AiExecutableProfile {
    return {
      id: 'profile_http',
      name: 'OpenAI 兼容 HTTP',
      providerCode: 'internal-openai-gateway',
      sdkType: 'openai-compatible-http',
      model: 'gpt-5.4',
      baseUrl: 'https://gateway.example.com/v1',
      apiKey: 'secret-openai-compatible-key',
      secretConfigured: true,
      status: 'ACTIVE',
      sdkOptions: {
        wireApi: 'responses',
        structuredOutputMode: 'json_schema',
        disableResponseStorage: true,
      },
      createdBy: 'user_admin',
      updatedBy: 'user_admin',
      createdAt: '2026-04-20T10:00:00.000Z',
      updatedAt: '2026-04-20T10:00:00.000Z',
      ...overrides,
    };
  }

  function mockJsonResponse(body: unknown, status = 200): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: jest.fn().mockResolvedValue(body),
      text: jest.fn().mockResolvedValue(JSON.stringify(body)),
    } as unknown as Response;
  }

  beforeEach(() => {
    jest.useRealTimers();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('缺少密钥时应静态校验失败', () => {
    const adapter = new OpenAiCompatibleHttpAdapter();

    expect(() =>
      adapter.validateProfile(
        createProfile({
          apiKey: '',
          secretConfigured: false,
        }),
      ),
    ).toThrow('OpenAI 兼容 HTTP Profile 缺少 API 密钥。');
  });

  it('健康检查应走最小结构化调用，而不是仅验证纯文本', async () => {
    const adapter = new OpenAiCompatibleHttpAdapter();
    const fetchMock = jest.mocked(global.fetch);
    fetchMock.mockResolvedValue(
      mockJsonResponse({
        choices: [
          {
            message: {
              content: '{"status":"OK"}',
            },
          },
        ],
      }),
    );

    const result = await adapter.healthCheck(
      createProfile({
        providerCode: 'anthropic-claude',
        model: 'claude-sonnet-4-20250514',
        sdkOptions: {
          wireApi: 'chat_completions',
          structuredOutputMode: 'json_object',
        },
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 'SUCCEEDED',
      }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      messages: expect.any(Array),
      response_format: {
        type: 'json_object',
      },
    });
  });

  it('Responses 文本调用应拼接 /responses 并禁用响应存储', async () => {
    const adapter = new OpenAiCompatibleHttpAdapter();
    const fetchMock = jest.mocked(global.fetch);
    fetchMock.mockResolvedValue(
      mockJsonResponse({
        output_text: 'OK',
      }),
    );

    const result = await adapter.invokeText({
      profile: createProfile(),
      system: '你是 CRM 助手。',
      prompt: '请只返回 OK',
    });

    expect(result).toBe('OK');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://gateway.example.com/v1/responses',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer secret-openai-compatible-key',
        }),
        body: expect.any(String),
      }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      model: 'gpt-5.4',
      input: '请只返回 OK',
      instructions: '你是 CRM 助手。',
      store: false,
    });
  });

  it('Responses 结构化调用应发送 text.format.json_schema 并解析最终 JSON', async () => {
    const adapter = new OpenAiCompatibleHttpAdapter();
    const fetchMock = jest.mocked(global.fetch);
    fetchMock.mockResolvedValue(
      mockJsonResponse({
        output: [
          {
            content: [
              {
                type: 'output_text',
                text: '{"intent":"ANALYZE"}',
              },
            ],
          },
        ],
      }),
    );

    const result = await adapter.invokeStructured({
      profile: createProfile(),
      prompt: '识别意图',
      outputSchema: {
        type: 'object',
        required: ['intent'],
        additionalProperties: false,
        properties: {
          intent: {
            type: 'string',
            enum: ['ANALYZE', 'BLOCK'],
          },
        },
      },
    });

    expect(result).toEqual({ intent: 'ANALYZE' });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      text: {
        format: {
          type: 'json_schema',
          name: 'crm_structured_output',
          strict: true,
        },
      },
    });
  });

  it('Responses 结构化调用应兼容 output_text 内容块字段', async () => {
    const adapter = new OpenAiCompatibleHttpAdapter();
    const fetchMock = jest.mocked(global.fetch);
    fetchMock.mockResolvedValue(
      mockJsonResponse({
        output: [
          {
            content: [
              {
                type: 'output_text',
                output_text: '{"intent":"ANALYZE"}',
              },
            ],
          },
        ],
      }),
    );

    const result = await adapter.invokeStructured({
      profile: createProfile(),
      prompt: '识别意图',
      outputSchema: {
        type: 'object',
        required: ['intent'],
        additionalProperties: false,
        properties: {
          intent: {
            type: 'string',
            enum: ['ANALYZE', 'BLOCK'],
          },
        },
      },
    });

    expect(result).toEqual({ intent: 'ANALYZE' });
  });

  it('Chat Completions 结构化调用应兼容数组型 message.content', async () => {
    const adapter = new OpenAiCompatibleHttpAdapter();
    const fetchMock = jest.mocked(global.fetch);
    fetchMock.mockResolvedValue(
      mockJsonResponse({
        choices: [
          {
            message: {
              content: [
                {
                  type: 'text',
                  text: {
                    value: '{"intent":"ANALYZE"}',
                  },
                },
              ],
            },
          },
        ],
      }),
    );

    const result = await adapter.invokeStructured({
      profile: createProfile({
        sdkOptions: {
          wireApi: 'chat_completions',
          structuredOutputMode: 'json_schema',
        },
      }),
      prompt: '识别意图',
      outputSchema: {
        type: 'object',
        required: ['intent'],
        additionalProperties: false,
        properties: {
          intent: {
            type: 'string',
            enum: ['ANALYZE', 'BLOCK'],
          },
        },
      },
    });

    expect(result).toEqual({ intent: 'ANALYZE' });
  });

  it('Chat Completions json_schema 模式应发送 response_format.json_schema', async () => {
    const adapter = new OpenAiCompatibleHttpAdapter();
    const fetchMock = jest.mocked(global.fetch);
    fetchMock.mockResolvedValue(
      mockJsonResponse({
        choices: [
          {
            message: {
              content: '{"intent":"ANALYZE"}',
            },
          },
        ],
      }),
    );

    await adapter.invokeStructured({
      profile: createProfile({
        providerCode: 'qwen',
        model: 'qwen3-4b',
        sdkOptions: {
          wireApi: 'chat_completions',
          structuredOutputMode: 'json_schema',
        },
      }),
      prompt: '识别意图',
      outputSchema: {
        type: 'object',
        required: ['intent'],
        properties: {
          intent: { type: 'string' },
        },
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://gateway.example.com/v1/chat/completions',
      expect.any(Object),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      model: 'qwen3-4b',
      enable_thinking: false,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'crm_structured_output',
          strict: true,
        },
      },
    });
  });

  it('Qwen3 非流式文本调用应自动关闭 thinking 模式', async () => {
    const adapter = new OpenAiCompatibleHttpAdapter();
    const fetchMock = jest.mocked(global.fetch);
    fetchMock.mockResolvedValue(
      mockJsonResponse({
        choices: [
          {
            message: {
              content: 'OK',
            },
          },
        ],
      }),
    );

    const result = await adapter.invokeText({
      profile: createProfile({
        providerCode: 'qwen',
        model: 'qwen3-4b',
        sdkOptions: {
          wireApi: 'chat_completions',
          structuredOutputMode: 'json_object',
        },
      }),
      prompt: '请只返回 OK',
    });

    expect(result).toBe('OK');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      model: 'qwen3-4b',
      enable_thinking: false,
    });
  });

  it('capability request overrides 应优先覆盖 provider 默认值', async () => {
    const adapter = new OpenAiCompatibleHttpAdapter();
    const fetchMock = jest.mocked(global.fetch);
    fetchMock.mockResolvedValue(
      mockJsonResponse({
        choices: [
          {
            message: {
              content: '{"intent":"ANALYZE"}',
            },
          },
        ],
      }),
    );

    await adapter.invokeStructured({
      profile: createProfile({
        providerCode: 'qwen',
        model: 'qwen3-4b',
        sdkOptions: {
          wireApi: 'chat_completions',
          structuredOutputMode: 'json_schema',
        },
      }),
      prompt: '识别意图',
      outputSchema: {
        type: 'object',
        required: ['intent'],
        properties: {
          intent: { type: 'string' },
        },
      },
      requestOverrides: {
        structuredOutputMode: 'json_object',
        enableThinking: true,
      },
    });

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      enable_thinking: true,
      response_format: {
        type: 'json_object',
      },
    });
  });

  it('DeepSeek 结构化调用应能显式关闭 thinking 并提高输出上限', async () => {
    const adapter = new OpenAiCompatibleHttpAdapter();
    const fetchMock = jest.mocked(global.fetch);
    fetchMock.mockResolvedValue(
      mockJsonResponse({
        choices: [
          {
            message: {
              content: '{"intent":"ANALYZE"}',
            },
          },
        ],
      }),
    );

    await adapter.invokeStructured({
      profile: createProfile({
        providerCode: 'deepseek-v4-pro',
        model: 'deepseek-v4-pro',
        sdkOptions: {
          wireApi: 'responses',
          structuredOutputMode: 'json_schema',
        },
      }),
      prompt: '识别意图',
      outputSchema: {
        type: 'object',
        required: ['intent'],
        properties: {
          intent: { type: 'string' },
        },
      },
      requestOverrides: {
        wireApi: 'chat_completions',
        structuredOutputMode: 'json_object',
        enableThinking: false,
        maxTokens: 4096,
      },
    });

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      model: 'deepseek-v4-pro',
      max_tokens: 4096,
      enable_thinking: false,
      response_format: {
        type: 'json_object',
      },
    });
  });

  it('未知 capability request override 字段应直接拒绝', async () => {
    const adapter = new OpenAiCompatibleHttpAdapter();

    await expect(
      adapter.invokeText({
        profile: createProfile(),
        prompt: '请只返回 OK',
        requestOverrides: {
          unknownKey: true,
        } as unknown as Record<string, unknown>,
      }),
    ).rejects.toThrow('不支持的 capability request override 字段：unknownKey');
  });

  it('Chat Completions 请求应补齐 max_tokens，并兼容 content[].text 响应', async () => {
    const adapter = new OpenAiCompatibleHttpAdapter();
    const fetchMock = jest.mocked(global.fetch);
    fetchMock.mockResolvedValue(
      mockJsonResponse({
        id: 'msg_001',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'OK',
          },
        ],
      }),
    );

    const result = await adapter.invokeText({
      profile: createProfile({
        providerCode: 'anthropic-claude',
        model: 'claude-sonnet-4-20250514',
        baseUrl: 'https://api.example.com/v1',
        sdkOptions: {
          wireApi: 'chat_completions',
          structuredOutputMode: 'json_object',
        },
      }),
      prompt: '请只返回 OK',
    });

    expect(result).toBe('OK');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      model: 'claude-sonnet-4-20250514',
      max_tokens: expect.any(Number),
    });
  });

  it('Chat Completions json_object 模式应发送 JSON mode 并追加中文 schema 约束', async () => {
    const adapter = new OpenAiCompatibleHttpAdapter();
    const fetchMock = jest.mocked(global.fetch);
    fetchMock.mockResolvedValue(
      mockJsonResponse({
        choices: [
          {
            message: {
              content: '{"status":"READY"}',
            },
          },
        ],
      }),
    );

    const result = await adapter.invokeStructured({
      profile: createProfile({
        providerCode: 'deepseek',
        model: 'deepseek-chat',
        sdkOptions: {
          wireApi: 'chat_completions',
          structuredOutputMode: 'json_object',
        },
      }),
      prompt: '输出状态',
      outputSchema: {
        type: 'object',
        required: ['status'],
        properties: {
          status: {
            type: 'string',
            enum: ['READY', 'BLOCKED'],
          },
        },
      },
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(result).toEqual({ status: 'READY' });
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[0].content).toContain('只返回 JSON');
    expect(body.messages[0].content).toContain('status');
    expect(body.messages[0].content).toContain('READY');
  });

  it('Chat Completions 将结构化结果放入 tool_calls.function.arguments 时应能解析', async () => {
    const adapter = new OpenAiCompatibleHttpAdapter();
    jest.mocked(global.fetch).mockResolvedValue(
      mockJsonResponse({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  function: {
                    arguments: '{"status":"READY"}',
                  },
                },
              ],
            },
          },
        ],
      }),
    );

    await expect(
      adapter.invokeStructured({
        profile: createProfile({
          providerCode: 'deepseek',
          model: 'deepseek-chat',
          sdkOptions: {
            wireApi: 'chat_completions',
            structuredOutputMode: 'json_object',
          },
        }),
        prompt: '输出状态',
        outputSchema: {
          type: 'object',
          required: ['status'],
          properties: {
            status: {
              type: 'string',
              enum: ['READY', 'BLOCKED'],
            },
          },
        },
      }),
    ).resolves.toEqual({ status: 'READY' });
  });

  it('Chat Completions 将结构化结果放入 function_call.arguments 时应能解析', async () => {
    const adapter = new OpenAiCompatibleHttpAdapter();
    jest.mocked(global.fetch).mockResolvedValue(
      mockJsonResponse({
        choices: [
          {
            message: {
              content: '',
              function_call: {
                arguments: {
                  status: 'READY',
                },
              },
            },
          },
        ],
      }),
    );

    await expect(
      adapter.invokeStructured({
        profile: createProfile({
          providerCode: 'deepseek-v4-pro',
          model: 'deepseek-v4-pro',
          sdkOptions: {
            wireApi: 'chat_completions',
            structuredOutputMode: 'json_object',
          },
        }),
        prompt: '输出状态',
        outputSchema: {
          type: 'object',
          required: ['status'],
          properties: {
            status: {
              type: 'string',
              enum: ['READY', 'BLOCKED'],
            },
          },
        },
      }),
    ).resolves.toEqual({ status: 'READY' });
  });

  it('Chat Completions 将结构化对象放入 message.parsed 时应能解析', async () => {
    const adapter = new OpenAiCompatibleHttpAdapter();
    jest.mocked(global.fetch).mockResolvedValue(
      mockJsonResponse({
        choices: [
          {
            message: {
              content: null,
              parsed: {
                status: 'READY',
              },
            },
          },
        ],
      }),
    );

    await expect(
      adapter.invokeStructured({
        profile: createProfile({
          providerCode: 'openai-compatible',
          model: 'compatible-chat',
          sdkOptions: {
            wireApi: 'chat_completions',
            structuredOutputMode: 'json_object',
          },
        }),
        prompt: '输出状态',
        outputSchema: {
          type: 'object',
          required: ['status'],
          properties: {
            status: {
              type: 'string',
              enum: ['READY', 'BLOCKED'],
            },
          },
        },
      }),
    ).resolves.toEqual({ status: 'READY' });
  });

  it('缺少最终文本时应在解析错误中保留响应预览', async () => {
    const adapter = new OpenAiCompatibleHttpAdapter();
    jest.mocked(global.fetch).mockResolvedValue(
      mockJsonResponse({
        id: 'chatcmpl_missing_content',
        choices: [
          {
            message: {
              content: null,
              reasoning_content: '这里是推理过程，但没有最终 JSON。',
            },
          },
        ],
      }),
    );

    try {
      await adapter.invokeStructured({
        profile: createProfile({
          providerCode: 'deepseek',
          model: 'deepseek-reasoner',
          sdkOptions: {
            wireApi: 'chat_completions',
            structuredOutputMode: 'json_object',
          },
        }),
        prompt: '输出状态',
        outputSchema: {
          type: 'object',
          required: ['status'],
          properties: {
            status: {
              type: 'string',
            },
          },
        },
      });
    } catch (error) {
      const parsedError = error as Error & {
        rawResponsePreview?: string;
        rawResponseLength?: number;
      };
      expect(parsedError.message).toBe('模型响应缺少最终文本。');
      expect(parsedError.name).toBe('RESPONSE_PARSE');
      expect(parsedError.rawResponsePreview).toContain('reasoning_content');
      expect(parsedError.rawResponseLength).toEqual(expect.any(Number));
      return;
    }

    throw new Error('缺少最终文本时应该抛出解析错误。');
  });

  it('结构化 Chat Completions 在前后混有说明文字时仍应提取首个 JSON 对象', async () => {
    const adapter = new OpenAiCompatibleHttpAdapter();
    jest.mocked(global.fetch).mockResolvedValue(
      mockJsonResponse({
        choices: [
          {
            message: {
              content:
                '下面是审核结果，请直接使用：\n```json\n{"status":"READY"}\n```\n以上为结构化输出。',
            },
          },
        ],
      }),
    );

    await expect(
      adapter.invokeStructured({
        profile: createProfile({
          providerCode: 'anthropic-claude',
          model: 'claude-sonnet-4-20250514',
          sdkOptions: {
            wireApi: 'chat_completions',
            structuredOutputMode: 'json_object',
          },
        }),
        prompt: '输出状态',
        outputSchema: {
          type: 'object',
          required: ['status'],
          properties: {
            status: {
              type: 'string',
              enum: ['READY', 'BLOCKED'],
            },
          },
        },
      }),
    ).resolves.toEqual({ status: 'READY' });
  });

  it('结构化 Chat Completions 在 JSON 前后追加普通文本时仍应提取平衡 JSON', async () => {
    const adapter = new OpenAiCompatibleHttpAdapter();
    jest.mocked(global.fetch).mockResolvedValue(
      mockJsonResponse({
        choices: [
          {
            message: {
              content:
                '说明：以下是最终 JSON。\n{"status":"READY","reason":"合同条款完整"}\n请勿输出其他字段。',
            },
          },
        ],
      }),
    );

    await expect(
      adapter.invokeStructured({
        profile: createProfile({
          providerCode: 'anthropic-claude',
          model: 'claude-sonnet-4-20250514',
          sdkOptions: {
            wireApi: 'chat_completions',
            structuredOutputMode: 'json_object',
          },
        }),
        prompt: '输出状态',
        outputSchema: {
          type: 'object',
          required: ['status', 'reason'],
          properties: {
            status: {
              type: 'string',
              enum: ['READY', 'BLOCKED'],
            },
            reason: {
              type: 'string',
            },
          },
        },
      }),
    ).resolves.toEqual({
      status: 'READY',
      reason: '合同条款完整',
    });
  });

  it('结构化 Chat Completions 调用默认应提高 max_tokens，避免长 JSON 被截断', async () => {
    const adapter = new OpenAiCompatibleHttpAdapter();
    const fetchMock = jest.mocked(global.fetch);
    fetchMock.mockResolvedValue(
      mockJsonResponse({
        choices: [
          {
            message: {
              content: '{"intent":"ANALYZE"}',
            },
          },
        ],
      }),
    );

    await adapter.invokeStructured({
      profile: createProfile({
        providerCode: 'anthropic-claude',
        model: 'claude-sonnet-4-20250514',
        sdkOptions: {
          wireApi: 'chat_completions',
          structuredOutputMode: 'json_object',
        },
      }),
      prompt: '输出结构化问数结果',
      outputSchema: {
        type: 'object',
        required: ['intent'],
        properties: {
          intent: { type: 'string' },
        },
      },
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.max_tokens).toBeGreaterThanOrEqual(1024);
  });

  it('prompt_schema 模式不得发送 response_format，但仍必须本地校验 schema', async () => {
    const adapter = new OpenAiCompatibleHttpAdapter();
    const fetchMock = jest.mocked(global.fetch);
    fetchMock.mockResolvedValue(
      mockJsonResponse({
        choices: [
          {
            message: {
              content: '{"items":["A","B"]}',
            },
          },
        ],
      }),
    );

    const result = await adapter.invokeStructured({
      profile: createProfile({
        providerCode: 'glm',
        model: 'glm-4-plus',
        sdkOptions: {
          wireApi: 'chat_completions',
          structuredOutputMode: 'prompt_schema',
        },
      }),
      prompt: '输出列表',
      outputSchema: {
        type: 'object',
        required: ['items'],
        properties: {
          items: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(result).toEqual({ items: ['A', 'B'] });
    expect(body.response_format).toBeUndefined();
    expect(body.messages[0].content).toContain('items');
  });

  it('结构化返回缺失必填字段时应阻断结果消费', async () => {
    const adapter = new OpenAiCompatibleHttpAdapter();
    jest.mocked(global.fetch).mockResolvedValue(
      mockJsonResponse({
        choices: [
          {
            message: {
              content: '{"status":"READY"}',
            },
          },
        ],
      }),
    );

    await expect(
      adapter.invokeStructured({
        profile: createProfile({
          sdkOptions: {
            wireApi: 'chat_completions',
            structuredOutputMode: 'json_object',
          },
        }),
        prompt: '输出意图',
        outputSchema: {
          type: 'object',
          required: ['intent'],
          properties: {
            intent: { type: 'string' },
          },
        },
      }),
    ).rejects.toThrow('结构化输出缺少必填字段：$.intent');
  });

  it('HTTP 非 2xx 失败摘要不得包含密钥', async () => {
    const adapter = new OpenAiCompatibleHttpAdapter();
    jest.mocked(global.fetch).mockResolvedValue(
      mockJsonResponse(
        {
          error: {
            message: 'invalid secret-openai-compatible-key',
          },
        },
        401,
      ),
    );

    await expect(
      adapter.invokeText({
        profile: createProfile(),
        prompt: '请只返回 OK',
      }),
    ).rejects.toThrow(/模型服务返回非成功状态：401/);
    await expect(
      adapter.invokeText({
        profile: createProfile(),
        prompt: '请只返回 OK',
      }),
    ).rejects.not.toThrow('secret-openai-compatible-key');
  });

  it('非法 JSON 响应应归类为解析失败', async () => {
    const adapter = new OpenAiCompatibleHttpAdapter();
    jest.mocked(global.fetch).mockResolvedValue(
      mockJsonResponse({
        choices: [
          {
            message: {
              content: '不是 JSON',
            },
          },
        ],
      }),
    );

    await expect(
      adapter.invokeStructured({
        profile: createProfile({
          sdkOptions: {
            wireApi: 'chat_completions',
            structuredOutputMode: 'json_object',
          },
        }),
        prompt: '输出 JSON',
        outputSchema: {
          type: 'object',
          required: ['intent'],
          properties: {
            intent: { type: 'string' },
          },
        },
      }),
    ).rejects.toThrow('模型结构化输出不是合法 JSON。');
  });

  it('不支持的协议类型应直接阻断调用', async () => {
    const adapter = new OpenAiCompatibleHttpAdapter();

    await expect(
      adapter.invokeText({
        profile: createProfile({
          sdkOptions: {
            wireApi: 'assistants',
          },
        }),
        prompt: '请只返回 OK',
      }),
    ).rejects.toThrow('不支持的 OpenAI 兼容 HTTP 协议：assistants');
  });

  it('请求超时时应中止 fetch 并返回超时摘要', async () => {
    jest.useFakeTimers();
    const adapter = new OpenAiCompatibleHttpAdapter();
    jest.mocked(global.fetch).mockImplementation((_url, init) => {
      const signal = init?.signal;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    });

    const pending = adapter.invokeText({
      profile: createProfile({
        timeoutMs: 5,
      }),
      prompt: '请只返回 OK',
    });
    const assertion = expect(pending).rejects.toThrow('模型服务请求超时。');

    await jest.advanceTimersByTimeAsync(5);

    await assertion;
  });

  it('requestOverrides.timeoutMs 应优先覆盖 Profile 默认超时', async () => {
    jest.useFakeTimers();
    const adapter = new OpenAiCompatibleHttpAdapter();
    let abortCount = 0;
    jest.mocked(global.fetch).mockImplementation((_url, init) => {
      const signal = init?.signal;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          abortCount += 1;
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    });

    const pending = adapter.invokeText({
      profile: createProfile({
        timeoutMs: 5,
      }),
      prompt: '请只返回 OK',
      requestOverrides: {
        timeoutMs: 20,
      },
    });

    await jest.advanceTimersByTimeAsync(5);
    expect(abortCount).toBe(0);

    const assertion = expect(pending).rejects.toThrow('模型服务请求超时。');
    await jest.advanceTimersByTimeAsync(15);

    await assertion;
    expect(abortCount).toBe(1);
  });

  it('Qwen、DeepSeek、GLM 风格 Chat Completions 响应都应能解析结构化结果', async () => {
    const adapter = new OpenAiCompatibleHttpAdapter();
    const platforms = [
      ['qwen', 'qwen-plus', 'json_schema'],
      ['deepseek', 'deepseek-chat', 'json_object'],
      ['glm', 'glm-4-plus', 'prompt_schema'],
    ] as const;

    for (const [providerCode, model, structuredOutputMode] of platforms) {
      jest.mocked(global.fetch).mockResolvedValueOnce(
        mockJsonResponse({
          choices: [
            {
              message: {
                content: `{"provider":"${providerCode}"}`,
              },
            },
          ],
        }),
      );

      await expect(
        adapter.invokeStructured({
          profile: createProfile({
            providerCode,
            model,
            sdkOptions: {
              wireApi: 'chat_completions',
              structuredOutputMode,
            },
          }),
          prompt: '输出平台',
          outputSchema: {
            type: 'object',
            required: ['provider'],
            properties: {
              provider: {
                type: 'string',
                enum: ['qwen', 'deepseek', 'glm'],
              },
            },
          },
        }),
      ).resolves.toEqual({ provider: providerCode });
    }
  });
});

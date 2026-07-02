import { AiCapabilityPackRegistry } from '../../../src/modules/analysis/capability-packs/ai-capability-pack.registry';
import { AiCapabilityPackRuntimeService } from '../../../src/modules/analysis/capability-packs/ai-capability-pack.runtime';
import { AiCapabilityPackRolloutPolicy } from '../../../src/modules/analysis/capability-packs/runtime/pack-rollout.policy';
import type { AiCapabilityPackDefinition } from '../../../src/modules/analysis/capability-packs/ai-capability-pack.types';

describe('AiCapabilityPackRuntimeService', () => {
  function createPack(
    overrides: Partial<AiCapabilityPackDefinition<{ text: string }, Record<string, unknown>, { intent: string }>> = {},
  ): AiCapabilityPackDefinition<{ text: string }, Record<string, unknown>, { intent: string }> {
    return {
      packCode: 'test-pack',
      packVersion: '2026-04-21.1',
      buildStructuredRequest: jest.fn((context) => ({
        prompt: `输入：${context.text}`,
        outputSchema: {
          type: 'object',
          required: ['intent'],
          properties: {
            intent: { type: 'string' },
          },
        },
      })),
      normalize: jest.fn((raw) => ({
        intent: String(raw.intent ?? ''),
      })),
      ...overrides,
    };
  }

  function createRuntime(params?: {
    packs?: AiCapabilityPackDefinition<{ text: string }, Record<string, unknown>, { intent: string }>[];
    disabledPackCodes?: string[];
    invokeStructured?: jest.Mock;
    currentConfig?: Record<string, unknown>;
  }): AiCapabilityPackRuntimeService {
    const registry = AiCapabilityPackRegistry.fromPacks(
      params?.packs ?? [createPack()],
    );
    const rolloutPolicy = AiCapabilityPackRolloutPolicy.fromDisabledPackCodes(
      params?.disabledPackCodes ?? [],
    );
    return new AiCapabilityPackRuntimeService(
      {
        getCurrentConfig: jest.fn(() => ({
          enabled: true,
          providerCode: 'qwen',
          modelProvider: 'qwen',
          model: 'qwen-turbo-latest',
          sdkType: 'openai-compatible-http',
          ...(params?.currentConfig ?? {}),
        })),
      } as never,
      {
        invokeStructured:
          params?.invokeStructured ??
          jest.fn().mockResolvedValue({
            intent: 'ANALYZE',
          }),
      } as never,
      registry,
      rolloutPolicy,
    );
  }

  it('pack 被禁用时应返回 PACK_DISABLED', async () => {
    const runtime = createRuntime({
      disabledPackCodes: ['test-pack'],
    });

    await expect(
      runtime.executeStructuredPack({
        packCode: 'test-pack',
        context: { text: '你好' },
      }),
    ).resolves.toMatchObject({
      status: 'FAILED',
      failureReason: 'PACK_DISABLED',
      packCode: 'test-pack',
    });
  });

  it('条件校验失败时应返回 PACK_VALIDATION_FAILED 和 validationFailureReason', async () => {
    const runtime = createRuntime({
      packs: [
        createPack({
          validate: jest.fn(() => '缺少 dailyReportPrompt'),
        }),
      ],
    });

    await expect(
      runtime.executeStructuredPack({
        packCode: 'test-pack',
        context: { text: '跟进商机' },
      }),
    ).resolves.toMatchObject({
      status: 'FAILED',
      failureReason: 'PACK_VALIDATION_FAILED',
      validationFailureReason: '缺少 dailyReportPrompt',
    });
  });

  it('识别为 NONE 时应返回 PACK_NONE，而不是伪造成成功命中', async () => {
    const runtime = createRuntime({
      packs: [
        createPack({
          isNone: jest.fn((output) => output.intent === 'NONE'),
        }),
      ],
      invokeStructured: jest.fn().mockResolvedValue({
        intent: 'NONE',
      }),
    });

    await expect(
      runtime.executeStructuredPack({
        packCode: 'test-pack',
        context: { text: '随便说点什么' },
      }),
    ).resolves.toMatchObject({
      status: 'NONE',
      failureReason: 'PACK_NONE',
      output: {
        intent: 'NONE',
      },
    });
  });

  it('provider tuning 产出的 request overrides 应透传给统一执行门面', async () => {
    const invokeStructured = jest.fn().mockResolvedValue({
      intent: 'ANALYZE',
    });
    const runtime = createRuntime({
      packs: [
        createPack({
          resolveProviderTuning: jest.fn(() => ({
            requestOverrides: {
              structuredOutputMode: 'json_object',
              enableThinking: false,
            },
          })),
        }),
      ],
      invokeStructured,
    });

    await runtime.executeStructuredPack({
      packCode: 'test-pack',
      context: { text: '本月新增商机金额排名' },
      cwd: 'D:\\code\\CRM\\backend',
    });

    expect(invokeStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        requestOverrides: {
          structuredOutputMode: 'json_object',
          enableThinking: false,
        },
      }),
    );
  });

  it('Kimi 兼容网关应默认把能力包结构化模式降级为 json_object', async () => {
    const invokeStructured = jest.fn().mockResolvedValue({
      intent: 'ANALYZE',
    });
    const runtime = createRuntime({
      invokeStructured,
      currentConfig: {
        providerCode: 'kimi-k2.6',
        modelProvider: 'kimi-k2.6',
        model: 'kimi-k2.6',
        wireApi: 'chat_completions',
        structuredOutputMode: 'json_schema',
        sdkOptions: {
          platformPreset: 'manual',
          wireApi: 'chat_completions',
          structuredOutputMode: 'json_schema',
        },
      },
    });

    const result = await runtime.executeStructuredPack({
      packCode: 'test-pack',
      context: { text: '最近一个月山东的商机情况' },
    });

    expect(result).toMatchObject({
      status: 'SUCCEEDED',
      requestOverrides: {
        structuredOutputMode: 'json_object',
      },
    });
    expect(invokeStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        requestOverrides: {
          structuredOutputMode: 'json_object',
        },
      }),
    );
  });

  it('DeepSeek 兼容网关应默认改走 Chat Completions 与 json_object', async () => {
    const invokeStructured = jest.fn().mockResolvedValue({
      intent: 'ANALYZE',
    });
    const runtime = createRuntime({
      invokeStructured,
      currentConfig: {
        providerCode: 'deepseek-v4-pro',
        modelProvider: 'deepseek-v4-pro',
        model: 'deepseek-v4-pro',
        wireApi: 'responses',
        structuredOutputMode: 'json_schema',
        sdkOptions: {
          platformPreset: 'manual',
          wireApi: 'responses',
          structuredOutputMode: 'json_schema',
        },
      },
    });

    const result = await runtime.executeStructuredPack({
      packCode: 'test-pack',
      context: { text: '合作伙伴开拓、客户报备、商机和订单情况' },
    });

    expect(result).toMatchObject({
      status: 'SUCCEEDED',
      requestOverrides: {
        wireApi: 'chat_completions',
        structuredOutputMode: 'json_object',
        enableThinking: false,
        maxTokens: 4096,
      },
    });
    expect(invokeStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        requestOverrides: {
          wireApi: 'chat_completions',
          structuredOutputMode: 'json_object',
          enableThinking: false,
          maxTokens: 4096,
        },
      }),
    );
  });

  it('能力包专属调优应能覆盖 Kimi 默认结构化模式', async () => {
    const invokeStructured = jest.fn().mockResolvedValue({
      intent: 'ANALYZE',
    });
    const runtime = createRuntime({
      packs: [
        createPack({
          resolveProviderTuning: jest.fn(() => ({
            requestOverrides: {
              structuredOutputMode: 'prompt_schema',
            },
          })),
        }),
      ],
      invokeStructured,
      currentConfig: {
        providerCode: 'kimi-k2.6',
        model: 'kimi-k2.6',
      },
    });

    const result = await runtime.executeStructuredPack({
      packCode: 'test-pack',
      context: { text: '生成分析报告' },
    });

    expect(result).toMatchObject({
      status: 'SUCCEEDED',
      requestOverrides: {
        structuredOutputMode: 'prompt_schema',
      },
    });
    expect(invokeStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        requestOverrides: {
          structuredOutputMode: 'prompt_schema',
        },
      }),
    );
  });

  it('调用方临时覆盖项应在能力包默认调优之上生效', async () => {
    const invokeStructured = jest.fn().mockResolvedValue({
      intent: 'ANALYZE',
    });
    const runtime = createRuntime({
      packs: [
        createPack({
          resolveProviderTuning: jest.fn(() => ({
            requestOverrides: {
              structuredOutputMode: 'json_object',
              timeoutMs: 22000,
              retryOnTimeout: true,
            },
          })),
        }),
      ],
      invokeStructured,
    });

    const result = await runtime.executeStructuredPack({
      packCode: 'test-pack',
      context: { text: '最近一个月山东的商机情况' },
      requestOverrides: {
        timeoutMs: 8000,
        retryOnTimeout: false,
        maxTokens: 512,
      },
    });

    expect(result).toMatchObject({
      status: 'SUCCEEDED',
      requestOverrides: {
        structuredOutputMode: 'json_object',
        timeoutMs: 8000,
        retryOnTimeout: false,
        maxTokens: 512,
      },
    });
    expect(invokeStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        requestOverrides: {
          structuredOutputMode: 'json_object',
          timeoutMs: 8000,
          maxTokens: 512,
        },
      }),
    );
  });

  it('禁用超时重试时应只保留单次长窗口，并且不把重试配置透传给 provider', async () => {
    const timeoutError = new Error('模型服务请求超时。');
    timeoutError.name = 'AbortError';
    const invokeStructured = jest.fn().mockRejectedValue(timeoutError);
    const runtime = createRuntime({
      packs: [
        createPack({
          resolveProviderTuning: jest.fn(() => ({
            requestOverrides: {
              timeoutMs: 22000,
              retryOnTimeout: false,
            },
          })),
        }),
      ],
      invokeStructured,
    });

    await expect(
      runtime.executeStructuredPack({
        packCode: 'test-pack',
        context: { text: '生成分析报告' },
      }),
    ).resolves.toMatchObject({
      status: 'FAILED',
      failureReason: 'PROVIDER_TIMEOUT',
    });
    expect(invokeStructured).toHaveBeenCalledTimes(1);
    expect(invokeStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        requestOverrides: {
          timeoutMs: 22000,
        },
      }),
    );
  });

  it('provider 瞬时错误时应自动重试一次', async () => {
    const invokeStructured = jest
      .fn()
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValueOnce({
        intent: 'ANALYZE',
      });
    const runtime = createRuntime({
      invokeStructured,
    });

    await expect(
      runtime.executeStructuredPack({
        packCode: 'test-pack',
        context: { text: '本月新增商机金额排名' },
      }),
    ).resolves.toMatchObject({
      status: 'SUCCEEDED',
      output: {
        intent: 'ANALYZE',
      },
    });
    expect(invokeStructured).toHaveBeenCalledTimes(2);
  });
  it('结构化输出解析失败时不应继续重试，并应保留失败原因', async () => {
    const parseError = new Error('模型结构化输出不是合法 JSON。');
    parseError.name = 'RESPONSE_PARSE';
    const invokeStructured = jest.fn().mockRejectedValue(parseError);
    const runtime = createRuntime({
      invokeStructured,
    });

    await expect(
      runtime.executeStructuredPack({
        packCode: 'test-pack',
        context: { text: '最近一个月山东区域的商机情况' },
      }),
    ).resolves.toMatchObject({
      status: 'FAILED',
      failureReason: 'PACK_VALIDATION_FAILED',
      validationFailureReason: '模型结构化输出不是合法 JSON。',
    });
    expect(invokeStructured).toHaveBeenCalledTimes(1);
  });
});

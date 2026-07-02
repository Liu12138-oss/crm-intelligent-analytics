import { UnifiedAiExecutionService } from '../../../src/modules/ai-models/unified-ai-execution.service';

describe('UnifiedAiExecutionService', () => {
  it('应按当前激活 Profile 选择对应 adapter 执行文本调用', async () => {
    const resolver = {
      getCurrentConfig: jest.fn(() => ({
        enabled: true,
        source: 'profile',
        profileId: 'profile_claude',
        sdkType: 'claude-agent-sdk',
      })),
    } as never;
    const registry = {
      getAdapter: jest.fn(() => ({
        invokeText: jest.fn().mockResolvedValue('OK'),
      })),
    };
    const service = new UnifiedAiExecutionService(resolver, registry as never);

    const result = await service.invokeText({
      prompt: '请只返回 OK',
      system: 'test',
    });

    expect(result).toBe('OK');
    expect(registry.getAdapter).toHaveBeenCalledWith('claude-agent-sdk');
  });

  it('当前激活配置不可用时应阻断统一执行门面', async () => {
    const resolver = {
      getCurrentConfig: jest.fn(() => ({
        enabled: false,
      })),
    } as never;
    const registry = {
      getAdapter: jest.fn(),
    };
    const service = new UnifiedAiExecutionService(resolver, registry as never);

    await expect(
      service.invokeText({
        prompt: '请只返回 OK',
        system: 'test',
      }),
    ).rejects.toThrow('当前没有可用的 AI 运行时配置。');
  });

  it('应按当前激活 Profile 选择对应 adapter 执行结构化调用', async () => {
    const resolver = {
      getCurrentConfig: jest.fn(() => ({
        enabled: true,
        source: 'profile',
        profileId: 'profile_codex',
        sdkType: 'codex-sdk',
      })),
    } as never;
    const registry = {
      getAdapter: jest.fn(() => ({
        invokeStructured: jest.fn().mockResolvedValue({ intent: 'ANALYZE' }),
      })),
    };
    const service = new UnifiedAiExecutionService(resolver, registry as never);

    const result = await service.invokeStructured({
      prompt: '请输出结构化结果',
      system: 'test',
      outputSchema: {
        type: 'object',
        properties: {
          intent: { type: 'string' },
        },
      },
    });

    expect(result).toEqual({ intent: 'ANALYZE' });
    expect(registry.getAdapter).toHaveBeenCalledWith('codex-sdk');
  });
});

import { createDefaultAppStorageState } from '../../../src/shared/mock/sample-data';
import { AiContextPolicyService } from '../../../src/modules/ai-models/ai-context-policy.service';

describe('AiContextPolicyService', () => {
  function createService() {
    const state = createDefaultAppStorageState();
    const repository = {
      getCurrent: jest.fn(() => state.aiContextPolicy),
      save: jest.fn((record) => {
        state.aiContextPolicy = record;
        return record;
      }),
    };

    return {
      state,
      repository,
      service: new AiContextPolicyService(repository as never),
    };
  }

  it('默认应用存储应包含 AI 上下文治理策略', () => {
    const state = createDefaultAppStorageState();

    expect(state.aiContextPolicy).toEqual({
      id: 'ai_context_policy_current',
      turnRetentionLimit: 8,
      historySummaryMaxLength: 600,
      latestQuestionMaxLength: 200,
      latestSummaryMaxLength: 800,
      analysisSessionIdleTimeoutSeconds: 1800,
      taskSessionIdleTimeoutSeconds: 7200,
      updatedBy: 'user_admin',
      updatedAt: '2026-03-24T10:00:00.000Z',
    });
  });

  it('更新 AI 上下文治理策略时应持久化最新值', () => {
    const { service, state, repository } = createService();

    const updated = service.update('user_admin', {
      turnRetentionLimit: 10,
      historySummaryMaxLength: 500,
      latestQuestionMaxLength: 160,
      latestSummaryMaxLength: 640,
      analysisSessionIdleTimeoutSeconds: 900,
      taskSessionIdleTimeoutSeconds: 3600,
    });

    expect(updated).toEqual(
      expect.objectContaining({
        turnRetentionLimit: 10,
        historySummaryMaxLength: 500,
        latestQuestionMaxLength: 160,
        latestSummaryMaxLength: 640,
        analysisSessionIdleTimeoutSeconds: 900,
        taskSessionIdleTimeoutSeconds: 3600,
        updatedBy: 'user_admin',
      }),
    );
    expect(state.aiContextPolicy.turnRetentionLimit).toBe(10);
    expect(repository.save).toHaveBeenCalled();
  });

  it('裁剪文本时应保留空值安全并按上限截断', () => {
    const { service } = createService();

    expect(service.trimTextByLimit(undefined, 10)).toBeUndefined();
    expect(service.trimTextByLimit('  你好  ', 10)).toBe('你好');
    expect(service.trimTextByLimit('1234567890ABCDE', 10)).toBe('1234567890');
  });
});

import { resolveQwenCapabilityTuning } from '../../../src/modules/analysis/capability-packs/provider-tuning/qwen.provider';
import { wecomActiveTaskReplyPack } from '../../../src/modules/analysis/capability-packs/packs/wecom-active-task-reply.pack';
import { WECOM_ACTIVE_TASK_REPLY_FIXTURES } from '../../../src/modules/analysis/capability-packs/fixtures/wecom-active-task-reply.fixtures';

describe('wecom active task reply pack', () => {
  it('Qwen few-shot 应覆盖长正文补充、不补充继续和取消任务的正反例', () => {
    const tuning = resolveQwenCapabilityTuning(
      {
        providerCode: 'qwen',
        model: 'qwen-turbo-latest',
      },
      'wecom-active-task-reply-pack',
    );

    expect(tuning?.fewShotExamples).toEqual(
      expect.arrayContaining([
        expect.stringContaining('长正文'),
        expect.stringContaining('不补充'),
        expect.stringContaining('TASK_CANCEL'),
      ]),
    );
  });

  it('活跃任务回复 prompt 应明确要求把长正文补充判为 MODIFY_CONTENT，而不是继续执行', () => {
    const request = wecomActiveTaskReplyPack.buildStructuredRequest(
      {
        messageText:
          '今天跟进了安恒信息，客户不好沟通，推进缓慢，明天继续跟进',
        activeTaskLabel: '当前跟进整理',
      },
      {
        fewShotExamples: [],
      },
    );

    expect(request.prompt).toContain('长正文');
    expect(request.prompt).toContain('MODIFY_CONTENT');
    expect(request.prompt).toContain('不补充');
    expect(request.prompt).toContain('DIRECT_SUBMIT');
  });

  it('活跃任务回复 fixture 应覆盖真实问题单里的误判场景', () => {
    expect(WECOM_ACTIVE_TASK_REPLY_FIXTURES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          messageText: '不补充',
        }),
        expect.objectContaining({
          messageText:
            '今天跟进了安恒信息，客户不好沟通，推进缓慢，明天继续跟进',
        }),
      ]),
    );
  });

  it('显式切换去查客户列表时，应允许 TASK_SWITCH 到 ENTITY_LOOKUP', () => {
    const validation = wecomActiveTaskReplyPack.validate?.(
      {
        intent: 'TASK_SWITCH',
        target: 'ENTITY_LOOKUP' as never,
      },
      {
        messageText: '先去查一下我当前跟进的客户',
        activeTaskLabel: '当前跟进整理',
      },
    );

    expect(validation).toBeUndefined();
    expect(
      wecomActiveTaskReplyPack
        .buildStructuredRequest(
          {
            messageText: '先去查一下我当前跟进的客户',
            activeTaskLabel: '当前跟进整理',
          },
          {
            fewShotExamples: [],
          },
        )
        .prompt,
    ).toContain('ENTITY_LOOKUP');
  });
});

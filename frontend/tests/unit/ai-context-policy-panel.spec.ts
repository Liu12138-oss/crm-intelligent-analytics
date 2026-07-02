import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import AiContextPolicyPanel from '@/components/governance/AiContextPolicyPanel.vue';

describe('ai context policy panel', () => {
  it('应展示明确单位，并将分钟换算为秒后提交', async () => {
    const wrapper = mount(AiContextPolicyPanel, {
      props: {
        policy: {
          id: 'ai_context_policy_current',
          turnRetentionLimit: 8,
          historySummaryMaxLength: 600,
          latestQuestionMaxLength: 200,
          latestSummaryMaxLength: 800,
          analysisSessionIdleTimeoutSeconds: 1800,
          taskSessionIdleTimeoutSeconds: 7200,
          updatedBy: 'user_admin',
          updatedAt: '2026-04-27T10:00:00.000Z',
        },
      },
      global: {
        stubs: {
          ElTooltip: {
            template: '<div><slot /><slot name="content" /></div>',
          },
        },
      },
    });

    await nextTick();

    expect(wrapper.text()).toContain('问答上下文保留轮次上限（轮）');
    expect(wrapper.text()).toContain('历史摘要保留上限（字符）');
    expect(wrapper.text()).toContain('上一轮问题保留上限（字符）');
    expect(wrapper.text()).toContain('上一轮结果摘要保留上限（字符）');
    expect(wrapper.text()).toContain('普通对话会话失活时长（分钟）');
    expect(wrapper.text()).toContain('任务态会话失活时长（分钟）');
    expect(wrapper.text()).toContain('当前这组配置不恢复 CRM 问数、合同评审、日报或写回能力');
    expect(wrapper.text()).not.toContain('这些阈值会同时作用于企业微信追问');

    const inputs = wrapper.findAll('input');
    expect(inputs[4]?.element.value).toBe('30');
    expect(inputs[5]?.element.value).toBe('120');

    await wrapper.find('button.button-primary').trigger('click');

    expect(wrapper.emitted('save')?.[0]?.[0]).toEqual({
      turnRetentionLimit: 8,
      historySummaryMaxLength: 600,
      latestQuestionMaxLength: 200,
      latestSummaryMaxLength: 800,
      analysisSessionIdleTimeoutSeconds: 1800,
      taskSessionIdleTimeoutSeconds: 7200,
    });
  });
});

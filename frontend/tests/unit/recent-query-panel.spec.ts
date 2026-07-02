import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import RecentQueryPanel from '@/components/analysis/RecentQueryPanel.vue';
import type { RecentQueryItem } from '@/types/analysis';

describe('RecentQueryPanel', () => {
  it('最近查询中的视图类型应显示为用户可读中文', () => {
    const items: RecentQueryItem[] = [
      {
        historyId: 'history_chart_001',
        sourceType: 'TEMPLATE_QUERY',
        questionText: '近四年 10% 以上商机新增趋势',
        lastUsedChannel: 'web-console',
        resultSummary: '已返回 17 条结果。',
        renderSnapshot: {
          primaryViewType: 'BAR_CHART',
          primaryTitle: '商机新增趋势',
        },
        status: 'SUCCEEDED',
        lastUsedAt: '2026-05-15T02:05:00.000Z',
      },
    ];

    const wrapper = mount(RecentQueryPanel, {
      props: {
        items,
      },
      global: {
        stubs: {
          ElButton: {
            template: '<button><slot /></button>',
          },
          ElIcon: {
            template: '<span><slot /></span>',
          },
          ElTag: {
            template: '<span><slot /></span>',
          },
        },
      },
    });

    expect(wrapper.text()).toContain('柱状图');
    expect(wrapper.text()).not.toContain('BAR_CHART');
  });
});

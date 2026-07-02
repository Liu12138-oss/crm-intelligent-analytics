import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AnalysisMarkdownPreview from '@/components/analysis/AnalysisMarkdownPreview.vue';

describe('analysis markdown preview', () => {
  it('应以受限语法渲染 Markdown，并拦截原始 HTML 注入', () => {
    const wrapper = mount(AnalysisMarkdownPreview, {
      props: {
        title: 'AI 总结',
        markdown: '## 执行摘要\n- **新增商机金额**：1,270,000\n<script>alert(1)</script>',
      },
    });

    expect(wrapper.text()).toContain('执行摘要');
    expect(wrapper.text()).toContain('新增商机金额');
    expect(wrapper.html()).not.toContain('<script>');
    expect(wrapper.html()).toContain('<strong>新增商机金额</strong>');
  });

  it('应在 Markdown 预览中展示服务端结果包锁定的时间口径', () => {
    const wrapper = mount(AnalysisMarkdownPreview, {
      props: {
        markdown: '## 执行摘要\n最近四个月新增商机金额趋势已生成。',
        temporalScope: {
          rawText: '最近四个月',
          normalizedLabel: '最近四个月',
          startAt: '2025-12-31T16:00:00.000Z',
          endAt: '2026-04-30T16:00:00.000Z',
          granularity: 'month',
          timezone: 'Asia/Shanghai',
          source: 'AI_TEMPORAL_SLOT',
        },
      },
    });

    expect(wrapper.text()).toContain('时间口径');
    expect(wrapper.text()).toContain('最近四个月');
    expect(wrapper.text()).toContain('2025-12-31T16:00:00.000Z');
  });

  it('应支持受控表格与引用说明块，便于展示预测区间和依据说明', () => {
    const wrapper = mount(AnalysisMarkdownPreview, {
      props: {
        markdown: [
          '## 趋势预测',
          '| 指标 | 内容 |',
          '| --- | --- |',
          '| 置信等级 | 中 |',
          '| 预测区间 | 150 到 175 |',
          '> 当前预测仅基于最近四期趋势做短期推断。',
        ].join('\n'),
      },
    });

    expect(wrapper.find('table').exists()).toBe(true);
    expect(wrapper.find('blockquote').exists()).toBe(true);
    expect(wrapper.text()).toContain('预测区间');
    expect(wrapper.text()).toContain('150 到 175');
  });

  it('应在 AI 报告补充生成状态展示加载图标', () => {
    const wrapper = mount(AnalysisMarkdownPreview, {
      props: {
        bundle: {
          status: 'PENDING',
        },
      },
    });

    const pendingStatus = wrapper.find('[data-testid="analysis-pending-status"]');

    expect(pendingStatus.exists()).toBe(true);
    expect(pendingStatus.attributes('aria-busy')).toBe('true');
    expect(pendingStatus.find('.analysis-markdown-preview__pending-icon').exists()).toBe(true);
    expect(pendingStatus.text()).toContain('数据已返回，AI 正在补充分析结论。');
  });
});

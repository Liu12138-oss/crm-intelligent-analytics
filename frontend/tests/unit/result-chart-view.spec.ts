import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ResultChartView from '@/components/analysis/ResultChartView.vue';

describe('result chart view', () => {
  it('柱状图应按横向图表条带展示，避免年份逐条纵向堆叠', () => {
    const wrapper = mount(ResultChartView, {
      props: {
        title: '10%+ 商机新增趋势',
        viewType: 'BAR_CHART',
        series: [
          { label: '2022Q2', value: 3969.39 },
          { label: '2022Q3', value: 10625.83 },
        ],
      },
      global: {
        stubs: {
          ElIcon: {
            template: '<span><slot /></span>',
          },
          ElEmpty: {
            template: '<div class="empty-stub" />',
          },
        },
      },
    });

    expect(wrapper.find('.chart-horizontal-list').exists()).toBe(true);
    expect(wrapper.findAll('.chart-horizontal-item')).toHaveLength(2);
    expect(wrapper.find('.chart-horizontal-item__rank').text()).toBe('01');
    expect(wrapper.find('.chart-horizontal-item__label').text()).toBe('2022Q2');
    expect(wrapper.find('.chart-horizontal-item__value').text()).toBe('3969.39');
    expect(wrapper.find('.chart-ranking-list').exists()).toBe(false);
    expect(wrapper.find('.chart-pivot-table').exists()).toBe(false);
    expect(wrapper.find('.chart-grid').exists()).toBe(false);
  });

  it('排名或多维度柱状图应按纵向榜单展示，避免横向卡片溢出页面', () => {
    const wrapper = mount(ResultChartView, {
      props: {
        title: '本季度各区域新增商机金额排名',
        viewType: 'BAR_CHART',
        series: Array.from({ length: 12 }, (_, index) => ({
          label: `区域${index + 1}`,
          value: 1200 - index * 60,
        })),
      },
      global: {
        stubs: {
          ElIcon: {
            template: '<span><slot /></span>',
          },
          ElEmpty: {
            template: '<div class="empty-stub" />',
          },
        },
      },
    });

    expect(wrapper.find('.chart-ranking-list').exists()).toBe(true);
    expect(wrapper.findAll('.chart-ranking-item')).toHaveLength(12);
    expect(wrapper.find('.chart-ranking-item__rank').text()).toBe('01');
    expect(wrapper.find('.chart-ranking-item__label').text()).toBe('区域1');
    expect(wrapper.find('.chart-horizontal-list').exists()).toBe(false);
  });
});

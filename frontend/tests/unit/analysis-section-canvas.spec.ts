import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import AnalysisSectionCanvas from '@/components/analysis/AnalysisSectionCanvas.vue';

describe('analysis section canvas', () => {
  it('详情表区块应复用中文表头和编码隐藏规则', () => {
    const wrapper = mount(AnalysisSectionCanvas, {
      props: {
        report: {
          variant: 'summary',
          reportTitle: '近一周新增商机明细',
          executiveSummary: '已生成明细。',
          keyFindings: [],
          metricCards: [],
          chartBlocks: [],
          tableBlocks: [],
          sections: [
            {
              sectionType: 'detail-table',
              title: '明细',
              rows: [
                {
                  team_name: '大东区-江苏区',
                  customer_category: 'mul_7a7d',
                },
              ],
            },
          ],
          datasetReferences: [],
          scopeSummary: '当前仅展示授权范围。',
          appliedFilters: [],
          availableActions: [],
        },
      },
      global: {
        stubs: {
          ManagementSectionCanvas: defineComponent({
            name: 'ManagementSectionCanvas',
            props: {
              section: {
                type: Object,
                required: true,
              },
            },
            setup(props) {
              return () => {
                const block = (props.section as any).blocks[0];
                return h('div', [
                  ...block.columns.map((column: any) => h('span', column.label)),
                  ...block.rows.map((row: any) => h('span', row.customer_category)),
                ]);
              };
            },
          }),
        },
      },
    });

    expect(wrapper.text()).toContain('团队');
    expect(wrapper.text()).toContain('客户分类');
    expect(wrapper.text()).toContain('选项值待同步');
    expect(wrapper.text()).not.toContain('team_name');
    expect(wrapper.text()).not.toContain('mul_7a7d');
  });
});

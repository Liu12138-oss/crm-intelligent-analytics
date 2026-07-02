import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ResultTableView from '@/components/analysis/ResultTableView.vue';

describe('result table view', () => {
  it('排名类结果在设置 maxRows 时应只展示前 20 条', () => {
    const rows = Array.from({ length: 25 }, (_, index) => ({
      ownerName: `负责人${index + 1}`,
      amount: 100 - index,
    }));

    const wrapper = mount(ResultTableView, {
      props: {
        rows,
        maxRows: 20,
        pageSize: 20,
      },
      global: {
        stubs: {
          ElTable: {
            props: ['data'],
            template: '<div class="el-table-stub">{{ data.length }}</div>',
          },
          ElTableColumn: {
            template: '<div><slot /></div>',
          },
          ElButton: {
            template: '<button><slot /></button>',
          },
          ElIcon: {
            template: '<span><slot /></span>',
          },
          ElEmpty: {
            template: '<div class="empty-stub" />',
          },
          ElPagination: {
            template: '<div class="pagination-stub" />',
          },
        },
      },
    });

    expect(wrapper.find('.el-table-stub').text()).toBe('20');
  });

  it('应优先按模板列配置渲染列顺序和列名', () => {
    const wrapper = mount(ResultTableView, {
      props: {
        title: '团队完成预测',
        rows: [
          {
            team_name: '大北区-北区金融部',
            annual_target: 6000,
            annual_forecast: 4800,
          },
        ],
        columns: [
          { key: 'annual_target', label: '全年目标' },
          { key: 'team_name', label: '团队' },
          { key: 'annual_forecast', label: '全年预测' },
        ],
      },
      global: {
        stubs: {
          ElTable: {
            props: ['data'],
            template: '<div class="el-table-stub"><slot /></div>',
          },
          ElTableColumn: {
            props: ['label'],
            template: '<div class="column-stub">{{ label }}</div>',
          },
          ElButton: {
            template: '<button><slot /></button>',
          },
          ElIcon: {
            template: '<span><slot /></span>',
          },
          ElEmpty: {
            template: '<div class="empty-stub" />',
          },
          ElPagination: {
            template: '<div class="pagination-stub" />',
          },
        },
      },
    });

    expect(wrapper.findAll('.column-stub').map((item) => item.text())).toEqual([
      '全年目标',
      '团队',
      '全年预测',
    ]);
    expect(wrapper.text()).toContain('团队完成预测');
  });

  it('明细表应分页展示，并为常见英文 key 提供中文列名', () => {
    const wrapper = mount(ResultTableView, {
      props: {
        rows: Array.from({ length: 12 }, (_, index) => ({
          team_name: `团队${index + 1}`,
          customer_name: `客户${index + 1}`,
          expected_amount: 10 + index,
        })),
        pageSize: 5,
      },
      global: {
        stubs: {
          ElTable: {
            props: ['data'],
            template: '<div class="el-table-stub">{{ data.length }}<slot /></div>',
          },
          ElTableColumn: {
            props: ['label', 'minWidth', 'width', 'showOverflowTooltip'],
            template:
              '<div class="column-stub" :data-min-width="minWidth" :data-tooltip="showOverflowTooltip">{{ label }}</div>',
          },
          ElButton: {
            template: '<button><slot /></button>',
          },
          ElIcon: {
            template: '<span><slot /></span>',
          },
          ElEmpty: {
            template: '<div class="empty-stub" />',
          },
          ElPagination: {
            props: ['total', 'pageSize', 'currentPage'],
            template:
              '<div class="pagination-stub">共 {{ total }} 条，每页 {{ pageSize }} 条，当前第 {{ currentPage }} 页</div>',
          },
        },
      },
    });

    expect(wrapper.find('.el-table-stub').text()).toContain('5');
    expect(wrapper.find('.pagination-stub').text()).toContain('共 12 条');
    expect(wrapper.findAll('.column-stub').map((item) => item.text())).toEqual([
      '团队',
      '最终客户',
      '预计有效收入（万元）',
    ]);
    expect(wrapper.find('.column-stub').attributes('data-tooltip')).toBeDefined();
  });

  it('明细表应支持切换每页条数并回到第一页', async () => {
    const wrapper = mount(ResultTableView, {
      props: {
        rows: Array.from({ length: 12 }, (_, index) => ({
          customer_name: `客户${index + 1}`,
        })),
        pageSize: 5,
      },
      global: {
        stubs: {
          ElTable: {
            props: ['data'],
            template: '<div class="el-table-stub">{{ data.length }}</div>',
          },
          ElTableColumn: {
            template: '<div />',
          },
          ElButton: {
            template: '<button><slot /></button>',
          },
          ElIcon: {
            template: '<span><slot /></span>',
          },
          ElEmpty: {
            template: '<div class="empty-stub" />',
          },
          ElPagination: {
            props: ['pageSize', 'currentPage', 'pageSizes'],
            emits: ['current-change', 'size-change'],
            template:
              '<button class="pagination-stub" @click="$emit(\'size-change\', 10)">每页 {{ pageSize }} 条 / 可选 {{ pageSizes.join(\',\') }} / 第 {{ currentPage }} 页</button>',
          },
        },
      },
    });

    expect(wrapper.find('.el-table-stub').text()).toBe('5');
    expect(wrapper.find('.pagination-stub').text()).toContain('每页 5 条');
    expect(wrapper.find('.pagination-stub').text()).toContain('5,10,20,50');

    await wrapper.find('.pagination-stub').trigger('click');

    expect(wrapper.find('.el-table-stub').text()).toBe('10');
    expect(wrapper.find('.pagination-stub').text()).toContain('每页 10 条');
    expect(wrapper.find('.pagination-stub').text()).toContain('第 1 页');
  });

  it('表格不应把配置项编码直接暴露给用户', () => {
    const wrapper = mount(ResultTableView, {
      props: {
        rows: [
          {
            customer_category: 'mul_7a7d',
            product_solution: 'mul_9804',
          },
        ],
      },
      global: {
        stubs: {
          ElTable: {
            props: ['data'],
            template:
              '<div class="el-table-stub"><slot v-for="row in data" :row="row" /></div>',
          },
          ElTableColumn: {
            props: ['label'],
            template: '<div class="column-stub">{{ label }}<slot :row="{ customer_category: \'mul_7a7d\', product_solution: \'mul_9804\' }" /></div>',
          },
          ElButton: {
            template: '<button><slot /></button>',
          },
          ElIcon: {
            template: '<span><slot /></span>',
          },
          ElEmpty: {
            template: '<div class="empty-stub" />',
          },
          ElPagination: {
            template: '<div class="pagination-stub" />',
          },
        },
      },
    });

    expect(wrapper.text()).toContain('客户分类');
    expect(wrapper.text()).toContain('产品解决方案');
    expect(wrapper.text()).toContain('选项值待同步');
    expect(wrapper.text()).not.toContain('mul_7a7d');
    expect(wrapper.text()).not.toContain('mul_9804');
  });

  it('自动推导列时应隐藏已有名称字段对应的内部 ID', () => {
    const wrapper = mount(ResultTableView, {
      props: {
        rows: [
          {
            ownerId: 'owner_wang',
            ownerName: '王敏',
            amount: 730000,
          },
        ],
      },
      global: {
        stubs: {
          ElTable: {
            props: ['data'],
            template:
              '<div class="el-table-stub"><slot v-for="row in data" :row="row" /></div>',
          },
          ElTableColumn: {
            props: ['label'],
            template: '<div class="column-stub">{{ label }}<slot :row="{ ownerId: \'owner_wang\', ownerName: \'王敏\', amount: 730000 }" /></div>',
          },
          ElButton: {
            template: '<button><slot /></button>',
          },
          ElIcon: {
            template: '<span><slot /></span>',
          },
          ElEmpty: {
            template: '<div class="empty-stub" />',
          },
          ElPagination: {
            template: '<div class="pagination-stub" />',
          },
        },
      },
    });

    expect(wrapper.text()).toContain('负责人');
    expect(wrapper.text()).toContain('王敏');
    expect(wrapper.text()).not.toContain('owner_wang');
    expect(wrapper.findAll('.column-stub').map((item) => item.text())).toEqual([
      '负责人王敏',
      '金额（万元）73 万元',
    ]);
  });

  it('分析结果表格中的元级金额应统一换算为万元展示', () => {
    const wrapper = mount(ResultTableView, {
      props: {
        rows: [
          {
            ownerName: '王敏',
            amount: 13777034,
          },
        ],
      },
      global: {
        stubs: {
          ElTable: {
            props: ['data'],
            template:
              '<div class="el-table-stub"><slot v-for="row in data" :row="row" /></div>',
          },
          ElTableColumn: {
            props: ['label'],
            template: '<div class="column-stub">{{ label }}<slot :row="{ ownerName: \'王敏\', amount: 13777034 }" /></div>',
          },
          ElButton: {
            template: '<button><slot /></button>',
          },
          ElIcon: {
            template: '<span><slot /></span>',
          },
          ElEmpty: {
            template: '<div class="empty-stub" />',
          },
          ElPagination: {
            template: '<div class="pagination-stub" />',
          },
        },
      },
    });

    expect(wrapper.text()).toContain('金额（万元）');
    expect(wrapper.text()).toContain('1,377.7 万元');
    expect(wrapper.text()).not.toContain('13777034');
  });

  it('配套图表展示时应支持横纵转置表格', () => {
    const wrapper = mount(ResultTableView, {
      props: {
        title: '10%+ 商机新增趋势',
        transpose: true,
        rows: [
          { quarter_label: '2022Q2', opportunity_amount: 3969.39 },
          { quarter_label: '2022Q3', opportunity_amount: 10625.83 },
        ],
        columns: [
          { key: 'quarter_label', label: '季度' },
          { key: 'opportunity_amount', label: '新增商机金额（万元）' },
        ],
      },
      global: {
        stubs: {
          ElButton: {
            template: '<button><slot /></button>',
          },
          ElIcon: {
            template: '<span><slot /></span>',
          },
          ElEmpty: {
            template: '<div class="empty-stub" />',
          },
          ElPagination: {
            template: '<div class="pagination-stub" />',
          },
        },
      },
    });

    expect(wrapper.find('.transposed-table').exists()).toBe(true);
    expect(wrapper.find('.el-table').exists()).toBe(false);
    expect(wrapper.findAll('.transposed-table thead th').map((item) => item.text())).toEqual([
      '指标',
      '2022Q2',
      '2022Q3',
    ]);
    expect(wrapper.findAll('.transposed-table tbody tr').map((item) => item.find('th').text())).toEqual([
      '新增商机金额（万元）',
    ]);
    expect(wrapper.text()).toContain('10,625.83');
  });

  it('转置表格列数较多时应撑开表格宽度并保留横向滚动空间', () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
      year_label: String(2015 + index),
      contract_count: index + 1,
      contract_amount: 1000 + index * 100,
      valid_income: 800 + index * 90,
    }));

    const wrapper = mount(ResultTableView, {
      props: {
        title: '价值客户历史提单趋势',
        transpose: true,
        rows,
        columns: [
          { key: 'year_label', label: '年份' },
          { key: 'contract_count', label: '合同数' },
          { key: 'contract_amount', label: '合同总额（万元）' },
          { key: 'valid_income', label: '有效收入（万元）' },
        ],
      },
      global: {
        stubs: {
          ElButton: {
            template: '<button><slot /></button>',
          },
          ElIcon: {
            template: '<span><slot /></span>',
          },
          ElEmpty: {
            template: '<div class="empty-stub" />',
          },
          ElPagination: {
            template: '<div class="pagination-stub" />',
          },
        },
      },
    });

    const table = wrapper.get('.transposed-table');
    const columns = wrapper.findAll('col');

    expect(table.attributes('style') ?? '').toContain('min-width: 1648px');
    expect(columns).toHaveLength(13);
    expect(columns[0].attributes('style')).toContain('width: 160px');
    expect(columns[1].attributes('style')).toContain('width: 124px');
  });
});

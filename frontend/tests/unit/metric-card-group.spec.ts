import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import MetricCardGroup from '@/components/analysis/MetricCardGroup.vue';

const mainCss = readFileSync(resolve(process.cwd(), 'src/styles/main.css'), 'utf-8');

const elementStubs = {
  ElCard: {
    template: '<section class="el-card-stub"><slot /></section>',
  },
  ElIcon: {
    template: '<span class="el-icon"><slot /></span>',
  },
};

describe('metric card group', () => {
  it('指标标题应使用独立图标底板，避免图标贴住文字', () => {
    const wrapper = mount(MetricCardGroup, {
      props: {
        metrics: [
          { name: '新增商机金额', value: '207.78', unit: '万元' },
          { name: '新增商机数', value: 137 },
        ],
      },
      global: {
        stubs: elementStubs,
      },
    });

    const labelIcons = wrapper.findAll('.metric-card__label-icon');

    expect(labelIcons).toHaveLength(2);
    expect(labelIcons.every((icon) => icon.attributes('aria-hidden') === 'true')).toBe(true);
    expect(wrapper.text()).toContain('新增商机金额');
    expect(wrapper.text()).toContain('新增商机数');
  });

  it('指标标题图标样式应使用 inline-flex、固定间距和居中对齐', () => {
    expect(mainCss).toContain('.metric-card__label');
    expect(mainCss).toContain('display: inline-flex;');
    expect(mainCss).toContain('gap: 8px;');
    expect(mainCss).toContain('justify-content: center;');
    expect(mainCss).toContain('flex: 0 0 22px;');
  });
});

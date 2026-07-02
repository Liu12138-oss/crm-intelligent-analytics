import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import BusinessEmptyState from '@/components/shared/BusinessEmptyState.vue';
import RiskLevelBadge from '@/components/shared/RiskLevelBadge.vue';
import StatusSummaryStrip from '@/components/shared/StatusSummaryStrip.vue';
import {
  businessModuleVisuals,
  chartColorTokens,
  resolveBusinessModuleVisual,
  resolveChartColor,
  statusToneLabels,
} from '@/ui/visual-language';

const elementStubs = {
  ElButton: {
    template: '<button type="button" @click="$emit(\'click\')"><slot /></button>',
  },
  ElIcon: {
    template: '<span class="el-icon-stub"><slot /></span>',
  },
  ElTag: {
    template: '<span class="el-tag-stub"><slot /></span>',
  },
};

describe('visual language', () => {
  it('图表色板应稳定轮转，避免页面只使用单一品牌色', () => {
    expect(chartColorTokens).toHaveLength(8);
    expect(resolveChartColor(0)).toBe(chartColorTokens[0].color);
    expect(resolveChartColor(8)).toBe(chartColorTokens[0].color);
  });

  it('主要业务模块应具备中文名称、摘要和图标', () => {
    for (const moduleKey of Object.keys(businessModuleVisuals) as Array<keyof typeof businessModuleVisuals>) {
      const visual = resolveBusinessModuleVisual(moduleKey);
      expect(visual.label).not.toBe('');
      expect(visual.summary).not.toBe('');
      expect(visual.icon).toBeTruthy();
    }
  });

  it('状态语义应覆盖无权限、降级、离线和阻断等业务状态', () => {
    expect(statusToneLabels.blocked).toBe('阻断');
    expect(statusToneLabels.degraded).toBe('降级');
    expect(statusToneLabels.offline).toBe('离线');
    expect(statusToneLabels.running).toBe('处理中');
  });

  it('业务空状态应展示模块图形、中文原因和下一步动作', async () => {
    const wrapper = mount(BusinessEmptyState, {
      props: {
        module: 'analysis',
        title: '等待输入经营问题',
        description: '请输入自然语言问题，系统会按当前权限范围返回结果。',
        actionText: '查看常用查询',
      },
      global: {
        stubs: elementStubs,
      },
    });

    expect(wrapper.text()).toContain('等待输入经营问题');
    expect(wrapper.text()).toContain('查看常用查询');
    await wrapper.find('button').trigger('click');
    expect(wrapper.emitted('action')?.length).toBeGreaterThanOrEqual(1);
  });

  it('状态摘要条和风险徽标应同时提供图标、中文文案和语义色 class', () => {
    const strip = mount(StatusSummaryStrip, {
      props: {
        items: [
          {
            label: '权限边界',
            value: '可问数',
            helper: '按当前 CRM 权限实时生效',
            tone: 'success',
          },
          {
            label: '服务状态',
            value: '降级',
            helper: '请稍后重试',
            tone: 'degraded',
          },
        ],
      },
      global: {
        stubs: elementStubs,
      },
    });
    expect(strip.find('.status-tone--success').exists()).toBe(true);
    expect(strip.find('.status-tone--degraded').exists()).toBe(true);

    const risk = mount(RiskLevelBadge, {
      props: {
        level: 'HIGH',
      },
      global: {
        stubs: elementStubs,
      },
    });
    expect(risk.text()).toContain('高风险');
    expect(risk.classes()).toContain('status-tone--danger');
  });
});

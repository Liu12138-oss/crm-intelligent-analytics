import { mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { nextTick } from 'vue';
import { describe, expect, it } from 'vitest';
import CommonQueryPanel from '@/components/analysis/CommonQueryPanel.vue';
import type { QueryAssetRecommendationItem, QueryTemplateItem } from '@/types/analysis';

describe('CommonQueryPanel', () => {
  const mainCss = readFileSync(resolve(process.cwd(), 'src/styles/main.css'), 'utf-8');
  const globalStubs = {
    ElButton: {
      template: '<button v-bind="$attrs"><slot /></button>',
    },
    ElIcon: {
      template: '<span><slot /></span>',
    },
    ElTooltip: {
      template: '<span><slot /></span>',
    },
  };

  it('模板列表加载中时应展示骨架状态并暂不显示空结果', () => {
    const wrapper = mount(CommonQueryPanel, {
      props: {
        items: [],
        loading: true,
      },
      global: {
        stubs: globalStubs,
      },
    });

    expect(wrapper.find('.common-query-panel__loading').exists()).toBe(true);
    expect(wrapper.text()).toContain('模板数据加载中');
    expect(wrapper.text()).not.toContain('暂无符合条件的模板。');
  });

  it('猜你想查应作为我的模板列表顶部标签项展示并支持删除', async () => {
    const recommendedItems: QueryAssetRecommendationItem[] = [
      {
        templateId: 'tpl_health',
        name: '季度商机健康度总览',
        description: '按团队查看当前季度新增商机金额、数量与赢单率。',
        recommendationReason: '结合当前时间场景推荐',
      },
      {
        templateId: 'tpl_distribution',
        name: '2026 团队新增商机月度分布',
        description: '查看近一周商机信息中的团队月度分布。',
        recommendationReason: '结合当前时间场景推荐',
      },
    ];
    const items: QueryTemplateItem[] = [
      {
        templateId: 'tpl_health',
        name: '季度商机健康度总览',
        description: '按团队查看当前季度新增商机金额、数量与赢单率。',
        defaultQuestionText: '季度商机健康度总览',
        defaultFilters: {},
        visibleRoleIds: ['role_sales_director'],
        displayOrder: 1,
        clickCount7d: 12,
        hitRatePercent: 96,
        optimizationStatus: 'HEALTHY',
        status: 'ACTIVE',
        updatedAt: '2026-05-14T09:00:00.000Z',
      },
      {
        templateId: 'tpl_distribution',
        name: '2026 团队新增商机月度分布',
        description: '查看近一周商机信息中的团队月度分布。',
        defaultQuestionText: '2026 团队新增商机月度分布',
        defaultFilters: {},
        visibleRoleIds: ['role_sales_director'],
        displayOrder: 2,
        clickCount7d: 10,
        hitRatePercent: 93,
        optimizationStatus: 'HEALTHY',
        status: 'ACTIVE',
        updatedAt: '2026-05-14T09:00:00.000Z',
      },
      {
        templateId: 'tpl_owner_rank',
        name: '负责人新增商机排名',
        description: '按负责人查看本月新增商机金额与数量排名。',
        defaultQuestionText: '负责人新增商机排名',
        defaultFilters: {},
        visibleRoleIds: ['role_sales_director'],
        displayOrder: 3,
        clickCount7d: 8,
        hitRatePercent: 91,
        optimizationStatus: 'HEALTHY',
        status: 'ACTIVE',
        updatedAt: '2026-05-14T09:00:00.000Z',
      },
    ];

    const wrapper = mount(CommonQueryPanel, {
      props: {
        items,
        recommendedItems,
      },
      global: {
        stubs: globalStubs,
      },
    });

    const cards = wrapper.findAll('.common-query-card');

    expect(wrapper.find('.analysis-asset-recommendations').exists()).toBe(false);
    expect(cards).toHaveLength(3);
    expect(wrapper.findAll('h4').map((node) => node.text())).toEqual([
      '季度商机健康度总览',
      '2026 团队新增商机月度分布',
      '负责人新增商机排名',
    ]);
    expect(cards[0].text()).toContain('猜你想查');
    expect(cards[0].text()).toContain('累计执行 12 次');
    expect(cards[0].text()).not.toContain('结合当前时间场景推荐');
    expect(cards[2].text()).not.toContain('猜你想查');

    await cards[0].find('button[aria-label="删除我的模板"]').trigger('click');

    expect(wrapper.emitted('delete')?.[0]).toEqual(['tpl_health']);
  });

  it('模板卡片应展示创建人与业务标签，并通过图标按钮触发详情、执行、新增和删除', async () => {
    const items: QueryTemplateItem[] = [
      {
        templateId: 'tpl_owner_rank',
        name: '负责人新增商机排名',
        description: '按负责人查看本月新增商机金额与数量排名。',
        defaultQuestionText: '负责人新增商机排名',
        defaultFilters: {},
        tags: ['内置模板', '常用查询', '排名'],
        ownerUserId: 'user_sales_director',
        ownerName: '张琳',
        visibleRoleIds: ['role_sales_director'],
        displayOrder: 1,
        clickCount7d: 8,
        hitRatePercent: 91,
        optimizationStatus: 'HEALTHY',
        status: 'ACTIVE',
        updatedAt: '2026-05-14T09:00:00.000Z',
      },
    ];

    const wrapper = mount(CommonQueryPanel, {
      props: {
        items,
        canCreate: true,
      },
      global: {
        stubs: globalStubs,
      },
    });

    expect(wrapper.text()).toContain('负责人新增商机排名');
    const cardText = wrapper.find('.common-query-card').text();
    expect(wrapper.text()).toContain('张琳');
    expect(cardText).toContain('排名');
    expect(cardText).not.toContain('内置模板');
    expect(cardText).not.toContain('常用查询');
    expect(wrapper.text()).not.toContain('经营分析');
    expect(wrapper.text()).not.toContain('主分类');
    expect(wrapper.text()).not.toContain('按负责人查看本月新增商机金额与数量排名。');

    await wrapper.find('button[aria-label="新增查询模板"]').trigger('click');
    await wrapper.find('button[aria-label="查看模板内容"]').trigger('click');
    await wrapper.find('button[aria-label="执行模板"]').trigger('click');
    await wrapper.find('button[aria-label="删除我的模板"]').trigger('click');

    expect(wrapper.emitted('create')).toHaveLength(1);
    expect(wrapper.emitted('view')?.[0]).toEqual(['tpl_owner_rank']);
    expect(wrapper.emitted('run')?.[0]).toEqual(['tpl_owner_rank']);
    expect(wrapper.emitted('delete')?.[0]).toEqual(['tpl_owner_rank']);
  });

  it('查询条件应只提交关键词和标签，不再提交主分类', async () => {
    const wrapper = mount(CommonQueryPanel, {
      props: {
        items: [],
        tags: ['排名'],
      },
      global: {
        stubs: globalStubs,
      },
    });

    expect(wrapper.text()).not.toContain('主分类');

    await wrapper.find('button[aria-label="查询模板"]').trigger('click');

    expect(wrapper.emitted('query')?.[0]?.[0]).toEqual(
      expect.not.objectContaining({
        category: expect.anything(),
      }),
    );
  });

  it('明确查询条件下应只展示查询结果并隐藏猜你想查', async () => {
    const recommendedItems: QueryAssetRecommendationItem[] = [
      {
        templateId: 'tpl_health',
        name: '季度商机健康度总览',
        description: '按团队查看当前季度新增商机金额、数量与赢单率。',
        recommendationReason: '结合当前时间场景推荐',
      },
    ];
    const items: QueryTemplateItem[] = [
      {
        templateId: 'tpl_owner_rank',
        name: '负责人新增商机排名',
        description: '按负责人查看本月新增商机金额与数量排名。',
        defaultQuestionText: '负责人新增商机排名',
        defaultFilters: {},
        tags: ['排名'],
        visibleRoleIds: ['role_sales_director'],
        displayOrder: 3,
        clickCount7d: 8,
        hitRatePercent: 91,
        optimizationStatus: 'HEALTHY',
        status: 'ACTIVE',
        updatedAt: '2026-05-14T09:00:00.000Z',
      },
    ];

    const wrapper = mount(CommonQueryPanel, {
      props: {
        items,
        recommendedItems,
      },
      global: {
        stubs: globalStubs,
      },
    });

    await wrapper.find('input[placeholder="模板名称、说明或标签"]').setValue('负责人');
    await wrapper.find('input[placeholder="模板名称、说明或标签"]').trigger('keyup.enter');

    const cards = wrapper.findAll('.common-query-card');

    expect(cards).toHaveLength(1);
    expect(cards[0].text()).toContain('负责人新增商机排名');
    expect(wrapper.text()).not.toContain('猜你想查');
    expect(wrapper.text()).not.toContain('季度商机健康度总览');
    expect(wrapper.emitted('query')?.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        scope: 'mine',
        keyword: '负责人',
      }),
    );
  });

  it('我的模板和其它模板均应支持回车与标签变更触发查询', async () => {
    const wrapper = mount(CommonQueryPanel, {
      props: {
        items: [],
        tags: ['排名', '商机'],
      },
      global: {
        stubs: globalStubs,
      },
    });

    await wrapper.find('input[placeholder="模板名称、说明或标签"]').setValue('金额');
    await wrapper.find('input[placeholder="模板名称、说明或标签"]').trigger('keyup.enter');

    expect(wrapper.emitted('query')?.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        scope: 'mine',
        keyword: '金额',
      }),
    );

    const mineTagSelect = wrapper.findComponent({ name: 'ElSelect' });
    mineTagSelect.vm.$emit('update:modelValue', '排名');
    await nextTick();
    mineTagSelect.vm.$emit('change', '排名');

    expect(wrapper.emitted('query')?.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        scope: 'mine',
        keyword: '金额',
        tag: '排名',
      }),
    );

    await wrapper.findAll('.el-tabs__item')[1].trigger('click');
    await nextTick();
    await wrapper.find('input[placeholder="模板名称、说明或标签"]').setValue('商机');
    await wrapper.find('input[placeholder="模板名称、说明或标签"]').trigger('keyup.enter');

    expect(wrapper.emitted('query')?.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        scope: 'others',
        keyword: '商机',
        tag: '排名',
      }),
    );

    const otherTagSelect = wrapper.findComponent({ name: 'ElSelect' });
    otherTagSelect.vm.$emit('update:modelValue', '商机');
    await nextTick();
    otherTagSelect.vm.$emit('change', '商机');

    expect(wrapper.emitted('query')?.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        scope: 'others',
        keyword: '商机',
        tag: '商机',
      }),
    );
  });

  it('其它模板筛选不应展示用户 ID 文案', async () => {
    const wrapper = mount(CommonQueryPanel, {
      props: {
        items: [],
        tags: ['内置模板', '常用查询', '排名'],
      },
      global: {
        stubs: globalStubs,
      },
    });

    await wrapper.findAll('.el-tabs__item')[1].trigger('click');
    await nextTick();

    expect(wrapper.find('input[placeholder="用户/创建人"]').exists()).toBe(true);
    expect(wrapper.find('input[placeholder="用户/创建人ID"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('用户/创建人ID');
    expect((wrapper.vm as unknown as { visibleFilterTags: string[] }).visibleFilterTags).toEqual([
      '排名',
    ]);
  });

  it('模板卡片操作区应保持 18px 实际图标和 8px 图标间距', () => {
    expect(mainCss).toMatch(
      /\.common-query-card__actions\s*\{[\s\S]*?gap:\s*8px;[\s\S]*?\}/,
    );
    expect(mainCss).toMatch(
      /\.common-query-card__actions\s+\.analysis-button--icon\s+\.el-icon\s*\{[\s\S]*?width:\s*18px;[\s\S]*?height:\s*18px;[\s\S]*?font-size:\s*18px;[\s\S]*?\}/,
    );
    expect(mainCss).toMatch(
      /\.common-query-card__actions\s+\.analysis-button--icon\s+\.el-icon\s+svg\s*\{[\s\S]*?width:\s*18px;[\s\S]*?height:\s*18px;[\s\S]*?\}/,
    );
  });

  it('模板列表和卡片右边界应与筛选区对齐', () => {
    expect(mainCss).toMatch(
      /\.common-query-panel__list\s*\{[\s\S]*?padding-right:\s*0;[\s\S]*?scrollbar-gutter:\s*auto;[\s\S]*?\}/,
    );
    expect(mainCss).toMatch(
      /\.common-query-card\s*\{[\s\S]*?width:\s*100%;[\s\S]*?box-sizing:\s*border-box;[\s\S]*?\}/,
    );
  });

  it('模板侧栏正文不应撑破面板高度，列表底部应保留滚动余量', () => {
    expect(mainCss).toMatch(
      /\.analysis-common-sidebar\s*\{[\s\S]*?height:\s*calc\(100(?:dvh|vh)\s*-\s*72px\s*-\s*48px\);[\s\S]*?\}/,
    );
    expect(mainCss).not.toMatch(
      /\.analysis-common-sidebar\s*\{[\s\S]*?height:\s*calc\(100vh\s*-\s*36px\);[\s\S]*?\}/,
    );

    const bodyRule = mainCss.match(/\.common-query-panel__body\s*\{(?<content>[\s\S]*?)\}/)
      ?.groups?.content ?? '';

    expect(bodyRule).not.toMatch(/height:\s*100%;/);
    expect(bodyRule).toMatch(/min-height:\s*0;/);
    expect(mainCss).toMatch(
      /\.common-query-panel__list\s*\{[\s\S]*?padding-bottom:\s*12px;[\s\S]*?\}/,
    );
  });

  it('模板筛选查询按钮应与表单控件保持同高', () => {
    expect(mainCss).toMatch(
      /\.common-query-panel__filters\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)\s+32px;[\s\S]*?\}/,
    );
    expect(mainCss).toMatch(
      /\.common-query-panel__query-button\.analysis-button--icon\s*\{[\s\S]*?width:\s*32px;[\s\S]*?min-width:\s*32px;[\s\S]*?height:\s*32px;[\s\S]*?min-height:\s*32px;[\s\S]*?padding-inline:\s*0;[\s\S]*?\}/,
    );
  });

  it('模板创建人与标签应保持单行展示，超出时隐藏或省略', () => {
    expect(mainCss).toMatch(
      /\.common-query-card__identity-row\s*\{[\s\S]*?display:\s*flex;[\s\S]*?white-space:\s*nowrap;[\s\S]*?\}/,
    );
    expect(mainCss).toMatch(
      /\.common-query-card__owner span\s*\{[\s\S]*?overflow:\s*hidden;[\s\S]*?text-overflow:\s*ellipsis;[\s\S]*?white-space:\s*nowrap;[\s\S]*?\}/,
    );
    expect(mainCss).toMatch(
      /\.common-query-card__tag\.el-tag \.el-tag__content\s*\{[\s\S]*?overflow:\s*hidden;[\s\S]*?text-overflow:\s*ellipsis;[\s\S]*?white-space:\s*nowrap;[\s\S]*?\}/,
    );
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import QueryTemplatePage from '@/pages/governance/QueryTemplatePage.vue';
import { analysisService } from '@/services/analysis.service';

vi.mock('@/services/analysis.service', () => ({
  analysisService: {
    listGovernanceTemplates: vi.fn(),
    listGovernanceTemplateFacets: vi.fn(),
    listAnalysisSemanticKnowledgeAssets: vi.fn(),
    createGovernanceTemplate: vi.fn(),
    updateGovernanceTemplate: vi.fn(),
    deleteGovernanceTemplate: vi.fn(),
    validateGovernanceTemplate: vi.fn(),
    previewGovernanceTemplate: vi.fn(),
  },
}));

vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('element-plus')>();
  return {
    ...actual,
    ElMessage: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
    },
    ElMessageBox: {
      confirm: vi.fn(),
    },
  };
});

const ElButtonStub = defineComponent({
  name: 'ElButtonStub',
  emits: ['click'],
  setup(_, { attrs, emit, slots }) {
    return () =>
      h(
        'button',
        {
          ...attrs,
          type: 'button',
          onClick: () => emit('click'),
        },
        slots.default?.(),
      );
  },
});

const ElDrawerStub = defineComponent({
  name: 'ElDrawerStub',
  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:modelValue'],
  setup(props, { attrs, slots }) {
    return () =>
      props.modelValue
        ? h('section', { ...attrs, class: 'el-drawer-stub' }, [
            slots.default?.(),
            slots.footer?.(),
          ])
        : null;
  },
});

const ElInputStub = defineComponent({
  name: 'ElInputStub',
  props: {
    modelValue: {
      type: [String, Number],
      default: '',
    },
    type: {
      type: String,
      default: 'text',
    },
  },
  emits: ['update:modelValue'],
  setup(props, { attrs, emit }) {
    return () =>
      props.type === 'textarea'
        ? h('textarea', {
            ...attrs,
            value: props.modelValue,
            onInput: (event: Event) => {
              emit('update:modelValue', (event.target as HTMLTextAreaElement).value);
            },
          })
        : h('input', {
            ...attrs,
            value: props.modelValue,
            onInput: (event: Event) => {
              emit('update:modelValue', (event.target as HTMLInputElement).value);
            },
          });
  },
});

const ElSelectStub = defineComponent({
  name: 'ElSelectStub',
  props: {
    modelValue: {
      type: [String, Number, Array],
      default: '',
    },
  },
  emits: ['update:modelValue'],
  setup(props, { attrs, emit, slots }) {
    return () =>
      h(
        'select',
        {
          ...attrs,
          value: props.modelValue,
          onChange: (event: Event) => {
            emit('update:modelValue', (event.target as HTMLSelectElement).value);
          },
        },
        slots.default?.(),
      );
  },
});

const ElOptionStub = defineComponent({
  name: 'ElOptionStub',
  props: {
    label: {
      type: String,
      default: '',
    },
    value: {
      type: String,
      default: '',
    },
  },
  setup(props) {
    return () => h('option', { value: props.value }, props.label);
  },
});

const ElSwitchStub = defineComponent({
  name: 'ElSwitchStub',
  props: {
    activeText: {
      type: String,
      default: '',
    },
    inactiveText: {
      type: String,
      default: '',
    },
    modelValue: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:modelValue'],
  setup(props, { attrs, emit }) {
    return () =>
      h('label', { class: 'el-switch-stub' }, [
        h('input', {
          ...attrs,
          type: 'checkbox',
          checked: props.modelValue,
          onChange: (event: Event) => {
            emit('update:modelValue', (event.target as HTMLInputElement).checked);
          },
        }),
        h('span', props.activeText),
        h('span', props.inactiveText),
      ]);
  },
});

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await nextTick();
  await Promise.resolve();
  await nextTick();
}

describe('query template page', () => {
  beforeEach(() => {
    vi.mocked(analysisService.listGovernanceTemplates).mockReset();
    vi.mocked(analysisService.listGovernanceTemplateFacets).mockReset();
    vi.mocked(analysisService.listGovernanceTemplateFacets).mockResolvedValue({ tags: [] });
    vi.mocked(analysisService.listAnalysisSemanticKnowledgeAssets).mockReset();
    vi.mocked(analysisService.createGovernanceTemplate).mockReset();
    vi.mocked(analysisService.updateGovernanceTemplate).mockReset();
    vi.mocked((analysisService as any).deleteGovernanceTemplate).mockReset();
    vi.mocked(analysisService.validateGovernanceTemplate).mockReset();
    vi.mocked(analysisService.previewGovernanceTemplate).mockReset();
    vi.mocked(ElMessage.success).mockReset();
    vi.mocked(ElMessage.error).mockReset();
    vi.mocked(ElMessage.warning).mockReset();
    vi.mocked(ElMessageBox.confirm).mockReset();
  });

  it('应默认展示模板列表且不再请求语义资产治理数据', async () => {
    vi.mocked(analysisService.listGovernanceTemplates).mockResolvedValue({
      items: [
        {
          templateId: 'tpl_001',
          name: '近一周新增商机明细',
          description: '查看近一周新增商机、负责人和预计有效收入。',
          defaultQuestionText: '近一周新增商机明细',
          defaultFilters: {
            recentDays: 7,
            groupBy: 'detail',
          },
          defaultViewType: 'DETAIL_TABLE',
          queryMode: 'FIXED_SQL',
          sqlVersion: '2026.05.12',
          visibleRoleIds: ['role_admin'],
          displayOrder: 1,
          clickCount7d: 12,
          hitRatePercent: 91,
          optimizationStatus: 'HEALTHY',
          status: 'ACTIVE',
          updatedAt: '2026-05-12T09:00:00.000Z',
        },
      ],
    });
    vi.mocked(analysisService.listAnalysisSemanticKnowledgeAssets).mockResolvedValue({
      draftItems: [],
      publishedSummary: {
        assetCount: 0,
      },
    });

    const wrapper = mount(QueryTemplatePage, {
      global: {
        stubs: {
          ElButton: ElButtonStub,
          ElDrawer: ElDrawerStub,
          ElTable: { template: '<div class="el-table-stub"><slot /></div>' },
          ElTableColumn: { template: '<div><slot /></div>' },
          ElInput: ElInputStub,
          ElSelect: ElSelectStub,
          ElOption: ElOptionStub,
          ElSwitch: ElSwitchStub,
          ElAlert: { template: '<div><slot /></div>' },
          ElIcon: { template: '<span><slot /></span>' },
          ElPopconfirm: { template: '<div><slot name="reference" /><slot /></div>' },
          ElTag: { template: '<div><slot /></div>' },
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('模板列表');
    expect(wrapper.text()).toContain('新增模板');
    expect(wrapper.text()).not.toContain('默认条件来源');
    expect(wrapper.text()).not.toContain('语义资产治理');
    expect(wrapper.text()).not.toContain('模板资产摘要');
    expect(analysisService.listGovernanceTemplates).toHaveBeenCalledTimes(1);
    expect(analysisService.listAnalysisSemanticKnowledgeAssets).not.toHaveBeenCalled();
  });

  it('点击编辑后应改为业务表单，不再展示 JSON 配置字段', async () => {
    vi.mocked(analysisService.listGovernanceTemplates).mockResolvedValue({
      items: [
        {
          templateId: 'tpl_001',
          name: '2026 各团队完成预测',
          description: '查看全年目标、有效收入、承诺商机与完成率预测。',
          defaultQuestionText: '2026 各团队完成预测',
          defaultFilters: {
            year: 2026,
            committedOnly: true,
            groupBy: 'team',
          },
          defaultViewType: 'BAR_CHART',
          queryMode: 'FIXED_SQL',
          sqlVersion: '2026.05.12',
          visibleRoleIds: ['role_admin'],
          displayOrder: 1,
          clickCount7d: 18,
          hitRatePercent: 95,
          optimizationStatus: 'HEALTHY',
          status: 'ACTIVE',
          updatedAt: '2026-05-12T09:00:00.000Z',
        },
      ],
    });
    vi.mocked(analysisService.listAnalysisSemanticKnowledgeAssets).mockResolvedValue({
      draftItems: [],
      publishedSummary: {
        assetCount: 0,
      },
    });

    const wrapper = mount(QueryTemplatePage, {
      global: {
        stubs: {
          ElButton: ElButtonStub,
          ElDrawer: ElDrawerStub,
          ElTable: { template: '<div class="el-table-stub"><slot /></div>' },
          ElTableColumn: { template: '<div><slot /></div>' },
          ElInput: ElInputStub,
          ElSelect: ElSelectStub,
          ElOption: ElOptionStub,
          ElSwitch: ElSwitchStub,
          ElAlert: { template: '<div><slot /></div>' },
          ElIcon: { template: '<span><slot /></span>' },
          ElPopconfirm: { template: '<div><slot name="reference" /><slot /></div>' },
          ElTag: { template: '<div><slot /></div>' },
        },
      },
    });

    await flushPromises();
    await wrapper.get('[data-testid="edit-template"]').trigger('click');
    await flushPromises();

    expect(wrapper.text()).not.toContain('模板配置');
    expect(wrapper.text()).not.toContain('默认条件推荐');
    expect(wrapper.text()).not.toContain('SQL 与参数配置');
    expect(wrapper.text()).not.toContain('展示与 AI 配置');
    expect(wrapper.text()).not.toContain('默认查询条件 JSON');
    expect(wrapper.text()).not.toContain('参数定义 JSON');
    expect(wrapper.text()).not.toContain('展示配置 JSON');
    expect(wrapper.text()).not.toContain('AI 配置 JSON');
    expect(wrapper.text()).not.toContain('推荐配置 JSON');
    expect(wrapper.text()).not.toContain('条件方案');
    expect(wrapper.text()).not.toContain('条件摘要');
    expect(wrapper.text()).not.toContain('结果标题');
    expect(wrapper.text()).not.toContain('默认问题');
    expect(wrapper.text()).not.toContain('AI 报告提示词');
    expect(wrapper.text()).not.toContain('空结果提示词');
    expect(wrapper.text()).not.toContain('推荐提示文案');
    expect(wrapper.text()).not.toContain('可见角色 ID');
    expect(wrapper.text()).not.toContain('主分类');
    expect(wrapper.text()).toContain('模板名称');
    expect(wrapper.text()).toContain('模板说明');
    expect(wrapper.text()).toContain('模板状态');
    expect(wrapper.find('[data-testid="default-view-select"]').exists()).toBe(true);
    expect(wrapper.find('.el-drawer-stub').exists()).toBe(true);
  });

  it('新增模板默认说明应描述业务用途，不展示看板来源句式', async () => {
    vi.mocked(analysisService.listGovernanceTemplates).mockResolvedValue({
      items: [],
    });

    const wrapper = mount(QueryTemplatePage, {
      global: {
        stubs: {
          ElButton: ElButtonStub,
          ElDrawer: ElDrawerStub,
          ElTable: { template: '<div class="el-table-stub"><slot /></div>' },
          ElTableColumn: { template: '<div><slot /></div>' },
          ElInput: ElInputStub,
          ElSelect: ElSelectStub,
          ElOption: ElOptionStub,
          ElSwitch: ElSwitchStub,
          ElAlert: { template: '<div><slot /></div>' },
          ElIcon: { template: '<span><slot /></span>' },
          ElPopconfirm: { template: '<div><slot name="reference" /><slot /></div>' },
          ElTag: { template: '<div><slot /></div>' },
        },
      },
    });

    await flushPromises();
    await wrapper.get('.panel__header-actions .button-primary').trigger('click');
    await flushPromises();

    const descriptionInput = wrapper.find('textarea.textarea');
    const description = (descriptionInput.element as HTMLTextAreaElement).value;

    expect(description).toContain('查看');
    expect(description).not.toMatch(/源自|来源于/);
  });

  it('创建成功后应使用右上角消息提示，而不是在页面内渲染提示条', async () => {
    vi.mocked(analysisService.listGovernanceTemplates).mockResolvedValue({
      items: [],
    });
    vi.mocked(analysisService.validateGovernanceTemplate).mockResolvedValue({
      status: 'PASSED',
      message: '模板 SQL 已通过只读校验。',
      scopeAnalysis: {
        scopeMode: 'AUTO_SCOPE',
        detectedScopeFields: [],
        friendlyMessage: '未检测到显式范围条件，系统将在执行时按当前用户权限自动收口。',
      },
    });
    vi.mocked(analysisService.createGovernanceTemplate).mockResolvedValue({
      templateId: 'tpl_created',
      name: '近一周新增商机明细',
      description: '查看近一周新增商机明细。',
      defaultQuestionText: '近一周新增商机明细',
      defaultFilters: {
        recentDays: 7,
      },
      defaultViewType: 'DETAIL_TABLE',
      queryMode: 'FIXED_SQL',
      sqlVersion: '2026.05.12',
      visibleRoleIds: ['role_admin'],
      displayOrder: 1,
      clickCount7d: 0,
      hitRatePercent: 0,
      optimizationStatus: 'HEALTHY',
      status: 'ACTIVE',
      updatedAt: '2026-05-12T09:00:00.000Z',
    });

    const wrapper = mount(QueryTemplatePage, {
      global: {
        stubs: {
          ElButton: ElButtonStub,
          ElDrawer: ElDrawerStub,
          ElTable: { template: '<div class="el-table-stub"><slot /></div>' },
          ElTableColumn: { template: '<div><slot /></div>' },
          ElInput: ElInputStub,
          ElAlert: { template: '<div class="el-alert-stub"><slot /></div>' },
          ElIcon: { template: '<span><slot /></span>' },
          ElPopconfirm: { template: '<div><slot name="reference" /><slot /></div>' },
          ElTag: { template: '<div><slot /></div>' },
        },
      },
    });

    await flushPromises();
    await wrapper.get('.panel__header-actions .button-primary').trigger('click');
    await flushPromises();

    const buttons = wrapper.findAll('button');
    const saveButton = buttons.find((item) => item.text().includes('创建模板'));
    expect(saveButton).toBeTruthy();

    await saveButton?.trigger('click');
    await flushPromises();

    expect(ElMessage.success).toHaveBeenCalledWith('模板已创建。');
    expect(wrapper.text()).not.toContain('模板已创建。');
  });

  it('创建模板前应先执行 SQL 校验', async () => {
    vi.mocked(analysisService.listGovernanceTemplates).mockResolvedValue({
      items: [],
    });
    vi.mocked(analysisService.validateGovernanceTemplate).mockResolvedValue({
      status: 'PASSED',
      message: '模板 SQL 已通过只读校验。',
      scopeAnalysis: {
        scopeMode: 'AUTO_SCOPE',
        detectedScopeFields: [],
        friendlyMessage: '未检测到显式范围条件，系统将在执行时按当前用户权限自动收口。',
      },
    });
    vi.mocked(analysisService.createGovernanceTemplate).mockResolvedValue({
      templateId: 'tpl_created',
      name: '近一周新增商机明细',
      description: '查看近一周新增商机明细。',
      defaultQuestionText: '近一周新增商机明细',
      defaultFilters: {
        recentDays: 7,
      },
      defaultViewType: 'DETAIL_TABLE',
      queryMode: 'FIXED_SQL',
      sqlVersion: '2026.05.12',
      visibleRoleIds: ['role_admin'],
      displayOrder: 1,
      clickCount7d: 0,
      hitRatePercent: 0,
      optimizationStatus: 'HEALTHY',
      status: 'ACTIVE',
      updatedAt: '2026-05-12T09:00:00.000Z',
    });

    const wrapper = mount(QueryTemplatePage, {
      global: {
        stubs: {
          ElButton: ElButtonStub,
          ElDrawer: ElDrawerStub,
          ElTable: { template: '<div class="el-table-stub"><slot /></div>' },
          ElTableColumn: { template: '<div><slot /></div>' },
          ElInput: ElInputStub,
          ElAlert: { template: '<div class="el-alert-stub"><slot /></div>' },
          ElIcon: { template: '<span><slot /></span>' },
          ElPopconfirm: { template: '<div><slot name="reference" /><slot /></div>' },
          ElTag: { template: '<div><slot /></div>' },
        },
      },
    });

    await flushPromises();
    await wrapper.get('.panel__header-actions .button-primary').trigger('click');
    await flushPromises();

    const buttons = wrapper.findAll('button');
    const saveButton = buttons.find((item) => item.text().includes('创建模板'));
    expect(saveButton).toBeTruthy();

    await saveButton?.trigger('click');
    await flushPromises();

    expect(analysisService.validateGovernanceTemplate).toHaveBeenCalledWith(
      'draft_template',
      expect.objectContaining({
        sqlText: expect.not.stringContaining(':scopeOrganizationIds'),
      }),
    );
    expect(analysisService.createGovernanceTemplate).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(analysisService.validateGovernanceTemplate).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(analysisService.createGovernanceTemplate).mock.invocationCallOrder[0],
    );
  });

  it('SQL 校验返回范围风险时应展示中文风险和修复建议', async () => {
    vi.mocked(analysisService.listGovernanceTemplates).mockResolvedValue({
      items: [],
    });
    vi.mocked(analysisService.validateGovernanceTemplate).mockResolvedValue({
      status: 'PASSED',
      message: '当前模板需要治理复核：展示口径与权限过滤口径不一致。',
      scopeAnalysis: {
        scopeMode: 'DECLARED_SCOPE',
        scopeClassification: 'COMPLEX_REVIEW_REQUIRED',
        reviewStatus: 'REVIEW_REQUIRED',
        detectedScopeFields: ['department_id'],
        friendlyMessage: '当前模板需要治理复核：展示口径与权限过滤口径不一致。',
        riskFindings: [
          {
            code: 'DISPLAY_SCOPE_MISMATCH',
            severity: 'HIGH',
            title: '展示口径与权限过滤口径不一致',
            description: '模板按商机归属收口，但团队名称来自客户归属部门。',
            suggestion: '请改成按主业务对象归属部门展示，或补充治理审核。',
          },
        ],
        fixSuggestions: ['请改成按主业务对象归属部门展示，或补充治理审核。'],
      },
    });

    const wrapper = mount(QueryTemplatePage, {
      global: {
        stubs: {
          ElButton: ElButtonStub,
          ElDrawer: ElDrawerStub,
          ElTable: { template: '<div class="el-table-stub"><slot /></div>' },
          ElTableColumn: { template: '<div><slot /></div>' },
          ElInput: ElInputStub,
          ElSelect: ElSelectStub,
          ElOption: ElOptionStub,
          ElSwitch: ElSwitchStub,
          ElAlert: { template: '<div><slot /></div>' },
          ElIcon: { template: '<span><slot /></span>' },
          ElPopconfirm: { template: '<div><slot name="reference" /><slot /></div>' },
          ElTag: { template: '<div><slot /></div>' },
        },
      },
    });

    await flushPromises();
    await wrapper.get('.panel__header-actions .button-primary').trigger('click');
    await flushPromises();
    await wrapper.get('[data-testid="validate-template"]').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('展示口径与权限过滤口径不一致');
    expect(wrapper.text()).toContain('请改成按主业务对象归属部门展示');
    expect(wrapper.text()).not.toContain('DISPLAY_SCOPE_MISMATCH');
  });

  it('删除前应调用统一确认弹窗，而不是使用行内确认气泡', async () => {
    vi.mocked(analysisService.listGovernanceTemplates).mockResolvedValue({
      items: [
        {
          templateId: 'tpl_001',
          name: '近一周新增商机明细',
          description: '查看近一周新增商机明细。',
          defaultQuestionText: '近一周新增商机明细',
          defaultFilters: {
            recentDays: 7,
          },
          defaultViewType: 'DETAIL_TABLE',
          queryMode: 'FIXED_SQL',
          sqlVersion: '2026.05.12',
          visibleRoleIds: ['role_admin'],
          displayOrder: 1,
          clickCount7d: 12,
          hitRatePercent: 91,
          optimizationStatus: 'HEALTHY',
          status: 'ACTIVE',
          updatedAt: '2026-05-12T09:00:00.000Z',
        },
      ],
    });
    vi.mocked(ElMessageBox.confirm).mockResolvedValue('confirm' as never);
    vi.mocked((analysisService as any).deleteGovernanceTemplate).mockResolvedValue({
      success: true,
      templateId: 'tpl_001',
    });

    const wrapper = mount(QueryTemplatePage, {
      global: {
        stubs: {
          ElButton: ElButtonStub,
          ElDrawer: ElDrawerStub,
          ElTable: { template: '<div class="el-table-stub"><slot /></div>' },
          ElTableColumn: { template: '<div><slot /></div>' },
          ElInput: ElInputStub,
          ElAlert: { template: '<div><slot /></div>' },
          ElIcon: { template: '<span><slot /></span>' },
          ElPopconfirm: { template: '<div><slot name="reference" /><slot /></div>' },
          ElTag: { template: '<div><slot /></div>' },
        },
      },
    });

    await flushPromises();
    await wrapper.get('[data-testid="delete-template"]').trigger('click');
    await flushPromises();

    expect(ElMessageBox.confirm).toHaveBeenCalled();
    expect((analysisService as any).deleteGovernanceTemplate).toHaveBeenCalledWith('tpl_001');
    expect(ElMessage.success).toHaveBeenCalledWith('模板「近一周新增商机明细」已删除。');
  });
});

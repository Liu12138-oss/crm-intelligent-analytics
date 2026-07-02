import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import WecomOrgSubjectPicker from '@/components/shared/WecomOrgSubjectPicker.vue';
import type { WecomOrgSubjectOptionsView } from '@/types/analysis';

vi.mock('element-plus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('element-plus')>();
  return {
    ...actual,
    ElMessage: {
      success: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
    },
  };
});

const subjects: WecomOrgSubjectOptionsView = {
  lastSyncedAt: '2026-05-20T10:00:00.000Z',
  departments: [
    {
      departmentId: 'dept_sales',
      name: '销售部',
      syncStatus: 'ACTIVE',
      crmDepartmentId: 'dept_sales',
      crmDepartmentName: '销售部',
      mappingStatus: 'MAPPED',
    },
    {
      departmentId: 'dept_region_east',
      name: '华东销售部',
      parentDepartmentId: 'dept_sales',
      syncStatus: 'ACTIVE',
      crmDepartmentId: 'dept_region_east',
      crmDepartmentName: '华东销售部',
      mappingStatus: 'MAPPED',
    },
    {
      departmentId: 'wx_unmapped_department',
      name: '未映射部门',
      syncStatus: 'ACTIVE',
      mappingStatus: 'UNMAPPED',
      disabledReason: '未绑定 CRM 部门，不能保存为授权部门。',
    },
  ],
  users: [
    {
      wecomUserId: 'wx_region_manager',
      name: '区域经理',
      departmentIds: ['dept_region_east'],
      primaryDepartmentId: 'dept_region_east',
      crmUserId: 'user_region_manager',
      crmUserName: '区域经理',
      syncStatus: 'ACTIVE',
      mappingStatus: 'MAPPED',
    },
    {
      wecomUserId: 'wx_sales_director',
      name: '销售总监',
      departmentIds: ['dept_sales'],
      primaryDepartmentId: 'dept_sales',
      crmUserId: 'user_sales_director',
      crmUserName: '销售总监',
      syncStatus: 'ACTIVE',
      mappingStatus: 'MAPPED',
    },
    {
      wecomUserId: 'wx_unmapped_member',
      name: '未映射成员',
      departmentIds: ['dept_sales'],
      primaryDepartmentId: 'dept_sales',
      syncStatus: 'ACTIVE',
      mappingStatus: 'UNMAPPED',
      disabledReason: '未绑定 CRM 用户，不能保存为授权人员。',
    },
  ],
};

async function openPicker(wrapper: ReturnType<typeof mount>): Promise<void> {
  await wrapper.get('[data-test="wecom-org-picker-open"]').trigger('click');
  await nextTick();
}

describe('WecomOrgSubjectPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('单选人员时只保留最后选择的 CRM 用户 ID', async () => {
    const wrapper = mount(WecomOrgSubjectPicker, {
      props: {
        modelValue: '',
        subjects,
        subjectTypes: ['user'],
        valueType: 'crmUserId',
        multiple: false,
      },
    });

    await openPicker(wrapper);
    await wrapper.get('[data-test="subject-user-user_sales_director"]').trigger('click');
    await wrapper.get('[data-test="subject-department-row-dept_region_east"]').trigger('click');
    await wrapper.get('[data-test="subject-user-user_region_manager"]').trigger('click');
    await wrapper.get('[data-test="wecom-org-picker-confirm"]').trigger('click');

    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toBe('user_region_manager');
  });

  it('单选人员时不显示全选入口，避免批量提示和实际已选不一致', async () => {
    const wrapper = mount(WecomOrgSubjectPicker, {
      props: {
        modelValue: '',
        subjects,
        subjectTypes: ['user'],
        valueType: 'crmUserId',
        multiple: false,
      },
    });

    await openPicker(wrapper);

    expect(wrapper.find('[data-test="subject-department-bulk-dept_sales"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('全选');
  });

  it('绑定数组字段时应按多选兜底处理，避免调用层布尔传参异常导致只能单选', async () => {
    const wrapper = mount(WecomOrgSubjectPicker, {
      props: {
        modelValue: [],
        subjects,
        subjectTypes: ['user'],
        valueType: 'crmUserId',
        multiple: false,
      },
    });

    await openPicker(wrapper);

    expect(wrapper.get('[data-test="subject-department-bulk-dept_sales"]').text()).toBe('全选');

    await wrapper.get('[data-test="subject-user-user_sales_director"]').trigger('click');
    await wrapper.get('[data-test="subject-department-row-dept_region_east"]').trigger('click');
    await wrapper.get('[data-test="subject-user-user_region_manager"]').trigger('click');
    await wrapper.get('[data-test="wecom-org-picker-confirm"]').trigger('click');

    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual([
      'user_sales_director',
      'user_region_manager',
    ]);
  });

  it('左侧组织架构应按父子部门渲染成企业微信通讯录树', async () => {
    const wrapper = mount(WecomOrgSubjectPicker, {
      props: {
        modelValue: [],
        subjects,
        subjectTypes: ['user'],
        valueType: 'crmUserId',
        multiple: true,
      },
    });

    await openPicker(wrapper);

    const salesRow = wrapper.get('[data-test="subject-department-row-dept_sales"]');
    const eastRow = wrapper.get('[data-test="subject-department-row-dept_region_east"]');

    expect(salesRow.text()).toContain('销售部');
    expect(eastRow.text()).toContain('华东销售部');
    expect((eastRow.element as HTMLElement).style.paddingLeft).toBe('26px');
    expect(wrapper.text()).not.toContain('全选人员');
    expect(wrapper.text()).not.toContain('未绑定 CRM 部门，不能保存为授权部门。');
    expect(wrapper.find('.wecom-org-subject-picker__tree').text()).not.toContain('全选');
    expect(wrapper.get('[data-test="subject-department-bulk-dept_sales"]').text()).toBe('全选');
  });

  it('人员列表副标题不应重复展示相同姓名，应优先展示职位或账号补充信息', async () => {
    const wrapper = mount(WecomOrgSubjectPicker, {
      props: {
        modelValue: [],
        subjects: {
          ...subjects,
          users: [
            {
              wecomUserId: 'wx_same_name',
              name: '王偶',
              departmentIds: ['dept_sales'],
              primaryDepartmentId: 'dept_sales',
              crmUserId: 'user_same_name',
              crmUserName: '王偶',
              position: '销售会计',
              syncStatus: 'ACTIVE',
              mappingStatus: 'MAPPED',
            },
            {
              wecomUserId: 'wx_no_position',
              name: '何璐',
              departmentIds: ['dept_sales'],
              primaryDepartmentId: 'dept_sales',
              crmUserId: 'user_no_position',
              crmUserName: '何璐',
              syncStatus: 'ACTIVE',
              mappingStatus: 'MAPPED',
            },
          ],
        },
        subjectTypes: ['user'],
        valueType: 'crmUserId',
        multiple: true,
      },
    });

    await openPicker(wrapper);

    expect(wrapper.get('[data-test="subject-user-user_same_name"]').text()).toContain('王偶销售会计');
    expect(wrapper.get('[data-test="subject-user-user_same_name"]').text()).not.toContain('王偶王偶');
    expect(wrapper.get('[data-test="subject-user-user_no_position"]').text()).toContain('何璐wx_no_position');
    expect(wrapper.get('[data-test="subject-user-user_no_position"]').text()).not.toContain('何璐何璐');
  });

  it('点击深层部门后应保留展开路径，不应让组织树整体收起', async () => {
    const deepSubjects: WecomOrgSubjectOptionsView = {
      ...subjects,
      departments: [
        ...subjects.departments,
        {
          departmentId: 'dept_branch_sh',
          name: '上海分公司',
          parentDepartmentId: 'dept_region_east',
          syncStatus: 'ACTIVE',
          crmDepartmentId: 'dept_branch_sh',
          crmDepartmentName: '上海分公司',
          mappingStatus: 'MAPPED',
        },
        {
          departmentId: 'dept_branch_sh_frontend',
          name: 'Web前端组',
          parentDepartmentId: 'dept_branch_sh',
          syncStatus: 'ACTIVE',
          crmDepartmentId: 'dept_branch_sh_frontend',
          crmDepartmentName: 'Web前端组',
          mappingStatus: 'MAPPED',
        },
      ],
    };
    const wrapper = mount(WecomOrgSubjectPicker, {
      props: {
        modelValue: [],
        subjects: deepSubjects,
        subjectTypes: ['user'],
        valueType: 'crmUserId',
        multiple: true,
      },
    });

    await openPicker(wrapper);
    await wrapper.get('[data-test="subject-department-row-dept_region_east"] button').trigger('click');
    await wrapper.get('[data-test="subject-department-row-dept_branch_sh"] button').trigger('click');
    await wrapper.get('[data-test="subject-department-row-dept_branch_sh_frontend"]').trigger('click');

    expect(wrapper.find('[data-test="subject-department-row-dept_sales"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="subject-department-row-dept_region_east"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="subject-department-row-dept_branch_sh"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="subject-department-row-dept_branch_sh_frontend"]').exists()).toBe(true);
  });

  it('人员多选模式下全选当前部门时只加入中间列表展示的可选人员', async () => {
    const wrapper = mount(WecomOrgSubjectPicker, {
      props: {
        modelValue: [],
        subjects,
        subjectTypes: ['user'],
        valueType: 'crmUserId',
        multiple: true,
      },
    });

    await openPicker(wrapper);
    expect(wrapper.get('[data-test="subject-department-bulk-dept_sales"]').text()).toBe('全选');
    await wrapper.get('[data-test="subject-department-bulk-dept_sales"]').trigger('click');
    await wrapper.get('[data-test="wecom-org-picker-confirm"]').trigger('click');

    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual([
      'user_sales_director',
    ]);
    expect(ElMessage.warning).toHaveBeenCalledWith('已选择 1 个对象，1 个对象因不可保存未加入。');
  });

  it('三列内容区域应使用独立滚动容器，避免大量组织和已选标签穿出标题区', async () => {
    const wrapper = mount(WecomOrgSubjectPicker, {
      props: {
        modelValue: ['user_sales_director', 'user_region_manager'],
        subjects,
        subjectTypes: ['user'],
        valueType: 'crmUserId',
        multiple: true,
      },
    });

    await openPicker(wrapper);

    const panels = wrapper.findAll('.wecom-org-subject-picker__panel');
    const bodies = wrapper.findAll('.wecom-org-subject-picker__section-body');

    expect(panels).toHaveLength(3);
    expect(bodies).toHaveLength(3);
    expect(panels.every((panel) => panel.classes().includes('wecom-org-subject-picker__tree')
      || panel.classes().includes('wecom-org-subject-picker__list')
      || panel.classes().includes('wecom-org-subject-picker__selected'))).toBe(true);
  });

  it('部门模式选择部门本身，不会选择部门下人员', async () => {
    const wrapper = mount(WecomOrgSubjectPicker, {
      props: {
        modelValue: [],
        subjects,
        subjectTypes: ['department'],
        valueType: 'crmDepartmentId',
        multiple: true,
      },
    });

    await openPicker(wrapper);
    await wrapper.get('[data-test="subject-department-row-dept_region_east"]').trigger('click');
    await wrapper.get('[data-test="subject-department-dept_region_east"]').trigger('click');
    await wrapper.get('[data-test="wecom-org-picker-confirm"]').trigger('click');

    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual(['dept_region_east']);
  });

  it('从搜索结果选择对象后清空搜索词且保留已选对象', async () => {
    const wrapper = mount(WecomOrgSubjectPicker, {
      props: {
        modelValue: [],
        subjects,
        subjectTypes: ['user'],
        valueType: 'wecomUserId',
        multiple: true,
      },
    });

    await openPicker(wrapper);
    await wrapper.get('[data-test="wecom-org-picker-search"]').setValue('区域');
    await wrapper.get('[data-test="subject-user-wx_region_manager"]').trigger('click');

    expect((wrapper.get('[data-test="wecom-org-picker-search"]').element as HTMLInputElement).value).toBe('');
    expect(wrapper.text()).toContain('区域经理');
  });

  it('CRM 用户 ID 模式下从搜索结果选择人员后应写回已选值', async () => {
    const wrapper = mount(WecomOrgSubjectPicker, {
      props: {
        modelValue: ['user_sales_director'],
        subjects,
        subjectTypes: ['user'],
        valueType: 'crmUserId',
        multiple: true,
      },
    });

    await openPicker(wrapper);
    await wrapper.get('[data-test="wecom-org-picker-search"]').setValue('区域');
    await wrapper.get('[data-test="subject-user-user_region_manager"]').trigger('click');
    await wrapper.get('[data-test="wecom-org-picker-confirm"]').trigger('click');

    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual([
      'user_sales_director',
      'user_region_manager',
    ]);
  });

  it('CRM ID 场景禁用未映射对象，企业微信 ID 场景允许选择未映射对象', async () => {
    const crmWrapper = mount(WecomOrgSubjectPicker, {
      props: {
        modelValue: [],
        subjects,
        subjectTypes: ['user'],
        valueType: 'crmUserId',
        multiple: true,
      },
    });

    await openPicker(crmWrapper);
    expect(crmWrapper.get('[data-test="subject-user-wx_unmapped_member"]').attributes('disabled')).toBeDefined();
    expect(crmWrapper.text()).not.toContain('未绑定 CRM 用户，不能保存为授权人员。');

    const wecomWrapper = mount(WecomOrgSubjectPicker, {
      props: {
        modelValue: [],
        subjects,
        subjectTypes: ['user'],
        valueType: 'wecomUserId',
        multiple: true,
      },
    });

    await openPicker(wecomWrapper);
    await wecomWrapper.get('[data-test="subject-user-wx_unmapped_member"]').trigger('click');
    await wecomWrapper.get('[data-test="wecom-org-picker-confirm"]').trigger('click');

    expect(wecomWrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual(['wx_unmapped_member']);
  });

  it('CRM 部门 ID 场景禁用未映射部门', async () => {
    const wrapper = mount(WecomOrgSubjectPicker, {
      props: {
        modelValue: [],
        subjects,
        subjectTypes: ['department'],
        valueType: 'crmDepartmentId',
        multiple: true,
      },
    });

    await openPicker(wrapper);
    await wrapper.get('[data-test="subject-department-row-wx_unmapped_department"]').trigger('click');

    expect(wrapper.get('[data-test="subject-department-wx_unmapped_department"]').attributes('disabled')).toBeDefined();
    expect(wrapper.text()).not.toContain('未绑定 CRM 部门，不能保存为授权部门。');
  });
});
